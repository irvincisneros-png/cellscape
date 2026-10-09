// "DNA to protein" as a CellScape molecular level (dna → expression → folding), and the standalone page
// sims/protein-synthesis/index.html. The state machine is ported from the reviewed 2D sim (sim2d.js): transcription
// (place RNA nucleotides on the template strand), export through a nuclear pore, translation (deliver tRNAs to the
// A/P/E sites; a release factor at the stop codon), and the mutation lab. All genetics comes from model.js.
//
// ── Shared with the child level ("folding") ─────────────────────────────────────────────────────────────────────
// level.shared = {
//   polypeptide: string[]   one-letter amino-acid codes, N → C terminus, starting "M", stop codon NOT included.
//                           The chain most recently released by the ribosome; before any release (or after the DNA
//                           is edited) it is the predicted translation of the current gene. [] if there is no start codon.
//   names:       string[]   the same chain as three-letter names ("Met", "Val", …)
//   released:    boolean    true when `polypeptide` is a chain the student actually built for the current gene
//   complete:    boolean    true if translation ended at a stop codon (false = ran off the mRNA, e.g. a frameshift)
//   original:    string[]   the unmutated polypeptide (M V H L T P E E K)
//   gene:        string     current coding strand of the transcribed region, 5′→3′ (DNA letters)
//   mutation:    { kind, title, detail }   M.classify(ORIGINAL_GENE, gene): kind ∈ none | silent | missense | nonsense |
//                           frameshift | inframe | stoplost | startlost | noncoding
//   sickle:      boolean    gene is exactly the sickle-cell allele (codon 6 GAG → GTG, Glu6Val)
// }
// The folding level can read it as `engine.current.shared` inside its create() (this level is still current), or as
// `engine.stack.at(-2).inst.shared` once it is mounted. The object is updated in place, so a reference stays live.
import * as THREE from "three";
import * as K from "../../assets/js/kit.js";
import * as M from "./model.js";
import { ExprScene, makeTRNA, makeRF, UPL, GENE_MAX, GENE_MIN, MX0, NT2 } from "./scene3d.js";
import { nucleotideMesh, COL, RISE } from "../../assets/js/world/levels/dnaHelix.js";
import { NOTE, NAMES, explain, plainResult, MISSIONS, QUIZ } from "./content3d.js";

const CSS = `
.lbl3d.ps3 { background: rgba(5,11,22,0.66); border: 1px solid rgba(196,181,253,0.3); padding: 2px 8px; border-radius: 999px; color: var(--ink); backdrop-filter: blur(4px); font-size: 0.72rem; }
.lbl3d.ps3.small { font-size: 0.66rem; color: var(--ink-dim); padding: 1px 7px; }
.lbl3d.pszone { color: rgba(232,241,255,0.5); font-size: 0.72rem; letter-spacing: 0.16em; font-weight: 600; text-shadow: 0 1px 8px #000; }
.lbl3d.site { width: 22px; height: 22px; line-height: 22px; text-align: center; border-radius: 50%; background: rgba(124,150,238,0.35); border: 1px solid #c7d2fe; font-weight: 700; font-size: 0.74rem; color: #fff; }
.lbl3d.codon { font: 600 0.72rem ui-monospace, Menlo, Consolas, monospace; letter-spacing: 0.06em; color: var(--ink-dim); background: rgba(5,11,22,0.6); padding: 1px 6px; border-radius: 6px; border: 1px solid transparent; }
.lbl3d.codon.hl { color: #fde68a; border-color: #fbbf24; }
.lbl3d.codon.stop { color: #fca5a5; }
.lbl3d.psnuc { font: 700 0.78rem Inter, system-ui, sans-serif; color: #fff; text-shadow: 0 1px 4px #000, 0 0 6px #000; }
.lbl3d.pstrna { font: 600 0.68rem ui-monospace, Menlo, Consolas, monospace; color: #fff; background: rgba(5,11,22,0.7); border: 1px solid rgba(236,111,174,0.6); padding: 1px 6px; border-radius: 6px; }
.lbl3d.pstrna.rf { border-color: #2dd4bf; font-family: Inter, sans-serif; }
#pstray { position: absolute; left: 50%; bottom: 40px; transform: translateX(-50%); display: flex; gap: 6px; padding: 6px; border-radius: 14px; z-index: 3;
  background: rgba(5,11,22,0.78); border: 1px solid var(--panel-border); backdrop-filter: blur(8px); max-width: calc(100% - 24px); overflow-x: auto; }
#pstray button { border: 1px solid transparent; background: transparent; color: var(--ink); padding: 6px 10px; border-radius: 10px; cursor: pointer; font-weight: 600; display: flex; gap: 6px; align-items: center; white-space: nowrap; font-size: 0.8rem; }
#pstray button i { width: 12px; height: 12px; border-radius: 3px; flex: 0 0 12px; }
#pstray button:hover { border-color: var(--accent); }
#pstray button code { font-family: ui-monospace, Menlo, Consolas, monospace; }
#pstray span { color: var(--ink-faint); font-size: 0.74rem; align-self: center; padding: 0 4px; white-space: nowrap; }
#pspicker { position: absolute; z-index: 6; display: flex; gap: 4px; padding: 6px; border-radius: 12px; background: rgba(5,11,22,0.92); border: 1px solid var(--accent-3); transform: translate(-50%, -120%); }
#pspicker button { width: 34px; height: 34px; border-radius: 8px; border: 0; font-weight: 700; color: #06121f; cursor: pointer; }
#pspicker button.x { background: transparent; color: var(--ink-dim); border: 1px solid var(--panel-border); }
.ps3d .seq-note { font-size: 0.78rem; color: var(--ink-faint); }
.ps3d .lab-out { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; font-size: 0.82rem; }
.ps3d .row-lbl { color: var(--ink-faint); font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.06em; }
.ps3d .prot { display: flex; flex-wrap: wrap; gap: 3px; }
.ps3d .prot .aa { font-size: 0.72rem; padding: 1px 5px; border-radius: 6px; color: #04101f; font-weight: 600; }
.ps3d .prot .aa.diff { outline: 2px solid #fff; outline-offset: 1px; }
.ps3d .prot .none { color: var(--ink-faint); font-style: italic; }
.ps3d .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-weight: 600; font-size: 0.8rem; }
.ps3d .badge.k-none, .ps3d .badge.k-noncoding, .ps3d .badge.k-silent { background: rgba(74,222,128,0.18); color: #b8f5cd; }
.ps3d .badge.k-missense, .ps3d .badge.k-inframe, .ps3d .badge.k-stoplost { background: rgba(251,191,36,0.18); color: #fde68a; }
.ps3d .badge.k-nonsense, .ps3d .badge.k-frameshift, .ps3d .badge.k-startlost { background: rgba(248,113,113,0.2); color: #fecaca; }
.ps3d .status { font-size: 0.78rem; color: var(--ink-faint); }
.ps3d .status.ok { color: var(--good); }
.ps3d .dna-diff { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.78rem; word-break: break-all; color: var(--ink-dim); }
.ps3d .dna-diff mark { background: rgba(248,113,113,0.35); color: #fff; border-radius: 3px; padding: 0 1px; }
.ps3d .speed-label { font-size: 0.85rem; margin: 10px 0 6px; }
dialog.ps3-gc { background: #0b1930; color: var(--ink); border: 1px solid var(--panel-border); border-radius: 16px; width: min(680px, calc(100% - 20px)); max-height: 92vh; padding: 14px; overflow: auto; }
dialog.ps3-gc::backdrop { background: rgba(2, 6, 14, 0.7); }
dialog.ps3-gc h2 { font-family: var(--font-display); margin: 0 0 4px; font-size: 1.05rem; }
dialog.ps3-gc p { margin: 0 0 10px; color: var(--ink-dim); font-size: 0.85rem; }
.ps3-gc .gct-wrap { overflow-x: auto; }
.ps3-gc table { border-collapse: collapse; width: 100%; min-width: 520px; font-size: 0.78rem; }
.ps3-gc th { color: var(--ink-faint); font-weight: 600; padding: 4px; }
.ps3-gc th.b { font-size: 1rem; color: var(--ink); }
.ps3-gc td { border: 1px solid var(--panel-border); padding: 3px; vertical-align: top; }
.ps3-gc .cd { display: flex; gap: 6px; padding: 2px 4px; border-radius: 5px; border-left: 4px solid transparent; margin: 1px 0; white-space: nowrap; }
.ps3-gc .cd b { font-family: ui-monospace, Menlo, Consolas, monospace; letter-spacing: 0.05em; }
.ps3-gc .cd.hl { background: rgba(255,255,255,0.18); box-shadow: 0 0 0 2px var(--accent-3); }
.ps3-gc th.third { font-size: 0.72rem; line-height: 1.95; }
.ps3-gc .gc-close { float: right; }
.ps-chip .w { color: var(--ink-faint); }
@media (max-width: 600px) { .ps-chip.opt { display: none; } #pstray button { padding: 5px 7px; font-size: 0.74rem; } }
`;

export function create(engine) {
  if (!document.getElementById("ps3d-gen-css")) {
    const st = document.createElement("style");
    st.id = "ps3d-gen-css"; st.textContent = CSS;
    document.head.appendChild(st);
  }
  const lens = engine.lens;
  const toast = (m, ms) => engine.toast?.(m, ms);
  const reduced = engine.reducedMotion;
  const parentId = engine.stack.at(-1)?.id || null;

  const labelLayer = document.createElement("div");
  labelLayer.style.display = "contents";
  const G = new ExprScene(engine, labelLayer);
  const H = G.helix;
  const overlay = document.createElement("div");
  overlay.style.display = "contents";

  // ---------------------------------------------------------------- state (same shape as the 2D sim)
  const S = {
    act: 1, auto: false, autoT: 0, errors: 0, tool: "off",
    gene: M.ORIGINAL_GENE.split("").map((b) => ({ b, mut: false, del: false })),
    t1: null, t2: null, speed: reduced ? 0.75 : 1, follow: true, userCam: false, labels: true,
    flags: { transcribed: false, translated: false, silent: false, nonsense: false, frameshift: false, sickle: false, noT: false, changed: false, harmful: false },
    lastResult: null, lastChain: null, lastChainGene: null,
  };
  const geneStr = () => S.gene.map((n) => n.b).join("");
  let trCache = { g: null, tr: null };
  const curTr = () => { const g = geneStr(); if (trCache.g !== g) trCache = { g, tr: M.translate(M.toRNA(g)) }; return trCache.tr; };

  // shared with the folding level (documented at the top of this file)
  const ORIGINAL_POLY = M.translate(M.toRNA(M.ORIGINAL_GENE)).aas;
  const shared = { polypeptide: [], names: [], released: false, complete: true, original: ORIGINAL_POLY.slice(), gene: "", mutation: null, sickle: false };
  function writeShared() {
    const g = geneStr(), tr = curTr();
    const rel = S.lastChain && S.lastChainGene === g;
    const poly = rel ? S.lastChain.slice() : tr.start >= 0 ? tr.aas.slice() : [];
    shared.polypeptide = poly;
    shared.names = poly.map((a) => M.AA[a][0]);
    shared.released = !!rel;
    shared.complete = rel ? S.lastChainComplete : tr.stop;
    shared.gene = g;
    shared.mutation = M.classify(M.ORIGINAL_GENE, g);
    shared.sickle = g === M.SICKLE_GENE;
  }
  writeShared();

  // ---------------------------------------------------------------- ACT 1 — transcription
  function resetAct1() {
    S.t1 = { phase: "ready", placed: 0, polA: 0, phaseT: 0, openF: 1, relF: 0, polLift: 0, gene: geneStr() };
    G.setGene(geneStr());
    G.pool1.clear();
    for (let i = 0; i < 4; i++) spawnNuc(["A", "U", "G", "C"][i]);
    for (let i = 0; i < 3; i++) spawnNuc(randomNucBase());
    G.refreshPick();
  }
  const neededBase = () => { const n = S.gene[S.t1.placed]; return n ? M.toRNA(n.b) : null; };
  const randomNucBase = () => (Math.random() < 0.12 ? "T" : "AUGC"[Math.floor(Math.random() * 4)]);
  function spawnNuc(b) {
    const it = G.pool1.add(nucleotideMesh(b, { sugar: b === "T" ? COL.sugar : COL.ribose, phosphates: 3 }), { b });
    it.lbl = G.mk("psnuc", b);
    it.obj.scale.setScalar(1 / 1.0);
    return it;
  }
  function maintainNucs() {
    const t1 = S.t1;
    const active = G.pool1.items.filter((i) => !i.leaving);
    const need = t1.phase === "ready" || t1.phase === "elong" ? neededBase() : null;
    let changed = false;
    if (need && !active.some((i) => i.data.b === need && !i.fly)) { spawnNuc(need); changed = true; }
    if (active.length < (engine.camera.aspect < 0.8 ? 6 : 8) && (t1.phase === "ready" || t1.phase === "elong")) { spawnNuc(randomNucBase()); changed = true; }
    if (changed) G.refreshPick();
  }
  const slotLocal = (out) => H.partnerPos(UPL + S.t1.placed, 1, out);
  function tryPlace1(it, tapped) {
    const t1 = S.t1;
    if (!(t1.phase === "ready" || t1.phase === "elong")) { toast(lens.pick({ "y7-8": "This gene has already been copied. Press <strong>Reset act</strong> to copy it again.", "y9-10": "This gene is already transcribed. Press <strong>Reset act</strong> to transcribe it again." })); return; }
    if (it.data.b === neededBase()) G.pool1.flyTo(it, (o) => slotLocal(o), tapped ? 0.35 : 0.12, arrive1);
    else reject1(it);
  }
  function arrive1(it) {
    const t1 = S.t1;
    if ((t1.phase === "ready" || t1.phase === "elong") && it.data.b === neededBase()) {
      it.lbl?.remove(); G.pool1.remove(it); G.refreshPick();
      t1.placed++; t1.phase = "elong"; S.userCam = false;
      if (t1.placed >= S.gene.length) startTerm();
    } else reject1(it);
  }
  function reject1(it) {
    const n = S.gene[S.t1.placed];
    if (!n) return;
    const tb = M.DNA_PAIR[n.b], need = M.RNA_FOR_TEMPLATE[tb];
    if (it) G.pool1.reject(it);
    S.errors++;
    if (it?.data.b === "T") S.flags.noT = true;
    toast(it?.data.b === "T"
      ? lens.pick({ "y7-8": "✗ <strong>T</strong> is only used in DNA. The mRNA copy uses <strong>U</strong> instead.", "y9-10": "✗ <strong>T (thymine)</strong> is only used in DNA. RNA uses <strong>U (uracil)</strong> instead." })
      : lens.pick({ "y7-8": `✗ ${it?.data.b} doesn't match <strong>${tb}</strong>. ${tb} pairs with <strong>${need}</strong>.`, "y9-10": `✗ ${it?.data.b} can't pair with template base <strong>${tb}</strong>. Template ${tb} pairs with RNA base <strong>${need}</strong>.` }), 3200);
  }
  function startTerm() {
    const t1 = S.t1;
    t1.phase = "term"; t1.phaseT = 0;
    S.flags.transcribed = true;
    t1.gene = geneStr();
    for (const i of G.pool1.items) i.leaving = true;
  }
  function autoComplete1() {
    const t1 = S.t1;
    if (t1.phase === "ready" || t1.phase === "elong") { t1.placed = S.gene.length; startTerm(); toast("Auto-completed transcription."); }
    else if (t1.phase === "term" || t1.phase === "export") { t1.phase = "exported"; t1.phaseT = 0; }
  }
  const smooth = (a, b, x) => { const t = K.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function update1(dt) {
    const t1 = S.t1, Gn = S.gene.length;
    t1.phaseT += dt;
    if (t1.phase === "term") {
      const e = t1.phaseT;
      t1.polA = K.lerp(t1.polA, Gn + 4, Math.min(1, dt * 2.5));
      t1.openF = 1 - smooth(0.7, 1.6, e);
      t1.relF = smooth(0.2, 1.2, e);
      t1.polLift = smooth(0.9, 1.8, e);
      if (e > 2) { t1.phase = "export"; t1.phaseT = 0; flyExport(); }
    } else if (t1.phase === "export") {
      if (t1.phaseT > 3.6) { t1.phase = "exported"; t1.phaseT = 0; toast(lens.pick({ "y7-8": "The mRNA copy has left the nucleus. On to building the protein!", "y9-10": "mRNA has left the nucleus. On to translation!" })); }
    } else if (t1.phase !== "exported") {
      t1.polA += (t1.placed - t1.polA) * Math.min(1, dt * 6);
      t1.openF = 1; t1.relF = 0; t1.polLift = 0;
    }
    maintainNucs();
  }

  // ---------------------------------------------------------------- mutation lab
  function applyEdit(mode, gi, b) {
    const Gn = S.gene.length;
    if (mode === "sub") {
      if (S.gene[gi].b === b) return;
      S.gene[gi] = { ...S.gene[gi], b, mut: true };
    } else if (mode === "ins") {
      if (Gn >= GENE_MAX) { toast("The gene is long enough — try deleting instead."); return; }
      S.gene.splice(gi, 0, { b, mut: true, del: false });
    } else if (mode === "del") {
      if (Gn <= GENE_MIN) { toast("Can't delete any more bases."); return; }
      S.gene.splice(gi, 1);
      const next = S.gene[gi];
      if (next) next.del = true;
    }
    afterDnaChange();
  }
  function afterDnaChange() {
    const t1 = S.t1;
    if (t1 && (t1.placed > 0 || t1.phase !== "ready")) toast(lens.pick({ "y7-8": "DNA changed — copying starts again with the new letters.", "y9-10": "DNA changed — transcription restarted with the new sequence." }));
    clearAct2();
    resetAct1();
    if (S.act === 2) setAct(1, true);
    updateLab(); writeShared();
  }
  function setGeneTo(str, mutIdx = []) {
    S.gene = str.split("").map((b, i) => ({ b, mut: mutIdx.includes(i), del: false }));
    afterDnaChange();
  }

  // ---------------------------------------------------------------- ACT 2 — translation
  function clearAct2() {
    const t2 = S.t2;
    if (!t2) return;
    G.pool2.clear();
    for (const b of t2.bound) disposeObj(b.obj);
    if (t2.rfObj) disposeObj(t2.rfObj);
    S.t2 = null;
    G.refreshPick();
  }
  function disposeObj(o) {
    if (!o) return;
    o.parent?.remove(o);
    o.traverse((c) => { if (c.geometry && !c.geometry.userData.shared) c.geometry.dispose(); });
  }
  function setupAct2(gene) {
    clearAct2();
    const mrna = M.toRNA(gene), tr = M.translate(mrna);
    S.t2 = {
      gene, mrna, tr, start: tr.start, k: 0, rk: 0, phase: tr.start < 0 ? "nostart" : "init", phaseT: 0,
      bound: [], chain: [], chainOn: null, large: 0, small: 0, sep: 0, rfBound: false, released: false, rfObj: null,
    };
    if (tr.start < 0) recordResult(gene);
  }
  const go2 = (ph) => { S.t2.phase = ph; S.t2.phaseT = 0; S.autoT = 0; };
  const aCodon = () => { const t2 = S.t2, i = t2.start + 3 * (t2.k + 1); return i + 3 <= t2.mrna.length ? t2.mrna.slice(i, i + 3) : null; };
  function needKey() {
    const t2 = S.t2;
    if (!t2) return null;
    if (t2.phase === "needP") return "AUG";
    if (t2.phase === "needA") return aCodon();
    if (t2.phase === "stop") return "RF";
    return null;
  }
  const itemKey = (it) => (it.data.kind === "rf" ? "RF" : it.data.codon);
  function distractorCodon(need) {
    const all = Object.keys(M.CODE);
    for (let tries = 0; tries < 60; tries++) {
      let c;
      if (need && need !== "RF" && Math.random() < 0.45) {
        const pos = K.randInt(0, 2);
        const nb = K.pick("UCAG".replace(need[pos], "").split(""));
        c = need.slice(0, pos) + nb + need.slice(pos + 1);
      } else c = K.pick(all);
      if (M.CODE[c] === "*") continue;
      if (need && need !== "RF" && M.CODE[c] === M.CODE[need]) continue; // never offer a synonymous (wobble) tRNA as "wrong"
      if (G.pool2.items.some((i) => i.data.codon === c)) continue;
      return c;
    }
    return "GGC";
  }
  function spawn2(spec) {
    const obj = spec.kind === "rf" ? makeRF() : makeTRNA(spec.codon, spec.aa);
    const it = G.pool2.add(obj, spec);
    const y11 = lens.atLeast("y11");
    it.lbl = G.mk(`pstrna${spec.kind === "rf" ? " rf" : ""}`, spec.kind === "rf" ? lens.pick(NAMES.rf) : `${y11 ? `3′-${spec.anti}-5′` : spec.anti} · ${M.AA[spec.aa][0]}`);
    G.refreshPick();
    trayKey = "";
    return it;
  }
  const makeSpec = (codon) => ({ kind: "trna", codon, anti: M.anticodonOf(codon), aa: M.CODE[codon] });
  function maintainPool2() {
    const t2 = S.t2;
    if (!t2 || ["nostart", "done", "stall", "release"].includes(t2.phase)) return;
    const target = engine.camera.aspect < 0.8 ? 3 : 5;
    const need = needKey();
    const active = G.pool2.items.filter((i) => !i.leaving);
    if (need && !active.some((i) => itemKey(i) === need)) {
      if (active.length >= target) {
        const victims = active.filter((i) => !i.fly && G.pool2.drag?.it !== i);
        if (victims.length) retire(K.pick(victims));
      }
      spawn2(need === "RF" ? { kind: "rf", codon: "RF" } : makeSpec(need));
    }
    if (need !== "RF") for (const i of active) if (i.data.kind === "rf" && G.pool2.drag?.it !== i) retire(i);
    if (G.pool2.items.filter((i) => !i.leaving).length < target) spawn2(makeSpec(distractorCodon(need)));
  }
  function retire(it) { it.leaving = true; it.lbl?.remove(); trayKey = ""; }
  function siteLocal(which, out) {
    const t2 = S.t2, c = which === "P" ? t2.k : t2.k + 1;
    return out.set(G.codonX(t2, c), 0, 0);
  }
  function tryPlace2(it, tapped) {
    const t2 = S.t2, ph = t2.phase;
    if (!["needP", "needA", "stop"].includes(ph)) {
      if (["init", "join", "bond", "shift"].includes(ph)) toast("Wait a moment — the ribosome is busy.");
      return;
    }
    const site = ph === "needP" ? "P" : "A";
    if (itemKey(it) === needKey()) G.pool2.flyTo(it, (o) => siteLocal(site, o), tapped ? 0.45 : 0.15, arrive2);
    else reject2(it, needKey());
  }
  function reject2(it, need) {
    G.pool2.reject(it);
    S.errors++;
    let msg;
    const y7 = lens.band === "y7-8";
    if (need === "RF") msg = y7 ? `✗ No carrier matches the stop word <strong>${aCodon()}</strong>. Drag the <strong>stop protein</strong> instead.` : `✗ No tRNA has an anticodon for the stop codon <strong>${aCodon()}</strong>. A <strong>release factor</strong> protein binds instead.`;
    else if (it.data.kind === "rf") msg = y7 ? "✗ The stop protein only fits when a STOP word is in place." : "✗ Release factors only bind when a <strong>stop codon</strong> is in the A site.";
    else {
      const na = M.anticodonOf(need), aa = M.AA[M.CODE[need]];
      msg = y7 ? `✗ ${it.data.anti} doesn't match <strong>${need}</strong>. Look for the carrier labelled <strong>${na}</strong> (it brings ${aa[0]}).`
        : `✗ Anticodon ${lens.atLeast("y11") ? `3′-${it.data.anti}-5′` : it.data.anti} pairs with codon ${it.data.codon}, not <strong>${need}</strong>. You need anticodon <strong>${lens.atLeast("y11") ? `3′-${na}-5′` : na}</strong> (carries ${aa[0]}).`;
    }
    toast(msg, 3400);
  }
  function arrive2(it) {
    const t2 = S.t2;
    const need = needKey();
    if (!need || itemKey(it) !== need) { reject2(it, need); return; }
    it.lbl?.remove();
    G.pool2.detach(it); G.refreshPick(); trayKey = "";
    S.userCam = false;
    if (t2.phase === "needP") {
      t2.bound.push({ c: 0, codon: "AUG", anti: "UAC", aa: "M", charged: false, leave: -1, obj: it.obj });
      t2.chain = [{ a: "M", p: G.aaPos(t2, 0, new THREE.Vector3()) }];
      t2.chainOn = 0;
      go2("join");
    } else if (t2.phase === "needA") {
      t2.bound.push({ c: t2.k + 1, codon: it.data.codon, anti: it.data.anti, aa: it.data.aa, charged: true, leave: -1, obj: it.obj });
      go2("bond");
    } else if (t2.phase === "stop") {
      t2.rfBound = true; t2.rfObj = it.obj;
      go2("release");
    }
  }
  function nextA() {
    const cod = aCodon();
    if (!cod) {
      go2("stall"); for (const i of G.pool2.items) retire(i); S.flyChain = 1.2;
      S.t2.released = true; S.t2.chainOn = null; recordResult(S.t2.gene); return;
    }
    go2(M.CODE[cod] === "*" ? "stop" : "needA");
  }
  function autoComplete2() {
    const t2 = S.t2;
    if (!t2 || ["nostart", "done", "stall", "release"].includes(t2.phase)) return;
    const tr = t2.tr, nA = tr.aas.length;
    for (const b of t2.bound) disposeObj(b.obj);
    t2.k = nA - 1; t2.rk = t2.k; t2.large = 1; t2.small = 1;
    const last = makeTRNA(tr.codons[t2.k], tr.aas[t2.k]);
    G.root.add(last);
    t2.bound = [{ c: t2.k, codon: tr.codons[t2.k], anti: M.anticodonOf(tr.codons[t2.k]), aa: tr.aas[t2.k], charged: false, leave: -1, obj: last }];
    t2.chainOn = t2.k;
    const ap = G.aaPos(t2, t2.k, new THREE.Vector3());
    t2.chain = tr.aas.slice().reverse().map((a, i) => ({ a, p: new THREE.Vector3(ap.x - 0.5 * Math.max(0, i - 2) - 0.3 * Math.min(i, 2), ap.y + 0.7 * i, Math.sin(i) * 0.4) }));
    for (const i of G.pool2.items) { retire(i); i.fly = null; }
    if (tr.stop) { t2.rfBound = true; t2.rfObj = makeRF(); G.root.add(t2.rfObj); go2("release"); }
    else { go2("stall"); t2.released = true; t2.chainOn = null; recordResult(t2.gene); }
    toast("Auto-completed translation.");
  }
  function update2(dt) {
    const t2 = S.t2;
    t2.phaseT += dt;
    const ph = t2.phase, e = t2.phaseT;
    if (ph === "init") { t2.small = Math.min(1, e / 1.3); if (e > 1.5) go2("needP"); }
    else if (ph === "join") { t2.large = Math.min(1, e / 0.8); if (e > 0.9) nextA(); }
    else if (ph === "bond") {
      if (e > 0.65) {
        const b = t2.bound.find((q) => q.c === t2.k + 1);
        t2.chain.unshift({ a: b.aa, p: G.aaPos(t2, t2.k + 1, new THREE.Vector3()) });
        b.charged = false; t2.chainOn = t2.k + 1;
        go2("shift");
      }
    } else if (ph === "shift") {
      t2.rk = t2.k + K.easeInOut(Math.min(1, e / 0.7));
      if (e >= 0.7) {
        t2.k++; t2.rk = t2.k;
        const old = t2.bound.find((q) => q.c === t2.k - 1 && q.leave < 0);
        if (old) old.leave = 0;
        nextA();
      }
    } else if (ph === "release") {
      if (e > 0.6 && !t2.released) { t2.released = true; t2.chainOn = null; }
      t2.sep = smooth(1.0, 2.3, e);
      if (e > 2.4) {
        for (const i of G.pool2.items) retire(i);
        go2("done"); t2.rfBound = false;
        for (const b of t2.bound) disposeObj(b.obj);
        t2.bound = []; disposeObj(t2.rfObj); t2.rfObj = null;
        t2.large = 0; t2.small = 0;
        S.flags.translated = true;
        S.flyChain = 0.9;
        recordResult(t2.gene);
        toast(lens.pick({ "y7-8": `Protein chain finished: ${t2.chain.length} building blocks. Dive into the glowing chain to see it fold!`, "y9-10": `Polypeptide complete: ${t2.chain.length} amino acids. Dive into it to see it fold.` }), 3600);
      }
    }
    for (const b of t2.bound) if (b.leave >= 0) b.leave += dt / 1.3;
    for (const b of t2.bound) if (b.leave >= 1) disposeObj(b.obj);
    t2.bound = t2.bound.filter((b) => b.leave < 1);
    maintainPool2();
  }

  // ---------------------------------------------------------------- results
  function recordResult(gene) {
    const cls = M.classify(M.ORIGINAL_GENE, gene);
    S.lastResult = { gene, cls };
    const t2 = S.t2;
    if (t2 && t2.gene === gene) {
      S.lastChain = t2.chain.slice().reverse().map((b) => b.a);
      S.lastChainGene = gene;
      S.lastChainComplete = t2.phase !== "stall";
    }
    if (cls.kind === "silent") S.flags.silent = true;
    if (cls.kind === "nonsense") S.flags.nonsense = true;
    if (cls.kind === "frameshift") S.flags.frameshift = true;
    if (cls.kind === "nonsense" || cls.kind === "frameshift") S.flags.harmful = true;
    if (cls.kind !== "none") S.flags.changed = true;
    if (gene === M.SICKLE_GENE) { S.flags.sickle = true; toast(lens.pick({ "y7-8": "🩸 That's the sickle-cell change: one building block (Glu) became a different one (Val).", "y9-10": "🩸 That's the sickle-cell mutation: Glu → Val at position 6 of β-globin." }), 4000); }
    updateLab(); writeShared();
  }
  function protHTML(tr, ref) {
    if (tr.start < 0) return `<span class="none">— no protein (no start codon) —</span>`;
    const parts = tr.aas.map((a, i) => `<span class="aa${ref && ref.aas[i] !== a ? " diff" : ""}" style="background:${M.aaCol(a)}" title="${M.AA[a][1]}">${M.AA[a][0]}</span>`);
    if (tr.stop) parts.push(`<span class="aa${ref && ref.aas.length !== tr.aas.length ? " diff" : ""}" style="background:${M.CLASS_COL.stop}">STOP</span>`);
    else parts.push(`<span class="none">(no stop codon)</span>`);
    return parts.join("");
  }
  let labKey = "", labOut = null;
  function updateLab() {
    if (!labOut) return;
    const g = geneStr();
    const key = lens.band + g + "|" + (S.lastResult ? S.lastResult.gene : "") + "|" + S.gene.map((n) => (n.mut ? 1 : 0) + (n.del ? 2 : 0)).join("");
    if (key === labKey) return;
    labKey = key;
    const oTr = M.translate(M.toRNA(M.ORIGINAL_GENE)), mTr = M.translate(M.toRNA(g));
    const cls = M.classify(M.ORIGINAL_GENE, g);
    const observed = S.lastResult && S.lastResult.gene === g;
    const dna = S.gene.map((nd, i) => (i > 0 && i % 3 === 0 ? " " : "") + (nd.del ? `<mark title="deletion here">▾</mark>` : "") + (nd.mut ? `<mark>${nd.b}</mark>` : nd.b)).join("");
    const y7 = lens.band === "y7-8";
    labOut.innerHTML = `
      <div><span class="row-lbl">${y7 ? "DNA letters (top strand)" : "Coding strand (5′→3′)"}</span><div class="dna-diff">${dna}</div></div>
      <div><span class="row-lbl">${y7 ? "Original protein" : "Original polypeptide"}</span><div class="prot">${protHTML(oTr)}</div></div>
      <div><span class="row-lbl">${y7 ? "Your DNA's protein" : "Your DNA's polypeptide"}</span><div class="prot">${protHTML(mTr, oTr)}</div></div>
      <div><span class="badge k-${cls.kind}">${y7 && cls.kind === "none" ? "No change" : cls.title}</span></div>
      <div style="color:var(--ink-dim)">${plainResult(cls, lens.band) || cls.detail}${g === M.SICKLE_GENE ? (y7 ? " This is the <strong>sickle-cell</strong> change: haemoglobin clumps together when oxygen is low, bending red blood cells into a sickle shape." : " This is the <strong>sickle-cell</strong> mutation (HbS): hydrophobic valine replaces charged glutamic acid, so deoxygenated haemoglobin molecules stick together into long fibres and red blood cells become sickle-shaped.") : ""}</div>
      <div class="status ${observed ? "ok" : ""}">${cls.kind === "none" ? (y7 ? "Pick a tool, then click a DNA letter in the nucleus." : "Pick a tool, then click a base pair on the DNA in the nucleus.") : observed ? "✓ Observed: the ribosome built this polypeptide." : "Prediction only — press <strong>Run it</strong> (or transcribe and translate yourself) to test it."}</div>`;
  }

  // ---------------------------------------------------------------- act / tool switching, camera
  const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _v2 = new THREE.Vector3(), _M4 = new THREE.Matrix4();
  function viewFor(act) {
    const cam = engine.camera, a = cam.aspect, tn = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const portrait = a < 0.8;
    if (act === "export") { const halfW = portrait ? 9 : 17; return { target: new THREE.Vector3(-1, 4.5, 0), distance: K.clamp(halfW / (tn * a), 14, 90), dir: new THREE.Vector3(0, 0.1, 1) }; }
    if (act === 2) {
      const halfW = portrait ? 6 : 8.5;
      const x = G.ribX ?? MX0 + NT2 * 2;
      return { target: new THREE.Vector3(x + (portrait ? 0.8 : 1.5), portrait ? -0.2 : 0.2, 0), distance: K.clamp(Math.max(halfW / (tn * a), 6.2 / tn), 12, 70), dir: new THREE.Vector3(0.05, 0.12, 1) };
    }
    const halfW = portrait ? 7.2 : 9;
    G.dnaWorld(_v.set(H.bpX(UPL + (S.t1?.polA || 0) - (portrait ? 1 : 2)), 0, 0), _w);
    return { target: new THREE.Vector3(_w.x + (portrait ? 0.6 : 1), portrait ? -1.6 : 0.2, 0), distance: K.clamp(halfW / (tn * a), 12, 70), dir: new THREE.Vector3(0.05, 0.18, 1) };
  }
  function flyView(v) { engine.fly(v.target, v.target.clone().addScaledVector(v.dir.clone().normalize(), v.distance), 1.1); S.userCam = false; }
  function flyExport() { if (S.follow) flyView(viewFor("export")); }
  function setAct(n, quiet) {
    n = +n;
    if (n === 2) {
      const g = geneStr();
      if (!S.t2 || S.t2.gene !== g) {
        const done = S.t1.gene === g && ["term", "export", "exported"].includes(S.t1.phase);
        if (!done && !quiet) toast(lens.pick({ "y7-8": "The mRNA copy was made automatically so you can build the protein.", "y9-10": "mRNA auto-transcribed from the current DNA so you can translate it." }));
        setupAct2(g);
      }
      G.ribX = S.t2.start >= 0 ? G.codonX(S.t2, S.t2.rk) : MX0;
    } else if (S.t1.phase === "exported") resetAct1();
    S.act = n; ui.actSeg?.set(n); S.autoT = 0; closePicker();
    trayKey = "";
    flyView(viewFor(n));
  }
  function setTool(v) {
    S.tool = v; ui.toolSeg?.set(v); closePicker();
    if (v !== "off" && S.act !== 1) setAct(1);
    if (v !== "off") toast(lens.pick({ "y7-8": "Now click a DNA letter (a rung) in the nucleus.", "y9-10": `Click a base pair on the DNA to ${v === "sub" ? "substitute it" : v === "ins" ? "insert a base before it" : "delete it"}.` }));
  }
  function follow(rdt) {
    if (!S.follow || S.userCam || engine.flight || engine.busy) return;
    let fx = null;
    if (S.act === 1 && (S.t1.phase === "ready" || S.t1.phase === "elong")) fx = viewFor(1).target.x;
    else if (S.act === 2 && S.t2 && !["done", "stall", "nostart"].includes(S.t2.phase)) fx = viewFor(2).target.x;
    if (fx == null) return;
    const dx = (fx - engine.controls.target.x) * Math.min(1, rdt * 2.2);
    if (Math.abs(dx) < 1e-4) return;
    engine.controls.target.x += dx; engine.camera.position.x += dx;
  }
  const onCamStart = () => { if (!engine.flight) S.userCam = true; };
  engine.controls.addEventListener("start", onCamStart);

  // mutation base picker
  const picker = document.createElement("div");
  picker.id = "pspicker";
  let pickerFor = null;
  function openPicker(mode, gi, cx, cy) {
    const r = engine.stageEl.getBoundingClientRect();
    pickerFor = { mode, gi };
    picker.innerHTML = ["A", "T", "G", "C"].map((b) => `<button type="button" data-b="${b}" style="background:${M.BASE_COL[b]}" aria-label="${b}">${b}</button>`).join("") + `<button type="button" class="x" aria-label="Cancel">✕</button>`;
    picker.style.left = `${K.clamp(cx - r.left, 110, r.width - 110)}px`;
    picker.style.top = `${Math.max(70, cy - r.top)}px`;
    engine.stageEl.appendChild(picker);
    picker.querySelectorAll("[data-b]").forEach((b) => b.addEventListener("click", () => { const p = pickerFor; closePicker(); if (p) applyEdit(p.mode, p.gi, b.dataset.b); }));
    picker.querySelector(".x").addEventListener("click", closePicker);
  }
  function closePicker() { pickerFor = null; picker.remove(); }

  // ---------------------------------------------------------------- tray (tap alternative to dragging)
  const tray = document.createElement("div");
  tray.id = "pstray";
  tray.setAttribute("role", "toolbar");
  let trayKey = "";
  function updateTray() {
    let key = S.act + lens.band;
    const t2 = S.t2;
    const items2 = S.act === 2 && t2 ? G.pool2.items.filter((i) => !i.leaving && !i.fly) : [];
    const ph1 = S.act === 1 && (S.t1.phase === "ready" || S.t1.phase === "elong");
    const ph2 = S.act === 2 && t2 && ["needP", "needA", "stop"].includes(t2.phase);
    key += ph1 ? "a" : ph2 ? "b" + items2.map((i) => i.data.codon).join(",") : "none";
    if (key === trayKey) return;
    trayKey = key;
    tray.innerHTML = "";
    tray.style.display = ph1 || ph2 ? "flex" : "none";
    if (ph1) {
      tray.insertAdjacentHTML("beforeend", `<span>${lens.pick({ "y7-8": "Tap a letter:", "y9-10": "RNA nucleotides:" })}</span>`);
      for (const b of ["A", "U", "G", "C", "T"]) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.innerHTML = `<i style="background:${M.BASE_COL[b]}"></i>${b}`;
        btn.setAttribute("aria-label", `Add ${b} nucleotide`);
        btn.addEventListener("click", () => {
          let it = G.pool1.items.find((x) => x.data.b === b && !x.fly && !x.leaving);
          if (!it) { it = spawnNuc(b); G.refreshPick(); }
          tryPlace1(it, true);
        });
        tray.appendChild(btn);
      }
    } else if (ph2) {
      tray.insertAdjacentHTML("beforeend", `<span>${lens.pick({ "y7-8": "Carriers:", "y9-10": "tRNAs:" })}</span>`);
      for (const it of items2) {
        const btn = document.createElement("button");
        btn.type = "button";
        if (it.data.kind === "rf") btn.innerHTML = `<i style="background:#2dd4bf"></i>${lens.pick(NAMES.rf)}`;
        else btn.innerHTML = `<i style="background:${M.aaCol(it.data.aa)}"></i><code>${lens.atLeast("y11") ? `3′-${it.data.anti}-5′` : it.data.anti}</code> ${M.AA[it.data.aa][0]}`;
        btn.addEventListener("click", () => { if (G.pool2.items.includes(it) && !it.leaving) tryPlace2(it, true); });
        tray.appendChild(btn);
      }
    }
  }

  // ---------------------------------------------------------------- genetic code dialog (built on demand)
  let gcDialog = null;
  function currentCodon() {
    if (S.act === 2 && S.t2) return S.t2.phase === "needP" || S.t2.phase === "init" ? "AUG" : aCodon();
    const tr = curTr(), pl = S.t1.placed;
    if (tr.start < 0 || pl < tr.start) return null;
    const i = tr.start + 3 * Math.floor((pl - tr.start) / 3);
    const c = M.toRNA(geneStr().slice(i, i + 3));
    return c.length === 3 ? c : null;
  }
  function openCode() {
    if (!gcDialog) {
      gcDialog = document.createElement("dialog");
      gcDialog.className = "ps3-gc";
      let h = `<button class="btn gc-close" type="button">Close ✕</button><h2>The genetic code (mRNA codons)</h2><p>Find the 1st base on the left, the 2nd base along the top and the 3rd base on the right. 61 codons code for the 20 amino acids; <strong>AUG</strong> (Met) is the start codon and <strong>UAA, UAG, UGA</strong> are stop codons. The highlighted codon is the one being worked on.</p><div class="gct-wrap"><table><thead><tr><th rowspan="2">1st</th><th colspan="4">2nd base</th><th rowspan="2">3rd</th></tr><tr>`;
      for (const b of M.ORDER) h += `<th class="b">${b}</th>`;
      h += `</tr></thead><tbody>`;
      for (const b1 of M.ORDER) {
        h += `<tr><th class="b">${b1}</th>`;
        for (const b2 of M.ORDER) {
          h += "<td>";
          for (const b3 of M.ORDER) {
            const c = b1 + b2 + b3, a = M.CODE[c], info = M.AA[a];
            const name = a === "*" ? "Stop" : c === "AUG" ? "Met · START" : info[0];
            h += `<div class="cd" data-c="${c}" style="border-left-color:${M.CLASS_COL[info[2]]}" title="${info[1]}"><b>${c}</b><span>${name}</span></div>`;
          }
          h += "</td>";
        }
        h += `<th class="third">U<br>C<br>A<br>G</th></tr>`;
      }
      gcDialog.innerHTML = h + "</tbody></table></div>";
      document.body.appendChild(gcDialog);
      gcDialog.querySelector(".gc-close").addEventListener("click", () => gcDialog.close());
      gcDialog.addEventListener("click", (e) => { if (e.target === gcDialog) gcDialog.close(); });
    }
    const c = currentCodon();
    gcDialog.querySelectorAll(".cd").forEach((d) => d.classList.toggle("hl", d.dataset.c === c));
    if (gcDialog.showModal) gcDialog.showModal(); else gcDialog.setAttribute("open", "");
  }

  // ---------------------------------------------------------------- panel
  const ui = {};
  let built = null, exBody = null, missionsApi = null, exKey = "";
  function buildPanel() {
    const host = document.createElement("div");
    host.style.display = "contents";
    host.className = "ps3d";
    built = { band: lens.band, node: host };
    const el = host, y7 = lens.band === "y7-8", y11 = lens.atLeast("y11");
    const wrap = (c) => { c.classList.add("ps3d"); return c; };
    if (parentId === "dna") {
      const c = wrap(K.card(el, lens.pick({ "y7-8": "Reading the gene", "y9-10": "From the DNA you were exploring" })));
      c.insertAdjacentHTML("beforeend", `<p>${lens.pick({ "y7-8": "You dived into the gene's start signal. Now watch the cell read the gene and use it to build a protein.", "y9-10": "You entered at the gene's promoter. The same model gene is now transcribed into mRNA and translated into a polypeptide.", y11: "Entered at the promoter of the model gene. The DNA here is the same sequence; edits you make in the mutation lab apply only at this level." })}</p>`);
    }
    const ex = wrap(K.card(el, "What's happening", "explain"));
    exBody = document.createElement("div");
    ex.appendChild(exBody);
    ex.insertAdjacentHTML("beforeend", `<p class="seq-note"><strong>Model gene.</strong> ${lens.pick(NOTE)}</p>`);
    exKey = "";

    const c = wrap(K.card(el, "Controls"));
    ui.actSeg = K.segmented(c, [{ value: 1, label: y7 ? "1 · Copy the gene" : "1 · Transcription" }, { value: 2, label: y7 ? "2 · Build the protein" : "2 · Translation" }], S.act, (v) => setAct(v));
    const r1 = K.buttonRow(c);
    ui.autoBtn = K.button(r1, "▶ Auto (watch)", (on) => { S.auto = on; S.autoT = 0; if (on) toast("Auto mode: sit back and watch."); }, { toggle: true, pressed: S.auto });
    K.button(r1, "⏭ Auto-complete", () => (S.act === 1 ? autoComplete1() : autoComplete2()));
    K.button(r1, y7 ? "Code table" : "Genetic code table", openCode);
    const r2 = K.buttonRow(c);
    K.button(r2, "Reset act", () => { if (S.act === 1) resetAct1(); else setupAct2(S.t2 ? S.t2.gene : geneStr()); flyView(viewFor(S.act)); });
    K.button(r2, "Re-centre view", () => flyView(viewFor(S.act === 1 && ["export", "exported"].includes(S.t1.phase) ? "export" : S.act)));
    c.insertAdjacentHTML("beforeend", `<div class="speed-label">Speed</div>`);
    K.segmented(c, [0.5, 1, 2, 3].map((v) => ({ value: v, label: `${v}×` })), S.speed, (v) => (S.speed = v));
    K.checkbox(c, "Camera follows the action", S.follow, (v) => { S.follow = v; S.userCam = false; });
    K.checkbox(c, "Show labels", S.labels, (v) => (S.labels = v));

    const lab = wrap(K.card(el, y7 ? "Change the DNA" : "Mutation lab"));
    lab.insertAdjacentHTML("beforeend", `<p>${lens.pick({ "y7-8": "A <strong>mutation</strong> is a change in the DNA letters. Pick a tool, click a DNA rung in the nucleus, then press <strong>Run it</strong> to see what protein the cell makes.", "y9-10": "Pick a tool, then click a base pair on the DNA in the nucleus. Changing DNA restarts transcription. Then <strong>Run it</strong> to see what the ribosome makes.", y11: "Point mutations: pick a tool, then click a base pair on the DNA (Act 1). Changing DNA restarts transcription. Then <strong>Run it</strong> to see what the ribosome makes." })}</p>`);
    ui.toolSeg = K.segmented(lab, y7 ? [{ value: "off", label: "Off" }, { value: "sub", label: "Change a letter" }, { value: "ins", label: "Add" }, { value: "del", label: "Remove" }]
      : [{ value: "off", label: "Off" }, { value: "sub", label: "Substitute" }, { value: "ins", label: "Insert" }, { value: "del", label: "Delete" }], S.tool, (v) => setTool(v));
    const r3 = K.buttonRow(lab);
    K.button(r3, "Run it ▶", () => {
      setAct(1); resetAct1();
      S.auto = true; S.autoT = 0; ui.autoBtn.setAttribute("aria-pressed", "true");
      if (S.speed < 2) { S.speed = 2; }
      toast("Running: transcription then translation. Use Auto-complete to skip ahead.", 3200);
    }, { kind: "primary" });
    K.button(r3, "Restore original DNA", () => setGeneTo(M.ORIGINAL_GENE));
    if (y7) K.button(r3, "Sickle-cell change", () => { setGeneTo(M.SICKLE_GENE, [M.SICKLE_INDEX]); toast("Codon 6 changed from GAG to GTG — now press <strong>Run it</strong>."); });
    labOut = document.createElement("div");
    labOut.className = "lab-out";
    lab.appendChild(labOut);
    labKey = "";
    updateLab();

    const legend = wrap(K.card(el, "Key"));
    const items = [[M.BASE_COL.A, y7 ? "A" : "A adenine"], [M.BASE_COL.T, y7 ? "T (DNA only)" : "T thymine (DNA only)"], [M.BASE_COL.G, y7 ? "G" : "G guanine"], [M.BASE_COL.C, y7 ? "C" : "C cytosine"], [M.BASE_COL.U, y7 ? "U (RNA only)" : "U uracil (RNA only)"],
      [COL.phosphate, "Phosphate"], [COL.ribose, y7 ? "Sugar in RNA" : "Ribose (RNA)"], ["#ec6fae", lens.pick(NAMES.trna)], ["#7c96ee", lens.pick(NAMES.ribo)], ["#8b5cf6", lens.pick(NAMES.pol)]];
    if (!y7) items.push([M.CLASS_COL.np, "non-polar amino acid"], [M.CLASS_COL.pol, "polar amino acid"], [M.CLASS_COL.acid, "acidic (−) amino acid"], [M.CLASS_COL.base, "basic (+) amino acid"]);
    else items.push([M.CLASS_COL.np, "amino acids (beads, coloured by type)"]);
    legend.insertAdjacentHTML("beforeend", `<div class="legend">${items.map(([col, t]) => `<span><i style="background:${col}"></i>${t}</span>`).join("")}</div>`);

    ui.next = wrap(K.card(el, lens.pick({ "y7-8": "What happens next?", "y9-10": "Next: protein folding" })));
    ui.next.insertAdjacentHTML("beforeend", `<p>${lens.pick({ "y7-8": "A chain of building blocks isn't a working protein yet — it has to fold into the right shape.", "y9-10": "The polypeptide's amino acid sequence decides how it folds into a 3D shape. A mutation can change that shape.", y11: "The primary structure (sequence) determines folding into secondary, tertiary and quaternary structure. Your chain — mutant or not — is passed to the folding level." })}</p>`);
    K.button(K.buttonRow(ui.next), lens.pick({ "y7-8": "See how it folds ▸", "y9-10": "See how this protein folds ▸" }), () => { if (portals.length) engine.dive(foldPortal); }, { kind: "primary" });
    ui.next.style.display = portals.length ? "" : "none";

    const ms = lens.filter(MISSIONS);
    missionsApi = K.missions(el, ms.map((m) => ({ text: lens.pick(m.text), check: () => missionCheck(m.id) })), (m) => toast(`🎯 Mission complete: ${m.text}`, 3400));
    K.quiz(el, lens.filter(QUIZ));
  }
  function missionCheck(id) {
    const f = S.flags;
    return { transcribe: f.transcribed, translate: f.translated, noT: f.noT, change: f.changed, silent: f.silent, harmful: f.harmful, nonsense: f.nonsense, frameshift: f.frameshift, sickle: f.sickle }[id] || false;
  }

  // chips
  const chips = { act: K.chip(overlay), cod: K.chip(overlay), aa: K.chip(overlay), err: K.chip(overlay) };
  for (const ch of overlay.children) ch.classList.add("ps-chip");
  overlay.lastChild.classList.add("opt");
  function updateChips() {
    const y7 = lens.band === "y7-8";
    chips.act(S.act === 1 ? (y7 ? "<b>1 · Copying the gene</b>" : "Act <b>1 · Transcription</b>") : (y7 ? "<b>2 · Building the protein</b>" : "Act <b>2 · Translation</b>"));
    if (S.act === 1) {
      const Gn = S.gene.length, tr = curTr(), pl = S.t1.placed;
      const nC = tr.start >= 0 ? tr.codons.length : Math.ceil(Gn / 3);
      const c = tr.start >= 0 ? K.clamp(Math.floor((pl - tr.start) / 3) + 1, 1, nC) : Math.min(Math.floor(pl / 3) + 1, nC);
      chips.cod(pl >= Gn ? `mRNA <b>${Gn} nt</b> complete` : y7 ? `Letters <b>${pl}/${Gn}</b>` : `Codon <b>${c}/${nC}</b> · nt <b>${pl}/${Gn}</b>`);
    } else if (S.t2) {
      const t2 = S.t2, nC = t2.tr.codons.length;
      const pos = ["init", "needP", "join", "nostart"].includes(t2.phase) ? 1 : Math.min(t2.k + 2, nC);
      chips.cod(t2.start < 0 ? "No start codon" : y7 ? `Word <b>${pos}/${nC}</b>` : `A-site codon <b>${pos}/${nC}</b>`);
    }
    chips.aa(`${y7 ? "Building blocks joined" : "Amino acids joined"} <b>${S.t2 ? S.t2.chain.length : 0}</b>`);
    chips.err(`Errors <b>${S.errors}</b>`);
  }

  // ---------------------------------------------------------------- auto mode
  function autoStep(dt) {
    if (!S.auto || dt === 0) return;
    S.autoT += dt;
    if (S.act === 1) {
      const t1 = S.t1;
      if ((t1.phase === "ready" || t1.phase === "elong") && t1.placed < S.gene.length) {
        if (S.autoT > 0.26 && !G.pool1.items.some((i) => i.fly)) {
          S.autoT = 0;
          const need = neededBase();
          let best = G.pool1.items.find((i) => i.data.b === need && !i.leaving && G.pool1.drag?.it !== i);
          if (!best) { best = spawnNuc(need); G.refreshPick(); }
          G.pool1.flyTo(best, (o) => slotLocal(o), 0.3, arrive1);
        }
      } else if (t1.phase === "exported" && S.autoT > 1.2) setAct(2);
    } else if (S.t2) {
      const t2 = S.t2, key = needKey();
      if (key) {
        if (S.autoT > 0.8 && !G.pool2.items.some((i) => i.fly)) {
          const it = G.pool2.items.find((i) => itemKey(i) === key && !i.leaving && G.pool2.drag?.it !== i);
          if (it) { S.autoT = 0; tryPlace2(it, true); }
        }
      } else if (["done", "stall", "nostart"].includes(t2.phase) && S.autoT > 0.5) {
        S.auto = false; ui.autoBtn?.setAttribute("aria-pressed", "false");
      }
    }
  }

  // ---------------------------------------------------------------- portal to folding
  const portals = [];
  const foldPortal = { to: "folding", label: "Protein folding", object: G.glow, objects: [G.glow, G.beads], radius: 2.4, center: () => G.glow.position.clone() };

  // ---------------------------------------------------------------- level object
  resetAct1();
  updateLab();
  let uiT = 0, exT = 0;
  const level = {
    title: "DNA to protein",
    topics: ["protein-synthesis", "genes", "mutation", "dna-structure"],
    root: G.root,
    pickables: G.pickables,
    portals,
    shared,
    metersPerUnit: 6.7e-10,            // the DNA (2 nm wide) is drawn 3 units wide
    get view() { return viewFor(S.act === 1 && S.t1 && ["export", "exported"].includes(S.t1.phase) ? "export" : S.act); },
    minDistance: 3, maxDistance: 90, near: 0.05, far: 600,
    env: { bg: ["#100d2e", "#0a2a3a", "#3a1452"], fog: ["#0d1630", 0.008], exposure: 1.05, bloom: [0.5, 0.5, 0.82], aperture: 0.0011 },
    info(obj) {
      const k = obj.userData.kind, y7 = lens.band === "y7-8";
      if (obj === H.R.B) return { kind: "dna", title: S.tool !== "off" ? (y7 ? "Click to change this DNA letter" : "Click to mutate this base pair") : (y7 ? "DNA — the gene's letters" : "DNA base pair (gene)") };
      if (obj === G.mrna.B) return { kind: "mrna", title: lens.pick(NAMES.mrna) };
      if (k === "pol") return { kind: "pol", title: lens.pick(NAMES.pol) };
      if (k === "ribo") return { kind: "ribo", title: lens.pick(NAMES.ribo) + (y7 ? "" : " (rRNA + proteins)") };
      if (k === "pore") return { kind: "pore", title: y7 ? "Nuclear pore — the door out of the nucleus" : "Nuclear pore" };
      if ((k === "portal" || k === "chain") && portals.length) return { kind: "chain", title: lens.pick({ "y7-8": "Finished protein chain — dive in to see it fold", "y9-10": "Released polypeptide — dive in to see it fold" }), portal: foldPortal };
      if (k === "chain") return { kind: "chain", title: lens.pick(NAMES.chain) };
      const it = obj.userData.item;
      if (it) {
        if (it.data.kind === "rf") return { kind: "item", title: lens.pick(NAMES.rf) + " — drag into the A site" };
        if (it.data.kind === "trna") return { kind: "item", title: `${lens.pick(NAMES.trna)}: anticodon ${it.data.anti}, carries ${M.AA[it.data.aa][1]} — drag it to the ribosome` };
        return { kind: "item", title: it.data.b === "T" ? "Thymine (T) nucleotide — a DNA nucleotide" : `${lens.pick({ "y7-8": "Free RNA letter", "y9-10": "Free RNA nucleotide" })} ${it.data.b} — drag it to the glowing spot` };
      }
      return null;
    },
    onSelect(info) {
      if (info?.kind === "chain" && info.portal) toast(lens.pick({ "y7-8": "Double-click the glowing chain (or use the button in the panel) to see it fold.", "y9-10": "Double-click the glowing polypeptide, or press <strong>See how it folds</strong> in the panel." }));
    },
    onClick(e, hit) {
      // bases first: the polymerase's glass shell must not block clicks on the DNA inside it
      let m = null;
      if (S.act === 1) {
        const ray = engine.setRay(e.clientX, e.clientY).ray;
        const bh = engine.ray.intersectObject(H.R.B, false)[0];
        if (bh && bh.instanceId != null) m = H.R.meta[bh.instanceId];
        else {
          // forgiving: the base pair nearest to where the click ray passes the helix axis
          const inv = _M4.copy(G.dnaG.matrixWorld).invert();
          const o = _v.copy(ray.origin).applyMatrix4(inv), d = _w.copy(ray.direction).transformDirection(inv);
          const den = 1 - d.x * d.x;
          if (Math.abs(den) > 1e-4) {
            const x = (o.x - d.x * d.dot(o)) / den;
            const tRay = d.dot(_v2.set(x, 0, 0).sub(o));
            const p = o.addScaledVector(d, tRay);
            if (Math.hypot(p.y, p.z) < 2.6 && tRay > 0) { const i = Math.round((x - H.x0) / RISE); if (i >= 0 && i < H.n) m = { i, s: 0 }; }
          }
        }
      }
      if (!m && !hit) return false;
      const o = hit?.object;
      if (m || (o === H.R.B && hit.instanceId != null)) {
        m ||= H.R.meta[hit.instanceId];
        if (!m) return true;
        const gi = m.i - UPL;
        if (S.tool !== "off" && S.act === 1) {
          if (S.t1.phase === "export") return true;
          if (gi < 0 || gi >= S.gene.length) { toast(lens.pick({ "y7-8": "That's outside the gene — click a letter inside the gene.", "y9-10": "That's the promoter or terminator — mutate a base inside the transcribed gene." })); return true; }
          if (S.tool === "del") applyEdit("del", gi);
          else openPicker(S.tool, gi, e.clientX, e.clientY);
          return true;
        }
        const b = H.base(m.i, 0), tb = M.DNA_PAIR[b];
        const where = gi < 0 ? lens.pick({ "y7-8": "the gene's start signal", "y9-10": "promoter" }) : gi >= S.gene.length ? lens.pick({ "y7-8": "past the end of the gene", "y9-10": "terminator region" }) : lens.pick({ "y7-8": `letter ${gi + 1} of the gene`, "y9-10": `gene base ${gi + 1} (codon ${Math.floor(gi / 3) === 0 ? "start" : Math.floor(gi / 3)})` });
        toast(`${b}–${tb} · ${where}${lens.atLeast("y9-10") ? ` · mRNA base ${gi >= 0 && gi < S.gene.length ? M.toRNA(b) : "—"}` : ""}`);
        return true;
      }
      return false;
    },
    onPointerDown(e, hit) {
      if (pickerFor) closePicker();
      const it = hit?.object.userData.item;
      if (!it || it.fly || it.leaving) return false;
      const pool = G.pool1.items.includes(it) ? G.pool1 : G.pool2.items.includes(it) ? G.pool2 : null;
      if (!pool || (pool === G.pool1) !== (S.act === 1)) return false;
      pool.startDrag(it, e);
      return true;
    },
    onPointerDrag(e) { G.pool1.moveDrag(e); G.pool2.moveDrag(e); },
    onPointerUp() {
      const r1 = G.pool1.endDrag();
      if (r1) { if (r1.tapped || G.pool1.screenDist(r1.it, slotLocal(_v)) < 75) tryPlace1(r1.it, r1.tapped); return; }
      const r2 = G.pool2.endDrag();
      if (r2 && S.t2) {
        const site = S.t2.phase === "needP" ? "P" : "A";
        if (r2.tapped || G.pool2.screenDist(r2.it, siteLocal(site, _v)) < 95) tryPlace2(r2.it, r2.tapped);
      }
    },
    mountPanel(el) {
      if (!built || built.band !== lens.band) buildPanel();
      el.appendChild(built.node);
      engine.overlay.appendChild(overlay);
      engine.labelLayer.appendChild(labelLayer);
      engine.stageEl.appendChild(tray);
      trayKey = "";
    },
    unmountPanel() { overlay.remove(); labelLayer.remove(); tray.remove(); closePicker(); G.pool1.drag = G.pool2.drag = null; },
    onResume() { engine.labelLayer.appendChild(labelLayer); },
    onLens() {
      const host = built?.node.parentElement;
      built?.node.remove();
      buildPanel();
      host?.appendChild(built.node);
      trayKey = "";
    },
    dispose() {
      engine.controls.removeEventListener("start", onCamStart);
      overlay.remove(); labelLayer.remove(); tray.remove(); closePicker(); gcDialog?.remove();
      G.pool1.clear(); G.pool2.clear();
    },
    update(dt, t, realDt) {
      const rdt = realDt ?? dt;
      const d = dt * S.speed;
      if (S.act === 1) update1(d);
      else if (S.t2) update2(d);
      autoStep(d);
      G.pool1.update(d, t, reduced);
      G.pool2.update(d, t, reduced);
      for (const it of G.pool1.items) it.obj.rotation.set(0.3, it.ph + (reduced ? 0 : t * 0.5), 0.2);
      for (const it of G.pool2.items) it.obj.rotation.set(0, Math.sin(it.ph + t * 0.6) * (reduced ? 0 : 0.25), Math.sin(it.ph * 2 + t * 0.4) * (reduced ? 0 : 0.08));
      const processing = lens.atLeast("y11");
      const mN = G.updateAct1(S, S.act === 1 ? geneStr() : S.t1.gene, t, { processing });
      const a2 = S.act === 2 && S.t2;
      G.mrna.group.visible = true;
      if (a2) G.updateAct2(S, t, d, { processing });
      else { G.small.visible = G.large.visible = false; G.beads.count = 0; G.links.count = 0; G.glow.visible = G.glowSprite.visible = false; }
      // portal only while a released chain is visible
      const free = a2 && G.glow.visible;
      if (free && !portals.length) portals.push(foldPortal);
      else if (!free && portals.length) portals.length = 0;
      if (ui.next) ui.next.style.display = portals.length ? "" : "none";
      follow(rdt);
      if (S.flyChain > 0 && (S.flyChain -= rdt) <= 0 && a2 && G.glow.visible && S.follow) {
        const c = G.glow.position, cam = engine.camera, tn = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
        const d = K.clamp(Math.max(7 / (tn * cam.aspect), 9 / tn), 14, 60);
        const tg = new THREE.Vector3(c.x, c.y - 3, 0);
        engine.fly(tg, tg.clone().add(new THREE.Vector3(0, 0.15, 1).normalize().multiplyScalar(d)), 1.2);
      }
      G.labels(S, { band: lens.band, labels: S.labels, pick: (v) => lens.pick(v), names: NAMES, mrnaN: a2 ? S.t2.gene.length : mN, processing });
      updateTray();
      if ((uiT -= rdt) <= 0) { uiT = 0.25; updateChips(); }
      if ((exT -= rdt) <= 0) {
        exT = 0.3;
        const [k, html] = explain(S, lens.band, { aCodon });
        const key = lens.band + S.act + k;
        if (key !== exKey && exBody) { exKey = key; exBody.innerHTML = html; }
      }
      missionsApi?.update();
    },
  };
  return level;
}
