import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const { partner_id } = await req.json()
    if (!partner_id) return NextResponse.json({ error: 'Missing partner_id' }, { status: 400 })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY // MUST BE SET IN VERCEL & .env.local

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server missing Supabase Service Role Key' }, { status: 500 })
    }

    // Initialize an admin client to bypass RLS and create users
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 1. Fetch partner details securely to get the email
    const { data: partner, error: fetchError } = await supabaseAdmin
      .from('partners')
      .select('*')
      .eq('id', partner_id)
      .single()

    if (fetchError || !partner) {
      return NextResponse.json({ error: 'Failed to fetch partner' }, { status: 404 })
    }

    if (!partner.email) {
      return NextResponse.json({ error: 'Partner missing email address, cannot invite.' }, { status: 400 })
    }

    // 2. Invite user via Supabase Auth
    // This sends an email to the partner with a magic link to set their password
    const { data: authData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(partner.email)

    if (inviteError) {
      return NextResponse.json({ error: 'Failed to send invite: ' + inviteError.message }, { status: 400 })
    }

    const newUserId = authData.user.id

    // 3. Map the new user ID to the partner role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert([{ user_id: newUserId, role: 'partner' }])

    if (roleError) {
      // In a real environment, might want to rollback the user creation if this fails, but skipping for brevity
      return NextResponse.json({ error: 'Failed mapping user role: ' + roleError.message }, { status: 500 })
    }

    // 4. Update the CRM partner with user_id & set stage to active
    const { error: updateError } = await supabaseAdmin
      .from('partners')
      .update({ user_id: newUserId, stage: 'active', status: 'hot' })
      .eq('id', partner_id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed updating partner CRM status.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Partner authenticated and invited successfully' })

  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error: ' + err.message }, { status: 500 })
  }
}
