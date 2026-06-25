'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, AttributeField, ProductCategory } from '@/lib/supabase'
import { ArrowLeft, Save, Plus, Trash2, ChevronUp, ChevronDown, Settings } from 'lucide-react'
import Link from 'next/link'

const FIELD_TYPES = [
  { value: 'text', label: 'Short Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Yes/No (Boolean)' },
  { value: 'select', label: 'Dropdown Select' },
  { value: 'multiselect', label: 'Multi-select Checklist' },
  { value: 'textarea', label: 'Long Text Area' },
  { value: 'date', label: 'Date Picker' },
]

export default function EditCategoryPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [sortOrder, setSortOrder] = useState('0')
  const [fields, setFields] = useState<Partial<AttributeField>[]>([])

  const lbl = 'block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1'
  const inp = 'w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white shadow-sm'

  useEffect(() => {
    fetchCategory()
  }, [id])

  async function fetchCategory() {
    try {
      setLoading(true)
      const { data, error: err } = await supabase
        .from('product_categories')
        .select('*')
        .eq('id', id)
        .single()

      if (err) {
        setError(err.message)
      } else if (data) {
        setName(data.name)
        setIsActive(data.is_active)
        setSortOrder(String(data.sort_order || 0))
        setFields(Array.isArray(data.attribute_schema) ? data.attribute_schema : [])
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load category')
    } finally {
      setLoading(false)
    }
  }

  function slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '_')
      .replace(/^-+|-+$/g, '')
  }

  function addField() {
    setFields(prev => [
      ...prev,
      {
        key: '',
        label: '',
        type: 'text',
        required: false,
        options: [],
        unit: '',
        placeholder: '',
        help_text: '',
      },
    ])
  }

  function removeField(index: number) {
    setFields(prev => prev.filter((_, i) => i !== index))
  }

  function updateField(index: number, updates: Partial<AttributeField>) {
    setFields(prev =>
      prev.map((f, i) => {
        if (i !== index) return f
        const merged = { ...f, ...updates }
        if (updates.label !== undefined && (!f.key || f.key === slugify(f.label || ''))) {
          merged.key = slugify(updates.label)
        }
        return merged
      })
    )
  }

  function moveField(index: number, direction: 'up' | 'down') {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === fields.length - 1) return

    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const updated = [...fields]
    const temp = updated[index]
    updated[index] = updated[targetIndex]
    updated[targetIndex] = temp
    setFields(updated)
  }

  async function handleSave() {
    if (!name.trim()) {
      alert('Category Name is required')
      return
    }

    // Validate fields
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i]
      if (!f.label?.trim()) {
        alert(`Field #${i + 1} is missing a Label`)
        return
      }
      if (!f.key?.trim()) {
        alert(`Field #${i + 1} (${f.label}) is missing a Key`)
        return
      }
      if (['select', 'multiselect'].includes(f.type || '') && (!f.options || f.options.length === 0)) {
        alert(`Field #${i + 1} (${f.label}) must have at least one option defined`)
        return
      }
    }

    setSaving(true)
    const slug = slugify(name)

    const payload = {
      name: name.trim(),
      slug,
      is_active: isActive,
      sort_order: parseInt(sortOrder) || 0,
      attribute_schema: fields.map(f => ({
        key: f.key?.trim(),
        label: f.label?.trim(),
        type: f.type || 'text',
        required: !!f.required,
        unit: f.unit?.trim() || undefined,
        placeholder: f.placeholder?.trim() || undefined,
        help_text: f.help_text?.trim() || undefined,
        options: ['select', 'multiselect'].includes(f.type || '') ? f.options : undefined,
      })),
      updated_at: new Date().toISOString(),
    }

    try {
      const { error } = await supabase
        .from('product_categories')
        .update(payload)
        .eq('id', id)

      if (error) {
        alert('Error saving category: ' + error.message)
      } else {
        router.push('/catalog/categories')
      }
    } catch (err: any) {
      alert('Error saving category: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-4 lg:p-7 text-stone-400 text-sm">Loading category...</div>

  if (error) {
    return (
      <div className="p-4 lg:p-7 max-w-4xl mx-auto">
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 mb-4">
          Error: {error}
        </div>
        <Link href="/catalog/categories" className="text-sm font-semibold text-[#1E3A5F] hover:underline">
          Back to Categories
        </Link>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-7 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/catalog/categories"
          className="p-2 border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors text-stone-500"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2 text-stone-500 text-xs mb-0.5 font-medium">
            <Link href="/catalog" className="hover:text-stone-700">Catalog</Link>
            <span>/</span>
            <Link href="/catalog/categories" className="hover:text-stone-700">Categories</Link>
            <span>/</span>
            <span className="text-stone-700">Edit</span>
          </div>
          <h1 className="text-xl font-semibold text-stone-900 tracking-tight">Edit Category: {name}</h1>
        </div>
      </div>

      <div className="space-y-6">
        {/* Category Details Card */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5 shadow-sm space-y-4">
          <h2 className="font-semibold text-stone-900 text-sm flex items-center gap-2">
            <Settings className="w-4 h-4 text-stone-400" />
            Category Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className={lbl}>Category Name *</label>
              <input
                type="text"
                className={inp}
                placeholder="e.g. Pendant, Bangles"
                value={name}
                onChange={e => setName(e.target.value)}
              />
              <p className="text-[10px] text-stone-400 mt-1">
                Category Slug (Read-only): <span className="font-mono text-stone-600">{slugify(name)}</span>
              </p>
            </div>
            <div>
              <label className={lbl}>Sort Order</label>
              <input
                type="number"
                className={inp}
                placeholder="0"
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                className="rounded border-stone-300 text-amber-600 focus:ring-amber-500 w-4 h-4"
              />
              <span className="text-xs text-stone-700 font-semibold uppercase tracking-wider">Active category</span>
            </label>
          </div>
        </div>

        {/* Schema Builder Card */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-stone-150 pb-3">
            <div>
              <h2 className="font-semibold text-stone-900 text-sm">Attribute Fields Schema</h2>
              <p className="text-[11px] text-stone-400">Design the input fields that appear when editing products in this category.</p>
            </div>
            <button
              onClick={addField}
              className="flex items-center gap-1 bg-[#1E3A5F] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#162B47] transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Field
            </button>
          </div>

          {fields.length === 0 ? (
            <div className="py-8 text-center text-stone-400 text-xs border border-dashed border-stone-200 rounded-xl bg-stone-50/50">
              No fields defined. Click &quot;Add Field&quot; to begin building your schema.
            </div>
          ) : (
            <div className="space-y-4">
              {fields.map((field, idx) => (
                <div
                  key={idx}
                  className="p-4 border border-stone-200 rounded-xl bg-stone-50/30 shadow-sm relative group hover:border-stone-300 transition-colors"
                >
                  {/* Field Actions Top Right */}
                  <div className="absolute top-3 right-3 flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => moveField(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1 hover:bg-stone-100 rounded text-stone-500 disabled:opacity-30"
                      title="Move Up"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveField(idx, 'down')}
                      disabled={idx === fields.length - 1}
                      className="p-1 hover:bg-stone-100 rounded text-stone-500 disabled:opacity-30"
                      title="Move Down"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeField(idx)}
                      className="p-1 hover:bg-red-50 text-red-500 rounded ml-1"
                      title="Delete Field"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Header Title */}
                  <div className="text-xs font-semibold text-amber-700 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                    <span>Field #{idx + 1}</span>
                    {field.label && <span className="text-stone-400 font-normal">| {field.label}</span>}
                  </div>

                  {/* Field Inputs Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className={lbl}>Label *</label>
                      <input
                        type="text"
                        className={inp}
                        placeholder="e.g. Ring Size, Metal Color"
                        value={field.label || ''}
                        onChange={e => updateField(idx, { label: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={lbl}>Unique Key *</label>
                      <input
                        type="text"
                        className={inp}
                        placeholder="e.g. ring_size, metal_color"
                        value={field.key || ''}
                        onChange={e => updateField(idx, { key: slugify(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className={lbl}>Field Type</label>
                      <select
                        className={inp}
                        value={field.type || 'text'}
                        onChange={e => updateField(idx, { type: e.target.value as any })}
                      >
                        {FIELD_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Numeric Options */}
                    {field.type === 'number' && (
                      <>
                        <div>
                          <label className={lbl}>Unit Label (e.g. mm, inches)</label>
                          <input
                            type="text"
                            className={inp}
                            placeholder="e.g. mm"
                            value={field.unit || ''}
                            onChange={e => updateField(idx, { unit: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className={lbl}>Min Value (Optional)</label>
                          <input
                            type="number"
                            className={inp}
                            placeholder="e.g. 0"
                            value={field.min !== undefined ? field.min : ''}
                            onChange={e => updateField(idx, { min: e.target.value === '' ? undefined : Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <label className={lbl}>Max Value (Optional)</label>
                          <input
                            type="number"
                            className={inp}
                            placeholder="e.g. 100"
                            value={field.max !== undefined ? field.max : ''}
                            onChange={e => updateField(idx, { max: e.target.value === '' ? undefined : Number(e.target.value) })}
                          />
                        </div>
                      </>
                    )}

                    {/* Text Field Options */}
                    {['text', 'textarea'].includes(field.type || '') && (
                      <div>
                        <label className={lbl}>Max Character Length</label>
                        <input
                          type="number"
                          className={inp}
                          placeholder="e.g. 150"
                          value={field.max_length || ''}
                          onChange={e => updateField(idx, { max_length: e.target.value === '' ? undefined : parseInt(e.target.value) })}
                        />
                      </div>
                    )}

                    {/* Common Placeholders */}
                    {['text', 'textarea', 'number'].includes(field.type || '') && (
                      <div>
                        <label className={lbl}>Placeholder</label>
                        <input
                          type="text"
                          className={inp}
                          placeholder="e.g. Enter dimension details"
                          value={field.placeholder || ''}
                          onChange={e => updateField(idx, { placeholder: e.target.value })}
                        />
                      </div>
                    )}

                    {/* Dropdown Options List */}
                    {['select', 'multiselect'].includes(field.type || '') && (
                      <div className="sm:col-span-2">
                        <label className={lbl}>Dropdown Options (comma-separated) *</label>
                        <input
                          type="text"
                          className={inp}
                          placeholder="e.g. Solitaire, Halo, Cluster, Three-Stone"
                          value={field.options?.join(', ') || ''}
                          onChange={e => {
                            const arr = e.target.value
                              .split(',')
                              .map(x => x.trim())
                              .filter(x => x !== '')
                            updateField(idx, { options: arr })
                          }}
                        />
                        <p className="text-[10px] text-stone-400 mt-1">
                          Parsed: {field.options && field.options.length > 0 ? (
                            field.options.map((x, i) => (
                              <span key={i} className="inline-block bg-stone-200 text-stone-700 px-1 py-0.5 rounded mr-1 font-mono text-[9px]">{x}</span>
                            ))
                          ) : (
                            <span className="text-red-400 italic">No options defined yet</span>
                          )}
                        </p>
                      </div>
                    )}

                    <div className="sm:col-span-2">
                      <label className={lbl}>Help text / Description</label>
                      <input
                        type="text"
                        className={inp}
                        placeholder="e.g. Shown below the field as helper guide"
                        value={field.help_text || ''}
                        onChange={e => updateField(idx, { help_text: e.target.value })}
                      />
                    </div>

                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!field.required}
                          onChange={e => updateField(idx, { required: e.target.checked })}
                          className="rounded border-stone-300 text-amber-600 focus:ring-amber-500 w-4 h-4"
                        />
                        <span className="text-xs text-stone-600 font-semibold">Field is Required</span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/catalog/categories"
            className="px-5 py-2.5 text-sm text-stone-600 border border-stone-200 rounded-xl hover:bg-stone-50"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-[#1E3A5F] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#162B47] disabled:opacity-50 transition-colors shadow-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Category'}
          </button>
        </div>
      </div>
    </div>
  )
}
