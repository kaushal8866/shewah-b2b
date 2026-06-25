import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getStorefrontCustomer } from '@/lib/storefrontAuth'

// GET: fetch approved reviews for a product
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('product_id')

  if (!productId) {
    return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
  }

  // 1. Fetch share link
  const { data: shareLink } = await supabaseAdmin
    .from('reseller_share_links')
    .select('reseller_id')
    .eq('link_token', params.token)
    .eq('is_active', true)
    .maybeSingle()

  if (!shareLink) {
    return NextResponse.json({ error: 'Storefront not found' }, { status: 404 })
  }

  // 2. Fetch approved reviews for this product and reseller storefront
  const { data: reviews, error } = await supabaseAdmin
    .from('reseller_storefront_reviews')
    .select(`
      id,
      rating,
      review_text,
      photo_urls,
      reseller_reply,
      created_at,
      customer: reseller_storefront_customers ( name )
    `)
    .eq('reseller_id', shareLink.reseller_id)
    .eq('product_id', productId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to retrieve reviews' }, { status: 500 })
  }

  return NextResponse.json({ reviews: reviews || [] })
}

// POST: submit a new product review
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const token = params.token
  
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { product_id, rating, review_text, photo_urls } = body

  if (!product_id || !rating) {
    return NextResponse.json({ error: 'Product ID and rating are required' }, { status: 400 })
  }

  // 1. Resolve reseller
  const { data: shareLink } = await supabaseAdmin
    .from('reseller_share_links')
    .select('reseller_id')
    .eq('link_token', token)
    .eq('is_active', true)
    .maybeSingle()

  if (!shareLink) {
    return NextResponse.json({ error: 'Storefront not found' }, { status: 404 })
  }

  // 2. Resolve optional customer session
  const customer = await getStorefrontCustomer()

  // 3. Insert review as pending
  const { data: review, error } = await supabaseAdmin
    .from('reseller_storefront_reviews')
    .insert({
      reseller_id: shareLink.reseller_id,
      customer_id: customer?.id || null,
      product_id: product_id,
      rating: parseInt(rating),
      review_text: review_text || '',
      photo_urls: photo_urls || [],
      status: 'pending' // awaiting reseller review approval/moderation
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Could not submit review: ' + error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, review })
}
