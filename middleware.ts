import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import {
  LANDING_VARIANT_COOKIE, LANDING_VARIANT_COOKIE_MAX_AGE, LANDING_VARIANT_HEADER,
  isLandingVariant, pickRandomVariant, readKillSwitch,
} from '@/lib/landingVariant'
// NOTE: middleware matcher in `config` excludes most /api/* routes, but we need
// /api/portal/* to be reachable for manufacturers and retailers. The matcher
// keeps /api/portal/* in scope while still excluding /api/auth, /api/setup,
// /api/showcase, /api/track.

// Public marketing surfaces — anyone can hit them, logged in or not.
// `/` is the lead-capture landing page and `/partner-signup` its full form.
function isPublicMarketing(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/partner-signup') || pathname === '/api/public/partner-signup'
}

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl
    const token = req.nextauth.token

    // Marketing pages render for everyone — the page itself decides whether
    // to redirect a logged-in user to their role's home.
    if (isPublicMarketing(pathname)) {
      // Task 102 — landing-page A/B bucketing.
      // On `/`, ensure every visitor has a sticky `lp_variant` cookie so the
      // server component can render the matching layout. Server Components
      // can read cookies but not set them, so the assignment must happen
      // here in middleware.
      //
      // CRITICAL: on the very first hit there is no incoming cookie, but the
      // user MUST see the same variant we just persisted to the response —
      // otherwise the rendered layout and the cookie that LeadForm later
      // forwards would disagree, corrupting the conversion data. We solve
      // this by stamping the chosen variant onto a request header
      // (`x-landing-variant`) that flows downstream to `app/page.tsx`. The
      // page reads the header first and only falls back to the request
      // cookie if the header is missing (i.e. someone hit the page outside
      // middleware, which shouldn't happen for `/`).
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

    // Shared infrastructure endpoints any authenticated user can hit.
    // /api/upload proxies to Cloudinary and is needed by retailers (custom
    // order photos) and manufacturers (CAD/QC uploads) just as much as the
    // admin team. Without this, the sandbox rules below return 403 Forbidden
    // because /api/upload doesn't live under /api/portal/<role>/*.
    if (pathname === '/api/upload' || pathname.startsWith('/api/upload/')) {
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

    // Reconciliation digest dashboard is master-only
    if (pathname.startsWith('/manufacturing/reconciliation-alerts') && token.role !== 'master') {
      return NextResponse.redirect(new URL('/manufacturing', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        if (isPublicMarketing(req.nextUrl.pathname)) return true
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    // SECURITY: anything matched here is excluded from NextAuth middleware.
    // /api/cron/* is excluded so Replit Scheduled Deployments can hit it
    // without a session — every route under /api/cron MUST implement its own
    // auth (typically a Bearer $CRON_SECRET check) inside the handler.
    '/((?!login|partner-signup|setup|showcase|track|m/|cad-share/|q/|c/|api/auth|api/setup|api/showcase|api/track|api/cron|api/whatsapp|api/m/|api/cad-share/|api/quotes/share/|api/quotes/test-compute|api/c/|api/public|_next|_vercel|favicon\\.ico|opengraph-image|.*\\.).*)',
  ],
}
