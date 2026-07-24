import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { computePnL } from '@/lib/pnlEngine'
import { istToday, istMonthStart } from '@/lib/period'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = (session.user as any).role
  if (role !== 'master') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  // Must be IST, not server-local. This ran as UTC on Vercel, so for the first
  // 5½ hours of every IST day "today" was still yesterday — and an operator
  // asking for today's P&L got "Date range cannot contain future dates".
  const todayStr = istToday()
  const defaultFrom = istMonthStart(todayStr)
  const defaultTo = todayStr

  const from = searchParams.get('from') || defaultFrom
  const to = searchParams.get('to') || defaultTo

  if (from > todayStr || to > todayStr) {
    return NextResponse.json({ error: 'Date range cannot contain future dates' }, { status: 400 })
  }

  if (from > to) {
    return NextResponse.json({ error: 'From date cannot be after To date' }, { status: 400 })
  }

  try {
    const report = await computePnL({ from, to })
    return NextResponse.json(report)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
