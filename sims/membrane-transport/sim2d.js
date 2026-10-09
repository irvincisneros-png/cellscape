// Membrane Transport — CellScape showpiece. UI wiring; physics in model.js, rendering in draw.js.
import * as K from "../../assets/js/kit.js";
import { Model, SP, ORDER } from "./model.js";
import * as D from "./draw.js";

const stageEl = K.$("#stage");
const panel = K.$("#panel");
const overlay = K.$("#overlay");
const canvas = K.$("#canvas");
const toast = K.toaster(stageEl);
const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const M = new Model();
const stage = K.createStage(canvas, (s) => M.setSize(s.w, s.h));
const { ctx } = stage;

let sel = "glc";          // species chosen in the palette
let focus = "intro";      // what the explain card talks about
let hover = null;
let drag = null;          // palette drag
let press = null;         // protein press
let explainTimer = 0;

const setFocus = (f) => { focus = f; explainTimer = 0; };

// ---------- panel: explain ----------
const explain = K.card(panel, "What's happening", "explain");
const explainBody = document.createElement("div");
explain.appendChild(explainBody);

// ---------- panel: controls ----------
const controls = K.card(panel, "Controls");
const row = K.buttonRow(controls);
const pauseBtn = K.button(row, "Pause", () => { pauseBtn.textContent = L.toggle() ? "Pause" : "Play"; });
K.button(row, "Reset", () => resetAll());
const speeds = [0.25, 0.5, 1, 2, 3];
const speedSeg = K.segmented(controls, speeds.map((v) => ({ value: v, label: `${v}×` })), reduced ? 0.5 : 1, (v) => { L.speed = v; });

// ---------- panel: conditions ----------
const cond = K.card(panel, "Conditions");
const tempS = K.slider(cond, {
  label: "Temperature", min: 0, max: 60, value: 37, unit: " °C",
  onInput: (v) => { M.temp = v; setFocus("temp"); },
});
const atpS = K.slider(cond, {
  label: "ATP production (respiration)", min: 0, max: 100, step: 5, value: 60, unit: " %",
  onInput: (v) => { M.atpProd = v / 100; setFocus("atp"); },
});
const cyanideCb = K.checkbox(cond, "Poison ATP production (cyanide)", false, (v) => {
  M.cyanide = v; setFocus("cyanide");
  toast(v ? "☠ Cyanide added: respiration stops — no new ATP." : "Cyanide removed: respiration restarts.");
});
const atpRow = K.buttonRow(cond);
K.button(atpRow, "Feed the pump ATP (+5)", () => { M.feedATP(5); setFocus("pump"); });

// ---------- panel: proteins ----------
const protCard = K.card(panel, "Membrane proteins");
const cbAqp = K.checkbox(protCard, "Aquaporin open", true, (v) => { M.setChannel("aqp", v); setFocus("h2o"); });
const cbK = K.checkbox(protCard, "K⁺ leak channel open", true, (v) => { M.setChannel("kch", v); setFocus("kch"); });
const cbNa = K.checkbox(protCard, "Na⁺ channel open", true, (v) => { M.setChannel("nach", v); setFocus("nach"); });
const cbGlut = K.checkbox(protCard, "Block GLUT with an inhibitor", false, (v) => { M.setGlutBlocked(v); setFocus("glc"); });
protCard.insertAdjacentHTML("beforeend", `<p class="hint">Tip: tap a protein in the membrane to open/close or block it. Press and hold the Na⁺/K⁺ pump to feed it ATP.</p>`);

// ---------- panel: add molecules ----------
const addCard = K.card(panel, "Add molecules");
const grid = document.createElement("div");
grid.className = "species-grid";
addCard.appendChild(grid);
const spBtns = {};
for (const sp of ORDER) {
  const b = K.button(grid, `<i style="background:${SP[sp].color}"></i>${SP[sp].short}`, () => selectSpecies(sp));
  b.setAttribute("aria-label", SP[sp].long);
  spBtns[sp] = b;
}
const addRow = K.buttonRow(addCard);
K.button(addRow, "+5 outside", () => addSel("out"));
K.button(addRow, "+5 inside", () => addSel("in"));
K.button(addRow, "Clear", () => {
  M.parts.forEach((p) => { if (p.sp === sel && p.mode === "free") p.dead = true; });
  toast(`Removed free ${SP[sel].long.toLowerCase()} particles`);
});
addCard.insertAdjacentHTML("beforeend", `<p class="hint">Or drag a molecule from the tray under the stage onto either side — or tap empty space to add 3 of the selected molecule.</p>`);

function selectSpecies(sp) {
  sel = sp;
  for (const s of ORDER) spBtns[s].setAttribute("aria-pressed", String(s === sp));
  setFocus(sp);
}
selectSpecies(sel);
focus = "intro";

function addSel(side) {
  const n = M.addCluster(sel, side, 5);
  toast(n ? `Added ${n} ${SP[sel].name} ${side === "out" ? "outside" : "inside"}` : "That side is full for this molecule");
  setFocus(sel);
}

// ---------- panel: vesicles ----------
const vesCard = K.card(panel, "Bulk transport (vesicles)");
const vesRow = K.buttonRow(vesCard);
const vesMsg = (r) => {
  if (r === "busy") toast("A vesicle is already on the move — wait for it to finish.");
  else if (r === "noatp") toast("No ATP! Vesicle transport is active — it needs energy.");
  else if (r === "full") toast("Too many particles — remove some first.");
};
K.button(vesRow, "Endocytosis (bring in)", () => { const r = M.startVesicle("endo"); vesMsg(r); if (r === "ok") setFocus("endo"); });
K.button(vesRow, "Exocytosis (secrete)", () => { const r = M.startVesicle("exo"); vesMsg(r); if (r === "ok") setFocus("exo"); });
vesCard.insertAdjacentHTML("beforeend", `<p class="hint">Large proteins can't use any channel or carrier — cells move them inside membrane-bound vesicles.</p>`);

// ---------- panel: chart (narrow screens only; wide screens get a stage inset) ----------
const chartCard = K.card(panel, "Inside vs outside", "chart-card");
const chartCv = document.createElement("canvas");
chartCv.setAttribute("aria-hidden", "true");
chartCard.appendChild(chartCv);
const chartCtx = chartCv.getContext("2d");

// ---------- panel: legend ----------
const legend = K.card(panel, "Legend");
const lg = document.createElement("div");
lg.className = "legend";
lg.innerHTML = ORDER.map((sp) => `<span><i style="background:${SP[sp].color}"></i>${SP[sp].long}${sp === "prot" ? "" : ` (${SP[sp].name})`}</span>`).join("")
  + `<span><i style="background:${K.C.amber}"></i>ATP</span>`;
legend.appendChild(lg);
legend.insertAdjacentHTML("beforeend", `<p class="hint">Chips show <b>outside · inside</b> counts and the net flux: <span style="color:var(--good)">↓ into the cell</span>, <span style="color:var(--accent-3)">↑ out of the cell</span>.</p>`);

// ---------- missions ----------
let naPeak = false;
const glutInRate = () => {
  let n = 0;
  const t0 = M.time - 8;
  for (const e of M.events) if (e.sp === "glc" && e.via === "glut" && e.dir > 0 && e.t > t0) n++;
  return n / Math.max(1, Math.min(8, M.time));
};
const missions = K.missions(panel, [
  {
    text: "Let O₂ diffuse until inside and outside are equal (dynamic equilibrium).",
    check: () => { const c = M.count("o2", "out"), i = M.count("o2", "in"); return c + i >= 8 && Math.abs(c - i) <= Math.max(2, 0.12 * (c + i)) && M.cross.o2.in + M.cross.o2.out >= 8; },
  },
  {
    text: "Move 8 glucose into the cell by facilitated diffusion through GLUT.",
    check: () => M.cross.glc.glutIn - M.cross.glc.glutOut >= 8,
  },
  {
    text: "Prove glucose can't cross the bare bilayer: block GLUT for 8 s while one side has 6+ more glucose.",
    check: () => M.glut.blockedTime >= 8 && Math.abs(M.count("glc", "out") - M.count("glc", "in")) >= 6,
  },
  {
    text: "Build a steep Na⁺ gradient: at least 3× more Na⁺ outside than inside.",
    check: () => { const o = M.count("na", "out"), i = M.count("na", "in"); return o >= 12 && o >= 3 * Math.max(1, i); },
  },
  {
    text: "After building the gradient, cut off ATP (cyanide or 0 %) and let Na⁺ run down below 1.5× outside.",
    check: () => naPeak && (M.cyanide || M.atpProd === 0) && M.atp < 1 && M.count("na", "out") <= 1.5 * M.count("na", "in"),
  },
  {
    text: "Saturate GLUT: with 35+ glucose outside, push its uptake to at least 75 % of its maximum rate.",
    check: () => !M.glut.blocked && M.count("glc", "out") >= 35 && glutInRate() >= 0.75 * M.glutVmax(),
  },
], (m) => toast(`🎯 Mission complete: ${m.text}`, 3400));

// ---------- quiz ----------
K.quiz(panel, [
  {
    q: "Which of these processes uses ATP <strong>directly</strong>?",
    options: ["Simple diffusion of O₂ through the lipids", "Facilitated diffusion of glucose through GLUT", "The Na⁺/K⁺ pump moving Na⁺ out", "Osmosis through aquaporins"],
    answer: 2,
    why: "Only <strong>active transport</strong> moves a substance against its concentration gradient, and that needs energy from ATP hydrolysis. Diffusion, facilitated diffusion and osmosis are passive.",
  },
  {
    q: "Why can't Na⁺ and K⁺ cross the phospholipid bilayer by simple diffusion?",
    options: ["They are too large", "They are charged, so the hydrophobic (non-polar) core of the bilayer blocks them", "They can only move when ATP is present", "The bilayer has no gaps of any kind"],
    answer: 1,
    why: "Ions are tiny but <strong>charged</strong> and surrounded by water molecules. The fatty-acid tails in the middle of the bilayer are non-polar, so ions need a channel or a pump.",
  },
  {
    q: "In one cycle, the Na⁺/K⁺ pump uses one ATP to move…",
    options: ["2 Na⁺ out and 3 K⁺ in", "3 Na⁺ out and 2 K⁺ in", "3 Na⁺ in and 2 K⁺ out", "1 Na⁺ out for every K⁺ in"],
    answer: 1,
    why: "<strong>3 Na⁺ out, 2 K⁺ in per ATP</strong> — both against their gradients. This keeps Na⁺ high outside and K⁺ high inside.",
  },
  {
    q: "A student keeps adding glucose outside, but the uptake rate through GLUT stops increasing. Why?",
    options: ["Glucose becomes toxic at high concentration", "The carriers are all busy binding and changing shape — they are saturated", "The cell has run out of ATP", "The glucose gradient has reversed"],
    answer: 1,
    why: "Each carrier has to bind a molecule and change shape, so there is a <strong>maximum rate</strong>. Once every carrier is busy, more glucose can't speed things up. Simple diffusion doesn't level off like this.",
  },
  {
    q: "Cyanide stops ATP production. What happens to the Na⁺ gradient over time?",
    options: ["It becomes steeper", "It stays the same", "It runs down as Na⁺ leaks in through channels and nothing pumps it back out", "Na⁺ starts diffusing straight through the lipids"],
    answer: 2,
    why: "Without ATP the pump stops, but leak channels still let Na⁺ diffuse <strong>down</strong> its gradient into the cell, so the gradient collapses.",
  },
  {
    q: "Which substance crosses the membrane by simple diffusion straight through the lipid bilayer?",
    options: ["Glucose", "K⁺", "O₂", "A large protein"],
    answer: 2,
    why: "O₂ (and CO₂) are <strong>small and non-polar</strong>, so they dissolve through the lipid core. Glucose needs a carrier, K⁺ needs a channel or pump, and large proteins need vesicles.",
  },
]);

// ---------- overlay chips ----------
const CHIP_SP = ["o2", "co2", "h2o", "glc", "na", "k"];
const chipSet = {};
for (const sp of CHIP_SP) {
  chipSet[sp] = K.chip(overlay);
  if (sp === "co2" || sp === "h2o") overlay.lastChild.classList.add("opt");
}
const atpChip = K.chip(overlay);
const atpChipEl = overlay.lastChild;

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
}

// ---------- explain text ----------
const fmt = (v) => (v >= 10 ? v.toFixed(0) : v.toFixed(1));
const ratio = (a, b) => (b === 0 ? (a === 0 ? "1" : `${a}:0`) : `${fmt(a / b)}×`);

function nowLine(c) {
  const items = [];
  for (const sp of ["o2", "co2", "h2o", "glc", "na", "k"]) {
    const f = M.flux(sp);
    const grad = c[sp].out - c[sp].in; // + means more outside
    if (Math.abs(f) < 0.2 || Math.abs(grad) < 3) continue; // ignore random back-and-forth
    const inward = f > 0;
    const down = (inward && grad > 0) || (!inward && grad < 0);
    const active = (sp === "na" && !inward) || (sp === "k" && inward); // the pump's directions
    if (!down && !active) continue; // passive movement can only be net down a gradient: anything else is noise
    items.push({ f, text: `<strong>${SP[sp].name}</strong> ${inward ? "into" : "out of"} the cell — ${down ? "<em>down</em> its gradient (passive)" : "<em>against</em> its gradient (active: the pump, using ATP)"}` });
  }
  items.sort((a, b) => Math.abs(b.f) - Math.abs(a.f));
  if (!items.length) return `<p class="now"><strong>Net movement now:</strong> nothing significant — molecules still cross both ways, but the sides are close to balanced.</p>`;
  return `<p class="now"><strong>Net movement now:</strong> ${items.slice(0, 3).map((i) => i.text).join("; ")}.</p>`;
}

function focusText(c) {
  const T = M.temp, open = (id) => M.byId[id].open;
  switch (focus) {
    case "o2": case "co2": {
      const sp = focus, o = c[sp].out, i = c[sp].in, eq = Math.abs(o - i) <= Math.max(2, 0.12 * (o + i));
      return `<p>${SP[sp].name} is <strong>small and non-polar</strong>, so it dissolves straight through the hydrophobic core of the bilayer — <strong>simple diffusion</strong>. No protein and no ATP needed.</p>
        <p>${SP[sp].name}: <strong>${o}</strong> outside vs <strong>${i}</strong> inside. ${eq ? "The two sides are about equal: molecules still cross both ways, but there is <strong>no net movement</strong> — a <strong>dynamic equilibrium</strong>." : `More molecules hit the membrane from the crowded side, so there is net movement toward the <strong>${o > i ? "inside" : "outside"}</strong>, down the concentration gradient.`}</p>`;
    }
    case "h2o":
      return `<p>Water is small but <strong>polar</strong>, so only a trickle squeezes between the lipids. Most water crosses through <strong>aquaporins</strong> — channel proteins that let water molecules through in single file. Diffusion of water across a membrane is called <strong>osmosis</strong>.</p>
        <p>The aquaporin is <strong>${open("aqp") ? "open" : "closed"}</strong>. H₂O: ${c.h2o.out} outside vs ${c.h2o.in} inside.${open("aqp") ? "" : " With it closed, water crosses far more slowly."}</p>`;
    case "glc": {
      if (M.glut.blocked) return `<p>The <strong>GLUT carrier is blocked</strong> by an inhibitor, so it can't change shape. Glucose: <strong>${c.glc.out}</strong> outside vs <strong>${c.glc.in}</strong> inside — and none crosses. Glucose is too <strong>large and polar</strong> to pass through the lipid bilayer on its own.</p>`;
      const r = glutInRate(), vmax = M.glutVmax(), sat = r >= 0.75 * vmax && c.glc.out >= 25;
      return `<p>Glucose is too <strong>large and polar</strong> to cross the lipid core. The <strong>GLUT carrier</strong> binds one glucose, <strong>changes shape</strong> and releases it on the other side — <strong>facilitated diffusion</strong>. It works both ways, so the net movement is always <em>down</em> the gradient, and no ATP is used.</p>
        <p>Glucose: <strong>${c.glc.out}</strong> outside vs <strong>${c.glc.in}</strong> inside. GLUT is carrying <strong>${r.toFixed(1)}</strong> glucose/s inward (maximum ≈ ${vmax.toFixed(1)}/s).${sat ? " It is <strong>saturated</strong>: every cycle is full, so adding more glucose can't make it faster." : ""}</p>`;
    }
    case "na": case "k": case "pump": {
      const st = M.pumpStatus();
      const stalled = M.pump.waiting;
      return `<p>The <strong>Na⁺/K⁺ pump</strong> carries out <strong>active transport</strong>. Each cycle it binds <strong>3 Na⁺</strong> inside, splits <strong>ATP → ADP + Pᵢ</strong>, changes shape, releases the Na⁺ outside, then binds <strong>2 K⁺</strong> outside and carries them in. Both ions move <em>against</em> their gradients.</p>
        <p>Pump now: <strong>${st}</strong>.${stalled ? " With no ATP it can't change shape, so it has <strong>stopped</strong>." : ""} Na⁺ is ${ratio(c.na.out, c.na.in)} more concentrated outside (${c.na.out} vs ${c.na.in}); K⁺ is ${ratio(c.k.in, c.k.out)} more concentrated inside (${c.k.in} vs ${c.k.out}).</p>`;
    }
    case "kch": case "nach": {
      const isK = focus === "kch", sp = isK ? "k" : "na", P = M.byId[focus];
      return `<p>The <strong>${P.name}</strong> is a protein with a water-filled pore. Its <strong>selectivity filter</strong> lets ${SP[sp].name} through but not ${isK ? "Na⁺" : "K⁺"}. Ions are <strong>charged</strong>, so they can't cross the hydrophobic lipid core — they need channels. Channels are <strong>passive</strong>: ions flow <em>down</em> their gradient, ${isK ? "mostly <strong>out</strong> of the cell" : "mostly <strong>into</strong> the cell"}.</p>
        <p>This channel is <strong>${P.open ? "open" : "closed"}</strong> (it is <strong>gated</strong> — tap it to switch). ${SP[sp].name}: ${c[sp].out} outside vs ${c[sp].in} inside.</p>`;
    }
    case "cyanide":
      if (!M.cyanide) return `<p>Cyanide removed — the mitochondria can make ATP again (${Math.floor(M.atp)} ATP available), so the pump can rebuild the Na⁺ and K⁺ gradients.</p>`;
      return `<p><strong>Cyanide</strong> blocks aerobic respiration in the mitochondria, so no new ATP is made. ATP left: <strong>${Math.floor(M.atp)}</strong>.</p>
        <p>${M.atp < 1 ? "The ATP has run out and the pump has <strong>stopped</strong>. Na⁺ and K⁺ keep leaking through their channels down their gradients, so the gradients <strong>run down</strong>. Passive transport (O₂, glucose, water) carries on as normal." : "The pump keeps working until the remaining ATP is used up — the rest of the cell is using ATP too."} Na⁺ outside:inside = ${ratio(c.na.out, c.na.in)}.</p>`;
    case "atp":
      return `<p>ATP is made by <strong>cellular respiration</strong>. Production is set to <strong>${Math.round(M.atpProd * 100)} %</strong>${M.cyanide ? " — but cyanide is blocking it" : ""}; ${Math.floor(M.atp)} ATP available.</p>
        <p>Only <strong>active</strong> processes (the Na⁺/K⁺ pump, vesicle transport) use ATP. Changing the ATP supply does <strong>not</strong> change simple or facilitated diffusion.</p>`;
    case "temp": {
      const dF = M.dF, kF = M.kF;
      let extra = "";
      if (T > 42) extra = " Above about 42 °C proteins begin to <strong>denature</strong> — the pump and carrier lose their shape and slow right down. (In real cells this damage is often permanent.)";
      else if (T < 15) extra = " In the cold, the pump and carrier slow down a lot — enzymes and transport proteins depend on temperature.";
      return `<p>Temperature: <strong>${T} °C</strong>. Warmer particles have more <strong>kinetic energy</strong>, so diffusion is faster: here it runs at <strong>${dF.toFixed(2)}×</strong> its 37 °C rate. Transport proteins are at <strong>${kF.toFixed(2)}×</strong>.${extra}</p>`;
    }
    case "prot":
      return `<p>Large proteins are far too big for any channel or carrier. Cells move them in bulk inside <strong>vesicles</strong>: <strong>endocytosis</strong> brings material in, <strong>exocytosis</strong> secretes it out. Both are <strong>active</strong> and need ATP. Try the vesicle buttons in the panel.</p>
        <p>Large proteins: ${c.prot.out} outside vs ${c.prot.in} inside.</p>`;
    case "endo": case "exo": {
      const V = M.ves, ph = V.phase;
      if (ph === "none") return `<p>The vesicle has finished. ${focus === "endo" ? "In endocytosis, the vesicle's contents are usually delivered to a <strong>lysosome</strong> to be digested." : "In exocytosis, the vesicle membrane becomes part of the cell membrane and its contents are released outside — this is how cells <strong>secrete</strong> hormones and enzymes."}</p>`;
      const steps = {
        dip: "The membrane folds <strong>inward</strong>, wrapping around large molecules outside.",
        close: "The pocket deepens and its neck narrows…",
        away: "The membrane <strong>pinches off</strong> to form a vesicle that carries the cargo into the cytoplasm.",
        come: "A <strong>vesicle</strong> full of proteins (made at the ER and Golgi) moves to the membrane.",
        open: "The vesicle <strong>fuses</strong> with the cell membrane and opens to the outside, releasing its contents.",
        flat: "The vesicle membrane flattens out and becomes part of the cell membrane.",
      };
      return `<p><strong>${focus === "endo" ? "Endocytosis" : "Exocytosis"}</strong> — bulk transport using ATP. ${steps[ph] || ""}</p>`;
    }
    default:
      return `<p>This is a <strong>cell membrane</strong>: a phospholipid bilayer with proteins embedded in it. Outside (top) is extracellular fluid; inside (bottom) is cytoplasm.</p>
        <p><strong>Passive transport</strong> (diffusion, facilitated diffusion, osmosis) moves substances <em>down</em> their concentration gradient with no ATP. <strong>Active transport</strong> uses ATP to move them <em>against</em> it. Tap any molecule or protein to explore.</p>`;
  }
}

function updateExplain(c) {
  const html = focusText(c) + nowLine(c) +
    `<small>Not to scale: a real membrane is about 7 nm thick, molecules are drawn much larger, and a real pump cycles about 100 times per second. Both sides have equal volume, so particle count = concentration.</small>`;
  if (explainBody.innerHTML !== html) explainBody.innerHTML = html;
}

// ---------- canvas interaction ----------
function hitProtein(x, y) {
  const L = M.L;
  for (const P of M.prot) {
    const hw = Math.max(D.protW(P, L) / 2 + 4, 22);
    const top = L.memTop - L.protH * 0.42 - 8;
    const bot = L.memBot + (P.kind === "pump" ? L.protH * 0.62 : L.protH * 0.25) + 8;
    if (Math.abs(x - P.x) < hw && y > top && y < bot) return P;
  }
  return null;
}

function hitParticle(x, y) {
  let best = null, bd = Infinity;
  for (const p of M.parts) {
    if (p.dead || p.side === "ves") continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < SP[p.sp].r * M.L.sc + 14 && d < bd) { bd = d; best = p; }
  }
  return best;
}

const sideAt = (y) => (y < M.L.memTop - 2 ? "out" : y > M.L.memBot + 2 && y < M.L.uh ? "in" : null);
const focusFor = (sp) => sp;

function toggleProtein(P) {
  if (P.kind === "channel") {
    M.setChannel(P.id, !P.open);
    ({ aqp: cbAqp, kch: cbK, nach: cbNa })[P.id].checked = P.open;
    toast(`${P.name} ${P.open ? "opened" : "closed"}`);
    setFocus(P.id === "aqp" ? "h2o" : P.id);
  } else if (P.kind === "carrier") {
    M.setGlutBlocked(!M.glut.blocked);
    cbGlut.checked = M.glut.blocked;
    toast(M.glut.blocked ? "GLUT blocked by an inhibitor" : "GLUT inhibitor washed out");
    setFocus("glc");
  }
}

K.pointer(canvas, {
  down(p) {
    const L = M.L;
    if (p.y >= L.uh) {
      const R = D.paletteRects(L).find((r) => p.x >= r.x - 3 && p.x <= r.x + r.w + 3);
      if (R) { selectSpecies(R.sp); drag = { sp: R.sp, x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false }; }
      return;
    }
    const P = hitProtein(p.x, p.y);
    if (P) {
      press = { id: P.id };
      if (P.kind === "pump") {
        M.feeding = true; M.feedATP(2); setFocus("pump");
        toast("Feeding the pump ATP — keep holding for more");
      }
      return;
    }
    const part = hitParticle(p.x, p.y);
    if (part) { M.inspect = { p: part, t: M.time }; setFocus(focusFor(part.sp)); return; }
    const side = sideAt(p.y);
    if (side) {
      const n = M.addCluster(sel, side, 3, p.x, p.y);
      if (!n) toast("That side is full for this molecule");
      setFocus(sel);
    }
  },
  move(p) {
    if (drag) {
      drag.x = p.x; drag.y = p.y;
      if (Math.hypot(p.x - drag.sx, p.y - drag.sy) > 6) drag.moved = true;
      return;
    }
    const P = p.y < M.L.uh ? hitProtein(p.x, p.y) : null;
    hover = P ? P.id : null;
    canvas.style.cursor = p.y >= M.L.uh ? "grab" : P || hitParticle(p.x, p.y) ? "pointer" : sideAt(p.y) ? "copy" : "default";
  },
  up(p) {
    if (drag) {
      const side = sideAt(p.y);
      if (drag.moved && side) {
        const n = M.addCluster(drag.sp, side, 5, p.x, p.y);
        toast(n ? `Added ${n} ${SP[drag.sp].name} ${side === "out" ? "outside" : "inside"}` : "That side is full for this molecule");
        setFocus(drag.sp);
      } else if (!drag.moved) toast(`${SP[drag.sp].long} selected — drag it onto a side, or tap empty space to add 3`);
      drag = null;
      return;
    }
    if (press) {
      const P = M.byId[press.id];
      if (P.kind === "pump") M.feeding = false;
      else if (hitProtein(p.x, p.y) === P) toggleProtein(P);
      press = null;
    }
  },
});
canvas.addEventListener("pointercancel", () => { drag = null; press = null; M.feeding = false; });

// ---------- reset ----------
function resetAll() {
  M.temp = 37; M.atpProd = 0.6; M.cyanide = false;
  tempS.value = 37; atpS.value = 60; cyanideCb.checked = false;
  cbAqp.checked = cbK.checked = cbNa.checked = true; cbGlut.checked = false;
  M.reset();
  naPeak = false;
  setFocus("intro");
  toast("Reset");
}

// ---------- chart in panel ----------
function drawPanelChart(c) {
  const w = chartCv.clientWidth, h = chartCv.clientHeight, dpr = stage.dpr;
  if (!w) return;
  if (chartCv.width !== Math.round(w * dpr)) { chartCv.width = Math.round(w * dpr); chartCv.height = Math.round(h * dpr); }
  chartCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  chartCtx.clearRect(0, 0, w, h);
  D.drawChart(chartCtx, 0, 0, w, h, c, { panel: false });
}

// ---------- main loop ----------
let uiTimer = 0;
const L = K.loop((dt, t) => {
  M.step(dt);
  const Ly = M.L, dpr = stage.dpr;
  const c = M.counts();
  if (c.na.out >= 12 && c.na.out >= 3 * Math.max(1, c.na.in)) naPeak = true;

  D.drawBackground(ctx, M, t);
  D.drawAtpDots(ctx, M, dpr);
  D.drawParticles(ctx, M, dpr, (p) => p.mode === "free" || (p.mode === "ves" && M.ves.phase !== "away" && M.ves.phase !== "come"));
  D.drawMembrane(ctx, M, t, dpr);
  D.drawVesicle(ctx, M, t, dpr);
  D.drawParticles(ctx, M, dpr, (p) => p.mode === "ves" && (M.ves.phase === "away" || M.ves.phase === "come"));
  D.drawProteins(ctx, M, t, dpr, { hover });
  D.drawParticles(ctx, M, dpr, (p) => p.mode === "transit" || p.mode === "bound");
  D.drawProteinLabels(ctx, M, {});
  D.drawFx(ctx, M, dpr);
  D.drawInspect(ctx, M);

  const wide = stage.w >= 760 && Ly.uh - Ly.memBot > 150;
  if (wide) {
    const cw = Math.min(260, stage.w * 0.24), ch = 112;
    D.drawChart(ctx, 26, Ly.uh - ch - 10, cw, ch, c);
  }
  D.drawPalette(ctx, M, dpr, sel, drag);

  uiTimer -= 1 / 60;
  explainTimer -= 1 / 60;
  if (uiTimer <= 0) {
    uiTimer = 0.2;
    updateChips(c);
    chartCard.style.display = wide ? "none" : "";
    if (!wide) drawPanelChart(c);
  }
  if (explainTimer <= 0) { explainTimer = 0.5; updateExplain(c); }
  missions.update();
});
L.speed = reduced ? 0.5 : 1;
speedSeg.set(L.speed);
