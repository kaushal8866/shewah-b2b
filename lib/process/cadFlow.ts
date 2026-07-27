import type { ProcessDef } from './types'

/**
 * CAD lifecycle — SOP.md §10.
 *
 * The CAD screen (app/cad-requests/[id]/page.tsx) is currently a form with a
 * status <select>. There is no next step, no guard, and no countdown — despite
 * SOP §10.1 calling the 48-hour promise "the single most distinctive
 * operational claim Shewah makes". This is the flow the owner reported doing
 * in WhatsApp instead.
 *
 * Statuses match the existing `cad_requests.status` column
 * ('pending','in_progress','sent','revision_requested','approved','rejected')
 * so this needs no data migration — only the clock and the guards it never had.
 */

const ADMIN = ['master', 'sub']
const ADMIN_AND_PARTNER = ['master', 'sub', 'retailer']

export const cadFlow: ProcessDef = {
  key: 'cad',
  statusField: 'status',
  stateEnteredField: 'status_changed_at',

  states: [
    {
      id: 'pending',
      label: 'Awaiting designer',
      description: 'Brief in. Not yet assigned.',
      waitingOn: 'us',
      // The promise starts the moment the brief lands, not on assignment —
      // otherwise the clock could be gamed by simply not assigning.
      sla: { hours: 48, label: 'the 48h promise', businessHoursOnly: true },
    },
    {
      id: 'in_progress',
      label: 'Designing',
      description: 'With the CAD designer.',
      waitingOn: 'us',
      sla: { hours: 48, label: 'the 48h promise', businessHoursOnly: true },
    },
    {
      id: 'sent',
      label: 'Sent to partner',
      description: 'Renders delivered. Awaiting their decision.',
      waitingOn: 'partner',
      // SOP §9.3 — chased at 24h, 48h, 72h.
      sla: { hours: 72, label: 'partner review' },
    },
    {
      id: 'revision_requested',
      label: 'Revision requested',
      description: 'Partner wants changes. Back to the designer.',
      waitingOn: 'us',
      sla: { hours: 48, label: 'revision turnaround', businessHoursOnly: true },
    },
    {
      id: 'approved',
      label: 'Approved',
      description: 'Signed off. Ready to quote and convert to an order.',
      terminal: true,
    },
    {
      id: 'rejected',
      label: 'Rejected',
      description: 'Partner walked away from this design.',
      terminal: true,
    },
  ],

  transitions: [
    {
      from: 'pending', to: 'in_progress',
      label: 'Assign to designer',
      allowedRoles: ADMIN,
      primary: true,
      requires: [
        { field: 'due_date', message: 'Set the delivery deadline', fixField: 'due_date' },
      ],
    },
    {
      from: 'pending', to: 'rejected',
      label: 'Drop this request',
      allowedRoles: ADMIN,
      variant: 'danger',
    },

    {
      from: 'in_progress', to: 'sent',
      label: 'Send renders to partner',
      allowedRoles: ADMIN,
      primary: true,
      // SOP §10.3 — always 3 renders; STL/STEP never before approval.
      requires: [
        { check: 'hasRenders', message: 'Upload the renders before sending', fixField: 'reference_images' },
      ],
      notify: ['partner_whatsapp'],
      hint: 'Renders go out watermarked. STL/STEP is never sent before approval (SOP §10.3).',
    },

    {
      from: 'sent', to: 'approved',
      label: 'Record approval',
      allowedRoles: ADMIN_AND_PARTNER,
      primary: true,
      notify: ['internal_whatsapp'],
      hint: 'Unlocks quoting and the STL/STEP handover to the karigar.',
    },
    {
      from: 'sent', to: 'revision_requested',
      label: 'Log revision request',
      allowedRoles: ADMIN_AND_PARTNER,
      requires: [
        { field: 'revision_notes', message: 'Note what needs to change', fixField: 'revision_notes' },
      ],
      hint: 'Revisions 1–3 are free; the 4th is ₹1,500 upfront (SOP §10.4).',
    },
    {
      from: 'sent', to: 'rejected',
      label: 'Partner declined',
      allowedRoles: ADMIN_AND_PARTNER,
      variant: 'danger',
    },

    {
      from: 'revision_requested', to: 'in_progress',
      label: 'Start the revision',
      allowedRoles: ADMIN,
      primary: true,
    },
  ],
}
