# Builder brief: "Clay model" art style, proof of concept

The owner wants an optional, switchable art style inspired by AI "clay diorama" cell videos. Reference screenshots (view them):
- `/Users/irvincisneros/.claude/uploads/f53b06d0-9e95-448e-9b94-69d20b1787b7/d207c18a-image.png`: a whole cell cut in half, on a pedestal.
- `.../5edf92be-image.png`
- `.../95281d1b-image.png`
- `.../31eceb94-image.png`
- `.../03ebcbc3-image.png`
- `.../62d05658-image.png`
- `.../aaee2f8f-image.png`

These are membrane close-ups. All files are in that same folder.

**What makes the look:**
- matte pastel plasticine or clay surfaces with a fine bumpy, slightly glossy texture;
- a pastel palette (lilac, periwinkle and sky blue, peach and salmon, cream, mint);
- soft bright studio lighting on a warm light-grey backdrop;
- soft contact shadows and ambient occlusion;
- shallow tilt-shift depth of field;
- **the cell cut in half** like a classroom model, with a solid blue cytoplasm "floor" and organelles sitting in and on it.

The current realistic style stays the **default**. Clay is a toggle.

Read first: `LEVEL_BRIEF.md`, `assets/js/world/engine.js` (render loop, `applyEnv`, `setupPost`, `setQuality`, `mount`), `shell.js` (the Graphics card), `materials.js`, `levels/cell.js`, `levels/animalCell.js`.

## Scope (proof of concept)
Engine-wide switch and polish on the **plant cell (`cell`)** and **animal cell (`animal`)** levels. Other levels must still work with clay on: the generic material swap applies, and they may look rougher. List what each would need.

## Files you may edit/create
- Create `assets/js/world/style.js` for the style system.
- Edit `engine.js`: hook the style into `mount`/`applyEnv` and post-processing; add an AO pass if affordable.
- Edit `shell.js`: a "Look: Realistic | Clay model" segmented control in the Graphics card, persisted in localStorage (wrap in try/catch).
- Edit `cell.js` and `animalCell.js`: an optional `style` hook per level (see below).

**Don't touch** `nucleus.js` or `shell.js` LEVELS. Don't touch new files other builders are writing right now: `karyotype.js`, `inheritance.js` and their content/model files.

## Design
- **`engine.setStyle(name)`:**
  - `"real"` or `"clay"`; it re-applies to the current level.
  - Each newly mounted level gets the current style, so dives keep it.
  - It calls `inst.onStyle?.(name)` so levels can customise.
- **Generic clay swap** (`style.js`):
  - Traverse `inst.root`. For each Mesh or InstancedMesh, store the original material in `userData.realMat` and assign a clay `MeshPhysicalMaterial`.
    - Base colour comes from the original hue, remapped to the nearest pastel in a curated palette table. Keep hue identity so mitochondria stay orange/peach and chloroplasts green/mint.
    - roughness about 0.55–0.7, a small clearcoat, sheen.
    - A shared tiling **clay normal/bump map**. You may generate a seamless clay or plasticine micro-texture with Codex image generation: `codex-image --out assets/textures/clay-normal.png "seamless tileable fine plasticine clay surface height map, grayscale, subtle fingerprint-free bumps, top-down, even lighting"`. Then convert height to normal locally with a tiny script, or use it as `bumpMap`. Keep it ≤ 512 px and mark it `userData.shared = true`. If Codex isn't available, generate the noise procedurally on a canvas.
    - Opaque, except things that truly need to be see-through.
  - **Points, additive sprites and glows:** hide in clay mode, or convert to small matte instanced clay spheres where they carry meaning (e.g. flow particles).
  - Restore exactly on switching back. Cache clay materials per original material so switching is cheap. Dispose the cache on level dispose.
  - Materials with custom shaders (glass via `onBeforeCompile`, ShaderMaterials): the swap replaces them. Levels with special shader effects can opt out per mesh with `userData.keepMaterial = true`.
- **Clay env:**
  - background gradient a warm light grey or beige (e.g. `#e9e4df` → `#cfc8c2`);
  - fog off or very light;
  - bloom off;
  - exposure tuned;
  - a soft key light plus fill plus hemisphere light, added while clay is on and removed after;
  - stronger tilt-shift bokeh on Cinematic;
  - an AO pass (three r169 has `GTAOPass`/`SAOPass` in `three/addons/postprocessing`; check what's vendored under `assets/vendor/three`) on Cinematic only. Falls back gracefully on Balanced/Fast.
  - Optional soft shadow-catcher plane ("pedestal") under the cell.
- **Cell levels: the cutaway is the key feature.** In clay mode `cell.js` and `animalCell.js` show the cell **cut in half**:
  - Clip the outer shells (membrane, wall, nucleus envelope, vacuole, neighbour cells) with a clipping plane, using `renderer.localClippingEnabled` and per-material `clippingPlanes`. The plane is roughly horizontal through the cell centre, so you look down into it like the reference.
  - Add a solid **cap/floor**: a pastel-blue clay slab for the cytoplasm at the cut, with a visible membrane rim. Show the plant cell's wall and membrane layers as distinct coloured bands at the cut edge.
  - Hide organelles above the plane, or let them sit on the floor. Keep enough inside to read.
  - Neighbour cells: hide them, or show them as softly cut clay blocks.
  - Flows can stay as small clay beads.
- **Labels and UI:** unchanged. Check they stay readable on the light background, since the CSS label style is dark pill.

## Constraints
- **Performance:** switching style must not leak GPU memory. It must hold a usable frame rate on Balanced.
- **Science:** clay is a stylisation. Don't add phospholipid beads at whole-cell scale. The membrane is a thin coloured rim at cell scale.
- **Reduced motion and pause:** still respected.

## Verify, then report
- Run `node --check`.
- Use http://localhost:8420 in your own new front tab. The tab must be in front or requestAnimationFrame stalls. Cache-bust after edits.
- Check these:
  - toggle clay on the plant cell and the animal cell;
  - swap plant ⇄ animal with clay on;
  - dive into the nucleus, membrane and mitosis with clay on, then come back up;
  - toggle back to realistic, which must be an exact restore;
  - all three quality settings;
  - portrait at 375×812;
  - the console.
- Take screenshots and iterate until the clay cell genuinely resembles the reference look.
- Don't commit.

Report briefly: files changed (with line counts), how the swap works, perf notes, per-level follow-ups, and any texture you generated (path and how it was made).
