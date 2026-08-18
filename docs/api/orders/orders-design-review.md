# Orders Module — Design Review

> **Scope**: `src/modules/orders/**` vs `docs/api/orders/orders.md` and `prisma/schema.prisma` (orders, coupons, coupon_usages)
> **Reviewed against**: the implemented Orders API (customer checkout/history/detail + admin list/get/status-update), coupon and coupon-usage handling
> **Date**: 2026-08-10
> **Verdict**: Solid, contract-faithful implementation with good transactional discipline. **3 issues worth fixing before/at the next touch** (1 real bug, 2 concurrency/race gaps), plus several minor hardening notes. No blocking contract violations.

---

## 1. What's done well

1. **One transaction for the entire checkout** with the per-user `pg_advisory_xact_lock` — matches the doc and closes the duplicate-checkout race (also serializes against cart adds, which take the same lock).
2. **Stock ops as atomic guarded `UPDATE`s** (`reserveStock`/`commitStock`/`releaseStock`) — 0 rows → 409; schema-qualified raw SQL handles the `customer_name` concat search/sort that typed Prisma can't express. Correct pattern given the `PrismaPg` adapter behavior.
3. **Money invariants**: `Prisma.Decimal` throughout, `.toFixed(2)` at the boundary, `round2` on percentage discounts, `maximum_discount_amount` cap, min-0 guard.
4. **Coupon redemption is recorded** (`coupon_usages` row + `usage_count` increment) in the same transaction — one coupon per order enforced by the unique `orders_id`.
5. **Security posture**: foreign orders → 404 (no existence leak), generic coupon rejection message ("invalid or not applicable" — no enumeration), admin routes behind `authentication` + `authorization(ADMIN, SUPER_ADMIN)`, no internal IDs in projections, no `deleted_at` leakage.
6. **Transition matrix** matches the doc exactly, including the refund-restock path (implemented via the `restockStock` order operation on `confirmed|processing → cancelled` and `returned → refunded` — see `docs/api/orders/orders.md`) and the unreachable-but-documented `pending → confirmed` path.

---

## 2. Findings (by severity)

### 2.1 🔴 High — FIXED_AMOUNT coupon can push `total_amount` negative

`orders.service.ts:205-225`: `discountAmount` is capped at `maximum_discount_amount` **only when set**, and only ever guarded `>= 0` — never capped at `subtotal`. A `FIXED_AMOUNT` coupon larger than the subtotal (or a `PERCENTAGE` > 100%, which the schema allows: `DECIMAL(10,2)` with no check) yields `total = subtotal - discount + shipping + tax < 0`. The doc says the discount must be "never below zero," but doesn't cap it at subtotal.

**Fix**: `discountAmount = Prisma.Decimal.min(discountAmount, subtotal)` after computing the raw discount. Add an integration test for discount > subtotal (and >100% percentage).

### 2.2 🟠 Medium — Global `usage_limit` race across users

`orders.service.ts:190` reads `coupon.usage_count < coupon.usage_limit` **outside any lock**, then `incrementCouponUsage` (`orders.repository.ts:312`) does an unguarded `update`. Two different users checking out concurrently can both read `usage_count = limit - 1`, both pass, and the limit ends at `limit + 1`. The per-user limit is safe (serialized by the advisory lock), but the **global** limit is not.

**Fix**: make the increment atomic and guarded —

```sql
UPDATE ... SET usage_count = usage_count + 1 WHERE id = $1 AND usage_count < usage_limit
```

and treat 0 affected rows as a 409 (moves the limit check into the same statement). Alternative: `SELECT ... FOR UPDATE` on the coupon row at the start of coupon processing.

### 2.3 🟠 Medium — Per-user quota consumed by cancelled/refunded orders; `usage_count` never decremented

`countCouponUsagesByUser` counts every redemption ever, and cancel/refund neither removes the `coupon_usages` row nor decrements `usage_count`. So a coupon redeemed, then the order cancelled, still burns quota. The doc says "the session user's prior usage" — ambiguous.

**Decision (resolved)**: quota is restored when an order is cancelled **before fulfillment** (`pending/confirmed/processing → cancelled`) and stays consumed on post-fulfillment refunds (`returned → refunded`). Rationale: a pre-fulfillment cancellation means the sale never happened (the payment is refunded, stock released) — restoring the quota is customer-friendly with no abuse vector, since every *active* redemption still counts toward `usage_limit`. A refunded order was fulfilled and returned, so the coupon already served its conversion purpose and stays consumed.

**Implemented**: `restoreCouponUsage(orders_id, client)` in the orders repository deletes the order's `coupon_usages` row (restoring the per-user count; `orders_id` is unique) and guarded-decrements `coupons.usage_count` (`WHERE usage_count > 0`), all inside the existing status-transition `$transaction`; called only in the `CANCELLED` case of `updateOrderStatus`. Covered by integration + e2e tests; business rule added to `docs/api/orders/orders.md`.

### 2.4 🟡 Low — Admin status update is read-then-act, no row lock

`admin.service.ts:124-143` reads the order, validates the transition, then transitions in a second transaction. Two concurrent admins both reading `CONFIRMED` can both proceed (e.g., both `→ SHIPPED`). Side effects are idempotent so damage is limited, but the "same status → 409" check is racy.

**Fix**: take the row lock in the read (`SELECT … FOR UPDATE` via `$queryRaw` or re-read inside the transaction) so the matrix check and the update are atomic.

**Resolved (T-006)**: `updateOrderStatus` now runs entirely inside a single `$transaction`. The order row is locked first via the new `lockOrderByPublicId` repository op (`SELECT id … FOR UPDATE`, schema-qualified), then re-read, matrix-validated, side-effected, and updated within the same locked transaction. The `from`/`to` and restock audit logs preserve the original prior status. Covered by an integration test that fires two concurrent `CONFIRMED → PROCESSING` transitions and asserts exactly one succeeds (the second observes `PROCESSING` and is rejected), plus a sequential same-status test.

### 2.5 🟡 Low — Silent 0-row `updateMany` guards

`markPaymentPaid` (requires `status = PENDING`) and `commitStock` (requires reserved ≥ qty) never check affected-row counts. Today the unreachable `pending → confirmed` admin path would silently "succeed" with a 0-row payment update and a 0-row commit. Cheap hardening: check the row count and throw on mismatch inside the transaction.

**Resolved (T-007)**: the admin status-transition side-effect operations in `updateOrderStatus` now assert their affected-row counts and throw `ConflictError` on 0 rows inside the locked transaction, so any mismatched precondition aborts and rolls back. Guarded ops: `markPaymentPaid` (payment not payable), `commitStock` per line (insufficient/absent reserved stock), `markPaymentRefunded` (no payment to refund), and `updateShipmentShipped`/`updateShipmentDelivered` (shipment missing). Covered by integration tests that force each failure and assert the order stays in its prior status, stock is untouched, and the payment is not mutated.

### 2.6 🟡 Low — `coupon_code` is case-sensitive

`findCouponByCode` uses `where: { code }` exact match, and the validator doesn't normalize case. Seeded codes are typically uppercase (`WELCOME10`); a user typing `welcome10` gets a 409. Consider case-insensitive lookup (or normalize on write and read). Confirm this is intentional and document it.

**Resolved (T-012, option a — normalize to uppercase)**: coupon codes are now case-insensitive, normalized to uppercase:
- The checkout validator (`placeOrderSchema.coupon_code`) transforms the input to uppercase (`toUpperCase()`), so the captured code is canonical uppercase on write.
- `findCouponByCode` trims + uppercases the input and matches case-insensitively (Prisma `mode: "insensitive"`), so existing mixed/lowercase stored rows still resolve.

A user typing `welcome10` now applies `WELCOME10`; genuinely unknown codes still return 409. Covered by integration tests for mixed-case input and an unknown-code rejection.

### 2.7 🟡 Low — LIKE wildcards in `search`

`orders.repository.ts:242-246` interpolates the raw pattern into `ILIKE`. User input containing `%`/`_` acts as wildcards (parameterized — no SQL injection, but surprising matches). Escape `%`/`_` before building the pattern.

---

## 3. Minor / observations

- **Checkout isn't audit-logged** — only admin status changes get `logger.info({ actorId, … })`. Order creation is the most important audit event; add `logger.info({ actorId: userId, orderPublicId }, "Order placed")`.
- **`PENDING → CONFIRMED` is dead code in v1** — checkout always creates orders as `CONFIRMED`. Harmless, documented, but the admin path (and `markPaymentPaid`) is untestable in practice.
- **`markPaymentRefunded` updates any payment status** — in v1 the payment is always `PAID`, so correct; would misbehave if a `FAILED`/`PENDING` payment ever existed. Consider scoping to `status: PAID`.
- **`row.shipments!` non-null assertions** (`orders.service.ts:62`, `admin.service.ts:37`) — safe while checkout always creates the shipment; a defensive `if (!shipment)` guard would protect against legacy/partial rows.
- **Idempotency**: the doc's cart-consumption backstop + future `Idempotency-Key` note is faithfully implemented — a network-timeout retry after success returns 404 ("Cart not found") rather than the original order. Accepted trade-off, but the retry case is the strongest argument for an idempotency key when real payment providers arrive.
- **Index coverage**: customer list orders by `placed_at DESC` filtered by `users_id` — a composite `(users_id, placed_at)` index would serve it; admin ILIKE search will seq-scan at scale (fine for v1). Worth a note in `docs/DATABASE.md`'s indexing strategy.

---

## 4. Recommended action

1. **Fix now** (small, testable): cap discount at subtotal (§2.1); guarded atomic `usage_count` increment (§2.2).
2. **Next touch**: row-lock the admin transition (§2.4), check `updateMany` counts (§2.5).
3. **Document**: case-sensitivity (§2.6) and LIKE-wildcard notes (§2.7).

None of these block the merge already done; they're hardening items.
