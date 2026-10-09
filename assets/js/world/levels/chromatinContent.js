// Lens-aware text for the chromosome & chromatin level. Values may be strings or { "y7-8", "y9-10", "y11", "y12" }.
// narrative() reads ChromatinModel's live state (chromatinModel.js).

export const PARTS = {
  chromatid: {
    name: { "y7-8": "Chromosome", "y9-10": "Chromosome (sister chromatid)", y11: "Sister chromatid" }, color: "#f472b6",
    role: {
      "y7-8": "A chromosome is one very long DNA molecule wound up tightly with proteins. Before a cell divides, the DNA is copied, so the chromosome has two identical halves joined in the middle — the X shape.",
      "y9-10": "Each chromosome is one DNA molecule. After the DNA is copied, the two identical copies (<strong>sister chromatids</strong>) stay joined at the <strong>centromere</strong> until the cell divides. The coloured bands are regions of DNA; each band holds many genes.",
      y11: "One of two identical DNA molecules produced by replication (S phase), held to its sister by cohesin and joined at the centromere. In mitosis each chromatid is ≈ 10 000× more compact than the stretched-out DNA; the sisters separate in anaphase so each daughter cell gets one copy.",
    },
  },
  homologue: {
    name: { "y7-8": "The matching chromosome", "y9-10": "Homologous chromosome (from the other parent)", y11: "Homologous chromosome" }, color: "#93c5fd",
    role: {
      "y7-8": "Body cells have two copies of each chromosome — one from each parent. They carry the same genes in the same places.",
      "y9-10": "A <strong>homologous pair</strong>: one chromosome from the mother, one from the father. Same genes in the same order, but the versions (<strong>alleles</strong>) can differ — here the β-globin gene has a normal allele on one and the sickle-cell allele on the other.",
      y11: "Homologues carry the same loci in the same order but may carry different alleles. They are not paired in mitosis (only in meiosis I). Shown here: maternal HbA and paternal HbS alleles at the β-globin locus (a heterozygote, sickle-cell trait).",
    },
  },
  centromere: {
    name: "Centromere", color: "#c084fc",
    role: {
      "y7-8": "The pinched middle where the two copies are held together.",
      "y9-10": "Holds the sister chromatids together; spindle fibres attach here (at the kinetochores) to pull the copies apart during division.",
      y11: "A constricted region of repetitive heterochromatin where kinetochores assemble; cohesin is protected here until anaphase. Its position (here near the top: the short p arm above, long q arm below) helps identify chromosomes in a karyotype.",
    },
  },
  telomere: {
    name: "Telomere", color: "#e0e7ff",
    role: {
      "y7-8": "The protective tips at the ends of a chromosome.",
      y11: "Repeated sequences (TTTAGGG in plants, TTAGGG in humans) that cap chromosome ends, stop them being mistaken for broken DNA and buffer the shortening that happens each replication.",
    },
  },
  band: {
    name: { "y7-8": "Model gene", "y9-10": "β-globin gene (model gene)", y11: "β-globin locus (HBB, 11p15.4)" }, color: "#fbbf24",
    role: {
      "y7-8": "The glowing gold band is our model gene. A gene is a short section of the chromosome's DNA with the instructions for one protein. The chromosome holds over a thousand genes.",
      "y9-10": "A <strong>gene</strong> is a section of DNA at a particular place (locus) on a chromosome. Both chromosomes of the pair have the β-globin gene at the same place, but each may carry a different <strong>allele</strong>.",
      y11: "The β-globin gene sits on the short arm of human chromosome 11 (band 11p15.4), near the insulin gene (11p15.5). This model chromosome is based on chromosome 11; the gene is shown in a plant cell for teaching only.",
    },
  },
  ins: {
    name: { "y7-8": "Another gene (insulin)", y11: "INS (insulin) gene" }, color: "#5eead4",
    role: { "y7-8": "Another gene on the same chromosome — the instructions for insulin.", y11: "The insulin gene (11p15.5) lies close to β-globin. Neighbouring genes can be expressed in completely different cells: chromatin state decides which genes a cell uses." },
  },
  loops: {
    name: { "y7-8": "Loops of packed DNA", "y9-10": "Chromatin loops", y11: "Chromatin loops on the scaffold" }, color: "#f9a8d4",
    role: {
      "y7-8": "Inside, the DNA is folded into loops, like a very long thread coiled and looped to fit.",
      "y9-10": "The chromosome is made of loops of chromatin fibre, held at their bases by a protein scaffold.",
      y11: "Loops of chromatin (tens to hundreds of kilobases) anchored by protein complexes (condensin in mitosis; cohesin and CTCF in interphase, where loops form domains called TADs). Active genes can loop out of the compact mass.",
    },
  },
  fibre: {
    name: { "y7-8": "Coiled DNA fibre", "y9-10": "Chromatin fibre", y11: "Compact (≈ 30 nm) chromatin fibre" }, color: "#f0abfc",
    role: {
      "y7-8": "The beads of DNA coiled up into a thicker rope.",
      "y9-10": "Nucleosomes packed together into a thicker fibre. Genes in packed fibre are hard to reach.",
      y11: "Nucleosomes stacked into a compact fibre with linker histone H1 (the textbook 30 nm solenoid). In living nuclei the fibre is more irregular, but compaction still controls access to genes.",
    },
  },
  nucleosome: {
    name: { "y7-8": "Bead (DNA wrapped on proteins)", "y9-10": "Nucleosome", y11: "Nucleosome" }, color: "#818cf8",
    role: {
      "y7-8": "DNA is wrapped around little protein balls called histones — like thread on a cotton reel. Beads on a string!",
      "y9-10": "≈ 147 base pairs of DNA wrapped about 1.7 times around a core of 8 <strong>histone</strong> proteins. A chain of them looks like beads on a string.",
      y11: "≈ 147 bp of DNA wrapped 1.65 left-handed turns around a histone octamer (2 each of H2A, H2B, H3, H4), joined by 20–60 bp of linker DNA. Histone tails stick out and carry chemical tags that change how tightly nucleosomes pack.",
    },
  },
  h1: {
    name: "Linker histone H1", color: "#94a3b8",
    role: { "y7-8": "A clip that helps pack the beads tightly.", y11: "Binds where DNA enters and leaves the nucleosome and helps compact the fibre. It is depleted from active, open chromatin." },
  },
  dna: {
    name: { "y7-8": "Bare DNA (the gene's start)", "y9-10": "Bare DNA at the promoter", y11: "Nucleosome-free promoter DNA" }, color: "#e9d5ff", portal: true,
    role: {
      "y7-8": "Here the DNA is unwrapped so the copying machine can reach the start of the gene. Zoom in to see its letters.",
      "y9-10": "The <strong>promoter</strong> — the start of the gene — where RNA polymerase attaches. When the gene is switched on, the nucleosome here moves away, leaving bare DNA.",
      y11: "The promoter and transcription start site. When the gene is active, remodelling complexes evict or slide the nucleosome, creating a nucleosome-free region where transcription factors and RNA polymerase II assemble. Zoom in to the double helix.",
    },
  },
  pol: {
    name: { "y7-8": "Copying machine (RNA polymerase)", "y9-10": "RNA polymerase", y11: "RNA polymerase II" }, color: "#f8fafc",
    role: {
      "y7-8": "Reads the gene and builds a copy (mRNA). It can only get on where the DNA is unwrapped.",
      "y9-10": "Binds at the promoter and moves along the gene making mRNA. It can't reach DNA that is tightly packed.",
      y11: "Assembles at the open promoter with general transcription factors, then elongates along the template strand, passing through nucleosomes with the help of chaperones. It can't initiate on a nucleosome-occupied, condensed promoter.",
    },
  },
  acetyl: {
    name: { "y7-8": "Loosening tags", "y9-10": "Acetyl tags (on histone tails)", y11: "Histone acetylation (H3/H4 tails)" }, color: "#a3e635",
    role: {
      "y7-8": "Tiny chemical tags that loosen the wrapping so the gene can be read.",
      "y9-10": "Acetyl groups added to histone tails loosen the grip of histones on DNA, opening the chromatin so the gene can be switched on.",
      y11: "Histone acetyltransferases (HATs) add acetyl groups to lysines on the tails, removing their positive charge: the tails grip the negatively charged DNA less, chromatin opens, and readers recruit activators. Histone deacetylases (HDACs) remove them.",
    },
  },
  methyl: {
    name: { "y7-8": "Silencing tags", "y9-10": "Methyl tags (on DNA)", y11: "DNA methylation (5-methylcytosine)" }, color: "#e879f9",
    role: {
      "y7-8": "Tiny tags stuck on the DNA itself that keep a gene switched off. The DNA letters stay the same.",
      "y9-10": "Methyl groups attached to C bases in the DNA. They switch the gene off without changing the DNA sequence.",
      y11: "DNA methyltransferases (DNMTs) add a methyl group to cytosine, mostly at CG sites in animals (CG, CHG and CHH in plants). Methylated promoters bind methyl-binding proteins that recruit HDACs and compact the chromatin; maintenance methylation copies the pattern after replication, so silencing is inherited through cell division.",
    },
  },
};

export const ZOOM = [
  { key: "chromosome", d: 780, label: { "y7-8": "Chromosome", y11: "Chromosomes" } },
  { key: "loops", d: 150, label: "Loops" },
  { key: "fibre", d: 34, label: "Fibre" },
  { key: "nucleosome", d: 12, label: { "y7-8": "Beads", "y9-10": "Nucleosomes" } },
  { key: "dna", d: 2.8, label: "DNA" },
];

export const MISSIONS = [
  { text: { "y7-8": "Zoom in until you see the DNA wrapped around beads (nucleosomes)", "y9-10": "Zoom down to the nucleosomes: DNA wrapped around histones", y11: "Zoom down through loops and fibre to individual nucleosomes" }, check: (M, s) => s.minD < 14 },
  { text: { "y7-8": "Make the cell divide: watch the long DNA wind up tightly into an X-shaped chromosome", "y9-10": "Switch to cell division: the chromatin condenses into two sister chromatids joined at the centromere", y11: "Enter mitosis: chromatin condenses into sister chromatids and transcription shuts down" }, check: (M) => M.cond > 0.95 },
  { maxBand: "y7-8", text: "Click the glowing gold band — the model gene on the chromosome", check: (M, s) => s.clicked.band },
  { band: "y9-10", text: { "y9-10": "Find the β-globin gene on both chromosomes of the homologous pair (click both gold bands)", y11: "Click the β-globin locus on both homologues: same gene, different alleles (HbA / HbS)" }, check: (M, s) => s.clicked.bandM && s.clicked.bandP },
  { band: "y9-10", text: "Click the centromere that holds the sister chromatids together", check: (M, s) => s.clicked.centromere },
  { maxBand: "y9-10", text: { "y7-8": "Pack the gene away tightly and watch the copying stop", "y9-10": "Pack the gene's chromatin tightly: RNA polymerase can't get on and transcription stops" }, check: (M) => !M.acOn && M.stage === "interphase" && M.smoothTx < 0.02 },
  { band: "y11", text: "Remove the acetyl tags (HDACs): the nucleosomes close up and transcription stops — while the DNA sequence stays identical", check: (M) => !M.acOn && M.open < 0.3 && M.smoothTx < 0.02 },
  { band: "y11", text: "Switch the gene back on: get transcription above 0.3 per second after silencing it", check: (M, s) => s.wasSilenced && M.smoothTx > 0.3 },
  { band: "y12", text: "Methylate the promoter: the gene stays silent even with HATs switched on", check: (M) => M.meOn && M.acOn && M.me > 0.9 && M.smoothTx < 0.02 },
  { band: "y12", text: "Epigenetic memory: methylate the promoter, divide the cell, then return to interphase — the gene is still silent", check: (M, s) => s.memory },
  { text: { "y7-8": "Dive into the bare DNA at the start of the gene", "y9-10": "Dive into the bare DNA at the promoter", y11: "Dive into the nucleosome-free promoter DNA" }, check: (M, s) => s.dived },
];

export const QUIZ = [
  { maxBand: "y7-8", q: "What is a chromosome made of?", options: ["Only protein", "One very long DNA molecule wound up with proteins", "Many tiny cells", "Sugar and water"], answer: 1, why: "Each chromosome is a single long DNA molecule, wrapped around histone proteins and folded up. Zoom in to see the layers." },
  { maxBand: "y7-8", q: "Why does a chromosome look like an X when a cell divides?", options: ["It's two different chromosomes stuck together", "The DNA has been copied and the two identical copies are joined in the middle", "It has broken in half", "All chromosomes are always X-shaped"], answer: 1, why: "Before division the DNA is copied. The two identical copies (sister chromatids) are held at the centromere until they're pulled apart." },
  { maxBand: "y7-8", q: "Why is the DNA wrapped around beads (histones)?", options: ["To colour it", "To pack a very long molecule into a tiny nucleus", "To make it longer", "To turn it into protein"], answer: 1, why: "The DNA in one cell would stretch about 2 metres if unwound (in humans). Wrapping and folding packs it into a nucleus a few micrometres across." },
  { maxBand: "y7-8", q: "What is a gene?", options: ["A whole chromosome", "A short section of DNA with the instructions for one protein", "A type of cell", "A histone bead"], answer: 1, why: "A chromosome carries many genes along its length, like chapters in a book." },
  { maxBand: "y7-8", q: "When the DNA of a gene is wound up very tightly…", options: ["the gene is read faster", "the copying machine can't reach it, so the gene is switched off", "the gene is deleted", "the cell divides"], answer: 1, why: "Packing controls which genes are used. The gene is still there — it just can't be read." },
  { band: "y9-10", maxBand: "y9-10", q: "Put these in order from largest to smallest:", options: ["gene → chromosome → DNA base → genome", "genome → chromosome → gene → base pair", "chromosome → genome → gene → base pair", "base pair → gene → chromosome → genome"], answer: 1, why: "The genome is all the DNA; it's split into chromosomes; each chromosome carries many genes; each gene is a sequence of base pairs." },
  { band: "y9-10", maxBand: "y9-10", q: "Homologous chromosomes…", options: ["are identical copies made by DNA replication", "carry the same genes in the same order, one from each parent, possibly with different alleles", "are found only in sex cells", "are two halves of one chromosome"], answer: 1, why: "Sister chromatids are identical copies; homologues come from different parents and can carry different alleles (e.g. HbA and HbS)." },
  { band: "y9-10", maxBand: "y9-10", q: "A person has the HbA allele on one chromosome 11 and HbS on the other. Their genotype is…", options: ["homozygous", "heterozygous", "haploid", "mutated in every cell twice"], answer: 1, why: "Two different alleles of one gene = heterozygous. This is sickle-cell <em>trait</em>; sickle-cell disease needs HbS on both." },
  { band: "y9-10", maxBand: "y9-10", q: "Why must chromosomes condense before a cell divides?", options: ["To make more genes", "So the long DNA molecules can be moved and separated without tangling or breaking", "To change the DNA sequence", "To make proteins faster"], answer: 1, why: "Condensed chromosomes can be pulled apart cleanly; while condensed, most genes aren't transcribed." },
  { band: "y9-10", maxBand: "y9-10", q: "Every cell in your body has the β-globin gene, but only red blood cell precursors make β-globin. Why?", options: ["Other cells have lost the gene", "The gene is switched off (packed away) in other cells", "Other cells have a different DNA sequence", "Only red cells have a nucleus"], answer: 1, why: "Same DNA, different genes switched on. Packing and chemical tags control which genes each cell uses." },
  { band: "y11", q: "Which histone modification is generally associated with active, open chromatin?", options: ["Removal of acetyl groups by HDACs", "Acetylation of lysines on H3/H4 tails", "Adding linker histone H1", "Condensin binding"], answer: 1, why: "Acetylation neutralises lysine's + charge, loosening tail–DNA contacts and recruiting activators. Try removing the acetyl tags." },
  { band: "y11", q: "Why can't RNA polymerase II start transcribing when a nucleosome sits on the promoter?", options: ["Nucleosomes destroy polymerase", "The promoter DNA is wrapped on the histone core, so transcription factors and the polymerase can't bind it", "The DNA sequence changes", "Histones are made of RNA"], answer: 1, why: "Promoter access is the key step. Open genes have a nucleosome-free region at the promoter." },
  { band: "y11", q: "Sister chromatids differ from homologous chromosomes because sister chromatids…", options: ["come from different parents", "are identical copies produced by DNA replication", "carry different genes", "are found only in meiosis"], answer: 1, why: "Sisters are copies (S phase); homologues are the maternal and paternal versions of a chromosome." },
  { band: "y12", q: "Which statement about epigenetic changes is correct?", options: ["They alter the base sequence of DNA", "They change gene expression without changing the DNA sequence, and some can be inherited through cell division", "They only occur in bacteria", "They are the same as point mutations"], answer: 1, why: "Methylation and histone marks change packing and access, not the sequence (watch the sequence strip in the panel stay identical)." },
  { band: "y12", q: "How does promoter DNA methylation silence a gene?", options: ["It cuts out the promoter", "Methyl-binding proteins recruit HDACs and compaction, blocking transcription factor and polymerase binding", "It changes C to T", "It speeds up RNA polymerase"], answer: 1, why: "Methylated CpGs recruit repressive complexes; the chromatin closes. In the model, methylation also pulls acetylation down." },
  { band: "y12", q: "Methylation patterns survive cell division because…", options: ["they are coded in the DNA sequence", "maintenance methyltransferases copy the pattern onto the new strand after replication", "methyl groups never fall off", "histones are copied exactly"], answer: 1, why: "DNMT1 (MET1 in plants) recognises half-methylated CG sites after replication and methylates the new strand — epigenetic memory." },
  { band: "y12", q: "Environmental factors (diet, stress, temperature in plants) can affect phenotype through epigenetics by…", options: ["rewriting genes", "changing the activity of enzymes that add or remove DNA methylation and histone tags", "deleting chromosomes", "changing codons"], answer: 1, why: "E.g. prolonged cold silences the flowering repressor FLC in many plants via histone methylation (vernalisation); diet can alter methylation in mammals." },
];

/** "What's happening" — generated from the model's live state. */
export function narrative(M, band, ctx = {}) {
  const y7 = band === "y7-8", y9 = band === "y9-10", senior = !y7 && !y9;
  const tx = M.smoothTx, op = Math.round(M.open * 100), f2 = (v) => v.toFixed(2);
  const out = [];
  if (M.stage === "mitosis" || M.cond > 0.05) {
    const done = M.cond > 0.95;
    out.push(y7
      ? (done ? "The cell is dividing. The DNA is wound up as tightly as it goes — into an <strong>X-shaped chromosome</strong>: two identical copies joined in the middle." : "The DNA is winding itself up tightly, ready for the cell to divide…")
      : (done ? `The cell is in <strong>mitosis</strong>: the chromatin has condensed into two <strong>sister chromatids</strong> joined at the centromere. The gene is buried in compact chromatin, so transcription has ${tx < 0.02 ? "stopped" : `fallen to ${f2(tx)}/s`}.` : `Chromatin is condensing for division (${Math.round(M.cond * 100)}%). Polymerases are being stripped off as the gene is packed away.`));
    if (senior && M.me > 0.5) out.push("The promoter is still <strong>methylated</strong>: maintenance methylation will copy this mark onto the new DNA, so the daughter cells inherit the silenced state.");
    if (!y7 && done) out.push("Switch back to interphase to see the chromosome unwind into a loose territory where genes can be read again.");
    return out;
  }
  if (y7) {
    if (tx > 0.05) out.push(`The model gene is <strong>unwrapped</strong>, so the copying machine can reach it: it's being copied ${f2(tx)} times per second.`);
    else if (!M.acOn) out.push("The gene is <strong>packed away tightly</strong> — the beads have closed up over its start, so the copying machine can't get on. The gene is switched off, but its DNA letters haven't changed.");
    else out.push("The gene's DNA is opening up…");
    out.push("Zoom in and out to see how the long DNA molecule is wrapped and folded to fit inside the nucleus.");
    return out;
  }
  let s;
  if (tx > 0.05) s = `The model gene's chromatin is <strong>open</strong> (${op}%): ${senior ? "acetylated histone tails grip the DNA loosely, the promoter is nucleosome-free, and RNA polymerase II" : "the promoter is unwrapped and RNA polymerase"} is transcribing it at <strong>${f2(tx)}</strong> transcripts/s.`;
  else if (M.me > 0.5) s = `The promoter is <strong>methylated</strong> (${Math.round(M.me * 100)}%). ${senior ? "Methyl-binding proteins have recruited HDACs" + (M.acOn ? " — so the acetyl tags are lost even though HATs are on" : "") + ", nucleosomes have closed over the promoter" : "The gene has packed up"} (open ${op}%), and RNA polymerase can't bind: the gene is <strong>silenced</strong>.`;
  else if (!M.acOn) s = `${senior ? "HDACs have removed the acetyl tags" : "The acetyl tags have been removed"}, so the histones grip the DNA tightly: the chromatin has closed (open ${op}%) and a nucleosome covers the promoter. RNA polymerase can't get on — transcription ${tx < 0.02 ? "has stopped" : `is down to ${f2(tx)}/s`}.`;
  else s = `The chromatin is opening (${op}%)…`;
  out.push(s);
  if (!senior && tx < 0.02) out.push("The gene's DNA sequence is exactly the same — only how tightly it's packed has changed.");
  if (senior) out.push(`<strong>DNA sequence: unchanged.</strong> Acetylation ${Math.round(M.ac * 100)}% · promoter methylation ${Math.round(M.me * 100)}% · ${ctx.pols ?? 0} polymerase${ctx.pols === 1 ? "" : "s"} on the gene. Epigenetic marks change access to the gene, not the code.`);
  if (M.supply <= 20 && M.open > 0.6) out.push(`The NTP supply is low (${M.supply}%), so even the open gene is transcribed slowly.`);
  return out;
}
