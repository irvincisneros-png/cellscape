// Meiosis & Variation — CellScape (2D version: the fallback when WebGL2 / the 3D shell is unavailable)
// A 2n = 4 germ cell (two homologous pairs) goes through meiosis. The learner places chiasmata
// (crossing over) in prophase I and flips bivalent orientation at metaphase I (independent
// assortment), then collects the four haploid gametes and can fertilise one.
import * as K from "../../assets/js/kit.js";

const stageEl = K.$("#stage");
const panel = K.$("#panel");
const overlay = K.$("#overlay");
const canvas = K.$("#canvas");
const stage = K.createStage(canvas);
const { ctx } = stage;
const toast = K.toaster(stageEl);
const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------------------------------------------------------------- model (shared with the 3D level)
import {
  N, LEN, WID, CEN, LOCI, COL, allele, PARENTAL, RECOMB, CYCLE, MAX_X, NAMES, DUR, AUTO_PHASES,
  build, atLocus, isRecomb, sideOf, gametesFrom, validPos, randomCross, randOrient, randOrient2, otherGamete, pairStr,
} from "./model.js";

// ---------------------------------------------------------------- state
const S = {
  phase: 0, pt: 0, held: 0,
  cross: [[], []], ch: null,
  orient: randOrient(), disp: [0, 0], orient2: randOrient2(), disp2: [[0, 0], [0, 0]],
  auto: false, preRandom: false,
  runs: 0, tally: {}, watched: new Set(), orientSeen: new Set(), crossMade: false,
  gametes: null, fert: null, zygotes: 0, lastZygote: null,
  watchedRuns: 0, cur: null, from: null, fromCells: null, drag: null, hover: null,
};
S.ch = build(S.cross);
S.disp = S.orient.slice();
S.disp2 = S.orient2.map((a) => a.slice());

// ---------------------------------------------------------------- geometry & layout
let G = {};
function geom() {
  const w = stage.w, h = stage.h;
  const top = w < 600 ? 70 : 48;
  const avail = Math.max(120, h - top - 12);
  const cx = w / 2, cy = top + avail / 2;
  const R = Math.min(w * 0.45, avail * 0.49);
  const U = R / 9.6;
  const r2 = Math.min(w * 0.235, avail * 0.47), d2 = r2 * 1.03;
  const r4 = Math.min(r2, avail * 0.236), d4 = r4 * 1.02;
  const sc2 = Math.min(1, 1.75 * r2 / (11 * U));
  const sc4 = Math.min(sc2, 1.5 * r4 / (6 * U));
  G = { w, h, cx, cy, R, U, r2, d2, r4, d4, sc2, sc4, top };
}
geom();
const Wd = (sc) => WID * G.U * sc;
const Ld = (p, sc) => LEN[p] * G.U * sc;
const P = (x, y, a = 0, sc = 1, al = 1) => ({ x, y, a, sc, al });
const G1POS = [[-0.3, -0.1, -0.35], [0.24, 0.17, 0.5], [-0.12, 0.3, 1.25], [0.27, -0.25, -0.9]];

function layoutFor(ph) {
  const { cx, cy, R } = G;
  const out = [[], [], [], []];
  if (ph <= 1) {
    const off = ph === 0 ? 0 : Wd(1) * 0.53;
    for (let k = 0; k < 4; k++) {
      const [bx, by, a] = G1POS[k];
      const x = cx + bx * R, y = cy + by * R, ux = Math.cos(a), uy = Math.sin(a);
      out[k][0] = P(x - ux * off, y - uy * off, a, 1, 1);
      out[k][1] = P(x + ux * off, y + uy * off, a, 1, ph === 0 ? 0 : 1);
    }
  } else if (ph === 2) {
    const W = Wd(1);
    for (let p = 0; p < 2; p++) {
      const bx = cx + (p === 0 ? -0.3 : 0.32) * R, by = cy + (p === 0 ? -0.02 : 0.06) * R;
      const offs = [-1.59, -0.53, 0.53, 1.59];
      out[2 * p][0] = P(bx + offs[0] * W, by);
      out[2 * p][1] = P(bx + offs[1] * W, by);
      out[2 * p + 1][0] = P(bx + offs[2] * W, by);
      out[2 * p + 1][1] = P(bx + offs[3] * W, by);
    }
  } else if (ph === 3) {
    const W = Wd(1), hx = W * 1.06;
    for (let p = 0; p < 2; p++) {
      const by = cy + (p === 0 ? -0.27 : 0.36) * R;
      const o = K.easeInOut(K.clamp(S.disp[p], 0, 1));
      const sw = Math.sin(Math.PI * o) * W * 2.4;
      const xm = cx + K.lerp(-hx, hx, o), xp = cx + K.lerp(hx, -hx, o);
      out[2 * p][0] = P(xm - 0.53 * W, by - sw); out[2 * p][1] = P(xm + 0.53 * W, by - sw);
      out[2 * p + 1][0] = P(xp - 0.53 * W, by + sw); out[2 * p + 1][1] = P(xp + 0.53 * W, by + sw);
    }
  } else if (ph === 4) {
    const W = Wd(1);
    for (let k = 0; k < 4; k++) {
      const p = k >> 1, side = sideOf(k, S.orient);
      const x = cx + (side ? 0.52 : -0.52) * R, y = cy + (p === 0 ? -0.27 : 0.36) * R;
      out[k][0] = P(x - 0.53 * W, y); out[k][1] = P(x + 0.53 * W, y);
    }
  } else if (ph === 5) {
    const sc = G.sc2, W = Wd(sc);
    for (let k = 0; k < 4; k++) {
      const p = k >> 1, side = sideOf(k, S.orient);
      const xc = cx + (side ? 1 : -1) * G.d2;
      const x = xc + (p === 0 ? -0.24 : 0.26) * G.r2;
      out[k][0] = P(x - 0.53 * W, cy, 0, sc); out[k][1] = P(x + 0.53 * W, cy, 0, sc);
    }
  } else if (ph === 6 || ph === 7) {
    const sc = G.sc2, W = Wd(sc), a = -Math.PI / 2;
    for (let k = 0; k < 4; k++) {
      const p = k >> 1, side = sideOf(k, S.orient);
      const xc = cx + (side ? 1 : -1) * G.d2;
      const L0 = Ld(0, sc), L1 = Ld(1, sc), gap = G.U * sc;
      const xs = xc - (L0 + L1 + gap) / 2;
      const x = p === 0 ? xs + L0 / 2 : xs + L0 + gap + L1 / 2;
      for (let s = 0; s < 2; s++) {
        if (ph === 6) {
          const o = K.easeInOut(K.clamp(S.disp2[side][p], 0, 1));
          const f = s === 0 ? K.lerp(-1, 1, o) : K.lerp(1, -1, o);
          const sw = Math.sin(Math.PI * o) * W * 1.8 * (s === 0 ? 1 : -1);
          out[k][s] = P(x + sw, cy + f * 0.53 * W, a, sc);
        } else {
          const half = s ^ S.orient2[side][p];
          out[k][s] = P(x, cy + (half ? 1 : -1) * G.d4 * 0.85, a, sc);
        }
      }
    }
  } else {
    const sc = G.sc4, a = -Math.PI / 2;
    for (let k = 0; k < 4; k++) {
      const p = k >> 1, side = sideOf(k, S.orient);
      for (let s = 0; s < 2; s++) {
        const half = s ^ S.orient2[side][p];
        const xc = cx + (side ? 1 : -1) * G.d2, yc = cy + (half ? 1 : -1) * G.d4;
        out[k][s] = P(xc, yc + (p === 0 ? -0.2 : 0.2) * G.r4, a, sc);
      }
    }
  }
  return out;
}

function cellsFor(ph) {
  const { cx, cy, R, d2, r2, d4, r4 } = G;
  if (ph <= 4) return [0, 1, 2, 3].map(() => ({ x: cx, y: cy, r: R }));
  if (ph <= 7) return [{ x: cx - d2, y: cy, r: r2 }, { x: cx - d2, y: cy, r: r2 }, { x: cx + d2, y: cy, r: r2 }, { x: cx + d2, y: cy, r: r2 }];
  return [{ x: cx - d2, y: cy - d4, r: r4 }, { x: cx - d2, y: cy + d4, r: r4 }, { x: cx + d2, y: cy - d4, r: r4 }, { x: cx + d2, y: cy + d4, r: r4 }];
}

const lerpP = (a, b, e) => P(K.lerp(a.x, b.x, e), K.lerp(a.y, b.y, e), K.lerp(a.a, b.a, e), K.lerp(a.sc, b.sc, e), K.lerp(a.al, b.al, e));
const cloneLayout = (L) => L.map((row) => row.map((q) => ({ ...q })));

// point at fraction f along a chromatid (f = 0 top end, 1 bottom end in local coords)
function along(q, p, f) {
  const L = Ld(p, q.sc), ly = -L / 2 + f * L;
  return { x: q.x - Math.sin(q.a) * ly, y: q.y + Math.cos(q.a) * ly };
}
function bbox(list) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [k, s] of list) {
    const q = S.cur[k][s], p = k >> 1, L = Ld(p, q.sc), W = Wd(q.sc);
    const hx = Math.abs(Math.sin(q.a)) * L / 2 + Math.abs(Math.cos(q.a)) * W / 2;
    const hy = Math.abs(Math.cos(q.a)) * L / 2 + Math.abs(Math.sin(q.a)) * W / 2;
    x0 = Math.min(x0, q.x - hx); x1 = Math.max(x1, q.x + hx);
    y0 = Math.min(y0, q.y - hy); y1 = Math.max(y1, q.y + hy);
  }
  return { x0, y0, x1, y1 };
}
const inBox = (b, x, y, pad = 14) => x >= b.x0 - pad && x <= b.x1 + pad && y >= b.y0 - pad && y <= b.y1 + pad;
const bivalentIds = (p) => [[2 * p, 0], [2 * p, 1], [2 * p + 1, 0], [2 * p + 1, 1]];

// ---------------------------------------------------------------- phase control
function snapshot() {
  S.from = cloneLayout(S.cur || layoutFor(S.phase));
  S.fromCells = (S.curCells || cellsFor(S.phase)).map((c) => ({ ...c }));
}
function newRun() {
  S.cross = [[], []];
  S.ch = build(S.cross);
  S.orient = randOrient(); S.disp = S.orient.slice();
  S.orient2 = randOrient2(); S.disp2 = S.orient2.map((a) => a.slice());
  S.gametes = null; S.fert = null; S.drag = null;
  S.phase = 0; S.pt = 0; S.held = 0;
  S.from = layoutFor(0); S.fromCells = cellsFor(0);
  S.cur = null;
  fadeIn = 0;
  syncButtons();
}
let fadeIn = 1;
function goTo(ph) {
  snapshot();
  S.phase = ph; S.pt = 0; S.held = 0; S.drag = null;
  if (ph === 2 && (S.auto || S.preRandom)) { S.cross = randomCross(); S.ch = build(S.cross); S.preRandom = false; }
  if (ph === 3 && S.auto) { S.orient = randOrient(); }
  if (ph === 6 && S.auto) { S.orient2 = randOrient2(); }
  if (ph === 6) S.disp2 = S.orient2.map((a) => a.slice());
  if (ph === 9) recordGametes();
  syncButtons();
}
function next() {
  if (S.fert) return;
  if (S.phase < 9) goTo(S.phase + 1);
  else newRun();
}
function recordGametes() {
  S.gametes = gametesFrom(S.ch, S.orient, S.orient2);
  S.runs++; S.watchedRuns++;
  for (const g of S.gametes) { S.tally[g.geno] = (S.tally[g.geno] || 0) + 1; S.watched.add(g.geno); }
  renderTally();
}
function batchRuns(n) {
  for (let i = 0; i < n; i++) {
    const gs = gametesFrom(build(randomCross()), randOrient(), randOrient2());
    for (const g of gs) S.tally[g.geno] = (S.tally[g.geno] || 0) + 1;
    S.runs++;
  }
  renderTally();
  const u = Object.keys(S.tally).length;
  toast(`Added ${n} random meioses (${n * 4} gametes) · <b>${u}</b> of 8 gamete types found`);
}
function randomise() {
  const ph = S.phase;
  if (ph <= 1) { S.preRandom = true; S.orient = randOrient(); S.orient2 = randOrient2(); toast("Random crossovers will form in prophase I; orientations randomised"); }
  else if (ph === 2) { S.cross = randomCross(); S.ch = build(S.cross); S.orient = randOrient(); S.orient2 = randOrient2(); toast("Random chiasmata placed"); }
  else if (ph === 3) { S.orient = randOrient(); S.orient2 = randOrient2(); toast("Bivalent orientations randomised"); }
  else if (ph <= 6) { S.orient2 = randOrient2(); toast("Metaphase II orientations randomised"); }
  else { newRun(); S.preRandom = true; toast("New run started with random choices"); }
  if (ph === 2 && S.cross[0].length + S.cross[1].length) S.crossMade = true;
}

// ---------------------------------------------------------------- panel
const explain = K.card(panel, "What's happening", "explain");
const explainBody = document.createElement("div");
explain.appendChild(explainBody);
const notScale = document.createElement("p");
notScale.className = "note";
notScale.innerHTML = "Not to scale: human cells have 2n = 46 (n = 23). Chromosomes are drawn condensed at every stage for clarity (in interphase they are really long, thin chromatin), and the spindle is simplified.";
explain.appendChild(notScale);

const controls = K.card(panel, "Controls");
const row1 = K.buttonRow(controls);
const nextBtn = K.button(row1, "Next ▸", () => next(), { kind: "primary" });
const pauseBtn = K.button(row1, "Pause", () => { pauseBtn.textContent = L.toggle() ? "Pause" : "Play"; });
K.button(row1, "New run", () => { newRun(); toast("New germ cell: 2n = 4"); });
const row2 = K.buttonRow(controls);
K.button(row2, "Randomise", randomise);
K.button(row2, "+10 random meioses", () => batchRuns(10));
K.slider(controls, {
  label: "Speed", min: 0.25, max: 3, step: 0.25, value: reduceMotion ? 0.5 : 1,
  format: (v) => `${v}×`, onInput: (v) => (L.speed = v),
});
K.checkbox(controls, "Auto-play with random choices (loops runs)", false, (v) => { S.auto = v; });

const missionList = K.missions(panel, [
  { text: "Create a crossover: place a chiasma on a bivalent in prophase I", check: () => S.crossMade },
  { text: "Show both metaphase I arrangements (pink chromosomes together, then on opposite sides)", check: () => S.orientSeen.size >= 2 },
  { text: "Complete meiosis: reach four haploid cells", check: () => S.runs > 0 && S.watchedRuns > 0 },
  { text: "Produce a recombinant gamete (Ab or aB)", check: () => [...S.watched].some(isRecomb) },
  { text: "Collect all 4 parental allele combinations (ABD, ABd, abD, abd) by independent assortment", check: () => PARENTAL.every((g) => S.watched.has(g)) },
  { text: "Fertilise a gamete to restore the diploid number (2n = 4)", check: () => S.zygotes > 0 },
], (m) => toast(`Mission complete: ${m.text}`, 3200));

const tallyCard = K.card(panel, "Gamete tally");
const tallyBody = document.createElement("div");
tallyCard.appendChild(tallyBody);
const tr = K.buttonRow(tallyCard);
K.button(tr, "Clear tally", () => { S.tally = {}; S.runs = 0; renderTally(); });
function renderTally() {
  const total = Object.values(S.tally).reduce((a, b) => a + b, 0);
  const unique = Object.keys(S.tally).length;
  const cell = (t) => {
    const n = S.tally[t] || 0, rec = isRecomb(t);
    return `<div class="tcell ${n ? "found" : ""} ${rec ? "rec" : ""}"><b>${t}</b><span>${n}</span><em>${rec ? "recombinant" : "parental"}</em></div>`;
  };
  let html = `<p>Runs: <strong>${S.runs}</strong> · gametes: <strong>${total}</strong></p>
    <div class="tally">${PARENTAL.map(cell).join("")}${RECOMB.map(cell).join("")}</div>
    <p>You've made <strong>${unique}</strong> unique gamete type${unique === 1 ? "" : "s"} out of <strong>2<sup>n</sup> = 4</strong> possible by independent assortment (n = 2) <strong>+ 4 recombinant</strong> types from crossing over.</p>`;
  if (S.lastZygote) html += `<div class="zyg">Last zygote: <strong>${S.lastZygote}</strong> (2n = 4)</div>`;
  tallyBody.innerHTML = html;
}
renderTally();

const legend = K.card(panel, "Legend");
legend.innerHTML += `<div class="legend">
  <span><i class="bar" style="background:${COL.M}"></i>Maternal chromosome</span>
  <span><i class="bar" style="background:${COL.P}"></i>Paternal chromosome</span>
  <span><i class="bar" style="background:${COL.X}"></i>Other parent (1)</span>
  <span><i class="bar" style="background:${COL.Y}"></i>Other parent (2)</span>
  <span><i style="background:${K.C.violet}"></i>Chiasma (crossover)</span>
  <span><i style="background:${K.C.green}"></i>Spindle pole</span>
  <span class="wide">Dark bands = gene loci. Capital letter = dominant allele (A, B, D); lower case = recessive (a, b, d). Genes A and B are linked on pair 1; D is on pair 2.</span>
</div>`;

const cmp = K.card(panel, "Compare with mitosis");
cmp.innerHTML += `<table class="cmp">
  <tr><th></th><th>Mitosis</th><th>Meiosis</th></tr>
  <tr><td>Divisions</td><td>1</td><td>2 (meiosis I and II)</td></tr>
  <tr><td>Cells made</td><td>2</td><td>4</td></tr>
  <tr><td>Ploidy of products</td><td>Diploid (2n), same as parent</td><td>Haploid (n), half the parent</td></tr>
  <tr><td>Homologues pair?</td><td>No</td><td>Yes, form bivalents in prophase I</td></tr>
  <tr><td>Crossing over</td><td>No</td><td>Yes, prophase I</td></tr>
  <tr><td>What separates at anaphase</td><td>Sister chromatids</td><td>Homologues (I), then sister chromatids (II)</td></tr>
  <tr><td>Products genetically</td><td>Identical to parent and each other</td><td>Different from parent and each other</td></tr>
  <tr><td>Used for</td><td>Growth, repair, asexual reproduction</td><td>Making gametes for sexual reproduction</td></tr>
</table>`;

K.quiz(panel, [
  {
    q: "A human gamete contains 23 chromosomes. Which describes it?",
    options: ["Diploid, 2n = 46", "Haploid, n = 23", "Diploid, 2n = 23", "Haploid, n = 46"], answer: 1,
    why: "Gametes are haploid: they carry one chromosome from each homologous pair (n = 23). Body cells are diploid (2n = 46).",
  },
  {
    q: "When do homologous chromosomes separate, and when do sister chromatids separate?",
    options: ["Homologues in anaphase II; sisters in anaphase I", "Both in anaphase I", "Homologues in anaphase I; sisters in anaphase II", "Both in anaphase II"], answer: 2,
    why: "Anaphase I pulls homologues apart (the reduction division, 2n → n). Anaphase II splits the centromeres so sister chromatids separate.",
  },
  {
    q: "Which two processes in meiosis produce genetic variation among gametes?",
    options: ["DNA replication and cytokinesis", "Crossing over and independent assortment", "Spindle formation and cytokinesis", "Mitosis and DNA repair"], answer: 1,
    why: "Crossing over (prophase I) recombines alleles on a chromosome; independent assortment (metaphase I) shuffles whole chromosomes. Random fertilisation then adds even more variation.",
  },
  {
    q: "Why must gametes be haploid?",
    options: ["So they can divide by mitosis faster", "So fertilisation restores the diploid number instead of doubling it each generation", "Because haploid cells contain more DNA", "So that crossing over can happen in the zygote"], answer: 1,
    why: "n + n = 2n. If gametes were diploid, the zygote would be 4n and the chromosome number would double every generation.",
  },
  {
    q: "Crossing over occurs…",
    options: ["in prophase I, between non-sister chromatids of homologous chromosomes", "in prophase II, between sister chromatids", "in metaphase I, between non-homologous chromosomes", "in anaphase II, as the centromeres split"], answer: 0,
    why: "During prophase I homologues pair up as bivalents; non-sister chromatids exchange segments at chiasmata, making recombinant chromatids.",
  },
]);

const chipStage = K.chip(overlay);
const chipPloidy = K.chip(overlay);
const chipChrom = K.chip(overlay);
const chipCells = K.chip(overlay);

function syncButtons() {
  nextBtn.textContent = S.phase < 9 ? `Next ▸ ${NAMES[S.phase + 1]}` : "New run ↻";
}
syncButtons();

// ---------------------------------------------------------------- explain text
function chromatidSummary() {
  // describe recombinant chromatids on pair 1
  let rec = 0;
  for (const k of [0, 1]) for (const s of [0, 1]) {
    const b = S.ch[k][s];
    if (atLocus(b, LOCI[0][0].pos) !== atLocus(b, LOCI[0][1].pos)) rec++;
  }
  return rec;
}
function explainHTML() {
  const ph = S.phase, nx = S.cross[0].length + S.cross[1].length;
  switch (ph) {
    case 0: return `<p><strong>Interphase (G1).</strong> This germ cell is <strong>diploid (2n = 4)</strong>: two <strong>homologous pairs</strong>. In each pair one chromosome came from the mother (pink) and one from the father (blue). Homologues carry the <strong>same genes</strong> but can carry different <strong>alleles</strong> (A or a).</p><p>Press <strong>Next</strong> to replicate the DNA.</p>`;
    case 1: return `<p><strong>S phase: DNA replication.</strong> Each chromosome copies itself, making two identical <strong>sister chromatids</strong> joined at a <strong>centromere</strong>. Still 4 chromosomes, but now 8 chromatids.</p>`;
    case 2: return `<p><strong>Prophase I.</strong> Homologous chromosomes pair up (<strong>synapsis</strong>) to form <strong>bivalents</strong> (tetrads of 4 chromatids). <strong>Non-sister chromatids</strong> can <strong>cross over</strong> at points called <strong>chiasmata</strong>, swapping matching segments and the alleles on them.</p>
      <p><strong>Tap or drag along a bivalent</strong> to place a chiasma; tap a chiasma to remove it. Chiasmata placed: <strong>${nx}</strong>.${nx ? ` Recombinant chromatids on pair 1: <strong>${chromatidSummary()}</strong> (a crossover <em>between</em> genes A and B gives Ab and aB).` : ""}</p>`;
    case 3: {
      const same = S.orient[0] === S.orient[1];
      return `<p><strong>Metaphase I.</strong> Bivalents line up on the <strong>equator</strong>. Which homologue faces which pole is <strong>random for each pair</strong>: this is <strong>independent assortment</strong>.</p>
      <p>Right now the maternal (pink) chromosomes face <strong>${same ? "the same pole" : "opposite poles"}</strong>. <strong>Tap a bivalent to flip it.</strong> With n = 2 there are 2<sup>n−1</sup> = 2 arrangements, giving 2<sup>n</sup> = 4 chromosome combinations in gametes (for humans, 2<sup>23</sup> ≈ 8.4 million).</p>`;
    }
    case 4: return `<p><strong>Anaphase I.</strong> Spindle fibres pull <strong>homologous chromosomes</strong> to opposite poles. Sister chromatids stay joined at their centromeres. This is the <strong>reduction division</strong>: each pole receives one chromosome from each pair.</p>`;
    case 5: return `<p><strong>Telophase I and cytokinesis.</strong> Two cells form. Each is <strong>haploid (n = 2)</strong>: one chromosome of each pair, though each chromosome still has two chromatids. Because of crossing over, sister chromatids may <strong>no longer be identical</strong>.</p>`;
    case 6: return `<p><strong>Meiosis II</strong> (no DNA replication beforehand). In each cell the chromosomes line up <strong>singly</strong> on the equator with sister chromatids facing opposite poles. If crossing over made the sisters different, which one goes to which pole matters too.</p><p><strong>Tap a chromosome to flip it.</strong></p>`;
    case 7: return `<p><strong>Anaphase II.</strong> Centromeres split and <strong>sister chromatids separate</strong>; each chromatid is now a chromosome in its own right, moving to opposite poles.</p>`;
    case 8: return `<p><strong>Telophase II.</strong> Cytokinesis produces <strong>four haploid cells</strong> from one diploid cell. These become gametes.</p>`;
    case 9: {
      const gs = S.gametes || [];
      const list = gs.map((g) => `<strong>${g.geno}</strong>${isRecomb(g.geno) ? " (recombinant)" : ""}`).join(", ");
      const u = new Set(gs.map((g) => g.geno)).size;
      return `<p><strong>Four haploid gametes:</strong> ${list}. This run made <strong>${u}</strong> different genotype${u === 1 ? "" : "s"}.</p>
      <p><strong>Tap a gamete</strong> to fertilise it with a random gamete from another parent (teal/amber chromosomes). Fertilisation restores <strong>2n</strong> and adds even more variation.</p>`;
    }
  }
  return "";
}
let lastExplain = "";
function updateExplain() {
  let h = explainHTML();
  if (S.fert && S.fert.t >= 1) h = `<p><strong>Fertilisation.</strong> Haploid gamete (n = 2) + haploid gamete (n = 2) → <strong>diploid zygote (2n = 4)</strong>. Zygote genotype: <strong>${S.fert.zgeno}</strong>. Each homologous pair now has one chromosome from each parent.</p><p>Tap the stage to return to the gametes.</p>`;
  if (h !== lastExplain) { explainBody.innerHTML = h; lastExplain = h; }
}

// ---------------------------------------------------------------- background particles
function makeSprite(color) {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d");
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, K.withAlpha(color, 0.9));
  gr.addColorStop(0.35, K.withAlpha(color, 0.35));
  gr.addColorStop(1, K.withAlpha(color, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return c;
}
const SPR = [makeSprite(K.C.teal), makeSprite(K.C.violet), makeSprite("#9ec9ff")];
const bg = K.makeParticles(70, () => ({ x: Math.random(), y: Math.random(), z: K.rand(0.25, 1), vx: K.rand(-0.004, 0.004), vy: K.rand(-0.006, 0.002), s: K.randInt(0, 2) }));
const specks = K.makeParticles(90, () => ({ x: Math.random(), y: Math.random(), vx: K.rand(-0.01, 0.01), vy: K.rand(-0.01, 0.01), r: K.rand(2, 5) }));

// ---------------------------------------------------------------- drawing
function capsule(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function chromPath(Lp, W, c) {
  const top = -Lp / 2, cyl = top + c * Lp, pinch = W * 0.1;
  ctx.beginPath();
  capsule(-W / 2, top, W, c * Lp + pinch, W / 2);
  capsule(-W / 2, cyl - pinch, W, Lp - c * Lp + pinch, W / 2);
}
function drawChromatid(q, p, bins, hl = false) {
  if (q.al <= 0.01) return;
  const Lp = Ld(p, q.sc), W = Wd(q.sc);
  ctx.save();
  ctx.globalAlpha = q.al;
  ctx.translate(q.x, q.y); ctx.rotate(q.a);
  chromPath(Lp, W, CEN[p]);
  ctx.save();
  ctx.clip();
  let i0 = 0;
  for (let i = 1; i <= N; i++) {
    if (i === N || bins[i] !== bins[i0]) {
      ctx.fillStyle = COL[bins[i0]];
      ctx.fillRect(-W / 2 - 1, -Lp / 2 + (i0 / N) * Lp, W + 2, ((i - i0) / N) * Lp + 0.6);
      i0 = i;
    }
  }
  const gl = ctx.createLinearGradient(-W / 2, 0, W / 2, 0);
  gl.addColorStop(0, "rgba(0,0,0,0.42)");
  gl.addColorStop(0.32, "rgba(255,255,255,0.32)");
  gl.addColorStop(0.55, "rgba(255,255,255,0.05)");
  gl.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = gl;
  ctx.fillRect(-W / 2, -Lp / 2, W, Lp);
  const fs = K.clamp(W * 0.78, 8, 14), bh = fs + 3;
  for (const l of LOCI[p]) {
    const yy = -Lp / 2 + l.pos * Lp;
    ctx.fillStyle = K.shade(COL[atLocus(bins, l.pos)], -0.62);
    ctx.fillRect(-W / 2, yy - bh / 2, W, bh);
  }
  ctx.restore();
  ctx.lineWidth = hl ? 2 : 1;
  ctx.strokeStyle = hl ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.28)";
  ctx.stroke();
  ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const l of LOCI[p]) {
    const yy = -Lp / 2 + l.pos * Lp;
    const a = allele(atLocus(bins, l.pos), l.gene);
    ctx.save();
    ctx.translate(0, yy); ctx.rotate(-q.a);
    ctx.fillStyle = a === l.gene ? "#fff6d8" : "#d6e6ff";
    ctx.fillText(a, 0, 0.5);
    ctx.restore();
  }
  ctx.restore();
}

function drawCells(cells, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  let bx = 0, by = 0, ext = 0;
  for (const c of cells) { ctx.moveTo(c.x + c.r, c.y); ctx.arc(c.x, c.y, c.r, 0, K.TAU); bx += c.x / cells.length; by += c.y / cells.length; }
  for (const c of cells) ext = Math.max(ext, K.dist(bx, by, c.x, c.y) + c.r);
  ctx.lineWidth = 16; ctx.strokeStyle = K.withAlpha(K.C.violet, 0.12); ctx.stroke();
  ctx.lineWidth = 8; ctx.strokeStyle = K.withAlpha("#c9b8e6", 0.95); ctx.stroke();
  const g = ctx.createRadialGradient(bx, by - ext * 0.2, 0, bx, by, ext);
  g.addColorStop(0, "#14405a");
  g.addColorStop(0.7, "#0d2c42");
  g.addColorStop(1, "#0a2033");
  ctx.fillStyle = g;
  ctx.fill();
  // cytosol specks, clipped to the cell(s)
  ctx.save();
  ctx.clip();
  ctx.globalAlpha = alpha * 0.5;
  for (const s of specks) ctx.drawImage(SPR[0], s.x * G.w - s.r * 2, s.y * G.h - s.r * 2, s.r * 4, s.r * 4);
  ctx.restore();
  ctx.restore();
  // inner leaflet line (only where it does not overlap another cell)
  ctx.save();
  ctx.globalAlpha = alpha * 0.55;
  ctx.strokeStyle = "rgba(201,184,230,0.5)"; ctx.lineWidth = 1;
  ctx.setLineDash([2, 4]);
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    let dup = false;
    for (let j = 0; j < i; j++) if (K.dist(c.x, c.y, cells[j].x, cells[j].y) < 1 && Math.abs(c.r - cells[j].r) < 1) dup = true;
    if (dup) continue;
    const overl = cells.some((o) => o !== c && K.dist(c.x, c.y, o.x, o.y) < c.r + o.r - 4 && K.dist(c.x, c.y, o.x, o.y) > 1);
    if (overl) continue;
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r - 7, 0, K.TAU); ctx.stroke();
  }
  ctx.restore();
}

function drawPole(x, y, a) {
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.strokeStyle = "rgba(190,240,210,0.35)"; ctx.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * K.TAU;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(ang) * 6, y + Math.sin(ang) * 6);
    ctx.lineTo(x + Math.cos(ang) * 16, y + Math.sin(ang) * 16); ctx.stroke();
  }
  K.glow(ctx, x, y, 22, K.C.green, 0.45 * a);
  K.sphere(ctx, x, y, 5.5, K.C.green);
  ctx.restore();
}
function fibre(x0, y0, x1, y1, a, bow = 0) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.strokeStyle = "rgba(200,235,255,0.42)"; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(x0, y0);
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny) || 1;
  ctx.quadraticCurveTo(mx + (nx / nl) * bow, my + (ny / nl) * bow, x1, y1);
  ctx.stroke();
  ctx.restore();
}
const cenMid = (k, pos) => {
  const p = k >> 1, a = along(pos[k][0], p, CEN[p]), b = along(pos[k][1], p, CEN[p]);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
};

function drawChiasmata(alpha) {
  if (alpha <= 0.01) return;
  for (let p = 0; p < 2; p++) {
    S.cross[p].forEach((c, idx) => {
      const m = S.cur[2 * p][c.m], q = S.cur[2 * p + 1][c.p];
      const a = along(m, p, c.x), b = along(q, p, c.x);
      const W = Wd(m.sc), dy = W * 0.8;
      const hot = S.drag && S.drag.p === p && S.drag.idx === idx;
      ctx.save();
      ctx.globalAlpha = alpha;
      K.glow(ctx, (a.x + b.x) / 2, (a.y + b.y) / 2, W * 2.2, K.C.violet, hot ? 0.9 : 0.6);
      ctx.lineCap = "round";
      for (const [lw, col] of [[5, "rgba(20,10,40,0.7)"], [3, hot ? "#ffffff" : "#c4b5fd"]]) {
        ctx.strokeStyle = col; ctx.lineWidth = lw;
        ctx.beginPath(); ctx.moveTo(a.x, a.y - dy); ctx.lineTo(b.x, b.y + dy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(a.x, a.y + dy); ctx.lineTo(b.x, b.y - dy); ctx.stroke();
      }
      K.sphere(ctx, (a.x + b.x) / 2, (a.y + b.y) / 2, Math.max(3, W * 0.22), K.C.violet);
      ctx.restore();
    });
  }
}

let nextRect = null;
function drawNextButton(t) {
  const waiting = S.pt >= DUR[S.phase] && !AUTO_PHASES.has(S.phase);
  const text = S.phase < 9 ? `Next ▸ ${NAMES[S.phase + 1]}` : "New run ↻";
  ctx.save();
  ctx.font = "600 13px Inter, system-ui, sans-serif";
  const tw = ctx.measureText(text).width, bw = tw + 26, bh = 34;
  const x = G.w - bw - 14, y = G.h - bh - 14;
  nextRect = { x, y, w: bw, h: bh };
  if (waiting) K.glow(ctx, x + bw / 2, y + bh / 2, bw * 0.7, K.C.teal, 0.18 + 0.1 * Math.sin(t * 3));
  K.roundRect(ctx, x, y, bw, bh, 12);
  ctx.fillStyle = waiting ? K.C.teal : "rgba(10,22,40,0.85)";
  ctx.fill();
  ctx.strokeStyle = waiting ? K.C.teal : "rgba(120,190,255,0.3)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = waiting ? "#032024" : K.C.ink;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, x + bw / 2, y + bh / 2 + 0.5);
  ctx.restore();
}
const HINTS = {
  0: "Press Next to replicate the DNA",
  2: "Tap or drag along a bivalent to place a chiasma",
  3: "Tap a bivalent to flip its orientation",
  6: "Tap a chromosome to flip which chromatid goes up",
  9: "Tap a gamete to fertilise it",
};

// ---------------------------------------------------------------- fertilisation
function startFert(g) {
  const gm = S.gametes[g];
  const other = otherGamete();
  const loci = [[0, LOCI[0][0]], [0, LOCI[0][1]], [1, LOCI[1][0]]];
  const z = loci.map(([p, l]) => pairStr(allele(atLocus(gm.parts[p].bins, l.pos), l.gene), allele(atLocus(other[p].bins, l.pos), l.gene))).join(" ");
  S.fert = { g, t: 0, other, zgeno: z };
}
function drawFert(dt) {
  const F = S.fert;
  F.t = Math.min(1, F.t + dt / 1.8);
  const e = K.easeInOut(F.t);
  const { cx, cy, R, w } = G;
  ctx.save();
  ctx.fillStyle = `rgba(5,11,22,${0.62 * Math.min(1, F.t * 3)})`;
  ctx.fillRect(0, 0, G.w, G.h);
  ctx.restore();
  const Rz = R * 0.78;
  const gc = cellsFor(9)[F.g];
  const oc0 = { x: w + G.r4, y: cy, r: G.r4 * 0.8 };
  drawCells([
    { x: K.lerp(gc.x, cx, e), y: K.lerp(gc.y, cy, e), r: K.lerp(gc.r, Rz, e) },
    { x: K.lerp(oc0.x, cx, e), y: K.lerp(oc0.y, cy, e), r: K.lerp(oc0.r, Rz, e) },
  ]);
  if (F.t >= 1) {
    // nuclear envelope of zygote
    ctx.save(); ctx.strokeStyle = "rgba(201,184,230,0.35)"; ctx.setLineDash([4, 5]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, Rz * 0.7, 0, K.TAU); ctx.stroke(); ctx.restore();
  }
  const lay9 = layoutFor(9);
  const W = Wd(1);
  const gm = S.gametes[F.g];
  for (const part of gm.parts) {
    const from = lay9[part.k][part.s];
    const tx = cx + (part.p === 0 ? -0.3 : 0.3) * Rz - 0.62 * W;
    drawChromatid(lerpP(from, P(tx, cy, 0, 1), e), part.p, part.bins);
  }
  for (const part of F.other) {
    const from = P(oc0.x, oc0.y + (part.p === 0 ? -0.2 : 0.2) * G.r4, -Math.PI / 2, G.sc4);
    const tx = cx + (part.p === 0 ? -0.3 : 0.3) * Rz + 0.62 * W;
    drawChromatid(lerpP(from, P(tx, cy, 0, 1), e), part.p, part.bins);
  }
  if (F.t >= 1) {
    K.label(ctx, `Zygote genotype: ${F.zgeno}  ·  2n = 4`, cx, cy + Rz * 0.82, { size: 14, color: K.C.amber });
    K.label(ctx, "Tap to return to the gametes", cx, cy - Rz * 0.84, { size: 11, color: K.C.inkDim });
  }
}

// ---------------------------------------------------------------- input
function hitTest(x, y) {
  if (nextRect && x >= nextRect.x && x <= nextRect.x + nextRect.w && y >= nextRect.y && y <= nextRect.y + nextRect.h) return { type: "next" };
  if (S.fert) return { type: "fert" };
  if (!S.cur || S.pt < DUR[S.phase] * 0.7) return null;
  const ph = S.phase;
  if (ph === 2 || ph === 3) {
    for (let p = 0; p < 2; p++) if (inBox(bbox(bivalentIds(p)), x, y, 16)) return { type: ph === 2 ? "biv" : "flip", p };
  } else if (ph === 6) {
    for (let k = 0; k < 4; k++) if (inBox(bbox([[k, 0], [k, 1]]), x, y, 12)) return { type: "flip2", k };
  } else if (ph === 9) {
    const cs = cellsFor(9);
    for (let g = 0; g < 4; g++) if (K.dist(x, y, cs[g].x, cs[g].y) < cs[g].r) return { type: "gamete", g };
  }
  return null;
}
function posOnBivalent(p, y) {
  const q = S.cur[2 * p][0], Lp = Ld(p, q.sc);
  return (y - (q.y - Lp / 2)) / Lp;
}
const ptr = K.pointer(canvas, {
  down(pt) {
    const h = hitTest(pt.x, pt.y);
    if (!h) return;
    if (h.type === "next") { next(); return; }
    if (h.type === "fert") { if (S.fert.t >= 1) { S.fert = null; } return; }
    if (h.type === "biv") {
      const p = h.p, Lp = Ld(p, S.cur[2 * p][0].sc);
      const raw = posOnBivalent(p, pt.y);
      const idx = S.cross[p].findIndex((c) => Math.abs(c.x - raw) * Lp < 14);
      S.drag = { p, idx, x: validPos(p, raw), y0: pt.y, moved: false };
    } else if (h.type === "flip") {
      S.orient[h.p] ^= 1;
    } else if (h.type === "flip2") {
      const k = h.k, p = k >> 1, side = sideOf(k, S.orient);
      S.orient2[side][p] ^= 1;
    } else if (h.type === "gamete") {
      startFert(h.g);
    }
  },
  move(pt) {
    if (S.drag) {
      const d = S.drag;
      if (Math.abs(pt.y - d.y0) > 5) d.moved = true;
      d.x = validPos(d.p, posOnBivalent(d.p, pt.y));
      if (d.idx >= 0 && d.moved) { S.cross[d.p][d.idx].x = d.x; S.ch = build(S.cross); }
      return;
    }
    const h = hitTest(pt.x, pt.y);
    S.hover = h;
    canvas.style.cursor = h ? "pointer" : "default";
  },
  up() {
    const d = S.drag;
    if (!d) return;
    S.drag = null;
    if (d.idx >= 0) {
      if (!d.moved) { S.cross[d.p].splice(d.idx, 1); toast("Chiasma removed"); }
    } else {
      if (S.cross[d.p].length >= MAX_X) { toast(`Maximum ${MAX_X} chiasmata per bivalent in this model`); return; }
      const [m, q] = CYCLE[S.cross[d.p].length % CYCLE.length];
      S.cross[d.p].push({ x: d.x, m, p: q });
      S.crossMade = true;
    }
    S.ch = build(S.cross);
  },
});

// ---------------------------------------------------------------- main loop
function chipsFor(ph, e) {
  const st = NAMES[ph];
  let ploidy = ph <= 4 ? "2n" : "n", chrom = "4", cmt = "8", cells = "1";
  if (ph === 0) cmt = "4";
  if (ph === 1) cmt = e < 1 ? "4 → 8" : "8";
  if (ph === 5) { chrom = "2"; cmt = "4"; cells = e < 0.6 ? "1 → 2" : "2"; ploidy = e < 0.6 ? "2n → n" : "n"; }
  if (ph === 6) { chrom = "2"; cmt = "4"; cells = "2"; }
  if (ph === 7) { chrom = "2 → 2 + 2"; cmt = "4"; cells = "2"; }
  if (ph >= 8) { chrom = "2"; cmt = "2"; cells = ph === 8 && e < 0.6 ? "2 → 4" : "4"; }
  if (S.fert && S.fert.t >= 1) { return [`Stage <b>Fertilisation</b>`, `Ploidy <b>2n</b> (zygote)`, `Chromosomes/cell <b>4</b>`, `Cells <b>1 zygote</b>`]; }
  return [`Stage <b>${st}</b>`, `Ploidy <b>${ploidy}</b>`, `Chromosomes/cell <b>${chrom}</b> <span style="opacity:.7">(${cmt} chromatids)</span>`, `Cells <b>${cells}</b>`];
}

let lastW = 0, lastH = 0;
const L = K.loop((dt, t) => {
  geom();
  if (G.w !== lastW || G.h !== lastH) {
    // layout is relative to the stage; on resize, restart the current tween from its own target
    if (lastW) { S.from = layoutFor(S.phase); S.fromCells = cellsFor(S.phase); }
    lastW = G.w; lastH = G.h;
  }
  if (!S.from) { S.from = layoutFor(0); S.fromCells = cellsFor(0); }
  const ph = S.phase;
  S.pt += dt;
  fadeIn = Math.min(1, fadeIn + dt * 2);
  const k = Math.min(1, dt * 2.6);
  for (let p = 0; p < 2; p++) {
    S.disp[p] += K.clamp(S.orient[p] - S.disp[p], -k, k);
    for (let sd = 0; sd < 2; sd++) S.disp2[sd][p] += K.clamp(S.orient2[sd][p] - S.disp2[sd][p], -k, k);
  }
  if (ph === 3 && S.pt >= DUR[3] && Math.abs(S.disp[0] - S.orient[0]) < 0.01 && Math.abs(S.disp[1] - S.orient[1]) < 0.01) {
    S.orientSeen.add(S.orient[0] ^ S.orient[1]);
  }
  const e = K.easeInOut(K.clamp(S.pt / DUR[ph], 0, 1));
  const target = layoutFor(ph);
  S.cur = target.map((row, kk) => row.map((q, s) => lerpP(S.from[kk][s], q, e)));
  const tc = cellsFor(ph);
  S.curCells = tc.map((c, i) => ({ x: K.lerp(S.fromCells[i].x, c.x, e), y: K.lerp(S.fromCells[i].y, c.y, e), r: K.lerp(S.fromCells[i].r, c.r, e) }));

  // ---- background
  K.backdrop(ctx, G.w, G.h, "#2a1640");
  const mx = ptr.inside ? (ptr.x / G.w - 0.5) : 0, my = ptr.inside ? (ptr.y / G.h - 0.5) : 0;
  for (const b of bg) {
    b.x = (b.x + b.vx * dt + 1) % 1; b.y = (b.y + b.vy * dt + 1) % 1;
    const sz = 6 + b.z * 16;
    ctx.globalAlpha = 0.12 + b.z * 0.3;
    ctx.drawImage(SPR[b.s], b.x * G.w - mx * 30 * b.z - sz / 2, b.y * G.h - my * 30 * b.z - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1;
  for (const s of specks) { s.x = (s.x + s.vx * dt + 1) % 1; s.y = (s.y + s.vy * dt + 1) % 1; }

  // ---- cells
  drawCells(S.curCells, fadeIn);

  // nuclear envelope
  const nucA = ph <= 1 ? 1 : ph === 2 ? 1 - e : 0;
  if (nucA > 0.01) {
    ctx.save(); ctx.globalAlpha = nucA * fadeIn;
    const nr = G.R * 0.7;
    const ng = ctx.createRadialGradient(G.cx, G.cy, nr * 0.2, G.cx, G.cy, nr);
    ng.addColorStop(0, "rgba(40,30,80,0.35)"); ng.addColorStop(1, "rgba(60,40,110,0.25)");
    ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(G.cx, G.cy, nr, 0, K.TAU); ctx.fill();
    ctx.strokeStyle = "rgba(201,184,230,0.55)"; ctx.lineWidth = 2; ctx.setLineDash([10, 5]);
    ctx.stroke(); ctx.restore();
  }
  if (ph === 9 && !S.fert) {
    ctx.save(); ctx.globalAlpha = 0.45 * e; ctx.strokeStyle = "rgba(201,184,230,0.6)"; ctx.setLineDash([4, 5]);
    for (const c of S.curCells) { ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 0.66, 0, K.TAU); ctx.stroke(); }
    ctx.restore();
  }

  // ---- spindle (meiosis I)
  const sp1 = ph === 3 ? e : ph === 4 ? 1 : ph === 5 ? 1 - e : 0;
  if (sp1 > 0.01) {
    const PL = { x: G.cx - G.R * 0.84, y: G.cy }, PR = { x: G.cx + G.R * 0.84, y: G.cy };
    for (let kk = 0; kk < 4; kk++) {
      const side = sideOf(kk, S.orient), pole = side ? PR : PL, c = cenMid(kk, S.cur);
      fibre(pole.x, pole.y, c.x, c.y, sp1);
    }
    for (const bow of [-G.R * 0.25, G.R * 0.25]) fibre(PL.x, PL.y, PR.x, PR.y, sp1 * 0.6, bow);
    if (ph === 3) {
      ctx.save(); ctx.globalAlpha = sp1 * 0.5; ctx.strokeStyle = K.C.amber; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(G.cx, G.cy - G.R * 0.78); ctx.lineTo(G.cx, G.cy + G.R * 0.78); ctx.stroke(); ctx.restore();
    }
    drawPole(PL.x, PL.y, sp1); drawPole(PR.x, PR.y, sp1);
  }
  // ---- spindles (meiosis II)
  const sp2 = ph === 6 ? e : ph === 7 ? 1 : ph === 8 ? 1 - e : 0;
  if (sp2 > 0.01) {
    for (let side = 0; side < 2; side++) {
      const xc = G.cx + (side ? 1 : -1) * G.d2;
      const PT = { x: xc, y: G.cy - G.r2 * 0.86 }, PB = { x: xc, y: G.cy + G.r2 * 0.86 };
      for (let kk = 0; kk < 4; kk++) {
        if (sideOf(kk, S.orient) !== side) continue;
        const p = kk >> 1;
        for (let s = 0; s < 2; s++) {
          const half = s ^ S.orient2[side][p], pole = half ? PB : PT, c = along(S.cur[kk][s], p, CEN[p]);
          fibre(pole.x, pole.y, c.x, c.y, sp2);
        }
      }
      if (ph === 6) {
        ctx.save(); ctx.globalAlpha = sp2 * 0.5; ctx.strokeStyle = K.C.amber; ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.moveTo(xc - G.r2 * 0.8, G.cy); ctx.lineTo(xc + G.r2 * 0.8, G.cy); ctx.stroke(); ctx.restore();
      }
      drawPole(PT.x, PT.y, sp2); drawPole(PB.x, PB.y, sp2);
    }
  }

  // ---- chromosomes
  const hovP = S.hover && (S.hover.type === "biv" || S.hover.type === "flip") ? S.hover.p : -1;
  const hovK = S.hover && S.hover.type === "flip2" ? S.hover.k : -1;
  for (let kk = 0; kk < 4; kk++) {
    const p = kk >> 1, q = S.cur[kk][0];
    K.glow(ctx, q.x, q.y, Ld(p, q.sc) * 0.55, COL[kk & 1 ? "P" : "M"], (hovP === p || hovK === kk ? 0.3 : 0.14) * fadeIn);
  }
  for (let kk = 0; kk < 4; kk++) {
    const p = kk >> 1;
    for (let s = 0; s < 2; s++) {
      const q = { ...S.cur[kk][s], al: S.cur[kk][s].al * fadeIn };
      drawChromatid(q, p, S.ch[kk][s], hovP === p || hovK === kk);
    }
    // centromere / kinetochore while sisters are joined
    const a = along(S.cur[kk][0], p, CEN[p]), b = along(S.cur[kk][1], p, CEN[p]);
    const W = Wd(S.cur[kk][0].sc);
    if (K.dist(a.x, a.y, b.x, b.y) < W * 1.4) {
      K.sphere(ctx, (a.x + b.x) / 2, (a.y + b.y) / 2, W * 0.36, "#e6dcff", { alpha: fadeIn });
    }
  }
  // chiasmata
  const chA = ph === 2 ? e : ph === 3 ? 1 : ph === 4 ? 1 - Math.min(1, S.pt / (DUR[4] * 0.35)) : 0;
  drawChiasmata(chA);
  // ghost chiasma while dragging a new one
  if (S.drag && S.drag.idx < 0) {
    const p = S.drag.p, ids = bivalentIds(p), b = bbox(ids);
    const yy = S.cur[2 * p][0].y - Ld(p, 1) / 2 + S.drag.x * Ld(p, 1);
    ctx.save(); ctx.strokeStyle = K.C.violet; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(b.x0 - 10, yy); ctx.lineTo(b.x1 + 10, yy); ctx.stroke(); ctx.restore();
    K.label(ctx, "release to cross over here", (b.x0 + b.x1) / 2, b.y0 - 16, { size: 11, color: K.C.violet });
  }

  // labels
  if (ph === 2 && e > 0.8) {
    for (let p = 0; p < 2; p++) {
      const b = bbox(bivalentIds(p));
      K.label(ctx, p === 0 ? "Bivalent 1 (long)" : "Bivalent 2 (short)", (b.x0 + b.x1) / 2, b.y0 - 16, { size: 11, color: K.C.inkDim });
    }
  }
  if (ph === 3 && e > 0.8 && G.w > 420) {
    K.label(ctx, "pole", G.cx - G.R * 0.84, G.cy + 26, { size: 10, color: K.C.inkDim });
    K.label(ctx, "pole", G.cx + G.R * 0.84, G.cy + 26, { size: 10, color: K.C.inkDim });
    K.label(ctx, "equator", G.cx, G.cy - G.R * 0.84, { size: 10, color: K.C.amber });
  }
  if (ph === 9 && !S.fert) {
    S.gametes && S.gametes.forEach((gm, g) => {
      const c = S.curCells[g], rec = isRecomb(gm.geno);
      K.label(ctx, `${gm.geno}${rec ? " · recombinant" : ""}`, c.x, c.y + c.r * 0.72, { size: G.w < 500 ? 10 : 12, color: rec ? K.C.violet : K.C.teal });
    });
  }

  // fertilisation overlay
  if (S.fert) {
    const before = S.fert.t;
    drawFert(dt);
    if (before < 1 && S.fert.t >= 1) {
      S.zygotes++; S.lastZygote = S.fert.zgeno; renderTally();
      toast(`Fertilisation: n + n = 2n · zygote <b>${S.fert.zgeno}</b>`);
    }
  }

  // hints + next button
  const animDone = S.pt >= DUR[ph];
  if (animDone && HINTS[ph] && !S.fert && !S.drag) {
    const hx = G.w > 700 ? 14 : G.w / 2, hy = G.w > 700 ? G.h - 31 : G.h - 66;
    K.label(ctx, HINTS[ph], hx + (G.w > 700 ? 6 : 0), hy, { size: 12, color: K.C.ink, align: G.w > 700 ? "left" : "center" });
  }
  if (!S.fert) drawNextButton(t); else nextRect = null;

  // ---- auto-advance
  if (animDone && !S.fert && !S.drag) {
    S.held += dt;
    if (AUTO_PHASES.has(ph) && S.held > 0.7) next();
    else if (S.auto && S.held > (ph === 9 ? 2.6 : 1.5)) next();
  }

  const [c1, c2, c3, c4] = chipsFor(S.phase, e);
  chipStage(c1); chipPloidy(c2); chipChrom(c3); chipCells(c4);
  updateExplain();
  missionList.update();
});
if (reduceMotion) L.speed = 0.5;
