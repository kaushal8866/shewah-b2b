/**
 * Core Diamond Specifications & Weight Basis Calculations
 * File: lib/diamondSpecs.ts
 *
 * Weight Basis Semantics:
 * - 'group': The stored row weight represents the combined total carat weight across all pieces in that row.
 * - 'per_stone': The stored row weight represents the carat weight of a single stone; total is weight * pieces.
 * - Single-piece rows (pieces <= 1): Stored weight is unambiguous and equals total weight.
 * - Legacy / Unverified rows (pieces > 1, no weight_basis): Must NOT silently default to per_stone or group.
 *   Individual row renders no asserted total ('— (basis required)').
 */

export type DiamondWeightBasis = 'group' | 'per_stone'

export interface DiamondSpecRow {
  role?: string
  shape?: string
  shape_id?: string | null
  size_id?: string | null
  size_label?: string | null
  type?: string
  color?: string
  quality?: string
  pieces?: number | string
  weight?: number | string
  cost?: number | string
  weight_basis?: DiamondWeightBasis | null | ''
  [key: string]: any
}

/**
 * Computes the total carat weight for a single diamond spec row.
 * Returns:
 * - number if row basis is known or row is single-piece.
 * - null if row is multi-piece and has no weight_basis (no asserted total).
 */
export function computeRowDiamondWeight(row: any): number | null {
  if (!row) return 0
  const pieces = Math.max(parseInt(String(row.pieces), 10) || 1, 1)
  const weight = parseFloat(String(row.weight)) || 0

  if (weight <= 0) return 0
  if (pieces === 1) return weight

  const basis = row.weight_basis || row.basis

  if (basis === 'group') {
    return weight
  }

  if (basis === 'per_stone') {
    return Number((weight * pieces).toFixed(3))
  }

  // Row has multiple pieces but NO explicit weight basis tag.
  // Rule: A row with no basis tag renders no asserted total.
  return null
}

/**
 * Formats a single row's total carats for display in admin forms and spec summaries.
 */
export function formatRowTotalCarats(row: any): string {
  const pieces = Math.max(parseInt(String(row?.pieces), 10) || 1, 1)
  const weight = parseFloat(String(row?.weight)) || 0

  if (weight <= 0) return '0 ct'
  if (pieces === 1) return `${parseFloat(weight.toFixed(3))} ct`

  const basis = row?.weight_basis || row?.basis
  if (basis === 'group') {
    return `${parseFloat(weight.toFixed(3))} ct total`
  }
  if (basis === 'per_stone') {
    const total = weight * pieces
    return `${parseFloat(total.toFixed(3))} ct total (${parseFloat(weight.toFixed(3))} ct × ${pieces})`
  }

  return '— (basis required)'
}

export interface ProductDiamondSummary {
  totalCarats: number | null
  displayTotal: string
  hasUnverifiedRows: boolean
  verifiedCarats: number
  unverifiedRowCount: number
}

/**
 * Computes the product-level diamond total carat weight across all rows.
 * - For verified products, returns exact combined total.
 * - For products with unverified multi-piece rows, flags hasUnverifiedRows = true.
 */
export function computeProductDiamondCarats(product: {
  diamond_specs?: any[] | null
  diamond_weight?: number | string | null
}): ProductDiamondSummary {
  const specs = Array.isArray(product?.diamond_specs) ? product.diamond_specs : []

  if (specs.length === 0) {
    const fallback = product?.diamond_weight != null ? parseFloat(String(product.diamond_weight)) : null
    const val = fallback && fallback > 0 ? parseFloat(fallback.toFixed(3)) : null
    return {
      totalCarats: val,
      displayTotal: val ? `${val}ct` : '0ct',
      hasUnverifiedRows: false,
      verifiedCarats: val || 0,
      unverifiedRowCount: 0,
    }
  }

  let verifiedTotal = 0
  let fallbackTotal = 0
  let unverifiedCount = 0

  for (const row of specs) {
    const pieces = Math.max(parseInt(String(row?.pieces), 10) || 1, 1)
    const weight = parseFloat(String(row?.weight)) || 0
    const rowTotal = computeRowDiamondWeight(row)

    if (rowTotal !== null) {
      verifiedTotal += rowTotal
      fallbackTotal += rowTotal
    } else {
      unverifiedCount++
      // For unverified legacy rows, current display preserved stored weight without multiplying
      fallbackTotal += weight
    }
  }

  const hasUnverifiedRows = unverifiedCount > 0
  const finalCarats = hasUnverifiedRows
    ? Number(fallbackTotal.toFixed(3))
    : Number(verifiedTotal.toFixed(3))

  const displayVal = finalCarats > 0 ? parseFloat(finalCarats.toFixed(3)) : 0

  return {
    totalCarats: displayVal,
    displayTotal: `${displayVal}ct`,
    hasUnverifiedRows,
    verifiedCarats: Number(verifiedTotal.toFixed(3)),
    unverifiedRowCount: unverifiedCount,
  }
}

/**
 * Audit lists: 14 Verified-Combined products + 1 Verified Per-Stone (SH-622)
 */
export const VERIFIED_COMBINED_PRODUCTS = [
  'SH-592', 'SH-593', 'SH-595', 'SH-599', 'SH-600',
  'SH-603', 'SH-604', 'SH-608', 'SH-611', 'SH-612',
  'SH-614', 'SH-620', 'SH-622', 'SH-623', 'SH-624',
] as const

/**
 * 17 Basis-Unverified products held for owner review
 */
export const UNVERIFIED_BASIS_PRODUCTS = [
  'SH-591', 'SH-594', 'SH-596', 'SH-598', 'SH-601',
  'SH-602', 'SH-605', 'SH-606', 'SH-607', 'SH-609',
  'SH-610', 'SH-613', 'SH-615', 'SH-616', 'SH-618',
  'SH-621', 'SH-625',
] as const

/**
 * 4 Products with single-piece rows only (unaffected)
 */
export const SINGLE_PIECE_ONLY_PRODUCTS = [
  'SH-590', 'SH-597', 'SH-617', 'SH-619',
] as const
