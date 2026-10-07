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

import { NextResponse } from 'next/server'
import { getBlogSettings } from './storage'

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
 * Validate request payload size against a maximum byte limit.
 */
export function checkRequestSize(req: NextRequest, maxBytes = 512_000): { ok: boolean; size?: number; error?: string } {
  const contentLength = req.headers.get('content-length')
  if (contentLength) {
    const bytes = parseInt(contentLength, 10)
    if (!isNaN(bytes) && bytes > maxBytes) {
      return {
        ok: false,
        size: bytes,
        error: `Payload too large (${(bytes / 1024).toFixed(1)} KB). Maximum allowed size is ${(maxBytes / 1024).toFixed(1)} KB.`,
      }
    }
  }
  return { ok: true }
}

/**
 * Comprehensive API security validator:
 * 1. Request size limit check (413)
 * 2. Authentication check (401)
 * 3. Token revocation and expiry check (401)
 * 4. Kill switch / is_blog_enabled check (503)
 * 5. Automation pause switch check (403 for assistant tokens)
 * 6. Rate limit check (429)
 * 7. Scope verification check (403)
 */
export async function validateBlogApiAccess(
  req: NextRequest,
  options?: { requiredScope?: string; maxBytes?: number; requireOwner?: boolean }
): Promise<{ authorized: boolean; auth?: BlogAuthContext; response?: NextResponse }> {
  // 1. Request size limit check
  const sizeCheck = checkRequestSize(req, options?.maxBytes ?? 512_000)
  if (!sizeCheck.ok) {
    return {
      authorized: false,
      response: NextResponse.json({ error: sizeCheck.error }, { status: 413 }),
    }
  }

  // 2. Authentication check
  const auth = await authenticateBlogRequest(req)
  if (!auth) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Unauthorized: Missing or invalid credentials' }, { status: 401 }),
    }
  }

  // 3. Blog settings checks (kill switch + automation pause)
  const settings = await getBlogSettings()

  if (settings.is_blog_enabled === false && !auth.isOwner && !auth.scopes.includes('blog:owner')) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Blog system is currently disabled by the atelier owner.' },
        { status: 503 }
      ),
    }
  }

  if (settings.is_automation_paused && auth.actorType === 'assistant_token') {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Blog automation is currently paused by the atelier owner.' },
        { status: 403 }
      ),
    }
  }

  // 4. Rate limiting check
  if (!checkRateLimit(auth.actorId)) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Too many requests. Rate limit exceeded.' }, { status: 429 }),
    }
  }

  // 5. Require Owner check
  if (options?.requireOwner && !auth.isOwner && !auth.scopes.includes('blog:owner')) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Forbidden: This action requires atelier owner authority.' },
        { status: 403 }
      ),
    }
  }

  // 6. Scoped authority check
  if (options?.requiredScope && !auth.scopes.includes(options.requiredScope) && !auth.isOwner) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: `Forbidden: Missing required "${options.requiredScope}" permission scope.` },
        { status: 403 }
      ),
    }
  }

  return { authorized: true, auth }
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
