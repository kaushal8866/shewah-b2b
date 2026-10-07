import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'SHEWAH — Fine Jewellery Atelier & Certified Diamonds'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#051F34',
          color: '#F6F4F2',
          padding: '64px 72px',
          fontFamily: 'serif',
          border: '12px solid #051F34',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        {/* Subtle decorative inner border */}
        <div
          style={{
            position: 'absolute',
            top: 24,
            left: 24,
            right: 24,
            bottom: 24,
            border: '1px solid rgba(227, 219, 212, 0.25)',
            display: 'flex',
          }}
        />

        {/* Brand header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 38, fontWeight: 400, letterSpacing: '0.2em', color: '#F6F4F2' }}>
              SHEWAH
            </div>
            <div style={{ fontSize: 13, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#CB9274', marginTop: 4, fontFamily: 'sans-serif' }}>
              High Jewellery Atelier
            </div>
          </div>
          <div style={{
            fontSize: 12,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: '#E3DBD4',
            fontFamily: 'sans-serif',
            border: '1px solid rgba(227, 219, 212, 0.3)',
            padding: '8px 18px',
          }}>
            Solid 18K Gold • Certified Diamonds
          </div>
        </div>

        {/* Hero headline & positioning */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto', zIndex: 10, paddingBottom: 16 }}>
          <div style={{ fontSize: 56, lineHeight: 1.15, fontWeight: 400, maxWidth: 960, color: '#FFFFFF' }}>
            Fine Jewellery Atelier & Certified Diamonds
          </div>
          <div style={{ display: 'flex', marginTop: 24, fontSize: 20, opacity: 0.85, fontFamily: 'sans-serif', maxWidth: 980, color: '#E3DBD4', lineHeight: 1.4 }}>
            Handcrafted individually to order in solid 18K gold and certified diamonds. Discover bridal solitaires, continuous diamond rivières, and bespoke atelier commissions.
          </div>
          <div style={{ display: 'flex', marginTop: 32, gap: 28, alignItems: 'center', fontFamily: 'sans-serif', fontSize: 14, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#CB9274' }}>
            <div>✦ Made to Order</div>
            <div>✦ Worldwide Insured Delivery</div>
            <div>✦ 14-Day Returns</div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
