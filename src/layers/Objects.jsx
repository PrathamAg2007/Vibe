import { useEffect, useRef } from 'react';
import { age } from '../engine/age.js';
import { createObjectsEngine } from '../engine/objects.js';
import { registerObjectHandler, unregisterObjectHandler } from '../engine/input.js';

export default function Objects({ active = false }) {
  const canvasRef = useRef(null);
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const engineManager = createObjectsEngine(canvas, width, height);
    registerObjectHandler(engineManager);

    let rafId = null;
    let lastTime = performance.now();

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      engineManager.resize(width, height);
    };

    window.addEventListener('resize', handleResize, { passive: true });

    // Listen for devicePixelRatio changes (e.g. browser zoom)
    let dprMatch = window.matchMedia ? window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`) : null;
    const handleDprChange = () => {
      handleResize();
      if (window.matchMedia) {
        if (dprMatch && dprMatch.removeEventListener) {
          dprMatch.removeEventListener('change', handleDprChange);
        }
        dprMatch = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
        if (dprMatch && dprMatch.addEventListener) {
          dprMatch.addEventListener('change', handleDprChange);
        }
      }
    };
    if (dprMatch && dprMatch.addEventListener) {
      dprMatch.addEventListener('change', handleDprChange);
    }

    const animate = (time) => {
      rafId = requestAnimationFrame(animate);

      // Pause drawing and physics when document is hidden
      if (document.hidden) {
        lastTime = time;
        return;
      }

      const dt = Math.min((time - lastTime) * 0.001, 0.050);
      lastTime = time;

      engineManager.updateAndRender(dt, age.value, time, activeRef.current);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (dprMatch && dprMatch.removeEventListener) {
        dprMatch.removeEventListener('change', handleDprChange);
      }
      unregisterObjectHandler();
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      engineManager.destroy();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-15 pointer-events-none w-full h-full"
      style={{ pointerEvents: 'none' }}
      aria-hidden="true"
    />
  );
}
