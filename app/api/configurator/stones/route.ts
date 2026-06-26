import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET /api/configurator/stones
// Retrieves all stone types, clarity grades, and color grades
export async function GET() {
  try {
    const [typesRes, clarityRes, colorRes] = await Promise.all([
      supabaseAdmin.from('cfg_stone_types').select('*').order('sort_order', { ascending: true }),
      supabaseAdmin.from('cfg_stone_clarity_grades').select('*').order('sort_order', { ascending: true }),
      supabaseAdmin.from('cfg_stone_color_grades').select('*').order('sort_order', { ascending: true })
    ])

    if (typesRes.error) throw typesRes.error
    if (clarityRes.error) throw clarityRes.error
    if (colorRes.error) throw colorRes.error

    return NextResponse.json({
      stoneTypes: typesRes.data || [],
      clarityGrades: clarityRes.data || [],
      colorGrades: colorRes.data || []
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/configurator/stones
// Create a new stone type
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (!session || (role !== 'master' && role !== 'sub')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, category, default_cert_body, sort_order, is_active } = body

    if (!name || !category) {
      return NextResponse.json({ error: 'Name and Category are required' }, { status: 400 })
    }

    const { data: stoneType, error: insertError } = await supabaseAdmin
      .from('cfg_stone_types')
      .insert([{
        name,
        category,
        default_cert_body,
        sort_order: sort_order !== undefined ? sort_order : 100,
        is_active: is_active !== false
      }])
      .select('*')
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ error: `Stone type "${name}" already exists.` }, { status: 409 })
      }
      throw insertError
    }

    return NextResponse.json({ stoneType })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
