'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Store,
  Package,
  ShoppingBag,
  Users,
  Palette,
  Share2,
  TrendingUp,
  CreditCard,
  Clock,
  ArrowRight,
  Plus,
  AlertTriangle,
  Info
} from 'lucide-react'

const ORDER_STATUS_LABELS: Record<string, string> = {
  payment_pending: 'Payment Pending',
  brief_received: 'Order Received',
  cad_in_progress: 'CAD in Progress',
  cad_sent: 'CAD Sent',
  design_approved: 'Design Approved',
  production: 'In Production',
  qc: 'Quality Check',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const STATUS_CLASSES: Record<string, string> = {
  payment_pending: 'bg-red-50 text-red-700 border-red-100',
  brief_received: 'bg-blue-50 text-blue-700 border-blue-100',
  cad_in_progress: 'bg-purple-50 text-purple-700 border-purple-100',
  cad_sent: 'bg-purple-50 text-purple-700 border-purple-100',
  design_approved: 'bg-green-50 text-green-700 border-green-100',
  production: 'bg-amber-50 text-amber-700 border-amber-100',
  qc: 'bg-amber-50 text-amber-700 border-amber-100',
  dispatched: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  delivered: 'bg-green-50 text-green-700 border-green-100',
  cancelled: 'bg-stone-100 text-stone-500 border-stone-200',
}

export default function ResellerDashboard() {
  const [profile, setProfile] = useState<any>(null)
  const [orders, setOrders] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/portal/reseller/profile').then(r => r.json()),
      fetch('/api/portal/reseller/orders').then(r => r.json())
    ])
      .then(([profData, ordersData]) => {
        if (profData.error) setError(profData.error)
        else setProfile(profData.profile)

        if (ordersData.error) setError(ordersData.error)
        else setOrders(ordersData.orders || [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading dashboard...</div>
  }

  if (error) {
    return (
      <div className="p-4 lg:p-7 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </div>
    )
  }

  const recentOrders = orders ? orders.slice(0, 5) : []
  const activeOrdersCount = orders ? orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length : 0
  const pendingPaymentOrders = orders ? orders.filter(o => o.status === 'payment_pending') : []

  return (
    <div className="p-4 lg:p-7 max-w-5xl mx-auto space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight">
            Welcome back, {profile?.owner_name || 'Partner'}!
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Manage your white-label store, check orders, and track your profit earnings.
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-amber-700 font-bold bg-amber-50 border border-amber-100 px-3 py-1 rounded-lg self-start sm:self-auto">
          <Store className="w-4 h-4" /> {profile?.reseller_code}
        </div>
      </div>

      {/* Payment Action Banner if outstanding */}
      {pendingPaymentOrders.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-red-650 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-red-800">
            <span className="font-bold">Action Required: Unpaid Orders Pending</span>
            <p className="text-xs text-red-700 mt-1 leading-relaxed">
              You have {pendingPaymentOrders.length} order(s) pending payment. Shewah requires payment of the floor price to initiate manufacturing.
              Please upload UPI/Bank transfers screenshot proofs to avoid auto-cancellations.
            </p>
            <div className="mt-2.5">
              <Link
                href="/portal/reseller/orders"
                className="inline-flex items-center gap-1 text-xs font-bold text-red-850 hover:underline"
              >
                Upload payment proofs <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Outstanding Balance */}
        <div className="bg-white border border-stone-200 p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Outstanding Balance</p>
            <p className="text-2xl font-black text-red-600 mt-1">₹{((profile?.outstanding_balance_paise || 0) / 100).toLocaleString('en-IN')}</p>
          </div>
          <p className="text-[10px] text-stone-400 mt-2">Total cash owed to Shewah</p>
        </div>

        {/* Credit Limit Used */}
        <div className="bg-white border border-stone-200 p-4 rounded-xl shadow-sm flex flex-col justify-between col-span-1">
          <div>
            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Credit Limit Used</p>
            <div className="flex items-baseline justify-between mt-1">
              <p className="text-xl font-bold text-stone-850">
                ₹{((profile?.outstanding_balance_paise || 0) / 100).toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-stone-400">
                / ₹{((profile?.credit_limit_paise || 0) / 100).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="w-full bg-stone-100 rounded-full h-1.5 mt-2">
              <div
                className="bg-amber-600 h-1.5 rounded-full"
                style={{
                  width: `${Math.min(
                    100,
                    profile?.credit_limit_paise > 0
                      ? (profile.outstanding_balance_paise / profile.credit_limit_paise) * 100
                      : 0
                  )}%`,
                }}
              ></div>
            </div>
          </div>
          <p className="text-[10px] text-stone-400 mt-2">Used limit for credit-based samples</p>
        </div>

        {/* Lifetime Sales */}
        <div className="bg-white border border-stone-200 p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Lifetime Sales</p>
            <p className="text-2xl font-bold text-stone-850 mt-1">₹{((profile?.lifetime_sales_paise || 0) / 100).toLocaleString('en-IN')}</p>
          </div>
          <p className="text-[10px] text-stone-450 mt-2">Gross customer order volume</p>
        </div>

        {/* In Progress Orders */}
        <div className="bg-[#1E3A5F] text-white p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] text-white/60 font-bold uppercase tracking-wider">Active Orders</p>
            <p className="text-3xl font-extrabold mt-1">{activeOrdersCount}</p>
          </div>
          <p className="text-[10px] text-white/50 mt-2">Orders in design &amp; manufacturing</p>
        </div>
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href="/portal/reseller/catalog"
          className="bg-white border border-stone-200 hover:border-amber-600 rounded-2xl p-4 flex items-center gap-3.5 transition-colors shadow-sm">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <Package className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="font-semibold text-stone-850 text-sm">Browse Catalog</p>
            <p className="text-[11px] text-stone-400 mt-0.5">Check wholesale rates &amp; place orders</p>
          </div>
        </Link>

        <Link href="/portal/reseller/theme"
          className="bg-white border border-stone-200 hover:border-amber-600 rounded-2xl p-4 flex items-center gap-3.5 transition-colors shadow-sm">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
            <Palette className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="font-semibold text-stone-850 text-sm">Visual Brand Studio</p>
            <p className="text-[11px] text-stone-400 mt-0.5">Customize your logo, colors &amp; themes</p>
          </div>
        </Link>

        <Link href="/portal/reseller/share"
          className="bg-white border border-stone-200 hover:border-amber-600 rounded-2xl p-4 flex items-center gap-3.5 transition-colors shadow-sm">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <Share2 className="w-5.5 h-5.5" />
          </div>
          <div>
            <p className="font-semibold text-stone-850 text-sm">Get Share Link</p>
            <p className="text-[11px] text-stone-400 mt-0.5">Create custom-markup storefront links</p>
          </div>
        </Link>
      </div>

      {/* Recent Orders List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-stone-900 text-sm">Recent Dropship Orders</h2>
          <Link href="/portal/reseller/orders" className="text-xs text-amber-700 font-bold hover:underline">
            View All Orders →
          </Link>
        </div>

        {orders === null ? (
          <p className="text-stone-400 text-sm">Loading recent orders...</p>
        ) : orders.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center shadow-sm">
            <ShoppingBag className="w-8 h-8 text-stone-300 mx-auto mb-2" />
            <p className="text-stone-500 font-semibold text-sm">No Orders Placed Yet</p>
            <p className="text-stone-400 text-xs mt-1 mb-4">Browse our catalog to select items and make dropship orders.</p>
            <Link
              href="/portal/reseller/catalog"
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-xl"
            >
              Start Browsing Catalog
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recentOrders.map(o => {
              const coverImg = o.products?.photo_urls?.[0]
              const pCode = o.products?.code || '—'
              const pName = o.products?.name || 'Jewelry Piece'
              const deadlinePassed = o.status === 'payment_pending' && new Date(o.payment_deadline) < new Date()

              return (
                <Link
                  key={o.id}
                  href={`/portal/reseller/orders/${o.id}`}
                  className="block bg-white border border-stone-200 hover:border-amber-600 rounded-2xl p-4 transition-colors shadow-sm"
                >
                  <div className="flex items-center gap-3.5">
                    {coverImg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={coverImg}
                        alt=""
                        className="w-12 h-12 rounded-xl object-cover border border-stone-150 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center shrink-0 border border-stone-150 text-stone-450 font-bold text-xs uppercase">
                        SKU
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-bold text-stone-900 text-xs font-mono">{o.order_number}</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${STATUS_CLASSES[o.status] || 'bg-stone-50 border-stone-200'}`}>
                          {ORDER_STATUS_LABELS[o.status] || o.status}
                          {deadlinePassed && ' (Payment Overdue)'}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-stone-850 truncate">{pCode} · {pName}</p>
                      <p className="text-[10px] text-stone-450 mt-0.5">
                        Qty: {o.quantity} · Customer: {o.shipping_name}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-stone-400 font-medium">Selling Price</p>
                      <p className="text-xs font-bold text-green-650 mt-0.5">₹{(o.customer_selling_price_paise / 100).toLocaleString('en-IN')}</p>
                      <p className="text-[9px] text-stone-450 mt-0.5">Profit: ₹{(o.reseller_earnings_paise / 100).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
