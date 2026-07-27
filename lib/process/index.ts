/**
 * The process layer — SOP.md, encoded.
 *
 * One definition drives three things that used to disagree:
 *   • what the UI offers next   (components/process/NextStepRail)
 *   • what the server permits   (transition endpoints)
 *   • what the tests assert     (lib/__tests__/process.test.ts)
 *
 * Import flows from here so call sites never reach past the barrel.
 */

export * from './types'
export * from './engine'
export { orderFlow } from './orderFlow'
export { cadFlow } from './cadFlow'
export { mfgFlow } from './mfgFlow'
export { DAILY_RITUALS, ritualsForRole, visibleRituals } from './rituals'
export type { RitualItem, RitualUrgency } from './rituals'

import { orderFlow } from './orderFlow'
import { cadFlow } from './cadFlow'
import { mfgFlow } from './mfgFlow'
import type { ProcessDef } from './types'

/** Every flow, keyed by ProcessDef.key. Used by the transition endpoint. */
export const PROCESSES: Record<string, ProcessDef> = {
  [orderFlow.key]: orderFlow,
  [cadFlow.key]: cadFlow,
  [mfgFlow.key]: mfgFlow,
}

/** Fail closed: an unknown process key resolves to nothing. */
export function getProcess(key: string): ProcessDef | null {
  return PROCESSES[key] ?? null
}
