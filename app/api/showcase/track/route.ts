import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { collection_id, partner_id } = await req.json()
    if (!collection_id || !partner_id) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 })
    }
    const ua = req.headers.get('user-agent') || null
    await supabase.from('showcase_views').insert({
      collection_id,
      partner_id,
      user_agent: ua ? ua.slice(0, 200) : null,
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
