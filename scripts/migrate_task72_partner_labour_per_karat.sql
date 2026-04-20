-- Task #68 (migration #72): per-partner labour rates for the two new
-- sellable karats (9k, 10k). The 14k/18k/22k columns already exist on
-- manufacturing_partners; this fills out the full SELLABLE_KARATS set.
--
-- Backfill: copy labour_rate_14k as a sane starting value for the two
-- new low-purity rows so existing partners don't price at zero.

ALTER TABLE manufacturing_partners
  ADD COLUMN IF NOT EXISTS labour_rate_10k numeric,
  ADD COLUMN IF NOT EXISTS labour_rate_9k  numeric;

UPDATE manufacturing_partners
   SET labour_rate_10k = COALESCE(labour_rate_10k, labour_rate_14k)
 WHERE labour_rate_14k IS NOT NULL AND labour_rate_10k IS NULL;

UPDATE manufacturing_partners
   SET labour_rate_9k = COALESCE(labour_rate_9k, labour_rate_14k)
 WHERE labour_rate_14k IS NOT NULL AND labour_rate_9k IS NULL;
