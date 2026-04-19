import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'master') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('upload_errors')
    .select('id, created_at, user_id, username, user_role, file_name, file_size, file_type, status_code, error_message, source')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    // If the migration hasn't been applied, return an empty list with a hint
    // rather than a hard 500 — the settings tab can prompt the master to run it.
    const missing = /relation .*upload_errors.* does not exist/i.test(error.message)
    if (missing) {
      return NextResponse.json({
        errors: [],
        migrationRequired: true,
        message: 'upload_errors table not found. Run scripts/migrate_task59_upload_errors.sql in Supabase.',
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ errors: data || [] })
}
