# Production Readiness Tasks

Task backlog derived from two audits:

- **2026-08-16 review** → T-001…T-027 (orders design-review §2.x, `PROJECT_PROGRESS.md` pending items, `docs/REQUIREMENTS.md`).
- **2026-08-21 full audit** → T-028…T-080. Full report with evidence: [AUDIT-2026-08-21.md](./AUDIT-2026-08-21.md).

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
| **P2** | Should fix before launch (correctness, invariants, platform) |
| **P3** | Quality / hardening / future product (may be out of v1 scope) |

## Index

### P0 — Production blockers

| ID | File | Title | Status |
|----|------|-------|--------|
| T-001 | [T-001-csrf-protection.md](./T-001-csrf-protection.md) | Wire CSRF protection for cookie-authenticated writes | done |
| T-002 | [T-002-real-payment-gateway.md](./T-002-real-payment-gateway.md) | Real payment gateway (replace mock) | todo |
| T-003 | [T-003-payment-webhooks-reconciliation.md](./T-003-payment-webhooks-reconciliation.md) | Payment webhooks + reconciliation | todo |
| T-028 | [T-028-build-boot-broken.md](./T-028-build-boot-broken.md) | Fix production build boot failure (ESM import extensions) | in_progress |

### P1 — Pre-traffic hardening

| ID | File | Title | Status |
|----|------|-------|--------|
| T-004 | [T-004-session-idle-timeout.md](./T-004-session-idle-timeout.md) | Session idle-timeout via `last_activity_at` | done |
| T-005 | [T-005-expired-session-cleanup.md](./T-005-expired-session-cleanup.md) | Expired-session cleanup job | done |
| T-006 | [T-006-orders-admin-row-lock.md](./T-006-orders-admin-row-lock.md) | Orders §2.4 — row-lock admin status transitions | done |
| T-007 | [T-007-orders-updateMany-counts.md](./T-007-orders-updateMany-counts.md) | Orders §2.5 — check `updateMany` affected-row counts | done |
| T-008 | [T-008-auto-restock-on-cancel.md](./T-008-auto-restock-on-cancel.md) | Auto-restock inventory on cancel/refund | done |
| T-009 | [T-009-real-sms-provider.md](./T-009-real-sms-provider.md) | Real SMS provider for phone OTP | wontfix |
| T-010 | [T-010-deploy-ops-checklist.md](./T-010-deploy-ops-checklist.md) | Deploy & ops checklist (secrets, monitoring, backups) | todo |
| T-029 | [T-029-login-brute-force-defense.md](./T-029-login-brute-force-defense.md) | Login/register brute-force defense (IP limits + account lockout) | done |
| T-030 | [T-030-shipment-address-width-mismatch.md](./T-030-shipment-address-width-mismatch.md) | Checkout 500: shipment address column-width mismatch | in_progress |
| T-031 | [T-031-reset-password-page-missing.md](./T-031-reset-password-page-missing.md) | Build the missing reset-password page | in_progress |
| T-032 | [T-032-test-db-isolation-guard.md](./T-032-test-db-isolation-guard.md) | Test/dev DB isolation + destructive-cleanup guard | todo |
| T-033 | [T-033-trust-proxy-config.md](./T-033-trust-proxy-config.md) | Configure trust proxy for correct client IPs | todo |
| T-034 | [T-034-logger-architecture-redaction.md](./T-034-logger-architecture-redaction.md) | Logger: O(n²) rewrite, rotation, token redaction | todo |

### P2 — Correctness / invariants / platform

| ID | File | Title | Status |
|----|------|-------|--------|
| T-011 | [T-011-openapi-spec.md](./T-011-openapi-spec.md) | Generate OpenAPI 3.1 from `docs/api/**` | todo |
| T-012 | [T-012-coupon-code-case.md](./T-012-coupon-code-case.md) | Orders §2.6 — coupon code case-insensitivity | done |
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
| T-035 | [T-035-prisma-error-mapping.md](./T-035-prisma-error-mapping.md) | Global Prisma error mapping (P2002/P2025 → 4xx) | todo |
| T-036 | [T-036-token-invalidation-on-password-change.md](./T-036-token-invalidation-on-password-change.md) | Invalidate pending tokens on credential rotation | todo |
| T-037 | [T-037-last-admin-race.md](./T-037-last-admin-race.md) | Fix last-admin demotion TOCTOU race | todo |
| T-038 | [T-038-phone-otp-attempt-limit.md](./T-038-phone-otp-attempt-limit.md) | Phone OTP attempt limiting + failure counter | todo |
| T-039 | [T-039-admin-contact-edit-guard.md](./T-039-admin-contact-edit-guard.md) | Guard admin edits of customer contact fields | todo |
| T-040 | [T-040-cart-advisory-lock-coverage.md](./T-040-cart-advisory-lock-coverage.md) | Cart mutations must respect the per-user advisory lock | todo |
| T-041 | [T-041-primary-image-invariant.md](./T-041-primary-image-invariant.md) | Primary-image invariant via partial unique index | todo |
| T-042 | [T-042-address-default-invariant.md](./T-042-address-default-invariant.md) | Fix address default-flag invariant (zero/multi defaults) | todo |
| T-043 | [T-043-duplicate-review-backstop.md](./T-043-duplicate-review-backstop.md) | Duplicate-review DB backstop (partial unique index) | todo |
| T-044 | [T-044-like-escape-other-modules.md](./T-044-like-escape-other-modules.md) | Escape LIKE wildcards in remaining search endpoints | todo |
| T-045 | [T-045-rating-summary-filter-bug.md](./T-045-rating-summary-filter-bug.md) | Review summary must ignore the rating filter | todo |
| T-046 | [T-046-idle-timeout-effective.md](./T-046-idle-timeout-effective.md) | Make session idle timeout effective (constant == TTL) | todo |
| T-047 | [T-047-migrations-baseline.md](./T-047-migrations-baseline.md) | Baseline Prisma migrations + migrate deploy | todo |
| T-048 | [T-048-dependency-audit-vulns.md](./T-048-dependency-audit-vulns.md) | Resolve high-severity npm audit findings | todo |
| T-049 | [T-049-payments-users-index.md](./T-049-payments-users-index.md) | Add missing index on payments.users_id | todo |
| T-050 | [T-050-ci-push-trigger.md](./T-050-ci-push-trigger.md) | Run CI on pushes to main (close direct-push bypass) | todo |
| T-051 | [T-051-api-404-envelope.md](./T-051-api-404-envelope.md) | JSON 404 envelope for unknown /api routes | todo |
| T-052 | [T-052-health-readiness.md](./T-052-health-readiness.md) | Health/readiness endpoint with DB probe, above limiter | todo |
| T-053 | [T-053-graceful-shutdown.md](./T-053-graceful-shutdown.md) | Complete graceful shutdown (sockets, Prisma, log flush) | todo |
| T-054 | [T-054-docs-contract-drift.md](./T-054-docs-contract-drift.md) | Fix documented-vs-implemented contract drift (API_ENDPOINTS.md) | todo |

### P3 — Quality / hardening / future product

| ID | File | Title | Status |
|----|------|-------|--------|
| T-024 | [T-024-cart-stock-availability.md](./T-024-cart-stock-availability.md) | Cart line stock availability (`max_available`) | todo |
| T-025 | [T-025-checkout-idempotency-key.md](./T-025-checkout-idempotency-key.md) | Checkout `Idempotency-Key` support | todo |
| T-026 | [T-026-order-confirmation-email.md](./T-026-order-confirmation-email.md) | Order confirmation email | todo |
| T-027 | [T-027-restrict-image-url-host.md](./T-027-restrict-image-url-host.md) | Restrict `image_url` to ImageKit host | todo |
| T-055 | [T-055-atomic-token-claim.md](./T-055-atomic-token-claim.md) | Atomic single-use token claiming | todo |
| T-056 | [T-056-login-timing-equalization.md](./T-056-login-timing-equalization.md) | Equalize login timing for unknown users | todo |
| T-057 | [T-057-anonymous-csrf-login.md](./T-057-anonymous-csrf-login.md) | CSRF protection for anonymous unsafe endpoints | todo |
| T-058 | [T-058-soft-delete-email-squatting.md](./T-058-soft-delete-email-squatting.md) | Free email/phone of soft-deleted accounts | todo |
| T-059 | [T-059-transactional-registration.md](./T-059-transactional-registration.md) | Make registration transactional | todo |
| T-060 | [T-060-auth-consistency-cleanups.md](./T-060-auth-consistency-cleanups.md) | Auth module consistency cleanups (6 items) | todo |
| T-061 | [T-061-inventory-quantity-overflow.md](./T-061-inventory-quantity-overflow.md) | Cap inventory quantity_change magnitude (int4 overflow) | todo |
| T-062 | [T-062-orders-small-hardening.md](./T-062-orders-small-hardening.md) | Orders small hardening batch (assert/search/factory) | todo |
| T-063 | [T-063-coupon-lock-invariant-doc.md](./T-063-coupon-lock-invariant-doc.md) | Document/enforce coupon per-user lock invariant | todo |
| T-064 | [T-064-display-order-uniques.md](./T-064-display-order-uniques.md) | Unique constraints for image display_order | todo |
| T-065 | [T-065-deleted-slug-policy.md](./T-065-deleted-slug-policy.md) | Soft-deleted slug reservation policy + admin detail mismatch | todo |
| T-066 | [T-066-slug-generation-clamp.md](./T-066-slug-generation-clamp.md) | Slug generation: clamp length, non-Latin policy | todo |
| T-067 | [T-067-review-image-provenance.md](./T-067-review-image-provenance.md) | Review image provenance binding + orphan cleanup | todo |
| T-068 | [T-068-product-delete-retention.md](./T-068-product-delete-retention.md) | Product soft-delete dependent-data retention policy | todo |
| T-069 | [T-069-barcode-uniqueness.md](./T-069-barcode-uniqueness.md) | Barcode uniqueness decision + enforcement | todo |
| T-070 | [T-070-pagination-tiebreakers.md](./T-070-pagination-tiebreakers.md) | Deterministic pagination tiebreakers for products/variants | todo |
| T-071 | [T-071-postal-code-rename-country-drop.md](./T-071-postal-code-rename-country-drop.md) | postal_code rename + drop country field | todo |
| T-072 | [T-072-cleanup-jobs-extension.md](./T-072-cleanup-jobs-extension.md) | Cleanup jobs: verification tokens + CLI disconnect | todo |
| T-073 | [T-073-public-pages-hardening.md](./T-073-public-pages-hardening.md) | Public verify pages: safe DOM writes + cache headers | todo |
| T-074 | [T-074-http-request-hardening.md](./T-074-http-request-hardening.md) | HTTP/request hardening batch (5 items) | todo |
| T-075 | [T-075-cors-multi-origin.md](./T-075-cors-multi-origin.md) | CORS multi-origin support | todo |
| T-076 | [T-076-schema-hygiene.md](./T-076-schema-hygiene.md) | Schema hygiene: dead artifacts + timestamp alignment | todo |
| T-077 | [T-077-tooling-config.md](./T-077-tooling-config.md) | Tooling config: engines, tsconfig strictness, coverage floors | todo |
| T-078 | [T-078-ci-hygiene.md](./T-078-ci-hygiene.md) | CI hygiene: pin actions, secret fallbacks, restore lost workflows | todo |
| T-079 | [T-079-enhancements-triage.md](./T-079-enhancements-triage.md) | ENHANCEMENTS.md triage (phone flow, duplicate-endpoint claim) | todo |
| T-080 | [T-080-reviews-purchase-flag-doc.md](./T-080-reviews-purchase-flag-doc.md) | Document REVIEWS_REQUIRE_PURCHASE flag state | todo |

## Suggested execution order

```text
Wave 0 (unblock production):   T-028 → T-030 → T-031
Wave 1 (security):             T-029 → T-036 → T-037 → T-038 → T-039 → T-046
Wave 2 (data integrity):       T-035 → T-040 → T-041 → T-042 → T-043 → T-045
Wave 3 (ops/platform):         T-032 → T-033 → T-034 → T-047 → T-048 → T-049 → T-050 → T-051 → T-052 → T-053
Wave 4 (quality/docs):         T-010 → T-011 → T-013 … T-023, T-044, T-054 … T-063 as capacity allows
Wave 5 (product/hardening):    T-024 … T-027, T-064 … T-080 when product needs them
```

Legacy waves from the 2026-08-16 review (security+money T-001→T-002→T-003; session/orders T-004…T-008) are already resolved or superseded by the waves above.

## Notes

- Real payment gateway is listed in `docs/REQUIREMENTS.md` **Out of Scope** for the initial version; T-002/T-003 are still production blockers if real money is the goal.
- Prefer small, focused branches. Do not mix P0 security work with P3 product work.
- Each task file is the source of truth for that item until marked `done`.
- T-047 (migrations baseline) unblocks several schema tasks (T-041/T-042/T-043/T-064/T-065/T-069/T-071/T-076) — do it early in Wave 3.
