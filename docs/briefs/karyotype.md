# Builder brief: Human karyotype level (Phase 5b)

Read first: `LEVEL_BRIEF.md` (the contract and rules, including "Notes added after Phase 2"). Then the reference levels `assets/js/world/levels/cell.js` and `assets/js/world/levels/animalCell.js` (newest, best patterns), plus `sims/meiosis/scene3d.js` and `model.js` for how chromosomes are drawn.

The owner's priorities: science accuracy (classrooms), and a **highly polished, realistic 3D look** in molecular-animation style (organic, translucent, well lit, never toy-like).

**Create only:** `assets/js/world/levels/karyotype.js`, plus an optional `karyotypeContent.js`. Don't edit other files. `karyotype` is already registered in `shell.js`. The nucleus panel has a "Karyotype ▸" button that dives here via `engine.dive({to:"karyotype", ...})`.

## What it is
A metaphase spread of all **46 human chromosomes**, condensed X-shaped sister-chromatid pairs. Each pair has its correct relative length, centromere position (metacentric, submetacentric or acrocentric, with satellite stalks on 13–15, 21 and 22) and a stylised **G-banding** pattern. Use a procedural band texture or instanced band rings on tube geometry, with the light/dark band layout approximating real ISCN ideograms for each chromosome (at least the major bands, so chromosome 1, 9 and X look recognisably like themselves). Chromosomes must look like real chromatin: lumpy fibrous surface, rounded ends, slight twist, soft translucency. Not capsules.

**Scale:** `metersPerUnit` with 1 unit = 1 µm. Chromosome 1 is about 10 µm at metaphase and the Y about 2 µm.

## Interactions
1. **Spread → karyotype.** It starts as a messy spread. "Sort" animates the chromosomes into the standard karyogram: pairs 1–22 ordered by size into groups A–G, then the sex chromosomes. Students can also drag a chromosome to a slot. Y7–8 get "find its partner" pairing with drag; senior years get full auto-sort plus a manual challenge.
2. **Sex:** a toggle between 46,XX and 46,XY.
3. **Aneuploidy:** show karyotypes for trisomy 21 (Down syndrome), 47,XXY (Klinefelter) and 45,X (Turner). Link to meiosis nondisjunction: a button dives to `meiosis` (`engine.dive({to:"meiosis", label:"Meiosis", radius:…, center:…})`). The meiosis level already models nondisjunction. Say that most aneuploidies arise from nondisjunction in meiosis, and that the risk rises with maternal age (Y9+).
4. **Gene map:** clicking a chromosome selects it and shows its ideogram with a few real, correctly placed gene loci as glowing markers:
   - HBB on 11p15.4, which ties to CellScape's model β-globin gene and sickle cell;
   - CFTR on 7q31.2 (cystic fibrosis);
   - HTT on 4p16.3 (Huntington's);
   - F8 on Xq28 (haemophilia A);
   - DMD on Xp21.2;
   - SRY on Yp11.2;
   - ABO on 9q34.2;
   - OCA2/HERC2 on 15q12–13.1 (eye colour, polygenic);
   - MC1R on 16q24.3;
   - LCT on 2q21.3.

   Each locus card says what the gene codes for, the trait or condition, and its inheritance pattern (autosomal recessive, autosomal dominant, X-linked recessive, polygenic, codominant). Each has a "Try it in the Inheritance lab ▸" button that dives to `inheritance` with `engine.inheritancePreset = "<id>"` set first. Preset ids: `sickle`, `cf`, `huntington`, `haemophilia`, `dmd`, `abo`, `eyes`, `mc1r`, `lactose`.
5. **Counting:** a chip shows chromosomes = 46 (or 47/45), autosome pairs = 22, plus sex chromosomes. A short "count them" mission.
6. **Plant parent:** if the root level is the plant cell (`engine.stack[0].id === "cell"`), show an honest note: "These are human chromosomes. Plants have their own sets: a tomato has 12 pairs, a wheat plant 21." Verify numbers you use (tomato 2n=24; bread wheat 2n=42; Arabidopsis 2n=10).

**Year lens:**
- **Y7–8:** 46 chromosomes in 23 pairs, one of each pair from each parent, genes are sections of chromosomes, XX/XY.
- **Y9–10:** adds autosomes and sex chromosomes, homologous pairs, karyotypes for diagnosing conditions, nondisjunction.
- **Y11–12:** adds centromere classes, G-banding (Giemsa, AT-rich dark bands), ISCN locus notation (e.g. 11p15.4), aneuploidy vs polyploidy, X-inactivation and Barr bodies (ties to epigenetics), SRY and testis determination.

The narrative ("What's happening") is generated from state: current view, sex, aneuploidy and selection.

**Missions (5–6) and quiz (5–6), banded.** Examples: pair all chromosomes; find the sex chromosomes; spot the extra chromosome; find the gene for sickle cell; Y11: name the centromere type of chromosome 21.

**Env:** a clean dark lab-imaging look (deep blue-black with a subtle cyan rim light). The banding should read crisply. A "stained" toggle switches between fluorescence-like and brightfield Giemsa looks (optional if time allows).

## Verify, then report
Run `node --check`. A static server is at http://localhost:8420. In your own new tab:
- open `index.html`;
- dive to the nucleus with `await e.dive(e.current.portals.find(p=>p.to==="nucleus"))`;
- dive here with `await e.dive({to:"karyotype",label:"Karyotype",radius:1.3,center:()=>e.current.portals[0].center(),object:e.current.portals[0].object})`.

Also test `?cell=animal`, the sort animation, aneuploidy, the gene cards, all 4 bands, portrait 375×812, up/back, and the console. The browser tab must be in front or requestAnimationFrame stalls. Cache-bust after edits. Take screenshots and iterate until it looks polished. Don't commit.

Report briefly: files and lines, the science sources/numbers you relied on, anything you're unsure of, and what you need from other files.
