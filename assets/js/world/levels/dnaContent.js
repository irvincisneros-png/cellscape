// Content for the DNA double-helix level: the model sequence and its regions, lens-aware text, missions and quiz.
import { UPSTREAM, ORIGINAL_GENE, DOWNSTREAM, CODING, CODE, AA, toRNA } from "../../../../sims/protein-synthesis/model.js";

export const FLANK_L = "TTGACCGA", FLANK_R = "ACTGGCAT";      // non-gene DNA either side (made up, for context)
export const SEQ = FLANK_L + UPSTREAM + ORIGINAL_GENE + DOWNSTREAM + FLANK_R;
export const PROM0 = FLANK_L.length;                         // first promoter bp
export const GENE0 = PROM0 + UPSTREAM.length;                // first bp of the transcribed region (A of ATG)
export const CODE_END = GENE0 + CODING.length;               // end of the coding region (after TAA)
export const TERM0 = GENE0 + ORIGINAL_GENE.length;           // first terminator bp
export const FLANK_R0 = TERM0 + DOWNSTREAM.length;
export const DEFAULT_ATOMS_BP = GENE0 + 3;                    // G of codon 1 (GTG): a G≡C pair

const NAME = { A: "adenine", T: "thymine", G: "guanine", C: "cytosine" };
export const baseName = (b) => NAME[b];

/** Describe where bp i sits in the model gene. */
export function region(i) {
  if (i < PROM0 || i >= FLANK_R0) return { key: "flank", text: { "y7-8": "DNA outside the gene", "y9-10": "Non-coding DNA next to the gene", y11: "Flanking non-coding DNA" } };
  if (i < GENE0) {
    const tata = i >= PROM0 + 2 && i < PROM0 + 8;
    return { key: "promoter", text: { "y7-8": "The gene's 'start here' signal", "y9-10": `Promoter${tata ? " (TATA box)" : ""}: where RNA polymerase binds`, y11: `Promoter${tata ? " — TATA box" : ""}: RNA polymerase and transcription factors bind here` } };
  }
  if (i < CODE_END) {
    const c = Math.floor((i - GENE0) / 3), cod = SEQ.slice(GENE0 + 3 * c, GENE0 + 3 * c + 3), aa = CODE[toRNA(cod)];
    const what = c === 0 ? "start codon (Met)" : aa === "*" ? "stop codon" : `codon ${c} (${cod} → ${AA[aa][0]})`;
    const sickle = c === 6 ? " — the sickle-cell codon" : "";
    return { key: "codon", c, cod, text: { "y7-8": c === 6 ? "Part of the gene — the letters changed in sickle-cell disease" : "Part of the gene's instructions", "y9-10": `Gene: ${what}${sickle}`, y11: `Coding sequence: ${what}${sickle}` } };
  }
  if (i < TERM0) return { key: "utr", text: { "y7-8": "End of the gene", "y9-10": "Copied into mRNA but not used to make protein", y11: "3′ untranslated region (transcribed, not translated)" } };
  return { key: "term", text: { "y7-8": "The gene's 'stop copying' signal", "y9-10": "Terminator region", y11: "Terminator region: transcription ends near here" } };
}

export const NOTE = {
  "y7-8": "This is a real human gene (part of the gene for haemoglobin, the protein that carries oxygen in blood). We've put it inside a plant cell just for teaching — plants have their own genes, but all DNA is built the same way.",
  "y9-10": "Model gene: a short fragment of the human β-globin gene (haemoglobin), shown inside a plant cell for teaching. All DNA — plant, animal or bacterial — has the same structure. Not to scale: atoms and colours are simplified.",
  y11: "Model gene: a simplified fragment of human β-globin (HBB) — first 9 codons plus a stop — shown inside a plant cell for teaching. The promoter is shortened (the TATA box really sits ~25–30 bp upstream). Geometry is B-DNA: right-handed, ~10.5 bp per turn, 0.34 nm rise, ~2 nm wide.",
};

export const PARTS = {
  phosphate: { "y7-8": "Phosphate — part of the side of the ladder", "y9-10": "Phosphate group (backbone)", y11: "Phosphate: links the 3′ carbon of one deoxyribose to the 5′ carbon of the next (phosphodiester bond)" },
  sugar: { "y7-8": "Sugar — part of the side of the ladder", "y9-10": "Deoxyribose sugar (backbone)", y11: "Deoxyribose: a 5-carbon sugar; the base attaches to its 1′ carbon" },
};

export const MISSIONS = [
  { id: "select", band: "y7-8", maxBand: "y9-10", text: { "y7-8": "Click a rung of the ladder to see which two bases are joined.", "y9-10": "Click a base pair to inspect it." } },
  { id: "ladder", band: "y7-8", maxBand: "y7-8", text: { "y7-8": "Untwist the double helix into a flat ladder." } },
  { id: "backbone", band: "y7-8", maxBand: "y7-8", text: { "y7-8": "Light up the sides of the ladder (sugars and phosphates)." } },
  { id: "gc", band: "y9-10", text: { "y9-10": "Find a G–C pair and count its hydrogen bonds.", y11: "Find a G≡C pair and count its hydrogen bonds." } },
  { id: "at", band: "y11", text: { y11: "Find an A=T pair and count its hydrogen bonds." } },
  { id: "anti", band: "y9-10", text: { "y9-10": "Show the strands are antiparallel: click the 5′ end of each strand." } },
  { id: "atoms", band: "y7-8", maxBand: "y9-10", text: { "y7-8": "Zoom right in until you can see the atoms in one rung.", "y9-10": "Zoom right in to see the atoms of a base pair." } },
  { id: "chargaff", band: "y9-10", text: { "y9-10": "Use Chargaff's rule to predict a base percentage.", y11: "Use Chargaff's rule to predict a base percentage." } },
  { id: "unzip", band: "y7-8", text: { "y7-8": "Unzip the DNA and add 6 matching letters to copy it.", "y9-10": "Unzip the DNA with helicase and add 6 complementary nucleotides.", y11: "Unzip with helicase and extend the leading strand by 8 nucleotides." } },
  { id: "okazaki", band: "y11", text: { y11: "Watch DNA ligase seal an Okazaki fragment on the lagging strand." } },
];

export const QUIZ = [
  // Years 7–8
  { maxBand: "y7-8", q: "DNA is shaped like…", options: ["A straight rod", "A twisted ladder (double helix)", "A ball", "A single long thread"], answer: 1, why: "Two long strands twist round each other. The sides of the ladder are sugar and phosphate; the rungs are pairs of bases." },
  { maxBand: "y7-8", q: "The rungs of the DNA ladder are made of…", options: ["Pairs of bases", "Phosphates", "Proteins", "Water"], answer: 0, why: "Each rung is two bases joined in the middle: A with T, and G with C." },
  { maxBand: "y7-8", q: "Which base always pairs with A (adenine)?", options: ["G", "C", "T", "A"], answer: 2, why: "A always pairs with T, and G always pairs with C. That's why one strand can be used to rebuild the other." },
  { maxBand: "y7-8", q: "Why does the DNA ladder 'unzip' before a cell divides?", options: ["To destroy the DNA", "So each half can be used to build a new matching half — making two copies", "To let water in", "Because the cell is too hot"], answer: 1, why: "Each separated strand is a template: matching bases are added to it, giving two identical DNA molecules — one for each new cell." },
  { maxBand: "y7-8", q: "Where is most of a plant cell's DNA kept?", options: ["In the cell wall", "In the vacuole", "In the nucleus", "In the cytoplasm"], answer: 2, why: "Most DNA is in the nucleus, packed into chromosomes. (Chloroplasts and mitochondria also have a little DNA of their own.)" },
  // Years 9–10
  { band: "y9-10", maxBand: "y9-10", q: "A DNA nucleotide is made of…", options: ["A sugar, a phosphate and a nitrogenous base", "An amino acid and a sugar", "Three bases", "A phosphate and two bases"], answer: 0, why: "Each nucleotide = deoxyribose sugar + phosphate group + one of four bases (A, T, G or C). Sugars and phosphates form the backbone." },
  { band: "y9-10", q: "The bases in a pair are held together by…", options: ["Strong covalent bonds", "Hydrogen bonds", "Peptide bonds", "Magnets"], answer: 1, why: "Hydrogen bonds are weak on their own, so the two strands can be separated (unzipped) for copying and reading — but millions of them together keep DNA stable." },
  { band: "y9-10", q: "A sample of DNA is 30% adenine. What percentage is guanine?", options: ["30%", "20%", "40%", "70%"], answer: 1, why: "A = T, so T is 30% too (60% total). The other 40% is split equally between G and C: 20% each. This is Chargaff's rule." },
  { band: "y9-10", maxBand: "y9-10", q: "What does 'antiparallel' mean for the two strands?", options: ["They never touch", "They run in opposite directions (5′→3′ one way, 3′→5′ the other)", "They are identical", "They twist the opposite way"], answer: 1, why: "One strand runs 5′→3′ left to right; its partner runs 5′→3′ right to left. Click the 5′ ends to check." },
  { band: "y9-10", maxBand: "y9-10", q: "Whose X-ray diffraction image ('Photo 51') was key evidence that DNA is a helix?", options: ["Gregor Mendel", "Rosalind Franklin (with Raymond Gosling)", "Charles Darwin", "Louis Pasteur"], answer: 1, why: "Franklin and Gosling's X-ray image showed a helix. Watson and Crick used it, with Chargaff's base ratios, to build their 1953 double-helix model." },
  // Year 11+
  { band: "y11", q: "Why is the double helix the same width all the way along?", options: ["Every pair is a purine with a pyrimidine", "All four bases are the same size", "Hydrogen bonds stretch to fit", "Phosphates fill the gaps"], answer: 0, why: "A and G are double-ring purines; T and C are single-ring pyrimidines. Each pair is one of each, so every rung is the same length." },
  { band: "y11", q: "Which statement about G≡C and A=T pairs is correct?", options: ["G≡C has 3 hydrogen bonds, A=T has 2, so G–C-rich DNA is harder to separate", "Both have 2 hydrogen bonds", "A=T has 3 hydrogen bonds", "G pairs with T"], answer: 0, why: "Three H-bonds versus two: regions rich in G–C need more energy (higher temperature) to separate." },
  { band: "y11", q: "DNA replication is described as semi-conservative because…", options: ["Half the genes are copied", "Each new DNA molecule has one original strand and one new strand", "Only the leading strand is copied", "It conserves energy"], answer: 1, why: "Each parent strand is a template, so each daughter molecule keeps one old strand. In the model the new strands are teal." },
  { band: "y11", q: "Why is the lagging strand made in short Okazaki fragments?", options: ["DNA polymerase can only add nucleotides to a 3′ end, so on that template it must work away from the fork", "Helicase breaks it into pieces", "It is made of RNA", "Ligase cuts it up"], answer: 0, why: "New DNA can only grow 5′→3′. On the lagging-strand template that is away from the fork, so it is built in pieces (each started by a primer from primase) and joined by DNA ligase." },
  { band: "y11", q: "Which enzyme breaks the hydrogen bonds between the two strands?", options: ["DNA ligase", "Primase", "Helicase", "RNA polymerase"], answer: 2, why: "Helicase unwinds and unzips the double helix at the replication fork. Primase lays primers, DNA polymerase adds nucleotides, ligase joins fragments." },
];

/** "What's happening" text from the level's actual state. */
export function narrative(st, band) {
  const y7 = band === "y7-8", y11 = band === "y11" || band === "y12";
  const p = [];
  if (st.fork > 0.5) {
    const fork = Math.min(st.n, Math.round(st.fork));
    if (y7) p.push(`<p>The <strong>unzipper</strong> has pulled apart <strong>${fork}</strong> rungs. Each half-ladder is a pattern for a new half. You've added <strong>${st.lead}</strong> matching letters to the lower half; the upper half is being copied in short pieces.</p>`);
    else p.push(`<p><strong>Helicase</strong> has unzipped <strong>${fork} bp</strong> by breaking the hydrogen bonds between bases. Free nucleotides pair with each exposed template base (A–T, G–C). New leading strand: <strong>${st.lead} nt</strong>${y11 ? `; lagging strand: <strong>${st.frags}</strong> Okazaki fragment${st.frags === 1 ? "" : "s"}, ${st.sealed} sealed by ligase` : ""}.</p>`);
    if (y11) p.push(`<p>New DNA only grows <strong>5′→3′</strong>. The lower template runs 3′→5′ towards the fork, so its new strand is continuous (<strong>leading</strong>). The upper template runs the other way, so its copy is made backwards in short <strong>Okazaki fragments</strong>, each started by an RNA <strong>primer</strong> (purple) from primase and joined by <strong>DNA ligase</strong>. Each daughter molecule keeps one old strand — <strong>semi-conservative</strong> replication.</p>`);
    else if (!y7) p.push(`<p>Each new double strand has one <strong>old</strong> strand (grey) and one <strong>new</strong> strand (teal), so the two copies are identical.</p>`);
  } else if (st.twist < 0.3) {
    p.push(y7 ? `<p>Untwisted, DNA is a <strong>ladder</strong>. The <strong>sides</strong> are sugars and phosphates; each <strong>rung</strong> is two bases joined in the middle — A with T, G with C.</p>`
      : `<p>Untwisted, you can see the plan of DNA clearly: two <strong>sugar–phosphate backbones</strong> with <strong>complementary base pairs</strong> between them (A–T, G–C), held by hydrogen bonds.</p>`);
  } else {
    p.push(y7 ? `<p>DNA is a <strong>double helix</strong> — a ladder twisted round and round. This piece holds part of a <strong>gene</strong>: instructions for making a protein, written in four letters (A, T, G, C).</p>`
      : y11 ? `<p>A right-handed <strong>B-DNA</strong> double helix: ~10.5 base pairs per turn, 0.34 nm per base pair, 2 nm wide. The two <strong>antiparallel</strong> strands leave a wide <strong>major groove</strong> and a narrow <strong>minor groove</strong>, where proteins read the base edges.</p>`
      : `<p>A DNA <strong>double helix</strong>: two strands of <strong>nucleotides</strong> twisted together. Each nucleotide is a deoxyribose sugar, a phosphate and a nitrogenous base. The strands run in opposite directions (<strong>antiparallel</strong>).</p>`);
  }
  if (st.lod === "atoms") p.push(y7 ? `<p>You're zoomed right in: each ball is an <strong>atom</strong>. The glowing dashes are the weak bonds holding the two bases together.</p>`
    : `<p>Atom view of a <strong>${st.atomPair}</strong> pair: carbon grey, nitrogen blue, oxygen red, hydrogen white. ${y11 ? `The <strong>purine</strong> (two rings) pairs with a <strong>pyrimidine</strong> (one ring) through ${st.atomHB} hydrogen bonds.` : `${st.atomHB} hydrogen bonds (glowing dashes) hold the pair together.`}</p>`);
  else if (st.lod === "far" && !st.fork) p.push(`<p class="hint">${y7 ? "Zoom in to see the parts of each rung." : "Zoom in to see individual nucleotides; zoom further for atoms."}</p>`);
  if (st.sel) p.push(`<p class="now">${st.sel}</p>`);
  return p.join("");
}
