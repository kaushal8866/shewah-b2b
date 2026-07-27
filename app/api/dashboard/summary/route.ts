import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { fetchAllRows } from '@/lib/fetchAll'

export const dynamic = 'force-dynamic'

/**
 * Dashboard KPIs, aggregated server-side.
 *
 * The dashboard previously ran `from('order_pipeline').select('*')` with no
 * limit and computed totalOrders / totalRevenue / pendingRevenue from the
 * result in the browser. Two problems: it shipped every column of every order
 * to the client, and PostgREST silently capped the response at 1000 rows — so
 * past 1000 orders every headline number was wrong, with no error.
 *
 * Counts use exact head-counts. Money is summed over a paginated read; move it
 * into a SQL view if order volume ever makes that slow.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const role = (session.user as any).role
  if (role !== 'master' && role !== 'sub') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const [partners, activePartners, hotLeads, activeCad, goldRate, recent] =
      await Promise.all([
        supabaseAdmin.from('partners').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('partners').select('*', { count: 'exact', head: true }).eq('stage', 'active'),
        supabaseAdmin.from('partners').select('*', { count: 'exact', head: true }).eq('status', 'hot'),
        supabaseAdmin.from('cad_requests').select('*', { count: 'exact', head: true }).in('status', ['pending', 'in_progress']),
        supabaseAdmin.from('gold_rates').select('rate_24k').order('recorded_at', { ascending: false }).limit(1),
        // Only the rows actually rendered — was slice(0, 8) of the full table.
        supabaseAdmin
          .from('order_pipeline')
          .select('id, order_number, status, total_amount, order_date, partner_name, product_name')
          .order('order_date', { ascending: false })
          .limit(8),
      ])

    // Money totals need every matching row, so page through the narrow
    // projection rather than pulling `*`.
    const orderTotals = await fetchAllRows<any>('dashboard.orderTotals', (from, to) =>
      supabaseAdmin
        .from('order_pipeline')
        .select('status, total_amount, advance_paid')
        .range(from, to))

    const isOpen = (o: any) => o.status !== 'delivered'
    const totalRevenue = orderTotals
      .filter(o => o.status === 'delivered')
      .reduce((s, o) => s + (Number(o.total_amount) || 0), 0)
    const pendingRevenue = orderTotals
      .filter(isOpen)
      .reduce((s, o) => s + ((Number(o.total_amount) || 0) - (Number(o.advance_paid) || 0)), 0)

    return NextResponse.json({
      stats: {
        totalPartners:     partners.count ?? 0,
        activePartners:    activePartners.count ?? 0,
        hotLeads:          hotLeads.count ?? 0,
        totalOrders:       orderTotals.length,
        pendingOrders:     orderTotals.filter(isOpen).length,
        totalRevenue,
        pendingRevenue,
        activeCadRequests: activeCad.count ?? 0,
        goldRate24k:       goldRate.data?.[0]?.rate_24k ?? 0,
      },
      recentOrders: (recent.data ?? []).map((o: any) => ({
        id: o.id,
        order_number: o.order_number,
        status: o.status,
        total_amount: o.total_amount,
        order_date: o.order_date,
        partner_name: o.partner_name || '—',
        product_name: o.product_name || 'Custom',
      })),
    })
  } catch (e: any) {
    console.error('[dashboard/summary]', e?.message || e)
    return NextResponse.json({ error: 'Could not load dashboard' }, { status: 500 })
  }
}
