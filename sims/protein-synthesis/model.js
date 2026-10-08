// Genetics model for the protein-synthesis sim: genetic code, transcription, translation,
// mutation classification. Pure functions, no DOM.

export const BASE_COL = { A: "#4ade80", T: "#f87171", G: "#fbbf24", C: "#60a5fa", U: "#c084fc" };
export const DNA_PAIR = { A: "T", T: "A", G: "C", C: "G" };
/** template DNA base -> RNA nucleotide added opposite it */
export const RNA_FOR_TEMPLATE = { A: "U", T: "A", G: "C", C: "G" };
/** codon base -> anticodon base (RNA-RNA pairing) */
export const ANTI = { A: "U", U: "A", G: "C", C: "G" };

// Standard genetic code (NCBI table 1), bases ordered U C A G.
const AAS = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";
export const ORDER = "UCAG";
export const CODE = {};
for (let i = 0; i < 64; i++) CODE[ORDER[i >> 4] + ORDER[(i >> 2) & 3] + ORDER[i & 3]] = AAS[i];

// classes: np = non-polar (hydrophobic), pol = polar, acid = acidic (−), base = basic (+)
export const AA = {
  F: ["Phe", "Phenylalanine", "np"], L: ["Leu", "Leucine", "np"], I: ["Ile", "Isoleucine", "np"],
  M: ["Met", "Methionine", "np"], V: ["Val", "Valine", "np"], S: ["Ser", "Serine", "pol"],
  P: ["Pro", "Proline", "np"], T: ["Thr", "Threonine", "pol"], A: ["Ala", "Alanine", "np"],
  Y: ["Tyr", "Tyrosine", "pol"], H: ["His", "Histidine", "base"], Q: ["Gln", "Glutamine", "pol"],
  N: ["Asn", "Asparagine", "pol"], K: ["Lys", "Lysine", "base"], D: ["Asp", "Aspartic acid", "acid"],
  E: ["Glu", "Glutamic acid", "acid"], C: ["Cys", "Cysteine", "pol"], W: ["Trp", "Tryptophan", "np"],
  R: ["Arg", "Arginine", "base"], G: ["Gly", "Glycine", "np"], "*": ["Stop", "Stop codon", "stop"],
};
export const CLASS_COL = { np: "#fb923c", pol: "#4fd1c5", acid: "#f472b6", base: "#38bdf8", stop: "#f87171" };
export const CLASS_NAME = { np: "non-polar (hydrophobic)", pol: "polar", acid: "acidic (−)", base: "basic (+)" };
export const aaCol = (a) => CLASS_COL[AA[a][2]];

// Simplified fragment inspired by the start of the human β-globin (HBB) gene:
// Met-Val-His-Leu-Thr-Pro-Glu-Glu-Lys, with a stop codon added so the fragment is a complete gene.
export const UPSTREAM = "GCTATAAAGG";            // promoter with TATA box (simplified, not to scale)
export const CODING = "ATGGTGCACCTGACTCCTGAGGAGAAGTAA";
export const TRAILER = "CTGACTAGCA";             // 3′ untranslated region (transcribed, not translated)
export const DOWNSTREAM = "GCGCTTT";             // terminator region (not transcribed here)
export const ORIGINAL_GENE = CODING + TRAILER;   // the transcribed region (coding strand, 5′→3′)
export const SICKLE_INDEX = 19;                  // middle base of codon 6 (GAG), numbered after Met
export const SICKLE_GENE = ORIGINAL_GENE.slice(0, SICKLE_INDEX) + "T" + ORIGINAL_GENE.slice(SICKLE_INDEX + 1);

export const toRNA = (dna) => dna.replace(/T/g, "U");
export const anticodonOf = (codon) => codon.split("").map((b) => ANTI[b]).join("");

/** Translate from the first AUG. Returns { start, codons, aas, stop, end }. aas excludes the stop. */
export function translate(mrna) {
  const start = mrna.indexOf("AUG");
  const res = { start, codons: [], aas: [], stop: false, end: start };
  if (start < 0) return res;
  let i = start;
  while (i + 3 <= mrna.length) {
    const c = mrna.slice(i, i + 3);
    const a = CODE[c];
    res.codons.push(c);
    i += 3;
    if (a === "*") { res.stop = true; break; }
    res.aas.push(a);
  }
  res.end = i;
  return res;
}

/** Classify mutant gene vs original. Returns { kind, title, detail }. */
export function classify(orig, mut) {
  if (mut === orig) return { kind: "none", title: "No mutation", detail: "The DNA matches the original gene." };
  const o = translate(toRNA(orig)), m = translate(toRNA(mut));
  let i = 0;
  while (i < orig.length && i < mut.length && orig[i] === mut[i]) i++;
  const net = mut.length - orig.length;
  if (m.start < 0) return { kind: "startlost", title: "Start codon lost", detail: "There is no AUG left in the mRNA, so the ribosome cannot start translation. No protein is made." };
  if (m.start !== o.start) return { kind: "startlost", title: "Start codon changed", detail: "The original AUG is gone; the ribosome starts at a later AUG, so the protein is completely different." };
  if (i >= o.end) return { kind: "noncoding", title: "No change to the protein", detail: "The mutation is after the stop codon (in the untranslated region), so the amino acid sequence is unchanged." };
  const oa = o.aas.join(""), ma = m.aas.join("");
  if (net % 3 !== 0) return { kind: "frameshift", title: "Frameshift", detail: `${net > 0 ? "Inserting" : "Deleting"} ${Math.abs(net)} base${Math.abs(net) > 1 ? "s" : ""} shifts the reading frame, so every codon after the mutation is read differently${m.stop ? (ma.length < oa.length ? " and a stop codon appears early" : "") : " and no stop codon is found in frame"}.` };
  if (net !== 0) return { kind: "inframe", title: `In-frame ${net > 0 ? "insertion" : "deletion"}`, detail: `A multiple of 3 bases was ${net > 0 ? "added" : "removed"}, so the reading frame is kept: amino acids are ${net > 0 ? "added" : "lost"} but the rest is unchanged.` };
  if (oa === ma && m.stop === o.stop) return { kind: "silent", title: "Silent mutation", detail: "The codon changed but still codes for the same amino acid (the code is redundant), so the protein is identical." };
  if (m.stop && ma.length < oa.length) return { kind: "nonsense", title: "Nonsense mutation", detail: `A codon became a stop codon, so translation ends early: ${ma.length} amino acids instead of ${oa.length}.` };
  if (ma.length > oa.length || !m.stop) return { kind: "stoplost", title: "Stop codon lost", detail: "The stop codon now codes for an amino acid, so the ribosome reads on into the untranslated region and the protein is too long." };
  let n = 0;
  for (let k = 0; k < oa.length; k++) if (oa[k] !== ma[k]) n++;
  const k0 = [...oa].findIndex((a, k) => a !== ma[k]);
  return { kind: "missense", title: "Missense mutation", detail: `${n} amino acid${n > 1 ? "s" : ""} changed (${AA[oa[k0]][0]} → ${AA[ma[k0]][0]} at position ${k0 === 0 ? "Met" : k0}). The protein is the same length but may fold or work differently.` };
}
