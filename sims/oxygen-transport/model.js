// Oxygen transport model — Hill-equation O2–haemoglobin dissociation curve with
// Bohr / temperature / 2,3-BPG shifts, carbon monoxide (Haldane) and fetal Hb.
// All pressures in mmHg.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const HILL_N = 2.7;
export const P50_ADULT = 26.8; // mmHg at pH 7.4, 37 °C, PCO2 40, normal 2,3-BPG
export const P50_FETAL = 19;
export const HALDANE_M = 230; // CO affinity relative to O2 (≈200–250×)
export const P_CRIT = 15; // critical tissue/venous pO2 (mmHg) below which O2 supply limits respiration
export const D0 = 0.245; // resting O2 extraction (fraction of Hb) at sea level → venous sat ≈ 72–75%

/** Hill equation: fractional saturation of the haem sites that are free to bind O2. */
export function hill(p, p50, n = HILL_N) {
  if (p <= 0) return 0;
  const a = Math.pow(p / p50, n);
  return a / (1 + a);
}

/**
 * P50 for a set of conditions.
 *  pH:   Bohr coefficient ΔlogP50/ΔpH = −0.48
 *  temp: ΔlogP50/Δ°C = +0.024
 *  pco2: small extra CO2 (carbamino) effect beyond pH, ΔlogP50/ΔlogPCO2 ≈ 0.06
 *  bpg:  2,3-BPG (mmol/L, normal 5). Fetal Hb binds 2,3-BPG weakly.
 *  fCO:  fraction of haem occupied by CO — remaining sites hold O2 more tightly (left shift).
 */
export function p50For({ pH = 7.4, temp = 37, pco2 = 40, bpg = 5, fetal = false, fCO = 0 }) {
  let p = fetal ? P50_FETAL : P50_ADULT;
  p *= Math.pow(10, -0.48 * (pH - 7.4));
  p *= Math.pow(10, 0.024 * (temp - 37));
  p *= Math.pow(10, 0.06 * Math.log10(Math.max(pco2, 1) / 40));
  p *= 1 + (fetal ? 0.015 : 0.06) * (bpg - 5);
  p *= Math.pow(1 - clamp(fCO, 0, 0.95), 0.8);
  return p;
}
/** CO also makes the curve less sigmoidal (more hyperbolic). */
export const nFor = (fCO) => HILL_N - 1.2 * clamp(fCO, 0, 0.95);

/** O2Hb as a fraction of ALL haemoglobin (COHb sites cannot carry O2). */
export const satTotal = (p, p50, fCO) => (1 - fCO) * hill(p, p50, nFor(fCO));

export const DEFAULTS = { exercise: 0, altitude: 0, coPpm: 0, hb: 150, bpg: 5, fetal: false, ptManual: null, fCO: 0 };

/** Barometric pressure (mmHg) — simple exponential atmosphere fitted so Everest ≈ 250 mmHg. */
export const baroP = (alt) => 760 * Math.exp(-alt / 8000);

/** Everything derived from the learner's settings. st.fCO is the current (dynamic) COHb fraction. */
export function conditions(st) {
  const Pb = baroP(st.altitude);
  const frac = clamp((760 - Pb) / (760 - 251), 0, 1);
  // Hyperventilation at altitude lowers alveolar PCO2 (≈7.5 mmHg on the Everest summit)
  const paco2 = 40 - 32.5 * frac * frac;
  const lungPH = 7.4 + 0.41 * Math.log10(40 / paco2); // respiratory alkalosis (partly compensated)
  const PIO2 = 0.2093 * (Pb - 47); // inspired, saturated with water vapour
  const PA = Math.max(5, PIO2 - paco2 / 0.8); // simplified alveolar gas equation (R = 0.8)

  const fetal = !!st.fetal;
  const e = fetal ? 0 : clamp(st.exercise, 0, 1); // a fetus doesn't exercise
  // Alveolar–arterial gradient: small at sea level (≈3 mmHg); grows at extreme altitude because
  // diffusion across the alveolar wall can no longer keep up (diffusion limitation), more so in exercise.
  const AaGrad = 3 + 6 * frac ** 3 + 12 * e * frac;
  const Pa = Math.max(5, PA - AaGrad); // end-capillary / arterial pO2
  // Fetal mode: the exchange site is the placenta, where maternal blood has pO2 ≈ 35 mmHg
  const Psrc = fetal ? 35 * (PA / 99.2) : Pa;

  // Muscle tissue: exercise uses O2 faster and makes CO2, heat and lactic acid
  const tissueCO2 = paco2 + 6 + 24 * e;
  const tissuePH = lungPH - 0.03 - 0.17 * e;
  const tissueT = 37 + 3 * e;

  const fCO = clamp(st.fCO || 0, 0, 0.9);
  const pCO = st.coPpm * 1e-6 * (Pb - 47);
  const r = (HALDANE_M * pCO) / Math.max(PA, 5);
  const fCOeq = r / (1 + r);

  const n = nFor(fCO);
  const lungCond = { pH: lungPH, temp: 37, pco2: paco2, bpg: st.bpg, fetal, fCO };
  const tisCond = { pH: tissuePH, temp: tissueT, pco2: tissueCO2, bpg: st.bpg, fetal, fCO };
  const p50L = p50For(lungCond);
  const p50T = p50For(tisCond);
  const p50Ref = p50For({}); // normal adult reference
  const satL = satTotal(Psrc, p50L, fCO);

  // ---- Demand-driven extraction (Fick principle) ----
  // O2 used per minute = cardiac output × [Hb] × (sat_arterial − sat_venous).
  // Demand (in units of resting use) rises ~12× from rest to maximal exercise; the tissue
  // extracts exactly what it needs, so venous saturation = sat_art − demand ÷ (Q × Hb), and
  // tissue pO2 follows from the Hill curve. Below a critical pO2 (~15 mmHg) O2 can no longer
  // diffuse fast enough to the mitochondria: supply-limited, demand not met.
  const HR = fetal ? 140 : 70 + 110 * e;
  const Q = fetal ? 1 : 1 + 3 * e; // cardiac output relative to rest (5 → 20 L/min)
  const hbRel = st.hb / 150;
  const flow = Q * hbRel;
  const demandRel = 1 + 11 * e;
  const satFloor = satTotal(P_CRIT, p50T, fCO);
  const capacity = Math.max(0, flow * (satL - satFloor)); // max O2 the blood could give up
  let satT, Pt, met = true;
  if (st.ptManual != null) {
    // learner dragged the tissue point: a "what if" tissue pO2 (as if demand changed)
    Pt = clamp(st.ptManual, 4, Math.max(5, Psrc - 4));
    satT = Math.min(satL, satTotal(Pt, p50T, fCO));
  } else {
    const need = (D0 * demandRel) / flow; // saturation that must be extracted
    satT = satL - need;
    Pt = hillInv(satT, p50T, fCO);
    if (!(Pt >= P_CRIT)) { Pt = P_CRIT; satT = Math.min(satL, satFloor); met = false; }
    Pt = Math.min(Pt, Psrc);
  }
  const unloaded = Math.max(0, satL - satT);
  const unloadNoBohr = Math.max(0, satL - satTotal(Pt, p50L, fCO));
  // What maternal (adult) Hb would manage at the same pO2 — for the fetal comparison
  const satAdultSrc = satTotal(Psrc, p50For({ ...lungCond, fetal: false }), fCO);
  const delivered = (flow * unloaded) / D0; // × resting O2 use
  const demand = st.ptManual != null ? delivered : demandRel;
  const fracMet = demand > 0 ? Math.min(1, delivered / demand) : 1;
  const reserve = capacity / D0 / demandRel; // how many times current demand the blood could supply

  return {
    Pb, frac, paco2, lungPH, PA, Pa, AaGrad, Psrc, Pt, tissueCO2, tissuePH, tissueT,
    fCO, fCOeq, n, p50L, p50T, p50Ref, satL, satT, unloaded, unloadNoBohr,
    bohrBonus: unloaded - unloadNoBohr, satAdultSrc, HR, Q, hbRel,
    delivery: delivered, demand, met: st.ptManual != null ? true : met, fracMet, reserve, capacity: capacity / D0,
    fetal, e,
  };
}

/** Inverse Hill (O2Hb fraction of total Hb → pO2). Returns NaN if impossible. */
export function hillInv(sTot, p50, fCO) {
  const h = sTot / (1 - fCO);
  if (!(h > 0)) return NaN;
  if (h >= 0.9999) return 999;
  return p50 * Math.pow(h / (1 - h), 1 / nFor(fCO));
}
