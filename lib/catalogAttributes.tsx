'use client'

import { AttributeField } from './supabase'

interface DynamicFieldProps {
  field: AttributeField
  value: any
  onChange: (key: string, val: any) => void
}

export function DynamicField({ field, value, onChange }: DynamicFieldProps) {
  const lbl = 'block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1'
  const inp = 'w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white shadow-sm'
  const checkboxClass = 'rounded border-stone-300 text-amber-600 focus:ring-amber-500 w-4 h-4'

  const labelText = (
    <span className={lbl}>
      {field.label}
      {field.required && <span className="text-red-500 ml-0.5">*</span>}
      {field.unit && <span className="text-stone-400 normal-case ml-1">({field.unit})</span>}
    </span>
  )

  const renderInput = () => {
    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            className={inp}
            rows={3}
            value={value || ''}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            maxLength={field.max_length}
            onChange={e => onChange(field.key, e.target.value)}
          />
        )

      case 'number':
        return (
          <input
            type="number"
            inputMode="decimal"
            step="any"
            className={inp}
            value={value !== undefined && value !== null ? value : ''}
            min={field.min}
            max={field.max}
            placeholder={field.placeholder || `0.00`}
            onChange={e => {
              const val = e.target.value === '' ? null : Number(e.target.value)
              onChange(field.key, val)
            }}
          />
        )

      case 'boolean':
        return (
          <label className="flex items-center gap-2 cursor-pointer py-1.5">
            <input
              type="checkbox"
              checked={!!value}
              className={checkboxClass}
              onChange={e => onChange(field.key, e.target.checked)}
            />
            <span className="text-sm text-stone-700 font-medium">{field.label}</span>
          </label>
        )

      case 'select':
        return (
          <select
            className={inp}
            value={value || ''}
            onChange={e => onChange(field.key, e.target.value || null)}
          >
            <option value="">Select option</option>
            {field.options?.map(opt => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        )

      case 'multiselect':
        const selectedArr: string[] = Array.isArray(value) ? value : []
        const toggleOption = (opt: string) => {
          if (selectedArr.includes(opt)) {
            onChange(field.key, selectedArr.filter(x => x !== opt))
          } else {
            onChange(field.key, [...selectedArr, opt])
          }
        }
        return (
          <div className="border border-stone-200 rounded-xl p-3 bg-stone-50/50 space-y-2">
            {field.options && field.options.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {field.options.map(opt => (
                  <label key={opt} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedArr.includes(opt)}
                      className={checkboxClass}
                      onChange={() => toggleOption(opt)}
                    />
                    <span className="text-sm text-stone-600">{opt}</span>
                  </label>
                ))}
              </div>
            ) : (
              <span className="text-xs text-stone-400">No options defined</span>
            )}
          </div>
        )

      case 'date':
        return (
          <input
            type="date"
            className={inp}
            value={value || ''}
            onChange={e => onChange(field.key, e.target.value || null)}
          />
        )

      case 'text':
      default:
        return (
          <input
            type="text"
            className={inp}
            value={value || ''}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            maxLength={field.max_length}
            onChange={e => onChange(field.key, e.target.value)}
          />
        )
    }
  }

  return (
    <div className="space-y-1">
      {field.type !== 'boolean' && labelText}
      {renderInput()}
      {field.help_text && <p className="text-[11px] text-stone-400 mt-1">{field.help_text}</p>}
    </div>
  )
}

export function validateAttributes(attributes: Record<string, any>, schema: AttributeField[]): string[] {
  const errors: string[] = []
  const attrs = attributes || {}

  for (const field of schema) {
    const val = attrs[field.key]

    // 1. Required field check
    if (field.required) {
      const isMissing =
        val === undefined ||
        val === null ||
        (typeof val === 'string' && val.trim() === '') ||
        (Array.isArray(val) && val.length === 0)

      if (isMissing) {
        errors.push(`${field.label} is required.`)
        continue
      }
    }

    // Skip validations if value is empty/null/undefined
    if (val === undefined || val === null || val === '') continue

    // 2. Number bounds check
    if (field.type === 'number') {
      const num = Number(val)
      if (isNaN(num)) {
        errors.push(`${field.label} must be a number.`)
      } else {
        if (field.min !== undefined && num < field.min) {
          errors.push(`${field.label} cannot be less than ${field.min} ${field.unit || ''}.`)
        }
        if (field.max !== undefined && num > field.max) {
          errors.push(`${field.label} cannot be greater than ${field.max} ${field.unit || ''}.`)
        }
      }
    }

    // 3. Text length check
    if ((field.type === 'text' || field.type === 'textarea') && field.max_length) {
      const len = String(val).length
      if (len > field.max_length) {
        errors.push(`${field.label} exceeds maximum length of ${field.max_length} characters.`)
      }
    }
  }

  return errors
}
