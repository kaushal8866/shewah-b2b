import { NextRequest, NextResponse } from 'next/server'
import { validateBlogApiAccess } from '@/lib/blog/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { recordBlogAudit } from '@/lib/blog/audit'

interface Params {
  params: {
    id: string
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const access = await validateBlogApiAccess(req, { requireOwner: true })
  if (!access.authorized || !access.auth) {
    return access.response!
  }
  const auth = access.auth

  const { data: updated, error } = await supabaseAdmin
    .from('blog_api_tokens')
    .update({
      is_revoked: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select('id, name, is_revoked')
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: 'Token not found or failed to revoke' }, { status: 404 })
  }

  await recordBlogAudit({
    actorType: auth.actorType,
    actorId: auth.actorId,
    operation: 'revoke_token',
    outcome: 'success',
    diffSummary: { tokenId: params.id },
  })

  return NextResponse.json({
    success: true,
    message: `Token "${updated.name}" has been revoked successfully.`,
  })
}
