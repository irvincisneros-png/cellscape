// Level: Immune defence (Phase 5d). A wound in the skin beside a small blood vessel, a phagocytosis close-up and a lymph-node view.
// Units: 1 world unit = 1 µm, and the cells are drawn to scale (bacillus ~2 µm, neutrophil ~12 µm, macrophage ~21 µm, red cell ~7.5 µm).
// Antibodies and viruses are far smaller than that, so they are drawn enlarged (and the page says so).
// Behaviour comes from the response model in immunityModel.js; the 3D parts only draw what the model says.
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import * as K from "../../kit.js";
import { physical, glass, specks, hash, wobble, softDot, paint } from "../materials.js";
import { ImmuneModel, PATHOGENS, DAY_SECONDS, DETECT, HerdSim, herdThreshold, coverageNeeded, herdReached, DISEASES, HERD_R0_MAX } from "./immunityModel.js";
import { NOTE, STAGES, STAGE_BLURB, PHAGO_STEPS, PARTS, DEFENCES, COMPARE, CLASSIFY, HERD_NOTE, MISSIONS, QUIZ, narrative } from "./immunityContent.js";

// ---------- layout constants (µm) ----------
const VY = -34;                         // blood vessel centre line (y); the skin sits above it
const WX = -6;                          // x of the cut
const EPI_BOT = 8, EPI_TOP = 31;        // epidermis (stylised: real epidermis is thicker)
const R0 = 11, R1 = 4.2;                // vessel radius at rest, and how much it widens when inflamed
const WC = new THREE.Vector3(WX, 3, 0); // the wound bed
const GAPX = [-12.5, -8.5, -4.5];       // leaky sites on the vessel wall nearest the wound
const NB = 120, NNEU = 16, NMAC = 6, NTC = 6, NHOST = 8, NRBC = 70, NSIG = 110, NABF = 80, NABC = 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sat = (x, k) => (x <= 0 ? 0 : x / (x + k));
const smooth = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function mulberry32(a) { return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const XAX = new THREE.Vector3(1, 0, 0), YAX = new THREE.Vector3(0, 1, 0), ZAX = new THREE.Vector3(0, 0, 1);
const gapHalf = (y) => 2.2 + clamp((y - EPI_BOT) / (EPI_TOP - EPI_BOT), 0, 1) * 2.1;
const SPEEDS = [0.5, 1, 2, 4, 8];

// ---------- geometry builders ----------
/** A tube along a curve whose radius follows rFn(u) (0..1). Index order is root to tip so setDrawRange can grow it. */
function taperedTube(curve, segs, radial, rFn) {
  const pos = [], nor = [], idx = [];
  const fr = curve.computeFrenetFrames(segs, false), P = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const u = i / segs, r = rFn(u), n = fr.normals[i], b = fr.binormals[i];
    curve.getPointAt(u, P);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const nx = n.x * c + b.x * s, ny = n.y * c + b.y * s, nz = n.z * c + b.z * s;
      pos.push(P.x + nx * r, P.y + ny * r, P.z + nz * r); nor.push(nx, ny, nz);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}
const sphereAt = (r, x, y, z, color, sx = 1, sy = 1, sz = 1, seg = 10) => { const g = new THREE.SphereGeometry(r, seg, Math.max(5, seg - 3)); g.scale(sx, sy, sz); g.translate(x, y, z); return paint(g, color); };
const randDir = (rng, out) => { const u = rng() * 2 - 1, a = rng() * Math.PI * 2, s = Math.sqrt(1 - u * u); return out.set(s * Math.cos(a), u, s * Math.sin(a)); };

function bacillusGeometry() { const g = new THREE.CapsuleGeometry(0.3, 1.4, 4, 10); g.rotateZ(Math.PI / 2); return g; }
function flagellaGeometry() {
  const parts = [];
  for (let k = 0; k < 3; k++) {
    const pts = [], ph = k * 2.1, y0 = (k - 1) * 0.12;
    for (let i = 0; i <= 14; i++) { const u = i / 14; pts.push(new THREE.Vector3(-0.95 - 5.5 * u, y0 + Math.sin(u * 17 + ph) * (0.05 + 0.32 * u), Math.cos(u * 17 + ph) * (0.05 + 0.32 * u))); }
    parts.push(taperedTube(new THREE.CatmullRomCurve3(pts), 28, 5, (u) => 0.055 * (1 - 0.5 * u)));
  }
  return mergeGeometries(parts);
}
function virusGeometry() {
  const parts = [new THREE.IcosahedronGeometry(0.42, 1).toNonIndexed()];
  const N = 14, v = new THREE.Vector3(), q = new THREE.Quaternion();
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), a = i * 2.399963;
    v.set(Math.cos(a) * r, y, Math.sin(a) * r);
    const c = new THREE.ConeGeometry(0.07, 0.3, 5).toNonIndexed();
    c.translate(0, 0.5, 0);
    c.applyQuaternion(q.setFromUnitVectors(YAX, v));
    parts.push(c);
  }
  for (const p of parts) { p.deleteAttribute("uv"); }
  return mergeGeometries(parts);
}
function antibodyGeometry() {
  const arm = (sign) => {
    const g = new THREE.CapsuleGeometry(0.11, 0.5, 3, 6); g.translate(0, 0.42, 0); g.rotateZ(sign * 0.62);
    const t = new THREE.SphereGeometry(0.15, 7, 5); t.translate(0, 0.84, 0); t.rotateZ(sign * 0.62);
    return [paint(g, "#9fd2ff"), paint(t, "#fbbf24")];
  };
  const stem = new THREE.CapsuleGeometry(0.12, 0.42, 3, 6); stem.translate(0, -0.33, 0);
  const parts = [paint(stem, "#dbe7f5"), ...arm(1), ...arm(-1)];
  for (const p of parts) { if (p.index) { /* paint() returns non-indexed when indexed */ } }
  const out = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
  out.translate(0, -0.1, 0);
  return out;
}
function rbcGeometry() {                       // Evans-Fung biconcave disc, 7.8 µm across
  const D = 7.8, C0 = 0.207161, C1 = 2.002558, C2 = -1.122762, pts = [];
  const prof = (rho) => 0.5 * D * 0.5 * Math.sqrt(Math.max(0, 1 - rho * rho)) * (C0 + C1 * rho * rho + C2 * rho ** 4);
  for (let i = 0; i <= 14; i++) { const rho = i / 14; pts.push(new THREE.Vector2(rho * D / 2, -prof(rho))); }
  for (let i = 13; i >= 0; i--) { const rho = i / 14; pts.push(new THREE.Vector2(rho * D / 2, prof(rho))); }
  const g = new THREE.LatheGeometry(pts, 20); g.computeVertexNormals();
  return g;
}
function neutrophilParts() {
  const nuc = mergeGeometries([
    sphereAt(1.9, -3.1, -0.7, 0.1, "#7c5bb3", 1, 1, 1, 12), sphereAt(1.8, -1.0, 1.3, 0.5, "#8b66c4", 1, 1, 1, 12),
    sphereAt(1.8, 1.4, 0.9, -0.4, "#7c5bb3", 1, 1, 1, 12), sphereAt(1.7, 3.2, -1.0, 0.2, "#8b66c4", 1, 1, 1, 12),
    paint(new THREE.CapsuleGeometry(0.4, 2.0, 3, 6).rotateZ(1.1).translate(-2.1, 0.3, 0.3), "#6d4aa3"),
    paint(new THREE.CapsuleGeometry(0.4, 2.0, 3, 6).rotateZ(-1.3).translate(0.2, 1.1, 0.0), "#6d4aa3"),
    paint(new THREE.CapsuleGeometry(0.4, 1.9, 3, 6).rotateZ(1.0).translate(2.3, -0.1, -0.1), "#6d4aa3"),
  ].map((g) => (g.index ? g.toNonIndexed() : g)));
  const rng = mulberry32(5), gp = [], v = new THREE.Vector3();
  for (let i = 0; i < 22; i++) { randDir(rng, v).multiplyScalar(2.6 + rng() * 2.4); gp.push(sphereAt(0.36, v.x, v.y, v.z, i % 3 ? "#f3a9c4" : "#ffd29a", 1, 1, 1, 6)); }
  return { nuc, gran: mergeGeometries(gp.map((g) => (g.index ? g.toNonIndexed() : g))) };
}
function macrophageParts() {
  let body = new THREE.IcosahedronGeometry(10.5, 5);
  body.deleteAttribute("uv"); body.deleteAttribute("normal");
  body = wobble(mergeVertices(body), 0.32, 0.3, 3.1);
  const nuc = mergeGeometries([sphereAt(3.6, -1.6, 1.0, 0, "#6f56ad", 1.15, 1, 0.9, 14), sphereAt(3.4, 2.4, 0.2, 0.4, "#7a5fbd", 1, 1, 0.9, 14), sphereAt(2.2, 0.4, 0.8, 0, "#6f56ad", 1, 1, 1, 10)].map((g) => (g.index ? g.toNonIndexed() : g)));
  const rng = mulberry32(11), parts = [], v = new THREE.Vector3();
  for (let i = 0; i < 16; i++) { randDir(rng, v).multiplyScalar(5.5 + rng() * 3.6); parts.push(sphereAt(0.5 + rng() * 0.45, v.x, v.y, v.z, i % 2 ? "#f08a6a" : "#f8c27a", 1, 1, 1, 7)); }
  for (let i = 0; i < 5; i++) { randDir(rng, v).multiplyScalar(4.8 + rng() * 3); const m = paint(new THREE.CapsuleGeometry(0.5, 1.5, 3, 6).rotateZ(rng() * 3).rotateY(rng() * 3).translate(v.x, v.y, v.z), "#ff9d4d"); parts.push(m.index ? m.toNonIndexed() : m); }
  return { body, nuc, vesicles: mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g))) };
}
function granuleCloud(n, radius, r, color, seed) {
  const rng = mulberry32(seed), v = new THREE.Vector3(), ps = [];
  for (let i = 0; i < n; i++) { randDir(rng, v).multiplyScalar(radius * (0.35 + 0.6 * Math.cbrt(rng()))); ps.push(sphereAt(r * (0.75 + rng() * 0.5), v.x, v.y, v.z, color, 1, 1, 1, 6)); }
  return mergeGeometries(ps.map((g) => (g.index ? g.toNonIndexed() : g)));
}
function dendriteGeometry(seed, n = 11, r0 = 5.2) {
  const rng = mulberry32(seed), parts = [], curves = [], v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    randDir(rng, v);
    const a = v.clone().multiplyScalar(r0 * 0.7), b = v.clone().multiplyScalar(r0 + 4 + rng() * 5).add(new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(4));
    const c = v.clone().multiplyScalar(r0 + 9 + rng() * 6).add(new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(6));
    const cv = new THREE.CatmullRomCurve3([a, b, c]);
    curves.push(cv);
    parts.push(taperedTube(cv, 14, 6, (u) => 1.15 * (1 - u) + 0.22));
  }
  return { geo: mergeGeometries(parts), curves };
}

/** Adds a slow surface ruffle (macrophage and dendritic cell edges) to a glass material. */
function addRuffle(mat, uTime, amp, freq, key) {
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh) => {
    base.call(mat, sh);
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader
      .replace("void main() {", `uniform float uTime;\nvoid main() {`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
        #else
          vec3 ip = vec3(0.0);
        #endif
        float rf = sin(position.x * ${freq.toFixed(2)} + uTime * 0.9 + ip.x) * sin(position.y * ${(freq * 1.3).toFixed(2)} - uTime * 0.7 + ip.z) + 0.6 * sin(position.z * ${(freq * 1.7).toFixed(2)} + position.x * 0.4 + uTime * 1.1);
        transformed += normalize(objectNormal) * rf * ${amp.toFixed(2)};`);
  };
  const k0 = mat.customProgramCacheKey;
  mat.customProgramCacheKey = () => `${k0.call(mat)}ruffle${key}${amp}${freq}`;
  return mat;
}

export function create(engine) {
  const lens = engine.lens;
  const M = new ImmuneModel();
  const rng = mulberry32(20261010);
  const root = new THREE.Group();
  const gW = new THREE.Group(), gP = new THREE.Group(), gN = new THREE.Group();     // the three views: wound, phagocytosis, lymph node
  root.add(gW, gP, gN);
  gP.visible = gN.visible = false;
  const pickables = [];
  const uTime = { value: 0 };
  const tV = new THREE.Vector3(), tV2 = new THREE.Vector3(), tV3 = new THREE.Vector3(), tQ = new THREE.Quaternion(), tQ2 = new THREE.Quaternion();
  const tM = new THREE.Matrix4(), tS = new THREE.Vector3(), tC = new THREE.Color(), tC2 = new THREE.Color(), IDQ = new THREE.Quaternion();
  const tag = (m, kind) => { m.userData.kind = kind; pickables.push(m); return m; };
  const mkInst = (geo, mat, n, parent, kind) => {
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.frustumCulled = false; m.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 140);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0;
    parent.add(m); if (kind) tag(m, kind);
    return m;
  };
  const put = (meshes, i, p, q, sx, sy = sx, sz = sx) => { tS.set(sx, sy, sz); tM.compose(p, q, tS); for (const m of meshes) m.setMatrixAt(i, tM); };
  const done = (meshes, n) => { for (const m of meshes) { m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; } };
  const membrane = (c, rim, o = {}) => glass(c, { rim, rimPower: 2.1, rimStrength: 0.75, minAlpha: 0.1, maxAlpha: 0.72, ...o });

  let stage = "wound", pathId = "bacterium", speed = 1, showLabels = lens.band === "y7-8" || lens.band === "y9-10", prion = false;
  let clayOn = false;
  let skip = null;                                   // fast-forward: { until(), then() , rate }
  const ms = { digested: false, pickedTc: false, herd: false };
  let phi = 0, R = R0;                               // vessel widening (0..1) and current lumen radius

  // =====================================================================================================================
  // VIEW 1: the wound
  // =====================================================================================================================
  // ---------- skin: epidermis cells (instanced), basement membrane, wound bed ----------
  const epiGeo = new THREE.SphereGeometry(0.5, 14, 10);
  const epiMat = physical("#ffffff", { roughness: 0.5, clearcoat: 0.55, clearcoatRoughness: 0.3, sheen: 0.9, sheenColor: new THREE.Color("#ffd3d6") });
  const LAY = [
    { y: 10.2, h: 7.2, w: 8.0, col: "#cb6781", off: 0 },     // stratum basale: a single layer of columnar stem cells
    { y: 15.4, h: 7.6, w: 9.4, col: "#df8c9b", off: 0.5 },    // stratum spinosum
    { y: 20.4, h: 6.6, w: 9.8, col: "#e99fa4", off: 0 },
    { y: 24.6, h: 4.2, w: 10.2, col: "#edb69e", off: 0.5 },   // stratum granulosum: flatter
    { y: 27.8, h: 2.1, w: 10.8, col: "#e6bf98", off: 0 },     // stratum corneum: flat dead flakes
    { y: 29.8, h: 1.8, w: 11.0, col: "#ecc9a6", off: 0.5 },
  ];
  const epiMesh = mkInst(epiGeo, epiMat, 700, gW, "epidermis");
  const dmgCells = [];                                           // damaged cells beside the cut (they release signals)
  {
    let n = 0;
    for (const L of LAY) {
      for (let i = 0; i < 15; i++) for (let j = 0; j < 6; j++) {
        const x = -70 + (i + L.off) * 10 + (rng() - 0.5) * 1.6, z = -25 + j * 10 + L.off * 5 + (rng() - 0.5) * 1.6, y = L.y + (rng() - 0.5) * 0.8;
        const dx = Math.abs(x - WX), gh = gapHalf(y);
        if (dx < gh + L.w * 0.32) continue;
        const dmg = dx < gh + L.w * 0.5 + 5;
        tV.set(x, y, z);
        tQ.setFromEuler(new THREE.Euler(0, rng() * 3, 0));
        const sx = L.w * (0.92 + rng() * 0.12), sy = L.h * (0.92 + rng() * 0.12);
        tS.set(sx, sy, sx); tM.compose(tV, tQ, tS); epiMesh.setMatrixAt(n, tM);
        tC.set(L.col); if (dmg) tC.lerp(tC2.set("#b0283a"), 0.45); tC.offsetHSL((rng() - 0.5) * 0.015, 0, (rng() - 0.5) * 0.04);
        epiMesh.setColorAt(n, tC);
        if (dmg && L.y < 26 && z > -12) dmgCells.push(new THREE.Vector3(x, y, z));
        n++;
      }
    }
    epiMesh.count = n; epiMesh.instanceMatrix.needsUpdate = true;
  }
  const bmMat = physical("#cdb89a", { roughness: 0.6, clearcoat: 0.1 });
  for (const [x0, x1] of [[-72, WX - gapHalf(EPI_BOT) - 0.2], [WX + gapHalf(EPI_BOT) + 0.2, 72]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.45, 58), bmMat);
    b.position.set((x0 + x1) / 2, EPI_BOT - 0.3, 0); gW.add(b);
  }
  const bedGeo = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);   // lower half
  const bed = tag(new THREE.Mesh(bedGeo, glass("#7a1424", { rim: "#d65a5a", rimPower: 2.4, minAlpha: 0.12, maxAlpha: 0.45 })), "cut");
  bed.scale.set(5.2, 4.6, 29); bed.position.set(WX, EPI_BOT - 0.4, 0); gW.add(bed);
  // fibrin strands over the cut (a clot): thin curved threads
  {
    const parts = [];
    for (let i = 0; i < 16; i++) {
      const a = new THREE.Vector3(WX - 4 + rng() * 2, 7 + rng() * 3, -26 + rng() * 52), b = new THREE.Vector3(WX + 4 - rng() * 2, 7 + rng() * 3, a.z + (rng() - 0.5) * 8);
      parts.push(taperedTube(new THREE.CatmullRomCurve3([a, a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 2 + rng() * 2, 0)), b]), 8, 4, () => 0.09));
    }
    const clot = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshPhysicalMaterial({ color: "#ffb4a8", roughness: 0.4, transparent: true, opacity: 0.55, depthWrite: false }));
    clot.userData.clayHide = true; gW.add(clot);
  }

  // ---------- dermis: collagen fibres ----------
  {
    const cg = new THREE.CylinderGeometry(0.13, 0.13, 1, 5, 1, true);
    cg.rotateZ(Math.PI / 2);
    const fib = mkInst(cg, physical("#e8d9bf", { roughness: 0.55, clearcoat: 0.2, transparent: true, opacity: 0.6, depthWrite: false }), 130, gW, null);
    let n = 0;
    while (n < 130) {
      const x = -66 + rng() * 132, y = -52 + rng() * 56, z = -28 + rng() * 56;
      if (Math.hypot(y - VY, z) < R0 + R1 + 20) continue;
      if (y > 3 && Math.abs(x - WX) < 6) continue;
      tV.set(x, y, z);
      tQ.setFromEuler(new THREE.Euler((rng() - 0.5) * 0.5, (rng() - 0.5) * 1.2, (rng() - 0.5) * 0.7));
      const len = 10 + rng() * 22; tS.set(len, 1, 1); tM.compose(tV, tQ, tS); fib.setMatrixAt(n++, tM);
    }
    fib.count = n; fib.instanceMatrix.needsUpdate = true;
    fib.userData.lod = true; fib.userData.lodCount = n;      // decorative collagen: fewer threads still read as a fibre mesh
  }
  const dust = specks(150, 0.8, [140, 90, 60], ["#ffd9b8", "#ffb8a6", "#ffe8c8"], 0.22);
  dust.position.set(0, -8, 0); dust.userData.clayHide = true; gW.add(dust);

  // ---------- mast cells (granules full of histamine) ----------
  const MAST = [new THREE.Vector3(-17, -5, 7), new THREE.Vector3(5, -4, -8), new THREE.Vector3(-31, -3, -5), new THREE.Vector3(-3, 1.5, 12)];
  const mastBody = mkInst(new THREE.SphereGeometry(6, 28, 20), membrane("#d36bd8", "#ffb3ff"), MAST.length, gW, "mast");
  const mastNuc = mkInst(new THREE.SphereGeometry(2.3, 14, 10), physical("#7d4fa8"), MAST.length, gW, "mast");
  const mastGran = mkInst(granuleCloud(34, 5.3, 0.6, "#ff74e8", 21), physical("#ffffff", { roughness: 0.3, emissive: new THREE.Color("#c026d3"), emissiveIntensity: 0.35, vertexColors: true }), MAST.length, gW, "mast");
  MAST.forEach((p, i) => { tQ.setFromEuler(new THREE.Euler(i, i * 2, 0)); put([mastBody, mastNuc, mastGran], i, p, tQ, 1); });
  done([mastBody, mastNuc, mastGran], MAST.length);

  // ---------- host (tissue) cells: they matter for the virus ----------
  const HOST = [[-26, -8, 2], [-18, -14, -9], [-12, -3, 9], [3, -10, 5], [9, -5, -4], [17, -12, 8], [-33, -14, 10], [24, -4, -8]].map((a) => new THREE.Vector3(...a));
  const hostBody = mkInst(new THREE.SphereGeometry(5.2, 28, 20), membrane("#f4a4c0", "#ffd6e6"), NHOST, gW, "host");
  const hostNuc = mkInst(new THREE.SphereGeometry(2.2, 14, 10), physical("#9b6fbf"), NHOST, gW, "host");
  const hostCore = mkInst(new THREE.SphereGeometry(3.0, 16, 12), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), NHOST, gW, null);
  hostCore.userData.clayHide = true;
  const host = HOST.map((p, i) => ({ p, inf: 0, die: 0, q: new THREE.Quaternion().setFromEuler(new THREE.Euler(i, i * 1.7, 0)) }));

  // ---------- blood vessel ----------
  const vesselGeo = new THREE.CylinderGeometry(1, 1, 150, 56, 1, true); vesselGeo.rotateZ(Math.PI / 2);
  const vessel = tag(new THREE.Mesh(vesselGeo, membrane("#ff8f9a", "#ffc7cc", { rimPower: 1.7, minAlpha: 0.06, maxAlpha: 0.55 })), "vessel");
  vessel.position.set(0, VY, 0); gW.add(vessel);
  const backGeo = new THREE.CylinderGeometry(1, 1, 150, 40, 1, true, Math.PI / 2, Math.PI); backGeo.rotateZ(Math.PI / 2);
  const vesselBack = new THREE.Mesh(backGeo, new THREE.MeshStandardMaterial({ color: "#ffb4b0", side: THREE.DoubleSide }));
  vesselBack.position.set(0, VY, 0); vesselBack.visible = false; gW.add(vesselBack);
  vessel.userData.clayHide = true;
  const NEND = 22;
  const endoNuc = mkInst(new THREE.SphereGeometry(0.5, 12, 8), physical("#c58ad0", { roughness: 0.4 }), NEND, gW, "vessel");
  const endoAng = Array.from({ length: NEND }, (_, i) => ({ x: -66 + (i % 11) * 12.6 + rng() * 3, a: (i / 11 | 0) * 1.57 + rng() * 0.8, sx: 5 + rng() * 3 }));
  const gapMat = glass("#ffd1d6", { rim: "#ffffff", rimPower: 1.4, minAlpha: 0.2, maxAlpha: 0.8 });
  const gapRings = mkInst(new THREE.TorusGeometry(2.6, 0.55, 10, 24), gapMat, GAPX.length, gW, "vessel");
  const rbcGeo = rbcGeometry();
  const rbcMat = physical("#d3323b", { roughness: 0.35, clearcoat: 0.9, clearcoatRoughness: 0.2, sheen: 0.8, sheenColor: new THREE.Color("#ff7b7b") });
  const rbcMesh = mkInst(rbcGeo, rbcMat, NRBC, gW, "rbc");
  const rbc = Array.from({ length: NRBC }, () => ({ x: -70 + rng() * 140, a: rng() * 6.283, r: Math.sqrt(rng()), rx: rng() * 6, ry: rng() * 6, rz: rng() * 6, w: (rng() - 0.5) * 1.2, s: 0.9 + rng() * 0.2 }));
  const rbcRows = [];                               // (kept simple: every cell rides its own lane)

  // ---------- white blood cells (instanced; one slot per agent) ----------
  const nP = neutrophilParts(), mP = macrophageParts();
  const nBody = mkInst(wobble(new THREE.SphereGeometry(6, 36, 26), 0.25, 0.5, 2), membrane("#cdbcf0", "#efe6ff"), NNEU, gW, "neutrophil");
  const nNuc = mkInst(nP.nuc, physical("#ffffff", { roughness: 0.4, clearcoat: 0.7, vertexColors: true }), NNEU, gW, "neutrophil");
  const nGran = mkInst(nP.gran, physical("#ffffff", { roughness: 0.35, vertexColors: true, emissive: new THREE.Color("#7a2a4a"), emissiveIntensity: 0.25 }), NNEU, gW, null);
  const mMat = addRuffle(membrane("#f2b49a", "#ffe0d0", { maxAlpha: 0.62 }), uTime, 0.45, 0.45, "mac");
  const mBody = mkInst(mP.body, mMat, NMAC, gW, "macrophage");
  const mNuc = mkInst(mP.nuc, physical("#ffffff", { roughness: 0.4, clearcoat: 0.6, vertexColors: true }), NMAC, gW, "macrophage");
  const mVes = mkInst(mP.vesicles, physical("#ffffff", { roughness: 0.35, vertexColors: true, emissive: new THREE.Color("#a3361a"), emissiveIntensity: 0.3 }), NMAC, gW, null);
  const tBody = mkInst(wobble(new THREE.SphereGeometry(4, 28, 20), 0.15, 0.6, 5), membrane("#8de3d6", "#d4fff8"), NTC, gW, "tc");
  const tNuc = mkInst(new THREE.SphereGeometry(3.1, 16, 12), physical("#5b4fa8", { roughness: 0.45 }), NTC, gW, "tc");
  const NEUM = [nBody, nNuc, nGran], MACM = [mBody, mNuc, mVes], TCM = [tBody, tNuc];
  // phagosome bubbles: a glass sphere around an engulfed pathogen (the colour shows lysosome fusion)
  const NPH = NNEU + NMAC + 2;
  const phMesh = mkInst(new THREE.SphereGeometry(1, 16, 12), membrane("#ffffff", "#ffffff", { rimStrength: 0.9, minAlpha: 0.14, maxAlpha: 0.75 }), NPH, gW, null);
  phMesh.userData.kind = "phagosome";

  // ---------- pathogens (bacilli or viruses), antibodies ----------
  const bacGeo = bacillusGeometry();
  const bacMat = physical("#a3e635", { roughness: 0.38, clearcoat: 0.8, emissive: new THREE.Color("#4d7c0f"), emissiveIntensity: 0.35 });
  const bacMesh = mkInst(bacGeo, bacMat, NB, gW, "bacterium");
  const flagMat = new THREE.MeshPhysicalMaterial({ color: "#c7f279", roughness: 0.5, transparent: true, opacity: 0.75, depthWrite: false });
  flagMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader.replace("void main() {", "uniform float uTime;\nvoid main() {").replace("#include <begin_vertex>", `#include <begin_vertex>
      float wv = clamp(-position.x * 0.2, 0.0, 1.5);
      transformed.y += sin(position.x * 3.0 + uTime * 9.0) * 0.16 * wv;
      transformed.z += cos(position.x * 3.0 + uTime * 9.0) * 0.16 * wv;`);
  };
  flagMat.customProgramCacheKey = () => "immflag";
  const flagMesh = mkInst(flagellaGeometry(), flagMat, NB, gW, null);
  const virMat = physical("#9ef0b0", { roughness: 0.4, clearcoat: 0.6, emissive: new THREE.Color("#22c55e"), emissiveIntensity: 0.9 });
  const virMesh = mkInst(virusGeometry(), virMat, NB, gW, "virus");
  const abGeo = antibodyGeometry();
  const abMat = physical("#ffffff", { roughness: 0.4, clearcoat: 0.5, vertexColors: true, emissive: new THREE.Color("#3b6ea8"), emissiveIntensity: 0.25 });
  const abFree = mkInst(abGeo, abMat, NABF, gW, "antibody");
  const abCoat = mkInst(abGeo, abMat, NB * NABC, gW, "antibody");

  // ---------- signals (chemical alarm): soft glowing particles ----------
  const sigPos = new Float32Array(NSIG * 3), sigVel = new Float32Array(NSIG * 3), sigLife = new Float32Array(NSIG);
  const sigGeo = new THREE.BufferGeometry();
  sigGeo.setAttribute("position", new THREE.BufferAttribute(sigPos, 3));
  const sigMat = new THREE.PointsMaterial({ size: 2.2, map: softDot(), color: "#ffc857", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const sigPts = new THREE.Points(sigGeo, sigMat); sigPts.frustumCulled = false; sigPts.userData.clayHide = true; gW.add(sigPts);
  for (let i = 0; i < NSIG; i++) { sigLife[i] = 0; sigPos[i * 3 + 1] = -999; }

  // =====================================================================================================================
  // VIEW 2: phagocytosis close-up (macrophage centre = origin; 21 µm across). Four steps driven by pm.t
  // =====================================================================================================================
  const MR = 10.5;
  const pm = { t: 0, playing: true, opson: false, hold: 0, step: 0 };
  const PD = () => (pm.opson ? [2.6, 2.6, 4.2, 5.0] : [4.0, 3.0, 4.2, 5.0]);
  const phaseOf = (t) => { const d = PD(); let a = 0; for (let i = 0; i < 4; i++) { if (t < a + d[i]) return { i, u: (t - a) / d[i] }; a += d[i]; } return { i: 3, u: 1, end: true }; };
  const phaseStart = (i) => PD().slice(0, i).reduce((a, b) => a + b, 0);
  const phTotal = () => PD().reduce((a, b) => a + b, 0);
  const macMatP = addRuffle(membrane("#f2b49a", "#ffe0d0", { maxAlpha: 0.55 }), uTime, 0.4, 0.45, "macP");
  const pBody = tag(new THREE.Mesh(mP.body, macMatP), "macrophage"); gP.add(pBody);
  pBody.userData.clayOpacity = 0.32;       // clay: a see-through jelly body, so the nucleus, lysosomes and the bacterium inside still show
  const pNuc = new THREE.Mesh(mP.nuc, physical("#ffffff", { roughness: 0.4, clearcoat: 0.6, vertexColors: true })); pNuc.position.set(-4.2, 2.6, -1.8); pNuc.scale.setScalar(0.95); gP.add(tag(pNuc, "macrophage"));
  const BP0 = new THREE.Vector3(MR + 2.7, 0.8, 0), X_IN = 5.0;
  // organelles of the macrophage: mitochondria, Golgi, vesicles (static, for crowding)
  {
    const parts = [], rr = mulberry32(77), v = new THREE.Vector3();
    for (let i = 0; i < 7; i++) { for (let k = 0; k < 40; k++) { randDir(rr, v).multiplyScalar(3 + rr() * 6); if (!(v.x > 1 && Math.abs(v.y) < 3.2 && Math.abs(v.z) < 3.2) && v.distanceTo(pNuc.position) > 5) break; } const m = paint(new THREE.CapsuleGeometry(0.42, 1.5, 4, 8).rotateZ(rr() * 3).rotateY(rr() * 3).translate(v.x, v.y, v.z), "#c98a4b"); parts.push(m.index ? m.toNonIndexed() : m); }
    for (let i = 0; i < 4; i++) { const g = new THREE.CylinderGeometry(2.0 - i * 0.12, 2.0 - i * 0.12, 0.28, 18); g.rotateX(Math.PI / 2); g.translate(-3.5 + i * 0.7, -4.2, 2.8); parts.push(paint(g, "#f0abfc")); }
    for (let i = 0; i < 12; i++) { randDir(rr, v).multiplyScalar(5 + rr() * 4); if (v.x > 1 && Math.abs(v.y) < 3.4 && Math.abs(v.z) < 3.4) v.x = -v.x; parts.push(sphereAt(0.28 + rr() * 0.22, v.x, v.y, v.z, "#8fb4d6", 1, 1, 1, 7)); }
    const org = new THREE.Mesh(mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g))), physical("#ffffff", { roughness: 0.4, vertexColors: true, clearcoat: 0.5 }));
    org.userData.kind = "macrophage"; gP.add(org); pickables.push(org);
  }

  {
    const erM = glass("#ffd34d", { rim: "#fff0a8", rimPower: 1.4, minAlpha: 0.08, maxAlpha: 0.5, side: THREE.DoubleSide });
    for (let k = 0; k < 3; k++) {
      const g = wobble(mergeVertices((() => { const q = new THREE.IcosahedronGeometry(1, 3); q.deleteAttribute("uv"); q.deleteAttribute("normal"); return q; })()), 0.09, 3.0, 2 + k);
      const m = new THREE.Mesh(g, erM); m.scale.set(6.2 - k * 0.8, 3.1 - k * 0.4, 5.4 - k * 0.7); m.position.copy(pNuc.position).add(tV.set(-1.6, -0.5, -0.2)); m.rotation.set(k * 0.6, k, k * 0.3); m.userData.clayHide = false; gP.add(m);
    }
  }
  // lysosomes (red-orange bags of enzymes): positions are re-used as the start of each fusion
  const NLY = 12, lyP = [], lyMesh = mkInst(new THREE.SphereGeometry(1.0, 20, 14), physical("#e5484d", { roughness: 0.25, clearcoat: 1, emissive: new THREE.Color("#b91c1c"), emissiveIntensity: 0.8 }), NLY, gP, "lysosome");
  {
    const rr = mulberry32(31), v = new THREE.Vector3();
    for (let i = 0; i < NLY; i++) { for (let k = 0; k < 60; k++) { randDir(rr, v).multiplyScalar(4.5 + rr() * 4.2); if (!(v.x > 0.5 && Math.abs(v.y) < 3.8 && Math.abs(v.z) < 3.8) && v.distanceTo(pNuc.position) > 5.2) break; } lyP.push({ p: v.clone(), home: v.clone(), fused: 0, s: 0.8 + rr() * 0.35 }); }
  }
  // the bacterium that is eaten (and two more waiting)
  const bigBac = new THREE.Mesh(bacGeo, bacMat), bigFlag = new THREE.Mesh(flagellaGeometry(), flagMat);
  bigBac.userData.kind = "bacterium"; pickables.push(bigBac); gP.add(bigBac, bigFlag);
  const extraBac = [new THREE.Vector3(19, -9, 3), new THREE.Vector3(23, 8, -5)].map((p, i) => { const b = new THREE.Mesh(bacGeo, bacMat), f = new THREE.Mesh(flagellaGeometry(), flagMat); b.position.copy(p); f.position.copy(p); b.rotation.set(0, i, 1 + i); f.rotation.copy(b.rotation); b.userData.kind = "bacterium"; pickables.push(b); gP.add(b, f); return { b, f, p }; });
  // pseudopodia: tapered tubes that grow around the bacterium (drawRange grows tip-first)
  const NARM = 7, SEG = 40, RAD = 12, arms = [];
  {
    for (let k = 0; k < NARM; k++) {
      const ph = (k / NARM) * Math.PI * 2 + 0.3, c = Math.cos(ph), s = Math.sin(ph);
      const root = new THREE.Vector3(Math.cos(0.72) * MR * 0.97, Math.sin(0.72) * c * MR * 0.97, Math.sin(0.72) * s * MR * 0.97);
      const mid = new THREE.Vector3(BP0.x - 0.9, BP0.y + c * 3.3, s * 3.3);
      const tip = new THREE.Vector3(BP0.x + 1.7, BP0.y + c * 1.0, s * 1.0);
      const q1 = root.clone().lerp(mid, 0.5).add(new THREE.Vector3(1.4, 0, 0));
      const g = taperedTube(new THREE.CatmullRomCurve3([root, q1, mid, tip]), SEG, RAD, (u) => 1.5 * (1 - u) + 0.32);
      const m = new THREE.Mesh(g, macMatP); m.frustumCulled = false; m.userData.kind = "pseudopod"; m.userData.clayOpacity = 0.6; gP.add(m); arms.push(m);
    }
  }
  PARTS.pseudopod = { name: { "y7-8": "Pseudopodia (\"false feet\")", y11: "Pseudopodia" }, color: "#f2b49a", role: { "y7-8": "Arms of the cell's membrane that stretch out and wrap around the germ.", "y9-10": "Extensions of the macrophage's membrane (and cytoplasm) that stretch around the bacterium so the cell can engulf it.", y11: "Actin-driven extensions of the plasma membrane that surround a particle in a zipper-like way (guided by receptors binding the target), closing to form a phagosome." } };
  const phagoBubble = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), membrane("#ffffff", "#ffffff", { rimStrength: 0.9, minAlpha: 0.14, maxAlpha: 0.78 }));
  phagoBubble.userData.kind = "phagosome"; pickables.push(phagoBubble); gP.add(phagoBubble);
  const enzNum = 36, enzPos = new Float32Array(enzNum * 3), enzG = new THREE.BufferGeometry();
  enzG.setAttribute("position", new THREE.BufferAttribute(enzPos, 3));
  const enzPts = new THREE.Points(enzG, new THREE.PointsMaterial({ size: 0.55, map: softDot(), color: "#ffd24a", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  enzPts.frustumCulled = false; enzPts.userData.clayHide = true; gP.add(enzPts);
  const NFRAG = 10, fragMesh = mkInst(new THREE.CapsuleGeometry(0.1, 0.25, 2, 5), physical("#a3e635", { roughness: 0.4 }), NFRAG, gP, null);
  const fcMesh = mkInst(abGeo, abMat, 14, gP, "antibody");        // antibodies on the bacterium and Fc receptors on the macrophage (opsonisation)
  const fcLoc = Array.from({ length: 14 }, (_, i) => { randDir(rng, tV); return tV.clone(); });

  // =====================================================================================================================
  // VIEW 3: lymph node. Cells are to scale (lymphocyte ~8 µm); antibodies are drawn about 70 times too large.
  // =====================================================================================================================
  const cellGeo = wobble(mergeVertices((() => { const g = new THREE.IcosahedronGeometry(1, 3); g.deleteAttribute("uv"); g.deleteAttribute("normal"); return g; })()), 0.035, 3.1, 1.3);
  const nucGeo = wobble(mergeVertices((() => { const g = new THREE.IcosahedronGeometry(1, 3); g.deleteAttribute("uv"); g.deleteAttribute("normal"); return g; })()), 0.07, 2.6, 0.7);
  const DCP = new THREE.Vector3(-17, -1, 0);
  const dend = dendriteGeometry(9, 11, 5.4);
  const dcMat = addRuffle(membrane("#ffb072", "#ffe2c8", { maxAlpha: 0.62 }), uTime, 0.12, 0.8, "dc");
  const dcBody = tag(new THREE.Mesh(cellGeo, dcMat), "dc"); dcBody.scale.setScalar(5.4); dcBody.position.copy(DCP); gN.add(dcBody);
  const dcArms = tag(new THREE.Mesh(dend.geo, dcMat), "dc"); dcArms.position.copy(DCP); gN.add(dcArms);
  const dcNuc = new THREE.Mesh(nucGeo, physical("#7b5bb8", { roughness: 0.45, clearcoat: 0.5 })); dcNuc.scale.set(2.9, 2.5, 2.4); dcNuc.position.copy(DCP).add(tV.set(0.6, 0.4, 0)); gN.add(tag(dcNuc, "dc"));
  const NMHC = 56;
  const mhcGeo = (() => { const s = paint(new THREE.CapsuleGeometry(0.1, 0.55, 3, 6).translate(0, 0.4, 0), "#9be28f"), h = paint(new THREE.SphereGeometry(0.34, 10, 8).translate(0, 0.98, 0), "#d9f99d"), p = paint(new THREE.SphereGeometry(0.17, 8, 6).translate(0, 1.2, 0), "#fb923c"); return mergeGeometries([s, h, p].map((g) => (g.index ? g.toNonIndexed() : g))); })();
  const mhcMesh = mkInst(mhcGeo, physical("#ffffff", { roughness: 0.35, vertexColors: true, emissive: new THREE.Color("#4d7c0f"), emissiveIntensity: 0.3 }), NMHC, gN, "mhc");
  const mhcLoc = Array.from({ length: NMHC }, (_, i) => {
    const cv = dend.curves[i % dend.curves.length], u = i < 14 ? 0.05 + rng() * 0.05 : 0.3 + rng() * 0.7;
    const p = cv.getPoint(u).add(DCP), tan = cv.getTangent(u);
    if (i < 14) { randDir(rng, tan); p.copy(DCP).addScaledVector(tan, 5.4); }
    return { p, n: tan.clone().normalize(), u: i / NMHC };
  });
  // generic cell types (instanced): positions are slots; counts follow the model
  const NODE_TYPES = {};
  const nodeType = (id, kind, n, r, col, rim, nucCol, nucScale, nucOff) => {
    const body = mkInst(cellGeo, membrane(col, rim, { maxAlpha: 0.6 }), n, gN, kind);
    const nuc = mkInst(nucGeo, physical(nucCol, { roughness: 0.62, clearcoat: 0.12, sheen: 0.8 }), n, gN, kind);
    const T = { id, kind, n, r, body, nuc, meshes: [body, nuc], slots: [], cnt: 0, nucScale, nucOff };
    NODE_TYPES[id] = T;
    return T;
  };
  const slot = (T, x, y, z, s = 1) => T.slots.push({ b: new THREE.Vector3(x, y, z), s, ph: rng() * 6.28, q: new THREE.Quaternion().setFromEuler(new THREE.Euler(rng() * 3, rng() * 3, rng() * 3)) });
  const tTh = nodeType("th", "th", 5, 4.0, "#7dd3fc", "#e0f7ff", "#5b6fb8", 0.72, [0.2, 0, 0]);
  const tBn = nodeType("bn", "bcell", 3, 4.1, "#5eead4", "#d9fff8", "#4b5fae", 0.74, [0.15, 0, 0]);
  const tBa = nodeType("ba", "bcell", 8, 4.6, "#34d3c1", "#d4fff8", "#3f58aa", 0.7, [0.2, 0, 0]);
  const tPc = nodeType("pc", "plasma", 6, 5.6, "#fde047", "#fff6b0", "#6a4fa5", 0.38, [0.55, 0.15, 0]);
  const tMb = nodeType("mb", "memoryB", 6, 3.2, "#2dd4bf", "#c8fff6", "#4a60a8", 0.72, [0.1, 0, 0]);
  const tMt = nodeType("mt", "memoryT", 4, 3.2, "#38bdf8", "#cdeeff", "#4d63ad", 0.74, [0.1, 0, 0]);
  const tTc = nodeType("tc", "tc", 5, 4.1, "#fb7185", "#ffe0e5", "#6a3a9a", 0.74, [0.15, 0, 0]);
  const tTr = nodeType("tr", "treg", 2, 3.5, "#a5b4fc", "#e4e8ff", "#40408f", 0.74, [0.1, 0, 0]);
  const tHost = nodeType("host", "host", 2, 6.2, "#f6a9c9", "#ffe3ef", "#8a63b0", 0.36, [0.1, 0.1, 0]);
  [[-4.5, 6.5, 3.2], [-1.5, 11, -3], [2, 5, 6], [-8.5, 12.5, 0.5], [3.5, 9.5, -6]].forEach((p) => slot(tTh, ...p));
  [[10, -6, 4], [13.5, 1, -5], [8, 4, -8]].forEach((p) => slot(tBn, ...p));
  [[-4.5, 6.5, 3.2], [-1.5, 11, -3], [2, 5, 6], [-8.5, 12.5, 0.5], [3.5, 9.5, -6]].forEach((p) => slot(tBa, p[0] + 8.2, p[1] - 2.2, p[2] + 0.6));   // activated B cells sit in contact with their helper T cell partner
  [[17.5, -1, 4], [20, -9, -3], [14, -13, 3]].forEach((p) => slot(tBa, ...p));
  [[27, -2, 3], [35, 6, -4], [27, 11, -7], [36, -8, -2], [29, -13, 6], [38, 0, 7]].forEach((p) => slot(tPc, ...p));
  [[-26, -12, -3], [-21, -17, 3], [-14, -17.5, -4], [3, -16, 2], [-8, -20, 5], [-29, -5, 6]].forEach((p) => slot(tMb, ...p));
  [[-24, 9, 4], [-28, 3, -6], [-19, 14, -2], [-22, -8, 7]].forEach((p) => slot(tMt, ...p));
  [[-6, -9, -3], [-1, -13, 5], [6, -10, -6], [-12, -12, 3], [2, -5, 8]].forEach((p) => slot(tTc, ...p));
  [[2.5, 15.5, 2], [-5, 17, -3]].forEach((p) => slot(tTr, ...p));
  [[3, -20, -4], [-9, -22, 2]].forEach((p) => slot(tHost, ...p));
  // plasma cells are full of rough ER: nested wobbly shells (yellow rim) inside the cell
  const erGeo = wobble(mergeVertices((() => { const g = new THREE.IcosahedronGeometry(1, 3); g.deleteAttribute("uv"); g.deleteAttribute("normal"); return g; })()), 0.07, 3.4, 4.2);
  const erMat = glass("#ffd34d", { rim: "#fff0a8", rimPower: 1.3, minAlpha: 0.1, maxAlpha: 0.55, side: THREE.DoubleSide });
  const pcER = mkInst(erGeo, erMat, tPc.n * 2, gN, "plasma");
  const hostGlow = mkInst(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: "#a3ff6b", transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), tHost.n, gN, null);
  hostGlow.userData.clayHide = true;
  // antibodies leaving the plasma cells, interleukins, perforin
  const NABN = 170, abN = Array.from({ length: NABN }, () => ({ on: false, life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3() }));
  const abNode = mkInst(abGeo, abMat, NABN, gN, "antibody");
  const NIL = 70, ilPos = new Float32Array(NIL * 3), ilG = new THREE.BufferGeometry(), il = Array.from({ length: NIL }, () => ({ u: 1, sp: 0, a: new THREE.Vector3(), b: new THREE.Vector3(), j: new THREE.Vector3() }));
  ilG.setAttribute("position", new THREE.BufferAttribute(ilPos, 3));
  const ilPts = new THREE.Points(ilG, new THREE.PointsMaterial({ size: 1.1, map: softDot(), color: "#ffe066", transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
  ilPts.frustumCulled = false; ilPts.userData.clayHide = true; gN.add(ilPts);
  const NPF = 40, pfPos = new Float32Array(NPF * 3), pfG = new THREE.BufferGeometry(), pf = Array.from({ length: NPF }, () => ({ u: 1, sp: 0, a: new THREE.Vector3(), b: new THREE.Vector3() }));
  pfG.setAttribute("position", new THREE.BufferAttribute(pfPos, 3));
  const pfPts = new THREE.Points(pfG, new THREE.PointsMaterial({ size: 1.0, map: softDot(), color: "#ff5a6e", transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
  pfPts.frustumCulled = false; pfPts.userData.clayHide = true; gN.add(pfPts);
  const synapse = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: "#fff2a8", transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  synapse.scale.setScalar(7); synapse.userData.clayHide = true; gN.add(synapse);
  const nodeDust = specks(120, 0.8, [80, 56, 40], ["#ffe9c9", "#cfe8ff", "#ffd1ec"], 0.2); nodeDust.userData.clayHide = true; gN.add(nodeDust);

  // =====================================================================================================================
  // Dynamics: the wound (pathogens, white blood cells, vessel, signals, antibodies)
  // =====================================================================================================================
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const ZC = new THREE.Vector3(WX - 2, -1.5, 0);
  const BACM = [bacMesh, flagMesh], VIRM = [virMesh], COATM = [abCoat], tV4 = new THREE.Vector3(), tE = new THREE.Euler();
  const CLUMP = [new THREE.Vector3(WX - 9, -3, 6), new THREE.Vector3(WX + 7, -1, -7), new THREE.Vector3(WX - 1, -6, 0)];
  // --- pathogens
  const BF = { OFF: 0, FREE: 1, ENG: 2, DIG: 3, DIS: 4, ENTER: 5 };
  const bg = { st: new Uint8Array(NB), x: new Float32Array(NB), y: new Float32Array(NB), z: new Float32Array(NB), dx: new Float32Array(NB), dy: new Float32Array(NB), dz: new Float32Array(NB), t: new Float32Array(NB), tt: new Float32Array(NB), hold: new Int16Array(NB).fill(-1), sc: new Float32Array(NB), ox: new Float32Array(NB), oy: new Float32Array(NB), oz: new Float32Array(NB), seed: new Float32Array(NB), cl: new Float32Array(NB * NABC * 2) };
  for (let i = 0; i < NB; i++) { bg.seed[i] = rng() * 100; for (let k = 0; k < NABC; k++) { bg.cl[(i * NABC + k) * 2] = (rng() * 2 - 1) * 0.75; bg.cl[(i * NABC + k) * 2 + 1] = rng() * 6.283; } }
  let entryQ = 0, entryT = 0, divT = 0, killT = 0;
  const newBug = (x, y, z, st, sc = 1) => {
    for (let i = 0; i < NB; i++) if (bg.st[i] === BF.OFF) {
      bg.st[i] = st; bg.x[i] = x; bg.y[i] = y; bg.z[i] = z; bg.sc[i] = sc; bg.hold[i] = -1; bg.t[i] = 0; bg.tt[i] = 0;
      randDir(rng, tV); bg.dx[i] = tV.x; bg.dy[i] = tV.y; bg.dz[i] = tV.z;
      return i;
    }
    return -1;
  };
  function resetBugs() {
    bg.st.fill(0); bg.hold.fill(-1); entryQ = 0;
    for (const a of LA) if (a.hold >= 0) { a.hold = -1; if (a.st === S.ENG || a.st === S.DIG) a.st = a.type === 1 ? S.IDLE : S.MIG; }
  }
  // --- white blood cells
  const S = { CIRC: 1, ROLL: 2, ADH: 3, SQ: 4, MIG: 5, ENG: 6, DIG: 7, DIE: 8, IDLE: 9, ATT: 10, LOOP: 11 };
  const LA = [];
  const mkAgent = (type, slot) => ({ type, slot, on: false, st: 0, p: new THREE.Vector3(), dir: new THREE.Vector3(1, 0, 0), q: new THREE.Quaternion(), s: 1, t: 0, hold: -1, ho: new THREE.Vector3(), la: 0, lb: 0, lr: 0, gx: 0, gz: 0, xa: 0, seed: rng() * 100, tgt: new THREE.Vector3(), tt: 0, sq: 0, pulse: 0, hostI: -1 });
  for (let i = 0; i < NNEU; i++) LA.push(mkAgent(0, i));
  for (let i = 0; i < NMAC; i++) LA.push(mkAgent(1, i));
  for (let i = 0; i < NTC; i++) LA.push(mkAgent(2, i));
  const agentR = [6, 10.5, 4];
  const wallY = () => VY + R;
  const startCirc = (a, loop = false) => {
    a.on = true; a.st = loop ? S.LOOP : S.CIRC; a.s = 0.001; a.t = 0; a.hold = -1; a.sq = 0;
    a.la = rng() * 6.283; a.lr = Math.sqrt(rng()) * 0.7;
    a.gx = GAPX[Math.floor(rng() * GAPX.length)]; a.gz = (GAPX.indexOf(a.gx) - 1) * 2.5;
    a.p.set(loop ? -70 + rng() * 140 : -52 + rng() * 14, VY, 0);
    a.xa = a.gx - 6 - rng() * 8;
    a.dir.set(1, 0, 0);
  };
  const startIdle = (a, pop) => {
    a.on = true; a.st = S.IDLE; a.s = pop ? 0.001 : 1; a.hold = -1; a.t = 0;
    for (let k = 0; k < 40; k++) { a.p.set(-34 + rng() * 60, -14 + rng() * 14, -16 + rng() * 32); if (a.p.y + 10.5 < EPI_BOT - 0.5 && Math.hypot(a.p.y - VY, a.p.z) > R0 + R1 + 11.5) break; }
    randDir(rng, a.dir);
  };
  const macs = LA.filter((a) => a.type === 1);
  macs.slice(0, 2).forEach((a) => startIdle(a, false));
  LA.filter((a) => a.type === 0).slice(0, 2).forEach((a) => startCirc(a, true));
  const nearestBug = (p, maxD, out) => {
    let best = -1, bd = maxD * maxD;
    for (let i = 0; i < NB; i++) { if (bg.st[i] !== BF.FREE) continue; const d = (bg.x[i] - p.x) ** 2 + (bg.y[i] - p.y) ** 2 + (bg.z[i] - p.z) ** 2; if (d < bd) { bd = d; best = i; } }
    if (best >= 0 && out) out.set(bg.x[best], bg.y[best], bg.z[best]);
    return best;
  };
  const engulf = (a, bi) => {
    a.hold = bi; a.st = S.ENG; a.t = 0;
    a.ho.set(bg.x[bi] - a.p.x, bg.y[bi] - a.p.y, bg.z[bi] - a.p.z);
    bg.st[bi] = BF.ENG; bg.hold[bi] = LA.indexOf(a); bg.tt[bi] = 0; bg.ox[bi] = bg.x[bi]; bg.oy[bi] = bg.y[bi]; bg.oz[bi] = bg.z[bi];
  };
  const spawnAgents = (type, target, dt) => {
    const list = LA.filter((a) => a.type === type && !(type === 0 && a.slot < 2));
    let live = 0; for (const a of list) if (a.on && a.st !== S.DIE) live++;
    if (live < target) {
      const free = list.find((a) => !a.on);
      if (free && (spawnT[type] -= dt) <= 0) { spawnT[type] = type === 1 ? 2.2 : 0.55; if (type === 1) startIdle(free, true); else startCirc(free); }
    } else if (live > target + (type === 1 ? 0 : 1)) {
      const dying = list.find((a) => a.on && a.st !== S.DIE && a.hold < 0 && a.st !== S.CIRC && a.st !== S.ROLL && a.st !== S.ADH && a.st !== S.SQ) || list.find((a) => a.on && a.st !== S.DIE && a.hold < 0);
      if (dying && (dieT[type] -= dt) <= 0) { dieT[type] = type === 1 ? 4 : 1.2; dying.st = S.DIE; dying.t = 0; }
    }
  };
  const spawnT = [0, 0, 0], dieT = [0, 0, 0];
  const sepV = new THREE.Vector3();
  function updateAgents(dt, t) {
    const virus = pathId === "virus", vs = M.slot("virus");
    // counts follow the model
    const dis = prion || !M.records.length;
    spawnAgents(0, dis ? 0 : Math.round((NNEU - 2) * clamp(M.N / 0.9, 0, 1)), dt);
    spawnAgents(1, clamp(Math.round(2 + 4 * (M.M - 0.25) / 0.75), 2, NMAC), dt);
    spawnAgents(2, virus && !dis ? Math.round(NTC * sat(vs.Tc, 0.12)) : 0, dt);
    // host cells: which are infected (virus) and which one a cytotoxic T cell is working on
    for (let i = 0; i < LA.length; i++) {
      const a = LA[i];
      if (!a.on) continue;
      const r = agentR[a.type];
      const hasBugs = !prion;
      switch (a.st) {
        case S.LOOP: case S.CIRC: {
          const v = (a.st === S.LOOP ? 18 : 30) * (1 - a.lr * a.lr * 0.8) + 5;
          a.p.x += v * dt;
          if (a.st === S.CIRC) { a.lr = lerp(a.lr, 1, Math.min(1, dt * 0.9)); a.la = lerp(a.la, 0, Math.min(1, dt * 1.0)); if (a.p.x >= a.xa) { a.st = S.ROLL; a.t = 0; } }
          else if (a.p.x > 70) a.p.x = -70;
          const off = a.st === S.CIRC && a.lr > 0.99 ? 1 : a.lr;
          a.p.y = VY + Math.cos(a.la) * off * (R - r - 0.1); a.p.z = Math.sin(a.la) * off * (R - r - 0.1);
          a.dir.set(1, 0, 0);
          break;
        }
        case S.ROLL: {
          a.p.x += (a.type === 2 ? 9 : 7) * dt; a.lr = 1; a.la = lerp(a.la, 0, Math.min(1, dt * 3));
          a.p.y = VY + (R - r - 0.1); a.p.z = lerp(a.p.z, a.gz, Math.min(1, dt * 2));
          a.dir.set(1, 0, 0);
          if (a.p.x >= a.gx) { a.st = S.ADH; a.t = 0; }
          break;
        }
        case S.ADH: {
          a.t += dt; a.p.x = lerp(a.p.x, a.gx, Math.min(1, dt * 3)); a.p.y = VY + (R - r - 0.1);
          if (a.t > 0.6) { a.st = S.SQ; a.t = 0; }
          break;
        }
        case S.SQ: {
          a.t += dt / 1.9;
          const u = ease(Math.min(1, a.t));
          a.p.y = lerp(VY + R - r - 0.1, VY + R + r * 1.35, u);
          a.p.x = lerp(a.p.x, a.gx, Math.min(1, dt * 3)); a.p.z = lerp(a.p.z, a.gz, Math.min(1, dt * 3));
          const d = (a.p.y - wallY()) / (r * 0.55);
          a.sq = Math.exp(-d * d);
          a.dir.set(0, 1, 0);
          if (a.t >= 1) { a.st = S.MIG; a.sq = 0; a.tt = 0; }
          break;
        }
        case S.MIG: case S.IDLE: {
          // choose a destination: the nearest free pathogen, or (killer T cells) an infected host cell, or the wound
          if ((a.tt -= dt) <= 0) {
            a.tt = 0.3 + rng() * 0.3;
            let ok = false;
            if (a.type === 2) {
              let bi = -1, bd = 1e9;
              for (let h = 0; h < NHOST; h++) if (host[h].inf > 0.35 && !host[h].die) { const d = host[h].p.distanceToSquared(a.p); if (d < bd) { bd = d; bi = h; } }
              if (bi >= 0) { a.hostI = bi; a.tgt.copy(host[bi].p); ok = true; }
            } else if (hasBugs && nearestBug(a.p, a.type === 1 ? 34 : 70, a.tgt) >= 0) ok = true;
            if (!ok) {
              if (a.st === S.IDLE) { randDir(rng, tV); a.tgt.copy(a.p).addScaledVector(tV, 8); }
              else a.tgt.set(WX + (rng() - 0.5) * 24, -2 + rng() * 8, (rng() - 0.5) * 18);
              a.hostI = -1;
            }
          }
          tV.copy(a.tgt).sub(a.p);
          const dist = tV.length();
          tV.multiplyScalar(1 / (dist || 1));
          tV2.set(Math.sin(t * 1.3 + a.seed), Math.cos(t * 1.7 + a.seed * 1.3), Math.sin(t * 1.1 + a.seed * 0.7)).multiplyScalar(0.35);
          tV.add(tV2).normalize();
          const sp = a.type === 1 ? 3.0 : a.type === 0 ? 11 : 9;
          const slow = a.st === S.IDLE && dist > 34 ? 0.3 : 1;
          a.dir.lerp(tV, Math.min(1, dt * 4)).normalize();
          a.p.addScaledVector(a.dir, sp * slow * dt);
          // stay in the dermis, clear of the vessel and the skin
          const top = EPI_BOT - 0.6 - r;
          if (a.p.y > top) a.p.y = lerp(a.p.y, top, Math.min(1, dt * 6));
          const vd = Math.hypot(a.p.y - VY, a.p.z), lim = R + r + 0.3;
          if (vd < lim && a.p.y < VY + R * 0.4 && a.st !== S.SQ) { tV3.set(0, a.p.y - VY, a.p.z).normalize().multiplyScalar(lim - vd); a.p.y += tV3.y; a.p.z += tV3.z; }
          a.p.z = clamp(a.p.z, -26, 26); a.p.x = clamp(a.p.x, -64, 64);
          // contact
          if (a.type === 2) {
            if (a.hostI >= 0 && host[a.hostI].p.distanceTo(a.p) < r + 5.2 + 0.4) { a.st = S.ATT; a.t = 0; }
          } else if (hasBugs) {
            const bi = nearestBug(a.p, r + 1.6, null);
            if (bi >= 0 && bg.st[bi] === BF.FREE) engulf(a, bi);
          }
          break;
        }
        case S.ATT: {
          a.t += dt;
          const h = host[a.hostI];
          if (!h || h.inf < 0.12) { a.st = S.MIG; a.tt = 0; break; }
          tV.copy(h.p).sub(a.p).normalize();
          a.dir.lerp(tV, Math.min(1, dt * 3)).normalize();
          a.pulse = 0.5 + 0.5 * Math.sin(t * 9 + a.seed);
          break;
        }
        case S.ENG: {
          const dur = a.type === 1 ? 1.9 : 1.0;
          a.t += dt / dur;
          tV.copy(a.ho).normalize(); a.dir.lerp(tV, Math.min(1, dt * 3)).normalize();
          if (a.t >= 1) { a.st = S.DIG; a.t = 0; if (a.hold >= 0) { bg.st[a.hold] = BF.DIG; bg.tt[a.hold] = 0; } }
          break;
        }
        case S.DIG: {
          a.t += dt / (a.type === 1 ? 7.5 : 5.5);
          if (a.t >= 1) {
            if (a.hold >= 0) { bg.st[a.hold] = BF.OFF; bg.hold[a.hold] = -1; }
            if (a.type === 1 && !prion) ms.digested = true;
            a.hold = -1; a.st = a.type === 1 ? S.IDLE : S.MIG; a.tt = 0;
          }
          break;
        }
        case S.DIE: {
          a.t += dt / 1.6; a.s = Math.max(0, 1 - a.t);
          if (a.hold >= 0) { bg.st[a.hold] = BF.OFF; bg.hold[a.hold] = -1; a.hold = -1; }
          if (a.t >= 1) { a.on = false; a.st = 0; }
          break;
        }
      }
      if (a.st !== S.DIE && a.s < 1) a.s = Math.min(1, a.s + dt * 1.2);
    }
    // gentle separation so cells do not overlap
    for (let i = 0; i < LA.length; i++) {
      const a = LA[i]; if (!a.on || a.st === S.CIRC || a.st === S.LOOP || a.st === S.ROLL || a.st === S.ADH || a.st === S.SQ) continue;
      for (let j = i + 1; j < LA.length; j++) {
        const b = LA[j]; if (!b.on || b.st === S.CIRC || b.st === S.LOOP || b.st === S.ROLL || b.st === S.ADH || b.st === S.SQ) continue;
        sepV.copy(a.p).sub(b.p);
        const d = sepV.length(), m = (agentR[a.type] + agentR[b.type]) * 0.92;
        if (d < m && d > 1e-4) { sepV.multiplyScalar(((m - d) / d) * 0.5 * Math.min(1, dt * 6)); a.p.add(sepV); b.p.sub(sepV); }
      }
    }
  }

  const PHM = [phMesh];
  const phBase = new THREE.Color("#bfe8ff"), phFuse = new THREE.Color("#ffc24d"), phDeep = new THREE.Color("#ff8f4a");
  function renderAgents(t) {
    let nn = 0, nm = 0, nt = 0, np = 0;
    for (let i = 0; i < LA.length; i++) {
      const a = LA[i];
      if (!a.on) continue;
      tQ.setFromUnitVectors(XAX, a.dir);
      let sx = Math.max(0.001, a.s), sy = sx, sz = sx;
      if (a.st === S.SQ) { sx *= 1 + 0.6 * a.sq; sy = sz = sx / (1 + 0.6 * a.sq) * (1 - 0.45 * a.sq); }
      else if (a.st === S.MIG) { sx *= 1.1; sy *= 0.95; sz *= 0.95; }
      else if (a.st === S.ATT) { sx *= 1 + 0.04 * a.pulse; }
      if (a.type === 0) put(NEUM, nn++, a.p, tQ, sx, sy, sz);
      else if (a.type === 1) put(MACM, nm++, a.p, tQ, sx, sy, sz);
      else put(TCM, nt++, a.p, tQ, sx, sy, sz);
      if (a.hold >= 0 && (a.st === S.ENG || a.st === S.DIG) && np < NPH) {
        const r = agentR[a.type];
        tV.copy(a.ho).normalize().multiplyScalar(r * 0.42).add(a.p);
        const k = a.st === S.ENG ? smooth(a.t, 0.2, 0.9) : 1, f = a.st === S.DIG ? smooth(a.t, 0.1, 0.4) : 0;
        tC.copy(phBase).lerp(phFuse, f); if (a.st === S.DIG) tC.lerp(phDeep, smooth(a.t, 0.5, 0.95));
        phMesh.setColorAt(np, tC);
        tQ2.identity();
        const pr = (a.type === 1 ? 2.0 : 1.7) * (a.st === S.DIG ? 1 - 0.25 * smooth(a.t, 0.7, 1) : 1) * k;
        put(PHM, np++, tV, tQ2, Math.max(0.001, pr * a.s));
      }
    }
    done(NEUM, nn); done(MACM, nm); done(TCM, nt); done(PHM, np);
  }
  // --- pathogens
  function updateBugs(dt, t) {
    const virus = pathId === "virus", sl = M.slot(pathId), Ab = M.ab(pathId);
    const Pv = clamp(virus ? sl.P / 1.5 : sl.P, 0, 1);
    let target = prion ? 0 : Math.round(NB * Math.pow(Pv, 0.6));
    if (!prion && sl.P > 0.0015) target = Math.max(target, 1);
    let free = 0;
    for (let i = 0; i < NB; i++) if (bg.st[i] === BF.FREE || bg.st[i] === BF.ENTER) free++;
    // entering through the cut
    if (entryQ > 0 && (entryT -= dt) <= 0) { entryT = 0.12; entryQ--; newBug(WX + (rng() - 0.5) * 3.2, EPI_TOP + 4 + rng() * 4, (rng() - 0.5) * 40, BF.ENTER); free++; }
    if (free < target && entryQ === 0 && (divT -= dt) <= 0) {
      divT = 0.14 / Math.max(1, (target - free) / 6);
      for (let k = 0; k < 14; k++) { const i = Math.floor(rng() * NB); if (bg.st[i] === BF.FREE) { newBug(bg.x[i] + (rng() - 0.5) * 2.4, bg.y[i] + (rng() - 0.5) * 2.4, bg.z[i] + (rng() - 0.5) * 2.4, BF.FREE, 0.35); break; } }
      if (free === 0) { const rz = (rng() - 0.5) * 30; newBug(WX + (rng() - 0.5) * 6, 1 + rng() * 3, rz, BF.FREE, 0.35); }
    } else if (free > target + 1 && (killT -= dt) <= 0) {
      killT = 0.16;
      for (let k = 0; k < 14; k++) { const i = Math.floor(rng() * NB); if (bg.st[i] === BF.FREE) { bg.st[i] = BF.DIS; bg.t[i] = 0; break; } }
    }
    const sp = virus ? 1.0 : 3.2, spread = Math.sqrt(Pv);
    const rx = 9 + 24 * spread, ry = 12, rz = 14 + 8 * spread;
    const agg = sat(Ab, 0.25) * (virus ? 0.2 : 1);
    let nb = 0, nv = 0, nc = 0;
    const meshes = virus ? VIRM : BACM;
    for (let i = 0; i < NB; i++) {
      const st = bg.st[i];
      if (st === BF.OFF) continue;
      let x = bg.x[i], y = bg.y[i], z = bg.z[i], dx = bg.dx[i], dy = bg.dy[i], dz = bg.dz[i], s = bg.sc[i];
      if (st === BF.FREE || st === BF.ENTER) {
        if (s < 1) bg.sc[i] = s = Math.min(1, s + dt * 1.4);
        if (st === BF.ENTER) {
          dy = -1.2; dx = (WX - x) * 0.25 + (rng() - 0.5) * 0.4; dz += (rng() - 0.5) * 0.2;
          x += dx * sp * dt; y += dy * sp * 2.2 * dt; z += dz * sp * dt * 0.6;
          const gh = gapHalf(y) - 0.45; x = clamp(x, WX - gh, WX + gh);
          if (y < EPI_BOT - 0.4) bg.st[i] = BF.FREE;
        } else {
          bg.t[i] -= dt;
          if (bg.t[i] <= 0) { bg.t[i] = 0.8 + rng() * 1.6; dx += (rng() - 0.5) * 1.6; dy += (rng() - 0.5) * 1.6; dz += (rng() - 0.5) * 1.6; }
          // stay in the infection zone
          tV.set((x - ZC.x) / rx, (y - ZC.y) / ry, (z - ZC.z) / rz);
          const d = tV.length();
          if (d > 1) { dx -= ((x - ZC.x) / rx) * (d - 1) * 3; dy -= ((y - ZC.y) / ry) * (d - 1) * 3; dz -= ((z - ZC.z) / rz) * (d - 1) * 3; }
          if (agg > 0.02) {
            let best = CLUMP[0], bd = 1e9; for (const c of CLUMP) { const dd = (c.x - x) ** 2 + (c.y - y) ** 2 + (c.z - z) ** 2; if (dd < bd) { bd = dd; best = c; } }
            dx += (best.x - x) * 0.05 * agg; dy += (best.y - y) * 0.05 * agg; dz += (best.z - z) * 0.05 * agg;
          }
          const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
          const slow = 1 - 0.7 * agg;
          x += dx * sp * slow * dt; y += dy * sp * slow * dt; z += dz * sp * slow * dt;
          if (y > EPI_BOT - 1) y = EPI_BOT - 1;
        }
        bg.dx[i] = dx; bg.dy[i] = dy; bg.dz[i] = dz;
      } else if (st === BF.ENG) {
        const a = LA[bg.hold[i]];
        bg.tt[i] = Math.min(1, bg.tt[i] + dt / (a.type === 1 ? 1.9 : 1.0));
        const u = ease(bg.tt[i]), r = agentR[a.type];
        tV.copy(a.ho).normalize().multiplyScalar(r * 0.42);
        x = lerp(bg.ox[i], a.p.x + tV.x, u); y = lerp(bg.oy[i], a.p.y + tV.y, u); z = lerp(bg.oz[i], a.p.z + tV.z, u);
      } else if (st === BF.DIG) {
        const a = LA[bg.hold[i]];
        if (!a || a.hold !== i) { bg.st[i] = BF.OFF; continue; }
        tV.copy(a.ho).normalize().multiplyScalar(agentR[a.type] * 0.42);
        x = a.p.x + tV.x; y = a.p.y + tV.y; z = a.p.z + tV.z;
        s = Math.max(0.05, 1 - smooth(a.t, 0.3, 0.95));
      } else if (st === BF.DIS) {
        bg.t[i] += dt / 0.9; s = Math.max(0, 1 - bg.t[i]);
        if (bg.t[i] >= 1) { bg.st[i] = BF.OFF; continue; }
        x += (rng() - 0.5) * 0.1; y += (rng() - 0.5) * 0.1;
      }
      bg.x[i] = x; bg.y[i] = y; bg.z[i] = z;
      tV.set(x, y, z);
      tV2.set(dx, dy, dz);
      if (st === BF.DIG || st === BF.ENG) { const a = LA[bg.hold[i]]; if (a) tV2.copy(a.ho).normalize().cross(YAX); }
      tQ.setFromUnitVectors(XAX, tV2.normalize());
      const sx = virus ? 0.3 * s : s;
      if (virus) tQ.setFromEuler(tE.set(t * 0.4 + i, t * 0.3, 0));
      put(meshes, nb, tV, tQ, sx);
      // antibodies on the surface (opsonisation): a coat of Y shapes
      if (!virus && st === BF.FREE && Ab > 0.015) {
        const c = Math.round(NABC * sat(Ab, 0.22));
        for (let k = 0; k < c; k++) {
          const px = bg.cl[(i * NABC + k) * 2], th = bg.cl[(i * NABC + k) * 2 + 1];
          tV3.set(px, 0.3 * Math.cos(th), 0.3 * Math.sin(th)).applyQuaternion(tQ).add(tV);
          tV4.set(0, Math.cos(th), Math.sin(th));
          tQ2.setFromUnitVectors(YAX, tV4).premultiply(tQ);
          put(COATM, nc++, tV3, tQ2, 0.85);
        }
      }
      nb++;
    }
    done(meshes, nb);
    (virus ? bacMesh : virMesh).count = 0; if (!virus) flagMesh.count = nb; else flagMesh.count = 0;
    bacMesh.visible = flagMesh.visible = !virus; virMesh.visible = virus;
    done(COATM, nc);
    // virus colour: antibody-bound (neutralised) virus turns blue-white
    if (virus) { const k = sat(Ab, 0.4); tC.set("#9ef0b0").lerp(tC2.set("#a8c8ff"), k); virMat.color.copy(tC); virMat.emissive.set("#22c55e").lerp(tC2.set("#3b82f6"), k); }
    return nb;
  }

  // --- vessel, blood, signals, hosts, free antibodies
  const ENDOM = [endoNuc], GAPM = [gapRings], RBCM = [rbcMesh], HOSTM = [hostBody, hostNuc, hostCore], ABFM = [abFree];
  const abf = Array.from({ length: NABF }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), w: rng() * 2 - 1 }));
  const resetAbf = (a) => { a.p.set(WX + (rng() - 0.5) * 50, -8 + rng() * 14, (rng() - 0.5) * 36); randDir(rng, a.v).multiplyScalar(1.2 + rng() * 1.5); randDir(rng, tV); a.q.setFromUnitVectors(YAX, tV); };
  abf.forEach(resetAbf);
  const sigEm = [...MAST, ...dmgCells];
  let sigAcc = 0;
  const QX = new THREE.Quaternion().setFromAxisAngle(XAX, Math.PI / 2);
  function updateVessel(dt, t) {
    phi += (M.phi - phi) * Math.min(1, dt * 1.6);
    R = R0 + R1 * phi;
    vessel.scale.set(1, R, R); vesselBack.scale.set(1, R, R);
    for (let i = 0; i < NEND; i++) { const e = endoAng[i]; tV.set(e.x, VY + Math.cos(e.a) * R, Math.sin(e.a) * R); tQ.setFromAxisAngle(XAX, e.a); put(ENDOM, i, tV, tQ, e.sx * 0.6, 0.7, 2.2); }
    done(ENDOM, NEND);
    const g = smooth(phi, 0.2, 0.7);
    for (let k = 0; k < GAPX.length; k++) { tV.set(GAPX[k], VY + R - 0.2, (k - 1) * 2.5); put(GAPM, k, tV, QX, Math.max(0.001, g)); }
    done(GAPM, GAPX.length);
    const flow = 17 + 8 * phi;
    for (let i = 0; i < NRBC; i++) {
      const c = rbc[i];
      c.x += (flow * (1 - c.r * c.r * 0.85) + 3) * dt;
      if (c.x > 72) c.x -= 144;
      c.rx += c.w * dt * 2; c.ry += dt * 0.6 * c.w; c.rz += dt * 0.4;
      const rr = c.r * (R - 4.3);
      tV.set(c.x, VY + Math.cos(c.a) * rr, Math.sin(c.a) * rr);
      tQ.setFromEuler(tE.set(c.rx, c.ry, c.rz));
      put(RBCM, i, tV, tQ, c.s);
    }
    done(RBCM, Math.ceil(NRBC * engine.lodScale));      // crowding only (no count is quoted): thinner on slower tiers
  }
  function updateSignals(dt, t) {
    const lvl = prion ? 0 : clamp(M.S * 1.4 + M.w, 0, 1.2);
    sigMat.opacity = 0.12 + 0.7 * sat(lvl, 0.25);
    sigAcc += dt * (lvl > 0.02 ? 6 + 70 * lvl : 0);
    while (sigAcc >= 1) {
      sigAcc--;
      for (let i = 0; i < NSIG; i++) if (sigLife[i] <= 0) {
        const e = sigEm[Math.floor(rng() * sigEm.length)];
        sigPos[i * 3] = e.x + (rng() - 0.5) * 3; sigPos[i * 3 + 1] = e.y + (rng() - 0.5) * 3; sigPos[i * 3 + 2] = e.z + (rng() - 0.5) * 3;
        sigVel[i * 3] = (rng() - 0.5) * 1.5; sigVel[i * 3 + 1] = -1.8 - rng() * 1.6; sigVel[i * 3 + 2] = (rng() - 0.5) * 1.5;
        sigLife[i] = 2.5 + rng() * 2.5;
        break;
      }
    }
    for (let i = 0; i < NSIG; i++) {
      if (sigLife[i] <= 0) { sigPos[i * 3 + 1] = -999; continue; }
      sigLife[i] -= dt;
      sigPos[i * 3] += (sigVel[i * 3] + Math.sin(t * 2 + i) * 0.5) * dt; sigPos[i * 3 + 1] += sigVel[i * 3 + 1] * dt; sigPos[i * 3 + 2] += (sigVel[i * 3 + 2] + Math.cos(t * 1.6 + i) * 0.5) * dt;
      if (sigPos[i * 3 + 1] < VY + R + 2) sigLife[i] = 0;
    }
    sigGeo.attributes.position.needsUpdate = true;
  }
  function updateHosts(dt, t) {
    const virus = pathId === "virus", vs = M.slot("virus");
    const nInf = virus && !prion ? Math.round(clamp(vs.I * 1.15, 0, 1) * NHOST) : 0;
    for (let i = 0; i < NHOST; i++) {
      const h = host[i], want = i < nInf ? 1 : 0;
      const prev = h.inf;
      h.inf += (want - h.inf) * Math.min(1, dt * 0.9);
      h.die = want === 0 && h.inf > 0.05 ? Math.min(1, h.die + dt * 0.8) : 0;
      if (want === 1) h.die = 0;
      tV.copy(h.p);
      const pulse = h.die > 0 ? 1 - 0.18 * h.die + Math.sin(t * 14 + i) * 0.04 * h.die : 1 + Math.sin(t * 0.8 + i) * 0.015;
      put(HOSTM, i, tV, h.q, pulse);
      tC.set("#f4a4c0").lerp(tC2.set("#d6ff7a"), h.inf * 0.8);
      hostBody.setColorAt(i, tC);
      tC.set("#7dff5a").multiplyScalar(h.inf * 0.55); hostCore.setColorAt(i, tC);
    }
    done(HOSTM, NHOST);
    hostBody.instanceColor.needsUpdate = true; hostCore.instanceColor.needsUpdate = true;
  }
  function updateFreeAb(dt, t) {
    const Ab = M.ab(pathId);
    const n = prion ? 0 : Math.round(NABF * sat(Ab, 0.35));
    for (let i = 0; i < n; i++) {
      const a = abf[i];
      a.p.addScaledVector(a.v, dt);
      tQ.setFromAxisAngle(YAX, a.w * dt * 1.6); a.q.premultiply(tQ);
      if (Math.abs(a.p.x - WX) > 34 || a.p.y > EPI_BOT - 1 || a.p.y < -22 || Math.abs(a.p.z) > 24) resetAbf(a);
      put(ABFM, i, a.p, a.q, 1);
    }
    done(ABFM, n);
  }

  // =====================================================================================================================
  // Dynamics: the phagocytosis close-up
  // =====================================================================================================================
  const bubbleBase = new THREE.Color("#bfe8ff"), bubbleFused = new THREE.Color("#ffc24d"), bubbleDeep = new THREE.Color("#ff9d4d");
  const bpos = new THREE.Vector3(), fuseOrder = lyP.map((l, i) => i).sort((a, b) => lyP[a].home.distanceToSquared(tV.set(X_IN, 0.8, 0)) - lyP[b].home.distanceToSquared(tV)).slice(0, 5);
  const LYM = [lyMesh], FRM = [fragMesh], FCM = [fcMesh];
  const bacQ = new THREE.Quaternion().setFromUnitVectors(XAX, new THREE.Vector3(0.12, 1, 0.08).normalize());
  const phS = { arm: 0, f: 0, sb: 1 };
  function updatePhago(dt, t) {
    if (pm.playing && dt > 0) {
      pm.t += dt;
      if (pm.t > phTotal() + 1.6) { pm.t = 0; }
    }
    const tot = phTotal(), T = clamp(pm.t, 0, tot), P = phaseOf(T), i = P.i, u = P.u;
    pm.step = i;
    // pseudopodia grow around the bacterium (step 1) and are drawn back as the phagosome pinches off (step 2)
    const armU = i === 0 ? ease(u) : i === 1 ? 1 - smooth(u, 0, 0.5) : 0;
    phS.arm = armU;
    arms.forEach((m, k) => { const a = clamp(armU * 1.12 - (k % 3) * 0.05, 0, 1); m.geometry.setDrawRange(0, Math.floor(a * SEG) * RAD * 6); m.visible = a > 0.01; });
    const bx = i === 0 ? BP0.x : i === 1 ? lerp(BP0.x, X_IN, smooth(u, 0.3, 1)) : X_IN;
    const wob = engine.reducedMotion ? 0 : 1;
    bpos.set(bx + Math.sin(t * 1.3) * 0.1 * wob, BP0.y + (i === 0 ? Math.sin(t * 0.9) * 0.15 * wob : 0) + (i >= 1 ? -0.8 * smooth(i === 1 ? u : 1, 0, 1) : 0), Math.sin(t * 0.7) * 0.12 * wob);
    // fusion with lysosomes (step 3)
    let f = 0;
    for (let k = 0; k < NLY; k++) {
      const l = lyP[k], rank = fuseOrder.indexOf(k);
      let fk = 0;
      if (rank >= 0) fk = i < 2 ? 0 : i === 2 ? smooth(u, rank * 0.13, rank * 0.13 + 0.42) : 1;
      if (rank >= 0) f += fk / 5;
      const s = l.s * (rank >= 0 ? 1 - smooth(fk, 0.82, 1) : 1) * (1 + 0.04 * Math.sin(t * 2 + k));
      if (rank >= 0) tV.copy(l.home).lerp(bpos, fk); else tV.copy(l.home).add(tV2.set(Math.sin(t * 0.6 + k) * 0.35, Math.cos(t * 0.5 + k * 2) * 0.35, Math.sin(t * 0.7 + k * 3) * 0.3));
      put(LYM, k, tV, IDQ, Math.max(0.001, s));
    }
    done(LYM, NLY);
    phS.f = f;
    // the bubble
    const bs = i === 0 ? 0 : i === 1 ? smooth(u, 0.05, 0.45) : 1;
    const br = (1.95 + 0.25 * f) * bs;
    phagoBubble.visible = bs > 0.01; phagoBubble.position.copy(bpos); phagoBubble.scale.setScalar(Math.max(0.001, br));
    tC.copy(bubbleBase).lerp(bubbleFused, f); if (i === 3) tC.lerp(bubbleDeep, smooth(u, 0.2, 0.9));
    const gm = phagoBubble.userData.realMat || phagoBubble.material;     // in clay the visible material is the style's own: update the real glass one
    if (gm.userData.glass) { gm.color.copy(tC); gm.userData.glass.rimColor.value.copy(tC).lerp(tC2.set("#ffffff"), 0.5); }
    // the bacterium digests
    const sb = i === 3 ? 1 - smooth(u, 0.15, 0.92) : 1;
    phS.sb = sb;
    const flex = i === 3 ? 1 + 0.18 * Math.sin(t * 7) * smooth(u, 0.1, 0.5) : 1;
    tQ.copy(bacQ);
    tV.copy(bpos);
    tS.set(Math.max(0.001, sb * flex), Math.max(0.001, sb), Math.max(0.001, sb));
    tM.compose(tV, tQ, tS);
    bigBac.matrixAutoUpdate = false; bigBac.matrix.copy(tM); bigBac.matrixWorldNeedsUpdate = true;
    bigFlag.matrixAutoUpdate = false; bigFlag.matrix.copy(tM); bigFlag.matrixWorldNeedsUpdate = true;
    bigBac.visible = bigFlag.visible = sb > 0.02; bigFlag.visible = bigFlag.visible && i < 2;     // the flagella are broken down first
    for (const e of extraBac) { e.b.position.y = e.p.y + Math.sin(t * 0.5 + e.p.x) * 0.8; e.f.position.y = e.b.position.y; e.b.rotation.z += dt * 0.15; e.f.rotation.z = e.b.rotation.z; }
    // fragments
    for (let k = 0; k < NFRAG; k++) {
      const a = k * 2.399963, s = i === 3 ? smooth(u, 0.12, 0.35) * (1 - smooth(u, 0.6, 1)) : 0;
      tV.set(bpos.x + Math.cos(a) * (0.3 + 1.0 * (i === 3 ? u : 0)), bpos.y + Math.sin(a * 1.7) * (0.3 + 0.9 * (i === 3 ? u : 0)), bpos.z + Math.sin(a) * 0.8);
      tQ.setFromEuler(tE.set(a, t * 0.8 + a, 0));
      put(FRM, k, tV, tQ, Math.max(0.001, s * 1.0));
    }
    done(FRM, NFRAG);
    // enzymes
    const eo = i >= 2 ? (i === 2 ? smooth(u, 0.15, 0.7) : 1) * 0.95 : 0;
    enzPts.material.opacity = eo * (0.55 + 0.35 * Math.sin(t * 5));
    for (let k = 0; k < enzNum; k++) {
      const a = k * 2.399963 + t * 0.7, b = Math.acos(1 - 2 * ((k + 0.5) / enzNum)), r = br * 0.82 * (0.45 + 0.5 * ((k * 0.37) % 1));
      enzPos[k * 3] = bpos.x + Math.sin(b) * Math.cos(a) * r; enzPos[k * 3 + 1] = bpos.y + Math.cos(b) * r; enzPos[k * 3 + 2] = bpos.z + Math.sin(b) * Math.sin(a) * r;
    }
    enzG.attributes.position.needsUpdate = true;
    // opsonisation: antibodies coat the bacterium and the macrophage's Fc receptors grab them
    let nfc = 0;
    if (pm.opson) {
      const show = i === 0 ? smooth(u, 0, 0.3) : (i === 3 ? 1 - smooth(u, 0.3, 0.7) : 1);
      for (let k = 0; k < 8; k++) {
        const d = fcLoc[k], rl = Math.hypot(d.y, d.z) || 1;
        tV.set(d.x * 0.8, (d.y / rl) * 0.3, (d.z / rl) * 0.3).applyQuaternion(bacQ).add(bpos);
        tV4.set(0, d.y / rl, d.z / rl).applyQuaternion(bacQ);
        tQ2.setFromUnitVectors(YAX, tV4);
        put(FCM, nfc++, tV, tQ2, 0.8 * show * (i >= 3 ? sb : 1));
      }
      for (let k = 0; k < 6; k++) {
        const ph = (k / 6) * Math.PI * 2 + 0.4, th = 0.34 + 0.12 * ((k % 2) ? 1 : 0);
        tV4.set(Math.cos(th), Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph));
        tV.copy(tV4).multiplyScalar(MR * 0.99);
        tQ2.setFromUnitVectors(YAX, tV4);
        put(FCM, nfc++, tV, tQ2, 0.8 * (i === 0 ? smooth(u, 0.1, 0.45) : i === 1 ? 1 - smooth(u, 0.2, 0.7) : 0));
      }
    }
    done(FCM, nfc);
    if (i === 3 && u > 0.97 && pm.playing) ms.digested = true;
  }

  // =====================================================================================================================
  // Dynamics: the lymph node
  // =====================================================================================================================
  const cur = { th: 0, bn: 2, ba: 0, pc: 0, mb: 0, mt: 0, tc: 0, tr: 0, host: 0, mhc: 0 };
  const nodeVis = {};
  for (const id in NODE_TYPES) nodeVis[id] = new Float32Array(NODE_TYPES[id].n);
  const mhcVis = new Float32Array(NMHC), ABNM = [abNode], MHCM = [mhcMesh], PCERM = [pcER], HGM = [hostGlow];
  let abAcc = 0, hostK = 0;
  const nodeCount = () => {
    const s = M.slot(pathId), virus = pathId === "virus", hf = M.hf;
    const off = prion || !M.records.length;
    cur.th = off ? 1 : clamp(1 + Math.round(4 * s.Th / 0.7), 1, 5);
    cur.bn = 2 + (off ? 1 : 0);
    cur.ba = off ? 0 : Math.round(8 * sat(s.Ba, 0.45));
    cur.pc = off ? 0 : Math.round(6 * sat(s.Pm + s.Pg + s.Pl, 0.06));
    cur.mb = off ? 0 : Math.round(6 * sat(s.Bm * 1.0, 0.035));
    cur.mt = off ? 0 : Math.round(4 * sat(s.Tm + s.Tcm, 0.02));
    cur.tc = virus ? Math.max(1, off ? 1 : Math.round(5 * sat(s.Tc, 0.1))) : 0;
    cur.tr = off ? 0 : s.Tr > 0.3 ? 2 : s.Tr > 0.08 ? 1 : 0;
    cur.host = virus ? 2 : 0;
    cur.mhc = off ? 4 : Math.round(NMHC * (0.07 + 0.93 * s.D));
  };
  const pairSpr = Array.from({ length: 5 }, () => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: "#fff2a8", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); sp.scale.setScalar(4.5); sp.userData.clayHide = true; gN.add(sp); return sp; });
  const bMhcMesh = mkInst(mhcGeo, mhcMesh.material, 5, gN, "mhc"), BMHCM = [bMhcMesh];
  function updateNode(dt, t) {
    const s = M.slot(pathId), virus = pathId === "virus", still = engine.reducedMotion ? 0 : 1;
    nodeCount();
    for (const id in NODE_TYPES) {
      const T = NODE_TYPES[id], vis = nodeVis[id], n = T.n;
      for (let i = 0; i < n; i++) {
        const sl = T.slots[i], want = i < cur[id] ? 1 : 0;
        vis[i] += (want - vis[i]) * Math.min(1, dt * 3.0 + (dt > 0 ? 0 : 0));
        const v = vis[i] > 0.005 ? vis[i] : 0.0001;
        tV.copy(sl.b).add(tV2.set(Math.sin(t * 0.45 + sl.ph) * 0.9, Math.cos(t * 0.38 + sl.ph * 1.7) * 0.9, Math.sin(t * 0.31 + sl.ph * 2.3) * 0.9).multiplyScalar(still));
        tQ.copy(sl.q).multiply(tQ2.setFromAxisAngle(YAX, t * 0.1 * still));
        let sc = T.r * v;
        if (id === "host") { const kill = hostK; sc *= i === 0 ? 1 - 0.45 * kill + (kill > 0.05 ? Math.sin(t * 16) * 0.03 : 0) : 1; }
        tS.set(sc, sc, sc); tM.compose(tV, tQ, tS); T.body.setMatrixAt(i, tM);
        tV3.set(T.nucOff[0], T.nucOff[1], T.nucOff[2]).multiplyScalar(T.r * v).applyQuaternion(tQ).add(tV);
        const ns = T.r * T.nucScale * 0.84 * v;
        tS.set(ns * (id === "th" || id === "tc" || id === "tm" ? 1 : 1), ns, ns); tM.compose(tV3, tQ, tS); T.nuc.setMatrixAt(i, tM);
        if (id === "pc") {
          for (let k = 0; k < 2; k++) { const es = T.r * (k ? 0.5 : 0.78) * v; tQ2.setFromEuler(tE.set(i + k * 2, k * 1.3, i * 0.4)); tS.set(es, es * 0.92, es); tM.compose(tV, tQ2, tS); pcER.setMatrixAt(i * 2 + k, tM); }
        }
        if (id === "host") { const g = (virus ? 1 : 0) * Math.max(0, s.I) * 0.9 * v; tC.set("#a3ff6b").multiplyScalar(g * (i === 0 ? 1 - 0.6 * hostK : 1)); hostGlow.setColorAt(i, tC); tS.set(sc * 0.55, sc * 0.55, sc * 0.55); tM.compose(tV, tQ, tS); hostGlow.setMatrixAt(i, tM); }
        sl.cur = sl.cur || new THREE.Vector3(); sl.cur.copy(tV);
      }
      done(T.meshes, n);
    }
    done(PCERM, tPc.n * 2); done(HGM, tHost.n);
    // MHC on the dendritic cell
    for (let i = 0; i < NMHC; i++) {
      const want = i < cur.mhc ? 1 : 0; mhcVis[i] += (want - mhcVis[i]) * Math.min(1, dt * 2.5);
      const m = mhcLoc[i];
      tQ2.setFromUnitVectors(YAX, m.n);
      put(MHCM, i, m.p, tQ2, Math.max(0.0001, mhcVis[i]) * 0.95);
    }
    done(MHCM, NMHC);
    // synapse between a helper T cell and the dendritic cell
    const th0 = tTh.slots[0].cur;
    synapse.position.copy(th0).lerp(mhcLoc[2].p, 0.45).lerp(th0, 0.3);
    synapse.material.opacity = 0.2 + 0.7 * sat(s.D, 0.2) * (0.7 + 0.3 * Math.sin(t * 3));
    // linked help: each activated helper T cell touches its own B-cell partner (peptide on the B cell's MHC II) and sends interleukins to it
    const npair = Math.min(cur.th, cur.ba);
    for (let i = 0; i < 5; i++) {
      const on = i < npair;
      if (on) { tV.copy(tTh.slots[i].cur); tV2.copy(tBa.slots[i].cur); pairSpr[i].position.copy(tV).lerp(tV2, 0.5); tV3.copy(tV).sub(tV2).normalize(); tQ2.setFromUnitVectors(YAX, tV3); put(BMHCM, i, tV4.copy(tV2).addScaledVector(tV3, tBa.r * 0.92), tQ2, 0.9); }
      else put(BMHCM, i, tV.set(0, -999, 0), IDQ, 0.0001);
      pairSpr[i].material.opacity = on ? 0.35 + 0.45 * sat(s.Th * M.hf, 0.1) * (0.7 + 0.3 * Math.sin(t * 3 + i)) : 0;
    }
    done(BMHCM, 5);
    const nIL = prion ? 0 : Math.round(NIL * sat(s.Th * M.hf, 0.12));
    for (let i = 0; i < NIL; i++) {
      const p = il[i];
      if (p.u >= 1) {
        if (i < nIL && cur.th > 0) {
          const ti = Math.floor(rng() * cur.th);
          p.a.copy(tTh.slots[ti].cur);
          if (pathId === "virus" && cur.tc > 0 && rng() < 0.3) p.b.copy(tTc.slots[ti % cur.tc].cur);               // interleukins also support cytotoxic T cells
          else if (ti < cur.ba) p.b.copy(tBa.slots[ti].cur);                                                       // the matching B-cell partner
          else p.b.copy(tBn.slots[ti % tBn.n].cur);
          p.u = 0; p.sp = 0.35 + rng() * 0.35; randDir(rng, p.j).multiplyScalar(2.2); }
        else { ilPos[i * 3 + 1] = -999; continue; }
      }
      p.u += p.sp * dt;
      const k = Math.sin(Math.min(1, p.u) * Math.PI);
      ilPos[i * 3] = lerp(p.a.x, p.b.x, p.u) + p.j.x * k; ilPos[i * 3 + 1] = lerp(p.a.y, p.b.y, p.u) + p.j.y * k; ilPos[i * 3 + 2] = lerp(p.a.z, p.b.z, p.u) + p.j.z * k;
    }
    ilG.attributes.position.needsUpdate = true;
    // perforin from cytotoxic T cells to an infected cell
    const killing = virus && s.Tc > 0.05 && s.I > 0.02 && cur.tc > 0;
    hostK = killing ? (hostK + dt / 6) % 1.0 : Math.max(0, hostK - dt * 0.5);
    const nPF = killing ? Math.round(NPF * sat(s.Tc, 0.12)) : 0;
    for (let i = 0; i < NPF; i++) {
      const p = pf[i];
      if (p.u >= 1) {
        if (i < nPF) { p.a.copy(tTc.slots[Math.floor(rng() * cur.tc)].cur); p.b.copy(tHost.slots[0].cur); p.u = 0; p.sp = 0.8 + rng() * 0.6; }
        else { pfPos[i * 3 + 1] = -999; continue; }
      }
      p.u += p.sp * dt;
      pfPos[i * 3] = lerp(p.a.x, p.b.x, p.u); pfPos[i * 3 + 1] = lerp(p.a.y, p.b.y, p.u); pfPos[i * 3 + 2] = lerp(p.a.z, p.b.z, p.u);
    }
    pfG.attributes.position.needsUpdate = true;
    // antibodies leaving the plasma cells (enlarged ~70x so they can be seen)
    const rate = prion ? 0 : 30 * sat(s.Pm + s.Pg + 0.3 * s.Pl, 0.07) * (cur.pc > 0 ? 1 : 0);
    abAcc += rate * dt;
    while (abAcc >= 1) {
      abAcc--;
      const a = abN.find((x) => !x.on); if (!a) break;
      const sl = tPc.slots[Math.floor(rng() * Math.max(1, cur.pc))];
      a.on = true; a.life = 5 + rng() * 3;
      randDir(rng, tV);
      a.p.copy(sl.cur).addScaledVector(tV, tPc.r * 0.9); a.v.copy(tV).multiplyScalar(3 + rng() * 3.5);
      a.v.x += 1.2; randDir(rng, tV2); a.q.setFromUnitVectors(YAX, tV2); a.w.copy(tV2).multiplyScalar(0.7);
    }
    let na = 0;
    for (const a of abN) {
      if (!a.on) continue;
      a.life -= dt; if (a.life <= 0) { a.on = false; continue; }
      a.p.addScaledVector(a.v, dt);
      tQ.setFromAxisAngle(tV4.copy(a.w).normalize(), dt * 1.2); a.q.premultiply(tQ);
      put(ABNM, na++, a.p, a.q, 1.0 * Math.min(1, a.life * 1.5));
    }
    done(ABNM, na);
  }

  // =====================================================================================================================
  // Labels, panel, chart, herd immunity, level object
  // =====================================================================================================================
  let labels = [], panelEl = null, progress = null, explainBody = null, selCard = null, chart = null, chartCtx = null, mission = null;
  let stageSeg = null, pathSeg = null, speedSeg = null, blurbEl = null, phagoCard = null, phagoTxt = null, phagoSeg = null, playBtn = null, herdCard = null, dayChip = null, abChip = null, insetEl = null, insetCtx = null;
  let uiT = 0, logScale = false, stageBusy = false;
  const selRing = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: "#ffffff", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  selRing.userData.clayHide = true; root.add(selRing);
  let selT = 0;

  const L = (key) => lens.pick(PARTS[key].name);
  function makeLabels() {
    for (const l of labels) l.el.remove();
    labels = [];
    const add = (stg, html, get) => { const el = engine.label(typeof html === "function" ? html() : html, "org"); el.style.display = "none"; labels.push({ el, stg, get, html }); };
    const firstAgent = (type, pred = () => true) => LA.find((a) => a.type === type && a.on && a.st !== S.DIE && pred(a));
    add("wound", L("epidermis"), (o) => o.set(52, 22, 26));
    add("wound", L("cut"), (o) => o.set(WX, 37, 0));
    add("wound", `${L("mast")}<small>releases histamine</small>`, (o) => o.copy(MAST[2]).add(tV.set(0, 8.5, 0)));
    add("wound", `${L("vessel")}`, (o) => o.set(46, VY + R + 3.5, 0));
    add("wound", `${L("rbc")}<small>~7.5 µm</small>`, (o) => { const c = rbc.find((q) => q.x > 12 && q.x < 40 && q.r < 0.5); if (!c) return false; return !!o.set(c.x, VY + Math.cos(c.a) * c.r * (R - 4.3) + 5, Math.sin(c.a) * c.r * (R - 4.3)); });
    add("wound", `${L("neutrophil")}<small>~12 µm</small>`, (o) => { const a = firstAgent(0, (q) => q.st >= S.MIG && q.st <= S.DIG) || firstAgent(0, (q) => q.st !== S.LOOP && q.st !== S.CIRC) || firstAgent(0); return a ? !!o.copy(a.p).add(tV.set(0, 9, 0)) : false; });
    add("wound", lens.pick({ "y7-8": "Squeezing out of the vessel", y11: "Diapedesis" }), (o) => { const a = firstAgent(0, (q) => q.st === S.SQ) || firstAgent(2, (q) => q.st === S.SQ); return a ? !!o.copy(a.p).add(tV.set(0, 9, 0)) : false; });
    add("wound", `${L("macrophage")}<small>~21 µm</small>`, (o) => { const a = firstAgent(1); return a ? !!o.copy(a.p).add(tV.set(0, 13, 0)) : false; });
    add("wound", () => (pathId === "virus" ? `${L("virus")}<small>drawn ~3× too big</small>` : `${L("bacterium")}<small>~2 µm</small>`), (o) => { for (let i = 0; i < NB; i++) if (bg.st[i] === BF.FREE) return !!o.set(bg.x[i], bg.y[i] + 5, bg.z[i]); return false; });
    add("wound", L("antibody"), (o) => { if (M.ab(pathId) < 0.05) return false; return !!o.copy(abf[0].p).add(tV.set(0, 3, 0)); });
    add("wound", L("tc"), (o) => { const a = firstAgent(2); return a ? !!o.copy(a.p).add(tV.set(0, 7, 0)) : false; });
    add("wound", () => lens.pick({ "y7-8": "Infected cell", y11: "Infected host cell" }), (o) => { const h = host.find((q) => q.inf > 0.5); return h ? !!o.copy(h.p).add(tV.set(0, 8, 0)) : false; });
    add("phago", `${L("macrophage")}<small>~21 µm</small>`, (o) => o.set(-6, 9.6, 2));
    add("phago", () => lens.pick({ "y7-8": "Arms wrapping the germ", y11: "Pseudopodia" }), (o) => (phS.arm > 0.15 && pm.step < 2 ? !!o.set(BP0.x + 0.5, BP0.y + 5.6, 1) : false));
    add("phago", () => L("bacterium") + "<small>~2 µm</small>", (o) => (phS.sb > 0.1 ? !!o.copy(bpos).add(tV.set(0, -4.4, 0)) : false));
    add("phago", () => L("phagosome"), (o) => (pm.step >= 1 ? !!o.copy(bpos).add(tV.set(0, 3.9, 0)) : false));
    add("phago", () => L("lysosome"), (o) => { const l = lyP[fuseOrder[0]]; return pm.step === 2 ? !!o.copy(l.home).lerp(bpos, 0.4).add(tV.set(0, 2.6, 0)) : !!o.copy(lyP[fuseOrder[2]].home).add(tV.set(0, 2, 0)); });
    add("phago", "Nucleus", (o) => o.copy(pNuc.position).add(tV.set(0, 5.4, 0)));
    add("node", `${L("dc")}<small>presents antigen</small>`, (o) => o.copy(DCP).add(tV.set(0, 8.5, 0)));
    add("node", L("th"), (o) => o.copy(tTh.slots[0].cur).add(tV.set(0, 6.4, 0)));
    add("node", L("bcell"), (o) => o.copy(tBn.slots[0].cur).add(tV.set(0, 6.2, 0)));
    add("node", L("plasma"), (o) => (cur.pc > 0 ? !!o.copy(tPc.slots[0].cur).add(tV.set(0, 8.2, 0)) : false));
    add("node", `${L("antibody")}<small>drawn ~70× too big</small>`, (o) => { const a = abN.find((q) => q.on); return a ? !!o.copy(a.p).add(tV.set(0, 3, 0)) : false; });
    add("node", L("memoryB"), (o) => (cur.mb > 0 ? !!o.copy(tMb.slots[0].cur).add(tV.set(0, 5, 0)) : false));
    add("node", L("tc"), (o) => (cur.tc > 0 ? !!o.copy(tTc.slots[0].cur).add(tV.set(0, 6.2, 0)) : false));
    add("node", L("treg"), (o) => (cur.tr > 0 ? !!o.copy(tTr.slots[0].cur).add(tV.set(0, 5.6, 0)) : false));
    add("node", () => lens.pick({ "y7-8": "Infected cell", y11: "Infected host cell" }), (o) => (cur.host > 0 && pathId === "virus" && M.slot("virus").I > 0.02 ? !!o.copy(tHost.slots[0].cur).add(tV.set(0, 8.4, 0)) : false));
    add("node", "MHC", (o) => o.copy(mhcLoc[16].p).add(tV.set(0, 2.2, 1)));
  }
  const tLbl = new THREE.Vector3();
  // keep 3D labels below the HUD chip rows on narrow stages (portrait): clamp their screen y to under the overlay
  const _lp = new THREE.Vector3(), _cx = new Float32Array(16), _cy = new Float32Array(16), _cw = new Float32Array(16), _ch = new Float32Array(16); let _cn = 0;
  function chipFloor() { const ov = engine.overlay; return ov && ov.firstChild && engine.w < 700 ? ov.offsetTop + ov.offsetHeight + 14 : -1e9; }
  function placeClamped(el, v, dx, dy, minY) {
    const p = _lp.copy(v).project(engine.camera);
    if (p.z > 1 || p.z < -1) { el.style.display = "none"; return false; }
    el.style.display = "";
    const x = (p.x * 0.5 + 0.5) * engine.w + dx;
    let y = (-p.y * 0.5 + 0.5) * engine.h + dy;
    const w = el.offsetWidth || 100, h = el.offsetHeight || 22;
    if (y - h / 2 < minY) {   // clamped: keep the label's top edge below the chips, then stack below any earlier label it would overlap
      y = minY + h / 2;
      for (let pass = 0; pass < 3; pass++) for (let i = 0; i < _cn; i++) if (Math.abs(x - _cx[i]) < (w + _cw[i]) / 2 + 6 && Math.abs(y - _cy[i]) < (h + _ch[i]) / 2 + 3) y = _cy[i] + (h + _ch[i]) / 2 + 3;
    } else if (minY > -1e8) {   // narrow stage: an unclamped label also moves clear of labels already pushed down onto it
      for (let pass = 0; pass < 3; pass++) for (let i = 0; i < _cn; i++) if (Math.abs(x - _cx[i]) < (w + _cw[i]) / 2 + 6 && Math.abs(y - _cy[i]) < (h + _ch[i]) / 2 + 3) y = _cy[i] + (h + _ch[i]) / 2 + 3;
    }
    if (_cn < 16) { _cx[_cn] = x; _cy[_cn] = y; _cw[_cn] = w; _ch[_cn++] = h; }
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
    return true;
  }
  function updateLabels() {
    const floorY = chipFloor(); _cn = 0;
    for (const l of labels) {
      if (!showLabels || l.stg !== stage || stageBusy) { l.el.style.display = "none"; continue; }
      if (typeof l.html === "function") { const h = l.html(); if (l._h !== h) { l._h = h; l.el.innerHTML = h; } }
      if (l.get(tLbl) === false) { l.el.style.display = "none"; continue; }
      placeClamped(l.el, tLbl, 0, 0, floorY);
    }
  }

  // ---------- chart ----------
  const PROT = 0.5;
  function drawChart() {
    if (!chart) return;
    const w = chart.clientWidth, h = chart.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    if (!w) return;
    if (chart.width !== Math.round(w * dpr)) { chart.width = Math.round(w * dpr); chart.height = Math.round(h * dpr); }
    const c = chartCtx, day = M.day, sen = lens.atLeast("y11");
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    const padL = 4, padR = 4, padT = 6, padB = 16, pw = w - padL - padR, ph = h - padT - padB;
    const w0 = Math.max(0, day - 110), w1 = Math.max(w0 + 40, day + 2);
    const H = M.history.filter((p) => p.day >= w0 - 1);
    const key = pathId === "virus" ? "v" : "b", oth = pathId === "virus" ? "b" : "v";
    let mx = 1.2;
    for (const p of H) mx = Math.max(mx, (p[key].igm + p[key].igg) * 1.12);
    const X = (d) => padL + ((d - w0) / (w1 - w0)) * pw;
    const Y = logScale ? (v) => padT + ph - ((Math.log10(Math.max(v, 1e-3)) + 3) / (Math.log10(mx) + 3)) * ph : (v) => padT + ph - (v / mx) * ph;
    const grid = K.cssVar("--grid-line", "rgba(255,255,255,0.1)"), dim = K.cssVar("--ink-faint", "#6a7f9c");
    c.strokeStyle = grid; c.lineWidth = 1; c.fillStyle = dim; c.font = "10px Inter, system-ui, sans-serif"; c.textAlign = "center";
    const step = w1 - w0 > 80 ? 20 : 10;
    for (let d = Math.ceil(w0 / step) * step; d <= w1; d += step) { c.beginPath(); c.moveTo(X(d), padT); c.lineTo(X(d), padT + ph); c.stroke(); c.fillText(String(d), X(d), h - 3); }
    c.textAlign = "right"; c.fillText("days", w - 4, padT + ph - 4);
    c.beginPath(); c.moveTo(padL, padT + ph); c.lineTo(padL + pw, padT + ph); c.stroke();
    // protective level (dotted)
    c.setLineDash([2, 4]); c.strokeStyle = K.chartCol("rgba(74,222,128,0.7)"); c.beginPath(); c.moveTo(padL, Y(PROT)); c.lineTo(padL + pw, Y(PROT)); c.stroke(); c.setLineDash([]);
    c.fillStyle = K.chartCol("rgba(74,222,128,0.9)"); c.textAlign = "left"; c.fillText(lens.pick({ "y7-8": "enough to protect", "y9-10": "protective level" }), padL + 2, Y(PROT) - 3);
    // exposures
    for (const e of M.events) {
      if (e.day < w0 || e.day > w1) continue;
      const col = K.chartCol(e.kind === "vaccinate" ? "#4ade80" : e.id === "virus" ? "#f59e0b" : "#f87171");
      c.setLineDash([3, 3]); c.strokeStyle = col; c.globalAlpha = e.id === pathId ? 0.9 : 0.35; c.beginPath(); c.moveTo(X(e.day), padT); c.lineTo(X(e.day), padT + ph); c.stroke(); c.setLineDash([]);
      c.fillStyle = col; c.textAlign = "left"; c.fillText(e.kind === "vaccinate" ? "V" : e.id === "virus" ? "I" : "I", X(e.day) + 2, padT + 9); c.globalAlpha = 1;
    }
    const line = (get, col, wdt, dash, scale = 1) => {
      c.strokeStyle = col; c.lineWidth = wdt; c.setLineDash(dash || []); c.beginPath(); let first = true;
      for (const p of H) { const x = X(p.day), y = scale === 1 ? Y(get(p)) : padT + ph - clamp(get(p) / scale, 0, 1) * ph * 0.9; if (first) { c.moveTo(x, y); first = false; } else c.lineTo(x, y); }
      c.stroke(); c.setLineDash([]);
    };
    if (H.length > 1) {
      if (M.events.some((e) => e.id === oth)) line((p) => p[oth].igm + p[oth].igg, K.chartCol("rgba(160,170,190,0.4)"), 1.5);
      if (lens.atLeast("y9-10")) line((p) => (pathId === "virus" ? p.v.i : p.b.p), K.chartCol("rgba(248,113,113,0.8)"), 1.5, [4, 3], 1.1);
      if (sen) { line((p) => p[key].igm, K.chartCol("#fbbf24"), 2); line((p) => p[key].igg, K.chartCol("#2dd4bf"), 2); }
      else line((p) => p[key].igm + p[key].igg, K.chartCol("#e8f1ff"), 2.2);
    }
    chart.setAttribute("aria-label", `Antibody level over time for the ${pathId}: now ${(M.total(pathId)).toFixed(2)} (relative units), day ${day.toFixed(0)}.`);
  }

  // ---------- virus inset: a magnified virion on a small 2D canvas ----------
  const insetPts = Array.from({ length: 38 }, (_, i) => { const y = 1 - (i / 37) * 2, r = Math.sqrt(1 - y * y), a = i * 2.399963; return [Math.cos(a) * r, y, Math.sin(a) * r]; });
  function drawInset(t) {
    if (!insetCtx) return;
    const c = insetCtx, W = 112;
    c.clearRect(0, 0, W, W);
    const ca = Math.cos(t * 0.5), sa = Math.sin(t * 0.5), ct = Math.cos(0.5), st = Math.sin(0.5);
    const pts = insetPts.map(([x, y, z]) => { const x1 = x * ca + z * sa, z1 = -x * sa + z * ca; return [x1, y * ct - z1 * st, y * st + z1 * ct]; }).sort((a, b) => a[2] - b[2]);
    const g = c.createRadialGradient(W / 2 - 8, W / 2 - 10, 4, W / 2, W / 2, 34);
    g.addColorStop(0, "#c8ffd6"); g.addColorStop(0.6, "#4ade80"); g.addColorStop(1, "#15803d");
    for (const [x, y, z] of pts) {
      const px = W / 2 + x * 34, py = W / 2 + y * 34, k = 1 + 0.2 * z;
      if (z < 0) { c.strokeStyle = "rgba(190,242,100,0.5)"; c.lineWidth = 2; c.beginPath(); c.moveTo(W / 2 + x * 30, W / 2 + y * 30); c.lineTo(px + x * 7, py + y * 7); c.stroke(); c.fillStyle = "rgba(190,242,100,0.6)"; c.beginPath(); c.arc(px + x * 7, py + y * 7, 3 * k, 0, 6.283); c.fill(); }
    }
    c.fillStyle = g; c.beginPath(); c.arc(W / 2, W / 2, 31, 0, 6.283); c.fill();
    for (const [x, y, z] of pts) {
      const px = W / 2 + x * 34, py = W / 2 + y * 34, k = 1 + 0.2 * z;
      if (z >= 0) { c.strokeStyle = "rgba(190,242,100,0.9)"; c.lineWidth = 2.2; c.beginPath(); c.moveTo(W / 2 + x * 30, W / 2 + y * 30); c.lineTo(px + x * 7, py + y * 7); c.stroke(); c.fillStyle = "#d9f99d"; c.beginPath(); c.arc(px + x * 7, py + y * 7, 3 * k, 0, 6.283); c.fill(); }
    }
  }
  function buildInset() {
    insetEl?.remove();
    insetEl = document.createElement("div");
    insetEl.className = "imm-inset";
    insetEl.innerHTML = `<canvas width="224" height="224" style="width:112px;height:112px"></canvas><span>${lens.pick({ "y7-8": "A virus, magnified a lot (the real one is about 0.1 µm)", y11: "Virion, magnified about 1,000× (≈0.1 µm in real life)" })}</span>`;
    insetCtx = insetEl.querySelector("canvas").getContext("2d");
    insetCtx.scale(2, 2);
    engine.stageEl.appendChild(insetEl);
  }
  if (!document.getElementById("imm-style")) {
    const st = document.createElement("style");
    st.id = "imm-style";
    st.textContent = `
      .imm-inset { position: absolute; left: 14px; bottom: 92px; z-index: 3; width: 132px; padding: 6px 8px 8px; border-radius: 12px; background: var(--float-bg, rgba(5,11,22,.72)); border: 1px solid var(--panel-border, rgba(255,255,255,.12)); color: var(--ink-dim, #9fb3cf); font-size: .7rem; line-height: 1.25; pointer-events: none; }
      .imm-inset canvas { display: block; margin: 0 auto 4px; }
      .imm-herd { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 8px 0 4px; }
      .imm-herd figure { margin: 0; }
      .imm-herd canvas { width: 100%; height: 118px; display: block; border-radius: 8px; background: var(--tint-1, rgba(255,255,255,.04)); border: 1px solid var(--panel-border, rgba(255,255,255,.1)); }
      .imm-herd figcaption { font-size: .72rem; color: var(--ink-dim); margin-top: 3px; line-height: 1.3; }
      .imm-herd figcaption b { color: var(--ink); }
      .imm-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: .75rem; font-weight: 600; }
      .imm-badge.ok { background: rgba(74,222,128,.16); color: #4ade80; }
      .imm-badge.no { background: rgba(251,191,36,.16); color: #fbbf24; }
      .imm-tbl { width: 100%; border-collapse: collapse; font-size: .76rem; margin-top: 4px; }
      .imm-tbl th, .imm-tbl td { text-align: left; padding: 4px 6px; border-top: 1px solid var(--panel-border, rgba(255,255,255,.1)); vertical-align: top; color: var(--ink-dim); }
      .imm-tbl th { color: var(--ink); font-weight: 600; }
      .imm-steps { display: grid; gap: 6px; margin: 6px 0; }
      .imm-lines { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
      .imm-lines li { padding-left: 12px; border-left: 3px solid var(--accent, #4fd1c5); font-size: .84rem; color: var(--ink-dim); }
      .imm-lines li b { color: var(--ink); display: block; }
      .imm-row2 { display: flex; flex-wrap: wrap; gap: 6px; }
    `;
    document.head.appendChild(st);
  }

  // ---------- actions ----------
  const lastExposure = (id) => [...M.records].reverse().find((r) => r.id === id);
  function setPath(id) {
    if (id === pathId) return;
    pathId = id; prion = false; resetBugs();
    for (let i = 0; i < NHOST; i++) { host[i].inf = 0; host[i].die = 0; }
    pathSeg?.set(id);
    buildInset(); insetEl.style.display = id === "virus" && stage === "wound" ? "" : "none";
  }
  function doInfect(id) {
    if (prion) { engine.toast?.("Prions are not simulated: see the classification card."); return; }
    skip = null; setPath(id);
    const s = M.slot(id);
    M.infect(id);
    entryQ = Math.max(3, Math.round(NB * Math.pow(clamp(id === "virus" ? s.P / 1.5 : s.P, 0, 1), 0.6)));
    engine.toast?.(`${id === "virus" ? "Virus particles" : "Bacteria"} entered through the cut`);
  }
  function doVaccinate(id) {
    if (prion) return;
    skip = null; if (id !== pathId) setPath(id);
    M.vaccinate(id);
    engine.toast?.("Inactivated vaccine given: no live germs, but the antigen still reaches the immune system");
  }
  function startSkip(left, until, then) { skip = { left, until, then, adv: 0 }; engine.toast?.("Skipping ahead in time…"); }
  function resetAll() {
    skip = null; M.reset(); resetBugs();
    for (const a of LA) { a.on = false; a.st = 0; a.hold = -1; }
    macs.slice(0, 2).forEach((a) => startIdle(a, false));
    LA.filter((a) => a.type === 0).slice(0, 2).forEach((a) => startCirc(a, true));
    for (const h of host) { h.inf = 0; h.die = 0; }
    sigLife.fill(0); phi = 0; R = R0; hostK = 0;
    for (const a of abN) a.on = false;
    for (const id in nodeVis) nodeVis[id].fill(0);
    mhcVis.fill(0);
  }
  async function setStage(id) {
    if (id === stage || stageBusy || engine.busy) { stageSeg?.set(stage); return; }
    stageBusy = true;
    try {
      await engine.fadeTo(1, engine.reducedMotion ? 30 : 220);
      stage = id;
      gW.visible = id === "wound"; gP.visible = id === "phago"; gN.visible = id === "node";
      engine.select(null);
      const v = level.view;
      engine.controls.minDistance = id === "wound" ? 8 : 5; engine.controls.maxDistance = id === "wound" ? 420 : 260;
      engine.controls.target.copy(v.target);
      engine.camera.position.copy(v.target).addScaledVector(v.dir.clone().normalize(), v.distance);
      engine.controls.update(); engine.userMoved = false;
      stageSeg?.set(id);
      if (blurbEl) blurbEl.innerHTML = lens.pick(STAGE_BLURB[id]);
      if (phagoCard) phagoCard.style.display = id === "phago" ? "" : "none";
      if (insetEl) insetEl.style.display = id === "wound" && pathId === "virus" ? "" : "none";
      if (id === "phago") { pm.t = 0; pm.playing = true; }
      await engine.fadeTo(0, engine.reducedMotion ? 30 : 320);
    } finally { stageBusy = false; engine.fadeTo(0, 200); }
  }

  // ---------- selection ----------
  function showSelection(info) {
    if (!selCard) return;
    if (!info) { selCard.style.display = "none"; return; }
    const o = PARTS[info.kind];
    if (!o) return;
    selCard.style.display = "";
    selCard.innerHTML = `<h2>Selected</h2><p style="color:var(--ink);font-weight:600;margin-bottom:4px"><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${o.color};margin-right:6px"></i>${lens.pick(o.name)}</p><p>${lens.pick(o.role)}</p>${o.note ? `<p class="hint">${lens.pick(o.note)}</p>` : ""}`;
    if (info.point) { selRing.position.copy(info.point); selT = 1.4; selRing.material.opacity = 0.9; }
  }

  // ---------- herd immunity ----------
  const herd = { disease: "measles", r0: DISEASES.measles.r0, cov: 0.5, eff: 1, acc: 0, wait: 0, dirty: true };
  const simA = new HerdSim({ r0: herd.r0, coverage: 0, eff: 1, seed: 11 }), simB = new HerdSim({ r0: herd.r0, coverage: herd.cov, eff: 1, seed: 11 });
  let herdCanvA = null, herdCanvB = null, herdInfo = null, herdStat = null;
  function herdRestart() {
    simA.setParams({ r0: herd.r0, coverage: 0, eff: herd.eff }); simB.setParams({ r0: herd.r0, coverage: herd.cov, eff: herd.eff });
    herd.acc = 0; herd.wait = 0; herd.dirty = true;
    herdCheck();
  }
  const herdNeed = () => coverageNeeded(herd.r0, herd.eff);
  function herdCheck() { if (herd.r0 >= 12 && herdReached(herd.r0, herd.cov, herd.eff) && herd.cov > 0) ms.herd = true; }
  function drawHerd() {
    for (const [cv, sim] of [[herdCanvA, simA], [herdCanvB, simB]]) {
      if (!cv) continue;
      const w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
      if (!w) continue;
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const c = cv.getContext("2d");
      c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
      const cols = ["#9db2cc", "#ef4444", "#a78bfa", "#34d399"];
      for (let i = 0; i < sim.n; i++) {
        const p = sim.pos[i], st = sim.state[i], x = 8 + p.x * (w - 16), y = 8 + p.y * (h - 16);
        if (st === 1) { c.fillStyle = "rgba(239,68,68,0.25)"; c.beginPath(); c.arc(x, y, 6, 0, 6.283); c.fill(); }
        c.fillStyle = cols[st]; c.beginPath(); c.arc(x, y, st === 1 ? 3.4 : 2.8, 0, 6.283); c.fill();
        if (sim.vacc[i] && st === 0) { c.strokeStyle = "#34d399"; c.lineWidth = 1; c.beginPath(); c.arc(x, y, 4.2, 0, 6.283); c.stroke(); }
      }
    }
    if (herdStat) {
      const a = simA.attackRate(), b = simB.attackRate();
      herdStat[0].innerHTML = `<b>No vaccination.</b> ${Math.round(a * 100)}% caught it${simA.done ? "" : " so far"}.`;
      herdStat[1].innerHTML = `<b>${Math.round(herd.cov * 100)}% vaccinated.</b> ${Math.round(b * 100)}% caught it${simB.done ? "" : " so far"}.`;
    }
    if (herdInfo) {
      const th = herdThreshold(herd.r0), need = herdNeed(), ok = herdReached(herd.r0, herd.cov, herd.eff);
      const sen = lens.atLeast("y11");
      herdInfo.innerHTML = `<p style="margin:0 0 6px">Threshold: 1 − 1/R₀ = 1 − 1/${+herd.r0.toFixed(1)} = <b>${(th * 100).toFixed(0)}%</b>${sen && herd.eff < 0.999 ? `. With a vaccine that protects ${Math.round(herd.eff * 100)}% of those vaccinated you need <b>${need > 1 ? `${(need * 100).toFixed(0)}%, which is more than everyone: not reachable by this vaccine alone` : (need * 100).toFixed(0) + "% coverage"}</b>.` : "."}</p><span class="imm-badge ${ok ? "ok" : "no"}">${ok ? "✓ Herd immunity reached (R_eff below 1)" : "Not reached: outbreaks can spread"}</span>`;
    }
  }
  function buildHerd(parent) {
    herdCard = K.card(parent, lens.pick({ "y9-10": "Herd immunity" }));
    herdCard.insertAdjacentHTML("beforeend", `<p class="hint" style="margin:0 0 8px">${lens.pick(HERD_NOTE)}</p>`);
    const opts = Object.entries(DISEASES).map(([k, d]) => ({ value: k, label: d.name.replace("Original ", "").replace("Seasonal ", "") }));
    let r0s, covs, effs;
    K.segmented(herdCard, opts, herd.disease, (v) => { herd.disease = v; herd.r0 = DISEASES[v].r0; r0s.value = herd.r0; herdRestart(); });
    r0s = K.slider(herdCard, { label: "R₀ (people infected by one case)", min: 1, max: HERD_R0_MAX, step: 0.5, value: herd.r0, format: (v) => `${v}`, onInput: (v) => { herd.r0 = v; herdRestart(); } });
    covs = K.slider(herdCard, { label: "Vaccination coverage", min: 0, max: 100, step: 1, value: Math.round(herd.cov * 100), unit: " %", onInput: (v) => { herd.cov = v / 100; herdRestart(); } });
    if (lens.atLeast("y11")) effs = K.slider(herdCard, { label: "Vaccine effectiveness (share of vaccinated who are immune)", min: 40, max: 100, step: 1, value: Math.round(herd.eff * 100), unit: " %", onInput: (v) => { herd.eff = v / 100; herdRestart(); } });
    else herd.eff = 1;
    const wrap = document.createElement("div"); wrap.className = "imm-herd";
    herdCanvA = document.createElement("canvas"); herdCanvB = document.createElement("canvas");
    herdCanvA.setAttribute("role", "img"); herdCanvB.setAttribute("role", "img");
    herdCanvA.setAttribute("aria-label", "A population of 150 people with nobody vaccinated, and the spread of an outbreak"); herdCanvB.setAttribute("aria-label", "The same population with the chosen vaccination coverage, and the spread of an outbreak");
    const fa = document.createElement("figure"), fb = document.createElement("figure"), ca = document.createElement("figcaption"), cb = document.createElement("figcaption");
    fa.append(herdCanvA, ca); fb.append(herdCanvB, cb); wrap.append(fa, fb);
    herdStat = [ca, cb];
    herdCard.appendChild(wrap);
    herdCard.insertAdjacentHTML("beforeend", `<div class="legend" style="margin:2px 0 8px"><span><i style="background:#9db2cc"></i>Can catch it</span><span><i style="background:#ef4444"></i>Infected</span><span><i style="background:#a78bfa"></i>Recovered</span><span><i style="background:#34d399"></i>Immune (vaccinated)</span></div>`);
    herdInfo = document.createElement("div"); herdCard.appendChild(herdInfo);
    K.button(K.buttonRow(herdCard), "Run the outbreak again", () => { simA.build(Math.floor(Math.random() * 1e6)); simB.build(0); simA.seedKeep = 0; herdRestart(); });
    herdCard.insertAdjacentHTML("beforeend", `<p class="hint" style="margin-bottom:0">${lens.pick({ "y9-10": "Only 150 dots, so it is a bit random. Measles is so contagious (R₀ about 12–18) that about 92–95% of people must be immune.", y11: "A population of 150 on a contact network (not random mixing), so results are noisy. Measles (R₀ about 12–18) needs about 92–95% immune, even higher if the vaccine is not 100% effective." })}</p>`);
    herdRestart();
  }

  // ---------- panel ----------
  function buildPanel(el) {
    panelEl = el; el.innerHTML = "";
    const host0 = document.createElement("div"); host0.style.display = "contents"; el.appendChild(host0);
    progress = { band: lens.band, node: host0 }; el = host0;
    const sc = K.card(el, lens.pick({ "y7-8": "Choose a view", "y9-10": "View" }));
    stageSeg = K.segmented(sc, STAGES.map((s) => ({ value: s.id, label: lens.pick(s.label) })), stage, (v) => setStage(v));
    blurbEl = document.createElement("p"); blurbEl.className = "hint"; blurbEl.style.margin = "8px 0 0"; blurbEl.innerHTML = lens.pick(STAGE_BLURB[stage]); sc.appendChild(blurbEl);
    sc.insertAdjacentHTML("beforeend", `<p class="hint">${lens.pick(NOTE)}</p>`);
    const ex = K.card(el, "What's happening", "explain"); explainBody = document.createElement("div"); ex.appendChild(explainBody);
    selCard = K.card(el, "Selected", "sel-card"); selCard.style.display = "none";

    // controls
    const ctl = K.card(el, lens.pick({ "y7-8": "Try it", "y9-10": "Infection and vaccination" }));
    pathSeg = K.segmented(ctl, [{ value: "bacterium", label: "🦠 Bacterium" }, { value: "virus", label: "Virus" }, ...(lens.atLeast("y9-10") ? [{ value: "prion", label: "Prion" }] : [])], prion ? "prion" : pathId, (v) => {
      if (v === "prion") { prion = true; resetBugs(); if (insetEl) insetEl.style.display = "none"; classBox.style.outline = "2px solid var(--accent)"; engine.toast?.("Prions are explained on the classification card (not simulated)"); classBox.scrollIntoView?.({ block: "nearest", behavior: "smooth" }); return; }
      classBox.style.outline = ""; prion = false; setPath(v);
    });
    ctl.insertAdjacentHTML("beforeend", `<p class="hint" style="margin:6px 0 8px">${lens.pick({ "y7-8": "Pick a germ, then press Infect. Try Reinfect later to see your body remember.", "y9-10": "Infect, wait, then reinfect: memory cells make the second response faster. Try a different germ (no memory for it), or vaccinate first.", y11: "Memory is specific: the same pathogen gives a secondary response; a different pathogen starts a new primary response. Vaccination here is an inactivated antigen with an adjuvant: no live pathogen, so no illness." })}</p>`);
    const r1 = K.buttonRow(ctl);
    K.button(r1, "🦠 Infect", () => doInfect(pathId), { kind: "primary" });
    K.button(r1, "💉 Vaccinate", () => doVaccinate(pathId));
    if (lens.atLeast("y9-10")) { const r2 = K.buttonRow(ctl); K.button(r2, "⏩ Reinfect later (same germ)", () => { if (prion) return; const t0 = M.day; startSkip(400, () => !M.anyActive && M.day - t0 >= 40, () => doInfect(pathId)); }); K.button(r2, "🔁 Infect with a different germ", () => doInfect(PATHOGENS[pathId].other)); }
    const r3 = K.buttonRow(ctl);
    K.button(r3, "Wait 30 days ⏩", () => startSkip(30));
    K.button(r3, "Reset", resetAll);
    K.slider(ctl, { label: "Time speed", min: 0, max: 4, step: 1, value: SPEEDS.indexOf(speed), format: (v) => `${SPEEDS[v]}× (1 day = ${(DAY_SECONDS / SPEEDS[v]).toFixed(DAY_SECONDS / SPEEDS[v] < 3 ? 1 : 0)} s)`, onInput: (v) => (speed = SPEEDS[v]) });
    if (lens.atLeast("y11")) K.checkbox(ctl, "Immune-compromised: fewer helper T cells (as in untreated HIV)", M.compromised, (v) => (M.compromised = v));
    K.checkbox(ctl, "Show labels", showLabels, (v) => (showLabels = v));

    // phagocytosis controls
    phagoCard = K.card(el, lens.pick({ "y7-8": "Eating a germ, step by step", "y9-10": "Phagocytosis steps" }));
    phagoSeg = K.segmented(phagoCard, [0, 1, 2, 3].map((i) => ({ value: i, label: lens.pick(PHAGO_STEPS[i].title) })), pm.step, (v) => { pm.t = phaseStart(v) + 0.01; pm.playing = true; playBtn.textContent = "⏸ Pause"; });
    phagoTxt = document.createElement("p"); phagoTxt.style.margin = "8px 0"; phagoCard.appendChild(phagoTxt);
    const pr = K.buttonRow(phagoCard);
    playBtn = K.button(pr, "⏸ Pause", () => { pm.playing = !pm.playing; playBtn.textContent = pm.playing ? "⏸ Pause" : "▶ Play"; });
    K.button(pr, "↺ Restart", () => { pm.t = 0; pm.playing = true; playBtn.textContent = "⏸ Pause"; });
    K.checkbox(phagoCard, lens.atLeast("y11") ? "Opsonised: antibodies coat the bacterium" : "Add antibodies to the germ", pm.opson, (v) => { pm.opson = v; pm.t = 0; pm.playing = true; });
    phagoCard.insertAdjacentHTML("beforeend", `<p class="hint">${lens.pick({ "y7-8": "Antibodies stick to the germ and make it easier for the white blood cell to grab.", "y9-10": "Antibodies on the bacterium make it easier for the macrophage to grab (opsonisation), so engulfing is faster. Link: lysosomes are the same organelles as in the animal cell.", y11: "Opsonisation: antibody Fab arms bind the bacterium and the Fc regions bind Fc receptors on the phagocyte, which speeds engulfment. The lysosomes here are the same organelle as in the animal-cell level (autophagy there, phagocytosis here)." })}</p>`);
    phagoCard.style.display = stage === "phago" ? "" : "none";

    // chart
    const ch = K.card(el, lens.pick({ "y7-8": "Antibodies over time", "y9-10": "Antibody level over time" }));
    chart = document.createElement("canvas"); chart.className = "mini-chart"; chart.style.height = "150px"; chart.setAttribute("role", "img"); ch.appendChild(chart); chartCtx = chart.getContext("2d");
    ch.insertAdjacentHTML("beforeend", `<div class="legend" style="margin-top:6px">${lens.atLeast("y11") ? `<span><i style="background:#fbbf24"></i>IgM</span><span><i style="background:#2dd4bf"></i>IgG</span>` : `<span><i style="background:#e8f1ff"></i>Antibodies</span>`}${lens.atLeast("y9-10") ? `<span><i style="background:#f87171"></i>Pathogen (dashed)</span>` : ""}<span><i style="background:#9aa5b5"></i>Other germ</span><span><i style="background:#f87171"></i>I = infection &nbsp;<i style="background:#4ade80"></i>V = vaccine</span></div>`);
    ch.insertAdjacentHTML("beforeend", `<p class="hint">${lens.pick({ "y7-8": "The line only rises about a week after the germ arrives. The second time it rises sooner and higher.", "y9-10": "Antibody concentration in relative units (primary peak ≈ 1). First exposure: a lag of about a week, then a modest peak. Second exposure: a short lag and a much bigger, longer-lasting peak.", y11: "Relative antibody concentration. Primary: lag of about 7–10 days, a modest peak, IgM first then IgG. Secondary: lag of 1–3 days, a much larger and longer-lasting peak, mostly IgG, from memory cells." })}</p>`);
    if (lens.atLeast("y11")) K.checkbox(ch, "Log scale", logScale, (v) => { logScale = v; drawChart(); });

    // three lines of defence / innate vs adaptive
    const df = K.card(el, lens.pick({ "y7-8": "How your body fights germs", "y9-10": "Three lines of defence", y11: "Innate vs adaptive immunity" }));
    if (lens.atLeast("y11")) {
      df.insertAdjacentHTML("beforeend", `<table class="imm-tbl"><tr><th></th><th>Innate</th><th>Adaptive</th></tr>${COMPARE.map((r) => `<tr><th>${r.a}</th><td>${r.i}</td><td>${r.d}</td></tr>`).join("")}</table><p class="hint">Barriers and secretions (skin, mucus, lysozyme, acid), phagocytic leukocytes, inflammation and interleukin signalling belong to the innate side; interleukins also link innate cells to helper T cells.</p>`);
    } else df.insertAdjacentHTML("beforeend", `<ol class="imm-lines">${DEFENCES[lens.band === "y7-8" ? "y7-8" : "y9-10"].map((d) => `<li><b>${d.h}</b>${d.t}</li>`).join("")}</ol>`);

    // classification (and the prion card)
    classBox = K.card(el, lens.pick({ "y7-8": "Kinds of germs", "y9-10": "Kinds of pathogen", y12: "Classifying pathogens" }));
    if (lens.band !== "y7-8") {
      classBox.insertAdjacentHTML("beforeend", `<p class="hint" style="margin:0 0 6px">${lens.pick(CLASSIFY.intro)}</p>`);
      const senC = lens.band === "y12";
      classBox.insertAdjacentHTML("beforeend", `<table class="imm-tbl"><tr><th>Type</th><th>${senC ? "Cellular?" : "Cell?"}</th>${senC ? "<th>Example</th>" : ""}</tr>${CLASSIFY.rows.map((r) => `<tr><th>${r.type}</th><td>${senC ? r.cell : r.cell.startsWith("Non") ? "No" : "Yes"}</td>${senC ? `<td>${r.eg}</td>` : ""}</tr>`).join("")}</table>`);
      if (senC) classBox.insertAdjacentHTML("beforeend", `<p class="hint">Viruses: ${CLASSIFY.rows[3].note}</p>`);
      classBox.insertAdjacentHTML("beforeend", `<p style="margin:8px 0 0">${lens.pick(CLASSIFY.prion)}</p>`);
    } else classBox.insertAdjacentHTML("beforeend", `<p class="hint" style="margin:0">Germs include bacteria (tiny living cells), viruses (much smaller, not cells) and some fungi. Pick one at the top of the page and press Infect.</p>`);

    if (lens.atLeast("y9-10")) buildHerd(el);
    mission = K.missions(el, lens.filter(MISSIONS).map((m) => ({ text: m.text, check: () => m.check(M, ms) })), (m) => engine.toast(`🎯 Mission complete: ${m.text.replace(/<[^>]+>/g, "")}`, 3400));
    K.quiz(el, lens.filter(QUIZ));
    buildChips();
    uiT = 0;
  }
  let classBox = null;
  function buildChips() {
    dayChip = K.chip(engine.overlay, ""); abChip = K.chip(engine.overlay, "");
    buildInset(); insetEl.style.display = pathId === "virus" && stage === "wound" ? "" : "none";
    updateChips(true);
  }
  function stateWord() {
    const id = pathId, rec = lastExposure(id);
    if (!rec) return lens.pick({ "y7-8": "no germs yet", y11: "no exposure yet" });
    const ph = M.phase(id), sec = rec.secondary;
    const lab = { priming: "innate response", expanding: "adaptive response starting", secreting: "making antibodies", memory: "memory only", naive: "" }[ph];
    return `${sec ? "secondary" : rec.kind === "vaccinate" ? "vaccine" : "primary"} · ${lab}`;
  }
  function updateChips(force) {
    if (!dayChip) return;
    dayChip(`<b>Day ${M.day.toFixed(1)}</b> · ${stateWord()}`);
    const tot = M.total(pathId);
    abChip(`<span class="dot" style="background:#fcd34d"></span>${lens.pick({ "y7-8": "Antibodies", y11: "Antibody level" })}: <b>${tot.toFixed(2)}</b>${lens.atLeast("y12") && tot > DETECT ? ` · mostly ${M.dominant(pathId)}` : ""}`);
  }

  // ---------- the level ----------
  const level = {
    title: "Immune defence",
    topics: ["immunity"],
    root, pickables, portals: [],
    metersPerUnit: 1e-6,
    get view() {
      const a = engine.camera.aspect;
      if (stage === "phago") return { target: new THREE.Vector3(5, 0, 0), distance: clamp(Math.max(34, 17 / (0.344 * a)), 34, 150), dir: new THREE.Vector3(0.12, 0.2, 1) };
      if (stage === "node") return { target: new THREE.Vector3(3, -1, 0), distance: clamp(Math.max(78, 40 / (0.344 * a)), 78, 280), dir: new THREE.Vector3(0.08, 0.16, 1) };
      return { target: new THREE.Vector3(-2, -9, 0), distance: clamp(Math.max(130, (a < 0.9 ? 40 : 54) / (0.344 * a)), 130, 400), dir: new THREE.Vector3(0.06, 0.14, 1) };
    },
    minDistance: 8, maxDistance: 420, near: 0.3, far: 2200,
    env: { bg: ["#0b1024", "#271036", "#4a1b3c"], fog: ["#150a22", 0.0045], exposure: 0.95, bloom: [0.32, 0.6, 0.9], aperture: 0.0003 },
    info(obj) {
      const k = obj.userData.kind;
      if (!k || !PARTS[k]) return null;
      return { title: lens.pick(PARTS[k].name), kind: k, portal: null };
    },
    onStyle(name) { clayOn = name === "clay"; vessel.visible = !clayOn; vesselBack.visible = clayOn; },
    onSelect(info) { showSelection(info); },
    onClick(e, hit) {
      const k = hit?.object?.userData?.kind;
      if (k === "tc" && pathId === "virus") ms.pickedTc = true;
      if (hit?.point) selRing.scale.setScalar(clamp(engine.camera.position.distanceTo(hit.point) * 0.05, 1.5, 12));
      return false;
    },
    mountPanel(el) {
      makeLabels();
      if (progress && progress.band === lens.band) { panelEl = el; el.appendChild(progress.node); buildChips(); }
      else buildPanel(el);
    },
    unmountPanel() {
      for (const l of labels) l.el.style.display = "none";
      insetEl?.remove(); insetEl = null; engine.overlay.innerHTML = "";
    },
    onResume() { makeLabels(); },
    onLens() { showLabels = lens.band === "y7-8" || lens.band === "y9-10"; progress = null; makeLabels(); buildPanel(panelEl); },
    dispose() { for (const l of labels) l.el.remove(); insetEl?.remove(); },
    update(dt, t, rdt = dt) {
      uTime.value = t;
      // the model: normal speed, or fast-forward
      if (skip) {
        const adv = Math.min(9 * rdt, skip.left);
        M.step(adv); skip.left -= adv; skip.adv += adv;
        if ((skip.until ? skip.until() : skip.left <= 1e-6) || skip.left <= 1e-6) { const f = skip.then; skip = null; f?.(); }
      } else if (dt > 0) M.step((dt / DAY_SECONDS) * speed);
      const sdt = skip ? dt * 2 : dt * speed > 0 ? Math.min(dt * Math.max(speed, 1), 0.08) : 0;
      if (stage === "wound") { updateVessel(sdt, t); updateAgents(sdt, t); renderAgents(t); updateBugs(sdt, t); updateSignals(sdt, t); updateHosts(sdt, t); updateFreeAb(sdt, t); }
      else if (stage === "phago") updatePhago(dt * Math.min(speed, 4), t);
      else updateNode(sdt, t);
      if (selT > 0) { selT -= rdt; selRing.material.opacity = Math.max(0, selT / 1.4) * 0.8; }
      updateLabels();
      if (insetCtx && insetEl?.style.display !== "none") drawInset(t);
      if ((uiT -= rdt) <= 0) {
        uiT = 0.4;
        if (explainBody) { const html = narrative(M, lens.band, { id: pathId }).map((p) => `<p>${p}</p>`).join("") + (prion ? `<p class="hint">Prions are shown only as information: see the classification card.</p>` : ""); if (explainBody.innerHTML !== html) explainBody.innerHTML = html; }
        updateChips();
        drawChart();
        if (phagoTxt && stage === "phago") {
          const html = `<b>${lens.pick(PHAGO_STEPS[pm.step].title)}</b>: ${lens.pick(PHAGO_STEPS[pm.step].text)}`;
          if (phagoTxt.innerHTML !== html) phagoTxt.innerHTML = html;
          phagoSeg?.set(pm.step);
        }
      }
      // herd immunity dots
      if (herdCanvA) {
        herd.acc += rdt;
        if (herd.acc > 0.3) { herd.acc = 0; if (!simA.done) { simA.step(); herd.dirty = true; } if (!simB.done) { simB.step(); herd.dirty = true; } }
        if (herd.dirty) { herd.dirty = false; drawHerd(); }
      }
      mission?.update();
    },
  };
  makeLabels();
  return level;
}
