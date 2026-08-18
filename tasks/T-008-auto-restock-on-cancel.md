# T-008 — Auto-restock inventory on cancel/refund

| Field | Value |
|-------|-------|
| **ID** | T-008 |
| **Priority** | P1 |
| **Status** | done |
| **Type** | `feature` |
| **Branch** | `feature/orders-auto-restock` |
| **Depends on** | T-006 recommended (same code path) |
| **Blocks** | — |

## Problem

Cancelling a **confirmed/processing** order refunds payment but does **not** restock inventory. Stock was already committed at checkout (v1 mock path). Operators must manually adjust inventory. A dedicated `restockStock` op was noted as a future enhancement.

## Goal

Restore sellable stock automatically when an order is cancelled or refunded after stock was committed, inside the status-transition transaction.

## Scope

- Define rules:
  - `PENDING → CANCELLED`: already releases **reserved** stock (keep).
  - `CONFIRMED/PROCESSING → CANCELLED`: restock committed quantities.
  - `RETURNED → REFUNDED`: restock (or partial restock policy — decide).
- Implement `restockStock` (or reuse inventory internal ops) with the same non-negative / transactional guarantees as other inventory ops.
- Audit log the restock reason (`order_cancel`, `order_refund`).
- Docs: orders + inventory business rules.
- Integration tests per transition.

## Decisions needed

- [x] Restock on `REFUNDED` after return? (**done: yes, full line qty** — partial returns don't exist in v1).
- [x] Restock destroyed/damaged returns? (**done: yes, always restock in v1**).

## Acceptance criteria

- [x] Confirmed cancel increases `quantity_on_hand` by line quantities.
- [x] No double-restock on repeated transitions.
- [x] Docs updated.
- [x] Tests green.

## References

- `PROJECT_PROGRESS.md` — Pending (`restockStock`)
- `src/modules/orders/service/admin.service.ts` CANCELLED / REFUNDED cases
- `docs/api/inventory/inventory.md`
