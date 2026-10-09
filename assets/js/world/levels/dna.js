// The DNA double helix as a CellScape molecular level (chromatin → dna → expression).
// An explorable B-DNA model of the shared model gene (β-globin fragment from sims/protein-synthesis/model.js)
// with flanking DNA: level of detail by camera distance (ribbon → nucleotides → atoms), click-to-inspect base
// pairs, highlight toggles, a twist slider (Years 7–8 "twisted ladder"), and DNA replication — drag helicase to
// unzip, then pair free nucleotides onto the leading-strand template while Okazaki fragments form on the other.
// The glowing ring on the promoter is the portal into gene expression ("expression").
import * as THREE from "three";
import * as K from "../../kit.js";
import { DNA_PAIR, BASE_COL } from "../../../../sims/protein-synthesis/model.js";
import { glass, physical, specks, softDot } from "../materials.js";
import { Helix, AtomModel, Floaters, nucleotideMesh, RISE, HBONDS, PURINE, COL } from "./dnaHelix.js";
import { SEQ, PROM0, GENE0, CODE_END, TERM0, FLANK_R0, DEFAULT_ATOMS_BP, region, baseName, NOTE, PARTS, MISSIONS, QUIZ, narrative } from "./dnaContent.js";

const CSS = `
.lbl3d.dnab { font: 700 0.72rem Inter, system-ui, sans-serif; color: #06121f; padding: 0 4px; border-radius: 4px; opacity: 0.9; }
.lbl3d.dnaend { font: 700 0.8rem "Space Grotesk", Inter, sans-serif; color: #e0f2fe; text-shadow: 0 1px 6px #000, 0 0 10px #38bdf8; }
.lbl3d.dnareg { color: rgba(232,241,255,0.78); font-size: 0.72rem; letter-spacing: 0.06em; font-weight: 600; text-shadow: 0 1px 8px #000; }
.lbl3d.dnaenz { background: rgba(5,11,22,0.7); border: 1px solid rgba(94,234,212,0.45); padding: 2px 8px; border-radius: 999px; color: #ccfbf1; font-size: 0.7rem; }
.lbl3d.dnaatom { background: rgba(5,11,22,0.78); border: 1px solid rgba(147,197,253,0.4); padding: 2px 8px; border-radius: 8px; font-size: 0.7rem; text-align: center; line-height: 1.25; }
.lbl3d.dnaatom small { display: block; color: var(--ink-faint); font-size: 0.64rem; }
.lbl3d.dnanuc { font: 700 0.78rem Inter, system-ui, sans-serif; color: #fff; text-shadow: 0 1px 4px #000, 0 0 6px #000; }
.dna-sel .hbq { display: flex; gap: 6px; margin-top: 6px; }
.dna-sel .hbq .btn { flex: 1; padding: 6px 0; }
.dna-sel .pair { font: 600 1.05rem "Space Grotesk", Inter, sans-serif; margin: 2px 0 6px; }
.dna-bars { display: grid; grid-template-columns: auto 1fr auto; gap: 4px 8px; align-items: center; font-size: 0.8rem; margin: 4px 0 8px; }
.dna-bars i { display: block; height: 8px; border-radius: 4px; }
.dna-bars b { font-variant-numeric: tabular-nums; }
#dnatray { position: absolute; left: 50%; bottom: 40px; transform: translateX(-50%); display: none; gap: 6px; padding: 6px; border-radius: 14px; z-index: 3;
  background: rgba(5,11,22,0.75); border: 1px solid var(--panel-border); backdrop-filter: blur(8px); }
#dnatray button { border: 1px solid transparent; background: transparent; color: var(--ink); padding: 6px 12px; border-radius: 10px; cursor: pointer; font-weight: 700; display: flex; gap: 6px; align-items: center; }
#dnatray button i { width: 12px; height: 12px; border-radius: 3px; }
#dnatray button:hover { border-color: var(--accent); }
#dnatray span { color: var(--ink-faint); font-size: 0.74rem; align-self: center; padding: 0 4px; }
`;

const LAG = 8;   // Okazaki fragment length in this model (real ones are ~100–200 nt in eukaryotes)

export function create(engine) {
  if (!document.getElementById("dna-css")) {
    const st = document.createElement("style");
    st.id = "dna-css"; st.textContent = CSS;
    document.head.appendChild(st);
  }
  const lens = engine.lens;
  const toast = (m, ms) => engine.toast?.(m, ms);
  const reduced = engine.reducedMotion;
  const parentId = engine.stack.at(-1)?.id || null;

  // ---------- scene ----------
  const root = new THREE.Group();
  const world = new THREE.Group();
  root.add(world);
  const N = SEQ.length;
  const helix = new Helix(N);
  helix.setSeq(SEQ);
  world.add(helix.group);
  const R = helix.R;
  const atoms = new AtomModel();
  world.add(atoms.group);
  atoms.group.visible = false;

  const bgSpecks = specks(220, 0.22, [70, 40, 50], ["#93c5fd", "#a78bfa", "#5eead4", "#f9a8d4"], 0.45);
  bgSpecks.position.z = -12;
  root.add(bgSpecks);

  // gene regions: faint sheaths along the axis
  const sheath = (i0, i1, color, op) => {
    const len = (i1 - i0) * RISE;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, len, 40, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.rotation.z = Math.PI / 2;
    m.position.x = helix.bpX(i0) + len / 2 - RISE / 2;
    world.add(m);
    m.userData.op = op; sheaths.push(m);
    return m;
  };
  const sheaths = [];
  const promSheath = sheath(PROM0, GENE0, "#fbbf24", 0.07);
  sheath(GENE0, CODE_END, "#5eead4", 0.035);
  sheath(TERM0, FLANK_R0, "#94a3b8", 0.04);

  // portal: glowing ring around the promoter
  const PORTAL = new THREE.Vector3(helix.bpX((PROM0 + GENE0) / 2), 0, 0);
  const portalRing = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.07, 12, 64), physical("#5eead4", { emissive: new THREE.Color("#2dd4bf"), emissiveIntensity: 1.3 }));
  portalRing.rotation.y = Math.PI / 2;
  portalRing.position.copy(PORTAL);
  world.add(portalRing);
  promSheath.userData.kind = portalRing.userData.kind = "portal";

  // helicase (replication) — a glassy ring that clamps round the fork
  const helicase = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.42, 18, 40), glass("#5eead4", { rim: "#99f6e4", rimStrength: 0.9, minAlpha: 0.22, maxAlpha: 0.85 }));
  helicase.rotation.y = Math.PI / 2;
  helicase.userData.kind = "helicase";
  world.add(helicase);
  const polLead = new THREE.Mesh(new THREE.SphereGeometry(0.95, 24, 18), glass("#a78bfa", { rim: "#c4b5fd", minAlpha: 0.12, maxAlpha: 0.7 }));
  const polLag = polLead.clone();
  polLead.userData.kind = polLag.userData.kind = "polymerase";
  world.add(polLead, polLag);
  const ligase = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 14), glass("#fbbf24", { rim: "#fde68a", minAlpha: 0.2, maxAlpha: 0.9 }));
  ligase.visible = false;
  world.add(ligase);

  // slot marker: where the next nucleotide goes
  const slotMat = new THREE.SpriteMaterial({ map: softDot(), color: "#fbbf24", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const slot = new THREE.Sprite(slotMat);
  slot.scale.setScalar(1.1);
  world.add(slot);

  // selection ring
  const selRing = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.05, 10, 48), new THREE.MeshBasicMaterial({ color: "#fde68a", transparent: true, opacity: 0.9, depthWrite: false }));
  selRing.rotation.y = Math.PI / 2;
  selRing.visible = false;
  world.add(selRing);

  // 5′ end markers (clickable for the antiparallel mission)
  const endMat = new THREE.MeshBasicMaterial({ color: "#7dd3fc" });
  const end5 = [0, 1].map((s) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), endMat); m.userData.kind = "end5"; m.userData.strand = s; world.add(m); return m; });

  // free nucleotides (dNTPs) for replication
  const pool = new Floaters(engine, world);
  pool.size.set(2.6, 0.6, 0.9);
  pool.minGap = 0.95;

  const pickables = [R.B, R.P, R.S, portalRing, promSheath, helicase, ...end5];
  const fallbackPickables = [];
  const refreshPick = () => { pickables.length = 7; pickables.push(...pool.meshes([])); };

  // ---------- labels ----------
  const labelLayer = document.createElement("div");
  labelLayer.style.display = "contents";
  const mk = (cls, html = "") => { const d = document.createElement("div"); d.className = `lbl3d ${cls}`; d.innerHTML = html; labelLayer.appendChild(d); return d; };
  const endLbl = [mk("dnaend", "5′"), mk("dnaend", "3′"), mk("dnaend", "3′"), mk("dnaend", "5′")];
  const regLbl = { prom: mk("dnareg"), gene: mk("dnareg"), term: mk("dnareg") };
  const diveLbl = mk("dive");
  const enzLbl = { hel: mk("dnaenz"), lead: mk("dnaenz"), lag: mk("dnaenz"), lig: mk("dnaenz") };
  const atomLbl = [mk("dnaatom"), mk("dnaatom")];
  const baseLbls = Array.from({ length: 28 }, () => mk("dnab"));
  const nucLbls = [];

  // ---------- state ----------
  const st = {
    twistT: 1, highlight: "all", arrows: false, labels: true,
    sel: -1, atomBP: DEFAULT_ATOMS_BP, lod: "far", fork: 0, forkT: 0, lead: 0, added: 0,
    lag: { k: 0, pos: -1, t: 0 }, sealed: 0, frags: 0, sealQ: [], ligT: 0,
    flags: { selected: false, backboneHL: false, gc: false, at: false, end0: false, end1: false, atoms: false, chargaff: false },
  };
  const y11 = () => lens.atLeast("y11");
  function resetReplication() {
    st.fork = st.forkT = 0; st.lead = 0; st.added = 0; st.lag = { k: 0, pos: -1, t: 0 }; st.sealed = 0; st.frags = 0; st.sealQ = [];
    helix.open.fill(0); helix.off0.fill(0); helix.off1.fill(0);
    helix.nb[0].fill(""); helix.nb[1].fill(""); helix.nick[0].fill(0); helix.nick[1].fill(0);
    for (let k = 0; k * LAG + LAG - 1 < N - 1; k++) helix.nick[0][k * LAG + LAG - 1] = 1;
    pool.clear(); refreshPick();
    helix.dirty = true;
  }
  resetReplication();

  // ---------- replication logic ----------
  const leadNeed = () => (st.lead < N ? SEQ[st.lead] : null);   // partner of the template (strand 1) base = coding base
  function applyFork() {
    for (let i = 0; i < N; i++) {
      const o = smooth01((st.fork - i) / 3);
      if (o !== helix.open[i]) { helix.open[i] = o; helix.off0[i] = 1.6 * o; helix.off1[i] = -1.6 * o; helix.dirty = true; }
    }
  }
  function unzipBy(n) {
    st.forkT = Math.min(N + 3, Math.max(st.forkT, st.fork) + n);
    if (y11() && st.lead === 0) { /* primase lays the leading primer once there is room */ }
  }
  function placeLead(b, fromItem) {
    const need = leadNeed();
    if (!need) { toast("The leading strand is complete."); return false; }
    if (helix.open[st.lead] < 0.85) { toast(lens.pick({ "y7-8": "Unzip a bit further first — drag the unzipper ring →", "y9-10": "Unzip further first: drag the helicase ring along the DNA." })); return false; }
    const tb = DNA_PAIR[SEQ[st.lead]];
    if (b !== need) {
      toast(lens.pick({ "y7-8": `✗ ${b} doesn't fit with ${tb}. Remember: A pairs with T, G pairs with C.`, "y9-10": `✗ ${baseName(b)} (${b}) can't pair with template ${tb}. ${tb} pairs with <strong>${need}</strong>.`, y11: `✗ ${b} is not complementary to template ${tb} — it can't form the right hydrogen bonds. ${tb} pairs with <strong>${need}</strong>${PURINE[tb] ? " (a pyrimidine)" : " (a purine)"}.` }), 3200);
      return false;
    }
    helix.nb[1][st.lead] = need;
    helix.nbCol[1][st.lead] = COL.newSugar; helix.nbLink[1][st.lead] = COL.newLink;
    st.lead++; st.added++;
    helix.dirty = true;
    if (st.lead >= 10 && y11()) for (let i = 0; i < 2; i++) if (helix.nbCol[1][i] === COL.primer) { helix.nbCol[1][i] = COL.newSugar; helix.nbLink[1][i] = COL.newLink; }
    void fromItem;
    return true;
  }
  function stepReplication(dt) {
    if (Math.abs(st.forkT - st.fork) > 0.001) {
      st.fork += Math.sign(st.forkT - st.fork) * Math.min(Math.abs(st.forkT - st.fork), dt * 9);
      applyFork();
    }
    // primase: the leading strand starts from a 2-nt RNA primer (Years 11–12)
    if (y11() && st.lead === 0 && helix.open[1] > 0.85) {
      for (let i = 0; i < 2; i++) { helix.nb[1][i] = SEQ[i]; helix.nbCol[1][i] = COL.primer; helix.nbLink[1][i] = COL.primer; }
      st.lead = 2; helix.dirty = true;
    }
    // lagging strand: Okazaki fragments, built 5′→3′ away from the fork (right → left)
    const L = st.lag;
    if (L.pos < 0) {
      const top = L.k * LAG + LAG - 1;
      if (top < N && helix.open[top] > 0.9) { L.pos = top; L.t = 0; st.frags = L.k + 1; }
      else if (top >= N && L.k * LAG < N && helix.open[N - 1] > 0.9) { L.pos = N - 1; L.t = 0; st.frags = L.k + 1; }
    }
    if (L.pos >= 0 && dt > 0) {
      L.t += dt;
      while (L.t > 0.09 && L.pos >= L.k * LAG) {
        L.t -= 0.09;
        const i = L.pos, primer = y11() && i >= Math.min(N - 1, L.k * LAG + LAG - 1) - 1;
        helix.nb[0][i] = DNA_PAIR[SEQ[i]];
        helix.nbCol[0][i] = primer ? COL.primer : COL.newSugar;
        helix.nbLink[0][i] = primer ? COL.primer : COL.newLink;
        L.pos--; helix.dirty = true;
      }
      if (L.pos < L.k * LAG) {
        if (L.k > 0) st.sealQ.push({ k: L.k, t: 0.7 });
        L.k++; L.pos = -1;
      }
    }
    for (const q of st.sealQ) q.t -= dt;
    while (st.sealQ.length && st.sealQ[0].t <= 0) {
      const { k } = st.sealQ.shift();
      const prev = (k - 1) * LAG;
      for (let i = prev; i < prev + LAG && i < N; i++) if (helix.nb[0][i]) { helix.nbCol[0][i] = COL.newSugar; helix.nbLink[0][i] = COL.newLink; }
      helix.nick[0][k * LAG - 1] = 0;
      st.sealed++; st.ligT = 1.2; st.ligAt = k * LAG - 0.5;
      helix.dirty = true;
      if (st.sealed === 1) toast(lens.pick({ "y7-8": "Two pieces of the new strand were joined together.", "y9-10": "DNA ligase joined two fragments of the new strand.", y11: "DNA polymerase replaced the RNA primer with DNA, then <strong>DNA ligase</strong> sealed the nick between two Okazaki fragments." }), 3600);
    }
  }
  // free nucleotide pool near the leading-strand slot
  const POOLB = ["A", "T", "G", "C", "A", "T", "G", "C"];
  function maintainPool() {
    if (st.fork < 1 || st.lead >= N) { if (pool.items.length) { for (const it of pool.items) it.leaving = true; } return; }
    const need = leadNeed();
    const active = pool.items.filter((i) => !i.leaving);
    if (need && !active.some((i) => i.data.b === need && !i.fly)) addNuc(need);
    if (active.length < 7) addNuc(POOLB[(active.length * 3 + st.lead) % 8]);
  }
  function addNuc(b) {
    const m = nucleotideMesh(b, { sugar: COL.sugar, phosphates: 3 });
    const it = pool.add(m, { b });
    it.lbl = mk("dnanuc", b);
    refreshPick();
    return it;
  }
  function slotLocal(out) { return helix.partnerPos(Math.min(st.lead, N - 1), 1, out); }
  function tryItem(it, tapped) {
    const ok = leadNeed() === it.data.b && helix.open[st.lead] >= 0.85;
    if (!ok) { placeLead(it.data.b); pool.reject(it); return; }
    pool.flyTo(it, (o) => slotLocal(o), tapped ? 0.35 : 0.12, (x) => {
      if (placeLead(x.data.b)) { x.lbl?.remove(); pool.remove(x); refreshPick(); }
      else pool.reject(x);
    });
  }

  // ---------- tray ----------
  const tray = document.createElement("div");
  tray.id = "dnatray";
  tray.setAttribute("role", "toolbar");
  function buildTray() {
    tray.innerHTML = `<span>${lens.pick({ "y7-8": "Add:", "y9-10": "Nucleotides:", y11: "dNTPs:" })}</span>`;
    for (const b of ["A", "T", "G", "C"]) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.innerHTML = `<i style="background:${BASE_COL[b]}"></i>${y11() ? `d${b}TP` : b}`;
      btn.setAttribute("aria-label", `Add ${baseName(b)} nucleotide to the new strand`);
      btn.addEventListener("click", () => { const it = pool.items.find((x) => x.data.b === b && !x.fly && !x.leaving); if (it) tryItem(it, true); else placeLead(b); });
      tray.appendChild(btn);
    }
  }

  // ---------- panel ----------
  let built = null, exBody, selCard, missionsApi, twistS, hlSeg, chargCard;
  let lastEx = "";
  function buildPanel() {
    const host = document.createElement("div");
    host.style.display = "contents";
    built = { band: lens.band, node: host };
    const el = host;
    if (parentId && parentId !== "dna") {
      const c = K.card(el, lens.pick({ "y7-8": "Inside a chromosome", "y9-10": "Zoomed into the DNA" }));
      c.insertAdjacentHTML("beforeend", `<p>${lens.pick({ "y7-8": "You've zoomed into one tiny stretch of a chromosome. Unwound, this is what DNA looks like.", "y9-10": "A short stretch of the DNA molecule, unwound from its histone proteins. One gene sits in the middle.", y11: "A ~25 nm stretch of a chromatid's DNA, unwound from nucleosomes, containing the model gene." })}</p>`);
    }
    const ex = K.card(el, "What's happening", "explain");
    exBody = document.createElement("div");
    ex.appendChild(exBody);
    ex.insertAdjacentHTML("beforeend", `<p class="hint"><strong>Model gene.</strong> ${lens.pick(NOTE)}</p>`);
    lastEx = "";

    selCard = K.card(el, "Selected", "sel-card dna-sel");
    selCard.style.display = "none";

    const vc = K.card(el, lens.pick({ "y7-8": "Look closer", "y9-10": "View" }));
    twistS = K.slider(vc, { label: lens.pick({ "y7-8": "Twist (ladder ↔ helix)", "y9-10": "Twist" }), min: 0, max: 100, step: 5, value: Math.round(st.twistT * 100), unit: " %", onInput: (v) => { st.twistT = v / 100; } });
    const hlWrap = document.createElement("div");
    hlWrap.className = "control";
    hlWrap.innerHTML = `<div class="control-row"><label>${lens.pick({ "y7-8": "Light up", "y9-10": "Highlight" })}</label></div>`;
    vc.appendChild(hlWrap);
    hlSeg = K.segmented(hlWrap, [
      { value: "all", label: "All" },
      { value: "backbone", label: lens.pick({ "y7-8": "Sides", "y9-10": "Backbone" }) },
      { value: "bases", label: lens.pick({ "y7-8": "Rungs", "y9-10": "Bases" }) },
      { value: "hbonds", label: "H-bonds" },
    ], st.highlight, (v) => setHighlight(v));
    if (lens.atLeast("y9-10")) K.checkbox(vc, "Show strand directions (5′→3′ arrows)", st.arrows, (v) => { st.arrows = v; helix.setArrows(v); });
    K.checkbox(vc, "Show labels", st.labels, (v) => (st.labels = v));
    const vr = K.buttonRow(vc);
    K.button(vr, lens.pick({ "y7-8": "Zoom into the atoms", "y9-10": "Zoom to atoms" }), () => zoomToBP(st.sel >= 0 ? st.sel : st.atomBP, 2.6));
    K.button(vr, "Whole molecule", () => { const v = level.view; engine.fly(v.target, v.target.clone().addScaledVector(v.dir.clone().normalize(), v.distance)); });

    const rc = K.card(el, lens.pick({ "y7-8": "Copy the DNA", "y9-10": "DNA replication", y11: "DNA replication" }));
    rc.insertAdjacentHTML("beforeend", `<p>${lens.pick({
      "y7-8": "Before a cell divides it copies its DNA. Drag the glowing <strong>unzipper</strong> ring to the right (or press Unzip), then drag the matching letter onto the glowing spot.",
      "y9-10": "Drag the <strong>helicase</strong> ring along the DNA (or press Unzip) to separate the strands. Then drag the free nucleotide that pairs with the glowing template base — or tap it in the tray.",
      y11: "Drag <strong>helicase</strong> along the helix to open the replication fork. Extend the <strong>leading strand</strong> by pairing dNTPs onto the lower template; the lagging strand is made automatically in Okazaki fragments.",
    })}</p>`);
    const rr = K.buttonRow(rc);
    K.button(rr, lens.pick({ "y7-8": "Unzip ▸", "y9-10": "Unzip 8 bp ▸" }), () => unzipBy(8), { kind: "primary" });
    if (y11()) K.button(rr, "Auto-extend leading strand", () => { let k = 0; while (k < 60 && st.lead < N && helix.open[st.lead] >= 0.85 && placeLead(leadNeed())) k++; if (!k) toast("Unzip further first."); });
    K.button(rr, lens.pick({ "y7-8": "Zip back up", "y9-10": "Reset" }), () => { resetReplication(); toast("DNA zipped back up"); });

    chargCard = K.card(el, lens.pick({ "y7-8": "Count the letters", "y9-10": "Base composition (Chargaff's rule)" }));
    renderChargaff();

    const key = K.card(el, "Key");
    const items = [[BASE_COL.A, lens.pick({ "y7-8": "A", "y9-10": "A adenine", y11: "A adenine (purine)" })], [BASE_COL.T, lens.pick({ "y7-8": "T", "y9-10": "T thymine", y11: "T thymine (pyrimidine)" })],
      [BASE_COL.G, lens.pick({ "y7-8": "G", "y9-10": "G guanine", y11: "G guanine (purine)" })], [BASE_COL.C, lens.pick({ "y7-8": "C", "y9-10": "C cytosine", y11: "C cytosine (pyrimidine)" })],
      [COL.phosphate, "Phosphate"], [COL.sugar, lens.pick({ "y7-8": "Sugar", "y9-10": "Deoxyribose sugar" })], [COL.newSugar, lens.pick({ "y7-8": "New copy", "y9-10": "New strand (replication)" })], ["#e0f2fe", "Hydrogen bonds"]];
    if (y11()) items.push([COL.primer, "RNA primer"]);
    key.insertAdjacentHTML("beforeend", `<div class="legend">${items.map(([c, t]) => `<span><i style="background:${c}"></i>${t}</span>`).join("")}</div>`);

    const nx = K.card(el, lens.pick({ "y7-8": "What does a gene do?", "y9-10": "Next: gene expression" }));
    nx.insertAdjacentHTML("beforeend", `<p>${lens.pick({ "y7-8": "This gene is a recipe for part of a protein. Dive into the glowing ring (the gene's start signal) to watch the cell read it.", "y9-10": "The glowing ring marks the gene's <strong>promoter</strong>. Dive in to watch transcription and translation turn this gene into a protein.", y11: "Dive into the promoter (glowing ring) to see this gene transcribed by RNA polymerase and translated at a ribosome — and to mutate it." })}</p>`);
    K.button(K.buttonRow(nx), lens.pick({ "y7-8": "Watch it make a protein ▸", "y9-10": "Dive into the promoter ▸" }), () => engine.dive(portals[0]), { kind: "primary" });

    const ms = lens.filter(MISSIONS);
    missionsApi = K.missions(el, ms.map((m) => ({ text: lens.pick(m.text), check: () => missionCheck(m.id) })), (m) => toast(`🎯 Mission complete: ${m.text}`, 3400));
    K.quiz(el, lens.filter(QUIZ));
    buildTray();
    if (st.sel >= 0) showSel(st.sel);
  }
  function missionCheck(id) {
    const f = st.flags;
    switch (id) {
      case "select": return f.selected;
      case "ladder": return helix.twist < 0.05;
      case "backbone": return f.backboneHL;
      case "gc": return f.gc;
      case "at": return f.at;
      case "anti": return f.end0 && f.end1;
      case "atoms": return f.atoms;
      case "chargaff": return f.chargaff;
      case "unzip": return st.added >= (y11() ? 8 : 6);
      case "okazaki": return st.sealed >= 1;
    }
    return false;
  }

  function setHighlight(v) {
    st.highlight = v;
    if (v === "backbone") st.flags.backboneHL = true;
    hlSeg?.set(v);
    const dimB = v === "backbone" || v === "hbonds", dimBack = v === "bases" || v === "hbonds";
    R.setOpacity("B", dimB ? 0.15 : 1);
    for (const p of ["P", "S", "L"]) R.setOpacity(p, dimBack ? 0.15 : 1);
    for (const p of ["P", "S", "L"]) R.setGlow(p, "#38bdf8", v === "backbone" ? 0.45 : 0);
    R.setGlow("B", "#ffffff", v === "bases" ? 0.25 : 0);
    R.H.material.size = v === "hbonds" ? 0.2 : 0.13;
    helix.dirty = true;
  }

  // Chargaff card
  let chQ = null;
  function renderChargaff() {
    if (!chargCard) return;
    const cnt = { A: 0, T: 0, G: 0, C: 0 }, one = { A: 0, T: 0, G: 0, C: 0 };
    for (const b of SEQ) { cnt[b]++; cnt[DNA_PAIR[b]]++; one[b]++; }
    const tot = 2 * N;
    const bars = (c, t) => `<div class="dna-bars">${["A", "T", "G", "C"].map((b) => `<span>${b}</span><i style="width:${(c[b] / t) * 100 * 2.2}%;background:${BASE_COL[b]}"></i><b>${((c[b] / t) * 100).toFixed(1)}%</b>`).join("")}</div>`;
    let h = `<h2>${lens.pick({ "y7-8": "Count the letters", "y9-10": "Base composition (Chargaff's rule)" })}</h2>`;
    h += `<p>${lens.pick({ "y7-8": `This piece of DNA has ${tot} letters (both sides). Every A has a T partner and every G has a C partner, so there are always as many A as T, and as many G as C.`, "y9-10": `Both strands, ${N} bp (${tot} bases). Because A pairs only with T and G only with C, <strong>%A = %T</strong> and <strong>%G = %C</strong> in double-stranded DNA.` })}</p>`;
    h += bars(cnt, tot);
    if (y11()) h += `<p class="hint">One strand alone (coding strand, ${N} nt) — Chargaff's rule doesn't apply to a single strand:</p>${bars(one, N)}`;
    if (lens.atLeast("y9-10")) {
      if (!chQ) { const a = [15, 20, 22, 26, 28, 30, 32, 35][Math.floor(Math.random() * 8)]; chQ = { a, g: (100 - 2 * a) / 2 }; }
      const opts = [chQ.g, chQ.a, 100 - chQ.a, 100 - 2 * chQ.a].filter((v, i, arr) => arr.indexOf(v) === i).sort((x, y) => x - y);
      h += `<p><strong>Predict:</strong> another DNA sample is <strong>${chQ.a}% A</strong>. What % is G?</p><div class="btn-row">${opts.map((v) => `<button class="btn" type="button" data-g="${v}">${v}%</button>`).join("")}</div><p class="hint" data-fb></p>`;
    }
    chargCard.innerHTML = h;
    chargCard.querySelectorAll("[data-g]").forEach((b) => b.addEventListener("click", () => {
      const fb = chargCard.querySelector("[data-fb]");
      if (+b.dataset.g === chQ.g) { b.classList.add("right"); st.flags.chargaff = true; fb.innerHTML = `✅ A = T = ${chQ.a}%, so G + C = ${100 - 2 * chQ.a}%, split equally: G = ${chQ.g}%.`; }
      else { b.classList.add("wrong"); fb.innerHTML = `❌ Hint: %A = %T, and %G = %C. All four add to 100%.`; }
    }));
  }

  // selection
  function showSel(i) {
    if (!selCard) return;
    st.sel = i;
    if (i < 0) { selCard.style.display = "none"; selRing.visible = false; return; }
    const b0 = SEQ[i], b1 = DNA_PAIR[b0], nh = HBONDS(b0, b1);
    const bond = nh === 3 ? "≡" : "=";
    const reg = region(i);
    const asked = st.asked?.[i];
    const yr = lens.band;
    const pur = (b) => (PURINE[b] ? "purine — double ring" : "pyrimidine — single ring");
    let h = `<h2>Selected</h2><div class="pair"><span style="color:${BASE_COL[b0]}">${b0}</span> ${yr === "y7-8" ? "–" : bond} <span style="color:${BASE_COL[b1]}">${b1}</span></div>`;
    h += `<div class="io"><b>Top strand</b><span>${baseName(b0)}${y11() ? ` (${pur(b0)})` : ""}</span><b>Bottom strand</b><span>${baseName(b1)}${y11() ? ` (${pur(b1)})` : ""}</span><b>Where</b><span>${lens.pick(reg.text)}</span></div>`;
    if (yr === "y7-8") h += `<p>${b0 === "A" || b0 === "T" ? "A always pairs with T" : "G always pairs with C"}. The two bases are held together by ${nh} weak bonds (glowing dashes), so the ladder can be unzipped.</p>`;
    else if (!asked) h += `<p>How many hydrogen bonds hold this pair together? <span class="hint">(zoom in and count the glowing dashes)</span></p><div class="hbq">${[1, 2, 3, 4].map((n) => `<button class="btn" type="button" data-n="${n}">${n}</button>`).join("")}</div>`;
    else h += `<p>${nh} hydrogen bonds: ${nh === 3 ? "G≡C pairs have three, so G–C-rich DNA is a little harder to separate." : "A=T pairs have two."}${y11() ? " A purine always pairs with a pyrimidine, so every rung is the same width." : ""}</p>`;
    h += `<div class="btn-row"><button class="btn" type="button" data-z>Zoom to atoms</button></div>`;
    selCard.innerHTML = h;
    selCard.style.display = "";
    selCard.querySelectorAll("[data-n]").forEach((btn) => btn.addEventListener("click", () => {
      if (+btn.dataset.n === nh) {
        (st.asked ||= {})[i] = true;
        if (nh === 3) st.flags.gc = true; else st.flags.at = true;
        toast(`✅ ${nh} hydrogen bonds — ${nh === 3 ? "G≡C" : "A=T"}.`);
        showSel(i);
      } else { btn.classList.add("wrong"); toast("Not quite — zoom in on the pair and count the glowing dashes between the bases."); }
    }));
    selCard.querySelector("[data-z]").addEventListener("click", () => zoomToBP(i, 2.6));
  }
  const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3();
  function zoomToBP(i, d) {
    helix.build();
    const c = world.localToWorld(helix.mid(i, _v).clone());
    const dir = engine.camera.position.clone().sub(engine.controls.target).normalize();
    if (Math.abs(dir.x) > 0.8) dir.set(0.25, 0.3, 1).normalize();
    engine.fly(c, c.clone().addScaledVector(dir, d), 1.0);
  }

  // ---------- portal ----------
  const portals = [{ to: "expression", label: "DNA to protein", object: portalRing, objects: [portalRing, promSheath], radius: 1.8, center: () => world.localToWorld(PORTAL.clone()) }];

  // ---------- per-frame visuals ----------
  let near = false, showAtoms = false;
  function updateLOD() {
    const cam = engine.camera.position, d = cam.distanceTo(engine.controls.target);
    near = near ? d < 17 : d < 15;
    helix.setDetail(near);
    R.H.visible = near || st.highlight === "hbonds";
    for (const m of sheaths) m.material.opacity = m.userData.op * (near ? 0.35 : 1);
    st.lod = near ? "near" : "far";
    // atoms: the closed base pair nearest the camera target
    const tl = world.worldToLocal(_u.copy(engine.controls.target));
    let i = st.sel >= 0 && helix.open[st.sel] < 0.05 ? st.sel : Math.round((tl.x - helix.x0) / RISE);
    i = Math.max(0, Math.min(N - 1, i));
    const mid = world.localToWorld(helix.mid(i, _v));
    const dc = cam.distanceTo(mid);
    const want = helix.open[i] < 0.05 && (showAtoms ? dc < 6.2 : dc < 5.2);
    if (want !== showAtoms || (want && i !== st.atomBP)) {
      showAtoms = want; st.atomBP = i;
      helix.dirty = true;
      if (want) st.flags.atoms = true;
    }
    if (showAtoms) st.lod = "atoms";
  }
  // the atom view is a camera-facing "callout" lifted out of the helix (base planes are edge-on from the side)
  const callout = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: "#fde68a", dashSize: 0.08, gapSize: 0.06, transparent: true, opacity: 0.8 }));
  world.add(callout);
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3(), _ex = new THREE.Vector3(), _ey = new THREE.Vector3();
  function placeAtoms() {
    atoms.group.visible = callout.visible = showAtoms;
    if (!showAtoms) return;
    const i = st.atomBP;
    helix.sugarPos(i, 0, _a); helix.sugarPos(i, 1, _b);
    const mid = _c.addVectors(_a, _b).multiplyScalar(0.5);
    world.worldToLocal(_n.copy(engine.camera.position)).sub(mid);
    const dist = _n.length(); _n.normalize();
    _ex.subVectors(_b, _a); _ex.addScaledVector(_n, -_ex.dot(_n));
    if (_ex.lengthSq() < 1e-4) _ex.set(1, 0, 0);
    _ex.normalize();
    _ey.crossVectors(_n, _ex);
    const lift = Math.min(2.2, dist * 0.4), L = Math.min(1.4, dist * 0.18);
    const C = _v.copy(mid).addScaledVector(_n, lift);
    atoms.set(SEQ[i], _w.copy(C).addScaledVector(_ex, -L / 2), _u.copy(C).addScaledVector(_ex, L / 2), _ey, _n);
    const pos = callout.geometry.attributes.position;
    pos.setXYZ(0, mid.x, mid.y, mid.z); pos.setXYZ(1, C.x, C.y, C.z); pos.needsUpdate = true;
    callout.computeLineDistances();
  }

  const _p = new THREE.Vector3();
  function placeW(el, local, dx = 0, dy = 0) { return engine.place(el, world.localToWorld(_p.copy(local)), dx, dy); }
  function updateLabels(t) {
    const show = st.labels, band = lens.band;
    // strand ends
    const ends = [[0, 0, -0.55], [N - 1, 0, 0.55], [0, 1, -0.55], [N - 1, 1, 0.55]];
    ends.forEach(([i, s, dx], k) => { helix.sugarPos(i, s, _v); _v.x += dx; if (show && lens.atLeast("y9-10")) placeW(endLbl[k], _v); else endLbl[k].style.display = "none"; });
    // end markers sit at the 5′ ends (strand 0 at the left, strand 1 at the right)
    helix.sugarPos(0, 0, end5[0].position); end5[0].position.x -= 0.35;
    helix.sugarPos(N - 1, 1, end5[1].position); end5[1].position.x += 0.35;
    end5[0].visible = end5[1].visible = lens.atLeast("y9-10");
    // regions
    const regs = { prom: [PROM0, GENE0, { "y7-8": "Start signal", "y9-10": "Promoter" }], gene: [GENE0, TERM0, { "y7-8": "Gene (part of the haemoglobin gene)", "y9-10": "Model gene (β-globin)" }], term: [TERM0, FLANK_R0, { "y7-8": "Stop signal", "y9-10": "Terminator" }] };
    for (const [k, [a, b, txt]] of Object.entries(regs)) {
      const el = regLbl[k];
      if (!show || st.lod === "atoms") { el.style.display = "none"; continue; }
      el.textContent = lens.pick(txt);
      placeW(el, _v.set(helix.bpX((a + b - 1) / 2), 2.2, 0));
    }
    diveLbl.textContent = lens.pick({ "y7-8": "🔍 Dive in: watch the gene make a protein", "y9-10": "🔍 Dive into the promoter: gene expression" });
    if (st.lod !== "atoms") placeW(diveLbl, _v.set(PORTAL.x, -2.4, 0)); else diveLbl.style.display = "none";
    // enzymes
    const repl = st.fork > 0.3;
    const names = lens.pick({ "y7-8": { hel: "Unzipper (helicase) — drag me →", lead: "Copier", lag: "Copier", lig: "Joiner" }, "y9-10": { hel: "Helicase — drag along the DNA →", lead: "DNA polymerase", lag: "DNA polymerase", lig: "DNA ligase" }, y11: { hel: "Helicase", lead: "DNA polymerase III (leading)", lag: "DNA polymerase (lagging)", lig: "DNA ligase" } });
    if (show && st.lod !== "atoms") placeW(enzLbl.hel, _v.copy(helicase.position).setY(2.3)); else enzLbl.hel.style.display = "none";
    enzLbl.hel.textContent = repl && band === "y11" ? names.hel : names.hel;
    for (const [k, m] of [["lead", polLead], ["lag", polLag], ["lig", ligase]]) {
      if (show && m.visible && st.lod !== "atoms") { enzLbl[k].textContent = names[k]; placeW(enzLbl[k], _v.copy(m.position), 0, k === "lead" ? 26 : -26); }
      else enzLbl[k].style.display = "none";
    }
    // base letters near the camera
    let n = 0;
    if (show && near && st.lod !== "atoms") {
      const cam = engine.camera.position;
      for (let i = 0; i < N && n < baseLbls.length; i++) {
        helix.mid(i, _v);
        world.localToWorld(_w.copy(_v));
        if (_w.distanceTo(cam) > 11) continue;
        for (let s = 0; s < 2 && n < baseLbls.length; s++) {
          helix.sugarPos(i, s, _v).addScaledVector(helix.baseDir(i, s, _w), 0.45);
          const b = helix.base(i, s), el = baseLbls[n++];
          if (el.textContent !== b) { el.textContent = b; el.style.background = BASE_COL[b]; }
          placeW(el, _v);
        }
      }
    }
    for (let k = n; k < baseLbls.length; k++) baseLbls[k].style.display = "none";
    // atom labels
    if (showAtoms && atoms.info && show) {
      const inf = atoms.info, nm = (b) => baseName(b)[0].toUpperCase() + baseName(b).slice(1);
      const purTxt = lens.pick({ "y7-8": nm(inf.pur), "y9-10": `${nm(inf.pur)} (${inf.pur})`, y11: `${nm(inf.pur)}<small>purine · 2 rings</small>` });
      const pyrTxt = lens.pick({ "y7-8": nm(inf.pyr), "y9-10": `${nm(inf.pyr)} (${inf.pyr})`, y11: `${nm(inf.pyr)}<small>pyrimidine · 1 ring</small>` });
      atomLbl[0].innerHTML = purTxt; atomLbl[1].innerHTML = pyrTxt;
      engine.place(atomLbl[0], world.localToWorld(atoms.local(_v.copy(inf.purC).setY(0.68), _w)));
      engine.place(atomLbl[1], world.localToWorld(atoms.local(_v.copy(inf.pyrC).setY(0.68), _w)));
    } else atomLbl.forEach((e) => (e.style.display = "none"));
    // free nucleotide letters
    for (const it of pool.items) if (it.lbl) { if (show) placeW(it.lbl, _v.copy(it.pos).add(_w.set(0.2, 0.45, 0))); else it.lbl.style.display = "none"; }
    void t; void nucLbls;
  }

  function updateEnzymes(dt, t) {
    const fx = helix.bpX(Math.max(0, st.fork - 1.5));
    helicase.position.set(st.fork < 0.3 ? helix.bpX(0) - 2.2 : fx, 0, 0);
    if (!reduced) helicase.rotation.x = t * 1.5;
    const repl = st.fork > 0.3;
    polLead.visible = repl && st.lead < N && st.lead > 0;
    if (polLead.visible) { helix.partnerPos(Math.max(0, st.lead - 1), 1, polLead.position); polLead.position.y -= 0.2; }
    polLag.visible = repl && st.lag.pos >= 0;
    if (polLag.visible) { helix.partnerPos(Math.max(0, st.lag.pos), 0, polLag.position); }
    if (st.ligT > 0) {
      st.ligT -= dt;
      ligase.visible = true;
      const i = Math.max(0, Math.min(N - 1, Math.round(st.ligAt)));
      helix.partnerPos(i, 0, ligase.position);
      ligase.scale.setScalar(Math.min(1, st.ligT * 2));
    } else ligase.visible = false;
    // slot glow
    slot.visible = repl && st.lead < N && helix.open[st.lead] > 0.85;
    if (slot.visible) { slotLocal(slot.position); slotMat.opacity = 0.55 + 0.35 * Math.sin(t * 5); }
    // pool follows the slot
    if (repl) { slotLocal(_v); pool.center.set(_v.x + 1.6, _v.y - 3.0, 1.4); }
    portalRing.material.emissiveIntensity = 1.0 + 0.45 * Math.sin(t * 2.4);
    if (!reduced) portalRing.rotation.x = t * 0.3;
    // selection ring
    const ringBP = showAtoms ? st.atomBP : st.sel;
    if (ringBP >= 0) { selRing.visible = true; helix.mid(ringBP, selRing.position); selRing.material.opacity = 0.6 + 0.3 * Math.sin(t * 4); }
    else selRing.visible = false;
  }

  // ---------- helicase drag (along the axis) ----------
  let dragHel = false;
  const _inv = new THREE.Matrix4();
  function axisXAt(e) {
    const ray = engine.setRay(e.clientX, e.clientY).ray;
    _inv.copy(world.matrixWorld).invert();
    const o = _v.copy(ray.origin).applyMatrix4(_inv), d = _w.copy(ray.direction).transformDirection(_inv);
    const den = 1 - d.x * d.x;
    if (Math.abs(den) < 1e-4) return null;
    return (o.x - d.x * d.dot(o)) / den;
  }

  // ---------- level object ----------
  let uiT = 0, exT = 0;
  const level = {
    title: "DNA double helix",
    topics: ["dna-structure", "genes", "cell-cycle"],
    root, pickables, fallbackPickables, portals,
    shared: { gene: SEQ.slice(GENE0, TERM0) },
    metersPerUnit: 1e-9,                 // 1 unit = 1 nm: the helix is 2 nm wide
    get view() {
      const cam = engine.camera, a = cam.aspect, tn = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      const halfW = a < 0.8 ? 4.6 : 10;
      const d = Math.min(60, Math.max(9, halfW / (tn * a)));
      return { target: new THREE.Vector3(a < 0.8 ? helix.bpX(GENE0 - 2) : helix.bpX(GENE0 + 4), 0, 0), distance: d, dir: new THREE.Vector3(0.12, 0.32, 1) };
    },
    minDistance: 1.4, maxDistance: 70, near: 0.02, far: 400,
    env: { bg: ["#06142c", "#0a2a3d", "#241552"], fog: ["#071a2c", 0.012], exposure: 1.05, bloom: [0.55, 0.5, 0.8], aperture: 0.0012 },
    info(obj) {
      const k = obj.userData.kind;
      if (obj === R.B) return { kind: "base", title: lens.pick({ "y7-8": "Base pair (a rung) — click to look closer", "y9-10": "Base pair — click to inspect" }) };
      if (obj === R.P) return { kind: "phosphate", title: lens.pick(PARTS.phosphate) };
      if (obj === R.S) return { kind: "sugar", title: lens.pick(PARTS.sugar) };
      if (k === "portal") return { kind: "portal", title: lens.pick({ "y7-8": "The gene's start signal — dive in to watch it make a protein", "y9-10": "Promoter — dive in to watch this gene expressed" }), portal: portals[0] };
      if (k === "helicase") return { kind: "helicase", title: lens.pick({ "y7-8": "Unzipper — drag it along the DNA", "y9-10": "Helicase — drag it along the DNA to unzip" }) };
      if (k === "end5") return { kind: "end5", title: lens.pick({ "y9-10": `5′ end of the ${obj.userData.strand ? "bottom" : "top"} strand — click` }) };
      if (k === "polymerase") return { kind: "pol", title: "DNA polymerase" };
      const it = obj.userData.item;
      if (it) return { kind: "nuc", title: lens.pick({ "y7-8": `Free ${baseName(it.data.b)} (${it.data.b}) — drag it onto the glowing spot`, "y9-10": `Free nucleotide: ${baseName(it.data.b)} — drag to the template`, y11: `d${it.data.b}TP (deoxynucleoside triphosphate) — drag to the template` }) };
      return null;
    },
    onSelect(info) {
      if (!info || !selCard) return;
      if (info.kind === "portal") {
        selCard.style.display = "";
        selCard.innerHTML = `<h2>Selected</h2><p><strong>${lens.pick({ "y7-8": "The gene's start signal", "y9-10": "Promoter" })}</strong></p><p>${lens.pick({ "y7-8": "A special stretch of DNA that tells the cell 'start reading the gene here'.", "y9-10": "RNA polymerase binds to the promoter to begin transcribing the gene. It includes a TATA box (T-A-T-A-A-A).", y11: "Promoter with a TATA box (simplified position). General transcription factors bind here and recruit RNA polymerase II." })}</p><div class="btn-row"><button class="btn primary" type="button" data-d>Dive in ▸</button></div>`;
        selCard.querySelector("[data-d]").addEventListener("click", () => engine.dive(portals[0]));
      } else if (info.kind === "phosphate" || info.kind === "sugar") {
        selCard.style.display = "";
        selCard.innerHTML = `<h2>Selected</h2><p><strong>${lens.pick(PARTS[info.kind])}</strong></p><p>${lens.pick({ "y7-8": "Sugars and phosphates link up to make the two sides of the DNA ladder.", "y9-10": "Alternating deoxyribose sugars and phosphates form each strand's backbone; the bases point inwards.", y11: "The sugar–phosphate backbone is joined by strong covalent phosphodiester bonds (3′ carbon → phosphate → 5′ carbon), giving each strand a 5′→3′ direction." })}</p>`;
      }
    },
    onClick(e, hit) {
      if (!hit) return false;
      const o = hit.object;
      if (o === R.B && hit.instanceId != null) {
        const m = R.meta[hit.instanceId];
        if (m) { st.flags.selected = true; showSel(m.i); }
        return true;
      }
      if (o.userData.kind === "end5") {
        const s = o.userData.strand;
        st.flags[s ? "end1" : "end0"] = true;
        toast(st.flags.end0 && st.flags.end1 ? "✅ Both 5′ ends found — at <strong>opposite</strong> ends. The strands are <strong>antiparallel</strong>." : `5′ end of the ${s ? "bottom" : "top"} strand: it runs 5′→3′ ${s ? "right → left" : "left → right"}. Now find the other 5′ end.`, 3600);
        return true;
      }
      return false;
    },
    onPointerDown(e, hit) {
      const o = hit?.object;
      if (o === helicase) { dragHel = true; engine.canvas.style.cursor = "grabbing"; return true; }
      const it = o?.userData.item;
      if (it && !it.fly && !it.leaving) { pool.startDrag(it, e); return true; }
      return false;
    },
    onPointerDrag(e) {
      if (dragHel) {
        const x = axisXAt(e);
        if (x != null) { const f = (x - helix.x0) / RISE + 1.5; if (f > st.forkT) st.forkT = Math.min(N + 3, f); }
        return;
      }
      pool.moveDrag(e);
    },
    onPointerUp() {
      if (dragHel) { dragHel = false; engine.canvas.style.cursor = "grab"; return; }
      const r = pool.endDrag();
      if (!r) return;
      if (r.tapped || pool.screenDist(r.it, slotLocal(_u)) < 70) tryItem(r.it, r.tapped);
    },
    mountPanel(el) {
      if (!built || built.band !== lens.band) buildPanel();
      el.appendChild(built.node);
      engine.labelLayer.appendChild(labelLayer);
      engine.stageEl.appendChild(tray);
      setHighlight(st.highlight);
    },
    unmountPanel() { labelLayer.remove(); tray.remove(); pool.drag = null; dragHel = false; },
    onResume() { engine.labelLayer.appendChild(labelLayer); },
    onLens() {
      const host = built?.node.parentElement;
      built?.node.remove();
      chQ = null;
      buildPanel();
      host?.appendChild(built.node);
      helix.dirty = true;
    },
    dispose() { labelLayer.remove(); tray.remove(); pool.clear(); },
    update(dt, t, realDt) {
      const rdt = realDt ?? dt;
      // twist animation (UI, so real time)
      const tw = helix.twist, tgt = st.twistT;
      if (Math.abs(tw - tgt) > 0.001) { helix.twist = tw + (tgt - tw) * Math.min(1, rdt * 4); if (Math.abs(helix.twist - tgt) < 0.002) helix.twist = tgt; helix.dirty = true; }
      stepReplication(dt);
      maintainPool();
      pool.update(dt, t, reduced);
      for (const it of pool.items) { it.obj.rotation.set(0.3, it.ph + t * 0.4 * (reduced ? 0 : 1), 0.2); }
      for (const it of [...pool.items]) if (!it.obj.parent) it.lbl?.remove();
      updateLOD();
      helix.build();
      placeAtoms();
      updateEnzymes(rdt, t);
      updateLabels(t);
      tray.style.display = st.fork > 0.5 && st.lead < N ? "flex" : "none";
      if (!reduced) bgSpecks.rotation.y = t * 0.01;
      if ((uiT -= rdt) <= 0) { uiT = 0.3; refreshPick(); }
      if ((exT -= rdt) <= 0) {
        exT = 0.4;
        const atomPair = atoms.info ? `${atoms.info.pur}–${atoms.info.pyr}` : "";
        const selTxt = st.sel >= 0 ? `Selected: ${SEQ[st.sel]}–${DNA_PAIR[SEQ[st.sel]]} · ${lens.pick(region(st.sel).text)}` : "";
        const html = narrative({ twist: helix.twist, lod: st.lod, fork: st.fork, n: N, lead: st.added, frags: st.frags, sealed: st.sealed, atomPair, atomHB: atoms.info?.nHB || 0, sel: selTxt }, lens.band);
        if (html !== lastEx && exBody) { exBody.innerHTML = html; lastEx = html; }
      }
      missionsApi?.update();
    },
  };
  return level;
}

function smooth01(x) { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); }
