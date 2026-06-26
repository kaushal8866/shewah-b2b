import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET /api/configurator/suggestions/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const { data: suggestion, error } = await supabaseAdmin
      .from('cfg_substitution_suggestions')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    if (!suggestion) return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })

    return NextResponse.json({ suggestion })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT /api/configurator/suggestions/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (!session || (role !== 'master' && role !== 'sub')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await req.json()
    const { trigger_type, trigger_value, suggest_type, suggest_value, message, savings_text, sort_order, is_active } = body

    if (!trigger_type || !trigger_value || !suggest_type || !suggest_value || !message) {
      return NextResponse.json({ error: 'trigger_type, trigger_value, suggest_type, suggest_value, and message are required' }, { status: 400 })
    }

    const { data: suggestion, error } = await supabaseAdmin
      .from('cfg_substitution_suggestions')
      .update({
        trigger_type,
        trigger_value,
        suggest_type,
        suggest_value,
        message,
        savings_text: savings_text || null,
        sort_order: sort_order !== undefined ? Number(sort_order) : 100,
        is_active: is_active !== false
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ suggestion })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/configurator/suggestions/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (!session || (role !== 'master' && role !== 'sub')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const { error } = await supabaseAdmin
      .from('cfg_substitution_suggestions')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
