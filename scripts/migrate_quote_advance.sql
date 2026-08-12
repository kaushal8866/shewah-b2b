-- Quote advance payments.
--
-- Gold moves daily, so a quote can no longer be a static PDF that stays valid
-- for weeks. Once a customer approves the digital quote we freeze the advance
-- due — 100% of the quoted gold value plus 50% of the quoted diamond value —
-- and hold the order until an admin verifies payment or waives it.
--
-- Making charges, labour, hallmarking and GST are deliberately NOT in the
-- advance base; they fall due on the final invoice.
--
-- Advance state is kept in its own columns rather than folded into
-- quotes.status, because a quote can be 'accepted' with the advance still
-- unpaid, waived, or under review — two independent dimensions.

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS advance_status text NOT NULL DEFAULT 'not_requested'
    CHECK (advance_status IN (
      'not_requested',    -- quote not yet approved by the customer
      'awaiting_payment', -- approved; advance due, nothing submitted
      'proof_submitted',  -- customer sent a UTR/screenshot, admin to verify
      'verified',         -- admin confirmed the money landed
      'waived'            -- admin chose to proceed without an advance
    )),
  -- Frozen at approval time. The quote's own gold rate can go stale, but what
  -- the customer agreed to pay must not move under them afterwards.
  ADD COLUMN IF NOT EXISTS advance_due numeric NOT NULL DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS advance_gold_value numeric NOT NULL DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS advance_diamond_value numeric NOT NULL DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS advance_gold_pct numeric NOT NULL DEFAULT 100.0,
  ADD COLUMN IF NOT EXISTS advance_diamond_pct numeric NOT NULL DEFAULT 50.0,
  -- Customer-supplied proof. No payment gateway: they transfer and tell us how.
  ADD COLUMN IF NOT EXISTS advance_reference text,
  ADD COLUMN IF NOT EXISTS advance_proof_url text,
  ADD COLUMN IF NOT EXISTS advance_paid_amount numeric,
  ADD COLUMN IF NOT EXISTS advance_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS advance_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS advance_verified_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS advance_note text;

COMMENT ON COLUMN quotes.advance_due IS
  'Frozen at customer approval: gold_value × gold_pct + diamond_value × diamond_pct, capped at grand_total. Excludes making charges, labour, hallmarking and GST.';

COMMENT ON COLUMN quotes.advance_paid_amount IS
  'What the customer says they actually sent. May differ from advance_due — the admin decides whether a short payment is acceptable when verifying.';

-- Admin queue: quotes waiting on someone to check a payment.
CREATE INDEX IF NOT EXISTS idx_quotes_advance_status
  ON quotes(advance_status)
  WHERE advance_status IN ('proof_submitted', 'awaiting_payment');
