import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET /api/configurator/rules
// Fetch all rules, sorted by priority (higher priority first)
export async function GET() {
  try {
    const { data: rules, error } = await supabaseAdmin
      .from('cfg_rules')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ rules: rules || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/configurator/rules
// Create a new configuration rule
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (!session || (role !== 'master' && role !== 'sub')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      name,
      description,
      rule_type,
      category,
      conditions,
      action,
      action_message,
      priority,
      is_active
    } = body

    if (!name || !rule_type || !action) {
      return NextResponse.json({ error: 'Name, Rule Type, and Action are required' }, { status: 400 })
    }

    const { data: rule, error } = await supabaseAdmin
      .from('cfg_rules')
      .insert([{
        name,
        description,
        rule_type,
        category: category || null,
        conditions: conditions || {},
        action,
        action_message,
        priority: priority !== undefined ? Number(priority) : 100,
        is_active: is_active !== false,
        created_by: session.user?.email || 'admin'
      }])
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ rule })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
