'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function PortalProductPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const productId = params.id as string
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedKarat, setSelectedKarat] = useState('18')
  const [selectedSize, setSelectedSize] = useState('')
  const [selectedImage, setSelectedImage] = useState(0)
  const [whatsappNumber, setWhatsappNumber] = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: p }, { data: settings }] = await Promise.all([
        supabase.from('products').select('*').eq('id', productId).eq('is_active', true).single(),
        supabase.from('settings').select('key, value').in('key', ['whatsapp_number', 'business_name']),
      ])
      setProduct(p)
      const wa = settings?.find((s: any) => s.key === 'whatsapp_number')?.value || ''
      setWhatsappNumber(wa)
      if (p?.gold_karat) setSelectedKarat(String(p.gold_karat))
      setLoading(false)
    }
    load()
  }, [productId])

  function buildWhatsAppLink() {
    const pageUrl = window.location.href
    const message = encodeURIComponent(
      `Hi Shewah! I'm interested in this design:\n\n` +
      `*${product?.name}* (${product?.code})\n` +
      `Gold: ${selectedKarat}K\n` +
      `Ring Size: ${selectedSize || 'Please advise'}\n` +
      `Diamond: ${product?.diamond_weight}ct ${product?.diamond_shape}\n\n` +
      `Design link: ${pageUrl}\n\n` +
      `Please share pricing and availability.`
    )
    return `https://wa.me/${whatsappNumber}?text=${message}`
  }

  const RING_SIZES = ['5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22']

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F2EA]">
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl bg-[#C49C64] flex items-center justify-center mx-auto mb-3">
          <span className="text-white text-xl font-bold">S</span>
        </div>
        <p className="text-stone-500 text-sm">Loading design...</p>
      </div>
    </div>
  )

  if (!product) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F2EA]">
      <div className="text-center px-6">
        <p className="text-stone-400 text-lg mb-2">Design not found</p>
        <p className="text-stone-300 text-sm">This design may be unavailable or the link may be incorrect</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F7F2EA]">
      {/* Header */}
      <header className="bg-[#1C1A17] px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#C49C64] flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Shewah</p>
            <p className="text-white/40 text-xs">Fine Jewelry</p>
          </div>
        </div>
        <a href={buildWhatsAppLink()} target="_blank" rel="noreferrer"
          className="flex items-center gap-2 bg-[#25D366] text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-[#1ebe57] transition-colors">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Enquire Now
        </a>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">

        {/* Product code badge */}
        <div className="text-center mb-4">
          <span className="text-xs text-[#9B7A40] bg-[#F2E8D5] px-3 py-1 rounded-full font-medium">
            {product.code}
          </span>
        </div>

        {/* Image gallery */}
        <div className="bg-white rounded-2xl overflow-hidden border border-stone-200 mb-6">
          {product.photo_urls && product.photo_urls.length > 0 ? (
            <>
              <div className="aspect-square">
                <img src={product.photo_urls[selectedImage]} alt={product.name}
                  className="w-full h-full object-cover" />
              </div>
              {product.photo_urls.length > 1 && (
                <div className="flex gap-2 p-3 overflow-x-auto">
                  {product.photo_urls.map((url: string, i: number) => (
                    <button key={i} onClick={() => setSelectedImage(i)}
                      className={`w-14 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition-colors ${selectedImage === i ? 'border-[#C49C64]' : 'border-transparent'}`}>
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="aspect-square bg-gradient-to-br from-stone-50 to-yellow-50 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-2">◆</div>
                <p className="text-stone-300 text-sm">Photo coming soon</p>
              </div>
            </div>
          )}
        </div>

        {/* Product info */}
        <div className="mb-5">
          <h1 className="text-2xl font-semibold text-stone-900 mb-1">{product.name}</h1>
          <p className="text-stone-500 text-sm mb-4">{product.description}</p>

          {/* Key specs */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Diamond', value: `${product.diamond_weight}ct ${product.diamond_shape || ''}` },
              { label: 'Certification', value: product.diamond_type === 'lgd' ? 'IGI Certified LGD' : 'IGI Certified' },
              { label: 'Clarity', value: product.diamond_quality || '—' },
              { label: 'Color', value: product.diamond_color || '—' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl p-3 border border-stone-100">
                <p className="text-xs text-stone-400">{s.label}</p>
                <p className="text-sm font-medium text-stone-800 mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Karat selector */}
        <div className="mb-4">
          <p className="text-sm font-medium text-stone-700 mb-2">Gold karat</p>
          <div className="flex gap-2">
            {['14', '18', '22'].map(k => (
              <button key={k} onClick={() => setSelectedKarat(k)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  selectedKarat === k
                    ? 'bg-[#C49C64] text-white border-[#C49C64]'
                    : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
                }`}>
                {k}K Gold
              </button>
            ))}
          </div>
          <p className="text-xs text-stone-400 mt-1.5">
            {selectedKarat === '14' ? '58.5% pure gold — great for daily wear' : selectedKarat === '18' ? '75% pure gold — classic choice' : '91.6% pure gold — traditional standard'}
          </p>
        </div>

        {/* Ring size */}
        <div className="mb-6">
          <p className="text-sm font-medium text-stone-700 mb-2">Ring size (Indian)</p>
          <div className="flex flex-wrap gap-1.5">
            {RING_SIZES.map(s => (
              <button key={s} onClick={() => setSelectedSize(s)}
                className={`w-10 h-10 rounded-lg text-sm font-medium border transition-all ${
                  selectedSize === s
                    ? 'bg-[#C49C64] text-white border-[#C49C64]'
                    : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                }`}>
                {s}
              </button>
            ))}
          </div>
          <p className="text-xs text-stone-400 mt-1.5">Don't know your size? Mention it in WhatsApp — we'll guide you</p>
        </div>

        {/* Delivery info */}
        <div className="bg-[#F2E8D5] rounded-xl p-4 mb-6 flex items-center gap-3">
          <div className="text-2xl">◆</div>
          <div>
            <p className="text-sm font-medium text-[#6B5228]">Made-to-order in Surat</p>
            <p className="text-xs text-[#9B7A40]">Each piece is custom made · Delivery in {product.delivery_days || 14}–{(product.delivery_days || 14) + 7} days · BIS Hallmarked · IGI Certified</p>
          </div>
        </div>

        {/* WhatsApp CTA */}
        <a href={buildWhatsAppLink()} target="_blank" rel="noreferrer"
          className="block w-full bg-[#25D366] text-white text-center py-4 rounded-2xl text-base font-semibold hover:bg-[#1ebe57] transition-colors mb-3">
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Enquire on WhatsApp
          </span>
        </a>
        <p className="text-center text-xs text-stone-400">
          Your selected options (karat + size) will be pre-filled in the message
        </p>
      </div>
    </div>
  )
}
