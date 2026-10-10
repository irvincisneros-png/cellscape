// Epigenetics models (pure, no DOM, node-testable). Every random draw uses a seeded RNG so tests are repeatable.
//
// 1. MarkSim: a Dodd-Sneppen-inspired teaching model of histone-mark memory (after Dodd et al. 2007, Cell 129:813).
//    It is NOT the published model and is not fitted to data. N nucleosomes each hold one state: M (repressive, drawn as
//    H3K9me3 or H3K27me3, two alternative illustrative systems), U (unmarked) or A (active = histone ACETYLATION, e.g.
//    H3K27ac, written by HATs and removed by HDACs). H3K4me3 also marks active promoters but is not simulated, and the three
//    exclusive states leave out combinations such as bivalent chromatin. One update step:
//      pick a random nucleosome n1;
//      with probability alpha   -> RECRUITED conversion: pick a random other nucleosome n2 anywhere in the patch (recruitment is
//                                  global, not distance dependent); n2 pushes n1 ONE step toward n2's state
//                                  (M recruits A->U->M; A recruits M->U->A; U recruits nothing);
//      otherwise (1 - alpha)    -> NOISY conversion: n1 moves one step toward a randomly chosen state.
//    Feedback ratio F = alpha / (1 - alpha), so alpha = F / (1 + F); F = 0 means no recruitment. In this model strong feedback
//    (roughly F above 4) supports a persistent state when signals are roughly balanced. One "round" = N update steps.
//    Differences from the published model (all simplifications): our noisy step, the activator / repressor signals, the CpG
//    layer, the replication rule, N = 20 and the promoter window. Added for this site:
//      activator / repressor signal (0..1): each step, with probability 0.5*signal, one nucleosome in the promoter window is
//        pushed one step toward A (activator) or M (repressor), as transcription factors can recruit writers at the promoter;
//      HDAC inhibitor (vorinostat-like): an A -> U conversion is blocked;
//      DNA methylation layer: 8 CpG sites at the promoter. DNMT3 (de novo, optional) methylates each unmethylated site
//        with probability kDenovo * (repressive fraction of the promoter window) per round. TET removes a methylated site
//        with probability kTet (slow) per round. Methylated CpGs bias recruitment: when n1 is in the promoter window, with
//        probability BETA * (methylated fraction) the recruiter is treated as an M nucleosome;
//      REPLICATION (divide): each nucleosome is replaced by U with probability 0.5 (old histones are shared between the two
//        daughter strands); every methylated CpG becomes hemi-methylated (state 2). One DNMT1 maintenance attempt per division
//        then restores each hemi site to fully methylated with probability 0.95; a failed attempt leaves it hemi-methylated
//        (state 3). At the next replication a hemi site gives a hemi or an unmethylated daughter site with probability 0.5 each;
//      TRANSCRIPTION: txRate = smoothstep(0.3, 0.7, promoter-window fraction A) * (1 - 0.7 * CpG methylation). The same value
//        drives the narrative and the animation (TX_ON = clearly on, TX_MIN = occasional initiation).
//
// 2. X-inactivation: barrBodies(), and a Mosaic that grows clonal patches from random founder cells.
// 3. Environment examples: vernalisation (digital per-cell cold switching), agouti litters, temperature-sensitive pigment
//    (Himalayan), and twin methylation drift.

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export function mulberry32(a) {
  a = (a >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** standard normal from an rng (Box-Muller) */
export function gauss(rng) { const u = Math.max(1e-12, rng()), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// ---------------------------------------------------------------- 1. marks and memory
export const A = 1, U = 0, M = -1;
export const alphaOf = (F) => F / (1 + F);
export const BETA = 0.5;            // strength of the CpG-methylation bias on recruitment near the promoter
export const DNMT1_FIDELITY = 0.95; // per site, per division
export const N_CPG = 8;
export const TX_ON = 0.25, TX_MIN = 0.02;
const isInt = (v) => Number.isInteger(v);

export class MarkSim {
  constructor({ N = 20, F = 12, seed = 1, window = null, start = "M", kDenovo = 0.12, kTet = 0.01 } = {}) {
    if (!isInt(N) || N < 2) throw new RangeError("MarkSim: N must be an integer of at least 2");
    if (!(F >= 0) || !Number.isFinite(F)) throw new RangeError("MarkSim: F must be a finite number >= 0");
    if (window == null) { const w0 = Math.floor(N * 0.4); window = [w0, Math.min(N - 1, w0 + 3)]; }
    if (!Array.isArray(window) || window.length !== 2 || !isInt(window[0]) || !isInt(window[1]) || window[0] < 0 || window[1] > N - 1 || window[0] > window[1]) throw new RangeError("MarkSim: window must be [lo, hi] integers inside [0, N-1]");
    this.N = N; this.F = F; this.window = window; this.kDenovo = kDenovo; this.kTet = kTet;
    this.rng = mulberry32(seed);
    this.act = 0; this.rep = 0;       // signals 0..1
    this.hdaci = false; this.dnmt3 = false;
    this.events = [];                 // recent state changes for the 3D animation: { i, from, to, kind, src }
    this.reset(start);
  }

  reset(start = "M") {
    this.start = start;
    const v = start === "M" ? M : start === "A" ? A : U;
    this.s = new Int8Array(this.N).fill(v);
    this.cpg = new Uint8Array(N_CPG);     // 0 unmethylated, 1 methylated, 2 hemi (awaiting DNMT1), 3 hemi (maintenance failed)
    if (start === "M") this.cpg.fill(1);
    this.divs = 0; this.t = 0; this.streak = 0; this.maxStreak = 0; this.cleanDivs = 0; this.lowFDivs = 0; this.pendingClean = false; this.pendingLowF = false; this.pre = null; this.divT = -1;
    this._cnt = 0; this._frac = 0;
    this.history = []; this.marks = []; this.events.length = 0; this.sinceHist = 0;
    this.record();
  }

  get alpha() { return alphaOf(this.F); }
  get fracA() { let n = 0; for (const v of this.s) if (v === A) n++; return n / this.N; }
  get fracM() { let n = 0; for (const v of this.s) if (v === M) n++; return n / this.N; }
  get fracU() { return 1 - this.fracA - this.fracM; }
  get winSize() { return this.window[1] - this.window[0] + 1; }
  winFrac(state) { let n = 0; for (let i = this.window[0]; i <= this.window[1]; i++) if (this.s[i] === state) n++; return n / this.winSize; }
  /** promoter CpG methylation 0..1 (hemi-methylated sites count one half) */
  get cpgFrac() { let n = 0; for (const c of this.cpg) n += c === 1 ? 1 : c === 2 || c === 3 ? 0.5 : 0; return n / N_CPG; }
  get txRate() { return smooth(0.3, 0.7, this.winFrac(A)) * (1 - 0.7 * this.cpgFrac); }
  get txOn() { return this.txRate >= TX_ON; }
  /** "on" | "reduced" (occasional initiation) | "off" */
  get txState() { const r = this.txRate; return r >= TX_ON ? "on" : r > TX_MIN ? "reduced" : "off"; }
  /** how much of the pre-division pattern has come back (0..1), or null if there was no clear pattern */
  get recovery() { const p = this.pre; if (!p || p.regime === "mixed") return null; const now = p.regime === "M" ? this.fracM : this.fracA, was = p.regime === "M" ? p.M : p.A; return was > 0 ? clamp(now / was, 0, 1) : null; }
  get silent() { return this.txRate < 0.1 && this.fracM >= 0.5; }
  /** which regime? "memory-M", "memory-A" or "mixed" */
  get regime() { const a = this.fracA, m = this.fracM; return m >= 0.65 ? "M" : a >= 0.65 ? "A" : "mixed"; }

  push(i, dir, kind, src) {
    // dir +1 moves toward A, -1 toward M
    const from = this.s[i];
    const to = clamp(from + dir, M, A);
    if (to === from) return false;
    if (this.hdaci && from === A && to === U) return false;   // HDAC inhibited: acetyl marks cannot be removed
    this.s[i] = to;
    if (this.events.length < 60) this.events.push({ i, from, to, kind, src });
    return true;
  }

  /** one update step (one nucleosome) */
  stepOnce() {
    const { rng, N } = this;
    const [w0, w1] = this.window;
    // promoter signals recruit writers inside the promoter window
    const sig = this.act > 0 || this.rep > 0;
    if (sig) {
      if (this.act > 0 && rng() < 0.5 * this.act) this.push(w0 + Math.floor(rng() * this.winSize), +1, "signal", "act");
      if (this.rep > 0 && rng() < 0.5 * this.rep) this.push(w0 + Math.floor(rng() * this.winSize), -1, "signal", "rep");
    }
    const n1 = Math.floor(rng() * N);
    if (rng() < this.alpha) {
      let src = -1, st;
      if (n1 >= w0 && n1 <= w1 && rng() < BETA * this.cpgFrac) st = M;       // methylated CpGs recruit repressive machinery
      else { do { src = Math.floor(rng() * N); } while (src === n1); st = this.s[src]; }
      if (st === A) this.push(n1, +1, "recruit", src);
      else if (st === M) this.push(n1, -1, "recruit", src);
    } else {
      const target = Math.floor(rng() * 3) - 1;             // a random state
      if (target > this.s[n1]) this.push(n1, +1, "noise", -1);
      else if (target < this.s[n1]) this.push(n1, -1, "noise", -1);
    }
  }

  /** advance by `rounds` (fractional allowed; one round = N steps). The step counter persists across calls, so the CpG chemistry
   *  runs once per N steps however finely time is sliced. */
  step(rounds = 1) {
    if (this.pendingClean && (this.act >= 0.05 || this.rep >= 0.05)) this.pendingClean = false;      // a signal at any time during recovery spoils the clean division
    this._frac += rounds * this.N;
    const n = Math.floor(this._frac + 1e-9);
    this._frac = Math.max(0, this._frac - n);
    for (let k = 0; k < n; k++) {
      this.stepOnce();
      if (++this._cnt >= this.N) { this._cnt = 0; this.cpgRound(); }
    }
    this.t += rounds;
    this.sinceHist += rounds;
    if (this.sinceHist >= 0.5) { this.sinceHist = 0; this.record(); }
  }

  /** CpG chemistry, once per round */
  cpgRound() {
    const rng = this.rng;
    const rep = this.winFrac(M);
    for (let i = 0; i < N_CPG; i++) {
      const c = this.cpg[i];
      if (c === 2) { this.cpg[i] = rng() < DNMT1_FIDELITY ? 1 : 3; continue; }          // the one DNMT1 maintenance attempt; failure stays hemi
      if (c === 0 && this.dnmt3 && rng() < this.kDenovo * rep) this.cpg[i] = 1;
      else if (c === 1 && rng() < this.kTet) this.cpg[i] = 0;                            // TET: slow removal
    }
  }

  /** the cell divides (one daughter is followed) */
  divide() {
    const rng = this.rng, clean = this.act < 0.05 && this.rep < 0.05;
    this.pre = { M: this.fracM, A: this.fracA, regime: this.regime };
    this.pendingClean = clean; this.pendingLowF = this.F <= 1.5; this.divT = this.t;
    for (let i = 0; i < this.N; i++) if (rng() < 0.5) { if (this.s[i] !== U) this.events.push({ i, from: this.s[i], to: U, kind: "replication", src: -1 }); this.s[i] = U; }
    for (let i = 0; i < N_CPG; i++) {
      const c = this.cpg[i];
      if (c === 1) this.cpg[i] = 2;
      else if (c === 2 || c === 3) this.cpg[i] = rng() < 0.5 ? 2 : 0;
    }
    this.divs++;
    this.marks.push({ t: this.t, n: this.divs });
    this.record();
  }
  /** called by the level when a division has finished settling: counts silent divisions that had no signal helping */
  noteDivisionOutcome() {
    const clean = this.pendingClean; this.pendingClean = false;
    if (clean) { this.cleanDivs++; if (this.pendingLowF) this.lowFDivs++; }
    if (this.silent && clean) { this.streak++; this.maxStreak = Math.max(this.maxStreak, this.streak); } else this.streak = 0;
  }

  record() {
    this.history.push({ t: this.t, A: this.fracA, M: this.fracM, c: this.cpgFrac });
    if (this.history.length > 700) this.history.splice(0, this.history.length - 700);
  }
}

/** Run `divisions` divisions with `gap` rounds between them (for tests). Returns the final fraction M. */
export function runDivisions({ F, seed, N = 20, divisions = 5, gap = 25, start = "M" }) {
  const s = new MarkSim({ F, seed, N, start });
  for (let d = 0; d < divisions; d++) { s.step(gap); s.divide(); }
  s.step(gap);
  return s;
}

// ---------------------------------------------------------------- 2. X-inactivation
export const KARYOTYPES = {
  XX: { nX: 2, nY: 0, label: "XX", name: "typical female" },
  XY: { nX: 1, nY: 1, label: "XY", name: "typical male" },
  XXY: { nX: 2, nY: 1, label: "XXY", name: "Klinefelter syndrome" },
  X0: { nX: 1, nY: 0, label: "X0", name: "Turner syndrome" },
  XXX: { nX: 3, nY: 0, label: "XXX", name: "triple X" },
};
/** Barr bodies = number of X chromosomes - 1 (never below 0). */
export function barrBodies(karyotype) {
  const k = typeof karyotype === "string" ? (KARYOTYPES[karyotype] || { nX: (karyotype.match(/X/g) || []).length }) : karyotype;
  return Math.max(0, k.nX - 1);
}

/** Hex-grid cell sheet: cols x rows, returns cell centres with neighbour lists (pointy-top, odd rows offset). */
export function hexSheet(cols = 20, rows = 15) {
  if (!isInt(cols) || !isInt(rows) || cols < 1 || rows < 1) throw new RangeError("hexSheet: cols and rows must be positive integers");
  const cells = [], idx = (c, r) => (c < 0 || r < 0 || c >= cols || r >= rows ? -1 : r * cols + c);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const odd = r & 1;
    const nb = [idx(c - 1, r), idx(c + 1, r), idx(c - 1 + odd, r - 1), idx(c + odd, r - 1), idx(c - 1 + odd, r + 1), idx(c + odd, r + 1)].filter((i) => i >= 0);
    cells.push({ c, r, x: (c + 0.5 * odd - (cols - 0.5) / 2) * 1, y: -(r - (rows - 1) / 2) * 0.866, nb });
  }
  return cells;
}

/**
 * A clonal mosaic. Founders are random cells; each founder inactivates one X (inactive = 0 or 1) with
 * P(1) = skew. The sheet then fills by cell division: a random empty cell next to a filled one becomes its daughter and
 * inherits the same inactive X (epigenetic memory through division). The more founder cells (= the later the
 * inactivation), the smaller the patches.
 */
export class Mosaic {
  constructor({ cols = 20, rows = 15, founders = 16, skew = 0.5, seed = 1 } = {}) {
    if (!isInt(cols) || !isInt(rows) || cols < 1 || rows < 1) throw new RangeError("Mosaic: cols and rows must be positive integers");
    if (!isInt(founders) || founders < 1 || founders > cols * rows) throw new RangeError("Mosaic: founders must be an integer in [1, cols*rows]");
    if (!(skew >= 0 && skew <= 1)) throw new RangeError("Mosaic: skew must be between 0 and 1");
    this.rng = mulberry32(seed);
    this.cells = hexSheet(cols, rows);
    this.n = this.cells.length;
    this.founders = founders; this.skew = skew;
    this.state = new Int8Array(this.n).fill(-1);   // -1 not yet inactivated/assigned, 0 = X1 inactive, 1 = X2 inactive
    this.order = [];                               // assignment order, for animation
    const pool = [...Array(this.n).keys()];
    for (let i = 0; i < founders; i++) {
      const k = Math.floor(this.rng() * pool.length), c = pool.splice(k, 1)[0];
      this.state[c] = this.rng() < skew ? 1 : 0;
      this.order.push(c);
    }
    this.frontier = [];
    for (const c of this.order) this.addFrontier(c);
  }
  addFrontier(c) { for (const nb of this.cells[c].nb) if (this.state[nb] < 0) this.frontier.push([nb, c]); }
  get done() { return this.order.length >= this.n; }
  get filled() { return this.order.length; }
  /** one division event (a daughter fills a neighbouring empty spot); returns the cell index or -1 */
  divideOne() {
    while (this.frontier.length) {
      const k = Math.floor(this.rng() * this.frontier.length), [cell, parent] = this.frontier[k];
      this.frontier[k] = this.frontier[this.frontier.length - 1]; this.frontier.pop();
      if (this.state[cell] >= 0) continue;
      this.state[cell] = this.state[parent];
      this.order.push(cell); this.addFrontier(cell);
      return cell;
    }
    return -1;
  }
  run() { while (!this.done && this.divideOne() >= 0); return this; }
  /** patch statistics over the cells assigned so far. Reuses its buffers and returns the same object each call. */
  stats() {
    const n = this.n, seen = (this._seen ||= new Uint8Array(n)), st = (this._stk ||= new Int32Array(n)), out = (this._st ||= { patches: 0, meanSize: 0, largest: 0, frac0: 0, frac1: 0, c0: 0, c1: 0, total: 0 });
    seen.fill(0);
    let c0 = 0, c1 = 0, patches = 0, largest = 0;
    for (let i = 0; i < n; i++) {
      const s = this.state[i];
      if (s < 0) continue;
      if (s === 0) c0++; else c1++;
      if (seen[i]) continue;
      let size = 0, top = 0; st[top++] = i; seen[i] = 1;
      while (top) { const j = st[--top]; size++; const nb = this.cells[j].nb; for (let k = 0; k < nb.length; k++) { const q = nb[k]; if (!seen[q] && this.state[q] === s) { seen[q] = 1; st[top++] = q; } } }
      patches++; if (size > largest) largest = size;
    }
    const total = c0 + c1;
    out.patches = patches; out.meanSize = patches ? total / patches : 0; out.largest = largest; out.frac0 = total ? c0 / total : 0; out.frac1 = total ? c1 / total : 0; out.c0 = c0; out.c1 = c1; out.total = total;
    return out;
  }
}

// ---------------------------------------------------------------- 3a. vernalisation
export const VERN = { scale: 5.5, shape: 2.2, cells: 100, flowerFast: 8, flowerSlow: 22 };
/** Expected fraction of cells with FLC silenced after `weeks` of cold (Weibull of single-cell switching times). */
export function vernFraction(weeks) { return weeks <= 0 ? 0 : 1 - Math.exp(-Math.pow(weeks / VERN.scale, VERN.shape)); }
/** Each cell has its own random switching time (digital, independent: Angel et al. 2011). */
export function vernThresholds(n, seed) {
  const rng = mulberry32(seed), out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = VERN.scale * Math.pow(-Math.log(Math.max(1e-9, 1 - rng())), 1 / VERN.shape);
  return out;
}
export const vernOffFraction = (thr, weeks) => { let n = 0; for (const t of thr) if (t <= weeks) n++; return n / thr.length; };
/** weeks to flower after the cold: fewer FLC-silenced cells means a longer wait (teaching scale) */
export const flowerWeeks = (fOff) => VERN.flowerFast + (VERN.flowerSlow - VERN.flowerFast) * Math.pow(1 - fOff, 1.5);

// ---------------------------------------------------------------- 3b. agouti viable yellow
export const AGOUTI_CLASSES = [
  { id: "yellow", name: "yellow", color: "#e6b33c", max: 0.4 },
  { id: "ymottled", name: "yellow-mottled", color: "#c98f3a", max: 0.55 },
  { id: "bmottled", name: "brown-mottled", color: "#946236", max: 0.72 },
  { id: "pseudo", name: "brown (pseudoagouti)", color: "#5d3f27", max: 9 },
];
export const AGOUTI_SD = 0.16;
export const agoutiMean = (diet) => 0.32 + 0.34 * clamp(diet, 0, 1);   // teaching scale: diet 0 (none) .. 1 (full methyl-donor supplement)
export const agoutiClass = (m) => AGOUTI_CLASSES.findIndex((c) => m < c.max);
/** one litter: each pup's methylation level is drawn around the diet-dependent mean */
export function agoutiLitter(diet, rng, n = 8) {
  const mu = agoutiMean(diet), out = [];
  for (let i = 0; i < n; i++) { const m = clamp(mu + AGOUTI_SD * gauss(rng), 0.02, 0.98); out.push({ meth: m, cls: agoutiClass(m) }); }
  return out;
}
const erf = (x) => { const t = 1 / (1 + 0.3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
const cdf = (x, mu, sd) => 0.5 * (1 + erf((x - mu) / (sd * Math.SQRT2)));
/** expected share of each coat class at a diet level */
export function agoutiProbs(diet) {
  const mu = agoutiMean(diet), edges = [-Infinity, ...AGOUTI_CLASSES.slice(0, -1).map((c) => c.max), Infinity];
  return AGOUTI_CLASSES.map((c, i) => cdf(edges[i + 1], mu, AGOUTI_SD) - cdf(edges[i], mu, AGOUTI_SD));
}

// ---------------------------------------------------------------- 3c. Himalayan (temperature-sensitive tyrosinase)
export const TYR = { mid: 35, width: 0.8 };
/** relative enzyme activity at a local skin temperature (deg C): a sigmoid, active only where it is cool */
export const tyrActivity = (T) => 1 / (1 + Math.exp((T - TYR.mid) / TYR.width));
export const REGION_TEMP = { body: 36.8, head: 35.8, ear: 28, nose: 29, paw: 28.5, tail: 30 };
/** A top-down rabbit made of hex cells, each tagged with a body region (for the experiment bench). */
export function rabbitMap() {
  const sheet = hexSheet(25, 19), cells = [];
  const inE = (x, y, cx, cy, a, b, rot = 0) => { const c = Math.cos(rot), s = Math.sin(rot), dx = x - cx, dy = y - cy, u = dx * c + dy * s, v = -dx * s + dy * c; return (u * u) / (a * a) + (v * v) / (b * b) <= 1; };
  for (const c of sheet) {
    const x = c.x * 1.0 + 0.3, y = c.y * 1.0;
    let region = null;
    if (inE(x, y, -9.4, 3.9, 0.95, 3.1, -0.25) || inE(x, y, -7.5, 4.3, 0.95, 3.1, 0.25)) region = "ear";
    else if (inE(x, y, -10.6, 0.1, 1.5, 1.6)) region = x < -11.1 ? "nose" : "head";
    else if (inE(x, y, -8.6, 0, 2.7, 2.9)) region = "head";
    else if (inE(x, y, -1.2, 0, 6.6, 4.3)) region = "body";
    else if (inE(x, y, -5.2, -3.9, 1.8, 1.1, 0.5) || inE(x, y, -5.2, 3.9, 1.8, 1.1, -0.5) || inE(x, y, 3.2, -4.4, 2.1, 1.2, -0.2) || inE(x, y, 3.2, 4.4, 2.1, 1.2, 0.2)) region = "paw";
    else if (inE(x, y, 6.4, 0, 1.3, 1.2)) region = "tail";
    if (region) cells.push({ x, y, region, temp: REGION_TEMP[region] });
  }
  return cells;
}
/** fur colour (0 white .. 1 dark) for a hair grown at local temperature T */
export const furDark = (T) => tyrActivity(T);

// ---------------------------------------------------------------- 3d. twins drift apart
export const TWIN = { sites: 60, r0: 0.0004, envK: 2 };
export const twinRate = (env) => TWIN.r0 * (1 + TWIN.envK * clamp(env, 0, 1));
/** expected fraction of sites that differ between two twins at `age` years (independent toggling at rate p per year) */
export function twinExpected(age, env) { const p = twinRate(env); return 0.5 * (1 - Math.pow(1 - 2 * p, 2 * age)); }
/** a fixed random draw for each (twin, site, year); the slider replays it with a different rate */
export function twinDraws(seed, sites = TWIN.sites, years = 90) {
  const rng = mulberry32(seed), d = new Float32Array(2 * sites * years);
  for (let i = 0; i < d.length; i++) d[i] = rng();
  return { d, sites, years };
}
/** methylation patterns at `age` for both twins: Uint8Array pairs. They start identical (the same set of baseline sites). */
export function twinPatterns(draws, age, env, base = null) {
  const { d, sites, years } = draws, p = twinRate(env);
  const a = new Uint8Array(sites), b = new Uint8Array(sites);
  for (let s = 0; s < sites; s++) { const v = base ? base[s] : (s * 7 + 3) % 5 < 2 ? 1 : 0; a[s] = v; b[s] = v; }
  for (let y = 0; y < Math.min(age, years); y++) for (let s = 0; s < sites; s++) {
    if (d[(0 * sites + s) * years + y] < p) a[s] ^= 1;
    if (d[(1 * sites + s) * years + y] < p) b[s] ^= 1;
  }
  let diff = 0; for (let s = 0; s < sites; s++) if (a[s] !== b[s]) diff++;
  return { a, b, diff, frac: diff / sites };
}
