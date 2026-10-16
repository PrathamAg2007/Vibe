import Matter from 'matter-js';
import { getPalette } from './palette.js';
import { playSfx } from './sfx.js';
import { createLabelsManager } from './labels.js';
import { getLevel } from './audio.js';

const { Engine, Bodies, Body, Composite } = Matter;

export function getObjectBaseColor(ageVal) {
  const p = getPalette(ageVal);
  return {
    r: Math.round((p.fog2.r * 0.5 + p.particle.r * 0.5) * 255),
    g: Math.round((p.fog2.g * 0.5 + p.particle.g * 0.5) * 255),
    b: Math.round((p.fog2.b * 0.5 + p.particle.b * 0.5) * 255)
  };
}

export function getParticleColor(ageVal) {
  const p = getPalette(ageVal);
  return {
    r: p.particle.r255,
    g: p.particle.g255,
    b: p.particle.b255
  };
}

/* Piecewise target gravity */
export function getTargetGravityY(currentAge) {
  const a = Math.max(0, Math.min(1, currentAge));
  if (a <= 0.3) {
    return -0.25;
  }
  if (a < 0.5) {
    const t = (a - 0.3) / 0.2;
    const s = t * t * (3 - 2 * t);
    return -0.25 + s * 0.25;
  }
  if (a <= 0.6) {
    return 0.02;
  }
  if (a < 0.85) {
    const t = (a - 0.6) / 0.25;
    const s = t * t * (3 - 2 * t);
    return 0.02 + s * (0.6 - 0.02);
  }
  return 0.6;
}

/* Tether strength t(age): 1 up to age 0.5, smoothstep down to 0 at age 0.75 */
export function getTether(currentAge) {
  const a = Math.max(0, Math.min(1, currentAge));
  if (a <= 0.5) return 1.0;
  if (a >= 0.75) return 0.0;
  const u = (a - 0.5) / 0.25;
  return 1.0 - u * u * (3 - 2 * u);
}

export function getTargetStage(currentAge, currentActiveStage) {
  const a = Math.max(0, Math.min(1, currentAge));
  if (currentActiveStage === 'adult') {
    if (a < 0.71) return 'teen';
    return 'adult';
  }
  if (currentActiveStage === 'teen') {
    if (a < 0.38) return 'child';
    if (a >= 0.75) return 'adult';
    return 'teen';
  }
  if (a >= 0.42) return 'teen';
  return 'child';
}

export const STAGE_OBJECTS = {
  child: ['balloon', 'kite', 'boat'],
  teen: ['headphones', 'phone', 'bag'],
  adult: ['laptop', 'clock', 'card']
};

export const LABELS = {
  balloon: 'let go',
  kite: 'string in hand',
  boat: 'folded from homework',
  'paper boat': 'folded from homework',
  headphones: 'do not talk to me',
  phone: '3 unread',
  bag: 'heavier every year',
  'school bag': 'heavier every year',
  laptop: 'one more tab',
  clock: '6:30 again',
  'alarm clock': '6:30 again',
  card: 'name, number, photo',
  'ID card': 'name, number, photo'
};

export const OBJECT_SPECS = {
  balloon: {
    height: 176, // 220 * 0.8
    bodyType: 'circle',
    radius: 52, // 65 * 0.8
    hitRadius: 88, // 110 * 0.8
    pathScale: 176 / 78
  },
  kite: {
    height: 208, // 260 * 0.8
    bodyType: 'rectangle',
    bodyWidth: 128, // 160 * 0.8
    bodyHeight: 160, // 200 * 0.8
    hitRadius: 104, // 130 * 0.8
    pathScale: 208 / 68
  },
  boat: {
    height: 120, // 150 * 0.8
    bodyType: 'rectangle',
    bodyWidth: 156, // 195 * 0.8
    bodyHeight: 104, // 130 * 0.8
    hitRadius: 84, // 105 * 0.8
    pathScale: 120 / 40
  },
  headphones: {
    height: 140,
    bodyType: 'circle',
    radius: 70,
    hitRadius: 75,
    pathScale: 140 / 39
  },
  phone: {
    height: 120,
    bodyType: 'rectangle',
    bodyWidth: 65,
    bodyHeight: 120,
    hitRadius: 60,
    pathScale: 120 / 44
  },
  bag: {
    height: 260,
    bodyType: 'rectangle',
    bodyWidth: 200,
    bodyHeight: 240,
    hitRadius: 130,
    pathScale: 260 / 43
  },
  laptop: {
    height: 200,
    bodyType: 'rectangle',
    bodyWidth: 280, // width about 1.4x height
    bodyHeight: 190,
    hitRadius: 140,
    pathScale: 200 / 30
  },
  clock: {
    height: 130,
    bodyType: 'circle',
    radius: 58,
    hitRadius: 65,
    pathScale: 130 / 42
  },
  card: {
    height: 110,
    bodyType: 'rectangle',
    bodyWidth: 75,
    bodyHeight: 110,
    hitRadius: 55,
    pathScale: 110 / 38
  }
};

/* Path2D caches: built once, reused forever */
let PATHS = null;

function createBalloonPath() {
  const p = new Path2D();
  p.ellipse(0, -10, 17, 23, 0, 0, Math.PI * 2);
  p.moveTo(-4, 14);
  p.lineTo(4, 14);
  p.lineTo(0, 12);
  p.closePath();
  p.moveTo(0, 14);
  p.quadraticCurveTo(12, 28, 2, 45);
  p.lineTo(0.5, 45);
  p.quadraticCurveTo(10.5, 28, -1.5, 14);
  p.closePath();
  return p;
}

function createKitePath() {
  const p = new Path2D();
  p.moveTo(-1.5, -26);
  p.lineTo(-20, -5);
  p.lineTo(-1.5, -5);
  p.closePath();

  p.moveTo(1.5, -26);
  p.lineTo(1.5, -5);
  p.lineTo(20, -5);
  p.closePath();

  p.moveTo(-1.5, -2);
  p.lineTo(-20, -2);
  p.lineTo(-1.5, 22);
  p.closePath();

  p.moveTo(1.5, -2);
  p.lineTo(20, -2);
  p.lineTo(1.5, 22);
  p.closePath();

  p.moveTo(-0.5, 22);
  p.quadraticCurveTo(6, 30, 2, 42);
  p.lineTo(3, 42);
  p.quadraticCurveTo(7, 30, 0.5, 22);
  p.closePath();

  p.moveTo(0, 28);
  p.lineTo(8, 32);
  p.lineTo(8, 28);
  p.lineTo(0, 32);
  p.closePath();

  p.moveTo(-2, 36);
  p.lineTo(6, 40);
  p.lineTo(6, 36);
  p.lineTo(-2, 40);
  p.closePath();
  return p;
}

function createBoatPath() {
  const p = new Path2D();
  p.moveTo(-26, 4);
  p.lineTo(26, 4);
  p.lineTo(18, 16);
  p.lineTo(-18, 16);
  p.closePath();

  p.moveTo(-1, 2);
  p.lineTo(-1, -24);
  p.lineTo(17, 2);
  p.closePath();

  p.moveTo(-3, 2);
  p.lineTo(-3, -16);
  p.lineTo(-18, 2);
  p.closePath();

  p.moveTo(-1, -24);
  p.lineTo(-6, -21);
  p.lineTo(-1, -18);
  p.closePath();
  return p;
}

function createHeadphonesPath() {
  const p = new Path2D();
  p.arc(0, -3, 21, Math.PI, 0, false);
  p.arc(0, -3, 17, 0, Math.PI, true);
  p.closePath();

  p.roundRect(-24, -3, 7, 18, 3);
  p.roundRect(17, -3, 7, 18, 3);
  p.roundRect(-23, -8, 5, 6, 1);
  p.roundRect(18, -8, 5, 6, 1);
  return p;
}

function createPhonePath() {
  const p = new Path2D();
  p.roundRect(-12, -22, 24, 44, 4);
  p.roundRect(-9, -16, 18, 30, 2);
  p.arc(0, -19, 1, 0, Math.PI * 2);
  p.roundRect(-4, 16.5, 8, 2, 1);
  return p;
}

function createBagPath() {
  const p = new Path2D();
  p.roundRect(-16, -13, 32, 34, 5);
  p.roundRect(-17, -14, 34, 16, 4);
  p.arc(0, -14, 8, Math.PI, 0, false);
  p.arc(0, -14, 6, 0, Math.PI, true);
  p.closePath();
  p.roundRect(-11, 7, 6, 9, 1);
  p.roundRect(5, 7, 6, 9, 1);
  return p;
}

function createLaptopPath() {
  const p = new Path2D();
  p.roundRect(-19, -24, 38, 22, 2);
  p.roundRect(-16, -21, 32, 16, 1);
  p.moveTo(-21, 6);
  p.lineTo(21, 6);
  p.lineTo(18, -1);
  p.lineTo(-18, -1);
  p.closePath();
  p.roundRect(-5, 1, 10, 3, 1);
  return p;
}

function createClockPath() {
  const p = new Path2D();
  p.arc(0, 2, 17, 0, Math.PI * 2);
  p.moveTo(-14, -10);
  p.arc(-13, -13, 6, 0.8 * Math.PI, 1.8 * Math.PI, false);
  p.closePath();
  p.moveTo(14, -10);
  p.arc(13, -13, 6, 1.2 * Math.PI, 0.2 * Math.PI, false);
  p.closePath();
  p.roundRect(-2, -18, 4, 6, 1);
  p.moveTo(-11, 16);
  p.lineTo(-15, 23);
  p.lineTo(-12, 23);
  p.lineTo(-8, 17);
  p.closePath();
  p.moveTo(11, 16);
  p.lineTo(15, 23);
  p.lineTo(12, 23);
  p.lineTo(8, 17);
  p.closePath();
  p.moveTo(-0.8, 2);
  p.lineTo(-0.8, -6);
  p.lineTo(0.8, -6);
  p.lineTo(0.8, 2);
  p.closePath();
  p.moveTo(0, 1.2);
  p.lineTo(6, 3);
  p.lineTo(6, 1.5);
  p.lineTo(0, 0);
  p.closePath();
  return p;
}

function createCardPath() {
  const p = new Path2D();
  p.roundRect(-13, -19, 26, 38, 3);
  p.roundRect(-4, -17, 8, 2.5, 1);
  p.arc(0, -7, 4.5, 0, Math.PI * 2);
  p.moveTo(-6, 2);
  p.quadraticCurveTo(0, -2, 6, 2);
  p.lineTo(6, 4);
  p.lineTo(-6, 4);
  p.closePath();
  p.roundRect(-9, 7, 18, 2.5, 1);
  p.roundRect(-7, 12, 14, 2, 1);
  return p;
}

export function getPaths() {
  if (PATHS) return PATHS;
  if (typeof Path2D === 'undefined') return {};
  PATHS = {
    balloon: createBalloonPath(),
    kite: createKitePath(),
    boat: createBoatPath(),
    headphones: createHeadphonesPath(),
    phone: createPhonePath(),
    bag: createBagPath(),
    laptop: createLaptopPath(),
    clock: createClockPath(),
    card: createCardPath()
  };
  return PATHS;
}

const CAT_WALL = 0x0001;
const CAT_CHILD = 0x0002;
const CAT_TEEN = 0x0004;
const CAT_ADULT = 0x0008;
const CAT_NONE = 0x0000;

const STAGE_CATEGORY = {
  child: CAT_CHILD,
  teen: CAT_TEEN,
  adult: CAT_ADULT
};

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

const SPRING_K = 170;
const SPRING_C = 11;
const FIXED_STEP = 1 / 60;
const FIXED_STEP_MS = 1000 / 60;

export function createObjectsEngine(canvas, initialWidth, initialHeight) {
  const ctx = canvas.getContext('2d');
  const paths = getPaths();

  let width = initialWidth;
  let height = initialHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  const engine = Engine.create({
    gravity: { x: 0, y: -0.25, scale: 0.001 },
    enableSleeping: true
  });

  const labelsManager = createLabelsManager(engine, canvas, initialWidth, initialHeight);

  const bodies = [];
  const ripples = [];
  const activeWordBodies = new Set();
  let activeClickedBody = null;
  let physicsAccumulator = 0;

  let pendingSpawns = [];
  let collisionsActive = false;
  let currentGravityY = -0.25;
  let lastAge = 0;

  let floorBody = null;
  let leftWall = null;
  let rightWall = null;

  let lastActiveStage = null;
  const scratchForce = { x: 0, y: 0 };

  // Pointer & hover label tracking
  let pointerX = -9999;
  let pointerY = -9999;
  let currentLabelBody = null;
  let labelAlpha = 0;

  const Z_DEPTHS = [0.55, 0.70, 0.84, 0.98, 1.12, 1.26];

  function clearAllBodies() {
    for (let i = 0; i < bodies.length; i++) {
      Composite.remove(engine.world, bodies[i]);
    }
    bodies.length = 0;
    pendingSpawns.length = 0;
    ripples.length = 0;
    activeWordBodies.clear();
    activeClickedBody = null;
    physicsAccumulator = 0;

    if (floorBody) {
      Composite.remove(engine.world, [floorBody, leftWall, rightWall]);
      floorBody = null;
      leftWall = null;
      rightWall = null;
    }
    currentLabelBody = null;
    labelAlpha = 0;
  }

  function addRipple(x, y, baseRadius) {
    ripples.push({
      x,
      y,
      baseRadius: Math.max(16, baseRadius),
      elapsed: 0,
      duration: 0.600
    });
  }

  function updateAndRenderRipples(targetCtx, dt, pColor, targetDpr) {
    if (ripples.length === 0) return;
    targetCtx.save();
    targetCtx.setTransform(targetDpr, 0, 0, targetDpr, 0, 0);
    targetCtx.lineWidth = 1.5;

    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.elapsed += dt;
      if (r.elapsed >= r.duration) {
        ripples.splice(i, 1);
        continue;
      }
      const p = Math.min(1.0, r.elapsed / r.duration);
      const e = easeOutCubic(p);
      const currentRadius = r.baseRadius * (1.0 + 0.6 * e);
      const alpha = Math.max(0, 0.5 * (1.0 - e));

      targetCtx.strokeStyle = `rgba(${pColor.r}, ${pColor.g}, ${pColor.b}, ${alpha.toFixed(3)})`;
      targetCtx.beginPath();
      targetCtx.arc(r.x, r.y, currentRadius, 0, Math.PI * 2);
      targetCtx.stroke();
    }
    targetCtx.restore();
  }

  function updateSpring(plugin, dt, isHovered) {
    plugin.targetScale = isHovered ? 1.06 : 1.00;

    if (plugin.springScale === undefined) plugin.springScale = 1.0;
    if (plugin.springScaleVel === undefined) plugin.springScaleVel = 0;
    if (plugin.springRot === undefined) plugin.springRot = 0;
    if (plugin.springRotVel === undefined) plugin.springRotVel = 0;

    // Scale spring: F = -k*(x - target) - c*v
    const fScale = -SPRING_K * (plugin.springScale - plugin.targetScale) - SPRING_C * plugin.springScaleVel;
    plugin.springScaleVel += fScale * dt;
    plugin.springScale += plugin.springScaleVel * dt;
    plugin.springScale = Math.max(0.85, Math.min(1.25, plugin.springScale));

    // Rotation spring: target rotation is 0
    const fRot = -SPRING_K * plugin.springRot - SPRING_C * plugin.springRotVel;
    plugin.springRotVel += fRot * dt;
    plugin.springRot += plugin.springRotVel * dt;
    const maxRotRad = (16 * Math.PI) / 180;
    plugin.springRot = Math.max(-maxRotRad, Math.min(maxRotRad, plugin.springRot));

    // Sync to wordObj if word body
    if (plugin.isWord && plugin.wordObj) {
      plugin.wordObj.wobbleScale = plugin.springScale - 1.0;
      plugin.wordObj.wobbleRot = plugin.springRot;
      plugin.wordObj.wobbleActive = false;
    }
  }

  function updateTetherResponse(body, dt) {
    const tr = body.plugin.tetherResponse;
    const baseFriction = body.plugin.baseFrictionAir !== undefined ? body.plugin.baseFrictionAir : body.frictionAir;

    if (!tr) {
      body.frictionAir = baseFriction;
      return 1.0;
    }

    tr.elapsed += dt;
    const totalDuration = tr.holdDuration + tr.rampDuration;

    let mult = 1.0;
    if (tr.elapsed <= tr.holdDuration) {
      mult = 0.30;
    } else if (tr.elapsed < totalDuration) {
      const u = (tr.elapsed - tr.holdDuration) / tr.rampDuration;
      mult = 0.30 + 0.70 * easeOutCubic(u);
    } else {
      mult = 1.0;
      body.plugin.tetherResponse = null;
    }

    // Air friction bump during settle (0.35s to 1.40s)
    if (tr.elapsed >= 0.35 && tr.elapsed <= totalDuration) {
      const s = (tr.elapsed - 0.35) / (totalDuration - 0.35);
      body.frictionAir = baseFriction + 0.035 * Math.sin(s * Math.PI);
    } else {
      body.frictionAir = baseFriction;
    }

    return mult;
  }

  function applyActivePush(body, stepDt) {
    const push = body.plugin.activePush;
    if (!push) return;

    const prevP = Math.min(1.0, push.elapsed / push.duration);
    push.elapsed += stepDt;
    const nextP = Math.min(1.0, push.elapsed / push.duration);

    // Force profile: integral of 3*(1 - p)^2 dp over [prevP, nextP]
    const weight = Math.pow(1 - prevP, 3) - Math.pow(1 - nextP, 3);
    const impulse = push.totalImpulse * weight;

    if (impulse > 0) {
      scratchForce.x = push.dirX * impulse;
      scratchForce.y = push.dirY * impulse;
      Body.applyForce(body, body.position, scratchForce);
    }

    if (push.elapsed >= push.duration) {
      body.plugin.activePush = null;
      if (activeClickedBody === body) {
        activeClickedBody = null;
      }
    }
  }

  function applyEdgeCushion(body, screenWidth, screenHeight) {
    const r = body.plugin.drawnRadius || 40;
    const pos = body.position;
    const vel = body.velocity;
    const mass = body.mass;
    const kEdge = 0.0006 * mass;
    const dEdge = 0.0025 * mass;

    let fx = 0;
    let fy = 0;

    // Left boundary
    if (pos.x < r) {
      const dist = r - pos.x;
      fx += kEdge * dist - dEdge * vel.x;
    }
    // Right boundary
    if (pos.x > screenWidth - r) {
      const dist = screenWidth - r - pos.x;
      fx += -kEdge * dist - dEdge * vel.x;
    }
    // Top boundary
    if (pos.y < r) {
      const dist = r - pos.y;
      fy += kEdge * dist - dEdge * vel.y;
    }
    // Bottom boundary (only when floating, not adult pile)
    if (pos.y > screenHeight - r && (!floorBody || body.plugin.stage !== 'adult')) {
      const dist = screenHeight - r - pos.y;
      fy += -kEdge * dist - dEdge * vel.y;
    }

    if (fx !== 0 || fy !== 0) {
      scratchForce.x = fx;
      scratchForce.y = fy;
      Body.applyForce(body, pos, scratchForce);
    }
  }

  function applyClickInteraction(body, px, py, isWord) {
    if (!body || !body.plugin) return;
    const plugin = body.plugin;
    const now = performance.now();
    const isRapidClick = (now - (plugin.lastClickTime || 0)) < 300;
    plugin.lastClickTime = now;

    // 1. Wake sleeping body
    if (body.isSleeping) {
      Matter.Sleeping.set(body, false);
    }
    if (plugin.stage === 'adult') {
      activeClickedBody = body;
    }

    // 2. Compute push direction away from click point
    const dx = body.position.x - px;
    const dy = body.position.y - py;
    const dist = Math.hypot(dx, dy);
    let dirX = 0;
    let dirY = -1;
    if (dist > 1) {
      dirX = dx / dist;
      dirY = dy / dist;
    } else {
      dirX = body.position.x > width / 2 ? 0.35 : -0.35;
      dirY = -0.93;
      const len = Math.hypot(dirX, dirY);
      dirX /= len;
      dirY /= len;
    }

    // Rotation direction: kicking away from click side
    const rotDir = (px <= body.position.x) ? 1 : -1;

    // 3. Magnitude: adult pile objects get ~half strength
    const scaleFactor = plugin.sizeScale || 1.0;
    let baseImpulse = 0.012;
    if (plugin.stage === 'adult') {
      baseImpulse = 0.006; // half strength so pile does not explode
    } else if (isWord) {
      baseImpulse = 0.007;
    }
    const totalImpulse = baseImpulse * scaleFactor * body.mass;
    const maxSafeSpeed = plugin.stage === 'adult' ? 2.0 : 4.5;
    plugin.maxSafeSpeed = maxSafeSpeed;

    // 4. Eased push (180 ms)
    if (isRapidClick && plugin.activePush) {
      plugin.activePush.dirX = (plugin.activePush.dirX + dirX) * 0.5;
      plugin.activePush.dirY = (plugin.activePush.dirY + dirY) * 0.5;
      const dlen = Math.hypot(plugin.activePush.dirX, plugin.activePush.dirY) || 1;
      plugin.activePush.dirX /= dlen;
      plugin.activePush.dirY /= dlen;
      plugin.activePush.totalImpulse = Math.min(totalImpulse * 1.5, plugin.activePush.totalImpulse + totalImpulse * 0.6);
      plugin.activePush.elapsed = 0;
      plugin.activePush.duration = 0.180;
    } else {
      plugin.activePush = {
        dirX,
        dirY,
        totalImpulse,
        elapsed: 0,
        duration: 0.180,
        maxSpeed: maxSafeSpeed
      };
    }

    // 5. Soft tether response (700ms hold at 30%, 700ms ramp with easeOutCubic)
    if (plugin.hx !== undefined || isWord) {
      plugin.tetherResponse = {
        elapsed: 0,
        holdDuration: 0.700,
        rampDuration: 0.700
      };
    }

    // 6. Spring feedback: scale punches to ~1.12 with one overshoot, rotation kicks 6 to 9 deg
    if (plugin.springScale === undefined) plugin.springScale = 1.0;
    if (plugin.springScaleVel === undefined) plugin.springScaleVel = 0;
    if (plugin.springRot === undefined) plugin.springRot = 0;
    if (plugin.springRotVel === undefined) plugin.springRotVel = 0;

    if (isRapidClick) {
      plugin.springScaleVel = Math.min(5.5, plugin.springScaleVel + 2.2);
      plugin.springRotVel = Math.max(-6.5, Math.min(6.5, plugin.springRotVel + rotDir * 2.5));
    } else {
      plugin.springScaleVel = 3.15; // punches to ~1.12 with one small overshoot
      plugin.springRotVel = rotDir * 3.5; // kicks ~7.6 deg and settles
    }

    // 7. Thin expanding ripple
    addRipple(body.position.x, body.position.y, plugin.drawnRadius || 40);

    // 8. Track word body if applicable
    if (isWord) {
      activeWordBodies.add(body);
    }
  }

  function updateBoundaries(tether) {
    const hasShatteredWords = labelsManager && typeof labelsManager.hasShatteredWords === 'function' && labelsManager.hasShatteredWords();
    const needBoundaries = (currentGravityY > 0.05 && tether < 0.3) || hasShatteredWords;

    if (needBoundaries) {
      const boundaryFilter = {
        category: CAT_WALL,
        mask: CAT_CHILD | CAT_TEEN | CAT_ADULT,
        group: 0
      };

      if (!floorBody) {
        floorBody = Bodies.rectangle(width / 2, height + 40, width * 2, 80, {
          isStatic: true,
          friction: 0.85,
          restitution: 0.15,
          collisionFilter: boundaryFilter
        });
        leftWall = Bodies.rectangle(-40, height / 2, 80, height * 2, {
          isStatic: true,
          friction: 0.6,
          restitution: 0.15,
          collisionFilter: boundaryFilter
        });
        rightWall = Bodies.rectangle(width + 40, height / 2, 80, height * 2, {
          isStatic: true,
          friction: 0.6,
          restitution: 0.15,
          collisionFilter: boundaryFilter
        });
        Composite.add(engine.world, [floorBody, leftWall, rightWall]);
      } else {
        Body.setPosition(floorBody, { x: width / 2, y: height + 40 });
        Body.setPosition(leftWall, { x: -40, y: height / 2 });
        Body.setPosition(rightWall, { x: width + 40, y: height / 2 });
      }
    } else {
      if (floorBody) {
        Composite.remove(engine.world, [floorBody, leftWall, rightWall]);
        floorBody = null;
        leftWall = null;
        rightWall = null;
      }
    }
  }

  function spawnSingleBody(stage, i, timeSec) {
    const types = STAGE_OBJECTS[stage];
    if (!types) return;

    const viewportScale = height / 1080;
    const type = types[i % 3];
    const spec = OBJECT_SPECS[type];
    const z = Z_DEPTHS[i];
    const sizeScale = z * viewportScale;
    const alpha = 0.45 + ((z - 0.5) / 0.8) * 0.5;

    const bodyOpts = {
      frictionAir: stage === 'adult' ? 0.03 : 0.045,
      restitution: 0.25,
      friction: 0.6,
      density: 0.001,
      collisionFilter: {
        category: CAT_NONE,
        mask: CAT_NONE,
        group: -1
      }
    };

    let spawnX;
    let spawnY;

    if (stage === 'adult') {
      const dropSlots = [0.15, 0.23, 0.31, 0.69, 0.77, 0.85];
      spawnX = dropSlots[i] * width + (Math.random() - 0.5) * 0.03 * width;
      spawnY = -spec.height * sizeScale - 30 - (i % 3) * 40;

      const reqRadius = spec.hitRadius * sizeScale;
      for (let k = 0; k < bodies.length; k++) {
        const ob = bodies[k];
        const obR = ob.plugin.drawnRadius;
        const dx = spawnX - ob.position.x;
        const dy = spawnY - ob.position.y;
        const dist = Math.hypot(dx, dy);
        const minDist = reqRadius + obR;
        if (dist < minDist) {
          spawnY -= (minDist - dist) + 15;
        }
      }

      let body = null;
      if (spec.bodyType === 'circle') {
        body = Bodies.circle(spawnX, spawnY, spec.radius * sizeScale, bodyOpts);
      } else {
        body = Bodies.rectangle(spawnX, spawnY, spec.bodyWidth * sizeScale, spec.bodyHeight * sizeScale, bodyOpts);
      }

      Body.setVelocity(body, {
        x: (Math.random() - 0.5) * 0.8,
        y: 1.5 + Math.random() * 1.5
      });
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.02);

      body.plugin = {
        type,
        stage,
        slotIndex: i,
        z,
        sizeScale,
        scale: spec.pathScale * sizeScale,
        alpha,
        drawnRadius: spec.hitRadius * sizeScale,
        fadeAlpha: 0.0,
        animScale: 0.85,
        fadeInElapsed: 0,
        fadeOutElapsed: 0,
        fadingOut: false,
        swayPhase: Math.random() * Math.PI * 2,
        springScale: 1.0,
        springScaleVel: 0,
        springRot: 0,
        springRotVel: 0,
        targetScale: 1.0,
        activePush: null,
        tetherResponse: null,
        baseFrictionAir: bodyOpts.frictionAir,
        maxSafeSpeed: 2.0,
        lastClickTime: 0,
        prevX: spawnX,
        prevY: spawnY,
        prevAngle: body.angle,
        prevVelX: 0,
        prevVelY: 0
      };

      bodies.push(body);
      Composite.add(engine.world, body);
    } else {
      let hx;
      let hy;
      switch (i) {
        case 0:
          hx = 0.20 * width;
          hy = 0.22 * height;
          break;
        case 1:
          hx = 0.80 * width;
          hy = 0.22 * height;
          break;
        case 2:
          hx = 0.22 * width;
          hy = 0.78 * height;
          break;
        case 3:
          hx = 0.78 * width;
          hy = 0.78 * height;
          break;
        case 4:
          hx = 0.16 * width;
          hy = 0.50 * height;
          break;
        case 5:
        default:
          hx = 0.84 * width;
          hy = 0.50 * height;
          break;
      }

      const rx = (40 + (i % 3) * 10) * viewportScale * (z > 1.0 ? 0.7 : 1.0);
      const ry = (45 + (i % 3) * 10) * viewportScale * (z > 1.0 ? 0.7 : 1.0);
      const orbitSpeed = (0.12 + (i % 2) * 0.05) * (i % 2 === 0 ? 1 : -1);
      const phase = (i * Math.PI * 2) / 6;

      const targetX = hx + Math.cos(timeSec * orbitSpeed + phase) * rx;
      const targetY = hy + Math.sin(timeSec * orbitSpeed * 0.8 + phase) * ry;

      spawnX = targetX;
      spawnY = targetY;

      const reqRadius = spec.hitRadius * sizeScale;
      for (let k = 0; k < bodies.length; k++) {
        const ob = bodies[k];
        const obR = ob.plugin.drawnRadius;
        const dx = spawnX - ob.position.x;
        const dy = spawnY - ob.position.y;
        const dist = Math.hypot(dx, dy);
        const minDist = reqRadius + obR;
        if (dist < minDist) {
          const ang = dist > 0.001 ? Math.atan2(dy, dx) : (i * 1.0);
          spawnX = ob.position.x + Math.cos(ang) * (minDist + 10);
          spawnY = ob.position.y + Math.sin(ang) * (minDist + 10);
        }
      }

      let body = null;
      if (spec.bodyType === 'circle') {
        body = Bodies.circle(spawnX, spawnY, spec.radius * sizeScale, bodyOpts);
      } else {
        body = Bodies.rectangle(spawnX, spawnY, spec.bodyWidth * sizeScale, spec.bodyHeight * sizeScale, bodyOpts);
      }

      Body.setVelocity(body, { x: 0, y: 0 });
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.008 * z);

      body.plugin = {
        type,
        stage,
        slotIndex: i,
        z,
        sizeScale,
        scale: spec.pathScale * sizeScale,
        alpha,
        drawnRadius: spec.hitRadius * sizeScale,
        fadeAlpha: 0.0,
        animScale: 0.85,
        fadeInElapsed: 0,
        fadeOutElapsed: 0,
        fadingOut: false,
        hx,
        hy,
        rx,
        ry,
        orbitSpeed,
        phase,
        swayPhase: Math.random() * Math.PI * 2,
        springScale: 1.0,
        springScaleVel: 0,
        springRot: 0,
        springRotVel: 0,
        targetScale: 1.0,
        activePush: null,
        tetherResponse: null,
        baseFrictionAir: bodyOpts.frictionAir,
        maxSafeSpeed: 4.5,
        lastClickTime: 0,
        prevX: spawnX,
        prevY: spawnY,
        prevAngle: body.angle,
        prevVelX: 0,
        prevVelY: 0
      };

      bodies.push(body);
      Composite.add(engine.world, body);
    }
  }

  function startStageTransition(newStage, isFirst = false) {
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b.plugin.stage !== newStage) {
        if (!b.plugin.fadingOut) {
          b.plugin.fadingOut = true;
          const currentFade = b.plugin.fadeAlpha || 1.0;
          b.plugin.fadeOutElapsed = (1.0 - currentFade) * 1.4;
        }
        b.collisionFilter.category = CAT_NONE;
        b.collisionFilter.mask = CAT_NONE;
        b.collisionFilter.group = -1;
      } else {
        if (b.plugin.fadingOut) {
          b.plugin.fadingOut = false;
          const currentFade = b.plugin.fadeAlpha || 0.0;
          b.plugin.fadeInElapsed = currentFade * 1.0;
        }
      }
    }

    pendingSpawns = pendingSpawns.filter((p) => p.stage === newStage);

    for (let slot = 0; slot < 6; slot++) {
      const existing = bodies.some((b) => b.plugin.stage === newStage && b.plugin.slotIndex === slot);
      const alreadyPending = pendingSpawns.some((p) => p.stage === newStage && p.slotIndex === slot);
      if (!existing && !alreadyPending) {
        pendingSpawns.push({
          stage: newStage,
          slotIndex: slot,
          delay: isFirst ? (slot * 0.06) : (1.4 * 0.40 + slot * 0.20)
        });
      }
    }
  }

  function resize(newW, newH) {
    width = newW;
    height = newH;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    labelsManager.resize(newW, newH);
  }

  function setPointer(x, y) {
    pointerX = x;
    pointerY = y;
  }

  function hitTest(px, py) {
    // 1. Check fallen words
    const wordHit = labelsManager.hitTestWord(px, py);
    if (wordHit) return wordHit;

    // 2. Check floating objects
    let topHit = null;
    let topZ = -Infinity;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      const totalAlpha = b.plugin.alpha * Math.max(0, Math.min(1, b.plugin.fadeAlpha));
      if (totalAlpha < 0.3) continue;

      const r = b.plugin.drawnRadius;
      const dx = px - b.position.x;
      const dy = py - b.position.y;
      if (dx * dx + dy * dy <= r * r) {
        if (b.plugin.z > topZ) {
          topZ = b.plugin.z;
          topHit = b;
        }
      }
    }
    return topHit;
  }

  function handleClick(px, py) {
    const hit = hitTest(px, py);
    if (!hit) return null;

    const isWord = Boolean(hit.plugin && hit.plugin.isWord);
    applyClickInteraction(hit, px, py, isWord);

    if (!isWord) {
      playSfx(hit.plugin.type, lastAge);
    }

    return hit;
  }

  function updateAndRender(dt, currentAge, time, active) {
    lastAge = currentAge;

    if (!active) {
      if (bodies.length > 0) {
        clearAllBodies();
      }
      lastActiveStage = null;
      currentLabelBody = null;
      labelAlpha = 0;
      ctx.clearRect(0, 0, width * dpr, height * dpr);
      return;
    }

    const tether = getTether(currentAge);
    const timeSec = time * 0.001;
    const frameDt = Math.min(dt, 0.050);

    // 1. Target gravity & boundaries
    const targetGravityY = getTargetGravityY(currentAge);
    currentGravityY += (targetGravityY - currentGravityY) * Math.min(1, frameDt * 6);
    engine.gravity.y = currentGravityY;
    engine.gravity.x = 0;

    updateBoundaries(tether);

    // 2. Stage transitions with hysteresis and crossfade
    const activeStage = getTargetStage(currentAge, lastActiveStage);
    if (activeStage !== lastActiveStage) {
      const isFirst = (lastActiveStage === null);
      lastActiveStage = activeStage;
      startStageTransition(activeStage, isFirst);
    }

    // 3. Process pending staggered spawns
    for (let i = pendingSpawns.length - 1; i >= 0; i--) {
      const ps = pendingSpawns[i];
      ps.delay -= frameDt;
      if (ps.delay <= 0) {
        spawnSingleBody(ps.stage, ps.slotIndex, timeSec);
        pendingSpawns.splice(i, 1);
      }
    }

    // 4. Update body lifecycle: easeOutCubic in (1.0s), easeInOutCubic out (1.4s)
    for (let i = bodies.length - 1; i >= 0; i--) {
      const b = bodies[i];
      if (b.plugin.fadingOut) {
        b.plugin.fadeOutElapsed += frameDt;
        const p = Math.min(1.0, b.plugin.fadeOutElapsed / 1.4);
        const e = easeInOutCubic(p);
        b.plugin.fadeAlpha = Math.max(0.0, 1.0 - e);
        b.plugin.animScale = 1.0 - 0.10 * e;
        if (p >= 1.0) {
          if (currentLabelBody === b) {
            currentLabelBody = null;
            labelAlpha = 0;
          }
          Composite.remove(engine.world, b);
          bodies.splice(i, 1);
          continue;
        }
      } else if (b.plugin.fadeInElapsed < 1.0) {
        b.plugin.fadeInElapsed += frameDt;
        const p = Math.min(1.0, b.plugin.fadeInElapsed / 1.0);
        const e = easeOutCubic(p);
        b.plugin.fadeAlpha = e;
        b.plugin.animScale = 0.85 + 0.15 * e;
      } else {
        b.plugin.fadeAlpha = 1.0;
        b.plugin.animScale = 1.0;
      }
    }

    // 5. Collision filtering
    if (collisionsActive) {
      if (tether > 0.32) collisionsActive = false;
    } else {
      if (tether < 0.28) collisionsActive = true;
    }

    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b.plugin.fadingOut) {
        b.collisionFilter.category = CAT_NONE;
        b.collisionFilter.mask = CAT_NONE;
        b.collisionFilter.group = -1;
      } else if (!collisionsActive) {
        b.collisionFilter.category = STAGE_CATEGORY[b.plugin.stage] || CAT_NONE;
        b.collisionFilter.mask = CAT_WALL;
        b.collisionFilter.group = -1;
      } else {
        const cat = STAGE_CATEGORY[b.plugin.stage] || CAT_NONE;
        b.collisionFilter.category = cat;
        b.collisionFilter.mask = CAT_WALL | cat;
        b.collisionFilter.group = 0;
      }
    }

    // 6. Between 0.5 and 0.75 (tether releasing), apply velocity damping
    if (currentAge >= 0.5 && currentAge <= 0.75) {
      const damp = Math.pow(0.97, frameDt * 60);
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        Body.setVelocity(b, {
          x: b.velocity.x * damp,
          y: b.velocity.y * damp
        });
        Body.setAngularVelocity(b, b.angularVelocity * damp);
      }
    }

    // 7. Hit-testing throttled to once per animation frame
    const hovered = hitTest(pointerX, pointerY);
    if (hovered && !hovered.plugin.isWord) {
      currentLabelBody = hovered;
      labelAlpha = Math.min(1.0, labelAlpha + frameDt / 0.150);
    } else {
      labelAlpha = Math.max(0.0, labelAlpha - frameDt / 0.150);
      if (labelAlpha <= 0) {
        currentLabelBody = null;
      }
    }

    // 8. Update damped springs for all objects and active words
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      updateSpring(b.plugin, frameDt, b === hovered);
    }
    if (hovered && hovered.plugin && hovered.plugin.isWord) {
      activeWordBodies.add(hovered);
    }
    activeWordBodies.forEach((wb) => {
      if (!wb || !wb.plugin) {
        activeWordBodies.delete(wb);
        return;
      }
      updateSpring(wb.plugin, frameDt, wb === hovered);
      if (wb !== hovered &&
          Math.abs((wb.plugin.springScale || 1.0) - 1.0) < 0.001 &&
          Math.abs(wb.plugin.springRot || 0) < 0.001 &&
          !wb.plugin.activePush &&
          !wb.plugin.tetherResponse) {
        activeWordBodies.delete(wb);
      }
    });

    // 9. Fixed timestep physics update with accumulator
    physicsAccumulator += frameDt;
    let stepsTaken = 0;

    while (physicsAccumulator >= FIXED_STEP && stepsTaken < 3) {
      // Record previous states for render interpolation
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        b.plugin.prevX = b.position.x;
        b.plugin.prevY = b.position.y;
        b.plugin.prevAngle = b.angle;
      }
      activeWordBodies.forEach((wb) => {
        wb.plugin.prevX = wb.position.x;
        wb.plugin.prevY = wb.position.y;
        wb.plugin.prevAngle = wb.angle;
      });

      // a. Active push forces
      for (let i = 0; i < bodies.length; i++) {
        applyActivePush(bodies[i], FIXED_STEP);
      }
      activeWordBodies.forEach((wb) => {
        applyActivePush(wb, FIXED_STEP);
      });

      // b. Tether response & orbit forces
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        const plugin = b.plugin;
        const tetherMult = updateTetherResponse(b, FIXED_STEP);

        if (plugin.hx !== undefined && tether > 0.001) {
          const targetX = plugin.hx + Math.cos(timeSec * plugin.orbitSpeed + plugin.phase) * plugin.rx;
          const targetY = plugin.hy + Math.sin(timeSec * plugin.orbitSpeed * 0.8 + plugin.phase) * plugin.ry;

          const dx = targetX - b.position.x;
          const dy = targetY - b.position.y;

          const k = 0.00035 * b.mass;
          const damping = 0.0025 * b.mass;

          const effectiveTether = tether * tetherMult;
          scratchForce.x = (k * dx - damping * b.velocity.x) * effectiveTether;
          scratchForce.y = (k * dy - damping * b.velocity.y) * effectiveTether;

          Body.applyForce(b, b.position, scratchForce);
        }

        applyEdgeCushion(b, width, height);
      }
      activeWordBodies.forEach((wb) => {
        applyEdgeCushion(wb, width, height);
      });

      // c. Record adult pile velocities before step
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        if (b.plugin.stage === 'adult') {
          b.plugin.prevVelX = b.velocity.x;
          b.plugin.prevVelY = b.velocity.y;
        }
      }

      // d. Step physics
      Engine.update(engine, FIXED_STEP_MS);

      // e. Speed clamping and pile safety
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        const sp = Math.hypot(b.velocity.x, b.velocity.y);
        const maxSp = b.plugin.maxSafeSpeed || (b.plugin.stage === 'adult' ? 2.0 : 4.5);
        if (sp > maxSp) {
          const ratio = maxSp / sp;
          Body.setVelocity(b, { x: b.velocity.x * ratio, y: b.velocity.y * ratio });
        }

        // Adult pile safety: keep sleeping bodies asleep and cap contact impulse on neighbours
        if (b.plugin.stage === 'adult' && b !== activeClickedBody) {
          if (b.isSleeping) {
            Matter.Sleeping.set(b, true);
            continue;
          }
          const dvx = b.velocity.x - (b.plugin.prevVelX || 0);
          const dvy = b.velocity.y - (b.plugin.prevVelY || 0);
          const dvMag = Math.hypot(dvx, dvy);
          if (dvMag > 0.45) {
            const sc = 0.45 / dvMag;
            Body.setVelocity(b, {
              x: (b.plugin.prevVelX || 0) + dvx * sc,
              y: Math.max(-0.3, (b.plugin.prevVelY || 0) + dvy * sc)
            });
          } else if (b.velocity.y < -0.3) {
            Body.setVelocity(b, { x: b.velocity.x, y: Math.max(-0.3, b.velocity.y) });
          }
        }
      }

      physicsAccumulator -= FIXED_STEP;
      stepsTaken++;
    }

    if (physicsAccumulator > FIXED_STEP * 2) {
      physicsAccumulator = 0;
    }

    const interpAlpha = Math.max(0, Math.min(1, physicsAccumulator / FIXED_STEP));

    // 10. Render objects to canvas (sorted by z, far first)
    ctx.clearRect(0, 0, width * dpr, height * dpr);

    const { r, g, b } = getObjectBaseColor(currentAge);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;

    bodies.sort((a, b) => a.plugin.z - b.plugin.z);

    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];
      const { type, scale, alpha, fadeAlpha, hx, swayPhase, animScale, prevX, prevY, prevAngle } = body.plugin;
      const totalAlpha = alpha * Math.max(0, Math.min(1, fadeAlpha));
      if (totalAlpha <= 0.005) continue;

      ctx.globalAlpha = totalAlpha;

      const renderX = prevX !== undefined ? prevX + (body.position.x - prevX) * interpAlpha : body.position.x;
      const renderY = prevY !== undefined ? prevY + (body.position.y - prevY) * interpAlpha : body.position.y;

      let diffAngle = body.angle - (prevAngle !== undefined ? prevAngle : body.angle);
      while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
      while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
      const renderAngle = (prevAngle !== undefined ? prevAngle : body.angle) + diffAngle * interpAlpha;

      const swayRot = hx !== undefined
        ? Math.sin(timeSec * 1.2 + swayPhase) * 0.18 * tether
        : 0;
      const totalAngle = renderAngle + swayRot + (body.plugin.springRot || 0);

      const level = getLevel();
      const objPhase = i * 0.85;
      const wave = 0.65 + 0.35 * Math.cos(timeSec * 7.5 + objPhase);
      const pulse = 1 + 0.04 * level * wave;
      const effectiveScale = scale * (body.plugin.springScale || 1.0) * (animScale || 1.0) * pulse;

      const cos = Math.cos(totalAngle);
      const sin = Math.sin(totalAngle);

      ctx.setTransform(
        cos * effectiveScale * dpr,
        sin * effectiveScale * dpr,
        -sin * effectiveScale * dpr,
        cos * effectiveScale * dpr,
        renderX * dpr,
        renderY * dpr
      );

      const path = paths[type];
      if (path) {
        ctx.fill(path, 'evenodd');
      }
    }

    // 11. Render thin expanding ripples
    updateAndRenderRipples(ctx, frameDt, getParticleColor(currentAge), dpr);

    // 12. Render hover label
    if (currentLabelBody && labelAlpha > 0.01) {
      const text = LABELS[currentLabelBody.plugin.type];
      if (text) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.font = '400 12px "IBM Plex Mono", monospace';
        ctx.textBaseline = 'middle';

        const textMetrics = ctx.measureText(text);
        const textWidth = textMetrics.width;

        const bx = currentLabelBody.plugin.prevX !== undefined
          ? currentLabelBody.plugin.prevX + (currentLabelBody.position.x - currentLabelBody.plugin.prevX) * interpAlpha
          : currentLabelBody.position.x;
        const by = currentLabelBody.plugin.prevY !== undefined
          ? currentLabelBody.plugin.prevY + (currentLabelBody.position.y - currentLabelBody.plugin.prevY) * interpAlpha
          : currentLabelBody.position.y;
        const rad = currentLabelBody.plugin.drawnRadius;
        const gap = 0.6 * rad;

        let lx = bx + rad + gap;
        let ly = by;

        if (lx + textWidth > width - 16) {
          lx = bx - rad - gap - textWidth;
        }
        lx = Math.max(16, Math.min(width - textWidth - 16, lx));
        ly = Math.max(20, Math.min(height - 20, ly));

        const partColor = getParticleColor(currentAge);
        const bodyFade = currentLabelBody.plugin.fadeAlpha;
        const finalLabelAlpha = labelAlpha * Math.min(1, bodyFade);

        ctx.fillStyle = `rgba(${partColor.r}, ${partColor.g}, ${partColor.b}, ${finalLabelAlpha.toFixed(3)})`;
        ctx.fillText(text, lx, ly);
      }
    }

    // 13. Render stage label words & update physics
    labelsManager.updateAndRender(frameDt, currentAge, time, active, dpr);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  function destroy() {
    labelsManager.destroy();
    clearAllBodies();
    Engine.clear(engine);
  }

  return {
    resize,
    setPointer,
    hitTest,
    handleClick,
    updateAndRender,
    destroy
  };
}
