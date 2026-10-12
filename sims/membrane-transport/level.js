// Membrane Transport as a CellScape level: the 3D bilayer (scene3d.js) driven by the tested model (model.js).
// Used both inside the zoomable cell and on its own page (sims/membrane-transport/index.html).
import * as THREE from "three";
import * as K from "../../assets/js/kit.js";
import { Model, SP } from "./model.js";
import { drawChart } from "./draw.js";
import { Scene3D, VW, VH } from "./scene3d.js";
import * as TXT from "./content.js";

const TRAY_CSS = `
#tray { position: absolute; left: 50%; bottom: 40px; transform: translateX(-50%); display: flex; gap: 6px; padding: 6px; border-radius: 14px; z-index: 3;
  background: rgba(5,11,22,0.7); border: 1px solid var(--panel-border); backdrop-filter: blur(8px); max-width: calc(100% - 24px); overflow-x: auto; }
.tray-item { display: flex; align-items: center; gap: 6px; border: 1px solid transparent; background: transparent; color: var(--ink-dim);
  padding: 6px 10px; border-radius: 10px; cursor: grab; font-size: 0.8rem; white-space: nowrap; touch-action: none; }
.tray-item i { width: 12px; height: 12px; border-radius: 50%; box-shadow: inset -2px -2px 4px rgba(0,0,0,0.35), 0 0 8px currentColor; }
.tray-item[aria-pressed="true"] { border-color: var(--accent); color: var(--ink); background: rgba(79,209,197,0.12); }
.tray-ghost { position: fixed; left: 0; top: 0; width: 28px; height: 28px; border-radius: 50%; pointer-events: none; z-index: 50;
  box-shadow: inset -4px -4px 8px rgba(0,0,0,0.35), 0 0 20px rgba(255,255,255,0.5); }
.lbl3d.prot { background: rgba(5,11,22,0.62); border: 1px solid rgba(120,190,255,0.22); padding: 2px 8px; border-radius: 999px; color: var(--ink); backdrop-filter: blur(4px); }
.lbl3d.prot.hover { border-color: var(--accent); color: #fff; }
.lbl3d.prot.off { color: var(--ink-faint); text-decoration: line-through; }
.lbl3d.status { color: #fde68a; font-size: 0.7rem; text-shadow: 0 1px 6px #000; }
.lbl3d.side { color: rgba(232,241,255,0.55); font-size: 0.68rem; letter-spacing: 0.14em; font-weight: 600; text-shadow: 0 1px 8px #000; }
.lbl3d.floater { font-weight: 700; font-size: 0.85rem; text-shadow: 0 1px 8px #000, 0 0 14px currentColor; }
.lbl3d.inspect { background: rgba(5,11,22,0.85); border: 1px solid var(--accent); padding: 5px 9px; border-radius: 10px; font-size: 0.76rem; line-height: 1.35; text-align: center; }
.lbl3d.inspect span { color: var(--ink-dim); }
.mt-chip .w { color: var(--ink-faint); }
.mt-chip .fx { margin-left: 5px; font-variant-numeric: tabular-nums; font-weight: 600; }
.mt-chip .fx.in { color: #4ade80; } .mt-chip .fx.out { color: #fbbf24; } .mt-chip .fx.eq { color: var(--ink-faint); font-weight: 400; }
.species-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 4px; }
.species-grid .btn { padding: 6px 4px; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; gap: 5px; }
.species-grid .btn i { width: 9px; height: 9px; border-radius: 50%; display: inline-block; flex: 0 0 9px; }
.chart-card canvas { width: 100%; height: 130px; display: block; }
.explain small { color: var(--ink-faint); display: block; margin-top: 8px; font-size: 0.75rem; line-height: 1.4; }
.explain .now { border-top: 1px solid var(--panel-border); padding-top: 8px; margin-top: 8px; font-size: 0.86rem; }
@media (max-width: 600px) { .mt-chip .w, .mt-chip.opt { display: none; } .tray-item { padding: 5px 7px; font-size: 0.72rem; } }
`;

/** Fallback if the page has no year lens (shouldn't happen: shell.js always sets engine.lens). */
const FALLBACK_LENS = {
  band: "y11", atLeast: () => true, on: () => () => {},
  pick(v) { if (v == null || typeof v !== "object" || Array.isArray(v)) return v; return v.y11 ?? v["y9-10"] ?? v["y7-8"] ?? ""; },
};

/** Concentration bars for the panel chart, for whichever species this configuration has (draw.js's chart is animal-only). */
function drawBars(ctx, w, h, counts, order) {
  ctx.save();
  ctx.font = "600 10px Inter, system-ui, sans-serif";
  ctx.textBaseline = "middle"; ctx.textAlign = "left";
  ctx.fillStyle = K.C.inkDim;
  ctx.fillText("Concentration", 10, 11);
  ctx.fillStyle = "rgba(232,241,255,0.35)"; ctx.fillRect(w - 104, 7, 8, 8);
  ctx.fillStyle = K.C.inkDim; ctx.fillText("out", w - 92, 11);
  ctx.fillStyle = "rgba(232,241,255,0.95)"; ctx.fillRect(w - 62, 7, 8, 8);
  ctx.fillStyle = K.C.inkDim; ctx.fillText("in", w - 50, 11);
  const top = 22, bot = h - 16, gx = 8, gw = w - 16;
  let max = 10;
  for (const sp of order) max = Math.max(max, counts[sp].out, counts[sp].in);
  max = Math.ceil(max / 10) * 10;
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath(); ctx.moveTo(gx, bot + 0.5); ctx.lineTo(gx + gw, bot + 0.5); ctx.stroke();
  const n = order.length, gwid = gw / n, bw = Math.max(3, gwid * 0.32);
  order.forEach((sp, i) => {
    const cx = gx + gwid * (i + 0.5), col = SP[sp].color;
    const ho = ((bot - top) * counts[sp].out) / max, hi = ((bot - top) * counts[sp].in) / max;
    ctx.fillStyle = K.withAlpha(col, 0.35); ctx.fillRect(cx - bw - 1, bot - ho, bw, ho);
    ctx.strokeStyle = K.withAlpha(col, 0.8); ctx.lineWidth = 1; ctx.strokeRect(cx - bw - 0.5, bot - ho + 0.5, bw - 1, Math.max(0, ho - 1));
    ctx.fillStyle = col; ctx.fillRect(cx + 1, bot - hi, bw, hi);
    ctx.fillStyle = K.C.inkDim; ctx.textAlign = "center"; ctx.fillText(SP[sp].short, cx, bot + 8);
  });
  ctx.restore();
}

export function create(engine) {
  if (!document.getElementById("mt-css")) {
    const st = document.createElement("style");
    st.id = "mt-css"; st.textContent = TRAY_CSS;
    document.head.appendChild(st);
  }
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const toast = engine.toast;
  const lens = engine.lens || FALLBACK_LENS;
  const L = (v) => lens.pick(v);

  // Which configuration? Entered from the plant cell (or ?config=plant on the standalone page) -> plant plasma membrane.
  // The level is created before it is pushed on the stack, so stack.at(-1) is the parent it was entered from.
  const cfg = new URLSearchParams(location.search).get("config");
  const fromPlant = (engine.stack || []).some((s) => s.id === "cell");
  const mode = cfg === "plant" || (cfg !== "animal" && fromPlant) ? "plant" : "animal";
  const plant = mode === "plant";

  const panel = document.createElement("div");
  panel.style.display = "contents";
  const overlay = document.createElement("div");
  overlay.style.display = "contents";
  const labelLayer = document.createElement("div");
  labelLayer.style.display = "contents";
  const M = new Model(mode);
  M.setSize(VW, VH);
  const G = new Scene3D(M, engine, labelLayer);
  const stage = { dpr: Math.min(window.devicePixelRatio || 1, 2) };
  const run = { running: true, speed: 1, toggle() { this.running = !this.running; return this.running; } };
  let activeDrag = null, disposed = false;

  let sel = plant ? "suc" : "glc";   // species chosen in the palette
  let focus = "intro";               // what the explain card talks about
  let hover = null;
  let explainTimer = 0, uiTimer = 0;
  let naPeak = false, hPeak = false;
  const done = new Set();            // completed mission ids (kept across lens changes and resets)
  const W = {};                      // widgets that are rebuilt with the panel

  const setFocus = (f) => { focus = f; explainTimer = 0; };
  const sameFocus = { aqp: "h2o", nit: "no3", hpump: "hpump", pump: "pump", glut: "glc", nach: "nach", kch: "kch", suc: "suc" };

  const glutInRate = () => {
    let n = 0;
    const t0 = M.time - 8;
    for (const e of M.events) if (e.sp === "glc" && e.via === "glut" && e.dir > 0 && e.t > t0) n++;
    return n / Math.max(1, Math.min(8, M.time));
  };
  const H = { glutInRate, inRate: (sp, via) => { let n = 0; const t0 = M.time - 8; for (const e of M.events) if (e.sp === sp && e.via === via && e.dir > 0 && e.t > t0) n++; return n / Math.max(1, Math.min(8, M.time)); } };

  let selectSpecies = () => {};
  let missionItems = [], missionFill = null;
  let trayBtns = {};

  function addSel(side) {
    const n = M.addCluster(sel, side, 5);
    toast(n ? `Added ${n} ${SP[sel].name} ${side === "out" ? "outside" : "inside"}` : "That side is full for this molecule");
    setFocus(sel);
  }

  const vesMsg = (r) => {
    if (r === "busy") toast("A vesicle is already on the move — wait for it to finish.");
    else if (r === "noatp") toast("No ATP! Vesicle transport is active — it needs energy.");
    else if (r === "full") toast("Too many particles — remove some first.");
  };

  /** Make the checkboxes match the model (after a tap on the 3D protein, a reset, etc.). */
  function syncChecks() {
    if (W.aqp) W.aqp.checked = M.byId.aqp.open;
    if (W.kch) W.kch.checked = M.byId.kch.open;
    if (W.nach) W.nach.checked = M.byId.nach?.open ?? true;
    if (W.glut) W.glut.checked = M.glut.blocked;
    if (W.suc) W.suc.checked = M.sym.suc?.blocked ?? false;
    if (W.nit) W.nit.checked = M.sym.nit?.blocked ?? false;
    if (W.vanadate) W.vanadate.checked = M.pump.blocked;
    if (W.cyanide) W.cyanide.checked = M.cyanide;
  }

  // ---------- panel (rebuilt when the year band changes) ----------
  function buildPanel() {
    panel.replaceChildren();
    // which proteins this patch shows
    const note = K.card(panel, L({ "y7-8": "This patch of membrane", "y9-10": "Model membrane" }));
    note.insertAdjacentHTML("beforeend", TXT.configNote(mode, lens));

    // explain
    const explain = K.card(panel, "What's happening", "explain");
    W.explainBody = document.createElement("div");
    explain.appendChild(W.explainBody);

    // controls
    const controls = K.card(panel, "Controls");
    const row = K.buttonRow(controls);
    W.pause = K.button(row, run.running ? "Pause" : "Play", () => { W.pause.textContent = run.toggle() ? "Pause" : "Play"; });
    K.button(row, "Reset", () => resetAll());
    const speeds = [0.25, 0.5, 1, 2, 3];
    W.speed = K.segmented(controls, speeds.map((v) => ({ value: v, label: `${v}×` })), run.speed, (v) => { run.speed = v; });

    // conditions
    const cond = K.card(panel, "Conditions");
    W.temp = K.slider(cond, { label: "Temperature", min: 0, max: 60, value: M.temp, unit: " °C", onInput: (v) => { M.temp = v; setFocus("temp"); } });
    W.atp = K.slider(cond, {
      label: L({ "y7-8": "Energy supply (ATP)", "y9-10": "ATP production (respiration)" }), min: 0, max: 100, step: 5, value: Math.round(M.atpProd * 100), unit: " %",
      onInput: (v) => { M.atpProd = v / 100; setFocus("atp"); },
    });
    W.cyanide = K.checkbox(cond, L({ "y7-8": "Poison the energy supply (cyanide)", "y9-10": "Poison ATP production (cyanide)" }), M.cyanide, (v) => {
      M.cyanide = v; setFocus("cyanide");
      toast(v ? "☠ Cyanide inhibits complex IV. The model represents this by switching off the ATP supply." : "Cyanide removed: the ATP supply is back.");
    });
    const atpRow = K.buttonRow(cond);
    K.button(atpRow, plant ? L({ "y7-8": "Give the proton pump energy (+5 ATP)", "y9-10": "Feed the H⁺ pump ATP (+5)" }) : L({ "y7-8": "Give the pump energy (+5 ATP)", "y9-10": "Feed the pump ATP (+5)" }), () => { M.feedATP(5); setFocus(plant ? "hpump" : "pump"); });

    // proteins
    const protCard = K.card(panel, "Membrane proteins");
    W.aqp = K.checkbox(protCard, L({ "y7-8": "Water channel (aquaporin) open", "y9-10": "Aquaporin open" }), M.byId.aqp.open, (v) => { M.setChannel("aqp", v); setFocus("h2o"); });
    W.kch = K.checkbox(protCard, "K⁺ channel open", M.byId.kch.open, (v) => { M.setChannel("kch", v); setFocus("kch"); });
    W.nach = W.glut = W.suc = W.nit = W.vanadate = null;
    if (plant) {
      W.suc = K.checkbox(protCard, L({ "y7-8": "Jam the sugar carrier (inhibitor)", "y9-10": "Block the H⁺–sucrose symporter (inhibitor)" }), M.sym.suc.blocked, (v) => { M.setSymBlocked("suc", v); setFocus("suc"); });
      W.nit = K.checkbox(protCard, L({ "y7-8": "Jam the nitrate carrier (inhibitor)", "y9-10": "Block the H⁺–nitrate symporter (inhibitor)" }), M.sym.nit.blocked, (v) => { M.setSymBlocked("nit", v); setFocus("no3"); });
      W.vanadate = K.checkbox(protCard, L({ "y7-8": "Jam the proton pump (it can't use ATP)", "y9-10": "Block the H⁺ pump (vanadate)" }), M.pump.blocked, (v) => { M.setPumpBlocked(v); setFocus("vanadate"); toast(v ? "Vanadate has jammed the H⁺ pump — ATP is still made, but the pump can't use it." : "Vanadate washed out."); });
    } else {
      W.nach = K.checkbox(protCard, "Na⁺ channel open", M.byId.nach.open, (v) => { M.setChannel("nach", v); setFocus("nach"); });
      W.glut = K.checkbox(protCard, L({ "y7-8": "Jam the glucose carrier (inhibitor)", "y9-10": "Block GLUT with an inhibitor" }), M.glut.blocked, (v) => { M.setGlutBlocked(v); setFocus("glc"); });
    }
    protCard.insertAdjacentHTML("beforeend", `<p class="hint">${TXT.protHint(mode, lens)}</p>`);

    // add molecules
    const addCard = K.card(panel, L({ "y7-8": "Add particles", "y9-10": "Add molecules" }));
    const grid = document.createElement("div");
    grid.className = "species-grid";
    addCard.appendChild(grid);
    W.spBtns = {};
    for (const sp of M.order) {
      const b = K.button(grid, `<i style="background:${SP[sp].color}"></i>${SP[sp].short}`, () => selectSpecies(sp));
      b.setAttribute("aria-label", SP[sp].long);
      W.spBtns[sp] = b;
    }
    const addRow = K.buttonRow(addCard);
    K.button(addRow, "+5 outside", () => addSel("out"));
    K.button(addRow, "+5 inside", () => addSel("in"));
    K.button(addRow, "Clear", () => {
      M.parts.forEach((p) => { if (p.sp === sel && p.mode === "free") p.dead = true; });
      toast(`Removed free ${SP[sel].long.toLowerCase()} particles`);
    });
    addCard.insertAdjacentHTML("beforeend", `<p class="hint">Or drag a molecule from the tray at the bottom of the stage onto either side — or tap empty space to add 3 of the selected molecule.</p>`);

    // vesicles
    const vesCard = K.card(panel, L({ "y7-8": "Big things: bubbles (vesicles)", "y9-10": "Bulk transport (vesicles)" }));
    const vesRow = K.buttonRow(vesCard);
    K.button(vesRow, L({ "y7-8": "Bring a bubble in (endocytosis)", "y9-10": "Endocytosis (bring in)" }), () => { const r = M.startVesicle("endo"); vesMsg(r); if (r === "ok") setFocus("endo"); });
    K.button(vesRow, L({ "y7-8": "Send a bubble out (exocytosis)", "y9-10": "Exocytosis (secrete)" }), () => { const r = M.startVesicle("exo"); vesMsg(r); if (r === "ok") setFocus("exo"); });
    vesCard.insertAdjacentHTML("beforeend", `<p class="hint">${L({ "y7-8": "Big proteins can't fit through any channel or carrier, so the cell wraps them in a bubble.", "y9-10": "Large proteins can't use any channel or carrier — cells move them inside membrane-bound vesicles." })}</p>`);

    // chart (narrow screens only; wide screens get a stage inset)
    const chartCard = K.card(panel, "Inside vs outside", "chart-card");
    W.chartCv = document.createElement("canvas");
    W.chartCv.setAttribute("aria-hidden", "true");
    chartCard.appendChild(W.chartCv);
    W.chartCtx = W.chartCv.getContext("2d");

    // legend
    const legend = K.card(panel, "Legend");
    const lg = document.createElement("div");
    lg.className = "legend";
    lg.innerHTML = M.order.map((sp) => `<span><i style="background:${SP[sp].color}"></i>${SP[sp].long}${sp === "prot" ? "" : ` (${SP[sp].name})`}</span>`).join("") + `<span><i style="background:${K.C.amber}"></i>ATP</span>`;
    legend.appendChild(lg);
    legend.insertAdjacentHTML("beforeend", `<p class="hint">Chips show <b>outside · inside</b> counts and the net flux: <span style="color:var(--good)">↓ into the cell</span>, <span style="color:var(--accent-3)">↑ out of the cell</span>.${plant && lens.atLeast("y9-10") ? " <b>Vm</b> is the membrane potential (inside relative to outside); <b>ΔpH</b> compares H⁺ outside and inside." : ""}</p>`);

    buildMissions();
    K.quiz(panel, TXT.quizList(mode, lens.band));
    markSel();
    explainTimer = 0; uiTimer = 0;
  }

  // ---------- missions (own copy of K.missions so progress survives a change of year band) ----------
  function buildMissions() {
    const c = K.card(panel, "Missions", "missions");
    const ol = document.createElement("ol");
    const list = TXT.missionList(mode).filter((m) => !m.band || lens.atLeast(m.band));
    missionItems = list.map((m) => {
      const li = document.createElement("li");
      li.textContent = L(m.text);
      if (done.has(m.id)) li.classList.add("done");
      ol.appendChild(li);
      return { m, li };
    });
    c.appendChild(ol);
    const bar = document.createElement("div");
    bar.className = "progress";
    bar.innerHTML = "<div></div>";
    c.appendChild(bar);
    missionFill = bar.firstChild;
    updateMissions();
  }

  const S = { M, get hPeak() { return hPeak; }, get naPeak() { return naPeak; }, inRate: H.inRate };
  function updateMissions() {
    let n = 0;
    for (const it of missionItems) {
      if (!done.has(it.m.id)) {
        let ok = false;
        try { ok = it.m.check(S); } catch { ok = false; }
        if (ok) { done.add(it.m.id); it.li.classList.add("done"); toast(`🎯 Mission complete: ${it.li.textContent}`, 3400); }
      }
      if (done.has(it.m.id)) n++;
    }
    if (missionFill) missionFill.style.width = `${(n / Math.max(1, missionItems.length)) * 100}%`;
  }

  // ---------- overlay chips ----------
  const CHIP_SP = plant ? ["o2", "co2", "h2o", "suc", "h", "no3", "k"] : ["o2", "co2", "h2o", "glc", "na", "k"];
  const chipSet = {};
  for (const sp of CHIP_SP) {
    chipSet[sp] = K.chip(overlay);
    if (sp === "co2" || sp === "h2o") overlay.lastChild.classList.add("opt");
  }
  const atpChip = K.chip(overlay);
  const atpChipEl = overlay.lastChild;
  let vmChip = null, vmChipEl = null;
  if (plant) { vmChip = K.chip(overlay); vmChipEl = overlay.lastChild; }

  function fluxSpan(f) {
    if (Math.abs(f) < 0.1) return `<span class="fx eq">⇅ 0</span>`;
    return f > 0 ? `<span class="fx in">↓${f.toFixed(1)}/s</span>` : `<span class="fx out">↑${(-f).toFixed(1)}/s</span>`;
  }

  function updateChips(c) {
    for (const sp of CHIP_SP) {
      chipSet[sp](`<i class="dot" style="background:${SP[sp].color}"></i>${SP[sp].short} <span class="w">out</span> <b>${c[sp].out}</b> · <span class="w">in </span><b>${c[sp].in}</b>${fluxSpan(M.flux(sp))}`);
    }
    const a = Math.floor(M.atp);
    atpChip(`<i class="dot" style="background:${K.C.amber}"></i>ATP <b>${a}</b>${M.cyanide ? ` <span class="fx out">☠ cyanide</span>` : ""}`);
    atpChipEl.classList.toggle("warn", a < 1);
    if (vmChip) {
      vmChipEl.style.display = lens.atLeast("y9-10") ? "" : "none";
      vmChip(`Vm <b>${Math.round(M.vmAvg)} mV</b> · ΔpH <b>${M.dpH.toFixed(1)}</b>`);
    }
  }

  function updateExplain(c) {
    const html = TXT.focusText(M, c, lens, focus, H) + TXT.nowLine(M, c, lens) + `<small>${TXT.notToScale(mode, lens)}</small>`;
    if (W.explainBody && W.explainBody.innerHTML !== html) W.explainBody.innerHTML = html;
  }

  // ---------- 3D interaction ----------
  const sideAt = (y) => (y < M.L.memTop - 2 ? "out" : y > M.L.memBot + 2 && y < M.L.uh ? "in" : null);

  function toggleProtein(P) {
    if (P.kind === "channel") {
      M.setChannel(P.id, !P.open);
      toast(`${P.name} ${P.open ? "opened" : "closed"}`);
      setFocus(P.id === "aqp" ? "h2o" : P.id);
    } else if (P.kind === "carrier") {
      M.setGlutBlocked(!M.glut.blocked);
      toast(M.glut.blocked ? "GLUT blocked by an inhibitor" : "GLUT inhibitor washed out");
      setFocus("glc");
    } else if (P.kind === "symport") {
      const b = !M.sym[P.id].blocked;
      M.setSymBlocked(P.id, b);
      toast(b ? `${P.name} blocked by an inhibitor` : `${P.name} inhibitor washed out`);
      setFocus(P.id === "nit" ? "no3" : P.id);
    }
    syncChecks();
  }

  function addAt(sp, cx, cy, n) {
    const pt = G.toModel(cx, cy);
    if (pt) pt.y = Math.min(Math.max(pt.y, 12), M.L.uh - 12); // taps beyond the water still count
    const side = pt && sideAt(pt.y);
    if (!side) { toast("Drop molecules above (outside) or below (inside) the membrane"); return; }
    const before = M.nextId;
    const k = M.addCluster(sp, side, n, pt.x, pt.y);
    for (const p of M.parts) if (p.id >= before) p.zHint = (Math.random() - 0.5) * 1.6;
    toast(k ? `Added ${k} ${SP[sp].name} ${side === "out" ? "outside" : "inside"}` : "That side is full for this molecule");
    setFocus(sp);
  }

  const HOW = plant ? {
    o2: "crosses the lipids by simple diffusion", co2: "crosses the lipids by simple diffusion",
    h2o: "mostly crosses through aquaporins (osmosis)", suc: "too big: needs the H⁺–sucrose symporter",
    h: "charged: pumped out by the H⁺-ATPase, flows back in with cargo", no3: "charged: needs the H⁺–nitrate symporter (about 2 H⁺ each)",
    k: "needs the K⁺ channel (the negative inside pulls it in)", prot: "too big: needs a vesicle",
  } : {
    o2: "crosses the lipids by simple diffusion", co2: "crosses the lipids by simple diffusion",
    h2o: "mostly crosses through aquaporins (osmosis)", glc: "needs the GLUT carrier (facilitated diffusion)",
    na: "needs the Na⁺ channel or the pump", k: "needs the K⁺ channel or the pump", prot: "too big: needs a vesicle",
  };
  const inspectHTML = (p) => `<b style="color:${SP[p.sp].color}">${SP[p.sp].long}</b> · ${p.side === "out" ? "outside" : p.side === "in" ? "inside" : "crossing"}<br><span>${HOW[p.sp]}</span>`;

  // molecule tray: tap to select, drag onto the stage to drop 5
  const tray = document.createElement("div");
  tray.id = "tray"; tray.setAttribute("role", "toolbar"); tray.setAttribute("aria-label", "Molecules to add");
  for (const sp of M.order) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tray-item";
    b.innerHTML = `<i style="background:${SP[sp].color}"></i>${SP[sp].short}`;
    b.setAttribute("aria-label", `Select ${SP[sp].long}`);
    tray.appendChild(b);
    trayBtns[sp] = b;
    b.addEventListener("click", (e) => { if (e.detail === 0) { selectSpecies(sp); addSel("out"); } }); // keyboard: Enter/Space adds 5 outside
    b.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      activeDrag?.();   // only one tray drag at a time
      const pid = e.pointerId;
      selectSpecies(sp);
      const ghost = document.createElement("div");
      ghost.className = "tray-ghost";
      ghost.style.background = SP[sp].color;
      let moved = false;
      const mv = (ev) => {
        if (ev.pointerId !== pid) return;
        if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) > 6 && !moved) { moved = true; document.body.appendChild(ghost); }
        ghost.style.transform = `translate(${ev.clientX - 14}px, ${ev.clientY - 14}px)`;
      };
      const cleanup = (ev) => {
        if (ev && ev.pointerId !== undefined && ev.pointerId !== pid) return;
        removeEventListener("pointermove", mv); removeEventListener("pointerup", up); removeEventListener("pointercancel", cleanup); ghost.remove(); activeDrag = null;
      };
      const up = (ev) => {
        if (ev.pointerId !== pid) return;
        cleanup();
        if (disposed) return;
        const r = engine.canvas.getBoundingClientRect();
        if (moved && ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom) addAt(sp, ev.clientX, ev.clientY, 5);
        else if (!moved) toast(`${SP[sp].long} selected — drag it onto a side, or tap empty space to add 3`);
      };
      addEventListener("pointermove", mv); addEventListener("pointerup", up); addEventListener("pointercancel", cleanup);
      activeDrag = cleanup;
    });
  }
  function markSel() {
    for (const s of M.order) {
      W.spBtns?.[s]?.setAttribute("aria-pressed", String(s === sel));
      trayBtns[s]?.setAttribute("aria-pressed", String(s === sel));
    }
  }
  selectSpecies = (sp) => { sel = sp; markSel(); setFocus(sp); };

  // ---------- reset ----------
  function resetAll() {
    M.temp = 37; M.atpProd = 0.6; M.cyanide = false;
    W.temp.value = 37; W.atp.value = 60;
    M.reset();
    syncChecks();
    naPeak = false; hPeak = false;
    setFocus("intro");
    toast("Reset");
  }

  // ---------- chart in panel ----------
  function drawPanelChart(c) {
    const cv = W.chartCv;
    if (!cv) return;
    const w = cv.clientWidth, h = cv.clientHeight, dpr = stage.dpr;
    if (!w) return;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    W.chartCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    W.chartCtx.clearRect(0, 0, w, h);
    if (plant) drawBars(W.chartCtx, w, h, c, M.order);
    else drawChart(W.chartCtx, 0, 0, w, h, c, { panel: false });
  }

  // chips get the mt-chip class so their styles don't leak into other levels
  for (const c of overlay.children) c.classList.add("mt-chip");

  const applyLabels = () => {
    const sl = TXT.SIDE_LABELS[mode];
    G.setLabels({ out: L(sl.out), inside: L(sl.inside), prot: TXT.protLabels(mode, lens) });
  };
  applyLabels();
  buildPanel();

  // ---------- level object ----------
  const level = {
    title: "Cell membrane",
    topics: ["membrane", "diffusion", "osmosis", "active-transport", "atp"],
    root: G.root,
    pickables: G.pickables,
    metersPerUnit: 3.8e-9,           // bilayer ≈ 2 units ≈ 7.5 nm
    get view() { return G.view(); },
    minDistance: 4, maxDistance: 30, near: 0.05, far: 400,
    minPolar: 0.35, maxPolar: 2.4, enablePan: true,
    env: { bg: ["#081a33", "#05303a", "#33155a"], fog: ["#082230", 0.022], exposure: 1.0, bloom: [0.55, 0.55, 0.82], aperture: 0.0016 },
    info(obj) {
      const id = obj.userData.protId;
      if (!id) return null;
      const P = M.byId[id];
      return { title: P.name + (P.kind === "pump" ? " — hold to feed ATP" : " — click to " + (P.kind === "carrier" || P.kind === "symport" ? "block/unblock" : "open/close")) };
    },
    onHover(obj) { hover = obj?.userData.protId || null; },
    onPointerDown(e, hit) {
      const id = hit?.object.userData.protId;
      if (id && M.byId[id].kind === "pump") {
        M.feeding = true; M.feedATP(2); setFocus(M.pumpId);
        toast("Feeding the pump ATP — keep holding for more");
        return true;
      }
      return false;
    },
    onPointerUp() { M.feeding = false; },
    onClick(e, hit) {
      const id = hit?.object.userData.protId;
      if (id) { if (M.byId[id].kind !== "pump") toggleProtein(M.byId[id]); return true; }
      const part = G.pickParticle(e.clientX, e.clientY);
      if (part) { M.inspect = { p: part, t: M.time }; setFocus(part.sp); return true; }
      addAt(sel, e.clientX, e.clientY, 3);
      return true;
    },
    onLens() { applyLabels(); buildPanel(); },
    mountPanel(el) {
      engine.canvas?.setAttribute("aria-label", TXT.canvasLabel(mode));
      el.appendChild(panel);
      engine.overlay.appendChild(overlay);
      engine.labelLayer.appendChild(labelLayer);
      engine.stageEl.appendChild(tray);
    },
    unmountPanel() { activeDrag?.(); overlay.remove(); tray.remove(); labelLayer.remove(); },
    dispose() { disposed = true; activeDrag?.(); M.feeding = false; overlay.remove(); tray.remove(); labelLayer.remove(); },
    update(dt, t, rdt = dt) {
      const d = run.running ? dt * run.speed : 0;
      M.step(d);
      const c = M.counts();
      if (!plant && c.na.out >= 12 && c.na.out >= 3 * Math.max(1, c.na.in)) naPeak = true;
      if (plant && c.h.out >= 12 && c.h.out >= 3 * Math.max(1, c.h.in)) hPeak = true;
      G.update(d, t, { hover, inspectHTML });
      uiTimer -= rdt;
      explainTimer -= rdt;
      if (uiTimer <= 0) { uiTimer = 0.2; updateChips(c); drawPanelChart(c); }
      if (explainTimer <= 0) { explainTimer = 0.5; updateExplain(c); }
      updateMissions();
    },
  };
  run.speed = reduced ? 0.5 : 1;
  W.speed.set(run.speed);
  return level;
}
