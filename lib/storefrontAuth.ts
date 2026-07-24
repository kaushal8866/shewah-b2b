import { cookies } from 'next/headers'
import crypto from 'crypto'

// Signing key for storefront customer sessions. There is deliberately NO
// fallback: a hardcoded default would be readable in the public source, which
// would let anyone mint a valid session for any storefront customer.
function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error(
      'NEXTAUTH_SECRET is not set — storefront session tokens cannot be signed securely.',
    )
  }
  return secret
}

// Sessions expire server-side, independent of the cookie's own maxAge. A cookie
// lifetime is a client-side hint an attacker can ignore; this claim is signed.
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60

type StorefrontClaims = {
  iat: number
  exp: number
  [key: string]: any
}

export function signPayload(payload: any): string {
  const now = Math.floor(Date.now() / 1000)
  const claims: StorefrontClaims = {
    ...payload,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  }
  const data = JSON.stringify(claims)
  const signature = crypto.createHmac('sha256', getSecret()).update(data).digest('hex')
  return `${Buffer.from(data).toString('base64url')}.${signature}`
}

export function verifyPayload(token: string): any | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 2) return null
    const [encodedData, signature] = parts

    // base64url is what we now issue; plain base64 decodes identically for the
    // characters Buffer accepts, so older cookies still verify.
    const data = Buffer.from(encodedData, 'base64url').toString()
    const expected = crypto.createHmac('sha256', getSecret()).update(data).digest('hex')

    // Constant-time compare — a length mismatch is rejected before timingSafeEqual,
    // which throws on unequal buffer lengths.
    const sigBuf = Buffer.from(signature, 'hex')
    const expBuf = Buffer.from(expected, 'hex')
    if (sigBuf.length !== expBuf.length) return null
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null

    const claims = JSON.parse(data) as StorefrontClaims

    // Reject anything without a valid, unexpired lifetime. Tokens issued before
    // expiry claims existed have no `exp` and are treated as expired, forcing a
    // clean re-authentication.
    if (typeof claims.exp !== 'number' || claims.exp <= Math.floor(Date.now() / 1000)) {
      return null
    }

    return claims
  } catch {
    return null
  }
}

export async function getStorefrontCustomer() {
  const cookieStore = cookies()
  const token = cookieStore.get('reseller_customer_jwt')?.value
  if (!token) return null
  return verifyPayload(token)
}
