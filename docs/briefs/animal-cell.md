# Builder brief: Animal cell level (Phase 5a)

Read first: `LEVEL_BRIEF.md` (the contract and rules), `docs/superpowers/specs/2026-10-09-animal-cell-design.md` (especially "Visual quality bar"), and the reference level `assets/js/world/levels/cell.js` + `plantCellModel.js` + `cellContent.js`. **Copy cell.js's patterns closely**: panel, chips, flows, labels, tours, missions, quiz, selection card, `progress` re-attach and lens rebuild.

## Files you create (only these)
- `assets/js/world/levels/animalCell.js`: the level (`create(engine)`)
- `assets/js/world/levels/animalCellModel.js`: whole-cell model, no DOM, testable with node
- `assets/js/world/levels/animalCellContent.js`: `ORGANELLES`, `SWITCHES`, `FLOWS`, `MISSIONS`, `QUIZ`, `COMPARE`, `narrative(m, band)`

You may *import* from `cellContent.js` (e.g. reuse shared organelle text such as nucleus/ER/Golgi entries) but **do not edit** it, `cell.js`, the engine, shell, kit, materials or CSS. Already done by me (don't redo):
- `animal` is registered in `shell.js` `LEVELS` → `./levels/animalCell.js`.
- `engine.swapRoot(id)` exists (see engine.js). `?cell=animal` boots straight into your level.
- mitosis/meiosis/membrane read `engine.stack.at(-1).inst.species` / `.id === "animal"`.

## Level object essentials
- `title: "Animal cell"`, `species: "animal"`, `model: M` (must expose numeric `M.atp` 0–100 and `M.on.mitochondrion`, because mitosis reads `parentInst.model.atp` and shares the mitochondria switch).
- Units: 1 world unit = 1 µm, `metersPerUnit: 1e-6`.
- `topics`: include `"cell-structure", "organelles", "respiration", "atp", "osmosis", "protein-synthesis", "membrane-transport"` (check the tags actually used in `content/syllabus.json` and use the matching ones).
- `env`: a warm tissue palette, distinct from the plant cell's teal/green, e.g. deep wine/plum background, warm fog, slightly stronger bloom. Keep it tasteful, not red soup.
- Panel top card: the same toggle as the plant cell, `K.segmented(card, [{value:"cell",label:"🌱 Plant cell"},{value:"animal",label:"🫀 Animal cell"}], "animal", v => { if (v !== "animal") engine.swapRoot(v); })`.
- An honest note on the page (in the first card or the "What's happening" hint): *"A typical human body cell, modelled on a liver cell (hepatocyte). Sizes and numbers are simplified."*
- A "What changed from the plant cell" card built from `COMPARE`, lens-filtered:
  - **Y7–8:** gains and losses list.
  - **Y9–10:** adds the osmosis contrast (burst vs turgid) and the energy-source contrast (eats glucose vs makes it).
  - **Y11–12:** adds GLUT2, autophagy, constitutive secretion, centrosome vs acentrosomal plant spindles, and "plant vacuoles do lysosome-like digestion".

## Morph hooks (required)
The plant cell has membrane half-extents `HX=28, HY=17, HZ=17` (rounded box) and nucleus at `(-20.5, 1.5, 0)`, radius 5. Wall, chloroplasts and vacuole are gone and its other organelles have dissolved by the time your level mounts.
- `morphIn(k)`, k 0→1 over 0.9 s:
  - At **k=0** the membrane must look like the plant membrane: store two position sets per vertex (rounded-box-projected and your blob) and lerp them.
  - The nucleus starts at the plant position and eases to yours.
  - All other parts grow from scale 0, staggered (organelles first, then cytoskeleton, then flows).
  - Flows and labels are suppressed while k < 1.
- `morphOut(k)` is the exact reverse, for going back to the plant cell.
- Both must be safe when called before `mountPanel`, and when `engine.reducedMotion` is set (they're then called once with k=1).

## Geometry (visual quality bar: must look real, molecular-animation style)
Hepatocyte about 30 µm across. Use membrane radius ≈ 15 µm, a polygonal-ish organic blob made with low-frequency noise displacement (not a sphere silhouette) and gentle slow undulation. Nucleus radius 5, roughly central (slightly offset), with nucleolus, chromatin, pores. Reuse the plant cell's nucleus look.

Animal-only parts:
- **Centrosome** near the nucleus: 2 centrioles at right angles. Each is a short cylinder of 9 triplet microtubules (instanced), about 0.2 µm × 0.5 µm. They're tiny, so add a soft pericentriolar glow sprite so it's findable. Pickable.
- **Microtubules** radiating from the centrosome to the cortex: about 40–70 thin curved tubes (instanced or merged), faint. Fewer on `medium`, none on `low` (read `engine.quality`, re-check in `update` and toggle visibility).
- **Actin cortex** under the membrane: a fine faint mesh, Y9+ only, high quality only.
- **Lysosomes:** about 14, radius 0.25–0.6. Dense, translucent, with a darker granular core (inner instanced specks). Some fuse with a damaged mitochondrion during autophagy (see model).
- **Smooth ER:** a branching tubular network (connected tubes, not straight spokes), with **glycogen rosettes** (instanced clusters of small spheres) nestled beside it. Scale the glycogen count and visible size by `M.glycogen`.
- **Many mitochondria:** about 40, instanced if practical; varied lengths, gently tumbling. Damaged ones look duller and swollen (instanced colour).
- Rough ER sheets/tubes with ribosomes, and Golgi stacks with **secretory vesicles** budding from the trans face.
- More peroxisomes than the plant (liver), about 15.
- **GLUT2 transporters** as small glowing markers on the membrane, concentrated on the blood-facing side.
- **Blood context:** a **sinusoid** (wide capillary) running past one face, a translucent tube with **red blood cells** (biconcave discs, instanced) drifting along it. The membrane facing it has **microvilli** (instanced small fingers). Blood glucose comes from here. Add faint neighbour hepatocytes (polygonal blobs) for tissue context. Plain spheres are not acceptable.
- A membrane dive marker (to `membrane`), a cytosol dive marker (to `enzymes`), and portals to `mitochondrion` (each mitochondrion; if instanced, give the portal a proxy object at a representative one) and `nucleus`. No chloroplast portal. The "Cell division" card is the same as the plant cell's (mitosis/meiosis via `divePortal`).
- Use `glass()`/`physical()`/`wobble()`/`specks()` from `materials.js`. Nothing flat-shaded. Lots of crowding: dense cytosol specks.
- Instanced meshes everywhere repeated. No per-frame allocations. Target 60 fps on high.

## Model (`animalCellModel.js`): same shape as `PlantCellModel`
Fields: `reset()`, `step(dt)` (sub-stepped like the plant), `on{}`, `flux{}`, `history[]` (240 samples), `status()` (short strings per part, e.g. "storing glycogen", "starved", "burst").

Store values are 0–100 relative units like the plant model, except blood glucose, which is in **mM**.

**Inputs:**
- `bloodGlucose`: mM, slider 2–15, default 5.
- `outside`: tonicity, −100 to +100, slider. Label it with words: "pure water / dilute" ↔ "normal (isotonic)" ↔ "salty (concentrated)". 0 = isotonic.
- `lysosome`: activity 0–100, default 70.
- `secretionDemand`: optional.

**Switches:** `mitochondrion, nucleus, pores, er, golgi, lysosome, pumps (Na⁺/K⁺-ATPase), glut`.

**Processes (all teaching-scale, stated on the page):**
1. **GLUT2:** a facilitated, bidirectional transporter. Net uptake = `Vmax·(Gb/(Gb+Km) − Gi/(Gi+Km))` with Km ≈ 17 mM (GLUT2's high Km). Intracellular glucose `Gi` in comparable units, so the cell takes up glucose when blood glucose is high and **releases glucose into the blood when blood glucose is low** (this is the liver's job).
2. **Glycogen:**
   - **Blood glucose high (above ~6 mM):** net glycogenesis (stores glucose). This costs ATP (UTP), so show a small ATP draw.
   - **Blood glucose low (below ~4.5 mM):** glycogenolysis frees glucose, which GLUT2 exports.
   - **In between:** roughly balanced.
   - Y11+ text names insulin/glucagon as the signals (not modelled separately, and say so).
   - When glycogen runs out at low blood glucose, the cell can't support the blood: show it.
3. **Respiration:** glucose + O₂ → ATP in the mitochondria. Output is proportional to the number of **healthy** mitochondria. Glycolysis in the cytosol gives a little ATP alone, same as the plant model. O₂ arrives from the blood. Keep the plant's demand-led ATP logic.
4. **Mitochondrial quality (autophagy):**
   - Track `mitoHealthy` and `mitoDamaged` (counts, total about 40 for visuals).
   - Damage accrues at a slow rate (faster with high respiration).
   - Lysosomal clearance (mitophagy) of damaged mitochondria ∝ `lysosome × damaged`.
   - Healthy mitochondria divide (fission/biogenesis) back toward 40 when ATP allows.
   - Damaged ones make little ATP and produce ROS (show a `ros` value at Y11+).
   - With lysosomes off, damaged mitochondria accumulate, so ATP falls and ROS rises over a minute or two.
5. **Osmosis (pump–leak):**
   - Volume `vol` (1 = normal).
   - Water flux ∝ (internal osmolarity − external).
   - The Na⁺/K⁺ pump (ATP) holds the internal solute steady. If ATP is low or the pumps are off, solute leaks in and the cell slowly swells, even in an isotonic solution.
   - **Hypotonic:** the cell swells. Above `vol ≈ 1.6` it **lyses**: set `M.burst = true`, stop all processes, show it visually (membrane ruptures and contents spill/fade), and give the narrative plus a prominent "Reset cell" button.
   - **Hypertonic:** the cell shrinks to about 0.6 and **crenates** (bumpy, wrinkled membrane, via extra high-frequency displacement).
   - No wall: contrast this with the plant cell in the text.
6. **Secretion (constitutive):** albumin. The flux runs nucleus mRNA → rough ER translation → Golgi → secretory vesicles → exocytosis, with an ATP/GTP cost. It stalls when ATP is low or a part is switched off. Count `secreted`. Albumin secretion in hepatocytes is **constitutive** (not stored and triggered), so say that at Y11.

`narrative(m, band)` must come only from the fluxes and stores, like the plant's. Paragraphs cover energy source (blood vs stores), glycogen direction, volume/osmosis state, mitochondrial health, and secretion. Years 7–8 in plain words. Years 11–12 terms: GLUT2, glycogenesis/glycogenolysis, mitophagy, ROS, pump–leak, Na⁺/K⁺-ATPase, constitutive secretion. Add Y12 keys only where something genuinely differs from Y11.

**Flows (instanced, like the plant):**
- glucose (blood ⇄ cell ⇄ mitochondria ⇄ glycogen);
- O₂ (blood → mitochondria) and CO₂ (out);
- ATP to its sinks;
- mRNA;
- albumin vesicles: ER → Golgi → membrane, travelling *along microtubules* where possible;
- water (in or out by volume change).

Keep it at or below about 300 particles total.

**Chips:** blood glucose (mM), glycogen, ATP, volume %, healthy mitochondria, albumin secreted.

**Chart:** ATP, glycogen, cell glucose, volume.

**Tours:**
- "Follow the glucose": blood → GLUT2 → glycogen → mitochondria → ATP.
- "Follow a secreted protein": nucleus → rough ER → Golgi → exocytosis into the blood.
- "Recycling worn-out parts": damaged mitochondrion → lysosome → autophagy.

**Missions (5–6, banded), for example:**
- store glycogen after a meal (blood glucose ≥ 9 for 10 s with glycogen rising);
- keep the blood supplied during a fast (blood glucose ≤ 3.5 and the cell exporting glucose);
- burst a cell in pure water;
- crenate it in salt;
- switch off lysosomes and watch ATP fall below 30;
- secrete 20 albumin.

**Quiz (5–6, banded):** plant vs animal differences, why animal cells burst but plant cells don't, what lysosomes do, where glucose comes from, constitutive secretion (Y11).

## Science checks (don't get these wrong)
- Animal cells have no cell wall, no chloroplasts, and no large permanent central vacuole (small temporary vacuoles and vesicles only). They do have centrioles; most flowering-plant cells don't.
- "Plants have no lysosomes" is a simplification: plant vacuoles do lysosome-like digestion. Say so at Y9+.
- The liver uses **GLUT2** (insulin-independent, high Km, bidirectional). GLUT4 is muscle/fat (insulin-regulated). Don't mix them up.
- Glycolysis happens in the cytosol. Respiration yields about 30 ATP per glucose. mRNA is reused, not consumed.
- The liver exports glucose. Muscle does not (no glucose-6-phosphatase): a nice Y11 aside, optional.
- The lysis threshold and the volumes are teaching-scale. Say "simplified" on the page.

## Verify, then report
`node --check` all three files. Test the model with node: a short script in your scratch dir stepping scenarios (fast, meal, pure water, salt, lysosomes off), with numbers printed.

A static server runs at http://localhost:8420 (root = `cellscape/`). In **your own new browser tab**:
- open `index.html?cell=animal`, then check the console;
- toggle to plant and back: the morph must be smooth, with no errors and no orphan labels or chips;
- dive into mitosis (it should open in animal mode), the membrane, a mitochondrion and the nucleus, and come back up;
- test all four year bands;
- test portrait 375×812;
- run the burst → Reset cycle.

Take high-quality screenshots of the animal cell at the default view and close up. If anything looks primitive or toy-like, improve it before reporting. Close your tab when done. Don't commit.

Report: what you built, model equations/parameters, science points you're unsure of, performance notes, and any engine changes you'd want.
