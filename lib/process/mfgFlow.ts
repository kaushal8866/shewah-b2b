import type { ProcessDef } from './types'

/**
 * Manufacturing (karigar) lifecycle — SOP.md §12.
 *
 * SOP §12.1 is honest that production is "a physical notebook, WhatsApp with
 * karigar, and a manila folder per piece". §12.2 sets the minimum the system
 * must enforce even before a full production module exists:
 *
 *   • finished weight recorded before dispatch
 *   • BIS hallmark number captured — required, not optional
 *   • the §12.3 QC checklist signed off by the owner
 *
 * Statuses match the live `manufacturing_orders.status` column
 * ('issued','in_progress','completed','cancelled','received_after_cancel'),
 * so this adds guards and clocks without a migration.
 *
 * The karigar themselves is a `manufacturer` role in the portal, and can move
 * work forward — which is the point. Today the manufacturer portal has no
 * navigation at all, so a karigar cannot self-serve and everything routes
 * through the owner on WhatsApp.
 */

const ADMIN = ['master', 'sub']
const ADMIN_AND_KARIGAR = ['master', 'sub', 'manufacturer']

export const mfgFlow: ProcessDef = {
  key: 'mfg_order',
  statusField: 'status',
  stateEnteredField: 'status_changed_at',

  states: [
    {
      id: 'issued',
      label: 'Issued to karigar',
      description: 'Job sheet handed over. Material may still be pending.',
      waitingOn: 'karigar',
      // SOP §9.3 — 10 business days standard.
      sla: { hours: 240, label: 'production target', businessHoursOnly: true },
    },
    {
      id: 'in_progress',
      label: 'Being made',
      description: 'Karigar has started work.',
      waitingOn: 'karigar',
      sla: { hours: 240, label: 'production target', businessHoursOnly: true },
    },
    {
      id: 'completed',
      label: 'Completed',
      description: 'Piece returned with final weight recorded.',
      terminal: true,
    },
    {
      id: 'cancelled',
      label: 'Cancelled',
      description: 'Job stopped. Any issued material is still owed back.',
      waitingOn: 'karigar',
    },
    {
      id: 'received_after_cancel',
      label: 'Material returned',
      description: 'Issued gold and stones reconciled after cancellation.',
      terminal: true,
    },
  ],

  transitions: [
    {
      from: 'issued', to: 'in_progress',
      label: 'Confirm work started',
      allowedRoles: ADMIN_AND_KARIGAR,
      primary: true,
      hint: 'The karigar can confirm this from their own portal.',
    },
    {
      from: 'issued', to: 'cancelled',
      label: 'Cancel job',
      allowedRoles: ADMIN,
      variant: 'danger',
      hint: 'Issued material remains owed until it comes back.',
    },

    {
      from: 'in_progress', to: 'completed',
      label: 'Mark complete',
      allowedRoles: ADMIN_AND_KARIGAR,
      primary: true,
      // SOP §12.2 — the finished weight is what settles the gold ledger, so
      // it cannot be filled in later from memory.
      requires: [
        { field: 'gold_weight_actual', message: 'Record the finished piece weight', fixField: 'gold_weight_actual' },
      ],
      notify: ['internal_whatsapp'],
      hint: 'Closes the karigar float against actual consumption.',
    },
    {
      from: 'in_progress', to: 'cancelled',
      label: 'Cancel job',
      allowedRoles: ADMIN,
      variant: 'danger',
    },

    {
      from: 'cancelled', to: 'received_after_cancel',
      label: 'Confirm material returned',
      allowedRoles: ADMIN,
      primary: true,
      // Without this the karigar's float stays overstated and the
      // reconciliation report never balances.
      requires: [
        { check: 'materialReturned', message: 'Log the returned gold and stones against this job' },
      ],
    },
  ],
}
