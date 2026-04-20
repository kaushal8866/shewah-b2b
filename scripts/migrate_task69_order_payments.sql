-- ──────────────────────────────────────────────────────────────────────────
-- Task #69 — Per-order payment log + due-payment reminder
--
-- Adds a dedicated `order_payments` ledger so every payment received against
-- an order is captured with date + reference number (instead of only the
-- aggregate `orders.advance_paid` figure).
--
-- Also adds a `payment_reminder_date` column to `orders` so the dispatch flow
-- can schedule a follow-up reminder when the order ships before the balance
-- is collected. The order list / detail surfaces this date and the admin is
-- re-prompted (to reschedule with the retailer) once the date has passed.
--
-- Idempotent — safe to re-run.
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists order_payments (
  id            uuid        primary key default uuid_generate_v4(),
  created_at    timestamptz default now(),
  order_id      uuid        not null references orders(id) on delete cascade,
  amount        numeric     not null check (amount > 0),
  payment_date  date        not null default current_date,
  reference     text,                                  -- UTR / cheque no / txn id
  method        text,                                  -- 'upi','bank','cheque','cash','card','other'
  notes         text,
  created_by    text                                   -- username of the admin who logged it
);

create index if not exists order_payments_order_idx
  on order_payments(order_id, payment_date desc);

alter table order_payments enable row level security;

drop policy if exists "service_role_all" on order_payments;
create policy "service_role_all" on order_payments
  for all using (auth.role() = 'service_role');

-- Reminder column on orders. Set when the admin dispatches with a non-zero
-- balance and chooses "collect later (in N days)". Cleared automatically once
-- the order is fully paid.
alter table orders
  add column if not exists payment_reminder_date date;
