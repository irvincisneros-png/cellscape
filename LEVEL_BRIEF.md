# CellScape — Level Brief (3D world, Phase 2+)

CellScape is now a single multi-scale 3D world: **plant cell → organelle → molecular**. Students right-drag (or drag empty space) to orbit, scroll/pinch to zoom (toward the cursor), click to select, double-click or zoom into a "portal" to dive in, and zoom out past a level's limit to climb back up. Read `docs/PLAN.md` and `docs/IDEAS.md` for the owner's vision. The core idea is **interactions, not labels**: every level is a working system where students change something and see the cause-and-effect chain.

Read these fully before writing code:
- `assets/js/world/engine.js`: renderer, camera, controls, level stack, `dive()`/`up()`, picking, labels (`engine.label`, `engine.place`), `disposeTree`.
- `assets/js/world/shell.js`: the page shell and level registry (`LEVELS`).
- `assets/js/world/lens.js`: the year-level lens (`lens.pick`, `lens.filter`, `lens.atLeast`, bands `y7-8`, `y9-10`, `y11`, `y12`).
- `assets/js/world/materials.js`: `physical()`, `glass()` (fresnel membranes), `specks()`, `paint()`, `wobble()`, `hash()`, `softDot()`.
- `assets/js/world/levels/cell.js`, `plantCellModel.js`, `cellContent.js`: **the reference level**. Copy its patterns.
- `sims/membrane-transport/level.js` + `scene3d.js`: a molecular level wrapping an existing tested 2D model.
- `assets/js/kit.js` (panel UI helpers: `card`, `slider`, `button`, `segmented`, `checkbox`, `chip`, `missions`, `quiz`) and `assets/css/world.css`.
- `content/syllabus.json`: NSW dot points with topic tags.

## Level module contract

A level is an ES module exporting `create(engine, ctx)`, which returns an object with these fields:

| Field | Purpose |
|---|---|
| `title` | breadcrumb text |
| `topics` | syllabus topic tags; drives the "Syllabus links" card |
| `root` | `THREE.Group`; the engine adds and removes it |
| `pickables` | meshes that can be hovered and clicked |
| `fallbackPickables` (optional) | only picked when nothing else is hit |
| `portals` | `[{ to, label, object, objects?, radius, center: () => Vector3, auto?, fallback? }]` |
| `entryRadius` | **Organelle levels only.** Bounding radius, in this level's units, of the magnified copy of the organelle centred at the origin. The engine maps the camera so the dive feels continuous, and derives the scale bar from the parent's portal radius. |
| `metersPerUnit` | **Molecular levels.** An explicit scale. Omit it when using `entryRadius`. |
| `view` | `{ target, distance, dir }`; a getter is fine (adapt `distance` to `engine.camera.aspect` so portrait phones see the subject) |
| `minDistance`, `maxDistance`, `near`, `far`, `minPolar`, `maxPolar`, `enablePan`, `leftDragRotate` | camera limits |
| `env` | `{ bg: [top, bottom, accent], fog: [color, density], exposure, bloom: [strength, radius, threshold], aperture }` |
| `info(obj)` | returns `{ title, kind, portal }` or `null` (hover tooltip and selection) |
| `onSelect(info)` | show a "Selected" card |
| `onClick(e, hit)`, `onPointerDown(e, hit)`, `onPointerUp(e)`, `onHover(obj)` | return `true` from `onClick`/`onPointerDown` to consume the event |
| `mountPanel(el)` | Build **once** and re-attach on later mounts so missions and quiz progress survive dives. Rebuild only on lens change. |
| `unmountPanel()` | hide labels, remove overlay chips and stage DOM |
| `onResume()` | parent level re-mounted after returning from a child |
| `onLens(band)` | rebuild text, missions and quiz for the new band |
| `update(dt, t)` | `dt` is 0 when the engine is paused; honour `engine.reducedMotion` (no decorative drift) |
| `dispose()` | remove DOM and global listeners; the engine calls `disposeTree(root)` for GPU memory, so mark shared textures `userData.shared = true` |

Panel cards go in the `el` given to `mountPanel`. Overlay chips go in `engine.overlay` (clear yours on unmount). 3D labels use `engine.label(html, cls)` + `engine.place(el, worldVec)`. Toasts use `engine.toast`.

**Performance (school Chromebooks):** no per-frame allocations in hot loops (reuse Vector3/Quaternion/Matrix4). Use InstancedMesh for repeated parts. Keep particle counts at or below about 300 per level. `shadowBlur` doesn't exist here, but transparent overdraw does, so keep big glass shells few.

## Content and science
- Every text string that differs by year: `{ "y7-8": ..., "y9-10": ..., "y11": ..., "y12"?: ... }`. Years 7–8 use plain words; Years 11–12 use correct senior terminology. Australian spelling.
- Missions (5–6) and quiz (5–6) items carry `band` / `maxBand` and are filtered with `lens.filter`.
- **Science accuracy is critical.** Classrooms will use this. Round 1 of an adversarial review caught these misconceptions; don't repeat them:
  - glycolysis happens in the cytosol;
  - ~30 ATP is the whole glucose yield;
  - mRNA is reused, not consumed;
  - cellulose is made at the plasma membrane;
  - net O₂ exchange depends on the balance of photosynthesis and respiration;
  - water moves by water potential, so turgor reaches equilibrium;
  - narrative text must be driven by the model's actual fluxes, not just switch states.
- A "What's happening" card whose text is generated from model state (like `cellContent.js` `narrative()`).
- **Reuse the existing, reviewed 2D model** (`sims/<slug>/model.js` or the model section of its `sim.js`) wherever one exists, so the science stays consistent.

## Standalone page for a converted simulation
Each converted sim keeps `sims/<slug>/index.html` but boots the 3D shell. Copy `sims/membrane-transport/index.html`: WebGL2 probe, `boot({ start: "<levelId>", root: "../../" })`, and on failure a 2D fallback. Rename the old `sim.js` to `sim2d.js` and keep it working as that fallback. Its old `index.html` markup (header with `h1`/`.tag`, `#canvas`, `#overlay`, `#panel`) must still satisfy `sim2d.js`.

## Rules
- Only create or edit files listed in your task. **Do not edit** `engine.js`, `shell.js`, `lens.js`, `materials.js`, `cell.js`, `cellContent.js`, `plantCellModel.js`, `kit.js` or the CSS files. If you need an engine change, describe it in your report. You may add level-local CSS with an injected `<style id="...">` like `sims/membrane-transport/level.js` does.
- Levels are already registered in `shell.js` `LEVELS` with the ids and paths in your task.
- Verify: `node --check` every JS file. A static server runs at http://localhost:8420 (root = `cellscape/`). With browser tools, open **your own new tab**, check the console, and test the dive from its parent level:

  ```js
  const e = window.cellscape.engine;
  await e.dive(e.current.portals.find(p => p.to === "<id>"));
  ```

  Also test zooming out (`await e.up()`), a portrait viewport (375×812), and your missions. Close your tab when done.
- Report: what you built, model equations and assumptions, science points you're unsure of, and any engine changes you need.

## Notes added after Phase 2
- The engine calls `update(simDt, simTime, realDt)`. `simDt` is 0 and `simTime` freezes while paused, so use `realDt` for UI refresh timers.
- `engine.fly()` called by a level counts as deliberate framing, so it is kept on resize.
- The Python dev server sends no cache headers. When re-testing edited modules, reload with cache-busting, e.g. `await fetch(url, {cache: "reload"})` for each changed module, or open a fresh tab.
- Levels may share state with their parent through a `shared` object or by reading `engine.stack.at(-2).inst` (see `levels/mitochondrion.js` ↔ `sims/atp-synthase/level.js`, and `levels/chloroplast.js` ↔ `sims/photosynthesis/level.js`).
- Genetics pathway (Phase 3). The chain is: plant cell → `nucleus` → `chromatin` → `dna` → `expression` → `folding`. Every level uses the **same gene**: a simplified fragment of human β-globin, `ATG GTG CAC CTG ACT CCT GAG GAG AAG TAA` (Met-Val-His-Leu-Thr-Pro-Glu-Glu-Lys + stop). Codon 6 (GAG → GTG, Glu → Val) is the sickle-cell mutation. It is already used in `sims/protein-synthesis/model.js`. Keep a single source of truth by importing from that module. **Be honest that it is a human gene shown inside a plant cell for teaching** (e.g. a "Model gene" note), as the membrane level does for its animal proteins.
