'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, computeOrderCogs } from '@/lib/supabase'
import { ArrowLeft, Save, Heart, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { DiamondCatalogPicker } from '@/components/DiamondCatalogPicker'
import {
  getAlloyDensity,
  getStoneSeatVolume,
  getNetVolume,
  scaleWeightBySize,
  FINISH_FACTOR
} from '@/lib/cadWeight'
import { getMetalWeight } from '@/lib/karat'

type DiamondRow = {
  id: string
  role: string
  shape: string
  weight: string
  quality: string
  color: string
  type: string
  pieces: string
  cost: string
  shape_id: string
  size_id: string
  size_label: string
  setting_type?: string
}

const DIAMOND_SHAPES = ['round','oval','pear','cushion','princess','marquise','emerald','radiant','heart','asscher']
const DIAMOND_QUALITIES = ['IF','VVS1','VVS2','VS1','VS2','SI1','SI2']
const DIAMOND_COLORS = ['D','E','F','G','H','I','J']
const DIAMOND_ROLES = ['center','side','accent','other']

function newDiamondRow(): DiamondRow {
  return {
    id: Math.random().toString(36).slice(2),
    role: 'center', shape: 'round', weight: '', quality: 'VS2',
    color: 'F', type: 'lgd', pieces: '1', cost: '',
    shape_id: '', size_id: '', size_label: '',
    setting_type: 'prong',
  }
}

function NewOrderForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const prePartner = searchParams.get('partner_id') || ''
  const preProduct = searchParams.get('product_id') || ''

  const [saving, setSaving] = useState(false)
  const [partners, setPartners] = useState<{ id: string; store_name: string; city: string }[]>([])
  const [products, setProducts] = useState<{ id: string; code: string; name: string; category?: string; trade_price: number; delivery_days: number; gold_karat?: number; gold_weight_g?: number; making_charges?: number; diamond_cost?: number; diamond_weight?: number; diamond_shape?: string; diamond_quality?: string; diamond_color?: string; diamond_specs?: any; metal_type?: string | null; metal_weights?: any; ref_karat?: string; ref_color?: string; }[]>([])
  const [mfgPartners, setMfgPartners] = useState<{ id: string; name: string; city: string; min_labour_grams?: number; labour_rate_9k?: number; labour_rate_10k?: number; labour_rate_14k?: number; labour_rate_18k?: number; labour_rate_22k?: number }[]>([])
  // Track whether the operator has hand-edited the labour-charges field. Once
  // they type into it, we stop auto-recomputing so we don't clobber their value.
  const [makingTouched, setMakingTouched] = useState(false)
  const [stoneTouched, setStoneTouched] = useState(false)
  const [goldRate, setGoldRate] = useState(0)
  const [silverRate, setSilverRate] = useState(80)
  const [fromInterest, setFromInterest] = useState(false)
  const [convertedQuoteId, setConvertedQuoteId] = useState<string | null>(null)

  const [weightCalcMethod, setWeightCalcMethod] = useState<'manual' | 'cad'>('manual')
  const [metalTone, setMetalTone] = useState<string>('yellow')
  const [cadVolumes, setCadVolumes] = useState({
    gross_volume: '',
    hollow_volume: '',
    gallery_cut_volume: '',
  })

  // Structured diamond rows — same UX as the catalog form so a custom order
  // captures the picker selection + matrix-priced cost. Sum auto-fills
  // `stone_cost` until the operator manually overrides it.
  const [diamonds, setDiamonds] = useState<DiamondRow[]>([newDiamondRow()])
  type CostSuggestion = {
    matrix: Array<{ quality_label: string; color_label: string; price: number }>
    history: { cost: number; source_label: string } | null
  }
  const [costSuggestions, setCostSuggestions] = useState<Record<string, CostSuggestion>>({})

  const [form, setForm] = useState({
    partner_id: prePartner,
    product_id: preProduct,
    type: 'catalog',
    model: 'wholesale', quantity: '1', ring_size: '',
    special_notes: '', brief_text: '',
    trade_price: '', total_amount: '', advance_paid: '0',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    internal_notes: '',
    // COGS / gold
    gold_source: 'self' as 'self' | 'manufacturer',
    gold_karat: '18',
    gold_color: 'yellow' as 'yellow' | 'white' | 'rose',
    gold_weight_estimated: '',
    making_charges: '',
    cad_cost: '0',
    stone_cost: '0',
    assigned_manufacturer_id: '',
  })

  useEffect(() => {
    if (prePartner || preProduct) setFromInterest(true)
    Promise.all([
      supabase.from('partners').select('id, store_name, city').order('store_name'),
      supabase.from('products').select('id, code, name, category, trade_price, delivery_days, gold_karat, gold_weight_g, making_charges, diamond_cost, diamond_weight, diamond_shape, diamond_quality, diamond_color, diamond_specs, metal_type, metal_weights, ref_karat, ref_color').eq('is_active', true).order('code'),
      supabase.from('gold_rates').select('rate_24k').order('recorded_at', { ascending: false }).limit(1),
      supabase.from('manufacturing_partners').select('id, name, city, min_labour_grams, labour_rate_9k, labour_rate_10k, labour_rate_14k, labour_rate_18k, labour_rate_22k').eq('status', 'active').order('name'),
      supabase.from('settings').select('key, value').in('key', ['silver_rate_b2b'])
    ]).then(([{ data: p }, { data: pr }, { data: g }, { data: mp }, { data: sd }]: any) => {
      setPartners(p || [])
      const prods = pr || []
      setProducts(prods)
      setMfgPartners(mp || [])
      if (g?.[0]) setGoldRate(g[0].rate_24k)
      if (sd) {
        const rate = sd.find(s => s.key === 'silver_rate_b2b')?.value
        if (rate) setSilverRate(Number(rate))
      }
      if (preProduct) {
        const product = prods.find((x: any) => x.id === preProduct)
        if (product) applyProductDefaults(product)
      }
    })
  }, [])

  // Prefill order from quote if source=quote is in the URL and a payload is in sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('prefill_order_payload')
      if (stored) {
        const payload = JSON.parse(stored)
        setForm(prev => ({
          ...prev,
          partner_id: payload.partner_id || prev.partner_id,
          product_id: payload.product_id || prev.product_id,
          type: payload.type || prev.type,
          model: payload.model || prev.model,
          quantity: payload.quantity != null ? String(payload.quantity) : prev.quantity,
          ring_size: payload.ring_size || prev.ring_size,
          special_notes: payload.special_notes || prev.special_notes,
          brief_text: payload.brief_text || prev.brief_text,
          trade_price: payload.trade_price != null ? String(payload.trade_price) : prev.trade_price,
          total_amount: payload.total_amount != null ? String(payload.total_amount) : prev.total_amount,
          advance_paid: payload.advance_paid != null ? String(payload.advance_paid) : prev.advance_paid,
          order_date: payload.order_date || prev.order_date,
          expected_delivery: payload.expected_delivery || prev.expected_delivery,
          internal_notes: payload.internal_notes || prev.internal_notes,
          gold_source: payload.gold_source || prev.gold_source,
          gold_karat: payload.gold_karat ? String(payload.gold_karat) : prev.gold_karat,
          gold_weight_estimated: payload.gold_weight_estimated != null ? String(payload.gold_weight_estimated) : prev.gold_weight_estimated,
          making_charges: payload.making_charges != null ? String(payload.making_charges) : prev.making_charges,
          cad_cost: payload.cad_cost != null ? String(payload.cad_cost) : prev.cad_cost,
          stone_cost: payload.stone_cost != null ? String(payload.stone_cost) : prev.stone_cost,
          assigned_manufacturer_id: payload.assigned_manufacturer_id || prev.assigned_manufacturer_id,
        }))

        if (Array.isArray(payload.diamonds) && payload.diamonds.length > 0) {
          setDiamonds(payload.diamonds.map((d: any) => ({
            id: d.id || Math.random().toString(36).slice(2),
            role: d.role || 'center',
            shape: d.shape || 'round',
            weight: d.weight != null ? String(d.weight) : '',
            quality: d.quality || 'VS2',
            color: d.color || 'F',
            type: d.type || 'lgd',
            pieces: d.pieces != null ? String(d.pieces) : '1',
            cost: d.cost != null ? String(d.cost) : '',
            shape_id: d.shape_id || '',
            size_id: d.size_id || '',
            size_label: d.size_label || '',
          })))
        }

        if (payload.quote_id) {
          setConvertedQuoteId(payload.quote_id)
        }

        // Lock form values to prevent auto-computations from overwriting
        setMakingTouched(true)
        setStoneTouched(true)
        setTotalTouched(true)

        // Clean up sessionStorage
        sessionStorage.removeItem('prefill_order_payload')
      }
    } catch (e) {
      console.error('Failed to parse prefill_order_payload:', e)
    }
  }, [])

  function set(k: string, v: string) {
    setForm(prev => ({ ...prev, [k]: v }))
    if (k === 'gold_color') {
      setMetalTone(v)
    }
  }

  // Mirror to stone_cost while operator hasn't manually edited that field.
  useEffect(() => {
    if (stoneTouched) return
    if (totalDiamondCost <= 0) return
    setForm(prev => prev.stone_cost === String(totalDiamondCost) ? prev : { ...prev, stone_cost: String(totalDiamondCost) })
  }, [totalDiamondCost, stoneTouched])

  // Automatically adjust estimated weight when product, karat, or color changes
  useEffect(() => {
    if (!form.product_id) return
    const product = products.find(p => p.id === form.product_id)
    if (!product || !product.metal_weights || Object.keys(product.metal_weights).length === 0) return

    const isSil = product.metal_type === 'silver'
    if (isSil) {
      const k = product.ref_karat || 'silver_925'
      const w = getMetalWeight(product.metal_weights, k, 'default')
      if (w > 0) {
        setForm(prev => ({ ...prev, gold_weight_estimated: String(w) }))
      }
    } else {
      const currentK = form.gold_karat === 'silver' ? '22K' : `${form.gold_karat}K`
      const currentC = form.gold_color || 'yellow'
      const w = getMetalWeight(product.metal_weights, currentK, currentC)
      if (w > 0) {
        setForm(prev => ({ ...prev, gold_weight_estimated: String(w) }))
      }
    }
  }, [form.product_id, form.gold_karat, form.gold_color, products])

  function addDiamondRow() { setDiamonds(prev => [...prev, newDiamondRow()]) }
  function removeDiamondRow(id: string) {
    if (diamonds.length > 1) setDiamonds(prev => prev.filter(d => d.id !== id))
  }
  function updateDiamond(id: string, key: keyof DiamondRow, val: string) {
    setDiamonds(prev => prev.map(d => d.id === id ? { ...d, [key]: val } : d))
    if (key === 'type') {
      const row = diamonds.find(x => x.id === id)
      if (row?.shape_id && row?.size_id) autofillCostFor(id, row.shape_id, row.size_id, val)
    }
    if (key === 'cost') setStoneTouched(true)
  }

  // Pulls central matrix prices + last-history cost for a row. Mirror of the
  // catalog form so the chips look and behave identically.
  async function autofillCostFor(rowId: string, shape_id: string, size_id: string, type: string) {
    if (!shape_id || !size_id) return
    try {
      const url = new URL('/api/diamonds/latest-cost', window.location.origin)
      url.searchParams.set('shape_id', shape_id)
      url.searchParams.set('size_id', size_id)
      if (type) url.searchParams.set('type', type)
      const r = await fetch(url.toString())
      if (!r.ok) return
      const d = await r.json()
      const matrix = Array.isArray(d.matrix_options) ? d.matrix_options.map((m: any) => ({
        quality_label: m.quality_label, color_label: m.color_label, price: Number(m.price) || 0,
      })) : []
      const history = (d.cost != null && Number.isFinite(Number(d.cost)))
        ? { cost: Number(d.cost), source_label: String(d.source_label || 'History') }
        : null
      setCostSuggestions(prev => ({ ...prev, [rowId]: { matrix, history } }))
      setDiamonds(prev => prev.map(row => {
        if (row.id !== rowId) return row
        if (row.cost && row.cost !== '') return row
        const qMatch = matrix.find((m: any) => m.quality_label.toLowerCase().includes((row.quality || '').toLowerCase().slice(0, 2)))
        const cMatch = qMatch && matrix.find((m: any) =>
          m.quality_label === qMatch.quality_label && m.color_label.toLowerCase().includes((row.color || '').toLowerCase().slice(0, 1)))
        const pick = cMatch?.price ?? qMatch?.price ?? matrix[0]?.price ?? history?.cost
        return pick ? { ...row, cost: String(pick) } : row
      }))
    } catch { /* silent — auto-fill is best-effort */ }
  }

  // Sum row totals for the auto stone_cost mirror + display.
  const totalDiamondCost = diamonds.reduce(
    (s, d) => s + (parseFloat(d.cost) || 0) * (parseInt(d.pieces) || 1),
    0
  )
  // Pull every catalog field we know about into the order form. Diamond info
  // (carats / shape / quality) lives on the order's special_notes by default
  // so production has it; stone_cost is autofilled from the catalog row.
  function applyProductDefaults(product: typeof products[number]) {
    const days = product.delivery_days || 14
    const delivery = new Date(Date.now() + days * 86400000).toISOString().split('T')[0]
    const qty = parseInt(form.quantity) || 1
    const total = (product.trade_price || 0) * qty
    const diamondLine = [
      product.diamond_weight ? `${product.diamond_weight}ct` : '',
      product.diamond_shape || '',
      [product.diamond_quality, product.diamond_color].filter(Boolean).join('/'),
    ].filter(Boolean).join(' ')

    const targetKarat = product.gold_karat ? String(product.gold_karat) : (product.metal_type === 'silver' ? 'silver' : form.gold_karat)
    let estWeight = product.gold_weight_g ? String(product.gold_weight_g) : form.gold_weight_estimated

    if (product.metal_weights && Object.keys(product.metal_weights).length > 0) {
      if (product.metal_type === 'silver') {
        const silverK = product.ref_karat || 'silver_925'
        estWeight = String(getMetalWeight(product.metal_weights, silverK, 'default') || '')
      } else {
        const k = targetKarat === 'silver' ? '22K' : `${targetKarat}K`
        const c = form.gold_color || 'yellow'
        estWeight = String(getMetalWeight(product.metal_weights, k, c) || '')
      }
    }

    setForm(prev => ({
      ...prev,
      product_id: product.id,
      trade_price: String(product.trade_price || ''),
      total_amount: total ? String(total) : String(product.trade_price || ''),
      expected_delivery: delivery,
      gold_karat: targetKarat,
      gold_weight_estimated: estWeight,
      making_charges: product.making_charges && !makingTouched ? String(product.making_charges) : prev.making_charges,
      stone_cost: product.diamond_cost && !stoneTouched ? String(product.diamond_cost) : prev.stone_cost,
      special_notes: prev.special_notes || (diamondLine ? `Diamond: ${diamondLine}` : ''),
    }))
    // Hydrate the structured diamond rows from the catalog product so the
    // operator can tweak per-row instead of re-typing. Falls back to a single
    // primary row built from the legacy diamond_* columns when diamond_specs
    // isn't populated.
    const specs = Array.isArray(product.diamond_specs)
      ? product.diamond_specs
      : (product.diamond_specs && Array.isArray(product.diamond_specs.rows) ? product.diamond_specs.rows : null)
    if (specs && specs.length > 0) {
      setDiamonds(specs.map((s: any) => ({
        id: Math.random().toString(36).slice(2),
        role: s.role || 'center',
        shape: s.shape || 'round',
        weight: s.weight != null ? String(s.weight) : '',
        quality: s.quality || 'VS2',
        color: s.color || 'F',
        type: s.type || 'lgd',
        pieces: s.pieces != null ? String(s.pieces) : '1',
        cost: s.cost != null ? String(s.cost) : '',
        shape_id: s.shape_id || '',
        size_id: s.size_id || '',
        size_label: s.size_label || '',
      })))
    } else if (product.diamond_shape || product.diamond_weight || product.diamond_cost) {
      setDiamonds([{
        ...newDiamondRow(),
        shape: product.diamond_shape || 'round',
        weight: product.diamond_weight != null ? String(product.diamond_weight) : '',
        quality: product.diamond_quality || 'VS2',
        color: product.diamond_color || 'F',
        cost: product.diamond_cost != null ? String(product.diamond_cost) : '',
      }])
    }
  }

  function onProductSelect(productId: string) {
    const product = products.find(p => p.id === productId)
    if (product) applyProductDefaults(product)
    else set('product_id', productId)
  }

  // Auto-compute labour charges whenever the operator picks a karigar (or
  // changes weight/karat) — using the partner's labour_rate_{karat} × max(weight, min_labour_grams) × quantity.
  // Stops auto-updating once the operator types in the field manually.
  const selectedMfg = mfgPartners.find(m => m.id === form.assigned_manufacturer_id)
  const labourRate = selectedMfg ? Number((selectedMfg as any)[`labour_rate_${form.gold_karat}k`] || 0) : 0
  const minGrams = Number(selectedMfg?.min_labour_grams) || 0
  const weight = parseFloat(form.gold_weight_estimated) || 0
  const qtyForLabour = Math.max(parseInt(form.quantity) || 1, 1)
  const billableGrams = Math.max(weight, minGrams)
  const autoMaking = selectedMfg && labourRate > 0 && weight > 0
    ? Math.round(billableGrams * labourRate * qtyForLabour)
    : 0
  useEffect(() => {
    if (makingTouched) return
    if (autoMaking > 0) {
      setForm(prev => prev.making_charges === String(autoMaking) ? prev : { ...prev, making_charges: String(autoMaking) })
    }
  }, [autoMaking, makingTouched])

  // Keep total_amount in sync with trade_price × quantity until the operator overrides it.
  const [totalTouched, setTotalTouched] = useState(false)
  useEffect(() => {
    if (totalTouched) return
    const tp = parseFloat(form.trade_price) || 0
    const q = parseInt(form.quantity) || 1
    const t = tp * q
    if (t > 0) {
      setForm(prev => prev.total_amount === String(t) ? prev : { ...prev, total_amount: String(t) })
    }
  }, [form.trade_price, form.quantity, totalTouched])

  // Dynamic calculation for CAD mode
  useEffect(() => {
    if (weightCalcMethod !== 'cad') return

    const gV = parseFloat(cadVolumes.gross_volume) || 0
    const hV = parseFloat(cadVolumes.hollow_volume) || 0
    const gcV = parseFloat(cadVolumes.gallery_cut_volume) || 0

    const sV = getStoneSeatVolume(diamonds)
    const nV = getNetVolume(gV, sV, hV, gcV)

    const karat = form.gold_karat
    const density = getAlloyDensity(karat, metalTone)

    const castingWeight = nV * density

    setForm(prev => {
      const weightStr = castingWeight > 0 ? castingWeight.toFixed(4) : ''
      return prev.gold_weight_estimated === weightStr ? prev : { ...prev, gold_weight_estimated: weightStr }
    })
  }, [weightCalcMethod, cadVolumes, diamonds, form.gold_karat, metalTone])

  // Size scaling logic under manual mode
  useEffect(() => {
    if (weightCalcMethod !== 'manual') return
    if (form.type !== 'catalog' || !form.product_id) return

    const product = products.find(p => p.id === form.product_id)
    if (!product || !product.gold_weight_g) return

    const baseWeight = product.gold_weight_g
    const category = product.category || ''

    if (!form.ring_size) {
      setForm(prev => prev.gold_weight_estimated === String(baseWeight) ? prev : { ...prev, gold_weight_estimated: String(baseWeight) })
      return
    }

    const scaled = scaleWeightBySize(baseWeight, '', form.ring_size, category)
    const scaledStr = scaled > 0 ? scaled.toFixed(4) : String(baseWeight)
    setForm(prev => prev.gold_weight_estimated === scaledStr ? prev : { ...prev, gold_weight_estimated: scaledStr })
  }, [form.ring_size, form.product_id, weightCalcMethod, form.type, products])

  // Estimated COGS preview
  const isSilverOrder = String(form.gold_karat).toLowerCase() === 'silver'
  const estCogs = computeOrderCogs({
    gold_weight_actual: parseFloat(form.gold_weight_estimated) || 0,
    gold_rate_at_order: isSilverOrder ? silverRate : goldRate,
    gold_karat: isSilverOrder ? null : (parseInt(form.gold_karat) || 18),
    metal_type: isSilverOrder ? 'silver' : 'gold',
    making_charges: parseFloat(form.making_charges) || 0,
    cad_cost: parseFloat(form.cad_cost) || 0,
    stone_cost: parseFloat(form.stone_cost) || 0,
    total_amount: parseFloat(form.total_amount) || 0,
  })

  async function handleSave() {
    if (!form.partner_id) { alert('Select a partner'); return }
    if (!form.trade_price || !form.total_amount) { alert('Enter pricing'); return }

    setSaving(true)
    
    // 1. Fetch Partner for Credit Evaluation
    const { data: partner } = await supabase.from('partners').select('*').eq('id', form.partner_id).single()
    if (!partner) { alert('Partner not found'); setSaving(false); return }

    // 2. Evaluate Risk
    const totalAmountPaise = parseFloat(form.total_amount) * 100
    const { evaluateCreditRisk } = await import('@/lib/ethics')
    const risk = evaluateCreditRisk(partner, totalAmountPaise)

    const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true })
    const orderNumber = `SH-ORD-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`

    const payload: any = {
      order_number: orderNumber,
      partner_id: form.partner_id,
      product_id: form.product_id || null,
      type: form.type,
      model: form.model,
      quantity: parseInt(form.quantity) || 1,
      ring_size: form.ring_size || null,
      special_notes: form.special_notes || null,
      brief_text: form.type === 'custom' ? form.brief_text : null,
      gold_rate_at_order: isSilverOrder ? silverRate : goldRate,
      gold_karat: isSilverOrder ? null : (parseInt(form.gold_karat) || 18),
      gold_color: isSilverOrder ? 'yellow' : (form.gold_color || 'yellow'),
      metal_type: isSilverOrder ? 'silver' : 'gold',
      trade_price: parseFloat(form.trade_price),
      total_amount: parseFloat(form.total_amount),
      advance_paid: parseFloat(form.advance_paid) || 0,
      balance_due: parseFloat(form.total_amount) - (parseFloat(form.advance_paid) || 0),
      order_date: form.order_date,
      expected_delivery: form.expected_delivery,
      internal_notes: form.internal_notes || null,
      status: 'brief_received',
      // COGS / gold
      gold_source: form.gold_source,
      gold_weight_estimated: parseFloat(form.gold_weight_estimated) || null,
      making_charges: parseFloat(form.making_charges) || null,
      cad_cost: parseFloat(form.cad_cost) || 0,
      stone_cost: parseFloat(form.stone_cost) || 0,
      assigned_manufacturer_id: form.assigned_manufacturer_id || null,
      // CAD gold weight pipeline fields
      gross_volume: weightCalcMethod === 'cad' ? (parseFloat(cadVolumes.gross_volume) || null) : null,
      stone_seat_volume: weightCalcMethod === 'cad' ? (getStoneSeatVolume(diamonds) || null) : null,
      hollow_volume: weightCalcMethod === 'cad' ? (parseFloat(cadVolumes.hollow_volume) || null) : null,
      gallery_cut_volume: weightCalcMethod === 'cad' ? (parseFloat(cadVolumes.gallery_cut_volume) || null) : null,
      net_volume: weightCalcMethod === 'cad' ? (getNetVolume(
        parseFloat(cadVolumes.gross_volume) || 0,
        getStoneSeatVolume(diamonds),
        parseFloat(cadVolumes.hollow_volume) || 0,
        parseFloat(cadVolumes.gallery_cut_volume) || 0
      ) || null) : null,
      alloy_density_used: weightCalcMethod === 'cad' ? (getAlloyDensity(form.gold_karat, metalTone) || null) : null,
      casting_weight_g: weightCalcMethod === 'cad' ? (parseFloat(form.gold_weight_estimated) || null) : null,
      final_weight_g: weightCalcMethod === 'cad' ? ((parseFloat(form.gold_weight_estimated) || 0) * FINISH_FACTOR || null) : null,
      metal_tone: weightCalcMethod === 'cad' ? metalTone : null,
    }

    // Structured diamond rows. Only attach when the operator entered something
    // meaningful so we don't bloat orders with empty placeholder rows.
    const filledDiamonds = diamonds.filter(d =>
      d.shape_id || d.size_id || parseFloat(d.weight) > 0 || parseFloat(d.cost) > 0
    )
    if (filledDiamonds.length > 0) {
      payload.diamond_specs = filledDiamonds.map(d => ({
        role: d.role,
        shape: d.shape,
        weight: parseFloat(d.weight) || 0,
        quality: d.quality,
        color: d.color,
        type: d.type,
        pieces: parseInt(d.pieces) || 1,
        cost: parseFloat(d.cost) || 0,
        shape_id: d.shape_id || null,
        size_id: d.size_id || null,
        size_label: d.size_label || null,
        setting_type: d.setting_type || 'prong',
      }))
    }

    let res = await supabase.from('orders').insert([payload]).select('id').single()
    let error = res.error
    let createdOrder = res.data

    // 42703: column does not exist. Gracefully retry if the table columns are not present.
    if (error && (error as any).code === '42703') {
      const retryPayload = { ...payload }
      const cadCols = [
        'gross_volume', 'stone_seat_volume', 'hollow_volume', 'gallery_cut_volume',
        'net_volume', 'alloy_density_used', 'casting_weight_g', 'final_weight_g', 'metal_tone',
        'gold_color'
      ]
      cadCols.forEach(col => delete retryPayload[col])
      
      res = await supabase.from('orders').insert([retryPayload]).select('id').single()
      error = res.error
      createdOrder = res.data
      
      if (error && (error as any).code === '42703' && retryPayload.diamond_specs) {
        delete retryPayload.diamond_specs
        res = await supabase.from('orders').insert([retryPayload]).select('id').single()
        error = res.error
        createdOrder = res.data
      }
    }

    if (error) {
      setSaving(false)
      alert('Error: ' + error.message)
      return
    }

    // Link back to the quote if this order was converted from a quote
    if (convertedQuoteId && createdOrder?.id) {
      try {
        const linkRes = await fetch(`/api/quotes/${convertedQuoteId}/convert-to-order`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: createdOrder.id })
        })
        if (!linkRes.ok) {
          console.error('Failed to link quote to order:', await linkRes.text())
        }
      } catch (err) {
        console.error('Error linking quote to order:', err)
      }
    }

    setSaving(false)
    router.push('/orders')
  }

  const input = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none"
  const label = "block text-xs font-medium text-stone-500 mb-1"
  const balanceDue = (parseFloat(form.total_amount) || 0) - (parseFloat(form.advance_paid) || 0)

  return (
    <div className="p-4 lg:p-7 max-w-3xl">
      <div className="flex items-center gap-3 mb-7">
        <Link href="/orders" className="text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">New order</h1>
          <p className="text-stone-500 text-sm">Create order for a partner</p>
        </div>
      </div>

      {fromInterest && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 text-sm text-amber-800">
          <Heart className="w-4 h-4 text-amber-600 shrink-0" />
          Partner and product pre-filled from their design interest.
        </div>
      )}

      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Order details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-2">
              <label className={label}>Partner *</label>
              <select className={input} value={form.partner_id} onChange={e => set('partner_id', e.target.value)}>
                <option value="">Select partner...</option>
                {partners.map(p => <option key={p.id} value={p.id}>{p.store_name} — {p.city}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Order type</label>
              <select className={input} value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="catalog">Catalog order</option>
                <option value="custom">Custom design</option>
              </select>
            </div>
            <div>
              <label className={label}>Model</label>
              <select className={input} value={form.model} onChange={e => set('model', e.target.value)}>
                <option value="wholesale">Wholesale</option>
                <option value="design_make">Design + Make</option>
                <option value="white_label">White Label</option>
              </select>
            </div>
            {form.type === 'catalog' && (
              <div className="col-span-1 sm:col-span-2">
                <label className={label}>Product</label>
                <select className={input} value={form.product_id} onChange={e => onProductSelect(e.target.value)}>
                  <option value="">Select product (optional)...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name} (₹{p.trade_price?.toLocaleString('en-IN')})</option>)}
                </select>
              </div>
            )}
            {form.type === 'custom' && (
              <div className="col-span-1 sm:col-span-2">
                <label className={label}>Design brief</label>
                <textarea className={`${input} resize-none`} rows={3}
                  value={form.brief_text} onChange={e => set('brief_text', e.target.value)}
                  placeholder="Describe the customer's design requirement..." />
              </div>
            )}
            <div>
              <label className={label}>Quantity</label>
              <input type="number" inputMode="decimal" min="1" className={input} value={form.quantity} onChange={e => set('quantity', e.target.value)} />
            </div>
            <div>
              <label className={label}>Ring size</label>
              <input className={input} value={form.ring_size} onChange={e => set('ring_size', e.target.value)} placeholder="e.g. 16, 17, 18" />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className={label}>Special notes</label>
              <input className={input} value={form.special_notes} onChange={e => set('special_notes', e.target.value)}
                placeholder="Any specific instructions..." />
            </div>
          </div>
        </div>

        {/* DIAMONDS — same picker + matrix-chip UX as the catalog form so a
            custom order captures structured rows instead of a free-text note. */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-medium text-stone-900">Diamond specifications</h2>
            <button type="button" onClick={addDiamondRow}
              className="flex items-center gap-1.5 text-xs text-[#1E3A5F] border border-[#1E3A5F] px-3 py-1.5 rounded-lg hover:bg-yellow-50">
              <Plus className="w-3.5 h-3.5" /> Add row
            </button>
          </div>
          <p className="text-xs text-stone-400 mb-4">
            Pick a shape × size from the <Link href="/diamonds/catalog" className="text-[#1E3A5F] underline">diamond catalog</Link> so cost suggestions appear and stock matching works. Row totals auto-mirror into <em>Stone cost</em> below until you edit it manually.
          </p>
          <div className="space-y-3">
            {diamonds.map((d, idx) => (
              <div key={d.id} className="border border-stone-100 rounded-xl p-3 bg-stone-50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-stone-500">{idx === 0 ? 'Primary diamond' : `Diamond ${idx + 1}`}</span>
                  {diamonds.length > 1 && (
                    <button type="button" onClick={() => removeDiamondRow(d.id)} className="text-red-400 hover:text-red-600 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="mb-3">
                  <DiamondCatalogPicker
                    shapeId={d.shape_id || null}
                    sizeId={d.size_id || null}
                    onChange={picked => {
                      setDiamonds(prev => prev.map(row => row.id !== d.id ? row : ({
                        ...row,
                        shape_id: picked.shape_id,
                        size_id: picked.size_id,
                        size_label: picked.size_label,
                        shape: picked.shape_name ? picked.shape_name.toLowerCase() : row.shape,
                        weight: row.weight === '' && picked.approx_carats != null
                          ? String(picked.approx_carats)
                          : row.weight,
                      })))
                      autofillCostFor(d.id, picked.shape_id, picked.size_id, d.type)
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Role</label>
                    <select className="w-full border border-stone-200 rounded-lg px-2 py-2 text-sm focus:border-[#1E3A5F] outline-none bg-white"
                      value={d.role} onChange={e => updateDiamond(d.id, 'role', e.target.value)}>
                      {DIAMOND_ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Weight (ct)</label>
                    <input type="number" inputMode="decimal" step="0.01"
                      className="w-full border border-stone-200 rounded-lg px-2 py-2 text-sm focus:border-[#1E3A5F] outline-none bg-white"
                      value={d.weight} onChange={e => updateDiamond(d.id, 'weight', e.target.value)} placeholder="0.50" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Pieces</label>
                    <input type="number" inputMode="decimal" min="1"
                      className="w-full border border-stone-200 rounded-lg px-2 py-2 text-sm focus:border-[#1E3A5F] outline-none bg-white"
                      value={d.pieces} onChange={e => updateDiamond(d.id, 'pieces', e.target.value)} placeholder="1" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Quality</label>
                    <select className="w-full border border-stone-200 rounded-lg px-2 py-2 text-sm focus:border-[#1E3A5F] outline-none bg-white"
                      value={d.quality} onChange={e => updateDiamond(d.id, 'quality', e.target.value)}>
                      {DIAMOND_QUALITIES.map(q => <option key={q} value={q}>{q}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Color</label>
                    <select className="w-full border border-stone-200 rounded-lg px-2 py-2 text-sm focus:border-[#1E3A5F] outline-none bg-white"
                      value={d.color} onChange={e => updateDiamond(d.id, 'color', e.target.value)}>
                      {DIAMOND_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Type</label>
                    <select className="w-full border border-stone-200 rounded-lg px-2 py-2 text-sm focus:border-[#1E3A5F] outline-none bg-white"
                      value={d.type} onChange={e => updateDiamond(d.id, 'type', e.target.value)}>
                      <option value="lgd">LGD</option>
                      <option value="natural">Natural</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Setting</label>
                    <select className="w-full border border-stone-200 rounded-lg px-2 py-2 text-sm focus:border-[#1E3A5F] outline-none bg-white"
                      value={d.setting_type || 'prong'} onChange={e => updateDiamond(d.id, 'setting_type', e.target.value)}>
                      <option value="prong">Prong</option>
                      <option value="bezel">Bezel</option>
                      <option value="pave">Pave</option>
                      <option value="channel">Channel</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Cost/pc (₹)</label>
                    <input type="number" inputMode="decimal"
                      className="w-full border border-stone-200 rounded-lg px-2 py-2 text-sm focus:border-[#1E3A5F] outline-none bg-white"
                      value={d.cost} onChange={e => updateDiamond(d.id, 'cost', e.target.value)} placeholder="8000" />
                  </div>
                </div>
                {(() => {
                  const sug = costSuggestions[d.id]
                  if (!sug || (sug.matrix.length === 0 && !sug.history)) return null
                  return (
                    <div className="mt-3 border-t border-stone-200 pt-2.5">
                      <p className="text-[11px] font-medium text-stone-500 mb-1.5">Cost suggestions — click to use</p>
                      <div className="flex flex-wrap gap-1.5">
                        {sug.matrix.map((m, i) => {
                          const active = parseFloat(d.cost) === m.price
                          return (
                            <button
                              key={`m-${i}`}
                              type="button"
                              onClick={() => updateDiamond(d.id, 'cost', String(m.price))}
                              className={'text-xs px-2 py-1 rounded-md border transition-colors ' +
                                (active ? 'border-[#1E3A5F] bg-[#1E3A5F]/5 text-[#1E3A5F]'
                                        : 'border-stone-200 bg-white text-stone-600 hover:border-[#1E3A5F]/40')}
                              title={`Matrix · ${m.quality_label} · ${m.color_label}`}
                            >
                              <span className="text-stone-400 mr-1">{m.quality_label}·{m.color_label}</span>
                              ₹{m.price.toLocaleString('en-IN')}
                            </button>
                          )
                        })}
                        {sug.history && (
                          <button
                            type="button"
                            onClick={() => updateDiamond(d.id, 'cost', String(sug.history!.cost))}
                            className={'text-xs px-2 py-1 rounded-md border transition-colors ' +
                              (parseFloat(d.cost) === sug.history.cost
                                ? 'border-amber-500 bg-amber-50 text-amber-800'
                                : 'border-stone-200 bg-white text-stone-600 hover:border-amber-400')}
                            title={sug.history.source_label}
                          >
                            <span className="text-stone-400 mr-1">Last</span>
                            ₹{sug.history.cost.toLocaleString('en-IN')}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })()}
                {d.cost && parseInt(d.pieces) > 1 && (
                  <div className="mt-2 text-right text-xs text-stone-400">
                    Row total: ₹{((parseFloat(d.cost) || 0) * (parseInt(d.pieces) || 1)).toLocaleString('en-IN')}
                  </div>
                )}
              </div>
            ))}
          </div>
          {totalDiamondCost > 0 && (
            <div className="mt-3 flex justify-between text-sm font-medium text-stone-700 px-1">
              <span>Total diamond cost</span>
              <span>₹{totalDiamondCost.toLocaleString('en-IN')}</span>
            </div>
          )}
        </div>

        {/* Costing & gold */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Costing &amp; gold source</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-2 mb-2">
              <label className={label}>Weight Calculation Method</label>
              <div className="flex gap-6 mt-1">
                <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                  <input type="radio" name="weightCalcMethod" value="manual" checked={weightCalcMethod === 'manual'} onChange={() => setWeightCalcMethod('manual')} className="text-[#1E3A5F] focus:ring-[#1E3A5F]" />
                  <span>Manual / Sizing Scale</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                  <input type="radio" name="weightCalcMethod" value="cad" checked={weightCalcMethod === 'cad'} onChange={() => setWeightCalcMethod('cad')} className="text-[#1E3A5F] focus:ring-[#1E3A5F]" />
                  <span>CAD Alloy-Density Engine</span>
                </label>
              </div>
            </div>

            <div>
              <label className={label}>Gold source</label>
              <select className={input} value={form.gold_source} onChange={e => set('gold_source', e.target.value)}>
                <option value="self">Self (consumed from our float)</option>
                <option value="manufacturer">Manufacturer (karigar supplies)</option>
              </select>
            </div>
            <div>
              <label className={label}>Assigned manufacturer{form.gold_source === 'self' ? ' *' : ''}</label>
              <select className={input} value={form.assigned_manufacturer_id} onChange={e => set('assigned_manufacturer_id', e.target.value)}>
                <option value="">Select manufacturer...</option>
                {mfgPartners.map(p => <option key={p.id} value={p.id}>{p.name} — {p.city}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>{isSilverOrder ? 'Metal' : 'Gold karat'}</label>
              <select className={input} value={form.gold_karat} onChange={e => set('gold_karat', e.target.value)}>
                {[9,10,14,18,22,24].map(k => <option key={k} value={k}>{k}K</option>)}
                <option value="silver">Silver</option>
              </select>
            </div>
            {!isSilverOrder && (
              <div>
                <label className={label}>Gold color</label>
                <select className={input} value={form.gold_color} onChange={e => set('gold_color', e.target.value)}>
                  <option value="yellow">Yellow Gold</option>
                  <option value="white">White Gold</option>
                  <option value="rose">Rose Gold</option>
                </select>
              </div>
            )}
            <div>
              <label className={label}>{isSilverOrder ? 'Estimated silver weight (g)' : 'Estimated gold weight (g)'}</label>
              <input type="number" inputMode="decimal" step="0.0001" min="0"
                className={input + (weightCalcMethod === 'cad' ? ' bg-stone-50 cursor-not-allowed' : '')}
                readOnly={weightCalcMethod === 'cad'}
                value={form.gold_weight_estimated} onChange={e => set('gold_weight_estimated', e.target.value)} />
            </div>

            {weightCalcMethod === 'cad' && (
              <>
                <div>
                  <label className={label}>Metal Tone</label>
                  <select className={input} value={metalTone} onChange={e => setMetalTone(e.target.value)}>
                    <option value="yellow">Yellow Gold</option>
                    <option value="rose">Rose Gold</option>
                    <option value="white">White Gold</option>
                  </select>
                </div>
                <div>
                  <label className={label}>CAD Gross Volume (cm³)</label>
                  <input type="number" inputMode="decimal" step="0.001" min="0" className={input}
                    value={cadVolumes.gross_volume}
                    onChange={e => setCadVolumes(p => ({ ...p, gross_volume: e.target.value }))}
                    placeholder="e.g. 0.50" />
                </div>
                <div>
                  <label className={label}>Hollow Volume (cm³)</label>
                  <input type="number" inputMode="decimal" step="0.001" min="0" className={input}
                    value={cadVolumes.hollow_volume}
                    onChange={e => setCadVolumes(p => ({ ...p, hollow_volume: e.target.value }))}
                    placeholder="e.g. 0.05" />
                </div>
                <div>
                  <label className={label}>Gallery Cut Volume (cm³)</label>
                  <input type="number" inputMode="decimal" step="0.001" min="0" className={input}
                    value={cadVolumes.gallery_cut_volume}
                    onChange={e => setCadVolumes(p => ({ ...p, gallery_cut_volume: e.target.value }))}
                    placeholder="e.g. 0.02" />
                </div>

                <div className="col-span-1 sm:col-span-2 bg-stone-50 rounded-xl p-4 border border-stone-200 text-xs space-y-2 mt-2">
                  <p className="font-semibold text-stone-700 text-sm mb-2">CAD Density Engine Breakdown</p>
                  <div className="grid grid-cols-2 gap-2 text-stone-600">
                    <div>CAD Gross Volume:</div>
                    <div className="font-medium text-right text-stone-900">{parseFloat(cadVolumes.gross_volume) || 0} cm³</div>

                    <div>(-) Stone Seat Deduction:</div>
                    <div className="font-medium text-right text-stone-900">{getStoneSeatVolume(diamonds).toFixed(4)} cm³</div>

                    <div>(-) Hollow Volume:</div>
                    <div className="font-medium text-right text-stone-900">{parseFloat(cadVolumes.hollow_volume) || 0} cm³</div>

                    <div>(-) Gallery Cut Volume:</div>
                    <div className="font-medium text-right text-stone-900">{parseFloat(cadVolumes.gallery_cut_volume) || 0} cm³</div>

                    <div className="border-t border-stone-200 pt-1 font-semibold">Net Metal Volume:</div>
                    <div className="border-t border-stone-200 pt-1 font-semibold text-right text-stone-900">
                      {getNetVolume(
                        parseFloat(cadVolumes.gross_volume) || 0,
                        getStoneSeatVolume(diamonds),
                        parseFloat(cadVolumes.hollow_volume) || 0,
                        parseFloat(cadVolumes.gallery_cut_volume) || 0
                      ).toFixed(4)} cm³
                    </div>

                    <div>Alloy Density ({form.gold_karat === 'silver' ? 'Silver' : `${form.gold_karat}K` + ' ' + metalTone}):</div>
                    <div className="font-medium text-right text-stone-900">
                      {getAlloyDensity(form.gold_karat, metalTone).toFixed(2)} g/cm³
                    </div>

                    <div className="border-t border-stone-200 pt-1 font-semibold text-[#1E3A5F]">Casting Weight (Estimated Gross):</div>
                    <div className="border-t border-stone-200 pt-1 font-semibold text-right text-[#1E3A5F]">
                      {parseFloat(form.gold_weight_estimated) ? `${parseFloat(form.gold_weight_estimated).toFixed(4)}g` : '—'}
                    </div>

                    <div className="font-semibold text-emerald-700">Estimated Final Weight (Finished · 81.7%):</div>
                    <div className="font-semibold text-right text-emerald-700">
                      {parseFloat(form.gold_weight_estimated) ? `${(parseFloat(form.gold_weight_estimated) * FINISH_FACTOR).toFixed(4)}g` : '—'}
                    </div>
                  </div>
                </div>
              </>
            )}
            <div>
              <label className={label}>
                Making charges (₹)
                {!makingTouched && autoMaking > 0 && (
                  <span className="ml-2 text-[10px] text-emerald-600 font-normal">auto from karigar rate</span>
                )}
              </label>
              <input type="number" inputMode="decimal" className={input}
                value={form.making_charges}
                onChange={e => { setMakingTouched(true); set('making_charges', e.target.value) }} />
              {!makingTouched && selectedMfg && labourRate > 0 && weight > 0 && (
                <p className="text-[10px] text-stone-400 mt-1">
                  {qtyForLabour > 1 ? `${qtyForLabour} × ` : ''}{billableGrams.toFixed(3)}g × ₹{labourRate}/g
                  {minGrams > 0 && weight < minGrams && <span className="text-amber-600"> (min {minGrams}g billed)</span>}
                </p>
              )}
              {!isSilverOrder && selectedMfg && form.gold_karat && labourRate === 0 && weight > 0 && (
                <p className="text-[10px] text-amber-600 mt-1">No {form.gold_karat}K rate set for this karigar.</p>
              )}
            </div>
            <div>
              <label className={label}>CAD cost (₹)</label>
              <input type="number" inputMode="decimal" className={input}
                value={form.cad_cost} onChange={e => set('cad_cost', e.target.value)} />
            </div>
            <div>
              <label className={label}>
                Stone cost (₹)
                {!stoneTouched && parseFloat(form.stone_cost) > 0 && form.product_id && (
                  <span className="ml-2 text-[10px] text-emerald-600 font-normal">auto from catalog</span>
                )}
              </label>
              <input type="number" inputMode="decimal" className={input}
                value={form.stone_cost}
                onChange={e => { setStoneTouched(true); set('stone_cost', e.target.value) }} />
            </div>
          </div>
          {(parseFloat(form.gold_weight_estimated) > 0 || parseFloat(form.making_charges) > 0) && (
            <div className="mt-3 bg-stone-50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between text-stone-500">
                <span>Estimated gold cost</span>
                <span>₹{Math.round(estCogs.gold_cost).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between font-semibold text-stone-900 border-t border-stone-200 pt-1">
                <span>Estimated COGS</span>
                <span className="text-[#1E3A5F]">₹{Math.round(estCogs.total_cogs).toLocaleString('en-IN')}</span>
              </div>
              {parseFloat(form.total_amount) > 0 && (
                <div className="flex justify-between font-medium">
                  <span>Estimated margin</span>
                  <span className={estCogs.margin >= 0 ? 'text-green-600' : 'text-red-500'}>
                    ₹{Math.round(estCogs.margin).toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Pricing &amp; payment</h2>
          {goldRate > 0 && (
            <p className="text-xs text-amber-600 mb-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Gold rate locked at: ₹{goldRate.toLocaleString('en-IN')}/g (24K)
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={label}>Trade price (₹) *</label>
              <input type="number" inputMode="decimal" className={input} value={form.trade_price} onChange={e => set('trade_price', e.target.value)} />
            </div>
            <div>
              <label className={label}>
                Total amount (₹) *
                {!totalTouched && parseFloat(form.total_amount) > 0 && (parseInt(form.quantity) || 1) > 1 && (
                  <span className="ml-2 text-[10px] text-emerald-600 font-normal">trade × qty</span>
                )}
              </label>
              <input type="number" inputMode="decimal" className={input} value={form.total_amount}
                onChange={e => { setTotalTouched(true); set('total_amount', e.target.value) }} />
            </div>
            <div>
              <label className={label}>Advance paid (₹)</label>
              <input type="number" inputMode="decimal" className={input} value={form.advance_paid} onChange={e => set('advance_paid', e.target.value)} />
            </div>
          </div>
          {form.total_amount && (
            <div className={`mt-3 p-3 rounded-lg text-sm flex justify-between items-center ${balanceDue > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
              <span className={balanceDue > 0 ? 'text-amber-700' : 'text-green-700'}>Balance due at delivery</span>
              <span className={`font-semibold ${balanceDue > 0 ? 'text-amber-800' : 'text-green-800'}`}>₹{balanceDue.toLocaleString('en-IN')}</span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-medium text-stone-900 mb-4">Dates</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Order date</label>
              <input type="date" className={input} value={form.order_date} onChange={e => set('order_date', e.target.value)} />
            </div>
            <div>
              <label className={label}>Expected delivery</label>
              <input type="date" className={input} value={form.expected_delivery} onChange={e => set('expected_delivery', e.target.value)} />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className={label}>Internal notes</label>
              <input className={input} value={form.internal_notes} onChange={e => set('internal_notes', e.target.value)}
                placeholder="Production notes, special instructions for workshop..." />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/orders" className="px-5 py-2.5 text-sm text-stone-600 border border-stone-200 rounded-lg hover:text-stone-900">
            Cancel
          </Link>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-[#1E3A5F] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#162B47] disabled:opacity-50 transition-colors">
            <Save className="w-4 h-4" />
            {saving ? 'Creating...' : 'Create order'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NewOrderPage() {
  return (
    <Suspense fallback={<div className="p-4 lg:p-7 text-stone-400 text-sm">Loading...</div>}>
      <NewOrderForm />
    </Suspense>
  )
}
