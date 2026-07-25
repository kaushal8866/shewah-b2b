/**
 * Daily rituals — SOP.md §16.
 *
 * §16.1 defines a 15-minute owner morning with five concrete checks; §16.2 a
 * 10-minute rep morning with three. None of them appear anywhere in the app
 * today — the dashboard shows counts and revenue, which answers "how are we
 * doing" but never "what do I do now".
 *
 * These definitions declare WHAT to look for and how urgent it is. The
 * queries live server-side in /api/today; keeping them apart means the list a
 * user sees is auditable against the SOP without reading SQL.
 */

export type RitualUrgency = 'overdue' | 'due' | 'routine'

export type RitualItem = {
  /** Stable key — also the query name implemented by /api/today. */
  id: string
  /** Imperative and countable: "3 CAD requests are overdue". */
  label: (count: number) => string
  /** Shown when the count is zero and the row disappears. */
  sopRef: string
  /** Roles this belongs to. A rep never sees the owner's approval queue. */
  roles: string[]
  urgency: RitualUrgency
  /** Where tapping the row goes — pre-filtered to exactly this work. */
  href: string
  /**
   * True when the item should show even at zero, because absence is itself
   * the signal. Locking the gold rate is the example: "0 rates locked today"
   * is the most important thing on the screen.
   */
  showWhenZero?: boolean
}

export const DAILY_RITUALS: RitualItem[] = [
  // ── Owner morning — SOP §16.1 ────────────────────────────────────────────
  {
    id: 'gold_rate_today',
    label: () => "Lock today's gold rate",
    sopRef: '§16.1.1',
    roles: ['master'],
    urgency: 'overdue',
    href: '/gold-rates',
    // Every quote issued before this uses yesterday's rate.
    showWhenZero: true,
  },
  {
    id: 'cad_overdue',
    label: n => `${n} CAD ${n === 1 ? 'request is' : 'requests are'} overdue`,
    sopRef: '§16.1.2',
    roles: ['master', 'sub'],
    urgency: 'overdue',
    href: '/cad-requests?filter=overdue',
  },
  {
    id: 'dispatch_unconfirmed',
    label: n => `${n} ${n === 1 ? 'dispatch has' : 'dispatches have'} no delivery confirmation`,
    sopRef: '§16.1.3',
    roles: ['master', 'sub'],
    urgency: 'due',
    href: '/orders?status=dispatched',
  },
  {
    id: 'approvals_pending',
    label: n => `${n} ${n === 1 ? 'approval is' : 'approvals are'} waiting on you`,
    sopRef: '§16.1.4 · §2.4',
    roles: ['master'],
    urgency: 'due',
    href: '/order-change-requests?status=pending',
  },

  // ── Rep morning — SOP §16.2 ──────────────────────────────────────────────
  {
    id: 'circuit_today',
    label: n => `${n} ${n === 1 ? 'visit' : 'visits'} scheduled today`,
    sopRef: '§16.2.1',
    roles: ['master', 'sub'],
    urgency: 'due',
    href: '/circuits',
  },
  {
    id: 'hot_partners_stale',
    label: n => `${n} hot ${n === 1 ? 'partner has' : 'partners have'} had no contact in 5+ days`,
    sopRef: '§16.2.2 · §11.2',
    roles: ['master', 'sub'],
    urgency: 'due',
    href: '/partners?status=hot&stale=true',
  },
  {
    id: 'production_no_update',
    label: n => `${n} ${n === 1 ? 'order' : 'orders'} in production with no recent karigar update`,
    sopRef: '§16.2.3',
    roles: ['master', 'sub'],
    urgency: 'routine',
    href: '/manufacturing',
  },

  // ── Weekly, surfaced daily once breached — SOP §16.4 ─────────────────────
  {
    id: 'orders_stuck',
    label: n => `${n} ${n === 1 ? 'order has' : 'orders have'} not moved in 2 weeks`,
    sopRef: '§16.4',
    roles: ['master'],
    urgency: 'overdue',
    href: '/orders?filter=stuck',
  },
  {
    id: 'partners_dormant',
    label: n => `${n} ${n === 1 ? 'partner needs' : 'partners need'} a dormancy decision`,
    sopRef: '§11.4',
    roles: ['master'],
    urgency: 'routine',
    href: '/partners?filter=dormant',
  },
]

/** The rituals a given role is responsible for, most urgent first. */
export function ritualsForRole(role: string | null | undefined): RitualItem[] {
  if (!role) return []
  const rank: Record<RitualUrgency, number> = { overdue: 0, due: 1, routine: 2 }
  return DAILY_RITUALS
    .filter(r => r.roles.includes(role))
    .sort((a, b) => rank[a.urgency] - rank[b.urgency])
}

/**
 * Decide what actually renders, given live counts.
 *
 * A row with nothing to do disappears — that is what makes an empty list
 * trustworthy enough to open every morning. The exception is `showWhenZero`,
 * where nothing having happened IS the thing to act on.
 */
export function visibleRituals(
  role: string | null | undefined,
  counts: Record<string, number>,
): Array<RitualItem & { count: number }> {
  return ritualsForRole(role)
    .map(r => ({ ...r, count: counts[r.id] ?? 0 }))
    .filter(r => r.count > 0 || r.showWhenZero)
}
