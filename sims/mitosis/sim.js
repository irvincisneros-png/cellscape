// CellScape · Cell Division: Mitosis
// A 2n = 4 animal cell (two homologous pairs) moves through interphase (G1 → S → G2), mitosis and
// cytokinesis. Watch mode = auto-play + scrubbable timeline. Do-it-yourself mode = the learner
// replicates DNA, aligns chromosomes, pulls the poles apart and closes the cleavage furrow.
// All model geometry is in "cell units" (1 = parent cell radius R), converted to pixels at draw time.
import * as K from "../../assets/js/kit.js";

const { C, clamp, lerp, easeInOut, easeOut, TAU } = K;
const PI = Math.PI;

const stageEl = K.$("#stage");
const panel = K.$("#panel");
const overlay = K.$("#overlay");
const canvas = K.$("#canvas");
const stage = K.createStage(canvas);
const { ctx } = stage;
const toast = K.toaster(stageEl);
const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------------------------------------------------------------- phases
const PH = [
  { key: "G1", name: "Interphase · G1", short: "G1", dur: 4 },
  { key: "S", name: "Interphase · S phase", short: "S", dur: 5 },
  { key: "G2", name: "Interphase · G2", short: "G2", dur: 3 },
  { key: "pro", name: "Prophase", short: "Pro", dur: 5 },
  { key: "prometa", name: "Prometaphase", short: "PM", dur: 6 },
  { key: "meta", name: "Metaphase", short: "Meta", dur: 4 },
  { key: "ana", name: "Anaphase", short: "Ana", dur: 4 },
  { key: "telo", name: "Telophase", short: "Telo", dur: 5 },
  { key: "cyto", name: "Cytokinesis", short: "Cyto", dur: 5 },
  { key: "done", name: "Daughter cells (G1)", short: "G1", dur: 3, label: "G1" },
];
let acc = 0;
for (const p of PH) { p.start = acc; acc += p.dur; p.end = acc; }
const TOTAL = acc;
const I = Object.fromEntries(PH.map((p, i) => [p.key, i]));
const phaseAt = (T) => { for (let i = PH.length - 1; i >= 0; i--) if (T >= PH[i].start) return i; return 0; };
const GATE_PM = PH[I.prometa].start + 0.5 * PH[I.prometa].dur; // DIY: chromosomes become draggable
const GATE_META = PH[I.meta].start + 0.5 * PH[I.meta].dur;     // DIY: wait for the learner to pull

// ---------------------------------------------------------------- karyotype (2n = 4)
// Pair 1 = long, metacentric. Pair 2 = short, submetacentric. Pink = maternal, blue = paternal.
const CHR = [
  { pair: 1, mat: true, len: 0.26, cpos: 0.5, col: C.pink, home: [-0.17, -0.1], hAng: 0.6, scat: [-0.44, -0.34], sAng: 2.2, tilt: 0.08, seed: 1.3 },
  { pair: 1, mat: false, len: 0.26, cpos: 0.5, col: C.blue, home: [0.14, 0.12], hAng: 2.4, scat: [0.38, 0.3], sAng: 0.9, tilt: -0.06, seed: 4.1 },
  { pair: 2, mat: true, len: 0.16, cpos: 0.33, col: C.pink, home: [0.13, -0.17], hAng: -0.5, scat: [0.42, -0.36], sAng: -1.0, tilt: 0.1, seed: 7.7 },
  { pair: 2, mat: false, len: 0.16, cpos: 0.33, col: C.blue, home: [-0.13, 0.17], hAng: 1.9, scat: [-0.36, 0.4], sAng: 0.3, tilt: -0.1, seed: 2.9 },
];
for (const c of CHR) { c.dark = K.shade(c.col, -0.45); c.light = K.shade(c.col, 0.55); }
const SLOT_Y = [-0.42, -0.14, 0.14, 0.42];
const WATCH_SLOT = [0, 2, 1, 3];
const ND_CHR = 0; // chromosome whose sister chromatids fail to separate when nondisjunction is on
const HAPLOID = CHR[0].len + CHR[2].len; // DNA of one set = 1C
const RN = 0.46; // parent nucleus radius
const RN2 = 0.34; // daughter nucleus radius
const RD = 0.75; // daughter cell radius after rounding up

// ---------------------------------------------------------------- state
const S = {
  mode: "watch", T: 0, mutation: false, ndL: false, labels: true, graph: true,
  flags: { sac: false, divided: false, identical: false, ndCounted: false },
  countAnswered: false,
};
let diy;
function resetDiy() {
  diy = {
    rep: [0, 0, 0, 0], repOn: [false, false, false, false],
    pos: CHR.map((c) => ({ x: c.scat[0], y: c.scat[1], ang: c.sAng })),
    slot: [-1, -1, -1, -1], occ: [-1, -1, -1, -1],
    drag: null, poleDrag: null, furrowDrag: false, hold: false, btnHold: false,
    sep: 0, furrow: 0,
  };
}
resetDiy();
let scrubbing = false;
const allRep = () => diy.rep.every((r) => r >= 1);
const meanRep = () => diy.rep.reduce((a, b) => a + b, 0) / 4;
const nAligned = () => diy.slot.filter((s) => s >= 0).length;
const allAligned = () => nAligned() === 4;
const slotOf = (i) => (S.mode === "diy" && diy.slot[i] >= 0 ? diy.slot[i] : WATCH_SLOT[i]);

// ---------------------------------------------------------------- helpers
const lerpAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
const L = { cx: 0, cy: 0, R: 100, cw: 6 };
const X = (u) => L.cx + u * L.R;
const Y = (v) => L.cy + v * L.R;

// ---------------------------------------------------------------- pose: everything derived from T
let pose = null;
function computePose(t) {
  const T = S.T, k = phaseAt(T), ph = PH[k];
  const p = clamp((T - ph.start) / ph.dur, 0, 1);
  const o = { k, key: ph.key, p, ph };
  const diyMode = S.mode === "diy";
  o.rep = CHR.map((c, i) => diyMode ? diy.rep[i] : (k < I.S ? 0 : k === I.S ? clamp((p - 0.08 - i * 0.14) / 0.4, 0, 1) : 1));
  o.cond = k < I.pro ? (k === I.G2 ? 0.06 * p : 0) : k === I.pro ? easeInOut(p) : k < I.telo ? 1 : k === I.telo ? 1 - easeInOut(clamp(p / 0.85, 0, 1)) : 0;
  o.env = k < I.prometa ? 1 : k === I.prometa ? 1 - clamp(p / 0.3, 0, 1) : 0;
  o.nucleolus = k < I.pro ? 1 : k === I.pro ? 1 - clamp(p / 0.6, 0, 1) : 0;
  o.ref = k < I.telo ? 0 : k === I.telo ? clamp((p - 0.25) / 0.65, 0, 1) : 1;
  o.nucleolus2 = k < I.telo ? 0 : k === I.telo ? clamp((p - 0.6) / 0.4, 0, 1) : 1;
  o.dup = k < I.S ? 0 : k === I.S ? easeInOut(clamp((p - 0.3) / 0.5, 0, 1)) : 1;
  o.sg = k < I.pro ? 0 : k === I.pro ? clamp((p - 0.25) / 0.75, 0, 1) : k < I.telo ? 1 : k === I.telo ? 1 - clamp(p / 0.8, 0, 1) : 0;
  o.mig = k < I.pro ? 0 : k === I.pro ? easeInOut(clamp(p / 0.85, 0, 1)) : 1;
  o.attach = CHR.map((c, i) => k < I.prometa ? 0 : k === I.prometa ? clamp((p - 0.12 - 0.05 * i) / 0.18, 0, 1) : 1);
  o.kmt = k < I.telo ? 1 : k === I.telo ? 1 - clamp(p / 0.4, 0, 1) : 0;
  o.s = k < I.ana ? 0 : k === I.ana ? (diyMode ? p : easeInOut(p)) : 1;
  o.e = k < I.ana ? 0 : k === I.ana ? 0.6 * o.s : k === I.telo ? 0.6 + 0.4 * easeInOut(p) : 1;
  o.f = k < I.telo ? 0 : k === I.telo ? 0.12 * p : k === I.cyto ? 0.12 + 0.88 * (diyMode ? p : easeInOut(p)) : 1;
  o.split = k === I.done;
  o.g = o.split ? 0.14 * easeInOut(p) : 0;
  o.round = o.split ? easeInOut(p) : 0;
  o.grow = k === I.G1 ? lerp(0.9, 1, easeInOut(p)) : 1; // G1 growth
  o.a = (1 + 0.3 * o.e) * o.grow;
  o.b = (1 - 0.12 * o.e) * o.grow;
  o.dcx = o.a / 2 + o.g; // daughter-centre distance from middle

  // centrosomes / spindle poles
  let poleR;
  if (k < I.pro) poleR = 0.6;
  else if (k === I.pro) poleR = lerp(0.6, 0.8, easeInOut(clamp((p - 0.35) / 0.65, 0, 1)));
  else if (k < I.ana) poleR = 0.8;
  else if (k === I.ana) poleR = 0.8 + 0.22 * o.s;
  else poleR = 1.02;
  const a0 = lerp(-2.05, -PI, o.mig), a1 = lerp(lerp(-2.05, -1.72, o.dup), 0, o.mig);
  o.c0 = [Math.cos(a0) * poleR, Math.sin(a0) * poleR];
  o.c1 = [Math.cos(a1) * poleR, Math.sin(a1) * poleR];
  if (o.split) {
    o.c0 = [lerp(o.c0[0] - o.g, -o.dcx - 0.42, o.round), lerp(o.c0[1], -0.24, o.round)];
    o.c1 = [lerp(o.c1[0] + o.g, o.dcx + 0.42, o.round), lerp(o.c1[1], -0.24, o.round)];
  }
  o.sis = CHR.map((c, i) => sisterPoses(o, i, t));
  return o;
}

function sisterPoses(o, i, t) {
  const c = CHR[i], k = o.k, p = o.p;
  const plateA = -PI / 2 + c.tilt;
  const sy = SLOT_Y[slotOf(i)];
  const diyMode = S.mode === "diy";
  const dragging = diy.drag && diy.drag.i === i;
  let x, y, ang;
  if (k < I.prometa) {
    const sp = k === I.pro ? 1 + 0.15 * easeInOut(p) : 1;
    x = c.home[0] * sp; y = c.home[1] * sp;
    ang = c.hAng + (k === I.pro ? 0.3 * easeInOut(p) : 0);
  } else if (k === I.prometa) {
    const q1 = easeInOut(clamp((p - 0.05) / 0.45, 0, 1));
    x = lerp(c.home[0] * 1.15, c.scat[0], q1); y = lerp(c.home[1] * 1.15, c.scat[1], q1);
    ang = lerpAngle(c.hAng + 0.3, c.sAng, q1);
    if (p >= 0.5) {
      if (diyMode) { x = diy.pos[i].x; y = diy.pos[i].y; ang = diy.pos[i].ang; }
      else {
        const q2 = easeInOut((p - 0.5) / 0.5);
        x = lerp(c.scat[0], 0, q2); y = lerp(c.scat[1], sy, q2); ang = lerpAngle(c.sAng, plateA, q2);
      }
    }
    if (!dragging && !(diyMode && diy.slot[i] >= 0)) {
      x += 0.014 * Math.sin(t * 1.7 + c.seed * 3); y += 0.011 * Math.cos(t * 1.3 + c.seed);
    }
  } else {
    if (k === I.meta && diyMode) { x = diy.pos[i].x; y = diy.pos[i].y; ang = diy.pos[i].ang; }
    else { x = 0; y = sy; ang = plateA; }
    if (k === I.meta && !dragging) x += 0.008 * Math.sin(t * 2.2 + c.seed);
  }
  const rep = o.rep[i];
  const gh = rep > 0 ? lerp(0.016, 0.03, o.cond) * Math.min(1, rep * 5) : 0;
  const px = Math.cos(ang + PI / 2), py = Math.sin(ang + PI / 2);
  const s0 = { x: x - px * gh, y: y - py * gh, a1: ang, a2: ang + PI, frac: 1, side: -1 };
  const s1 = { x: x + px * gh, y: y + py * gh, a1: ang, a2: ang + PI, frac: rep, side: 1 };
  if (k < I.ana || o.s <= 0) return { joined: rep > 0, cx: x, cy: y, ang, list: [s0, s1] };

  // anaphase onwards: each sister chromatid (now a chromosome) heads to a pole
  const nd = S.ndL && i === ND_CHR;
  const list = [];
  [s0, s1].forEach((sp, kk) => {
    const side = nd ? -1 : kk === 0 ? -1 : 1;
    const sA = nd ? Math.pow(o.s, 1.5) : o.s; // the stuck pair lags behind
    let tx = side * 0.78, ty = sy * 0.45;
    if (nd) tx += kk === 0 ? -gh : gh;
    let xx = lerp(sp.x, tx, sA), yy = lerp(sp.y, ty, sA);
    const dirS = side < 0 ? 1 : -1, tr = side < 0 ? 0 : PI;
    const bend = easeOut(clamp(o.s * 2.2, 0, 1));
    let a1 = lerpAngle(ang, tr - 0.38 * dirS, bend), a2 = lerpAngle(ang + PI, tr + 0.38 * dirS, bend);
    if (k >= I.telo) {
      const q = k === I.telo ? easeInOut(clamp(p / 0.9, 0, 1)) : 1;
      let hx = c.home[0] * 0.72, hy = c.home[1] * 0.72;
      if (nd && kk === 1) { hx += 0.13; hy += 0.06; }
      let dcx = side * o.dcx;
      xx = lerp(xx, dcx + hx, q); yy = lerp(yy, hy, q);
      a1 = lerpAngle(a1, c.hAng, q); a2 = lerpAngle(a2, c.hAng + PI, q);
    }
    list.push({ x: xx, y: yy, a1, a2, frac: 1, side });
  });
  return { joined: nd && k === I.ana, cx: (list[0].x + list[1].x) / 2, cy: (list[0].y + list[1].y) / 2, ang, list };
}

// ---------------------------------------------------------------- panel
const explain = K.card(panel, "What's happening", "explain");
const explainBody = document.createElement("div");
explainBody.setAttribute("aria-live", "polite");
explain.appendChild(explainBody);

const countCard = K.card(panel, "Count the chromosomes", "countcard");
countCard.hidden = true;
countCard.insertAdjacentHTML("beforeend", `<p>Nondisjunction happened! Count the chromosomes (centromeres) in each daughter cell. <strong>Left</strong> and <strong>right</strong> have…</p><div class="opts"></div><div class="fb"></div>`);
{
  const opts = countCard.querySelector(".opts"), fb = countCard.querySelector(".fb");
  const choices = ["4 and 4", "5 and 3", "3 and 5", "8 and 0"];
  choices.forEach((txt, j) => {
    K.button(opts, txt, () => {
      if (j === 1) {
        fb.innerHTML = "✅ Correct. The left cell is <strong>2n + 1 = 5</strong> (three copies of chromosome 1, trisomy) and the right cell is <strong>2n − 1 = 3</strong> (only one copy of chromosome 1, monosomy). Both are <strong>aneuploid</strong>.";
        S.countAnswered = true; S.flags.ndCounted = true;
      } else {
        fb.innerHTML = "❌ Not quite. Count the centromeres in each daughter. The sister chromatids of the long pink chromosome both went to the <strong>left</strong> pole.";
      }
    });
  });
}

const controls = K.card(panel, "Controls");
K.segmented(controls, [{ value: "watch", label: "Watch" }, { value: "diy", label: "Do it yourself" }], "watch", (v) => setMode(v));
const row = K.buttonRow(controls);
const pauseBtn = K.button(row, "Pause", () => {
  if (S.mode === "watch" && S.T >= TOTAL) { S.T = 0; L_.running = true; }
  else L_.toggle();
  pauseBtn.textContent = L_.running ? "Pause" : "Play";
});
K.button(row, "Reset", () => reset());
const actRow = K.buttonRow(controls);
actRow.classList.add("act-row");
const actBtn = K.button(actRow, "Start anaphase", null, { kind: "primary" });
K.slider(controls, {
  label: "Speed", min: 0.25, max: 3, step: 0.25, value: reduceMotion ? 0.5 : 1,
  format: (v) => `${v}×`, onInput: (v) => { L_.speed = v; },
});
K.checkbox(controls, "Mutation: nondisjunction (one chromosome's sisters fail to separate)", false, (v) => {
  S.mutation = v;
  if (S.T >= PH[I.ana].start) toast("Nondisjunction takes effect at the next anaphase. Press Reset (or scrub back) to see it.", 3600);
  else if (v) toast("Nondisjunction on: watch the long pink chromosome at anaphase.");
});
K.checkbox(controls, "Show labels", true, (v) => { S.labels = v; });
K.checkbox(controls, "Show DNA graph", true, (v) => { S.graph = v; });

const legend = K.card(panel, "Legend");
legend.insertAdjacentHTML("beforeend", `<div class="legend">
  <span><i style="background:${C.pink}"></i>Maternal chromosome</span>
  <span><i style="background:${C.blue}"></i>Paternal chromosome</span>
  <span><i style="background:${C.amber}"></i>Centrosome</span>
  <span><i class="bar" style="background:${C.teal}"></i>Spindle microtubules</span>
  <span><i style="background:${C.violet}"></i>Nuclear envelope</span>
  <span><i style="background:${C.red}"></i>Contractile ring</span>
  <span class="wide">Long = homologous pair 1 · short = pair 2. 2n = 4.</span>
</div>`);

const M = K.missions(panel, [
  { text: "Do it yourself: replicate all 4 chromosomes in S phase", check: () => S.mode === "diy" && allRep() },
  { text: "Try to start anaphase early and get stopped by the spindle assembly checkpoint", check: () => S.flags.sac },
  { text: "Drag all 4 chromosomes onto the metaphase plate", check: () => S.mode === "diy" && allAligned() },
  { text: "Complete a division into two daughter cells (either mode)", check: () => S.flags.divided },
  { text: "Divide a cell yourself into two genetically identical daughter cells", check: () => S.flags.identical },
  { text: "Stretch: turn on nondisjunction, divide the cell, then count the chromosomes in each daughter", check: () => S.flags.ndCounted },
], (m) => toast(`Mission complete: ${m.text}`, 3200));

K.quiz(panel, [
  {
    q: "Which is the correct order of the phases of mitosis?",
    options: ["Prophase → Prometaphase → Metaphase → Anaphase → Telophase", "Prophase → Metaphase → Prometaphase → Telophase → Anaphase", "Metaphase → Prophase → Anaphase → Telophase → Prometaphase", "Anaphase → Metaphase → Prophase → Telophase → Prometaphase"],
    answer: 0,
    why: "Chromosomes condense (prophase), attach to the spindle (prometaphase), line up (metaphase), separate (anaphase) and arrive at the poles as nuclei re-form (telophase). Cytokinesis then splits the cytoplasm.",
  },
  {
    q: "What happens during S phase of interphase?",
    options: ["The chromosome number doubles from 4 to 8", "DNA is replicated, so each chromosome becomes two identical sister chromatids", "Chromosomes line up on the metaphase plate", "The cytoplasm divides in two"],
    answer: 1,
    why: "DNA content doubles (2C → 4C) but the chromosome number stays at 4 — each chromosome now has two sister chromatids joined at one centromere.",
  },
  {
    q: "At metaphase this cell has 4 chromosomes. How many chromatids does it have?",
    options: ["2", "4", "8", "16"],
    answer: 2,
    why: "Each replicated chromosome is made of 2 sister chromatids, so 4 × 2 = 8. Count chromosomes by centromeres, chromatids by DNA molecules.",
  },
  {
    q: "Which of these is NOT a purpose of mitosis?",
    options: ["Growth of a multicellular organism", "Repair and replacement of damaged cells", "Asexual reproduction (e.g. yeast budding, plant cuttings)", "Making gametes with half the chromosome number"],
    answer: 3,
    why: "Gametes are made by meiosis, which halves the chromosome number. Mitosis keeps the chromosome number the same.",
  },
  {
    q: "Compared with the parent cell, the two daughter cells produced by mitosis are…",
    options: ["Genetically identical and diploid (2n)", "Genetically different and haploid (n)", "Genetically identical but haploid (n)", "Genetically different but diploid (2n)"],
    answer: 0,
    why: "Each daughter receives one sister chromatid of every chromosome, so both get an identical full diploid set (2n = 4 here).",
  },
  {
    q: "Why does the spindle assembly checkpoint delay anaphase until every chromosome is attached and aligned?",
    options: ["To give time for DNA replication", "So each daughter cell receives exactly one copy of every chromosome", "To let the nuclear envelope re-form", "So the cell can grow bigger"],
    answer: 1,
    why: "If anaphase started with a chromosome unattached, both sisters could end up in one cell (nondisjunction), giving aneuploid daughters.",
  },
]);

// chips
const chipPhase = K.chip(overlay);
const chipChr = K.chip(overlay);
const chipCt = K.chip(overlay);
const chipDNA = K.chip(overlay);

// ---------------------------------------------------------------- mode / reset
function reset() {
  S.T = 0; resetDiy(); S.countAnswered = false; scrubbing = false;
  countCard.hidden = true; countCard.querySelector(".fb").innerHTML = "";
  L_.running = true; pauseBtn.textContent = "Pause";
  lastExplainKey = "";
}
function setMode(m) {
  S.mode = m; reset();
  toast(m === "diy" ? "Do it yourself: you'll copy the DNA, line up the chromosomes, pull them apart and pinch the cell in two." : "Watch mode: drag the timeline to scrub through the cell cycle.", 3600);
}

// ---------------------------------------------------------------- DIY actions
function attemptPull() {
  if (!allAligned()) {
    S.flags.sac = true;
    toast(`<strong>Spindle assembly checkpoint — anaphase blocked!</strong> ${4 - nAligned()} of 4 chromosomes aren't aligned on the metaphase plate yet. The checkpoint waits until every kinetochore is attached and under tension, so each daughter gets exactly one copy of every chromosome.`, 6000);
    return false;
  }
  return true;
}
function replicateNearest(ux, uy) {
  let best = -1, bd = 1e9;
  CHR.forEach((c, i) => {
    if (diy.repOn[i]) return;
    const d = Math.hypot(c.home[0] - ux, c.home[1] - uy);
    if (d < bd) { bd = d; best = i; }
  });
  if (best >= 0) {
    diy.repOn[best] = true;
    const n = diy.repOn.filter(Boolean).length;
    toast(n === 1 ? "Copying! DNA polymerase builds a matching <strong>sister chromatid</strong> along the chromosome." : `Copying chromosome ${n} of 4…`);
  }
}
const gateState = () => {
  if (S.mode !== "diy") return "watch";
  const k = pose ? pose.k : 0;
  if (k === I.G1) return "G1";
  if (k === I.S && !allRep()) return "rep";
  if (k === I.prometa && S.T >= GATE_PM - 1e-6 && !allAligned()) return "align";
  if (k === I.meta && diy.sep <= 0) return S.T >= GATE_META - 0.01 ? "pull" : "meta";
  if (k === I.ana && diy.sep < 1) return "pull";
  if (k === I.cyto && diy.furrow < 1) return "pinch";
  if (k === I.done) return "done";
  return "auto";
};

// action button (click for one-shot actions, press-and-hold for pulling / pinching)
const startHold = () => {
  const g = gateState();
  if (g === "pull" || g === "meta") { if (attemptPull()) { diy.btnHold = true; actBtn.classList.add("holding"); } }
  else if (g === "pinch") { diy.btnHold = true; actBtn.classList.add("holding"); }
};
const endHold = () => { diy.btnHold = false; actBtn.classList.remove("holding"); };
actBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); startHold(); });
actBtn.addEventListener("pointerup", endHold);
actBtn.addEventListener("pointerleave", endHold);
actBtn.addEventListener("pointercancel", endHold);
actBtn.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); startHold(); oneShot(); } });
actBtn.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") endHold(); });
actBtn.addEventListener("click", (e) => { if (e.detail !== 0) oneShot(); }); // pointer clicks only
function oneShot() {
  const g = gateState();
  if (g === "rep") replicateNearest(0, 0);
  else if (g === "align") attemptPull();
  else if (g === "G1") toast("Not yet — DNA is only copied in <strong>S phase</strong>. Let G1 finish.");
}
function updateActBtn() {
  const g = gateState();
  let txt = "Start anaphase", dis = false;
  if (g === "watch") { txt = "Switch to Do it yourself for actions"; dis = true; }
  else if (g === "rep") txt = "Replicate a chromosome";
  else if (g === "G1") txt = "Replicate DNA";
  else if (g === "align") txt = "Start anaphase";
  else if (g === "pull" || g === "meta") txt = "Press & hold: pull chromatids apart";
  else if (g === "pinch") txt = "Press & hold: tighten the furrow";
  else if (g === "done") { txt = "Division complete — press Reset to go again"; dis = true; }
  else { txt = "Watch this stage…"; dis = true; }
  if (actBtn.textContent !== txt) actBtn.textContent = txt;
  actBtn.disabled = dis;
  if (dis) endHold();
}

// ---------------------------------------------------------------- pointer
const TL = { x: 0, y: 0, w: 0, h: 16 };
const inTimeline = (p) => p.x >= TL.x - 8 && p.x <= TL.x + TL.w + 8 && p.y >= TL.y - 12 && p.y <= TL.y + TL.h + 10;
const scrubTo = (px) => { S.T = clamp((px - TL.x) / TL.w, 0, 1) * TOTAL; };
const toU = (p) => [(p.x - L.cx) / L.R, (p.y - L.cy) / L.R];

function onDown(p) {
  if (inTimeline(p)) {
    if (S.mode === "watch") { scrubbing = true; scrubTo(p.x); }
    else toast("The timeline is locked in Do-it-yourself mode — your actions move the cell through the cycle.");
    return;
  }
  if (S.mode !== "diy" || !pose) return;
  const [ux, uy] = toU(p);
  const g = gateState();
  const hitR = Math.max(26, 0.17 * L.R) / L.R;
  const poleHit = (c) => Math.hypot(ux - c[0], uy - c[1]) < Math.max(34, 0.2 * L.R) / L.R;
  if (g === "G1") {
    if (Math.hypot(ux, uy) < RN + 0.1) toast("Not yet — DNA is only copied in <strong>S phase</strong>. Let G1 finish.");
    return;
  }
  if (g === "rep") {
    if (Math.hypot(ux, uy) < RN + 14 / L.R) replicateNearest(ux, uy);
    else toast("Tap inside the <strong>nucleus</strong> — that's where the DNA is.");
    return;
  }
  if (g === "align" || g === "meta" || (g === "pull" && diy.sep <= 0)) {
    // chromosome grab? (not once the learner is pulling, so press-and-hold inside the cell works)
    let best = -1, bd = g === "pull" ? 0 : hitR;
    pose.sis.forEach((s, i) => {
      for (const pt of [[s.cx, s.cy], ...s.list.map((q) => [q.x, q.y])]) {
        const d = Math.hypot(pt[0] - ux, pt[1] - uy);
        if (d < bd) { bd = d; best = i; }
      }
    });
    if (best >= 0) {
      const s = pose.sis[best];
      diy.pos[best] = { x: s.cx, y: s.cy, ang: s.ang };
      if (diy.slot[best] >= 0) { diy.occ[diy.slot[best]] = -1; diy.slot[best] = -1; }
      diy.drag = { i: best, ox: s.cx - ux, oy: s.cy - uy };
      return;
    }
    const side = poleHit(pose.c0) ? -1 : poleHit(pose.c1) ? 1 : 0;
    if (side) {
      if (attemptPull()) diy.poleDrag = { side, ux0: ux, sep0: diy.sep };
      return;
    }
    if (g !== "align" && Math.hypot(ux / pose.a, uy / pose.b) < 1) { if (attemptPull()) diy.hold = true; }
    else if (g === "align") toast("Grab a chromosome and drag it to the dashed <strong>metaphase plate</strong>.");
    return;
  }
  if (g === "pull") {
    const side = poleHit(pose.c0) ? -1 : poleHit(pose.c1) ? 1 : 0;
    if (side) diy.poleDrag = { side, ux0: ux, sep0: diy.sep };
    else if (Math.hypot(ux / pose.a, uy / pose.b) < 1.1) diy.hold = true;
    return;
  }
  if (g === "pinch") {
    if (Math.abs(ux) < 0.45) { diy.furrowDrag = true; onMove(p); }
    else toast("Grab the glowing <strong>contractile ring</strong> in the middle and drag it towards the centre.");
  }
}
function onMove(p) {
  if (scrubbing) { scrubTo(p.x); return; }
  if (S.mode !== "diy" || !pose) return;
  const [ux, uy] = toU(p);
  if (diy.drag) {
    let x = ux + diy.drag.ox, y = uy + diy.drag.oy;
    const r = Math.hypot(x / 0.85, y / 0.8);
    if (r > 1) { x /= r; y /= r; }
    diy.pos[diy.drag.i].x = x; diy.pos[diy.drag.i].y = y;
  } else if (diy.poleDrag) {
    const out = diy.poleDrag.side * (ux - diy.poleDrag.ux0);
    diy.sep = Math.max(diy.sep, clamp(diy.poleDrag.sep0 + out / 0.5, 0, 1));
    if (diy.sep >= 0.98) diy.sep = 1;
  } else if (diy.furrowDrag) {
    const fs = 1 - Math.abs(uy) / pose.b;
    diy.furrow = Math.max(diy.furrow, clamp((fs - 0.12) / 0.88, 0, 1));
    if (diy.furrow >= 0.92) diy.furrow = 1;
  }
}
function onUp() {
  scrubbing = false;
  if (diy.drag) {
    const i = diy.drag.i, ps = diy.pos[i];
    diy.drag = null;
    const snapU = Math.max(34 / L.R, 0.17);
    if (Math.abs(ps.x) < snapU) {
      let best = -1, bd = 1e9;
      SLOT_Y.forEach((sy, j) => { if (diy.occ[j] < 0 && Math.abs(sy - ps.y) < bd) { bd = Math.abs(sy - ps.y); best = j; } });
      if (best >= 0) {
        diy.slot[i] = best; diy.occ[best] = i;
        const n = nAligned();
        toast(n === 4 ? "All 4 chromosomes aligned and attached to both poles — the <strong>spindle checkpoint</strong> is satisfied. Metaphase!" : `Snapped to the plate: ${n} of 4 aligned.`, n === 4 ? 4200 : 1800);
      }
    }
  }
  if (diy.furrowDrag && diy.furrow > 0.85) diy.furrow = 1;
  if (diy.poleDrag && diy.sep > 0.9) diy.sep = 1;
  diy.poleDrag = null; diy.furrowDrag = false; diy.hold = false;
}
K.pointer(canvas, { down: onDown, move: onMove, up: onUp });
canvas.addEventListener("pointercancel", onUp);

// ---------------------------------------------------------------- update
function update(dt, realDt) {
  const an = PH[I.ana], cy = PH[I.cyto], sp = PH[I.S], pm = PH[I.prometa];
  if (S.mode === "watch") {
    if (!scrubbing) S.T = Math.min(TOTAL, S.T + dt);
  } else {
    S.T = Math.min(TOTAL, S.T + dt);
    for (let i = 0; i < 4; i++) if (diy.repOn[i] && diy.rep[i] < 1) diy.rep[i] = Math.min(1, diy.rep[i] + dt / 1.6);
    if (S.T >= sp.start && S.T < sp.end && !allRep()) S.T = sp.start + 1e-4 + 0.998 * sp.dur * meanRep();
    if (S.T >= GATE_PM && S.T < an.start && diy.sep <= 0 && !allAligned()) S.T = GATE_PM + pm.dur * 0.49 * nAligned() / 4;
    if (S.T >= GATE_META && diy.sep < 1 && S.T < an.end) {
      if ((diy.hold || diy.btnHold) && allAligned()) diy.sep = Math.min(1, diy.sep + dt * 0.35);
      S.T = diy.sep > 0 ? an.start + diy.sep * an.dur * 0.999 : GATE_META;
    }
    if (S.T >= cy.start && S.T < cy.end && diy.furrow < 1) {
      if (diy.btnHold) diy.furrow = Math.min(1, diy.furrow + dt * 0.3);
      S.T = cy.start + diy.furrow * cy.dur * 0.999;
    }
    // snapped chromosomes glide to their slot; dragged ones turn to face the poles near the plate
    CHR.forEach((c, i) => {
      const ps = diy.pos[i], plateA = -PI / 2 + c.tilt, r = Math.min(1, realDt * 12);
      if (diy.slot[i] >= 0 && !(diy.drag && diy.drag.i === i)) {
        ps.x += (0 - ps.x) * r; ps.y += (SLOT_Y[diy.slot[i]] - ps.y) * r; ps.ang = lerpAngle(ps.ang, plateA, r);
      } else if (diy.drag && diy.drag.i === i) {
        ps.ang = lerpAngle(ps.ang, Math.abs(ps.x) < 0.35 ? plateA : c.sAng, Math.min(1, realDt * 6));
      }
    });
  }
  if (S.T < an.start) S.ndL = S.mutation;
  if (S.mode === "watch" && S.T >= TOTAL && L_.running && !scrubbing) { L_.running = false; pauseBtn.textContent = "Replay"; }
}

// ---------------------------------------------------------------- drawing
const far = K.makeParticles(60, () => ({ x: Math.random(), y: Math.random(), r: K.rand(0.6, 2), v: K.rand(0.004, 0.012), ph: K.rand(0, TAU) }));
const gran = K.makeParticles(54, () => ({ rho: Math.sqrt(K.rand(0.05, 1)) * 0.9, th: K.rand(0, TAU), ph: K.rand(0, TAU), r: K.rand(0.008, 0.016) }));
const mito = K.makeParticles(6, (i) => ({ rho: K.rand(0.62, 0.8), th: (i / 6) * TAU + K.rand(-0.3, 0.3), rot: K.rand(0, PI) }));

function cellPoint(o, rho, th) {
  const sig = 0.2 * o.a;
  let x = rho * o.a * Math.cos(th);
  let y = rho * o.b * Math.sin(th) * (1 - o.f * Math.exp(-(x * x) / (2 * sig * sig)));
  if (o.split) {
    const side = x < 0 ? -1 : 1, dc = side * o.dcx;
    x += side * o.g;
    let vx = x - dc, vy = y;
    const m = Math.hypot(vx, vy), lim = RD * 0.9 * rho / 0.9;
    const k2 = m > lim ? lim / m : 1;
    x = lerp(x, dc + vx * k2, o.round); y = lerp(y, vy * k2, o.round);
  }
  return [x, y];
}

function shapePolys(o) {
  const N = 128, sig = 0.2 * o.a;
  const pt = (th) => { const x = o.a * Math.cos(th); return [x, o.b * Math.sin(th) * (1 - o.f * Math.exp(-(x * x) / (2 * sig * sig)))]; };
  if (!o.split) {
    const pts = [];
    for (let i = 0; i < N; i++) pts.push(pt((i / N) * TAU));
    return [{ pts, c: [0, 0] }];
  }
  return [-1, 1].map((side) => {
    const dc = side * o.dcx, pts = [];
    for (let i = 0; i <= N / 2; i++) {
      const th = (side < 0 ? PI / 2 : -PI / 2) + (i / (N / 2)) * PI;
      let [x, y] = pt(th);
      x += side * o.g;
      const an = Math.atan2(y, x - dc);
      pts.push([lerp(x, dc + RD * Math.cos(an), o.round), lerp(y, RD * Math.sin(an), o.round)]);
    }
    return { pts, c: [dc, 0] };
  });
}
function tracePoly(pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
  ctx.closePath();
}

function drawBackground(t) {
  K.backdrop(ctx, stage.w, stage.h, "#2a1440");
  ctx.save();
  for (const q of far) {
    q.y -= q.v * 0.016; if (q.y < -0.02) q.y = 1.02;
    const a = 0.18 + 0.12 * Math.sin(t * 0.7 + q.ph);
    ctx.fillStyle = `rgba(160,190,255,${a})`;
    ctx.beginPath(); ctx.arc(q.x * stage.w + Math.sin(t * 0.2 + q.ph) * 8, q.y * stage.h, q.r, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawCell(o, t, polys) {
  // cytoplasm fill
  for (const poly of polys) {
    const gx = X(poly.c[0]), gy = Y(poly.c[1]);
    const gr = ctx.createRadialGradient(gx - L.R * 0.25, gy - L.R * 0.3, L.R * 0.05, gx, gy, L.R * 1.25);
    gr.addColorStop(0, "rgba(40,110,130,0.55)");
    gr.addColorStop(0.7, "rgba(16,60,84,0.5)");
    gr.addColorStop(1, "rgba(10,40,64,0.6)");
    ctx.fillStyle = gr; tracePoly(poly.pts); ctx.fill();
  }
  // mitochondria + granules (depth layer)
  for (const m of mito) {
    const [x, y] = cellPoint(o, m.rho, m.th + Math.sin(t * 0.15 + m.rot) * 0.05);
    ctx.save(); ctx.translate(X(x), Y(y)); ctx.rotate(m.rot + t * 0.05);
    ctx.globalAlpha = 0.55;
    K.blob(ctx, 0, 0, L.R * 0.13, L.R * 0.055, "#c2410c");
    ctx.strokeStyle = "rgba(255,200,150,0.35)"; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let j = -2; j <= 2; j++) { ctx.moveTo(j * L.R * 0.022, -L.R * 0.018); ctx.lineTo(j * L.R * 0.022 + L.R * 0.008, L.R * 0.018); }
    ctx.stroke(); ctx.restore();
  }
  ctx.fillStyle = "rgba(170,230,240,0.35)";
  for (const g of gran) {
    const [x, y] = cellPoint(o, g.rho, g.th + Math.sin(t * 0.3 + g.ph) * 0.04);
    ctx.beginPath(); ctx.arc(X(x), Y(y), Math.max(1, g.r * L.R), 0, TAU); ctx.fill();
  }
}

function drawMembrane(o, polys, t) {
  ctx.save();
  ctx.lineJoin = "round";
  for (const poly of polys) {
    ctx.shadowColor = C.teal; ctx.shadowBlur = 18;
    ctx.strokeStyle = K.withAlpha(C.teal, 0.85); ctx.lineWidth = Math.max(3, L.R * 0.022);
    tracePoly(poly.pts); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(220,255,250,0.55)"; ctx.lineWidth = 1.2;
    tracePoly(poly.pts); ctx.stroke();
  }
  ctx.restore();
  // contractile ring (actin–myosin) seen edge-on
  if (o.f > 0.02 && !o.split) {
    const ry = o.b * (1 - o.f);
    ctx.save();
    ctx.strokeStyle = K.withAlpha(C.red, 0.55 * clamp(o.f * 6, 0, 1)); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(X(0), Y(0), Math.max(2, L.R * 0.035), Math.max(1, ry * L.R), 0, 0, TAU); ctx.stroke();
    ctx.restore();
    for (const sgn of [-1, 1]) {
      K.glow(ctx, X(0), Y(sgn * ry), L.R * 0.12, C.red, 0.5);
      K.sphere(ctx, X(0), Y(sgn * ry), Math.max(4, L.R * 0.03), C.red);
    }
  }
}

function drawNucleusOld(o) {
  if (o.env <= 0) return;
  const r = RN * L.R, x = X(0), y = Y(0);
  ctx.save();
  if (o.env >= 1) {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, K.withAlpha(C.violet, 0.22)); g.addColorStop(1, K.withAlpha(C.violet, 0.08));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = K.withAlpha(C.violet, 0.9); ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = K.withAlpha(C.violet, 0.4); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x, y, r - 4, 0, TAU); ctx.stroke();
    ctx.fillStyle = "rgba(230,220,255,0.75)";
    for (let j = 0; j < 18; j++) { const a = (j / 18) * TAU; ctx.beginPath(); ctx.arc(x + Math.cos(a) * (r - 2), y + Math.sin(a) * (r - 2), 1.6, 0, TAU); ctx.fill(); }
  } else {
    const br = 1 - o.env, n = 14;
    ctx.strokeStyle = K.withAlpha(C.violet, 0.85 * o.env); ctx.lineWidth = 2;
    for (let j = 0; j < n; j++) {
      const a0 = (j / n) * TAU, span = (TAU / n) * (0.85 - 0.5 * br);
      const rr = r * (1 + 0.25 * br + 0.06 * Math.sin(j * 5.3) * br);
      ctx.beginPath(); ctx.arc(x, y, rr, a0 + 0.1 * br * Math.sin(j), a0 + span); ctx.stroke();
    }
    ctx.fillStyle = K.withAlpha(C.violet, 0.12 * o.env); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  ctx.restore();
  if (o.nucleolus > 0.01) {
    K.glow(ctx, X(0.08), Y(-0.04), L.R * 0.16, C.violet, 0.3 * o.nucleolus);
    K.sphere(ctx, X(0.08), Y(-0.04), L.R * 0.075 * (0.6 + 0.4 * o.nucleolus), "#7c5cc4", { alpha: 0.75 * o.nucleolus });
  }
}

function drawNucleiNew(o) {
  if (o.ref <= 0) return;
  for (const side of [-1, 1]) {
    const x = X(side * o.dcx), y = Y(0), r = RN2 * L.R;
    ctx.save();
    ctx.fillStyle = K.withAlpha(C.violet, 0.16 * o.ref);
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = K.withAlpha(C.violet, 0.9 * o.ref); ctx.lineWidth = 2;
    const n = 12;
    if (o.ref >= 1) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); }
    else for (let j = 0; j < n; j++) {
      const a0 = (j / n) * TAU, span = (TAU / n) * lerp(0.35, 1, o.ref);
      const rr = r * (1 + 0.2 * (1 - o.ref));
      ctx.beginPath(); ctx.arc(x, y, rr, a0, a0 + span); ctx.stroke();
    }
    ctx.restore();
    if (o.nucleolus2 > 0.01) {
      K.sphere(ctx, x + side * 0.05 * L.R, y - 0.05 * L.R, L.R * 0.05 * o.nucleolus2, "#7c5cc4", { alpha: 0.7 * o.nucleolus2 });
    }
  }
}

function drawCentrosome(c, alpha = 1) {
  const x = X(c[0]), y = Y(c[1]), s = Math.max(5, L.R * 0.05);
  K.glow(ctx, x, y, L.R * 0.14, C.amber, 0.45 * alpha);
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y);
  K.blob(ctx, -s * 0.35, 0, s * 0.42, s, C.amber, s * 0.15);
  ctx.rotate(PI / 2);
  K.blob(ctx, 0, -s * 0.45, s * 0.42, s, C.amber, s * 0.15);
  ctx.restore();
}

function partialQuad(p0, pc, p1, t0, t1) {
  const n = 14;
  for (let j = 0; j <= n; j++) {
    const t = lerp(t0, t1, j / n), u = 1 - t;
    const x = u * u * p0[0] + 2 * u * t * pc[0] + t * t * p1[0];
    const y = u * u * p0[1] + 2 * u * t * pc[1] + t * t * p1[1];
    j ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y));
  }
}

function drawSpindle(o, t) {
  const cs = [o.c0, o.c1];
  ctx.save();
  ctx.lineCap = "round";
  // asters (radial microtubule arrays)
  const nC = o.dup > 0.02 ? 2 : 1;
  for (let ci = 0; ci < nC; ci++) {
    const c = cs[ci], len = (0.14 + 0.2 * Math.max(o.sg, 0.3)) * L.R;
    ctx.strokeStyle = K.withAlpha(C.teal, (0.18 + 0.2 * o.sg) * (ci === 1 ? Math.max(o.dup, o.split ? 1 : 0) : 1));
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let j = 0; j < 14; j++) {
      const a = (j / 14) * TAU + ci * 0.2, l = len * (0.7 + 0.3 * Math.sin(j * 2.7 + t * 0.6));
      ctx.moveTo(X(c[0]), Y(c[1])); ctx.lineTo(X(c[0]) + Math.cos(a) * l, Y(c[1]) + Math.sin(a) * l);
    }
    ctx.stroke();
  }
  // polar (interpolar) microtubules: grow from each pole and overlap in the middle
  if (o.sg > 0.01 && !o.split) {
    const mid = [(o.c0[0] + o.c1[0]) / 2, (o.c0[1] + o.c1[1]) / 2];
    const dx = o.c1[0] - o.c0[0], dy = o.c1[1] - o.c0[1], dl = Math.hypot(dx, dy) || 1;
    const nx = -dy / dl, ny = dx / dl;
    ctx.strokeStyle = K.withAlpha(C.teal, 0.32 * o.sg); ctx.lineWidth = 1.2;
    for (let m = -3; m <= 3; m++) {
      const pc = [mid[0] + nx * m * 0.17 * dl / 1.6, mid[1] + ny * m * 0.17 * dl / 1.6];
      const reach = 0.56 * o.sg;
      ctx.beginPath(); partialQuad(o.c0, pc, o.c1, 0, reach); ctx.stroke();
      ctx.beginPath(); partialQuad(o.c0, pc, o.c1, 1 - reach, 1); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawKinetochoreMTs(o) {
  if (o.k < I.prometa || o.kmt <= 0) return;
  ctx.save();
  ctx.lineCap = "round";
  o.sis.forEach((s, i) => {
    const at = o.attach[i];
    if (at <= 0) return;
    const nd = S.ndL && i === ND_CHR;
    s.list.forEach((q, kk) => {
      let pole = kk === 0 ? o.c0 : o.c1, alpha = 0.8 * o.kmt;
      if (nd && o.k >= I.ana && kk === 1) {
        // syntelic / failed separation: right-pole fibre lets go, left pole drags both sisters
        if (o.s < 0.35) {
          const fade = 1 - o.s / 0.35;
          drawFibre(o.c1, q, at, alpha * fade);
        }
        pole = o.c0;
      }
      drawFibre(pole, q, at, alpha);
    });
  });
  ctx.restore();
}
function drawFibre(pole, q, at, alpha) {
  const ex = lerp(pole[0], q.x, at), ey = lerp(pole[1], q.y, at);
  const dx = ex - pole[0], dy = ey - pole[1], dl = Math.hypot(dx, dy) || 1;
  const nx = -dy / dl, ny = dx / dl;
  ctx.strokeStyle = K.withAlpha(C.teal, alpha); ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const off of [-0.012, 0, 0.012]) {
    ctx.moveTo(X(pole[0]), Y(pole[1]));
    ctx.lineTo(X(ex + nx * off), Y(ey + ny * off));
  }
  ctx.stroke();
}

const ARM_N = 10;
function armPts(x, y, ang, len, cond, seed, arm, t) {
  const pts = [[x, y]];
  const step = (len * L.R * lerp(1.9, 1, cond)) / ARM_N;
  const wig = 1 - cond;
  let h = ang;
  for (let j = 1; j <= ARM_N; j++) {
    h += wig * (0.95 * Math.sin(seed * 2.3 + j * 1.9 + arm * 3.1) + 0.12 * Math.sin(t * 0.9 + j + seed)) + cond * 0.03 * Math.sin(seed + j + arm);
    x += Math.cos(h) * step; y += Math.sin(h) * step;
    pts.push([x, y]);
  }
  return pts;
}
function strokePts(pts, n, ox = 0, oy = 0) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0] + ox, pts[0][1] + oy);
  for (let j = 1; j < n; j++) ctx.lineTo(pts[j][0] + ox, pts[j][1] + oy);
  ctx.stroke();
}
function drawChromatid(c, q, cond, t, isSister) {
  const x = X(q.x), y = Y(q.y);
  const wpx = lerp(1.7, L.cw, cond);
  const frac = q.frac;
  if (frac <= 0) return;
  const arms = [armPts(x, y, q.a1, c.len * c.cpos, cond, c.seed, 0, t), armPts(x, y, q.a2, c.len * (1 - c.cpos), cond, c.seed, 1, t)];
  const n = frac >= 1 ? ARM_N + 1 : Math.max(2, Math.round(frac * ARM_N) + 1);
  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (wpx > 3) {
    ctx.strokeStyle = c.dark; ctx.lineWidth = wpx;
    arms.forEach((a) => strokePts(a, n));
    ctx.strokeStyle = c.col; ctx.lineWidth = wpx * 0.62;
    arms.forEach((a) => strokePts(a, n));
    ctx.strokeStyle = c.light; ctx.lineWidth = wpx * 0.2;
    arms.forEach((a) => strokePts(a, n, -wpx * 0.14, -wpx * 0.14));
  } else {
    ctx.strokeStyle = isSister ? c.light : c.col; ctx.lineWidth = wpx;
    ctx.globalAlpha = 0.9;
    arms.forEach((a) => strokePts(a, n));
  }
  ctx.restore();
  if (frac > 0 && frac < 1) {
    for (const a of arms) { const e = a[n - 1]; K.glow(ctx, e[0], e[1], 9, C.amber, 0.8); }
  }
}

function drawChromosomes(o, t) {
  // clip decondensed chromatin to its nucleus
  ctx.save();
  if (o.k < I.prometa && o.cond < 0.9) {
    ctx.beginPath(); ctx.arc(X(0), Y(0), RN * L.R - 2, 0, TAU); ctx.clip();
  } else if (o.k >= I.telo && o.cond < 0.55) {
    ctx.beginPath();
    for (const side of [-1, 1]) { ctx.moveTo(X(side * o.dcx) + RN2 * L.R - 2, Y(0)); ctx.arc(X(side * o.dcx), Y(0), RN2 * L.R - 2, 0, TAU); }
    ctx.clip();
  }
  o.sis.forEach((s, i) => {
    const c = CHR[i];
    if (o.cond > 0.3) K.glow(ctx, X(s.cx), Y(s.cy), L.R * (s.list[0].side === s.list[1].side || o.s <= 0 ? 0.2 : 0.12), c.col, 0.14 * o.cond);
    s.list.forEach((q, kk) => drawChromatid(c, q, o.cond, t, kk === 1 && o.s <= 0));
    // centromere cohesion + kinetochores
    if (o.cond > 0.5) {
      const [q0, q1] = s.list;
      if (s.joined) {
        ctx.save(); ctx.strokeStyle = c.dark; ctx.lineCap = "round"; ctx.lineWidth = L.cw * 0.7;
        ctx.beginPath(); ctx.moveTo(X(q0.x), Y(q0.y)); ctx.lineTo(X(q1.x), Y(q1.y)); ctx.stroke(); ctx.restore();
      }
      if (o.k >= I.prometa && o.k <= I.ana) {
        for (const q of s.list) {
          const dx = q.x - s.cx, dy = q.y - s.cy, dl = Math.hypot(dx, dy) || 1;
          const kx = q.x + (dl > 0.001 ? dx / dl : q.side) * (L.cw * 0.45 / L.R), ky = q.y + (dl > 0.001 ? dy / dl : 0) * (L.cw * 0.45 / L.R);
          K.sphere(ctx, X(kx), Y(ky), Math.max(2, L.cw * 0.32), "#c7fff6");
        }
      }
    }
  });
  ctx.restore();
}

function ring(x, y, r, t, col = C.amber) {
  const ph = (t * 1.2) % 1;
  ctx.save();
  ctx.strokeStyle = K.withAlpha(col, 0.7 * (1 - ph)); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r * (0.8 + 0.6 * ph), 0, TAU); ctx.stroke();
  ctx.restore();
}

function drawPlate(o, t) {
  let a = 0;
  if (o.k === I.prometa) a = clamp((o.p - 0.35) / 0.15, 0, 1);
  else if (o.k === I.meta) a = 1;
  else if (o.k === I.ana) a = 1 - clamp(o.s * 3, 0, 1);
  if (a <= 0) return;
  ctx.save();
  ctx.setLineDash([6, 7]); ctx.lineDashOffset = -t * 10;
  ctx.strokeStyle = K.withAlpha(C.amber, 0.55 * a); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(X(0), Y(-0.66)); ctx.lineTo(X(0), Y(0.66)); ctx.stroke();
  ctx.restore();
  if (gateState() === "align") {
    SLOT_Y.forEach((sy, j) => {
      if (diy.occ[j] >= 0) return;
      ctx.save(); ctx.strokeStyle = K.withAlpha(C.amber, 0.5); ctx.setLineDash([3, 4]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(X(0), Y(sy), Math.max(12, 0.07 * L.R), 0, TAU); ctx.stroke(); ctx.restore();
    });
  }
}

function drawHints(o, t) {
  const g = gateState();
  const fs = stage.w < 500 ? 11 : 13;
  const hintY = Y(Math.min(o.b + 0.12, (stage.h - 70 - L.cy) / L.R));
  if (g === "rep") {
    ring(X(0), Y(0), RN * L.R, t);
    K.label(ctx, `Tap the nucleus to copy each chromosome (${diy.repOn.filter(Boolean).length}/4)`, X(0), hintY, { color: C.amber, size: fs });
  } else if (g === "align") {
    o.sis.forEach((s, i) => { if (diy.slot[i] < 0 && !(diy.drag && diy.drag.i === i)) ring(X(s.cx), Y(s.cy), Math.max(18, 0.12 * L.R), t + i * 0.25); });
    K.label(ctx, `Drag each chromosome onto the dashed plate (${nAligned()}/4 aligned)`, X(0), hintY, { color: C.amber, size: fs });
  } else if (g === "pull") {
    for (const [c, sgn] of [[o.c0, -1], [o.c1, 1]]) {
      ring(X(c[0]), Y(c[1]), Math.max(20, 0.12 * L.R), t);
      K.arrow(ctx, X(c[0]) + sgn * 14, Y(c[1]), X(c[0]) + sgn * (14 + Math.max(24, 0.12 * L.R)), Y(c[1]), K.withAlpha(C.amber, 0.85), 2.5);
    }
    K.label(ctx, "Drag a spindle pole outward — or press and hold inside the cell", X(0), hintY, { color: C.amber, size: fs });
  } else if (g === "pinch") {
    const ry = o.b * (1 - o.f);
    for (const sgn of [-1, 1]) {
      ring(X(0), Y(sgn * ry), Math.max(18, 0.1 * L.R), t, C.red);
      K.arrow(ctx, X(0), Y(sgn * ry) + sgn * 46, X(0), Y(sgn * ry) + sgn * 16, K.withAlpha(C.amber, 0.9), 2.5);
    }
    K.label(ctx, "Drag the contractile ring towards the centre to pinch the cell", X(0), hintY, { color: C.amber, size: fs });
  }
}

function drawLabels(o) {
  if (!S.labels) return;
  const fs = stage.w < 500 ? 10 : 11.5;
  const lab = (txt, x, y, col = C.inkDim) => K.label(ctx, txt, X(x), Y(y), { size: fs, color: col });
  const k = o.k;
  if (k <= I.G2) {
    lab("Nucleus", 0.0, -RN - 0.08, C.violet);
    lab(k === I.G1 ? "Chromatin (uncondensed DNA)" : k === I.S ? "DNA replicating" : "Copied chromatin", 0, RN - 0.12);
    lab(o.dup > 0.5 ? "Centrosomes (duplicated)" : "Centrosome", o.c0[0] - 0.05, o.c0[1] - 0.14, C.amber);
  } else if (k === I.pro) {
    lab("Chromosomes condensing", 0, RN - 0.1);
    if (o.p > 0.3) lab("Spindle forming", 0, -0.72, C.teal);
    lab("Centrosome", o.c0[0], o.c0[1] - 0.15, C.amber);
  } else if (k === I.prometa) {
    lab(o.p < 0.35 ? "Nuclear envelope breaking down" : "Kinetochore microtubules attach", 0, -0.72, o.p < 0.35 ? C.violet : C.teal);
    lab("Spindle pole", o.c1[0], o.c1[1] - 0.15, C.amber);
  } else if (k === I.meta) {
    lab("Metaphase plate", 0, -0.74, C.amber);
    lab("Sister chromatids", 0.27, 0.6);
    lab("Spindle pole", o.c1[0], o.c1[1] - 0.15, C.amber);
  } else if (k === I.ana) {
    lab("Sister chromatids separate", 0, -0.75);
    lab("Pole", o.c0[0], o.c0[1] - 0.15, C.amber);
    lab("Pole", o.c1[0], o.c1[1] - 0.15, C.amber);
  } else if (k === I.telo) {
    lab("Nuclear envelopes re-form", 0, -0.72, C.violet);
    lab("Chromosomes decondense", 0, 0.68);
  } else if (k === I.cyto) {
    lab("Cleavage furrow", 0.36, -o.b * (1 - o.f) - 0.06, C.red);
  } else if (k === I.done) {
    lab("Daughter cell", -o.dcx, -0.84 + 0.0 * o.round, C.teal);
    lab("Daughter cell", o.dcx, -0.84, C.teal);
  }
}

// DNA content per cell (units of C) at timeline position T
function dnaAt(T) {
  const k = phaseAt(T), p = clamp((T - PH[k].start) / PH[k].dur, 0, 1);
  if (k < I.S) return 2;
  if (k === I.S) return 2 + 2 * p;
  if (k < I.done) return 4;
  return 2;
}
function drawGraph(o) {
  if (!S.graph) return;
  const small = stage.w < 600;
  const gw = small ? 124 : 168, gh = small ? 66 : 88;
  const gx = 12, gy = TL.y - 26 - gh;
  ctx.save();
  ctx.fillStyle = "rgba(5,11,22,0.72)"; ctx.strokeStyle = "rgba(120,190,255,0.18)"; ctx.lineWidth = 1;
  K.roundRect(ctx, gx, gy, gw, gh, 10); ctx.fill(); ctx.stroke();
  const px0 = gx + 26, px1 = gx + gw - 8, py0 = gy + gh - 12, py1 = gy + 16;
  const yv = (v) => lerp(py0, py1, v / 5);
  const xv = (T) => lerp(px0, px1, T / TOTAL);
  ctx.font = `600 ${small ? 9 : 10}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = C.inkFaint; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillText("DNA per cell", gx + 8, gy + 9);
  ctx.textAlign = "right";
  for (const v of [2, 4]) {
    ctx.fillText(`${v}C`, px0 - 4, yv(v));
    ctx.strokeStyle = "rgba(255,255,255,0.07)"; ctx.beginPath(); ctx.moveTo(px0, yv(v)); ctx.lineTo(px1, yv(v)); ctx.stroke();
  }
  ctx.textAlign = "right"; ctx.fillText("time →", px1, py0 + 7);
  // mitosis band
  ctx.fillStyle = "rgba(167,139,250,0.08)";
  ctx.fillRect(xv(PH[I.pro].start), py1, xv(PH[I.cyto].end) - xv(PH[I.pro].start), py0 - py1);
  const splitT = PH[I.done].start;
  const trace = (T0, T1, f, col, alpha, dash) => {
    ctx.save(); ctx.strokeStyle = K.withAlpha(col, alpha); ctx.lineWidth = 2; if (dash) ctx.setLineDash([3, 3]);
    ctx.beginPath();
    const n = 60;
    for (let j = 0; j <= n; j++) {
      const T = lerp(T0, T1, j / n);
      j ? ctx.lineTo(xv(T), yv(f(T))) : ctx.moveTo(xv(T), yv(f(T)));
    }
    ctx.stroke(); ctx.restore();
  };
  const T = S.T;
  const preSplit = (TT) => dnaAt(Math.min(TT, splitT - 1e-6));
  const ndAmt = (CHR[ND_CHR].len / HAPLOID);
  // future (faint) then past (bright)
  trace(0, splitT - 1e-6, preSplit, C.teal, 0.18, true);
  trace(0, Math.min(T, splitT - 1e-6), preSplit, C.teal, 1, false);
  if (S.ndL) {
    const fL = () => 2 + ndAmt, fR = () => 2 - ndAmt;
    trace(splitT, TOTAL, fL, C.pink, 0.2, true); trace(splitT, TOTAL, fR, C.blue, 0.2, true);
    if (T > splitT) { trace(splitT, T, fL, C.pink, 1, false); trace(splitT, T, fR, C.blue, 1, false); }
  } else {
    trace(splitT, TOTAL, () => 2, C.teal, 0.18, true);
    if (T > splitT) trace(splitT, T, () => 2, C.teal, 1, false);
  }
  const cur = T > splitT && S.ndL ? 2 + ndAmt : dnaAt(T);
  K.sphere(ctx, xv(T), yv(cur), 3.5, C.teal, { glow: 0 });
  ctx.restore();
}

function drawTimeline(o) {
  const w = stage.w;
  TL.x = 12; TL.w = w - 24; TL.y = stage.h - 30; TL.h = 16;
  ctx.save();
  const small = w < 640;
  ctx.font = `600 ${small ? 9.5 : 10.5}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  PH.forEach((ph, i) => {
    const x0 = TL.x + (ph.start / TOTAL) * TL.w, x1 = TL.x + (ph.end / TOTAL) * TL.w;
    const col = i <= I.G2 || i === I.done ? C.teal : i === I.cyto ? C.red : C.violet;
    const active = i === o.k;
    ctx.fillStyle = K.withAlpha(col, active ? 0.55 : 0.18);
    K.roundRect(ctx, x0 + 1, TL.y, x1 - x0 - 2, TL.h, 5); ctx.fill();
    const full = ph.label || ph.name.replace("Interphase · ", "").replace(" phase", "");
    const txt = ctx.measureText(full).width < x1 - x0 - 6 ? full : ctx.measureText(ph.short).width < x1 - x0 - 4 ? ph.short : "";
    ctx.fillStyle = active ? C.ink : C.inkDim;
    if (txt) ctx.fillText(txt, (x0 + x1) / 2, TL.y + TL.h / 2 + 0.5);
  });
  // group brackets
  if (w > 420) {
    const grp = (a, b, txt, col) => {
      const x0 = TL.x + (PH[a].start / TOTAL) * TL.w, x1 = TL.x + (PH[b].end / TOTAL) * TL.w;
      ctx.strokeStyle = K.withAlpha(col, 0.5); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0 + 2, TL.y - 3); ctx.lineTo(x0 + 2, TL.y - 7); ctx.lineTo(x1 - 2, TL.y - 7); ctx.lineTo(x1 - 2, TL.y - 3); ctx.stroke();
      ctx.fillStyle = K.withAlpha(col, 0.9);
      const tw = ctx.measureText(txt).width + 8;
      ctx.fillStyle = "rgba(5,11,22,0.9)"; ctx.fillRect((x0 + x1) / 2 - tw / 2, TL.y - 13, tw, 12);
      ctx.fillStyle = K.withAlpha(col, 0.95); ctx.fillText(txt, (x0 + x1) / 2, TL.y - 7);
    };
    grp(I.G1, I.G2, "Interphase", C.teal);
    grp(I.pro, I.telo, "Mitosis (M phase)", C.violet);
  }
  // cursor
  const cx = TL.x + (S.T / TOTAL) * TL.w;
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, TL.y - 3); ctx.lineTo(cx, TL.y + TL.h + 3); ctx.stroke();
  K.sphere(ctx, cx, TL.y + TL.h / 2, S.mode === "watch" ? 7 : 5, S.mode === "watch" ? C.ink : C.inkFaint);
  ctx.restore();
}

// ---------------------------------------------------------------- explain + chips
const TEXT = {
  G1: "<strong>Interphase – G1.</strong> The cell grows and does its everyday jobs. Its DNA is loosely packed as <strong>chromatin</strong> inside the <strong>nucleus</strong>. This cell is <strong>diploid (2n = 4)</strong>: two homologous pairs, one set from each parent (pink = maternal, blue = paternal). Each chromosome is a single DNA molecule (one chromatid).",
  S: "<strong>Interphase – S phase.</strong> <strong>DNA replication</strong>: each chromosome is copied, making two identical <strong>sister chromatids</strong> joined at a <strong>centromere</strong>. DNA content doubles from <strong>2C to 4C</strong>, but the chromosome number stays at <strong>4</strong>. The centrosome is duplicated too.",
  G2: "<strong>Interphase – G2.</strong> The cell keeps growing, checks the copied DNA for errors and makes proteins needed for division. The chromosomes are still uncondensed, so you can't see them as separate structures yet.",
  pro: "<strong>Prophase.</strong> Chromatin coils and <strong>condenses</strong> into visible chromosomes — each one two sister chromatids joined at the centromere. The two <strong>centrosomes</strong> move apart and the <strong>spindle</strong> of microtubules starts to form. The nucleolus disappears.",
  prometa: "<strong>Prometaphase.</strong> The <strong>nuclear envelope breaks down</strong> into fragments. Spindle microtubules capture the chromosomes by protein structures called <strong>kinetochores</strong> at each centromere — the two sister chromatids attach to <strong>opposite poles</strong>. Chromosomes then jostle towards the cell's equator.",
  meta: "<strong>Metaphase.</strong> All chromosomes line up single-file on the <strong>metaphase plate</strong> (the equator), with sister chromatids facing opposite poles. The <strong>spindle assembly checkpoint</strong> only lets the cell continue once every kinetochore is attached and under tension.",
  ana: "<strong>Anaphase.</strong> The proteins (cohesin) holding sisters together are cut. <strong>Sister chromatids separate</strong> and are pulled to opposite poles as kinetochore microtubules shorten; the poles also move apart, stretching the cell. Each separated chromatid is now counted as a chromosome: <strong>8 in the cell, 4 heading to each pole</strong>.",
  anaND: "<strong>Anaphase — with nondisjunction!</strong> The sisters of the long pink chromosome <strong>fail to separate</strong> and both are dragged to the <strong>left pole</strong>. The other chromosomes separate normally. (Simplified: real causes include faulty spindle attachments or cohesin that isn't cut.)",
  telo: "<strong>Telophase.</strong> Chromosomes arrive at the poles and <strong>decondense</strong>. A <strong>nuclear envelope re-forms</strong> around each set and nucleoli reappear. The spindle breaks down. The cell now has <strong>two nuclei</strong>.",
  cyto: "<strong>Cytokinesis.</strong> A <strong>contractile ring</strong> of actin and myosin tightens around the middle, forming a <strong>cleavage furrow</strong> that pinches the cytoplasm in two. (Plant cells can't pinch — they build a <strong>cell plate</strong> instead.)",
  done: "<strong>Two daughter cells.</strong> Each is <strong>diploid (2n = 4)</strong> with exactly the same chromosomes as the parent — one of each homologue — so they are <strong>genetically identical</strong>. Each starts a new G1 with <strong>2C</strong> DNA and will grow before dividing again.",
  doneND: "<strong>Aneuploid daughter cells!</strong> Because one chromosome's sisters didn't separate, one daughter got an extra copy (<strong>2n + 1</strong>, trisomy) and the other is missing one (<strong>2n − 1</strong>, monosomy). Such cells usually malfunction or die; in body tissues aneuploidy is linked to cancer. This is why the checkpoints matter.",
};
const TASK = {
  G1: "Your turn soon: the cell must reach <strong>S phase</strong> before DNA can be copied.",
  rep: () => `<strong>Your turn:</strong> tap the nucleus to replicate each chromosome (${diy.repOn.filter(Boolean).length}/4 started).`,
  align: () => `<strong>Your turn:</strong> drag each chromosome onto the dashed <strong>metaphase plate</strong> — it snaps when close (${nAligned()}/4). Curious? Press <em>Start anaphase</em> before they're all lined up.`,
  meta: "Chromosomes aligned. Hold on — the checkpoint is confirming every attachment…",
  pull: "<strong>Your turn:</strong> drag a <strong>spindle pole</strong> (glowing centrosome) outwards, or press and hold inside the cell / the button, to pull the sister chromatids apart.",
  pinch: "<strong>Your turn:</strong> drag the glowing <strong>contractile ring</strong> towards the middle (or hold the button) to close the cleavage furrow.",
  done: "Division complete! Press <strong>Reset</strong> to go again — try the nondisjunction mutation.",
  auto: "Watch this stage — your next task is coming up.",
};
let lastExplainKey = "";
function updateExplain(o) {
  const g = gateState();
  const nd = S.ndL && (o.k === I.ana || o.k === I.done);
  const txtKey = nd ? o.key + "ND" : o.key;
  const key = `${txtKey}|${g}|${g === "rep" ? diy.repOn.filter(Boolean).length : g === "align" ? nAligned() : ""}`;
  if (key === lastExplainKey) return;
  lastExplainKey = key;
  let html = `<p>${TEXT[txtKey] || TEXT[o.key]}</p>`;
  if (S.mode === "diy") {
    const tk = TASK[g];
    if (tk) html += `<p class="task">${typeof tk === "function" ? tk() : tk}</p>`;
  }
  html += `<p class="note">Not to scale: human body cells have 46 chromosomes (2n = 46), and timing is compressed — a real cycle takes about a day, with mitosis lasting roughly an hour.</p>`;
  explainBody.innerHTML = html;
}

function updateChips(o) {
  chipPhase(`Phase <b>${o.ph.name}</b>`);
  const nd = S.ndL;
  if (o.split) {
    const hide = nd && !S.countAnswered;
    const l = nd ? 5 : 4, r = nd ? 3 : 4;
    chipChr(`Chromosomes <b>${hide ? "? | ?" : `${l} | ${r}`}</b>`);
    chipCt(`Chromatids <b>${hide ? "? | ?" : `${l} | ${r}`}</b>`);
    const ndAmt = CHR[ND_CHR].len / HAPLOID;
    chipDNA(`DNA <b>${nd ? `${(2 + ndAmt).toFixed(1)}C | ${(2 - ndAmt).toFixed(1)}C` : "2C | 2C"}</b>`);
    return;
  }
  const separated = o.k >= I.ana && o.s > 0;
  const nChr = separated ? (nd && o.k === I.ana ? 7 : 8) : 4;
  const nCt = separated ? 8 : 4 + o.rep.filter((r) => r >= 1).length;
  chipChr(`Chromosomes <b>${nChr}${o.k >= I.telo && !nd ? " (4 + 4)" : ""}</b>`);
  chipCt(`Chromatids <b>${nCt}</b>`);
  const dna = 2 + 2 * (o.rep.reduce((a, b) => a + b, 0) / 4);
  chipDNA(`DNA <b>${dna >= 3.995 ? "4C" : dna <= 2.005 ? "2C" : dna.toFixed(1) + "C"}</b>`);
}

// ---------------------------------------------------------------- main loop
function layout() {
  const w = stage.w, h = stage.h;
  const topM = Math.min(h * 0.32, overlay.offsetHeight + 20);
  const botM = 52;
  const availH = Math.max(80, h - topM - botM);
  L.R = Math.max(36, Math.min(w / 3.15, availH * 0.47));
  L.cx = w / 2; L.cy = topM + availH / 2;
  L.cw = clamp(L.R * 0.05, 4, 11);
}

let lastNow = performance.now();
const L_ = K.loop((dt, t) => {
  const now = performance.now(), realDt = Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;
  update(dt, realDt);
  layout();
  const o = computePose(t);
  pose = o;
  if (o.k === I.done) {
    S.flags.divided = true;
    if (S.mode === "diy" && !S.ndL) S.flags.identical = true;
  }
  countCard.hidden = !(o.k === I.done && S.ndL && o.p > 0.3);

  drawBackground(t);
  const polys = shapePolys(o);
  drawCell(o, t, polys);
  drawSpindle(o, t);
  drawNucleusOld(o);
  drawNucleiNew(o);
  drawKinetochoreMTs(o);
  drawChromosomes(o, t);
  drawCentrosome(o.c0);
  if (o.dup > 0.02) drawCentrosome(o.c1, o.dup);
  drawMembrane(o, polys, t);
  drawPlate(o, t);
  drawLabels(o);
  drawHints(o, t);
  drawTimeline(o);
  drawGraph(o);

  updateChips(o);
  updateExplain(o);
  updateActBtn();
  M.update();
});
L_.speed = reduceMotion ? 0.5 : 1;
