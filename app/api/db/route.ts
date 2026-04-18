import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { notifyRetailerOrderUpdate } from '@/lib/whatsappNotify'

const ALLOWED_TABLES = new Set([
  'partners',
  'visits',
  'orders',
  'order_pipeline',
  'cad_requests',
  'products',
  'gold_rates',
  'vendors',
  'inventory',
  'circuits',
  'manufacturing_partners',
  'manufacturing_orders',
  'design_collections',
  'design_collection_products',
  'design_interests',
  'showcase_views',
  'labour_rates',
  'settings',
  'material_float',
  'material_transactions',
])

const MASTER_ONLY_TABLES = new Set(['app_users', 'material_float', 'material_transactions'])

// Roles allowed to use the generic admin DB proxy at all.
// Manufacturer / retailer portal users go through dedicated /api/portal/* endpoints.
const ADMIN_ROLES = new Set(['master', 'sub'])

function applyFilter(q: any, f: any) {
  if (!f || typeof f.col !== 'string') return q
  switch (f.type) {
    case 'eq': return q.eq(f.col, f.val)
    case 'neq': return q.neq(f.col, f.val)
    case 'gt': return q.gt(f.col, f.val)
    case 'gte': return q.gte(f.col, f.val)
    case 'lt': return q.lt(f.col, f.val)
    case 'lte': return q.lte(f.col, f.val)
    case 'in': return q.in(f.col, f.val)
    case 'is': return q.is(f.col, f.val)
    case 'like': return q.like(f.col, f.val)
    case 'ilike': return q.ilike(f.col, f.val)
    case 'contains': return q.contains(f.col, f.val)
    case 'containedBy': return q.containedBy(f.col, f.val)
    case 'match': return q.match(f.val)
    case 'or': return q.or(f.val)
    case 'not': return q.not(f.col, f.opr || 'is', f.val)
    default: return q
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { data: null, error: { message: 'Unauthorized' } },
      { status: 401 }
    )
  }

  const role = (session.user as any).role
  if (!ADMIN_ROLES.has(role)) {
    return NextResponse.json(
      { data: null, error: { message: 'Forbidden' } },
      { status: 403 }
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  const {
    table,
    op,
    values,
    opts,
    filters = [],
    select,
    order,
    limit,
    range,
    single = false,
    maybeSingle = false,
    returning = false,
    head = false,
    count,
  } = body || {}

  if (typeof table !== 'string') {
    return NextResponse.json(
      { data: null, error: { message: 'Missing table' } },
      { status: 400 }
    )
  }
  if (!ALLOWED_TABLES.has(table) && !MASTER_ONLY_TABLES.has(table)) {
    return NextResponse.json(
      { data: null, error: { message: `Table "${table}" is not allowed` } },
      { status: 400 }
    )
  }
  if (MASTER_ONLY_TABLES.has(table) && role !== 'master') {
    return NextResponse.json(
      { data: null, error: { message: 'Forbidden' } },
      { status: 403 }
    )
  }
  if (!['select', 'insert', 'update', 'delete', 'upsert'].includes(op)) {
    return NextResponse.json(
      { data: null, error: { message: `Invalid op "${op}"` } },
      { status: 400 }
    )
  }

  // For order status / tracking notifications, capture the previous rows
  // before the update so we can diff after the write succeeds.
  let priorOrderRows: any[] | null = null
  if (op === 'update' && table === 'orders') {
    let priorQ: any = supabaseAdmin
      .from('orders')
      .select('id, order_number, status, partner_id, tracking_number, courier')
    if (Array.isArray(filters)) {
      for (const f of filters) priorQ = applyFilter(priorQ, f)
    }
    const { data: priorData } = await priorQ
    priorOrderRows = Array.isArray(priorData) ? priorData : []
  }

  let q: any = supabaseAdmin.from(table)

  if (op === 'select') {
    q = q.select(select || '*', { count, head })
  } else if (op === 'insert') {
    q = q.insert(values)
    if (returning || select) q = q.select(typeof select === 'string' ? select : '*')
  } else if (op === 'update') {
    q = q.update(values)
    if (returning || select) q = q.select(typeof select === 'string' ? select : '*')
  } else if (op === 'delete') {
    q = q.delete()
    if (returning || select) q = q.select(typeof select === 'string' ? select : '*')
  } else if (op === 'upsert') {
    q = q.upsert(values, opts || undefined)
    if (returning || select) q = q.select(typeof select === 'string' ? select : '*')
  }

  if (Array.isArray(filters)) {
    for (const f of filters) q = applyFilter(q, f)
  }

  if (Array.isArray(order)) {
    for (const o of order) {
      if (o && typeof o.col === 'string') {
        q = q.order(o.col, {
          ascending: o.ascending !== false,
          nullsFirst: o.nullsFirst,
        })
      }
    }
  }

  if (typeof limit === 'number') q = q.limit(limit)
  if (range && typeof range.from === 'number' && typeof range.to === 'number') {
    q = q.range(range.from, range.to)
  }

  if (single) q = q.single()
  else if (maybeSingle) q = q.maybeSingle()

  const { data, error, count: returnedCount } = await q

  if (error) {
    return NextResponse.json(
      { data: null, error: { message: error.message, code: (error as any).code, details: (error as any).details } }
    )
  }

  // Fire WhatsApp notifications for retailer-facing milestones. Failures are
  // logged inside notifyRetailerOrderUpdate and never block the admin save.
  if (op === 'update' && table === 'orders' && Array.isArray(priorOrderRows) && priorOrderRows.length > 0) {
    const afterValues = (values && typeof values === 'object') ? values : {}
    for (const prior of priorOrderRows) {
      // fire-and-forget — do not await
      notifyRetailerOrderUpdate({
        orderId: prior.id,
        before: prior,
        afterValues,
      }).catch((err) => {
        console.error('[whatsappNotify] dispatch error', err?.message || err)
      })
    }
  }

  return NextResponse.json({ data, error: null, count: returnedCount ?? null })
}
