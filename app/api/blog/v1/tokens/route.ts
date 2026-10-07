import { NextRequest, NextResponse } from 'next/server'
import { authenticateBlogRequest, generateBlogApiToken } from '@/lib/blog/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { recordBlogAudit } from '@/lib/blog/audit'

export async function GET(req: NextRequest) {
  const auth = await authenticateBlogRequest(req)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Token management is strictly owner authority
  if (!auth.isOwner && !auth.scopes.includes('blog:owner')) {
    return NextResponse.json(
      { error: 'Forbidden: Viewing credentials requires atelier owner authority.' },
      { status: 403 }
    )
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
  const auth = await authenticateBlogRequest(req)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Generating credentials is strictly owner authority
  if (!auth.isOwner && !auth.scopes.includes('blog:owner')) {
    return NextResponse.json(
      { error: 'Forbidden: Generating credentials requires atelier owner authority.' },
      { status: 403 }
    )
  }

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

  const { rawToken, tokenHash, tokenPrefix } = generateBlogApiToken()

  let expiresAt: string | null = null
  if (typeof expiresDays === 'number' && expiresDays > 0) {
    const d = new Date()
    d.setDate(d.getDate() + expiresDays)
    expiresAt = d.toISOString()
  }

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
