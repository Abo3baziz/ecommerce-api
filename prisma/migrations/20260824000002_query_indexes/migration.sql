-- Query-path indexes (T-021 / T-049): customer order listing filters by
-- users_id and sorts by placed_at; payments.users_id was the only FK column
-- without an index. operating_expenses.created_by_users_id was found in the
-- same audit sweep.

CREATE INDEX "idx_orders_users_id_placed_at"
  ON "orders" ("users_id", "placed_at");

CREATE INDEX "idx_payments_user_id"
  ON "payments" ("users_id");

CREATE INDEX "idx_operating_expenses_created_by_user_id"
  ON "operating_expenses" ("created_by_users_id");
