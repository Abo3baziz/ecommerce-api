# T-083 — Paymob HTTP client (intention / inquiry / refund)

| Field | Value |
|-------|-------|
| **ID** | T-083 |
| **Priority** | P0 |
| **Status** | wontfix |
| **Type** | `feature` |
| **Branch** | `feature/paymob-client` |
| **Depends on** | T-081 |
| **Blocks** | T-084, T-085, T-086, T-087 |

## Problem

All Paymob communication (intention creation, transaction inquiry, refunds,
auth-token flow) must live behind one injectable HTTP boundary so services
and tests can mock it without touching the real gateway.

## Goal

Implement `PaymobClient` under `src/modules/payments/service/` with three
operations, typed responses, and timeout/error normalization, plus unit tests
with mocked HTTP.

## Scope

- `src/modules/payments/service/paymob.client.ts`:
  - `createIntention(input)` → `POST {PAYMOB_BASE_URL}/v1/intention/`
    with header `Authorization: Token {PAYMOB_SECRET_KEY}`; body per the
    skill's `references/intention-api.md`:
    - `amount` in piasters (EGP × 100, integer)
    - `currency: "EGP"`
    - `payment_methods: [{ integration_id: <card> }, { integration_id: <wallet> }]`
    - `special_reference` = order public id
    - `notification_url` = `PAYMOB_NOTIFICATION_URL`
    - `redirection_url` = `PAYMOB_REDIRECTION_URL`
    - `items` from order-item snapshot (`name`, `amount_cents`, `quantity`,
      `description` where available)
    - `billing_data` from shipment snapshot (first/last name, phone, email,
      country, state, city, street, building, apartment, postal_code,
      floor/neighborhood best-effort)
    - Returns `{ client_secret, intention_id }` (exact field names verified
      against live docs during implementation).
  - `getAuthToken()` → `POST /api/auth/tokens` with API key (used by inquiry).
  - `inquiryTransactionByMerchantOrderId(specialReference)` →
    `GET /v1/intention/{intention_id}/transactions` (or transaction inquiry
    endpoint confirmed from live docs) using the auth token.
  - `refund(transactionId, amountCents)` → `POST /api/v1/refunds/commerce`
    (endpoint/shape verified against `references/advanced-features.md` + live
    docs).
- Error handling: normalize non-2xx into typed errors (`PaymobApiError` with
  status + provider message); never log secrets or full PANs.
- Unit tests: mocked HTTP (vitest + interceptors or injected fetch) for
  success/error/timeout for each operation, and assert request shape
  (auth header, piaster amount, special_reference pass-through).

## Out of scope

- Webhook handling (T-085).
- Retries/queueing (covered by T-086 reconciliation).

## Acceptance criteria

- [ ] All three operations implemented behind one client class.
- [ ] Amounts converted to piasters correctly.
- [ ] `Authorization: Token …` header exactly as the skill prescribes.
- [ ] Unit tests green; no real Paymob calls in tests.

## References

- T-081
- Skill: `references/intention-api.md`, `references/transaction-inquiry.md`,
  `references/advanced-features.md`, `references/code-nodejs.md`
- `src/modules/orders/payment/gateway.ts`