import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
// NOTE: middleware matcher in `config` excludes most /api/* routes, but we need
// /api/portal/* to be reachable for manufacturers and retailers. The matcher
// keeps /api/portal/* in scope while still excluding /api/auth, /api/setup,
// /api/showcase, /api/track.

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl
    const token = req.nextauth.token

    if (!token) return NextResponse.redirect(new URL('/login', req.url))

    const role = token.role as string

    const isMfgPortal      = pathname.startsWith('/portal/manufacturer')
    const isMfgApi         = pathname.startsWith('/api/portal/manufacturer')
    const isRetailerPortal = pathname.startsWith('/portal/retailer')
    const isRetailerApi    = pathname.startsWith('/api/portal/retailer')

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

    // Settings is master-only
    if (pathname.startsWith('/settings') && role !== 'master') {
      return NextResponse.redirect(new URL('/', req.url))
    }

    // Profitability dashboard exposes COGS / margin and is gated by the
    // 'profitability' module permission for sub admins (master always sees it).
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

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: [
    '/((?!login|setup|showcase|track|api/auth|api/setup|api/showcase|api/track|_next|_vercel|favicon\\.ico|.*\\.).*)',
  ],
}
