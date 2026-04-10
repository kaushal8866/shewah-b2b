import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function requireMaster(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'master') {
    return null
  }
  return session
}

export async function GET(req: Request) {
  const session = await requireMaster(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const supabaseAdmin = getAdminClient()
  const { data, error } = await supabaseAdmin
    .from('app_users')
    .select('id, username, display_name, role, permissions, is_active, created_at')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data })
}

export async function POST(req: Request) {
  const session = await requireMaster(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { username, password, displayName, permissions } = await req.json()
  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }

  const supabaseAdmin = getAdminClient()
  const hash = await bcrypt.hash(password, 12)

  const { data, error } = await supabaseAdmin.from('app_users').insert([{
    username: username.toLowerCase().trim(),
    password_hash: hash,
    display_name: displayName?.trim() || username.trim(),
    role: 'sub',
    permissions: permissions || [],
    is_active: true,
    created_by: session.user.id,
  }]).select('id, username, display_name, role, permissions, is_active, created_at').single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ user: data })
}

export async function PATCH(req: Request) {
  const session = await requireMaster(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id, displayName, permissions, isActive, password } = await req.json()
  if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 })

  const supabaseAdmin = getAdminClient()

  const updates: any = {}
  if (displayName !== undefined) updates.display_name = displayName
  if (permissions !== undefined) updates.permissions = permissions
  if (isActive !== undefined) updates.is_active = isActive
  if (password) {
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }
    updates.password_hash = await bcrypt.hash(password, 12)
  }

  const { error } = await supabaseAdmin.from('app_users').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const session = await requireMaster(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 })
  if (id === session.user.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  const supabaseAdmin = getAdminClient()
  const { error } = await supabaseAdmin.from('app_users').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
