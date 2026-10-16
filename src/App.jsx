import { useEffect, useState } from 'react';
import AstronautParticles from './scene/AstronautParticles.jsx';
import Background from './scene/Background.jsx';
import Gate from './sections/Gate.jsx';
import { age, setAge } from './engine/age.js';
import { STOPS } from './engine/palette.js';

/* OKLab interpolation helpers */
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

function rgbToOklab(r, g, b) {
  const lr = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  const lg = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  const lb = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  ];
}

function oklabToRgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  const lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  const gamma = (c) => (c > 0.0031308 ? 1.055 * Math.pow(Math.max(0, c), 1 / 2.4) - 0.055 : 12.92 * Math.max(0, c));
  return [
    Math.min(1, Math.max(0, gamma(lr))),
    Math.min(1, Math.max(0, gamma(lg))),
    Math.min(1, Math.max(0, gamma(lb)))
  ];
}

const OK_STOPS = STOPS.map((s) => ({
  at: s.at,
  bg: rgbToOklab(...hexToRgb(s.bg)),
  particle: rgbToOklab(...hexToRgb(s.particle))
}));

function getPaletteAtAge(ageVal) {
  const a = Math.max(0, Math.min(1, ageVal));
  let i = 0;
  while (i < OK_STOPS.length - 1 && OK_STOPS[i + 1].at < a) {
    i++;
  }
  const s0 = OK_STOPS[i];
  const s1 = OK_STOPS[Math.min(i + 1, OK_STOPS.length - 1)];
  const range = s1.at - s0.at;
  const t = range > 0.0001 ? (a - s0.at) / range : 0;

  const bgOk = [
    s0.bg[0] + (s1.bg[0] - s0.bg[0]) * t,
    s0.bg[1] + (s1.bg[1] - s0.bg[1]) * t,
    s0.bg[2] + (s1.bg[2] - s0.bg[2]) * t
  ];
  const particleOk = [
    s0.particle[0] + (s1.particle[0] - s0.particle[0]) * t,
    s0.particle[1] + (s1.particle[1] - s0.particle[1]) * t,
    s0.particle[2] + (s1.particle[2] - s0.particle[2]) * t
  ];

  const bgRgb = oklabToRgb(...bgOk);
  const particleRgb = oklabToRgb(...particleOk);

  return {
    bgCss: `rgb(${Math.round(bgRgb[0] * 255)}, ${Math.round(bgRgb[1] * 255)}, ${Math.round(bgRgb[2] * 255)})`,
    particleCss: `rgb(${Math.round(particleRgb[0] * 255)}, ${Math.round(particleRgb[1] * 255)}, ${Math.round(particleRgb[2] * 255)})`
  };
}

export default function App() {
  const [entered, setEntered] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentAge, setCurrentAge] = useState(age.value);

  // Synchronize particle color via OKLab (page background handled by Background shader)
  useEffect(() => {
    const pal = getPaletteAtAge(currentAge);
    document.documentElement.style.setProperty('--page-bg', 'transparent');
    document.documentElement.style.setProperty('--particle-color', pal.particleCss);
  }, [currentAge]);

  const handleAgeChange = (e) => {
    const val = parseFloat(e.target.value);
    setAge(val);
    setCurrentAge(val);
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden text-[var(--particle-color)]">
      {/* Fullscreen background atmosphere shader */}
      <Background />

      {/* 3D particle astronaut */}
      <AstronautParticles hasEntered={entered} onReady={() => setIsReady(true)} />

      {/* Entry Gate - only starts animating once geometry is built and first frame rendered */}
      {!entered && isReady && <Gate onEnter={() => setEntered(true)} />}

      {/* Temporary HTML range slider (0 to 1) sets age */}
      <div className="absolute top-6 left-6 z-30 flex flex-col gap-1.5 p-3.5 rounded-none border border-[var(--particle-color)]/20 bg-black/40 backdrop-blur-md pointer-events-auto select-none transition-colors duration-200">
        <div className="flex items-center justify-between gap-6 text-[11px] font-mono tracking-wider uppercase opacity-85">
          <span>Age</span>
          <span className="font-semibold">{currentAge.toFixed(2)}</span>
        </div>
        <input
          id="age-slider"
          type="range"
          min="0"
          max="1"
          step="0.005"
          value={currentAge}
          onChange={handleAgeChange}
          className="w-48 h-1.5 cursor-pointer accent-[var(--particle-color)] bg-[var(--particle-color)]/20"
        />
        <div className="flex justify-between text-[9px] font-mono opacity-65">
          <span>0.0 child</span>
          <span>1.0 adult</span>
        </div>
      </div>

      {/* Credits line, always visible, tiny */}
      <div className="absolute bottom-4 right-5 z-20 text-[10px] font-mono tracking-wide opacity-50 pointer-events-none select-none">
        Astronaut by Poly by Google [CC-BY] via Poly Pizza
      </div>
    </main>
  );
}
