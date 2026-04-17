/**
 * Server-side Supabase client for App Router Server Components,
 * Server Actions, and Route Handlers.
 *
 * Uses @supabase/ssr to correctly handle session cookies in Next.js 14.
 * Import this — never `@/lib/supabase` — in any server context.
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createSupabaseServerClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // set() can only be called from a Server Action or Route Handler.
            // This is safe to ignore in read-only server components.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // Same as above.
          }
        },
      },
    }
  )
}

/**
 * Returns the session or null. Call in Server Components / Actions.
 */
export async function getServerSession() {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

/**
 * Returns the authenticated user's role from user_roles table.
 * Returns null if unauthenticated or no role row exists.
 */
export async function getServerUserRole(): Promise<'owner' | 'rep' | 'partner' | null> {
  const session = await getServerSession()
  if (!session) return null

  const supabase = createSupabaseServerClient()
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', session.user.id)
    .single()

  return (data?.role as 'owner' | 'rep' | 'partner') ?? null
}

/**
 * Throws if the caller does not have one of the required roles.
 * Use at the top of Server Actions that mutate state.
 *
 * Usage:
 *   await requireRole(['owner', 'rep'])
 */
export async function requireRole(allowedRoles: Array<'owner' | 'rep' | 'partner'>) {
  const role = await getServerUserRole()
  if (!role || !allowedRoles.includes(role)) {
    throw new Error(
      `Access denied. Required role(s): ${allowedRoles.join(', ')}. Got: ${role ?? 'unauthenticated'}`
    )
  }
  return role
}
