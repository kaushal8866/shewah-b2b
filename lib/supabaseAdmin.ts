/**
 * Server-only Supabase admin client using the service role key.
 * NEVER import this file in client components or pages that run in the browser.
 * The service role key bypasses RLS — use only in Route Handlers / Server Actions
 * that have already validated the caller's permissions.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export const supabaseAdmin = (supabaseUrl && supabaseServiceKey) 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null as any

if (!supabaseAdmin && typeof window === 'undefined') {
  console.warn('[supabaseAdmin] Skipping initialization — keys missing or build-time environment.')
}

