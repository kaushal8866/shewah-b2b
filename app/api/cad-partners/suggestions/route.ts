import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

async function requireStaff() {
  const session = await getServerSession(authOptions)
  const user: any = session?.user
  if (!user) return null
  if (user.role === 'retailer' || user.role === 'manufacturer') return null
  return user
}

function normName(s: string | null | undefined) {
  return (s || '').trim().toLowerCase()
}
function normPhone(s: string | null | undefined) {
  return (s || '').replace(/[^\d+]/g, '').trim()
}

type Suggestion = {
  key: string
  name: string
  phone: string | null
  link_count: number
  last_share_at: string
}

async function buildSuggestions(): Promise<Suggestion[]> {
  // Existing directory entries — used to filter out anything we already have.
  const { data: existing } = await supabaseAdmin
    .from('cad_partners')
    .select('name, phone')

  const existingKeys = new Set<string>()
  const existingNames = new Set<string>()
  for (const p of existing || []) {
    existingNames.add(normName((p as any).name))
    existingKeys.add(`${normName((p as any).name)}|${normPhone((p as any).phone)}`)
  }

  // Pull *all* historical share links that were created ad-hoc (no directory
  // binding) and have a usable partner_name. We paginate through the full
  // result set so the "top recurring" ranking is computed across the entire
  // history, not just a recent slice.
  const PAGE = 1000
  const links: Array<{ partner_name: string | null; partner_phone: string | null; created_at: string }> = []
  for (let from = 0; ; from += PAGE) {
    const { data: page, error } = await supabaseAdmin
      .from('cad_partner_share_links')
      .select('partner_name, partner_phone, created_at')
      .is('cad_partner_id', null)
      .not('partner_name', 'is', null)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!page || page.length === 0) break
    for (const row of page) links.push(row as any)
    if (page.length < PAGE) break
  }

  const groups = new Map<string, Suggestion>()
  for (const l of links) {
    const name = ((l as any).partner_name || '').trim()
    if (!name) continue
    const phone = ((l as any).partner_phone || '').trim() || null
    const nKey = normName(name)
    const pKey = normPhone(phone)
    const key = `${nKey}|${pKey}`
    // Skip if a directory entry already exists with the same (name, phone) or
    // even just the same name (since name is uniquely indexed in cad_partners).
    if (existingKeys.has(key)) continue
    if (existingNames.has(nKey)) continue

    const cur = groups.get(key)
    if (cur) {
      cur.link_count += 1
      if ((l as any).created_at > cur.last_share_at) {
        cur.last_share_at = (l as any).created_at
      }
    } else {
      groups.set(key, {
        key,
        name,
        phone,
        link_count: 1,
        last_share_at: (l as any).created_at,
      })
    }
  }

  return Array.from(groups.values())
    .sort((a, b) => {
      if (b.link_count !== a.link_count) return b.link_count - a.link_count
      return b.last_share_at.localeCompare(a.last_share_at)
    })
    .slice(0, 10)
}

export async function GET() {
  const user = await requireStaff()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const suggestions = await buildSuggestions()
    return NextResponse.json({ suggestions })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const user = await requireStaff()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any = {}
  try { body = await req.json() } catch {}

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : ''
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 32) : ''

  // Insert the directory row.
  const { data: created, error: insErr } = await supabaseAdmin
    .from('cad_partners')
    .insert([{ name, phone: phone || null }])
    .select('id, name, phone, notes, default_ttl_days, is_active, created_at')
    .single()

  if (insErr) {
    const msg = /duplicate|unique/i.test(insErr.message)
      ? 'A partner with this name already exists.'
      : insErr.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // Back-fill matching historical share links. We match in JS to handle
  // case/whitespace/phone normalization that plain SQL equality would miss.
  const { data: candidates } = await supabaseAdmin
    .from('cad_partner_share_links')
    .select('token, partner_name, partner_phone')
    .is('cad_partner_id', null)

  const wantName = normName(name)
  const wantPhone = normPhone(phone)
  const tokens: string[] = []
  for (const c of candidates || []) {
    const cn = normName((c as any).partner_name)
    const cp = normPhone((c as any).partner_phone)
    if (cn === wantName && cp === wantPhone) tokens.push((c as any).token)
  }

  let backfilled = 0
  if (tokens.length > 0) {
    const { error: updErr, count } = await supabaseAdmin
      .from('cad_partner_share_links')
      .update({ cad_partner_id: created.id }, { count: 'exact' })
      .in('token', tokens)
    if (!updErr) backfilled = count || tokens.length
  }

  return NextResponse.json({ partner: created, backfilled })
}
