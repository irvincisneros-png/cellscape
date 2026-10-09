// 3D scene for the meiosis level: a germ cell (2n = 4) whose chromatids are deformable tubes coloured by
// parental origin, with allele letters, cohesin rings, the synaptonemal complex, chiasmata, kinetochores,
// spindles, nuclear envelopes and dividing cells. Layout = where each part should be for the current phase;
// the level lerps from a snapshot to that layout (like the 2D sim's layoutFor()).
// Units: 1 unit = 0.1 µm (metersPerUnit 1e-7). Chromosomes are drawn larger relative to the cell than in life.
import * as THREE from "three";
import { physical, glass, softDot, specks, hash } from "../../assets/js/world/materials.js";
import { N, LEN, WID, CEN, LOCI, COL, alleleAt } from "./model.js";
import { P } from "./content3d.js";

export const SC = 4;                       // scene units per 2D-model unit
export const R0 = (WID * SC) / 2;          // chromatid radius (1.7 units = 170 nm)
const SEG = 84, RAD = 14;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeIO = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export const CELL_R = 40, NUC_R = 30;
export const MI_POLE_X = 34;
export const BIV_Y = [13, -17];            // metaphase I heights of bivalents 1 and 2
export const DYAD_X = 28, DYAD_R = 28, MII_POLE_Y = 22;
export const TET_Y = 20, TET_R = 18;
const AX_V = new THREE.Vector3(0, -1, 0.14).normalize();       // vertical chromosome axis (top → bottom)
const AX_H = new THREE.Vector3(1, 0, -0.5).normalize();        // meiosis II axis (horizontal, tilted in depth)
const DEP_H = new THREE.Vector3(0.5, 0, 1).normalize();        // depth direction for stacking in meiosis II
const G1POS = [[-0.3, -0.1, -0.35], [0.24, 0.17, 0.5], [-0.12, 0.3, 1.25], [0.27, -0.25, -0.9]];
const ARM_U = [[0.05, 0.15, 0.25, 0.47, 0.58, 0.69, 0.8, 0.91], [0.07, 0.18, 0.3, 0.55, 0.67, 0.79, 0.9]];
const RUNG_U = Array.from({ length: 22 }, (_, i) => 0.04 + (0.92 * i) / 21);
const LETTERS = ["A", "a", "B", "b", "D", "d"];

// non-uniform sampling: denser near the rounded tips
const U = new Float32Array(SEG + 1);
for (let i = 0; i <= SEG; i++) { const t = i / SEG; U[i] = 0.72 * t + 0.28 * (0.5 - 0.5 * Math.cos(Math.PI * t)); }
const iOf = (u) => { let b = 0; for (let i = 0; i <= SEG; i++) if (Math.abs(U[i] - u) < Math.abs(U[b] - u)) b = i; return b; };

function letterTexture(ch) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 96;
  const c = cv.getContext("2d");
  c.font = "800 70px Inter, system-ui, sans-serif";
  c.textAlign = "center"; c.textBaseline = "middle";
  c.lineWidth = 12; c.strokeStyle = "rgba(10,6,24,0.92)"; c.lineJoin = "round";
  c.strokeText(ch, 48, 52);
  c.fillStyle = ch === ch.toUpperCase() ? "#fff6d8" : "#dbeafe";
  c.fillText(ch, 48, 52);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A pose: chromatid midpoint, long axis (top → bottom), lateral direction (sister / homologue lanes). */
const newPose = () => ({ c: new THREE.Vector3(), ax: AX_V.clone(), lat: new THREE.Vector3(1, 0, 0), th: 1, vis: 1 });
const copyPose = (o, p) => { o.c.copy(p.c); o.ax.copy(p.ax); o.lat.copy(p.lat); o.th = p.th; o.vis = p.vis; return o; };

export class MeiosisScene {
  constructor(engine, S) {
    this.engine = engine;
    this.S = S;
    this.root = new THREE.Group();
    this.pickables = [];
    this.fallback = [];
    this.v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.sc = new THREE.Vector3();
    this.showLetters = true;
    this.hover = null;               // { type: "pair"|"chrom"|"gamete", id }
    this.build();
  }

  // ---------------------------------------------------------------- construction
  build() {
    const root = this.root;
    const tag = (o, kind, extra = {}) => { Object.assign(o.userData, { kind }, extra); return o; };

    // chromatid tubes: 0..7 = this cell (index k*2+s), 8..9 = the other parent's gamete (pairs 1 and 2)
    this.bodyMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.25, sheenRoughness: 0.5, sheenColor: new THREE.Color("#ffd6ef") });
    this.hiMat = this.bodyMat.clone();
    this.hiMat.emissive = new THREE.Color("#7c5cff"); this.hiMat.emissiveIntensity = 0.28;
    const idx = [];
    for (let i = 0; i < SEG; i++) for (let j = 0; j < RAD; j++) { const a = i * (RAD + 1) + j, b = a + RAD + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    this.tubes = [];
    for (let t = 0; t < 10; t++) {
      const n = (SEG + 1) * (RAD + 1);
      const g = new THREE.BufferGeometry();
      g.setIndex(idx);
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
      const mesh = tag(new THREE.Mesh(g, this.bodyMat), "chromatid", { tube: t });
      mesh.frustumCulled = false;
      root.add(mesh); this.pickables.push(mesh);
      const k = t < 8 ? t >> 1 : 10 + (t - 8), s = t < 8 ? t & 1 : 0, p = t < 8 ? k >> 1 : t - 8;
      this.tubes.push({ mesh, t, k, s, p, L: LEN[p] * SC, cl: new Float32Array((SEG + 1) * 3), bins: null, binsKey: "", cur: newPose(), from: newPose(), tgt: newPose(), pinch: [], trail: { x: 0, y: 0, z: 0, amp: 0 }, letters: [] });
    }
    // allele letters (sprites)
    this.letterMats = {};
    for (const L of LETTERS) this.letterMats[L] = new THREE.SpriteMaterial({ map: letterTexture(L), transparent: true, depthWrite: false });
    for (const tb of this.tubes) for (const l of LOCI[tb.p]) {
      const sp = new THREE.Sprite(this.letterMats[l.gene]);
      sp.scale.setScalar(2.7); sp.renderOrder = 5;
      root.add(sp);
      tb.letters.push({ sp, gene: l.gene, pos: l.pos, i: iOf(l.pos) });
    }

    // cohesin rings (arm + centromeric) per chromosome
    const ringGeo = new THREE.TorusGeometry(1, 0.085, 8, 32);
    this.rings = [];
    for (let k = 0; k < 4; k++) {
      const p = k >> 1;
      for (const u of ARM_U[p]) this.rings.push({ k, p, u, i: iOf(u), cen: false });
      this.rings.push({ k, p, u: CEN[p], i: iOf(CEN[p]), cen: true });
    }
    this.cohesin = tag(new THREE.InstancedMesh(ringGeo, physical("#ffffff", { roughness: 0.3, emissive: new THREE.Color("#ffb020"), emissiveIntensity: 0.12 }), this.rings.length), "cohesin");
    const cArm = new THREE.Color("#facc15"), cCen = new THREE.Color("#fb7a3c");
    this.rings.forEach((r, i) => this.cohesin.setColorAt(i, r.cen ? cCen : cArm));
    this.cohesin.frustumCulled = false;
    root.add(this.cohesin); this.pickables.push(this.cohesin);
    this.sgoMesh = tag(new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.62, 2), physical("#4ade80", { emissive: new THREE.Color("#16a34a"), emissiveIntensity: 0.6 }), 8), "shugoshin");
    this.sgoMesh.frustumCulled = false;
    root.add(this.sgoMesh); this.pickables.push(this.sgoMesh);

    // synaptonemal complex: transverse filaments (rungs) + central element segments
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 8, 1).translate(0, 0.5, 0);
    const scMat = physical("#a5f3fc", { emissive: new THREE.Color("#22d3ee"), emissiveIntensity: 0.25, roughness: 0.35 });
    this.scRungs = tag(new THREE.InstancedMesh(cyl, scMat, 2 * RUNG_U.length), "sc");
    this.scCentral = tag(new THREE.InstancedMesh(cyl, scMat, 2 * RUNG_U.length), "sc");
    this.scRungs.frustumCulled = this.scCentral.frustumCulled = false;
    root.add(this.scRungs, this.scCentral); this.pickables.push(this.scRungs, this.scCentral);

    // chiasma markers
    this.chiMesh = tag(new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.8, 2), physical("#ddd6fe", { emissive: new THREE.Color("#8b5cf6"), emissiveIntensity: 0.9 }), 6), "chiasma");
    this.chiMesh.frustumCulled = false;
    root.add(this.chiMesh); this.pickables.push(this.chiMesh);
    this.chiHalo = [];
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: "#a78bfa", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
      s.scale.setScalar(6); s.visible = false; root.add(s); this.chiHalo.push(s);
    }
    this.chiList = [];

    // kinetochores
    this.kineto = tag(new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 0.42, 18), physical("#f5f3ff", { emissive: new THREE.Color("#c4b5fd"), emissiveIntensity: 0.5 }), 10), "kinetochore");
    this.kineto.frustumCulled = false;
    root.add(this.kineto); this.pickables.push(this.kineto);

    // spindle fibres (instanced unit cylinders) and poles
    this.MAXF = 220;
    this.fibres = tag(new THREE.InstancedMesh(cyl, physical("#e0f2fe", { emissive: new THREE.Color("#7dd3fc"), emissiveIntensity: 0.35, roughness: 0.4, transparent: true, opacity: 0.75, depthWrite: false }), this.MAXF), "fibre");
    this.fibres.frustumCulled = false;
    root.add(this.fibres);
    this.poles = [];
    const centrioleGeo = new THREE.CylinderGeometry(0.7, 0.7, 2.6, 9);
    const centMat = physical("#bbf7d0", { emissive: new THREE.Color("#22c55e"), emissiveIntensity: 0.5 });
    for (let i = 0; i < 6; i++) {
      const g = tag(new THREE.Group(), "pole");
      const c1 = tag(new THREE.Mesh(centrioleGeo, centMat), "pole"), c2 = tag(new THREE.Mesh(centrioleGeo, centMat), "pole");
      c2.rotation.z = Math.PI / 2; c2.position.x = 1.0;
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: "#86efac", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 }));
      glow.scale.setScalar(9);
      g.add(c1, c2, glow);
      g.userData.centrioles = [c1, c2]; g.userData.glow = glow;
      g.visible = false;
      root.add(g); this.pickables.push(c1, c2);
      this.poles.push(g);
    }
    // equator markers (metaphase plates)
    this.plates = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 6, 96), new THREE.MeshBasicMaterial({ color: "#fbbf24", transparent: true, opacity: 0.0, depthWrite: false }));
      m.visible = false; root.add(m); this.plates.push(m);
    }

    // cells: 4 slots (one per final product) + the egg; nuclear envelopes; division furrow / cell plate
    this.cellMats = [];
    this.cells = [];
    for (let i = 0; i < 4; i++) {
      const mat = glass("#b9a7e6", { rim: "#d8c7ff", rimStrength: 0.5, minAlpha: 0.02, maxAlpha: 0.42 });
      const m = tag(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 40), mat), "cell", { slot: i });
      root.add(m); this.fallback.push(m);
      this.cells.push({ mesh: m, cur: { c: new THREE.Vector3(), r: CELL_R, vis: i === 0 ? 1 : 0 }, from: { c: new THREE.Vector3(), r: CELL_R, vis: 0 } });
    }
    this.egg = tag(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 40), glass("#fde68a", { rim: "#fcd34d", rimStrength: 0.7, minAlpha: 0.05, maxAlpha: 0.6 })), "egg");
    this.egg.visible = false; root.add(this.egg); this.fallback.push(this.egg);
    this.nuclei = [];
    for (let i = 0; i < 4; i++) {
      const m = tag(new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), glass("#8b7bd8", { rim: "#c4b5fd", rimStrength: 0.35, minAlpha: 0.015, maxAlpha: 0.22 })), "nucleus");
      m.visible = false; root.add(m); this.nuclei.push(m);
    }
    this.furrow = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 8, 80), physical("#d8c7ff", { emissive: new THREE.Color("#a78bfa"), emissiveIntensity: 0.6 }));
    this.furrow.visible = false; root.add(this.furrow);
    this.furrows = [0, 1, 2].map(() => { const m = this.furrow.clone(); root.add(m); return m; });
    this.furrow.removeFromParent();
    this.plateMat = new THREE.MeshPhysicalMaterial({ color: "#fef3c7", emissive: new THREE.Color("#fbbf24"), emissiveIntensity: 0.35, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false, roughness: 0.6 });
    this.cellPlates = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.CircleGeometry(1, 48), this.plateMat); m.visible = false; root.add(m); return m; });
    this.wall = tag(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 40), glass("#fde68a", { rim: "#fef3c7", rimStrength: 0.3, minAlpha: 0.01, maxAlpha: 0.2 })), "wall");
    this.wall.scale.setScalar(46); root.add(this.wall); this.fallback.push(this.wall);
    this.wallCur = new THREE.Vector3(46, 46, 46); this.wallFrom = this.wallCur.clone();

    // ghost marker shown while dragging a crossover
    this.ghost = new THREE.Mesh(new THREE.TorusGeometry(1, 0.16, 8, 48), new THREE.MeshBasicMaterial({ color: "#c4b5fd", transparent: true, opacity: 0.85, depthWrite: false }));
    this.ghost.visible = false; root.add(this.ghost);
    this.selGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: "#5eead4", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 }));
    this.selGlow.visible = false; root.add(this.selGlow);

    // cytoplasm specks
    this.specks = specks(180, 0.9, [150, 110, 90], ["#c4b5fd", "#a5f3fc", "#f9a8d4", "#fde68a"], 0.4);
    root.add(this.specks);

    for (const tb of this.tubes) { tb.cur.vis = 0; copyPose(tb.from, tb.cur); }
  }

  // ---------------------------------------------------------------- layout (targets for the current phase)
  /** bivalent frame for pair p: centre, rotation about y by the (animated) metaphase I orientation */
  bivTheta(p) { return Math.PI * easeIO(clamp(this.S.disp[p], 0, 1)); }
  lanes(gap) { const r = R0; return [-(gap / 2 + 3 * r), -(gap / 2 + r), gap / 2 + r, gap / 2 + 3 * r]; }
  tetCentre(g, out) { return out.set(((g >> 1) ? 1 : -1) * DYAD_X, ((g & 1) ? -1 : 1) * TET_Y, 0); }

  targetPose(tb, ph, o) {
    const S = this.S, v = this.v[0];
    o.vis = 1; o.th = 1;
    if (tb.t >= 8) { this.otherPose(tb, o); return o; }
    const { k, s, p } = tb, mat = k & 1;
    const dest = S.dest[k][s];
    if (ph <= P.S) {
      const [bx, by, a] = G1POS[k];
      o.ax.set(-Math.sin(a), -Math.cos(a), 0.18 * Math.sin(k * 1.7)).normalize();
      o.lat.set(Math.cos(a), -Math.sin(a), 0).normalize();
      o.th = 0.62;
      const off = ph === P.G1 ? 0 : R0 * 0.62 * 1.05;
      o.c.set(bx * 52, -by * 52, 6 * Math.sin(k * 2.3)).addScaledVector(o.lat, s ? off : -off);
      if (ph === P.G1 && s === 1) o.vis = 0;
      return o;
    }
    if (ph <= P.ANA1 && !(ph === P.ANA1 && false)) {
      if (ph <= P.MET1) {
        // bivalents: prophase side by side, metaphase I stacked on the equator
        const gap = ph === P.PRO1 ? 1.5 : 5.2;
        const lane = this.lanes(gap)[mat * 2 + (mat ? s : s)];
        const th = this.bivTheta(p);
        const cx = ph === P.MET1 ? 0 : p ? 12 : -13, cy = ph === P.MET1 ? BIV_Y[p] : p ? -4 : 3, cz = ph === P.MET1 ? 0 : p ? 3 : -2;
        o.lat.set(Math.cos(th), 0, -Math.sin(th));
        o.ax.copy(AX_V);
        o.c.set(cx, cy, cz).addScaledVector(o.lat, lane);
        return o;
      }
      // anaphase I: each chromosome (pair of sisters) to the pole of its side
      const th = Math.PI * S.orient[p];
      o.lat.set(Math.cos(th), 0, -Math.sin(th));
      o.ax.copy(AX_V);
      const both = S.err.nd === "I" && p === S.err.ndPair;
      o.c.set((dest.side ? 1 : -1) * 25, BIV_Y[p], both ? (mat ? -5 : 5) : 0);
      const sep = S.err.sgo === false ? 1.25 : 1;
      o.c.addScaledVector(o.lat, (s ? R0 : -R0) * sep);
      return o;
    }
    if (ph === P.TEL1) {
      const th = Math.PI * S.orient[p];
      o.lat.set(Math.cos(th), 0, -Math.sin(th));
      o.ax.copy(AX_V);
      const both = S.err.nd === "I" && p === S.err.ndPair;
      o.c.set((dest.side ? 1 : -1) * DYAD_X + (p ? 6 : -6), p ? -2 : 2, both ? (mat ? -5 : 5) : 0);
      o.c.addScaledVector(o.lat, (s ? R0 : -R0) * (S.err.sgo === false ? 1.25 : 1));
      return o;
    }
    const side = dest.side, cx = (side ? 1 : -1) * DYAD_X;
    // slot along the meiosis II axis: pair 1 left, pair 2 right; extra copies stacked in depth
    const along = p === 0 ? -9.5 : 13.5;
    const sameCell = [0, 1].filter((kk) => S.dest[2 * p + kk][0].side === side);
    const depth = sameCell.length > 1 ? (mat ? -6 : 6) : 0;
    if (ph === P.MET2) {
      o.ax.copy(AX_H);
      if (S.err.sgo === false) {
        // single chromatids, captured independently
        o.lat.set(0, 1, 0);
        o.c.set(cx, 0, 0).addScaledVector(AX_H, along).addScaledVector(DEP_H, depth + (s ? 2.6 : -2.6)).add(v.set(0, dest.half ? -3.5 : 3.5, 0));
        return o;
      }
      const ang = Math.PI * easeIO(clamp(S.disp2[side][p], 0, 1));
      o.lat.set(0, 1, 0).applyAxisAngle(AX_H, ang);
      o.c.set(cx, 0, 0).addScaledVector(AX_H, along).addScaledVector(DEP_H, depth).addScaledVector(o.lat, s ? -R0 : R0);
      return o;
    }
    if (ph === P.ANA2) {
      o.ax.copy(AX_H); o.lat.set(0, 1, 0);
      const siblings = this.sameDest(k, s);
      o.c.set(cx, dest.half ? -15 : 15, 0).addScaledVector(AX_H, along).addScaledVector(DEP_H, depth + siblings * 3.8);
      return o;
    }
    // telophase II / products: 2×2 tetrad
    o.ax.copy(AX_H); o.lat.set(0, 1, 0); o.th = 0.92;
    const g = side * 2 + dest.half;
    this.tetCentre(g, o.c);
    const gm = S.gametes ? S.gametes[g] : null;
    let row = p === 0 ? 3.6 : -3.6, dz = 0;
    if (gm) {
      const same = gm.parts.filter((q) => q.p === p), i = same.findIndex((q) => q.k === k && q.s === s);
      if (same.length > 1) dz = (i - (same.length - 1) / 2) * 4;
      if (gm.perPair[1 - p] === 0) row = 0;
    }
    o.c.addScaledVector(AX_H, p === 0 ? -1.5 : 2).add(v.set(0, row, 0)).addScaledVector(DEP_H, dz);
    if (S.fert && S.fert.g === g) this.fertPose(tb, o);
    else if (S.fert) o.vis = 0;
    return o;
  }
  /** offset index for chromatids sharing a pole in anaphase II (nondisjunction / no cohesion) */
  sameDest(k, s) {
    const d = this.S.dest[k][s];
    let before = 0, total = 0;
    for (let kk = 0; kk < 4; kk++) if ((kk >> 1) === (k >> 1)) for (let ss = 0; ss < 2; ss++) {
      const e = this.S.dest[kk][ss];
      if (e.side === d.side && e.half === d.half) { if (kk * 2 + ss < k * 2 + s) before++; total++; }
    }
    return before - (total - 1) / 2;
  }
  /** fertilisation: our gamete's chromatids move into the egg (left lanes); the egg's own are on the right */
  fertPose(tb, o) {
    const F = this.S.fert, e = easeIO(clamp(F.t, 0, 1));
    if (e <= 0.02) return;
    const gm = F.gm, i = gm.parts.findIndex((q) => q.k === tb.k && q.s === tb.s);
    const same = gm.parts.filter((q) => q.p === tb.p), j = same.findIndex((q) => q.k === tb.k && q.s === tb.s);
    if (i < 0) return;
    const v = this.v[1].set(-3 - j * 4, tb.p === 0 ? 10 : -12, 0);
    o.c.lerp(v, e); o.ax.lerp(AX_V, e).normalize(); o.lat.set(1, 0, 0); o.th = 0.92 + 0.08 * e;
  }
  otherPose(tb, o) {
    const F = this.S.fert;
    if (!F) { o.vis = 0; o.c.set(140, 0, 0); return; }
    const q = F.parts2.find((x) => x.p === tb.p);
    if (!q) { o.vis = 0; return; }
    const e = easeIO(clamp(F.t, 0, 1));
    o.ax.copy(AX_V); o.lat.set(1, 0, 0); o.th = 0.92 + 0.08 * e;
    const egg = this.eggCentre(this.v[2]);
    o.c.set(3, tb.p === 0 ? 10 : -12, 0).add(egg);
  }
  eggCentre(out) { const F = this.S.fert; const e = F ? easeIO(clamp(F.t * 1.4, 0, 1)) : 0; return out.set(110 * (1 - e), 0, 0); }

  cellTarget(slot, ph, o) {
    const S = this.S;
    if (S.fert) {
      const g = S.fert.g, e = easeIO(clamp(S.fert.t, 0, 1));
      if (slot === g) { this.tetCentre(g, o.c).lerp(this.v[3].set(0, 0, 0), e); o.r = TET_R + (30 - TET_R) * e * 0.4; o.vis = e < 0.9 ? 1 : 0; }
      else { this.tetCentre(slot, o.c); o.r = TET_R; o.vis = 0; }
      return o;
    }
    if (ph <= P.ANA1) { o.c.set(0, 0, 0); o.r = CELL_R; o.vis = slot === 0 ? 1 : 0; return o; }
    if (ph <= P.ANA2) { o.c.set((slot >> 1 ? 1 : -1) * DYAD_X, 0, 0); o.r = DYAD_R; o.vis = (slot & 1) ? 0 : 1; return o; }
    this.tetCentre(slot, o.c); o.r = TET_R; o.vis = 1;
    return o;
  }

  /** framing box (half-width, half-height) and centre for a phase */
  frameBox(ph) {
    const S = this.S, plant = S.org === "plant";
    if (S.fert) return { c: new THREE.Vector3(0, 0, 0), hx: 36, hy: 34 };
    if (ph <= P.S) return { c: new THREE.Vector3(0, 0, 0), hx: 34, hy: 34 };
    if (ph <= P.DIP) return { c: new THREE.Vector3(0, 0, 0), hx: 28, hy: 22 };
    if (ph <= P.ANA1) return { c: new THREE.Vector3(0, 0, 0), hx: plant ? 46 : 42, hy: plant ? 46 : 42 };
    if (ph <= P.ANA2) return { c: new THREE.Vector3(0, 0, 0), hx: plant ? 62 : 58, hy: 32 };
    return { c: new THREE.Vector3(0, 0, 0), hx: plant ? 52 : 48, hy: plant ? 44 : 40 };
  }

  // ---------------------------------------------------------------- per-frame
  snapshot() {
    for (const tb of this.tubes) copyPose(tb.from, tb.cur);
    for (const c of this.cells) { c.from.c.copy(c.cur.c); c.from.r = c.cur.r; c.from.vis = c.cur.vis; }
    this.wallFrom.copy(this.wallCur);
  }

  /** e = eased phase progress (0..1); pt = phase time; dur = phase duration */
  update(dt, t, e, pt, dur) {
    const S = this.S, ph = S.phase, cam = this.engine.camera;
    // ---- poses
    for (const tb of this.tubes) {
      this.targetPose(tb, ph, tb.tgt);
      const c = tb.cur, f = tb.from, g = tb.tgt;
      const ee = tb.t >= 8 ? 1 : e;
      c.c.lerpVectors(f.c, g.c, ee);
      c.ax.lerpVectors(f.ax, g.ax, ee).normalize();
      c.lat.lerpVectors(f.lat, g.lat, ee);
      if (c.lat.lengthSq() < 1e-4) c.lat.copy(g.lat);
      c.lat.normalize();
      c.th = f.th + (g.th - f.th) * ee;
      c.vis = g.vis > 0.5 || (f.vis > 0.5 && ee < 0.5) ? 1 : 0;
      tb.pinch.length = 0;
      tb.trail.amp = 0;
    }
    // ---- chiasmata pinch non-sister chromatids toward each other (prophase I → early anaphase I)
    this.chiList.length = 0;
    let chiStrength = 0;
    if (ph >= P.PRO1 && ph <= P.ANA1 && !S.fert) chiStrength = ph === P.ANA1 ? 1 - smooth(0.04, 0.3, pt / dur) : 1;
    if (chiStrength > 0.01) {
      for (let p = 0; p < 2; p++) for (const c of S.cross[p]) {
        const A = this.tubes[(2 * p) * 2 + c.m], B = this.tubes[(2 * p + 1) * 2 + c.p];
        const pa = this.v[0].copy(A.cur.c).addScaledVector(A.cur.ax, (c.x - 0.5) * A.L);
        const pb = this.v[1].copy(B.cur.c).addScaledVector(B.cur.ax, (c.x - 0.5) * B.L);
        const d = pa.distanceTo(pb);
        const k = chiStrength * (1 - smooth(9, 16, d));
        if (k < 0.01) continue;
        const mid = this.v[2].lerpVectors(pa, pb, 0.5);
        const inner = c.m === 1 && c.p === 0;
        if (!inner) mid.addScaledVector(this.v[3].crossVectors(A.cur.lat, A.cur.ax).normalize(), -R0 * 2.3);
        A.pinch.push({ u: c.x, v: new THREE.Vector3().subVectors(mid, pa).multiplyScalar(k * 0.94) });
        B.pinch.push({ u: c.x, v: new THREE.Vector3().subVectors(mid, pb).multiplyScalar(k * 0.94) });
        this.chiList.push({ p, c, A, B, k });
      }
    }
    // ---- anaphase: arms trail behind the kinetochore
    if ((ph === P.ANA1 || ph === P.ANA2) && !this.engine.reducedMotion) {
      const amp = 3.6 * Math.sin(Math.PI * clamp(e, 0, 1));
      for (const tb of this.tubes) {
        if (tb.t >= 8) continue;
        const tr = tb.trail;
        if (ph === P.ANA1) { tr.x = -Math.sign(tb.cur.c.x) || 0; tr.y = 0; tr.z = 0; }
        else { tr.x = 0; tr.y = -Math.sign(tb.cur.c.y) || 0; tr.z = 0; }
        tr.amp = amp;
      }
    }
    for (const tb of this.tubes) this.updateTube(tb, cam);

    // ---- cells
    for (let i = 0; i < 4; i++) {
      const C = this.cells[i], tg = this.cellTarget(i, ph, { c: this.v[4].set(0, 0, 0), r: 0, vis: 0 });
      const ee = S.fert ? 1 : e;
      C.cur.c.lerpVectors(C.from.c, tg.c, ee); C.cur.r = C.from.r + (tg.r - C.from.r) * ee;
      C.cur.vis = tg.vis > 0.5 || (C.from.vis > 0.5 && ee < 0.98) ? 1 : 0;
      C.mesh.visible = C.cur.vis > 0.5;
      C.mesh.position.copy(C.cur.c); C.mesh.scale.setScalar(C.cur.r);
    }
    // egg
    const F = S.fert;
    this.egg.visible = !!F;
    if (F) { this.eggCentre(this.egg.position); this.egg.scale.setScalar(30); }
    // callose wall (plants only): around the meiocyte, then the dyad, then the tetrad
    const plant = S.org === "plant";
    this.wall.visible = plant && !F;
    if (this.wall.visible) {
      const w = ph <= P.ANA1 ? [46, 46, 46] : ph <= P.ANA2 ? [62, 34, 34] : [52, 42, 24];
      this.wallCur.lerpVectors(this.wallFrom, this.v[0].set(...w), e);
      this.wall.scale.copy(this.wallCur);
    }
    this.updateDivision(ph, e);
    this.updateNuclei(ph, e);
    this.updateCohesin(ph, e, pt, dur);
    this.updateSC(ph, pt, dur);
    this.updateChiasmata(t);
    this.updateSpindles(ph, e);
    if (!this.engine.reducedMotion) this.specks.rotation.y = t * 0.01;
  }

  updateTube(tb, cam) {
    const S = this.S, c = tb.cur, mesh = tb.mesh;
    mesh.visible = c.vis > 0.5;
    for (const l of tb.letters) l.sp.visible = false;
    if (!mesh.visible) return;
    // colours (re-painted only when the chromatid's bins change)
    const bins = tb.t < 8 ? S.ch[tb.k][tb.s] : S.fert?.parts2.find((q) => q.p === tb.p)?.bins;
    if (!bins) { mesh.visible = false; return; }
    if (bins !== tb.bins) { tb.bins = bins; this.paint(tb); }
    const L = tb.L, R = R0 * c.th, cl = tb.cl, cen = CEN[tb.p];
    const pos = mesh.geometry.attributes.position.array, nor = mesh.geometry.attributes.normal.array;
    const tr = tb.trail, den = Math.max(cen, 1 - cen);
    for (let i = 0; i <= SEG; i++) {
      const u = U[i];
      let x = c.c.x + c.ax.x * (u - 0.5) * L, y = c.c.y + c.ax.y * (u - 0.5) * L, z = c.c.z + c.ax.z * (u - 0.5) * L;
      for (const pc of tb.pinch) { const w = Math.exp(-(((u - pc.u) / 0.085) ** 2)); x += pc.v.x * w; y += pc.v.y * w; z += pc.v.z * w; }
      if (tr.amp) { const w = tr.amp * ((u - cen) / den) ** 2; x += tr.x * w; y += tr.y * w; z += tr.z * w; }
      cl[i * 3] = x; cl[i * 3 + 1] = y; cl[i * 3 + 2] = z;
    }
    const t = this.v[0], n0 = this.v[1], b = this.v[2];
    const rad = (u) => {
      const tip = Math.min(u, 1 - u) * L / R, cap = tip >= 1 ? 1 : Math.sqrt(Math.max(0, 1 - (1 - tip) * (1 - tip)));
      return R * cap * (1 - 0.4 * Math.exp(-(((u - cen) / 0.024) ** 2)));
    };
    for (let i = 0; i <= SEG; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(SEG, i + 1);
      t.set(cl[i1 * 3] - cl[i0 * 3], cl[i1 * 3 + 1] - cl[i0 * 3 + 1], cl[i1 * 3 + 2] - cl[i0 * 3 + 2]);
      const ds = t.length() || 1e-6;
      t.multiplyScalar(1 / ds);
      n0.copy(c.lat).addScaledVector(t, -c.lat.dot(t));
      if (n0.lengthSq() < 1e-6) n0.set(0, 0, 1).addScaledVector(t, -t.z);
      n0.normalize();
      b.crossVectors(t, n0);
      const u = U[i], r = rad(u), dr = (rad(U[i1]) - rad(U[i0])) / ds;
      for (let j = 0; j <= RAD; j++) {
        const a = (j / RAD) * TAU, ca = Math.cos(a), sa = Math.sin(a);
        const nx = n0.x * ca + b.x * sa, ny = n0.y * ca + b.y * sa, nz = n0.z * ca + b.z * sa;
        const bump = 1 + 0.045 * Math.sin(u * L * 2.3 + j * 1.9) * Math.cos(u * L * 1.1 - j);
        const o = (i * (RAD + 1) + j) * 3;
        pos[o] = cl[i * 3] + nx * r * bump; pos[o + 1] = cl[i * 3 + 1] + ny * r * bump; pos[o + 2] = cl[i * 3 + 2] + nz * r * bump;
        let mx = nx - t.x * dr, my = ny - t.y * dr, mz = nz - t.z * dr;
        const ml = Math.hypot(mx, my, mz) || 1;
        nor[o] = mx / ml; nor[o + 1] = my / ml; nor[o + 2] = mz / ml;
      }
    }
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.attributes.normal.needsUpdate = true;
    // hover highlight
    const H = this.hover;
    const hi = H && ((H.type === "pair" && tb.p === H.id && tb.t < 8) || (H.type === "chrom" && tb.k === H.id) || (H.type === "gamete" && tb.t < 8 && this.gameteOf(tb) === H.id));
    mesh.material = hi ? this.hiMat : this.bodyMat;
    // allele letters, nudged toward the camera so they sit on the surface
    if (this.showLetters && c.th > 0.5) {
      for (const l of tb.letters) {
        const i = l.i, P0 = this.v[3].set(cl[i * 3], cl[i * 3 + 1], cl[i * 3 + 2]);
        const toCam = this.v[4].subVectors(cam.position, P0).normalize();
        l.sp.position.copy(P0).addScaledVector(toCam, R * 1.05 + 0.25);
        const o = bins[Math.min(N - 1, Math.floor(l.pos * N))];
        const letter = alleleAt(o, l.gene, this.S.p2chroms);
        l.sp.material = this.letterMats[letter];
        l.sp.scale.setScalar(2.5 * c.th + 0.2);
        l.sp.visible = true;
      }
    }
  }
  gameteOf(tb) { const d = this.S.dest[tb.k][tb.s]; return d.side * 2 + d.half; }

  paint(tb) {
    const col = tb.mesh.geometry.attributes.color.array, bins = tb.bins, cen = CEN[tb.p];
    const c = new THREE.Color(), band = new THREE.Color("#1d1235"), white = new THREE.Color("#ffffff"), cenC = new THREE.Color("#e9d5ff");
    const pal = {}; for (const k of Object.keys(COL)) pal[k] = new THREE.Color(COL[k]);
    for (let i = 0; i <= SEG; i++) {
      const u = U[i];
      c.copy(pal[bins[Math.min(N - 1, Math.floor(u * N))]]);
      // subtle G-band-like texture
      c.multiplyScalar(0.86 + 0.14 * hash(Math.floor(u * 34) + tb.p * 50));
      for (const l of LOCI[tb.p]) if (Math.abs(u - l.pos) < 0.026) c.lerp(band, 0.62);
      if (Math.abs(u - cen) < 0.02) c.lerp(cenC, 0.35);
      if (u < 0.015 || u > 0.985) c.lerp(white, 0.35);
      for (let j = 0; j <= RAD; j++) { const o = (i * (RAD + 1) + j) * 3; col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b; }
    }
    tb.mesh.geometry.attributes.color.needsUpdate = true;
  }
  repaintAll() { for (const tb of this.tubes) tb.bins = null; }

  /** point on a tube's current centreline at index i */
  clPoint(tb, i, out) { return out.set(tb.cl[i * 3], tb.cl[i * 3 + 1], tb.cl[i * 3 + 2]); }

  updateCohesin(ph, e, pt, dur) {
    const S = this.S, inst = this.cohesin, M = this.m4, X = this.v[0], Y = this.v[1], Z = this.v[2], pa = this.v[3], pb = this.v[4];
    let si = 0;
    const hideAll = !!S.fert || ph >= P.TEL2;
    for (let r = 0; r < this.rings.length; r++) {
      const ring = this.rings[r];
      const A = this.tubes[ring.k * 2], B = this.tubes[ring.k * 2 + 1];
      let s = 0;
      if (!hideAll && ph >= P.S && A.mesh.visible && B.mesh.visible) {
        s = 1;
        if (ph === P.S) s = smooth(ring.u * 0.8, ring.u * 0.8 + 0.15, e);          // laid down as the forks pass
        const cut = ring.cen && S.err.sgo !== false ? P.ANA2 : P.ANA1;
        if (ph === cut) s *= 1 - smooth(0.02, 0.22, pt / dur);
        else if (ph > cut) s = 0;
      }
      this.clPoint(A, ring.i, pa); this.clPoint(B, ring.i, pb);
      X.subVectors(pb, pa); const dist = X.length();
      if (dist > R0 * 4.2 || dist < 1e-3) s = 0;
      if (s < 0.02) { inst.setMatrixAt(r, M.makeScale(0, 0, 0)); continue; }
      X.multiplyScalar(1 / dist);
      Z.set(A.cl[Math.min(SEG, ring.i + 1) * 3] - A.cl[Math.max(0, ring.i - 1) * 3], A.cl[Math.min(SEG, ring.i + 1) * 3 + 1] - A.cl[Math.max(0, ring.i - 1) * 3 + 1], A.cl[Math.min(SEG, ring.i + 1) * 3 + 2] - A.cl[Math.max(0, ring.i - 1) * 3 + 2]).normalize();
      Y.crossVectors(Z, X).normalize(); X.crossVectors(Y, Z);
      const R = R0 * A.cur.th, w = (dist / 2 + R * 1.02) * s, h = R * (ring.cen ? 0.86 : 1.06) * s;
      M.makeBasis(X.multiplyScalar(w), Y.multiplyScalar(h), Z.multiplyScalar(ring.cen ? 3.2 : 2.2));
      M.setPosition(pa.lerp(pb, 0.5));
      inst.setMatrixAt(r, M);
      // shugoshin caps on the centromeric ring (Year 11–12, while protecting)
      if (ring.cen && si < 8) {
        const show = this.showSgo && S.err.sgo !== false && ph >= P.PRO1 && ph <= P.MET2 ? (ph === P.MET2 ? 1 - e : 1) : 0;
        const ys = Y.normalize();
        for (const sgn of [1, -1]) {
          if (si >= 8) break;
          this.sc.copy(pa).addScaledVector(ys, sgn * h * 1.05);
          this.sgoMesh.setMatrixAt(si++, M.compose(this.sc, this.q.identity(), this.v[0].setScalar(Math.max(0.0001, show * s))));
        }
      }
    }
    while (si < 8) this.sgoMesh.setMatrixAt(si++, M.makeScale(0, 0, 0));
    inst.instanceMatrix.needsUpdate = true;
    this.sgoMesh.instanceMatrix.needsUpdate = true;
  }

  updateSC(ph, pt, dur) {
    const S = this.S, M = this.m4, pa = this.v[0], pb = this.v[1], d = this.v[2], mid = this.v[3];
    const prev = (this._prev ||= new THREE.Vector3()), up = (this._up ||= new THREE.Vector3(0, 1, 0)), tmp = (this._tmp ||= new THREE.Vector3());
    let zip = 0;
    if (!S.fert && ph === P.PRO1) zip = smooth(0.22, 0.8, pt / dur);
    else if (!S.fert && ph === P.DIP) zip = 1 - smooth(0.0, 0.45, pt / dur);
    S.zip = ph === P.PRO1 ? zip : ph > P.PRO1 ? 1 : 0;
    const n = RUNG_U.length;
    for (let p = 0; p < 2; p++) {
      const A = this.tubes[(2 * p) * 2 + 1], B = this.tubes[(2 * p + 1) * 2 + 0];
      let havePrev = false;
      for (let j = 0; j < n; j++) {
        const u = RUNG_U[j], idx = p * n + j;
        const dj = Math.min(u, 1 - u) * 2;
        let on = ph === P.PRO1 ? (dj <= zip * 1.04 ? 1 : 0) : zip;
        const i = iOf(u);
        this.clPoint(A, i, pa); this.clPoint(B, i, pb);
        d.subVectors(pb, pa);
        const len = d.length(), R = R0 * A.cur.th;
        if (len > 4 * R + 3 || zip <= 0.01) on = 0;
        if (on < 0.02) { this.scRungs.setMatrixAt(idx, M.makeScale(0, 0, 0)); this.scCentral.setMatrixAt(idx, M.makeScale(0, 0, 0)); havePrev = false; continue; }
        d.multiplyScalar(1 / len);
        const a = this.sc.copy(pa).addScaledVector(d, R * 0.7), span = Math.max(0.05, len - 1.4 * R);
        this.q.setFromUnitVectors(up, d);
        this.scRungs.setMatrixAt(idx, M.compose(a, this.q, tmp.set(0.17 * on, span, 0.17 * on)));
        mid.lerpVectors(pa, pb, 0.5);
        if (havePrev) {
          const seg = tmp.subVectors(mid, prev), sl = seg.length() || 1e-3;
          this.q.setFromUnitVectors(up, seg.multiplyScalar(1 / sl));
          this.scCentral.setMatrixAt(idx, M.compose(prev, this.q, this.sc.set(0.3 * on, sl, 0.3 * on)));
        } else this.scCentral.setMatrixAt(idx, M.makeScale(0, 0, 0));
        prev.copy(mid); havePrev = true;
      }
    }
    this.scRungs.instanceMatrix.needsUpdate = true;
    this.scCentral.instanceMatrix.needsUpdate = true;
  }

  updateChiasmata(t) {
    const M = this.m4;
    for (let i = 0; i < 6; i++) {
      const c = this.chiList[i];
      if (!c) { this.chiMesh.setMatrixAt(i, M.makeScale(0, 0, 0)); this.chiHalo[i].visible = false; continue; }
      const ii = iOf(c.c.x);
      const p = this.clPoint(c.A, ii, this.v[0]).lerp(this.clPoint(c.B, ii, this.v[1]), 0.5);
      const s = Math.max(0.0001, c.k);
      this.chiMesh.setMatrixAt(i, M.compose(p, this.q.identity(), this.sc.setScalar(s)));
      this.chiHalo[i].visible = true;
      this.chiHalo[i].position.copy(p);
      this.chiHalo[i].material.opacity = 0.55 * c.k * (this.engine.reducedMotion ? 1 : 0.8 + 0.2 * Math.sin(t * 3 + i));
      c.pos = p.clone();
    }
    this.chiMesh.instanceMatrix.needsUpdate = true;
  }

  /** pole positions: 0,1 = meiosis I (left, right); 2..5 = meiosis II (cell side*2 + half) */
  polePos(i, out) {
    if (i < 2) return out.set(i ? MI_POLE_X : -MI_POLE_X, 0, 0);
    const side = (i - 2) >> 1, half = (i - 2) & 1;
    return out.set((side ? 1 : -1) * DYAD_X, half ? -MII_POLE_Y : MII_POLE_Y, 0);
  }

  updateSpindles(ph, e) {
    const S = this.S, M = this.m4, plant = S.org === "plant";
    const a1 = S.fert ? 0 : ph === P.DIP ? smooth(0.3, 1, e) : ph === P.MET1 || ph === P.ANA1 ? 1 : ph === P.TEL1 ? 1 - smooth(0, 0.6, e) : 0;
    const a2 = S.fert ? 0 : ph === P.MET2 ? smooth(0, 0.7, e) : ph === P.ANA2 ? 1 : ph === P.TEL2 ? 1 - smooth(0, 0.6, e) : 0;
    let nf = 0;
    const seg = (A, B, grow, r) => {
      if (nf >= this.MAXF || grow < 0.02) return;
      const d = this.v[3].subVectors(B, A), len = d.length() * grow;
      if (len < 0.05) return;
      this.q.setFromUnitVectors(this.v[4].set(0, 1, 0), d.normalize());
      this.fibres.setMatrixAt(nf++, M.compose(A, this.q, this.sc.set(r, len, r)));
    };
    const pole = this.v[0], kin = this.v[1], tmp = this.v[2];
    // poles
    for (let i = 0; i < 6; i++) {
      const g = this.poles[i], a = i < 2 ? a1 : a2;
      g.visible = a > 0.02 && !(i >= 2 && false);
      if (!g.visible) continue;
      this.polePos(i, g.position);
      g.scale.setScalar(0.3 + 0.7 * a);
      g.userData.centrioles.forEach((c) => (c.visible = !plant));
      g.userData.glow.scale.set(plant ? 16 : 9, plant ? 5 : 9, 1);
      g.userData.glow.material.opacity = (plant ? 0.55 : 0.85) * a;
      if (i < 2 && plant) g.position.x *= 0.92;
    }
    // kinetochores + kinetochore fibres
    let nk = 0;
    const showK = (a1 > 0.02 || a2 > 0.02) && !S.fert;
    for (const tb of this.tubes) {
      if (tb.t >= 8) continue;
      const d = S.dest[tb.k][tb.s];
      let pi = -1, a = 0;
      if (a1 > 0.02 && ph <= P.TEL1) { pi = d.side; a = a1; }
      else if (a2 > 0.02 && ph >= P.MET2) { pi = 2 + d.side * 2 + d.half; a = a2; }
      if (!showK || pi < 0 || !tb.mesh.visible) continue;
      const ci = iOf(CEN[tb.p]);
      this.clPoint(tb, ci, kin);
      this.polePos(pi, pole);
      if (pi < 2 && plant) pole.x *= 0.92;
      const dir = tmp.subVectors(pole, kin).normalize();
      kin.addScaledVector(dir, R0 * tb.cur.th * 0.75);
      this.q.setFromUnitVectors(this.v[4].set(0, 1, 0), dir);
      this.kineto.setMatrixAt(nk++, M.compose(kin, this.q, this.sc.set(0.95, 1, 0.95)));
      for (let f = 0; f < 3; f++) {
        const off = this.v[4].set(hash(tb.t * 7 + f) - 0.5, hash(tb.t * 3 + f * 5) - 0.5, hash(tb.t + f * 11) - 0.5).multiplyScalar(plant ? 9 : 2.2);
        const P0 = this.v[2].copy(pole).add(off);
        const K0 = this.sc.copy(kin).addScaledVector(this.v[4].set(f - 1, (f % 2) - 0.5, 0), 0.45);
        seg(P0, K0.clone(), a, 0.13);
      }
    }
    for (let i = nk; i < 10; i++) this.kineto.setMatrixAt(i, M.makeScale(0, 0, 0));
    this.kineto.instanceMatrix.needsUpdate = true;
    // interpolar (overlapping) microtubules and asters
    const spindle = (pA, pB, a) => {
      const axis = this.v[2].subVectors(pB, pA), L = axis.length();
      axis.normalize();
      const side1 = Math.abs(axis.y) < 0.9 ? new THREE.Vector3(0, 1, 0).cross(axis).normalize() : new THREE.Vector3(1, 0, 0);
      const side2 = new THREE.Vector3().crossVectors(axis, side1);
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * TAU + 0.3, rr = (plant ? 0.5 : 0.36) * L;
        const mid = new THREE.Vector3().copy(pA).addScaledVector(axis, L * 0.5).addScaledVector(side1, Math.cos(ang) * rr).addScaledVector(side2, Math.sin(ang) * rr);
        const from = i % 2 ? pA : pB, over = new THREE.Vector3().copy(mid).addScaledVector(axis, i % 2 ? L * 0.08 : -L * 0.08);
        seg(from.clone(), mid, a, 0.1);
        seg(mid.clone(), over, a, 0.1);
      }
      if (!plant) for (const P0 of [pA, pB]) for (let i = 0; i < 7; i++) {
        const out = new THREE.Vector3().subVectors(P0, i % 2 ? pB : pA);
        if (P0 === pA) out.copy(pA).sub(pB); else out.copy(pB).sub(pA);
        out.normalize().multiplyScalar(6).add(side1.clone().multiplyScalar(Math.cos(i * 0.9) * 5)).add(side2.clone().multiplyScalar(Math.sin(i * 0.9) * 5));
        seg(P0.clone(), P0.clone().add(out), a, 0.08);
      }
    };
    if (a1 > 0.02) {
      const L = this.polePos(0, new THREE.Vector3()), R = this.polePos(1, new THREE.Vector3());
      if (plant) { L.x *= 0.92; R.x *= 0.92; }
      spindle(L, R, a1);
    }
    if (a2 > 0.02) for (let side = 0; side < 2; side++) spindle(this.polePos(2 + side * 2, new THREE.Vector3()), this.polePos(3 + side * 2, new THREE.Vector3()), a2);
    this.fibres.count = nf;
    this.fibres.instanceMatrix.needsUpdate = true;
    // metaphase plates
    const p0 = this.plates[0], mI = ph === P.MET1 && !S.fert ? smooth(0.3, 1, e) : 0, mII = ph === P.MET2 && !S.fert ? smooth(0.3, 1, e) : 0;
    p0.visible = mI > 0.02;
    if (p0.visible) { p0.position.set(0, 0, 0); p0.rotation.set(0, Math.PI / 2, 0); p0.scale.setScalar(CELL_R * 0.86); p0.material.opacity = 0.5 * mI; }
    for (let i = 1; i < 3; i++) {
      const pl = this.plates[i];
      pl.visible = mII > 0.02;
      if (pl.visible) { pl.position.set((i === 2 ? 1 : -1) * DYAD_X, 0, 0); pl.rotation.set(Math.PI / 2, 0, 0); pl.scale.setScalar(DYAD_R * 0.86); pl.material.opacity = 0.5 * mII; }
    }
    this.spindleA = [a1, a2];
  }

  updateDivision(ph, e) {
    const S = this.S, plant = S.org === "plant";
    for (const m of this.furrows) m.visible = false;
    for (const m of this.cellPlates) m.visible = false;
    if (S.fert) return;
    const pairs = ph === P.TEL1 ? [[0, 2]] : ph === P.TEL2 ? [[0, 1], [2, 3]] : [];
    pairs.forEach(([a, b], i) => {
      const A = this.cells[a].cur, B = this.cells[b].cur;
      if (!this.cells[a].mesh.visible || !this.cells[b].mesh.visible) return;
      const mid = this.v[0].lerpVectors(A.c, B.c, 0.5), dir = this.v[1].subVectors(B.c, A.c);
      const half = dir.length() / 2;
      if (half < 0.01) return;
      dir.normalize();
      const r = Math.min(A.r, B.r), neck = Math.sqrt(Math.max(0, r * r - half * half));
      this.q.setFromUnitVectors(this.v[2].set(0, 0, 1), dir);
      if (plant) {
        const m = this.cellPlates[i];
        m.visible = e < 0.999 || ph === P.TEL1 || ph === P.TEL2;
        m.position.copy(mid); m.quaternion.copy(this.q); m.scale.setScalar(Math.max(0.01, Math.min(neck, r * smooth(0.05, 0.9, e)) * 0.98));
      } else if (neck > 0.3) {
        const m = this.furrows[i];
        m.visible = true; m.position.copy(mid); m.quaternion.copy(this.q); m.scale.setScalar(neck);
      }
    });
  }

  updateNuclei(ph, e) {
    const S = this.S;
    const set = (i, c, r, a) => {
      const m = this.nuclei[i];
      m.visible = a > 0.02;
      if (!m.visible) return;
      m.position.copy(c); m.scale.setScalar(r); m.material.opacity = a;
    };
    for (let i = 0; i < 4; i++) this.nuclei[i].visible = false;
    if (S.fert) {
      const F = S.fert;
      if (F.t > 0.85) set(0, this.v[0].set(0, -1, 0), 26, smooth(0.85, 1, F.t));
      return;
    }
    if (ph <= P.PRO1) set(0, this.v[0].set(0, 0, 0), NUC_R, 1);
    else if (ph === P.DIP) set(0, this.v[0].set(0, 0, 0), NUC_R, 1 - smooth(0.1, 0.6, e));
    else if (ph === P.TEL1) for (let s = 0; s < 2; s++) set(s, this.v[0].set((s ? 1 : -1) * DYAD_X, 0, 0), 17, smooth(0.6, 1, e));
    else if (ph === P.MET2) for (let s = 0; s < 2; s++) set(s, this.v[0].set((s ? 1 : -1) * DYAD_X, 0, 0), 17, 1 - smooth(0, 0.4, e));
    else if (ph === P.TEL2 || ph === P.DONE) for (let g = 0; g < 4; g++) set(g, this.tetCentre(g, this.v[0]), 12.5, ph === P.DONE ? 1 : smooth(0.6, 1, e));
  }

  // ---------------------------------------------------------------- interaction helpers
  /** bivalent axis point / u from a world point (prophase I) */
  bivFrame(p) {
    const A = this.tubes[(2 * p) * 2 + 1].cur, B = this.tubes[(2 * p + 1) * 2].cur;
    const c = new THREE.Vector3().lerpVectors(A.c, B.c, 0.5);
    return { c, ax: A.ax.clone(), L: LEN[p] * SC };
  }
  uFromPoint(p, pt) { const f = this.bivFrame(p); return pt.clone().sub(f.c).dot(f.ax) / f.L + 0.5; }
  /** u along bivalent p under a screen point: intersect the ray with the plane through the bivalent facing the camera */
  uFromRay(p, ray) {
    ray = ray.ray || ray;
    const f = this.bivFrame(p), cam = this.engine.camera;
    const n = new THREE.Vector3().subVectors(cam.position, f.c);
    n.addScaledVector(f.ax, -n.dot(f.ax)).normalize();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, f.c);
    const hit = ray.intersectPlane(plane, new THREE.Vector3());
    if (!hit) return null;
    return hit.sub(f.c).dot(f.ax) / f.L + 0.5;
  }
  /** the bivalent (and u along it) nearest a picking ray, if the ray passes close to one */
  nearBivalent(ray) {
    ray = ray.ray || ray;            // accepts a Raycaster or a Ray
    let best = null;
    for (let p = 0; p < 2; p++) {
      const f = this.bivFrame(p), cam = this.engine.camera;
      const n = new THREE.Vector3().subVectors(cam.position, f.c);
      n.addScaledVector(f.ax, -n.dot(f.ax)).normalize();
      const hit = ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(n, f.c), new THREE.Vector3());
      if (!hit) continue;
      const rel = hit.sub(f.c), along = rel.dot(f.ax), lat = rel.addScaledVector(f.ax, -along).length();
      const u = along / f.L + 0.5;
      if (u < -0.03 || u > 1.03 || lat > 4 * R0 + 3) continue;
      if (!best || lat < best.lat) best = { p, u, lat };
    }
    return best;
  }
  showGhost(p, u) {
    if (p == null) { this.ghost.visible = false; return; }
    const f = this.bivFrame(p);
    this.ghost.visible = true;
    this.ghost.position.copy(f.c).addScaledVector(f.ax, (u - 0.5) * f.L);
    this.q.setFromUnitVectors(this.v[0].set(0, 0, 1), f.ax);
    this.ghost.quaternion.copy(this.q);
    this.ghost.scale.setScalar(4 * R0 + 2.6);
    return this.ghost.position;
  }
  /** world position of a chromosome's centromere (for labels) */
  centromere(k, out) { const tb = this.tubes[k * 2]; return this.clPoint(tb, iOf(CEN[tb.p]), out); }
  tubeEnd(t, u, out) { const tb = this.tubes[t]; return this.clPoint(tb, iOf(u), out); }

  dispose() {
    for (const m of Object.values(this.letterMats)) { m.map.dispose(); m.dispose(); }
  }
}
