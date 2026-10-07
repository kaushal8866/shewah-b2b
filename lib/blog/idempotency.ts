import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export interface IdempotencyCheckResult {
  isDuplicate: boolean
  cachedResponse?: {
    status: number
    body: any
  }
  isConflict: boolean
}

/**
 * Check if a mutation request was already executed with this idempotency key.
 */
export async function checkIdempotency(
  idempotencyKey: string,
  actorId: string,
  operation: string,
  payload: any
): Promise<IdempotencyCheckResult> {
  const payloadHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(payload ?? {}), 'utf8')
    .digest('hex')

  const { data: record } = await supabaseAdmin
    .from('blog_idempotency_records')
    .select('payload_hash, response_status, response_body')
    .eq('idempotency_key', idempotencyKey)
    .eq('actor_id', actorId)
    .eq('operation', operation)
    .maybeSingle()

  if (!record) {
    return { isDuplicate: false, isConflict: false }
  }

  // Same key + same payload: safe replay of previous execution
  if (record.payload_hash === payloadHash) {
    return {
      isDuplicate: true,
      isConflict: false,
      cachedResponse: {
        status: record.response_status,
        body: record.response_body,
      },
    }
  }

  // Same key + different payload: 409 Conflict
  return {
    isDuplicate: true,
    isConflict: true,
  }
}

/**
 * Save mutation result to the idempotency store.
 */
export async function saveIdempotencyRecord(
  idempotencyKey: string,
  actorId: string,
  operation: string,
  payload: any,
  status: number,
  responseBody: any
): Promise<void> {
  try {
    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(payload ?? {}), 'utf8')
      .digest('hex')

    await supabaseAdmin.from('blog_idempotency_records').upsert(
      {
        idempotency_key: idempotencyKey,
        actor_id: actorId,
        operation,
        payload_hash: payloadHash,
        response_status: status,
        response_body: responseBody,
      },
      { onConflict: 'idempotency_key,actor_id,operation' }
    )
  } catch (err: any) {
    console.error('[blog:idempotency] Failed to persist idempotency record:', err?.message || err)
  }
}
