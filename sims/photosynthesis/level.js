// Photosynthesis as a CellScape molecular level: the thylakoid membrane + Calvin cycle in 3D (scene3d.js),
// paced by the reviewed limiting-factors model (model.js). Entered from a granum in the chloroplast level,
// or on its own from sims/photosynthesis/index.html.
import * as THREE from "three";
import * as K from "../../assets/js/kit.js";
import * as PM from "./model.js";
import { drawInset } from "./draw.js";
import { Thylakoid3D, METERS_PER_UNIT, X, at, COL } from "./scene3d.js";
import { NAMES, INFO, MISSIONS, QUIZ, explain, nowLine } from "./content3d.js";

const { C, clamp, lerp, TAU } = K;
const LIMCOL = { light: C.amber, co2: C.teal, temp: C.red };
const SHORT = { psii: "PSII", b6f: "Cyt b6f", psi: "PSI", atps: "ATP synthase" };

const CSS = `
.lbl3d.ps { background: rgba(5,11,22,0.62); border: 1px solid rgba(134,239,172,0.28); padding: 2px 8px; border-radius: 999px; color: var(--ink); backdrop-filter: blur(4px); }
.lbl3d.ps.hover { border-color: var(--accent); color: #fff; }
.lbl3d.ps.dead { border-color: rgba(248,113,113,0.7); color: #fecaca; }
.lbl3d.side { color: rgba(232,241,255,0.6); font-size: 0.68rem; letter-spacing: 0.12em; font-weight: 600; text-shadow: 0 1px 8px #000; }
.lbl3d.rx { font-size: 0.68rem; color: #a5f3fc; text-shadow: 0 1px 6px #000; }
.lbl3d.cal { text-align: center; font-size: 0.66rem; letter-spacing: 0.1em; color: var(--ink-faint); text-shadow: 0 1px 6px #000; }
.lbl3d.cal b { display: block; font: 600 1.05rem "Space Grotesk", Inter, sans-serif; letter-spacing: 0; color: var(--ink); }
.lbl3d.drag { color: #fbbf24; font-size: 0.7rem; font-weight: 600; text-shadow: 0 1px 6px #000; }
.ps-chip.lim { border-color: currentColor; } .ps-chip.lim b { color: inherit; }
.graph-canvas { width: 100%; height: 200px; display: block; margin-top: 8px; border-radius: 10px; background: var(--well-bg); }
.graph-key { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 0.78rem; color: var(--ink-dim); margin-top: 6px; }
.graph-key i { display: inline-block; width: 14px; height: 3px; border-radius: 2px; vertical-align: middle; margin-right: 5px; }
.ps-small { font-size: 0.8rem; color: var(--ink-faint) !important; }
.ps-sel { border-left: 3px solid var(--accent); padding-left: 8px; }
.ps-sub { font-size: 0.78rem; color: var(--ink-faint); margin: -4px 0 6px; }
.spectrum-bar { height: 6px; border-radius: 3px; margin: 4px 0 2px;
  background: linear-gradient(90deg, #8b3dff, #3d5bff 15%, #2fd0ff 30%, #3dff6a 45%, #e8ff3d 60%, #ffa23d 75%, #ff3d3d 90%, #b81f1f); }
.elodea-canvas { width: 100%; height: 210px; display: block; }
.explain .now { border-top: 1px solid var(--panel-border); padding-top: 8px; margin-top: 8px; font-size: 0.86rem; }
@media (max-width: 600px) { .ps-chip.opt { display: none; } }
`;

export function create(engine) {
  if (!document.getElementById("ps3d-css")) {
    const st = document.createElement("style");
    st.id = "ps3d-css"; st.textContent = CSS;
    document.head.appendChild(st);
  }
  const lens = engine.lens;
  const toast = (m, ms) => engine.toast?.(m, ms);
  const reduced = engine.reducedMotion;

  // ---------- state (same fields as the 2D sim) ----------
  const S = {};
  const defaults = () => Object.assign(S, PM.DEFAULTS, {
    fx: 0.3, den: 0, glucose: 0, co2Fixed: 0, atpStore: 6, nadphStore: 6, hPool: 8,
    eCount: 0, g3pCount: 0, manualFixed: 0, bubblesCounted: 0, lampDragged: false, colourSwept: false,
  });
  defaults();
  // entered from the chloroplast: start from its conditions and keep them in sync both ways
  const parentInst = engine.stack.at(-1)?.inst;
  const shared = parentInst?.model && "light" in parentInst.model ? parentInst.model : null;
  function pullShared() {
    if (!shared) return;
    S.co2 = shared.co2; S.temp = shared.temp; S.den = Math.max(S.den, shared.den || 0);
    const I = shared.light / 100;
    S.lampOn = I >= 0.01;
    S.dcm = I >= 0.01 ? clamp(10 / Math.sqrt(I), 10, 60) : 25;
  }
  pullShared();
  let dirty = false;
  function pushShared() {
    if (!shared || !dirty) return;
    dirty = false;
    shared.co2 = S.co2; shared.temp = S.temp; shared.den = Math.max(shared.den || 0, S.den);
    shared.light = S.lampOn ? clamp(PM.intensity(S) * 100, 0, 100) : 0;
  }

  let model = PM.rates(S, S.den);
  const G = new Thylakoid3D(S, engine, { toast });
  const L = { speed: reduced ? 0.5 : 1 };

  // ---------- DOM containers (re-attached on every mount) ----------
  const panel = document.createElement("div"); panel.style.display = "contents";
  const overlay = document.createElement("div"); overlay.style.display = "contents";
  const layer = document.createElement("div"); layer.style.display = "contents";
  const mk = (cls, html = "") => { const d = document.createElement("div"); d.className = `lbl3d ${cls}`; d.innerHTML = html; layer.appendChild(d); return d; };

  // ---------- graph (unchanged science from the 2D sim) ----------
  const graph = { vary: "light", curves: { light: [], co2: [], temp: [], colour: [] }, sweep: null };
  const GX = {
    light: { min: 0, max: 100, label: "Light intensity (% of lamp at 10 cm)", fmt: (v) => `${Math.round(v)}` },
    co2: { min: 0, max: 0.4, label: "CO₂ concentration (%)", fmt: (v) => v.toFixed(1) },
    temp: { min: 0, max: 50, label: "Temperature (°C)", fmt: (v) => `${Math.round(v)}` },
    colour: { min: 400, max: 700, label: "Wavelength of light (nm)", fmt: (v) => `${Math.round(v)}` },
  };
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
    const p = [];
    if (vary !== "light") p.push(S.lampOn ? `${Math.round(S.dcm)} cm` : "dark");
    if (vary !== "colour") p.push(S.white ? "white" : `${S.lambda} nm`);
    if (vary !== "co2") p.push(`${S.co2.toFixed(2)}% CO₂`);
    if (vary !== "temp") p.push(`${S.temp} °C`);
    return p.join(", ");
  }

  // ---------- panel ----------
  let ui = null; // { band, explainBody, selInfo, sliders..., missions, gc, gctx, runBtn, ... }
  let sel = null, focusSel = null;

  function buildPanel() {
    panel.innerHTML = "";
    const band = lens.band, y7 = band === "y7-8";
    const u = (ui = { band });
    if (engine.stack.length > 1 || parentInst) {
      const note = K.card(panel, "Inside one thylakoid");
      note.innerHTML += `<p>${lens.pick({ "y7-8": "You've zoomed into one of the green discs in a granum. The light-catching proteins sit in its membrane; the sugar-making cycle runs in the fluid outside (the stroma).", "y9-10": "A patch of one thylakoid from the granum you entered. Lumen (inside the disc) is above the membrane; the stroma is below. Light, CO₂ and temperature are shared with the chloroplast level." })}</p>`;
    }
    const ex = K.card(panel, "What's happening", "explain");
    u.explainBody = document.createElement("div");
    u.explainBody.setAttribute("aria-live", "polite");
    ex.appendChild(u.explainBody);
    u.selInfo = document.createElement("p");
    u.selInfo.className = "ps-sel";
    ex.appendChild(u.selInfo);
    showSel();

    const ctl = K.card(panel, "Controls");
    u.lampChk = K.checkbox(ctl, "Lamp on", S.lampOn, (v) => { S.lampOn = v; touched("light"); });
    u.distS = K.slider(ctl, {
      label: y7 ? "Lamp distance (or drag the lamp)" : "Lamp distance (drag the lamp too)", min: 10, max: 60, step: 1, value: Math.round(S.dcm),
      format: (v) => `${v} cm · ${Math.round((10 / v) ** 2 * 100)}%`, onInput: (v) => { S.dcm = v; touched("light"); },
    });
    const colourWrap = document.createElement("div");
    colourWrap.className = "control";
    colourWrap.innerHTML = `<div class="control-row"><label>Light colour</label></div>`;
    ctl.appendChild(colourWrap);
    const COLOURS = [{ value: "white", label: "White" }, { value: 450, label: "Blue" }, { value: 540, label: "Green" }, { value: 670, label: "Red" }];
    u.colourSeg = K.segmented(colourWrap, COLOURS, S.white ? "white" : S.lambda, (v) => {
      if (v === "white") S.white = true;
      else { S.white = false; S.lambda = v; if (u.lamS) u.lamS.value = v; }
      touched("colour");
    });
    if (lens.atLeast("y9-10")) {
      u.lamS = K.slider(ctl, {
        label: "Wavelength (filter)", min: 400, max: 700, step: 5, value: S.lambda, format: (v) => `${v} nm · ${PM.colourName(v)}`,
        onInput: (v) => { S.white = false; S.lambda = v; const m = COLOURS.find((c) => c.value === v); u.colourSeg.set(m ? m.value : null); touched("colour"); },
      });
      const spec = document.createElement("div"); spec.className = "spectrum-bar"; u.lamS.el.appendChild(spec);
    }
    u.co2S = K.slider(ctl, { label: y7 ? "Carbon dioxide" : "CO₂ concentration", min: 0, max: 0.4, step: 0.01, value: S.co2, format: (v) => `${v.toFixed(2)} %`, onInput: (v) => { S.co2 = v; touched("co2"); } });
    ctl.insertAdjacentHTML("beforeend", `<div class="ps-sub">${y7 ? "Air has about 0.04 %. Baking soda (sodium hydrogen carbonate) adds CO₂ to the water." : "Air ≈ 0.04 %. Adding sodium hydrogen carbonate raises CO₂ in the water."}</div>`);
    u.tempS = K.slider(ctl, { label: "Temperature", min: 0, max: 50, step: 1, value: S.temp, unit: " °C", onInput: (v) => { S.temp = v; touched("temp"); } });
    const viewWrap = document.createElement("div");
    viewWrap.className = "control";
    viewWrap.innerHTML = `<div class="control-row"><label>Camera</label></div>`;
    ctl.appendChild(viewWrap);
    K.segmented(viewWrap, [{ value: "both", label: "Both" }, { value: "thylakoid", label: "Thylakoid" }, { value: "calvin", label: "Calvin cycle" }], null, (v) => flyTo(v));
    const row = K.buttonRow(ctl);
    K.button(row, "Reset", resetAll);
    const speedWrap = document.createElement("div");
    speedWrap.className = "control";
    speedWrap.innerHTML = `<div class="control-row"><label>Speed</label></div>`;
    ctl.appendChild(speedWrap);
    K.segmented(speedWrap, [0.25, 0.5, 1, 2, 3].map((s) => ({ value: s, label: `${s}×` })), L.speed, (v) => { L.speed = v; });

    // rate graph
    const gCard = K.card(panel, "Rate graph · O₂ production");
    gCard.insertAdjacentHTML("beforeend", `<p class="ps-small">${y7 ? "Pick something to change, then run an experiment. It changes only that one thing (a fair test). Change another factor and run again to compare." : "Pick a variable, then run an experiment: it sweeps that variable while everything else stays as you set it. Change another factor and run again to compare curves."}</p>`);
    const vars = [{ value: "light", label: "Light" }, { value: "co2", label: "CO₂" }, { value: "temp", label: "Temp" }];
    if (lens.atLeast("y9-10")) vars.push({ value: "colour", label: "Colour" });
    if (!vars.some((v) => v.value === graph.vary)) graph.vary = "light";
    u.varSeg = K.segmented(gCard, vars, graph.vary, (v) => { graph.vary = v; });
    u.gc = document.createElement("canvas");
    u.gc.className = "graph-canvas";
    u.gc.setAttribute("role", "img");
    u.gc.setAttribute("aria-label", "Graph of O₂ production rate. No experiment run yet.");
    gCard.appendChild(u.gc);
    u.gctx = u.gc.getContext("2d");
    const gRow = K.buttonRow(gCard);
    u.runBtn = K.button(gRow, "Run experiment", runSweep, { kind: "primary" });
    u.runBtn.disabled = !!graph.sweep;
    K.button(gRow, "Clear graph", () => { graph.curves[graph.vary] = []; graph.sweep = null; u.runBtn.disabled = false; });
    gCard.insertAdjacentHTML("beforeend", `<div class="graph-key"><span><i style="background:${C.amber}"></i>light limiting</span><span><i style="background:${C.teal}"></i>CO₂ limiting</span><span><i style="background:${C.red}"></i>temperature limiting</span><span><i style="background:#fff;height:8px;width:8px;border-radius:50%"></i>you are here</span></div>`);

    // Elodea bubble counter
    const eCard = K.card(panel, y7 ? "Pondweed bubble counter" : "Elodea bubble counter");
    u.ec = document.createElement("canvas");
    u.ec.className = "elodea-canvas";
    u.ec.setAttribute("role", "img");
    eCard.appendChild(u.ec);
    u.ectx = u.ec.getContext("2d");
    eCard.insertAdjacentHTML("beforeend", `<p class="ps-small">${lens.pick({ "y7-8": "A classic school experiment: count the oxygen bubbles coming off a cut piece of pondweed. More bubbles = faster photosynthesis.", "y9-10": "A classic prac: O₂ bubbles from a cut sprig of Elodea per minute measure the rate of photosynthesis (shown sped up ×6)." })}</p>`);

    // key
    const lg = K.card(panel, "Key");
    const d = document.createElement("div");
    d.className = "legend";
    const keys = [["linear-gradient(90deg,#4f6bff,#3dff6a,#ff3d3d)", "Photon (light)"], [COL.e, "Electron (e⁻)"], [COL.h, "H⁺ (proton)"], [COL.h2o, "Water (H₂O)"], [COL.o2, "Oxygen (O₂)"], ["#9ca3af", "Carbon dioxide (CO₂)"], [COL.atp, "ATP"], [COL.nadph, "NADPH"]];
    if (lens.atLeast("y9-10")) keys.push([COL.rubp, "RuBP (5C)"], [COL.pga, "3-PGA (3C)"], [COL.g3p, "G3P sugar (3C)"]);
    keys.push([COL.glu, "Glucose (6C)"]);
    d.innerHTML = keys.map(([c, t]) => `<span><i style="background:${c}"></i>${t}</span>`).join("");
    lg.appendChild(d);

    // missions + quiz
    u.missions = K.missions(panel, lens.filter(MISSIONS).map((m) => ({ text: lens.pick(m.text), check: () => m.check(S, model, { pH: G.pH() }) })), (m) => toast(`🎯 Mission complete: ${m.text.replace(/<[^>]+>/g, "")}`, 3600));
    K.quiz(panel, lens.filter(QUIZ).map((q) => ({ q: lens.pick(q.q), options: lens.pick(q.options), answer: q.answer, why: lens.pick(q.why) })));
    buildChips();
    buildLabels();
  }

  // ---------- chips ----------
  let chips = {};
  function buildChips() {
    overlay.innerHTML = "";
    chips = { light: K.chip(overlay), co2: K.chip(overlay), temp: K.chip(overlay), o2: K.chip(overlay), glu: K.chip(overlay), store: K.chip(overlay), lim: K.chip(overlay) };
    [...overlay.children].forEach((c, i) => { c.classList.add("ps-chip"); if (i === 2 || i === 5) c.classList.add("opt"); });
    chips.limEl = overlay.lastChild;
    chips.limEl.classList.add("lim");
  }
  function updateChips() {
    const lname = S.white ? "white" : `${S.lambda} nm`, y7 = lens.band === "y7-8";
    chips.light(S.lampOn ? `Light <b>${Math.round(S.dcm)} cm</b> · ${lname} · <b>${Math.round(model.I * 100)}%</b>` : `Light <b>off</b>`);
    chips.co2(`CO₂ <b>${S.co2.toFixed(2)}%</b>`);
    chips.temp(`Temp <b>${S.temp} °C</b>`);
    chips.o2(`O₂ <b>${model.rate.toFixed(model.rate < 10 ? 1 : 0)}</b> bubbles/min`);
    chips.glu(`Glucose <b>${S.glucose}</b>`);
    chips.store(`<i class="dot" style="background:${COL.atp}"></i>${y7 ? "ATP" : "ATP"} <b>${S.atpStore.toFixed(0)}</b> · <i class="dot" style="background:${COL.nadph}"></i>NADPH <b>${S.nadphStore.toFixed(0)}</b>`);
    let name;
    if (!S.lampOn) name = "Light (lamp off)";
    else if (model.lim === "light") name = !S.white && model.a < 0.35 ? "Light (colour poorly absorbed)" : "Light intensity";
    else if (model.lim === "co2") name = "CO₂";
    else name = S.temp >= 33 ? "Temperature (too hot)" : S.temp < 20 ? "Temperature (too cold)" : "Temperature";
    chips.lim(`Limiting factor: <b>${name}</b>`);
    chips.limEl.style.color = LIMCOL[model.lim];
  }

  // ---------- 3D labels ----------
  let lbl = {};
  function buildLabels() {
    layer.innerHTML = "";
    const y9 = lens.atLeast("y9-10");
    lbl = {
      psii: mk("ps", lens.pick(NAMES.psii)), b6f: mk("ps", lens.pick(NAMES.b6f)), psi: mk("ps", lens.pick(NAMES.psi)), atps: mk("ps", lens.pick(NAMES.atps)),
      lumen: mk("side"), stroma: mk("side"), lamp: mk("ps"), drag: mk("drag", "⟷ drag me"), rub: mk("ps"), cal: mk("cal"), co2hint: mk("drag"),
    };
    if (y9) {
      lbl.oec = mk("rx", "2H₂O → 4H⁺ + O₂ + 4e⁻");
      lbl.atpRx = mk("rx", "ADP + Pᵢ → ATP"); lbl.atpRx.style.color = "#fde68a";
      lbl.nadRx = mk("rx", "NADP⁺ + 2e⁻ + H⁺ → NADPH"); lbl.nadRx.style.color = "#ddd6fe";
      lbl.pga = mk("rx", "3-PGA"); lbl.pga.style.color = "#fed7aa";
      lbl.g3p = mk("rx", "G3P"); lbl.g3p.style.color = "#d9f99d";
      lbl.rubp = mk("rx", "RuBP"); lbl.rubp.style.color = "#bfdbfe";
      lbl.red = mk("rx", "② Reduction · ATP + NADPH"); lbl.red.style.color = C.inkDim;
      lbl.reg = mk("rx", "③ Regeneration · ATP"); lbl.reg.style.color = C.inkDim;
    } else {
      lbl.oec = mk("rx", "water → oxygen");
      lbl.atpRx = mk("rx", "makes ATP"); lbl.atpRx.style.color = "#fde68a";
    }
  }
  const tv = new THREE.Vector3(), tv2 = new THREE.Vector3();
  function place(el, v, dx = 0, dy = 0) { if (el) engine.place(el, v, dx, dy); }
  function updateLabels() {
    const y7 = lens.band === "y7-8";
    place(lbl.psii, at(X.psii, -2.9, 0, tv));
    place(lbl.b6f, at(X.b6f, -2.6, 0, tv));
    place(lbl.psi, at(X.psi, -3.4, 0, tv));
    place(lbl.atps, at(X.atps + 2.6, -5.4, 0, tv));
    const narrow = engine.w < 600;
    for (const k of ["psii", "b6f", "psi", "atps"]) {
      lbl[k].classList.toggle("hover", hover === k);
      const nm = narrow ? SHORT[k] : lens.pick(NAMES[k]);
      if (lbl[k].textContent !== nm) lbl[k].textContent = nm;
    }
    const pH = G.pH();
    const lt = `${y7 && engine.w >= 600 ? "INSIDE THE THYLAKOID (LUMEN)" : "LUMEN"} · pH ≈ ${pH.toFixed(1)}`;
    if (lbl.lumen.textContent !== lt) lbl.lumen.textContent = lt;
    place(lbl.lumen, at(-6, 5.8, 3.5, tv));
    lbl.stroma.textContent = "STROMA · pH ≈ 8";
    place(lbl.stroma, at(-6.5, -5.2, 3.5, tv));
    const lp = G.lampPos(tv);
    const lt2 = `Lamp · ${Math.round(S.dcm)} cm · ${S.lampOn ? (S.white ? "white" : PM.colourName(S.lambda)) : "off"}`;
    if (lbl.lamp.textContent !== lt2) lbl.lamp.textContent = lt2;
    place(lbl.lamp, lp, lp.x > 2 ? -86 : 86, 0);
    lbl.drag.style.visibility = S.lampDragged ? "hidden" : "visible";
    place(lbl.drag, G.lampPos(tv).add(tv2.set(0, -1.9, 0)));
    const dead = model.P < 4;
    const rt = dead ? (y7 ? "Rubisco · too hot — not working" : "Rubisco · denatured") : S.manualFixed === 0 ? "① Rubisco · drag CO₂ here" : y7 ? "① Rubisco · grabs CO₂" : "① Rubisco · CO₂ fixation";
    if (lbl.rub.textContent !== rt) lbl.rub.textContent = rt;
    lbl.rub.classList.toggle("dead", dead);
    lbl.rub.classList.toggle("hover", hover === "rubisco");
    place(lbl.rub, tv.copy(G.rubPos).add(new THREE.Vector3(-0.6, 1.9, 0)));
    const ct = `${y7 ? "SUGAR-MAKING CYCLE" : "CALVIN CYCLE"}<b>${S.glucose} glucose</b>`;
    if (lbl.cal._h !== ct) { lbl.cal.innerHTML = ct; lbl.cal._h = ct; }
    place(lbl.cal, tv.copy(G.WC).add(new THREE.Vector3(0, -0.9, 0.3)));
    lbl.co2hint.textContent = drag?.kind === "co2" ? "drop on Rubisco" : "";
    if (drag?.kind === "co2") place(lbl.co2hint, tv.copy(drag.c.p).add(new THREE.Vector3(0, 0.9, 0)));
    place(lbl.oec, G.pts.oec.clone().add(tv.set(0, 1.0, 0)));
    place(lbl.atpRx, G.pts.head.clone().add(tv.set(0, -2.3, 0)));
    if (lbl.nadRx) place(lbl.nadRx, G.pts.fnr.clone().add(tv.set(1.2, -1.2, 0)));
    if (lbl.pga) {
      const W = G.WC, r = G.WR + 1.0, lab = (el, a) => place(el, tv.set(W.x + r * Math.cos(a), W.y + r * Math.sin(a), W.z));
      lab(lbl.pga, G.aR - TAU / 6); lab(lbl.g3p, G.aR - TAU / 2); lab(lbl.rubp, G.aR - (5 * TAU) / 6);
      place(lbl.red, G.redPos.clone().add(tv.set(1.4, 0.9, 0)));
      place(lbl.reg, G.regPos.clone().add(tv.set(0, -1.1, 0)));
    }
  }

  // ---------- selection text ----------
  function showSel() {
    if (!ui) return;
    ui.selInfo.innerHTML = sel ? `<strong>${lens.pick(NAMES[sel])}.</strong> ${lens.pick(INFO[sel])}` : lens.pick({ "y7-8": "Tap a protein, Rubisco, the lamp or a CO₂ molecule to find out what it does.", "y9-10": "Tap a protein, Rubisco, the lamp or the pondweed to see its role." });
  }
  function select(key) {
    sel = key && INFO[key] ? key : null;
    showSel();
    if (sel) panel.parentElement?.parentElement?.scrollTo?.({ top: 0, behavior: "smooth" });
  }

  // ---------- controls ----------
  function touched(v) {
    dirty = true;
    if (graph.sweep) return;
    if (graph.vary !== v && (v !== "colour" || lens.atLeast("y9-10"))) { graph.vary = v; ui?.varSeg.set(v); }
  }
  function syncControls() {
    if (!ui) return;
    ui.lampChk.checked = S.lampOn;
    ui.distS.value = Math.round(S.dcm);
    ui.co2S.value = S.co2; ui.tempS.value = S.temp;
    if (ui.lamS) ui.lamS.value = S.lambda;
    ui.colourSeg.set(S.white ? "white" : S.lambda);
  }
  function resetAll() {
    defaults();
    G.reset();
    graph.sweep = null;
    for (const k in graph.curves) graph.curves[k] = [];
    if (ui) ui.runBtn.disabled = false;
    dirty = true;
    syncControls();
    select(null);
    toast("Reset: fresh pondweed, enzymes and defaults.");
  }
  function runSweep() {
    const v = graph.vary, ax = GX[v], pts = [];
    for (let i = 0; i <= 60; i++) {
      const x = lerp(ax.min, ax.max, i / 60), s = { ...S };
      setVar(s, v, x);
      const r = PM.rates(s, v === "temp" ? 0 : S.den);
      pts.push({ x, y: r.rate, lim: r.lim });
    }
    graph.sweep = { vary: v, pts, t: 0, label: conditionsLabel(v) };
    ui.runBtn.disabled = true;
  }
  function finishSweep() {
    const sw = graph.sweep, list = graph.curves[sw.vary];
    list.push({ pts: sw.pts, label: sw.label });
    if (list.length > 4) list.shift();
    graph.sweep = null;
    if (ui) ui.runBtn.disabled = false;
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
    ui?.gc.setAttribute("aria-label", `Graph of O₂ production rate against ${GX[sw.vary].label}. ${msg}`);
    toast(msg, 5200);
  }
  function drawGraph() {
    const gc = ui.gc, w = gc.clientWidth, h = gc.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (gc.width !== Math.round(w * dpr) || gc.height !== Math.round(h * dpr)) { gc.width = Math.round(w * dpr); gc.height = Math.round(h * dpr); }
    const g = ui.gctx, ax = GX[graph.vary], YM = 100;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const pl = 34, pr = 10, pt = 12, pb = graph.vary === "colour" ? 40 : 32;
    const Xf = (x) => pl + ((x - ax.min) / (ax.max - ax.min)) * (w - pl - pr);
    const Yf = (y) => h - pb - (clamp(y, 0, YM) / YM) * (h - pt - pb);
    g.font = "10px Inter, system-ui, sans-serif";
    const _ink = K.cssVar("--ink", C.ink), _dim = K.cssVar("--ink-dim", C.inkDim), _faint = K.cssVar("--ink-faint", C.inkFaint);
    g.strokeStyle = K.cssVar("--grid-line", "rgba(160,190,230,0.12)"); g.lineWidth = 1; g.fillStyle = _faint;
    g.textAlign = "right"; g.textBaseline = "middle";
    for (let y = 0; y <= YM; y += 25) { g.beginPath(); g.moveTo(pl, Yf(y)); g.lineTo(w - pr, Yf(y)); g.stroke(); g.fillText(y, pl - 5, Yf(y)); }
    g.textAlign = "center"; g.textBaseline = "top";
    for (let i = 0; i <= 4; i++) { const x = lerp(ax.min, ax.max, i / 4); g.fillText(ax.fmt(x), Xf(x), h - pb + 4); }
    if (graph.vary === "colour") for (let l = 400; l < 700; l += 5) { g.fillStyle = PM.waveColour(l); g.fillRect(Xf(l), h - pb + 1, Xf(l + 5) - Xf(l) + 0.5, 3); }
    g.fillStyle = _dim; g.fillText(ax.label, (pl + w - pr) / 2, h - 13);
    g.save(); g.translate(9, (pt + h - pb) / 2); g.rotate(-Math.PI / 2); g.textBaseline = "middle"; g.fillText("O₂ bubbles/min", 0, 0); g.restore();
    g.strokeStyle = _faint; g.beginPath(); g.moveTo(pl, pt); g.lineTo(pl, h - pb); g.lineTo(w - pr, h - pb); g.stroke();
    const curve = (pts, upto, alpha, label, idx) => {
      g.save(); g.globalAlpha = alpha; g.lineWidth = 2.4; g.lineCap = "round";
      const n = Math.min(pts.length - 1, upto);
      for (let i = 0; i < n; i++) { g.strokeStyle = LIMCOL[pts[i].lim]; g.beginPath(); g.moveTo(Xf(pts[i].x), Yf(pts[i].y)); g.lineTo(Xf(pts[i + 1].x), Yf(pts[i + 1].y)); g.stroke(); }
      if (label && n === pts.length - 1) {
        const pk = pts.reduce((a, b) => (b.y > a.y ? b : a));
        g.font = "600 10px Inter, system-ui, sans-serif"; g.fillStyle = _ink; g.textBaseline = "bottom"; g.textAlign = "center";
        g.fillText(`${idx}: ${label}`, clamp(Xf(pk.x), pl + 40, w - pr - 40), Yf(pk.y) - 3);
      }
      g.restore();
    };
    const list = graph.curves[graph.vary];
    list.forEach((c, i) => curve(c.pts, c.pts.length, i === list.length - 1 && !graph.sweep ? 1 : 0.5, c.label, i + 1));
    if (graph.sweep && graph.sweep.vary === graph.vary) {
      const sw = graph.sweep, n = Math.floor(sw.t * (sw.pts.length - 1));
      curve(sw.pts, n, 1, null, 0);
      const p = sw.pts[Math.min(n, sw.pts.length - 1)];
      g.fillStyle = LIMCOL[p.lim]; g.beginPath(); g.arc(Xf(p.x), Yf(p.y), 4, 0, TAU); g.fill();
    }
    const cx = currentX(graph.vary);
    if (cx !== null) {
      g.strokeStyle = "#fff"; g.lineWidth = 2; g.fillStyle = LIMCOL[model.lim];
      g.beginPath(); g.arc(Xf(clamp(cx, ax.min, ax.max)), Yf(model.rate), 5, 0, TAU); g.fill(); g.stroke();
    }
  }
  function drawElodea(t) {
    const cv = ui.ec, w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const c = ui.ectx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    const iw = Math.min(w, h / 1.22);
    drawInset(c, { x: (w - iw) / 2, y: 0, w: iw, h }, { t, bubbles: G.bubbles, rate: model.rate, counted: S.bubblesCounted, light: model.I, lampOn: S.lampOn, lampCol: G.lampHex(), temp: S.temp });
  }

  // ---------- camera presets ----------
  function presetView(v) {
    const a = engine.camera.aspect, t = Math.tan(THREE.MathUtils.degToRad(engine.camera.fov / 2));
    if (v === "thylakoid") return { target: new THREE.Vector3(-0.5, 1.5, 0), d: clamp(13 / (t * a), 18, 60), dir: new THREE.Vector3(0, 0.35, 1) };
    if (v === "calvin") return { target: G.WC.clone().add(new THREE.Vector3(0, 0.5, 0)), d: clamp(6.5 / (t * Math.min(a, 1)), 14, 40), dir: new THREE.Vector3(0.05, 0.2, 1) };
    return { target: new THREE.Vector3(0, 1, 0), d: clamp(Math.max(16.5 / t, 15 / (t * a)), 36, 96), dir: new THREE.Vector3(0, 0.22, 1) };
  }
  function flyTo(v) {
    if (engine.busy) return;
    const p = presetView(v);
    engine.fly(p.target, p.target.clone().addScaledVector(p.dir.normalize(), p.d), 1.0);
  }

  // ---------- 3D interaction ----------
  let hover = null, drag = null;
  const plane = new THREE.Plane(), hitP = new THREE.Vector3();
  function rayOnPlaneZ(e, z) {
    plane.set(new THREE.Vector3(0, 0, 1), -z);
    const ray = engine.setRay(e.clientX, e.clientY).ray;
    return ray.intersectPlane(plane, hitP);
  }
  const fixMsgs = () => ({
    denatured: lens.pick({ "y7-8": "Rubisco is too hot — it has lost its shape, so CO₂ can't fit any more.", "y9-10": "Rubisco is denatured — its active site has lost its shape, so CO₂ can't bind." }),
    cold: "Too cold: Rubisco is barely working.",
    noFuel: lens.pick({ "y7-8": "Rubisco grabbed it, but there's no ATP or NADPH to finish making sugar. Turn up the light!", "y9-10": "Rubisco grabbed it, but there's no ATP/NADPH to finish the cycle. The Calvin cycle needs the light reactions — turn up the light!" }),
    first: lens.pick({ "y7-8": "Fixed! Rubisco joined your CO₂ to a sugar-building molecule.", "y9-10": "Fixed! Rubisco joined your CO₂ to RuBP (carbon fixation)." }),
  });

  // ---------- level ----------
  let uiT = 0, exT = 0, gT = 0;
  buildPanel();
  const level = {
    title: "Thylakoid membrane",
    debug: { S, G },
    topics: ["photosynthesis", "enzymes", "atp", "membrane"],
    root: G.root,
    pickables: G.pickables,
    metersPerUnit: METERS_PER_UNIT,      // bilayer ≈ 2.2 units ≈ 7.7 nm
    get view() { const p = presetView("both"); return { target: p.target, distance: p.d, dir: p.dir }; },
    minDistance: 4, maxDistance: 110, near: 0.05, far: 600,
    minPolar: 0.3, maxPolar: 2.5, enablePan: true,
    env: { bg: ["#06231c", "#0a3a2c", "#2a1650"], fog: ["#072a22", 0.012], exposure: 1.0, bloom: [0.55, 0.5, 0.82], aperture: 0.0012 },
    info(obj) {
      const k = obj.userData.key;
      if (!k) return null;
      const verb = k === "lamp" ? (lens.band === "y7-8" ? " — drag to move" : " — drag to change the distance") : k === "co2" ? " — drag onto Rubisco" : " — click for its role";
      return { title: lens.pick(NAMES[k]) + verb };
    },
    onHover(obj) { hover = obj?.userData.key || null; },
    onPointerDown(e, hit) {
      const k = hit?.object.userData.key;
      if (k === "lamp") { drag = { kind: "lamp", moved: false, x: e.clientX, y: e.clientY }; return true; }
      if (k === "co2") {
        const c = hit.object.userData.list?.[hit.instanceId];
        if (c) { c.held = true; drag = { kind: "co2", c }; return true; }
      }
      return false;
    },
    onPointerDrag(e) {
      if (!drag) return;
      if (drag.kind === "lamp") {
        if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4) drag.moved = true;
        if (!drag.moved) return;
        const p = rayOnPlaneZ(e, G.pts.T.z + 1.5);
        if (!p) return;
        const r = G.lampFromPoint(p);
        S.dcm = r.dcm; S.fx = r.fx; S.lampDragged = true;
        if (ui) ui.distS.value = S.dcm;
        touched("light");
      } else {
        const p = rayOnPlaneZ(e, drag.c.p.z);
        if (p) { drag.c.p.x = clamp(p.x, -16, 16); drag.c.p.y = clamp(p.y, -18, -3); drag.c.v.set(0, 0, 0); }
      }
    },
    onPointerUp() {
      if (!drag) return;
      if (drag.kind === "lamp" && !drag.moved) select("lamp");
      if (drag.kind === "co2") {
        const c = drag.c;
        c.held = false;
        const sa = tv.copy(c.p).project(engine.camera), sb = tv2.copy(G.rubPos).project(engine.camera);
        const px = Math.hypot((sa.x - sb.x) * engine.w, (sa.y - sb.y) * engine.h) / 2;
        if (px < 46 || Math.hypot(c.p.x - G.rubPos.x, c.p.y - G.rubPos.y) < 2.4) G.manualFix(c, model, fixMsgs());
      }
      drag = null;
    },
    onClick(e, hit) {
      const k = hit?.object.userData.key;
      select(k && k !== "co2" ? k : k === "co2" ? "co2" : null);
      return true;
    },
    mountPanel(el) {
      if (!ui || ui.band !== lens.band) buildPanel();
      el.appendChild(panel);
      engine.overlay.appendChild(overlay);
      engine.labelLayer.appendChild(layer);
    },
    unmountPanel() { drag = null; overlay.remove(); layer.remove(); },
    onLens() { buildPanel(); },
    update(dt, t, realDt = dt) {
      const d = dt * L.speed;
      if (S.temp > 42 && d) { S.den = Math.min(1, S.den + d * (S.temp - 42) * 0.04); dirty = true; }
      model = PM.rates(S, S.den);
      if (d) G.step(d, t, model);
      G.render(t, model, { hover });
      updateLabels();
      pushShared();
      if (graph.sweep) { graph.sweep.t = Math.min(1, graph.sweep.t + realDt / 2.2); if (graph.sweep.t >= 1) finishSweep(); }
      if ((uiT -= realDt) <= 0) { uiT = 0.2; updateChips(); }
      if ((gT -= realDt) <= 0) { gT = 0.05; drawGraph(); drawElodea(t); }
      if ((exT -= realDt) <= 0) {
        exT = 0.5;
        const html = explain(S, model, lens.band) + nowLine(S, model, { pH: G.pH(), spin: G.rotorSpeed }, lens.band) +
          `<p class="ps-small">${lens.pick({ "y7-8": "Not to scale: everything is drawn much bigger and slower than real life, and each moving dot stands for many molecules.", "y9-10": "Not to scale: proteins are enlarged, the membrane is a short section (≈ 7–8 nm thick), and each animated particle stands for many molecules. Rates use a simplified limiting-factors model." })}</p>`;
        if (ui.explainBody.innerHTML !== html) ui.explainBody.innerHTML = html;
      }
      ui.missions.update();
    },
    dispose() { drag = null; pushShared(); overlay.remove(); layer.remove(); },
  };
  return level;
}
