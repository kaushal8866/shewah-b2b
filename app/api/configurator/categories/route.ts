import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET /api/configurator/categories
// Fetch category options, optionally filtered by category
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')

    let query = supabaseAdmin
      .from('cfg_category_options')
      .select('*')
      .order('sort_order', { ascending: true })

    if (category) {
      query = query.eq('category', category)
    }

    const { data: options, error } = await query

    if (error) throw error

    return NextResponse.json({ options: options || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/configurator/categories
// Create a new category option
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (!session || (role !== 'master' && role !== 'sub')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      category,
      option_key,
      option_label,
      option_type,
      options,
      default_value,
      min_value,
      max_value,
      unit,
      is_required,
      sort_order
    } = body

    if (!category || !option_key || !option_label || !option_type) {
      return NextResponse.json({
        error: 'category, option_key, option_label, and option_type are required'
      }, { status: 400 })
    }

    const { data: option, error } = await supabaseAdmin
      .from('cfg_category_options')
      .insert([{
        category,
        option_key,
        option_label,
        option_type,
        options: options || null,
        default_value,
        min_value: min_value !== undefined && min_value !== null ? Number(min_value) : null,
        max_value: max_value !== undefined && max_value !== null ? Number(max_value) : null,
        unit,
        is_required: is_required === true,
        sort_order: sort_order !== undefined ? Number(sort_order) : 100
      }])
      .select('*')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: `Option key "${option_key}" already exists for category "${category}".` }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ option })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
