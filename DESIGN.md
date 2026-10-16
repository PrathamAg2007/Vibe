# DESIGN.md
Read fully before writing any code. Do not skip rules.

## Concept
One astronaut, shown as a particle cloud, lives one life as the user scrolls.
A single value `age` (0 to 1) is the only source of truth. Gravity, music,
shader colour, particle behaviour and the floating objects are all COMPUTED
from `age`. Nothing is a preset animation. Scrolling back makes everything
younger again, so every effect must be reversible and smooth.
Stages: child (age 0 to 0.4), teen (0.4 to 0.75), adult (0.75 to 1).

## Hard rule: no hand-built UI components
- Every visible UI component comes from src/components/ui/ or src/components/library/ (shadcn and registry installs) or src/components/picked/ (handpicked). Check `picked/INDEX.md` first. If it is not listed
  there, it does not exist. If nothing fits, stop and tell me what is missing.
- Do not edit files inside `picked/` or `ui/`. Wrap them and pass props.
- `inspiration/` is visual reference only. Never copy code from it.
- Plain text elements (age counter, mute toggle, credits line, stage labels)
  may be written as simple JSX styled with design tokens. They are not components.

## Where AI-written code is allowed
- `src/scene/` (three.js, particles, background shader)
- `src/engine/` (age store, audio, scroll mapping)
- `src/layers/` (matter-js object layer)
- `src/sections/` (composition only)
Nothing else.

## Never include
1 harsh gradients, 2 lucide icons, 3 pure white background, 4 rainbow colours,
5 drop shadows, 6 three feature cards in a row, 7 emojis, 8 liquid glass,
9 em dashes (also in copy), 10 Inter/Geist/Space Grotesk, 11 coloured left
stripe, 12 fake testimonials, 13 bento grids, 14 terminal windows,
15 "it's not X, it's Y" copy, 16 checkmark bullets, 17 three pricing tiers,
18 sections with no real content, 19 soft rounded corners (radius 0),
20 purple and black, 21 missing loaders, 22 radial glowing orbs,
23 dot grid backgrounds, 24 sparkle icons, 25 animated arrows,
26 missing Terms page if a footer exists, 27 missing Privacy page if a footer
exists, 28 generic hover lifts, 29 neon colours, 30 basic pastels.

## Look
- Childhood end: warm, saturated, soft, bright.
- Adult end: cool, desaturated, grainy, heavy (reference: the grey, foggy
  Igloo screenshots). "Dark" means heavy and quiet, NOT black with glow.
- Palette and fonts: TBD. Define palette as CSS variables in `index.css` and
  pass them to shaders as uniforms. Never write raw hex inside components.
- Fonts: two max. Not Inter, Geist or Space Grotesk.
- Text is sparse. Specific and concrete. No filler taglines.

## Audio rules
- No sound until the user clicks the entry gate (Tone.start() inside the click).
- Master volume low by default. A visible mute toggle must always exist.
- All audio parameters change with rampTo (about 0.2s) so scrubbing never clicks.

## Performance rules
- Cap devicePixelRatio at 1.5. Particle count constant at 40000 unless I say.
- No per-frame allocations in render loops. Animate on the GPU via uniforms.
- Dispose three.js objects on unmount.

## Legal
- Credits line, always visible, tiny: "Astronaut by Poly by Google [CC-BY]
  via Poly Pizza".

## Process
- One block from BUILD.md at a time. Touch only the files that block lists.
- Do not install packages. Do not refactor earlier blocks.
- Run the dev server and fix console errors before saying done.

## Palette (locked: "Festival to Fog")
- Source of truth: src/engine/palette.js. Never write raw hex in components or shaders.
- Colours are interpolated by age in OKLab (not RGB) between stops.
- Bold, full-screen colour fields. Background, fog and particle colour all follow age.
- No pure black, no pure white. Tinted darks only. Colour lives in fog and horizon light, not in flat fills
- The ember accent (#FF9A3D) is used ONLY in the ending.