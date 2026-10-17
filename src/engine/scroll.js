import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { age, setAge } from './age.js';

gsap.registerPlugin(ScrollTrigger);

let lenisInstance = null;
let scrollTriggerInstance = null;
let tickerCallback = null;
let targetAge = 0;
let ageCounterEl = null;
let hasEntered = false;
let scrollVelocity = 0;

export function lockScroll() {
  if (lenisInstance) {
    lenisInstance.stop();
  }
}

export function unlockScroll() {
  hasEntered = true;
  ScrollTrigger.refresh();
  if (lenisInstance) {
    lenisInstance.start();
  }
}

export const stopScroll = lockScroll;
export const startScroll = unlockScroll;

export function setAgeCounterElement(el) {
  ageCounterEl = el;
}

export function getLenis() {
  return lenisInstance;
}

export function setLenis(instance) {
  lenisInstance = instance;
}

export function getScrollVelocity() {
  return scrollVelocity;
}

export function setScrollVelocity(v) {
  scrollVelocity = v;
}

export function getTargetAge() {
  return targetAge;
}

export function destroyScroll() {
  hasEntered = false;
  targetAge = 0;
  if (scrollTriggerInstance) {
    scrollTriggerInstance.kill();
    scrollTriggerInstance = null;
  }
  if (tickerCallback) {
    gsap.ticker.remove(tickerCallback);
    tickerCallback = null;
  }
  if (lenisInstance) {
    lenisInstance.destroy();
    lenisInstance = null;
  }
  scrollVelocity = 0;
  ageCounterEl = null;
}

export function initScroll(spacerElement, counterElement) {
  destroyScroll();

  if (typeof window !== 'undefined') {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
  }

  hasEntered = false;
  targetAge = 0;
  setAge(0);

  let spacer = spacerElement;
  let counter = counterElement;

  if (spacerElement && spacerElement.spacer) {
    spacer = spacerElement.spacer;
    counter = spacerElement.counter || counterElement;
  }

  if (!spacer && typeof document !== 'undefined') {
    spacer = document.getElementById('scroll-spacer') || document.querySelector('.scroll-spacer');
  }
  if (!counter && typeof document !== 'undefined') {
    counter = document.getElementById('age-counter') || document.querySelector('.age-counter');
  }

  if (counter) {
    ageCounterEl = counter;
    ageCounterEl.textContent = '0 yrs';
  }

  lenisInstance = new Lenis({
    lerp: 0.1,
    wheelMultiplier: 1.4,
    smoothWheel: true,
    syncTouch: false
  });

  // Lenis stays stopped until the gate finishes entering
  lenisInstance.stop();

  lenisInstance.on('scroll', ScrollTrigger.update);

  let lastTime = performance.now();
  tickerCallback = (time) => {
    const now = performance.now();
    const dt = Math.min((now - lastTime) * 0.001, 0.1);
    lastTime = now;

    if (lenisInstance) {
      lenisInstance.raf(time * 1000);
      scrollVelocity = dt > 0 ? (lenisInstance.velocity / dt) : 0;
      lenisInstance.velocityPxPerSec = scrollVelocity;
    } else {
      scrollVelocity = 0;
    }

    // Until the gate has been entered, targetAge must stay 0 and age.value must be 0
    if (!hasEntered) {
      targetAge = 0;
      setAge(0);
      if (ageCounterEl && ageCounterEl.textContent !== '0 yrs') {
        ageCounterEl.textContent = '0 yrs';
      }
      return;
    }

    // Frame-rate independent smoothing: age.value += (target - age.value) * (1 - Math.exp(-dt * 4))
    const current = age.value;
    let nextAge = current + (targetAge - current) * (1 - Math.exp(-dt * 4));
    if (Math.abs(targetAge - nextAge) < 0.0001) {
      nextAge = targetAge;
    }
    setAge(nextAge);

    if (ageCounterEl) {
      const years = Math.round(nextAge * 80);
      const text = `${years} yrs`;
      if (ageCounterEl.textContent !== text) {
        ageCounterEl.textContent = text;
      }
    }
  };

  gsap.ticker.add(tickerCallback);
  gsap.ticker.lagSmoothing(0);

  if (spacer) {
    scrollTriggerInstance = ScrollTrigger.create({
      trigger: spacer,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => {
        if (!hasEntered) {
          targetAge = 0;
          return;
        }
        targetAge = self.progress;
      }
    });
  }

  return {
    lenis: lenisInstance,
    scrollTrigger: scrollTriggerInstance
  };
}
