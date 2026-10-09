// A whole-cell "economy" for a human liver cell (hepatocyte). Same shape as PlantCellModel.
// No DOM, so it can be tested with node. Stores are relative (a full store = 100), except blood and cell glucose (mM).
// Everything here is teaching-scale and the page says so.
//
//  blood glucose ⇄ GLUT2 ⇄ cell glucose ⇄ glycogen   (storing when blood glucose is high, releasing when it is low)
//  glucose + O₂ ──healthy mitochondria──▶ ATP + CO₂   (plus a background of other fuels, e.g. fatty acids)
//  ATP powers: Na⁺/K⁺-ATPase pumps (hold the cell's solutes steady), transcription, translation, Golgi + exocytosis,
//              glycogen synthesis (UTP) and mitophagy
//  mitochondria slowly get damaged (faster in a vicious circle with their own ROS); lysosomes clear them (mitophagy)
//  and healthy ones divide to replace them
//  water follows solutes (osmosis); there is no wall, so the cell can burst (lysis) or shrink (osmotic shrinkage).
//  Not modelled: regulatory volume recovery (real cells restore their volume over minutes by moving ions)
//  albumin: nucleus (mRNA) → rough ER → Golgi → secretory vesicles → exocytosis (constitutive: no store, no trigger)

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sat = (x, k) => (x <= 0 ? 0 : x / (x + k));

export const PARTS = ["mitochondrion", "nucleus", "pores", "er", "golgi", "lysosome", "pumps", "glut"];
export const N_MITO = 40;          // mitochondria drawn (a real hepatocyte has roughly 1,000–2,000)
export const LYSIS_VOL = 1.6;      // relative volume at which the cell bursts (teaching-scale)
export const NONOSM = 0.2;         // fraction of the volume that is not osmotically active water (solid parts)
export const KM_GLUT2 = 17;        // mM: GLUT2 has a high Km, so uptake tracks blood glucose
export const BLOOD_O2 = 85;

export class AnimalCellModel {
  constructor() { this.reset(); }

  reset() {
    this.bloodGlucose = 5;       // mM (normal fasting ~4–6)
    this.outside = 0;            // tonicity of the surrounding fluid: −100 pure water … 0 isotonic … +100 very salty
    this.lysosome = 70;          // lysosome (autophagy) activity, 0–100
    this.secretionDemand = 50;   // albumin gene activity, 0–100
    this.on = Object.fromEntries(PARTS.map((p) => [p, true]));
    this.gAmt = 4.4;             // glucose inside the cell, as an amount (mM at normal volume); concentration = amount / water volume
    this.glycogen = 52;          // 0–100
    this.o2 = 80; this.co2 = 24; this.atp = 80;
    this.mrna = 20; this.mrnaCyto = 15; this.erProtein = 15; this.golgiProtein = 10;
    this.secreted = 0;           // albumin vesicles delivered to the blood
    this.mitoHealthy = N_MITO - 2.5; this.mitoDamaged = 2.0;
    this.ros = 4;                // reactive oxygen species, 0–100
    this.vol = 1;                // 1 = normal volume
    this.ionX = 0.4;             // osmotically active ions held in by the pumps (relative)
    this.burst = false;
    this.burstCause = null;      // "dilute" (hypotonic fluid) or "ion" (pump/ATP failure in normal or salty fluid)
    this.time = 0;
    this.flux = this.flux || {};
    for (const k in this.flux) this.flux[k] = 0;
    this.history = [];
    this.histT = 0;
  }

  /** Osmolarity of the outside fluid relative to normal cells (0 = pure water, 1 = isotonic, 2 = very salty). */
  get cOut() { return Math.max(0, 1 + this.outside / 100); }
  get cIn() { return (0.4 + this.ionX) / Math.max(0.05, this.vol - NONOSM); }
  /** Glucose concentration inside the cell (mM): the amount spread over the cell's water volume. */
  get gi() { return this.gAmt / Math.max(0.1, (this.vol - NONOSM) / (1 - NONOSM)); }
  /** 0 = smooth, 1 = most shrunken (drawn as gentle wrinkling; the textbook spiky crenation is a red-blood-cell effect). */
  get crenation() { return clamp((0.9 - this.vol) / 0.25, 0, 1); }

  step(dt) {
    const n = Math.max(1, Math.ceil(dt / 0.05));
    for (let i = 0; i < n; i++) this.stepOnce(dt / n);
  }

  stepOnce(dt) {
    const F = this.flux;
    if (this.burst) { for (const k in F) F[k] = 0; F.burst = 1; return; }
    F.burst = 0;
    const on = this.on;
    this.time += dt;
    const N = N_MITO, H = this.mitoHealthy, D = this.mitoDamaged;
    const atpOK = sat(this.atp, 12);
    const demand = clamp((100 - this.atp) / 60, 0.08, 1);     // respiratory control: slow when ATP is already high
    const Gb = this.bloodGlucose, Gi = this.gi;

    // ---- respiration (healthy mitochondria do nearly all of it) ----
    const cap = on.mitochondrion ? (H + 0.15 * D) / N : 0;
    F.cap = cap;
    F.resp = 4.5 * cap * sat(Gi, 1.2) * sat(this.o2, 6) * demand;          // glucose oxidised (relative units/s)
    F.fuel = 0.4 * cap * sat(this.o2, 6) * demand;                       // other fuels (fatty acids…) feed the same mitochondria
    F.ferment = 0.9 * sat(Gi, 3) * demand * (on.mitochondrion && this.o2 > 3 && cap > 0.05 ? 0.15 : 1);   // glycolysis alone
    const aerobic = F.resp + F.fuel;

    // ---- glycogen ----
    const hi = Gb - 6, lo = 4.5 - Gb;
    F.synth = hi > 0 ? 0.5 * sat(hi, 2) * sat(Gi, 1) * clamp((100 - this.glycogen) / 15, 0, 1) * atpOK : 0;    // mM/s glucose → glycogen
    F.breakdown = lo > 0 ? 0.6 * sat(lo, 1.5) * clamp(this.glycogen / 5, 0, 1) : 0;                              // mM/s glycogen → glucose
    // GLUT2: passive, bidirectional, high Km (+ = into the cell)
    F.uptake = on.glut ? 6 * (sat(Gb, KM_GLUT2) - sat(Gi, KM_GLUT2)) : 0;

    // ---- ATP sinks ----
    F.pump = on.pumps ? 2.4 * atpOK : 0;
    F.transcribe = on.nucleus ? 1.4 * (this.secretionDemand / 50) * atpOK : 0;
    F.export = on.pores ? 1.2 * sat(this.mrna, 8) : 0;
    F.translate = on.er ? 1.6 * sat(this.mrnaCyto, 10) * atpOK : 0;
    F.toGolgi = on.golgi ? 1.3 * sat(this.erProtein, 10) * atpOK : 0;
    F.secrete = on.golgi ? 1.0 * sat(this.golgiProtein, 8) * atpOK : 0;
    F.upkeep = 0.8;

    // ---- mitochondrial quality ----
    const respN = clamp(aerobic / 2, 0, 1.5);
    this.ros = clamp(100 * (0.04 * respN + 1.2 * D / N), 0, 100);
    F.damage = on.mitochondrion ? H * (0.004 * (0.5 + 0.8 * respN) + 0.035 * this.ros / 100) : 0;   // healthy → damaged (counts/s)
    F.mitophagy = on.lysosome ? 0.25 * (this.lysosome / 100) * D * atpOK : 0;                          // damaged → digested
    F.biogenesis = on.mitochondrion ? 0.25 * H * clamp(1 - (H + D) / N, 0, 1) * sat(this.atp, 25) : 0; // fission of healthy ones

    // ---- osmosis + pump–leak ----
    const cIn = this.cIn;
    F.water = 0.05 * (cIn - this.cOut);                                                                // + = water entering (volume/s)
    F.leak = 0.008;
    F.pumpOut = 0.02 * (on.pumps ? Math.min(1.15, atpOK / 0.87) : 0) * this.ionX;   // calibrated so a healthy cell holds its volume at ATP ≈ 75

    // ---- update pools ----
    this.gAmt += (F.uptake + F.breakdown - F.synth - (F.resp + F.ferment) * 0.04) * dt;
    this.glycogen += (F.synth - F.breakdown) * 2.5 * dt;
    this.o2 += (0.6 * (BLOOD_O2 - this.o2) - aerobic) * dt;
    this.co2 += (aerobic - 0.5 * (this.co2 - 20)) * dt;
    this.atp += (aerobic * 4.2 + F.ferment * 1.0 - F.pump - F.transcribe * 0.8 - F.translate * 1.2 - F.toGolgi * 0.5 - F.secrete * 0.5 - F.upkeep - F.synth * 2 - F.mitophagy * 0.6) * dt;
    this.mrna += (F.transcribe - F.export - this.mrna * 0.01) * dt;
    this.mrnaCyto += (F.export - this.mrnaCyto * 0.03) * dt;           // mRNA is reused: lost only by decay
    this.erProtein += (F.translate - F.toGolgi) * dt;
    this.golgiProtein += (F.toGolgi - F.secrete) * dt;
    this.secreted += F.secrete * dt * 0.25;
    this.mitoHealthy = clamp(H - F.damage * dt + F.biogenesis * dt, 0, N);
    this.mitoDamaged = clamp(D + F.damage * dt - F.mitophagy * dt, 0, N);
    this.ionX = Math.max(0, this.ionX + (F.leak - F.pumpOut) * dt);
    this.vol = Math.max(NONOSM + 0.08, this.vol + F.water * dt);

    this.gAmt = clamp(this.gAmt, 0, 40);
    this.glycogen = clamp(this.glycogen, 0, 100);
    for (const k of ["o2", "co2", "atp", "mrna", "mrnaCyto", "erProtein", "golgiProtein"]) this[k] = clamp(this[k], 0, 100);
    F.atpNet = aerobic * 4.2 + F.ferment * 1.0 - F.pump - F.transcribe * 0.8 - F.translate * 1.2 - F.toGolgi * 0.5 - F.secrete * 0.5 - F.upkeep - F.synth * 2 - F.mitophagy * 0.6;

    if (this.vol >= LYSIS_VOL) { this.burst = true; this.burstCause = this.cOut < 0.9 ? "dilute" : "ion"; for (const k in F) F[k] = 0; F.burst = 1; }

    this.histT += dt;
    if (this.histT >= 0.5) {
      this.histT = 0;
      this.history.push({ t: this.time, atp: this.atp, glycogen: this.glycogen, gi: this.gi, vol: this.vol, ros: this.ros });
      if (this.history.length > 240) this.history.shift();
    }
  }

  /** Short status for each part (what it is doing right now and why). */
  status() {
    const F = this.flux, on = this.on, s = {};
    if (this.burst) {
      for (const k of ["mitochondrion", "nucleus", "er", "golgi", "lysosome", "pumps", "glut", "glycogen"]) s[k] = "burst: everything stopped";
      s.vol = "burst"; s.membrane = "burst"; s.cell = "burst";
      return s;
    }
    const H = Math.round(this.mitoHealthy), D = Math.round(this.mitoDamaged);
    s.mitochondrion = !on.mitochondrion ? "switched off"
      : (F.resp + F.fuel) < 0.3 ? (this.gi < 1 ? "starved of glucose" : this.o2 < 3 ? "no O₂" : this.atp > 85 ? "resting (ATP is high)" : "slow")
      : D > H ? "mostly damaged: little ATP" : D >= 3 ? `making ATP (${D} damaged)` : "making ATP";
    s.nucleus = !on.nucleus ? "transcription off" : this.atp < 5 ? "stalled: no ATP" : "copying the albumin gene";
    s.er = !on.er ? "switched off" : F.translate < 0.3 ? (!on.pores || this.mrnaCyto < 3 ? "waiting: no mRNA arriving" : "slow") : "ribosomes making albumin";
    s.golgi = !on.golgi ? "switched off" : F.secrete < 0.2 ? "little to ship" : "packaging + shipping albumin";
    s.lysosome = !on.lysosome ? "switched off" : F.mitophagy > 0.03 ? "digesting damaged mitochondria" : this.lysosome < 5 ? "inactive" : "idle: nothing to clear";
    s.pumps = !on.pumps ? "switched off" : this.atp < 5 ? "stopped: no ATP" : "pumping Na⁺ out, K⁺ in";
    s.glut = !on.glut ? "blocked" : F.uptake > 0.05 ? "letting glucose in" : F.uptake < -0.05 ? "letting glucose out to the blood" : "in balance";
    s.glycogen = F.synth > 0.03 ? "storing glycogen" : F.breakdown > 0.03 ? "breaking down glycogen" : this.glycogen < 2 && this.bloodGlucose < 4.5 ? "empty: can't support the blood" : "steady";
    const w = F.water || 0;
    s.vol = this.vol > 1.35 ? "swelling: close to bursting" : this.vol > 1.08 ? "swelling" : this.vol < 0.8 ? "shrunken" : this.vol < 0.92 ? "shrinking" : w > 0.01 ? "swelling slightly" : w < -0.01 ? "shrinking slightly" : "normal volume";
    s.membrane = s.vol;
    return s;
  }
}
