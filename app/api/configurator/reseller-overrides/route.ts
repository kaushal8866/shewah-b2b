import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET /api/configurator/reseller-overrides
// Fetch overrides, optionally filtered by reseller_id
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const resellerId = searchParams.get('reseller_id')

    let query = supabaseAdmin
      .from('cfg_reseller_overrides')
      .select(`
        *,
        reseller:resellers(id, store_name, reseller_code)
      `)
      .order('created_at', { ascending: false })

    if (resellerId) {
      query = query.eq('reseller_id', resellerId)
    }

    const { data: overrides, error } = await query

    if (error) throw error

    return NextResponse.json({ overrides: overrides || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/configurator/reseller-overrides
// Create a new reseller curation override
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    // Allow authenticated masters/subs, or reseller itself
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { reseller_id, override_type, target_key, target_value, is_active } = body

    if (!reseller_id || !override_type || !target_key) {
      return NextResponse.json({
        error: 'reseller_id, override_type, and target_key are required'
      }, { status: 400 })
    }

    // Verify permission: if user is reseller, they can only modify their own override
    if (role === 'reseller' && session.user?.id !== reseller_id) {
      // Need to find reseller record to verify link
      const { data: resRecord } = await supabaseAdmin
        .from('resellers')
        .select('id')
        .eq('user_id', session.user?.id)
        .maybeSingle()

      if (!resRecord || resRecord.id !== reseller_id) {
        return NextResponse.json({ error: 'Access forbidden: Can only configure own overrides' }, { status: 403 })
      }
    }

    const { data: override, error } = await supabaseAdmin
      .from('cfg_reseller_overrides')
      .insert([{
        reseller_id,
        override_type,
        target_key,
        target_value: target_value || null,
        is_active: is_active !== false
      }])
      .select('*')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({
          error: `Override of type "${override_type}" for "${target_key}" already exists for this reseller.`
        }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ override })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
