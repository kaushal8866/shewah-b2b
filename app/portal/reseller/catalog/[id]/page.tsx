'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Package,
  Share2,
  CreditCard,
  MessageCircle,
  TrendingUp,
  Percent,
  CheckCircle,
  AlertTriangle,
  Info,
  Clock,
  Eye,
  Plus,
  X
} from 'lucide-react'

export default function ResellerProductDetail() {
  const { id } = useParams() as { id: string }
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [product, setProduct] = useState<any>(null)
  const [categorySchema, setCategorySchema] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)

  // Images state
  const [activePhoto, setActivePhoto] = useState('')

  // WhatsApp builder state
  const [markup, setMarkup] = useState('15')
  const [customMsg, setCustomMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [storeLink, setStoreLink] = useState('')

  // Sample Request Modal state
  const [showSampleModal, setShowSampleModal] = useState(false)
  const [sampleNotes, setSampleNotes] = useState('')
  const [submittingSample, setSubmittingSample] = useState(false)
  const [sampleSuccess, setSampleSuccess] = useState(false)

  useEffect(() => {
    if (id) {
      loadData()
    }
  }, [id])

  async function loadData() {
    try {
      setLoading(true)
      const [profRes, prodRes] = await Promise.all([
        fetch('/api/portal/reseller/profile').then(r => r.json()),
        fetch(`/api/portal/reseller/catalog/${id}`).then(r => r.json())
      ])

      if (profRes.error) setError(profRes.error)
      else {
        setProfile(profRes.profile)
        setMarkup(String(profRes.profile?.default_markup_percent || 15))
      }

      if (prodRes.error) setError(prodRes.error)
      else {
        setProduct(prodRes.product)
        setCategorySchema(prodRes.categorySchema || [])
        if (prodRes.product?.photo_urls?.length > 0) {
          setActivePhoto(prodRes.product.photo_urls[0])
        }
      }

      // Resolve their active share links to format a storefront link
      const linksRes = await fetch('/api/portal/reseller/share').then(r => r.json())
      if (linksRes.shareLinks?.length > 0) {
        // Use the first active share link
        const activeLink = linksRes.shareLinks.find((l: any) => l.is_active) || linksRes.shareLinks[0]
        setStoreLink(`${window.location.origin}/r/${activeLink.link_token}`)
      } else {
        // Fallback placeholder
        setStoreLink(`${window.location.origin}/r/storefront`)
      }

    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Generate WhatsApp message preview in real time
  useEffect(() => {
    if (product && profile) {
      const cost = product.floor_price_paise / 100
      const mult = 1 + Number(markup) / 100
      const sell = Math.round(cost * mult)

      const text = `*✨ ${product.name} ✨*\n\nExquisite ${product.category} jewelry piece, custom crafted in ${product.ref_karat || '18K'} Gold.\n\n*Special Price:* ₹${sell.toLocaleString('en-IN')}\n\nView details & request purchase here:\n🔗 ${storeLink}\n\nContact me on WhatsApp to order! 🛍️`
      setCustomMsg(text)
    }
  }, [product, profile, markup, storeLink])

  async function handleRequestSample(e: React.FormEvent) {
    e.preventDefault()
    setSubmittingSample(true)
    setSampleSuccess(false)

    try {
      const res = await fetch('/api/portal/reseller/samples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          notes: sampleNotes
        })
      })
      const data = await res.json()
      if (data.error) {
        alert(data.error)
      } else {
        setSampleSuccess(true)
        setSampleNotes('')
        setTimeout(() => {
          setShowSampleModal(false)
          setSampleSuccess(false)
        }, 3000)
      }
    } catch (err: any) {
      alert('Error requesting sample: ' + err.message)
    } finally {
      setSubmittingSample(false)
    }
  }

  function handleShareWhatsApp() {
    const encoded = encodeURIComponent(customMsg)
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank')
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(customMsg)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('Failed to copy to clipboard')
    }
  }

  if (loading) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading product details...</div>
  if (error) return <div className="p-4 lg:p-7 max-w-4xl mx-auto"><div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div></div>
  if (!product) return <div className="p-4 lg:p-7 text-stone-450 text-sm">Product not found.</div>

  const costRupees = product.floor_price_paise / 100
  const markupMultiplier = 1 + Number(markup) / 100
  const sellingPriceRupees = Math.round(costRupees * markupMultiplier)
  const earningsRupees = sellingPriceRupees - costRupees

  const lbl = 'block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1'
  const inp = 'w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 bg-white shadow-sm font-semibold text-stone-800'

  return (
    <div className="p-4 lg:p-7 max-w-5xl mx-auto space-y-6">
      {/* Back Button */}
      <div className="flex items-center gap-3">
        <Link
          href="/portal/reseller/catalog"
          className="p-2 border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors text-stone-500 bg-white shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2 text-stone-500 text-xs mb-0.5 font-medium">
            <Link href="/portal/reseller/catalog" className="hover:text-stone-700">Catalog</Link>
            <span>/</span>
            <span className="text-stone-700">{product.name}</span>
          </div>
          <h1 className="text-lg font-bold text-stone-900 leading-tight">Product Details</h1>
        </div>
      </div>

      {/* Main product view split */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Gallery */}
        <div className="md:col-span-5 space-y-3">
          <div className="bg-white border border-stone-200 rounded-2xl aspect-square overflow-hidden flex items-center justify-center p-2 shadow-sm">
            {activePhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activePhoto}
                alt={product.name}
                className="w-full h-full object-cover rounded-xl"
              />
            ) : (
              <Package className="w-16 h-16 text-stone-300" />
            )}
          </div>
          {product.photo_urls?.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {product.photo_urls.map((photo: string) => (
                <button
                  key={photo}
                  onClick={() => setActivePhoto(photo)}
                  className={`aspect-square rounded-lg border overflow-hidden transition-all ${
                    activePhoto === photo ? 'border-amber-600 ring-2 ring-amber-500/20' : 'border-stone-200'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info Column */}
        <div className="md:col-span-7 space-y-6">
          {/* Core Info */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <span className="text-[10px] font-bold font-mono text-amber-700 uppercase tracking-wider">{product.code}</span>
              <h2 className="text-xl font-bold text-stone-900 mt-1">{product.name}</h2>
              {product.description && <p className="text-xs text-stone-500 mt-2 leading-relaxed">{product.description}</p>}
            </div>

            {/* Financial Calculator */}
            <div className="border-t border-stone-100 pt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Reseller Cost</p>
                <p className="text-lg font-black text-stone-900 mt-1">₹{costRupees.toLocaleString('en-IN')}</p>
              </div>

              <div>
                <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Markup Price ({markup}%)</p>
                <p className="text-lg font-black text-amber-700 mt-1">₹{sellingPriceRupees.toLocaleString('en-IN')}</p>
              </div>

              <div className="col-span-2 sm:col-span-1 border-t sm:border-t-0 sm:border-l border-stone-100 pt-3 sm:pt-0 sm:pl-4">
                <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Your Profit Margin</p>
                <p className="text-lg font-black text-green-650 mt-1">₹{earningsRupees.toLocaleString('en-IN')}</p>
              </div>
            </div>

            {/* Range slider for interactive markup */}
            <div className="bg-stone-50 rounded-xl p-3 border border-stone-150 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-stone-500">
                <span>Adjust Selling Markup:</span>
                <span className="text-amber-700">{markup}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="1"
                className="w-full accent-amber-600 h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer"
                value={markup}
                onChange={e => setMarkup(e.target.value)}
              />
            </div>

            {/* Core Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href={`/portal/reseller/orders/new?product_id=${product.id}&markup=${markup}`}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-4 rounded-xl text-center shadow-sm flex items-center justify-center gap-2 text-sm transition-colors"
              >
                <Plus className="w-4 h-4" /> Place Customer Order
              </Link>
              <button
                onClick={() => setShowSampleModal(true)}
                className="flex-1 border border-stone-200 hover:border-amber-600 text-stone-700 font-bold py-3 px-4 rounded-xl text-center flex items-center justify-center gap-2 text-sm transition-colors bg-white"
              >
                <CreditCard className="w-4 h-4 text-stone-500" /> Request Sample Box
              </button>
            </div>
          </div>

          {/* WhatsApp share snippet builder */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-stone-900 text-sm pb-2 border-b border-stone-100 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-green-600" /> WhatsApp Marketing Message Builder
            </h3>
            <div className="space-y-3">
              <p className="text-xs text-stone-500 leading-relaxed">
                Configure markup above and copy/share the pre-formatted WhatsApp text snippet below directly to your customers.
              </p>
              <textarea
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-xs font-mono text-stone-750 bg-stone-50 h-32 focus:outline-none resize-none"
                value={customMsg}
                onChange={e => setCustomMsg(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleShareWhatsApp}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <MessageCircle className="w-4 h-4" /> Share on WhatsApp
                </button>
                <button
                  onClick={handleCopy}
                  className={`flex-1 border text-xs font-bold py-2.5 rounded-xl text-center flex items-center justify-center gap-1.5 transition-colors ${
                    copied ? 'bg-green-50 border-green-200 text-green-700' : 'border-stone-200 text-stone-650 hover:bg-stone-50'
                  }`}
                >
                  {copied ? 'Copied!' : 'Copy to Clipboard'}
                </button>
              </div>
            </div>
          </div>

          {/* Specifications */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-stone-900 text-sm pb-2 border-b border-stone-100 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-stone-400" /> Specifications &amp; Attributes
            </h3>
            {Object.keys(product.attributes || {}).length === 0 ? (
              <p className="text-stone-400 text-xs">No specifications set for this product.</p>
            ) : (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {Object.entries(product.attributes || {}).map(([key, val]) => {
                  const field = categorySchema.find(f => f.key === key)
                  const label = field ? field.label : key
                  const unit = field?.unit ? ` ${field.unit}` : ''

                  let displayVal = String(val)
                  if (typeof val === 'boolean') {
                    displayVal = val ? 'Yes' : 'No'
                  } else if (Array.isArray(val)) {
                    displayVal = val.join(', ')
                  }

                  return (
                    <div key={key} className="border-b border-stone-100 pb-2">
                      <dt className="text-xs text-stone-500 font-semibold">{label}</dt>
                      <dd className="text-xs font-bold text-stone-850 mt-0.5">{displayVal}{unit}</dd>
                    </div>
                  )
                })}
              </dl>
            )}
          </div>
        </div>
      </div>

      {/* Sample Request Modal */}
      {showSampleModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleRequestSample}
            className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-stone-900 text-sm">Request Sample Box</h4>
                <p className="text-xs text-stone-400 mt-0.5">Product SKU: {product.code}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSampleModal(false)}
                className="p-1 border border-stone-200 rounded-lg hover:bg-stone-50 text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              {sampleSuccess ? (
                <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl text-xs font-bold flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span>Sample request submitted successfully! Pending Admin approval.</span>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-2.5 p-3 bg-stone-50 border border-stone-150 rounded-xl text-stone-500 text-xs">
                    <Info className="w-4.5 h-4.5 text-stone-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      Your requested sample will be approved based on your performance tier and credit limit.
                      Credit limit will be blocked by ₹{costRupees.toLocaleString('en-IN')} (Trade Value) until returned.
                    </p>
                  </div>
                  <div>
                    <label className={lbl}>Special Notes / Ring Sizes</label>
                    <textarea
                      className={`${inp} h-24 resize-none`}
                      value={sampleNotes}
                      onChange={e => setSampleNotes(e.target.value)}
                      placeholder="Specify sizes or details if any..."
                    />
                  </div>
                </>
              )}
            </div>

            {!sampleSuccess && (
              <div className="p-4 border-t border-stone-100 bg-stone-50 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSampleModal(false)}
                  className="px-4 py-2 border border-stone-200 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 bg-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSample}
                  className="bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold px-5 py-2 rounded-xl transition-colors disabled:opacity-50"
                >
                  {submittingSample ? 'Submitting...' : 'Confirm Request'}
                </button>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  )
}
