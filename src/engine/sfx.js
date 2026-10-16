import * as Tone from 'tone';

let isInitialized = false;
let masterFilter = null;
let sfxPanner = null;
let sfxReverb = null;
let reverbSend = null;

let lastPointerX = typeof window !== 'undefined' ? (window.innerWidth * 0.5) : 0;
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', (e) => {
    lastPointerX = e.clientX;
  }, { capture: true, passive: true });
}

let sineSynth = null;
let membraneSynth = null;
let noiseSynth = null;
let noiseFilter = null;
let metalSynth = null;

let activeSfxCount = 0;

function initSfx() {
  if (isInitialized) return true;
  if (typeof Tone === 'undefined' || !Tone.context || Tone.context.state !== 'running') {
    return false;
  }

  // Spatial audio panner connected to destination
  sfxPanner = new Tone.Panner(0);
  sfxPanner.connect(Tone.getDestination());

  // Master SFX filter: lowpass following age, routes to sfxPanner
  masterFilter = new Tone.Filter({
    type: 'lowpass',
    frequency: 8000,
    rolloff: -12
  });
  masterFilter.connect(sfxPanner);

  // Algorithmic Freeverb for watery paper boat sfx - synchronous, zero await needed
  sfxReverb = new Tone.Freeverb({
    roomSize: 0.55,
    dampening: 2500,
    wet: 0.5
  });
  sfxReverb.connect(masterFilter);

  reverbSend = new Tone.Gain(0.35);
  reverbSend.connect(sfxReverb);

  // 1. Tone.Synth (sine for balloon, phone, boat; triangle for headphones)
  sineSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: {
      attack: 0.005,
      decay: 0.16,
      sustain: 0,
      release: 0.12
    },
    volume: -12
  });
  sineSynth.connect(masterFilter);
  sineSynth.connect(reverbSend);

  // 2. Tone.MembraneSynth (school bag thud)
  membraneSynth = new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 3.5,
    oscillator: { type: 'sine' },
    envelope: {
      attack: 0.002,
      decay: 0.22,
      sustain: 0,
      release: 0.15
    },
    volume: -10
  });
  membraneSynth.connect(masterFilter);

  // 3. Tone.NoiseSynth with dynamic multi-mode filter (kite whoosh, boat tick, bag rustle, laptop click, ID swipe)
  noiseFilter = new Tone.Filter({
    type: 'bandpass',
    frequency: 1000,
    Q: 2
  });
  noiseFilter.connect(masterFilter);

  noiseSynth = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: {
      attack: 0.005,
      decay: 0.15,
      sustain: 0,
      release: 0.05
    },
    volume: -13
  });
  noiseSynth.connect(noiseFilter);

  // 4. Tone.MetalSynth (alarm clock ring)
  metalSynth = new Tone.MetalSynth({
    harmonicity: 3.2,
    modulationIndex: 16,
    resonance: 3600,
    octaves: 1.5,
    envelope: {
      attack: 0.002,
      decay: 0.10,
      release: 0.06
    },
    volume: -15
  });
  metalSynth.connect(masterFilter);

  isInitialized = true;
  return true;
}

export function playSfx(type, age, objectX) {
  // Silent if audio is not running, no errors
  if (typeof Tone === 'undefined' || !Tone.context || Tone.context.state !== 'running') {
    return;
  }

  if (!isInitialized) {
    const ok = initSfx();
    if (!ok) return;
  }

  // Limit overlapping sfx to 4 voices total; ignore clicks beyond that
  if (activeSfxCount >= 4) {
    return;
  }

  activeSfxCount++;
  setTimeout(() => {
    activeSfxCount = Math.max(0, activeSfxCount - 1);
  }, 450);

  const safeAge = Math.max(0, Math.min(1, Number(age) || 0));

  // The lowpass cutoff follows age: 8000 Hz at 0 to 900 Hz at 1 (rampTo, about 0.05s)
  const cutoff = 8000 * Math.pow(900 / 8000, safeAge);
  masterFilter.frequency.rampTo(cutoff, 0.05);

  const now = Tone.now();

  // Spatial audio: pan = clamp((objectX / viewportWidth) * 2 - 1, -0.8, 0.8)
  const viewportWidth = typeof window !== 'undefined' ? (window.innerWidth || 1) : 1;
  const x = typeof objectX === 'number' ? objectX : lastPointerX;
  const pan = Math.max(-0.8, Math.min(0.8, (x / viewportWidth) * 2 - 1));
  if (sfxPanner && sfxPanner.pan) {
    sfxPanner.pan.setValueAtTime(pan, now);
  }

  try {
    switch (type) {
      case 'balloon': {
        // Sine blip with a quick pitch drop 700 to 350 Hz, soft rubbery
        reverbSend.gain.setValueAtTime(0, now);
        sineSynth.oscillator.type = 'sine';
        sineSynth.volume.value = -12;
        sineSynth.triggerAttack(700, now);
        sineSynth.frequency.setValueAtTime(700, now);
        sineSynth.frequency.rampTo(350, 0.12, now + 0.01);
        sineSynth.triggerRelease(now + 0.16);
        break;
      }

      case 'kite': {
        // Bandpass-swept noise whoosh rising from 400 to 2200 Hz
        noiseFilter.type = 'bandpass';
        noiseFilter.Q.value = 2.2;
        noiseFilter.frequency.setValueAtTime(400, now);
        noiseFilter.frequency.rampTo(2200, 0.28, now);
        noiseSynth.volume.value = -13;
        noiseSynth.triggerAttackRelease(0.28, now);
        break;
      }

      case 'boat':
      case 'paper boat': {
        // Watery, two quick rising sine bloops (300 to 900 Hz, 80ms each) plus a tiny high-passed noise tick, slight reverb send
        reverbSend.gain.setValueAtTime(0.4, now);
        sineSynth.oscillator.type = 'sine';
        sineSynth.volume.value = -12;

        // Bloop 1
        sineSynth.triggerAttack(300, now);
        sineSynth.frequency.setValueAtTime(300, now);
        sineSynth.frequency.rampTo(900, 0.08, now);
        sineSynth.triggerRelease(now + 0.08);

        // Tiny high-passed noise tick
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.setValueAtTime(4500, now);
        noiseFilter.Q.value = 1.0;
        noiseSynth.volume.value = -16;
        noiseSynth.triggerAttackRelease(0.018, now + 0.02);

        // Bloop 2
        sineSynth.triggerAttack(350, now + 0.10);
        sineSynth.frequency.setValueAtTime(350, now + 0.10);
        sineSynth.frequency.rampTo(950, 0.08, now + 0.10);
        sineSynth.triggerRelease(now + 0.18);
        break;
      }

      case 'headphones': {
        // Two short triangle blips, a minor second apart (B4 493.88 Hz, then C5 523.25 Hz)
        reverbSend.gain.setValueAtTime(0, now);
        sineSynth.oscillator.type = 'triangle';
        sineSynth.volume.value = -13;
        sineSynth.triggerAttackRelease(493.88, 0.07, now);
        sineSynth.triggerAttackRelease(523.25, 0.08, now + 0.09);
        break;
      }

      case 'phone': {
        // Two clean sine pings, 880 Hz then 1175 Hz
        reverbSend.gain.setValueAtTime(0, now);
        sineSynth.oscillator.type = 'sine';
        sineSynth.volume.value = -12;
        sineSynth.triggerAttackRelease(880, 0.09, now);
        sineSynth.triggerAttackRelease(1174.66, 0.14, now + 0.11);
        break;
      }

      case 'bag':
      case 'school bag': {
        // Low thud, MembraneSynth at C2 plus a short noise burst
        membraneSynth.volume.value = -10;
        membraneSynth.triggerAttackRelease('C2', 0.20, now, 0.85);

        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(900, now);
        noiseFilter.Q.value = 1.0;
        noiseSynth.volume.value = -15;
        noiseSynth.triggerAttackRelease(0.05, now + 0.01);
        break;
      }

      case 'laptop': {
        // Two quick soft key clicks, tiny high-passed noise bursts
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.setValueAtTime(3800, now);
        noiseFilter.Q.value = 1.0;
        noiseSynth.volume.value = -14;
        noiseSynth.triggerAttackRelease(0.015, now);
        noiseSynth.triggerAttackRelease(0.015, now + 0.07);
        break;
      }

      case 'clock':
      case 'alarm clock': {
        // Two short MetalSynth rings, quiet, not annoying
        metalSynth.volume.value = -15;
        metalSynth.triggerAttackRelease(800, 0.06, now, 0.3);
        metalSynth.triggerAttackRelease(880, 0.08, now + 0.11, 0.3);
        break;
      }

      case 'card':
      case 'ID card':
      default: {
        // Fast bandpass noise swipe, about 150ms
        noiseFilter.type = 'bandpass';
        noiseFilter.Q.value = 1.8;
        noiseFilter.frequency.setValueAtTime(1400, now);
        noiseFilter.frequency.rampTo(3200, 0.15, now);
        noiseSynth.volume.value = -14;
        noiseSynth.triggerAttackRelease(0.15, now);
        break;
      }
    }
  } catch (err) {
    console.warn('playSfx error:', err);
  }
}
