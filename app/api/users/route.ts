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

async function requireMaster() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'master') {
    return null
  }
  return session
}

const SELECT_COLS_FULL = 'id, username, display_name, role, permissions, is_active, created_at, manufacturing_partner_id, partner_id'
const SELECT_COLS_BASE = 'id, username, display_name, role, permissions, is_active, created_at'

export async function GET() {
  const session = await requireMaster()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const supabaseAdmin = getAdminClient()
  const full = await supabaseAdmin
    .from('app_users')
    .select(SELECT_COLS_FULL)
    .order('created_at')

  let data: any = full.data
  let error: any = full.error

  // Fallback for environments where the Task #6 migration has not yet been applied.
  if (error && (error.message?.includes('manufacturing_partner_id') || error.message?.includes('partner_id'))) {
    const fallback = await supabaseAdmin
      .from('app_users')
      .select(SELECT_COLS_BASE)
      .order('created_at')
    data = fallback.data
    error = fallback.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data })
}

export async function POST(req: Request) {
  const session = await requireMaster()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const {
    username, password, displayName, permissions,
    role: requestedRole, manufacturingPartnerId, partnerId,
  } = await req.json()

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }

  const role: 'sub' | 'manufacturer' = requestedRole === 'manufacturer' ? 'manufacturer' : 'sub'
  if (role === 'manufacturer' && !manufacturingPartnerId) {
    return NextResponse.json(
      { error: 'manufacturingPartnerId required for manufacturer logins' },
      { status: 400 }
    )
  }

  const supabaseAdmin = getAdminClient()
  const hash = await bcrypt.hash(password, 12)

  const insert: any = {
    username: username.toLowerCase().trim(),
    password_hash: hash,
    display_name: displayName?.trim() || username.trim(),
    role,
    permissions: role === 'manufacturer' ? [] : (permissions || []),
    is_active: true,
    created_by: session.user.id,
  }
  if (role === 'manufacturer') insert.manufacturing_partner_id = manufacturingPartnerId
  if (partnerId) insert.partner_id = partnerId

  const { data, error } = await supabaseAdmin
    .from('app_users')
    .insert([insert])
    .select(SELECT_COLS_FULL)
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ user: data })
}

export async function PATCH(req: Request) {
  const session = await requireMaster()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id, displayName, permissions, isActive, password, manufacturingPartnerId } = await req.json()
  if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 })

  const supabaseAdmin = getAdminClient()

  const updates: any = {}
  if (displayName !== undefined) updates.display_name = displayName
  if (permissions !== undefined) updates.permissions = permissions
  if (isActive !== undefined) updates.is_active = isActive
  if (manufacturingPartnerId !== undefined) updates.manufacturing_partner_id = manufacturingPartnerId
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
  const session = await requireMaster()
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
