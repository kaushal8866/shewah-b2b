'use client'

import { useEffect, useState } from 'react'
import { supabase, Product } from '@/lib/supabase'
import { Package, Search } from 'lucide-react'
import Link from 'next/link'

export default function PartnerCatalog() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [partnerId, setPartnerId] = useState<string | null>(null)
  const [accessStatus, setAccessStatus] = useState<'granted' | 'requested' | 'denied'>('denied')
  const [accessExpiry, setAccessExpiry] = useState<string | null>(null)
  
  const [search, setSearch] = useState('')
  const [karatFilter, setKaratFilter] = useState('all')
  
  // Ordering logic
  const [orderingProduct, setOrderingProduct] = useState<Product | null>(null)
  const [advanceRef, setAdvanceRef] = useState('')
  const [orderSaving, setOrderSaving] = useState(false)

  useEffect(() => { loadAccessAndProducts() }, [])

  async function loadAccessAndProducts() {
    setLoading(true)
    const { data: p } = await supabase.from('partners').select('id').single()
    if (!p) { setLoading(false); return }
    setPartnerId(p.id)

    // Check access
    const { data: requests } = await supabase.from('catalog_access_requests')
      .select('*').eq('partner_id', p.id).order('created_at', { ascending: false }).limit(1)

    let hasAccess = false
    if (requests && requests.length > 0) {
      const req = requests[0]
      if (req.status === 'approved' && new Date(req.expires_at) > new Date()) {
        hasAccess = true
        setAccessStatus('granted')
        setAccessExpiry(req.expires_at)
      } else if (req.status === 'pending') {
        setAccessStatus('requested')
      }
    }

    if (hasAccess) {
      const { data } = await supabase.from('products').select('*').eq('is_active', true).order('code')
      setProducts(data || [])
    }
    
    setLoading(false)
  }

  async function handleRequestAccess() {
    if (!partnerId) return
    setLoading(true)
    await supabase.from('catalog_access_requests').insert([{ partner_id: partnerId }])
    setAccessStatus('requested')
    setLoading(false)
  }

  async function handlePlaceOrder(e: React.FormEvent) {
    e.preventDefault()
    if (!partnerId || !orderingProduct || !advanceRef) return
    setOrderSaving(true)

    const { count } = await supabase.from('order_pipeline').select('*', { count: 'exact', head: true })
    const num = `SH-ORD-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`

    const { error } = await supabase.from('order_pipeline').insert([{
      partner_id: partnerId,
      product_id: orderingProduct.id,
      order_number: num,
      type: 'catalog',
      model: 'wholesale',
      trade_price: orderingProduct.trade_price || 0,
      total_amount: orderingProduct.trade_price || 0,
      status: 'brief_received',
      advance_reference_number: advanceRef,
    }])

    setOrderSaving(false)
    if (error) {
      alert('Order failed: ' + error.message)
    } else {
      alert('Order placed successfully.')
      setOrderingProduct(null)
      setAdvanceRef('')
    }
  }

  const filtered = products.filter(p => {
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.diamond_shape?.toLowerCase().includes(search.toLowerCase())
    const matchKarat = karatFilter === 'all' || String(p.gold_karat) === karatFilter
    return matchSearch && matchKarat
  })

  if (loading) {
    return <div className="p-12 text-secondary animate-pulse text-sm">Loading signature collections...</div>
  }

  return (
    <div className="p-6 md:p-12 lg:p-24 max-w-7xl mx-auto font-sans">
      <div className="mb-16">
        <span className="text-[10px] uppercase tracking-[0.2em] text-secondary font-bold">Catalog 0.1</span>
        <h1 className="text-4xl lg:text-6xl font-serif text-primary mt-4 tracking-tight leading-none mb-6">
          Signature Collections
        </h1>
        <p className="text-secondary font-light max-w-xl text-lg leading-relaxed">
          {accessStatus === 'granted' 
            ? `Browse our curated architectural models. Access expires strictly on ${new Date(accessExpiry!).toLocaleString()}.`
            : 'Access to the Shewah Signature Collection is tightly restricted. Provide structural intent to gain 24-hour clearance.'}
        </p>
      </div>

      {accessStatus !== 'granted' ? (
        <div className="bg-surface-lowest p-16 text-center border border-outline-variant/30 shadow-ambient max-w-2xl mx-auto">
          <Package className="w-12 h-12 text-primary mx-auto mb-6" />
          <h2 className="text-2xl font-serif text-primary mb-2">Vault Locked</h2>
          <p className="text-sm text-secondary mb-8">
            {accessStatus === 'requested' 
              ? 'Your clearance authorization is currently pending administrative review. Please check back later.'
              : 'Our collections are protected intellectual property. Request temporary access to view the catalog.'}
          </p>
          {accessStatus !== 'requested' && (
            <button onClick={handleRequestAccess}
              className="bg-primary text-surface-lowest px-10 py-4 uppercase text-[10px] tracking-[0.2em] font-bold hover:bg-surface-highest hover:text-primary transition-all duration-300">
              Request 24-Hour Clearance
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-4 mb-12 border-b border-outline-variant/30 pb-8">
        <div className="relative w-full sm:flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline-variant" />
          <input type="text" placeholder="Search by name, code, or diamond shape..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-surface-highest border border-outline-variant/20 focus:border-primary text-sm outline-none transition-colors" />
        </div>
        <select value={karatFilter} onChange={e => setKaratFilter(e.target.value)}
          className="w-full sm:w-48 bg-surface-highest border border-outline-variant/20 focus:border-primary px-4 py-4 text-sm outline-none transition-colors appearance-none cursor-pointer">
          <option value="all">Any Karat</option>
          <option value="14">14K Hardened</option>
          <option value="18">18K High-Grade</option>
          <option value="22">22K Fine Value</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface-lowest p-16 text-center border-dashed border border-outline-variant/30">
          <Package className="w-8 h-8 text-outline-variant mx-auto mb-4" />
          <p className="text-secondary tracking-widest text-xs uppercase">No architectural models found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map(p => (
            <div key={p.id} className="group cursor-pointer">
              <div className="aspect-square bg-surface-lowest flex items-center justify-center relative overflow-hidden border border-outline-variant/10 group-hover:border-primary/40 transition-colors">
                {p.photo_urls && p.photo_urls.length > 0 ? (
                  <img src={p.photo_urls[0]} alt={p.name} className="w-full h-full object-cover grayscale mix-blend-multiply opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700" />
                ) : (
                  <div className="text-center">
                    <div className="text-4xl mb-1 text-primary">◆</div>
                  </div>
                )}
                
                {/* Overlay UI elements */}
                <div className="absolute top-4 left-4">
                  <span className="bg-surface-lowest text-primary text-[9px] uppercase tracking-widest font-bold px-3 py-1.5 shadow-sm border border-outline-variant/10">
                    {p.code}
                  </span>
                </div>
                
                <div className="absolute bottom-4 right-4">
                  <span className="bg-primary text-surface-lowest text-[9px] uppercase tracking-widest font-bold px-3 py-1.5">
                    {p.gold_karat}K Gold
                  </span>
                </div>
              </div>

              <div className="pt-5 pb-8 border-b border-t-0 border-r-0 border-l-0 border-outline-variant/20 hover:border-primary/40 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-serif text-primary truncate pr-4">{p.name}</h3>
                  <p className="text-sm font-medium text-primary shrink-0">
                    {p.trade_price ? `₹${(p.trade_price/1000).toFixed(0)}K` : 'TBD'}
                  </p>
                </div>
                <p className="text-xs text-secondary mb-3">
                  {p.diamond_weight}ct {p.diamond_shape}
                </p>
                <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest">
                  <span className="text-secondary">{p.delivery_days} Day Manifestation</span>
                  <button onClick={() => setOrderingProduct(p)} className="text-primary hover:text-secondary flex items-center gap-2 transition-colors">
                    Place Order →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Order Modal */}
      {orderingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface/90 backdrop-blur-sm">
          <div className="bg-surface-lowest border border-outline-variant/30 p-8 max-w-md w-full shadow-ambient relative">
            <h2 className="text-2xl font-serif text-primary mb-2">Initialize Production</h2>
            <p className="text-sm text-secondary mb-6">{orderingProduct.name} ({orderingProduct.code})</p>
            
            <form onSubmit={handlePlaceOrder} className="space-y-6">
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-widest text-secondary mb-2">Advance Payment Reference *</label>
                <input required className="w-full bg-surface-highest border-b border-outline-variant/40 focus:border-primary px-0 py-3 text-sm outline-none transition-colors" 
                  placeholder="Txn ID / UTR Number" value={advanceRef} onChange={e => setAdvanceRef(e.target.value)} />
                <p className="text-xs text-secondary mt-2 font-light">Order processing commences strictly after advance validation.</p>
              </div>
              <div className="flex justify-end gap-4 pt-4">
                <button type="button" onClick={() => setOrderingProduct(null)} className="px-6 py-3 text-[10px] uppercase tracking-widest font-bold text-secondary hover:text-primary">Cancel</button>
                <button type="submit" disabled={orderSaving} className="bg-primary text-surface-lowest px-8 py-3 uppercase text-[10px] tracking-[0.2em] font-bold hover:bg-surface-highest hover:text-primary transition-all disabled:opacity-50">
                  {orderSaving ? 'Processing...' : 'Confirm Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </>
    )}
  </div>
  )
}
