import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

// 14 Verified Combined Products + SH-622
const VERIFIED_UPDATES: Record<string, {
  expectedRows: number
  tagRows: { index: number; basis: 'group' }[]
  alignedDiamondWeight: number
}> = {
  'SH-592': { expectedRows: 2, tagRows: [{ index: 1, basis: 'group' }], alignedDiamondWeight: 2.7 },
  'SH-593': { expectedRows: 1, tagRows: [{ index: 0, basis: 'group' }], alignedDiamondWeight: 1.5 },
  'SH-595': { expectedRows: 2, tagRows: [{ index: 1, basis: 'group' }], alignedDiamondWeight: 1.12 },
  'SH-599': { expectedRows: 2, tagRows: [{ index: 1, basis: 'group' }], alignedDiamondWeight: 1.4 },
  'SH-600': { expectedRows: 2, tagRows: [{ index: 1, basis: 'group' }], alignedDiamondWeight: 1.25 },
  'SH-603': { expectedRows: 2, tagRows: [{ index: 1, basis: 'group' }], alignedDiamondWeight: 0.85 },
  'SH-608': { expectedRows: 2, tagRows: [{ index: 1, basis: 'group' }], alignedDiamondWeight: 0.7 },
  'SH-611': { expectedRows: 3, tagRows: [{ index: 1, basis: 'group' }, { index: 2, basis: 'group' }], alignedDiamondWeight: 1.65 },
  'SH-612': { expectedRows: 2, tagRows: [{ index: 1, basis: 'group' }], alignedDiamondWeight: 2.48 },
  'SH-614': { expectedRows: 1, tagRows: [{ index: 0, basis: 'group' }], alignedDiamondWeight: 0.55 },
  'SH-620': { expectedRows: 1, tagRows: [{ index: 0, basis: 'group' }], alignedDiamondWeight: 1.25 },
  'SH-622': { expectedRows: 1, tagRows: [{ index: 0, basis: 'group' }], alignedDiamondWeight: 7.0 },
  'SH-623': { expectedRows: 2, tagRows: [{ index: 1, basis: 'group' }], alignedDiamondWeight: 2.5 },
  'SH-624': { expectedRows: 1, tagRows: [{ index: 0, basis: 'group' }], alignedDiamondWeight: 2.0 },
}

async function runMigration() {
  console.log('--- Starting Diamond Weight Basis Migration ---')

  // 1. Tag Verified Combined products (excluding SH-604 which is handled in two steps)
  for (const [code, plan] of Object.entries(VERIFIED_UPDATES)) {
    const { data: prod, error } = await supabase.from('products').select('*').eq('code', code).single()
    if (error || !prod) {
      throw new Error(`Product ${code} not found: ${error?.message}`)
    }

    const specs = [...(prod.diamond_specs || [])]
    if (specs.length !== plan.expectedRows) {
      throw new Error(`Product ${code} expected ${plan.expectedRows} rows, got ${specs.length}`)
    }

    for (const tag of plan.tagRows) {
      specs[tag.index] = {
        ...specs[tag.index],
        weight_basis: tag.basis,
      }
    }

    const { error: updateErr } = await supabase
      .from('products')
      .update({
        diamond_specs: specs,
        diamond_weight: plan.alignedDiamondWeight,
      })
      .eq('code', code)

    if (updateErr) {
      throw new Error(`Failed to update ${code}: ${updateErr.message}`)
    }
    console.log(`[VERIFIED] ${code} tagged basis='group' and aligned diamond_weight=${plan.alignedDiamondWeight}`)
  }

  // 2. SH-604: Step 4a (tag basis='group' with 1.20 unchanged)
  console.log('--- Step 4a: SH-604 Tag basis=group with stored 1.20 unchanged ---')
  const { data: sh604a, error: err604a } = await supabase.from('products').select('*').eq('code', 'SH-604').single()
  if (err604a || !sh604a) throw new Error(`SH-604 not found: ${err604a?.message}`)

  const sh604SpecsA = [...sh604a.diamond_specs]
  sh604SpecsA[1] = {
    ...sh604SpecsA[1],
    weight_basis: 'group',
  }

  const { error: update604aErr } = await supabase
    .from('products')
    .update({
      diamond_specs: sh604SpecsA,
      diamond_weight: 4.2, // 3 + 1.2
    })
    .eq('code', 'SH-604')

  if (update604aErr) throw new Error(`SH-604 step 4a failed: ${update604aErr.message}`)
  console.log('[STEP 4a SUCCESS] SH-604 tagged basis=group at wt=1.20')

  // 3. SH-604: Step 4b (correct 1.20 -> 1.27, recompute at Rs 15,000/ct: cost/pc 288.64, +Rs 1,050 to prices)
  console.log('--- Step 4b: SH-604 Value correction 1.20 -> 1.27, +Rs 1,050 pricing ---')
  const { data: sh604b, error: err604b } = await supabase.from('products').select('*').eq('code', 'SH-604').single()
  if (err604b || !sh604b) throw new Error(`SH-604 not found: ${err604b?.message}`)

  const sh604SpecsB = [...sh604b.diamond_specs]
  // Side row correction
  sh604SpecsB[1] = {
    ...sh604SpecsB[1],
    weight: 1.27,
    pieces: 66,
    cost: 288.64,
    weight_basis: 'group',
  }

  const newDiaCost = 64050 // 45000 + 19050
  const deltaPrice = 1050

  const oldTrade = Math.round(Number(sh604b.trade_price))
  const newTrade = oldTrade + deltaPrice // 125270 + 1050 = 126320
  const newMrp = newTrade

  // Update karat_pricing by +1050
  const newKaratPricing: Record<string, any> = {}
  if (sh604b.karat_pricing) {
    for (const [k, row] of Object.entries(sh604b.karat_pricing as Record<string, any>)) {
      newKaratPricing[k] = {
        ...row,
        trade: Math.round(Number(row.trade)) + deltaPrice,
        cogs: Math.round(Number(row.cogs)) + deltaPrice,
        mrp: Math.round(Number(row.mrp)) + deltaPrice,
      }
    }
  }

  const newDetailedPricing = sh604b.detailed_pricing ? {
    ...sh604b.detailed_pricing,
    karat_pricing: newKaratPricing,
  } : null

  const { error: update604bErr } = await supabase
    .from('products')
    .update({
      diamond_specs: sh604SpecsB,
      diamond_weight: 4.27, // 3 + 1.27
      diamond_cost: newDiaCost,
      trade_price: newTrade,
      mrp_suggested: newMrp,
      karat_pricing: newKaratPricing,
      detailed_pricing: newDetailedPricing,
    })
    .eq('code', 'SH-604')

  if (update604bErr) throw new Error(`SH-604 step 4b failed: ${update604bErr.message}`)
  console.log(`[STEP 4b SUCCESS] SH-604 corrected wt=1.27, cost/pc=288.64, diamond_cost=64050, trade=${newTrade}, diamond_weight=4.27`)

  console.log('--- Migration Completed Successfully ---')
}

runMigration().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
