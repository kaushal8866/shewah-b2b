import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import LandingPage from './LandingPage'
import { BRAND, SEO } from '@/lib/landingCopy'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

async function getLandingWhatsapp(): Promise<string> {
  // Master admins set this via Settings → "Marketing landing page".
  // Falls back to the build-time default in lib/landingCopy.ts.
  try {
    const { data } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'landing_whatsapp_e164')
      .maybeSingle()
    const v = (data?.value || '').replace(/\D/g, '')
    return v.length >= 10 ? v : BRAND.whatsappE164
  } catch {
    return BRAND.whatsappE164
  }
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://shewah.in'

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: SEO.title,
  description: SEO.description,
  alternates: { canonical: '/' },
  openGraph: {
    title: SEO.title,
    description: SEO.description,
    type: 'website',
    siteName: 'Shewah',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: SEO.title,
    description: SEO.description,
  },
  robots: { index: true, follow: true },
}

function dashboardForRole(role: string | undefined): string {
  // Roles match `app_users.role` values used across the app: 'manufacturer',
  // 'retailer', 'cad', 'master', 'sub'.
  if (role === 'manufacturer') return '/portal/manufacturer'
  if (role === 'retailer')     return '/portal/retailer'
  return '/dashboard'
}

export default async function HomePage() {
  // Logged-in users never see the marketing page — punt them to wherever
  // their role lives.
  const session = await getServerSession(authOptions)
  if (session?.user) {
    redirect(dashboardForRole((session.user as any).role))
  }
  const whatsappE164 = await getLandingWhatsapp()
  return <LandingPage whatsappE164={whatsappE164} />
}
