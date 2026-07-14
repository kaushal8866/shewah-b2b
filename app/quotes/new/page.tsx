'use client'

import { useEffect, useState, Suspense, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { uploadToCloudinary } from '@/lib/cloudinaryUpload'
import { DiamondCatalogPicker } from '@/components/DiamondCatalogPicker'
import { ArrowLeft, Save, Plus, Trash2, Upload, FileText, Share2, HelpCircle } from 'lucide-react'
import Link from 'next/link'
import { DEFAULT_QUOTE_MARGIN_PCT, DEFAULT_QUOTE_GST_RATE_PCT, DEFAULT_QUOTE_TERMS } from '@/lib/quoteDefaults'
import { getMetalWeight, pureGoldMass, KARAT_FACTORS } from '@/lib/karat'

interface Partner {
  id: string
  owner_name: string | null
  store_name: string | null
  city: string | null
  phone: string | null
}

interface MfgPartner {
  id: string
  name: string
  city: string | null
  labour_rate_9k: number | null
  labour_rate_10k: number | null
  labour_rate_14k: number | null
  labour_rate_18k: number | null
  labour_rate_22k: number | null
}

interface ProductPreset {
  id: string
  code: string
  name: string
  category: string | null
  gold_weight_g: number | null
  making_charges: number | null
  diamond_cost: number | null
  photo_urls: string[] | null
}

interface DiamondRow {
  id: string
  shape_id: string
  shape_name: string
  size_id: string
  size_label: string
  role: 'center' | 'side' | 'accent' | 'melee'
  weight: string
  pieces: string
  quality_id: string
  color_id: string
  type: 'lgd' | 'natural'
  rate_per_pc: string
  igi_charge: string
  is_suggested?: boolean
}

interface QuoteItem {
  id: string
  product_id: string | null
  name: string
  category: string
  ring_size: string
  quantity: string
  karat: string
  gross_gold_weight_g: string
  gold_rate_24k: string
  labour_source: 'partner' | 'manual'
  labour_partner_id: string | null
  labour_rate_per_g: string
  making_charges: string
  hallmarking: string
  other_charges: string
  other_charges_label: string
  diamonds: DiamondRow[]
  reference_images: string[]
  metal_weights?: any
}

function QuoteBuilderForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('id') || searchParams.get('edit')

  // Data lookups
  const [partners, setPartners] = useState<Partner[]>([])
  const [karigars, setKarigars] = useState<MfgPartner[]>([])
  const [products, setProducts] = useState<ProductPreset[]>([])
  const [latestGoldRate, setLatestGoldRate] = useState<number>(0)
  const [qualityBuckets, setQualityBuckets] = useState<{ id: string; label: string }[]>([])
  const [colorBuckets, setColorBuckets] = useState<{ id: string; label: string }[]>([])
  const [silverRateB2B, setSilverRateB2B] = useState<number>(80)
  const [silverRateD2C, setSilverRateD2C] = useState<number>(120)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isBreakupOpen, setIsBreakupOpen] = useState(false)

  // Header State
  const [partnerId, setPartnerId] = useState('')
  const [isWalkIn, setIsWalkIn] = useState(false)
  const [customerMode, setCustomerMode] = useState<'partner' | 'd2c' | 'walk_in'>('partner')
  const [d2cCustomers, setD2cCustomers] = useState<any[]>([])
  const [selectedD2cCustomerId, setSelectedD2cCustomerId] = useState('')
  const [walkInName, setWalkInName] = useState('')
  const [walkInPhone, setWalkInPhone] = useState('')
  const [walkInCity, setWalkInCity] = useState('')
  const [referenceNo, setReferenceNo] = useState('')
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0, 10))

  // D2C customer quick-create modal states
  const [showCreateD2c, setShowCreateD2c] = useState(false)
  const [newD2cName, setNewD2cName] = useState('')
  const [newD2cWhatsapp, setNewD2cWhatsapp] = useState('')
  const [newD2cCity, setNewD2cCity] = useState('')
  const [creatingD2c, setCreatingD2c] = useState(false)
  const [d2cError, setD2cError] = useState<string | null>(null)
  
  // Default valid until is 30 days from now
  const defaultValidUntil = () => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().slice(0, 10)
  }
  const [validUntil, setValidUntil] = useState(defaultValidUntil())

  // Quote-level settings
  const [marginPct, setMarginPct] = useState(String(DEFAULT_QUOTE_MARGIN_PCT))
  const [gstTreatment, setGstTreatment] = useState<'exclusive' | 'inclusive' | 'none'>('exclusive')
  const [gstRatePct, setGstRatePct] = useState(String(DEFAULT_QUOTE_GST_RATE_PCT))
  const [showBreakup, setShowBreakup] = useState(true)
  const [show24ktColumn, setShow24ktColumn] = useState(true)
  const [coverNote, setCoverNote] = useState('')
  const [termsText, setTermsText] = useState(DEFAULT_QUOTE_TERMS)

  // Items State
  const [items, setItems] = useState<QuoteItem[]>([createBlankItem()])

  // Live preview pricing state
  const [previewTotals, setPreviewTotals] = useState({
    subtotal: 0,
    gst_amount: 0,
    grand_total: 0,
    cogs_total: 0,
    suggested_mrp_total: 0,
  })

  // Consolidate live quote items for detailed price breakup drawer preview
  const priceBreakup = useMemo(() => {
    if (items.length === 0) return null

    let totalGoldWeight = 0
    let totalGoldValue = 0
    let totalDiamondCount = 0
    let totalDiamondWeight = 0
    let totalDiamondValue = 0
    let totalLabour = 0
    let totalMaking = 0
    let totalHallmarking = 0
    let totalOther = 0
    
    const uniqueKarats = new Set<string>()
    let goldRateSum = 0
    let goldRateCount = 0

    const diaGroups: Record<string, {
      size_label: string
      color: string
      clarity: string
      shape: string
      count: number
      price: number
      weight: number
    }> = {}

    items.forEach(item => {
      const qty = Math.max(parseInt(item.quantity, 10) || 1, 1)
      const grossWeight = Math.max(parseFloat(item.gross_gold_weight_g) || 0, 0)
      const isSilver = String(item.karat).toLowerCase() === 'silver'
      
      let karatLabel = item.karat
      if (!isSilver) {
        uniqueKarats.add(karatLabel.includes('K') ? karatLabel : `${karatLabel}K`)
      } else {
        uniqueKarats.add('Silver')
      }

      const goldRate = Math.max(parseFloat(item.gold_rate_24k) || 0, 0)
      const karatNum = parseInt(String(item.karat).replace(/[^\d]/g, '')) || 24
      const karatFactor = isSilver ? 1 : (KARAT_FACTORS[karatNum] || 1)
      const itemGoldRate = goldRate * karatFactor
      if (itemGoldRate > 0) {
        goldRateSum += itemGoldRate * grossWeight * qty
        goldRateCount += grossWeight * qty
      }

      let goldCostPerPc = 0
      if (isSilver) {
        goldCostPerPc = grossWeight * goldRate
      } else {
        const net24kt = pureGoldMass(grossWeight, item.karat)
        goldCostPerPc = net24kt * goldRate
      }
      totalGoldWeight += grossWeight * qty
      totalGoldValue += Math.round(goldCostPerPc) * qty

      const labourRate = Math.max(parseFloat(item.labour_rate_per_g) || 0, 0)
      totalLabour += Math.round(labourRate * grossWeight) * qty

      totalMaking += (Math.max(parseFloat(item.making_charges) || 0, 0)) * qty
      totalHallmarking += (Math.max(parseFloat(item.hallmarking) || 0, 0)) * qty
      totalOther += (Math.max(parseFloat(item.other_charges) || 0, 0)) * qty

      const margin = 1 + (parseFloat(marginPct) || 0) / 100

      if (Array.isArray(item.diamonds)) {
        item.diamonds.forEach(d => {
          const pieces = Math.max(parseInt(d.pieces, 10) || 0, 0)
          const weight = Math.max(parseFloat(d.weight) || 0, 0)
          const rate   = Math.max(parseFloat(d.rate_per_pc) || 0, 0)
          const igi    = Math.max(parseFloat(d.igi_charge) || 0, 0)

          const rowWeight  = pieces * weight            // total carats for this row
          // rate_per_pc = price per piece — do NOT multiply by carat weight
          const cogsCost   = (pieces * rate) + igi
          const tradeCost  = Math.round(cogsCost * margin)

          totalDiamondCount  += pieces * qty
          totalDiamondWeight += rowWeight * qty
          totalDiamondValue  += tradeCost * qty

          const key = `${d.size_label || '—'}_${d.color_id || '—'}_${d.quality_id || '—'}_${d.shape_name || '—'}_${rate}`
          if (!diaGroups[key]) {
            diaGroups[key] = {
              size_label: d.size_label || '—',
              color: d.color_id || '—',
              clarity: d.quality_id || '—',
              shape: d.shape_name || '—',
              count: 0,
              price: rate,
              weight: 0
            }
          }
          diaGroups[key].count  += pieces * qty
          diaGroups[key].weight += rowWeight * qty
        })
      }
    })

    const gold_component = Array.from(uniqueKarats).join(', ') || 'Gold'
    let fallbackRate = 0
    if (items.length > 0) {
      const first = items[0]
      const isSilver = String(first.karat).toLowerCase() === 'silver'
      const karatNum = parseInt(String(first.karat).replace(/[^\d]/g, '')) || 24
      const karatFactor = isSilver ? 1 : (KARAT_FACTORS[karatNum] || 1)
      fallbackRate = Math.round((parseFloat(first.gold_rate_24k) || 0) * karatFactor)
    }
    const gold_rate = goldRateCount > 0 ? Math.round(goldRateSum / goldRateCount) : fallbackRate
    const making_charges_combined = totalLabour + totalMaking + totalHallmarking + totalOther
    
    const base_total = totalGoldValue + totalDiamondValue + making_charges_combined
    const gstRate = Math.max(parseFloat(gstRatePct) || 0, 0) / 100
    let gstAmount = 0
    let grandTotal = base_total

    if (gstTreatment === 'exclusive') {
      gstAmount = Math.round(base_total * gstRate)
      grandTotal = base_total + gstAmount
    } else if (gstTreatment === 'inclusive') {
      grandTotal = base_total
      gstAmount = Math.round(grandTotal - (grandTotal / (1 + gstRate)))
    } else {
      gstAmount = 0
      grandTotal = base_total
    }

    return {
      gold_component,
      gold_rate,
      gold_weight: totalGoldWeight,
      gold_value: totalGoldValue,
      diamond_component: 'Diamond',
      diamond_count: totalDiamondCount,
      diamond_weight: totalDiamondWeight,
      diamond_value: totalDiamondValue,
      making_charges: making_charges_combined,
      total: base_total,
      sub_total: base_total,
      gst: gstAmount,
      final_value: grandTotal,
      diamond_specs: Object.values(diaGroups)
    }
  }, [items, marginPct, gstTreatment, gstRatePct])


  // Load setup data
  useEffect(() => {
    async function loadData() {
      try {
        const [resPartners, resKarigars, resProducts, resGold, resQualities, resColors, resSilverRates, resD2cCustomers] = await Promise.all([
          supabase.from('partners').select('id, owner_name, store_name, city, phone').order('store_name'),
          supabase.from('manufacturing_partners').select('id, name, city, labour_rate_9k, labour_rate_10k, labour_rate_14k, labour_rate_18k, labour_rate_22k').eq('status', 'active'),
          supabase.from('products').select('id, code, name, category, gold_weight_g, making_charges, diamond_cost, photo_urls, metal_type, metal_weights, ref_karat, ref_color').order('name'),
          supabase.from('gold_rates').select('rate_24k').order('recorded_at', { ascending: false }).limit(1),
          fetch('/api/diamonds/quality-buckets').then(r => r.json().catch(() => ({ buckets: [] }))),
          fetch('/api/diamonds/color-buckets').then(r => r.json().catch(() => ({ buckets: [] }))),
          supabase.from('settings').select('key, value').in('key', ['silver_rate_b2b', 'silver_rate_d2c']),
          supabase.from('customers').select('id, full_name, whatsapp, city').is('archived_at', null).order('full_name')
        ])

        if (resPartners.data) setPartners(resPartners.data)
        if (resKarigars.data) setKarigars(resKarigars.data)
        if (resProducts.data) setProducts(resProducts.data)
        if (resGold.data?.[0]) setLatestGoldRate(Number(resGold.data[0].rate_24k) || 0)
        if (resQualities?.buckets) setQualityBuckets(resQualities.buckets)
        if (resColors?.buckets) setColorBuckets(resColors.buckets)
        if (resD2cCustomers.data) setD2cCustomers(resD2cCustomers.data)

        if (resSilverRates.data) {
          const b2b = resSilverRates.data.find((d: any) => d.key === 'silver_rate_b2b')?.value
          const d2c = resSilverRates.data.find((d: any) => d.key === 'silver_rate_d2c')?.value
          if (b2b) setSilverRateB2B(Number(b2b))
          if (d2c) setSilverRateD2C(Number(d2c))
        }

        // If editing, load the quote
        if (editId) {
          const resQuote = await fetch(`/api/quotes/${editId}`)
          if (resQuote.ok) {
            const { quote, items: loadedItems } = await resQuote.json()
            
            // Set header fields
            if (quote.partner_id) {
              setCustomerMode('partner')
              setIsWalkIn(false)
              setPartnerId(quote.partner_id)
            } else if (quote.customer_id) {
              setCustomerMode('d2c')
              setIsWalkIn(true)
              setSelectedD2cCustomerId(quote.customer_id)
            } else {
              setCustomerMode('walk_in')
              setIsWalkIn(true)
            }
            setWalkInName(quote.walk_in_name || '')
            setWalkInPhone(quote.walk_in_phone || '')
            setWalkInCity(quote.walk_in_city || '')
            setReferenceNo(quote.reference_no || '')
            setQuoteDate(quote.quote_date)
            setValidUntil(quote.valid_until)
            setMarginPct(String(quote.margin_pct))
            setGstTreatment(quote.gst_treatment)
            setGstRatePct(String(quote.gst_rate_pct))
            setShowBreakup(quote.show_breakup)
            setShow24ktColumn(quote.show_24kt_column)
            setCoverNote(quote.cover_note || '')
            setTermsText(quote.terms_text || '')

            // Map loaded items
            if (loadedItems && loadedItems.length > 0) {
              const mapped = loadedItems.map((item: any) => ({
                id: item.id,
                product_id: item.product_id,
                name: item.name,
                category: item.category || 'Ring',
                ring_size: item.ring_size || '',
                quantity: String(item.quantity),
                karat: String(item.karat),
                gross_gold_weight_g: String(item.gross_gold_weight_g),
                gold_rate_24k: String(item.gold_rate_24k),
                labour_source: item.labour_source || 'partner',
                labour_partner_id: item.labour_partner_id,
                labour_rate_per_g: String(item.labour_rate_per_g),
                making_charges: String(item.making_charges),
                hallmarking: String(item.hallmarking),
                other_charges: String(item.other_charges),
                other_charges_label: item.other_charges_label || '',
                reference_images: item.reference_images || [],
                diamonds: (item.diamonds || []).map((d: any) => ({
                  id: d.id || Math.random().toString(36).substring(7),
                  shape_id: d.shape_id || '',
                  size_id: d.size_id || '',
                  size_label: d.size_label || '',
                  role: d.role || 'center',
                  weight: d.approx_carats ? String(d.approx_carats) : (d.weight ? String(d.weight) : ''),
                  pieces: String(d.pieces || 1),
                  quality_id: d.quality_id || 'VS',
                  color_id: d.color_id || 'F-G',
                  type: d.type || 'lgd',
                  rate_per_pc: String(d.rate_per_pc || 0),
                  igi_charge: String(d.igi_charge || 0),
                }))
              }))
              setItems(mapped)
            }
          }
        } else {
          // If creating new, default the gold rate on the first blank item
          if (resGold.data?.[0]) {
            setItems([createBlankItem(Number(resGold.data[0].rate_24k))])
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingInitial(false)
      }
    }
    loadData()
  }, [editId])

  // Recalculate live preview whenever form details modify
  useEffect(() => {
    if (loadingInitial) return
    const timeout = setTimeout(() => {
      runLivePreview()
    }, 300)
    return () => clearTimeout(timeout)
  }, [items, marginPct, gstTreatment, gstRatePct, loadingInitial])

  async function runLivePreview() {
    try {
      const payload = {
        margin_pct: parseFloat(marginPct) || 0,
        gst_treatment: gstTreatment,
        gst_rate_pct: parseFloat(gstRatePct) || 0,
        items: items.map(i => ({
          gross_gold_weight_g: parseFloat(i.gross_gold_weight_g) || 0,
          karat: i.karat,
          gold_rate_24k: parseFloat(i.gold_rate_24k) || 0,
          labour_rate_per_g: parseFloat(i.labour_rate_per_g) || 0,
          making_charges: parseFloat(i.making_charges) || 0,
          hallmarking: parseFloat(i.hallmarking) || 0,
          other_charges: parseFloat(i.other_charges) || 0,
          quantity: parseInt(i.quantity, 10) || 1,
          metal_weights: i.metal_weights || null,
          diamonds: i.diamonds.map(d => ({
            pieces: parseInt(d.pieces, 10) || 0,
            rate_per_pc: parseFloat(d.rate_per_pc) || 0,
            igi_charge: parseFloat(d.igi_charge) || 0,
            weight: parseFloat(d.weight) || 0,
          }))
        }))
      }

      const res = await fetch('/api/quotes/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        const d = await res.json()
        
        // Sum COGS and MRP
        let cogsTotal = 0
        let mrpTotal = 0
        if (d.items) {
          d.items.forEach((item: any) => {
            cogsTotal += item.line_cogs || 0
            // suggested mrp is trade_price * 1.40
            mrpTotal += (item.line_trade * 1.40) * (item.quantity || 1)
          })
        }

        setPreviewTotals({
          subtotal: d.subtotal || 0,
          gst_amount: d.gst_amount || 0,
          grand_total: d.grand_total || 0,
          cogs_total: cogsTotal,
          suggested_mrp_total: mrpTotal,
        })
      }
    } catch (err) {
      console.error('Failed to run preview calculator:', err)
    }
  }

  function createBlankItem(goldRate: number = latestGoldRate): QuoteItem {
    return {
      id: Math.random().toString(36).substring(7),
      product_id: null,
      name: '',
      category: 'Ring',
      ring_size: '',
      quantity: '1',
      karat: '18K',
      gross_gold_weight_g: '',
      gold_rate_24k: goldRate ? String(goldRate) : '',
      labour_source: 'partner',
      labour_partner_id: null,
      labour_rate_per_g: '',
      making_charges: '',
      hallmarking: '45', // Standard Hallmark charge in INR
      other_charges: '',
      other_charges_label: '',
      reference_images: [],
      diamonds: []
    }
  }

  function handleAddItem() {
    setItems(prev => [...prev, createBlankItem()])
  }

  function handleRemoveItem(id: string) {
    if (items.length === 1) return
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function updateItemField(id: string, field: keyof QuoteItem, value: any) {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const next = { ...item, [field]: value }

      // If karat was modified, check if we need to adjust partner labour rate or metal rates
      if (field === 'karat') {
        if (value === 'Silver') {
          const defaultRate = isWalkIn ? silverRateD2C : silverRateB2B
          next.gold_rate_24k = String(defaultRate || '80')
        } else if (item.karat === 'Silver') {
          next.gold_rate_24k = String(latestGoldRate || '0')
        }

        if (item.product_id && item.metal_weights && Object.keys(item.metal_weights).length > 0) {
          const isSil = value === 'Silver'
          if (isSil) {
            next.gross_gold_weight_g = String(getMetalWeight(item.metal_weights, 'silver_925', 'default') || '')
          } else {
            const karatStr = value.endsWith('K') ? value : `${value}K`
            next.gross_gold_weight_g = String(getMetalWeight(item.metal_weights, karatStr, 'yellow') || '')
          }
        }

        if (item.labour_source === 'partner' && item.labour_partner_id) {
          const selectedKarigar = karigars.find(k => k.id === item.labour_partner_id)
          if (selectedKarigar) {
            const karatKey = `labour_rate_${value.toLowerCase()}` as keyof MfgPartner
            next.labour_rate_per_g = String(selectedKarigar[karatKey] || '')
          }
        }
      }

      // If labour partner was modified and source is partner, prefill their rate
      if (field === 'labour_partner_id' && item.labour_source === 'partner') {
        const selectedKarigar = karigars.find(k => k.id === value)
        if (selectedKarigar) {
          const karatKey = `labour_rate_${item.karat.toLowerCase()}` as keyof MfgPartner
          next.labour_rate_per_g = String(selectedKarigar[karatKey] || '')
        }
      }

      return next as QuoteItem
    }))
  }

  function handleSetWalkIn(val: boolean) {
    setIsWalkIn(val)
    setItems(prev => prev.map(item => {
      if (item.karat === 'Silver') {
        const defaultRate = val ? silverRateD2C : silverRateB2B
        return { ...item, gold_rate_24k: String(defaultRate || '80') }
      }
      return item
    }))
  }

  // Handle preset loading when product is selected
  function handlePullFromCatalog(itemId: string, productId: string) {
    const prod = products.find(p => p.id === productId)
    if (!prod) return

    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      
      const isSilverProd = (prod as any).metal_type === 'silver'
      const defaultKarat = isSilverProd ? ((prod as any).ref_karat || 'silver_925') : '18K'
      const defaultColor = isSilverProd ? 'default' : 'yellow'
      
      let initialWeight = prod.gold_weight_g ? String(prod.gold_weight_g) : ''
      if ((prod as any).metal_weights && Object.keys((prod as any).metal_weights).length > 0) {
        initialWeight = String(getMetalWeight((prod as any).metal_weights, isSilverProd ? defaultKarat : '18K', defaultColor) || initialWeight)
      }

      const next = {
        ...item,
        product_id: prod.id,
        name: prod.name,
        category: prod.category || 'Ring',
        karat: isSilverProd ? 'Silver' : '18K',
        gross_gold_weight_g: initialWeight,
        gold_rate_24k: isSilverProd ? String(isWalkIn ? silverRateD2C : silverRateB2B) : String(latestGoldRate || '0'),
        making_charges: prod.making_charges ? String(prod.making_charges) : '',
        reference_images: prod.photo_urls || [],
        metal_weights: (prod as any).metal_weights || null,
      }

      // Prefill diamond rows if cost exists, or make a blank row with the catalog cost
      if (prod.diamond_cost) {
        next.diamonds = [{
          id: Math.random().toString(36).substring(7),
          shape_id: '',
          shape_name: '',
          size_id: '',
          size_label: '',
          role: 'melee',
          weight: '',
          pieces: '1',
          quality_id: qualityBuckets[0]?.label || 'VS',
          color_id: colorBuckets[0]?.label || 'F-G',
          type: 'lgd',
          rate_per_pc: String(prod.diamond_cost),
          igi_charge: '0'
        }]
      }

      return next as QuoteItem
    }))
  }

  // Diamond row managers
  function handleAddDiamond(itemId: string) {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      return {
        ...item,
        diamonds: [
          ...item.diamonds,
          {
            id: Math.random().toString(36).substring(7),
            shape_id: '',
            shape_name: '',
            size_id: '',
            size_label: '',
            role: 'melee',
            weight: '',
            pieces: '1',
            quality_id: qualityBuckets[0]?.label || 'VS',
            color_id: colorBuckets[0]?.label || 'F-G',
            type: 'lgd',
            rate_per_pc: '',
            igi_charge: '0',
          }
        ]
      }
    }))
  }

  function handleRemoveDiamond(itemId: string, diamondId: string) {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      return {
        ...item,
        diamonds: item.diamonds.filter(d => d.id !== diamondId)
      }
    }))
  }

  async function triggerDiamondMatrixLookup(itemId: string, diamondId: string, d: DiamondRow) {
    if (!d.shape_id || !d.size_id || !d.quality_id || !d.color_id || !d.type) return
    try {
      const qBucket = qualityBuckets.find(qb => qb.label.toLowerCase() === d.quality_id.toLowerCase())
      const cBucket = colorBuckets.find(cb => cb.label.toLowerCase() === d.color_id.toLowerCase())
      if (!qBucket || !cBucket) return

      const res = await fetch(`/api/configurator/stone-prices?shape_id=${d.shape_id}&size_id=${d.size_id}&type=${d.type}`)
      if (!res.ok) return
      const { cells } = await res.json()
      if (!cells) return

      const match = cells.find((c: any) =>
        c.quality_bucket_id === qBucket.id &&
        c.color_bucket_id === cBucket.id
      )

      if (match && match.price_per_piece > 0) {
        setItems(prev => prev.map(item => {
          if (item.id !== itemId) return item
          return {
            ...item,
            diamonds: item.diamonds.map(x => x.id === diamondId ? { ...x, rate_per_pc: String(match.price_per_piece), is_suggested: true } : x)
          }
        }))
      }
    } catch (err) {
      console.error("Matrix price lookup failed:", err)
    }
  }

  function handleUpdateDiamond(itemId: string, diamondId: string, field: keyof DiamondRow, value: any) {
    setItems(prev => {
      const nextItems = prev.map(item => {
        if (item.id !== itemId) return item
        return {
          ...item,
          diamonds: item.diamonds.map(d => {
            if (d.id !== diamondId) return d
            const nextD = { ...d, [field]: value }
            if (field === 'rate_per_pc') {
              nextD.is_suggested = false
            }
            return nextD
          })
        }
      })

      const item = nextItems.find(i => i.id === itemId)
      const d = item?.diamonds.find(x => x.id === diamondId)
      if (d && ['shape_id', 'size_id', 'quality_id', 'color_id', 'type'].includes(field)) {
        triggerDiamondMatrixLookup(itemId, diamondId, d)
      }

      return nextItems
    })
  }

  // Handle uploading item reference images
  async function handleImageUpload(itemId: string, files: FileList | null) {
    if (!files || files.length === 0) return
    const file = files[0]
    
    // Set loading indicator
    updateItemField(itemId, 'other_charges_label', 'Uploading image...')
    try {
      const url = await uploadToCloudinary(file, 'quotes')
      setItems(prev => prev.map(item => {
        if (item.id !== itemId) return item
        return {
          ...item,
          reference_images: [...item.reference_images, url],
          other_charges_label: item.other_charges_label === 'Uploading image...' ? '' : item.other_charges_label
        }
      }))
    } catch (err: any) {
      alert(err.message || 'Image upload failed')
      updateItemField(itemId, 'other_charges_label', '')
    }
  }

  function handleRemoveImage(itemId: string, url: string) {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      return {
        ...item,
        reference_images: item.reference_images.filter(img => img !== url)
      }
    }))
  }

  function handleSetCustomerMode(mode: 'partner' | 'd2c' | 'walk_in') {
    setCustomerMode(mode)
    if (mode === 'partner') {
      setIsWalkIn(false)
    } else {
      setIsWalkIn(true)
      if (mode === 'd2c') {
        if (!selectedD2cCustomerId && d2cCustomers.length > 0) {
          const first = d2cCustomers[0]
          setSelectedD2cCustomerId(first.id)
          setWalkInName(first.full_name)
          setWalkInPhone(first.whatsapp)
          setWalkInCity(first.city || '')
        } else if (selectedD2cCustomerId) {
          const found = d2cCustomers.find(c => c.id === selectedD2cCustomerId)
          if (found) {
            setWalkInName(found.full_name)
            setWalkInPhone(found.whatsapp)
            setWalkInCity(found.city || '')
          }
        }
      } else {
        setWalkInName('')
        setWalkInPhone('')
        setWalkInCity('')
        setSelectedD2cCustomerId('')
      }
    }
    
    const isWalk = mode !== 'partner'
    setItems(prev => prev.map(item => {
      if (item.karat === 'Silver') {
        const defaultRate = isWalk ? silverRateD2C : silverRateB2B
        return { ...item, gold_rate_24k: String(defaultRate || '80') }
      }
      return item
    }))
  }

  async function handleCreateD2cCustomer() {
    setD2cError(null)
    if (!newD2cName.trim() || !newD2cWhatsapp.trim()) {
      setD2cError('Name and WhatsApp number are required.')
      return
    }
    setCreatingD2c(true)
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: newD2cName.trim(),
          whatsapp: newD2cWhatsapp.trim(),
          city: newD2cCity.trim() || null,
        })
      })
      const j = await res.json()
      if (!res.ok) {
        setD2cError(j.error || 'Failed to create customer.')
        return
      }
      
      const added = j.customer
      setD2cCustomers(prev => [...prev, added].sort((a, b) => a.full_name.localeCompare(b.full_name)))
      setSelectedD2cCustomerId(added.id)
      setWalkInName(added.full_name)
      setWalkInPhone(added.whatsapp)
      setWalkInCity(added.city || '')
      
      setNewD2cName('')
      setNewD2cWhatsapp('')
      setNewD2cCity('')
      setShowCreateD2c(false)
    } catch (e: any) {
      setD2cError(e.message || 'Error occurred.')
    } finally {
      setCreatingD2c(false)
    }
  }

  function buildPayload() {
    const isPartner = customerMode === 'partner'
    const isD2c = customerMode === 'd2c'
    
    return {
      partner_id: isPartner ? (partnerId || null) : null,
      customer_id: isD2c ? (selectedD2cCustomerId || null) : null,
      walk_in_name: !isPartner ? walkInName : null,
      walk_in_phone: !isPartner ? walkInPhone : null,
      walk_in_city: !isPartner ? walkInCity : null,
      reference_no: referenceNo || null,
      quote_date: quoteDate,
      valid_until: validUntil,
      margin_pct: parseFloat(marginPct) || DEFAULT_QUOTE_MARGIN_PCT,
      gst_treatment: gstTreatment,
      gst_rate_pct: parseFloat(gstRatePct) || DEFAULT_QUOTE_GST_RATE_PCT,
      show_breakup: showBreakup,
      show_24kt_column: show24ktColumn,
      cover_note: coverNote || null,
      terms_text: termsText,
      items: items.map(i => ({
        product_id: i.product_id,
        name: i.name || 'Custom Jeweller design',
        category: i.category,
        ring_size: i.ring_size || null,
        quantity: parseInt(i.quantity, 10) || 1,
        karat: i.karat,
        gross_gold_weight_g: parseFloat(i.gross_gold_weight_g) || 0,
        gold_rate_24k: parseFloat(i.gold_rate_24k) || 0,
        labour_source: i.labour_source,
        labour_partner_id: i.labour_partner_id,
        labour_rate_per_g: parseFloat(i.labour_rate_per_g) || 0,
        labour_total: (parseFloat(i.labour_rate_per_g) || 0) * (parseFloat(i.gross_gold_weight_g) || 0),
        making_charges: parseFloat(i.making_charges) || 0,
        hallmarking: parseFloat(i.hallmarking) || 0,
        other_charges: parseFloat(i.other_charges) || 0,
        other_charges_label: i.other_charges_label || null,
        reference_images: i.reference_images,
        diamonds: i.diamonds.map(d => ({
          shape_id: d.shape_id || null,
          shape_name: d.shape_name || null,
          size_id: d.size_id || null,
          size_label: d.size_label || null,
          role: d.role,
          approx_carats: parseFloat(d.weight) || null,
          pieces: parseInt(d.pieces, 10) || 1,
          quality_id: d.quality_id,
          color_id: d.color_id,
          type: d.type,
          rate_per_pc: parseFloat(d.rate_per_pc) || 0,
          igi_charge: parseFloat(d.igi_charge) || 0,
        }))
      }))
    }
  }

  async function handleSaveDraft() {
    if (customerMode === 'walk_in' && !walkInName) {
      alert('Walk-in Customer Name is required')
      return
    }
    if (customerMode === 'd2c' && !selectedD2cCustomerId) {
      alert('Please select a D2C customer')
      return
    }
    if (customerMode === 'partner' && !partnerId) {
      alert('Please select a registered partner')
      return
    }
    if (!validUntil) {
      alert('Valid Until date is required')
      return
    }

    setSaving(true)
    try {
      const payload = buildPayload()
      const url = editId ? `/api/quotes/${editId}` : '/api/quotes'
      const method = editId ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        const d = await res.json()
        router.push(`/quotes/${d.quote.id}`)
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to save quote')
      }
    } catch (err) {
      console.error(err)
      alert('Error saving quote')
    } finally {
      setSaving(false)
    }
  }

  // Save & Open PDF
  async function handleSaveAndPreview() {
    setSaving(true)
    try {
      const payload = buildPayload()
      const url = editId ? `/api/quotes/${editId}` : '/api/quotes'
      const method = editId ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        const d = await res.json()
        window.open(`/api/quotes/${d.quote.id}/pdf`, '_blank')
        router.push(`/quotes/${d.quote.id}`)
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to save quote')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  // Save & send via WhatsApp magic link
  async function handleSaveAndSend() {
    setSaving(true)
    try {
      const payload = buildPayload()
      const url = editId ? `/api/quotes/${editId}` : '/api/quotes'
      const method = editId ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        const d = await res.json()
        
        // Call Send API
        const sendRes = await fetch(`/api/quotes/${d.quote.id}/send`, { method: 'POST' })
        if (sendRes.ok) {
          const sendData = await sendRes.json()
          
          // Copy magic link
          if (sendData.publicUrl) {
            const fullLink = `${window.location.origin}/q/${sendData.token}`
            navigator.clipboard.writeText(fullLink)
          }

          alert('Quote created and Magic Link copied to clipboard!')
          
          if (sendData.waUrl) {
            window.open(sendData.waUrl, '_blank')
          }
        }
        router.push(`/quotes/${d.quote.id}`)
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to save quote')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loadingInitial) {
    return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading quotation builder...</div>
  }

  const labelClass = 'block text-xs font-semibold text-stone-500 mb-1'
  const inputClass = 'w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none bg-white transition-colors'

  return (
    <div className="p-4 lg:p-7 max-w-7xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/quotes" className="p-2 text-stone-500 hover:text-stone-900 border border-stone-200 rounded-lg bg-white">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-stone-900">
            {editId ? 'Edit Quotation' : 'New Quotation'}
          </h1>
          <p className="text-stone-500 text-sm mt-0.5">
            {editId ? 'Modify draft quotation details' : 'Draft a custom jeweller quotation'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form Pane (2 columns wide on desktop) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Quote Header / Customer */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
            <h2 className="font-semibold text-stone-900 text-sm border-b border-stone-100 pb-2">Client Details</h2>
            
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <label className="text-xs font-medium text-stone-500">Customer Type:</label>
              <button type="button" onClick={() => handleSetCustomerMode('partner')}
                className={`text-xs px-2.5 py-1 rounded-md border font-medium ${customerMode === 'partner' ? 'bg-[#1E3A5F] border-[#1E3A5F] text-white' : 'bg-white border-stone-200 text-stone-600'}`}>
                Registered Partner
              </button>
              <button type="button" onClick={() => handleSetCustomerMode('d2c')}
                className={`text-xs px-2.5 py-1 rounded-md border font-medium ${customerMode === 'd2c' ? 'bg-[#1E3A5F] border-[#1E3A5F] text-white' : 'bg-white border-stone-200 text-stone-600'}`}>
                D2C Customer
              </button>
              <button type="button" onClick={() => handleSetCustomerMode('walk_in')}
                className={`text-xs px-2.5 py-1 rounded-md border font-medium ${customerMode === 'walk_in' ? 'bg-[#1E3A5F] border-[#1E3A5F] text-white' : 'bg-white border-stone-200 text-stone-600'}`}>
                Walk-in customer
              </button>
            </div>

            {customerMode === 'partner' && (
              <div>
                <label className={labelClass}>Partner *</label>
                <select className={inputClass} value={partnerId} onChange={e => setPartnerId(e.target.value)}>
                  <option value="">Select B2B Partner...</option>
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.store_name || p.owner_name} — {p.city || 'No city'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {customerMode === 'd2c' && (
              <div className="space-y-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className={labelClass}>Select D2C Customer *</label>
                    <select 
                      className={inputClass} 
                      value={selectedD2cCustomerId} 
                      onChange={e => {
                        const cid = e.target.value
                        setSelectedD2cCustomerId(cid)
                        const found = d2cCustomers.find(c => c.id === cid)
                        if (found) {
                          setWalkInName(found.full_name)
                          setWalkInPhone(found.whatsapp)
                          setWalkInCity(found.city || '')
                        }
                      }}
                    >
                      <option value="">Select Customer...</option>
                      {d2cCustomers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.full_name} ({c.whatsapp}) — {c.city || 'No city'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateD2c(true)}
                    className="bg-[#1E3A5F] hover:bg-[#162B47] text-white text-xs font-semibold px-3 py-2.5 rounded-lg flex items-center gap-1.5 h-[38px] transition-colors"
                  >
                    <span>+ New</span>
                  </button>
                </div>

                {showCreateD2c && (
                  <div className="border border-stone-200 rounded-lg p-3 bg-stone-50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-700">Quick Register D2C Customer</span>
                      <button type="button" onClick={() => setShowCreateD2c(false)} className="text-stone-400 hover:text-stone-600 text-sm">×</button>
                    </div>
                    {d2cError && (
                      <p className="text-[11px] text-red-500 font-medium">{d2cError}</p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <input 
                          type="text" 
                          placeholder="Full Name *" 
                          className={inputClass + ' py-1.5 text-xs'} 
                          value={newD2cName} 
                          onChange={e => setNewD2cName(e.target.value)} 
                        />
                      </div>
                      <div>
                        <input 
                          type="text" 
                          placeholder="WhatsApp *" 
                          className={inputClass + ' py-1.5 text-xs'} 
                          value={newD2cWhatsapp} 
                          onChange={e => setNewD2cWhatsapp(e.target.value)} 
                        />
                      </div>
                      <div>
                        <input 
                          type="text" 
                          placeholder="City (Optional)" 
                          className={inputClass + ' py-1.5 text-xs'} 
                          value={newD2cCity} 
                          onChange={e => setNewD2cCity(e.target.value)} 
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button 
                        type="button" 
                        onClick={() => setShowCreateD2c(false)} 
                        className="text-stone-500 hover:text-stone-700 text-xs px-2 py-1"
                      >
                        Cancel
                      </button>
                      <button 
                        type="button" 
                        disabled={creatingD2c} 
                        onClick={handleCreateD2cCustomer} 
                        className="bg-[#1E3A5F] text-white text-xs font-semibold px-3 py-1 rounded hover:bg-[#162B47] disabled:opacity-50"
                      >
                        {creatingD2c ? 'Saving...' : 'Register'}
                      </button>
                    </div>
                  </div>
                )}

                {selectedD2cCustomerId && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-stone-50 p-2.5 rounded-lg border border-stone-150 text-xs text-stone-600">
                    <div><strong>Name:</strong> {walkInName}</div>
                    <div><strong>WhatsApp:</strong> {walkInPhone}</div>
                    <div><strong>City:</strong> {walkInCity || '—'}</div>
                  </div>
                )}
              </div>
            )}

            {customerMode === 'walk_in' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Customer Name *</label>
                  <input type="text" className={inputClass} placeholder="e.g. John Doe"
                    value={walkInName} onChange={e => setWalkInName(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>WhatsApp / Phone</label>
                  <input type="text" className={inputClass} placeholder="e.g. 9876543210"
                    value={walkInPhone} onChange={e => setWalkInPhone(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>City</label>
                  <input type="text" className={inputClass} placeholder="e.g. Mumbai"
                    value={walkInCity} onChange={e => setWalkInCity(e.target.value)} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Reference Number (Optional)</label>
                <input type="text" className={inputClass} placeholder="e.g. REF-010"
                  value={referenceNo} onChange={e => setReferenceNo(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Quote Date</label>
                <input type="date" className={inputClass}
                  value={quoteDate} onChange={e => setQuoteDate(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Valid Until *</label>
                <input type="date" className={inputClass}
                  value={validUntil} onChange={e => setValidUntil(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Line Items Editor */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-stone-900 text-sm">Line Items ({items.length})</h2>
              <button type="button" onClick={handleAddItem}
                className="flex items-center gap-1.5 text-xs text-[#1E3A5F] border border-[#1E3A5F] px-3 py-1.5 rounded-lg hover:bg-stone-50 font-medium">
                <Plus className="w-3.5 h-3.5" /> Add line item
              </button>
            </div>

            {items.map((item, idx) => (
              <div key={item.id} className="bg-white rounded-xl border border-stone-200 p-5 space-y-4 relative">
                
                {/* Item header */}
                <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                  <span className="text-xs font-semibold text-stone-500">LINE ITEM {idx + 1}</span>
                  {items.length > 1 && (
                    <button type="button" onClick={() => handleRemoveItem(item.id)}
                      className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Catalog Puller */}
                <div>
                  <label className="block text-[11px] font-semibold text-stone-400 mb-1">PULL FROM CATALOG (PRESET)</label>
                  <select className={inputClass + ' border-dashed border-[#1E3A5F]/40'}
                    value={item.product_id || ''} onChange={e => handlePullFromCatalog(item.id, e.target.value)}>
                    <option value="">Choose a catalog design...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Core item fields */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Item Name *</label>
                    <input type="text" className={inputClass} placeholder="e.g. Majestic Diamond Ring"
                      value={item.name} onChange={e => updateItemField(item.id, 'name', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Category</label>
                    <select className={inputClass} value={item.category} onChange={e => updateItemField(item.id, 'category', e.target.value)}>
                      {['Ring', 'Earring', 'Pendant', 'Bracelet', 'Necklace', 'Bangle', 'Other'].map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Quantity</label>
                    <input type="number" min="1" className={inputClass}
                      value={item.quantity} onChange={e => updateItemField(item.id, 'quantity', e.target.value)} />
                  </div>
                </div>

                {/* Metal & Karat specs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-stone-50 p-3.5 rounded-lg border border-stone-100">
                  <div>
                    <label className={labelClass}>{item.karat === 'Silver' ? 'Metal' : 'Gold Karat'}</label>
                    <select className={inputClass} value={item.karat} onChange={e => updateItemField(item.id, 'karat', e.target.value)}>
                      {['9K', '10K', '14K', '18K', '22K', '24K', 'Silver'].map(k => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>{item.karat === 'Silver' ? 'Silver Weight (g)' : 'Gross Gold Weight (g)'}</label>
                    <input type="number" step="0.0001" className={inputClass} placeholder="e.g. 5.2340"
                      value={item.gross_gold_weight_g} onChange={e => updateItemField(item.id, 'gross_gold_weight_g', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>{item.karat === 'Silver' ? 'Silver Rate (₹/g)' : 'Gold Rate 24kt (₹/g)'}</label>
                    <input type="number" className={inputClass} placeholder="e.g. 7100"
                      value={item.gold_rate_24k} onChange={e => updateItemField(item.id, 'gold_rate_24k', e.target.value)} />
                  </div>
                </div>

                {/* Labour/Karigar cost */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-stone-50 p-3.5 rounded-lg border border-stone-100">
                  <div>
                    <label className={labelClass}>Labour Source</label>
                    <select className={inputClass} value={item.labour_source} onChange={e => updateItemField(item.id, 'labour_source', e.target.value)}>
                      <option value="partner">Karigar Rate (Database)</option>
                      <option value="manual">Manual Rate Override</option>
                    </select>
                  </div>
                  
                  {item.labour_source === 'partner' ? (
                    <div>
                      <label className={labelClass}>Assigned Karigar</label>
                      <select className={inputClass} value={item.labour_partner_id || ''} onChange={e => updateItemField(item.id, 'labour_partner_id', e.target.value)}>
                        <option value="">Select manufacturer...</option>
                        {karigars.map(k => (
                          <option key={k.id} value={k.id}>{k.name} — {k.city || 'No city'}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="invisible h-0 sm:h-auto sm:visible"></div>
                  )}

                  <div>
                    <label className={labelClass}>Labour Rate (₹/g)</label>
                    <input type="number" className={inputClass} placeholder="e.g. 150"
                      disabled={item.labour_source === 'partner' && !item.labour_partner_id}
                      value={item.labour_rate_per_g} onChange={e => updateItemField(item.id, 'labour_rate_per_g', e.target.value)} />
                  </div>
                </div>

                {/* Diamond Specifications */}
                <div className="border border-stone-100 rounded-lg p-3 bg-stone-50/50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-stone-500">Diamond / Stone Specifications</span>
                    <button type="button" onClick={() => handleAddDiamond(item.id)}
                      className="flex items-center gap-1 text-[11px] text-[#1E3A5F] border border-[#1E3A5F]/40 px-2.5 py-1 rounded bg-white font-medium hover:bg-stone-50">
                      <Plus className="w-3 h-3" /> Add stone row
                    </button>
                  </div>

                  <div className="space-y-3">
                    {item.diamonds.map((d, dIdx) => (
                      <div key={d.id} className="bg-white border border-stone-200 rounded-lg p-3 relative space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-stone-400">Stone #{dIdx + 1}</span>
                          <button type="button" onClick={() => handleRemoveDiamond(item.id, d.id)}
                            className="text-red-400 hover:text-red-600 p-0.5 rounded">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        
                        <DiamondCatalogPicker
                          shapeId={d.shape_id || null}
                          sizeId={d.size_id || null}
                          compact
                          onChange={picked => {
                            handleUpdateDiamond(item.id, d.id, 'shape_id', picked.shape_id)
                            handleUpdateDiamond(item.id, d.id, 'shape_name', picked.shape_name)
                            handleUpdateDiamond(item.id, d.id, 'size_id', picked.size_id)
                            handleUpdateDiamond(item.id, d.id, 'size_label', picked.size_label)
                            if (picked.approx_carats) {
                              handleUpdateDiamond(item.id, d.id, 'weight', String(picked.approx_carats))
                            }
                          }}
                        />

                        <div className="grid grid-cols-2 sm:grid-cols-8 gap-2 text-xs">
                          <div>
                            <label className="text-stone-400 mb-0.5 block">Role</label>
                            <select className={inputClass + ' py-1'} value={d.role} onChange={e => handleUpdateDiamond(item.id, d.id, 'role', e.target.value)}>
                              <option value="center">Center</option>
                              <option value="side">Side</option>
                              <option value="melee">Melee</option>
                              <option value="accent">Accent</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-stone-400 mb-0.5 block">Weight (ct)</label>
                            <input type="number" step="0.01" className={inputClass + ' py-1'} placeholder="0.2"
                              value={d.weight} onChange={e => handleUpdateDiamond(item.id, d.id, 'weight', e.target.value)} />
                          </div>
                          <div>
                            <label className="text-stone-400 mb-0.5 block">Pcs</label>
                            <input type="number" className={inputClass + ' py-1'}
                              value={d.pieces} onChange={e => handleUpdateDiamond(item.id, d.id, 'pieces', e.target.value)} />
                          </div>
                          <div>
                            <label className="text-stone-400 mb-0.5 block">Quality</label>
                            <select className={inputClass + ' py-1'} value={d.quality_id} onChange={e => handleUpdateDiamond(item.id, d.id, 'quality_id', e.target.value)}>
                              {qualityBuckets.length > 0 ? (
                                qualityBuckets.map(qb => <option key={qb.id} value={qb.label}>{qb.label}</option>)
                              ) : (
                                ['VVS', 'VS', 'SI'].map(q => <option key={q} value={q}>{q}</option>)
                              )}
                            </select>
                          </div>
                          <div>
                            <label className="text-stone-400 mb-0.5 block">Color</label>
                            <select className={inputClass + ' py-1'} value={d.color_id} onChange={e => handleUpdateDiamond(item.id, d.id, 'color_id', e.target.value)}>
                              {colorBuckets.length > 0 ? (
                                colorBuckets.map(cb => <option key={cb.id} value={cb.label}>{cb.label}</option>)
                              ) : (
                                ['D-E', 'F-G', 'H-I'].map(c => <option key={c} value={c}>{c}</option>)
                              )}
                            </select>
                          </div>
                          <div>
                            <label className="text-stone-400 mb-0.5 block">Type</label>
                            <select className={inputClass + ' py-1'} value={d.type} onChange={e => handleUpdateDiamond(item.id, d.id, 'type', e.target.value)}>
                              <option value="lgd">LGD</option>
                              <option value="natural">Natural</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-stone-400 mb-0.5 block flex items-center gap-1">
                              Rate/pc (₹)
                              {d.is_suggested && <span className="bg-green-100 text-green-700 font-bold px-1 rounded text-[8px] scale-90 origin-left">Matrix</span>}
                            </label>
                            <input type="number" className={inputClass + ' py-1'} placeholder="2500"
                              value={d.rate_per_pc} onChange={e => handleUpdateDiamond(item.id, d.id, 'rate_per_pc', e.target.value)} />
                          </div>
                          <div>
                            <label className="text-stone-400 mb-0.5 block">IGI (₹)</label>
                            <input type="number" className={inputClass + ' py-1'} placeholder="0"
                              value={d.igi_charge} onChange={e => handleUpdateDiamond(item.id, d.id, 'igi_charge', e.target.value)} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Additional charges & Ring Size */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-stone-50 p-3.5 rounded-lg border border-stone-100">
                  <div>
                    <label className={labelClass}>Ring Size (Optional)</label>
                    <input type="text" className={inputClass} placeholder="e.g. 14"
                      value={item.ring_size} onChange={e => updateItemField(item.id, 'ring_size', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Making Charges (₹/pc)</label>
                    <input type="number" className={inputClass} placeholder="e.g. 1200"
                      value={item.making_charges} onChange={e => updateItemField(item.id, 'making_charges', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Hallmark Cost (₹)</label>
                    <input type="number" className={inputClass} placeholder="45"
                      value={item.hallmarking} onChange={e => updateItemField(item.id, 'hallmarking', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Other Charges (₹)</label>
                    <input type="number" className={inputClass} placeholder="0"
                      value={item.other_charges} onChange={e => updateItemField(item.id, 'other_charges', e.target.value)} />
                  </div>
                </div>

                {/* Reference images & Other charge label */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Other Charges Label</label>
                    <input type="text" className={inputClass} placeholder="e.g. Laser engraving"
                      value={item.other_charges_label} onChange={e => updateItemField(item.id, 'other_charges_label', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Reference Image</label>
                    <div className="flex gap-2 items-center">
                      <label className="flex items-center gap-1.5 px-3 py-2 border border-stone-200 rounded-lg text-xs font-semibold text-stone-600 bg-white cursor-pointer hover:bg-stone-50 transition-colors">
                        <Upload className="w-3.5 h-3.5" /> Select Image File
                        <input type="file" accept="image/*" className="hidden"
                          onChange={e => handleImageUpload(item.id, e.target.files)} />
                      </label>
                    </div>

                    {/* Image thumbnails preview */}
                    {item.reference_images.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {item.reference_images.map(img => (
                          <div key={img} className="relative w-12 h-12 rounded border border-stone-200 overflow-hidden bg-stone-100 group">
                            <img src={img} className="object-cover w-full h-full" alt="Reference thumbnail" />
                            <button type="button" onClick={() => handleRemoveImage(item.id, img)}
                              className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            ))}
          </div>

          {/* Quote-level parameters and T&C */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
            <h2 className="font-semibold text-stone-900 text-sm border-b border-stone-100 pb-2">Global Settings</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Admin Margin %</label>
                <input type="number" className={inputClass} value={marginPct} onChange={e => setMarginPct(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>GST Treatment</label>
                <select className={inputClass} value={gstTreatment} onChange={e => setGstTreatment(e.target.value as any)}>
                  <option value="exclusive">GST Extra (Exclusive)</option>
                  <option value="inclusive">GST Included (Inclusive)</option>
                  <option value="none">No GST (None)</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>GST Rate %</label>
                <input type="number" className={inputClass} value={gstRatePct} onChange={e => setGstRatePct(e.target.value)} />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 py-2 border-t border-b border-stone-50">
              <label className="flex items-center gap-2 text-xs font-semibold text-stone-600 cursor-pointer select-none">
                <input type="checkbox" className="rounded text-[#1E3A5F] focus:ring-[#1E3A5F] w-4 h-4 border-stone-300"
                  checked={showBreakup} onChange={e => setShowBreakup(e.target.checked)} />
                <span>Show pricing breakup on client PDF</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-stone-600 cursor-pointer select-none">
                <input type="checkbox" className="rounded text-[#1E3A5F] focus:ring-[#1E3A5F] w-4 h-4 border-stone-300"
                  checked={show24ktColumn} onChange={e => setShow24ktColumn(e.target.checked)} />
                <span>Show 24kt pure equivalent weight column</span>
              </label>
            </div>

            <div>
              <label className={labelClass}>Client Cover Note (renders above lines in PDF)</label>
              <textarea className={inputClass + ' resize-none'} rows={2} placeholder="e.g. Dear client, please find our custom quote for your boutique orders."
                value={coverNote} onChange={e => setCoverNote(e.target.value)} />
            </div>

            <div>
              <label className={labelClass}>Terms &amp; Conditions</label>
              <textarea className={inputClass + ' resize-none font-mono text-xs'} rows={6}
                value={termsText} onChange={e => setTermsText(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Right Preview Pane (1 column wide) */}
        <div>
          <div className="sticky top-6 space-y-4">
            
            {/* Live Breakup Summary Card */}
            <div className="bg-[#1A202C] text-white rounded-xl border border-stone-800 p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-stone-400">Live Breakdown</h3>
                <span className="text-[10px] bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full font-medium">
                  Live Preview
                </span>
              </div>

              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between text-stone-300">
                  <span>Subtotal (Trade Cost):</span>
                  <span className="font-semibold">₹ {previewTotals.subtotal.toLocaleString('en-IN')}</span>
                </div>

                {gstTreatment === 'exclusive' && (
                  <div className="flex justify-between text-stone-400">
                    <span>GST Extra ({gstRatePct}%):</span>
                    <span>₹ {previewTotals.gst_amount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {gstTreatment === 'inclusive' && (
                  <div className="flex justify-between text-stone-400">
                    <span>GST ({gstRatePct}% Included):</span>
                    <span>₹ {previewTotals.gst_amount.toLocaleString('en-IN')}</span>
                  </div>
                )}

                <div className="flex justify-between font-bold text-base border-t border-stone-800 pt-3 text-white">
                  <span>Grand Total:</span>
                  <span className="text-amber-400">₹ {previewTotals.grand_total.toLocaleString('en-IN')}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsBreakupOpen(true)}
                  className="w-full mt-2 bg-[#1E3A5F] hover:bg-[#162B47] text-white text-xs font-semibold py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-stone-700"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>View Detailed Breakup</span>
                </button>
              </div>

              {/* Internal Admin Info */}
              <div className="border-t border-stone-800 pt-4 space-y-2 text-xs">
                <p className="font-semibold text-stone-400 uppercase tracking-wide text-[10px]">Internal Operator Math</p>
                <div className="flex justify-between text-stone-400">
                  <span>Total Estimated COGS:</span>
                  <span>₹ {Math.round(previewTotals.cogs_total).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-stone-400">
                  <span>Margin Captured:</span>
                  <span className="text-green-400 font-medium">
                    ₹ {Math.round(previewTotals.subtotal - previewTotals.cogs_total).toLocaleString('en-IN')} ({marginPct}%)
                  </span>
                </div>
                <div className="flex justify-between text-stone-400">
                  <span>Suggested Retail MRP:</span>
                  <span>₹ {Math.round(previewTotals.suggested_mrp_total).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Info Helpers */}
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-800 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold">
                <HelpCircle className="w-3.5 h-3.5 text-amber-600" /> Operator Quick Actions
              </div>
              <p>1. <strong>Save Draft</strong> creates quote in `draft` status so it can be edited.</p>
              <p>2. <strong>Save &amp; Preview</strong> opens the official PDF sheet immediately.</p>
              <p>3. <strong>Save &amp; Send</strong> creates a magic token, changes status to `sent`, copies link, and redirects to WhatsApp web portal.</p>
            </div>

          </div>
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 lg:left-56 right-0 bg-white border-t border-stone-200 px-6 py-4 shadow-lg flex items-center justify-between z-50">
        <div>
          <span className="text-xs text-stone-400 font-medium hidden sm:inline">Unsaved Draft Details</span>
        </div>
        <div className="flex gap-2">
          <Link href="/quotes"
            className="px-4 py-2 border border-stone-200 rounded-lg text-sm text-stone-600 hover:text-stone-900 bg-white hover:bg-stone-50 transition-colors">
            Cancel
          </Link>
          <button onClick={handleSaveDraft} disabled={saving}
            className="flex items-center gap-1.5 bg-stone-100 border border-stone-200 text-stone-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-stone-200 transition-colors disabled:opacity-50">
            <Save className="w-4 h-4" /> Save Draft
          </button>
          <button onClick={handleSaveAndPreview} disabled={saving}
            className="flex items-center gap-1.5 bg-[#1E3A5F]/10 text-[#1E3A5F] border border-[#1E3A5F]/20 px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1E3A5F]/20 transition-colors disabled:opacity-50">
            <FileText className="w-4 h-4" /> Save &amp; PDF
          </button>
          <button onClick={handleSaveAndSend} disabled={saving}
            className="flex items-center gap-1.5 bg-[#1E3A5F] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#162B47] transition-colors disabled:opacity-50">
            <Share2 className="w-4 h-4" /> Save &amp; Send
          </button>
        </div>
      </div>

      {/* Price Breakup Overlay and Drawer */}
      <div 
        className={`rkkpb-overlay ${isBreakupOpen ? 'active' : ''}`}
        onClick={() => setIsBreakupOpen(false)}
      ></div>
      <aside 
        className="rkkpb-drawer" 
        data-rkkpb-drawer="" 
        aria-hidden={!isBreakupOpen}
        style={{ display: 'flex', transform: isBreakupOpen ? 'translateX(0px)' : 'translateX(100%)', zIndex: 1000 }}
      >
        <header className="rkkpb-header">
          <h3 className="rkkpb-title">Live Price Breakup</h3>
          <button 
            className="rkkpb-close" 
            data-rkkpb-close="" 
            aria-label="Close"
            onClick={() => setIsBreakupOpen(false)}
          >
            ×
          </button>
        </header>

        <div className="rkkpb-content text-stone-850">
          {priceBreakup ? (
            <>
              {/* GOLD */}
              <div className="rkkpb-block">
                <div className="rkkpb-heading rkkpb-heading--gold">Gold</div>
                <div className="rkkpb-table">
                  <div className="rkkpb-row rkkpb-row--head">
                    <div>Component</div><div>Rate</div><div>Weight</div><div>Value</div>
                  </div>
                  <div className="rkkpb-row" data-row="gold">
                    <div data-field="rkk_gold_component">{priceBreakup.gold_component || 'Gold'}</div>
                    <div data-field="rkk_gold_rate">₹ {priceBreakup.gold_rate?.toLocaleString('en-IN') || '—'}</div>
                    <div data-field="rkk_gold_weight">{priceBreakup.gold_weight ? Number(priceBreakup.gold_weight).toFixed(3) + ' g' : '—'}</div>
                    <div data-field="rkk_gold_value">₹ {priceBreakup.gold_value?.toLocaleString('en-IN') || '—'}</div>
                  </div>
                </div>
              </div>

              {/* DIAMOND (summary) */}
              {priceBreakup.diamond_weight > 0 && (
                <div className="rkkpb-block">
                  <div className="rkkpb-heading rkkpb-heading--gold">Diamond</div>
                  <div className="rkkpb-table">
                    <div className="rkkpb-row rkkpb-row--head">
                      <div>Component</div><div>Count</div><div>Weight</div><div>Value</div>
                    </div>
                    <div className="rkkpb-row" data-row="diamond">
                      <div>{priceBreakup.diamond_component || 'Diamond'}</div>
                      <div data-field="rkk_diamond_count">{priceBreakup.diamond_count || '0'}</div>
                      <div data-field="rkk_diamond_weight">{priceBreakup.diamond_weight ? Number(priceBreakup.diamond_weight).toFixed(2) + ' ct' : '0'}</div>
                      <div data-field="rkk_diamond_value">₹ {priceBreakup.diamond_value?.toLocaleString('en-IN') || '0'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* TOTALS */}
              <div className="rkkpb-block">
                <div className="rkkpb-table rkkpb-table--totals">
                  <div className="rkkpb-row">
                    <div>Making &amp; Other Charges</div>
                    <div data-field="rkk_making_charges">₹ {priceBreakup.making_charges?.toLocaleString('en-IN') || '0'}</div>
                  </div>
                  <div className="rkkpb-row">
                    <div>Total</div>
                    <div data-field="rkk_total">₹ {priceBreakup.total?.toLocaleString('en-IN') || '0'}</div>
                  </div>
                  <div className="rkkpb-row">
                    <div>Sub-total</div>
                    <div data-field="rkk_sub_total">₹ {priceBreakup.sub_total?.toLocaleString('en-IN') || '0'}</div>
                  </div>
                  <div className="rkkpb-row">
                    <div>GST ({gstRatePct}%)</div>
                    <div data-field="rkk_gst">₹ {priceBreakup.gst?.toLocaleString('en-IN') || '0'}</div>
                  </div>
                  <div className="rkkpb-row rkkpb-row--final">
                    <div>Final Value</div>
                    <div data-field="rkk_final_value">₹ {priceBreakup.final_value?.toLocaleString('en-IN') || '0'}</div>
                  </div>
                </div>
              </div>

              {/* DIAMOND BREAK-UP */}
              {priceBreakup.diamond_specs && priceBreakup.diamond_specs.length > 0 && (
                <div className="rkkpb-block" data-hide-if-empty="">
                  <div className="rkkpb-heading rkkpb-heading--gold rkkpb-heading-clean">
                    <span>Diamond Break-up</span>
                    <span className="rkkpb-arrow-btn">→</span>
                  </div>
                  <div className="rkkpb-diamond-scroll">
                    <div className="rkkpb-table rkkpb-table--diamond" data-dia-table="">
                      <div className="rkkpb-row rkkpb-row--head rkkpb-row--dia" style={{ gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))' }}>
                        <div>Size</div><div>Color</div><div>Clarity</div><div>Shape</div><div>Count</div><div>Price</div><div>Weight</div>
                      </div>
                      
                      {priceBreakup.diamond_specs.map((spec: any, sIdx: number) => (
                        <div key={sIdx} className="rkkpb-row rkkpb-row--dia" style={{ gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))' }}>
                          <div data-field="rkk_dia_size">{spec.size_label || '—'}</div>
                          <div data-field="rkk_dia_color">{spec.color || '—'}</div>
                          <div data-field="rkk_dia_clarity">{spec.clarity || '—'}</div>
                          <div data-field="rkk_dia_shape" className="capitalize">{spec.shape || '—'}</div>
                          <div data-field="rkk_dia_count">{spec.count || '0'}</div>
                          <div data-field="rkk_dia_price">₹ {spec.price?.toLocaleString('en-IN') || '0'}</div>
                          <div data-field="rkk_dia_weight">{spec.weight ? Number(spec.weight).toFixed(2) + ' ct' : '0'}</div>
                        </div>
                      ))}

                      <div className="rkkpb-row rkkpb-row--dia rkkpb-row--total" style={{ gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))' }}>
                        <div><strong>Total</strong></div>
                        <div></div>
                        <div></div>
                        <div></div>
                        <div><strong>Count</strong> <span data-dia-total="count">{priceBreakup.diamond_count}</span></div>
                        <div></div>
                        <div><strong>Weight</strong> <span data-dia-total="weight">{priceBreakup.diamond_weight ? Number(priceBreakup.diamond_weight).toFixed(2) + ' ct' : '0'}</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Disclaimer */}
                  <div className="rkkpb-disclaimer" style={{ marginTop: '8px', fontSize: '.88rem', opacity: '.9' }}>
                    <b>Product Disclaimer: </b>Weight and prices are subject to minor changes.
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-stone-500 text-xs text-center py-8">Calculating live price breakup...</p>
          )}
        </div>
      </aside>
    </div>
  )
}

export default function QuotePageWrapper() {
  return (
    <Suspense fallback={<div className="p-4 lg:p-7 text-stone-400 text-sm">Loading Quotation Form...</div>}>
      <QuoteBuilderForm />
    </Suspense>
  )
}
