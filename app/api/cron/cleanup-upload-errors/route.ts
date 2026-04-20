import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const RETENTION_DAYS = 90

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization') || ''
  const expected = process.env.CRON_SECRET
  if (expected && auth === `Bearer ${expected}`) return true

  const session = await getServerSession(authOptions)
  return session?.user?.role === 'master'
}

async function runCleanup() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('upload_errors')
    .delete()
    .lt('created_at', cutoff)
    .select('id')

  if (error) {
    const missing = /relation .*upload_errors.* does not exist/i.test(error.message)
    if (missing) {
      return NextResponse.json({
        deleted: 0,
        cutoff,
        retention_days: RETENTION_DAYS,
        migrationRequired: true,
        message: 'upload_errors table not found. Run scripts/migrate_task59_upload_errors.sql in Supabase.',
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    deleted: (data || []).length,
    cutoff,
    retention_days: RETENTION_DAYS,
  })
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runCleanup()
}

export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runCleanup()
}
