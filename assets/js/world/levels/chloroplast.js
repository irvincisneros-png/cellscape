// Organelle level: a working chloroplast. Units: 1 world unit = 0.1 µm (entryRadius 26 ↔ the cell's 2.6 µm portal).
// Glassy double envelope (cut away at the front), grana of instanced thylakoid discs joined by stroma lamellae,
// a stroma full of Rubisco, ribosomes, DNA loops, starch grains and plastoglobuli. A two-part model
// (chloroplastModel.js, built on the reviewed sims/photosynthesis/model.js) drives every visible flow.
import * as THREE from "three";
import * as K from "../../kit.js";
import { physical, glass, specks, hash, softDot } from "../materials.js";
import { ChloroplastModel } from "./chloroplastModel.js";
import { PARTS, FLOWS, SWITCHES, MISSIONS, QUIZ, narrative } from "./chloroplastContent.js";

const A = 25, B = 8.5, CZ = 14.5;            // envelope semi-axes (the cell's chloroplast is 2.5 × 0.85 × 1.45 µm)
const CUT = 3;                                 // the envelope is cut away where z > CUT
const SP = 0.56, TH = 0.36;                    // thylakoid disc spacing / thickness in a granum
const GRANA = [[-16, -2], [-10, 5], [-9, -6], [-3, 0], [-2, 8], [3, -7], [5, 4], [11, -2], [16, 4]];
const FEATURED = 3;                            // the granum with the glowing portal
const STARCH = [new THREE.Vector3(-12, -4.6, -1), new THREE.Vector3(8, -5, -5), new THREE.Vector3(-5, -5.2, 5)];
const UP = new THREE.Vector3(0, 1, 0), XA = new THREE.Vector3(1, 0, 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const CSS = `
.lbl3d.cp { background: rgba(5,11,22,0.6); border: 1px solid rgba(134,239,172,0.28); padding: 2px 8px; border-radius: 999px; color: var(--ink); backdrop-filter: blur(4px); }
.lbl3d.cp small { display: block; font-size: 0.66rem; color: var(--ink-dim); text-align: center; }
.lbl3d.cp.off { border-color: rgba(248,113,113,0.6); } .lbl3d.cp.off small { color: #fca5a5; }
.cp-chip .lim { font-weight: 600; }
@media (max-width: 600px) { .cp-chip.opt { display: none; } .lbl3d.cp { font-size: 0.66rem; } .lbl3d.cp small { display: none; } }
`;

function discGeometry() {
  // a lozenge: flat faces with a rounded rim (unit radius, unit height)
  const pts = [new THREE.Vector2(0, -0.5)], cr = 0.14;
  for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + (i / 10) * Math.PI; pts.push(new THREE.Vector2(1 - cr + Math.cos(a) * cr, Math.sin(a) * 0.5)); }
  pts.push(new THREE.Vector2(0, 0.5));
  return new THREE.LatheGeometry(pts, 36);
}

export function create(engine) {
  if (!document.getElementById("cp-css")) {
    const st = document.createElement("style");
    st.id = "cp-css"; st.textContent = CSS;
    document.head.appendChild(st);
  }
  const M = new ChloroplastModel();
  const lens = engine.lens;
  const root = new THREE.Group();
  const pickables = [], portals = [];
  const tmpM = new THREE.Matrix4(), tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpE = new THREE.Euler(), tA = new THREE.Vector3();
  const tag = (mesh, kind) => { mesh.userData.kind = kind; pickables.push(mesh); return mesh; };
  const has = (id) => !!engine.levelsDef[id];

  // ---------- envelope (double membrane, cut away at the front) ----------
  const clip = [new THREE.Plane(new THREE.Vector3(0, 0, -1), CUT)];
  const shellGeo = new THREE.SphereGeometry(1, 72, 40);
  const outer = new THREE.Mesh(shellGeo, glass("#16a34a", { rim: "#86efac", minAlpha: 0.04, maxAlpha: 0.55, rimStrength: 0.45, side: THREE.DoubleSide, clippingPlanes: clip }));
  outer.scale.set(A, B, CZ);
  const inner = new THREE.Mesh(shellGeo, glass("#15803d", { rim: "#4ade80", minAlpha: 0.05, maxAlpha: 0.38, rimStrength: 0.3, side: THREE.DoubleSide, clippingPlanes: clip }));
  inner.scale.set(A - 0.8, B - 0.65, CZ - 0.8);
  inner.renderOrder = 1; outer.renderOrder = 2;
  root.add(outer, inner);
  // bright rims where the cut crosses the two membranes
  const rimMat = physical("#4ade80", { emissive: new THREE.Color("#16a34a"), emissiveIntensity: 0.25, roughness: 0.35 });
  for (const [a, b, c, rr] of [[A, B, CZ, 0.26], [A - 0.8, B - 0.65, CZ - 0.8, 0.2]]) {
    const k = Math.sqrt(1 - (CUT / c) ** 2), pts = [];
    for (let i = 0; i < 96; i++) { const t = (i / 96) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(t) * a * k, Math.sin(t) * b * k, CUT)); }
    root.add(tag(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 192, rr, 8, true), rimMat), "envelope"));
  }
  // invisible stroma volume: fallback pick for clicks on empty stroma
  const stromaPick = new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({ visible: false }));
  stromaPick.scale.copy(inner.scale).multiplyScalar(0.97);
  stromaPick.userData.kind = "stroma";
  root.add(stromaPick);

  // ---------- grana (instanced thylakoid discs) ----------
  const stacks = GRANA.map(([x, z], i) => {
    const n = 7 + Math.floor(hash(i * 3.1 + 1) * 6), r = 2.3 + hash(i * 7.7 + 2) * 0.55, y0 = (hash(i * 5.3 + 3) - 0.5) * 1.2;
    return { i, x, z, n, r, y0, h: n * SP, c: new THREE.Vector3(x, y0, z), top: y0 + (n * SP) / 2 };
  });
  const nDiscs = stacks.reduce((s, g) => s + g.n, 0);
  const discMat = physical("#ffffff", { emissive: new THREE.Color("#16a34a"), emissiveIntensity: 0.1, roughness: 0.45, clearcoat: 0.35, sheen: 0.35, sheenColor: new THREE.Color("#22c55e") });
  const discs = new THREE.InstancedMesh(discGeometry(), discMat, nDiscs);
  const dCol = new THREE.Color();
  let di = 0;
  for (const g of stacks) {
    for (let k = 0; k < g.n; k++) {
      const y = g.y0 + (k - (g.n - 1) / 2) * SP, rr = g.r * (0.94 + hash(di * 1.7) * 0.1);
      discs.setMatrixAt(di, tmpM.compose(tmpV.set(g.x + (hash(di) - 0.5) * 0.12, y, g.z + (hash(di + 9) - 0.5) * 0.12), tmpQ.identity(), tmpS.set(rr, TH, rr)));
      discs.setColorAt(di, dCol.set("#137a3c").lerp(new THREE.Color("#0a4422"), hash(di * 3.3) * 0.7));
      di++;
    }
  }
  root.add(discs);
  // invisible pick/portal proxies around each granum
  const proxyGeo = new THREE.CylinderGeometry(1, 1, 1, 20);
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  for (const g of stacks) {
    const p = tag(new THREE.Mesh(proxyGeo, proxyMat), "granum");
    p.position.copy(g.c); p.scale.set(g.r + 0.15, g.h + 0.2, g.r + 0.15);
    root.add(p);
    g.proxy = p;
  }

  // ---------- stroma lamellae joining neighbouring grana ----------
  const lam = [];
  for (let i = 0; i < stacks.length; i++) for (let j = i + 1; j < stacks.length; j++) {
    const a = stacks[i], b = stacks[j], d = Math.hypot(a.x - b.x, a.z - b.z);
    if (d > 10.5) continue;
    for (let k = 0; k < 2; k++) {
      const ya = a.y0 + (hash(i * 13 + j * 7 + k) - 0.5) * a.h * 0.8, yb = b.y0 + (hash(i * 5 + j * 11 + k * 3) - 0.5) * b.h * 0.8;
      lam.push([new THREE.Vector3(a.x, ya, a.z), new THREE.Vector3(b.x, yb, b.z)]);
    }
  }
  const lamMesh = tag(new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), physical("#23874a", { emissive: new THREE.Color("#16a34a"), emissiveIntensity: 0.08, transparent: true, opacity: 0.85, roughness: 0.5, sheenColor: new THREE.Color("#22c55e") }), lam.length), "lamella");
  lam.forEach(([a, b], i) => {
    const dir = tA.copy(b).sub(a), len = dir.length();
    tmpQ.setFromUnitVectors(XA, dir.normalize()).multiply(new THREE.Quaternion().setFromAxisAngle(XA, (hash(i) - 0.5) * 0.6));
    lamMesh.setMatrixAt(i, tmpM.compose(tmpV.copy(a).lerp(b, 0.5), tmpQ, tmpS.set(len, 0.13, 1.25)));
  });
  root.add(lamMesh);

  // ---------- stroma contents ----------
  const inGranum = (p, pad) => stacks.some((g) => Math.hypot(p.x - g.x, p.z - g.z) < g.r + pad && Math.abs(p.y - g.y0) < g.h / 2 + pad);
  const inStarch = (p, pad) => STARCH.some((s) => s.distanceTo(p) < 2.6 + pad);
  function stromaPoint(seed, shrink = 0.86, pad = 0.6) {
    const p = new THREE.Vector3();
    for (let k = 0; k < 80; k++) {
      const s = seed * 9.17 + k * 3.31;
      p.set((hash(s) * 2 - 1) * A, (hash(s + 1) * 2 - 1) * B, (hash(s + 2) * 2 - 1) * CZ);
      if ((p.x / A) ** 2 + (p.y / B) ** 2 + (p.z / CZ) ** 2 > shrink * shrink) continue;
      if (inGranum(p, pad) || inStarch(p, pad)) continue;
      return p;
    }
    return p.set(0, -6, 0);
  }
  // Rubisco (L8S8 blobs)
  const NRUB = 150, rubPos = [];
  const rubGeo = new THREE.IcosahedronGeometry(0.24, 1);
  const rubMat = physical("#0f9488", { emissive: new THREE.Color("#14b8a6"), emissiveIntensity: 0.3, roughness: 0.4, sheenColor: new THREE.Color("#14b8a6") });
  const rubisco = tag(new THREE.InstancedMesh(rubGeo, rubMat, NRUB), "rubisco");
  for (let i = 0; i < NRUB; i++) {
    const p = stromaPoint(i + 1);
    rubPos.push(p.clone());
    rubisco.setMatrixAt(i, tmpM.compose(p, tmpQ.setFromEuler(tmpE.set(hash(i) * 6, hash(i + 1) * 6, 0)), tmpS.setScalar(0.8 + hash(i + 3) * 0.5)));
  }
  root.add(rubisco);
  // 70S ribosomes
  tmpM.identity();
  const ribo = tag(new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 10, 8), physical("#7c3aed", { roughness: 0.5, emissive: new THREE.Color("#6d28d9"), emissiveIntensity: 0.2 }), 70), "ribosome");
  for (let i = 0; i < 70; i++) ribo.setMatrixAt(i, tmpM.setPosition(stromaPoint(i + 500)));
  root.add(ribo);
  // chloroplast DNA loops (nucleoids)
  const dnaMat = physical("#f0abfc", { emissive: new THREE.Color("#c026d3"), emissiveIntensity: 0.45, roughness: 0.4 });
  const dnaCentres = [];
  for (let n = 0; n < 3; n++) {
    const c = stromaPoint(n * 41 + 900, 0.7, 1.8), pts = [];
    dnaCentres.push(c);
    for (let k = 0; k < 16; k++) {
      const t = (k / 16) * Math.PI * 2, r = 1.3 + hash(n * 50 + k) * 0.7;
      pts.push(new THREE.Vector3(c.x + Math.cos(t) * r, c.y + Math.sin(t * 2 + n) * 0.5, c.z + Math.sin(t) * r * 0.8));
    }
    root.add(tag(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 140, 0.07, 5, true), dnaMat), "dna"));
  }
  // starch grains
  const starchMat = physical("#f1f5f9", { roughness: 0.55, clearcoat: 0.4, sheen: 0.8 });
  const starchMeshes = STARCH.map((p, i) => {
    const m = tag(new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), starchMat), "starch");
    m.position.copy(p); m.rotation.set(0.2, hash(i) * 3, 0.1);
    root.add(m);
    return m;
  });
  // plastoglobuli
  const pg = tag(new THREE.InstancedMesh(new THREE.SphereGeometry(0.4, 16, 12), physical("#facc15", { emissive: new THREE.Color("#ca8a04"), emissiveIntensity: 0.3, roughness: 0.25 }), 9), "plastoglobule");
  for (let i = 0; i < 9; i++) {
    const [a, b] = lam[(i * 5) % lam.length];
    const p = tA.copy(a).lerp(b, 0.3 + hash(i) * 0.4);
    p.y += 0.45;
    pg.setMatrixAt(i, tmpM.compose(p, tmpQ.identity(), tmpS.setScalar(0.7 + hash(i + 4) * 0.6)));
  }
  root.add(pg);
  // stroma specks + cytosol outside
  {
    const n = 260, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const p = stromaPoint(i + 2000, 0.92, 0.2); pos.set([p.x, p.y, p.z], i * 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    root.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.28, map: softDot(), color: "#a7f3d0", transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending })));
  }
  const cyto = specks(380, 0.7, [180, 110, 140], ["#99f6e4", "#c4b5fd", "#fef3c7"], 0.3);
  root.add(cyto);
  const sun = new THREE.DirectionalLight("#fff5d6", 1.5);
  sun.position.set(-8, 40, 12);
  root.add(sun);

  // ---------- portal to the thylakoid membrane ----------
  const fg = stacks[FEATURED];
  const ring = tag(new THREE.Mesh(new THREE.TorusGeometry(fg.r + 0.9, 0.13, 12, 64), physical("#5eead4", { emissive: new THREE.Color("#2dd4bf"), emissiveIntensity: 1.3 })), "granum");
  ring.rotation.x = Math.PI / 2;
  ring.position.copy(fg.c);
  root.add(ring);
  for (const g of stacks) {
    const featured = g === fg;
    portals.push({
      to: "thylakoid", label: "Thylakoid membrane", object: g.proxy, objects: featured ? [g.proxy, ring] : [g.proxy],
      radius: 3.4, center: () => g.c.clone(), auto: featured && has("thylakoid"),
      fallback: () => engine.select(infoFor("granum", g.proxy)),
    });
  }

  // ---------- flows ----------
  const fGeo = {
    photon: new THREE.CapsuleGeometry(0.09, 2.4, 3, 6),
    h2o: new THREE.SphereGeometry(0.26, 12, 8),
    o2: new THREE.CapsuleGeometry(0.22, 0.32, 4, 10),
    co2: new THREE.CapsuleGeometry(0.19, 0.55, 4, 10),
    atp: new THREE.SphereGeometry(0.3, 14, 10),
    nadph: new THREE.SphereGeometry(0.27, 14, 10),
    back: new THREE.SphereGeometry(0.2, 10, 8),
    sugar: new THREE.CylinderGeometry(0.36, 0.36, 0.16, 6),
    starch: new THREE.CylinderGeometry(0.3, 0.3, 0.14, 6),
  };
  const MAXF = 40;
  const flows = {};
  for (const [k, f] of Object.entries(FLOWS)) {
    const mat = k === "photon"
      ? new THREE.MeshBasicMaterial({ color: new THREE.Color(f.color).multiplyScalar(2.2), toneMapped: false, transparent: true, opacity: 0.9 })
      : physical(f.color, { emissive: new THREE.Color(f.color), emissiveIntensity: k === "atp" || k === "nadph" ? 1.1 : k === "back" ? 0.1 : 0.45 });
    const mesh = new THREE.InstancedMesh(fGeo[k], mat, MAXF);
    mesh.count = 0; mesh.frustumCulled = false;
    root.add(mesh);
    flows[k] = { mesh, parts: [], acc: 0 };
  }
  let showFlows = true;
  const rnd = Math.random;
  const granumPoint = (g = stacks[Math.floor(rnd() * stacks.length)]) => new THREE.Vector3(g.x + (rnd() - 0.5) * g.r, g.y0 + (rnd() - 0.5) * g.h * 0.8, g.z + (rnd() - 0.5) * g.r);
  const rubPoint = () => rubPos[Math.floor(rnd() * NRUB)];
  const envPoint = (scale = 1.22) => {
    const t = rnd() * Math.PI * 2, y = rnd() * 1.6 - 0.8, r = Math.sqrt(1 - y * y);
    return new THREE.Vector3(Math.cos(t) * r * A * scale, y * B * scale, Math.sin(t) * r * CZ * scale);
  };
  function spawn(kind, a, b, dur, bendAmt = 0.3) {
    const f = flows[kind];
    if (f.parts.length >= MAXF) return;
    const c = a.clone().lerp(b, 0.5).add(tA.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(a.distanceTo(b) * bendAmt));
    f.parts.push({ a: a.clone(), b: b.clone(), c, t: 0, dur, spin: rnd() * 6 });
  }
  function emit(dt) {
    const F = M.flux;
    const want = (k, rate, fn) => {
      const f = flows[k];
      if (FLOWS[k].band && !lens.atLeast(FLOWS[k].band)) return;
      f.acc += Math.max(0, rate) * dt;
      while (f.acc >= 1) { f.acc -= 1; fn(); }
    };
    want("photon", M.light * 0.2, () => { const s = stacks[Math.floor(rnd() * stacks.length)]; const tgt = new THREE.Vector3(s.x + (rnd() - 0.5) * s.r, s.top, s.z + (rnd() - 0.5) * s.r); spawn("photon", tgt.clone().add(tA.set(-6 + rnd() * 4, 30, 6 + rnd() * 4)), tgt, 0.9, 0); });
    want("h2o", F.J * 0.07, () => spawn("h2o", envPoint(), granumPoint(), 3.2));
    want("o2", F.J * 0.09, () => spawn("o2", granumPoint(), envPoint(1.3), 3.4));
    want("co2", F.V * 0.09, () => spawn("co2", envPoint(1.3), rubPoint(), 3.4));
    want("atp", F.J * 0.07, () => spawn("atp", granumPoint(), rubPoint(), 2.4));
    want("nadph", F.J * 0.05, () => spawn("nadph", granumPoint(), rubPoint(), 2.4));
    want("back", F.V * 0.1, () => spawn("back", rubPoint(), granumPoint(), 2.6));
    want("sugar", F.exportTP * 1.1, () => spawn("sugar", rubPoint(), envPoint(1.3), 3.6));
    want("starch", F.store * 1.6, () => spawn("starch", rubPoint(), STARCH[Math.floor(rnd() * 3)], 2.4));
    want("starch", F.mobilise * 4, () => spawn("starch", STARCH[Math.floor(rnd() * 3)], envPoint(1.3), 3.6));
  }
  function drawFlows(dt) {
    for (const [k, f] of Object.entries(flows)) {
      let n = 0;
      if (dt) f.parts = f.parts.filter((p) => (p.t += dt / p.dur) < 1);
      if (showFlows) for (const p of f.parts) {
        const t = p.t, u = 1 - t;
        tmpV.set(0, 0, 0).addScaledVector(p.a, u * u).addScaledVector(p.c, 2 * u * t).addScaledVector(p.b, t * t);
        if (k === "photon") tmpQ.setFromUnitVectors(UP, tA.copy(p.a).sub(p.b).normalize());
        else tmpQ.setFromEuler(tmpE.set(p.spin + t * 3, p.spin * 0.7 + t * 2, 0));
        const s = Math.min(1, t * 6, (1 - t) * 6);
        f.mesh.setMatrixAt(n++, tmpM.compose(tmpV, tmpQ, tmpS.set(s, s, s)));
      }
      f.mesh.count = n;
      f.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  // ---------- per-frame visuals ----------
  const offCol = new THREE.Color("#5b6b4e");
  function animate(t, dt) {
    const F = M.flux, still = engine.reducedMotion;
    const lr = clamp(F.J / 60, 0, 1), cv = clamp(F.V / 60, 0, 1);
    discMat.emissiveIntensity = M.on.light ? 0.05 + lr * 0.35 : 0.0;
    discMat.color.set(M.on.light ? "#ffffff" : "#8a9a80");
    rubMat.emissiveIntensity = M.on.calvin ? 0.08 + cv * (0.5 + 0.2 * Math.sin(t * 6)) : 0;
    rubMat.color.set(M.on.calvin ? (M.r.P < 4 ? "#b45353" : "#0f9488") : offCol);
    const s = 0.3 + 0.7 * (M.starch / 100);
    for (const m of starchMeshes) m.scale.set(2.4 * s, 1.3 * s, 1.9 * s);
    ring.rotation.z = still ? 0 : t * 0.4;
    ring.material.emissiveIntensity = 0.9 + Math.sin(t * 2.5) * 0.4;
    sun.intensity = 0.1 + 1.4 * (M.light / 100);
    if (!still) cyto.rotation.y = Math.sin(t * 0.02) * 0.05;
    drawFlows(dt);
  }

  // ---------- labels ----------
  const labelSpots = {
    granum: () => tA.set(stacks[7].x, stacks[7].top + 1.4, stacks[7].z),
    lamella: () => { const [a, b] = lam[0]; return tA.copy(a).lerp(b, 0.5).add(tmpV.set(0, 0.9, 0)); },
    stroma: () => tA.set(-17, -4.5, 5),
    rubisco: () => tA.copy(rubPos[rubLbl]).add(tmpV.set(0, 0.9, 0)),
    starch: () => tA.copy(STARCH[2]).add(tmpV.set(0, 2.4, 0)),
    dna: () => tA.copy(dnaCentres[0]).add(tmpV.set(0, 2, 0)),
    envelope: () => tA.set(-A * 0.72, B * 0.72, CUT),
  };
  const labels = {};
  let rubLbl = 0;
  rubPos.forEach((p, i) => { if (p.distanceToSquared(tmpV.set(1, -4, 6)) < rubPos[rubLbl].distanceToSquared(tmpV)) rubLbl = i; });
  const MINOR = new Set(["lamella", "stroma", "dna"]);
  let showLabels = !lens.atLeast("y11");
  let diveLbl = null;
  function makeLabels() {
    for (const el of Object.values(labels)) el.remove();
    for (const k of Object.keys(labelSpots)) labels[k] = engine.label("", "cp");
    diveLbl?.remove();
    diveLbl = engine.label("🔍 Zoom into the thylakoid membrane", "dive");
  }
  function updateLabels() {
    const st = M.status();
    for (const [k, el] of Object.entries(labels)) {
      if (!showLabels || (engine.w < 600 && MINOR.has(k))) { el.style.display = "none"; continue; }
      const s = k === "granum" ? st.light : k === "rubisco" ? st.calvin : "";
      const html = `${lens.pick(PARTS[k].name)}${s ? `<small>${s}</small>` : ""}`;
      if (el._h !== html) { el.innerHTML = html; el._h = html; }
      el.classList.toggle("off", /blocked|stalled|backed|idle/.test(s));
      engine.place(el, labelSpots[k]());
    }
    if (diveLbl) engine.place(diveLbl, tA.set(fg.x, fg.top + 2.2, fg.z));
  }

  // ---------- selection ----------
  const selGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: "#5eead4", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 }));
  selGlow.visible = false;
  root.add(selGlow);
  function infoFor(kind, obj) {
    const p = PARTS[kind];
    if (!p) return null;
    const portal = obj ? portals.find((q) => q.object === obj || q.objects?.includes(obj)) : null;
    return { kind, title: lens.pick(p.name), portal: portal && has(portal.to) ? portal : null, object: obj };
  }

  // ---------- panel ----------
  let progress = null, panelEl, explainBody, selCard, chart, chartCtx, mission, rows = {}, sliders = {}, chips = {};
  const S = { nightStarch: M.starch };
  function setCond(k, v) { M[k] = v; sliders[k] && (sliders[k].value = v); }
  function buildPanel(el) {
    panelEl = el;
    el.innerHTML = "";
    const host = document.createElement("div");
    host.style.display = "contents";
    el.appendChild(host);
    progress = { band: lens.band, node: host };
    el = host;
    const y7 = lens.band === "y7-8";

    const ex = K.card(el, "What's happening", "explain");
    explainBody = document.createElement("div");
    explainBody.setAttribute("aria-live", "polite");
    ex.appendChild(explainBody);
    selCard = K.card(el, "Selected", "sel-card");
    selCard.style.display = "none";

    const env = K.card(el, "Conditions");
    sliders.light = K.slider(env, { label: "☀ Light", min: 0, max: 100, value: M.light, unit: " %", onInput: (v) => { M.light = v; if (v < 5) S.nightStarch = Math.max(S.nightStarch, M.starch); } });
    sliders.co2 = K.slider(env, { label: y7 ? "Carbon dioxide" : "CO₂ concentration", min: 0, max: 0.4, step: 0.01, value: M.co2, format: (v) => `${v.toFixed(2)} %`, onInput: (v) => (M.co2 = v) });
    sliders.temp = K.slider(env, { label: "Temperature", min: 0, max: 50, value: M.temp, unit: " °C", onInput: (v) => (M.temp = v) });
    env.insertAdjacentHTML("beforeend", `<p class="hint">${y7 ? "Air has about 0.04% carbon dioxide." : "Air ≈ 0.04 % CO₂. Above ~42 °C Rubisco denatures permanently."}</p>`);
    const r = K.buttonRow(env);
    K.button(r, "☀ Day", () => setCond("light", 85));
    K.button(r, "☾ Night", () => { S.nightStarch = M.starch; setCond("light", 0); });
    K.button(r, "Reset", () => {
      M.reset(); S.nightStarch = M.starch;
      for (const f of Object.values(flows)) { f.parts.length = 0; f.acc = 0; }
      progress = null; buildPanel(panelEl); engine.toast?.("Reset: a fresh chloroplast.");
    });

    const sw = K.card(el, y7 ? "Switch parts on and off" : "Knock out a stage");
    sw.insertAdjacentHTML("beforeend", `<p class="hint" style="margin:0 0 8px">${lens.pick({ "y7-8": "Turn one part off and watch what happens to the other.", "y9-10": "Block one stage of photosynthesis and follow the effect on the other.", y11: "Block one half and watch the shared ATP/NADPH pool: the other half stalls or backs up." })}</p>`);
    const list = document.createElement("div");
    list.className = "org-list";
    sw.appendChild(list);
    rows = {};
    for (const s of SWITCHES) {
      const row = document.createElement("div");
      row.className = "org-row";
      const lab = lens.pick(s.label);
      row.innerHTML = `<i style="background:${s.color}"></i><button type="button" class="org-name" title="Show me">${lab}<small></small></button><label class="switch"><input type="checkbox" ${M.on[s.key] ? "checked" : ""} aria-label="${lab} on"><span></span></label>`;
      const cb = row.querySelector("input");
      cb.addEventListener("change", () => { M.on[s.key] = cb.checked; engine.toast?.(`${lab} ${cb.checked ? "on" : "off"}`); if (engine.selected) showSelection(engine.selected); });
      row.querySelector(".org-name").addEventListener("click", () => focusOn(s.key === "light" ? "granum" : "rubisco"));
      list.appendChild(row);
      rows[s.key] = row;
    }

    const fk = K.card(el, "What's moving");
    const key = document.createElement("div");
    key.className = "flow-key";
    for (const f of Object.values(FLOWS)) {
      if (f.band && !lens.atLeast(f.band)) continue;
      key.insertAdjacentHTML("beforeend", `<span><i style="background:${f.color};box-shadow:0 0 8px ${f.color}"></i>${lens.pick(f.label)}</span>`);
    }
    fk.appendChild(key);
    K.checkbox(fk, "Show moving molecules", showFlows, (v) => (showFlows = v));
    K.checkbox(fk, "Show labels", showLabels, (v) => (showLabels = v));

    const ch = K.card(el, "Chloroplast over time");
    chart = document.createElement("canvas");
    chart.className = "mini-chart";
    chart.setAttribute("role", "img");
    ch.appendChild(chart);
    chartCtx = chart.getContext("2d");
    ch.insertAdjacentHTML("beforeend", `<div class="legend" style="margin-top:6px"><span><i style="background:#f87171"></i>${y7 ? "Oxygen out" : "O₂ released"}</span><span><i style="background:#2dd4bf"></i>${y7 ? "CO₂ taken in" : "CO₂ fixed"}</span><span><i style="background:#fbbf24"></i>${y7 ? "Energy carriers full" : "ATP + NADPH charged"}</span><span><i style="background:#f8fafc"></i>Starch</span></div>`);

    mission = K.missions(el, lens.filter(MISSIONS).map((m) => ({ text: m.text, check: () => m.check(M, S) })), (m) => engine.toast(`🎯 Mission complete: ${m.text.replace(/<[^>]+>/g, "")}`, 3400));
    K.quiz(el, lens.filter(QUIZ));
    buildChips();
  }

  function buildChips() {
    const ov = engine.overlay;
    ov.innerHTML = "";
    chips = { light: K.chip(ov), o2: K.chip(ov), co2: K.chip(ov), carriers: K.chip(ov), starch: K.chip(ov), lim: K.chip(ov) };
    [...ov.children].forEach((c, i) => { c.classList.add("cp-chip"); if (i === 0 || i === 4) c.classList.add("opt"); });
  }
  function updateChips() {
    const d = (c) => `<i class="dot" style="background:${c}"></i>`, y7 = lens.band === "y7-8", F = M.flux;
    chips.light(`${d("#fde68a")}Light <b>${M.light.toFixed(0)}%</b>`);
    chips.o2(`${d("#f87171")}O₂ out <b>${F.J.toFixed(F.J < 10 ? 1 : 0)}</b>/min`);
    chips.co2(`${d("#2dd4bf")}${y7 ? "CO₂ in" : "CO₂ fixed"} <b>${F.V.toFixed(F.V < 10 ? 1 : 0)}</b>/min`);
    chips.carriers(`${d("#fbbf24")}${y7 ? "Energy carriers" : "ATP + NADPH"} <b>${Math.round(M.e * 100)}%</b>`);
    chips.starch(`${d("#f8fafc")}Starch <b>${M.starch.toFixed(0)}</b>`);
    const lim = !M.on.light || !M.on.calvin ? "a stage is blocked" : M.limiting === "dark" ? "light (dark)" : M.limiting === "co2" ? "CO₂" : M.limiting === "temp" ? (M.temp >= 33 ? "temperature (too hot)" : "temperature") : "light";
    chips.lim(`Limiting: <b class="lim">${lim}</b>`);
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
    chart.setAttribute("aria-label", `Now: O₂ released ${M.flux.J.toFixed(1)} per minute, CO₂ fixed ${M.flux.V.toFixed(1)} per minute, carriers ${Math.round(M.e * 100)}% charged, starch ${M.starch.toFixed(0)}.`);
    if (H.length < 2) return;
    for (const [f, col] of [[(p) => p.starch, "#f8fafc"], [(p) => p.e * 100, "#fbbf24"], [(p) => (p.V / 80) * 100, "#2dd4bf"], [(p) => (p.J / 80) * 100, "#f87171"]]) {
      c.strokeStyle = col; c.lineWidth = 2; c.beginPath();
      H.forEach((p, i) => { const x = (i / 239) * w, y = h - (clamp(f(p), 0, 100) / 100) * (h - 4) - 2; i ? c.lineTo(x, y) : c.moveTo(x, y); });
      c.stroke();
    }
  }

  function updateExplain() {
    const html = narrative(M, lens.band).map((p) => `<p>${p}</p>`).join("") +
      `<p class="hint">${lens.pick({ "y7-8": "Click any part to find out what it does. Zoom into the glowing granum to see the light-catching membrane up close.", "y9-10": "Click a part for its inputs and outputs. Double-click the glowing granum (or zoom into it) to dive into the thylakoid membrane." })}</p>`;
    if (explainBody.innerHTML !== html) explainBody.innerHTML = html;
  }

  function showSelection(info) {
    if (!selCard) return;
    if (!info) { selCard.style.display = "none"; selGlow.visible = false; return; }
    const p = PARTS[info.kind], st = M.status();
    const now = info.kind === "granum" || info.kind === "lamella" ? st.light : info.kind === "rubisco" || info.kind === "stroma" ? st.calvin : info.kind === "starch" ? `${M.starch.toFixed(0)} / 100${M.flux.store > 0.1 ? " — growing" : M.flux.mobilise > 0.05 ? " — being broken down" : ""}` : "";
    const zoom = info.portal ? `<button class="btn primary" data-act="zoom">Zoom in ▸</button>` : "";
    selCard.style.display = "";
    selCard.innerHTML = `<h2>Selected</h2><p style="color:var(--ink);font-weight:600;margin-bottom:4px"><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};margin-right:6px"></i>${lens.pick(p.name)}</p>
      <p>${lens.pick(p.role)}</p>
      <div class="io">${p.inputs ? `<b>In</b><span>${lens.pick(p.inputs)}</span>` : ""}<b>Out</b><span>${lens.pick(p.outputs)}</span>${now ? `<b>Now</b><span>${now}</span>` : ""}</div>
      <div class="btn-row">${zoom}<a class="btn" href="${engine.root}sims/photosynthesis/index.html">Open the photosynthesis simulation</a></div>`;
    selCard.querySelector('[data-act="zoom"]')?.addEventListener("click", () => engine.dive(info.portal));
    selGlow.visible = !!info.object && info.object !== stromaPick && !info.object.isInstancedMesh;
    if (selGlow.visible) {
      info.object.getWorldPosition(selGlow.position);
      const bs = new THREE.Box3().setFromObject(info.object).getSize(tA);
      selGlow.scale.setScalar(Math.min(14, Math.max(bs.x, bs.y, bs.z) * 2));
    }
    if (panelEl) panelEl.parentElement?.scrollTo?.({ top: 0, behavior: "smooth" });
  }

  function focusOn(kind) {
    if (engine.busy) return;
    const obj = kind === "granum" ? fg.proxy : null;
    const p = kind === "granum" ? fg.c.clone() : rubPos[7].clone();
    const dir = engine.camera.position.clone().sub(engine.controls.target).normalize();
    engine.fly(p, p.clone().addScaledVector(dir, 18), 0.9);
    engine.select(kind === "granum" ? infoFor("granum", obj) : { ...infoFor("rubisco"), object: rubisco });
  }

  // ---------- level object ----------
  let uiT = 0, exT = 0, chT = 0;
  const level = {
    title: "Chloroplast",
    topics: ["photosynthesis", "organelles", "enzymes", "atp", "cell-structure"],
    root, pickables, portals,
    fallbackPickables: [stromaPick],
    entryRadius: 26,
    model: M,                       // shared with the thylakoid level so conditions carry across scales
    get view() { const a = engine.camera.aspect; return { target: new THREE.Vector3(0, -0.5, 0), distance: clamp(23 / (0.344 * a), 32, 125), dir: new THREE.Vector3(0.18, 0.55, 1) }; },
    minDistance: 2.5, maxDistance: 140, near: 0.05, far: 900,
    env: { bg: ["#06231c", "#0b3a2a", "#1d3f12"], fog: ["#072a20", 0.0055], exposure: 1.05, bloom: [0.32, 0.5, 0.9], aperture: 0.0009 },
    info(obj) {
      const kind = obj.userData.kind;
      if (!kind || (kind === "plastoglobule" && !lens.atLeast("y11"))) return null;
      return infoFor(kind, obj);
    },
    onSelect(info) { showSelection(info); },
    mountPanel(el) {
      makeLabels();
      if (progress && progress.band === lens.band) { panelEl = el; el.appendChild(progress.node); buildChips(); }
      else buildPanel(el);
    },
    unmountPanel() { for (const el of Object.values(labels)) el.style.display = "none"; if (diveLbl) diveLbl.style.display = "none"; engine.overlay.innerHTML = ""; },
    onResume() {
      makeLabels();
      for (const k of ["light", "co2", "temp"]) if (sliders[k]) sliders[k].value = M[k]; // the thylakoid level may have changed them
    },
    onLens() { showLabels = !lens.atLeast("y11"); progress = null; buildPanel(panelEl); },
    update(dt, t, realDt = dt) {
      M.step(dt);
      if (M.light >= 5) S.nightStarch = M.starch;
      if (dt) emit(dt);
      animate(t, dt);
      updateLabels();
      if (selGlow.visible) selGlow.material.opacity = 0.4 + 0.25 * Math.sin(t * 3);
      if ((uiT -= realDt) <= 0) {
        uiT = 0.25;
        updateChips();
        const st = M.status();
        for (const [k, row] of Object.entries(rows)) {
          const sm = row.querySelector("small");
          if (sm.textContent !== st[k]) sm.textContent = st[k];
          row.classList.toggle("off", !M.on[k] || /stalled|backed|blocked/.test(st[k]));
        }
      }
      if ((exT -= realDt) <= 0) { exT = 0.6; updateExplain(); }
      if ((chT -= realDt) <= 0) { chT = 0.5; drawChart(); }
      mission?.update();
    },
    dispose() { for (const el of Object.values(labels)) el.remove(); diveLbl?.remove(); },
  };
  return level;
}
