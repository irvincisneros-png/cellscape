// Meiosis & Variation — the genetic model, shared by the 2D sim (sim2d.js) and the 3D level (level.js).
// Pure: no DOM, no three.js.
//
// A 2n = 4 germ cell: two homologous pairs. Pair 1 (long) carries the linked genes A and B; pair 2 (short)
// carries D. The maternal homologue carries A, B, D; the paternal homologue a, b, d (so the cell's owner is
// AaBbDd, with A and B "in coupling": AB/ab).
// Each chromatid is N bins along its length; a bin stores the ORIGIN of that stretch of DNA:
//   M = maternal, P = paternal (this germ cell), X / Y = the two homologues of a second parent.
// A crossover at fraction x swaps the arm distal to x (away from the centromere) between one maternal and one
// paternal (non-sister) chromatid, so alleles beyond the chiasma change hands.

export const N = 120;                       // resolution of a chromatid (bins along its length)
export const LEN = [6.0, 4.0];              // chromosome length in model units (pair 1 long, pair 2 short)
export const WID = 0.85;                    // chromatid width in model units
export const CEN = [0.36, 0.42];            // centromere position (fraction from top end)
export const LOCI = [
  [{ pos: 0.14, gene: "A" }, { pos: 0.76, gene: "B" }],
  [{ pos: 0.74, gene: "D" }],
];
export const LOCUS = { A: { p: 0, pos: 0.14 }, B: { p: 0, pos: 0.76 }, D: { p: 1, pos: 0.74 } };
export const GENES = ["A", "B", "D"];
export const COL = { M: "#f472b6", P: "#60a5fa", X: "#4fd1c5", Y: "#fbbf24" };
// which origin carries the dominant (capital) allele at each gene (X/Y = the 2D sim's fixed "other parent")
export const UPPER = { M: { A: 1, B: 1, D: 1 }, P: {}, X: { A: 1, D: 1 }, Y: { B: 1 } };
export const allele = (origin, gene) => (UPPER[origin][gene] ? gene : gene.toLowerCase());
export const PARENTAL = ["ABD", "ABd", "abD", "abd"];
export const RECOMB = ["AbD", "Abd", "aBD", "aBd"];
export const CYCLE = [[1, 0], [0, 1], [0, 0], [1, 1]]; // [maternal sister, paternal sister] for 1st, 2nd... chiasma
export const MAX_X = 3;

export const NAMES = ["Interphase (G1)", "S phase", "Prophase I", "Metaphase I", "Anaphase I", "Telophase I",
  "Metaphase II", "Anaphase II", "Telophase II", "Gametes"];
export const DUR = [0.8, 2.0, 2.2, 1.8, 2.0, 2.2, 2.0, 1.8, 2.2, 1.0];
export const AUTO_PHASES = new Set([1, 4, 5, 7, 8]);  // advance on their own

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a = 0, b = 1, R = Math.random) => a + R() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr, R = Math.random) => arr[Math.floor(R() * arr.length)];

// ---------------------------------------------------------------- core (the reviewed 2D model)
/** Build the 8 chromatids (ch[k][s]: k = 2p maternal / 2p+1 paternal of pair p; s = sister) with crossovers. */
export function build(cross, origins = ["M", "P"]) {
  const ch = [];
  for (let k = 0; k < 4; k++) {
    const o = origins[k & 1];
    ch[k] = [new Array(N).fill(o), new Array(N).fill(o)];
  }
  for (let p = 0; p < 2; p++) {
    for (const c of cross[p]) {
      const A = ch[2 * p][c.m], B = ch[2 * p + 1][c.p];
      const i = Math.round(c.x * N);
      // the arm distal to the chiasma (away from the centromere) is exchanged
      const [lo, hi] = c.x > CEN[p] ? [i, N] : [0, i];
      for (let j = lo; j < hi; j++) { const t = A[j]; A[j] = B[j]; B[j] = t; }
    }
  }
  return ch;
}
export const atLocus = (bins, pos) => bins[Math.min(N - 1, Math.floor(pos * N))];
export function genoOf(parts) {
  const b0 = parts[0].bins, b1 = parts[1].bins;
  return allele(atLocus(b0, LOCI[0][0].pos), "A") + allele(atLocus(b0, LOCI[0][1].pos), "B") +
    allele(atLocus(b1, LOCI[1][0].pos), "D");
}
export const isRecomb = (g) => (g[0] === "A") !== (g[1] === "B");
export const sideOf = (k, orient) => (k & 1) ^ orient[k >> 1];   // 0 = left pole, 1 = right pole

export function gametesFrom(ch, orient, orient2) {
  const gs = [];
  for (let g = 0; g < 4; g++) {
    const side = g >> 1, half = g & 1, parts = [];
    for (let p = 0; p < 2; p++) {
      const k = orient[p] === side ? 2 * p : 2 * p + 1;
      const s = half ^ orient2[side][p];
      parts.push({ k, s, p, bins: ch[k][s] });
    }
    gs.push({ parts, geno: genoOf(parts) });
  }
  return gs;
}

export function validPos(p, x) {
  x = clamp(x, 0.04, 0.96);
  if (Math.abs(x - CEN[p]) < 0.06) x = CEN[p] + (x < CEN[p] ? -0.06 : 0.06);
  for (const l of LOCI[p]) if (Math.abs(x - l.pos) < 0.04) x = l.pos + (x < l.pos ? -0.04 : 0.04);
  return clamp(x, 0.04, 0.96);
}
export function randomCross(R = Math.random) {
  const out = [[], []];
  const n0 = pick([0, 1, 1, 1, 2, 2], R), n1 = pick([0, 1, 1], R);
  [n0, n1].forEach((n, p) => {
    for (let i = 0; i < n; i++) {
      const [m, q] = pick(CYCLE, R);
      out[p].push({ x: validPos(p, rand(0.06, 0.94, R)), m, p: q });
    }
  });
  return out;
}
export const randOrient = () => [randInt(0, 1), randInt(0, 1)];
export const randOrient2 = () => [randOrient(), randOrient()];

/** The 2D sim's random gamete from a fixed second parent (X/Y chromosomes). */
export function otherGamete() {
  const parts = [];
  for (let p = 0; p < 2; p++) {
    const base = Math.random() < 0.5 ? "X" : "Y", alt = base === "X" ? "Y" : "X";
    const bins = new Array(N).fill(base);
    if (p === 0 && Math.random() < 0.4) {
      const x = validPos(0, rand(0.2, 0.7)), i = Math.round(x * N);
      const [lo, hi] = x > CEN[0] ? [i, N] : [0, i];
      for (let j = lo; j < hi; j++) bins[j] = alt;
    }
    parts.push({ p, bins });
  }
  return parts;
}
export const pairStr = (a, b) => [a, b].sort().join("");

// ---------------------------------------------------------------- extensions for the 3D level
/** This germ cell's owner: maternal chromosomes AB + D, paternal ab + d. chroms[p][h] = haplotype string. */
export const P1_CHROMS = [["AB", "ab"], ["D", "d"]];

/** Allele carried by a stretch of origin `o` at gene g. Origins X/Y read the second parent's haplotypes. */
export function alleleAt(o, gene, p2chroms) {
  if (o === "M" || o === "P") return allele(o, gene);
  const L = LOCUS[gene], hap = p2chroms[L.p][o === "X" ? 0 : 1];
  return gene === "B" ? hap[1] : hap[0];
}
/** Haplotype of one chromatid: "AB"-style for pair 1, "D"-style for pair 2. */
export function hapOf(bins, p, p2chroms) {
  if (p === 0) return alleleAt(atLocus(bins, LOCUS.A.pos), "A", p2chroms) + alleleAt(atLocus(bins, LOCUS.B.pos), "B", p2chroms);
  return alleleAt(atLocus(bins, LOCUS.D.pos), "D", p2chroms);
}

/**
 * Where every chromatid ends up: dest[k][s] = { side (meiosis I pole / daughter cell), half (meiosis II pole) }.
 * err: { nd: "none" | "I" | "II", ndPair, ndCell, sgo (centromeric cohesin protected), sgoRand[k][s] }
 *  - Nondisjunction in meiosis I: both homologues of ndPair go to the same pole (the maternal one's side).
 *  - Nondisjunction in meiosis II: in daughter cell ndCell, both sisters of ndPair go to the same pole.
 *  - No shugoshin: centromeric cohesin is lost at anaphase I, so in meiosis II nothing holds the sisters
 *    together for bi-orientation and each single chromatid goes to a random pole (sgoRand).
 */
export function segregate(orient, orient2, err = {}) {
  const dest = [];
  for (let k = 0; k < 4; k++) {
    const p = k >> 1;
    let side = sideOf(k, orient);
    if (err.nd === "I" && p === err.ndPair) side = orient[p];
    dest[k] = [0, 1].map((s) => {
      let half = s ^ orient2[side][p];
      if (err.sgo === false) half = err.sgoRand ? err.sgoRand[k][s] : Math.random() < 0.5 ? 0 : 1;
      else if (err.nd === "II" && p === err.ndPair && side === err.ndCell) half = orient2[side][p];
      return { side, half };
    });
  }
  return dest;
}
export const randSgo = () => [0, 1, 2, 3].map(() => [Math.random() < 0.5 ? 0 : 1, Math.random() < 0.5 ? 0 : 1]);

/**
 * The four products of one meiosis (gamete index g = side * 2 + half), from chromatid destinations.
 * Each: { g, parts: [{k,s,p,bins}], perPair: [c1, c2], count, euploid, geno, ploidy }.
 * geno is "ABD" style for normal (euploid) gametes, e.g. "AB/ab D" or "AB –" otherwise.
 */
export function gametesFromDest(ch, dest, p2chroms) {
  const gs = [];
  for (let g = 0; g < 4; g++) {
    const side = g >> 1, half = g & 1, parts = [];
    for (let k = 0; k < 4; k++) for (let s = 0; s < 2; s++) {
      const d = dest[k][s];
      if (d.side === side && d.half === half) parts.push({ k, s, p: k >> 1, bins: ch[k][s] });
    }
    parts.sort((a, b) => a.p - b.p || a.k - b.k || a.s - b.s);
    gs.push(describeGamete(g, parts, p2chroms));
  }
  return gs;
}
export function describeGamete(g, parts, p2chroms) {
  const perPair = [0, 0], haps = [[], []];
  for (const q of parts) { perPair[q.p]++; haps[q.p].push(hapOf(q.bins, q.p, p2chroms)); }
  const count = perPair[0] + perPair[1];
  const euploid = perPair[0] === 1 && perPair[1] === 1;
  const geno = euploid ? haps[0][0] + haps[1][0] : `${haps[0].join("/") || "–"} ${haps[1].join("/") || "–"}`;
  const d = count - 2;
  const ploidy = euploid ? "n" : d === 0 ? "n (unbalanced)" : d > 0 ? `n+${d}` : `n−${-d}`;
  return { g, parts, perPair, count, euploid, geno, haps, ploidy };
}

/** Which division an aneuploid gamete's extra copies point to: two different homologues (MI) or two sisters (MII). */
export function extraOrigin(gm) {
  for (let p = 0; p < 2; p++) {
    const q = gm.parts.filter((x) => x.p === p);
    if (q.length >= 2) return q[0].k !== q[1].k ? "homologues" : "sisters";
  }
  return null;
}

// ---------------------------------------------------------------- parents, gametes and offspring (inheritance)
/** Second parent's chromosomes from a genotype { A: "Aa", B: "Bb", D: "dd", phase: "cis" | "trans" }. */
export function chromsFrom(gt) {
  const a = gt.A.split(""), b = gt.B.split(""), d = gt.D.split("");
  // order alleles capital-first on homologue 0 for "cis" (AB/ab), cross them for "trans" (Ab/aB)
  const sa = [...a].sort(), sb = [...b].sort();
  const hb = gt.phase === "trans" && sa[0] !== sa[1] && sb[0] !== sb[1] ? [sb[1], sb[0]] : sb;
  return [[sa[0] + hb[0], sa[1] + hb[1]], [[...d].sort()[0], [...d].sort()[1]]];
}
export const genotypeStr = (gt) => `${gt.A}${gt.B}${gt.D}`;

/** One random gamete (haplotypes) from a parent's chromosomes, using the same crossover model as the cell. */
export function randomGameteHaps(chroms, crossMode = "random", R = Math.random) {
  const cross = crossMode === "none" ? [[], []] : randomCross(R);
  const out = [];
  for (let p = 0; p < 2; p++) {
    // track only the loci: org[h][s][l] = which homologue (0/1) the DNA at locus l came from (same rule as build())
    const loci = LOCI[p], org = [0, 1].map((h) => [0, 1].map(() => loci.map(() => h)));
    for (const c of cross[p]) {
      const i = Math.round(c.x * N);
      loci.forEach((l, li) => {
        const j = Math.min(N - 1, Math.floor(l.pos * N));
        const inSwap = c.x > CEN[p] ? j >= i : j < i;
        if (inSwap) { const a = org[0][c.m], b = org[1][c.p], t = a[li]; a[li] = b[li]; b[li] = t; }
      });
    }
    const h = R() < 0.5 ? 0 : 1, s = R() < 0.5 ? 0 : 1, o = org[h][s];
    if (p === 0) out.push(chroms[0][o[0]][0] + chroms[0][o[1]][1]);
    else out.push(chroms[1][o[0]]);
  }
  return out;  // [pair-1 haplotype "AB", pair-2 haplotype "D"]
}

/** Bins (X/Y origins) for a second parent's gamete chromatids, matching the haplotypes drawn from it. */
export function parentGameteParts(chroms, crossMode = "random") {
  const cross = crossMode === "none" ? [[], []] : randomCross();
  const ch = build(cross, ["X", "Y"]);
  const parts = [];
  for (let p = 0; p < 2; p++) {
    const k = Math.random() < 0.5 ? 2 * p : 2 * p + 1, s = Math.random() < 0.5 ? 0 : 1;
    parts.push({ k: 10 + p, s: 0, p, bins: ch[k][s] });
  }
  return parts;
}

// a seeded PRNG (so the expected recombination frequency is a fixed number)
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Expected recombination frequency between A and B under the random-crossover model (fraction of gametes). */
export const REC_FREQ = (() => {
  const R = mulberry32(20261009);
  let rec = 0;
  const n = 40000;
  for (let i = 0; i < n; i++) { const h = randomGameteHaps(P1_CHROMS, "random", R)[0]; if ((h[0] === "A") !== (h[1] === "B")) rec++; }
  return rec / n;
})();

/** Gamete types with probabilities for the listed genes, e.g. genes ["A","B"] → [{ hap: "AB", f }]. */
export function gameteDist(chroms, genes, r = REC_FREQ) {
  const m = new Map();
  const add = (h, f) => m.set(h, (m.get(h) || 0) + f);
  const g = (gene, h) => (gene === "D" ? chroms[1][h] : chroms[0][h][gene === "A" ? 0 : 1]);
  if (genes.length === 1) for (const h of [0, 1]) add(g(genes[0], h), 0.5);
  else if (genes.includes("D")) {
    const other = genes[0] === "D" ? genes[1] : genes[0];
    for (const h1 of [0, 1]) for (const h2 of [0, 1]) add(g(other, h1) + g("D", h2), 0.25);
  } else {
    // linked A and B: parental haplotypes (1 − r)/2 each, recombinants r/2 each
    const [p0, p1] = chroms[0];
    add(p0, (1 - r) / 2); add(p1, (1 - r) / 2);
    add(p0[0] + p1[1], r / 2); add(p1[0] + p0[1], r / 2);
  }
  return [...m.entries()].filter(([, f]) => f > 1e-9).map(([hap, f]) => ({ hap, f }))
    .sort((a, b) => b.f - a.f || (a.hap < b.hap ? -1 : 1));
}
/** Combine two gamete haplotypes gene-by-gene into a sorted genotype string, e.g. "Aa", "AaDd". */
export function combine(h1, h2) {
  let s = "";
  for (let i = 0; i < h1.length; i++) s += [h1[i], h2[i]].sort().join("");
  return s;
}
/** Phenotype key for a genotype string of alleles (any capital = dominant), e.g. "AaDd" → "AD", "aadd" → "ad". */
export function phenoKey(geno) {
  let s = "";
  for (let i = 0; i < geno.length; i += 2) s += geno[i];   // sorted pairs put a capital (dominant) allele first
  return s;
}
/** Expected offspring phenotype distribution from two gamete distributions. */
export function expected(d1, d2) {
  const m = new Map();
  for (const a of d1) for (const b of d2) { const k = phenoKey(combine(a.hap, b.hap)); m.set(k, (m.get(k) || 0) + a.f * b.f); }
  return m;
}
/** Allele lists per gene for any set of chromatid parts (zygotes may be trisomic or monosomic). */
export function allelesOf(parts, p2chroms) {
  const out = { A: [], B: [], D: [] };
  for (const q of parts) {
    if (q.p === 0) { out.A.push(alleleAt(atLocus(q.bins, LOCUS.A.pos), "A", p2chroms)); out.B.push(alleleAt(atLocus(q.bins, LOCUS.B.pos), "B", p2chroms)); }
    else out.D.push(alleleAt(atLocus(q.bins, LOCUS.D.pos), "D", p2chroms));
  }
  for (const g of GENES) out[g].sort();
  return out;
}
