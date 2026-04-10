import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ready: false, error: 'SUPABASE_SERVICE_ROLE_KEY not set' })
  }
  try {
    const supabaseAdmin = getAdminClient()
    const { count, error } = await supabaseAdmin
      .from('app_users')
      .select('*', { count: 'exact', head: true })

    if (error) {
      return NextResponse.json({ ready: false, error: error.message })
    }
    return NextResponse.json({ ready: true, hasUsers: (count || 0) > 0 })
  } catch (e: any) {
    return NextResponse.json({ ready: false, error: e.message })
  }
}

export async function POST(req: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured. Add it in your environment secrets.' },
      { status: 500 }
    )
  }

  const { username, password, displayName } = await req.json()
  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }

  const supabaseAdmin = getAdminClient()

  const { count } = await supabaseAdmin
    .from('app_users')
    .select('*', { count: 'exact', head: true })

  if (count && count > 0) {
    return NextResponse.json({ error: 'Setup already completed. Use login instead.' }, { status: 403 })
  }

  const hash = await bcrypt.hash(password, 12)
  const { error } = await supabaseAdmin.from('app_users').insert([{
    username: username.toLowerCase().trim(),
    password_hash: hash,
    display_name: displayName?.trim() || username.trim(),
    role: 'master',
    permissions: [
      'dashboard', 'partners', 'orders', 'cad_requests',
      'manufacturing', 'catalog', 'gold_rates', 'vendors',
      'circuits', 'analytics', 'settings',
    ],
    is_active: true,
  }])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
