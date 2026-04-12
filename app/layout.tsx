import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Providers from './components/Providers'
import AppShell from './components/AppShell'

export const metadata: Metadata = {
  title: 'Shewah B2B Admin',
  description: 'B2B operations management for Shewah Jewelry — LGD rings, Surat',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} font-sans`}>
      <body className="bg-surface text-on-surface antialiased bg-surface selection:bg-primary selection:text-white">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
