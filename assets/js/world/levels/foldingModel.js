// Protein folding level: model. Pure JS, no DOM / THREE (node-testable).
//  • Sequences: the model gene from sims/protein-synthesis/model.js (a 9-residue β-globin fragment) is the
//    N-terminal piece of the full human haemoglobin β chain (HBB, 147 residues incl. Met).
//  • Mutation classification of whatever polypeptide arrives from the "DNA to protein" level.
//  • A coarse-grained (one bead per amino acid, Cα) folding simulation: overdamped Langevin (Brownian)
//    dynamics with bond springs, excluded volume, a structure-based (Gō-like) native-contact potential,
//    helix chirality, non-specific hydrophobic attraction and screened (Debye–Hückel) electrostatics whose
//    charges follow pH (Henderson–Hasselbalch). 1 length unit = 3.8 Å (one Cα–Cα step).
import { translate, toRNA, ORIGINAL_GENE, SICKLE_GENE, AA, classify } from "../../../../sims/protein-synthesis/model.js";

// ---------- sequences ----------
/** Human haemoglobin β chain (UniProt P68871), with the initiator Met as index 0 (so Glu6 = index 6). */
export const HBB = "MVHLTPEEKSAVTALWGKVNVDEVGGEALGRLLVVYPWTQRFFESFGDLSTPDAVMGNPKVKAHGKKVLGAFSDGLAHLDNLKGTFATLSELHCDKLHVDPENFRLLGNVLVCVLAHHFGKEFTPPVQAAYQKVVAGVANALAHKYH";
export const FRAG = translate(toRNA(ORIGINAL_GENE)).aas.join("");          // "MVHLTPEEK"
export const SICKLE_FRAG = translate(toRNA(SICKLE_GENE)).aas.join("");    // "MVHLTPVEK"
export const MAXN = 150;
/** α-helices of the β chain (globin fold, index = residue number; C is a short 3₁₀ helix). */
export const HELICES = [["A", 4, 17], ["B", 19, 34], ["C", 35, 41], ["D", 50, 56], ["E", 57, 76], ["F", 85, 93], ["G", 99, 117], ["H", 123, 145]];
export const PROXIMAL_HIS = 92, DISTAL_HIS = 63, SICKLE_POS = 6, ACCEPTOR = [85, 88]; // Phe85 / Leu88 pocket

const T2O = {};
for (const [k, v] of Object.entries(AA)) if (k !== "*") T2O[v[0].toLowerCase()] = k;

/** Bead property class: hyd (hydrophobic) / pol (polar) / pos (+) / neg (−) / spc (special: Gly, Pro, Cys). */
export function propOf(a) {
  if ("GPC".includes(a)) return "spc";
  if ("AVLIMFW".includes(a)) return "hyd";
  if ("KRH".includes(a)) return "pos";
  if ("DE".includes(a)) return "neg";
  return "pol";
}
export const PROP_COL = { hyd: "#fb923c", pol: "#4fd1c5", pos: "#38bdf8", neg: "#f472b6", spc: "#a8b3c4" };
/** hydrophobicity used for the physics, 0..1 (from Kyte–Doolittle-like ordering, simplified). */
const HYD = { I: 1, V: 0.95, L: 0.95, F: 0.9, M: 0.75, W: 0.6, C: 0.6, A: 0.55, Y: 0.3, G: 0.2, P: 0.2, T: 0.1, S: 0.05, H: 0.1 };
export const hydOf = (a) => HYD[a] || 0;
export const name3 = (a) => (a === "?" ? "Xaa" : AA[a]?.[0] || "Xaa");
export const nameFull = (a) => AA[a]?.[1] || "unknown";

/** Normalise an incoming polypeptide (3-letter or 1-letter codes) to a 1-letter string; stops at a stop. */
export function normalisePolypeptide(p) {
  if (!p) return null;
  const arr = typeof p === "string" ? (p.includes("-") || p.includes(" ") || p.includes(",") ? p.split(/[-\s,]+/) : p.length > 3 && /^[A-Z*]+$/.test(p) ? [...p] : [p]) : Array.isArray(p) ? p : null;
  if (!arr) return null;
  let s = "";
  for (const x of arr) {
    if (x == null) continue;
    const t = String(x).trim();
    if (!t) continue;
    if (/^(stop|\*|ter|x)$/i.test(t)) break;
    const one = t.length === 1 ? (AA[t.toUpperCase()] ? t.toUpperCase() : null) : T2O[t.slice(0, 3).toLowerCase()];
    if (!one) return null;
    s += one;
  }
  return s;
}

// a reproducible "scrambled" tail for frameshifts (after the shift the real gene would be read out of frame)
const SCR = "RGLWSAPRVTGQLSCAHPWRGLSTARPGQ";
/**
 * Decide what the incoming fragment means for the whole β chain.
 * frag: 1-letter string ("" = no protein), gene: optional coding-strand DNA from the expression level.
 * Returns { kind, title, detail, seq (full chain for the simulation), frag, diffAt[] }.
 */
export function scenarioFor(frag, gene = null) {
  if (frag == null) frag = FRAG;
  let kind = null, cls = null;
  if (typeof gene === "string" && /^[ACGT]+$/.test(gene)) { try { cls = classify(ORIGINAL_GENE, gene); kind = cls.kind; } catch { cls = null; } }
  if (!kind) {
    if (frag === FRAG) kind = "none";
    else if (!frag.length) kind = "startlost";
    else if (frag.length === FRAG.length) kind = [...frag].filter((a, i) => a !== FRAG[i]).length ? "missense" : "none";
    else if (frag.length < FRAG.length && FRAG.startsWith(frag)) kind = "nonsense";
    else if (frag.length > FRAG.length && frag.startsWith(FRAG)) kind = "stoplost";
    else {
      let pre = 0, suf = 0;
      while (pre < frag.length && frag[pre] === FRAG[pre]) pre++;
      while (suf < frag.length - pre && suf < FRAG.length - pre && frag[frag.length - 1 - suf] === FRAG[FRAG.length - 1 - suf]) suf++;
      if (pre + suf >= Math.min(frag.length, FRAG.length)) kind = "inframe";
    }
    if (!kind) {
      const k = [...frag].findIndex((a, i) => a !== FRAG[i]);
      kind = k >= 0 && frag.slice(k).length !== FRAG.slice(k).length ? "frameshift" : frag.length > FRAG.length ? "stoplost" : "missense";
    }
  }
  const diffAt = [];
  for (let i = 0; i < Math.max(frag.length, FRAG.length); i++) if (frag[i] !== FRAG[i]) diffAt.push(i);
  let seq;
  const rest = HBB.slice(FRAG.length);
  if (kind === "startlost" || !frag.length) { kind = kind === "noncoding" ? "none" : "startlost"; seq = ""; }
  else if (kind === "nonsense") seq = frag;
  else if (kind === "frameshift") {
    const shift = diffAt.length ? diffAt[0] : frag.length;
    // the ribosome keeps reading the shifted frame until it meets a stop codon; past the 9-codon model gene
    // we don't show the real out-of-frame codons, so a short reproducible "scrambled" tail stands in for them.
    const tail = frag.length >= FRAG.length ? SCR.slice(0, 6 + (shift % 5) * 3) : "";
    seq = frag + tail;
  } else seq = frag + rest;
  if (kind === "none" || kind === "noncoding") kind = seq === HBB ? kind : "missense";
  seq = seq.slice(0, MAXN);
  const sickle = kind === "missense" && seq.length === HBB.length && seq[SICKLE_POS] === "V" && [...seq].every((a, i) => i === SICKLE_POS || a === HBB[i]);
  if (sickle) kind = "sickle";
  if (kind === "missense" && cls == null && seq === HBB) kind = "none";
  return { kind, seq, frag, diffAt, cls };
}

/** Preset scenarios for the "try each type" buttons. Each gives a fragment + a coding-strand gene. */
export function preset(kind) {
  const g = ORIGINAL_GENE;
  const sub = (i, b) => g.slice(0, i) + b + g.slice(i + 1);
  switch (kind) {
    case "silent": { const gene = sub(23, "A"); return { gene, frag: translate(toRNA(gene)).aas.join(""), note: "GAG → GAA (codon 7): both codons mean Glu" }; }
    case "sickle": return { gene: SICKLE_GENE, frag: SICKLE_FRAG, note: "GAG → GTG (codon 6): Glu → Val" };
    case "nonsense": { const gene = sub(21, "T"); return { gene, frag: translate(toRNA(gene)).aas.join(""), note: "GAG → TAG (codon 7): Glu → STOP" }; }
    case "frameshift": { const gene = g.slice(0, 13) + g.slice(14); return { gene, frag: translate(toRNA(gene)).aas.join(""), note: "one base (C) deleted in codon 4" }; }
    default: return { gene: g, frag: FRAG, note: "the original gene" };
  }
}

// ---------- native structure (designed globin-like fold, generated offline by relaxing an ideal-helix
// layout with hydrophobic attraction around a haem group; see the level report) ----------
const NATIVE_STR = "-0.783,0.425,-1.499,-0.643,1.353,-1.864,-1.305,1.552,-2.614,-2.255,1.706,-2.812,-2.428,2.15,-3.702,-1.784,2.735,-4.247,-1.78,3.461,-3.554,-1.653,2.738,-2.849,-0.863,2.41,-3.377,-0.497,3.349,-3.33,-0.666,3.352,-2.338,-0.162,2.488,-2.24,0.609,2.878,-2.741,0.571,3.667,-2.117,0.591,3.089,-1.329,1.384,2.589,-1.687,1.853,3.479,-1.844,1.641,3.826,-0.938,0.801,4.185,-0.52,1.074,3.927,0.428,1.161,3.076,-0.102,1.765,2.711,0.633,1.098,2.926,1.334,0.342,2.539,0.814,0.835,1.714,0.605,1.036,1.587,1.557,0.091,1.702,1.864,-0.295,1.094,1.166,0.385,0.414,1.327,0.195,0.413,2.308,-0.77,0.269,2.12,-0.578,-0.458,1.455,0.076,-0.944,2.015,-0.528,-0.892,2.796,-1.278,-1.256,2.285,-1.777,-1.276,3.16,-2.299,-0.422,3.188,-2.131,-0.315,2.205,-2.465,-1.266,2.086,-3.308,-1.046,2.571,-3.43,-0.264,1.976,-3.274,-0.808,1.148,-3.131,-0.94,0.183,-3.832,-1.188,-0.475,-3.158,-1.805,-0.913,-2.304,-1.783,-0.388,-2.46,-2.679,0.03,-2.152,-3.621,-0.004,-1.246,-3.245,0.194,-0.772,-4.077,-0.071,0.151,-4.438,-0.241,0.234,-5.222,0.384,1.18,-5.347,0.13,1.354,-4.365,0.333,0.895,-4.432,1.207,1.455,-5.235,1.448,2.29,-4.786,1.201,3.274,-4.594,1.253,3.534,-4.459,0.278,2.545,-4.396,0.062,2.482,-3.667,0.771,3.226,-3.187,0.342,2.752,-3.251,-0.512,1.911,-2.907,-0.085,2.424,-2.111,0.253,2.81,-1.93,-0.645,1.892,-2.008,-1.048,1.523,-1.378,-0.376,2.2,-0.686,-0.621,2.019,-0.855,-1.597,1.042,-0.724,-1.448,1.201,0.131,-0.998,1.774,0.457,-1.739,1.107,0.227,-2.43,0.34,0.635,-1.939,0.844,1.474,-1.749,1.068,1.518,-2.715,2.006,1.689,-2.42,2.008,1.59,-1.417,2.812,2.182,-1.327,2.148,2.684,-0.734,1.63,1.953,-0.306,2.479,1.828,0.188,3.018,1.251,-0.423,2.306,0.572,-0.646,1.539,0.77,-0.047,2.269,0.739,0.664,1.584,0.506,1.357,1.224,-0.201,0.738,2.128,-0.596,0.655,2.207,-0.606,1.643,1.296,-1.059,1.716,1.611,-1.757,1.071,2.457,-1.885,1.579,2.19,-1.826,2.534,1.293,-1.952,2.975,0.378,-1.996,2.559,-0.008,-2.907,2.607,-0.068,-2.701,1.628,0.14,-3.511,1.066,0.729,-3.315,0.26,-0.086,-3.044,-0.266,-0.361,-2.473,0.476,0.534,-2.055,0.505,0.42,-1.854,-0.497,-0.44,-1.437,-0.263,0.002,-0.9,0.473,0.638,-0.585,-0.229,-0.104,-0.3,-0.812,-0.492,0.168,-0.007,0.353,0.648,0.172,0.381,0.968,-0.766,-0.567,1.261,-0.648,-0.307,1.778,0.144,0.38,2.201,-0.427,-0.372,2.43,-1.044,-0.814,2.893,-0.288,0.001,3.415,-0.033,-0.53,3.407,0.81,-0.267,4.388,0.81,-0.652,5.205,0.407,-0.517,4.808,-0.488,-0.654,3.92,-0.91,-1.444,4.362,-1.37,-2.397,4.059,-1.296,-2.226,3.265,-1.886,-1.397,3.07,-1.352,-1.966,3.09,-0.494,-2.612,2.456,-0.923,-1.839,1.867,-1.198,-1.48,1.898,-0.273,-2.362,1.591,0.108,-2.456,0.871,-0.562,-1.515,0.533,-0.476,-1.546,0.55,0.523,-2.396,0.028,0.501,-2.005,-0.636,-0.145,-1.19,-0.747,0.412,-1.698,-0.882,1.225,-2.306,-1.572,0.809,-1.522,-2.065,0.48,-1.084,-2.037,1.366,-1.929,-2.33,1.821,-2.004,-3.116,1.192,-1.061,-3.373,1.43,-1.248,-3.299,2.404,-1.27,-3.859,3.249,1.455,-3.107,1.881,0.181,-0.694,-0.697";
export const NATIVE = new Float64Array(NATIVE_STR.split(",").map(Number));   // 147 beads × xyz, then haem xyz + normal xyz
export const NATIVE_N = 147;

// ---------- small math ----------
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function gaussFactory(seed = 7) {
  const r = mulberry32(seed);
  let spare = null;
  return () => {
    if (spare != null) { const s = spare; spare = null; return s; }
    let u = 0, v = 0, s = 0;
    do { u = r() * 2 - 1; v = r() * 2 - 1; s = u * u + v * v; } while (s >= 1 || s === 0);
    const m = Math.sqrt((-2 * Math.log(s)) / s);
    spare = v * m;
    return u * m;
  };
}
export function signedVolume(p, i) {
  const a0 = p[3 * i + 3] - p[3 * i], a1 = p[3 * i + 4] - p[3 * i + 1], a2 = p[3 * i + 5] - p[3 * i + 2];
  const b0 = p[3 * i + 6] - p[3 * i + 3], b1 = p[3 * i + 7] - p[3 * i + 4], b2 = p[3 * i + 8] - p[3 * i + 5];
  const c0 = p[3 * i + 9] - p[3 * i + 6], c1 = p[3 * i + 10] - p[3 * i + 7], c2 = p[3 * i + 11] - p[3 * i + 8];
  return a0 * (b1 * c2 - b2 * c1) + a1 * (b2 * c0 - b0 * c2) + a2 * (b0 * c1 - b1 * c0);
}
export const helixOf = (i) => { for (const h of HELICES) if (i >= h[1] && i <= h[2]) return h; return null; };

// ---------- charges ----------
const PKA = { D: 3.9, E: 4.1, H: 6.0, K: 10.5, R: 12.5, Y: 10.1, C: 8.3 };
export function chargeAt(a, pH) {
  if (a === "D" || a === "E" || a === "Y" || a === "C") return -1 / (1 + Math.pow(10, PKA[a] - pH));
  if (a === "K" || a === "R" || a === "H") return 1 / (1 + Math.pow(10, pH - PKA[a]));
  return 0;
}
export const NTERM_PKA = 8.0, CTERM_PKA = 3.6;
export function netCharge(seq, pH) {
  let q = 1 / (1 + Math.pow(10, pH - NTERM_PKA)) - 1 / (1 + Math.pow(10, CTERM_PKA - pH));
  for (const a of seq) q += chargeAt(a, pH);
  return q;
}

/** 1 near neutral pH, falling to ≈ 0.4 below pH ≈ 4.5 or above ≈ 11 (qualitative, calibrated). */
export const pHStability = (pH) => 0.4 + 0.6 / ((1 + Math.exp((4.6 - pH) / 0.3)) * (1 + Math.exp((pH - 11.2) / 0.3)));

/** Map the temperature slider (°C) onto the simulation's thermal energy kT (qualitative, calibrated so the
 *  model protein is stable at body temperature and unfolds above ≈ 60–65 °C). */
const KT37 = 0.8, TS = 57;                  // kT at 37 °C; e-folding temperature scale (°C)
export const ktFor = (T) => KT37 * Math.exp((T - 37) / TS);
export const T_MID = 65;                    // the model chain is about half-unfolded here (calibrated, see report)
export const KT_MID = ktFor(T_MID);

// ---------- the simulation ----------
const RB = 0.525, RH = 1.0;                // excluded-volume radii (bead, haem)
const CUT = 5.6;                            // neighbour-list cutoff
const SWELL = 4;                            // strength of net-charge swelling
const HCOLL = 0.1;                          // long-range hydrophobic collapse force
const TAILK = 0.35, FUNNEL = 5;              // native-contact tail depth; extra funnel steepness when far from native
const TAIL = 1.6;                           // width of the long-range side of native-contact wells

export class FoldSim {
  /** seq: 1-letter string (≤ 150). */
  constructor(seq, seed = 11) {
    this.gauss = gaussFactory(seed);
    this.setSequence(seq);
    this.T = 37; this.pH = 7.4; this.chaperone = false;
    this.mode = "tertiary";
    this.damaged = false; this.stressT = 0; this.refoldT = 0;
    this.t = 0;
  }

  setSequence(seq) {
    seq = (seq || "").slice(0, MAXN);
    this.seq = seq;
    const n = (this.n = seq.length);
    // map each residue onto the native chain (substitutions keep their index; in-frame indels keep the
    // shared start and end; truncated / frameshifted chains keep only the unchanged start)
    const ni = (this.ni = new Int16Array(n).fill(-1));
    const f = (this.nativeF = new Float64Array(n));
    let pre = 0;
    while (pre < n && pre < NATIVE_N && seq[pre] === HBB[pre]) pre++;
    if (n === NATIVE_N) {
      let mism = 0;
      for (let i = 0; i < n; i++) if (seq[i] !== HBB[i]) mism++;
      for (let i = 0; i < n; i++) {
        if (seq[i] === HBB[i]) { ni[i] = i; f[i] = 1; }
        else if (mism <= 3) { ni[i] = i; const a = propOf(seq[i]), b = propOf(HBB[i]); f[i] = a === b ? 0.9 : (a === "hyd") !== (b === "hyd") ? 0.45 : 0.75; }
      }
    } else {
      for (let i = 0; i < pre; i++) { ni[i] = i; f[i] = 1; }
      let suf = 0;
      while (suf < n - pre && suf < NATIVE_N - pre && seq[n - 1 - suf] === HBB[NATIVE_N - 1 - suf]) suf++;
      if (pre + suf > 0.6 * NATIVE_N) for (let k = 0; k < suf; k++) { ni[n - 1 - k] = NATIVE_N - 1 - k; f[n - 1 - k] = 1; }
    }
    const hx = (this.hx = new Int8Array(n).fill(-1));
    for (let i = 0; i < n; i++) if (ni[i] >= 0) hx[i] = HELICES.findIndex((h) => ni[i] >= h[1] && ni[i] <= h[2]);
    this.hyd = new Float64Array(n);
    for (let i = 0; i < n; i++) this.hyd[i] = hydOf(seq[i]);
    // haem: present only if the pocket (helices E and F with both histidines) is native
    const at = (r) => ni.indexOf(r);
    const iP = at(PROXIMAL_HIS), iD = at(DISTAL_HIS);
    const pocketOK = n >= 100 && iP >= 0 && iD >= 0 && f[iP] > 0.8 && f[iD] > 0.8;
    this.hasHaem = pocketOK;
    this.iProx = iP; this.iDist = iD; this.iSickle = at(SICKLE_POS);
    const N = (this.N = n + 1);            // always allocate a haem slot (index n)
    this.p = new Float64Array(3 * N);
    this.F = new Float64Array(3 * N);
    this.prev = new Float64Array(3 * N);
    this.q = new Float64Array(N);
    // ----- native wells -----
    const W = [];  // [i, j, r0, eps, sig, cat]  cat 0 = helix i+3/i+4, 1 = tertiary, 2 = haem
    const P = NATIVE, d = (a, b) => Math.hypot(P[3 * a] - P[3 * b], P[3 * a + 1] - P[3 * b + 1], P[3 * a + 2] - P[3 * b + 2]);
    const isNat = (this.isNat = new Uint8Array(N * N));
    for (let i = 0; i < n; i++) for (let j = i + 3; j < n; j++) {
      const w = f[i] * f[j];
      if (w <= 0) continue;
      const a = ni[i], b = ni[j], r0 = d(a, b);
      if (hx[i] >= 0 && hx[i] === hx[j] && b - a <= 4 && j - i === b - a) { W.push([i, j, r0, (j - i === 4 ? 1.25 : 0.7) * w, 0.16, 0]); isNat[i * N + j] = 1; continue; }
      if (r0 < 1.95 && b - a >= 3) {
        const e = (0.62 + 0.55 * Math.min(this.hyd[i], this.hyd[j])) * w;
        W.push([i, j, r0, e, 0.3, 1]); isNat[i * N + j] = 1;
      }
    }
    if (pocketOK) {
      const h3 = 3 * NATIVE_N;
      for (let i = 0; i < n; i++) {
        if (ni[i] < 0 || f[i] <= 0) continue;
        const a = ni[i], r0 = Math.hypot(P[3 * a] - P[h3], P[3 * a + 1] - P[h3 + 1], P[3 * a + 2] - P[h3 + 2]);
        if (r0 < 2.55) { W.push([i, n, r0, 0.7 * f[i] * (a === PROXIMAL_HIS ? 2.2 : 1), 0.35, 2]); isNat[i * N + n] = 1; }
      }
    }
    this.W = W;
    this.nTert = W.filter((w) => w[5] === 1).length;
    this.nHaem = W.filter((w) => w[5] === 2).length;
    // ----- chirality (signed volume of i..i+3 = native value) -----
    const C = [];
    for (let i = 0; i + 3 < n; i++) {
      const w = Math.min(f[i], f[i + 1], f[i + 2], f[i + 3]);
      if (w <= 0 || ni[i + 3] - ni[i] !== 3) continue;
      const inHelix = hx[i] >= 0 && hx[i] === hx[i + 3];
      C.push([i, signedVolume(P, ni[i]), (inHelix ? 0.9 : 0.35) * w, inHelix ? 0.25 : 0.5, inHelix ? 1 : 0]);
    }
    this.C = C;
    this.nbr = new Int32Array(0); this.nbrN = 0; this.nbrAge = 999;
    this.helicity = new Float64Array(n);
    this.formed = new Uint8Array(W.length);
    this.layout = null; this.sse = null;
    this.metrics = { Q: 0, helix: 0, burial: 0, rg: 0, haem: 0, compact: false, state: "unfolded", net: 0 };
    this.reset(n ? "native" : "extended");
  }

  // ----- initial conformations -----
  reset(kind = "extended") {
    const { n, p } = this;
    if (kind === "native") {
      for (let i = 0; i < n; i++) {
        const a = this.ni[i];
        if (a >= 0) { p[3 * i] = NATIVE[3 * a]; p[3 * i + 1] = NATIVE[3 * a + 1]; p[3 * i + 2] = NATIVE[3 * a + 2]; }
        else if (i) { p[3 * i] = p[3 * i - 3] + 0.9; p[3 * i + 1] = p[3 * i - 2] + 0.35 * Math.sin(i); p[3 * i + 2] = p[3 * i - 1] + 0.3; }
      }
    } else if (kind === "layout") {
      const L = this.serpentine();
      p.set(L.subarray(0, 3 * n));
    } else {
      // an extended random coil (persistent random walk), as if just released from the ribosome
      let x = 0, y = 0, z = 0, dx = 1, dy = 0, dz = 0;
      for (let i = 0; i < n; i++) {
        p[3 * i] = x; p[3 * i + 1] = y; p[3 * i + 2] = z;
        dx += this.gauss() * 0.9; dy += this.gauss() * 0.9; dz += this.gauss() * 0.9;
        const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
        x += dx; y += dy; z += dz;
      }
    }
    // haem
    const h = 3 * n;
    if (this.hasHaem && kind === "native") { p[h] = NATIVE[3 * NATIVE_N]; p[h + 1] = NATIVE[3 * NATIVE_N + 1]; p[h + 2] = NATIVE[3 * NATIVE_N + 2]; }
    else { p[h] = 0; p[h + 1] = -9; p[h + 2] = 4; }
    this.recentre(true);
    this.prev.set(p);
    this.nbrAge = 999;
    this.damaged = false; this.stressT = 0; this.refoldT = 0;
    this.measure();
  }

  /** A readable flat snake for the "primary structure" step. Returns positions (3n). */
  serpentine() {
    const n = this.n, row = Math.max(8, Math.min(15, Math.ceil(Math.sqrt(n * 1.6)))), out = new Float64Array(3 * Math.max(1, n));
    const rows = Math.ceil(n / row);
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / row), k = i % row, dir = r % 2 ? -1 : 1;
      let x = (dir > 0 ? k : row - 1 - k) * 1.02 - (row - 1) * 0.51;
      let y = ((rows - 1) / 2 - r) * 1.75;
      // the turn at the end of a row: lift the last bead halfway down
      if (k === row - 1 && i < n - 1) { y -= 0.8; x += dir * 0.35; }
      out[3 * i] = x; out[3 * i + 1] = y; out[3 * i + 2] = 0;
    }
    return out;
  }

  /** helix-centre targets for the "secondary" step: native helix centres spread apart, so the helices form but don't pack */
  secondaryTargets() {
    const out = [];
    let k = 0;
    HELICES.forEach(([nm], h) => {
      let a = -1, b = -1;
      for (let i = 0; i < this.n; i++) if (this.hx[i] === h && this.nativeF[i] > 0) { if (a < 0) a = i; b = i; }
      if (a < 0 || b - a < 3) return;
      const x = ((k % 4) - 1.5) * 5.6, y = (k < 4 ? 1 : -1) * 4.2;
      out.push({ a, b, name: nm, t: [x, y, 0] });
      k++;
    });
    return out;
  }

  setMode(m) {
    this.mode = m;
    if (m === "primary") this.layout = this.serpentine();
    if (m === "secondary") this.sse = this.secondaryTargets();
  }

  get kT() { return ktFor(this.T); }
  /** conditions that unfold the model protein */
  get harsh() { return this.T >= 62 || this.pH < 4.6 || this.pH > 10.8; }

  updateCharges() {
    const { n, seq, q, pH } = this;
    for (let i = 0; i < n; i++) q[i] = chargeAt(seq[i], pH);
    if (n) { q[0] += 1 / (1 + Math.pow(10, pH - NTERM_PKA)); q[n - 1] -= 1 / (1 + Math.pow(10, CTERM_PKA - pH)); }
    q[n] = 0;
    this.metrics.net = netCharge(seq, pH);
  }

  buildNeighbours() {
    const { N, p } = this;
    const list = [];
    const c2 = CUT * CUT;
    for (let i = 0; i < N; i++) for (let j = i + 2; j < N; j++) {
      const dx = p[3 * i] - p[3 * j], dy = p[3 * i + 1] - p[3 * j + 1], dz = p[3 * i + 2] - p[3 * j + 2];
      if (dx * dx + dy * dy + dz * dz < c2) list.push(i, j);
    }
    this.nbr = Int32Array.from(list); this.nbrN = list.length / 2; this.nbrAge = 0;
  }

  /** advance by `steps` Brownian-dynamics steps of size dt (reduced units) */
  step(steps = 10, dt = 0.009) {
    if (!this.n) return;
    this.updateCharges();
    const { n, N, p, F, W, C, q, hyd, isNat } = this;
    const kT = this.kT, mode = this.mode;
    const local = mode !== "primary", tert = mode === "tertiary" || mode === "quaternary";
    const damaged = this.damaged && !this.chaperone;
    const held = this.damaged && this.chaperone;  // a chaperone holds the chain: no sticky clumping
    const hot = kT > KT_MID;
    const eNN = tert ? (held ? 0.05 : damaged && !hot ? 0.95 : hot ? 0.1 : 0.32) : 0;
    const lB = tert ? 3.0 : 0, kap = 1 / 2.4;
    const useTert = tert && !this.damaged;
    // the funnel: the less native the chain is, the more strongly distant native partners feel each other (speeds folding
    // up to classroom time; real folding of this protein takes milliseconds to seconds)
    const tailK = hot || this.harsh ? 0.1 : TAILK + FUNNEL * (1 - this.metrics.Q);
    // extreme pH also breaks salt bridges and hydrogen bonds inside the fold (buried groups gain/lose H⁺)
    const fpH = pHStability(this.pH);
    // long-range collapse only matters while the chain is still expanded
    const rgN = 0.52 * Math.pow(n, 0.38), coll = tert && !held && !hot ? HCOLL * Math.min(1, Math.max(0, (this.metrics.rg - 1.15 * rgN) / rgN)) : 0;
    for (let s = 0; s < steps; s++) {
      if (this.nbrAge++ >= 8) this.buildNeighbours();
      F.fill(0);
      // bonds (i, i+1)
      for (let i = 0; i < n - 1; i++) {
        const a = 3 * i, b = a + 3;
        const dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2];
        const r = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6, k = (150 * (r - 1)) / r;
        F[a] += k * dx; F[a + 1] += k * dy; F[a + 2] += k * dz; F[b] -= k * dx; F[b + 1] -= k * dy; F[b + 2] -= k * dz;
      }
      // i, i+2: stiffness (no hairpins sharper than ~80°); straightening in the primary step
      const r2min = mode === "primary" ? 1.92 : 1.3;
      for (let i = 0; i < n - 2; i++) {
        const a = 3 * i, b = a + 6;
        const dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2];
        const r = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        if (r >= r2min) continue;
        const k = (-20 * (r - r2min)) / r;
        F[a] -= k * dx; F[a + 1] -= k * dy; F[a + 2] -= k * dz; F[b] += k * dx; F[b + 1] += k * dy; F[b + 2] += k * dz;
      }
      // native wells (Gaussian: E = −ε exp(−(r−r0)²/2σ²))
      if (local) for (let w = 0; w < W.length; w++) {
        const e = W[w], cat = e[5];
        if (cat !== 0 && !useTert) continue;
        if (cat === 2 && !this.hasHaem) continue;
        const i = e[0], j = e[1], a = 3 * i, b = 3 * j;
        const dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2];
        const r = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6, u = r - e[2];
        // inside: narrow well; outside: a broad tail (σ ≥ 1.1) so distant partners still feel a gentle pull (the funnel)
        const sg = e[4];
        let k = 0;
        const ee = cat === 0 ? e[3] : e[3] * fpH;
        if (u < 3.5 * sg) { const g = Math.exp((-u * u) / (2 * sg * sg)); k = (-ee * g * u) / (sg * sg * r); }  // −dE/dr / r
        if (u > 0 && cat !== 0 && u < 3.5 * TAIL) { const g = Math.exp((-u * u) / (2 * TAIL * TAIL)); k -= (tailK * ee * g * u) / (TAIL * TAIL * r); }
        if (k === 0) continue;
        F[a] -= k * dx; F[a + 1] -= k * dy; F[a + 2] -= k * dz; F[b] += k * dx; F[b + 1] += k * dy; F[b + 2] += k * dz;
      }
      // chirality: signed volume wells (keep helices right-handed and loops in their native twist)
      if (local) for (let c = 0; c < C.length; c++) {
        const e = C[c], i = e[0];
        if (!useTert && !e[4]) continue;
        const o = 3 * i;
        const a0 = p[o + 3] - p[o], a1 = p[o + 4] - p[o + 1], a2 = p[o + 5] - p[o + 2];
        const b0 = p[o + 6] - p[o + 3], b1 = p[o + 7] - p[o + 4], b2 = p[o + 8] - p[o + 5];
        const c0 = p[o + 9] - p[o + 6], c1 = p[o + 10] - p[o + 7], c2 = p[o + 11] - p[o + 8];
        const bc0 = b1 * c2 - b2 * c1, bc1 = b2 * c0 - b0 * c2, bc2 = b0 * c1 - b1 * c0;
        const ca0 = c1 * a2 - c2 * a1, ca1 = c2 * a0 - c0 * a2, ca2 = c0 * a1 - c1 * a0;
        const ab0 = a1 * b2 - a2 * b1, ab1 = a2 * b0 - a0 * b2, ab2 = a0 * b1 - a1 * b0;
        const V = a0 * bc0 + a1 * bc1 + a2 * bc2, u = V - e[1], sg = e[3];
        const g = Math.exp((-u * u) / (2 * sg * sg));
        const k = (-e[2] * g * u) / (sg * sg); // −dE/dV
        F[o] -= k * bc0; F[o + 1] -= k * bc1; F[o + 2] -= k * bc2;
        F[o + 3] += k * (bc0 - ca0); F[o + 4] += k * (bc1 - ca1); F[o + 5] += k * (bc2 - ca2);
        F[o + 6] += k * (ca0 - ab0); F[o + 7] += k * (ca1 - ab1); F[o + 8] += k * (ca2 - ab2);
        F[o + 9] += k * ab0; F[o + 10] += k * ab1; F[o + 11] += k * ab2;
      }
      // non-bonded: excluded volume, non-native hydrophobic attraction, Debye–Hückel electrostatics
      const nb = this.nbr;
      for (let k2 = 0; k2 < this.nbrN; k2++) {
        const i = nb[2 * k2], j = nb[2 * k2 + 1];
        const haem = j === n;
        if (haem && !this.hasHaem) continue;
        if (!haem && j - i < 3 && j - i !== 2) continue;
        const a = 3 * i, b = 3 * j;
        const dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2];
        const r2 = dx * dx + dy * dy + dz * dz;
        if (r2 > 30) continue;
        const r = Math.sqrt(r2) || 1e-6;
        let fr = 0; // −dE/dr (positive = repulsive)
        const rex = haem ? RB + RH : 2 * RB;
        if (r < rex) fr += 40 * (rex - r);
        if (!haem && j - i >= 3) {
          if (eNN > 0 && !isNat[i * N + j]) {
            const hh = hyd[i] * hyd[j];
            if (hh > 0.08 && r < 2.6) { const u = r - 1.45, g = Math.exp((-u * u) / 0.18); fr -= (eNN * hh * g * u) / 0.09; }
            if (coll > 0 && hh > 0.25 && r > 2 && r < 5.4) fr -= coll * hh;   // the hydrophobic effect also drives a slower, longer-range collapse
          }
          if (lB > 0) {
            const qq = q[i] * q[j];
            if (qq * qq > 1e-4 && r < 5.2) { const rr = Math.max(r, 0.9), ex = Math.exp(-rr * kap); fr += lB * qq * ex * (1 / (rr * rr) + kap / rr); }
          }
        } else if (haem && eNN > 0 && !this.damaged) {
          // the haem group is greasy: it likes hydrophobic neighbours
          const h = hyd[i];
          if (h > 0.3 && r < 3) { const u = r - 1.8, g = Math.exp((-u * u) / 0.3); fr -= (0.25 * h * g * u) / 0.15; }
        }
        if (fr === 0) continue;
        const k = fr / r;
        F[a] -= k * dx; F[a + 1] -= k * dy; F[a + 2] -= k * dz; F[b] += k * dx; F[b + 1] += k * dy; F[b + 2] += k * dz;
      }
      // net charge: when pH leaves every ionisable group with the same sign, the chain repels itself
      // (mean-field Coulomb from the rest of the protein, smoothed; screened Debye–Hückel handles local pairs)
      if (lB > 0) {
        const Qn = this.metrics.net;
        if (Qn * Qn > 4) {
          const kq = SWELL * Qn;
          for (let i = 0; i < n; i++) {
            const qi = q[i];
            if (qi * Qn <= 0) continue;
            const x = p[3 * i], y = p[3 * i + 1], z = p[3 * i + 2], r = Math.hypot(x, y, z);
            const k = (kq * qi) / (r * r * r + 27);
            F[3 * i] += k * x; F[3 * i + 1] += k * y; F[3 * i + 2] += k * z;
          }
        }
      }
      // step-specific guides (conceptual stepper, not physics)
      if (mode === "primary" && this.layout) {
        const L = this.layout;
        for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) F[3 * i + c] += 2.2 * (L[3 * i + c] - p[3 * i + c]);
      } else if (mode === "secondary" && this.sse) {
        for (const h of this.sse) {
          let cx = 0, cy = 0, cz = 0;
          const m = h.b - h.a + 1;
          for (let i = h.a; i <= h.b; i++) { cx += p[3 * i]; cy += p[3 * i + 1]; cz += p[3 * i + 2]; }
          const fx = 0.6 * (h.t[0] - cx / m), fy = 0.6 * (h.t[1] - cy / m), fz = 0.6 * (h.t[2] - cz / m);
          for (let i = h.a; i <= h.b; i++) { F[3 * i] += fx; F[3 * i + 1] += fy; F[3 * i + 2] += fz; }
        }
        // loops in the secondary step: a weak pull to keep the string spread out
        for (let i = 0; i < n; i++) if (this.hx[i] < 0) { F[3 * i + 2] -= 0.15 * p[3 * i + 2]; }
      }
      // haem: when no pocket holds it, it drifts gently away (released)
      const h = 3 * n;
      if (this.hasHaem && useTert) {
        const hx = p[h], hy = p[h + 1], hz = p[h + 2], r = Math.hypot(hx, hy, hz) || 1e-6;
        if (this.harsh) {
          // released haem drifts out of the unfolded chain
          const k = (0.5 * (9 - r)) / r; F[h] += k * hx; F[h + 1] += k * hy; F[h + 2] += k * hz;
        } else if (r > 3.2) {
          // free haem drifts back toward the protein (its pocket's contacts then capture it)
          const k = -0.6 / r; F[h] += k * hx; F[h + 1] += k * hy; F[h + 2] += k * hz;
        }
      }
      if (!this.hasHaem || mode === "primary" || mode === "secondary") { F[h] += 0.5 * (0 - p[h]); F[h + 1] += 0.5 * (-11 - p[h + 1]); F[h + 2] += 0.5 * (3 - p[h + 2]); }
      // integrate (overdamped Langevin): x += F dt + sqrt(2 kT dt) ξ
      const sd = Math.sqrt(2 * kT * dt);
      for (let i = 0; i < N; i++) {
        const mob = i === n ? 0.4 : 1;
        for (let c = 0; c < 3; c++) {
          let dxs = F[3 * i + c] * dt * mob;
          if (dxs > 0.25) dxs = 0.25; else if (dxs < -0.25) dxs = -0.25;
          p[3 * i + c] += dxs + sd * Math.sqrt(mob) * this.gauss();
        }
      }
      this.t += dt;
    }
    this.recentre(false);
    this.measure();
  }

  /** keep the chain centred and remove the random overall tumbling (so students see the fold, not a spin) */
  recentre(hard) {
    const { n, N, p, prev } = this;
    if (!n) return;
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < n; i++) { cx += p[3 * i]; cy += p[3 * i + 1]; cz += p[3 * i + 2]; }
    cx /= n; cy /= n; cz /= n;
    for (let i = 0; i < N; i++) { p[3 * i] -= cx; p[3 * i + 1] -= cy; p[3 * i + 2] -= cz; }
    if (!hard && this.mode !== "primary") {
      // ω ≈ Σ r × Δr / Σ r²: undo that net rotation
      let lx = 0, ly = 0, lz = 0, I = 0;
      for (let i = 0; i < n; i++) {
        const x = p[3 * i], y = p[3 * i + 1], z = p[3 * i + 2];
        const dx = x - prev[3 * i], dy = y - prev[3 * i + 1], dz = z - prev[3 * i + 2];
        lx += y * dz - z * dy; ly += z * dx - x * dz; lz += x * dy - y * dx; I += x * x + y * y + z * z;
      }
      if (I > 1e-6) {
        const wx = -lx / I, wy = -ly / I, wz = -lz / I;
        for (let i = 0; i < N; i++) {
          const x = p[3 * i], y = p[3 * i + 1], z = p[3 * i + 2];
          p[3 * i] += wy * z - wz * y; p[3 * i + 1] += wz * x - wx * z; p[3 * i + 2] += wx * y - wy * x;
        }
      }
    }
    prev.set(p);
  }

  /** gently rotate the whole molecule toward the native orientation (rigid rotation: no effect on the physics) */
  alignToNative(frac = 0.15) {
    const { n, N, p, ni } = this, m = n;
    if (m < 10) return;
    let cx = 0, cy = 0, cz = 0, nx = 0, ny = 0, nz = 0, w = 0;
    for (let i = 0; i < m; i++) if (ni[i] >= 0) { const a = ni[i]; cx += p[3 * i]; cy += p[3 * i + 1]; cz += p[3 * i + 2]; nx += NATIVE[3 * a]; ny += NATIVE[3 * a + 1]; nz += NATIVE[3 * a + 2]; w++; }
    if (w < 10) return;
    cx /= w; cy /= w; cz /= w; nx /= w; ny /= w; nz /= w;
    const S = new Float64Array(9);
    for (let i = 0; i < m; i++) if (ni[i] >= 0) {
      const t = ni[i], a = [p[3 * i] - cx, p[3 * i + 1] - cy, p[3 * i + 2] - cz], b = [NATIVE[3 * t] - nx, NATIVE[3 * t + 1] - ny, NATIVE[3 * t + 2] - nz];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) S[3 * r + c] += a[r] * b[c];
    }
    const q = hornQuat(S);
    if (!q) return;
    // slerp from identity by frac
    let [qw, qx, qy, qz] = q;
    if (qw < 0) { qw = -qw; qx = -qx; qy = -qy; qz = -qz; }
    const ang = 2 * Math.acos(Math.min(1, qw)), s = Math.sin(ang / 2);
    if (ang < 1e-4 || s < 1e-6) return;
    const a2 = (ang * frac) / 2, ss = Math.sin(a2) / s;
    rotateAll(p, N, Math.cos(a2), qx * ss, qy * ss, qz * ss, cx, cy, cz);
    this.prev.set(p);
  }

  // ----- observables -----
  measure() {
    const { n, p, W } = this, M = this.metrics;
    if (!n) { Object.assign(M, { Q: 0, helix: 0, burial: 0, rg: 0, haem: 0, state: "none" }); return; }
    let qt = 0, qh = 0, nh = 0;
    const hel = this.helicity; hel.fill(0);
    const cnt = (this._cnt ||= new Float64Array(MAXN)); cnt.fill(0);
    for (let w = 0; w < W.length; w++) {
      const e = W[w], i = e[0], j = e[1], a = 3 * i, b = 3 * j;
      const r = Math.hypot(p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]);
      const ok = r < e[2] * 1.22 + 0.08;
      this.formed[w] = ok ? 1 : 0;
      if (e[5] === 1) { if (ok) qt++; }
      else if (e[5] === 2) { if (ok) qh++; }
      else if (j - i === 4) { nh++; if (ok) { hel[i] += 0.5; hel[j] += 0.5; for (let k = i + 1; k < j; k++) hel[k] += 0.34; } }
    }
    for (let i = 0; i < n; i++) hel[i] = Math.min(1, hel[i]);
    let hs = 0, hn = 0;
    for (let i = 0; i < n; i++) if (this.hx[i] >= 0 && this.nativeF[i] > 0) { hs += hel[i]; hn++; }
    // burial: hydrophobic beads with many neighbours
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < n; i++) { cx += p[3 * i]; cy += p[3 * i + 1]; cz += p[3 * i + 2]; }
    cx /= n; cy /= n; cz /= n;
    let rg = 0;
    for (let i = 0; i < n; i++) rg += (p[3 * i] - cx) ** 2 + (p[3 * i + 1] - cy) ** 2 + (p[3 * i + 2] - cz) ** 2;
    rg = Math.sqrt(rg / n);
    let bh = 0, th = 0, bp = 0, tp = 0;
    for (let i = 0; i < n; i++) {
      let c = 0;
      for (let j = 0; j < n; j++) {
        if (Math.abs(i - j) < 2) continue;
        const dx = p[3 * i] - p[3 * j], dy = p[3 * i + 1] - p[3 * j + 1], dz = p[3 * i + 2] - p[3 * j + 2];
        if (dx * dx + dy * dy + dz * dz < 6.25) c++;
      }
      cnt[i] = c;
      const buried = c >= 20;
      if (this.hyd[i] >= 0.55) { th++; if (buried) bh++; } else if ("DEKRNQSTH".includes(this.seq[i])) { tp++; if (buried) bp++; }
    }
    this.neigh = cnt;
    M.Q = this.nTert ? qt / this.nTert : 0;
    M.helix = hn ? hs / hn : 0;
    M.burial = th ? bh / th : 0;
    M.polarBuried = tp ? bp / tp : 0;
    M.rg = rg;
    M.haem = this.hasHaem && this.nHaem ? qh / this.nHaem : 0;
    const rgNative = 0.52 * Math.pow(n, 0.38);    // compact globule size (model units)
    M.compact = rg < rgNative * 1.5;
    const harsh = this.harsh;
    M.state = n < 30 ? "short" : !this.nTert ? (M.compact && !harsh ? "misfolded" : "unfolded")
      : M.Q >= 0.6 ? "folded" : M.Q >= 0.3 ? "partial" : this.damaged && !harsh && M.compact ? "misfolded" : "unfolded";
  }

  /** Track heat / pH damage: unfolded too long under harsh conditions → can't refold on its own. */
  tickDamage(dt) {
    if (!this.n || this.mode === "primary" || this.mode === "secondary") return;
    const harsh = this.harsh;
    const M = this.metrics;
    if (!this.damaged) {
      this.stressT = harsh && M.Q < 0.3 ? this.stressT + dt : Math.max(0, this.stressT - dt);
      if (this.stressT > 3 && this.n >= 60 && this.nTert > 40) this.damaged = true;
    } else if (this.chaperone && !harsh) {
      this.refoldT += dt;
      if (this.refoldT > 2.5) { this.damaged = false; this.refoldT = 0; this.stressT = 0; }
    } else this.refoldT = 0;
  }
}

function rotateAll(p, N, w, x, y, z, cx, cy, cz) {
  // rotation matrix from quaternion (w,x,y,z)
  const m00 = 1 - 2 * (y * y + z * z), m01 = 2 * (x * y - w * z), m02 = 2 * (x * z + w * y);
  const m10 = 2 * (x * y + w * z), m11 = 1 - 2 * (x * x + z * z), m12 = 2 * (y * z - w * x);
  const m20 = 2 * (x * z - w * y), m21 = 2 * (y * z + w * x), m22 = 1 - 2 * (x * x + y * y);
  for (let i = 0; i < N; i++) {
    const a = p[3 * i] - cx, b = p[3 * i + 1] - cy, c = p[3 * i + 2] - cz;
    p[3 * i] = cx + m00 * a + m01 * b + m02 * c;
    p[3 * i + 1] = cy + m10 * a + m11 * b + m12 * c;
    p[3 * i + 2] = cz + m20 * a + m21 * b + m22 * c;
  }
}

/** Horn's method: quaternion of the rotation taking the current coordinates onto the reference. S = Σ a bᵀ. */
function hornQuat(S) {
  const [xx, xy, xz, yx, yy, yz, zx, zy, zz] = S;
  const Nm = [
    [xx + yy + zz, yz - zy, zx - xz, xy - yx],
    [yz - zy, xx - yy - zz, xy + yx, zx + xz],
    [zx - xz, xy + yx, -xx + yy - zz, yz + zy],
    [xy - yx, zx + xz, yz + zy, -xx - yy + zz],
  ];
  // Jacobi eigen-decomposition of the symmetric 4×4 matrix
  const a = Nm.map((r) => r.slice()), v = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
  for (let sweep = 0; sweep < 30; sweep++) {
    let off = 0;
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) off += a[i][j] * a[i][j];
    if (off < 1e-12) break;
    for (let pI = 0; pI < 4; pI++) for (let qI = pI + 1; qI < 4; qI++) {
      if (Math.abs(a[pI][qI]) < 1e-14) continue;
      const th = (a[qI][qI] - a[pI][pI]) / (2 * a[pI][qI]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 4; k++) { const akp = a[k][pI], akq = a[k][qI]; a[k][pI] = c * akp - s * akq; a[k][qI] = s * akp + c * akq; }
      for (let k = 0; k < 4; k++) { const apk = a[pI][k], aqk = a[qI][k]; a[pI][k] = c * apk - s * aqk; a[qI][k] = s * apk + c * aqk; }
      for (let k = 0; k < 4; k++) { const vkp = v[k][pI], vkq = v[k][qI]; v[k][pI] = c * vkp - s * vkq; v[k][qI] = s * vkp + c * vkq; }
    }
  }
  let best = 0;
  for (let i = 1; i < 4; i++) if (a[i][i] > a[best][best]) best = i;
  const q = [v[0][best], v[1][best], v[2][best], v[3][best]];
  const l = Math.hypot(...q);
  return l > 0 ? q.map((x) => x / l) : null;
}

// ---------- haemoglobin in red blood cells: O₂ binding and HbS polymerisation ----------
export { hill, P50_ADULT, HILL_N } from "../../../../sims/oxygen-transport/model.js";
/**
 * HbS polymer kinetics (qualitative). Only deoxygenated HbS polymerises; there is a delay (nucleation)
 * before fibres appear, then they grow quickly; re-oxygenation melts them.
 * state: { poly: 0..1, lag: s }  deoxyFrac: fraction of haem sites without O₂.
 */
export function polymerStep(st, dt, deoxyFrac, isHbS) {
  const drive = isHbS ? Math.max(0, (deoxyFrac - 0.35) / 0.65) : 0;
  if (drive > 0) {
    st.lag += dt * drive;
    if (st.lag > 2.5) st.poly = Math.min(drive, st.poly + dt * 0.18 * (0.15 + st.poly) * drive);
  } else st.lag = Math.max(0, st.lag - dt * 2);
  if (st.poly > drive) st.poly = Math.max(drive, st.poly - dt * 0.25);
  return st;
}
