// CellScape · Cell division (mitosis) — the model. No DOM, no THREE: testable with node.
//
// Part 1 is the reviewed 2D sim's timeline and karyotype (used by sim2d.js).
// Part 2 is MitosisModel, used by the 3D level: the same phase timeline, but every transition is
// GATED by the cell's own machinery, so changing one part has knock-on effects:
//
//   ATP ──▶ everything (replication, motors, microtubule growth, kinases). No ATP → the cycle stalls.
//   G2 checkpoint:  DNA damage ─▶ (ATM/ATR → Chk1) ─▶ Cdc25 blocked ─▶ cyclin B–CDK1 stays OFF ─▶ no mitosis
//   cyclin B–CDK1 (MPF) ON ─▶ condensation, nuclear envelope breakdown, spindle assembly
//   Spindle assembly checkpoint (SAC): any kinetochore that is unattached (or not under tension)
//        ─▶ "wait" signal (Mad2/MCC) ─▶ APC/C off ─▶ securin protects separase's target ─▶ cohesin holds the sisters
//   all kinetochores bi-oriented under tension ─▶ APC/C–Cdc20 ON ─▶ securin + cyclin B destroyed
//        ─▶ separase cuts cohesin ─▶ anaphase ─▶ cyclin B gone ─▶ mitotic exit (nuclei re-form, cytokinesis)
//   Colchicine: no microtubules ─▶ no attachments ─▶ SAC holds; prolonged arrest ─▶ "slippage" into one
//        restitution nucleus with 8 chromosomes (4n): how colchicine doubles chromosome numbers in plant breeding.
//   Taxol: microtubules can't shrink ─▶ no tension ─▶ SAC holds (arrest).
//   Separase-resistant cohesin on chromosome 1 ─▶ its sisters can't part ─▶ both go to one pole ─▶ 2n+1 / 2n−1.
//   Non-degradable cyclin B ─▶ sisters separate but the cell can't exit mitosis.
// Distances in the 3D part are micrometres (µm). Timeline seconds are "sim seconds" (a real cycle ≈ 1 day).

// ================================================================ Part 1: shared 2D timeline + karyotype
export const PH = [
  { key: "G1", name: "Interphase · G1", short: "G1", dur: 4 },
  { key: "S", name: "Interphase · S phase", short: "S", dur: 5 },
  { key: "G2", name: "Interphase · G2", short: "G2", dur: 3 },
  { key: "pro", name: "Prophase", short: "Pro", dur: 5 },
  { key: "prometa", name: "Prometaphase", short: "PM", dur: 6 },
  { key: "meta", name: "Metaphase", short: "Meta", dur: 4 },
  { key: "ana", name: "Anaphase", short: "Ana", dur: 4 },
  { key: "telo", name: "Telophase", short: "Telo", dur: 5 },
  { key: "cyto", name: "Cytokinesis", short: "Cyto", dur: 5 },
  { key: "done", name: "Daughter cells (G1)", short: "G1", dur: 3, label: "G1" },
];
{ let acc = 0; for (const p of PH) { p.start = acc; acc += p.dur; p.end = acc; } }
export const TOTAL = PH.at(-1).end;
export const I = Object.fromEntries(PH.map((p, i) => [p.key, i]));
export const phaseAt = (T) => { for (let i = PH.length - 1; i >= 0; i--) if (T >= PH[i].start) return i; return 0; };
export const GATE_PM = PH[I.prometa].start + 0.5 * PH[I.prometa].dur; // DIY: chromosomes become draggable
export const GATE_META = PH[I.meta].start + 0.5 * PH[I.meta].dur;     // 2D DIY: wait for the learner to pull

// 2D karyotype (2n = 4). Pair 1 = long, metacentric. Pair 2 = short, submetacentric. Pink = maternal, blue = paternal.
export const PINK = "#f472b6", BLUE = "#60a5fa";
export const CHR = [
  { pair: 1, mat: true, len: 0.26, cpos: 0.5, col: PINK, home: [-0.17, -0.1], hAng: 0.6, scat: [-0.44, -0.34], sAng: 2.2, tilt: 0.08, seed: 1.3 },
  { pair: 1, mat: false, len: 0.26, cpos: 0.5, col: BLUE, home: [0.14, 0.12], hAng: 2.4, scat: [0.38, 0.3], sAng: 0.9, tilt: -0.06, seed: 4.1 },
  { pair: 2, mat: true, len: 0.16, cpos: 0.33, col: PINK, home: [0.13, -0.17], hAng: -0.5, scat: [0.42, -0.36], sAng: -1.0, tilt: 0.1, seed: 7.7 },
  { pair: 2, mat: false, len: 0.16, cpos: 0.33, col: BLUE, home: [-0.13, 0.17], hAng: 1.9, scat: [-0.36, 0.4], sAng: 0.3, tilt: -0.1, seed: 2.9 },
];
export const SLOT_Y = [-0.42, -0.14, 0.14, 0.42];
export const WATCH_SLOT = [0, 2, 1, 3];
export const ND_CHR = 0;                          // chromosome whose sisters fail to separate (nondisjunction)
export const HAPLOID = CHR[0].len + CHR[2].len;   // DNA of one set = 1C
export const RN = 0.46, RN2 = 0.34, RD = 0.75;    // 2D: parent nucleus, daughter nucleus, daughter cell radii

/** DNA content per cell (units of C) at timeline position T (normal cycle). */
export function dnaAt(T) {
  const k = phaseAt(T), p = Math.max(0, Math.min(1, (T - PH[k].start) / PH[k].dur));
  if (k < I.S) return 2;
  if (k === I.S) return 2 + 2 * p;
  if (k < I.done) return 4;
  return 2;
}

// ================================================================ Part 2: the 3D model
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const lerp3 = (a, b, t, out = [0, 0, 0]) => { out[0] = lerp(a[0], b[0], t); out[1] = lerp(a[1], b[1], t); out[2] = lerp(a[2], b[2], t); return out; };

export const NUC_R = 5.2;      // parent nucleus radius (µm)
export const NUC_R2 = 3.6;     // daughter nucleus radius
export const PLANT = { hx: 13, hy: 10, hz: 10, dNuc: 6.5, poleMeta: 8, poleAna: 9.6 };   // a meristem cell, 26 × 20 × 20 µm
export const ANIMAL = { R: 11, poleMeta: 8, poleAna: 10.6 };
export const CHR_R = 0.36;     // condensed chromatid radius (≈ 0.7 µm thick)
export const FIBRE_R = 0.07;   // interphase chromatin, drawn thick enough to see

// metaphase plate slots: a rosette of 4 in the plate (the y–z plane)
export const SLOTS = [60, 150, 240, 330].map((deg, j) => {
  const t = (deg * Math.PI) / 180, R = 3.0;
  const r = [0, Math.cos(t), Math.sin(t)], tg = [0, -Math.sin(t), Math.cos(t)];
  const ph = j % 2 ? 0.75 : 0.55;              // arms lie in the plate, tangential and partly outward
  return { c: [0, R * Math.cos(t), R * Math.sin(t)], a: norm([0.06 * (j - 1.5), tg[1] * Math.cos(ph) + r[1] * Math.sin(ph), tg[2] * Math.cos(ph) + r[2] * Math.sin(ph)]) };
});

// the 3D karyotype: same 2n = 4 as the 2D sim, lengths in µm
export const CHR3 = [
  { pair: 1, mat: true, len: 5.0, cpos: 0.5, col: PINK, home: [-1.5, 1.0, 0.7], hDir: norm([0.5, 0.8, 0.3]), scat: [-3.4, 2.4, 1.6], slot: 0, seed: 1.3 },
  { pair: 1, mat: false, len: 5.0, cpos: 0.5, col: BLUE, home: [1.3, -0.9, -0.8], hDir: norm([-0.3, 0.7, 0.6]), scat: [3.2, -2.0, -2.0], slot: 2, seed: 4.1 },
  { pair: 2, mat: true, len: 3.0, cpos: 0.33, col: PINK, home: [1.2, 1.5, 1.3], hDir: norm([0.8, -0.2, 0.5]), scat: [2.8, 3.0, -1.0], slot: 1, seed: 7.7 },
  { pair: 2, mat: false, len: 3.0, cpos: 0.33, col: BLUE, home: [-1.2, -1.4, -1.1], hDir: norm([0.2, 0.6, -0.8]), scat: [-3.0, -2.6, 1.8], slot: 3, seed: 2.9 },
];
for (const c of CHR3) {
  // a direction perpendicular to the arm axis: the sisters sit side by side along it
  const ref = Math.abs(c.hDir[0]) < 0.8 ? [1, 0, 0] : [0, 1, 0];
  const d = c.hDir, x = [d[1] * ref[2] - d[2] * ref[1], d[2] * ref[0] - d[0] * ref[2], d[0] * ref[1] - d[1] * ref[0]];
  c.hN = norm(x);
}
export const ORIGINS = 4;                        // replication origins per chromosome (real ones: thousands)

export class MitosisModel {
  constructor() {
    this.cellType = "plant";   // "plant" | "animal"
    this.mode = "watch";       // "watch" | "diy"
    this.speed = 1;
    // experiments (persist across Reset)
    this.colchicine = false;
    this.taxol = false;
    this.cohesinMut = false;   // separase can't cut chromosome 1's cohesin
    this.cyclinKO = "none";    // "none" | "noB" (no cyclin B) | "stable" (non-degradable cyclin B)
    this.cpOff = false;        // checkpoints knocked out (as in many cancers)
    this.blockATP = false;
    this.atp = 70;             // supplied each step (from the plant cell if there is one)
    this.ach = {};             // achievements for missions (persist)
    this.reset();
  }

  reset() {
    this.T = 0;
    this.rep = [0, 0, 0, 0]; this.repOn = [false, false, false, false];
    this.det = [[0, 0], [0, 0], [0, 0], [0, 0]];       // >0: kinetochore detached (seconds until recapture; Infinity = until re-placed)
    this.att = [[0, 0], [0, 0], [0, 0], [0, 0]];       // attachment level 0..1 (animated)
    this.off = [0, 0, 0, 0];                            // drift off the plate along the spindle axis (µm)
    this.diy = {
      pos: CHR3.map((c) => [...c.scat]), slot: [-1, -1, -1, -1], occ: [-1, -1, -1, -1],
      triggered: false, sep: 0, cyto: 0, hold: false, drag: -1,
    };
    this.damage = 0; this.carriedDamage = false;
    this.restit = false; this.arrest = 0;
    this.dest = null;           // per chromosome [side of sister 0, side of sister 1] once anaphase starts
    this.gate = null; this.sacKey = "none"; this.stalled = false;
    this.wasHeld = {};          // gates hit this run
    this.splitAt = null;        // outcome snapshot at division
    this.cohesinCutT = -1;
  }

  // ---------- derived ----------
  get k() { return phaseAt(this.T); }
  get key() { return PH[this.k].key; }
  get p() { const ph = PH[this.k]; return clamp((this.T - ph.start) / ph.dur, 0, 1); }
  get mtsOK() { return !this.colchicine; }
  get atpF() { return this.blockATP ? 0 : clamp((this.atp - 3) / 15, 0, 1); }
  get allRep() { return this.rep.every((r) => r >= 1); }
  get meanRep() { return this.rep.reduce((a, b) => a + b, 0) / 4; }
  get nAligned() { return this.diy.slot.filter((s) => s >= 0).length; }
  attached(i, s) { return this.att[i][s] > 0.95; }
  nAttachedKT() { let n = 0; for (let i = 0; i < 4; i++) for (let s = 0; s < 2; s++) if (this.attached(i, s)) n++; return n; }
  tension(i) { return this.attached(i, 0) && this.attached(i, 1) && !this.taxol && Math.abs(this.off[i]) < 0.35; }
  get kinetochoresUp() { const k = this.k; return k > I.pro || (k === I.pro && this.p > 0.7); }
  get sacOK() { for (let i = 0; i < 4; i++) if (!this.tension(i)) return false; return true; }
  /** what the spindle checkpoint is waiting on (for text) */
  sacReason() {
    if (this.colchicine) return "colchicine";
    if (this.taxol) return "taxol";
    return this.sacOK ? "none" : "unattached";
  }
  unattachedList() {
    const out = [];
    for (let i = 0; i < 4; i++) for (let s = 0; s < 2; s++) if (!this.attached(i, s)) out.push([i, s]);
    return out;
  }
  /** true while the cell sits at a gate it cannot pass */
  get held() { return !!this.gate; }

  // cyclin B, CDK1 activity and APC/C activity at timeline position T (with the current knockouts)
  cyclinB(T = this.T) {
    if (this.cyclinKO === "noB") return 0;
    const k = phaseAt(T), p = clamp((T - PH[k].start) / PH[k].dur, 0, 1);
    if (k === I.G1) return 0.04;
    if (k === I.S) return 0.04 + 0.2 * p;
    if (k === I.G2) return 0.24 + 0.46 * p;
    if (k === I.pro) return 0.7 + 0.25 * p;
    if (k === I.prometa || k === I.meta) return 0.95 + 0.05 * Math.min(1, p * 2);
    if (this.cyclinKO === "stable") return 1;
    if (k === I.ana) return Math.max(0.05, 1 - (0.95 * p) / 0.3);
    return 0.05;
  }
  cdk1(T = this.T) {
    const k = phaseAt(T), p = clamp((T - PH[k].start) / PH[k].dur, 0, 1);
    let act = 0.08;                                          // inhibitory phosphorylation (Wee1) keeps it off
    if (k === I.G2) act = p < 0.8 ? 0.08 : lerp(0.08, 1, (p - 0.8) / 0.2);   // Cdc25 flips the switch
    else if (k > I.G2 && k < I.done) act = 1;
    return this.cyclinB(T) * act;
  }
  apc(T = this.T) {
    const k = phaseAt(T);
    if (k === I.G1) return 0.8;                               // APC/C–Cdh1 keeps cyclins low in G1
    if (k >= I.ana) return 1;                                 // APC/C–Cdc20 switched on by a satisfied SAC
    return 0;
  }
  dnaC(T = this.T) {
    const k = phaseAt(T);
    if (k === I.S) return 2 + 2 * (this.mode === "diy" ? this.meanRep : clamp((T - PH[I.S].start) / PH[I.S].dur, 0, 1));
    if (k < I.S) return 2;
    if (k < I.done || this.restit) return 4;
    return 2;
  }

  // ---------- learner actions ----------
  replicate(i) {
    if (this.k !== I.S || this.repOn[i]) return false;
    this.repOn[i] = true; return true;
  }
  /** Tap a kinetochore: knock its microtubules off. */
  detach(i, s) {
    if (!this.kinetochoresUp || this.k > I.meta || this.dest) return false;
    if (!this.attached(i, s)) return false;
    this.det[i][s] = this.mode === "diy" ? Infinity : 5;
    this.att[i][s] = 0;
    if (this.mode === "diy" && this.diy.slot[i] >= 0) { this.diy.occ[this.diy.slot[i]] = -1; this.diy.slot[i] = -1; this.diy.pos[i] = this.centreOf(i); }
    this.ach.detached = true;
    return true;
  }
  /** DIY: drop chromosome i at position p (µm). Snaps to the plate if close. Returns slot or -1. */
  drop(i, p) {
    const d = this.diy;
    d.pos[i] = [...p];
    if (Math.abs(p[0]) > 1.8) return -1;
    if (!this.mtsOK) return -2;                    // no spindle fibres to hold it there
    let best = -1, bd = 1e9;
    SLOTS.forEach((sl, j) => {
      if (d.occ[j] >= 0) return;
      const dd = Math.hypot(sl.c[1] - p[1], sl.c[2] - p[2]);
      if (dd < bd) { bd = dd; best = j; }
    });
    if (best < 0) return -1;
    d.slot[i] = best; d.occ[best] = i;
    this.det[i] = [0, 0];
    return best;
  }
  unslot(i) { const d = this.diy; if (d.slot[i] >= 0) { d.occ[d.slot[i]] = -1; d.slot[i] = -1; } }
  /** DIY: press "start anaphase". Returns "ok" or why not. */
  trigger() {
    if (this.mode !== "diy") return "watch";
    if (this.k < I.prometa || (this.k === I.prometa && this.T < GATE_PM - 1e-6)) return "early";
    if (this.diy.triggered) return "ok";
    if (!this.cpOff && !this.sacOK) { this.ach.sacBlocked = true; this.wasHeld.sac = true; this.sacKey = this.sacReason(); return "sac"; }
    this.diy.triggered = true;
    if (this.colchicine) { this.startRestitution(); return "ok"; }
    if (this.T < PH[I.ana].start) this.T = PH[I.ana].start;
    this.beginAnaphase();
    return "ok";
  }
  addDamage() {
    if (this.k > I.G2 || (this.k === I.G2 && this.p > 0.8 && !this.gate)) return false;
    this.damage = 1; return true;
  }
  /** Scrub (Watch mode): jump to T and settle all fast state to what it would be. */
  scrub(T) {
    this.T = clamp(T, 0, TOTAL);
    this.det = [[0, 0], [0, 0], [0, 0], [0, 0]];
    this.arrest = 0; this.gate = null;
    this.splitAt = null;
    this.dest = null; this.restit = false;
    if (this.T < PH[I.ana].start) this.cohesinCutT = -1;
    if (this.T >= PH[I.G2].end) this.damage = 0;
    const k = this.k;
    for (let i = 0; i < 4; i++) {
      this.rep[i] = k > I.S ? 1 : k < I.S ? 0 : clamp((this.p - 0.06 - i * 0.12) / 0.52, 0, 1);
      for (let s = 0; s < 2; s++) this.att[i][s] = k >= I.ana && k < I.telo && this.mtsOK && !this.restit ? 1 : this.attTarget(i, s);
      this.off[i] = 0;
    }
    if (this.T >= PH[I.ana].start && !this.dest) this.beginAnaphase(this.mtsOK);
  }

  // ---------- attachment targets ----------
  attTarget(i, s) {
    if (!this.mtsOK || this.restit) return 0;
    const k = this.k, p = this.p;
    if (!this.kinetochoresUp || k >= I.telo) return 0;
    if (this.det[i][s] > 0) return 0;
    if (k >= I.ana) return this.att[i][s] > 0.5 || this.dest ? 1 : 0;
    if (this.mode === "diy") return this.diy.slot[i] >= 0 ? 1 : 0;
    if (k === I.pro) return 0;
    if (k === I.prometa) {
      const thr = s === 0 ? 0.12 + 0.07 * i : 0.3 + 0.07 * i;    // one kinetochore is captured first, then its sister
      return clamp((p - thr) / 0.08, 0, 1);
    }
    return 1;
  }

  beginAnaphase(assumeAttached = false) {
    if (this.dest) return;
    this.dest = CHR3.map((c, i) => {
      if (this.restit) return [0, 0];
      if (this.cohesinMut && i === ND_CHR) return [-1, -1];
      const a0 = assumeAttached || this.att[i][0] > 0.5, a1 = assumeAttached || this.att[i][1] > 0.5;
      if (a0 && a1) return [-1, 1];
      if (a0) return [-1, -1];
      if (a1) return [1, 1];
      return [-1, -1];
    });
  }

  /** outcome counts per daughter: { left, right, copies: [[l,r] per chromosome], aneuploid, single } */
  outcome() {
    if (this.restit) return { single: true, total: 8 };
    const dest = this.dest || CHR3.map(() => [-1, 1]);
    let left = 0, right = 0;
    const copies = dest.map(([a, b]) => {
      const l = (a < 0) + (b < 0), r = (a > 0) + (b > 0);
      left += l; right += r; return [l, r];
    });
    return { left, right, copies, aneuploid: left !== 4 || right !== 4, single: false };
  }

  // ---------- simulation step ----------
  /** dt in sim seconds. Returns nothing; read .gate / .stalled / pose(). */
  step(dt) {
    if (dt <= 0) return;
    const F = this.atpF;
    this.stalled = F < 0.05 && this.k < I.done;
    const k0 = this.k;
    // repair needs ATP; damage is only repaired in interphase in this model
    if (this.damage > 0 && k0 <= I.G2) this.damage = Math.max(0, this.damage - dt * 0.09 * F);
    // replication forks (DIY)
    for (let i = 0; i < 4; i++) if (this.repOn[i] && this.rep[i] < 1) this.rep[i] = Math.min(1, this.rep[i] + (dt * F) / 1.8);
    if (this.mode === "watch") {
      if (k0 === I.S) { const p = this.p; for (let i = 0; i < 4; i++) this.rep[i] = clamp((p - 0.06 - i * 0.12) / 0.52, 0, 1); }
      else if (k0 > I.S) this.rep.fill(1);
      else this.rep.fill(0);
    }
    // recapture of detached kinetochores (error correction): needs microtubules
    for (let i = 0; i < 4; i++) for (let s = 0; s < 2; s++) {
      if (this.det[i][s] > 0 && this.det[i][s] !== Infinity && this.mtsOK) this.det[i][s] = Math.max(0, this.det[i][s] - dt * F);
    }
    // attachments relax toward their targets; drift toward the attached pole if mono-oriented
    for (let i = 0; i < 4; i++) {
      for (let s = 0; s < 2; s++) {
        const tg = this.attTarget(i, s), a = this.att[i][s];
        this.att[i][s] = tg > a ? Math.min(tg, a + dt * 2.2 * Math.max(0.2, F)) : Math.max(tg, a - dt * 4);
      }
      const a0 = this.att[i][0] > 0.95, a1 = this.att[i][1] > 0.95;
      const onPlate = this.k >= I.prometa && this.k <= I.meta;
      const tgt = !onPlate ? 0 : a0 && !a1 ? -2.6 : a1 && !a0 ? 2.6 : a0 && a1 ? 0 : this.off[i];
      this.off[i] += clamp(tgt - this.off[i], -dt * 1.1 * F, dt * 1.1 * F);
    }

    // advance the timeline
    let T1 = this.T + dt * F * this.speed;
    let gate = null;
    const hold = (lim, why) => { if (T1 > lim && this.T <= lim + 1e-6) { T1 = Math.min(T1, Math.max(this.T, lim - 1e-4)); gate = why; this.wasHeld[why] = true; } };
    const diy = this.mode === "diy" ? this.diy : null;

    if (diy) {
      const S = PH[I.S];
      if (this.T < S.end && T1 > S.start && !this.allRep) { T1 = Math.max(this.T, Math.min(T1, S.start + 1e-4 + 0.998 * S.dur * this.meanRep)); gate = "rep"; }
    }
    // G2 checkpoint: cyclin B–CDK1 can't switch on with damaged DNA (or without cyclin B)
    const g2 = PH[I.G2].start + 0.8 * PH[I.G2].dur;
    if (this.cyclinKO === "noB") hold(g2, "noCyclin");
    else if (this.damage > 0.02 && !this.cpOff) hold(g2, "damage");
    else if (this.damage > 0.02 && this.cpOff && T1 > g2 && this.T <= g2) this.carriedDamage = true;

    // spindle assembly checkpoint (metaphase → anaphase)
    const metaEnd = PH[I.meta].end;
    if (!this.restit && !this.dest && !gate) {
      if (diy) {
        if (T1 > GATE_PM && !diy.triggered) {
          if (this.nAligned < 4) { T1 = Math.max(this.T, Math.min(T1, GATE_PM + PH[I.prometa].dur * 0.49 * (this.nAligned / 4))); gate = "align"; }
          else if (T1 > metaEnd - 1e-3) { T1 = Math.max(this.T, metaEnd - 1e-3); gate = "trigger"; }
        }
      } else if (T1 > metaEnd - 1e-3 && this.T <= metaEnd && !this.sacOK) {
        if (!this.cpOff) { T1 = Math.max(this.T, metaEnd - 1e-3); gate = "sac"; this.wasHeld.sac = true; }
        else if (this.colchicine) this.startRestitution();
      }
      const waiting = gate === "sac" || ((gate === "align" || gate === "trigger") && !this.sacOK);
      if (waiting) {
        this.sacKey = this.sacReason();
        if (this.colchicine && !this.cpOff) {
          this.arrest += dt * F;
          if (this.arrest > 12) { this.startRestitution(); gate = null; T1 = Math.max(T1, PH[I.ana].start); }
        }
      } else this.arrest = 0;
    }

    if (this.restit && T1 < PH[I.ana].start) T1 = PH[I.ana].start;

    // anaphase in DIY: separase runs on its own, then the learner pulls
    const an = PH[I.ana];
    if (T1 >= an.start && !this.dest) this.beginAnaphase();
    if (diy && !this.restit && T1 > an.start + 0.12 * an.dur && this.T < an.end) {
      if (diy.hold) diy.sep = Math.min(1, diy.sep + dt * 0.4 * F);
      const lim = an.start + 0.12 * an.dur + 0.88 * an.dur * diy.sep;
      if (diy.sep < 1) { T1 = Math.max(this.T, Math.min(T1, lim)); gate = gate || "pull"; }
    }
    // mitotic exit needs cyclin B destroyed
    if (this.cyclinKO === "stable") hold(an.end - 1e-3, "exitBlocked");
    // cytokinesis in DIY
    const cy = PH[I.cyto];
    if (diy && !this.restit && T1 > cy.start && this.T < cy.end && this.cyclinKO !== "stable") {
      if (diy.hold) diy.cyto = Math.min(1, diy.cyto + dt * 0.3 * F);
      if (diy.cyto < 1) { T1 = Math.max(this.T, Math.min(T1, cy.start + cy.dur * 0.999 * diy.cyto)); gate = gate || (this.cellType === "plant" ? "plate" : "pinch"); }
    }
    if (F < 0.05 && this.k < I.done) gate = gate || "atp";

    this.T = Math.min(TOTAL, T1);
    this.gate = gate;
    if (this.T >= an.start + 0.12 * an.dur && this.cohesinCutT < 0) this.cohesinCutT = this.T;
    if (this.k === I.done && !this.splitAt) {
      const o = this.outcome();
      this.splitAt = { ...o, cell: this.cellType, damage: this.carriedDamage };
      this.ach.divided = true;
      if (this.restit) this.ach.tetraploid = true;
      else {
        this.ach[this.cellType === "plant" ? "dividedPlant" : "dividedAnimal"] = true;
        if (this.mode === "diy" && !o.aneuploid) this.ach.diyIdentical = true;
        if (o.aneuploid) this.ach.aneuploid = true;
        if (this.cohesinMut && o.aneuploid) this.ach.ndDivided = true;
        if (this.cpOff && o.aneuploid) this.ach.cpOffAneuploid = true;
      }
    }
    if (gate === "damage") this.ach.g2Held = true;
    if (gate === "noCyclin") this.ach.noCyclin = true;
    if (gate === "exitBlocked") this.ach.exitBlocked = true;
    if (gate === "sac" || ((gate === "align" || gate === "trigger") && this.ach.detached && !this.sacOK)) {
      if (this.sacKey === "unattached" && this.ach.detached) this.ach.sacHeld = true;
      if (this.sacKey === "colchicine") this.ach.colchArrest = true;
      if (this.sacKey === "taxol") this.ach.taxolArrest = true;
    }
    if (gate === "atp") this.ach.atpStall = true;
    if (this.mode === "diy" && this.allRep) this.ach.diyRep = true;
    if (this.mode === "diy" && this.nAligned === 4) this.ach.diyAligned = true;
  }

  startRestitution() {
    if (this.restit) return;
    this.restit = true;
    this.arrest = 0;
    if (this.T < PH[I.ana].start) this.T = PH[I.ana].start;
    this.dest = null; this.beginAnaphase();
  }

  /** centre of chromosome i right now (µm), for drag starts */
  centreOf(i) { const o = this.pose(); return [...o.chr[i].c]; }

  // ---------- pose: everything the 3D scene needs, derived from T + state ----------
  pose() {
    const o = this._o || (this._o = {
      chr: CHR3.map(() => ({ c: [0, 0, 0], a: [0, 1, 0], n: [1, 0, 0], tangleW: 1, gap: 0.42, tension: false, rep: 0, sis: [0, 1].map(() => ({ K: [0, 0, 0], kn: [1, 0, 0], tc: [0, 0, 0], tScale: 1, trail: [1, 0, 0], bend: 0, dest: 0, move: 0 })), joined: false, cohesin: 0, cohesinArm: 0, cut: false })),
      poles: [[-8, 0, 0], [8, 0, 0]], cs: [[-8, 0, 0], [8, 0, 0]],
    });
    const k = this.k, p = this.p, T = this.T, plant = this.cellType === "plant", diy = this.mode === "diy";
    o.k = k; o.p = p; o.key = PH[k].key; o.T = T; o.plant = plant; o.restit = this.restit;
    o.cond = k < I.pro ? (k === I.G2 ? 0.05 * p : 0) : k === I.pro ? ease(p) : k < I.telo ? 1 : k === I.telo ? (this.cyclinKO === "stable" ? 1 : 1 - ease(clamp(p / 0.85, 0, 1))) : (this.cyclinKO === "stable" ? 1 : 0);
    o.env = k < I.prometa ? 1 : k === I.prometa ? 1 - clamp(p / 0.3, 0, 1) : 0;
    o.nucleolus = k < I.pro ? 1 : k === I.pro ? 1 - clamp(p / 0.6, 0, 1) : 0;
    const exitOK = this.cyclinKO !== "stable";
    o.ref = !exitOK ? 0 : k < I.telo ? 0 : k === I.telo ? clamp((p - 0.25) / 0.65, 0, 1) : 1;
    o.nucleolus2 = !exitOK ? 0 : k < I.telo ? 0 : k === I.telo ? clamp((p - 0.6) / 0.4, 0, 1) : 1;
    o.dup = k < I.S ? 0 : k === I.S ? ease(clamp((p - 0.3) / 0.5, 0, 1)) : 1;     // centrosome duplication (animal)
    o.mig = k < I.pro ? 0 : k === I.pro ? ease(clamp(p / 0.85, 0, 1)) : 1;
    const mt = this.mtsOK ? 1 : 0;
    o.sg = mt * (k < I.pro ? 0 : k === I.pro ? clamp((p - 0.25) / 0.75, 0, 1) : k < I.telo ? 1 : k === I.telo ? 1 - clamp(p / 0.8, 0, 1) : 0);
    if (this.restit) o.sg = 0;
    o.kmt = k < I.telo ? 1 : k === I.telo ? 1 - clamp(p / 0.4, 0, 1) : 0;
    // plant microtubule arrays: interphase cortical array → preprophase band → (gone at prometaphase) → phragmoplast
    o.cortical = k <= I.G2 || k >= I.done ? 1 : k === I.pro ? 1 - clamp(p / 0.5, 0, 1) : 0;
    o.ppb = !plant ? 0 : k === I.G2 ? clamp((p - 0.2) / 0.7, 0, 1) : k === I.pro ? 1 : k === I.prometa ? 1 - clamp(p / 0.25, 0, 1) : 0;
    o.ppb *= mt;
    o.cdz = plant && k >= I.G2 && k < I.done ? 1 : 0;                                   // cortical division zone "memory"
    // anaphase: separase (0..0.12), then movement
    const an = PH[I.ana];
    o.sepase = k < I.ana ? 0 : k === I.ana ? clamp(p / 0.12, 0, 1) : 1;
    const sRaw = k < I.ana ? 0 : k === I.ana ? clamp((p - 0.12) / 0.88, 0, 1) : 1;
    o.s = diy ? sRaw : ease(sRaw);
    o.cut = T >= an.start + 0.12 * an.dur;
    o.e = this.restit ? 0 : k < I.ana ? 0 : k === I.ana ? 0.6 * o.s : k === I.telo ? 0.6 + 0.4 * ease(p) : 1;
    // cytokinesis: furrow (animal) / cell plate (plant)
    let cyt = 0;
    if (!this.restit && exitOK) {
      if (k === I.telo) cyt = 0.12 * p;
      else if (k === I.cyto) cyt = 0.12 + 0.88 * (diy ? this.diy.cyto : ease(p));
      else if (k === I.done) cyt = 1;
    }
    o.f = plant ? 0 : cyt;
    o.plate = plant ? cyt : 0;
    o.phrag = plant && !this.restit && exitOK ? (k === I.telo ? clamp((p - 0.1) / 0.4, 0, 1) : k === I.cyto ? 1 - clamp((o.plate - 0.92) / 0.08, 0, 1) : 0) : 0;
    o.split = k === I.done && !plant && !this.restit;
    o.round = o.split ? ease(p) : 0;
    o.g = o.split ? 0.14 * ease(p) : 0;
    o.grow = k === I.G1 ? lerp(0.92, 1, ease(p)) : 1;
    o.a = (1 + 0.3 * o.e) * o.grow;          // animal: elongation along the spindle axis
    o.b = (1 - 0.12 * o.e) * o.grow;
    o.dcx = plant ? PLANT.dNuc : this.restit ? 0 : ANIMAL.R * (o.a / 2 + o.g) * 0.95;

    // spindle poles
    const pm = plant ? PLANT.poleMeta : ANIMAL.poleMeta, pa = plant ? PLANT.poleAna : ANIMAL.poleAna;
    let px = k < I.pro ? 6.2 : k === I.pro ? lerp(6.2, pm, ease(clamp((p - 0.35) / 0.65, 0, 1))) : k < I.ana ? pm : k === I.ana ? lerp(pm, pa, o.s) : pa;
    if (this.restit) px = pm;
    o.poles[0][0] = -px; o.poles[1][0] = px;
    o.poleSpread = plant ? 2.4 : 0.15;     // plant poles are broad (no centrosome)
    // animal centrosomes: start together beside the nucleus, separate around it in prophase
    if (!plant) {
      const r = k < I.pro ? 6.4 : lerp(6.4, px, o.mig);
      const a0 = lerp(1.95, Math.PI, o.mig), a1 = lerp(lerp(1.95, 1.7, o.dup), 0, o.mig);
      o.cs[0][0] = Math.cos(a0) * r; o.cs[0][1] = Math.sin(a0) * r; o.cs[0][2] = 0;
      o.cs[1][0] = Math.cos(a1) * r; o.cs[1][1] = Math.sin(a1) * r; o.cs[1][2] = 0;
      if (o.split) { o.cs[0][1] = lerp(0, 3.5, o.round); o.cs[1][1] = lerp(0, 3.5, o.round); o.cs[0][0] = lerp(-px, -o.dcx - 0.5, o.round); o.cs[1][0] = lerp(px, o.dcx + 0.5, o.round); }
      o.poles[0] = o.cs[0]; o.poles[1] = o.cs[1];
    } else {
      o.cs[0][0] = -px; o.cs[0][1] = 0; o.cs[0][2] = 0; o.cs[1][0] = px; o.cs[1][1] = 0; o.cs[1][2] = 0;
      o.poles[0] = o.cs[0]; o.poles[1] = o.cs[1];
    }

    // chromosomes
    const tmp = [0, 0, 0];
    for (let i = 0; i < 4; i++) {
      const C = CHR3[i], ch = o.chr[i];
      ch.rep = this.rep[i];
      ch.tension = this.tension(i);
      const slot = diy ? this.diy.slot[i] : C.slot;
      const S = slot >= 0 ? SLOTS[slot] : null;
      let c = ch.c, a, n = [1, 0, 0];
      // centre + orientation
      if (k < I.prometa) {
        const sp = k === I.pro ? 1 + 0.12 * ease(p) : 1;
        c[0] = C.home[0] * sp; c[1] = C.home[1] * sp; c[2] = C.home[2] * sp;
        a = C.hDir; n = C.hN;
      } else if (k <= I.meta || (k === I.ana && !this.dest)) {
        const q1 = k === I.prometa ? ease(clamp((p - 0.05) / 0.45, 0, 1)) : 1;
        lerp3([C.home[0] * 1.12, C.home[1] * 1.12, C.home[2] * 1.12], C.scat, q1, c);
        a = C.hDir; n = C.hN;
        let q2 = 0;
        if (diy) {
          if (k > I.prometa || p >= 0.5) {
            if (S) { const tgt = S.c; const dp = this.diy.pos[i]; lerp3(dp, tgt, 1, c); q2 = 1; }
            else { c[0] = this.diy.pos[i][0]; c[1] = this.diy.pos[i][1]; c[2] = this.diy.pos[i][2]; q2 = Math.abs(c[0]) < 2.5 ? 0.6 : 0; }
          }
        } else {
          q2 = k === I.prometa ? ease(clamp((p - 0.5) / 0.5, 0, 1)) : 1;
          if (!this.mtsOK) q2 = 0;
          if (S && q2 > 0) lerp3(c, S.c, q2, c);
        }
        if (!this.mtsOK && k >= I.prometa && !diy) { c[0] = C.scat[0]; c[1] = C.scat[1]; c[2] = C.scat[2]; q2 = 0; }
        const tA = S ? S.a : C.hDir;
        a = norm(lerp3(C.hDir, tA, q2, tmp));
        // sisters face the poles once captured
        const face = Math.max(q2, Math.max(this.att[i][0], this.att[i][1]));
        n = norm(lerp3(C.hN, [1, 0, 0], face, [0, 0, 0]));
        c[0] += this.off[i];
      } else {
        const sl = S || SLOTS[C.slot];
        c[0] = sl.c[0] + this.off[i]; c[1] = sl.c[1]; c[2] = sl.c[2];
        if (this.restit) { c[0] = C.scat[0]; c[1] = C.scat[1]; c[2] = C.scat[2]; }
        a = this.restit ? C.hDir : sl.a; n = this.restit ? C.hN : [1, 0, 0];
      }
      ch.a = a; ch.n = n;
      // sisters held by cohesin: wider when stretched by tension
      ch.gap = CHR_R + 0.06 + (ch.tension && k <= I.meta ? 0.22 : 0);
      ch.joined = !!(this.dest && this.cohesinMut && i === ND_CHR && !this.restit && k <= I.telo);
      // cohesin: loaded during S, arm cohesin removed in prophase, centromeric cohesin cut at anaphase
      ch.cohesin = k < I.S ? 0 : k === I.S ? ch.rep : o.cut && !ch.joined ? 0 : 1;
      ch.cohesinArm = k < I.S ? 0 : k === I.S ? ch.rep : k === I.G2 ? 1 : k === I.pro ? 1 - clamp(p / 0.8, 0, 1) : 0;
      if (ch.joined) ch.cohesinArm = 1;
      ch.cut = o.cut && !ch.joined;
      // tangle (interphase chromatin) weight
      ch.tangleW = 1 - o.cond;

      for (let s = 0; s < 2; s++) {
        const sg = s === 0 ? -1 : 1, si = ch.sis[s];
        // pre-anaphase kinetochore position (outer face of the centromere)
        const K0x = c[0] + n[0] * sg * ch.gap, K0y = c[1] + n[1] * sg * ch.gap, K0z = c[2] + n[2] * sg * ch.gap;
        si.kn[0] = n[0] * sg; si.kn[1] = n[1] * sg; si.kn[2] = n[2] * sg;
        si.tc[0] = C.home[0] + (s ? 0.18 : 0); si.tc[1] = C.home[1]; si.tc[2] = C.home[2] + (s ? 0.12 : 0);
        si.tScale = 1;
        si.dest = this.dest ? this.dest[i][s] : 0;
        si.move = 0; si.bend = 0;
        if (k < I.ana || !this.dest || o.sepase < 1 && k === I.ana) {
          si.K[0] = K0x; si.K[1] = K0y; si.K[2] = K0z;
          si.trail[0] = -n[0] * sg; si.trail[1] = -n[1] * sg; si.trail[2] = -n[2] * sg;
          continue;
        }
        // anaphase onward: each sister (now a chromosome) heads to its pole
        const side = si.dest;
        let sA = ch.joined ? Math.pow(o.s, 1.5) : o.s;
        si.move = sA;
        let tx, ty, tz;
        if (side === 0) {                                   // restitution: separate in place, no spindle
          tx = K0x + n[0] * sg * 0.9; ty = K0y + n[1] * sg * 0.9; tz = K0z + n[2] * sg * 0.9;
          sA = o.s * 0.8;
        } else {
          const P = side < 0 ? o.poles[0] : o.poles[1];
          tx = P[0] - side * 1.7; ty = P[1] + c[1] * 0.38; tz = P[2] + c[2] * 0.38;
          if (ch.joined) tx += sg * ch.gap;          // the stuck pair travels side by side
        }
        let Kx = lerp(K0x, tx, sA), Ky = lerp(K0y, ty, sA), Kz = lerp(K0z, tz, sA);
        // kinetochore leads, arms trail back toward the equator
        if (side !== 0) { si.kn[0] = side; si.kn[1] = 0; si.kn[2] = 0; si.trail[0] = -side; si.trail[1] = 0; si.trail[2] = 0; }
        else { si.trail[0] = -n[0] * sg; si.trail[1] = -n[1] * sg; si.trail[2] = -n[2] * sg; }
        si.bend = side === 0 ? 0.2 * sA : easeOut(clamp(sA * 2.2, 0, 1));
        // telophase: gather into the daughter nucleus and decondense there
        const Dx = this.restit ? 0 : side * o.dcx;
        si.tc[0] = Dx + C.home[0] * (this.restit ? 0.95 : 0.6) + (ch.joined && s ? 0.9 : 0) + (this.restit && s ? 0.4 : 0);
        si.tc[1] = C.home[1] * (this.restit ? 0.95 : 0.6) + (ch.joined && s ? 0.5 : 0);
        si.tc[2] = C.home[2] * (this.restit ? 0.95 : 0.6) + (this.restit && s ? 0.3 : 0);
        si.tScale = this.restit ? 0.95 : 0.62;
        if (k >= I.telo && exitOK) {
          const q = k === I.telo ? ease(clamp(p / 0.9, 0, 1)) : 1;
          Kx = lerp(Kx, si.tc[0], q * 0.85); Ky = lerp(Ky, si.tc[1], q * 0.85); Kz = lerp(Kz, si.tc[2], q * 0.85);
        }
        if (o.split) { si.tc[0] += side * (o.g * ANIMAL.R); }
        si.K[0] = Kx; si.K[1] = Ky; si.K[2] = Kz;
      }
    }
    return o;
  }
}

