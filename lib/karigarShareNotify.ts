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

export type KarigarSendResult = {
  ok: boolean
  status: number
  body: string
  reason?: string
  publicUrl?: string
}

/**
 * Sends the karigar a WhatsApp message containing the 48-hour /m/<token>
 * asset link. Always returns a result object — never throws — so the
 * admin UI can surface a precise reason if it fails.
 */
export async function sendKarigarPackLink(opts: {
  manufacturingOrderId: string
  token: string
}): Promise<KarigarSendResult> {
  const { manufacturingOrderId, token } = opts

  const { data: order } = await supabaseAdmin
    .from('manufacturing_orders')
    .select('id, order_number, manufacturing_partners(name, phone)')
    .eq('id', manufacturingOrderId)
    .maybeSingle()

  if (!order) return { ok: false, status: 0, body: '', reason: 'order_not_found' }
  const partner = (order as any).manufacturing_partners as { name?: string; phone?: string } | null
  const phone = (partner?.phone || '').toString().replace(/\D/g, '')
  if (!phone) return { ok: false, status: 0, body: '', reason: 'no_phone_on_partner' }

  const settings = await loadSettings()
  if (!settings.enabled) return { ok: false, status: 0, body: '', reason: 'notifications_disabled' }
  if (!settings.webhookUrl) return { ok: false, status: 0, body: '', reason: 'webhook_url_not_configured' }

  const baseUrl = (settings.publicBaseUrl || '').replace(/\/$/, '')
  const publicUrl = baseUrl ? `${baseUrl}/m/${token}` : `/m/${token}`
  const orderNum = (order as any).order_number || (order as any).id.slice(0, 8)
  const greet = partner?.name ? `Hi ${partner.name.split(' ')[0]}` : 'Hi'

  const message = [
    `${greet}, new order from Shewah: ${orderNum}.`,
    `Open the design pack here (link expires in 48 hours):`,
    publicUrl,
  ].join('\n')

  try {
    const res = await fetch(settings.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(settings.webhookToken ? { Authorization: `Bearer ${settings.webhookToken}` } : {}),
      },
      body: JSON.stringify({
        phone,
        message,
        orderId: manufacturingOrderId,
        trigger: 'karigar_pack_link',
      }),
    })
    let body = ''
    try { body = await res.text() } catch {}
    return { ok: res.ok, status: res.status, body: body.slice(0, 500), publicUrl }
  } catch (err: any) {
    return { ok: false, status: 0, body: err?.message || 'fetch_error', reason: 'network_error', publicUrl }
  }
}
