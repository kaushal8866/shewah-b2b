import { cookies } from 'next/headers'
import crypto from 'crypto'

const SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret-for-reseller-storefront-auth-32-chars-long'

export function signPayload(payload: any): string {
  const data = JSON.stringify(payload)
  const signature = crypto.createHmac('sha256', SECRET).update(data).digest('hex')
  return `${Buffer.from(data).toString('base64')}.${signature}`
}

export function verifyPayload(token: string): any | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 2) return null
    const [base64Data, signature] = parts
    const data = Buffer.from(base64Data, 'base64').toString()
    const expectedSignature = crypto.createHmac('sha256', SECRET).update(data).digest('hex')
    if (signature !== expectedSignature) return null
    return JSON.parse(data)
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
