import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import AstronautParticles from './scene/AstronautParticles.jsx';
import Background from './scene/Background.jsx';
import Gate from './sections/Gate.jsx';
import { initScroll, destroyScroll, unlockScroll } from './engine/scroll.js';
import { getPalette } from './engine/palette.js';
import { age } from './engine/age.js';
import { initAudio, setAudioAge, setMuted, isMuted, onTap } from './engine/audio.js';
import Objects from './layers/Objects.jsx';

export default function App() {
  const [entered, setEntered] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [muted, setMutedState] = useState(() => isMuted());
  const spacerRef = useRef(null);
  const ageCounterRef = useRef(null);
  const oklchReadoutRef = useRef(null);
  const dragStartRef = useRef(null);

  // Wire tap listener from audio engine
  useEffect(() => {
    const unsub = onTap((xNorm, yNorm, currentAge) => {
      // Tap received through input.js astronaut owner check
    });
    return () => {
      unsub();
    };
  }, []);

  // Set initial palette CSS variables on mount
  useEffect(() => {
    const p = getPalette(0);
    document.documentElement.style.setProperty('--page-bg', 'transparent');
    document.documentElement.style.setProperty('--particle-color', p.particle.hex);
  }, []);

  // Initialize Lenis + GSAP ScrollTrigger
  useEffect(() => {
    initScroll(spacerRef.current, ageCounterRef.current);
    return () => {
      destroyScroll();
    };
  }, []);

  // Ticker loop: update audio age, OKLCH readout text via ref, and live palette CSS var
  useEffect(() => {
    let lastAudioAge = -1;
    let lastHue = -1;
    let lastParticleHex = '';
    const onTick = () => {
      const current = age.value;
      if (Math.abs(current - lastAudioAge) > 0.003) {
        lastAudioAge = current;
        setAudioAge(current);
      }
      const p = getPalette(current);
      const roundedHue = Math.round(p.hue);
      if (roundedHue !== lastHue && oklchReadoutRef.current) {
        lastHue = roundedHue;
        oklchReadoutRef.current.textContent = `oklch lock on / h ${roundedHue}`;
      }
      if (p.particle.hex !== lastParticleHex) {
        lastParticleHex = p.particle.hex;
        document.documentElement.style.setProperty('--particle-color', p.particle.hex);
      }
    };
    gsap.ticker.add(onTick);
    return () => {
      gsap.ticker.remove(onTick);
    };
  }, []);

  const handleToggleMute = (e) => {
    e.stopPropagation();
    const next = !muted;
    setMutedState(next);
    setMuted(next);
  };

  const handleEnter = useCallback(() => {
    setEntered(true);
    initAudio().catch(() => {});
    // Assemble animation is ~2.5s. Unlock scroll after assemble finishes.
    setTimeout(() => {
      unlockScroll();
    }, 2500);
  }, []);

  const handleReady = useCallback(() => {
    setIsReady(true);
  }, []);

  const handlePointerDown = (e) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleCanvasClick = (e) => {
    if (entered) return;
    if (dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.hypot(dx, dy) > 8) {
        // Drag rotation performed, do not trigger gate entry
        return;
      }
    }
    // Clean click: trigger Gate entry
    const gateBtn = document.querySelector('[role="button"]');
    if (gateBtn) {
      gateBtn.click();
    } else {
      handleEnter();
    }
  };

  return (
    <main className="relative w-full min-h-screen text-[var(--particle-color)]">
      {/* Pinned background shader */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <Background />
      </div>

      {/* Pinned 3D particle canvas - receives pointer events */}
      <div
        className="fixed inset-0 z-10 pointer-events-auto"
        onPointerDown={handlePointerDown}
        onClick={handleCanvasClick}
      >
        <AstronautParticles hasEntered={entered} onReady={handleReady} />
      </div>

      {/* 2D physics object layer drawn over 3D canvas */}
      <Objects active={entered} />

      {/* Entry Gate overlay - pointer-events: none so dragging passes to canvas */}
      {!entered && isReady && (
        <div className="fixed inset-0 z-30 pointer-events-none gate-wrapper">
          <Gate onEnter={handleEnter} />
        </div>
      )}

      {/* OKLCH lock readout in IBM Plex Mono 11px */}
      <div
        ref={oklchReadoutRef}
        id="oklch-readout"
        className="fixed bottom-10 left-6 z-20 font-mono text-[11px] tracking-wider select-none text-[var(--particle-color)] opacity-70 pointer-events-none"
      >
        oklch lock on / h 32
      </div>

      {/* Small age counter and mute toggle in bottom corner */}
      <div className="fixed bottom-4 left-6 z-20 flex items-center gap-4 font-mono text-xs tracking-wider select-none text-[var(--particle-color)] pointer-events-none">
        <span
          ref={ageCounterRef}
          id="age-counter"
          className="tabular-nums opacity-60"
        >
          0 yrs
        </span>
        <button
          type="button"
          id="mute-toggle"
          onClick={handleToggleMute}
          className="pointer-events-auto opacity-60 hover:opacity-100 transition-opacity duration-200 cursor-pointer bg-transparent border-none p-0 text-inherit font-inherit font-mono text-xs tracking-wider"
          aria-label={muted ? 'Unmute audio' : 'Mute audio'}
        >
          {muted ? 'sound off' : 'sound on'}
        </button>
      </div>

      {/* Credits line, always visible, tiny */}
      <div className="fixed bottom-4 right-5 z-20 text-[10px] font-mono tracking-wide opacity-50 pointer-events-none select-none">
        Astronaut by Poly by Google [CC-BY] via Poly Pizza
      </div>

      {/* Tall spacer div of 400vh driving scroll progress */}
      <div
        ref={spacerRef}
        id="scroll-spacer"
        className="w-full h-[400vh] pointer-events-none"
        style={{ height: '400vh' }}
        aria-hidden="true"
      />
    </main>
  );
}
