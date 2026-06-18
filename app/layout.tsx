import './globals.css'
import SessionProvider from '@/components/SessionProvider'
import AppShell from '@/components/AppShell'

export const metadata: Metadata = {
  title: 'Shewah B2B Admin',
  description: 'B2B operations management for Shewah Jewelry — LGD rings, Surat',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>Shewah B2B Admin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <SessionProvider>
          <AppShell>
            {children}
          </AppShell>
        </SessionProvider>
      </body>
    </html>
  )
}
