-- Add cad_requests.cad_party_id
-- ---------------------------------------------------------------------------
-- The CAD request form has a "CAD service party" dropdown that writes this
-- column, but production rejects the insert with:
--
--     Could not find the 'cad_party_id' column of 'cad_requests'
--     in the schema cache
--
-- The column is defined in supabase/migrations/001_business_logic_v2.sql,
-- which was never applied. Re-issued here as a standalone script because the
-- rest of that file contains unrelated changes that may or may not be wanted,
-- and this app's convention is one paste-able script per change in scripts/.
--
-- The form works with or without this migration — it omits the key when no
-- vendor is chosen — but the vendor cannot be recorded until it runs.
--
-- Idempotent, safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cad_requests' AND column_name = 'cad_party_id'
  ) THEN
    ALTER TABLE cad_requests
      ADD COLUMN cad_party_id uuid REFERENCES vendors(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added cad_requests.cad_party_id';
  ELSE
    RAISE NOTICE 'cad_requests.cad_party_id already present — nothing to do';
  END IF;
END $$;

-- Only external CAD vendors populate this, so the index stays small.
CREATE INDEX IF NOT EXISTS cad_requests_cad_party_idx
  ON cad_requests (cad_party_id) WHERE cad_party_id IS NOT NULL;

-- Verification:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'cad_requests' AND column_name = 'cad_party_id';
