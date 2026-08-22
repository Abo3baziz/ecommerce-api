# Analytics API

## Overview

Super-admin-only business and financial insights: P&L (product revenue vs
collected totals, COGS, operating expenses, net profit), daily trends,
product/category performance, customer growth, and sales-quality metrics.
Operating expenses are maintained manually through the ledger endpoints below
and are automatically audit-logged by the admin capture middleware.

All endpoints require a `SUPER_ADMIN` session; regular admins receive `403`.

---

# Get Analytics Overview

```
GET /api/v1/admin/analytics/overview?date_from=&date_to=
```

Both params optional ISO datetimes; defaults cover the last 30 days (UTC).

## Response

```
{
  "success": true,
  "data": {
    "range": { "from": "...", "to": "..." },
    "revenue": {
      "product_revenue": "...",     // Σ(subtotal − discount), non-cancelled & non-refunded
      "collected_total": "...",     // Σ total_amount
      "shipping_collected": "...",
      "tax_collected": "...",       // reported for transparency; not income
      "discounts_given": "...",
      "refunded_total": "..."       // Σ total_amount of REFUNDED orders in range
    },
    "costs": {
      "cogs": "...",                // Σ quantity × current variant cost_price
      "operating_expenses": "...",  // Σ operating_expenses.spent_at in range
      "total_costs": "..."
    },
    "profit": { "gross_profit": "...", "net_profit": "...", "net_margin_pct": "..." },
    "orders":  { "count": 0, "avg_order_value": "..." },
    "series":  [ { "bucket_start": "...", "product_revenue": "...",
                   "collected_total": "...", "costs": "..." } ],   // zero-filled daily
    "top_products": [ { "product_public_id", "name", "slug", "units",
                        "revenue", "cogs", "gross_margin_pct" } ],  // max 8
    "category_share": [ { "category_public_id", "name", "revenue", "share_pct" } ],
    "customers": { "total_active": 0, "new_in_range": 0, "repeat_purchase_pct": "..." },
    "sales_quality": { "discounted_orders_pct": "...", "coupons_redeemed": 0 }
  }
}
```

Known limitation: COGS uses each variant's **current** cost price; historical
cost snapshots are a documented future enhancement.

---

# Operating Expense Ledger

| Endpoint | Purpose |
| --- | --- |
| `GET /admin/analytics/expenses` | List (`page`, `limit`, `category`, `date_from`, `date_to`) |
| `POST /admin/analytics/expenses` | Create |
| `PATCH /admin/analytics/expenses/{id}` | Partial update |
| `DELETE /admin/analytics/expenses/{id}` | Hard delete |

Expense object:

```
{ "public_id": "exp_…", "description": "Office rent — August",
  "category": "RENT", "amount": "1200.00", "spent_at": "2026-08-01",
  "created_by": { "id": 3028, "name": "…" }, "created_at": "…", "updated_at": "…" }
```

`category` ∈ RENT · SALARIES · MARKETING · UTILITIES · SHIPPING · SOFTWARE · OTHER.
`amount` is a positive decimal string. Mutations return the updated object
(`201` on create, `200` on update) or `204` on delete; unknown ids → `404`;
invalid payloads → `400`.
