// Library for CAD gold weight alloy density calculations and ring/bangle size scaling.
//
// Densities come from lib/metalPhysics.ts. This file previously carried its own
// ALLOY_DENSITY table that disagreed with lib/karat.ts by up to 8.2% — and in
// the opposite direction for 18K white — so a CAD-derived weight and a catalog
// karat conversion produced different weights for the same physical piece.
// 9K also silently reused 10K densities here.

import { densityFor, type MetalColor } from './metalPhysics'

export { ALLOY_DENSITY } from './metalPhysics'

export const SETTING_FACTORS: Record<string, number> = {
  prong: 0.25,
  bezel: 0.60,
  pave: 0.18,
  channel: 0.22
};

export const FINISH_FACTOR = 0.817;

/**
 * Resolves alloy density in g/cm3 based on karat and metal tone.
 * Reads the shared table in lib/metalPhysics.ts.
 */
export function getAlloyDensity(karat: string | number, tone: string): number {
  const raw = String(karat).toUpperCase();

  if (raw.includes('SILVER')) {
    return densityFor(raw.includes('999') ? 'silver_999' : 'silver_925') ?? 10.49;
  }
  if (raw.includes('PLATINUM') || raw.includes('PT')) {
    return densityFor('platinum_950') ?? 20.10;
  }

  let color: MetalColor = 'yellow';
  if (tone) {
    const t = tone.toLowerCase();
    if (t.includes('rose') || t === 'r') color = 'rose';
    else if (t.includes('white') || t === 'w') color = 'white';
  }

  const numericKarat = parseInt(raw.replace(/[^\d]/g, ''), 10);
  if (isNaN(numericKarat)) return 15.55; // fallback: 18K yellow

  return densityFor(`${numericKarat}K`, color) ?? 15.55;
}

/**
 * Calculates diamond volume in cm3 from carat weight.
 * Diamond density = 3.52 g/cm3.
 * 1 carat = 0.2 grams.
 */
export function getStoneVolume(carats: number): number {
  return (carats * 0.2) / 3.52;
}

/**
 * Calculates total seat deduction volume in cm3 from diamond rows.
 */
export function getStoneSeatVolume(
  diamonds: Array<{ weight?: string | number; pieces?: string | number; setting_type?: string }>
): number {
  if (!Array.isArray(diamonds)) return 0;
  return diamonds.reduce((sum, d) => {
    const weight = parseFloat(String(d.weight || 0)) || 0;
    // `d.pieces || 1` treated an explicit 0 as 1, adding a phantom stone's seat
    // volume. Only fall back when the value is genuinely absent.
    const rawPieces = d.pieces === undefined || d.pieces === null || d.pieces === '' ? 1 : d.pieces;
    const pieces = Math.max(parseInt(String(rawPieces), 10) || 0, 0);
    const setting = d.setting_type || 'prong';
    const factor = SETTING_FACTORS[setting] ?? 0.25;

    // Total weight for this row = weight per piece * pieces
    const totalCarats = weight * pieces;
    const rowVolume = getStoneVolume(totalCarats) * factor;
    return sum + rowVolume;
  }, 0);
}

/**
 * Calculates net metal volume in cm3.
 */
export function getNetVolume(
  grossVolume: number,
  stoneSeatVolume: number,
  hollowVolume: number,
  galleryCutVolume: number
): number {
  const gV = Number(grossVolume) || 0;
  const sV = Number(stoneSeatVolume) || 0;
  const hV = Number(hollowVolume) || 0;
  const gcV = Number(galleryCutVolume) || 0;
  return Math.max(0, gV - sV - hV - gcV);
}

/**
 * Derives ring or bangle circumference in mm.
 */
export function getCircumferenceForSize(size: string | number, category: string): number {
  const cat = String(category || '').toLowerCase();
  const num = parseFloat(String(size)) || 0;
  if (num <= 0) return 0;

  if (cat.includes('ring')) {
    // Standard Indian ring size diameter = 12.6 + size * 0.33 mm
    const diameter = 12.6 + num * 0.33;
    return diameter * Math.PI;
  }

  if (cat.includes('bangle') || cat.includes('bracelet')) {
    // Bangle size format is usually inches.annas (e.g. 2.2, 2.4, 2.6, 2.8)
    // 2.2 = 2 + 2/16 inches = 2.125 inches
    // 2.4 = 2 + 4/16 inches = 2.25 inches
    // 2.6 = 2 + 6/16 inches = 2.375 inches
    // 2.8 = 2 + 8/16 inches = 2.5 inches
    let diameterInches = num;
    const sizeStr = String(size);
    if (sizeStr.includes('.')) {
      const parts = sizeStr.split('.');
      const inches = parseInt(parts[0], 10) || 2;
      const annas = parseInt(parts[1], 10) || 0;
      diameterInches = inches + annas / 16;
    }
    const diameterMm = diameterInches * 25.4;
    return diameterMm * Math.PI;
  }

  return 0;
}

/**
 * Scales base weight to target size circumference ratio.
 */
export function scaleWeightBySize(
  baseWeight: number,
  baseSize: string | number,
  newSize: string | number,
  category: string
): number {
  if (!baseWeight || baseWeight <= 0 || !newSize) return baseWeight;
  const cat = String(category || '').toLowerCase();
  const isRing = cat.includes('ring');
  const isBangle = cat.includes('bangle') || cat.includes('bracelet');

  if (!isRing && !isBangle) return baseWeight;

  const defaultBase = isRing ? 12 : '2.4';
  const bSize = baseSize || defaultBase;

  const newC = getCircumferenceForSize(newSize, cat);
  const baseC = getCircumferenceForSize(bSize, cat);

  if (newC > 0 && baseC > 0) {
    return (baseWeight * newC) / baseC;
  }

  return baseWeight;
}
