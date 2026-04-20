import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  const user = session?.user as { role?: string } | undefined
  if (!user || (user.role !== 'master' && user.role !== 'admin' && user.role !== 'sub')) return null
  return user
}

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: item, error } = await supabaseAdmin
    .from('ready_to_ship_items')
    .select('*, product:products(id, code, name, photo_urls), source_mfg_order:manufacturing_orders!source_mfg_order_id(id, order_number, manufacturing_partner_id, manufacturing_partners(name))')
    .eq('id', ctx.params.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: offers } = await supabaseAdmin
    .from('ready_to_ship_offers')
    .select('*, partner:partners(id, store_name, owner_name, phone)')
    .eq('item_id', ctx.params.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ item, offers: offers || [] })
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch {}
  const upd: Record<string, unknown> = {}
  for (const k of ['list_price', 'photos', 'diamond_specs', 'internal_notes', 'status'] as const) {
    if (k in body) upd[k] = body[k]
  }
  const { data, error } = await supabaseAdmin
    .from('ready_to_ship_items')
    .update(upd)
    .eq('id', ctx.params.id)
    .select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}
