import { randomBytes } from 'crypto'

/**
 * URL-safe token for /c/[token] customer journey magic links.
 * 24 bytes → 32-char base64url string. Plenty of entropy and short
 * enough to fit comfortably in a WhatsApp message.
 */
export function generateJourneyToken(): string {
  return randomBytes(24).toString('base64url')
}

/** Default expiry: 180 days from now (per task spec). */
export function defaultJourneyExpiry(from = new Date()): Date {
  const d = new Date(from)
  d.setDate(d.getDate() + 180)
  return d
}
