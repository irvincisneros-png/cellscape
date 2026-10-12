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
| 6. Polish & publish | Full browser QA pass on real devices/Chromebooks, review round, performance tiers, accessibility, teacher mode, GitHub Pages | In progress: **6a ✅** (2026-10-11): revision quiz (169 checked items from science-defender + authored, `tools/build-revision-bank.mjs`), teacher page with class links + QR (`teacher.html`), accessibility (Explore list, keyboard, live region, contrast), quality tiers that really lighten Fast (`docs/perf-report.md`), clay polish on molecular levels, portrait label/strip fixes, sun & shade leaf 24 h mission. Codex 2 rounds, fixed. **Live on GitHub Pages** (repo public, 2026-10-11): https://irvincisneros-png.github.io/cellscape/. **6b ✅** (2026-10-12): clay on every level, plant membrane configuration (P-type H⁺-ATPase, H⁺–sucrose and H⁺–nitrate symport, detailed-balance model, `tests/membraneModel.test.mjs`) with year-lens text, LOD on the heavy levels, thylakoid/meiosis framing, Year 12 plant-cell text, inheritance → protein synthesis with the sickle allele, gentler depth of field. Left: real-device and hand testing |

The 2D simulations remain as WebGL fallbacks (`sims/<slug>/sim2d.js`).

## Known follow-ups (from build reports and reviews)
- **Quality tiers:** Fast now drops bokeh/bloom cost, physical-material extras and pixel ratio. LOD adopted on membrane, cristae, chromatin, epigenetics, nucleus, animal, specialised, immunity (6b; see `docs/perf-report.md`). Epigenetics cell sheets would need per-tier geometry to get lighter. Re-measure on a real Chromebook.
- **Framing on arrival:** thylakoid and meiosis reframed (6b); portrait not checked on every level.
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
- **Animal cell:**
  - morph `swapRoot` relies on requestAnimationFrame, so a hidden tab pauses it mid-swap until it's visible again (harmless);
  - "other fuels" respiration term, lysis at 1.6× volume and 20 % non-osmotic volume are teaching-scale (stated on the page).
- **Karyotype:** bands regenerated from UCSC hg38 cytoBand (2026-10-10); re-run `tools/cytoband-to-karyotype.mjs` if the reference changes.
- **Clay style:** done on every level (6a/6b). Left: plant ⇄ animal morph only approximate in clay; chromatin/epigenetics glow shaders use plain clay shading; the specialised "biceps highlighted" ring isn't visible in clay.
- **Microscopy:** TEM thin section is sparse (honest: a real slice cuts few organelles) and its fine structures are stylised; long-run frame rate untested; "what can you see" reflects what the current quality tier draws.
- **Specialised cells / immunity:** checked by eye; portrait fixes 6a. Root hair not individually screenshot.
- **Light mode:** chart series use `K.chartCol()`; legend swatches ringed.
- **Testing with the pane hidden:** `window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 33)` in the console lets dives and flights finish.
- **Epigenetics:** the parameters for vernalisation thresholds, agouti coat cut-offs, twin drift and rabbit temperature are teaching values (stated on the page). Background proteins could use more depth blur (marks `env.aperture`). The "FLC on" label anchor has not been checked by eye.
- **Dev server:** sends no cache headers; edited modules need a cache-busting reload.
