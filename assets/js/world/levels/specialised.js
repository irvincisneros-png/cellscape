// Level: the gallery of specialised cells. Units: 1 world unit = 1 µm, so everything on the shelf is at true relative scale
// (a red blood cell about 7.5 units across, a sperm about 55). Cells that are really long (a neuron's axon up to ~1 m, a muscle
// fibre, a root hair) are drawn truncated and say so. Each specialist has one structure-function demo driven by a small model
// (specialisedContent.js); the narrative card is generated from that model. A "zoom out" ladder shows cell, tissue, organ,
// organ system and organism for the cells with a source chain.
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import * as K from "../../kit.js";
import { physical, glass, specks, hash, wobble, softDot } from "../materials.js";
import { slabGeometry } from "../style.js";
import * as C from "./specialisedContent.js";

// ---------- small helpers ----------
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const col = (c) => new THREE.Color(c);
function mulberry32(a) { return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const FOV_T = Math.tan(THREE.MathUtils.degToRad(38 / 2));
const HIER_Y = -3000;                       // the zoom-out illustrations live far below the shelf

/** a mesh added to a parent */
function add(parent, geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; }
/** an instanced mesh with a fixed generous bounding sphere (instances move; nothing here is ray-picked) */
function inst(geo, mat, n, parent) {
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.frustumCulled = false;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  parent && parent.add(m);
  return m;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
function setI(m, i, x, y, z, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) {
  _p.set(x, y, z); _s.set(sx, sy, sz); _q.setFromEuler(_e.set(rx, ry, rz)); _m.compose(_p, _q, _s); m.setMatrixAt(i, _m);
}
const upd = (m) => { m.instanceMatrix.needsUpdate = true; };
/** a tube along `curve` whose radius is rFn(u), u = 0..1 (parallel frames; closed ends are tapered by rFn) */
function taperedTube(curve, rFn, tubular = 48, radial = 10) {
  const fr = curve.computeFrenetFrames(tubular, false);
  const pos = [], nor = [], idx = [], P = new THREE.Vector3(), N = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const u = i / tubular; curve.getPointAt(u, P);
    const r = rFn(u), nn = fr.normals[i], bb = fr.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * TAU, s = Math.sin(a), c = Math.cos(a);
      N.set(c * nn.x + s * bb.x, c * nn.y + s * bb.y, c * nn.z + s * bb.z);
      pos.push(P.x + r * N.x, P.y + r * N.y, P.z + r * N.z); nor.push(N.x, N.y, N.z);
    }
  }
  for (let i = 0; i < tubular; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = (i + 1) * (radial + 1) + j; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}
/** an organic ellipsoid: a sphere scaled and wobbled */
function blob(rx, ry, rz, amp = 0.05, seed = 0, detail = 4) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute("normal"); g.deleteAttribute("uv");
  g = mergeVertices(g);
  wobble(g, amp, 2.1, seed);
  g.scale(rx, ry, rz);
  g.computeVertexNormals();
  return g;
}
/** lathe about y from [radius, y] pairs */
const lathe = (pts, seg = 40) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 0), y)), seg);
/** capsule along x */
const capX = (r, len, seg = 8) => { const g = new THREE.CapsuleGeometry(r, len, 4, seg); g.rotateZ(Math.PI / 2); return g; };

// ---------- materials ----------
const gl = (color, rim, o = {}) => glass(color, { rim: rim || color, rimPower: 2.2, rimStrength: 0.55, minAlpha: 0.07, maxAlpha: 0.62, ...o });
const MAT = {};
function mats() {
  if (MAT.ready) return MAT;
  Object.assign(MAT, {
    ready: true,
    // membranes and walls (fresnel glass: nearly clear face-on, bright at the rim)
    memPink: gl("#f19ab8", "#ffd1e2", { maxAlpha: 0.55 }),
    memViolet: gl("#a58bf0", "#e1d4ff", { minAlpha: 0.09, maxAlpha: 0.6 }),
    memTeal: gl("#6bdcc9", "#d1fff5", { maxAlpha: 0.5 }),
    wallGreen: gl("#8fe0b0", "#ecfff2", { minAlpha: 0.06, maxAlpha: 0.5 }),
    wallCream: gl("#f3e7c2", "#fffbe8", { minAlpha: 0.06, maxAlpha: 0.5 }),
    vessel: gl("#7dc8f5", "#d6f1ff", { minAlpha: 0.04, maxAlpha: 0.5 }),
    fluid: gl("#69c3ff", "#bfe8ff", { minAlpha: 0.03, maxAlpha: 0.32 }),
    vacuole: gl("#8ec5ff", "#dff0ff", { minAlpha: 0.05, maxAlpha: 0.42 }),
    mucus: gl("#c8e88a", "#f4ffd0", { minAlpha: 0.1, maxAlpha: 0.55 }),
    // solid-ish parts
    nucleus: physical("#7a5fd0", { roughness: 0.38, emissive: col("#2a1a66"), emissiveIntensity: 0.35 }),
    nucleolus: physical("#4c3596", { roughness: 0.4 }),
    mito: physical("#f59e55", { roughness: 0.3, emissive: col("#c2410c"), emissiveIntensity: 0.28 }),
    chloro: physical("#37b24d", { roughness: 0.35, emissive: col("#1b6a2a"), emissiveIntensity: 0.3 }),
    hb: physical("#ffffff", { roughness: 0.3 }),
    bead: new THREE.MeshStandardMaterial({ color: "#ffd24d", emissive: col("#ff9d00"), emissiveIntensity: 1.2, roughness: 0.3 }),
    plinth: physical("#0a1c2a", { roughness: 0.8, clearcoat: 0, metalness: 0, sheen: 0, transparent: true, opacity: 0.3, depthWrite: false }),
    plinthRim: new THREE.MeshBasicMaterial({ color: "#5eead4", transparent: true, opacity: 0.28 }),
    memViolet2: gl("#a58bf0", "#e1d4ff", { minAlpha: 0.3, maxAlpha: 0.85 }),
    ink: new THREE.MeshBasicMaterial({ visible: false }),
  });
  return MAT;
}

// ---------- the shelf layout ----------
// local content half-widths (µm) so long cells never overlap their neighbours
const HALF_W = { rbc: 62, neuron: 255, muscle: 160, sperm: 72, cilia: 72, roothair: 240, palisade: 78, guard: 56, xylem: 84 };
const GAP = 46, KINGDOM_GAP = 150;
const ARC_R = 3400;

/** the pale pedestal disc and rim under each specimen */
function makePlinth(r, y) {
  const M = mats(), g = new THREE.Group();
  const disc = add(g, new THREE.CylinderGeometry(r, r * 1.04, 3, 72), M.plinth, 0, y - 1.5, 0);
  disc.userData.clayColor = "#d9cfe8";
  const ring = add(g, new THREE.TorusGeometry(r * 0.985, Math.max(0.2, r * 0.004), 6, 96), M.plinthRim, 0, y + 0.1, 0);
  ring.rotation.x = Math.PI / 2;
  ring.userData.clayHide = true;
  return g;
}
const hitBox = (w, h, d) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats().ink); return m; };

// =====================================================================================================================
// Specimen builders. Each returns { g, hit:[w,h,d], view:{x,y,z,w,h}, anchors, views, update(dt,t,active), chips(), controls(el), hold }
// g is a Group centred on the bay; the builder owns its own state object S (persisted between lens changes).
// =====================================================================================================================

// ---------- 1. Red blood cell ----------
const TUBE_W = 13;                                           // radius of the wide vessel either side of the capillary, µm
const tubeR = (x, a) => a + (TUBE_W - a) * clamp(smooth(x, 10, 34) + smooth(-x, 6, 26), 0, 1);

/** biconcave profile: shared with the content module so the drawn shape, its area and capillary passage agree */
const rbcShape = (s) => C.rbcShape(s);
const RBC_N = 36, RBC_SEG = 44, RBC_M = 2 * RBC_N + 1;
function rbcGeometry(s) {
  const { R, zeta } = rbcShape(s);
  const pts = [];
  for (let i = 0; i <= RBC_N; i++) { const rho = Math.sin((i / RBC_N) * Math.PI / 2); pts.push([R * rho, -R * zeta(rho)]); }
  for (let i = RBC_N - 1; i >= 0; i--) { const rho = Math.sin((i / RBC_N) * Math.PI / 2); pts.push([R * rho, R * zeta(rho)]); }
  const g = lathe(pts, RBC_SEG);
  g.userData.R = R; g.userData.zeta = zeta;
  g.userData.rest = new Float32Array(g.attributes.position.array);
  return g;
}
/** the cell folded into a capsule that just fills a tube of radius a (cylinder with hemispherical ends), same profile indexing */
const _cap = new Float32Array(RBC_M * 2);
function capsuleProfile(a) {
  a = Math.min(a, C.RBC.R_SPHERE);
  const Lc = Math.max(0, (C.RBC.V - (4 / 3) * Math.PI * a ** 3) / (Math.PI * a * a));
  const tot = Math.PI * a + Lc, q = (Math.PI * a) / 2;
  for (let j = 0; j < RBC_M; j++) {
    const s = (j / (RBC_M - 1)) * tot;
    let r, y;
    if (s <= q) { const th = s / a; r = a * Math.sin(th); y = -Lc / 2 - a * Math.cos(th); }
    else if (s <= q + Lc) { r = a; y = -Lc / 2 + (s - q); }
    else { const th = (s - q - Lc) / a; r = a * Math.cos(th); y = Lc / 2 + a * Math.sin(th); }
    _cap[j * 2] = r; _cap[j * 2 + 1] = y;
  }
  return _cap;
}

function buildRBC(X) {
  const { S, ms } = X, M = mats();
  const g = new THREE.Group(), world = new THREE.Group();
  g.add(world);
  Object.assign(S, { shape: 1, tube: 4, sat: 0.9, x: -20, mode: "idle", k: 0, align: 0, pop: 1, hold: 0, cycleT: 0, spin: 0, a0: 0 });
  g.add(makePlinth(58, -17));

  // the capillary: a glass tube whose bore narrows to S.tube (rebuilt when the slider moves)
  const vesselMat = M.vessel;
  let vessel = null;
  function buildVessel() {
    const a = S.tube / 2, pts = [];
    for (let x = -50; x <= 50; x += 1) pts.push([tubeR(x, a), x]);
    if (vessel) { world.remove(vessel); vessel.geometry.dispose(); }
    vessel = new THREE.Mesh(lathe(pts, 56), vesselMat);
    vessel.rotation.z = -Math.PI / 2;
    vessel.userData.clayColor = "#bcd9ee"; vessel.userData.clayOpacity = 0.14;
    world.add(vessel);
  }
  buildVessel();

  // plasma "crowding": fine proteins, and neighbouring red cells drifting in the wide parts
  const plasma = specks(150, 0.42, [100, 22, 22], ["#ffe9a8", "#ffd1a1", "#fff4d6"], 0.55);
  world.add(plasma);
  const biGeo = rbcGeometry(1);
  const crowdMat = glass("#cf3a48", { rim: "#ff9aa0", rimPower: 2, rimStrength: 0.6, minAlpha: 0.6, maxAlpha: 0.95 });
  crowdMat.userData.clayColor = "#f3a798";
  const NCR = 11, crowd = inst(biGeo, crowdMat, NCR, world);
  const crow = Array.from({ length: NCR }, (_, i) => ({ x: (i % 2 ? 1 : -1) * (30 + hash(i * 3.1) * 16), y: (hash(i * 7.7) - 0.5) * 11, z: (hash(i * 1.9) - 0.5) * 11, ph: hash(i) * 6.28, tilt: 0.4 + hash(i * 5.3) * 1.4 }));
  crow.forEach((c, i) => { c.x = i % 3 === 0 ? -(41 + hash(i) * 6) : 27 + hash(i * 2.7) * 20; });

  // the hero cell
  const heroMat = glass("#d23a46", { rim: "#ff8d93", rimPower: 2.0, rimStrength: 0.7, minAlpha: 0.66, maxAlpha: 0.98 });
  heroMat.userData.clayColor = "#f3a798";
  const hero = new THREE.Group(), tilt = new THREE.Group();
  hero.add(tilt);
  let body = null;
  const OXY = col("#e0212e"), DEOXY = col("#6b1d3f");
  // haemoglobin molecules (exaggerated in size) inside, and oxygen molecules streaming in
  const NHB = 64, hbMesh = inst(new THREE.IcosahedronGeometry(0.3, 2), M.hb, NHB, tilt);
  const hbPos = Array.from({ length: NHB }, (_, i) => ({ rho: Math.sqrt(hash(i * 2.1 + 1)) * 0.82, ph: hash(i * 5.7) * TAU, w: (hash(i * 9.3) - 0.5) * 2 }));
  const NO2 = 40, o2Mesh = inst(new THREE.IcosahedronGeometry(0.2, 1), new THREE.MeshBasicMaterial({ color: "#7df9ff" }), NO2, tilt);
  o2Mesh.userData.clayColor = "#92d3cf";
  const o2 = Array.from({ length: NO2 }, (_, i) => { const t = Math.acos(1 - 2 * hash(i * 3.3 + 2)), p = hash(i * 8.1) * TAU; return { d: V3(Math.sin(t) * Math.cos(p), Math.cos(t) * 0.55, Math.sin(t) * Math.sin(p)).normalize(), u: hash(i * 4.4), tgt: hbPos[i % NHB] }; });
  let hbSat = -1;
  function shapeBody() {
    const geo = rbcGeometry(S.shape);
    if (body) { tilt.remove(body); body.geometry.dispose(); }
    body = new THREE.Mesh(geo, heroMat);
    tilt.add(body);
    const { R, zeta } = geo.userData;
    for (let i = 0; i < NHB; i++) {
      const h = hbPos[i], r = R * h.rho;
      setI(hbMesh, i, Math.cos(h.ph) * r, h.w * R * zeta(h.rho) * 0.72, Math.sin(h.ph) * r, 1);
    }
    upd(hbMesh); hbSat = -1;
    hero.userData.R = R;
  }
  shapeBody();
  world.add(hero);
  const cur = { sx: 1 };

  const qFree = new THREE.Quaternion(), qAlign = new THREE.Quaternion(), qTmp = new THREE.Quaternion(), eul = new THREE.Euler();
  const lbl = { loading: true };

  function applyDeform(k, a) {
    const geo = body.geometry, P = geo.attributes.position, rest = geo.userData.rest;
    if (k < 0.002) { if (geo.userData.deformed) { P.array.set(rest); P.needsUpdate = true; geo.computeVertexNormals(); geo.userData.deformed = false; } return; }
    const cap = capsuleProfile(a);
    for (let i = 0; i <= RBC_SEG; i++) {
      const ph = (i / RBC_SEG) * TAU, sn = Math.sin(ph), cs = Math.cos(ph);
      for (let j = 0; j < RBC_M; j++) {
        const o = (i * RBC_M + j) * 3, r0 = Math.hypot(rest[o], rest[o + 2]);
        const r = lerp(r0, cap[j * 2], k), y = lerp(rest[o + 1], cap[j * 2 + 1], k);
        P.array[o] = r * sn; P.array[o + 1] = y; P.array[o + 2] = r * cs;
      }
    }
    P.needsUpdate = true; geo.computeVertexNormals(); geo.userData.deformed = true;
  }

  function startSqueeze() { if (S.mode === "go") return; if (S.mode !== "idle") resetCell(); S.mode = "go"; ms.rbcSqueezeShape = S.shape; ms.rbcSqueezeTube = S.tube; }
  function resetCell() { S.mode = "idle"; S.x = -20; S.k = 0; S.align = 0; S.pop = 0; S.hold = 0; }

  function update(dt, t, active) {
    const st = C.rbcState(S.shape, S.tube);
    // the oxygen cycle: lungs (high pO2) then working tissue (low pO2), slowed 50x
    if (S.mode === "idle") {
      S.cycleT = (S.cycleT + dt) % 8;
      lbl.loading = S.cycleT < 4;
      S.sat = C.rbcSaturation(S.sat, lbl.loading, dt, st);
    }
    ms.rbcSat = S.sat;
    if (S.shape <= 0.1) ms.rbcBall = true;
    if (ms.rbcBall && st.s > 0.97) ms.rbcBest = true;
    // squeeze
    const R = hero.userData.R;
    if (S.mode === "go") {
      const front = S.x + 2;
      const rF = tubeR(front, S.tube / 2);
      if (!st.canPass && rF < R * 0.98) { S.mode = "stuck"; ms.rbcJam = true; }
      else {
        const inNarrow = Math.abs(S.x) < 14;
        S.x += dt * (inNarrow ? 5.5 : 11);
        if (S.x > 36) { S.mode = "done"; S.hold = 1.4; if (st.canPass && S.tube <= 3.5 + 1e-6) ms.squeezed35 = true; if (st.canPass) ms.rbcPassed = true; }
      }
    } else if (S.mode === "done") { S.hold -= dt; if (S.hold <= 0) resetCell(); }
    S.pop = Math.min(1, S.pop + dt * 3);
    const rHere = tubeR(S.x, S.tube / 2);
    const inTube = S.mode !== "idle";
    const kT = !inTube ? 0 : S.mode === "stuck" ? clamp((R - rHere) / (R + 0.3), 0, 0.2) : clamp((R - rHere * 0.97) / Math.max(0.2, R - S.tube / 2 * 0.97), 0, 1);
    S.k += (kT - S.k) * clamp(dt * 7, 0, 1);
    applyDeform(S.k, Math.max(0.6, rHere * 0.965));
    // pose
    S.align += ((inTube && S.x > -17 ? 1 : 0) - S.align) * clamp(dt * 3, 0, 1);
    S.spin += dt * 0.5;
    eul.set(0.45 + 0.12 * Math.sin(t * 0.31), S.spin, 0.5 * Math.sin(t * 0.23)); qFree.setFromEuler(eul);
    qAlign.setFromEuler(eul.set(S.spin * 0.3, 0, -Math.PI / 2, "XYZ"));
    tilt.quaternion.copy(qFree).slerp(qAlign, smooth(S.align, 0, 1));
    hero.position.set(S.x, inTube ? 0 : Math.sin(t * 0.7) * 0.7, 0);
    hero.scale.setScalar(S.pop);
    // colour follows oxygen saturation
    heroMat.color.copy(DEOXY).lerp(OXY, clamp(S.sat, 0, 1));
    // haemoglobin dots: oxygenated ones bright red, the rest dusky
    const nOx = Math.round(S.sat * NHB);
    if (nOx !== hbSat) { hbSat = nOx; for (let i = 0; i < NHB; i++) hbMesh.setColorAt(i, i < nOx ? _c.set("#ff3b3b") : _c.set("#5a2a6e")); hbMesh.instanceColor.needsUpdate = true; }
    hbMesh.visible = S.k < 0.05;
    // oxygen streaming across the membrane (inward in the lungs, outward in the tissue)
    const flowOn = S.mode === "idle" && (lbl.loading ? S.sat < 0.985 : S.sat > 0.28);
    const frac = lbl.loading ? (1 - S.sat) * 1.5 : (S.sat - 0.25) * 1.5;
    for (let i = 0; i < NO2; i++) {
      const p = o2[i];
      const act = flowOn && i / NO2 < clamp(frac, 0, 1);
      if (act) p.u = (p.u + dt * 0.9) % 1;
      const e = lbl.loading ? p.u : 1 - p.u;
      const rr = lerp(R + 7.5, R * 0.45, e), sc = act ? 1 : 0;
      setI(o2Mesh, i, p.d.x * rr, p.d.y * rr, p.d.z * rr, sc);
    }
    upd(o2Mesh); o2Mesh.visible = S.k < 0.05;
    // the neighbours drift and turn; the plasma specks stream gently along the vessel
    for (let i = 0; i < NCR; i++) {
      const c = crow[i], ph = c.ph + t * 0.4;
      setI(crowd, i, c.x + Math.sin(ph) * 1.2, c.y + Math.cos(ph * 0.8) * 1.4, c.z, 1, 1, 1, c.tilt + Math.sin(ph * 0.5) * 0.3, ph * 0.6, 0.2);
    }
    upd(crowd);
    if (!X.engine.reducedMotion) plasma.position.x = ((t * 1.4) % 8) - 4;
  }

  function view() { return { x: -15, y: 0, z: 0, w: 30, h: 18 }; }
  const anchors = [
    { p: () => V3(S.x, 6.2, 0).add(hero.position.clone().setX(0)), t: { "y7-8": "Dimple: a thin disc", "y9-10": "Biconcave disc (high SA:V)", y11: "Biconcave disc: SA:V ≈ 1.5 µm⁻¹" }, show: () => S.mode === "idle" },
    { p: () => V3(S.x - 1, -5.6, 0), t: { "y7-8": "No nucleus (mature)", "y9-10": "No nucleus or mitochondria (mature)", y11: "No nucleus or mitochondria; ATP from glycolysis" }, show: () => S.mode === "idle" },
    { p: () => V3(S.x + 8, 3.5, 3), t: { "y7-8": "Haemoglobin", "y9-10": "Haemoglobin carries O₂" }, show: () => S.mode === "idle" && S.shape > 0.5 },
    { p: () => V3(2, TUBE_W * 0.0 + S.tube / 2 + 2.8, 0), t: { "y7-8": "Capillary", "y9-10": "Capillary", y11: "Capillary (narrowest part)" } },
  ];
  const views = [
    { label: "Close-up of the cell", x: -15, y: 0, z: 0, w: 30, h: 18 },
    { label: "Whole capillary", x: 4, y: 0, z: 0, w: 108, h: 34 },
    { label: "The narrow part", x: 1, y: 0, z: 0, w: 36, h: 14 },
  ];
  function chips() {
    const st = C.rbcState(S.shape, S.tube), y7 = X.lens.band === "y7-8";
    const out = [`<i class="dot" style="background:#ef4444"></i>${y7 ? "Surface for its size" : "SA:V"} <b>${st.sav.toFixed(2)} µm⁻¹</b>`, `<i class="dot" style="background:#7df9ff"></i>${y7 ? "Time to fill with oxygen" : "O₂ loading (95 %)"} <b>${Math.round(st.t95)} ms</b>`];
    if (!y7) out.push(`<i class="dot" style="background:#fbbf24"></i>Narrowest tube it fits <b>${st.minDiam.toFixed(1)} µm</b>`);
    out.push(`<i class="dot" style="background:#ff3b3b"></i>${y7 ? "Oxygen carried" : "O₂ saturation"} <b>${Math.round(100 * S.sat)} %</b>`);
    return out;
  }
  function controls(el) {
    const y7 = X.lens.band === "y7-8";
    K.slider(el, { label: y7 ? "Shape: ball ↔ real red cell" : "Shape: sphere → biconcave disc", min: 0, max: 100, value: Math.round(S.shape * 100), unit: " %", onInput: (v) => { S.shape = v / 100; if (S.mode !== "idle") resetCell(); shapeBody(); X.refresh(); } });
    K.slider(el, { label: "Capillary width", min: 25, max: 80, step: 1, value: Math.round(S.tube * 10), format: (v) => `${(v / 10).toFixed(1)} µm`, onInput: (v) => { S.tube = v / 10; if (S.mode !== "idle") resetCell(); buildVessel(); X.refresh(); } });
    const r = K.buttonRow(el);
    K.button(r, "Squeeze through ▸", () => { startSqueeze(); X.focusView(1); }, { kind: "primary" });
    K.button(r, "Reset", () => { resetCell(); });
    el.insertAdjacentHTML("beforeend", `<p class="hint">${y7 ? "Try a ball-shaped cell, then a real one. Which fits the narrow capillary?" : "Shape sets SA:V and the oxygen loading time. The capillary slider shows why the shape also matters for squeezing through. The oxygen cycle (lungs, then tissue) is slowed 50×."}</p>`);
  }
  const hit = [124, 40, 40];
  return { g, hit, view: view(), anchors, views, update, chips, controls, narr: () => ({ shape: S.shape, tube: S.tube }), focus: () => view(), live: true };
}

// ---------- 2. Motor neuron ----------
const NODES_A = [-168, -138, -108, -78, -48, -18, 12, 42];           // gaps between myelin segments (x, µm) before the break
const NODES_B = [97, 127, 157];                                       // after the break
const SEG_STARTS = [-166, -136, -106, -76, -46, -16, 14, 68, 98, 128];
const SEG_LEN = 28;
const AXON_END = 166;
function buildNeuron(X) {
  const { S, ms } = X, M = mats();
  const g = new THREE.Group();
  Object.assign(S, { myelin: true, d: 6, t: -1, repeat: false, delivered: 0, release: 0, gap: 0 });
  g.add(makePlinth(120, -34)); g.children[0].scale.set(2.1, 1, 0.5);
  const rng = mulberry32(77);
  // soma
  const soma = new THREE.Group(); soma.position.set(-190, 0, 0); g.add(soma);
  add(soma, blob(11, 10.5, 10, 0.045, 3), M.memViolet);
  add(soma, blob(6, 5.8, 5.6, 0.04, 8, 3), M.nucleus, 0.8, 0.5, 0);
  add(soma, new THREE.IcosahedronGeometry(1.9, 2), M.nucleolus, 1.4, 0.9, 1.2);
  const nissl = inst(new THREE.IcosahedronGeometry(0.9, 1), physical("#d6a3ff", { roughness: 0.5 }), 26, soma);
  nissl.userData.lod = true;           // decorative granules in the cell body
  for (let i = 0; i < 26; i++) { const a = rng() * TAU, b = Math.acos(2 * rng() - 1), r = 7.6 + rng() * 1.6; setI(nissl, i, Math.sin(b) * Math.cos(a) * r, Math.cos(b) * r * 0.9, Math.sin(b) * Math.sin(a) * r, 0.6 + rng() * 0.7); }
  upd(nissl);
  // dendrites: two levels of branching, tapering
  const den = [], mem = M.memViolet2;
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.62 + 0.76 * (i / 6)) + (rng() - 0.5) * 0.2, b = (rng() - 0.5) * 1.0;
    const dir = V3(Math.cos(a), Math.sin(a) * 0.9, Math.sin(b) * 0.7).normalize();
    const p0 = dir.clone().multiplyScalar(9.5), p1 = dir.clone().multiplyScalar(26 + rng() * 12).add(V3(0, (rng() - 0.5) * 8, (rng() - 0.5) * 8)), p2 = dir.clone().multiplyScalar(44 + rng() * 14).add(V3(0, (rng() - 0.5) * 18, (rng() - 0.5) * 14));
    const c = new THREE.CatmullRomCurve3([p0, p1, p2]);
    den.push(taperedTube(c, (u) => lerp(2.1, 0.7, u), 18, 8));
    for (let k = 0; k < 2; k++) {
      const q0 = c.getPointAt(0.55 + k * 0.12), d2 = p2.clone().sub(p1).normalize().add(V3(0, (k ? 1 : -1) * 0.6, (rng() - 0.5) * 0.8)).normalize();
      const c2 = new THREE.CatmullRomCurve3([q0, q0.clone().addScaledVector(d2, 12), q0.clone().addScaledVector(d2, 24).add(V3(0, (rng() - 0.5) * 8, (rng() - 0.5) * 8))]);
      den.push(taperedTube(c2, (u) => lerp(0.95, 0.3, u), 12, 6));
    }
  }
  add(soma, mergeGeometries(den), mem);
  // axon hillock + axon core (two pieces around the break)
  const coreMat = glass("#ffc9a1", { rim: "#fff1e0", rimPower: 1.6, rimStrength: 0.5, minAlpha: 0.55, maxAlpha: 0.95 });
  coreMat.userData.clayColor = "#f8c29d";
  const pulse = { x: { value: -999 }, w: { value: 7 }, k: { value: 0 }, org: { value: V3() }, ax: { value: V3(1, 0, 0) } };
  coreMat.onBeforeCompile = ((prev) => (sh) => {
    prev(sh); Object.assign(sh.uniforms, { uPx: pulse.x, uPw: pulse.w, uPk: pulse.k, uOrg: pulse.org, uAx: pulse.ax });
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying float vAx; uniform vec3 uOrg, uAx;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvAx = dot((modelMatrix * vec4(transformed, 1.0)).xyz - uOrg, uAx);");
    sh.fragmentShader = sh.fragmentShader.replace("void main() {", "varying float vAx; uniform float uPx, uPw, uPk;\nvoid main() {").replace("float fr = pow(", "float gp = exp(-pow((vAx - uPx) / uPw, 2.0)) * uPk;\n        outgoingLight += vec3(1.0, 0.72, 0.18) * gp * 1.6;\n        float fr = pow(");
  })(coreMat.onBeforeCompile);
  coreMat.customProgramCacheKey = () => "axonglow";
  const coreA = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 28, 1, true).rotateZ(Math.PI / 2), coreMat);
  const coreB = new THREE.Mesh(coreA.geometry, coreMat);
  const axon = new THREE.Group(); g.add(axon);
  function placeCore(m, x0, x1) { m.position.set((x0 + x1) / 2, 0, 0); m.scale.x = x1 - x0; axon.add(m); }
  placeCore(coreA, -181, 46); placeCore(coreB, 94, AXON_END);
  // myelin segments (Schwann cell wrapped): lens-shaped sausages with rounded ends
  const myProfile = []; for (let i = 0; i <= 24; i++) { const u = i / 24, e = Math.min(1, Math.min(u, 1 - u) * 14); myProfile.push([lerp(0.58, 1, Math.sin(e * Math.PI / 2)), (u - 0.5) * SEG_LEN]); }
  const myGeo = lathe(myProfile, 36).rotateZ(-Math.PI / 2);
  const myMat = glass("#fff1d6", { rim: "#ffffff", rimPower: 1.8, rimStrength: 0.7, minAlpha: 0.32, maxAlpha: 0.85 });
  myMat.userData.clayColor = "#f4e3b8";
  const sheath = new THREE.Group(); g.add(sheath);
  const segs = SEG_STARTS.map((s0) => { const m = new THREE.Mesh(myGeo, myMat); m.position.set(s0 + SEG_LEN / 2, 0, 0); sheath.add(m); return m; });
  // myelin layers hint: thin ridges
  const ridgeMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.18 });
  ridgeMat.userData.clayHide = true;
  // Na+ channels: concentrated at nodes when myelinated, spread along the axon when not
  const NCH = 132, chMesh = inst(new THREE.IcosahedronGeometry(0.55, 1), physical("#7c3aed", { roughness: 0.3, emissive: col("#4c1d95"), emissiveIntensity: 0.5 }), NCH, g);
  const chData = Array.from({ length: NCH }, (_, i) => ({ node: Math.floor(i / 12) % 11, ang: (i % 12) / 12 * TAU + hash(i) * 0.4, spread: -170 + (i / NCH) * 330 + hash(i * 3) * 4 }));
  const allNodes = [...NODES_A, ...NODES_B];
  let chK = -1, nodeFlash = new Float32Array(11);
  // the break marks and a label
  const breakMat = physical("#e5e7eb", { roughness: 0.4, transparent: true, opacity: 0.85 });
  for (const [x, flip] of [[46, 1], [64, -1]]) { const r = add(g, new THREE.TorusGeometry(1, 0.28, 6, 28), breakMat, x, 0, 0); r.rotation.y = Math.PI / 2 + flip * 0.5; r.scale.setScalar(5); r.userData.clayColor = "#e8e2dc"; }
  const dots = inst(new THREE.IcosahedronGeometry(0.55, 1), breakMat, 3, g);
  [51, 55, 59].forEach((x, i) => setI(dots, i, x, 0, 0, 1)); upd(dots);
  // terminals + boutons + vesicles + the muscle fibre it supplies (a motor neuron ends on muscle)
  const term = new THREE.Group(); term.position.set(AXON_END, 0, 0); g.add(term);
  const bout = [[18, 8, 2], [20, -9, -4], [27, 3, 9], [28, -2, -8], [14, -13, 4], [22, 14, -6]];
  bout.forEach(([x, y, z], i) => {
    const c = new THREE.CatmullRomCurve3([V3(0, 0, 0), V3(x * 0.45, y * 0.35, z * 0.35), V3(x, y, z)]);
    add(term, taperedTube(c, (u) => lerp(1.8, 0.8, u), 10, 6), mem);
    add(term, blob(3.1, 2.7, 2.7, 0.05, i, 3), mem, x, y, z);
  });
  const NV = 54, vesGeo = new THREE.IcosahedronGeometry(0.42, 1), vesMat = physical("#ffe08a", { roughness: 0.3, emissive: col("#d97706"), emissiveIntensity: 0.4 });
  const ves = inst(vesGeo, vesMat, NV, term);
  const vesD = Array.from({ length: NV }, (_, i) => { const b = bout[i % bout.length]; return { b, o: V3((hash(i * 2.2) - 0.5) * 3, (hash(i * 4.1) - 0.5) * 3, (hash(i * 6.3) - 0.5) * 3), u: hash(i) }; });
  const fibre = add(g, new THREE.CylinderGeometry(15, 15, 150, 40, 1, true).rotateZ(Math.PI / 2), glass("#ef6f6c", { rim: "#ffb4b0", minAlpha: 0.1, maxAlpha: 0.55 }), 244, -36, 0);
  fibre.userData.clayColor = "#f3a798";
  // acetylcholine released across the (exaggerated) gap
  const NA = 40, achMesh = inst(new THREE.IcosahedronGeometry(0.33, 1), new THREE.MeshBasicMaterial({ color: "#fde047" }), NA, term);
  achMesh.userData.clayColor = "#f4e3b8";
  const ach = Array.from({ length: NA }, (_, i) => ({ b: bout[i % bout.length], u: 1, v: V3((hash(i) - 0.5) * 0.6, -1, (hash(i * 3) - 0.5) * 0.6), sp: 0.7 + hash(i * 9) }));
  // glow sprites: the impulse, and a flash at each node
  const glowMat = new THREE.SpriteMaterial({ map: softDot(), color: "#ffb347", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.0 });
  const glow = new THREE.Sprite(glowMat); glow.scale.setScalar(26); g.add(glow);
  const bead = add(g, new THREE.SphereGeometry(1, 20, 14), M.bead, -190, 0, 0); bead.userData.clayColor = "#f6b44a";
  const nodeSp = allNodes.map((x) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: "#ffd07a", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); s.position.set(x, 0, 0); s.scale.setScalar(18); g.add(s); return s; });
  // cytoplasm specks in the soma + axon
  const sp = specks(70, 0.7, [30, 22, 22], ["#e9d5ff", "#c4b5fd"], 0.5); sp.position.copy(soma.position); g.add(sp);
  const track = [-179, ...allNodes.slice(0, 8), ...NODES_B, AXON_END - 1];
  function setRadii() {
    const st = C.neuronState(S.myelin, S.d), rc = S.d / 2, R = st.D / 2;
    coreA.scale.set(coreA.scale.x, rc, rc); coreB.scale.set(coreB.scale.x, rc, rc);
    for (const m of segs) { m.scale.set(1, R, R); m.visible = S.myelin; }
    // positions of the Na+ channels around the axon (nodes if myelinated, spread otherwise)
    chK = S.myelin ? 1 : 0;
  }
  setRadii();
  const chPos = (i, k, rc) => {
    const d = chData[i], nx = allNodes[d.node], x = lerp(d.spread, nx, k);
    const skipBreak = x > 47 && x < 93;
    return [skipBreak ? 1e5 : x, Math.cos(d.ang) * (rc + 0.35), Math.sin(d.ang) * (rc + 0.35)];
  };
  let chShown = -1, lastRc = -1;
  function send() { if (S.t < 0) { S.t = 0; S.release = 0; ms.nerveSent = (ms.nerveSent || 0) + 1; ms.nerveLastV = C.neuronState(S.myelin, S.d).v; if (S.myelin) ms.nerveMyelSent = true; else ms.nerveUnSent = true; if (ms.nerveLastV >= 60) ms.nerveFast = true; } }
  function posAt(u) {
    // u = 0..1 along the pulse path: smooth in an unmyelinated axon, hopping from node to node in a myelinated one
    const n = track.length - 1;
    if (!S.myelin) return lerp(track[0], track[n], u);
    const f = u * n, k = Math.min(n - 1, Math.floor(f)), fr = f - k;
    return lerp(track[k], track[k + 1], smooth(fr, 0.42, 1));
  }
  function update(dt, t, active) {
    g.updateWorldMatrix(true, false); pulse.org.value.setFromMatrixPosition(g.matrixWorld); pulse.ax.value.setFromMatrixColumn(g.matrixWorld, 0).normalize();
    const st = C.neuronState(S.myelin, S.d);
    if (S.repeat && S.t < 0 && !S.pause) send();
    const T = C.neuronScreenTime(st.v);
    if (S.t >= 0) {
      S.t += dt;
      const u = clamp(S.t / T, 0, 1);
      const x = posAt(u);
      const inBreak = x > 47 && x < 93;
      bead.position.set(x, 0, 0); bead.scale.setScalar(Math.max(1.4, S.d / 2 * 0.9)); bead.visible = !inBreak;
      glow.position.set(x, 0, 0); glow.material.opacity = inBreak ? 0 : 0.85; glow.scale.setScalar(S.myelin ? 20 : 16 + S.d * 1.6);
      pulse.x.value = x; pulse.k.value = S.myelin ? 0 : 1; pulse.w.value = 9 + S.d;
      if (S.myelin) for (let i = 0; i < allNodes.length; i++) if (Math.abs(x - allNodes[i]) < 4) nodeFlash[i] = 1;
      if (u >= 1) { S.t = -1; S.delivered++; S.release = 1; ms.nerveDelivered = (ms.nerveDelivered || 0) + 1; glow.material.opacity = 0; bead.visible = false; pulse.k.value = 0; pulse.x.value = -999; }
    } else { bead.visible = false; glow.material.opacity = 0; pulse.k.value = 0; }
    for (let i = 0; i < nodeSp.length; i++) { nodeFlash[i] = Math.max(0, nodeFlash[i] - dt * 2.2); nodeSp[i].material.opacity = nodeFlash[i] * 0.9; nodeSp[i].visible = S.myelin; }
    // transmitter release at the end of each impulse
    S.release = Math.max(0, S.release - dt * 0.7);
    for (let i = 0; i < NA; i++) {
      const a = ach[i];
      if (S.release > 0.2 && a.u >= 1 && hash(i + t) > 0.55) a.u = 0;
      if (a.u < 1) a.u = Math.min(1, a.u + dt * a.sp * 0.9);
      const b = a.b, k = a.u;
      setI(achMesh, i, b[0] + a.v.x * k * 8, b[1] - 2.5 - k * 17 + Math.sin(k * 9 + i) * 0.5, b[2] + a.v.z * k * 8, a.u >= 1 ? 0 : 1);
    }
    upd(achMesh);
    // vesicles jostle inside the boutons
    for (let i = 0; i < NV; i++) { const v = vesD[i]; setI(ves, i, v.b[0] + v.o.x + Math.sin(t * 1.3 + i) * 0.35, v.b[1] + v.o.y + Math.cos(t * 1.1 + i * 2) * 0.35, v.b[2] + v.o.z, 1); }
    upd(ves);
    // radii and channels follow the sliders / toggle
    const rc = S.d / 2;
    if (rc !== lastRc || chShown !== (S.myelin ? 1 : 0)) {
      lastRc = rc; chShown = S.myelin ? 1 : 0; setRadii();
      for (let i = 0; i < NCH; i++) { const p = chPos(i, chK, rc); setI(chMesh, i, p[0], p[1], p[2], 1); }
      upd(chMesh);
    }
    soma.rotation.y = Math.sin(t * 0.2) * 0.04;
  }
  function chips() {
    const st = C.neuronState(S.myelin, S.d), y7 = X.lens.band === "y7-8";
    return [`<i class="dot" style="background:#fbbf24"></i>${y7 ? "Impulse speed" : "Conduction speed"} <b>${st.v < 10 ? st.v.toFixed(1) : Math.round(st.v)} m/s</b>`,
      `<i class="dot" style="background:#a78bfa"></i>${y7 ? "Time to travel 1 m" : "Time over 1 m of axon"} <b>${st.tMetre < 0.1 ? Math.round(st.tMetre * 1000) + " ms" : st.tMetre.toFixed(2) + " s"}</b>`,
      `<i class="dot" style="background:#ffffff"></i>Myelin <b>${S.myelin ? "on" : "off"}</b>`];
  }
  function controls(el) {
    const y7 = X.lens.band === "y7-8";
    const r = K.buttonRow(el);
    K.button(r, "Send an impulse ▸", () => send(), { kind: "primary" });
    K.button(r, "Myelin on", (on) => { S.myelin = on; setRadii(); X.refresh(); }, { toggle: true, pressed: S.myelin });
    K.checkbox(el, "Keep firing", S.repeat, (v) => { S.repeat = v; });
    K.slider(el, { label: y7 ? "Axon thickness" : "Axon diameter", min: 5, max: 100, step: 1, value: Math.round(S.d * 10), format: (v) => `${(v / 10).toFixed(1)} µm`, onInput: (v) => { S.d = v / 10; X.refresh(); } });
    el.insertAdjacentHTML("beforeend", `<p class="hint">${y7 ? "Switch the myelin on and off and compare. The impulse is slowed down on screen; the readouts show the real speed." : "The animation is slowed (and the slowest cases sped up); the readouts give real speeds and times. Axon length is truncated (break marks) and node spacing is shown shorter than the real ~100 × the fibre width."}</p>`);
  }
  const hit = [520, 130, 70];
  const anchors = [
    { p: () => V3(-205, 14, 0), t: { "y7-8": "Dendrites (receive)", "y9-10": "Dendrites receive signals" } },
    { p: () => V3(-190, -14, 0), t: { "y7-8": "Cell body + nucleus", "y9-10": "Cell body (nucleus)" } },
    { p: () => V3(-30, S.d * 0.45 + 10, 0), t: { "y7-8": "Long axon", "y9-10": "Long axon" } },
    { p: () => V3(NODES_A[4], -(S.myelin ? S.d / 1.3 / 2 : S.d / 2) - 8, 0), t: { "y7-8": "Gap in the myelin", "y9-10": "Node of Ranvier", y11: "Node of Ranvier (Na⁺ channels)" } },
    { p: () => V3(-76 - 14, S.d / 1.3 / 2 + 6, 0), t: { "y7-8": "Myelin (insulation)", "y9-10": "Myelin sheath" }, show: () => S.myelin },
    { p: () => V3(55, 12, 0), t: { "y7-8": "Axon continues (up to 1 m)", "y9-10": "Truncated: the axon can reach ~1 m" } },
    { p: () => V3(200, 24, 0), t: { "y7-8": "Ends on a muscle cell", "y9-10": "Synaptic terminals" } },
  ];
  const views = [
    { label: "Cell body to first nodes", x: -128, y: 0, z: 0, w: 230, h: 66 },
    { label: "Whole neuron (shortened)", x: 0, y: -4, z: 0, w: 520, h: 120 },
    { label: "Cell body and dendrites", x: -205, y: 0, z: 0, w: 100, h: 56 },
    { label: "Nodes of Ranvier", x: -60, y: 0, z: 0, w: 80, h: 30 },
    { label: "Synaptic terminals", x: 205, y: -12, z: 0, w: 110, h: 60 },
  ];
  return { g, hit, view: views[0], anchors, views, update, chips, controls, narr: () => ({ myelin: S.myelin, d: S.d }), focus: () => views[0], live: true };
}

// ---------- 3. Skeletal muscle fibre ----------
/** myofibril material: A bands, I bands and Z lines striped in object space, so scaling the mesh in x shortens the sarcomeres */
function stripedMaterial(light = "#f4b6b6", dark = "#a8323a", U = { value: 2.6 }) {
  const m = new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3, sheen: 0.4, sheenColor: col("#ffd0d0") });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.cLight = { value: col(light) }; sh.uniforms.cDark = { value: col(dark) }; sh.uniforms.uSL = U;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying float vSx;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvSx = position.x;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vSx; uniform vec3 cLight, cDark; uniform float uSL;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        // phase is fixed along the (scaled) fibre; distances are in real micrometres from the current sarcomere length uSL:
        // the A band stays 1.6 um wide, while the I band and the H zone (thick filaments only) shrink
        float fz = fract(vSx / 2.6), dz = min(fz, 1.0 - fz) * uSL, dm = abs(fz - 0.5) * uSL;
        float hHalf = max(0.0, uSL * 0.5 - 1.0);
        float aBand = 1.0 - smoothstep(0.74, 0.86, dm), hZone = hHalf > 0.001 ? 1.0 - smoothstep(hHalf, hHalf + 0.1, dm) : 0.0, zLine = 1.0 - smoothstep(0.03, 0.11, dz);
        vec3 sc = mix(cLight, cDark, aBand * (0.78 - 0.32 * hZone));
        sc = mix(sc, cDark * 0.55, zLine * 0.9);
        diffuseColor.rgb = sc;`);
  };
  m.customProgramCacheKey = () => "striped";
  m.userData.clayColor = "#f3a798";
  return m;
}
/** a procedural cross-section of the fibre (myofibril dots, mitochondria, peripheral nuclei) for the cut ends */
function crossSectionTexture() {
  const cv = document.createElement("canvas"); cv.width = cv.height = 256;
  const c = cv.getContext("2d"), rng = mulberry32(5);
  const g = c.createRadialGradient(128, 128, 20, 128, 128, 128);
  g.addColorStop(0, "#d99a9d"); g.addColorStop(1, "#bd5c64");
  c.fillStyle = g; c.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 24; r++) for (let q = -24; q <= 24; q++) {
    const x = 128 + (q + (r % 2) * 0.5) * 10.4, y = 128 + (r - 11.5) * 9;
    if (Math.hypot(x - 128, y - 128) > 108) continue;
    c.fillStyle = "#8d2f3b"; c.beginPath(); c.arc(x, y, 4.1, 0, TAU); c.fill();
    c.fillStyle = "rgba(255,200,200,0.35)"; c.beginPath(); c.arc(x - 1, y - 1, 1.4, 0, TAU); c.fill();
  }
  c.fillStyle = "#f59e55";
  for (let i = 0; i < 46; i++) { const a = rng() * TAU, r = Math.sqrt(rng()) * 104; c.beginPath(); c.ellipse(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 3.3, 2.1, rng() * 3, 0, TAU); c.fill(); }
  c.fillStyle = "#6d4fc4";
  for (let i = 0; i < 4; i++) { const a = i * 1.7 + 0.6; c.beginPath(); c.ellipse(128 + Math.cos(a) * 118, 128 + Math.sin(a) * 118, 11, 5, a + Math.PI / 2, 0, TAU); c.fill(); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildMuscle(X) {
  const { S, ms } = X, M = mats();
  const model = (S.model ||= new C.MuscleModel());
  Object.assign(S, { strength: 1, holding: false, twitch: 0 });
  const g = new THREE.Group();
  g.add(makePlinth(150, -48)); g.children[0].scale.set(1.15, 1, 0.7);
  const fib = new THREE.Group(); g.add(fib);
  const HALF = 120, RAD = 24;
  // a slot cut through the front of the sarcolemma lets us look in at the myofibrils (clipped only where all three planes agree)
  // clipping planes are world-space: keep the local definitions and re-transform them by the fibre's world matrix every frame
  const planesLocal = [new THREE.Plane(new THREE.Vector3(0, 0, -1), 7), new THREE.Plane(new THREE.Vector3(0, 1, 0), -15), new THREE.Plane(new THREE.Vector3(0, -1, 0), -15)];
  const planes = planesLocal.map((p) => p.clone());
  const sarco = glass("#f27c7a", { rim: "#ffc0bd", rimPower: 2.0, rimStrength: 0.7, minAlpha: 0.12, maxAlpha: 0.6, clippingPlanes: planes, clipIntersection: true, side: THREE.DoubleSide });
  sarco.userData.clayColor = "#f3a798"; sarco.userData.clayOpacity = 0.4;
  const shell = add(fib, new THREE.CylinderGeometry(RAD, RAD, HALF * 2, 72, 1, true).rotateZ(Math.PI / 2), sarco);
  // cut ends show the cross-section; we look into the fibre through a clipped window
  const tex = crossSectionTexture();
  const capMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
  for (const s of [-1, 1]) { const c = add(fib, new THREE.CircleGeometry(RAD * 0.995, 56), capMat, s * HALF, 0, 0); c.rotation.y = s * Math.PI / 2; c.userData.clayColor = "#e7a3a6"; }
  // myofibrils: a hexagonal lattice of striped rods (z <= 6 so the clipped window sees them whole)
  const stripeU = { value: 2.6 };
  const rodMat = stripedMaterial("#f4b6b6", "#a8323a", stripeU);
  const rodGeo = new THREE.CylinderGeometry(2.05, 2.05, HALF * 2 - 2, 10, 1).rotateZ(Math.PI / 2);
  const sites = [];
  for (let r = -5; r <= 5; r++) for (let q = -5; q <= 5; q++) {
    const y = (q + (r % 2) * 0.5) * 4.75, z = r * 4.12;
    if (Math.hypot(y, z) < RAD - 3.3) sites.push([y, z]);
  }
  const rods = inst(rodGeo, rodMat, sites.length, fib);
  sites.forEach(([y, z], i) => setI(rods, i, 0, y, z, 1)); upd(rods);
  rods.userData.keepMaterial = true;
  // mitochondria packed between the myofibrils and just under the membrane
  const NM = 96, mitoGeo = new THREE.CapsuleGeometry(0.85, 2.6, 4, 10).rotateZ(Math.PI / 2);
  const mitoMesh = inst(mitoGeo, M.mito, NM, fib);
  const mpos = [], rng = mulberry32(31);
  for (let i = 0; i < NM; i++) {
    const a = sites[Math.floor(rng() * sites.length)], b = sites[Math.floor(rng() * sites.length)];
    let y = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2;
    if (i % 3 === 0) { const ang = rng() * TAU; y = Math.cos(ang) * (RAD - 1.3); z = Math.sin(ang) * (RAD - 1.3); }
    mpos.push([(rng() * 2 - 1) * (HALF - 6), y, z, (rng() - 0.5) * 0.6]);
  }
  const mitoDrawn = (n) => { for (let i = 0; i < NM; i++) { const p = mpos[i]; setI(mitoMesh, i, p[0], p[1], p[2], i < n ? 1 : 0, 1, 1, 0, 0, p[3]); } upd(mitoMesh); };
  mitoDrawn(Math.round(NM * 0.6));
  // several nuclei lying just under the membrane (the cell is multinucleate)
  const nucGeo = blob(8, 2.3, 3.1, 0.04, 2, 3);
  [[-92, RAD - 2.0, -1], [-35, -RAD + 2.0, -2], [20, RAD - 2.0, -3], [74, -RAD + 2.0, -1], [-60, RAD - 3.4, -12], [100, -RAD + 3.4, -10], [50, RAD - 2.6, 4], [-8, -RAD + 2.6, 5]].forEach(([x, y, z]) => add(fib, nucGeo, M.nucleus, x, y, z));
  // sarcomere insets (×14): thick myosin, thin actin, Z discs, heads and ATP
  const SC = 14, inset = new THREE.Group(); inset.position.set(0, 86, 0); inset.scale.setScalar(SC); g.add(inset);
  const thickMat = physical("#ff9d6e", { roughness: 0.35 }), thinMat = physical("#7dd3fc", { roughness: 0.35 });
  const zMat = physical("#334155", { roughness: 0.5, transparent: true, opacity: 0.88 });
  zMat.userData.clayColor = "#8f8aa8";
  const LT = 0.42, thickPos = [[0, 0]]; for (let k = 0; k < 6; k++) thickPos.push([Math.cos(k * Math.PI / 3) * LT, Math.sin(k * Math.PI / 3) * LT]);
  const thinPos = []; for (let k = 0; k < 6; k++) { thinPos.push([Math.cos(k * Math.PI / 3 + Math.PI / 6) * LT * 0.577, Math.sin(k * Math.PI / 3 + Math.PI / 6) * LT * 0.577]); thinPos.push([Math.cos(k * Math.PI / 3 + Math.PI / 6) * LT * 1.15, Math.sin(k * Math.PI / 3 + Math.PI / 6) * LT * 1.15]); }
  const thickGeo = new THREE.CapsuleGeometry(0.075, 1.45, 4, 10).rotateZ(Math.PI / 2);
  thickPos.forEach(([y, z]) => add(inset, thickGeo, thickMat, 0, y, z));
  const thinGeo = new THREE.CapsuleGeometry(0.036, 0.92, 3, 8).rotateZ(Math.PI / 2);
  const thin = inst(thinGeo, thinMat, thinPos.length * 2, inset);
  const zGeo = new THREE.CylinderGeometry(1.3, 1.3, 0.06, 40).rotateZ(Math.PI / 2);
  const zL = add(inset, zGeo, zMat), zR = add(inset, zGeo, zMat);
  const NHD = 7 * 2 * 9, headGeo = new THREE.IcosahedronGeometry(0.06, 1), heads = inst(headGeo, physical("#ffd34e", { roughness: 0.3, emissive: col("#d97706"), emissiveIntensity: 0.35 }), NHD, inset);
  const NATP = 26, atpMesh = inst(new THREE.IcosahedronGeometry(0.05, 1), new THREE.MeshBasicMaterial({ color: "#fde047" }), NATP, inset);
  atpMesh.userData.clayColor = "#f4e3b8";
  const sleeve = add(inset, new THREE.CapsuleGeometry(1.2, 2.4, 6, 24).rotateZ(Math.PI / 2), glass("#a5f3fc", { rim: "#e6fdff", minAlpha: 0.02, maxAlpha: 0.2 }));
  sleeve.userData.clayHide = true;
  // fine lines tying the inset to the fibre it came from
  const lineMat = new THREE.LineBasicMaterial({ color: "#a5f3fc", transparent: true, opacity: 0.4 });
  const tie = new THREE.Group(); g.add(tie);
  for (const sx of [-1, 1]) { const geo = new THREE.BufferGeometry().setFromPoints([V3(sx * 1.3, RAD + 1, 0), V3(sx * 19, 70, 0)]); tie.add(new THREE.Line(geo, lineMat)); }
  const lblTilt = 0;
  const gl2 = new THREE.Group(); g.add(gl2);
  let lastMito = -1;
  function update(dt, t, active) {
    if (S.twitch > 0) S.twitch -= dt;
    model.act = S.strength * (S.holding || S.twitch > 0 ? 1 : 0);
    model.mito = S.mito ?? 1;
    model.step(dt);
    ms.muscleCycles = model.cycles; ms.muscleRecovered = model.recovered; ms.muscleFatigue = model.fatigueSeen;
    const sx = model.SL / 2.6;
    stripeU.value = model.SL;
    fib.scale.set(sx, 1 + 0.5 * (1 / Math.sqrt(sx) - 1), 1 + 0.5 * (1 / Math.sqrt(sx) - 1));
    fib.updateWorldMatrix(true, false);
    for (let i = 0; i < 3; i++) planes[i].copy(planesLocal[i]).applyMatrix4(fib.matrixWorld);
    const nm = Math.round(clamp((S.mito ?? 1) / 1.5, 0, 1) * NM);
    if (nm !== lastMito) { lastMito = nm; mitoDrawn(nm); }
    // the magnified sarcomere: Z discs approach as thin filaments slide inward
    const SL = model.SL, half = SL / 2;
    zL.position.x = -half; zR.position.x = half;
    thinPos.forEach(([y, z], i) => { setI(thin, i, -half + 0.46, y, z, 1); setI(thin, i + thinPos.length, half - 0.46, y, z, 1); });
    upd(thin);
    const force = model.force, cyc = t * (1 + 3 * model.atp) * 1.6;
    let h = 0;
    for (let f = 0; f < 7; f++) for (const side of [-1, 1]) for (let j = 0; j < 9; j++) {
      const ang = j * 2.4 + f, rad = 0.1 + 0.06 * Math.max(0, Math.sin((cyc + j * 0.7 + f) * 3)) * (model.act > 0.05 ? force : 0);
      const swing = (model.act > 0.05 ? Math.sin((cyc + j * 0.37) * 3) : 0) * 0.07 * force;
      setI(heads, h++, side * (0.14 + j * 0.085 - side * swing * 0), thickPos[f][0] + Math.cos(ang) * rad, thickPos[f][1] + Math.sin(ang) * rad, 1);
    }
    upd(heads);
    const nA = Math.round(NATP * model.atp);
    for (let i = 0; i < NATP; i++) { const a = i * 2.39 + t * 0.6, r = 0.45 + 0.35 * hash(i), x = Math.sin(a * 0.8 + i) * 0.7; setI(atpMesh, i, x, Math.cos(a) * r, Math.sin(a) * r, i < nA ? 1 : 0); }
    upd(atpMesh);
  }
  function chips() {
    const y7 = X.lens.band === "y7-8";
    return [`<i class="dot" style="background:#ef6f6c"></i>${y7 ? "Shortening" : "Sarcomere length"} <b>${y7 ? Math.round(100 * model.shorten) + " %" : model.SL.toFixed(2) + " µm"}</b>`,
      `<i class="dot" style="background:#fbbf24"></i>${y7 ? "Energy (ATP)" : "ATP"} <b>${Math.round(100 * model.atp)} %</b>`,
      `<i class="dot" style="background:#fb923c"></i>Force <b>${Math.round(100 * model.force)} %</b>`];
  }
  function controls(el) {
    const y7 = X.lens.band === "y7-8";
    const r = K.buttonRow(el);
    K.button(r, "Twitch ▸", () => { S.twitch = 0.7; }, { kind: "primary" });
    const hold = K.button(r, "Hold contraction", (on) => { S.holding = on; }, { toggle: true, pressed: S.holding });
    K.slider(el, { label: y7 ? "How hard the nerve signals" : "Neural drive", min: 20, max: 100, value: Math.round(S.strength * 100), unit: " %", onInput: (v) => { S.strength = v / 100; } });
    K.slider(el, { label: y7 ? "Mitochondria (power stations)" : "Mitochondrial density", min: 20, max: 150, value: Math.round((S.mito ?? 1) * 100), format: (v) => `${(v / 100).toFixed(1)}×`, onInput: (v) => { S.mito = v / 100; X.refresh(); } });
    el.insertAdjacentHTML("beforeend", `<p class="hint">${y7 ? "Hold the contraction for a while. What happens when the energy (ATP) runs low? Rest to recover." : "Contract, then hold: ATP use outruns supply and force falls. More mitochondria slow that. (Real fatigue has several causes; this demo shows only ATP supply versus use.) The inset is the same fibre magnified 14×; the A band keeps its length while the I band shrinks."}</p>`);
  }
  const D = V3(0.1, 0.5, 1);
  const views = [
    { label: "Whole fibre (shortened)", x: 0, y: 34, z: 0, w: 270, nw: 175, h: 150, dir: D },
    { label: "Sarcomere (magnified)", x: 0, y: 86, z: 0, w: 52, h: 40 },
    { label: "Inside the fibre", x: -30, y: 4, z: 0, w: 90, h: 50, dir: V3(0.1, 0.7, 1) },
  ];
  const anchors = [
    { p: () => V3(-92, RAD + 7, 0), t: { "y7-8": "A nucleus (there are many)", "y9-10": "One of many nuclei", y11: "Peripheral nuclei (multinucleate fibre)" } },
    { p: () => V3(60, 8, 6), t: { "y7-8": "Stripes: thread bundles", "y9-10": "Myofibrils (striated)" } },
    { p: () => V3(-22, -RAD - 6, -2), t: { "y7-8": "Power stations", "y9-10": "Mitochondria" } },
    { p: () => V3(-3.5 * SC / 3.2 - 20, 86 + 21, 0), t: { "y9-10": "Thick filaments (myosin)", y11: "Myosin (thick) + heads" }, show: () => X.lens.atLeast("y9-10") },
    { p: () => V3(20, 86 - 20, 0), t: { "y9-10": "Thin filaments (actin)" }, show: () => X.lens.atLeast("y9-10") },
    { p: () => V3(-model.SL / 2 * SC - 9, 86 + 3, 0), t: { "y9-10": "Z disc", y11: "Z disc" }, show: () => X.lens.atLeast("y9-10") },
    { p: () => V3(HALF * model.SL / 2.6 + 12, 0, 0), t: { "y7-8": "(cut: really much longer)", "y9-10": "Truncated: fibres can be cm long" } },
  ];
  return { g, hit: [300, 200, 80], view: views[0], anchors, views, update, chips, controls, narr: () => ({ model }), focus: () => views[0], live: true };
}

// ---------- 4. Sperm cell ----------
function buildSperm(X) {
  const { S, ms } = X, M = mats();
  const model = (S.model ||= new C.SpermModel());
  Object.assign(S, { phase: 0, mito: model.mito });
  const g = new THREE.Group();
  g.add(makePlinth(68, -13));
  const OFF = 22, SLOW = 4;                                   // neck position (x) and the slow-motion factor
  // streamlined head: dense nucleus + acrosome cap
  const front = new THREE.Group(); front.position.set(OFF, 0, 0); g.add(front);
  const headMat = physical("#6258da", { roughness: 0.3, emissive: col("#2e2a8c"), emissiveIntensity: 0.4 });
  const head = add(front, new THREE.SphereGeometry(1, 36, 24), headMat, 2.6, 0, 0); head.scale.set(2.6, 1.5, 0.95);
  const acroMat = glass("#7ee6ff", { rim: "#e6fbff", rimPower: 1.6, rimStrength: 0.7, minAlpha: 0.3, maxAlpha: 0.9 });
  acroMat.userData.clayColor = "#92d3cf";
  const acro = add(front, new THREE.SphereGeometry(1, 36, 18, 0, TAU, 0, 1.0).rotateZ(-Math.PI / 2), acroMat, 2.6, 0, 0); acro.scale.set(2.72, 1.6, 1.03);
  const neck = add(front, new THREE.SphereGeometry(0.6, 12, 10), physical("#c9c3ff", { roughness: 0.4 }), -0.1, 0, 0);
  // midpiece: the axoneme wrapped by a helix of mitochondria
  const axo = add(front, new THREE.CylinderGeometry(0.34, 0.34, 6.4, 14).rotateZ(Math.PI / 2), physical("#f0f4ff", { roughness: 0.4 }), -3.2, 0, 0);
  const mitoMat = physical("#f59e55", { roughness: 0.3, emissive: col("#c2410c"), emissiveIntensity: 0.4 });
  const NMT = 52, mito = inst(new THREE.CapsuleGeometry(0.2, 0.36, 3, 8), mitoMat, NMT, front);
  const helix = (i) => { const u = (i + 0.5) / NMT, th = u * 13 * TAU, r = 0.66; return { x: -0.3 - u * 5.9, y: Math.cos(th) * r, z: Math.sin(th) * r, th, u }; };
  const _qa = new THREE.Quaternion(), _ya = new THREE.Vector3(0, 1, 0);
  function drawMito(n) {
    for (let i = 0; i < NMT; i++) {
      const h = helix(i), T = V3(-5.9, -Math.sin(h.th) * 0.66 * 13 * TAU, Math.cos(h.th) * 0.66 * 13 * TAU).normalize();
      _qa.setFromUnitVectors(_ya, T); _p.set(h.x, h.y, h.z); _s.setScalar(i < n ? 1 : 0); _m.compose(_p, _qa, _s); mito.setMatrixAt(i, _m);
    }
    upd(mito);
  }
  drawMito(NMT);
  // flagellum: a tapering tube rebuilt every frame from a travelling wave
  const NR = 64, RAD8 = 9, tailLen = 44;
  const pos = new Float32Array((NR + 1) * (RAD8 + 1) * 3), nor = new Float32Array(pos.length), idx = [];
  for (let i = 0; i < NR; i++) for (let j = 0; j < RAD8; j++) { const a = i * (RAD8 + 1) + j, b = (i + 1) * (RAD8 + 1) + j; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  tg.setAttribute("normal", new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
  tg.setIndex(idx);
  const tailMat = physical("#d6ecff", { roughness: 0.3, emissive: col("#3b6aa0"), emissiveIntensity: 0.3 });
  tailMat.userData.clayColor = "#a1b1ef";
  const tail = new THREE.Mesh(tg, tailMat); tail.frustumCulled = false; g.add(tail);
  const X0 = OFF - 6.4;                                        // where the principal piece starts
  const k = TAU / 32;
  const waveY = (s, ph, amp) => amp * 3.1 * smooth(s, 0, 14) * (1 - 0.3 * s / tailLen) * Math.sin(k * s - ph);
  function buildTail(ph, amp) {
    let o = 0;
    for (let i = 0; i <= NR; i++) {
      const s = (i / NR) * tailLen, y = waveY(s, ph, amp), y2 = waveY(s + 0.2, ph, amp), dy = (y2 - y) / 0.2;
      const tx = -1, ty = dy, L = Math.hypot(tx, ty), nx = -ty / L, ny = tx / L;
      const r = lerp(0.36, 0.1, Math.pow(s / tailLen, 0.7));
      for (let j = 0; j <= RAD8; j++) {
        const a = (j / RAD8) * TAU, c = Math.cos(a), sn = Math.sin(a);
        const vx = c * nx, vy = c * ny, vz = sn;
        pos[o] = X0 - s * 0.9999 + r * vx; pos[o + 1] = y + r * vy; pos[o + 2] = r * vz;
        nor[o] = vx; nor[o + 1] = vy; nor[o + 2] = vz; o += 3;
      }
    }
    tg.attributes.position.needsUpdate = true; tg.attributes.normal.needsUpdate = true;
  }
  // seminal fluid streaming past (the sperm is held in place: a 'tracking' view)
  const NF = 150, fpos = new Float32Array(NF * 3), fcol = new Float32Array(NF * 3);
  const rng = mulberry32(9);
  for (let i = 0; i < NF; i++) { fpos[i * 3] = (rng() - 0.5) * 140; fpos[i * 3 + 1] = (rng() - 0.5) * 36; fpos[i * 3 + 2] = (rng() - 0.5) * 30; const c = col(i % 3 ? "#dbeafe" : "#fde68a"); fcol.set([c.r, c.g, c.b], i * 3); }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute("position", new THREE.BufferAttribute(fpos, 3)); fg.setAttribute("color", new THREE.BufferAttribute(fcol, 3));
  const flow = new THREE.Points(fg, new THREE.PointsMaterial({ size: 0.55, map: softDot(), vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  flow.frustumCulled = false; g.add(flow);
  const nuc = { x: OFF + 2.6 };
  let lastN = -1;
  function update(dt, t, active) {
    model.mito = S.mito;
    model.step(dt);
    ms.spermSpeed = model.speed; if (model.speed >= 80) ms.spermFast = true;
    S.settle ||= {};
    for (const [m0, flag] of [[0, "sperm0"], [0.2, "sperm20"], [1, "sperm100"]]) {
      if (Math.abs(S.mito - m0) < 0.03 && Math.abs(model.speed - C.SpermModel.steady(S.mito)) < 6) { S.settle[flag] = (S.settle[flag] || 0) + dt; if (S.settle[flag] >= 4) ms[flag] = true; } else S.settle[flag] = 0;
    }
    const F = model.F;
    if (!X.engine.reducedMotion) S.phase += dt * TAU * (model.hz / SLOW);
    const amp = clamp(F, 0, 1);
    buildTail(S.phase, amp);
    const yaw = 0.12 * amp * Math.sin(-S.phase + 0.9);
    front.rotation.z = yaw; front.position.y = -Math.sin(-S.phase + 0.3) * 0.25 * amp;
    mitoMat.emissiveIntensity = 0.1 + 0.9 * model.atp;
    const n = Math.round(NMT * S.mito);
    if (n !== lastN) { lastN = n; drawMito(n); }
    // fluid streams backwards at the (slowed) swimming speed
    const v = (model.speed / SLOW) * dt;
    for (let i = 0; i < NF; i++) { let x = fpos[i * 3] - v; if (x < -70) x += 140; fpos[i * 3] = x; }
    fg.attributes.position.needsUpdate = true;
  }
  function chips() {
    const y7 = X.lens.band === "y7-8";
    return [`<i class="dot" style="background:#7dd3fc"></i>${y7 ? "Swimming speed" : "Swim speed"} <b>${Math.round(model.speed)} µm/s</b>`,
      `<i class="dot" style="background:#fbbf24"></i>${y7 ? "Energy (ATP)" : "ATP"} <b>${Math.round(100 * model.atp)} %</b>`,
      `<i class="dot" style="background:#fb923c"></i>${y7 ? "Mitochondria" : "Midpiece mitochondria"} <b>${Math.round(S.mito * 100)} %</b>`];
  }
  function controls(el) {
    const y7 = X.lens.band === "y7-8";
    K.slider(el, { label: y7 ? "Mitochondria in the middle piece" : "Midpiece mitochondria", min: 0, max: 100, value: Math.round(S.mito * 100), unit: " %", onInput: (v) => { S.mito = v / 100; X.refresh(); } });
    const r = K.buttonRow(el);
    K.button(r, "Switch mitochondria off", () => { S.mito = 0; X.rebuildControls(); }, {});
    K.button(r, "Restore", () => { S.mito = 1; X.rebuildControls(); }, {});
    el.insertAdjacentHTML("beforeend", `<p class="hint">${y7 ? "The sperm is held still and the liquid flows past. Fewer mitochondria means less energy, so a weaker tail beat and slower swimming." : "Time is slowed 4× (beat and flow). The speed levels off at high ATP: the dynein motors can only beat so fast. Real sperm also make some ATP by glycolysis along the tail."}</p>`);
  }
  const D = V3(0.03, 0.12, 1);
  const views = [
    { label: "Whole cell", x: -4, y: 0, z: 0, w: 62, h: 24, dir: D },
    { label: "Head and acrosome", x: OFF + 2.4, y: 0, z: 0, w: 16, h: 10, dir: D },
    { label: "Midpiece (mitochondria)", x: OFF - 3.2, y: 0, z: 0, w: 14, h: 9, dir: D },
    { label: "Tail", x: -18, y: 0, z: 0, w: 60, h: 20, dir: D },
  ];
  const anchors = [
    { p: () => V3(OFF + 3, 4.4, 0), t: { "y7-8": "Head: half the DNA", "y9-10": "Head: haploid nucleus", y11: "Nucleus (n = 23)" } },
    { p: () => V3(OFF + 5.9, -3.3, 0), t: { "y7-8": "Acrosome (cap)", "y9-10": "Acrosome (enzymes)" } },
    { p: () => V3(OFF - 3.2, 4.5, 0), t: { "y7-8": "Power stations", "y9-10": "Midpiece: mitochondria" } },
    { p: () => V3(-18, 7, 0), t: { "y7-8": "Tail (whips)", "y9-10": "Flagellum" } },
  ];
  return { g, hit: [150, 40, 40], view: views[0], anchors, views, update, chips, controls, narr: () => ({ model }), focus: () => views[0], live: true };
}

// ---------- 5. Ciliated epithelial cell (airway) ----------
function buildCilia(X) {
  const { S, ms } = X, M = mats();
  Object.assign(S, { activity: 1, smoke: false, cleared: 0, waiting: 0, phase: 0, coord: 1, amp: 1 });
  const g = new THREE.Group();
  g.add(makePlinth(70, -29));
  const COLS = 7, ROWS = 3, SPX = 9.4, SPZ = 10.5;
  const goblet = new Set(["1,0", "5,2", "2,2", "4,0", "6,1"]);
  const cells = [];
  for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) cells.push({ q, r, x: (q - 3) * SPX + (r % 2 ? 4.7 : 0) * 0.5, z: (r - 1) * SPZ, goblet: goblet.has(`${q},${r}`) });
  const cil = cells.filter((c) => !c.goblet), gob = cells.filter((c) => c.goblet);
  const ciliatedGeo = lathe([[0, -26], [2.2, -26], [3.3, -24.5], [3.7, -15], [4.15, -6], [4.35, -1.5], [4.1, 0.1], [0, 0.35]], 28);
  const gobletGeo = lathe([[0, -26], [1.8, -26], [2.4, -22], [2.9, -13], [4.5, -6], [5.0, -2], [4.5, 0.1], [0, 0.2]], 28);
  const bodyC = inst(ciliatedGeo, M.memPink, cil.length, g), bodyG = inst(gobletGeo, M.memTeal, gob.length, g);
  cil.forEach((c, i) => setI(bodyC, i, c.x, 0, c.z, 1)); gob.forEach((c, i) => setI(bodyG, i, c.x, 0, c.z, 1)); upd(bodyC); upd(bodyG);
  bodyC.userData.clayColor = "#f0b0c9"; bodyG.userData.clayColor = "#92d3cf";
  const nucs = inst(new THREE.SphereGeometry(1, 20, 14), M.nucleus, cells.length, g);
  cells.forEach((c, i) => setI(nucs, i, c.x, -19, c.z, 2.5, 4.4, 2.5)); upd(nucs);
  const NMT = cil.length * 5, mit = inst(new THREE.CapsuleGeometry(0.42, 0.9, 3, 8), M.mito, NMT, g);
  { let n = 0; cil.forEach((c, ci) => { for (let k = 0; k < 5; k++) { const a = k * 1.26 + ci, r = 2.3; setI(mit, n++, c.x + Math.cos(a) * r, -3.2 - (k % 2) * 2.2, c.z + Math.sin(a) * r, 1, 1, 1, Math.PI / 2 * (k % 2), a, 0); } }); upd(mit); }
  const NG = gob.length * 12, gran = inst(new THREE.IcosahedronGeometry(0.62, 1), physical("#bfe3ff", { roughness: 0.2, clearcoat: 1 }), NG, g);
  { let n = 0; gob.forEach((c, ci) => { for (let k = 0; k < 12; k++) { const a = k * 2.4 + ci, rr = 1.6 + hash(k + ci * 5) * 1.6, y = -3 - hash(k * 3 + ci) * 4.5; setI(gran, n++, c.x + Math.cos(a) * rr, y, c.z + Math.sin(a) * rr, 1); } }); upd(gran); }
  const basement = add(g, new THREE.BoxGeometry(90, 1.4, 44), physical("#6b5a45", { roughness: 0.8, clearcoat: 0, sheen: 0 }), 0, -27.4, 0);
  basement.userData.clayColor = "#f4e3b8";
  // cilia: one bent tapered rod each, curved in the vertex shader by a beating wave
  const NC = cil.length * 14, ciliaGeo = new THREE.CylinderGeometry(0.075, 0.15, 6, 6, 12, true).translate(0, 3, 0);
  const aPh = new Float32Array(NC), aRnd = new Float32Array(NC), ciliaPos = [];
  { let n = 0; cil.forEach((c) => { for (let k = 0; k < 14; k++) { const a = hash(n * 2.3) * TAU, r = Math.sqrt(hash(n * 5.1 + 1)) * 3.5, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r; ciliaPos.push([x, z]); aPh[n] = x * 0.42 + z * 0.12; aRnd[n] = hash(n * 7.7); n++; } }); }
  ciliaGeo.setAttribute("aPh", new THREE.InstancedBufferAttribute(aPh, 1));
  ciliaGeo.setAttribute("aRnd", new THREE.InstancedBufferAttribute(aRnd, 1));
  const cU = { uPhase: { value: 0 }, uAmp: { value: 1 }, uCoord: { value: 1 } };
  const ciliaMat = physical("#ffd9e8", { roughness: 0.35, emissive: col("#f472b6"), emissiveIntensity: 0.18, side: THREE.DoubleSide });
  const ciliaPatch = (sh) => {
    Object.assign(sh.uniforms, cU);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute float aPh; attribute float aRnd; uniform float uPhase, uAmp, uCoord; varying float vC;")
      .replace("#include <beginnormal_vertex>", `
        float ph = uPhase - mix(aRnd * 6.2831853, aPh, uCoord);
        float pp = fract(ph / 6.2831853);
        float st = pp < 0.35 ? smoothstep(0.0, 1.0, pp / 0.35) : 1.0 - smoothstep(0.0, 1.0, (pp - 0.35) / 0.65);
        float hh = clamp(position.y / 6.0, 0.0, 1.0);
        float ang = (uAmp * (st * 2.0 - 1.0) - 0.15 * (1.0 - uAmp)) * mix(0.3, 1.0, hh) + 0.0;
        float ca = cos(ang), sa = sin(ang);
        vec3 objectNormal = vec3(normal.x * ca + normal.y * sa, -normal.x * sa + normal.y * ca, normal.z);
        vC = hh;`)
      .replace("#include <begin_vertex>", "vec3 transformed = vec3(position.x * ca + position.y * sa, -position.x * sa + position.y * ca, position.z);");
  };
  ciliaMat.onBeforeCompile = ciliaPatch;
  ciliaMat.customProgramCacheKey = () => "cilia";
  ciliaMat.userData.clayPatch = ciliaPatch; ciliaMat.userData.clayPatchKey = "cilia";   // clay keeps the beating wave: the bend is re-applied on top of the clay shader
  const cilia = inst(ciliaGeo, ciliaMat, NC, g);
  cilia.userData.clayColor = "#ee9fbd";
  { let n = 0; cil.forEach((c) => { for (let k = 0; k < 14; k++) { const p = ciliaPos[n]; setI(cilia, n++, p[0], 0.1, p[1], 1); } }); upd(cilia); }
  // periciliary fluid and the mucus blanket riding on top
  const fluid = add(g, new THREE.BoxGeometry(96, 6, 44), M.fluid, 0, 3, 0); fluid.userData.clayHide = true;
  const mucus = add(g, new THREE.BoxGeometry(96, 4.5, 44), M.mucus, 0, 8.25, 0); mucus.userData.clayColor = "#d9e5a4"; mucus.userData.clayOpacity = 0.4;
  // trapped particles: soot, pollen-like grains and bacteria
  const NP = 40, pm = (geo, c) => inst(geo, physical(c, { roughness: 0.5 }), NP, g);
  const soot = pm(new THREE.IcosahedronGeometry(0.75, 1), "#3f3f46"), grain = pm(new THREE.DodecahedronGeometry(1.1, 0), "#d9a441"), bac = pm(new THREE.CapsuleGeometry(0.34, 1.1, 3, 6), "#7bd88f");
  soot.userData.clayColor = "#b8aebd"; grain.userData.clayColor = "#f8c29d"; bac.userData.clayColor = "#a6ddc2";
  const parts = Array.from({ length: NP }, (_, i) => ({ x: -46 + hash(i * 3.1) * 92, hy: hash(i * 7.3), z: (hash(i * 5.9) - 0.5) * 34, type: i % 3, ph: hash(i) * 6.28, on: true }));
  const nVis = () => (S.smoke ? 40 : 22);
  function drawParts(t) {
    const n = nVis();
    parts.forEach((p, i) => {
      const s = i < n ? 1 : 0, T = i % 3;
      const wob = Math.sin(t * 1.4 + p.ph) * 0.12;
      setI(T === 0 ? soot : T === 1 ? grain : bac, i, p.x, 6.5 + p.hy * Math.max(0.4, 4.5 * mucus.scale.y - 1.4) + wob, p.z, s, s, s, 0, p.ph, p.ph * 0.5);
      if (T !== 0) setI(soot, i, 0, 0, 0, 0);
      if (T !== 1) setI(grain, i, 0, 0, 0, 0);
      if (T !== 2) setI(bac, i, 0, 0, 0, 0);
    });
    upd(soot); upd(grain); upd(bac);
  }
  const SLOW = 6;
  function update(dt, t, active) {
    const st = C.ciliaState(S.activity, S.smoke);
    if (S.activity <= 0.15) ms.ciliaLow = true; else if (ms.ciliaLow && S.activity >= 0.8) ms.ciliaBack = true;
    const target = st.eff;
    S.amp += (target - S.amp) * clamp(dt * 3, 0, 1);
    S.coord += ((S.smoke ? 0.55 : 1) - S.coord) * clamp(dt * 2, 0, 1);
    if (!X.engine.reducedMotion) S.phase += dt * TAU * (st.beatHz / SLOW);
    cU.uPhase.value = S.phase; cU.uAmp.value = clamp(S.amp, 0, 1) * 1.0; cU.uCoord.value = S.coord;
    mucus.scale.y += ((S.smoke ? 1.7 : 1) - mucus.scale.y) * clamp(dt * 2, 0, 1);
    mucus.position.y = 6.0 + 2.25 * mucus.scale.y;            // the blanket rests on the cilia tips (6 um) however thick it gets
    const v = (st.umPerS / SLOW) * dt;
    const n = nVis();
    let waiting = 0;
    for (let i = 0; i < NP; i++) {
      const p = parts[i];
      p.x += v;
      if (p.x > 47) { p.x = -47; p.z = (hash(S.cleared * 3.7 + i) - 0.5) * 34; if (i < n) { S.cleared++; ms.ciliaCleared = S.cleared; } }
      if (i < n) waiting++;
    }
    S.waiting = waiting;
    drawParts(t);
  }
  function chips() {
    const st = C.ciliaState(S.activity, S.smoke), y7 = X.lens.band === "y7-8";
    return [`<i class="dot" style="background:#c8e88a"></i>${y7 ? "Mucus moving at" : "Mucus speed"} <b>${st.mmPerMin.toFixed(1)} mm/min</b>`, `<i class="dot" style="background:#f9a8d4"></i>Particles cleared <b>${S.cleared}</b>`, `<i class="dot" style="background:#3f3f46"></i>${y7 ? "Stuck in the mucus" : "Trapped now"} <b>${S.waiting}</b>`];
  }
  function controls(el) {
    const y7 = X.lens.band === "y7-8";
    K.slider(el, { label: y7 ? "How fast the cilia beat" : "Ciliary activity", min: 0, max: 100, value: Math.round(S.activity * 100), unit: " %", onInput: (v) => { S.activity = v / 100; X.refresh(); } });
    if (y7) S.smoke = false; else K.checkbox(el, "Cigarette smoke in the airway (smoking and health)", S.smoke, (v) => { S.smoke = v; X.refresh(); });
    el.insertAdjacentHTML("beforeend", `<p class="hint">${y7 ? "Watch the dust and germs stuck in the mucus being carried along. Turn the cilia right down, then back up." : "Beating and mucus flow are slowed 6×; the readout shows real speed (about 4–20 mm/min in healthy airways). Smoke slows the beat and thickens the mucus, so clearance falls."}</p>`);
  }
  const views = [
    { label: "The airway lining", x: 0, y: -8, z: 0, w: 110, h: 50 },
    { label: "Cilia close-up", x: 0, y: 3, z: 0, w: 32, h: 16 },
    { label: "Mucus and trapped particles", x: 10, y: 7, z: 0, w: 70, h: 18 },
  ];
  const anchors = [
    { p: () => V3(0, 5, 4), t: { "y7-8": "Cilia (tiny hairs)", "y9-10": "Cilia beat in waves" } },
    { p: () => V3(-4.7, -3.2, 5), t: { "y7-8": "Power stations", "y9-10": "Mitochondria (ATP)" } },
    { p: () => V3(-0, -20, 6), t: { "y7-8": "Nucleus", "y9-10": "Nucleus" } },
    { p: () => V3(-40, 11.5, 0), t: { "y7-8": "Mucus (sticky)", "y9-10": "Mucus layer + trapped particles" } },
    { p: () => V3(-28.2, -2, 11), t: { "y7-8": "A mucus-making cell", "y9-10": "Goblet cell (makes mucus)" } },
  ];
  return { g, hit: [112, 66, 50], view: views[0], anchors, views, update, chips, controls, narr: () => ({ activity: S.activity, smoke: S.smoke, cleared: S.cleared, waiting: S.waiting }), focus: () => views[0], live: true };
}

// ---------- 6. Root hair cell ----------
function buildRootHair(X) {
  const { S, ms } = X, M = mats();
  Object.assign(S, { L: 220, wet: 85, waterlogged: false, a: 0 });
  const g = new THREE.Group();
  g.add(makePlinth(250, -78)); g.children[0].scale.set(1, 1, 0.45);
  const BX = -190, HB = -163;                                   // body centre and where the hair leaves it
  const rng = mulberry32(88);
  // the epidermal cell body: cell wall, membrane, a big central vacuole and a nucleus
  const body = new THREE.Group(); body.position.set(BX, 0, 0); g.add(body);
  add(body, blob(31.5, 35, 27.5, 0.03, 3, 4), M.wallCream);
  add(body, blob(29.5, 33, 25.5, 0.03, 5, 4), M.memPink);
  const vac = add(body, blob(21, 25, 17, 0.04, 9, 4), M.vacuole); vac.position.set(-1, 0, 0);
  add(body, blob(6.4, 6, 6, 0.04, 4, 3), M.nucleus, -18, 14, 9);
  const bm = inst(new THREE.CapsuleGeometry(0.9, 1.7, 3, 8), M.mito, 34, body);
  for (let i = 0; i < 34; i++) { const a = rng() * TAU, b = Math.acos(2 * rng() - 1), s = 0.84 + rng() * 0.06; setI(bm, i, Math.sin(b) * Math.cos(a) * 27 * s, Math.cos(b) * 30 * s, Math.sin(b) * Math.sin(a) * 23 * s, 1, 1, 1, rng() * 3, rng() * 3, 0); }
  upd(bm);
  // neighbouring epidermal cells (no hair), to show it is one cell of a tissue
  for (const s of [-1, 1]) { const n = add(g, blob(31, 33, 26, 0.03, 12 + s, 4), M.wallCream, BX, s * 70, 0); n.userData.clayOpacity = 0.35; add(g, blob(29, 31, 24, 0.03, 15 + s, 4), M.memPink, BX, s * 70, 0); }
  // the hair (rebuilt for each length)
  const hair = new THREE.Group(); hair.position.set(HB, 0, 0); g.add(hair);
  const hairMat = gl("#f6b866", "#ffe9bf", { minAlpha: 0.22, maxAlpha: 0.8 });
  const hairVacMat = M.vacuole;
  const NMH = 44, hm = inst(new THREE.CapsuleGeometry(0.6, 1.2, 3, 8), M.mito, NMH, hair);
  const NTR = 30, trGeo = new THREE.TorusGeometry(0.95, 0.4, 8, 16), trMat = physical("#a78bfa", { roughness: 0.3, emissive: col("#5b21b6"), emissiveIntensity: 0.6 });
  const tr = inst(trGeo, trMat, NTR, g); tr.userData.clayColor = "#c5b3ea";
  let hairMesh = null, vacMesh = null, curL = -1;
  const trData = [];
  function buildHair() {
    const L = Math.max(4, S.L);
    if (hairMesh) { hair.remove(hairMesh); hairMesh.geometry.dispose(); }
    if (vacMesh) { hair.remove(vacMesh); vacMesh.geometry.dispose(); }
    const pts = [[0, -3]];
    const n = Math.max(6, Math.round(L / 6));
    for (let i = 0; i <= n; i++) { const x = (i / n) * L; pts.push([5 + 2.2 * Math.exp(-x / 5), x]); }
    for (let i = 1; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; pts.push([5 * Math.cos(a), L + 5 * Math.sin(a)]); }
    hairMesh = new THREE.Mesh(lathe(pts, 28), hairMat); hairMesh.rotation.z = -Math.PI / 2; hair.add(hairMesh);
    hairMesh.userData.clayColor = "#f8c29d";
    if (L > 24) {
      const vp = [[0, 6]]; for (let i = 0; i <= 12; i++) { const x = 6 + ((L - 20) * i) / 12; vp.push([3.1 * Math.sin(Math.min(1, (i + 0.3) / 3) * Math.PI / 2) * Math.sqrt(Math.max(0.05, 1 - Math.pow(Math.max(0, (i - 9) / 3), 2))), x]); }
      vp.push([0, L - 12]);
      vacMesh = new THREE.Mesh(lathe(vp, 18), hairVacMat); vacMesh.rotation.z = -Math.PI / 2; hair.add(vacMesh);
    }
    // mitochondria along the inside of the wall; more in a longer hair
    const nm = Math.min(NMH, Math.round(6 + L / 9));
    for (let i = 0; i < NMH; i++) { const s = 3 + hash(i * 3.7) * (L + 2), a = hash(i * 9.1) * TAU; setI(hm, i, s, Math.cos(a) * 3.7, Math.sin(a) * 3.7, i < nm ? 1 : 0, 1, 1, 0, 0, a); }
    upd(hm);
    // membrane transporters (carrier proteins) spaced along the hair and on the body face
    trData.length = 0;
    const nt = Math.min(NTR, 6 + Math.round(L / 12));
    for (let i = 0; i < NTR; i++) {
      const s = i < nt ? HB + (i / Math.max(1, nt - 1)) * L * 0.96 + 2 : 0, a = (i * 2.4 + 0.5), rr = 5.0;
      const d = V3(0, Math.cos(a), Math.sin(a)); _qa2.setFromUnitVectors(_za, d);
      trData.push({ x: s, a, on: i < nt });
      _p.set(s, d.y * rr, d.z * rr); _s.setScalar(i < nt ? 1 : 0); _m.compose(_p, _qa2, _s); tr.setMatrixAt(i, _m);
    }
    upd(tr);
    curL = S.L;
  }
  const _qa2 = new THREE.Quaternion(), _za = new THREE.Vector3(0, 0, 1);
  buildHair();
  // soil: grains with thin water films
  const grains = [], NG = 56;
  for (let i = 0; i < NG * 6 && grains.length < NG; i++) {
    const r = 6 + rng() * 9, x = -150 + rng() * 400, y = (rng() - 0.5) * 150, z = (rng() - 0.5) * 70;
    if (Math.hypot(y, z) < 5 + r + 2.5) continue;
    if (x > HB - r - 2 && x < HB + 40 && false) continue;
    if (Math.hypot((x - BX) / 36, y / 40, z / 31) < 1) continue;
    if (grains.some((q) => Math.hypot(q.x - x, q.y - y, q.z - z) < q.r + r + 0.6)) continue;
    grains.push({ x, y, z, r, rot: rng() * 3 });
  }
  const gm = inst(new THREE.IcosahedronGeometry(1, 1), physical("#ffffff", { roughness: 0.92, clearcoat: 0, sheen: 0 }), grains.length, g);
  const gf = inst(new THREE.IcosahedronGeometry(1, 2), M.fluid, grains.length, g);
  const GC = ["#5e4b3b", "#4c4036", "#6d5a46", "#585550", "#74604b"];
  grains.forEach((q, i) => { setI(gm, i, q.x, q.y, q.z, q.r, q.r * 0.8, q.r * 0.9, q.rot, q.rot * 2, 0); gm.setColorAt(i, _c.set(GC[i % GC.length])); setI(gf, i, q.x, q.y, q.z, q.r * 1.13, q.r * 0.93, q.r * 1.03, q.rot, q.rot * 2, 0); });
  upd(gm); upd(gf); gm.instanceColor.needsUpdate = true;
  gm.userData.lod = gf.userData.lod = true;     // soil grains: pure crowding (both meshes share one count, so each grain keeps its water film)
  // water molecules (osmosis) and mineral ions (active transport)
  const NW = 90, wm = inst(new THREE.IcosahedronGeometry(0.62, 1), new THREE.MeshBasicMaterial({ color: "#7dd3fc" }), NW, g);
  wm.userData.clayColor = "#8fbdea";
  const water = Array.from({ length: NW }, (_, i) => ({ u: hash(i * 1.7), s: hash(i * 5.3), a: hash(i * 7.9) * TAU }));
  const NI = 40, im = inst(new THREE.IcosahedronGeometry(0.8, 1), physical("#ffffff", { roughness: 0.3, emissive: col("#7c3aed"), emissiveIntensity: 0.0 }), NI, g);
  const ions = Array.from({ length: NI }, (_, i) => ({ u: hash(i * 2.9), j: i % NTR, o: V3(hash(i) - 0.5, hash(i * 3) - 0.5, hash(i * 7) - 0.5) }));
  ions.forEach((p, i) => im.setColorAt(i, _c.set(i % 2 ? "#a78bfa" : "#fbbf24"))); im.instanceColor.needsUpdate = true;
  const atp = inst(new THREE.IcosahedronGeometry(0.42, 1), new THREE.MeshBasicMaterial({ color: "#fde047" }), NTR, g);
  atp.userData.clayColor = "#f4e3b8";
  const e3 = (u) => u * u * (3 - 2 * u);
  function update(dt, t, active) {
    if (S.L !== curL) buildHair();
    const psi = -1.5 + 1.45 * S.wet / 100;
    const st = C.rootState(S.L, psi, !S.waterlogged);
    ms.rootRatio = st.ratio;
    ms.root3 = st.ratio >= 2.5 && st.water >= 2.5 && st.ion >= 2.5;
    const L = Math.max(4, S.L);
    const nw = clamp(Math.round(Math.abs(st.water) * 22), 0, NW);
    const dir = st.water >= 0 ? 1 : -1, sp = 0.26 * Math.min(1.5, 0.4 + Math.abs(st.dPsi) / 0.6);
    for (let i = 0; i < NW; i++) {
      const w = water[i];
      if (i < nw) w.u = (w.u + dt * sp * dir + 1) % 1;
      const s = HB + 2 + w.s * L * 0.96, u = w.u;
      let r, x = s;
      if (u < 0.55) r = lerp(24, 5.6, e3(u / 0.55)); else { const k = e3((u - 0.55) / 0.45); r = lerp(5.6, 0.8, k); x = s - k * Math.min(26, (s - HB) * 0.8); }
      setI(wm, i, x, Math.cos(w.a) * r, Math.sin(w.a) * r, i < nw ? 1 : 0);
    }
    upd(wm);
    // ions: drift near the membrane, and only cross through a carrier protein when it has ATP
    const nI = clamp(Math.round(st.ion * 10), 0, NI), atpOn = st.atpF > 0.5;
    const rate = 0.2 * st.atpF;
    for (let i = 0; i < NI; i++) {
      const p = ions[i], tdat = trData[p.j];
      if (i < nI && tdat?.on) p.u = (p.u + dt * rate * (0.6 + p.o.x * 0.5)) % 1;
      const u = p.u, cx = tdat ? tdat.x : HB, a = tdat ? tdat.a : 0;
      let r, x = cx;
      if (u < 0.6) { r = lerp(20 + p.o.y * 6, 6.2, e3(u / 0.6)); x += p.o.z * (1 - u / 0.6) * 10; } else { const k = e3((u - 0.6) / 0.4); r = lerp(6.2, 0.6, k); x -= k * 9; }
      setI(im, i, x, Math.cos(a) * r, Math.sin(a) * r, i < nI && tdat?.on ? 1 : 0);
    }
    upd(im);
    // ATP flashes at the working carriers (none when starved of oxygen)
    for (let i = 0; i < NTR; i++) {
      const td = trData[i]; if (!td || !td.on) { setI(atp, i, 0, 0, 0, 0); continue; }
      const k = (t * 0.9 + i * 0.37) % 1, show = atpOn && k < 0.5 ? 1 - k * 2 : 0;
      setI(atp, i, td.x, Math.cos(td.a) * (3.3 - k * 1.5), Math.sin(td.a) * (3.3 - k * 1.5), show * 0.8);
    }
    upd(atp);
    trMat.emissiveIntensity = atpOn ? 0.5 + 0.35 * Math.sin(t * 5) : 0.05;
    // the cell shrinks (plasmolysis) when the soil is drier than the cell
    S.a += ((st.losing ? 1 : 0) - S.a) * clamp(dt * 1.5, 0, 1);
    vac.scale.setScalar(1 - 0.18 * S.a);
  }
  function chips() {
    const psi = -1.5 + 1.45 * S.wet / 100, st = C.rootState(S.L, psi, !S.waterlogged), y7 = X.lens.band === "y7-8";
    return [`<i class="dot" style="background:#fbbf77"></i>${y7 ? "Surface area" : "Membrane area"} <b>${(st.ratio).toFixed(1)}× a hairless cell</b>`,
      `<i class="dot" style="background:#7dd3fc"></i>Water uptake (osmosis) <b>${st.water.toFixed(1)}</b>`,
      `<i class="dot" style="background:#a78bfa"></i>Mineral uptake (active transport) <b>${st.ion.toFixed(1)}</b>`];
  }
  function controls(el) {
    const y7 = X.lens.band === "y7-8";
    K.slider(el, { label: "Hair length", min: 0, max: 400, step: 10, value: S.L, format: (v) => `${v} µm`, onInput: (v) => { S.L = v; X.refresh(); } });
    K.slider(el, { label: y7 ? "How wet the soil is" : "Soil water (dry ↔ wet)", min: 0, max: 100, value: S.wet, format: (v) => (v < 35 ? "very dry" : v < 70 ? "moist" : "wet"), onInput: (v) => { S.wet = v; X.refresh(); } });
    K.checkbox(el, y7 ? "Waterlogged soil (no air)" : "Waterlogged soil (little O₂)", S.waterlogged, (v) => { S.waterlogged = v; X.refresh(); });
    el.insertAdjacentHTML("beforeend", `<p class="hint">${y7 ? "Blue dots are water. Purple and yellow dots are minerals. A longer hair touches more soil. What happens if the soil is very dry, or has no air?" : `Water enters by <b>osmosis</b> (no ATP); nitrate (about ${C.ROOT.CSOIL} mM outside) enters with H⁺ through a cotransporter driven by ATP-powered proton pumps (<b>active transport</b>, so it needs oxygen for respiration). Uptake is shown relative to a hairless cell in wet, aerated soil = 1.`}</p>`);
  }
  const views = [
    { label: "Cell body and hair base", x: -128, y: 0, z: 0, w: 180, h: 80 },
    { label: "Whole cell", x: 20, y: 0, z: 0, w: 470, h: 130 },
    { label: "Inside the hair", x: -120, y: 0, z: 0, w: 70, h: 40 },
    { label: "The cell body", x: -190, y: 0, z: 0, w: 110, h: 90 },
  ];
  const anchors = [
    { p: () => V3(HB + Math.max(30, S.L * 0.7), 14, 0), t: { "y7-8": "Root hair", "y9-10": "Root hair: big surface area" } },
    { p: () => V3(BX, 46, 0), t: { "y7-8": "Big water-filled space", "y9-10": "Large vacuole (cell sap)" } },
    { p: () => V3(BX - 18, 22, 9), t: { "y7-8": "Nucleus", "y9-10": "Nucleus" } },
    { p: () => V3(HB + 20, -9, 0), t: { "y7-8": "Power stations", "y9-10": "Mitochondria (ATP)" } },
    { p: () => V3(HB + Math.max(60, S.L * 0.4), 31, 0), t: { "y9-10": "Water in by osmosis" }, show: () => X.lens.atLeast("y9-10") },
    { p: () => V3(HB + Math.max(80, S.L * 0.6), -31, 0), t: { "y9-10": "Minerals in by active transport" }, show: () => X.lens.atLeast("y9-10") },
  ];
  return { g, hit: [490, 160, 100], view: views[0], anchors, views, update, chips, controls, narr: () => ({ L: S.L, psi: -1.5 + 1.45 * S.wet / 100, o2: !S.waterlogged }), focus: () => views[0], live: true };
}

// ---------- 7. Palisade mesophyll cell ----------
function buildPalisade(X) {
  const { S, ms } = X, M = mats();
  Object.assign(S, { light: 0.55, co2: 1, avoid: true, k: 0 });
  const g = new THREE.Group();
  g.add(makePlinth(80, -76));
  const GRID = [], SP = 20.5;
  for (let r = 0; r < 3; r++) for (let q = 0; q < 5; q++) GRID.push({ x: (q - 2) * SP, z: (r - 1) * SP, hero: q === 2 && r === 1 });
  const colGeo = lathe([[0, -39], [4.8, -38.4], [8.4, -35.5], [9, -30], [9, 38], [8.6, 43.5], [5.6, 47], [0, 47.8]], 30);
  const vacGeo = lathe([[0, -34], [4.4, -33.2], [6.5, -28], [6.8, -18], [6.8, 30], [6.2, 38], [3.6, 41.5], [0, 42]], 24);
  const cells = inst(colGeo, M.wallGreen, GRID.length, g), vacs = inst(vacGeo, M.vacuole, GRID.length, g);
  GRID.forEach((c, i) => { setI(cells, i, c.x, 0, c.z, 1); setI(vacs, i, c.x, 0, c.z, 1); }); upd(cells); upd(vacs);
  cells.userData.clayColor = "#a6ddc2"; vacs.userData.clayColor = "#d9e5a4";
  cells.userData.clayOpacity = 0.36; vacs.userData.clayOpacity = 0.46;      // clay walls a little firmer so the tall cells read as cells, not fog
  const nucs = inst(new THREE.SphereGeometry(1, 16, 12), M.nucleus, GRID.length, g);
  GRID.forEach((c, i) => setI(nucs, i, c.x + 6.9, 6 + hash(i) * 14, c.z + 1, 2.4, 3.2, 2.4)); upd(nucs);
  // chloroplasts: layout A (face-on to the light, near the top and bottom walls) <-> B (edge-on, against the side walls)
  const NH = 44, NO = 14, NCH = NH + (GRID.length - 1) * NO;
  const chl = inst(new THREE.SphereGeometry(1, 18, 12), M.chloro, NCH, g);
  chl.userData.keepMaterial = false;
  const slots = [];
  GRID.forEach((c, ci) => {
    const n = c.hero ? NH : NO;
    for (let k = 0; k < n; k++) {
      const h = hash(slots.length * 3.17 + 1), h2 = hash(slots.length * 5.71 + 2), a = hash(slots.length * 7.3) * TAU;
      const top = h < 0.62;
      const face = { x: Math.cos(a) * Math.sqrt(h2) * 6.2, y: top ? 40 + h2 * 3.4 - (hash(k) > 0.6 ? 5 : 0) : -31 + h2 * 2.5, z: Math.sin(a) * Math.sqrt(h2) * 6.2 };
      const sa = (k / n) * TAU * 3.1 + hash(k) * 2, sy = -29 + (hash(k * 3.3 + ci) * 0.92) * 68;
      const side = { x: Math.cos(sa) * 7.4, y: sy, z: Math.sin(sa) * 7.4 };
      slots.push({ cx: c.x, cz: c.z, face, side, hero: c.hero, ph: hash(k + ci * 7) * 6.28 });
    }
  });
  const _yy = new THREE.Vector3(0, 1, 0), _rd = new THREE.Vector3(), _qs = new THREE.Quaternion(), _qi = new THREE.Quaternion();
  // epidermis and cuticle above, loose spongy mesophyll below
  const epi = inst(new THREE.BoxGeometry(34, 9, 34), M.wallGreen, 8, g);
  [[-34, -17], [0, -17], [34, -17], [-34, 17], [0, 17], [34, 17], [-17, 0], [17, 0]].forEach(([x, z], i) => setI(epi, i, x, 53.2, z)); upd(epi); epi.userData.clayColor = "#a1b1ef";
  const cut = add(g, new THREE.BoxGeometry(110, 3, 70), gl("#fff2b8", "#fffbe0", { minAlpha: 0.12, maxAlpha: 0.5 }), 0, 59.5, 0); cut.userData.clayColor = "#f4e3b8";
  const spongy = inst(blob(1, 1, 1, 0.12, 2, 3), M.wallGreen, 11, g);
  for (let i = 0; i < 11; i++) { const r = 11 + hash(i * 3) * 4; setI(spongy, i, (hash(i * 5.5) - 0.5) * 100, -56 - hash(i * 8) * 8, (hash(i * 2.2) - 0.5) * 56, r, r * 0.8, r); } upd(spongy);
  spongy.userData.clayColor = "#d9e5a4";
  const spChl = inst(new THREE.SphereGeometry(1, 12, 8), M.chloro, 33, g);
  for (let i = 0; i < 33; i++) { const sb = i % 11, ang = hash(i * 9) * TAU; const r = 9 + hash(sb * 3) * 4; setI(spChl, i, (hash(sb * 5.5) - 0.5) * 100 + Math.cos(ang) * r * 0.9, -56 - hash(sb * 8) * 8 + Math.sin(ang * 1.7) * 6, (hash(sb * 2.2) - 0.5) * 56 + Math.sin(ang) * r * 0.9, 2, 0.8, 2); } upd(spChl);
  // light: photons falling, and soft beams
  const NPH = 46, ph = inst(new THREE.IcosahedronGeometry(0.9, 1), new THREE.MeshBasicMaterial({ color: "#ffe066" }), NPH, g);
  ph.userData.clayColor = "#f8c29d";
  const phd = Array.from({ length: NPH }, (_, i) => ({ x: (hash(i * 1.3) - 0.5) * 100, z: (hash(i * 4.9) - 0.5) * 56, u: hash(i * 3.3), v: 0.7 + hash(i) * 0.5 }));
  const beamMat = new THREE.MeshBasicMaterial({ color: "#fff1a8", transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false });
  const beams = new THREE.Group(); g.add(beams);
  for (let i = 0; i < 6; i++) { const b = add(beams, new THREE.CylinderGeometry(2.6, 2.6, 100, 12, 1, true), beamMat, -42 + i * 17, 112, (i % 2 ? 10 : -10)); }
  // gases through the air gaps between the columns
  const NGAS = 36, co2 = inst(new THREE.IcosahedronGeometry(0.75, 1), new THREE.MeshBasicMaterial({ color: "#64748b" }), NGAS, g), o2 = inst(new THREE.IcosahedronGeometry(0.7, 1), new THREE.MeshBasicMaterial({ color: "#7df9ff" }), NGAS, g);
  co2.userData.clayColor = "#b8aebd"; o2.userData.clayColor = "#92d3cf";
  const gas = Array.from({ length: NGAS }, (_, i) => ({ u: hash(i * 2.7), gx: (Math.floor(hash(i * 5.3) * 4) - 1.5) * SP, gz: (Math.floor(hash(i * 8.1) * 2) - 0.5) * SP + (hash(i) > 0.5 ? 0 : 0) }));
  function update(dt, t, active) {
    const st = C.palisadeState(S.light, S.co2, S.avoid);
    ms.photoRate = st.rate; ms.photoLight = S.light;
    if (st.rate >= 90 && S.light <= 0.85) ms.photo90 = true;
    S.k += (st.avoid - S.k) * clamp(dt * 1.2, 0, 1);
    const k = S.k;
    // chloroplasts glide between the two layouts, jostling slightly
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      const x = lerp(s.face.x, s.side.x, k), y = lerp(s.face.y, s.side.y, k), z = lerp(s.face.z, s.side.z, k);
      const wob = Math.sin(t * 0.8 + s.ph) * 0.35;
      _rd.set(x, 0, z).normalize();
      _qs.setFromUnitVectors(_yy, _rd.lengthSq() ? _rd : _yy); _qi.identity().slerp(_qs, smooth(k, 0, 1));
      _p.set(s.cx + x + wob, y + wob * 0.5, s.cz + z); _s.set(2.7, 1.1, 2.7); _m.compose(_p, _qi, _s); chl.setMatrixAt(i, _m);
    }
    upd(chl);
    // photons
    const nph = Math.round(NPH * S.light), absorbedY = 46;
    for (let i = 0; i < NPH; i++) {
      const p = phd[i]; p.u = (p.u + dt * 0.5 * p.v) % 1;
      const y = lerp(150, 6, p.u);
      setI(ph, i, p.x, y, p.z, i < nph ? (y < 52 && Math.abs((p.x % SP) - 0) > 0 ? 0.9 : 1) : 0);
    }
    upd(ph);
    beamMat.opacity = 0.01 + 0.07 * S.light;
    // gases: CO2 in (down the gaps and out to the walls), O2 out (up and away)
    const ng = Math.round(NGAS * clamp(st.rate / 100, 0, 1) * (S.co2 > 0.2 ? 1 : 0.5));
    for (let i = 0; i < NGAS; i++) {
      const p = gas[i]; if (i < ng) p.u = (p.u + dt * 0.18 * (0.3 + 0.7 * st.rate / 100)) % 1;
      const yC = lerp(-62, 12, p.u), yO = lerp(14, -64, p.u);
      setI(co2, i, p.gx + 0.0, yC, p.gz, i < ng ? 1 : 0); setI(o2, i, p.gx + SP * 0.0 + 1.1, yO, p.gz + 1.1, i < ng ? 1 : 0);
    }
    upd(co2); upd(o2);
  }
  const heroSlot = slots.findIndex((s) => s.hero);
  const chloroWorld = (out) => { const s = slots[heroSlot]; g.updateWorldMatrix(true, false); return out.set(s.cx + lerp(s.face.x, s.side.x, S.k), lerp(s.face.y, s.side.y, S.k), s.cz + lerp(s.face.z, s.side.z, S.k)).applyMatrix4(g.matrixWorld); };
  function chips() {
    const st = C.palisadeState(S.light, S.co2, S.avoid), y7 = X.lens.band === "y7-8";
    return [`<i class="dot" style="background:#4ade80"></i>${y7 ? "Food-making speed" : "Photosynthesis rate"} <b>${Math.round(st.rate)} %</b>`,
      `<i class="dot" style="background:#ffe066"></i>Light <b>${Math.round(S.light * 100)} %</b>`,
      `<i class="dot" style="background:#7df9ff"></i>${y7 ? "Oxygen made" : "O₂ released"} <b>${Math.round(st.o2)} %</b>`];
  }
  function controls(el) {
    const y7 = X.lens.band === "y7-8";
    K.slider(el, { label: "Light intensity", min: 0, max: 100, value: Math.round(S.light * 100), unit: " %", onInput: (v) => { S.light = v / 100; X.refresh(); } });
    if (!y7) K.slider(el, { label: "Carbon dioxide supply", min: 20, max: 100, value: Math.round(S.co2 * 100), unit: " %", onInput: (v) => { S.co2 = v / 100; X.refresh(); } });
    if (X.lens.atLeast("y11")) K.checkbox(el, "Chloroplasts move away from strong light", S.avoid, (v) => { S.avoid = v; X.refresh(); });
    const r = K.buttonRow(el);
    K.button(r, "Zoom into a chloroplast ▸", () => X.dive({ to: "chloroplast", label: "Chloroplast", radius: 3.2, center: () => chloroWorld(new THREE.Vector3()), object: chl }));
    el.insertAdjacentHTML("beforeend", `<p class="hint">${y7 ? "Turn the light up and down. Does the food-making keep rising for ever?" : "The rate is a percentage of the maximum. It levels off when another factor (CO₂ here, or temperature) becomes limiting. In very bright light chloroplasts can move to the side walls."}</p>`);
  }
  const views = [
    { label: "The leaf layer", x: 0, y: 0, z: 0, w: 150, h: 150 },
    { label: "One palisade cell", x: 0, y: 4, z: 0, w: 34, h: 100 },
    { label: "Chloroplasts", x: 0, y: 30, z: 0, w: 30, h: 22 },
  ];
  const anchors = [
    { p: () => V3(0, 66, 0), t: { "y7-8": "Waxy top surface", "y9-10": "Cuticle + upper epidermis" } },
    { p: () => V3(-12, 0, 10), t: { "y7-8": "Tall cell", "y9-10": "Tall palisade cell" } },
    { p: () => V3(8, 44, 8), t: { "y7-8": "Chloroplasts (green)", "y9-10": "Chloroplasts (many)" } },
    { p: () => V3(-1, -8, 0), t: { "y7-8": "Big water space", "y9-10": "Large vacuole" } },
    { p: () => V3(-10.25, -64, 0), t: { "y7-8": "Air gaps", "y9-10": "Air spaces (gas exchange)" } },
  ];
  return { g, hit: [140, 150, 80], view: views[0], anchors, views, update, chips, controls, narr: () => ({ light: S.light, co2: S.co2, avoid: S.avoid }), focus: () => views[0], live: true, chloroWorld };
}

// ---------- 8. Guard cells ----------
function buildGuard(X) {
  const { S, ms } = X, M = mats();
  const model = (S.model ||= new C.GuardModel());
  Object.assign(S, { prevOpen: model.open, flux: 0 });
  const g = new THREE.Group();
  g.add(makePlinth(50, -14));
  const LH = 15;
  // surrounding epidermal cells: slabs whose inner edge hugs the guard-cell pair
  const wedge = (i, n) => {
    const a0 = (i / n) * TAU + 0.07, a1 = ((i + 1) / n) * TAU - 0.07, pts = [];
    const ri = (th) => 1 / Math.sqrt((Math.cos(th) / 21) ** 2 + (Math.sin(th) / 13.5) ** 2);
    for (let k = 0; k <= 6; k++) { const th = lerp(a0, a1, k / 6), r = ri(th); pts.push([Math.cos(th) * r, Math.sin(th) * r]); }
    for (let k = 6; k >= 0; k--) { const th = lerp(a0, a1, k / 6), r = 36 + hash(i * 3 + k * 0.5) * 9; pts.push([Math.cos(th) * r, Math.sin(th) * r]); }
    return slabGeometry(pts, null, 12, 0.8);
  };
  for (let i = 0; i < 8; i++) { const m = add(g, wedge(i, 8), M.wallGreen, 0, -12, 0); m.userData.clayColor = i % 2 ? "#a6ddc2" : "#92d3cf"; }
  // the dark space below the pore (the substomatal cavity)
  const floor = add(g, new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color: "#0a2a2e" }), 0, -11.8, 0); floor.rotation.x = -Math.PI / 2; floor.scale.set(20, 11, 1); floor.userData.clayColor = "#6a8f86";
  // guard cells: tubes rebuilt every frame so they bow apart as turgor rises
  const NR = 44, RAD = 14;
  const mk = () => { const pos = new Float32Array((NR + 1) * (RAD + 1) * 3), nor = new Float32Array(pos.length), idx = []; for (let i = 0; i < NR; i++) for (let j = 0; j < RAD; j++) { const a = i * (RAD + 1) + j, b = (i + 1) * (RAD + 1) + j; idx.push(a, b, a + 1, b, b + 1, a + 1); } const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage)); geo.setIndex(idx); return geo; };
  const cellMat = glass("#7be39a", { rim: "#e6ffee", rimPower: 2.0, rimStrength: 0.6, minAlpha: 0.14, maxAlpha: 0.66 });
  const wallMat = physical("#a49873", { roughness: 0.55, clearcoat: 0.05, sheen: 0 });
  const vacMat = glass("#9bd1ff", { rim: "#e6f4ff", minAlpha: 0.1, maxAlpha: 0.45 });
  const parts = [];
  for (const sg of [-1, 1]) {
    const cg = mk(), wg = mk(), vg = mk();
    const c = new THREE.Mesh(cg, cellMat), w = new THREE.Mesh(wg, wallMat), v = new THREE.Mesh(vg, vacMat);
    for (const m of [c, w, v]) { m.frustumCulled = false; g.add(m); }
    c.userData.clayColor = "#a6ddc2"; w.userData.clayColor = "#f4e3b8"; v.userData.clayColor = "#bcd9ee"; v.userData.clayOpacity = 0.3;
    parts.push({ sg, cg, wg, vg });
  }
  function fillTube(geo, sg, rW, rH, base, offIn, endTaper = true) {
    const P = geo.attributes.position.array, N = geo.attributes.normal.array;
    const pore = model.pore;
    let o = 0;
    for (let i = 0; i <= NR; i++) {
      const u = i / NR, x = (u * 2 - 1) * LH, d = (x / LH) ** 2;
      const zc = sg * (base + (pore / 2) * (1 - d)) - sg * offIn;
      const dz = sg * (pore / 2) * (-2 * x / (LH * LH)), L = Math.hypot(1, dz), nx = -dz / L, nz = 1 / L;
      const e = endTaper ? Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(u * 2 - 1), 9))) : 1;
      for (let j = 0; j <= RAD; j++) {
        const a = (j / RAD) * TAU, c = Math.cos(a), s = Math.sin(a);
        P[o] = x + c * nx * rW * e; P[o + 1] = s * rH * e; P[o + 2] = zc + c * nz * rW * e;
        let n0 = c * nx, n1 = s * (rW / rH), n2 = c * nz; const l = Math.hypot(n0, n1, n2) || 1;
        N[o] = n0 / l; N[o + 1] = n1 / l; N[o + 2] = n2 / l; o += 3;
      }
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.normal.needsUpdate = true;
  }
  // chloroplasts, nuclei, K+ and water in each cell
  const NCH = 7, chl = inst(new THREE.SphereGeometry(1, 12, 8), M.chloro, NCH * 2, g);
  const nuc = inst(new THREE.SphereGeometry(1, 16, 12), M.nucleus, 2, g);
  const NK = 26, kMesh = inst(new THREE.IcosahedronGeometry(0.42, 1), physical("#a78bfa", { roughness: 0.3, emissive: col("#6d28d9"), emissiveIntensity: 0.6 }), NK * 2, g);
  const NW = 22, wMesh = inst(new THREE.IcosahedronGeometry(0.4, 1), new THREE.MeshBasicMaterial({ color: "#7dd3fc" }), NW * 2, g);
  wMesh.userData.clayColor = "#8fbdea";
  const kd = Array.from({ length: NK }, (_, i) => ({ u: 0.06 + hash(i * 2.3) * 0.88, a: hash(i * 4.1) * TAU, r: 0.15 + hash(i * 6.7) * 0.6 }));
  const wd = Array.from({ length: NW }, (_, i) => ({ u: 0.06 + hash(i * 3.3) * 0.88, a: hash(i * 5.9) * TAU, t: hash(i * 7.1) }));
  const cp = (sg, u, a, rr, rw, rh, pore, out = _p) => {
    const x = (u * 2 - 1) * LH, d = (x / LH) ** 2, zc = sg * (rw + (pore / 2) * (1 - d));
    return out.set(x, Math.sin(a) * rr * rh, zc + Math.cos(a) * rr * rw);
  };
  // gas through the pore: CO2 in, water vapour out
  const NGP = 18, gCo2 = inst(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshBasicMaterial({ color: "#475569" }), NGP, g), gH2O = inst(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshBasicMaterial({ color: "#a5f3fc" }), NGP, g);
  gCo2.userData.clayColor = "#b8aebd"; gH2O.userData.clayColor = "#92d3cf";
  const gp = Array.from({ length: NGP }, (_, i) => ({ u: hash(i * 2.1), x: (hash(i * 5.7) - 0.5) * 20, z: (hash(i * 3.3) - 0.5) }));
  function update(dt, t, active) {
    model.light = S.light ?? model.light; model.water = S.water ?? model.water;
    model.step(dt);
    ms.stomaOpen = ms.stomaOpen || model.openSeen && model.open >= 0.8; if (model.closedByDrought) ms.stomaDrought = true;
    const open = model.open, pore = model.pore, rW = 3.9 * (0.9 + 0.2 * open), rH = 5.0 * (0.92 + 0.18 * open);
    for (const p of parts) { fillTube(p.cg, p.sg, rW, rH, rW, 0); fillTube(p.wg, p.sg, 1.25, 1.45, rW, rW - 1.15, true); fillTube(p.vg, p.sg, rW * 0.64, rH * 0.62, rW, 0); }
    // contents
    let ci = 0;
    for (const sg of [-1, 1]) {
      for (let k = 0; k < NCH; k++) { const u = 0.1 + (k / (NCH - 1)) * 0.8, a = k * 2.2 + (sg > 0 ? 0 : 1), pp = cp(sg, u, a, 0.74, rW, rH, pore); setI(chl, ci++, pp.x, pp.y, pp.z, 1.5, 0.75, 1.5, 0, 0, a); }
    }
    upd(chl);
    for (const [i, sg] of [-1, 1].entries()) { const pp = cp(sg, 0.5, 0, 0.58, rW, rH, pore); setI(nuc, i, pp.x, pp.y + 0.1, pp.z + sg * 0.6, 1.9, 1.6, 2.1); }
    upd(nuc);
    const nk = Math.round(NK * clamp(model.K / 0.98, 0, 1));
    for (const [si, sg] of [-1, 1].entries()) for (let i = 0; i < NK; i++) { const q = kd[i], pp = cp(sg, q.u, q.a + t * 0.4, q.r, rW, rH, pore); const j = Math.sin(t * 2 + i) * 0.1; setI(kMesh, si * NK + i, pp.x + j, pp.y, pp.z + j, i < nk ? 1 : 0); }
    upd(kMesh);
    // water: in while the cells are swelling, out while they shrink
    S.flux += (clamp((open - S.prevOpen) / Math.max(dt, 1e-3) * 0.35, -1, 1) - S.flux) * clamp(dt * 4, 0, 1); S.prevOpen = open;
    const fl = Math.abs(S.flux), dir = S.flux >= 0 ? 1 : -1;
    for (const [si, sg] of [-1, 1].entries()) for (let i = 0; i < NW; i++) {
      const q = wd[i]; if (fl > 0.04) q.t = (q.t + dt * 0.9 * dir + 1) % 1;
      const rr = lerp(1.7, 0.2, q.t), pp = cp(sg, q.u, q.a, rr, rW, rH, pore);
      setI(wMesh, si * NW + i, pp.x, pp.y, pp.z, fl > 0.04 && i < Math.round(NW * clamp(fl * 1.6, 0, 1)) ? 1 : 0);
    }
    upd(wMesh);
    // gas through the pore
    const ng = Math.round(NGP * open);
    for (let i = 0; i < NGP; i++) {
      const q = gp[i]; if (i < ng) q.u = (q.u + dt * 0.35) % 1;
      const wz = Math.max(0.3, pore / 2 - 0.5), y = lerp(12, -9, q.u), y2 = lerp(-9, 12, q.u);
      const px = q.x * 0.5 * Math.min(1, 0.5 + pore / 8);
      setI(gCo2, i, px, y, q.z * wz * 1.6, i < ng ? 1 : 0); setI(gH2O, i, px + 1.2, y2, -q.z * wz * 1.6, i < ng ? 1 : 0);
    }
    upd(gCo2); upd(gH2O);
  }
  function chips() {
    const y7 = X.lens.band === "y7-8";
    const out = [`<i class="dot" style="background:#86efac"></i>${y7 ? "Pore open" : "Stoma open"} <b>${Math.round(model.open * 100)} %</b>`];
    if (!y7) out.push(`<i class="dot" style="background:#7dd3fc"></i>Turgor <b>${model.P.toFixed(2)} MPa</b>`, `<i class="dot" style="background:#a78bfa"></i>K⁺ in guard cells <b>${Math.round(model.K * 100)} %</b>`);
    out.push(`<i class="dot" style="background:#a5f3fc"></i>${y7 ? "Water escaping" : "Water vapour out"} <b>${Math.round(model.waterLoss * 100)} %</b>`);
    return out;
  }
  function controls(el) {
    const y7 = X.lens.band === "y7-8";
    K.slider(el, { label: y7 ? "Light on the leaf" : "Light (blue light)", min: 0, max: 100, value: Math.round(model.light * 100), unit: " %", onInput: (v) => { S.light = v / 100; X.refresh(); } });
    K.slider(el, { label: y7 ? "Water in the leaf (drought ↔ plenty)" : "Leaf water supply", min: 10, max: 100, value: Math.round(model.water * 100), unit: " %", onInput: (v) => { S.water = v / 100; X.refresh(); } });
    el.insertAdjacentHTML("beforeend", `<p class="hint">${y7 ? "Give the leaf light, then take the water away. Watch the pore." : "Time is sped up: guard cells really take minutes to respond. K⁺ uptake raises turgor; drought hormone (ABA) makes K⁺ leave."}</p>`);
  }
  const views = [
    { label: "Stoma from above", x: 0, y: 0, z: 0, w: 62, h: 46, dir: V3(0.12, 1.15, 0.6) },
    { label: "Inside a guard cell", x: 0, y: 0, z: 6, w: 34, h: 24, dir: V3(0.1, 0.8, 0.7) },
    { label: "Side view", x: 0, y: -2, z: 0, w: 80, h: 40, dir: V3(0.05, 0.25, 1) },
  ];
  const anchors = [
    { p: () => V3(0, 6, 0), t: { "y7-8": "Pore (stoma)", "y9-10": "Stoma (pore)" } },
    { p: () => V3(-14, 4, 10), t: { "y7-8": "A guard cell", "y9-10": "Guard cell" } },
    { p: () => V3(0, 5, -7), t: { "y7-8": "Thicker wall", "y9-10": "Thicker inner wall" } },
    { p: () => V3(-1, 5, 14), t: { "y9-10": "Chloroplasts" }, show: () => X.lens.atLeast("y9-10") },
    { p: () => V3(-30, 0, 18), t: { "y9-10": "Ordinary epidermal cells" }, show: () => X.lens.atLeast("y9-10") },
  ];
  return { g, hit: [120, 40, 120], view: views[0], anchors, views, update, chips, controls, narr: () => ({ model }), focus: () => views[0], live: true };
}

// ---------- 9. Xylem vessel element ----------
function buildXylem(X) {
  const { S, ms } = X, M = mats();
  Object.assign(S, { d: 30, tension: 0.7, bubble: false });
  const g = new THREE.Group();
  g.add(makePlinth(84, -106));
  const main = new THREE.Group(); g.add(main);
  const wallMat = gl("#e7cf9d", "#fff3d1", { minAlpha: 0.07, maxAlpha: 0.5 });
  const lignin = physical("#b8843f", { roughness: 0.4, clearcoat: 0.5 });
  lignin.userData.clayColor = "#f8c29d";
  const R0 = 15, EL = 100;
  const helix = (y0) => new THREE.CatmullRomCurve3(Array.from({ length: 160 }, (_, i) => { const u = i / 159, a = u * 15 * TAU; return V3(Math.cos(a) * (R0 - 0.5), y0 + u * EL, Math.sin(a) * (R0 - 0.5)); }));
  const els = [];
  for (const y0 of [-98, 2]) {
    const tubeW = add(main, new THREE.CylinderGeometry(R0, R0, EL, 40, 1, true), wallMat, 0, y0 + EL / 2, 0);
    tubeW.userData.clayColor = "#f4e3b8"; tubeW.userData.clayOpacity = 0.35;
    add(main, new THREE.TubeGeometry(helix(y0), 220, 1.0, 8), lignin);
    els.push(tubeW);
  }
  // perforation plate where the end walls were: a rim with a few remnant bars
  const rimM = physical("#b8843f", { roughness: 0.4 });
  const rim = add(main, new THREE.TorusGeometry(R0 - 0.2, 1.3, 8, 40), rimM, 0, 0, 0); rim.rotation.x = Math.PI / 2; rim.userData.clayColor = "#f8c29d";
  for (let i = 0; i < 3; i++) { const b = add(main, new THREE.BoxGeometry(R0 * 2 - 2, 0.9, 1.2), rimM, 0, 0, 0); b.rotation.y = (i / 3) * Math.PI + 0.3; b.userData.clayColor = "#f8c29d"; b.scale.x = 0.55 + 0.25 * i; b.position.set((i - 1) * 3.5, 0, (1 - i) * 2); }
  // bordered pits, and the neighbouring vessel (water can bypass a blocked vessel through them)
  const NPIT = 26, pits = inst(new THREE.SphereGeometry(1, 12, 8), physical("#f6e8c3", { roughness: 0.5 }), NPIT, main);
  for (let i = 0; i < NPIT; i++) { const a = hash(i * 3.3) * 2.2 - 1.1, y = -90 + hash(i * 5.1) * 180; setI(pits, i, Math.cos(a) * R0, y, Math.sin(a) * R0, 0.9, 1.9, 0.5, 0, a, 0); }
  upd(pits);
  const nb = new THREE.Group(); nb.position.set(36, 0, -3); g.add(nb);
  for (const y0 of [-98, 2]) { const t = add(nb, new THREE.CylinderGeometry(11, 11, EL, 32, 1, true), wallMat, 0, y0 + EL / 2, 0); t.userData.clayOpacity = 0.35; t.userData.clayColor = "#f4e3b8"; }
  add(nb, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 140 }, (_, i) => { const u = i / 139, a = u * 22 * TAU; return V3(Math.cos(a) * 10.6, -98 + u * 200, Math.sin(a) * 10.6); })), 300, 0.7, 6), lignin);
  // living neighbours (parenchyma), for context
  const par = inst(blob(1, 1, 1, 0.1, 5, 3), M.wallGreen, 8, g);
  for (let i = 0; i < 8; i++) { const r = 11 + hash(i * 4) * 6; setI(par, i, -38 - hash(i * 3) * 8, -80 + i * 24, (hash(i * 7) - 0.5) * 22, r * 0.8, r * 1.1, r * 0.8); } upd(par); par.userData.clayColor = "#d9e5a4";
  // water: moves up as a continuous column; an air bubble blocks it
  const NW = 80, wm = inst(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: "#7dd3fc" }), NW, main);
  wm.userData.clayColor = "#8fbdea";
  const wd = Array.from({ length: NW }, (_, i) => ({ y: -98 + hash(i * 1.9) * 196, a: hash(i * 7.7) * TAU, r: Math.sqrt(hash(i * 3.1)) * 0.82 }));
  const NNW = 36, wn = inst(new THREE.IcosahedronGeometry(0.9, 1), new THREE.MeshBasicMaterial({ color: "#7dd3fc" }), NNW, nb);
  wn.userData.clayColor = "#8fbdea";
  const wnd = Array.from({ length: NNW }, (_, i) => ({ y: -98 + hash(i * 2.3) * 196, a: hash(i * 6.1) * TAU, r: Math.sqrt(hash(i * 4.1)) * 0.8 }));
  const bubble = add(main, new THREE.SphereGeometry(1, 28, 20), glass("#ffffff", { rim: "#ffffff", rimPower: 1.5, rimStrength: 1.0, minAlpha: 0.25, maxAlpha: 0.95 }), 0, 32, 0);
  bubble.userData.clayColor = "#fffaf0"; bubble.visible = false;
  function update(dt, t, active) {
    const st = C.xylemState(S.d, S.tension, S.bubble);
    ms.xylemFlow = st.flow;
    const sc = S.d / 30;                                          // geometry was built for a 30 µm vessel
    main.scale.set(sc, 1, sc);
    bubble.visible = S.bubble; bubble.scale.set(R0 * 0.93, 22, R0 * 0.93);
    const v = st.flow > 0 ? 5 + 9 * Math.log10(1 + 20 * st.flow) : 0;
    const bY = 32;
    for (let i = 0; i < NW; i++) {
      const w = wd[i];
      if (S.bubble) { if (w.y < bY - 24 && S.tension > 0) w.y = Math.min(w.y + dt * 3, bY - 24 - (i % 5) * 1.8); }   // water below the bubble only creeps up to it while there is pull
      else w.y += v * dt;
      if (w.y > 100) w.y = -100;
      const hidden = S.bubble && Math.abs(w.y - bY) < 23;
      setI(wm, i, Math.cos(w.a) * w.r * R0, w.y, Math.sin(w.a) * w.r * R0, hidden ? 0 : 0.95);
    }
    upd(wm);
    const vn = st.flowNb > 0 ? 5 + 9 * Math.log10(1 + 20 * st.flowNb) : 0;     // same flow model as the main vessel: zero when there is no pull
    for (let i = 0; i < NNW; i++) { const w = wnd[i]; w.y += vn * dt; if (w.y > 100) w.y = -100; setI(wn, i, Math.cos(w.a) * w.r * 11, w.y, Math.sin(w.a) * w.r * 11, 1); }
    upd(wn);
  }
  function chips() {
    const st = C.xylemState(S.d, S.tension, S.bubble);
    return [`<i class="dot" style="background:#7dd3fc"></i>Flow (20 µm vessel = 1) <b>${st.flow < 10 ? st.flow.toFixed(2) : Math.round(st.flow)}</b>`, `<i class="dot" style="background:#d6b98c"></i>Vessel width <b>${S.d} µm</b>`, `<i class="dot" style="background:#ffffff"></i>Air bubble <b>${S.bubble ? "yes: blocked" : "no"}</b>`];
  }
  function controls(el) {
    K.slider(el, { label: "Vessel width", min: 10, max: 70, step: 1, value: S.d, unit: " µm", onInput: (v) => { S.d = v; X.refresh(); } });
    K.slider(el, { label: "Pull from the leaves (transpiration)", min: 0, max: 100, value: Math.round(S.tension * 100), unit: " %", onInput: (v) => { S.tension = v / 100; X.refresh(); } });
    K.checkbox(el, "Let an air bubble in (embolism)", S.bubble, (v) => { S.bubble = v; X.refresh(); });
    el.insertAdjacentHTML("beforeend", `<p class="hint">Flow depends on the fourth power of the radius (Hagen–Poiseuille), so a vessel twice as wide carries about 16 times the water. Water bypasses a blocked vessel through pits.</p>`);
  }
  const views = [
    { label: "Two vessel elements", x: 18, y: 0, z: 0, w: 120, h: 250 },
    { label: "Perforation plate", x: 0, y: 0, z: 0, w: 50, h: 40 },
    { label: "Lignified wall", x: 0, y: -50, z: 8, w: 50, h: 50 },
  ];
  const anchors = [
    { p: () => V3(S.d / 2 + 6, 60, 0), t: { "y9-10": "Hollow tube (no cell contents)" } },
    { p: () => V3(-S.d / 2 - 6, -50, 0), t: { "y9-10": "Lignin rings (strong, waterproof)" } },
    { p: () => V3(S.d / 2 + 4, 0, 4), t: { "y9-10": "Open end wall (perforation plate)" } },
    { p: () => V3(S.d / 2 + 10, -70, 0), t: { "y11": "Pits link vessels" }, show: () => X.lens.atLeast("y11") },
  ];
  return { g, hit: [170, 240, 70], view: views[0], anchors, views, update, chips, controls, narr: () => ({ d: S.d, tension: S.tension, bubble: S.bubble }), focus: () => views[0], live: true };
}

// =====================================================================================================================
// The zoom-out ladder: simplified, illustrated (not to scale) scenes for tissue, organ, organ system and organism.
// Each builder returns { g, w, h, anchors: [{ p: Vector3, t: {band: text} }], update?(t) }.
// =====================================================================================================================
const H = {};                                                // lazily created shared pieces
function hm() {
  if (H.ready) return H;
  const M = mats();
  Object.assign(H, {
    ready: true,
    skin: gl("#8fd3ff", "#e1f4ff", { minAlpha: 0.04, maxAlpha: 0.34 }),
    skinSolid: physical("#e7b9a0", { roughness: 0.5, clearcoat: 0.4 }),
    skinGhost: gl("#9cd6ff", "#e8f6ff", { minAlpha: 0.05, maxAlpha: 0.42 }),
    muscle: physical("#c23a46", { roughness: 0.4, clearcoat: 0.7, emissive: col("#5a0f1a"), emissiveIntensity: 0.25 }),
    muscleHi: physical("#ff4d5e", { roughness: 0.35, clearcoat: 0.8, emissive: col("#b3122a"), emissiveIntensity: 0.55 }),
    bone: physical("#e6dcc2", { roughness: 0.55, clearcoat: 0.1, sheen: 0 }),
    nerve: physical("#ffd166", { roughness: 0.3, emissive: col("#d98a00"), emissiveIntensity: 0.55 }),
    brain: physical("#d58fb4", { roughness: 0.5, clearcoat: 0.25, sheen: 0, emissive: col("#6b1d52"), emissiveIntensity: 0.15 }),
    lung: physical("#f3a0a6", { roughness: 0.45, clearcoat: 0.5 }),
    leaf: physical("#43b05a", { roughness: 0.4, clearcoat: 0.5, side: THREE.DoubleSide }),
    leafVein: physical("#a4e0a0", { roughness: 0.4 }),
    stem: physical("#6aa84f", { roughness: 0.5, clearcoat: 0.3 }),
    root: physical("#cdb17a", { roughness: 0.75, clearcoat: 0, sheen: 0 }),
    soil: physical("#5a4838", { roughness: 0.95, clearcoat: 0, sheen: 0 }),
    tendon: physical("#e9e2cf", { roughness: 0.45, clearcoat: 0.15, sheen: 0 }),
    vein: physical("#4d7cff", { roughness: 0.3 }),
    artery: physical("#ff5a5a", { roughness: 0.3 }),
    xyl: physical("#c79a5a", { roughness: 0.4 }),
    glia: physical("#5eead4", { roughness: 0.4, emissive: col("#0f766e"), emissiveIntensity: 0.3 }),
    heroRing: new THREE.MeshBasicMaterial({ color: "#ffe066", transparent: true, opacity: 0.8, depthWrite: false }),
  });
  H.heroRing.userData.clayHide = true;
  return H;
}
/** a capsule from point a to point b */
const UPV = new THREE.Vector3(0, 1, 0);
function seg(parent, a, b, r, mat, sx = 1, sz = 1) {
  const d = b.clone().sub(a), L = d.length();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, L - 2 * r), 6, 14), mat);
  m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(UPV, d.normalize()); m.scale.set(sx, 1, sz);
  parent.add(m); return m;
}
/** an ellipsoid stretched between a and b (a muscle belly) */
function belly(parent, a, b, r, mat, sz = 1) {
  const d = b.clone().sub(a), L = d.length();
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 16), mat);
  m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(UPV, d.normalize()); m.scale.set(r, L / 2, r * sz);
  parent.add(m); return m;
}
/** a leaf blade (ovate with a pointed tip) as a thin extrusion in the x-y plane, pointing along +y, plus veins */
function leafBlade(len = 40, wid = 22, mat) {
  const S = hm(), g = new THREE.Group();
  const sh = new THREE.Shape();
  sh.moveTo(0, 0); sh.bezierCurveTo(wid * 0.95, len * 0.1, wid * 0.8, len * 0.66, 0, len); sh.bezierCurveTo(-wid * 0.8, len * 0.66, -wid * 0.95, len * 0.1, 0, 0);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.7, bevelEnabled: true, bevelSize: 0.35, bevelThickness: 0.3, bevelSegments: 2, curveSegments: 20 });
  geo.translate(0, 0, -0.35);
  const m = new THREE.Mesh(geo, mat || S.leaf); g.add(m);
  const veins = [taperedTube(new THREE.CatmullRomCurve3([V3(0, 0, 0.45), V3(0, len * 0.5, 0.45), V3(0, len * 0.96, 0.45)]), (u) => lerp(0.75, 0.15, u), 16, 6)];
  for (let k = 0; k < 6; k++) for (const sg of [-1, 1]) {
    const y0 = len * (0.1 + k * 0.125), c = new THREE.CatmullRomCurve3([V3(0, y0, 0.45), V3(sg * wid * 0.32, y0 + len * 0.06, 0.45), V3(sg * wid * (0.66 - k * 0.07), y0 + len * 0.17, 0.45)]);
    veins.push(taperedTube(c, (u) => lerp(0.34, 0.08, u), 8, 5));
  }
  const vm = new THREE.Mesh(mergeGeometries(veins), S.leafVein); g.add(vm);
  return g;
}
/** a soft translucent soil slab with grains, cut away at the front */
function soilBlock(w, d, h, y) {
  const S = hm(), g = new THREE.Group(), rng = mulberry32(3);
  const slab = add(g, new THREE.BoxGeometry(w, h, d), gl("#9b7a5c", "#e8cfae", { minAlpha: 0.18, maxAlpha: 0.55 }), 0, 0, 0);
  slab.userData.clayColor = "#d8c7b3";
  const n = 60, gr = inst(new THREE.IcosahedronGeometry(1, 1), physical("#ffffff", { roughness: 0.95, clearcoat: 0, sheen: 0 }), n, g);
  gr.userData.lod = true;
  const cs = ["#5e4b3b", "#4c4036", "#6d5a46", "#585550"];
  for (let i = 0; i < n; i++) { const r = 0.6 + rng() * 1.5; setI(gr, i, (rng() - 0.5) * (w - 4), (rng() - 0.5) * (h - 3), d * 0.5 - 1.2 - rng() * 3, r, r * 0.8, r, rng() * 3, rng() * 3, 0); gr.setColorAt(i, _c.set(cs[i % cs.length])); }
  upd(gr); gr.instanceColor.needsUpdate = true;
  g.position.y = y; return g;
}
/** a standing human in a glassy skin; muscles, nerves or the respiratory tract can be drawn inside */
function humanFigure(show) {
  const S = hm(), g = new THREE.Group();
  const skin = show.solid ? S.skinSolid : S.skinGhost;
  const P = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  // torso: shoulders, chest, waist, hips (a lathe squashed front to back)
  const tpts = [[0, -12], [7.6, -12], [9.4, -6], [8.6, 4], [9.6, 16], [12.6, 28], [13.2, 33], [8, 37.5], [0, 38.5]];
  const torso = add(g, lathe(tpts, 36), skin); torso.scale.set(1, 1, 0.58);
  add(g, new THREE.CylinderGeometry(3, 3.5, 8, 16), skin, 0, 40, 0);
  add(g, new THREE.SphereGeometry(7, 32, 22), skin, 0, 49.5, 0.4).scale.set(0.92, 1.08, 1);
  const sh = (s) => P(s * 14.2, 32.5, 0), el = (s) => P(s * 18.6, 14, 1.2), wr = (s) => P(s * 20.4, -2.5, 3), hp = (s) => P(s * 6.2, -9, 0), kn = (s) => P(s * 7, -35.5, 1.4), an = (s) => P(s * 7.6, -61, 0);
  for (const s of [-1, 1]) {
    add(g, new THREE.SphereGeometry(4, 18, 14), skin, ...sh(s).toArray());
    seg(g, sh(s), el(s), 3.2, skin); add(g, new THREE.SphereGeometry(2.8, 14, 10), skin, ...el(s).toArray());
    seg(g, el(s), wr(s), 2.6, skin); add(g, new THREE.SphereGeometry(2.2, 14, 10), skin, wr(s).x + s * 0.5, wr(s).y - 3.2, wr(s).z + 0.6);
    seg(g, hp(s), kn(s), 5, skin); add(g, new THREE.SphereGeometry(4.2, 14, 10), skin, ...kn(s).toArray());
    seg(g, kn(s), an(s), 3.6, skin); add(g, new THREE.SphereGeometry(3.5, 14, 10), skin, an(s).x, an(s).y - 0.5, an(s).z + 2).scale.set(0.9, 0.6, 1.5);
  }
  if (show.bones || show.muscles) {
    const spine = []; for (let i = 0; i < 13; i++) spine.push(new THREE.SphereGeometry(1.15, 10, 8).translate(0, -8 + i * 3.4, -2.8).toNonIndexed());
    g.add(new THREE.Mesh(mergeGeometries(spine), S.bone));
    add(g, new THREE.SphereGeometry(5.2, 22, 16), S.bone, 0, 49.5, 0.3).scale.set(0.92, 1.1, 1);
    for (let r = 0; r < 6; r++) { const rib = add(g, new THREE.TorusGeometry(1, 0.2, 6, 28, Math.PI * 1.55), S.bone, 0, 31 - r * 3.0, -0.6); rib.rotation.set(Math.PI / 2, 0, Math.PI * 1.22); rib.scale.set(10.2 - Math.abs(r - 2) * 0.8, 6.0, 1); }
    add(g, new THREE.BoxGeometry(18, 3, 6), S.bone, 0, -10, -1).userData.clayColor = "#f4e3b8";
    for (const s of [-1, 1]) { seg(g, sh(s), el(s), 1.0, S.bone); seg(g, el(s), wr(s), 0.85, S.bone); seg(g, hp(s), kn(s), 1.5, S.bone); seg(g, kn(s), an(s), 1.2, S.bone); seg(g, P(s * 1.6, 33, 0.8), sh(s), 0.8, S.bone); }
  }
  if (show.muscles) {
    for (const s of [-1, 1]) {
      const bi = s > 0 && show.biceps, m = bi ? S.muscleHi : S.muscle;
      belly(g, P(s * 15, 30, 2.6), P(s * 18.2, 17, 3.2), 3.0, m, 0.9);                       // biceps
      belly(g, P(s * 14.8, 30, -2.6), P(s * 18.4, 16, -2.9), 2.5, S.muscle, 0.9);              // triceps
      belly(g, el(s).clone().add(P(0.3, 0.5, 1)), wr(s).clone().add(P(0, 3, 1)), 2.3, S.muscle, 0.9);
      add(g, new THREE.SphereGeometry(4.6, 22, 16), S.muscle, ...sh(s).clone().add(P(s * 0.8, -0.5, 0)).toArray());   // deltoid
      belly(g, hp(s).clone().add(P(0, 0, 2.5)), kn(s).clone().add(P(0, 3, 2.7)), 4.6, S.muscle, 0.9);   // quadriceps
      belly(g, hp(s).clone().add(P(0, 0, -2.5)), kn(s).clone().add(P(0, 3, -2.5)), 4.2, S.muscle, 0.9);
      belly(g, kn(s).clone().add(P(0, -3, -1.8)), an(s).clone().add(P(0, 12, -1.8)), 3.6, S.muscle, 0.9); // calf
      add(g, new THREE.SphereGeometry(1, 20, 14), S.muscle, s * 6.4, 26, 5.4).scale.set(6, 4.2, 1.6);     // pectoral
      add(g, new THREE.SphereGeometry(1, 20, 14), S.muscle, s * 3, 10, 5.1).scale.set(3.4, 12, 1.2);       // abdominals
    }
  }
  if (show.nerves) {
    add(g, blob(5.4, 4.6, 5.6, 0.09, 3, 3), S.brain, 0, 50.5, 0.2);
    g.add(new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3([P(0, 45.5, -1.5), P(0, 36, -3), P(0, 10, -3.4), P(0, -9, -2.8)]), (u) => lerp(1.1, 0.5, u), 24, 8), S.nerve));
    const br = [];
    for (const s of [-1, 1]) {
      const mk = (pts, r0) => br.push(taperedTube(new THREE.CatmullRomCurve3(pts), (u) => lerp(r0, 0.16, u), 24, 6));
      mk([P(0, 33, -3), P(s * 7, 34, -2.2), sh(s).clone().add(P(0, 0, -1.2)), el(s).clone().add(P(0, 0, -1)), wr(s).clone().add(P(0, 2, 0.4)), P(s * 21, -8, 3)], 0.6);
      mk([P(0, -8, -2.8), P(s * 3.2, -10, -2), hp(s).clone().add(P(0, 0, -1)), kn(s).clone().add(P(0, 0, -1.5)), an(s).clone().add(P(0, 3, -0.5)), P(s * 7.6, -64, 2)], 0.65);
      mk([P(0, 24, -3), P(s * 6, 23, 0.6), P(s * 9.8, 18, 1.6)], 0.4);
    }
    g.add(new THREE.Mesh(mergeGeometries(br), S.nerve));
  }
  if (show.lungs) {
    g.add(new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3([P(0, 43, 0.5), P(0, 36, 0.8), P(0, 28, 0.8)]), () => 1.1, 12, 8), S.lung));
    for (const s of [-1, 1]) { add(g, blob(6.2, 11, 4.8, 0.07, 4 + s, 3), S.lung, s * 6.6, 21, 1.2); g.add(new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3([P(0, 28, 0.8), P(s * 3, 26, 1), P(s * 5.5, 20, 1.2)]), (u) => lerp(0.8, 0.3, u), 10, 6), S.lung)); }
  }
  g.userData.organAt = { biceps: P(16.6, 24, 5.4), brain: P(0, 50.5, 0.2), cord: P(0, 18, -3.2), trachea: P(0, 36, 2) };
  return g;
}
/** a flowering plant: shoot above ground, roots below */
function plantFigure(show) {
  const S = hm(), g = new THREE.Group();
  const solid = show.solid;
  const stemMat = solid || show.shoot ? S.stem : gl("#9bd8a0", "#eaffea", { minAlpha: 0.05, maxAlpha: 0.26 });
  const rootMat = solid || show.roots ? S.root : gl("#f1e2bd", "#fff6dc", { minAlpha: 0.05, maxAlpha: 0.26 });
  const leafMat = solid || show.shoot ? S.leaf : gl("#8fe0a0", "#eaffea", { minAlpha: 0.05, maxAlpha: 0.26, side: THREE.DoubleSide });
  const stem = new THREE.CatmullRomCurve3([V3(0, -2, 0), V3(1.4, 16, 0.4), V3(-1.0, 36, 0), V3(0.8, 58, -0.2)]);
  g.add(new THREE.Mesh(taperedTube(stem, (u) => lerp(2.3, 0.9, u), 30, 10), stemMat));
  const leaves = [[12, 1, 0.9, 0.5], [20, -1, 1.05, 2.4], [29, 1, 1.15, 4.0], [38, -1, 1.1, 5.6], [47, 1, 0.95, 1.2], [55, -1, 0.75, 3.1]];
  leaves.forEach(([y, sgn, sc, spin]) => {
    const lf = leafBlade(30 * sc, 15 * sc, leafMat);
    const base = stem.getPointAt(y / 60);
    lf.position.set(base.x, y, base.z);
    lf.rotation.order = "YZX"; lf.rotation.y = spin; lf.rotation.z = -sgn * 0.95; lf.rotation.x = -0.35;
    g.add(lf);
  });
  const rts = [], rng = mulberry32(5);
  rts.push(taperedTube(new THREE.CatmullRomCurve3([V3(0, -2, 0), V3(0.5, -14, 0.6), V3(-0.6, -28, 0), V3(0.4, -48, -0.6)]), (u) => lerp(1.8, 0.16, u), 30, 8));
  for (let i = 0; i < 12; i++) {
    const y0 = -5 - i * 3.3, sg = i % 2 ? 1 : -1, len = 15 + rng() * 14 - i * 0.7, zz = (rng() - 0.5) * 8;
    const c = new THREE.CatmullRomCurve3([V3(0, y0, 0), V3(sg * len * 0.4, y0 - 2.4, zz * 0.4), V3(sg * len * 0.8, y0 - 6 - rng() * 3, zz), V3(sg * len, y0 - 11 - rng() * 4, zz * 1.4)]);
    rts.push(taperedTube(c, (u) => lerp(0.9, 0.12, u), 16, 6));
    for (let k = 0; k < 2; k++) { const q = c.getPointAt(0.45 + k * 0.25); const c2 = new THREE.CatmullRomCurve3([q, q.clone().add(V3(sg * 4, -4, (rng() - 0.5) * 6)), q.clone().add(V3(sg * 8, -9 - rng() * 3, (rng() - 0.5) * 8))]); rts.push(taperedTube(c2, (u) => lerp(0.42, 0.08, u), 8, 5)); }
  }
  g.add(new THREE.Mesh(mergeGeometries(rts), rootMat));
  g.userData.organAt = { leaf: V3(9, 35, 3), root: V3(5, -14, 2), stem: V3(0, 26, 1) };
  return g;
}
const heroGlow = (parent, p, r = 3) => { const m = add(parent, new THREE.TorusGeometry(r, r * 0.07, 8, 40), hm().heroRing, p.x, p.y, p.z); m.userData.hero = true; m.userData.clayColor = "#f8d77a"; return m; };

// ----- tissues -----
function sceneMuscleTissue() {
  const S = hm(), g = new THREE.Group(), rod = stripedMaterial(), heroRod = stripedMaterial("#ffd0cf", "#d6283c");
  const geo = capX(2.75, 94, 10), sites = [[0, 0]];
  for (let r = 1; r <= 3; r++) for (let k = 0; k < 6 * r; k++) { const a = (k / (6 * r)) * TAU, rr = r * 6.0; sites.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
  // a stripe-ready rod geometry: the striped shader needs the length axis on x with 2.6 µm repeats; scale the pattern up for the illustration
  const rods = inst(geo, rod, sites.length, g); sites.forEach(([y, z], i) => setI(rods, i, 0, y, z, i === 8 ? 0 : 1)); upd(rods);
  rods.userData.keepMaterial = true;
  add(g, geo, heroRod, 0, sites[8][0], sites[8][1]).userData.keepMaterial = true;
  const sheath = add(g, new THREE.CylinderGeometry(22, 22, 96, 48, 1, true).rotateZ(Math.PI / 2), gl("#f4e9d3", "#ffffff", { minAlpha: 0.04, maxAlpha: 0.4 }));
  sheath.userData.clayOpacity = 0.25;
  g.add(new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3([V3(-46, 23.5, 4), V3(-10, 20, 8), V3(26, 23.2, 2), V3(48, 22, 6)]), () => 1.3, 20, 8), H.vein));
  g.add(new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3([V3(-46, -23, 2), V3(-10, -21, -6), V3(48, -22, -3)]), () => 0.9, 20, 8), H.nerve));
  const end = add(g, new THREE.CircleGeometry(22, 48), new THREE.MeshStandardMaterial({ map: crossSectionTexture(), roughness: 0.6 }), 47.3, 0, 0); end.rotation.y = Math.PI / 2; end.userData.clayColor = "#e7a3a6";
  heroGlow(g, V3(47.6, sites[8][0], sites[8][1]), 3.6).rotation.y = Math.PI / 2;
  g.rotation.y = -0.6; g.rotation.x = 0.15;
  return { g, w: 130, h: 62, anchors: [{ p: V3(0, 31, 0), t: { "y7-8": "Muscle fibres side by side", "y9-10": "Skeletal muscle tissue (a bundle of fibres)" } }, { p: V3(-10, -14, 0), t: { "y7-8": "Our muscle fibre", "y9-10": "Our muscle fibre" } }, { p: V3(-24, 30, 0), t: { "y9-10": "Blood vessel and nerve" } }] };
}
function sceneBiceps() {
  const S = hm(), g = new THREE.Group();
  const pts = []; for (let i = 0; i <= 30; i++) { const u = i / 30, r = 12 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.04 + u * 0.92)), 0.8); pts.push([r, (u - 0.5) * 62]); }
  const geo = lathe(pts, 64).rotateZ(-Math.PI / 2);
  const pp = geo.attributes.position;
  for (let i = 0; i < pp.count; i++) { const y = pp.getY(i), z = pp.getZ(i), a = Math.atan2(z, y), r = Math.hypot(y, z); const k = 1 + 0.045 * Math.sin(a * 14) + 0.02 * Math.sin(a * 31 + pp.getX(i) * 0.2); pp.setY(i, Math.cos(a) * r * k); pp.setZ(i, Math.sin(a) * r * k); }
  geo.computeVertexNormals();
  add(g, geo, S.muscle);
  add(g, geo, gl("#fff2e0", "#ffffff", { minAlpha: 0.02, maxAlpha: 0.25 })).scale.set(1.01, 1.08, 1.08);
  for (const [z, ang] of [[3, 0.14], [-3, -0.14]]) g.add(new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3([V3(-30, 0, z * 0.5), V3(-40, 2 + z, z * 1.4), V3(-52, 3 + z, z * 3)]), (u) => lerp(2.4, 1.1, u), 14, 8), S.tendon));
  g.add(new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3([V3(30, 0, 0), V3(40, -0.5, 0), V3(52, -1.5, 0)]), (u) => lerp(3.4, 1.4, u), 14, 8), S.tendon));
  add(g, blob(11, 6, 6, 0.05, 2, 3), S.bone, -62, 6, 5).userData.clayColor = "#f4e3b8";
  add(g, blob(7, 4.6, 4.6, 0.05, 6, 3), S.bone, 60, -2, 0);
  g.add(new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3([V3(-28, 12, 4), V3(0, 13.2, 3), V3(28, 11, 2)]), () => 0.8, 20, 6), S.vein));
  g.add(new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3([V3(-28, -9, 6), V3(0, -11.5, 4), V3(28, -9.5, 3)]), () => 0.75, 20, 6), S.artery));
  g.add(new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3([V3(-20, 10, -6), V3(0, 12.5, -5), V3(22, 8.6, -4)]), () => 0.55, 20, 6), S.nerve));
  g.rotation.set(0.15, -0.5, -0.12);
  return { g, w: 150, h: 50, anchors: [{ p: V3(0, 19, 0), t: { "y7-8": "Biceps: an organ", "y9-10": "Biceps brachii (muscle tissue)" } }, { p: V3(-48, -5, 0), t: { "y9-10": "Tendon (connective tissue)" } }, { p: V3(0, 16.5, -6), t: { "y9-10": "Nerve + blood vessels" } }] };
}
function sceneNerveTissue() {
  const S = hm(), g = new THREE.Group(), rng = mulberry32(21);
  const somas = [], tubes = [], N = 9;
  for (let i = 0; i < N; i++) {
    const p = V3((rng() - 0.5) * 66, (rng() - 0.5) * 36, (rng() - 0.5) * 32), r = 3.6 + rng() * 1.6;
    somas.push({ p, r });
    for (let k = 0; k < 4; k++) {
      const d = V3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(), e = p.clone().addScaledVector(d, 14 + rng() * 18);
      const c = new THREE.CatmullRomCurve3([p.clone().addScaledVector(d, r * 0.8), p.clone().addScaledVector(d, 8).add(V3((rng() - 0.5) * 6, (rng() - 0.5) * 6, (rng() - 0.5) * 6)), e]);
      tubes.push(taperedTube(c, (u) => lerp(0.9, 0.25, u), 12, 6));
    }
    const ax = V3(rng() < 0.5 ? -1 : 1, (rng() - 0.5) * 0.4, (rng() - 0.5) * 0.4).normalize();
    tubes.push(taperedTube(new THREE.CatmullRomCurve3([p.clone(), p.clone().addScaledVector(ax, 22).add(V3(0, (rng() - 0.5) * 6, 0)), p.clone().addScaledVector(ax, 52)]), () => 0.5, 20, 6));
  }
  const somaI = inst(new THREE.IcosahedronGeometry(1, 3), M_VIOLET(), N, g);
  somas.forEach((s, i) => setI(somaI, i, s.p.x, s.p.y, s.p.z, s.r, s.r * 0.9, s.r)); upd(somaI);
  const nucI = inst(new THREE.IcosahedronGeometry(1, 2), mats().nucleus, N, g); somas.forEach((s, i) => setI(nucI, i, s.p.x, s.p.y, s.p.z, s.r * 0.55)); upd(nucI);
  g.add(new THREE.Mesh(mergeGeometries(tubes), mats().memViolet));
  // glial cells (support, insulation, feeding) in teal
  const glia = [];
  for (let i = 0; i < 12; i++) {
    const p = V3((rng() - 0.5) * 70, (rng() - 0.5) * 40, (rng() - 0.5) * 36);
    for (let k = 0; k < 5; k++) { const d = V3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(); glia.push(taperedTube(new THREE.CatmullRomCurve3([p, p.clone().addScaledVector(d, 3.5), p.clone().addScaledVector(d, 8)]), (u) => lerp(0.8, 0.12, u), 6, 5)); }
    { const sg = new THREE.SphereGeometry(1.6, 12, 8).translate(p.x, p.y, p.z); sg.deleteAttribute("uv"); glia.push(sg); }
  }
  g.add(new THREE.Mesh(mergeGeometries(glia), S.glia));
  g.add(new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3([V3(-44, -16, 10), V3(-10, -10, 4), V3(24, -18, 12), V3(46, -14, 6)]), () => 1.4, 24, 8), S.artery));
  const hero = heroGlow(g, somas[0].p, somas[0].r + 3.4); hero.lookAt(0, 0, 100);
  g.add(specks(60, 0.8, [80, 50, 44], ["#e9d5ff", "#99f6e4"], 0.35));
  g.rotation.set(0.2, -0.4, 0);
  return { g, w: 100, h: 60, anchors: [{ p: V3(0, 30, 0), t: { "y7-8": "Nervous tissue", "y9-10": "Nervous tissue: neurons + glia" } }, { p: somas[0].p.clone().add(V3(0, -9, 0)), t: { "y7-8": "Our neuron", "y9-10": "Our neuron" } }, { p: V3(-30, -22, 12), t: { "y9-10": "Glial cells (support)" } }] };
}
function M_VIOLET() { return mats().memViolet; }
function sceneBrain() {
  const S = hm(), g = new THREE.Group();
  const hemi = (sx) => { let geo = new THREE.IcosahedronGeometry(1, 5); geo.deleteAttribute("normal"); geo.deleteAttribute("uv"); geo = mergeVertices(geo); const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const f = 1 + 0.07 * Math.sin(x * 9 + y * 7) * Math.sin(z * 8 + x * 3) + 0.045 * Math.sin(y * 17 + z * 11) + 0.03 * Math.sin(x * 23 + z * 19); p.setXYZ(i, x * f, y * f, z * f); }
    geo.scale(15, 12.5, 19); geo.computeVertexNormals(); return geo; };
  for (const sx of [-1, 1]) { const m = add(g, hemi(sx), S.brain, sx * 8.6, 0, 0); m.scale.x = 0.62; }
  let cb = new THREE.IcosahedronGeometry(1, 4); cb.deleteAttribute("normal"); cb.deleteAttribute("uv"); cb = mergeVertices(cb); { const p = cb.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); const f = 1 + 0.06 * Math.sin(y * 34); p.setXYZ(i, p.getX(i) * f, y, p.getZ(i) * f); } } cb.scale(11, 6, 8); cb.computeVertexNormals();
  add(g, cb, S.brain, 0, -10, -13).userData.clayColor = "#f0b0c9";
  g.add(new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3([V3(0, -5, -3), V3(0, -14, -4), V3(0, -28, -6)]), (u) => lerp(4.4, 3.2, u), 14, 12), S.brain));
  // a few lit pathways under the surface to hint at connected neurons
  const paths = [];
  const rng = mulberry32(9);
  for (let i = 0; i < 14; i++) { const a = V3((rng() - 0.5) * 30, (rng() - 0.5) * 18, (rng() - 0.5) * 30), b = V3((rng() - 0.5) * 30, (rng() - 0.5) * 18, (rng() - 0.5) * 30); paths.push(taperedTube(new THREE.CatmullRomCurve3([a, a.clone().lerp(b, 0.5).add(V3(0, 8, 0)), b]), () => 0.22, 14, 4)); }
  const pm = new THREE.Mesh(mergeGeometries(paths), new THREE.MeshBasicMaterial({ color: "#ffd166", transparent: true, opacity: 0.5, depthWrite: false })); pm.userData.clayHide = true; g.add(pm);
  g.rotation.set(0.1, -0.7, 0);
  return { g, w: 70, h: 54, anchors: [{ p: V3(0, 19, 0), t: { "y7-8": "The brain: an organ", "y9-10": "Brain (nervous tissue + blood vessels)" } }, { p: V3(0, -26, -13), t: { "y9-10": "Cerebellum" } }] };
}
function sceneSpinalCord() {
  const S = hm(), g = new THREE.Group(), rng = mulberry32(12), HL = 46;
  // white matter (axon tracts) around grey matter (cell bodies): a butterfly of ventral and dorsal horns
  add(g, new THREE.CylinderGeometry(8.2, 8.2, HL * 2, 44, 1, true).rotateZ(Math.PI / 2), gl("#f3efe6", "#ffffff", { minAlpha: 0.2, maxAlpha: 0.65 })).userData.clayOpacity = 0.3;
  const grey = gl("#d9a6c0", "#f7d8e8", { minAlpha: 0.35, maxAlpha: 0.9 });
  const horn = (y, z, ry, rz) => { const m = add(g, blob(HL * 0.98, ry, rz, 0.02, 2, 3), grey, 0, y, z); m.userData.clayColor = "#d8b4cc"; };
  horn(0, 0, 2.3, 1.7);
  for (const sg of [-1, 1]) { horn(3.9, sg * 2.3, 3.4, 1.0); horn(-2.9, sg * 3.7, 2.6, 2.6); }
  // motor neuron cell bodies in the ventral horns
  const N = 12, so = inst(new THREE.IcosahedronGeometry(1, 2), mats().memViolet2, N, g), pos = [];
  for (let i = 0; i < N; i++) { const sg = i % 2 ? 1 : -1, x = -36 + (i >> 1) * 13.5 + rng() * 3; pos.push(V3(x, -2.9 + (rng() - 0.5) * 1.4, sg * 3.8)); setI(so, i, pos[i].x, pos[i].y, pos[i].z, 1.05); }
  upd(so);
  // ventral root: axons leave the cord, join the spinal nerve and run off to the muscle; ours is lit gold
  const axons = [], hubV = V3(-6, -13, 14), outV = V3(-14, -28, 24);
  pos.forEach((p, i) => { if (i === 4) return; axons.push(taperedTube(new THREE.CatmullRomCurve3([p.clone(), p.clone().add(V3(0, -3, p.z > 0 ? 3 : -3)), V3(p.x * 0.3 + hubV.x * 0.7, -9, p.z > 0 ? 11 : -11).lerp(hubV, 0.6), hubV]), () => 0.3, 14, 5)); });
  g.add(new THREE.Mesh(mergeGeometries(axons), mats().memViolet));
  g.add(new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3([hubV, hubV.clone().lerp(outV, 0.5), outV]), () => 2.1, 14, 10), gl("#f1e2bd", "#fff6dc", { minAlpha: 0.3, maxAlpha: 0.8 })));
  const hp = pos[4];
  const heroMesh = add(g, new THREE.IcosahedronGeometry(1.8, 3), hm().nerve, hp.x, hp.y, hp.z);
  g.add(new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3([hp.clone(), hp.clone().add(V3(0, -3, 3)), V3(hp.x * 0.3 + hubV.x * 0.7, -9, 11).lerp(hubV, 0.6), hubV, hubV.clone().lerp(outV, 0.5), outV]), () => 0.45, 30, 6), hm().nerve));
  // dorsal root and its ganglion (sensory neurons)
  const gang = add(g, blob(2.4, 2.0, 2.0, 0.05, 4, 3), mats().memViolet2, 10, 13, 12);
  g.add(new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3([V3(10, 7, 4), V3(10, 10, 8), V3(10, 13, 12)]), () => 0.5, 10, 5), mats().memViolet));
  g.add(new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3([V3(10, 13, 12), V3(2, 11, 15), hubV.clone().add(V3(0, 1, 0))]), () => 0.6, 14, 5), mats().memViolet));
  // cut end with the butterfly outline
  const cv = document.createElement("canvas"); cv.width = cv.height = 256; const c = cv.getContext("2d");
  c.fillStyle = "#e9e1d3"; c.beginPath(); c.arc(128, 128, 126, 0, TAU); c.fill();
  c.fillStyle = "#c98fae"; c.beginPath(); c.ellipse(128, 128, 22, 18, 0, 0, TAU); c.fill();
  for (const sg of [-1, 1]) { c.beginPath(); c.ellipse(128 + sg * 22, 78, 9, 38, sg * -0.25, 0, TAU); c.fill(); c.beginPath(); c.ellipse(128 + sg * 38, 164, 28, 24, 0, 0, TAU); c.fill(); }
  c.fillStyle = "#6d4fc4"; for (const [x, y] of [[96, 168], [160, 168], [88, 150], [168, 150]]) { c.beginPath(); c.arc(x, y, 6, 0, TAU); c.fill(); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const end = add(g, new THREE.CircleGeometry(8.1, 40), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, color: "#a8a094" }), HL + 0.1, 0, 0); end.rotation.y = Math.PI / 2; end.rotation.z = Math.PI; end.userData.clayColor = "#efe3d6";
  heroGlow(g, hp, 3.6).lookAt(0, 0, 200);
  g.rotation.set(0.35, -0.6, 0.05);
  return { g, w: 120, h: 80, anchors: [{ p: V3(0, 11, 0), t: { "y7-8": "Spinal cord: an organ", "y9-10": "Spinal cord (organ)" } }, { p: V3(-24, 0, 6), t: { "y9-10": "Grey matter: cell bodies" } }, { p: V3(hp.x, hp.y - 3.5, hp.z + 4), t: { "y7-8": "Our motor neuron", "y9-10": "Our motor neuron (cell body)" } }, { p: V3(-10, -22, 19), t: { "y7-8": "Its axon runs out to a muscle", "y9-10": "Ventral root, then spinal nerve to the muscle" } }, { p: V3(10, 17, 12), t: { "y9-10": "Dorsal root ganglion (sensory)" } }] };
}

function sceneRootTissue() {
  const S = hm(), g = new THREE.Group(), rng = mulberry32(61);
  const cellGeo = lathe([[0, -9], [3.4, -8.6], [5.4, -6], [5.8, 0], [5.4, 6], [3.4, 8.6], [0, 9]], 20).rotateZ(Math.PI / 2);
  const COLS = 7, ROWS = 4, epi = inst(cellGeo, mats().wallCream, COLS * ROWS, g);
  const cort = inst(new THREE.SphereGeometry(1, 20, 14), mats().wallGreen, COLS * ROWS, g);
  const hairs = [], pos = [];
  let n = 0;
  for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) {
    const x = (q - 3) * 11.4 + (r % 2) * 1.5, z = (r - 1.5) * 11.2;
    setI(epi, n, x, 22, z, 1, 1, 1); setI(cort, n, x + 1, 6, z, 7.4, 6.6, 7.4); pos.push([x, z, n]); n++;
  }
  upd(epi); upd(cort); epi.userData.clayColor = "#f4e3b8"; cort.userData.clayColor = "#a6ddc2";
  const heroIdx = 11;
  pos.forEach(([x, z, i]) => { if (hash(i * 3.7) > 0.45 || i === heroIdx) hairs.push(taperedTube(new THREE.CatmullRomCurve3([V3(x, 30.5, z), V3(x + (rng() - 0.5) * 6, 42, z + (rng() - 0.5) * 6), V3(x + (rng() - 0.5) * 12, 56 + rng() * 14, z + (rng() - 0.5) * 12)]), (u) => (i === heroIdx ? lerp(1.3, 0.6, u) : lerp(0.95, 0.4, u)), 16, 6)); });
  g.add(new THREE.Mesh(mergeGeometries(hairs), gl("#f6c27d", "#fff0d0", { minAlpha: 0.2, maxAlpha: 0.8 })));
  const gr = inst(new THREE.IcosahedronGeometry(1, 1), S.soil, 14, g);
  for (let i = 0; i < 14; i++) { const r = 2 + rng() * 3.4; setI(gr, i, (rng() - 0.5) * 100, 56 + rng() * 22, (rng() - 0.5) * 50, r, r * 0.8, r); } upd(gr); gr.userData.clayColor = "#d8c7b3";
  const hx = pos[heroIdx];
  heroGlow(g, V3(hx[0], 31.5, hx[1]), 5.2).rotation.x = Math.PI / 2;
  g.rotation.set(0.35, -0.5, 0); g.position.y = -12;
  return { g, w: 110, h: 90, anchors: [{ p: V3(0, 42, 0), t: { "y7-8": "Root skin (epidermis)", "y9-10": "Root epidermal tissue" } }, { p: V3(hx[0], 14, hx[1]), t: { "y7-8": "Our cell, with its hair", "y9-10": "Our root hair cell" } }, { p: V3(-34, 2, 0), t: { "y9-10": "Cortex cells beneath" } }] };
}
function sceneRootOrgan() {
  const S = hm(), g = new THREE.Group(), rng = mulberry32(14);
  const c = new THREE.CatmullRomCurve3([V3(-52, 6, 0), V3(-20, -2, 0), V3(16, 4, 0), V3(46, -4, 0), V3(66, -2, 0)]);
  g.add(new THREE.Mesh(taperedTube(c, (u) => u > 0.93 ? lerp(5.8, 0.4, (u - 0.93) / 0.07) : lerp(7.2, 5.8, u), 60, 24), S.root));
  add(g, new THREE.SphereGeometry(6.4, 20, 14), physical("#c8a46c", { roughness: 0.7 }), 62, -2.4, 0).scale.set(1.5, 1, 1);
  const hairs = [];
  for (let i = 0; i < 230; i++) { const u = 0.1 + rng() * 0.7, p = c.getPointAt(u), a = rng() * TAU, r = u < 0.5 ? 7 : 6.2; const d = V3(0, Math.cos(a), Math.sin(a)); hairs.push(taperedTube(new THREE.LineCurve3(p.clone().addScaledVector(d, r * 0.9), p.clone().addScaledVector(d, r + 5 + rng() * 9).add(V3((rng() - 0.5) * 6, 0, 0))), (t) => lerp(0.34, 0.12, t), 3, 4)); }
  g.add(new THREE.Mesh(mergeGeometries(hairs), gl("#fff3d4", "#ffffff", { minAlpha: 0.3, maxAlpha: 0.9 })));
  const cv = document.createElement("canvas"); cv.width = cv.height = 256; const cx = cv.getContext("2d");
  cx.fillStyle = "#f2e0b0"; cx.fillRect(0, 0, 256, 256);
  const ring = (r, col2, w) => { cx.strokeStyle = col2; cx.lineWidth = w; cx.beginPath(); cx.arc(128, 128, r, 0, TAU); cx.stroke(); };
  ring(122, "#c98b4a", 8);
  cx.fillStyle = "#cbe6b0"; for (let i = 0; i < 70; i++) { const a = rng() * TAU, r = 55 + rng() * 55; cx.beginPath(); cx.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 8 + rng() * 6, 0, TAU); cx.fill(); }
  ring(52, "#8f6a3b", 6); cx.fillStyle = "#f7f0cf"; cx.beginPath(); cx.arc(128, 128, 48, 0, TAU); cx.fill();
  cx.fillStyle = "#b8843f"; for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU; for (let j = 1; j < 4; j++) { cx.beginPath(); cx.arc(128 + Math.cos(a) * j * 11, 128 + Math.sin(a) * j * 11, 3 + j * 1.3, 0, TAU); cx.fill(); } }
  cx.fillStyle = "#6bb3ff"; for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU + Math.PI / 4; cx.beginPath(); cx.arc(128 + Math.cos(a) * 30, 128 + Math.sin(a) * 30, 6, 0, TAU); cx.fill(); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sec = add(g, new THREE.CircleGeometry(7.3, 40), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, color: "#b0a690" }), -52.2, 6, 0); sec.rotation.y = -Math.PI / 2; sec.userData.clayColor = "#f4e3b8";
  g.rotation.set(0.2, -0.35, 0);
  return { g, w: 150, h: 40, anchors: [{ p: V3(18, 20, 0), t: { "y7-8": "Root hairs", "y9-10": "Root: hairs on the epidermis" } }, { p: V3(62, 10, 0), t: { "y9-10": "Root cap" } }, { p: V3(-52, 18, 0), t: { "y9-10": "Cut: xylem at the centre" } }] };
}
function sceneRootSystem() {
  const g = new THREE.Group(), pf = plantFigure({ roots: true, shoot: false });
  g.add(pf); g.add(soilBlock(78, 40, 58, -31));
  g.position.y = 20; g.scale.setScalar(1.15);
  return { g, w: 80, h: 80, anchors: [{ p: V3(0, -4, 6), t: { "y7-8": "Roots (underground)", "y9-10": "Root system" } }, { p: V3(0, 50, 0), t: { "y9-10": "(shoot system, faded)" } }] };
}
function sceneLeafSection() {
  const S = hm(), M = mats(), g = new THREE.Group();
  const cols = inst(lathe([[0, -17], [3.6, -16.2], [5, -12], [5, 12], [3.6, 16.2], [0, 17]], 18), M.wallGreen, 24, g);
  const chl = inst(new THREE.SphereGeometry(1, 12, 8), M.chloro, 24 * 8, g);
  let k = 0;
  for (let r = 0; r < 4; r++) for (let q = 0; q < 6; q++) { const x = (q - 2.5) * 11.2, z = (r - 1.5) * 11.2; setI(cols, r * 6 + q, x, 4, z, 1); for (let j = 0; j < 8; j++) { const a = j * 2.4 + q, y = -9 + hash(j * 2.1 + r * 5 + q) * 28; setI(chl, k++, x + Math.cos(a) * 3.6, y + 4, z + Math.sin(a) * 3.6, 1.3, 0.7, 1.3, 0, 0, a); } }
  upd(cols); upd(chl); cols.userData.clayColor = "#a6ddc2";
  const epi = add(g, new THREE.BoxGeometry(76, 6, 52), gl("#a8c8ff", "#e6f0ff", { minAlpha: 0.06, maxAlpha: 0.45 }), 0, 24, 0); epi.userData.clayColor = "#a1b1ef";
  add(g, new THREE.BoxGeometry(77, 1.8, 53), gl("#fff2b8", "#fffbe0", { minAlpha: 0.12, maxAlpha: 0.5 }), 0, 27.6, 0).userData.clayColor = "#f4e3b8";
  const sp = inst(blob(1, 1, 1, 0.12, 3, 3), M.wallGreen, 11, g);
  for (let i = 0; i < 11; i++) { const r = 8 + hash(i * 3) * 4; setI(sp, i, (hash(i * 5.5) - 0.5) * 64, -29 + (hash(i) - 0.5) * 6, (hash(i * 2.2) - 0.5) * 40, r, r * 0.75, r); } upd(sp); sp.userData.clayColor = "#d9e5a4";
  const low = add(g, new THREE.BoxGeometry(76, 5, 52), gl("#a8c8ff", "#e6f0ff", { minAlpha: 0.06, maxAlpha: 0.45 }), 0, -40, 0); low.userData.clayColor = "#a1b1ef";
  // a vein (vascular bundle) running through the middle of the leaf
  const vb = add(g, new THREE.CylinderGeometry(7.5, 7.5, 52, 28, 1, true).rotateX(Math.PI / 2), gl("#e6d29b", "#fff6d8", { minAlpha: 0.1, maxAlpha: 0.5 }), 30, -14, 0);
  for (let i = 0; i < 4; i++) { const a = i * 1.5; add(g, new THREE.CylinderGeometry(1.6, 1.6, 52, 12).rotateX(Math.PI / 2), S.xyl, 30 + Math.cos(a) * 2.8, -12 + Math.sin(a) * 2.2, 0); }
  add(g, new THREE.CylinderGeometry(1.2, 1.2, 52, 10).rotateX(Math.PI / 2), mats().memTeal, 30, -17.5, 0);
  const hero = heroGlow(g, V3(0.5 * 11.2 * 0 + (2 - 2.5) * 11.2, 4, (1 - 1.5) * 11.2), 6.6); hero.rotation.x = Math.PI / 2; hero.position.y = 24.5;
  g.rotation.set(0.5, -0.55, 0);
  return { g, w: 100, h: 80, anchors: [{ p: V3(-10, 40, 0), t: { "y7-8": "Waxy top", "y9-10": "Cuticle + epidermis" } }, { p: V3(-34, 6, 0), t: { "y7-8": "Palisade tissue: our cell is here", "y9-10": "Palisade tissue (tall cells)" } }, { p: V3(-34, -28, 0), t: { "y7-8": "Loose cells with air gaps", "y9-10": "Spongy mesophyll" } }, { p: V3(34, -26, 0), t: { "y9-10": "Vein (xylem and phloem)" } }] };
}
function sceneLeafOrgan() {
  const S = hm(), g = new THREE.Group();
  const lf = leafBlade(78, 40); lf.position.set(0, -30, 0); g.add(lf);
  g.add(new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3([V3(0, -50, 1), V3(2, -40, 2), V3(0, -30, 1)]), (u) => lerp(1.6, 1.2, u), 12, 8), S.stem));
  g.add(new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3([V3(-10, -60, 0), V3(0, -52, 1), V3(10, -46, 0)]), () => 2.2, 14, 8), S.stem));
  g.rotation.set(-0.3, 0.3, 0.1);
  return { g, w: 90, h: 100, anchors: [{ p: V3(18, 18, 0), t: { "y7-8": "A leaf: an organ", "y9-10": "Leaf (organ): epidermis, mesophyll, veins" } }, { p: V3(0, -52, 2), t: { "y9-10": "Petiole + stem" } }] };
}
function sceneXylemTissue() {
  const S = hm(), g = new THREE.Group(), rng = mulberry32(44);
  const wall = gl("#e7cf9d", "#fff3d1", { minAlpha: 0.08, maxAlpha: 0.55 });
  const vs = [[0, 0, 9.5], [-17, -4, 6.4], [15, 7, 5.6], [-3, 18, 7.2], [19, -14, 4.6], [-21, 14, 4.0], [4, -17, 5.0]];
  vs.forEach(([x, z, r], i) => {
    add(g, new THREE.CylinderGeometry(r, r, 80, 28, 1, true), wall, x, 0, z);
    const hc = new THREE.CatmullRomCurve3(Array.from({ length: 120 }, (_, j) => { const u = j / 119, a = u * (80 / (r * 0.55)) * TAU / 2.4; return V3(x + Math.cos(a) * (r - 0.3), -40 + u * 80, z + Math.sin(a) * (r - 0.3)); }));
    add(g, new THREE.TubeGeometry(hc, 160, Math.max(0.4, r * 0.075), 6), H.xyl);
  });
  const fib = []; for (let i = 0; i < 12; i++) { const a = rng() * TAU, r = 24 + rng() * 6; fib.push(new THREE.CylinderGeometry(1.8, 1.8, 80, 8).translate(Math.cos(a) * r, 0, Math.sin(a) * r)); }
  g.add(new THREE.Mesh(mergeGeometries(fib), physical("#b9a77a", { roughness: 0.5 })));
  const par = inst(blob(1, 1, 1, 0.1, 5, 3), mats().wallGreen, 10, g);
  for (let i = 0; i < 10; i++) { const a = i * 0.7 + 0.2, r = 20 + hash(i) * 6; setI(par, i, Math.cos(a) * r * 1.0, (hash(i * 3) - 0.5) * 60, Math.sin(a) * r, 6, 9, 6); } upd(par); par.userData.clayColor = "#d9e5a4";
  add(g, new THREE.CylinderGeometry(2.2, 2.2, 80, 12), mats().memTeal, 9, 0, -15).userData.clayColor = "#92d3cf";
  const hero = heroGlow(g, V3(0, 40.5, 0), 11); hero.rotation.x = Math.PI / 2;
  g.rotation.set(0.35, -0.5, 0);
  return { g, w: 100, h: 100, anchors: [{ p: V3(0, 46, 0), t: { "y7-8": "Our vessel", "y9-10": "Our vessel element" } }, { p: V3(-26, 28, 0), t: { "y9-10": "Xylem tissue: vessels + fibres" } }, { p: V3(18, -42, -15), t: { "y9-10": "Phloem (other tissue)" } }] };
}
function sceneStem() {
  const S = hm(), M = mats(), g = new THREE.Group(), rng = mulberry32(27);
  const planeLocal = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0), plane = planeLocal.clone();
  const skin = gl("#9bd88f", "#eaffea", { minAlpha: 0.1, maxAlpha: 0.6, clippingPlanes: [plane] });
  skin.side = THREE.DoubleSide;
  add(g, new THREE.CylinderGeometry(15, 15, 90, 56, 1, true), skin);
  // cross-section plate at the top: epidermis, cortex, a ring of vascular bundles and a pith
  const cv = document.createElement("canvas"); cv.width = cv.height = 300; const cx = cv.getContext("2d");
  cx.fillStyle = "#d7efc0"; cx.beginPath(); cx.arc(150, 150, 148, 0, TAU); cx.fill(); cx.strokeStyle = "#6aa84f"; cx.lineWidth = 8; cx.stroke();
  cx.fillStyle = "#bfe3a0"; for (let i = 0; i < 90; i++) { const a = rng() * TAU, r = 60 + rng() * 78; cx.beginPath(); cx.arc(150 + Math.cos(a) * r, 150 + Math.sin(a) * r, 7 + rng() * 5, 0, TAU); cx.fill(); }
  cx.fillStyle = "#eef7dc"; cx.beginPath(); cx.arc(150, 150, 46, 0, TAU); cx.fill();
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU, x = 150 + Math.cos(a) * 80, y = 150 + Math.sin(a) * 80; cx.save(); cx.translate(x, y); cx.rotate(a); cx.fillStyle = "#9ed7ff"; cx.beginPath(); cx.ellipse(10, 0, 9, 13, 0, 0, TAU); cx.fill(); cx.fillStyle = "#b8843f"; for (const [dx, dy, r] of [[-14, -5, 7], [-14, 7, 6], [-5, 0, 8]]) { cx.beginPath(); cx.arc(dx, dy, r, 0, TAU); cx.fill(); } cx.restore(); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const top = add(g, new THREE.CircleGeometry(15, 56), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, color: "#9aa890" }), 0, 45, 0); top.rotation.x = -Math.PI / 2; top.userData.clayColor = "#d9e5a4";
  // vascular bundles seen along the length through the cut window
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU + 0.2, x = Math.cos(a) * 9.6, z = Math.sin(a) * 9.6; if (z > 2) continue; add(g, new THREE.CylinderGeometry(1.9, 1.9, 90, 14), S.xyl, x - Math.cos(a) * 1.8, 0, z - Math.sin(a) * 1.8); add(g, new THREE.CylinderGeometry(1.3, 1.3, 90, 10), M.memTeal, x + Math.cos(a) * 1.8, 0, z + Math.sin(a) * 1.8); }
  add(g, new THREE.CylinderGeometry(4.2, 4.2, 90, 20), gl("#eef7dc", "#ffffff", { minAlpha: 0.1, maxAlpha: 0.4 }), 0, 0, 0);
  const lf = leafBlade(34, 18); lf.position.set(12, 14, -3); lf.rotation.set(-1.2, 0.3, -1.2); g.add(lf);
  const hero = heroGlow(g, V3(Math.cos(0.2) * 9.6 - Math.cos(0.2) * 1.8, 45.4, Math.sin(0.2) * 9.6 - Math.sin(0.2) * 1.8), 2.8); hero.rotation.x = Math.PI / 2;
  g.rotation.set(0.5, -0.5, 0.15);
  return { g, w: 80, h: 110, update: () => { g.updateWorldMatrix(true, false); plane.copy(planeLocal).applyMatrix4(g.matrixWorld); }, anchors: [{ p: V3(18, 40, 0), t: { "y7-8": "Stem: an organ", "y9-10": "Stem (organ): carries water up" } }, { p: V3(-18, 20, 0), t: { "y9-10": "Vascular bundles (xylem + phloem)" } }] };
}

/** map: specimen id -> scenes for tissue, organ, system and organism steps (steps 1..4) */
const HIER = {
  muscle: [sceneMuscleTissue, sceneBiceps, () => sceneFigure({ muscles: true, bones: true, biceps: true }, "biceps", { "y7-8": "Muscles + skeleton", "y9-10": "Muscular system (with the skeleton)" }), () => sceneFigure({ solid: true }, "biceps", { "y7-8": "A human: our biceps is in here", "y9-10": "Human: biceps highlighted" })],
  neuron: [sceneNerveTissue, sceneSpinalCord, () => sceneFigure({ nerves: true }, "cord", { "y7-8": "Brain, spinal cord and nerves", "y9-10": "Nervous system" }), () => sceneFigure({ solid: true }, "cord", { "y7-8": "A human: the spinal cord runs down the back", "y9-10": "Human: spinal cord highlighted" })],
  roothair: [sceneRootTissue, sceneRootOrgan, sceneRootSystem, () => scenePlant({ solid: true }, "root", { "y7-8": "A flowering plant", "y9-10": "Flowering plant: roots underground" })],
  palisade: [sceneLeafSection, sceneLeafOrgan, () => scenePlant({ shoot: true }, "leaf", { "y7-8": "Stem and leaves: the shoot system", "y9-10": "Shoot system (stems + leaves)" }), () => scenePlant({ solid: true }, "leaf", { "y7-8": "A flowering plant", "y9-10": "Flowering plant: leaf highlighted" })],
  xylem: [sceneXylemTissue, sceneStem, () => scenePlant({ shoot: true }, "stem", { "y7-8": "Stem and leaves: the shoot system", "y9-10": "Shoot system" }), () => scenePlant({ solid: true }, "stem", { "y7-8": "A flowering plant", "y9-10": "Flowering plant: stem highlighted" })],
};
function sceneFigure(show, organ, label) {
  const g = new THREE.Group(), f = humanFigure(show); g.add(f);
  const p = f.userData.organAt[organ];
  const hero = heroGlow(g, p, organ === "brain" ? 8 : organ === "cord" ? 6 : 5); hero.lookAt(0, 0, 100);
  g.position.y = 4; g.scale.setScalar(0.9); g.rotation.y = -0.35;
  return { g, w: 70, h: 120, anchors: [{ p: p.clone().multiplyScalar(0.9).add(V3(0, 12, 0)), t: label }, { p: V3(0, -62 * 0.9 + 4, 0), t: { "y9-10": "Not to scale" } }] };
}
function scenePlant(show, organ, label) {
  const g = new THREE.Group(), f = plantFigure(show); g.add(f);
  const p = f.userData.organAt[organ];
  const hero = heroGlow(g, p, organ === "root" ? 8 : 6); hero.lookAt(0, 0, 100);
  g.add(soilBlock(78, 40, 58, -31));
  g.position.y = 4; g.scale.setScalar(0.95);
  return { g, w: 90, h: 150, anchors: [{ p: p.clone().add(V3(12, 10, 0)), t: label }, { p: V3(0, -52, 0), t: { "y9-10": "Not to scale" } }] };
}

// =====================================================================================================================
// The level
// =====================================================================================================================
const BUILD = { rbc: buildRBC, neuron: buildNeuron, muscle: buildMuscle, sperm: buildSperm, cilia: buildCilia, roothair: buildRootHair, palisade: buildPalisade, guard: buildGuard, xylem: buildXylem };
const CSS_ID = "cs-specialised-css";
function injectCss() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement("style");
  s.id = CSS_ID;
  s.textContent = `
    .sp-pick { display: grid; grid-template-columns: repeat(auto-fill, minmax(128px, 1fr)); gap: 6px; margin: 8px 0 4px; }
    .sp-pick button { text-align: left; display: flex; align-items: center; gap: 7px; padding: 6px 8px; font-size: 0.8rem; line-height: 1.15; }
    .sp-pick button i { width: 10px; height: 10px; border-radius: 50%; flex: none; box-shadow: 0 0 8px currentColor; }
    .sp-pick button[aria-pressed="true"] { border-color: var(--accent); background: var(--tint-2, rgba(79,209,197,0.16)); }
    .sp-pick h3, .sp-sub { grid-column: 1 / -1; margin: 6px 0 0; font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-faint); font-weight: 600; }
    .sp-rows { margin: 8px 0 4px; display: flex; flex-direction: column; gap: 8px; font-size: 0.84rem; }
    .sp-rows dt { color: var(--ink); font-weight: 600; margin: 0; }
    .sp-rows dd { margin: 1px 0 0; color: var(--ink-dim); }
    .sp-job { margin: 4px 0; color: var(--ink); }
    .sp-views { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .sp-views .btn { font-size: 0.76rem; padding: 4px 9px; }
    .sp-ladder { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; margin: 8px 0; }
    .sp-ladder button { font-size: 0.7rem; padding: 6px 2px; line-height: 1.15; min-height: 48px; word-break: break-word; }
    .sp-ladder button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent); background: rgba(79,209,197,0.14); }
    .sp-ladder button small { display: block; opacity: 0.6; font-size: 0.62rem; }
    .sp-cap { font-size: 0.84rem; color: var(--ink-dim); margin: 6px 0 0; }
    .sp-nav { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 3; display: flex; gap: 6px; align-items: center; max-width: calc(100% - 28px); }
    .sp-nav .btn { background: rgba(5, 11, 22, 0.78); padding: 6px 12px; white-space: nowrap; }
    .sp-nav .nm { font-size: 0.78rem; color: var(--ink); background: rgba(5, 11, 22, 0.6); padding: 4px 10px; border-radius: 999px; max-width: 34vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .style-clay .sp-nav .btn { color: #eef5f6; }
    .lbl3d.sp-board { background: none; border: 0; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; font-size: 0.8rem; color: #a5f3fc; text-shadow: 0 1px 8px #000; pointer-events: none; }
    .style-clay .lbl3d.sp-board { color: #17324a; text-shadow: none; }
    .lbl3d.sp-feat { background: rgba(5, 11, 22, 0.66); border: 1px solid rgba(165, 243, 252, 0.35); padding: 2px 8px; border-radius: 999px; font-size: 0.72rem; color: #eaf6ff; pointer-events: none; }
    .style-clay .lbl3d.sp-feat { background: rgba(17, 26, 40, 0.92); color: #eef5f6; }
    .match { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px; }
    .match h3 { grid-column: auto; margin: 0 0 4px; font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-faint); }
    .match-col { display: flex; flex-direction: column; gap: 6px; }
    .match-cell, .match-job { border: 1px solid var(--panel-border); border-radius: 10px; padding: 7px 9px; font-size: 0.8rem; line-height: 1.25; background: var(--tint-1, rgba(255,255,255,0.04)); touch-action: none; user-select: none; }
    .match-cell { min-height: 40px; display: flex; flex-direction: column; justify-content: center; }
    .match-cell b { display: flex; align-items: center; gap: 6px; font-weight: 600; }
    .match-cell b i { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
    .match-cell small { color: var(--ink-dim); margin-top: 2px; }
    .match-cell.over { border-color: var(--accent); background: rgba(79,209,197,0.14); }
    .match-cell.done { border-color: rgba(74, 222, 128, 0.7); background: rgba(74, 222, 128, 0.1); }
    .match-cell.bad { animation: sp-shake 0.35s; border-color: rgba(248, 113, 113, 0.8); }
    .match-job { cursor: grab; }
    .match-job.sel { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(79,209,197,0.25); }
    .match-job.used { opacity: 0.35; pointer-events: none; text-decoration: line-through; }
    .match-ghost { position: fixed; z-index: 9999; pointer-events: none; max-width: 190px; opacity: 0.92; transform: translate(-50%, -50%) rotate(-2deg); background: #0d2336; color: #e8f1ff; box-shadow: 0 6px 20px rgba(0,0,0,0.5); }
    @keyframes sp-shake { 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
    @media (max-width: 520px) { .match { grid-template-columns: 1fr; } .sp-nav .nm { display: none; } .sp-nav { bottom: 132px; } }
    @media (prefers-reduced-motion: reduce) { .match-cell.bad { animation: none; } }`;
  document.head.appendChild(s);
}
const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

export function create(engine) {
  injectCss();
  const lens = engine.lens;
  const M = mats();
  const first = engine.stack?.[0]?.id === "cell" ? "plant" : "animal";
  const root = new THREE.Group(), gallery = new THREE.Group(), hier = new THREE.Group();
  root.add(gallery, hier);
  hier.position.set(0, HIER_Y, 0); hier.visible = false;
  const pickables = [];
  const ms = { matched: () => false, ciliaCleared: 0 };
  const specs = {}, ids = [];
  const X = { engine, lens, ms, refresh: () => { uiT = 0; exT = 0; }, rebuildControls: () => buildControls(), focusView: (i) => { if (sel && specs[sel]) flyTo(specs[sel], specs[sel].views[i] || specs[sel].views[0]); }, dive: (p) => engine.dive(p) };

  // ---------- build the specimens ----------
  for (const id of C.ORDER) {
    try {
      const S = {};
      const sp = BUILD[id]({ ...X, S });
      sp.id = id; sp.S = S; sp.info = C.SPEC[id];
      specs[id] = sp; ids.push(id);
    } catch (err) { console.error("specialised: could not build", id, err); }
  }
  // lay them out along a gently curved shelf, animal specialists then plant specialists
  const xs = {};
  let cursor = 0;
  ids.forEach((id, i) => {
    if (i) { const pid = ids[i - 1]; cursor += HALF_W[pid] + HALF_W[id] + (C.KINGDOM[id] !== C.KINGDOM[pid] ? KINGDOM_GAP : GAP); }
    xs[id] = cursor;
  });
  const mid = (xs[ids[0]] + xs[ids.at(-1)]) / 2;
  for (const id of ids) {
    const sp = specs[id], x = xs[id] - mid, bay = new THREE.Group();
    bay.position.set(x, 0, (x * x) / (2 * ARC_R)); bay.rotation.y = -Math.atan(x / ARC_R);
    bay.add(sp.g);
    const hb = hitBox(...sp.hit); hb.userData.spec = id; bay.add(hb); pickables.push(hb);
    // a soft coloured beacon so every specimen can be found from far away (it fades out as you zoom in)
    const bc = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: sp.info.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    bc.position.set(0, 0, 0); bay.add(bc); sp.beacon = bc;
    gallery.add(bay);
    sp.bay = bay; sp.x = x;
  }
  const kingdomIds = (k) => ids.filter((i) => C.KINGDOM[i] === k);
  const startId = kingdomIds(first)[0] || ids[0];

  // ---------- state ----------
  let sel = startId, hierStep = 0, panelEl = null, node = null, progress = null, mission = null, quizEl = null;
  let infoCard, ctlCard, ctlBody, expCard, expBody, hierCard, hierBody, pickBtns = {}, matchCard = null;
  let chips = [], chipN = 0, uiT = 0, exT = 0, showLabels = true, nav = null;
  const matched = {};
  const MATCH_LIST = () => C.MATCH.filter((m) => lens.atLeast(m.minBand)).map((m) => m.id).filter((i) => specs[i]);
  ms.matched = () => { const l = MATCH_LIST(); return l.length > 0 && l.every((i) => matched[i]); };
  const hierScenes = {};
  const tV = new THREE.Vector3(), tW = new THREE.Vector3(), UP = V3(0, 1, 0), _pp = new THREE.Vector3();
  const vpool = Array.from({ length: 40 }, () => new THREE.Vector3());
  let vp = 0;

  // ---------- camera helpers ----------
  const distFor = (w, h) => Math.max(h / (2 * FOV_T * 0.8), w / (2 * FOV_T * engine.camera.aspect * 0.86));
  function viewWorld(sp, v) {
    const dir = (v.dir ? v.dir.clone() : V3(0.1, 0.28, 1)).normalize().applyAxisAngle(UP, sp.bay.rotation.y);
    const target = sp.bay.localToWorld(V3(v.x, v.y, v.z));
    // portrait: a view may give a narrower width (nw) so a long cell fills the screen (its far ends run off-screen, labelled "truncated")
    return { target, dir, distance: distFor(engine.camera.aspect < 0.9 && v.nw ? v.nw : v.w, v.h) };
  }
  function overviewWorld(group) {
    const a = xs[group[0]] - mid, b = xs[group.at(-1)] - mid, w = (b - a) + HALF_W[group[0]] + HALF_W[group.at(-1)] + 60;
    const cx = (a + b) / 2, cz = (cx * cx) / (2 * ARC_R);
    return { target: V3(cx, 6, cz), dir: V3(0, 0.34, 1).normalize(), distance: distFor(w, 150) };
  }
  function flyTo(sp, v, dur = 1.0) {
    const w = viewWorld(sp, v);
    return engine.fly(w.target, w.target.clone().addScaledVector(w.dir, w.distance), dur);
  }
  function currentView() {
    if (hierStep) { const sc = hierScene(sel, hierStep); const d = distFor(sc.w, sc.h); return { target: V3(0, HIER_Y, 0), dir: V3(0.1, 0.16, 1).normalize(), distance: d }; }
    if (!sel) return overviewWorld(ids);
    return viewWorld(specs[sel], specs[sel].view);
  }
  function overview(all = true) {
    if (hierStep) exitHier(true);
    const wasSel = sel; sel = null; renderSelection(); buildChips(); engine.select(null);
    const narrow = engine.camera.aspect < 0.9;
    const grp = narrow ? kingdomIds(C.KINGDOM[wasSel || startId] || first) : all ? ids : kingdomIds(first);
    const w = overviewWorld(grp);
    engine.fly(w.target, w.target.clone().addScaledVector(w.dir, w.distance), 1.2);
  }
  function focusSpec(id, vi = 0) {
    if (!specs[id]) return;
    if (hierStep) exitHier(true);
    sel = id; renderSelection(); buildChips(); engine.select(null);
    pickBtns && Object.entries(pickBtns).forEach(([k, b]) => b.setAttribute("aria-pressed", String(k === id)));
    const sp = specs[id];
    if (!engine.busy) flyTo(sp, sp.views[vi] || sp.view);
    navUpdate();
  }
  const step = (d) => { const i = ids.indexOf(sel), n = ids.length; focusSpec(ids[((((i < 0 ? 0 : i) + d) % n) + n) % n]); };

  // ---------- 3D labels ----------
  const names = {}, feats = [];
  for (const id of ids) { names[id] = engine.label("", "org"); names[id].style.pointerEvents = "none"; }
  const boards = { animal: engine.label("Animal specialists", "sp-board"), plant: engine.label("Plant specialists", "sp-board") };
  boards.animal._h = "Animal specialists"; boards.plant._h = "Plant specialists";
  for (let i = 0; i < 9; i++) feats.push(engine.label("", "sp-feat"));
  for (const el of [...Object.values(names), ...Object.values(boards), ...feats]) el.style.display = "none";
  const SHORT = { rbc: "Red blood cell", neuron: "Motor neuron", muscle: "Muscle fibre", sperm: "Sperm cell", cilia: "Ciliated cell", roothair: "Root hair cell", palisade: "Palisade cell", guard: "Guard cells", xylem: "Xylem vessel" };
  function updateLabels() {
    const hide = engine.busy, act = [];
    vp = 0;
    const hold = (el, w, dy0 = 0) => {
      _pp.copy(w).project(engine.camera);
      if (_pp.z > 1 || _pp.z < -1) { el.style.display = "none"; return; }
      act.push({ el, w, x: (_pp.x * 0.5 + 0.5) * engine.w, y: (-_pp.y * 0.5 + 0.5) * engine.h, dy: dy0 });
    };
    const setHtml = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; el.style.display = ""; el._w = el.offsetWidth || 120; } else if (el.style.display === "none") el.style.display = ""; };
    const small = engine.camera.aspect < 0.9;
    for (const id of ids) {
      const el = names[id], sp = specs[id];
      const showName = !hide && !hierStep && (sel === null || (!small && id !== sel));
      if (!showName) { el.style.display = "none"; continue; }
      setHtml(el, sel === null ? esc(SHORT[id] || sp.info.name) : `${esc(SHORT[id] || sp.info.name)}<small>${esc(lens.pick(sp.info.size))}</small>`);
      tV.set(0, sp.view.h * 0.5 + 12, 0); sp.bay.localToWorld(tV);
      hold(el, vpool[vp++].copy(tV));
    }
    for (const k of ["animal", "plant"]) {
      const el = boards[k], g = kingdomIds(k);
      if (hide || hierStep || sel !== null || !g.length) { el.style.display = "none"; continue; }
      const cx = (xs[g[0]] + xs[g.at(-1)]) / 2 - mid;
      tV.set(cx, 260, (cx * cx) / (2 * ARC_R)); setHtml(el, k === "animal" ? "Animal specialists" : "Plant specialists"); hold(el, vpool[vp++].copy(tV));
    }
    // feature labels for the selected cell (or for the zoom-out scene)
    let list = [], toWorld;
    if (hierStep) { const sc = hierScene(sel, hierStep); list = sc.anchors; toWorld = (p, out) => sc.g.localToWorld(out.copy(p)); }
    else if (sel && specs[sel]) { const sp = specs[sel]; list = sp.anchors; toWorld = (p, out) => sp.bay.localToWorld(out.copy(p)); }
    const on = showLabels && !hide && list.length;
    feats.forEach((el, i) => {
      const a = list[i];
      if (!on || !a || (a.show && !a.show())) { el.style.display = "none"; return; }
      const html = esc(lens.pick(a.t));
      if (!html) { el.style.display = "none"; return; }
      setHtml(el, html);
      const p = typeof a.p === "function" ? a.p() : a.p;
      hold(el, toWorld(p, vpool[vp++]));
    });
    const ov = engine.overlay, floorY = ov && ov.firstChild && engine.w < 700 ? ov.offsetTop + ov.offsetHeight + 14 : -1e9;
    // nudge overlapping labels apart (greedy, top to bottom)
    for (let i = 0; i < act.length; i++) { const q = act[i], h = (q.el._w || 120) / 2 + 6; q.x = Math.min(Math.max(q.x, h), Math.max(h, engine.w - h)); if (q.y + q.dy < floorY) q.y = floorY - q.dy; }   // clamp first, then resolve collisions on the final positions
    act.sort((a, b) => a.y - b.y);
    for (let i = 0; i < act.length; i++) {
      const a = act[i];
      for (let pass = 0; pass < 3; pass++) for (let j = 0; j < i; j++) {
        const b = act[j];
        if (Math.abs(a.x - b.x) < ((a.el._w || 120) + (b.el._w || 120)) / 2 + 6 && Math.abs(a.y + a.dy - (b.y + b.dy)) < 24) a.dy = b.y + b.dy + 24 - a.y;
      }
      // clamp inside the stage (labels at a cut-off end used to be clipped) and below the HUD chip rows on narrow stages
      const half = (a.el._w || 120) / 2 + 6, x = Math.min(Math.max(a.x, half), Math.max(half, engine.w - half)), y = Math.max(a.y + a.dy, floorY);
      a.el.style.display = "";
      a.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
    }
  }
  const hideLabels = () => { for (const el of [...Object.values(names), ...Object.values(boards), ...feats]) el.style.display = "none"; };

  // ---------- zoom-out ladder ----------
  function hierScene(id, stepN) {
    const key = `${id}:${stepN}`;
    if (hierScenes[key]) return hierScenes[key];
    const sc = HIER[id][stepN - 1]();
    sc.g.visible = false; hier.add(sc.g);
    hierScenes[key] = sc;
    return sc;
  }
  let hierBusy = false;
  async function showHier(n) {
    if (hierBusy || !sel || n === hierStep) return;
    const sp = specs[sel];
    if (n === 0) { await exitHier(false); return; }
    if (!HIER[sel]) return;
    hierBusy = true;
    try {
      await engine.fadeTo(1, 220);
      const sc = hierScene(sel, n);
      for (const k of Object.keys(hierScenes)) hierScenes[k].g.visible = hierScenes[k] === sc;
      hier.visible = true; gallery.visible = false;
      hierStep = n;
      const v = currentView();
      engine.flight = null;
      engine.frame(v);
      engine.userMoved = true;
      renderHier();
      engine.select(null);
      engine.fadeTo(0, 350);
    } catch (err) { console.error(err); engine.fadeTo(0, 200); } finally { hierBusy = false; }
  }
  async function exitHier(instant) {
    if (!hierStep) return;
    if (!instant) await engine.fadeTo(1, 220);
    hierStep = 0; hier.visible = false; gallery.visible = true;
    for (const k of Object.keys(hierScenes)) hierScenes[k].g.visible = false;
    if (sel && specs[sel]) { const w = viewWorld(specs[sel], specs[sel].view); engine.flight = null; engine.frame(w); engine.userMoved = true; }
    renderHier(); buildChips();
    if (!instant) engine.fadeTo(0, 350);
  }

  // ---------- the panel ----------
  const pick = (v) => lens.pick(v);
  function renderSelection() {
    if (!infoCard) return;
    const sp = sel && specs[sel];
    if (!sp) {
      infoCard.style.display = "none"; ctlCard.style.display = "none"; expCard.style.display = "none"; hierCard.style.display = "none";
      return;
    }
    infoCard.style.display = ctlCard.style.display = expCard.style.display = hierCard.style.display = "";
    const I = sp.info;
    infoCard.innerHTML = `<h2>${esc(I.name)}</h2><p class="sp-job"><b>Job:</b> ${esc(pick(I.job))}</p><p class="hint" style="margin:0 0 4px">${esc(pick(I.size))}</p>
      <dl class="sp-rows">${I.rows.map((r) => `<div><dt>${esc(r.part)}</dt><dd>${pick(r.how)}</dd></div>`).join("")}</dl>
      <p class="hint"><b>Keep in mind:</b> ${esc(I.limit)}</p>
      <div class="sp-views"></div>`;
    const vb = infoCard.querySelector(".sp-views");
    sp.views.forEach((v, i) => K.button(vb, v.label, () => { if (hierStep) exitHier(true); flyTo(sp, v); }));
    buildControls();
    renderHier();
    updateExplain(true);
  }
  function buildControls() {
    if (!ctlBody) return;
    ctlBody.innerHTML = "";
    const sp = sel && specs[sel]; if (!sp) return;
    ctlCard.querySelector("h2").textContent = lens.pick({ "y7-8": "Try it: how the shape does the job", "y9-10": "Try it: structure and function" });
    sp.controls(ctlBody);
  }
  function renderHier() {
    if (!hierBody) return;
    const sp = sel && specs[sel]; if (!sp) return;
    const I = sp.info, chain = I.chain, has3d = !!HIER[sel];
    hierBody.innerHTML = "";
    if (!chain) {
      hierBody.innerHTML = `<p class="sp-cap">${pick(I.chainNote || "")}</p>`;
      return;
    }
    const row = document.createElement("div"); row.className = "sp-ladder";
    chain.forEach((name, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "btn"; b.setAttribute("aria-pressed", String(i === hierStep));
      b.innerHTML = `${esc(name)}<small>${C.LADDER[i]}</small>`;
      if (has3d) b.addEventListener("click", () => showHier(i)); else b.disabled = i === 0;
      row.appendChild(b);
    });
    hierBody.appendChild(row);
    const txt = C.LADDER_TEXT[sel]?.[hierStep];
    const cap = document.createElement("p"); cap.className = "sp-cap";
    if (hierStep === 0) cap.textContent = lens.pick({ "y7-8": "Press the next step to zoom out and see where this cell fits.", "y9-10": "Cells make tissues, tissues make organs, organs make organ systems, and systems make an organism. Press a step to zoom out." });
    else cap.innerHTML = pick(txt || "") + ` <span style="color:var(--ink-faint)">Not to scale.</span>`;
    hierBody.appendChild(cap);
    if (!has3d) { const n = document.createElement("p"); n.className = "hint"; n.textContent = "Text ladder only for this cell."; hierBody.appendChild(n); }
    if (has3d && hierStep > 0) { const r = K.buttonRow(hierBody); K.button(r, "◂ Back to the cell", () => showHier(0)); if (hierStep < 4) K.button(r, "Zoom out one more ▸", () => showHier(hierStep + 1), { kind: "primary" }); }
    else if (has3d) { const r = K.buttonRow(hierBody); K.button(r, "Zoom out: tissue ▸", () => showHier(1), { kind: "primary" }); }
  }
  function updateExplain(force) {
    if (!expBody || !sel || !specs[sel]) return;
    const sp = specs[sel];
    let paras = [];
    try { paras = C.narrative(sel, sp.narr(), lens.band); } catch (err) { console.error(err); }
    const html = paras.map((p) => `<p>${p}</p>`).join("");
    if (force || expBody._h !== html) { expBody._h = html; expBody.innerHTML = html; }
  }

  // ---------- match the job (drag a job card onto its cell; or tap a card, then tap the cell) ----------
  function buildMatch(el) {
    const card = K.card(el, lens.pick({ "y7-8": "Match each cell to its job", "y9-10": "Match the job" }));
    matchCard = card;
    const list = MATCH_LIST();
    const order = list.slice().sort((a, b) => hash(a.length * 7 + a.charCodeAt(0)) - hash(b.length * 7 + b.charCodeAt(0)));
    const wrap = document.createElement("div"); wrap.className = "match";
    const left = document.createElement("div"); left.className = "match-col"; left.innerHTML = `<h3>Cells</h3>`;
    const right = document.createElement("div"); right.className = "match-col"; right.innerHTML = `<h3>Jobs</h3>`;
    const cells = {}, jobs = {};
    let held = null;
    const setHeld = (id) => { held = id; Object.entries(jobs).forEach(([k, j]) => j.classList.toggle("sel", k === id)); };
    const attempt = (jobId, cellId) => {
      const cEl = cells[cellId]; if (!cEl) return;
      if (jobId === cellId) {
        matched[cellId] = true; cEl.classList.add("done"); jobs[jobId].classList.add("used");
        cEl.querySelector("small").textContent = pick(specs[cellId].info.jobCard);
        engine.toast(`✅ ${specs[cellId].info.name}: ${pick(specs[cellId].info.jobCard)}`, 2600);
      } else {
        cEl.classList.remove("bad"); void cEl.offsetWidth; cEl.classList.add("bad");
        engine.toast(lens.pick({ "y7-8": "Not quite. Think about the shape of that cell.", "y9-10": "Not that one: which feature of the cell fits that job?" }), 2400);
      }
      setHeld(null);
    };
    for (const id of list) {
      const c = document.createElement("div"); c.className = "match-cell"; c.dataset.id = id;
      c.innerHTML = `<b><i style="background:${specs[id].info.color}"></i>${esc(specs[id].info.name)}</b><small>${matched[id] ? esc(pick(specs[id].info.jobCard)) : "drop a job here"}</small>`;
      if (matched[id]) c.classList.add("done");
      c.addEventListener("click", () => { if (held && !matched[id]) attempt(held, id); });
      cells[id] = c; left.appendChild(c);
    }
    for (const id of order) {
      const j = document.createElement("div"); j.className = "match-job"; j.dataset.id = id; j.textContent = pick(specs[id].info.jobCard);
      if (matched[id]) j.classList.add("used");
      let drag = null;
      j.addEventListener("pointerdown", (e) => {
        if (e.button) return;
        j.setPointerCapture(e.pointerId);
        drag = { x: e.clientX, y: e.clientY, ghost: null, moved: false };
      });
      j.addEventListener("pointermove", (e) => {
        if (!drag) return;
        if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) {
          drag.moved = true; drag.ghost = j.cloneNode(true); drag.ghost.className = "match-job match-ghost"; document.body.appendChild(drag.ghost);
        }
        if (drag.ghost) {
          drag.ghost.style.left = `${e.clientX}px`; drag.ghost.style.top = `${e.clientY}px`;
          const t = document.elementFromPoint(e.clientX, e.clientY)?.closest?.(".match-cell");
          Object.values(cells).forEach((c) => c.classList.toggle("over", c === t));
        }
      });
      const end = (e, cancel) => {
        if (!drag) return;
        const d = drag; drag = null;
        d.ghost?.remove(); Object.values(cells).forEach((c) => c.classList.remove("over"));
        if (cancel) return;
        if (!d.moved) { setHeld(held === id ? null : id); return; }
        const t = document.elementFromPoint(e.clientX, e.clientY);
        const cellEl = t?.closest?.(".match-cell");
        if (cellEl && !matched[cellEl.dataset.id]) { attempt(id, cellEl.dataset.id); return; }
        // dropped on the 3D stage: use whichever cell is under the pointer
        const r = engine.canvas.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom && !hierStep) {
          const hit = engine.pick(e.clientX, e.clientY);
          const cid = hit?.object?.userData?.spec;
          if (cid && cells[cid] && !matched[cid]) attempt(id, cid);
        }
      };
      j.addEventListener("pointerup", (e) => end(e, false));
      j.addEventListener("pointercancel", (e) => end(e, true));
      jobs[id] = j; right.appendChild(j);
    }
    wrap.append(left, right); card.appendChild(wrap);
    card.insertAdjacentHTML("beforeend", `<p class="hint">${lens.pick({ "y7-8": "Drag a job onto a cell here, or tap a job and then tap the cell. You can also drop it on a cell on the shelf (use “Whole gallery”).", "y9-10": "Drag a job onto its cell (or tap, then tap). You can also drop a job on a cell in the 3D shelf: choose “Whole gallery” first." })}</p>`);
  }

  function buildPanel(el) {
    node = document.createElement("div"); node.style.display = "contents"; el.appendChild(node);
    panelEl = el;
    const band = lens.band, y7 = band === "y7-8";
    // gallery selector
    const gal = K.card(node, "Gallery of specialists");
    gal.insertAdjacentHTML("beforeend", `<p style="margin:0 0 4px">${lens.pick({
      "y7-8": "Every cell in your body began the same. These cells grew up with special jobs. Pick one to fly to it: each is drawn at its true size on the shelf.",
      "y9-10": "A shelf of specialised cells at <b>true relative scale</b> (watch the scale bar). Pick one to fly to it, then change something to see how its structure does its job.",
      y11: "Specialised cells at true relative scale. Each demo is driven by a small model; the 'What's happening' card is generated from its numbers.",
    })}</p>`);
    const grid = document.createElement("div"); grid.className = "sp-pick"; gal.appendChild(grid);
    pickBtns = {};
    for (const [k, label] of [["animal", "Animal cells"], ["plant", "Plant cells"]]) {
      const h = document.createElement("div"); h.className = "sp-sub"; h.textContent = label; grid.appendChild(h);
      for (const id of kingdomIds(k)) {
        const b = document.createElement("button"); b.type = "button"; b.className = "btn"; b.setAttribute("aria-pressed", String(id === sel));
        b.innerHTML = `<i style="background:${specs[id].info.color};color:${specs[id].info.color}"></i><span>${esc(specs[id].info.name.replace(" (airway)", "").replace(" (with a stoma)", ""))}</span>`;
        b.addEventListener("click", () => focusSpec(id));
        grid.appendChild(b); pickBtns[id] = b;
      }
    }
    const nr = K.buttonRow(gal);
    K.button(nr, "◀ Previous", () => step(-1)); K.button(nr, "Whole gallery", () => overview(true)); K.button(nr, "Next ▶", () => step(1));
    K.checkbox(gal, "Show labels on the cell", showLabels, (v) => (showLabels = v));
    infoCard = K.card(node, "");
    ctlCard = K.card(node, "Try it");
    ctlBody = document.createElement("div"); ctlCard.appendChild(ctlBody);
    expCard = K.card(node, "What's happening");
    expBody = document.createElement("div"); expCard.appendChild(expBody);
    hierCard = K.card(node, lens.pick({ "y7-8": "From cell to organism", "y9-10": "Cell → tissue → organ → system → organism" }));
    hierBody = document.createElement("div"); hierCard.appendChild(hierBody);
    buildMatch(node);
    // differentiation
    const dif = K.card(node, lens.pick({ "y7-8": "Same instructions, different jobs", "y9-10": "Same genes, different cells", y11: "Cell differentiation" }));
    dif.insertAdjacentHTML("beforeend", `<p style="margin:0">${lens.pick({ "y7-8": "The cells with a nucleus in one living thing (like your muscle cells and nerve cells) carry the same set of instructions (DNA). Each one uses only the instructions it needs, so they end up different. (Red blood cells have lost their nucleus, and sperm carry only half the set.)", "y9-10": C.DIFFERENTIATION["y9-10"], y11: C.DIFFERENTIATION.y11 })}</p>`);
    const dots = document.createElement("div"); dots.className = "flow-key"; dots.style.marginTop = "8px";
    for (const id of ids) dots.insertAdjacentHTML("beforeend", `<span><i style="background:${specs[id].info.color};box-shadow:0 0 8px ${specs[id].info.color}"></i>${esc(specs[id].info.name.replace(" (airway)", "").replace(" (with a stoma)", ""))}</span>`);
    dif.appendChild(dots);
    // missions and quiz
    const sets = C.MISSION_SETS[band] || C.MISSION_SETS["y9-10"];
    const list = sets.map((id) => C.MISSIONS.find((m) => m.id === id)).filter(Boolean);
    mission = K.missions(node, list.map((m) => ({ text: m.text, check: () => m.check(ms) })), (m) => engine.toast(`🎯 Mission complete: ${m.text.replace(/<[^>]+>/g, "")}`, 3400));
    const qs = lens.filter(C.QUIZ), stride = qs.length > 6 ? qs.length / 6 : 1;
    quizEl = K.quiz(node, qs.length > 6 ? Array.from({ length: 6 }, (_, i) => qs[Math.floor(i * stride)]) : qs);
    const note = K.card(node, "About this model");
    note.insertAdjacentHTML("beforeend", `<p style="margin:0">${lens.pick(C.NOTE)}</p>`);
    progress = { band, node };
    renderSelection();
    buildChips();
  }
  function buildChips() {
    const ov = engine.overlay; ov.innerHTML = ""; chips = []; chipN = 0;
    if (!sel || !specs[sel]) { chips.push(K.chip(ov, "Pick a specialised cell on the shelf, or from the panel")); return; }
    const n = specs[sel].chips().length;
    for (let i = 0; i < n; i++) chips.push(K.chip(ov));
    updateChips();
  }
  function updateChips() {
    if (!sel || !specs[sel] || hierStep) { if (hierStep) { const need = 1; if (chips.length !== need) { engine.overlay.innerHTML = ""; chips = [K.chip(engine.overlay)]; } chips[0](`<i class="dot" style="background:#ffe066"></i>Illustration: not to scale`); } return; }
    const l = specs[sel].chips();
    if (l.length !== chips.length) { buildChips(); return; }
    l.forEach((h, i) => chips[i](h));
  }
  function mountNav() {
    if (nav) nav.remove();
    nav = document.createElement("div"); nav.className = "sp-nav";
    nav.innerHTML = `<button class="btn" type="button" data-a="prev" aria-label="Previous cell">◀</button><span class="nm"></span><button class="btn" type="button" data-a="all">Whole gallery</button><button class="btn" type="button" data-a="next" aria-label="Next cell">▶</button>`;
    nav.querySelector('[data-a="prev"]').onclick = () => step(-1);
    nav.querySelector('[data-a="next"]').onclick = () => step(1);
    nav.querySelector('[data-a="all"]').onclick = () => overview(true);
    engine.stageEl.appendChild(nav);
    navUpdate();
  }
  function navUpdate() { if (nav) nav.querySelector(".nm").textContent = sel && specs[sel] ? specs[sel].info.name : "Whole gallery"; }

  // ---------- the level object ----------
  const level = {
    title: "Specialised cells",
    topics: ["specialised-cells", "cell-structure", "organelles", "respiration", "photosynthesis", "osmosis", "active-transport", "diffusion", "plant-transport", "gas-exchange", "blood-transport", "epigenetics"],
    root, pickables, portals: [],
    metersPerUnit: 1e-6,
    get view() { return currentView(); },
    get showScale() { return !hierStep; },
    minDistance: 5, maxDistance: 9000, near: 0.3, far: 60000,
    env: { bg: ["#06182a", "#0b3a4a", "#2a1650"], fog: ["#082230", 0.00012], exposure: 1.05, bloom: [0.45, 0.55, 0.84], aperture: 0.0002 },
    clayEnv: { aperture: 0.0001 },
    info(obj) {
      const id = obj.userData.spec;
      if (!id || !specs[id]) return null;
      return { title: specs[id].info.name, kind: "specialist", portal: null };
    },
    onClick(e, hit) {
      const id = hit?.object?.userData?.spec;
      if (id && specs[id] && !hierStep) { if (id !== sel) focusSpec(id); return true; }
      return false;
    },
    mountPanel(el) {
      panelEl = el;
      if (progress && progress.band === lens.band) { el.appendChild(progress.node); node = progress.node; renderSelection(); buildChips(); }
      else buildPanel(el);
      mountNav();
    },
    unmountPanel() { hideLabels(); engine.overlay.innerHTML = ""; nav?.remove(); nav = null; },
    onResume() { buildChips(); mountNav(); },
    onLens() { progress = null; if (panelEl) { panelEl.innerHTML = ""; buildPanel(panelEl); } },
    onStyle() { /* the realistic and clay looks are handled by userData hints on the meshes */ },
    dispose() {
      for (const el of [...Object.values(names), ...Object.values(boards), ...feats]) el.remove();
      nav?.remove(); document.querySelectorAll(".match-ghost").forEach((n) => n.remove());
    },
    update(dt, t, rdt = dt) {
      const camD = engine.camera.position.distanceTo(engine.controls.target);
      // keep the clip planes and the depth of field sensible at every scale
      const near = clamp(camD * 0.012, 0.08, 40), far = Math.max(2500, camD * 90);
      if (Math.abs(near - engine.camera.near) / near > 0.06 || Math.abs(far - engine.camera.far) / far > 0.2) { engine.camera.near = near; engine.camera.far = far; engine.camera.updateProjectionMatrix(); }
      engine.bokeh.uniforms.aperture.value = 0.0065 / Math.max(10, camD) * (engine.style.clay ? 0.8 : 1);
      if (engine.style.clay) { const f = clamp(46 / camD, 0.025, 5); engine.style.U.freq.value = f; engine.style.U.amt.value = 1.15 / Math.max(0.2, f * 6); }
      for (const id of ids) { const b = specs[id].beacon, k = smooth(camD, 350, 1300); b.visible = k > 0.01; b.material.opacity = 0.75 * k; b.scale.setScalar(clamp(camD * 0.045, 20, 420)); }
      if (hierStep) hierScene(sel, hierStep).update?.();
      else if (sel === null) for (const id of ids) specs[id].update(dt, t, false);
      else if (specs[sel]) specs[sel].update(dt, t, true);
      if ((uiT -= rdt) <= 0) { uiT = 0.25; updateChips(); mission?.update(); }
      if ((exT -= rdt) <= 0) { exT = 0.5; updateExplain(); }
      updateLabels();
    },
  };
  return level;
}
