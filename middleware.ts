import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl
    const token = req.nextauth.token

    if (!token) return NextResponse.redirect(new URL('/login', req.url))

    // Settings is master-only
    if (pathname.startsWith('/settings') && token.role !== 'master') {
      return NextResponse.redirect(new URL('/', req.url))
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
