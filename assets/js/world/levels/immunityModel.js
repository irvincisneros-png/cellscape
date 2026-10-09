// Teaching-scale model of the immune response to a wound infection (no DOM, so it can be tested with node).
// Time is in "days". All quantities are relative (0 = none, 1 = the most the site/clone pool can hold) and the page says so.
//
//  INNATE (shared by every pathogen)
//    S   inflammatory signals (histamine, chemokines, cytokines) from damaged cells, mast cells and macrophages
//    N   neutrophils at the site            (recruited within hours, short-lived)
//    M   macrophages at the site            (a resident pool, topped up by monocytes)
//    phi vessel widening + leakiness        (follows S)
//  PER PATHOGEN (a bacterium and a virus each keep their own pathogen load and their own adaptive response)
//    P   pathogen load (bacteria, or free virus);  I  infected host cells (virus only)
//    D   dendritic cells presenting antigen on MHC after reaching the lymph node
//    Th, Tc, Tr  activated helper, cytotoxic and regulatory (suppressor) T cells
//    Ba  activated B cells (clonal expansion) -> plasma cells Pm (IgM) / Pg (IgG) / Pl (long-lived) -> antibodies IgM, IgG
//    Bm, Tm, Tcm  memory B / helper T / cytotoxic T cells
//  The lag before the first antibodies is NOT typed in: it comes from clonal selection. Only about 1 in 10,000 lymphocytes
//  fits a given antigen (x0), so that clone has to expand (~doubling every day) before it is large enough to matter.
//  A second exposure starts from memory cells (about 100 times more starting cells that are already class-switched),
//  so the response is faster, bigger and mostly IgG.
//  Not modelled: complement, fever feedback, germinal-centre affinity maturation, tissue repair, T-cell trafficking time.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const X0 = 2e-4;           // starting size of a naive clone (1 in ~5,000 cells, simplified)
export const DETECT = 0.01;       // "detectable antibody" threshold, relative units
export const DAY_SECONDS = 8;     // 1 model day = 8 s of animation at 1x

export const PATHOGENS = {
  bacterium: { id: "bacterium", kind: "bacterium", cellular: true, name: "Bacterium (rod-shaped bacillus)", short: "bacterium", other: "virus", r: 2.2, dose: 0.02 },
  virus: { id: "virus", kind: "virus", cellular: false, name: "Virus", short: "virus", other: "bacterium", dose: 0.01 },
};

const newSlot = () => ({
  P: 0, I: 0, depot: 0, Z: 0, D: 0, Th: 0, Tc: 0, Tr: 0, Ba: 0, s: 0, Pm: 0, Pg: 0, Pl: 0, IgM: 0, IgG: 0, Bm: 0, Tm: 0, Tcm: 0,
  exposures: 0, cap: 1, boost: 1,
});

export class ImmuneModel {
  constructor() { this.reset(); }

  reset() {
    this.day = 0;
    this.S = 0; this.N = 0; this.M = 0.25; this.w = 0; this.adj = 0;
    this.compromised = false;
    this.slots = { bacterium: newSlot(), virus: newSlot() };
    this.events = [];           // {day, id, kind: "infect" | "vaccinate"}
    this.records = [];          // one per exposure: {id, kind, t0, secondary, detect, peakAb, peakDay, peakP, peakI}
    this.history = [];          // {day, bacterium: {igm, igg, p}, virus: {...}}
    this._hist = 0;
    this.flags = { digest: false };
  }

  get hf() { return this.compromised ? 0.2 : 1; }
  slot(id) { return this.slots[id]; }
  ab(id) { const s = this.slots[id]; return 1.2 * s.IgM + s.IgG; }
  total(id) { const s = this.slots[id]; return s.IgM + s.IgG; }
  /** Largest pathogen load or infected-cell fraction across both pathogens. */
  get load() { let l = 0; for (const id in this.slots) { const s = this.slots[id]; l += s.P + (id === "virus" ? 0.8 * s.I : 0); } return l; }
  get phagocytes() { return this.N + 1.5 * this.M; }
  get phi() { return this.S / (this.S + 0.15); }
  active(id) { const s = this.slots[id]; return s.P > 0.002 || s.I > 0.002; }
  /** true while an infection with this pathogen is still going on */
  get anyActive() { return this.active("bacterium") || this.active("virus"); }

  _begin(id, kind) {
    const s = this.slots[id];
    const secondary = s.Bm + s.Tm > 0.004;
    const rec = { id, kind, t0: this.day, secondary, detect: null, peakAb: this.total(id), peakDay: this.day, peakP: 0, peakI: 0, baseAb: this.total(id) };
    this.records.push(rec);
    this.events.push({ day: this.day, id, kind });
    // memory cells are re-activated at once; naive cells are rare, so the clone starts tiny
    s.Th = Math.max(s.Th, X0 + s.Tm);
    s.Ba = Math.max(s.Ba, X0 + s.Bm);
    s.s = (0.9 * s.Bm + s.s * X0) / (X0 + s.Bm);
    const mem = s.Bm / (s.Bm + 0.05);
    s.cap = 1 + 4 * mem;           // more B-cell clones are recruited when memory B cells exist
    s.boost = 1 + 12 * mem;         // and memory B cells turn into plasma cells faster (high-affinity, already class-switched)
    if (id === "virus") s.Tc = Math.max(s.Tc, X0 + s.Tcm);
    s.exposures++;
    return rec;
  }

  /** A wound infection: pathogen enters through the cut. */
  infect(id, dose) {
    const s = this.slots[id], p = PATHOGENS[id];
    this._begin(id, "infect");
    if (id === "bacterium") s.P += dose ?? p.dose; else { s.P += dose ?? p.dose; }
    this.w = Math.max(this.w, 0.45);
  }

  /** An inactivated vaccine: antigen and an adjuvant, but nothing that can multiply. */
  vaccinate(id) {
    const s = this.slots[id];
    this._begin(id, "vaccinate");
    s.depot += 0.5;
    this.adj = 0.7;
  }

  step(dt) {
    let left = dt;
    while (left > 1e-9) { const h = Math.min(left, 0.004); this._step(h); left -= h; }
    this._hist -= dt;
    if (this._hist <= 0) {
      this._hist = 0.25;
      const b = this.slots.bacterium, v = this.slots.virus;
      this.history.push({ day: this.day, b: { igm: b.IgM, igg: b.IgG, p: b.P }, v: { igm: v.IgM, igg: v.IgG, p: v.P, i: v.I }, S: this.S });
      if (this.history.length > 4000) this.history.splice(0, 1);
    }
  }

  _step(h) {
    const hf = this.hf;
    // ---- innate
    const load = this.load;
    const dS = 6 * ((load / (load + 0.02)) * 0.7 + this.w + this.adj) - 4 * this.S;
    const dN = 9 * (this.S / (this.S + 0.12)) * (1 - this.N) - 1.5 * this.N;
    const dM = 1.2 * (this.S / (this.S + 0.15)) * (1 - this.M) - 0.3 * (this.M - 0.25);
    const ph = this.phagocytes;
    this.S = clamp(this.S + dS * h, 0, 1.5);
    this.N = clamp(this.N + dN * h, 0, 1);
    this.M = clamp(this.M + dM * h, 0, 1);
    this.w *= Math.exp(-1.2 * h);
    this.adj *= Math.exp(-1.0 * h);

    // ---- per pathogen
    for (const id in this.slots) {
      const s = this.slots[id], virus = id === "virus";
      const Ab = 1.2 * s.IgM + s.IgG;
      const ag = s.P + (virus ? 0.8 * s.I : 0) + s.depot + s.Z;
      // antigen presentation (dendritic cells carry antigen to the lymph node: needs inflammation)
      const dD = 5 * (ag / (ag + 0.05)) * (this.S / (this.S + 0.03)) * (1 - s.D) - 0.8 * s.D;
      const aD = s.D / (s.D + 0.1);
      const aC = virus ? (s.I / (s.I + 0.02)) * aD : 0;
      const H = hf * s.Th / (s.Th + 0.05);
      const dTh = 1.8 * aD * s.Th * (1 - s.Th) - 0.5 * (1 - aD) * s.Th - 0.8 * s.Tr * s.Th;
      const dTc = 1.8 * aC * s.Tc * (1 - s.Tc) * (0.3 + 0.7 * H) - 0.5 * (1 - aC) * s.Tc - 0.8 * s.Tr * s.Tc;
      const dTr = 0.5 * (s.Th + s.Tc) * (1 - s.Tr) - 0.35 * s.Tr;
      const diff = 0.5 * s.Ba * (0.1 + 0.9 * H), out = diff * s.boost;      // out: plasma cells made per day
      const cap = s.cap;
      const dBa = 2.0 * s.Ba * (1 - s.Ba / cap) * aD * (0.45 + 0.55 * H) - diff - 0.4 * s.Ba * (1 - aD);
      const dsw = 0.12 * H * (1 - s.s);
      const dPm = out * (1 - s.s) - 0.35 * s.Pm;
      const dPg = out * s.s - 0.2 * s.Pg;
      const dPl = 0.015 * out * s.s - 0.004 * s.Pl;
      const dBm = 0.03 * diff - 0.0015 * s.Bm;
      const dTm = 0.02 * s.Th * aD - 0.0015 * s.Tm;
      const dTcm = 0.02 * s.Tc * aC - 0.0015 * s.Tcm;
      const Q = 0.021;     // antibody secretion scale (so the primary peak is about 1)
      const dIgM = Q * 15 * s.Pm - 0.14 * s.IgM - 0.3 * s.IgM * ag;
      const dIgG = Q * 5 * (s.Pg + 0.3 * s.Pl) - 0.033 * s.IgG - 0.3 * s.IgG * ag;
      const ddep = -0.1 * s.depot - 0.4 * s.depot * (1 - 1 / (1 + 3 * Ab));    // antigen depot fades and is mopped up by antibody
      let dP, dI = 0, dZ = -0.6 * s.Z;                                        // Z: killed antigen carried to the lymph node (so antibody-coated or eaten pathogens still prime memory)
      if (!virus) {
        const kill = 0.9 * ph / (1 + s.P / 0.08) * (1 + 40 * Ab);
        dP = PATHOGENS.bacterium.r * s.P * (1 - s.P) - kill * s.P;
        dZ += 0.6 * kill * s.P;
      } else {
        const delta = 0.4 + 1.2 * this.S / (this.S + 0.2);                     // innate antiviral defences (interferon, NK cells), lumped
        dP = 8 * s.I - 3 * s.P - 60 * Ab * s.P - 0.3 * ph * s.P;               // free virus: made by infected cells, neutralised by antibody
        dI = 2.5 * s.P * (1 - s.I) - (delta + 12 * s.Tc) * s.I;                // infected cells: killed by innate defences and cytotoxic T cells
        dZ += 0.6 * (60 * Ab * s.P + 0.3 * ph * s.P + 12 * s.Tc * s.I);
      }
      s.P = clamp(s.P + dP * h, 0, 1.5); s.I = clamp(s.I + dI * h, 0, 1);
      if (s.P < 1e-5 && !virus) s.P = 0;
      s.depot = Math.max(0, s.depot + ddep * h); s.Z = Math.max(0, s.Z + dZ * h);
      s.D = clamp(s.D + dD * h, 0, 1);
      s.Th = clamp(s.Th + dTh * h, 0, 1); s.Tc = clamp(s.Tc + dTc * h, 0, 1); s.Tr = clamp(s.Tr + dTr * h, 0, 1);
      s.Ba = clamp(s.Ba + dBa * h, 0, cap); s.s = clamp(s.s + dsw * h, 0, 1);
      s.Pm = Math.max(0, s.Pm + dPm * h); s.Pg = Math.max(0, s.Pg + dPg * h); s.Pl = Math.max(0, s.Pl + dPl * h);
      s.Bm = Math.max(0, s.Bm + dBm * h); s.Tm = Math.max(0, s.Tm + dTm * h); s.Tcm = Math.max(0, s.Tcm + dTcm * h);
      s.IgM = Math.max(0, s.IgM + dIgM * h); s.IgG = Math.max(0, s.IgG + dIgG * h);
    }
    this.day += h;
    // ---- bookkeeping for the open exposures
    for (const r of this.records) {
      const s = this.slots[r.id], tot = s.IgM + s.IgG;
      if (this.day - r.t0 > 60) continue;
      if (r.detect == null && tot - r.baseAb > Math.max(DETECT, 0.15 * r.baseAb)) r.detect = this.day - r.t0;
      if (tot > r.peakAb) { r.peakAb = tot; r.peakDay = this.day; }
      r.peakP = Math.max(r.peakP, s.P); r.peakI = Math.max(r.peakI, s.I);
    }
  }

  /** How ill the person has been in the latest exposure to this pathogen: "none" | "mild" | "severe". */
  illness(rec) {
    const x = rec.id === "virus" ? Math.max(rec.peakI, rec.peakP * 0.5) : rec.peakP;
    return rec.kind === "vaccinate" ? "none" : x < 0.06 ? "none" : x < 0.35 ? "mild" : "severe";
  }

  /** The antibody class that dominates right now. */
  dominant(id) { const s = this.slots[id]; return s.IgM + s.IgG < DETECT ? "none" : s.IgM > s.IgG ? "IgM" : "IgG"; }

  /** The stage of the adaptive response (for the narrative). */
  phase(id) {
    const s = this.slots[id], tot = s.IgM + s.IgG;
    if (s.exposures === 0) return "naive";
    if (tot < DETECT && s.Th < 0.05) return "priming";          // antigen is being presented, clones are still tiny
    if (tot < DETECT) return "expanding";                       // helper T cells are active, B cells multiplying
    if (s.Pm + s.Pg > 0.02) return "secreting";
    return "memory";
  }
}

// =====================================================================================================================
// Herd immunity: a small stochastic outbreak on a contact network. The threshold 1 − 1/R₀ comes from the maths of
// R_eff = R₀ × (fraction still susceptible); the dots show the same idea at work in a population of 150.
// =====================================================================================================================
export const herdThreshold = (r0) => (r0 <= 1 ? 0 : 1 - 1 / r0);
/** Coverage needed with a vaccine that protects a fraction `eff` of those vaccinated (the "take" of the vaccine). */
export const coverageNeeded = (r0, eff = 1) => Math.min(1, herdThreshold(r0) / Math.max(eff, 1e-6));

export const DISEASES = {
  measles: { name: "Measles", r0: 15, note: "R₀ about 12–18" },
  covid: { name: "Original COVID-19 strain", r0: 2.8, note: "R₀ about 2–3 (newer variants were higher)" },
  flu: { name: "Seasonal influenza", r0: 1.4, note: "R₀ about 1.3–1.8" },
  polio: { name: "Polio", r0: 6, note: "R₀ about 5–7" },
};

function mulberry32(a) { return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export class HerdSim {
  /**
   * n people on a ~square layout. Each has K contacts (70% near, 30% random). Infectious for DAYS days.
   * Transmission chance per contact per day is set so that a fully susceptible population gives R₀ ≈ r0.
   */
  constructor({ n = 150, r0 = 15, coverage = 0, eff = 1, seed = 7, K = 12, days = 4 } = {}) {
    Object.assign(this, { n, r0, coverage, eff, K, days });
    this.build(seed);
  }

  build(seed) {
    const n = this.n, rng = mulberry32(seed);
    this.rng = rng;
    const cols = Math.ceil(Math.sqrt(n * 1.5));
    this.pos = Array.from({ length: n }, (_, i) => ({ x: ((i % cols) + 0.5 + (rng() - 0.5) * 0.6) / cols, y: (Math.floor(i / cols) + 0.5 + (rng() - 0.5) * 0.6) / Math.ceil(n / cols) }));
    // who is vaccinated (a random subset), and for how many the vaccine "takes"
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    this.order = order;
    this.take = Array.from({ length: n }, () => rng());       // vaccinated person is immune if take < eff
    // contact lists
    const d2 = (a, b) => (this.pos[a].x - this.pos[b].x) ** 2 + (this.pos[a].y - this.pos[b].y) ** 2;
    this.nb = Array.from({ length: n }, () => new Set());
    const nearK = Math.round(this.K * 0.35);
    for (let i = 0; i < n; i++) {
      const near = [...order].filter((j) => j !== i).sort((a, b) => d2(i, a) - d2(i, b)).slice(0, nearK);
      for (const j of near) { this.nb[i].add(j); this.nb[j].add(i); }
      for (let k = 0; k < Math.round(this.K * 0.15); k++) { const j = Math.floor(rng() * n); if (j !== i) { this.nb[i].add(j); this.nb[j].add(i); } }
    }
    this.nb = this.nb.map((s) => [...s]);
    this.avgDeg = this.nb.reduce((a, l) => a + l.length, 0) / n;
    this.reset();
  }

  setParams({ r0, coverage, eff }) {
    if (r0 != null) this.r0 = r0;
    if (coverage != null) this.coverage = coverage;
    if (eff != null) this.eff = eff;
    this.reset();
  }

  /** 0 = susceptible, 1 = infected, 2 = recovered, 3 = immune by vaccine */
  reset() {
    const n = this.n, nv = Math.round(this.coverage * n);
    this.state = new Uint8Array(n);
    this.vacc = new Uint8Array(n);                // vaccinated at all
    for (let k = 0; k < nv; k++) { const i = this.order[k]; this.vacc[i] = 1; if (this.take[i] < this.eff) this.state[i] = 3; }
    this.timer = new Uint8Array(n);
    this.day = 0; this.everInfected = 0;
    // two index cases among the people who are not immune (the first few in a fixed random order)
    let seeded = 0;
    for (let k = n - 1; k >= 0 && seeded < 2; k--) { const i = this.order[k]; if (this.state[i] === 0) { this.state[i] = 1; this.timer[i] = this.days; this.everInfected++; seeded++; } }
    this.p = Math.min(0.95, this.r0 / (this.avgDeg * this.days));       // per contact per day
    this.done = seeded === 0;
  }

  step() {                              // one day
    const n = this.n, next = this.state.slice();
    let active = 0;
    for (let i = 0; i < n; i++) {
      if (this.state[i] !== 1) continue;
      for (const j of this.nb[i]) if (this.state[j] === 0 && next[j] === 0 && this.rng() < this.p) { next[j] = 1; this.timer[j] = this.days; this.everInfected++; }
      if (--this.timer[i] <= 0) next[i] = 2;
    }
    this.state = next;
    for (let i = 0; i < n; i++) if (next[i] === 1) active++;
    this.day++;
    if (!active) this.done = true;
    return active;
  }

  run() { let g = 0; while (!this.done && g++ < 200) this.step(); return this.attackRate(); }
  count(s) { let c = 0; for (const v of this.state) if (v === s) c++; return c; }
  attackRate() { return this.everInfected / this.n; }
}

export const HERD_R0_MAX = 18;
