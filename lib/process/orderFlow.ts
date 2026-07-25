import type { ProcessDef } from './types'

/**
 * Order lifecycle — SOP.md §9.
 *
 * The app previously implemented 8 states as a flat dropdown
 * (ORDER_STATUSES in lib/supabase.ts), advanced by index. Three consequences:
 *
 *   1. No money gate. QUOTE_ISSUED and ADVANCE_RECEIVED did not exist, so
 *      nothing stopped a piece entering production unpaid.
 *   2. No branching. QC could not fail and send a piece back for rework.
 *   3. No way back. Rejection, cancellation and abandonment had no home, so
 *      they happened in WhatsApp and the system never learned about them.
 *
 * Guards below are ported from checkCompletionGuard() and
 * checkMaterialReadiness() in app/orders/[id]/page.tsx, which were correct but
 * reachable from exactly one screen.
 */

const ADMIN = ['master', 'sub']
const ADMIN_AND_PARTNER = ['master', 'sub', 'retailer']

export const orderFlow: ProcessDef = {
  key: 'order',
  statusField: 'status',
  stateEnteredField: 'status_changed_at',

  states: [
    {
      id: 'draft',
      label: 'Draft',
      description: 'Being written up. Not yet a commitment.',
      waitingOn: 'us',
    },
    {
      id: 'brief_received',
      label: 'Brief received',
      description: 'Design intent captured. The 48-hour clock starts here.',
      waitingOn: 'us',
      // SOP §9.3 / §10.1 — the Shewah promise, in business days.
      sla: { hours: 48, label: 'the 48h promise', businessHoursOnly: true },
    },
    {
      id: 'cad_in_progress',
      label: 'CAD in progress',
      description: 'Assigned to a designer.',
      waitingOn: 'us',
      sla: { hours: 48, label: 'the 48h promise', businessHoursOnly: true },
    },
    {
      id: 'cad_sent',
      label: 'CAD sent',
      description: 'Renders with the partner, awaiting their call.',
      waitingOn: 'partner',
      // SOP §9.3 — chased at 24h, 48h, 72h.
      sla: { hours: 72, label: 'partner review' },
    },
    {
      id: 'cad_approved',
      label: 'Design approved',
      description: 'Partner signed off. Ready to quote.',
      waitingOn: 'us',
    },
    {
      id: 'quote_issued',
      label: 'Quote issued',
      description: 'Proforma sent. Gold rate is locked for 72 hours.',
      waitingOn: 'partner',
      // SOP §9.3 / §6.3 — the rate-lock window.
      sla: { hours: 72, label: 'rate lock' },
    },
    {
      id: 'advance_received',
      label: 'Advance received',
      description: 'Payment recorded and reconciled. Production may begin.',
      waitingOn: 'us',
    },
    {
      id: 'production',
      label: 'In production',
      description: 'With the karigar.',
      waitingOn: 'karigar',
      // SOP §9.3 — 10 business days standard.
      sla: { hours: 240, label: 'production target', businessHoursOnly: true },
    },
    {
      id: 'hallmarking',
      label: 'Hallmarking',
      description: 'At BIS. Needs the UID back before QC.',
      waitingOn: 'us',
    },
    {
      id: 'qc',
      label: 'Quality check',
      description: 'Against the §12.3 checklist.',
      waitingOn: 'us',
    },
    {
      id: 'qc_failed',
      label: 'QC failed',
      description: 'Rework required. Returns to production.',
      waitingOn: 'us',
    },
    {
      id: 'qc_passed',
      label: 'QC passed',
      description: 'Cleared for dispatch.',
      waitingOn: 'us',
    },
    {
      id: 'dispatched',
      label: 'Dispatched',
      description: 'With the courier.',
      waitingOn: 'partner',
      sla: { hours: 72, label: 'delivery' },
    },
    {
      id: 'delivered',
      label: 'Delivered',
      description: 'Received by the partner. Closes automatically after 7 days.',
      waitingOn: 'nobody',
    },
    { id: 'closed',    label: 'Closed',    description: 'Complete and undisputed.', terminal: true },
    { id: 'cancelled', label: 'Cancelled', description: 'Stopped before production.', terminal: true },
    { id: 'abandoned', label: 'Abandoned', description: 'Partner went quiet.',        terminal: true },
  ],

  transitions: [
    {
      from: 'draft', to: 'brief_received',
      label: 'Confirm brief',
      allowedRoles: ADMIN_AND_PARTNER,
      primary: true,
      // SOP §10.2 — nothing moves to CAD without these.
      requires: [
        { field: 'brief_text',  message: 'Describe the design intent', fixField: 'brief_text' },
        { field: 'gold_karat',  message: 'Pick the metal purity',      fixField: 'gold_karat' },
        { field: 'partner_id',  message: 'Choose the partner',         fixField: 'partner_id' },
      ],
      notify: ['partner_whatsapp'],
      hint: 'Starts the 48-hour CAD promise.',
    },

    {
      from: 'brief_received', to: 'cad_in_progress',
      label: 'Assign to designer',
      allowedRoles: ADMIN,
      primary: true,
      requires: [
        { field: 'expected_delivery', message: 'Set the CAD deadline', fixField: 'expected_delivery' },
      ],
    },
    {
      from: 'brief_received', to: 'abandoned',
      label: 'Mark abandoned',
      allowedRoles: ADMIN,
      variant: 'danger',
    },

    {
      from: 'cad_in_progress', to: 'cad_sent',
      label: 'Send CAD to partner',
      allowedRoles: ADMIN,
      primary: true,
      // SOP §10.3 — a render at minimum.
      requires: [
        { check: 'hasCadRender', message: 'Upload at least one render first', fixField: 'cad_images' },
      ],
      notify: ['partner_whatsapp'],
    },
    {
      from: 'cad_in_progress', to: 'abandoned',
      label: 'Mark abandoned',
      allowedRoles: ADMIN,
      variant: 'danger',
    },

    {
      from: 'cad_sent', to: 'cad_approved',
      label: 'Record partner approval',
      allowedRoles: ADMIN_AND_PARTNER,
      primary: true,
      notify: ['internal_whatsapp'],
    },
    {
      from: 'cad_sent', to: 'cad_in_progress',
      label: 'Log revision request',
      allowedRoles: ADMIN_AND_PARTNER,
      // SOP §9.2 — reason captured.
      requires: [
        { field: 'revision_reason', message: 'Note what the partner wants changed', fixField: 'revision_reason' },
      ],
      hint: 'Revisions 1–3 are free; the 4th is chargeable (SOP §10.4).',
    },

    {
      from: 'cad_approved', to: 'quote_issued',
      label: 'Issue quote',
      allowedRoles: ADMIN,
      primary: true,
      // SOP §9.2 — all pricing valid, rate locked.
      requires: [
        { field: 'total_amount',       message: 'Quote total is not calculated yet', fixField: 'total_amount' },
        { field: 'gold_rate_at_order', message: 'Lock the gold rate for this quote', fixField: 'gold_rate_at_order' },
      ],
      notify: ['partner_whatsapp', 'partner_email'],
      hint: 'Locks the gold rate for 72 hours.',
    },
    {
      from: 'cad_approved', to: 'cancelled',
      label: 'Cancel order',
      allowedRoles: ADMIN,
      variant: 'danger',
    },

    {
      from: 'quote_issued', to: 'advance_received',
      label: 'Record advance payment',
      allowedRoles: ADMIN,
      primary: true,
      // SOP §9.2 — payment record created AND reconciled. This is the gate
      // that did not exist: previously an order could reach production with
      // no payment recorded anywhere.
      requires: [
        { check: 'advancePaid', message: 'Log the advance payment against this order', fixField: 'advance_paid' },
      ],
      notify: ['partner_whatsapp', 'partner_email'],
    },
    {
      from: 'quote_issued', to: 'cancelled',
      label: 'Cancel order',
      allowedRoles: ADMIN,
      variant: 'danger',
    },

    {
      from: 'advance_received', to: 'production',
      label: 'Start production',
      allowedRoles: ADMIN,
      primary: true,
      // Ported from checkCompletionGuard() / checkMaterialReadiness().
      requires: [
        { field: 'gold_weight_estimated',   message: 'Estimated gold weight is needed to reserve material', fixField: 'gold_weight_estimated' },
        { field: 'assigned_manufacturer_id', message: 'Assign a karigar',                                   fixField: 'assigned_manufacturer_id' },
        { check: 'materialReady',            message: 'Karigar float is short — issue gold or diamonds first' },
      ],
      notify: ['partner_whatsapp'],
    },

    {
      from: 'production', to: 'hallmarking',
      label: 'Send for hallmarking',
      allowedRoles: ADMIN,
      primary: true,
      // SOP §12.2 — finished weight recorded before it leaves production.
      requires: [
        { field: 'gold_weight_actual', message: 'Record the finished piece weight', fixField: 'gold_weight_actual' },
        { field: 'making_charges',     message: 'Record the making charges',        fixField: 'making_charges' },
      ],
    },

    {
      from: 'hallmarking', to: 'qc',
      label: 'Start quality check',
      allowedRoles: ADMIN,
      primary: true,
      // SOP §12.2 — BIS UID is a required field, not optional.
      requires: [
        { field: 'hallmark_number', message: 'Enter the BIS hallmark number', fixField: 'hallmark_number' },
      ],
    },

    {
      from: 'qc', to: 'qc_passed',
      label: 'Pass QC',
      allowedRoles: ['master'],
      primary: true,
      // SOP §12.3 — the full checklist, signed off by the owner.
      requires: [
        { check: 'qcChecklistComplete', message: 'Complete every QC checklist item', fixField: 'qc_checklist' },
      ],
    },
    {
      from: 'qc', to: 'qc_failed',
      label: 'Fail QC',
      allowedRoles: ['master'],
      variant: 'danger',
      requires: [
        { field: 'qc_failure_reason', message: 'Record why it failed', fixField: 'qc_failure_reason' },
      ],
    },

    {
      from: 'qc_failed', to: 'production',
      label: 'Send back for rework',
      allowedRoles: ADMIN,
      primary: true,
    },

    {
      from: 'qc_passed', to: 'dispatched',
      label: 'Dispatch',
      allowedRoles: ADMIN,
      primary: true,
      // Ported guard: the retailer's WhatsApp dispatch message carries these,
      // so an empty tracking reference sends a useless notification.
      requires: [
        { field: 'tracking_number', message: 'Add the tracking number — it goes in the partner WhatsApp', fixField: 'tracking_number' },
        { field: 'courier',         message: 'Add the courier name',                                      fixField: 'courier' },
      ],
      notify: ['partner_whatsapp', 'partner_email'],
    },

    {
      from: 'dispatched', to: 'delivered',
      label: 'Confirm delivery',
      allowedRoles: ADMIN_AND_PARTNER,
      primary: true,
      notify: ['partner_whatsapp'],
    },

    {
      from: 'delivered', to: 'closed',
      label: 'Close order',
      allowedRoles: ADMIN,
      primary: true,
      hint: 'Closes automatically 7 days after delivery if undisputed (SOP §9.2).',
    },
  ],
}
