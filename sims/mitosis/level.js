// Cell division (mitosis) as a CellScape level: MitosisModel (model.js) drives the 3D scene (scene3d.js).
// Entered from the plant cell (the nucleus is the portal) or booted on its own page (sims/mitosis/index.html).
// The heart of it is cause and effect: checkpoints, drugs and mutations gate the cycle, and the learner can
// unhook a kinetochore, poison the spindle or knock out cyclin B and watch the knock-on effects.
import * as THREE from "three";
import * as K from "../../assets/js/kit.js";
import { MitosisModel, PH, I, TOTAL, CHR3, GATE_PM } from "./model.js";
import { Scene3D, SCALE } from "./scene3d.js";
import { PARTS, COMPARE, MISSIONS, QUIZ, narrative, taskText, CHR_NAME } from "./content3d.js";

const CSS = `
.mi-tl { position: absolute; left: 14px; right: 14px; bottom: 130px; z-index: 3; pointer-events: none; }  /* sits above the Microscope / Pause buttons (bottom-right) so the Cytokinesis/G1 end of the strip is never covered */
.mi-tl .bar { position: relative; height: 20px; display: flex; gap: 2px; pointer-events: auto; cursor: pointer; touch-action: none; border-radius: 7px; }
.mi-tl.locked .bar { cursor: not-allowed; }
.mi-tl .seg { flex: 1 1 0; border-radius: 5px; background: rgba(79,209,197,0.16); color: var(--ink-dim); font-size: 0.68rem; display: flex; align-items: center; justify-content: center; overflow: hidden; white-space: nowrap; user-select: none; }
.mi-tl .seg.m { background: rgba(167,139,250,0.18); }
.mi-tl .seg.c { background: rgba(248,113,113,0.18); }
.mi-tl .seg.on { color: var(--ink); background: rgba(79,209,197,0.45); }
.mi-tl .seg.m.on { background: rgba(167,139,250,0.5); }
.mi-tl .seg.c.on { background: rgba(248,113,113,0.5); }
.mi-tl .cur { position: absolute; top: -4px; bottom: -4px; width: 3px; margin-left: -1.5px; background: var(--ink); border-radius: 2px; box-shadow: 0 0 8px var(--ink); pointer-events: none; }
.mi-tl .chk { position: absolute; top: -15px; transform: translateX(-50%); font-size: 0.66rem; color: var(--t-warn); text-shadow: 0 1px 4px var(--shadow); pointer-events: none; white-space: nowrap; }
.mi-tl .chk.held { color: var(--t-bad); animation: mi-pulse 1s ease-in-out infinite; }
.mi-tl .grp { position: relative; height: 12px; font-size: 0.64rem; color: var(--ink-faint); margin-top: 2px; text-shadow: 0 1px 4px var(--shadow); }
@keyframes mi-pulse { 50% { opacity: 0.45; } }
.mi-act { position: absolute; left: 50%; bottom: 172px; transform: translateX(-50%); z-index: 3; max-width: calc(100% - 28px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; touch-action: none;
  background: rgba(251,191,36,0.18); border-color: rgba(251,191,36,0.7); color: #fff7d6; box-shadow: 0 0 18px rgba(251,191,36,0.25); }
.mi-act.holding { background: rgba(251,191,36,0.42); }
.mi-act[disabled] { opacity: 0.55; box-shadow: none; }
.mi .task { margin-top: 8px; padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(251,191,36,0.45); background: rgba(251,191,36,0.08); color: var(--ink); }
.mi .note { font-size: 0.76rem; color: var(--ink-faint); }
.mi .mi-gate { display: block; padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(248,113,113,0.5); background: rgba(248,113,113,0.08); color: var(--ink); }
.mi .cmp { width: 100%; border-collapse: collapse; font-size: 0.78rem; margin-top: 8px; }
.mi .cmp th, .mi .cmp td { text-align: left; padding: 4px 5px; border-top: 1px solid var(--panel-border); vertical-align: top; }
.mi .cmp th { color: var(--ink-faint); font-weight: 600; }
.mi .cmp td.cur { color: var(--ink); background: rgba(79,209,197,0.08); }
.mi .xp small { display: block; color: var(--ink-faint); font-size: 0.74rem; margin: -2px 0 6px 24px; }
.mi .xp .seg-l { font-size: 0.8rem; color: var(--ink-dim); margin: 8px 0 4px; }
.mi .countcard .opts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.mi .countcard .fb { font-size: 0.85rem; margin-top: 8px; color: var(--ink-dim); }
.mi canvas.mi-graph { width: 100%; height: 110px; display: block; }
.lbl3d.mi-wait { color: #fde68a; font-size: 0.66rem; font-weight: 700; text-shadow: 0 0 8px #f59e0b, 0 1px 4px #000; }
.mi-chip .w { color: var(--ink-faint); }
.chip.mi-hold { border-color: rgba(248,113,113,0.7); }
@media (max-width: 600px) { .mi-tl { bottom: 126px; left: 10px; right: 10px; } .mi-tl .seg { font-size: 0.6rem; } .mi-act { bottom: 164px; font-size: 0.8rem; } .mi-chip.opt { display: none; } }
@media (prefers-reduced-motion: reduce) { .mi-tl .chk.held { animation: none; } }
`;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function create(engine) {
  if (!document.getElementById("mi-css")) {
    const st = document.createElement("style");
    st.id = "mi-css"; st.textContent = CSS;
    document.head.appendChild(st);
  }
  const lens = engine.lens;
  const toast = (m, ms) => engine.toast?.(m, ms);
  // link to the plant cell (the level we dived from): its ATP powers division here
  const parentInst = engine.stack.at(-1)?.inst;
  const pm = parentInst?.model && typeof parentInst.model.atp === "number" ? parentInst.model : null;

  const M = new MitosisModel();
  if (parentInst?.species === "animal") M.cellType = "animal";
  const G = new Scene3D(engine);
  G.setCellType(M.cellType);
  const root = G.root;
  const state = { labels: true, speed: engine.reducedMotion ? 0.6 : 1, counted: false, sel: null, drag: null, holdBtn: false, holdCell: false, standaloneATP: 75, lastGate: null, scrubbing: false, playing: true };
  const v = new THREE.Vector3(), v2 = new THREE.Vector3();
  const um = (x, y, z) => v.set(x * SCALE, y * SCALE, z * SCALE);

  // ---------- stage DOM: timeline + action button ----------
  const tl = document.createElement("div");
  tl.className = "mi-tl";
  tl.innerHTML = `<div class="bar" role="slider" aria-label="Cell cycle timeline" tabindex="0" aria-valuemin="0" aria-valuemax="${TOTAL}"></div><div class="grp"></div>`;
  const bar = tl.querySelector(".bar");
  {
    const grp = tl.querySelector(".grp");
    for (const [a, b, txt] of [[I.G1, I.G2, "Interphase"], [I.pro, I.telo, "Mitosis (M phase)"], [I.cyto, I.cyto, "Cytokinesis"]]) {
      const sp = document.createElement("span");
      sp.style.cssText = `position:absolute;left:${((PH[a].start + PH[b].end) / 2 / TOTAL) * 100}%;transform:translateX(-50%);white-space:nowrap`;
      sp.textContent = txt; grp.appendChild(sp);
    }
  }
  const segs = PH.map((ph, i) => {
    const s = document.createElement("div");
    s.className = "seg" + (i >= I.pro && i <= I.telo ? " m" : i === I.cyto ? " c" : "");
    s.style.flexGrow = ph.dur;
    s.dataset.full = ph.label || ph.name.replace("Interphase · ", "").replace(" phase", "");
    s.dataset.short = ph.short;
    bar.appendChild(s);
    return s;
  });
  const cur = document.createElement("div"); cur.className = "cur"; bar.appendChild(cur);
  const chkG2 = document.createElement("div"); chkG2.className = "chk"; chkG2.textContent = "◆ G2 check";
  const chkSAC = document.createElement("div"); chkSAC.className = "chk"; chkSAC.textContent = "◆ spindle check";
  bar.append(chkG2, chkSAC);
  const xFrac = (T) => T / TOTAL;
  chkG2.style.left = `${xFrac(PH[I.G2].start + 0.8 * PH[I.G2].dur) * 100}%`;
  chkSAC.style.left = `${xFrac(PH[I.meta].end) * 100}%`;
  const scrubTo = (e) => {
    const r = bar.getBoundingClientRect();
    M.scrub(clamp((e.clientX - r.left) / r.width, 0, 1) * TOTAL);
    state.playing = true;
  };
  bar.addEventListener("pointerdown", (e) => {
    if (M.mode !== "watch") { toast(lens.pick({ "y7-8": "In Do it yourself, your actions move the cell on — the timeline is locked.", "y9-10": "The timeline is locked in Do-it-yourself mode: your actions move the cell through the cycle." })); return; }
    state.scrubbing = true; bar.setPointerCapture(e.pointerId); scrubTo(e);
  });
  bar.addEventListener("pointermove", (e) => { if (state.scrubbing) scrubTo(e); });
  const endScrub = () => { state.scrubbing = false; };
  bar.addEventListener("pointerup", endScrub); bar.addEventListener("pointercancel", endScrub);
  bar.addEventListener("keydown", (e) => {
    if (M.mode !== "watch") return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); const k = clamp(M.k + (e.key === "ArrowRight" ? 1 : -1), 0, PH.length - 1); M.scrub(PH[k].start + 0.01); }
  });
  const act = document.createElement("button");
  act.type = "button"; act.className = "btn mi-act";
  const holdOn = () => { state.holdBtn = true; act.classList.add("holding"); };
  const holdOff = () => { state.holdBtn = false; act.classList.remove("holding"); };
  act.addEventListener("pointerdown", (e) => { e.preventDefault(); const g = M.gate; if (g === "pull" || g === "plate" || g === "pinch") holdOn(); });
  act.addEventListener("pointerup", holdOff); act.addEventListener("pointerleave", holdOff); act.addEventListener("pointercancel", holdOff);
  act.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { const g = M.gate; if (g === "pull" || g === "plate" || g === "pinch") { e.preventDefault(); holdOn(); } } });
  act.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") holdOff(); });
  act.addEventListener("click", () => oneShot());

  function oneShot() {
    const g = M.gate, k = M.k;
    if (M.mode !== "diy") return;
    if (k === I.G1) { toast(lens.pick({ "y7-8": "Not yet — DNA is copied in the next stage (S phase).", "y9-10": "Not yet — DNA is only copied in <strong>S phase</strong>. Let G1 finish." })); return; }
    if (g === "rep") { replicateNext(); return; }
    if (g === "align" || g === "trigger" || (k >= I.prometa && k <= I.meta)) tryTrigger();
  }
  function replicateNext(near) {
    let best = -1, bd = 1e9;
    CHR3.forEach((c, i) => {
      if (M.repOn[i]) return;
      const d = near ? Math.hypot(c.home[0] - near.x, c.home[1] - near.y, c.home[2] - near.z) : i;
      if (d < bd) { bd = d; best = i; }
    });
    if (best < 0) return;
    M.replicate(best);
    const n = M.repOn.filter(Boolean).length;
    toast(n === 1 ? lens.pick({ "y7-8": "Copying! A matching copy grows along the chromosome.", "y9-10": "Copying! DNA polymerase builds a matching <strong>sister chromatid</strong> — from several starting points at once.", y11: "Replication forks fire from several origins and move apart bidirectionally; cohesin is loaded behind them." }) : `Copying chromosome ${n} of 4…`);
  }
  function tryTrigger() {
    const r = M.trigger();
    if (r === "sac") {
      const n = M.unattachedList().length;
      toast(lens.pick({
        "y7-8": "<strong>Blocked!</strong> Not every chromosome is hooked on from both ends. The cell won't pull anything apart until they all are.",
        "y9-10": `<strong>Spindle checkpoint — anaphase blocked!</strong> ${n} kinetochore${n === 1 ? " is" : "s are"} still unattached. The wait signal keeps cohesin intact, so each daughter will get exactly one copy of every chromosome.`,
        y11: `<strong>SAC: anaphase blocked.</strong> ${n} unattached kinetochore${n === 1 ? "" : "s"} → MCC → APC/C–Cdc20 inhibited → securin intact → separase off.`,
      }), 5200);
    } else if (r === "early") toast("Not yet — the chromosomes aren't on the spindle yet.");
    else if (r === "ok") toast(M.restit ? "No spindle: the chromatids separate in place…" : lens.pick({ "y7-8": "Go! The glue is cut…", "y9-10": "Checkpoint satisfied: <strong>separase</strong> cuts the cohesin…", y11: "APC/C–Cdc20 on: securin and cyclin B destroyed → separase cleaves cohesin." }));
  }

  // ---------- labels ----------
  const LBL = {
    nucleus: { name: () => "Nucleus", at: () => um(0, 5.9, 0), when: (o) => o.env > 0.6 && o.k < I.pro },
    chromatin: { name: () => lens.pick({ "y7-8": "DNA (unwound)", "y9-10": "Chromatin", y11: "Chromatin (chromosome territories)" }), at: () => um(-2.6, 2.9, 1.5), when: (o) => o.k <= I.G2 },
    nucleolus: { name: () => "Nucleolus", at: () => um(1.9, -3.1, 1.4), when: (o) => o.nucleolus > 0.6 && o.k <= I.G2, band: "y9-10" },
    ppb: { name: () => lens.pick({ "y7-8": "Ring of fibres (marks the split)", "y9-10": "Preprophase band" }), at: () => um(0, -PLANT_HY() + 0.6, -3), when: (o) => o.plant && o.ppb > 0.5 },
    cdz: { name: () => "Division zone (PPB memory)", at: () => um(0, PLANT_HY(), 4), when: (o) => o.plant && o.cdz && o.ppb < 0.3 && o.k <= I.telo, band: "y11" },
    centro: { name: () => lens.pick({ "y7-8": "Centrosome", "y9-10": "Centrosome (2 centrioles)" }), at: (o) => um(o.cs[0][0], o.cs[0][1] + 1.6, o.cs[0][2]), when: (o) => !o.plant && o.k <= I.meta },
    pole: { name: () => lens.pick({ "y7-8": "Spindle end (no centrosome)", "y9-10": "Spindle pole (no centrosome)" }), at: (o) => um(o.poles[1][0], 3.2, 0), when: (o) => o.plant && o.k >= I.prometa && o.k <= I.meta && M.mtsOK },
    kt: { name: () => "Kinetochore", at: () => G.ktPos[3].clone().multiplyScalar(SCALE).add(v2.set(0, 9, 0)), when: (o) => G.ktShown && o.k >= I.prometa && o.k <= I.meta && !M.gate, band: "y9-10" },
    coh: { name: () => lens.pick({ "y7-8": "Glue (cohesin)", "y9-10": "Cohesin" }), at: () => G.clAt(0, 0, CHR3[0].cpos, v2).multiplyScalar(SCALE).add(v.set(0, -8, 0)), when: (o) => (o.k === I.G2 || o.k === I.meta || o.k === I.pro) && o.chr[0].rep >= 1 },
    plate: { name: () => "Metaphase plate", at: () => um(0, -5.6, 0), when: (o) => o.k === I.meta },
    kf: { name: () => lens.pick({ "y7-8": "Spindle fibres", "y9-10": "Kinetochore fibre" }), at: (o) => um(o.poles[0][0] * 0.5, -3.2, 1.5), when: (o) => o.k === I.meta && M.mtsOK && G.mtsOn },
    ast: { name: () => "Astral microtubules", at: (o) => um(o.cs[0][0] - 2.4, -2.4, 0), when: (o) => !o.plant && o.k >= I.prometa && o.k <= I.ana && G.mtsOn, band: "y9-10" },
    sep: { name: () => lens.pick({ "y7-8": "Scissors (separase)", "y9-10": "Separase" }), at: () => G.sepHome[0].clone().multiplyScalar(SCALE).add(v2.set(0, 9, 0)), when: (o) => (o.k === I.meta || (o.k === I.ana && o.sepase < 0.5)) && !o.restit },
    ip: { name: () => "Interpolar MTs + kinesin-5", at: () => um(0, 3.6, 0), when: (o) => o.k === I.ana && o.s > 0.3 && G.mtsOn, band: "y11" },
    phrag: { name: () => "Phragmoplast", at: (o) => um(0, Math.min(PLANT_HY() - 1.5, o.plate * 14.4 + 2.2), 0), when: (o) => o.plant && o.phrag > 0.4 },
    cplate: { name: (o) => (o.k === I.done ? lens.pick({ "y7-8": "New wall", "y9-10": "New cell wall (was the cell plate)" }) : "Cell plate"), at: () => um(0, -2.5, -3.2), when: (o) => o.plant && o.plate > 0.15 },
    ves: { name: () => lens.pick({ "y7-8": "Packages from the Golgi", "y9-10": "Golgi vesicles" }), at: () => um(-8.6, 6.1, -3.6), when: (o) => o.plant && o.phrag > 0.3 && o.plate < 0.99 },
    ring: { name: () => lens.pick({ "y7-8": "Squeezing ring", "y9-10": "Contractile ring (actin + myosin)" }), at: (o) => um(0, -(11 * o.b * (1 - o.f)) - 1.4, 0), when: (o) => !o.plant && o.f > 0.15 && !o.split },
    d1: { name: () => "Daughter cell", at: (o) => um(-o.dcx - (o.split ? o.g * 11 : 0), o.plant ? 7.5 : 7.2, 0), when: (o) => o.k === I.done && !o.restit },
    d2: { name: () => "Daughter cell", at: (o) => um(o.dcx + (o.split ? o.g * 11 : 0), o.plant ? 7.5 : 7.2, 0), when: (o) => o.k === I.done && !o.restit },
    tetra: { name: () => lens.pick({ "y7-8": "One cell, 8 chromosomes", "y9-10": "Tetraploid nucleus (4n = 8)" }), at: () => um(0, 6.6, 0), when: (o) => o.restit && o.k >= I.telo },
  };
  const PLANT_HY = () => 10;
  const NARROW_HIDE = { nucleolus: 1, coh: 1, ast: 1, ip: 1, cdz: 1, kf: 1, ves: 1 };
  const labels = {};
  const waitLbl = [];
  function makeLabels() {
    for (const el of Object.values(labels)) el.remove();
    for (const el of waitLbl) el.remove();
    waitLbl.length = 0;
    for (const k of Object.keys(LBL)) labels[k] = engine.label("", "org");
    for (let i = 0; i < 8; i++) { const el = engine.label("", "mi-wait"); el.style.display = "none"; waitLbl.push(el); }
  }
  function hideLabels() { for (const el of Object.values(labels)) el.style.display = "none"; for (const el of waitLbl) el.style.display = "none"; }
  function updateLabels(o) {
    const narrow = engine.camera.aspect < 0.8;
    for (const [k, def] of Object.entries(LBL)) {
      const el = labels[k];
      if (!el) continue;
      if (!state.labels || (def.band && !lens.atLeast(def.band)) || !def.when(o) || (narrow && NARROW_HIDE[k])) { el.style.display = "none"; continue; }
      const html = def.name(o);
      if (el._h !== html) { el.innerHTML = html; el._h = html; }
      engine.place(el, def.at(o));
    }
    // a "wait" tag on each unattached kinetochore while the checkpoint is what's holding the cell
    const showWait = state.labels && G.ktShown && (M.gate === "sac" || o.k === I.meta || M.gate === "trigger" || (M.gate === "align" && M.mode === "diy")) && !o.restit;
    const txt = lens.pick({ "y7-8": "wait!", "y9-10": "⏸ wait signal", y11: "⏸ Mad2 'wait'" });
    let shown = 0;
    for (let id = 0; id < 8; id++) {
      const el = waitLbl[id];
      if (!el) continue;
      const on = showWait && G.wait[id].visible && shown < (narrow ? 2 : 8);
      if (!on) { el.style.display = "none"; continue; }
      shown++;
      if (el._h !== txt) { el.textContent = txt; el._h = txt; }
      engine.place(el, G.ktPos[id].clone().multiplyScalar(SCALE), 0, -16);
    }
  }

  // ---------- panel ----------
  let progress = null, panelEl, explainBody, selCard, cmpEl, countCard, dnaCv, cycCv, mission, chipFns = null, ctl = {};
  function buildPanel(el) {
    panelEl = el;
    const host = document.createElement("div");
    host.style.display = "contents";
    host.className = "mi";
    el.appendChild(host);
    progress = { band: lens.band, node: host };
    el = host;
    const y7 = lens.band === "y7-8", senior = lens.atLeast("y11");

    const ex = K.card(el, "What's happening", "explain");
    explainBody = document.createElement("div");
    explainBody.setAttribute("aria-live", "polite");
    ex.appendChild(explainBody);
    selCard = K.card(el, "Selected", "sel-card");
    selCard.style.display = "none";

    countCard = K.card(el, lens.pick({ "y7-8": "Count the chromosomes", "y9-10": "Count the chromosomes" }), "countcard");
    countCard.style.display = "none";

    // cell type
    const ct = K.card(el, lens.pick({ "y7-8": "Plant cell or animal cell?", "y9-10": "Plant vs animal cell division" }));
    ctl.type = K.segmented(ct, [{ value: "plant", label: lens.pick({ "y7-8": "🌱 Plant cell", "y9-10": "🌱 Plant (meristem)" }) }, { value: "animal", label: "🐾 Animal cell" }], M.cellType, (val) => setCellType(val));
    cmpEl = document.createElement("div");
    ct.appendChild(cmpEl);
    renderCompare();
    if (parentInst?.species === "animal") ct.insertAdjacentHTML("beforeend", `<p class="hint">${lens.pick({
      "y7-8": "Body cells divide to grow and to repair damage. Liver cells usually rest, but they start dividing again if the liver is injured.",
      "y9-10": "Mitosis makes new body cells for growth and repair. Liver cells normally rest, but they can re-enter the cell cycle to regrow a damaged liver.",
      y11: "Hepatocytes are normally quiescent (G0) but re-enter G1 after injury or partial hepatectomy, so the liver regenerates. Constantly dividing tissues include skin, gut lining and bone marrow.",
    })}</p>`);
    else ct.insertAdjacentHTML("beforeend", `<p class="hint">${lens.pick({
      "y7-8": "Big leaf cells like the one you came from don't divide much. New plant cells are made at the tips of roots and shoots, in small young cells like this one.",
      "y9-10": "Mature leaf cells rarely divide. Plant cells divide in <strong>meristems</strong> (root and shoot tips): small cells with a thin wall and no big vacuole — like this one.",
      y11: "Division happens in meristematic cells (thin primary wall, small vacuoles). Mature mesophyll cells like the one you dived from are usually post-mitotic.",
    })}</p>`);

    // controls
    const cc = K.card(el, "Controls");
    ctl.mode = K.segmented(cc, [{ value: "watch", label: lens.pick({ "y7-8": "▶ Watch", "y9-10": "▶ Watch" }) }, { value: "diy", label: "✋ Do it yourself" }], M.mode, (val) => setMode(val));
    const r = K.buttonRow(cc);
    ctl.play = K.button(r, state.playing ? "Pause cycle" : "Play cycle", () => { state.playing = !state.playing; if (M.mode === "watch" && M.T >= TOTAL - 1e-3) { M.reset(); state.playing = true; } syncPlay(); });
    K.button(r, "Reset", () => resetRun());
    K.slider(cc, { label: "Speed", min: 0.25, max: 3, step: 0.25, value: state.speed, format: (x) => `${x}×`, onInput: (x) => (state.speed = x) });
    cc.insertAdjacentHTML("beforeend", `<p class="hint">${lens.pick({ "y7-8": "Watch: drag the timeline under the cell to scrub. Do it yourself: you copy the DNA, line up the chromosomes, pull them apart and split the cell.", "y9-10": "Watch: drag the timeline to scrub through the cycle. Do it yourself: tap to replicate, drag chromosomes onto the plate in 3D, start anaphase, then build the cell plate or close the furrow." })}</p>`);

    // experiments
    const xp = K.card(el, lens.pick({ "y7-8": "Experiments: mess with the cell", "y9-10": "Experiments: change one part", y11: "Experiments: checkpoints, drugs, mutations" }), "xp");
    xp.insertAdjacentHTML("beforeend", `<p class="hint" style="margin:0 0 8px">${lens.pick({ "y7-8": "Change one thing and watch what else happens.", "y9-10": "Each one breaks a link in the chain. Predict first, then watch.", y11: "Each perturbation acts on one component; follow the knock-on effects (and the cyclin–CDK graph)." })}</p>`);
    const xr = K.buttonRow(xp);
    K.button(xr, lens.pick({ "y7-8": "Unhook a chromosome", "y9-10": "Detach a kinetochore" }), () => detachSome());
    K.button(xr, lens.pick({ "y7-8": "Damage the DNA (UV)", "y9-10": "Damage the DNA (UV)" }), () => {
      if (M.addDamage()) toast(lens.pick({ "y7-8": "Zap! The DNA is damaged. Watch what the cell does.", "y9-10": "UV damage! The <strong>G2 checkpoint</strong> will hold the cell until it's repaired.", y11: "DNA lesions → ATM/ATR → Chk1/2 → Cdc25 inhibited: CDK1 can't be activated until repair." }));
      else toast(lens.pick({ "y7-8": "Too late — the cell is already dividing. Try earlier (before it starts).", "y9-10": "The G2 checkpoint has already been passed — damage it in G1, S or G2." }));
    });
    xp.insertAdjacentHTML("beforeend", `<small style="margin-left:0">${lens.pick({ "y7-8": "Tip: you can also tap a glowing hook on a chromosome.", "y9-10": "Tip: tap any kinetochore in 3D to detach it." })}</small>`);
    ctl.colch = K.checkbox(xp, lens.pick({ "y7-8": "Spindle poison (colchicine): no fibres can form", "y9-10": "Colchicine (stops microtubules forming)" }), M.colchicine, (val) => { M.colchicine = val; toast(val ? lens.pick({ "y7-8": "Colchicine added: the fibres fall apart.", "y9-10": "Colchicine: tubulin can't join up, so microtubules vanish.", y11: "Colchicine binds free tubulin dimers: polymerisation stops and MTs depolymerise." }) : "Colchicine washed out: microtubules can grow again."); });
    xp.insertAdjacentHTML("beforeend", `<small>${lens.pick({ "y7-8": "Plant breeders use it to make plants with double sets of chromosomes.", "y9-10": "Used by plant breeders to double chromosome numbers (polyploid crops).", y11: "Extension: prolonged arrest → restitution nucleus (4n). Used to make polyploid crops." })}</small>`);
    if (!y7) {
      ctl.taxol = K.checkbox(xp, lens.pick({ "y9-10": "Taxol (microtubules can't shrink)", y11: "Taxol / paclitaxel (stabilises microtubules)" }), M.taxol, (val) => { M.taxol = val; toast(val ? "Taxol: microtubules can grow but not shrink." : "Taxol washed out."); });
      xp.insertAdjacentHTML("beforeend", `<small>${lens.pick({ "y9-10": "A cancer drug from yew trees.", y11: "Chemotherapy drug: no dynamics → no tension → SAC arrest." })}</small>`);
    }
    ctl.coh = K.checkbox(xp, lens.pick({ "y7-8": "Mutation: the glue on one chromosome can't be cut", "y9-10": "Mutation: cohesin on chromosome 1 can't be cut", y11: "Mutation: separase-resistant cohesin (chromosome 1)" }), M.cohesinMut, (val) => {
      M.cohesinMut = val;
      if (M.dest) toast("This takes effect at the next anaphase — press Reset (or scrub back) to see it.", 3600);
      else if (val) toast(lens.pick({ "y7-8": "Watch the long pink chromosome when the copies are pulled apart.", "y9-10": "Watch chromosome 1 (long, pink) at anaphase." }));
    });
    xp.insertAdjacentHTML("beforeend", `<small>${lens.pick({ "y7-8": "Leads to new cells with the wrong number of chromosomes.", "y9-10": "→ nondisjunction → aneuploid daughter cells.", y11: "→ nondisjunction → 2n+1 / 2n−1 daughters." })}</small>`);
    if (senior) {
      const sl = document.createElement("div"); sl.className = "seg-l"; sl.textContent = "Cyclin B (the mitosis 'switch' partner of CDK1)"; xp.appendChild(sl);
      ctl.cyc = K.segmented(xp, [{ value: "none", label: "Normal" }, { value: "noB", label: "Knockout" }, { value: "stable", label: "Can't be destroyed" }], M.cyclinKO, (val) => {
        M.cyclinKO = val;
        toast(val === "noB" ? "No cyclin B: CDK1 can't be switched on." : val === "stable" ? "Non-degradable cyclin B: APC/C can't remove it." : "Cyclin B back to normal.");
      });
    }
    if (lens.atLeast("y12")) {
      ctl.cp = K.checkbox(xp, "Checkpoints off (lost Mad2 / Chk1 — like many cancer cells)", M.cpOff, (val) => { M.cpOff = val; toast(val ? "Checkpoints disabled: the cell no longer waits for repair or for attachment." : "Checkpoints restored."); });
    }
    // energy
    const en = document.createElement("div"); en.className = "seg-l"; en.textContent = lens.pick({ "y7-8": "Energy", "y9-10": "Energy supply (ATP)" }); xp.appendChild(en);
    if (pm) {
      ctl.mito = K.checkbox(xp, lens.pick({ "y7-8": "The plant cell's mitochondria are working", "y9-10": "Mitochondria in the plant cell are on" }), pm.on.mitochondrion, (val) => { pm.on.mitochondrion = val; toast(val ? "Mitochondria back on: ATP will recover." : lens.pick({ "y7-8": "Mitochondria off: the cell's energy will run down…", "y9-10": "Mitochondria off: ATP will fall (only a trickle from glycolysis)…" })); });
      xp.insertAdjacentHTML("beforeend", `<small>${lens.pick({ "y7-8": "Linked to the plant cell you zoomed in from.", "y9-10": "Linked: this is the same cell's ATP you saw in the plant cell level." })}</small>`);
      ctl.poison = K.checkbox(xp, lens.pick({ "y7-8": "Block all energy (poison)", "y9-10": "Block ATP completely (respiratory poison)" }), M.blockATP, (val) => { M.blockATP = val; });
    } else {
      K.slider(xp, { label: "ATP supply", min: 0, max: 100, value: state.standaloneATP, unit: " %", onInput: (x) => (state.standaloneATP = x) });
    }

    // graphs
    const gc = K.card(el, lens.pick({ "y7-8": "How much DNA?", "y9-10": "DNA content per cell" }));
    dnaCv = document.createElement("canvas"); dnaCv.className = "mi-graph"; dnaCv.setAttribute("role", "img"); gc.appendChild(dnaCv);
    gc.insertAdjacentHTML("beforeend", `<p class="hint">${lens.pick({ "y7-8": "The DNA doubles when it's copied, then halves when the cell splits.", "y9-10": "2C → 4C in S phase; back to 2C in each daughter cell.", y11: "C = DNA in one haploid set. Mitosis halves 4C into 2C + 2C; chromosome number stays 2n." })}</p>`);
    if (senior) {
      const cy = K.card(el, "Cyclin–CDK oscillator");
      cycCv = document.createElement("canvas"); cycCv.className = "mi-graph"; cycCv.setAttribute("role", "img"); cy.appendChild(cycCv);
      cy.insertAdjacentHTML("beforeend", `<div class="legend" style="margin-top:6px"><span><i style="background:#fb923c"></i>Cyclin B</span><span><i style="background:#22d3ee"></i>CDK1 activity (MPF)</span><span><i style="background:#4ade80"></i>APC/C</span></div><p class="hint">Negative feedback: CDK1 activity switches on APC/C (once the spindle checkpoint is satisfied), which destroys cyclin B and switches CDK1 off. Try the knockouts.</p>`);
    } else cycCv = null;

    // view + legend
    const vw = K.card(el, "View");
    K.checkbox(vw, "Show labels", state.labels, (val) => { state.labels = val; if (!val) hideLabels(); });
    K.checkbox(vw, lens.pick({ "y7-8": "Show spindle fibres", "y9-10": "Show microtubules" }), G.mtsOn, (val) => (G.mtsOn = val));
    const vr = K.buttonRow(vw);
    K.button(vr, "Whole cell", () => flyView("cell"));
    K.button(vr, lens.pick({ "y7-8": "Close-up", "y9-10": "Chromosomes close-up" }), () => flyView("close"));
    K.button(vr, lens.pick({ "y7-8": "Look along the spindle", "y9-10": "Pole view (plate face-on)" }), () => flyView("pole"));
    vw.insertAdjacentHTML("beforeend", `<div class="flow-key" style="margin-top:8px">
      <span><i style="background:#f472b6"></i>${y7 ? "From mother" : "Maternal"}</span><span><i style="background:#60a5fa"></i>${y7 ? "From father" : "Paternal"}</span>
      <span><i style="background:#5eead4"></i>${y7 ? "Spindle fibres" : "Microtubules"}</span><span><i style="background:#fbbf24;box-shadow:0 0 8px #fbbf24"></i>${y7 ? "Hook waiting" : "Unattached kinetochore"}</span>
      <span><i style="background:#4ade80"></i>${y7 ? "Hook pulled tight" : "Kinetochore under tension"}</span><span><i style="background:#fb923c"></i>Cohesin</span>
      ${y7 ? "" : `<span><i style="background:#fb7185"></i>Separase</span><span><i style="background:#ecfeff;box-shadow:0 0 6px #fff"></i>Growing MT tip</span>`}
      <span><i style="background:#bef264"></i>${y7 ? "New wall" : "Cell plate"}</span><span><i style="background:#f87171"></i>${y7 ? "Squeezing ring" : "Contractile ring"}</span></div>
      <p class="hint">${lens.pick({ "y7-8": "Long pair and short pair: 2 × 2 = 4 chromosomes. Real human body cells have 46.", "y9-10": "2n = 4 (two homologous pairs). Not to scale in time: a real cycle takes about a day; mitosis about an hour.", y11: "2n = 4; lengths in µm are realistic, microtubules and cohesin are drawn thicker than life. Timing compressed (real: ~12–24 h cycle, ~1 h mitosis in root meristems)." })}</p>`);

    mission = K.missions(el, lens.filter(MISSIONS).map((m) => ({ text: lens.pick(m.text), check: () => m.check(M, state) })), (m) => engine.toast(`🎯 Mission complete: ${m.text}`, 3600));
    K.quiz(el, lens.filter(QUIZ));
  }

  function renderCompare() {
    if (!cmpEl) return;
    const plant = M.cellType === "plant";
    cmpEl.innerHTML = `<table class="cmp"><tr><th></th><th>🌱 Plant</th><th>🐾 Animal</th></tr>${COMPARE.map((r) => `<tr><th>${lens.pick(r.what)}</th><td class="${plant ? "cur" : ""}">${lens.pick(r.plant)}</td><td class="${plant ? "" : "cur"}">${lens.pick(r.animal)}</td></tr>`).join("")}</table>`;
  }
  function syncPlay() { if (ctl.play) ctl.play.textContent = state.playing ? "Pause cycle" : "Play cycle"; }

  function setCellType(val) {
    if (val === M.cellType) return;
    M.cellType = val; G.setCellType(val);
    resetRun(true);
    renderCompare();
    flyView("cell");
    toast(val === "plant" ? lens.pick({ "y7-8": "Plant cell: watch for the ring of fibres and the new wall.", "y9-10": "Plant cell: no centrosomes, a <strong>preprophase band</strong>, and a <strong>cell plate</strong> built by the phragmoplast." }) : lens.pick({ "y7-8": "Animal cell: watch the centrosomes and the squeezing ring.", "y9-10": "Animal cell: <strong>centrosomes</strong> with asters, and a <strong>cleavage furrow</strong> that pinches the cell in two." }), 3600);
  }
  function setMode(val) {
    M.mode = val; resetRun(true);
    tl.classList.toggle("locked", val === "diy");
    toast(val === "diy" ? lens.pick({ "y7-8": "Your turn! You'll copy the DNA, line up the chromosomes, pull them apart and split the cell.", "y9-10": "Do it yourself: replicate the DNA, drag the chromosomes onto the plate, start anaphase and finish cytokinesis." }) : "Watch mode: drag the timeline to scrub through the cycle.", 3600);
  }
  function resetRun(quiet) {
    M.reset(); state.playing = true; state.counted = false; state.drag = null; syncPlay();
    if (countCard) { countCard.style.display = "none"; countCard._k = ""; }
    lastExplain = "";
    if (!quiet) toast("Reset to G1.");
  }
  function detachSome() {
    if (!M.kinetochoresUp || M.k > I.meta || M.dest) { toast(lens.pick({ "y7-8": "The hooks only exist while the chromosomes are lined up (prometaphase–metaphase).", "y9-10": "Kinetochores are attached during prometaphase and metaphase — try then.", y11: "Kinetochore–MT attachments exist from prometaphase until anaphase." })); return; }
    const opts = [];
    for (let i = 0; i < 4; i++) for (let s = 0; s < 2; s++) if (M.attached(i, s)) opts.push([i, s]);
    if (!opts.length) { toast("Nothing is attached right now."); return; }
    const [i, s] = opts[Math.floor(Math.random() * opts.length)];
    doDetach(i, s);
  }
  function doDetach(i, s) {
    if (!M.detach(i, s)) { toast(M.attached(i, s) ? "Too late — anaphase has begun." : lens.pick({ "y7-8": "That hook isn't attached.", "y9-10": "That kinetochore isn't attached (it's already sending the wait signal)." })); return; }
    toast(lens.pick({
      "y7-8": `Unhooked ${CHR_NAME(i, true)}! See its hook glow? Now <strong>nothing</strong> gets pulled apart until it's hooked back on.`,
      "y9-10": `Detached a kinetochore on ${CHR_NAME(i)}. It now sends a <strong>wait signal</strong>: the spindle checkpoint holds <em>every</em> chromosome. ${M.mode === "diy" ? "Drag it back onto the plate." : "Watch: a microtubule will find it again."}`,
      y11: `Kinetochore on ${CHR_NAME(i)} detached → Mad2 recruited → MCC inhibits APC/C–Cdc20 → no securin destruction. ${M.mode === "diy" ? "Re-attach it by dragging it back to the plate." : "Error correction: search-and-capture will re-attach it."}`,
    }), 4600);
  }

  function showCount() {
    const o = M.splitAt;
    if (!countCard) return;
    const want = M.k === I.done && o && !o.single && o.aneuploid && M.p > 0.3;
    if (!want) { countCard.style.display = "none"; return; }
    const key = `${o.left}|${o.right}|${lens.band}`;
    countCard.style.display = "";
    if (countCard._k === key) return;
    countCard._k = key;
    const h2 = countCard.querySelector("h2").outerHTML;
    countCard.innerHTML = `${h2}<p>${lens.pick({ "y7-8": "Something went wrong! Count the chromosomes in each new cell. <strong>Left</strong> and <strong>right</strong> have…", "y9-10": "Nondisjunction happened! Count the chromosomes (centromeres) in each daughter. <strong>Left</strong> and <strong>right</strong> have…" })}</p><div class="opts"></div><div class="fb" aria-live="polite"></div>`;
    const opts = countCard.querySelector(".opts"), fb = countCard.querySelector(".fb");
    const right = `${o.left} and ${o.right}`;
    const choices = [...new Set(["4 and 4", right, `${o.right} and ${o.left}`, "8 and 0"])];
    choices.sort();
    choices.forEach((txt) => K.button(opts, txt, () => {
      if (txt === right) {
        const odd = o.copies.findIndex((c) => c[0] !== 1);
        fb.innerHTML = `✅ ${lens.pick({ "y7-8": `Correct! One cell has ${o.left} and the other ${o.right}. They should both have 4.`, "y9-10": `Correct. Left is <strong>${o.left}</strong> (${o.left > 4 ? "2n + 1: three copies of one chromosome, trisomy" : "2n − 1: one copy only, monosomy"}), right is <strong>${o.right}</strong>. Both are <strong>aneuploid</strong> — the problem chromosome was ${CHR_NAME(odd)}.`, y11: `Correct: ${o.left} vs ${o.right}. Both sister copies of ${CHR_NAME(odd)} went ${o.copies[odd][0] > o.copies[odd][1] ? "left" : "right"}, so one daughter is trisomic and the other monosomic for chromosome ${CHR3[odd].pair}. Count centromeres, not arms.` })}`;
        state.counted = true;
      } else fb.innerHTML = `❌ ${lens.pick({ "y7-8": "Not quite. Count the X-shapes (or blobs) in each new nucleus — one chromosome went the wrong way.", "y9-10": "Not quite. Count centromeres in each daughter: both copies of one chromosome went to the same side." })}`;
    }));
  }

  // ---------- chips ----------
  function buildChips() {
    const ov = engine.overlay;
    ov.innerHTML = "";
    chipFns = { phase: K.chip(ov), chr: K.chip(ov), ct: K.chip(ov), dna: K.chip(ov), atp: K.chip(ov) };
    chipFns.els = [...ov.children];
    chipFns.els.forEach((c, i) => { c.classList.add("mi-chip"); if (i === 2 || i === 4) c.classList.add("opt"); });
  }
  function updateChips(o) {
    if (!chipFns) return;
    const y7 = lens.band === "y7-8", d = (c) => `<i class="dot" style="background:${c}"></i>`;
    const held = M.gate && M.gate !== "rep" && M.gate !== "align" && M.gate !== "trigger" && M.gate !== "pull" && M.gate !== "plate" && M.gate !== "pinch";
    const hold = held ? ` <span class="w">· ${{ atp: "no ATP", damage: "G2 checkpoint", noCyclin: "no cyclin B", exitBlocked: "can't exit", sac: "spindle checkpoint" }[M.gate] || "waiting"}</span>` : "";
    chipFns.phase(`${d("#a78bfa")}<b>${o.restit && o.k >= I.ana ? (o.k >= I.telo ? "Restitution (4n)" : "C-anaphase") : PH[o.k].name}</b>${hold}`);
    chipFns.els[0].classList.toggle("mi-hold", !!held);
    let nChr, nCt;
    if (o.k === I.done && !o.restit && M.splitAt) {
      const s = M.splitAt, hide = s.aneuploid && !state.counted;
      chipFns.chr(`${y7 ? "Chromosomes" : "Chromosomes"} <b>${hide ? "? | ?" : `${s.left} | ${s.right}`}</b>`);
      chipFns.ct(`Chromatids <b>${hide ? "? | ?" : `${s.left} | ${s.right}`}</b>`);
    } else {
      const sep = o.k >= I.ana && o.cut;
      const joined = o.chr.filter((c) => c.joined).length;
      nChr = sep ? 8 - joined : 4;
      nCt = sep ? 8 : 4 + o.chr.filter((c) => c.rep >= 1).length;
      chipFns.chr(`Chromosomes <b>${nChr}</b>${sep && o.k >= I.telo && !o.restit && !joined ? ' <span class="w">(4 + 4)</span>' : ""}`);
      chipFns.ct(`Chromatids <b>${nCt}</b>`);
    }
    let dna;
    if (o.k === I.done && M.splitAt && !M.splitAt.single) {
      const [l, r] = daughterDNA();
      dna = `${fmtC(l)} | ${fmtC(r)}`;
    } else dna = fmtC(M.dnaC());
    chipFns.dna(`DNA <b>${dna}</b>`);
    const atp = M.blockATP ? 0 : M.atp;
    chipFns.atp(`${d("#fbbf24")}${y7 ? "Energy" : "ATP"} <b>${Math.round(atp)}</b>${M.atpF < 0.05 ? ' <span class="w">stalled</span>' : M.atpF < 0.9 ? ' <span class="w">slow</span>' : ""}`);
    chipFns.els[4].classList.toggle("mi-hold", M.atpF < 0.05);
  }
  const fmtC = (c) => (Math.abs(c - Math.round(c)) < 0.02 ? `${Math.round(c)}C` : `${c.toFixed(1)}C`);
  function daughterDNA() {
    const o = M.outcome();
    if (o.single) return [4, 0];
    let l = 0, r = 0;
    o.copies.forEach(([a, b], i) => { l += a * CHR3[i].len; r += b * CHR3[i].len; });
    const set = CHR3[0].len + CHR3[2].len;
    return [l / set, r / set];
  }

  // ---------- graphs ----------
  function prepCanvas(cv) {
    const w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    if (!w) return null;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const c = cv.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    return { c, w, h };
  }
  function axes(g, x0, x1, y0, y1) {
    const { c } = g;
    c.fillStyle = "rgba(167,139,250,0.08)";
    const xv = (T) => x0 + (x1 - x0) * (T / TOTAL);
    c.fillRect(xv(PH[I.pro].start), y1, xv(PH[I.cyto].end) - xv(PH[I.pro].start), y0 - y1);
    c.strokeStyle = K.cssVar("--grid-line", "rgba(255,255,255,0.12)"); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y0); c.stroke();
    c.fillStyle = K.cssVar("--ink-faint", "#6a7f9c"); c.font = "600 9px Inter, system-ui, sans-serif"; c.textAlign = "center";
    for (const [k, t] of [[I.G1, "G1"], [I.S, "S"], [I.G2, "G2"], [I.prometa, "M"], [I.done, "G1"]]) c.fillText(t, xv(PH[k].start + PH[k].dur / 2), y0 + 10);
    return xv;
  }
  function curve(g, xv, yv, f, T0, T1, col, alpha, dash) {
    const { c } = g;
    c.save(); c.strokeStyle = col; c.globalAlpha = alpha; c.lineWidth = 2; if (dash) c.setLineDash([3, 3]);
    c.beginPath();
    const n = 80;
    for (let j = 0; j <= n; j++) { const T = T0 + (T1 - T0) * (j / n); const x = xv(T), y = yv(f(T)); j ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.stroke(); c.restore();
  }
  function drawDNA() {
    if (!dnaCv) return;
    const g = prepCanvas(dnaCv);
    if (!g) return;
    const { c, w, h } = g;
    const x0 = 28, x1 = w - 8, y0 = h - 14, y1 = 8;
    const xv = axes(g, x0, x1, y0, y1);
    const yv = (val) => y0 - ((y0 - y1) * val) / 5;
    c.fillStyle = K.cssVar("--ink-faint", "#6a7f9c"); c.textAlign = "right";
    for (const val of [2, 4]) { c.fillText(`${val}C`, x0 - 4, yv(val) + 3); c.strokeStyle = K.cssVar("--grid-line", "rgba(255,255,255,0.06)"); c.beginPath(); c.moveTo(x0, yv(val)); c.lineTo(x1, yv(val)); c.stroke(); }
    const split = PH[I.done].start, T = M.T;
    const pre = (TT) => M.dnaC(Math.min(TT, split - 1e-6));
    curve(g, xv, yv, pre, 0, split - 1e-6, "#4fd1c5", 0.25, true);
    curve(g, xv, yv, pre, 0, Math.min(T, split - 1e-6), "#4fd1c5", 1, false);
    if (M.restit) {
      curve(g, xv, yv, () => 4, split, TOTAL, "#4fd1c5", 0.25, true);
      if (T > split) curve(g, xv, yv, () => 4, split, T, "#4fd1c5", 1, false);
    } else {
      const [l, r] = M.dest ? daughterDNA() : [2, 2];
      const diff = Math.abs(l - r) > 0.01;
      curve(g, xv, yv, () => l, split, TOTAL, diff ? "#f472b6" : "#4fd1c5", 0.25, true);
      if (diff) curve(g, xv, yv, () => r, split, TOTAL, "#60a5fa", 0.25, true);
      if (T > split) { curve(g, xv, yv, () => l, split, T, diff ? "#f472b6" : "#4fd1c5", 1, false); if (diff) curve(g, xv, yv, () => r, split, T, "#60a5fa", 1, false); }
    }
    c.fillStyle = "#fff"; c.beginPath(); c.arc(xv(T), yv(T > split && !M.restit && M.dest ? daughterDNA()[0] : M.dnaC()), 3.5, 0, Math.PI * 2); c.fill();
    dnaCv.setAttribute("aria-label", `DNA per cell now ${fmtC(M.dnaC())}; it doubles from 2C to 4C in S phase and halves to 2C in each daughter cell.`);
  }
  function drawCyclin() {
    if (!cycCv) return;
    const g = prepCanvas(cycCv);
    if (!g) return;
    const { c, w, h } = g;
    const x0 = 10, x1 = w - 8, y0 = h - 14, y1 = 8;
    const xv = axes(g, x0, x1, y0, y1);
    const yv = (val) => y0 - (y0 - y1) * val;
    const T = M.T;
    for (const [f, col] of [[(t) => M.apc(t), "#4ade80"], [(t) => M.cyclinB(t), "#fb923c"], [(t) => M.cdk1(t), "#22d3ee"]]) {
      curve(g, xv, yv, f, 0, TOTAL, col, 0.22, true);
      curve(g, xv, yv, f, 0, T, col, 1, false);
    }
    c.strokeStyle = "rgba(255,255,255,0.7)"; c.beginPath(); c.moveTo(xv(T), y1); c.lineTo(xv(T), y0); c.stroke();
    cycCv.setAttribute("aria-label", `Cyclin B ${Math.round(M.cyclinB() * 100)} percent, CDK1 activity ${Math.round(M.cdk1() * 100)} percent, APC/C ${Math.round(M.apc() * 100)} percent.`);
  }

  // ---------- selection ----------
  function infoFor(obj, hit) {
    const kind = obj?.userData?.kind;
    if (!kind || !PARTS[kind]) return null;
    const p = PARTS[kind];
    let title = lens.pick(p.name);
    if (kind === "chromatid") title = `${lens.pick(p.name)} · ${CHR_NAME(obj.userData.chr, lens.band === "y7-8")}`;
    if (kind === "mt" && !G.mtsOn) return null;
    return { kind, title, object: obj, point: hit?.point, chr: obj.userData.chr, inst: hit?.instanceId };
  }
  function showSelection(info) {
    if (!selCard) return;
    state.sel = info;
    if (!info) { selCard.style.display = "none"; return; }
    const p = PARTS[info.kind];
    let role = p.role.plant ? p.role[M.cellType] : p.role;
    let extra = "";
    if (info.kind === "chromatid") {
      const i = info.chr, c = CHR3[i];
      const att = M.kinetochoresUp && M.k <= I.meta ? `${M.attached(i, 0) ? "✓" : "✗"} / ${M.attached(i, 1) ? "✓" : "✗"}${M.tension(i) ? " · under tension" : ""}` : "—";
      extra = `<div class="io"><b>Pair</b><span>${c.pair === 1 ? "long (pair 1)" : "short (pair 2)"}, ${c.mat ? "maternal" : "paternal"}</span><b>Copied</b><span>${M.rep[i] >= 1 ? "yes (2 sister chromatids)" : M.rep[i] > 0 ? `${Math.round(M.rep[i] * 100)}%` : "not yet"}</span>${lens.atLeast("y9-10") ? `<b>Kinetochores</b><span>${att}</span>` : ""}</div>`;
    }
    if (info.kind === "kinetochore" && info.inst != null) {
      const i = info.inst >> 1, s = info.inst & 1;
      extra = `<div class="io"><b>On</b><span>${CHR_NAME(i, lens.band === "y7-8")}, sister ${s + 1}</span><b>Now</b><span>${M.attached(i, s) ? (M.tension(i) ? "attached, under tension" : "attached, no tension yet") : "unattached — sending the wait signal"}</span></div>${M.attached(i, s) && !M.dest ? `<div class="btn-row"><button class="btn" data-act="detach">Detach it</button></div>` : ""}`;
    }
    if (info.kind === "mito") extra = `<div class="io"><b>ATP</b><span>${Math.round(M.blockATP ? 0 : M.atp)}${pm ? " (shared with the plant cell)" : ""}</span></div>`;
    selCard.style.display = "";
    selCard.innerHTML = `<h2>Selected</h2><p style="color:var(--ink);font-weight:600;margin-bottom:4px"><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};margin-right:6px"></i>${info.title}</p><p>${lens.pick(role)}</p>${extra}`;
    selCard.querySelector('[data-act="detach"]')?.addEventListener("click", () => { doDetach(info.inst >> 1, info.inst & 1); showSelection(info); });
    if (panelEl) panelEl.parentElement?.scrollTo?.({ top: 0, behavior: "smooth" });
  }

  let lastExplain = "";
  function updateExplain() {
    if (!explainBody) return;
    let html = narrative(M, lens.band).map((p) => `<p>${p}</p>`).join("");
    if (M.mode === "diy") html += `<p class="task">${taskText(M, lens.band)}</p>`;
    if (pm && M.k === I.G1 && M.T < 2) html += `<p class="note">${lens.pick({ "y7-8": "You zoomed into the plant cell's nucleus to watch it divide.", "y9-10": "Zoomed in from the plant cell: the ATP here is that cell's ATP." })}</p>`;
    if (html !== lastExplain) { explainBody.innerHTML = html; lastExplain = html; }
  }

  // ---------- camera ----------
  const VIEW_DIR = new THREE.Vector3(0.26, 0.3, 1).normalize();
  function viewDist() {
    const a = engine.camera.aspect, t = Math.tan(THREE.MathUtils.degToRad(engine.camera.fov / 2));
    return clamp(Math.max(128 / t, 150 / (t * a)), 300, 950);
  }
  function flyView(which) {
    const dir = which === "pole" ? new THREE.Vector3(1, 0.12, 0.08).normalize() : VIEW_DIR;
    const d = which === "close" ? viewDist() * 0.42 : which === "pole" ? viewDist() * 0.8 : viewDist();
    const tgt = new THREE.Vector3();
    engine.fly(tgt, tgt.clone().addScaledVector(dir, d), 1.0);
  }

  // ---------- 3D interaction ----------
  const plane = new THREE.Plane(), hitP = new THREE.Vector3();
  function rayToPlane(e, centreW) {
    const ray = engine.setRay(e.clientX, e.clientY);
    const n = engine.camera.getWorldDirection(v2).negate();
    plane.setFromNormalAndCoplanarPoint(n, centreW);
    return ray.ray.intersectPlane(plane, hitP) ? hitP : null;
  }
  const kindOf = (hit) => hit?.object?.userData?.kind;
  function chrFromHit(hit) {
    const k = kindOf(hit);
    if (k === "chromatid") return hit.object.userData.chr;
    if (k === "kinetochore" && hit.instanceId != null) return hit.instanceId >> 1;
    return -1;
  }
  const draggable = () => M.mode === "diy" && !M.diy.triggered && !M.restit && (M.k === I.meta || (M.k === I.prometa && M.T >= GATE_PM - 0.05));

  const level = {
    title: "Cell division (mitosis)",
    topics: ["cell-cycle", "mitosis"],
    root,
    get pickables() { return G.pickables; },
    get fallbackPickables() { return G.fallback; },
    portals: [],
    metersPerUnit: 1e-7,
    model: M,
    get view() { return { target: new THREE.Vector3(), distance: viewDist(), dir: VIEW_DIR.clone() }; },
    minDistance: 25, maxDistance: 1150, near: 1, far: 9000,
    env: { bg: ["#0a1430", "#0e2c38", "#2a1650"], fog: ["#0b1d2c", 0.00045], exposure: 1.05, bloom: [0.55, 0.5, 0.8], aperture: 0.00004 },
    info(obj) { return infoFor(obj, lastHit && lastHit.object === obj ? lastHit : null); },
    onSelect(info) { showSelection(info); },
    onPointerDown(e, hit) {
      lastHit = hit;
      const g = M.gate;
      // drag a chromosome onto the plate
      const i = chrFromHit(hit);
      if (i >= 0 && draggable()) {
        const c = M.pose().chr[i].c;
        if (M.diy.slot[i] >= 0) M.ach.detached = true;
        M.unslot(i);
        M.diy.pos[i] = [c[0], c[1], c[2]];
        state.drag = { i, centre: new THREE.Vector3(c[0] * SCALE, c[1] * SCALE, c[2] * SCALE), off: null };
        const p = rayToPlane(e, state.drag.centre);
        if (p) state.drag.off = state.drag.centre.clone().sub(p);
        return true;
      }
      // press and hold inside the cell to pull / build / pinch
      if ((g === "pull" || g === "plate" || g === "pinch") && hit) { state.holdCell = true; return true; }
      return false;
    },
    onPointerDrag(e) {
      const d = state.drag;
      if (!d) return;
      const p = rayToPlane(e, d.centre);
      if (!p) return;
      if (d.off) p.add(d.off);
      const x = clamp(p.x / SCALE, -7, 7), y = clamp(p.y / SCALE, -7, 7), z = clamp(p.z / SCALE, -7, 7);
      M.diy.pos[d.i] = [x, y, z];
      d.centre.set(x * SCALE, y * SCALE, z * SCALE);
    },
    onPointerUp() {
      state.holdCell = false;
      const d = state.drag;
      if (!d) return;
      state.drag = null;
      const r = M.drop(d.i, M.diy.pos[d.i]);
      if (r === -2) toast(lens.pick({ "y7-8": "No spindle fibres to hold it — the colchicine destroyed them.", "y9-10": "Colchicine: there are no microtubules to attach it, so it can't stay on the plate." }));
      else if (r >= 0) {
        const n = M.nAligned;
        toast(n === 4 ? lens.pick({ "y7-8": "All 4 lined up and hooked on from both ends!", "y9-10": "All 4 aligned: every kinetochore attached to opposite poles and under tension — the checkpoint is satisfied.", y11: "All chromosomes bi-oriented under tension: the SAC can switch off." }) : `${lens.pick({ "y7-8": "Hooked on!", "y9-10": "Attached to both poles!" })} ${n} of 4 on the plate.`, n === 4 ? 4200 : 1800);
      } else if (Math.abs(M.diy.pos[d.i][0]) < 3.5) toast(lens.pick({ "y7-8": "Closer to the middle ring!", "y9-10": "Drop it right on the glowing plate (the middle of the cell)." }));
    },
    onClick(e, hit) {
      // kinetochores are small: test them first so a fibre or arm in front doesn't steal the tap
      if (G.ktShown) { const kh = engine.setRay(e.clientX, e.clientY).intersectObject(G.ktHit, false)[0]; if (kh) hit = kh; }
      lastHit = hit;
      const k = kindOf(hit);
      if (k === "kinetochore" && hit.instanceId != null && !draggable()) {
        const i = hit.instanceId >> 1, s = hit.instanceId & 1;
        if (M.attached(i, s)) { doDetach(i, s); return true; }
      }
      if (M.mode === "diy" && (M.gate === "rep" || M.k === I.G1) && (k === "chromatid" || k === "nucleus" || k === "nucleolus")) {
        if (M.k === I.G1) { toast(lens.pick({ "y7-8": "Not yet — the copying stage (S phase) comes next.", "y9-10": "Not yet — DNA is only copied in <strong>S phase</strong>." })); return true; }
        replicateNext(hit.point.clone().divideScalar(SCALE));
        return true;
      }
      return false;
    },
    mountPanel(el) {
      makeLabels();
      for (const n of [tl, act]) engine.stageEl.appendChild(n);
      tl.classList.toggle("locked", M.mode === "diy");
      if (progress && progress.band === lens.band) { panelEl = el; el.appendChild(progress.node); }
      else buildPanel(el);
      buildChips();
      lastExplain = "";
    },
    unmountPanel() {
      hideLabels();
      tl.remove(); act.remove();
      engine.overlay.innerHTML = ""; chipFns = null;
    },
    onResume() { makeLabels(); },
    onLens() { progress = null; if (panelEl) { panelEl.innerHTML = ""; buildPanel(panelEl); } buildChips(); lastExplain = ""; },
    onResize() {},
    dispose() {
      for (const el of Object.values(labels)) el.remove();
      for (const el of waitLbl) el.remove();
      tl.remove(); act.remove();
    },
    update(dt, t, realDt) {
      const rdt = realDt ?? dt;
      // the plant cell keeps running underneath (its ATP powers division here)
      if (pm && dt > 0) pm.step(dt);
      M.atp = pm ? pm.atp : state.standaloneATP;
      M.diy.hold = state.holdBtn || state.holdCell;
      const run = state.playing && !state.scrubbing && !(M.mode === "watch" && M.T >= TOTAL - 1e-6);
      const sdt = dt * state.speed;
      if (run) M.step(sdt);
      if (M.mode === "watch" && M.T >= TOTAL - 1e-6 && state.playing) { state.playing = false; if (ctl.play) ctl.play.textContent = "Replay"; }
      const o = M.pose();
      G.update(o, M, run ? sdt : 0, t, {
        highlight: state.drag ? state.drag.i : -1,
        plateGuide: M.mode === "diy" && (M.gate === "align" || state.drag) && !M.colchicine,
        showPlate: true, cdz: lens.atLeast("y9-10"),
        vesRate: M.mode === "diy" ? (M.diy.hold ? 1.6 : 0.25) : 1,
        sel: state.sel?.point ? v.copy(state.sel.point).divideScalar(SCALE).clone() : null,
      });
      // gate change → a short toast so the cause is noticed
      if (M.gate !== state.lastGate) {
        const g = M.gate;
        if (g === "sac" && !M.cpOff) toast(lens.pick({ "y7-8": "⏸ Waiting: a chromosome isn't hooked on!", "y9-10": "⏸ <strong>Spindle checkpoint:</strong> anaphase is on hold.", y11: "⏸ SAC active: APC/C–Cdc20 inhibited." }), 2600);
        else if (g === "damage") toast(lens.pick({ "y7-8": "⏸ Waiting: repairing the DNA first.", "y9-10": "⏸ <strong>G2 checkpoint:</strong> repairing DNA before mitosis." }), 2600);
        else if (g === "atp") toast(lens.pick({ "y7-8": "⏸ Out of energy — everything has stopped.", "y9-10": "⏸ No ATP: the cell cycle has stalled." }), 2600);
        else if (g === "noCyclin") toast("⏸ No cyclin B: stuck in G2.", 2600);
        else if (g === "exitBlocked") toast("⏸ Cyclin B can't be destroyed: stuck in anaphase.", 2600);
        state.lastGate = g;
      }
      if (M.restit && !state.restitToast) { state.restitToast = true; toast(lens.pick({ "y7-8": "The cell gave up dividing and kept all 8 chromosomes in one nucleus!", "y9-10": "Mitotic slippage: one nucleus with all 8 chromosomes — a <strong>tetraploid</strong> cell.", y11: "Slippage after prolonged SAC arrest → restitution nucleus (4n)." }), 4200); }
      if (!M.restit) state.restitToast = false;

      // timeline
      cur.style.left = `${xFrac(M.T) * 100}%`;
      bar.setAttribute("aria-valuenow", M.T.toFixed(1));
      bar.setAttribute("aria-valuetext", PH[M.k].name);
      const narrow = bar.clientWidth < 520;
      segs.forEach((s, i) => { s.classList.toggle("on", i === M.k); const txt = narrow || s.clientWidth < 64 ? (s.clientWidth < 22 ? "" : s.dataset.short) : s.dataset.full; if (s._t !== txt) { s.textContent = txt; s._t = txt; } });
      chkG2.classList.toggle("held", M.gate === "damage" || M.gate === "noCyclin");
      chkSAC.classList.toggle("held", M.gate === "sac" || ((M.gate === "align" || M.gate === "trigger") && !M.sacOK && M.ach.detached));
      chkG2.style.display = lens.atLeast("y9-10") ? "" : "none";
      // action button (DIY)
      if (M.mode === "diy") {
        act.style.display = "";
        const g = M.gate, k = M.k;
        let txt = lens.pick({ "y7-8": "Watch…", "y9-10": "Watch this stage…" }), dis = true;
        if (k === I.G1) { txt = "Copy the DNA"; dis = false; }
        else if (g === "rep") { txt = lens.pick({ "y7-8": "Copy a chromosome (or tap the nucleus)", "y9-10": "Replicate a chromosome (or tap the nucleus)" }); dis = false; }
        else if (g === "align") { txt = lens.pick({ "y7-8": "Drag chromosomes to the middle ring…", "y9-10": `Drag chromosomes onto the plate (${M.nAligned}/4) — or try to start anaphase` }); dis = false; }
        else if (g === "trigger" || (k === I.meta && !M.diy.triggered)) { txt = lens.pick({ "y7-8": "Pull apart!", "y9-10": "Start anaphase" }); dis = false; }
        else if (g === "pull") { txt = lens.pick({ "y7-8": "Press & hold: pull the copies apart", "y9-10": "Press & hold: pull chromatids to the poles" }); dis = false; }
        else if (g === "plate") { txt = lens.pick({ "y7-8": "Press & hold: build the new wall", "y9-10": "Press & hold: deliver vesicles, grow the cell plate" }); dis = false; }
        else if (g === "pinch") { txt = lens.pick({ "y7-8": "Press & hold: squeeze the ring", "y9-10": "Press & hold: tighten the contractile ring" }); dis = false; }
        else if (k === I.done) { txt = "Division complete — press Reset to go again"; }
        else if (g === "atp") txt = "Stalled — no ATP";
        if (act.textContent !== txt) act.textContent = txt;
        act.disabled = dis;
        if (dis) holdOff();
      } else act.style.display = "none";

      updateLabels(o);
      uiT -= rdt; exT -= rdt; grT -= rdt;
      if (uiT <= 0) { uiT = 0.2; updateChips(o); showCount(); if (state.sel && state.sel.kind === "kinetochore") {} }
      if (exT <= 0) { exT = 0.5; updateExplain(); }
      if (grT <= 0) { grT = 0.25; drawDNA(); drawCyclin(); }
      mission?.update();
    },
  };
  let lastHit = null, uiT = 0, exT = 0, grT = 0;
  return level;
}
