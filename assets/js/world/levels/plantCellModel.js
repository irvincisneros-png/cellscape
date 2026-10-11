// A whole-cell "economy" for a leaf cell: how organelles depend on each other.
// No DOM — testable with node. Units are relative (a full store = 100).
//
//  light + CO₂ + H₂O ──chloroplasts──▶ glucose + O₂
//  glucose + O₂ ──mitochondria──▶ ATP + CO₂ + H₂O          (glycolysis in cytoplasm gives a little ATP without O₂)
//  ATP powers: membrane pumps (keep ions in → water in → turgor), the nucleus (making mRNA),
//              ribosomes on the rough ER (making proteins), Golgi + vesicles (shipping proteins to the wall)
//  DNA ─nucleus─▶ mRNA ─nuclear pore─▶ ribosomes on the rough ER ─▶ secreted protein ─▶ Golgi ─▶ vesicle ─▶ membrane
//  (simplified: only the secretory route is modelled; free cytosolic ribosomes make many other proteins)
//  Water: the vacuole gains water while its water potential is lower than the surroundings; turgor pressure
//  builds until the two balance. Pumps hold solutes in; a salty outside solution pulls water out.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sat = (x, k) => (x <= 0 ? 0 : x / (x + k));

// Leaf types (teaching-scale numbers, not measurements). A sun leaf has a thicker palisade layer, so more
// chloroplasts per unit leaf area and more enzyme (Rubisco) per chloroplast: a high ceiling, but it needs bright light to
// reach it (high half-saturation K) and costs more ATP to maintain (higher respiration). A shade leaf has fewer
// chloroplasts but bigger grana and more chlorophyll in each, so it uses dim light well (low K) and its upkeep
// is cheap (lower respiration), but it tops out early. "generic" is the original all-purpose leaf cell.
//   photosynthesis max = n × perChl. n is an ILLUSTRATIVE capacity multiplier: sun leaves really have more photosynthetic
//   capacity per unit of leaf area (thicker palisade, more chloroplasts per area); it is not a count of chloroplasts per cell.
export const LEAVES = {
  generic: { name: "Typical leaf cell", n: 1, perChl: 9, K: 35, upkeep: 0.6 },
  sun: { name: "Sun leaf", n: 1.3, perChl: 9.5, K: 60, upkeep: 1.8 },
  shade: { name: "Shade leaf", n: 0.8, perChl: 8.5, K: 14, upkeep: 0.35 },
};

export const PARTS = ["chloroplast", "mitochondrion", "nucleus", "pores", "er", "golgi", "pumps", "aquaporins"];

export class PlantCellModel {
  constructor() { this.reset(); }

  reset() {
    this.light = 70;        // % of full sun
    this.co2Out = 50;       // CO₂ available outside (% of normal × 50)
    this.outside = 0;       // solutes in the surrounding solution (0 = pure water, 100 = very salty)
    this.on = Object.fromEntries(PARTS.map((p) => [p, true]));
    this.glucose = 55; this.o2 = 40; this.co2 = 35; this.atp = 70;
    this.mrna = 20; this.mrnaCyto = 15; this.erProtein = 15; this.golgiProtein = 10;
    this.turgor = 90;       // % — vacuole full and pressing on the wall
    this.starch = 60;       // starch grains in the chloroplasts (glucose store, 0–100)
    this.ions = 80;         // solute held inside by pumps (drives water uptake)
    this.secreted = 0;      // secretory cargo (proteins, wall matrix) delivered to the membrane
    this.leaf = "generic";  // "generic" (original cell) | "sun" | "shade"
    this.heat = 0;          // hot, dry air (0 = mild and humid, 100 = very hot and dry); guard cells close the stomata
    this.stomata = 1;       // how open the stomata are (1 = fully open, 0 = shut): gates CO₂ entry
    this.auto = false;      // true: light follows a 24 h day; false: light is whatever the slider says
    this.peak = 85;         // light at noon in the 24 h day (% of full sun)
    this.hour = 9;          // time of day, 0–24 h
    this.dayLen = 120;      // simulation seconds per 24 h
    this.time = 0;
    this.flux = {};
    this.history = [];
    this.histT = 0;
  }

  step(dt) {
    const n = Math.max(1, Math.ceil(dt / 0.05));
    for (let i = 0; i < n; i++) this.stepOnce(dt / n);
  }

  /** Sunlight (% of full sun) at a time of day: zero from sunset to sunrise (06:00–18:00 daylight), a smooth sine hump between. */
  static daylight(hour, peak) {
    const x = Math.sin(Math.PI * (hour - 6) / 12);
    return x > 0 ? peak * x : 0;
  }

  stepOnce(dt) {
    const on = this.on, F = {};
    const lf = LEAVES[this.leaf] || LEAVES.generic;
    this.time += dt;
    if (this.auto) {
      this.hour = (this.hour + dt * 24 / this.dayLen) % 24;
      this.light = PlantCellModel.daylight(this.hour, this.peak);
    }
    const water = clamp(this.turgor / 60, 0.2, 1);            // wilting cells close stomata / lack water

    // stomata: guard cells close in hot, dry air (fast but not instant), which also saves water
    const stomTarget = clamp(1 - (this.heat - 40) / 40, 0.05, 1);
    this.stomata += (stomTarget - this.stomata) * (1 - Math.exp(-dt / 1.5));
    const open = this.stomata;

    // photosynthesis (chloroplasts): light & CO₂ limited; CO₂ reaches the cell only through open stomata
    F.photo = on.chloroplast ? lf.n * lf.perChl * sat(this.light, lf.K) * sat(this.co2 + this.co2Out * 0.6 * open, 30) * water : 0;
    // aerobic respiration (mitochondria): needs glucose + O₂, slows when ATP is already high (demand-led)
    const demand = clamp((100 - this.atp) / 60, 0.08, 1);
    F.resp = on.mitochondrion ? 7 * sat(this.glucose, 10) * sat(this.o2, 6) * demand : 0;
    // glycolysis/fermentation keeps a trickle of ATP without mitochondria or O₂
    F.ferment = 0.9 * sat(this.glucose, 10) * demand * (on.mitochondrion && this.o2 > 3 ? 0.15 : 1);

    // ATP consumers
    const atpOK = sat(this.atp, 12);
    F.pump = on.pumps ? 2.2 * atpOK : 0;
    F.transcribe = on.nucleus ? 1.4 * atpOK : 0;
    F.export = on.pores ? 1.2 * sat(this.mrna, 8) : 0;   // already-made mRNA still leaves if the pores are open
    F.translate = on.er ? 1.6 * sat(this.mrnaCyto, 10) * atpOK : 0;
    F.toGolgi = on.golgi ? 1.3 * sat(this.erProtein, 10) * atpOK : 0;
    F.secrete = on.golgi ? 1.0 * sat(this.golgiProtein, 8) * atpOK : 0;
    F.upkeep = lf.upkeep;                                         // everything else the cell does

    // gas exchange with the air spaces in the leaf (diffusion toward outside levels)
    F.o2Out = (this.o2 - 25) * 0.18;                           // + = O₂ leaving the cell
    F.co2In = (this.co2Out * 0.7 - this.co2) * 0.15 * open;              // + = CO₂ entering

    // water: pumps hold solutes in; water moves toward the lower water potential until turgor
    // pressure balances the solute difference (net flow then stops even though solutes still differ)
    const ionTarget = F.pump > 0 ? 100 * sat(F.pump, 0.4) : 10;
    this.ions += (ionTarget - this.ions) * 0.05 * dt;
    const turgorTarget = clamp(this.ions * 1.1 - this.outside * 1.3, 0, 100);
    F.water = (turgorTarget - this.turgor) * (on.aquaporins ? 0.12 : 0.02);

    // starch: chloroplasts store spare glucose as starch by day and break it down when glucose runs low
    F.store = this.glucose > 60 && on.chloroplast ? (this.glucose - 60) * 0.08 : 0;
    F.mobilise = this.glucose < 35 && this.starch > 0 ? Math.min(this.starch, (35 - this.glucose) * 0.05) : 0;
    this.starch = clamp(this.starch + (F.store - F.mobilise) * 0.25 * dt, 0, 100);

    // update pools
    this.glucose += (F.photo / 6 * 1.2 - F.resp / 6 * 1.2 - F.ferment * 0.25 - F.store + F.mobilise) * dt;
    this.o2 += (F.photo - F.resp - F.o2Out) * dt;
    this.co2 += (F.resp - F.photo + F.co2In) * dt;
    this.atp += (F.resp * 4.2 + F.ferment * 1.0 - F.pump - F.transcribe * 0.8 - F.translate * 1.2 - F.toGolgi * 0.5 - F.secrete * 0.5 - F.upkeep) * dt;
    this.mrna += (F.transcribe - F.export - this.mrna * 0.01) * dt;           // in the nucleus
    this.mrnaCyto += (F.export - this.mrnaCyto * 0.03) * dt;   // mRNA is a reusable template: it is lost only by decay
    this.erProtein += (F.translate - F.toGolgi) * dt;
    this.golgiProtein += (F.toGolgi - F.secrete) * dt;
    this.secreted += F.secrete * dt * 0.2;
    this.turgor += F.water * dt;

    for (const k of ["glucose", "o2", "co2", "atp", "mrna", "mrnaCyto", "erProtein", "golgiProtein", "turgor"]) this[k] = clamp(this[k], 0, 100);
    F.net = F.photo - F.resp;                                   // net O₂ made (+) or used (−) by the cell's own chemistry
    this.flux = F;

    this.histT += dt;
    if (this.histT >= 0.5) {
      this.histT = 0;
      this.history.push({ t: this.time, atp: this.atp, glucose: this.glucose, o2: this.o2, turgor: this.turgor, starch: this.starch });
      if (this.history.length > 240) this.history.shift();
    }
  }

  /** Sugar store as one number (0–100): glucose plus starch in glucose equivalents (the model packs 1 glucose into 0.25 starch). */
  get sugar() { return (this.glucose + 4 * this.starch) / 5; }

  /** Plain-language status for each organelle (what it's doing right now and why). */
  status() {
    const F = this.flux, on = this.on, s = {};
    s.chloroplast = !on.chloroplast ? "switched off" : F.photo < 0.6 ? (this.light < 5 ? "idle — no light" : "slow") : "making glucose + O₂";
    s.mitochondrion = !on.mitochondrion ? "switched off" : F.resp < 0.4 ? (this.glucose < 3 ? "starved of glucose" : this.o2 < 3 ? "no O₂" : "resting (ATP is high)") : "making ATP";
    s.nucleus = !on.nucleus ? "transcription off" : this.atp < 5 ? "stalled — no ATP" : "copying genes into mRNA";
    s.er = !on.er ? "switched off" : F.translate < 0.3 ? (!on.pores || this.mrnaCyto < 3 ? "waiting — no mRNA arriving" : "slow") : "ribosomes making proteins";
    s.golgi = !on.golgi ? "switched off" : F.secrete < 0.2 ? "little to ship" : "packaging + shipping proteins";
    s.vacuole = this.turgor > 75 ? "full — cell is turgid" : this.turgor > 40 ? (F.water < -0.2 ? "losing water" : "partly full") : F.water < -0.2 ? "losing water — cell going flaccid" : "shrunk — cell is flaccid";
    s.pumps = !on.pumps ? "switched off" : this.atp < 5 ? "stopped — no ATP" : "pumping ions in";
    return s;
  }
}

// ---------------------------------------------------------------------------------------------
// LeafLab: watches the model (never changes it) and records what the cell actually did, so the leaf missions
// and the 24 h chart are driven by real fluxes, not scripts. No DOM — testable with node.
//  • compensation point: a leaf type held at steady light where net O₂ exchange ≈ 0 (photosynthesis = respiration)
//  • low/high light comparison: net O₂ at steady dim light and at steady full sun; a reading is stored with its light and
//    its whole environment (CO₂, heat, salt, every organelle switch) and sun is only compared with shade under matched conditions
//  • 24 h cycle: with the day cycle on and nothing else changed, did the sugar store end the day no lower than it started?
// A reading counts as steady only after the settings have been unchanged for `settle` seconds AND net O₂ stayed within
// `drift` over the last half of that time (a sliding window, so a slow settle simply takes a little longer).
export const LAB = { settle: 16, drift: 0.1, tol: 0.25, lowMin: 10, lowMax: 20, highMin: 90, matchLight: 1.01, slots: 96, cycleHours: 24 };

export class LeafLab {
  constructor(m) { this.m = m; this.reset(); }

  reset() {
    this.comp = { sun: null, shade: null };    // light (%) at which each leaf type was seen balanced
    this.obs = { low: new Map(), high: new Map() };   // env key -> { sun: {light, net}, shade: {light, net} }
    this.hold = 0; this.key = ""; this.anchor = 0;
    this.ring = new Float32Array(32); this.ringN = 0; this.ringT = 0;   // net O₂ sampled every 0.5 s while the settings hold still
    this.cycle = null;                         // the 24 h run in progress
    this.last = null;                          // the last finished 24 h run (see finishCycle)
    const buf = () => ({ net: new Float32Array(LAB.slots), sugar: new Float32Array(LAB.slots), have: new Uint8Array(LAB.slots), start: 0 });
    this.day = buf();                          // the run being drawn now, with its own baseline
    this.prev = buf();                         // the last completed run, kept (with its own baseline) so days are never mixed
  }

  /** Everything except the leaf type and the light that changes the cell's chemistry: matched conditions must have the same key. */
  static env(m) {
    const on = m.on; let sw = "";
    for (const p of PARTS) sw += on[p] ? "1" : "0";
    return `co2:${m.co2Out}|heat:${m.heat}|salt:${m.outside}|sw:${sw}`;
  }

  update(dt) {
    const m = this.m, F = m.flux;
    if (F.net === undefined) return;
    // ---- steady-light measurements (manual light, stomata open, both energy organelles on) ----
    const env = LeafLab.env(m), k = `${m.leaf}|${env}|${m.auto}`;
    if (k !== this.key || Math.abs(m.light - this.anchor) > 1.01) { this.key = k; this.anchor = m.light; this.hold = 0; this.ringN = 0; this.ringT = 0; }
    else {
      this.hold += dt;
      if ((this.ringT += dt) >= 0.5) { this.ringT = 0; this.ring[this.ringN++ & 31] = F.net; }
    }
    const fair = !m.auto && m.stomata > 0.9 && m.heat <= 40 && m.co2Out >= 30 && m.on.chloroplast && m.on.mitochondrion && (m.leaf === "sun" || m.leaf === "shade");
    let steady = false, lo = 0, hi = 0;
    const need = Math.round(LAB.settle / 2 / 0.5);                    // samples covering the last half of the settle time
    if (fair && this.hold >= LAB.settle && this.ringN >= need) {
      lo = hi = this.ring[(this.ringN - 1) & 31];
      for (let j = 2; j <= need; j++) { const v = this.ring[(this.ringN - j) & 31]; if (v < lo) lo = v; if (v > hi) hi = v; }
      steady = hi - lo <= LAB.drift;
    }
    if (fair && steady) {
      const leaf = m.leaf, net = (lo + hi) / 2;
      const allOn = PARTS.every((p) => m.on[p]) && m.outside === 0;       // compensation points are for the intact cell in fresh water
      if (allOn && F.photo > 0.3 && Math.abs(net) <= LAB.tol) this.comp[leaf] = m.light;
      const band = m.light >= LAB.lowMin && m.light <= LAB.lowMax ? "low" : m.light >= LAB.highMin ? "high" : null;
      if (band) {
        let o = this.obs[band].get(env);
        if (!o) this.obs[band].set(env, (o = {}));
        o[leaf] = { light: m.light, net };
      }
    }
    // ---- 24 h cycle ----
    const ck = `${m.leaf}|${m.peak}|${env}`;
    if (!m.auto) { this.cycle = null; return; }
    if (!this.cycle || this.cycle.key !== ck) {
      this.cycle = { key: ck, hours: 0, start: m.sugar, min: m.sugar, nightResp: Infinity, lastHour: m.hour };
      this.day.have.fill(0); this.prev.have.fill(0); this.day.start = m.sugar;
    }
    const c = this.cycle;
    let dh = m.hour - c.lastHour; if (dh < 0) dh += 24;
    c.hours += dh; c.lastHour = m.hour;
    c.min = Math.min(c.min, m.sugar);
    if (m.light < 1) c.nightResp = Math.min(c.nightResp, F.resp);
    const i = Math.min(LAB.slots - 1, Math.floor(m.hour / 24 * LAB.slots));
    this.day.net[i] = F.net; this.day.sugar[i] = m.sugar; this.day.have[i] = 1;
    if (c.hours >= LAB.cycleHours) this.finishCycle(ck);
  }

  finishCycle(ck) {
    const m = this.m, c = this.cycle;
    const held = m.sugar >= c.start - 0.5, positive = c.min > 0.5, nightResp = c.nightResp > 0.3, organelles = m.on.chloroplast && m.on.mitochondrion;
    this.last = { start: c.start, end: m.sugar, change: m.sugar - c.start, min: c.min, nightResp: c.nightResp, held, positive, nightRespOk: nightResp, ok: held && positive && nightResp && organelles, leaf: m.leaf, peak: m.peak };
    // keep the finished day (with its own baseline) and start a clean one
    const D = this.day, P = this.prev;
    P.net.set(D.net); P.sugar.set(D.sugar); P.have.set(D.have); P.start = D.start;
    D.have.fill(0); D.start = m.sugar;
    this.cycle = { key: ck, hours: 0, start: m.sugar, min: m.sugar, nightResp: Infinity, lastHour: m.hour };
  }

  /** Hours of the current 24 h run completed (0–24). */
  get hours() { return this.cycle ? this.cycle.hours : 0; }
  /** Mission 3: under matched conditions (same light, CO₂, heat, salt and switches) shade beat sun in dim light AND sun beat shade in full sun. */
  get compared() {
    const win = (band, better) => {
      for (const o of this.obs[band].values()) {
        if (o.sun && o.shade && Math.abs(o.sun.light - o.shade.light) <= LAB.matchLight && o[better].net > o[better === "sun" ? "shade" : "sun"].net) return true;
      }
      return false;
    };
    return win("low", "shade") && win("high", "sun");
  }
}
