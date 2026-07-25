import type {
  ProcessDef, ProcessState, Transition, Guard,
  ProcessActor, AsyncChecks, Blocker, NextStep, SlaStatus,
} from './types'

/**
 * The process engine.
 *
 * Pure and synchronous by design: the same call produces the same answer on
 * the server (where it enforces) and in the browser (where it displays). If
 * these two ever disagree, an operator sees an action that then fails — which
 * is worse than not offering it. Async work (material readiness) is resolved
 * by the caller and handed in as `AsyncChecks`.
 */

// ── Lookup ─────────────────────────────────────────────────────────────────

export function getState(def: ProcessDef, stateId: string | null | undefined): ProcessState | null {
  if (!stateId) return null
  return def.states.find(s => s.id === stateId) ?? null
}

export function transitionsFrom(def: ProcessDef, stateId: string | null | undefined): Transition[] {
  if (!stateId) return []
  return def.transitions.filter(t => t.from === stateId)
}

// ── Guards ─────────────────────────────────────────────────────────────────

/** A field counts as present unless it is null/undefined/empty/whitespace. */
function fieldPresent(entity: any, field: string): boolean {
  const v = entity?.[field]
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim().length > 0
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'number') return Number.isFinite(v)
  return true
}

function evaluateGuard(guard: Guard, entity: any, checks: AsyncChecks): Blocker | null {
  if ('field' in guard) {
    if (fieldPresent(entity, guard.field)) return null
    return { message: guard.message, fixField: guard.fixField ?? guard.field }
  }
  // Named async check. Absent === not satisfied: fail closed, so a caller that
  // forgets to resolve a check cannot accidentally unlock the transition.
  if (checks[guard.check] === true) return null
  return { message: guard.message, fixField: guard.fixField }
}

/** Every unmet requirement for a transition, in declaration order. */
export function blockers(
  transition: Transition,
  entity: any,
  checks: AsyncChecks = {},
): Blocker[] {
  const out: Blocker[] = []
  for (const g of transition.requires ?? []) {
    const b = evaluateGuard(g, entity, checks)
    if (b) out.push(b)
  }
  return out
}

export function roleAllowed(transition: Transition, actor: ProcessActor): boolean {
  if (!actor?.role) return false
  return transition.allowedRoles.includes(actor.role)
}

/**
 * The authorization answer for one transition.
 *
 * `override` reflects the confirmed policy: a `sub` user is blocked by unmet
 * requirements, while `master` may proceed with a typed reason that is
 * recorded. Role permission itself is never overridable — an override lets you
 * bypass an incomplete FORM, not an access boundary.
 */
export function canAdvance(
  def: ProcessDef,
  entity: any,
  toState: string,
  actor: ProcessActor,
  checks: AsyncChecks = {},
): { ok: true } | { ok: false; reason: 'unknown' | 'role' | 'blocked'; blockers: Blocker[]; overridable: boolean } {
  const current = entity?.[def.statusField]
  const transition = def.transitions.find(t => t.from === current && t.to === toState)

  if (!transition) {
    return { ok: false, reason: 'unknown', blockers: [], overridable: false }
  }
  if (!roleAllowed(transition, actor)) {
    return { ok: false, reason: 'role', blockers: [], overridable: false }
  }

  const bs = blockers(transition, entity, checks)
  if (bs.length > 0) {
    return { ok: false, reason: 'blocked', blockers: bs, overridable: actor.role === 'master' }
  }
  return { ok: true }
}

/**
 * Everything the operator could do from here, ready to render.
 *
 * Ordered so the UI can take the first entry as the single primary action:
 * ready-and-primary, then ready, then blocked, then not-permitted. Blocked
 * steps are returned rather than hidden — knowing WHY you cannot proceed is
 * the point.
 */
export function nextSteps(
  def: ProcessDef,
  entity: any,
  actor: ProcessActor,
  checks: AsyncChecks = {},
): NextStep[] {
  const current = entity?.[def.statusField]

  const steps = transitionsFrom(def, current).map<NextStep>(transition => ({
    transition,
    blockers: blockers(transition, entity, checks),
    permitted: roleAllowed(transition, actor),
  }))

  const rank = (s: NextStep) => {
    if (!s.permitted) return 3
    if (s.blockers.length > 0) return 2
    return s.transition.primary ? 0 : 1
  }
  return steps.sort((a, b) => rank(a) - rank(b))
}

// ── SLA ────────────────────────────────────────────────────────────────────

const MS_PER_HOUR = 3_600_000

/**
 * Hours between two instants, optionally counting business hours only.
 *
 * SOP §10.1 states the CAD promise in business days, so a Friday-evening brief
 * must not burn its window over the weekend. This counts Mon–Sat as working
 * days (Sunday off), matching a Surat workshop week.
 */
function elapsedHours(from: Date, to: Date, businessOnly: boolean): number {
  if (!businessOnly) return (to.getTime() - from.getTime()) / MS_PER_HOUR

  let hours = 0
  const cursor = new Date(from)
  while (cursor < to) {
    const next = new Date(Math.min(cursor.getTime() + MS_PER_HOUR, to.getTime()))
    // getUTCDay is stable regardless of server timezone; entries are stored UTC.
    if (cursor.getUTCDay() !== 0) hours += (next.getTime() - cursor.getTime()) / MS_PER_HOUR
    cursor.setTime(next.getTime())
  }
  return hours
}

/**
 * Where an entity stands against its state's SLA.
 * Returns null when the state has no SLA or no recorded entry time — never a
 * fabricated deadline.
 */
export function slaStatus(
  def: ProcessDef,
  entity: any,
  now: Date = new Date(),
): SlaStatus | null {
  const state = getState(def, entity?.[def.statusField])
  if (!state?.sla) return null

  const enteredRaw = def.stateEnteredField ? entity?.[def.stateEnteredField] : null
  if (!enteredRaw) return null

  const entered = new Date(enteredRaw)
  if (Number.isNaN(entered.getTime())) return null

  const businessOnly = !!state.sla.businessHoursOnly
  const used = elapsedHours(entered, now, businessOnly)
  const hoursRemaining = state.sla.hours - used

  // Project the due date forward. For business-hours SLAs this walks the
  // remaining budget over working days rather than adding wall-clock time.
  let dueAt: Date
  if (!businessOnly) {
    dueAt = new Date(entered.getTime() + state.sla.hours * MS_PER_HOUR)
  } else {
    const cursor = new Date(entered)
    let budget = state.sla.hours
    while (budget > 0) {
      cursor.setTime(cursor.getTime() + MS_PER_HOUR)
      if (cursor.getUTCDay() !== 0) budget -= 1
    }
    dueAt = cursor
  }

  return {
    hoursRemaining,
    breached: hoursRemaining < 0,
    atRisk: hoursRemaining < state.sla.hours * 0.2,
    label: state.sla.label,
    dueAt,
  }
}

/** "19h left" · "2d left" · "6h overdue". Compact enough for a phone. */
export function formatSlaRemaining(sla: SlaStatus): string {
  const h = Math.abs(Math.round(sla.hoursRemaining))
  const unit = h >= 48 ? `${Math.round(h / 24)}d` : `${h}h`
  return sla.breached ? `${unit} overdue` : `${unit} left`
}

// ── Integrity ──────────────────────────────────────────────────────────────

/**
 * Structural problems in a process definition. Used by tests so a dead-end
 * state or a typo'd target is caught here rather than by an operator who
 * cannot move an order forward.
 */
export function validateProcess(def: ProcessDef): string[] {
  const errors: string[] = []
  const ids = new Set(def.states.map(s => s.id))

  if (ids.size !== def.states.length) errors.push('duplicate state ids')

  for (const t of def.transitions) {
    if (!ids.has(t.from)) errors.push(`transition from unknown state "${t.from}"`)
    if (!ids.has(t.to)) errors.push(`transition to unknown state "${t.to}"`)
    if (t.allowedRoles.length === 0) errors.push(`transition ${t.from}→${t.to} permits no role`)
  }

  for (const s of def.states) {
    const outgoing = def.transitions.filter(t => t.from === s.id)
    if (!s.terminal && outgoing.length === 0) {
      errors.push(`non-terminal state "${s.id}" is a dead end`)
    }
    if (s.terminal && outgoing.length > 0) {
      errors.push(`terminal state "${s.id}" has outgoing transitions`)
    }
  }

  // Every non-initial state should be reachable from somewhere.
  const reachable = new Set(def.transitions.map(t => t.to))
  const initial = def.states[0]?.id
  for (const s of def.states) {
    if (s.id !== initial && !reachable.has(s.id)) {
      errors.push(`state "${s.id}" is unreachable`)
    }
  }

  return errors
}
