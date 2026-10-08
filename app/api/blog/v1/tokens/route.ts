import { NextRequest, NextResponse } from 'next/server'
import { validateBlogApiAccess, generateBlogApiToken } from '@/lib/blog/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { recordBlogAudit } from '@/lib/blog/audit'

export async function GET(req: NextRequest) {
  const access = await validateBlogApiAccess(req, { requireOwner: true })
  if (!access.authorized || !access.auth) {
    return access.response!
  }

  const { data: tokens, error } = await supabaseAdmin
    .from('blog_api_tokens')
    .select('id, name, token_prefix, scopes, is_revoked, expires_at, last_used_at, created_by, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ tokens: tokens || [] })
}

export async function POST(req: NextRequest) {
  const access = await validateBlogApiAccess(req, { requireOwner: true, maxBytes: 64_000 })
  if (!access.authorized || !access.auth) {
    return access.response!
  }
  const auth = access.auth

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad Request: Invalid JSON body' }, { status: 400 })
  }

  const { name, scopes, expiresDays } = body
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return NextResponse.json(
      { error: 'Bad Request: "name" is required (e.g. "External Editorial Assistant").' },
      { status: 400 }
    )
  }

  // Enforce allowed scopes
  const requestedScopes: string[] = Array.isArray(scopes) && scopes.length > 0
    ? scopes
    : ['blog:read', 'blog:draft:write']

  const validScopes = ['blog:read', 'blog:draft:write', 'blog:publish', 'blog:schedule']
  for (const s of requestedScopes) {
    if (!validScopes.includes(s)) {
      return NextResponse.json(
        { error: `Invalid scope: "${s}". Allowed: ${validScopes.join(', ')}` },
        { status: 400 }
      )
    }
  }

  // Enforce token expiry presets (7, 14, 30, 90 days; default 30)
  const ALLOWED_EXPIRY_PRESETS = [7, 14, 30, 90] as const
  let effectiveExpiresDays = 30
  if (expiresDays !== undefined && expiresDays !== null) {
    if (
      typeof expiresDays !== 'number' ||
      !Number.isInteger(expiresDays) ||
      !ALLOWED_EXPIRY_PRESETS.includes(expiresDays as any)
    ) {
      return NextResponse.json(
        {
          error:
            'Bad Request: "expiresDays" must be one of the allowed presets: 7, 14, 30, or 90 days (defaults to 30).',
        },
        { status: 400 }
      )
    }
    effectiveExpiresDays = expiresDays
  }

  const { rawToken, tokenHash, tokenPrefix } = generateBlogApiToken()

  const d = new Date()
  d.setDate(d.getDate() + effectiveExpiresDays)
  const expiresAt = d.toISOString()

  const { data: tokenRow, error } = await supabaseAdmin
    .from('blog_api_tokens')
    .insert({
      name: name.trim(),
      token_prefix: tokenPrefix,
      token_hash: tokenHash,
      scopes: requestedScopes,
      is_revoked: false,
      expires_at: expiresAt,
      created_by: auth.actorId,
    })
    .select('id, name, token_prefix, scopes, expires_at, created_at')
    .single()

  if (error || !tokenRow) {
    return NextResponse.json({ error: error?.message || 'Failed to create token' }, { status: 500 })
  }

  await recordBlogAudit({
    actorType: auth.actorType,
    actorId: auth.actorId,
    operation: 'create_token',
    outcome: 'success',
    diffSummary: { tokenId: tokenRow.id, name: tokenRow.name, scopes: tokenRow.scopes },
  })

  // Return rawToken ONLY ONCE in this response. It is never stored or returned again!
  return NextResponse.json({
    success: true,
    token: {
      id: tokenRow.id,
      name: tokenRow.name,
      scopes: tokenRow.scopes,
      expiresAt: tokenRow.expires_at,
      tokenPrefix: tokenRow.token_prefix,
      rawToken, // Presented once
    },
    warning: 'Store this token safely. It will never be displayed again.',
  }, { status: 201 })
}
