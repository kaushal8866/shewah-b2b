import { describe, it, expect } from 'vitest'
import {
  nextSteps, canAdvance, blockers, slaStatus, validateProcess,
  formatSlaRemaining, transitionsFrom, getState,
} from '../process/engine'
import { orderFlow } from '../process/orderFlow'
import { cadFlow } from '../process/cadFlow'
import { mfgFlow } from '../process/mfgFlow'
import { PROCESSES, getProcess } from '../process'
import { ritualsForRole, visibleRituals, DAILY_RITUALS } from '../process/rituals'

const master = { role: 'master' }
const sub = { role: 'sub' }
const retailer = { role: 'retailer' }

describe('process definitions are structurally sound', () => {
  // Catches dead ends and typo'd targets here rather than leaving an operator
  // unable to move an order forward.
  it('orderFlow has no structural errors', () => {
    expect(validateProcess(orderFlow)).toEqual([])
  })

  it('cadFlow has no structural errors', () => {
    expect(validateProcess(cadFlow)).toEqual([])
  })

  it('detects a dead-end state', () => {
    const broken = {
      ...orderFlow,
      states: [...orderFlow.states, { id: 'orphan', label: 'Orphan' }],
    }
    expect(validateProcess(broken).join(' ')).toContain('orphan')
  })

  it('detects a transition to a state that does not exist', () => {
    const broken = {
      ...cadFlow,
      transitions: [...cadFlow.transitions,
        { from: 'pending', to: 'nowhere', label: 'x', allowedRoles: ['master'] }],
    }
    expect(validateProcess(broken).join(' ')).toContain('nowhere')
  })
})

describe('the money gate that did not exist before', () => {
  // The whole point of aligning to SOP §9: production cannot start unpaid.
  it('blocks production until an advance is recorded', () => {
    const order = { status: 'quote_issued', total_amount: 50000 }
    const v = canAdvance(orderFlow, order, 'advance_received', master, { advancePaid: false })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.blockers[0].message).toMatch(/advance payment/i)
  })

  it('allows it once the advance is reconciled', () => {
    const order = { status: 'quote_issued', total_amount: 50000 }
    expect(canAdvance(orderFlow, order, 'advance_received', master, { advancePaid: true }).ok).toBe(true)
  })

  it('offers no path from quote straight to production', () => {
    const targets = transitionsFrom(orderFlow, 'quote_issued').map(t => t.to)
    expect(targets).not.toContain('production')
    expect(targets).toContain('advance_received')
  })
})

describe('guards', () => {
  const readyForProduction = {
    status: 'advance_received',
    gold_weight_estimated: 4.2,
    assigned_manufacturer_id: 'k-1',
  }

  it('reports every unmet requirement, not just the first', () => {
    const t = orderFlow.transitions.find(x => x.from === 'advance_received' && x.to === 'production')!
    const bs = blockers(t, { status: 'advance_received' }, { materialReady: false })
    expect(bs).toHaveLength(3)
  })

  it('gives each blocker a field to fix', () => {
    const t = orderFlow.transitions.find(x => x.from === 'qc_passed' && x.to === 'dispatched')!
    const bs = blockers(t, { status: 'qc_passed' }, {})
    expect(bs.map(b => b.fixField)).toEqual(['tracking_number', 'courier'])
  })

  it('treats empty strings and whitespace as missing', () => {
    const t = orderFlow.transitions.find(x => x.from === 'qc_passed' && x.to === 'dispatched')!
    expect(blockers(t, { tracking_number: '   ', courier: '' }, {})).toHaveLength(2)
    expect(blockers(t, { tracking_number: 'SEQ123', courier: 'Sequel' }, {})).toHaveLength(0)
  })

  it('treats a zero number as present but null as missing', () => {
    const t = orderFlow.transitions.find(x => x.from === 'production' && x.to === 'hallmarking')!
    expect(blockers(t, { gold_weight_actual: 4.2, making_charges: 0 }, {})).toHaveLength(0)
    expect(blockers(t, { gold_weight_actual: 4.2, making_charges: null }, {})).toHaveLength(1)
  })

  it('fails closed when an async check was never resolved', () => {
    // A caller that forgets to run a check must not accidentally unlock the step.
    const v = canAdvance(orderFlow, readyForProduction, 'production', master, {})
    expect(v.ok).toBe(false)
  })

  it('passes once every requirement is met', () => {
    const v = canAdvance(orderFlow, readyForProduction, 'production', master, { materialReady: true })
    expect(v.ok).toBe(true)
  })
})

describe('roles', () => {
  it('lets only the owner pass or fail QC', () => {
    const order = { status: 'qc', hallmark_number: 'BIS123' }
    expect(canAdvance(orderFlow, order, 'qc_passed', sub, { qcChecklistComplete: true }).ok).toBe(false)
    expect(canAdvance(orderFlow, order, 'qc_passed', master, { qcChecklistComplete: true }).ok).toBe(true)
  })

  it('lets a partner approve their own CAD', () => {
    expect(canAdvance(cadFlow, { status: 'sent' }, 'approved', retailer).ok).toBe(true)
  })

  it('does not let a partner assign a designer', () => {
    const v = canAdvance(cadFlow, { status: 'pending', due_date: '2026-08-01' }, 'in_progress', retailer)
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toBe('role')
  })

  it('never makes a role denial overridable', () => {
    // An override bypasses an incomplete form, never an access boundary.
    const v = canAdvance(orderFlow, { status: 'qc' }, 'qc_passed', sub, { qcChecklistComplete: true })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.overridable).toBe(false)
  })

  it('makes a blocked step overridable for the owner only', () => {
    const order = { status: 'qc_passed' }
    const asSub = canAdvance(orderFlow, order, 'dispatched', sub)
    const asMaster = canAdvance(orderFlow, order, 'dispatched', master)
    expect(asSub.ok).toBe(false)
    expect(asMaster.ok).toBe(false)
    if (!asSub.ok) expect(asSub.overridable).toBe(false)
    if (!asMaster.ok) expect(asMaster.overridable).toBe(true)
  })

  it('rejects a transition that does not exist from here', () => {
    const v = canAdvance(orderFlow, { status: 'draft' }, 'delivered', master)
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toBe('unknown')
  })
})

describe('nextSteps ordering', () => {
  it('puts the ready primary action first so the UI can take [0]', () => {
    const steps = nextSteps(cadFlow, { status: 'pending', due_date: '2026-08-01' }, master)
    expect(steps[0].transition.to).toBe('in_progress')
    expect(steps[0].blockers).toHaveLength(0)
  })

  it('ranks blocked steps below ready ones but still returns them', () => {
    // Knowing WHY you cannot proceed is the point — never hide it.
    const steps = nextSteps(cadFlow, { status: 'in_progress' }, master, { hasRenders: false })
    const send = steps.find(s => s.transition.to === 'sent')!
    expect(send.blockers).toHaveLength(1)
    expect(steps.indexOf(send)).toBeGreaterThan(-1)
  })

  it('marks steps the actor may not take', () => {
    const steps = nextSteps(orderFlow, { status: 'qc' }, sub)
    expect(steps.every(s => !s.permitted)).toBe(true)
  })

  it('returns nothing from a terminal state', () => {
    expect(nextSteps(orderFlow, { status: 'closed' }, master)).toHaveLength(0)
  })
})

describe('SLA clocks', () => {
  const HOUR = 3_600_000

  it('counts down the 48h CAD promise', () => {
    const entered = new Date('2026-07-20T04:00:00Z') // Monday
    const now = new Date(entered.getTime() + 10 * HOUR)
    const sla = slaStatus(cadFlow, { status: 'pending', status_changed_at: entered.toISOString() }, now)!
    expect(sla.hoursRemaining).toBeCloseTo(38, 0)
    expect(sla.breached).toBe(false)
    expect(sla.label).toBe('the 48h promise')
  })

  it('flags a breach', () => {
    const entered = new Date('2026-07-20T04:00:00Z')
    const now = new Date(entered.getTime() + 60 * HOUR)
    const sla = slaStatus(cadFlow, { status: 'pending', status_changed_at: entered.toISOString() }, now)!
    expect(sla.breached).toBe(true)
    expect(formatSlaRemaining(sla)).toMatch(/overdue/)
  })

  it('does not burn the promise over a Sunday', () => {
    // SOP §10.1 states the promise in business days. A Saturday brief must not
    // lose its window to the weekend.
    const sat = new Date('2026-07-25T04:00:00Z')       // Saturday
    const monday = new Date('2026-07-27T04:00:00Z')    // +48 wall-clock hours
    const sla = slaStatus(cadFlow, { status: 'pending', status_changed_at: sat.toISOString() }, monday)!
    expect(sla.breached).toBe(false)
    expect(sla.hoursRemaining).toBeGreaterThan(20)
  })

  it('counts continuously for SLAs that are not business-hours', () => {
    // Partner review is wall-clock — they can reply on a Sunday.
    const entered = new Date('2026-07-25T04:00:00Z')
    const now = new Date(entered.getTime() + 73 * HOUR)
    const sla = slaStatus(cadFlow, { status: 'sent', status_changed_at: entered.toISOString() }, now)!
    expect(sla.breached).toBe(true)
  })

  it('flags at-risk before breaching', () => {
    const entered = new Date('2026-07-20T04:00:00Z')
    const now = new Date(entered.getTime() + 65 * HOUR)  // 72h SLA, 7h left
    const sla = slaStatus(orderFlow, { status: 'cad_sent', status_changed_at: entered.toISOString() }, now)!
    expect(sla.breached).toBe(false)
    expect(sla.atRisk).toBe(true)
  })

  it('returns null rather than inventing a deadline', () => {
    // No entry timestamp and no SLA on the state must both yield nothing.
    expect(slaStatus(orderFlow, { status: 'cad_sent' })).toBeNull()
    expect(slaStatus(orderFlow, { status: 'cad_approved', status_changed_at: new Date().toISOString() })).toBeNull()
  })

  it('formats compactly for a phone', () => {
    const entered = new Date('2026-07-20T04:00:00Z')
    const sla = slaStatus(orderFlow, {
      status: 'production', status_changed_at: entered.toISOString(),
    }, new Date(entered.getTime() + 24 * HOUR))!
    expect(formatSlaRemaining(sla)).toMatch(/^\d+d left$/)
  })
})

describe('states carry the copy the rail needs', () => {
  it('says who each active state is waiting on', () => {
    expect(getState(orderFlow, 'cad_sent')?.waitingOn).toBe('partner')
    expect(getState(orderFlow, 'production')?.waitingOn).toBe('karigar')
    expect(getState(orderFlow, 'brief_received')?.waitingOn).toBe('us')
  })

  it('labels every transition as an imperative action', () => {
    // "Send CAD to partner", never "cad_sent" — the rail shows these verbatim.
    for (const t of [...orderFlow.transitions, ...cadFlow.transitions]) {
      expect(t.label[0]).toBe(t.label[0].toUpperCase())
      expect(t.label).not.toMatch(/_/)
    }
  })

  it('gives every state a human label', () => {
    for (const s of [...orderFlow.states, ...cadFlow.states]) {
      expect(s.label.length).toBeGreaterThan(0)
      expect(s.label).not.toMatch(/_/)
    }
  })
})

describe('mfgFlow', () => {
  it('is structurally sound', () => {
    expect(validateProcess(mfgFlow)).toEqual([])
  })

  it('will not complete a job without the finished weight', () => {
    // SOP §12.2 — the actual weight settles the karigar gold ledger, so it
    // cannot be filled in later from memory.
    const job = { status: 'in_progress' }
    const v = canAdvance(mfgFlow, job, 'completed', { role: 'master' })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.blockers[0].fixField).toBe('gold_weight_actual')

    expect(canAdvance(mfgFlow, { status: 'in_progress', gold_weight_actual: 4.1 }, 'completed', { role: 'master' }).ok).toBe(true)
  })

  it('lets the karigar move their own job forward', () => {
    // The manufacturer portal has no navigation today, so everything routes
    // through the owner on WhatsApp. This is what unblocks self-serve.
    const karigar = { role: 'manufacturer' }
    expect(canAdvance(mfgFlow, { status: 'issued' }, 'in_progress', karigar).ok).toBe(true)
    expect(canAdvance(mfgFlow, { status: 'in_progress', gold_weight_actual: 4 }, 'completed', karigar).ok).toBe(true)
  })

  it('does not let the karigar cancel a job', () => {
    const v = canAdvance(mfgFlow, { status: 'issued' }, 'cancelled', { role: 'manufacturer' })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toBe('role')
  })

  it('keeps a cancelled job open until material comes back', () => {
    // Otherwise the karigar float stays overstated and reconciliation never
    // balances.
    expect(getState(mfgFlow, 'cancelled')?.terminal).toBeFalsy()
    const v = canAdvance(mfgFlow, { status: 'cancelled' }, 'received_after_cancel', { role: 'master' }, { materialReturned: false })
    expect(v.ok).toBe(false)
  })
})

describe('process registry', () => {
  it('registers every flow under its own key', () => {
    expect(Object.keys(PROCESSES).sort()).toEqual(['cad', 'mfg_order', 'order'])
    expect(getProcess('order')).toBe(orderFlow)
  })

  it('fails closed on an unknown key', () => {
    expect(getProcess('nope')).toBeNull()
  })
})

describe('daily rituals (SOP §16)', () => {
  it('gives the owner their morning checks', () => {
    const ids = ritualsForRole('master').map(r => r.id)
    expect(ids).toContain('gold_rate_today')
    expect(ids).toContain('cad_overdue')
    expect(ids).toContain('approvals_pending')
  })

  it('does not show a rep the owner-only approval queue', () => {
    const ids = ritualsForRole('sub').map(r => r.id)
    expect(ids).not.toContain('approvals_pending')
    expect(ids).not.toContain('gold_rate_today')
    expect(ids).toContain('hot_partners_stale')
  })

  it('sorts overdue work above routine work', () => {
    const r = ritualsForRole('master')
    const firstRoutine = r.findIndex(x => x.urgency === 'routine')
    const lastOverdue = r.map(x => x.urgency).lastIndexOf('overdue')
    expect(lastOverdue).toBeLessThan(firstRoutine)
  })

  it('hides rows with nothing to do', () => {
    // An empty list has to be trustworthy, or nobody opens it twice.
    const visible = visibleRituals('sub', {})
    expect(visible.every(v => v.count > 0 || v.showWhenZero)).toBe(true)
    expect(visible.map(v => v.id)).not.toContain('cad_overdue')
  })

  it('still shows the gold rate when nothing is locked', () => {
    // Absence is the signal here: every quote before it uses yesterday's rate.
    const visible = visibleRituals('master', {})
    expect(visible.map(v => v.id)).toContain('gold_rate_today')
  })

  it('counts into the label', () => {
    const visible = visibleRituals('master', { cad_overdue: 3 })
    const cad = visible.find(v => v.id === 'cad_overdue')!
    expect(cad.label(cad.count)).toBe('3 CAD requests are overdue')
  })

  it('reads naturally at a count of one', () => {
    const one = DAILY_RITUALS.find(r => r.id === 'cad_overdue')!
    expect(one.label(1)).toBe('1 CAD request is overdue')
  })

  it('cites the SOP section for every ritual', () => {
    for (const r of DAILY_RITUALS) expect(r.sopRef).toMatch(/§/)
  })
})
