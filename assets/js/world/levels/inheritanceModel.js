// Inheritance lab: the genetics model. Pure functions, no DOM, no three.js (node-testable).
//
// Covers: monohybrid crosses (autosomal dominant / recessive), ABO (multiple alleles, codominance),
// sex-linked (X-linked recessive), dihybrid (two unlinked genes), polygenic (N additive loci + environment),
// pedigrees (generation, rule-based checks, exact likelihoods by enumeration), sampling and chi-square.
//
// Conventions
//  - A genotype is a string of two single-character alleles, dominant allele first ("Cc", "AS", "Ai").
//  - A cross builds a Punnett grid: rows = the mother's gametes (eggs), columns = the father's (sperm).
//    Every cell is equally likely, so sampling a child = picking one cell uniformly. This keeps the board,
//    the expected ratios and the sampling exactly consistent.
//  - Alleles are named by their EFFECT. "Dominant" and "recessive" describe how an allele behaves in a
//    heterozygote. They say nothing about how common the allele is.

export function mulberry32(a) {
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const sup = (b, s) => `${b}<sup>${s}</sup>`;

// ------------------------------------------------------------------ gene and trait specs
// classes: phenotype classes. aff: 0 = no effect, 1 = carrier / mild "trait" shown separately, 2 = condition present.
const C = { teal: "#5eead4", amber: "#fbbf24", pink: "#f472b6", violet: "#a78bfa", sky: "#7dd3fc", orange: "#f97316", tan: "#d6b08a", sand: "#fcd34d", red: "#f87171", blue: "#60a5fa", grey: "#e5e7eb", purple: "#c084fc" };

const cls = (id, label, geno, color, aff = 0) => ({ id, label, geno, color, aff });

export const PRESETS = {
  sickle: {
    id: "sickle", mode: "mono", kind: "auto",
    gene: "HBB", chr: "11", alleles: ["A", "S"],
    fmt: { A: sup("Hb", "A"), S: sup("Hb", "S") }, name: { A: "HbA", S: "HbS" },
    classes: [cls("u", { "y7-8": "No sickle cells", "y9-10": "Unaffected", y11: "Unaffected (HbA only)" }, ["AA"], C.teal, 0),
      cls("t", { "y7-8": "Sickle-cell trait (carrier)", "y9-10": "Sickle-cell trait (carrier)", y11: "Sickle-cell trait (HbA + HbS)" }, ["AS"], C.amber, 1),
      cls("d", { "y7-8": "Sickle-cell disease", "y9-10": "Sickle-cell disease", y11: "Sickle-cell disease (HbS only)" }, ["SS"], C.pink, 2)],
    defaults: { father: ["AS"], mother: ["AS"] },
    affectedClass: "d", recessive: true,
  },
  cf: {
    id: "cf", mode: "mono", kind: "auto",
    gene: "CFTR", chr: "7", alleles: ["C", "c"], fmt: { C: "C", c: "c" }, name: { C: "C", c: "c" },
    classes: [cls("u", { "y7-8": "Does not have CF", "y9-10": "Unaffected", y11: "Unaffected" }, ["CC", "Cc"], C.teal, 0),
      cls("d", { "y7-8": "Has cystic fibrosis", "y9-10": "Cystic fibrosis", y11: "Cystic fibrosis" }, ["cc"], C.pink, 2)],
    defaults: { father: ["Cc"], mother: ["Cc"] },
    affectedClass: "d", recessive: true,
  },
  huntington: {
    id: "huntington", mode: "mono", kind: "auto",
    gene: "HTT", chr: "4", alleles: ["H", "h"], fmt: { H: "H", h: "h" }, name: { H: "H", h: "h" },
    classes: [cls("u", { "y7-8": "Will not develop HD", "y9-10": "Unaffected", y11: "Unaffected" }, ["hh"], C.teal, 0),
      cls("d", { "y7-8": "Will develop HD (later in life)", "y9-10": "Huntington's disease (late onset)", y11: "Huntington's disease (late onset)" }, ["HH", "Hh"], C.violet, 2)],
    defaults: { father: ["Hh"], mother: ["hh"] },
    affectedClass: "d", recessive: false,
  },
  lactose: {
    id: "lactose", mode: "mono", kind: "auto",
    gene: "LCT (regulatory region)", chr: "2", alleles: ["L", "l"], fmt: { L: "L", l: "l" }, name: { L: "L", l: "l" },
    classes: [cls("p", { "y7-8": "Can digest milk sugar as an adult", "y9-10": "Lactase persistence", y11: "Lactase persistence" }, ["LL", "Ll"], C.sky, 0),
      cls("n", { "y7-8": "Cannot digest milk sugar as an adult", "y9-10": "Lactase non-persistence", y11: "Lactase non-persistence" }, ["ll"], C.sand, 0)],
    defaults: { father: ["Ll"], mother: ["Ll"] },
    affectedClass: null, recessive: false,
  },
  mc1r: {
    id: "mc1r", mode: "mono", kind: "auto",
    gene: "MC1R", chr: "16", alleles: ["R", "r"], fmt: { R: "R", r: "r" }, name: { R: "R", r: "r" },
    classes: [cls("n", { "y7-8": "Not red hair", "y9-10": "Not red hair", y11: "Not red hair" }, ["RR", "Rr"], C.tan, 0),
      cls("r", { "y7-8": "Red hair", "y9-10": "Red hair", y11: "Red hair" }, ["rr"], C.orange, 0)],
    defaults: { father: ["Rr"], mother: ["Rr"] },
    affectedClass: null, recessive: true,
  },
  abo: {
    id: "abo", mode: "abo", kind: "auto",
    gene: "ABO", chr: "9", alleles: ["A", "B", "i"], fmt: { A: sup("I", "A"), B: sup("I", "B"), i: "i" }, name: { A: "I^A", B: "I^B", i: "i" },
    classes: [cls("A", { "y7-8": "Blood group A", "y9-10": "Blood group A", y11: "Blood group A" }, ["AA", "Ai"], C.red, 0),
      cls("B", { "y7-8": "Blood group B", "y9-10": "Blood group B", y11: "Blood group B" }, ["BB", "Bi"], C.blue, 0),
      cls("AB", { "y7-8": "Blood group AB", "y9-10": "Blood group AB", y11: "Blood group AB" }, ["AB"], C.purple, 0),
      cls("O", { "y7-8": "Blood group O", "y9-10": "Blood group O", y11: "Blood group O" }, ["ii"], C.grey, 0)],
    defaults: { father: ["Ai"], mother: ["Bi"] },
    affectedClass: null,
  },
  haemophilia: {
    id: "haemophilia", mode: "xlinked", kind: "x",
    gene: "F8", chr: "X", alleles: ["H", "h"], fmt: { H: "H", h: "h" }, name: { H: "H", h: "h" },
    classes: xClasses("Haemophilia A", C),
    defaults: { father: "H", mother: "Hh" },
  },
  dmd: {
    id: "dmd", mode: "xlinked", kind: "x",
    gene: "DMD", chr: "X", alleles: ["D", "d"], fmt: { D: "D", d: "d" }, name: { D: "D", d: "d" },
    classes: xClasses("Duchenne muscular dystrophy", C),
    defaults: { father: "D", mother: "Dd" },
  },
};
function xClasses(cond, C) {
  return [
    cls("Fu", { "y7-8": "Girl, not affected", "y9-10": "Daughter, unaffected", y11: "Daughter, unaffected (XᴴXᴴ)" }, ["F:dom"], C.teal, 0),
    cls("Fc", { "y7-8": "Girl, carrier", "y9-10": "Daughter, carrier", y11: "Daughter, heterozygous carrier" }, ["F:het"], C.amber, 1),
    cls("Fa", { "y7-8": "Girl, has " + cond, "y9-10": "Daughter, affected", y11: "Daughter, affected (homozygous)" }, ["F:rec"], C.pink, 2),
    cls("Mu", { "y7-8": "Boy, not affected", "y9-10": "Son, unaffected", y11: "Son, unaffected" }, ["M:dom"], C.sky, 0),
    cls("Ma", { "y7-8": "Boy, has " + cond, "y9-10": "Son, affected", y11: "Son, affected (hemizygous)" }, ["M:rec"], C.violet, 2),
  ];
}

// tag each X-linked outcome as F/M + dom/het/rec so classes can match them
function xTag(sex, alleles, gene) {
  const rec = gene.alleles[1];
  if (sex === "M") return "M:" + (alleles === rec ? "rec" : "dom");
  const n = [...alleles].filter((a) => a === rec).length;
  return "F:" + (n === 0 ? "dom" : n === 1 ? "het" : "rec");
}

/** Dihybrid (two unlinked genes). Mendel's garden pea: seed shape and seed colour. */
export const DIHYBRID = {
  id: "peas", mode: "dihybrid", kind: "auto",
  genes: [
    { gene: "SBE1", chr: "7", alleles: ["R", "r"], fmt: { R: "R", r: "r" }, trait: ["round seed", "wrinkled seed"] },
    { gene: "SGR", chr: "1", alleles: ["Y", "y"], fmt: { Y: "Y", y: "y" }, trait: ["yellow seed", "green seed"] },
  ],
  classes: [
    cls("RY", "Round, yellow", ["R_Y_"], "#fde047"),
    cls("Ry", "Round, green", ["R_yy"], "#4ade80"),
    cls("rY", "Wrinkled, yellow", ["rrY_"], "#d9b700"),
    cls("ry", "Wrinkled, green", ["rryy"], "#15803d"),
  ],
  defaults: { father: ["Rr", "Yy"], mother: ["Rr", "Yy"] },
};

export const MODE_PRESETS = {
  mono: ["sickle", "cf", "huntington", "lactose", "mc1r"],
  abo: ["abo"],
  xlinked: ["haemophilia", "dmd"],
};
/** which mode an engine.inheritancePreset id belongs to */
export function modeForPreset(id) {
  if (id === "eyes") return "poly";
  const p = PRESETS[id];
  return p ? p.mode : null;
}

// ------------------------------------------------------------------ genotypes
export function canon(alleleOrder, a, b) {
  return alleleOrder.indexOf(a) <= alleleOrder.indexOf(b) ? a + b : b + a;
}
/** every genotype for a gene's allele list, in dominance order */
export function genotypeOptions(alleles) {
  const out = [];
  for (let i = 0; i < alleles.length; i++) for (let j = i; j < alleles.length; j++) out.push(alleles[i] + alleles[j]);
  return out;
}
export function genotypeOptionsX(spec) { const [d, r] = spec.alleles; return { father: [d, r], mother: [d + d, d + r, r + r] }; }

/** html for a genotype string, e.g. "AS" -> Hb<sup>A</sup>Hb<sup>S</sup> */
export function fmtGeno(spec, geno, geneIdx = 0) {
  const g = spec.genes ? spec.genes[geneIdx] : spec;
  return [...geno].map((a) => g.fmt[a]).join("");
}

// ------------------------------------------------------------------ crosses
function phenotypeAuto(spec, genoKeys) {
  if (spec.mode === "dihybrid") {
    const [g1, g2] = genoKeys;
    const a = g1.includes("R") ? "R" : "r", b = g2.includes("Y") ? "Y" : "y";
    return a + b;
  }
  const k = genoKeys[0];
  for (const c of spec.classes) if (c.geno.includes(k)) return c.id;
  throw new Error("no class for " + k);
}

/**
 * Build a cross.
 *  - autosomal / dihybrid: father and mother are arrays of genotypes, one per gene: ["Cc"] or ["Rr","Yy"].
 *  - X-linked: father is one allele ("H" or "h"), mother a genotype ("Hh").
 * Returns { spec, rows, cols, cells, geno: Map(key -> {p, n}), cls: Map(id -> {p, n}), n }
 *  - rows[i] / cols[j]: gametes { alleles: [..], label (html), y?: true }
 *  - cells[i][j]: { key, label (html), cls, sex?, parts }
 */
export function buildCross(spec, father, mother) {
  const rows = [], cols = [];
  const cells = [];
  if (spec.kind === "x") {
    const [d, r] = spec.alleles;
    const fmtA = (a) => sup("X", a === d ? spec.fmt[d] : spec.fmt[r]);
    for (const a of [...mother]) rows.push({ alleles: [a], label: fmtA(a), x: true });
    cols.push({ alleles: [father], label: fmtA(father), x: true }, { alleles: [], label: "Y", y: true });
    for (let i = 0; i < rows.length; i++) {
      cells[i] = [];
      for (let j = 0; j < cols.length; j++) {
        const m = rows[i].alleles[0];
        let sex, geno, label;
        if (cols[j].y) { sex = "M"; geno = m; label = fmtA(m) + "Y"; }
        else { sex = "F"; geno = canon(spec.alleles, cols[j].alleles[0], m); label = [...geno].map(fmtA).join(""); }
        const tag = xTag(sex, geno, spec);
        const c = spec.classes.find((k) => k.geno.includes(tag));
        cells[i][j] = { key: sex + ":" + geno, label, cls: c.id, sex, parts: [geno] };
      }
    }
  } else {
    const genes = spec.genes || [spec];
    const gam = (parent) => {
      let list = [[]];
      parent.forEach((geno, gi) => { const next = []; for (const base of list) for (const a of geno) next.push([...base, a]); list = next; });
      return list.map((al) => ({ alleles: al, label: al.map((a, gi) => genes[gi].fmt[a]).join("") }));
    };
    cols.push(...gam(father));
    rows.push(...gam(mother));
    for (let i = 0; i < rows.length; i++) {
      cells[i] = [];
      for (let j = 0; j < cols.length; j++) {
        const parts = genes.map((g, gi) => canon(g.alleles, cols[j].alleles[gi], rows[i].alleles[gi]));
        const label = parts.map((p, gi) => [...p].map((a) => genes[gi].fmt[a]).join("")).join("");
        cells[i][j] = { key: parts.join("|"), label, cls: phenotypeAuto(spec, parts), parts };
      }
    }
  }
  const n = rows.length * cols.length;
  const geno = new Map(), cl = new Map();
  for (const row of cells) for (const c of row) {
    const g = geno.get(c.key) || { p: 0, n: 0, label: c.label, parts: c.parts, sex: c.sex }; g.n++; g.p = g.n / n; geno.set(c.key, g);
    const k = cl.get(c.cls) || { p: 0, n: 0 }; k.n++; k.p = k.n / n; cl.set(c.cls, k);
  }
  return { spec, rows, cols, cells, geno, cls: cl, n };
}

/** classes (in spec order) that can occur in this cross, with probability */
export function crossClasses(cross) {
  return cross.spec.classes.filter((c) => cross.cls.has(c.id)).map((c) => ({ ...c, p: cross.cls.get(c.id).p, n: cross.cls.get(c.id).n }));
}
export function fraction(k, n) { if (!k) return "0"; const g = gcd(k, n); return g === n ? "1" : `${k / g}/${n / g}`; }
/** the integer ratio of the classes present, e.g. "3 : 1" or "9 : 3 : 3 : 1" */
export function ratioString(cross) {
  const cs = crossClasses(cross);
  if (cs.length === 1) return "all the same";
  let g = 0; for (const c of cs) g = gcd(g, c.n);
  return cs.map((c) => c.n / g).join(" : ");
}
export function genoRatioString(cross) {
  const ks = [...cross.geno.values()];
  let g = 0; for (const c of ks) g = gcd(g, c.n);
  return ks.map((c) => c.n / g).join(" : ");
}

/** one child: pick a cell uniformly (each egg/sperm combination is equally likely) */
export function sampleChild(cross, R = Math.random) {
  const i = Math.floor(R() * cross.rows.length), j = Math.floor(R() * cross.cols.length);
  return { i, j, cell: cross.cells[i][j] };
}

// chi-square goodness of fit (5 % critical values)
export const CHI_CRIT = [0, 3.841, 5.991, 7.815, 9.488, 11.07, 12.592, 14.067, 15.507];
/** observed: Map/obj of class counts; classes with expected probability p. Returns { chi2, df, crit, fits, lowExpected } */
export function chiSquare(observed, probs, n) {
  let chi2 = 0, k = 0, low = false;
  for (const id of Object.keys(probs)) {
    const e = probs[id] * n;
    if (e <= 0) continue;
    k++;
    if (e < 5) low = true;
    const o = observed[id] || 0;
    chi2 += (o - e) * (o - e) / e;
  }
  const df = Math.max(1, k - 1);
  const crit = CHI_CRIT[Math.min(df, 8)];
  return { chi2, df, crit, fits: chi2 < crit, lowExpected: low };
}

// ------------------------------------------------------------------ polygenic
/** distribute k "+" alleles over N loci round-robin (k = 0..2N). Returns per-locus counts 0..2. */
export function polyLoci(N, k) {
  const c = new Array(N).fill(0);
  for (let s = 0; s < k; s++) c[s % N]++;
  return c;
}
export function polyStats(N, kA, kB, envSd) {
  let varG = 0, mean = 0;
  for (const k of [kA, kB]) for (const c of polyLoci(N, k)) { const p = c / 2; mean += p; varG += p * (1 - p); }
  const varE = envSd * envSd, varP = varG + varE;
  return { mean, varG, varE, varP, sd: Math.sqrt(varP), h2: varP > 0 ? varG / varP : 1 };
}
function normal(R) { let u = 0; while (u === 0) u = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * R()); }
/** one offspring: genetic score (count of + alleles) plus a normally distributed environmental effect */
export function polyChild(N, kA, kB, envSd, R = Math.random) {
  let g = 0;
  for (const k of [kA, kB]) for (const c of polyLoci(N, k)) if (R() < c / 2) g++;
  return { g, e: envSd > 0 ? normal(R) * envSd : 0 };
}
export function histogram(values, lo, hi, bins) {
  const h = new Array(bins).fill(0), w = (hi - lo) / bins;
  for (const v of values) { const b = Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / w))); h[b]++; }
  return h;
}
export function normalPdf(x, mean, sd) { return Math.exp(-0.5 * ((x - mean) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI)); }
/** pigment score 0..1 -> eye colour (blue-grey, green-hazel, brown, dark brown). Illustrative only. */
export function eyeColour(t) {
  const stops = [[0, [124, 164, 214]], [0.28, [120, 160, 150]], [0.5, [128, 126, 62]], [0.72, [112, 74, 34]], [1, [44, 24, 12]]];
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) {
    const [t0, a] = stops[i - 1], [t1, b] = stops[i], f = (t - t0) / (t1 - t0);
    return "#" + a.map((v, k) => Math.round(v + (b[k] - v) * f).toString(16).padStart(2, "0")).join("");
  }
  return "#2c180c";
}

// ------------------------------------------------------------------ pedigree
// Template (3 generations, 12 people). Individuals are in an order where parents come before children.
// id: index; label: II-1 etc.; f/m: indices of father and mother (null for founders).
const TEMPLATE = [
  { label: "I-1", sex: "M" }, { label: "I-2", sex: "F" },
  { label: "II-1", f: 0, m: 1 }, { label: "II-2", f: 0, m: 1 }, { label: "II-3", f: 0, m: 1 },
  { label: "II-4", sex: "F", founder: true }, { label: "II-5", sex: "M", founder: true },
  { label: "III-1", f: 2, m: 5 }, { label: "III-2", f: 2, m: 5 },
  { label: "III-3", f: 6, m: 3 }, { label: "III-4", f: 6, m: 3 }, { label: "III-5", f: 6, m: 3 },
];
// II-1 is a son (partner II-4); II-2 is a daughter (partner II-5). (Sex of II-3 and of the III generation is random.)
export const PEDIGREE_POS = [
  [-1.0, 3.4], [1.0, 3.4],
  [-3.8, 1.8], [3.8, 1.8], [0, 1.8],
  [-5.4, 1.8], [5.4, 1.8],
  [-5.4, 0.2], [-3.8, 0.2],
  [3.6, 0.2], [4.6, 0.2], [5.6, 0.2],
];
export const PATTERNS = ["AD", "AR", "XR"];
export const PATTERN_NAME = { AD: "autosomal dominant", AR: "autosomal recessive", XR: "X-linked recessive" };
const Q = { AD: 0.005, AR: 0.05, XR: 0.05 };   // assumed frequency of the condition's allele (rare), used only for likelihoods

function affectedC(pat, sex, c) { return pat === "AD" ? c >= 1 : pat === "AR" ? c === 2 : sex === "M" ? c === 1 : c === 2; }
function genoChoices(pat, sex) { return pat === "XR" && sex === "M" ? [0, 1] : [0, 1, 2]; }
function prior(pat, sex, c) {
  const q = Q[pat];
  if (pat === "XR" && sex === "M") return c === 1 ? q : 1 - q;
  return c === 0 ? (1 - q) ** 2 : c === 1 ? 2 * q * (1 - q) : q * q;
}
function transmit(pat, sex, c, cf, cm) {
  if (pat === "XR") {
    const pm = cm / 2;
    if (sex === "M") return c === 1 ? pm : 1 - pm;
    const pf = cf; // father is hemizygous: 0 or 1
    return c === 0 ? (1 - pf) * (1 - pm) : c === 2 ? pf * pm : pf * (1 - pm) + (1 - pf) * pm;
  }
  const pf = cf / 2, pm = cm / 2;
  return c === 0 ? (1 - pf) * (1 - pm) : c === 2 ? pf * pm : pf * (1 - pm) + (1 - pf) * pm;
}

/** Enumerate every genotype assignment consistent with the pedigree's phenotypes under pattern `pat`. */
export function enumerate(ped, pat, onLeaf) {
  const n = ped.length, g = new Array(n);
  const rec = (i, w) => {
    if (i === n) { onLeaf(g, w); return; }
    const p = ped[i];
    for (const c of genoChoices(pat, p.sex)) {
      if (affectedC(pat, p.sex, c) !== p.affected) continue;
      const pr = p.f == null ? prior(pat, p.sex, c) : transmit(pat, p.sex, c, g[p.f], g[p.m]);
      if (pr <= 0) continue;
      g[i] = c;
      rec(i + 1, w * pr);
    }
  };
  rec(0, 1);
}
/** likelihood of the observed phenotypes under a pattern, and which genotypes each person could have */
export function pedigreeFit(ped, pat) {
  let L = 0;
  const possible = ped.map(() => new Set());
  enumerate(ped, pat, (g, w) => { L += w; for (let i = 0; i < g.length; i++) possible[i].add(g[i]); });
  return { L, possible };
}

/** Rule-based checks on the displayed phenotypes (full penetrance, no new mutations, no mosaicism assumed). */
export function pedigreeRules(ped) {
  const res = { AD: { ok: true, why: [] }, AR: { ok: true, why: [] }, XR: { ok: true, why: [] }, notes: [] };
  const nm = (i) => ped[i].label;
  for (const p of ped) {
    if (p.f == null) continue;
    const F = ped[p.f], M = ped[p.m];
    if (p.affected && !F.affected && !M.affected) {
      res.AD.ok = false;
      res.AD.why.push(`${p.label} is affected but both parents (${F.label}, ${M.label}) are unaffected. A fully penetrant dominant condition needs an affected parent.`);
    }
    if (!p.affected && F.affected && M.affected) {
      res.AR.ok = false; res.XR.ok = false;
      res.AR.why.push(`${p.label} is unaffected but both parents are affected. Two parents with a recessive condition can only have affected children.`);
      res.XR.why.push(`${p.label} is unaffected but both parents are affected. Two parents with a recessive condition can only have affected children.`);
    }
    if (p.sex === "F" && p.affected && !F.affected) {
      res.XR.ok = false;
      res.XR.why.push(`${p.label} is an affected daughter of an unaffected father (${F.label}). A daughter gets her father's X, and a male with one recessive X-linked allele is always affected.`);
    }
    if (p.sex === "M" && !p.affected && M.affected) {
      res.XR.ok = false;
      res.XR.why.push(`${p.label} is an unaffected son of an affected mother (${M.label}). A son gets his mother's X, and an affected mother has the recessive allele on both X chromosomes.`);
    }
    if (p.sex === "M" && p.affected && F.affected && !M.affected) {
      res.notes.push(`${p.label} is affected and so is his father (${F.label}). In X-linked inheritance a son never gets his father's X, so his mother (${M.label}) would have to carry the allele too. That is unlikely for a rare condition, which points away from X-linked.`);
    }
  }
  return res;
}

/** full analysis: rule checks plus likelihood ranking */
export function analysePedigree(ped) {
  const rules = pedigreeRules(ped);
  const out = { rules, fit: {}, consistent: [], best: null, lr: {} };
  for (const pat of PATTERNS) {
    const fit = pedigreeFit(ped, pat);
    out.fit[pat] = fit;
    // the enumeration also catches anything the simple rules cannot (e.g. a founder constraint chain)
    if (fit.L <= 0) rules[pat].ok = false;
    if (rules[pat].ok) out.consistent.push(pat);
  }
  let best = null;
  for (const pat of out.consistent) if (!best || out.fit[pat].L > out.fit[best].L) best = pat;
  out.best = best;
  for (const pat of PATTERNS) out.lr[pat] = best && out.fit[best].L > 0 ? out.fit[best].L / Math.max(out.fit[pat].L, 1e-300) : Infinity;
  // how much does the best pattern beat the runner-up (among consistent ones)?
  const others = out.consistent.filter((p) => p !== best).map((p) => out.fit[best].L / out.fit[p].L);
  out.margin = others.length ? Math.min(...others) : Infinity;
  out.decisive = out.consistent.length === 1;
  return out;
}

/** build a random 3-generation pedigree whose true pattern is `pat` */
export function generatePedigree(pat, seed = (Math.random() * 1e9) | 0, { ambiguous = false } = {}) {
  const R = mulberry32(seed);
  for (let attempt = 0; attempt < 4000; attempt++) {
    const ped = TEMPLATE.map((t, i) => ({ id: i, label: t.label, sex: t.sex || (R() < 0.5 ? "M" : "F"), f: t.f ?? null, m: t.m ?? null, x: PEDIGREE_POS[i][0], y: PEDIGREE_POS[i][1] }));
    ped[2].sex = "M"; ped[3].sex = "F";           // II-1 son (partner II-4), II-2 daughter (partner II-5)
    const g = new Array(ped.length);
    const carrierMarry = pat === "AR" ? 0.3 : 0;   // for X-linked, no carrier marries in (keeps father-to-son affected pairs out)
    const draw = (p) => {
      if (p.f != null) {
        const cf = g[p.f], cm = g[p.m];
        if (pat === "XR") {
          const pm = cm / 2;
          if (p.sex === "M") return R() < pm ? 1 : 0;
          return (R() < cf ? 1 : 0) + (R() < pm ? 1 : 0);
        }
        return (R() < cf / 2 ? 1 : 0) + (R() < cm / 2 ? 1 : 0);
      }
      return null;
    };
    // founders
    if (pat === "AD") { const aff = R() < 0.5 ? 0 : 1; g[aff] = 1; g[1 - aff] = 0; g[5] = 0; g[6] = 0; }
    else if (pat === "AR") { g[0] = 1; g[1] = 1; g[5] = R() < carrierMarry ? 1 : 0; g[6] = R() < carrierMarry ? 1 : 0; }
    else { g[0] = 0; g[1] = 1; g[5] = R() < carrierMarry ? 1 : 0; g[6] = 0; }
    // an AD founder who is male/female is fixed by sex only for display
    for (const p of ped) { if (g[p.id] === undefined) g[p.id] = draw(p); }
    for (const p of ped) p.affected = affectedC(pat, p.sex, g[p.id]);
    const nAff = ped.filter((p) => p.affected).length;
    if (nAff < 3 || nAff > 6) continue;
    const gen3 = ped.slice(7);
    if (!gen3.some((p) => p.sex === "M") || !gen3.some((p) => p.sex === "F")) continue;
    // pattern-specific shape so the family tells a clear story
    const aff = ped.filter((p) => p.affected);
    if (pat === "AD" && !(aff.some((p) => p.id >= 7) && aff.some((p) => p.id >= 2 && p.id <= 4))) continue;
    if (pat === "AR" && !aff.some((p) => p.sex === "F")) continue;
    if (pat === "AR" && !(ped.some((p) => p.f != null && p.affected && !ped[p.f].affected && !ped[p.m].affected))) continue;
    if (pat === "XR" && (aff.some((p) => p.sex === "F") || aff.length < 2)) continue;
    if (pat === "XR" && !aff.some((p) => p.f != null && !ped[p.m].affected)) continue;
    const an = analysePedigree(ped);
    if (!an.consistent.includes(pat)) continue;
    if (!ambiguous) {
      // keep only families where the true pattern is clearly the best explanation
      if (an.best !== pat || !(an.decisive || an.margin >= 8)) continue;
    } else if (an.consistent.length < 2) continue;
    return { ped, pattern: pat, seed, analysis: an, truth: g.slice() };
  }
  return null;
}
