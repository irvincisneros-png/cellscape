// Cellular respiration models shared by every scale of CellScape, so the numbers always agree.
//
//  • Constants + helpers: the reviewed numbers from the original 2D "ATP Factory" (sim2d.js imports them).
//  • ETCModel: the inner-membrane model (electron transport chain + chemiosmosis + ATP synthase), extracted
//    from the 2D sim. It is layout-independent: positions are in the 2D sim's reference layout (REF, a
//    900 × 560 "page" at scale 1) and the 3D scene maps them into the world. It emits events
//    (H⁺ pumped, ATP made, water formed…) that the renderer animates.
//  • MitoModel: the whole-organelle model (pyruvate import → link reaction → Krebs cycle → ETC → ATP synthase),
//    a continuous flux model built from the same constants (H⁺ per NADH/FADH₂, gradient threshold,
//    backpressure, O₂ dependence, leak, uncoupler) so the organelle and the membrane behave the same way.
//
// ETC model (simplified; "not to scale" note shown to students):
//  • NADH / FADH₂ arrive at J = SUPPLY_MAX · NADH% · bp,  bp = max(0.1, 1 − 0.85·G³)  (respiratory control:
//    pumping against a steep gradient is harder). NADH : FADH₂ ≈ 5 : 1 (per glucose: 10 NADH, 2 FADH₂).
//  • Each electron pair pumps H⁺ into the intermembrane space: complex I 4, III 4, IV 2 (NADH → 10, FADH₂ → 6).
//  • Complex IV needs O₂: hand-off rate ∝ f(O₂) = 1.4·O₂/(O₂ + 40) (0 with cyanide). Blocked → electrons back up.
//  • Gradient G = (H⁺ in the intermembrane space) / PCAP.
//  • ATP synthase turns at ω = TURNS_MAX · max(0, (G − 0.2)/0.8) turns/s; 9 H⁺ per turn, 3 ATP per turn
//    (one ATP per 120°, i.e. 3 H⁺ per ATP through the motor). Oligomycin → ω = 0.
//  • Leak: H⁺ return across the bilayer at (0.4 + 30·DNP)·G per s; with DNP the energy is released as heat.
//  • Whole-organelle bookkeeping adds ≈ 1 H⁺ per ATP to import phosphate (and swap ADP for ATP), i.e. ≈ 4 H⁺
//    per ATP delivered to the cytosol → ≈ 2.5 ATP per NADH and ≈ 1.5 per FADH₂ → ≈ 30–32 ATP per glucose.

export const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);

// ---------- constants (from the reviewed 2D model) ----------
export const PCAP = 120;                    // H⁺ in the intermembrane space at 100 % gradient
export const H_PER_TURN = 9, ATP_PER_TURN = 3;
export const STEP_H = TAU / H_PER_TURN, STEP_A = TAU / ATP_PER_TURN;
export const TURNS_MAX = 1.0;               // rotor turns per (sim) second at full gradient — real enzyme ≈ 100+ per second
export const G_THRESH = 0.2;                // minimum gradient needed to drive synthesis
export const SUPPLY_MAX = 1.2;              // electron pairs per second at 100 % NADH supply
export const LEAK_BASE = 0.4, LEAK_DNP = 30;
export const DEF = { o2: 100, nadh: 50 };
export const H_PUMP = { I: 4, III: 4, IV: 2 };
export const H_PER_NADH = H_PUMP.I + H_PUMP.III + H_PUMP.IV;   // 10
export const H_PER_FADH2 = H_PUMP.III + H_PUMP.IV;              // 6
export const H_PER_ATP_MOTOR = H_PER_TURN / ATP_PER_TURN;       // 3 (through F₀)
export const H_PER_ATP_IMPORT = 1;                              // phosphate import (+ ADP/ATP exchange)
export const H_PER_ATP = H_PER_ATP_MOTOR + H_PER_ATP_IMPORT;    // 4 per ATP delivered to the cytosol
export const ATP_PER_NADH = H_PER_NADH / H_PER_ATP;             // 2.5
export const ATP_PER_FADH2 = H_PER_FADH2 / H_PER_ATP;           // 1.5
export const FADH_SHARE = 1 / 6;

/** Per glucose, stage by stage (textbook bookkeeping used for the "big picture" cards). */
export const PER_GLUCOSE = {
  glycolysis: { where: "cytosol", atp: 2, nadh: 2 },
  link: { where: "matrix", nadh: 2, co2: 2 },
  krebs: { where: "matrix", atp: 2, nadh: 6, fadh2: 2, co2: 4 },
};
/** Whole-pathway ATP per glucose (≈ 30–32): cytosolic NADH enters by a shuttle worth 1.5–2.5 ATP each. */
export function wholeYield(shuttle = 2.5) {
  const g = PER_GLUCOSE;
  return g.glycolysis.atp + g.krebs.atp + g.glycolysis.nadh * shuttle + (g.link.nadh + g.krebs.nadh) * ATP_PER_NADH + g.krebs.fadh2 * ATP_PER_FADH2;
}

export const geff = (G) => clamp((G - G_THRESH) / (1 - G_THRESH), 0, 1);
export const backpressure = (G) => Math.max(0.1, 1 - 0.85 * G * G * G);
export const o2factor = (o2, cyanide) => (cyanide ? 0 : (o2 / (o2 + 40)) * 1.4);
/** β-subunit state for β j after kA ATP-steps: 0 = L(oose), 1 = T(ight), 2 = O(pen). */
export const betaState = (j, kA) => (((j + kA) % 3) + 3) % 3;

// ---------- reference layout (the 2D sim's layout at 900 × 560, scale 1) ----------
function rotP(cx, cy, a, lx, ly) { const c = Math.cos(a), s = Math.sin(a); return [cx + lx * c - ly * s, cy + lx * s + ly * c]; }
export const REF = (() => {
  const w = 900, h = 560, th = 72, mid = h * 0.46, top = mid - th / 2, bot = mid + th / 2;
  const x1 = w * 0.11, x2 = w * 0.255, x3 = w * 0.41, x4 = w * 0.565, x5 = w * 0.795;
  const hw1 = 34, hw2 = 20, hw3 = 30, hw4 = 27, Rc = 26, F1r = 38;
  const f1y = bot + 24 + F1r, ax = x5 + Rc + 8;
  const armBase = [x1 + 6, bot - 4];
  const tip = rotP(armBase[0], armBase[1], -0.25, 0, 60), am = rotP(armBase[0], armBase[1], -0.25, 0, 22);
  const ctop = top - 12;
  const tail = [
    { x: x3 - hw3 - 4, y: mid, ev: "qOff" }, { x: x3, y: mid, ev: "pumpIII" }, { x: x3, y: ctop, ev: "cOn" },
    { x: x4, y: ctop, ev: "gate" }, { x: x4, y: mid, ev: "pumpIV" }, { x: x4, y: bot + 12, ev: "water" },
  ];
  const nodes = {
    N: [{ x: tip[0], y: tip[1] }, { x: am[0], y: am[1] }, { x: x1, y: mid, ev: "pumpI" }, { x: x1 + hw1 + 4, y: mid, ev: "qOn" }].concat(tail),
    F: [{ x: x2, y: bot + 16 }, { x: x2, y: mid, ev: "II" }, { x: x2 + hw2 + 4, y: mid, ev: "qOn" }].concat(tail),
  };
  return { w, h, th, mid, top, bot, x1, x2, x3, x4, x5, hw1, hw2, hw3, hw4, Rc, F1r, f1y, ax, armBase, nodes, gi: { N: nodes.N.length - 3, F: nodes.F.length - 3 } };
})();

// ---------- inner-membrane model ----------
export class ETCModel {
  constructor() {
    this.st = { o2: DEF.o2, nadh: DEF.nadh, cyanide: false, dnp: false, olig: false };
    this.events = [];
    this.reset();
  }

  reset() {
    Object.assign(this, {
      pool: Math.round(PCAP * 0.55), packets: [], spawnAcc: 0, nextSpawn: 0.5, backlog: 0, gateHead: null, queueN: 0, reduced: 0,
      made: 0, hydro: 0, crankMade: 0, crankHydro: 0, water: 0, o2Used: 0, nadhUsed: 0, fadhUsed: 0, pumped: 0, leaked: 0,
      rate: 0, rateAcc: 0, hist: [], histT: 0, heat: 0, leakAcc: 0, leakRate: 0, time: 0,
      flash: { I: 0, II: 0, III: 0, IV: 0 },
      rotor: { th: 0, om: 0, kH: 0, kA: 0, grabbed: false, pend: 0, hand: 0, queue: 0 },
      highT: 0, cnT: 0, dnpT: 0, noO2T: 0,
    });
    this.events.length = 0;
    this.rotor.om = this.st.olig ? 0 : TAU * TURNS_MAX * geff(this.gradient());
  }

  gradient() { return clamp(this.pool / PCAP, 0, 1); }
  netATP() { return this.made - this.hydro; }
  o2f() { return o2factor(this.st.o2, this.st.cyanide); }
  get handActive() { const R = this.rotor; return R.grabbed || Math.abs(R.queue) > 1e-4; }
  emit(e) { if (this.events.length < 400) this.events.push(e); }
  /** Take (and clear) the events produced since the last call. */
  drain() { const e = this.events.slice(); this.events.length = 0; return e; }

  // ---- interaction ----
  grab() { const R = this.rotor; R.grabbed = true; R.pend = 0; R.queue = 0; }
  release() { const R = this.rotor; R.grabbed = false; R.pend = 0; }
  /** Add rotor angle from the user's hand (positive = synthesis direction). */
  turnBy(d) { this.rotor.pend += d; }
  /** Queue a hands-free crank of `d` radians (buttons). */
  queueTurn(d) { this.rotor.queue += d; }

  // ---- protons ----
  pump(at, n) { this.pool += n; this.pumped += n; this.emit({ k: "pump", at, n }); }
  takeProton() { if (this.pool <= 0) return false; this.pool = Math.max(0, this.pool - 1); return true; }

  // ---- electrons ----
  spawnPacket() {
    const type = Math.random() < FADH_SHARE ? "F" : "N";
    const p = { type, seg: 0, u: 0, d: type === "N" ? 0.35 : 0.15, ph: rand(0, TAU), carryQ: false, carryC: false, waiting: false, wait: 0, id: Math.random() };
    if (type === "N") { this.nadhUsed++; this.emit({ k: "nadh" }); }
    else { this.fadhUsed++; this.flash.II = 1; this.emit({ k: "fadh" }); }
    this.packets.push(p);
  }

  fireEvent(p, ev) {
    switch (ev) {
      case "pumpI": this.pump("I", H_PUMP.I); this.flash.I = 1; break;
      case "II": this.flash.II = 1; break;
      case "qOn": p.carryQ = true; break;
      case "qOff": p.carryQ = false; break;
      case "pumpIII": this.pump("III", H_PUMP.III); this.flash.III = 1; break;
      case "cOn": p.carryC = true; break;
      case "pumpIV": this.pump("IV", H_PUMP.IV); this.flash.IV = 1; break;
      case "water":
        this.water++; p.done = true;
        this.emit({ k: "water" });
        if (this.water % 2 === 0) { this.o2Used++; this.emit({ k: "o2used" }); } // ½ O₂ per electron pair
        break;
    }
  }

  advance(p, ds) {
    const nodes = REF.nodes[p.type], gi = REF.gi[p.type];
    let rem = ds;
    while (rem > 0 && !p.done) {
      const a = nodes[p.seg], b = nodes[p.seg + 1];
      const len = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
      const left = (1 - p.u) * len;
      if (rem < left) { p.u += rem / len; break; }
      rem -= left; p.seg++; p.u = 0;
      this.fireEvent(p, nodes[p.seg].ev);
      if (p.seg >= nodes.length - 1) { p.done = true; break; }
      if (p.seg === gi - 1) break; // now approaching complex IV: single-file queue below
    }
  }

  /** Packet position in REF coordinates. */
  packetPos(p, out = { x: 0, y: 0 }) {
    const nodes = REF.nodes[p.type];
    if (p.waiting) { const g = nodes[REF.gi[p.type]]; out.x = g.x; out.y = g.y; return out; }
    if (p.seg >= nodes.length - 1) { const e = nodes[nodes.length - 1]; out.x = e.x; out.y = e.y; return out; }
    const a = nodes[p.seg], b = nodes[p.seg + 1];
    out.x = lerp(a.x, b.x, p.u); out.y = lerp(a.y, b.y, p.u);
    return out;
  }

  updatePackets(dt, G) {
    const v = 150 * backpressure(G), spacing = 16;
    const approach = [];
    for (const p of this.packets) {
      if (p.d > 0) { p.d -= dt; continue; }
      if (p.waiting) continue;
      if (p.seg === REF.gi[p.type] - 1) { approach.push(p); continue; }
      this.advance(p, v * dt);
    }
    // single file along cytochrome c's route to complex IV
    approach.sort((a, b) => b.u - a.u);
    let lim = this.gateHead ? spacing : 0;
    for (const p of approach) {
      const nodes = REF.nodes[p.type], gi = REF.gi[p.type];
      const a = nodes[gi - 1], b = nodes[gi];
      const len = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
      const maxU = 1 - lim / len;
      if (p.u < maxU) p.u = Math.min(maxU, p.u + (v * dt) / len);
      if (p.u >= 1 && !this.gateHead) {
        p.seg = gi; p.u = 0; p.waiting = true; p.wait = 0; this.gateHead = p; lim = spacing;
        continue;
      }
      lim = (1 - p.u) * len + spacing;
    }
    // complex IV hands electrons to O₂ one pair at a time
    const g = this.gateHead;
    if (g) {
      g.wait += (dt * this.o2f()) / 0.25;
      if (g.wait >= 1) { g.waiting = false; g.carryC = false; this.gateHead = null; this.flash.IV = 1; }
    }
    this.queueN = approach.length + (this.gateHead ? 1 : 0);
    this.packets = this.packets.filter((p) => !p.done);

    // supply of NADH / FADH₂
    const supply = (SUPPLY_MAX * this.st.nadh) / 100;
    const bp = backpressure(G);
    const full = this.queueN >= 5 || this.pool >= PCAP * 1.05;
    if (!full) {
      const extra = this.backlog > 0.5 ? 0.5 : 0;
      this.spawnAcc += (supply + extra) * bp * dt;
      if (extra) this.backlog = Math.max(0, this.backlog - extra * bp * dt);
    } else {
      this.backlog = Math.min(20, this.backlog + supply * dt * 0.5);
    }
    if (this.spawnAcc >= this.nextSpawn) {
      this.spawnAcc -= this.nextSpawn;
      this.nextSpawn = rand(0.5, 1.5);
      this.spawnPacket();
    }
  }

  // ---- ATP synthase rotor ----
  note(key, msg) { this.emit({ k: "note", key, msg }); }

  updateRotor(dt, G) {
    const R = this.rotor, st = this.st;
    const hand = this.handActive;
    if (hand) {
      let d = 0;
      if (R.grabbed) { d = R.pend; R.pend = 0; }
      else { d = Math.sign(R.queue) * Math.min(Math.abs(R.queue), 5 * dt); R.queue -= d; }
      if (dt <= 0) { if (d !== 0) this.note("paused", "The simulation is paused — press Play to crank."); d = 0; R.queue = 0; }
      if (d !== 0 && st.olig) { d = 0; R.queue = 0; this.note("olig", "Oligomycin has jammed the F₀ rotor — it won't turn."); }
      d = clamp(d, -STEP_A * 0.45, STEP_A * 0.45);
      if (d < 0 && Math.floor((R.th + d) / STEP_A) < R.kA && this.netATP() <= 0) {
        d = Math.min(0, R.kA * STEP_A + 1e-4 - R.th); R.queue = 0;
        this.note("noatp", "No ATP left to hydrolyse — running backwards needs ATP as fuel.");
      }
      R.th += d;
      if (dt > 0) R.hand = lerp(R.hand, d / dt, 0.25);
      R.om = R.hand;
    } else {
      R.hand *= 0.85;
      const target = st.olig ? 0 : TAU * TURNS_MAX * geff(G);
      R.om = Math.max(0, R.om + (target - R.om) * (1 - Math.exp(-dt * (st.olig ? 8 : 2.5))));
      if (Math.floor((R.th + R.om * dt) / STEP_H) > R.kH && this.pool <= 0) R.om = 0;
      R.th += R.om * dt;
    }
    const kH = Math.floor(R.th / STEP_H);
    while (kH > R.kH) { R.kH++; if (this.takeProton()) this.emit({ k: "synIn" }); }
    while (kH < R.kH) { R.kH--; this.pool++; this.emit({ k: "synOut" }); }
    const kA = Math.floor(R.th / STEP_A);
    while (kA > R.kA) { R.kA++; this.made++; if (hand) this.crankMade++; this.rateAcc += 1; this.emit({ k: "atp", byHand: hand }); }
    while (kA < R.kA) { R.kA--; this.hydro++; this.crankHydro++; this.rateAcc -= 1; this.emit({ k: "hydro" }); }
    return hand;
  }

  // ---- main step ----
  step(dt) {
    const st = this.st;
    let G = this.gradient();
    const hand = this.updateRotor(dt, G);
    this.updatePackets(dt, G);

    // leak across the bilayer (basal + uncoupler)
    G = this.gradient();
    const lb = LEAK_BASE * G, ld = st.dnp ? LEAK_DNP * G : 0;
    this.leakRate = lb + ld;
    this.leakAcc += (lb + ld) * dt;
    while (this.leakAcc >= 1) {
      this.leakAcc -= 1;
      if (this.pool > 0) { const hot = st.dnp && Math.random() < ld / (lb + ld); this.pool--; this.leaked++; this.emit({ k: "leak", hot }); }
    }
    const heatTarget = st.dnp ? clamp(0.35 + ld / 8, 0, 1) : 0;
    this.heat += (heatTarget - this.heat) * (1 - Math.exp(-dt * 1.5));

    for (const k in this.flash) this.flash[k] = Math.max(0, this.flash[k] - dt * 2.2);
    this.reduced += (clamp((this.queueN - 2) / 3, 0, 1) - this.reduced) * (1 - Math.exp(-dt * 3));

    // ATP rate (exponential moving average, τ = 2 s) and history
    if (dt > 0) {
      this.time += dt;
      this.rate = this.rate * Math.exp(-dt / 2) + this.rateAcc / 2;
      this.rateAcc = 0;
      this.histT += dt;
      while (this.histT >= 0.25) { this.histT -= 0.25; this.hist.push(this.rate); if (this.hist.length > 120) this.hist.shift(); }
    }
    // mission timers
    if (!hand && this.rate >= 1.9) this.highT += dt; else if (hand || this.rate < 1.8) this.highT = 0;
    this.cnT = st.cyanide ? this.cnT + dt : 0;
    this.dnpT = st.dnp ? this.dnpT + dt : 0;
    this.noO2T = st.o2 === 0 ? this.noO2T + dt : 0;
  }
}

// ---------- whole-organelle model ----------
const sat = (x, k) => (x <= 0 ? 0 : x / (x + k));

/**
 * Continuous model of one mitochondrion in a plant cell (rates in "sim" molecules per second, slowed down).
 * Inputs: supply (glucose → pyruvate, %), o2 (%), demand (ATP use by the cell, %) and knockouts.
 * Pools: pyr (matrix pyruvate), acoa (acetyl-CoA), nadh / fadh (fraction of the carrier pool reduced),
 *        G (H⁺ gradient, 0–1, same meaning as ETCModel.gradient()), adp (fraction of the cell's adenylates as ADP).
 */
export class MitoModel {
  constructor() {
    this.supply = 70; this.o2 = 100; this.demand = 40;
    this.cyanide = false; this.anoxia = false; this.dnp = false; this.olig = false;
    this.reset();
  }

  static K = {
    GLY_MAX: 1.0,       // glucose / s through glycolysis at 100 % supply (needs ADP: substrate-level phosphorylation)
    PYR_CAP: 15,        // matrix pyruvate pool at which import stops (it backs up into the cytosol)
    K_PDH: 6, K_KREBS: 6,
    K_E: 24,            // electron pairs / s per unit reduced carrier (× O₂ factor × backpressure)
    K_S: 40,            // ATP synthase capacity (ATP / s at full driving force and plenty of ADP)
    PCAP_M: 300,        // H⁺ capacity of this mitochondrion's intermembrane space + crista lumens (sim units)
    LEAK_K: 7.5,        // scales the 2D leak constants to this organelle's (larger) proton flux
    USE_MAX: 70,        // ATP / s the cell can spend at 100 % demand
    A_TOT: 220,         // ATP + ADP pool (sets how quickly ADP responds)
    NAD_TOT: 40, FAD_TOT: 10,
  };

  reset() {
    Object.assign(this, { pyr: 4, acoa: 1, nadh: 0.35, fadh: 0.3, G: 0.62, adp: 0.35, heat: 0, time: 0, hist: [], histT: 0 });
    this.F = { gly: 0, imp: 0, ferm: 0, pdh: 0, krebs: 0, shuttle: 0, eN: 0, eF: 0, pumpH: 0, atpMito: 0, atpTotal: 0, leak: 0, use: 0, o2: 0, co2: 0, h2o: 0, yield: 0 };
    this.tot = { glucose: 0, atp: 0, atpMito: 0, co2: 0, o2: 0, h2o: 0, pyruvate: 0 };
    this.smooth = { atp: 0, o2: 0, gly: 0, krebs: 0, yield: 0 };
    // settle to steady state quietly so the first frame isn't a transient
    for (let i = 0; i < 600; i++) this.step(1 / 30, true);
    this.tot = { glucose: 0, atp: 0, atpMito: 0, co2: 0, o2: 0, h2o: 0, pyruvate: 0 };
    const F = this.F;
    F.yield = F.gly > 0.02 ? F.atpTotal / F.gly : 0;
    this.smooth = { atp: F.atpTotal, o2: F.o2, gly: F.gly, krebs: F.krebs, yield: F.gly > 0.02 ? F.atpTotal / F.gly : 0 };
  }

  get o2eff() { return this.anoxia ? 0 : this.o2; }
  get o2f() { return Math.min(1, o2factor(this.o2eff, this.cyanide)); }

  step(dt, quiet = false) {
    if (dt <= 0) return;
    const K = MitoModel.K, F = this.F;
    const nadFree = 1 - this.nadh, fadFree = 1 - this.fadh;
    // glycolysis (CYTOSOL): glucose → 2 pyruvate + 2 ATP + 2 NADH. Needs ADP (it makes ATP directly).
    F.gly = K.GLY_MAX * (this.supply / 100) * sat(this.adp, 0.12) * 1.12;
    // pyruvate carrier into the matrix; what can't enter is fermented in the cytosol (plants/yeast: ethanol + CO₂)
    F.imp = 2 * F.gly * clamp(1 - (this.pyr / K.PYR_CAP) ** 2, 0, 1);
    F.ferm = 2 * F.gly - F.imp;
    // glycolytic NADH: its electrons enter the matrix with the imported pyruvate (shuttle); otherwise fermentation re-oxidises it
    F.shuttle = F.imp * clamp(nadFree * 4, 0, 1);
    // link reaction (matrix): pyruvate + NAD⁺ → acetyl-CoA + CO₂ + NADH
    F.pdh = K.K_PDH * sat(this.pyr, 3) * nadFree;
    // Krebs cycle (matrix): acetyl-CoA → 2 CO₂ + 3 NADH + 1 FADH₂ + 1 ATP (GTP)
    F.krebs = K.K_KREBS * sat(this.acoa, 1.5) * nadFree * (0.4 + 0.6 * fadFree);
    // electron transport chain (cristae): needs O₂ at complex IV; slows against a steep gradient
    // (like the 2D model, which stops new electrons arriving once the intermembrane space is full, the chain
    //  stalls as G → 1: it can't pump against a gradient it has already maxed out)
    const G = this.G, bp = backpressure(G) * clamp((1.02 - G) / 0.12, 0, 1), f = this.o2f;
    F.eN = K.K_E * this.nadh * f * bp;
    F.eF = K.K_E * 0.5 * this.fadh * f * bp;
    F.pumpH = H_PER_NADH * F.eN + H_PER_FADH2 * F.eF;
    // ATP synthase: driven by the gradient above threshold, needs ADP (respiratory control); oligomycin blocks it
    F.atpMito = this.olig ? 0 : K.K_S * geff(G) * sat(this.adp, 0.15);
    // proton leak (basal + uncoupler) — energy released as heat
    F.leak = (LEAK_BASE + (this.dnp ? LEAK_DNP : 0)) * G * K.LEAK_K;
    // ATP use by the rest of the cell
    F.atpTotal = F.atpMito + F.krebs + 2 * F.gly;
    F.use = K.USE_MAX * (this.demand / 100) * (1 - this.adp);
    F.o2 = (F.eN + F.eF) / 2;
    F.h2o = F.eN + F.eF;
    F.co2 = F.pdh + 2 * F.krebs + F.ferm; // ethanol fermentation also releases CO₂

    // integrate
    const G0 = this.G, N0 = this.nadh, A0 = this.adp;
    this.pyr = clamp(this.pyr + (F.imp - F.pdh) * dt, 0, K.PYR_CAP);
    this.acoa = clamp(this.acoa + (F.pdh - F.krebs) * dt, 0, 10);
    this.nadh = clamp(this.nadh + ((F.pdh + 3 * F.krebs + F.shuttle - F.eN) / K.NAD_TOT) * dt, 0.01, 1);
    this.fadh = clamp(this.fadh + ((F.krebs - F.eF) / K.FAD_TOT) * dt, 0.01, 1);
    this.G = clamp(this.G + ((F.pumpH - H_PER_ATP * F.atpMito - F.leak) / K.PCAP_M) * dt, 0, 1);
    this.adp = clamp(this.adp + ((F.use - F.atpTotal) / K.A_TOT) * dt, 0, 1);
    const heatT = clamp(F.leak / 120, 0, 1);
    this.heat += (heatT - this.heat) * (1 - Math.exp(-dt * 1.5));

    // how far from steady state (yield per glucose is only meaningful once the pools have settled)
    const drift = Math.abs(this.G - G0) / dt + Math.abs(this.nadh - N0) / dt + Math.abs(this.adp - A0) / dt;
    this.drift = (this.drift ?? 0) + (drift - (this.drift ?? 0)) * (1 - Math.exp(-dt / 1.5));
    if (quiet) return;
    this.time += dt;
    const tot = this.tot;
    tot.glucose += F.gly * dt; tot.atp += F.atpTotal * dt; tot.atpMito += (F.atpMito + F.krebs) * dt;
    tot.co2 += F.co2 * dt; tot.o2 += F.o2 * dt; tot.h2o += F.h2o * dt; tot.pyruvate += F.imp * dt;
    const k = 1 - Math.exp(-dt / 1.5), S = this.smooth;
    S.atp += (F.atpTotal - S.atp) * k; S.o2 += (F.o2 - S.o2) * k; S.gly += (F.gly - S.gly) * k; S.krebs += (F.krebs - S.krebs) * k;
    F.yield = F.gly > 0.02 ? F.atpTotal / F.gly : 0;
    S.yield += (F.yield - S.yield) * (1 - Math.exp(-dt / 4));
    this.histT += dt;
    while (this.histT >= 0.25) {
      this.histT -= 0.25;
      this.hist.push({ atp: S.atp, o2: S.o2, G: this.G, nadh: this.nadh });
      if (this.hist.length > 240) this.hist.shift();
    }
  }

  /** True when the pools have settled, so ATP per glucose is a meaningful yield. */
  get steady() { return (this.drift ?? 0) < 0.02 && Math.abs(this.smooth.yield - this.F.yield) < 1.5; }

  /** Maximum ATP/s at full supply/O₂/demand (for scaling charts). */
  static get ATP_SCALE() { return 40; }
}
