import * as Tone from 'tone';

let isAudioInitialized = false;
let isAudioMuted = false;
let currentAudioAge = 0;
let currentDensity = 1.0;
let currentMinorMix = 0.0;

let filter = null;
let delay = null;
let reverb = null;
let masterGain = null;
let meter = null;
let tapPanner = null;
let musicBox = null;
let pad = null;
let subRoot = null;
let sequence = null;

// Shared mutable audio level object (like age.js)
export const audioLevel = {
  value: 0
};

export function getLevel() {
  if (!isAudioInitialized || isAudioMuted) {
    return 0;
  }
  return audioLevel.value;
}

// Fixed 16-step quarter-note melody WITH REAL RESTS, exported as constant MOTIF:
// C5, null, E5, G5, A5, null, G5, E5, D5, null, E5, C5, null, G4, A4, null.
export const MOTIF = [
  'C5', null, 'E5', 'G5',
  'A5', null, 'G5', 'E5',
  'D5', null, 'E5', 'C5',
  null, 'G4', 'A4', null
];

// Importance-based minimum density thresholds for each step.
// Steps 0, 4, 8, 12 are the strongest downbeats and are removed last.
// Least important steps (passing notes on weak beats) drop first as density falls from 1.0 to 0.3.
const STEP_MIN_DENSITY = [
  0.0,   // step 0: 'C5' (strongest downbeat, never removed)
  1.0,   // step 1: null (rest)
  0.50,  // step 2: 'E5' (beat 3)
  0.92,  // step 3: 'G5' (weak beat 4, drops first)
  0.0,   // step 4: 'A5' (strongest downbeat, never removed)
  1.0,   // step 5: null (rest)
  0.58,  // step 6: 'G5' (beat 3)
  0.84,  // step 7: 'E5' (weak beat 4, drops second)
  0.0,   // step 8: 'D5' (strongest downbeat, never removed)
  1.0,   // step 9: null (rest)
  0.42,  // step 10: 'E5' (beat 3)
  0.68,  // step 11: 'C5' (weak beat 4)
  0.0,   // step 12: null (strongest downbeat, rest)
  0.76,  // step 13: 'G4' (weak beat 2, drops third)
  0.62,  // step 14: 'A4' (beat 3)
  1.0    // step 15: null (rest)
];

// 4-bar chord cycle (one chord per 4 steps):
// C (C3 E3 G3), Am (A2 C3 E3), F (F2 A2 C3), G (G2 B2 D3)
// plus a quiet sine root note (one octave lower) under each chord
const CHORDS = [
  { step: 0, notes: ['C3', 'E3', 'G3'], root: 'C2' },
  { step: 4, notes: ['A2', 'C3', 'E3'], root: 'A1' },
  { step: 8, notes: ['F2', 'A2', 'C3'], root: 'F1' },
  { step: 12, notes: ['G2', 'B2', 'D3'], root: 'G1' }
];

// C pentatonic set across two octaves for tap-to-play
const TAP_NOTES = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5'];

const tapCallbacks = new Set();
let lastTapTime = 0;

function smoothstep(min, max, value) {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

// minorMix = smoothstep(0.4, 0.8, age): lowers E, A and B by up to 100 cents (E to Eb, A to Ab, B to Bb)
function getAdjustedFrequency(note, minorMix) {
  if (!note) return null;
  let freq = typeof note === 'number' ? note : Tone.Frequency(note).toFrequency();
  const pitchName = typeof note === 'string' ? note.charAt(0).toUpperCase() : '';
  if (pitchName === 'E' || pitchName === 'A' || pitchName === 'B') {
    freq *= Math.pow(2, (-100 * minorMix) / 1200);
  }
  return freq;
}

export function isMuted() {
  return isAudioMuted;
}

export function setMuted(mute) {
  isAudioMuted = Boolean(mute);
  if (isAudioInitialized) {
    const dest = Tone.getDestination();
    if (dest && dest.volume) {
      if (isAudioMuted) {
        dest.volume.rampTo(-Infinity, 0.2);
        audioLevel.value = 0;
      } else {
        dest.volume.rampTo(0, 0.2);
      }
    }
  } else {
    audioLevel.value = 0;
  }
}

export function onTap(callback) {
  if (typeof callback === 'function') {
    tapCallbacks.add(callback);
    return () => tapCallbacks.delete(callback);
  }
  return () => {};
}

function triggerMusicBoxNote(freq, dur, time, vel) {
  if (!musicBox) return;
  // Voice stealing: if all 6 voices are occupied, steal the oldest voice to avoid dropping notes
  if (musicBox._activeVoices && musicBox._activeVoices.length >= (musicBox.maxPolyphony || 6)) {
    const oldest = musicBox._activeVoices[0];
    if (oldest && oldest.voice) {
      try {
        oldest.voice.triggerRelease(time || Tone.now());
        musicBox._makeVoiceAvailable(oldest.voice);
      } catch {}
    }
  }
  if (vel !== undefined) {
    musicBox.triggerAttackRelease(freq, dur, time, vel);
  } else {
    musicBox.triggerAttackRelease(freq, dur, time);
  }
}

function handleTap(clientX, clientY) {
  if (!isAudioInitialized || !musicBox) return;

  const now = performance.now();
  if (now - lastTapTime < 60) return; // Debounce rapid double triggers
  lastTapTime = now;

  const width = typeof window !== 'undefined' ? (window.innerWidth || 1) : 1;
  const height = typeof window !== 'undefined' ? (window.innerHeight || 1) : 1;
  const xNorm = Math.max(0, Math.min(1, clientX / width));
  const yNorm = Math.max(0, Math.min(1, clientY / height));

  // Spatial audio for tap notes: pan = clamp((objectX / viewportWidth) * 2 - 1, -0.8, 0.8)
  if (tapPanner) {
    const pan = Math.max(-0.8, Math.min(0.8, xNorm * 2 - 1));
    const audioNow = Tone.now();
    tapPanner.pan.setValueAtTime(pan, audioNow);
    tapPanner.pan.rampTo(0, 0.45, audioNow + 0.45);
  }

  // Vertical pointer position: bottom = low, top = high
  const heightFraction = 1 - yNorm;
  const noteIdx = Math.min(
    TAP_NOTES.length - 1,
    Math.max(0, Math.floor(heightFraction * TAP_NOTES.length))
  );
  const rawNote = TAP_NOTES[noteIdx];

  // The tapped note goes through the SAME instrument, filter, reverb and minorMix
  const freq = getAdjustedFrequency(rawNote, currentMinorMix);

  // Velocity 0.9 to 0.5 with age
  const vel = 0.9 - 0.4 * currentAudioAge;

  triggerMusicBoxNote(freq, '4n', undefined, vel);

  // Notify registered callbacks with (xNorm, yNorm, age)
  tapCallbacks.forEach((cb) => {
    try {
      cb(xNorm, yNorm, currentAudioAge);
    } catch (err) {
      console.warn('onTap callback error:', err);
    }
  });
}

export function triggerTapNote(clientX, clientY) {
  handleTap(clientX, clientY);
}

export function setAudioAge(newAge) {
  const a = Math.max(0, Math.min(1, Number(newAge) || 0));
  currentAudioAge = a;
  currentDensity = 1.0 - 0.7 * a;
  currentMinorMix = smoothstep(0.4, 0.8, a);

  if (!isAudioInitialized) return;

  // 1. bpm: 100 to 56
  const targetBpm = 100 - 44 * a;
  Tone.getTransport().bpm.rampTo(targetBpm, 0.2);

  // 2. lowpass cutoff: 6000 Hz to 500 Hz, exponential feel
  const targetCutoff = 6000 * Math.pow(500 / 6000, a);
  filter.frequency.rampTo(targetCutoff, 0.2);

  // 3. reverb wet: 0.15 to 0.65
  const targetWet = 0.15 + 0.50 * a;
  reverb.wet.rampTo(targetWet, 0.2);

  // 4. detune: 0 to 20 cents on the melody
  const targetDetune = 20 * a;
  musicBox.set({ detune: targetDetune });
  if (musicBox._voices) {
    musicBox._voices.forEach((v) => {
      if (v.detune && typeof v.detune.rampTo === 'function') {
        v.detune.rampTo(targetDetune, 0.2);
      }
    });
  }

  // 5. Pad volume rises with age
  const targetPadVol = -16 + 8 * a;
  pad.volume.rampTo(targetPadVol, 0.2);
  const targetSubVol = -26 + 6 * a;
  subRoot.volume.rampTo(targetSubVol, 0.2);
}

// Animation frame meter updater: normalised level 0 to 1 with fast attack and slow release
let currentMeterLevel = 0;
let lastMeterTime = typeof performance !== 'undefined' ? performance.now() : 0;

function updateMeterLoop(time) {
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(updateMeterLoop);
  }

  if (!isAudioInitialized || isAudioMuted || !meter) {
    currentMeterLevel = 0;
    audioLevel.value = 0;
    lastMeterTime = time;
    return;
  }

  const dt = Math.min(0.1, Math.max(0.001, (time - lastMeterTime) * 0.001));
  lastMeterTime = time;

  const db = meter.getValue();
  let target = 0;
  if (typeof db === 'number' && isFinite(db)) {
    // Normalise: -55 dB (silence) to -20 dB (peak bell note) mapped to 0..1
    target = Math.max(0, Math.min(1, (db + 55) / 35));
  } else if (Array.isArray(db) && typeof db[0] === 'number' && isFinite(db[0])) {
    target = Math.max(0, Math.min(1, (db[0] + 55) / 35));
  }

  // Fast attack (snap up ~12ms) and slow release (~280ms decay)
  if (target > currentMeterLevel) {
    const attackRate = 1 - Math.exp(-dt / 0.012);
    currentMeterLevel += (target - currentMeterLevel) * attackRate;
  } else {
    const releaseRate = 1 - Math.exp(-dt / 0.28);
    currentMeterLevel += (target - currentMeterLevel) * releaseRate;
  }

  if (currentMeterLevel < 0.001) currentMeterLevel = 0;
  audioLevel.value = currentMeterLevel;
}

if (typeof requestAnimationFrame !== 'undefined') {
  requestAnimationFrame(updateMeterLoop);
}

export async function initAudio() {
  if (isAudioInitialized) return;

  await Tone.start();

  // Cancel any existing transport schedules (e.g. across HMR)
  Tone.getTransport().cancel();
  Tone.getTransport().stop();
  Tone.getTransport().position = 0;

  // Signal chain:
  // musicBox -> tapPanner -> delay -> filter -> reverb -> masterGain -> Destination & meter
  // pad & subRoot -> filter -> reverb -> masterGain -> Destination & meter
  filter = new Tone.Filter({
    type: 'lowpass',
    frequency: 6000 * Math.pow(500 / 6000, currentAudioAge),
    rolloff: -12,
    Q: 1
  });

  tapPanner = new Tone.Panner(0);

  delay = new Tone.FeedbackDelay({
    delayTime: '8n',
    feedback: 0.25,
    wet: 0.15
  });

  reverb = new Tone.Reverb({
    decay: 3.5,
    preDelay: 0.01,
    wet: 0.15 + 0.50 * currentAudioAge
  });
  await reverb.ready;

  // Master volume low by default: about -18 dB
  masterGain = new Tone.Gain(Tone.dbToGain(-18));

  // Connect chain
  tapPanner.connect(delay);
  delay.connect(filter);
  filter.connect(reverb);
  reverb.connect(masterGain);
  masterGain.connect(Tone.getDestination());

  // Attach Tone.Meter (smoothing 0.8) to the master output
  meter = new Tone.Meter({ smoothing: 0.8 });
  masterGain.connect(meter);

  // Destination volume according to mute state
  const dest = Tone.getDestination();
  if (isAudioMuted) {
    dest.volume.value = -Infinity;
  } else {
    dest.volume.value = 0;
  }

  // 1. MELODY VOICE: soft bell FMSynth (sine oscillator and modulator, harmonicity 3, modulationIndex 1.5)
  // Max 6 voices
  musicBox = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3,
    modulationIndex: 1.5,
    oscillator: { type: 'sine' },
    envelope: {
      attack: 0.002,
      decay: 1.4,
      sustain: 0,
      release: 1.8
    },
    modulation: { type: 'sine' },
    modulationEnvelope: {
      attack: 0.002,
      decay: 0.4,
      sustain: 0,
      release: 0.5
    },
    volume: -6
  });
  musicBox.maxPolyphony = 6;
  musicBox.set({ detune: 20 * currentAudioAge });
  musicBox.connect(tapPanner);

  // 2. PAD: PolySynth with triangle oscillators (attack 1.5, release 3), about 10 dB below the melody
  pad = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: {
      attack: 1.5,
      decay: 0.5,
      sustain: 1.0,
      release: 3.0
    },
    volume: -16 + 8 * currentAudioAge
  });
  pad.maxPolyphony = 16;
  pad.connect(filter);

  // Quiet sine root note under each chord
  subRoot = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: {
      attack: 1.5,
      decay: 0.5,
      sustain: 1.0,
      release: 3.0
    },
    volume: -26 + 6 * currentAudioAge
  });
  subRoot.connect(filter);

  // Transport initial BPM (100 down to 56)
  Tone.getTransport().bpm.value = 100 - 44 * currentAudioAge;

  // 3. 16-step quarter-note melody & harmony sequence with real rests
  const stepIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

  sequence = new Tone.Sequence(
    (time, step) => {
      // Pad chord cycle: one chord per 4 steps (steps 0, 4, 8, 12)
      const chord = CHORDS.find((c) => c.step === step);
      if (chord) {
        const adjustedNotes = chord.notes.map((n) => getAdjustedFrequency(n, currentMinorMix));
        const adjustedRoot = getAdjustedFrequency(chord.root, currentMinorMix);
        pad.triggerAttackRelease(adjustedNotes, '1m', time);
        subRoot.triggerAttackRelease(adjustedRoot, '1m', time);
      }

      // Melody step (center melody in stereo field)
      const note = MOTIF[step];
      if (note !== null && currentDensity >= STEP_MIN_DENSITY[step]) {
        if (tapPanner) {
          tapPanner.pan.setValueAtTime(0, time);
        }
        const freq = getAdjustedFrequency(note, currentMinorMix);
        triggerMusicBoxNote(freq, '4n', time);
      }
    },
    stepIndices,
    '4n'
  );
  sequence.loop = true;

  Tone.getTransport().start();
  sequence.start(0);

  isAudioInitialized = true;
}
