// Photosynthesis: Inside the Chloroplast — CellScape sim.
// Light-dependent reactions on a thylakoid membrane + Calvin cycle in the stroma + Elodea bubble counter.
// The overall rate comes from a limiting-factors model (model.js); every animation is paced by that rate.
import * as K from "../../assets/js/kit.js";
import * as M from "./model.js";
import { drawMembrane, drawPSII, drawB6f, drawPSI, drawSynthase, drawRubisco, drawCO2, drawHex, drawInset, wrapLines } from "./draw.js";

const { C, clamp, lerp, rand, TAU } = K;
const stageEl = K.$("#stage");
const panel = K.$("#panel");
const overlay = K.$("#overlay");
const canvas = K.$("#canvas");
const stage = K.createStage(canvas);
const { ctx } = stage;
const toast = K.toaster(stageEl);
const reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

const COL = {
  e: "#fde047", h: C.pink, o2: C.red, h2o: "#67e8f9", atp: C.amber, nadph: C.violet,
  rubp: C.blue, pga: C.orange, g3p: "#a3e635", glu: C.green,
};
const LIMCOL = { light: C.amber, co2: C.teal, temp: C.red };

// ---------------- state ----------------
const S = {};
function defaults() {
  Object.assign(S, M.DEFAULTS, {
    fx: 0.3, den: 0, glucose: 0, co2Fixed: 0, atpStore: 6, nadphStore: 6, hPool: 8,
    eCount: 0, g3pCount: 0, manualFixed: 0, bubblesCounted: 0, lampDragged: false, colourSwept: false,
  });
}
defaults();
S.view = stage.w < 600 ? "thylakoid" : "both";
let model = M.rates(S, 0);

let photons = [], electrons = [], hions = [], movers = [], o2s = [], waters = [], tokens = [];
let co2s = [], flyCO2 = [], g3ps = [], pops = [], flashes = [], bubbles = [];
const acc = { photon: 0, e: 0, fix: 0, atp: 0, bubble: 0 };
let rotor = 0, rotorSpeed = 0, wheelPhase = 0, rubPulse = 0, tokenFlip = 0;
const bg = K.makeParticles(36, () => ({ x: Math.random(), y: Math.random(), r: rand(0.8, 2.6), z: rand(0.2, 1), vx: rand(-0.004, 0.004), vy: rand(-0.003, 0.003) }));

function clearEntities() {
  photons = []; electrons = []; hions = []; movers = []; o2s = []; waters = []; tokens = [];
  co2s = []; flyCO2 = []; g3ps = []; pops = []; flashes = []; bubbles = [];
  for (const k in acc) acc[k] = 0;
}

// ---------------- layout ----------------
let overlayH = 40;
new ResizeObserver(() => { overlayH = overlay.offsetHeight || 40; }).observe(overlay);
let G = null;
function layout() {
  const w = stage.w, h = stage.h;
  const top = overlayH + 20;
  const wide = w >= 760 && w / h > 1.15;
  const showMem = S.view !== "calvin", showCal = S.view !== "thylakoid";
  const sc = clamp(Math.min(w, h * 1.3) / 820, 0.62, 1.2);
  const L = { w, h, top, wide, showMem, showCal, sc };
  const iw = clamp(w * 0.14, 92, 150), ih = iw * 1.22;
  L.inset = { x: 12, y: h - ih - 12, w: iw, h: ih };
  if (showMem) {
    const x0 = 0, x1 = showCal && wide ? w * 0.64 : w;
    const memY = !showCal ? top + (h - top) * 0.5 : wide ? top + (h - top) * 0.48 : top + (h - top) * 0.4;
    const u = 22 * sc;
    const lumenH = clamp((memY - u - top) * 0.46, 44 * sc, 180);
    const span = x1 - x0;
    Object.assign(L, {
      x0, x1, memY, u, lumenTop: memY - u - lumenH, memBottom: memY + u,
      psii: x0 + span * 0.15, b6f: x0 + span * 0.38, psi: x0 + span * 0.59, atps: x0 + span * 0.84,
    });
    L.T = { x: (L.psii + L.psi) / 2, y: memY - u };
    L.lampR = { x0: x0 + 26, x1: x1 - 26, y0: top + 16, y1: Math.max(top + 30, L.lumenTop - 24 * sc) };
    L.oec = { x: L.psii, y: memY - u - 13 * sc };
    L.fd = { x: L.psi + 1.25 * u, y: memY + u + 9 * sc };
    L.fnr = { x: L.psi + 2.2 * u, y: memY + u + 18 * sc };
    L.head = { x: L.atps, y: memY + u + 44 * sc };
    L.pc = { x: lerp(L.b6f, L.psi, 0.5), y: memY - u - 9 * sc };
  }
  if (showCal) {
    let cx, cy, r;
    if (!showMem) { cx = w * 0.56; cy = top + (h - top) * 0.52; r = Math.min(w * 0.26, (h - top) * 0.32); }
    else if (wide) { cx = w * 0.825; cy = top + (h - top) * 0.55; r = Math.min(w * 0.11, (h - top) * 0.28); }
    else { const yb = L.memBottom + 64 * sc; cx = w * 0.6; cy = yb + (h - yb) * 0.5; r = Math.min(w * 0.22, (h - yb) * 0.36); }
    r = Math.max(r, 46);
    L.wheel = { cx, cy, r };
    L.aR = (-5 * Math.PI) / 6;
    const at = (a) => ({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    L.rub = { ...at(L.aR), r: clamp(r * 0.27, 17, 34) };
    L.red = at(L.aR + TAU / 3);
    L.reg = at(L.aR + (2 * TAU) / 3);
    const yLow = showMem ? (wide ? top + 8 : L.memBottom + 46 * sc) : top + 8;
    const xLow = showMem && wide ? L.x1 + 14 : 8;
    L.zone = {
      x0: Math.max(xLow, cx - r * 1.75), x1: Math.min(w - 8, cx + r * 1.75),
      y0: Math.max(yLow, cy - r * 1.65), y1: Math.min(h - 8, cy + r * 1.65),
    };
  }
  return L;
}

/** Lamp position from S.dcm (10–60 cm) and preferred horizontal fraction S.fx. */
function lampGeom(L) {
  const R = L.lampR, T = L.T;
  const dMin = Math.max(20, T.y - R.y1);
  const dMax = Math.max(dMin + 40, Math.hypot(Math.max(T.x - R.x0, R.x1 - T.x), T.y - R.y0));
  const d = dMin + ((S.dcm - 10) / 50) * (dMax - dMin);
  let x = R.x0 + S.fx * (R.x1 - R.x0);
  let dx = x - T.x, y;
  const sgn = dx < 0 ? -1 : 1;
  if (d * d - dx * dx < dMin * dMin) { x = T.x + sgn * Math.sqrt(Math.max(0, d * d - dMin * dMin)); y = T.y - dMin; }
  else {
    y = T.y - Math.sqrt(d * d - dx * dx);
    if (y < R.y0) { y = R.y0; x = T.x + sgn * Math.sqrt(Math.max(0, d * d - (T.y - R.y0) ** 2)); }
  }
  x = clamp(x, R.x0, R.x1);
  return { x, y, dMin, dMax };
}

const lampHex = () => (S.white ? "#fff4cf" : M.waveColour(S.lambda));

// ---------------- panel UI ----------------
const explain = K.card(panel, "What's happening", "explain");
const explainBody = document.createElement("div");
explainBody.setAttribute("aria-live", "polite");
explain.appendChild(explainBody);
const selInfo = document.createElement("p");
selInfo.className = "sel-info";
selInfo.innerHTML = "Tap a protein, Rubisco, the lamp or the pondweed to see its role.";
explain.appendChild(selInfo);

const controls = K.card(panel, "Controls");
const lampChk = K.checkbox(controls, "Lamp on", true, (v) => { S.lampOn = v; touched("light"); });
const distS = K.slider(controls, {
  label: "Lamp distance (drag the lamp too)", min: 10, max: 60, step: 1, value: S.dcm,
  format: (v) => `${v} cm · ${Math.round((10 / v) ** 2 * 100)}%`,
  onInput: (v) => { S.dcm = v; touched("light"); },
});
const colourWrap = document.createElement("div");
colourWrap.className = "control";
colourWrap.innerHTML = `<div class="control-row"><label>Light colour</label></div>`;
controls.appendChild(colourWrap);
const COLOURS = [{ value: "white", label: "White" }, { value: 450, label: "Blue" }, { value: 540, label: "Green" }, { value: 670, label: "Red" }];
const colourSeg = K.segmented(colourWrap, COLOURS, "white", (v) => {
  if (v === "white") S.white = true;
  else { S.white = false; S.lambda = v; lamS.value = v; }
  touched("colour");
});
const lamS = K.slider(controls, {
  label: "Wavelength (filter)", min: 400, max: 700, step: 5, value: S.lambda,
  format: (v) => `${v} nm · ${M.colourName(v)}`,
  onInput: (v) => {
    S.white = false; S.lambda = v;
    const m = COLOURS.find((c) => c.value === v);
    colourSeg.set(m ? m.value : null);
    touched("colour");
  },
});
const spec = document.createElement("div");
spec.className = "spectrum-bar";
lamS.el.appendChild(spec);
const co2S = K.slider(controls, {
  label: "CO₂ concentration", min: 0, max: 0.4, step: 0.01, value: S.co2,
  format: (v) => `${v.toFixed(2)} %`, onInput: (v) => { S.co2 = v; touched("co2"); },
});
const co2Note = document.createElement("div");
co2Note.className = "control-sub";
co2Note.textContent = "Air ≈ 0.04 %. Adding sodium hydrogen carbonate raises CO₂ in the water.";
controls.appendChild(co2Note);
const tempS = K.slider(controls, {
  label: "Temperature", min: 0, max: 50, step: 1, value: S.temp, unit: " °C",
  onInput: (v) => { S.temp = v; touched("temp"); },
});
const viewWrap = document.createElement("div");
viewWrap.className = "control";
viewWrap.innerHTML = `<div class="control-row"><label>View</label></div>`;
controls.appendChild(viewWrap);
const viewSeg = K.segmented(viewWrap, [{ value: "both", label: "Both" }, { value: "thylakoid", label: "Thylakoid" }, { value: "calvin", label: "Calvin cycle" }], S.view, (v) => { S.view = v; });
const row = K.buttonRow(controls);
const pauseBtn = K.button(row, "Pause", () => { pauseBtn.textContent = Lp.toggle() ? "Pause" : "Play"; });
K.button(row, "Reset", resetAll);
const speedWrap = document.createElement("div");
speedWrap.className = "control";
speedWrap.innerHTML = `<div class="control-row"><label>Speed</label></div>`;
controls.appendChild(speedWrap);
const SPEEDS = [0.25, 0.5, 1, 2, 3];
const speedSeg = K.segmented(speedWrap, SPEEDS.map((s) => ({ value: s, label: `${s}×` })), reduced ? 0.5 : 1, (v) => { Lp.speed = v; });

// ---------- rate graph ----------
const graph = { vary: "light", curves: { light: [], co2: [], temp: [], colour: [] }, sweep: null, last: 0 };
const gCard = K.card(panel, "Rate graph · O₂ production");
const gIntro = document.createElement("p");
gIntro.className = "small";
gIntro.textContent = "Pick a variable, then run an experiment: it sweeps that variable while everything else stays as you set it. Change another factor and run again to compare curves.";
gCard.appendChild(gIntro);
const varSeg = K.segmented(gCard, [{ value: "light", label: "Light" }, { value: "co2", label: "CO₂" }, { value: "temp", label: "Temp" }, { value: "colour", label: "Colour" }], "light", (v) => { graph.vary = v; });
const gc = document.createElement("canvas");
gc.className = "graph-canvas";
gc.setAttribute("role", "img");
gc.setAttribute("aria-label", "Graph of O₂ production rate. No experiment run yet.");
gCard.appendChild(gc);
const gctx = gc.getContext("2d");
const gRow = K.buttonRow(gCard);
const runBtn = K.button(gRow, "Run experiment", runSweep, { kind: "primary" });
K.button(gRow, "Clear graph", () => { graph.curves[graph.vary] = []; graph.sweep = null; });
const gKey = document.createElement("div");
gKey.className = "graph-key";
gKey.innerHTML = `<span><i style="background:${C.amber}"></i>light limiting</span><span><i style="background:${C.teal}"></i>CO₂ limiting</span><span><i style="background:${C.red}"></i>temperature limiting</span><span><i style="background:#fff;height:8px;width:8px;border-radius:50%"></i>you are here</span>`;
gCard.appendChild(gKey);

function touched(v) {
  if (graph.sweep) return;
  if (graph.vary !== v) { graph.vary = v; varSeg.set(v); }
}

// ---------- legend ----------
const legend = K.card(panel, "Key");
const lg = document.createElement("div");
lg.className = "legend";
lg.innerHTML = [
  ["linear-gradient(90deg,#4f6bff,#3dff6a,#ff3d3d)", "Photon (light)"], [COL.e, "Electron (e⁻)"],
  [COL.h, "H⁺ (proton)"], [COL.h2o, "Water (H₂O)"], [COL.o2, "Oxygen (O₂)"], ["#9ca3af", "Carbon dioxide (CO₂)"],
  [COL.atp, "ATP"], [COL.nadph, "NADPH"], [COL.rubp, "RuBP (5C)"], [COL.pga, "3-PGA (3C)"],
  [COL.g3p, "G3P sugar (3C)"], [COL.glu, "Glucose (6C)"],
].map(([c, t]) => `<span><i style="background:${c}"></i>${t}</span>`).join("");
legend.appendChild(lg);

// ---------- missions ----------
const missions = K.missions(panel, [
  { text: "Make your first glucose (the Calvin cycle must fix 6 CO₂).", check: () => S.glucose >= 1 },
  { text: "Low light: move the lamp 40 cm or more away and confirm light is the limiting factor.", check: () => S.lampOn && S.dcm >= 40 && model.lim === "light" },
  { text: "Bright light: bring the lamp to 12 cm or closer. What limits the rate now? (Find the CO₂ limit.)", check: () => S.lampOn && S.dcm <= 12 && model.lim === "co2" },
  { text: "Show that green light is poorly used: shine green light (500–570 nm) from 15 cm or closer, or sweep Colour on the graph.", check: () => S.colourSwept || (S.lampOn && !S.white && S.lambda >= 500 && S.lambda <= 570 && S.dcm <= 15) },
  { text: "Heat things up until the Calvin cycle stops (enzymes denature).", check: () => S.lampOn && S.temp >= 43 && model.P < 5 },
  { text: "Optimise all three factors: reach 50+ O₂ bubbles/min and make 10 glucose.", check: () => S.glucose >= 10 && model.rate >= 50 },
], (m) => toast(`Mission complete: ${m.text.replace(/<[^>]+>/g, "")}`, 3600));

// ---------- quiz ----------
K.quiz(panel, [
  {
    q: "Which is the balanced equation for photosynthesis?",
    options: ["6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂", "C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O", "6CO₂ + 6O₂ → C₆H₁₂O₆ + 6H₂O", "CO₂ + H₂O → C₆H₁₂O₆ + O₂"],
    answer: 0,
    why: "Carbon dioxide + water → glucose + oxygen, using light energy absorbed by chlorophyll. The second option is cellular respiration; the last one isn't balanced.",
  },
  {
    q: "Where do the two stages of photosynthesis happen in the chloroplast?",
    options: ["Both happen in the stroma", "Light-dependent: thylakoid membranes. Light-independent (Calvin cycle): stroma", "Light-dependent: stroma. Calvin cycle: thylakoid membranes", "Both happen in the mitochondria"],
    answer: 1,
    why: "Photosystems, the electron transport chain and ATP synthase sit in the <strong>thylakoid membrane</strong>. Rubisco and the Calvin cycle enzymes are dissolved in the <strong>stroma</strong>.",
  },
  {
    q: "Where does the oxygen gas released in photosynthesis come from?",
    options: ["Carbon dioxide", "Water, split at photosystem II", "Glucose", "The chlorophyll molecule"],
    answer: 1,
    why: "PSII splits water: 2H₂O → 4H⁺ + O₂ + 4e⁻. Experiments with water labelled with ¹⁸O show the O₂ comes from water. The oxygen atoms of CO₂ end up in the sugar (and water).",
  },
  {
    q: "Pondweed under a very bright lamp in water with 0.04 % CO₂ makes 30 bubbles/min. Moving the lamp even closer doesn't change the rate. What would increase it?",
    options: ["Move the lamp closer still", "Add more CO₂ (e.g. sodium hydrogen carbonate)", "Use a green filter", "Heat the water to 50 °C"],
    answer: 1,
    why: "The rate has plateaued, so light is no longer the limiting factor — CO₂ is. Raising the limiting factor raises the rate. 50 °C would denature the enzymes.",
  },
  {
    q: "What do ATP and NADPH from the light-dependent reactions do in the Calvin cycle?",
    options: ["They absorb light energy", "ATP supplies energy and NADPH supplies electrons (hydrogen) to turn fixed CO₂ into the sugar G3P", "They split water to release oxygen", "They carry CO₂ into the chloroplast"],
    answer: 1,
    why: "ATP provides the energy and NADPH the reducing power (electrons + H) to reduce 3-PGA to G3P. ATP is also used to regenerate RuBP. ADP and NADP⁺ return to the thylakoid to be recharged.",
  },
  {
    q: "Why does the rate of photosynthesis drop sharply above about 40 °C?",
    options: ["Chlorophyll stops absorbing light", "Enzymes such as Rubisco denature (lose their shape), so the Calvin cycle stops", "There is no more water", "CO₂ turns into O₂"],
    answer: 1,
    why: "The Calvin cycle is enzyme-controlled. Up to the optimum (~25–30 °C) rate rises with temperature; above it, the active sites change shape and the enzymes denature. Without the Calvin cycle, NADP⁺ runs out and the light reactions stop too.",
  },
]);

// ---------- chips ----------
const chipLight = K.chip(overlay);
const chipCO2 = K.chip(overlay);
const chipTemp = K.chip(overlay);
const chipO2 = K.chip(overlay);
const chipGlu = K.chip(overlay);
const limChipEl = document.createElement("div");
limChipEl.className = "chip lim";
overlay.appendChild(limChipEl);

// ---------------- info for tappable things ----------------
const INFO = {
  psii: ["Photosystem II (P680)", "Chlorophyll in the antenna absorbs light and passes the energy to the reaction centre, exciting electrons. To replace them, PSII splits water: 2H₂O → 4H⁺ + O₂ + 4e⁻. This is where the oxygen comes from."],
  b6f: ["Cytochrome b6f", "Receives electrons from plastoquinone (in the membrane) and passes them to plastocyanin. It uses their energy to pump H⁺ from the stroma into the lumen, building up a proton gradient."],
  psi: ["Photosystem I (P700)", "A second photon re-energises the electron. It passes via ferredoxin to NADP⁺ reductase, which makes NADPH: NADP⁺ + 2e⁻ + H⁺ → NADPH."],
  atps: ["ATP synthase", "H⁺ ions flow back from the lumen (high concentration) to the stroma through this rotary motor. The flow spins the rotor and the head joins ADP + Pi → ATP. This is chemiosmosis."],
  rubisco: ["Rubisco", "The enzyme that fixes carbon: it joins CO₂ to RuBP (5 carbons), giving two 3-PGA (3 carbons). It is slow and temperature-sensitive. Drag CO₂ molecules onto it!"],
  calvin: ["Calvin cycle (stroma)", "Fixation (Rubisco adds CO₂ to RuBP) → reduction (ATP + NADPH turn 3-PGA into G3P) → regeneration (ATP rebuilds RuBP). For every 3 CO₂ fixed, 1 G3P leaves; 2 G3P can make 1 glucose."],
  lamp: ["Light source", "Drag it closer or further. Light intensity follows the inverse square law: halve the distance and you get 4× the light. Change its colour with the filter controls."],
  elodea: ["Pondweed bubble counter", "A classic school prac: a cut sprig of Elodea in water gives off O₂ bubbles. Counting bubbles per minute is a simple measure of the rate of photosynthesis (shown sped up)."],
};
let sel = null;
function select(key, x, y) {
  sel = key ? { key, x, y } : null;
  selInfo.innerHTML = key ? `<strong>${INFO[key][0]}.</strong> ${INFO[key][1]}` : "Tap a protein, Rubisco, the lamp or the pondweed to see its role.";
}

// ---------------- interaction ----------------
let drag = null;
function hitTest(px, py) {
  const L = G;
  if (!L) return null;
  if (px > L.inset.x && px < L.inset.x + L.inset.w && py > L.inset.y && py < L.inset.y + L.inset.h) return "elodea";
  if (L.showCal) {
    if (K.dist(px, py, L.rub.x, L.rub.y) < L.rub.r + 14) return "rubisco";
    const d = K.dist(px, py, L.wheel.cx, L.wheel.cy);
    if (d < L.wheel.r + 18) return "calvin";
  }
  if (L.showMem) {
    const yT = L.memY - L.u - 30 * L.sc, yB = L.memY + L.u + 30 * L.sc;
    const inY = (y0, y1) => py > y0 && py < y1;
    if (Math.abs(px - L.psii) < 2.7 * L.u && inY(yT, yB)) return "psii";
    if (Math.abs(px - L.b6f) < 1.4 * L.u && inY(yT, yB)) return "b6f";
    if (Math.abs(px - L.psi) < 2.7 * L.u && inY(yT, yB)) return "psi";
    if (Math.abs(px - L.atps) < 1.6 * L.u && inY(yT, L.head.y + 30 * L.sc)) return "atps";
  }
  return null;
}
function nearestCO2(px, py) {
  let best = null, bd = 28;
  for (const c of co2s) {
    const d = K.dist(px, py, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
K.pointer(canvas, {
  down(p) {
    if (!G) return;
    if (G.showMem && S.lampOn !== undefined) {
      const lp = lampGeom(G);
      if (K.dist(p.x, p.y, lp.x, lp.y) < 34) { drag = { kind: "lamp", sx: p.x, sy: p.y, moved: false }; canvas.style.cursor = "grabbing"; return; }
    }
    if (G.showCal) {
      const c = nearestCO2(p.x, p.y);
      if (c) { c.held = true; drag = { kind: "co2", c }; canvas.style.cursor = "grabbing"; return; }
    }
    const k = hitTest(p.x, p.y);
    select(k, p.x, p.y);
  },
  move(p) {
    if (!G) return;
    if (drag && drag.kind === "lamp" && p.isDown) {
      if (K.dist(p.x, p.y, drag.sx, drag.sy) > 4) drag.moved = true;
      const R = G.lampR, lg = lampGeom(G);
      const px = clamp(p.x, R.x0, R.x1), py = clamp(p.y, R.y0, R.y1);
      const d = Math.hypot(px - G.T.x, py - G.T.y);
      S.dcm = Math.round(clamp(10 + (50 * (d - lg.dMin)) / (lg.dMax - lg.dMin), 10, 60));
      S.fx = (px - R.x0) / (R.x1 - R.x0);
      distS.value = S.dcm;
      if (drag.moved) S.lampDragged = true;
      touched("light");
      return;
    }
    if (drag && drag.kind === "co2" && p.isDown) { drag.c.x = p.x; drag.c.y = p.y; drag.c.vx = drag.c.vy = 0; return; }
    // hover cursor
    let cur = "default";
    if (G.showMem) { const lp = lampGeom(G); if (K.dist(p.x, p.y, lp.x, lp.y) < 34) cur = "grab"; }
    if (cur === "default" && G.showCal && nearestCO2(p.x, p.y)) cur = "grab";
    if (cur === "default" && hitTest(p.x, p.y)) cur = "pointer";
    canvas.style.cursor = cur;
  },
  up(p) {
    if (!drag) return;
    if (drag.kind === "lamp" && !drag.moved) select("lamp", p.x, p.y);
    if (drag.kind === "co2") {
      const c = drag.c;
      c.held = false;
      c.x = p.x; c.y = p.y;
      if (G.showCal && K.dist(c.x, c.y, G.rub.x, G.rub.y) < G.rub.r + 24) manualFix(c);
    }
    drag = null;
    canvas.style.cursor = "default";
  },
});

function manualFix(c) {
  if (model.P < 4) {
    toast(S.temp >= 40 ? "Rubisco is denatured — its active site has lost its shape, so CO₂ can't bind." : "Too cold: Rubisco is barely working.");
    c.vx = rand(-60, 60); c.vy = rand(40, 90);
    return;
  }
  if (S.atpStore < 1.2 || S.nadphStore < 0.9) {
    toast("Rubisco grabbed it, but there's no ATP/NADPH to finish the cycle. The Calvin cycle needs the light reactions — turn up the light!");
    c.vx = rand(-60, 60); c.vy = rand(40, 90);
    return;
  }
  co2s.splice(co2s.indexOf(c), 1);
  flashes.push({ x: G.rub.x, y: G.rub.y, r: G.rub.r * 2.2, col: C.teal, life: 0, max: 0.5 });
  S.manualFixed++;
  if (S.manualFixed === 1) toast("Fixed! Rubisco joined your CO₂ to RuBP (carbon fixation).");
  fixOne(false);
}

// ---------------- events ----------------
function fixOne(visual = true) {
  S.atpStore = Math.max(0, S.atpStore - 1.2);
  S.nadphStore = Math.max(0, S.nadphStore - 0.9);
  S.co2Fixed++;
  rubPulse = 1;
  if (visual && G.showCal && flyCO2.length < 20) {
    let best = null, bd = 1e9;
    for (const c of co2s) {
      if (c.held) continue;
      const d = K.dist(c.x, c.y, G.rub.x, G.rub.y);
      if (d < bd) { bd = d; best = c; }
    }
    if (best) { co2s.splice(co2s.indexOf(best), 1); flyCO2.push({ sx: best.x, sy: best.y, t: 0, dur: 0.5 }); }
  }
  if (S.co2Fixed % 3 === 0) {
    S.g3pCount++;
    if (G.showCal) g3ps.push({ t: 0, dur: 0.9 });
  }
  if (S.co2Fixed % 6 === 0) {
    S.glucose++;
    if (G.showCal) pops.push({ t: 0 });
  }
}

function fireElectron() {
  S.eCount++;
  S.hPool += 2; // 1 H⁺ from water at PSII + 1 pumped by cyt b6f (simplified)
  const L = G;
  if (L.showMem) {
    if (electrons.length < 40) electrons.push({ seg: 0, t: 0, flashedPSI: false });
    flashes.push({ x: L.psii, y: L.memY, r: 26 * L.sc, col: "#bbf7d0", life: 0, max: 0.35 });
    hions.push({ x: L.oec.x + rand(-6, 6), y: L.oec.y - 4, vx: rand(-40, 40), vy: rand(-50, -20) });
    if (movers.length < 40) movers.push({ pts: [[L.b6f + rand(-8, 8), L.memBottom + 34 * L.sc], [L.b6f, L.memY], [L.b6f + rand(-8, 8), L.memY - L.u - 10 * L.sc]], seg: 0, t: 0, segDur: 0.45, end: "lumen" });
    if (S.eCount % 2 === 0 && waters.length < 12) waters.push({ sx: L.oec.x + rand(-70, 70) * L.sc, sy: L.lumenTop + rand(8, 28), t: 0, dur: 0.9 });
    if (S.eCount % 4 === 0 && o2s.length < 24) o2s.push({ x: L.oec.x, y: L.oec.y - 8, vx: rand(-25, 15), vy: rand(-34, -20), life: 0 });
  }
  if (S.eCount % 2 === 0) spawnToken("nadph");
}

function spawnToken(type) {
  const L = G;
  let sx, sy;
  if (L.showMem) {
    if (type === "atp") { sx = L.head.x + rand(-10, 10); sy = L.head.y + 22 * L.sc; }
    else { sx = L.fnr.x + 8; sy = L.fnr.y + 12 * L.sc; }
  } else { sx = -10; sy = rand(L.top + 40, L.h - 40); }
  let ex, ey;
  if (L.showCal) {
    const site = type === "nadph" || (tokenFlip++ % 3 !== 0) ? L.red : L.reg;
    ex = site.x; ey = site.y;
  } else { ex = L.w + 20; ey = rand(L.memBottom + 40, L.h - 30); }
  const d = Math.hypot(ex - sx, ey - sy);
  if (tokens.length > 70) { arriveToken(type); return; }
  tokens.push({ type, sx, sy, ex, ey, x: sx, y: sy, t: 0, dur: clamp(d / 170, 1.2, 4), wob: rand(0, TAU), bend: rand(-0.25, 0.25) });
}
function arriveToken(type) {
  if (type === "atp") S.atpStore = Math.min(24, S.atpStore + 1);
  else S.nadphStore = Math.min(24, S.nadphStore + 1);
}

function spawnPhoton(lp) {
  const L = G;
  const toPSII = Math.random() < 0.5;
  const cx = toPSII ? L.psii : L.psi;
  const tx = cx + rand(-1.8, 1.8) * L.u, ty = L.memY - L.u * 0.3 + rand(-4, 4);
  const lam = S.white ? rand(400, 700) : S.lambda;
  const d = Math.hypot(tx - lp.x, ty - lp.y);
  photons.push({ sx: lp.x, sy: lp.y, tx, ty, x: lp.x, y: lp.y, t: 0, dur: d / 640, col: M.waveColour(lam), abs: Math.random() < M.absorb(lam), ph: rand(0, TAU), pass: -1, toPSII });
}

// ---------------- reset ----------------
function resetAll() {
  defaults();
  clearEntities();
  rotor = 0; wheelPhase = 0;
  lampChk.checked = true;
  distS.value = S.dcm; co2S.value = S.co2; tempS.value = S.temp; lamS.value = S.lambda;
  colourSeg.set("white");
  graph.sweep = null;
  for (const k in graph.curves) graph.curves[k] = [];
  select(null);
  toast("Reset: fresh pondweed, enzymes and defaults.");
}

// ---------------- graph ----------------
const GX = {
  light: { min: 0, max: 100, label: "Light intensity (% of lamp at 10 cm)", fmt: (v) => `${Math.round(v)}` },
  co2: { min: 0, max: 0.4, label: "CO₂ concentration (%)", fmt: (v) => v.toFixed(1) },
  temp: { min: 0, max: 50, label: "Temperature (°C)", fmt: (v) => `${Math.round(v)}` },
  colour: { min: 400, max: 700, label: "Wavelength of light (nm)", fmt: (v) => `${Math.round(v)}` },
};
const Y_MAX = 100;
function setVar(s, vary, x) {
  if (vary === "light") { if (x <= 0) s.lampOn = false; else { s.lampOn = true; s.dcm = 10 / Math.sqrt(x / 100); } }
  else if (vary === "co2") s.co2 = x;
  else if (vary === "temp") s.temp = x;
  else { s.white = false; s.lambda = x; }
}
function currentX(vary) {
  if (vary === "light") return model.I * 100;
  if (vary === "co2") return S.co2;
  if (vary === "temp") return S.temp;
  return S.white ? null : S.lambda;
}
function conditionsLabel(vary) {
  const parts = [];
  if (vary !== "light") parts.push(S.lampOn ? `${S.dcm} cm` : "dark");
  if (vary !== "colour") parts.push(S.white ? "white" : `${S.lambda} nm`);
  if (vary !== "co2") parts.push(`${S.co2.toFixed(2)}% CO₂`);
  if (vary !== "temp") parts.push(`${S.temp} °C`);
  return parts.join(", ");
}
function runSweep() {
  const v = graph.vary, ax = GX[v];
  const pts = [];
  const N = 60;
  for (let i = 0; i <= N; i++) {
    const x = lerp(ax.min, ax.max, i / N);
    const s = { ...S };
    setVar(s, v, x);
    const r = M.rates(s, v === "temp" ? 0 : S.den);
    pts.push({ x, y: r.rate, lim: r.lim });
  }
  graph.sweep = { vary: v, pts, t: 0, label: conditionsLabel(v) };
  runBtn.disabled = true;
}
function finishSweep() {
  const sw = graph.sweep;
  const list = graph.curves[sw.vary];
  list.push({ pts: sw.pts, label: sw.label });
  if (list.length > 4) list.shift();
  graph.sweep = null;
  runBtn.disabled = false;
  const pts = sw.pts, peak = pts.reduce((a, b) => (b.y > a.y ? b : a));
  let msg = "";
  if (sw.vary === "light") {
    const k = pts.findIndex((p) => p.x > 0 && p.lim !== "light");
    msg = k > 0 ? `Rate rises with light, then plateaus at about ${Math.round(peak.y)} bubbles/min above ~${Math.round(pts[k].x)}% light: ${pts[k].lim === "co2" ? "CO₂" : "temperature"} is now limiting.` : "Rate rises steadily with light — light is limiting across the whole range.";
  } else if (sw.vary === "co2") {
    const k = pts.findIndex((p) => p.x > 0 && p.lim !== "co2");
    msg = k > 0 ? `Rate rises with CO₂ then levels off near ${Math.round(peak.y)} bubbles/min: ${pts[k].lim === "light" ? "light" : "temperature"} becomes limiting above ~${pts[k].x.toFixed(2)}% CO₂.` : "Rate keeps rising with CO₂ — CO₂ is limiting across the whole range.";
  } else if (sw.vary === "temp") {
    msg = `Optimum about ${Math.round(peak.x)} °C. Above ~40 °C the enzymes denature and the rate crashes. (Fresh pondweed for each temperature.)`;
  } else {
    S.colourSwept = true;
    msg = "Peaks in blue (~440 nm) and red (~670 nm); green (~530–560 nm) is poorly absorbed, so the rate dips.";
  }
  gc.setAttribute("aria-label", `Graph of O₂ production rate against ${GX[sw.vary].label}. ${msg}`);
  toast(msg, 5200);
}

function drawGraph(now) {
  const w = gc.clientWidth, h = gc.clientHeight;
  if (!w || !h) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (gc.width !== Math.round(w * dpr) || gc.height !== Math.round(h * dpr)) { gc.width = Math.round(w * dpr); gc.height = Math.round(h * dpr); }
  const g = gctx;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const ax = GX[graph.vary];
  const pl = 34, pr = 10, pt = 12, pb = graph.vary === "colour" ? 40 : 32;
  const X = (x) => pl + ((x - ax.min) / (ax.max - ax.min)) * (w - pl - pr);
  const Y = (y) => h - pb - (clamp(y, 0, Y_MAX) / Y_MAX) * (h - pt - pb);
  g.font = "10px Inter, system-ui, sans-serif";
  g.strokeStyle = "rgba(160,190,230,0.12)"; g.lineWidth = 1; g.fillStyle = C.inkFaint;
  g.textAlign = "right"; g.textBaseline = "middle";
  for (let y = 0; y <= Y_MAX; y += 25) { g.beginPath(); g.moveTo(pl, Y(y)); g.lineTo(w - pr, Y(y)); g.stroke(); g.fillText(y, pl - 5, Y(y)); }
  g.textAlign = "center"; g.textBaseline = "top";
  for (let i = 0; i <= 4; i++) { const x = lerp(ax.min, ax.max, i / 4); g.fillText(ax.fmt(x), X(x), h - pb + 4); }
  if (graph.vary === "colour") {
    for (let l = 400; l < 700; l += 5) { g.fillStyle = M.waveColour(l); g.fillRect(X(l), h - pb + 1, X(l + 5) - X(l) + 0.5, 3); }
  }
  g.fillStyle = C.inkDim; g.fillText(ax.label, (pl + w - pr) / 2, h - 13);
  g.save(); g.translate(9, (pt + h - pb) / 2); g.rotate(-Math.PI / 2); g.textBaseline = "middle"; g.fillText("O₂ bubbles/min", 0, 0); g.restore();
  g.strokeStyle = C.inkFaint; g.beginPath(); g.moveTo(pl, pt); g.lineTo(pl, h - pb); g.lineTo(w - pr, h - pb); g.stroke();

  const drawCurve = (pts, upto, alpha, label, idx) => {
    g.save(); g.globalAlpha = alpha; g.lineWidth = 2.4; g.lineCap = "round";
    const n = Math.min(pts.length - 1, upto);
    for (let i = 0; i < n; i++) {
      g.strokeStyle = LIMCOL[pts[i].lim];
      g.beginPath(); g.moveTo(X(pts[i].x), Y(pts[i].y)); g.lineTo(X(pts[i + 1].x), Y(pts[i + 1].y)); g.stroke();
    }
    if (label && n === pts.length - 1) {
      const pk = pts.reduce((a, b) => (b.y > a.y ? b : a));
      g.font = "600 10px Inter, system-ui, sans-serif"; g.fillStyle = C.ink; g.textBaseline = "bottom";
      const lx = clamp(X(pk.x), pl + 40, w - pr - 40);
      g.textAlign = "center";
      g.fillText(`${idx}: ${label}`, lx, Y(pk.y) - 3);
    }
    g.restore();
  };
  const list = graph.curves[graph.vary];
  list.forEach((c, i) => drawCurve(c.pts, c.pts.length, i === list.length - 1 && !graph.sweep ? 1 : 0.5, c.label, i + 1));
  if (graph.sweep && graph.sweep.vary === graph.vary) {
    const sw = graph.sweep;
    const n = Math.floor(sw.t * (sw.pts.length - 1));
    drawCurve(sw.pts, n, 1, null, 0);
    const p = sw.pts[Math.min(n, sw.pts.length - 1)];
    g.fillStyle = LIMCOL[p.lim]; g.beginPath(); g.arc(X(p.x), Y(p.y), 4, 0, TAU); g.fill();
  }
  const cx = currentX(graph.vary);
  if (cx !== null) {
    const px = X(clamp(cx, ax.min, ax.max)), py = Y(model.rate);
    g.strokeStyle = "#fff"; g.lineWidth = 2; g.fillStyle = LIMCOL[model.lim];
    g.beginPath(); g.arc(px, py, 5, 0, TAU); g.fill(); g.stroke();
  }
}

// ---------------- explain text ----------------
let lastExplain = "";
function updateExplain() {
  const r = model;
  let s = "";
  if (!S.lampOn) {
    s = `<p>The lamp is <strong>off</strong>. Without light the photosystems can't excite electrons, so no ATP or NADPH is made, the Calvin cycle runs out of them and stops, and no O₂ is released.</p>`;
  } else if (r.lim === "light") {
    s = `<p><strong>Light is the limiting factor.</strong> Chlorophyll in PSII and PSI absorbs photons and excites electrons. More light (bring the lamp closer) would make the rate go up.</p>`;
    if (!S.white && r.a < 0.35) s += `<p><strong>${M.colourName(S.lambda)} light</strong> is mostly reflected or passes straight through — chlorophyll absorbs only ${Math.round(r.a * 100)}% of it. Red and blue light are absorbed best (that's why leaves look green).</p>`;
  } else if (r.lim === "co2") {
    s = `<p><strong>CO₂ is the limiting factor.</strong> The light reactions could go faster, but <strong>Rubisco</strong> can only fix CO₂ as fast as it arrives, so the Calvin cycle can't use ATP and NADPH any faster. More light won't help now — raise CO₂.</p>`;
  } else if (S.temp >= 33) {
    s = `<p><strong>Temperature is limiting — it's too hot.</strong> Calvin cycle enzymes such as <strong>Rubisco</strong> are losing their shape (denaturing). With the Calvin cycle stalled, NADP⁺ runs out, so the light reactions slow and less O₂ is made.</p>`;
  } else if (S.temp < 20) {
    s = `<p><strong>Temperature is limiting — it's cold.</strong> Molecules move slowly, so enzyme–substrate collisions in the Calvin cycle are rare. Warming towards ~25–30 °C speeds it up.</p>`;
  } else {
    s = `<p><strong>Temperature (enzyme speed) is limiting.</strong> Light and CO₂ are plentiful; the Calvin cycle enzymes are working as fast as this temperature allows. The optimum is about 28 °C.</p>`;
  }
  if (S.den > 0.03) s += `<p><strong>${Math.round(S.den * 100)}% of Rubisco is permanently denatured.</strong> Cooling down won't fix it — press <strong>Reset</strong> for fresh pondweed.</p>`;
  s += `<p>Light-dependent reactions: <strong>thylakoid membrane</strong> (water split → O₂, ATP, NADPH). Light-independent reactions (Calvin cycle): <strong>stroma</strong> (CO₂ → G3P → glucose). Overall: <strong>6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂</strong>.</p>`;
  s += `<p class="small">Not to scale: proteins are enlarged, the membrane is a short section, and each animated particle stands for many molecules. Rates use a simplified limiting-factors model.</p>`;
  if (s !== lastExplain) { explainBody.innerHTML = s; lastExplain = s; }
}

// ---------------- update ----------------
function update(dt, t) {
  if (S.temp > 42) S.den = Math.min(1, S.den + dt * (S.temp - 42) * 0.04);
  model = M.rates(S, S.den);
  const L = G;

  // electron transport, paced by the overall rate
  acc.e += model.rate * 0.15 * dt;
  let guard = 0;
  while (acc.e >= 1 && guard++ < 10) { acc.e -= 1; fireElectron(); }

  // proton gradient → ATP synthase
  const flux = 0.6 * S.hPool;
  S.hPool = Math.max(0, S.hPool - flux * dt);
  acc.atp += (flux * dt) / 3;
  guard = 0;
  while (acc.atp >= 1 && guard++ < 10) { acc.atp -= 1; spawnToken("atp"); }
  rotorSpeed = lerp(rotorSpeed, Math.min(14, flux * 0.9), Math.min(1, dt * 3));
  rotor += rotorSpeed * dt;

  // Calvin cycle
  acc.fix += (model.rate / 12) * dt;
  guard = 0;
  while (acc.fix >= 1 && guard++ < 10) { acc.fix -= 1; fixOne(true); }
  wheelPhase += dt * (model.rate / 12) * 0.55;
  rubPulse = Math.max(0, rubPulse - dt * 2.5);

  // Elodea bubbles (time-lapse ×6)
  acc.bubble += (model.rate / 60) * 6 * dt;
  guard = 0;
  while (acc.bubble >= 1 && guard++ < 5) { acc.bubble -= 1; if (bubbles.length < 40) bubbles.push({ y: 0, x: rand(-1, 1), r: rand(0.8, 1.3), v: rand(0.85, 1.15) }); }
  for (const b of bubbles) b.y += dt * 0.32 * b.v;
  for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].y >= 1) { bubbles.splice(i, 1); S.bubblesCounted++; }

  if (L.showMem) updateMembrane(dt, t, L);
  if (L.showCal) updateCalvin(dt, L);

  // tokens
  for (let i = tokens.length - 1; i >= 0; i--) {
    const k = tokens[i];
    k.t += dt / k.dur;
    if (k.t >= 1) { tokens.splice(i, 1); arriveToken(k.type); if (L.showCal) flashes.push({ x: k.ex, y: k.ey, r: 14 * L.sc, col: COL[k.type], life: 0, max: 0.3 }); continue; }
    const e = K.easeInOut(k.t);
    const mx = (k.sx + k.ex) / 2 + (k.ey - k.sy) * k.bend, my = (k.sy + k.ey) / 2 - (k.ex - k.sx) * k.bend;
    const a = (1 - e) * (1 - e), b = 2 * (1 - e) * e, c = e * e;
    k.x = a * k.sx + b * mx + c * k.ex + Math.sin(t * 3 + k.wob) * 4;
    k.y = a * k.sy + b * my + c * k.ey + Math.cos(t * 2.6 + k.wob) * 4;
  }
  for (let i = flashes.length - 1; i >= 0; i--) { flashes[i].life += dt; if (flashes[i].life > flashes[i].max) flashes.splice(i, 1); }
}

function electronPath(L) {
  return [
    [L.psii, L.memY], [lerp(L.psii, L.b6f, 0.5), L.memY + L.u * 0.35], [L.b6f, L.memY],
    [L.pc.x, L.pc.y], [L.psi, L.memY], [L.fd.x, L.fd.y], [L.fnr.x, L.fnr.y],
  ];
}

function updateMembrane(dt, t, L) {
  const lp = lampGeom(L);
  // photons
  const rateP = S.lampOn ? 2 + 22 * Math.min(1, model.I) : 0;
  acc.photon += rateP * dt;
  let guard = 0;
  while (acc.photon >= 1 && guard++ < 6) { acc.photon -= 1; if (photons.length < 40) spawnPhoton(lp); }
  for (let i = photons.length - 1; i >= 0; i--) {
    const p = photons[i];
    if (p.pass < 0) {
      p.t += dt / Math.max(0.05, p.dur);
      const e = Math.min(1, p.t);
      p.x = lerp(p.sx, p.tx, e); p.y = lerp(p.sy, p.ty, e);
      if (p.t >= 1) {
        if (p.abs) {
          const cx = p.toPSII ? L.psii : L.psi;
          flashes.push({ x: p.tx, y: p.ty, r: 18 * L.sc, col: p.col, life: 0, max: 0.4 });
          const excess = model.L > 0 ? 1 - model.rate / model.L : 0;
          if (Math.random() < excess * 0.7) flashes.push({ x: cx + rand(-10, 10), y: L.memY - L.u - 10, r: 12 * L.sc, col: C.orange, life: 0, max: 0.8, rise: true });
          photons.splice(i, 1);
        } else p.pass = 0;
      }
    } else {
      p.pass += dt;
      const dx = p.tx - p.sx, dy = p.ty - p.sy, d = Math.hypot(dx, dy) || 1;
      p.x = p.tx + (dx / d) * 640 * p.pass; p.y = p.ty + (dy / d) * 640 * p.pass;
      if (p.pass > 0.5) photons.splice(i, 1);
    }
  }
  // electrons
  const path = electronPath(L);
  for (let i = electrons.length - 1; i >= 0; i--) {
    const e = electrons[i];
    e.t += dt / 0.32;
    while (e.t >= 1) { e.t -= 1; e.seg++; }
    if (e.seg === 4 && !e.flashedPSI) { e.flashedPSI = true; flashes.push({ x: L.psi, y: L.memY, r: 24 * L.sc, col: "#bbf7d0", life: 0, max: 0.35 }); }
    if (e.seg >= path.length - 1) electrons.splice(i, 1);
  }
  // lumen H⁺
  const lx0 = L.x0 + 8, lx1 = L.x1 - (L.x1 < L.w - 1 ? 30 : 8), ly0 = L.lumenTop + 8, ly1 = L.memY - L.u - 6;
  for (const hh of hions) { K.brownian(hh, dt, 140, 0.92); hh.r = 3; K.bounce(hh, lx0, ly0, lx1, ly1); }
  const target = Math.min(70, Math.round(S.hPool));
  guard = 0;
  while (hions.length > target + 1 && guard++ < 4) {
    let bi = 0, bd = 1e9;
    hions.forEach((hh, k) => { const d = K.dist(hh.x, hh.y, L.atps, ly1); if (d < bd) { bd = d; bi = k; } });
    const hh = hions.splice(bi, 1)[0];
    if (movers.length < 40) movers.push({ pts: [[hh.x, hh.y], [L.atps - 0.5 * L.u, L.memY - L.u - 2], [L.atps - 0.4 * L.u, L.memY + L.u * 0.4], [L.atps + rand(-14, 14), L.head.y + 30 * L.sc]], seg: 0, t: 0, segDur: 0.3, end: "stroma" });
  }
  guard = 0;
  while (hions.length < target - 3 && guard++ < 3) hions.push({ x: rand(lx0, lx1), y: rand(ly0, ly1), vx: 0, vy: 0 });
  for (let i = movers.length - 1; i >= 0; i--) {
    const m = movers[i];
    m.t += dt / m.segDur;
    while (m.t >= 1) { m.t -= 1; m.seg++; }
    if (m.seg >= m.pts.length - 1) {
      movers.splice(i, 1);
      if (m.end === "lumen" && hions.length < 75) { const p = m.pts[m.pts.length - 1]; hions.push({ x: p[0], y: p[1], vx: rand(-20, 20), vy: rand(-30, 0) }); }
    }
  }
  // O₂ and water
  for (let i = o2s.length - 1; i >= 0; i--) {
    const o = o2s[i];
    o.life += dt; o.x += o.vx * dt; o.y += o.vy * dt;
    if (o.life > 3.2 || o.y < L.top - 10) o2s.splice(i, 1);
  }
  for (let i = waters.length - 1; i >= 0; i--) {
    const wv = waters[i];
    wv.t += dt / wv.dur;
    if (wv.t >= 1) { waters.splice(i, 1); flashes.push({ x: L.oec.x, y: L.oec.y, r: 12 * L.sc, col: COL.h2o, life: 0, max: 0.3 }); }
  }
}

function updateCalvin(dt, L) {
  const want = Math.round(3 + S.co2 * 70);
  const Z = L.zone;
  if (co2s.length < want && Math.random() < dt * 4) {
    const side = K.randInt(0, 3);
    const x = side === 0 ? Z.x0 : side === 1 ? Z.x1 : rand(Z.x0, Z.x1);
    const y = side === 2 ? Z.y0 : side === 3 ? Z.y1 : rand(Z.y0, Z.y1);
    co2s.push({ x, y, vx: 0, vy: 0, r: 9, a: 0, rot: rand(0, TAU) });
  }
  if (co2s.length > want + 2) {
    const c = co2s.find((cc) => !cc.held);
    if (c) c.leaving = true;
  }
  for (let i = co2s.length - 1; i >= 0; i--) {
    const c = co2s[i];
    c.a = c.leaving ? c.a - dt * 2 : Math.min(1, c.a + dt * 2);
    if (c.leaving && c.a <= 0) { co2s.splice(i, 1); continue; }
    if (c.held) continue;
    K.brownian(c, dt, 90, 0.9);
    c.rot += dt * 0.6;
    K.bounce(c, Z.x0, Z.y0, Z.x1, Z.y1);
    // keep out of the wheel's middle
    const d = K.dist(c.x, c.y, L.wheel.cx, L.wheel.cy);
    if (d < L.wheel.r * 0.75) { c.vx += ((c.x - L.wheel.cx) / d) * 30; c.vy += ((c.y - L.wheel.cy) / d) * 30; }
  }
  for (let i = flyCO2.length - 1; i >= 0; i--) {
    const f = flyCO2[i];
    f.t += dt / f.dur;
    if (f.t >= 1) { flyCO2.splice(i, 1); flashes.push({ x: L.rub.x, y: L.rub.y, r: L.rub.r * 1.6, col: C.teal, life: 0, max: 0.35 }); }
  }
  for (let i = g3ps.length - 1; i >= 0; i--) { g3ps[i].t += dt / g3ps[i].dur; if (g3ps[i].t >= 1) g3ps.splice(i, 1); }
  for (let i = pops.length - 1; i >= 0; i--) { pops[i].t += dt; if (pops[i].t > 1.2) pops.splice(i, 1); }
}

// ---------------- draw ----------------
function draw(t) {
  const L = G, sc = L.sc;
  K.backdrop(ctx, L.w, L.h, "#0c3a2c");
  // far parallax specks
  for (const p of bg) {
    p.x = (p.x + p.vx * p.z * 0.016 + 1) % 1; p.y = (p.y + p.vy * p.z * 0.016 + 1) % 1;
    K.glow(ctx, p.x * L.w, p.y * L.h, p.r * 4 * p.z, "#5eead4", 0.12 * p.z);
  }

  if (L.showMem) drawThylakoid(t, L);
  if (L.showCal) drawCalvin(t, L);

  // tokens (ATP / NADPH) travelling through the stroma
  for (const k of tokens) {
    if (k.type === "atp") {
      K.sphere(ctx, k.x, k.y, 5.5 * sc, COL.atp);
      for (let j = 0; j < 3; j++) K.sphere(ctx, k.x + (6 + j * 4) * sc, k.y + 1, 2 * sc, "#fde68a");
    } else {
      K.sphere(ctx, k.x, k.y, 5.5 * sc, COL.nadph);
      K.sphere(ctx, k.x + 6 * sc, k.y - 3 * sc, 2.4 * sc, "#e9d5ff");
    }
  }
  for (const f of flashes) {
    const a = 1 - f.life / f.max;
    K.glow(ctx, f.x, f.y - (f.rise ? f.life * 30 : 0), f.r * (0.6 + 0.6 * (1 - a)), f.col, 0.55 * a);
  }
  drawInset(ctx, L.inset, { t, bubbles, rate: model.rate, counted: S.bubblesCounted, light: model.I, lampOn: S.lampOn, lampCol: lampHex(), temp: S.temp });
  if (sel) drawCallout(L);
}

function drawThylakoid(t, L) {
  const sc = L.sc, u = L.u;
  // lumen
  const pH = clamp(7.6 - S.hPool * 0.05, 4.8, 7.6);
  const capR = (L.memY - L.lumenTop) * 0.5;
  const lx1 = L.x1 < L.w - 1 ? L.x1 + capR * 0.3 : L.w + 80;
  ctx.save();
  K.roundRect(ctx, -60, L.lumenTop, lx1 + 60, L.memY - L.lumenTop, capR);
  const lg = ctx.createLinearGradient(0, L.lumenTop, 0, L.memY);
  lg.addColorStop(0, "rgba(30,90,70,0.35)");
  lg.addColorStop(1, K.withAlpha(K.mix("#1f5e4a", "#7a2f6a", clamp((7.6 - pH) / 2.8, 0, 1)), 0.55));
  ctx.fillStyle = lg; ctx.fill();
  ctx.strokeStyle = "rgba(134,201,154,0.35)"; ctx.lineWidth = 9 * sc; ctx.stroke();
  ctx.strokeStyle = "rgba(134,201,154,0.18)"; ctx.lineWidth = 18 * sc; ctx.stroke();
  ctx.restore();
  K.label(ctx, `Thylakoid lumen · pH ≈ ${pH.toFixed(1)}`, L.x0 + 10, L.lumenTop + 16 * sc, { align: "left", size: 11, color: "#bbf7d0" });

  // beam
  if (S.lampOn) {
    const lp = lampGeom(L);
    const lc = lampHex();
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const bgr = ctx.createLinearGradient(lp.x, lp.y, L.T.x, L.T.y);
    const a = 0.05 + 0.18 * Math.min(1, model.I);
    bgr.addColorStop(0, K.withAlpha(lc, a)); bgr.addColorStop(1, K.withAlpha(lc, a * 0.25));
    ctx.fillStyle = bgr;
    ctx.beginPath(); ctx.moveTo(lp.x, lp.y);
    ctx.lineTo(L.psii - 2.4 * u, L.memY - u); ctx.lineTo(L.psi + 2.4 * u, L.memY - u); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // H₂O, H⁺, O₂ in lumen
  for (const wv of waters) {
    const e = K.easeInOut(wv.t);
    const x = lerp(wv.sx, L.oec.x, e), y = lerp(wv.sy, L.oec.y, e);
    K.sphere(ctx, x, y, 4.5 * sc, COL.h2o);
    K.sphere(ctx, x - 4 * sc, y - 3 * sc, 2.2 * sc, "#e0f2fe");
    K.sphere(ctx, x + 4 * sc, y - 3 * sc, 2.2 * sc, "#e0f2fe");
  }
  for (const hh of hions) K.sphere(ctx, hh.x, hh.y, 3 * sc, COL.h);
  for (const o of o2s) {
    const a = clamp(Math.min(o.life * 3, (3.2 - o.life) / 1.2), 0, 1);
    K.sphere(ctx, o.x - 3.2 * sc, o.y, 4 * sc, COL.o2, { alpha: a });
    K.sphere(ctx, o.x + 3.2 * sc, o.y, 4 * sc, COL.o2, { alpha: a });
  }

  // membrane + proteins
  drawMembrane(ctx, L, t);
  drawPSII(ctx, L, t);
  drawB6f(ctx, L, t);
  drawPSI(ctx, L, t);
  drawSynthase(ctx, L, rotor, t);
  // plastoquinone shuttling within the membrane, plastocyanin in lumen
  const pqx = lerp(L.psii + 1.6 * u, L.b6f - 1.1 * u, 0.5 + 0.5 * Math.sin(t * 2.2));
  K.sphere(ctx, pqx, L.memY + u * 0.35, 4.5 * sc, "#facc15");
  K.sphere(ctx, L.pc.x, L.pc.y, 5.5 * sc, "#38bdf8");

  // movers (H⁺ pumped / flowing)
  for (const m of movers) {
    const a = m.pts[m.seg], b = m.pts[Math.min(m.seg + 1, m.pts.length - 1)];
    K.sphere(ctx, lerp(a[0], b[0], m.t), lerp(a[1], b[1], m.t), 3 * sc, COL.h);
  }
  // electrons
  const path = electronPath(L);
  for (const e of electrons) {
    const a = path[e.seg], b = path[Math.min(e.seg + 1, path.length - 1)];
    const k = K.easeInOut(e.t);
    const x = lerp(a[0], b[0], k), y = lerp(a[1], b[1], k);
    K.glow(ctx, x, y, 10 * sc, COL.e, 0.6);
    K.sphere(ctx, x, y, 3.2 * sc, COL.e);
  }

  // photons
  ctx.save();
  ctx.lineWidth = 2; ctx.lineCap = "round";
  for (const p of photons) {
    const dx = p.tx - p.sx, dy = p.ty - p.sy, d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d, nx = -uy, ny = ux;
    const len = 34 * L.sc;
    ctx.globalAlpha = p.pass >= 0 ? Math.max(0, 1 - p.pass / 0.5) * 0.7 : 1;
    ctx.strokeStyle = p.col;
    ctx.beginPath();
    for (let j = 0; j <= 14; j++) {
      const s = (j / 14) * len;
      const off = Math.sin(j * 1.1 + p.ph + t * 18) * 3.5 * L.sc;
      const x = p.x - ux * s + nx * off, y = p.y - uy * s + ny * off;
      j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
  for (const p of photons) if (p.pass < 0) K.glow(ctx, p.x, p.y, 7 * L.sc, p.col, 0.7);

  // reaction labels
  if (L.w >= 560) {
    K.label(ctx, "2H₂O → 4H⁺ + O₂ + 4e⁻", L.oec.x, L.oec.y - 22 * sc, { size: 10, color: "#a5f3fc" });
    K.label(ctx, "ADP + Pi → ATP", L.head.x, L.head.y + 34 * sc, { size: 10, color: "#fde68a" });
    K.label(ctx, "NADP⁺ → NADPH", L.fnr.x + 6 * sc, L.fnr.y + 26 * sc, { size: 10, color: "#ddd6fe" });
  }
  const ly = L.memBottom + (L.w >= 560 ? 52 : 40) * sc;
  K.label(ctx, "PSII", L.psii, ly, { size: 11, color: "#bbf7d0" });
  K.label(ctx, "Cyt b6f", L.b6f, ly, { size: 11, color: "#ddd6fe" });
  K.label(ctx, "PSI", L.psi, ly, { size: 11, color: "#bbf7d0" });
  K.label(ctx, "ATP synthase", L.atps, L.head.y + (L.w >= 560 ? 54 : 34) * sc, { size: 11, color: "#fed7aa" });
  K.label(ctx, "Stroma · pH ≈ 8", lerp(L.b6f, L.psi, 0.45), L.memBottom + 74 * sc, { size: 11, color: C.inkDim });
  if (!L.showCal) K.label(ctx, "ATP + NADPH → to the Calvin cycle", L.w - 12, L.h - 18, { align: "right", size: 11, color: C.inkDim });

  // lamp (drawn last so it sits on top)
  const lp = lampGeom(L);
  const lc = lampHex();
  if (S.lampOn) K.glow(ctx, lp.x, lp.y, 50 + 40 * Math.min(1, model.I), lc, 0.45);
  ctx.save();
  ctx.fillStyle = "#334155";
  K.roundRect(ctx, lp.x - 9, lp.y - 26, 18, 12, 3); ctx.fill();
  ctx.restore();
  K.sphere(ctx, lp.x, lp.y, 15, S.lampOn ? lc : "#475569", { glow: S.lampOn ? 18 : 0 });
  if (S.lampOn && !reduced) {
    ctx.save(); ctx.strokeStyle = K.withAlpha(lc, 0.55); ctx.lineWidth = 2;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU + t * 0.4, r0 = 20, r1 = 26 + 3 * Math.sin(t * 3 + k);
      ctx.beginPath(); ctx.moveTo(lp.x + Math.cos(a) * r0, lp.y + Math.sin(a) * r0); ctx.lineTo(lp.x + Math.cos(a) * r1, lp.y + Math.sin(a) * r1); ctx.stroke();
    }
    ctx.restore();
  }
  const lname = S.white ? "white" : M.colourName(S.lambda);
  const right = lp.x > L.w * 0.6;
  K.label(ctx, `Lamp · ${S.dcm} cm · ${S.lampOn ? lname : "off"}`, lp.x + (right ? -34 : 34), lp.y, { align: right ? "right" : "left", size: 11 });
  if (!S.lampDragged) K.label(ctx, "⟷ drag me", lp.x, lp.y + 34, { size: 10, color: C.amber });
}

function drawCalvin(t, L) {
  const { cx, cy, r } = L.wheel, sc = L.sc;
  const dead = model.P < 4;
  const dmg = clamp(Math.max(S.den, (S.temp - 36) / 8), 0, 1);
  K.glow(ctx, cx, cy, r * 1.5, dead ? C.red : C.teal, 0.1);
  ctx.save();
  ctx.lineWidth = 14 * sc;
  ctx.strokeStyle = dead ? "rgba(248,113,113,0.12)" : "rgba(79,209,197,0.13)";
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]); ctx.strokeStyle = "rgba(79,209,197,0.35)";
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  ctx.restore();
  // direction arrows (clockwise)
  for (let k = 0; k < 3; k++) {
    const a = L.aR + TAU / 6 + (k * TAU) / 3;
    const x0 = cx + r * Math.cos(a - 0.1), y0 = cy + r * Math.sin(a - 0.1), x1 = cx + r * Math.cos(a + 0.1), y1 = cy + r * Math.sin(a + 0.1);
    K.arrow(ctx, x0, y0, x1, y1, "rgba(159,179,207,0.55)", 2);
  }
  // carbon compounds circulating
  const n = 12;
  for (let k = 0; k < n; k++) {
    const a = L.aR + wheelPhase + (k / n) * TAU;
    let rel = (a - L.aR) % TAU; if (rel < 0) rel += TAU;
    const col = rel < TAU / 3 ? COL.pga : rel < (2 * TAU) / 3 ? COL.g3p : COL.rubp;
    K.sphere(ctx, cx + r * Math.cos(a), cy + r * Math.sin(a), 5.5 * sc, col, { alpha: dead ? 0.4 : 1 });
  }
  const out = (a, d) => ({ x: cx + (r + d) * Math.cos(a), y: cy + (r + d) * Math.sin(a) });
  const m1 = out(L.aR + TAU / 6, 18 * sc), m2 = out(L.aR + TAU / 2, 20 * sc), m3 = out(L.aR + (5 * TAU) / 6, 20 * sc);
  K.label(ctx, "3-PGA", m1.x, m1.y, { size: 10, color: "#fed7aa", bg: null });
  K.label(ctx, "G3P", m2.x + 6, m2.y, { size: 10, color: "#d9f99d", bg: null });
  K.label(ctx, "RuBP", m3.x - 6, m3.y, { size: 10, color: "#bfdbfe", bg: null });
  // G3P leaving → glucose
  for (const g of g3ps) {
    const e = K.easeInOut(g.t);
    const x = lerp(L.red.x, cx, e), y = lerp(L.red.y, cy + r * 0.05, e);
    for (let j = 0; j < 3; j++) K.sphere(ctx, x + (j - 1) * 5 * sc, y, 3.4 * sc, COL.g3p);
  }
  // centre: glucose counter + ATP/NADPH supply bars
  const pop = pops.length ? 1 + 0.35 * Math.sin(Math.min(1, pops[pops.length - 1].t * 2) * Math.PI) : 1;
  const hx = 13 * sc * pop;
  drawHex(ctx, cx, cy - r * 0.2, hx, COL.glu, pops.length ? 0.9 : 0.35);
  ctx.save();
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = C.inkFaint; ctx.font = `600 ${Math.round(clamp(10 * sc + 1, 9, 12))}px Inter, system-ui, sans-serif`;
  ctx.fillText("CALVIN CYCLE", cx, cy - r * 0.42);
  ctx.fillStyle = C.ink; ctx.font = `600 ${Math.round(clamp(r * 0.2, 13, 26))}px "Space Grotesk", Inter, sans-serif`;
  ctx.fillText(`${S.glucose} glucose`, cx, cy + r * 0.12);
  ctx.restore();
  const bw = r * 0.85, bh = 5;
  const bars = [[S.atpStore, COL.atp, "ATP"], [S.nadphStore, COL.nadph, "NADPH"]];
  bars.forEach(([v, col, name], i) => {
    const by = cy + r * 0.32 + i * 13;
    ctx.fillStyle = "rgba(255,255,255,0.08)"; K.roundRect(ctx, cx - bw / 2, by, bw, bh, 3); ctx.fill();
    ctx.fillStyle = col; K.roundRect(ctx, cx - bw / 2, by, Math.max(2, (bw * clamp(v, 0, 24)) / 24), bh, 3); ctx.fill();
    if (r > 60) { ctx.fillStyle = C.inkDim; ctx.font = "9px Inter, system-ui, sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(name, cx - bw / 2 - 4, by + bh / 2); }
  });

  // stage labels
  labelFit(L, "② Reduction · ATP + NADPH", L.red.x + 10, L.red.y - 16 * sc, C.inkDim);
  labelFit(L, "③ Regeneration · ATP", L.reg.x, L.reg.y + 34 * sc, C.inkDim);
  // CO₂ molecules
  for (const c of co2s) drawCO2(ctx, c.x, c.y, sc * (c.held ? 1.35 : 1), c.rot, c.a);
  for (const f of flyCO2) {
    const e = K.easeInOut(f.t);
    drawCO2(ctx, lerp(f.sx, L.rub.x, e), lerp(f.sy, L.rub.y, e), sc * (1 - e * 0.4), 0, 1);
  }
  // Rubisco
  drawRubisco(ctx, L.rub.x, L.rub.y, L.rub.r, t, rubPulse, dmg, dead);
  const rubText = dead ? "Rubisco · denatured" : S.manualFixed === 0 ? "① Rubisco · drag CO₂ here" : "① Rubisco · CO₂ fixation";
  labelFit(L, rubText, L.rub.x, L.rub.y - L.rub.r - 14, dead ? C.red : "#a7f3d0");
  if (drag && drag.kind === "co2") {
    ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = K.withAlpha(C.teal, 0.8); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(L.rub.x, L.rub.y, L.rub.r + 20, 0, TAU); ctx.stroke(); ctx.restore();

  }
}

/** Centred label nudged so it stays fully on the stage. */
function labelFit(L, text, x, y, color, size = 10) {
  ctx.font = `600 ${size}px Inter, system-ui, sans-serif`;
  const hw = ctx.measureText(text).width / 2 + 8;
  K.label(ctx, text, clamp(x, hw + 4, L.w - hw - 4), y, { size, color });
}

let calloutCache = { key: "", w: 0, lines: [] };
function drawCallout(L) {
  const [title, body] = INFO[sel.key];
  const maxW = Math.min(280, L.w - 24);
  if (calloutCache.key !== sel.key || calloutCache.w !== maxW) {
    ctx.font = "12px Inter, system-ui, sans-serif";
    calloutCache = { key: sel.key, w: maxW, lines: wrapLines(ctx, body, maxW - 24) };
  }
  const lines = calloutCache.lines;
  const bh = 34 + lines.length * 16 + 18;
  let x = sel.x + 16, y = sel.y + 16;
  if (x + maxW > L.w - 8) x = sel.x - maxW - 16;
  x = clamp(x, 8, L.w - maxW - 8);
  if (y + bh > L.h - 8) y = sel.y - bh - 16;
  y = clamp(y, 8, L.h - bh - 8);
  ctx.save();
  ctx.fillStyle = "rgba(8,18,34,0.94)"; ctx.strokeStyle = K.withAlpha(C.teal, 0.7); ctx.lineWidth = 1.2;
  K.roundRect(ctx, x, y, maxW, bh, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.ink; ctx.font = `600 13px "Space Grotesk", Inter, sans-serif`; ctx.textBaseline = "top"; ctx.textAlign = "left";
  ctx.fillText(title, x + 12, y + 10);
  ctx.fillStyle = C.inkDim; ctx.font = "12px Inter, system-ui, sans-serif";
  lines.forEach((ln, i) => ctx.fillText(ln, x + 12, y + 32 + i * 16));
  ctx.fillStyle = C.inkFaint; ctx.font = "10px Inter, system-ui, sans-serif";
  ctx.fillText("tap elsewhere to close", x + 12, y + bh - 16);
  ctx.restore();
}

// ---------------- chips ----------------
function updateChips() {
  const lname = S.white ? "white" : `${S.lambda} nm`;
  chipLight(S.lampOn ? `Light <b>${S.dcm} cm</b> · ${lname} · <b>${Math.round(model.I * 100)}%</b>` : `Light <b>off</b>`);
  chipCO2(`CO₂ <b>${S.co2.toFixed(2)}%</b>`);
  chipTemp(`Temp <b>${S.temp} °C</b>`);
  chipO2(`O₂ <b>${model.rate.toFixed(model.rate < 10 ? 1 : 0)}</b> bubbles/min`);
  chipGlu(`Glucose <b>${S.glucose}</b>`);
  let name;
  if (!S.lampOn) name = "Light (lamp off)";
  else if (model.lim === "light") name = !S.white && model.a < 0.35 ? "Light (colour poorly absorbed)" : "Light intensity";
  else if (model.lim === "co2") name = "CO₂";
  else name = S.temp >= 33 ? "Temperature (too hot)" : S.temp < 20 ? "Temperature (too cold)" : "Temperature";
  const html = `Limiting factor: <b>${name}</b>`;
  if (limChipEl.innerHTML !== html) limChipEl.innerHTML = html;
  limChipEl.style.color = LIMCOL[model.lim];
}

// ---------------- main loop ----------------
let frame = 0, lastGraph = 0;
const Lp = K.loop((dt, t) => {
  frame++;
  G = layout();
  update(dt, t);
  draw(t);
  updateChips();
  missions.update();
  const now = performance.now();
  if (graph.sweep) { graph.sweep.t = Math.min(1, graph.sweep.t + (now - (graph.last || now)) / 2200); }
  graph.last = now;
  if (graph.sweep && graph.sweep.t >= 1) finishSweep();
  if (now - lastGraph > 50) { drawGraph(now); lastGraph = now; }
  if (frame % 15 === 0) updateExplain();
});
Lp.speed = reduced ? 0.5 : 1;
updateExplain();
