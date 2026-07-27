import { supabase } from './supabase'

export type DiamondType = 'lgd' | 'natural'

/**
 * Resolves a diamond price cell using shape name, mm size, and grade key.
 */
export async function getDiamondPrice(
  type: DiamondType,
  sizeMm: number,
  gradeKey: string,
  shape: string = 'round'
): Promise<number | null> {
  // 1. Resolve shape_id
  const { data: shapeData } = await supabase
    .from('diamond_shapes')
    .select('id')
    .ilike('name', shape)
    .maybeSingle()
  if (!shapeData) return null

  // 2. Resolve size_id
  const { data: sizeData } = await supabase
    .from('diamond_sizes')
    .select('id')
    .eq('shape_id', shapeData.id)
    .eq('label', `${sizeMm}mm`)
    .maybeSingle()
  if (!sizeData) return null

  // 3. Query price per piece
  let query = supabase
    .from('cfg_stone_prices')
    .select('price_per_piece')
    .eq('type', type)
    .eq('shape_id', shapeData.id)
    .eq('size_id', sizeData.id)

  if (gradeKey.includes(':')) {
    const [qualityId, colorId] = gradeKey.split(':')
    query = query.eq('quality_bucket_id', qualityId).eq('color_bucket_id', colorId)
  } else if (gradeKey.includes('-')) {
    const [qLab, cLab] = gradeKey.split('-')
    const { data: qb } = await supabase.from('diamond_quality_buckets').select('id').ilike('label', qLab).maybeSingle()
    const { data: cb } = await supabase.from('diamond_color_buckets').select('id').ilike('label', cb).maybeSingle()
    if (qb && cb) {
      query = query.eq('quality_bucket_id', qb.id).eq('color_bucket_id', cb.id)
    } else {
      return null
    }
  } else {
    return null
  }

  const { data } = await query.maybeSingle()
  return data ? Number(data.price_per_piece) : null
}

/**
 * Fetches all price cells for a given diamond type and shape.
 */
export async function getFullMatrix(
  type: DiamondType,
  shape: string = 'round'
): Promise<any[]> {
  const { data: shapeData } = await supabase
    .from('diamond_shapes')
    .select('id')
    .ilike('name', shape)
    .maybeSingle()
  if (!shapeData) return []

  const { data } = await supabase
    .from('cfg_stone_prices')
    .select('*')
    .eq('type', type)
    .eq('shape_id', shapeData.id)

  return data || []
}

/**
 * Upserts a single cell price in the merged matrix.
 */
export async function upsertPriceCell(
  type: DiamondType,
  shapeId: string,
  sizeId: string,
  qualityBucketId: string,
  colorBucketId: string,
  price: number,
  updatedBy: string
): Promise<void> {
  const { error } = await supabase
    .from('cfg_stone_prices')
    .upsert({
      type,
      shape_id: shapeId,
      size_id: sizeId,
      quality_bucket_id: qualityBucketId,
      color_bucket_id: colorBucketId,
      price_per_piece: price,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy
    }, { onConflict: 'shape_id,size_id,quality_bucket_id,color_bucket_id,type' })

  if (error) throw error
}
