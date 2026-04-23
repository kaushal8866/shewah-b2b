/**
 * POST /api/customers
 *
 * Create a customer with de-duplication: if a row already exists with the
 * same normalised whatsapp number (or, failing that, the same email) we
 * return the existing row tagged `existing: true` so the operator sees a
 * "merged into existing" toast instead of a hard duplicate. All other
 * customer reads/writes go through /api/db.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { normalisePhone } from '@/lib/customers'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'master' && role !== 'sub')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const full_name = String(body.full_name || '').trim()
  const whatsapp  = normalisePhone(body.whatsapp)
  if (!full_name) return NextResponse.json({ error: 'full_name required' }, { status: 400 })
  if (!whatsapp || whatsapp.length < 10) return NextResponse.json({ error: 'whatsapp required' }, { status: 400 })

  // De-dupe by whatsapp first, then email.
  const { data: byPhone } = await supabaseAdmin
    .from('customers')
    .select('*')
    .eq('whatsapp', whatsapp)
    .is('archived_at', null)
    .limit(1)
    .maybeSingle()
  if (byPhone) return NextResponse.json({ customer: byPhone, existing: true })

  // Trim then coerce empty → null so blank inputs don't poison the unique index.
  const emailRaw = body.email ? String(body.email).trim().toLowerCase() : ''
  const email = emailRaw || null
  if (email) {
    const { data: byEmail } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('email', email)
      .is('archived_at', null)
      .limit(1)
      .maybeSingle()
    if (byEmail) return NextResponse.json({ customer: byEmail, existing: true })
  }

  const phone = body.phone ? normalisePhone(body.phone) : null
  const insert: any = {
    full_name,
    whatsapp,
    phone,
    email,
    city:              body.city ? String(body.city).trim() : null,
    pincode:           body.pincode ? String(body.pincode).trim() : null,
    gst_number:        body.gst_number ? String(body.gst_number).trim().toUpperCase() : null,
    birthday:          body.birthday || null,
    anniversary:       body.anniversary || null,
    preferred_contact: body.preferred_contact || 'whatsapp',
    source:            body.source || null,
    referral_source:   body.referral_source ? String(body.referral_source).trim() : null,
    internal_notes:    body.internal_notes ? String(body.internal_notes).trim() : null,
    created_by:        (session.user as any).id || null,
  }

  const { data, error } = await supabaseAdmin
    .from('customers')
    .insert(insert)
    .select('*')
    .single()
  if (error) {
    // Race: another request created the same customer between our SELECT and
    // INSERT. The partial-unique index on whatsapp / lower(email) caught it
    // (Postgres code 23505). Re-resolve and return the winner so the operator
    // still gets a customer to attach the enquiry to.
    if ((error as any).code === '23505') {
      const { data: winnerByPhone } = await supabaseAdmin
        .from('customers').select('*').eq('whatsapp', whatsapp).is('archived_at', null).maybeSingle()
      if (winnerByPhone) return NextResponse.json({ customer: winnerByPhone, existing: true })
      if (email) {
        const { data: winnerByEmail } = await supabaseAdmin
          .from('customers').select('*').eq('email', email).is('archived_at', null).maybeSingle()
        if (winnerByEmail) return NextResponse.json({ customer: winnerByEmail, existing: true })
      }
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ customer: data, existing: false })
}
