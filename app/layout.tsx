import './globals.css'
import type { Metadata, Viewport } from 'next'
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
