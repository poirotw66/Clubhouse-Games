import type { Color } from '../types';

/**
 * Optical and chromatic physics helper utilities.
 * Estimates wavelength, color temperature, and color harmonies.
 */

export interface ColorTelemetry {
  hex: string;
  rgb: { r: number; g: number; b: number };
  wavelengthNm: number;
  colorTempKelvin: number;
  rank: { title: string; tier: string; badge: string };
  harmonyDelta: {
    complementary: number;
    triadic: [number, number];
    analogous: [number, number];
  };
}

/**
 * Convert HSL to RGB [0-255].
 */
export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number; hex: string } {
  const normH = (((h % 360) + 360) % 360) / 360;
  const normS = Math.max(0, Math.min(100, s)) / 100;
  const normL = Math.max(0, Math.min(100, l)) / 100;

  let r: number, g: number, b: number;

  if (normS === 0) {
    r = g = b = normL;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      let tNorm = t;
      if (tNorm < 0) tNorm += 1;
      if (tNorm > 1) tNorm -= 1;
      if (tNorm < 1 / 6) return p + (q - p) * 6 * tNorm;
      if (tNorm < 1 / 2) return q;
      if (tNorm < 2 / 3) return p + (q - p) * (2 / 3 - tNorm) * 6;
      return p;
    };

    const q = normL < 0.5 ? normL * (1 + normS) : normL + normS - normL * normS;
    const p = 2 * normL - q;
    r = hue2rgb(p, q, normH + 1 / 3);
    g = hue2rgb(p, q, normH);
    b = hue2rgb(p, q, normH - 1 / 3);
  }

  const r255 = Math.round(r * 255);
  const g255 = Math.round(g * 255);
  const b255 = Math.round(b * 255);
  const hex = `#${((1 << 24) + (r255 << 16) + (g255 << 8) + b255).toString(16).slice(1).toUpperCase()}`;

  return { r: r255, g: g255, b: b255, hex };
}

/**
 * Estimate dominant optical wavelength (in nanometers, 380nm - 700nm).
 * Visible spectrum mapping from hue angle:
 * - Red (0° / 360°): ~650nm - 700nm
 * - Yellow (60°): ~580nm
 * - Green (120°): ~535nm
 * - Cyan (180°): ~495nm
 * - Blue (240°): ~450nm
 * - Violet / Magenta (300°): ~400nm
 */
export function estimateWavelengthNm(hue: number): number {
  const h = (((hue % 360) + 360) % 360);
  if (h <= 60) {
    // Red (650nm) to Yellow (580nm)
    return Math.round(650 - (h / 60) * 70);
  }
  if (h <= 120) {
    // Yellow (580nm) to Green (535nm)
    return Math.round(580 - ((h - 60) / 60) * 45);
  }
  if (h <= 180) {
    // Green (535nm) to Cyan (495nm)
    return Math.round(535 - ((h - 120) / 60) * 40);
  }
  if (h <= 240) {
    // Cyan (495nm) to Blue (450nm)
    return Math.round(495 - ((h - 180) / 60) * 45);
  }
  if (h <= 300) {
    // Blue (450nm) to Violet (400nm)
    return Math.round(450 - ((h - 240) / 60) * 50);
  }
  // Violet (400nm) back to Deep Red (650nm)
  return Math.round(400 + ((h - 300) / 60) * 250);
}

/**
 * Estimate correlated color temperature (Kelvin, 1800K - 12000K).
 */
export function estimateColorTemperatureK(hue: number): number {
  const h = (((hue % 360) + 360) % 360);
  // Warm hues (0°-60°): 1800K - 3200K (Candlelight to Incandescent)
  if (h <= 60) return Math.round(1800 + (h / 60) * 1400);
  // Yellow to Warm Daylight (60°-120°): 3200K - 5000K
  if (h <= 120) return Math.round(3200 + ((h - 60) / 60) * 1800);
  // Daylight to Cyan (120°-180°): 5000K - 6800K
  if (h <= 180) return Math.round(5000 + ((h - 120) / 60) * 1800);
  // Cool Sky Blue (180°-240°): 6800K - 9500K
  if (h <= 240) return Math.round(6800 + ((h - 180) / 60) * 2700);
  // Deep Night Sky / Violet (240°-300°): 9500K - 12000K
  if (h <= 300) return Math.round(9500 + ((h - 240) / 60) * 2500);
  // Magenta back to Candlelight (300°-360°): 12000K to 1800K
  return Math.round(12000 - ((h - 300) / 60) * 10200);
}

/**
 * Compute chromatic rank based on player score & performance.
 */
export function getChromaRank(score: number, streak: number = 0): { title: string; tier: string; badge: string } {
  if (score >= 950 || streak >= 10) {
    return { title: '光譜至尊', tier: '奇點階', badge: '◆◆◆' };
  }
  if (score >= 880 || streak >= 7) {
    return { title: '稜鏡指揮官', tier: '超導階', badge: '◆◆◇' };
  }
  if (score >= 780 || streak >= 4) {
    return { title: '波長調諧師', tier: '共振階', badge: '◆◇◇' };
  }
  if (score >= 650 || streak >= 2) {
    return { title: '光學航行者', tier: '常態階', badge: '◇◇◇' };
  }
  if (score >= 500) {
    return { title: '色感研發員', tier: '基底階', badge: '○' };
  }
  return { title: '光譜初生體', tier: '啟動階', badge: '·' };
}

/**
 * Assemble comprehensive real-time telemetry from color.
 */
export function computeTelemetry(color: Color, score: number = 0, streak: number = 0): ColorTelemetry {
  const { r, g, b, hex } = hslToRgb(color.h, color.s, color.l);
  const wavelengthNm = estimateWavelengthNm(color.h);
  const colorTempKelvin = estimateColorTemperatureK(color.h);
  const rank = getChromaRank(score, streak);

  const compH = (color.h + 180) % 360;
  const tri1 = (color.h + 120) % 360;
  const tri2 = (color.h + 240) % 360;
  const ana1 = (color.h + 30) % 360;
  const ana2 = (color.h + 330) % 360;

  return {
    hex,
    rgb: { r, g, b },
    wavelengthNm,
    colorTempKelvin,
    rank,
    harmonyDelta: {
      complementary: compH,
      triadic: [tri1, tri2],
      analogous: [ana1, ana2],
    },
  };
}
