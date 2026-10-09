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
    this.time = 0;
    this.flux = {};
    this.history = [];
    this.histT = 0;
  }

  step(dt) {
    const n = Math.max(1, Math.ceil(dt / 0.05));
    for (let i = 0; i < n; i++) this.stepOnce(dt / n);
  }

  stepOnce(dt) {
    const on = this.on, F = {};
    this.time += dt;
    const water = clamp(this.turgor / 60, 0.2, 1);            // wilting cells close stomata / lack water

    // photosynthesis (chloroplasts): light & CO₂ limited
    F.photo = on.chloroplast ? 9 * sat(this.light, 35) * sat(this.co2 + this.co2Out * 0.6, 30) * water : 0;
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
    F.upkeep = 0.6;                                           // everything else the cell does

    // gas exchange with the air spaces in the leaf (diffusion toward outside levels)
    F.o2Out = (this.o2 - 25) * 0.18;                           // + = O₂ leaving the cell
    F.co2In = (this.co2Out * 0.7 - this.co2) * 0.15;           // + = CO₂ entering

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
    this.flux = F;

    this.histT += dt;
    if (this.histT >= 0.5) {
      this.histT = 0;
      this.history.push({ t: this.time, atp: this.atp, glucose: this.glucose, o2: this.o2, turgor: this.turgor, starch: this.starch });
      if (this.history.length > 240) this.history.shift();
    }
  }

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
