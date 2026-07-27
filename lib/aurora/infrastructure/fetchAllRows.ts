/**
 * Exhaustive, error-checked reads for the AURORA agents.
 *
 * Two problems this solves, both of which made the copilot state wrong numbers
 * with total confidence:
 *
 * 1. TRUNCATION. PostgREST caps an unbounded `select()` at the project's
 *    max-rows setting (Supabase defaults to 1000) and returns the short page
 *    WITHOUT an error. CIOAgent summed those results into revenue and
 *    outstanding-balance answers, so past 1000 rows the figure was silently
 *    low. A wrong number in a dashboard tile is bad; a wrong number in a
 *    fluent English sentence is worse, because nothing signals it is partial.
 *
 * 2. SWALLOWED ERRORS. The agent wrapped queries in try/catch, but supabase-js
 *    does not throw — it returns `{ data, error }`. `if (res.data)` therefore
 *    ignored every failure, which is how `from('enquiries')` (a table that does
 *    not exist) went unnoticed: the copilot simply answered from nothing.
 *
 * Returns `{ rows, error }` so callers can decide whether to answer at all.
 * Never throws — an agent degrading to "I could not read that" beats a 500.
 *
 * NOTE: lib/fetchAll.ts (arriving with the audit branch) does the same job for
 * the rest of the app. Collapse these into one once that lands.
 */

const PAGE_SIZE = 1000
const MAX_PAGES = 50

type PageResult<T> = { data: T[] | null; error: any }

export async function fetchAllRows<T = any>(
  label: string,
  makePage: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = []

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE

    let res: PageResult<T>
    try {
      res = await makePage(from, from + PAGE_SIZE - 1)
    } catch (thrown: any) {
      // Network-level failure rather than a Postgres error.
      console.error(`[aurora.fetchAllRows:${label}] request failed:`, thrown?.message || thrown)
      return { rows, error: thrown?.message || 'Request failed' }
    }

    if (res.error) {
      console.error(`[aurora.fetchAllRows:${label}] query error:`, res.error.message || res.error)
      return { rows, error: res.error.message || 'Query failed' }
    }

    const batch = res.data || []
    rows.push(...batch)

    // A short page means the source is exhausted.
    if (batch.length < PAGE_SIZE) return { rows, error: null }
  }

  console.error(
    `[aurora.fetchAllRows:${label}] hit the ${MAX_PAGES}-page ceiling ` +
    `(${rows.length} rows) — totals may be partial. Move this aggregate into SQL.`,
  )
  return { rows, error: null }
}
