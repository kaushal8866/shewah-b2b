import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth'
import { supabaseAdmin } from './supabaseAdmin'
import { Reseller } from './supabase'

export async function getResellerSession(): Promise<{ reseller: Reseller | null; error: string | null }> {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user || user.role !== 'reseller') {
    return { reseller: null, error: 'Unauthorized: Not a reseller' }
  }

  const resellerId = user.resellerId
  if (!resellerId) {
    return { reseller: null, error: 'Unauthorized: Reseller profile ID is missing in session' }
  }

  // Fetch reseller profile
  const { data: reseller, error } = await supabaseAdmin
    .from('resellers')
    .select('*')
    .eq('id', resellerId)
    .maybeSingle()

  if (error) {
    return { reseller: null, error: error.message }
  }

  if (!reseller) {
    return { reseller: null, error: 'Reseller profile not found' }
  }

  if (reseller.status !== 'active') {
    return { reseller: null, error: `Unauthorized: Reseller status is ${reseller.status}` }
  }

  return { reseller: reseller as Reseller, error: null }
}
