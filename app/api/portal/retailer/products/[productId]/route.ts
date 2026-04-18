import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const DETAIL_COLS = `
  id, code, name, category, description, trade_price, gold_karat,
  diamond_weight, delivery_days, photo_urls
`

export async function GET(_: Request, ctx: { params: { productId: string } }) {
  const session = await getServerSession(authOptions)
  const user: any = session?.user
  if (!user || user.role !== 'retailer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('products')
    .select(DETAIL_COLS)
    .eq('id', ctx.params.productId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  return NextResponse.json({ product: data })
}
