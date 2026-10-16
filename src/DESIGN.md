# DESIGN.md

Read this fully before writing any code. Do not skip rules.

## Hard rule: no hand-built components
- Never write a UI component from scratch.
- Every UI element must come from `src/components/library/` or `src/components/picked/`.
- Check `src/components/picked/INDEX.md` first. If it is not listed there, it does not exist.
- You may write sections in `src/sections/` that compose existing components and pass props. Nothing else.
- If no existing component fits, stop and tell me what is missing instead of inventing one.
- Do not edit files inside `picked/` or `library/`. Wrap them and use props.
- `inspiration/` is visual reference only. Never copy code from it.

## Things to never include
1. Harsh gradients
2. Lucide icons
3. Pure white background
4. Rainbow colouring
5. Drop shadows
6. Three feature cards in a row
7. Emojis
8. Liquid glass
9. Em dashes (in copy too)
10. Inter, Geist or Space Grotesk fonts
11. Coloured left-border stripe on cards
12. Fake testimonials
13. Bento grids
14. Terminal window mockups
15. "It's not X, it's Y" copywriting
16. Checkmark bullet lists
17. Three-tier pricing tables
18. Sections with no real product demo or content
19. Soft rounded corners (radius stays at 0 unless told otherwise)
20. Purple and black colour scheme
21. Missing loading states (use skeleton or a designed loader)
22. Radial glowing orbs
23. Dot grid backgrounds
24. Sparkle icons
25. Animated arrows
26. Missing Terms page, if a footer exists
27. Missing Privacy page, if a footer exists
28. Generic hover lift or scale on cards
29. Neon colours
30. Basic pastel palettes

## Layout and motion
- Frontend only. No backend, no database. All data is local mock data.
- Scroll-pinned sections: the page stays put and the section content changes as the user scrolls.
- Smooth scroll with Lenis, registered once in `src/lib/`.
- Motion must serve the story. Every animation needs a reason. No decorative motion.
- Few sections, each one fully finished, beats many half-done ones.

## Copy
- Specific and concrete. Real-sounding content, no lorem ipsum.
- No filler taglines.

## Colour and type (decided later)
- Palette: TBD, will be defined as CSS variables in `index.css`. Use only those variables, never raw hex in components.
- Fonts: TBD, two max.

## Process
- Work on one block from BUILD.md at a time. Touch only the files that block lists.
- Do not install packages unless the block says so.
- Run the dev server and fix console errors before saying done.