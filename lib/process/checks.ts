import type { AsyncChecks } from './types'

/**
 * Resolvers for the `check` guards in the flow definitions.
 *
 * The engine deliberately does not own these: `evaluateGuard` looks a name up
 * in a caller-supplied map and treats an absent key as unsatisfied (fail
 * closed). That is the right design, but it means every call site had to
 * hand-roll the map — and the one that existed got a guard wrong in a way that
 * silently bricked part of the pipeline. Hence one shared resolver.
 *
 * THE BUG THIS FIXES
 *
 * `hasCadRender` was resolved as `order.cad_images?.length > 0`. There is no
 * `cad_images` column on `orders` — it appears in no migration and no schema
 * file. So the expression was always `undefined > 0`, i.e. always false, and
 * the `cad_in_progress -> cad_sent` transition could never be taken from the
 * order screen. Every state downstream of it was unreachable too.
 *
 * Renders actually live on `cad_requests.render_images` (and on the
 * `cad_revisions` rows beneath it), so answering the question requires a join
 * the previous call site never made.
 */

/** Everything the order checks need, fetched once by the caller. */
export interface OrderCheckContext {
  order: any
  /** cad_requests rows linked to this order, with render_images. */
  cadRequests?: Array<{ render_images?: string[] | null; cad_files?: string[] | null }> | null
  /** Whether a gold consumption transaction exists for this order. */
  hasConsumptionTxn?: boolean
  /** Result of the async material readiness probe; undefined means not yet run. */
  materialReady?: boolean
}

/**
 * Build the check map for an order.
 *
 * Unknown or not-yet-fetched checks are deliberately omitted rather than
 * defaulted to true. An omitted key blocks the transition and shows the
 * operator the reason; a `true` default lets it through on no evidence, which
 * is how the money gate went missing in the first place.
 */
export function orderChecks(ctx: OrderCheckContext): AsyncChecks {
  const { order } = ctx

  const renders = (ctx.cadRequests ?? []).reduce(
    (n, r) => n + (r?.render_images?.length ?? 0) + (r?.cad_files?.length ?? 0),
    0,
  )

  const checks: AsyncChecks = {
    // SOP §9.2 — money must land before production. Reads the recorded advance,
    // not an invoice, because payment state lives on the order.
    advancePaid: (parseFloat(order?.advance_paid) || 0) > 0,

    // Joined from cad_requests. See the note above on why this is not
    // order.cad_images.
    hasCadRender: renders > 0,

    qcChecklistComplete: !!order?.qc_checklist,
  }

  // Only assert material readiness when it has actually been measured. Left
  // absent, the guard blocks and says so — which is honest. Hard-coding true
  // (the previous behaviour) let a piece enter production with no gold issued.
  if (typeof ctx.materialReady === 'boolean') {
    checks.materialReady = ctx.materialReady
  }

  return checks
}

/** Checks for a CAD request. `hasRenders` mirrors the order-side join. */
export function cadChecks(cadRequest: any): AsyncChecks {
  const renders = (cadRequest?.render_images?.length ?? 0) + (cadRequest?.cad_files?.length ?? 0)
  return {
    // cadFlow points fixField at `reference_images`, which is the customer's
    // input, not our output. The check itself reads render_images.
    hasRenders: renders > 0,
  }
}

/**
 * Should SLA badges be shown for this entity?
 *
 * `migrate_sop_state_machine.sql` backfilled `status_changed_at` for existing
 * orders and set `sop_migrated` to mark them. Those timestamps are the
 * migration's clock, not the real one, so every historic order would render as
 * catastrophically breached — the migration comment warns about exactly this.
 * Suppress the badge rather than show a number that is certainly wrong.
 */
export function slaTrustworthy(entity: any): boolean {
  if (!entity) return false
  if (entity.sop_migrated) return false
  return !!entity.status_changed_at
}
