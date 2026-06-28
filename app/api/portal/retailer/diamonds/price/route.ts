import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user: any = session?.user
    if (!user || user.role !== 'retailer' || !user.partnerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') // 'lgd' | 'natural'
    const shapeId = searchParams.get('shapeId')
    const sizeId = searchParams.get('sizeId')
    const qualityId = searchParams.get('qualityId')
    const colorId = searchParams.get('colorId')

    if (!type || !shapeId || !sizeId || !qualityId || !colorId) {
      return NextResponse.json({ error: 'All selection parameters are required' }, { status: 400 })
    }

    // 1. Fetch the size details to get approx_carats
    const { data: sizeData, error: sizeErr } = await supabaseAdmin
      .from('diamond_sizes')
      .select('approx_carats, label')
      .eq('id', sizeId)
      .maybeSingle()

    if (sizeErr || !sizeData) {
      return NextResponse.json({ error: 'Invalid size selected' }, { status: 400 })
    }

    // 2. Fetch the price per piece cell
    const { data: priceCell, error: priceErr } = await supabaseAdmin
      .from('cfg_stone_prices')
      .select('price_per_piece')
      .eq('type', type)
      .eq('shape_id', shapeId)
      .eq('size_id', sizeId)
      .eq('quality_bucket_id', qualityId)
      .eq('color_bucket_id', colorId)
      .maybeSingle()

    if (priceErr) {
      return NextResponse.json({ error: priceErr.message }, { status: 500 })
    }

    if (!priceCell) {
      return NextResponse.json({ price_per_piece: null, price_per_carat: null })
    }

    const pricePerPc = Number(priceCell.price_per_piece)
    const approxCarats = Number(sizeData.approx_carats) || 0
    const pricePerCt = approxCarats > 0 ? Math.round(pricePerPc / approxCarats) : 0

    return NextResponse.json({
      price_per_piece: pricePerPc,
      price_per_carat: pricePerCt,
      approx_carats: approxCarats,
      size_label: sizeData.label
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
