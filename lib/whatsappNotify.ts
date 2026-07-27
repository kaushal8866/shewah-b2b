import { supabaseAdmin } from './supabaseAdmin'

export type OrderNotifyTrigger =
  | 'cad_sent'
  | 'design_approved'
  | 'dispatched'
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'tracking_added'

const STATUS_LABELS: Record<string, string> = {
  cad_sent: 'CAD design sent for your review',
  design_approved: 'Design approved — moving into production',
  production: 'In production',
  qc: 'In quality check',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
}

const MILESTONE_STATUSES = new Set([
  'cad_sent',
  'design_approved',
  'dispatched',
  'delivered',
  'cancelled',
  'returned',
])

type OrderRow = {
  id: string
  order_number: string | null
  status: string | null
  partner_id: string | null
  tracking_number: string | null
  courier: string | null
}

type Settings = {
  enabled: boolean
  webhookUrl: string
  webhookToken: string
  publicBaseUrl: string
}

async function loadSettings(): Promise<Settings> {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('key, value')
    .in('key', [
      'whatsapp_notifications_enabled',
      'whatsapp_webhook_url',
      'whatsapp_webhook_token',
      'public_base_url',
    ])
  const map: Record<string, string> = {}
  for (const row of data || []) map[(row as any).key] = (row as any).value || ''
  return {
    enabled: (map.whatsapp_notifications_enabled || 'true').toLowerCase() !== 'false',
    webhookUrl: map.whatsapp_webhook_url || '',
    webhookToken: map.whatsapp_webhook_token || '',
    publicBaseUrl: map.public_base_url || process.env.NEXTAUTH_URL || '',
  }
}

function buildMessage(
  order: OrderRow,
  trigger: OrderNotifyTrigger,
  storeName: string | null,
  ownerName: string | null,
  baseUrl: string,
): string {
  const orderNum = order.order_number || order.id.slice(0, 8)
  const greet = ownerName ? `Hi ${ownerName.split(' ')[0]}` : 'Hello'
  const orderUrl = baseUrl
    ? `${baseUrl.replace(/\/$/, '')}/portal/retailer/orders/${order.id}`
    : `/portal/retailer/orders/${order.id}`

  if (trigger === 'tracking_added') {
    const courier = order.courier || 'courier'
    const tracking = order.tracking_number || ''
    return [
      `${greet}, an update on your Shewah order ${orderNum}.`,
      `It has shipped via ${courier}${tracking ? ` (tracking: ${tracking})` : ''}.`,
      `Track here: ${orderUrl}`,
    ].join('\n')
  }

  if (trigger === 'cancelled') {
    return [
      `${greet}, your Shewah order ${orderNum} has been cancelled.`,
      `If this was unexpected, please reach out and we'll sort it out.`,
      `Details: ${orderUrl}`,
    ].join('\n')
  }

  if (trigger === 'returned') {
    return [
      `${greet}, we've recorded your Shewah order ${orderNum} as returned.`,
      `Our team will be in touch about the next steps.`,
      `Details: ${orderUrl}`,
    ].join('\n')
  }

  if (trigger === 'dispatched') {
    const courier = order.courier ? ` via ${order.courier}` : ''
    const tracking = order.tracking_number ? ` (tracking: ${order.tracking_number})` : ''
    return [
      `${greet}, your Shewah order ${orderNum} has been dispatched${courier}${tracking}.`,
      `Details: ${orderUrl}`,
    ].join('\n')
  }

  const label = STATUS_LABELS[trigger] || trigger.replace(/_/g, ' ')
  return [
    `${greet}, an update on your Shewah order ${orderNum}.`,
    `Status: ${label}.`,
    `Details: ${orderUrl}`,
  ].join('\n')
}

async function postToWebhook(
  settings: Settings,
  payload: { phone: string; message: string; orderId: string; trigger: string },
): Promise<{ ok: boolean; status: number; body: string }> {
  if (!settings.webhookUrl) {
    return { ok: false, status: 0, body: 'webhook_url_not_configured' }
  }
  try {
    const res = await fetch(settings.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(settings.webhookToken ? { Authorization: `Bearer ${settings.webhookToken}` } : {}),
      },
      body: JSON.stringify(payload),
    })
    let body = ''
    try { body = await res.text() } catch {}
    return { ok: res.ok, status: res.status, body: body.slice(0, 500) }
  } catch (err: any) {
    return { ok: false, status: 0, body: err?.message || 'fetch_error' }
  }
}

/**
 * Notifies the internal design team (the shop's configured WhatsApp number)
 * the instant a retailer approves a CAD or requests a revision from the
 * portal. Re-uses the same webhook plumbing as retailer-facing pings.
 * Always swallows errors — never throws.
 */
export async function notifyInternalCadAction(opts: {
  orderId: string
  action: 'approve' | 'revise'
  feedback?: string | null
}): Promise<void> {
  try {
    const { orderId, action, feedback } = opts

    const settings = await loadSettings()
    if (!settings.enabled) {
      console.log('[whatsappNotify:internal] skipped: globally disabled', { orderId, action })
      return
    }

    // Look up shop / design team WhatsApp number + a friendly business name.
    const { data: settingRows } = await supabaseAdmin
      .from('settings')
      .select('key, value')
      .in('key', ['whatsapp_number', 'business_name', 'owner_name'])
    const cfg: Record<string, string> = {}
    for (const row of settingRows || []) cfg[(row as any).key] = (row as any).value || ''

    const phone = (cfg.whatsapp_number || '').toString().replace(/\D/g, '')
    if (!phone) {
      console.log('[whatsappNotify:internal] skipped: no shop whatsapp_number set', { orderId })
      return
    }

    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, partner_id, cad_request_id')
      .eq('id', orderId)
      .maybeSingle()
    if (!order) {
      console.log('[whatsappNotify:internal] skipped: order missing', { orderId })
      return
    }

    let storeName = ''
    if (order.partner_id) {
      const { data: partner } = await supabaseAdmin
        .from('partners')
        .select('store_name')
        .eq('id', order.partner_id)
        .maybeSingle()
      storeName = (partner as any)?.store_name || ''
    }

    const orderNum = order.order_number || order.id.slice(0, 8)
    const baseUrl = (settings.publicBaseUrl || '').replace(/\/$/, '')
    const adminUrl = order.cad_request_id
      ? `${baseUrl}/cad-requests/${order.cad_request_id}`
      : `${baseUrl}/cad-requests`
    const greet = cfg.owner_name ? `Hi ${cfg.owner_name.split(' ')[0]}` : 'Heads up'
    const who = storeName ? ` from ${storeName}` : ''

    const lines: string[] = []
    if (action === 'approve') {
      lines.push(`${greet}, the retailer${who} just APPROVED the CAD on order ${orderNum}.`)
      if (feedback) lines.push(`Their note: ${feedback}`)
      lines.push(`Open: ${adminUrl}`)
    } else {
      lines.push(`${greet}, the retailer${who} requested a CAD REVISION on order ${orderNum}.`)
      if (feedback) lines.push(`Their feedback: ${feedback}`)
      lines.push(`Open: ${adminUrl}`)
      // Quick reply hook — see app/api/whatsapp/inbound/route.ts. The retailer
      // sees an "acknowledged by design team" indicator once this is replied to.
      lines.push(`Reply "ACK ${orderNum}" to mark this revision as acknowledged.`)
    }

    const trigger = action === 'approve' ? 'cad_approved_internal' : 'cad_revision_internal'
    const result = await postToWebhook(settings, {
      phone,
      message: lines.join('\n'),
      orderId: order.id,
      trigger,
    })
    if (!result.ok) {
      console.error('[whatsappNotify:internal] send failed', {
        orderId,
        action,
        status: result.status,
        body: result.body,
      })
    } else {
      console.log('[whatsappNotify:internal] sent', { orderId, action, phone: phone.slice(-4) })
    }
  } catch (err: any) {
    console.error('[whatsappNotify:internal] unexpected error', err?.message || err)
  }
}

/**
 * Notifies the master / sub-admin WhatsApp number(s) the instant a retailer
 * files a change request from their portal. Includes the order number, store
 * name, the proposed changes summary, and a deep-link to /orders/<id> so the
 * admin can act on it without hunting for the order. Always swallows errors.
 */
export async function notifyInternalChangeRequestCreated(opts: {
  orderId: string
  changeRequestId: string
  changes: Record<string, any> | null
  retailerNote?: string | null
}): Promise<void> {
  try {
    const { orderId, changeRequestId, changes, retailerNote } = opts

    const settings = await loadSettings()
    if (!settings.enabled) {
      console.log('[whatsappNotify:internal:cr] skipped: globally disabled', { orderId, changeRequestId })
      return
    }

    type SettingRow = { key: string; value: string | null }
    const { data: settingRows } = await supabaseAdmin
      .from('settings')
      .select('key, value')
      .in('key', ['whatsapp_number', 'owner_name'])
      .returns<SettingRow[]>()
    const cfg: Record<string, string> = {}
    for (const row of settingRows || []) cfg[row.key] = row.value || ''

    // The shop may have multiple admin recipients — split on comma / semicolon
    // / whitespace, normalise digits-only, dedupe.
    const phones = Array.from(new Set(
      (cfg.whatsapp_number || '')
        .split(/[,;\s]+/)
        .map(p => p.replace(/\D/g, ''))
        .filter(p => p.length > 0)
    ))
    if (phones.length === 0) {
      console.log('[whatsappNotify:internal:cr] skipped: no shop whatsapp_number set', { orderId })
      return
    }

    type OrderLite = { id: string; order_number: string | null; partner_id: string | null }
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, partner_id')
      .eq('id', orderId)
      .maybeSingle<OrderLite>()
    if (!order) {
      console.log('[whatsappNotify:internal:cr] skipped: order missing', { orderId })
      return
    }

    let storeName = ''
    if (order.partner_id) {
      const { data: partner } = await supabaseAdmin
        .from('partners')
        .select('store_name')
        .eq('id', order.partner_id)
        .maybeSingle<{ store_name: string | null }>()
      storeName = partner?.store_name || ''
    }

    const orderNum = order.order_number || order.id.slice(0, 8)
    const baseUrl = (settings.publicBaseUrl || '').replace(/\/$/, '')
    const adminUrl = baseUrl ? `${baseUrl}/orders/${order.id}` : `/orders/${order.id}`
    const greet = cfg.owner_name ? `Hi ${cfg.owner_name.split(' ')[0]}` : 'Heads up'
    const who = storeName ? ` from ${storeName}` : ''

    const changeLines: string[] = []
    if (changes && typeof changes === 'object') {
      for (const [k, v] of Object.entries(changes)) {
        const label = k.replace(/_/g, ' ')
        const val = v === null || v === undefined || v === '' ? '(cleared)' : String(v)
        changeLines.push(`• ${label}: ${val}`)
      }
    }

    const lines: string[] = []
    lines.push(`${greet}, the retailer${who} just filed a CHANGE REQUEST on order ${orderNum}.`)
    if (changeLines.length > 0) {
      lines.push('Requested changes:')
      lines.push(...changeLines)
    }
    if (retailerNote) lines.push(`Their note: ${retailerNote}`)
    lines.push(`Open: ${adminUrl}`)

    const message = lines.join('\n')
    for (const phone of phones) {
      const result = await postToWebhook(settings, {
        phone,
        message,
        orderId: order.id,
        trigger: 'change_request_created_internal',
      })
      if (!result.ok) {
        console.error('[whatsappNotify:internal:cr] send failed', {
          orderId,
          changeRequestId,
          phone: phone.slice(-4),
          status: result.status,
          body: result.body,
        })
      } else {
        console.log('[whatsappNotify:internal:cr] sent', { orderId, changeRequestId, phone: phone.slice(-4) })
      }
    }
  } catch (err: any) {
    console.error('[whatsappNotify:internal:cr] unexpected error', err?.message || err)
  }
}

/**
 * Notifies the retailer on WhatsApp once their change request has been
 * approved or rejected by the master, including the master's review note.
 * Always swallows errors — never throws.
 */
export async function notifyRetailerChangeRequestReviewed(opts: {
  orderId: string
  changeRequestId: string
  decision: 'approved' | 'rejected'
  reviewNote?: string | null
}): Promise<void> {
  try {
    const { orderId, changeRequestId, decision, reviewNote } = opts

    const settings = await loadSettings()
    if (!settings.enabled) {
      console.log('[whatsappNotify:cr] skipped: globally disabled', { orderId, changeRequestId })
      return
    }

    type OrderLite = { id: string; order_number: string | null; partner_id: string | null }
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, partner_id')
      .eq('id', orderId)
      .maybeSingle<OrderLite>()
    if (!order || !order.partner_id) {
      console.log('[whatsappNotify:cr] skipped: order or partner missing', { orderId })
      return
    }

    type PartnerLite = {
      id: string
      store_name: string | null
      owner_name: string | null
      phone: string | null
      notify_whatsapp: boolean | null
    }
    const { data: partner } = await supabaseAdmin
      .from('partners')
      .select('id, store_name, owner_name, phone, notify_whatsapp')
      .eq('id', order.partner_id)
      .maybeSingle<PartnerLite>()
    if (!partner) {
      console.log('[whatsappNotify:cr] skipped: partner not found', { orderId })
      return
    }
    if (partner.notify_whatsapp === false) {
      console.log('[whatsappNotify:cr] skipped: partner opted out', { orderId })
      return
    }
    const phone = (partner.phone || '').replace(/\D/g, '')
    if (!phone) {
      console.log('[whatsappNotify:cr] skipped: no phone on partner', { orderId })
      return
    }

    const orderNum = order.order_number || order.id.slice(0, 8)
    const baseUrl = (settings.publicBaseUrl || '').replace(/\/$/, '')
    const orderUrl = baseUrl
      ? `${baseUrl}/portal/retailer/orders/${order.id}`
      : `/portal/retailer/orders/${order.id}`
    const ownerName = partner.owner_name
    const greet = ownerName ? `Hi ${ownerName.split(' ')[0]}` : 'Hello'

    const lines: string[] = []
    if (decision === 'approved') {
      lines.push(`${greet}, your change request on Shewah order ${orderNum} has been APPROVED.`)
    } else {
      lines.push(`${greet}, your change request on Shewah order ${orderNum} has been declined.`)
    }
    if (reviewNote) lines.push(`Note from Shewah: ${reviewNote}`)
    lines.push(`Details: ${orderUrl}`)

    const result = await postToWebhook(settings, {
      phone,
      message: lines.join('\n'),
      orderId: order.id,
      trigger: decision === 'approved' ? 'change_request_approved' : 'change_request_rejected',
    })
    if (!result.ok) {
      console.error('[whatsappNotify:cr] send failed', {
        orderId,
        changeRequestId,
        decision,
        status: result.status,
        body: result.body,
      })
    } else {
      console.log('[whatsappNotify:cr] sent', { orderId, changeRequestId, decision, phone: phone.slice(-4) })
    }
  } catch (err: any) {
    console.error('[whatsappNotify:cr] unexpected error', err?.message || err)
  }
}

/**
 * Detects retailer-facing milestone changes between a previous order row and
 * the new values that were just written, then fires a WhatsApp notification
 * per change. Always swallows errors — never throws.
 */
export async function notifyRetailerOrderUpdate(opts: {
  orderId: string
  before: Partial<OrderRow> | null
  afterValues: Record<string, any>
}): Promise<void> {
  try {
    const { orderId, before, afterValues } = opts

    const triggers: OrderNotifyTrigger[] = []

    const newStatus = typeof afterValues.status === 'string' ? afterValues.status : undefined
    if (newStatus && newStatus !== before?.status && MILESTONE_STATUSES.has(newStatus)) {
      triggers.push(newStatus as OrderNotifyTrigger)
    }

    const trackingChanged =
      'tracking_number' in afterValues &&
      (afterValues.tracking_number || '') !== (before?.tracking_number || '') &&
      !!afterValues.tracking_number
    const courierChanged =
      'courier' in afterValues &&
      (afterValues.courier || '') !== (before?.courier || '') &&
      !!afterValues.courier
    if ((trackingChanged || courierChanged) && !triggers.includes('dispatched')) {
      triggers.push('tracking_added')
    }

    if (triggers.length === 0) return

    const settings = await loadSettings()
    if (!settings.enabled) {
      console.log('[whatsappNotify] skipped: globally disabled', { orderId, triggers })
      return
    }

    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, status, partner_id, tracking_number, courier')
      .eq('id', orderId)
      .maybeSingle()
    if (!order || !order.partner_id) {
      console.log('[whatsappNotify] skipped: order or partner missing', { orderId })
      return
    }

    const { data: partner } = await supabaseAdmin
      .from('partners')
      .select('id, store_name, owner_name, phone, notify_whatsapp')
      .eq('id', order.partner_id)
      .maybeSingle()
    if (!partner) {
      console.log('[whatsappNotify] skipped: partner not found', { orderId, partnerId: order.partner_id })
      return
    }
    if ((partner as any).notify_whatsapp === false) {
      console.log('[whatsappNotify] skipped: partner opted out', { orderId, partnerId: partner.id })
      return
    }
    const phone = ((partner as any).phone || '').toString().replace(/\D/g, '')
    if (!phone) {
      console.log('[whatsappNotify] skipped: no phone on partner', { orderId, partnerId: partner.id })
      return
    }

    for (const trigger of triggers) {
      const message = buildMessage(
        order as OrderRow,
        trigger,
        (partner as any).store_name || null,
        (partner as any).owner_name || null,
        settings.publicBaseUrl,
      )
      const result = await postToWebhook(settings, {
        phone,
        message,
        orderId: order.id,
        trigger,
      })
      if (!result.ok) {
        console.error('[whatsappNotify] send failed', {
          orderId,
          trigger,
          status: result.status,
          body: result.body,
        })
      } else {
        console.log('[whatsappNotify] sent', { orderId, trigger, phone: phone.slice(-4) })
      }
    }
  } catch (err: any) {
    console.error('[whatsappNotify] unexpected error', err?.message || err)
  }
}
