// Meiosis & Variation as a CellScape level. The genetics come from the reviewed 2D model (model.js); the 3D
// scene (scene3d.js) shows how the parts interact: cohesin rings, the synaptonemal complex, chiasmata,
// kinetochores and the spindle decide what separates in each division. After meiosis the learner fertilises a
// product with a gamete from a second parent, then uses Punnett squares, many simulated offspring and a pedigree.
// Used inside the zoomable cell (plant cell → "Meiosis ▸") and on its own page (sims/meiosis/index.html).
import * as THREE from "three";
import * as K from "../../assets/js/kit.js";
import * as MD from "./model.js";
import * as C from "./content3d.js";
import { MeiosisScene } from "./scene3d.js";

const { P } = C;
const CSS = `
.mei .tally { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 5px; margin: 8px 0; }
.mei .tcell { display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 6px 2px; border-radius: 8px; min-width: 0;
  border: 1px solid var(--panel-border); background: rgba(255,255,255,0.02); color: var(--ink-faint); font-size: 0.72rem; }
.mei .tcell b { font-family: var(--font-display); font-size: 0.95rem; letter-spacing: 0.04em; color: var(--ink-faint); }
.mei .tcell span { font-variant-numeric: tabular-nums; }
.mei .tcell em { font-style: normal; font-size: 0.58rem; text-transform: uppercase; letter-spacing: 0.02em; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mei .tcell.found { border-color: rgba(79,209,197,0.6); background: rgba(79,209,197,0.1); color: var(--ink-dim); }
.mei .tcell.found b { color: var(--ink); }
.mei .tcell.rec.found { border-color: rgba(167,139,250,0.7); background: rgba(167,139,250,0.12); }
.mei .zyg { margin-top: 6px; padding: 6px 8px; border-radius: 8px; background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.3); font-size: 0.85rem; color: var(--ink-dim); }
.mei .zyg strong { color: var(--ink); }
.mei table.cmp { width: 100%; border-collapse: collapse; font-size: 0.8rem; color: var(--ink-dim); }
.mei table.cmp th, .mei table.cmp td { text-align: left; padding: 5px 4px; border-bottom: 1px solid var(--panel-border); vertical-align: top; }
.mei table.cmp th { color: var(--ink); font-weight: 600; }
.mei table.cmp td:first-child { color: var(--ink-faint); width: 30%; }
.mei .note { font-size: 0.78rem; color: var(--ink-faint) !important; }
.mei .lbl { font-size: 0.78rem; color: var(--ink-faint); margin: 8px 0 4px; }
.mei .segmented { margin-bottom: 4px; }
.mei .segmented button { padding: 6px 4px; font-size: 0.78rem; }
.mei .ctx { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.mei .ctx .btn { padding: 6px 9px; font-size: 0.8rem; }
.mei table.pun { border-collapse: separate; border-spacing: 3px; margin: 6px auto; font-size: 0.8rem; }
.mei table.pun th { color: var(--ink-dim); font-weight: 600; padding: 3px 5px; text-align: center; }
.mei table.pun th small { display: block; color: var(--ink-faint); font-weight: 400; font-size: 0.66rem; }
.mei table.pun td { text-align: center; padding: 6px 6px; border-radius: 7px; color: #06121f; font-weight: 700; font-family: var(--font-display); min-width: 40px; }
.mei table.obs { width: 100%; border-collapse: collapse; font-size: 0.8rem; color: var(--ink-dim); margin-top: 6px; }
.mei table.obs th, .mei table.obs td { padding: 4px; border-bottom: 1px solid var(--panel-border); text-align: right; font-variant-numeric: tabular-nums; }
.mei table.obs th:first-child, .mei table.obs td:first-child { text-align: left; }
.mei table.obs i { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 5px; }
.mei .ped svg { width: 100%; height: auto; display: block; }
.mei .ia { font-size: 0.82rem; color: var(--ink-dim); margin-top: 6px; }
.mei .p1 { font-size: 0.82rem; color: var(--ink-dim); margin: 4px 0; }
.mei .p1 b { color: var(--ink); }
#mei-bar { position: absolute; left: 50%; bottom: 84px; transform: translateX(-50%); z-index: 3; display: flex; align-items: center; gap: 10px; max-width: calc(100% - 28px);
  background: rgba(5,11,22,0.82); border: 1px solid var(--panel-border); border-radius: 14px; padding: 6px 6px 6px 12px; backdrop-filter: blur(6px); }
#mei-bar span { font-size: 0.8rem; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
#mei-bar .btn { white-space: nowrap; padding: 7px 11px; font-size: 0.82rem; }
#mei-bar .btn.wait { box-shadow: 0 0 14px rgba(79,209,197,0.55); }
.lbl3d.mei-g { background: rgba(5,11,22,0.72); border: 1px solid rgba(79,209,197,0.5); padding: 2px 8px; border-radius: 999px; color: var(--ink); font-weight: 600; text-align: center; }
.lbl3d.mei-g small { display: block; font-weight: 400; font-size: 0.66rem; color: var(--ink-dim); }
.lbl3d.mei-g.rec { border-color: rgba(167,139,250,0.8); }
.lbl3d.mei-g.bad { border-color: rgba(248,113,113,0.8); }
.lbl3d.mei-g.bad small { color: #fca5a5; }
.lbl3d.mei-ghost { color: #ddd6fe; font-weight: 600; text-shadow: 0 1px 6px #000; }
@media (max-width: 600px) { #mei-bar { bottom: 88px; gap: 6px; } #mei-bar span { font-size: 0.72rem; } .mei-opt { display: none !important; } }
`;

export function create(engine) {
  if (!document.getElementById("mei-css")) {
    const st = document.createElement("style");
    st.id = "mei-css"; st.textContent = CSS;
    document.head.appendChild(st);
  }
  const lens = engine.lens;
  const pick = (v) => lens.pick(v);
  const toast = (m, ms) => engine.toast?.(m, ms);
  const fromPlant = engine.stack.at(-1)?.id === "cell";

  // ---------------------------------------------------------------- state
  const S = {
    phase: 0, pt: 0, held: 0, maxPhase: 0, speed: engine.reducedMotion ? 0.6 : 1,
    cross: [[], []], ch: MD.build([[], []]),
    orient: MD.randOrient(), disp: [0, 0], orient2: MD.randOrient2(), disp2: [[0, 0], [0, 0]],
    errUI: { nd: "none", ndPair: 0, ndCell: 0, sgo: true }, runErr: null, err: null, dest: null,
    gametes: null, fert: null, drag: null, zip: 0,
    org: "plant", p2: { A: "Aa", B: "Bb", D: "Dd", phase: "cis" }, p2chroms: null,
    auto: false, preRandom: false, autoCam: true, crossMode: "random",
    tally: {}, aneu: 0, runs: 0, watched: new Set(), watchedRuns: 0, orientSeen: new Set(), combos: new Set(), flips: 0,
    crossMade: false, zygotes: 0, lastZygote: null, trisomy: false, ndDone: { I: false, II: false }, noXRuns: 0, sgoAneu: false,
    breedN: 0, linkedTestN: 0, breed: {}, lastErr: null,
  };
  S.disp = S.orient.slice(); S.disp2 = S.orient2.map((a) => a.slice());
  S.p2chroms = MD.chromsFrom(S.p2);
  S.err = S.errUI;
  const errSnapshot = () => ({ ...S.errUI, sgoRand: MD.randSgo() });
  S.runErr = errSnapshot();
  S.dest = MD.segregate(S.orient, S.orient2, S.err);

  const G = new MeiosisScene(engine, S);
  G.showSgo = lens.atLeast("y11");
  const phaseDur = (ph) => C.PHASES[ph].dur;

  // ---------------------------------------------------------------- phase control
  function setDest() {
    S.err = S.phase >= P.ANA1 ? S.runErr : S.errUI;
    S.dest = MD.segregate(S.orient, S.orient2, S.err);
  }
  function goTo(ph) {
    G.snapshot();
    S.phase = ph; S.pt = 0; S.held = 0; S.drag = null; G.showGhost(null);
    S.maxPhase = Math.max(S.maxPhase, ph);
    if (ph === P.PRO1 && (S.auto || S.preRandom)) { S.cross = MD.randomCross(); S.ch = MD.build(S.cross); S.preRandom = false; if (S.cross[0].length + S.cross[1].length) S.crossMade = S.crossMade || !S.auto; }
    if (ph === P.MET1 && S.auto) S.orient = MD.randOrient();
    if (ph === P.ANA1) { S.runErr = errSnapshot(); }
    if (ph === P.MET2) { if (S.auto) S.orient2 = MD.randOrient2(); S.disp2 = S.orient2.map((a) => a.slice()); }
    setDest();
    if (ph === P.DONE) recordGametes();
    flyFrame();
    refreshUI(true);
  }
  function next() {
    if (S.fert || engine.busy) return;
    if (S.phase < P.DONE) goTo(S.phase + 1);
    else newRun();
  }
  function newRun() {
    G.snapshot();
    S.cross = [[], []]; S.ch = MD.build(S.cross);
    S.orient = MD.randOrient(); S.disp = S.orient.slice();
    S.orient2 = MD.randOrient2(); S.disp2 = S.orient2.map((a) => a.slice());
    S.gametes = null; S.fert = null; S.drag = null; G.showGhost(null);
    S.phase = 0; S.pt = 0; S.held = 0;
    setDest();
    flyFrame();
    refreshUI(true);
  }
  function recordGametes() {
    S.gametes = MD.gametesFromDest(S.ch, S.dest, S.p2chroms);
    S.runs++; S.watchedRuns++;
    const E = S.runErr;
    S.lastErr = E.sgo === false ? "sgo" : E.nd !== "none" ? E.nd : null;
    tallyGametes(S.gametes, true);
    const ab = S.gametes.some((g) => !g.euploid);
    if (ab && E.nd === "I") S.ndDone.I = true;
    if (ab && E.nd === "II") S.ndDone.II = true;
    if (ab && E.sgo === false) S.sgoAneu = true;
    renderTally();
  }
  function tallyGametes(gs, watched) {
    for (const g of gs) {
      if (!g.euploid) { S.aneu++; continue; }
      S.tally[g.geno] = (S.tally[g.geno] || 0) + 1;
      if (watched) S.watched.add(g.geno);
      S.combos.add(g.parts.map((q) => q.bins[Math.floor(MD.CEN[q.p] * MD.N)]).join(""));
    }
  }
  function batchRuns(n) {
    for (let i = 0; i < n; i++) {
      const cross = S.crossMode === "none" ? [[], []] : MD.randomCross();
      const e = { ...S.errUI, sgoRand: MD.randSgo() };
      const gs = MD.gametesFromDest(MD.build(cross), MD.segregate(MD.randOrient(), MD.randOrient2(), e), S.p2chroms);
      tallyGametes(gs, false);
      S.runs++;
    }
    if (S.crossMode === "none") S.noXRuns += n;
    renderTally();
    const u = Object.keys(S.tally).length;
    toast(`Added ${n} random meioses (${n * 4} ${C.productName(S.org, true, lens.band)}) · <b>${u}</b> of 8 types found`);
  }
  function randomise() {
    const ph = S.phase;
    if (S.fert) return;
    if (ph <= P.S) { S.preRandom = true; S.orient = MD.randOrient(); S.orient2 = MD.randOrient2(); toast("Random crossovers will form in prophase I; orientations randomised"); }
    else if (ph <= P.PRO1) { S.cross = MD.randomCross(); S.ch = MD.build(S.cross); S.orient = MD.randOrient(); S.orient2 = MD.randOrient2(); if (S.cross[0].length + S.cross[1].length) S.crossMade = true; toast("Random chiasmata placed"); }
    else if (ph <= P.MET1) { S.orient = MD.randOrient(); S.orient2 = MD.randOrient2(); toast("Bivalent orientations randomised"); }
    else if (ph <= P.MET2) { S.orient2 = MD.randOrient2(); toast("Metaphase II orientations randomised"); }
    else { newRun(); S.preRandom = true; toast("New run started with random choices"); }
    S.disp2 = S.phase === P.MET2 ? S.disp2 : S.orient2.map((a) => a.slice());
    refreshUI(true);
  }
  function rebuildCross() { S.ch = MD.build(S.cross); }
  function addCross(p, x) {
    if (S.cross[p].length >= MD.MAX_X) { toast(`Maximum ${MD.MAX_X} chiasmata per bivalent in this model`); return false; }
    x = MD.validPos(p, x);
    if (S.cross[p].some((c) => Math.abs(c.x - x) < 0.05)) { toast("Too close to another chiasma: crossovers interfere with each other nearby"); return false; }
    const [m, q] = MD.CYCLE[S.cross[p].length % MD.CYCLE.length];
    S.cross[p].push({ x, m, p: q });
    S.crossMade = true;
    rebuildCross();
    return true;
  }
  function flipBiv(p) { if (S.phase !== P.MET1) return; S.orient[p] ^= 1; S.flips++; setDest(); refreshUI(); }
  function flipChrom(side, p) {
    if (S.phase !== P.MET2) return;
    if (S.err.sgo === false) { toast("Without centromeric cohesion the chromatids are captured independently: nothing to flip"); return; }
    S.orient2[side][p] ^= 1; S.flips++; setDest(); refreshUI();
  }

  // ---------------------------------------------------------------- fertilisation
  function startFert(g) {
    if (S.phase !== P.DONE || S.fert || !S.gametes) return;
    const gm = S.gametes[g];
    const parts2 = MD.parentGameteParts(S.p2chroms, S.crossMode);
    const all = [...gm.parts, ...parts2];
    const al = MD.allelesOf(all, S.p2chroms);
    const per = [gm.perPair[0] + 1, gm.perPair[1] + 1];
    const count = per[0] + per[1];
    let status = "normal", pair = -1;
    if (per.some((c) => c > 2) && !per.some((c) => c < 2)) { status = "trisomy"; pair = per.findIndex((c) => c > 2); }
    else if (per.some((c) => c < 2) && !per.some((c) => c > 2)) { status = "monosomy"; pair = per.findIndex((c) => c < 2); }
    else if (per.some((c) => c !== 2)) status = "other";
    const genoStr = MD.GENES.map((x) => al[x].join("")).join(" ");
    const phenoStr = MD.GENES.map((x) => `${C.phenoName(S.org, x, al[x].some((a) => a === x))}`).join(", ");
    S.fert = { g, t: 0, gm, parts2, zyg: { count, per, status, pair, genoStr, phenoStr, al } };
    G.repaintAll();
    flyFrame();
    refreshUI(true);
  }
  function endFert() {
    if (!S.fert) return;
    G.snapshot();
    S.fert = null; S.pt = 0;
    flyFrame();
    refreshUI(true);
  }

  // ---------------------------------------------------------------- camera
  const VDIR = new THREE.Vector3(0.16, 0.2, 1).normalize();
  function fitDistance(box) {
    const t = Math.tan(THREE.MathUtils.degToRad(engine.camera.fov / 2)), a = engine.camera.aspect;
    return Math.max(box.hy / t, box.hx / (t * a)) * 1.06 + 8;
  }
  function viewFor() {
    const box = G.frameBox(S.phase);
    // portrait phones: leave room under the subject for the stage bar
    if (engine.camera.aspect < 0.8) { box.c.y -= box.hy * 0.2; box.hy *= 1.2; }
    return { target: box.c.clone(), distance: K.clamp(fitDistance(box), 40, 400), dir: VDIR.clone() };
  }
  function flyFrame() {
    if (!S.autoCam || engine.busy || !mounted) return;
    const v = viewFor();
    engine.fly(v.target, v.target.clone().addScaledVector(v.dir, v.distance), engine.reducedMotion ? 0.05 : 1.1);
  }

  // ---------------------------------------------------------------- panel
  let panelHost = null, progress = null, explainBody, selCard, ctxEl, nextBtn, tallyBody, punBody, pedBody, mission, orgSeg, autoCb;
  let stageBar = null, barText = null, barBtn = null;
  const ui = {};
  function buildPanel(el) {
    const host = document.createElement("div");
    host.style.display = "contents";
    host.className = "mei";
    el.appendChild(host);
    progress = { band: lens.band, node: host };
    panelHost = el;
    const band = lens.band, y7 = band === "y7-8", senior = lens.atLeast("y11");

    // what's happening
    const ex = K.card(host, "What's happening", "explain");
    explainBody = document.createElement("div");
    ex.appendChild(explainBody);
    ex.insertAdjacentHTML("beforeend", `<p class="note">${pick({
      "y7-8": "Not to scale: real cells have many more chromosomes (people have 46). Chromosomes are drawn big and already packed up so you can follow them.",
      "y9-10": "Not to scale: human cells have 2n = 46 (n = 23). Chromosomes are drawn condensed at every stage (in interphase they are really long, thin chromatin) and much larger relative to the cell.",
      y11: "Simplified: 2n = 4 (humans 46). Chromosomes shown condensed throughout and enlarged relative to the cell (1 unit = 0.1 µm for the chromosomes); cohesin, SC and microtubules are drawn far larger than life.",
    })}</p>`);

    selCard = K.card(host, "Selected", "sel-card");
    selCard.style.display = "none";

    // where are we?
    const orgCard = K.card(host, pick({ "y7-8": "Which living thing?", "y9-10": "Germ cell" }));
    if (fromPlant) orgCard.insertAdjacentHTML("beforeend", `<p class="note leaf">${pick({ "y7-8": "Meiosis doesn't happen in the leaf cell you came from. It happens only in special cells in a flower. We've jumped to one of those.", "y9-10": "Meiosis doesn't happen in ordinary leaf cells (they divide by mitosis). It happens only in special cells in the flower's anthers and ovules, so we've jumped to one of those.", y11: "Somatic plant cells divide by mitosis; meiosis is restricted to sporocytes in anthers (microsporocytes) and ovules (megasporocytes). This level shows a microsporocyte." })}</p>`);
    orgSeg = K.segmented(orgCard, [
      { value: "plant", label: pick({ "y7-8": "Flower (anther)", "y9-10": "Plant: anther" }) },
      { value: "animal", label: pick({ "y7-8": "Human (testis)", "y9-10": "Animal: human testis" }) },
    ], S.org, (v) => { S.org = v; G.repaintAll(); buildDynamic(); refreshUI(true); flyFrame(); toast(v === "plant" ? "A pollen mother cell in a flower's anther" : "A spermatocyte in a human testis"); });
    ui.orgNote = document.createElement("p");
    ui.orgNote.className = "note";
    orgCard.appendChild(ui.orgNote);

    // controls
    const ctl = K.card(host, "Controls");
    const r1 = K.buttonRow(ctl);
    nextBtn = K.button(r1, "Next ▸", () => next(), { kind: "primary" });
    K.button(r1, "New run", () => { newRun(); toast(`New germ cell: 2n = 4`); });
    K.button(r1, "Randomise", randomise);
    ctxEl = document.createElement("div");
    ctxEl.className = "ctx";
    ctl.appendChild(ctxEl);
    ctl.insertAdjacentHTML("beforeend", `<div class="lbl">Speed</div>`);
    K.segmented(ctl, [{ value: 0.5, label: "½×" }, { value: 1, label: "1×" }, { value: 2, label: "2×" }], S.speed >= 1 ? 1 : 0.5, (v) => (S.speed = v));
    autoCb = K.checkbox(ctl, "Auto-play with random choices (loops runs)", S.auto, (v) => { S.auto = v; });
    K.checkbox(ctl, "Camera follows each stage", S.autoCam, (v) => { S.autoCam = v; if (v) flyFrame(); });
    K.checkbox(ctl, "Show allele letters", G.showLetters, (v) => (G.showLetters = v));
    K.checkbox(ctl, "Show labels", ui.labels !== false, (v) => (ui.labels = v));

    // things that go wrong
    if (!y7) {
      const wr = K.card(host, pick({ "y9-10": "Things that can go wrong", y11: "Errors in chromosome separation" }));
      wr.insertAdjacentHTML("beforeend", `<div class="lbl">Nondisjunction (chromosomes fail to separate)</div>`);
      ui.ndSeg = K.segmented(wr, [{ value: "none", label: "None" }, { value: "I", label: "In meiosis I" }, { value: "II", label: "In meiosis II" }], S.errUI.nd, (v) => setErr({ nd: v }));
      ui.ndPair = K.segmented(wr, [{ value: 0, label: "Pair 1 (A, B)" }, { value: 1, label: "Pair 2 (D)" }], S.errUI.ndPair, (v) => setErr({ ndPair: v }));
      ui.ndCellWrap = document.createElement("div");
      wr.appendChild(ui.ndCellWrap);
      ui.ndCell = K.segmented(ui.ndCellWrap, [{ value: 0, label: "Left cell (MII)" }, { value: 1, label: "Right cell (MII)" }], S.errUI.ndCell, (v) => setErr({ ndCell: v }));
      if (senior) {
        ui.sgoCb = K.checkbox(wr, "Shugoshin protects centromeric cohesin in meiosis I", S.errUI.sgo, (v) => setErr({ sgo: v }));
        wr.insertAdjacentHTML("beforeend", `<p class="note">${pick({ y11: "Switch shugoshin off: centromeric cohesin is cut along with arm cohesin at anaphase I, so in meiosis II single chromatids segregate at random.", y12: "Switch shugoshin off: centromeric Rec8 is cleaved at anaphase I (premature separation of sister chromatids). In meiosis II single chromatids segregate at random. Gradual cohesin loss in ageing human oocytes is a leading explanation for the maternal-age effect." })}</p>`);
      }
      ui.errNote = document.createElement("p");
      ui.errNote.className = "note";
      wr.appendChild(ui.errNote);
    }

    // tally
    const tc = K.card(host, pick({ "y7-8": "Cells made (tally)", "y9-10": "Tally of products" }));
    tallyBody = document.createElement("div");
    tc.appendChild(tallyBody);
    const tr = K.buttonRow(tc);
    K.button(tr, "+10 random meioses", () => batchRuns(10));
    K.button(tr, "+100", () => batchRuns(100));
    K.button(tr, "Clear tally", () => { S.tally = {}; S.aneu = 0; S.runs = 0; S.combos.clear(); renderTally(); });
    if (!y7) {
      tc.insertAdjacentHTML("beforeend", `<div class="lbl">Crossing over in random runs and offspring</div>`);
      K.segmented(tc, [{ value: "random", label: "On (1–2 per bivalent)" }, { value: "none", label: "Off" }], S.crossMode, (v) => { S.crossMode = v; S.breed = {}; renderPunnett(); toast(v === "none" ? "Random runs now have no crossing over" : "Random runs now include crossing over"); });
    }

    // inheritance: fertilisation + Punnett + offspring
    const fc = K.card(host, pick({ "y7-8": "Fertilisation", "y9-10": "Fertilisation & Punnett square", y11: "Inheritance: Punnett squares and crosses" }));
    ui.fertInfo = document.createElement("div");
    fc.appendChild(ui.fertInfo);
    punBody = document.createElement("div");
    fc.appendChild(punBody);

    // pedigree (Years 9–10+)
    if (!y7) {
      const pc = K.card(host, "Pedigree (family tree)", "ped");
      pedBody = document.createElement("div");
      pc.appendChild(pedBody);
    } else pedBody = null;

    // compare + legend
    const cmp = K.card(host, "Compare with mitosis");
    cmp.insertAdjacentHTML("beforeend", `<table class="cmp"><tr><th></th><th>Mitosis</th><th>Meiosis</th></tr>${C.COMPARE.filter((r) => !y7 || !/Cohesin/.test(r[0])).map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("")}</table>`);
    ui.legend = K.card(host, "Legend");
    ui.legendBody = document.createElement("div");
    ui.legend.appendChild(ui.legendBody);

    mission = K.missions(host, lens.filter(C.MISSIONS).map((m) => ({ text: m.text, check: () => m.check(S) })), (m) => toast(`🎯 Mission complete: ${m.text}`, 3400));
    K.quiz(host, lens.filter(C.QUIZ));
    buildDynamic();
    renderTally();
  }

  function setErr(o) {
    Object.assign(S.errUI, o);
    if (o.nd && o.nd !== "none" && S.errUI.sgo === false) { /* both allowed: sgo dominates meiosis II */ }
    if (S.phase >= P.ANA1 && !S.fert) toast("Errors apply from anaphase I: this one will be used in the next run");
    setDest();
    renderErr();
  }
  function renderErr() {
    if (!ui.ndSeg) return;
    ui.ndCellWrap.style.display = S.errUI.nd === "II" ? "" : "none";
    const E = S.errUI;
    let t = "";
    if (E.nd === "I") t = pick({ "y9-10": `Both chromosomes of pair ${E.ndPair + 1} will go to the same pole in anaphase I. Expect <strong>two n+1 and two n−1</strong> ${C.productName(S.org, true, lens.band)}.`, y11: `Pair ${E.ndPair + 1} homologues will co-segregate at anaphase I → 2 × n+1 (carrying both homologues) and 2 × n−1.` });
    else if (E.nd === "II") t = pick({ "y9-10": `Sister chromatids of pair ${E.ndPair + 1} will not separate in the ${E.ndCell ? "right" : "left"} cell. Expect <strong>one n+1, one n−1 and two normal</strong>.`, y11: `Sisters of pair ${E.ndPair + 1} co-segregate in the ${E.ndCell ? "right" : "left"} cell at anaphase II → 1 × n+1 (two sisters), 1 × n−1, 2 × n.` });
    else t = pick({ "y9-10": "Normal meiosis. Choose an error, then run meiosis to see what it does to the products." });
    ui.errNote.innerHTML = t + (S.phase >= P.ANA1 && !S.fert && (E.nd !== S.runErr.nd || E.sgo !== S.runErr.sgo) ? " <em>(Takes effect next run.)</em>" : "");
  }

  function buildDynamic() {
    // things that depend on the organism toggle
    const leaf = panelHost?.querySelector(".mei .leaf");
    if (leaf) leaf.style.display = S.org === "plant" ? "" : "none";
    ui.orgNote.innerHTML = S.org === "plant"
      ? pick({ "y7-8": "In a flower, meiosis makes 4 cells that grow into <strong>pollen grains</strong>. Each pollen grain makes the sperm cells.", "y9-10": "In the anther, meiosis makes four haploid <strong>spores</strong>; each grows (by mitosis) into a pollen grain that makes sperm cells with the same genotype. Plant cells have no centrosomes and divide with a cell plate.", y11: "Plants alternate generations: meiosis in the sporophyte makes haploid spores (here microspores in a callose-walled tetrad), which grow by mitosis into the gametophyte (pollen grain) that makes the gametes. Acentrosomal spindle; cell-plate cytokinesis." })
      : pick({ "y7-8": "In a testis, meiosis makes 4 <strong>sperm cells</strong>. (In an ovary it makes 1 egg.)", "y9-10": "In a testis, one spermatocyte makes four sperm. In an ovary, meiosis makes <strong>one egg</strong> and small polar bodies. Animal cells divide by a cleavage furrow; their spindle grows from centrosomes.", y11: "Spermatogenesis: primary spermatocyte → 2 secondary spermatocytes → 4 spermatids. Oogenesis is asymmetric (1 egg + polar bodies), arrests in prophase I from before birth and completes meiosis II only at fertilisation." });
    ui.legendBody.innerHTML = `<div class="legend">
      <span><i style="background:${MD.COL.M}"></i>${pick({ "y7-8": "From its mother", "y9-10": "Maternal chromosome" })}</span>
      <span><i style="background:${MD.COL.P}"></i>${pick({ "y7-8": "From its father", "y9-10": "Paternal chromosome" })}</span>
      <span><i style="background:${MD.COL.X}"></i>Other parent (1)</span>
      <span><i style="background:${MD.COL.Y}"></i>Other parent (2)</span>
      <span><i style="background:#facc15"></i>${pick(C.PARTS.cohesinArm.name)}</span>
      <span><i style="background:#fb7a3c"></i>${pick(C.PARTS.cohesinCen.name)}</span>
      <span><i style="background:#67e8f9"></i>${pick(C.PARTS.sc.name)}</span>
      <span><i style="background:#a78bfa"></i>${pick(C.PARTS.chiasma.name)}</span>
      ${lens.atLeast("y11") ? `<span><i style="background:#4ade80"></i>Shugoshin</span>` : ""}
      <span><i style="background:#bae6fd"></i>${pick(C.PARTS.fibre.name)}</span>
      <span style="grid-column:1/-1">${pick({ "y7-8": "Dark bands with letters are genes. A capital letter is the dominant version.", "y9-10": "Dark bands = gene loci. Capital = dominant allele (A, B, D); lower case = recessive. Genes A and B are linked on pair 1; D is on pair 2." })}</span>
      <span style="grid-column:1/-1">${pick(C.TRAITS[S.org].note)}</span></div>`;
    renderPunnett();
    renderPedigree();
  }

  // ---------------------------------------------------------------- tally
  function renderTally() {
    if (!tallyBody) return;
    const total = Object.values(S.tally).reduce((a, b) => a + b, 0);
    const unique = Object.keys(S.tally).length;
    const rec = MD.RECOMB.reduce((a, g) => a + (S.tally[g] || 0), 0);
    const y7 = lens.band === "y7-8";
    const traitTip = (g) => MD.GENES.map((x, i) => C.phenoName(S.org, x, g[i] === x)).join(", ");
    const cell = (t) => {
      const n = S.tally[t] || 0, r = MD.isRecomb(t);
      return `<div class="tcell ${n ? "found" : ""} ${r ? "rec" : ""}" title="${traitTip(t)}"><b>${t}</b><span>${n}</span><em>${r ? (y7 ? "swapped" : "recombinant") : (y7 ? "unswapped" : "parental")}</em></div>`;
    };
    const prod = C.productName(S.org, true, lens.band);
    let html = `<p>Runs: <strong>${S.runs}</strong> · ${prod}: <strong>${total + S.aneu}</strong>${S.aneu ? ` (<span style="color:#fca5a5">${S.aneu} with the wrong number of chromosomes</span>)` : ""}</p>
      <div class="tally">${MD.PARENTAL.map(cell).join("")}${MD.RECOMB.map(cell).join("")}</div>`;
    if (y7) html += `<p>You've found <strong>${unique}</strong> of 8 different mixes of genes.</p>`;
    else {
      html += `<p>You've made <strong>${unique}</strong> of 8 types: <strong>2<sup>n</sup> = 4</strong> chromosome combinations by independent assortment (n = 2) <strong>+ 4 recombinant</strong> types from crossing over between A and B.</p>`;
      if (total) html += `<p>Recombinant (Ab, aB): <strong>${Math.round((100 * rec) / total)} %</strong> of normal ${prod}${lens.atLeast("y11") ? ` · model expectation with crossing over ≈ ${Math.round(MD.REC_FREQ * 100)} % (unlinked genes would give 50 %)` : ""}.</p>`;
      html += `<div class="ia"><strong>Independent assortment:</strong> metaphase I arrangements seen ${S.orientSeen.size} of 2<sup>n−1</sup> = 2 · chromosome combinations made ${S.combos.size} of 2<sup>n</sup> = 4. Humans (n = 23): 2<sup>23</sup> ≈ 8.4 million per parent, so random fertilisation alone gives ≈ 70 trillion combinations, before crossing over.</div>`;
    }
    if (S.lastZygote) html += `<div class="zyg">Last zygote: <strong>${S.lastZygote}</strong></div>`;
    tallyBody.innerHTML = html;
  }

  // ---------------------------------------------------------------- Punnett squares and offspring
  ui.pmode = null;
  const PH_COLS = ["#4ade80", "#60a5fa", "#f9a8d4", "#fbbf24"];
  function punGenes() {
    const band = lens.band;
    if (band === "y9-10") return [ui.monoGene || "D"];
    const m = ui.pmode || "mono";
    return m === "mono" ? [ui.monoGene || "D"] : m === "unlinked" ? ["A", "D"] : ["A", "B"];
  }
  function phenoLabel(key, genes) {
    return genes.map((g, i) => C.phenoName(S.org, g, key[i] === g)).join(", ");
  }
  function renderPunnett() {
    if (!punBody) return;
    const band = lens.band, y7 = band === "y7-8";
    // fertilisation summary (all bands)
    const F = S.fert;
    let fi = "";
    if (F && F.t >= 1) fi = `<div class="zyg">Zygote: <strong>${F.zyg.genoStr}</strong> · ${F.zyg.count} chromosomes${F.zyg.status !== "normal" ? ` (<span style="color:#fca5a5">${F.zyg.status}</span>)` : ""}<br>${F.zyg.phenoStr}</div>`;
    else if (S.phase === P.DONE && !F) fi = `<p class="note">${pick({ "y7-8": "Tap one of the four new cells (or use the buttons in Controls) to join it with an egg from another parent.", "y9-10": `Tap one of the four ${C.productName(S.org, true, band)} to fertilise an egg from the second parent below.` })}</p>`;
    else if (!F) fi = `<p class="note">${pick({ "y7-8": "Finish meiosis to make sex cells, then join one with an egg.", "y9-10": "Finish meiosis, then tap a product to fertilise an egg from the second parent." })}</p>`;
    ui.fertInfo.innerHTML = fi;
    if (y7) {
      punBody.innerHTML = `<p class="p1">${pick({ "y7-8": `The other parent's chromosomes are teal and amber. The new individual gets <strong>one of each pair from each parent</strong>, so it has a new mix of genes.` })}</p>`;
      return;
    }
    const senior = lens.atLeast("y11");
    const genes = punGenes();
    const plant = S.org === "plant";
    let h = `<p class="p1">Parent 1 (${plant ? "this plant" : "this man"}): <b>${senior ? "AB/ab Dd" : "Aa Bb Dd"}</b>${senior ? " (A and B in coupling)" : ""}. Parent 2 (${plant ? "the plant whose egg is fertilised" : "the egg's mother"}): <b>${MD.genotypeStr(S.p2)}</b>${S.p2.A[0] !== S.p2.A[1] && S.p2.B[0] !== S.p2.B[1] && senior ? ` (${S.p2.phase === "cis" ? "AB/ab" : "Ab/aB"})` : ""}</p>`;
    punBody.innerHTML = h + `<div class="pctl"></div><div class="psq"></div><div class="pobs"></div>`;
    const ctl = punBody.querySelector(".pctl");
    if (senior) {
      ctl.insertAdjacentHTML("beforeend", `<div class="lbl">Cross to model</div>`);
      K.segmented(ctl, [{ value: "mono", label: "One gene" }, { value: "unlinked", label: "A & D (unlinked)" }, { value: "linked", label: "A & B (linked)" }], ui.pmode || "mono", (v) => { ui.pmode = v; S.breed = {}; renderPunnett(); });
    }
    if (genes.length === 1) {
      ctl.insertAdjacentHTML("beforeend", `<div class="lbl">Gene</div>`);
      K.segmented(ctl, MD.GENES.map((g) => ({ value: g, label: `${g}: ${C.TRAITS[S.org][g].trait.toLowerCase()}` })), ui.monoGene || "D", (v) => { ui.monoGene = v; S.breed = {}; renderPunnett(); });
    }
    ctl.insertAdjacentHTML("beforeend", `<div class="lbl">Parent 2's genotype</div>`);
    for (const g of genes) {
      const lc = g.toLowerCase();
      K.segmented(ctl, [g + g, g + lc, lc + lc].map((v) => ({ value: v, label: v })), S.p2[g], (v) => { S.p2[g] = v; p2Changed(); });
    }
    if (genes.includes("B") && genes.includes("A") && S.p2.A === "Aa" && S.p2.B === "Bb") {
      K.segmented(ctl, [{ value: "cis", label: "AB/ab (coupling)" }, { value: "trans", label: "Ab/aB (repulsion)" }], S.p2.phase, (v) => { S.p2.phase = v; p2Changed(); });
    }
    const pr = K.buttonRow(ctl);
    K.button(pr, plant ? "Self-pollinate (parent 2 = parent 1)" : "Parent 2 like parent 1", () => { Object.assign(S.p2, { A: "Aa", B: "Bb", D: "Dd", phase: "cis" }); p2Changed(); });
    K.button(pr, "Test cross (all recessive)", () => { Object.assign(S.p2, { A: "aa", B: "bb", D: "dd" }); p2Changed(); });

    // the square
    const r = S.crossMode === "none" ? 0 : MD.REC_FREQ;
    const d1 = MD.gameteDist(MD.P1_CHROMS, genes, r), d2 = MD.gameteDist(S.p2chroms, genes, r);
    const exp = MD.expected(d1, d2);
    const keys = [...exp.keys()].sort((a, b) => exp.get(b) - exp.get(a) || (a < b ? -1 : 1));
    const colOf = (k) => PH_COLS[keys.indexOf(k) % PH_COLS.length];
    const pct = (f) => (f >= 0.995 ? "100 %" : `${+(f * 100).toFixed(f < 0.1 ? 1 : 0)} %`);
    let sq = `<table class="pun"><tr><th>${plant ? "♂ pollen ↓ / ♀ egg →" : "♂ sperm ↓ / ♀ egg →"}</th>${d2.map((b) => `<th>${b.hap}<small>${pct(b.f)}</small></th>`).join("")}</tr>`;
    for (const a of d1) {
      sq += `<tr><th>${a.hap}<small>${pct(a.f)}${genes.length === 2 && genes[1] === "B" && MD.isRecomb(a.hap + "D") ? " rec." : ""}</small></th>`;
      for (const b of d2) { const gt = MD.combine(a.hap, b.hap), k = MD.phenoKey(gt); sq += `<td style="background:${colOf(k)}" title="${phenoLabel(k, genes)}">${gt}</td>`; }
      sq += `</tr>`;
    }
    sq += `</table>`;
    if (genes.length === 2 && genes[1] === "B") sq += `<p class="note">Linked genes: gamete frequencies are not equal. Recombinant gametes (Ab, aB) need a crossover between A and B, so together they make ≈ ${Math.round(r * 100)} % (not 50 %).${S.crossMode === "none" ? " Crossing over is off, so there are none." : ""}</p>`;
    if (genes.length === 1) sq += `<p class="note">${pick({ "y9-10": "Each parent passes on one of its two alleles, each with a 50 % chance. Each box is one equally likely offspring." })}</p>`;
    punBody.querySelector(".psq").innerHTML = sq;
    renderObs(genes, exp, keys, colOf);
  }
  function renderObs(genes, exp, keys, colOf) {
    const box = punBody.querySelector(".pobs");
    if (!box) return;
    const n = Object.values(S.breed).reduce((a, b) => a + b, 0);
    let h = `<table class="obs"><tr><th>Offspring phenotype</th><th>Expected</th><th>Observed</th></tr>`;
    for (const k of keys) {
      const o = S.breed[k] || 0;
      h += `<tr><td><i style="background:${colOf(k)}"></i>${phenoLabel(k, genes)}</td><td>${(exp.get(k) * 100).toFixed(1)} %</td><td>${n ? `${o} (${((100 * o) / n).toFixed(1)} %)` : "–"}</td></tr>`;
    }
    h += `</table>`;
    if (n && genes.length === 2 && genes[1] === "B" && S.p2.A === "aa" && S.p2.B === "bb") {
      const recK = keys.filter((k) => (k[0] === "A") !== (k[1] === "B"));
      const rec = recK.reduce((a, k) => a + (S.breed[k] || 0), 0);
      h += `<p class="note">Test cross: recombinant offspring = <strong>${((100 * rec) / n).toFixed(1)} %</strong> → recombination frequency ≈ ${((100 * rec) / n).toFixed(0)} map units between A and B${lens.atLeast("y12") ? " (1 % recombination ≈ 1 centimorgan)" : ""}.</p>`;
    }
    h += `<p class="note">${n} offspring bred. ${n && n < 100 ? "Small samples wander from the expected ratio; breed more." : n ? "The bigger the sample, the closer the observed ratio usually gets to the expected one." : "Each offspring = one random meiosis in each parent + fertilisation."}</p>`;
    box.innerHTML = h;
    const br = K.buttonRow(box);
    K.button(br, "Breed 10 offspring", () => breed(10, genes));
    K.button(br, "Breed 100", () => breed(100, genes), { kind: "primary" });
    K.button(br, "Clear", () => { S.breed = {}; renderPunnett(); });
  }
  function breed(n, genes) {
    for (let i = 0; i < n; i++) {
      const g1 = MD.randomGameteHaps(MD.P1_CHROMS, S.crossMode), g2 = MD.randomGameteHaps(S.p2chroms, S.crossMode);
      const pickG = (h, x) => (x === "A" ? h[0][0] : x === "B" ? h[0][1] : h[1]);
      const k = MD.phenoKey(MD.combine(genes.map((x) => pickG(g1, x)).join(""), genes.map((x) => pickG(g2, x)).join("")));
      S.breed[k] = (S.breed[k] || 0) + 1;
    }
    S.breedN += n;
    if (genes.length === 2 && genes[1] === "B" && S.p2.A === "aa" && S.p2.B === "bb") S.linkedTestN += n;
    renderPunnett();
  }
  function p2Changed() {
    S.p2chroms = MD.chromsFrom(S.p2);
    S.breed = {};
    if (S.gametes) S.gametes = MD.gametesFromDest(S.ch, S.dest, S.p2chroms);
    ped = null;
    renderPunnett(); renderPedigree();
  }

  // ---------------------------------------------------------------- pedigree (gene D, human)
  let ped = null;
  function rollFamily() {
    const kids = [];
    for (let i = 0; i < 4; i++) {
      const a = MD.randomGameteHaps(MD.P1_CHROMS)[1], b = MD.randomGameteHaps(S.p2chroms)[1];
      kids.push({ g: [a, b].sort().join(""), male: Math.random() < 0.5 });
    }
    ped = { kids };
  }
  function renderPedigree() {
    if (!pedBody) return;
    if (S.org !== "animal") {
      pedBody.innerHTML = `<p class="note">Pedigrees track a trait through a human family. Switch the germ cell to <strong>Animal: human testis</strong> to build one for the cystic fibrosis gene (D).</p>`;
      const r = K.buttonRow(pedBody);
      K.button(r, "Switch to human", () => { S.org = "animal"; orgSeg.set("animal"); G.repaintAll(); buildDynamic(); refreshUI(true); });
      return;
    }
    if (!ped) rollFamily();
    const showCarrier = ui.carriers ?? true;
    const sym = (x, y, male, g, label) => {
      const aff = g === "dd", car = g === "Dd";
      const fill = aff ? "#f87171" : "rgba(255,255,255,0.04)";
      const shape = male ? `<rect x="${x - 13}" y="${y - 13}" width="26" height="26" rx="2" fill="${fill}" stroke="#e8f1ff" stroke-width="1.6"/>` : `<circle cx="${x}" cy="${y}" r="13.5" fill="${fill}" stroke="#e8f1ff" stroke-width="1.6"/>`;
      const dot = car && showCarrier ? `<circle cx="${x}" cy="${y}" r="4" fill="#e8f1ff"/>` : "";
      return `${shape}${dot}<text x="${x}" y="${y + 29}" fill="#9fb3cf" font-size="11" text-anchor="middle">${g}</text>${label ? `<text x="${x}" y="${y - 19}" fill="#6a7f9c" font-size="10" text-anchor="middle">${label}</text>` : ""}`;
    };
    const p2g = S.p2.D;
    let svg = `<svg viewBox="0 0 300 150" role="img" aria-label="Pedigree: parents ${"Dd"} and ${p2g}, children ${ped.kids.map((k) => k.g).join(", ")}">`;
    svg += `<line x1="113" y1="34" x2="187" y2="34" stroke="#9fb3cf" stroke-width="1.5"/><line x1="150" y1="34" x2="150" y2="70" stroke="#9fb3cf" stroke-width="1.5"/><line x1="45" y1="70" x2="255" y2="70" stroke="#9fb3cf" stroke-width="1.5"/>`;
    svg += sym(100, 34, true, "Dd", "I-1") + sym(200, 34, false, p2g, "I-2");
    ped.kids.forEach((k, i) => { const x = 45 + i * 70; svg += `<line x1="${x}" y1="70" x2="${x}" y2="92" stroke="#9fb3cf" stroke-width="1.5"/>` + sym(x, 105, k.male, k.g, `II-${i + 1}`); });
    svg += `</svg>`;
    const aff = ped.kids.filter((k) => k.g === "dd").length;
    pedBody.innerHTML = `<p class="note">Squares = males, circles = females; shaded = has cystic fibrosis (dd)${showCarrier ? "; dot = carrier (Dd)" : ""}. Genotypes are shown here, but real pedigrees only show phenotypes.</p>${svg}
      <p class="note">${aff ? `<strong>${aff}</strong> affected child${aff > 1 ? "ren" : ""}${p2g !== "dd" ? " from unaffected parents: the allele must be <strong>recessive</strong>, and both parents carriers." : "."}` : "No affected children this time."} Each child has a ${p2g === "DD" ? "0" : p2g === "Dd" ? "1 in 4" : "1 in 2"} chance of cystic fibrosis.</p>`;
    const r = K.buttonRow(pedBody);
    K.button(r, "New family", () => { rollFamily(); renderPedigree(); });
    const cb = K.checkbox(pedBody, "Show carriers", showCarrier, (v) => { ui.carriers = v; renderPedigree(); });
    cb.parentElement.style.fontSize = "0.8rem";
  }

  // ---------------------------------------------------------------- context buttons + stage bar
  function hintText() {
    const ph = S.phase, y7 = lens.band === "y7-8";
    if (S.fert) return S.fert.t < 1 ? pick({ "y7-8": "Joining…", "y9-10": "Fertilisation…" }) : pick({ "y7-8": "A new individual!", "y9-10": "Zygote formed" });
    if (ph === P.PRO1) return S.zip < 0.95 ? pick({ "y7-8": "Zipping the pairs together…", "y9-10": "Synapsis…" }) : pick({ "y7-8": "Drag along a pair to swap pieces", "y9-10": "Drag along a bivalent to place a crossover" });
    if (ph === P.MET1) return pick({ "y7-8": "Tap a pair to spin it", "y9-10": "Tap a bivalent to flip it" });
    if (ph === P.MET2) return S.err.sgo === false ? "No cohesion: chromatids attach at random" : pick({ "y7-8": "Tap a chromosome to flip it", "y9-10": "Tap a chromosome to flip it" });
    if (ph === P.DONE) return pick({ "y7-8": "Tap a new cell to fertilise", "y9-10": `Tap a ${C.productName(S.org, false, lens.band)} to fertilise` });
    if (ph === P.G1) return pick({ "y7-8": "Press Next to copy the DNA", "y9-10": "Press Next to replicate the DNA" });
    return pick(C.PHASES[ph].name);
  }
  function renderCtx() {
    if (!ctxEl) return;
    const ph = S.phase, prod = C.productName(S.org, false, lens.band);
    ctxEl.innerHTML = "";
    if (S.fert) { K.button(ctxEl, "◂ Back to the four cells", () => endFert()); return; }
    if (ph === P.PRO1) {
      K.button(ctxEl, "+ Crossover pair 1 (between A and B)", () => { if (S.zip < 0.95) return toast("Wait for synapsis to finish"); addCross(0, 0.55); refreshUI(); });
      K.button(ctxEl, "+ Crossover pair 2", () => { if (S.zip < 0.95) return toast("Wait for synapsis to finish"); addCross(1, 0.6); refreshUI(); });
      K.button(ctxEl, "Clear crossovers", () => { S.cross = [[], []]; rebuildCross(); refreshUI(); });
    } else if (ph === P.MET1) {
      K.button(ctxEl, "Flip bivalent 1", () => flipBiv(0));
      K.button(ctxEl, "Flip bivalent 2", () => flipBiv(1));
    } else if (ph === P.MET2 && S.err.sgo !== false) {
      for (let side = 0; side < 2; side++) for (let p = 0; p < 2; p++) K.button(ctxEl, `Flip ${side ? "right" : "left"} cell, pair ${p + 1}`, () => flipChrom(side, p));
    } else if (ph === P.DONE && S.gametes) {
      S.gametes.forEach((g, i) => K.button(ctxEl, `Fertilise ${prod} ${i + 1} (${g.geno})`, () => startFert(i)));
    }
  }
  function buildStageBar() {
    stageBar = document.createElement("div");
    stageBar.id = "mei-bar";
    barText = document.createElement("span");
    barBtn = document.createElement("button");
    barBtn.type = "button"; barBtn.className = "btn primary";
    barBtn.addEventListener("click", () => (S.fert ? (S.fert.t >= 1 ? endFert() : null) : next()));
    stageBar.append(barText, barBtn);
  }
  function refreshUI(full) {
    if (!nextBtn) return;
    const ph = S.phase;
    const label = S.fert ? "◂ Back" : ph < P.DONE ? `Next ▸ ${pick(C.PHASES[ph + 1].name)}` : "New run ↻";
    nextBtn.textContent = ph < P.DONE ? `Next ▸ ${pick(C.PHASES[ph + 1].name)}` : "New run ↻";
    nextBtn.disabled = !!S.fert;
    if (barBtn) {
      const short = S.fert ? "◂ Back" : ph < P.DONE ? `Next ▸` : "New run ↻";
      barBtn.textContent = (engine.w || 1000) < 900 ? short : label;
      barText.textContent = hintText();
    }
    if (full) { renderCtx(); renderErr(); renderPunnett(); }
  }

  // ---------------------------------------------------------------- overlay chips
  let chips = null;
  function buildChips() {
    const ov = engine.overlay;
    ov.innerHTML = "";
    chips = [K.chip(ov), K.chip(ov), K.chip(ov), K.chip(ov)];
    ov.children[2].classList.add("mei-opt");
  }
  function chipText(e) {
    const ph = S.phase, y7 = lens.band === "y7-8";
    const F = S.fert;
    if (F && F.t >= 1) return [`Stage <b>Fertilisation</b>`, `Ploidy <b>${F.zyg.count === 4 ? "2n" : F.zyg.count > 4 ? "2n+1" : "2n−1"}</b>`, `Chromosomes <b>${F.zyg.count}</b>`, `Cells <b>1 zygote</b>`];
    let ploidy = ph <= P.ANA1 ? "2n" : "n", chrom = "4", cmt = "8", cells = "1";
    if (ph === P.G1) cmt = "4";
    if (ph === P.S) cmt = e < 1 ? "4 → 8" : "8";
    if (ph === P.ANA1) chrom = "4 → 2 + 2";
    if (ph >= P.TEL1) {
      const per = [0, 0];
      for (let k = 0; k < 4; k++) per[S.dest[k][0].side]++;
      if (ph <= P.MET2) { chrom = per[0] === per[1] ? `${per[0]}` : `${per[0]} | ${per[1]}`; cmt = `${per[0] * 2}${per[0] !== per[1] ? ` | ${per[1] * 2}` : ""}`; }
      cells = ph === P.TEL1 && e < 0.6 ? "1 → 2" : "2";
      if (ph === P.TEL1) ploidy = e < 0.6 ? "2n → n" : "n";
      if (ph === P.ANA2) chrom = "2 → 2 + 2";
    }
    if (ph >= P.TEL2) {
      const per = [0, 0, 0, 0];
      for (let k = 0; k < 4; k++) for (let s = 0; s < 2; s++) { const d = S.dest[k][s]; per[d.side * 2 + d.half]++; }
      const uniq = [...new Set(per)];
      chrom = uniq.length === 1 ? `${uniq[0]}` : per.join(" | ");
      cmt = chrom;
      cells = ph === P.TEL2 && e < 0.6 ? "2 → 4" : "4";
    }
    const chromLbl = y7 ? "Chromosomes" : "Chromosomes/cell";
    return [`Stage <b>${pick(C.PHASES[ph].name)}</b>`, `Ploidy <b>${ploidy}</b>`, `${chromLbl} <b>${chrom}</b> <span style="opacity:.7">(${cmt} chromatids)</span>`, `Cells <b>${cells}</b>`];
  }

  // ---------------------------------------------------------------- 3D labels
  let labels = null;
  function makeLabels() {
    if (labels) for (const l of Object.values(labels)) (Array.isArray(l) ? l : [l]).forEach((x) => x.remove());
    labels = {
      biv: [engine.label("", "org"), engine.label("", "org")],
      sc: engine.label("", "org"), chi: engine.label("", "org"), coh: engine.label("", "org"),
      eq: engine.label("", "org"), pole: engine.label("", "org"),
      prod: [0, 1, 2, 3].map(() => engine.label("", "mei-g")),
      zyg: engine.label("", "mei-g"), ghost: engine.label("", "mei-ghost"),
    };
  }
  const tv = new THREE.Vector3(), tv2 = new THREE.Vector3();
  function setL(el, html, pos, show) {
    if (!show || !pos) { el.style.display = "none"; return; }
    if (el._h !== html) { el.innerHTML = html; el._h = html; }
    engine.place(el, pos);
  }
  function updateLabels() {
    if (!labels) return;
    const ph = S.phase, on = ui.labels !== false && !S.fert, narrow = engine.camera.aspect < 0.8, y7 = lens.band === "y7-8";
    for (let p = 0; p < 2; p++) {
      const f = G.bivFrame(p);
      setL(labels.biv[p], pick({ "y7-8": `Matching pair ${p + 1}`, "y9-10": `Bivalent ${p + 1}` }), tv.copy(f.c).addScaledVector(f.ax, -0.5 * f.L - 3.5), on && (ph === P.PRO1 || ph === P.DIP) && S.pt > 1);
    }
    const f0 = G.bivFrame(0);
    setL(labels.sc, pick(C.PARTS.sc.name), tv.copy(f0.c).addScaledVector(f0.ax, 0.08 * f0.L).add(tv2.set(-9, 0, 4)), on && ph === P.PRO1 && S.zip > 0.4 && !narrow);
    const c0 = G.chiList[0];
    setL(labels.chi, pick(C.PARTS.chiasma.name), c0?.pos ? tv.copy(c0.pos).add(tv2.set(0, 2.6, 2)) : null, on && c0 && (ph === P.DIP || ph === P.MET1));
    setL(labels.coh, pick({ "y7-8": "Glue (cohesin)", "y9-10": "Cohesin" }), G.tubeEnd(0, 0.15, tv).add(tv2.set(-5, 0, 3)), on && (ph === P.S || ph === P.G1 + 1) && S.pt > 1.2 && !y7);
    setL(labels.eq, pick({ "y7-8": "Middle (equator)", "y9-10": "Equator" }), tv.set(0, 36, 0), on && ph === P.MET1);
    setL(labels.pole, pick({ "y7-8": "Pole", "y9-10": "Spindle pole" }), tv.set(-34, -6, 0), on && ph === P.MET1 && !narrow);
    for (let g = 0; g < 4; g++) {
      const gm = S.gametes?.[g], el = labels.prod[g];
      if (!gm || ph !== P.DONE || S.fert) { el.style.display = "none"; continue; }
      const rec = gm.euploid && MD.isRecomb(gm.geno);
      el.classList.toggle("rec", rec); el.classList.toggle("bad", !gm.euploid);
      setL(el, `${gm.geno}<small>${gm.euploid ? (rec ? (y7 ? "swapped mix" : "recombinant") : (y7 ? "" : "parental")) : gm.ploidy}</small>`, G.tetCentre(g, tv).add(tv2.set(0, -19.5, 0)), true);
    }
    const F = S.fert;
    labels.zyg.classList.toggle("bad", !!F && F.zyg.status !== "normal");
    setL(labels.zyg, F ? `${pick({ "y7-8": "New individual", "y9-10": "Zygote" })}: ${F.zyg.genoStr}<small>${F.zyg.count} chromosomes${F.zyg.status !== "normal" ? ` · ${F.zyg.status}` : ""}</small>` : "", tv.set(0, 35, 0), !!F && F.t >= 1);
    // drag ghost
    const d = S.drag;
    if (d && d.idx < 0) setL(labels.ghost, pick({ "y7-8": "let go to swap here", "y9-10": "release to cross over here" }), tv.copy(G.ghost.position).add(tv2.set(0, 0, 9)), true);
    else labels.ghost.style.display = "none";
  }
  function hideLabels() { if (labels) for (const l of Object.values(labels)) (Array.isArray(l) ? l : [l]).forEach((x) => (x.style.display = "none")); }

  // ---------------------------------------------------------------- picking
  let lastHit = null;
  function tubeOf(obj) { return obj?.userData.kind === "chromatid" ? G.tubes[obj.userData.tube] : null; }
  function pairOfHit(hit) {
    const o = hit?.object;
    if (!o) return -1;
    const tb = tubeOf(o);
    if (tb && tb.t < 8) return tb.p;
    if (o.userData.kind === "sc" && hit.instanceId != null) return hit.instanceId >= 22 ? 1 : 0;
    if (o.userData.kind === "chiasma" && hit.instanceId != null) return G.chiList[hit.instanceId]?.p ?? -1;
    if (o.userData.kind === "cohesin" && hit.instanceId != null) return G.rings[hit.instanceId]?.p ?? -1;
    return -1;
  }
  function infoFor(obj) {
    const kind = obj?.userData.kind;
    if (!kind) return null;
    const ph = S.phase, y7 = lens.band === "y7-8";
    if (kind === "chromatid") {
      const tb = tubeOf(obj);
      let title = pick(C.PARTS.chromatid.name);
      if (tb.t >= 8) title = pick({ "y7-8": "Chromosome from the other parent", "y9-10": "Chromosome from parent 2" });
      else title += ` · ${tb.k & 1 ? pick({ "y7-8": "from father", "y9-10": "paternal" }) : pick({ "y7-8": "from mother", "y9-10": "maternal" })}, pair ${tb.p + 1}`;
      if (ph === P.PRO1 && S.zip >= 0.95 && tb.t < 8) title += pick({ "y7-8": " — drag along it to swap pieces", "y9-10": " — drag to place a crossover" });
      else if (ph === P.MET1 && tb.t < 8) title += " — click to flip the bivalent";
      else if (ph === P.MET2 && tb.t < 8) title += " — click to flip";
      else if (ph === P.DONE && !S.fert && tb.t < 8) title += " — click to fertilise";
      return { kind, title, tube: tb.t };
    }
    if (kind === "cohesin") {
      const r = lastHit?.object === obj && lastHit.instanceId != null ? G.rings[lastHit.instanceId] : null;
      return { kind: r?.cen ? "cohesinCen" : "cohesinArm", title: r ? pick(C.PARTS[r.cen ? "cohesinCen" : "cohesinArm"].name) : pick({ "y7-8": "Glue proteins (cohesin)", "y9-10": "Cohesin rings" }) };
    }
    if (kind === "shugoshin") return lens.atLeast("y11") ? { kind, title: pick(C.PARTS.shugoshin.name) } : null;
    if (kind === "cell" && ph === P.DONE && !S.fert) return { kind: "cell", title: `${C.productName(S.org, false, lens.band)} ${obj.userData.slot + 1}: ${S.gametes?.[obj.userData.slot]?.geno ?? ""} — click to fertilise`, slot: obj.userData.slot };
    if (kind === "egg" && S.fert?.t >= 1) return { kind: "zygote", title: pick(C.PARTS.zygote.name) };
    if (kind === "wall" && S.org !== "plant") return null;
    const p = C.PARTS[kind];
    return p ? { kind, title: pick(p.name) } : null;
  }
  function showSelection(info) {
    if (!selCard) return;
    if (!info) { selCard.style.display = "none"; G.selGlow.visible = false; return; }
    const p = C.PARTS[info.kind] || C.PARTS.chromatid;
    let extra = "";
    if (info.kind === "chromatid" && info.tube != null) {
      const tb = G.tubes[info.tube];
      if (tb.bins) {
        const al = MD.LOCI[tb.p].map((l) => `${l.gene}: <b>${MD.alleleAt(tb.bins[Math.floor(l.pos * MD.N)], l.gene, S.p2chroms)}</b>`).join(" · ");
        const mixed = new Set(tb.bins).size > 1;
        extra = `<div class="io"><b>Alleles</b><span>${al}</span><b>Origin</b><span>${tb.t >= 8 ? "parent 2" : mixed ? pick({ "y7-8": "a swapped mix of mother's and father's DNA", "y9-10": "recombinant: part maternal, part paternal" }) : tb.k & 1 ? "paternal" : "maternal"}</span></div>`;
      }
    }
    selCard.style.display = "";
    selCard.innerHTML = `<h2>Selected</h2><p style="color:var(--ink);font-weight:600;margin-bottom:4px"><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};margin-right:6px"></i>${info.title}</p><p>${pick(p.role || "")}</p>${extra}`;
    G.selGlow.visible = !!info.point;
    if (info.point) { G.selGlow.position.copy(info.point); G.selGlow.scale.setScalar(7); }
  }

  // ---------------------------------------------------------------- level object
  let mounted = false, uiT = 0, exT = 0;
  const level = {
    title: "Meiosis & variation",
    topics: ["meiosis", "inheritance", "genes", "mutation", "cell-cycle"],
    root: G.root,
    pickables: G.pickables,
    fallbackPickables: G.fallback,
    metersPerUnit: 1e-7,
    get view() { return viewFor(); },
    minDistance: 10, maxDistance: 430, near: 0.5, far: 4000,
    enablePan: true,
    env: { bg: ["#0b0a26", "#1b1036", "#3b1552"], fog: ["#120d2c", 0.0012], exposure: 0.98, bloom: [0.32, 0.4, 0.93], aperture: 0.00012 },
    model: S,
    info(obj) { return infoFor(obj); },
    onHover(obj) {
      const ph = S.phase;
      let h = null;
      const tb = tubeOf(obj);
      if (tb && tb.t < 8 && !S.fert) {
        if (ph === P.PRO1 || ph === P.DIP || ph === P.MET1) h = { type: "pair", id: tb.p };
        else if (ph === P.MET2) h = { type: "chrom", id: tb.k };
        else if (ph === P.DONE) h = { type: "gamete", id: G.gameteOf(tb) };
      } else if (obj?.userData.kind === "cell" && ph === P.DONE && !S.fert) h = { type: "gamete", id: obj.userData.slot };
      G.hover = h;
    },
    onPointerDown(e, hit) {
      if (S.phase !== P.PRO1 || S.fert || S.zip < 0.95 || engine.busy) return false;
      let p = pairOfHit(hit), u;
      if (p >= 0) u = G.uFromPoint(p, hit.point);
      else {
        const nb = G.nearBivalent(engine.setRay(e.clientX, e.clientY));
        if (!nb) return false;
        p = nb.p; u = nb.u;
      }
      u = K.clamp(u, 0, 1);
      const L = MD.LEN[p] * 4;
      let idx = S.cross[p].findIndex((c) => Math.abs(c.x - u) * L < 2.2);
      if (hit?.object.userData.kind === "chiasma" && hit.instanceId != null) { const c = G.chiList[hit.instanceId]; idx = S.cross[p].indexOf(c.c); }
      S.drag = { p, idx, u: MD.validPos(p, u), x0: e.clientX, y0: e.clientY, moved: false };
      if (idx < 0) G.showGhost(p, S.drag.u);
      return true;
    },
    onPointerDrag(e) {
      const d = S.drag;
      if (!d) return;
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 6) d.moved = true;
      const u = G.uFromRay(d.p, engine.setRay(e.clientX, e.clientY));
      if (u == null) return;
      d.u = MD.validPos(d.p, u);
      if (d.idx >= 0 && d.moved) { S.cross[d.p][d.idx].x = d.u; rebuildCross(); }
      else if (d.idx < 0) G.showGhost(d.p, d.u);
    },
    onPointerUp() {
      const d = S.drag;
      if (!d) return;
      S.drag = null; G.showGhost(null);
      if (d.idx >= 0) {
        if (!d.moved) { S.cross[d.p].splice(d.idx, 1); rebuildCross(); toast(pick({ "y7-8": "Swap removed", "y9-10": "Chiasma removed" })); }
      } else if (addCross(d.p, d.u)) {
        const between = d.p === 0 && d.u > MD.LOCUS.A.pos && d.u < MD.LOCUS.B.pos;
        toast(d.p === 0 ? (between ? pick({ "y7-8": "Swap made between genes A and B: watch the letters change partners", "y9-10": "Crossover between A and B: two chromatids are now recombinant (Ab and aB)" }) : pick({ "y7-8": "Swap made, but not between A and B, so A and B stay together", "y9-10": "Crossover outside the A–B interval: alleles beyond it swap, but A and B stay together" })) : pick({ "y7-8": "Swap made on pair 2", "y9-10": "Crossover on pair 2: D and d may now swap partners" }));
      }
      refreshUI();
    },
    onClick(e, hit) {
      lastHit = hit;
      const ph = S.phase, ready = S.pt >= phaseDur(ph) * 0.55;
      if (S.fert) return false;
      if (ph === P.MET1 && ready) { const p = pairOfHit(hit); if (p >= 0) { flipBiv(p); return true; } }
      if (ph === P.MET2 && ready) {
        const tb = tubeOf(hit?.object);
        if (tb && tb.t < 8) { flipChrom(S.dest[tb.k][tb.s].side, tb.p); return true; }
      }
      if (ph === P.DONE) {
        const tb = tubeOf(hit?.object);
        if (tb && tb.t < 8) { startFert(G.gameteOf(tb)); return true; }
        if (hit?.object.userData.kind === "cell") { startFert(hit.object.userData.slot); return true; }
      }
      return false;
    },
    onSelect(info) { showSelection(info); },
    mountPanel(el) {
      mounted = true;
      makeLabels();
      if (progress && progress.band === lens.band) { panelHost = el; el.appendChild(progress.node); }
      else buildPanel(el);
      buildChips();
      if (!stageBar) buildStageBar();
      engine.stageEl.appendChild(stageBar);
      refreshUI(true);
    },
    unmountPanel() { hideLabels(); engine.overlay.innerHTML = ""; chips = null; stageBar?.remove(); mounted = false; },
    onResume() { makeLabels(); },
    onLens() {
      progress = null; panelHost.innerHTML = ""; G.showSgo = lens.atLeast("y11");
      buildPanel(panelHost); buildChips(); refreshUI(true);
    },
    dispose() {
      if (labels) for (const l of Object.values(labels)) (Array.isArray(l) ? l : [l]).forEach((x) => x.remove());
      stageBar?.remove();
      G.dispose();
    },
    update(dt, t, realDt) {
      const rdt = realDt ?? dt;
      const sdt = dt * S.speed;
      S.pt += sdt;
      const ph = S.phase, dur = phaseDur(ph);
      // orientation flips animate
      const k = Math.min(1, sdt * 2.6 + (dt === 0 ? 0 : 0));
      for (let p = 0; p < 2; p++) {
        S.disp[p] += K.clamp(S.orient[p] - S.disp[p], -k, k);
        for (let sd = 0; sd < 2; sd++) S.disp2[sd][p] += K.clamp(S.orient2[sd][p] - S.disp2[sd][p], -k, k);
      }
      if (ph === P.MET1 && S.pt >= dur && Math.abs(S.disp[0] - S.orient[0]) < 0.01 && Math.abs(S.disp[1] - S.orient[1]) < 0.01) S.orientSeen.add(S.orient[0] ^ S.orient[1]);
      setDest();
      const e = K.easeInOut(K.clamp(S.pt / dur, 0, 1));
      // fertilisation
      const F = S.fert;
      if (F && F.t < 1) {
        F.t = Math.min(1, F.t + sdt / 2.8);
        if (F.t >= 1) {
          S.zygotes++; S.lastZygote = `${F.zyg.genoStr} (${F.zyg.count} chromosomes${F.zyg.status !== "normal" ? `, ${F.zyg.status}` : ""})`;
          if (F.zyg.status === "trisomy") S.trisomy = true;
          renderTally(); refreshUI(true);
          toast(F.zyg.status === "normal" ? `Fertilisation: n + n = 2n · zygote <b>${F.zyg.genoStr}</b>` : `Zygote with ${F.zyg.count} chromosomes: <b>${F.zyg.status}</b>`, 3200);
        }
      }
      G.update(sdt, t, e, S.pt, dur);
      // auto-advance
      if (S.pt >= dur && !S.fert && !S.drag && !engine.busy) {
        S.held += sdt;
        if (C.PHASES[ph].auto && S.held > 0.6) next();
        else if (S.auto && S.held > (ph === P.DONE ? 2.6 : 1.4)) {
          if (ph === P.PRO1 && S.zip < 0.95) { /* wait */ } else next();
        }
      }
      updateLabels();
      if (G.selGlow.visible) G.selGlow.material.opacity = 0.35 + 0.2 * Math.sin(t * 3);
      uiT -= rdt; exT -= rdt;
      if (uiT <= 0) {
        uiT = 0.2;
        if (chips) { const c = chipText(e); chips.forEach((f, i) => f(c[i])); }
        if (barText) { const h = hintText(); if (barText.textContent !== h) barText.textContent = h; barBtn.classList.toggle("wait", S.pt >= dur && !C.PHASES[ph].auto && !S.fert); }
        mission?.update();
      }
      if (exT <= 0) { exT = 0.4; updateExplain(); }
    },
  };

  function recChromatids() {
    let rec = 0;
    for (const k of [0, 1]) for (const s of [0, 1]) { const b = S.ch[k][s]; if (MD.atLocus(b, MD.LOCUS.A.pos) !== MD.atLocus(b, MD.LOCUS.B.pos)) rec++; }
    return rec;
  }
  function updateExplain() {
    if (!explainBody) return;
    const X = { pick, band: lens.band, org: S.org, nx: S.cross[0].length + S.cross[1].length, recChromatids: recChromatids(), sameOrient: S.orient[0] === S.orient[1], gametes: S.gametes, prodName: C.productName(S.org, true, lens.band) };
    const paras = S.fert && S.fert.t >= 1 ? C.fertNarrative(S.fert, X) : S.fert ? [pick({ "y7-8": "The two sex cells are joining…", "y9-10": "Fertilisation: the two haploid cells fuse and their chromosomes come together in one nucleus." })] : C.narrative(S, X);
    const html = paras.map((p) => `<p>${p}</p>`).join("");
    if (explainBody._h !== html) { explainBody.innerHTML = html; explainBody._h = html; }
  }

  // initial layout: settle every part where phase 0 puts it
  setDest();
  G.update(0, 0, 1, phaseDur(0), phaseDur(0));
  G.snapshot();
  return level;
}
