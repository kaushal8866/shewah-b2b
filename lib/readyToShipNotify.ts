import { supabaseAdmin } from './supabaseAdmin'

/**
 * Retailer-facing WhatsApp ping for Ready-to-Ship offer decisions.
 * Mirrors the plumbing in `whatsappNotify.ts` (settings-driven webhook,
 * never throws) — kept as its own helper so the offer flow doesn't need
 * to fake an `orders` row.
 */
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
  for (const row of (data || []) as { key: string; value: string | null }[]) {
    map[row.key] = row.value || ''
  }
  return {
    enabled: (map.whatsapp_notifications_enabled || 'true').toLowerCase() !== 'false',
    webhookUrl: map.whatsapp_webhook_url || '',
    webhookToken: map.whatsapp_webhook_token || '',
    publicBaseUrl: map.public_base_url || process.env.NEXTAUTH_URL || '',
  }
}

async function postToWebhook(s: Settings, payload: Record<string, unknown>) {
  if (!s.webhookUrl) return
  try {
    await fetch(s.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(s.webhookToken ? { Authorization: `Bearer ${s.webhookToken}` } : {}),
      },
      body: JSON.stringify(payload),
    })
  } catch {/* swallow — never throw from a notify path */}
}

export async function notifyRetailerOfferDecision(opts: {
  offerId: string
  decision: 'accepted' | 'countered' | 'rejected'
  orderId?: string | null
}): Promise<void> {
  try {
    const settings = await loadSettings()
    if (!settings.enabled) return

    type OfferLite = {
      id: string
      partner_id: string
      offer_price: number
      counter_price: number | null
      counter_note: string | null
      item_id: string
    }
    const { data: offer } = await supabaseAdmin
      .from('ready_to_ship_offers')
      .select('id, partner_id, offer_price, counter_price, counter_note, item_id')
      .eq('id', opts.offerId)
      .maybeSingle<OfferLite>()
    if (!offer) return

    type PartnerLite = {
      store_name: string | null
      owner_name: string | null
      phone: string | null
      notify_whatsapp: boolean | null
    }
    const { data: partner } = await supabaseAdmin
      .from('partners')
      .select('store_name, owner_name, phone, notify_whatsapp')
      .eq('id', offer.partner_id)
      .maybeSingle<PartnerLite>()
    if (!partner || partner.notify_whatsapp === false) return
    const phone = (partner.phone || '').replace(/\D/g, '')
    if (!phone) return

    type ItemLite = { id: string; karat: number; gross_weight: number }
    const { data: item } = await supabaseAdmin
      .from('ready_to_ship_items')
      .select('id, karat, gross_weight')
      .eq('id', offer.item_id)
      .maybeSingle<ItemLite>()

    const greet = partner.owner_name ? `Hi ${partner.owner_name.split(' ')[0]}` : 'Hello'
    const baseUrl = (settings.publicBaseUrl || '').replace(/\/$/, '')
    const link = baseUrl ? `${baseUrl}/portal/retailer/ready-to-ship` : `/portal/retailer/ready-to-ship`
    const desc = item ? `${item.karat}kt piece (${item.gross_weight}g)` : 'Ready-to-Ship piece'

    const lines: string[] = []
    if (opts.decision === 'accepted') {
      lines.push(`${greet}, your offer of ₹${offer.offer_price.toLocaleString('en-IN')} on the Shewah ${desc} has been ACCEPTED.`)
      lines.push(opts.orderId
        ? `We've raised order ${opts.orderId} for you — it will dispatch shortly.`
        : `We've raised an order for you — it will dispatch shortly.`)
    } else if (opts.decision === 'countered') {
      lines.push(`${greet}, Shewah has COUNTERED your offer on the ${desc}.`)
      if (offer.counter_price) lines.push(`New price: ₹${Number(offer.counter_price).toLocaleString('en-IN')}.`)
      if (offer.counter_note) lines.push(`Note: ${offer.counter_note}`)
    } else {
      lines.push(`${greet}, Shewah has declined your offer on the ${desc}.`)
      lines.push(`The piece is still listed if you'd like to revise your offer.`)
    }
    lines.push(`Open: ${link}`)

    await postToWebhook(settings, {
      phone,
      message: lines.join('\n'),
      offerId: offer.id,
      trigger: `rts_offer_${opts.decision}`,
    })
  } catch (err) {
    console.error('[readyToShipNotify] error', (err as Error)?.message || err)
  }
}
