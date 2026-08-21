# T-026 — Order confirmation email

| Field | Value |
|-------|-------|
| **ID** | T-026 |
| **Priority** | P3 |
| **Status** | todo |
| **Type** | `feature` |
| **Branch** | `feature/order-confirmation-email` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

Password-reset and verification emails exist; order confirmation emails do not. Mailer templates were designed for reuse.

## Goal

Send a non-blocking order confirmation email after successful checkout (and optionally after payment confirmed when async payments land).

## Scope

- Template under `src/shared/mailer/templates/`.
- Fire-and-forget send with error logging (same pattern as verification).
- Include order number, totals, item summary, link placeholder for frontend order page.
- Tests with mocked mailer.

## Acceptance criteria

- [ ] Successful checkout queues/sends confirmation email.
- [ ] Mailer failure does not fail checkout.
- [ ] Template escaped; tests green.

## References

- `src/shared/mailer/`
- Mailer template system notes in PROJECT_PROGRESS
