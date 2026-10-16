import Matter from 'matter-js';
import { getPalette } from './palette.js';
import { getLenis } from './scroll.js';

const { Bodies, Body, Composite } = Matter;

export const STAGE_LABELS = {
  child: 'Everything floats. Nothing has weight yet, and nothing stays down.',
  teen: 'Things get heavier. Gravity starts to notice you.',
  adult: 'Everything falls. What you carry now piles up.'
};

// Natural 2-line word groupings for each stage label
export const LABEL_LINES = {
  child: [
    ['Everything', 'floats.', 'Nothing', 'has', 'weight'],
    ['yet,', 'and', 'nothing', 'stays', 'down.']
  ],
  teen: [
    ['Things', 'get', 'heavier.'],
    ['Gravity', 'starts', 'to', 'notice', 'you.']
  ],
  adult: [
    ['Everything', 'falls.'],
    ['What', 'you', 'carry', 'now', 'piles', 'up.']
  ]
};

function smoothstep(min, max, value) {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// Layout function of age: gives label block position, rotation, and word spacing
// Child: top-left, loose, words slightly rotated (+-3 deg)
// Teen: left-middle, aligned and level
// Adult: bottom-left, tight and heavy
export function getMorphingLayout(a, width, height) {
  const ageVal = Math.max(0, Math.min(1, a));

  const t1 = smoothstep(0.32, 0.44, ageVal);
  const t2 = smoothstep(0.68, 0.78, ageVal);

  const yChild = height * 0.16;
  const yTeen = height * 0.46;
  const yAdult = height * 0.72;
  const blockY = lerp(lerp(yChild, yTeen, t1), yAdult, t2);

  const blockX = Math.max(32, width * 0.05);

  const wordSpacingMult = lerp(lerp(1.25, 1.0, t1), 0.85, t2);
  const lineSpacingMult = lerp(lerp(1.35, 1.20, t1), 1.05, t2);
  const blockRotation = lerp(lerp(-0.025, 0.0, t1), 0.0, t2);
  const wordRotSpread = lerp(lerp(0.052, 0.0, t1), 0.0, t2);

  // Utility DOM UI transforms
  // In Adult: resting at bottom (0px offset, 0deg)
  // In Teen: resting at middle (-28vh offset, 0deg)
  // In Child: resting near top (-68vh offset, -2.5deg tilt)
  const uiYChild = -height * 0.68;
  const uiYTeen = -height * 0.28;
  const uiYAdult = 0;
  const uiYOffset = lerp(lerp(uiYChild, uiYTeen, t1), uiYAdult, t2);
  const uiRotation = lerp(lerp(-2.5, 0, t1), 0, t2);
  const creditsRotation = lerp(lerp(2.0, 0, t1), 0, t2);

  return {
    blockX,
    blockY,
    wordSpacingMult,
    lineSpacingMult,
    blockRotation,
    wordRotSpread,
    uiYOffset,
    uiRotation,
    creditsRotation
  };
}

// Unified font string helper
export function labelFont(sizePx) {
  return `800 ${sizePx}px Syne, sans-serif`;
}

let fontsLoadPromise = null;
export function ensureFontsReady(testSize = 32) {
  if (typeof document === 'undefined' || !document.fonts) {
    return Promise.resolve();
  }
  if (!fontsLoadPromise) {
    fontsLoadPromise = Promise.all([
      document.fonts.load(labelFont(testSize)),
      document.fonts.ready
    ]).catch((err) => {
      console.warn('Font loading check error:', err);
    });
  }
  return fontsLoadPromise;
}

export function getFontSize(w, h) {
  const maxLineWidth = w * 0.38;
  const baseSize = Math.max(20, Math.round(36 * (h / 1080)));
  // Longest label line ("Everything floats. Nothing has weight") fits cleanly in maxLineWidth
  const fitSize = Math.floor(maxLineWidth / 21.5);
  return Math.max(16, Math.min(baseSize, fitSize));
}

export function createLabelsManager(engine, canvas, initialWidth, initialHeight) {
  const ctx = canvas.getContext('2d');
  let width = initialWidth;
  let height = initialHeight;

  let fontsReady = false;

  ensureFontsReady(32).then(() => {
    fontsReady = true;
    remeasureAndRebuild();
  });

  // All word bodies across stages
  const stageWords = {
    child: [],
    teen: [],
    adult: []
  };

  // State per stage
  const stageStates = {
    child: {
      fadeTime: 0,
      alpha: 0,
      shattered: false,
      shatterTimer: 0,
      reassembling: false,
      reassembleTimer: 0
    },
    teen: {
      fadeTime: 0,
      alpha: 0,
      shattered: false,
      shatterTimer: 0,
      reassembling: false,
      reassembleTimer: 0
    },
    adult: {
      fadeTime: 0,
      alpha: 0,
      shattered: false,
      shatterTimer: 0,
      reassembling: false,
      reassembleTimer: 0
    }
  };

  let lowVelocityDuration = 0;
  let isVelocityShattered = false;
  let velocityShatteredStage = null;

  function remeasureAndRebuild() {
    if (!fontsReady) return;

    // Remove existing word bodies from engine
    ['child', 'teen', 'adult'].forEach((st) => {
      stageWords[st].forEach((wb) => {
        Composite.remove(engine.world, wb.body);
      });
      stageWords[st].length = 0;
    });

    const fontSize = getFontSize(width, height);
    const fontStr = labelFont(fontSize);

    // Set font right before measure
    ctx.font = fontStr;
    ctx.textBaseline = 'alphabetic';
    if ('letterSpacing' in ctx) {
      ctx.letterSpacing = '0px';
    }

    const stages = ['child', 'teen', 'adult'];
    stages.forEach((st) => {
      const rawLines = LABEL_LINES[st];
      let wordCounter = 0;

      rawLines.forEach((lineWords, lineIdx) => {
        lineWords.forEach((wordText, wordIdx) => {
          // Set font and baseline right before each measureText call
          ctx.font = fontStr;
          ctx.textBaseline = 'alphabetic';
          if ('letterSpacing' in ctx) {
            ctx.letterSpacing = '0px';
          }

          const metrics = ctx.measureText(wordText);
          const w = Math.ceil(metrics.width);
          // Body width = measured word width plus a 4 px margin, body height = font size * 0.9
          const bodyWidth = w + 4;
          const bodyHeight = fontSize * 0.9;

          const body = Bodies.rectangle(width * 0.1, height * 0.3, bodyWidth, bodyHeight, {
            frictionAir: 0.035,
            restitution: 0.25,
            friction: 0.6,
            density: 0.001,
            collisionFilter: {
              category: 0x0000,
              mask: 0x0000,
              group: -1
            }
          });

          const wordObj = {
            body,
            stage: st,
            wordIndex: wordCounter++,
            lineIndex: lineIdx,
            wordInLineIndex: wordIdx,
            text: wordText,
            width: w,
            bodyWidth,
            bodyHeight,
            renderScale: 1.0,
            hx: width * 0.1,
            hy: height * 0.3,
            hRot: 0,
            startX: width * 0.1,
            startY: height * 0.3,
            startRot: 0,
            alpha: 0,
            fadeTime: 0,
            wobbleActive: false,
            wobbleTime: 0,
            wobbleDir: 1,
            wobbleScale: 0,
            wobbleRot: 0
          };

          body.plugin = {
            isWord: true,
            wordObj,
            drawnRadius: Math.hypot(bodyWidth, bodyHeight) * 0.5
          };

          stageWords[st].push(wordObj);
          Composite.add(engine.world, body);
        });
      });
    });
  }

  function resize(newW, newH) {
    width = newW;
    height = newH;
    remeasureAndRebuild();
  }

  function triggerShatter(st) {
    const state = stageStates[st];
    if (state.shattered) return;
    state.shattered = true;
    state.reassembling = false;
    state.shatterTimer = 0;

    const words = stageWords[st];
    words.forEach((w) => {
      const b = w.body;
      const fx = (Math.random() - 0.5) * 0.006 * b.mass;
      const fy = (-0.004 - Math.random() * 0.006) * b.mass;
      Body.applyForce(b, b.position, { x: fx, y: fy });
      Body.setAngularVelocity(b, (Math.random() - 0.5) * 0.12);

      b.collisionFilter.category = 0x0008; // CAT_ADULT
      b.collisionFilter.mask = 0x0001 | 0x0002 | 0x0004 | 0x0008;
      b.collisionFilter.group = 0;
    });
  }

  function triggerReassembly(st) {
    const state = stageStates[st];
    if (!state.shattered && !state.reassembling) return;
    state.shattered = false;
    state.reassembling = true;
    state.reassembleTimer = 0;

    const words = stageWords[st];
    words.forEach((w) => {
      const b = w.body;
      w.startX = b.position.x;
      w.startY = b.position.y;
      w.startRot = b.angle;

      b.collisionFilter.category = 0x0000;
      b.collisionFilter.mask = 0x0000;
      b.collisionFilter.group = -1;
      Body.setVelocity(b, { x: 0, y: 0 });
      Body.setAngularVelocity(b, 0);
    });
  }

  function hitTestWord(px, py) {
    if (!fontsReady) return null;
    const stages = ['child', 'teen', 'adult'];
    for (let s = 0; s < stages.length; s++) {
      const st = stages[s];
      const words = stageWords[st];
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        if (w.alpha < 0.3) continue;
        const b = w.body;

        const dx = px - b.position.x;
        const dy = py - b.position.y;
        const cos = Math.cos(-b.angle);
        const sin = Math.sin(-b.angle);
        const localX = cos * dx - sin * dy;
        const localY = sin * dx + cos * dy;

        const hw = (w.bodyWidth / 2) + 2;
        const hh = (w.bodyHeight / 2) + 2;
        if (Math.abs(localX) <= hw && Math.abs(localY) <= hh) {
          return b;
        }
      }
    }
    return null;
  }

  function pokeWord(body) {
    if (!body || !body.plugin || !body.plugin.wordObj) return;
    const w = body.plugin.wordObj;

    const fx = (Math.random() - 0.5) * 0.007 * body.mass;
    const fy = -0.012 * body.mass;
    Body.applyForce(body, body.position, { x: fx, y: fy });
    Body.setAngularVelocity(body, body.angularVelocity + (Math.random() - 0.5) * 0.08);

    w.wobbleActive = true;
    w.wobbleTime = 0;
    w.wobbleDir = Math.random() < 0.5 ? 1 : -1;
    w.wobbleScale = 0.12;
    w.wobbleRot = w.wobbleDir * (8 * Math.PI / 180);
  }

  function hasShatteredWords() {
    return stageStates.child.shattered || stageStates.teen.shattered || stageStates.adult.shattered;
  }

  function updateAndRender(dt, currentAge, time, active, dpr) {
    if (!active || !fontsReady) {
      return;
    }

    const layout = getMorphingLayout(currentAge, width, height);
    const fontSize = getFontSize(width, height);
    const fontStr = labelFont(fontSize);

    // Set font right before measure
    ctx.font = fontStr;
    ctx.textBaseline = 'alphabetic';
    if ('letterSpacing' in ctx) {
      ctx.letterSpacing = '0px';
    }

    // Gap of 0.28em (measure a space with the same font)
    const spaceWidth = ctx.measureText(' ').width;
    const gap = Math.max(spaceWidth, 0.28 * fontSize);
    const lineHeight = 1.15 * fontSize;

    // 1. Determine active stage for labels
    let activeStage = 'child';
    if (currentAge >= 0.75) {
      activeStage = 'adult';
    } else if (currentAge >= 0.40) {
      activeStage = 'teen';
    }

    // 2. Compute home positions for all stages using layout algorithm
    ['child', 'teen', 'adult'].forEach((st) => {
      const rawLines = LABEL_LINES[st];
      const words = stageWords[st];
      if (!words || words.length === 0) return;

      let wordIdxCounter = 0;
      rawLines.forEach((lineWords, lineIdx) => {
        let currentX = layout.blockX;
        const currentY = layout.blockY + lineIdx * lineHeight;

        lineWords.forEach(() => {
          const wObj = words[wordIdxCounter++];
          if (!wObj) return;

          const w = wObj.width;
          const hx = currentX + w / 2;
          const hy = currentY;
          const hRot = layout.blockRotation + (st === 'child' ? layout.wordRotSpread * Math.sin(wObj.wordIndex * 2.2) : 0);

          wObj.hx = hx;
          wObj.hy = hy;
          wObj.hRot = hRot;
          wObj.renderScale = 1.0;

          currentX += w + gap;
        });
      });
    });

    // 3. Shatter triggers
    if (currentAge >= 0.75) {
      if (!stageStates.adult.shattered && !stageStates.adult.reassembling) {
        triggerShatter('adult');
      }
    } else if (currentAge < 0.72) {
      if (stageStates.adult.shattered) {
        triggerReassembly('adult');
      }
    }

    const lenis = getLenis();
    const vel = lenis ? Math.abs(lenis.velocity) : 0;
    if (vel > 3.8) {
      lowVelocityDuration = 0;
      if (!isVelocityShattered) {
        isVelocityShattered = true;
        velocityShatteredStage = activeStage;
        triggerShatter(activeStage);
      }
    } else if (vel <= 1.5) {
      lowVelocityDuration += dt;
      if (isVelocityShattered && lowVelocityDuration >= 1.2) {
        isVelocityShattered = false;
        if (velocityShatteredStage && (velocityShatteredStage !== 'adult' || currentAge < 0.75)) {
          triggerReassembly(velocityShatteredStage);
        }
        velocityShatteredStage = null;
      }
    }

    // 4. Update state & physics per word
    ['child', 'teen', 'adult'].forEach((st) => {
      const state = stageStates[st];
      const isTarget = (st === activeStage);
      const words = stageWords[st];

      if (state.shattered) {
        state.shatterTimer += dt;
      } else if (state.reassembling) {
        state.reassembleTimer += dt;
        if (state.reassembleTimer >= 0.8) {
          state.reassembling = false;
        }
      }

      words.forEach((w) => {
        if (isTarget) {
          w.fadeTime = Math.min(0.8, w.fadeTime + dt);
        } else {
          w.fadeTime = Math.max(0, w.fadeTime - dt);
        }

        const stagger = w.wordIndex * 0.040;
        const p = Math.max(0, Math.min(1, (w.fadeTime - stagger) / Math.max(0.001, 0.8 - stagger)));
        w.alpha = isTarget ? easeOutCubic(p) : easeInOutCubic(p);

        if (w.wobbleActive) {
          w.wobbleTime += dt;
          if (w.wobbleTime >= 0.5) {
            w.wobbleActive = false;
            w.wobbleScale = 0;
            w.wobbleRot = 0;
          } else {
            const env = Math.exp(-w.wobbleTime * 6);
            w.wobbleScale = 0.12 * Math.cos(w.wobbleTime * 25) * env;
            w.wobbleRot = w.wobbleDir * (8 * Math.PI / 180) * Math.sin(w.wobbleTime * 25) * env;
          }
        }

        const b = w.body;

        if (state.reassembling) {
          const prog = Math.min(1.0, state.reassembleTimer / 0.8);
          const ease = easeInOutCubic(prog);
          const curX = lerp(w.startX, w.hx, ease);
          const curY = lerp(w.startY, w.hy, ease);
          let dRot = (w.hRot - w.startRot) % (Math.PI * 2);
          if (dRot > Math.PI) dRot -= Math.PI * 2;
          if (dRot < -Math.PI) dRot += Math.PI * 2;
          const curRot = w.startRot + dRot * ease;
          Body.setPosition(b, { x: curX, y: curY });
          Body.setAngle(b, curRot);
          Body.setVelocity(b, { x: 0, y: 0 });
          Body.setAngularVelocity(b, 0);
        } else if (state.shattered) {
          const tether = Math.max(0, 1.0 - state.shatterTimer / 0.3);
          if (tether > 0.001) {
            const dx = w.hx - b.position.x;
            const dy = w.hy - b.position.y;
            Body.applyForce(b, b.position, {
              x: (0.0003 * dx - 0.002 * b.velocity.x) * tether * b.mass,
              y: (0.0003 * dy - 0.002 * b.velocity.y) * tether * b.mass
            });
          }
          if (engine.gravity.y < 0.4) {
            const downG = (0.55 - engine.gravity.y) * 0.001 * b.mass;
            Body.applyForce(b, b.position, { x: 0, y: downG });
          }
        } else {
          // Intact state: snap to home positions exactly
          Body.setPosition(b, { x: w.hx, y: w.hy });
          Body.setAngle(b, w.hRot);
          Body.setVelocity(b, { x: 0, y: 0 });
          Body.setAngularVelocity(b, 0);
        }
      });
    });

    // 5. Render words to canvas
    const pColor = getPalette(currentAge).particle;

    ['child', 'teen', 'adult'].forEach((st) => {
      const words = stageWords[st];
      words.forEach((w) => {
        if (w.alpha <= 0.01) return;

        const b = w.body;
        ctx.save();
        ctx.globalAlpha = w.alpha;
        ctx.fillStyle = `rgba(${pColor.r255}, ${pColor.g255}, ${pColor.b255}, ${w.alpha.toFixed(3)})`;

        const totalRot = b.angle + (w.wobbleRot || 0);
        const scaleMult = 1 + (w.wobbleScale || 0);

        ctx.setTransform(
          Math.cos(totalRot) * scaleMult * dpr,
          Math.sin(totalRot) * scaleMult * dpr,
          -Math.sin(totalRot) * scaleMult * dpr,
          Math.cos(totalRot) * scaleMult * dpr,
          b.position.x * dpr,
          b.position.y * dpr
        );

        ctx.font = labelFont(fontSize);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        if ('letterSpacing' in ctx) {
          ctx.letterSpacing = '0px';
        }
        ctx.fillText(w.text, 0, fontSize * 0.32);

        ctx.restore();
      });
    });

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  function destroy() {
    ['child', 'teen', 'adult'].forEach((st) => {
      stageWords[st].forEach((wb) => {
        Composite.remove(engine.world, wb.body);
      });
      stageWords[st].length = 0;
    });
  }

  return {
    resize,
    hitTestWord,
    pokeWord,
    hasShatteredWords,
    updateAndRender,
    destroy
  };
}
