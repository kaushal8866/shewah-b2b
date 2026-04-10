-- Run this in your Supabase project: Dashboard → SQL Editor → New query
-- This creates the app_users table for the Shewah admin panel authentication

CREATE TABLE IF NOT EXISTS app_users (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  username      text        UNIQUE NOT NULL,
  password_hash text        NOT NULL,
  display_name  text,
  role          text        DEFAULT 'sub' CHECK (role IN ('master', 'sub')),
  permissions   text[]      DEFAULT '{}',
  is_active     boolean     DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  created_by    uuid        REFERENCES app_users(id) ON DELETE SET NULL
);

-- Enable RLS so only the service role key (server-side) can access this table.
-- The public anon key will have NO access — all auth happens server-side only.
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- Deny all access via the anon key (security: passwords must never be exposed client-side)
CREATE POLICY "deny_anon" ON app_users FOR ALL USING (false);
