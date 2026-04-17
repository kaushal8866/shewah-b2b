/**
 * Shewah B2B — Auth Middleware (Phase 0 Harden)
 *
 * Enforces authentication on all internal routes.
 * Public routes: /  /login  /auth/*  /shared-design/*  /track/*
 *
 * Uses @supabase/ssr to read the session from the cookie — this is the
 * correct pattern for Next.js 14 App Router middleware.
 *
 * Rate-limiting of /login is handled at the application layer (Phase 1).
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/** Routes that require NO authentication. Exact match or prefix. */
const PUBLIC_PATHS = [
  '/',          // landing page
]

const PUBLIC_PREFIXES = [
  '/login',
  '/auth',
  '/shared-design',
  '/track',
]

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const { pathname } = request.nextUrl

  // Unauthenticated request to a protected route → login
  if (!session && !isPublicPath(pathname)) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Authenticated user hitting /login → route by role
  if (session && pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Attach user id to request headers so Server Components can read it
  // without another async call (performance optimisation)
  if (session) {
    response.headers.set('x-user-id', session.user.id)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match everything except:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico
     * - image/font/icon files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)',
  ],
}
