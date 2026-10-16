import { useEffect, useRef } from 'react';
import { age } from '../engine/age.js';
import { createObjectsEngine } from '../engine/objects.js';
import { registerObjectHandler, unregisterObjectHandler } from '../engine/input.js';
import { getLevel } from '../engine/audio.js';

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

    const ctx = canvas.getContext('2d');
    const origClearRect = ctx.clearRect.bind(ctx);
    const origSetTransform = ctx.setTransform.bind(ctx);

    let objectIndex = 0;

    ctx.clearRect = function (x, y, w, h) {
      objectIndex = 0;
      return origClearRect(x, y, w, h);
    };

    ctx.setTransform = function (a, b, c, d, e, f) {
      // Scale body drawings by 1 + 0.04*level with a tiny phase offset per object
      if (arguments.length === 6 && (e !== 0 || f !== 0) && (b !== 0 || c !== 0 || a !== dpr || d !== dpr)) {
        const level = getLevel();
        if (level > 0.001) {
          const timeSec = performance.now() * 0.001;
          const phase = objectIndex * 0.85;
          const wave = 0.65 + 0.35 * Math.cos(timeSec * 7.5 + phase);
          const pulse = 1 + 0.04 * level * wave;
          objectIndex++;
          return origSetTransform(a * pulse, b * pulse, c * pulse, d * pulse, e, f);
        }
        objectIndex++;
      }
      return origSetTransform(a, b, c, d, e, f);
    };

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

    const animate = (time) => {
      rafId = requestAnimationFrame(animate);

      // Pause drawing and physics when document is hidden
      if (document.hidden) {
        lastTime = time;
        return;
      }

      const dt = Math.min((time - lastTime) * 0.001, 0.1);
      lastTime = time;

      engineManager.updateAndRender(dt, age.value, time, activeRef.current);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', handleResize);
      unregisterObjectHandler();
      ctx.clearRect = origClearRect;
      ctx.setTransform = origSetTransform;
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
