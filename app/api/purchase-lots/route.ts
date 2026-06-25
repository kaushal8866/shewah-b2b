import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { previewReplenishmentOffset } from '@/lib/replenishmentEngine'
import { getDiamondSizeBand } from '@/lib/fifoEngine'
import { KARAT_FACTORS } from '@/lib/karat'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = (session.user as any).role
  if (role !== 'master' && role !== 'sub') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const material_type = searchParams.get('material_type')
  const status = searchParams.get('status')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')

  let q = supabaseAdmin
    .from('purchase_lots')
    .select('*', { count: 'exact' })

  if (material_type) q = q.eq('material_type', material_type)
  if (status) q = q.eq('status', status)
  if (from) q = q.gte('purchase_date', from)
  if (to) q = q.lte('purchase_date', to)

  q = q.order('purchase_date', { ascending: false })
       .order('created_at', { ascending: false })
       .range(offset, offset + limit - 1)

  const { data, error, count } = await q
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data: data || [],
    count: count || 0,
    offset,
    limit
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = (session.user as any).role
  if (role !== 'master' && role !== 'sub') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch (err) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    material_type,
    purchase_date,
    total_qty,
    unit_cost,
    gold_karat,
    diamond_shape,
    diamond_color,
    diamond_clarity,
    diamond_size_carat,
    diamond_is_certified,
    diamond_cert_number,
    diamond_cert_lab,
    diamond_piece_count,
    finding_type,
    finding_description,
    supplier_name,
    invoice_reference,
    notes,
    linked_stock_movement_id,
    linked_cash_txn_id
  } = body

  if (!material_type || total_qty == null || unit_cost == null) {
    return NextResponse.json({ error: 'Missing required fields: material_type, total_qty, unit_cost' }, { status: 400 })
  }

  // Derive unit type
  let unit_type: 'gram' | 'carat' | 'piece' = 'piece'
  if (['gold_24k', 'silver_925', 'silver_999'].includes(material_type)) {
    unit_type = 'gram'
  } else if (['diamond_lgd', 'diamond_natural'].includes(material_type)) {
    unit_type = 'carat'
  }

  // Calculate total cost
  const total_cost = parseFloat((Number(total_qty) * Number(unit_cost)).toFixed(2))

  // Derive purity factor for gold
  let gold_purity_factor = null
  let final_qty = Number(total_qty)
  let final_unit_cost = Number(unit_cost)

  if (material_type === 'gold_24k') {
    const karatNum = gold_karat ? (parseInt(gold_karat.replace(/[^\d]/g, '')) || 24) : 24
    gold_purity_factor = KARAT_FACTORS[karatNum] ?? 1.0000
    final_qty = parseFloat((Number(total_qty) * gold_purity_factor).toFixed(4))
    final_unit_cost = parseFloat((total_cost / final_qty).toFixed(4))
  }

  // Derive size band for diamond
  let diamond_size_band = null
  if (['diamond_lgd', 'diamond_natural'].includes(material_type) && diamond_size_carat) {
    diamond_size_band = getDiamondSizeBand(Number(diamond_size_carat))
  }

  const created_by = (session.user as any).id

  // Create lot
  const { data: lot, error: lotError } = await supabaseAdmin
    .from('purchase_lots')
    .insert({
      material_type,
      purchase_date: purchase_date || new Date().toISOString().split('T')[0],
      unit_cost: final_unit_cost,
      unit_type,
      total_qty: final_qty,
      remaining_qty: final_qty,
      total_cost,
      gold_karat,
      gold_purity_factor,
      diamond_shape,
      diamond_color,
      diamond_clarity,
      diamond_size_band,
      diamond_is_certified: !!diamond_is_certified,
      diamond_cert_number: diamond_cert_number || null,
      diamond_cert_lab: diamond_cert_lab || null,
      diamond_piece_count: diamond_piece_count ? parseInt(diamond_piece_count) : null,
      finding_type,
      finding_description,
      supplier_name,
      invoice_reference,
      notes,
      linked_stock_movement_id: linked_stock_movement_id || null,
      linked_cash_txn_id: linked_cash_txn_id || null,
      status: 'active',
      created_by
    })
    .select('*')
    .single()

  if (lotError || !lot) {
    return NextResponse.json({ error: lotError?.message || 'Failed to create lot' }, { status: 500 })
  }

  // Check replenishment offsets for gold and silver
  if (['gold_24k', 'silver_925', 'silver_999'].includes(material_type)) {
    try {
      const preview = await previewReplenishmentOffset({
        materialType: material_type as 'gold_24k' | 'silver_925' | 'silver_999',
        purchaseQtyG: final_qty,
        purchaseRate: final_unit_cost
      })

      if (preview.offsets.length > 0) {
        return NextResponse.json({
          success: true,
          lot,
          preview
        })
      }
    } catch (err: any) {
      console.error('Replenishment preview calculation failed:', err)
    }
  }

  return NextResponse.json({
    success: true,
    lot
  })
}
