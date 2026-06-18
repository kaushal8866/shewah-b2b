// Library for CAD gold weight alloy density calculations and ring/bangle size scaling.

export const ALLOY_DENSITY: Record<string, number> = {
  "24K": 19.32,
  "22KY": 17.40,
  "22KR": 17.10,
  "22KW": 17.00,
  "18KY": 15.60,
  "18KR": 15.20,
  "18KW": 15.00,
  "14KY": 13.00,
  "14KR": 12.70,
  "14KW": 12.50,
  "10KY": 11.90,
  "10KR": 11.60,
  "10KW": 11.40,
  // 9K fallback (mapped to 10K density)
  "9KY": 11.90,
  "9KR": 11.60,
  "9KW": 11.40
};

export const SETTING_FACTORS: Record<string, number> = {
  prong: 0.25,
  bezel: 0.60,
  pave: 0.18,
  channel: 0.22
};

export const FINISH_FACTOR = 0.817;

/**
 * Resolves alloy density in g/cm3 based on karat and metal tone.
 */
export function getAlloyDensity(karat: string | number, tone: string): number {
  const kStr = String(karat).toUpperCase().replace(/[^\d\w]/g, ''); // e.g. "18K" -> "18"
  if (kStr === '24' || kStr === '24K') return 19.32;
  if (kStr.includes('SILVER')) return 10.49;

  let tChar = 'Y'; // default yellow
  if (tone) {
    const tLower = tone.toLowerCase();
    if (tLower.includes('rose') || tLower === 'r') tChar = 'R';
    else if (tLower.includes('white') || tLower === 'w') tChar = 'W';
  }

  const numericKarat = parseInt(kStr, 10);
  if (isNaN(numericKarat)) return 15.00; // fallback default (approx 18K white)

  const key = `${numericKarat}K${tChar}`;
  return ALLOY_DENSITY[key] || ALLOY_DENSITY[`${numericKarat}KY`] || 15.00;
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
    const pieces = parseInt(String(d.pieces || 1), 10) || 1;
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
