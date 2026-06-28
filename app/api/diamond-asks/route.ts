import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const user: any = session?.user
    if (!session || (user.role !== 'master' && (user.role !== 'sub' || !user.permissions.includes('diamond_procurement')))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: asks, error } = await supabaseAdmin
      .from('cfg_diamond_asks')
      .select(`
        id, diamond_type, original_price_per_pc, original_price_per_ct,
        asked_price, asked_unit, quantity, reason, status, approved_price, approved_unit,
        admin_notes, expiry_at, purchase_window_expiry_at, created_at, exceeds_limit,
        partner:partners ( id, store_name, phone, diamond_tier, custom_diamond_discount_limit ),
        shape:diamond_shapes ( id, name ),
        size:diamond_sizes ( id, label, approx_carats ),
        quality:diamond_quality_buckets ( id, label ),
        color:diamond_color_buckets ( id, label )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Auto-expire asks that have passed their expiration windows
    const now = new Date()
    const processedAsks = (asks || []).map(ask => {
      let currentStatus = ask.status
      if (currentStatus === 'pending' && new Date(ask.expiry_at) < now) {
        currentStatus = 'expired'
      } else if (currentStatus === 'approved' && ask.purchase_window_expiry_at && new Date(ask.purchase_window_expiry_at) < now) {
        currentStatus = 'expired'
      }
      return { ...ask, status: currentStatus }
    })

    return NextResponse.json({ asks: processedAsks })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
