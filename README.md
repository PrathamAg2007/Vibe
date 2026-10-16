# Weightless (working title)

One astronaut. One whole life. One number running everything.

Scroll, and a tiny astronaut made of 40,000 floating dots grows up. When he is a kid, the world is warm, loud and light: balloons and kites drift around him and the music sounds like a music box. As he gets older, things get heavier. The colours cool down, the music slows and goes dark, and the stuff he carries (school bags, laptops, alarm clocks) stops floating and starts falling and piling up.

Scroll back up and he gets younger again. Nothing is a recorded animation. It is all computed live.

## The one idea

Everything you see and hear comes from a single value called `age` (0 to 1):

- gravity flips from "float up" to "fall down"
- the music changes from bright and sparse to slow, low and moody
- the colours are generated from a function, not picked by hand
- the astronaut's dots go from loose and dusty to tight and heavy

## How to play

1. Click anywhere on the first screen. The dots pull together into the astronaut and the sound starts.
2. Scroll slowly. That is the whole journey.
3. Hover the floating objects to read what they mean. Click them to poke them.
4. Tap the astronaut to play a note. Press and drag him to spin him around.
5. Scroll back up to watch time run in reverse.

Use headphones or decent speakers. Half of this is sound.

## Built for the three event challenges

- **Shatter into physics:** fast scrolling or growing up breaks the on-screen text into falling pieces that join the pile.
- **Audio-reactive and spatial:** the dots pulse with the music, sounds pan to where you click, and the layout morphs between life stages.
- **Zero raster and colour lock:** no images anywhere. Everything is drawn with shaders, canvas and SVG, and the palette is one function that generates every colour.

## Under the hood

React + Vite, three.js (react-three-fiber) for the particle astronaut, GLSL shaders, matter-js for the 2D physics, Tone.js for generative audio, GSAP + Lenis for scrolling, Tailwind for styling. Front end only. No backend, no database, no tracking.

## Run it

```bash
npm install
npm run dev
```

For the smoothest version:

```bash
npm run build
npm run preview
```

## Credits

- Astronaut model: "Astronaut" by Poly by Google, CC-BY, via Poly Pizza
- Fonts: Syne by Bonjour Monde (OFL) and IBM Plex Mono (OFL)
- Entry text animation: Text Generate Effect from Aceternity UI

Made solo in one afternoon at a vibe-a-thon.