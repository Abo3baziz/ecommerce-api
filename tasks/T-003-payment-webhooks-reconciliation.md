# T-003 — Payment webhooks + reconciliation

| Field | Value |
|-------|-------|
| **ID** | T-003 |
| **Priority** | P0 |
| **Status** | todo |
| **Type** | `feature` |
| **Branch** | `feature/payment-webhooks` |
| **Depends on** | T-002 |
| **Blocks** | Reliable production payments |

## Problem

Without webhooks, the API only knows payment state from the synchronous checkout response. Network timeouts, client disconnects, and async provider states leave payments and orders potentially inconsistent.

## Goal

Receive and verify provider webhooks; reconcile payment + order status idempotently; support safe retries after client timeouts.

## Scope

- Webhook endpoint(s) with signature verification.
- Idempotent event handling (store event IDs / use unique constraints).
- Map provider events → internal `payment_status` + order transitions.
- Reconciliation job or admin tooling for stuck `pending` payments.
- Structured logging + alerts on signature failures / unknown events.
- Docs + Apidog notes (webhook is server-to-server; no session cookie).
- Tests: valid signature, invalid signature, duplicate event, out-of-order events.

## Out of scope

- Full dispute/chargeback workflows (document as follow-up unless required by provider).

## Acceptance criteria

- [ ] Forged webhooks rejected.
- [ ] Duplicate events do not double-apply side effects.
- [ ] Successful payment webhook confirms order + commits stock (if not already).
- [ ] Failed/cancelled payment releases reserved stock when applicable.
- [ ] Docs + tests green.

## References

- T-002
- `src/modules/orders/payment/`
- Orders design review — idempotency note
