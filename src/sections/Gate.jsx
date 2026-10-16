import { useEffect, useState } from 'react';
import * as Tone from 'tone';
import { TextGenerateEffect } from '../components/library/text-generate-effect';

export default function Gate({ onEnter }) {
  const [showSubtitle, setShowSubtitle] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const [isGone, setIsGone] = useState(false);

  useEffect(() => {
    // "hello." blurs in over ~0.6s; reveal "press anywhere to begin" right after
    const timer = setTimeout(() => {
      setShowSubtitle(true);
    }, 700);

    return () => clearTimeout(timer);
  }, []);

  const handleClick = async () => {
    if (isFading || isGone) return;
    setIsFading(true);

    // Audio unlock stub
    try {
      await Tone.start();
    } catch {
      // Stub only: no sounds in Block 2
    }

    if (onEnter) {
      onEnter();
    }

    // Remove gate overlay once fade-out completes
    setTimeout(() => {
      setIsGone(true);
    }, 600);
  };

  if (isGone) return null;

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick();
        }
      }}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer select-none transition-opacity duration-600 ease-out ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="gate-text flex flex-col items-center justify-center text-center px-6 pointer-events-none">
        {/* Line 1: "hello." (large) */}
        <TextGenerateEffect
          words="hello."
          duration={0.6}
          filter={false}
          className="text-7xl md:text-9xl font-light tracking-tight"
        />

        {/* Line 2: "press anywhere to begin" (small, appears after line 1 finishes) */}
        <div className="h-10 mt-6 flex items-center justify-center">
          {showSubtitle && (
            <TextGenerateEffect
              words="press anywhere to begin"
              duration={0.35}
              filter={false}
              className="text-xs md:text-sm tracking-widest uppercase font-mono font-normal opacity-80"
            />
          )}
        </div>
      </div>
    </div>
  );
}
