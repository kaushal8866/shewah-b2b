/**
 * Exhaustive paginated reads.
 *
 * PostgREST caps every unbounded `select()` at the project's `max-rows`
 * setting (Supabase defaults to 1000) and returns the truncated page WITHOUT
 * an error. Anything that sums or counts the result of such a query is
 * therefore silently wrong once the table passes that threshold — and it fails
 * quietly, in the direction of under-reporting.
 *
 * That affected real money: the P&L summed orders and cash transactions this
 * way, and float buckets replayed a karigar's whole material ledger to compute
 * the gold custody balance settlements are made against.
 *
 * This helper pages until the source is exhausted. It is a correctness fix,
 * not a performance one — the right long-term answer for aggregates is to sum
 * in Postgres via a view or RPC and return a single row. Use this for totals
 * that must be exact today; use SQL aggregation when the volume justifies it.
 */

/** Supabase's default max-rows. Pages smaller than this signal the end. */
const PAGE_SIZE = 1000

/** Refuse to spin forever if a query keeps returning full pages. */
const MAX_PAGES = 100

type PageResult<T> = { data: T[] | null; error: any }

/**
 * @param makePage called with an inclusive [from, to] row range; should apply
 *                 `.range(from, to)` to an otherwise-complete query.
 */
export async function fetchAllRows<T>(
  label: string,
  makePage: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const all: T[] = []

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE
    const { data, error } = await makePage(from, from + PAGE_SIZE - 1)

    if (error) {
      // Surface rather than silently returning a partial total.
      throw new Error(`[fetchAll:${label}] page ${page} failed: ${error.message || error}`)
    }
    if (!data || data.length === 0) break

    all.push(...data)

    // A short page means we reached the end.
    if (data.length < PAGE_SIZE) return all
  }

  console.error(
    `[fetchAll:${label}] hit the ${MAX_PAGES}-page ceiling (${all.length} rows). ` +
    `The total may be truncated — move this aggregate into SQL.`,
  )
  return all
}
