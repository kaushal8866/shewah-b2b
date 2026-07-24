'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { uploadToCloudinary } from '@/lib/cloudinaryUpload'
import { KARAT_FACTORS, SELLABLE_KARATS, pureMassByKarat, computeKaratPricing, getMetalWeight, pureGoldMass } from '@/lib/karat'
import { ArrowLeft, Save, Calculator, Plus, X, Upload, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'
import { DiamondCatalogPicker } from '@/components/DiamondCatalogPicker'
import MetalWeightCalculator from '@/components/MetalWeightCalculator'
import { DynamicField, validateAttributes } from '@/lib/catalogAttributes'

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
  // task 76: link each row to a catalog (shape, size). Older rows
  // without these still save and read fine — they show up in the
  // editor with the picker empty until an operator upgrades them.
  shape_id: string
  size_id: string
  size_label: string
  // True when the row came from an older product save that predates the
  // shared diamond catalog. Such rows render read-only with a "Legacy"
  // badge and an explicit "Upgrade" affordance, so a master can safely
  // re-pick from the catalog without accidentally losing the original
  // values mid-edit. New rows added in this editor are never legacy.
  legacy_locked: boolean
}

const SHAPES = ['round','oval','pear','cushion','princess','marquise','emerald','radiant','heart','asscher']
const ROLES = ['center','side','accent','other']
// Labels derive from KARAT_FACTORS so they cannot drift from the real purity.
// They were hardcoded as 38% / 42% / 60%, which no longer matched after the
// table was corrected to BIS hallmark fineness (375 / 417 / 585).
const KARATS = [9, 10, 14, 18, 22].map(k => ({
  value: String(k),
  label: `${k}K (${(KARAT_FACTORS[k] * 100).toFixed(1).replace(/\.0$/, '')}%)`,
  purity: KARAT_FACTORS[k],
}))

function newDiamondRow(): DiamondRow {
  return {
    id: Math.random().toString(36).slice(2),
    role: 'center', shape: 'round', weight: '', quality: 'VS',
    color: 'GH', type: 'lgd', pieces: '1', cost: '',
    shape_id: '', size_id: '', size_label: '',
    legacy_locked: false,
  }
}

type CostSuggestion = {
  matrix: Array<{ quality_label: string; color_label: string; price: number }>
  history: { cost: number; source_label: string } | null
}

interface SetComponent {
  id: string
  component_label: string
  category: string
  metal_type: string
  metalWeights: Record<string, any>
  refKarat: string
  refColor: string
  diamonds: DiamondRow[]
  making_charges: string
  igi_cert_cost: string
  photoUrls: string[]
  attributes: Record<string, any>
}

export default function NewProductPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [goldRate, setGoldRate] = useState(0)
  const [retailLabour, setRetailLabour] = useState<Record<number, number>>({ 22: 0, 18: 0, 14: 0, 10: 0, 9: 0 })
  const [silverRateB2B, setSilverRateB2B] = useState(80)
  const [silverRateD2C, setSilverRateD2C] = useState(120)
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [diamonds, setDiamonds] = useState<DiamondRow[]>([newDiamondRow()])
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [metalWeights, setMetalWeights] = useState<any>({})
  const [refKarat, setRefKarat] = useState<string>('22K')
  const [refColor, setRefColor] = useState<string>('yellow')
  const [categories, setCategories] = useState<any[]>([])
  const [attributes, setAttributes] = useState<Record<string, any>>({})
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  // Set Builder Phase 2 state variables
  const [isSet, setIsSet] = useState(false)
  const [sellMode, setSellMode] = useState<'set_only' | 'set_or_individual' | 'individual_only'>('set_only')
  const [setDiscountPct, setSetDiscountPct] = useState(0)
  const [components, setComponents] = useState<SetComponent[]>([])
  const [activeCompIdx, setActiveCompIdx] = useState(0)
  const [costSuggestions, setCostSuggestions] = useState<Record<string, CostSuggestion>>({})

  function createNewComponent(label: string): SetComponent {
    const defaultCat = categories[0]?.name || 'Pendant'
    return {
      id: Math.random().toString(36).slice(2),
      component_label: label,
      category: defaultCat,
      metal_type: 'gold',
      metalWeights: {},
      refKarat: '22K',
      refColor: 'yellow',
      diamonds: [newDiamondRow()],
      making_charges: '0',
      igi_cert_cost: '1500',
      photoUrls: [],
      attributes: {}
    }
  }

  // Initialize first component if set mode is turned on
  useEffect(() => {
    if (isSet && components.length === 0) {
      setComponents([createNewComponent('Component 1')])
      setActiveCompIdx(0)
    }
  }, [isSet, categories])

  function addComponent() {
    const nextIdx = components.length + 1
    const newComp = createNewComponent(`Component ${nextIdx}`)
    setComponents(prev => [...prev, newComp])
    setActiveCompIdx(components.length)
  }

  function removeComponent(idxToRemove: number) {
    if (components.length <= 1) {
      alert('A set must have at least one component.')
      return
    }
    setComponents(prev => prev.filter((_, idx) => idx !== idxToRemove))
    if (activeCompIdx >= components.length - 1) {
      setActiveCompIdx(Math.max(0, components.length - 2))
    }
  }

  function updateComponent(idx: number, updates: Partial<SetComponent>) {
    setComponents(prev => prev.map((c, i) => i === idx ? { ...c, ...updates } : c))
  }

  function addComponentDiamondRow(compIdx: number) {
    setComponents(prev => prev.map((c, i) => {
      if (i !== compIdx) return c
      return { ...c, diamonds: [...c.diamonds, newDiamondRow()] }
    }))
  }

  function removeComponentDiamondRow(compIdx: number, rowId: string) {
    setComponents(prev => prev.map((c, i) => {
      if (i !== compIdx) return c
      if (c.diamonds.length <= 1) return c
      return { ...c, diamonds: c.diamonds.filter(d => d.id !== rowId) }
    }))
  }

  function updateComponentDiamond(compIdx: number, rowId: string, key: keyof DiamondRow, val: string) {
    setComponents(prev => prev.map((c, i) => {
      if (i !== compIdx) return c
      const nextDiamonds = c.diamonds.map(d => d.id === rowId ? { ...d, [key]: val } : d)
      
      // Auto-fill trigger if attributes change
      if (key === 'type' || key === 'quality' || key === 'color') {
        const row = c.diamonds.find(x => x.id === rowId)
        if (row) {
          const nextRow = { ...row, [key]: val }
          if (nextRow.shape_id && nextRow.size_id) {
            autofillComponentDiamondCost(compIdx, rowId, nextRow.shape_id, nextRow.size_id, nextRow.type, true)
          }
        }
      }
      return { ...c, diamonds: nextDiamonds }
    }))
  }

  async function autofillComponentDiamondCost(compIdx: number, rowId: string, shape_id: string, size_id: string, type: string, forceOverwrite?: boolean) {
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

      setComponents(prev => prev.map((c, i) => {
        if (i !== compIdx) return c
        const nextDiamonds = c.diamonds.map(row => {
          if (row.id !== rowId) return row
          if (!forceOverwrite && row.cost && row.cost !== '') return row
          const qMatch = matrix.find((m: any) => m.quality_label.toLowerCase() === (row.quality || '').toLowerCase())
            || matrix.find((m: any) => m.quality_label.toLowerCase().includes((row.quality || '').toLowerCase().slice(0, 2)))
          const cMatch = qMatch && (
            matrix.find((m: any) => m.quality_label === qMatch.quality_label && m.color_label.toLowerCase() === (row.color || '').toLowerCase())
            || matrix.find((m: any) => m.quality_label === qMatch.quality_label && m.color_label.toLowerCase().includes((row.color || '').toLowerCase().slice(0, 1)))
          )
          const pick = cMatch?.price ?? qMatch?.price ?? matrix[0]?.price ?? history?.cost
          let costVal = ''
          if (pick != null) {
            if (pick === history?.cost) {
              costVal = String(pick)
            } else {
              const wt = parseFloat(row.weight) || 0
              const isLgd = row.type === 'lgd'
              costVal = isLgd ? String(pick) : String(Math.round(wt * pick))
            }
          }
          return costVal ? { ...row, cost: costVal } : row
        })
        return { ...c, diamonds: nextDiamonds }
      }))
    } catch { /* silent */ }
  }

  async function handleComponentImageUpload(compIdx: number, files: FileList | null) {
    if (!files) return
    setUploading(true)
    for (const file of Array.from(files)) {
      try {
        const url = await uploadToCloudinary(file)
        setComponents(prev => prev.map((c, i) => {
          if (i !== compIdx) return c
          return { ...c, photoUrls: [...c.photoUrls, url] }
        }))
      } catch (err) {
        alert('Image upload failed: ' + (err instanceof Error ? err.message : String(err)))
      }
    }
    setUploading(false)
  }

  const [isReadyToShip, setIsReadyToShip] = useState(false)
  const [rtsGrossWeight, setRtsGrossWeight] = useState('')
  const [rtsListPrice, setRtsListPrice] = useState('')
  const [rtsInternalNotes, setRtsInternalNotes] = useState('')


  const [form, setForm] = useState({
    code: '', name: '', description: '', category: 'Ring',
    metal_type: 'gold',
    gold_weight_22k: '',
    gross_weight: '',
    making_charges: '0', igi_cert_cost: '1500',
    delivery_days: '14',
    models_available: ['wholesale', 'design_make'],
  })

  const [qualityBuckets, setQualityBuckets] = useState<any[]>([])
  const [colorBuckets, setColorBuckets] = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      supabase
        .from('gold_rates')
        .select('rate_24k, retail_labour_22k, retail_labour_18k, retail_labour_14k, retail_labour_10k, retail_labour_9k')
        .order('recorded_at', { ascending: false })
        .limit(1),
      supabase
        .from('settings')
        .select('key, value')
        .in('key', ['silver_rate_b2b', 'silver_rate_d2c']),
      supabase
        .from('product_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      fetch('/api/diamonds/quality-buckets').then(r => r.json()),
      fetch('/api/diamonds/color-buckets').then(r => r.json())
    ]).then(([{ data: gd }, { data: sd }, { data: catData }, qbData, cbData]) => {
      if (catData) {
        setCategories(catData)
      }
      if (qbData?.buckets) setQualityBuckets(qbData.buckets)
      if (cbData?.buckets) setColorBuckets(cbData.buckets)

      const r = gd?.[0]
      if (r) {
        setGoldRate(Number(r.rate_24k) || 0)
        setRetailLabour({
          22: Number(r.retail_labour_22k) || 0,
          18: Number(r.retail_labour_18k) || 0,
          14: Number(r.retail_labour_14k) || 0,
          10: Number(r.retail_labour_10k) || 0,
          9:  Number(r.retail_labour_9k)  || 0,
        })
      }
      if (sd) {
        const b2b = sd.find((s: any) => s.key === 'silver_rate_b2b')?.value
        const d2c = sd.find((s: any) => s.key === 'silver_rate_d2c')?.value
        if (b2b) setSilverRateB2B(Number(b2b))
        if (d2c) setSilverRateD2C(Number(d2c))
      }
    })
  }, [])

  const isSilver = form.metal_type === 'silver'
  const weight22 = isSilver
    ? (getMetalWeight(metalWeights, refKarat, 'default') || 0)
    : (getMetalWeight(metalWeights, '22K', refColor) || 0)

  const totalDiamondCost = diamonds.reduce((sum, d) => sum + (parseFloat(d.cost) || 0) * (parseFloat(d.pieces) || 1), 0)
  const makingCharges = parseFloat(form.making_charges) || 0
  const igiCost = parseFloat(form.igi_cert_cost) || 0

  const silverB2BCost = weight22 * silverRateB2B
  const silverD2CCost = weight22 * silverRateD2C
  const silverB2B_cogs = silverB2BCost + totalDiamondCost + makingCharges + igiCost
  const silverD2C_cogs = silverD2CCost + totalDiamondCost + makingCharges + igiCost
  
  const silverTrade = Math.round(silverB2BCost + (totalDiamondCost * 1.28) + makingCharges + igiCost)
  const silverMrp = Math.round(silverB2BCost + (totalDiamondCost * 1.28 * 1.40) + makingCharges + igiCost)

  const pricing = isSilver ? [
    {
      karat: 'Silver',
      weight: weight22,
      goldCost: silverB2BCost,
      labourCost: 0,
      cogs: silverB2B_cogs,
      trade: silverTrade,
      mrp: silverMrp
    }
  ] : computeKaratPricing({
    netGoldWeight: weight22,
    rate24k: goldRate,
    retailLabour,
    diamondCost: totalDiamondCost,
    makingCharges,
    igiCost,
    metalWeights: metalWeights && Object.keys(metalWeights).length > 0 ? metalWeights : undefined,
    color: refColor
  })

  // HELPER FUNCTION FOR COMPONENT PRICING
  function getComponentPricing(comp: SetComponent) {
    const isCompSilver = comp.metal_type === 'silver'
    const compWeight22 = isCompSilver
      ? (getMetalWeight(comp.metalWeights, comp.refKarat, 'default') || 0)
      : (getMetalWeight(comp.metalWeights, '22K', comp.refColor) || 0)

    const compTotalDiamondCost = comp.diamonds.reduce((sum, d) => sum + (parseFloat(d.cost) || 0) * (parseFloat(d.pieces) || 1), 0)
    const compMakingCharges = parseFloat(comp.making_charges) || 0
    const compIgiCost = parseFloat(comp.igi_cert_cost) || 0

    if (isCompSilver) {
      const compSilverB2BCost = compWeight22 * silverRateB2B
      const compSilverB2B_cogs = compSilverB2BCost + compTotalDiamondCost + compMakingCharges + compIgiCost
      const compSilverTrade = Math.round(compSilverB2BCost + (compTotalDiamondCost * 1.28) + compMakingCharges + compIgiCost)
      const compSilverMrp = Math.round(compSilverB2BCost + (compTotalDiamondCost * 1.28 * 1.40) + compMakingCharges + compIgiCost)
      return [
        {
          karat: 'Silver',
          weight: compWeight22,
          goldCost: compSilverB2BCost,
          labourCost: 0,
          cogs: compSilverB2B_cogs,
          trade: compSilverTrade,
          mrp: compSilverMrp
        }
      ]
    } else {
      return computeKaratPricing({
        netGoldWeight: compWeight22,
        rate24k: goldRate,
        retailLabour,
        diamondCost: compTotalDiamondCost,
        makingCharges: compMakingCharges,
        igiCost: compIgiCost,
        metalWeights: comp.metalWeights && Object.keys(comp.metalWeights).length > 0 ? comp.metalWeights : undefined,
        color: comp.refColor
      })
    }
  }

  // AGGREGATED METAL WEIGHTS FOR SET
  const aggregatedMetalWeights = (() => {
    const result: Record<string, number> = {}
    if (!isSet) return result
    components.forEach(comp => {
      if (comp.metalWeights) {
        Object.entries(comp.metalWeights).forEach(([key, val]) => {
          const w = parseFloat(val as string) || 0
          if (w > 0) {
            result[key] = (result[key] || 0) + w
          }
        })
      }
    })
    Object.keys(result).forEach(key => {
      result[key] = parseFloat(result[key].toFixed(3))
    })
    return result
  })()

  // AGGREGATED PRICING FOR SET
  const parentWeight22 = isSilver
    ? (getMetalWeight(aggregatedMetalWeights, refKarat, 'default') || 0)
    : (getMetalWeight(aggregatedMetalWeights, '22K', refColor) || 0)

  const parentPricing = (() => {
    if (!isSet) return []
    const isParentSilver = form.metal_type === 'silver'
    if (isParentSilver) {
      let weightSum = 0
      let goldCostSum = 0
      let labourCostSum = 0
      let cogsSum = 0
      let tradeSum = 0
      let mrpSum = 0

      components.forEach(comp => {
        const compPricing = getComponentPricing(comp)
        const match = compPricing.find(p => p.karat === 'Silver') || compPricing[0]
        if (match) {
          weightSum += match.weight
          goldCostSum += match.goldCost
          labourCostSum += match.labourCost
          cogsSum += match.cogs
          tradeSum += match.trade
          mrpSum += match.mrp
        }
      })

      const factor = 1 - (setDiscountPct || 0) / 100
      const discountedTrade = Math.round(tradeSum * factor)
      const discountedMrp = Math.round(mrpSum * factor)

      return [
        {
          karat: 'Silver',
          weight: weightSum,
          goldCost: goldCostSum,
          labourCost: 0,
          cogs: cogsSum,
          trade: discountedTrade,
          mrp: discountedMrp
        }
      ]
    } else {
      return SELLABLE_KARATS.map(k => {
        let weightSum = 0
        let goldCostSum = 0
        let labourCostSum = 0
        let cogsSum = 0
        let tradeSum = 0
        let mrpSum = 0

        components.forEach(comp => {
          const compPricing = getComponentPricing(comp)
          const match = compPricing.find(p => p.karat === k) || compPricing.find(p => p.karat === 'Silver')
          if (match) {
            if (match.karat === k) {
              weightSum += match.weight
            }
            goldCostSum += match.goldCost
            labourCostSum += match.labourCost
            cogsSum += match.cogs
            tradeSum += match.trade
            mrpSum += match.mrp
          }
        })

        const factor = 1 - (setDiscountPct || 0) / 100
        const discountedTrade = Math.round(tradeSum * factor)
        const discountedMrp = Math.round(mrpSum * factor)

        return {
          karat: k,
          weight: weightSum,
          goldCost: goldCostSum,
          labourCost: labourCostSum,
          cogs: cogsSum,
          trade: discountedTrade,
          mrp: discountedMrp
        }
      })
    }
  })()

  // ACTIVE BINDINGS
  const firstComponent = components[0] || null
  const computedRefKarat = isSet ? (firstComponent?.refKarat || '22K') : refKarat
  const computedGoldKarat = isSilver ? null : (parseInt(computedRefKarat.replace(/[^\d]/g, '')) || 22)
  const computedRefColor = isSet ? (firstComponent?.refColor || 'Yellow') : refColor

  const activeWeight22 = isSet ? parentWeight22 : weight22
  const activePricing = isSet ? parentPricing : pricing
  const activeDefault22 = activePricing.find(p => p.karat === 22)

  const targetKaratPricing = isSilver 
    ? activePricing[0] 
    : (activePricing.find(p => p.karat === computedGoldKarat) || activeDefault22)

  const activeTradePrice = targetKaratPricing?.trade || 0
  const activeMrp = targetKaratPricing?.mrp || 0
  const activeWeight = targetKaratPricing?.weight || 0
  const activeCogs22 = targetKaratPricing?.cogs || 0

  const activeYourMargin = activeTradePrice - activeCogs22
  const activeJewelerMargin = activeMrp - activeTradePrice

  // Active breakdown elements
  const parentTotalDiamondCost = components.reduce((sum, comp) => sum + comp.diamonds.reduce((s, d) => s + (parseFloat(d.cost) || 0) * (parseFloat(d.pieces) || 1), 0), 0)
  const parentTotalMakingCharges = components.reduce((sum, comp) => sum + (parseFloat(comp.making_charges) || 0), 0)
  const parentTotalIgiCost = components.reduce((sum, comp) => sum + (parseFloat(comp.igi_cert_cost) || 0), 0)

  const activeTotalDiamondCost = isSet ? parentTotalDiamondCost : totalDiamondCost
  const activeMakingCharges = isSet ? parentTotalMakingCharges : makingCharges
  const activeIgiCost = isSet ? parentTotalIgiCost : igiCost

  const activeMetalCost = isSilver
    ? (activeWeight22 * silverRateB2B)
    : (activeDefault22?.goldCost || 0)

  const activeLabourCost = isSilver
    ? 0
    : (activeDefault22?.labourCost || 0)

  const handleToggleReadyToShip = (checked: boolean) => {
    setIsReadyToShip(checked)
    if (checked) {
      const activeWeight = isSet
        ? (getMetalWeight(aggregatedMetalWeights, refKarat, 'default') || parentWeight22 || 0)
        : (getMetalWeight(metalWeights, refKarat, 'default') || weight22 || 0)
      setRtsGrossWeight(activeWeight > 0 ? String(activeWeight.toFixed(3)) : '')
      setRtsListPrice(activeTradePrice > 0 ? String(activeTradePrice) : '')
    }
  }

  async function handleImageUpload(files: FileList | null) {
    if (!files) return
    setUploading(true)
    for (const file of Array.from(files)) {
      try {
        const url = await uploadToCloudinary(file)
        setPhotoUrls(prev => [...prev, url])
      } catch (err) {
        alert('Image upload failed: ' + (err instanceof Error ? err.message : String(err)))
      }
    }
    setUploading(false)
  }

  function addDiamondRow() { setDiamonds(prev => [...prev, newDiamondRow()]) }
  function removeDiamondRow(id: string) { if (diamonds.length > 1) setDiamonds(prev => prev.filter(d => d.id !== id)) }
  function updateDiamond(id: string, key: keyof DiamondRow, val: string) {
    setDiamonds(prev => prev.map(d => d.id === id ? { ...d, [key]: val } : d))
    if (key === 'type' || key === 'quality' || key === 'color') {
      const row = diamonds.find(x => x.id === id)
      if (row) {
        const nextRow = { ...row, [key]: val }
        if (nextRow.shape_id && nextRow.size_id) {
          autofillCostFor(id, nextRow.shape_id, nextRow.size_id, nextRow.type, true)
        }
      }
    }
  }

  // Suggestions panel state — keyed by diamond row id. Holds both the
  // central matrix prices (Task #82, source of truth) and the legacy
  // product/inventory history price so the operator can compare and pick.

  // Fetch cost suggestions for a row from the central matrix + history. The
  // first matrix cell auto-fills the cost field if it's blank, but the full
  // list is rendered as clickable chips so the operator can swap to any
  // other quality/color or to the historical product cost — required for
  // closing verbal deals where the negotiated price differs.
  async function autofillCostFor(rowId: string, shape_id: string, size_id: string, type: string, forceOverwrite?: boolean) {
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
      // First-time autofill: prefer the matrix price (preferring a row that
      // matches the diamond's quality + color when present), fall back to
      // history. Never overwrite an operator-typed value unless forceOverwrite is true.
      setDiamonds(prev => prev.map(row => {
        if (row.id !== rowId) return row
        if (!forceOverwrite && row.cost && row.cost !== '') return row
        const qMatch = matrix.find((m: any) => m.quality_label.toLowerCase() === (row.quality || '').toLowerCase())
          || matrix.find((m: any) => m.quality_label.toLowerCase().includes((row.quality || '').toLowerCase().slice(0, 2)))
        const cMatch = qMatch && (
          matrix.find((m: any) => m.quality_label === qMatch.quality_label && m.color_label.toLowerCase() === (row.color || '').toLowerCase())
          || matrix.find((m: any) => m.quality_label === qMatch.quality_label && m.color_label.toLowerCase().includes((row.color || '').toLowerCase().slice(0, 1)))
        )
        const pick = cMatch?.price ?? qMatch?.price ?? matrix[0]?.price ?? history?.cost
        let costVal = ''
        if (pick != null) {
          if (pick === history?.cost) {
            costVal = String(pick)
          } else {
            const wt = parseFloat(row.weight) || 0
            const isLgd = row.type === 'lgd'
            costVal = isLgd ? String(pick) : String(Math.round(wt * pick))
          }
        }
        return costVal ? { ...row, cost: costVal } : row
      }))
    } catch { /* silent — auto-fill is best-effort */ }
  }

  function set(k: string, v: string | string[]) { setForm(prev => ({ ...prev, [k]: v })) }

  function handleCategoryChange(catName: string) {
    setForm(prev => ({ ...prev, category: catName }))
    setAttributes({})
    setValidationErrors([])
  }

  function toggleModel(model: string) {
    const current = form.models_available
    set('models_available', current.includes(model) ? current.filter(m => m !== model) : [...current, model])
  }

  async function handleSave() {
    if (isSet) {
      if (!form.code || !form.name) { alert('Product code and name are required'); return }
      if (components.length === 0) {
        alert('Please add at least one component to the set.')
        return
      }

      // 1. Validate all components
      for (const comp of components) {
        if (!comp.component_label) {
          alert('Component label is required for all components')
          return
        }
        const compCategory = categories.find(c => c.name.toLowerCase() === comp.category.toLowerCase())
        const schema = compCategory?.attribute_schema || []
        const errors = validateAttributes(comp.attributes, schema)
        if (errors.length > 0) {
          alert(`Validation errors in component "${comp.component_label}": ` + errors.join(' '))
          return
        }
      }

      setSaving(true)

      // 2. Prep parent product data
      const combinedPhotos = Array.from(new Set([
        ...photoUrls,
        ...components.flatMap(comp => comp.photoUrls || [])
      ]))

      const combinedDiamondSpecs = components.flatMap(comp => comp.diamonds.map(d => ({
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
      })))

      const totalParentDiamondCost = combinedDiamondSpecs.reduce((sum, d) => sum + (d.cost * d.pieces), 0)
      const firstDiamond = combinedDiamondSpecs[0] || null

      const parentKaratPricing: Record<string, any> = {}
      for (const row of parentPricing) {
        parentKaratPricing[String(row.karat)] = row
      }

      const defaultRefKarat = components[0]?.refKarat || refKarat || '22K'
      const defaultGoldKarat = isSilver ? null : (parseInt(defaultRefKarat.replace(/[^\d]/g, '')) || 22)
      const defaultRefColor = components[0]?.refColor || refColor || 'Yellow'

      const parentPayload: Record<string, any> = {
        code: form.code,
        name: form.name,
        description: form.description,
        category: 'Set',
        metal_type: form.metal_type,
        gold_karat: defaultGoldKarat,
        gold_weight_g: activeWeight || null,
        gold_weight_22k: isSilver ? null : (getMetalWeight(aggregatedMetalWeights, '22K', defaultRefColor) || null),
        gold_weight_18k: isSilver ? null : (getMetalWeight(aggregatedMetalWeights, '18K', defaultRefColor) || null),
        gold_weight_14k: isSilver ? null : (getMetalWeight(aggregatedMetalWeights, '14K', defaultRefColor) || null),
        gold_weight_10k: isSilver ? null : (getMetalWeight(aggregatedMetalWeights, '10K', defaultRefColor) || null),
        gold_weight_9k:  isSilver ? null : (getMetalWeight(aggregatedMetalWeights, '9K', defaultRefColor)  || null),
        metal_weights: aggregatedMetalWeights,
        ref_karat: defaultRefKarat,
        ref_color: defaultRefColor,
        karat_pricing: parentKaratPricing,
        igi_cert_cost: components.reduce((sum, comp) => sum + (parseFloat(comp.igi_cert_cost) || 0), 0),
        trade_price: activeTradePrice,
        mrp_suggested: activeMrp,
        priced_at_rate: isSilver ? null : (goldRate || null),
        priced_at: new Date().toISOString(),
        delivery_days: parseInt(form.delivery_days) || 14,
        models_available: form.models_available,
        photo_urls: combinedPhotos,
        diamond_weight: firstDiamond ? firstDiamond.weight : null,
        diamond_shape: firstDiamond ? firstDiamond.shape : null,
        diamond_quality: firstDiamond ? firstDiamond.quality : null,
        diamond_color: firstDiamond ? firstDiamond.color : null,
        diamond_type: firstDiamond ? firstDiamond.type : null,
        diamond_cost: totalParentDiamondCost || null,
        diamond_specs: combinedDiamondSpecs,
        detailed_pricing: isSilver
          ? { karat_pricing: parentKaratPricing, silver_rate_b2b_used: silverRateB2B, silver_rate_d2c_used: silverRateD2C }
          : { karat_pricing: parentKaratPricing, gold_rate_used: goldRate, retail_labour_used: retailLabour },
        is_active: true,
        attributes: {},
        sell_mode: sellMode,
        set_discount_pct: setDiscountPct,
      }

      let { data: insertedParent, error: parentError } = await supabase
        .from('products')
        .insert([parentPayload])
        .select('id')
        .single()

      if (parentError && /priced_at|column .* does not exist|metal_weights|attributes/i.test(parentError.message || '')) {
        delete parentPayload.priced_at_rate
        delete parentPayload.priced_at
        delete parentPayload.metal_weights
        delete parentPayload.ref_karat
        delete parentPayload.ref_color
        delete parentPayload.attributes
        delete parentPayload.sell_mode
        delete parentPayload.set_discount_pct
        ;({ data: insertedParent, error: parentError } = await supabase
          .from('products')
          .insert([parentPayload])
          .select('id')
          .single())
      }

      if (parentError) {
        setSaving(false)
        alert('Error saving parent set: ' + parentError.message)
        return
      }

      const parentId = insertedParent?.id
      if (!parentId) {
        setSaving(false)
        alert('Failed to retrieve parent product ID')
        return
      }

      // 3. Insert component products
      for (let idx = 0; idx < components.length; idx++) {
        const comp = components[idx]
        const compPricing = getComponentPricing(comp)
        const compKaratPricing: Record<string, any> = {}
        for (const row of compPricing) {
          compKaratPricing[String(row.karat)] = row
        }

        const compWeight22 = comp.metal_type === 'silver'
          ? (getMetalWeight(comp.metalWeights, comp.refKarat, 'default') || 0)
          : (getMetalWeight(comp.metalWeights, '22K', comp.refColor) || 0)

        const compPrimary = comp.diamonds[0]
        const compTotalDiamondCost = comp.diamonds.reduce(
          (sum, d) => sum + (parseFloat(d.cost) || 0) * (parseFloat(d.pieces) || 1),
          0
        )

        const suffix = comp.component_label.toUpperCase().replace(/[^A-Z0-9]/g, '') || String(idx + 1)
        const childCode = `${form.code}-${suffix}`

        const defaultKcompPrice = compPricing.find(p => p.karat === 22)
        const compTradePrice = comp.metal_type === 'silver' ? compPricing[0]?.trade : (defaultKcompPrice?.trade || 0)
        const compMrp = comp.metal_type === 'silver' ? compPricing[0]?.mrp : (defaultKcompPrice?.mrp || 0)

        const childPayload: Record<string, any> = {
          code: childCode,
          name: `${form.name} - ${comp.component_label}`,
          description: comp.component_label,
          category: comp.category,
          metal_type: comp.metal_type,
          gold_karat: comp.metal_type === 'silver' ? null : (parseInt(comp.refKarat.replace(/[^\d]/g, '')) || 22),
          gold_weight_g: compWeight22 || null,
          gold_weight_22k: comp.metal_type === 'silver' ? null : (compWeight22 || null),
          gold_weight_18k: comp.metal_type === 'silver' ? null : (getMetalWeight(comp.metalWeights, '18K', comp.refColor) || null),
          gold_weight_14k: comp.metal_type === 'silver' ? null : (getMetalWeight(comp.metalWeights, '14K', comp.refColor) || null),
          gold_weight_10k: comp.metal_type === 'silver' ? null : (getMetalWeight(comp.metalWeights, '10K', comp.refColor) || null),
          gold_weight_9k:  comp.metal_type === 'silver' ? null : (getMetalWeight(comp.metalWeights, '9K', comp.refColor)  || null),
          metal_weights: comp.metalWeights,
          ref_karat: comp.refKarat,
          ref_color: comp.refColor,
          karat_pricing: compKaratPricing,
          igi_cert_cost: parseFloat(comp.igi_cert_cost) || 0,
          trade_price: compTradePrice,
          mrp_suggested: compMrp,
          priced_at_rate: comp.metal_type === 'silver' ? null : (goldRate || null),
          priced_at: new Date().toISOString(),
          delivery_days: parseInt(form.delivery_days) || 14,
          models_available: form.models_available,
          photo_urls: comp.photoUrls,
          diamond_weight: parseFloat(compPrimary?.weight) || null,
          diamond_shape: compPrimary?.shape || null,
          diamond_quality: compPrimary?.quality || null,
          diamond_color: compPrimary?.color || null,
          diamond_type: compPrimary?.type || null,
          diamond_cost: compTotalDiamondCost || null,
          diamond_specs: comp.diamonds.map(d => ({
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
          })),
          detailed_pricing: comp.metal_type === 'silver'
            ? { karat_pricing: compKaratPricing, silver_rate_b2b_used: silverRateB2B, silver_rate_d2c_used: silverRateD2C }
            : { karat_pricing: compKaratPricing, gold_rate_used: goldRate, retail_labour_used: retailLabour },
          is_active: true,
          attributes: comp.attributes,
          set_parent_id: parentId,
          component_label: comp.component_label,
          component_sort_order: idx,
          sell_mode: 'single',
        }

        let { error: childError } = await supabase.from('products').insert([childPayload])
        if (childError && /priced_at|column .* does not exist|metal_weights|attributes/i.test(childError.message || '')) {
          delete childPayload.priced_at_rate
          delete childPayload.priced_at
          delete childPayload.metal_weights
          delete childPayload.ref_karat
          delete childPayload.ref_color
          delete childPayload.attributes
          delete childPayload.set_parent_id
          delete childPayload.component_label
          delete childPayload.component_sort_order
          delete childPayload.sell_mode
          ;({ error: childError } = await supabase.from('products').insert([childPayload]))
        }
        if (childError) {
          console.error(`Failed to insert component ${comp.component_label}:`, childError)
        }
      }

      if (isReadyToShip) {
        try {
          const karatNum = parseInt(refKarat.replace(/[^\d]/g, '')) || 22
          const rtsRes = await fetch('/api/ready-to-ship', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              product_id: parentId,
              karat: karatNum,
              gross_weight: parseFloat(rtsGrossWeight) || 0,
              list_price: parseFloat(rtsListPrice) || 0,
              diamond_specs: combinedDiamondSpecs,
              photos: combinedPhotos,
              internal_notes: rtsInternalNotes || null
            })
          })
          if (!rtsRes.ok) {
            const rtsData = await rtsRes.json()
            alert('Set saved, but failed to create stock/ready-to-ship item: ' + rtsData.error)
          }
        } catch (err: any) {
          alert('Set saved, but failed to create stock/ready-to-ship item: ' + err.message)
        }
      }

      setSaving(false)
      router.push('/catalog')
    } else {
      if (!form.code || !form.name) { alert('Product code and name are required'); return }
      if (!weight22) { alert('Net weight is required'); return }
      
      const selectedCategory = categories.find(c => c.name.toLowerCase() === form.category.toLowerCase())
      const schema = selectedCategory?.attribute_schema || []
      const errors = validateAttributes(attributes, schema)
      if (errors.length > 0) {
        setValidationErrors(errors)
        alert('Please fix the validation errors: ' + errors.join(' '));
        return
      }

      setSaving(true)
      const primary = diamonds[0]
      const karat_pricing: Record<string, any> = {}
      for (const row of pricing) karat_pricing[String(row.karat)] = row
      const insertPayload: Record<string, any> = {
        code: form.code, name: form.name, description: form.description, category: form.category,
        metal_type: form.metal_type,
        gold_karat: isSilver ? null : (parseInt(refKarat.replace(/[^\d]/g, '')) || 22),
        gold_weight_g: weight22 || null,
        gold_weight_22k: isSilver ? null : (weight22 || null),
        gold_weight_18k: isSilver ? null : (getMetalWeight(metalWeights, '18K', refColor) || null),
        gold_weight_14k: isSilver ? null : (getMetalWeight(metalWeights, '14K', refColor) || null),
        gold_weight_10k: isSilver ? null : (getMetalWeight(metalWeights, '10K', refColor) || null),
        gold_weight_9k:  isSilver ? null : (getMetalWeight(metalWeights, '9K', refColor)  || null),
        metal_weights: metalWeights,
        ref_karat: refKarat,
        ref_color: refColor,
        karat_pricing,
        igi_cert_cost: igiCost,
        trade_price: activeTradePrice, mrp_suggested: activeMrp,
        priced_at_rate: isSilver ? null : (goldRate || null),
        priced_at: new Date().toISOString(),
        delivery_days: parseInt(form.delivery_days) || 14,
        models_available: form.models_available, photo_urls: photoUrls,
        diamond_weight: parseFloat(primary.weight) || null, diamond_shape: primary.shape,
        diamond_quality: primary.quality, diamond_color: primary.color,
        diamond_type: primary.type, diamond_cost: totalDiamondCost || null,
        diamond_specs: diamonds.map(d => ({
          role: d.role, shape: d.shape, weight: parseFloat(d.weight) || 0,
          quality: d.quality, color: d.color, type: d.type,
          pieces: parseInt(d.pieces) || 1, cost: parseFloat(d.cost) || 0,
          shape_id: d.shape_id || null,
          size_id: d.size_id || null,
          size_label: d.size_label || null,
        })),
        detailed_pricing: isSilver ? { karat_pricing, silver_rate_b2b_used: silverRateB2B, silver_rate_d2c_used: silverRateD2C } : { karat_pricing, gold_rate_used: goldRate, retail_labour_used: retailLabour },
        is_active: true,
        attributes,
      }
      let { data: insertedProduct, error } = await supabase.from('products').insert([insertPayload]).select('id').single()
      if (error && /priced_at|column .* does not exist|metal_weights|attributes/i.test(error.message || '')) {
        delete insertPayload.priced_at_rate
        delete insertPayload.priced_at
        delete insertPayload.metal_weights
        delete insertPayload.ref_karat
        delete insertPayload.ref_color
        delete insertPayload.attributes
        ;({ data: insertedProduct, error } = await supabase.from('products').insert([insertPayload]).select('id').single())
      }
      setSaving(false)
      if (error) { alert('Error: ' + error.message); return }

      if (insertedProduct?.id && isReadyToShip) {
        try {
          const karatNum = parseInt(refKarat.replace(/[^\d]/g, '')) || 22
          const rtsRes = await fetch('/api/ready-to-ship', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              product_id: insertedProduct.id,
              karat: karatNum,
              gross_weight: parseFloat(rtsGrossWeight) || 0,
              list_price: parseFloat(rtsListPrice) || 0,
              diamond_specs: insertPayload.diamond_specs,
              photos: insertPayload.photo_urls || [],
              internal_notes: rtsInternalNotes || null
            })
          })
          if (!rtsRes.ok) {
            const rtsData = await rtsRes.json()
            alert('Product saved, but failed to create stock/ready-to-ship item: ' + rtsData.error)
          }
        } catch (err: any) {
          alert('Product saved, but failed to create stock/ready-to-ship item: ' + err.message)
        }
      }

      router.push('/catalog')
    }
  }

  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-[#1E3A5F] outline-none bg-white"
  const lbl = "block text-xs font-medium text-stone-500 mb-1"

  return (
    <div className="p-4 lg:p-7 max-w-3xl pb-10">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/catalog" className="text-stone-400 hover:text-stone-600"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-stone-900">Add product</h1>
          <p className="text-stone-500 text-sm">{isSet ? 'New set design' : 'New ring design'}</p>
        </div>
      </div>

      {/* Set toggle */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5 mb-4 flex items-center justify-between shadow-sm">
        <div>
          <label htmlFor="isSetToggle" className="font-semibold text-stone-900 cursor-pointer text-sm sm:text-base">
            This is a Set
          </label>
          <p className="text-stone-500 text-xs mt-0.5">
            Enable to build a product set with multiple components (e.g. Ring + Pendant set).
          </p>
        </div>
        <input
          id="isSetToggle"
          type="checkbox"
          className="w-5 h-5 rounded text-[#1E3A5F] border-stone-300 focus:ring-[#1E3A5F] cursor-pointer"
          checked={isSet}
          onChange={e => setIsSet(e.target.checked)}
        />
      </div>

      <div className="space-y-4">

        {/* BASIC INFO */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5">
          <h2 className="font-medium text-stone-900 mb-4">Basic information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className={lbl}>Product code * (e.g. SH-007)</label>
              <input className={inp} value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="SH-007" />
            </div>
            <div>
              <label className={lbl}>Product name *</label>
              <input className={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Oval Solitaire" />
            </div>
            <div>
              <label className={lbl}>Category *</label>
              {isSet ? (
                <input className={`${inp} bg-stone-50 text-stone-400 cursor-not-allowed`} value="Set" disabled />
              ) : (
                <select className={inp} value={form.category} onChange={e => handleCategoryChange(e.target.value)}>
                  {categories.length > 0 ? (
                    categories.map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))
                  ) : (
                    ['Ring', 'Necklace', 'Earring', 'Bracelet'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))
                  )}
                </select>
              )}
            </div>
            {isSet && (
              <>
                <div>
                  <label className={lbl}>Selling Mode *</label>
                  <select
                    className={inp}
                    value={sellMode}
                    onChange={(e: any) => setSellMode(e.target.value)}
                  >
                    <option value="set_only">Set Only (Must buy complete set)</option>
                    <option value="set_or_individual">Set or Individual (Can buy set or pieces)</option>
                    <option value="individual_only">Individual Only (Pieces sold separately)</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Set Discount Percentage (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className={inp}
                    value={setDiscountPct}
                    onChange={(e) => setSetDiscountPct(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                    placeholder="0"
                  />
                </div>
                <div>{/* spacer */}</div>
              </>
            )}
            <div className="sm:col-span-2 lg:col-span-3">
              <label className={lbl}>Description</label>
              <textarea className={`${inp} resize-none`} rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief description for catalog and jeweler portal" />
            </div>
          </div>
        </div>

        {/* DYNAMIC PRODUCT ATTRIBUTES */}
        {!isSet && (() => {
          const selectedCategory = categories.find(c => c.name.toLowerCase() === form.category.toLowerCase())
          const schema = selectedCategory?.attribute_schema || []
          if (schema.length === 0) return null
          return (
            <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5">
              <h2 className="font-medium text-stone-900 mb-1">Specifications for {form.category}</h2>
              <p className="text-xs text-stone-400 mb-4">
                Provide the specific dimensions and specifications for this category.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {schema.map((field: any) => (
                  <DynamicField
                    key={field.key}
                    field={field}
                    value={attributes[field.key]}
                    onChange={(key, val) => setAttributes(prev => ({ ...prev, [key]: val }))}
                  />
                ))}
              </div>
            </div>
          )
        })()}

        {/* PHOTOS */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5">
          <h2 className="font-medium text-stone-900 mb-1">Product photos</h2>
          <p className="text-xs text-stone-400 mb-4">Upload multiple angles. First photo is the cover shown in catalog and jeweler portal.</p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
            {photoUrls.map((url, i) => (
              <div key={url} className="relative aspect-square rounded-xl overflow-hidden border border-stone-200 group">
                <img src={url} alt="" className="w-full h-full object-cover" />
                {i === 0 && <div className="absolute bottom-1 left-1 bg-[#1E3A5F] text-white text-xs px-1.5 py-0.5 rounded-md">Cover</div>}
                <button onClick={() => setPhotoUrls(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <label className="aspect-square border-2 border-dashed border-stone-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-[#1E3A5F] hover:bg-yellow-50 transition-colors">
              <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleImageUpload(e.target.files)} disabled={uploading} />
              <Upload className={`w-5 h-5 mb-1 ${uploading ? 'text-stone-200 animate-pulse' : 'text-stone-300'}`} />
              <span className="text-xs text-stone-300">{uploading ? 'Uploading...' : 'Add photos'}</span>
            </label>
          </div>
          {photoUrls.length === 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              No photos — products without photos show a placeholder on the jeweler portal.
            </p>
          )}
        </div>

        {/* COMPONENTS SECTION */}
        {isSet && (
          <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-stone-100 pb-3">
              <div>
                <h2 className="font-medium text-stone-900">Set Components</h2>
                <p className="text-stone-500 text-xs mt-0.5">Manage and configure each item in this set.</p>
              </div>
              <button
                type="button"
                onClick={addComponent}
                className="flex items-center gap-1.5 text-xs text-[#1E3A5F] border border-[#1E3A5F] px-3 py-1.5 rounded-lg hover:bg-yellow-50 font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Component
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              {components.map((comp, idx) => (
                <button
                  key={comp.id}
                  type="button"
                  onClick={() => setActiveCompIdx(idx)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border flex items-center gap-2 transition-all ${
                    activeCompIdx === idx
                      ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                      : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <span>{comp.component_label || `Component ${idx + 1}`}</span>
                  {components.length > 1 && (
                    <X
                      className="w-3.5 h-3.5 cursor-pointer text-stone-400 hover:text-red-400 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeComponent(idx)
                      }}
                    />
                  )}
                </button>
              ))}
            </div>

            {components[activeCompIdx] && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-stone-50 p-4 rounded-xl border border-stone-100">
                  <div>
                    <label className={lbl}>Component Label * (e.g. Pendant)</label>
                    <input
                      className={inp}
                      value={components[activeCompIdx].component_label}
                      onChange={(e) => updateComponent(activeCompIdx, { component_label: e.target.value })}
                      placeholder="e.g. Pendant"
                    />
                  </div>
                  <div>
                    <label className={lbl}>Category *</label>
                    <select
                      className={inp}
                      value={components[activeCompIdx].category}
                      onChange={(e) => {
                        updateComponent(activeCompIdx, { category: e.target.value, attributes: {} })
                      }}
                    >
                      {categories.length > 0 ? (
                        categories.map((c) => (
                          <option key={c.name} value={c.name}>{c.name}</option>
                        ))
                      ) : (
                        ['Ring', 'Necklace', 'Earring', 'Bracelet'].map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))
                      )}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Metal Type *</label>
                    <select
                      className={inp}
                      value={components[activeCompIdx].metal_type}
                      onChange={(e) => updateComponent(activeCompIdx, { metal_type: e.target.value })}
                    >
                      <option value="gold">Gold</option>
                      <option value="silver">Silver</option>
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Making charges (₹)</label>
                    <input
                      type="number"
                      className={inp}
                      value={components[activeCompIdx].making_charges}
                      onChange={(e) => updateComponent(activeCompIdx, { making_charges: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={lbl}>IGI cert cost (₹)</label>
                    <input
                      type="number"
                      className={inp}
                      value={components[activeCompIdx].igi_cert_cost}
                      onChange={(e) => updateComponent(activeCompIdx, { igi_cert_cost: e.target.value })}
                    />
                  </div>
                </div>

                {(() => {
                  const comp = components[activeCompIdx]
                  const selectedCategory = categories.find(c => c.name.toLowerCase() === comp.category.toLowerCase())
                  const schema = selectedCategory?.attribute_schema || []
                  if (schema.length === 0) return null
                  return (
                    <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5">
                      <h3 className="font-medium text-stone-900 mb-1">Specifications for {comp.component_label} ({comp.category})</h3>
                      <p className="text-xs text-stone-400 mb-4">
                        Provide the specific dimensions and specifications for this component.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {schema.map((field: any) => (
                          <DynamicField
                            key={field.key}
                            field={field}
                            value={comp.attributes[field.key]}
                            onChange={(key, val) => {
                              updateComponent(activeCompIdx, {
                                attributes: { ...comp.attributes, [key]: val }
                              })
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })()}

                <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5">
                  <h3 className="font-medium text-stone-900 mb-1">Component photos</h3>
                  <p className="text-xs text-stone-400 mb-4">Upload photo for this component. First photo is shown in component details.</p>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
                    {components[activeCompIdx].photoUrls.map((url, i) => (
                      <div key={url} className="relative aspect-square rounded-xl overflow-hidden border border-stone-200 group">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        {i === 0 && <div className="absolute bottom-1 left-1 bg-[#1E3A5F] text-white text-xs px-1.5 py-0.5 rounded-md">Main</div>}
                        <button
                          type="button"
                          onClick={() => {
                            updateComponent(activeCompIdx, {
                              photoUrls: components[activeCompIdx].photoUrls.filter((_, idx) => idx !== i)
                            })
                          }}
                          className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <label className="aspect-square border-2 border-dashed border-stone-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-[#1E3A5F] hover:bg-yellow-50 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleComponentImageUpload(activeCompIdx, e.target.files)}
                        disabled={uploading}
                      />
                      <Upload className={`w-5 h-5 mb-1 ${uploading ? 'text-stone-200 animate-pulse' : 'text-stone-300'}`} />
                      <span className="text-xs text-stone-300">{uploading ? 'Uploading...' : 'Add photos'}</span>
                    </label>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-medium text-stone-900">Diamond specifications</h3>
                    <button
                      type="button"
                      onClick={() => addComponentDiamondRow(activeCompIdx)}
                      className="flex items-center gap-1.5 text-xs text-[#1E3A5F] border border-[#1E3A5F] px-3 py-1.5 rounded-lg hover:bg-yellow-50 font-medium transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add row
                    </button>
                  </div>
                  <p className="text-xs text-stone-400 mb-4">
                    Pick diamond shape × size from catalog.
                  </p>

                  <div className="space-y-3">
                    {components[activeCompIdx].diamonds.map((d, idx) => (
                      <div key={d.id} className="border border-stone-100 rounded-xl p-3 bg-stone-50">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-medium text-stone-500">{idx === 0 ? 'Primary diamond' : `Diamond ${idx + 1}`}</span>
                          {components[activeCompIdx].diamonds.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeComponentDiamondRow(activeCompIdx, d.id)}
                              className="text-red-400 hover:text-red-600 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="mb-3">
                          <DiamondCatalogPicker
                            shapeId={d.shape_id || null}
                            sizeId={d.size_id || null}
                            onChange={(picked) => {
                              setComponents(prev => prev.map((c, i) => {
                                if (i !== activeCompIdx) return c
                                const nextDiamonds = c.diamonds.map(row => row.id !== d.id ? row : ({
                                  ...row,
                                  shape_id: picked.shape_id,
                                  size_id: picked.size_id,
                                  size_label: picked.size_label,
                                  shape: picked.shape_name ? picked.shape_name.toLowerCase() : row.shape,
                                  weight: picked.approx_carats != null ? String(picked.approx_carats) : row.weight,
                                }))
                                return { ...c, diamonds: nextDiamonds }
                              }))
                              autofillComponentDiamondCost(activeCompIdx, d.id, picked.shape_id, picked.size_id, d.type, true)
                            }}
                          />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                          <div>
                            <label className={lbl}>Role</label>
                            <select
                              className={inp}
                              value={d.role}
                              onChange={(e) => updateComponentDiamond(activeCompIdx, d.id, 'role', e.target.value)}
                            >
                              {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className={lbl}>Weight (ct)</label>
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              className={inp}
                              value={d.weight}
                              onChange={(e) => updateComponentDiamond(activeCompIdx, d.id, 'weight', e.target.value)}
                              placeholder="0.50"
                            />
                          </div>
                          <div>
                            <label className={lbl}>Pieces</label>
                            <input
                              type="number"
                              inputMode="decimal"
                              min="1"
                              className={inp}
                              value={d.pieces}
                              onChange={(e) => updateComponentDiamond(activeCompIdx, d.id, 'pieces', e.target.value)}
                              placeholder="1"
                            />
                          </div>
                          <div>
                            <label className={lbl}>Quality</label>
                            <select
                              className={inp}
                              value={d.quality}
                              onChange={(e) => updateComponentDiamond(activeCompIdx, d.id, 'quality', e.target.value)}
                            >
                              {qualityBuckets.map((q) => <option key={q.label} value={q.label}>{q.label}</option>)}
                              {qualityBuckets.length === 0 && <option value={d.quality}>{d.quality}</option>}
                            </select>
                          </div>
                          <div>
                            <label className={lbl}>Color</label>
                            <select
                              className={inp}
                              value={d.color}
                              onChange={(e) => updateComponentDiamond(activeCompIdx, d.id, 'color', e.target.value)}
                            >
                              {colorBuckets.map((c) => <option key={c.label} value={c.label}>{c.label}</option>)}
                              {colorBuckets.length === 0 && <option value={d.color}>{d.color}</option>}
                            </select>
                          </div>
                          <div>
                            <label className={lbl}>Type</label>
                            <select
                              className={inp}
                              value={d.type}
                              onChange={(e) => updateComponentDiamond(activeCompIdx, d.id, 'type', e.target.value)}
                            >
                              <option value="lgd">LGD</option>
                              <option value="natural">Natural</option>
                            </select>
                          </div>
                          <div>
                            <label className={lbl}>Cost/pc (₹)</label>
                            <input
                              type="number"
                              inputMode="decimal"
                              className={inp}
                              value={d.cost}
                              onChange={(e) => updateComponentDiamond(activeCompIdx, d.id, 'cost', e.target.value)}
                              placeholder="8000"
                            />
                          </div>
                        </div>

                        {/* Cost suggestions */}
                        {(() => {
                          const sug = costSuggestions[d.id]
                          if (!sug || (sug.matrix.length === 0 && !sug.history)) return null
                          return (
                            <div className="mt-3 border-t border-stone-200 pt-2.5">
                              <p className="text-[11px] font-medium text-stone-500 mb-1.5">Cost suggestions — click to use</p>
                              <div className="flex flex-wrap gap-1.5">
                                {sug.matrix.map((m, i) => {
                                  const wt = parseFloat(d.weight) || 0
                                  const isLgd = d.type === 'lgd'
                                  const pcCost = isLgd ? Math.round(m.price) : Math.round(wt * m.price)
                                  const active = Math.abs((parseFloat(d.cost) || 0) - pcCost) < 0.01
                                  return (
                                    <button
                                      key={`m-${i}`}
                                      type="button"
                                      onClick={() => updateComponentDiamond(activeCompIdx, d.id, 'cost', String(pcCost))}
                                      className={'text-xs px-2 py-1 rounded-md border transition-colors ' +
                                        (active ? 'border-[#1E3A5F] bg-[#1E3A5F]/5 text-[#1E3A5F]'
                                                : 'border-stone-200 bg-white text-stone-600 hover:border-[#1E3A5F]/40')}
                                      title={`Matrix · ${m.quality_label} · ${m.color_label} · Rate: ₹${m.price.toLocaleString('en-IN')}${isLgd ? '/pc' : '/ct'}`}
                                    >
                                      <span className="text-stone-400 mr-1">{m.quality_label}·{m.color_label}</span>
                                      ₹{pcCost.toLocaleString('en-IN')}
                                      <span className="text-[10px] text-stone-400 ml-1">({m.price.toLocaleString('en-IN')}{isLgd ? '/pc' : '/ct'})</span>
                                    </button>
                                  )
                                })}
                                {sug.history && (
                                  <button
                                    type="button"
                                    onClick={() => updateComponentDiamond(activeCompIdx, d.id, 'cost', String(sug.history!.cost))}
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
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5">
                  <h3 className="font-medium text-stone-900 mb-1">Component Metal specifications</h3>
                  <MetalWeightCalculator
                    metalType={components[activeCompIdx].metal_type as 'gold' | 'silver'}
                    initialRefKarat={components[activeCompIdx].refKarat}
                    initialRefColor={components[activeCompIdx].refColor}
                    initialWeights={components[activeCompIdx].metalWeights}
                    onChange={({ metalWeights: mw, refKarat: rk, refColor: rc }) => {
                      setComponents(prev => prev.map((c, i) => {
                        if (i !== activeCompIdx) return c
                        if (
                          JSON.stringify(c.metalWeights) === JSON.stringify(mw) &&
                          c.refKarat === rk &&
                          c.refColor === rc
                        ) return c
                        return {
                          ...c,
                          metalWeights: mw,
                          refKarat: rk,
                          refColor: rc
                        }
                      }))
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* DIAMONDS */}
        {!isSet && (
          <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-medium text-stone-900">Diamond specifications</h2>
              <button onClick={addDiamondRow}
                className="flex items-center gap-1.5 text-xs text-[#1E3A5F] border border-[#1E3A5F] px-3 py-1.5 rounded-lg hover:bg-yellow-50">
                <Plus className="w-3.5 h-3.5" /> Add row
              </button>
            </div>
            <p className="text-xs text-stone-400 mb-4">
              Pick a shape × size from the <Link href="/diamonds/catalog" className="text-[#1E3A5F] underline">diamond catalog</Link> so stock matching works. The legacy fields below stay editable for older entries.
            </p>

            <div className="space-y-3">
              {diamonds.map((d, idx) => (
                <div key={d.id} className="border border-stone-100 rounded-xl p-3 bg-stone-50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-stone-500">{idx === 0 ? 'Primary diamond' : `Diamond ${idx + 1}`}</span>
                    {diamonds.length > 1 && (
                      <button onClick={() => removeDiamondRow(d.id)} className="text-red-400 hover:text-red-600 p-1">
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
                          weight: picked.approx_carats != null
                            ? String(picked.approx_carats)
                            : row.weight,
                        })))
                        autofillCostFor(d.id, picked.shape_id, picked.size_id, d.type, true)
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                    <div>
                      <label className={lbl}>Role</label>
                      <select className={inp} value={d.role} onChange={e => updateDiamond(d.id, 'role', e.target.value)}>
                        {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={lbl}>Weight (ct)</label>
                      <input type="number" inputMode="decimal" step="0.01" className={inp} value={d.weight} onChange={e => updateDiamond(d.id, 'weight', e.target.value)} placeholder="0.50" />
                    </div>
                    <div>
                      <label className={lbl}>Pieces</label>
                      <input type="number" inputMode="decimal" min="1" className={inp} value={d.pieces} onChange={e => updateDiamond(d.id, 'pieces', e.target.value)} placeholder="1" />
                    </div>
                    <div>
                      <label className={lbl}>Quality</label>
                      <select className={inp} value={d.quality} onChange={e => updateDiamond(d.id, 'quality', e.target.value)}>
                        {qualityBuckets.map(q => <option key={q.label} value={q.label}>{q.label}</option>)}
                        {qualityBuckets.length === 0 && <option value={d.quality}>{d.quality}</option>}
                      </select>
                    </div>
                    <div>
                      <label className={lbl}>Color</label>
                      <select className={inp} value={d.color} onChange={e => updateDiamond(d.id, 'color', e.target.value)}>
                        {colorBuckets.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
                        {colorBuckets.length === 0 && <option value={d.color}>{d.color}</option>}
                      </select>
                    </div>
                    <div>
                      <label className={lbl}>Type</label>
                      <select className={inp} value={d.type} onChange={e => updateDiamond(d.id, 'type', e.target.value)}>
                        <option value="lgd">LGD</option>
                        <option value="natural">Natural</option>
                      </select>
                    </div>
                    <div>
                      <label className={lbl}>Cost/pc (₹)</label>
                      <input type="number" inputMode="decimal" className={inp} value={d.cost} onChange={e => updateDiamond(d.id, 'cost', e.target.value)} placeholder="8000" />
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
                            const wt = parseFloat(d.weight) || 0
                            const isLgd = d.type === 'lgd'
                            const pcCost = isLgd ? Math.round(m.price) : Math.round(wt * m.price)
                            const active = Math.abs((parseFloat(d.cost) || 0) - pcCost) < 0.01
                            return (
                              <button
                                key={`m-${i}`}
                                type="button"
                                onClick={() => updateDiamond(d.id, 'cost', String(pcCost))}
                                className={'text-xs px-2 py-1 rounded-md border transition-colors ' +
                                  (active ? 'border-[#1E3A5F] bg-[#1E3A5F]/5 text-[#1E3A5F]'
                                          : 'border-stone-200 bg-white text-stone-600 hover:border-[#1E3A5F]/40')}
                                title={`Matrix · ${m.quality_label} · ${m.color_label} · Rate: ₹${m.price.toLocaleString('en-IN')}${isLgd ? '/pc' : '/ct'}`}
                              >
                                <span className="text-stone-400 mr-1">{m.quality_label}·{m.color_label}</span>
                                ₹{pcCost.toLocaleString('en-IN')}
                                <span className="text-[10px] text-stone-400 ml-1">({m.price.toLocaleString('en-IN')}{isLgd ? '/pc' : '/ct'})</span>
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
        )}

        {/* METAL SPECIFICATIONS */}
        {!isSet && (
          <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5">
            <h2 className="font-medium text-stone-900 mb-1">Metal specifications</h2>
            <p className="text-xs text-stone-400 mb-4">
              Configure the metal type and net weight specifications.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className={lbl}>Metal Type *</label>
                <select className={inp} value={form.metal_type} onChange={e => set('metal_type', e.target.value)}>
                  <option value="gold">Gold</option>
                  <option value="silver">Silver</option>
                </select>
              </div>
              <div>
                <label className={lbl}>IGI cert cost (₹)</label>
                <input type="number" inputMode="decimal" className={inp} value={form.igi_cert_cost} onChange={e => set('igi_cert_cost', e.target.value)} />
              </div>
            </div>

            <MetalWeightCalculator
              metalType={form.metal_type as 'gold' | 'silver'}
              initialRefKarat={refKarat}
              initialRefColor={refColor}
              initialWeights={metalWeights}
              onChange={({ metalWeights: mw, refKarat: rk, refColor: rc }) => {
                setMetalWeights(mw)
                setRefKarat(rk)
                setRefColor(rc)
              }}
            />
          </div>
        )}

        {/* PRICING */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-stone-900 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[#1E3A5F]" />
              {isSilver ? 'Silver pricing' : 'Per-karat pricing'}
            </h2>
            <div>
              <label className={lbl + ' inline-block mr-2'}>Delivery (days)</label>
              <input type="number" inputMode="decimal" className={`${inp} inline-block w-20`} value={form.delivery_days} onChange={e => set('delivery_days', e.target.value)} />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-stone-100">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-xs text-stone-500 uppercase tracking-wide">
                {isSilver ? (
                  <tr>
                    <th className="px-3 py-2 text-left">Metal</th>
                    <th className="px-3 py-2 text-right">Weight (g)</th>
                    <th className="px-3 py-2 text-right">B2B Rate ₹/g</th>
                    <th className="px-3 py-2 text-right">D2C Rate ₹/g</th>
                    <th className="px-3 py-2 text-right">COGS (B2B) ₹</th>
                    <th className="px-3 py-2 text-right">Trade ₹</th>
                    <th className="px-3 py-2 text-right">MRP ₹</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="px-3 py-2 text-left">Karat</th>
                    <th className="px-3 py-2 text-right">Gross weight (g)</th>
                    <th className="px-3 py-2 text-right">Gold ₹</th>
                    <th className="px-3 py-2 text-right">Labour ₹</th>
                    <th className="px-3 py-2 text-right">COGS ₹</th>
                    <th className="px-3 py-2 text-right">Trade ₹</th>
                    <th className="px-3 py-2 text-right">MRP ₹</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {isSilver ? (
                  <tr className="border-t border-stone-100 bg-yellow-50/40">
                    <td className="px-3 py-2 font-medium text-stone-700">Silver</td>
                    <td className="px-3 py-2 text-right text-stone-600">{activeWeight22.toFixed(3)}</td>
                    <td className="px-3 py-2 text-right text-stone-600">₹{silverRateB2B}</td>
                    <td className="px-3 py-2 text-right text-stone-600">₹{silverRateD2C}</td>
                    <td className="px-3 py-2 text-right text-stone-750">₹{activeCogs22.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-semibold text-[#1E3A5F]">₹{activeTradePrice.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-medium text-stone-800">₹{activeMrp.toLocaleString('en-IN')}</td>
                  </tr>
                ) : (
                  activePricing.map(row => (
                    <tr key={row.karat} className={`border-t border-stone-100 ${row.karat === 22 ? 'bg-yellow-50' : ''}`}>
                      <td className="px-3 py-2 font-medium text-stone-700">
                        {row.karat}kt {row.karat === 22 && <span className="text-[10px] text-yellow-700 ml-1">default</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-stone-600">{row.weight.toFixed(4)}</td>
                      <td className="px-3 py-2 text-right text-stone-600">{row.goldCost.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2 text-right text-stone-600">
                        {row.labourCost.toLocaleString('en-IN')}
                        {(retailLabour[row.karat as number] || 0) === 0 && <span className="text-[10px] text-amber-600 ml-1">(no rate)</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-stone-700">{row.cogs.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2 text-right font-semibold text-[#1E3A5F]">{row.trade.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2 text-right font-medium text-stone-800">{row.mrp.toLocaleString('en-IN')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <button onClick={() => setShowBreakdown(!showBreakdown)}
            className="w-full flex items-center justify-between text-sm text-stone-500 hover:text-stone-700 py-2 mt-3 border-t border-stone-100">
            <span className="font-medium">{isSilver ? 'Silver breakdown & margin analysis' : '22kt breakdown & margin analysis'}</span>
            {showBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showBreakdown && (isSilver || activeDefault22) && (
            <div className="mt-3 rounded-xl overflow-hidden border border-stone-100">
              <div className="bg-stone-50 px-4 py-3 space-y-2">
                {isSilver ? (
                  <>
                    {[
                      { label: `Silver B2B Metal (${activeWeight22.toFixed(3)}g @ ₹${silverRateB2B}/g)`, value: activeMetalCost },
                      { label: isSet ? 'Diamonds (sum of components)' : 'Diamonds (all rows)', value: activeTotalDiamondCost },
                      { label: isSet ? 'Making / Labour charges (sum of components)' : 'Making / Labour charges', value: activeMakingCharges },
                      { label: isSet ? 'IGI certification (sum of components)' : 'IGI certification', value: activeIgiCost },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between text-sm">
                        <span className="text-stone-500">{row.label}</span>
                        <span className="text-stone-700">₹{row.value.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                    {isSet && setDiscountPct > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Set Discount ({setDiscountPct}%)</span>
                        <span>-₹{Math.round((activeTradePrice / (1 - setDiscountPct / 100) * (setDiscountPct / 100))).toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-semibold text-stone-800 pt-2 border-t border-stone-200">
                      <span>Total B2B COGS</span>
                      <span>₹{activeCogs22.toLocaleString('en-IN')}</span>
                    </div>
                  </>
                ) : (
                  activeDefault22 && (
                    <>
                      {[
                        { label: `Gold (22K, ${activeDefault22.weight.toFixed(3)}g)`, value: activeMetalCost },
                        { label: isSet ? 'Labour (sum of components)' : `Labour (22K @ ₹${retailLabour[22] || 0}/g)`, value: activeLabourCost },
                        { label: isSet ? 'Diamonds (sum of components)' : 'Diamonds (all rows)', value: activeTotalDiamondCost },
                        { label: isSet ? 'Making charges (sum of components)' : 'Making charges', value: activeMakingCharges },
                        { label: isSet ? 'IGI certification (sum of components)' : 'IGI certification', value: activeIgiCost },
                      ].map(row => (
                        <div key={row.label} className="flex justify-between text-sm">
                          <span className="text-stone-500">{row.label}</span>
                          <span className="text-stone-700">₹{row.value.toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                      {isSet && setDiscountPct > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Set Discount ({setDiscountPct}%)</span>
                          <span>-₹{Math.round((activeTradePrice / (1 - setDiscountPct / 100) * (setDiscountPct / 100))).toLocaleString('en-IN')}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-semibold text-stone-800 pt-2 border-t border-stone-200">
                        <span>Total COGS (22K)</span>
                        <span>₹{activeCogs22.toLocaleString('en-IN')}</span>
                      </div>
                    </>
                  )
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Your margin (trade − COGS)</span>
                  <span className={`font-medium ${activeYourMargin >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    ₹{activeYourMargin.toLocaleString('en-IN')} ({activeTradePrice > 0 ? Math.round((activeYourMargin / activeTradePrice) * 100) : 0}%)
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Jeweler margin (MRP − trade)</span>
                  <span className="font-medium text-blue-600">
                    ₹{activeJewelerMargin.toLocaleString('en-IN')} ({activeMrp > 0 ? Math.round((activeJewelerMargin / activeMrp) * 100) : 0}%)
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* READY-TO-SHIP STOCK OPTION */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5 space-y-4">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="readyToShip"
              className="mt-1 w-4 h-4 rounded text-[#1E3A5F] border-stone-300 focus:ring-[#1E3A5F]"
              checked={isReadyToShip}
              onChange={e => handleToggleReadyToShip(e.target.checked)}
            />
            <div>
              <label htmlFor="readyToShip" className="font-medium text-stone-900 block cursor-pointer">
                Product is available in stock (Ready-to-Ship)
              </label>
              <p className="text-stone-500 text-xs mt-0.5">
                Check this if you have a physical piece of this item ready in your inventory right now. It will appear in the Ready Now section.
              </p>
            </div>
          </div>

          {isReadyToShip && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-stone-100">
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wider">Stock Karat</label>
                <select
                  className="w-full text-sm border-stone-200 rounded-xl focus:border-[#1E3A5F] focus:ring-[#1E3A5F] bg-stone-50"
                  value={refKarat}
                  disabled
                >
                  <option value={refKarat}>{refKarat}</option>
                </select>
                <p className="text-[10px] text-stone-400 mt-1">Matched to the reference karat of this product.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wider">Gross Weight (g)</label>
                <input
                  type="number"
                  step="0.001"
                  className="w-full text-sm border-stone-200 rounded-xl focus:border-[#1E3A5F] focus:ring-[#1E3A5F]"
                  placeholder="e.g. 5.230"
                  value={rtsGrossWeight}
                  onChange={e => setRtsGrossWeight(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wider">List Price (₹)</label>
                <input
                  type="number"
                  className="w-full text-sm border-stone-200 rounded-xl focus:border-[#1E3A5F] focus:ring-[#1E3A5F]"
                  placeholder="e.g. 45000"
                  value={rtsListPrice}
                  onChange={e => setRtsListPrice(e.target.value)}
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wider">Internal / Stock Notes</label>
                <input
                  type="text"
                  className="w-full text-sm border-stone-200 rounded-xl focus:border-[#1E3A5F] focus:ring-[#1E3A5F]"
                  placeholder="e.g. Size 12 ring, ready at counter 1"
                  value={rtsInternalNotes}
                  onChange={e => setRtsInternalNotes(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* MODELS */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5">
          <h2 className="font-medium text-stone-900 mb-3">Available for models</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'wholesale', label: 'Wholesale catalog' },
              { id: 'design_make', label: 'Design + Make' },
              { id: 'white_label', label: 'White Label OEM' },
            ].map(m => (
              <button key={m.id} onClick={() => toggleModel(m.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  form.models_available.includes(m.id)
                    ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                    : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300'
                }`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* VALIDATION ERRORS */}
        {validationErrors.length > 0 && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4 space-y-1">
            <p className="font-semibold">Please correct the following errors:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {validationErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* ACTIONS */}
        <div className="flex justify-end gap-3 pt-2">
          <Link href="/catalog" className="px-5 py-2.5 text-sm text-stone-600 border border-stone-200 rounded-xl hover:bg-stone-50">
            Cancel
          </Link>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-[#1E3A5F] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#162B47] disabled:opacity-50 transition-colors">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save product'}
          </button>
        </div>
      </div>
    </div>
  )
}
