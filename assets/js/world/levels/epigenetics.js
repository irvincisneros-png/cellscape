// Level: Epigenetics (Phase 5e). Three views in one root, like the immune level:
//   1 Marks & memory  (1 unit = 10 nm)  a 20-nucleosome stretch around a promoter, driven by a Dodd-Sneppen-inspired teaching model (epigeneticsModel.js)
//   2 X-inactivation  nucleus (1 unit = 0.15 µm: nucleus 9 µm across, Barr body about 1 µm) and a clonal cell sheet (1 unit = 1 µm, stylised)
//   3 Environment     an experiment bench: vernalisation, agouti mouse, Himalayan rabbit (a NON-epigenetic contrast) and twins
// The 3D parts only draw what the model says; every enzyme visit is one of the model's actual state changes.
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import * as K from "../../kit.js";
import { physical, glass, softDot, hash, paint, wobble } from "../materials.js";
import {
  MarkSim, N_CPG, TX_MIN, KARYOTYPES, barrBodies, Mosaic, hexSheet, vernThresholds, vernOffFraction, vernFraction, flowerWeeks, VERN,
  mulberry32, agoutiLitter, agoutiProbs, agoutiMean, AGOUTI_CLASSES, tyrActivity, furDark, rabbitMap, TWIN, twinDraws, twinPatterns, twinExpected,
} from "./epigeneticsModel.js";
import { VIEWS, NOTE, BLURB, ENV_EXAMPLES, EVIDENCE, PARTS, HERITABLE, MISSIONS, QUIZ, narrative } from "./epigeneticsContent.js";

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const NN = 20;                                         // nucleosomes in the marks view
const DNA_COL = "#d6c4f3", ACETYL = "#bef264", METHYL = "#e879f9", MRNA_COL = "#60a5fa";
const X_COLS = [["#f9a8d4", "#9d174d"], ["#93c5fd", "#1e40af"], ["#c4b5fd", "#5b21b6"]];   // maternal, paternal, extra
const R_NUC = 30;                                      // nucleus radius in the X view (units of 0.15 µm: 9 µm across)
const SHEET_S = 12;                                    // cell pitch in the mosaic sheet (1 unit = 1 µm)

const CSS = `
.epi-her { width: 100%; border-collapse: collapse; font-size: 0.8rem; margin: 6px 0; }
.epi-her th, .epi-her td { text-align: left; padding: 5px 6px; border-bottom: 1px solid var(--panel-border); vertical-align: top; }
.epi-her th { color: var(--ink-faint); font-weight: 600; font-size: 0.74rem; }
.epi .legend span { margin-right: 10px; white-space: nowrap; }
.epi .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: -1px; }
.epi .subhead { font-weight: 600; font-size: 0.84rem; margin: 10px 0 4px; color: var(--ink); }
.epi .ev { font-size: 0.82rem; line-height: 1.5; color: var(--ink-dim); }
.epi .hint.warn { color: var(--ink); }
.epi button[disabled] { opacity: 0.5; cursor: default; }
.epi-link { background: none; border: 0; padding: 0; color: var(--accent, #4fd1c5); cursor: pointer; text-decoration: underline; font: inherit; }
`;

// ===================================================================================================================
// geometry helpers
// ===================================================================================================================
/** A tube through control points that is updated in place every frame (no allocation). */
class DynTube {
  constructor(nCtrl, sub, ring, vertexColors = false) {
    this.n = nCtrl; this.sub = sub; this.ring = ring;
    this.ns = (nCtrl - 1) * sub + 1;
    const nv = this.ns * (ring + 1);
    this.pos = new Float32Array(nv * 3); this.nor = new Float32Array(nv * 3);
    this.centre = new Float32Array(this.ns * 3);
    this.radius = new Float32Array(this.ns).fill(0.1);
    const idx = [];
    for (let i = 0; i < this.ns - 1; i++) for (let j = 0; j < ring; j++) { const a = i * (ring + 1) + j, b = a + ring + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry();
    g.setIndex(idx);
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("normal", new THREE.BufferAttribute(this.nor, 3).setUsage(THREE.DynamicDrawUsage));
    if (vertexColors) { this.col = new Float32Array(nv * 3); g.setAttribute("color", new THREE.BufferAttribute(this.col, 3)); }
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 400);
    this.geo = g;
    this.t = new THREE.Vector3(); this.nv = new THREE.Vector3(); this.bv = new THREE.Vector3();
  }
  /** colour per sample: fn(sampleIndex, THREE.Color) */
  paintSamples(fn) {
    const c = new THREE.Color();
    for (let i = 0; i < this.ns; i++) { fn(i, c); for (let j = 0; j <= this.ring; j++) { const o = (i * (this.ring + 1) + j) * 3; this.col[o] = c.r; this.col[o + 1] = c.g; this.col[o + 2] = c.b; } }
    this.geo.attributes.color.needsUpdate = true;
  }
  update(pts) {
    const { n, sub, ns, ring, centre: c } = this;
    for (let s = 0; s < n - 1; s++) {
      const p0 = pts[Math.max(s - 1, 0)], p1 = pts[s], p2 = pts[s + 1], p3 = pts[Math.min(s + 2, n - 1)];
      for (let k = 0; k < sub; k++) {
        const t = k / sub, t2 = t * t, t3 = t2 * t, o = (s * sub + k) * 3;
        c[o] = 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
        c[o + 1] = 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
        c[o + 2] = 0.5 * (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3);
      }
    }
    const last = pts[n - 1], ol = (ns - 1) * 3; c[ol] = last.x; c[ol + 1] = last.y; c[ol + 2] = last.z;
    const { t, nv, bv } = this;
    for (let i = 0; i < ns; i++) {
      const i0 = Math.max(0, i - 1) * 3, i1 = Math.min(ns - 1, i + 1) * 3;
      t.set(c[i1] - c[i0], c[i1 + 1] - c[i0 + 1], c[i1 + 2] - c[i0 + 2]);
      if (t.lengthSq() < 1e-10) t.set(1, 0, 0);
      t.normalize();
      if (i === 0) { nv.set(0, 0, 1); if (Math.abs(t.z) > 0.9) nv.set(1, 0, 0); }
      nv.addScaledVector(t, -nv.dot(t));
      if (nv.lengthSq() < 1e-8) { nv.set(0, 1, 0).addScaledVector(t, -t.y); }
      nv.normalize(); bv.crossVectors(t, nv);
      const r = this.radius[i];
      for (let j = 0; j <= ring; j++) {
        const a = (j / ring) * TAU, cx = Math.cos(a), sx = Math.sin(a), o = (i * (ring + 1) + j) * 3;
        const x = nv.x * cx + bv.x * sx, y = nv.y * cx + bv.y * sx, z = nv.z * cx + bv.z * sx;
        this.pos[o] = c[i * 3] + x * r; this.pos[o + 1] = c[i * 3 + 1] + y * r; this.pos[o + 2] = c[i * 3 + 2] + z * r;
        this.nor[o] = x; this.nor[o + 1] = y; this.nor[o + 2] = z;
      }
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.normal.needsUpdate = true;
  }
  /** point on the centreline at fractional control position cp (0..n-1) */
  at(cp, out) {
    const f = clamp(cp, 0, this.n - 1) * this.sub, i = Math.min(Math.floor(f), this.ns - 2), w = f - i, c = this.centre;
    return out.set(lerp(c[i * 3], c[i * 3 + 3], w), lerp(c[i * 3 + 1], c[i * 3 + 4], w), lerp(c[i * 3 + 2], c[i * 3 + 5], w));
  }
}

const sphereGeo = (r, x, y, z, color, sx = 1, sy = 1, sz = 1, seg = 12) => { const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4)); g.scale(sx, sy, sz); g.translate(x, y, z); return paint(g, color); };

/** Nucleosome: DNA wrapped 1.65 turns around a histone octamer (H3 #818cf8, H4 #34d399, H2A #fbbf24, H2B #fb7185) with four flexible tails. */
const TAIL_TIPS = [[0.7, 0.3, 0.34], [-0.66, 0.34, -0.34], [0.24, -0.72, 0.32], [-0.32, -0.66, -0.3]].map((a) => new THREE.Vector3(...a));
function nucleosomeGeo() {
  const parts = [], turns = 1.65, R = 0.43, H = 0.46;
  const wrap = new THREE.Curve();
  wrap.getPoint = (t, out = new THREE.Vector3()) => { const a = (t - 0.5) * turns * TAU; return out.set(R * Math.cos(a), R * Math.sin(a), (t - 0.5) * H); };
  parts.push(paint(new THREE.TubeGeometry(wrap, 90, 0.1, 10), DNA_COL));
  const cols = ["#818cf8", "#34d399", "#fbbf24", "#fb7185"];
  for (let k = 0; k < 8; k++) {
    const layer = k < 4 ? 1 : -1, a = ((k % 4) / 4) * TAU + (layer > 0 ? 0 : Math.PI / 4);
    const g = new THREE.IcosahedronGeometry(0.19, 2);
    g.translate(Math.cos(a) * 0.19, Math.sin(a) * 0.19, layer * 0.12);
    parts.push(paint(wobble(g, 0.012, 9, k), cols[k % 4]));
  }
  for (const tip of TAIL_TIPS) {
    const c = new THREE.QuadraticBezierCurve3(tip.clone().multiplyScalar(0.35), new THREE.Vector3(tip.x * 0.85, tip.y * 0.65, tip.z * 1.25), tip.clone());
    parts.push(paint(new THREE.TubeGeometry(c, 10, 0.03, 5), "#c7d2fe"));
  }
  return mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
}
const lumpGeo = (r, amp, seed, detail = 2) => { let g = new THREE.IcosahedronGeometry(r, detail); g.deleteAttribute("uv"); g.deleteAttribute("normal"); g = mergeVertices(g); return wobble(g, amp, 3.1, seed); };
function enzymeGeo() {
  const mk = (r, x, y, z, s) => { const g = lumpGeo(r, r * 0.16, s, 2); g.translate(x, y, z); return g.index ? g.toNonIndexed() : g; };
  return mergeGeometries([mk(0.5, 0, 0, 0, 1), mk(0.33, 0.45, 0.22, 0.05, 2), mk(0.3, -0.34, -0.36, 0.2, 3)]);
}
function polGeo() {
  const mk = (r, x, y, z, sx, sy, sz, s) => { const g = lumpGeo(r, r * 0.12, s, 2); g.scale(sx, sy, sz); g.translate(x, y, z); return g.index ? g.toNonIndexed() : g; };
  return mergeGeometries([mk(0.78, 0, 0.1, 0, 1, 0.9, 1, 4), mk(0.46, 0.65, 0.5, 0, 1, 1, 1, 5), mk(0.42, -0.55, 0.62, 0.1, 1, 1, 1.1, 6), mk(0.34, 0, -0.62, 0.15, 1.2, 0.9, 1, 7)]);
}
/** Radial outline of a rounded polygonal cell (a softened hexagon), unit circumradius. */
function outlineR(th) {
  const a = ((((th + Math.PI / 6) % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3)) - Math.PI / 6;
  return lerp(1, 0.866 / Math.cos(a), 0.55);
}
/** A soft cushion-shaped cell (domed, steep skirt) with darker vertex colour toward the edge (cheap ambient occlusion). */
function cellGeo() {
  const NA = 40, NR = 8, pos = [], col = [], idx = [];
  for (let j = 0; j <= NR; j++) {
    const rho = j / NR, dome = Math.pow(Math.max(0, 1 - Math.pow(rho, 2.8)), 0.5), shade = 0.62 + 0.38 * dome;
    for (let k = 0; k < NA; k++) {
      const th = (k / NA) * TAU, r = rho * outlineR(th);
      pos.push(Math.cos(th) * r, 0.55 * dome, Math.sin(th) * r); col.push(shade, shade, shade);
    }
  }
  const skirt = (NR + 1) * NA;
  for (let k = 0; k < NA; k++) { const th = (k / NA) * TAU, r = outlineR(th); pos.push(Math.cos(th) * r, -0.3, Math.sin(th) * r); col.push(0.45, 0.45, 0.45); }
  for (let j = 0; j < NR; j++) for (let k = 0; k < NA; k++) { const a = j * NA + k, b = j * NA + ((k + 1) % NA), c = (j + 1) * NA + k, d = (j + 1) * NA + ((k + 1) % NA); idx.push(a, b, c, b, d, c); }
  for (let k = 0; k < NA; k++) { const a = NR * NA + k, b = NR * NA + ((k + 1) % NA), c = skirt + k, d = skirt + ((k + 1) % NA); idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** A cell nucleus: a lumpy sphere with a darker nucleolus and chromatin speckles (instance colour tints it). */
function nucleusGeo() {
  const parts = [paint(wobble(new THREE.SphereGeometry(1, 20, 14), 0.05, 2.4, 7), "#ffffff")];
  const dark = (r, x, y, z, c) => paint(new THREE.SphereGeometry(r, 10, 8).translate(x, y, z), c);
  parts.push(dark(0.3, 0.36, 0.2, 0.52, "#6b6b6b"), dark(0.16, -0.5, 0.45, 0.4, "#9a9a9a"), dark(0.14, -0.2, -0.55, 0.6, "#9a9a9a"), dark(0.12, 0.62, -0.3, 0.3, "#8a8a8a"));
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
}
/** A thin plant cell wall: an annulus around the cell outline with outer and inner walls. */
function wallGeo() {
  const NA = 40, pos = [], idx = [];
  const ring = (rk, y) => { for (let k = 0; k < NA; k++) { const th = (k / NA) * TAU, r = outlineR(th) * rk; pos.push(Math.cos(th) * r, y, Math.sin(th) * r); } return pos.length / 3 - NA; };
  const oT = ring(1.0, 0.42), oB = ring(1.0, -0.3), iT = ring(0.85, 0.42), iB = ring(0.85, 0.1);
  const quad = (A, B, flip) => { for (let k = 0; k < NA; k++) { const n = (k + 1) % NA, a = A + k, b = A + n, c = B + k, d = B + n; flip ? idx.push(a, b, c, b, d, c) : idx.push(a, c, b, b, c, d); } };
  quad(oT, iT, true); quad(oT, oB, false); quad(iT, iB, true);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

/** Physical material with instance colour as a rim-lit glow (translucent, fresnel look). */
function glowMat(base, { rim = 0.5, glow = 0 } = {}) {
  const m = new THREE.MeshPhysicalMaterial({ roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.3, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color("#ffffff"), ...base });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
      #ifdef USE_INSTANCING_COLOR
      { float fr = pow(1.0 - clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0), 2.4);
        totalEmissiveRadiance += vColor * (fr * ${rim.toFixed(3)} + ${glow.toFixed(3)}); }
      #endif`);
  };
  m.customProgramCacheKey = () => `epiGlow${rim}_${glow}`;
  return m;
}

/** An instanced field of organic, softly irregular cells (jittered, varied in size, randomly rotated; ≤ about 300). */
const CELLG = cellGeo(), NUCG = nucleusGeo();

/** LOD ordering: the engine keeps the FIRST k instances at lower tiers, so write instance i to slot spreadSlot(i, n, stride) and the survivors stay
 *  evenly spread (a golden-ratio stride, coprime with n) instead of leaving a bare patch where the cut-off instances were. */
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
function strideFor(n) { let s = Math.max(1, Math.round(n * 0.618034)); while (gcd(s, n) !== 1) s++; return s; }
const spreadSlot = (i, n, stride) => (i * stride) % n;
class HexField {
  constructor(cap, bodyMat, nucMat, kind, { plant = false, ghost = false, seed = 1 } = {}) {
    this.cap = cap; this.n = 0; this.R = 1; this.hy = 0.9; this.plant = plant; this.seed = seed; this.bodyK = plant ? 0.84 : 1;
    this.body = new THREE.InstancedMesh(CELLG, bodyMat, cap);
    this.nuc = new THREE.InstancedMesh(NUCG, nucMat, cap);
    const parts = [this.body, this.nuc];
    if (plant) {
      this.wall = new THREE.InstancedMesh(wallGeo(), glowMat({ color: "#ffffff", roughness: 0.6, side: THREE.DoubleSide }, { rim: 0.2, glow: 0.05 }), cap);
      this.vac = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), glowMat({ color: "#ffffff", transparent: true, opacity: 0.38, depthWrite: false }, { rim: 0.8, glow: 0.05 }), cap);
      this.chl = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6).scale(1.5, 0.7, 1), physical("#2f9e44", { emissive: new THREE.Color("#1f7a34"), emissiveIntensity: 0.35, roughness: 0.4 }), cap * 4);
      parts.push(this.wall, this.vac, this.chl);
      this.chl.userData.lod = true;                // chloroplasts are decoration (4 per cell, laid out so a cut keeps 1-4 per cell, never none)
      this.wall.userData.clayHide = false;
    }
    for (const m of [this.body, this.nuc]) { m.userData.kind = kind; m.setColorAt(0, new THREE.Color()); }
    for (const m of parts) { m.frustumCulled = false; m.count = 0; }
    this.body.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 5000); this.nuc.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 5000);
    if (plant) { for (let i = 0; i < cap; i++) { this.wall.setColorAt(i, new THREE.Color("#d9e8a8")); this.vac.setColorAt(i, new THREE.Color("#a5d8ff")); } }
    this.group = new THREE.Group(); this.group.add(...parts);
    if (ghost) {
      this.ghost = new THREE.InstancedMesh(CELLG, new THREE.MeshBasicMaterial({ color: "#7b8cc8", transparent: true, opacity: 0.09, depthWrite: false }), cap);
      this.ghost.frustumCulled = false; this.ghost.userData.clayHide = true; this.group.add(this.ghost);
    }
    this.px = new Float32Array(cap * 3); this.sc = new Float32Array(cap); this.tgt = new Float32Array(cap);
    this.rot = new Float32Array(cap); this.sx = new Float32Array(cap); this.sz = new Float32Array(cap); this.noff = new Float32Array(cap * 2);
    this.ysc = new Float32Array(cap).fill(1);
    this.ns = new Float32Array(cap).fill(0.34); this.nlift = 0.5;
    this.bc = new Float32Array(cap * 3); this.bt = new Float32Array(cap * 3); this.nc = new Float32Array(cap * 3); this.nt = new Float32Array(cap * 3);
    this.tmp = new THREE.Color(); this.dirty = true; this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3(); this.Y = new THREE.Vector3(0, 1, 0);
  }
  layout(cells, pitch, R, y = 0, jitter = 0.14) {
    this.n = cells.length; this.R = R;
    this.stride = strideFor(Math.max(1, this.n));
    for (let i = 0; i < cells.length; i++) {
      const h = (k) => hash(i * 12.9898 + k * 78.233 + this.seed * 3.1);
      this.px[i * 3] = cells[i].x * pitch + (h(1) - 0.5) * jitter * pitch; this.px[i * 3 + 1] = y; this.px[i * 3 + 2] = -cells[i].y * pitch + (h(2) - 0.5) * jitter * pitch;
      this.rot[i] = h(3) * TAU; this.sx[i] = 0.86 + h(4) * 0.2; this.sz[i] = 0.86 + h(5) * 0.2;
      const a = h(6) * TAU, d = this.plant ? 0.42 : 0.14 * h(7); this.noff[i * 2] = Math.cos(a) * d; this.noff[i * 2 + 1] = Math.sin(a) * d;
    }
    for (const m of [this.body, this.nuc, this.wall, this.vac]) if (m) m.count = this.n;
    if (this.chl) { this.chl.count = this.chl.userData.lodCount = this.n * 4; }
    if (this.ghost) {
      this.ghost.count = this.ghost.userData.lodCount = this.n;
      this.ghost.userData.lod = true;              // faint footprint under each cell: decoration only
      for (let i = 0; i < this.n; i++) { this.q.setFromAxisAngle(this.Y, this.rot[i]); this.ghost.setMatrixAt(spreadSlot(i, this.n, this.stride), this.m4.compose(this.v.set(this.px[i * 3], this.px[i * 3 + 1] - 0.9, this.px[i * 3 + 2]), this.q, this.s.set(R * this.sx[i], R * 0.12, R * this.sz[i]))); }
      this.ghost.instanceMatrix.needsUpdate = true;
    }
    this.dirty = true;
  }
  setBody(i, hex, snap = false) { this.tmp.set(hex); this.bt[i * 3] = this.tmp.r; this.bt[i * 3 + 1] = this.tmp.g; this.bt[i * 3 + 2] = this.tmp.b; if (snap) { this.bc[i * 3] = this.tmp.r; this.bc[i * 3 + 1] = this.tmp.g; this.bc[i * 3 + 2] = this.tmp.b; } }
  setNuc(i, hex, snap = false) { this.tmp.set(hex); this.nt[i * 3] = this.tmp.r; this.nt[i * 3 + 1] = this.tmp.g; this.nt[i * 3 + 2] = this.tmp.b; if (snap) { this.nc[i * 3] = this.tmp.r; this.nc[i * 3 + 1] = this.tmp.g; this.nc[i * 3 + 2] = this.tmp.b; } }
  show(i, on, snap = false) { this.tgt[i] = on ? 1 : 0; if (snap) this.sc[i] = this.tgt[i]; }
  update(dt, t, wob = 0) {
    const k = 1 - Math.exp(-dt * 6), kc = 1 - Math.exp(-dt * 3.5);
    let ch = this.dirty; this.dirty = false;
    for (let i = 0; i < this.n; i++) {
      const d = this.tgt[i] - this.sc[i];
      if (Math.abs(d) > 0.002) { this.sc[i] += d * k * (d > 0 ? 1.3 : 1); ch = true; }
      for (let c = 0; c < 3; c++) {
        const o = i * 3 + c;
        const db = this.bt[o] - this.bc[o]; if (Math.abs(db) > 0.002) { this.bc[o] += db * kc; ch = true; }
        const dn = this.nt[o] - this.nc[o]; if (Math.abs(dn) > 0.002) { this.nc[o] += dn * kc; ch = true; }
      }
    }
    if (!ch && !wob) return;
    const R0 = this.R;
    for (let i = 0; i < this.n; i++) {
      const s = Math.max(0.0001, this.sc[i]), w = wob ? 1 + Math.sin(t * 1.1 + i * 0.7) * wob : 1, R = R0 * s * w, ys = this.ysc[i];
      this.q.setFromAxisAngle(this.Y, this.rot[i]);
      const px = this.px[i * 3], py = this.px[i * 3 + 1], pz = this.px[i * 3 + 2], sx = R * this.sx[i], sz = R * this.sz[i], sy = R * this.hy * ys;
      this.body.setMatrixAt(i, this.m4.compose(this.v.set(px, py, pz), this.q, this.s.set(sx * this.bodyK, sy, sz * this.bodyK)));
      const ox = this.noff[i * 2] * R, oz = this.noff[i * 2 + 1] * R, top = sy * this.nlift * (this.plant ? 0.75 : 1);
      const ns = R0 * this.ns[i] * s;
      this.nuc.setMatrixAt(i, this.m4.compose(this.v.set(px + ox, py + top + ns * 0.35, pz + oz), this.q, this.s.set(ns, ns * 0.8, ns)));
      this.tmp.setRGB(this.bc[i * 3], this.bc[i * 3 + 1], this.bc[i * 3 + 2]); this.body.setColorAt(i, this.tmp);
      this.tmp.setRGB(this.nc[i * 3], this.nc[i * 3 + 1], this.nc[i * 3 + 2]); this.nuc.setColorAt(i, this.tmp);
      if (this.plant) {
        this.wall.setMatrixAt(i, this.m4.compose(this.v.set(px, py, pz), this.q, this.s.set(sx, sy, sz)));
        this.vac.setMatrixAt(i, this.m4.compose(this.v.set(px - ox * 0.5, py + sy * 0.28, pz - oz * 0.5), this.q, this.s.set(sx * 0.5, sy * 0.3, sz * 0.5)));
        for (let c = 0; c < 4; c++) {
          const a = i * 1.7 + c * 1.57 + 0.6, rr = 0.62;
          this.chl.setMatrixAt(c * this.n + i, this.m4.compose(this.v.set(px + Math.cos(a) * sx * rr * this.bodyK, py + sy * 0.22, pz + Math.sin(a) * sz * rr * this.bodyK), this.q, this.s.setScalar(R0 * 0.1 * s)));
        }
      }
    }
    this.body.boundingSphere = this.nuc.boundingSphere = null;   // moving instances: recompute for picking
    this.body.instanceMatrix.needsUpdate = this.nuc.instanceMatrix.needsUpdate = true;
    this.body.instanceColor.needsUpdate = this.nuc.instanceColor.needsUpdate = true;
    if (this.plant) { this.wall.instanceMatrix.needsUpdate = this.vac.instanceMatrix.needsUpdate = this.chl.instanceMatrix.needsUpdate = true; this.wall.instanceColor.needsUpdate = this.vac.instanceColor.needsUpdate = true; }
  }
}

// ===================================================================================================================
export function create(engine) {
  if (!document.getElementById("epi-css")) { const st = document.createElement("style"); st.id = "epi-css"; st.textContent = CSS; document.head.appendChild(st); }
  const lens = engine.lens;
  const root = new THREE.Group(), pickables = [];
  const tE = new THREE.Euler(), PINK2 = new THREE.Color("#ec4899"), WHITE = new THREE.Color("#ffffff"), tM = new THREE.Matrix4(), tV = new THREE.Vector3(), tV2 = new THREE.Vector3(), tV3 = new THREE.Vector3(), tQ = new THREE.Quaternion(), tS = new THREE.Vector3(), tC = new THREE.Color();
  const tag = (o, kind, extra = {}) => { Object.assign(o.userData, { kind }, extra); return o; };
  const addPick = (o, kind, extra) => { tag(o, kind, extra); pickables.push(o); return o; };
  const inst = (geo, mat, n, kind, pick = true) => {
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.frustumCulled = false;
    for (let i = 0; i < n; i++) m.setMatrixAt(i, tM.makeScale(0, 0, 0));
    m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -6, 0), 5000);          // fixed: instances move every frame, so picking must not use a stale sphere
    if (kind) { tag(m, kind); if (pick) pickables.push(m); }
    return m;
  };
  const setI = (mesh, i, pos, quat, s) => mesh.setMatrixAt(i, tM.compose(pos, quat || tQ.identity(), tS.setScalar(Math.max(s, 0.00001))));
  const state = { view: "marks", xScene: "nucleus", ex: "vern", busy: false, labels: true };
  const S = { sim: null, xDone: false, xBarr: 0, kt: "XX", pred: {}, predictXXY: false, mosaicDone: false, vernMax: 0, vernWarmed: false, agoutiMaxBrown: 0, rabbitDone: false, rabbitWhy: false };
  const narrow = () => engine.w < 760;
  const seed = () => (Math.random() * 4294967295) >>> 0;

  const gM = new THREE.Group(), gXA = new THREE.Group(), gXB = new THREE.Group(), gE = new THREE.Group();
  root.add(gM, gXA, gXB, gE);

  // ===================================================================================================================
  // VIEW 1: marks and memory
  // ===================================================================================================================
  const sim = new MarkSim({ N: NN, F: 12, seed: seed(), start: "A" });
  S.sim = sim;
  let readerSys = "hp1", speed = 0.8, settle = 0, repSys = "hp1", forkT = -1, spawnCool = 0;
  const shown = new Int8Array(NN).fill(1);
  const va = new Float32Array(NN).fill(1), vm = new Float32Array(NN), vc = new Float32Array(NN), vr = new Float32Array(NN);
  const A = [], P = [], Tn = [], N1 = [], ZA = [];
  for (let i = 0; i < NN; i++) { A.push(new THREE.Vector3()); P.push(new THREE.Vector3()); Tn.push(new THREE.Vector3()); N1.push(new THREE.Vector3()); ZA.push(new THREE.Vector3()); }
  const NM = Array.from({ length: NN }, () => new THREE.Matrix4());

  const nucMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.34, clearcoat: 0.85, clearcoatRoughness: 0.2, sheen: 0.5, sheenRoughness: 0.5, sheenColor: new THREE.Color("#e0e7ff"), emissive: new THREE.Color("#6d28d9"), emissiveIntensity: 0.06 });
  const nucs = inst(nucleosomeGeo(), nucMat, NN, "nucleosome"); gM.add(nucs);
  const acetylM = inst(new THREE.SphereGeometry(0.095, 12, 9), physical(ACETYL, { emissive: new THREE.Color("#a3e635"), emissiveIntensity: 0.7, roughness: 0.25 }), NN * 4, "acetyl"); gM.add(acetylM);
  const methylM = inst(new THREE.SphereGeometry(0.115, 12, 9), physical(METHYL, { emissive: new THREE.Color("#c026d3"), emissiveIntensity: 0.9, roughness: 0.3 }), NN * 4, "methyl"); gM.add(methylM);
  const readerMat = glowMat({ color: "#ffffff", transparent: true, opacity: 0.92 }, { rim: 0.5, glow: 0.12 });
  const readers = inst(lumpGeo(0.32, 0.05, 4), readerMat, NN, "reader"); gM.add(readers);
  const dnaTube = new DynTube(3 * NN + 2, 6, 8);
  dnaTube.radius.fill(0.105);
  const dnaMat = physical(DNA_COL, { roughness: 0.3, emissive: new THREE.Color("#a855f7"), emissiveIntensity: 0.18 });
  const dnaMesh = addPick(new THREE.Mesh(dnaTube.geo, dnaMat), "dna"); dnaMesh.frustumCulled = false; gM.add(dnaMesh);
  const ctrl = Array.from({ length: 3 * NN + 2 }, () => new THREE.Vector3());

  // CpG sites (8) with halos
  const cpgM = inst(new THREE.SphereGeometry(0.14, 12, 9), physical("#f472b6", { emissive: new THREE.Color("#ec4899"), emissiveIntensity: 1.0, roughness: 0.3 }), N_CPG, "cpg"); gM.add(cpgM);
  const cpgDot = inst(new THREE.SphereGeometry(0.06, 8, 6), physical("#94a3b8", { roughness: 0.5 }), N_CPG, "cpg"); gM.add(cpgDot);
  const cpgPos = Array.from({ length: N_CPG }, () => new THREE.Vector3());
  const halo = (color, op) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); s.userData.clayHide = true; return s; };
  const cpgHalo = Array.from({ length: N_CPG }, () => { const s = halo("#f472b6", 0); gM.add(s); return s; });

  // enzymes (writers / erasers), RNA pol II, mRNA, transcription factors, replication fork
  const ENZ_COL = { hat: "#a3e635", hdac: "#fb923c", hmt: "#d946ef", kdm: "#22d3ee" };
  const ENZ_NAME = { hat: "HAT (writer: adds acetyl)", hdac: "HDAC (eraser: removes acetyl)", hmt: "HMT / PRC2 (writer: adds methyl)", kdm: "KDM (eraser: removes methyl)" };
  const enzMat = glowMat({ color: "#ffffff", transparent: true, opacity: 0.93 }, { rim: 0.6, glow: 0.18 });
  const NENZ = 14;
  const enzM = inst(enzymeGeo(), enzMat, NENZ, "enzyme"); gM.add(enzM);
  const enz = Array.from({ length: NENZ }, () => ({ on: false, i: 0, to: 0, kind: "hat", t: 0, flipped: false, p0: new THREE.Vector3(), cur: new THREE.Vector3(), q: new THREE.Quaternion() }));
  const polMat = glowMat({ color: "#ffffff" }, { rim: 0.4, glow: 0.1 });
  const polM = inst(polGeo(), polMat, 2, "pol"); gM.add(polM);
  const pols = [{ on: false, u: 10, sc: 0 }, { on: false, u: 10, sc: 0 }];
  const NB = 8, mrnaM = inst(new THREE.SphereGeometry(0.16, 10, 8), physical(MRNA_COL, { emissive: new THREE.Color("#3b82f6"), emissiveIntensity: 0.9, roughness: 0.3 }), 8 * 8, "mrna"); gM.add(mrnaM);
  const released = Array.from({ length: 6 }, () => ({ on: false, life: 0, p: new THREE.Vector3(), v: new THREE.Vector3() }));
  const tfMat = glowMat({ color: "#ffffff", transparent: true, opacity: 0.95 }, { rim: 0.6, glow: 0.3 });
  const tfM = inst(lumpGeo(0.5, 0.07, 9), tfMat, 2, "tf"); gM.add(tfM);
  const tfPos = [new THREE.Vector3(), new THREE.Vector3()];
  const forkS = halo("#fef08a", 0); forkS.userData.clayHide = true; gM.add(forkS);
  const evq = [];
  for (const m of [enzM, tfM]) { for (let i = 0; i < m.count; i++) m.setColorAt(i, WHITE); }
  for (let i = 0; i < 2; i++) polM.setColorAt(i, tC.set("#f59e0b"));
  const setReaderColor = () => { for (let i = 0; i < NN; i++) readers.setColorAt(i, tC.set(repSys === "prc2" ? "#2dd4bf" : "#7dd3fc")); readers.instanceColor.needsUpdate = true; };
  setReaderColor();

  // crowding: soft protein blobs and dust
  const NCR = 150;
  const crowdG = wobble(new THREE.SphereGeometry(1, 14, 10), 0.09, 2.3, 5);
  const crowd = inst(crowdG, glowMat({ color: "#ffffff", transparent: true, opacity: 0.17, depthWrite: false }, { rim: 0.5, glow: 0.03 }), NCR, null); gM.add(crowd);
  crowd.userData.lod = true;                         // background crowding blobs (random positions): fewer still reads as a crowded cell
  const crowdDef = [];
  {
    const pal = ["#6366f1", "#8b5cf6", "#38bdf8", "#14b8a6", "#a78bfa", "#60a5fa"];
    for (let i = 0; i < NCR; i++) {
      crowdDef.push({ x: (hash(i * 1.7) - 0.5) * 80, y: -7 + (hash(i * 2.3) - 0.5) * 56, z: -9 - hash(i * 7.9) * 26, s: 0.28 + Math.pow(hash(i * 4.1), 2) * 0.95, ph: hash(i * 6.1) * TAU, rot: [hash(i) * 6, hash(i + 5) * 6, hash(i + 9) * 6] });
      crowd.setColorAt(i, tC.set(pal[i % pal.length]).multiplyScalar(0.55));
    }
  }
  const dust = (() => {
    const n = 200, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (hash(i * 1.3) - 0.5) * 90; pos[i * 3 + 1] = -7 + (hash(i * 2.9) - 0.5) * 50; pos[i * 3 + 2] = -26 + hash(i * 4.3) * 40; }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.5, map: softDot(), color: "#a5b4fc", transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    p.userData.clayHide = true; return p;
  })();
  gM.add(dust);

  const KAPPA = 0.115, SA = new Float32Array(NN);
  function tangS(sv, out) { const a = -KAPPA * sv + 0.1 * Math.sin(0.3 * sv); return out.set(Math.cos(a), Math.sin(a), 0.2 * Math.sin(0.4 * sv + 0.5)).normalize(); }
  const sp = (i) => lerp(2.05, 0.55, (vc[clamp(i, 0, NN - 1)] + vc[clamp(i + 1, 0, NN - 1)]) / 2);
  function layoutChain(t) {
    const s9 = sp(9);
    SA[9] = -s9 / 2; SA[10] = s9 / 2;
    for (let i = 10; i < NN - 1; i++) SA[i + 1] = SA[i] + sp(i);
    for (let i = 9; i > 0; i--) SA[i - 1] = SA[i] - sp(i - 1);
    tangS(0, tV); A[9].copy(tV).multiplyScalar(-s9 / 2); A[10].copy(tV).multiplyScalar(s9 / 2);
    for (let i = 10; i < NN - 1; i++) A[i + 1].copy(A[i]).addScaledVector(tangS((SA[i] + SA[i + 1]) / 2, tV), sp(i));
    for (let i = 9; i > 0; i--) A[i - 1].copy(A[i]).addScaledVector(tangS((SA[i] + SA[i - 1]) / 2, tV), -sp(i - 1));
    for (let i = 0; i < NN; i++) {
      tangS(SA[i], Tn[i]);
      const T = Tn[i];
      N1[i].crossVectors(T, tV2.set(0, 0, 1)); if (N1[i].lengthSq() < 1e-6) N1[i].set(0, 1, 0); N1[i].normalize();
      tV2.crossVectors(T, N1[i]);                                    // n2
      const c = vc[i], psi = i * 1.05 + (engine.reducedMotion ? 0 : Math.sin(t * 0.4 + i) * 0.04);
      const zig = (i & 1 ? 1 : -1) * 0.34 * (1 - c);
      P[i].copy(A[i]).addScaledVector(N1[i], zig + Math.cos(psi) * 1.35 * c).addScaledVector(tV2, Math.sin(psi) * 1.35 * c);
      // disc axis: perpendicular to the chain when open (DNA enters and leaves at the side), along it when stacked
      const rot = i * 2.4;
      ZA[i].copy(N1[i]).multiplyScalar(Math.cos(rot)).addScaledVector(tV2, Math.sin(rot)).lerp(T, 0.85 * c).normalize();
    }
  }
  function placeNucleosomes(t) {
    for (let i = 0; i < NN; i++) {
      const z = ZA[i], T = Tn[i];
      tV.copy(T).addScaledVector(z, -T.dot(z)); if (tV.lengthSq() < 1e-6) tV.copy(N1[i]); tV.normalize();
      tV2.crossVectors(z, tV);
      NM[i].makeBasis(tV, tV2, z).setPosition(P[i]);
      nucs.setMatrixAt(i, NM[i]);
    }
    nucs.instanceMatrix.needsUpdate = true;
    // DNA tube control points: stub, then in / centre / out per nucleosome, then stub
    ctrl[0].copy(P[0]).addScaledVector(Tn[0], -2.4);
    for (let i = 0; i < NN; i++) {
      const prev = P[Math.max(i - 1, 0)], next = P[Math.min(i + 1, NN - 1)];
      tV.subVectors(next, prev); if (tV.lengthSq() < 1e-6) tV.copy(Tn[i]); tV.normalize();
      const off = lerp(0.5, 0.22, vc[i]);
      ctrl[1 + 3 * i].copy(P[i]).addScaledVector(tV, -off);
      ctrl[2 + 3 * i].copy(P[i]);
      ctrl[3 + 3 * i].copy(P[i]).addScaledVector(tV, off);
    }
    ctrl[3 * NN + 1].copy(P[NN - 1]).addScaledVector(Tn[NN - 1], 2.4);
    dnaTube.update(ctrl);
  }
  const tailWorld = (i, j, out, k = 1) => out.copy(TAIL_TIPS[j]).multiplyScalar(k).applyMatrix4(NM[i]);

  function enzKind(from, to) { return to > from ? (to === 1 ? "hat" : "kdm") : (from === 1 ? "hdac" : "hmt"); }
  function queueEvents() {
    if (!sim.events.length) return;
    for (const e of sim.events) {
      if (e.kind === "replication") evq.push({ i: e.i, to: e.to, kind: "rep", delay: forkDelay(e.i) });
      else { if (evq.length > 24) { const d = evq.shift(); cancelNuc(d.i); } evq.push({ i: e.i, to: e.to, from: e.from, kind: e.kind, src: e.src, delay: 0 }); }
    }
    sim.events.length = 0;
  }
  const forkDelay = (i) => 0.15 + i * 0.07;
  /** a replication or queue truncation invalidates the chain of visits to a nucleosome: cancel them and sync it explicitly */
  function cancelNuc(i) {
    for (let k = 0; k < NENZ; k++) if (enz[k].on && enz[k].i === i) enz[k].on = false;
    for (let q = 0; q < evq.length; q++) if (evq[q].i === i && evq[q].kind !== "rep") evq[q].dead = true;
    shown[i] = sim.s[i];
  }
  const nucBusy = (i) => { for (let k = 0; k < NENZ; k++) if (enz[k].on && enz[k].i === i) return true; return false; };
  const anyEnz = () => { for (let k = 0; k < NENZ; k++) if (enz[k].on) return true; return false; };
  function spawnEnzymes(dt) {
    spawnCool -= dt;
    for (let q = evq.length - 1; q >= 0; q--) { const e = evq[q]; if (e.dead) { evq.splice(q, 1); continue; } if (e.delay > 0) { e.delay -= dt; continue; } if (e.kind === "rep") { cancelNuc(e.i); evq.splice(q, 1); } }
    if (spawnCool > 0) return;
    for (let q = 0; q < evq.length; q++) {
      const e = evq[q];
      if (e.kind === "rep" || e.dead || nucBusy(e.i)) continue;               // one visit per nucleosome at a time, so a stale completion can't overwrite newer state
      const z = enz.find((x) => !x.on);
      if (!z) { shown[e.i] = sim.s[e.i]; evq.splice(q, 1); return; }
      z.on = true; z.i = e.i; z.to = e.to; z.from = e.from; z.kind = enzKind(e.from, e.to); z.t = 0; z.flipped = false;
      tV.set(hash(sim.t * 7 + e.i) - 0.5, (hash(sim.t * 3 + e.i * 5) - 0.5) * 0.8 + (hash(e.i + 3) < 0.5 ? 0.9 : -0.9), hash(sim.t * 5 + e.i * 2) * 0.6 + 0.4).normalize();
      if (e.kind === "signal") z.p0.copy(tfPos[e.src === "act" ? 0 : 1]);
      else z.p0.copy(P[e.i]).addScaledVector(tV, 7 + hash(e.i * 9 + sim.t) * 3);
      enzM.setColorAt(enz.indexOf(z), tC.set(ENZ_COL[z.kind]));
      enzM.instanceColor.needsUpdate = true;
      evq.splice(q, 1); spawnCool = 0.18; return;
    }
  }
  function animateEnzymes(dt, t) {
    for (let k = 0; k < NENZ; k++) {
      const z = enz[k];
      if (!z.on) { setI(enzM, k, tV, null, 0); continue; }
      z.t += dt / (engine.reducedMotion ? 0.3 : 1);
      tailWorld(z.i, k % 4, tV3, 1.3);
      let s = 1;
      if (z.t < 1.0) { const e = ease(z.t); z.cur.lerpVectors(z.p0, tV3, e); z.cur.x += Math.sin(t * 3 + k) * 0.25 * (1 - e); z.cur.y += Math.cos(t * 2.4 + k * 2) * 0.25 * (1 - e); s = 0.4 + 0.6 * e; }
      else if (z.t < 1.55) { z.cur.copy(tV3); s = 1 + 0.14 * Math.sin((z.t - 1) * 18); if (!z.flipped) { z.flipped = true; shown[z.i] = shown[z.i] === z.from ? z.to : sim.s[z.i]; } }   // own queued change, unless the chain was invalidated
      else if (z.t < 2.4) { const e = ease((z.t - 1.55) / 0.85); z.cur.lerpVectors(tV3, z.p0, e); s = 1 - 0.85 * e; }
      else { z.on = false; continue; }
      z.q.setFromAxisAngle(tV2.set(0.3, 1, 0.2).normalize(), t * 0.8 + k);
      setI(enzM, k, z.cur, z.q, 0.62 * s);
    }
    enzM.instanceMatrix.needsUpdate = true;
  }
  const NMARK_ON = (i, j, salt) => hash(i * 7.3 + j * 2.1 + salt) < 0.9;
  function marksAndReaders(dt) {
    const k = 1 - Math.exp(-dt * 4);
    for (let i = 0; i < NN; i++) {
      const s = shown[i];
      va[i] += ((s === 1 ? 1 : 0) - va[i]) * k; vm[i] += ((s === -1 ? 1 : 0) - vm[i]) * k;
      vc[i] += ((s === -1 ? 1 : s === 0 ? 0.28 : 0) - vc[i]) * (1 - Math.exp(-dt * 2.6));
      vr[i] += ((s === -1 ? 1 : 0) - vr[i]) * (1 - Math.exp(-dt * 2));
    }
  }
  function drawMarks(t) {
    for (let i = 0; i < NN; i++) {
      for (let j = 0; j < 4; j++) {
        tailWorld(i, j, tV, 1.02);
        setI(acetylM, i * 4 + j, tV, null, NMARK_ON(i, j, 1) ? va[i] : 0);
        tailWorld(i, j, tV, 1.02);
        setI(methylM, i * 4 + j, tV, null, NMARK_ON(i, j, 5) ? vm[i] : 0);
      }
      tailWorld(i, 0, tV, 1.0); tV2.copy(TAIL_TIPS[0]).transformDirection(NM[i]).multiplyScalar(0.34);
      tV.add(tV2);
      tQ.setFromAxisAngle(tV3.set(0, 1, 0), t * 0.3 + i);
      setI(readers, i, tV, tQ, vr[i] * (repSys === "prc2" ? 1.05 : 0.78));
    }
    acetylM.instanceMatrix.needsUpdate = methylM.instanceMatrix.needsUpdate = readers.instanceMatrix.needsUpdate = true;
  }
  function cpgSites() {
    for (let j = 0; j < N_CPG; j++) {
      const linker = 8 + Math.floor(j / 3), kk = 1 + 2 * (j % 3);
      const cp = 3 + 3 * linker + kk / 6;                      // between out(linker) and in(linker+1)
      dnaTube.at(cp, cpgPos[j]);
      tV.copy(cpgPos[j]); tV.z += 0.22; tV.y += 0.16;
      const st = sim.cpg[j], hemi = st === 2 || st === 3;       // 3 = maintenance failed, still hemi-methylated
      setI(cpgDot, j, tV, null, st === 0 ? 1 : 0);
      setI(cpgM, j, tV, null, st === 1 ? 1 : hemi ? 0.62 : 0);
      cpgHalo[j].position.copy(tV); cpgHalo[j].scale.setScalar(st ? 1.0 : 0.0001); cpgHalo[j].material.opacity = st === 1 ? 0.55 : hemi ? 0.28 : 0;
    }
    cpgM.instanceMatrix.needsUpdate = cpgDot.instanceMatrix.needsUpdate = true;
  }
  function transcription(dt, t) {
    const rate = sim.txRate;
    if (rate > TX_MIN && Math.random() < dt * rate * 0.7) { const p = pols.find((q) => !q.on); if (p) { p.on = true; p.u = 9.9; p.sc = 0; } }
    for (let k = 0; k < 2; k++) {
      const p = pols[k];
      if (!p.on) { setI(polM, k, tV, null, 0); for (let b = 0; b < NB; b++) setI(mrnaM, k * NB + b, tV, null, 0); continue; }
      p.u += dt * (0.9 + 0.8 * rate); p.sc = Math.min(1, p.sc + dt * 2);
      dnaTube.at(2 + 3 * p.u, tV); tV.z += 0.9; tV.y += 0.55;
      tQ.setFromAxisAngle(tV3.set(0.2, 1, 0.1).normalize(), t * 0.5);
      setI(polM, k, tV, tQ, p.sc * 0.95);
      for (let b = 0; b < NB; b++) {
        dnaTube.at(2 + 3 * (p.u - 0.4 * (b + 1)), tV2);
        tV2.x += Math.sin(t * 2 + b) * 0.08; tV2.y += 0.9 + 0.22 * b + Math.sin(t * 1.7 + b * 1.3) * 0.12; tV2.z += 1.05 + 0.15 * b;
        setI(mrnaM, k * NB + b, tV2, null, p.sc * (1 - b * 0.04));
      }
      if (p.u >= NN - 1.2) {
        p.on = false;
        const r = released.find((q) => !q.on);
        if (r) { r.on = true; r.life = 3.2; dnaTube.at(2 + 3 * p.u, r.p); r.p.z += 1.2; r.v.set(1.2, 3, 2.2); }
      }
    }
    for (let k = 0; k < 6; k++) {
      const r = released[k];
      for (let b = 0; b < NB; b++) {
        const idx = 16 + k * NB + b;
        if (!r.on) { setI(mrnaM, idx, tV, null, 0); continue; }
        if (b === 0) { r.life -= dt; r.p.addScaledVector(r.v, dt); if (r.life <= 0) r.on = false; }
        const f = Math.min(1, r.life / 1.2);
        tV.set(r.p.x - 0.5 * b + Math.sin(t * 2 + b) * 0.2, r.p.y + Math.sin(t * 1.5 + b * 0.8) * 0.3, r.p.z - 0.15 * b);
        setI(mrnaM, idx, tV, null, r.on ? f : 0);
      }
    }
    polM.instanceMatrix.needsUpdate = mrnaM.instanceMatrix.needsUpdate = true;
  }
  function factors(t) {
    for (let k = 0; k < 2; k++) {
      dnaTube.at(2 + 3 * 9.5, tV);
      tfPos[k].set(tV.x + (k ? 0.5 : -0.5), tV.y + (k ? 1.9 : -1.9), tV.z + 0.8);
      if (!engine.reducedMotion) tfPos[k].y += Math.sin(t * 2 + k * 3) * 0.08;
      tfM.setColorAt(k, tC.set(k ? "#818cf8" : ACETYL));
      setI(tfM, k, tfPos[k], null, (k ? sim.rep : sim.act) > 0.02 ? 0.45 + 0.7 * (k ? sim.rep : sim.act) : 0);
    }
    tfM.instanceMatrix.needsUpdate = true; tfM.instanceColor.needsUpdate = true;
  }
  function forkUpdate(dt) {
    if (forkT < 0) { forkS.material.opacity = 0; return; }
    forkT += dt;
    const u = forkT / 1.6;
    if (u >= 1) { forkT = -1; forkS.material.opacity = 0; return; }
    dnaTube.at(2 + 3 * (u * (NN - 1)), tV); forkS.position.copy(tV); forkS.scale.setScalar(6); forkS.material.opacity = 0.75 * Math.sin(u * Math.PI);
  }
  function crowdUpdate(t) {
    for (let i = 0; i < NCR; i++) {
      const d = crowdDef[i], w = engine.reducedMotion ? 0 : t;
      tV.set(d.x + Math.sin(w * 0.12 + d.ph) * 1.6, d.y + Math.cos(w * 0.1 + d.ph * 2) * 1.4, d.z + Math.sin(w * 0.09 + d.ph * 3) * 1.4);
      tQ.setFromEuler(tE.set(d.rot[0] + w * 0.03, d.rot[1] + w * 0.02, d.rot[2]));
      setI(crowd, i, tV, tQ, d.s);
    }
    crowd.instanceMatrix.needsUpdate = true; crowd.instanceColor.needsUpdate = true;
  }
  function syncShown() { for (let i = 0; i < NN; i++) shown[i] = sim.s[i]; evq.length = 0; for (const z of enz) z.on = false; for (let i = 0; i < NN; i++) { va[i] = shown[i] === 1 ? 1 : 0; vm[i] = shown[i] === -1 ? 1 : 0; vc[i] = shown[i] === -1 ? 1 : shown[i] === 0 ? 0.28 : 0; vr[i] = vm[i]; } }
  function updateMarks(dt, t) {
    if (dt > 0) {
      const rounds = settle > 0 ? Math.min(settle, 6 * dt) : speed * dt;
      sim.step(rounds);
      if (settle > 0) { settle = Math.max(0, settle - rounds); if (settle <= 1e-6) { settle = 0; sim.noteDivisionOutcome(); divBtn && (divBtn.disabled = false); } }
    }
    queueEvents();
    spawnEnzymes(dt);
    if (!evq.length && !anyEnz()) for (let i = 0; i < NN; i++) if (shown[i] !== sim.s[i]) shown[i] = sim.s[i];
    marksAndReaders(dt);
    layoutChain(t); placeNucleosomes(t); drawMarks(t); cpgSites(); animateEnzymes(dt, t); transcription(dt, t); factors(t); forkUpdate(dt); crowdUpdate(t);
    dnaMat.emissiveIntensity = 0.1 + 0.35 * sim.txRate;
    if (readerSys !== repSys) { readerSys = repSys; setReaderColor(); }
  }

  // ===================================================================================================================
  // VIEW 2: X-inactivation. Scene A: a nucleus. Scene B: a clonal mosaic sheet.
  // ===================================================================================================================
  const envShell = new THREE.Mesh(new THREE.SphereGeometry(R_NUC, 56, 40), glass("#a78bfa", { rim: "#c4b5fd", rimPower: 2.4, rimStrength: 0.55, minAlpha: 0.025, maxAlpha: 0.5 }));
  gXA.add(envShell);
  const nucleolus = new THREE.Mesh(wobble(new THREE.SphereGeometry(4.6, 28, 20), 0.5, 0.5, 2), physical("#7c5bb3", { transparent: true, opacity: 0.55, roughness: 0.5 }));
  nucleolus.position.set(-3, -2, -14); gXA.add(nucleolus);
  const haze = (() => {
    const n = 260, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const u = hash(i * 1.7) * 2 - 1, a = hash(i * 3.3) * TAU, r = Math.cbrt(hash(i * 5.1)) * (R_NUC - 2), s = Math.sqrt(1 - u * u); pos[i * 3] = r * s * Math.cos(a); pos[i * 3 + 1] = r * u; pos[i * 3 + 2] = r * s * Math.sin(a); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.9, map: softDot(), color: "#c4b5fd", transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })); p.userData.clayHide = true; return p;
  })();
  gXA.add(haze);

  const NP = 44;
  class Territory {
    constructor(kind, seedN, amp, ballR, banding) {
      this.kind = kind; this.tube = new DynTube(NP, 3, 8, true); this.tube.radius.fill(kind === "autosome" ? 0.55 : 0.78);
      this.loose = []; this.ball = []; this.pts = [];
      const ph = [hash(seedN) * TAU, hash(seedN + 1) * TAU, hash(seedN + 2) * TAU, hash(seedN + 3) * TAU, hash(seedN + 4) * TAU, hash(seedN + 5) * TAU];
      for (let p = 0; p < NP; p++) {
        const u = (p / (NP - 1)) * TAU;
        this.loose.push(new THREE.Vector3(amp * (0.62 * Math.sin(1.0 * u + ph[0]) + 0.28 * Math.sin(2.7 * u + ph[1]) + 0.1 * Math.sin(5 * u + ph[2])), amp * (0.62 * Math.sin(1.2 * u + ph[3]) + 0.3 * Math.sin(2.3 * u + ph[4])), amp * 0.8 * (0.6 * Math.sin(0.9 * u + ph[5]) + 0.3 * Math.sin(3.1 * u + ph[0]))));
        this.ball.push(new THREE.Vector3(ballR * Math.sin(7 * u + ph[0]) * (0.7 + 0.3 * Math.cos(3 * u)), ballR * Math.sin(8.3 * u + ph[1]) * 0.9, ballR * Math.cos(6.1 * u + ph[2])));
        this.pts.push(new THREE.Vector3());
      }
      this.centre = new THREE.Vector3(); this.home = new THREE.Vector3(); this.k = 0; this.cur = -1;
      this.mesh = new THREE.Mesh(this.tube.geo, kind === "autosome" ? autoMat : terrMat); this.mesh.frustumCulled = false;
      if (banding) { const [lt, dk] = banding; const L = new THREE.Color(lt), D = new THREE.Color(dk); this.tube.paintSamples((i, c) => { const b = hash(Math.floor(i / 5) * 3.7 + seedN); c.copy(L).lerp(D, b < 0.5 ? 0.0 : 0.3 + 0.5 * hash(Math.floor(i / 5) + seedN)); }); }
      else this.tube.paintSamples((i, c) => c.set("#64748b"));
      addPick(this.mesh, kind);
      this.glow = halo("#bef264", 0); this.glow.userData.clayHide = true; this.glow.visible = kind === "xa"; gXA.add(this.glow);
      gXA.add(this.mesh);
    }
    update(k, centre) {
      this.k = k; this.centre.copy(centre);
      for (let p = 0; p < NP; p++) this.pts[p].lerpVectors(this.loose[p], this.ball[p], k).add(centre);
      this.tube.update(this.pts);
    }
  }
  const terrMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.35, sheen: 0.5, sheenColor: new THREE.Color("#ffffff"), emissive: new THREE.Color("#4c1d95"), emissiveIntensity: 0.1 });
  const autoMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.6, transparent: true, opacity: 0.22, depthWrite: false });
  const HOME = [new THREE.Vector3(-10, 6, 3), new THREE.Vector3(9, -6, -4), new THREE.Vector3(-3, -13, 7), new THREE.Vector3(12, 11, 2)];
  const xTerr = [0, 1, 2].map((i) => new Territory("xa", 11 + i * 7, 7, 2.3, X_COLS[i]));
  const yTerr = new Territory("ycell", 41, 3.6, 1.5, ["#c4b5fd", "#6d28d9"]);
  const autos = [0, 1, 2, 3, 4].map((i) => { const a = new Territory("autosome", 60 + i * 5, 8, 2, ["#94a3b8", "#334155"]); a.home.set(Math.cos(i * 1.7 + 0.3) * 16, Math.sin(i * 2.3) * 14, Math.sin(i * 1.1) * 14); a.update(0, a.home); return a; });
  const NXI = 110;
  const xistM = inst(new THREE.SphereGeometry(0.22, 8, 6), physical("#22d3ee", { emissive: new THREE.Color("#06b6d4"), emissiveIntensity: 1.5 }), NXI * 2, "xist"); gXA.add(xistM);
  const k27M = inst(new THREE.SphereGeometry(0.15, 8, 6), physical(METHYL, { emissive: new THREE.Color("#c026d3"), emissiveIntensity: 1.1 }), 70 * 2, "xk27"); gXA.add(k27M);
  const dnamM = inst(new THREE.SphereGeometry(0.12, 8, 6), physical("#f472b6", { emissive: new THREE.Color("#ec4899"), emissiveIntensity: 0.9 }), 40 * 2, "xdna"); gXA.add(dnamM);
  const xistLoc = halo("#67e8f9", 0); gXA.add(xistLoc);
  const xs = { kt: "XX", active: 0, phase: "none", t: 0, inactive: [], which: "" };      // phase none | xist | condense | done
  const terrCentre = (idx, out) => out.copy(xTerr[idx].centre);
  function setKaryotype(kt) {
    xs.kt = kt; S.kt = kt; xs.phase = "none"; xs.t = 0; xs.inactive = []; S.xDone = false; S.xBarr = 0; delete S.pred[kt]; xs.predSnap = undefined;
    if (ktName) ktName.textContent = KARYOTYPES[kt].name;
    if (predRow) [...predRow.children].forEach((b) => b.setAttribute("aria-pressed", "false"));
    const k = KARYOTYPES[kt];
    xTerr.forEach((t, i) => { t.mesh.visible = i < k.nX; t.home.copy(HOME[i]); t.mesh.userData.kind = "xa"; t.centre.copy(HOME[i]); });
    yTerr.mesh.visible = k.nY > 0; yTerr.home.copy(k.nX >= 2 ? HOME[3] : HOME[1]);
    xs.active = Math.floor(Math.random() * k.nX);
    updateNucleus(0, 0);
    ktSeg?.set(kt);
  }
  function startInactivation() {
    const k = KARYOTYPES[xs.kt], barr = barrBodies(xs.kt);
    if (barr === 0) { engine.toast?.(`${xs.kt} has only one X, so there is nothing to switch off: no Barr body.`); return; }
    if (xs.phase === "xist" || xs.phase === "condense") return;
    xs.active = Math.floor(Math.random() * k.nX);
    xs.inactive = [...Array(k.nX).keys()].filter((i) => i !== xs.active);
    xs.which = k.nX === 2 ? (xs.inactive[0] === 0 ? "maternal" : "paternal") : "two of the three";
    xs.phase = "xist"; xs.t = 0; S.xDone = false; xs.predSnap = S.pred[xs.kt];
    for (const i of xs.inactive) xTerr[i].mesh.userData.kind = "xa";
  }
  function resetInactivation() { setKaryotype(xs.kt); }
  const XP = { x: 0, c: 0, m: 0 };
  const xp = () => { XP.x = clamp(xs.t / 4, 0, 1); XP.c = ease(clamp((xs.t - 3) / 5, 0, 1)); XP.m = clamp((xs.t - 5) / 4, 0, 1); return XP; };
  function updateNucleus(dt, t) {
    if (xs.phase !== "none" && xs.phase !== "done") xs.t += dt;
    const { x, c, m } = xp();
    if (xs.phase === "xist" && xs.t > 3) xs.phase = "condense";
    if (xs.phase === "condense" && xs.t >= 8.2) { xs.phase = "done"; S.xDone = true; S.xBarr = xs.inactive.length; if (xs.kt === "XXY" && xs.predSnap === 1) S.predictXXY = true; }
    const k = KARYOTYPES[xs.kt];
    for (let i = 0; i < 3; i++) {
      const T = xTerr[i]; if (!T.mesh.visible) continue;
      const isXi = xs.inactive.includes(i);
      const kk = isXi ? c : 0;
      tV.copy(T.home);
      if (isXi) { tV2.copy(T.home).normalize().multiplyScalar(R_NUC - 3.6); tV.lerp(tV2, c); }
      if (!engine.reducedMotion) { tV.x += Math.sin(t * 0.21 + i * 2) * (1 - kk) * 0.8; tV.y += Math.cos(t * 0.17 + i) * (1 - kk) * 0.8; }
      T.update(kk, tV);
      if (isXi && c > 0.5) T.mesh.userData.kind = "xi";
      T.glow.position.copy(T.centre); T.glow.scale.setScalar(20);
      T.glow.material.opacity = !isXi && xs.phase !== "none" ? 0.2 : xs.phase === "none" ? 0.09 : 0;
    }
    if (yTerr.mesh.visible) { tV.copy(yTerr.home); yTerr.update(0, tV); }
    // Xist cloud, histone and DNA marks around each inactive X
    for (let q = 0; q < 2; q++) {
      const idx = xs.inactive[q], T = idx != null ? xTerr[idx] : null;
      for (let m2 = 0; m2 < NXI; m2++) {
        const id = q * NXI + m2;
        if (!T) { setI(xistM, id, tV, null, 0); continue; }
        const u = hash(m2 * 2.7 + q * 9) , locus = 0.5, vis = Math.abs(u - locus) <= x * 0.52;
        const pi = Math.min(NP - 1, Math.floor(u * NP)), p = T.pts[pi];
        const a = hash(m2 * 4.1 + 1) * TAU, b = Math.acos(hash(m2 * 6.3) * 2 - 1), rr = lerp(1.6, 1.15, c) + hash(m2 * 8.7) * 0.9;
        tV.set(p.x + Math.sin(b) * Math.cos(a + (engine.reducedMotion ? 0 : t * 0.4)) * rr, p.y + Math.cos(b) * rr, p.z + Math.sin(b) * Math.sin(a) * rr);
        setI(xistM, id, tV, null, vis ? 1 - 0.35 * c : 0);
      }
      for (let m2 = 0; m2 < 70; m2++) {
        const id = q * 70 + m2;
        if (!T) { setI(k27M, id, tV, null, 0); continue; }
        const pi = Math.min(NP - 1, Math.floor(hash(m2 * 3.3 + q) * NP)), p = T.pts[pi], a = hash(m2 * 5.9) * TAU, b = Math.acos(hash(m2 * 7.1) * 2 - 1);
        tV.set(p.x + Math.sin(b) * Math.cos(a) * 1.0, p.y + Math.cos(b) * 1.0, p.z + Math.sin(b) * Math.sin(a) * 1.0);
        setI(k27M, id, tV, null, hash(m2 * 1.9) < m ? 1 : 0);
      }
      for (let m2 = 0; m2 < 40; m2++) {
        const id = q * 40 + m2;
        if (!T) { setI(dnamM, id, tV, null, 0); continue; }
        const pi = Math.min(NP - 1, Math.floor(hash(m2 * 2.2 + q * 4) * NP)), p = T.pts[pi], a = hash(m2 * 6.9) * TAU, b = Math.acos(hash(m2 * 3.7) * 2 - 1);
        tV.set(p.x + Math.sin(b) * Math.cos(a) * 0.9, p.y + Math.cos(b) * 0.9, p.z + Math.sin(b) * Math.sin(a) * 0.9);
        setI(dnamM, id, tV, null, hash(m2 * 4.4) < clamp(m * 1.1 - 0.15, 0, 1) ? 1 : 0);
      }
    }
    xistM.instanceMatrix.needsUpdate = k27M.instanceMatrix.needsUpdate = dnamM.instanceMatrix.needsUpdate = true;
    if (xs.inactive.length && xs.phase === "xist" && x < 1) { xistLoc.position.copy(xTerr[xs.inactive[0]].pts[Math.floor(NP / 2)]); xistLoc.scale.setScalar(5); xistLoc.material.opacity = 0.8; } else xistLoc.material.opacity = 0;
  }

  // ----- mosaic sheet -----
  const bodyMatM = glowMat({ color: "#ffffff", roughness: 0.4, vertexColors: true }, { rim: 0.5, glow: 0.05 });
  const nucMatM = glowMat({ color: "#ffffff", roughness: 0.35 }, { rim: 0.4, glow: 0.12 });
  const mosField = new HexField(300, bodyMatM, nucMatM, "mcell", { ghost: true, seed: 3 });
  gXB.add(mosField.group);
  pickables.push(mosField.body);
  const mo = { m: null, used: null, running: false, acc: 0, shownN: 0, example: "cat", founders: 16, skew: 0.5, stats: null, cells: hexSheet(20, 15) };
  mosField.layout(mo.cells, SHEET_S, SHEET_S * 0.56, 0, 0.24);
  const MCOL = { cat: [["#2a2420", "#3b302a"], ["#ea8a2b", "#f6ad55"]], aed: [["#8ed1fc", "#dbeafe"], ["#e8b9a1", "#f1d3c3"]] };
  function mosColour(i) {
    const s = mo.m.state[i], c = MCOL[mo.example][s];
    mosField.setBody(i, c[0]); mosField.setNuc(i, c[1]);
  }
  function startMosaic() {
    mo.m = new Mosaic({ founders: mo.founders, skew: mo.skew, seed: seed() });
    mo.used = { founders: mo.founders, skew: mo.skew, example: mo.example }; mo.stats = null;
    mo.running = true; mo.acc = 0; mo.shownN = 0;
    for (let i = 0; i < 300; i++) mosField.show(i, false, true);
    mosField.dirty = true;
  }
  function resetMosaic() { mo.m = null; mo.running = false; for (let i = 0; i < 300; i++) mosField.show(i, false); mo.stats = null; mo.used = null; mosField.dirty = true; }
  function updateMosaic(dt, t) {
    if (mo.m) {
      if (mo.running) { mo.acc += dt * 38; while (mo.acc >= 1 && !mo.m.done) { mo.acc -= 1; mo.m.divideOne(); } if (mo.m.done) mo.running = false; }
      let grew = false;
      while (mo.shownN < mo.m.order.length) { const c = mo.m.order[mo.shownN++]; mosColour(c); mosField.show(c, true); if (mo.shownN <= mo.used.founders) mosField.sc[c] = 0.3; grew = true; }
      if (grew || !mo.stats) mo.stats = mo.m.stats();            // cached: recomputed only when assignments change
      if (mo.m.done && mo.example === "cat" && mo.used.founders >= 16 && mo.stats.c0 > 0 && mo.stats.c1 > 0) S.mosaicDone = true;
    }
    mosField.update(dt, t, engine.reducedMotion ? 0 : 0.12);
  }
  function recolourMosaic() { if (!mo.m) return; for (const c of mo.m.order) mosColour(c); }

  // ===================================================================================================================
  // VIEW 3: environment bench
  // ===================================================================================================================
  const gV = new THREE.Group(), gA = new THREE.Group(), gR = new THREE.Group(), gT = new THREE.Group();
  gE.add(gV, gA, gR, gT);
  // ---- a. vernalisation
  const plantBody = glowMat({ color: "#ffffff", roughness: 0.45, vertexColors: true }, { rim: 0.3, glow: 0.0 });
  const plantNuc = glowMat({ color: "#ffffff", roughness: 0.3 }, { rim: 0.3, glow: 1.5 });
  const vField = new HexField(100, plantBody, plantNuc, "vcell", { plant: true, seed: 5 });
  vField.layout(hexSheet(10, 10), 5.4, 5.4 * 0.58, 0, 0.14); vField.ns.fill(0.3);
  gV.add(vField.group); pickables.push(vField.body);
  const WPS = 3;                                           // model weeks per second of animation
  const vern = { seed: seed(), thr: null, weeks: 0, warm: false, elapsed: 0, flowered: false, divs: 0, reset: false, fOff: 0, flower: 0, flowerGrow: 0 };
  vern.thr = vernThresholds(100, vern.seed);
  const flower = new THREE.Group();
  {
    const petal = new THREE.SphereGeometry(1, 14, 10).scale(0.5, 0.13, 1.1).translate(0, 0, 1.15);
    const mat = physical("#fef9c3", { roughness: 0.4, emissive: new THREE.Color("#fde68a"), emissiveIntensity: 0.25, transparent: true, opacity: 0.95 });
    for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(petal, mat); m.rotation.y = (i / 8) * TAU; flower.add(m); }
    flower.add(new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), physical("#f59e0b", { emissive: new THREE.Color("#f59e0b"), emissiveIntensity: 0.6 })));
    flower.position.set(0, 3, 0); flower.scale.setScalar(0.0001); flower.rotation.x = 0.25; gV.add(flower);
  }
  const coldN = 70, coldPts = (() => {
    const pos = new Float32Array(coldN * 3);
    for (let i = 0; i < coldN; i++) { pos[i * 3] = (hash(i * 1.1) - 0.5) * 70; pos[i * 3 + 1] = hash(i * 2.2) * 30; pos[i * 3 + 2] = (hash(i * 3.3) - 0.5) * 50; }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.9, map: softDot(), color: "#dbeafe", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); p.userData.clayHide = true; return p;
  })();
  gV.add(coldPts);
  const vNucOn = "#fde047", vNucOff = "#1e2a3c", vBody = "#4fae68", vCold = "#7fb8dc";
  function vernRefresh(snap = false) {
    const f = vernOffFraction(vern.thr, vern.weeks);
    vern.fOff = f; S.vernMax = Math.max(S.vernMax, f);
    const coldK = vern.warm ? 0 : clamp(vern.weeks / 10, 0, 1) * 0.55;
    tC.set(vBody).lerp(new THREE.Color(vCold), coldK);
    const body = "#" + tC.getHexString();
    for (let i = 0; i < 100; i++) { vField.show(i, true, snap); vField.setBody(i, body, snap); vField.setNuc(i, vern.thr[i] <= vern.weeks ? vNucOff : vNucOn, snap); }
    vern.flower = flowerWeeks(f);
  }
  function vernWarm() {
    if (vern.warm) return;
    if (vern.weeks <= 0) { engine.toast?.("Give the plant some cold first (move the slider)."); return; }
    vern.warm = true; vern.elapsed = 0; vern.flowered = false; vern.divs = 0; vern.reset = false; if (vern.fOff >= 0.9) S.vernWarmed = true;
    vernRefresh();
    vernSlider && (vernSlider.input.disabled = true);
  }
  function vernNewGen() {
    vern.seed = seed(); vern.thr = vernThresholds(100, vern.seed); vern.weeks = 0; vern.warm = false; vern.elapsed = 0; vern.flowered = false; vern.divs = 0; vern.reset = true; vern.flowerGrow = 0;
    vernSlider && (vernSlider.input.disabled = false, vernSlider.value = 0);
    vernRefresh();
  }
  function updateVern(dt, t) {
    if (vern.warm) {
      if (!vern.flowered) vern.elapsed += dt * WPS;                              // a displayed weeks clock; flowering happens at the model's predicted week
      vern.divs = Math.min(3, Math.floor(vern.elapsed / 3));
      const ph = (vern.elapsed % 3) / 3, pulse = engine.reducedMotion || vern.elapsed >= 9 ? 0 : 0.3 * Math.sin(ph * Math.PI);
      for (let i = 0; i < 100; i++) vField.ysc[i] = 1 + pulse;
      vField.dirty = true;
      if (!vern.flowered && vern.elapsed >= vern.flower) { vern.flowered = true; vern.elapsed = vern.flower; }
      vern.flowerGrow = vern.flowered ? Math.min(1, vern.flowerGrow + dt * 0.7) : 0;
    } else vern.flowerGrow = Math.max(0, vern.flowerGrow - dt);
    flower.scale.setScalar(Math.max(0.0001, ease(vern.flowerGrow) * 2.0)); flower.position.y = 3 + 6 * ease(vern.flowerGrow);   // size does not encode the delay
    flower.visible = vern.flowerGrow > 0.01;
    const cold = !vern.warm && vern.weeks > 0;
    coldPts.material.opacity += ((cold ? 0.55 : 0) - coldPts.material.opacity) * Math.min(1, dt * 3);
    if (coldPts.material.opacity > 0.02 && !engine.reducedMotion) { const a = coldPts.geometry.attributes.position.array; for (let i = 0; i < coldN; i++) { a[i * 3 + 1] -= dt * (1.5 + (i % 5) * 0.4); a[i * 3] += Math.sin(t + i) * dt * 0.4; if (a[i * 3 + 1] < -2) a[i * 3 + 1] = 28; } coldPts.geometry.attributes.position.needsUpdate = true; }
    vField.update(dt, t, engine.reducedMotion ? 0 : 0.05);
  }

  // ---- b. agouti
  const pupGeo = (() => {
    const w = (g, c) => paint(g, c);
    const body = new THREE.SphereGeometry(1, 20, 14).scale(1.25, 0.82, 0.85);
    const head = new THREE.SphereGeometry(0.62, 18, 12).translate(1.2, 0.18, 0);
    const snout = new THREE.SphereGeometry(0.28, 12, 8).scale(1.2, 0.8, 0.9).translate(1.75, 0.08, 0);
    const earA = new THREE.SphereGeometry(0.28, 10, 8).scale(0.5, 1, 1).translate(1.1, 0.78, 0.38), earB = earA.clone().translate(0, 0, -0.76);
    const nose = new THREE.SphereGeometry(0.1, 8, 6).translate(2.0, 0.12, 0);
    const eyeA = new THREE.SphereGeometry(0.075, 8, 6).translate(1.58, 0.36, 0.3), eyeB = eyeA.clone().translate(0, 0, -0.6);
    const tailC = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-1.15, 0.1, 0), new THREE.Vector3(-2.0, 0.4, 0.3), new THREE.Vector3(-2.5, 0.0, 0.6));
    const tail = new THREE.TubeGeometry(tailC, 10, 0.09, 6);
    return mergeGeometries([w(body, "#ffffff"), w(head, "#ffffff"), w(snout, "#ffffff"), w(earA, "#fbcfe8"), w(earB, "#fbcfe8"), w(nose, "#f9a8d4"), w(eyeA, "#1c1917"), w(eyeB, "#1c1917"), w(tail, "#fda4af")].map((g) => (g.index ? g.toNonIndexed() : g)));
  })();
  const pupMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.55, sheen: 1, sheenRoughness: 0.4, sheenColor: new THREE.Color("#fff7ed"), clearcoat: 0.1 });
  const NPUP = 8;
  const pupM = inst(pupGeo, pupMat, NPUP, "pup"); gA.add(pupM);
  const spotM = inst(new THREE.SphereGeometry(0.2, 10, 8).scale(1.3, 0.5, 1), new THREE.MeshPhysicalMaterial({ color: "#3b2415", roughness: 0.6, sheen: 1, sheenColor: new THREE.Color("#7c4a2a") }), NPUP * 6, null); gA.add(spotM);
  const meterM = inst(new THREE.CapsuleGeometry(0.16, 1, 4, 8), glowMat({ color: "#ffffff", transparent: true, opacity: 0.9 }, { rim: 0.6, glow: 0.4 }), NPUP, null); gA.add(meterM);
  const meterBack = inst(new THREE.CapsuleGeometry(0.2, 3, 4, 8), new THREE.MeshBasicMaterial({ color: "#94a3b8", transparent: true, opacity: 0.16, depthWrite: false }), NPUP, null); meterBack.userData.clayHide = true; gA.add(meterBack);
  const ag = { diet: 0.15, litterDiet: 0.15, litter: [], total: 0, counts: [0, 0, 0, 0], rng: mulberry32(seed()), born: 0, brownShare: 0 };
  const pupPos = Array.from({ length: NPUP }, (_, i) => new THREE.Vector3((i % 4 - 1.5) * 7.6, 0, (Math.floor(i / 4) - 0.5) * 7));
  function newLitter() {
    ag.litter = agoutiLitter(ag.diet, ag.rng, NPUP); ag.litterDiet = ag.diet;
    for (const p of ag.litter) ag.counts[p.cls]++;
    ag.total += NPUP; ag.born = 0;
    const brown = ag.litter.filter((p) => p.cls >= 2).length;
    if (ag.diet >= 0.6) S.agoutiMaxBrown = Math.max(S.agoutiMaxBrown, brown);      // the mission needs a methyl-rich diet
    ag.brownShare = (ag.counts[2] + ag.counts[3]) / ag.total;
    ag.t0 = 0;
  }
  function updateAgouti(dt, t) {
    ag.born += dt;
    for (let i = 0; i < NPUP; i++) {
      const p = ag.litter[i];
      if (!p) { setI(pupM, i, tV, null, 0); for (let s = 0; s < 6; s++) setI(spotM, i * 6 + s, tV, null, 0); setI(meterM, i, tV, null, 0); setI(meterBack, i, tV, null, 0); continue; }
      const pop = ease(clamp((ag.born - i * 0.1) / 0.5, 0, 1)), cl = AGOUTI_CLASSES[p.cls];
      const breathe = engine.reducedMotion ? 1 : 1 + Math.sin(t * 1.6 + i) * 0.015;
      tV.copy(pupPos[i]); tV.y = 1.0 * pop;
      tQ.setFromAxisAngle(tS.set(0, 1, 0), (i % 2 ? 0.45 : -0.35) - 0.2 + (engine.reducedMotion ? 0 : Math.sin(t * 0.5 + i) * 0.05));
      tM.compose(tV, tQ, tS.set(1.15 * pop, 1.15 * pop * breathe, 1.15 * pop));
      pupM.setMatrixAt(i, tM);
      tC.set(cl.color); pupM.setColorAt(i, tC);
      const nSpots = [0, 2, 5, 0][p.cls];
      for (let s = 0; s < 6; s++) {
        if (s >= nSpots) { setI(spotM, i * 6 + s, tV2, null, 0); continue; }
        tV2.set(-0.8 + hash(i * 9 + s * 3.7) * 1.6, 0.76 * 1.15 + 0.05, (hash(i * 5 + s * 2.2) - 0.5) * 0.9).multiplyScalar(1.15).applyQuaternion(tQ).add(tV);
        tV2.y -= 0.18;
        tM.compose(tV2, tQ, tS.setScalar((0.9 + hash(s + i) * 0.9) * pop * 1.15));
        spotM.setMatrixAt(i * 6 + s, tM);
      }
      // methylation meter (taller = more methylation); pink glow
      tV2.set(pupPos[i].x, 0.2 + p.meth * 1.6 * pop + 0.2, pupPos[i].z + 3.0);
      tM.compose(tV2, tQ.identity(), tS.set(1, Math.max(0.05, p.meth * pop * 1.0), 1));
      meterM.setMatrixAt(i, tM); meterM.setColorAt(i, tC.set("#f472b6").lerp(PINK2, p.meth));
      tM.compose(tV2.set(pupPos[i].x, 2.0, pupPos[i].z + 3.0), tQ.identity(), tS.set(1, 0.8, 1));
      meterBack.setMatrixAt(i, tM);
    }
    pupM.instanceMatrix.needsUpdate = spotM.instanceMatrix.needsUpdate = meterM.instanceMatrix.needsUpdate = meterBack.instanceMatrix.needsUpdate = true;
    if (pupM.instanceColor) pupM.instanceColor.needsUpdate = true; if (meterM.instanceColor) meterM.instanceColor.needsUpdate = true;
  }

  // ---- c. Himalayan rabbit
  const rbMap = rabbitMap();
  const furBody = glowMat({ color: "#ffffff", roughness: 0.75, sheen: 1, sheenRoughness: 0.35, clearcoat: 0.05, vertexColors: true }, { rim: 0.0, glow: 0.0 });
  const rField = new HexField(rbMap.length, furBody, glowMat({ color: "#ffffff" }, { rim: 0, glow: 0 }), "rcell", { seed: 9 });
  rField.layout(rbMap.map((c) => ({ x: c.x * 1, y: c.y * 1 })), 1.18, 1.18 * 0.58, 0, 0.12); rField.hy = 0.8; rField.nuc.visible = false; rField.nlift = 0;
  gR.add(rField.group); pickables.push(rField.body);
  const rb = { furT: new Float32Array(rbMap.length), patch: [], shaved: false, regrown: false, temp: 26, applied: 26, regrowTemp: 26, regrowT: 0, why: false };
  {
    const cx = 0.3, cy = -0.8;
    rbMap.forEach((c, i) => { rb.furT[i] = c.temp; if (c.region === "body" && Math.hypot(c.x - cx, c.y - cy) < 2.3) rb.patch.push(i); });
  }
  const FUR_W = new THREE.Color("#e9e2d4"), FUR_D = new THREE.Color("#2a1b16"), SKIN = new THREE.Color("#f1c4b5");
  function furColor(i) { return tC.copy(FUR_W).lerp(FUR_D, furDark(rb.furT[i])); }
  function rabbitRefresh(snap = false) {
    for (let i = 0; i < rbMap.length; i++) {
      rField.show(i, true, true);
      const inPatch = rb.patch.includes(i);
      if (inPatch && rb.shaved && !rb.regrown) { rField.setBody(i, "#" + SKIN.getHexString(), snap); rField.ysc[i] = 0.45; }
      else { rField.setBody(i, "#" + furColor(i).getHexString(), snap); rField.ysc[i] = 1; }
    }
    rField.dirty = true;
  }
  function rabbitShave() {
    if (rb.shaved) return;
    rb.shaved = true; rb.regrown = false; rb.regrowT = 0; rb.applied = rb.temp; rabbitRefresh();
  }
  function rabbitRegrow() {
    if (!rb.shaved || rb.regrown) { if (!rb.shaved) engine.toast?.("Shave and cool a patch first."); return; }
    rb.regrown = true; rb.regrowTemp = rb.applied; for (const i of rb.patch) rb.furT[i] = rb.regrowTemp; rb.regrowT = 0;
    rabbitRefresh();
    S.rabbitDone = rb.regrowTemp <= 31;
  }
  function rabbitReset() { rbMap.forEach((c, i) => { rb.furT[i] = c.temp; }); rb.shaved = false; rb.regrown = false; rabbitRefresh(); }
  function updateRabbit(dt, t) {
    if (rb.shaved && rb.regrown) rb.regrowT += dt;
    rField.update(dt, t, 0);
  }

  // ---- d. twins
  const tw = { draws: twinDraws(seed()), age: 0, env: 0.4, a: null, b: null, diff: 0 };
  const twinSite = inst(new THREE.SphereGeometry(0.42, 16, 12), glowMat({ color: "#ffffff" }, { rim: 0.5, glow: 0.35 }), TWIN.sites * 2, "twin"); gT.add(twinSite);
  const twinRing = inst(new THREE.TorusGeometry(0.78, 0.07, 8, 28), new THREE.MeshBasicMaterial({ color: "#fde047", transparent: true, opacity: 0.9 }), TWIN.sites * 2, null); gT.add(twinRing);
  const twPos = (r, s, out) => { const col = s % 30, row = Math.floor(s / 30); return out.set((col - 14.5) * 1.5, (r ? -4.6 - row * 2.7 : 9.4 - row * 2.7) + Math.sin(col * 0.5 + r) * 0.3, 0.3); };
  for (let r = 0; r < 2; r++) for (let row = 0; row < 2; row++) {
    const pts = []; for (let c = 0; c < 30; c++) pts.push(twPos(r, row * 30 + c, new THREE.Vector3()).setZ(0));
    gT.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.1, 6), physical(DNA_COL, { emissive: new THREE.Color("#a855f7"), emissiveIntensity: 0.2 })));
  }
  function twinRefresh() {
    const p = twinPatterns(tw.draws, tw.age, tw.env); tw.a = p.a; tw.b = p.b; tw.diff = p.diff;
    for (let r = 0; r < 2; r++) for (let s = 0; s < TWIN.sites; s++) {
      const id = r * TWIN.sites + s, me = (r ? p.b : p.a)[s];
      twPos(r, s, tV);
      tM.compose(tV, tQ.identity(), tS.setScalar(me ? 1 : 0.55)); twinSite.setMatrixAt(id, tM);
      twinSite.setColorAt(id, tC.set(me ? "#f472b6" : "#7dd3fc"));
      tM.compose(tV, tQ.identity(), tS.setScalar(p.a[s] !== p.b[s] ? 1 : 0.00001)); twinRing.setMatrixAt(id, tM);
    }
    twinSite.instanceMatrix.needsUpdate = twinRing.instanceMatrix.needsUpdate = true; twinSite.instanceColor.needsUpdate = true;
  }

  // ===================================================================================================================
  // view switching, camera
  // ===================================================================================================================
  const ENVS = {
    marks: { bg: ["#0a0d2a", "#14183a", "#3a1450"], fog: ["#0d1030", 0.008], exposure: 0.95, bloom: [0.3, 0.45, 0.92], aperture: 0.0007 },
    nucleus: { bg: ["#0b0e2e", "#1a1640", "#3b1a55"], fog: ["#0d1030", 0.002], exposure: 1.05, bloom: [0.45, 0.5, 0.85], aperture: 0.0002 },
    sheet: { bg: ["#1a1020", "#2a1830", "#4a2438"], fog: ["#1a1020", 0.0012], exposure: 1.0, bloom: [0.3, 0.5, 0.9], aperture: 0.00004 },
    vern: { bg: ["#0b1d2b", "#10303a", "#1c4b4a"], fog: ["#0b1d2b", 0.004], exposure: 0.95, bloom: [0.35, 0.5, 0.9], aperture: 0.0004 },
    agouti: { bg: ["#1d1a2e", "#2c2540", "#4a3358"], fog: ["#1d1a2e", 0.003], exposure: 1.0, bloom: [0.3, 0.5, 0.9], aperture: 0.0004 },
    rabbit: { bg: ["#161a2c", "#232a42", "#31405c"], fog: ["#161a2c", 0.002], exposure: 0.8, bloom: [0.08, 0.4, 1.0], aperture: 0.0002 },
    twins: { bg: ["#0d1030", "#1b1650", "#3b1a6a"], fog: ["#0d1030", 0.003], exposure: 1.05, bloom: [0.5, 0.5, 0.82], aperture: 0.0004 },
  };
  const sceneKey = () => (state.view === "marks" ? "marks" : state.view === "x" ? (state.xScene === "nucleus" ? "nucleus" : "sheet") : state.ex);
  function applyVisibility() {
    gM.visible = state.view === "marks";
    gXA.visible = state.view === "x" && state.xScene === "nucleus";
    gXB.visible = state.view === "x" && state.xScene === "sheet";
    gE.visible = state.view === "env";
    gV.visible = state.ex === "vern"; gA.visible = state.ex === "agouti"; gR.visible = state.ex === "rabbit"; gT.visible = state.ex === "twins";
  }
  function viewSpec() {
    const a = engine.camera.aspect, t = Math.tan(THREE.MathUtils.degToRad(engine.camera.fov / 2)), fit = (halfW, halfH, pad = 1.08) => Math.max(halfW / (t * a), halfH / t) * pad;
    switch (sceneKey()) {
      case "marks": return { target: new THREE.Vector3(0, -6.8, 0), distance: clamp(fit(10.8, 8.6), 22, 190), dir: new THREE.Vector3(0.06, 0.16, 1), min: 6, max: 230 };
      case "nucleus": return { target: new THREE.Vector3(0, 0, 0), distance: clamp(fit(R_NUC + 3, R_NUC + 3), 60, 220), dir: new THREE.Vector3(0.1, 0.12, 1), min: 12, max: 260 };
      case "sheet": return { target: new THREE.Vector3(0, 0, 0), distance: clamp(fit(125, 82), 160, 520), dir: new THREE.Vector3(0, 0.82, 0.57), min: 40, max: 640 };
      case "vern": return { target: new THREE.Vector3(0, 3, 0), distance: clamp(fit(36, 31), 44, 220), dir: new THREE.Vector3(0.15, 0.78, 0.6), min: 14, max: 260 };
      case "agouti": return { target: new THREE.Vector3(0, 1, 0), distance: clamp(fit(16, 9), 24, 140), dir: new THREE.Vector3(0.05, 0.62, 0.78), min: 8, max: 180 };
      case "rabbit": return { target: new THREE.Vector3(-1, 0, 0), distance: clamp(fit(17, 10), 24, 150), dir: new THREE.Vector3(0.0, 0.96, 0.28), min: 8, max: 180 };
      default: return { target: new THREE.Vector3(0, 1.4, 0), distance: clamp(fit(24, 12), 30, 190), dir: new THREE.Vector3(0.0, 0.08, 1), min: 8, max: 230 };
    }
  }
  function applyScene(snap) {
    applyVisibility();
    const v = viewSpec(), c = engine.controls;
    c.minDistance = v.min; c.maxDistance = v.max;
    engine.applyEnv?.(ENVS[sceneKey()], level);
    engine.camera.near = Math.max(0.2, v.min * 0.04); engine.camera.far = 3000; engine.camera.updateProjectionMatrix();
    c.target.copy(v.target);
    engine.camera.position.copy(v.target).addScaledVector(v.dir.clone().normalize(), v.distance);
    c.update(); engine.userMoved = false;
  }
  let alive = true, gen = 0;
  async function transition(change) {
    if (state.busy || engine.busy || !alive) return false;
    state.busy = true;
    const my = ++gen, ok = () => alive && my === gen && engine.current === level;
    try {
      await engine.fadeTo(1, engine.reducedMotion ? 30 : 200);
      if (!ok()) return false;
      change();
      engine.select(null);
      applyScene();
      await engine.fadeTo(0, engine.reducedMotion ? 30 : 300);
      return ok();
    } finally { if (my === gen) state.busy = false; if (alive) engine.fadeTo(0, 200); }
  }
  async function setView(id) { if (id === state.view) { viewSeg?.set(state.view); return; } const ok = await transition(() => { state.view = id; }); viewSeg?.set(state.view); if (ok) refreshPanelForView(); }
  async function setXScene(id) { if (id === state.xScene) { xSceneSeg?.set(id); return; } await transition(() => { state.xScene = id; }); xSceneSeg?.set(state.xScene); refreshPanelForView(); }
  async function setEx(id) { if (id === state.ex) { exSeg?.set(id); return; } await transition(() => { state.ex = id; }); exSeg?.set(state.ex); refreshPanelForView(); }

  // ===================================================================================================================
  // labels
  // ===================================================================================================================
  let labels = [];
  const PN = (k) => lens.pick(PARTS[k].name);
  function makeLabels() {
    for (const l of labels) l.el.remove();
    labels = [];
    const add = (view, html, get, always = false) => { const el = engine.label(typeof html === "function" ? html() : html, "org"); el.style.display = "none"; labels.push({ el, view, html, get, always }); };
    const sen = () => lens.atLeast("y11");
    add("marks", () => `${PN("nucleosome")}<small>~11 nm</small>`, (o) => o.copy(P[4]).add(tV3.set(0, 1.5, 0)), true);
    add("marks", () => PN("acetyl"), (o) => { for (let i = 0; i < NN; i++) if (va[i] > 0.8) return !!tailWorld(i, 1, o, 1.3).add(tV3.set(0, 0.6, 0)); return false; });
    add("marks", () => PN("methyl"), (o) => { for (let i = NN - 1; i >= 0; i--) if (vm[i] > 0.8) return !!tailWorld(i, 2, o, 1.3).add(tV3.set(0, -0.7, 0)); return false; });
    add("marks", () => (repSys === "prc2" && sen() ? "PRC2" : sen() ? "HP1" : PN("reader")), (o) => { for (let i = 0; i < NN; i++) if (vr[i] > 0.8) return !!o.copy(P[i]).add(tV3.set(0.2, 1.7, 0.9)); return false; });
    add("marks", () => `${PN("cpg")}<small>promoter</small>`, (o) => { if (!sim.cpg.some((c) => c)) return false; return !!o.copy(cpgPos[4]).add(tV3.set(0, -1.0, 0.6)); });
    add("marks", () => PN("pol"), (o) => { const p = pols.find((q) => q.on); if (!p) return false; return !!dnaTube.at(2 + 3 * p.u, o).add(tV3.set(0, 1.9, 1)); });
    add("marks", () => PN("mrna"), (o) => { const p = pols.find((q) => q.on); if (!p) return false; return !!dnaTube.at(2 + 3 * (p.u - 2), o).add(tV3.set(0, 3.6, 2.4)); });
    add("marks", () => { const z = enz.find((q) => q.on && q.t > 0.4); return z ? `${lens.atLeast("y11") ? ENZ_NAME[z.kind] : z.kind === "hat" || z.kind === "hmt" ? "Tag adder" : "Tag remover"}` : ""; }, (o) => { const z = enz.find((q) => q.on && q.t > 0.4 && q.t < 2); return z ? !!o.copy(z.cur).add(tV3.set(0, 1.0, 0)) : false; });
    add("marks", () => (lens.atLeast("y9-10") ? "Activator" : "'On' switch"), (o) => (sim.act > 0.05 ? !!o.copy(tfPos[0]).add(tV3.set(-1.2, -0.9, 0)) : false));
    add("marks", () => (lens.atLeast("y9-10") ? "Repressor" : "'Off' switch"), (o) => (sim.rep > 0.05 ? !!o.copy(tfPos[1]).add(tV3.set(1.2, 0.9, 0)) : false));
    add("xn", () => `${PN("xa")}`, (o) => { const i = xs.active; return xTerr[i]?.mesh.visible ? !!o.copy(xTerr[i].centre).add(tV3.set(0, 9, 0)) : false; }, true);
    add("xn", () => `${PN("xi")}<small>≈ 1 µm</small>`, (o) => { const i = xs.inactive[0]; return i != null && xs.phase === "done" ? !!o.copy(xTerr[i].centre).add(tV3.set(0, 4.2, 0)) : false; }, true);
    add("xn", () => PN("xist"), (o) => { const i = xs.inactive[0]; return i != null && xs.phase === "xist" ? !!o.copy(xTerr[i].centre).add(tV3.set(0, 8, 0)) : false; });
    add("xn", () => PN("autosome"), (o) => o.copy(autos[1].home).add(tV3.set(0, 9, 0)));
    add("xn", () => PN("ycell"), (o) => (yTerr.mesh.visible ? !!o.copy(yTerr.home).add(tV3.set(0, 5.5, 0)) : false));
    add("xn", () => "Nuclear envelope<small>nucleus ≈ 9 µm across</small>", (o) => o.set(-R_NUC * 0.72, R_NUC * 0.72, 0));
    add("env", () => (state.ex === "vern" && vern.warm ? `Week ${Math.floor(vern.elapsed)} after warming${vern.flowered ? ": flowering" : ""}` : ""), (o) => o.set(0, 13, -6), true);
    add("env", () => "FLC on", (o) => { if (state.ex !== "vern") return false; for (let i = 0; i < 100; i++) if (vern.thr[i] > vern.weeks) return !!o.set(vField.px[i * 3], 4.2, vField.px[i * 3 + 2]); return false; });
    add("env", () => (lens.atLeast("y9-10") ? "More methylation → browner coat" : "More tags → browner"), (o) => (state.ex === "agouti" ? !!o.set(0, 4.5, 6) : false));
    add("env", () => `Ears ≈ 28 °C: dark`, (o) => (state.ex === "rabbit" ? !!o.set(-9.5, 1, -5) : false));
    add("env", () => `Body ≈ 37 °C: white`, (o) => (state.ex === "rabbit" ? !!o.set(-1, 1, 6) : false));
    add("env", () => `Patch ${(rb.regrown ? rb.regrowTemp : rb.applied).toFixed(0)} °C`, (o) => (state.ex === "rabbit" && rb.shaved ? !!o.set(0.3, 1.5, 0.8) : false));
    add("env", () => "Twin A", (o) => (state.ex === "twins" ? !!o.set(-24, 10.5, 0) : false), true);
    add("env", () => "Twin B", (o) => (state.ex === "twins" ? !!o.set(-24, -3.2, 0) : false), true);
  }
  function updateLabels() {
    const small = narrow(), lbKey = state.view === "x" ? (state.xScene === "nucleus" ? "xn" : "xs") : state.view;
    for (const l of labels) {
      if (!state.labels || l.view !== lbKey || state.busy || (small && !l.always)) { l.el.style.display = "none"; continue; }
      if (typeof l.html === "function") { const h = l.html(); if (!h) { l.el.style.display = "none"; continue; } if (l._h !== h) { l._h = h; l.el.innerHTML = h; } }
      if (l.get(tV2) === false) { l.el.style.display = "none"; continue; }
      engine.place(l.el, tV2);
    }
  }

  // ===================================================================================================================
  // panel
  // ===================================================================================================================
  let panelEl = null, progress = null, boxes = {}, explainBody = null, selCard = null, viewSeg = null, xSceneSeg = null, exSeg = null, ktSeg = null, blurbEl = null, noteEl = null;
  let ktName = null, predRow = null, marksChart = null, envChart = null, divBtn = null, vernSlider = null, startMark = null, hintBack = null, lastHit = null;
  const parentIsKaryotype = () => engine.stack.at(-2)?.id === "karyotype";

  function ctx() {
    if (state.view === "marks") return { view: "marks", sim };
    if (state.view === "x") return { view: "x", scene: state.xScene, kt: xs.kt, phase: xs.phase, which: xs.which, xistPct: Math.round(xp().x * 100), stats: mo.stats, used: mo.used, next: { founders: mo.founders, skew: mo.skew, example: mo.example }, n: 300 };
    return { view: "env", ex: state.ex, vern: { weeks: vern.weeks, fOff: vern.fOff, warm: vern.warm, elapsed: vern.elapsed, flower: vern.flower, flowered: vern.flowered, reset: vern.reset && !vern.warm && vern.weeks === 0 },
      agouti: { diet: ag.diet, litterDiet: ag.litterDiet, litter: ag.litter, total: ag.total, brownShare: ag.brownShare }, rabbit: { shaved: rb.shaved, regrown: rb.regrown && rb.regrowT > 1.2, temp: rb.temp, applied: rb.applied, regrowTemp: rb.regrowTemp }, twins: { age: tw.age, env: tw.env, diff: tw.diff } };
  }
  function updateExplain() {
    if (!explainBody) return;
    const html = narrative(ctx(), lens.band).map((p) => `<p>${p}</p>`).join("");
    if (explainBody.innerHTML !== html) explainBody.innerHTML = html;
  }
  function refreshPanelForView() {
    if (!boxes.marks) return;
    boxes.marks.style.display = state.view === "marks" ? "" : "none";
    boxes.x.style.display = state.view === "x" ? "" : "none";
    boxes.env.style.display = state.view === "env" ? "" : "none";
    boxes.xN.style.display = state.xScene === "nucleus" ? "" : "none";
    boxes.xS.style.display = state.xScene === "sheet" ? "" : "none";
    for (const k of ["vern", "agouti", "rabbit", "twins"]) boxes[k].style.display = state.ex === k ? "" : "none";
    if (blurbEl) blurbEl.innerHTML = lens.pick(BLURB[state.view]);
    if (noteEl) noteEl.innerHTML = lens.pick(NOTE[state.view]);
    viewSeg?.set(state.view); xSceneSeg?.set(state.xScene); exSeg?.set(state.ex);
    updateExplain(); drawCharts();
  }

  function plotFrame(c, w, h, padL = 26, padB = 16) {
    c.strokeStyle = K.cssVar("--grid-line", "rgba(255,255,255,0.1)"); c.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { const y = 6 + ((h - padB - 6) * i) / 4; c.beginPath(); c.moveTo(padL, y); c.lineTo(w - 4, y); c.stroke(); }
    c.fillStyle = K.cssVar("--ink-faint", "#6a7f9c"); c.font = "10px system-ui, sans-serif";
  }
  function prep(canvas) {
    if (!canvas) return null;
    const w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    if (!w) return null;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    const c = canvas.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    return { c, w, h };
  }
  function drawMarksChart() {
    const p = prep(marksChart); if (!p) return;
    const { c, w, h } = p, padL = 26, padB = 16, pw = w - padL - 4, ph = h - padB - 6;
    plotFrame(c, w, h, padL, padB);
    const H = sim.history, tEnd = Math.max(sim.t, 60), t0 = tEnd - 60;
    c.fillText("100%", 0, 12); c.fillText("0", 12, h - padB + 3); c.fillText("model time (rounds) →", padL + 4, h - 3);
    const X = (t) => padL + ((t - t0) / 60) * pw, Y = (v) => 6 + ph - v * ph;
    // division markers
    for (const m of sim.marks) if (m.t >= t0) { c.strokeStyle = "rgba(251,191,36,0.7)"; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(X(m.t), 6); c.lineTo(X(m.t), 6 + ph); c.stroke(); c.setLineDash([]); }
    const series = [["M", METHYL, lens.atLeast("y9-10") ? 1 : 1]];
    series.push(["A", "#a3e635", 1]);
    if (lens.atLeast("y11")) series.push(["c", "#f472b6", 1]);
    for (const [k, col] of series) {
      c.strokeStyle = col; c.lineWidth = 2; c.setLineDash(k === "c" ? [4, 3] : []); c.beginPath(); let started = false;
      for (const q of H) { if (q.t < t0 - 1) continue; const x = X(q.t), y = Y(q[k]); started ? c.lineTo(x, y) : c.moveTo(x, y); started = true; }
      c.stroke(); c.setLineDash([]);
    }
    marksChart.setAttribute("aria-label", `Fraction repressive ${Math.round(sim.fracM * 100)} percent, active ${Math.round(sim.fracA * 100)} percent, ${sim.divs} divisions so far.`);
  }
  function drawEnvChart() {
    const p = prep(envChart); if (!p) return;
    const { c, w, h } = p, padL = 30, padB = 18, pw = w - padL - 6, ph = h - padB - 8;
    plotFrame(c, w, h, padL, padB);
    const Y = (v) => 8 + ph - v * ph;
    const ink = K.cssVar("--ink-dim", "#9fb3cf");
    const line = (fn, x0, x1, col, dash) => { c.strokeStyle = col; c.lineWidth = 2; c.setLineDash(dash || []); c.beginPath(); for (let i = 0; i <= 60; i++) { const x = x0 + ((x1 - x0) * i) / 60; const X = padL + (i / 60) * pw; i ? c.lineTo(X, Y(fn(x))) : c.moveTo(X, Y(fn(x))); } c.stroke(); c.setLineDash([]); };
    const dot = (X, Yv, col) => { c.fillStyle = col; c.beginPath(); c.arc(X, Y(Yv), 5, 0, TAU); c.fill(); c.strokeStyle = "#fff"; c.lineWidth = 1.5; c.stroke(); };
    c.fillStyle = ink;
    if (state.ex === "vern") {
      c.fillText("cells with FLC off", 4, 10); c.fillText("weeks of cold →", padL + 4, h - 3); c.fillText("0", padL - 2, h - padB + 11); c.fillText("10", padL + pw - 8, h - padB + 11);
      line((x) => vernFraction(x), 0, 10, "#5eead4");
      line((x) => (flowerWeeks(vernFraction(x)) - 4) / 20, 0, 10, "#fbbf24", [4, 3]);
      dot(padL + (vern.weeks / 10) * pw, vern.fOff, "#5eead4");
    } else if (state.ex === "agouti") {
      const probs = agoutiProbs(ag.litterDiet), n = 4, bw = pw / n, nl = ag.litter.length;
      c.fillText("share of pups in this litter", 4, 10);
      const cnt = [0, 0, 0, 0]; for (let q = 0; q < nl; q++) cnt[ag.litter[q].cls]++;
      for (let i = 0; i < n; i++) {
        const x = padL + i * bw + 5, bwid = bw - 10;
        c.fillStyle = AGOUTI_CLASSES[i].color; const v = nl ? cnt[i] / nl : 0; c.fillRect(x, Y(v), bwid, v * ph);
        c.strokeStyle = "#fff"; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 2, Y(probs[i])); c.lineTo(x + bwid + 2, Y(probs[i])); c.stroke();
        c.fillStyle = ink; c.fillText(["yellow", "y-mottled", "b-mottled", "brown"][i], x, h - 5);
      }
    } else if (state.ex === "rabbit") {
      c.fillText("enzyme activity", 4, 10); c.fillText("skin temperature (°C) →", padL + 4, h - 3);
      const T0 = 20, T1 = 40, X = (T) => padL + ((T - T0) / (T1 - T0)) * pw;
      line((x) => tyrActivity(x), T0, T1, "#fb923c");
      dot(X(28), tyrActivity(28), "#3a2a24"); dot(X(36.8), tyrActivity(36.8), "#f3eee4");
      if (rb.shaved) dot(X(rb.temp), tyrActivity(rb.temp), "#60a5fa");
      c.fillStyle = ink; for (const T of [20, 30, 40]) c.fillText(String(T), X(T) - 6, h - padB + 11);
    } else {
      c.fillText("sites that differ", 4, 10); c.fillText("age (years) →", padL + 4, h - 3);
      const a1 = 80, X = (a) => padL + (a / a1) * pw, mx = Math.max(0.1, twinExpected(80, 1) * 1.25);
      const Yn = (v) => Y(v / mx);
      for (const [e, col] of [[0, "#7dd3fc"], [1, "#f472b6"]]) { c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); for (let i = 0; i <= 40; i++) { const a = (a1 * i) / 40; i ? c.lineTo(X(a), Yn(twinExpected(a, e))) : c.moveTo(X(a), Yn(twinExpected(a, e))); } c.stroke(); }
      c.fillStyle = "#fde047"; c.beginPath(); c.arc(X(tw.age), Yn(tw.diff / TWIN.sites), 5, 0, TAU); c.fill();
      c.fillStyle = ink; c.fillText("0", padL - 2, h - padB + 11); c.fillText("80", padL + pw - 10, h - padB + 11);
    }
  }
  function drawCharts() { if (state.view === "marks") drawMarksChart(); else if (state.view === "env") drawEnvChart(); }

  function showSelection(info) {
    if (!selCard) return;
    if (!info) { selCard.style.display = "none"; return; }
    const kind = info.kind, p = PARTS[kind];
    if (!p) { selCard.style.display = "none"; return; }
    const id = lastHit && lastHit.object === info.object ? lastHit.instanceId : undefined;
    const sen = lens.atLeast("y11");
    let extra = "";
    if (kind === "nucleosome" && id != null) {
      const s = sim.s[id];
      extra = `<div class="io"><b>Nucleosome</b><span>${id + 1} of ${NN}${id >= sim.window[0] && id <= sim.window[1] ? " (promoter region)" : ""}</span><b>State</b><span>${s === 1 ? (sen ? "A: active (histone acetylation, e.g. H3K27ac)" : "active (acetyl tags)") : s === -1 ? (sen ? "M: repressive (" + (repSys === "prc2" ? "H3K27me3" : "H3K9me3") + ")" : "silencing (methyl tags)") : "unmarked"}</span></div>`;
    } else if (kind === "enzyme" && id != null) extra = `<div class="io"><b>This one</b><span>${lens.atLeast("y11") ? ENZ_NAME[enz[id].kind] : enz[id].kind === "hat" || enz[id].kind === "hmt" ? "adds a tag" : "removes a tag"}</span></div>`;
    else if (kind === "cpg") extra = `<div class="io"><b>Promoter CpGs</b><span>${Math.round(sim.cpgFrac * N_CPG)} of ${N_CPG} methylated${sen ? "" : ""}</span></div>`;
    else if (kind === "mcell" && id != null && mo.m && mo.m.state[id] >= 0) extra = `<div class="io"><b>Inactive X</b><span>${mo.m.state[id] === 0 ? "X₁" : "X₂"} (inherited from its parent cell)</span></div>`;
    else if (kind === "vcell" && id != null) extra = `<div class="io"><b>FLC</b><span>${vern.thr[id] <= vern.weeks ? "silenced (off)" : "on"}</span></div>`;
    else if (kind === "rcell" && id != null) extra = `<div class="io"><b>Region</b><span>${rbMap[id].region}</span><b>Skin now</b><span>${rb.furT[id].toFixed(0)} °C (fur grown at)</span></div>`;
    else if (kind === "pup" && id != null && ag.litter[id]) extra = `<div class="io"><b>Methylation</b><span>${Math.round(ag.litter[id].meth * 100)}%</span><b>Coat</b><span>${AGOUTI_CLASSES[ag.litter[id].cls].name}</span></div>`;
    selCard.style.display = "";
    selCard.innerHTML = `<h2>Selected</h2><p style="color:var(--ink);font-weight:600;margin-bottom:4px"><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};margin-right:6px"></i>${lens.pick(p.name)}</p><p>${lens.pick(p.role)}</p>${extra}`;
  }

  function buildPanel(el) {
    panelEl = el; el.innerHTML = "";
    const host = document.createElement("div"); host.style.display = "contents"; host.className = "epi"; el.appendChild(host);
    progress = { band: lens.band, node: host }; el = host;
    const band = lens.band, sen = lens.atLeast("y11");

    // ---- View card
    const vc0 = K.card(el, lens.pick({ "y7-8": "Choose a view", "y9-10": "View" }));
    viewSeg = K.segmented(vc0, VIEWS.map((v) => ({ value: v.id, label: lens.pick(v.label) })), state.view, (v) => setView(v));
    blurbEl = document.createElement("p"); blurbEl.className = "hint"; blurbEl.style.margin = "8px 0 0"; vc0.appendChild(blurbEl);
    noteEl = document.createElement("p"); noteEl.className = "hint"; vc0.appendChild(noteEl);
    hintBack = null;
    if (parentIsKaryotype()) { const r = K.buttonRow(vc0); K.button(r, "↩ Back to the karyotype", () => engine.up()); }
    const ex = K.card(el, "What's happening", "explain"); explainBody = document.createElement("div"); ex.appendChild(explainBody);
    selCard = K.card(el, "Selected", "sel-card"); selCard.style.display = "none";

    boxes = {};
    // ---- View 1 controls
    const bm = document.createElement("div"); bm.style.display = "contents"; el.appendChild(bm); boxes.marks = bm;
    const sg = K.card(bm, lens.pick({ "y7-8": "Switches", "y9-10": "Signals and drugs", y11: "Signals and drugs" }));
    K.slider(sg, { label: lens.pick({ "y7-8": "'On' switch (can add on-tags)", "y9-10": "Switch-on signal (activator)", y11: "Activator signal" }), min: 0, max: 1, step: 0.05, value: sim.act, format: (v) => (v === 0 ? "off" : `${Math.round(v * 100)}%`), onInput: (v) => (sim.act = v) });
    K.slider(sg, { label: lens.pick({ "y7-8": "'Off' switch (can add off-tags)", "y9-10": "Switch-off signal (repressor)", y11: "Repressor signal" }), min: 0, max: 1, step: 0.05, value: sim.rep, format: (v) => (v === 0 ? "off" : `${Math.round(v * 100)}%`), onInput: (v) => (sim.rep = v) });
    sg.insertAdjacentHTML("beforeend", `<p class="hint">${lens.pick({ "y7-8": "Switch protein stuck near the start of the gene, adding tags. Try the 'off' switch to silence the gene.", "y9-10": "A transcription factor binds near the promoter and can recruit writer enzymes. Turn the repressor up to silence the gene, then back to zero: does it stay silent?", y11: "Signals bias the promoter-window nucleosomes toward A (activator) or M (repressor). Remove the signal afterwards: with strong feedback the state can persist (memory); with weak feedback it fades." })}</p>`);
    if (lens.atLeast("y9-10")) {
      if (!sen) K.checkbox(sg, "Tags recruit more of the same tag (feedback)", sim.F >= 4, (v) => { sim.F = v ? 12 : 0; });
      else K.slider(sg, { label: "Feedback ratio F = α/(1−α)", min: 0, max: 24, step: 0.2, value: sim.F, format: (v) => `${v.toFixed(1)}${v === 0 ? " (off)" : v >= 4 ? " (strong)" : v < 2 ? " (weak)" : ""}`, onInput: (v) => (sim.F = v) });
    } else K.checkbox(sg, "Tags recruit more of the same tag (feedback)", sim.F >= 4, (v) => { sim.F = v ? 12 : 0; });
    if (sen) {
      K.checkbox(sg, "HDAC inhibitor (vorinostat-like): blocks acetyl removal", sim.hdaci, (v) => (sim.hdaci = v));
      K.checkbox(sg, "DNMT3 on (de novo CpG methylation)", sim.dnmt3, (v) => (sim.dnmt3 = v));
      sg.insertAdjacentHTML("beforeend", `<div class="subhead">Repressive system</div>`);
      K.segmented(sg, [{ value: "hp1", label: "H3K9me3 + HP1" }, { value: "prc2", label: "H3K27me3 + PRC2" }], repSys, (v) => (repSys = v));
    }
    const dv = K.card(bm, lens.pick({ "y7-8": "Cell division", "y9-10": "Cell division and memory", y11: "Replication and memory" }));
    const r1 = K.buttonRow(dv);
    divBtn = K.button(r1, "✂ Divide the cell", () => { if (settle > 0) return; sim.divide(); settle = 20; forkT = 0; divBtn.disabled = true; engine.toast?.("Replication: old histones are shared, so about half the marks are lost. Watch the feedback restore them."); }, { kind: "primary" });
    const r2 = K.buttonRow(dv);
    K.button(r2, "Reset: gene on", () => { settle = 0; sim.reset("A"); syncShown(); divBtn.disabled = false; });
    K.button(r2, "Reset: gene silent", () => { settle = 0; sim.reset("M"); syncShown(); divBtn.disabled = false; });
    K.slider(dv, { label: "Speed (model rounds per second)", min: 0.2, max: 3, step: 0.1, value: speed, format: (v) => `${v.toFixed(1)}×`, onInput: (v) => (speed = v) });
    K.checkbox(dv, "Show labels", state.labels, (v) => (state.labels = v));
    const cm = K.card(bm, lens.pick({ "y7-8": "Silent or on over time", "y9-10": "Tags over time", y11: "Fraction M / A over time" }));
    marksChart = document.createElement("canvas"); marksChart.className = "mini-chart"; marksChart.style.height = "140px"; marksChart.setAttribute("role", "img"); cm.appendChild(marksChart);
    cm.insertAdjacentHTML("beforeend", `<div class="legend" style="margin-top:6px"><span><i style="background:${METHYL}"></i>${sen ? "Fraction M (repressive)" : "Silencing tags"}</span><span><i style="background:#a3e635"></i>${sen ? "Fraction A (active)" : "Active tags"}</span>${sen ? `<span><i style="background:#f472b6"></i>CpG methylation</span>` : ""}<span><i style="background:#fbbf24"></i>cell division</span></div>`);
    cm.insertAdjacentHTML("beforeend", `<p class="hint">${lens.pick({ "y7-8": "Dashed yellow lines mark a division. If the violet line (off-tags) jumps down and then comes back, the cell remembered.", "y9-10": "Each dashed line is a division. With feedback, the tags dip then recover: that is memory. Without feedback they do not recover.", y11: "Dodd–Sneppen model, N = 20, one round = N update steps. After each replication M and A fall to about half and feedback restores them. Time is in model rounds, not hours." })}</p>`);

    // ---- View 2 controls
    const bx = document.createElement("div"); bx.style.display = "contents"; el.appendChild(bx); boxes.x = bx;
    const xs0 = K.card(bx, lens.pick({ "y7-8": "Nucleus or cell sheet?", "y9-10": "Scene" }));
    xSceneSeg = K.segmented(xs0, [{ value: "nucleus", label: lens.pick({ "y7-8": "One cell", y11: "A: one nucleus" }) }, { value: "sheet", label: lens.pick({ "y7-8": "Sheet of cells", y11: "B: cell mosaic" }) }], state.xScene, (v) => setXScene(v));
    const xN = document.createElement("div"); xN.style.display = "contents"; bx.appendChild(xN); boxes.xN = xN;
    const kc = K.card(xN, lens.pick({ "y7-8": "Switch an X off", "y9-10": "Barr bodies = number of X − 1", y11: "Karyotype and Barr bodies" }));
    const bw = K.buttonRow(kc);
    K.button(bw, "Switch one X off", startInactivation, { kind: "primary" });
    K.button(bw, "Reset", resetInactivation);
    if (lens.atLeast("y9-10")) {
      kc.insertAdjacentHTML("beforeend", `<div class="subhead">Karyotype</div>`);
      ktSeg = K.segmented(kc, Object.keys(KARYOTYPES).map((k) => ({ value: k, label: KARYOTYPES[k].label })), xs.kt, (v) => setKaryotype(v));
      kc.insertAdjacentHTML("beforeend", `<p class="hint" id="epi-ktname">${KARYOTYPES[xs.kt].name}</p>`);
      ktName = kc.querySelector("#epi-ktname");
      kc.insertAdjacentHTML("beforeend", `<div class="subhead">Predict first: how many Barr bodies?</div>`);
      const pr = K.buttonRow(kc);
      [0, 1, 2, 3].forEach((n) => K.button(pr, String(n), (_, b) => { S.pred[xs.kt] = n; engine.toast?.(`Predicted ${n}. Now press <b>Switch one X off</b> and check.`); [...pr.children].forEach((x) => x.setAttribute("aria-pressed", String(x === b))); }, { toggle: true, pressed: S.pred[xs.kt] === n }));
      predRow = pr;
    } else ktSeg = null;
    kc.insertAdjacentHTML("beforeend", `<p class="hint">${lens.pick({ "y7-8": "The Barr body is the tightly packed, mostly switched-off X. In body cells, one X normally stays working.", "y9-10": "In the body cells modelled here, Barr bodies = number of X chromosomes − 1, and one X normally stays active.", y11: "The count rule: nBarr = nX − 1 (body cells of placental mammals). Escape genes (human estimates: roughly 15% of X-linked genes, plus ~10% variable; this varies by gene, tissue and person) keep being expressed from Xi, which is part of why X0, XXY and XXX still have clinical effects." })}</p>`);
    if (parentIsKaryotype()) { const r = K.buttonRow(kc); K.button(r, "↩ Back to the karyotype", () => engine.up()); }
    const xS = document.createElement("div"); xS.style.display = "contents"; bx.appendChild(xS); boxes.xS = xS;
    const mc = K.card(xS, lens.pick({ "y7-8": "Make a patchwork", "y9-10": "Clonal mosaic" }));
    K.slider(mc, { label: lens.pick({ "y7-8": "Cells that switch an X off first", "y9-10": "Founder cells (later inactivation = more)" }), min: 2, max: 32, step: 1, value: mo.founders, format: (v) => `${v}`, onInput: (v) => (mo.founders = v) });
    if (sen) K.slider(mc, { label: "Skew: chance X₂ is the one switched off", min: 0.1, max: 0.9, step: 0.05, value: mo.skew, format: (v) => `${Math.round(v * 100)}%`, onInput: (v) => (mo.skew = v) });
    mc.insertAdjacentHTML("beforeend", `<div class="subhead">Example</div>`);
    K.segmented(mc, [{ value: "cat", label: lens.pick({ "y7-8": "🐈 Calico cat", y11: "Tortoiseshell / calico cat" }) }, { value: "aed", label: lens.pick({ "y7-8": "Skin glands", y11: "XLHED carrier" }) }], mo.example, (v) => { mo.example = v; if (mo.used) mo.used.example = v; recolourMosaic(); });
    const mr = K.buttonRow(mc);
    K.button(mr, "▶ Start inactivation", startMosaic, { kind: "primary" });
    K.button(mr, "Reset", resetMosaic);
    mc.insertAdjacentHTML("beforeend", `<div class="legend" id="epi-mlegend" style="margin-top:6px"></div>`);
    mc.insertAdjacentHTML("beforeend", `<p class="hint">${lens.pick({ "y7-8": "In a tortoiseshell or calico cat, the orange and black colour gene is on the X chromosome. Each patch is one family of cells that kept the same X working. Calico cats are almost always female, because males have only one X. (White patches come from a different gene.)", "y9-10": "Cat coat colour: an X-linked gene with an orange (O) and a black (o) version. A female with one of each shows both colours in patches, because each cell switches off one X at random and its daughters inherit that choice. Calico cats are almost always female; rare XXY males can be calico too. The white patches come from a separate, non-X gene.", y11: "X-linked <i>Orange</i> (O/o) in cats; a heterozygous female is a mosaic of cells expressing O or o. White spotting is a separate autosomal gene (so “calico” = mosaic X + white spotting). XXY males (Klinefelter) can be tortoiseshell/calico and are usually sterile. In the X-linked hypohidrotic ectodermal dysplasia (XLHED) example, patchy sweat glands in a carrier mark which X is active in each lineage. The sheet is a teaching simulation: clones are placed by nearest-neighbour growth, which does not capture cell movement in a real embryo." })}</p>`);
    mc.querySelector("#epi-mlegend").dataset.live = "1";

    // ---- View 3 controls
    const be = document.createElement("div"); be.style.display = "contents"; el.appendChild(be); boxes.env = be;
    if (state.ex === "twins" && !lens.atLeast("y11")) state.ex = "vern";
    const ec = K.card(be, lens.pick({ "y7-8": "Pick an experiment", "y9-10": "Experiment bench" }));
    exSeg = K.segmented(ec, ENV_EXAMPLES.filter((e) => !e.band || lens.atLeast(e.band)).map((e) => ({ value: e.id, label: lens.pick(e.label) })), state.ex, (v) => setEx(v));
    // vernalisation
    const bv = document.createElement("div"); bv.style.display = "contents"; be.appendChild(bv); boxes.vern = bv;
    const vcd = K.card(bv, lens.pick({ "y7-8": "Winter in a plant", "y9-10": "Vernalisation", y11: "Vernalisation of FLC" }));
    vernSlider = K.slider(vcd, { label: "Weeks of cold", min: 0, max: 10, step: 1, value: vern.weeks, format: (v) => `${v} week${v === 1 ? "" : "s"}`, onInput: (v) => { vern.weeks = v; vernRefresh(); } });
    vernSlider.input.disabled = vern.warm;
    const vr = K.buttonRow(vcd);
    K.button(vr, "☀ Warm and grow", vernWarm, { kind: "primary" });
    K.button(vr, "🌱 New generation (seeds)", vernNewGen);
    vcd.insertAdjacentHTML("beforeend", `<div class="legend" style="margin-top:6px"><span><i style="background:${vNucOn}"></i>FLC on (blocks flowering)</span><span><i style="background:#4a5d78"></i>FLC off (silenced)</span><span><i style="background:#5eead4"></i>% cells off</span><span><i style="background:#fbbf24"></i>weeks to flower</span></div>`);
    // agouti
    const ba = document.createElement("div"); ba.style.display = "contents"; be.appendChild(ba); boxes.agouti = ba;
    const acd = K.card(ba, lens.pick({ "y7-8": "Mother mouse's food", "y9-10": "Diet and coat colour", y11: "Maternal methyl-donor diet" }));
    K.slider(acd, { label: lens.pick({ "y7-8": "Vitamin-rich food (folate, B12...)", "y9-10": "Methyl-donor supplement", y11: "Methyl donors (folate, B12, choline, betaine)" }), min: 0, max: 1, step: 0.05, value: ag.diet, format: (v) => (v < 0.05 ? "none" : `${Math.round(v * 100)}%`), onInput: (v) => (ag.diet = v) });
    const ar = K.buttonRow(acd);
    K.button(ar, "🐭 Breed a litter of 8", newLitter, { kind: "primary" });
    K.button(ar, "Clear results", () => { ag.litter = []; ag.total = 0; ag.counts = [0, 0, 0, 0]; ag.brownShare = 0; ag.litterDiet = ag.diet; });
    acd.insertAdjacentHTML("beforeend", `<div class="legend" style="margin-top:6px">${AGOUTI_CLASSES.map((c) => `<span><i style="background:${c.color}"></i>${c.name}</span>`).join("")}<span><i style="background:#f472b6"></i>methylation meter</span></div>`);
    acd.insertAdjacentHTML("beforeend", `<p class="hint">Bars = the current litter; white lines = the share expected at the diet it was bred on.</p>`);
    // rabbit
    const brb = document.createElement("div"); brb.style.display = "contents"; be.appendChild(brb); boxes.rabbit = brb;
    const rcd = K.card(brb, lens.pick({ "y7-8": "Shave and cool", "y9-10": "Shave and cool a patch", y11: "Shave-and-cool experiment" }));
    K.slider(rcd, { label: "Temperature of the cooled patch", min: 22, max: 38, step: 1, value: rb.temp, format: (v) => `${v} °C`, onInput: (v) => { rb.temp = v; } });
    const rr = K.buttonRow(rcd);
    K.button(rr, "✂ Shave and cool the patch", rabbitShave, { kind: "primary" });
    K.button(rr, "Let the fur regrow", rabbitRegrow);
    K.button(rr, "Reset", rabbitReset);
    const why = document.createElement("div"); why.className = "ev"; why.style.marginTop = "8px";
    const whyBtn = K.button(K.buttonRow(rcd), "❓ Why isn't this epigenetic?", () => { rb.why = !rb.why; if (rb.why && rb.regrown) S.rabbitWhy = true; why.innerHTML = rb.why ? lens.pick({ "y7-8": "All the pigment cells carry the same temperature-sensitive enzyme and the DNA is unchanged. The enzyme that makes dark colour simply works less well when it is warm. Nothing is being remembered: change the temperature again and the new fur changes colour again.", "y9-10": "No tags are added to the gene and no cell memory is needed. Every pigment cell makes the same temperature-sensitive enzyme. Epigenetics means heritable changes in gene activity <i>without</i> a change in the DNA sequence, usually through marks on DNA and histones. Here the change is in how the protein behaves.", y11: "<b>Not epigenetic:</b> Pigment-producing melanocytes carry the same temperature-sensitive <i>TYR</i> allele (c<sup>h</sup>); local temperature changes the enzyme's activity, so pigment follows local temperature, and no chromatin change is needed to explain the pattern. If the cooled patch is warmed again, newly grown fur is pale again (no memory). Compare vernalisation, where cold causes a self-maintaining chromatin state that persists after the cold ends." }) : ""; });
    rcd.appendChild(why); void whyBtn;
    // twins
    const bt = document.createElement("div"); bt.style.display = "contents"; be.appendChild(bt); boxes.twins = bt;
    if (lens.atLeast("y11")) {
      const tcd = K.card(bt, "Identical twins over time");
      K.slider(tcd, { label: "Age", min: 0, max: 80, step: 1, value: tw.age, format: (v) => `${v} years`, onInput: (v) => { tw.age = v; twinRefresh(); } });
      K.slider(tcd, { label: "Difference in lifestyle and environment", min: 0, max: 1, step: 0.05, value: tw.env, format: (v) => (v < 0.2 ? "very similar" : v > 0.7 ? "quite different" : "somewhat different"), onInput: (v) => { tw.env = v; twinRefresh(); } });
      K.button(K.buttonRow(tcd), "New random twins", () => { tw.draws = twinDraws(seed()); twinRefresh(); });
      tcd.insertAdjacentHTML("beforeend", `<div class="legend" style="margin-top:6px"><span><i style="background:#f472b6"></i>methylated</span><span><i style="background:#7dd3fc"></i>unmethylated</span><span><i style="background:#fde047"></i>ring = differs</span><span style="color:#7dd3fc">blue line: similar lives</span><span style="color:#f472b6">pink line: different lives</span></div>`);
    }
    // chart + evidence (shared by all examples)
    const evc = K.card(be, lens.pick({ "y7-8": "The numbers", "y9-10": "Graph", y11: "Graph" }));
    envChart = document.createElement("canvas"); envChart.className = "mini-chart"; envChart.style.height = "150px"; envChart.setAttribute("role", "img"); evc.appendChild(envChart);
    const evd = K.card(be, lens.pick({ "y7-8": "What this shows", "y9-10": "Evidence and caveats", y11: "Evidence and caveats" }));
    evd.id = "epi-evid"; evd.querySelector("h2").insertAdjacentHTML("afterend", `<div class="ev" id="epi-evbody"></div>`);

    // ---- heritable card (all views)
    const hc = K.card(el, lens.pick(HERITABLE.title));
    const row = (r) => `<tr><td>${lens.pick(r.c)}</td><td>${lens.pick(r.d)}</td><td>${lens.pick(r.p)}</td></tr>`;
    hc.insertAdjacentHTML("beforeend", `<table class="epi-her"><tr><th>${lens.pick(HERITABLE.head.c)}</th><th>${lens.pick(HERITABLE.head.d) || "Copied when cells divide?"}</th><th>${lens.pick(HERITABLE.head.p) || "Passed to children?"}</th></tr>${HERITABLE.rows.map(row).join("")}</table><p class="hint" style="margin-top:6px">${lens.pick(HERITABLE.note)}</p>`);

    // ---- missions and quiz
    mission = K.missions(el, lens.filter(MISSIONS).map((m) => ({ text: m.text, check: () => m.check(S) })), (m) => engine.toast(`🎯 Mission complete: ${m.text.replace(/<[^>]+>/g, "")}`, 3600));
    K.quiz(el, lens.filter(QUIZ));
    refreshPanelForView();
    updateEvidence();
  }
  let mission = null;
  function updateEvidence() {
    const e = panelEl?.querySelector("#epi-evbody"); if (!e) return;
    const html = lens.pick(EVIDENCE[state.ex]) || "";
    if (e.innerHTML !== html) e.innerHTML = html;
    const lg = panelEl.querySelector("#epi-mlegend");
    if (lg) { const c = MCOL[mo.example]; const names = mo.example === "cat" ? ["black (o) active", "orange (O) active"] : ["sweat glands (normal X active)", "no glands (mutant X active)"]; const h = `<span><i style="background:${c[0][0]}"></i>${names[0]}</span><span><i style="background:${c[1][0]}"></i>${names[1]}</span>`; if (lg.innerHTML !== h) lg.innerHTML = h; }
  }

  // ===================================================================================================================
  // the level
  // ===================================================================================================================
  let uiT = 0, exT = 0, chT = 0, startApplied = false, mountedOnce = false;
  const level = {
    title: "Epigenetics",
    topics: ["epigenetics", "genes", "inheritance", "chromatin", "x-inactivation", "environment"],
    root, pickables, portals: [], model: sim, state: S,
    get metersPerUnit() { const k = sceneKey(); return k === "marks" ? 1e-8 : k === "nucleus" ? 1.5e-7 : k === "sheet" ? 1e-6 : 1e-6; },
    get showScale() { const k = sceneKey(); return k === "marks" || k === "nucleus" || k === "sheet"; },
    get view() { const v = viewSpec(); return { target: v.target, distance: v.distance, dir: v.dir }; },
    minDistance: 6, maxDistance: 230, near: 0.3, far: 3000,
    enablePan: true,
    env: ENVS.marks,
    info(obj) { const k = obj.userData.kind; if (!k || !PARTS[k]) return null; return { title: lens.pick(PARTS[k].name), kind: k, portal: null }; },
    onClick(e, hit) { lastHit = hit; return false; },
    onSelect(info) { showSelection(info); },
    mountPanel(el) {
      if (!startApplied) {
        startApplied = true;
        const st = engine.stack.at(-1)?.portal?.start;
        if (st) {
          if (st.karyotype && KARYOTYPES[st.karyotype]) { setKaryotype(st.karyotype); if (!st.view) state.view = "x"; }
          if (st.view && ["marks", "x", "env"].includes(st.view)) state.view = st.view;
          if (state.view === "x" && st.karyotype) engine.toast?.("Press <b>Switch one X off</b> to see the Barr bodies.");
        }
        applyVisibility();
      }
      engine.applyEnv?.(ENVS[sceneKey()], level);
      { const v = viewSpec(); engine.controls.minDistance = v.min; engine.controls.maxDistance = v.max; }
      makeLabels();
      if (progress && progress.band === lens.band) { panelEl = el; el.appendChild(progress.node); refreshPanelForView(); updateEvidence(); }
      else buildPanel(el);
      mountedOnce = true;
    },
    unmountPanel() { for (const l of labels) l.el.style.display = "none"; },
    onResume() { makeLabels(); },
    onLens() {
      const before = sceneKey();
      if (state.ex === "twins" && !lens.atLeast("y11")) state.ex = "vern";       // senior-only experiment: fall back before rebuilding
      if (sceneKey() !== before) applyScene();
      progress = null; makeLabels(); buildPanel(panelEl);
    },
    onStyle() { /* clay: sprites and dust carry userData.clayHide; shaders fall back to the clay material */ },
    dispose() { alive = false; gen++; state.busy = false; for (const l of labels) l.el.remove(); },
    update(dt, t, rdt = dt) {
      applyVisibility();
      if (state.view === "marks") updateMarks(dt, t);
      else if (state.view === "x") { if (state.xScene === "nucleus") updateNucleus(dt, t); else updateMosaic(dt, t); }
      else if (state.ex === "vern") updateVern(dt, t);
      else if (state.ex === "agouti") updateAgouti(dt, t);
      else if (state.ex === "rabbit") updateRabbit(dt, t);
      updateLabels();
      uiT -= rdt; exT -= rdt; chT -= rdt;
      if (exT <= 0) { exT = 0.4; updateExplain(); updateEvidence(); }
      if (chT <= 0) { chT = 0.4; drawCharts(); }
      if (rb.regrown && rb.why) S.rabbitWhy = true;
      mission?.update();
    },
  };
  // initial state
  syncShown();
  setKaryotype("XX");
  vernRefresh(true); rabbitRefresh(true); twinRefresh(); newLitter(); ag.litter = []; ag.total = 0; ag.counts = [0, 0, 0, 0]; S.agoutiMaxBrown = 0;
  S.vernMax = 0;
  for (let i = 0; i < 300; i++) mosField.show(i, false, true);
  applyVisibility();
  makeLabels();
  return level;
}
