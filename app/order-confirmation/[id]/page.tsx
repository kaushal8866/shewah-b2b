import { Metadata } from 'next'
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import StoreLayout from '@/components/d2c/StoreLayout'
import { formatCurrency, type CurrencyCode } from '@/lib/markets'
import { CheckCircle2, Diamond, Truck, ShieldCheck, ArrowRight, Clock, Building } from 'lucide-react'

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
          <Diamond className="w-12 h-12 text-[#CB9274] mx-auto" />
          <h1 className="font-serif text-2xl text-[#051F34] font-normal">Order Confirmation</h1>
          <p className="text-xs text-[#69727D] font-sans">
            We could not locate this order. Please verify the confirmation link sent to your email.
          </p>
          <div className="pt-4">
            <Link
              href="/"
              className="px-8 py-3.5 bg-[#051F34] hover:bg-[#CB9274] text-white text-[11px] uppercase tracking-[0.2em] font-sans font-medium transition-colors"
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
        <div className="text-center space-y-3 pb-8 border-b border-[#E3DBD4]">
          <div className="w-16 h-16 bg-[#5C7F5F]/10 text-[#5C7F5F] flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <span className="text-[10px] uppercase tracking-[0.25em] text-[#CB9274] font-medium font-sans">
            Order Confirmed & Received
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#051F34] font-normal">
            Thank You, {customerName}
          </h1>
          <p className="text-xs sm:text-sm text-[#69727D] max-w-md mx-auto leading-relaxed font-sans">
            Your commission has been logged with our master atelier. We have sent a detailed confirmation to <strong className="text-[#051F34]">{customerEmail}</strong>.
          </p>
          <div className="pt-2">
            <span className="inline-block px-4 py-1.5 bg-[#F6F4F2] border border-[#E3DBD4] text-xs font-mono font-medium text-[#051F34]">
              Order Number: {order.order_number}
            </span>
          </div>
        </div>

        {/* Timeline Status */}
        <div className="py-8 border-b border-[#E3DBD4]">
          <h3 className="font-serif text-base font-normal text-[#051F34] mb-4">
            Atelier Progress Timeline
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-sans">
            <div className="p-3 bg-white border border-[#E3DBD4] space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-[#5C7F5F] font-semibold">Step 1</span>
              <div className="font-medium text-[#051F34]">Order Confirmed</div>
              <div className="text-[10px] text-[#69727D]">Recorded</div>
            </div>
            <div className="p-3 bg-[#F6F4F2] border border-[#CB9274] space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-[#CB9274] font-semibold">Step 2</span>
              <div className="font-medium text-[#051F34]">Being Crafted</div>
              <div className="text-[10px] text-[#CB9274]">In Production</div>
            </div>
            <div className="p-3 bg-white border border-[#E3DBD4] space-y-1 opacity-60">
              <span className="text-[10px] uppercase tracking-wider text-[#69727D] font-semibold">Step 3</span>
              <div className="font-medium text-[#051F34]">Quality Check</div>
              <div className="text-[10px] text-[#69727D]">Pending</div>
            </div>
            <div className="p-3 bg-white border border-[#E3DBD4] space-y-1 opacity-60">
              <span className="text-[10px] uppercase tracking-wider text-[#69727D] font-semibold">Step 4</span>
              <div className="font-medium text-[#051F34]">Dispatched</div>
              <div className="text-[10px] text-[#69727D]">Insured Courier</div>
            </div>
          </div>

          {journeyToken && (
            <div className="mt-6 p-4 bg-[#F6F4F2] border border-[#E3DBD4] flex items-center justify-between font-sans">
              <div>
                <div className="text-xs font-semibold text-[#051F34]">Track Real-Time Crafting Updates</div>
                <div className="text-[11px] text-[#69727D]">View casting, setting, and polish photos as your piece is made.</div>
              </div>
              <Link
                href={`/c/${journeyToken}`}
                className="px-4 py-2 bg-[#051F34] hover:bg-[#CB9274] text-white text-[11px] uppercase tracking-[0.18em] font-sans font-medium transition-colors shrink-0"
              >
                View Journey
              </Link>
            </div>
          )}
        </div>

        {/* Atelier Wire & Concierge Settlement Instructions */}
        {order.payment_status === 'pending_wire' && (
          <div className="py-8 border-b border-[#E3DBD4]">
            <div className="p-6 bg-[#F6F4F2] border border-[#CB9274] space-y-4">
              <div className="flex items-center gap-2.5 text-[#CB9274]">
                <Building className="w-5 h-5" />
                <h3 className="font-serif text-lg font-normal text-[#051F34]">
                  Atelier Bank Wire & Concierge Settlement
                </h3>
              </div>
              <p className="text-xs text-[#69727D] leading-relaxed font-sans">
                Your creation has been reserved exclusively for you under commission <strong className="text-[#051F34]">{order.order_number}</strong>. To complete settlement via wire transfer / NEFT / RTGS, please use the verified atelier details below:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white p-4 border border-[#E3DBD4] font-sans">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#69727D] block">Beneficiary Name</span>
                  <span className="font-medium text-[#051F34]">SHEWAH HIGH JEWELLERY PVT LTD</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#69727D] block">Order Reference</span>
                  <span className="font-mono font-bold text-[#CB9274]">{order.order_number}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#69727D] block">Bank Name</span>
                  <span className="font-medium text-[#051F34]">HDFC Bank Ltd / ICICI Bank</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#69727D] block">Settlement Total</span>
                  <span className="font-bold text-[#051F34]">{formatCurrency(order.total_amount, currency)}</span>
                </div>
              </div>
              <p className="text-[11px] text-[#69727D] font-sans">
                Our private client concierge will also reach out to your email and phone to confirm receipt and provide insured dispatch tracking.
              </p>
            </div>
          </div>
        )}

        {/* Order Details & Summary */}
        <div className="py-8 space-y-6">
          <h3 className="font-serif text-base font-normal text-[#051F34]">
            Commission Summary
          </h3>

          <div className="bg-white border border-[#E3DBD4] divide-y divide-[#E3DBD4] overflow-hidden">
            {items.map((it: any, idx: number) => (
              <div key={idx} className="p-4 sm:p-5 flex gap-4 text-xs font-sans">
                <div className="w-16 h-16 bg-[#F6F4F2] border border-[#E3DBD4] overflow-hidden shrink-0">
                  {it.photoUrl ? (
                    <img src={it.photoUrl} alt={it.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-serif text-stone-300 text-[10px]">
                      SHEWAH
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-[#051F34]">{it.name}</div>
                  <div className="text-[11px] text-[#69727D] mt-0.5">
                    Qty: {it.quantity} • {it.config?.metalTone && `${it.config.metalTone} Gold`} {it.config?.ringSize && `• Size ${it.config.ringSize}`}
                  </div>
                </div>
                <div className="font-semibold text-[#051F34]">
                  {formatCurrency(it.lineTotal, currency)}
                </div>
              </div>
            ))}

            <div className="p-5 space-y-2 text-xs bg-[#F6F4F2] font-sans">
              <div className="flex justify-between text-[#69727D]">
                <span>Subtotal</span>
                <span className="text-[#051F34]">{formatCurrency(order.subtotal_amount, currency)}</span>
              </div>
              <div className="flex justify-between text-[#69727D]">
                <span>Insured Worldwide Delivery</span>
                <span className="text-[#5C7F5F] font-medium">Complimentary</span>
              </div>
              <div className="flex justify-between text-[#69727D]">
                <span>Taxes & Duties</span>
                <span className="text-[#051F34]">{order.tax_amount ? formatCurrency(order.tax_amount, currency) : 'Included'}</span>
              </div>
              <div className="pt-2 border-t border-[#E3DBD4] flex justify-between font-serif text-base font-normal text-[#051F34]">
                <span>Total Paid</span>
                <span className="font-sans font-semibold text-[#051F34]">{formatCurrency(order.total_amount, currency)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="text-center pt-4">
          <Link
            href="/jewellery"
            className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] font-sans font-medium text-[#CB9274] hover:text-[#051F34] transition-colors"
          >
            <span>Explore More Creations</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </StoreLayout>
  )
}
