import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Partner Portal Sign In',
  description: 'Sign in to the Shewah B2B Trade & Partner Portal.',
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: 'https://shewah.co/login',
  },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
