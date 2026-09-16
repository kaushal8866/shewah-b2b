const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(l => {
  const idx = l.indexOf('=');
  if (idx > 0) {
    const k = l.slice(0, idx).trim();
    let v = l.slice(idx + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    env[k] = v;
  }
});
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const EXISTING_PIECES_UPDATE = [
  {
    code: 'SH-001',
    slug: 'the-tulip-cut-diamond-necklace',
    d2c_title: 'The Tulip Cut Diamond Necklace',
    d2c_subtitle: '2.25 Carat Solitaire Accent in Solid 18K Gold',
    d2c_description: 'Inspired by botanical geometry, featuring 2.25 carats of certified brilliant diamonds set within hand-sculpted solid 18K gold petals.',
    category: 'necklaces',
    d2c_status: 'published',
    d2c_featured: true,
    d2c_crafting_lead_days: 14,
    return_policy_type: 'made_to_order',
    return_window_days: 14,
    return_eligible: true,
    prices: {
      US: { currency: 'USD', price: 2450, compare_at: 2750 },
      GB: { currency: 'GBP', price: 1950, compare_at: 2190 },
      AU: { currency: 'AUD', price: 3790, compare_at: 4250 },
      DE: { currency: 'EUR', price: 2290, compare_at: 2550 },
      FR: { currency: 'EUR', price: 2290, compare_at: 2550 },
    }
  },
  {
    code: 'SH-002',
    slug: 'the-astra-diamond-statement-necklace',
    d2c_title: 'The Astra Diamond Statement Necklace',
    d2c_subtitle: '18.8g Solid 18K Gold Masterwork with Diamond Accents',
    d2c_description: 'A commanding collar necklace handcrafted by master goldsmiths with mirror-polished solid gold links and flush-set brilliant cut diamonds.',
    category: 'necklaces',
    d2c_status: 'published',
    d2c_featured: true,
    d2c_crafting_lead_days: 16,
    return_policy_type: 'made_to_order',
    return_window_days: 14,
    return_eligible: true,
    prices: {
      US: { currency: 'USD', price: 4850, compare_at: 5400 },
      GB: { currency: 'GBP', price: 3850, compare_at: 4290 },
      AU: { currency: 'AUD', price: 7490, compare_at: 8350 },
      DE: { currency: 'EUR', price: 4550, compare_at: 5100 },
      FR: { currency: 'EUR', price: 4550, compare_at: 5100 },
    }
  },
  {
    code: 'SH-003',
    slug: 'the-tanmaniya-heritage-diamond-suite',
    d2c_title: 'The Tanmaniya Heritage Diamond Suite',
    d2c_subtitle: 'Complete Heritage Suite with Pendant, Chain, and Matched Earrings',
    d2c_description: 'A modern tribute to regal Indian heritage, combining auspicious symmetry with precision-cut certified diamonds in solid 18K gold.',
    category: 'necklaces',
    d2c_status: 'published',
    d2c_featured: true,
    d2c_crafting_lead_days: 14,
    return_policy_type: 'made_to_order',
    return_window_days: 14,
    return_eligible: true,
    prices: {
      US: { currency: 'USD', price: 2950, compare_at: 3300 },
      GB: { currency: 'GBP', price: 2350, compare_at: 2600 },
      AU: { currency: 'AUD', price: 4590, compare_at: 5100 },
      DE: { currency: 'EUR', price: 2790, compare_at: 3100 },
      FR: { currency: 'EUR', price: 2790, compare_at: 3100 },
    }
  },
  {
    code: 'SH-004',
    slug: 'the-royal-diamond-tennis-necklace',
    d2c_title: 'The Royal Diamond Tennis Necklace',
    d2c_subtitle: '29.0g Solid 18K Gold Continuous Diamond Rivière',
    d2c_description: 'The pinnacle of high jewellery elegance. A seamless, graduated stream of brilliant diamonds crafted in solid 18-karat gold with concealed safety clasp.',
    category: 'necklaces',
    d2c_status: 'published',
    d2c_featured: true,
    d2c_crafting_lead_days: 18,
    return_policy_type: 'made_to_order',
    return_window_days: 14,
    return_eligible: true,
    prices: {
      US: { currency: 'USD', price: 7800, compare_at: 8700 },
      GB: { currency: 'GBP', price: 6200, compare_at: 6900 },
      AU: { currency: 'AUD', price: 11900, compare_at: 13200 },
      DE: { currency: 'EUR', price: 7300, compare_at: 8100 },
      FR: { currency: 'EUR', price: 7300, compare_at: 8100 },
    }
  },
  {
    code: 'SH-003-EARRINGS',
    slug: 'the-tanmaniya-heritage-diamond-earrings',
    d2c_title: 'The Tanmaniya Heritage Diamond Earrings',
    d2c_subtitle: 'Articulated Drop Earrings in Solid 18K Gold',
    d2c_description: 'Refined drops designed with fluid movement to capture natural light from every angle. Handset with certified diamonds.',
    category: 'earrings',
    d2c_status: 'published',
    d2c_featured: false,
    d2c_crafting_lead_days: 10,
    return_policy_type: 'made_to_order',
    return_window_days: 14,
    return_eligible: true,
    photo_urls: [
      'https://res.cloudinary.com/ddnlacdta/image/upload/v1782577185/ose19027_aepd7a.jpg',
      'https://res.cloudinary.com/ddnlacdta/image/upload/v1783676253/Screenshot_2026-07-10_at_1.41.41_PM_e0s3em.png'
    ],
    prices: {
      US: { currency: 'USD', price: 1450, compare_at: 1650 },
      GB: { currency: 'GBP', price: 1150, compare_at: 1300 },
      AU: { currency: 'AUD', price: 2250, compare_at: 2550 },
      DE: { currency: 'EUR', price: 1350, compare_at: 1550 },
      FR: { currency: 'EUR', price: 1350, compare_at: 1550 },
    }
  },
  {
    code: 'SH-003-PENDENT',
    slug: 'the-tanmaniya-heritage-diamond-pendant',
    d2c_title: 'The Tanmaniya Heritage Diamond Pendant',
    d2c_subtitle: 'Central Medallion in Solid 18K Gold with Diamond Clusters',
    d2c_description: 'A talismanic pendant radiating timeless grace, suspended on an 18-inch solid gold trace chain.',
    category: 'necklaces',
    d2c_status: 'published',
    d2c_featured: false,
    d2c_crafting_lead_days: 10,
    return_policy_type: 'made_to_order',
    return_window_days: 14,
    return_eligible: true,
    prices: {
      US: { currency: 'USD', price: 1550, compare_at: 1750 },
      GB: { currency: 'GBP', price: 1220, compare_at: 1380 },
      AU: { currency: 'AUD', price: 2390, compare_at: 2700 },
      DE: { currency: 'EUR', price: 1450, compare_at: 1650 },
      FR: { currency: 'EUR', price: 1450, compare_at: 1650 },
    }
  }
];

const SIGNATURE_NEW_PIECES = [
  {
    code: 'SH-SOL-01',
    name: 'The Antwerp Solitaire Ring',
    slug: 'the-antwerp-solitaire-ring',
    category: 'rings',
    d2c_title: 'The Antwerp Solitaire Diamond Ring',
    d2c_subtitle: 'Round Brilliant Solitaire in Four-Prong Solid 18K Gold',
    d2c_description: 'An iconic classic, handcrafted with a tapered comfort band to elevate a scintillating round brilliant diamond. Hand-set in solid 18K gold or 950 platinum.',
    d2c_status: 'published',
    d2c_featured: true,
    d2c_crafting_lead_days: 12,
    return_policy_type: 'made_to_order',
    return_window_days: 14,
    return_eligible: true,
    diamond_shape: 'round',
    diamond_type: 'lgd',
    diamond_weight: 1.0,
    gold_karat: 18,
    metal_type: 'gold',
    photo_urls: [
      'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&w=1200&q=85'
    ],
    prices: {
      US: { currency: 'USD', price: 2190, compare_at: 2450 },
      GB: { currency: 'GBP', price: 1750, compare_at: 1950 },
      AU: { currency: 'AUD', price: 3390, compare_at: 3790 },
      DE: { currency: 'EUR', price: 2050, compare_at: 2290 },
      FR: { currency: 'EUR', price: 2050, compare_at: 2290 },
    }
  },
  {
    code: 'SH-HALO-01',
    name: 'The Eternal Halo Ring',
    slug: 'the-eternal-halo-ring',
    category: 'rings',
    d2c_title: 'The Eternal Halo Diamond Ring',
    d2c_subtitle: 'Cushion Cut Solitaire with Pavé Diamond Micro-Halo',
    d2c_description: 'A radiant cushion diamond framed by an exquisite micro-pavé halo and shimmering diamond shoulder accents. Solid 18K gold.',
    d2c_status: 'published',
    d2c_featured: true,
    d2c_crafting_lead_days: 12,
    return_policy_type: 'made_to_order',
    return_window_days: 14,
    return_eligible: true,
    diamond_shape: 'cushion',
    diamond_type: 'lgd',
    diamond_weight: 1.5,
    gold_karat: 18,
    metal_type: 'gold',
    photo_urls: [
      'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1200&q=85'
    ],
    prices: {
      US: { currency: 'USD', price: 2890, compare_at: 3200 },
      GB: { currency: 'GBP', price: 2290, compare_at: 2550 },
      AU: { currency: 'AUD', price: 4450, compare_at: 4950 },
      DE: { currency: 'EUR', price: 2690, compare_at: 2990 },
      FR: { currency: 'EUR', price: 2690, compare_at: 2990 },
    }
  },
  {
    code: 'SH-TNS-01',
    name: 'The Royal Pavé Tennis Bracelet',
    slug: 'the-royal-pave-tennis-bracelet',
    category: 'bracelets',
    d2c_title: 'The Royal Pavé Diamond Tennis Bracelet',
    d2c_subtitle: '3.00 Total Carat Weight in Solid 18K Gold Setting',
    d2c_description: 'A continuous ribbon of brilliant cut diamonds articulated with seamless fluidity. Features a dual-lock safety clasp for lifetime durability.',
    d2c_status: 'published',
    d2c_featured: true,
    d2c_crafting_lead_days: 14,
    return_policy_type: 'made_to_order',
    return_window_days: 14,
    return_eligible: true,
    diamond_shape: 'round',
    diamond_type: 'lgd',
    diamond_weight: 3.0,
    gold_karat: 18,
    metal_type: 'gold',
    photo_urls: [
      'https://images.unsplash.com/photo-1611591475870-760a927a4e69?auto=format&fit=crop&w=1200&q=85'
    ],
    prices: {
      US: { currency: 'USD', price: 3490, compare_at: 3900 },
      GB: { currency: 'GBP', price: 2790, compare_at: 3100 },
      AU: { currency: 'AUD', price: 5390, compare_at: 6000 },
      DE: { currency: 'EUR', price: 3250, compare_at: 3600 },
      FR: { currency: 'EUR', price: 3250, compare_at: 3600 },
    }
  },
  {
    code: 'SH-STU-01',
    name: 'The Luminary Diamond Studs',
    slug: 'the-luminary-diamond-studs',
    category: 'earrings',
    d2c_title: 'The Luminary Diamond Stud Earrings',
    d2c_subtitle: '2.00 Total Carat Weight (1.0ct Each) in Four-Prong Solid 18K Gold',
    d2c_description: 'Essential everyday luxury. Perfectly matched round brilliant solitaires secured by solid 18K gold screw-backs.',
    d2c_status: 'published',
    d2c_featured: true,
    d2c_crafting_lead_days: 10,
    return_policy_type: 'made_to_order',
    return_window_days: 14,
    return_eligible: true,
    diamond_shape: 'round',
    diamond_type: 'lgd',
    diamond_weight: 2.0,
    gold_karat: 18,
    metal_type: 'gold',
    photo_urls: [
      'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=1200&q=85'
    ],
    prices: {
      US: { currency: 'USD', price: 2390, compare_at: 2650 },
      GB: { currency: 'GBP', price: 1890, compare_at: 2100 },
      AU: { currency: 'AUD', price: 3690, compare_at: 4100 },
      DE: { currency: 'EUR', price: 2250, compare_at: 2490 },
      FR: { currency: 'EUR', price: 2250, compare_at: 2490 },
    }
  }
];

const CURATED_COLLECTIONS = [
  {
    name: 'The Bridal & Solitaire Collection',
    slug: 'bridal-solitaires',
    tagline: 'Handcrafted engagement rings and eternal wedding bands',
    hero_image_url: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1600&q=85',
    sort_order: 1
  },
  {
    name: 'The High Jewellery Rivieres',
    slug: 'high-jewellery-rivieres',
    tagline: 'Rare solid 18K gold collars and statement necklaces',
    hero_image_url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1600&q=85',
    sort_order: 2
  },
  {
    name: 'The Royal Heritage Suite',
    slug: 'royal-heritage-suites',
    tagline: 'Centuries of goldsmithing mastery reborn in Surat',
    hero_image_url: 'https://res.cloudinary.com/ddnlacdta/image/upload/v1783844231/NCK61.1_q8hiom.webp',
    sort_order: 3
  },
  {
    name: 'Tennis & Fluid Diamonds',
    slug: 'tennis-suites',
    tagline: 'Continuous ribbons of certified Antwerp brilliance',
    hero_image_url: 'https://images.unsplash.com/photo-1611591475870-760a927a4e69?auto=format&fit=crop&w=1600&q=85',
    sort_order: 4
  }
];

async function run() {
  console.log('=== Publishing All Pieces to Live D2C Storefront ===');

  // 1. Update Existing Pieces
  for (const item of EXISTING_PIECES_UPDATE) {
    const { prices, ...updateData } = item;
    const { data: prod, error } = await sb
      .from('products')
      .update(updateData)
      .eq('code', item.code)
      .select('id')
      .maybeSingle();

    if (error || !prod) {
      console.warn(`Could not update existing product ${item.code}:`, error);
      continue;
    }

    console.log(`Updated product ${item.code} (${prod.id}) to published!`);

    // Insert prices for this product
    for (const [marketCode, p] of Object.entries(prices)) {
      await sb.from('d2c_market_prices').delete().eq('product_id', prod.id).eq('market_code', marketCode);
      const { error: pErr } = await sb.from('d2c_market_prices').insert({
        product_id: prod.id,
        market_code: marketCode,
        currency: p.currency,
        price: p.price,
        compare_at_price: p.compare_at,
        pricing_mode: 'fixed',
        is_active: true
      });
      if (pErr) console.warn(`Error inserting price for ${item.code} in ${marketCode}:`, pErr.message);
    }
  }

  // 2. Insert/Update Signature New Pieces (Rings, Studs, Tennis Bracelets)
  for (const item of SIGNATURE_NEW_PIECES) {
    const { prices, ...prodData } = item;
    const { data: existing } = await sb.from('products').select('id').eq('code', item.code).maybeSingle();

    let productId = existing ? existing.id : null;
    if (productId) {
      await sb.from('products').update(prodData).eq('id', productId);
      console.log(`Updated signature piece ${item.code}...`);
    } else {
      const { data: created, error: cErr } = await sb.from('products').insert({
        ...prodData,
        is_active: true
      }).select('id').single();
      if (cErr) {
        console.warn(`Error inserting signature piece ${item.code}:`, cErr.message);
        continue;
      }
      productId = created.id;
      console.log(`Created new signature piece ${item.code} (${productId})...`);
    }

    // Insert prices
    for (const [marketCode, p] of Object.entries(prices)) {
      await sb.from('d2c_market_prices').delete().eq('product_id', productId).eq('market_code', marketCode);
      const { error: pErr } = await sb.from('d2c_market_prices').insert({
        product_id: productId,
        market_code: marketCode,
        currency: p.currency,
        price: p.price,
        compare_at_price: p.compare_at,
        pricing_mode: 'fixed',
        is_active: true
      });
      if (pErr) console.warn(`Error inserting price for ${item.code} in ${marketCode}:`, pErr.message);
    }
  }

  // 3. Upsert Curated Collections
  for (const col of CURATED_COLLECTIONS) {
    const { data: existingCol } = await sb.from('design_collections').select('id').eq('slug', col.slug).maybeSingle();
    if (existingCol) {
      await sb.from('design_collections').update(col).eq('id', existingCol.id);
    } else {
      await sb.from('design_collections').insert(col);
    }
    console.log(`Configured collection: ${col.name}`);
  }

  // 4. Verify Final State
  const { data: liveProducts } = await sb
    .from('products')
    .select('code, name, slug, d2c_status, category')
    .eq('d2c_status', 'published');

  const { data: priceCount } = await sb
    .from('d2c_market_prices')
    .select('id', { count: 'exact' });

  console.log('====================================================');
  console.log(`SUCCESS! Live Published Products in Store: ${liveProducts ? liveProducts.length : 0}`);
  if (liveProducts) {
    liveProducts.forEach(p => console.log(` - [${p.category}] ${p.name} (/jewellery/${p.slug})`));
  }
  console.log(`Total Active Market Price Records: ${priceCount ? priceCount.length : 0}`);
  console.log('====================================================');
}

run().catch(console.error);
