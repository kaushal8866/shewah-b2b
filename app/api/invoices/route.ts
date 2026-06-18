import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// GET: list invoices
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user?.role !== 'master' && session.user?.role !== 'sub') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const partnerId = searchParams.get('partner_id')
  const status = searchParams.get('status')

  try {
    let q = supabaseAdmin
      .from('gst_invoices')
      .select(`
        *,
        orders:order_id (order_number),
        partners:partner_id (store_name, owner_name)
      `)
      .order('invoice_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (partnerId) q = q.eq('partner_id', partnerId)
    if (status) q = q.eq('status', status)

    const { data, error } = await q
    if (error) throw error

    return NextResponse.json({ invoices: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to load invoices' }, { status: 500 })
  }
}

// POST: generate invoice
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user?.role !== 'master') {
    return NextResponse.json({ error: 'Master access required' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const {
    invoice_type,
    target_id,
    tax_treatment,
    items,
    buyer_details,
    invoice_date,
  } = body || {}

  if (!invoice_type || !tax_treatment || !items || !buyer_details) {
    return NextResponse.json(
      { error: 'invoice_type, tax_treatment, items, buyer_details are required' },
      { status: 400 }
    )
  }

  const isStandalone = !target_id || target_id === 'standalone' || target_id === '00000000-0000-0000-0000-000000000000'

  try {
    // 1. Check duplicate active invoices (only if not standalone)
    if (!isStandalone) {
      const targetCol = invoice_type === 'order' ? 'order_id' : 'diamond_trade_id'
      const { data: duplicate } = await supabaseAdmin
        .from('gst_invoices')
        .select('id, invoice_number')
        .eq(targetCol, target_id)
        .eq('status', 'active')
        .maybeSingle()

      if (duplicate) {
        return NextResponse.json(
          { error: `An active invoice (#${duplicate.invoice_number}) already exists for this transaction.` },
          { status: 400 }
        )
      }
    }

    // 2. Load settings
    const { data: settings } = await supabaseAdmin.from('settings').select('*')
    const settingMap = new Map((settings || []).map(s => [s.key, s.value]))
    const sellerName = settingMap.get('business_name') || 'Shewah'
    const sellerAddress = settingMap.get('business_billing_address') || settingMap.get('surat_address') || 'Surat, Gujarat'
    const sellerGstin = settingMap.get('business_gstin') || ''
    const sellerState = settingMap.get('business_state') || 'Gujarat'

    // 3. Tax calculations
    const standardRate = invoice_type === 'diamond_trade' ? 0.25 : 3.0 // Diamond: 0.25%, Jewelry: 3%
    const isSameState = sellerState.toLowerCase().trim() === String(buyer_details.buyer_state).toLowerCase().trim()

    let cgstRate = 0, sgstRate = 0, igstRate = 0
    if (isSameState) {
      cgstRate = standardRate / 2
      sgstRate = standardRate / 2
    } else {
      igstRate = standardRate
    }

    const initialSubtotal = items.reduce((sum: number, it: any) => sum + (Number(it.amount) || 0), 0)

    let subtotalAmount = initialSubtotal
    let totalTax = 0
    let grandTotal = initialSubtotal
    let processedItems = [...items]

    if (tax_treatment === 'inclusive') {
      grandTotal = initialSubtotal
      subtotalAmount = initialSubtotal / (1 + standardRate / 100)
      totalTax = grandTotal - subtotalAmount

      // Adjust individual item rate & amount to base values for table display
      processedItems = items.map((it: any) => {
        const itemAmountInclusive = Number(it.amount) || 0
        const itemQty = Number(it.qty) || 1
        const itemAmountBase = itemAmountInclusive / (1 + standardRate / 100)
        const itemRateBase = itemAmountBase / itemQty
        return {
          ...it,
          rate: Math.round(itemRateBase * 10000) / 10000,
          amount: Math.round(itemAmountBase * 100) / 100,
        }
      })
      // Re-sum subtotal from rounded items to prevent floating precision drift
      subtotalAmount = processedItems.reduce((sum: number, it: any) => sum + it.amount, 0)
      totalTax = grandTotal - subtotalAmount
    } else {
      subtotalAmount = initialSubtotal
      totalTax = subtotalAmount * (standardRate / 100)
      grandTotal = subtotalAmount + totalTax
    }

    // Round values to 2 decimals
    subtotalAmount = Math.round(subtotalAmount * 100) / 100
    totalTax = Math.round(totalTax * 100) / 100
    grandTotal = Math.round(grandTotal * 100) / 100

    let cgstAmount = 0, sgstAmount = 0, igstAmount = 0
    if (isSameState) {
      cgstAmount = Math.round((totalTax / 2) * 100) / 100
      sgstAmount = totalTax - cgstAmount // prevent rounding mismatch
    } else {
      igstAmount = totalTax
    }

    // 4. Generate invoice number sequence
    const { data: seq, error: seqErr } = await supabaseAdmin.rpc('next_invoice_number')
    if (seqErr) throw seqErr

    const fyYear = new Date().getFullYear()
    const seqFormatted = String(seq).padStart(4, '0')
    const invoiceNumber = `SH-INV-${fyYear}-${seqFormatted}`

    // 5. Build insert payload
    const payload: any = {
      invoice_number: invoiceNumber,
      invoice_date: invoice_date || new Date().toISOString().split('T')[0],
      invoice_type,
      buyer_name: buyer_details.buyer_name,
      buyer_address: buyer_details.buyer_address || null,
      buyer_gstin: buyer_details.buyer_gstin || null,
      buyer_state: buyer_details.buyer_state,
      seller_name: sellerName,
      seller_address: sellerAddress,
      seller_gstin: sellerGstin,
      seller_state: sellerState,
      subtotal_amount: subtotalAmount,
      cgst_rate: cgstRate,
      cgst_amount: cgstAmount,
      sgst_rate: sgstRate,
      sgst_amount: sgstAmount,
      igst_rate: igstRate,
      igst_amount: igstAmount,
      total_tax: totalTax,
      grand_total: grandTotal,
      items: processedItems,
      partner_id: buyer_details.partner_id || null,
      customer_id: buyer_details.customer_id || null,
      status: 'active',
    }

    if (!isStandalone) {
      if (invoice_type === 'order') {
        payload.order_id = target_id
      } else {
        payload.diamond_trade_id = target_id
      }
    }

    const { data: created, error: insErr } = await supabaseAdmin
      .from('gst_invoices')
      .insert([payload])
      .select('*')
      .single()

    if (insErr) throw insErr

    return NextResponse.json({ invoice: created })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to generate invoice' }, { status: 400 })
  }
}
