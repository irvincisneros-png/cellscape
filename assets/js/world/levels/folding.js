// Molecular level: protein folding (entered from the "DNA to protein" level).
// The polypeptide made upstream (possibly mutant) is the N-terminus of the haemoglobin β chain; a coarse-grained
// folding simulation (foldingModel.js) shows primary → secondary → tertiary → quaternary structure, denaturation
// by heat / pH, a chaperone, and what each kind of mutation does to the protein — down to sickle-cell fibres.
// Units: 1 world unit = 3.8 Å (one Cα–Cα step), so the α₂β₂ tetramer is ≈ 14.5 units (5.5 nm) across.
import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import * as K from "../../kit.js";
import { physical, glass, softDot, hash, wobble } from "../materials.js";
import * as FM from "./foldingModel.js";
import * as FC from "./foldingContent.js";

const CSS = `
.lbl3d.fd-tag { background: rgba(5,11,22,0.72); border: 1px solid rgba(120,190,255,0.25); padding: 1px 7px; border-radius: 999px; font-size: 0.7rem; color: var(--ink); white-space: nowrap; }
.lbl3d.fd-res { font-size: 0.66rem; font-weight: 700; color: #fff; text-shadow: 0 1px 4px #000, 0 0 8px #000; pointer-events: none; }
.lbl3d.fd-res.mut { color: #fde047; }
.lbl3d.fd-helix { font-size: 0.78rem; font-weight: 700; color: #e0f2fe; text-shadow: 0 1px 6px #000, 0 0 10px #000; }
.lbl3d.fd-mut { background: rgba(5,11,22,0.85); border: 1px solid #fbbf24; color: #fde68a; padding: 2px 8px; border-radius: 10px; font-size: 0.72rem; white-space: nowrap; }
.fd-hint { position: absolute; left: 50%; bottom: 86px; transform: translateX(-50%); z-index: 3; max-width: calc(100% - 32px); text-align: center;
  background: rgba(5,11,22,0.82); border: 1px solid var(--panel-border); border-radius: 12px; padding: 7px 12px; font-size: 0.8rem; color: var(--ink); pointer-events: none; transition: opacity 0.6s; }
.fd-seq { display: flex; flex-wrap: wrap; gap: 3px; margin: 6px 0 4px; align-items: center; }
.fd-seq span { font-size: 0.7rem; font-weight: 700; padding: 2px 4px; border-radius: 6px; color: #06121f; }
.fd-seq span.mut { outline: 2px solid #fde047; outline-offset: 1px; }
.fd-seq em { font-style: normal; font-size: 0.72rem; color: var(--ink-faint); margin-left: 4px; }
.fd-kind { font-weight: 700; margin: 6px 0 2px; }
.fd-try { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 8px; }
.fd-try .btn { padding: 6px 4px; font-size: 0.78rem; }
.fd-try .btn[aria-pressed="true"] { border-color: var(--accent); color: var(--ink); background: rgba(79,209,197,0.14); }
.fd-steps .segmented button { padding: 6px 2px; font-size: 0.78rem; }
.fd-meter { min-width: 150px; }
.fd-meter .bar { height: 7px; border-radius: 4px; background: rgba(255,255,255,0.1); margin-top: 4px; overflow: hidden; }
.fd-meter .bar i { display: block; height: 100%; border-radius: 4px; transition: width 0.3s; }
.chip.fd-rbc { position: absolute; right: 0; top: 48px; padding: 6px 8px 4px; text-align: center; border-radius: 14px; }
.stage .chip.fd-rbc canvas { position: static; inset: auto; width: 128px; height: 84px; display: block; }
.chip.fd-rbc small { display: block; font-size: 0.68rem; color: var(--ink-dim); max-width: 128px; }
.explain .now { border-top: 1px solid var(--panel-border); padding-top: 8px; margin-top: 8px; font-size: 0.86rem; }
@media (max-width: 600px) { .fd-opt { display: none !important; } .fd-hint { bottom: 92px; font-size: 0.74rem; } .stage .chip.fd-rbc canvas { width: 96px; height: 63px; } .chip.fd-rbc { top: 84px; } .fd-meter { min-width: 118px; } }
`;

const UNIT = 3.8e-10;
const MAXN = FM.MAXN;
const SUBT = 4;                         // spline samples per residue
const MAXPTS = (MAXN - 1) * SUBT + 1;
const RAD = 6;                          // tube sides
const HELIX_COL = ["#f87171", "#fb923c", "#facc15", "#a3e635", "#34d399", "#22d3ee", "#818cf8", "#e879f9"];
const SUB_COL = { b2: "#0ea5e9", a1: "#ec4899", a2: "#d946ef", b1: "#3b82f6" };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const _s = new THREE.Vector3(), _c = new THREE.Color(), _c2 = new THREE.Color(), _e = new THREE.Euler();
const Y = new THREE.Vector3(0, 1, 0);
const propCol = (a) => FM.PROP_COL[FM.propOf(a)];

/** read the polypeptide (and gene, if any) made by the parent "DNA to protein" level */
function readIncoming(parentInst) {
  const sh = parentInst?.shared;
  if (!sh) return null;
  let frag = null, gene = null;
  try { frag = FM.normalisePolypeptide(sh.polypeptide); } catch { frag = null; }
  for (const k of ["gene", "codingStrand", "coding", "mutantGene", "dna"]) if (typeof sh[k] === "string" && /^[ACGT]{9,}$/i.test(sh[k])) { gene = sh[k].toUpperCase(); break; }
  if (frag == null) return null;
  return { frag, gene };
}

export function create(engine) {
  if (!document.getElementById("fold-css")) {
    const st = document.createElement("style");
    st.id = "fold-css"; st.textContent = CSS;
    document.head.appendChild(st);
  }
  const lens = engine.lens;
  const pick = (v) => lens.pick(v);
  const y7 = () => lens.band === "y7-8";
  const senior = () => lens.atLeast("y11");
  const reduced = engine.reducedMotion;
  const toast = (m, ms) => engine.toast?.(m, ms);
  const root = new THREE.Group();
  const overlay = document.createElement("div"); overlay.style.display = "contents";
  const labelLayer = document.createElement("div"); labelLayer.style.display = "contents";
  const hintEl = document.createElement("div"); hintEl.className = "fd-hint";
  let level;  // the returned object (declared early for readIncoming on mount)

  // ---------- incoming polypeptide ----------
  let incoming = readIncoming(engine.stack.at(-1)?.inst);
  const S = { step: "primary", kind: "none", frag: FM.FRAG, gene: null, seq: FM.HBB, sc: null, T: 37, pH: 7.4, pO2: 100, chap: false,
    view: "both", bonds: true, coreOnly: false, example: false, speed: 1, source: "default", note: "" };
  let sim = null;

  // ---------- scene ----------
  const env = new THREE.Group();
  root.add(env);
  {
    const n = 220, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const pal = ["#5eead4", "#a78bfa", "#93c5fd", "#f9a8d4"].map((c) => new THREE.Color(c));
    for (let i = 0; i < n; i++) {
      const r = 30 + hash(i * 3.3) * 90, th = hash(i * 5.1) * Math.PI * 2, ph = Math.acos(2 * hash(i * 7.7) - 1);
      pos[3 * i] = r * Math.sin(ph) * Math.cos(th); pos[3 * i + 1] = r * Math.cos(ph) * 0.7; pos[3 * i + 2] = r * Math.sin(ph) * Math.sin(th);
      const c = pal[i % pal.length]; col[3 * i] = c.r; col[3 * i + 1] = c.g; col[3 * i + 2] = c.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    env.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.1, map: softDot(), vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending })));
    // water molecules near the protein (tiny), to make "hydrophobic = avoids water" visible
    const wg = new THREE.SphereGeometry(0.11, 8, 6);
    const water = new THREE.InstancedMesh(wg, physical("#bae6fd", { roughness: 0.2, transparent: true, opacity: 0.55 }), 140);
    for (let i = 0; i < 140; i++) {
      const r = 9 + hash(i * 1.7) * 16, th = hash(i * 2.9) * Math.PI * 2, ph = Math.acos(2 * hash(i * 4.3) - 1);
      _m.makeTranslation(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th));
      water.setMatrixAt(i, _m);
    }
    env.add(water);
    env.userData.water = water;
  }

  // live chain group (β1 subunit) and its quaternary copies
  const chainG = new THREE.Group();
  root.add(chainG);
  const beadGeo = new THREE.SphereGeometry(0.42, 18, 12);
  const beadMat = physical("#ffffff", { roughness: 0.34, clearcoat: 0.7 });
  const beads = new THREE.InstancedMesh(beadGeo, beadMat, MAXN);
  beads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  beads.setColorAt(0, new THREE.Color());
  beads.frustumCulled = false;
  beads.userData.kind = "bead";
  chainG.add(beads);

  // backbone tube (dynamic)
  const tubeGeo = new THREE.BufferGeometry();
  const tubePos = new Float32Array(MAXPTS * RAD * 3), tubeNrm = new Float32Array(MAXPTS * RAD * 3);
  tubeGeo.setAttribute("position", new THREE.BufferAttribute(tubePos, 3).setUsage(THREE.DynamicDrawUsage));
  tubeGeo.setAttribute("normal", new THREE.BufferAttribute(tubeNrm, 3).setUsage(THREE.DynamicDrawUsage));
  {
    const idx = [];
    for (let k = 0; k < MAXPTS - 1; k++) for (let r = 0; r < RAD; r++) {
      const a = k * RAD + r, b = k * RAD + ((r + 1) % RAD), c = a + RAD, d = b + RAD;
      idx.push(a, c, b, b, c, d);
    }
    tubeGeo.setIndex(idx);
  }
  const tubeMat = physical("#cbd5e1", { roughness: 0.4, clearcoat: 0.5 });
  const tube = new THREE.Mesh(tubeGeo, tubeMat);
  tube.frustumCulled = false;
  chainG.add(tube);
  const SP = new Float32Array(MAXPTS * 3);            // spline sample points
  const TN = new Float32Array(MAXPTS * 3);            // tangents
  const NR = new Float32Array(MAXPTS * 3);            // transported normals

  // helix ribbons (dynamic; index rebuilt when the sequence changes)
  const ribGeo = new THREE.BufferGeometry();
  const RMAX = MAXPTS;
  const ribPos = new Float32Array(RMAX * 8 * 3), ribNrm = new Float32Array(RMAX * 8 * 3), ribCol = new Float32Array(RMAX * 8 * 3);
  ribGeo.setAttribute("position", new THREE.BufferAttribute(ribPos, 3).setUsage(THREE.DynamicDrawUsage));
  ribGeo.setAttribute("normal", new THREE.BufferAttribute(ribNrm, 3).setUsage(THREE.DynamicDrawUsage));
  ribGeo.setAttribute("color", new THREE.BufferAttribute(ribCol, 3));
  const ribbonMat = (color, vc = false) => new THREE.MeshStandardMaterial({ color, vertexColors: vc, roughness: 0.42, metalness: 0.05, side: THREE.DoubleSide, emissive: new THREE.Color(vc ? "#000000" : color), emissiveIntensity: vc ? 0 : 0.12 });
  const ribMatRainbow = ribbonMat("#ffffff", true);
  const ribMatSub = ribbonMat(SUB_COL.b1);
  const ribbon = new THREE.Mesh(ribGeo, ribMatRainbow);
  ribbon.frustumCulled = false;
  chainG.add(ribbon);
  let ribSamples = [];   // [{ k (spline index), i (residue), t }]
  let ribRuns = [];      // [{ a, b, h }]

  // H-bonds (dashed) and ionic bonds
  const hbGeo = new THREE.BufferGeometry();
  const hbPos = new Float32Array(MAXN * 2 * 3), hbDist = new Float32Array(MAXN * 2);
  hbGeo.setAttribute("position", new THREE.BufferAttribute(hbPos, 3).setUsage(THREE.DynamicDrawUsage));
  hbGeo.setAttribute("lineDistance", new THREE.BufferAttribute(hbDist, 1).setUsage(THREE.DynamicDrawUsage));
  const hbonds = new THREE.LineSegments(hbGeo, new THREE.LineDashedMaterial({ color: "#e0f2fe", dashSize: 0.13, gapSize: 0.11, transparent: true, opacity: 0.9, depthWrite: false }));
  hbonds.frustumCulled = false;
  chainG.add(hbonds);
  const ionGeo = new THREE.BufferGeometry();
  const ionPos = new Float32Array(80 * 2 * 3);
  ionGeo.setAttribute("position", new THREE.BufferAttribute(ionPos, 3).setUsage(THREE.DynamicDrawUsage));
  const ionic = new THREE.LineSegments(ionGeo, new THREE.LineBasicMaterial({ color: "#fde047", transparent: true, opacity: 0.95, depthWrite: false }));
  ionic.frustumCulled = false;
  chainG.add(ionic);
  let ionCount = 0, hbCount = 0;

  // haem group (disc + iron + O₂)
  const haemDiscGeo = new THREE.CylinderGeometry(1.0, 1.0, 0.14, 28);
  const haemMat = physical("#7f1d1d", { roughness: 0.35, emissive: new THREE.Color("#5b0a0a"), emissiveIntensity: 0.6 });
  const feGeo = new THREE.SphereGeometry(0.24, 16, 12), feMat = physical("#f97316", { metalness: 0.4, roughness: 0.3, emissive: new THREE.Color("#7c2d12"), emissiveIntensity: 0.5 });
  const oGeo = new THREE.SphereGeometry(0.2, 14, 10), oMat = physical("#ef4444", { emissive: new THREE.Color("#7f1d1d"), emissiveIntensity: 0.6 });
  function makeHaem() {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(haemDiscGeo, haemMat); disc.userData.kind = "haem";
    const fe = new THREE.Mesh(feGeo, feMat); fe.userData.kind = "haem";
    const o2 = new THREE.Group();
    const o1 = new THREE.Mesh(oGeo, oMat), o2b = new THREE.Mesh(oGeo, oMat);
    o1.position.set(0, 0.45, 0); o2b.position.set(0.22, 0.75, 0);
    o2.add(o1, o2b);
    g.add(disc, fe, o2);
    g.userData.o2 = o2;
    return g;
  }
  const haem = makeHaem();
  chainG.add(haem);
  const haemPickables = haem.children.filter((c) => c.isMesh);

  // halos: mutated residue(s) and the selected residue
  const haloMat = new THREE.SpriteMaterial({ map: softDot(), color: "#fde047", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.95 });
  const halos = [0, 1, 2].map(() => { const s = new THREE.Sprite(haloMat); s.scale.setScalar(2.4); s.visible = false; chainG.add(s); return s; });
  const selHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: "#5eead4", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
  selHalo.scale.setScalar(2.2); selHalo.visible = false; chainG.add(selHalo);
  let mutIdx = [];

  // chaperone cage (GroEL-like barrel; Hsp70s are smaller, but the cage reads clearly)
  const chapG = new THREE.Group();
  {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.2, 10, 48, 1, true), glass("#a7f3d0", { rim: "#6ee7b7", maxAlpha: 0.5, minAlpha: 0.05, side: THREE.DoubleSide }));
    const ringMat = physical("#34d399", { roughness: 0.4 });
    for (const yy of [-5, 0, 5]) { const r = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.35, 10, 48), ringMat); r.rotation.x = Math.PI / 2; r.position.y = yy; chapG.add(r); }
    chapG.add(barrel);
    chapG.visible = false;
    root.add(chapG);
  }

  // quaternary copies (share the live geometries, so they always match the simulated chain)
  const copies = [];
  for (const id of ["b2", "a1", "a2"]) {
    const g = new THREE.Group();
    const tm = physical(SUB_COL[id], { roughness: 0.45 });
    const t = new THREE.Mesh(tubeGeo, tm); t.frustumCulled = false;
    const r = new THREE.Mesh(ribGeo, ribbonMat(SUB_COL[id])); r.frustumCulled = false;
    const hm = makeHaem();
    const halo = new THREE.Sprite(haloMat); halo.scale.setScalar(2.4); halo.visible = false;
    g.add(t, r, hm, halo);
    g.userData = { id, haem: hm, halo };
    g.visible = false;
    root.add(g);
    copies.push(g);
  }
  // tetrahedral α₂β₂ arrangement; the pseudo-2-fold axis is Y (β1 ↔ β2, α1 ↔ α2)
  const VERT = { b1: new THREE.Vector3(1, 1, 1).normalize(), b2: new THREE.Vector3(-1, 1, -1).normalize(), a1: new THREE.Vector3(1, -1, -1).normalize(), a2: new THREE.Vector3(-1, -1, 1).normalize() };
  const C2 = new THREE.Quaternion().setFromAxisAngle(Y, Math.PI);
  const subQ = {}, subP = {};
  {
    // orient each subunit so its haem faces outward
    const n0 = FM.NATIVE_N, h = new THREE.Vector3(FM.NATIVE[3 * n0], FM.NATIVE[3 * n0 + 1], FM.NATIVE[3 * n0 + 2]).normalize();
    subQ.b1 = new THREE.Quaternion().setFromUnitVectors(h, VERT.b1);
    subQ.b2 = C2.clone().multiply(subQ.b1);
    subQ.a1 = new THREE.Quaternion().setFromAxisAngle(VERT.a1, 2.2).multiply(new THREE.Quaternion().setFromUnitVectors(h, VERT.a1));
    subQ.a2 = C2.clone().multiply(subQ.a1);
  }
  let quatK = 0;   // 0 = single chain at the origin, 1 = in the tetramer

  // β-sheet + disulfide example (other proteins)
  const exG = new THREE.Group();
  exG.visible = false;
  root.add(exG);
  const EX = { t: 0, beads: null, hb: null, ss: null, arrows: [], res: [] };
  {
    const STR = 3, L = 7;
    const res = [];
    const seqEx = ["KTVCVEL", "SYIRCTG", "EVWAQFN"];
    for (let s = 0; s < STR; s++) {
      for (let k = 0; k < L; k++) {
        const dir = s % 2 ? -1 : 1, kk = dir > 0 ? k : L - 1 - k;
        res.push({ s, k: kk, x: (kk - (L - 1) / 2) * 0.88, y: (s - 1) * 1.26, z: (kk % 2 ? 0.28 : -0.28), a: seqEx[s][k] });
      }
    }
    EX.res = res;
    EX.beads = new THREE.InstancedMesh(beadGeo, beadMat, res.length);
    res.forEach((r, i) => EX.beads.setColorAt(i, _c.set(r.a === "C" ? "#facc15" : propCol(r.a))));
    EX.beads.userData.kind = "exbead";
    exG.add(EX.beads);
    // arrows (flat strips, one per strand)
    const arrowMat = physical("#60a5fa", { roughness: 0.32, clearcoat: 0.8, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    for (let s = 0; s < STR; s++) {
      const sh = new THREE.Shape();
      const x0 = -2.9, x1 = 2.0, x2 = 3.1, w = 0.42, wh = 0.72;
      sh.moveTo(x0, -w); sh.lineTo(x1, -w); sh.lineTo(x1, -wh); sh.lineTo(x2, 0); sh.lineTo(x1, wh); sh.lineTo(x1, w); sh.lineTo(x0, w); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false });
      g.translate(0, 0, -0.05);
      const m = new THREE.Mesh(g, arrowMat);
      if (s % 2) m.rotation.z = Math.PI;
      m.userData.kind = "exsheet";
      EX.arrows.push(m);
      exG.add(m);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(40 * 3), 3));
    g.setAttribute("lineDistance", new THREE.BufferAttribute(new Float32Array(40), 1));
    EX.hb = new THREE.LineSegments(g, hbonds.material);
    EX.hb.frustumCulled = false;
    exG.add(EX.hb);
    // disulfide: Cys(strand 0, k=3) – Cys(strand 1, k=4) via two sulfur atoms
    const sMat = physical("#facc15", { emissive: new THREE.Color("#a16207"), emissiveIntensity: 0.5 });
    EX.ss = new THREE.Group();
    const sA = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), sMat), sB = sA.clone();
    const stick = (len) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, len, 8), sMat); return m; };
    EX.ss.add(sA, sB, stick(1), stick(1), stick(1));
    EX.ss.userData = { sA, sB, sticks: EX.ss.children.slice(2) };
    EX.ss.children.forEach((c) => (c.userData.kind = "exss"));
    exG.add(EX.ss);
  }

  // ---------- red blood cell view: many tetramers, HbS fibres, α-chain clumps ----------
  const bloodG = new THREE.Group();
  bloodG.visible = false;
  root.add(bloodG);
  const TET = 14;
  const blobGeo = (() => { const g = new THREE.IcosahedronGeometry(1, 3); g.deleteAttribute("normal"); g.deleteAttribute("uv"); return wobble(mergeVertices(g), 0.1, 2.4, 0.7); })();
  const blobs = new THREE.InstancedMesh(blobGeo, physical("#ffffff", { roughness: 0.38, clearcoat: 0.6 }), TET * 4);
  blobs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  blobs.setColorAt(0, _c.set("#fff"));
  blobs.frustumCulled = false;
  blobs.userData.kind = "tet";
  bloodG.add(blobs);
  const spots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.75, 12, 8), physical("#fbbf24", { emissive: new THREE.Color("#f59e0b"), emissiveIntensity: 0.9 }), TET * 2);
  spots.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  spots.frustumCulled = false;
  bloodG.add(spots);
  const tets = [];
  for (let i = 0; i < TET; i++) {
    tets.push({ p: new THREE.Vector3((hash(i * 1.3) - 0.5) * 70, (hash(i * 2.7) - 0.5) * 30, (hash(i * 3.9) - 0.5) * 24), v: new THREE.Vector3(), q: new THREE.Quaternion().setFromEuler(_e.set(hash(i) * 6, hash(i + 1) * 6, hash(i + 2) * 6)), slot: -1, sat: 1, phase: hash(i * 9.1) });
  }
  const SUBOFF = [new THREE.Vector3(1, 1, 1), new THREE.Vector3(-1, 1, -1), new THREE.Vector3(1, -1, -1), new THREE.Vector3(-1, -1, 1)].map((v) => v.normalize().multiplyScalar(3.4));
  const slots = [];
  for (let k = 0; k < TET; k++) {
    const idx = Math.floor(k / 2), s = k % 2, x = (idx - (TET / 2 - 1) / 2) * 11.5;
    const ph = idx * 0.55 + s * Math.PI;
    slots.push(new THREE.Vector3(x + s * 5.7, Math.cos(ph) * 6.2, Math.sin(ph) * 6.2));
  }
  const slotOrder = slots.map((v, k) => k).sort((a, b) => Math.abs(slots[a].x) - Math.abs(slots[b].x));
  const poly = { poly: 0, lag: 0, peak: 0 };
  const CLUMPS = [new THREE.Vector3(-18, 4, 0), new THREE.Vector3(14, -6, 4), new THREE.Vector3(2, 10, -6)], _cA = new THREE.Color();

  // ---------- labels ----------
  const mkLabel = (cls, html = "") => { const d = document.createElement("div"); d.className = `lbl3d ${cls}`; d.innerHTML = html; d.style.display = "none"; labelLayer.appendChild(d); return d; };
  const L = {
    N: mkLabel("fd-tag", "N-terminus"), C: mkLabel("fd-tag", "C-terminus"),
    res: Array.from({ length: 9 }, () => mkLabel("fd-res")),
    helix: FM.HELICES.map(([nm]) => mkLabel("fd-helix", nm)),
    haem: mkLabel("fd-tag", "haem"), mut: mkLabel("fd-mut"), chap: mkLabel("fd-tag", "chaperone"),
    sub: ["β1", "β2", "α1", "α2"].map((t) => mkLabel("fd-tag", t)),
    fibre: mkLabel("fd-mut"), ex: [mkLabel("fd-tag"), mkLabel("fd-tag"), mkLabel("fd-mut")],
  };
  const hideLabels = () => { for (const el of labelLayer.children) el.style.display = "none"; };

  // ---------- sequence / scenario ----------
  function applyScenario(frag, gene, source, note = "") {
    const sc = FM.scenarioFor(frag, gene);
    S.sc = sc; S.kind = sc.kind; S.frag = sc.frag; S.gene = gene; S.seq = sc.seq; S.source = source; S.note = note;
    sim = new FM.FoldSim(sc.seq, 11);
    sim.T = S.T; sim.pH = S.pH; sim.chaperone = S.chap;
    // start where the current step needs it
    if (S.step === "primary" || S.step === "secondary") { sim.reset("layout"); }
    else sim.reset("native");
    sim.setMode(S.step === "cell" ? "tertiary" : S.step === "quaternary" ? "quaternary" : S.step);
    // colours
    for (let i = 0; i < sim.n; i++) beads.setColorAt(i, _c.set(propCol(sim.seq[i])));
    beads.count = Math.max(0, sim.n);
    if (beads.instanceColor) beads.instanceColor.needsUpdate = true;
    // mutated residues: point changes within an otherwise native chain
    mutIdx = [];
    if (sim.n) for (let i = 0; i < sim.n && mutIdx.length < 3; i++) if (sim.ni[i] >= 0 && sim.seq[i] !== FM.HBB[sim.ni[i]]) mutIdx.push(i);
    if (S.kind === "inframe" || S.kind === "stoplost") { mutIdx = []; for (let i = 0; i < Math.min(sim.n, 12) && mutIdx.length < 3; i++) if (sim.ni[i] < 0) mutIdx.push(i); }
    buildRibbonIndex();
    selRes = -1; selHalo.visible = false;
    poly.poly = 0; poly.lag = 0;
    viewedKinds.add(S.kind);
    refreshProtein();
  }

  function buildRibbonIndex() {
    ribRuns = []; ribSamples = [];
    const n = sim.n;
    let i = 0;
    while (i < n) {
      const h = sim.hx[i];
      if (h < 0 || sim.nativeF[i] <= 0) { i++; continue; }
      let j = i;
      while (j + 1 < n && sim.hx[j + 1] === h && sim.nativeF[j + 1] > 0) j++;
      if (j - i >= 3) ribRuns.push({ a: i, b: j, h });
      i = j + 1;
    }
    const idx = [];
    for (const run of ribRuns) {
      const s0 = ribSamples.length;
      for (let k = run.a * SUBT; k <= run.b * SUBT; k++) ribSamples.push({ k, i: Math.floor(k / SUBT), t: (k % SUBT) / SUBT, h: run.h });
      const s1 = ribSamples.length;
      _c.set(HELIX_COL[run.h]);
      for (let s = s0; s < s1; s++) for (let v = 0; v < 8; v++) { ribCol[(s * 8 + v) * 3] = _c.r; ribCol[(s * 8 + v) * 3 + 1] = _c.g; ribCol[(s * 8 + v) * 3 + 2] = _c.b; }
      for (let s = s0; s < s1 - 1; s++) for (let f = 0; f < 4; f++) {
        const a = s * 8 + f * 2, b = a + 1, c = a + 8, d = b + 8;
        idx.push(a, c, b, b, c, d);
      }
    }
    ribGeo.setIndex(idx);
    ribGeo.attributes.color.needsUpdate = true;
  }

  // ---------- per-frame geometry ----------
  function splineAt(p, n, i, t, out) {
    const i0 = Math.max(0, i - 1), i1 = i, i2 = Math.min(n - 1, i + 1), i3 = Math.min(n - 1, i + 2);
    const t2 = t * t, t3 = t2 * t;
    for (let c = 0; c < 3; c++) {
      const p0 = p[3 * i0 + c], p1 = p[3 * i1 + c], p2 = p[3 * i2 + c], p3 = p[3 * i3 + c];
      out[c] = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    }
  }
  const _o = [0, 0, 0];
  let nPts = 0;
  function updateSpline() {
    const p = sim.p, n = sim.n;
    nPts = n > 1 ? (n - 1) * SUBT + 1 : 0;
    for (let k = 0; k < nPts; k++) {
      const i = Math.min(n - 2, Math.floor(k / SUBT)), t = k === nPts - 1 ? 1 : (k % SUBT) / SUBT;
      splineAt(p, n, i, t, _o);
      SP[3 * k] = _o[0]; SP[3 * k + 1] = _o[1]; SP[3 * k + 2] = _o[2];
    }
    // tangents and parallel-transported normals
    let nx = 0, ny = 1, nz = 0;
    for (let k = 0; k < nPts; k++) {
      const a = Math.max(0, k - 1), b = Math.min(nPts - 1, k + 1);
      let tx = SP[3 * b] - SP[3 * a], ty = SP[3 * b + 1] - SP[3 * a + 1], tz = SP[3 * b + 2] - SP[3 * a + 2];
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      TN[3 * k] = tx; TN[3 * k + 1] = ty; TN[3 * k + 2] = tz;
      if (k === 0) { if (Math.abs(ty) > 0.9) { nx = 1; ny = 0; nz = 0; } }
      const d = nx * tx + ny * ty + nz * tz;
      nx -= d * tx; ny -= d * ty; nz -= d * tz;
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      NR[3 * k] = nx; NR[3 * k + 1] = ny; NR[3 * k + 2] = nz;
    }
  }
  function updateTube(radius) {
    for (let k = 0; k < nPts; k++) {
      const tx = TN[3 * k], ty = TN[3 * k + 1], tz = TN[3 * k + 2], nx = NR[3 * k], ny = NR[3 * k + 1], nz = NR[3 * k + 2];
      const bx = ty * nz - tz * ny, by = tz * nx - tx * nz, bz = tx * ny - ty * nx;
      for (let r = 0; r < RAD; r++) {
        const a = (r / RAD) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        const ox = ca * nx + sa * bx, oy = ca * ny + sa * by, oz = ca * nz + sa * bz, o = (k * RAD + r) * 3;
        tubePos[o] = SP[3 * k] + ox * radius; tubePos[o + 1] = SP[3 * k + 1] + oy * radius; tubePos[o + 2] = SP[3 * k + 2] + oz * radius;
        tubeNrm[o] = ox; tubeNrm[o + 1] = oy; tubeNrm[o + 2] = oz;
      }
    }
    tubeGeo.setDrawRange(0, Math.max(0, nPts - 1) * RAD * 6);
    tubeGeo.attributes.position.needsUpdate = true;
    tubeGeo.attributes.normal.needsUpdate = true;
    tubeGeo.computeBoundingSphere();
  }
  const radial = new Float32Array(MAXN * 3);
  function updateRibbon() {
    const p = sim.p, n = sim.n, hel = sim.helicity;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      let x = p[3 * i] - 0.5 * (p[3 * a] + p[3 * b]), y = p[3 * i + 1] - 0.5 * (p[3 * a + 1] + p[3 * b + 1]), z = p[3 * i + 2] - 0.5 * (p[3 * a + 2] + p[3 * b + 2]);
      const l = Math.hypot(x, y, z) || 1;
      radial[3 * i] = x / l; radial[3 * i + 1] = y / l; radial[3 * i + 2] = z / l;
    }
    const TH = 0.09;
    for (let s = 0; s < ribSamples.length; s++) {
      const sm = ribSamples[s], k = Math.min(sm.k, nPts - 1), i = sm.i, j = Math.min(n - 1, i + 1), t = sm.t;
      const tx = TN[3 * k], ty = TN[3 * k + 1], tz = TN[3 * k + 2];
      let rx = radial[3 * i] * (1 - t) + radial[3 * j] * t, ry = radial[3 * i + 1] * (1 - t) + radial[3 * j + 1] * t, rz = radial[3 * i + 2] * (1 - t) + radial[3 * j + 2] * t;
      const d = rx * tx + ry * ty + rz * tz; rx -= d * tx; ry -= d * ty; rz -= d * tz;
      const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
      const wx = ty * rz - tz * ry, wy = tz * rx - tx * rz, wz = tx * ry - ty * rx;
      const h = hel[i] * (1 - t) + hel[j] * t;
      const w = (0.12 + 1.0 * clamp((h - 0.25) / 0.6, 0, 1)) * 0.55;
      const cx = SP[3 * k], cy = SP[3 * k + 1], cz = SP[3 * k + 2], o = s * 8 * 3;
      // 0,1 top (normal +R) · 2,3 bottom (−R) · 4,5 edge +W · 6,7 edge −W
      const put = (v, sx, sw, nxv, nyv, nzv) => {
        ribPos[o + v * 3] = cx + rx * TH * sx + wx * w * sw; ribPos[o + v * 3 + 1] = cy + ry * TH * sx + wy * w * sw; ribPos[o + v * 3 + 2] = cz + rz * TH * sx + wz * w * sw;
        ribNrm[o + v * 3] = nxv; ribNrm[o + v * 3 + 1] = nyv; ribNrm[o + v * 3 + 2] = nzv;
      };
      put(0, 1, -1, rx, ry, rz); put(1, 1, 1, rx, ry, rz);
      put(2, -1, 1, -rx, -ry, -rz); put(3, -1, -1, -rx, -ry, -rz);
      put(4, 1, 1, wx, wy, wz); put(5, -1, 1, wx, wy, wz);
      put(6, -1, -1, -wx, -wy, -wz); put(7, 1, -1, -wx, -wy, -wz);
    }
    ribGeo.setDrawRange(0, ribGeo.index ? ribGeo.index.count : 0);
    ribGeo.attributes.position.needsUpdate = true;
    ribGeo.attributes.normal.needsUpdate = true;
    ribGeo.computeBoundingSphere();
  }
  function updateBeads(scaleAll) {
    const p = sim.p, n = sim.n;
    const core = S.coreOnly && (S.step === "tertiary" || S.step === "quaternary");
    for (let i = 0; i < n; i++) {
      let sc = scaleAll;
      if (core && sim.hyd[i] < 0.55) sc = Math.min(sc, 0.18);
      if (mutIdx.includes(i)) sc = Math.max(sc, 0.85);
      _m.makeScale(sc, sc, sc).setPosition(p[3 * i], p[3 * i + 1], p[3 * i + 2]);
      beads.setMatrixAt(i, _m);
    }
    beads.count = n;
    beads.instanceMatrix.needsUpdate = true;
    beads.computeBoundingSphere();
  }
  function updateBonds(showHB, showIon) {
    const p = sim.p, W = sim.W;
    hbCount = 0;
    if (showHB) for (let w = 0; w < W.length; w++) {
      const e = W[w];
      if (e[5] !== 0 || e[1] - e[0] !== 4 || !sim.formed[w]) continue;
      const i = e[0], j = e[1], o = hbCount * 6;
      hbPos[o] = p[3 * i]; hbPos[o + 1] = p[3 * i + 1]; hbPos[o + 2] = p[3 * i + 2];
      hbPos[o + 3] = p[3 * j]; hbPos[o + 4] = p[3 * j + 1]; hbPos[o + 5] = p[3 * j + 2];
      hbDist[hbCount * 2] = 0; hbDist[hbCount * 2 + 1] = Math.hypot(p[3 * j] - p[3 * i], p[3 * j + 1] - p[3 * i + 1], p[3 * j + 2] - p[3 * i + 2]);
      if (++hbCount >= MAXN) break;
    }
    hbGeo.setDrawRange(0, hbCount * 2);
    hbGeo.attributes.position.needsUpdate = true; hbGeo.attributes.lineDistance.needsUpdate = true;
    hbonds.visible = hbCount > 0;
    ionCount = 0;
    if (showIon) {
      const q = sim.q, n = sim.n;
      for (let i = 0; i < n && ionCount < 80; i++) {
        if (Math.abs(q[i]) < 0.4) continue;
        for (let j = i + 3; j < n && ionCount < 80; j++) {
          if (q[i] * q[j] > -0.2) continue;
          const dx = p[3 * j] - p[3 * i], dy = p[3 * j + 1] - p[3 * i + 1], dz = p[3 * j + 2] - p[3 * i + 2];
          if (dx * dx + dy * dy + dz * dz > 3.0) continue;
          const o = ionCount * 6;
          ionPos[o] = p[3 * i]; ionPos[o + 1] = p[3 * i + 1]; ionPos[o + 2] = p[3 * i + 2];
          ionPos[o + 3] = p[3 * j]; ionPos[o + 4] = p[3 * j + 1]; ionPos[o + 5] = p[3 * j + 2];
          ionCount++;
        }
      }
    }
    ionGeo.setDrawRange(0, ionCount * 2);
    ionGeo.attributes.position.needsUpdate = true;
    ionic.visible = ionCount > 0;
  }
  function updateHaem(g, showO2) {
    const p = sim.p, n = sim.n;
    g.position.set(p[3 * n], p[3 * n + 1], p[3 * n + 2]);
    if (sim.iProx >= 0) {
      const i = sim.iProx;
      _v.set(p[3 * n] - p[3 * i], p[3 * n + 1] - p[3 * i + 1], p[3 * n + 2] - p[3 * i + 2]);
      if (_v.lengthSq() > 1e-6) g.quaternion.slerp(_q.setFromUnitVectors(Y, _v.normalize()), 0.2);
    }
    g.userData.o2.visible = showO2;
  }

  // ---------- blood view ----------
  const satNow = () => FM.hill(S.pO2, FM.P50_ADULT, FM.HILL_N);
  const isThal = () => ["nonsense", "frameshift", "startlost"].includes(S.kind);
  function updateBlood(dt, t) {
    const sat = satNow(), thal = isThal(), hbs = S.kind === "sickle";
    FM.polymerStep(poly, dt, 1 - sat, hbs);
    poly.peak = Math.max(poly.peak, poly.poly);
    const want = Math.round(poly.poly * TET);
    // join / leave the fibre
    let inFibre = tets.filter((q) => q.slot >= 0).length;
    if (!thal && inFibre < want) {
      const free = slotOrder.find((k) => !tets.some((q) => q.slot === k));
      if (free != null) {
        let best = null, bd = Infinity;
        for (const q of tets) if (q.slot < 0) { const d = q.p.distanceTo(slots[free]); if (d < bd) { bd = d; best = q; } }
        if (best) best.slot = free;
      }
    } else if (inFibre > want) {
      let far = null;
      for (const q of tets) if (q.slot >= 0 && (!far || Math.abs(slots[q.slot].x) > Math.abs(slots[far.slot].x))) far = q;
      if (far) { far.slot = -1; far.v.set(hash(t) - 0.5, 1, hash(t + 1) - 0.5).multiplyScalar(6); }
    }
    let bi = 0, si = 0;
    const deoxA = _c2, cA = _cA;
    for (let k = 0; k < TET; k++) {
      const q = tets[k];
      if (q.slot >= 0) {
        q.p.lerp(slots[q.slot], 1 - Math.exp(-dt * 2.5));
        _q.setFromEuler(_e.set(slots[q.slot].x * 0.1, 0, 0));
        q.q.slerp(_q, 1 - Math.exp(-dt * 2));
        q.v.set(0, 0, 0);
      } else if (dt > 0) {
        // Brownian drift in the cell interior
        q.v.x += (hash(k * 7.1 + t * 13.7) - 0.5) * 40 * dt; q.v.y += (hash(k * 3.3 + t * 11.1) - 0.5) * 40 * dt; q.v.z += (hash(k * 5.9 + t * 17.3) - 0.5) * 40 * dt;
        q.v.multiplyScalar(Math.exp(-dt * 1.2));
        q.p.addScaledVector(q.v, dt);
        const B = [46, 26, 22];
        for (let c = 0; c < 3; c++) { const a = "xyz"[c]; if (Math.abs(q.p[a]) > B[c]) { q.p[a] = Math.sign(q.p[a]) * B[c]; q.v[a] *= -0.5; } }
        // keep clear of the fibre
        if (poly.poly > 0.05 && Math.abs(q.p.y) < 16 && Math.abs(q.p.z) < 14 && Math.abs(q.p.x) < want * 6 + 8) q.v.y += Math.sign(q.p.y || 1) * 30 * dt;
        if (thal) {
          // spare α chains clump: drift toward one of three clumps
          const cl = CLUMPS[k % 3];
          q.p.lerp(cl, 1 - Math.exp(-dt * 0.25));
        }
        if (!reduced) q.q.multiply(_q.setFromEuler(_e.set(dt * 0.3, dt * 0.2, 0)));
      }
      // per-tetramer oxygen saturation fluctuates around the mean
      const sk = clamp(sat + (q.phase - 0.5) * 0.25 * (1 - Math.abs(sat - 0.5) * 1.6), 0, 1);
      q.sat += (sk - q.sat) * (1 - Math.exp(-dt * 3));
      for (let s = 0; s < 4; s++) {
        const alpha = s >= 2;
        if (thal && !alpha) continue;            // no β chains
        const off = thal ? _v.copy(SUBOFF[s]).multiplyScalar(0.55) : _v.copy(SUBOFF[s]);
        off.applyQuaternion(q.q).add(q.p);
        const sc = 3.0;
        _m.compose(off, q.q, _s.set(sc, sc * 0.92, sc));
        blobs.setMatrixAt(bi, _m);
        cA.set(alpha ? "#f87171" : "#fb7185").lerp(deoxA.set(alpha ? "#7f1d1d" : "#831843"), 1 - q.sat);
        if (thal) cA.set("#9f6b6b");
        blobs.setColorAt(bi, cA);
        bi++;
        if (!alpha && hbs) {
          // Val6 patch on the outer face of each β subunit
          _v2.copy(SUBOFF[s]).normalize().multiplyScalar(3.0).add(SUBOFF[s]).applyQuaternion(q.q).add(q.p);
          const glow = 0.55 + 0.45 * (1 - q.sat);
          _m.compose(_v2, q.q, _s.set(glow, glow, glow));
          spots.setMatrixAt(si++, _m);
        }
      }
    }
    blobs.count = bi; spots.count = si;
    blobs.instanceMatrix.needsUpdate = true; spots.instanceMatrix.needsUpdate = true;
    if (blobs.instanceColor) blobs.instanceColor.needsUpdate = true;
    blobs.computeBoundingSphere(); spots.computeBoundingSphere();
    // portrait screens: stand the scene (and the fibre) upright
    bloodG.rotation.z = engine.camera.aspect < 0.85 ? Math.PI / 2 : 0;
  }

  // RBC inset (2D)
  const rbcChip = document.createElement("div");
  rbcChip.className = "chip fd-rbc";
  rbcChip.innerHTML = `<canvas width="256" height="168" aria-label="Red blood cell shape"></canvas><small></small>`;
  const rbcCv = rbcChip.querySelector("canvas"), rbcTxt = rbcChip.querySelector("small");
  function drawRBC() {
    const g = rbcCv.getContext("2d"), w = rbcCv.width, h = rbcCv.height;
    g.clearRect(0, 0, w, h);
    const sat = satNow(), thal = isThal(), sick = S.kind === "sickle" ? clamp(poly.poly / 0.6, 0, 1) : 0;
    const col = thal ? "#c08080" : K.mix("#7f1d1d", "#ef4444", sat);
    const cx = w / 2, cy = h / 2, R = thal ? 46 : 62;
    g.save();
    g.beginPath();
    const N = 64;
    for (let k = 0; k <= N; k++) {
      const a = (k / N) * Math.PI * 2;
      // circle → crescent: squash vertically and bend
      let x = Math.cos(a) * R * (1 + 0.35 * sick), y = Math.sin(a) * R * (1 - 0.62 * sick);
      y += sick * (-(x * x) / (R * 2.2)) + sick * 14;
      // pointed tips
      x *= 1 + sick * 0.18 * Math.pow(Math.abs(Math.cos(a)), 6);
      k ? g.lineTo(cx + x, cy + y) : g.moveTo(cx + x, cy + y);
    }
    g.closePath();
    const grd = g.createRadialGradient(cx, cy, R * 0.1, cx, cy, R);
    grd.addColorStop(0, sick > 0.3 ? col : K.mix(col, "#fecaca", thal ? 0.5 : 0.35));
    grd.addColorStop(0.55, col);
    grd.addColorStop(1, K.mix(col, "#000000", 0.35));
    g.fillStyle = grd; g.fill();
    if (sick > 0.1) {
      // fibres inside the cell
      g.strokeStyle = `rgba(253,224,71,${0.5 * sick})`; g.lineWidth = 2;
      for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(cx - R * 1.1, cy + k * 5 + 8 * sick); g.quadraticCurveTo(cx, cy + k * 5 - 18 * sick, cx + R * 1.1, cy + k * 5 + 8 * sick); g.stroke(); }
    }
    if (thal) { g.fillStyle = "rgba(80,20,20,0.85)"; for (const [dx, dy] of [[-14, -8], [10, 6], [2, -16]]) { g.beginPath(); g.arc(cx + dx, cy + dy, 6, 0, Math.PI * 2); g.fill(); } }
    g.restore();
    const txt = thal ? pick({ "y7-8": "Small, pale cell with clumps", "y9-10": "β-thalassaemia: small, pale cell; α-chain clumps", y11: "Microcytic, hypochromic; α-chain inclusions" })
      : sick > 0.5 ? pick({ "y7-8": "Sickled red blood cell", y11: "Sickled (HbS fibres)" }) : sick > 0.05 ? pick({ "y7-8": "Starting to sickle…" }) : pick({ "y7-8": "Normal red blood cell", y11: "Normal biconcave disc" });
    if (rbcTxt.textContent !== txt) rbcTxt.textContent = txt;
  }

  // ---------- views ----------
  function fitDist(halfW, halfH) {
    const cam = engine.camera, a = cam.aspect, t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    return Math.max(halfW / (t * a), halfH / t);
  }
  function viewFor(step) {
    const a = engine.camera.aspect;
    if (S.example) return { target: new THREE.Vector3(0, 0, 0), distance: fitDist(4.6, 3.6) * 1.15, dir: new THREE.Vector3(0.2, -0.45, 1) };
    if (step === "primary") return { target: new THREE.Vector3(0, 0, 0), distance: fitDist(9.2, 9.8) * 1.08, dir: new THREE.Vector3(0.05, 0.12, 1) };
    if (step === "secondary") return { target: new THREE.Vector3(0, 0, 0), distance: fitDist(13, 9.5) * 1.05, dir: new THREE.Vector3(0.1, 0.25, 1) };
    if (step === "quaternary") return { target: new THREE.Vector3(0, 0, 0), distance: fitDist(11.5, 11.5) * 1.1, dir: new THREE.Vector3(0.35, 0.3, 1) };
    if (step === "cell") return { target: new THREE.Vector3(0, 0, 0), distance: a < 0.85 ? fitDist(30, 50) : fitDist(50, 30), dir: new THREE.Vector3(0.12, 0.28, 1) };
    return { target: new THREE.Vector3(0, 0, 0), distance: fitDist(7.2, 7.2) * 1.1, dir: new THREE.Vector3(0.3, 0.25, 1) };
  }
  function frameStep(dur = 1.0) {
    const v = viewFor(S.step);
    engine.controls.maxDistance = Math.max(60, v.distance * 2.4);
    engine.camera.far = Math.max(600, v.distance * 12); engine.camera.updateProjectionMatrix();
    engine.fly(v.target, v.target.clone().addScaledVector(v.dir.clone().normalize(), v.distance), dur);
  }

  // ---------- steps / tour ----------
  const visited = new Set();
  let tour = null, scratch = false, scratchDone = false, stepT = 0;
  function setStep(step, { fly = true, user = true } = {}) {
    if (user) tour = null;
    const prev = S.step;
    S.step = step;
    visited.add(step);
    stepT = 0;
    if (step !== "secondary" && step !== "tertiary") S.example = false;
    if (sim) {
      if (step === "cell") sim.setMode("tertiary");
      else sim.setMode(step);
      if (step === "primary" && prev !== "primary") sim.nbrAge = 999;
    }
    if (fly) frameStep(prev === step ? 0.6 : 1.0);
    ui.stepSeg?.set(step);
    refreshStepText();
    seen();
  }
  function startTour() {
    S.example = false;
    if (sim) sim.reset("layout");
    tour = { i: 0, t: 0 };
    setStep("primary", { user: false });
    scratch = false;
  }
  function tourTick(dt) {
    if (!tour) return;
    tour.t += dt;
    const M = sim.metrics;
    if (tour.i === 0 && tour.t > 5) { tour.i = 1; tour.t = 0; setStep("secondary", { user: false }); }
    else if (tour.i === 1 && (tour.t > 9 || (tour.t > 4.5 && M.helix > 0.75))) { tour.i = 2; tour.t = 0; setStep("tertiary", { user: false }); }
    else if (tour.i === 2 && (M.Q >= 0.7 || tour.t > 30)) { tour.i = 3; tour.t = 0; }
    else if (tour.i === 3 && tour.t > 2.5) { tour.i = 4; tour.t = 0; setStep("quaternary", { user: false }); }
    else if (tour.i === 4 && tour.t > 4) tour = null;
    if (!sim.n || sim.nTert === 0) { if (tour && tour.i >= 2 && tour.t > 6) tour = null; }
  }
  function foldFromScratch() {
    tour = null;
    S.example = false;
    if (S.step !== "tertiary" && S.step !== "quaternary") setStep("tertiary");
    sim.reset("extended");
    sim.setMode(S.step);
    scratch = true;
    toast(pick({ "y7-8": "A brand-new chain, straight off the ribosome. Watch it fold!", "y9-10": "A new chain from the ribosome: watch the hydrophobic collapse, then the helices dock.", y11: "Fresh unfolded chain: watch hydrophobic collapse → helix docking → native contacts (Q)." }), 3400);
  }

  // ---------- panel ----------
  const ui = {};
  let progress = null, panelEl = null;
  function buildPanel(el) {
    panelEl = el;
    if (progress) progress.node.remove();
    const host = document.createElement("div");
    host.style.display = "contents";
    el.appendChild(host);
    progress = { band: lens.band, node: host };
    for (const k of Object.keys(ui)) delete ui[k];

    const note = K.card(host, "");
    note.innerHTML = `<p style="margin:0">${pick(FC.MODEL_NOTE)}</p>`;

    const ex = K.card(host, "What's happening", "explain");
    ui.exBody = document.createElement("div");
    ui.exBody.setAttribute("aria-live", "polite");
    const sn = document.createElement("p"); sn.className = "hint"; sn.innerHTML = pick(FC.SIM_NOTE);
    ex.append(ui.exBody, sn);

    ui.selCard = K.card(host, "Selected", "sel-card");
    ui.selCard.style.display = "none";

    // levels of structure
    const st = K.card(host, y7() ? "How a protein gets its shape" : "Levels of structure", "fd-steps");
    ui.stepSeg = K.segmented(st, FC.STEPS.map((s) => ({ value: s.id, label: pick(s.name) })), S.step, (v) => setStep(v));
    ui.stepText = document.createElement("p");
    ui.stepText.style.cssText = "font-size:0.86rem;margin:8px 0 0";
    st.appendChild(ui.stepText);
    const row = K.buttonRow(st);
    K.button(row, "▶ " + pick({ "y7-8": "Fold a new chain", "y9-10": "Fold from scratch" }), () => foldFromScratch(), { kind: "primary" });
    K.button(row, pick({ "y7-8": "Watch all steps", "y9-10": "Play 1° → 4°" }), () => startTour());
    if (!y7()) ui.exBtn = K.button(row, "β-sheet & S–S example", () => {
      S.example = !S.example;
      if (S.example && S.step !== "secondary" && S.step !== "tertiary") setStep("secondary", { fly: false });
      EX.t = 0; frameStep(0.9); refreshStepText(); exSeen = true;
    });
    const tg = document.createElement("div");
    tg.style.cssText = "display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:8px";
    st.appendChild(tg);
    if (!y7()) K.checkbox(tg, senior() ? "Show bonds (H-bonds, ionic)" : "Show ionic bonds (+/−)", S.bonds, (v) => (S.bonds = v));
    K.checkbox(tg, y7() ? "Show only water-avoiding beads" : "Hydrophobic core only", S.coreOnly, (v) => (S.coreOnly = v));
    const vw = document.createElement("div"); vw.style.marginTop = "8px"; st.appendChild(vw);
    ui.viewSeg = K.segmented(vw, [{ value: "both", label: "Beads + ribbons" }, { value: "beads", label: "Beads" }, { value: "ribbons", label: "Ribbons" }], S.view, (v) => (S.view = v));

    // your protein + mutations
    const pr = K.card(host, y7() ? "Your protein & DNA changes" : "Your polypeptide & mutations");
    ui.protBody = document.createElement("div");
    pr.appendChild(ui.protBody);
    const tryLbl = document.createElement("p"); tryLbl.className = "hint"; tryLbl.style.marginTop = "8px";
    tryLbl.textContent = y7() ? "Try a different change to the gene:" : "Try each type of mutation in the gene:";
    pr.appendChild(tryLbl);
    const tr = document.createElement("div"); tr.className = "fd-try"; pr.appendChild(tr);
    ui.tryBtns = {};
    for (const b of FC.TRY_BUTTONS) {
      ui.tryBtns[b.kind] = K.button(tr, pick(b.label), () => { const p = FM.preset(b.kind); applyScenario(p.frag, p.gene, "preset", p.note); toast(`${pick(FC.KINDS[b.kind === "none" ? "none" : b.kind].title)}: ${p.note}`, 3000); }, { toggle: false });
    }
    ui.fromDNA = K.button(tr, y7() ? "My chain" : "From DNA level", () => { if (incoming) applyScenario(incoming.frag, incoming.gene, "incoming"); });
    ui.fromDNA.title = "Use the polypeptide you made in the DNA → protein level";

    // conditions
    const c = K.card(host, "Conditions");
    ui.tS = K.slider(c, { label: "Temperature", min: 0, max: 100, value: S.T, unit: " °C", onInput: (v) => { S.T = v; seen(); } });
    ui.pHS = K.slider(c, { label: "pH", min: 1, max: 13, step: 0.1, value: S.pH, format: (v) => `pH ${v.toFixed(1)}`, onInput: (v) => { S.pH = v; seen(); } });
    ui.o2S = K.slider(c, { label: y7() ? "Oxygen level" : "Oxygen (pO₂)", min: 5, max: 100, value: S.pO2, format: (v) => (y7() ? `${v} %` : `${v} mmHg`), onInput: (v) => { S.pO2 = v; } });
    ui.o2S.el.insertAdjacentHTML("beforeend", `<p class="hint">${pick({ "y7-8": "High in the lungs, low in busy muscles.", "y9-10": "Lungs ≈ 100 mmHg; resting tissues ≈ 40; working muscle ≈ 20 or less.", y11: "Arterial ≈ 100 mmHg, mixed venous ≈ 40, exercising muscle < 20." })}</p>`);
    if (senior()) K.checkbox(c, "Chaperone (Hsp70 / chaperonin) available", S.chap, (v) => { S.chap = v; if (sim) sim.chaperone = v; });
    const cr = K.buttonRow(c);
    K.button(cr, pick({ "y7-8": "Back to body temperature", "y9-10": "Body conditions (37 °C, pH 7.4)" }), () => { S.T = 37; S.pH = 7.4; ui.tS.value = 37; ui.pHS.value = 7.4; });
    K.button(cr, pick({ "y7-8": "Make a fresh protein", "y9-10": "Fresh protein" }), () => { foldFromScratch(); });

    const lg = K.card(host, "Key");
    const legend = document.createElement("div");
    legend.className = "legend";
    const rows = ["hyd", "pol", "pos", "neg", "spc"].map((k) => [FM.PROP_COL[k], pick(FC.PROP_NAME[k])]);
    rows.push(["#7f1d1d", y7() ? "Haem (holds oxygen)" : "Haem (Fe²⁺ binds O₂)"]);
    if (!y7()) rows.push(["#fde047", "Ionic bond (salt bridge)"]);
    if (senior()) rows.push(["#e0f2fe", "H-bond (dashed)"]);
    legend.innerHTML = rows.map(([col, t]) => `<span><i style="background:${col}"></i>${t}</span>`).join("");
    lg.appendChild(legend);
    if (!y7()) lg.insertAdjacentHTML("beforeend", `<p class="hint">Ribbons: helices A–H in rainbow order (N → C). Yellow glow = a changed amino acid.</p>`);

    for (const k of Object.keys(holds)) delete holds[k];
    ui.ms = K.missions(host, lens.filter(MISSIONS), (m) => toast(`🎯 Mission complete: ${m.text}`, 3400));
    K.quiz(host, lens.filter(FC.QUIZ));
    refreshProtein();
    refreshStepText();
    updateExplain();
  }

  function refreshStepText() {
    if (!ui.stepText) return;
    let t = pick(FC.STEP_TEXT[S.step]);
    if (S.example) t = pick({ "y9-10": "<strong>Example from another protein</strong> (haemoglobin has none of these): a <strong>β-pleated sheet</strong> — strands lie side by side, held by hydrogen bonds — and a <strong>disulfide bridge</strong>, a strong covalent S–S link between two cysteines.", y11: "<strong>Example from other proteins</strong> (globins have neither): an antiparallel <strong>β-pleated sheet</strong> — strands H-bonded backbone-to-backbone (dashed), arrows point N → C — and a covalent <strong>disulfide bridge</strong> (Cys–S–S–Cys) that cross-links the chain, common in secreted proteins such as insulin, antibodies and keratin." });
    ui.stepText.innerHTML = t;
    if (ui.exBtn) ui.exBtn.textContent = S.example ? "Back to haemoglobin" : "β-sheet & S–S example";
  }

  function refreshProtein() {
    if (!ui.protBody) return;
    const sc = S.sc, kind = S.kind, K0 = FC.KINDS[kind] || FC.KINDS.missense;
    const frag = S.frag || "";
    const chips = [...frag].slice(0, 12).map((a, i) => `<span class="${a !== FM.FRAG[i] ? "mut" : ""}" style="background:${propCol(a)}" title="${FM.nameFull(a)}">${FM.name3(a)}</span>`).join("");
    const more = S.seq.length > frag.length ? `<em>+ ${S.seq.length - frag.length} more${kind === "frameshift" ? " (scrambled)" : ""}</em>` : `<em>${frag.length ? "STOP" : "no protein"}</em>`;
    const src = S.source === "incoming" ? pick({ "y7-8": "Made from your DNA in the last step:", "y9-10": "The polypeptide you made in the DNA → protein level:" }) : S.source === "preset" ? `${pick({ "y7-8": "Changed gene", "y9-10": "Mutant gene" })} (${S.note}):` : pick({ "y7-8": "The first 9 amino acids (from the gene):", "y9-10": "The model gene's product (first 9 residues):" });
    ui.protBody.innerHTML = `<p class="hint" style="margin:0">${src}</p><div class="fd-seq">${chips}${more}</div>
      <p class="fd-kind" style="color:${K0.col}">${pick(K0.title)}${S.seq.length ? ` · ${S.seq.length} amino acids` : ""}</p><p style="font-size:0.84rem;margin:0">${pick(K0.text)}</p>`;
    if (ui.tryBtns) for (const [k, b] of Object.entries(ui.tryBtns)) b.setAttribute("aria-pressed", String(S.source === "preset" && (k === kind || (k === "none" && kind === "none"))));
    if (ui.fromDNA) { ui.fromDNA.style.display = incoming ? "" : "none"; ui.fromDNA.setAttribute("aria-pressed", String(S.source === "incoming")); }
  }

  // ---------- explain + chips ----------
  const chipShape = K.chip(overlay), chipFn = K.chip(overlay);
  overlay.children[1].classList.add("fd-opt");
  const meter = document.createElement("div"); meter.className = "chip fd-meter"; overlay.appendChild(meter);
  function updateChips() {
    const M = sim.metrics;
    if (S.step === "cell") {
      const sat = satNow();
      chipShape(`${y7() ? "Oxygen loaded" : "Hb saturation"} <b>${Math.round(sat * 100)} %</b>`);
      chipFn(S.kind === "sickle" ? `${y7() ? "In fibres" : "Polymerised"} <b>${Math.round(poly.poly * 100)} %</b>` : isThal() ? `<b>${y7() ? "No β chains" : "No α₂β₂ forms"}</b>` : `${y7() ? "Molecules" : "HbA"} <b>dissolved</b>`);
      const html = `${y7() ? "Oxygen" : "pO₂"} <b>${S.pO2} ${y7() ? "%" : "mmHg"}</b><div class="bar"><i style="width:${Math.round(satNow() * 100)}%;background:${K.mix("#7f1d1d", "#ef4444", satNow())}"></i></div>`;
      if (meter.innerHTML !== html) meter.innerHTML = html;
      return;
    }
    const stName = pick(FC.STATE_NAME[S.step === "primary" ? "none" : M.state] || FC.STATE_NAME.unfolded);
    chipShape(S.step === "primary" ? `${sim.n} <b>amino acids</b>` : S.step === "secondary" ? `${y7() ? "Coils" : "Helices"} <b>${Math.round(M.helix * 100)} %</b>` : `${y7() ? "Shape" : "State"} <b>${M.state === "short" ? pick(FC.STATE_NAME.short) : stName}</b>`);
    const works = sim.hasHaem && M.Q >= 0.6 && M.haem >= 0.5;
    chipFn(S.step === "primary" || S.step === "secondary" ? `${y7() ? "Water-avoiding" : "Hydrophobic"} <b>${Math.round((sim.n ? [...sim.seq].filter((a) => FM.propOf(a) === "hyd").length / sim.n : 0) * 100)} %</b>`
      : works ? `${y7() ? "Carries oxygen" : "Binds O₂"} <b style="color:#4ade80">✓</b>` : `${y7() ? "Carries oxygen" : "Binds O₂"} <b style="color:#f87171">✗</b>`);
    const q = sim.nTert ? M.Q : 0;
    const col = q >= 0.6 ? "#4ade80" : q >= 0.3 ? "#fbbf24" : "#f87171";
    const html = `${y7() ? "Like the normal shape" : "Native contacts (Q)"} <b>${Math.round(q * 100)} %</b><div class="bar"><i style="width:${Math.round(q * 100)}%;background:${col}"></i></div>`;
    if (meter.innerHTML !== html) meter.innerHTML = html;
  }
  function updateExplain() {
    if (!ui.exBody || !sim) return;
    const M = sim.metrics;
    const Sx = { step: S.step, kind: S.kind, m: M, n: sim.n, T: S.T, pH: S.pH, net: M.net, harsh: sim.harsh, chap: S.chap, hasHaem: sim.hasHaem, native: sim.nTert > 0,
      sickle: S.kind === "sickle", thal: isThal(), poly: poly.poly, lag: poly.lag, sat: satNow(), pO2: S.pO2 };
    const main = FC.narrative(lens.band, Sx);
    let now = "";
    if (S.step === "cell" || !sim.n) now = "";
    else if (y7()) now = `<strong>Right now:</strong> ${S.T} °C, pH ${S.pH.toFixed(1)}${S.step !== "primary" ? `; ${Math.round(M.burial * 100)} % of the water-avoiding beads are tucked inside` : ""}.`;
    else {
      const parts = [`${S.T} °C`, `pH ${S.pH.toFixed(1)} (net charge ${M.net > 0 ? "+" : ""}${M.net.toFixed(1)})`];
      if (S.step !== "primary") parts.push(`helix ${Math.round(M.helix * 100)} %`);
      if (S.step === "tertiary" || S.step === "quaternary") { parts.push(`native contacts ${Math.round(M.Q * 100)} %`, `hydrophobic buried ${Math.round(M.burial * 100)} %`); if (sim.hasHaem) parts.push(`haem ${M.haem > 0.5 ? "bound" : "free"}`); }
      if (senior() && S.bonds && ionCount && S.step !== "primary") parts.push(`${ionCount} salt bridge${ionCount > 1 ? "s" : ""}`);
      if (senior()) parts.push(`radius of gyration ${(M.rg * 0.38).toFixed(1)} nm`);
      now = `<strong>Now:</strong> ${parts.join("; ")}.`;
    }
    const html = `<p>${main}</p>${now ? `<p class="now">${now}</p>` : ""}`;
    if (ui.exBody.innerHTML !== html) ui.exBody.innerHTML = html;
  }

  // ---------- selection ----------
  let selRes = -1;
  const RES_NOTE = {
    6: { "y7-8": "This is the amino acid that changes in sickle-cell disease.", "y9-10": "Position 6: Glu in normal haemoglobin, Val in sickle-cell haemoglobin (HbS).", y11: "β6: surface residue on the A helix. Glu → Val (HbS) creates the hydrophobic patch that drives polymerisation." },
    92: { "y7-8": "This one holds the iron of the haem.", "y9-10": "His92 (proximal histidine) holds the haem's iron in place.", y11: "His F8 (β92), the proximal histidine: its imidazole N coordinates the haem Fe²⁺." },
    63: { "y9-10": "His63 sits above the haem, next to where O₂ binds.", y11: "His E7 (β63), the distal histidine: H-bonds the bound O₂ and hinders CO binding." },
    85: { y11: "Phe85: part of the hydrophobic acceptor pocket (with Leu88) that the Val6 of another HbS tetramer docks into." },
    88: { y11: "Leu88: with Phe85 forms the acceptor pocket for Val6 in HbS fibres." },
    93: { y11: "Cys93: reactive thiol near the C-terminal region (binds NO as S-nitrosohaemoglobin); not part of a disulfide." },
  };
  function showSelected() {
    const c = ui.selCard;
    if (!c) return;
    if (selRes < 0 || selRes >= sim.n) { c.style.display = "none"; selHalo.visible = false; return; }
    const i = selRes, a = sim.seq[i], pr = FM.propOf(a), ni = sim.ni[i];
    const buried = (sim.neigh?.[i] || 0) >= 20;
    const helix = sim.hx[i] >= 0 ? `helix ${FM.HELICES[sim.hx[i]][0]}` : y7() ? "a loop" : "a loop / turn";
    const q = sim.q[i];
    const note = ni >= 0 && RES_NOTE[ni] ? pick(RES_NOTE[ni]) : "";
    const changed = ni < 0 || a !== FM.HBB[ni] ? `<b>Change</b><span style="color:#fde047">${ni >= 0 ? `normally ${FM.name3(FM.HBB[ni])}` : "not in the normal chain"}</span>` : "";
    const html = `<h2>Selected amino acid</h2><p style="color:var(--ink);font-weight:600;margin-bottom:4px"><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${propCol(a)};margin-right:6px"></i>${FM.nameFull(a)} (${FM.name3(a)}${i}) ${i < 9 ? `<span class="hint">· from your gene</span>` : ""}</p>
      <div class="io"><b>Type</b><span>${pick(FC.PROP_NAME[pr])}</span>${S.step === "primary" ? "" : `<b>Where</b><span>${buried ? (y7() ? "tucked inside" : "buried in the core") : y7() ? "on the outside" : "on the surface"}, in ${helix}</span>`}
      ${!y7() && Math.abs(q) > 0.05 ? `<b>Charge</b><span>${q > 0 ? "+" : ""}${q.toFixed(2)} at pH ${S.pH.toFixed(1)}</span>` : ""}${changed}</div>${note ? `<p class="hint">${note}</p>` : ""}`;
    if (c.dataset.html !== html) { c.dataset.html = html; c.innerHTML = html; }
    c.style.display = "";
  }

  // ---------- missions ----------
  const holds = {};
  let frameDt = 0, heatArmed = false, dmgSeen = false, chapRefold = false, exSeen = false, viewedKinds = new Set(), ktViewed = new Set(), sickleCycle = false;
  const hold = (k, cond, secs) => { holds[k] = cond ? (holds[k] || 0) + frameDt : 0; return holds[k] >= secs; };
  const tert = () => S.step === "tertiary" || S.step === "quaternary";
  const MISSIONS = [
    { maxBand: "y7-8", text: "Step through all four levels: chain → coils → fold → team of 4.", check: () => ["primary", "secondary", "tertiary", "quaternary"].every((s) => visited.has(s)) },
    { maxBand: "y9-10", text: "Press “Fold from scratch” and watch a new chain fold until it is at least 80 % like the normal shape.", check: () => scratchDone },
    { maxBand: "y7-8", text: "Heat the protein until it unravels (less than 30 % of its shape left).", check: () => heatArmed },
    { maxBand: "y7-8", text: "Now cool it back to 37 °C. Does it fold back up by itself? Watch for 5 seconds.", check: () => heatArmed && hold("cool", S.T <= 40 && sim.damaged && tert(), 5) },
    { maxBand: "y7-8", text: "Change the pH until the shape falls apart.", check: () => hold("ph", (S.pH < 4.6 || S.pH > 10.8) && tert() && sim.metrics.Q < 0.3 && sim.nTert > 0, 1) },
    { maxBand: "y9-10", text: "Try the sickle-cell mutation, go to the red blood cell and lower the oxygen until the haemoglobin forms fibres.", check: () => S.kind === "sickle" && poly.poly > 0.5 },
    { band: "y9-10", maxBand: "y9-10", text: "Fold the protein, then tick “Hydrophobic core only”: where did the hydrophobic beads go?", check: () => hold("core", S.coreOnly && tert() && sim.metrics.Q > 0.6, 2) },
    { band: "y9-10", maxBand: "y9-10", text: "Denature it with heat (≥ 62 °C), then cool it to 37 °C. Is denaturation reversible?", check: () => heatArmed && hold("cool9", S.T <= 40 && sim.damaged && tert(), 5) },
    { band: "y9-10", maxBand: "y9-10", text: "Show that a silent mutation makes a protein that folds just like the normal one (≥ 70 %).", check: () => S.kind === "silent" && tert() && sim.metrics.Q >= 0.7 },
    { band: "y9-10", maxBand: "y9-10", text: "Show that a nonsense mutation can't make a folded protein: view it at the 3° step.", check: () => hold("non", S.kind === "nonsense" && S.step === "tertiary", 3) },
    { band: "y11", text: "Secondary structure: show the hydrogen bonds holding the α-helices (2° step, bonds on, helices ≥ 60 %).", check: () => S.bonds && S.step === "secondary" && sim.metrics.helix >= 0.6 && hbCount > 10 },
    { band: "y11", text: "Find salt bridges (ionic bonds) in the folded protein, then lower the pH until they break and the fold collapses.", check: () => ktViewed.has("salt") && hold("acid", S.pH < 4.6 && tert() && sim.metrics.Q < 0.3 && sim.nTert > 0, 1) },
    { band: "y11", text: "Denature the protein with heat, then use the chaperone to refold it to ≥ 70 % native contacts.", check: () => chapRefold },
    { band: "y11", text: "Acid denaturation releases the haem: find a pH where the folded protein loses its haem.", check: () => hold("haem", S.pH < 5 && sim.hasHaem && tert() && sim.metrics.haem < 0.15, 1) },
    { band: "y11", text: "Sickle cell: polymerise HbS at low pO₂, then re-oxygenate until the fibres dissolve.", check: () => sickleCycle },
    { band: "y11", text: "Compare a nonsense and a frameshift mutation at the 3° step (view both).", check: () => ktViewed.has("nonsense") && ktViewed.has("frameshift") },
  ];

  // ---------- interaction ----------
  let interacted = false, hintT = 0;
  function seen() { if (!interacted && hintT > 1.5) { interacted = true; hintEl.style.opacity = "0"; } }
  function beadAt(cx, cy) {
    if (!beads.visible || !sim?.n) return null;
    const ray = engine.setRay(cx, cy);
    const hit = ray.intersectObject(beads, false)[0];
    return hit && hit.instanceId != null ? hit.instanceId : null;
  }

  // ---------- update ----------
  let uiT = 0, exT = 0, simCost = 0, subs = 16, frame = 0, disposed = false;
  function update(dt, t, realDt = dt) {
    if (disposed || !sim) return;
    frameDt = dt;
    frame++;
    const stepNow = S.step;
    const cell = stepNow === "cell";
    // ---- simulation ----
    if (dt > 0 && !cell && sim.n) {
      sim.T = S.T; sim.pH = S.pH; sim.chaperone = S.chap;
      const t0 = performance.now();
      const n = Math.max(2, Math.round(subs * S.speed * Math.min(1.5, dt * 60)));
      sim.step(n, 0.004);
      sim.tickDamage(dt);
      if (stepNow === "quaternary" && frame % 6 === 0 && sim.metrics.Q > 0.3) sim.alignToNative(0.25);
      const cost = performance.now() - t0;
      simCost = simCost * 0.95 + cost * 0.05;
      if (frame % 60 === 0) subs = simCost > 9 ? Math.max(8, subs - 2) : simCost < 4 && subs < 16 ? subs + 2 : subs;
      if (sim.damaged) dmgSeen = true;
      if (dmgSeen && S.chap && sim.metrics.Q >= 0.7 && !sim.damaged) chapRefold = true;
      if (scratch && sim.metrics.Q >= 0.8) { scratchDone = true; scratch = false; toast(pick({ "y7-8": "Folded! The chain found its working shape.", "y9-10": "Folded: the chain reached its native shape.", y11: "Native state reached (Q ≥ 0.8)." })); }
      if (tert() && S.T >= 62 && sim.metrics.Q < 0.3 && sim.nTert > 0) heatArmed = true;
      if (S.step === "tertiary") ktViewed.add(S.kind);
      if (senior() && S.bonds && tert() && ionCount > 0) ktViewed.add("salt");
    }
    tourTick(realDt);
    stepT += realDt;
    if (cell) {
      updateBlood(dt, t);
      if (poly.peak > 0.5 && poly.poly < 0.05 && S.pO2 >= 60 && S.kind === "sickle") sickleCycle = true;
    }
    // ---- visibility ----
    const ex = S.example;
    chainG.visible = !cell && !ex && sim.n > 0;
    bloodG.visible = cell;
    exG.visible = ex;
    env.userData.water.visible = !cell;
    const quat = stepNow === "quaternary" && !ex;
    quatK += ((quat ? 1 : 0) - quatK) * (1 - Math.exp(-realDt * 3));
    if (Math.abs(quatK - (quat ? 1 : 0)) < 0.002) quatK = quat ? 1 : 0;
    if (chainG.visible) {
      const primary = stepNow === "primary";
      updateSpline();
      const showRib = !primary && S.view !== "beads";
      const beadScale = primary ? 1 : S.view === "beads" ? 1 : S.view === "ribbons" ? 0.0001 : 0.6;
      updateTube(primary || S.view === "beads" ? 0.17 : 0.14);
      ribbon.visible = showRib && ribSamples.length > 0;
      if (ribbon.visible) updateRibbon();
      ribbon.material = quatK > 0.5 ? ribMatSub : ribMatRainbow;
      tube.material.color.set(quatK > 0.5 ? SUB_COL.b1 : "#cbd5e1");
      updateBeads(beadScale);
      beads.visible = beadScale > 0.001 || mutIdx.length > 0;
      updateBonds(senior() && S.bonds && !primary, !y7() && S.bonds && tert());
      const M = sim.metrics;
      const haemOn = sim.hasHaem && tert();
      haem.visible = haemOn;
      if (haemOn) updateHaem(haem, M.haem > 0.5 && M.Q > 0.5 && satNow() > 0.5);
      // halos for changed residues
      halos.forEach((h, k) => {
        const i = mutIdx[k];
        h.visible = i != null;
        if (h.visible) { h.position.set(sim.p[3 * i], sim.p[3 * i + 1], sim.p[3 * i + 2]); h.material.opacity = 0.65 + 0.3 * Math.sin(t * 3); }
      });
      if (selRes >= 0 && selRes < sim.n) { selHalo.visible = true; selHalo.position.set(sim.p[3 * selRes], sim.p[3 * selRes + 1], sim.p[3 * selRes + 2]); }
      // quaternary placement
      if (quatK > 0) {
        _v.copy(VERT.b1).multiplyScalar(quatDist() * quatK);
        chainG.position.copy(_v);
        chainG.quaternion.slerpQuaternions(_q.identity(), subQ.b1, quatK);
      } else { chainG.position.set(0, 0, 0); chainG.quaternion.identity(); }
      for (const g of copies) {
        g.visible = quatK > 0.02;
        if (!g.visible) continue;
        const id = g.userData.id;
        g.position.copy(VERT[id]).multiplyScalar(quatDist() * Math.max(quatK, 0.02) * (1 + (1 - quatK) * 1.2));
        g.quaternion.copy(subQ[id]);
        g.scale.setScalar(Math.max(0.02, quatK));
        const hm = g.userData.haem;
        hm.visible = haem.visible;
        hm.position.copy(haem.position); hm.quaternion.copy(haem.quaternion); hm.userData.o2.visible = haem.userData.o2.visible;
        const hl = g.userData.halo;
        hl.visible = S.kind === "sickle" && id === "b2" && mutIdx.length > 0;
        if (hl.visible) hl.position.set(sim.p[3 * mutIdx[0]], sim.p[3 * mutIdx[0] + 1], sim.p[3 * mutIdx[0] + 2]);
        g.children[1].visible = ribbon.visible;
      }
    } else for (const g of copies) g.visible = false;
    // chaperone cage
    chapG.visible = S.chap && chainG.visible && tert() && (sim.damaged || sim.harsh) && sim.nTert > 0;
    if (chapG.visible && !reduced) chapG.rotation.y += realDt * 0.3;
    // example
    if (ex) updateExample(realDt);
    // ---- labels ----
    updateLabels(t);
    // ---- UI ----
    hintT += realDt;
    if (!interacted && hintT > 16) { interacted = true; hintEl.style.opacity = "0"; }
    ui.ms?.update();
    if ((uiT -= realDt) <= 0) { uiT = 0.2; updateChips(); showSelected(); if (cell) drawRBC(); rbcChip.style.display = cell ? "" : "none"; }
    if ((exT -= realDt) <= 0) { exT = 0.5; updateExplain(); }
  }
  const quatDist = () => 4.9 + 7 * clamp((0.55 - sim.metrics.Q) / 0.35, 0, 1);

  function updateExample(dt) {
    EX.t = Math.min(1, EX.t + dt / (reduced ? 0.3 : 3.2));
    const k = EX.t < 0.7 ? EX.t / 0.7 : 1, e = 1 - Math.pow(1 - k, 3);
    const res = EX.res;
    const pos = EX.hb.geometry.attributes.position, ld = EX.hb.geometry.attributes.lineDistance;
    const P = [];
    res.forEach((r, i) => {
      const spread = (1 - e) * 2.6 * (r.s - 1);
      const y = r.y + spread, z = r.z * (0.3 + 0.7 * e) + (1 - e) * Math.sin(r.k * 1.3 + r.s) * 0.8;
      P.push([r.x, y, z]);
      _m.makeTranslation(r.x, y, z);
      EX.beads.setMatrixAt(i, _m);
    });
    EX.beads.instanceMatrix.needsUpdate = true;
    EX.arrows.forEach((a, s) => { a.position.set(0, (s - 1) * 1.26 + (1 - e) * 2.6 * (s - 1), 0); a.material.opacity = 0.35 + 0.55 * e; });
    // H-bonds between neighbouring strands (every other residue)
    let nh = 0;
    for (let s = 0; s < 2; s++) for (let kk = 0; kk < 7; kk += 2) {
      const a = res.findIndex((r) => r.s === s && r.k === kk), b = res.findIndex((r) => r.s === s + 1 && r.k === kk);
      const pa = P[a], pb = P[b], d = Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
      if (d > 1.9) continue;
      pos.setXYZ(nh * 2, pa[0], pa[1] + 0.25, pa[2]); pos.setXYZ(nh * 2 + 1, pb[0], pb[1] - 0.25, pb[2]);
      ld.setX(nh * 2, 0); ld.setX(nh * 2 + 1, d);
      nh++;
    }
    EX.hb.geometry.setDrawRange(0, nh * 2);
    pos.needsUpdate = true; ld.needsUpdate = true;
    // disulfide forms last
    const sa = res.findIndex((r) => r.s === 0 && r.k === 3), sb = res.findIndex((r) => r.s === 1 && r.k === 3);
    const ss = EX.ss.userData, f = clamp((EX.t - 0.7) / 0.3, 0, 1);
    EX.ss.visible = EX.t > 0.55;
    const A = _v.set(...P[sa]), B = _v2.set(...P[sb]);
    const SA = new THREE.Vector3(A.x, A.y + 0.36 * f, A.z + 0.75), SB = new THREE.Vector3(B.x, B.y - 0.36 * f, B.z + 0.75);
    ss.sA.position.copy(SA); ss.sB.position.copy(SB);
    const place = (m, p0, p1) => { const d = _v3.subVectors(p1, p0), len = d.length(); m.position.copy(p0).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(Y, d.normalize()); m.scale.set(1, Math.max(0.01, len), 1); };
    place(ss.sticks[0], A, SA); place(ss.sticks[1], B, SB); place(ss.sticks[2], SA, SB);
    ss.sticks[2].visible = f > 0.95;
  }

  function placeLocal(el, x, y, z, dx = 0, dy = 0) { _v.set(x, y, z); chainG.localToWorld(_v); return engine.place(el, _v, dx, dy); }
  function updateLabels(t) {
    hideLabels();
    if (engine.busy) return;
    const p = sim?.p, n = sim?.n || 0;
    if (S.example) {
      const lab = [[0, 3.1, 0.4, pick({ "y9-10": "β-pleated sheet", y11: "Antiparallel β-sheet (arrows N → C)" })], [2.6, -2.4, 0.3, pick({ "y9-10": "hydrogen bonds", y11: "backbone H-bonds" })], [-3.2, -0.6, 1.6, "Disulfide bridge (S–S)"]];
      lab.forEach(([x, yy, z, txt], k) => { if (k === 2 && EX.t < 0.9) return; const el = L.ex[k]; el.textContent = txt; _v.set(x, yy, z); engine.place(el, _v); });
      return;
    }
    if (S.step === "cell") {
      if (S.kind === "sickle" && poly.poly > 0.15) { L.fibre.textContent = pick({ "y7-8": "Sticky haemoglobin fibre", "y9-10": "HbS fibre (polymer)", y11: "HbS fibre (real fibres: 14 strands)" }); _v.set(0, 9, 0).applyEuler(bloodG.rotation); engine.place(L.fibre, _v); }
      if (isThal()) { L.fibre.textContent = pick({ "y7-8": "Clumps of spare α chains", "y9-10": "Precipitated α chains" }); _v.set(-18, 12, 0).applyEuler(bloodG.rotation); engine.place(L.fibre, _v); }
      return;
    }
    if (!n || !chainG.visible) return;
    const step = S.step;
    if (step === "primary" || step === "secondary") {
      placeLocal(L.N, p[0], p[1], p[2], -54, 0);
      if (n > 1) placeLocal(L.C, p[3 * (n - 1)], p[3 * (n - 1) + 1], p[3 * (n - 1) + 2], 0, 22);
    }
    if (step === "primary") {
      for (let i = 0; i < Math.min(9, n); i++) {
        const el = L.res[i], a = sim.seq[i];
        const txt = FM.name3(a);
        if (el.textContent !== txt) el.textContent = txt;
        el.classList.toggle("mut", a !== FM.FRAG[i]);
        placeLocal(el, p[3 * i], p[3 * i + 1] + 0.62, p[3 * i + 2] + 0.3);
      }
    }
    if ((step === "secondary" || step === "tertiary") && !y7() && S.view !== "beads") {
      for (const run of ribRuns) {
        const m = (run.a + run.b) >> 1;
        if (sim.helicity[m] < 0.5) continue;
        placeLocal(L.helix[run.h], p[3 * m] + radial[3 * m] * 0.9, p[3 * m + 1] + radial[3 * m + 1] * 0.9, p[3 * m + 2] + radial[3 * m + 2] * 0.9);
      }
    }
    if (haem.visible && step === "tertiary") placeLocal(L.haem, haem.position.x, haem.position.y + 1.3, haem.position.z);
    if (mutIdx.length && step !== "primary") {
      const i = mutIdx[0], a = sim.seq[i], ni = sim.ni[i];
      const txt = S.kind === "sickle" ? pick({ "y7-8": "Val6 — sticky spot", "y9-10": "Val6 (was Glu): hydrophobic patch", y11: "Val6 (Glu in HbA): hydrophobic patch" }) : `${FM.name3(a)}${i}${ni >= 0 && a !== FM.HBB[ni] ? ` (was ${FM.name3(FM.HBB[ni])})` : ""}`;
      if (L.mut.textContent !== txt) L.mut.textContent = txt;
      placeLocal(L.mut, p[3 * i], p[3 * i + 1] + 1.1, p[3 * i + 2]);
    }
    if (chapG.visible) { _v.set(0, 5.8, 0); engine.place(L.chap, _v); L.chap.textContent = senior() ? "chaperonin (holds & refolds)" : "chaperone"; }
    if (quatK > 0.9) {
      const D = quatDist();
      ["b1", "b2", "a1", "a2"].forEach((id, k) => { _v.copy(VERT[id]).multiplyScalar(D * 1.75); engine.place(L.sub[k], _v); });
    }
  }

  // ---------- level object ----------
  level = {
    title: "Protein folding",
    topics: ["protein-folding", "mutation", "protein-synthesis"],
    root,
    get pickables() { return [beads, ...haemPickables, blobs, EX.beads, ...EX.arrows]; },
    metersPerUnit: UNIT,                   // 1 unit = one Cα–Cα step (3.8 Å); Hb tetramer ≈ 14.5 units ≈ 5.5 nm
    get view() { return viewFor(S.step); },
    minDistance: 2.5, maxDistance: 120, near: 0.05, far: 1500,
    enablePan: true,
    env: { bg: ["#0a1830", "#0b3038", "#2b1650"], fog: ["#0a2030", 0.006], exposure: 1.05, bloom: [0.45, 0.5, 0.84], aperture: 0.0009 },
    get sim() { return sim; },       // testing / teacher console
    get state() { return S; },
    shared: S,
    info(obj) {
      const k = obj?.userData?.kind;
      if (k === "bead") {
        const i = beadAt(engine.pointer.x, engine.pointer.y);
        if (i == null || i >= sim.n) return { title: y7() ? "Amino acid — click for details" : "Amino acid (bead) — click for details" };
        const a = sim.seq[i];
        return { title: `${FM.nameFull(a)} (${FM.name3(a)}${i}) · ${pick(FC.PROP_NAME[FM.propOf(a)])}` };
      }
      if (k === "haem") return { title: pick({ "y7-8": "Haem — the iron in it grabs oxygen", "y9-10": "Haem group: an iron (Fe²⁺) ring that binds one O₂", y11: "Haem (Fe²⁺-protoporphyrin IX), bound to His F8 (β92)" }) };
      if (k === "tet") return { title: S.kind === "sickle" ? pick({ "y7-8": "Sickle haemoglobin molecule", y11: "HbS tetramer (α₂β^S₂)" }) : isThal() ? pick({ "y7-8": "Spare α chains", y11: "Unpaired α-globin chains" }) : pick({ "y7-8": "Haemoglobin molecule", y11: "HbA tetramer (α₂β₂)" }) };
      if (k === "exbead") return { title: "Amino acid in a β-strand" };
      if (k === "exsheet") return { title: "β-strand (arrow points N → C)" };
      return null;
    },
    onClick(e, hit) {
      seen();
      if (hit?.object === beads && hit.instanceId != null && hit.instanceId < sim.n) { selRes = selRes === hit.instanceId ? -1 : hit.instanceId; showSelected(); return true; }
      if (selRes >= 0) { selRes = -1; showSelected(); }
      return true;
    },
    onPointerDown() { seen(); return false; },
    mountPanel(el) {
      if (!incoming) {
        const idx = engine.stack.findIndex((s) => s.inst === level);
        const inc = readIncoming(idx > 0 ? engine.stack[idx - 1].inst : null);
        if (inc) { incoming = inc; applyScenario(inc.frag, inc.gene, "incoming"); }
      }
      if (progress && progress.band === lens.band) { panelEl = el; el.appendChild(progress.node); }
      else buildPanel(el);
      engine.overlay.appendChild(overlay);
      overlay.appendChild(rbcChip);
      engine.labelLayer.appendChild(labelLayer);
      engine.stageEl.appendChild(hintEl);
      // camera limits for the current step
      requestAnimationFrame(() => { if (!disposed) { const v = viewFor(S.step); engine.controls.maxDistance = Math.max(60, v.distance * 2.4); } });
    },
    unmountPanel() { hideLabels(); overlay.remove(); labelLayer.remove(); hintEl.remove(); },
    onLens() { if (panelEl) buildPanel(panelEl); else progress = null; },
    onResize() { if (!engine.userMoved) { const v = viewFor(S.step); engine.controls.maxDistance = Math.max(60, v.distance * 2.4); } },
    update,
    dispose() { disposed = true; overlay.remove(); labelLayer.remove(); hintEl.remove(); progress?.node.remove(); },
  };

  // initial protein: the parent's polypeptide if there is one, otherwise the model gene's product
  if (incoming) applyScenario(incoming.frag, incoming.gene, "incoming");
  else applyScenario(FM.FRAG, null, "default");
  visited.add("primary");
  if (!reduced) setTimeout(() => { if (!disposed && !interacted && S.step === "primary" && engine.current === level) startTour(); }, 3500);
  hintEl.textContent = matchMedia("(max-width: 600px)").matches
    ? "Pick a level of structure · heat it · change the pH · try a mutation"
    : "Step through the levels of structure, then heat it, change the pH or try a mutation. Click a bead to inspect it.";
  return level;
}
