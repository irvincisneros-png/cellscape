# Builder brief: Epigenetics level (Phase 5e)

## Syllabus (`content/syllabus.json`)
**Biology Y12 (2025, Heredity):**
- `b25-y12-hered-12`: assess how epigenetic changes influence phenotype;
- `b25-y12-hered-09`: assess how environmental factors influence phenotype;
- `b25-y12-hered-10`: conduct an investigation to show the effect of environment on gene expression;
- links to `b25-y12-hered-17`…`20` (sex-linked inheritance) through X-inactivation.

**Y9–10:** genes and environment both shape traits, and genes can be switched on and off. **Y7–8:** a gentle "same recipe book, different pages open" view.

**Misconception to fix (from the owner's Year-10 site):** "only genetic changes are heritable". The correct framing, stated on the page:
- Changes to the DNA sequence (mutations) are the main heritable variation between generations.
- Epigenetic states can be **maintained** through *cell division* (that is how a liver cell stays a liver cell), though maintenance is imperfect.
- Across *generations*: in mammals most marks are erased twice (in primordial germ cells and again in the early embryo). Imprints are erased in primordial germ cells and then re-established according to the sex of the germline; once set, imprints are protected from the early-embryo reprogramming. Imprinting is not evidence that acquired marks survive generations. Proven transgenerational cases in mammals are rare and debated. Plants pass epialleles on more often: for example the peloric toadflax (*Linaria*, Cubas et al. 1999) and Arabidopsis epialleles.

**Owner priorities.** Science accuracy first. A **highly polished, realistic molecular-animation 3D look**: organic, translucent fresnel materials, crowding, subtle motion. Nothing toy-like.

## Read first
- `LEVEL_BRIEF.md`: the contract and rules.
- `assets/js/world/levels/chromatin.js`, `chromatinModel.js`, `chromatinContent.js`. These hold the existing nucleosome geometry (`nucleosomeGeo`), the histone colours (H3 #818cf8, H4 #34d399, H2A #fbbf24, H2B #fb7185), acetyl (#bef264) and methyl (#e879f9) colours, and the panel patterns. **Match those colours and that look.** Copy the helpers you need; don't import from `chromatin.js`.
- `assets/js/world/levels/immunity.js` + `immunityModel.js` + `tests/immunityModel.test.mjs`: the most recent level with several views, a pure model and a node test.
- `assets/js/world/levels/karyotype.js`: the X chromosome data and how it dives to siblings.
- `materials.js`, `style.js` (clay style must not crash), `kit.js`.

## Files
**Create only:**
- `assets/js/world/levels/epigenetics.js`;
- `assets/js/world/levels/epigeneticsContent.js`;
- `assets/js/world/levels/epigeneticsModel.js` (pure, no DOM, node-testable);
- `tests/epigeneticsModel.test.mjs`.

`epigenetics` is already registered in `shell.js`. I'll add the entry buttons in the chromatin, nucleus and karyotype panels myself.

**Don't edit** any other file. To test, dive from the nucleus:

```js
const e = window.cellscape.engine;
await e.dive(e.current.portals.find(p => p.to === "nucleus"));
await e.dive({to:"epigenetics", label:"Epigenetics", radius:e.current.portals[0].radius, center:e.current.portals[0].center, object:e.current.portals[0].object});
```

Use `metersPerUnit` (a molecular-scale level). The scale bar can be hidden per view with `showScale: false` if a view is not to scale. **Say so honestly on the page.**

## Three views (a segmented control in a "View" card; the camera flies between three scenes in one root, like immunity)

### 1 · Marks and memory (default)
**Scene:** a stretch of chromatin, about 16–20 nucleosomes along a DNA string, around a gene's promoter. The camera sits close enough to see histone tails.
- Each nucleosome shows its current mark state:
  - **active** (acetyl, green-yellow sparks on the tails; Y11+: H3K4me3 / H3K27ac);
  - **unmarked**;
  - **repressive** (Y11+: H3K9me3 or H3K27me3, drawn as violet methyl beads on the tails).
- Repressive regions visibly **compact**: the nucleosomes pack together, and reader proteins sit on the marks (HP1 dimers, or a PRC2 blob for Polycomb). Active regions loosen into beads-on-a-string.
- Writer/eraser enzymes are visible as soft protein blobs that dock on a nucleosome and flip its mark. The animation is driven by the model's actual conversion events.
- The promoter's CpG DNA methylation is shown as methyl spheres on the DNA, as in `chromatin.js`.
- RNA polymerase II transcribes when the promoter region is mostly active, with mRNA beads. This uses the same rule as the model.

**Model (`epigeneticsModel.js`):** the **Dodd–Sneppen recruitment model**, a well-known published model (Dodd et al. 2007, *Cell* 129:813). It is a teaching-scale but genuine mechanism, so describe it as such on the page.
- N nucleosomes. Each has a state M (repressive), U (unmarked) or A (active).
- Each step:
  - pick a random nucleosome n1;
  - with probability α, do a *recruited* conversion: pick a random n2, and n2's state pushes n1 one step toward it (M recruits A→U→M; A recruits M→U→A);
  - otherwise a *noisy* conversion: n1 moves one step toward a random state.
- The feedback ratio F = α/(1−α). Above about F≈4 the system is **bistable**: it stays mostly M or mostly A for a long time, and that is epigenetic memory.
- **Replication** (a "Divide the cell" button): each nucleosome is replaced with probability 0.5 by a U nucleosome, because old histones are shared between the two daughter strands. Feedback then restores the state, so the memory survives division. Students see this happen.
- **DNA methylation layer.** The promoter has 8 CpG sites.
  - De novo DNMT3 can be switched on (Y11+).
  - Methylated CpGs bias recruitment toward M near the promoter.
  - At replication, CpGs become *hemi-methylated*, and DNMT1 copies them back with high fidelity (about 95% per site per division).
  - TET removal is slow.
  - Keep it simple and documented in the file header.
- **Signals the student controls:**
  - a transcription-factor / activator signal (biases toward A at the promoter);
  - a repressor signal (biases toward M);
  - an HDAC-inhibitor "drug" (Y11+: blocks A→U erasure, like vorinostat);
  - "Divide the cell" (replication).
- **Outputs:** fraction A, fraction M, the promoter CpG methylation fraction, and transcription on/off with its rate. A chart of fraction-M vs time (and fraction-A) that shows the bistable jumps and division events.
- **Required property (node test):**
  - with F high, starting all-M with no signal, the state persists through 5 divisions, ending with M > 0.7 most of the time over seeds;
  - with F low (no feedback), it decays to mixed within a few divisions.
  - Use a seeded RNG (pass the seed into the model) so tests are deterministic.

### 2 · X-inactivation
**Scene A, a female (XX) nucleus:**
- a translucent nuclear envelope;
- two X chromosome territories (use the X banding colours or length from the karyotype data if easy; otherwise a stylised tangle like `chromatin.js` `tangle()`);
- a few autosome territories, faint.

Press **"Start X-inactivation"** (early embryo, about the blastocyst stage):
1. **Xist RNA** is made from one X (randomly chosen; show which) and spreads to coat it as a cloud of RNA particles.
2. That X condenses into a compact **Barr body** that moves to the nuclear periphery.
3. Repressive marks rise (Y11+: H3K27me3 and DNA methylation).

The other X stays active. Make it honest: Xist acts *in cis*, about 15 % of genes escape, and real Barr bodies are about 1 µm.

**Scene B, mosaic:** a sheet of about 300 cells (instanced, flattened hexagonal epithelial cells with soft fresnel), forming a patch of skin or fur.
- Start from about 16–32 founder cells. Each randomly inactivates one X (50:50; senior option: skew slider).
- The cells then divide. Daughters inherit the same inactive X, so clonal patches grow.
- The colours show which X is active, for example:
  - tortoiseshell/calico cat coat colour: an X-linked *O* (orange) vs *o* (black) allele;
  - **or** an X-linked carrier condition, such as a female carrier of anhidrotic ectodermal dysplasia with patchy sweat glands.
- Use a toggle between the two examples. A 2D inset is fine for the cat outline, but the cell sheet itself is 3D.
- Explain why calico cats are almost always female. Rare XXY males exist.

**Karyotype link:**
- A card "**Barr bodies = number of X − 1**", with buttons for karyotypes XX, XY, XXY (Klinefelter), X0 (Turner) and XXX.
- The scene-A nucleus updates to show the correct number of X territories and Barr bodies (one active X per cell).
- Add a note on why X0 and XXY still have symptoms (escape genes; the inactivation is not total).

**Model:** put pure functions in `epigeneticsModel.js`:
- `barrBodies(karyotype)`;
- a seeded mosaic simulation (founders, divisions, the resulting patch-size statistics).

**Node test:**
- Barr counts;
- the mosaic contains both colours when founders > 1;
- the patch count falls as founder number falls, i.e. later inactivation gives bigger patches.

### 3 · Environment
A small "**experiment bench**" that answers the Y12 investigation dot point with controllable, model-driven examples. Show one at a time (segmented). Each example has a 3D scene, kept modest and reusing the cell sheet or nucleosome array, a control slider, a chart, and an honest "evidence and caveats" note.

**a. Vernalisation, cold memory in a plant (default; ties to the plant-cell homepage).**
- Arabidopsis *FLC* (a flowering repressor) is silenced by prolonged cold through Polycomb H3K27me3.
- Each cell switches **digitally and independently**: the fraction of cells switched rises with the weeks of cold (Angel et al. 2011, *Nature* 476:105).
- After warming, the silencing is remembered through cell divisions, so the plant flowers.
- The mark is **reset** in the next generation's seeds, which is why every generation needs a winter.
- **Model:** per-cell bistable switch (reuse the Dodd–Sneppen system with N≈20 per cell, or a stochastic per-cell switching rate that increases in the cold). Track about 100 cells.
- **Controls:** weeks of cold (0–10), then "warm and grow".
- **Output:** % of cells with FLC off → flowering time (shorter when more cells are off).
- **Scene:** the cell sheet with nuclei glowing for FLC on and dark for off.

**b. Diet and coat colour: the agouti viable yellow mouse.**
- A methyl-donor-rich maternal diet (folate, B12, choline, betaine) increases methylation of a transposon upstream of *Agouti*. This shifts pups from yellow toward brown ("pseudoagouti") coats (Waterland & Jirtle 2003).
- **Model:** each pup's methylation level is drawn from a distribution whose mean depends on the diet slider. Coat class comes from thresholds.
- Show a litter of about 8 pup swatches and a histogram.
- **Caveat on the page:** this is a special case, an inserted transposon. Effects across generations are small and partly from the mother's environment, not purely inherited.

**c. Temperature and fur colour: Himalayan rabbit / Siamese cat. This is the contrast case.**
- A temperature-sensitive tyrosinase enzyme works only in the cooler body extremities, so the ears, nose and paws are dark.
- **Say clearly:** this is environment affecting phenotype **without** epigenetic marks. The protein works differently at different temperatures; the gene's packing doesn't change.
- **Model:** enzyme activity vs local temperature (a sigmoid around about 34–35 °C). There is a "shave and cool a patch" experiment: dark fur regrows there.

**d (Y11+). Identical twins drift apart.**
- With age, the DNA methylation patterns of identical twins diverge (Fraga et al. 2005, *PNAS* 102:10604). Show this as a stochastic drift model with the environment adding to the drift rate.
- Be honest about the effect size and the debate.

### "Is it heritable?" card (all views, banded)
A clear table:

| Change | Copied when cells divide? | Passed to children? |
|---|---|---|
| Mutation in a body cell | Yes | No |
| Mutation in a sperm or egg cell | Yes | Yes |
| Epigenetic mark in a body cell | Yes (maintenance) | No |
| Epigenetic mark in the germline | Usually erased in mammals (imprinting is an exception); sometimes kept in plants | — |

Correct the framing explicitly: "Some people say only genetic changes are inherited. That's nearly right for passing traits to children in humans, but epigenetic states are inherited every time a cell divides, and some are passed between generations, especially in plants."

## Year lens
- **Y7–8:** genes switched on and off, "same recipe book, different pages open", cold makes plants remember winter, calico cats. No jargon.
- **Y9–10:** epigenetics, DNA methylation, histones, gene expression, environment vs genes, X-inactivation and Barr bodies (simple), the heritability card.
- **Y11–12:** full terminology:
  - writers, readers and erasers;
  - HATs, HDACs, DNMT1 and DNMT3, TET;
  - H3K4me3, H3K27ac, H3K9me3, H3K27me3;
  - HP1, PRC2;
  - Xist, *in cis*, escape genes;
  - imprinting, transgenerational vs intergenerational;
  - the Dodd–Sneppen feedback model.

**Missions (6) and quiz (6), banded.** Examples:
- silence the gene and keep it silent through 3 divisions;
- show that memory fails without feedback (Y11+);
- make a Barr body;
- predict the Barr bodies in XXY;
- get 90 % of plant cells to switch FLC off;
- shave-and-cool a rabbit patch and explain why it isn't epigenetic.

The narrative ("What's happening") is generated from model state, as in all levels.

## Visual and performance
- Instanced meshes throughout. At most about 300 particles. No per-frame allocations.
- Keep big transparent shells few. Honour `engine.reducedMotion`.
- Labels use `engine.label`/`engine.place` and hide on narrow screens when crowded.
- `view` adapts to portrait. Light and dark page themes. Clay style must not crash, and it should look acceptable.

## Verify, then report
- Run `node --check` on every file and `node tests/epigeneticsModel.test.mjs`.
- At http://localhost:8420, open your own new tab with `tabs_create`, then `tabs_select` it before any animation tests, and pass an explicit `tabId` on every browser call. Other agents share the pane; never touch their tabs.
- Check:
  - all 4 year bands, light and dark, clay;
  - portrait 375×812 (reset to desktop after);
  - `await e.up()`;
  - the console;
  - every view, button and mission.
- Take screenshots and polish until it looks like a molecular animation, not a diagram.
- Don't commit. Close your tab when done.
- Report in under 400 words: what you built, the model equations and parameters, science you are unsure of, and any engine changes you need.
