/**
 * Server-only Supabase admin client using the service role key.
 * NEVER import this file in client components or pages that run in the browser.
 * The service role key bypasses RLS — use only in Route Handlers / Server Actions
 * that have already validated the caller's permissions.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  throw new Error('[supabaseAdmin] NEXT_PUBLIC_SUPABASE_URL is not set')
}
if (!supabaseServiceKey) {
  throw new Error(
    '[supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY is not set. ' +
    'Add it to .env.local (never prefix with NEXT_PUBLIC_).'
  )
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
