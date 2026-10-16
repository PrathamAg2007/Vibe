import { triggerTapNote } from './audio.js';

let controlsRef = null;
let astronautTester = null;
let objectHandler = null;

let owner = 'none';
let isPointerDown = false;
let downX = 0;
let downY = 0;
let downTime = 0;
let lastMoveX = -9999;
let lastMoveY = -9999;

export function registerControls(controls) {
  controlsRef = controls;
  if (controlsRef) {
    controlsRef.enabled = false; // Default enabled=false
  }
}

export function unregisterControls() {
  controlsRef = null;
}

export function registerAstronautTester(testerFn) {
  astronautTester = testerFn;
}

export function unregisterAstronautTester() {
  astronautTester = null;
}

export function registerObjectHandler(handler) {
  objectHandler = handler;
}

export function unregisterObjectHandler() {
  objectHandler = null;
}

export function getCurrentOwner() {
  return owner;
}

function forceEndControls() {
  if (!controlsRef) return;
  controlsRef.enabled = false;
  if (controlsRef._pointers) {
    if (controlsRef.domElement && typeof controlsRef.domElement.releasePointerCapture === 'function') {
      for (let i = 0; i < controlsRef._pointers.length; i++) {
        try {
          controlsRef.domElement.releasePointerCapture(controlsRef._pointers[i]);
        } catch {}
      }
    }
    if (controlsRef.domElement && controlsRef.domElement.ownerDocument) {
      try {
        controlsRef.domElement.ownerDocument.removeEventListener('pointermove', controlsRef._onPointerMove);
        controlsRef.domElement.ownerDocument.removeEventListener('pointerup', controlsRef._onPointerUp);
      } catch {}
    }
    controlsRef._pointers.length = 0;
  }
  if (controlsRef._pointerPositions) {
    controlsRef._pointerPositions = {};
  }
  controlsRef.state = -1; // _STATE.NONE
  if (controlsRef.domElement) {
    controlsRef.domElement.style.cursor = '';
  }
}

function updateHoverCursor() {
  if (isPointerDown && owner === 'astronaut') {
    document.body.style.cursor = 'grabbing';
    return;
  }

  // Check interactive DOM elements (buttons, links, etc.)
  if (typeof document !== 'undefined') {
    const el = document.elementFromPoint(lastMoveX, lastMoveY);
    if (el && el.closest('button, [role="button"], a, input, textarea, #mute-toggle')) {
      document.body.style.cursor = '';
      return;
    }

    if (objectHandler && typeof objectHandler.hitTest === 'function' && objectHandler.hitTest(lastMoveX, lastMoveY)) {
      document.body.style.cursor = 'pointer';
    } else if (astronautTester && astronautTester(lastMoveX, lastMoveY)) {
      document.body.style.cursor = 'grab';
    } else {
      document.body.style.cursor = '';
    }
  }
}

function onPointerDown(e) {
  isPointerDown = true;
  downX = e.clientX;
  downY = e.clientY;
  downTime = performance.now();
  lastMoveX = e.clientX;
  lastMoveY = e.clientY;

  // If clicking on UI button or control, leave to UI
  const target = e.target;
  if (target && target.closest('button, [role="button"], a, input, textarea, #mute-toggle, #age-counter')) {
    owner = 'none';
    if (controlsRef) controlsRef.enabled = false;
    return;
  }

  // Decide owner: 'object' > 'astronaut' > 'none'
  if (objectHandler && typeof objectHandler.hitTest === 'function' && objectHandler.hitTest(e.clientX, e.clientY)) {
    owner = 'object';
    if (controlsRef) controlsRef.enabled = false;
  } else if (astronautTester && astronautTester(e.clientX, e.clientY)) {
    owner = 'astronaut';
    if (controlsRef) {
      controlsRef.enabled = true;
    }
    document.body.style.cursor = 'grabbing';
  } else {
    owner = 'none';
    if (controlsRef) controlsRef.enabled = false;
  }
}

function onPointerMove(e) {
  lastMoveX = e.clientX;
  lastMoveY = e.clientY;

  if (isPointerDown) {
    if (owner === 'astronaut') {
      if (controlsRef) controlsRef.enabled = true;
      document.body.style.cursor = 'grabbing';
    } else {
      if (controlsRef) controlsRef.enabled = false;
    }
  } else {
    updateHoverCursor();
  }

  if (objectHandler && typeof objectHandler.setPointer === 'function') {
    objectHandler.setPointer(e.clientX, e.clientY);
  }
}

function onPointerUp(e) {
  if (!isPointerDown) return;
  const dt = performance.now() - downTime;
  const dx = e.clientX - downX;
  const dy = e.clientY - downY;
  const dist = Math.hypot(dx, dy);

  const prevOwner = owner;
  isPointerDown = false;
  owner = 'none';

  forceEndControls();

  if (prevOwner === 'astronaut') {
    // Tap-to-play note fires only when owner was astronaut and press was a short tap (< 300ms, < 6px)
    if (dt < 300 && dist < 6) {
      try {
        triggerTapNote(e.clientX, e.clientY);
      } catch (err) {
        console.warn('triggerTapNote error:', err);
      }
    }
  } else if (prevOwner === 'object') {
    if (dt <= 300 && dist < 6) {
      if (objectHandler && typeof objectHandler.handleClick === 'function') {
        objectHandler.handleClick(e.clientX, e.clientY);
      }
    }
  }

  updateHoverCursor();
}

function onPointerCancel() {
  resetState();
}

function onBlur() {
  resetState();
}

function onVisibilityChange() {
  if (document.hidden) {
    resetState();
  }
}

function resetState() {
  isPointerDown = false;
  owner = 'none';
  forceEndControls();
  updateHoverCursor();
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', onPointerDown, { capture: true });
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { capture: true });
  window.addEventListener('pointercancel', onPointerCancel);
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVisibilityChange);
}
