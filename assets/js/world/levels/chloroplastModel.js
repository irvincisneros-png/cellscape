// A working chloroplast: the reviewed limiting-factors model (sims/photosynthesis/model.js) split into its two
// coupled halves so knockouts show cause and effect. No DOM — testable with node.
//
//  Thylakoids (light-dependent reactions):  light + H₂O + ADP + NADP⁺ ──▶ O₂ + ATP + NADPH        flux J
//  Stroma (Calvin cycle, Rubisco):          CO₂ + ATP + NADPH ──▶ triose phosphate + ADP + NADP⁺   flux V
//  e = fraction of the shared carrier pool (ATP + NADPH) that is charged; 1 − e is ADP + NADP⁺.
//
//  J = k · Lcap · (1 − e)    the light reactions need NADP⁺/ADP to accept energy (they back up when e → 1)
//  V = k · Ccap · e          the Calvin cycle needs ATP + NADPH (it stops when e → 0)
//  Lcap = light-limited capacity (model L); Ccap = smooth-min of the CO₂ and enzyme/temperature limits (C, P).
//  k is chosen so that, with both halves running, the steady-state flux equals the reviewed model's rate exactly
//  (J = V = rates().rate), so the numbers match the thylakoid level and the 2D sim. Steady-state
//  e* = Lcap / (Lcap + Ccap): carriers are mostly charged when CO₂ or temperature limits, mostly empty when light limits.
//  Units: J and V are in the model's "O₂ bubbles per minute" (1 O₂ released per CO₂ fixed overall).
//
//  Triose phosphate (TP) made by the Calvin cycle is exported by day (→ sucrose in the cytosol) or stored as
//  starch when it builds up. In the dark, starch is broken down and exported (mainly as maltose).
import { rates, intensity } from "../../../../sims/photosynthesis/model.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smin = (a, b) => (a > 1e-9 && b > 1e-9 ? Math.pow(a ** -4 + b ** -4, -0.25) : 0);
export const POOL = 200;  // carrier pool size (sets how quickly the halves respond to each other)

export class ChloroplastModel {
  constructor() { this.reset(); }

  reset() {
    this.light = 70;      // % of full light (relative intensity 0–1 in the shared model)
    this.co2 = 0.04;      // % CO₂ (air ≈ 0.04 %)
    this.temp = 25;       // °C
    this.on = { light: true, calvin: true };
    this.den = 0;         // fraction of Rubisco permanently denatured by heat
    this.e = 0.6;         // ATP + NADPH charged fraction
    this.tp = 30;         // triose phosphate in the stroma (0–100)
    this.starch = 45;     // starch grains (0–100)
    this.o2Total = 0; this.fixedTotal = 0; this.exportTotal = 0;
    this.time = 0;
    this.flux = { J: 0, V: 0, exportTP: 0, store: 0, mobilise: 0 };
    this.r = rates(this.state(), 0);
    this.history = [];
    this.histT = 0;
  }

  /** The shared photosynthesis model's state object (white light; intensity set directly via lamp distance). */
  state() {
    const I = clamp(this.light / 100, 0, 1);
    return { lampOn: I > 0.0005, dcm: I > 0.0005 ? 10 / Math.sqrt(I) : 60, white: true, lambda: 670, co2: this.co2, temp: this.temp };
  }

  get intensity() { return intensity(this.state()); }

  step(dt) {
    const n = Math.max(1, Math.ceil(dt / 0.05));
    for (let i = 0; i < n; i++) this.stepOnce(dt / n);
  }

  stepOnce(dt) {
    this.time += dt;
    if (this.temp > 42) this.den = Math.min(1, this.den + dt * (this.temp - 42) * 0.04); // same rule as the 2D sim
    const r = (this.r = rates(this.state(), this.den));
    const Lcap = r.L, Ccap = smin(r.C, r.P);
    const H = Lcap + Ccap > 1e-9 ? (Lcap * Ccap) / (Lcap + Ccap) : 0;
    const k = H > 1e-6 ? r.rate / H : 1;
    const F = this.flux;
    F.J = this.on.light ? k * Lcap * (1 - this.e) : 0;
    F.V = this.on.calvin ? k * Ccap * this.e : 0;
    this.e = clamp(this.e + ((F.J - F.V) / POOL) * dt, 0, 1);

    // sugar: triose phosphate from the Calvin cycle → exported, or stored as starch when it builds up
    const day = clamp(this.light / 8, 0, 1);        // is it light? (starch breakdown is switched on in the dark)
    F.tpIn = F.V * 0.08;
    F.exportTP = 0.06 * this.tp;
    F.store = this.tp > 25 ? (this.tp - 25) * 0.06 : 0;
    F.mobilise = this.starch > 0.01 ? 0.6 * (1 - day) : 0;  // starch broken down in the dark (exported mainly as maltose)
    this.tp = clamp(this.tp + (F.tpIn - F.exportTP - F.store) * dt, 0, 100);
    this.starch = clamp(this.starch + (F.store - F.mobilise) * 0.6 * dt, 0, 100);
    this.o2Total += (F.J / 60) * dt;
    this.fixedTotal += (F.V / 60) * dt;
    this.exportTotal += (F.exportTP + F.mobilise) * dt;

    this.histT += dt;
    if (this.histT >= 0.5) {
      this.histT = 0;
      this.history.push({ J: F.J, V: F.V, e: this.e, starch: this.starch });
      if (this.history.length > 240) this.history.shift();
    }
  }

  /** Which factor limits the reviewed model right now. */
  get limiting() {
    if (!this.state().lampOn) return "dark";
    return this.r.lim;
  }

  status() {
    const F = this.flux, s = {};
    s.light = !this.on.light ? "blocked" : F.J < 0.5 ? (this.light < 1 ? "idle — no light" : this.e > 0.9 ? "backed up — no NADP⁺/ADP" : "slow") : "splitting water, making ATP + NADPH";
    s.calvin = !this.on.calvin ? "blocked" : F.V < 1.5 ? (this.e < 0.08 ? "stalled — no ATP/NADPH" : this.r.P < 4 ? "stalled — enzymes denatured" : "slow") : "fixing CO₂";
    return s;
  }
}
