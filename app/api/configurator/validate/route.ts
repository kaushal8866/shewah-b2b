import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// Helper to evaluate conditions
export function evaluateCondition(config: any, condition: any): boolean {
  if (!condition || !condition.field) return true

  const { field, equals, not_equals, in: inList, not_in: notInList } = condition

  // Retrieve field value from config (check root level and category_options)
  let val = config[field]
  if (val === undefined && config.category_options) {
    val = config.category_options[field]
  }

  // Normalize string comparisons to lowercase
  const normalize = (v: any) => (typeof v === 'string' ? v.toLowerCase() : v)
  const normalizedVal = normalize(val)

  if (equals !== undefined) {
    return normalizedVal === normalize(equals)
  }
  if (not_equals !== undefined) {
    return normalizedVal !== normalize(not_equals)
  }
  if (inList !== undefined && Array.isArray(inList)) {
    return inList.map(normalize).includes(normalizedVal)
  }
  if (notInList !== undefined && Array.isArray(notInList)) {
    return !notInList.map(normalize).includes(normalizedVal)
  }

  return false
}

// Evaluates a rule against configuration
export function checkRuleViolation(config: any, rule: any): { violated: boolean; message: string; action: string } | null {
  const conds = rule.conditions
  if (!conds || !conds.when || !conds.then) return null

  // Check if "when" condition is met
  const whenMet = evaluateCondition(config, conds.when)
  if (!whenMet) return null // Rule does not apply

  // Check if "then" condition is violated
  const thenSatisfied = evaluateCondition(config, conds.then)

  if (!thenSatisfied) {
    return {
      violated: true,
      message: rule.action_message || `Rule violation: ${rule.name}`,
      action: rule.action
    }
  }

  return null
}

// POST /api/configurator/validate
// Evaluates configuration against all rules in the system
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { productId, category, config } = body

    if (!config) {
      return NextResponse.json({ error: 'config object is required' }, { status: 400 })
    }

    // Resolve category if not passed
    let resolvedCategory = category
    if (!resolvedCategory && productId) {
      const { data: prod } = await supabaseAdmin
        .from('products')
        .select('category')
        .eq('id', productId)
        .maybeSingle()
      if (prod) {
        resolvedCategory = prod.category
      }
    }

    // Fetch active rules for this category or global
    let rulesQuery = supabaseAdmin
      .from('cfg_rules')
      .select('*')
      .eq('is_active', true)

    if (resolvedCategory) {
      rulesQuery = rulesQuery.or(`category.eq.${resolvedCategory},category.is.null`)
    } else {
      rulesQuery = rulesQuery.is('category', null)
    }

    const { data: rules, error } = await rulesQuery.order('priority', { ascending: false })

    if (error) throw error

    const errors: string[] = []
    const warnings: string[] = []

    for (const rule of (rules || [])) {
      const result = checkRuleViolation(config, rule)
      if (result && result.violated) {
        if (result.action === 'warn') {
          warnings.push(result.message)
        } else {
          // 'disable', 'require', 'hide' represent hard failures
          errors.push(result.message)
        }
      }
    }

    // Metal-finish compatibility check
    if (config.metal_id && config.finish_id) {
      const { data: compat, error: compatErr } = await supabaseAdmin
        .from('cfg_finish_metal_compat')
        .select('*')
        .eq('finish_id', config.finish_id)
        .eq('metal_id', config.metal_id)

      if (compatErr) throw compatErr

      // If a compatibility record exists, it might be restricted to specific karats
      if (!compat || compat.length === 0) {
        errors.push('Selected finish is not compatible with the selected metal.')
      } else {
        // If karat is specified, check if any compat row matches this karat or is null (all karats)
        if (config.karat) {
          const hasValidKarat = compat.some(c => c.karat === null || Number(c.karat) === Number(config.karat))
          if (!hasValidKarat) {
            errors.push(`Selected finish is not compatible with the selected metal karat (${config.karat}K).`)
          }
        }
      }
    }

    return NextResponse.json({
      valid: errors.length === 0,
      errors,
      warnings
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
