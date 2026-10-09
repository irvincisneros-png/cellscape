# Audit: the owner's other science simulators

*Audited 2026-10-09/10. The audit was read-only: shallow clones, no repo code run, no changes on GitHub. It was compiled from four sub-audits: cellarium; LifeLens; Year 7–10 sites; the remaining nine repos.*

## Summary
None of the 16 science repos should be absorbed whole, but four contain parts CellScape should take:
- the **Year 10 genetics sims**, now absorbed into the karyotype and inheritance lab, with their bugs fixed;
- the **LifeLens microscope model, micrographs and specialised-cell data**, which feed microscopy mode and the specialised-cells level now being built;
- the **Year 7 cells slice**, for microscopy specimens, specialised cells and quiz text;
- the **cellarium "plant as a society of cells" game idea**, to be rebuilt as a plant-cell mission.

Physics, earth and chemistry repos belong to sibling sites under `science-sim-hub`. `tectonic-earth` is the one asset ready for a shared Three.js engine. Two question banks are valuable hub-wide (science-defender 895 items, equilibrium-lost 2,107 items). equilibrium-lost has about 7 wrong answer keys to fix before students use it.

## Summary table

| Repo | What it is | Verdict | Effort | Value |
|---|---|---|---|---|
| cellarium | 3D plant-cell resource game (React/Three r185) | A: idea only; rebuild as mission | M | Med-low |
| LifeLens | 18 Y7 mini-games, virtual microscope, provenance data (Next/vinext) | A: port microscope engine, micrographs, specialised-cell data | M | High (7/10) |
| Year-7 | Y7 topic site (React + in-browser Babel) | A: cells slice only; rest to siblings | S–M | Mod-high |
| Year-10-Science | Y10 topic site | A: genetics sims (**done, 5b**); rest to siblings | M | High |
| Year-8-Science | Y8 topic site | B: body, plant and ecosystem worlds | M each | Mod-high |
| Year-9 | Y9 topic site | B: immunity content (possible A for cell-level immunity); rest C | M | Med |
| year10-waves-motion-studio | Y10 waves & motion (TS/React/Vite, tested) | B: physics world flagship; copy its review and test contract | S link / L 3D | High |
| tectonic-earth | Plate tectonics globe (Three r128) | B: earth world; port to current Three | L | High |
| mineral-detective-lab | Mineral ID lab (canvas 2D) | B: earth world | M | Med |
| changelab-year-8-science | Heat transfer & energy stores (Next) | B: physics/energy; reuse engine only | M | Med |
| equilibrium-lost | Y10 chemistry RPG (Phaser) | C: but extract and fix its 2,107-item bank | S fix / M extract | High (bank) |
| science-defender | Y7–10 tower-defence revision game | C: but export its 895-item bank (shuffle and de-dup first) | S | Med-high (bank) |
| scientific-naming-game | Y7 Latin-roots naming | C: fix italics and roots, then park | S | Low-med |
| biolaunch | Y6 prosthetic-arm STEM | C | S | Low |
| Year-10-Balancing-Equations | Chem Quest + orphaned balancing app | C: archive (superseded by equilibrium-lost bank) | S | Low |
| science-sim-hub | Suite control room | Keep as the hub | — | — |

Verdict key: **A** = absorb into CellScape. **B** = sibling world under the hub. **C** = standalone or archive.

## Cell-biology repos (in depth)

### cellarium
**What it is.** Vite + React 19 + Three r185, about 7,000 lines. Four chapters reuse one mechanic: develop four organelles, set priorities, survive events.

**Quality.**
- The 3D is a flat slab cutaway: spheres, no instancing, no post-processing. It is clearly below CellScape's quality.
- The logic is clean and tested.
- There is no syllabus tagging and no assessment.

**Keep as ideas.**
- Multi-cell sugar sharing.
- The day/night cycle with respiration continuing in the dark.
- Event choices.
- A tutorial that highlights the real controls.

**Rebuild** as a "Sun and shade leaf" mission in `cell.js`, driven by real fluxes plus stomata and CO₂.

**Discard** the code and the 3D.

### LifeLens
**What it is.** Next 16 / vinext / Cloudflare with strict TypeScript and about 459 tests; 104 MB, mostly images. It has 18 outcome mini-games (mostly tap-the-answer), a virtual microscope, and provenance-pinned data.

**Reusable.**
- The microscope engine (10× eyepiece × 4/10/40× objectives, field of view, specimen-space scale bar, focus rules).
- Six micrographs with provenance. Use onion epidermis (CC BY 2.0) and cheek cells (CC BY 4.0), both needing attribution, and the E. coli SEM (public domain).
- Specialised-cell data: 6 cases with feature, function and limits, plus hierarchy chains.
- Carefully worded organelle and process text.

**Avoid.**
- The paramecium image: its licence is unverified.
- The fungal image: *Blastomyces*, a pathogen.
- The AI atlas images: they contain inaccuracies.

Outcome 3.1.7 (Aboriginal classification) is deliberately absent pending cultural review. Respect that.

### Year-7 (cells-classification)
**What it is.** React 18 + in-browser Babel, 11 interactives over 19 dot points, covering Y7 completely.

**Reusable.**
- `VirtualMicroscope` (the idea and specimens). Note that its `scale` variable is unused.
- `SpecialisedCellMatcher` (the list only).
- Good multiple-choice questions (L921, L933, L966) and the glossary.

**Not for CellScape.** The classification, keys and platypus content belong in a biodiversity world.

### Year-10-Science (genetics-evolution)
**Status.** **Absorbed in Phase 5b.** Its Punnett, mutation and pedigree logic was rebuilt in the inheritance lab with these bugs fixed:
- the "TX"/"tx" button labels;
- codons missing from the table;
- "must be autosomal recessive";
- eye colour taught as single-gene;
- "one gene, one protein";
- "only genetic changes are heritable".

**Still available.**
- `DNABaseBuilder`.
- `NaturalSelectionSim`, which should be rebuilt as agent-based.
- Ethics and technology sorters.

### Year-8 and Year-9 (lighter look)
- **Y8 `living-systems`:** body systems, plant transport and ecosystems. This is sibling-world material.
- **Y9 `diseases`:** the only immunity content. Its antibody-response graph and three-lines cards could seed a CellScape cell-level immunity module, rebuilt in 3D.

## Other repos (lighter)
- **year10-waves-motion-studio.** The only repo matching the hub's TS/React/Vite spec. I found no science errors. Copy its `SCIENCE_REVIEW.md` contract, assessment schema and test harness as the engineering baseline.
- **tectonic-earth.** The best science honesty and visuals of the set. The plate, coastline and terrain data and its pipelines are reusable. Porting from Three r128 is real work.
- **equilibrium-lost.** Clean Phaser engine with 297 tests. Its 2,107-question bank is the asset. The pixel-art style doesn't fit the hub's look.
- **science-defender.** Has 895 MCQs with no wrong keys found. But the correct answer is option B 57% of the time and the longest option 69% of the time, and options are never shuffled. Fix those before reuse.
- **changelab.** A science-careful energy engine. It contains leftover starter scaffold, and it uses a synthetic "Mr. Cisneros" voice: check consent and licensing.
- **mineral-detective-lab.** The mineral data is correct. It lacks a magnet test.
- **scientific-naming-game, biolaunch, Year-10-Balancing-Equations.** Low value. See the errors below.

## Recommended absorption order (CellScape)

| Phase | Item | Source |
|---|---|---|
| 5a ✅ | Animal cell | — |
| 5b ✅ | Karyotype + inheritance lab | Year-10 genetics |
| 5c (building now) | Microscopy mode | LifeLens microscope + micrographs; Year-7 specimens |
| 5c (building now) | Specialised cells | LifeLens specialised-cell data; Year-7 matcher list |
| 5d | Cell-level immunity | Y9 diseases (antibody curve, three lines), rebuilt in 3D |
| 5e | Deeper epigenetics | — (fix Y10's "only genetic changes are heritable" framing) |
| 6 | "Sun and shade leaf" mission | cellarium idea |
| 6 | Quiz banks | science-defender cell/genetics items (after shuffling and de-dup); LifeLens mastery templates |
| 6 | Engineering baseline | waves-motion-studio `SCIENCE_REVIEW` contract + test harness |

## Science errors found (fix in the source repos if they stay in use)

**equilibrium-lost** (`src/content/data/`), before any student use:

| Item | Problem |
|---|---|
| `questions/equilibrium.json` eq-076 | Removing CO₂ (a reactant) is keyed "shifts right". It shifts left. |
| eq-036 | The keyed option says "left, toward more N₂O₄". N₂O₄ is on the right. |
| `balancing-equations.json` be-232 | The keyed equation is unbalanced (O 16 vs 14). Option 0 is correct. |
| be-135 | Fe is balanced; only Cl is unbalanced. |
| `reaction-rates.json` rr-262 | 2.0 g CaCO₃ gives 0.88 g CO₂, not 0.44 g. |
| `energy-changes.json` ec-155 | The profile and the bond data agree, so "Yes, both endothermic" is correct. |
| `reaction-types.json` rt-231 | H₂ is not a hydrocarbon. |
| `npcs.json:215` | The Haber process runs at about 450 °C, not 200 °C. |

Softer issues in the same bank: ec-138, ec-197, rt-108, b-074, as-021 (neutron relative mass keyed as "+1"), be-146 (two defensible answers).

**Year-10-Science** (`genetics-evolution/content.jsx`). Most were fixed in CellScape's version; the originals remain on the live site:
- L299/L307: homozygous buttons read "TX"/"tx".
- L395: codon table missing the CTN and ACN codons.
- L906: "must be autosomal recessive" (X-linked recessive also fits).
- L216: eye colour taught as single-gene.
- L775: "one gene, one protein".
- L1027 vs L1016/L1029: megafauna and occupation dates contradict.
- L1011: "only living species can be compared" (ancient DNA exists).
- L1042: "only genetic changes are heritable".
- L853: height variant count dated.
- L815: Photograph 51 credit (Gosling).
- L959: insurance moratorium outdated.
- L1065: HeLa and IVF.
- L725: opossums are also in North America.
- L940: insulin claim overstated.
- L620/L644: "10 generations" but 9.
- L1044: DNA was discovered in 1869; it's the structure that came in the 20th century.
- L1121: oogenesis yields one egg.

**Year-7** (`cells-classification/content.jsx`):
- L906/L939/L580: glycolysis happens in the cytoplasm, and mature red blood cells have no mitochondria.
- L589: cyanobacteria also photosynthesise.
- L610: JSX stroke typo.
- L328–332: hotspots misplaced.
- L803: whales/hippos wording.
- L828: myriapod legs.
- L120–260: key never reaches crustaceans.
- L927: iodine doesn't stain cell walls.
- L980: microvilli give about 20× surface area, not 600×.
- L962: "identical DNA" has exceptions.
- L913: skips mRNA.
- L985: water enters root hairs by osmosis.
- L292: platypus breath-holding claim is dubious.

**Year-8** (`living-systems/content.jsx`):
- L94: "ALL nutrient absorption" happens in the small intestine (it doesn't).
- L490/L502: 250 m² absorptive surface (modern estimate 30–40 m²).

**Year-9** (`diseases/src/`):
- `three-lines.jsx:37`: chickenpox can reactivate as shingles.
- `topic-2-2.jsx:70`: viruses called "non-living" flatly.
- `herd-immunity.jsx`: COVID and flu thresholds inconsistent with 1−1/R₀.
- `topic-2-2.jsx:167`: vaccinated people "don't pass on the pathogen" is overstated.

**LifeLens:**
- `src/games/cells/outcome-games.ts:52`: the ribosome is put in the "unsupported" zone.
- `mrs-gren-atlas.png`: the excretion panel shows a paramecium, not a fish.
- Stale choice ids in `outcome-games-living.ts`.

**cellarium:**
- `CellScene.tsx:158-173`: the vacuole is about 10% of the cell (it should be 80–90%).
- `game.mjs:123`: cytoplasm definition is wrong.
- `CellScene.tsx:246-255`: grana sit outside the chloroplast.
- Mitochondria sizes are out of proportion.
- No stomata in the dry-air scenario.

**science-defender** (caveats, no wrong keys):
- y7:127: Linnaeus date.
- y8:17: 250 m².
- y8:152: convection named as the plate driver.
- y9:111: Gardasil origin.
- y10:47: appendix as vestigial.
- y10:106: neutron-star mergers omitted.

**Other repos:**
- *tectonic-earth:* convection-drag model presented as the plate driver (`index.html:234`, `:72`, `:312`).
- *changelab:* radiant gain uses d^-0.72, and the white-paint absorptance and conductivity ratios are off (`HeatTransferLab.tsx`).
- *mineral-detective-lab:* fluorite habit given as octahedral; no magnet test.
- *scientific-naming-game:* binomials never italicised; several roots wrong (gamba, sulcata, necto).
- *biolaunch:* the 45° optimum ignores the 1 m launch height; a 100 g weight is given as 25 N.
- *Year-10-Balancing-Equations:* K + ZnCl₂ is a "model" reaction.
