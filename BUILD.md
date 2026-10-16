# BUILD.md
Total budget: 4 hours. If a block runs 50 percent over, stop and tell me.
Asset: public/models/astronaut.glb (low-poly, CC-BY). Packages already installed.

## Block 1: Particle astronaut go/no-go (30 min)
Goal: a particle astronaut on screen that reads as an astronaut at age 0 and 1.
Files: src/scene/AstronautParticles.jsx, src/engine/age.js, src/App.jsx
Do: load the GLB, merge all meshes with baked world transforms, sample 40000
surface points (MeshSurfaceSampler from three/addons), render as Points with a
ShaderMaterial. Uniforms uTime and uAge. age.js exports one shared mutable
object { value } plus a setter. Age 0: large floaty noise drift, warm off-white.
Age 1: near-zero drift, slight downward sag, cool grey. Temporary HTML range
slider (0 to 1) sets age. Slow auto-rotation. OrbitControls.
Done when: both ends still read as an astronaut and it holds 60fps.
Do not: add UI, audio, scroll, or other files.

## Block 2: Entry gate and assemble (20 min)
Goal: user clicks to enter; sound permission unlocked; particles assemble.
Uses: one picked text or entry component from INDEX.md
Files: src/sections/Gate.jsx, src/scene/AstronautParticles.jsx, src/App.jsx
Do: before entry, particles are scattered and still. On click they assemble
into the astronaut over about 2.5s (shader uniform uAssemble, 0 to 1), with a
slow nod. Click calls Tone.start() (stub only, no sounds yet). Also: page background colour and particle colour follow age using the stops
from src/engine/palette.js, interpolated in OKLab. Particle colour comes from
the same uniform, replacing the hardcoded warm/cool colours in Block 1.
Done when: the gate looks designed, and assembly is smooth and repeatable.
Do not: build audio or scroll yet.

## Block 3: Scroll drives age (25 min)
Goal: scrolling is the journey.
Files: src/engine/scroll.js, src/App.jsx, index.css
Do: Lenis smooth scroll plus GSAP ScrollTrigger. The canvas is pinned and the
page does not visibly scroll. Total scroll length about 6 screens. Scroll
progress sets target age, and age eases toward it (lerp in rAF). Show a small
age counter. Remove the temporary slider.
Done when: scrolling up and down moves age smoothly both ways, no jumps.
Do not: touch audio or the 2D layer.

## Block 4: Procedural audio engine (35 min)
Goal: the music is generated from age.
Files: src/engine/audio.js, mute toggle in src/App.jsx
Do: Tone.js. One fixed 8-note motif in C major pentatonic, played by a music
box style FMSynth, plus a soft pad. Age maps: bpm 110 to 60, scale major
pentatonic to natural minor via per-note mixing, detune 0 to 20 cents,
lowpass cutoff 6000 to 600 Hz, reverb wet 0.1 to 0.6, note density 1.0 to 0.3.
All changes via rampTo. Mute toggle with state.
Done when: scrubbing age audibly goes bright to heavy and back with no clicks.
Do not: build the ending melody variation yet.

## Block 5: 2D physics object layer (40 min)
Goal: gravity flips with age and objects show the stage.
Files: src/layers/Objects.jsx, src/engine/objects.js
Do: matter-js on a second canvas, pointer-events none, drawn over the 3D
canvas. Gravity y = lerp(-0.25, 0.6, age). Draw objects as simple vector
silhouettes with canvas paths (no emojis, no images). Objects per stage:
CHILD: kite, balloon, paper boat.
TEEN: school bag, headphones, phone.
ADULT: laptop, ID card, alarm clock.
Spawn each stage's objects as age enters it; recycle objects that leave the
top. A floor body only exists when gravity is positive, so adult objects pile up.
Done when: childhood objects float up, adult objects fall and pile, and
scrubbing back reverses it.
Do not: change audio or scene files.

## Block 6: Atmosphere shader (30 min)
Goal: world feels like the stage.
Files: src/scene/Background.jsx, index.css
Do: fullscreen background shader with fog gradient and film grain. Palette
variables passed as uniforms. Warm and soft at age 0, cool and grainy at age 1.
Optionally use one picked background component if INDEX.md lists one.
Done when: background alone clearly changes feel from child to adult.
Do not: add radial orbs, dot grids, sparkles or neon.

## Block 7: Stage titles (20 min)
Goal: each stage is named once, quietly.
Uses: one picked text animation component
Files: src/sections/StageLabels.jsx
Do: 3 short labels shown as age crosses 0, 0.4, 0.75. COPY: to be written by
me and pasted into this block before running it. Do not invent copy.
Done when: labels fade in and out with scrolling both ways.

## Block 8: Ending (25 min)
Goal: the opening melody returns changed.
Files: src/engine/audio.js, src/scene/AstronautParticles.jsx
Do: at age at or above 0.97, play the opening motif slowed, sparse, filtered.
Locally loosen particles around the chest back toward age 0 behaviour, and
show one warm point of light in the grey world. Fully reversible.
Done when: reaching the end gives a distinct moment, and scrolling back clears it.

## Block 9: Polish and ship (15 min)
Do: credits line, favicon, page title, loading state, devicePixelRatio cap,
README with one paragraph pitch. Commit and push.

## If behind, cut in this order
1) Block 7 labels 2) 3 objects per stage down to 2 3) Block 6 picked component.
Never cut Block 4 or Block 8. They are what makes it a Vibe entry.
Checkpoints: Blocks 1-4 done by 2:00 elapsed. Block 5 done by 2:50.