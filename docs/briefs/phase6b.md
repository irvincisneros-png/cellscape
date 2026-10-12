# Phase 6b briefs: finishing the polish

Four builders work in parallel. The shared rules from `docs/briefs/phase6.md` apply: own files only, your own browser tab, the rAF tip if the pane is hidden, `node --input-type=module --check < file`, run all `tests/*.mjs`, check light and dark plus portrait, don't commit, and report in under 300 words.

The site is **live**: every push goes to students. I commit after review.

**Level of detail (LOD) API**, added in Phase 6a (see `docs/perf-report.md`): mark a heavy InstancedMesh with `mesh.userData.lod = true`. Add `userData.lodCount = N` if the level changes `mesh.count` itself. On the Balanced and Fast tiers the engine draws `ceil(full × engine.lodScale)` instances, where lodScale is 0.75 or 0.5.
- Only mark decorative or crowding instances, where fewer still teaches the same thing.
- Never mark counts the model or narrative refers to. For example, ATP synthase count, chromosome count and red blood cells in a calculation must stay.
- If the level re-sets `count` every frame, read `engine.lodScale` yourself instead.

## A · Clay on the remaining levels, plus their LOD
**Own:** `assets/js/world/style.js`, `assets/js/world/levels/nucleus.js`, `sims/mitosis/level.js`, `assets/js/world/levels/immunity.js`, `assets/js/world/levels/specialised.js`, `assets/js/world/levels/animalCell.js` (and its `animalCellContent.js`, `animalCellModel.js` if needed).

1. **Clay on each owned level.** Make it read as a deliberate, charming clay diorama, the same bar as the Phase 6a clay polish. Read the hooks and helpers that pass added to `style.js`: `clayPatch` and opt-in `level.clay?.(on)`. Fix these follow-ups:
   - the nucleus interior reads grey;
   - the animal cell's transporters, microvilli and cytoskeleton are hidden in clay. Show them as clay, or explain why not.
   - check the mitosis chromosomes, spindle and phase strip;
   - check the immunity scenes (all 3 views);
   - check the specialised cells (all 9 plus the ladder).

   Real → clay → real must restore exactly.
2. **Nucleus:** the speckle label overlaps the chromatin label. Fix it.
3. **LOD:** adopt it in specialised, animal, nucleus and immunity, following the rules above.

## B · Membrane level
**Own:** `sims/membrane-transport/*` (`level.js`, `scene3d.js`, `model.js`, `sim2d.js`, `index.html`).

1. **Plant configuration.** When the parent is the plant cell (`engine.stack[0].id === "cell"`, or check how the level knows), show a plant plasma membrane:
   - the **P-type H⁺-ATPase** proton pump builds the proton gradient and membrane potential, instead of the Na⁺/K⁺-ATPase;
   - **H⁺–sucrose symport** and **H⁺–nitrate symport** use that gradient;
   - K⁺ channels and aquaporins stay.

   The animal configuration stays as it is from the animal cell. Keep the shared model honest: if the existing model is Na⁺/K⁺-specific, add a plant mode with the correct ions and stoichiometry. The P-type H⁺-ATPase moves 1 H⁺ per ATP; the symporters move 1 H⁺ per sucrose and about 2 H⁺ per NO₃⁻. Replace the current "animal proteins shown" note with the correct one per configuration.
2. **Year lens.** Adapt the panel text, labels, missions and quiz for all four bands (`y7-8`, `y9-10`, `y11`, `y12`), with plain words for Years 7–8.
3. **LOD:** adopt it on the membrane's heavy instanced meshes (lipids and crowding proteins).
4. The standalone page `sims/membrane-transport/index.html` and the `sim2d.js` fallback must keep working.

## C · Framing, Year 12 wording, inheritance link
**Own:** `sims/photosynthesis/level.js`, `sims/meiosis/level.js`, `assets/js/world/levels/cellContent.js` (Year 12 text only; the leaf mission lives there too, so don't change its logic), `assets/js/world/levels/inheritance.js`, `assets/js/world/levels/inheritanceContent.js`.

1. **Thylakoid:** it opens with the lamp too prominent. Reframe the arrival view, including portrait.
2. **Meiosis:** it arrives framed too tight. Reframe, including portrait.
3. **Plant cell:** add `y12` variants where the Year 11 text falls short of Year 12 Biology. Only where it adds value: Module 5 heredity links, DNA, and the nucleus-to-protein pathway. Science accuracy first.
4. **Inheritance lab:** the mutation card links to the protein-synthesis sim page. Make it dive straight into the `expression` level with `engine.dive({ to: "expression", ... })`. Check how other levels dive to siblings, e.g. `karyotype.js`. Make sure `up()` returns to the inheritance lab.
5. **LOD:** adopt it on the thylakoid's heavy instanced meshes.

## D · LOD on the molecular levels
**Own:** `assets/js/world/levels/epigenetics.js`, `sims/atp-synthase/level.js` (and `scene3d.js` if present), `assets/js/world/levels/chromatin.js`.

1. Adopt LOD following the rules above.
2. Measure draw calls and triangles before and after at each tier, and add a short "LOD adoption" section to `docs/perf-report.md`. You own that section only; append it.
