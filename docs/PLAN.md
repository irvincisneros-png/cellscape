# CellScape — Plan (updated 2026-10-10)

Built from `IDEAS.md`. One 3D, multi-scale, highly interactive cell-biology world used from Year 7 to Year 12.

## Scope (decided 2026-10-10)

**CellScape = life at the cellular scale.** It covers every Years 7–12 NSW dot point that happens inside or between cells:
- cell structure
- membranes
- energy (photosynthesis, respiration, enzymes)
- division
- genetics through to inheritance
- microscopy
- specialised cells
- cell-level immunity

The zoom metaphor works because everything nests inside one cell. Content that does not nest inside a cell does not belong here.

**Wider suite (later, on the same engine).** The engine, year lens, syllabus tagging and level contract are not biology-specific. Each world is a separate site under the one hub (`science-sim-hub`). Worlds hand off into each other where scales meet.

| World | Covers | Connects to CellScape |
|---|---|---|
| **CellScape** (this) | Cells, organelles, molecules; Years 7–12 cell-related dot points | — |
| Body world | Organ systems → tissues → cells (Y8 5.1 Body systems, Y9 2 Disease/homeostasis, Bio Module 2 transport & gas exchange) | Zoom into a red blood cell, muscle cell or neuron → CellScape. The current Oxygen Transport sim moves here. |
| Plant world | Leaf/root/stem → xylem/phloem → cells (Y8 5.2 Plant systems, Bio plant transport) | Zoom into a mesophyll cell → CellScape plant cell |
| Ecosystem / evolution world (optional) | Y7 3.1 Classification, Y8 5.3 Ecosystems, Y10 5.4 Evolution | Not by zoom; links only |
| Chemistry, physics, Earth science | Their own simulators (existing repos: WaveMotion Studio, ChangeLab, etc.) | Hub only |

The clean-up of the existing repos becomes: put each world under the hub, then retrofit onto the shared engine where it pays off.

## Four pillars

1. **One zoomable 3D world.** Cell → organelle → molecule, continuous zoom. Right-drag orbits, the wheel or a pinch zooms, and clicking interacts. Graphics match the reference animations: glassy membranes, glossy proteins, depth of field and bloom.
2. **Interactions, not labels.** Every level is a working system with cause and effect. Students change something (light, an organelle switched off, a blocked pore, an inhibitor, a detached kinetochore) and watch the effect spread.
3. **Year-level lens.** A single "Year" setting controls vocabulary, labels, missions, quiz and depth. Each content item is tagged to NSW dot points, and the school's own codes appear (e.g. `Y7 3.2.3`). Links: `?year=7`, `?dot=<id>`, `?code=Y7-3.2.3`.
4. **Learning pathways.** These are guided routes through the world:
   - cells & organelles
   - energy
   - membranes
   - cell division
   - genetics (DNA → protein synthesis → folding → mutation → genes → epigenetics → inheritance)

## Phases

| Phase | Delivers | Status |
|---|---|---|
| 1. Foundation | Engine (multi-scale zoom, dive/up), working plant cell (organelle flows, knockouts), membrane level, year lens, syllabus mapping, homepage = cell | ✅ Done; Codex adversarial review, 2 rounds, fixed |
| 2. Energy | Chloroplast → thylakoid; mitochondrion → cristae/ATP synthase; enzymes (via cytosol) | ✅ Done |
| 3. Genetics | Nucleus → chromatin (with epigenetics) → DNA helix (structure, replication) → DNA to protein (mutation lab) → protein folding (sickle-cell) | ✅ Done |
| 4. Division | 3D mitosis (plant/animal, checkpoints, drugs) and meiosis (crossing over, nondisjunction, fertilisation, Punnett, pedigree) | ✅ Done |
| 5. Heredity & beyond | Human genes (karyotype, gene → trait), epigenetics in more depth, inheritance beyond meiosis (multi-gene traits, sex linkage, pedigrees), **animal cell** level with toggle, specialised cells, microscopy mode, cell-level immunity | In progress: **5a animal cell ✅** (hepatocyte; plant ⇄ animal morph; glucose/glycogen, osmosis/lysis, mitophagy, albumin secretion; Codex review, 2 rounds, clean). **5b human genes & inheritance ✅** (levels `karyotype` + `inheritance`, entered from the nucleus panel; absorbs the Year-10 genetics sims with their bugs fixed; Codex 2 rounds). **5c microscopy mode ✅** (🔬 stage button: light microscope with objectives, Abbe resolution, focus slice, stains, ruler, real micrographs; TEM thin section) **+ specialised cells ✅** (9 specialists with structure→function models, cell→organism ladder). **5d immune defence ✅** (innate + adaptive, primary/secondary response, vaccination, herd immunity). **5e epigenetics ✅** (level `epigenetics`, entered from the nucleus, chromatin and karyotype panels: marks & memory with a Dodd–Sneppen-inspired recruitment model + DNMT1/DNMT3/TET CpG layer and replication; X-inactivation with Xist, Barr bodies by karyotype and a clonal mosaic; environment bench: vernalisation/FLC, agouti Avy diet, Himalayan rabbit (non-epigenetic contrast), twin drift; "Is it heritable?" card fixes the Y10 framing). All Codex-reviewed (2 rounds, fixes applied). Phase 5 complete; next is Phase 6 |
| Page theme | Auto / Light / Dark (header). Light mode re-themes the page; the 3D stage stays dark | ✅ |
| Art styles | Switchable **Clay model** look (Graphics card → Look). Proof of concept done on plant + animal cells (cutaway diorama); other levels use the generic clay swap | PoC ✅; per-level polish in Phase 6 |
| 6. Polish & publish | Full browser QA pass on real devices/Chromebooks, review round, performance tiers, accessibility, teacher mode, GitHub Pages | After 5 |

The 2D simulations remain as WebGL fallbacks (`sims/<slug>/sim2d.js`).

## Known follow-ups (from build reports and reviews)
- **Membrane level:**
  - a plant H⁺-ATPase configuration (it currently shows animal proteins, with an honest note);
  - full year-lens adaptation.
- **Year 12 content:** text variants for the cell level (it falls back to Year 11).
- **Fast quality setting:** doesn't reduce geometry yet; test on school Chromebooks.
- **Framing on arrival:**
  - thylakoid opens with the lamp too prominent;
  - meiosis arrives framed tight;
  - check portrait views on every level.
- **Interactions to re-test by hand with a real mouse and touch:**
  - the enzyme drag;
  - the ATP-synthase crank;
  - the meiosis crossover drag;
  - mitosis DIY.
- **Science simplifications to keep honest** (each level's build report lists them):
  - one carrier pool for ATP+NADPH;
  - folding is sped up;
  - the cyclin graph is drawn from curves;
  - Okazaki fragments are short;
  - HbS fibre has 2 strands.
- **Nucleus:** the speckle label overlaps the chromatin label.
- **Animal cell:**
  - morph `swapRoot` relies on requestAnimationFrame, so a hidden tab pauses it mid-swap until it's visible again (harmless);
  - portrait: a label can overlap the top chips;
  - "other fuels" respiration term, lysis at 1.6× volume and 20 % non-osmotic volume are teaching-scale (stated on the page).
- **Karyotype:** bands regenerated from UCSC hg38 cytoBand (2026-10-10); re-run `tools/cytoband-to-karyotype.mjs` if the reference changes.
- **Clay style:** molecular levels lose custom shaders/glows; nucleus interior reads grey; animal transporters/microvilli/cytoskeleton hidden; plant ⇄ animal morph only approximate in clay. Clay wall texture slightly grainy.
- **Microscopy:** TEM thin section is sparse (honest: a real slice cuts few organelles) and its fine structures are stylised; long-run frame rate untested; "what can you see" reflects what the current quality tier draws.
- **Specialised cells / immunity:** checked by eye 2026-10-10 (fine). Left: portrait muscle fibre is small and its "Truncated…" label clips; root hair not individually screenshot.
- **Light mode:** chart series now use `K.chartCol()` (darkened on light theme); legend swatches ringed. Nucleus legend "Transcription/s" swatch is grey while its line is black.
- **Layout:** mitosis phase strip (Cytokinesis/G1) sits under the Microscope button in narrow stages; portrait: immunity "Breach in the barrier" and animal-cell "Rough ER" labels overlap the HUD chips.
- **Testing with the pane hidden:** `window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 33)` in the console lets dives and flights finish.
- **Epigenetics:** the parameters for vernalisation thresholds, agouti coat cut-offs, twin drift and rabbit temperature are teaching values (stated on the page). Background proteins could use more depth blur (marks `env.aperture`). The "FLC on" label anchor has not been checked by eye.
- **Inheritance lab:** mutation card links to the protein-synthesis sim (no direct portal to `expression`).
- **Dev server:** sends no cache headers; edited modules need a cache-busting reload.
