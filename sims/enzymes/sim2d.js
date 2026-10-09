// Enzyme Lab — CellScape. Live enzyme kinetics: induced fit, temperature, pH, saturation, inhibitors.
import * as K from "../../assets/js/kit.js";
import * as M from "./model.js";
import { LOOK, CI_COL, NI_COL, DEAD_COL, SITE_COL, buildSprites, drawSprite, drawLigand, drawBubble, drawEnzyme } from "./draw.js";

const stageEl = K.$("#stage");
const panel = K.$("#panel");
const overlay = K.$("#overlay");
const canvas = K.$("#canvas");
const toast = K.toaster(stageEl);
const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- state & world ----------
const state = { enzyme: "amylase", temp: 37, pH: 7, nS: 60, nE: 12, nCI: 0, nNI: 0, topUp: true };
let world = null, sc = 1, W = 600, H = 380, sprites = null, spriteKey = "";
let sel = null;               // enzyme shown in the zoom lens
let drag = null;              // { l, sx, sy, moved }
let msgs = [];                // floating canvas messages
let hintT = 0, interacted = false;
const dust = Array.from({ length: 46 }, () => ({ x: Math.random(), y: Math.random(), z: K.rand(0.3, 1), ph: K.rand(0, K.TAU) }));

const stage = K.createStage(canvas, onResize);
const { ctx } = stage;

function onResize(st) {
  const stage = st;
  const ns = Math.sqrt((stage.w * stage.h) / M.WORLD_AREA) || 1;
  const nW = stage.w / ns, nH = stage.h / ns;
  if (world) {
    const fx = nW / W, fy = nH / H;
    for (const o of [...world.enz, ...world.lig, ...world.prod]) { o.x *= fx; o.y *= fy; }
    world.W = nW; world.H = nH;
  }
  sc = ns; W = nW; H = nH;
}

function ensureSprites() {
  const key = `${state.enzyme}|${(sc * stage.dpr).toFixed(2)}`;
  if (key !== spriteKey) { sprites = buildSprites(state.enzyme, sc * stage.dpr); spriteKey = key; }
}

function newWorld() {
  world = M.createWorld(W, H, state);
  sel = null; drag = null;
}
newWorld();

// ---------- panel: explain ----------
const explain = K.card(panel, "What's happening", "explain");
const exHead = document.createElement("p");
const exBody = document.createElement("p");
exBody.setAttribute("aria-live", "polite");
const exNote = document.createElement("p");
exNote.style.fontSize = "0.8rem";
exNote.innerHTML = `<em>Not to scale:</em> real substrates are far smaller relative to enzymes, molecules are far more numerous, and real catalase works millions of times per second. Shapes are simplified.`;
explain.append(exHead, exBody, exNote);

// ---------- panel: controls ----------
const controls = K.card(panel, "Conditions");
const enzSeg = K.segmented(controls, [
  { value: "amylase", label: "Amylase" }, { value: "pepsin", label: "Pepsin" }, { value: "catalase", label: "Catalase" },
], state.enzyme, (v) => switchEnzyme(v));
enzSeg.el.style.marginBottom = "10px";
K.slider(controls, { label: "Temperature", min: 0, max: 80, value: state.temp, unit: " °C", onInput: (v) => { state.temp = v; world.p.temp = v; tempMoved = true; } });
const pHS = K.slider(controls, { label: "pH", min: 0, max: 14, step: 0.5, value: state.pH, format: (v) => `pH ${v.toFixed(1)}`, onInput: (v) => { state.pH = v; world.p.pH = v; } });
K.slider(controls, { label: "Substrate concentration", min: 0, max: 200, step: 5, value: state.nS, format: (v) => `${v} molecules`, onInput: (v) => { state.nS = v; syncCount("S", v); } });
const enzS = K.slider(controls, { label: "Enzyme concentration", min: 2, max: 24, value: state.nE, format: (v) => `${v} molecules`, onInput: (v) => { state.nE = v; syncEnzymes(v); } });
K.slider(controls, { label: "Competitive inhibitor", min: 0, max: 40, value: state.nCI, format: (v) => `${v} molecules`, onInput: (v) => { state.nCI = v; syncCount("CI", v); } });
K.slider(controls, { label: "Non-competitive inhibitor", min: 0, max: 30, value: state.nNI, format: (v) => `${v} molecules`, onInput: (v) => { state.nNI = v; syncCount("NI", v); } });
K.checkbox(controls, "Top up substrate (keep concentration constant)", state.topUp, (c) => { state.topUp = c; world.p.topUp = c; });

const simCard = K.card(panel, "Simulation");
const row = K.buttonRow(simCard);
const pauseBtn = K.button(row, "Pause", () => { pauseBtn.textContent = L.toggle() ? "Pause" : "Play"; });
K.button(row, "Reset (fresh enzyme)", () => { newWorld(); toast("Fresh enzyme added — all active sites intact."); });
const speedS = K.slider(simCard, { label: "Speed", min: 0.25, max: 3, step: 0.25, value: reduced ? 0.5 : 1, format: (v) => `${v}×`, onInput: (v) => (L.speed = v) });

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
  if (sel && !world.enz.includes(sel)) sel = null;
  world.p.nE = target;
}
function switchEnzyme(v) {
  state.enzyme = v;
  const E = M.ENZYMES[v];
  state.pH = E.pHopt; pHS.value = E.pHopt;
  newWorld();
  ensureSprites();
  updateLegend();
  toast(`${E.name} loaded — pH set to its optimum (pH ${E.pHopt}).`);
}

// ---------- panel: graph ----------
const VARS = {
  temp: { name: "Temperature", axis: "Temperature (°C)", key: "temp", xs: [0, 10, 20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80], min: 0, max: 80 },
  pH: { name: "pH", axis: "pH", key: "pH", xs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], min: 0, max: 14 },
  nS: { name: "[Substrate]", axis: "Substrate (molecules)", key: "nS", xs: [0, 10, 20, 35, 50, 75, 100, 150, 200], min: 0, max: 200 },
  nE: { name: "[Enzyme]", axis: "Enzyme (molecules)", key: "nE", xs: [2, 4, 6, 9, 12, 16, 20, 24], min: 0, max: 24 },
};
const SPAN = 40; // seconds of simulated time counted per point
const RUN_COLS = ["#4fd1c5", "#fbbf24", "#f472b6", "#a78bfa"];
let gVar = "temp";
const runs = { temp: [], pH: [], nS: [], nE: [] };
let exp = null;                       // running experiment
let tempMoved = false;                // temperature slider touched since the last temperature run
const tempPeak = {};                  // enzyme -> optimum found by a temperature run
const pHRun = {};                     // enzyme -> true when a pH run finished

const gCard = K.card(panel, "Rate experiment");
const gIntro = document.createElement("p");
gIntro.style.fontSize = "0.82rem";
gIntro.textContent = "Choose a variable, then run a virtual prac: each point uses a fresh tube of enzyme, incubated 3 s, then products counted for 40 s of simulated time. Real data has scatter — so does this!";
gCard.appendChild(gIntro);
const varSeg = K.segmented(gCard, Object.entries(VARS).map(([value, v]) => ({ value, label: v.name })), gVar, (v) => { gVar = v; drawGraph(); updateRunLegend(); });
const gCanvas = document.createElement("canvas");
gCanvas.style.cssText = "width:100%;height:210px;display:block;margin-top:10px;border-radius:10px;background:rgba(5,11,22,0.55)";
gCanvas.setAttribute("role", "img");
gCanvas.setAttribute("aria-label", "Graph of reaction rate against the chosen variable");
gCard.appendChild(gCanvas);
const gRow = K.buttonRow(gCard);
const runBtn = K.button(gRow, "Run experiment", () => startExperiment(), { kind: "primary" });
K.button(gRow, "Clear graph", () => { if (!exp) { runs[gVar] = []; drawGraph(); updateRunLegend(); } });
const gStatus = document.createElement("p");
gStatus.style.fontSize = "0.82rem";
gStatus.setAttribute("aria-live", "polite");
gStatus.textContent = "Runs stay on the graph so you can overlay a second run (e.g. with an inhibitor) to compare.";
gCard.appendChild(gStatus);
const runLegend = document.createElement("div");
runLegend.className = "legend";
runLegend.style.gridTemplateColumns = "1fr";
gCard.appendChild(runLegend);

function describeRun(p, v) {
  const E = M.ENZYMES[p.enzyme];
  const bits = [E.name];
  if (v !== "temp") bits.push(`${p.temp} °C`);
  if (v !== "pH") bits.push(`pH ${p.pH}`);
  if (v !== "nS") bits.push(`S ${p.nS}`);
  if (p.nCI) bits.push(`+${p.nCI} comp. inhib.`);
  if (p.nNI) bits.push(`+${p.nNI} non-comp. inhib.`);
  return bits.join(", ");
}

function startExperiment() {
  if (exp) return;
  const v = VARS[gVar];
  const params = { ...state };
  const list = runs[gVar];
  if (list.length >= 4) list.shift();
  const color = RUN_COLS.find((c) => !list.some((r) => r.color === c)) || RUN_COLS[list.length % 4];
  const run = { color, label: describeRun(params, gVar), pts: [], enzyme: params.enzyme, v: gVar, done: false };
  list.push(run);
  exp = { run, v, params, i: 0, w: null, phase: "warm", m0: 0, last: 0 };
  runBtn.disabled = true;
  updateRunLegend();
}

function stepExperiment() {
  if (!exp) return;
  const t0 = performance.now();
  while (performance.now() - t0 < 7) {
    if (!exp.w) {
      const x = exp.v.xs[exp.i];
      exp.w = M.createWorld(600, 380, { ...exp.params, [exp.v.key]: x, topUp: true }, { headless: true });
      exp.phase = "warm";
    }
    if (exp.phase !== "done") M.step(exp.w, 0.25);
    if (exp.phase === "warm" && exp.w.t >= 3 - 1e-6) { exp.phase = "measure"; exp.m0 = exp.w.made; }
    else if (exp.phase === "measure" && exp.w.t >= 3 + SPAN - 1e-6) { exp.phase = "done"; exp.y = (exp.w.made - exp.m0) / SPAN; }
    if (exp.phase === "done") {
      if (performance.now() - exp.last < 70) break; // pace the points so the graph visibly fills in
      exp.run.pts.push({ x: exp.v.xs[exp.i], y: exp.y });
      exp.last = performance.now();
      exp.i++; exp.w = null;
      if (exp.i >= exp.v.xs.length) { finishExperiment(); return; }
      break; // one point per frame so the graph visibly fills in
    }
  }
  gStatus.textContent = `Measuring point ${exp.i + 1} of ${exp.v.xs.length} (${exp.v.name} = ${exp.v.xs[exp.i]})…`;
}

function finishExperiment() {
  const run = exp.run; run.done = true;
  const best = run.pts.reduce((a, b) => (b.y > a.y ? b : a), run.pts[0]);
  if (run.v === "temp") { tempPeak[run.enzyme] = best.x; tempMoved = Math.abs(state.temp - best.x) > 5; }
  if (run.v === "pH") pHRun[run.enzyme] = true;
  let msg = "Run complete. ";
  if (run.v === "temp" || run.v === "pH") msg += `Fastest rate at ${run.v === "pH" ? "pH " : ""}${best.x}${run.v === "temp" ? " °C" : ""} — that's the optimum for this run.`;
  else if (run.v === "nS") msg += "Notice the curve levels off: once active sites are saturated the rate reaches Vmax.";
  else msg += "With plenty of substrate, rate is proportional to enzyme concentration.";
  gStatus.textContent = msg;
  exp = null; runBtn.disabled = false;
  updateRunLegend();
}

function updateRunLegend() {
  runLegend.innerHTML = runs[gVar].map((r) => `<span><i style="background:${r.color}"></i>${r.label}${r.done ? "" : " (running…)"}</span>`).join("");
}

const niceStep = (span) => { for (const s of [0.5, 1, 2, 5, 10, 20]) if (span / s <= 6) return s; return 50; };
let liveRate = 0, busySm = 0, niSm = 0;

function drawGraph() {
  const g = gCanvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = gCanvas.clientWidth || 300, h = gCanvas.clientHeight || 210;
  if (gCanvas.width !== Math.round(w * dpr) || gCanvas.height !== Math.round(h * dpr)) {
    gCanvas.width = Math.round(w * dpr); gCanvas.height = Math.round(h * dpr);
  }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const v = VARS[gVar], list = runs[gVar];
  const L0 = 38, R0 = 10, T0 = 12, B0 = 32;
  const pw = w - L0 - R0, ph = h - T0 - B0;
  let ymax = 1;
  for (const r of list) for (const p of r.pts) ymax = Math.max(ymax, p.y);
  ymax = Math.max(ymax, liveRate);
  const ys = niceStep(ymax * 1.15);
  ymax = Math.ceil((ymax * 1.15) / ys) * ys;
  const X = (x) => L0 + ((x - v.min) / (v.max - v.min)) * pw;
  const Y = (y) => T0 + ph - (y / ymax) * ph;
  g.font = "11px Inter, system-ui, sans-serif";
  g.strokeStyle = "rgba(159,179,207,0.15)"; g.fillStyle = "#6a7f9c"; g.lineWidth = 1;
  g.textAlign = "right"; g.textBaseline = "middle";
  for (let y = 0; y <= ymax + 1e-9; y += ys) {
    g.beginPath(); g.moveTo(L0, Y(y)); g.lineTo(L0 + pw, Y(y)); g.stroke();
    g.fillText(ys < 1 ? y.toFixed(1) : String(y), L0 - 5, Y(y));
  }
  g.textAlign = "center"; g.textBaseline = "top";
  const xs = (v.max - v.min) / (gVar === "pH" ? 7 : gVar === "nE" ? 6 : 8);
  for (let x = v.min; x <= v.max + 1e-9; x += xs) g.fillText(String(Math.round(x)), X(x), T0 + ph + 4);
  g.fillStyle = "#9fb3cf";
  g.fillText(v.axis, L0 + pw / 2, h - 14);
  g.save(); g.translate(10, T0 + ph / 2); g.rotate(-Math.PI / 2); g.textBaseline = "middle";
  g.fillText("Rate (products/s)", 0, 0); g.restore();
  g.strokeStyle = "rgba(159,179,207,0.5)";
  g.beginPath(); g.moveTo(L0, T0); g.lineTo(L0, T0 + ph); g.lineTo(L0 + pw, T0 + ph); g.stroke();

  for (const r of list) {
    if (r.pts.length > 1) {
      g.strokeStyle = K.withAlpha(r.color, 0.7); g.lineWidth = 2; g.lineJoin = "round";
      g.beginPath();
      r.pts.forEach((p, i) => (i ? g.lineTo(X(p.x), Y(p.y)) : g.moveTo(X(p.x), Y(p.y))));
      g.stroke();
    }
    for (const p of r.pts) {
      g.fillStyle = r.color; g.beginPath(); g.arc(X(p.x), Y(p.y), 3.6, 0, K.TAU); g.fill();
      g.strokeStyle = "#050b16"; g.lineWidth = 1; g.stroke();
    }
    if (r.done && (gVar === "temp" || gVar === "pH") && r.pts.length) {
      const b = r.pts.reduce((a, c) => (c.y > a.y ? c : a), r.pts[0]);
      g.strokeStyle = K.withAlpha(r.color, 0.5); g.setLineDash([3, 3]);
      g.beginPath(); g.moveTo(X(b.x), Y(b.y) - 6); g.lineTo(X(b.x), T0 + ph); g.stroke(); g.setLineDash([]);
    }
  }
  // live "you are here" marker
  const cur = state[v.key];
  if (cur >= v.min && cur <= v.max) {
    const px = X(cur), py = Y(Math.min(liveRate, ymax));
    g.strokeStyle = "#e8f1ff"; g.lineWidth = 1.5;
    g.beginPath(); g.arc(px, py, 5.5, 0, K.TAU); g.stroke();
    g.fillStyle = "#e8f1ff"; g.textAlign = px > L0 + pw - 40 ? "right" : "left"; g.textBaseline = "bottom";
    g.fillText("live", px + (px > L0 + pw - 40 ? -8 : 8), py - 4);
  }
  if (!list.length) {
    g.fillStyle = "#6a7f9c"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("Press “Run experiment” to measure rate", L0 + pw / 2, T0 + ph / 2);
  }
}

// ---------- panel: legend ----------
const legCard = K.card(panel, "Key");
const legend = document.createElement("div");
legend.className = "legend";
legCard.appendChild(legend);
function updateLegend() {
  const lk = LOOK[state.enzyme], E = M.ENZYMES[state.enzyme];
  legend.innerHTML = [
    [lk.enzyme, `${E.name} (enzyme)`], [lk.subCol, `Substrate: ${lk.sub}`], [lk.prodCol, `Product: ${lk.prod}`],
    [SITE_COL, "Active site"], [CI_COL, "Competitive inhibitor"], [NI_COL, "Non-competitive inhibitor"],
    [DEAD_COL, "Denatured enzyme"],
  ].map(([c, t]) => `<span><i style="background:${c}"></i>${t}</span>`).join("");
}
updateLegend();

// ---------- missions ----------
const holds = {};
let frameDt = 0, heatArmed = false;
const hold = (k, cond, secs) => { holds[k] = cond ? (holds[k] || 0) + frameDt : 0; return holds[k] >= secs; };
let S = { busy: 0, dead: 0, ci: 0, ni: 0, nE: 1 }, heatDead = 0;

const ms = K.missions(panel, [
  { name: "optimum temperature found", text: "Find the optimum temperature: run a Temperature experiment, then set the slider to the peak (±5 °C).", check: () => !exp && tempMoved && tempPeak[state.enzyme] != null && Math.abs(state.temp - tempPeak[state.enzyme]) <= 5 },
  { name: "denaturation is irreversible — cooling didn’t fix it", text: "Denature ≥ 70 % of the enzyme with heat, then cool below 30 °C. Does the rate come back?", check: () => heatArmed && hold("cool", state.temp <= 30 && heatDead >= 0.7, 2.5) },
  { name: "Vmax reached — the enzymes are saturated", text: "Reach Vmax: add substrate until the rate levels off with ≥ 70 % of enzymes busy (no inhibitors).", check: () => hold("vmax", busySm >= 0.7 && !state.nCI && !state.nNI, 1.5) },
  { name: "competitive inhibitor out-competed", text: "Add ≥ 15 competitive inhibitor molecules, then beat them by flooding with substrate (≥ 60 % busy).", check: () => hold("ci", state.nCI >= 15 && busySm >= 0.6, 1.5) },
  { name: "non-competitive inhibition can’t be beaten by substrate", text: "Show non-competitive inhibition can't be beaten: ≥ 15 non-competitive inhibitors, substrate ≥ 150, and ≥ 40 % of enzymes still blocked.", check: () => hold("ni", state.nNI >= 15 && state.nS >= 150 && niSm >= 0.4, 3) },
  { name: "pepsin vs amylase pH optima compared", text: "Compare optimum pH: run a pH experiment for amylase AND for pepsin.", check: () => pHRun.amylase && pHRun.pepsin },
], (m) => toast(`✅ Mission complete: ${m.name}`, 3200));

// ---------- quiz ----------
K.quiz(panel, [
  {
    q: "How does the induced-fit model differ from the lock-and-key model?",
    options: ["Induced fit says the active site is rigid and exactly matches the substrate", "Induced fit says the active site changes shape slightly, moulding around the substrate as it binds", "Induced fit says the substrate permanently changes the enzyme", "There is no difference"],
    answer: 1, why: "Lock-and-key pictures a rigid active site. In induced fit the active site is flexible: binding the substrate makes it close around it, which strains the bonds and helps the reaction.",
  },
  {
    q: "Why does adding more and more substrate eventually stop increasing the rate?",
    options: ["The extra substrate denatures the enzyme", "The enzyme gets used up", "All active sites are occupied (saturated), so the rate is at its maximum, Vmax", "Products are destroyed"],
    answer: 2, why: "At high substrate concentration every active site is busy almost all the time. The enzyme concentration is now the limiting factor, so the rate plateaus at Vmax.",
  },
  {
    q: "Amylase is heated to 70 °C, then cooled back to 37 °C. What happens to its activity?",
    options: ["It stays very low — heat permanently changed the active site's shape (denaturation)", "It returns to normal once cool", "It becomes faster than before", "It now breaks down protein instead"],
    answer: 0, why: "High temperature breaks the weak bonds holding the enzyme's 3-D shape. The active site unfolds and does not reform on cooling — denaturation is irreversible.",
  },
  {
    q: "An inhibitor's effect disappears when lots of extra substrate is added. What type of inhibitor is it?",
    options: ["Non-competitive — it binds an allosteric site", "Competitive — it competes with substrate for the active site", "A denaturing agent", "It must be a product of the reaction"],
    answer: 1, why: "A competitive inhibitor and substrate compete for the same active site, so flooding with substrate wins most sites back. A non-competitive inhibitor changes the active site's shape from elsewhere, so more substrate cannot help.",
  },
  {
    q: "What happens to an enzyme molecule after it catalyses a reaction?",
    options: ["It is broken down with the substrate", "It becomes one of the products", "It must be made again by the cell", "It is unchanged and can catalyse the reaction again"],
    answer: 3, why: "Enzymes are biological catalysts: they speed up reactions without being used up. One enzyme can catalyse thousands of reactions.",
  },
  {
    q: "Pepsin works best at pH 2 but amylase at pH 7. Why?",
    options: ["Each active site's shape depends on the charges on its amino acids, and each enzyme is suited to the pH where it works", "Acid speeds up every enzyme", "Pepsin is not a protein", "Amylase only works in cold conditions"],
    answer: 0, why: "H⁺ ions alter charges on amino acids in the active site. Pepsin works in acidic stomach juice; amylase works in near-neutral saliva and the small intestine.",
  },
]);

// ---------- chips ----------
const chipRate = K.chip(overlay), chipBusy = K.chip(overlay), chipDead = K.chip(overlay), chipMade = K.chip(overlay);

// ---------- explain text ----------
let exT = 0;
function updateExplain() {
  const E = M.ENZYMES[state.enzyme];
  exHead.innerHTML = `<strong>${E.name}</strong> catalyses <strong>${E.reaction}</strong>. It works in ${E.where}. Optimum ≈ <strong>${E.Topt} °C</strong>, <strong>pH ${E.pHopt}</strong>.`;
  const heat = heatDead >= 0.3;
  const dpH = Math.abs(state.pH - E.pHopt);
  let t;
  if (S.dead >= 0.6) {
    t = `Most enzymes are <strong>denatured</strong>. ${heat ? "Heat" : "Extreme pH"} broke the weak bonds holding each protein's 3-D shape, so the <strong>active site has unfolded</strong> and substrate no longer fits. This is <strong>irreversible</strong> — ${heat ? "cooling" : "returning to the optimum pH"} will not refold them. Only fresh enzyme (Reset) restores the rate.`;
  } else if (state.temp > E.Topt + 3 && S.dead > 0.02) {
    t = `Above the optimum the molecules move fast, but enzymes are <strong>denaturing one by one</strong> (they turn grey and unravel). The rate may rise briefly, then falls as active sites are permanently lost.`;
  } else if (state.pH !== E.pHopt && dpH > E.pHden && S.dead > 0.02) {
    t = `This pH is far from the optimum, so enzymes are <strong>denaturing</strong>: the active site's shape is permanently destroyed.`;
  } else if (niSm >= 0.25) {
    t = `<strong>Non-competitive inhibitors</strong> (green) have bound the <strong>allosteric site</strong> on the back of many enzymes. This changes the shape of the active site, so those enzymes cannot work. Adding more substrate <strong>can't</strong> overcome this — Vmax is lowered.`;
  } else if (S.ci >= 0.2) {
    t = `<strong>Competitive inhibitors</strong> (red) are similar in shape to the substrate, so they sit in active sites and block them — but don't react. Because they <strong>compete</strong> with substrate, flooding the solution with more substrate wins most active sites back.`;
  } else if (dpH >= 1.5) {
    t = `pH ${state.pH} is away from the optimum. H⁺ ions change the charges on amino acids in the active site, <strong>distorting its shape</strong>, so substrate binds less often. Near the optimum this is <strong>reversible</strong>; at extreme pH the enzyme denatures permanently.`;
  } else if (state.temp <= 20) {
    t = `It's cold: molecules move slowly and have less kinetic energy, so there are fewer <strong>successful collisions</strong> and each reaction is slower. The enzymes are <strong>not damaged</strong> — warming them restores the rate.`;
  } else if (busySm >= 0.65) {
    t = `<strong>Saturation:</strong> almost every active site is occupied, so the rate is near its maximum, <strong>Vmax</strong>. Adding more substrate barely helps — now <strong>enzyme concentration</strong> limits the rate.`;
  } else if (state.nS < 20) {
    t = `There is little substrate, so most active sites are empty. The rate is limited by how often substrate <strong>collides</strong> with an active site — adding substrate will speed it up.`;
  } else {
    t = `Substrate molecules collide with enzymes at random. When one hits the <strong>active site</strong> in the right orientation it binds, forming an <strong>enzyme–substrate complex</strong>. The active site closes around it (<strong>induced fit</strong>), bonds break and the <strong>products</strong> are released. The enzyme is <strong>not used up</strong> — it catalyses again and again.`;
  }
  if (exBody.innerHTML !== t) exBody.innerHTML = t;
}

// ---------- pointer interaction ----------
const toWorld = (p) => ({ x: p.x / sc, y: p.y / sc });
let lens = null; // {x, y, r} in screen px when visible

function addMsg(text, x, y, col = "#e8f1ff") { msgs.push({ text, x, y, t: 0, col }); if (msgs.length > 5) msgs.shift(); }

K.pointer(canvas, {
  down(p) {
    interacted = true;
    if (lens && K.dist(p.x, p.y, lens.x, lens.y) < lens.r) { sel = null; return; }
    const pw = toWorld(p);
    let bestE = null, bd = Infinity;
    for (const e of world.enz) { const d = K.dist(pw.x, pw.y, e.x, e.y); if (d < bd) { bd = d; bestE = e; } }
    if (bestE && bd < M.G.R * 0.7) { sel = sel === bestE ? null : bestE; return; }
    const hit = Math.max(24 / sc, 14);
    let bestL = null, bl = hit;
    for (const l of world.lig) { if (l.bound) continue; const d = K.dist(pw.x, pw.y, l.x, l.y); if (d < bl) { bl = d; bestL = l; } }
    if (bestL) { drag = { l: bestL, sx: p.x, sy: p.y, moved: false }; return; }
    if (bestE && bd < M.G.R + Math.max(6, 22 / sc)) { sel = sel === bestE ? null : bestE; return; }
    sel = null;
  },
  move(p) {
    if (!drag || !p.isDown) return;
    if (!drag.moved && K.dist(p.x, p.y, drag.sx, drag.sy) > 6) { drag.moved = true; drag.l.drag = true; }
    if (!drag.moved) return;
    const l = drag.l, pw = toWorld(p);
    if (!world.lig.includes(l)) { drag = null; return; }
    l.x = K.clamp(pw.x, 6, W - 6); l.y = K.clamp(pw.y, 6, H - 6); l.vx = l.vy = 0;
    const res = M.tryDock(world, l);
    if (res) {
      if (res.ok) { addMsg(`✓ ${res.reason}`, p.x, p.y - 24, "#4ade80"); }
      else {
        const e = res.e, a = Math.atan2(l.y - e.y, l.x - e.x);
        l.x = e.x + Math.cos(a) * (M.G.R + 22); l.y = e.y + Math.sin(a) * (M.G.R + 22);
        l.vx = Math.cos(a) * 140; l.vy = Math.sin(a) * 140; l.drag = false;
        e.reject = 1;
        addMsg(`✗ ${res.reason}`, p.x, p.y - 24, "#fca5a5");
      }
      drag = null;
    }
  },
  up() {
    if (!drag) return;
    const l = drag.l;
    if (!drag.moved) { l.a += Math.PI / 4; l.va = 0; l.spin = 1; }
    l.drag = false;
    drag = null;
  },
});

// ---------- rendering ----------
function drawBackground(t) {
  K.backdrop(ctx, stage.w, stage.h, "#1a2d52");
  const g = ctx.createRadialGradient(stage.w * 0.8, stage.h * 0.85, 0, stage.w * 0.8, stage.h * 0.85, Math.max(stage.w, stage.h) * 0.7);
  g.addColorStop(0, "rgba(13,59,68,0.45)"); g.addColorStop(1, "rgba(13,59,68,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, stage.w, stage.h);
  for (const d of dust) {
    const x = ((d.x + t * 0.004 * d.z) % 1) * stage.w, y = (d.y + Math.sin(t * 0.3 + d.ph) * 0.01) * stage.h;
    const r = 3 + d.z * 6;
    ctx.globalAlpha = 0.08 + d.z * 0.12;
    ctx.drawImage(sprites.dust.c, x - r, y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
}

function drawWorld() {
  const E = M.ENZYMES[state.enzyme];
  const dd = 1 - M.fitPH(E, state.pH);
  const skew = state.pH >= E.pHopt ? 1 : -1;
  const base = LOOK[state.enzyme].enzyme;
  ctx.save();
  ctx.scale(sc, sc);
  // products behind
  let k = 0;
  for (const q of world.prod) {
    if (q.bubble) continue;
    drawSprite(ctx, (k++ & 1) ? sprites.P2 : sprites.P, q.x, q.y, q.a, Math.min(1, q.life * 1.5));
  }
  const glowOn = world.enz.length <= 24;
  for (const e of world.enz) drawEnzyme(ctx, e, base, { dd, skew, sp: sprites, selected: e === sel, glowOn });
  for (const l of world.lig) {
    if (l.bound || l.drag) continue;
    drawLigand(ctx, sprites, l);
    if (l.spin > 0) {
      ctx.strokeStyle = `rgba(232,241,255,${l.spin})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(l.x, l.y, 17, l.a, l.a + Math.PI * 1.4 * (1 - l.spin) + 0.3); ctx.stroke();
      l.spin = Math.max(0, l.spin - 0.04);
    }
  }
  for (const q of world.prod) if (q.bubble) drawBubble(ctx, q);
  for (const f of world.fx) {
    const a = 1 - f.t / 0.6;
    ctx.strokeStyle = `rgba(253,230,138,${a * 0.8})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(f.x, f.y, 4 + f.t * 45, 0, K.TAU); ctx.stroke();
  }
  // dragged molecule + docking guide
  if (drag && drag.moved) {
    const l = drag.l;
    let near = null, nd = 90;
    for (const e of world.enz) {
      if (e.state !== "ok" || e.site || l.kind === "NI") continue;
      const p = M.pocket(e), d = K.dist(l.x, l.y, p.x, p.y);
      if (d < nd) { nd = d; near = e; }
    }
    if (near) {
      const p = M.pocket(near);
      drawSprite(ctx, l.kind === "S" ? sprites.S : sprites.CI, p.x, p.y, near.a + Math.PI / 2, 0.28);
      const good = M.oriErr(l, near) <= (l.kind === "S" ? M.G.oriTolS : M.G.oriTolCI) + 0.1;
      ctx.strokeStyle = good ? "rgba(74,222,128,0.9)" : "rgba(248,113,113,0.9)"; ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(l.x, l.y, 18, 0, K.TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    K.glow(ctx, l.x, l.y, 26, "#ffffff", 0.25);
    drawLigand(ctx, sprites, l);
  }
  ctx.restore();
}

function drawMeter() {
  const n = Math.max(1, world.enz.length);
  let busy = 0, ci = 0, ni = 0, dead = 0;
  for (const e of world.enz) {
    if (e.state !== "ok") dead++;
    else if (e.allo) ni++;
    else if (e.site && e.site.kind === "CI") ci++;
    else if (e.site) busy++;
  }
  const w = Math.min(230, stage.w * 0.46), h = 50, x = 12, y = stage.h - h - 12;
  ctx.save();
  ctx.fillStyle = "rgba(5,11,22,0.72)"; K.roundRect(ctx, x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = "rgba(120,190,255,0.16)"; ctx.stroke();
  ctx.font = "600 11px Inter, system-ui, sans-serif"; ctx.fillStyle = "#9fb3cf"; ctx.textBaseline = "top";
  ctx.fillText(`Enzymes busy: ${Math.round((busy / n) * 100)} %`, x + 10, y + 7);
  const bx = x + 10, by = y + 25, bw = w - 20, bh = 14;
  ctx.fillStyle = "rgba(255,255,255,0.07)"; K.roundRect(ctx, bx, by, bw, bh, 5); ctx.fill();
  let cx = bx;
  for (const [c, v] of [["#fbbf24", busy], [CI_COL, ci], [NI_COL, ni], [DEAD_COL, dead]]) {
    const ww = (v / n) * bw;
    if (ww > 0) { ctx.fillStyle = c; ctx.fillRect(cx, by, ww, bh); cx += ww; }
  }
  ctx.strokeStyle = "rgba(232,241,255,0.5)"; ctx.setLineDash([2, 2]);
  ctx.beginPath(); ctx.moveTo(bx + bw, by - 3); ctx.lineTo(bx + bw, by + bh + 3); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "#6a7f9c"; ctx.textAlign = "right";
  ctx.fillText("Vmax", bx + bw, y + 7);
  ctx.restore();
}

function drawLens() {
  lens = null;
  if (!sel || !world.enz.includes(sel)) { sel = null; return; }
  const e = sel, E = M.ENZYMES[state.enzyme];
  const r = K.clamp(Math.min(stage.w, stage.h) * 0.2, 62, 118);
  const x = stage.w - r - 14, y = stage.h - r - 14;
  lens = { x, y, r };
  const z = r / (M.G.R * 1.65);
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, K.TAU);
  const g = ctx.createRadialGradient(x, y - r * 0.3, 0, x, y, r);
  g.addColorStop(0, "#14284a"); g.addColorStop(1, "#050b16");
  ctx.fillStyle = g; ctx.fill();
  ctx.clip();
  ctx.translate(x, y); ctx.scale(z, z);
  const dd = 1 - M.fitPH(E, state.pH);
  drawEnzyme(ctx, e, LOOK[state.enzyme].enzyme, { dd, skew: state.pH >= E.pHopt ? 1 : -1, sp: sprites, selected: false, glowOn: true, ox: -e.x, oy: -e.y });
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = "rgba(232,241,255,0.6)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, K.TAU); ctx.stroke();
  ctx.restore();
  const ca = Math.cos(e.a), sa = Math.sin(e.a), sz = r > 90 ? 11 : 10;
  if (e.state === "ok") {
    K.label(ctx, "active site", x + ca * r * 0.72, y + sa * r * 0.72, { size: sz, color: SITE_COL });
    K.label(ctx, "allosteric site", x - ca * r * 0.72, y - sa * r * 0.72, { size: sz, color: NI_COL });
  }
  let st;
  if (e.state !== "ok") st = "Denatured — active site lost";
  else if (e.allo) st = "Allosteric inhibitor bound — site distorted";
  else if (e.site && e.site.kind === "CI") st = "Blocked by competitive inhibitor";
  else if (e.site) st = "Enzyme–substrate complex (induced fit)";
  else st = `Free — active site empty (fit ${Math.round(M.fitPH(E, state.pH) * 100)} %)`;
  const half = st.length * 3.2 + 8;
  K.label(ctx, st, K.clamp(x, half + 6, stage.w - half - 6), y - r - 14, { size: 11 });
}

function drawMsgs(dt) {
  for (const m of msgs) m.t += dt;
  msgs = msgs.filter((m) => m.t < 2.2);
  for (const m of msgs) {
    ctx.save(); ctx.globalAlpha = Math.min(1, (2.2 - m.t) * 2);
    const x = K.clamp(m.x, 130, stage.w - 130);
    K.label(ctx, m.text, x, m.y - m.t * 14, { size: 12, color: m.col });
    ctx.restore();
  }
  if (!interacted && hintT < 14) {
    ctx.save(); ctx.globalAlpha = Math.min(1, (14 - hintT) / 2) * 0.95;
    const txt = stage.w < 520 ? "Drag a substrate into an active site · tap to rotate" : "Drag a substrate into an active site · tap a molecule to rotate it · tap an enzyme to zoom";
    K.label(ctx, txt, stage.w / 2, stage.h - 84, { size: 12, color: "#e8f1ff" });
    ctx.restore();
  }
}

// ---------- main loop ----------
let gT = 0;
const L = K.loop((dt, t) => {
  frameDt = dt;
  ensureSprites();
  if (dt > 0) M.step(world, dt);
  hintT += 1 / 60;
  stepExperiment();

  S = M.stats(world);
  let hd = 0;
  for (const e of world.enz) if (e.state !== "ok" && e.cause === "heat") hd++;
  heatDead = hd / Math.max(1, world.enz.length);
  if (heatDead >= 0.7) heatArmed = true;
  const a = 1 - Math.exp(-dt * 1.5);
  liveRate += (M.rate(world, 4) - liveRate) * Math.min(1, dt * 1.2);
  busySm += (S.busy - busySm) * a;
  niSm += (S.ni - niSm) * a;

  drawBackground(t);
  drawWorld();
  drawMeter();
  drawLens();
  drawMsgs(1 / 60);

  chipRate(`Rate <b>${liveRate.toFixed(1)}</b> products/s`);
  chipBusy(`Busy <b>${Math.round(busySm * 100)} %</b>`);
  chipDead(`Denatured <b>${Math.round(S.dead * 100)} %</b>`);
  chipMade(`Products made <b>${world.made}</b>`);

  gT += 1 / 60;
  if (gT > 1 / 12) { gT = 0; drawGraph(); }
  exT += 1 / 60;
  if (exT > 0.4) { exT = 0; updateExplain(); }
  ms.update();
});
L.speed = speedS.value;
updateExplain();
updateRunLegend();
