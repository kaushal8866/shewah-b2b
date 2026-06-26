import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET /api/configurator/suggestions
export async function GET() {
  try {
    const { data: suggestions, error } = await supabaseAdmin
      .from('cfg_substitution_suggestions')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) throw error

    return NextResponse.json({ suggestions: suggestions || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/configurator/suggestions
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (!session || (role !== 'master' && role !== 'sub')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { trigger_type, trigger_value, suggest_type, suggest_value, message, savings_text, sort_order, is_active } = body

    if (!trigger_type || !trigger_value || !suggest_type || !suggest_value || !message) {
      return NextResponse.json({ error: 'trigger_type, trigger_value, suggest_type, suggest_value, and message are required' }, { status: 400 })
    }

    const { data: suggestion, error } = await supabaseAdmin
      .from('cfg_substitution_suggestions')
      .insert([{
        trigger_type,
        trigger_value,
        suggest_type,
        suggest_value,
        message,
        savings_text: savings_text || null,
        sort_order: sort_order !== undefined ? Number(sort_order) : 100,
        is_active: is_active !== false
      }])
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ suggestion })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
