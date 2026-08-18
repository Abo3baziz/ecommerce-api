# Production Readiness Tasks

Task backlog derived from the production-readiness review (2026-08-16), `PROJECT_PROGRESS.md` pending items, `docs/api/orders/orders-design-review.md`, and `docs/REQUIREMENTS.md`.

## How to use

1. Pick the next **P0** task (or the highest open priority).
2. Create a branch per `AGENTS.md` (`bugfix/…`, `feature/…`, `chore/…`, `docs/…`).
3. Implement, test, update docs + `PROJECT_PROGRESS.md`.
4. Mark the task file status `done` and move its summary into `PROJECT_PROGRESS.md`.

## Status legend

| Status | Meaning |
|--------|---------|
| `todo` | Not started |
| `in_progress` | Actively being worked |
| `done` | Merged to `main` and verified |
| `blocked` | Waiting on a decision or dependency |
| `wontfix` | Explicitly deferred / out of scope |

## Priority legend

| Priority | Meaning |
|----------|---------|
| **P0** | Production blocker (security, money, data integrity) |
| **P1** | Should fix before real traffic (ops, concurrency, lifecycle) |
| **P2** | Quality / DX / polish |
| **P3** | Future product enhancements (may be out of v1 scope) |

## Index

### P0 — Production blockers

| ID | File | Title | Status |
|----|------|-------|--------|
| T-001 | [T-001-csrf-protection.md](./T-001-csrf-protection.md) | Wire CSRF protection for cookie-authenticated writes | todo |
| T-002 | [T-002-real-payment-gateway.md](./T-002-real-payment-gateway.md) | Real payment gateway (replace mock) | todo |
| T-003 | [T-003-payment-webhooks-reconciliation.md](./T-003-payment-webhooks-reconciliation.md) | Payment webhooks + reconciliation | todo |

### P1 — Pre-traffic hardening

| ID | File | Title | Status |
|----|------|-------|--------|
| T-004 | [T-004-session-idle-timeout.md](./T-004-session-idle-timeout.md) | Session idle-timeout via `last_activity_at` | todo |
| T-005 | [T-005-expired-session-cleanup.md](./T-005-expired-session-cleanup.md) | Expired-session cleanup job | todo |
| T-006 | [T-006-orders-admin-row-lock.md](./T-006-orders-admin-row-lock.md) | Orders §2.4 — row-lock admin status transitions | todo |
| T-007 | [T-007-orders-updateMany-counts.md](./T-007-orders-updateMany-counts.md) | Orders §2.5 — check `updateMany` affected-row counts | todo |
| T-008 | [T-008-auto-restock-on-cancel.md](./T-008-auto-restock-on-cancel.md) | Auto-restock inventory on cancel/refund | done |
| T-009 | [T-009-real-sms-provider.md](./T-009-real-sms-provider.md) | Real SMS provider for phone OTP | todo |
| T-010 | [T-010-deploy-ops-checklist.md](./T-010-deploy-ops-checklist.md) | Deploy & ops checklist (secrets, monitoring, backups) | todo |

### P2 — Quality / DX / polish

| ID | File | Title | Status |
|----|------|-------|--------|
| T-011 | [T-011-openapi-spec.md](./T-011-openapi-spec.md) | Generate OpenAPI 3.1 from `docs/api/**` | todo |
| T-012 | [T-012-coupon-code-case.md](./T-012-coupon-code-case.md) | Orders §2.6 — coupon code case-insensitivity | todo |
| T-013 | [T-013-orders-search-like-escape.md](./T-013-orders-search-like-escape.md) | Orders §2.7 — escape LIKE wildcards in search | todo |
| T-014 | [T-014-checkout-audit-log.md](./T-014-checkout-audit-log.md) | Audit-log order placement | todo |
| T-015 | [T-015-admin-audit-table.md](./T-015-admin-audit-table.md) | Dedicated admin audit-log table | todo |
| T-016 | [T-016-typecheck-tests.md](./T-016-typecheck-tests.md) | Typecheck `tests/` in CI | todo |
| T-017 | [T-017-repository-unit-tests.md](./T-017-repository-unit-tests.md) | Repository-layer unit tests | todo |
| T-018 | [T-018-super-admin-recovery-cli.md](./T-018-super-admin-recovery-cli.md) | SUPER_ADMIN recovery / demotion CLI | todo |
| T-019 | [T-019-payment-refund-status-guard.md](./T-019-payment-refund-status-guard.md) | Scope `markPaymentRefunded` to `PAID` only | todo |
| T-020 | [T-020-shipment-null-guards.md](./T-020-shipment-null-guards.md) | Defensive shipment null guards | todo |
| T-021 | [T-021-orders-composite-index.md](./T-021-orders-composite-index.md) | Composite index `(users_id, placed_at)` on orders | todo |
| T-022 | [T-022-imagekit-live-upload-verify.md](./T-022-imagekit-live-upload-verify.md) | Live ImageKit client-side upload verification | todo |
| T-023 | [T-023-stale-progress-cleanup.md](./T-023-stale-progress-cleanup.md) | Clean stale Next Step entries in PROJECT_PROGRESS | todo |

### P3 — Future product (may be out of v1)

| ID | File | Title | Status |
|----|------|-------|--------|
| T-024 | [T-024-cart-stock-availability.md](./T-024-cart-stock-availability.md) | Cart line stock availability (`max_available`) | todo |
| T-025 | [T-025-checkout-idempotency-key.md](./T-025-checkout-idempotency-key.md) | Checkout `Idempotency-Key` support | todo |
| T-026 | [T-026-order-confirmation-email.md](./T-026-order-confirmation-email.md) | Order confirmation email | todo |
| T-027 | [T-027-restrict-image-url-host.md](./T-027-restrict-image-url-host.md) | Restrict `image_url` to ImageKit host | todo |

## Suggested execution order

```text
Wave 1 (security + money):     T-001 → T-002 → T-003
Wave 2 (session + orders):     T-004 → T-005 → T-006 → T-007 → T-008
Wave 3 (comms + ops):          T-009 → T-010
Wave 4 (quality):              T-011 … T-023 as capacity allows
Wave 5 (product):              T-024 … T-027 when product needs them
```

## Notes

- Real payment gateway is listed in `docs/REQUIREMENTS.md` **Out of Scope** for the initial version; T-002/T-003 are still production blockers if real money is the goal.
- Prefer small, focused branches. Do not mix P0 security work with P3 product work.
- Each task file is the source of truth for that item until marked `done`.
