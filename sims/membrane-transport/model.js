// Membrane Transport — simulation model (no DOM, so it can be tested headlessly).
// Units: CSS pixels and seconds. Both compartments have equal volume, so particle count = concentration.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2; // ~N(0,1)
const TAU = Math.PI * 2;

/** Species. r = radius at scale 1, mob = relative mobility, lipid = chance per collision of
 *  dissolving through the hydrophobic core (only small, non-polar molecules; water a trickle). */
export const SP = {
  o2:   { name: "O₂", long: "Oxygen", short: "O₂", color: "#ff6b6b", r: 5.5, mob: 1.0, lipid: 0.5 },
  co2:  { name: "CO₂", long: "Carbon dioxide", short: "CO₂", color: "#b6c2d4", r: 6, mob: 0.95, lipid: 0.45 },
  h2o:  { name: "H₂O", long: "Water", short: "H₂O", color: "#7dd3fc", r: 4.6, mob: 1.05, lipid: 0.012 },
  glc:  { name: "Glucose", long: "Glucose", short: "Glc", color: "#a3e635", r: 8, mob: 0.8, lipid: 0 },
  na:   { name: "Na⁺", long: "Sodium ion", short: "Na⁺", color: "#fb923c", r: 5.5, mob: 0.9, lipid: 0 },
  k:    { name: "K⁺", long: "Potassium ion", short: "K⁺", color: "#c084fc", r: 6.6, mob: 0.9, lipid: 0 },
  prot: { name: "Protein", long: "Large protein", short: "Prot", color: "#f472b6", r: 12, mob: 0.35, lipid: 0 },
  // plant configuration only
  h:    { name: "H⁺", long: "Hydrogen ion (proton)", short: "H⁺", color: "#f9a8d4", r: 4.4, mob: 1.1, lipid: 0.002 },
  suc:  { name: "Sucrose", long: "Sucrose", short: "Suc", color: "#bef264", r: 9, mob: 0.7, lipid: 0 },
  no3:  { name: "NO₃⁻", long: "Nitrate ion", short: "NO₃⁻", color: "#60a5fa", r: 6.2, mob: 0.85, lipid: 0 },
};
/** Charge of each ion (in elementary charges). Only used by the plant membrane potential. */
const CHARGE = { h: 1, k: 1, na: 1, no3: -1 };
export const ORDER = ["o2", "co2", "h2o", "glc", "na", "k", "prot"];
export const ORDER_PLANT = ["o2", "co2", "h2o", "suc", "h", "no3", "k", "prot"];
const START = { o2: [26, 2], co2: [3, 18], h2o: [16, 16], glc: [22, 2], na: [24, 16], k: [12, 22], prot: [2, 6] };
// Plant: apoplast is acidic (more H⁺ outside), K⁺ is accumulated inside, sucrose and nitrate are scarce inside.
const START_PLANT = { o2: [26, 2], co2: [3, 18], h2o: [16, 16], suc: [14, 2], h: [14, 3], no3: [14, 2], k: [14, 10], prot: [2, 6] };
/** Plant plasma membrane: one membrane potential unit (a "charge") is worth KV mV, and leaks away with time constant Q_TAU. */
export const KV = 16, Q_TAU = 40, Q_CAP = 4, RT_F = 26.7; // RT_F: RT/F in mV at 37 °C (the model uses this.rtf, which follows the temperature slider)
export const rtfAt = (T) => 0.08617333 * (T + 273.15);
const Q_MIN = -8, Q_MAX = 20;
/** Where bound particles sit inside a symporter (hoisted: no per-step allocation). */
const SYM_SLOTS = { 1: { cargo: [0, -4], h: [[-8, 5]] }, 2: { cargo: [0, -5], h: [[-9, 5], [9, 5]] } };
const SYM_KB = 3.5, SYM_KF = 4, SYM_KU = 6, SYM_KE = 1.5; // loading rate scale (1/s per (C/10)(H/10)^n), flip rate scale (1/s), unloading rate (same on both faces) and empty-flip rate
export const CAP = 300;
export const SIDE_CAP = 60;

export const PROT_DEF = [
  { id: "aqp", kind: "channel", name: "Aquaporin", short: "Aquaporin", tiny: "AQP", fx: 0.08, fxN: 0.07, color: "#38bdf8", sp: "h2o", p: 0.85, open: true, maxIn: 3, dur: 0.45 },
  { id: "kch", kind: "channel", name: "K⁺ leak channel", short: "K⁺ channel", tiny: "K⁺ ch", fx: 0.235, fxN: 0.2, color: "#a78bfa", sp: "k", p: 0.4, open: true, maxIn: 2, dur: 0.35 },
  { id: "glut", kind: "carrier", name: "GLUT carrier", short: "GLUT carrier", tiny: "GLUT", fx: 0.41, fxN: 0.355, color: "#4ade80" },
  { id: "pump", kind: "pump", name: "Na⁺/K⁺ pump", short: "Na⁺/K⁺ pump", tiny: "Na⁺/K⁺ pump", fx: 0.6, fxN: 0.53, color: "#2dd4bf" },
  { id: "nach", kind: "channel", name: "Na⁺ channel", short: "Na⁺ channel", tiny: "Na⁺ ch", fx: 0.775, fxN: 0.69, color: "#fb7185", sp: "na", p: 0.3, open: true, maxIn: 2, dur: 0.35 },
];

/** Plant plasma membrane. The P-type H⁺-ATPase (1 H⁺ per ATP) builds the proton gradient and the membrane potential;
 *  the symporters use that proton-motive force: 1 H⁺ per sucrose, 2 H⁺ per nitrate (n). K⁺ channels and aquaporins are the same. */
export const PROT_DEF_PLANT = [
  PROT_DEF[0], PROT_DEF[1],
  { id: "suc", kind: "symport", name: "H⁺–sucrose symporter", short: "H⁺–sucrose symporter", tiny: "H⁺/Suc", fx: 0.41, fxN: 0.355, color: "#a3e635", sp: "suc", n: 1 },
  { id: "hpump", kind: "pump", name: "H⁺-ATPase (proton pump)", short: "H⁺ pump (H⁺-ATPase)", tiny: "H⁺ pump", fx: 0.6, fxN: 0.53, color: "#2dd4bf" },
  { id: "nit", kind: "symport", name: "H⁺–nitrate symporter", short: "H⁺–nitrate symporter", tiny: "H⁺/NO₃⁻", fx: 0.775, fxN: 0.69, color: "#60a5fa", sp: "no3", n: 2 },
];

/** Water viscosity (Pa·s), Vogel equation. */
const visc = (T) => 2.414e-5 * Math.pow(10, 247.8 / (T + 273.15 - 140));
/** Diffusion coefficient relative to 37 °C (Stokes–Einstein: D ∝ T/η). */
export const diffFactor = (T) => ((T + 273.15) / 310.15) * (visc(37) / visc(T));
/** Protein turnover relative to 37 °C: Q10 = 2, then denaturation above ~42 °C. */
export function protFactor(T) {
  let f = Math.pow(2, (T - 37) / 10);
  if (T > 42) f *= clamp(1 - (T - 42) / 13, 0.05, 1);
  return Math.max(f, 0.04);
}

export function layout(w, h) {
  const sc = clamp(Math.min(w / 1000, h / 620), 0.62, 1.15);
  const palH = clamp(h * 0.1, 52, 64);
  const uh = h - palH;
  const th = clamp(Math.min(uh * 0.15, w * 0.085), 34, 66);
  const midY = uh / 2;
  const pw = clamp(w * 0.055, 30, 62);
  return {
    w, h, sc, palH, uh, th, midY, pw,
    memTop: midY - th / 2, memBot: midY + th / 2,
    headR: clamp(th * 0.12, 3.6, 7.2),
    protH: th * 1.5,
    vesR: th / 2 + clamp(16 * sc, 10, 20) + 4,
    vesX: Math.min(w * 0.925, w - (th / 2 + clamp(16 * sc, 10, 20) + 4) - th / 2 - 6),
    attractR: clamp(Math.min(w * 0.22, uh * 0.4), 90, 260),
  };
}

export class Model {
  /** mode: "animal" (Na⁺/K⁺-ATPase, GLUT) or "plant" (P-type H⁺-ATPase, H⁺-sucrose and H⁺-nitrate symport). */
  constructor(mode = "animal") {
    this.mode = mode === "plant" ? "plant" : "animal";
    this.plant = this.mode === "plant";
    this.order = this.plant ? ORDER_PLANT : ORDER;
    this.protDef = this.plant ? PROT_DEF_PLANT : PROT_DEF;
    this.start = this.plant ? START_PLANT : START;
    this.pumpId = this.plant ? "hpump" : "pump";
    this.L = null;
    this.temp = 37;
    this.atpProd = 0.6; // 0..1 of max respiration rate
    this.cyanide = false;
    this.atpMax = 20;
    this.reset();
  }

  reset() {
    this.time = 0;
    this.parts = [];
    this.nextId = 1;
    this.atp = 14;
    this.feeding = false;
    this.prot = this.protDef.map((d) => ({ ...d, x: this.L ? this.protX(d) : 0, openAnim: d.open ? 1 : 0, inTransit: 0, flash: 0 }));
    this.byId = Object.fromEntries(this.prot.map((p) => [p.id, p]));
    this.glut = { c: -1, target: -1, state: "open", cargo: null, blocked: false, dwell: 0, blockedTime: 0 };
    this.pump = { state: "E1", t: 0, c: 0, na: [], k: [], h: [], phos: false, waiting: false, fly: null, cycles: 0, flash: 0, blocked: false };
    // plant: one alternating-access symporter object per H⁺-coupled carrier (c: -1 faces outside, +1 faces inside)
    this.sym = {};
    if (this.plant) for (const d of this.protDef) if (d.kind === "symport") this.sym[d.id] = { id: d.id, sp: d.sp, n: d.n, c: -1, target: -1, state: "open", dwell: 0, cargo: null, h: [], blocked: false, blockedTime: 0 };
    this.q = this.plant ? 4 : 0;
    this.vmFixed = null; // tests / experiments can clamp the membrane potential (mV)
    this.rtf = rtfAt(this.temp);
    this.vmAvg = this.vm;
    this.symList = Object.values(this.sym);
    this.cn = {}; for (const k of Object.keys(SP)) this.cn[k] = { out: 0, in: 0 };
    this.site = { x: 0, y: 0 };
    // persistent attractors for the plant (reused every step: no per-step allocation)
    this.plantAtt = null; // net positive charge moved out (plant membrane potential); see vm
    this.hSrc = 0;
    this.ves = { phase: "none", mode: null, t: 0, cargo: [], pocket: null, vesicle: null };
    this.events = [];
    this.cross = {};
    for (const s of Object.keys(SP)) this.cross[s] = { in: 0, out: 0, glutIn: 0, glutOut: 0, lipid: 0 };
    this.fx = { floaters: [], sprites: [], flashes: [] };
    this.atpDots = [];
    this.inspect = null;
    this.dF = diffFactor(this.temp);
    this.kF = protFactor(this.temp);
    if (this.L) this.populate();
  }

  setSize(w, h) {
    const old = this.L;
    this.L = layout(w, h);
    for (const P of this.prot) P.x = this.protX(P);
    if (!old) { this.populate(); return; }
    const L = this.L;
    for (const p of this.parts) {
      p.x *= w / old.w;
      if (p.side === "out") p.y = (p.y / old.memTop) * L.memTop;
      else if (p.side === "in") p.y = L.memBot + ((p.y - old.memBot) / (old.uh - old.memBot)) * (L.uh - L.memBot);
      if (p.mode === "free") {
        const r = SP[p.sp].r * L.sc;
        const [y0, y1] = this.yRange(p.side, r);
        p.x = clamp(p.x, r, w - r); p.y = clamp(p.y, y0, y1);
      }
    }
    for (const d of this.atpDots) { d.x *= w / old.w; d.y = clamp(L.memBot + ((d.y - old.memBot) / (old.uh - old.memBot)) * (L.uh - L.memBot), L.memBot + 8, L.uh - 8); }
  }

  /** Proteins bunch up a little on narrower stages to leave room for the vesicle site. */
  protX(P) { return (this.L.w < 1000 ? P.fxN : P.fx) * this.L.w; }

  populate() {
    for (const s of this.order) {
      for (let i = 0; i < this.start[s][0]; i++) this.add(s, "out");
      for (let i = 0; i < this.start[s][1]; i++) this.add(s, "in");
    }
  }

  yRange(side, r) {
    const L = this.L;
    return side === "out" ? [r + 1, L.memTop - r - 1] : [L.memBot + r + 1, L.uh - r - 1];
  }

  vs(sp) { return 0.2 * this.L.uh * SP[sp].mob * Math.sqrt(this.dF); }

  /** Add one particle. Returns it, or null if a cap is reached. */
  add(sp, side, x, y) {
    if (this.parts.length >= CAP) return null;
    if (side !== "ves" && this.count(sp, side) >= SIDE_CAP) return null;
    const L = this.L, r = SP[sp].r * L.sc;
    let px = x ?? rand(r, L.w - r), py;
    if (side === "ves") py = y ?? L.midY;
    else {
      const [y0, y1] = this.yRange(side, r);
      py = clamp(y ?? rand(y0, y1), y0, y1);
      px = clamp(px, r, L.w - r);
    }
    const p = { id: this.nextId++, sp, side, x: px, y: py, vx: 0, vy: 0, mode: "free", rot: rand(0, TAU), vr: rand(-1.5, 1.5) };
    this.parts.push(p);
    return p;
  }

  /** Add n particles scattered around (x,y) on a side. Returns how many were added. */
  addCluster(sp, side, n, x, y) {
    let k = 0;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), d = rand(0, 26 * this.L.sc);
      if (this.add(sp, side, x == null ? undefined : x + Math.cos(a) * d, y == null ? undefined : y + Math.sin(a) * d)) k++;
    }
    return k;
  }

  count(sp, side) {
    let n = 0;
    for (const p of this.parts) if (p.sp === sp && p.side === side && !p.dead) n++;
    return n;
  }

  counts() {
    const c = {};
    for (const s of this.order) c[s] = { out: 0, in: 0 };
    for (const p of this.parts) if (!p.dead && (p.side === "out" || p.side === "in")) c[p.sp][p.side]++;
    return c;
  }

  /** Net flux into the cell (particles/s) over the last `win` seconds. Positive = inward. */
  flux(sp, win = 8) {
    let s = 0;
    const t0 = this.time - win;
    for (const e of this.events) if (e.sp === sp && e.t > t0) s += e.dir;
    return s / Math.max(1, Math.min(win, this.time));
  }

  rate(sp, via, win = 8) {
    let s = 0;
    const t0 = this.time - win;
    for (const e of this.events) if (e.sp === sp && e.via === via && e.t > t0) s += e.dir;
    return s / Math.max(1, Math.min(win, this.time));
  }

  /** Theoretical max GLUT turnover (glucose/s): loaded flip + dwell + empty flip back + empty dwell. */
  glutVmax() { return this.kF / 0.82; }

  record(sp, dir, via) {
    this.events.push({ t: this.time, sp, dir, via });
    const c = this.cross[sp];
    c[dir > 0 ? "in" : "out"]++;
    if (via === "glut") c[dir > 0 ? "glutIn" : "glutOut"]++;
    if (via === "lipid") c.lipid++;
    const P = this.byId[via];
    if (P) P.flash = 1;
    if (this.plant && CHARGE[sp] && !this.sym[via]) this.moveCharge(CHARGE[sp] * dir); // symport cycles apply their net charge once, in updateSym
  }

  /** Plant membrane potential (mV, inside relative to outside) and the proton gradient. */
  /** dq = net positive charge moved INTO the cell (elementary charges). Signed: inside-positive is possible under perturbation. */
  moveCharge(dq) { this.q = clamp(this.q - dq / Q_CAP, Q_MIN, Q_MAX); } // membrane capacitance: each charge moves the potential by KV/Q_CAP mV
  get vm() { return this.vmFixed ?? -KV * this.q; }
  get dpH() { return Math.log10((this.count("h", "out") + 0.5) / (this.count("h", "in") + 0.5)); }
  /** Proton-motive force in mV (negative = pulls H⁺ in): Δp = Vm − 59·ΔpH (59 mV per pH unit at 25 °C; ≈ 61 at 37 °C). */
  get pmf() { return this.vmAvg - this.rtf * Math.LN10 * this.dpH; }

  // ---------- controls ----------
  setChannel(id, open) {
    const P = this.byId[id];
    if (P) P.open = open;
  }
  setGlutBlocked(b) {
    const g = this.glut;
    g.blocked = b;
    g.blockedTime = 0;
    if (b && g.cargo) { // drop the bound glucose back where it came from
      const p = g.cargo; g.cargo = null;
      this.freeAt(p, p.from, this.byId.glut.x);
    }
  }
  feedATP(n) {
    this.atp = Math.min(this.atpMax, this.atp + n);
    const P = this.byId[this.pumpId], L = this.L;
    this.fx.flashes.push({ x: P.x, y: L.memBot + L.protH * 0.45, r: 40 * L.sc, t: 0, life: 0.5, color: "#fbbf24" });
  }

  // ---------- simulation ----------
  step(dt) {
    if (!this.L || dt <= 0) return;
    const n = Math.ceil(dt / (1 / 60));
    const h = dt / n;
    for (let i = 0; i < n; i++) this.stepOnce(h);
    if (this.parts.some((p) => p.dead)) this.parts = this.parts.filter((p) => !p.dead);
    const t0 = this.time - 12;
    if (this.events.length && this.events[0].t < t0) this.events = this.events.filter((e) => e.t >= t0);
  }

  stepOnce(dt) {
    this.time += dt;
    this.dF = diffFactor(this.temp);
    this.kF = protFactor(this.temp);
    if (!this.cyanide) this.atp += this.atpProd * 2.0 * dt;
    if (this.feeding) this.atp += 6 * dt;
    this.atp = Math.max(0, this.atp - 0.35 * dt); // the rest of the cell's work also uses ATP
    this.atp = Math.min(this.atp, this.atpMax);

    for (const P of this.prot) {
      if (P.kind === "channel") P.openAnim += ((P.open ? 1 : 0) - P.openAnim) * Math.min(1, dt * 8);
      P.flash = Math.max(0, P.flash - dt * 3);
    }
    this.buildAttractors();
    for (const p of this.parts) {
      if (p.dead) continue;
      if (p.mode === "free") this.moveFree(p, dt);
      else if (p.mode === "transit") this.moveTransit(p, dt);
    }
    if (this.plant) {
      this.q = clamp(this.q - (this.q / Q_TAU) * dt, Q_MIN, Q_MAX); // other ions leak: the potential decays unless the pump keeps up
      this.hSrc += dt;      // metabolism keeps making H⁺ in the (buffered) cytoplasm, so the pump never runs out of substrate
      if (this.hSrc >= 0.8) { this.hSrc = 0; if (this.count("h", "in") < 4) this.add("h", "in"); }
      this.vmAvg += (this.vm - this.vmAvg) * Math.min(1, dt / 1.2);
      this.rtf = rtfAt(this.temp);
      this.tallyFree();
      for (let i = 0; i < this.symList.length; i++) this.updateSym(this.symList[i], dt);
      this.updateHPump(dt);
    } else {
      this.updateGlut(dt);
      this.updatePump(dt);
    }
    this.updateVes(dt);
    this.updateAtpDots(dt);
    this.updateFx(dt);
    if (this.inspect && (this.time - this.inspect.t > 4 || this.inspect.p.dead)) this.inspect = null;
  }

  moveFree(p, dt) {
    const L = this.L, r = SP[p.sp].r * L.sc, vs = this.vs(p.sp), tau = 0.5;
    const sig = vs * Math.sqrt(2 / tau) * Math.sqrt(dt);
    p.vx += (-p.vx / tau) * dt + sig * gauss();
    p.vy += (-p.vy / tau) * dt + sig * gauss();
    this.attract(p, dt, r);
    if (p.mode !== "free") return;
    p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt * Math.sqrt(this.dF);
    if (p.x < r) { p.x = r; p.vx = Math.abs(p.vx); }
    if (p.x > L.w - r) { p.x = L.w - r; p.vx = -Math.abs(p.vx); }
    if (p.side === "out") {
      if (p.y < r) { p.y = r; p.vy = Math.abs(p.vy); }
      if (p.y > L.memTop - r) this.contact(p, "out", r);
    } else {
      if (p.y > L.uh - r) { p.y = L.uh - r; p.vy = -Math.abs(p.vy); }
      if (p.y < L.memBot + r) this.contact(p, "in", r);
      const c = this.ves.circle;
      if (c) { // keep cytoplasm particles out of the vesicle / pocket
        const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy) || 1, min = c.R + L.th / 2 + r;
        if (d < min) { p.x = c.x + (dx / d) * min; p.y = Math.max(c.y + (dy / d) * min, L.memBot + r); p.vx += (dx / d) * 30; p.vy += (dy / d) * 30; }
      }
    }
  }

  reflect(p, side, r) {
    const L = this.L;
    if (side === "out") { p.y = L.memTop - r; p.vy = -Math.abs(p.vy); }
    else { p.y = L.memBot + r; p.vy = Math.abs(p.vy); }
  }

  contact(p, side, r) {
    const L = this.L;
    for (const P of this.prot) {
      const half = P.kind === "pump" ? L.pw * 0.78 : P.kind === "carrier" || P.kind === "symport" ? L.pw * 0.62 : L.pw * 0.52;
      const dx = Math.abs(p.x - P.x);
      if (dx < half + r * 0.5) {
        if (P.kind === "channel" && dx < L.pw * 0.3 && this.tryChannel(P, p, side)) return;
        if (P.kind === "carrier" && dx < L.pw * 0.34 && this.tryGlut(p, side)) return;
        this.reflect(p, side, r);
        return;
      }
    }
    if (this.ves.pocket && Math.abs(p.x - this.ves.pocket.cx) < L.vesR * 2.2) { this.reflect(p, side, r); return; }
    const perm = SP[p.sp].lipid * this.dF * (this.plant ? this.driveFactor(p.sp, side) : 1); // H⁺ leak is voltage-dependent too
    if (perm > 0 && Math.random() < perm) { this.startTransit(p, side, "lipid", null); return; }
    this.reflect(p, side, r);
  }

  tryChannel(P, p, side) {
    if (p.cool > this.time) return false;
    if (!P.open || P.openAnim < 0.8 || p.sp !== P.sp || P.inTransit >= P.maxIn) return false;
    // plant: the membrane potential (inside negative) pulls K⁺ in and holds it there: probability × exp(∓Vm/2RT/F)
    // plant: equal baseline permeability both ways, scaled so forward/reverse acceptance has the Nernst ratio e^(z·Vm/RT_F)
    const f = this.plant ? this.driveFactor(p.sp, side) : 1;
    if (Math.random() > P.p * f) return false;
    this.startTransit(p, side, P.id, P);
    return true;
  }

  startTransit(p, side, via, P) {
    p.mode = "transit";
    if (P) P.inTransit++;
    const base = via === "lipid" ? (p.sp === "h2o" ? 1.1 : 0.6) : P.dur;
    p.tr = { via, from: side, t: 0, dur: base / Math.sqrt(this.dF), x0: p.x, x1: P ? P.x : p.x + rand(-6, 6) };
  }

  moveTransit(p, dt) {
    const L = this.L, tr = p.tr, r = SP[p.sp].r * L.sc;
    tr.t += dt / tr.dur;
    const t = Math.min(tr.t, 1);
    const yA = tr.from === "out" ? L.memTop - r : L.memBot + r;
    const yB = tr.from === "out" ? L.memBot + r : L.memTop - r;
    if (tr.via === "lipid") { p.x = lerp(tr.x0, tr.x1, t); p.y = lerp(yA, yB, ease(t)); }
    else { p.x = lerp(tr.x0, tr.x1, Math.min(1, t * 4)); p.y = lerp(yA, yB, t); }
    p.rot += dt * 2;
    if (tr.t >= 1) {
      const to = tr.from === "out" ? "in" : "out";
      const P = this.byId[tr.via];
      if (P) P.inTransit = Math.max(0, P.inTransit - 1);
      p.mode = "free"; p.side = to; p.y = yB;
      const vs = this.vs(p.sp);
      p.vy = (to === "in" ? 1 : -1) * vs * 0.9; p.vx = rand(-0.5, 0.5) * vs;
      p.cool = this.time + 0.8;
      this.record(p.sp, to === "in" ? 1 : -1, tr.via);
      p.tr = null;
    }
  }

  /** Put a particle back as free on a side, just off the membrane at x. */
  freeAt(p, side, x, kick = 1) {
    const L = this.L, r = SP[p.sp].r * L.sc, vs = this.vs(p.sp);
    p.mode = "free"; p.side = side; p.x = x;
    p.y = side === "in" ? L.memBot + r + 2 : L.memTop - r - 2;
    p.vy = (side === "in" ? 1 : -1) * vs * kick; p.vx = rand(-0.6, 0.6) * vs;
    p.cool = this.time + 0.8; // just released: drifts away before it can be grabbed again
  }

  // ---------- GLUT (uniporter, alternating access) ----------
  tryGlut(p, side) {
    const g = this.glut;
    if (g.blocked || g.cargo || g.state !== "open" || p.sp !== "glc" || p.cool > this.time) return false;
    if ((g.c < 0 ? "out" : "in") !== side) return false;
    g.cargo = p; p.mode = "bound"; p.from = side; p.bid = "glut"; g.dwell = 0;
    return true;
  }

  updateGlut(dt) {
    const g = this.glut, kF = this.kF, L = this.L, X = this.byId.glut.x;
    if (g.blocked) { g.blockedTime += dt; return; }
    if (g.state === "moving") {
      const spd = 2 / (0.2 / kF); // c-units per second: a full flip takes 0.2 s at 37 °C
      const d = g.target - g.c, s = Math.sign(d) * spd * dt;
      if (Math.abs(s) >= Math.abs(d)) {
        g.c = g.target; g.state = "open"; g.dwell = 0;
        if (g.cargo) {
          const p = g.cargo, side = g.c > 0 ? "in" : "out";
          g.cargo = null;
          this.freeAt(p, side, X);
          if (side !== p.from) this.record("glc", side === "in" ? 1 : -1, "glut");
        }
      } else g.c += s;
    } else {
      g.dwell += dt;
      // Loaded carrier flips after a short dwell; empty carrier flips back after a short wait.
      if (g.cargo ? g.dwell > 0.12 / kF : g.dwell > 0.1 / kF && Math.random() < 5 * kF * dt) {
        g.target = g.c < 0 ? 1 : -1; g.state = "moving";
      }
    }
    if (g.cargo) { const e = Math.min(1, dt * 14); g.cargo.x += (X - g.cargo.x) * e; g.cargo.y += (L.midY + g.c * L.th * 0.2 - g.cargo.y) * e; }
  }

  // ---------- Na⁺/K⁺-ATPase (simplified Post–Albers cycle) ----------
  /** Binding sites / channel vestibules gently draw nearby matching particles toward their mouth.
   *  (A time-compression device: it acts equally on both sides, so net flux still follows the gradient.) */
  buildAttractors() {
    const L = this.L, A = [], P = this.pump, g = this.glut, R = L.attractR, RP = L.w;
    if (this.plant) { this.buildAttractorsPlant(R, RP); return; }
    const X = this.byId.pump.x;
    if (P.state === "E1" && P.na.length < 3) A.push({ sp: "na", side: "in", x: X, y: L.memBot + 2, R: RP, s: 4.5, pump: true });
    if (P.state === "E2" && P.k.length < 2) A.push({ sp: "k", side: "out", x: X, y: L.memTop - 2, R: RP, s: 4.5, pump: true });
    if (!g.blocked && !g.cargo) { // draw glucose toward the side the empty carrier faces (or is turning to)
      const side = (g.state === "open" ? g.c : g.target) < 0 ? "out" : "in";
      A.push({ sp: "glc", side, x: this.byId.glut.x, y: side === "out" ? L.memTop : L.memBot, R: Math.max(R, L.w * 0.3), s: 4.5, glut: true });
    }
    for (const C of this.prot) {
      if (C.kind !== "channel" || !C.open) continue;
      A.push({ sp: C.sp, side: "out", x: C.x, y: L.memTop, R: R * 0.75, s: 2.2 });
      A.push({ sp: C.sp, side: "in", x: C.x, y: L.memBot, R: R * 0.75, s: 2.2 });
    }
    this.attractors = A;
  }

  attract(p, dt, r) {
    const L = this.L;
    if (p.cool > this.time) return;
    for (const a of this.attractors) {
      if (a.off || a.sp !== p.sp || a.side !== p.side) continue;
      const dx = a.x - p.x, dy = a.y - p.y, d = Math.hypot(dx, dy) || 1;
      if (d > a.R) continue;
      if (a.hp) { // plant H⁺ pump: pull inside H⁺ toward the cytoplasmic mouth
        const acc = a.s * this.vs(p.sp) * (0.35 + 0.65 * (1 - d / a.R)) * Math.sqrt(this.kF);
        p.vx += (dx / d) * acc * dt; p.vy += (dy / d) * acc * dt;
        if (d < r + 24 * L.sc && this.pump.h.length < 1 && !this.pump.blocked && this.pump.state === "E1") { p.mode = "bound"; p.from = "in"; p.bid = "hpump"; this.pump.h.push(p); a.R = 0; }
        return;
      }
      const acc = a.s * this.vs(p.sp) * (0.35 + 0.65 * (1 - d / a.R)) * (a.pump ? Math.sqrt(this.kF) : 1);
      p.vx += (dx / d) * acc * dt; p.vy += (dy / d) * acc * dt;
      if (a.glut && d < r + 30 * L.sc && this.tryGlut(p, p.side)) { a.R = 0; return; }
      if (a.pump && d < r + 24 * L.sc) {
        const P = this.pump, list = p.sp === "na" ? P.na : P.k;
        if (list.length >= (p.sp === "na" ? 3 : 2)) continue;
        p.mode = "bound"; p.from = p.side; p.bid = "pump";
        list.push(p);
        if (list.length >= (p.sp === "na" ? 3 : 2)) a.R = 0; // site full: stop attracting this frame
      }
      return;
    }
  }

  // ---------- plant: P-type H⁺-ATPase and H⁺-coupled symporters ----------
  /** Acceptance factor for a charged particle crossing from `side` (1 for the favoured direction, e^(−|zVm/RT_F|) against it).
   *  With equal baseline permeability both ways the forward/reverse ratio is exactly e^(z·Vm/RT_F): the Nernst relation. */
  driveFactor(sp, side) {
    const z = CHARGE[sp];
    if (!z) return 1;
    const dir = side === "out" ? 1 : -1; // +1 = entering the cell
    return Math.min(1, Math.exp(-dir * z * (this.vm / this.rtf)));
  }

  /** Free particles per side (one pass; used by the symporter rate laws). */
  tallyFree() {
    for (const k in this.cn) { this.cn[k].out = 0; this.cn[k].in = 0; }
    for (const p of this.parts) if (!p.dead && p.mode === "free" && (p.side === "out" || p.side === "in")) this.cn[p.sp][p.side]++;
  }

  buildAttractorsPlant(R, RP) {
    const L = this.L, P = this.pump;
    let A = this.plantAtt;
    if (!A) { // persistent objects, built once per layout
      A = this.plantAtt = [{ sp: "h", side: "in", hp: true, s: 4.5, x: 0, y: 0, R: 0, off: true }];
      for (const C of this.prot) if (C.kind === "channel") A.push({ sp: C.sp, side: "out", C, s: 2.2, x: 0, y: 0, R: 0, off: true }, { sp: C.sp, side: "in", C, s: 2.2, x: 0, y: 0, R: 0, off: true });
    }
    const h = A[0], X = this.byId.hpump.x;
    h.off = !(P.state === "E1" && P.h.length < 1 && !P.blocked); h.x = X; h.y = L.memBot + 2; h.R = RP;
    for (let i = 1; i < A.length; i++) { const a = A[i], C = a.C; a.off = !C.open; a.x = C.x; a.y = a.side === "out" ? L.memTop : L.memBot; a.R = R * 0.75; }
    this.attractors = A;
  }

  /** Mass-action loading rate of an empty symporter facing `side` (1/s): ∝ [cargo]·[H⁺]ⁿ, so detailed balance holds with the flip rates below. */
  symLoadRate(S, side) {
    const C = this.cn[S.sp][side], Hh = this.cn.h[side];
    if (C < 1 || Hh < S.n) return 0;
    return SYM_KB * this.kF * (C / 10) * Math.pow(Hh / 10, S.n);
  }
  /** Thermodynamic drive of one inward cycle, ΔG/F in mV (positive = uphill inward):
   *  RT/F·ln(Cin/Cout) + n·RT/F·ln(Hin/Hout) + (n + z_cargo)·Vm. Zero at equilibrium; its sign decides which way the carrier runs. */
  symDrive(S) {
    const cn = this.cn, e = 1e-6, zc = CHARGE[S.sp] || 0;
    return this.rtf * Math.log((cn[S.sp].in + e) / (cn[S.sp].out + e)) + S.n * this.rtf * Math.log((cn.h.in + e) / (cn.h.out + e)) + (S.n + zc) * this.vm;
  }
  /** Loaded-carrier flip rate (1/s) when facing `faces`: the electrical part of the cycle, with equal baseline in both directions. */
  symFlipRate(S, faces) {
    const q = (S.n + (CHARGE[S.sp] || 0)) * (this.vm / this.rtf), dirIn = faces === "out" ? 1 : -1;
    return SYM_KF * this.kF * Math.min(1, Math.exp(-dirIn * q));
  }

  /** Take the n nearest free H⁺ and the nearest free cargo on `side` into the carrier (all at once; they then ride inside it). */
  loadSym(S, side) {
    const X = this.byId[S.id].x, L = this.L;
    const cargoBest = this.nearestFree(S.sp, side, X, null), hs = S.h;
    if (!cargoBest) return false;
    cargoBest.mode = "bound"; cargoBest.from = side; cargoBest.bid = S.id; S.cargo = cargoBest;
    for (let k = 0; k < S.n; k++) {
      const h = this.nearestFree("h", side, X, null);
      if (!h) { this.unloadSym(S, 0.6); return false; }
      h.mode = "bound"; h.from = side; h.bid = S.id; hs.push(h);
    }
    S.dwell = 0;
    return true;
  }
  nearestFree(sp, side, x, skip) {
    let best = null, bd = Infinity;
    for (const p of this.parts) {
      if (p.dead || p.mode !== "free" || p.sp !== sp || p.side !== side) continue;
      const d = Math.abs(p.x - x);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  /** Release whatever the carrier holds onto the side it faces (the same rate on both faces). If that is not the side the particles were
   *  loaded from, the transport is complete: record it. */
  unloadSym(S, kick = 1) {
    const side = S.c < 0 ? "out" : "in", X = this.byId[S.id].x, sc = this.L.sc;
    if (!S.cargo) { S.h.length = 0; return; }
    const crossed = S.cargo.from !== side, dir = side === "in" ? 1 : -1, nH = S.h.length;
    this.freeAt(S.cargo, side, X - 9 * sc, kick); S.cargo = null;
    for (let i = 0; i < nH; i++) this.freeAt(S.h[i], side, X + i * 9 * sc, kick);
    S.h.length = 0;
    if (crossed) { this.record(S.sp, dir, S.id); for (let i = 0; i < nH; i++) this.record("h", dir, S.id); }
  }

  /** Block / unblock. Blocking a moving carrier cancels the flip (back to its starting endpoint, no charge moved); whatever it holds is released
   *  onto the side it now faces. */
  setSymBlocked(id, b) {
    const S = this.sym[id];
    if (!S) return;
    S.blocked = b; S.blockedTime = 0;
    if (!b) return;
    if (S.state === "moving") { S.c = -S.target; S.target = S.c; S.state = "open"; }
    S.dwell = 0;
    this.unloadSym(S, 0.8);
  }
  setPumpBlocked(b) {
    const P = this.pump;
    P.blocked = b;
    if (b && P.state === "E1" && P.h.length) { P.h.forEach((p) => this.freeAt(p, "in", this.byId.hpump.x, 0.8)); P.h.length = 0; }
  }

  /** One H⁺-coupled symporter (alternating access), fully reversible:
   *   empty:  loads n H⁺ + cargo from the face it faces at a mass-action rate; empty carriers flip symmetrically;
   *   loaded: unloads onto the face it faces (same rate on both faces) or flips (voltage-dependent ratio; the cycle's signed net charge moves
   *           at the flip). Cargo stays bound after a flip, so it can unload or flip back.
   *  Wegscheider: Lout·kf = Lin·kr, so the net flux is zero when symDrive() = 0 and reverses sign with it:
   *  [S]in/[S]out = ([H⁺]out/[H⁺]in)ⁿ · e^(−(n+z)Vm/(RT/F)). */
  updateSym(S, dt) {
    const kF = this.kF, L = this.L, X = this.byId[S.id].x;
    if (S.blocked) { S.blockedTime += dt; return; }
    if (S.state === "moving") {
      const spd = 2 / (0.2 / kF), d = S.target - S.c, st = Math.sign(d) * spd * dt;
      if (Math.abs(st) >= Math.abs(d)) {
        const loaded = !!S.cargo, dir = S.target > 0 ? 1 : -1;
        S.c = S.target; S.state = "open"; S.dwell = 0;
        if (loaded) this.moveCharge(dir * (S.n + (CHARGE[S.sp] || 0))); // signed net charge, once per loaded flip
      } else S.c += st;
    } else {
      S.dwell += dt;
      const faces = S.c < 0 ? "out" : "in", r = Math.random();
      if (S.cargo) {
        const pu = SYM_KU * kF * dt, pf = this.symFlipRate(S, faces) * dt;
        if (r < pu) this.unloadSym(S);
        else if (r < pu + pf) { S.target = S.c < 0 ? 1 : -1; S.state = "moving"; }
      } else {
        const pl = this.symLoadRate(S, faces) * dt, pe = SYM_KE * kF * dt;
        if (r < pl) this.loadSym(S, faces);
        else if (r < pl + pe) { S.target = S.c < 0 ? 1 : -1; S.state = "moving"; }
      }
    }
    // bound particles ride inside the carrier
    const y = L.midY + S.c * L.th * 0.2, s = L.sc, e = Math.min(1, dt * 12), slots = SYM_SLOTS[S.n];
    if (S.cargo) { S.cargo.x += (X + slots.cargo[0] * s - S.cargo.x) * e; S.cargo.y += (y + slots.cargo[1] * s - S.cargo.y) * e; }
    for (let i = 0; i < S.h.length; i++) { const p = S.h[i]; p.x += (X + slots.h[i][0] * s - p.x) * e; p.y += (y + slots.h[i][1] * s - p.y) * e; }
  }

  /** P-type H⁺-ATPase: bind H⁺ inside → ATP phosphorylates the pump (E1~P) → shape change releases H⁺ outside (E2-P) → Pᵢ leaves → resets.
   *  One H⁺ per ATP; the pump is electrogenic (moves + charge out, so the inside becomes negative). */
  updateHPump(dt) {
    const P = this.pump, kF = this.kF, L = this.L, X = this.byId.hpump.x;
    const site = this.site; site.x = X + L.pw * 0.32; site.y = L.memBot + L.protH * 0.42;
    P.flash = Math.max(0, P.flash - dt * 2);
    P.waiting = false;
    switch (P.state) {
      case "E1":
        P.c = Math.max(0, P.c - dt * 4);
        if (P.blocked) break;
        if (P.h.length >= 1) {
          if (this.atp >= 1) { this.atp -= 1; P.state = "atp"; P.t = 0; P.fly = { from: this.takeAtpDot(), to: { x: site.x, y: site.y }, t: 0 }; }
          else P.waiting = true;
        }
        break;
      case "atp":
        P.t += (dt * kF) / 0.18; P.fly.t = Math.min(1, P.t);
        if (P.t >= 1) {
          P.phos = true; P.state = "toE2"; P.t = 0; P.fly = null; P.flash = 1;
          this.fx.flashes.push({ x: site.x, y: site.y, r: 60 * L.sc, t: 0, life: 0.7, color: "#fbbf24" });
          this.fx.floaters.push({ text: "ATP → ADP + Pᵢ", x: X, y: L.memBot + L.protH * 0.95, t: 0, life: 1.8, color: "#fbbf24" });
          this.fx.sprites.push({ kind: "ADP", x: site.x, y: site.y, vx: rand(45, 70) * L.sc, vy: rand(25, 45) * L.sc, t: 0, life: 2.2 });
        }
        break;
      case "toE2":
        P.t += (dt * kF) / 0.25; P.c = ease(Math.min(1, P.t));
        if (P.t >= 1) {
          const full = this.count("h", "out") >= SIDE_CAP; // the cell wall space is buffered / drains: don't overfill the stage
          P.h.forEach((p, i) => { this.freeAt(p, "out", X + (i - 0.5) * 9 * L.sc, 1.3); this.record("h", -1, "hpump"); if (full) p.dead = true; });
          P.h = []; P.state = "dephos"; P.t = 0;
          this.fx.floaters.push({ text: "H⁺ out", x: X + L.pw * 1.6, y: L.memTop - L.protH * 0.3, t: 0, life: 1.4, color: SP.h.color });
        }
        break;
      case "dephos":
        P.c = 1;
        P.t += (dt * kF) / 0.15;
        if (P.t >= 1) {
          P.phos = false; P.state = "toE1"; P.t = 0;
          this.fx.sprites.push({ kind: "Pᵢ", x: site.x, y: site.y, vx: rand(-40, -15) * L.sc, vy: rand(15, 35) * L.sc, t: 0, life: 2 });
        }
        break;
      case "toE1":
        P.t += (dt * kF) / 0.25; P.c = 1 - ease(Math.min(1, P.t));
        if (P.t >= 1) { P.state = "E1"; P.t = 0; P.cycles++; }
        break;
    }
    const y = L.midY + lerp(L.th * 0.2, -L.th * 0.2, P.c), e = Math.min(1, dt * 12);
    P.h.forEach((p) => { p.x += (X + 0 - p.x) * e; p.y += (y + 3 * L.sc - p.y) * e; });
  }

  takeAtpDot() {
    const X = this.byId[this.pumpId].x, L = this.L;
    let best = -1, bd = Infinity;
    this.atpDots.forEach((d, i) => { const dd = Math.hypot(d.x - X, d.y - L.memBot); if (dd < bd) { bd = dd; best = i; } });
    if (best < 0) return { x: X + rand(-60, 60), y: L.uh - 10 };
    const d = this.atpDots.splice(best, 1)[0];
    return { x: d.x, y: d.y };
  }

  updatePump(dt) {
    const P = this.pump, kF = this.kF, L = this.L, X = this.byId.pump.x;
    const site = { x: X + L.pw * 0.32, y: L.memBot + L.protH * 0.42 };
    P.flash = Math.max(0, P.flash - dt * 2);
    P.waiting = false;
    switch (P.state) {
      case "E1":
        P.c = Math.max(0, P.c - dt * 4);
        if (P.na.length >= 3) {
          if (this.atp >= 1) { this.atp -= 1; P.state = "atp"; P.t = 0; P.fly = { from: this.takeAtpDot(), to: site, t: 0 }; }
          else P.waiting = true;
        }
        break;
      case "atp":
        P.t += (dt * kF) / 0.4; P.fly.t = Math.min(1, P.t);
        if (P.t >= 1) {
          P.phos = true; P.state = "toE2"; P.t = 0; P.fly = null; P.flash = 1;
          this.fx.flashes.push({ x: site.x, y: site.y, r: 60 * L.sc, t: 0, life: 0.7, color: "#fbbf24" });
          this.fx.floaters.push({ text: "ATP → ADP + Pᵢ", x: X, y: L.memBot + L.protH * 0.95, t: 0, life: 1.8, color: "#fbbf24" });
          this.fx.sprites.push({ kind: "ADP", x: site.x, y: site.y, vx: rand(45, 70) * L.sc, vy: rand(25, 45) * L.sc, t: 0, life: 2.2 });
        }
        break;
      case "toE2":
        P.t += (dt * kF) / 0.5; P.c = ease(Math.min(1, P.t));
        if (P.t >= 1) {
          P.na.forEach((p, i) => { this.freeAt(p, "out", X + (i - 1) * 9 * L.sc, 1.3); this.record("na", -1, "pump"); });
          P.na = []; P.state = "E2"; P.t = 0;
          this.fx.floaters.push({ text: "3 Na⁺ out", x: X + L.pw * 1.6, y: L.memTop - L.protH * 0.3, t: 0, life: 1.4, color: SP.na.color });
        }
        break;
      case "E2":
        P.c = 1;
        if (P.k.length >= 2) { P.state = "dephos"; P.t = 0; }
        break;
      case "dephos":
        P.t += (dt * kF) / 0.3;
        if (P.t >= 1) {
          P.phos = false; P.state = "toE1"; P.t = 0;
          this.fx.sprites.push({ kind: "Pᵢ", x: site.x, y: site.y, vx: rand(-40, -15) * L.sc, vy: rand(15, 35) * L.sc, t: 0, life: 2 });
        }
        break;
      case "toE1":
        P.t += (dt * kF) / 0.5; P.c = 1 - ease(Math.min(1, P.t));
        if (P.t >= 1) {
          P.k.forEach((p, i) => { this.freeAt(p, "in", X + (i - 0.5) * 10 * L.sc, 1.3); this.record("k", 1, "pump"); });
          P.k = []; P.state = "E1"; P.t = 0; P.cycles++;
          this.fx.floaters.push({ text: "2 K⁺ in", x: X - L.pw * 1.6, y: L.memBot + L.protH * 0.5, t: 0, life: 1.4, color: SP.k.color });
        }
        break;
    }
    // bound ion positions inside the pump
    const y = L.midY + lerp(L.th * 0.2, -L.th * 0.2, P.c), s = L.sc;
    const naSlots = [[-6, 3], [6, 3], [0, -6]], kSlots = [[-5, 0], [5, 0]];
    const e = Math.min(1, dt * 12);
    P.na.forEach((p, i) => { p.x += (X + naSlots[i][0] * s - p.x) * e; p.y += (y + naSlots[i][1] * s - p.y) * e; });
    P.k.forEach((p, i) => { p.x += (X + kSlots[i][0] * s - p.x) * e; p.y += (y + kSlots[i][1] * s - p.y) * e; });
  }

  pumpStatus() {
    const P = this.pump;
    if (this.plant) {
      if (P.blocked) return "blocked (vanadate)";
      switch (P.state) {
        case "E1": return P.waiting ? "H⁺ bound · waiting for ATP" : "binding H⁺";
        case "atp": return "ATP binding";
        case "toE2": return "phosphorylated · changing shape";
        case "dephos": return "releasing phosphate";
        case "toE1": return "flipping back";
      }
      return "";
    }
    switch (P.state) {
      case "E1": return P.waiting ? "3 Na⁺ bound · waiting for ATP" : `binding Na⁺ (${P.na.length}/3)`;
      case "atp": return "ATP binding";
      case "toE2": return "phosphorylated · changing shape";
      case "E2": return `binding K⁺ (${P.k.length}/2)`;
      case "dephos": return "releasing phosphate";
      case "toE1": return "flipping back";
    }
    return "";
  }

  // ---------- vesicles ----------
  startVesicle(mode) {
    const V = this.ves, L = this.L;
    if (V.phase !== "none") return "busy";
    if (this.atp < 1) return "noatp";
    const R = L.vesR, lumen = Math.max(4, R - L.th / 2 - SP.prot.r * L.sc);
    const off = () => { const a = rand(0, TAU), d = rand(0, lumen * 0.7); return { ox: Math.cos(a) * d, oy: Math.sin(a) * d }; };
    if (mode === "endo") {
      let cand = this.parts.filter((p) => p.mode === "free" && p.side === "out" && p.sp === "prot");
      if (!cand.length) cand = this.parts.filter((p) => p.mode === "free" && p.side === "out");
      cand.sort((a, b) => Math.hypot(a.x - L.vesX, a.y - L.memTop) - Math.hypot(b.x - L.vesX, b.y - L.memTop));
      const n = lumen > 10 * L.sc ? 3 : 2;
      V.cargo = cand.slice(0, n);
      for (const p of V.cargo) { p.mode = "ves"; p.vsx = p.x; p.vsy = p.y; Object.assign(p, off()); }
      V.phase = "dip";
    } else {
      if (this.parts.length > CAP - 3) return "full";
      V.cargo = [];
      const n = lumen > 10 * L.sc ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const p = this.add("prot", "ves", L.vesX, L.uh - R - 4);
        if (p) { p.mode = "ves"; Object.assign(p, off()); V.cargo.push(p); }
      }
      V.vesicle = { x: L.vesX, y: Math.max(L.uh - R - 4, L.midY + R + 4), R, a: 0 };
      V.y0 = V.vesicle.y;
      V.phase = "come";
    }
    this.atp -= 1;
    V.mode = mode; V.t = 0;
    return "ok";
  }

  updateVes(dt) {
    const V = this.ves, L = this.L, R = L.vesR, cx = L.vesX;
    V.circle = null;
    if (V.phase === "none") return;
    const k = Math.max(0.25, Math.min(1.5, this.kF));
    const G0 = 0.14, cyFor = (g, kk) => L.midY + R * Math.cos(g) * kk;
    const adv = (dur) => { V.t += (dt * k) / dur; return V.t >= 1; };
    if (V.phase === "dip") {
      const done = adv(1.2);
      V.pocket = { cx, R, g: Math.PI / 2, k: ease(Math.min(1, V.t)) };
      this.moveCargoIn(V, Math.min(1, V.t) * 0.5);
      if (done) { V.phase = "close"; V.t = 0; }
    } else if (V.phase === "close") {
      const done = adv(1.3);
      V.pocket = { cx, R, g: lerp(Math.PI / 2, G0, ease(Math.min(1, V.t))), k: 1 };
      this.moveCargoIn(V, 0.5 + Math.min(1, V.t) * 0.5);
      if (done) {
        V.pocket = null; V.phase = "away"; V.t = 0;
        V.vesicle = { x: cx, y: cyFor(G0, 1), R, a: 1 }; V.y0 = V.vesicle.y;
        for (const p of V.cargo) p.side = "ves";
        this.fx.floaters.push({ text: "Vesicle pinches off", x: cx, y: L.memBot + R * 2.4, t: 0, life: 1.8, color: "#f472b6" });
      }
    } else if (V.phase === "away") {
      const done = adv(3);
      const t = Math.min(1, V.t);
      V.vesicle.y = lerp(V.y0, Math.max(V.y0 + 10, L.uh - R - 6), ease(t));
      V.vesicle.a = t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1;
      for (const p of V.cargo) { p.x = V.vesicle.x + p.ox; p.y = V.vesicle.y + p.oy; }
      if (done) { for (const p of V.cargo) p.dead = true; this.endVes(); }
    } else if (V.phase === "come") {
      const done = adv(2);
      const t = Math.min(1, V.t);
      V.vesicle.a = Math.min(1, t * 4);
      V.vesicle.y = lerp(V.y0, cyFor(G0, 1), ease(t));
      for (const p of V.cargo) { p.x = V.vesicle.x + p.ox; p.y = V.vesicle.y + p.oy; }
      if (done) { V.vesicle = null; V.phase = "open"; V.t = 0; this.fx.floaters.push({ text: "Vesicle fuses", x: cx, y: L.memTop - R * 1.2, t: 0, life: 1.6, color: "#f472b6" }); }
    } else if (V.phase === "open") {
      const done = adv(1.5);
      const t = Math.min(1, V.t), g = lerp(G0, Math.PI / 2, ease(t));
      V.pocket = { cx, R, g, k: 1 };
      const u = ease(clamp((t - 0.3) / 0.7, 0, 1));
      for (const p of V.cargo) {
        const r = SP[p.sp].r * L.sc;
        p.x = cx + p.ox; p.y = lerp(cyFor(g, 1) + p.oy, L.memTop - r - 3, u);
      }
      if (done) {
        for (const p of V.cargo) { this.freeAt(p, "out", p.x, 0.8); this.record("prot", -1, "vesicle"); }
        V.cargo = []; V.phase = "flat"; V.t = 0;
      }
    } else if (V.phase === "flat") {
      const done = adv(1);
      V.pocket = { cx, R, g: Math.PI / 2, k: 1 - ease(Math.min(1, V.t)) };
      if (done) this.endVes();
    }
    if (V.pocket && V.pocket.k > 0.3) V.circle = { x: cx, y: cyFor(V.pocket.g, V.pocket.k), R: R * V.pocket.k };
    else if (V.vesicle) V.circle = { x: V.vesicle.x, y: V.vesicle.y, R };
  }

  moveCargoIn(V, u) {
    const L = this.L, pk = V.pocket;
    const cy = L.midY + pk.R * Math.cos(pk.g) * pk.k;
    const e = ease(clamp(u, 0, 1));
    for (const p of V.cargo) { p.x = lerp(p.vsx, pk.cx + p.ox, e); p.y = lerp(p.vsy, cy + p.oy * pk.k, e); }
  }

  endVes() {
    const V = this.ves;
    if (V.mode === "endo") for (const p of V.cargo) p.dead = true;
    V.phase = "none"; V.mode = null; V.t = 0; V.cargo = []; V.pocket = null; V.vesicle = null; V.circle = null;
  }

  /** Mid-line of the plasma membrane as a polyline [[x,y],...] (includes the vesicle pocket). */
  membraneLine() {
    const L = this.L, pk = this.ves.pocket;
    if (!pk || pk.k < 0.01) return [[0, L.midY], [L.w, L.midY]];
    const { cx, R, g, k } = pk;
    const cy = L.midY + R * Math.cos(g);
    const pts = [[0, L.midY], [cx - R * 2.2, L.midY], [cx - R * Math.sin(g) - R * 0.45, L.midY]];
    const a0 = -Math.PI / 2 - g, sweep = TAU - 2 * g, N = 28;
    for (let i = 0; i <= N; i++) {
      const a = a0 - (sweep * i) / N;
      pts.push([cx + R * Math.cos(a), L.midY + (cy + R * Math.sin(a) - L.midY) * k]);
    }
    pts.push([cx + R * Math.sin(g) + R * 0.45, L.midY], [cx + R * 2.2, L.midY], [L.w, L.midY]);
    return chaikin(chaikin(pts));
  }

  // ---------- visuals that live in the model ----------
  updateAtpDots(dt) {
    const L = this.L, want = Math.min(12, Math.floor(this.atp));
    while (this.atpDots.length < want) this.atpDots.push({ x: rand(20, L.w - 20), y: rand(L.memBot + 30, L.uh - 12), vx: 0, vy: 0, a: 0, rot: rand(0, TAU) });
    while (this.atpDots.length > want) this.atpDots.pop();
    for (const d of this.atpDots) {
      d.a = Math.min(1, d.a + dt * 2);
      d.vx += (-d.vx / 0.5) * dt + 30 * L.sc * Math.sqrt(dt) * gauss();
      d.vy += (-d.vy / 0.5) * dt + 30 * L.sc * Math.sqrt(dt) * gauss();
      d.x = clamp(d.x + d.vx * dt, 14, L.w - 14);
      d.y = clamp(d.y + d.vy * dt, L.memBot + 22, L.uh - 10);
      d.rot += dt * 0.8;
    }
  }

  updateFx(dt) {
    const F = this.fx;
    for (const f of F.floaters) { f.t += dt / f.life; f.y -= 14 * dt; }
    for (const s of F.sprites) { s.t += dt / s.life; s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.98; s.vy *= 0.98; }
    for (const f of F.flashes) f.t += dt / f.life;
    F.floaters = F.floaters.filter((f) => f.t < 1);
    F.sprites = F.sprites.filter((f) => f.t < 1);
    F.flashes = F.flashes.filter((f) => f.t < 1);
  }
}

function chaikin(pts) {
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    out.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}
