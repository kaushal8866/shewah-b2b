'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

/**
 * FULLY AUTOMATED BOOTSTRAP ACTION
 * This will attempt to promote the first logged-in user to Owner
 * using the service_role key.
 */
export async function automateBootstrap() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) return { error: 'Not authenticated' }
  if (!supabaseAdmin) return { error: 'Admin client not initialized' }

  try {
    // 1. Check if ANY owner exists
    const { count } = await supabaseAdmin
      .from('user_roles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'owner')

    if (count === 0) {
      // 2. Promote current user to owner
      const { error } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: session.user.id,
          role: 'owner'
        })
      
      if (error) throw error
      return { success: true, message: 'System uninitialized. You have been promoted to Owner.' }
    }

    return { success: true, message: 'System already has an owner.' }
  } catch (err: any) {
    console.error('[Bootstrap] Failed:', err.message)
    return { error: err.message }
  }
}
