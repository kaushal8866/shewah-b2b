import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  try {
    const { collection_id, partner_id } = await req.json()
    if (!collection_id || !partner_id) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 })
    }
    const ua = req.headers.get('user-agent') || null
    const { error } = await supabaseAdmin.from('showcase_views').insert({
      collection_id,
      partner_id,
      user_agent: ua ? ua.slice(0, 200) : null,
    })
    if (error) return NextResponse.json({ ok: false, error: error.message })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
