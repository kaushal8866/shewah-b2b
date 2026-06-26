import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET /api/configurator/reseller-overrides/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const { data: override, error } = await supabaseAdmin
      .from('cfg_reseller_overrides')
      .select(`
        *,
        reseller:resellers(id, store_name, reseller_code)
      `)
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    if (!override) return NextResponse.json({ error: 'Override not found' }, { status: 404 })

    return NextResponse.json({ override })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT /api/configurator/reseller-overrides/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await req.json()
    const { reseller_id, override_type, target_key, target_value, is_active } = body

    // Verify permission: if user is reseller, they can only modify their own override
    if (role === 'reseller' && session.user?.id !== reseller_id) {
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
      .update({
        override_type,
        target_key,
        target_value: target_value || null,
        is_active: is_active !== false
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ override })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/configurator/reseller-overrides/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Recheck reseller ownership if not admin
    const role = (session?.user as any)?.role
    if (role === 'reseller') {
      const { data: overrideRecord } = await supabaseAdmin
        .from('cfg_reseller_overrides')
        .select('reseller_id')
        .eq('id', id)
        .maybeSingle()

      if (overrideRecord) {
        const { data: resRecord } = await supabaseAdmin
          .from('resellers')
          .select('id')
          .eq('user_id', session.user?.id)
          .maybeSingle()

        if (!resRecord || resRecord.id !== overrideRecord.reseller_id) {
          return NextResponse.json({ error: 'Access forbidden' }, { status: 403 })
        }
      }
    }

    const { error } = await supabaseAdmin
      .from('cfg_reseller_overrides')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
