# CellScape — Builder Brief

CellScape is an interactive cell-biology simulation website. The goal: the kind of gorgeous molecular
animations people watch on Instagram/YouTube (glossy membranes, spinning ATP synthase, chromosomes
pulling apart) — but **the student drives them**. Every sim must let the learner change something and
see a real, scientifically correct consequence.

Audience: NSW high school students (Stage 4–6, Years 7–12) and their teachers on laptops, Chromebooks,
iPads and phones.

## Tech contract (non-negotiable)

- Plain HTML + ES modules + Canvas 2D. **No build step, no npm, no external JS libraries.** Must run
  from any static server (GitHub Pages).
- Each sim lives in `sims/<slug>/` with exactly `index.html` and `sim.js` (you may add more `.js`
  modules in the same folder if sim.js gets large, e.g. `draw.js`, `model.js`).
- Start by copying `sims/_template/` — keep its HTML shell (header, `#stage` with `#canvas` and
  `#overlay`, `#panel` aside), fonts and CSS link. Change the title, `<title>`, `aria-label` and the
  `.tag` (syllabus tag).
- Use the shared kit: `import * as K from "../../assets/js/kit.js";` Read `assets/js/kit.js` and
  `assets/css/cellscape.css` fully before writing code. Available: `createStage, loop, pointer,
  backdrop, sphere, glow, blob, roundRect, bilayer, label, arrow, shade, withAlpha, mix, slider,
  button, buttonRow, segmented, checkbox, card, chip, toaster, missions, quiz, makeParticles, bounce,
  brownian, clamp, lerp, rand, randInt, pick, dist, easeInOut, easeOut, TAU, C (palette), $`.
- **Do NOT edit anything outside your own `sims/<slug>/` folder** (other builders are working in
  parallel). If you need a helper the kit lacks, write it locally in your folder. If you need extra
  CSS, put a `<style>` block in your `index.html`.
- Draw in CSS pixels (`stage.w`, `stage.h`); the stage resizes — lay out relative to `stage.w/h` every
  frame (or recompute on resize) so it works from 360 px phone width to 1920 px desktop.
- Performance: steady 60 fps on a Chromebook. `shadowBlur` is expensive — use it on at most a
  handful of objects per frame; use `K.glow` (radial gradient) or pre-rendered offscreen canvases for
  many glowing particles. Cap particle counts (~300 max).
- Pointer events only (via `K.pointer` or your own) so mouse + touch both work. Draggable things need
  a generous hit radius (≥ 22 px) for fingers.
- Respect `prefers-reduced-motion` where practical (e.g. slower default speed), but the sim must
  still work.
- No console errors. No `localStorage` needed.

## Experience contract (what every sim must have)

1. **A beautiful stage.** Dark luminous "inside the cell" aesthetic matching the suite: `K.backdrop`,
   glossy `K.sphere` molecules, soft `K.glow`, smooth eased motion, labels via `K.label`. Aim for
   "screenshot-worthy". Depth cues (parallax background particles, blurred/dim far layer) are
   encouraged.
2. **Direct manipulation.** At least one thing the learner grabs/clicks *in the canvas* (drag a
   molecule, click a pump, pull a chromosome, crank a rotor) — not only sliders.
3. **Variables with consequences.** Sliders/toggles that change the underlying model (concentration,
   temperature, pH, light, pO₂, inhibitors…). Results must be scientifically correct in direction and
   roughly in magnitude.
4. **Live readouts.** `K.chip` overlay chips with key numbers (rates, counts, %), and where useful a
   small live graph drawn on the canvas (corner inset) or in a panel card canvas.
5. **"What's happening" card** at the top of the panel whose text **updates with the current
   state/phase** (plain-language, Year 9–11 reading level, key terms in `<strong>`).
6. **Missions** (`K.missions`) — 4–6 progressively harder goals detected automatically from state,
   e.g. "Make the cell lose water until it crenates". Toast on completion.
7. **Quiz** (`K.quiz`) — 4–6 multiple choice questions with explanations, at the bottom of the panel.
8. **Controls**: Pause/Play, Reset, and a speed control (0.25×–3×) using the loop's `.speed`.
9. A colour **legend** card (`.legend` CSS class exists) when the stage has ≥ 3 particle types.
10. Accessible: buttons are real `<button>`s (kit does this), canvas has an `aria-label`, the
    "What's happening" text conveys the state for non-visual users.

## Science quality

Accuracy matters — this will be used in classrooms. Use correct terminology and Australian spelling
(haemoglobin, colour, centre). Simplify, but never teach a misconception. Where a model is
simplified, say so briefly in the explain card ("Not to scale: …").

## Verification before you finish

1. `node --check sims/<slug>/*.js` passes.
2. A static server is running at `http://localhost:8420` (root = the `cellscape/` folder). If you
   have browser tools (`mcp__Claude_Browser__*`), open **your own new tab** (`tabs_create`, then
   `navigate` to `http://localhost:8420/sims/<slug>/index.html`), check `read_console_messages` for
   errors, take a screenshot, exercise the main interaction, and resize to mobile (375 px) to confirm
   layout. Close your tab when done. Don't touch other tabs.
3. Report back: a short summary of the interactions, missions, model equations/assumptions, and
   anything you were unsure about scientifically.
