import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import {
  LANDING_VARIANT_COOKIE, LANDING_VARIANT_COOKIE_MAX_AGE, LANDING_VARIANT_HEADER,
  isLandingVariant, pickRandomVariant, readKillSwitch,
} from '@/lib/landingVariant'

// Public marketing surfaces — anyone can hit them, logged in or not.
function isPublicMarketing(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/partner-signup') || pathname.startsWith('/consultation') || pathname === '/api/public/partner-signup' || pathname === '/api/public/consultation'
}

// Public white-labeled storefront and reseller invitation acceptance routes.
function isPublicStorefront(pathname: string): boolean {
  return (
    pathname.startsWith('/r/') ||
    pathname.startsWith('/api/r/') ||
    pathname.startsWith('/accept-invite/') ||
    pathname.startsWith('/api/public/invite')
  )
}

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl
    const token = req.nextauth.token

    if (isPublicStorefront(pathname)) {
      return NextResponse.next()
    }

    if (isPublicMarketing(pathname)) {
      if (pathname === '/') {
        const override = readKillSwitch()
        const existing = req.cookies.get(LANDING_VARIANT_COOKIE)?.value
        const desired  = override || (isLandingVariant(existing) ? existing : pickRandomVariant())

        const requestHeaders = new Headers(req.headers)
        requestHeaders.set(LANDING_VARIANT_HEADER, desired)
        const res = NextResponse.next({ request: { headers: requestHeaders } })
        if (desired !== existing) {
          res.cookies.set(LANDING_VARIANT_COOKIE, desired, {
            path: '/',
            maxAge: LANDING_VARIANT_COOKIE_MAX_AGE,
            sameSite: 'lax',
          })
        }
        return res
      }
      return NextResponse.next()
    }

    if (!token) return NextResponse.redirect(new URL('/login', req.url))

    const role = token.role as string

    const isMfgPortal      = pathname.startsWith('/portal/manufacturer')
    const isMfgApi         = pathname.startsWith('/api/portal/manufacturer')
    const isRetailerPortal = pathname.startsWith('/portal/retailer')
    const isRetailerApi    = pathname.startsWith('/api/portal/retailer')
    const isResellerPortal = pathname.startsWith('/portal/reseller')
    const isResellerApi    = pathname.startsWith('/api/portal/reseller')

    // Manufacturer-only namespaces (page + API).
    if (isMfgPortal || isMfgApi) {
      if (role !== 'manufacturer') {
        if (isMfgApi) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        return NextResponse.redirect(new URL('/', req.url))
      }
      return NextResponse.next()
    }

    // Retailer-only namespaces (page + API).
    if (isRetailerPortal || isRetailerApi) {
      if (role !== 'retailer') {
        if (isRetailerApi) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        return NextResponse.redirect(new URL('/', req.url))
      }
      return NextResponse.next()
    }

    // Reseller-only namespaces (page + API).
    if (isResellerPortal || isResellerApi) {
      if (role !== 'reseller') {
        if (isResellerApi) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        return NextResponse.redirect(new URL('/', req.url))
      }
      return NextResponse.next()
    }

    // Shared infrastructure endpoints any authenticated user can hit.
    if (
      pathname === '/api/upload' ||
      pathname.startsWith('/api/upload/') ||
      pathname.startsWith('/api/diamonds/')
    ) {
      return NextResponse.next()
    }

    // Manufacturers are sandboxed to their portal — block every other admin URL/API.
    if (role === 'manufacturer') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/portal/manufacturer', req.url))
    }

    // Retailers are sandboxed to their portal — block every other admin URL/API.
    if (role === 'retailer') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/portal/retailer', req.url))
    }

    // Resellers are sandboxed to their portal — block every other admin URL/API.
    if (role === 'reseller') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/portal/reseller', req.url))
    }

    // Settings is master-only
    if (pathname.startsWith('/settings') && role !== 'master') {
      return NextResponse.redirect(new URL('/', req.url))
    }

    // Profitability dashboard is master or perms-gated sub admin
    if (pathname.startsWith('/profitability') && role !== 'master') {
      const perms = (token.permissions as string[] | undefined) || []
      if (!perms.includes('profitability')) {
        return NextResponse.redirect(new URL('/', req.url))
      }
    }

    // Material ledger / float pages are master-only
    if (/^\/manufacturing\/partners\/[^/]+\/float/.test(pathname) && token.role !== 'master') {
      return NextResponse.redirect(new URL('/manufacturing', req.url))
    }

    // Gold reconciliation report is master-only
    if (/^\/manufacturing\/partners\/[^/]+\/reconciliation/.test(pathname) && token.role !== 'master') {
      return NextResponse.redirect(new URL('/manufacturing', req.url))
    }

    // Reconciliation digest dashboard is master-only
    if (pathname.startsWith('/manufacturing/reconciliation-alerts') && token.role !== 'master') {
      return NextResponse.redirect(new URL('/manufacturing', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname
        if (isPublicMarketing(path) || isPublicStorefront(path)) return true
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    // SECURITY: anything matched here is excluded from NextAuth middleware.
    '/((?!login|partner-signup|consultation|setup|showcase|track|m/|cad-share/|q/|c/|accept-invite/|r/|api/r/|api/auth|api/setup|api/showcase|api/track|api/cron|api/whatsapp|api/m/|api/cad-share/|api/quotes/share/|api/quotes/test-compute|api/c/|api/public|api/upload|_next|_vercel|favicon\\.ico|opengraph-image|.*\\.).*)',
  ],
}
