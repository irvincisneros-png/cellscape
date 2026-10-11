# Phase 6 briefs: polish and publish

Phase 6 has seven builders working in parallel. Each owns **only** the files listed in its section. Read `LEVEL_BRIEF.md` (the contract and rules), `docs/PLAN.md` (follow-ups) and the files you own before you start.

## Shared rules
- Edit only your own files. If you need a change in a file you don't own, describe it in your report.
- The dev server already runs at http://localhost:8420. Don't start another.
- **Browser:** open your own tab with `tabs_create`, then `tabs_select` it to the front, and pass an explicit `tabId` on every call. Other builders share the pane, so never touch their tabs. Close your tab when done.
- **Hidden pane:** the pane is often hidden, so run `window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 33)` in your tab. Screenshots also advance frames.
- **Module caching:** after edits, run `await fetch(url, {cache: "reload"})` for each changed module, then `location.reload()`.
- **Syntax check:** run `node --input-type=module --check < file.js` on every JS file you touch. Plain `node --check` misses some errors.
- **Tests:** if you touch anything they import, run `for t in tests/*.mjs; do node $t; done`.
- **Owner priorities:**
  - science accuracy (classrooms use this);
  - a polished, realistic molecular-animation look, never toy-like;
  - plain, teacher-friendly wording, with Australian spelling.
- **Year lens:** use `lens.pick({ "y7-8", "y9-10", "y11", "y12"? })`.
- **Performance:** target school Chromebooks. No per-frame allocations.
- **Checks:** light and dark page themes, portrait 375×812 (reset to desktop afterwards), and the console.
- Don't commit. Report in under 300 words: what you did, what you checked, what's left.

**Add-on hook.** `assets/js/world/shell.js` calls `install(ctx)` on `teacherMode.js`, `revision.js` and `a11y.js` before the first level starts. The ctx is:

```
{ engine, panelEl, stageEl, header, lens, qs (URLSearchParams), root, graphicsCard, onChange(fn) }
```

`onChange(fn)` runs `fn(stack)` after every level change. `engine.current` is the level instance and has `.topics`. `engine.stack.at(-1).id` is the level id.

---

## 1 · Revision quiz (`revision`)
**Own:**
- `tools/build-revision-bank.mjs` (new);
- `content/revision.json` (generated);
- `assets/js/world/revision.js` (replace the placeholder).

**Source bank** (read-only): `../science-defender/js/questions*.js`, about 895 MCQs for Years 7–10. The audit found two biases:
- the correct answer is option B 57 % of the time;
- the correct answer is the longest option 69 % of the time.

**Build tool** (node, deterministic, re-runnable):
1. Extract the items. Keep only those that belong to CellScape's scope: cells, organelles, microscopy, membranes, photosynthesis and respiration at the cell level, enzymes, DNA, genes, inheritance, cell division, specialised cells, cell-level immunity and disease. Use keywords plus a manual allow/deny list written in the tool.
2. De-duplicate near-identical stems.
3. **Science-check every kept item yourself.** Fix or drop wrong keys and outdated claims, and list each one in your report.
4. Shuffle the options with a seeded shuffle. Then rebalance so each answer position is about 25 % across the bank.
5. Where "longest option = answer" is blatant, lengthen a distractor or trim the key. Keep the meaning.
6. Tag each item with year band and CellScape topics. Use the same topic tags as `content/syllabus.json` and the levels' `topics`.

**Output:** `content/revision.json` as `{ items: [{ id, band, topics[], q, options[], answer, why }] }`. Write a `why` where the source lacks one.

**Runtime (`revision.js`):**
- Add a "Revision quiz" card to `panelEl`, inserted just before the Syllabus links card.
- It shows about 5 random items matching the current level's topics and the lens band. Students see items from their own band and the band below; Years 11–12 see Year 9–10 items only as "warm-up".
- Show feedback with the `why` after each answer, plus "New questions" and a score.
- Hide the card if no items match. Re-render on level change and on lens change.
- Use `K.quiz` from `assets/js/kit.js` if it fits; otherwise match its look.
- Honour teacher mode: if `document.documentElement.dataset.teacherHideQuiz === "1"`, hide the card.

## 2 · Teacher mode (`teacher`)
**Own:**
- `teacher.html` (new);
- `assets/js/teacher.js` (new);
- `assets/js/world/teacherMode.js` (replace the placeholder);
- `assets/css/teacher.css` (new, link it from `teacher.html`, and inject it at runtime from `teacherMode.js`).

**`teacher.html`, a link builder for teachers.** Style it like `library.html` and use the site CSS. Teachers pick:
- a start level (all `LEVELS` from `shell.js`; levels below the cell open via a standalone sims page or the homepage, so see how `library.html` links them; the URL params you add must survive);
- a year band, or a syllabus dot point or school code (uses existing `?year=`, `?dot=`, `?code=`; read `content/syllabus.json` for a searchable list);
- options:
  - lock the year level (`lock=1`);
  - hide quizzes and revision (`noquiz=1`);
  - presentation mode (`present=1`);
  - start paused (`paused=1`);
  - clay look (`look=clay`).

The page then shows:
- the URL;
- a copy button;
- a **QR code** for the projector. Write a small dependency-free QR encoder (byte mode, ECC level M, versions up to about 10 are enough), or vendor a tiny MIT one into `assets/vendor/`. **No CDN at runtime.**
- a short "how to use in class" panel.

Link to the teacher page from `library.html`: give the snippet in your report, and I'll add it.

**`teacherMode.js`** reads the params from `ctx.qs`:
- **`lock=1`:** disable the year select, with a tooltip saying why.
- **`noquiz=1`:**
  - set `document.documentElement.dataset.teacherHideQuiz = "1"`;
  - add CSS that hides `.quiz` cards (check the class `K.quiz` uses in `kit.js`);
  - keep missions visible.
- **`present=1`:**
  - larger 3D labels and panel text (via CSS scale on `.label` and the panel);
  - hide the hint line;
  - a "Hide panel" toggle button on the stage that expands the canvas full-width (trigger a resize);
  - keyboard: `p` toggles the panel.
- **`paused=1`:** pause once the first level is mounted. The pause button state must update: click it, or replicate its logic.
- **`look=clay`:** set the look before the start; see how `shell.js` reads localStorage `cellscape.look`. You can't edit `shell.js`, so call `engine.setStyle("clay")` after the start.

## 3 · Accessibility and keyboard (`a11y`)
**Own:**
- `assets/js/world/a11y.js` (replace the placeholder);
- `assets/css/a11y.css` (new, injected at runtime by `a11y.js`);
- small, surgical edits to `assets/js/kit.js`, `assets/css/cellscape.css` and `assets/css/world.css` **for accessibility only**.

**Do:**
- **"Explore" list.** A collapsible card or a stage button that lists the current level's clickable parts and portals as real buttons. Read `engine.current.pickables`, `.portals` and `.info(obj)` to get names, and dedupe by title.
  - Focus or Enter selects the part: call the level's `onSelect(info)` the way engine picking does. Read `engine.js` to replicate selection without editing it.
  - A portal entry dives.
  - The list is announced to screen readers.
- **Keyboard on the stage canvas** (when the stage is focused):
  - arrow keys orbit, via `engine.controls` rotate helpers or by moving the camera around the target;
  - `+` and `-` zoom;
  - Enter dives into the selected portal;
  - Escape or Backspace goes up (`engine.up()`);
  - Space pauses.
  - Show a small keyboard-help tooltip on focus.
- **Screen readers:** an `aria-live="polite"` region that announces level changes and toasts. Check how `K.toaster` works.
- **Focus and contrast:** visible focus rings everywhere (`:focus-visible`), and a skip link "Skip to controls" that jumps to the panel.
  - Audit colour contrast of text in both themes (WCAG AA 4.5:1 for body text) and fix offenders in the CSS.
  - Check that all buttons have accessible names and segmented controls use `aria-pressed`.
- **Reduced motion:** honour `prefers-reduced-motion`. `engine.reducedMotion` exists; check where it's set, and make sure the stage hint mentions keyboard use.

## 4 · Performance tiers (`perf`)
**Own:**
- `assets/js/world/engine.js`;
- `assets/js/world/materials.js`;
- `docs/perf-report.md` (new).

**Fix the follow-up "Fast quality setting doesn't reduce geometry".**
1. Measure first. For each level, record `renderer.info.render` (calls, triangles) and `renderer.info.memory` at each quality tier, plus frame time at 1× pixel ratio.
   - Levels are reached via dives; see `LEVEL_BRIEF.md` and `docs/HANDOVER.md`.
   - Use `?cell=animal` for the animal-side levels.
   - Write the table to `docs/perf-report.md`.
2. **Fast tier:**
   - pixel ratio 1 (or below 1 on very weak devices);
   - no bokeh;
   - no bloom, or cheap bloom;
   - lower shadow or env-map cost;
   - `MeshPhysicalMaterial` features (clearcoat, sheen, transmission) downgraded via a central hook in `materials.js`. Materials are created by `physical()` and `glass()`, so tier-aware creation or a traverse that swaps expensive features on tier change, restoring them exactly, like `style.js` does for clay.
3. **Generic geometry reduction without editing levels:** on Fast, an engine-level pass over the mounted root may set `InstancedMesh.count` lower for meshes the level marks `userData.lod = true`. Since no level marks that yet, add a documented API instead: `engine.tier` ("high", "medium" or "low") and `engine.lodScale` (1, 0.75 or 0.5). List in the report which levels should adopt it, with the heaviest first.
4. **Adaptive quality:** the existing auto step-down. Check it works: measure FPS over a few seconds, step down once, never step back up automatically, and respect `lockQuality`.
5. **Don't break:** `swapRoot`, dive/up transitions, microscope mode (`microscope.js` uses the engine), clay style.

## 5 · Layout fixes (`layout`)
**Own:**
- `assets/js/world/levels/immunity.js`;
- `assets/js/world/levels/animalCell.js`;
- `sims/mitosis/level.js`;
- `assets/js/world/levels/specialised.js`;
- `assets/js/world/levels/nucleus.js`.

**Fix the `docs/PLAN.md` follow-ups:**
- The mitosis phase strip (Cytokinesis/G1) sits under the Microscope button in narrow stages. Reflow or wrap the strip, or inset it from the bottom-right buttons; check the stage at 520 px and 375 px wide.
- In portrait, immunity's "Breach in the barrier" label and the animal cell's "Rough ER" label overlap the HUD chips at the top. Keep labels below the chip rows: offset them, hide them when they collide, or clamp to below the overlay's bottom edge.
- In portrait the specialised muscle fibre is small and its "Truncated…" label is clipped. Fix the framing and label placement.
- The nucleus legend's "Transcription/s" swatch is grey while its line is black. Make them match in both themes. `K.chartCol` exists in `kit.js`; legend swatches are inline styles, and `cellscape.css` darkens them in light mode.
- The animal cell in portrait: a label can overlap the top chips (same fix as above).

Then do a **portrait pass on every level you own**: framing on arrival, labels and buttons. Fix what you find.

## 6 · "Sun and shade leaf" mission (`leaf`)
**Own:**
- `assets/js/world/levels/cell.js`;
- `assets/js/world/levels/cellContent.js`;
- `assets/js/world/levels/plantCellModel.js`.

Add a guided **mission chain on the plant cell**, based on the cellarium idea of a day/night cycle with respiration continuing in the dark. The flow:
1. A **day/night cycle** control: light follows a smooth daily curve, or stays as a manual slider. Include a "Time of day" readout.
2. A **sun leaf vs shade leaf** choice that changes the cell's parameters:
   - sun leaves have more chloroplasts per cell and thicker palisade, a higher light-saturation point, and a higher respiration rate;
   - shade leaves have bigger grana and more chlorophyll per chloroplast, saturate at low light, and have a lower compensation point.
   - Use the model's existing photosynthesis and respiration fluxes, and the stomata/CO₂ if present (read `plantCellModel.js`).
3. **Missions:**
   1. find the light compensation point (net O₂ exchange = 0) for each leaf type;
   2. keep the cell's sugar stores positive over 24 h at a given light level, which shows respiration continues at night;
   3. show that the shade leaf wins at low light and the sun leaf wins in full sun;
   4. (Y9–10+) stomata close in hot, dry conditions, so CO₂ limits photosynthesis.
4. **A net exchange chart over 24 h:** O₂ produced minus consumed, and sugar store. The narrative is driven by the actual fluxes; no scripted claims.
5. **Science:** net exchange depends on the balance of photosynthesis and respiration. Plants respire all the time. Compensation-point values are teaching-scale, and the page says so.

All four bands get wording.

## 7 · Clay style polish (`clay`)
**Own:**
- `assets/js/world/style.js`;
- small clay-only hooks in these levels:
  - `assets/js/world/levels/chloroplast.js`, `mitochondrion.js`, `dna.js`, `folding.js`, `chromatin.js`, `karyotype.js`, `inheritance.js`, `epigenetics.js`;
  - `sims/membrane-transport/level.js`, `sims/photosynthesis/level.js`, `sims/atp-synthase/level.js`, `sims/enzymes/level.js`, `sims/protein-synthesis/level.js`, `sims/meiosis/level.js`.
- **Don't touch:** cell, animal, immunity, specialised, mitosis or nucleus; other builders own those.

**Read** `docs/briefs/clay-style.md` and how the plant and animal PoC look. In the browser, switch Graphics → Look → Clay model.

**Fix the `docs/PLAN.md` clay follow-ups:**
- molecular levels lose their custom shaders and glows;
- the clay wall texture is slightly grainy.

Then visit every level you own in clay and make it read as a **deliberate, charming clay diorama**: pastel matte materials, soft rim light, readable colour coding that keeps the realistic version's colour meanings. No black or untextured parts, and no invisible key structures.
- Prefer generic improvements in `style.js`, such as rules by `userData.kind` or material name, and opt-in per-level hooks like `level.clay?.(on)`.
- Clay must restore the realistic look **exactly** when switched back.

Check each level: real → clay → real, and the console.
