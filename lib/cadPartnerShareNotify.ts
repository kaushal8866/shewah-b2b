import { supabaseAdmin } from './supabaseAdmin'

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

export type CadPartnerSendResult = {
  ok: boolean
  status: number
  body: string
  reason?: string
  publicUrl?: string
}

async function postToWebhook(
  settings: Settings,
  payload: any,
): Promise<{ ok: boolean; status: number; body: string }> {
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
 * Send the CAD partner the public /cad-share/<token> link on WhatsApp.
 * Always returns a result object — never throws — so the admin UI can
 * surface a precise reason if it fails.
 */
export async function sendCadPartnerShareLink(opts: {
  cadRequestId: string
  token: string
  partnerName?: string | null
  partnerPhone?: string | null
}): Promise<CadPartnerSendResult> {
  const { cadRequestId, token, partnerName, partnerPhone } = opts

  const phone = (partnerPhone || '').toString().replace(/\D/g, '')
  if (!phone) return { ok: false, status: 0, body: '', reason: 'no_phone_provided' }

  const settings = await loadSettings()
  if (!settings.enabled) return { ok: false, status: 0, body: '', reason: 'notifications_disabled' }
  if (!settings.webhookUrl) return { ok: false, status: 0, body: '', reason: 'webhook_url_not_configured' }

  const { data: cad } = await supabaseAdmin
    .from('cad_requests')
    .select('id, request_number, brief_text')
    .eq('id', cadRequestId)
    .maybeSingle()
  if (!cad) return { ok: false, status: 0, body: '', reason: 'cad_request_not_found' }

  const baseUrl = (settings.publicBaseUrl || '').replace(/\/$/, '')
  const publicUrl = baseUrl ? `${baseUrl}/cad-share/${token}` : `/cad-share/${token}`
  const greet = partnerName ? `Hi ${partnerName.split(' ')[0]}` : 'Hi'

  const message = [
    `${greet}, new CAD brief from Shewah: ${(cad as any).request_number}.`,
    `Open the brief, download the reference ZIP / PDF, and approve or request a revision here:`,
    publicUrl,
  ].join('\n')

  const result = await postToWebhook(settings, {
    phone,
    message,
    cadRequestId,
    trigger: 'cad_partner_share_link',
  })
  return { ...result, publicUrl }
}

/**
 * Notify the internal design team on WhatsApp when the CAD partner submits
 * an Approve / Request revision response. Always swallows errors.
 */
export async function notifyInternalCadPartnerResponse(opts: {
  cadRequestId: string
  decision: 'approved' | 'revision'
  comment?: string | null
  partnerName?: string | null
}): Promise<void> {
  try {
    const { cadRequestId, decision, comment, partnerName } = opts
    const settings = await loadSettings()
    if (!settings.enabled) return

    const { data: settingRows } = await supabaseAdmin
      .from('settings')
      .select('key, value')
      .in('key', ['whatsapp_number', 'owner_name'])
    const cfg: Record<string, string> = {}
    for (const row of settingRows || []) cfg[(row as any).key] = (row as any).value || ''
    const phone = (cfg.whatsapp_number || '').toString().replace(/\D/g, '')
    if (!phone) return
    if (!settings.webhookUrl) return

    const { data: cad } = await supabaseAdmin
      .from('cad_requests')
      .select('id, request_number, partner_id, partners(store_name), orders(order_number)')
      .eq('id', cadRequestId)
      .maybeSingle()
    if (!cad) return

    const baseUrl = (settings.publicBaseUrl || '').replace(/\/$/, '')
    const adminUrl = `${baseUrl}/cad-requests/${cadRequestId}`
    const greet = cfg.owner_name ? `Hi ${cfg.owner_name.split(' ')[0]}` : 'Heads up'
    const reqNum = (cad as any).request_number
    const orderNum = (cad as any).orders?.order_number
    const retailer = (cad as any).partners?.store_name
    const partnerLbl = partnerName ? ` (${partnerName})` : ''

    const lines: string[] = []
    if (decision === 'approved') {
      lines.push(`${greet}, the CAD partner${partnerLbl} APPROVED ${reqNum}.`)
    } else {
      lines.push(`${greet}, the CAD partner${partnerLbl} requested a REVISION on ${reqNum}.`)
    }
    if (retailer) lines.push(`Retailer: ${retailer}${orderNum ? ` · order ${orderNum}` : ''}`)
    if (comment) lines.push(`Their note: ${comment}`)
    lines.push(`Open: ${adminUrl}`)

    await postToWebhook(settings, {
      phone,
      message: lines.join('\n'),
      cadRequestId,
      trigger: decision === 'approved'
        ? 'cad_partner_approved_internal'
        : 'cad_partner_revision_internal',
    })
  } catch (err: any) {
    console.error('[cadPartnerShareNotify:internal] unexpected error', err?.message || err)
  }
}
