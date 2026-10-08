// Photosynthesis — limiting-factors model (pure functions, no DOM).
//
// rate (O₂ bubbles/min from an Elodea sprig) = smooth-min(light-limited, CO₂-limited, enzyme/temperature-limited)
// A smooth minimum (p-norm, n = 4) gives the rounded "knee" seen in real data while still behaving like
// Blackman's law of limiting factors: the smallest term controls the rate.

export const DEFAULTS = { lampOn: true, dcm: 25, white: true, lambda: 670, co2: 0.04, temp: 25 };

export const K_LIGHT = 250;   // light-limited rate at 100 % intensity with perfect absorption
export const CO2_MAX = 100;   // CO₂-limited rate at saturating CO₂
export const CO2_KM = 0.08;   // % CO₂ giving half of CO2_MAX (simplified Michaelis–Menten for Rubisco supply)
export const P_MAX = 90;      // Calvin-cycle enzyme capacity at the optimum temperature
export const T_OPT = 28;      // °C

const g = (x, m, s) => Math.exp(-(((x - m) / s) ** 2));

/** Simplified chlorophyll a + b (+ carotenoid shoulder) action spectrum, 0–1. Peaks blue ~440 nm, red ~670 nm, low in green. */
export function absorb(l) {
  return Math.min(1, 0.13 + 0.87 * g(l, 438, 34) + 0.5 * g(l, 484, 22) + 0.12 * g(l, 620, 28) + 0.86 * g(l, 672, 22));
}

/** White light = equal mix of 400–700 nm, so its usefulness is the average absorption. */
export const WHITE_ABS = (() => {
  let s = 0, n = 0;
  for (let l = 400; l <= 700; l += 2) { s += absorb(l); n++; }
  return s / n;
})();

/** Relative light intensity (1 at 10 cm) — inverse square law. */
export const intensity = (s) => (s.lampOn ? (10 / s.dcm) ** 2 : 0);

/** Enzyme activity vs temperature: Q10 ≈ 2 below the optimum, falls steeply to 0 by ~44 °C (denaturation). */
export function tempFactor(T) {
  if (T <= T_OPT) return Math.pow(2, (T - T_OPT) / 10);
  return Math.max(0, 1 - ((T - T_OPT) / 16) ** 2);
}

/** den = fraction of Rubisco permanently denatured by heat (0–1). */
export function rates(s, den = 0) {
  const a = s.white ? WHITE_ABS : absorb(s.lambda);
  const I = intensity(s);
  const L = K_LIGHT * I * a;
  const C = (CO2_MAX * s.co2) / (s.co2 + CO2_KM);
  const P = P_MAX * tempFactor(s.temp) * (1 - den);
  let rate = 0;
  if (L > 1e-6 && C > 1e-6 && P > 1e-6) rate = Math.pow(L ** -4 + C ** -4 + P ** -4, -0.25);
  let lim = "light", v = L;
  if (C < v) { lim = "co2"; v = C; }
  if (P < v) { lim = "temp"; v = P; }
  return { L, C, P, a, I, rate, lim };
}

/** Approximate visible colour for a wavelength (nm), brightened for a dark background. */
export function waveColour(l) {
  let r = 0, gg = 0, b = 0;
  if (l < 440) { r = (440 - l) / 60; b = 1; }
  else if (l < 490) { gg = (l - 440) / 50; b = 1; }
  else if (l < 510) { gg = 1; b = (510 - l) / 20; }
  else if (l < 580) { r = (l - 510) / 70; gg = 1; }
  else if (l < 645) { r = 1; gg = (645 - l) / 65; }
  else r = 1;
  const f = (v) => Math.round(255 * (0.12 + 0.88 * Math.max(0, Math.min(1, v))));
  return "#" + [r, gg, b].map((v) => f(v).toString(16).padStart(2, "0")).join("");
}

export function colourName(l) {
  if (l < 450) return "violet-blue";
  if (l < 495) return "blue";
  if (l < 570) return "green";
  if (l < 590) return "yellow";
  if (l < 625) return "orange";
  return "red";
}
