// Strips Postgres / PostgREST internals (column names, table names, constraint
// names, hints) from raw DB error objects so we can return safe messages to
// public-facing portal users (manufacturers, retailers, share-link visitors).
//
// We never want to leak schema details like "column foo.bar_baz does not exist"
// to an external caller — those messages reveal table layout and help an
// attacker map the DB. Master / sub-admin endpoints can still pass through
// detailed errors for engineering visibility.

type AnyDbError = {
  message?: string
  code?: string
  details?: string | null
  hint?: string | null
} | null | undefined

const FRIENDLY_BY_CODE: Record<string, string> = {
  '23505': 'That value is already in use.',
  '23503': 'This action conflicts with related records.',
  '23502': 'A required field is missing.',
  '23514': 'One of the values is not allowed.',
  '22P02': 'Invalid value supplied.',
  '42703': 'This feature is temporarily unavailable. Please contact support.', // undefined column
  '42P01': 'This feature is temporarily unavailable. Please contact support.', // undefined table
  '42501': 'You do not have permission to perform this action.',
  'PGRST116': 'No matching record found.',
}

const SCHEMA_LEAK_PATTERNS = [
  /column\s+[^\s]+\s+does not exist/i,
  /relation\s+["']?[^\s"']+["']?\s+does not exist/i,
  /constraint\s+["']?[^\s"']+["']?/i,
  /violates\s+(foreign key|not-null|check|unique)\s+constraint/i,
  /duplicate key value violates unique constraint/i,
  /could not find the\s+["']?[^\s"']+["']?\s+(column|table|relation)/i,
]

function looksLikeSchemaLeak(msg: string): boolean {
  return SCHEMA_LEAK_PATTERNS.some(p => p.test(msg))
}

/**
 * Convert a raw DB error into a message safe to show externally.
 * - Known SQLSTATE codes get a friendly fixed message.
 * - Anything that looks like a schema-leak gets a generic fallback.
 * - Everything else returns a generic "Something went wrong" rather than
 *   the raw text.
 *
 * @param err   - The error object from supabase-js / pg.
 * @param fallback - A context-specific generic message to use when nothing
 *                   else applies (e.g. "Could not load orders").
 */
export function sanitizeDbError(err: AnyDbError, fallback = 'Something went wrong. Please try again.'): string {
  if (!err) return fallback

  // 1. Known SQLSTATE → friendly message
  const code = (err.code || '').toString()
  if (code && FRIENDLY_BY_CODE[code]) return FRIENDLY_BY_CODE[code]

  // 2. Anything that looks like a schema leak → generic
  const raw = (err.message || '').toString()
  if (raw && looksLikeSchemaLeak(raw)) return fallback

  // 3. Empty / missing message → fallback
  if (!raw.trim()) return fallback

  // 4. Default — never echo back the raw DB message; use the fallback.
  //    This is intentional: even non-schema errors from supabase-js can
  //    contain hints / details / SQL fragments that we'd rather not expose
  //    to external users. Engineering can still see the real error in
  //    server logs (callers should `console.error` the original).
  return fallback
}

/**
 * Convenience helper for the very common pattern:
 *   if (error) return NextResponse.json({ error: ... }, { status: 500 })
 *
 * Logs the real error server-side and returns the sanitised text.
 */
export function safeDbError(err: AnyDbError, context: string, fallback?: string): string {
  if (err) {
    // eslint-disable-next-line no-console
    console.error(`[db-error] ${context}:`, err.code || '', err.message || err, (err as any).cause || '')
  }
  return sanitizeDbError(err, fallback)
}
