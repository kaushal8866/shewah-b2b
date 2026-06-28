import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { notifyDiamondEvent } from '@/lib/diamondNotify'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const user: any = session?.user
    if (!session || (user.role !== 'master' && (user.role !== 'sub' || !user.permissions.includes('diamond_procurement')))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await req.json()
    const { action, approvedPrice, approvedUnit, adminNotes } = body

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Valid action (approve/reject) is required' }, { status: 400 })
    }

    // 1. Fetch the Ask details
    const { data: ask, error: askErr } = await supabaseAdmin
      .from('cfg_diamond_asks')
      .select(`
        *,
        partner:partners(store_name, phone),
        size:diamond_sizes(label),
        shape:diamond_shapes(name),
        quality:diamond_quality_buckets(label),
        color:diamond_color_buckets(label)
      `)
      .eq('id', id)
      .maybeSingle()

    if (askErr || !ask) {
      return NextResponse.json({ error: 'Negotiation ask not found' }, { status: 404 })
    }

    const now = new Date()
    if (ask.status !== 'pending') {
      return NextResponse.json({ error: `This ask has already been processed (status: ${ask.status})` }, { status: 400 })
    }
    if (new Date(ask.expiry_at) < now) {
      return NextResponse.json({ error: 'This ask has expired and cannot be processed' }, { status: 400 })
    }

    const specsStr = `${ask.size?.label || ''} ${ask.quality?.label || ''}-${ask.color?.label || ''} ${ask.shape?.name || ''} (${ask.diamond_type === 'lgd' ? 'LGD' : 'Natural'})`

    if (action === 'approve') {
      const appPrice = parseFloat(approvedPrice)
      if (isNaN(appPrice) || appPrice <= 0) {
        return NextResponse.json({ error: 'Approved price must be greater than zero' }, { status: 400 })
      }
      if (!approvedUnit || !['per_pc', 'per_ct'].includes(approvedUnit)) {
        return NextResponse.json({ error: 'Approved unit (per_pc/per_ct) is required' }, { status: 400 })
      }

      const purchaseWindowExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours window

      const { error: upErr } = await supabaseAdmin
        .from('cfg_diamond_asks')
        .update({
          status: 'approved',
          approved_price: appPrice,
          approved_unit: approvedUnit,
          admin_notes: adminNotes || null,
          purchase_window_expiry_at: purchaseWindowExpiry
        })
        .eq('id', id)

      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 })
      }

      // Notify retailer on WhatsApp
      await notifyDiamondEvent('ask_approved', {
        toPhone: ask.partner?.phone,
        specs: specsStr,
        approvedPrice: appPrice,
        approvedUnit: approvedUnit,
        expiryAt: purchaseWindowExpiry,
        url: `${process.env.NEXTAUTH_URL || ''}/portal/retailer/diamonds/asks`
      })

    } else {
      // reject
      const { error: upErr } = await supabaseAdmin
        .from('cfg_diamond_asks')
        .update({
          status: 'rejected',
          admin_notes: adminNotes || null
        })
        .eq('id', id)

      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 })
      }

      // Notify retailer on WhatsApp
      await notifyDiamondEvent('ask_rejected', {
        toPhone: ask.partner?.phone,
        specs: specsStr,
        adminNotes: adminNotes
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
