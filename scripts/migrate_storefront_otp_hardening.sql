-- Storefront OTP hardening
-- ---------------------------------------------------------------------------
-- Before this change /api/r/[token]/auth issued a constant OTP ('123456') and
-- returned it in the response body, so anyone could authenticate as any phone
-- number on any reseller storefront. The route now generates a random code,
-- stores only a bcrypt hash of it, and never echoes it back.
--
-- This migration adds the columns that hardening needs:
--   • attempts     — verification attempts against a single issued code, so a
--                    6-digit secret cannot be brute-forced (1e6 space).
--   • last_sent_at — used to rate-limit re-sends per phone.
--
-- Safe to re-run.

ALTER TABLE reseller_storefront_otps
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE reseller_storefront_otps
  ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Lookup is always (reseller_id, phone); the old code also filtered on
-- otp_code, which is no longer possible now that only the hash is stored.
CREATE INDEX IF NOT EXISTS idx_storefront_otps_reseller_phone
  ON reseller_storefront_otps (reseller_id, phone);

-- Any codes issued under the old scheme are plaintext '123456' and must not
-- remain usable.
DELETE FROM reseller_storefront_otps WHERE otp_code = '123456';
