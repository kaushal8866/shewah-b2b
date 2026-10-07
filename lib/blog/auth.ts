import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ActorType } from './types'

export interface BlogAuthContext {
  authenticated: boolean
  actorType: ActorType
  actorId: string
  displayName?: string
  scopes: string[]
  isOwner: boolean
}

// In-memory rate limiter per token/actor
const rateLimitHits = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 60 // 60 requests per minute
const RATE_LIMIT_WINDOW_MS = 60_000

export function checkRateLimit(actorId: string): boolean {
  const now = Date.now()
  const hit = rateLimitHits.get(actorId)
  if (!hit || now > hit.resetAt) {
    rateLimitHits.set(actorId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (hit.count >= RATE_LIMIT_MAX) {
    return false
  }
  hit.count += 1
  return true
}

/**
 * Authenticate incoming blog request from either NextAuth session cookie or Bearer API token.
 */
export async function authenticateBlogRequest(req: NextRequest): Promise<BlogAuthContext | null> {
  // 1. Check Bearer token in Authorization header
  const authHeader = req.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const rawToken = authHeader.slice(7).trim()
    if (!rawToken || !rawToken.startsWith('shw_blog_')) {
      return null
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const now = new Date().toISOString()

    const { data: tokenRecord, error } = await supabaseAdmin
      .from('blog_api_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .eq('is_revoked', false)
      .maybeSingle()

    if (error || !tokenRecord) {
      return null
    }

    // Check expiration if set
    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) <= new Date()) {
      return null
    }

    // Record last used timestamp asynchronously
    void supabaseAdmin
      .from('blog_api_tokens')
      .update({ last_used_at: now })
      .eq('id', tokenRecord.id)

    return {
      authenticated: true,
      actorType: 'assistant_token',
      actorId: `${tokenRecord.token_prefix}${tokenRecord.id.slice(0, 8)}`,
      displayName: tokenRecord.name,
      scopes: tokenRecord.scopes || ['blog:read', 'blog:draft:write'],
      isOwner: false,
    }
  }

  // 2. Check NextAuth session cookie (Owner / Staff)
  try {
    const session = await getServerSession(authOptions)
    if (session?.user) {
      const user = session.user as any
      const isMaster = user.role === 'master'

      return {
        authenticated: true,
        actorType: 'owner',
        actorId: user.id || 'owner_session',
        displayName: user.displayName || user.username || 'Atelier Owner',
        // Master admin gets all scopes including blog:owner
        scopes: isMaster
          ? ['blog:read', 'blog:draft:write', 'blog:publish', 'blog:schedule', 'blog:owner']
          : (user.permissions?.includes('blog') ? ['blog:read', 'blog:draft:write'] : []),
        isOwner: isMaster,
      }
    }
  } catch (err) {
    // NextAuth session lookup failed
  }

  return null
}

/**
 * Generate a cryptographically secure API token.
 * Returns { rawToken, tokenHash, tokenPrefix }.
 * The rawToken is shown ONLY ONCE to the owner!
 */
export function generateBlogApiToken(): { rawToken: string; tokenHash: string; tokenPrefix: string } {
  const tokenPrefix = 'shw_blog_'
  const randomBytes = crypto.randomBytes(32).toString('hex')
  const rawToken = `${tokenPrefix}${randomBytes}`
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

  return { rawToken, tokenHash, tokenPrefix }
}
