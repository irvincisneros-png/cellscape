# Builder brief: Specialised cells level

**Syllabus.** Y7 3.2.8, 3.2.9 and 3.2.10: the role of specialised cells, the arrangement of cells in tissues and organs, and structure–function for a range of specialised cells. Y8 5.1.4. Biology Y11 Module 1–2: cell differentiation, tissues, organs and systems, SA:V.

**Owner priorities.** Science accuracy and a **highly polished, realistic molecular-animation 3D look**: organic shapes, translucent fresnel materials, crowding, subtle motion. Nothing toy-like.

## Read first
- `LEVEL_BRIEF.md`.
- `assets/js/world/levels/animalCell.js`, the newest and best patterns: panel, missions and quiz, the morph hooks, instancing.
- `assets/js/world/materials.js` and `assets/js/world/style.js`. In clay style your meshes get swapped automatically. Make sure that looks fine, and use `userData.clayColor` where it helps.

**Content to absorb** (read-only):
- LifeLens: `/private/tmp/claude-501/-Users-irvincisneros-Documents-Local-Projects-Science-Simulator-Website/f53b06d0-9e95-448e-9b94-69d20b1787b7/scratchpad/audit/LifeLens/src/data/cell-specialisation-provenance.json`. It has 6 cases with feature, function and limit statements, plus 5 hierarchy chains. The wording is careful; reuse it.
- Year-7: `.../scratchpad/audit/Year-7/cells-classification/content.jsx`, `SpecialisedCellMatcher` around L634. Use it for the item list only.

**Known errors in that Year-7 source. Don't copy them:**
- "microvilli increase absorption surface area up to 600×" is wrong. That figure is folds, villi and microvilli combined; microvilli alone give about 20×.
- Root hair cells take in water by **osmosis**, not "diffusion and active transport". Minerals are taken in by active transport.
- Red blood cells have no mitochondria and no nucleus when mature, so don't write "all cells have…".

**Create only:** `assets/js/world/levels/specialised.js`, plus optional `specialisedContent.js`.

Already done by me:
- `specialised` is registered in `shell.js`.
- The plant and animal cell panels dive here via `engine.dive({to:"specialised", ...})`.
- Read `engine.stack[0].id` (`cell` or `animal`) to pick which kingdom to show first.

## Concept
A "gallery of specialists": a curved 3D shelf or carousel of specimens at true relative scale where feasible, with a scale bar. A sperm is about 50 µm long, a red blood cell about 7.5 µm, and a neuron's axon can be up to a metre, so show it truncated and say so. Clicking one flies to it.

Each specialist has **one interactive structure → function demo**, driven by a small model, with the narrative generated from that model:
1. **Red blood cell.** Biconcave disc, no nucleus or mitochondria when mature, packed with haemoglobin.
   - Demo: a shape slider (sphere → biconcave) with live SA:V and O₂ loading time.
   - Demo: squeezing through a capillary narrower than the cell, about 3–5 µm, shows its flexibility.
2. **Neuron (motor).** Dendrites, cell body, long axon, myelin sheath with nodes of Ranvier, synaptic terminals.
   - Demo: send an impulse and toggle myelin. Saltatory conduction is faster. Use speeds of roughly 1–2 m/s unmyelinated thin fibres vs up to ~100 m/s large myelinated fibres.
3. **Skeletal muscle fibre.** Long, multinucleate, striated, packed with mitochondria.
   - Demo: contract it so sarcomeres shorten (Y11: actin/myosin sliding filaments, ATP), and show fatigue when ATP runs low.
4. **Sperm cell.** Head with nucleus (haploid) and acrosome, a midpiece packed with mitochondria, a flagellum.
   - Demo: swimming, with speed linked to ATP from the midpiece mitochondria.
5. **Ciliated epithelial cell** (airway). Cilia beat in waves to move mucus.
   - Demo: beat on/off, mucus and trapped particles moving; mention smoking paralysing cilia (Y9+).
6. **Root hair cell.** A long extension greatly increases surface area; no chloroplasts.
   - Demo: water enters by osmosis and mineral ions by active transport (ATP); there's a hair length slider with an uptake readout.
7. **Palisade mesophyll cell.** Column-shaped, packed with chloroplasts near the upper leaf surface.
   - Demo: a light slider with photosynthesis rate. Optional: chloroplasts redistribute (chloroplast avoidance in high light, Y11).
8. **Guard cells.** A pair around a stoma.
   - Demo: water in, turgor up, the stoma opens; water loss closes it. Thicker inner walls make the cells bow. Y11: driven by K⁺ uptake.
9. **Xylem vessel element** (optional). Dead at maturity, lignified walls, end walls lost, forming a continuous tube; water moves up.

**Hierarchy ladder.** Cell → tissue → organ → system → organism, as zoom-out steps:
- for a muscle fibre: muscle tissue → a muscle (biceps) → musculoskeletal system → human;
- for a palisade cell: mesophyll tissue → leaf → shoot system → plant.

Use simplified but tasteful 3D or illustrated layers. This covers Y7 3.2.9.

**Differentiation note (Y9+).** All these cells come from the same genome; different genes are switched on (link: nucleus/epigenetics). Stem cells: Y11.

**Year lens.**
- **Y7–8:** plain words, the match-the-job game, the hierarchy.
- **Y9–10:** adds SA:V numbers and adaptation explanations.
- **Y11–12:** adds mechanisms: saltatory conduction, sliding filaments, K⁺ in guard cells, and the hepatocyte link back to the animal cell.

**Missions (6) and quiz (6), banded.** Examples: make the RBC carry O₂ fastest; speed up the nerve impulse; open the stoma; match each cell to its job (drag cards to cells).

Include an honest note on simplifications and scale.

## Verify, then report
- Run `node --check`. Run a node test for any small models.
- At http://localhost:8420, use your own new tab and call `tabs_select` on it before animation tests. Other builders share the pane; never touch their tabs.
- Dive in from both the plant cell and the animal cell. Check each specialist demo, all 4 bands, portrait 375×812, up/back, clay style on and off, and the console.
- Take screenshots and polish until it's realistic.
- Don't commit.
- Report in under 400 words: files, the models and numbers used, and science points you're unsure of.
