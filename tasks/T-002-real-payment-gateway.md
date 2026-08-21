# T-002 — Real payment gateway (replace mock)

| Field | Value |
|-------|-------|
| **ID** | T-002 |
| **Priority** | P0 |
| **Status** | todo |
| **Type** | `feature` |
| **Branch** | `feature/payment-gateway` |
| **Depends on** | — |
| **Blocks** | T-003 (webhooks), real checkout money flow |

## Problem

Checkout uses a **mock** payment provider that always succeeds synchronously. Orders are created as `confirmed` with stock committed immediately. There is no real charge, no provider reference lifecycle, and no failure path for declined cards.

`docs/REQUIREMENTS.md` lists real gateway integration as out of initial scope, but it is a **production blocker** for real money.

## Goal

Integrate at least one real payment provider behind the existing payment abstraction so business logic (orders, inventory, coupons) does not depend on mock behavior.

## Scope

- Choose provider (Stripe / Paymob / PayPal — decision required).
- Implement gateway adapter under `src/modules/orders/payment/` (or dedicated payments module) implementing the existing `gateway` interface.
- Support create-intent / authorize / capture (or provider-equivalent) flows.
- Persist provider reference, status transitions (`pending` → `paid` / `failed`).
- Allow orders to remain `pending` until payment confirms (revive dead `PENDING → CONFIRMED` path).
- Env config + secrets; never log full PAN/secrets.
- Docs: `docs/api/orders/orders.md`, payments section, operations.
- Tests: unit for adapter; integration with mocked provider HTTP; e2e with test keys if feasible.

## Out of scope

- Webhooks/reconciliation (T-003) — design hooks only.
- Multi-currency (v1 is single-unit).
- Saved payment methods / wallets (unless trivial with chosen provider).

## Decisions needed

- [ ] Which provider first?
- [ ] Authorize-then-capture vs charge-immediately?
- [ ] Keep mock gateway available behind `NODE_ENV=test` / feature flag?

## Acceptance criteria

- [ ] Real provider can complete a successful payment in staging.
- [ ] Failed payment leaves order/payment in a defined non-success state; stock not over-committed.
- [ ] Mock remains usable for automated tests.
- [ ] Docs and env examples updated.
- [ ] Typecheck, build, tests green.

## References

- `docs/REQUIREMENTS.md` — Payments + Out of Scope
- `src/modules/orders/payment/`
- `docs/api/orders/orders.md`
