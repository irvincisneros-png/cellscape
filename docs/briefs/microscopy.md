# Builder brief: Microscopy mode

**Syllabus.** Y7 3.2.5 and 3.2.11: observe cells with a light microscope, prepared slides, magnification, stains. Y7 3.2.7: biological drawing with a scale. Biology Y11 Module 1: compare light and electron microscopes, resolution vs magnification, calculate cell size.

**Owner priorities.** Science accuracy and a polished, realistic look.

## Read first
- `LEVEL_BRIEF.md`.
- `assets/js/world/engine.js`: render loop, `setupPost` (composer with Bokeh and Bloom), `applyEnv`, `metersPerUnit()`, `updateScale`, `setStyle`.
- `assets/js/world/style.js`: how the clay style swaps materials and env, and restores them exactly. Follow the same discipline.
- `shell.js`: a "🔬 Microscope" stage button already calls `import("./microscope.js").then(m => m.toggle(engine, scopeBtn))`.
- `levels/cell.js` and `levels/animalCell.js`.

**Absorb from the owner's LifeLens repo** (audit clone, read-only):
`/private/tmp/claude-501/-Users-irvincisneros-Documents-Local-Projects-Science-Simulator-Website/f53b06d0-9e95-448e-9b94-69d20b1787b7/scratchpad/audit/LifeLens/`
- `src/science/microscope/engine.ts`, `measurement.ts` and `types.ts`. These model magnification as eyepiece 10× × objective (4×, 10×, 40×, optionally 100× oil), field of view inversely proportional to objective, specimen-space scale bars, coarse focus disabled at 40×, and centring before raising power. Read them before reusing them.
- `src/data/microscope-assets.ts`: provenance for each micrograph.
- `public/specimens/`: the deployed micrographs. **Use only these three:**
  - onion epidermis: OpenFlexure, CC BY 2.0;
  - cheek cells: Aholderfield, CC BY 4.0;
  - E. coli SEM: CDC PHIL 7136, public domain.
- **Skip** the paramecium (its public-domain claim is unverified) and the fungal hyphae (a human pathogen, *Blastomyces*).
- Copy the three images into `assets/specimens/`, resized to at most 1600 px and compressed. Show visible attribution (creator, licence, source link) wherever they appear. CC BY requires it.

## Files (only these)
- Fill `assets/js/world/microscope.js` (the stub exports `toggle(engine, btn)`).
- Create `assets/js/world/microscopeContent.js`.
- Create `assets/specimens/*`.
- Make a **small** edit to `engine.js`, only if needed: a hook to insert or remove a post-processing pass, and to let the microscope own the camera framing while it's active. Keep it minimal and say exactly what you changed.
- Edit `cell.js` and `animalCell.js` only for optional per-level microscope hints:
  - `level.microscope = { lm: {...}, em: {...} }` for stain colours per organelle kind;
  - which parts are visible in LM;
  - the specimen to compare with: onion for the plant cell, cheek for the animal cell.
- **Don't touch** `shell.js`, the CSS files, `theme.js`, the specialised-cells files, or any `<style>` strings in levels. Another builder is converting colours right now.

## Behaviour
The toggle opens a microscope overlay on the current level, and the cell keeps running underneath. There are two modes, chosen with a segmented control in a floating stage panel or a panel card.

1. **Light microscope (LM)**
   - **Look:** a circular field of view with soft vignette edges and brightfield illumination: a bright, slightly warm background. Use a post-processing pass that inverts or remaps the dark stage to a bright field and converts the cell to absorbance-style colours.
   - **Stains** (selectable):
     - unstained: low contrast, like phase or brightfield;
     - iodine: starch blue-black, nuclei and cytoplasm yellow-brown; plant cell;
     - methylene blue: nuclei dark blue, cytoplasm pale blue; animal cell.
   - **Resolution limit.** Blur everything to the LM limit, about 0.2 µm. Use the engine's `metersPerUnit()` to convert to pixels at the current zoom. Structures smaller than the limit (ribosomes, ER membranes, Golgi cisternae, cristae, centrioles, microtubules) must be invisible or appear only as texture. Visible: wall, membrane outline, nucleus, nucleolus (faintly), chloroplasts, the vacuole as clear space, and mitochondria only as tiny specks at high power.
   - **Controls:**
     - Objective: 4×, 10×, 40×, and 100× oil for Y11+. With the 10× eyepiece that gives 40×, 100×, 400× and 1000× total. Changing objective changes the camera zoom so the field of view matches. Field-of-view diameter is roughly 4.5 mm at 40×, 1.8 mm at 100×, 0.45 mm at 400× and 0.18 mm at 1000×; check the LifeLens constants and use consistent values.
     - Fine focus: a slider that moves a thin optical-section plane through the cell. Use two clipping planes or a depth-based blur. Note that Bokeh ignores clipping, so in microscope mode disable Bokeh or handle it.
     - Light intensity.
   - **Readouts:** total magnification, field-of-view diameter, an on-image scale bar in µm, and "smallest detail you can see ≈ 0.2 µm".
2. **Electron microscope (TEM)**
   - **Look:** greyscale, high contrast, a thin-section look: a slice through the cell, membranes dark. Show fine detail: ER, Golgi, cristae, ribosomes as dots. Resolution about 0.5–2 nm for biological samples in practice; say about 1 nm.
   - **Magnification:** up to ×50,000 or more, mapped to the engine's zoom.
   - **Required honesty note:** real TEM needs dead, thin, stained (heavy-metal) sections in a vacuum, so you can't watch living cells. Our view is a model.
   - SEM is optional and mentioned in text only. The E. coli SEM image appears in the compare panel as an example.

**Compare panel.** Show the real micrograph next to the model view: onion epidermis for the plant cell and cheek cells for the animal cell. Add questions such as "What can you see in the real image? What can't you see that the model shows?"

**Measuring tool (Y7–Y11).** Click-drag a ruler on the field of view. It shows length in µm using the current scale. Include a "Calculate the cell's size" mission: cells across the field of view, giving cell size = FOV diameter ÷ number of cells.

**Biological drawing tips (Y7–8).** A short card: pencil, no shading, label lines, title, magnification and scale.

**Year lens.**
- **Y7–8:** parts of the microscope in a mini labelled diagram, plain-words magnification, stains, what you can and can't see.
- **Y9–10:** adds magnification calculation and FOV.
- **Y11–12:** resolution vs magnification (the Abbe limit idea: about half the wavelength of light), LM vs TEM vs SEM, artefacts, sample preparation.

**Missions (5) and quiz (5), per band.**

**Exit.** Turning microscope mode off restores the camera, post-processing, env and materials **exactly**. Dives and climbs while it's on either carry it into the new level or switch it off cleanly; pick one and document it. Recommended: carry it to cell and organelle levels, and switch it off with a toast on molecular levels ("Below the resolution of a light microscope; try the electron microscope").

## Verify, then report
- Run `node --check`.
- At http://localhost:8420, use your own new tab and call `tabs_select` on it before animation tests. Other builders share the pane; never touch their tabs.
- Test the plant and animal cells in LM with each stain and objective, focus, ruler and TEM.
- Toggle off and confirm an exact restore. Also test with clay style on, portrait 375×812, and the console.
- Screenshot each mode.
- Don't commit.
- Report in under 300 words: files, the engine change, the optics numbers used, and science points you're unsure of.
