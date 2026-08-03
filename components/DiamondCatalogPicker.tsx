'use client'

import { useEffect, useState } from 'react'

export type CatalogShape = { id: string; name: string; active: boolean }
export type CatalogSize  = {
  id: string; shape_id: string; label: string; active: boolean
  approx_carats: number | null
}

let cache: { shapes: CatalogShape[]; sizes: CatalogSize[]; loadedAt: number } | null = null

/** Tiny shared loader — dozens of diamond rows shouldn't each trigger
 *  their own fetch. The cache is per page navigation; the catalog admin
 *  is the source of truth and a hard refresh picks up changes. */
export function useDiamondCatalog() {
  const [data, setData] = useState(cache)
  useEffect(() => {
    if (cache && Date.now() - cache.loadedAt < 5 * 60_000) { setData(cache); return }
    let cancelled = false
    Promise.all([
      fetch('/api/diamonds/shapes').then(r => r.json()),
      fetch('/api/diamonds/sizes').then(r => r.json()),
    ]).then(([s, z]) => {
      if (cancelled) return
      cache = { shapes: s.shapes || [], sizes: z.sizes || [], loadedAt: Date.now() }
      setData(cache)
    })
    return () => { cancelled = true }
  }, [])
  return data || { shapes: [], sizes: [] }
}

/** Cascading shape → size picker for product editors and stock forms.
 *  Returns the picked shape_id, size_id, and (optionally) the catalog's
 *  approx_carats so the caller can auto-fill a weight field. */
export function DiamondCatalogPicker({
  shapeId, sizeId, onChange, disabled, compact, lblClass, inpClass,
}: {
  shapeId: string | null
  sizeId: string | null
  onChange: (next: { shape_id: string; size_id: string; shape_name: string; size_label: string; approx_carats: number | null }) => void
  disabled?: boolean
  compact?: boolean
  lblClass?: string
  inpClass?: string
}) {
  const { shapes, sizes } = useDiamondCatalog()
  const lbl = lblClass || 'block text-xs font-medium text-stone-500 mb-1'
  const inp = inpClass || 'w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:border-stone-800 outline-none bg-white'
  const activeShapes = shapes.filter(s => s.active || s.id === shapeId)
  const activeSizes = sizes.filter(z => z.shape_id === shapeId && (z.active || z.id === sizeId))

  return (
    <div className={compact ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-2 gap-3'}>
      <div>
        <label className={lbl}>Catalog shape</label>
        <select className={inp} disabled={disabled}
          value={shapeId || ''}
          onChange={e => {
            const sh = shapes.find(s => s.id === e.target.value)
            onChange({
              shape_id: sh?.id || '',
              size_id: '',
              shape_name: sh?.name || '',
              size_label: '',
              approx_carats: null,
            })
          }}>
          <option value="">— pick shape —</option>
          {activeShapes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className={lbl}>Catalog size</label>
        <select className={inp} disabled={disabled || !shapeId}
          value={sizeId || ''}
          onChange={e => {
            const sz = sizes.find(z => z.id === e.target.value)
            const sh = shapes.find(s => s.id === shapeId)
            onChange({
              shape_id: shapeId || '',
              size_id: sz?.id || '',
              shape_name: sh?.name || '',
              size_label: sz?.label || '',
              approx_carats: sz?.approx_carats ?? null,
            })
          }}>
          <option value="">{shapeId ? '— pick size —' : 'shape first'}</option>
          {activeSizes.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
        </select>
      </div>
    </div>
  )
}
