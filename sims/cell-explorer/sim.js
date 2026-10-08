// Cell Explorer — pan/zoom a living animal, plant or bacterial cell; tap organelles; quiz-hunt.
import * as K from "../../assets/js/kit.js";
import { COL, infoFor, HUNT_CLUE, LISTS } from "./info.js";
import { buildAnimal, buildPlant, buildBacterium } from "./cells.js";

const stageEl = K.$("#stage");
const panel = K.$("#panel");
const overlay = K.$("#overlay");
const canvas = K.$("#canvas");
const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- camera (world units = µm; s = screen px per µm) ----------
const cam = { x: 0, y: 0, s: 30 };
const tgt = { x: 0, y: 0, s: 30, active: false };
let stage = null;
const stageReady = () => stage && stage.w > 2;
let userMoved = false;
stage = K.createStage(canvas, () => { if (stage) { if (!userMoved && !tgt.active) fitView(true); clampS(); clampCam(); } });
const { ctx } = stage;
const toast = K.toaster(stageEl);

const CELLS = { animal: buildAnimal(), plant: buildPlant(), bacteria: buildBacterium() };
const TYPE_NAME = { animal: "Animal", plant: "Plant", bacteria: "Bacterium" };
const BG_TINT = { animal: "#0d3b44", plant: "#103a26", bacteria: "#27204a" };

const state = {
  type: "animal", prev: null, trans: 1, mode: "explore", labels: false,
  sel: null, hover: null, flash: null,
  discovered: { animal: new Set(), plant: new Set(), bacteria: new Set() },
  compareDone: false,
};
const cell = () => CELLS[state.type];

const fitScale = (c = cell()) => Math.min(stage.w / c.fit.w, stage.h / c.fit.h) * 0.94;
const sMin = () => fitScale() * (state.type === "bacteria" ? 0.05 : 0.45);
const S_MAX = 5000;
function clampS() { cam.s = K.clamp(cam.s, sMin(), S_MAX); }
function clampCam() { const b = cell().bounds; cam.x = K.clamp(cam.x, b.x0, b.x1); cam.y = K.clamp(cam.y, b.y0, b.y1); }
const toWorld = (sx, sy) => ({ x: (sx - stage.w / 2) / cam.s + cam.x, y: (sy - stage.h / 2) / cam.s + cam.y });
const toScreen = (x, y) => ({ x: (x - cam.x) * cam.s + stage.w / 2, y: (y - cam.y) * cam.s + stage.h / 2 });
function easeTo(x, y, s) {
  if (stage.w > 2) userMoved = true; tgt.x = x; tgt.y = y; tgt.s = K.clamp(s, sMin(), S_MAX); tgt.active = true; }
function fitView(instant = false) {
  const c = cell();
  if (instant) { cam.x = c.fit.x; cam.y = c.fit.y; cam.s = fitScale(c); tgt.active = false; }
  else easeTo(c.fit.x, c.fit.y, fitScale(c));
}
function zoomAt(sx, sy, f) {
  const w = toWorld(sx, sy);
  cam.s = K.clamp(cam.s * f, sMin(), S_MAX);
  cam.x = w.x - (sx - stage.w / 2) / cam.s; cam.y = w.y - (sy - stage.h / 2) / cam.s;
  clampCam(); tgt.active = false;
}
fitView(true);

// ---------- panel ----------
const explain = K.card(panel, "What's happening", "explain");
const explainBody = document.createElement("div"); explain.appendChild(explainBody);

const info = K.card(panel, "Structure", "info");
const infoBody = document.createElement("div"); info.appendChild(infoBody);

const huntCard = K.card(panel, "Quiz-hunt", "hunt-card");
const huntBody = document.createElement("div"); huntCard.appendChild(huntBody);
huntCard.style.display = "none";

const controls = K.card(panel, "Controls");
const lab = (t) => { const d = document.createElement("div"); d.className = "ctl-label"; d.textContent = t; controls.appendChild(d); };
lab("Cell type");
const typeSeg = K.segmented(controls, [
  { value: "animal", label: "Animal" }, { value: "plant", label: "Plant" }, { value: "bacteria", label: "Bacterium" },
], "animal", (v) => setType(v));
lab("Mode");
const modeSeg = K.segmented(controls, [{ value: "explore", label: "Explore" }, { value: "hunt", label: "Quiz-hunt" }], "explore", (v) => setMode(v));
const labelBox = K.checkbox(controls, "Label mode (show all labels)", false, (v) => { state.labels = v; });
const speedS = K.slider(controls, {
  label: "Animation speed", min: 0.25, max: 3, step: 0.25, value: reduced ? 0.5 : 1,
  format: (v) => `${v}×`, onInput: (v) => { L.speed = v; },
});
const row = K.buttonRow(controls);
const pauseBtn = K.button(row, "Pause", () => { pauseBtn.textContent = L.toggle() ? "Pause" : "Play"; });
K.button(row, "Reset view", () => { state.sel = null; renderInfo(); fitView(); });

// compare card: what do bacteria lack?
const cmp = K.card(panel, "Compare: what do bacteria lack?", "compare");
cmp.insertAdjacentHTML("beforeend", `<p>Explore the bacterium, then select <strong>every</strong> structure a bacterium does <strong>not</strong> have.</p>`);
const cmpOpts = document.createElement("div"); cmpOpts.className = "opts"; cmp.appendChild(cmpOpts);
const CMP = [
  ["nucleus", "Nucleus", true], ["ribosome", "Ribosomes", false], ["mito", "Mitochondria", true], ["membrane", "Cell membrane", false],
  ["golgi", "Golgi apparatus", true], ["dna", "DNA", false], ["er", "Endoplasmic reticulum", true], ["cytoplasm", "Cytoplasm", false],
];
const cmpSel = new Set();
CMP.forEach(([id, name]) => K.button(cmpOpts, name, (on) => { on ? cmpSel.add(id) : cmpSel.delete(id); }, { toggle: true }));
const cmpRow = K.buttonRow(cmp);
const cmpFb = document.createElement("div"); cmpFb.className = "fb"; cmp.appendChild(cmpFb);
K.button(cmpRow, "Check", () => {
  const lack = CMP.filter((c) => c[2]).map((c) => c[0]);
  const missed = lack.filter((id) => !cmpSel.has(id)).length;
  const wrong = [...cmpSel].filter((id) => !lack.includes(id));
  if (!missed && !wrong.length) {
    state.compareDone = true;
    cmpFb.innerHTML = "✅ Correct! Bacteria are <strong>prokaryotes</strong>: no nucleus and no membrane-bound organelles (no mitochondria, ER or Golgi). They still have DNA, ribosomes (70S), cytoplasm and a cell membrane.";
  } else {
    const names = wrong.map((id) => CMP.find((c) => c[0] === id)[1]);
    cmpFb.innerHTML = `❌ Not quite. ${missed ? `You missed ${missed} structure${missed > 1 ? "s" : ""} bacteria lack. ` : ""}${names.length ? `Bacteria <em>do</em> have: ${names.join(", ")}.` : ""} Tap around the bacterium to check.`;
  }
}, { kind: "primary" });

const legend = K.card(panel, "Colour key");
const legendBody = document.createElement("div"); legendBody.className = "legend"; legend.appendChild(legendBody);

// ---------- hunt state ----------
const HUNT_N = 10, HUNT_TIME = 25, HUNT_TRIES = 3;
const hunt = { on: false, round: 0, score: 0, target: null, tries: 0, timeLeft: HUNT_TIME, queue: [], pause: 0, done: false, best: 0, elapsed: 0 };

const missions = K.missions(panel, [
  { text: "Discover all 14 structures in the animal cell", check: () => state.discovered.animal.size >= LISTS.animal.length },
  { text: "Find 3 structures plant cells have that animal cells don't", check: () => ["cellwall", "chloroplast", "vacuole"].every((id) => state.discovered.plant.has(id)) },
  { text: "Compare: pick out everything bacteria lack (Compare card)", check: () => state.compareDone },
  { text: "Zoom in on the rough ER until individual ribosomes show", check: () => state.type !== "bacteria" && cam.s >= 150 && view && cell().erVisible(view) },
  { text: "Score 8/10 or better in Quiz-hunt", check: () => hunt.best >= 8 },
], (m) => toast(`🎯 Mission complete: ${m.text}`, 3200));

K.quiz(panel, [
  {
    q: "Muscle cells contain far more mitochondria than most skin cells. Why?",
    options: ["Mitochondria make muscle fibres stronger", "Muscle cells need lots of ATP for contraction, made by aerobic respiration", "Mitochondria store oxygen for the muscle", "Muscle cells divide more often"],
    answer: 1, why: "Contraction uses a lot of energy. Mitochondria carry out aerobic respiration, releasing energy from glucose to make ATP — more mitochondria = more ATP.",
  },
  {
    q: "Which three structures are found in plant cells but NOT animal cells?",
    options: ["Cell wall, chloroplasts, large central vacuole", "Nucleus, ribosomes, mitochondria", "Cell membrane, cytoplasm, chloroplasts", "Centrioles, lysosomes, cell wall"],
    answer: 0, why: "Plants have a cellulose cell wall, chloroplasts for photosynthesis and a large permanent vacuole. (Animal cells have centrioles and lysosomes that most plant cells lack.)",
  },
  {
    q: "What is the key difference between a prokaryotic and a eukaryotic cell?",
    options: ["Prokaryotes have no DNA", "Prokaryotes have no ribosomes", "Prokaryotes have no membrane-bound nucleus; their DNA sits in a nucleoid", "Prokaryotes have no cell membrane"],
    answer: 2, why: "Prokaryotes (bacteria) do have DNA, ribosomes (smaller 70S) and a membrane — but no nucleus or other membrane-bound organelles.",
  },
  {
    q: "An animal cell is about 20 µm across and a ribosome about 25 nm. Roughly how many ribosomes would fit side by side across the cell?",
    options: ["About 8", "About 80", "About 800", "About 80 000"],
    answer: 2, why: "20 µm = 20 000 nm, and 20 000 ÷ 25 = 800. Ribosomes are about a thousand times smaller than the cell — that's why you need to zoom so far in to see them.",
  },
  {
    q: "A protein hormone is made for secretion. What is the correct order of its journey?",
    options: ["Golgi → ribosome → vesicle → nucleus", "Ribosome on rough ER → Golgi apparatus → vesicle → cell membrane", "Lysosome → rough ER → cell membrane", "Mitochondrion → Golgi → vacuole"],
    answer: 1, why: "Ribosomes on the rough ER make the protein, the Golgi modifies and packages it, and a vesicle carries it to the membrane for exocytosis — the traffic you can watch in the animal cell.",
  },
  {
    q: "Which structure is found in animal, plant AND bacterial cells?",
    options: ["Nucleus", "Mitochondria", "Ribosomes", "Chloroplasts"],
    answer: 2, why: "All cells make proteins, so all cells have ribosomes (80S in eukaryotes, 70S in prokaryotes). All cells also have a cell membrane and cytoplasm.",
  },
]);

// ---------- overlay chips & controls ----------
const chipType = K.chip(overlay), chipZoom = K.chip(overlay), chipDisc = K.chip(overlay), chipHunt = K.chip(overlay);
const chipHuntEl = overlay.lastChild; chipHuntEl.style.display = "none";
const banner = document.createElement("div"); banner.className = "hunt-banner"; banner.style.display = "none";
banner.innerHTML = `<span class="lbl">FIND</span><span class="clue" role="status" aria-live="polite"></span><span class="timer"></span><div class="bar"><div></div></div>`;
overlay.appendChild(banner);
const bClue = banner.querySelector(".clue"), bTimer = banner.querySelector(".timer"), bBar = banner.querySelector(".bar > div");

const zc = document.createElement("div"); zc.className = "zoom-ctrl";
const zb = (txt, aria, fn, cls = "") => { const b = document.createElement("button"); b.type = "button"; b.textContent = txt; b.className = cls; b.setAttribute("aria-label", aria); b.addEventListener("click", fn); zc.appendChild(b); return b; };
zb("+", "Zoom in", () => easeTo(cam.x, cam.y, (tgt.active ? tgt.s : cam.s) * 1.9));
zb("−", "Zoom out", () => easeTo(cam.x, cam.y, (tgt.active ? tgt.s : cam.s) / 1.9));
zb("Fit", "Fit whole cell in view", () => fitView(), "fit");
stageEl.appendChild(zc);

// ---------- type / mode ----------
function setType(t) {
  if (t === state.type) return;
  state.prev = state.type; state.type = t; state.trans = 0;
  state.sel = null; state.hover = null; state.flash = null;
  typeSeg.set(t);
  renderInfo(); renderLegend();
  fitView();
  if (hunt.on) startHunt();
}
function setMode(m) {
  state.mode = m; modeSeg.set(m);
  state.sel = null; renderInfo();
  if (m === "hunt") { startHunt(); labelBox.checked = false; state.labels = false; labelBox.disabled = true; }
  else { hunt.on = false; labelBox.disabled = false; }
  huntCard.style.display = m === "hunt" ? "" : "none";
  info.style.display = m === "hunt" && !hunt.done ? "none" : "";
}

// ---------- selection & info ----------
function discover(id) {
  const set = state.discovered[state.type];
  if (set.has(id)) return false;
  set.add(id);
  return true;
}
function select(h, move) {
  state.sel = { ...h, cellType: state.type, t0: performance.now() };
  const isNew = discover(h.id);
  renderInfo();
  const name = infoFor(h.id, state.type).name;
  if (isNew) toast(`✨ New discovery: <b>${name}</b> (${state.discovered[state.type].size}/${LISTS[state.type].length})`);
  if (move && h.focus > 0) easeTo(h.x, h.y, (Math.min(stage.w, stage.h) * 0.5) / h.focus);
}
const FOUND = [["animal", "Animal"], ["plant", "Plant"], ["bacteria", "Bacteria"]];
function infoHTML(id) {
  const d = infoFor(id, state.type);
  return `<h3 class="org-name" style="color:${COL[id]}"><i style="background:${COL[id]}"></i><span style="color:var(--ink)">${d.name}</span></h3>
    <p>${d.fn}</p>
    <p class="fact">💡 ${d.fact}</p>
    <div class="found">Found in: ${FOUND.map(([k, n]) => `<span class="${d.found.includes(k) ? "on" : "off"}">${n}</span>`).join("")}</div>
    <p class="meta">Approx. size: <strong>${d.size}</strong></p>`;
}
function renderInfo() {
  if (state.sel) { infoBody.innerHTML = infoHTML(state.sel.id); return; }
  const disc = state.discovered[state.type].size, tot = LISTS[state.type].length;
  infoBody.innerHTML = `<p><strong>Tap any structure</strong> in the cell to highlight it and learn what it does.</p>
    <p>Drag to pan · scroll, pinch or use <strong>+ / −</strong> to zoom. Zoom in to reveal finer detail (cristae, nuclear pores, ribosomes, membrane bilayer).</p>
    <p class="meta">Discovered in this cell: <strong>${disc} / ${tot}</strong></p>`;
}
function renderLegend() {
  legendBody.innerHTML = LISTS[state.type].map((id) => {
    const n = infoFor(id, state.type).name.replace(/\s*\(.*\)/, "");
    return `<span><i style="background:${COL[id]}"></i>${n}</span>`;
  }).join("");
}

// ---------- quiz-hunt ----------
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function startHunt() {
  const ids = LISTS[state.type];
  let q = shuffle([...ids]);
  while (q.length < HUNT_N) q = q.concat(shuffle([...ids]).filter((id) => id !== q[q.length - 1]));
  Object.assign(hunt, { on: true, round: 0, score: 0, queue: q.slice(0, HUNT_N), pause: 0, done: false, elapsed: 0 });
  info.style.display = "none";
  nextRound(true);
}
function nextRound(first) {
  if (!first) hunt.round++;
  state.flash = null;
  if (hunt.round >= HUNT_N) { finishHunt(); return; }
  hunt.target = hunt.queue[hunt.round]; hunt.tries = 0; hunt.timeLeft = HUNT_TIME;
  renderHunt();
}
function finishHunt() {
  hunt.on = false; hunt.done = true; hunt.best = Math.max(hunt.best, hunt.score);
  toast(`🏁 Quiz-hunt finished: <b>${hunt.score}/${HUNT_N}</b> in ${Math.round(hunt.elapsed)} s`, 3500);
  renderHunt();
}
function renderHunt() {
  if (!hunt.on && !hunt.done) { huntBody.innerHTML = ""; return; }
  if (hunt.done) {
    const msg = hunt.score >= 8 ? "Excellent cell detective work!" : hunt.score >= 5 ? "Good effort — explore more, then try again." : "Switch to Explore mode, tap around to learn the organelles, then retry.";
    huntBody.innerHTML = `<div class="big">${hunt.score} / ${HUNT_N}</div><p>Time: <strong>${Math.round(hunt.elapsed)} s</strong> · Best: <strong>${hunt.best}/${HUNT_N}</strong></p><p>${msg}</p>`;
    const r = K.buttonRow(huntBody);
    K.button(r, "Play again", () => startHunt(), { kind: "primary" });
    K.button(r, "Back to Explore", () => setMode("explore"));
    return;
  }
  huntBody.innerHTML = `<p>Round <strong>${hunt.round + 1} / ${HUNT_N}</strong> · Score <strong>${hunt.score}</strong></p>
    <p>Find <strong>${HUNT_CLUE[hunt.target]}</strong>.</p>
    <p class="meta" style="font-size:.82rem;color:var(--ink-faint)">Tap it in the cell. ${HUNT_TRIES} tries and ${HUNT_TIME} s per round. Labels are hidden — pan and zoom to search.</p>`;
}
function flashHit(h, col) { state.flash = h ? { outline: h.outline, col, t0: performance.now() } : null; }
function revealTarget() {
  const a = cell().anchors(cam.x, cam.y).find((q) => q.id === hunt.target);
  if (a) {
    const h = cell().hit(a.x, a.y, 1 / 400);
    if (h && h.id === hunt.target) {
      flashHit(h, K.C.amber);
      const s = h.focus > 0 ? (Math.min(stage.w, stage.h) * 0.5) / h.focus : cam.s;
      easeTo(a.x, a.y, s);
    }
  }
  hunt.pause = 2.6;
}
function huntGuess(h) {
  if (!hunt.on || hunt.pause > 0 || !h) return;
  const name = infoFor(h.id, state.type).name;
  if (h.id === hunt.target) {
    hunt.score++; discover(h.id); flashHit(h, K.C.green);
    toast(`✅ Yes — that's the <b>${name}</b>!`);
    hunt.pause = 1.1;
  } else {
    hunt.tries++; flashHit(h, K.C.red);
    if (hunt.tries >= HUNT_TRIES) {
      toast(`❌ That's the <b>${name}</b>. Out of tries — here's the answer.`, 2600);
      revealTarget();
    } else toast(`❌ That's the <b>${name}</b>. Try again (${HUNT_TRIES - hunt.tries} left).`);
  }
  renderHunt();
}

// ---------- input: pan, pinch, wheel, tap, hover ----------
const ptrs = new Map();
let gest = null;
const ppos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  const p = ppos(e); ptrs.set(e.pointerId, p);
  if (ptrs.size === 1) gest = { mode: "pan", sx: p.x, sy: p.y, cx: cam.x, cy: cam.y, t0: performance.now(), moved: false };
  else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    gest = { mode: "pinch", d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), s0: cam.s, wm: toWorld((a.x + b.x) / 2, (a.y + b.y) / 2), moved: true };
  }
  state.hover = null; userMoved = true;
});
canvas.addEventListener("pointermove", (e) => {
  const p = ppos(e);
  if (ptrs.has(e.pointerId)) {
    ptrs.set(e.pointerId, p);
    if (gest && gest.mode === "pan" && ptrs.size === 1) {
      const dx = p.x - gest.sx, dy = p.y - gest.sy;
      if (!gest.moved && Math.hypot(dx, dy) > 7) { gest.moved = true; canvas.classList.add("grabbing"); }
      if (gest.moved) { cam.x = gest.cx - dx / cam.s; cam.y = gest.cy - dy / cam.s; clampCam(); tgt.active = false; }
    } else if (gest && gest.mode === "pinch" && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      cam.s = K.clamp(gest.s0 * (d / gest.d0), sMin(), S_MAX);
      cam.x = gest.wm.x - (mx - stage.w / 2) / cam.s; cam.y = gest.wm.y - (my - stage.h / 2) / cam.s;
      clampCam(); tgt.active = false;
    }
  } else if (e.pointerType === "mouse") {
    const w = toWorld(p.x, p.y);
    const h = cell().hit(w.x, w.y, 1 / cam.s);
    state.hover = h ? { id: h.id, x: p.x, y: p.y } : null;
    canvas.classList.toggle("pointing", !!h);
  }
});
const endPtr = (e, cancel) => {
  if (!ptrs.has(e.pointerId)) return;
  const p = ppos(e);
  ptrs.delete(e.pointerId);
  if (!cancel && gest && gest.mode === "pan" && !gest.moved && performance.now() - gest.t0 < 700) onTap(p.x, p.y);
  if (ptrs.size === 1) { const q = [...ptrs.values()][0]; gest = { mode: "pan", sx: q.x, sy: q.y, cx: cam.x, cy: cam.y, t0: 0, moved: true }; }
  else if (!ptrs.size) { gest = null; canvas.classList.remove("grabbing"); }
};
canvas.addEventListener("pointerup", (e) => endPtr(e, false));
canvas.addEventListener("pointercancel", (e) => endPtr(e, true));
canvas.addEventListener("pointerleave", () => { state.hover = null; });
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const p = ppos(e);
  const k = e.deltaMode === 1 ? 0.05 : e.ctrlKey ? 0.01 : 0.0018;
  zoomAt(p.x, p.y, Math.exp(-e.deltaY * k)); userMoved = true;
}, { passive: false });
canvas.addEventListener("keydown", (e) => {
  const step = 80 / cam.s;
  const map = {
    "+": () => easeTo(cam.x, cam.y, cam.s * 1.6), "=": () => easeTo(cam.x, cam.y, cam.s * 1.6),
    "-": () => easeTo(cam.x, cam.y, cam.s / 1.6), "_": () => easeTo(cam.x, cam.y, cam.s / 1.6),
    "0": () => fitView(),
    ArrowLeft: () => { cam.x -= step; }, ArrowRight: () => { cam.x += step; },
    ArrowUp: () => { cam.y -= step; }, ArrowDown: () => { cam.y += step; },
  };
  if (map[e.key]) { e.preventDefault(); tgt.active = false; map[e.key](); clampCam(); }
});

function onTap(sx, sy) {
  const w = toWorld(sx, sy);
  const h = cell().hit(w.x, w.y, 1 / cam.s);
  if (state.mode === "hunt") { huntGuess(h); return; }
  if (!h) { state.sel = null; renderInfo(); return; }
  select(h, true);
}

// ---------- background ----------
const motes = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: K.rand(0.6, 1.8), d: K.rand(0.01, 0.05), a: K.rand(0.08, 0.25) }));
function drawBackground() {
  K.backdrop(ctx, stage.w, stage.h, BG_TINT[state.type]);
  ctx.fillStyle = "#9fd8ff";
  for (const m of motes) {
    const x = (((m.x * stage.w - cam.x * cam.s * m.d) % stage.w) + stage.w) % stage.w;
    const y = (((m.y * stage.h - cam.y * cam.s * m.d) % stage.h) + stage.h) % stage.h;
    ctx.globalAlpha = m.a; ctx.beginPath(); ctx.arc(x, y, m.r, 0, K.TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---------- labels with leader lines ----------
function drawLabels() {
  // Two tidy columns (left / right) with leader lines, like a textbook diagram.
  const W = stage.w, H = stage.h, top = 54, bottom = H - 40;
  ctx.font = "600 12px Inter, system-ui, sans-serif";
  const items = [];
  for (const a of cell().anchors(cam.x, cam.y)) {
    const p = toScreen(a.x, a.y);
    if (p.x < 4 || p.x > W - 4 || p.y < 4 || p.y > H - 4) continue;
    const name = infoFor(a.id, state.type).name.replace(/\s*\(.*\)/, "");
    items.push({ id: a.id, p, name, w: ctx.measureText(name).width + 12 });
  }
  const cols = [items.filter((q) => q.p.x < W / 2), items.filter((q) => q.p.x >= W / 2)];
  // keep columns balanced
  while (cols[0].length > cols[1].length + 2) { cols[0].sort((a, b) => b.p.x - a.p.x); cols[1].push(cols[0].shift()); }
  while (cols[1].length > cols[0].length + 2) { cols[1].sort((a, b) => a.p.x - b.p.x); cols[0].push(cols[1].shift()); }
  const gap = 23;
  cols.forEach((col, side) => {
    col.sort((a, b) => a.p.y - b.p.y);
    let prev = -Infinity;
    for (const q of col) { q.y = Math.max(K.clamp(q.p.y, top, bottom), prev + gap); prev = q.y; }
    let next = Infinity;
    for (let i = col.length - 1; i >= 0; i--) { col[i].y = Math.min(col[i].y, bottom, next - gap); next = col[i].y; }
    for (const q of col) {
      const lx = side === 0 ? 10 : W - 60 - q.w;           // label box left edge
      const ex = side === 0 ? lx + q.w : lx;                // leader end
      ctx.strokeStyle = K.withAlpha(COL[q.id], 0.75); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(q.p.x, q.p.y);
      ctx.lineTo(ex + (side === 0 ? 10 : -10), q.y); ctx.lineTo(ex, q.y); ctx.stroke();
      ctx.fillStyle = COL[q.id]; ctx.beginPath(); ctx.arc(q.p.x, q.p.y, 3, 0, K.TAU); ctx.fill();
      K.label(ctx, q.name, lx + 6, q.y, { size: 12, align: "left", color: K.C.ink });
    }
  });
}
// ---------- scale bar ----------
function niceLen(s) {
  const target = 110 / s, pow = Math.pow(10, Math.floor(Math.log10(target)));
  for (const m of [5, 2, 1]) if (m * pow <= target) return m * pow;
  return pow;
}
const fmtLen = (um) => (um >= 1 ? `${+um.toFixed(um < 10 ? 1 : 0)} µm` : `${Math.round(um * 1000)} nm`);
function drawScaleBar() {
  const len = niceLen(cam.s), px = len * cam.s, x = 16, y = stage.h - 22;
  ctx.fillStyle = "rgba(5,11,22,0.7)";
  K.roundRect(ctx, x - 8, y - 22, px + 16, 34, 8); ctx.fill();
  ctx.strokeStyle = K.C.ink; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4); ctx.moveTo(x, y); ctx.lineTo(x + px, y); ctx.moveTo(x + px, y - 4); ctx.lineTo(x + px, y + 4); ctx.stroke();
  ctx.fillStyle = K.C.ink; ctx.font = "600 12px Inter, system-ui, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillText(fmtLen(len), x, y - 8);
}

// ---------- what's happening ----------
let explainKey = "";
function zoomTier() {
  const s = cam.s;
  if (state.type === "bacteria") return s < fitScale() * 0.55 ? 0 : s < 700 ? 1 : 2;
  return s < 40 ? 0 : s < 150 ? 1 : s < 600 ? 2 : 3;
}
function updateExplain() {
  const tier = zoomTier();
  const key = [state.type, state.mode, tier, state.sel && state.sel.id, hunt.on].join("|");
  if (key === explainKey) return;
  explainKey = key;
  const base = {
    animal: `An <strong>animal cell</strong> (about 20 µm across). It is <strong>eukaryotic</strong>: its DNA is enclosed in a <strong>nucleus</strong> and it has many <strong>membrane-bound organelles</strong>. Watch <strong>vesicles</strong> carry proteins from the <strong>rough ER</strong> (blue) → <strong>Golgi</strong> → along microtubules to the cell membrane, where they are released by <strong>exocytosis</strong>.`,
    plant: `A <strong>plant cell</strong> (here about 36 × 25 µm). Like animal cells it is <strong>eukaryotic</strong>, but it also has a <strong>cellulose cell wall</strong>, <strong>chloroplasts</strong> and a <strong>large central vacuole</strong> that squeezes the cytoplasm into a thin layer. Organelles circle the vacuole by <strong>cytoplasmic streaming</strong> — myosin motor proteins drag them along actin filaments.`,
    bacteria: `A <strong>bacterium</strong> (about 2 µm long — roughly 10× shorter than the animal cell; watch the scale bar). It is a <strong>prokaryote</strong>: <strong>no nucleus</strong> and no membrane-bound organelles. Its single circular chromosome lies in the <strong>nucleoid</strong>, extra genes sit on <strong>plasmids</strong>, and smaller <strong>70S ribosomes</strong> fill the cytoplasm. The <strong>flagellum</strong> is spun by a rotary motor.`,
  }[state.type];
  const zoom = state.type === "bacteria"
    ? ["<strong>Zoomed out:</strong> the dashed circle is a typical animal cell drawn to the same scale — bacteria are tiny!",
      "<strong>Cell view:</strong> the dots are <strong>ribosomes</strong> (~20 nm). Notice they are mostly kept out of the tangled DNA of the nucleoid.",
      "<strong>Molecular zoom:</strong> the envelope resolves into the <strong>peptidoglycan wall</strong> and the phospholipid <strong>bilayer</strong> of the membrane; at the pole sits the flagellar motor."][tier]
    : ["<strong>Low zoom:</strong> you see whole organelles. Zoom in to reveal finer detail.",
      "<strong>Medium zoom:</strong> mitochondrial <strong>cristae</strong>, <strong>nuclear pores</strong>, chloroplast <strong>grana</strong> and tiny ribosome dots appear.",
      "<strong>High zoom:</strong> individual <strong>ribosomes</strong> (~25 nm) stud the rough ER; ribosomes in chains on one mRNA are called polysomes.",
      "<strong>Molecular zoom:</strong> the cell membrane is a phospholipid <strong>bilayer</strong> only ~8 nm thick. The faint specks show how crowded the cytoplasm is with protein molecules."][tier];
  let mode = "";
  if (state.mode === "hunt") mode = `<p><strong>Quiz-hunt:</strong> read the clue in the banner and tap that structure. Labels are hidden.</p>`;
  else if (state.sel) mode = `<p>Selected: <strong>${infoFor(state.sel.id, state.type).name}</strong> — see the card below.</p>`;
  explainBody.innerHTML = `<p>${base}</p><p>${zoom}</p>${mode}<p class="note">Simplified: a 2D slice with fewer organelles than a real cell; very small parts are drawn at a minimum visible size when zoomed out, and movement is slowed down (real bacterial flagella spin more than 100 times per second).</p>`;
}

// ---------- main loop ----------
let view = null, lastReal = performance.now();
const L = K.loop((dt, t) => {
  if (!stageReady()) return;
  const now = performance.now(), rdt = Math.min((now - lastReal) / 1000, 0.05); lastReal = now;
  // camera easing (runs even while paused)
  if (tgt.active) {
    const k = 1 - Math.exp(-rdt * 4.5);
    cam.x += (tgt.x - cam.x) * k; cam.y += (tgt.y - cam.y) * k;
    cam.s = Math.exp(Math.log(cam.s) + (Math.log(tgt.s) - Math.log(cam.s)) * k);
    if (Math.abs(Math.log(tgt.s / cam.s)) < 0.002 && Math.hypot(tgt.x - cam.x, tgt.y - cam.y) * cam.s < 0.5) tgt.active = false;
  }
  clampS(); clampCam();
  if (state.trans < 1) state.trans = Math.min(1, state.trans + rdt / 1.1);
  const showPrev = state.prev && state.trans < 1;

  // simulation
  cell().update(dt, t);
  if (showPrev) CELLS[state.prev].update(dt, t);

  // hunt timer (real time)
  if (hunt.on) {
    hunt.elapsed += rdt;
    if (hunt.pause > 0) { hunt.pause -= rdt; if (hunt.pause <= 0) nextRound(false); }
    else {
      hunt.timeLeft -= rdt;
      if (hunt.timeLeft <= 0) { toast("⏱ Time's up — here's the answer."); hunt.tries = HUNT_TRIES; revealTarget(); }
    }
  }

  // draw
  const dpr = stage.dpr, W = stage.w, H = stage.h, s = cam.s;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBackground();
  view = { x0: cam.x - W / 2 / s, x1: cam.x + W / 2 / s, y0: cam.y - H / 2 / s, y1: cam.y + H / 2 / s, s, px: 1 / s };
  ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (W / 2 - cam.x * s), dpr * (H / 2 - cam.y * s));
  const e = K.easeInOut(state.trans);
  if (showPrev) CELLS[state.prev].draw(ctx, view, t, 1 - e);
  cell().draw(ctx, view, t, showPrev ? e : 1);
  ctx.globalAlpha = 1;

  // highlight glow outline
  const hl = state.flash && performance.now() - state.flash.t0 < 2600 ? state.flash
    : state.sel && state.sel.cellType === state.type && state.mode === "explore" ? { outline: state.sel.outline, col: K.C.amber } : null;
  if (hl) {
    const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 260);
    ctx.save();
    ctx.beginPath(); hl.outline(ctx);
    ctx.shadowColor = hl.col; ctx.shadowBlur = 16;
    ctx.globalAlpha = pulse; ctx.strokeStyle = hl.col; ctx.lineWidth = 3 / s; ctx.lineJoin = "round"; ctx.stroke();
    ctx.shadowBlur = 0; ctx.globalAlpha = 0.6 * pulse; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1 / s; ctx.stroke();
    ctx.restore();
  }

  // screen-space overlays
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (state.type === "bacteria" && s < fitScale() * 0.55) {
    const c = toScreen(0, 0), rr = 10 * s;
    ctx.save(); ctx.setLineDash([6, 6]); ctx.strokeStyle = "rgba(232,241,255,0.55)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(c.x, c.y, rr, 0, K.TAU); ctx.stroke(); ctx.restore();
    K.label(ctx, "Typical animal cell (~20 µm) — same scale", c.x, Math.max(56, c.y - rr - 14), { size: 12, color: K.C.inkDim });
  }
  if (state.labels && state.mode === "explore") drawLabels();
  else if (state.hover && state.mode === "explore") {
    K.label(ctx, infoFor(state.hover.id, state.type).name, state.hover.x + 14, state.hover.y - 18, { align: "left", size: 12 });
  } else if (state.sel && state.mode === "explore" && state.sel.cellType === state.type && !state.labels) {
    const p = toScreen(state.sel.x, state.sel.y);
    if (p.x > 0 && p.x < W && p.y > 0 && p.y < H) K.label(ctx, infoFor(state.sel.id, state.type).name, p.x, Math.max(52, p.y - 26), { size: 13, color: K.C.amber });
  }
  drawScaleBar();

  // chips & panel text
  const fitS = fitScale();
  chipType(`Cell <b>${TYPE_NAME[state.type]}</b> · ${state.type === "bacteria" ? "prokaryote" : "eukaryote"}`);
  chipZoom(`Zoom <b>×${(s / fitS).toFixed(s / fitS < 10 ? 1 : 0)}</b> · 1 px ≈ <b>${1000 / s >= 1000 ? (1 / s).toFixed(1) + " µm" : (1000 / s >= 10 ? Math.round(1000 / s) : (1000 / s).toFixed(1)) + " nm"}</b>`);
  chipDisc(`Discovered <b>${state.discovered[state.type].size} / ${LISTS[state.type].length}</b>`);
  if (hunt.on) {
    chipHuntEl.style.display = "";
    chipHunt(`Hunt <b>${Math.min(hunt.round + 1, HUNT_N)}/${HUNT_N}</b> · score <b>${hunt.score}</b>`);
    banner.style.display = "";
    const clue = HUNT_CLUE[hunt.target], tm = `⏱ ${Math.max(0, Math.ceil(hunt.timeLeft))} s · tries left ${HUNT_TRIES - hunt.tries}`;
    if (bClue.textContent !== clue) bClue.textContent = clue;
    if (bTimer.textContent !== tm) bTimer.textContent = tm;
    bBar.style.width = `${(Math.max(0, hunt.timeLeft) / HUNT_TIME) * 100}%`;
  } else { chipHuntEl.style.display = "none"; banner.style.display = "none"; }
  updateExplain();
  missions.update();
});
L.speed = speedS.value;

renderInfo();
renderLegend();
