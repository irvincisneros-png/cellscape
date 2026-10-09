// Enzyme Lab as a CellScape level: a 3D volume of cytosol (scene3d.js) driven by the reviewed 2D model (model.js).
// Used inside the zoomable plant cell ("Zoom into the cytosol") and on its own page (sims/enzymes/index.html).
import * as THREE from "three";
import * as K from "../../assets/js/kit.js";
import * as M from "./model.js";
import { LOOK, CI_COL, NI_COL, DEAD_COL, SITE_COL } from "./draw.js";
import { Scene3D, WW, WH, S as SC } from "./scene3d.js";
import { REACTION, NAMES, INHIB, PLANT_NOTE, NOT_TO_SCALE, QUIZ, narrative } from "./content.js";

const CSS = `
.lbl3d.ez-tag { background: rgba(5,11,22,0.7); border: 1px solid rgba(120,190,255,0.25); padding: 1px 7px; border-radius: 999px; font-size: 0.7rem; color: var(--ink); }
.lbl3d.ez-tag.site { border-color: ${SITE_COL}; color: ${SITE_COL}; }
.lbl3d.ez-tag.allo { border-color: ${NI_COL}; color: ${NI_COL}; }
.lbl3d.ez-tag.guide { color: var(--ink); }
.lbl3d.ez-status { background: rgba(5,11,22,0.85); border: 1px solid var(--accent); padding: 4px 9px; border-radius: 10px; font-size: 0.74rem; max-width: 240px; white-space: normal; text-align: center; }
.lbl3d.ez-float { font-weight: 700; font-size: 0.82rem; text-shadow: 0 1px 8px #000, 0 0 12px rgba(0,0,0,0.8); }
.ez-hint { position: absolute; left: 50%; bottom: 86px; transform: translateX(-50%); z-index: 3; max-width: calc(100% - 32px); text-align: center;
  background: rgba(5,11,22,0.82); border: 1px solid var(--panel-border); border-radius: 12px; padding: 7px 12px; font-size: 0.8rem; color: var(--ink); pointer-events: none; transition: opacity 0.6s; }
.ez-meter { min-width: 170px; }
.ez-meter .bar { display: flex; height: 8px; border-radius: 4px; overflow: hidden; background: rgba(255,255,255,0.08); margin-top: 4px; }
.ez-meter .bar i { display: block; height: 100%; }
.ez-graph { width: 100%; height: 210px; display: block; margin-top: 10px; border-radius: 10px; background: rgba(5,11,22,0.55); }
.ez-sel .io { display: grid; grid-template-columns: auto 1fr; gap: 3px 8px; font-size: 0.84rem; margin: 6px 0; }
.ez-sel .io b { color: var(--ink-faint); font-weight: 600; }
.explain .now { border-top: 1px solid var(--panel-border); padding-top: 8px; margin-top: 8px; font-size: 0.86rem; }
@media (max-width: 600px) { .ez-chip-opt { display: none; } .ez-meter { min-width: 130px; } .ez-hint { bottom: 92px; font-size: 0.74rem; } }
`;

const VARS = {
  temp: { name: "Temperature", axis: "Temperature (°C)", key: "temp", xs: [0, 10, 20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80], min: 0, max: 80 },
  pH: { name: "pH", axis: "pH", key: "pH", xs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], min: 0, max: 14 },
  nS: { name: "[Substrate]", axis: "Substrate (molecules)", key: "nS", xs: [0, 10, 20, 35, 50, 75, 100, 150, 200], min: 0, max: 200 },
  nE: { name: "[Enzyme]", axis: "Enzyme (molecules)", key: "nE", xs: [2, 4, 6, 9, 12, 16, 20, 24], min: 0, max: 24 },
};
const SPAN = 40;                 // seconds of simulated time counted per point
const RUN_COLS = ["#4fd1c5", "#fbbf24", "#f472b6", "#a78bfa"];

/** Least-squares Michaelis–Menten fit v = Vmax·S/(Km + S) (grid search on Km, closed form for Vmax). */
function mmFit(pts) {
  let best = null;
  for (let Km = 2; Km <= 600; Km *= 1.04) {
    let num = 0, den = 0;
    for (const p of pts) { const f = p.x / (Km + p.x); num += p.y * f; den += f * f; }
    if (!den) continue;
    const V = num / den;
    let sse = 0;
    for (const p of pts) { const e = p.y - (V * p.x) / (Km + p.x); sse += e * e; }
    if (!best || sse < best.sse) best = { V, Km, sse };
  }
  return best;
}

export function create(engine) {
  if (!document.getElementById("enz-css")) {
    const st = document.createElement("style");
    st.id = "enz-css"; st.textContent = CSS;
    document.head.appendChild(st);
  }
  const lens = engine.lens;
  const reduced = engine.reducedMotion;
  const toast = (m, ms) => engine.toast?.(m, ms);
  const pick = (v) => lens.pick(v);
  const y7 = () => lens.band === "y7-8";
  const senior = () => lens.atLeast("y11");

  const overlay = document.createElement("div"); overlay.style.display = "contents";
  const labelLayer = document.createElement("div"); labelLayer.style.display = "contents";
  const hintEl = document.createElement("div"); hintEl.className = "ez-hint";

  // ---------- model ----------
  const state = { enzyme: "amylase", temp: 37, pH: 7, nS: 60, nE: 12, nCI: 0, nNI: 0, topUp: true };
  let world = null;
  const ui = {};  // current panel element refs
  const G = new Scene3D(engine, labelLayer);
  G.setEnzyme(state.enzyme);
  const L = { running: true, speed: reduced ? 0.5 : 1 };
  let sel = null, selMade0 = 0, followPos = new THREE.Vector3(), drag = null, spin = null, hoverE = null;
  let interacted = false, hintT = 0, disposed = false, handDocks = 0;

  function newWorld() {
    world = M.createWorld(WW, WH, state);
    deselect(); drag = null;
  }

  function syncCount(kind, target) {
    const have = M.count(world, kind);
    if (target > have) for (let i = have; i < target; i++) M.addLigand(world, kind, true);
    else if (target < have) M.removeLigands(world, kind, have - target);
    world.p.nS = state.nS; world.p.nCI = state.nCI; world.p.nNI = state.nNI;
  }
  function syncEnzymes(target) {
    const have = world.enz.length;
    if (target > have) for (let i = have; i < target; i++) M.addEnzyme(world);
    else if (target < have) M.removeEnzymes(world, have - target);
    if (sel && !world.enz.includes(sel)) deselect();
    world.p.nE = target;
  }
  function switchEnzyme(v) {
    state.enzyme = v;
    const E = M.ENZYMES[v];
    state.pH = E.pHopt;
    if (ui.pHS) ui.pHS.value = E.pHopt;
    newWorld();
    G.setEnzyme(v);
    updateLegend();
    toast(`${E.name} loaded — pH set to its optimum (pH ${E.pHopt}).`);
  }
  newWorld();

  // ---------- experiments (kept outside the panel so runs survive a lens change) ----------
  let gVar = "temp", exp = null, tempMoved = false;
  const runs = { temp: [], pH: [], nS: [], nE: [] };
  const tempPeak = {}, pHRun = {};

  function describeRun(p, v) {
    const bits = [M.ENZYMES[p.enzyme].name];
    if (v !== "temp") bits.push(`${p.temp} °C`);
    if (v !== "pH") bits.push(`pH ${p.pH}`);
    if (v !== "nS") bits.push(`S ${p.nS}`);
    if (v !== "nE") bits.push(`E ${p.nE}`);
    if (p.nCI) bits.push(`+${p.nCI} ${senior() ? "comp. inhib." : "look-alike inhib."}`);
    if (p.nNI) bits.push(`+${p.nNI} ${senior() ? "non-comp. inhib." : "shape-changing inhib."}`);
    return bits.join(", ");
  }
  function startExperiment() {
    if (exp) return;
    const v = VARS[gVar], params = { ...state }, list = runs[gVar];
    if (list.length >= 4) list.shift();
    const color = RUN_COLS.find((c) => !list.some((r) => r.color === c)) || RUN_COLS[list.length % 4];
    const run = { color, label: describeRun(params, gVar), pts: [], enzyme: params.enzyme, v: gVar, done: false };
    list.push(run);
    exp = { run, v, params, i: 0, w: null, phase: "warm", m0: 0, last: 0 };
    if (ui.runBtn) ui.runBtn.disabled = true;
    updateRunLegend();
  }
  function stepExperiment() {
    if (!exp) return;
    const t0 = performance.now();
    while (performance.now() - t0 < 7) {
      if (!exp.w) {
        exp.w = M.createWorld(WW, WH, { ...exp.params, [exp.v.key]: exp.v.xs[exp.i], topUp: true }, { headless: true });
        exp.phase = "warm";
      }
      if (exp.phase !== "done") M.step(exp.w, 0.25);
      if (exp.phase === "warm" && exp.w.t >= 3 - 1e-6) { exp.phase = "measure"; exp.m0 = exp.w.made; }
      else if (exp.phase === "measure" && exp.w.t >= 3 + SPAN - 1e-6) { exp.phase = "done"; exp.y = (exp.w.made - exp.m0) / SPAN; }
      if (exp.phase === "done") {
        if (performance.now() - exp.last < 70) break;
        exp.run.pts.push({ x: exp.v.xs[exp.i], y: exp.y });
        exp.last = performance.now();
        exp.i++; exp.w = null;
        if (exp.i >= exp.v.xs.length) { finishExperiment(); return; }
        break;
      }
    }
    if (ui.gStatus) ui.gStatus.textContent = `Measuring point ${exp.i + 1} of ${exp.v.xs.length} (${exp.v.name} = ${exp.v.xs[exp.i]})…`;
  }
  function finishExperiment() {
    const run = exp.run; run.done = true;
    const best = run.pts.reduce((a, b) => (b.y > a.y ? b : a), run.pts[0]);
    if (run.v === "temp") { tempPeak[run.enzyme] = best.x; tempMoved = Math.abs(state.temp - best.x) > 5; }
    if (run.v === "pH") pHRun[run.enzyme] = true;
    if (run.v === "nS") run.fit = mmFit(run.pts);
    let msg = "Run complete. ";
    if (run.v === "temp" || run.v === "pH") msg += `Fastest rate at ${run.v === "pH" ? "pH " : ""}${best.x}${run.v === "temp" ? " °C" : ""} — that's the optimum for this run.`;
    else if (run.v === "nS") msg += senior() && run.fit
      ? `Michaelis–Menten fit (dashed): Vmax ≈ ${run.fit.V.toFixed(1)} products/s, Km ≈ ${Math.round(run.fit.Km)} molecules (the [S] giving ½Vmax).`
      : "Notice the curve levels off: once the active sites are all busy (saturated) the rate reaches its maximum.";
    else msg += "With plenty of substrate, rate is proportional to enzyme concentration.";
    if (ui.gStatus) ui.gStatus.textContent = msg;
    exp = null;
    if (ui.runBtn) ui.runBtn.disabled = false;
    updateRunLegend();
  }
  function updateRunLegend() {
    if (!ui.runLegend) return;
    ui.runLegend.innerHTML = runs[gVar].map((r) => `<span><i style="background:${r.color}"></i>${r.label}${r.done ? "" : " (running…)"}${r.fit && senior() ? ` — Vmax ${r.fit.V.toFixed(1)}/s, Km ${Math.round(r.fit.Km)}` : ""}</span>`).join("");
  }

  const niceStep = (span) => { for (const s of [0.5, 1, 2, 5, 10, 20]) if (span / s <= 6) return s; return 50; };
  let liveRate = 0, busySm = 0, niSm = 0, ciSm = 0;

  function drawGraph() {
    const cv = ui.gCanvas;
    if (!cv || !cv.clientWidth) return;
    const g = cv.getContext("2d"), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth, h = cv.clientHeight || 210;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const v = VARS[gVar], list = runs[gVar];
    const L0 = 38, R0 = 10, T0 = 12, B0 = 32, pw = w - L0 - R0, ph = h - T0 - B0;
    let ymax = 1;
    for (const r of list) for (const p of r.pts) ymax = Math.max(ymax, p.y);
    ymax = Math.max(ymax, liveRate);
    const ys = niceStep(ymax * 1.15);
    ymax = Math.ceil((ymax * 1.15) / ys) * ys;
    const X = (x) => L0 + ((x - v.min) / (v.max - v.min)) * pw, Y = (y) => T0 + ph - (y / ymax) * ph;
    g.font = "11px Inter, system-ui, sans-serif";
    g.strokeStyle = "rgba(159,179,207,0.15)"; g.fillStyle = "#6a7f9c"; g.lineWidth = 1;
    g.textAlign = "right"; g.textBaseline = "middle";
    for (let y = 0; y <= ymax + 1e-9; y += ys) { g.beginPath(); g.moveTo(L0, Y(y)); g.lineTo(L0 + pw, Y(y)); g.stroke(); g.fillText(ys < 1 ? y.toFixed(1) : String(y), L0 - 5, Y(y)); }
    g.textAlign = "center"; g.textBaseline = "top";
    const xs = (v.max - v.min) / (gVar === "pH" ? 7 : gVar === "nE" ? 6 : 8);
    for (let x = v.min; x <= v.max + 1e-9; x += xs) g.fillText(String(Math.round(x)), X(x), T0 + ph + 4);
    g.fillStyle = "#9fb3cf";
    g.fillText(v.axis, L0 + pw / 2, h - 14);
    g.save(); g.translate(10, T0 + ph / 2); g.rotate(-Math.PI / 2); g.textBaseline = "middle"; g.fillText("Rate (products/s)", 0, 0); g.restore();
    g.strokeStyle = "rgba(159,179,207,0.5)";
    g.beginPath(); g.moveTo(L0, T0); g.lineTo(L0, T0 + ph); g.lineTo(L0 + pw, T0 + ph); g.stroke();
    for (const r of list) {
      if (r.pts.length > 1) {
        g.strokeStyle = K.withAlpha(r.color, 0.7); g.lineWidth = 2; g.lineJoin = "round";
        g.beginPath(); r.pts.forEach((p, i) => (i ? g.lineTo(X(p.x), Y(p.y)) : g.moveTo(X(p.x), Y(p.y)))); g.stroke();
      }
      for (const p of r.pts) { g.fillStyle = r.color; g.beginPath(); g.arc(X(p.x), Y(p.y), 3.6, 0, K.TAU); g.fill(); g.strokeStyle = "#050b16"; g.lineWidth = 1; g.stroke(); }
      if (r.done && (gVar === "temp" || gVar === "pH") && r.pts.length) {
        const b = r.pts.reduce((a, c) => (c.y > a.y ? c : a), r.pts[0]);
        g.strokeStyle = K.withAlpha(r.color, 0.5); g.setLineDash([3, 3]);
        g.beginPath(); g.moveTo(X(b.x), Y(b.y) - 6); g.lineTo(X(b.x), T0 + ph); g.stroke(); g.setLineDash([]);
      }
      if (r.fit && senior() && gVar === "nS") {
        const { V, Km } = r.fit;
        g.strokeStyle = K.withAlpha(r.color, 0.9); g.lineWidth = 1.5; g.setLineDash([5, 4]);
        g.beginPath();
        for (let k = 0; k <= 60; k++) { const s = (k / 60) * v.max, y = (V * s) / (Km + s); k ? g.lineTo(X(s), Y(y)) : g.moveTo(X(s), Y(y)); }
        g.stroke();
        g.strokeStyle = K.withAlpha(r.color, 0.45);
        g.beginPath(); g.moveTo(L0, Y(V)); g.lineTo(L0 + pw, Y(V)); g.stroke();
        if (Km <= v.max) { g.beginPath(); g.moveTo(L0, Y(V / 2)); g.lineTo(X(Km), Y(V / 2)); g.lineTo(X(Km), T0 + ph); g.stroke(); }
        g.setLineDash([]);
        g.fillStyle = r.color; g.textAlign = "right"; g.textBaseline = "bottom";
        g.fillText("Vmax", L0 + pw, Y(V) - 2);
        if (Km <= v.max) { g.textAlign = "left"; g.textBaseline = "bottom"; g.fillText("Km", X(Km) + 3, T0 + ph - 2); }
      }
    }
    const cur = state[v.key];
    if (cur >= v.min && cur <= v.max) {
      const px = X(cur), py = Y(Math.min(liveRate, ymax));
      g.strokeStyle = "#e8f1ff"; g.lineWidth = 1.5;
      g.beginPath(); g.arc(px, py, 5.5, 0, K.TAU); g.stroke();
      g.fillStyle = "#e8f1ff"; g.textAlign = px > L0 + pw - 40 ? "right" : "left"; g.textBaseline = "bottom";
      g.fillText("live", px + (px > L0 + pw - 40 ? -8 : 8), py - 4);
    }
    if (!list.length) { g.fillStyle = "#6a7f9c"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("Press “Run experiment” to measure rate", L0 + pw / 2, T0 + ph / 2); }
  }

  function updateLegend() {
    if (!ui.legend) return;
    const lk = LOOK[state.enzyme], E = M.ENZYMES[state.enzyme], N = NAMES[state.enzyme];
    const rows = [[lk.enzyme, `${E.name} (enzyme)`], [lk.subCol, `Substrate: ${pick(N.sub)}`], [lk.prodCol, `Product: ${pick(N.prod)}`], [SITE_COL, "Active site (glowing groove)"]];
    if (!y7()) rows.push([CI_COL, pick(INHIB.CI)], [NI_COL, pick(INHIB.NI)]);
    rows.push([DEAD_COL, y7() ? "Broken (denatured) enzyme — an unravelled chain" : "Denatured enzyme — an unravelled chain"]);
    ui.legend.innerHTML = rows.map(([c, t]) => `<span><i style="background:${c}"></i>${t}</span>`).join("");
  }

  // ---------- missions ----------
  const holds = {};
  let frameDt = 0, heatArmed = false, heatDead = 0;
  let St = { busy: 0, dead: 0, ci: 0, ni: 0, nE: 1 };
  const hold = (k, cond, secs) => { holds[k] = cond ? (holds[k] || 0) + frameDt : 0; return holds[k] >= secs; };
  const MISSIONS = [
    { maxBand: "y9-10", text: "Drag a substrate molecule into an enzyme's active site yourself (tap it first to turn it the right way).", check: () => handDocks >= 1 },
    { maxBand: "y7-8", text: "Enzymes aren't used up: tap an enzyme to follow it, and watch it make 3 products.", check: () => sel && sel.v3 && sel.v3.made - selMade0 >= 3 },
    { maxBand: "y7-8", text: "Heat breaks enzymes: raise the temperature until at least 70 % of them have unravelled.", check: () => heatDead >= 0.7 },
    { maxBand: "y7-8", text: "Now cool them below 30 °C. Do they start working again?", check: () => heatArmed && hold("cool", state.temp <= 30 && heatDead >= 0.7, 2.5) },
    { maxBand: "y7-8", text: "Cold isn't the same as broken: keep it at 10 °C or colder for 5 s with no broken enzymes.", check: () => hold("cold", state.temp <= 10 && St.dead === 0, 5) },
    { maxBand: "y7-8", text: "Shape matters: change the pH until the active site fits the substrate less than half as well as at its best.", check: () => hold("ph", M.fitPH(M.ENZYMES[state.enzyme], state.pH) < 0.5, 1.5) },
    { band: "y9-10", text: "Find the optimum temperature: run a Temperature experiment, then set the slider to the peak (±5 °C).", check: () => !exp && tempMoved && tempPeak[state.enzyme] != null && Math.abs(state.temp - tempPeak[state.enzyme]) <= 5 },
    { band: "y9-10", text: "Denature ≥ 70 % of the enzyme with heat, then cool below 30 °C. Does the rate come back?", check: () => heatArmed && hold("cool", state.temp <= 30 && heatDead >= 0.7, 2.5) },
    { band: "y9-10", maxBand: "y9-10", text: "Reach the maximum rate: add substrate until it levels off with ≥ 70 % of enzymes busy (no inhibitors).", check: () => hold("vmax", busySm >= 0.7 && state.nS >= 100 && !state.nCI && !state.nNI, 1.5) },
    { band: "y9-10", maxBand: "y9-10", text: "Compare optimum pH: run a pH experiment for amylase AND for pepsin.", check: () => pHRun.amylase && pHRun.pepsin },
    { band: "y9-10", maxBand: "y9-10", text: "Run an [Enzyme] experiment: how does rate change with the amount of enzyme?", check: () => runs.nE.some((r) => r.done) },
    { band: "y11", text: "Run a [Substrate] experiment and read Vmax and Km from the Michaelis–Menten fit.", check: () => runs.nS.some((r) => r.done && r.fit) },
    { band: "y11", text: "Watch induced fit: tap an enzyme to follow it until its active site closes around a substrate.", check: () => sel && sel.state === "ok" && sel.site?.kind === "S" && sel.close > 0.85 },
    { band: "y11", text: "Add ≥ 15 competitive inhibitor molecules, then out-compete them by flooding with substrate (≥ 60 % busy).", check: () => hold("ci", state.nCI >= 15 && busySm >= 0.6, 1.5) },
    { band: "y11", text: "Show non-competitive inhibition can't be beaten: ≥ 15 non-competitive inhibitors, substrate ≥ 150, and ≥ 40 % of enzymes still blocked.", check: () => hold("ni", state.nNI >= 15 && state.nS >= 150 && niSm >= 0.4, 3) },
  ];

  // ---------- panel (built once per year band; re-attached on later mounts) ----------
  let progress = null, panelEl = null;
  const plantNote = document.createElement("section");
  plantNote.className = "card";
  function buildPanel(el) {
    panelEl = el;
    if (progress) progress.node.remove();
    const host = document.createElement("div");
    host.style.display = "contents";
    el.appendChild(host);
    progress = { band: lens.band, node: host };
    for (const k of Object.keys(ui)) delete ui[k];
    plantNote.innerHTML = pick(PLANT_NOTE);
    host.appendChild(plantNote);

    const ex = K.card(host, "What's happening", "explain");
    ui.exHead = document.createElement("p");
    ui.exBody = document.createElement("div");
    ui.exBody.setAttribute("aria-live", "polite");
    const note = document.createElement("p");
    note.className = "hint";
    note.innerHTML = pick(NOT_TO_SCALE);
    ex.append(ui.exHead, ui.exBody, note);

    ui.selCard = K.card(host, "Selected enzyme", "ez-sel");
    ui.selCard.style.display = "none";

    const c = K.card(host, "Conditions");
    ui.enzSeg = K.segmented(c, [{ value: "amylase", label: "Amylase" }, { value: "pepsin", label: "Pepsin" }, { value: "catalase", label: "Catalase" }], state.enzyme, (v) => switchEnzyme(v));
    ui.enzSeg.el.style.marginBottom = "10px";
    K.slider(c, { label: "Temperature", min: 0, max: 80, value: state.temp, unit: " °C", onInput: (v) => { state.temp = v; world.p.temp = v; tempMoved = true; } });
    ui.pHS = K.slider(c, { label: "pH", min: 0, max: 14, step: 0.5, value: state.pH, format: (v) => `pH ${v.toFixed(1)}`, onInput: (v) => { state.pH = v; world.p.pH = v; } });
    K.slider(c, { label: y7() ? "Amount of substrate" : "Substrate concentration", min: 0, max: 200, step: 5, value: state.nS, format: (v) => `${v} molecules`, onInput: (v) => { state.nS = v; syncCount("S", v); } });
    K.slider(c, { label: y7() ? "Amount of enzyme" : "Enzyme concentration", min: 2, max: 24, value: state.nE, format: (v) => `${v} molecules`, onInput: (v) => { state.nE = v; syncEnzymes(v); } });
    if (!y7()) {
      K.slider(c, { label: pick(INHIB.CI), min: 0, max: 40, value: state.nCI, format: (v) => `${v} molecules`, onInput: (v) => { state.nCI = v; syncCount("CI", v); } });
      K.slider(c, { label: pick(INHIB.NI), min: 0, max: 30, value: state.nNI, format: (v) => `${v} molecules`, onInput: (v) => { state.nNI = v; syncCount("NI", v); } });
    }
    K.checkbox(c, y7() ? "Keep adding substrate as it's used up" : "Top up substrate (keep concentration constant)", state.topUp, (v) => { state.topUp = v; world.p.topUp = v; });

    const sim = K.card(host, "Simulation");
    const row = K.buttonRow(sim);
    const pauseBtn = K.button(row, L.running ? "Pause" : "Play", () => { L.running = !L.running; pauseBtn.textContent = L.running ? "Pause" : "Play"; });
    K.button(row, y7() ? "Reset (fresh enzymes)" : "Reset (fresh enzyme)", () => { newWorld(); toast("Fresh enzyme added — all active sites intact."); });
    K.button(row, "Overview", () => { deselect(); const v = G.view(); engine.fly(v.target, v.target.clone().addScaledVector(v.dir.clone().normalize(), v.distance), 0.9); });
    K.slider(sim, { label: "Speed", min: 0.25, max: 3, step: 0.25, value: L.speed, format: (v) => `${v}×`, onInput: (v) => (L.speed = v) });
    sim.insertAdjacentHTML("beforeend", `<p class="hint">${pick({ "y7-8": "Drag a substrate into an active site · tap a molecule to turn it · tap an enzyme to follow it.", "y9-10": "Drag a substrate (or inhibitor) into a site · tap a molecule to rotate it · tap an enzyme to follow and inspect it. Right-drag to look around." })}</p>`);

    if (!y7()) {
      const gc = K.card(host, "Rate experiment");
      gc.insertAdjacentHTML("beforeend", `<p style="font-size:0.82rem">Choose a variable, then run a virtual prac: each point uses a fresh tube of enzyme at the current conditions, incubated 3 s, then products counted for 40 s of simulated time. Real data has scatter — so does this!</p>`);
      ui.varSeg = K.segmented(gc, Object.entries(VARS).map(([value, v]) => ({ value, label: v.name })), gVar, (v) => { gVar = v; drawGraph(); updateRunLegend(); });
      ui.gCanvas = document.createElement("canvas");
      ui.gCanvas.className = "ez-graph";
      ui.gCanvas.setAttribute("role", "img");
      ui.gCanvas.setAttribute("aria-label", "Graph of reaction rate against the chosen variable");
      gc.appendChild(ui.gCanvas);
      const gRow = K.buttonRow(gc);
      ui.runBtn = K.button(gRow, "Run experiment", () => startExperiment(), { kind: "primary" });
      ui.runBtn.disabled = !!exp;
      K.button(gRow, "Clear graph", () => { if (!exp) { runs[gVar] = []; drawGraph(); updateRunLegend(); } });
      ui.gStatus = document.createElement("p");
      ui.gStatus.style.fontSize = "0.82rem";
      ui.gStatus.setAttribute("aria-live", "polite");
      ui.gStatus.textContent = senior()
        ? "Runs stay on the graph so you can overlay a second run (e.g. with an inhibitor). [Substrate] runs get a Michaelis–Menten fit."
        : "Runs stay on the graph so you can overlay a second run to compare.";
      gc.appendChild(ui.gStatus);
      ui.runLegend = document.createElement("div");
      ui.runLegend.className = "legend";
      ui.runLegend.style.gridTemplateColumns = "1fr";
      gc.appendChild(ui.runLegend);
      updateRunLegend();
    }

    const lg = K.card(host, "Key");
    ui.legend = document.createElement("div");
    ui.legend.className = "legend";
    lg.appendChild(ui.legend);
    updateLegend();

    for (const k of Object.keys(holds)) delete holds[k];
    ui.ms = K.missions(host, lens.filter(MISSIONS), (m) => toast(`🎯 Mission complete: ${m.text}`, 3400));
    K.quiz(host, lens.filter(QUIZ));
    updateExplain();
  }

  // ---------- overlay chips + busy meter ----------
  const chipRate = K.chip(overlay), chipMade = K.chip(overlay), chipDead = K.chip(overlay);
  overlay.children[1].classList.add("ez-chip-opt");
  const meter = document.createElement("div");
  meter.className = "chip ez-meter";
  overlay.appendChild(meter);
  function updateChips() {
    const n = Math.max(1, world.enz.length);
    let busy = 0, ci = 0, ni = 0, dead = 0;
    for (const e of world.enz) {
      if (e.state !== "ok") dead++;
      else if (e.allo) ni++;
      else if (e.site && e.site.kind === "CI") ci++;
      else if (e.site) busy++;
    }
    const pc = (v) => `${((v / n) * 100).toFixed(1)}%`;
    chipRate(`${y7() ? "Reactions" : "Rate"} <b>${liveRate.toFixed(1)}</b>/s`);
    chipMade(`Products made <b>${world.made}</b>`);
    chipDead(`${y7() ? "Broken" : "Denatured"} <b>${Math.round(St.dead * 100)} %</b>`);
    const segs = `<i style="width:${pc(busy)};background:#fbbf24"></i><i style="width:${pc(ci)};background:${CI_COL}"></i><i style="width:${pc(ni)};background:${NI_COL}"></i><i style="width:${pc(dead)};background:${DEAD_COL}"></i>`;
    const html = `${y7() ? "Enzymes working" : "Active sites busy"} <b>${Math.round((busy / n) * 100)} %</b><div class="bar">${segs}</div>`;
    if (meter.innerHTML !== html) meter.innerHTML = html;
  }

  // ---------- explain ----------
  function updateExplain() {
    if (!ui.exHead) return;
    const E = M.ENZYMES[state.enzyme];
    const head = `<strong>${E.name}</strong> ${pick(REACTION[state.enzyme])}. ${y7() ? "In animals it works in" : "It works in"} ${E.where}. ${y7() ? "Works best at" : "Optimum ≈"} <strong>${E.Topt} °C</strong>, <strong>pH ${E.pHopt}</strong>.`;
    if (ui.exHead.innerHTML !== head) ui.exHead.innerHTML = head;
    const fit = M.fitPH(E, state.pH);
    const main = narrative(lens.band, { E, st: St, heatDead, niSm, ciSm, busySm, dpH: Math.abs(state.pH - E.pHopt), temp: state.temp, pH: state.pH, nS: M.count(world, "S"), rate: world.t > 4 ? M.rate(world, 4) : 1, fit, hasInhib: state.nCI > 0 || state.nNI > 0 });
    const pct = (v) => `${Math.round(v * 100)} %`;
    let now;
    if (y7()) now = `<strong>Right now:</strong> ${liveRate.toFixed(1)} reactions per second; ${pct(busySm)} of enzymes are working on a substrate; ${pct(St.dead)} broken.`;
    else {
      const parts = [`rate ${liveRate.toFixed(1)} products/s`, `${pct(busySm)} of active sites hold substrate`];
      if (state.nCI || ciSm > 0.01) parts.push(`${pct(ciSm)} ${senior() ? "blocked by competitive inhibitor" : "blocked by look-alike inhibitor"}`);
      if (state.nNI || niSm > 0.01) parts.push(`${pct(niSm)} ${senior() ? "with the allosteric site occupied" : "changed by the shape-changing inhibitor"}`);
      parts.push(`${pct(St.dead)} denatured`);
      if (senior()) parts.push(`active-site fit at this pH ${pct(fit)}`);
      now = `<strong>Now:</strong> ${parts.join("; ")}.`;
    }
    const html = `<p>${main}</p><p class="now">${now}</p>`;
    if (ui.exBody.innerHTML !== html) ui.exBody.innerHTML = html;
  }

  // ---------- selection / inspect ----------
  function statusFor(e) {
    const E = M.ENZYMES[state.enzyme];
    if (e.state !== "ok") return pick({ "y7-8": "Broken — unravelled, active site lost", "y9-10": "Denatured — active site lost (permanent)", y11: "Denatured — tertiary structure lost; the chain has unravelled" });
    if (e.allo) return pick({ "y9-10": "Inhibitor bound elsewhere — active site distorted", y11: "Non-competitive inhibitor on the allosteric site — active site distorted" });
    if (e.site && e.site.kind === "CI") return pick({ "y9-10": "Active site blocked by a look-alike inhibitor", y11: "Competitive inhibitor in the active site" });
    if (e.site) return pick({ "y7-8": "Substrate in the active site — being broken down", "y9-10": "Enzyme–substrate complex", y11: "Enzyme–substrate complex — induced fit: the site closes around the substrate" });
    return pick({ "y7-8": "Waiting — active site empty", "y9-10": `Free — active site empty (fit ${Math.round(M.fitPH(E, state.pH) * 100)} %)` });
  }
  function selectEnzyme(e) {
    if (sel === e) { deselect(); return; }
    sel = e;
    selMade0 = e.v3?.made || 0;
    const p = G.enzWorldPos(e, new THREE.Vector3());
    followPos.copy(p);
    const dir = engine.camera.position.clone().sub(engine.controls.target).normalize();
    engine.fly(p, p.clone().addScaledVector(dir, 6), 0.9);
    updateSel();
  }
  function deselect() { sel = null; if (ui.selCard) ui.selCard.style.display = "none"; }
  function updateSel() {
    const c = ui.selCard;
    if (!c) return;
    if (!sel || !world.enz.includes(sel)) { c.style.display = "none"; if (sel) sel = null; return; }
    const E = M.ENZYMES[state.enzyme], n = (sel.v3?.made || 0) - selMade0;
    const extra = sel.state !== "ok" ? pick({ "y7-8": "It won't fold back up, even if you cool it.", "y9-10": "Denaturation is permanent: cooling or fixing the pH won't refold it." })
      : pick({ "y7-8": "Watch the glowing groove: that's the active site. Only the right-shaped molecule fits.", "y9-10": "The glowing groove is the active site; the dimple on the far side is where a shape-changing inhibitor can bind.", y11: "Watch the lips of the groove close when substrate binds — induced fit. The dimple opposite is the allosteric site." });
    const html = `<h2>Selected enzyme</h2><p style="color:var(--ink);font-weight:600;margin-bottom:4px"><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${LOOK[state.enzyme].enzyme};margin-right:6px"></i>${E.name}</p>
      <div class="io"><b>Now</b><span>${statusFor(sel)}</span><b>Made</b><span>${n} product${n === 1 ? "" : "s"} since you started following it</span></div>
      <p class="hint">${extra}</p><div class="btn-row"><button class="btn" data-a="next">Next enzyme</button><button class="btn" data-a="stop">Stop following</button></div>`;
    if (c.dataset.html !== html) {
      c.dataset.html = html; c.innerHTML = html;
      c.querySelector('[data-a="stop"]').onclick = () => deselect();
      c.querySelector('[data-a="next"]').onclick = () => { const i = world.enz.indexOf(sel); const e = world.enz[(i + 1) % world.enz.length]; sel = null; selectEnzyme(e); };
    }
    c.style.display = "";
  }
  function follow() {
    if (!sel || !world.enz.includes(sel) || !sel.v3) return;
    const p = G.enzWorldPos(sel, _fp);
    _fd.subVectors(p, followPos);
    followPos.copy(p);
    if (engine.busy) return;
    engine.controls.target.add(_fd);
    engine.camera.position.add(_fd);
    if (engine.flight) { engine.flight.t1.add(_fd); engine.flight.p1.add(_fd); }
  }
  const _fp = new THREE.Vector3(), _fd = new THREE.Vector3(), _pp = new THREE.Vector3();

  // ---------- pointer interaction ----------
  function screenOf(x, y, z) {
    const r = engine.canvas.getBoundingClientRect();
    _pp.set(x, y, z).project(engine.camera);
    return { x: r.left + (_pp.x * 0.5 + 0.5) * r.width, y: r.top + (-_pp.y * 0.5 + 0.5) * r.height, ok: _pp.z < 1 };
  }
  function ligandAt(e, hit) {
    const o = hit?.object;
    if (o?.userData.ligKind && o.userData.list) { const l = o.userData.list[hit.instanceId]; if (l && !l.bound) return l; }
    if (o?.userData.enzIdx != null) {
      // tapping near an enzyme's centre selects the enzyme rather than a molecule at its edge
      const en = world.enz[o.userData.enzIdx];
      if (en?.v3) {
        const c = screenOf((en.x - WW / 2) * SC, (WH / 2 - en.y) * SC, en.v3.z);
        const edge = screenOf((en.x - WW / 2) * SC + M.G.R * SC, (WH / 2 - en.y) * SC, en.v3.z);
        if (Math.hypot(e.clientX - c.x, e.clientY - c.y) < 0.6 * Math.hypot(edge.x - c.x, edge.y - c.y)) return null;
      }
    }
    const tol = matchMedia("(pointer: coarse)").matches ? 26 : 18;
    let best = null, bd = tol;
    for (const l of world.lig) {
      if (l.bound || !l.v3 || l.v3.px === undefined) continue;
      const s = screenOf(l.v3.px, l.v3.py, l.v3.pz);
      if (!s.ok) continue;
      const d = Math.hypot(e.clientX - s.x, e.clientY - s.y);
      if (d < bd) { bd = d; best = l; }
    }
    return best;
  }
  function nearestDock(l) {
    let near = null, nd = 90;
    for (const e of world.enz) {
      if (e.state !== "ok") continue;
      if (l.kind === "NI" ? e.allo : e.site) continue;
      const p = l.kind === "NI" ? M.alloSite(e) : M.pocket(e);
      const d = Math.hypot(l.x - p.x, l.y - p.y);
      if (d < nd) { nd = d; near = e; }
    }
    return near;
  }
  function dragUpdate() {
    if (!drag || !drag.moved) return;
    const l = drag.l;
    if (!world.lig.includes(l) || l.bound) { drag = null; return; }
    const ray = engine.setRay(drag.cx, drag.cy).ray;
    if (Math.abs(ray.direction.z) < 1e-3) return;
    const at = (z) => { const t = (z - ray.origin.z) / ray.direction.z; return G.toModelXY(ray.origin.x + ray.direction.x * t, ray.origin.y + ray.direction.y * t); };
    let p = at(l.v3.z);
    const z1 = G.blendZ(world, p.x, p.y, l.v3.z);
    p = at(z1);
    l.v3.z = z1;
    l.x = K.clamp(p.x, 6, WW - 6); l.y = K.clamp(p.y, 6, WH - 6); l.vx = l.vy = 0;
    const res = M.tryDock(world, l);
    if (!res) return;
    const pos = new THREE.Vector3(l.v3.px ?? 0, l.v3.py ?? 0, l.v3.pz ?? 0);
    if (res.ok) {
      if (l.kind === "S") handDocks++;
      G.float(`✓ ${res.reason}`, pos, "#4ade80");
    } else {
      const e = res.e, a = Math.atan2(l.y - e.y, l.x - e.x);
      l.x = e.x + Math.cos(a) * (M.G.R + 22); l.y = e.y + Math.sin(a) * (M.G.R + 22);
      l.vx = Math.cos(a) * 140; l.vy = Math.sin(a) * 140; l.drag = false;
      e.reject = 1;
      G.float(`✗ ${res.reason}`, pos, "#fca5a5");
    }
    drag = null;
  }

  function seenInteraction() { if (!interacted) { interacted = true; hintEl.style.opacity = "0"; } }

  // ---------- level object ----------
  let uiT = 0, exT = 0, gT = 0;
  const level = {
    title: "Enzymes in the cytosol",
    get world() { return world; },          // for testing / teacher console use
    get state() { return state; },
    topics: ["enzymes", "protein-folding"],
    root: G.root,
    pickables: G.pickables,
    metersPerUnit: 3.5e-9,           // enzyme radius 0.9 units → diameter ≈ 6 nm
    get view() { return G.view(); },
    minDistance: 2.2, maxDistance: 46, near: 0.05, far: 400,
    minPolar: 0.55, maxPolar: 2.6, minAzimuth: -1.1, maxAzimuth: 1.1, enablePan: true,
    env: { bg: ["#0b1a30", "#0b3434", "#2c1a4a"], fog: ["#0a2030", 0.016], exposure: 1.02, bloom: [0.5, 0.55, 0.82], aperture: 0.0012 },
    info(obj) {
      const u = obj.userData;
      if (u.enzIdx != null) {
        const e = world.enz[u.enzIdx];
        if (!e) return null;
        return { title: `${M.ENZYMES[state.enzyme].name} (enzyme)${e.state !== "ok" ? " — denatured" : ""} — click to follow` };
      }
      if (u.ligKind === "S") return { title: `${pick(NAMES[state.enzyme].sub)} (substrate) — drag into an active site, tap to rotate` };
      if (u.ligKind === "CI") return { title: `${pick(INHIB.CI)} — drag into an active site` };
      if (u.ligKind === "NI") return { title: `${pick(INHIB.NI)} — drag onto the dimple on an enzyme's back` };
      return null;
    },
    onHover(obj) { hoverE = obj?.userData.enzIdx != null ? world.enz[obj.userData.enzIdx] : null; },
    onPointerDown(e, hit) {
      seenInteraction();
      const l = ligandAt(e, hit);
      if (!l) return false;
      drag = { l, sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY, moved: false };
      try { engine.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      return true;
    },
    onPointerDrag(e) {
      if (!drag) return;
      drag.cx = e.clientX; drag.cy = e.clientY;
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) { drag.moved = true; drag.l.drag = true; }
      dragUpdate();
    },
    onPointerUp() {
      if (!drag) return;
      const l = drag.l;
      if (!drag.moved) { l.a += Math.PI / 4; l.va = 0; spin = { l, k: 1 }; }
      l.drag = false;
      drag = null;
    },
    onClick(e, hit) {
      seenInteraction();
      const o = hit?.object;
      if (o?.userData.enzIdx != null) { const en = world.enz[o.userData.enzIdx]; if (en) selectEnzyme(en); return true; }
      if (o?.userData.ligKind && o.userData.list) { const l = o.userData.list[hit.instanceId]; if (l?.bound) { selectEnzyme(l.bound); return true; } }
      if (sel) deselect();
      return true;
    },
    mountPanel(el) {
      const parent = engine.stack.at(-1)?.id === "cell" ? "cell" : engine.stack.at(-2)?.id;
      plantNote.style.display = parent === "cell" ? "" : "none";
      if (progress && progress.band === lens.band) { panelEl = el; el.appendChild(progress.node); }
      else buildPanel(el);
      engine.overlay.appendChild(overlay);
      engine.labelLayer.appendChild(labelLayer);
      engine.stageEl.appendChild(hintEl);
    },
    unmountPanel() { drag = null; G.hideLabels(); overlay.remove(); labelLayer.remove(); hintEl.remove(); },
    onLens(band) {
      if (band === "y7-8" && (state.nCI || state.nNI)) { state.nCI = state.nNI = 0; syncCount("CI", 0); syncCount("NI", 0); }
      if (panelEl) buildPanel(panelEl); else progress = null;
    },
    update(dt, t, realDt = dt) {
      if (disposed) return;
      const d = L.running ? dt * L.speed : 0;
      frameDt = d;
      if (d > 0) M.step(world, d);
      stepExperiment();
      G.prepare(world);
      for (const f of world.fx) if (!f.counted) { f.counted = true; const e = G.nearestEnzyme(world, f.x, f.y); if (e?.v3) e.v3.made++; }
      St = M.stats(world);
      let hd = 0;
      for (const e of world.enz) if (e.state !== "ok" && e.cause === "heat") hd++;
      heatDead = hd / Math.max(1, world.enz.length);
      if (heatDead >= 0.7) heatArmed = true;
      const a = 1 - Math.exp(-d * 1.5);
      const rNow = M.rate(world, 4);
      liveRate = world.t < 4 ? rNow : liveRate + (rNow - liveRate) * Math.min(1, d * 1.2);
      if (world.t < 4) busySm = St.busy;
      busySm += (St.busy - busySm) * a;
      niSm += (St.ni - niSm) * a;
      ciSm += (St.ci - ciSm) * a;
      if (sel && !world.enz.includes(sel)) deselect();
      if (drag?.moved) dragUpdate();
      const E = M.ENZYMES[state.enzyme];
      let dockTarget = null, dockGood = false;
      if (drag?.moved) {
        dockTarget = nearestDock(drag.l);
        if (dockTarget) dockGood = drag.l.kind === "NI" || M.oriErr(drag.l, dockTarget) <= (drag.l.kind === "S" ? M.G.oriTolS : M.G.oriTolCI) + 0.1;
      }
      G.update(world, d, t, {
        E, sel, drag, dockTarget, dockGood, spin, hoverE, realDt,
        showAllo: !y7(), guide: !interacted || y7(), guideText: `${E.name} (enzyme)`,
        statusText: sel ? statusFor(sel) : "",
      });
      if (spin && spin.k <= 0) spin = null;
      follow();
      hintT += realDt;
      if (!interacted && hintT > 14) seenInteraction();
      ui.ms?.update();
      if ((uiT -= realDt) <= 0) { uiT = 0.2; updateChips(); updateSel(); }
      if ((gT -= realDt) <= 0) { gT = 1 / 12; drawGraph(); }
      if ((exT -= realDt) <= 0) { exT = 0.5; updateExplain(); }
    },
    dispose() { disposed = true; drag = null; overlay.remove(); labelLayer.remove(); hintEl.remove(); progress?.node.remove(); },
  };
  hintEl.textContent = matchMedia("(max-width: 600px)").matches
    ? "Drag a substrate into an active site · tap to rotate · tap an enzyme to follow"
    : "Drag a substrate into an enzyme's active site · tap a molecule to rotate it · tap an enzyme to follow it";
  return level;
}
