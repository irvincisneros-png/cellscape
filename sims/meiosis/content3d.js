// Text for the 3D meiosis level: phase names, part descriptions, traits, missions, quiz and the
// "What's happening" narrative (generated from the level's state, never from switch positions alone).
import { isRecomb, REC_FREQ } from "./model.js";

export const PHASES = [
  { id: "g1", dur: 0.9, name: { "y7-8": "Before dividing (G1)", "y9-10": "Interphase (G1)" } },
  { id: "s", dur: 2.4, auto: true, name: { "y7-8": "Copying the DNA (S phase)", "y9-10": "S phase (DNA replication)" } },
  { id: "pro1", dur: 3.2, name: { "y7-8": "Pairing and swapping (prophase I)", "y9-10": "Prophase I", y11: "Prophase I (synapsis, crossing over)" } },
  { id: "dip", dur: 2.6, auto: true, name: { "y7-8": "Pairs loosen (late prophase I)", "y9-10": "Late prophase I", y11: "Late prophase I (diplotene–diakinesis)" } },
  { id: "met1", dur: 2.2, name: "Metaphase I" },
  { id: "ana1", dur: 2.6, auto: true, name: "Anaphase I" },
  { id: "tel1", dur: 2.6, auto: true, name: { "y7-8": "Telophase I (two cells)", "y9-10": "Telophase I & cytokinesis" } },
  { id: "met2", dur: 2.4, name: "Metaphase II" },
  { id: "ana2", dur: 2.2, auto: true, name: "Anaphase II" },
  { id: "tel2", dur: 2.6, auto: true, name: { "y7-8": "Telophase II (four cells)", "y9-10": "Telophase II & cytokinesis" } },
  { id: "done", dur: 1.2, name: { "y7-8": "Four new cells", "y9-10": "Four haploid cells" } },
];
export const P = { G1: 0, S: 1, PRO1: 2, DIP: 3, MET1: 4, ANA1: 5, TEL1: 6, MET2: 7, ANA2: 8, TEL2: 9, DONE: 10 };

/** Product names: plants make spores by meiosis (they become pollen / the embryo sac), animals make gametes. */
export const productName = (org, pl = true, band = "y9-10") => {
  if (org === "plant") return band === "y7-8" ? (pl ? "pollen cells" : "pollen cell") : (pl ? "spores" : "spore");
  return band === "y7-8" ? (pl ? "sex cells" : "sex cell") : (pl ? "gametes" : "gamete");
};

// ---------- traits (complete dominance; model genes) ----------
export const TRAITS = {
  plant: {
    A: { trait: "Flower colour", dom: "purple", rec: "white" },
    B: { trait: "Stem height", dom: "tall", rec: "short" },
    D: { trait: "Seed shape", dom: "round", rec: "wrinkled" },
    note: {
      "y7-8": "Model genes based on Mendel's pea plants.",
      "y9-10": "Model genes based on Mendel's pea plants (purple/white flowers, tall/short stems, round/wrinkled seeds). In this model A and B sit on the same chromosome to show linkage.",
      y11: "Model genes after Mendel's peas. Their positions are invented for teaching: here A and B are linked on pair 1 (≈ " + Math.round(REC_FREQ * 100) + " % recombination) and D is on pair 2.",
    },
  },
  animal: {
    A: { trait: "Pigment (albinism)", dom: "typical pigment", rec: "albinism" },
    B: { trait: "Earwax type", dom: "wet earwax", rec: "dry earwax" },
    D: { trait: "Cystic fibrosis gene", dom: "no CF", rec: "cystic fibrosis" },
    note: {
      "y7-8": "Real human genes, simplified.",
      "y9-10": "Real single-gene human traits, simplified: albinism (TYR gene) and cystic fibrosis (CFTR) are recessive; wet earwax (ABCC11) is dominant to dry. Most human traits involve many genes plus the environment.",
      y11: "Simplified single-gene traits (TYR → albinism, ABCC11 → earwax type, CFTR → cystic fibrosis, all autosomal). In real people these are on chromosomes 11, 16 and 7; here A and B share pair 1 so you can study linkage.",
    },
  },
};
export const phenoName = (org, gene, dominant) => TRAITS[org][gene][dominant ? "dom" : "rec"];

// ---------- parts (hover titles and the Selected card) ----------
export const PARTS = {
  chromatid: {
    color: "#f472b6",
    name: { "y7-8": "Chromosome", "y9-10": "Chromatid", y11: "Chromatid" },
    role: {
      "y7-8": "A long DNA molecule carrying many genes. Pink came from this plant's (or person's) mother, blue from its father. After copying, each chromosome is two identical copies joined in the middle.",
      "y9-10": "One DNA molecule, tightly coiled. Pink chromosomes came from the mother, blue from the father. The bands with letters are genes; the letter is the allele (capital = dominant).",
      y11: "One of the two sister chromatids made in S phase. Colours show parental origin, so a crossover appears as a change of colour along a chromatid. Bands = loci; letters = alleles.",
    },
  },
  cohesinArm: {
    color: "#facc15",
    name: { "y7-8": "Glue protein (cohesin)", "y9-10": "Cohesin (arm)", y11: "Arm cohesin (Rec8)" },
    role: {
      "y7-8": "Ring-shaped proteins that hold the two copies together. They are cut at the right moment so the cell can pull things apart.",
      "y9-10": "Cohesin rings hold sister chromatids together along their arms. Beyond a chiasma, this cohesion also holds the two homologues together, so arm cohesin is cut at anaphase I to let homologues separate.",
      y11: "Meiotic cohesin (kleisin subunit Rec8) loaded during S phase. Arm cohesion distal to each chiasma holds the bivalent together. At anaphase I separase cleaves arm Rec8 → chiasmata resolve → homologues separate.",
    },
  },
  cohesinCen: {
    color: "#fb923c",
    name: { "y7-8": "Glue at the centre", "y9-10": "Cohesin (centromere)", y11: "Centromeric cohesin" },
    role: {
      "y7-8": "The glue in the middle stays on through the first division, so the two copies travel together.",
      "y9-10": "Cohesin at the centromere is protected during meiosis I, so sister chromatids stay together. It is only cut in anaphase II, which is why sisters separate in the second division.",
      y11: "Centromeric Rec8 is protected from separase in meiosis I by shugoshin (which recruits the phosphatase PP2A). It is cleaved at anaphase II, separating sister chromatids.",
    },
  },
  shugoshin: {
    color: "#4ade80",
    name: { "y7-8": "Protector protein", y11: "Shugoshin (+ PP2A)" },
    role: {
      "y7-8": "Protects the glue in the middle.",
      y11: "Shugoshin ('guardian spirit') sits at centromeres in meiosis I and recruits PP2A, keeping centromeric Rec8 dephosphorylated so separase cannot cut it. Its protection is removed in meiosis II. Switch it off in 'Things that go wrong' to see why it matters.",
    },
  },
  sc: {
    color: "#67e8f9",
    name: { "y7-8": "Zipper between the pair", "y9-10": "Synaptonemal complex", y11: "Synaptonemal complex (SC)" },
    role: {
      "y7-8": "A protein 'zip' that holds the matching chromosomes side by side while they swap pieces.",
      "y9-10": "A protein zipper that holds homologous chromosomes tightly together (synapsis) in prophase I, forming a bivalent. Crossing over happens while it is zipped.",
      y11: "A tripartite protein lattice (lateral elements on each homologue's axis, transverse filaments, a central element) that holds homologues ≈ 100 nm apart during pachytene. Crossovers mature while the SC is assembled; it disassembles in diplotene, leaving the homologues joined only at chiasmata.",
    },
  },
  chiasma: {
    color: "#a78bfa",
    name: { "y7-8": "Swap point (crossover)", "y9-10": "Chiasma (crossover)", y11: "Chiasma" },
    role: {
      "y7-8": "Where matching chromosomes swapped pieces. The colours beyond this point have changed places.",
      "y9-10": "Where two non-sister chromatids crossed over and exchanged matching segments (and the alleles on them).",
      y11: "The visible site of a crossover between non-sister chromatids. With arm cohesion, chiasmata physically link homologues so the bivalent can bi-orient under tension on the spindle.",
    },
  },
  kinetochore: {
    color: "#e9d5ff",
    name: { "y7-8": "Hook for the ropes", "y9-10": "Kinetochore", y11: "Kinetochore" },
    role: {
      "y7-8": "Where the spindle 'ropes' attach to pull a chromosome.",
      "y9-10": "Protein plate at the centromere where spindle fibres attach. In meiosis I both sisters' kinetochores face the same pole; in meiosis II they face opposite poles.",
      y11: "In meiosis I sister kinetochores are fused and mono-oriented (co-orientation, via monopolin in yeast), so whole homologues are pulled to opposite poles. In meiosis II sister kinetochores bi-orient, as in mitosis.",
    },
  },
  pole: {
    color: "#86efac",
    name: { "y7-8": "Spindle pole", "y9-10": "Spindle pole" },
    role: {
      "y7-8": "One end of the spindle. Chromosomes are pulled towards the poles.",
      "y9-10": "The spindle's microtubules spread from the two poles. Animal cells organise them with centrosomes (with centrioles); plant cells have no centrosomes, so their poles are broad.",
      y11: "Animal spermatocytes nucleate the spindle from centrosomes. Plant meiocytes (and human oocytes) build acentrosomal spindles: microtubules nucleate around the chromosomes and are focused into broad poles.",
    },
  },
  fibre: {
    color: "#bae6fd",
    name: { "y7-8": "Spindle fibre", "y9-10": "Spindle fibre (microtubule)" },
    role: {
      "y7-8": "Protein ropes that pull chromosomes apart.",
      "y9-10": "Microtubules. Some attach to kinetochores and shorten to pull chromosomes; others overlap at the equator and push the poles apart.",
      y11: "Kinetochore microtubules depolymerise to pull chromosomes poleward (anaphase A); interpolar microtubules slide apart to elongate the spindle (anaphase B).",
    },
  },
  cell: {
    color: "#c9b8e6",
    name: { "y7-8": "Cell membrane", "y9-10": "Cell membrane" },
    role: {
      "y7-8": "The outside of the cell. It pinches (or a new wall grows) to split one cell into two.",
      "y9-10": "Cytokinesis splits the cell after each division: animal cells pinch in (cleavage furrow); plant cells build a new wall (cell plate).",
    },
  },
  nucleus: {
    color: "#a78bfa",
    name: { "y7-8": "Nucleus", "y9-10": "Nuclear envelope" },
    role: {
      "y7-8": "Holds the chromosomes. It breaks down so the chromosomes can be moved, then re-forms.",
      "y9-10": "Breaks down in late prophase I so the spindle can reach the chromosomes; re-forms around each new set.",
    },
  },
  wall: {
    color: "#fde68a",
    name: { "y7-8": "Special wall", "y9-10": "Callose wall", y11: "Callose wall" },
    role: {
      "y7-8": "In a flower, these cells wrap themselves in a special wall while they divide.",
      "y9-10": "Pollen mother cells in the anther wrap themselves in a wall of callose (a sugar polymer) during meiosis. It is broken down later to release the four young pollen cells.",
      y11: "Microsporocytes deposit a callose (β-1,3-glucan) wall that isolates them during meiosis; tapetum enzymes (callase) digest it to release the tetrad of microspores.",
    },
  },
  egg: {
    color: "#fde68a",
    name: { "y7-8": "Egg cell (other parent)", "y9-10": "Egg cell (other parent)" },
    role: {
      "y7-8": "A sex cell from the other parent. When the two join, the new cell has a full set of chromosomes again.",
      "y9-10": "A haploid egg (n = 2) from the second parent. Its chromosomes are teal and amber.",
    },
  },
  zygote: {
    color: "#fbbf24",
    name: { "y7-8": "Fertilised egg (zygote)", "y9-10": "Zygote" },
    role: {
      "y7-8": "The first cell of a new individual, with one chromosome of each pair from each parent.",
      "y9-10": "n + n = 2n. Each homologous pair now has one chromosome from each parent. It will copy its DNA and divide by mitosis.",
    },
  },
};

// ---------- compare with mitosis ----------
export const COMPARE = [
  ["Divisions", "1", "2 (meiosis I and II)"],
  ["Cells made", "2", "4"],
  ["Ploidy of products", "Diploid (2n), same as parent", "Haploid (n), half the parent"],
  ["Homologues pair?", "No", "Yes, form bivalents in prophase I"],
  ["Crossing over", "No", "Yes, prophase I"],
  ["What separates at anaphase", "Sister chromatids", "Homologues (I), then sister chromatids (II)"],
  ["Cohesin removed", "All at once (anaphase)", "Arms in anaphase I, centromeres in anaphase II"],
  ["Products genetically", "Identical to parent and each other", "Different from parent and each other"],
  ["Used for", "Growth, repair, asexual reproduction", "Making gametes (animals) or spores (plants) for sexual reproduction"],
];

// ---------- missions ----------
// check(S, X): S = level state, X = helpers
export const MISSIONS = [
  { maxBand: "y7-8", text: "Copy the DNA: watch each chromosome become two identical copies", check: (S) => S.maxPhase >= 2 },
  { maxBand: "y7-8", text: "Make a swap: drag along a pair of matching chromosomes to swap pieces (crossing over)", check: (S) => S.crossMade },
  { maxBand: "y7-8", text: "Spin a pair around on the middle line (tap it in metaphase I)", check: (S) => S.flips > 0 },
  { maxBand: "y7-8", text: "Finish meiosis: make four new cells", check: (S) => S.watchedRuns > 0 },
  { maxBand: "y7-8", text: "Find a cell with a mix of mum's and dad's genes on one chromosome (a swapped one)", check: (S) => [...S.watched].some(isRecomb) },
  { maxBand: "y7-8", text: "Join two sex cells to start a new individual (fertilisation)", check: (S) => S.zygotes > 0 },

  { band: "y9-10", maxBand: "y9-10", text: "Place a chiasma: drag along a bivalent in prophase I to make a crossover", check: (S) => S.crossMade },
  { band: "y9-10", maxBand: "y9-10", text: "Show both metaphase I arrangements (pink chromosomes on the same side, then on opposite sides)", check: (S) => S.orientSeen.size >= 2 },
  { band: "y9-10", maxBand: "y9-10", text: "Complete meiosis: reach four haploid cells", check: (S) => S.watchedRuns > 0 },
  { band: "y9-10", text: "Produce a recombinant gamete (Ab or aB) by crossing over between genes A and B", check: (S) => [...S.watched].some(isRecomb) },
  { band: "y9-10", text: "Cause nondisjunction, then fertilise an n+1 gamete to make a trisomic zygote", check: (S) => S.trisomy },
  { band: "y9-10", maxBand: "y9-10", text: "Breed at least 100 offspring and compare them with the Punnett square's prediction", check: (S) => S.breedN >= 100 },

  { band: "y11", text: "Collect all four parental combinations (ABD, ABd, abD, abd): independent assortment", check: (S) => ["ABD", "ABd", "abD", "abd"].every((g) => S.tally[g] > 0) },
  { band: "y11", text: "Compare nondisjunction in meiosis I and in meiosis II (finish a run with each)", check: (S) => S.ndDone.I && S.ndDone.II },
  { band: "y11", text: "Switch crossing over off for 20+ random meioses: recombinant gametes disappear", check: (S) => S.noXRuns >= 20 },
  { band: "y11", maxBand: "y11", text: "Linked genes: breed 200+ offspring from a dihybrid test cross (A and B) and find the recombination frequency", check: (S) => S.linkedTestN >= 200 },
  { band: "y12", text: "Remove shugoshin and get an aneuploid gamete from a cohesion failure in meiosis II", check: (S) => S.sgoAneu },
];

// ---------- quiz ----------
export const QUIZ = [
  { maxBand: "y7-8", q: "Meiosis makes cells with…", options: ["the same number of chromosomes as the parent cell", "half the number of chromosomes", "double the number of chromosomes", "no chromosomes"], answer: 1, why: "Sex cells get one chromosome from each pair: half the usual number. When two join at fertilisation, the full number is restored." },
  { maxBand: "y7-8", q: "How many cells does one cell make by meiosis?", options: ["1", "2", "4", "8"], answer: 2, why: "Meiosis has two divisions, so one cell becomes 2 and then 4." },
  { maxBand: "y7-8", q: "Where in a flower does meiosis happen?", options: ["In the petals", "In the anthers and ovules", "In the leaves", "In the roots"], answer: 1, why: "Anthers make pollen; ovules make egg cells. Both start with meiosis." },
  { maxBand: "y7-8", q: "Why do brothers and sisters (with the same parents) usually look different?", options: ["They have different parents", "Each sex cell gets a different mix of the parents' chromosomes and genes", "Their cells divide by mitosis only", "Genes change every day"], answer: 1, why: "Crossing over and the random way pairs line up give every sex cell a different mix, so every child gets a different combination." },
  { maxBand: "y7-8", q: "Fertilisation is when…", options: ["a cell copies its DNA", "two sex cells join to make one new cell", "a cell splits into four", "a plant makes pollen"], answer: 1, why: "A sex cell from each parent joins; the new cell has a full set of chromosomes (one of each pair from each parent)." },

  { band: "y9-10", maxBand: "y9-10", q: "A human gamete contains 23 chromosomes. Which describes it?", options: ["Diploid, 2n = 46", "Haploid, n = 23", "Diploid, 2n = 23", "Haploid, n = 46"], answer: 1, why: "Gametes are haploid: they carry one chromosome from each homologous pair (n = 23). Body cells are diploid (2n = 46)." },
  { band: "y9-10", maxBand: "y11", q: "When do homologous chromosomes separate, and when do sister chromatids separate?", options: ["Homologues in anaphase II; sisters in anaphase I", "Both in anaphase I", "Homologues in anaphase I; sisters in anaphase II", "Both in anaphase II"], answer: 2, why: "Anaphase I pulls homologues apart (the reduction division, 2n → n). Anaphase II separates sister chromatids." },
  { band: "y9-10", q: "Which two processes in meiosis produce genetic variation among gametes?", options: ["DNA replication and cytokinesis", "Crossing over and independent assortment", "Spindle formation and cytokinesis", "Mitosis and DNA repair"], answer: 1, why: "Crossing over (prophase I) recombines alleles on a chromosome; independent assortment (metaphase I) shuffles whole chromosomes. Random fertilisation adds even more variation." },
  { band: "y9-10", maxBand: "y9-10", q: "Two carriers (Dd × Dd) of a recessive condition have a child. What is the chance the child is affected (dd)?", options: ["0", "1 in 4", "1 in 2", "3 in 4"], answer: 1, why: "Each parent passes on d with probability ½, so dd = ½ × ½ = ¼. The Punnett square shows 1 DD : 2 Dd : 1 dd." },
  { band: "y9-10", q: "Homologous chromosomes fail to separate in meiosis I. The four gametes will be…", options: ["all normal (n)", "two n+1 and two n−1", "one n+1, one n−1 and two n", "all n+1"], answer: 1, why: "Both homologues go to one cell, so both of its gametes get an extra chromosome and both gametes from the other cell lack it. A meiosis II error affects only one of the two cells." },
  { band: "y9-10", maxBand: "y9-10", q: "An n+1 gamete (with an extra chromosome 21) fertilises a normal gamete. The zygote has…", options: ["45 chromosomes (monosomy)", "46 chromosomes", "47 chromosomes: trisomy 21 (Down syndrome)", "69 chromosomes (triploid)"], answer: 2, why: "24 + 23 = 47, with three copies of chromosome 21. Most other autosomal trisomies stop development before birth." },

  { band: "y11", q: "Why do homologues separate at anaphase I while sister chromatids stay together?", options: ["Separase only works in meiosis II", "Arm cohesin is cut, but centromeric cohesin is protected by shugoshin, and sister kinetochores face the same pole", "Sister chromatids are glued by the synaptonemal complex", "Homologues are not attached to the spindle"], answer: 1, why: "Cutting arm Rec8 releases the chiasmata so homologues can part; protected centromeric cohesin and co-oriented sister kinetochores keep sisters together until meiosis II." },
  { band: "y11", q: "Genes A and B are linked. In a test cross (AB/ab × ab/ab), 32 % of offspring are recombinant. This means…", options: ["the genes assort independently", "a crossover occurred between A and B in about 32 % of gametes' chromatids, so the genes are ≈ 32 map units apart", "32 % of the parents' cells failed meiosis", "B is dominant to A"], answer: 1, why: "Recombination frequency (< 50 % for linked genes) estimates distance: 1 % recombinant ≈ 1 map unit (centimorgan). Unlinked genes give 50 % recombinants." },
  { band: "y11", q: "A meiosis II nondisjunction can be told apart from a meiosis I error because the n+1 gamete's two extra copies are…", options: ["different homologues (one maternal, one paternal) near the centromere", "sister chromatids, identical near the centromere", "always recombinant", "always from the father"], answer: 1, why: "In meiosis II sister chromatids fail to separate, so around the centromere (where crossing over rarely reshuffles) both copies match. An MI error puts both homologues into the gamete." },
  { band: "y12", q: "Older mothers have a higher risk of trisomic pregnancies. A leading explanation is that…", options: ["eggs are made fresh each month", "cohesin loaded before birth in oocytes is gradually lost over decades, so chromosomes are held together less well", "fathers' sperm contribute more chromosomes with age", "mitosis replaces meiosis"], answer: 1, why: "Human oocytes pause in prophase I from before birth until ovulation. Cohesin is not renewed, so arm and centromeric cohesion weaken with age, raising the risk of mis-segregation." },
];

// ---------- narrative ----------
/**
 * Paragraphs for the "What's happening" card, generated from state.
 * X: { pick, band, org, nx, recChromatids, sameOrient, gametes, prodName, err, fert, phaseName }
 */
export function narrative(S, X) {
  const { pick } = X, y7 = X.band === "y7-8", senior = X.band === "y11" || X.band === "y12";
  const plant = X.org === "plant";
  const ph = S.phase, out = [];
  const errLine = () => {
    if (S.err.sgo === false && senior) return " <strong>Shugoshin is switched off</strong>, so centromeric cohesin is unprotected.";
    if (S.err.nd === "I") return ` <strong>Nondisjunction is set for meiosis I</strong> (pair ${S.err.ndPair + 1}).`;
    if (S.err.nd === "II") return ` <strong>Nondisjunction is set for meiosis II</strong> (pair ${S.err.ndPair + 1}, ${S.err.ndCell ? "right" : "left"} cell).`;
    return "";
  };
  switch (ph) {
    case 0:
      out.push(pick({
        "y7-8": `This is a cell inside ${plant ? "a flower's <strong>anther</strong> (where pollen is made)" : "a <strong>testis</strong> (where sperm are made)"}. It has <strong>two pairs</strong> of chromosomes: one of each pair came from its mother (pink) and one from its father (blue). Press <strong>Next</strong> to start.`,
        "y9-10": `A <strong>diploid (2n = 4)</strong> germ cell in ${plant ? "a flower's anther (a pollen mother cell)" : "a human testis (a spermatocyte)"}. It has two <strong>homologous pairs</strong>: one chromosome of each pair from the mother (pink), one from the father (blue). Homologues carry the <strong>same genes</strong> but can carry different <strong>alleles</strong>: here the mother's carry A, B, D and the father's a, b, d.`,
        y11: `A diploid (2n = 4) ${plant ? "microsporocyte (pollen mother cell) in an anther" : "primary spermatocyte"} in G1. Genotype <strong>AB/ab Dd</strong>: A and B are linked on pair 1 (maternal homologue AB, paternal ab, i.e. coupling phase); D is on pair 2.`,
      }));
      break;
    case 1:
      out.push(pick({
        "y7-8": "<strong>Copying the DNA.</strong> Each chromosome makes an exact copy of itself. The two copies stay joined, held by ring-shaped 'glue' proteins.",
        "y9-10": "<strong>S phase: DNA replication.</strong> Each chromosome is copied, making two identical <strong>sister chromatids</strong>. <strong>Cohesin</strong> rings are laid down as the DNA is copied and hold the sisters together along their whole length. Still 4 chromosomes, now 8 chromatids.",
        y11: "<strong>Premeiotic S phase.</strong> Replication produces sister chromatids, and cohesion is established as the forks pass: meiotic cohesin uses the kleisin <strong>Rec8</strong> rather than the mitotic Scc1/Rad21. Where the rings are, and when they are cut, decides what separates in each division.",
      }));
      break;
    case 2: {
      const nx = X.nx, rec = X.recChromatids, zip = S.zip;
      out.push(pick({
        "y7-8": "<strong>Pairing up.</strong> Matching chromosomes find each other and zip together side by side. While zipped, they can <strong>swap matching pieces</strong> (crossing over).",
        "y9-10": "<strong>Prophase I.</strong> Homologous chromosomes pair up (<strong>synapsis</strong>): a protein zipper, the <strong>synaptonemal complex</strong>, holds them together as <strong>bivalents</strong> (4 chromatids). <strong>Non-sister chromatids</strong> can <strong>cross over</strong>, swapping matching segments and the alleles on them.",
        y11: "<strong>Prophase I (zygotene → pachytene).</strong> Homologues synapse as the <strong>synaptonemal complex</strong> zips them together. Crossovers form between <strong>non-sister chromatids</strong> while the SC is assembled (initiated by programmed double-strand breaks and repaired using the homologue as a template).",
      }));
      if (zip < 0.95) out.push(pick({ "y7-8": "Zipping up…", "y9-10": `Synapsis in progress: ${Math.round(zip * 100)} % zipped.` }));
      else out.push(pick({
        "y7-8": `<strong>Drag along a pair</strong> to choose where they swap pieces (tap a swap point to remove it). Swaps made: <strong>${nx}</strong>.`,
        "y9-10": `<strong>Drag along a bivalent</strong> to place a crossover; tap one to remove it. Chiasmata: <strong>${nx}</strong>.${nx ? ` Recombinant chromatids on pair 1: <strong>${rec}</strong> (only a crossover <em>between</em> A and B makes Ab or aB).` : ""}`,
        y11: `Drag along a bivalent to place a crossover (≤ 3 per bivalent). Chiasmata: <strong>${nx}</strong>; recombinant (Ab/aB) chromatids on pair 1: <strong>${rec}</strong> of 4.${nx === 0 ? " Real bivalents almost always get at least one crossover (crossover assurance): without one the homologues are not tethered and mis-segregate easily." : ""}`,
      }));
      break;
    }
    case 3:
      out.push(pick({
        "y7-8": "The zipper comes apart. The pairs stay joined only where they swapped pieces. The nucleus breaks down and the spindle (protein ropes) forms.",
        "y9-10": `The synaptonemal complex comes apart and the homologues pull away from each other, except at the <strong>chiasmata</strong> (${X.nx}). Sister chromatids beyond each chiasma are still held by cohesin, so the bivalent stays in one piece. The nuclear envelope breaks down and the ${plant ? "spindle forms (plants have no centrosomes)" : "spindle forms from the centrosomes"}.`,
        y11: `Diplotene–diakinesis: the SC disassembles and the chromosomes condense further. Homologues are now held together only by <strong>chiasmata + arm cohesion</strong> distal to them (${X.nx} chiasmata). Nuclear envelope breakdown lets the ${plant ? "acentrosomal" : "centrosomal"} spindle capture kinetochores.`,
      }));
      break;
    case 4: {
      const same = X.sameOrient;
      out.push(pick({
        "y7-8": `<strong>Lining up.</strong> The pairs line up across the middle. Which side each chromosome faces is <strong>random</strong> for each pair. Right now the pink ones face <strong>${same ? "the same side" : "opposite sides"}</strong>. <strong>Tap a pair to spin it.</strong>`,
        "y9-10": `<strong>Metaphase I.</strong> Bivalents line up on the <strong>equator</strong>. Each homologue's kinetochores face one pole. Which homologue faces which pole is <strong>random for each pair</strong>: <strong>independent assortment</strong>. Maternal (pink) chromosomes now face <strong>${same ? "the same pole" : "opposite poles"}</strong>. <strong>Tap a bivalent to flip it.</strong> n = 2 gives 2<sup>n</sup> = 4 combinations (humans: 2<sup>23</sup> ≈ 8.4 million).`,
        y11: `<strong>Metaphase I.</strong> Each bivalent is bi-oriented: the two sister kinetochores of a homologue act as one unit facing one pole, and chiasmata resist the pull, producing <strong>tension</strong> that stabilises correct attachments. Orientation is random per bivalent (independent assortment, 2<sup>n−1</sup> = 2 arrangements, 2<sup>n</sup> = 4 combinations). Maternal homologues face <strong>${same ? "the same pole" : "opposite poles"}</strong>. Tap a bivalent to flip it.`,
      }));
      if (S.err.nd === "I") out.push(pick({ "y9-10": `<strong>Error set:</strong> both homologues of pair ${S.err.ndPair + 1} are attached to the <strong>same pole</strong>, so they will not separate.`, y11: `<strong>Error set:</strong> pair ${S.err.ndPair + 1}'s homologues are both attached to one pole (as can happen when a bivalent lacks tension or falls apart early).` }));
      break;
    }
    case 5:
      out.push(pick({
        "y7-8": "<strong>Pulling apart.</strong> The glue along the arms is cut, so the pairs come apart. One chromosome of each pair goes to each end. The copies stay together.",
        "y9-10": "<strong>Anaphase I.</strong> The enzyme <strong>separase</strong> cuts the <strong>arm cohesin</strong>, which releases the chiasmata, so <strong>homologous chromosomes</strong> are pulled to opposite poles. Cohesin at the centromeres is protected, so sister chromatids stay together. This is the <strong>reduction division</strong> (2n → n).",
        y11: "<strong>Anaphase I.</strong> APC/C destroys securin, freeing <strong>separase</strong> to cleave arm Rec8. The chiasmata resolve and homologues move poleward. <strong>Shugoshin–PP2A</strong> keeps centromeric Rec8 uncleavable, so sisters stay joined: the cause of the 'homologues first, sisters second' pattern.",
      }));
      if (S.err.sgo === false && senior) out.push("<strong>No shugoshin:</strong> separase has also cut the centromeric cohesin. The sisters still travel together (their kinetochores face the same pole) but nothing now holds them as a pair.");
      if (S.err.nd === "I") out.push(pick({ "y9-10": `<strong>Nondisjunction:</strong> both chromosomes of pair ${S.err.ndPair + 1} are going to the same pole.` }));
      break;
    case 6:
      out.push(pick({
        "y7-8": `<strong>Two cells.</strong> Each new cell has <strong>one chromosome from each pair</strong> (still copied). ${plant ? "A new wall grows between them." : "The cell pinches in two."}`,
        "y9-10": `<strong>Telophase I and cytokinesis.</strong> Two cells form. Each is <strong>haploid (n = 2)</strong>: one chromosome of each pair, each still two chromatids. ${plant ? "Plant cells divide by building a <strong>cell plate</strong>." : "Animal cells divide by a <strong>cleavage furrow</strong>."} There is <strong>no DNA replication</strong> before meiosis II.`,
        y11: `Telophase I / interkinesis: two haploid cells (n = 2, 2 chromatids per chromosome). ${plant ? "Cytokinesis here is successive (as in maize); in many dicots (e.g. <i>Arabidopsis</i>) the cytoplasm divides only once, after meiosis II." : "Spermatocytes stay joined by cytoplasmic bridges."} No S phase follows. Because of crossing over, sister chromatids are often <strong>no longer identical</strong>.`,
      }));
      break;
    case 7:
      out.push(pick({
        "y7-8": "<strong>Second division.</strong> In each cell the chromosomes line up one by one across the middle. <strong>Tap a chromosome</strong> to flip which copy faces up.",
        "y9-10": "<strong>Metaphase II.</strong> In each cell, chromosomes line up <strong>singly</strong> on the equator, with sister chromatids facing opposite poles. If crossing over made the sisters different, which one goes to which pole matters too. <strong>Tap a chromosome to flip it.</strong>",
        y11: "<strong>Metaphase II.</strong> Sister kinetochores now bi-orient. Centromeric cohesion resists the pull, creating tension (as in mitosis); shugoshin's protection is removed so the cohesin can be cut. Tap a chromosome to flip which (possibly recombinant) sister faces which pole.",
      }));
      if (S.err.nd === "II") out.push(`<strong>Error set:</strong> in the ${S.err.ndCell ? "right" : "left"} cell both sister kinetochores of pair ${S.err.ndPair + 1} are attached to the <strong>same pole</strong>.`);
      if (S.err.sgo === false && senior) out.push("<strong>No centromeric cohesin:</strong> the sisters can't be held as a bi-oriented pair, so each chromatid is captured independently: each goes to a <strong>random</strong> pole.");
      break;
    case 8:
      out.push(pick({
        "y7-8": "<strong>Pulling apart again.</strong> The glue in the middle is cut and the two copies move to opposite ends.",
        "y9-10": "<strong>Anaphase II.</strong> Separase cuts the <strong>centromeric cohesin</strong>, so <strong>sister chromatids separate</strong>; each is now a chromosome in its own right, moving to opposite poles.",
        y11: "<strong>Anaphase II.</strong> Deprotected centromeric Rec8 is cleaved by separase and sister chromatids move to opposite poles, exactly as in mitosis but with a haploid set.",
      }));
      if (S.err.nd === "II") out.push(`<strong>Nondisjunction:</strong> both chromatids of pair ${S.err.ndPair + 1} are going to the same pole.`);
      break;
    case 9:
      out.push(pick({
        "y7-8": `<strong>Four cells.</strong> Each has one chromosome from each pair: half the number of the starting cell.`,
        "y9-10": `<strong>Telophase II.</strong> Cytokinesis produces <strong>four haploid cells</strong> from one diploid cell.`,
      }));
      break;
    case 10: {
      const gs = X.gametes || [];
      const list = gs.map((g) => `<strong>${g.geno}</strong>${g.euploid ? (isRecomb(g.geno) ? " (recombinant)" : "") : ` (<span style="color:#fca5a5">${g.ploidy}</span>)`}`).join(", ");
      const u = new Set(gs.map((g) => g.geno)).size;
      out.push(pick({
        "y7-8": `<strong>Four ${X.prodName}:</strong> ${list}. ${plant ? "Each will grow into a <strong>pollen grain</strong>, which makes the sperm cells." : "Each becomes a sperm cell."} <strong>Tap one</strong> to join it with an egg from another parent.`,
        "y9-10": `<strong>Four haploid ${X.prodName}:</strong> ${list}. This run made <strong>${u}</strong> different genotype${u === 1 ? "" : "s"}. ${plant ? "Each spore divides by mitosis into a <strong>pollen grain</strong> whose sperm cells have the spore's genotype." : "Each develops into a sperm cell. (In the ovary, one oocyte gives just one egg plus small polar bodies.)"} <strong>Tap one</strong> to fertilise.`,
        y11: `<strong>Products:</strong> ${list} (${u} genotype${u === 1 ? "" : "s"}). ${plant ? "These are <strong>microspores</strong>: meiosis in plants makes spores, which grow by mitosis into the haploid gametophyte (pollen grain) that makes the gametes (alternation of generations). In an ovule, 3 of the 4 megaspores die and the survivor forms the embryo sac with the egg." : "Each spermatid matures into a sperm. Oogenesis is unequal: one egg plus polar bodies."} Tap one to fertilise.`,
      }));
      const ab = gs.filter((g) => !g.euploid);
      if (ab.length) out.push(pick({
        "y9-10": `<strong>${ab.length} of 4</strong> ${X.prodName} have the wrong number of chromosomes (${ab.map((g) => g.ploidy).join(", ")}). ${S.lastErr === "I" ? "An error in meiosis I affects all four." : S.lastErr === "II" ? "An error in meiosis II affects only the two products of one cell." : ""}`,
        y11: `<strong>${ab.length} of 4 aneuploid</strong> (${ab.map((g) => g.ploidy).join(", ")}).${S.lastErr === "I" ? " MI error: the n+1 products carry both <em>homologues</em> (different alleles near the centromere)." : S.lastErr === "II" ? " MII error: the n+1 product carries two <em>sisters</em> (identical near the centromere)." : S.lastErr === "sgo" ? " Cohesion failure: single chromatids segregated at random in meiosis II." : ""}`,
      }));
      break;
    }
  }
  const e = errLine();
  if (e && ph < 10 && ph !== 4 && ph !== 5 && ph !== 7 && ph !== 8 && !y7) out.push(e.trim());
  return out;
}

/** Narrative for fertilisation. */
export function fertNarrative(F, X) {
  const { pick } = X, plant = X.org === "plant";
  const z = F.zyg;
  const parts = [];
  parts.push(pick({
    "y7-8": `<strong>Fertilisation.</strong> ${plant ? "A sperm cell from this pollen joins an egg cell in another plant's ovule." : "The sperm joins an egg from the other parent."} The new cell (zygote) has <strong>${z.count}</strong> chromosomes.`,
    "y9-10": `<strong>Fertilisation.</strong> ${plant ? "A sperm cell carried by pollen" : "A sperm"} (n = ${F.gm.count}) + egg (n = ${F.parts2.length}) → <strong>zygote with ${z.count} chromosomes</strong>. Each pair now has one chromosome from each parent.`,
    y11: `<strong>Fertilisation:</strong> ${plant ? "sperm (genotype of the microspore) + egg in the embryo sac (in flowering plants the second sperm forms the triploid endosperm: double fertilisation)" : "sperm + secondary oocyte (which then completes meiosis II)"} → zygote with <strong>${z.count}</strong> chromosomes.`,
  }));
  parts.push(`Zygote genotype: <strong>${z.genoStr}</strong> → ${z.phenoStr}.`);
  if (z.status === "trisomy") parts.push(pick({
    "y9-10": `<strong>Trisomy</strong> (2n + 1): three copies of pair ${z.pair + 1}. In humans an extra chromosome 21 causes <strong>Down syndrome</strong>; most other autosomal trisomies stop development early (13 and 18 can survive birth).${plant ? " Plants usually tolerate extra chromosomes better than animals." : ""}`,
    y11: `<strong>Trisomy (2n + 1)</strong> for pair ${z.pair + 1}: gene dosage is unbalanced for every gene on that chromosome. In humans, trisomy 21 (Down syndrome), 18 and 13 can survive to birth; most cases arise from errors in the <em>egg</em>, mainly in meiosis I, and the risk rises with maternal age.`,
  }));
  else if (z.status === "monosomy") parts.push(pick({
    "y9-10": `<strong>Monosomy</strong> (2n − 1): only one copy of pair ${z.pair + 1}. In humans, missing an autosome is not survivable; the only viable monosomy is Turner syndrome (45,X).`,
  }));
  else if (z.status === "other") parts.push("The zygote's chromosome set is unbalanced (one pair has too many copies and another too few).");
  else parts.push(pick({ "y7-8": "A normal set: two of each pair.", "y9-10": "A normal diploid zygote (2n = 4). It will grow by mitosis." }));
  return parts;
}
