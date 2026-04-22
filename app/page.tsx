import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import LandingPage from './LandingPage'
import LandingPageOriginal from './LandingPageOriginal'
import { BRAND, SEO } from '@/lib/landingCopy'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  LANDING_VARIANT_COOKIE, LANDING_VARIANT_HEADER,
  isLandingVariant, readKillSwitch,
} from '@/lib/landingVariant'

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

  // Task 102 — A/B test the redesign against the previous layout.
  // Middleware bucketed this request and stamped the chosen variant on the
  // `x-landing-variant` request header (and on the response cookie for
  // stickiness). We trust the header first so a brand-new visitor — who has
  // no cookie yet on this very request — renders the same layout the cookie
  // will tag their signup with. The cookie + env override are defensive
  // fallbacks in case middleware was bypassed or the kill-switch was set
  // after a stale cookie was issued.
  const headerVariant = headers().get(LANDING_VARIANT_HEADER)
  const cookieVariant = cookies().get(LANDING_VARIANT_COOKIE)?.value
  const variant =
    readKillSwitch()
    || (isLandingVariant(headerVariant) ? headerVariant : null)
    || (isLandingVariant(cookieVariant) ? cookieVariant : null)
    || 'outcome_first'

  if (variant === 'original') {
    return <LandingPageOriginal whatsappE164={whatsappE164} />
  }
  return <LandingPage whatsappE164={whatsappE164} />
}
