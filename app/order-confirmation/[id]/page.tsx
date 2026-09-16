import { Metadata } from 'next'
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import StoreLayout from '@/components/d2c/StoreLayout'
import { formatCurrency, type CurrencyCode } from '@/lib/markets'
import { CheckCircle2, Diamond, Truck, ShieldCheck, ArrowRight, Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Order Confirmation | Shewah High Jewellery',
  description: 'Your commission has been received by Shewah Atelier.',
}

export default async function OrderConfirmationPage({
  params,
}: {
  params: { id: string }
}) {
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('*, customers(full_name, email), customer_journey_links(token)')
    .eq('id', params.id)
    .maybeSingle()

  if (error || !order) {
    return (
      <StoreLayout>
        <div className="max-w-xl mx-auto px-6 py-24 text-center space-y-4">
          <Diamond className="w-12 h-12 text-[#A88A4F] mx-auto" />
          <h1 className="font-serif text-2xl text-[#2A241B]">Order Confirmation</h1>
          <p className="text-xs text-[#5C5347]">
            We could not locate this order. Please verify the confirmation link sent to your email.
          </p>
          <div className="pt-4">
            <Link
              href="/"
              className="px-6 py-2.5 bg-[#2A241B] text-white text-xs uppercase tracking-widest font-medium rounded-full"
            >
              Return to Shewah
            </Link>
          </div>
        </div>
      </StoreLayout>
    )
  }

  const items = Array.isArray(order.d2c_items) ? order.d2c_items : []
  const journeyToken = order.customer_journey_links?.[0]?.token || null
  const currency = (order.currency || 'USD') as CurrencyCode
  const customerName = order.customers?.full_name || 'Client'
  const customerEmail = order.customers?.email || ''

  return (
    <StoreLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Success Banner */}
        <div className="text-center space-y-3 pb-8 border-b border-[#E8DFC9]">
          <div className="w-16 h-16 rounded-full bg-[#5C7F5F]/10 text-[#5C7F5F] flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <span className="text-[10px] uppercase tracking-[0.35em] text-[#A88A4F] font-semibold">
            Order Confirmed & Received
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#2A241B] font-medium">
            Thank You, {customerName}
          </h1>
          <p className="text-xs sm:text-sm text-[#5C5347] max-w-md mx-auto leading-relaxed">
            Your commission has been logged with our master atelier. We have sent a detailed confirmation to <strong className="text-[#2A241B]">{customerEmail}</strong>.
          </p>
          <div className="pt-2">
            <span className="inline-block px-4 py-1.5 bg-[#F4ECDD] border border-[#E8DFC9] rounded-full text-xs font-mono font-medium text-[#2A241B]">
              Order Number: {order.order_number}
            </span>
          </div>
        </div>

        {/* Timeline Status */}
        <div className="py-8 border-b border-[#E8DFC9]">
          <h3 className="font-serif text-base font-medium text-[#2A241B] mb-4">
            Atelier Progress Timeline
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-3 bg-white border border-[#E8DFC9] rounded-xl space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-[#5C7F5F] font-semibold">Step 1</span>
              <div className="font-medium text-[#2A241B]">Order Confirmed</div>
              <div className="text-[10px] text-stone-400">Recorded</div>
            </div>
            <div className="p-3 bg-[#F4ECDD] border border-[#C9A86A] rounded-xl space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-[#A88A4F] font-semibold">Step 2</span>
              <div className="font-medium text-[#2A241B]">Being Crafted</div>
              <div className="text-[10px] text-[#A88A4F]">In Production</div>
            </div>
            <div className="p-3 bg-white border border-[#E8DFC9] rounded-xl space-y-1 opacity-60">
              <span className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">Step 3</span>
              <div className="font-medium text-[#2A241B]">Quality Check</div>
              <div className="text-[10px] text-stone-400">Pending</div>
            </div>
            <div className="p-3 bg-white border border-[#E8DFC9] rounded-xl space-y-1 opacity-60">
              <span className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">Step 4</span>
              <div className="font-medium text-[#2A241B]">Dispatched</div>
              <div className="text-[10px] text-stone-400">Insured Courier</div>
            </div>
          </div>

          {journeyToken && (
            <div className="mt-6 p-4 bg-[#FBF7F0] border border-[#E8DFC9] rounded-xl flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-[#2A241B]">Track Real-Time Crafting Updates</div>
                <div className="text-[11px] text-[#5C5347]">View casting, setting, and polish photos as your piece is made.</div>
              </div>
              <Link
                href={`/c/${journeyToken}`}
                className="px-4 py-2 bg-[#2A241B] text-white text-xs uppercase tracking-wider font-medium rounded-lg hover:bg-stone-800 transition-colors shrink-0"
              >
                View Journey
              </Link>
            </div>
          )}
        </div>

        {/* Order Details & Summary */}
        <div className="py-8 space-y-6">
          <h3 className="font-serif text-base font-medium text-[#2A241B]">
            Commission Summary
          </h3>

          <div className="bg-white rounded-2xl border border-[#E8DFC9] divide-y divide-[#E8DFC9] overflow-hidden">
            {items.map((it: any, idx: number) => (
              <div key={idx} className="p-4 sm:p-5 flex gap-4 text-xs">
                <div className="w-16 h-16 bg-[#FBF7F0] rounded-lg border border-[#E8DFC9] overflow-hidden shrink-0">
                  {it.photoUrl ? (
                    <img src={it.photoUrl} alt={it.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-serif text-stone-300 text-[10px]">
                      SHEWAH
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-[#2A241B]">{it.name}</div>
                  <div className="text-[11px] text-[#5C5347] mt-0.5">
                    Qty: {it.quantity} • {it.config?.metalTone && `${it.config.metalTone} Gold`} {it.config?.ringSize && `• Size ${it.config.ringSize}`}
                  </div>
                </div>
                <div className="font-semibold text-[#2A241B]">
                  {formatCurrency(it.lineTotal, currency)}
                </div>
              </div>
            ))}

            <div className="p-5 space-y-2 text-xs bg-[#FBF7F0]/60">
              <div className="flex justify-between text-[#5C5347]">
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal_amount, currency)}</span>
              </div>
              <div className="flex justify-between text-[#5C5347]">
                <span>Insured Worldwide Delivery</span>
                <span className="text-[#5C7F5F] font-medium">Complimentary</span>
              </div>
              <div className="flex justify-between text-[#5C5347]">
                <span>Taxes & Duties</span>
                <span>{order.tax_amount ? formatCurrency(order.tax_amount, currency) : 'Included'}</span>
              </div>
              <div className="pt-2 border-t border-[#E8DFC9] flex justify-between font-serif text-base font-medium text-[#2A241B]">
                <span>Total Paid</span>
                <span>{formatCurrency(order.total_amount, currency)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="text-center pt-4">
          <Link
            href="/jewellery"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-widest font-semibold text-[#A88A4F] hover:text-[#2A241B] transition-colors"
          >
            <span>Explore More Creations</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </StoreLayout>
  )
}
