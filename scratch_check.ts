import { supabaseAdmin } from './lib/supabaseAdmin';

async function run() {
  const { data: shapes } = await supabaseAdmin.from('diamond_shapes').select('id').eq('name', 'Round');
  const shapeId = shapes?.[0]?.id;

  const { data: sizes } = await supabaseAdmin.from('diamond_sizes').select('id').eq('label', '9.0mm');
  const sizeId = sizes?.[0]?.id;

  console.log('Shape ID:', shapeId);
  console.log('Size ID:', sizeId);

  if (!shapeId || !sizeId) {
    console.error('Could not find shape or size ID!');
    return;
  }

  const { data: prices, error } = await supabaseAdmin
    .from('cfg_stone_prices')
    .select('id, type, price_per_piece, quality_bucket_id, color_bucket_id, quality:diamond_quality_buckets(label), color:diamond_color_buckets(label)')
    .eq('shape_id', shapeId)
    .eq('size_id', sizeId);

  if (error) {
    console.error('Error fetching prices:', error);
    return;
  }

  console.log('Prices found for Round + 9.0mm:');
  console.log(prices);
}

run();
