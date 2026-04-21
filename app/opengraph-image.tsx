import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Shewah — diamond jewellery wholesale & manufacturing partner for Indian retailers'
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
          background: 'linear-gradient(135deg, #1E3A5F 0%, #2a4d7a 60%, #3d6396 100%)',
          color: 'white',
          padding: '64px 72px',
          fontFamily: 'serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30,
          }}>◆</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: -0.5 }}>Shewah</div>
            <div style={{ fontSize: 18, opacity: 0.7 }}>B2B jewellery partner</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto' }}>
          <div style={{ fontSize: 64, lineHeight: 1.05, fontWeight: 400, maxWidth: 980 }}>
            Diamond jewellery, the way Indian retailers actually want it.
          </div>
          <div style={{ display: 'flex', marginTop: 28, fontSize: 24, opacity: 0.85, fontFamily: 'sans-serif', maxWidth: 1000 }}>
            Live catalog · transparent gold + labour pricing · custom CAD in 48h · Ready-to-Ship marketplace · WhatsApp-native tracking.
          </div>
          <div style={{ display: 'flex', marginTop: 36, gap: 20, alignItems: 'center', fontFamily: 'sans-serif' }}>
            <div style={{
              background: 'white', color: '#1E3A5F', fontSize: 22, fontWeight: 600,
              padding: '14px 26px', borderRadius: 12,
            }}>
              Become a Shewah partner →
            </div>
            <div style={{ fontSize: 18, opacity: 0.7 }}>No joining fee · No exclusivity</div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
