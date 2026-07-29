'use client'

import { AlertTriangle, ChevronRight, Clock, Lock } from 'lucide-react'
import type { NextStep, ProcessDef, SlaStatus } from '@/lib/process'
import { formatSlaRemaining, getState } from '@/lib/process'

/**
 * The next step, on the screen, always.
 *
 * The brief this answers: "for the smallest task like managing cad process I
 * feel lazy, instead WhatsApp feels easy." WhatsApp is easy because the next
 * thing to do is the thing in front of you. This app made you know the SOP,
 * find the right screen, and pick the right value out of a fourteen-item
 * dropdown.
 *
 * Two rules, both deliberate:
 *
 *  1. NO POPUPS, NO HOVER. The operator asked for guidance on the screen
 *     itself. Everything here is visible without interaction.
 *
 *  2. BLOCKED STEPS ARE SHOWN, NOT HIDDEN. A missing button teaches nothing —
 *     you are left wondering whether the app is broken or you are. A disabled
 *     button with "Quote total is not calculated yet" next to it tells you what
 *     to go and do. `nextSteps` already ranks blocked steps below unblocked
 *     ones for this reason.
 */

export interface NextStepRailProps {
  def: ProcessDef
  entity: any
  steps: NextStep[]
  /** Null when the state has no SLA, or when the clock cannot be trusted. */
  sla?: SlaStatus | null
  /** Fires the transition. The caller owns writing and any extra gates. */
  onAdvance: (toState: string, label: string) => void
  busy?: boolean
  /** Focus the named field — lets a blocker's "fix this" actually go there. */
  onFixField?: (field: string) => void
}

export default function NextStepRail({
  def, entity, steps, sla, onAdvance, busy, onFixField,
}: NextStepRailProps) {
  const state = getState(def, entity?.[def.statusField])

  const permitted = steps.filter(s => s.permitted)
  const primary = permitted.find(s => s.blockers.length === 0) ?? null
  const otherOpen = permitted.filter(s => s.blockers.length === 0 && s !== primary)
  const blocked = permitted.filter(s => s.blockers.length > 0)

  // A terminal state is a finished job, not a broken screen.
  if (state?.terminal) {
    return (
      <div className="bg-white border border-stone-200 rounded-2xl p-5">
        <p className="text-sm text-stone-600">
          <span className="font-medium text-stone-900">{state.label}.</span>{' '}
          {state.description ?? 'Nothing further to do here.'}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-stone-400 font-medium">
              Where this is
            </p>
            <p className="text-base font-medium text-stone-900 mt-0.5">
              {state?.label ?? entity?.[def.statusField] ?? 'Unknown'}
            </p>
            {state?.description && (
              <p className="text-sm text-stone-500 mt-1">{state.description}</p>
            )}
          </div>

          {sla && <SlaChip sla={sla} />}
        </div>

        {/* Who the ball is with. Removes the commonest question in a workshop:
            am I waiting on them, or are they waiting on me? */}
        {state?.waitingOn && state.waitingOn !== 'nobody' && (
          <p className="text-xs text-stone-500 mt-3">
            Waiting on{' '}
            <span className="font-medium text-stone-700">
              {state.waitingOn === 'us' ? 'you'
                : state.waitingOn === 'partner' ? 'the partner'
                : 'the karigar'}
            </span>
          </p>
        )}
      </div>

      <div className="border-t border-stone-100 px-5 py-4 space-y-3">
        {primary ? (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-stone-400 font-medium mb-2">
              Next step
            </p>
            <button
              onClick={() => onAdvance(primary.transition.to, primary.transition.label)}
              disabled={busy}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#1E3A5F] text-white
                         text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-[#162B47]
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {busy ? 'Working…' : primary.transition.label}
              {!busy && <ChevronRight className="w-4 h-4" />}
            </button>
            {primary.transition.hint && (
              <p className="text-xs text-stone-500 mt-2">{primary.transition.hint}</p>
            )}
          </div>
        ) : blocked.length > 0 ? (
          <p className="text-sm text-stone-600">
            Nothing can move yet — finish what is listed below.
          </p>
        ) : (
          <p className="text-sm text-stone-500">
            No further step is available to you from here.
          </p>
        )}

        {/* Blocked steps, with the reason. This is the part that replaces
            knowing the SOP by heart. */}
        {blocked.map(step => (
          <div
            key={`${step.transition.from}-${step.transition.to}`}
            className="border border-amber-200 bg-amber-50 rounded-xl p-3"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-amber-900">
                  Before “{step.transition.label}”
                </p>
                <ul className="mt-1 space-y-1">
                  {step.blockers.map((b, i) => (
                    <li key={i} className="text-sm text-amber-800">
                      {b.fixField && onFixField ? (
                        <button
                          onClick={() => onFixField(b.fixField!)}
                          className="text-left underline decoration-amber-400 underline-offset-2 hover:text-amber-900"
                        >
                          {b.message}
                        </button>
                      ) : (
                        b.message
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}

        {/* Legitimate alternatives — record a revision, cancel, mark abandoned.
            These are real parts of the SOP that previously happened in
            WhatsApp because the app had nowhere to put them. */}
        {otherOpen.length > 0 && (
          <div className="pt-1">
            <p className="text-[11px] uppercase tracking-wide text-stone-400 font-medium mb-2">
              Or
            </p>
            <div className="flex flex-wrap gap-2">
              {otherOpen.map(step => (
                <button
                  key={`${step.transition.from}-${step.transition.to}`}
                  onClick={() => onAdvance(step.transition.to, step.transition.label)}
                  disabled={busy}
                  className={
                    step.transition.variant === 'danger'
                      ? 'text-sm px-3 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50'
                      : 'text-sm px-3 py-2 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50 disabled:opacity-50'
                  }
                >
                  {step.transition.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Steps that exist but belong to someone else. Shown so the operator
            knows the path continues, rather than assuming a dead end. */}
        {steps.some(s => !s.permitted) && (
          <p className="text-xs text-stone-400 flex items-center gap-1.5 pt-1">
            <Lock className="w-3 h-3" />
            {steps.filter(s => !s.permitted).length} further step
            {steps.filter(s => !s.permitted).length === 1 ? '' : 's'} handled by another role
          </p>
        )}
      </div>
    </div>
  )
}

function SlaChip({ sla }: { sla: SlaStatus }) {
  const tone = sla.breached
    ? 'bg-red-50 text-red-700 border-red-200'
    : sla.atRisk
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-stone-50 text-stone-600 border-stone-200'

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${tone}`}>
      <Clock className="w-3 h-3" />
      {formatSlaRemaining(sla)}
      {sla.label ? ` · ${sla.label}` : ''}
    </span>
  )
}
