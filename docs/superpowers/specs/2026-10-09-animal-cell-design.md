# Phase 5a: Animal cell with a plant/animal morph

Status: approved 2026-10-09. This is the first piece of Phase 5. The other pieces come later, each with its own spec: human genes and inheritance, deeper epigenetics, specialised cells, microscopy mode, and cell-level immunity.

## Goal
The homepage cell gets a **Plant / Animal** toggle that morphs it in place. The animal cell is "a typical human body cell (based on a liver cell)", and the page says so. Every behaviour comes from the model, and the narrative comes from the model's fluxes, never from switch states alone.

## Architecture
`assets/js/world/levels/cell.js` is 741 lines. It gets split up as follows:

| Unit | Purpose |
|---|---|
| `cellScene.js` | Builds the shared parts: membrane, nucleus with nucleolus, chromatin and pores, mitochondria, rough ER, Golgi, peroxisomes, cytosol, dive markers. It takes a shape parameter (plant box or animal rounded blob). |
| `plantParts.js` | Wall, neighbour cells, plasmodesmata, central vacuole, chloroplasts with grana and starch. Moved out of `cell.js` without changing behaviour. |
| `animalParts.js` | Centrosome with 2 centrioles at right angles; about 12 lysosomes; small vesicles; glycogen granules (instanced); smooth ER network; secretory vesicles budding from the trans-Golgi; GLUT markers on the membrane. |
| `plantCellModel.js` | Unchanged, apart from extracting shared code. |
| `animalCellModel.js` | The animal flux model, described below. It has the same interface as `PlantCellModel`: `step(dt)`, the readouts and the switches. |
| `cellContent.js` | Gets `species`-aware entries: an `ORGANELLES` entry for each new part, switches for each species, `narrative(m, band, species)`, and a "what changed" comparison list. Y12 keys are added where Y11 text is reused today. |
| `cell.js` | Thin orchestrator. It owns the species state, the morph tween, portals, the panel and the toggle. |

Specialised cells (Phase 5 later) will be extra variants of `cellScene.js`, so the shared builder must not assume there are only two species.

## Animal model (`animalCellModel.js`)
These are teaching-scale simplifications. Each one is stated on the page where it is shown.
- **Glucose:** a blood-glucose slider (roughly 3–15 mM, normal about 5) sets GLUT uptake as saturable Michaelis–Menten-style uptake. Glucose goes to glycogen when it is in surplus and comes back from glycogen when it is short. Mitochondria use it to make ATP. Without enough glucose, ATP falls.
- **Osmosis:** an outside-solution control (hypotonic, isotonic, hypertonic) drives volume change. Without a wall, volume can pass the lysis threshold: the cell bursts, the sim pauses, and a Reset button appears. In a hypertonic solution the cell crenates. The panel contrasts this with the plant cell, which goes turgid or plasmolysed.
- **Autophagy:** mitochondria have a damage state. A lysosome-activity slider sets how fast damaged mitochondria are cleared. New mitochondria come from fission of healthy ones. Damaged mitochondria make little ATP and a lot of ROS (shown at Y11+). Low lysosome activity makes ATP fall over time.
- **Secretion:** a cargo flux goes ER → Golgi → secretory vesicles → exocytosis. The cargo is albumin, which a liver cell secretes. The flux costs ATP, and it stops when ATP is low.
- **ATP:** shared with mitosis and meiosis through the existing `parentInst.model` link.

## Morph and toggle
- A segmented control (`K.segmented`) in the cell panel. The state goes in the URL as `?cell=animal` (with `history.replaceState`) and is read at boot.
- The morph lasts about 1.5 s. Plant-only parts fade and scale out, animal-only parts fade in, the membrane and neighbour context reshape, and the shared organelles ease to their new positions. It respects pause and `prefers-reduced-motion` (reduced motion means an instant swap).
- A "What changed" panel section is filtered by year lens:
  - **Y7–8:** the gains and losses list.
  - **Y9–10:** adds the osmosis and energy-source contrast.
  - **Y11–12:** adds GLUT, autophagy and secretion.
- Portals:
  - The chloroplast portal is removed in animal mode.
  - The "Cell division" card passes the species, so mitosis opens in animal mode (furrow) and meiosis opens in human mode.
  - The membrane level hides its "animal proteins in a plant cell" note when the parent is animal.
- Picking and the info panel work for every new part.

## Syllabus
New parts and behaviours are tagged to existing dot points in `content/syllabus.json`: Y7 plant vs animal cells, Y9–10 osmosis and respiration, Biology Y11 Module 1 (cell structure, membrane transport). If no fitting dot point exists, nothing is invented: the gap goes into `SYLLABUS_NOTES.md`.

## Fix in passing
In `shell.js`, the year `<select>` doesn't update when `?dot=` or `?code=` changes the band, because `lens.set` runs before the `lens.on` sync is registered (around lines 39, 106 and 131). Register the sync first, or set the select after `lens.set`.

## Build and verification
1. I do the refactor myself, in one commit. Plant mode must look and behave exactly as before: dive to every portal, run the narrative at each band, and check the console.
2. One Sonnet 5.5 builder writes `animalParts.js`, `animalCellModel.js` and the content entries from a file-scoped brief.
3. I wire up `cell.js`: toggle, morph, portals and species passing.
4. Checks:
   - `node --check` on every changed file;
   - browser test of both species, every dive, and the burst then Reset cycle;
   - narrative checked at all 4 bands;
   - portrait at 375×812;
   - a clean console.
5. Codex adversarial review, at most 2 rounds, with its claims verified before fixing.
6. Update `docs/PLAN.md` (status table and follow-ups). Commit as work lands and push to `origin/main` (private repo).

## Out of scope
Specialised cells, immune cells, microscopy mode, human karyotype. Those are later Phase 5 specs.
