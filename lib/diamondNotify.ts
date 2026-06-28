import { supabaseAdmin } from './supabaseAdmin'

interface NotificationPayload {
  toPhone: string
  message: string
}

async function getAdminNotifyPhone(): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'lead_notify_whatsapp_to')
      .maybeSingle()
    return data?.value || ''
  } catch {
    return ''
  }
}

async function sendWhatsApp({ toPhone, message }: NotificationPayload): Promise<boolean> {
  const cleanPhone = toPhone.replace(/\D/g, '')
  if (!cleanPhone) return false

  const token = process.env.META_WHATSAPP_ACCESS_TOKEN
  const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID

  console.log(`[WhatsApp Notifications] Sending to: ${cleanPhone}`);
  console.log(`[WhatsApp Notifications] Message:\n${message}\n`);

  if (!token || !phoneId) {
    console.warn('[WhatsApp Notifications] Meta credentials not set. Simulated send only.');
    return true
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${phoneId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'text',
          text: { preview_url: false, body: message },
        }),
      }
    )
    if (res.ok) {
      console.log(`[WhatsApp Notifications] Successfully sent message to ${cleanPhone}`);
      return true
    }
    const txt = await res.text()
    console.error(`[WhatsApp Notifications] Fail response from Meta: ${res.status} - ${txt}`);
    return false
  } catch (err: any) {
    console.error(`[WhatsApp Notifications] Error sending message:`, err?.message || err);
    return false
  }
}

export type DiamondNotificationEvent =
  | 'ask_submitted'        // to Admin: retailer placed a diamond ask
  | 'ask_approved'         // to Retailer: your ask is approved!
  | 'ask_rejected'         // to Retailer: your ask was rejected
  | 'ask_expired'          // to Retailer: your approved ask has expired
  | 'ask_expiring_soon'    // to Retailer: approved ask expiring in 1 hour
  | 'order_placed'         // to Admin: retailer purchased from approved ask

export async function notifyDiamondEvent(
  event: DiamondNotificationEvent,
  data: Record<string, any>
): Promise<void> {
  // Fire-and-forget
  (async () => {
    try {
      let message = ''
      let toPhone = data.toPhone || ''

      const adminPhone = await getAdminNotifyPhone()

      switch (event) {
        case 'ask_submitted':
          toPhone = adminPhone
          message = `🔔 Shewah Procurement: New Ask Submitted!\n\nRetailer: ${data.partnerName}\nSpecs: ${data.specs}\nAsked: ₹${data.askedPrice}/${data.askedUnit} vs Quoted: ₹${data.originalPrice}/pc\nQuantity: ${data.quantity} pcs\nReason: ${data.reason || 'None provided.'}`
          break

        case 'ask_approved':
          message = `Shewah Procurement: Ask Approved! 🎉\n\nYour ask for ${data.specs} has been approved at ₹${data.approvedPrice} per ${data.approvedUnit === 'per_pc' ? 'piece' : 'carat'}.\n\nPurchase it before the window expires at ${new Date(data.expiryAt).toLocaleString('en-IN')}.\nPortal link: ${data.url}`
          break

        case 'ask_rejected':
          message = `Shewah Procurement: Ask Rejected ❌\n\nYour ask for ${data.specs} was rejected.\nReason: ${data.adminNotes || 'No notes provided.'}`
          break

        case 'ask_expired':
          message = `Shewah Procurement: Ask Expired ⚠️\n\nYour approved ask for ${data.specs} has expired. Please submit a new ask if needed.`
          break

        case 'ask_expiring_soon':
          message = `Shewah Procurement: Reminder! ⏳\n\nYour approved ask for ${data.specs} expires in 1 hour at ${new Date(data.expiryAt).toLocaleTimeString('en-IN')}. Purchase now to lock the price.`
          break

        case 'order_placed':
          toPhone = adminPhone
          message = `🔔 Shewah Procurement: Order Placed!\n\nRetailer ${data.partnerName} has ordered ${data.quantity} pcs of ${data.specs} from approved Ask #${data.askId}. Order number: #${data.orderNumber}`
          break

        default:
          return
      }

      if (toPhone) {
        await sendWhatsApp({ toPhone, message })
      }
    } catch (e) {
      console.error('[WhatsApp Notifications] Diamond ask notify thread error:', e)
    }
  })()
}
