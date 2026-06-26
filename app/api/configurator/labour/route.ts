import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET /api/configurator/labour
// Fetch all labour rates with joined metal and finish names
export async function GET() {
  try {
    const { data: rates, error } = await supabaseAdmin
      .from('cfg_labour_rates')
      .select(`
        *,
        metal:cfg_metals(id, name, metal_type),
        finish:cfg_finishes(id, name)
      `)
      .order('updated_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ rates: rates || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/configurator/labour
// Create or bulk upsert labour rates
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (!session || (role !== 'master' && role !== 'sub')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const isArray = Array.isArray(body)
    const items = isArray ? body : [body]

    if (items.length === 0) {
      return NextResponse.json({ error: 'Empty payload' }, { status: 400 })
    }

    // Validate
    for (const item of items) {
      if (!item.metal_id || item.rate_per_gram === undefined) {
        return NextResponse.json({ error: 'metal_id and rate_per_gram are required for all items' }, { status: 400 })
      }
    }

    const rows = items.map((item: any) => ({
      id: item.id || undefined,
      metal_id: item.metal_id,
      karat: item.karat ? Number(item.karat) : null,
      finish_id: item.finish_id || null,
      category: item.category || null,
      rate_per_gram: Number(item.rate_per_gram),
      updated_by: session.user?.email || 'admin',
      updated_at: new Date().toISOString()
    }))

    const { data: upserted, error } = await supabaseAdmin
      .from('cfg_labour_rates')
      .upsert(rows)
      .select('*')

    if (error) throw error

    return NextResponse.json({
      success: true,
      count: upserted?.length || 0,
      rates: isArray ? upserted : upserted?.[0]
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
