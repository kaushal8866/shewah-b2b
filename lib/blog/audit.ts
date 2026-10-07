import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ActorType, AuditOperation, AuditOutcome, BlogAuditLog } from './types'

export interface RecordAuditOptions {
  articleId?: string | null
  revisionId?: string | null
  actorType: ActorType
  actorId: string // Never log raw tokens or passwords!
  operation: AuditOperation
  outcome: AuditOutcome
  requestId?: string | null
  idempotencyKey?: string | null
  payloadHash?: string | null
  diffSummary?: Record<string, any> | null
  errorMessage?: string | null
}

/**
 * Record a durable audit log entry. Fails gracefully so logging errors never crash the user operation.
 */
export async function recordBlogAudit(opts: RecordAuditOptions): Promise<void> {
  try {
    // Sanitize actor ID: if a token was accidentally passed, truncate and mask
    let safeActorId = opts.actorId
    if (safeActorId.startsWith('shw_blog_') && safeActorId.length > 16) {
      safeActorId = `${safeActorId.slice(0, 12)}...`
    }

    const { error } = await supabaseAdmin.from('blog_audit_logs').insert({
      article_id: opts.articleId ?? null,
      revision_id: opts.revisionId ?? null,
      actor_type: opts.actorType,
      actor_id: safeActorId,
      operation: opts.operation,
      outcome: opts.outcome,
      request_id: opts.requestId ?? null,
      idempotency_key: opts.idempotencyKey ?? null,
      payload_hash: opts.payloadHash ?? null,
      diff_summary: opts.diffSummary ?? null,
      error_message: opts.errorMessage ? opts.errorMessage.slice(0, 1000) : null,
    })

    if (error) {
      console.error('[blog:audit] Database write error:', error.message)
    }
  } catch (err: any) {
    console.error('[blog:audit] Critical exception while recording audit:', err?.message || err)
  }
}
