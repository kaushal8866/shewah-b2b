/**
 * Shewah B2B — Governance & Ethics Engine
 * Implements SOP §5 (Sales Ops) and §6 (Financial Gates)
 */

import { Partner } from './supabase'

/**
 * Calculates the Haversine distance between two sets of coordinates in meters.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3 // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return Math.round(R * c)
}

/**
 * SOP §5.1: Geofencing Logic
 * Verified if within 500m.
 */
export function verifyVisitProximity(
  storeLat: number | null,
  storeLng: number | null,
  repLat: number | null,
  repLng: number | null,
  thresholdMeters = 500
): { isVerified: boolean; distance: number | null } {
  if (!storeLat || !storeLng || !repLat || !repLng) {
    return { isVerified: false, distance: null }
  }

  const distance = calculateDistanceMeters(storeLat, storeLng, repLat, repLng)
  return {
    isVerified: distance <= thresholdMeters,
    distance,
  }
}

/**
 * SOP §6.12: Credit Logic
 * Flags orders exceeding limits or absolute threshold.
 */
export const CREDIT_GATE_THRESHOLD_PAISE = 500000 * 100 // ₹5,00,000

export function evaluateCreditRisk(
  partner: Partner,
  newOrderAmountPaise: number,
  outstandingBalancePaise = 0
): {
  isSafe: boolean
  requiresApproval: boolean
  reason?: string
} {
  // 1. Absolute Threshold Gate
  if (newOrderAmountPaise >= CREDIT_GATE_THRESHOLD_PAISE) {
    return {
      isSafe: true,
      requiresApproval: true,
      reason: 'Order amount exceeds mandatory ₹5L approval threshold.',
    }
  }

  // 2. Partner Limit Gate
  const limit = partner.credit_limit_paise || 0
  if (limit > 0 && (outstandingBalancePaise + newOrderAmountPaise) > limit) {
    return {
      isSafe: false,
      requiresApproval: true,
      reason: `Combined balance exceeds partner credit limit of ₹${limit / 100}.`,
    }
  }

  // 3. Forced Approval Gate
  if (partner.credit_approval_required) {
    return {
      isSafe: true,
      requiresApproval: true,
      reason: 'Partner is flagged for manual approval on all orders.',
    }
  }

  return { isSafe: true, requiresApproval: false }
}
