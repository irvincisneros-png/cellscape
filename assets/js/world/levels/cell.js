// Level 0: a living plant (leaf mesophyll) cell. Units: 1 world unit = 1 µm.
// The organelles are connected by a whole-cell model (plantCellModel.js): visible flows of glucose,
// O₂, CO₂, ATP, mRNA, protein vesicles and water show how each organelle depends on the others.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import * as K from "../../kit.js";
import { physical, glass, specks, hash, wobble, softDot } from "../materials.js";
import { PlantCellModel } from "./plantCellModel.js";
import { ORGANELLES, SWITCHES, FLOWS, MISSIONS, QUIZ, narrative } from "./cellContent.js";

const HX = 28, HY = 17, HZ = 17;               // membrane half-extents (µm)
const NUC = new THREE.Vector3(-20.5, 1.5, 0), NUC_R = 5;
const VAC = new THREE.Vector3(5, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);

/** Random point just inside the membrane, `inset` µm in from a face, plus that face's normal. */
function cortexPoint(seed, inset, avoid = []) {
  for (let k = 0; k < 60; k++) {
    const s = seed * 7.13 + k * 1.37;
    const areas = [HY * HZ, HY * HZ, HX * HZ, HX * HZ, HX * HY, HX * HY];
    const tot = areas.reduce((a, b) => a + b);
    let r = hash(s) * tot, f = 0;
    while (r > areas[f]) r -= areas[f++];
    const ax = f >> 1, sgn = f % 2 ? -1 : 1;
    const H = [HX, HY, HZ], p = new THREE.Vector3(), n = new THREE.Vector3();
    const u = hash(s + 1) * 2 - 1, v = hash(s + 2) * 2 - 1;
    const others = [0, 1, 2].filter((a) => a !== ax);
    p.setComponent(ax, sgn * (H[ax] - inset));
    p.setComponent(others[0], u * (H[others[0]] - 6));
    p.setComponent(others[1], v * (H[others[1]] - 6));
    n.setComponent(ax, sgn);
    if (p.distanceTo(NUC) < NUC_R + 3) continue;
    if (avoid.some((q) => q.distanceTo(p) < 3.2)) continue;
    return { p, n };
  }
  return { p: new THREE.Vector3(0, HY - inset, 0), n: UP.clone() };
}

function quatFromNormal(n, spin) {
  const q = new THREE.Quaternion().setFromUnitVectors(UP, n);
  return q.multiply(new THREE.Quaternion().setFromAxisAngle(UP, spin));
}

export function create(engine) {
  const M = new PlantCellModel();
  const lens = engine.lens;
  const root = new THREE.Group();
  const pickables = [];
  const portals = [];
  const org = { chloroplast: [], mitochondrion: [], golgi: [], er: [], peroxisome: [] };
  const tmpM = new THREE.Matrix4(), tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3();

  const tag = (mesh, kind, i = 0) => { mesh.userData.kind = kind; mesh.userData.i = i; pickables.push(mesh); return mesh; };

  // ---------- wall, membrane, neighbours ----------
  const wallMat = glass("#2f7d4f", { rim: "#86efac", minAlpha: 0.035, maxAlpha: 0.5, rimStrength: 0.5 });
  const wall = new THREE.Mesh(new RoundedBoxGeometry(2 * HX + 2.6, 2 * HY + 2.6, 2 * HZ + 2.6, 5, 7.2), wallMat);
  root.add(wall);
  const memMat = glass("#a78bfa", { rim: "#ddd6fe", minAlpha: 0.02, maxAlpha: 0.3, rimStrength: 0.45 });
  const membrane = new THREE.Mesh(new RoundedBoxGeometry(2 * HX, 2 * HY, 2 * HZ, 5, 6), memMat);
  root.add(membrane);
  const nbMat = glass("#2f7d4f", { rim: "#4ade80", minAlpha: 0.0, maxAlpha: 0.12, rimStrength: 0.18 });
  const nbGeo = new RoundedBoxGeometry(2 * HX + 2.6, 2 * HY + 2.6, 2 * HZ + 2.6, 3, 7.2);
  for (const [x, y, z] of [[-59.5, 0, 0], [59.5, 0, 0], [0, 37.5, 0], [0, -37.5, 0], [-30, 0, -40], [30, 0, -40], [0, 0, 40]]) {
    const nb = new THREE.Mesh(nbGeo, nbMat);
    nb.position.set(x, y, z);
    root.add(nb);
    for (let i = 0; i < 6; i++) { // a few chloroplast hints in neighbours
      const c = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), physical("#2f9e5a", { transparent: true, opacity: 0.5 }));
      c.scale.set(2.4, 0.9, 1.4);
      c.position.set(x + (hash(i + x) - 0.5) * 40, y + (hash(i * 3 + y) - 0.5) * 24, z + (hash(i * 7 + z) - 0.5) * 24);
      root.add(c);
    }
  }
  // plasmodesmata through the end walls
  const pdGeo = new THREE.CylinderGeometry(0.22, 0.22, 3, 8);
  pdGeo.rotateZ(Math.PI / 2);
  const pd = new THREE.InstancedMesh(pdGeo, physical("#3f6f52", { roughness: 0.6 }), 24);
  for (let i = 0; i < 24; i++) {
    tmpV.set(i < 12 ? -HX - 1.3 : HX + 1.3, (hash(i) - 0.5) * 24, (hash(i + 50) - 0.5) * 24);
    pd.setMatrixAt(i, tmpM.makeTranslation(tmpV.x, tmpV.y, tmpV.z));
  }
  root.add(pd);
  // pick handle for the wall: an invisible slab on the front face (so clicks inside aren't blocked)
  const wallHandle = new THREE.Mesh(new THREE.BoxGeometry(2 * HX, 2 * HY, 0.6), new THREE.MeshBasicMaterial({ visible: false }));
  wallHandle.position.z = HZ + 1.4;
  wallHandle.scale.set(0.98, 0.98, 1);

  // ---------- vacuole ----------
  const vacGeo = wobble(new RoundedBoxGeometry(38, 24, 24, 6, 9), 0.5, 0.18, 2);
  const vacuole = tag(new THREE.Mesh(vacGeo, glass("#38bdf8", { rim: "#bae6fd", minAlpha: 0.05, maxAlpha: 0.55, rimStrength: 0.6 })), "vacuole");
  vacuole.position.copy(VAC);
  root.add(vacuole);

  // ---------- nucleus ----------
  const nucleus = new THREE.Group();
  nucleus.position.copy(NUC);
  const nucShell = tag(new THREE.Mesh(new THREE.SphereGeometry(NUC_R, 48, 32), glass("#8b5cf6", { rim: "#c4b5fd", minAlpha: 0.14, maxAlpha: 0.85, rimStrength: 0.7 })), "nucleus");
  const nucleolus = new THREE.Mesh(new THREE.SphereGeometry(1.6, 32, 20), physical("#5b21b6", { emissive: new THREE.Color("#7c3aed"), emissiveIntensity: 0.25 }));
  nucleolus.position.set(0.9, 0.7, 0.4);
  nucleus.add(nucShell, nucleolus);
  const chromMat = physical("#e879f9", { emissive: new THREE.Color("#a21caf"), emissiveIntensity: 0.25, roughness: 0.5 });
  for (let i = 0; i < 9; i++) {
    const pts = [];
    for (let k = 0; k < 7; k++) pts.push(new THREE.Vector3((hash(i * 9 + k) - 0.5) * 6.5, (hash(i * 9 + k + 3) - 0.5) * 6.5, (hash(i * 9 + k + 6) - 0.5) * 6.5).clampLength(0, 3.9));
    nucleus.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.11, 6), chromMat));
  }
  const poreGeo = new THREE.TorusGeometry(0.28, 0.09, 8, 16);
  const pores = new THREE.InstancedMesh(poreGeo, physical("#ede9fe", { emissive: new THREE.Color("#a78bfa"), emissiveIntensity: 0.4 }), 110);
  const poreDirs = [];
  for (let i = 0; i < 110; i++) {
    const y = 1 - (i / 109) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963;
    const d = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
    poreDirs.push(d);
    tmpQ.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
    pores.setMatrixAt(i, tmpM.compose(d.clone().multiplyScalar(NUC_R), tmpQ, tmpS.set(1, 1, 1)));
  }
  nucleus.add(pores);
  root.add(nucleus);

  // ---------- chloroplasts ----------
  const placed = [];
  const chloroMat = glass("#16a34a", { rim: "#86efac", minAlpha: 0.38, maxAlpha: 0.95, rimStrength: 0.5 });
  const chloroGeo = new THREE.SphereGeometry(1, 40, 24);
  const NCH = 18, GRANA = 5, DISCS = 5;
  const grana = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.34, 0.34, 0.1, 18), physical("#15803d", { emissive: new THREE.Color("#22c55e"), emissiveIntensity: 0.15 }), NCH * GRANA * DISCS);
  const starchMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), physical("#f8fafc", { roughness: 0.6 }), NCH);
  const granaLocal = [];
  for (let g = 0; g < GRANA; g++) {
    const gx = -1.5 + g * 0.75, gz = (g % 2 ? 0.35 : -0.35);
    for (let d = 0; d < DISCS; d++) granaLocal.push(new THREE.Vector3(gx, -0.25 + d * 0.12, gz));
  }
  for (let i = 0; i < NCH; i++) {
    const { p, n } = cortexPoint(i + 1, 2.3, placed);
    placed.push(p);
    const mesh = tag(new THREE.Mesh(chloroGeo, chloroMat), "chloroplast", i);
    mesh.scale.set(2.5, 0.85, 1.45);
    const o = { mesh, base: p.clone(), n, q: quatFromNormal(n, hash(i * 3) * Math.PI * 2), phase: hash(i * 5) * 6.28, pos: p.clone() };
    mesh.position.copy(p); mesh.quaternion.copy(o.q);
    root.add(mesh);
    org.chloroplast.push(o);
  }
  root.add(grana, starchMesh);

  // ---------- mitochondria ----------
  const mitoMat = glass("#ea580c", { rim: "#fdba74", minAlpha: 0.4, maxAlpha: 0.95, rimStrength: 0.55 });
  const mitoGeo = new THREE.CapsuleGeometry(0.45, 1.4, 8, 20);
  mitoGeo.rotateZ(Math.PI / 2);
  const NMI = 22;
  const cristae = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.55, 0.62), physical("#c2410c"), NMI * 5);
  for (let i = 0; i < NMI; i++) {
    const { p, n } = cortexPoint(i + 101, 3.7, placed);
    placed.push(p);
    const mesh = tag(new THREE.Mesh(mitoGeo, mitoMat), "mitochondrion", i);
    const o = { mesh, base: p.clone(), n, q: quatFromNormal(n, hash(i * 11) * Math.PI * 2), phase: hash(i * 13) * 6.28, pos: p.clone() };
    mesh.position.copy(p); mesh.quaternion.copy(o.q);
    root.add(mesh);
    org.mitochondrion.push(o);
  }
  root.add(cristae);

  // ---------- rough ER (tubes radiating from the nucleus) ----------
  const erMat = glass("#14b8a6", { rim: "#99f6e4", minAlpha: 0.22, maxAlpha: 0.85, rimStrength: 0.5 });
  const riboPts = [];
  for (let i = 0; i < 13; i++) {
    const d = poreDirs[(i * 23) % 110].clone();
    if (d.x > 0.6) d.x = -d.x; // grow away from the vacuole side mostly
    const pts = [NUC.clone().addScaledVector(d, NUC_R + 0.4)];
    let cur = pts[0].clone();
    for (let k = 0; k < 5; k++) {
      cur = cur.clone().add(new THREE.Vector3(d.x * 1.6 + (hash(i * 31 + k) - 0.5) * 2.4, d.y * 1.6 + (hash(i * 37 + k) - 0.5) * 2.4, d.z * 1.6 + (hash(i * 41 + k) - 0.5) * 2.4));
      cur.x = THREE.MathUtils.clamp(cur.x, -HX + 1.5, -12); cur.y = THREE.MathUtils.clamp(cur.y, -HY + 1.5, HY - 1.5); cur.z = THREE.MathUtils.clamp(cur.z, -HZ + 1.5, HZ - 1.5);
      pts.push(cur);
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const mesh = tag(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.32, 8), erMat), "er", i);
    root.add(mesh);
    org.er.push({ mesh, curve, pos: curve.getPoint(0.55) });
    for (let k = 0; k < 26; k++) {
      const t = k / 26, c = curve.getPoint(t), a = hash(i * 100 + k) * 6.28;
      riboPts.push(c.x + Math.cos(a) * 0.38, c.y + Math.sin(a) * 0.38, c.z + Math.sin(a * 1.7) * 0.2);
    }
  }
  const riboGeo = new THREE.BufferGeometry();
  riboGeo.setAttribute("position", new THREE.Float32BufferAttribute(riboPts, 3));
  root.add(new THREE.Points(riboGeo, new THREE.PointsMaterial({ color: "#1e3a8a", size: 0.22, sizeAttenuation: true })));

  // ---------- Golgi ----------
  const golgiMat = physical("#e9c49a", { roughness: 0.45, clearcoat: 0.5, emissive: new THREE.Color("#7c5a3a"), emissiveIntensity: 0.12 });
  const cisGeo = new THREE.SphereGeometry(1, 36, 8, 0, Math.PI * 2, 0, 0.55);
  for (const [i, pos] of [[0, new THREE.Vector3(-12.5, -9, 9)], [1, new THREE.Vector3(-12, 10, -9)], [2, new THREE.Vector3(-15, -11, -8)]]) {
    const g = new THREE.Group();
    g.position.copy(pos);
    g.lookAt(NUC);
    for (let k = 0; k < 5; k++) {
      const c = tag(new THREE.Mesh(cisGeo, golgiMat), "golgi", i);
      const r = 2.1 - k * 0.15;
      c.scale.set(r, 0.9, r * 0.75);
      c.rotation.x = Math.PI / 2;
      c.position.z = -k * 0.32;
      g.add(c);
    }
    root.add(g);
    org.golgi.push({ mesh: g, pos });
  }

  // ---------- peroxisomes + cytosol specks ----------
  const perMat = glass("#eab308", { rim: "#fde047", minAlpha: 0.45, maxAlpha: 0.95 });
  for (let i = 0; i < 7; i++) {
    const { p } = cortexPoint(i + 300, 3.0, placed);
    const m = tag(new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 14), perMat), "peroxisome", i);
    m.position.copy(p);
    root.add(m);
    org.peroxisome.push({ mesh: m, pos: p });
  }
  const cyto = specks(1400, 0.16, [2 * HX - 2, 2 * HY - 2, 2 * HZ - 2], ["#99f6e4", "#c4b5fd", "#fef3c7"], 0.35);
  root.add(cyto);
  const outside = specks(900, 0.5, [260, 160, 200], undefined, 0.35);
  root.add(outside);

  // ---------- membrane "dive" marker ----------
  const MEM_SPOT = new THREE.Vector3(6, -7, HZ);
  const marker = tag(new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.16, 12, 48), physical("#5eead4", { emissive: new THREE.Color("#2dd4bf"), emissiveIntensity: 1.2 })), "membrane");
  marker.position.copy(MEM_SPOT);
  root.add(marker);
  const markerDisc = tag(new THREE.Mesh(new THREE.CircleGeometry(1.7, 32), new THREE.MeshBasicMaterial({ color: "#5eead4", transparent: true, opacity: 0.08, depthWrite: false })), "membrane");
  markerDisc.position.copy(MEM_SPOT);
  root.add(markerDisc);
  wallHandle.userData.kind = "wall"; root.add(wallHandle);   // fallback pick only — see level.fallbackPickables

  // ---------- cytosol "dive" marker (enzymes) ----------
  const CYTO_SPOT = new THREE.Vector3(-9, 9.5, 11.5);
  const cytoMarker = tag(new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.13, 12, 40), physical("#fbbf24", { emissive: new THREE.Color("#f59e0b"), emissiveIntensity: 1.0 })), "cytosol");
  cytoMarker.position.copy(CYTO_SPOT);
  root.add(cytoMarker);
  const cytoLbl = engine.label("🔍 Zoom into the cytosol (enzymes)", "dive");

  // ---------- sunlight ----------
  const sun = new THREE.DirectionalLight("#fff5d6", 2.0);
  sun.position.set(-20, 60, 30);
  root.add(sun);

  // ---------- portals ----------
  const has = (id) => !!engine.levelsDef[id];
  const fallback = (kind) => () => engine.select(infoFor(kind));
  portals.push({ to: "membrane", label: "Cell membrane", object: marker, objects: [marker, markerDisc], radius: 2.2, center: () => marker.getWorldPosition(new THREE.Vector3()) });
  for (const o of org.chloroplast) portals.push({ to: "chloroplast", label: "Chloroplast", object: o.mesh, radius: 2.6, center: () => o.mesh.getWorldPosition(new THREE.Vector3()), auto: has("chloroplast"), fallback: fallback("chloroplast") });
  for (const o of org.mitochondrion) portals.push({ to: "mitochondrion", label: "Mitochondrion", object: o.mesh, radius: 1.4, center: () => o.mesh.getWorldPosition(new THREE.Vector3()), auto: has("mitochondrion"), fallback: fallback("mitochondrion") });
  portals.push({ to: "enzymes", label: "Cytosol", object: cytoMarker, radius: 1.6, center: () => cytoMarker.getWorldPosition(new THREE.Vector3()), auto: has("enzymes"), fallback: fallback("cytosol") });
  portals.push({ to: "nucleus", label: "Nucleus", object: nucShell, radius: NUC_R, center: () => NUC.clone(), auto: has("nucleus"), fallback: fallback("nucleus") });

  // ---------- flows ----------
  const flowMeshes = {};
  const flowGeo = {
    light: new THREE.CapsuleGeometry(0.12, 1.4, 4, 8),
    glucose: new THREE.TorusGeometry(0.32, 0.12, 6, 6),
    o2: new THREE.CapsuleGeometry(0.22, 0.3, 4, 10),
    co2: new THREE.CapsuleGeometry(0.2, 0.5, 4, 10),
    atp: new THREE.SphereGeometry(0.3, 14, 10),
    mrna: new THREE.CapsuleGeometry(0.12, 1.2, 4, 8),
    protein: new THREE.SphereGeometry(0.55, 18, 12),
    water: new THREE.SphereGeometry(0.22, 12, 8),
  };
  for (const [k, f] of Object.entries(FLOWS)) {
    const mat = k === "protein"
      ? glass(f.color, { rim: "#fbcfe8", minAlpha: 0.35, maxAlpha: 0.95, emissive: new THREE.Color(f.color), emissiveIntensity: 0.4 })
      : physical(f.color, { emissive: new THREE.Color(f.color), emissiveIntensity: k === "atp" || k === "light" ? 1.4 : 0.45 });
    const mesh = new THREE.InstancedMesh(flowGeo[k], mat, 90);
    mesh.count = 0; mesh.frustumCulled = false;
    root.add(mesh);
    flowMeshes[k] = { mesh, parts: [], acc: 0 };
  }
  const flowOn = { energy: true, gases: true, protein: true, water: true };

  const nearest = (list, p, n = 3, seed = Math.random()) => {
    const s = list.map((o) => [o, o.pos.distanceToSquared(p)]).sort((a, b) => a[1] - b[1]).slice(0, n);
    return s[Math.floor(seed * s.length)][0];
  };
  const memPoint = (near) => { // point on the membrane closest to `near`
    const p = near.clone(), d = [HX - Math.abs(p.x), HY - Math.abs(p.y), HZ - Math.abs(p.z)];
    const ax = d.indexOf(Math.min(...d));
    p.setComponent(ax, Math.sign(p.getComponent(ax) || 1) * [HX, HY, HZ][ax]);
    return p;
  };
  const outPoint = (near) => memPoint(near).multiplyScalar(1.12);
  const porePoint = (toward) => {
    const d = toward.clone().sub(NUC).normalize();
    return NUC.clone().addScaledVector(d, NUC_R);
  };

  function spawn(kind, from, to, speed = 5) {
    const fm = flowMeshes[kind];
    if (fm.parts.length >= 90) return;
    const mid = from.clone().lerp(to, 0.5);
    const off = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(from.distanceTo(to) * 0.35);
    // keep paths out of the vacuole: push the control point toward the cortex
    const ctrl = mid.add(off);
    if (Math.abs(ctrl.x - VAC.x) < 18 && Math.abs(ctrl.y) < 11 && Math.abs(ctrl.z) < 11) ctrl.copy(memPoint(ctrl).multiplyScalar(0.9));
    fm.parts.push({ a: from.clone(), b: to.clone(), c: ctrl, t: 0, dur: Math.max(1.2, from.distanceTo(to) / speed), spin: Math.random() * 6 });
  }

  function emitFlows(dt) {
    const F = M.flux, r = Math.random;
    const want = (kind, rate, fn) => {
      const fm = flowMeshes[kind], group = FLOWS[kind].group;
      if (!flowOn[group] || !lens.atLeast(FLOWS[kind].band || "y7-8")) return;
      fm.acc += Math.max(0, rate) * dt;
      while (fm.acc >= 1) { fm.acc -= 1; fn(); }
    };
    const pickC = () => org.chloroplast[Math.floor(r() * org.chloroplast.length)];
    const pickM = () => org.mitochondrion[Math.floor(r() * org.mitochondrion.length)];
    if (M.on.chloroplast) want("light", M.light * 0.05, () => {
      const c = pickC();
      spawn("light", c.pos.clone().add(new THREE.Vector3(-6, 16, 8)), c.pos, 14);
    });
    want("glucose", F.resp * 1.6, () => { const m = pickM(); spawn("glucose", nearest(org.chloroplast, m.pos).pos, m.pos, 4); });
    want("o2", Math.min(F.photo, F.resp) * 1.2, () => { const m = pickM(); spawn("o2", nearest(org.chloroplast, m.pos).pos, m.pos, 5); });
    want("o2", F.o2Out * 1.3, () => { const c = pickC(); spawn("o2", c.pos, outPoint(c.pos), 5); });
    want("o2", -F.o2Out * 1.3, () => { const m = pickM(); spawn("o2", outPoint(m.pos), m.pos, 5); });
    want("co2", Math.min(F.photo, F.resp) * 1.2, () => { const m = pickM(); spawn("co2", m.pos, nearest(org.chloroplast, m.pos).pos, 5); });
    want("co2", F.co2In * 1.3, () => { const c = pickC(); spawn("co2", outPoint(c.pos), c.pos, 5); });
    want("co2", -F.co2In * 1.3, () => { const m = pickM(); spawn("co2", m.pos, outPoint(m.pos), 5); });
    const aerobic = F.resp * 4.2, anaerobic = F.ferment * 1.0;
    const atpRate = (aerobic + anaerobic) * 0.9;
    const sinks = [
      [F.transcribe * 0.8, () => porePoint(new THREE.Vector3(0, 0, 0)).add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(4))],
      [F.translate * 1.2, () => org.er[Math.floor(r() * org.er.length)].pos],
      [(F.toGolgi + F.secrete) * 0.5, () => org.golgi[Math.floor(r() * org.golgi.length)].pos],
      [F.pump, () => memPoint(new THREE.Vector3((r() - 0.5) * 50, (r() - 0.5) * 30, (r() - 0.5) * 30))],
    ];
    const sinkTot = sinks.reduce((a, s) => a + s[0], 0) || 1;
    want("atp", Math.min(atpRate, sinkTot) * 1.4, () => {
      let x = r() * sinkTot, s = 0;
      while (s < sinks.length - 1 && x > sinks[s][0]) x -= sinks[s++][0];
      const to = sinks[s][1]();
      // ATP comes from the mitochondria (aerobic) or from glycolysis in the cytosol (when that's most of it)
      const fromMito = M.on.mitochondrion && r() < aerobic / (aerobic + anaerobic || 1);
      const src = fromMito ? nearest(org.mitochondrion, to, 4).pos : to.clone().add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(10));
      spawn("atp", src, to, 6);
    });
    want("mrna", F.export * 2.2, () => { const e = org.er[Math.floor(r() * org.er.length)]; spawn("mrna", porePoint(e.pos), e.curve.getPoint(0.25 + r() * 0.5), 3); });
    want("protein", F.toGolgi * 1.4, () => { const g = org.golgi[Math.floor(r() * org.golgi.length)]; spawn("protein", nearest(org.er, g.pos, 4).pos, g.pos, 3); });
    want("protein", F.secrete * 1.6, () => { const g = org.golgi[Math.floor(r() * org.golgi.length)]; spawn("protein", g.pos, memPoint(g.pos.clone().add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(14))), 3); });
    want("water", F.water * 0.9, () => { const p = memPoint(new THREE.Vector3((r() - 0.3) * 44, (r() - 0.5) * 30, (r() - 0.5) * 30)); spawn("water", p, VAC.clone().lerp(p, 0.55), 5); });
    want("water", -F.water * 0.9, () => { const p = memPoint(new THREE.Vector3((r() - 0.3) * 44, (r() - 0.5) * 30, (r() - 0.5) * 30)); spawn("water", VAC.clone().lerp(p, 0.55), p.multiplyScalar(1.12), 5); });
  }

  const tEu = new THREE.Euler();
  function drawFlows(dt) {
    for (const [k, fm] of Object.entries(flowMeshes)) {
      let n = 0;
      fm.parts = fm.parts.filter((p) => (p.t += dt / p.dur) < 1);
      for (const p of fm.parts) {
        const t = p.t, u = 1 - t;
        tmpV.set(0, 0, 0).addScaledVector(p.a, u * u).addScaledVector(p.c, 2 * u * t).addScaledVector(p.b, t * t);
        if (k === "light" || k === "mrna") tmpQ.setFromUnitVectors(UP, tA.copy(p.b).sub(p.a).normalize());
        else tmpQ.setFromEuler(tEu.set(p.spin + t * 3, p.spin * 0.7 + t * 2, 0));
        const s = Math.min(1, t * 6, (1 - t) * 6);
        fm.mesh.setMatrixAt(n++, tmpM.compose(tmpV, tmpQ, tmpS.set(s, s, s)));
      }
      fm.mesh.count = n;
      fm.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  // ---------- per-frame organelle motion ----------
  const tA = new THREE.Vector3(), tQ2 = new THREE.Quaternion(), tAx = new THREE.Vector3();
  function animate(t) {
    const still = engine.reducedMotion;
    let gi = 0;
    org.chloroplast.forEach((o, i) => {
      const drift = still ? 0 : Math.sin(t * 0.08 + o.phase) * 0.9;
      o.pos.copy(o.base).addScaledVector(tAx.set(o.n.y, o.n.z, o.n.x), drift);
      o.mesh.position.copy(o.pos);
      const dim = M.on.chloroplast ? 1 : 0.35;
      o.mesh.updateMatrix();
      for (const L of granaLocal) {
        tmpV.copy(L).applyQuaternion(o.q).add(o.pos);
        grana.setMatrixAt(gi++, tmpM.compose(tmpV, o.q, tmpS.set(dim, 1, dim)));
      }
      const st = 0.15 + (M.starch / 100) * 0.4;
      tmpV.set(1.0, 0.0, 0.2).applyQuaternion(o.q).add(o.pos);
      starchMesh.setMatrixAt(i, tmpM.compose(tmpV, o.q, tmpS.set(st * 1.4, st * 0.7, st)));
    });
    grana.instanceMatrix.needsUpdate = true;
    starchMesh.instanceMatrix.needsUpdate = true;
    let ci = 0;
    org.mitochondrion.forEach((o) => {
      const drift = still ? 0 : Math.sin(t * 0.11 + o.phase) * 1.2;
      o.pos.copy(o.base).addScaledVector(tAx.set(o.n.z, o.n.x, o.n.y), drift);
      o.mesh.position.copy(o.pos);
      const q = tQ2.copy(o.q).multiply(tmpQ.setFromAxisAngle(UP, still ? 0 : Math.sin(t * 0.2 + o.phase) * 0.3));
      o.mesh.quaternion.copy(q);
      for (let k = 0; k < 5; k++) {
        tA.set(-0.75 + k * 0.38, 0, 0).applyQuaternion(q).add(o.pos);
        cristae.setMatrixAt(ci++, tmpM.compose(tA, q, tmpS.set(1, 1, 1)));
      }
    });
    cristae.instanceMatrix.needsUpdate = true;
    const glow = 0.25 + 0.75 * Math.min(1, M.flux.resp / 3);
    mitoMat.emissive.set("#f97316").multiplyScalar(M.on.mitochondrion ? glow * 0.6 : 0);
    chloroMat.emissive.set("#22c55e").multiplyScalar(M.on.chloroplast ? Math.min(1, M.flux.photo / 4) * 0.5 : 0);
    // vacuole size follows turgor; the membrane pulls away from the wall when the cell is flaccid
    const vs = 0.72 + 0.28 * (M.turgor / 100);
    vacuole.scale.set(vs, 0.6 + 0.4 * vs, 0.6 + 0.4 * vs);
    const ms = M.turgor < 35 ? 1 - ((35 - M.turgor) / 35) * 0.07 : 1;
    membrane.scale.setScalar(ms);
    marker.rotation.z = still ? 0 : t * 0.4;
    cytoMarker.rotation.y = still ? 0 : t * 0.6;
    marker.material.emissiveIntensity = 0.9 + Math.sin(t * 2.5) * 0.4;
    sun.intensity = 0.2 + 2.6 * (M.light / 100);
    pores.material.emissiveIntensity = M.on.pores ? 0.4 : 0.0;
    pores.material.color.set(M.on.pores ? "#ede9fe" : "#7f1d1d");
    cyto.rotation.y = Math.sin(t * 0.02) * 0.05;
  }

  // ---------- labels ----------
  const labels = {};
  const labelTargets = {
    nucleus: () => NUC.clone().add(new THREE.Vector3(0, NUC_R + 1.6, 0)),
    chloroplast: () => org.chloroplast[2].pos.clone().add(new THREE.Vector3(0, 2.2, 0)),
    mitochondrion: () => org.mitochondrion[5].pos.clone().add(new THREE.Vector3(0, 1.6, 0)),
    er: () => org.er[3].pos.clone().add(new THREE.Vector3(0, 1.2, 0)),
    golgi: () => org.golgi[0].pos.clone().add(new THREE.Vector3(0, 2.6, 0)),
    vacuole: () => VAC.clone().add(new THREE.Vector3(4, 4, 12.5)),
    wall: () => new THREE.Vector3(HX - 4, HY + 2.4, HZ + 1.3),
  };
  const statusKey = { nucleus: "nucleus", chloroplast: "chloroplast", mitochondrion: "mitochondrion", er: "er", golgi: "golgi", vacuole: "vacuole" };
  let showLabels = lens.band === "y7-8" || lens.band === "y9-10";
  const diveLbl = engine.label("🔍 Zoom into the membrane", "dive");

  function makeLabels() {
    for (const el of Object.values(labels)) el.remove();
    for (const k of Object.keys(labelTargets)) labels[k] = engine.label("", "org");
  }
  function updateLabels() {
    const st = M.status();
    for (const [k, el] of Object.entries(labels)) {
      if (!showLabels) { el.style.display = "none"; continue; }
      const name = lens.pick(ORGANELLES[k].name);
      const s = statusKey[k] ? st[statusKey[k]] : "";
      const html = `${name}${s ? `<small>${s}</small>` : ""}`;
      if (el._h !== html) { el.innerHTML = html; el._h = html; }
      el.classList.toggle("off", /off|stalled|stopped|starved|waiting|shrunk/.test(s));
      engine.place(el, labelTargets[k]());
    }
    engine.place(diveLbl, MEM_SPOT.clone().add(new THREE.Vector3(0, 2.8, 0.5)));
    engine.place(cytoLbl, CYTO_SPOT.clone().add(new THREE.Vector3(0, 2.2, 0.5)));
  }

  // ---------- selection highlight ----------
  const selGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: "#5eead4", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
  selGlow.visible = false;
  root.add(selGlow);

  // ---------- info ----------
  function infoFor(kind, obj) {
    const o = ORGANELLES[kind];
    if (!o) return null;
    const portal = obj ? portals.find((p) => p.object === obj || p.objects?.includes(obj)) : portals.find((p) => p.to === o.portal);
    return { kind, title: lens.pick(o.name), portal: portal && has(portal.to) ? portal : null, anyPortal: portal, object: obj };
  }

  // ---------- panel ----------
  let progress = null; // { band, node } — the built panel, kept across dives so missions/quiz survive
  let panelEl, explainBody, selCard, chips = {}, chart, chartCtx, mission, nightTime = 0, sec0 = 0, rows = {}, wasFlaccid = false;
  function buildPanel(el) {
    panelEl = el;
    el.innerHTML = "";
    const host = document.createElement("div");
    host.style.display = "contents";
    el.appendChild(host);
    progress = { band: lens.band, node: host };
    el = host;
    const band = lens.band;
    const ex = K.card(el, "What's happening", "explain");
    explainBody = document.createElement("div");
    ex.appendChild(explainBody);

    selCard = K.card(el, "Selected", "sel-card");
    selCard.style.display = "none";

    const env = K.card(el, "Conditions");
    K.slider(env, { label: "☀ Light", min: 0, max: 100, value: M.light, unit: " %", onInput: (v) => (M.light = v) });
    K.slider(env, { label: lens.pick({ "y7-8": "Carbon dioxide in the air", "y9-10": "CO₂ available" }), min: 0, max: 100, value: M.co2Out, unit: " %", onInput: (v) => (M.co2Out = v) });
    if (lens.atLeast("y9-10")) K.slider(env, { label: "Salt in the surrounding solution", min: 0, max: 100, value: M.outside, unit: " %", format: (v) => (v === 0 ? "pure water" : `${v} %`), onInput: (v) => (M.outside = v) });
    const r = K.buttonRow(env);
    K.button(r, "☀ Day", () => setLight(85));
    K.button(r, "☾ Night", () => setLight(0));
    K.button(r, "Reset cell", () => {
      M.reset(); sec0 = 0; tour = null; showStep(); engine.select(null);
      for (const fm of Object.values(flowMeshes)) { fm.parts.length = 0; fm.acc = 0; }
      progress = null; buildPanel(panelEl);
    });
    function setLight(v) { M.light = v; env.querySelector("input").value = v; env.querySelector("input").dispatchEvent(new Event("input")); }

    const sw = K.card(el, lens.pick({ "y7-8": "Switch organelles on and off", "y9-10": "Knock out a part" }));
    sw.insertAdjacentHTML("beforeend", `<p class="hint" style="margin:0 0 8px">${lens.pick({ "y7-8": "Turn something off and watch what else stops working.", "y9-10": "Turn a part off and follow the knock-on effects through the cell." })}</p>`);
    const list = document.createElement("div");
    list.className = "org-list";
    sw.appendChild(list);
    rows = {};
    for (const s of lens.filter(SWITCHES)) {
      const row = document.createElement("div");
      row.className = "org-row";
      const col = ORGANELLES[s.key]?.color || (s.key === "pores" ? "#ede9fe" : s.key === "pumps" ? "#c4b5fd" : "#38bdf8");
      row.innerHTML = `<i style="background:${col}"></i><button type="button" class="org-name" title="Show me">${lens.pick(s.label)}<small></small></button><label class="switch"><input type="checkbox" ${M.on[s.key] ? "checked" : ""} aria-label="${lens.pick(s.label)} on"><span></span></label>`;
      const cb = row.querySelector("input");
      cb.addEventListener("change", () => {
        M.on[s.key] = cb.checked;
        engine.toast?.(`${lens.pick(s.label)} ${cb.checked ? "on" : "off"}`);
        if (engine.selected) showSelection(engine.selected);
      });
      row.querySelector(".org-name").addEventListener("click", () => { const kind = ORGANELLES[s.key] ? s.key : s.key === "pores" ? "nucleus" : s.key === "pumps" || s.key === "aquaporins" ? "membrane" : null; if (kind) focusOn(kind); });
      list.appendChild(row);
      rows[s.key] = row;
    }

    const fk = K.card(el, "What's moving");
    const key = document.createElement("div");
    key.className = "flow-key";
    const groups = { energy: "Energy", gases: "Gases", protein: "Proteins", water: "Water" };
    for (const [k, f] of Object.entries(FLOWS)) {
      if (!lens.atLeast(f.band || "y7-8")) continue;
      key.insertAdjacentHTML("beforeend", `<span><i style="background:${f.color};box-shadow:0 0 8px ${f.color}"></i>${lens.pick(f.label)}</span>`);
    }
    fk.appendChild(key);
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
    ch.insertAdjacentHTML("beforeend", `<div class="legend" style="margin-top:6px"><span><i style="background:#fbbf24"></i>${lens.pick({ "y7-8": "Energy (ATP)", "y9-10": "ATP" })}</span><span><i style="background:#a3e635"></i>Glucose</span><span><i style="background:#f8fafc"></i>Starch</span><span><i style="background:#38bdf8"></i>Water (turgor)</span></div>`);

    const tours = K.card(el, "Guided tours");
    const tr = K.buttonRow(tours);
    K.button(tr, "Follow the energy", () => startTour("energy"));
    K.button(tr, "Follow a secreted protein", () => startTour("protein"));

    nightTime = 0; sec0 = M.secreted;
    wasFlaccid = false;
    mission = K.missions(el, lens.filter(MISSIONS).map((m) => ({ text: m.text, check: () => m.check(M, { nightTime, sec0, wasFlaccid }) })), (m) => engine.toast(`🎯 Mission complete: ${m.text.replace(/<[^>]+>/g, "")}`, 3400));
    K.quiz(el, lens.filter(QUIZ));
    buildChips();
  }

  function buildChips() {
    const ov = engine.overlay;
    ov.innerHTML = "";
    const y7 = lens.band === "y7-8";
    chips = {
      light: K.chip(ov), glucose: K.chip(ov), starch: K.chip(ov), atp: K.chip(ov), o2: K.chip(ov), water: K.chip(ov), wall: K.chip(ov),
    };
    chips._y7 = y7;
  }
  function updateChips() {
    const d = (c) => `<i class="dot" style="background:${c}"></i>`;
    const y7 = chips._y7;
    chips.light(`${d("#fde68a")}Light <b>${M.light.toFixed(0)}%</b>`);
    chips.glucose(`${d("#a3e635")}Glucose <b>${M.glucose.toFixed(0)}</b>`);
    chips.starch(`${d("#f8fafc")}Starch <b>${M.starch.toFixed(0)}</b>`);
    chips.atp(`${d("#fbbf24")}${y7 ? "Energy" : "ATP"} <b>${M.atp.toFixed(0)}</b>`);
    const o = M.flux.o2Out || 0;
    chips.o2(`${d("#f87171")}O₂ <b>${Math.abs(o) < 0.15 ? "balanced" : o > 0 ? "↑ released" : "↓ taken in"}</b>`);
    chips.water(`${d("#38bdf8")}${y7 ? "Firmness" : "Turgor"} <b>${M.turgor.toFixed(0)}%</b>`);
    chips.wall(`${d("#f472b6")}${y7 ? "Proteins delivered" : "Secreted cargo"} <b>${(M.secreted - sec0).toFixed(0)}</b>`);
  }

  function drawChart() {
    const w = chart.clientWidth, h = chart.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    if (!w) return;
    if (chart.width !== Math.round(w * dpr)) { chart.width = Math.round(w * dpr); chart.height = Math.round(h * dpr); }
    const c = chartCtx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    c.strokeStyle = "rgba(255,255,255,0.08)";
    for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(0, (h * i) / 4); c.lineTo(w, (h * i) / 4); c.stroke(); }
    const H = M.history;
    chart.setAttribute("aria-label", `Cell supplies now: ATP ${M.atp.toFixed(0)}, glucose ${M.glucose.toFixed(0)}, starch ${M.starch.toFixed(0)}, turgor ${M.turgor.toFixed(0)} percent.`);
    if (H.length < 2) return;
    for (const [k, col] of [["turgor", "#38bdf8"], ["starch", "#f8fafc"], ["glucose", "#a3e635"], ["atp", "#fbbf24"]]) {
      c.strokeStyle = col; c.lineWidth = 2; c.beginPath();
      H.forEach((p, i) => { const x = (i / 239) * w, y = h - (p[k] / 100) * (h - 4) - 2; i ? c.lineTo(x, y) : c.moveTo(x, y); });
      c.stroke();
    }
  }

  function updateExplain() {
    const paras = narrative(M, lens.band);
    const html = paras.map((p) => `<p>${p}</p>`).join("") +
      `<p class="hint">${lens.pick({ "y7-8": "Click any organelle to learn what it does. Drag to turn the cell; scroll to zoom in.", "y9-10": "Click an organelle for its inputs and outputs. Zoom in on the glowing ring to dive into the membrane." })}</p>`;
    if (explainBody.innerHTML !== html) explainBody.innerHTML = html;
  }

  function showSelection(info) {
    if (!selCard) return;
    if (!info) { selCard.style.display = "none"; selGlow.visible = false; return; }
    const o = ORGANELLES[info.kind];
    const st = M.status();
    const status = st[info.kind === "membrane" ? "pumps" : info.kind] || "";
    const zoom = info.portal ? `<button class="btn primary" data-act="zoom">Zoom in ▸</button>` : "";
    const sim = o.sim ? `<a class="btn" href="${engine.root}sims/${o.sim}/index.html">${info.portal ? "Open full simulation" : "Open the simulation"}</a>` : "";
    const sw = M.on[info.kind] !== undefined ? `<button class="btn" data-act="toggle">${M.on[info.kind] ? "Switch off" : "Switch on"}</button>` : "";
    selCard.style.display = "";
    selCard.innerHTML = `<h2>Selected</h2><p style="color:var(--ink);font-weight:600;margin-bottom:4px"><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${o.color};margin-right:6px"></i>${lens.pick(o.name)}</p>
      <p>${lens.pick(o.role)}</p>
      <div class="io"><b>In</b><span>${lens.pick(o.inputs)}</span><b>Out</b><span>${lens.pick(o.outputs)}</span><b>Feeds</b><span>${lens.pick(o.feeds)}</span>${status ? `<b>Now</b><span>${status}</span>` : ""}</div>
      <div class="btn-row">${zoom}${sw}${sim}</div>
      ${!info.portal && info.anyPortal ? `<p class="hint">A 3D zoom into the ${lens.pick(o.name).toLowerCase()} is coming in the next phase.</p>` : ""}`;
    selCard.querySelector('[data-act="zoom"]')?.addEventListener("click", () => engine.dive(info.portal));
    selCard.querySelector('[data-act="toggle"]')?.addEventListener("click", () => {
      M.on[info.kind] = !M.on[info.kind];
      const cb = rows[info.kind]?.querySelector("input"); if (cb) cb.checked = M.on[info.kind];
      showSelection(info);
    });
    selGlow.visible = !!info.object;
    if (info.object) {
      const p = info.object.getWorldPosition(new THREE.Vector3());
      selGlow.position.copy(p);
      const bs = new THREE.Box3().setFromObject(info.object).getSize(new THREE.Vector3());
      selGlow.scale.setScalar(Math.max(bs.x, bs.y, bs.z) * 2.2);
    }
    if (panelEl) panelEl.parentElement.scrollTo?.({ top: 0, behavior: "smooth" });
  }

  function focusOn(kind) {
    if (engine.busy) return;
    const target = kind === "chloroplast" ? org.chloroplast[2].mesh : kind === "mitochondrion" ? org.mitochondrion[5].mesh : kind === "nucleus" ? nucShell
      : kind === "er" ? org.er[3].mesh : kind === "golgi" ? org.golgi[0].mesh.children[0] : kind === "vacuole" ? vacuole : kind === "membrane" ? marker : null;
    if (!target) return;
    const p = target.getWorldPosition(new THREE.Vector3());
    const dist = kind === "vacuole" ? 55 : kind === "nucleus" ? 26 : 16;
    const dir = engine.camera.position.clone().sub(engine.controls.target).normalize();
    engine.fly(p, p.clone().addScaledVector(dir, dist), 0.9);
    engine.select(infoFor(kind, target));
  }

  // ---------- tours ----------
  const TOURS = {
    energy: [
      { kind: "chloroplast", text: { "y7-8": "<b>1. Chloroplast.</b> Light energy is captured here. Carbon dioxide and water are turned into <b>glucose</b> and <b>oxygen</b>.", y11: "<b>1. Chloroplast.</b> Light-dependent reactions (thylakoids) make ATP + NADPH and release O₂; the Calvin cycle fixes CO₂ into sugar. Spare sugar → starch." } },
      { kind: "mitochondrion", text: { "y7-8": "<b>2. Mitochondrion.</b> Glucose and oxygen travel here. Respiration releases their energy as <b>ATP</b>, giving off carbon dioxide — which the chloroplast reuses!", y11: "<b>2. Mitochondrion.</b> Glycolysis in the cytosol makes pyruvate, which enters the mitochondrion and becomes acetyl-CoA for the Krebs cycle; the ETC and ATP synthase make most of the ATP. CO₂ diffuses back to the chloroplasts." } },
      { kind: "nucleus", text: { "y7-8": "<b>3. Where the energy goes.</b> ATP (gold) powers the nucleus, the ribosomes, the Golgi and the membrane pumps.", y11: "<b>3. ATP sinks.</b> Transcription (NTPs), translation (ATP/GTP), vesicle trafficking and the membrane H⁺-ATPase all draw on the ATP pool." } },
      { kind: "vacuole", text: { "y7-8": "<b>4. Staying firm.</b> Pumps use ATP to hold substances in, so water flows into the vacuole. No energy → no pumping → the plant wilts. Try it: switch off the mitochondria!", y11: "<b>4. Turgor depends on ATP.</b> Pumped solutes keep vacuolar water potential low, so water enters by osmosis. Knock out the mitochondria and watch turgor collapse." } },
    ],
    protein: [
      { kind: "nucleus", text: { "y7-8": "<b>1. Nucleus.</b> A gene's instructions are copied into a message called <b>mRNA</b>.", y11: "<b>1. Transcription.</b> RNA polymerase copies the gene; processed mRNA exits through nuclear pores." } },
      { kind: "er", text: { "y7-8": "<b>2. Ribosomes on the rough ER.</b> The mRNA (blue) reaches the ribosomes, which read it and build a <b>protein</b>.", y11: "<b>2. Translation.</b> ER-bound ribosomes translate the mRNA; the polypeptide enters the ER lumen and folds." } },
      { kind: "golgi", text: { "y7-8": "<b>3. Golgi apparatus.</b> Proteins arrive in vesicles (pink). The Golgi packs and labels them.", y11: "<b>3. Golgi.</b> Proteins are modified (e.g. glycosylated), sorted and packaged into secretory vesicles." } },
      { kind: "membrane", text: { "y7-8": "<b>4. Delivery.</b> Vesicles fuse with the cell membrane and release their cargo outside the cell. Zoom into the glowing ring to see the membrane up close.", y11: "<b>4. Exocytosis.</b> Vesicles fuse with the plasma membrane (ATP-dependent), releasing secreted proteins and wall-matrix polysaccharides and adding membrane proteins. (Cellulose itself is made at the membrane by cellulose synthase.) Dive into the membrane to see transport up close." } },
    ],
  };
  let tour = null;
  const cap = document.createElement("div");
  cap.className = "tour-cap";
  engine.stageEl.appendChild(cap);
  function startTour(name) { if (engine.busy) return; tour = { steps: TOURS[name], i: 0 }; showStep(); }
  function showStep() {
    if (!tour) { cap.style.display = "none"; return; }
    const s = tour.steps[tour.i];
    focusOn(s.kind);
    cap.style.display = "block";
    cap.innerHTML = `<div>${lens.pick(s.text)}</div><div class="row"><button class="btn" data-a="x">Exit tour</button>${tour.i > 0 ? `<button class="btn" data-a="b">← Back</button>` : ""}<button class="btn primary" data-a="n">${tour.i < tour.steps.length - 1 ? "Next →" : "Finish"}</button></div>`;
    cap.querySelector('[data-a="x"]').onclick = () => { tour = null; showStep(); };
    cap.querySelector('[data-a="b"]')?.addEventListener("click", () => { tour.i--; showStep(); });
    cap.querySelector('[data-a="n"]').onclick = () => { if (tour.i < tour.steps.length - 1) { tour.i++; showStep(); } else { tour = null; showStep(); engine.fly(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 30, 82), 1.2); } };
  }

  // ---------- level object ----------
  let uiT = 0, exT = 0, chT = 0;
  const level = {
    title: "Plant cell",
    model: M,   // read by child levels (e.g. the nucleus uses the cell's ATP)
    topics: ["cell-structure", "organelles", "photosynthesis", "respiration", "atp", "osmosis", "protein-synthesis"],
    root, pickables, portals,
    fallbackPickables: [wallHandle],
    metersPerUnit: 1e-6,
    get view() { const a = engine.camera.aspect; return { target: new THREE.Vector3(0, 0, 0), distance: Math.min(190, Math.max(100, 33 / (0.344 * a))), dir: new THREE.Vector3(0.12, 0.34, 1) }; },
    minDistance: 6, maxDistance: 190, near: 0.2, far: 1200,
    env: { bg: ["#0a1d33", "#123d3a", "#2a1650"], fog: ["#0a2230", 0.0045], exposure: 1.05, bloom: [0.45, 0.6, 0.85], aperture: 0.00055 },
    info(obj) {
      const kind = obj.userData.kind;
      if (!kind) return null;
      if (kind === "peroxisome" && !lens.atLeast("y11")) return null;
      return infoFor(kind, obj);
    },
    onSelect(info) { showSelection(info); },
    mountPanel(el) {
      makeLabels();
      if (progress && progress.band === lens.band) { panelEl = el; el.appendChild(progress.node); buildChips(); }
      else buildPanel(el);
    },
    unmountPanel() { for (const el of Object.values(labels)) el.style.display = "none"; diveLbl.style.display = "none"; cytoLbl.style.display = "none"; cap.style.display = "none"; engine.overlay.innerHTML = ""; },
    onResume() { makeLabels(); },
    onLens() { showLabels = lens.band === "y7-8" || lens.band === "y9-10"; progress = null; buildPanel(panelEl); },
    update(dt, t, rdt = dt) {
      M.step(dt);
      nightTime = M.light < 10 ? nightTime + dt : 0;
      if (M.turgor < 35 && M.outside > 20) wasFlaccid = true;
      emitFlows(dt);
      drawFlows(dt);
      animate(t);
      updateLabels();
      if (selGlow.visible) selGlow.material.opacity = 0.45 + 0.25 * Math.sin(t * 3);
      if ((uiT -= rdt) <= 0) {
        uiT = 0.25;
        updateChips();
        const st = M.status();
        for (const [k, row] of Object.entries(rows)) {
          const s = st[k] || (k === "pores" ? (M.on.pores ? (M.mrna > 70 ? "mRNA piling up" : "letting mRNA out") : "blocked") : k === "aquaporins" ? (M.on.aquaporins ? "letting water through" : "closed") : "");
          const sm = row.querySelector("small");
          if (sm.textContent !== s) sm.textContent = s;
          row.classList.toggle("off", !M.on[k] || /stalled|stopped|starved|waiting/.test(s));
        }
      }
      if ((exT -= rdt) <= 0) { exT = 0.6; updateExplain(); }
      if ((chT -= rdt) <= 0) { chT = 0.5; drawChart(); }
      mission?.update();
    },
  };
  return level;
}
