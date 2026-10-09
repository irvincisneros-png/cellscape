// The inner mitochondrial membrane (cristae) as a CellScape molecular level: the 3D scene (scene3d.js) driven by
// the ETC / ATP synthase model extracted from the original 2D "ATP Factory" (model.js).
// Used inside the zoomable world (cell → mitochondrion → cristae) and on its own page (index.html).
import * as THREE from "three";
import * as K from "../../assets/js/kit.js";
import { ETCModel, STEP_A, TAU, DEF } from "./model.js";
import { CristaeScene } from "./scene3d.js";
import { COL } from "./draw.js";
import { NAMES, INFO, NOTE, narrative, BIG_PICTURE, MISSIONS, QUIZ } from "./content.js";

const CSS = `
.lbl3d.prot { background: rgba(5,11,22,0.62); border: 1px solid rgba(120,190,255,0.22); padding: 2px 8px; border-radius: 999px; color: var(--ink); backdrop-filter: blur(4px); }
.lbl3d.prot.small { font-size: 0.66rem; padding: 1px 6px; color: var(--ink-dim); }
.lbl3d.side { color: rgba(232,241,255,0.55); font-size: 0.66rem; letter-spacing: 0.12em; font-weight: 600; text-shadow: 0 1px 8px #000; }
.lbl3d.floater { font-weight: 700; font-size: 0.82rem; text-shadow: 0 1px 8px #000, 0 0 14px currentColor; }
.lbl3d.crank { color: #fbbf24; font-weight: 600; font-size: 0.74rem; background: rgba(5,11,22,0.72); border: 1px solid rgba(251,191,36,0.55); padding: 2px 9px; border-radius: 999px; }
.lbl3d.warn { color: #fecaca; font-weight: 600; font-size: 0.74rem; background: rgba(127,29,29,0.6); border: 1px solid rgba(248,113,113,0.6); padding: 2px 9px; border-radius: 999px; }
.lbl3d.heatlbl { color: #fed7aa; font-weight: 600; font-size: 0.74rem; background: rgba(124,45,18,0.6); border: 1px solid rgba(251,146,60,0.6); padding: 2px 9px; border-radius: 999px; }
.atp3d .note { font-size: 0.76rem; color: var(--ink-faint); }
.atp3d .now { border-top: 1px solid var(--panel-border); padding-top: 8px; margin-top: 8px; font-size: 0.86rem; }
.atp3d-chart canvas { width: 100%; height: 110px; display: block; }
.atp3d .flow { list-style: none; padding: 0; margin: 0 0 10px; display: flex; flex-direction: column; gap: 12px; }
.atp3d .flow li { position: relative; display: grid; grid-template-columns: 1fr auto; gap: 1px 8px; padding: 7px 9px; border-radius: 9px; font-size: 0.84rem; background: var(--tint-1); border: 1px solid var(--panel-border); }
.atp3d .flow li b { color: var(--ink); font-weight: 600; }
.atp3d .flow li span { grid-column: 1; color: var(--ink-faint); font-size: 0.76rem; }
.atp3d .flow li em { grid-column: 2; grid-row: 1 / span 2; align-self: center; text-align: right; font-style: normal; color: var(--accent-3); font-size: 0.78rem; }
.atp3d .flow li.here { border-color: var(--accent-3); background: rgba(251,191,36,0.08); }
.atp3d .flow li + li::before { content: "↓"; position: absolute; top: -13px; left: 14px; color: var(--ink-faint); font-size: 0.7rem; }
.atp3d .speed-label { font-size: 0.85rem; margin: 10px 0 6px; }
`;

export function create(engine) {
  if (!document.getElementById("atp3d-css")) {
    const st = document.createElement("style");
    st.id = "atp3d-css"; st.textContent = CSS;
    document.head.appendChild(st);
  }
  const lens = engine.lens;
  const toast = engine.toast;
  const reduced = engine.reducedMotion;
  // conditions carried over from the mitochondrion (both scales share one set of conditions)
  const parent = engine.current;
  const shared = parent?.shared || null;

  const M = new ETCModel();
  if (shared) {
    M.st.o2 = shared.anoxia ? 0 : shared.o2;
    M.st.nadh = Math.round(shared.supply);
    M.st.cyanide = !!shared.cyanide; M.st.dnp = !!shared.dnp; M.st.olig = !!shared.olig;
    M.reset();
  }
  const writeShared = () => {
    if (!shared) return;
    shared.o2 = M.st.o2; shared.anoxia = M.st.o2 === 0; shared.supply = M.st.nadh;
    shared.cyanide = M.st.cyanide; shared.dnp = M.st.dnp; shared.olig = M.st.olig;
    shared.dirty = true;
  };

  const labelLayer = document.createElement("div");
  labelLayer.style.display = "contents";
  const G = new CristaeScene(M, engine, labelLayer);
  const overlay = document.createElement("div");
  overlay.style.display = "contents";

  let speed = reduced ? 0.5 : 1;
  let hover = null, grabbed = false, grabbedOnce = false, lastAng = 0, showLabels = true;
  let names = {}, shortNames = {};
  // phones in portrait get the shorter (Years 9–10) protein names so the labels don't collide
  const pickNames = () => {
    names = {}; shortNames = {};
    for (const [k, v] of Object.entries(NAMES)) {
      names[k] = lens.pick(v);
      shortNames[k] = typeof v === "object" && lens.atLeast("y11") ? (v["y9-10"] ?? names[k]) : names[k];
    }
    if (lens.atLeast("y11")) { shortNames.F0 = "F₀"; shortNames.F1 = "F₁"; shortNames.ims = "INTERMEMBRANE SPACE · high H⁺"; }
  };
  pickNames();

  // ---------- panel ----------
  let panel = null, exBody, chartCv, chartCtx, missions, ctl = {};
  function buildPanel() {
    const band = lens.band;
    panel = document.createElement("div");
    panel.style.display = "contents";
    panel.className = "atp3d";
    const wrap = (c) => { c.classList.add("atp3d"); return c; };

    if (shared) {
      const ctx = wrap(K.card(panel, lens.pick({ "y7-8": "Inside the folds", y11: "Inside one crista" })));
      ctx.insertAdjacentHTML("beforeend", `<p>${lens.pick({ "y7-8": "You've zoomed into one fold of the mitochondrion's inner membrane. The settings you chose in the mitochondrion carried over — change them here and they'll still be set when you zoom back out.", y11: "A patch of crista membrane from the mitochondrion you came from. Conditions (O₂, fuel supply, inhibitors) are shared between the two scales: the NADH supply here mirrors the pyruvate supply there." })}</p>`);
    }

    const ex = wrap(K.card(panel, "What's happening", "explain"));
    exBody = document.createElement("div");
    ex.appendChild(exBody);
    ex.insertAdjacentHTML("beforeend", `<p class="note">${lens.pick(NOTE)} ${lens.pick({ "y7-8": "Tap a protein to learn what it does.", "y9-10": "Tap a complex for details." })}</p>`);

    const c = wrap(K.card(panel, "Controls"));
    ctl.o2 = K.slider(c, { label: lens.pick({ "y7-8": "Oxygen (O₂)", "y9-10": "Oxygen (O₂) level" }), min: 0, max: 100, step: 5, value: M.st.o2, unit: "%", onInput: (v) => { M.st.o2 = v; writeShared(); } });
    ctl.nadh = K.slider(c, { label: lens.pick({ "y7-8": "Fuel supply (from glucose)", "y9-10": "NADH supply (from glucose → Krebs cycle)" }), min: 0, max: 100, step: 5, value: M.st.nadh, unit: "%", onInput: (v) => { M.st.nadh = v; writeShared(); } });
    ctl.cn = K.checkbox(c, lens.pick({ "y7-8": "Cyanide (poison) — jams pump 3", "y9-10": "Cyanide — blocks complex IV" }), M.st.cyanide, (v) => { M.st.cyanide = v; writeShared(); if (v) toast("Cyanide has bound complex IV. Watch the electrons back up…"); });
    ctl.dnp = K.checkbox(c, lens.pick({ "y7-8": "Uncoupler — makes the membrane leaky to H⁺", "y9-10": "Uncoupler (DNP) — H⁺ leak through the membrane" }), M.st.dnp, (v) => { M.st.dnp = v; writeShared(); if (v) toast("DNP is ferrying H⁺ straight across the membrane — feel the heat."); });
    ctl.olig = K.checkbox(c, lens.pick({ "y7-8": "Oligomycin — jams the motor", "y9-10": "Oligomycin — blocks ATP synthase" }), M.st.olig, (v) => { M.st.olig = v; writeShared(); if (v) toast("Oligomycin has plugged ATP synthase's F₀ channel."); });
    const r2 = K.buttonRow(c);
    K.button(r2, lens.pick({ "y7-8": "Crank ⅓ turn (make ATP)", "y9-10": "Crank 120° (make ATP)" }), () => { M.queueTurn(STEP_A); grabbedOnce = true; });
    K.button(r2, lens.pick({ "y7-8": "Crank backwards", "y9-10": "Crank 120° backwards" }), () => { M.queueTurn(-STEP_A); grabbedOnce = true; });
    const r = K.buttonRow(c);
    K.button(r, "Reset", reset);
    c.insertAdjacentHTML("beforeend", `<div class="speed-label">Speed</div>`);
    ctl.speed = K.segmented(c, [0.25, 0.5, 1, 2, 3].map((v) => ({ value: v, label: `${v}×` })), speed, (v) => (speed = v));
    K.checkbox(c, "Show labels", showLabels, (v) => (showLabels = v));

    const ch = wrap(K.card(panel, lens.pick({ "y7-8": "ATP made per second", "y9-10": "ATP rate" }), "atp3d-chart"));
    chartCv = document.createElement("canvas");
    chartCv.setAttribute("role", "img");
    ch.appendChild(chartCv);
    chartCtx = chartCv.getContext("2d");
    ch.insertAdjacentHTML("beforeend", `<div class="legend" style="margin-top:6px"><span><i style="background:${COL.atp}"></i>ATP/s</span><span><i style="background:${COL.H}"></i>${lens.pick({ "y7-8": "H⁺ build-up", "y9-10": "H⁺ gradient" })}</span></div>`);

    const key = wrap(K.card(panel, "Key"));
    const lg = document.createElement("div");
    lg.className = "legend";
    const items = [[COL.H, "H⁺ (hydrogen ion)"], [COL.e, lens.pick({ "y7-8": "Electrons", "y9-10": "Electrons (e⁻ pair)" })], [COL.nadh, "NADH"], [COL.o2, "O₂"], [COL.h2o, "H₂O"], [COL.atp, "ATP"], [COL.adp, "ADP + Pᵢ"]];
    if (lens.atLeast("y9-10")) items.splice(3, 0, [COL.fadh, "FADH₂ (complex II)"], [COL.q, "Ubiquinone (Q)"], [COL.cytc, "Cytochrome c"]);
    lg.innerHTML = items.map(([col, n]) => `<span><i style="background:${col}"></i>${n}</span>`).join("");
    key.appendChild(lg);

    const bp = wrap(K.card(panel, lens.pick({ "y7-8": "The big picture", "y9-10": "The big picture: respiration" })));
    bp.insertAdjacentHTML("beforeend", lens.pick(BIG_PICTURE));

    missions = K.missions(panel, lens.filter(MISSIONS).map((m) => ({ text: lens.pick(m.text), check: () => m.check(M) })), (m) => toast(`🎯 Mission complete: ${m.text}`, 3600));
    K.quiz(panel, lens.filter(QUIZ));
    panel._band = band;
  }

  const chips = { g: K.chip(overlay), r: K.chip(overlay), t: K.chip(overlay), o: K.chip(overlay), w: K.chip(overlay) };
  function updateChips() {
    const y7 = lens.band === "y7-8", Gp = Math.round(M.gradient() * 100);
    chips.g(`<i class="dot" style="background:${COL.H}"></i>${y7 ? "H⁺ build-up" : "H⁺ gradient"} <b>${Gp}%</b>`);
    chips.r(`<i class="dot" style="background:${COL.atp}"></i>ATP/s <b>${M.rate.toFixed(1)}</b>`);
    chips.t(`Total ATP <b>${M.netATP()}</b>`);
    chips.o(`<i class="dot" style="background:${COL.o2}"></i>O₂ used <b>${M.o2Used}</b>`);
    chips.w(`<i class="dot" style="background:${COL.h2o}"></i>H₂O made <b>${M.water}</b>`);
  }

  function drawChart() {
    const w = chartCv.clientWidth, h = chartCv.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    if (!w) return;
    if (chartCv.width !== Math.round(w * dpr)) { chartCv.width = Math.round(w * dpr); chartCv.height = Math.round(h * dpr); }
    const c = chartCtx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    const hist = M.hist;
    let maxV = 2.5, minV = 0;
    for (const v of hist) { if (v > maxV) maxV = v; if (v < minV) minV = v; }
    const Y = (v) => h - 4 - ((v - minV) / (maxV - minV)) * (h - 10);
    c.strokeStyle = K.cssVar("--grid-line", "rgba(255,255,255,0.1)");
    c.beginPath(); c.moveTo(0, Y(0)); c.lineTo(w, Y(0)); c.stroke();
    c.setLineDash([2, 4]); c.beginPath(); c.moveTo(0, Y(2)); c.lineTo(w, Y(2)); c.stroke(); c.setLineDash([]);
    if (hist.length > 1) {
      const X = (i) => w - ((hist.length - 1 - i) / 119) * w;
      c.beginPath(); hist.forEach((v, i) => (i ? c.lineTo(X(i), Y(v)) : c.moveTo(X(i), Y(v))));
      c.strokeStyle = COL.atp; c.lineWidth = 2; c.stroke();
    }
    // gradient bar on the right
    const g = M.gradient();
    c.fillStyle = "rgba(244,114,182,0.18)"; c.fillRect(w - 8, 4, 6, h - 8);
    c.fillStyle = COL.H; c.fillRect(w - 8, 4 + (h - 8) * (1 - g), 6, (h - 8) * g);
    chartCv.setAttribute("aria-label", `ATP made per second over the last 30 seconds; now ${M.rate.toFixed(1)} per second. H⁺ gradient ${Math.round(g * 100)} percent.`);
  }

  function reset() {
    M.st.o2 = DEF.o2; M.st.nadh = DEF.nadh; M.st.cyanide = M.st.dnp = M.st.olig = false;
    ctl.o2.value = DEF.o2; ctl.nadh.value = DEF.nadh; ctl.cn.checked = ctl.dnp.checked = ctl.olig.checked = false;
    M.reset(); writeShared();
    toast("Reset");
  }

  // ---------- crank input: drag in a circle around ATP synthase ----------
  const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
  function screenOf(world, out) {
    const r = engine.canvas.getBoundingClientRect();
    v2.copy(world).project(engine.camera);
    out.x = r.left + (v2.x * 0.5 + 0.5) * r.width; out.y = r.top + (-v2.y * 0.5 + 0.5) * r.height;
    return out;
  }
  const sc = { x: 0, y: 0 }, sa = { x: 0, y: 0 }, sb = { x: 0, y: 0 };
  function ringScreen() {
    screenOf(G.f1World(v0), sc);
    screenOf(G.ringWorld(0, v1), sa);
    screenOf(G.ringWorld(Math.PI / 2, v1), sb);
    const ax = sa.x - sc.x, ay = sa.y - sc.y, bx = sb.x - sc.x, by = sb.y - sc.y;
    // orientation of the ring on screen: +1 if increasing φ looks clockwise (screen y points down)
    const cross = ax * by - ay * bx;
    return { cx: sc.x, cy: sc.y, r: Math.max(Math.hypot(ax, ay), Math.hypot(bx, by)), sign: cross >= 0 ? 1 : -1 };
  }
  const angleAt = (e, rs) => Math.atan2(e.clientY - rs.cy, e.clientX - rs.cx);

  // ---------- level object ----------
  let uiT = 0, exT = 0, chT = 0, lastHTML = "";
  const noteT = {};
  const level = {
    title: "Inner membrane (cristae)",
    topics: ["respiration", "atp", "organelles", "enzymes", "membrane"],
    root: G.root,
    pickables: G.pickables,
    metersPerUnit: 4e-9,              // bilayer ≈ 1.9 units ≈ 7.5 nm
    get view() {
      const cam = engine.camera, a = cam.aspect, t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      const portrait = a < 0.9, halfW = portrait ? 6.0 : 10.8;
      const d = Math.min(56, Math.max(12, halfW / (t * a)));
      return { target: new THREE.Vector3(portrait ? 4.1 : -0.4, -0.9, 0), distance: d, dir: new THREE.Vector3(portrait ? -0.12 : 0, 0.13, 1) };
    },
    minDistance: 3.5, maxDistance: 60, near: 0.05, far: 500,
    minPolar: 0.3, maxPolar: 2.6, enablePan: true,
    env: { bg: ["#140c26", "#2a0f22", "#3a1240"], fog: ["#1a0d24", 0.018], exposure: 1.02, bloom: [0.45, 0.5, 0.86], aperture: 0.0014 },
    info(obj) {
      const k = obj.userData.kind;
      const i = INFO[k];
      if (!i) return null;
      return { kind: k, title: lens.pick(i.title) || lens.pick(INFO.synthase.title) };
    },
    onSelect(info) {
      if (!info) return;
      const i = INFO[info.kind];
      if (i) toast(`${lens.pick(i.text)}`, 6000);
    },
    onHover(obj) {
      const k = obj?.userData.kind || null;
      hover = k === "synthase" || k === "rotor" ? "rotor" : k;
      engine.canvas.style.cursor = hover === "rotor" ? "grab" : engine.canvas.style.cursor;
    },
    onPointerDown(e, hit) {
      const k = hit?.object.userData.kind;
      const rs = ringScreen();
      const near = Math.hypot(e.clientX - rs.cx, e.clientY - rs.cy) < rs.r * 1.3 + 14;
      if (k === "rotor" || k === "synthase" || (!hit && near)) {
        grabbed = true; grabbedOnce = true;
        M.grab();
        lastAng = angleAt(e, rs);
        engine.canvas.style.cursor = "grabbing";
        return true;
      }
      return false;
    },
    onPointerDrag(e) {
      if (!grabbed) return;
      const rs = ringScreen();
      if (Math.hypot(e.clientX - rs.cx, e.clientY - rs.cy) < 6) return;
      const a = angleAt(e, rs);
      let d = a - lastAng;
      if (d > Math.PI) d -= TAU;
      if (d < -Math.PI) d += TAU;
      lastAng = a;
      M.turnBy(d * rs.sign);
    },
    onPointerUp() { if (grabbed) { grabbed = false; M.release(); engine.canvas.style.cursor = "grab"; } },
    mountPanel(el) {
      if (!panel || panel._band !== lens.band) buildPanel();
      el.appendChild(panel);
      engine.overlay.appendChild(overlay);
      engine.labelLayer.appendChild(labelLayer);
    },
    unmountPanel() { if (grabbed) { grabbed = false; M.release(); } overlay.remove(); labelLayer.remove(); },
    onLens() {
      pickNames();
      const host = panel?.parentElement;
      panel?.remove();
      buildPanel();
      host?.appendChild(panel);
    },
    dispose() { M.release(); overlay.remove(); labelLayer.remove(); },
    update(dt, t, realDt) {
      const rdt = realDt ?? dt;
      const d = dt * speed;
      M.step(d);
      const evts = M.drain();
      for (const ev of evts) {
        if (ev.k !== "note") continue;
        const now = performance.now();
        if (noteT[ev.key] && now - noteT[ev.key] < 3500) continue;
        noteT[ev.key] = now; toast(ev.msg, 3000);
      }
      const y7 = lens.band === "y7-8";
      G.onEvents(evts, { eq: !y7 });
      G.update(d, t, {
        hover, grabbed, firstGrab: !grabbedOnce, labels: showLabels, names: engine.camera.aspect < 0.8 ? shortNames : names,
        crankText: !grabbedOnce ? (y7 || engine.camera.aspect < 0.8 ? "Drag round the motor ↻" : "Drag in a circle around ATP synthase") : "",
        warnBacked: y7 ? "Electrons piled up!" : "e⁻ backed up — complex IV can't pass them on",
        heatText: y7 ? "Heat released" : "Energy released as heat, not ATP",
      });
      uiT -= rdt; exT -= rdt; chT -= rdt;
      if (uiT <= 0) { uiT = 0.25; updateChips(); }
      if (exT <= 0) { exT = 0.4; const html = narrative(M, lens.band); if (html !== lastHTML) { exBody.innerHTML = html; lastHTML = html; } }
      if (chT <= 0) { chT = 0.25; drawChart(); }
      missions?.update();
    },
  };
  return level;
}
