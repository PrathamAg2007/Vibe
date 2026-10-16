/* OKLCH Algorithmic Palette Generator & Color Lock
 * Implements smooth OKLCH rules as mathematical functions of age.
 * No hardcoded hex list.
 */

function rgbToHex(r, g, b) {
  const toHex = (n) => {
    const s = Math.max(0, Math.min(255, n)).toString(16);
    return s.length === 1 ? '0' + s : s;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function oklchToRgb(L, C, H) {
  const rad = (H * Math.PI) / 180;
  const ok_a = C * Math.cos(rad);
  const ok_b = C * Math.sin(rad);

  const l_ = L + 0.3963377774 * ok_a + 0.2158037573 * ok_b;
  const m_ = L - 0.1055613458 * ok_a - 0.0638541728 * ok_b;
  const s_ = L - 0.0894841775 * ok_a - 1.2914855480 * ok_b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  // Gamut clamping on linear sRGB
  const rLin = Math.min(1, Math.max(0, lr));
  const gLin = Math.min(1, Math.max(0, lg));
  const bLin = Math.min(1, Math.max(0, lb));

  // Gamma correction to sRGB
  const gamma = (c) => (c > 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : 12.92 * c);
  const r = Math.min(1, Math.max(0, gamma(rLin)));
  const g = Math.min(1, Math.max(0, gamma(gLin)));
  const b = Math.min(1, Math.max(0, gamma(bLin)));

  const r255 = Math.round(r * 255);
  const g255 = Math.round(g * 255);
  const b255 = Math.round(b * 255);
  const lum = 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;

  return {
    r,
    g,
    b,
    rLin,
    gLin,
    bLin,
    r255,
    g255,
    b255,
    rgb: [r, g, b],
    rgb255: [r255, g255, b255],
    rgbStr: `rgb(${r255}, ${g255}, ${b255})`,
    hex: rgbToHex(r255, g255, b255),
    oklab: [L, ok_a, ok_b],
    oklch: [L, C, H],
    lum
  };
}

export function getHue(ageVal) {
  const a = Math.max(0, Math.min(1, Number(ageVal) || 0));
  if (a <= 0.30) {
    const t = a / 0.30;
    return 32 + t * (38 - 32);
  }
  if (a <= 0.46) {
    const u = (a - 0.30) / 0.16;
    const e = u * u * (3 - 2 * u);
    return 38 + e * (190 - 38);
  }
  if (a <= 0.75) {
    const u = (a - 0.46) / 0.29;
    const e = u * u * (3 - 2 * u);
    return 190 + e * (235 - 190);
  }
  const u = (a - 0.75) / 0.25;
  const e = u * u * (3 - 2 * u);
  return 235 + e * (240 - 235);
}

export function getChroma(ageVal) {
  const a = Math.max(0, Math.min(1, Number(ageVal) || 0));
  if (a <= 0.46) {
    const u = a / 0.46;
    const e = u * u * (3 - 2 * u);
    return 0.19 - 0.02 * e;
  }
  if (a <= 0.75) {
    const u = (a - 0.46) / 0.29;
    const e = u * u * (3 - 2 * u);
    return 0.17 - 0.125 * e;
  }
  const u = (a - 0.75) / 0.25;
  const e = u * u * (3 - 2 * u);
  return 0.045 - 0.015 * e;
}

function solveLightnessForContrast(C, H, bgLum, targetContrast, minLightness = 0.80) {
  const targetLum = targetContrast * (bgLum + 0.05) - 0.05;
  let low = minLightness;
  let high = 0.98;
  let best = Math.max(minLightness, 0.90);

  for (let i = 0; i < 14; i++) {
    const mid = (low + high) * 0.5;
    const { lum } = oklchToRgb(mid, C, H);
    if (lum >= targetLum) {
      best = mid;
      high = mid;
    } else {
      low = mid;
    }
  }
  return Math.max(minLightness, best);
}

export function getPalette(ageVal) {
  const age = Math.max(0, Math.min(1, Number(ageVal) || 0));
  const hue = getHue(age);
  const chroma = getChroma(age);

  // 1. bg: L 0.17 to 0.20, chroma c*0.30, hue h
  const bgL = 0.17 + 0.03 * age;
  const bgC = chroma * 0.30;
  const bg = oklchToRgb(bgL, bgC, hue);

  // 2. fog: L 0.62, chroma c, hue h
  const fog = oklchToRgb(0.62, chroma, hue);

  // 3. fog2: L 0.78, chroma c*0.85, hue h+25
  const fog2 = oklchToRgb(0.78, chroma * 0.85, (hue + 25) % 360);

  // 4. particle: hue h-10, chroma c*0.2, lightness solved so contrast against bg is at least 7:1
  const partH = (hue - 10 + 360) % 360;
  const partC = chroma * 0.2;
  const partL = solveLightnessForContrast(partC, partH, bg.lum, 7.0, 0.88);
  const particle = oklchToRgb(partL, partC, partH);

  // 5. accent: L 0.78, chroma 0.17, hue h+30
  const accent = oklchToRgb(0.78, 0.17, (hue + 30) % 360);

  // 6. text: contrast guard (at least 4.5:1 vs bg) by adjusting lightness
  const textH = hue;
  const textC = chroma * 0.15;
  const textL = solveLightnessForContrast(textC, textH, bg.lum, 4.5, 0.78);
  const text = oklchToRgb(textL, textC, textH);

  // 7. ember: hue 55, chroma 0.19, L 0.78, available only when age >= 0.95
  let ember = null;
  if (age >= 0.95) {
    ember = oklchToRgb(0.78, 0.19, 55);
  }

  return {
    age,
    hue,
    chroma,
    bg,
    fog,
    fog2,
    particle,
    accent,
    text,
    ember
  };
}

// Backward-compatible STOPS array generated from the OKLCH engine (no hardcoded hex list)
export const STOPS = [0.0, 0.30, 0.46, 0.75, 1.0].map((at) => {
  const p = getPalette(at);
  return {
    at,
    bg: p.bg.hex,
    fog: p.fog.hex,
    fog2: p.fog2.hex,
    particle: p.particle.hex,
    accent: p.accent.hex
  };
});