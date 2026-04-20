import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// List of every shape (active + inactive) so the admin page can toggle.
// Read access is open to any signed-in user — pickers everywhere need it.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabaseAdmin
    .from('diamond_shapes')
    .select('*')
    .order('sort_order')
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ shapes: data || [] })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user?.role !== 'master') {
    return NextResponse.json({ error: 'Master access required' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const name = String(body?.name || '').trim()
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  const sort_order = Number(body?.sort_order)
  const { data, error } = await supabaseAdmin
    .from('diamond_shapes')
    .insert([{
      name,
      sort_order: Number.isFinite(sort_order) ? sort_order : 100,
      active: body?.active !== false,
    }])
    .select('*')
    .single()
  if (error) {
    // Unique-violation on lower(name) → return a clean 409.
    if ((error as any).code === '23505') {
      return NextResponse.json({ error: `A shape called "${name}" already exists.` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ shape: data })
}
