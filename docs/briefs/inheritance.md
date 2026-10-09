# Builder brief: Inheritance lab level (Phase 5b)

Read first:
- `LEVEL_BRIEF.md`, including its notes.
- `assets/js/world/levels/animalCell.js` for panel patterns.
- `sims/meiosis/level.js`, `model.js` and `content3d.js`. These already have a Punnett square, breeding ratios and a CF pedigree for the plant/human meiosis level. **Reuse ideas and keep the science consistent. Don't import from meiosis files if it couples them tightly. Copy small helpers instead.**

The owner's existing Year 10 site has genetics sims to absorb. Read for content and logic only; don't copy UI or bugs:
`/private/tmp/claude-501/-Users-irvincisneros-Documents-Local-Projects-Science-Simulator-Website/f53b06d0-9e95-448e-9b94-69d20b1787b7/scratchpad/audit/Year-10-Science/genetics-evolution/content.jsx`.
- **Relevant pieces:** `PunnettSquareTool` (L211–371), `MutationSimulator` (L373–506), and the MCQs around L860–1011.
- **Known bugs to fix, not copy:**
  - The homozygous buttons render "TX"/"tx".
  - The codon table is missing the CTN and ACN codons.
  - "Two unaffected parents with an affected child must be autosomal recessive" ignores X-linked recessive.
  - Eye colour is presented as a single gene; it's polygenic.
  - "One gene, one protein".
  - "Only genetic changes are heritable".

Owner priorities: science accuracy first, then a polished look.

**Create only:** `assets/js/world/levels/inheritance.js`, plus an optional `inheritanceContent.js` and `inheritanceModel.js` (pure, node-testable). `inheritance` is already registered in `shell.js`. It's reached from the nucleus panel and from the karyotype gene cards. On create, read `engine.inheritancePreset` (one of `sickle`, `cf`, `huntington`, `haemophilia`, `dmd`, `abo`, `eyes`, `mc1r`, `lactose`), then clear it.

## Concept
A 3D "family" lab. The stage shows two parent figures as stylised, tasteful translucent human silhouettes (no faces needed). Each carries a pair of glowing homologous chromosomes for the selected gene, with the alleles shown as coloured bands at the locus. Below sits a 3D Punnett board where gametes (sperm/egg spheres carrying one chromosome) fly from each parent into the grid cells, forming offspring genotypes, which then appear as small offspring figures coloured by phenotype. It must look polished: soft lighting, glass and fresnel materials (`materials.js`), gentle motion. Not a flat table pasted in 3D.

## Modes (panel, segmented control)
1. **Monohybrid.** Presets:
   - sickle cell: HbA/HbS. Recessive for the disease, carriers have sickle-cell trait, and heterozygote malaria resistance is a Y11 aside.
   - CF: autosomal recessive.
   - Huntington's: autosomal dominant, late onset.
   - lactase persistence: dominant.
   - MC1R red hair: recessive, simplified, and say so.
2. **Codominance / multiple alleles:** ABO blood groups. I^A and I^B are codominant and i is recessive. Show the 4 phenotypes. Y9+.
3. **Sex-linked:** haemophilia A (F8) and DMD. X^H/X^h with Y; show carrier mothers, affected sons, criss-cross inheritance. Y9+.
4. **Dihybrid:** two unlinked genes, 4×4 grid, 9:3:3:1. Y11; Y9–10 allowed with a simple pair. Note independent assortment, and that linked genes break it (the meiosis level shows crossing over).
5. **Polygenic:** "eye colour" or "height-like trait" with N additive genes (slider 1–6) plus an environment-variation slider. Breed 500 offspring and show a histogram turning into a bell curve as N rises. State plainly that real eye colour involves several genes (OCA2/HERC2 are the major ones) and isn't a simple brown/blue Mendelian trait. Y9+.
6. **Pedigree:** a generated 3-generation pedigree for the selected pattern (AR, AD, XR). Students click individuals to assign genotypes. A "which pattern?" puzzle gives a random hidden pattern and the student identifies it, with rule-based feedback:
   - AD: every affected person has an affected parent.
   - AR: can skip generations; two unaffected parents can have an affected child.
   - XR: mostly males, no male-to-male transmission.
   Feedback must be correct about ambiguity: some small pedigrees fit more than one pattern, so say "consistent with" rather than "must be" unless it's truly decisive.

## Probability and sampling
For every mode, show:
- the expected ratios (fractions and %);
- a "Have 1 / 10 / 100 children" sampling button with observed counts against expected;
- the note that each child is an independent 1-in-4 (etc.) chance. Don't let students think "they had one affected child, so the next three are fine".

Keep the language careful: "genotype", "phenotype", "allele", "dominant/recessive describe alleles' effects, not which is more common".

## Mutation link (optional, if time)
A mini panel showing the sickle mutation: codon 6 GAG→GTG (Glu→Val) in HBB, consistent with `sims/protein-synthesis/model.js` (read it). There's a button to dive to the `expression` level only if a natural portal exists. Otherwise just link the explanation.

## Year lens
- **Y7–8:** traits from parents, genes come in pairs, dominant/recessive in plain words, monohybrid only, simple chance.
- **Y9–10:** all modes except dihybrid detail. NSW Y10 5.2.x: genotype/phenotype, Mendelian inheritance for plants and animals, pedigrees, sex linkage, codominance.
- **Y11–12:** dihybrid, chi-square-style "is this close enough?" guidance (optional), linkage caveat, penetrance and variable expressivity notes, and epigenetics caveats ("not all heritable variation is in the DNA sequence").

The narrative is generated from state: current cross, expected vs observed.

**Missions (6) and quiz (6), banded.**

## Verify, then report
- Write a node test of the model: Punnett outcomes for every preset, sex-linked ratios, ABO, and polygenic distribution mean/variance.
- Run `node --check`.
- At http://localhost:8420, in your own new front tab:
  - Open `index.html`, dive to the nucleus, then into `inheritance` with `await e.dive({to:"inheritance",label:"Inheritance lab",radius:1.3,center:()=>e.current.portals[0].center(),object:e.current.portals[0].object})`.
  - Test with `engine.inheritancePreset = "haemophilia"` set before diving.
  - Check all modes, all 4 year bands, portrait at 375×812, and the console.
- Cache-bust after edits. Take screenshots and polish.
- Don't commit.

Report briefly: files and lines, the model and test numbers, science points you're unsure of, and what you need elsewhere.
