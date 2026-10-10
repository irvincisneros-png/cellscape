// Lens-aware text for the Epigenetics level. Values may be strings or { "y7-8", "y9-10", "y11", "y12" } (lens.pick).
// narrative(ctx, band) builds the "What's happening" text from the live model state (epigeneticsModel.js).
import { KARYOTYPES, barrBodies, AGOUTI_CLASSES, agoutiMean, vernFraction, flowerWeeks, tyrActivity, twinExpected, TWIN, N_CPG } from "./epigeneticsModel.js";

const pct = (x) => `${Math.round(x * 100)}%`;
const pick = (v, band) => { if (v == null || typeof v !== "object") return v; const o = ["y7-8", "y9-10", "y11", "y12"]; for (let i = o.indexOf(band); i >= 0; i--) if (v[o[i]] != null) return v[o[i]]; return v["y7-8"] ?? ""; };

export const VIEWS = [
  { id: "marks", label: { "y7-8": "1 · Switching genes", "y9-10": "1 · Marks & memory", y11: "1 · Marks & memory" } },
  { id: "x", label: { "y7-8": "2 · Cat colours", "y9-10": "2 · X-inactivation", y11: "2 · X-inactivation" } },
  { id: "env", label: { "y7-8": "3 · Environment", "y9-10": "3 · Environment", y11: "3 · Environment" } },
];

export const NOTE = {
  marks: {
    "y7-8": "Most body cells contain essentially the same DNA instructions (the recipe book). Tiny tags on the packaging help decide which pages are open. This is a simplified model: the tags and helper proteins are drawn bigger than they are.",
    "y9-10": "A stretch of 20 nucleosomes around one gene's promoter. Chemical tags on the histones (and on the DNA) can turn the gene on or off, and the tags can be maintained when a cell divides. The tags, tails and enzymes are drawn larger than true scale, and the model is a simplified teaching version of real research.",
    y11: "A 20-nucleosome stretch around a promoter, run by a Dodd–Sneppen-inspired teaching model (after Dodd et al. 2007, Cell 129:813). It is not the published model and not fitted to data: recruitment is global across the patch, state A means histone acetylation only (H3K4me3, which also marks active promoters, is not simulated), and real chromatin has thousands of nucleosomes, many more marks and 3D folding. Treat the numbers as relative. Nucleosomes and DNA are roughly to scale; histone tails, marks and enzymes are enlarged.",
    y12: "A 20-nucleosome stretch around a promoter, run by a Dodd–Sneppen-inspired teaching model (after Dodd et al. 2007, Cell 129:813), not the published model and not fitted to data. Recruitment is global across the patch. State A means histone acetylation only (HAT / HDAC); H3K4me3 is not simulated, and H3K9me3 + HP1 versus H3K27me3 + PRC2 are two alternative illustrative repressive systems. Three exclusive states leave out combinations such as bivalent chromatin (H3K4me3 together with H3K27me3 at developmental genes). Nucleosomes and DNA are roughly to scale; tails, marks and enzymes are enlarged.",
  },
  x: {
    "y7-8": "Female mammals have two X chromosomes but only need one working copy. In body cells, each cell switches one off at random. The cat and the cell sheet are simplified.",
    "y9-10": "A simplified model of random X-inactivation in body (somatic) cells of placental mammals. The nucleus and the cell sheet are different scales. The order of events is simplified, and the pattern of patches is a teaching simulation.",
    y11: "A simplified model of random X-inactivation in body (somatic) cells of placental mammals. The nucleus view is drawn to scale (nucleus ≈ 9 µm across, Barr body ≈ 1 µm). Xist acts in cis. Escape figures are human estimates (roughly 15% of X-linked genes escape, with a further ~10% variable) and vary by gene, tissue and person. The mosaic sheet is a stylised simulation: real clones also migrate and mix, and the number of founder cells is not directly measured here. Imprinted X-inactivation in the placental tissues of some mammals is not modelled.",
  },
  env: {
    "y7-8": "Four experiments about how the world around a living thing changes how its genes behave. They are simplified models.",
    "y9-10": "Four experiments about how environment shapes phenotype. Only some of them involve epigenetic marks: sorting out which ones is part of the job.",
    y11: "An experiment bench for the Year 12 dot point on environment and gene expression. Each example is a simplified, model-driven version of published work; read the evidence and caveats note on each. One of them (the Himalayan rabbit) is deliberately NOT epigenetic.",
  },
};

export const BLURB = {
  marks: {
    "y7-8": "Press <b>Divide the cell</b> and watch the tags get shared out. A silent gene can stay silent after a cell divides: the cell can remember. Some methyl tags help silence genes; others go with active genes.",
    "y9-10": "Each nucleosome carries a tag: <b>active</b> (green-yellow acetyl), <b>unmarked</b>, or <b>silencing</b> (violet methyl). Tags can recruit more of the same tag onto other nucleosomes in the patch, so a pattern can help keep itself going, even through cell division.",
    y11: "States A (histone acetylation, e.g. H3K27ac), U (unmarked) and M (repressive: H3K9me3 + HP1 or H3K27me3 + PRC2, as two illustrative systems). Nucleosomes recruit writers that push other nucleosomes in the patch toward their own state. With strong feedback and roughly balanced signals the state can persist through replication.",
  },
  x: {
    "y7-8": "Start with one cell: press <b>Switch one X off</b>. Then look at the sheet of cells: each patch is one family of cells that switched off the same X.",
    "y9-10": "<b>Switch one X off</b> to see the Barr body form, then use the cell sheet to see how a mixed patchwork of cells arises. The karyotype card shows why the number of Barr bodies is the number of X chromosomes minus 1.",
    y11: "Xist RNA is made from the future inactive X (Xi), coats it in cis, and is followed by Polycomb marks (H3K27me3) and DNA methylation; the X compacts into a Barr body near the periphery. The choice is random per cell, then clonally maintained.",
  },
  env: {
    "y7-8": "Pick an experiment. Cold, food and warmth can all change how a living thing looks. Only some of these work by remembering tags on the genes.",
    "y9-10": "Vernalisation (cold memory), diet and coat colour, and temperature and fur colour. Decide which one is NOT caused by epigenetic marks.",
    y11: "Vernalisation (Polycomb silencing of <i>FLC</i>), the agouti viable yellow mouse (methylation of a transposon), the Himalayan rabbit (temperature-sensitive enzyme, no marks) and identical twins (methylation drift).",
  },
};

export const ENV_EXAMPLES = [
  { id: "vern", label: { "y7-8": "Cold memory in a plant", "y9-10": "Vernalisation", y11: "Vernalisation" } },
  { id: "agouti", label: { "y7-8": "Mouse coat colour", "y9-10": "Diet and coat", y11: "Agouti mouse" } },
  { id: "rabbit", label: { "y7-8": "Rabbit fur colour", "y9-10": "Rabbit fur", y11: "Himalayan rabbit" } },
  { id: "twins", label: { y11: "Identical twins" }, band: "y11" },
];

export const EVIDENCE = {
  vern: {
    "y7-8": "Some plants, such as one kind of Arabidopsis, wait for a long winter before they flower. They can remember the cold. In the next generation the memory is wiped, so each new plant needs its own winter. The numbers here are made up to teach the idea.",
    "y9-10": "In a plant that flowers after winter, a gene called <i>FLC</i> blocks flowering. A long cold spell switches <i>FLC</i> off, one cell at a time, using silencing tags. The cells keep it off after the weather warms, so the plant can flower. The tags are cleared in the seeds, so every generation needs a winter. The weeks and flowering times are teaching values.",
    y11: "<b>Evidence:</b> Arabidopsis winter-annual accessions (e.g. FRI-active Col). Prolonged cold induces Polycomb (PRC2) H3K27me3 at <i>FLC</i> via a nucleation region; each cell switches in a digital, all-or-nothing way and independently, and the fraction of silenced cells rises with the weeks of cold (Angel et al. 2011, <i>Nature</i> 476:105). The silenced state is maintained through mitoses after warming. <b>Caveats:</b> the per-cell switching times (a Weibull distribution) and the mapping from the fraction of silenced cells to flowering time are <b>teaching assumptions</b>, not the molecular mechanism or fitted data; real lab accessions like Col-0 do not need cold; the reset happens in the embryo/seed (a reprogramming step), not instantly.",
  },
  agouti: {
    "y7-8": "A food rich in certain vitamins can change how much a gene is tagged. In these mice the tag changes the coat from yellow to brown. This is a special case, not a general rule about food, and it does not show the same thing in people.",
    "y9-10": "In the viable yellow agouti mouse, a piece of jumping DNA (a transposon) sits next to the <i>Agouti</i> gene and gives it an abnormal switch. When that DNA is tagged with methyl groups, the abnormal switch is silenced, so the gene is not made at the wrong times. The pup then has a normal brown coat and a lower risk of obesity and diabetes. When it is not tagged, the pup is yellow and prone to obesity. A mother's diet rich in methyl donors (folate, B12, choline, betaine) shifts her litter toward brown. This experiment does not show comparable effects in humans.",
    y11: "<b>Evidence:</b> Waterland &amp; Jirtle 2003, <i>Mol Cell Biol</i> 23:5293. Non-agouti (a/a) dams were mated with A<sup>vy</sup>/a males; maternal methyl-donor supplementation increased CpG methylation of the IAP transposon upstream of <i>Agouti</i>. Methylation silences the IAP's abnormal promoter and reduces inappropriate (ectopic) Agouti expression, so normal regulation gives a pseudoagouti (brown) coat and lowers obesity and diabetes risk. <b>Caveats:</b> this is a special case (an inserted transposon acting as a metastable epiallele); the maternal diet acts during pregnancy and lactation, so this is an intergenerational effect rather than proof of transgenerational inheritance of marks; this experiment does not show comparable effects in humans. The numbers here are teaching values.",
  },
  rabbit: {
    "y7-8": "A Himalayan rabbit is white with dark ears, nose and paws. The dark colour only forms where the skin is cool. This is the temperature changing how a protein works. It is <b>not</b> about tags on genes.",
    "y9-10": "A Himalayan rabbit's pigment-producing cells all carry the same temperature-sensitive version of the pigment enzyme (tyrosinase). The local skin temperature changes how well the enzyme works: it works in the cool ears, nose, paws and tail, and not in the warm body. Cool a shaved patch and the new fur grows dark. This is the environment changing the phenotype <b>without</b> epigenetic marks: the DNA is the same and no tags are needed. It is the enzyme that behaves differently with temperature.",
    y11: "<b>Evidence:</b> the Himalayan allele (<i>c<sup>h</sup></i>) of tyrosinase (<i>TYR</i>) encodes a temperature-sensitive enzyme that is inactive at normal body temperature and active in cooler extremities. Shaving and cooling a patch gives dark regrowth; warming the extremities gives pale regrowth. <b>Contrast case:</b> pigment-producing melanocytes carry the same temperature-sensitive <i>TYR</i> allele everywhere; local temperature changes the enzyme's activity (its stability and folding), and no change in histone marks or DNA methylation is needed to explain the pattern. It shows that \u201Cenvironment affects phenotype\u201D does not always mean epigenetics. The sigmoid and temperatures here are teaching values.",
  },
  twins: {
    y11: "<b>Evidence:</b> Fraga et al. 2005, <i>PNAS</i> 102:10604 compared DNA methylation and histone acetylation in 40 monozygotic twin pairs (80 people) aged 3 to 74, a cross-sectional study: young twins were very similar and older pairs tended to differ more, especially those with different lifestyles or less time spent together. <b>Caveats:</b> the effect is modest and most sites stay identical; later work shows methylation is also influenced by genotype and by random (stochastic) drift, and whether the changes cause differences in traits is debated. The yearly drift rate and the environment multiplier in the simulator are <b>illustrative assumptions</b>, not fitted to the study.",
  },
};

export const PARTS = {
  nucleosome: { name: { "y7-8": "A packing spool", "y9-10": "Nucleosome", y11: "Nucleosome" }, color: "#a5b4fc",
    role: { "y7-8": "DNA is wound around little spools made of proteins. The spools and the DNA together are the packaging of the recipe book.", "y9-10": "About 147 base pairs of DNA wound around a core of 8 histone proteins. The histones have flexible tails that can carry chemical tags.", y11: "~147 bp of DNA wrapped 1.65 times around a histone octamer (two each of H2A, H2B, H3, H4). The N-terminal tails protrude and carry post-translational modifications that readers and writers recognise." } },
  dna: { name: { "y7-8": "DNA string", "y9-10": "Linker DNA", y11: "Linker DNA" }, color: "#e9d5ff",
    role: { "y7-8": "The DNA between the spools.", "y9-10": "DNA between nucleosomes. Together with the nucleosomes it forms beads on a string when the gene is open.", y11: "Linker DNA between nucleosomes (here shown at a scale of about 10 nm per unit; linker lengths in vivo vary from ~20 to ~80 bp)." } },
  acetyl: { name: { "y7-8": "'On' tag", "y9-10": "Acetyl tag", y11: "Acetyl group (H3K27ac)" }, color: "#bef264",
    role: { "y7-8": "A tag that says “this gene can be used”.", "y9-10": "An acetyl group on a histone tail loosens the DNA so the gene can be read.", y11: "Histone acetylation (e.g. H3K27ac) neutralises lysine's positive charge, loosens DNA–histone contacts and is read by bromodomain proteins. Added by HATs, removed by HDACs. This is the only active mark simulated (H3K4me3 also marks active promoters but is not simulated)." } },
  methyl: { name: { "y7-8": "'Off' tag", "y9-10": "Methyl tag", y11: "Repressive methyl mark" }, color: "#e879f9",
    role: { "y7-8": "A tag that helps switch this gene off. (Some methyl tags help silence genes; others go with active genes.)", "y9-10": "Methyl groups on certain histone tail positions attract proteins that pack the DNA tightly so the gene is silent. Other methyl marks go with active genes.", y11: "H3K9me3 (constitutive heterochromatin, read by HP1) or H3K27me3 (facultative, deposited by PRC2 and read by PRC1). Removed by lysine demethylases (KDMs)." } },
  reader: { name: { "y7-8": "Tag reader", "y9-10": "Reader protein", y11: "Reader (HP1 / PRC2)" }, color: "#7dd3fc",
    role: { "y7-8": "A protein that reads the 'off' tag and helps pack the DNA up.", "y9-10": "Readers bind a tag and help to pack the DNA or add more of the same tag nearby.", y11: "HP1 dimers bind H3K9me3 and bridge nucleosomes (compaction); PRC2 binds H3K27me3 through EED, stimulating EZH2 to methylate neighbouring nucleosomes: a read–write positive-feedback loop." } },
  enzyme: { name: { "y7-8": "Tag helper", "y9-10": "Writer / eraser enzyme", y11: "Writer / eraser enzyme" }, color: "#fbbf24",
    role: { "y7-8": "A helper that adds or removes a tag.", "y9-10": "Writers add tags and erasers remove them.", y11: "HATs add acetyl, HDACs remove it; HMTs (e.g. EZH2 within PRC2, SUV39) add methyl, KDMs remove it. In this model each coloured enzyme corresponds to an actual state change the simulation made." } },
  cpg: { name: { "y7-8": "DNA tag", "y9-10": "CpG methylation", y11: "Promoter CpG site" }, color: "#f472b6",
    role: { "y7-8": "A tag on the DNA itself that helps keep a gene off.", "y9-10": "A methyl group on the DNA at the gene's start (promoter) helps keep the gene silent.", y11: "5-methylcytosine at CpG dinucleotides. DNMT3A/B methylate de novo, DNMT1 copies the mark onto the new strand (hemi-methylated DNA) after replication, TET enzymes oxidise it toward removal. Methyl-CpG-binding proteins recruit HDACs." } },
  pol: { name: { "y7-8": "The copier", "y9-10": "RNA polymerase II", y11: "RNA polymerase II" }, color: "#fb923c",
    role: { "y7-8": "The machine that copies a gene into a message.", "y9-10": "RNA polymerase II copies the gene into mRNA when the promoter is open.", y11: "RNA polymerase II needs access to the promoter; in the model it initiates at a rate set by the fraction of active nucleosomes near the promoter, reduced by CpG methylation." } },
  mrna: { name: { "y7-8": "Message", "y9-10": "mRNA", y11: "mRNA" }, color: "#60a5fa",
    role: { "y7-8": "The copy of the gene that leaves to make a protein.", "y9-10": "A copy of the gene, made when the gene is on.", y11: "The transcript. (Its processing and export are not shown.)" } },
  tf: { name: { "y7-8": "Switch protein", "y9-10": "Transcription factor", y11: "Activator / repressor" }, color: "#a3e635",
    role: { "y7-8": "A protein that switches a gene on (or off) when a signal arrives.", "y9-10": "A transcription factor bound near the promoter can recruit writer enzymes.", y11: "Sequence-specific factors can recruit HATs/co-activators (activator) or co-repressors, HDACs and HMTs (repressor) to the promoter. In the model they bias the promoter nucleosomes toward A or M." } },
  xa: { name: { "y7-8": "Working X", "y9-10": "Active X (Xa)", y11: "Active X (Xa)" }, color: "#93c5fd",
    role: { "y7-8": "The X chromosome that is switched on.", "y9-10": "The X chromosome that stays active in this cell.", y11: "The active X: open chromatin, most genes expressed." } },
  xi: { name: { "y7-8": "Switched-off X", "y9-10": "Inactive X (Barr body)", y11: "Inactive X / Barr body" }, color: "#f9a8d4",
    role: { "y7-8": "A tightly folded X chromosome that is mostly switched off. It is a small dark dot near the edge of the nucleus.", "y9-10": "The inactive X is packed into a dense <b>Barr body</b> near the edge of the nucleus. Most of its genes are silent.", y11: "Xi is coated in Xist RNA (acting in cis), carries H3K27me3, H2AK119ub, DNA methylation and macroH2A, replicates late and sits near the nuclear periphery (~1 µm). Human estimates: roughly 15% of X genes escape inactivation; this varies by gene, tissue and person." } },
  xist: { name: { "y7-8": "Coating RNA", "y9-10": "Xist RNA", y11: "Xist lncRNA" }, color: "#22d3ee",
    role: { "y7-8": "A long RNA message that spreads over one X and tells it to switch off.", "y9-10": "Xist is an RNA made from one X chromosome. It coats that same chromosome (only that one) and starts the silencing.", y11: "A ~17 kb long non-coding RNA transcribed from the X-inactivation centre. It coats the X it is made from (in cis) and recruits silencing complexes (e.g. SPEN, PRC1/2)." } },
  xk27: { name: { "y7-8": "'Off' tags on the X", "y9-10": "Silencing tags on the inactive X", y11: "H3K27me3 on Xi" }, color: "#e879f9",
    role: { "y7-8": "Tags that help keep this X switched off.", "y9-10": "Methyl tags that build up on the inactive X and help keep its genes silent.", y11: "Polycomb-deposited H3K27me3 accumulating along Xi after Xist coating (drawn in a fixed number of positions; not a map of real sites)." } },
  xdna: { name: { "y7-8": "DNA tags on the X", "y9-10": "DNA methylation on the inactive X", y11: "CpG methylation on Xi" }, color: "#f472b6",
    role: { "y7-8": "Tags on the DNA of the switched-off X.", "y9-10": "Methyl groups on the DNA of the inactive X help lock the silencing in.", y11: "DNA methylation of CpG islands on Xi helps maintain silencing (drawn schematically)." } },
  autosome: { name: { "y7-8": "Other chromosomes", "y9-10": "Autosomes", y11: "Autosome territories" }, color: "#64748b",
    role: { "y7-8": "The other chromosomes, which stay switched on.", "y9-10": "Chromosomes that are not the sex chromosomes. They are not inactivated.", y11: "Autosomal chromosome territories (faint here: only a few of the 22 pairs are drawn)." } },
  ycell: { name: { "y7-8": "Y chromosome", "y9-10": "Y chromosome", y11: "Y chromosome" }, color: "#a78bfa",
    role: { "y7-8": "The small Y chromosome. It has few genes and does not get switched off.", "y9-10": "The small Y chromosome. It is not inactivated, but it carries few genes.", y11: "The Y carries few genes. Its pseudoautosomal regions pair with the X in meiosis; the Y is not inactivated." } },
  mcell: { name: { "y7-8": "A skin cell", "y9-10": "Cell in the sheet", y11: "Cell in the sheet" }, color: "#fdba74",
    role: { "y7-8": "One cell. Its colour shows which X chromosome is working in it.", "y9-10": "One cell. The colour shows which X is active. Its daughters will inherit the same inactive X.", y11: "One cell of the mosaic. The inactive X is maintained through division, so a cell's daughters share it and neighbours are often related." } },
  vcell: { name: { "y7-8": "A plant cell", "y9-10": "Plant cell", y11: "Leaf-cell nucleus (FLC)" }, color: "#86efac",
    role: { "y7-8": "A plant cell. A bright nucleus means the 'no flowering yet' gene is on; dark means it is off.", "y9-10": "A plant cell. A glowing nucleus means <i>FLC</i> is on (flowering blocked); dark means silenced.", y11: "A cell with FLC either expressed (bright) or Polycomb-silenced (dark). The switch is digital per cell." } },
  pup: { name: { "y7-8": "A mouse pup", "y9-10": "Mouse pup", y11: "A<sup>vy</sup> pup" }, color: "#e6b33c",
    role: { "y7-8": "One pup. The more tags on its gene, the browner its coat.", "y9-10": "One pup. More methylation near the <i>Agouti</i> gene gives a browner coat.", y11: "A<sup>vy</sup>/a pup. Methylation of the IAP transposon sets the coat class." } },
  rcell: { name: { "y7-8": "A skin patch", "y9-10": "Skin and fur cells", y11: "Follicle cells" }, color: "#e5e7eb",
    role: { "y7-8": "A bit of skin. The colour shows how dark the fur grows there.", "y9-10": "Skin cells. In cool skin the enzyme works and the fur grows dark.", y11: "A follicle region at its local skin temperature; pigment depends on temperature-sensitive tyrosinase activity." } },
  twin: { name: { y11: "CpG site" }, color: "#f472b6", role: { y11: "A CpG site. A ring marks sites that now differ between the twins." } },
};

export const HERITABLE = {
  title: { "y7-8": "Can it be passed on?", "y9-10": "Is it heritable?", y11: "Is it heritable?" },
  head: { c: { "y7-8": "Change" }, d: { "y7-8": "Copied when cells divide?", "y9-10": "Can be maintained when cells divide?" }, p: { "y7-8": "Passed to children?", "y9-10": "Passed to children?" } },
  rows: [
    { c: { "y7-8": "A change in the DNA of a body cell", "y9-10": "Mutation in a body cell", y11: "Mutation in a somatic cell" }, d: "Yes", p: { "y7-8": "Not through having children (a plant grown from a cutting can carry it)", "y9-10": "Not through sexual reproduction (plants grown from cuttings or runners can carry somatic changes)", y11: "Not through sexual reproduction; plants propagated from cuttings or runners can carry somatic changes" } },
    { c: { "y7-8": "A change in the DNA of a sperm or egg", "y9-10": "Mutation in a sperm or egg cell", y11: "Mutation in a gamete (germline)" }, d: "Yes", p: { "y7-8": "Can be passed on if that sperm or egg makes a baby", "y9-10": "Can be passed on if that gamete forms the offspring", y11: "Can be transmitted if that gamete forms the offspring" } },
    { c: { "y7-8": "A tag on a gene in a body cell", "y9-10": "Epigenetic mark in a body cell", y11: "Epigenetic mark in a somatic cell" }, d: { "y7-8": "Often, but not perfectly", "y9-10": "Can be maintained; maintenance is imperfect", y11: "Can be maintained through mitosis (e.g. DNMT1); maintenance is imperfect" }, p: { "y7-8": "Not through having children", "y9-10": "Not through sexual reproduction", y11: "Not through sexual reproduction (somatic marks do not reach the gametes)" } },
    { c: { "y7-8": "A tag on a gene in sperm or egg cells", "y9-10": "Epigenetic mark in the germline", y11: "Epigenetic mark in the germline" }, d: { "y7-8": "Often, but not perfectly", "y9-10": "Can be maintained; maintenance is imperfect", y11: "Can be maintained through mitosis; maintenance is imperfect" }, p: { "y7-8": "Mostly wiped in mammals; some plants keep them", "y9-10": "Mostly reset in mammals (erased in germ cells and in the early embryo); more often kept in plants", y11: "Mostly reset in mammals: erased in primordial germ cells and reprogrammed in the early embryo (imprints are re-set according to germline sex and protected); more often retained in plants" } },
  ],
  note: {
    "y7-8": "Some people say only changes to the DNA are passed on. That is nearly right for children in people. But tags on genes can often be kept when a cell divides, and in some plants they can be passed on to the next generation.",
    "y9-10": "Some people say only genetic changes are inherited. That is nearly right for passing traits to children in humans, but epigenetic states can be maintained when a cell divides (maintenance is imperfect), and some can be passed between generations, especially in plants. The Peloric toadflax (<i>Linaria</i>) is a classic plant example (Cubas et al. 1999).",
    y11: "\u201COnly genetic changes are heritable\u201D is too simple. Mutations in the DNA sequence are the main source of heritable variation between generations. Epigenetic states can be maintained through mitosis (that is how a liver cell stays a liver cell), but maintenance is imperfect. Across generations in mammals most marks are erased twice (in primordial germ cells and again in the early embryo). Imprints are erased in primordial germ cells and re-established according to the sex of the germline; once set, imprints are protected from the early-embryo reprogramming, so imprinting is not evidence that acquired marks survive between generations. Proven transgenerational cases in mammals are rare and debated, and plants pass epialleles on more often (e.g. peloric <i>Linaria</i>, Cubas et al. 1999; Arabidopsis epialleles). <i>Intergenerational</i> effects (e.g. the mother's pregnancy environment) are not the same thing as transgenerational inheritance of marks.",
  },
};

// ---------------------------------------------------------------------------------------------------------------- narrative
const regimeWord = (b, r) => ({ M: pick({ "y7-8": "mostly switched off", "y9-10": "mostly silencing tags", y11: "mostly repressive (M)" }, b), A: pick({ "y7-8": "mostly switched on", "y9-10": "mostly active tags", y11: "mostly active (A)" }, b), mixed: pick({ "y7-8": "a mixture", "y9-10": "a mixture of tags", y11: "mixed (neither M nor A dominates)" }, b) })[r];
const TXW = (s, b, sen) => s.txState === "on" ? `RNA polymerase II is transcribing at about <b>${pct(s.txRate)}</b> of the maximum rate` : s.txState === "reduced" ? `RNA polymerase II can only occasionally start (${pct(s.txRate)} of the maximum rate)` : `RNA polymerase II cannot start: the gene is off${sen ? "" : ""}`;

function marksNarrative(c, b) {
  const s = c.sim, out = [];
  const fa = s.fracA, fm = s.fracM, st = s.txState;
  const sen = b === "y11" || b === "y12";
  if (b === "y7-8") {
    out.push(`${pct(fm)} of the spools carry an 'off' tag and ${pct(fa)} carry an 'on' tag. The gene is <b>${st === "on" ? "switched on: messages are being made" : st === "reduced" ? "mostly off: only a few messages are made" : "switched off: no messages are made"}</b>.`);
    if (s.act > 0.05 && s.rep < 0.05) out.push("A switch protein near the start of the gene can add 'on' tags.");
    else if (s.rep > 0.05 && s.act < 0.05) out.push("A switch protein near the start of the gene can add 'off' tags.");
  } else {
    const cluster = s.regime, wA = s.winFrac(1), wM = s.winFrac(-1), cp = s.cpgFrac;
    out.push(`${sen ? "Nucleosome states" : "Tags"}: <b>${pct(fa)}</b> ${sen ? "A (acetylated, active)" : "active"}, <b>${pct(s.fracU)}</b> unmarked, <b>${pct(fm)}</b> ${sen ? "M (repressive)" : "silencing"}. The stretch is ${regimeWord(b, cluster)}${cluster === "M" ? ", so the DNA is packed and reader proteins sit on the tags" : cluster === "A" ? ", so the DNA is loose (beads on a string)" : ""}.`);
    out.push(`Promoter region: ${pct(wA)} active, ${pct(wM)} repressive${sen ? ` and ${Math.round(cp * 8)} of 8 CpG sites methylated (hemi-methylated sites count one half)` : `; DNA methylation ${pct(cp)}`}. ${TXW(s, b, sen)}${cp > 0.2 && wA > 0.4 ? " (methylated CpGs reduce it)" : ""}.`);
    if (s.act > 0.05 || s.rep > 0.05 || s.hdaci || s.dnmt3) {
      const bits = [];
      if (s.act > 0.05) bits.push(sen ? `an activator signal (${pct(s.act)}) can recruit HATs to the promoter` : "an 'on' signal can add active tags at the promoter");
      if (s.rep > 0.05) bits.push(sen ? `a repressor signal (${pct(s.rep)}) can recruit HMTs and HDACs to the promoter` : "an 'off' signal can add silencing tags at the promoter");
      if (s.hdaci && sen) bits.push("the HDAC inhibitor blocks A\u2192U conversion, so acetyl marks cannot be removed");
      if (s.dnmt3 && sen) bits.push("DNMT3 is switched on and can methylate promoter CpGs, mainly where nucleosomes are repressive");
      out.push(`Right now ${bits.join("; ")}.`);
    }
    if (sen) out.push(`Feedback ratio F = ${s.F.toFixed(1)} (recruited conversions with probability \u03B1 = ${s.alpha.toFixed(2)}). ${s.F >= 4 ? "With strong feedback a state can persist, provided the signals are roughly balanced (in this model, persistent states usually appear for F above about 4)." : s.F > 0.2 ? "With weak feedback the state is fragile and switches easily." : "With no feedback (F near 0) nothing is recruited, so nucleosomes drift to a mixed state."}`);
    else out.push(s.F >= 4 ? "Tags can recruit more of the same tag on other nucleosomes in the patch. That feedback can give <b>memory</b>." : "Feedback is off: tags do not recruit each other, so no pattern can last.");
  }
  if (s.divs > 0) {
    const rec = s.recovery, since = s.t - s.divT, restored = rec != null && rec >= 0.85, regime = s.pre?.regime;
    let w;
    if (regime === "mixed" || rec == null) w = b === "y7-8" ? "The tags were shared out." : "There was no clear pattern to restore.";
    else if (restored) w = b === "y7-8" ? `The pattern has come back: the gene is ${s.silent ? "still off" : st === "on" ? "still on" : "mostly as before"}, so the cell remembered.` : `The pattern is <b>restored</b> (${pct(rec)} of the pre-division level): ${s.silent ? "the gene is still silent." : st === "on" ? "the gene is still on." : "the state matches the one before division."}`;
    else w = since < 3 ? (b === "y7-8" ? "About half the tags were lost. The ones that are left are helping to put the rest back." : `Marks were <b>diluted</b> by about half and are being restored by feedback (${pct(rec)} of the pre-division level so far).${s.silent ? " The gene is still silent for now." : ""}`) : (b === "y7-8" ? "The tags have not come back: the cell has partly forgotten." : `The pattern has <b>not been restored</b> (${pct(rec)} of the pre-division level); the memory is fading.`);
    out.push(`Divisions so far: <b>${s.divs}</b>. At each division only about half of the old nucleosomes (and their marks) pass to each new strand; the rest are new and unmarked. ${sen ? "CpG sites become hemi-methylated and DNMT1 makes one maintenance attempt (about 95% of sites succeed per division). " : ""}${w}${s.streak >= 1 ? ` Silent through ${s.streak} signal-free division${s.streak > 1 ? "s" : ""} in a row.` : ""}`);
  } else if (b === "y7-8") out.push("Press <b>Divide the cell</b> to see what happens to the tags.");
  return out;
}

function xNarrative(c, b) {
  const out = [], kt = KARYOTYPES[c.kt], barr = barrBodies(c.kt), sen = b === "y11" || b === "y12";
  if (c.scene === "sheet") {
    const st = c.stats, u = c.used, ex = (u ? u.example : c.next.example) === "aed" ? { a: "cells with the working copy of the gene (sweat glands)", b: "cells with the faulty copy active (no glands)" } : { a: "black (o) cells", b: "orange (O) cells" };
    if (!u || !st || st.total === 0) { out.push("Press <b>Start inactivation</b> to choose the first cells and switch one X off in each."); return out; }
    out.push(`<b>${u.founders}</b> founder cells each switched off one X at random${u.skew !== 0.5 && sen ? ` (skewed: ${pct(u.skew)} switched off X\u2082)` : " (about 50:50)"}. Their daughters inherited the same choice, so cells now sit in <b>${st.patches}</b> clonal patch${st.patches === 1 ? "" : "es"} (largest ${st.largest} cells; average ${st.meanSize.toFixed(1)}).`);
    out.push(`${pct(st.frac0)} ${ex.a}, ${pct(st.frac1)} ${ex.b}. ${u.founders <= 4 ? "Few founders gave a few large patches: inactivation happened early, when the embryo had few cells." : u.founders >= 24 ? "Many founders gave a fine, speckled mosaic: inactivation happened later, when the embryo already had many cells." : "More founders mean smaller patches; fewer founders mean larger patches."}`);
    if (st.total < c.n) out.push(`Cells are still dividing: ${st.total} of ${c.n} placed.`);
    if (u.founders !== c.next.founders || u.skew !== c.next.skew || u.example !== c.next.example) out.push(`<span class="hint">The next run will use ${c.next.founders} founders${sen ? `, skew ${pct(c.next.skew)}` : ""}.</span>`);
    return out;
  }
  out.push(`Karyotype <b>${kt.label}</b> (${kt.name}): ${kt.nX} X chromosome${kt.nX === 1 ? "" : "s"}${kt.nY ? " and a Y" : ""}. Barr bodies expected: ${kt.nX} \u2212 1 = <b>${barr}</b>.`);
  const ph = c.phase;
  if (barr === 0) out.push(`With only one X there is nothing to switch off, so the nucleus has <b>no</b> Barr body. The single X is active.`);
  else if (ph === "none") out.push(`All ${kt.nX} X chromosomes are active at the moment (before inactivation, as in an early embryo). Press <b>Switch one X off</b>.`);
  else if (ph === "xist") out.push(`${sen ? "Xist RNA is made from the X that will be inactivated, and spreads along it in cis" : "A long RNA message is made from one X and spreads over that same X"} (${c.xistPct}% coated).${c.which ? ` ${sen ? "The choice (random in each cell) fell on the" : "Chosen at random: the"} <b>${c.which}</b> X.` : ""}`);
  else if (ph === "condense") out.push(`The coated X is condensing${sen ? "; H3K27me3 and DNA methylation are building up" : ""} and moving toward the edge of the nucleus.`);
  else out.push(`${barr} X chromosome${barr > 1 ? "s are" : " is"} now switched off and packed as <b>${barr} Barr bod${barr > 1 ? "ies" : "y"}</b>; one X stays active (normally one active X in the body cells modelled here). ${sen ? "Xist acts in cis, so the active X is not coated. Some genes escape (human estimates ~15%, varying by gene, tissue and person)." : "The active X keeps working."}`);
  if (c.kt === "X0" || c.kt === "XXY" || c.kt === "XXX") out.push(sen ? "Why do X0 and XXY still have symptoms? Inactivation is not total: escape genes (e.g. <i>SHOX</i> in the pseudoautosomal region) stay expressed from the inactive X, so dosage of those genes differs from a typical XX or XY person. Gene dosage before inactivation is complete also matters." : "Switching off one X does not stop every gene on it, so having a different number of X chromosomes can still affect health.");
  return out;
}

function envNarrative(c, b) {
  const sen = b === "y11" || b === "y12", out = [];
  if (c.ex === "vern") {
    const v = c.vern;
    out.push(`Cold exposure: <b>${v.weeks} week${v.weeks === 1 ? "" : "s"}</b>. ${pct(v.fOff)} of the cells have switched their ${sen ? "<i>FLC</i> gene off (Polycomb H3K27me3 silencing)" : "'no flowering yet' gene off"}. ${v.weeks === 0 ? "No cold yet: every cell still has the gene on." : v.fOff > 0.05 && v.fOff < 0.95 ? sen ? "Each cell switched digitally, all-or-nothing and independently, so the plant is a mixture of ON and OFF cells rather than every cell half-silenced." : "Each cell is either fully on or fully off; the cold just changes how many have switched." : ""}`);
    if (!v.warm) out.push(`${sen ? "Expected on average" : "On average"} ${pct(vernFraction(v.weeks))} of cells switch after ${v.weeks} weeks of cold (teaching values; the actual number varies from plant to plant).`);
    else out.push(`After warming (week <b>${Math.floor(v.elapsed)}</b> of growth), the switched-off cells ${sen ? "keep their silencing through mitosis (epigenetic memory)" : "stay off, and so do their daughters (memory)"}. Predicted flowering time for ${pct(v.fOff)} cells off: <b>${v.flower.toFixed(0)} weeks</b> after warming ${v.fOff >= 0.9 ? "(early: most cells have lost the flowering blocker)" : v.fOff < 0.3 ? "(very late: much of the flowering blocker remains)" : "(later: only some cells are off)"}. ${v.flowered ? "<b>The plant has flowered.</b>" : "Waiting for the clock to reach that week."} <span class="hint">The weeks-to-flower mapping is a teaching assumption.</span>`);
    if (v.reset) out.push("A new generation: the seed reset every cell, so the tags are gone and the new plant needs its own winter.");
  } else if (c.ex === "agouti") {
    const a = c.agouti, label = (d) => (d < 0.15 ? "standard" : d < 0.6 ? "some methyl donors added" : "rich in methyl donors");
    if (a.litter && a.litter.length) {
      const counts = AGOUTI_CLASSES.map((cl, i) => a.litter.filter((p) => p.cls === i).length);
      out.push(`This litter was bred on a <b>${label(a.litterDiet)}</b> maternal diet (${sen ? "folate, B12, choline, betaine" : "vitamins and nutrients"}), giving an average methylation near the <i>Agouti</i> gene of about <b>${pct(agoutiMean(a.litterDiet))}</b>: ${counts.map((n, i) => `${n} ${AGOUTI_CLASSES[i].name}`).filter((_, i) => counts[i]).join(", ")}. Even in one litter, pups vary because the marks are set partly by chance.${a.total > 8 ? ` Across ${a.total} pups bred so far (on any diet), ${pct(a.brownShare)} are brown or brown-mottled.` : ""}`);
      if (Math.abs(a.diet - a.litterDiet) > 0.04) out.push(`<span class="hint">The diet slider is now set to ${label(a.diet)} (average methylation ${pct(agoutiMean(a.diet))}); breed another litter to see it.</span>`);
    } else out.push(`Press <b>Breed a litter</b> to see how the maternal diet (now set to ${label(a.diet)}) changes the pups.`);
  } else if (c.ex === "rabbit") {
    const r = c.rabbit;
    out.push(`The enzyme that makes dark pigment works at ${pct(tyrActivity(36.8))} of its maximum at body temperature (about 37 \u00B0C) and ${pct(tyrActivity(28))} in a cool ear (about 28 \u00B0C), so ears, nose and paws grow dark fur and the warm body grows white fur.`);
    if (!r.shaved) out.push(`Shave a patch on the back and cool it (the patch temperature is currently set to ${r.temp.toFixed(0)} \u00B0C), then let the fur regrow.`);
    else if (!r.regrown) out.push(`A patch on the back has been shaved and cooled to <b>${r.applied.toFixed(0)} \u00B0C</b>. Press <b>Let the fur regrow</b>.`);
    else out.push(`The patch regrew ${r.regrowTemp <= 32 ? "<b>dark</b>" : r.regrowTemp >= 36 ? "white (no change: it was still warm)" : "grey"} because skin at <b>${r.regrowTemp.toFixed(0)} \u00B0C</b> lets the enzyme work (${pct(tyrActivity(r.regrowTemp))} of maximum activity). The DNA did not change and no tags were needed: the pigment cells carry the same temperature-sensitive enzyme everywhere, and the <b>protein</b> simply works only where it is cool. That is the environment changing the phenotype <b>without</b> an epigenetic mark.${Math.abs(r.temp - r.regrowTemp) > 0.5 ? ` <span class="hint">The slider is now ${r.temp.toFixed(0)} \u00B0C for the next experiment.</span>` : ""}`);
  } else if (c.ex === "twins") {
    const t = c.twins;
    out.push(`At age <b>${t.age}</b>, ${t.diff} of ${TWIN.sites} CpG sites (${pct(t.diff / TWIN.sites)}) differ between the twins${t.age === 0 ? " (they begin identical in this model)" : ""}. With ${t.env < 0.2 ? "very similar lifestyles" : t.env > 0.7 ? "quite different lifestyles" : "somewhat different lifestyles"}, the expected difference in this model is about ${pct(twinExpected(t.age, t.env))} of sites.`);
    out.push("Most sites stay the same. The drift is partly random (every copy of a methylation mark is slightly imperfect) and partly pushed along by environment; the size of the environmental effect is debated and the rates in this simulator are illustrative assumptions.");
  }
  return out;
}

export function narrative(ctx, band) {
  if (ctx.view === "x") return xNarrative(ctx, band);
  if (ctx.view === "env") return envNarrative(ctx, band);
  return marksNarrative(ctx, band);
}

// ---------------------------------------------------------------------------------------------------------------- missions & quiz
// check(S): S is the level's live state bundle.
export const MISSIONS = [
  { band: "y7-8", text: "<b>Switch the gene off and keep it off</b> through 3 cell divisions <b>without any switch signal helping</b>. (Set the 'off' signal high until the gene is off, turn both signals back to zero, then use <b>Divide the cell</b> three times with feedback on.)", check: (S) => S.sim.maxStreak >= 3 },
  { band: "y11", text: "Show that <b>memory fails without feedback</b>: reset to <i>gene silent</i>, set the feedback ratio F to 1.5 or below, turn both signals off, divide 3 times, and watch the silent state decay.", check: (S) => S.sim.lowFDivs >= 3 && S.sim.start === "M" && S.sim.F <= 1.5 && S.sim.fracM < 0.5 },
  { band: "y7-8", text: "Make a <b>Barr body</b>: in the X-inactivation view press <b>Switch one X off</b> and wait for the compact dot near the nucleus edge.", check: (S) => S.xDone && S.xBarr >= 1 },
  { band: "y9-10", text: "<b>Predict</b> the number of Barr bodies in an <b>XXY</b> cell <i>before</i> pressing Switch one X off, then check it with the simulation.", check: (S) => S.predictXXY },
  { band: "y7-8", text: "Make a <b>patchwork (calico-style) sheet</b> of cells: choose the cat example, run the sheet to completion with at least 16 founder cells, and see both colours.", check: (S) => S.mosaicDone },
  { band: "y7-8", text: "Get <b>90% of the plant cells</b> to switch the flowering blocker off with cold, then press <b>Warm and grow</b>.", check: (S) => S.vernWarmed },
  { band: "y7-8", text: "Feed a <b>methyl-rich diet</b> (at least 60%) and <b>breed a litter</b> in which at least 5 of 8 pups are brown or brown-mottled.", check: (S) => S.agoutiMaxBrown >= 5 },
  { band: "y7-8", text: "<b>Shave and cool</b> a patch on the rabbit to 31 \u00B0C or less, let it regrow dark, then read <i>Why isn't this epigenetic?</i>", check: (S) => S.rabbitDone && S.rabbitWhy },
];

export const QUIZ = [
  { band: "y7-8", maxBand: "y7-8", q: "A skin cell and a nerve cell in the same person contain essentially the same DNA instructions. Why do they look and act differently?", options: ["Different genes are switched on and off in each", "They have completely different recipe books", "Skin cells have extra DNA", "Nerve cells have no DNA"], answer: 0, why: "Most body cells contain essentially the same DNA instructions. Tags on the packaging help switch different genes on or off in different cell types." },
  { band: "y7-8", maxBand: "y7-8", q: "Why are calico cats nearly always female?", options: ["Females have two X chromosomes and switch off a different one in different cells", "Males cannot grow orange fur", "Only females eat the right food", "Female cats have more fur"], answer: 0, why: "The orange/black gene is on the X. A female can carry both colours and switches off a different X in different patches of cells. (Rare XXY male cats can also be calico.)" },
  { band: "y9-10", q: "What does a cell with an XXX karyotype show?", options: ["2 Barr bodies", "1 Barr body", "3 Barr bodies", "No Barr bodies"], answer: 0, why: "Barr bodies = number of X chromosomes \u2212 1. XXX has three X chromosomes, so two are packed as Barr bodies and one stays active." },
  { band: "y9-10", q: "Which statement about epigenetic marks is the most accurate?", options: ["They can be maintained when cells divide, but in mammals most are reset before the next generation", "They are never copied", "They always pass from parent to child", "They change the DNA sequence"], answer: 0, why: "Epigenetic states can be maintained through cell division (imperfectly), but in mammals most are reset in the germline and the early embryo." },
  { band: "y9-10", q: "A Himalayan rabbit grows dark fur on a cooled, shaved patch. Which is the best explanation?", options: ["A temperature-sensitive enzyme works in the cool skin; no epigenetic mark is needed", "Cold adds methyl tags to the gene", "Cold changes the DNA sequence", "The shaved patch was already dark under the fur"], answer: 0, why: "The pigment cells carry the same temperature-sensitive tyrosinase everywhere; it works only where it is cool. This is environment affecting phenotype without epigenetics." },
  { band: "y9-10", q: "In vernalisation, why does a plant that was cold in winter flower in spring?", options: ["The cold silenced a flowering-blocker gene, and the cells keep it silent after warming", "The cold changed the plant's DNA", "Plants flower whenever they are warm", "The seeds are cold"], answer: 0, why: "A prolonged cold spell silences FLC with Polycomb marks. The silent state is maintained when cells divide, so the plant flowers after the winter." },
  { band: "y11", q: "In this teaching model, why does replication not destroy the memory when feedback is strong?", options: ["About half the old marked nucleosomes remain and recruit writers that restore the pattern", "Marks are copied perfectly during replication", "New histones carry the same marks", "The DNA sequence stores the marks"], answer: 0, why: "Old histones are shared between daughter strands, diluting marks to about half. Remaining marked nucleosomes recruit writers to mark other unmarked nucleosomes." },
  { band: "y11", q: "Which enzyme copies DNA methylation onto the new strand after replication?", options: ["DNMT1", "DNMT3A/B", "TET", "HDAC"], answer: 0, why: "DNMT1 recognises hemi-methylated CpGs and methylates the new strand (maintenance, imperfect). DNMT3A/B act de novo; TET enzymes begin removal; HDACs remove acetyl groups." },
  { band: "y11", q: "How does Xist silence an X chromosome?", options: ["It coats the X it was made from (in cis) and is followed by silencing complexes", "It enters the nucleus and silences both Xs", "It cuts the DNA of the X chromosome", "It is a protein that blocks translation"], answer: 0, why: "Xist is a long non-coding RNA that spreads along the X it is made from, and silencing machinery such as Polycomb follows. It does not silence the other X." },
  { band: "y12", q: "Which is the best evidence-based statement about transgenerational epigenetic inheritance?", options: ["Plants pass epialleles on often; in mammals most marks are erased twice, and proven cases are rare and debated", "It is common and well proven in humans", "It never happens in any organism", "It always changes the DNA sequence"], answer: 0, why: "Marks are erased in primordial germ cells and reprogrammed in the early embryo in mammals; imprints are re-established according to germline sex and protected, which is not evidence that acquired marks survive. Peloric Linaria and Arabidopsis epialleles are well-established plant examples." },
  { band: "y12", q: "In Waterland & Jirtle (2003), non-agouti (a/a) mothers mated with A^vy/a fathers were given a methyl-donor supplement and their A^vy/a pups were browner. Which caveat is most important?", options: ["It is a special case (a transposon), and the effect acts via the mother's pregnancy environment, so it does not show transgenerational inheritance or comparable effects in humans", "It proves diet changes the human DNA sequence", "Methyl donors turn the Agouti gene into a different gene", "The pups are not related to the mother"], answer: 0, why: "A^vy depends on methylation of an inserted transposon (a metastable epiallele) that silences its abnormal promoter. The diet acts on the mother during pregnancy, which is an intergenerational effect, and the experiment does not show comparable effects in humans." },
  { band: "y12", q: "Why do X0 and XXY individuals still show phenotypic effects despite X-inactivation?", options: ["Some genes escape inactivation, and dosage before inactivation is complete also matters", "X-inactivation does not occur in them", "Barr bodies cause the symptoms", "The Y chromosome is inactivated"], answer: 0, why: "Human estimates suggest roughly 15% of X genes escape inactivation (more in some regions, such as the pseudoautosomal region), so the number of X chromosomes still changes gene dosage." },
];
