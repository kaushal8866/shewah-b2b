import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import LandingPage from './LandingPage'
import { SEO } from '@/lib/landingCopy'

export const metadata = {
  title: SEO.title,
  description: SEO.description,
  openGraph: {
    title: SEO.title,
    description: SEO.description,
    type: 'website',
    siteName: 'Shewah',
  },
  twitter: {
    card: 'summary_large_image',
    title: SEO.title,
    description: SEO.description,
  },
  robots: { index: true, follow: true },
}

function dashboardForRole(role: string | undefined): string {
  if (role === 'manufacturing_partner') return '/portal/manufacturer'
  if (role === 'retailer')              return '/portal/retailer'
  return '/dashboard'
}

export default async function HomePage() {
  // Logged-in users never see the marketing page — punt them to wherever
  // their role lives.
  const session = await getServerSession(authOptions)
  if (session?.user) {
    redirect(dashboardForRole((session.user as any).role))
  }
  return <LandingPage />
}
