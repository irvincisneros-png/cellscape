// Level 0 (animal version): a human liver cell (hepatocyte) beside a blood sinusoid. Units: 1 world unit = 1 µm.
// The plant cell morphs into this one in place (see morphIn / morphOut and Engine.swapRoot).
// Behaviour comes from the whole-cell model in animalCellModel.js; the 3D parts only draw what the model says.
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import * as K from "../../kit.js";
import { physical, glass, specks, hash, wobble, softDot } from "../materials.js";
import { AnimalCellModel, N_MITO } from "./animalCellModel.js";
import { ORGANELLES, SWITCHES, FLOWS, MISSIONS, QUIZ, COMPARE, NOTE, narrative } from "./animalCellContent.js";
import { clipGeometryBelow, slabGeometry, clayMaterial } from "../style.js";

// ---------- constants ----------
const PLANT_NUC = new THREE.Vector3(-20.5, 1.5, 0);           // the plant cell's nucleus (morph start)
const PH = [28, 17, 17], PR = 6;                              // the plant membrane's half-extents and corner radius
const NUC = new THREE.Vector3(-1.2, 0.8, -0.6), NUC_R = 5;
const UP = new THREE.Vector3(0, 1, 0), ZAX = new THREE.Vector3(0, 0, 1), XAX = new THREE.Vector3(1, 0, 0);
const CUT = -3;                                               // clay style: the cut-away plane (and the cytoplasm floor), cell frame, µm
const SIN_X = 21.8;                                           // sinusoid centre line (x)
const NLY = 14, NPX = 15, NGLY = 44, NRBC = 13, NMV = 240, NGLUT = 70, NPUMP = 40, NMT = 64;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function mulberry32(a) { return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- the cell's outline: a soft polyhedron (a hepatocyte has ~6+ flat faces), lightly lumpy ----------
const FACES = (() => {
  const a = [], s = Math.SQRT1_2;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) a.push([sx * s, sy * s, 0, 14.2], [sx * s, 0, sy * s, 14.2], [0, sx * s, sy * s, 14.2]);
  a.push([1, 0, 0, 13.4]);                                    // the flat face against the blood vessel
  return a;
})();
function cellRadius(x, y, z) {                                // unit direction in, radius out
  let s = 0;
  for (const f of FACES) { const d = x * f[0] + y * f[1] + z * f[2]; if (d > 0) s += Math.pow(d / f[3], 12); }
  const n = Math.sin(x * 2.3 + 1.1) * Math.sin(y * 2.9 + 0.4) * 0.5 + Math.sin(z * 3.4 + x * 1.9 + 2.0) * 0.35 + Math.sin(y * 4.6 + z * 2.4 + 0.7) * 0.2;
  return Math.pow(s, -1 / 12) * (1 + 0.04 * n);
}
function surfacePoint(x, y, z, out) { const r = cellRadius(x, y, z); return out.set(x * r, y * r * 0.93, z * r * 0.97); }
const _q = new THREE.Vector3();
function insideCell(p, margin) {
  _q.set(p.x, p.y / 0.93, p.z / 0.97);
  const l = _q.length() || 1e-6;
  return l < cellRadius(_q.x / l, _q.y / l, _q.z / l) - margin;
}
function sdRoundBox(x, y, z) {
  const qx = Math.abs(x) - (PH[0] - PR), qy = Math.abs(y) - (PH[1] - PR), qz = Math.abs(z) - (PH[2] - PR);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - PR;
}
function boxPoint(d, outP, outN) {                            // where the plant cell's rounded-box membrane is along direction d
  let lo = 0, hi = 80;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (sdRoundBox(d.x * m, d.y * m, d.z * m) < 0) lo = m; else hi = m; }
  outP.copy(d).multiplyScalar(lo);
  const qx = Math.max(Math.abs(outP.x) - (PH[0] - PR), 0), qy = Math.max(Math.abs(outP.y) - (PH[1] - PR), 0), qz = Math.max(Math.abs(outP.z) - (PH[2] - PR), 0);
  outN.set(Math.sign(outP.x) * qx, Math.sign(outP.y) * qy, Math.sign(outP.z) * qz).normalize();
}
function welded(g) { g.deleteAttribute("normal"); g.deleteAttribute("uv"); return mergeVertices(g); }
function blobGeometry(detail, withBox) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute("normal"); g.deleteAttribute("uv");
  g = mergeVertices(g);
  const P = g.attributes.position, n = P.count, v = new THREE.Vector3(), o = new THREE.Vector3(), nn = new THREE.Vector3();
  const bx = withBox ? new Float32Array(n * 3) : null, bn = withBox ? new Float32Array(n * 3) : null;
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(P, i).normalize();
    if (withBox) { boxPoint(v, o, nn); bx.set([o.x, o.y, o.z], i * 3); bn.set([nn.x, nn.y, nn.z], i * 3); }
    surfacePoint(v.x, v.y, v.z, o);
    P.setXYZ(i, o.x, o.y, o.z);
  }
  g.computeVertexNormals();
  if (withBox) { g.setAttribute("aBox", new THREE.BufferAttribute(bx, 3)); g.setAttribute("aBoxN", new THREE.BufferAttribute(bn, 3)); }
  return g;
}

// ---------- GLSL for the living membrane: slow undulation, crenation spikes, plant-box blend, and the lysis dissolve ----------
const GLSL_NOISE = `
float h31(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7)))*43758.5453); }
float vn(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z); }`;
const GLSL_W = `
uniform float uBox, uTime, uCren;
float W(vec3 p){
  float t = uTime;
  float u = 0.17*sin(p.x*0.41 + t*0.50)*sin(p.y*0.33 - t*0.37 + 1.3) + 0.12*sin(p.z*0.52 + p.x*0.21 + t*0.63) + 0.07*sin(dot(p, vec3(0.7,-0.5,0.4)) + t*0.9);
  float c = 0.0;
  if (uCren > 0.001) {
    float b = sin(p.x*1.05+0.7)*sin(p.y*1.2+1.9)*sin(p.z*1.1+0.3);
    float b2 = sin(p.x*0.8-p.y*0.7+2.1)*sin(p.z*1.4+p.y*0.5);
    c = uCren*0.42*(1.35*pow(clamp(0.5+0.9*b,0.0,1.0),2.5) + 0.5*pow(clamp(0.5+0.7*b2,0.0,1.0),2.0) - 0.5);
  }
  return u + c;
}`;

export function create(engine) {
  const M = new AnimalCellModel();
  const lens = engine.lens;
  const root = new THREE.Group();
  const cellGroup = new THREE.Group();                        // everything inside / on the cell; scaled by volume
  root.add(cellGroup);
  const pickables = [], portals = [];
  const rng = mulberry32(20261009);
  const tmpM = new THREE.Matrix4(), tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpE = new THREE.Euler();
  const tA = new THREE.Vector3(), tB = new THREE.Vector3(), tC = new THREE.Vector3(), tQ2 = new THREE.Quaternion(), tLbl = new THREE.Vector3();
  const tag = (mesh, kind, i = 0) => { mesh.userData.kind = kind; mesh.userData.i = i; pickables.push(mesh); return mesh; };
  const instanced = (geo, mat, n, kind) => {
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.frustumCulled = false;
    m.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60);   // fixed and generous: instances move, and picking uses this
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (kind) tag(m, kind);
    return m;
  };
  const toWorld = (p, out) => out.copy(p).multiplyScalar(sCell);
  let sCell = 1;

  // clay style state (see setClay below): the cell is cut in half and its organelles sit on the cytoplasm floor
  let clay = false;
  const clayK = { mito: 1, small: 1 };
  const RIM = new Float32Array(128);                          // distance from the cell axis to the membrane at the cut, per angle

  // ---------- morph state ----------
  const morph = { k: 1, e: 1, org: 1, cyto: 1 };
  let burstT = 0, dissolve = 0;

  // ---------- layout helpers ----------
  const collide = [];                                         // {p, r}
  const nucDirCentro = new THREE.Vector3(0.5, 0.32, 0.8).normalize();
  const CENTRO = nucDirCentro.clone().multiplyScalar(NUC_R + 1.05).add(NUC);   // the centrosome sits against the nucleus
  const rerPatches = [];                                      // {dir, ext}
  const nearRER = (p, rad) => {
    tA.copy(p).sub(NUC);
    const l = tA.length();
    if (l > NUC_R + 4.4 || l < 1e-3) return false;
    tA.multiplyScalar(1 / l);
    return rerPatches.some((q) => tA.dot(q.dir) > Math.cos(q.ext + 0.28 + rad / Math.max(l, 1)));
  };
  function sample(rad, margin = 0.6, { filter, spread = 1, tries = 300, ignore = 0 } = {}) {
    for (let k = 0; k < tries; k++) {
      const p = new THREE.Vector3((rng() * 2 - 1) * 16, (rng() * 2 - 1) * 15, (rng() * 2 - 1) * 15.5);
      if (!insideCell(p, rad + margin)) continue;
      if (p.distanceTo(NUC) < NUC_R + rad + 0.5) continue;
      if (nearRER(p, rad)) continue;
      if (collide.some((c) => c.p.distanceTo(p) < (c.r + rad) * spread - ignore)) continue;
      if (filter && !filter(p)) continue;
      return p;
    }
    return null;
  }
  const occupy = (p, r) => { collide.push({ p, r }); return p; };
  occupy(NUC.clone(), NUC_R + 0.6);

  // ---------- plant → animal morph targets for the membrane ----------
  const cPlantMem = new THREE.Color("#a78bfa"), rPlantMem = new THREE.Color("#ddd6fe");
  const cAnimMem = new THREE.Color("#fb7185"), rAnimMem = new THREE.Color("#fecdd3");

  // ---------- membrane ----------
  const memMat = glass("#fb7185", { rim: "#fecdd3", minAlpha: 0.03, maxAlpha: 0.36, rimStrength: 0.6, rimPower: 2.0 });
  const memU = { uBox: { value: 1 }, uTime: { value: 0 }, uCren: { value: 0 }, uBurst: { value: 0 } };
  const memBase = memMat.onBeforeCompile;
  memMat.onBeforeCompile = (sh) => {
    memBase(sh);
    Object.assign(sh.uniforms, memU);
    sh.vertexShader = sh.vertexShader
      .replace("void main() {", `attribute vec3 aBox; attribute vec3 aBoxN; varying vec3 vObj;\n${GLSL_W}\nvoid main() {`)
      .replace("#include <beginnormal_vertex>", `
        float wd0 = W(position);
        float e0 = 0.08;
        vec3 gW = vec3(W(position + vec3(e0,0.,0.)) - wd0, W(position + vec3(0.,e0,0.)) - wd0, W(position + vec3(0.,0.,e0)) - wd0) / e0;
        vec3 nB = normalize(normal - (gW - normal * dot(gW, normal)));
        vec3 objectNormal = normalize(mix(nB, aBoxN, uBox));`)
      .replace("#include <begin_vertex>", `
        vec3 transformed = mix(position + normal * wd0, aBox, uBox);
        vObj = position;`);
    sh.fragmentShader = sh.fragmentShader
      .replace("void main() {", `varying vec3 vObj; uniform float uBurst;\n${GLSL_NOISE}\nvoid main() {
        float bh = vn(vObj * 0.32 + 5.0) * 0.65 + vn(vObj * 0.9) * 0.35;
        float bt = uBurst * 1.25 - 0.12;
        if (uBurst > 0.0 && bh < bt) discard;`)
      .replace("#include <tonemapping_fragment>", `
        if (uBurst > 0.0) { float ed = 1.0 - smoothstep(0.0, 0.07, bh - bt); gl_FragColor.rgb += rimColor * ed * 1.6; gl_FragColor.a = max(gl_FragColor.a, ed * 0.85 * (1.0 - uBurst)); }
        #include <tonemapping_fragment>`);
  };
  memMat.customProgramCacheKey = () => "animalMembrane";
  const membrane = new THREE.Mesh(blobGeometry(30, true), memMat);
  membrane.frustumCulled = false;
  membrane.renderOrder = 4;
  membrane.userData.clayHide = true;
  cellGroup.add(membrane);
  const memHandle = new THREE.Mesh(blobGeometry(7, false), new THREE.MeshBasicMaterial({ visible: false }));
  memHandle.scale.setScalar(0.995);
  tag(memHandle, "membrane"); pickables.pop();               // fallback pick only
  cellGroup.add(memHandle);

  // ---------- nucleus (same look as the plant cell's) ----------
  const nucleus = new THREE.Group();
  nucleus.position.copy(PLANT_NUC);
  const nucShell = tag(new THREE.Mesh(new THREE.SphereGeometry(NUC_R, 56, 36), glass("#8b5cf6", { rim: "#c4b5fd", minAlpha: 0.14, maxAlpha: 0.85, rimStrength: 0.7 })), "nucleus");
  const nucleolus = new THREE.Mesh(new THREE.SphereGeometry(1.6, 32, 20), physical("#5b21b6", { emissive: new THREE.Color("#7c3aed"), emissiveIntensity: 0.25 }));
  nucleolus.position.set(0.9, 0.7, 0.4);
  nucleolus.userData.clayHide = true;
  nucShell.userData.clayColor = "#d6a4c6";
  nucleus.add(nucShell, nucleolus);
  const chromMat = physical("#e879f9", { emissive: new THREE.Color("#a21caf"), emissiveIntensity: 0.25, roughness: 0.5 });
  for (let i = 0; i < 9; i++) {
    const pts = [];
    for (let k = 0; k < 7; k++) pts.push(new THREE.Vector3((hash(i * 9 + k) - 0.5) * 6.5, (hash(i * 9 + k + 3) - 0.5) * 6.5, (hash(i * 9 + k + 6) - 0.5) * 6.5).clampLength(0, 3.9));
    const chr = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.11, 6), chromMat);
    chr.userData.clayHide = true;
    nucleus.add(chr);
  }
  { // dense heterochromatin granules just inside the envelope
    const gm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.16, 1), physical("#a21caf", { emissive: new THREE.Color("#701a75"), emissiveIntensity: 0.12 }), 70);
    gm.frustumCulled = false;
    gm.userData.clayHide = true;
    for (let i = 0; i < 70; i++) {
      tA.set(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize().multiplyScalar(NUC_R * (0.72 + 0.2 * rng()));
      const s = 0.6 + rng() * 1.2;
      gm.setMatrixAt(i, tmpM.compose(tA, tmpQ.identity(), tmpS.set(s, s * 0.8, s)));
    }
    nucleus.add(gm);
  }
  const poreGeo = new THREE.TorusGeometry(0.28, 0.09, 8, 16);
  const pores = new THREE.InstancedMesh(poreGeo, physical("#c4b5fd", { emissive: new THREE.Color("#8b5cf6"), emissiveIntensity: 0.3 }), 110);
  pores.frustumCulled = false;
  const poreDirs = [];
  for (let i = 0; i < 110; i++) {
    const y = 1 - (i / 109) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963;
    const d = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
    poreDirs.push(d);
    tmpQ.setFromUnitVectors(ZAX, d);
    pores.setMatrixAt(i, tmpM.compose(tA.copy(d).multiplyScalar(NUC_R), tmpQ, tmpS.set(1, 1, 1)));
  }
  nucleus.add(pores);
  cellGroup.add(nucleus);
  const satellite = (g) => { g.userData.sat = true; nucleus.add(g); return g; };   // parts that travel with the nucleus while it moves

  // ---------- rough ER: stacks of flat, scalloped cisternae hugging the nucleus, with ribosomes ----------
  const rerGroup = satellite(new THREE.Group());
  const fib = (i, n) => { const y = 1 - ((i + 0.5) / n) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963; return new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r); };
  for (let i = 0, n = 0; n < 6 && i < 60; i++) {
    const d = fib((i * 5 + 2) % 40, 40);
    if (d.dot(nucDirCentro) > 0.55 || rerPatches.some((q) => q.dir.dot(d) > 0.5)) continue;
    rerPatches.push({ dir: d, ext: 0.4 + rng() * 0.14 }); n++;
  }
  const sheetGeos = [], riboPos = [];
  const tU = new THREE.Vector3(), tW = new THREE.Vector3();
  rerPatches.forEach((patch, pi) => {
    const d = patch.dir;
    tU.copy(Math.abs(d.y) < 0.9 ? UP : XAX).cross(d).normalize();
    tW.copy(d).cross(tU);
    for (let j = 0; j < 4; j++) {
      const rr = NUC_R + 0.7 + j * 0.5, ext = patch.ext * (1 - j * 0.07), seed = pi * 7.3 + j * 2.1;
      const g = new THREE.PlaneGeometry(1, 1, 22, 16);
      const P = g.attributes.position;
      const sample2 = (a, b, out) => {
        const u = a * Math.sqrt(Math.max(0, 1 - (b * b) / 2)), v = b * Math.sqrt(Math.max(0, 1 - (a * a) / 2));
        const phi = Math.atan2(v, u), rad = Math.hypot(u, v);
        const sc = 1 + 0.16 * Math.sin(phi * 3 + seed) + 0.1 * Math.sin(phi * 5 + seed * 2);
        const uA = u * sc * ext * (1.0 + 0.1 * rad), vA = v * sc * ext * 0.8;
        out.copy(d).addScaledVector(tU, uA).addScaledVector(tW, vA).normalize();
        const r = rr + 0.1 * Math.sin(seed + uA * 7) * Math.cos(vA * 6);
        return out.multiplyScalar(r);
      };
      for (let i = 0; i < P.count; i++) { sample2(P.getX(i) * 2, P.getY(i) * 2, tA); P.setXYZ(i, tA.x, tA.y, tA.z); }
      g.computeVertexNormals();
      sheetGeos.push(g);
      for (let k = 0; k < 36; k++) {
        const a = (rng() * 2 - 1) * 0.92, b = (rng() * 2 - 1) * 0.92;
        sample2(a, b, tA);
        tB.copy(tA).normalize();
        for (const side of [1, -1]) riboPos.push(tA.x + tB.x * 0.1 * side, tA.y + tB.y * 0.1 * side, tA.z + tB.z * 0.1 * side);
      }
    }
  });
  const rerMat = glass("#2dd4bf", { rim: "#99f6e4", minAlpha: 0.12, maxAlpha: 0.7, rimStrength: 0.6, side: THREE.DoubleSide });
  const rer = tag(new THREE.Mesh(mergeGeometries(sheetGeos), rerMat), "er");
  rer.userData.clayColor = "#a3b3f1";
  rerGroup.add(rer);
  const riboMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 6, 5), physical("#6366f1", { emissive: new THREE.Color("#4338ca"), emissiveIntensity: 0.45, roughness: 0.5 }), riboPos.length / 3);
  riboMesh.frustumCulled = false;
  riboMesh.userData.clayColor = "#8b95e8";
  for (let i = 0; i < riboPos.length / 3; i++) riboMesh.setMatrixAt(i, tmpM.makeTranslation(riboPos[i * 3], riboPos[i * 3 + 1], riboPos[i * 3 + 2]));
  rerGroup.add(riboMesh);

  // ---------- centrosome: two centrioles at right angles (drawn larger than life) + a pericentriolar glow ----------
  const centroGroup = satellite(new THREE.Group());
  const centroRel = CENTRO.clone().sub(NUC);
  centroGroup.position.copy(centroRel);
  {
    const trip = (() => { // one triplet of microtubules, three fused tubes
      const gs = [];
      for (let k = 0; k < 3; k++) { const c = new THREE.CylinderGeometry(0.052, 0.052, 1.0, 8, 1, false); c.translate(k * 0.05 - 0.05, k * 0.045, 0); gs.push(c); }
      return mergeGeometries(gs);
    })();
    const cMat = physical("#fda4af", { emissive: new THREE.Color("#fb7185"), emissiveIntensity: 0.55, roughness: 0.4 });
    const hubMat = glass("#fb7185", { rim: "#ffe4e6", minAlpha: 0.12, maxAlpha: 0.5, rimStrength: 0.7 });
    for (let c = 0; c < 2; c++) {
      const cent = new THREE.Group();
      const trMesh = new THREE.InstancedMesh(trip, cMat, 9);
      trMesh.frustumCulled = false;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        tmpQ.setFromEuler(tmpE.set(0, -a + 1.0, 0));        // pinwheel: each triplet lies roughly tangent to the ring
        tA.set(Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32);
        trMesh.setMatrixAt(i, tmpM.compose(tA, tmpQ, tmpS.set(1, 1, 1)));
      }
      cent.add(trMesh, new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.95, 24, 1, true), hubMat));
      // cartwheel hub
      cent.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8), cMat));
      cent.userData.c = c;
      const q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 0.2, 1.1));
      if (c === 0) { cent.quaternion.copy(q1); }
      else { cent.position.set(0, -0.3, 0.82).applyQuaternion(q1); cent.quaternion.copy(q1).multiply(new THREE.Quaternion().setFromAxisAngle(XAX, Math.PI / 2)); }   // daughter at right angles to the mother
      centroGroup.add(cent);
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: "#fb7185", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
    glow.scale.setScalar(4.4);
    glow.userData.clayHide = true;
    centroGroup.add(glow);
    const handle = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
    handle.position.set(0.25, 0.1, 0);
    tag(handle, "centrosome");
    centroGroup.add(handle);
    centroGroup.userData.glow = glow;
  }

  // ---------- Golgi: three stacks beside the centrosome, with vesicles budding from the trans face ----------
  const golgiGroup = satellite(new THREE.Group());
  const golgiMat = glass("#e8a83e", { rim: "#fde68a", minAlpha: 0.38, maxAlpha: 0.92, rimStrength: 0.55, emissive: new THREE.Color("#7c4a1a"), emissiveIntensity: 0.25 });
  const golgiStacks = [];                                     // {pos (cell frame), trans (cell frame), mesh}
  const gVesPos = [], gTinyPos = [];
  {
    const cis = (r) => { // flat cisterna: thin middle, fat scalloped rim, gently dished
      const pts = [[0, -0.02], [0.55 * r, -0.025], [0.86 * r, -0.04], [r, -0.075], [1.03 * r, 0], [r, 0.075], [0.86 * r, 0.04], [0.55 * r, 0.025], [0, 0.02]].map((a) => new THREE.Vector2(a[0], a[1]));
      const g = welded(new THREE.LatheGeometry(pts, 72));
      g.rotateX(Math.PI / 2);
      const P = g.attributes.position;
      for (let i = 0; i < P.count; i++) {
        const x = P.getX(i), y = P.getY(i), z = P.getZ(i), rad = Math.hypot(x, y);
        const ang = Math.atan2(y, x);
        const s = 1 + 0.03 * Math.sin(ang * 5 + r) + 0.02 * Math.sin(ang * 9);
        P.setXYZ(i, x * s, y * s * 0.8, z + 0.07 * rad * rad / (r * r) * r);
      }
      g.computeVertexNormals();
      return g;
    };
    const offs = [
      new THREE.Vector3(1.0, 0.0, 0.0).multiplyScalar(3.0), new THREE.Vector3(-0.2, 0.9, -0.4).multiplyScalar(3.4), new THREE.Vector3(0.1, -0.7, 0.9).multiplyScalar(3.2),
    ];
    offs.forEach((off, gi) => {
      const g = new THREE.Group();
      const pos = centroRel.clone().add(nucDirCentro.clone().multiplyScalar(1.6)).add(off);
      g.position.copy(pos);
      g.lookAt(0, 0, 0);                                      // +z toward the nucleus: cis face in, trans face out
      const geos = [];
      for (let k = 0; k < 6; k++) { const c = cis(1.55 - k * 0.07 + (gi === 1 ? -0.15 : 0)); c.translate(0, 0, -k * 0.24); geos.push(c); }
      const mesh = tag(new THREE.Mesh(mergeGeometries(geos), golgiMat), "golgi", gi);
      mesh.userData.clayColor = "#f2e3bf";
      g.add(mesh);
      golgiGroup.add(g);
      g.updateMatrix();
      const transLocal = tB.set(0, 0, -6 * 0.24 - 0.4);
      const transRel = transLocal.clone().applyMatrix4(g.matrix);
      golgiStacks.push({ pos: pos.clone().add(NUC), trans: transRel.add(NUC), mesh });
      for (let v = 0; v < 4; v++) {   // budding secretory vesicles near the trans face
        tC.set((rng() - 0.5) * 1.8, (rng() - 0.5) * 1.6, -6 * 0.24 - 0.5 - rng() * 1.1).applyMatrix4(g.matrix);
        gVesPos.push(tC.x + NUC.x, tC.y + NUC.y, tC.z + NUC.z);
      }
      for (let v = 0; v < 12; v++) {   // tiny transport vesicles round the rims
        const a = rng() * 6.283, rr = 1.6 + rng() * 0.4;
        tC.set(Math.cos(a) * rr, Math.sin(a) * rr * 0.8, -rng() * 6 * 0.24).applyMatrix4(g.matrix);
        gTinyPos.push(tC.x + NUC.x, tC.y + NUC.y, tC.z + NUC.z);
      }
    });
  }
  const gVesMat = glass("#f472b6", { rim: "#fbcfe8", minAlpha: 0.25, maxAlpha: 0.85, rimStrength: 0.6, emissive: new THREE.Color("#be185d"), emissiveIntensity: 0.25 });
  const gVes = instanced(new THREE.IcosahedronGeometry(0.32, 3), gVesMat, gVesPos.length / 3, "golgi");
  const gTiny = instanced(new THREE.IcosahedronGeometry(0.11, 2), physical("#f5d0a9", { roughness: 0.4 }), gTinyPos.length / 3, "golgi");
  gVes.userData.clayHide = gTiny.userData.clayHide = true;
  cellGroup.add(gVes, gTiny);

  // ---------- mitochondria ----------
  const mitoMat = glass("#ea580c", { rim: "#fdba74", minAlpha: 0.36, maxAlpha: 0.92, rimStrength: 0.55 });
  const mitoGeo = wobble(welded(new THREE.CapsuleGeometry(0.42, 1.3, 10, 26)), 0.045, 2.6, 4);
  mitoGeo.rotateZ(Math.PI / 2);
  const cristaeGeo = (() => {
    const gs = [];
    for (let i = 0; i < 7; i++) {
      const c = new THREE.CylinderGeometry(0.34, 0.34, 0.045, 20, 1, false, 0, Math.PI * 2 * 0.64);
      c.rotateZ(Math.PI / 2);
      c.rotateX(i * 1.9 + 0.4);
      const P = c.attributes.position;
      for (let k = 0; k < P.count; k++) P.setXYZ(k, P.getX(k) + 0.03 * Math.sin(P.getY(k) * 14 + i), P.getY(k), P.getZ(k) + 0.03 * Math.cos(P.getX(k) * 9));
      c.translate(-0.9 + i * 0.3, 0, 0);
      gs.push(c);
    }
    const g = mergeGeometries(gs);
    g.computeVertexNormals();
    return g;
  })();
  const mitoMesh = instanced(mitoGeo, mitoMat, N_MITO, "mitochondrion");
  const cristaeMat = physical("#c2410c", { emissive: new THREE.Color("#9a3412"), emissiveIntensity: 0.3, side: THREE.DoubleSide });
  const cristaeMesh = instanced(cristaeGeo, cristaeMat, N_MITO);
  cristaeMesh.userData.clayColor = "#fde6d4";
  mitoMesh.userData.claySide = cristaeMesh.userData.claySide = "double";
  const mito = [];
  for (let i = 0; i < N_MITO; i++) {
    const L = 0.72 + rng() * 0.95, Rr = 0.78 + rng() * 0.4;
    const p = sample(0.95 * Math.max(L * 0.85, 0.8), 0.5, { spread: 0.8 }) || sample(0.7, 0.4, { spread: 0.5 }) || new THREE.Vector3((rng() - 0.5) * 24, (rng() - 0.5) * 20, (rng() - 0.5) * 20);
    occupy(p, 0.95 * Math.max(L * 0.85, 0.8));
    mito.push({
      base: p.clone(), pos: p.clone(), q: new THREE.Quaternion().setFromEuler(tmpE.set(rng() * 6.28, rng() * 6.28, rng() * 6.28)),
      L, Rr, ph: rng() * 6.28, state: 1, sc: 1, tgt: 1, dieT: -1, lys: -1, qn: new THREE.Quaternion(), sx: 1, sy: 1,
    });
  }
  const colHealthy = new THREE.Color(1, 1, 1), colDamaged = new THREE.Color(0.18, 0.22, 0.32);
  for (let i = 0; i < N_MITO; i++) { mitoMesh.setColorAt(i, colHealthy); cristaeMesh.setColorAt(i, colHealthy); }
  cellGroup.add(mitoMesh, cristaeMesh);

  // ---------- lysosomes: dense, translucent bags with a darker granular core ----------
  const lyMat = glass("#dc2626", { rim: "#fecaca", minAlpha: 0.4, maxAlpha: 0.92, rimStrength: 0.6 });
  const lyGeo = wobble(welded(new THREE.IcosahedronGeometry(1, 4)), 0.1, 2.2, 3);
  const lyCoreMat = physical("#3b0a12", { roughness: 0.6, emissive: new THREE.Color("#5f0f1c"), emissiveIntensity: 0.4 });
  const lyMesh = instanced(lyGeo, lyMat, NLY, "lysosome");
  const lyCore = instanced(new THREE.IcosahedronGeometry(0.62, 2), lyCoreMat, NLY);
  const GRAN = 9;
  const lyGran = instanced(new THREE.IcosahedronGeometry(0.1, 1), physical("#16060a", { roughness: 0.5 }), NLY * GRAN);
  const lyso = [], granLocal = [];
  for (let k = 0; k < GRAN; k++) granLocal.push(new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize().multiplyScalar(0.25 + rng() * 0.3));
  for (let i = 0; i < NLY; i++) {
    const r = 0.26 + Math.pow(rng(), 1.3) * 0.36;
    let p;
    if (i < 3) p = sample(r, 0.3, { filter: (q) => q.distanceTo(golgiStacks[i % 3].pos) < 5 && q.distanceTo(golgiStacks[i % 3].pos) > 2.8 });
    p = p || sample(r, 0.3);
    p = occupy(p || new THREE.Vector3((rng() - 0.5) * 20, (rng() - 0.5) * 20, (rng() - 0.5) * 20), r + 0.1);
    lyso.push({ base: p.clone(), pos: p.clone(), r, ph: rng() * 6.28, q: new THREE.Quaternion().setFromEuler(tmpE.set(rng() * 6, rng() * 6, rng() * 6)), busy: -1, a: 0 });
  }
  const SHELLS = 6;   // autophagosome shells (translucent double membrane that wraps a damaged mitochondrion before a lysosome fuses with it)
  const shellMesh = instanced(new THREE.SphereGeometry(1, 28, 20), glass("#bfe3ff", { rim: "#e0f2fe", minAlpha: 0.05, maxAlpha: 0.5, rimStrength: 0.9 }), SHELLS);
  shellMesh.count = 0;
  cellGroup.add(lyMesh, lyCore, lyGran, shellMesh);

  // ---------- peroxisomes (a liver cell has plenty) ----------
  const pxMat = glass("#eab308", { rim: "#fde047", minAlpha: 0.4, maxAlpha: 0.9 });
  const pxMesh = instanced(wobble(welded(new THREE.IcosahedronGeometry(1, 3)), 0.05, 2.5, 1), pxMat, NPX, "peroxisome");
  const pxCore = instanced(new THREE.BoxGeometry(0.9, 0.9, 0.9, 1, 1, 1), physical("#713f12", { roughness: 0.5 }), NPX);
  const perox = [];
  for (let i = 0; i < NPX; i++) {
    const r = 0.28 + rng() * 0.2;
    const p = occupy(sample(r, 0.3) || new THREE.Vector3((rng() - 0.5) * 22, (rng() - 0.5) * 20, (rng() - 0.5) * 20), r + 0.1);
    perox.push({ base: p.clone(), pos: p.clone(), r, ph: rng() * 6.28, q: new THREE.Quaternion().setFromEuler(tmpE.set(rng() * 6, rng() * 6, rng() * 6)) });
  }
  cellGroup.add(pxMesh, pxCore);

  // ---------- smooth ER: a connected polygonal web of tubes (nodes joined to near neighbours) ----------
  const serGroup = new THREE.Group();
  const serNodes = [];
  {
    for (let tries = 0; tries < 900 && serNodes.length < 78; tries++) {
      const p = sample(0.3, 0.4, { tries: 1, spread: 0, filter: (q) => !collide.some((c, ci) => ci > 0 && c.r > 0.7 && c.p.distanceTo(q) < c.r + 0.3) && serNodes.every((s) => s.distanceTo(q) > 1.7) });
      if (p) serNodes.push(p);
    }
    const edges = new Set(), geos = [];
    const edgeGeo = (a, b) => {
      tA.copy(a).add(b).multiplyScalar(0.5).add(tB.set(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(0.7));
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a.clone(), tA.clone(), b.clone()]), 8, 0.1 + rng() * 0.03, 5, false);
    };
    serNodes.forEach((a, i) => {
      const near = serNodes.map((b, j) => [j, a.distanceTo(b)]).filter(([j, d]) => j !== i && d < 4.6).sort((x, y) => x[1] - y[1]).slice(0, 3);
      near.forEach(([j], idx) => { const key = i < j ? `${i}-${j}` : `${j}-${i}`; if (edges.has(key) || (idx === 2 && rng() < 0.5)) return; edges.add(key); geos.push(edgeGeo(a, serNodes[j])); });
      const s = new THREE.SphereGeometry(0.15 + rng() * 0.05, 8, 6); s.translate(a.x, a.y, a.z); geos.push(s);
    });
    const ser = tag(new THREE.Mesh(mergeGeometries(geos), glass("#38bdf8", { rim: "#bae6fd", minAlpha: 0.3, maxAlpha: 0.88, rimStrength: 0.55 })), "ser");
    ser.userData.clayHide = true;
    serGroup.add(ser);
    cellGroup.add(serGroup);
  }

  // ---------- glycogen rosettes beside the smooth ER ----------
  const glyMat = physical("#fbcfe8", { roughness: 0.45, emissive: new THREE.Color("#be185d"), emissiveIntensity: 0.18 });
  const glyMesh = instanced(new THREE.IcosahedronGeometry(0.09, 1), glyMat, NGLY * 10, "glycogen");
  const glyc = [];
  for (let i = 0; i < NGLY; i++) {
    let p = null;
    if (serNodes.length && i < NGLY * 0.65) {
      const s = serNodes[Math.floor(rng() * serNodes.length)];
      for (let k = 0; k < 20 && !p; k++) {
        const c = s.clone().add(tA.set(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize().multiplyScalar(0.55 + rng() * 0.3));
        if (insideCell(c, 0.5) && c.distanceTo(NUC) > NUC_R + 0.7 && !nearRER(c, 0.3) && !collide.some((q) => q.p.distanceTo(c) < q.r + 0.1)) p = c;
      }
    }
    p = p || sample(0.3, 0.3, { spread: 0.9 }) || new THREE.Vector3((rng() - 0.5) * 20, (rng() - 0.5) * 18, (rng() - 0.5) * 18);
    const parts = [new THREE.Vector3(0, 0, 0)];
    for (let k = 1; k < 10; k++) parts.push(new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize().multiplyScalar(0.16 + rng() * 0.1));
    glyc.push({ p, parts, ph: rng() * 6.28 });
  }
  cellGroup.add(glyMesh);

  // ---------- cytoskeleton: microtubules from the centrosome out to the cortex ----------
  const mtGroup = new THREE.Group();
  const mtCurves = [];
  let mtIndexPer = 0;
  {
    const geos = [];
    for (let i = 0, made = 0; i < 400 && made < NMT; i++) {
      const dir = fib(i % NMT * 7 % 97, 97).clone();
      dir.add(tA.set(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(0.25)).normalize();
      if (dir.dot(tB.copy(CENTRO).sub(NUC).normalize()) < -0.35) continue;      // rays heading into the nucleus
      // walk outwards until the cortex
      const p = CENTRO.clone(); let guard = 0;
      while (insideCell(p, 0.9) && guard++ < 80) p.addScaledVector(dir, 0.4);
      const pts = [];
      const len = p.distanceTo(CENTRO);
      for (let k = 0; k <= 8; k++) {
        const t = k / 8, q = CENTRO.clone().lerp(p, t);
        q.add(tC.set(Math.sin(i * 1.7 + k * 1.3), Math.cos(i * 2.3 + k * 0.9), Math.sin(i * 0.7 + k * 2.1)).multiplyScalar(0.7 * Math.sin(t * Math.PI) * (len / 14)));
        tA.copy(q).sub(NUC); const l = tA.length();
        if (l < NUC_R + 0.7) q.copy(NUC).addScaledVector(tA.multiplyScalar(1 / l), NUC_R + 0.7);   // go round the nucleus
        pts.push(q);
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      mtCurves.push(curve);
      { const tg = new THREE.TubeGeometry(curve, 28, 0.022, 5, false), uv = tg.attributes.uv, col = new Float32Array(uv.count * 4);
        for (let q = 0; q < uv.count; q++) { col[q * 4] = col[q * 4 + 1] = col[q * 4 + 2] = 1; col[q * 4 + 3] = 1 - 0.72 * uv.getX(q); }   // fades towards the cortex
        tg.setAttribute("color", new THREE.BufferAttribute(col, 4)); geos.push(tg); }
      made++;
    }
    mtIndexPer = geos[0].index.count;
    const mtMat = new THREE.MeshPhysicalMaterial({ color: "#86efac", emissive: new THREE.Color("#34d399"), emissiveIntensity: 0.22, roughness: 0.4, transparent: true, opacity: 0.34, depthWrite: false, vertexColors: true });
    var mtMesh = tag(new THREE.Mesh(mergeGeometries(geos), mtMat), "microtubule");
    mtMesh.userData.clayHide = true;
    mtGroup.add(mtMesh);
    cellGroup.add(mtGroup);
  }
  // actin cortex: a fine mesh just under the membrane (Year 9+, high quality only)
  const actinGroup = new THREE.Group();
  {
    const geos = [];
    for (let i = 0; i < 170; i++) {
      let d = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
      const ax = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
      const pts = [];
      for (let k = 0; k < 6; k++) {
        surfacePoint(d.x, d.y, d.z, tA);
        pts.push(tA.clone().multiplyScalar(0.965));
        d.applyAxisAngle(tB.copy(ax).cross(d).normalize(), 0.075 + rng() * 0.03).applyAxisAngle(ax, 0.04);
        d.normalize();
      }
      geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.028, 4, false));
    }
    const actinMesh = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshBasicMaterial({ color: "#fecdd3", transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }));
    actinMesh.userData.clayHide = true;
    actinGroup.add(actinMesh);
    cellGroup.add(actinGroup);
  }

  // ---------- microvilli on the blood-facing face; GLUT2 + pumps in the membrane ----------
  const mvMat = glass("#fb7185", { rim: "#ffe4e6", minAlpha: 0.35, maxAlpha: 0.9, rimStrength: 0.5 });
  const mvMesh = instanced(new THREE.CapsuleGeometry(0.085, 0.8, 4, 8), mvMat, NMV, "microvilli");
  const mvData = [];
  for (let i = 0; i < NMV; i++) {
    for (let k = 0; k < 30; k++) {
      const d = new THREE.Vector3(0.62 + rng() * 0.38, (rng() - 0.5) * 1.35, (rng() - 0.5) * 1.35).normalize();
      if (d.x < 0.74) continue;
      surfacePoint(d.x, d.y, d.z, tA);
      if (mvData.some((m) => m.p.distanceTo(tA) < 0.55)) continue;
      mvData.push({ p: tA.clone(), n: d.clone(), len: 0.65 + rng() * 0.8, ph: rng() * 6.28 });
      break;
    }
  }
  mvMesh.userData.clayHide = true;
  mvMesh.count = mvData.length;
  mvData.forEach((m, i) => {
    tmpQ.setFromUnitVectors(UP, m.n);
    tA.copy(m.p).addScaledVector(m.n, 0.3 * m.len);
    mvMesh.setMatrixAt(i, tmpM.compose(tA, tmpQ, tmpS.set(1, m.len, 1)));
  });
  cellGroup.add(mvMesh);
  const glutMat = physical("#a3e635", { emissive: new THREE.Color("#84cc16"), emissiveIntensity: 1.2, roughness: 0.35 });
  const glutMesh = instanced(new THREE.TorusGeometry(0.3, 0.1, 8, 16), glutMat, NGLUT, "glut");
  const glutCore = instanced(new THREE.IcosahedronGeometry(0.15, 1), physical("#ecfccb", { emissive: new THREE.Color("#bef264"), emissiveIntensity: 1.3 }), NGLUT);
  const pumpMat = physical("#a78bfa", { emissive: new THREE.Color("#7c3aed"), emissiveIntensity: 0.8, roughness: 0.4 });
  const pumpMesh = instanced(new THREE.DodecahedronGeometry(0.24, 0), pumpMat, NPUMP, "pump");
  const memSites = [];                                        // GLUT first, then pumps: {p, n}
  for (let i = 0; i < NGLUT + NPUMP; i++) {
    const isG = i < NGLUT;
    for (let k = 0; k < 60; k++) {
      const d = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
      if (isG && i < NGLUT * 0.6 && d.x < 0.55) continue;      // most GLUT2 on the blood-facing side
      if (!isG && d.x > 0.5) continue;                         // pumps over the rest of the surface
      surfacePoint(d.x, d.y, d.z, tA);
      if (memSites.some((m) => m.p.distanceTo(tA) < 1.1)) continue;
      if (mvData.some((m) => m.p.distanceTo(tA) < 0.5)) continue;
      memSites.push({ p: tA.clone(), n: d.clone() });
      break;
    }
    if (memSites.length <= i) { const d = fib(i * 3 % 90, 90); surfacePoint(d.x, d.y, d.z, tA); memSites.push({ p: tA.clone(), n: d.clone() }); }
  }
  memSites.forEach((m, i) => {
    tmpQ.setFromUnitVectors(ZAX, m.n);
    tA.copy(m.p).multiplyScalar(0.992);
    if (i < NGLUT) { glutMesh.setMatrixAt(i, tmpM.compose(tA, tmpQ, tmpS.set(1, 1, 1))); glutCore.setMatrixAt(i, tmpM.compose(tA, tmpQ, tmpS.set(1, 1, 1))); }
    else pumpMesh.setMatrixAt(i - NGLUT, tmpM.compose(tA, tmpQ, tmpS.set(1, 1, 1)));
  });
  glutMesh.userData.clayHide = glutCore.userData.clayHide = pumpMesh.userData.clayHide = true;
  cellGroup.add(glutMesh, glutCore, pumpMesh);

  // ---------- cytosol crowding: ribosomes and small molecules ----------
  const crowd = (n, size, cols, opacity, blend = THREE.AdditiveBlending) => {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), pal = cols.map((c) => new THREE.Color(c));
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 40; k++) {
        tA.set((rng() * 2 - 1) * 16, (rng() * 2 - 1) * 15, (rng() * 2 - 1) * 15.5);
        if (insideCell(tA, 0.4) && tA.distanceTo(NUC) > NUC_R + 0.2) break;
      }
      pos.set([tA.x, tA.y, tA.z], i * 3);
      const c = pal[i % pal.length]; col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size, map: softDot(), vertexColors: true, transparent: true, opacity, depthWrite: false, blending: blend }));
    pts.frustumCulled = false;
    return pts;
  };
  const cyto = crowd(2600, 0.15, ["#fbcfe8", "#e9d5ff", "#c4b5fd", "#fda4af"], 0.34);
  const freeRibo = crowd(1300, 0.12, ["#818cf8", "#a5b4fc", "#6366f1"], 0.6);
  cellGroup.add(cyto, freeRibo);
  const outside = specks(700, 0.5, [260, 170, 200], ["#fda4af", "#c4b5fd", "#fde68a", "#f9a8d4"], 0.3);
  root.add(outside);

  // ---------- blood context: the sinusoid, red blood cells and neighbouring liver cells ----------
  const ctxGroup = new THREE.Group();
  root.add(ctxGroup);
  const sinCurve = new THREE.CatmullRomCurve3([[SIN_X - 0.2, -90, -1], [SIN_X + 0.8, -45, 1.5], [SIN_X - 0.5, 0, -0.5], [SIN_X + 1.1, 45, 1.8], [SIN_X, 90, 0]].map((a) => new THREE.Vector3(...a)));
  const SINS = 240, sinSamples = [];
  for (let i = 0; i <= SINS; i++) sinSamples.push(sinCurve.getPointAt(i / SINS));
  const sinAt = (u, out) => { const f = clamp(u, 0, 0.9999) * SINS, i = Math.floor(f); return out.lerpVectors(sinSamples[i], sinSamples[i + 1], f - i); };
  const sinusoid = tag(new THREE.Mesh(new THREE.TubeGeometry(sinCurve, 140, 6.3, 44, false), glass("#b91c1c", { rim: "#fca5a5", minAlpha: 0.03, maxAlpha: 0.3, rimStrength: 0.45, side: THREE.DoubleSide })), "sinusoid");
  sinusoid.renderOrder = 1;
  ctxGroup.add(sinusoid);
  // plasma: drifting proteins and solutes (the pattern repeats along the vessel, so sliding it looks like flow)
  const plasma = (() => {
    const n = 520, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), pal = ["#fecaca", "#fde68a", "#fca5a5"].map((c) => new THREE.Color(c));
    for (let i = 0; i < n; i++) {
      const a = rng() * 6.283, r = Math.sqrt(rng()) * 5.8;
      pos.set([SIN_X + Math.cos(a) * r, (rng() - 0.5) * 160, Math.sin(a) * r], i * 3);
      const c = pal[i % 3]; col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.34, map: softDot(), vertexColors: true, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
    p.frustumCulled = false;
    return p;
  })();
  ctxGroup.add(plasma);
  // red blood cells: biconcave discs (Evans–Fung profile)
  const rbcGeo = (() => {
    const pts = [], D2 = 3.91, N = 22;
    const h = (rho) => 0.5 * D2 * Math.sqrt(Math.max(0, 1 - rho * rho)) * (0.207161 + 2.002558 * rho * rho - 1.122762 * rho ** 4);
    for (let i = 0; i <= N; i++) { const rho = i / N; pts.push(new THREE.Vector2(rho * D2, -h(rho))); }
    for (let i = N - 1; i >= 0; i--) { const rho = i / N; pts.push(new THREE.Vector2(rho * D2, h(rho))); }
    const g = welded(new THREE.LatheGeometry(pts, 44));
    g.computeVertexNormals();
    return g;
  })();
  const rbcMat = physical("#b91c1c", { emissive: new THREE.Color("#5f0a0a"), emissiveIntensity: 0.55, roughness: 0.38, clearcoat: 0.9, sheen: 1, sheenColor: new THREE.Color("#fca5a5") });
  const rbcMesh = instanced(rbcGeo, rbcMat, NRBC, "rbc");
  const rbc = [];
  for (let i = 0; i < NRBC; i++) rbc.push({ u: (i + rng() * 0.6) / NRBC, ox: (rng() - 0.5) * 3.0, oz: (rng() - 0.5) * 3.0, spin: rng() * 6.28, tilt: (rng() - 0.5) * 0.9, sp: 0.8 + rng() * 0.4, ph: rng() * 6.28 });
  ctxGroup.add(rbcMesh);
  // neighbouring liver cells: faint polygonal outlines with a hint of nucleus
  const nbGeo = blobGeometry(9, false), nbMat = glass("#fda4af", { rim: "#fb7185", minAlpha: 0.0, maxAlpha: 0.12, rimStrength: 0.2 });
  const nbNucMat = glass("#8b5cf6", { rim: "#c4b5fd", minAlpha: 0.015, maxAlpha: 0.12, rimStrength: 0.22 });
  const nbNucGeo = wobble(welded(new THREE.IcosahedronGeometry(4.6, 4)), 0.35, 0.5, 2), nbNuclGeo = new THREE.SphereGeometry(1.2, 14, 10);
  for (const [x, y, z, s, ry] of [[-30, 1, -2, 1.0, 0.7], [-3, 30.5, -3, 0.96, 2.0], [-2, -30, 2, 0.98, 4.1], [3, 2, -31, 1.0, 1.2], [-21, -14, 24, 0.92, 3.3], [-18, 17, 22, 0.9, 5.2]]) {
    const nb = new THREE.Mesh(nbGeo, nbMat);
    nb.position.set(x, y, z); nb.scale.setScalar(s); nb.rotation.y = ry;
    ctxGroup.add(nb);
    const nn = new THREE.Mesh(nbNucGeo, nbNucMat);
    nn.position.set(x + 1, y - 1, z + 1); nn.rotation.set(ry, ry * 2, 0);
    const nl = new THREE.Mesh(nbNuclGeo, nbNucMat);
    nl.position.set(x + 1.8, y - 0.4, z + 2.2);
    ctxGroup.add(nn, nl);
  }

  ctxGroup.traverse((o) => { o.userData.clayHide = true; });
  const ctxMats = [sinusoid.material, nbMat, nbNucMat, plasma.material].map((m) => ({ m, base: m.opacity }));

  // ---------- dive markers ----------
  const mkDir = new THREE.Vector3(0.52, -0.42, 0.74).normalize();
  const MEM_SPOT = surfacePoint(mkDir.x, mkDir.y, mkDir.z, new THREE.Vector3());
  const marker = new THREE.Group();
  marker.position.copy(MEM_SPOT).addScaledVector(mkDir, 0.2);
  marker.quaternion.setFromUnitVectors(ZAX, mkDir);
  const markerRing = tag(new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.16, 12, 48), physical("#5eead4", { emissive: new THREE.Color("#2dd4bf"), emissiveIntensity: 1.2 })), "membrane");
  const markerDisc = tag(new THREE.Mesh(new THREE.CircleGeometry(1.7, 32), new THREE.MeshBasicMaterial({ color: "#5eead4", transparent: true, opacity: 0.08, depthWrite: false })), "membrane");
  markerRing.userData.keepMaterial = true;
  marker.add(markerRing, markerDisc);
  cellGroup.add(marker);
  const cyDir = new THREE.Vector3(-0.42, 0.5, 0.76).normalize();
  const CYTO_SPOT = surfacePoint(cyDir.x, cyDir.y, cyDir.z, new THREE.Vector3()).multiplyScalar(0.74);
  const cytoMarker = tag(new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.13, 12, 40), physical("#fbbf24", { emissive: new THREE.Color("#f59e0b"), emissiveIntensity: 1.0 })), "cytosol");
  cytoMarker.position.copy(CYTO_SPOT);
  cytoMarker.userData.keepMaterial = true;
  cellGroup.add(cytoMarker);
  const cytoLbl = engine.label("🔍 Zoom into the cytosol (enzymes)", "dive");
  const diveLbl = engine.label("🔍 Zoom into the membrane", "dive");
  cytoLbl.style.display = diveLbl.style.display = "none";

  // ---------- lights: a warm key and a pink rim, on top of the engine's rig ----------
  const key = new THREE.DirectionalLight("#ffd9c4", 1.3); key.position.set(-30, 40, 50);
  const rimL = new THREE.DirectionalLight("#f0abfc", 1.0); rimL.position.set(40, 10, -40);
  root.add(key, rimL);

  // ---------- mitochondrial states and autophagy events ----------
  const autoph = [];                                          // active mitophagy events {m, l, t}
  let recT = 0;
  function reconcileMito() {
    let nH = 0, nD = 0, nDie = 0;
    for (const o of mito) { if (o.state === 1) nH++; else if (o.state === 2) nD++; else if (o.state === 3) nDie++; }
    const tD = M.mitoDamaged < 0.35 ? 0 : Math.max(1, Math.round(M.mitoDamaged));
    const tT = Math.round(M.mitoHealthy + M.mitoDamaged);
    const pickOf = (st) => { const c = mito.filter((o) => o.state === st); return c.length ? c[Math.floor(Math.random() * c.length)] : null; };
    for (let g = 0; g < 4; g++) {
      if (nD < tD) { const o = pickOf(1) || pickOf(0); if (!o) break; o.state = 2; o.tgt = 1; nD++; nH = Math.max(0, nH - 1); setMitoColor(o); }
      else if (nD > tD) {
        const o = pickOf(2); if (!o) break;
        o.state = 3; o.dieT = 0; nD--; nDie++;
        let best = -1, bd = 1e9;
        lyso.forEach((l, li) => { if (l.busy < 0) { const d = l.base.distanceTo(o.base); if (d < bd) { bd = d; best = li; } } });
        o.lys = best;
        if (best >= 0) { lyso[best].busy = mito.indexOf(o); autoph.push({ m: o, l: lyso[best], t: 0 }); }
      }
    }
    const nTot = mito.filter((o) => o.state === 1 || o.state === 2).length;
    if (nTot < tT) { const o = pickOf(0); if (o) { o.state = 1; o.sc = 0; o.tgt = 1; setMitoColor(o); } }
    else if (nTot > tT + 0.5 && M.on.mitochondrion) { const o = pickOf(1); if (o) { o.state = 3; o.dieT = 0; o.lys = -1; } }
  }
  function setMitoColor(o) {
    const i = mito.indexOf(o), c = o.state === 2 ? colDamaged : colHealthy;
    mitoMesh.setColorAt(i, c); cristaeMesh.setColorAt(i, c);
    mitoMesh.instanceColor.needsUpdate = cristaeMesh.instanceColor.needsUpdate = true;
  }
  function initMitoStates() {
    autoph.length = 0;
    lyso.forEach((l) => { l.busy = -1; l.a = 0; });
    mito.forEach((o) => { o.state = 1; o.sc = 1; o.tgt = 1; o.dieT = -1; o.lys = -1; setMitoColor(o); });
    reconcileMito(); reconcileMito();
    mito.forEach((o) => { o.sc = o.state === 0 ? 0 : 1; });
  }

  // ---------- portals ----------
  const has = (id) => !!engine.levelsDef[id];
  const infoFor = (kind, obj) => {
    const key2 = kind === "pump" ? "membrane" : kind;
    const o = ORGANELLES[key2];
    if (!o) return null;
    const portal = obj ? portals.find((p) => p.object === obj || p.objects?.includes(obj)) : portals.find((p) => p.to === o.portal);
    return { kind: key2, title: lens.pick(o.name), portal: portal && has(portal.to) ? portal : null, anyPortal: portal, object: obj };
  };
  const fallback = (kind) => () => engine.select(infoFor(kind));
  let lastMito = 0;
  const mitoWorld = (i, out) => toWorld(mito[i].pos, out);
  portals.push({ to: "membrane", label: "Cell membrane", object: markerRing, objects: [markerRing, markerDisc], radius: 2.2, center: () => marker.getWorldPosition(new THREE.Vector3()) });
  portals.push({ to: "mitochondrion", label: "Mitochondrion", object: mitoMesh, radius: 1.4, center: () => mitoWorld(lastMito, new THREE.Vector3()), auto: false, fallback: fallback("mitochondrion") });
  mito.forEach((o, i) => { const v = new THREE.Vector3(); portals.push({ to: "mitochondrion", label: "Mitochondrion", object: new THREE.Object3D(), radius: 1.4, center: () => mitoWorld(i, v), auto: has("mitochondrion") && o.state === 1, fallback: fallback("mitochondrion") }); });
  portals.push({ to: "enzymes", label: "Cytosol", object: cytoMarker, radius: 1.6, center: () => cytoMarker.getWorldPosition(new THREE.Vector3()), auto: has("enzymes"), fallback: fallback("cytosol") });
  portals.push({ to: "nucleus", label: "Nucleus", object: nucShell, radius: NUC_R, center: () => nucShell.getWorldPosition(new THREE.Vector3()), auto: has("nucleus"), fallback: fallback("nucleus") });

  // ---------- flows ----------
  const flowMeshes = {}, flowList = [];
  const FLOW_CAP = { glucose: 50, o2: 40, co2: 35, atp: 60, mrna: 25, albumin: 40, water: 45 };
  const flowGeo = {
    glucose: new THREE.TorusGeometry(0.32, 0.12, 6, 6),
    o2: new THREE.CapsuleGeometry(0.22, 0.3, 4, 10),
    co2: new THREE.CapsuleGeometry(0.2, 0.5, 4, 10),
    atp: new THREE.SphereGeometry(0.3, 14, 10),
    mrna: new THREE.CapsuleGeometry(0.12, 1.2, 4, 8),
    albumin: new THREE.SphereGeometry(0.5, 20, 14),
    water: new THREE.SphereGeometry(0.22, 12, 8),
  };
  for (const [k, f] of Object.entries(FLOWS)) {
    const mat = k === "albumin"
      ? glass(f.color, { rim: "#fbcfe8", minAlpha: 0.35, maxAlpha: 0.95, emissive: new THREE.Color(f.color), emissiveIntensity: 0.4 })
      : physical(f.color, { emissive: new THREE.Color(f.color), emissiveIntensity: k === "atp" ? 1.4 : 0.45 });
    const mesh = new THREE.InstancedMesh(flowGeo[k], mat, FLOW_CAP[k]);
    mesh.count = 0; mesh.frustumCulled = false;
    root.add(mesh);
    flowMeshes[k] = { kind: k, mesh, parts: [], pool: [], acc: 0 };
    flowList.push(flowMeshes[k]);
  }
  const flowOn = { energy: true, gases: true, protein: true, water: true };
  const rr = () => Math.random();
  const bloodPoint = (out) => out.set(SIN_X - 2.2 - rr() * 3.2, (rr() - 0.5) * 22, (rr() - 0.5) * 7);
  const rimAt = (th) => { const f = ((th / (Math.PI * 2)) % 1 + 1) % 1 * 128, i = Math.floor(f) % 128; return RIM[i] + (RIM[(i + 1) % 128] - RIM[i]) * (f - Math.floor(f)); };
  const rimProject = (out, k = 1) => { const th = Math.atan2(out.z, out.x), R = rimAt(th) * k * sCell; return out.set(Math.cos(th) * R, out.y, Math.sin(th) * R); };   // clay: membrane points land on the cut rim
  const siteWorld = (list0, count, out) => { const m = memSites[list0 + Math.floor(rr() * count)]; toWorld(m.p, out); return clay ? rimProject(out) : out; };
  const glutW = (out) => siteWorld(0, NGLUT, out);
  const pumpW = (out) => siteWorld(NGLUT, NPUMP, out);
  const pickMito = (out) => { let t = null; for (let k = 0; k < 8; k++) { const i = Math.floor(rr() * N_MITO); if (mito[i].state === 1) { t = i; break; } } return mitoWorld(t === null ? Math.floor(rr() * N_MITO) : t, out); };
  const rosN = () => (M.glycogen < 1.5 ? 0 : Math.max(1, Math.round(NGLY * (0.08 + 0.92 * M.glycogen / 100))));   // visible rosettes (none when empty)
  const cytoPoint = (out) => siteWorld(0, NGLUT, out).multiplyScalar(0.55);                                       // a spot in the cytosol (glucose that is neither in glycogen nor in a mitochondrion)
  const glyW = (out) => { const n = rosN(); return n ? toWorld(glyc[Math.floor(rr() * n)].p, out) : cytoPoint(out); };
  const memAt = (dir, out, k = 1) => { surfacePoint(dir.x, dir.y, dir.z, out); out.multiplyScalar(k * sCell); return clay ? rimProject(out, 1) .multiplyScalar(k) : out; };
  const randDir = (out) => out.set(rr() - 0.5, rr() - 0.5, rr() - 0.5).normalize();

  // particles are pooled (no per-spawn allocation); a leg can chain into a second leg (glucose via GLUT2, albumin along a microtubule)
  const tRnd = new THREE.Vector3();
  function spawn(kind, from, to, speed = 5, chain = 0, dest = null, curve = null, t0 = 0, next = null) {
    const fm = flowMeshes[kind];
    if (fm.parts.length >= FLOW_CAP[kind]) return;
    const p = fm.pool.pop() || { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(), curve: null, next: null, t0: 0, t: 0, dur: 1, spin: 0, chain: 0 };
    p.a.copy(from); p.b.copy(to);
    const dist = curve ? curve.getLength() * sCell * (1 - t0) : p.a.distanceTo(p.b);
    p.c.lerpVectors(p.a, p.b, 0.5).add(tRnd.set(rr() - 0.5, rr() - 0.5, rr() - 0.5).multiplyScalar(dist * 0.3));
    if (dest) p.d.copy(dest);
    p.chain = chain; p.curve = curve; p.next = next; p.t0 = t0; p.t = 0; p.dur = Math.max(1.0, dist / speed); p.spin = rr() * 6;
    fm.parts.push(p);
  }
  const tx = new THREE.Vector3(), ty = new THREE.Vector3(), dst = new THREE.Vector3();
  // persistent handlers (no closures built per frame); each reads the model's current fluxes
  const want = (kind, rate, fn) => {
    const fm = flowMeshes[kind], group = FLOWS[kind].group;
    if (!flowOn[group] || !lens.atLeast(FLOWS[kind].band || "y7-8")) return;
    fm.acc += Math.max(0, rate) * dtNow;
    while (fm.acc >= 1) { fm.acc -= 1; fn(); }
  };
  let dtNow = 0;
  const hUptake = () => {          // blood → GLUT2 → glycogen (when storing) or a mitochondrion
    bloodPoint(tx); glutW(ty);
    if ((M.flux.synth || 0) > 0.03) glyW(dst); else pickMito(dst);
    spawn("glucose", tx, ty, 4.5, 1, dst);
  };
  const hRelease = () => {         // glycogen (when breaking down) or the cytosol pool → GLUT2 → blood
    if ((M.flux.breakdown || 0) > 0.03) glyW(tx); else cytoPoint(tx);
    glutW(ty); bloodPoint(dst);
    spawn("glucose", tx, ty, 4, 1, dst);
  };
  const hCytoMito = () => { if ((M.flux.breakdown || 0) > 0.03 && rr() < 0.5) glyW(tx); else cytoPoint(tx); pickMito(ty); spawn("glucose", tx, ty, 3.5); };
  const hToGly = () => { cytoPoint(tx); glyW(ty); spawn("glucose", tx, ty, 3); };
  const hFromGly = () => { glyW(tx); cytoPoint(ty); spawn("glucose", tx, ty, 3); };
  const hO2 = () => { bloodPoint(tx); pickMito(ty); spawn("o2", tx, ty, 5); };
  const hCO2 = () => { pickMito(tx); bloodPoint(ty); spawn("co2", tx, ty, 5); };
  const sinkW = [0, 0, 0, 0, 0];
  const sinkFn = [
    () => pumpW(ty),
    () => ty.copy(NUC).addScaledVector(randDir(tRnd), NUC_R * 0.6).multiplyScalar(sCell),
    () => ty.copy(NUC).addScaledVector(rerPatches[Math.floor(rr() * rerPatches.length)].dir, NUC_R + 1.4).multiplyScalar(sCell),
    () => toWorld(golgiStacks[Math.floor(rr() * 3)].pos, ty),
    () => glyW(ty),
  ];
  let atpFromMito = 0;
  const hATP = () => {
    let sum = 0; for (let i = 0; i < 5; i++) sum += sinkW[i];
    let x = rr() * (sum || 1), s = 0;
    while (s < 4 && x > sinkW[s]) x -= sinkW[s++];
    sinkFn[s]();
    dst.copy(ty);
    if (M.on.mitochondrion && rr() < atpFromMito) pickMito(tx); else tx.copy(dst).add(tRnd.set(rr() - 0.5, rr() - 0.5, rr() - 0.5).multiplyScalar(9));
    spawn("atp", tx, dst, 6);
  };
  const hMrna = () => {
    const p = rerPatches[Math.floor(rr() * rerPatches.length)];
    tx.copy(NUC).addScaledVector(p.dir, NUC_R).multiplyScalar(sCell);
    ty.copy(NUC).addScaledVector(p.dir, NUC_R + 1.5 + rr()).addScaledVector(randDir(tRnd), 0.6).multiplyScalar(sCell);
    spawn("mrna", tx, ty, 3);
  };
  const hErGolgi = () => {
    const p = rerPatches[Math.floor(rr() * rerPatches.length)];
    tx.copy(NUC).addScaledVector(p.dir, NUC_R + 2.4).multiplyScalar(sCell);
    toWorld(golgiStacks[Math.floor(rr() * 3)].pos, ty);
    spawn("albumin", tx, ty, 3);
  };
  const hExo = () => {       // Golgi → along a microtubule → exocytosis at the cell edge facing the blood
    let best = null, bs = -9;
    for (let k = 0; k < 10; k++) { const c = mtCurves[Math.floor(rr() * mtCurves.length)]; c.getPoint(1, tA); const sc = tA.x + rr() * 3; if (sc > bs) { bs = sc; best = c; } }
    toWorld(golgiStacks[Math.floor(rr() * 3)].trans, tx);
    best.getPoint(0.18, tA);
    spawn("albumin", tx, toWorld(tA, ty), 4, 2, null, null, 0, best);
  };
  let waterDir = 0;
  const hWater = () => {
    randDir(tB);
    if (waterDir > 0) { memAt(tB, tx, 1.14); memAt(tB, ty, 0.6); } else { memAt(tB, tx, 0.6); memAt(tB, ty, 1.14); }
    spawn("water", tx, ty, 5);
  };
  function emitFlows(dt) {
    const F = M.flux;
    dtNow = dt;
    const aer = (F.resp || 0) + (F.fuel || 0), up = F.uptake || 0;
    want("glucose", up * 7, hUptake);
    want("glucose", -up * 7, hRelease);
    want("glucose", (F.resp || 0) * 0.7, hCytoMito);
    want("glucose", (F.synth || 0) * 4, hToGly);
    want("glucose", (F.breakdown || 0) * 4, hFromGly);
    want("o2", aer * 1.1, hO2);
    want("co2", aer * 1.1, hCO2);
    const prod = aer * 4.2 + (F.ferment || 0);
    sinkW[0] = F.pump || 0; sinkW[1] = (F.transcribe || 0) * 0.8; sinkW[2] = (F.translate || 0) * 1.2; sinkW[3] = ((F.toGolgi || 0) + (F.secrete || 0)) * 0.5; sinkW[4] = (F.synth || 0) * 4;
    atpFromMito = (aer * 4.2) / (prod || 1);
    want("atp", Math.min(prod * 0.9, sinkW[0] + sinkW[1] + sinkW[2] + sinkW[3] + sinkW[4] || 1) * 1.3, hATP);
    want("mrna", (F.export || 0) * 2.0, hMrna);
    want("albumin", (F.toGolgi || 0) * 1.3, hErGolgi);
    want("albumin", (F.secrete || 0) * 1.5, hExo);
    const w = F.water || 0;
    waterDir = w;
    want("water", Math.abs(w) * 55, hWater);
  }
  const tEu = new THREE.Euler(), tP = new THREE.Vector3(), tD = new THREE.Vector3(), tEnd = new THREE.Vector3(), tDst = new THREE.Vector3();
  function drawFlows(dt) {
    for (let li = 0; li < flowList.length; li++) {
      const fm = flowList[li], k = fm.kind, arr = fm.parts;
      let n = 0;
      for (let i = 0; i < arr.length; i++) {
        const p = arr[i];
        p.t += dt / p.dur;
        if (p.t >= 1) {
          if (p.chain === 1) { tEnd.copy(p.b); tDst.copy(p.d); spawn(k, tEnd, tDst, 4.2); }
          else if (p.chain === 2 && p.next) { tEnd.copy(p.b); spawn("albumin", tEnd, tEnd, 3.6, 0, null, p.next, 0.18); }
          arr[i] = arr[arr.length - 1]; arr.pop(); i--;
          p.curve = null; p.next = null; fm.pool.push(p);
          continue;
        }
        const t = p.t, u = 1 - t;
        if (p.curve) p.curve.getPoint(p.t0 + (1 - p.t0) * t, tP).multiplyScalar(sCell);
        else tP.set(0, 0, 0).addScaledVector(p.a, u * u).addScaledVector(p.c, 2 * u * t).addScaledVector(p.b, t * t);
        if (clay) tP.y = (CUT + 0.7) * sCell + tP.y * 0.08;       // clay diorama: beads run just above the floor
        if (k === "mrna") tmpQ.setFromUnitVectors(UP, tD.copy(p.b).sub(p.a).normalize());
        else tmpQ.setFromEuler(tEu.set(p.spin + t * 3, p.spin * 0.7 + t * 2, 0));
        const s = Math.min(1, t * 6, (1 - t) * 6);
        fm.mesh.setMatrixAt(n++, tmpM.compose(tP, tmpQ, tmpS.set(s, s, s)));
      }
      fm.mesh.count = n;
      fm.mesh.instanceMatrix.needsUpdate = true;
    }
  }
  function clearFlows() { for (const fm of flowList) { while (fm.parts.length) fm.pool.push(fm.parts.pop()); fm.acc = 0; fm.mesh.count = 0; } }

  // ---------- per-frame motion ----------
  const colCache = { glutIn: new THREE.Color("#84cc16"), glutOut: new THREE.Color("#f59e0b"), glutOff: new THREE.Color("#7f1d1d") };
  let lastQ = "", actinOn = false;
  function applyQuality() {
    const q = engine.quality;
    lastQ = q;
    const nMt = q === "high" ? NMT : q === "medium" ? 30 : 0;
    mtMesh.geometry.setDrawRange(0, nMt * mtIndexPer);
    mtGroup.visible = nMt > 0;
    cyto.geometry.setDrawRange(0, q === "high" ? 2600 : q === "medium" ? 1400 : 600);
    freeRibo.geometry.setDrawRange(0, q === "high" ? 1300 : q === "medium" ? 600 : 0);
    actinOn = q === "high" && lens.atLeast("y9-10");
  }
  const dissolveMats = [];
  [[rerMat], [serGroup.children[0].material], [golgiMat], [mtMesh.material], [memMat]].forEach(([m]) => dissolveMats.push({ m, base: m.opacity }));
  function applyMorph() {
    const e = morph.e, org = Math.max(1e-3, morph.org * (1 - dissolve)), cy = Math.max(1e-3, morph.cyto);
    // membrane: plant box → blob, plant colours → animal colours
    memU.uBox.value = 1 - e;
    memMat.color.lerpColors(cPlantMem, cAnimMem, e);
    const gu = memMat.userData.glass;
    gu.rimColor.value.lerpColors(rPlantMem, rAnimMem, e);
    gu.minA.value = THREE.MathUtils.lerp(0.02, 0.03, e); gu.maxA.value = THREE.MathUtils.lerp(0.3, 0.36, e); gu.rimStrength.value = THREE.MathUtils.lerp(0.45, 0.6, e);
    nucleus.position.lerpVectors(PLANT_NUC, NUC, smooth(morph.k, 0, 0.85));
    for (const g of nucleus.children) if (g.userData.sat) { g.scale.setScalar(org * (1 + dissolve * 0.3)); g.visible = org > 0.002; }
    serGroup.scale.setScalar(org); serGroup.visible = org > 0.002;
    mtGroup.scale.setScalar(cy); actinGroup.scale.setScalar(cy);
    cyto.scale.setScalar(1 + dissolve * 0.8); freeRibo.scale.setScalar(1 + dissolve * 0.8);
    const fade = 1 - dissolve;
    cyto.material.opacity = 0.34 * morph.cyto * fade; freeRibo.material.opacity = 0.6 * morph.cyto * fade;
    for (const d of dissolveMats) { if (d.m === memMat) continue; d.m.opacity = d.base * fade; d.m.transparent = true; }
    ctxGroup.visible = cy > 0.01;
    for (const c of ctxMats) { c.m.opacity = c.base * cy; }
    outside.material.opacity = 0.3 * morph.cyto;
    marker.scale.setScalar(Math.max(1e-3, cy)); cytoMarker.scale.setScalar(Math.max(1e-3, cy));
    marker.visible = cytoMarker.visible = cy > 0.01 && dissolve < 0.2;
    key.intensity = 1.3 * morph.cyto; rimL.intensity = 1.0 * morph.cyto;
    clayKit.visible = clay && dissolve < 0.15;      // (the clay bowl does not stylise lysis: it simply goes when the cell bursts)
  }
  const tAx = new THREE.Vector3(), tSc = new THREE.Vector3();
  let t0Anim = 0;
  function animate(t, dt) {
    const still = engine.reducedMotion, org = Math.max(0, morph.org), cy = Math.max(0, morph.cyto), fade = 1 - dissolve;
    if (engine.quality !== lastQ) applyQuality();
    const vol = M.burst ? Math.max(M.vol, 1.2) : M.vol;
    sCell = (1 + (Math.cbrt(vol) - 1) * morph.e) * (1 + 0.12 * dissolve);   // volume scale blends to 1 at the plant-shaped end of the morph
    cellGroup.scale.setScalar(sCell);
    memU.uTime.value = still ? 0 : t;
    memU.uCren.value = M.crenation * morph.e * (1 - dissolve);
    memU.uBurst.value = burstT;
    actinGroup.visible = actinOn && cy > 0.01 && dissolve < 0.5;

    // mitochondria
    const aer = (M.flux.resp || 0) + (M.flux.fuel || 0);
    let anyMitoChange = false;
    for (let i = 0; i < N_MITO; i++) {
      const o = mito[i];
      const jit = still ? 0 : clay ? 0.25 : 1;
      o.pos.copy(o.base);
      o.pos.x += jit * (Math.sin(t * 0.9 + o.ph) * 0.1 + Math.sin(t * 0.31 + o.ph * 2.0) * 0.22);
      o.pos.y += jit * (Math.sin(t * 0.77 + o.ph * 1.3) * 0.1 + Math.cos(t * 0.27 + o.ph) * 0.2);
      o.pos.z += jit * (Math.cos(t * 0.83 + o.ph * 0.7) * 0.1 + Math.sin(t * 0.33 + o.ph * 3.0) * 0.2);
      if (o.state === 3) { // being digested: shrink while the lysosome sits against it
        o.dieT += dt;
        const lim = o.lys >= 0 ? 3.0 : 0.3;              // with a lysosome: wait for the shell and the fusion first
        o.sc = 1 - clamp((o.dieT - lim) / 1.9, 0, 1);
        if (o.dieT > lim + 2.1) { o.state = 0; o.sc = 0; o.dieT = -1; o.lys = -1; anyMitoChange = true; }
      } else if (o.state === 0) o.sc = 0;
      else o.sc += (1 - o.sc) * Math.min(1, dt * 1.2);
      const dmg = o.state === 2 ? 1 : 0;
      const sw = o.state === 3 ? 1.2 : 1 + 0.2 * dmg;
      const sx = o.L * (dmg ? 0.82 : 1) * sw * clayK.mito, sy = o.Rr * (dmg ? 1.28 : 1) * sw * clayK.mito;
      const k = Math.max(1e-3, o.sc * org * fade);
      tQ2.copy(o.q);
      if (!still) { tmpQ.setFromAxisAngle(clay ? UP : tAx.set(0.3, 1, 0.2).normalize(), Math.sin(t * 0.21 + o.ph) * (clay ? 0.2 : 0.35)); tQ2.multiply(tmpQ); }
      tAx.copy(o.pos);
      if (dissolve > 0) tAx.multiplyScalar(1 + dissolve * (0.5 + 0.8 * hash(i)));
      o.qn.copy(tQ2); o.sx = sx; o.sy = sy;
      tmpM.compose(tAx, tQ2, tSc.set(sx * k, sy * k, sy * k));
      mitoMesh.setMatrixAt(i, tmpM); cristaeMesh.setMatrixAt(i, tmpM);
    }
    mitoMesh.instanceMatrix.needsUpdate = cristaeMesh.instanceMatrix.needsUpdate = true;
    const glow = 0.2 + 0.8 * Math.min(1, aer / 1.8);
    mitoMat.emissive.set("#f97316").multiplyScalar(M.on.mitochondrion ? glow * 0.2 : 0);

    // lysosomes (some are visiting damaged mitochondria)
    for (const a of autoph) {
      a.t += dt;
      const ph = a.t / 5.6;
      a.shell = smooth(ph, 0, 0.2) * (1 - smooth(ph, 0.88, 1));                       // 1) a recycling bag wraps the mitochondrion
      a.l.a = ph < 0.3 ? 0 : ph < 0.5 ? smooth(ph, 0.3, 0.5) : ph < 0.85 ? 1 : 1 - smooth(ph, 0.85, 1);   // 2) a lysosome arrives and fuses
      if (a.t > 5.6) { a.l.a = 0; a.l.busy = -1; a.done = true; a.shell = 0; }        // 3) the contents are digested (the mitochondrion shrinks away)
    }
    let sn = 0;
    for (let i = 0; i < autoph.length && sn < SHELLS; i++) {
      const a = autoph[i], o = a.m, kk = Math.max(1e-3, a.shell * org * fade);
      tAx.copy(o.pos);
      tmpM.compose(tAx, o.qn, tSc.set((1.07 * o.sx + 0.4) * kk, (0.42 * o.sy + 0.32) * kk, (0.42 * o.sy + 0.32) * kk));
      shellMesh.setMatrixAt(sn++, tmpM);
    }
    shellMesh.count = sn; shellMesh.instanceMatrix.needsUpdate = true;
    for (let i = autoph.length - 1; i >= 0; i--) if (autoph[i].done) autoph.splice(i, 1);
    let gi = 0;
    for (let i = 0; i < NLY; i++) {
      const l = lyso[i];
      l.pos.copy(l.base);
      if (!still) { l.pos.x += Math.sin(t * 0.8 + l.ph) * 0.12; l.pos.y += Math.cos(t * 0.7 + l.ph * 1.5) * 0.12; l.pos.z += Math.sin(t * 0.6 + l.ph * 2.2) * 0.12; }
      if (l.a > 0 && l.busy >= 0) { tAx.copy(mito[l.busy].pos).sub(l.base); const reach = Math.max(0, tAx.length() - (l.r + 0.55)); l.pos.addScaledVector(tAx.normalize(), reach * l.a); }
      tAx.copy(l.pos); if (dissolve > 0) tAx.multiplyScalar(1 + dissolve * (0.5 + 0.8 * hash(i + 50)));
      const k = Math.max(1e-3, l.r * org * fade * (M.on.lysosome ? 1 : 0.8) * clayK.small);
      lyMesh.setMatrixAt(i, tmpM.compose(tAx, l.q, tSc.set(k, k, k)));
      lyCore.setMatrixAt(i, tmpM.compose(tAx, l.q, tSc.set(k, k, k)));
      for (const g of granLocal) { tB.copy(g).multiplyScalar(k).applyQuaternion(l.q).add(tAx); lyGran.setMatrixAt(gi++, tmpM.compose(tB, l.q, tSc.set(k * 0.8, k * 0.8, k * 0.8))); }
    }
    lyMesh.instanceMatrix.needsUpdate = lyCore.instanceMatrix.needsUpdate = lyGran.instanceMatrix.needsUpdate = true;
    lyMat.emissive.set("#ef4444").multiplyScalar(M.on.lysosome ? 0.12 + 0.25 * Math.min(1, (M.flux.mitophagy || 0) * 4) : 0);

    // peroxisomes
    for (let i = 0; i < NPX; i++) {
      const p = perox[i];
      tAx.copy(p.base); if (!still) { tAx.x += Math.sin(t * 0.7 + p.ph) * 0.1; tAx.y += Math.cos(t * 0.6 + p.ph) * 0.1; }
      if (dissolve > 0) tAx.multiplyScalar(1 + dissolve * (0.5 + 0.8 * hash(i + 80)));
      const k = Math.max(1e-3, p.r * org * fade * clayK.small);
      pxMesh.setMatrixAt(i, tmpM.compose(tAx, p.q, tSc.set(k, k, k)));
      pxCore.setMatrixAt(i, tmpM.compose(tAx, p.q, tSc.set(k * 0.4, k * 0.4, k * 0.4)));
    }
    pxMesh.instanceMatrix.needsUpdate = pxCore.instanceMatrix.needsUpdate = true;

    // glycogen rosettes: how many, and how big, follows the glycogen store
    const gl = M.glycogen / 100, nRos = rosN(), gs = (0.55 + 0.75 * gl) * org * fade * clayK.small;
    let gk = 0;
    for (let i = 0; i < nRos; i++) {
      const g = glyc[i];
      tAx.copy(g.p); if (!still) { tAx.x += Math.sin(t * 0.8 + g.ph) * 0.06; tAx.y += Math.cos(t * 0.7 + g.ph) * 0.06; }
      if (dissolve > 0) tAx.multiplyScalar(1 + dissolve * (0.5 + 0.8 * hash(i + 120)));
      for (let k = 0; k < 10; k++) {
        const s = Math.max(1e-3, gs * (k === 0 ? 1.5 : 1));
        tB.copy(g.parts[k]).multiplyScalar(gs).add(tAx);
        glyMesh.setMatrixAt(gk++, tmpM.compose(tB, tmpQ.identity(), tSc.set(s, s, s)));
      }
    }
    glyMesh.count = gk;
    glyMesh.instanceMatrix.needsUpdate = true;

    // Golgi vesicles
    for (let i = 0; i < gVesPos.length / 3; i++) {
      tAx.set(gVesPos[i * 3], gVesPos[i * 3 + 1], gVesPos[i * 3 + 2]);
      if (!still) { tAx.x += Math.sin(t * 0.9 + i) * 0.1; tAx.y += Math.cos(t * 0.8 + i * 1.7) * 0.1; }
      const k = Math.max(1e-3, (0.8 + 0.25 * Math.sin(i * 2.1)) * org * fade);
      gVes.setMatrixAt(i, tmpM.compose(tAx, tmpQ.identity(), tSc.set(k, k, k)));
    }
    for (let i = 0; i < gTinyPos.length / 3; i++) {
      tAx.set(gTinyPos[i * 3], gTinyPos[i * 3 + 1], gTinyPos[i * 3 + 2]);
      if (!still) { tAx.x += Math.sin(t * 1.1 + i * 1.3) * 0.08; tAx.z += Math.cos(t * 0.9 + i) * 0.08; }
      const k = Math.max(1e-3, org * fade);
      gTiny.setMatrixAt(i, tmpM.compose(tAx, tmpQ.identity(), tSc.set(k, k, k)));
    }
    gVes.instanceMatrix.needsUpdate = gTiny.instanceMatrix.needsUpdate = true;

    // membrane furniture: microvilli, GLUT2, pumps
    const mk = Math.max(1e-3, cy * fade);
    for (let i = 0; i < mvData.length; i++) {
      const m = mvData[i];
      tmpQ.setFromUnitVectors(UP, m.n);
      if (!still) { tmpE.set(Math.sin(t * 1.2 + m.ph) * 0.12, 0, Math.cos(t * 0.9 + m.ph) * 0.12); tmpQ.multiply(tQ2.setFromEuler(tmpE)); }
      tAx.copy(m.p).addScaledVector(m.n, 0.3 * m.len * mk);
      mvMesh.setMatrixAt(i, tmpM.compose(tAx, tmpQ, tSc.set(mk, m.len * mk, mk)));
    }
    mvMesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < NGLUT + NPUMP; i++) {
      const m = memSites[i];
      tmpQ.setFromUnitVectors(ZAX, m.n);
      tAx.copy(m.p).multiplyScalar(0.992);
      if (!still) tmpQ.multiply(tQ2.setFromAxisAngle(ZAX, t * 0.25 + i));
      const s = mk * (i < NGLUT ? 1 : 1);
      tmpM.compose(tAx, tmpQ, tSc.set(s, s, s));
      if (i < NGLUT) { glutMesh.setMatrixAt(i, tmpM); glutCore.setMatrixAt(i, tmpM); } else pumpMesh.setMatrixAt(i - NGLUT, tmpM);
    }
    glutMesh.instanceMatrix.needsUpdate = glutCore.instanceMatrix.needsUpdate = pumpMesh.instanceMatrix.needsUpdate = true;
    const up = M.flux.uptake || 0;
    glutMat.emissive.copy(!M.on.glut ? colCache.glutOff : up >= 0 ? colCache.glutIn : colCache.glutOut);
    glutMat.emissiveIntensity = M.on.glut ? 0.5 + Math.min(1, Math.abs(up) / 0.35) * 1.5 : 0.1;
    pumpMat.emissiveIntensity = M.on.pumps ? 0.3 + Math.min(1, (M.flux.pump || 0) / 2.4) * 0.9 : 0.05;
    pumpMat.color.set(M.on.pumps ? "#a78bfa" : "#7f1d1d");

    // blood: red cells drift along the vessel; plasma slides past
    for (let i = 0; i < NRBC; i++) {
      const c = rbc[i];
      const u = (c.u + (still ? 0 : t * 0.012 * c.sp)) % 1;
      sinAt(u, tAx); sinAt(u + 0.004, tB);
      tB.sub(tAx).normalize();
      tAx.x += c.ox; tAx.z += c.oz;
      tmpQ.setFromUnitVectors(UP, tB);
      tQ2.setFromEuler(tmpE.set(0, c.spin + (still ? 0 : t * 0.35 * c.sp), c.tilt + (still ? 0 : Math.sin(t * 0.5 + c.ph) * 0.2)));
      tmpQ.multiply(tQ2);
      tmpQ.multiply(tQ2.setFromAxisAngle(ZAX, Math.PI / 2));    // disc faces sideways: its plane contains the flow
      const s = Math.max(1e-3, cy);
      rbcMesh.setMatrixAt(i, tmpM.compose(tAx, tmpQ, tSc.set(s, s, s)));
    }
    rbcMesh.instanceMatrix.needsUpdate = true;
    plasma.position.y = still ? 0 : (t * 2.6) % 40;
    if (!still) { marker.children[0].rotation.z = t * 0.4; if (!clay) cytoMarker.rotation.y = t * 0.6; }
    markerRing.material.emissiveIntensity = 0.9 + Math.sin(t * 2.5) * 0.4;
    pores.material.emissiveIntensity = M.on.pores ? 0.3 : 0.0;
    pores.material.color.set(M.on.pores ? "#b8a6f5" : "#7f1d1d");
    const cg = centroGroup.userData.glow;
    cg.material.opacity = (0.4 + 0.15 * Math.sin(t * 1.7)) * org;
    if (!still) { cyto.rotation.y = Math.sin(t * 0.03) * 0.05; freeRibo.rotation.y = Math.sin(t * 0.025 + 1) * 0.05; }
    const mtMat = mtMesh.material;
    mtMat.opacity = 0.34 * cy * fade;
    glyMat.emissiveIntensity = 0.18 + 0.15 * Math.sin(t * 0.8);
  }

  // ---------- labels ----------
  const labels = {};
  const pickFront = (list, cond) => { let b = 0, bz = -1e9; list.forEach((o, i) => { const p = o.base || o.p; if (cond(p) && p.z > bz) { bz = p.z; b = i; } }); return b; };
  const lblMito = pickFront(mito, (p) => Math.abs(p.x) < 9 && p.z > 0 && p.y > -5 && p.distanceTo(NUC) > 8.5), lblLy = pickFront(lyso, (p) => Math.abs(p.x) < 11 && p.y > 0), lblGly = pickFront(glyc, (p) => p.x > -6 && p.y < 4);
  const labelTargets = {
    nucleus: (o) => o.copy(NUC).add(tmpV.set(0, NUC_R + 1.5, 0)),
    mitochondrion: (o) => o.copy(mito[lblMito].pos).add(tmpV.set(0, 1.5, 0.4)),
    er: (o) => o.copy(NUC).addScaledVector(rerPatches[0].dir, NUC_R + 2.2).add(tmpV.set(0, 0.6, 0)),
    golgi: (o) => o.copy(golgiStacks[0].pos).add(tmpV.set(0, 2.5, 0)),
    lysosome: (o) => o.copy(lyso[lblLy].pos).add(tmpV.set(0, 1.1, 0)),
    centrosome: (o) => o.copy(CENTRO).add(tmpV.set(0, -1.8, 0.5)),
    glycogen: (o) => o.copy(glyc[lblGly].p).add(tmpV.set(0, -1.0, 0)),
    sinusoid: (o) => o.set(SIN_X, 13, 6.5),
  };
  const labelKeys = Object.keys(labelTargets), tC2 = new THREE.Vector3(), tP2 = new THREE.Vector3();
  const statusKey = { nucleus: "nucleus", mitochondrion: "mitochondrion", er: "er", golgi: "golgi", lysosome: "lysosome", glycogen: "glycogen" };
  const NARROW = ["nucleus", "mitochondrion", "er", "sinusoid"];   // fewer labels on portrait phones
  let showLabels = lens.band === "y7-8" || lens.band === "y9-10";
  let stCache = M.status(), stT = 0;
  function makeLabels() {
    for (const el of Object.values(labels)) el.remove();
    for (const k of Object.keys(labelTargets)) labels[k] = engine.label("", "org");
  }
  function updateLabels(rdt) {
    if ((stT -= rdt) <= 0) { stT = 0.3; stCache = M.status(); }
    const hide = morph.k < 1 || M.burst || engine.current !== level, narrow = engine.camera.aspect < 0.9;
    tC2.set(0, 0, 0).project(engine.camera);
    for (let li = 0; li < labelKeys.length; li++) {
      const k = labelKeys[li], el = labels[k];
      if (!el) continue;
      if (!showLabels || hide || (narrow && !NARROW.includes(k))) { el.style.display = "none"; continue; }
      const name = lens.pick((k === "sinusoid" ? ORGANELLES.sinusoid : ORGANELLES[k]).name);
      const s = statusKey[k] ? stCache[statusKey[k]] : "";
      const html = `${name}${s ? `<small>${s}</small>` : ""}`;
      if (el._h !== html) { el.innerHTML = html; el._h = html; }
      el.classList.toggle("off", /off|stalled|stopped|starved|waiting|empty|blocked/.test(s));
      labelTargets[k](tLbl); tLbl.multiplyScalar(k === "sinusoid" ? 1 : sCell);
      // push each label outwards from the cell's centre on screen so they spread around it instead of piling up
      tP2.copy(tLbl).project(engine.camera);
      let dx = (tP2.x - tC2.x) * engine.w * 0.5, dy = -(tP2.y - tC2.y) * engine.h * 0.5;
      const len = Math.hypot(dx, dy);
      if (len < 10) { dx = Math.cos(li * 1.1); dy = Math.sin(li * 1.1); } else { dx /= len; dy /= len; }
      const push = 34 + 24 * (li % 3);
      engine.place(el, tLbl, dx * push, dy * push);
    }
    if (hide) { diveLbl.style.display = "none"; cytoLbl.style.display = "none"; return; }
    engine.place(diveLbl, tLbl.copy(MEM_SPOT).multiplyScalar(sCell).add(tmpV.set(0, -2.9, 0.8)));
    engine.place(cytoLbl, tLbl.copy(CYTO_SPOT).multiplyScalar(sCell).add(tmpV.set(0, 2.2, 0.5)));
  }

  // ---------- selection highlight ----------
  const selGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: "#5eead4", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
  selGlow.visible = false;
  root.add(selGlow);
  const GLOW_SIZE = { mitochondrion: 4.2, lysosome: 2.6, peroxisome: 2.0, glycogen: 2.2, glut: 2.0, pump: 2.0, microvilli: 2.4, rbc: 9, golgi: 6, centrosome: 4.5 };

  // ---------- panel ----------
  let progress = null;
  let panelEl, explainBody, resetRow, selCard, chips = {}, chart, chartCtx, mission, rows = {}, hasStyles = false;
  const ms = { highTime: 0, fastTime: 0, sec0: 0, burstSeen: false, crenSeen: false };
  const css = document.getElementById("animal-style") || Object.assign(document.head.appendChild(document.createElement("style")), { id: "animal-style" });
  css.textContent = `.cmp-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:7px;font-size:.82rem;color:var(--ink-dim)}
.cmp-list li{display:grid;grid-template-columns:20px 1fr;gap:6px;line-height:1.35}.cmp-list li i{font-style:normal;font-weight:700;text-align:center}
.cmp-list .gain i{color:var(--t-good)}.cmp-list .loss i{color:var(--t-bad)}.cmp-list .change i{color:var(--t-warn)}
.animal-reset{margin-top:10px}.tour-cap.burst{border-color:rgba(248,113,113,.6)}`;

  function resetCell() {
    M.reset();
    burstT = 0; dissolve = 0; ms.sec0 = 0; ms.highTime = ms.fastTime = 0;
    tour = null; showStep(); engine.select(null);
    clearFlows(); initMitoStates();
    progress = null; buildPanel(panelEl);
  }

  function buildPanel(el) {
    panelEl = el;
    el.innerHTML = "";
    const host = document.createElement("div");
    host.style.display = "contents";
    el.appendChild(host);
    progress = { band: lens.band, node: host };
    el = host;
    const sp = K.card(el, lens.pick({ "y7-8": "Plant or animal cell?", "y9-10": "Cell type" }));
    K.segmented(sp, [{ value: "cell", label: "🌱 Plant cell" }, { value: "animal", label: "🫀 Animal cell" }], "animal", (v) => { if (v !== "animal") engine.swapRoot(v); });
    sp.insertAdjacentHTML("beforeend", `<p class="hint" style="margin:8px 0 0">${lens.pick(NOTE)}</p>`);
    const ex = K.card(el, "What's happening", "explain");
    explainBody = document.createElement("div");
    ex.appendChild(explainBody);
    resetRow = K.buttonRow(ex);
    resetRow.classList.add("animal-reset");
    K.button(resetRow, "Reset cell", resetCell, { kind: "primary" });
    resetRow.style.display = "none";

    selCard = K.card(el, "Selected", "sel-card");
    selCard.style.display = "none";

    const env = K.card(el, "Conditions");
    const fluid = (v) => {
      const mo = lens.atLeast("y11") ? ` (${Math.round(300 * (1 + v / 100))} mOsm/L)` : "";
      return (v <= -95 ? "pure water" : v < -5 ? "dilute (hypotonic)" : v <= 5 ? "normal (isotonic)" : v < 95 ? "salty (hypertonic)" : "very salty") + mo;
    };
    const gluc = K.slider(env, { label: lens.pick({ "y7-8": "Sugar (glucose) in the blood", "y9-10": "Blood glucose" }), min: 2, max: 15, step: 0.5, value: M.bloodGlucose, format: (v) => `${v.toFixed(1)} mM`, onInput: (v) => (M.bloodGlucose = v) });
    const tonic = K.slider(env, { label: lens.pick({ "y7-8": "Water around the cell", "y9-10": "Fluid around the cell" }), min: -100, max: 100, step: 5, value: M.outside, format: fluid, onInput: (v) => (M.outside = v) });
    if (lens.atLeast("y9-10")) K.slider(env, { label: "Lysosome activity", min: 0, max: 100, step: 5, value: M.lysosome, unit: " %", onInput: (v) => (M.lysosome = v) });
    if (lens.atLeast("y11")) K.slider(env, { label: "Albumin gene activity", min: 0, max: 100, step: 5, value: M.secretionDemand, unit: " %", onInput: (v) => (M.secretionDemand = v) });
    const set = (sl, v) => { sl.value = v; sl.input.dispatchEvent(new Event("input")); };
    const r1 = K.buttonRow(env);
    K.button(r1, "🍽 After a meal", () => set(gluc, 10));
    K.button(r1, "Normal", () => set(gluc, 5));
    K.button(r1, "🌙 Fasting", () => set(gluc, 3));
    const r2 = K.buttonRow(env);
    K.button(r2, "💧 Pure water", () => set(tonic, -100));
    K.button(r2, "Normal fluid", () => set(tonic, 0));
    K.button(r2, "🧂 Salty", () => set(tonic, 100));
    const r3 = K.buttonRow(env);
    K.button(r3, "Reset cell", resetCell);

    const sw = K.card(el, lens.pick({ "y7-8": "Switch parts on and off", "y9-10": "Knock out a part" }));
    sw.insertAdjacentHTML("beforeend", `<p class="hint" style="margin:0 0 8px">${lens.pick({ "y7-8": "Turn something off and watch what else stops working.", "y9-10": "Turn a part off and follow the knock-on effects through the cell." })}</p>`);
    const list = document.createElement("div");
    list.className = "org-list";
    sw.appendChild(list);
    rows = {};
    const colors = { pores: "#ede9fe", pumps: "#a78bfa", glut: "#a3e635", lysosome: "#f87171" };
    for (const s of lens.filter(SWITCHES)) {
      const row = document.createElement("div");
      row.className = "org-row";
      const col = ORGANELLES[s.key]?.color || colors[s.key] || "#38bdf8";
      row.innerHTML = `<i style="background:${col}"></i><button type="button" class="org-name" title="Show me">${lens.pick(s.label)}<small></small></button><label class="switch"><input type="checkbox" ${M.on[s.key] ? "checked" : ""} aria-label="${lens.pick(s.label)} on"><span></span></label>`;
      const cb = row.querySelector("input");
      cb.addEventListener("change", () => {
        M.on[s.key] = cb.checked;
        engine.toast?.(`${lens.pick(s.label)} ${cb.checked ? "on" : "off"}`);
        if (engine.selected) showSelection(engine.selected);
      });
      row.querySelector(".org-name").addEventListener("click", () => { const kind = ORGANELLES[s.key] ? s.key : s.key === "pores" ? "nucleus" : s.key === "pumps" ? "membrane" : null; if (kind) focusOn(kind); });
      list.appendChild(row);
      rows[s.key] = row;
    }

    const cmp = K.card(el, "What changed from the plant cell");
    const items = lens.filter(COMPARE);
    const sym = { gain: "＋", loss: "−", change: "↔" };
    cmp.insertAdjacentHTML("beforeend", `<ul class="cmp-list">${items.map((c) => `<li class="${c.kind}"><i aria-hidden="true">${sym[c.kind]}</i><span>${c.text}</span></li>`).join("")}</ul>`);

    const fk = K.card(el, "What's moving");
    const key2 = document.createElement("div");
    key2.className = "flow-key";
    const groups = { energy: "Energy", gases: "Gases", protein: "Proteins", water: "Water" };
    for (const [k, f] of Object.entries(FLOWS)) {
      if (!lens.atLeast(f.band || "y7-8")) continue;
      key2.insertAdjacentHTML("beforeend", `<span><i style="background:${f.color};box-shadow:0 0 8px ${f.color}"></i>${lens.pick(f.label)}</span>`);
    }
    fk.appendChild(key2);
    const tg = document.createElement("div");
    tg.className = "flow-key";
    tg.style.marginTop = "8px";
    for (const [g, l] of Object.entries(groups)) {
      const lab = document.createElement("label");
      lab.innerHTML = `<input type="checkbox" ${flowOn[g] ? "checked" : ""}> Show ${l.toLowerCase()}`;
      lab.querySelector("input").addEventListener("change", (e) => (flowOn[g] = e.target.checked));
      tg.appendChild(lab);
    }
    fk.appendChild(tg);
    K.checkbox(fk, "Show organelle labels", showLabels, (v) => (showLabels = v));

    const ch = K.card(el, "Cell supplies over time");
    chart = document.createElement("canvas");
    chart.className = "mini-chart";
    chart.setAttribute("role", "img");
    ch.appendChild(chart);
    chartCtx = chart.getContext("2d");
    ch.insertAdjacentHTML("beforeend", `<div class="legend" style="margin-top:6px"><span><i style="background:#fbbf24"></i>${lens.pick({ "y7-8": "Energy (ATP)", "y9-10": "ATP" })}</span><span><i style="background:#f9a8d4"></i>Glycogen</span><span><i style="background:#a3e635"></i>Glucose in cell</span><span><i style="background:#38bdf8"></i>Volume</span></div>`);

    const tours = K.card(el, "Guided tours");
    const tr = K.buttonRow(tours);
    K.button(tr, "Follow the glucose", () => startTour("glucose"));
    K.button(tr, "Follow a secreted protein", () => startTour("protein"));
    K.button(tr, "Recycling worn-out parts", () => startTour("recycle"));
    const dv = K.card(el, lens.pick({ "y7-8": "Make new cells", "y9-10": "Cell division" }));
    dv.insertAdjacentHTML("beforeend", `<p class="hint" style="margin:0 0 8px">${lens.pick({ "y7-8": "Watch this cell copy its DNA and split into two identical cells.", y11: "Follow this cell through the cell cycle: DNA replication, mitosis and cytokinesis (cleavage furrow). Or see how meiosis makes gametes." })}</p>`);
    const dr = K.buttonRow(dv);
    const divePortal = (to, label) => ({ to, label, radius: NUC_R, center: () => nucShell.getWorldPosition(new THREE.Vector3()), object: nucShell });
    K.button(dr, lens.pick({ "y7-8": "Watch it divide ▸", "y9-10": "Mitosis ▸" }), () => engine.dive(divePortal("mitosis", "Cell division")), { kind: "primary" });
    K.button(dr, "Meiosis ▸", () => engine.dive(divePortal("meiosis", "Meiosis")));
    const spc = K.card(el, lens.pick({ "y7-8": "Cells with special jobs", "y9-10": "Specialised cells" }));
    spc.insertAdjacentHTML("beforeend", `<p class="hint" style="margin:0 0 8px">${lens.pick({ "y7-8": "Red blood cells, nerve cells, root hair cells and more: see how each cell's shape fits its job, and how cells build tissues and organs.", "y9-10": "Explore how structure fits function in specialised plant and animal cells, and how cells form tissues, organs and systems.", y11: "Structure–function relationships in differentiated cells (SA:V, organelle content, shape), and the cell → tissue → organ → system hierarchy." })}</p>`);
    K.button(K.buttonRow(spc), lens.pick({ "y7-8": "Meet the specialists ▸", "y9-10": "Specialised cells ▸" }), () => engine.dive(divePortal("specialised", "Specialised cells")));

    ms.sec0 = M.secreted;
    mission = K.missions(el, lens.filter(MISSIONS).map((m) => ({ text: m.text, check: () => m.check(M, ms) })), (m) => engine.toast(`🎯 Mission complete: ${m.text.replace(/<[^>]+>/g, "")}`, 3400));
    K.quiz(el, lens.filter(QUIZ));
    buildChips();
    exT = 0; uiT = 0;
  }

  function buildChips() {
    const ov = engine.overlay;
    ov.innerHTML = "";
    chips = { glucose: K.chip(ov), glycogen: K.chip(ov), atp: K.chip(ov), vol: K.chip(ov), mito: K.chip(ov), alb: K.chip(ov), _y7: lens.band === "y7-8" };
  }
  function updateChips() {
    const d = (c) => `<i class="dot" style="background:${c}"></i>`, y7 = chips._y7;
    chips.glucose(`${d("#a3e635")}${y7 ? "Blood sugar" : "Blood glucose"} <b>${M.bloodGlucose.toFixed(1)} mM</b>`);
    chips.glycogen(`${d("#f9a8d4")}Glycogen <b>${M.glycogen.toFixed(0)}%</b>`);
    chips.atp(`${d("#fbbf24")}${y7 ? "Energy" : "ATP"} <b>${M.atp.toFixed(0)}</b>`);
    chips.vol(`${d("#38bdf8")}${y7 ? "Size" : "Volume"} <b>${M.burst ? "burst" : Math.round(M.vol * 100) + "%"}</b>`);
    chips.mito(`${d("#fb923c")}${y7 ? "Healthy mitochondria" : "Healthy mitochondria"} <b>${Math.round(M.mitoHealthy)}/${N_MITO}</b>`);
    chips.alb(`${d("#f472b6")}${y7 ? "Albumin delivered" : "Albumin secreted"} <b>${(M.secreted - ms.sec0).toFixed(0)}</b>`);
  }

  function drawChart() {
    const w = chart.clientWidth, h = chart.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    if (!w) return;
    if (chart.width !== Math.round(w * dpr)) { chart.width = Math.round(w * dpr); chart.height = Math.round(h * dpr); }
    const c = chartCtx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    c.strokeStyle = K.cssVar("--grid-line", "rgba(255,255,255,0.08)");
    for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(0, (h * i) / 4); c.lineTo(w, (h * i) / 4); c.stroke(); }
    chart.setAttribute("aria-label", `Cell supplies now: ATP ${M.atp.toFixed(0)}, glycogen ${M.glycogen.toFixed(0)}, cell glucose ${M.gi.toFixed(1)} millimolar, volume ${Math.round(M.vol * 100)} percent.`);
    const H = M.history;
    if (H.length < 2) return;
    const Y = (v) => h - (v / 100) * (h - 4) - 2;
    c.setLineDash([3, 4]); c.strokeStyle = "rgba(56,189,248,0.35)"; c.beginPath(); c.moveTo(0, Y(50)); c.lineTo(w, Y(50)); c.stroke(); c.setLineDash([]);
    for (const [k, col, sc] of [["vol", "#38bdf8", 50], ["gi", "#a3e635", 100 / 15], ["glycogen", "#f9a8d4", 1], ["atp", "#fbbf24", 1]]) {
      c.strokeStyle = col; c.lineWidth = 2; c.beginPath();
      H.forEach((p, i) => { const x = (i / 239) * w, y = Y(clamp(p[k] * sc, 0, 100)); i ? c.lineTo(x, y) : c.moveTo(x, y); });
      c.stroke();
    }
  }

  function updateExplain() {
    const paras = narrative(M, lens.band);
    const html = paras.map((p) => `<p>${p}</p>`).join("") +
      `<p class="hint">${lens.pick({ "y7-8": "Click any part to learn what it does. Drag to turn the cell; scroll to zoom in.", "y9-10": "Click a part for its inputs and outputs. Zoom in on the glowing ring to dive into the membrane." })}</p>`;
    if (explainBody.innerHTML !== html) explainBody.innerHTML = html;
    resetRow.style.display = M.burst ? "" : "none";
  }

  function showSelection(info) {
    if (!selCard) return;
    if (!info) { selCard.style.display = "none"; selGlow.visible = false; return; }
    const o = ORGANELLES[info.kind];
    if (!o) return;
    const st = M.status();
    const status = st[info.kind === "membrane" ? "membrane" : info.kind] || "";
    const zoom = info.portal ? `<button class="btn primary" data-act="zoom">Zoom in ▸</button>` : "";
    const sim = o.sim ? `<a class="btn" href="${engine.root}sims/${o.sim}/index.html">${info.portal ? "Open full simulation" : "Open the simulation"}</a>` : "";
    const sw = M.on[info.kind] !== undefined ? `<button class="btn" data-act="toggle">${M.on[info.kind] ? "Switch off" : "Switch on"}</button>` : "";
    selCard.style.display = "";
    selCard.innerHTML = `<h2>Selected</h2><p style="color:var(--ink);font-weight:600;margin-bottom:4px"><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${o.color};margin-right:6px"></i>${lens.pick(o.name)}</p>
      <p>${lens.pick(o.role)}</p>
      <div class="io"><b>In</b><span>${lens.pick(o.inputs)}</span><b>Out</b><span>${lens.pick(o.outputs)}</span><b>Feeds</b><span>${lens.pick(o.feeds)}</span>${status ? `<b>Now</b><span>${status}</span>` : ""}</div>
      <div class="btn-row">${zoom}${sw}${sim}</div>
      ${o.note ? `<p class="hint">${lens.pick(o.note)}</p>` : ""}
      ${!info.portal && info.anyPortal ? `<p class="hint">A 3D zoom into the ${lens.pick(o.name).toLowerCase()} is coming in the next phase.</p>` : ""}`;
    selCard.querySelector('[data-act="zoom"]')?.addEventListener("click", () => engine.dive(info.portal));
    selCard.querySelector('[data-act="toggle"]')?.addEventListener("click", () => {
      M.on[info.kind] = !M.on[info.kind];
      const cb = rows[info.kind]?.querySelector("input"); if (cb) cb.checked = M.on[info.kind];
      showSelection(info);
    });
    const big = info.object && !info.object.isInstancedMesh && !GLOW_SIZE[info.kind];
    selGlow.visible = !!info.object;
    if (info.object) {
      if (info.object.isInstancedMesh || info.object.userData.kind === "golgi" || info.kind === "centrosome") {
        if (info.point) selGlow.position.copy(info.point); else info.object.getWorldPosition(selGlow.position);
        selGlow.scale.setScalar((GLOW_SIZE[info.kind] || 3) * sCell);
      } else {
        const bs = new THREE.Box3().setFromObject(info.object).getSize(tmpV);
        info.object.getWorldPosition(selGlow.position);
        if (info.kind === "er" || info.kind === "ser" || info.kind === "microtubule" || info.kind === "sinusoid" || info.kind === "membrane") { if (info.point) selGlow.position.copy(info.point); selGlow.scale.setScalar(info.kind === "sinusoid" ? 14 : info.kind === "membrane" ? 5 : 8); }
        else selGlow.scale.setScalar(Math.max(bs.x, bs.y, bs.z) * 2.2);
      }
      if (big) selGlow.material.opacity = 0.5;
    }
    if (panelEl) panelEl.parentElement.scrollTo?.({ top: 0, behavior: "smooth" });
  }

  // where "Show me" and the tours fly to
  function damagedIndex() { const i = mito.findIndex((o) => o.state === 2); return i; }
  function focusSpec(kind) {
    const w = new THREE.Vector3();
    switch (kind) {
      case "nucleus": return { obj: nucShell, p: nucShell.getWorldPosition(w), d: 28 };
      case "mitochondrion": { let i = lastMito; if (mito[i].state === 0) i = 0; const front = mito.map((o, j) => [j, o.base.z - Math.abs(o.base.x) * 0.2 + (o.state === 1 ? 5 : 0)]).sort((a, b) => b[1] - a[1])[0][0]; lastMito = front; return { obj: mitoMesh, p: mitoWorld(front, w), d: 11 }; }
      case "damaged": { const i = damagedIndex(); lastMito = i >= 0 ? i : lastMito; return { obj: mitoMesh, p: mitoWorld(lastMito, w), d: 9, kind: "mitochondrion" }; }
      case "er": return { obj: rer, p: w.copy(NUC).addScaledVector(rerPatches[0].dir, NUC_R + 1.6).multiplyScalar(sCell), d: 17 };
      case "ser": return { obj: serGroup.children[0], p: toWorld(serNodes[Math.floor(serNodes.length / 3)], w), d: 14 };
      case "golgi": return { obj: golgiStacks[0].mesh, p: toWorld(golgiStacks[0].pos, w), d: 12 };
      case "lysosome": { toWorld(lyso[lblLy].pos, w); return { obj: lyMesh, p: w, d: 9 }; }
      case "lysoNear": { const i = autoph.length ? lyso.indexOf(autoph[0].l) : lblLy; return { obj: lyMesh, p: toWorld(lyso[i].pos, w), d: 8, kind: "lysosome" }; }
      case "centrosome": return { obj: centroGroup.children.find((c) => c.userData.kind === "centrosome"), p: toWorld(CENTRO, w), d: 9 };
      case "microtubule": { mtCurves[3].getPoint(0.5, w).multiplyScalar(sCell); return { obj: mtMesh, p: w, d: 22 }; }
      case "peroxisome": return { obj: pxMesh, p: toWorld(perox[0].pos, w), d: 8 };
      case "glycogen": return { obj: glyMesh, p: toWorld(glyc[lblGly].p, w), d: 9 };
      case "glut": { const m = memSites.slice(0, NGLUT).sort((a, b) => b.p.z + b.p.x - (a.p.z + a.p.x))[0]; return { obj: glutMesh, p: toWorld(m.p, w), d: 11 }; }
      case "membrane": return { obj: markerRing, p: marker.getWorldPosition(w), d: 16 };
      case "sinusoid": return { obj: sinusoid, p: w.set(SIN_X, 4, 3), d: 38 };
      case "rbc": return { obj: rbcMesh, p: w.set(SIN_X, 0, 0), d: 26 };
      case "microvilli": return { obj: mvMesh, p: toWorld(mvData[Math.floor(mvData.length / 2)].p, w), d: 11 };
      case "cytosol": return { obj: cytoMarker, p: cytoMarker.getWorldPosition(w), d: 14 };
      default: return null;
    }
  }
  function focusOn(kind) {
    if (engine.busy) return;
    const f = focusSpec(kind);
    if (!f) return;
    const dir = engine.camera.position.clone().sub(engine.controls.target).normalize();
    const p = f.p.clone();
    engine.fly(p, p.clone().addScaledVector(dir, f.d), 0.9);
    const info = infoFor(f.kind || kind, f.obj);
    if (info) engine.select({ ...info, point: p });
  }

  // ---------- tours ----------
  const TOURS = {
    glucose: [
      { kind: "sinusoid", text: { "y7-8": "<b>1. The blood.</b> Blood flowing past the liver cell carries <b>glucose</b> (sugar) from the food we eat, and oxygen on red blood cells.", y11: "<b>1. Sinusoid.</b> Blood glucose (about 5 mM when fasting) bathes the hepatocyte's sinusoidal face. Microvilli increase the membrane area for exchange." } },
      { kind: "glut", text: { "y7-8": "<b>2. Glucose doors.</b> Special doors in the membrane let glucose in. They work both ways, so glucose can also leave.", y11: "<b>2. GLUT2.</b> A passive, bidirectional uniporter with a high Km (about 17 mM), so net flux follows the blood-to-cell gradient. When blood glucose is high it enters; when low it leaves." } },
      { kind: "glycogen", text: { "y7-8": "<b>3. A sugar store.</b> After a meal the liver cell joins spare glucose into <b>glycogen</b> granules. When blood sugar drops it breaks them down and lets glucose out. Try the meal and fasting buttons!", y11: "<b>3. Glycogen.</b> Glycogenesis (costing ATP/UTP) when blood glucose is high; glycogenolysis when it is low. Insulin and glucagon are the real signals; here the blood glucose level is the switch." } },
      { kind: "mitochondrion", text: { "y7-8": "<b>4. Making energy.</b> Glucose and oxygen go to the mitochondria, which release their energy as <b>ATP</b> and give out carbon dioxide.", y11: "<b>4. Respiration.</b> Glycolysis in the cytosol, then the Krebs cycle and oxidative phosphorylation in the mitochondria: about 30 ATP per glucose. CO₂ leaves into the blood." } },
      { kind: "membrane", text: { "y7-8": "<b>5. Where the energy goes.</b> ATP (gold) powers the pumps in the membrane, the nucleus, the ribosomes and the Golgi.", y11: "<b>5. ATP sinks.</b> The Na⁺/K⁺-ATPase is a major cost (it holds the cell's volume steady), plus transcription, translation, vesicle traffic and glycogen synthesis." } },
    ],
    protein: [
      { kind: "nucleus", text: { "y7-8": "<b>1. Nucleus.</b> The gene for <b>albumin</b>, a protein the blood needs, is copied into <b>mRNA</b>.", y11: "<b>1. Transcription.</b> RNA polymerase copies the albumin gene; processed mRNA exits through nuclear pores. mRNA is reused many times." } },
      { kind: "er", text: { "y7-8": "<b>2. Rough ER.</b> The mRNA (blue) reaches the ribosomes on the folded sheets. They build the albumin protein.", y11: "<b>2. Translation.</b> Ribosomes on the rough ER translate the mRNA; the polypeptide enters the ER lumen and folds." } },
      { kind: "golgi", text: { "y7-8": "<b>3. Golgi apparatus.</b> The Golgi packs the albumin into vesicles (pink) and sends them on their way.", y11: "<b>3. Golgi.</b> Cargo is processed and sorted through the cisternae and packaged into secretory vesicles at the trans face." } },
      { kind: "microtubule", text: { "y7-8": "<b>4. Along the tracks.</b> Vesicles are carried along microtubules towards the cell edge, like trains on rails.", y11: "<b>4. Motor proteins.</b> Kinesin carries secretory vesicles on microtubules from the Golgi to the plasma membrane, using ATP." } },
      { kind: "membrane", text: { "y7-8": "<b>5. Delivery.</b> Vesicles fuse with the membrane and release albumin into the blood.", y11: "<b>5. Exocytosis.</b> Vesicles fuse with the plasma membrane on the sinusoidal side and release albumin. Hepatocytes do this <b>constitutively</b>: continuously, with no store waiting for a signal." } },
    ],
    recycle: [
      { kind: "damaged", text: { "y7-8": "<b>1. A worn-out mitochondrion.</b> The dull, swollen ones are damaged. They make little energy. (If you can't see one, switch the lysosomes off and wait.)", y11: "<b>1. Damaged mitochondrion.</b> Swollen, depolarised mitochondria make less ATP and more ROS, which damages healthy neighbours. (None visible? Switch off the lysosomes and wait.)" } },
      { kind: "lysoNear", text: { "y7-8": "<b>2. Wrapped for recycling.</b> A recycling bag (an autophagosome) wraps around the damaged mitochondrion. Then a <b>lysosome</b>, a bag of strong digestive chemicals, fuses with the bag and breaks everything down. This recycling is called <b>autophagy</b>.", y11: "<b>2. Mitophagy.</b> A double membrane (the autophagosome) forms around the damaged mitochondrion and then fuses with a lysosome. Acid hydrolases (pH about 5) digest the contents." } },
      { kind: "mitochondrion", text: { "y7-8": "<b>3. A fresh start.</b> The building blocks are reused, and healthy mitochondria divide to replace the lost one.", y11: "<b>3. Replacement.</b> Healthy mitochondria divide (fission) to restore the number. Without lysosomes, damaged ones accumulate, ROS rise and ATP falls." } },
    ],
  };
  let tour = null;
  const cap = document.createElement("div");
  cap.className = "tour-cap";
  engine.stageEl.appendChild(cap);
  const burstBar = document.createElement("div");
  burstBar.className = "tour-cap burst";
  burstBar.innerHTML = `<div>💥 <b>The cell has burst.</b> With no cell wall, water kept flowing in until the membrane tore. A plant cell would only have gone firm.</div><div class="row"><button class="btn primary" type="button">Reset cell</button></div>`;
  burstBar.querySelector("button").addEventListener("click", resetCell);
  engine.stageEl.appendChild(burstBar);
  function startTour(name) { if (engine.busy) return; tour = { steps: TOURS[name], i: 0 }; showStep(); }
  function showStep() {
    if (!tour) { cap.style.display = "none"; return; }
    const s = tour.steps[tour.i];
    focusOn(s.kind);
    cap.style.display = "block";
    cap.innerHTML = `<div>${lens.pick(s.text)}</div><div class="row"><button class="btn" data-a="x">Exit tour</button>${tour.i > 0 ? `<button class="btn" data-a="b">← Back</button>` : ""}<button class="btn primary" data-a="n">${tour.i < tour.steps.length - 1 ? "Next →" : "Finish"}</button></div>`;
    cap.querySelector('[data-a="x"]').onclick = () => { tour = null; showStep(); };
    cap.querySelector('[data-a="b"]')?.addEventListener("click", () => { tour.i--; showStep(); });
    cap.querySelector('[data-a="n"]').onclick = () => { if (tour.i < tour.steps.length - 1) { tour.i++; showStep(); } else { tour = null; showStep(); engine.fly(level.view.target, level.view.target.clone().addScaledVector(level.view.dir.clone().normalize(), level.view.distance), 1.2); } };
  }

  // ---------- morph ----------
  function setMorph(k) {
    morph.k = k;
    morph.e = smooth(k, 0, 1);
    morph.org = smooth(k, 0.06, 0.55);
    morph.cyto = smooth(k, 0.38, 0.85);
    applyMorph();
  }

  // ---------- clay style: a classroom model of the cell cut in half ----------
  // The glass membrane, cytoskeleton, membrane furniture, smooth-ER web and the blood context are hidden (userData.clayHide).
  // The lower half of the cell is rebuilt as a clay bowl whose cut edge shows the membrane as a thin two-tone rim around a
  // blue cytoplasm floor, and the organelles are re-laid out on that floor (positions only; the originals are saved and restored exactly).
  const clayKit = new THREE.Group();
  clayKit.visible = false;
  cellGroup.add(clayKit);
  let kitBuilt = false, saved = null, kitAo = null, halfMito = null, halfCrist = null;
  const cutR = (th, inset) => {                                  // radius of the cell outline at the cut, minus an inset
    let lo = 0, hi = 26;
    for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (insideCell(tmpV.set(Math.cos(th) * m, CUT, Math.sin(th) * m), inset)) lo = m; else hi = m; }
    return lo;
  };
  const outline = (inset, n = 128) => { const a = []; for (let i = 0; i < n; i++) { const th = (i / n) * Math.PI * 2, r = cutR(th, inset); a.push([Math.cos(th) * r, Math.sin(th) * r]); } return a; };
  function buildKit() {
    if (kitBuilt) return;
    kitBuilt = true;
    const ST = engine.style, mat = (c) => clayMaterial(ST, c);
    for (let i = 0; i < 128; i++) RIM[i] = cutR((i / 128) * Math.PI * 2, 0.9);
    const add = (geo, m, y = 0) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.y = y; mesh.castShadow = mesh.receiveShadow = true;
      mesh.userData.keepMaterial = true; mesh.userData.styled = "clay";
      clayKit.add(mesh);
      return mesh;
    };
    halfMito = clipGeometryBelow(mitoGeo, 0);      // mitochondria are shown cut open, cristae folds visible on the cut face
    halfCrist = clipGeometryBelow(cristaeGeo, 0);
    const bowl = add(clipGeometryBelow(membrane.geometry, CUT), mat("#7499e2"));
    const o0 = outline(0, 128), o1 = outline(0.65, 128), o2 = outline(1.1, 128);
    add(slabGeometry(o0, o1, 2.6), mat("#bba8ea"), CUT - 2.05);       // plasma membrane: outer lipid heads (lilac)
    add(slabGeometry(o1, o2, 2.5), mat("#f6c5a2"), CUT - 2.05);       // lipid tails (peach); a thin rim, not individual molecules
    add(slabGeometry(o2, null, 2.0), mat("#8db0ea"), CUT - 2.0);      // cytoplasm floor
    bowl.geometry.computeBoundingBox();
    // soft contact-shadow blobs under the organelles (a cheap stand-in for ambient occlusion)
    const aoMat = new THREE.MeshBasicMaterial({ map: ST.blobTexture, transparent: true, depthWrite: false, opacity: 0.55, fog: false });
    const ao = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), aoMat, 160);
    ao.frustumCulled = false; ao.renderOrder = -5; ao.count = 0;
    ao.userData.keepMaterial = true; ao.userData.styled = "clay";
    clayKit.add(ao);
    kitAo = ao;
  }
  function layoutClay() {
    saved ||= {
      nuc: NUC.clone(), plantNuc: PLANT_NUC.clone(), centro: CENTRO.clone(), mem: MEM_SPOT.clone(), cyt: CYTO_SPOT.clone(),
      mp: marker.position.clone(), mq: marker.quaternion.clone(),
      mito: mito.map((o) => ({ o, base: o.base.clone(), q: o.q.clone() })),
      lyso: lyso.map((o) => ({ o, base: o.base.clone() })),
      perox: perox.map((o) => ({ o, base: o.base.clone() })),
      glyc: glyc.map((o) => ({ o, p: o.p.clone() })),
      gol: golgiGroup.children.map((g, i) => ({ g, p: g.position.clone(), q: g.quaternion.clone(), pos: golgiStacks[i].pos.clone(), trans: golgiStacks[i].trans.clone() })),
    };
    NUC.set(-1.5, CUT - 1.3, -0.5);
    PLANT_NUC.set(-17, CUT - 1.2, 0);
    nucleus.position.copy(NUC);
    CENTRO.copy(NUC).addScaledVector(nucDirCentro, NUC_R + 1.05);
    // marker rings lie flat on the rim / floor
    const th = Math.atan2(11, 5), rr0 = cutR(th, 1.0);
    MEM_SPOT.set(Math.cos(th) * (rr0 - 0.2), CUT + 0.9, Math.sin(th) * (rr0 - 0.2));
    marker.position.copy(MEM_SPOT);
    marker.quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    CYTO_SPOT.set(-8.5, CUT + 1.4, 6.5);
    cytoMarker.position.copy(CYTO_SPOT); cytoMarker.rotation.set(-Math.PI / 2, 0, 0);
    // floor placement: random sequential packing that avoids the rim, the nucleus + its ER, and the Golgi
    const placed = [];
    const inside = (x, z, r) => insideCell(tmpV.set(x, CUT, z), r + 1.5);
    const free = (x, z, r, gap) => inside(x, z, r) && Math.hypot(x - NUC.x, z - NUC.z) > 7.4 + r * 0.6 && placed.every((q) => Math.hypot(q.x - x, q.z - z) > q.r + r + gap);
    const spot = (r, seed) => {
      for (let k = 0; k < 700; k++) {
        const gap = k < 250 ? 0.35 : k < 500 ? 0 : -0.5;
        const x = (hash(seed * 31 + k * 1.7) * 2 - 1) * 14, z = (hash(seed * 17 + k * 2.3 + 9) * 2 - 1) * 14;
        if (free(x, z, r, gap)) { placed.push({ x, z, r }); return { x, z }; }
      }
      const x = (hash(seed * 5) * 2 - 1) * 9, z = (hash(seed * 7 + 1) * 2 - 1) * 9;
      placed.push({ x, z, r }); return { x, z };
    };
    // Golgi stacks stand on the floor beside the centrosome (positions are relative to the nucleus)
    const golA = [0.55, 1.1, 1.65];
    golgiGroup.children.forEach((g, i) => {
      const a = golA[i], R = 9.6, rel = tmpV.set(Math.cos(a + 0.4) * R, CUT - NUC.y + 1.15, Math.sin(a + 0.4) * R);
      g.position.copy(rel);
      g.quaternion.setFromUnitVectors(ZAX, tA.set(-rel.x, 0, -rel.z).normalize());
      g.updateMatrix();
      const gs = golgiStacks[i];
      gs.pos.copy(g.position).add(NUC);
      gs.trans.set(0, 0, -6 * 0.24 - 0.4).applyMatrix4(g.matrix).add(NUC);
      placed.push({ x: gs.pos.x, z: gs.pos.z, r: 2.3 });
    });
    mito.forEach((o, i) => {
      const r = 0.62 * 1.07 * o.L * 1.15 + 0.45;
      const p = spot(r, 40 + i);
      o.base.set(p.x, CUT + 0.5, p.z);
      o.q.setFromAxisAngle(UP, hash(i * 7.7 + 3) * Math.PI * 2);
      o.pos.copy(o.base);
    });
    lyso.forEach((o, i) => { const p = spot(o.r * 1.5 + 0.2, 300 + i); o.base.set(p.x, CUT + o.r * 1.5 * 0.8, p.z); o.pos.copy(o.base); });
    perox.forEach((o, i) => { const p = spot(o.r * 1.5 + 0.2, 500 + i); o.base.set(p.x, CUT + o.r * 1.5 * 0.7, p.z); o.pos.copy(o.base); });
    glyc.forEach((o, i) => { const p = spot(0.75, 700 + i); o.p.set(p.x, CUT + 0.3, p.z); });
    if (kitAo) {
      const m = new THREE.Matrix4(), q0 = new THREE.Quaternion(), sc = new THREE.Vector3(), v3 = new THREE.Vector3();
      let n = 0;
      const blob = (x, z, d) => kitAo.setMatrixAt(n++, m.compose(v3.set(x, CUT + 0.05, z), q0, sc.set(d, 1, d)));
      for (const q of placed) if (n < 158) blob(q.x, q.z, q.r * 3.0);
      blob(NUC.x, NUC.z, 22);
      kitAo.count = n; kitAo.instanceMatrix.needsUpdate = true;
    }
    mitoMesh.geometry = halfMito; cristaeMesh.geometry = halfCrist;
    Object.assign(clayK, { mito: 1.15, small: 1.5 });
    clearFlows();
  }
  function restoreLayout() {
    if (!saved) return;
    NUC.copy(saved.nuc); PLANT_NUC.copy(saved.plantNuc); CENTRO.copy(saved.centro);
    nucleus.position.copy(NUC);
    MEM_SPOT.copy(saved.mem); marker.position.copy(saved.mp); marker.quaternion.copy(saved.mq);
    CYTO_SPOT.copy(saved.cyt); cytoMarker.position.copy(CYTO_SPOT); cytoMarker.rotation.set(0, 0, 0);
    for (const it of saved.mito) { it.o.base.copy(it.base); it.o.q.copy(it.q); it.o.pos.copy(it.base); }
    for (const it of saved.lyso) { it.o.base.copy(it.base); it.o.pos.copy(it.base); }
    for (const it of saved.perox) { it.o.base.copy(it.base); it.o.pos.copy(it.base); }
    for (const it of saved.glyc) it.o.p.copy(it.p);
    saved.gol.forEach((it, i) => { it.g.position.copy(it.p); it.g.quaternion.copy(it.q); golgiStacks[i].pos.copy(it.pos); golgiStacks[i].trans.copy(it.trans); });
    mitoMesh.geometry = mitoGeo; cristaeMesh.geometry = cristaeGeo;
    Object.assign(clayK, { mito: 1, small: 1 });
    clearFlows();
  }
  function setClay(on, user) {
    if (on === clay) return;
    clay = on;
    if (on) { buildKit(); layoutClay(); } else restoreLayout();
    clayKit.visible = on;
    memHandle.visible = !on;
    if (user && !engine.busy && engine.stack.length === 1 && !tour) {
      const v = level.view, d = v.dir.clone().normalize();
      engine.fly(v.target, v.target.clone().addScaledVector(d, v.distance), 0.9);
      engine.userMoved = false;
    }
  }

  // ---------- level object ----------
  let uiT = 0, exT = 0, chT = 0, pulse = 0;
  const level = {
    title: "Animal cell",
    species: "animal",
    model: M,      // read by child levels (mitosis reads atp; the mitochondria switch is shared)
    topics: ["cell-structure", "organelles", "respiration", "atp", "osmosis", "protein-synthesis", "membrane", "active-transport", "diffusion"],
    root, pickables, portals,
    fallbackPickables: [memHandle],
    metersPerUnit: 1e-6,
    get view() {
      const a = engine.camera.aspect, d = Math.min(150, Math.max(52, 23 / (0.344 * a)));
      return clay ? { target: new THREE.Vector3(0, CUT * 0.7, 1), distance: Math.min(150, Math.max(40, 60 / a)), dir: new THREE.Vector3(0.06, 0.58, 0.8) } : { target: new THREE.Vector3(a < 0.9 ? 1 : 3.5, 0, 0), distance: d, dir: new THREE.Vector3(0.12, 0.3, 1) };
    },
    clay: { groundY: -13.2, groundR: 26, shadow: 28, freq: 0.7 },
    clayEnv: { aperture: 0.0016 },
    onStyle(name, user) { setClay(name === "clay", user); },
    minDistance: 5, maxDistance: 150, near: 0.2, far: 1200,
    env: { bg: ["#1c0a22", "#3b1530", "#5c2140"], fog: ["#2a0e26", 0.0042], exposure: 1.1, bloom: [0.55, 0.62, 0.84], aperture: 0.0005 },
    info(obj) {
      const kind = obj.userData.kind;
      if (!kind) return null;
      if (kind === "peroxisome" && !lens.atLeast("y11")) return null;
      return infoFor(kind, obj);
    },
    onSelect(info) { showSelection(info); },
    onPointerDown(e, hit) { if (hit?.object === mitoMesh && hit.instanceId != null) lastMito = hit.instanceId; return false; },
    morphIn(k) { setMorph(k); },
    morphOut(k) { setMorph(1 - k); },
    mountPanel(el) {
      makeLabels();
      if (progress && progress.band === lens.band) { panelEl = el; el.appendChild(progress.node); buildChips(); }
      else buildPanel(el);
    },
    unmountPanel() {
      for (const el of Object.values(labels)) el.style.display = "none";
      diveLbl.style.display = "none"; cytoLbl.style.display = "none"; cap.style.display = "none"; burstBar.style.display = "none";
      engine.overlay.innerHTML = "";
    },
    onResume() { makeLabels(); },
    onLens() { showLabels = lens.band === "y7-8" || lens.band === "y9-10"; progress = null; applyQuality(); buildPanel(panelEl); },
    dispose() { for (const el of Object.values(labels)) el.remove(); diveLbl.remove(); cytoLbl.remove(); cap.remove(); burstBar.remove(); },
    update(dt, t, rdt = dt) {
      M.step(dt);
      // mission trackers
      if (M.bloodGlucose >= 9 && (M.flux.synth || 0) > 0.03) ms.highTime += dt; else ms.highTime = 0;
      if (M.bloodGlucose <= 3.5 && (M.flux.uptake || 0) < -0.1 && (M.flux.breakdown || 0) > 0.03) ms.fastTime += dt; else ms.fastTime = 0;
      if (M.burst) ms.burstSeen = true;
      if (M.vol < 0.7) ms.crenSeen = true;
      // lysis animation
      if (M.burst) burstT = engine.reducedMotion ? 1 : Math.min(1, burstT + (dt || 0) / 1.8); else burstT = Math.max(0, burstT - 1);
      dissolve = smooth(burstT, 0.25, 1);
      // mitochondrial bookkeeping
      if ((recT -= dt) <= 0) { recT = 0.3; if (!M.burst) reconcileMito(); }
      const live = morph.k >= 1 && !M.burst;
      if (live) emitFlows(dt);
      if (!live && morph.k < 1) clearFlows();
      applyMorph();
      animate(t, dt);
      drawFlows(dt);
      updateLabels(rdt);
      burstBar.style.display = M.burst && burstT > 0.55 ? "block" : "none";
      if (M.burst && burstBar._c !== M.burstCause) {
        burstBar._c = M.burstCause;
        burstBar.firstChild.innerHTML = M.burstCause === "ion"
          ? "💥 <b>The cell has burst.</b> Its pumps could not keep up with the ions leaking in (pumps off, or too little ATP), so water followed the salts in. With no cell wall, nothing held the cell back."
          : "💥 <b>The cell has burst.</b> The fluid around it was much more dilute, so water kept flowing in. With no cell wall, the membrane tore. A plant cell would only have gone firm.";
      }
      if (selGlow.visible) selGlow.material.opacity = 0.45 + 0.25 * Math.sin(t * 3);
      if ((uiT -= rdt) <= 0) {
        uiT = 0.25;
        if (chips.glucose) updateChips();
        const st = M.status();
        for (const k in rows) {
          const row = rows[k];
          const s = k === "pores" ? (M.burst ? st.nucleus : M.on.pores ? (M.mrna > 70 ? "mRNA piling up" : "letting mRNA out") : "blocked") : (st[k] || "");
          const sm = row.querySelector("small");
          if (sm && sm.textContent !== s) sm.textContent = s;
          row.classList.toggle("off", !M.on[k] || /stalled|stopped|starved|waiting|burst|blocked/.test(s));
        }
      }
      if (explainBody && (exT -= rdt) <= 0) { exT = 0.5; updateExplain(); }
      if (chart && (chT -= rdt) <= 0) { chT = 0.5; drawChart(); }
      mission?.update();
    },
  };

  // ---------- initial state ----------
  applyQuality();
  initMitoStates();
  setMorph(1);
  animate(0, 0);
  // ---------- microscope mode (microscope.js): what each part is, for the light and electron microscope views ----------
  // Parts not listed here (neighbouring-cell shells, flows, markers, membrane proteins, actin) are not drawn in microscope mode.
  const scopeKinds = new Map([[membrane, "membrane"], [riboMesh, "ribosomes"], [freeRibo, "ribosomes"], [cristaeMesh, "cristae"], [centroGroup, "centriole"], [lyCore, "lysosome"], [lyGran, "lysosome"], [pxCore, "peroxisome"], [nucleolus, "nucleolus"], [pores, "pores"]]);
  for (const ch of nucleus.children) if (!scopeKinds.has(ch) && ch !== nucShell && !ch.userData.sat) scopeKinds.set(ch, "chromatin");   // chromosome tubes and heterochromatin granules
  level.microscope = {
    kinds: scopeKinds,
    tissue: "animal", specimen: "cheek",
    cellUm: 28, pitch: [30, 30], depthUm: 30,
    home: new THREE.Vector3(0, 0, 0), temHome: new THREE.Vector3(-1, 1, 0),
    parts: ["nucleus", "nucleolus", "mitochondrion", "lysosome", "peroxisome", "er", "ribosomes", "golgi", "centriole", "microtubule", "cristae"],
  };
  return level;
}
