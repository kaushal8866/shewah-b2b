import { NextResponse } from 'next/server'
import { getResellerSession } from '@/lib/resellerAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { safeDbError } from '@/lib/sanitizeDbError'
import { notifyResellerEvent } from '@/lib/resellerNotify'

export async function GET() {
  const { reseller, error } = await getResellerSession()
  if (error || !reseller) {
    return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
  }

  // Fetch samples with product details
  const { data: samples, error: dbErr } = await supabaseAdmin
    .from('reseller_sample_ledger')
    .select('*, products(code, name, photo_urls)')
    .eq('reseller_id', reseller.id)
    .order('created_at', { ascending: false })

  if (dbErr) {
    return NextResponse.json({ error: safeDbError(dbErr, 'reseller.samples.list', 'Could not load samples ledger.') }, { status: 500 })
  }

  return NextResponse.json({ samples })
}

export async function POST(req: Request) {
  const { reseller, error } = await getResellerSession()
  if (error || !reseller) {
    return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { product_id, notes } = body
  if (!product_id) {
    return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
  }

  // 1. Fetch product trade price for the sample value
  const { data: product, error: prodErr } = await supabaseAdmin
    .from('products')
    .select('name, code, trade_price')
    .eq('id', product_id)
    .maybeSingle()

  if (prodErr || !product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const sampleValuePaise = product.trade_price || 0

  // 2. Fetch sample return settings duration
  const { data: sampleReturnDaysSetting } = await supabaseAdmin
    .from('settings')
    .select('value')
    .eq('key', 'reseller_sample_return_days')
    .maybeSingle()
  const returnDays = Number(sampleReturnDaysSetting?.value) || 30
  const returnDueDate = new Date()
  returnDueDate.setDate(returnDueDate.getDate() + returnDays)

  // 3. Insert sample request
  const { data: newSample, error: sampleErr } = await supabaseAdmin
    .from('reseller_sample_ledger')
    .insert({
      reseller_id: reseller.id,
      product_id,
      sample_type: 'credit', // default, admin can change to deposit
      sample_value_paise: sampleValuePaise,
      deposit_amount_paise: 0,
      deposit_status: null,
      issue_date: null,
      return_due_date: returnDueDate.toISOString(),
      status: 'requested',
      notes: notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select('*')
    .single()

  if (sampleErr) {
    return NextResponse.json({ error: safeDbError(sampleErr, 'reseller.samples.create', 'Could not request sample.') }, { status: 500 })
  }

  // 4. Notify admin of new request
  await notifyResellerEvent('sample_requested', {
    resellerName: reseller.store_name,
    productName: product.name || product.code || 'Jewelry SKU',
    sampleType: 'credit'
  }).catch(() => {})

  return NextResponse.json({ sample: newSample })
}
