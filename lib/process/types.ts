/**
 * Shewah — process definition types.
 *
 * These encode SOP.md as data rather than as scattered `if` statements, so
 * that one definition drives the UI (what to show next), the server (what to
 * allow), and the tests (what must hold).
 *
 * The rule that matters: a transition's guards live HERE, not in a component.
 * Before this, the only guard logic in the app was inside
 * app/orders/[id]/page.tsx — which meant the order detail screen was the only
 * place the process existed, and every other surface let you do anything.
 */

/** Who is attempting the transition. Mirrors lib/authz.ts Actor. */
export type ProcessActor = {
  role: string | null | undefined
  permissions?: string[] | null
  /** Set for portal users acting on their own records. */
  partnerId?: string | null
}

/**
 * A requirement that must hold before a transition is allowed.
 *
 * `field`  — the entity property must be present and non-empty.
 * `check`  — a named async check resolved by the caller (see AsyncChecks).
 *
 * `fixField` is what makes a blocker actionable: the UI focuses that input
 * instead of just saying "invalid". Defaults to `field` when omitted.
 */
export type Guard =
  | { field: string; message: string; fixField?: string }
  | { check: string; message: string; fixField?: string }

/** SLA target for a state, measured from when the entity entered it. */
export type SlaRule = {
  /** Target duration in hours. SOP §9.3 / §10.1. */
  hours: number
  /** Human label shown beside the countdown, e.g. "the 48h promise". */
  label?: string
  /**
   * Business hours only. The 48-hour CAD promise is stated in business days
   * (SOP §10.1), so a Friday brief is not breached over the weekend.
   */
  businessHoursOnly?: boolean
}

export type Transition = {
  from: string
  to: string
  /** Imperative, operator-facing. "Send CAD to partner", not "cad_sent". */
  label: string
  /** Roles permitted to make this move. SOP §9.2. */
  allowedRoles: string[]
  /** All must pass. Empty means unconditional. */
  requires?: Guard[]
  /**
   * Primary transitions are the suggested happy path and render as the single
   * main action. Non-primary ones (reject, cancel, fail) render smaller.
   */
  primary?: boolean
  /** Marks a corrective/negative path so the UI can style it as such. */
  variant?: 'default' | 'danger'
  /** Notification events fired on success. SOP §9.4. */
  notify?: string[]
  /** Longer explanation shown under the action when it needs context. */
  hint?: string
}

export type ProcessState = {
  id: string
  /** Operator-facing name. */
  label: string
  /** One line describing what is true when an entity sits here. */
  description?: string
  /** Who the process is waiting on — drives "waiting on partner" copy. */
  waitingOn?: 'us' | 'partner' | 'karigar' | 'nobody'
  sla?: SlaRule
  /** No outgoing transitions expected. */
  terminal?: boolean
}

export type ProcessDef = {
  /** Stable key, e.g. 'order'. Used in logs and the override audit trail. */
  key: string
  /** Entity column holding the current state. */
  statusField: string
  /** Column recording when the entity entered its current state, if any. */
  stateEnteredField?: string
  states: ProcessState[]
  transitions: Transition[]
}

/**
 * Results of async checks, resolved by the caller and passed into the engine.
 * Keeps the engine pure and synchronous so it can run identically on the
 * server (enforcement) and the client (display).
 *
 * A key that is absent is treated as NOT satisfied — fail closed, matching
 * lib/authz.ts. A missing check must never silently unlock a transition.
 */
export type AsyncChecks = Record<string, boolean>

export type Blocker = {
  message: string
  /** Field the UI should link to / focus so the operator can fix it. */
  fixField?: string
}

export type NextStep = {
  transition: Transition
  /** Empty when the step is ready to take. */
  blockers: Blocker[]
  /** False when the actor's role may not make this move at all. */
  permitted: boolean
}

export type SlaStatus = {
  /** Hours remaining; negative once breached. */
  hoursRemaining: number
  breached: boolean
  /** Under 20% of the window left, or already breached. */
  atRisk: boolean
  label?: string
  dueAt: Date
}
