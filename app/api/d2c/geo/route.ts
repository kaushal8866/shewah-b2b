import { NextRequest, NextResponse } from 'next/server'
import { getMarket, MARKETS, MarketCode } from '@/lib/markets'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    // Check edge proxy geo headers (Vercel, Cloudflare, AWS CloudFront, Fastly)
    const countryHeader =
      req.headers.get('x-vercel-ip-country') ||
      req.headers.get('cf-ipcountry') ||
      req.headers.get('x-country-code') ||
      req.headers.get('cloudfront-viewer-country') ||
      req.headers.get('x-geo-country')

    if (countryHeader) {
      const upper = countryHeader.trim().toUpperCase()
      const market = getMarket(upper)
      return NextResponse.json({
        country: upper,
        marketCode: market.code,
        detected: true,
        source: 'edge_header',
      })
    }

    // Fallback: accept-language header check
    const acceptLang = req.headers.get('accept-language') || ''
    if (/[\b_-]IN\b/i.test(acceptLang) || /hi-IN|gu-IN|mr-IN|ta-IN|te-IN|kn-IN/i.test(acceptLang)) {
      return NextResponse.json({
        country: 'IN',
        marketCode: 'IN',
        detected: true,
        source: 'accept_language',
      })
    }
    if (/[\b_-]GB\b/i.test(acceptLang)) {
      return NextResponse.json({
        country: 'GB',
        marketCode: 'GB',
        detected: true,
        source: 'accept_language',
      })
    }
    if (/[\b_-]AU\b/i.test(acceptLang)) {
      return NextResponse.json({
        country: 'AU',
        marketCode: 'AU',
        detected: true,
        source: 'accept_language',
      })
    }
    if (/[\b_-]DE\b/i.test(acceptLang)) {
      return NextResponse.json({
        country: 'DE',
        marketCode: 'DE',
        detected: true,
        source: 'accept_language',
      })
    }
    if (/[\b_-]FR\b/i.test(acceptLang)) {
      return NextResponse.json({
        country: 'FR',
        marketCode: 'FR',
        detected: true,
        source: 'accept_language',
      })
    }

    // Default un-detected fallback
    return NextResponse.json({
      country: 'US',
      marketCode: 'US',
      detected: false,
      source: 'default',
    })
  } catch (err: any) {
    return NextResponse.json({
      country: 'US',
      marketCode: 'US',
      detected: false,
      error: err?.message,
    })
  }
}
