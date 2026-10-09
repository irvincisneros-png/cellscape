// Organelle level: one mitochondrion of the plant cell, magnified (1 unit = 100 nm; ≈ 2.3 µm long).
// A working organelle driven by MitoModel (sims/atp-synthase/model.js — the same constants as the
// cristae level and the 2D ATP Factory): glycolysis in the CYTOSOL → pyruvate import → link reaction →
// Krebs cycle (matrix) → ETC on the cristae pumping H⁺ → ATP synthase → ATP exported to the cytosol.
import * as THREE from "three";
import * as K from "../../kit.js";
import { physical, glass, softDot, hash, paint } from "../materials.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { MitoModel, TAU } from "../../../../sims/atp-synthase/model.js";
import { PARTS, BIG_PICTURE, MISSIONS, QUIZ, narrative } from "./mitochondrionContent.js";

const RO = 4.5, RI = 4.05, LEN = 14;          // outer radius, inner (boundary) radius, cylinder length (units of 100 nm)
const HALF = LEN / 2 + RO;                     // 11.5
const CUT_C = 0.35;                            // cut-away plane offset (toward the camera)
const CRISTAE = [-9.0, -7.1, -5.2, -3.3, 3.3, 5.2, 7.1, 9.0];
const PORTAL_I = 3;                            // the crista with the portal
const GLY = new THREE.Vector3(-7.2, 6.9, 2.2);  // glycolysis in the cytosol
const FERM = new THREE.Vector3(-12.2, 5.6, 3.0);
const PDH = new THREE.Vector3(-1.7, 2.3, -0.3);
const KREBS = new THREE.Vector3(0.1, 0.1, -0.6), KR = 1.5;
const ENTRY = new THREE.Vector3(-5.6, 4.6, -0.6);

const CSS = `
.mito-chip .w { color: var(--ink-faint); }
.mito .flow { list-style: none; padding: 0; margin: 8px 0 10px; display: flex; flex-direction: column; gap: 12px; }
.mito .flow li { position: relative; display: grid; grid-template-columns: 1fr auto; gap: 1px 8px; padding: 7px 9px; border-radius: 9px; font-size: 0.84rem; background: rgba(255,255,255,0.03); border: 1px solid var(--panel-border); }
.mito .flow li b { color: var(--ink); font-weight: 600; }
.mito .flow li span { grid-column: 1; color: var(--ink-faint); font-size: 0.76rem; }
.mito .flow li em { grid-column: 2; grid-row: 1 / span 2; align-self: center; text-align: right; font-style: normal; color: var(--accent-3); font-size: 0.78rem; }
.mito .flow li + li::before { content: "↓"; position: absolute; top: -13px; left: 14px; color: var(--ink-faint); font-size: 0.7rem; }
.mito .ko small { display: block; color: var(--ink-faint); font-size: 0.74rem; margin: -2px 0 6px 24px; }
`;

/** Inner radius of the capsule at position x (for fitting cristae inside the rounded ends). */
const innerR = (x, r = RI) => { const e = Math.max(0, Math.abs(x) - LEN / 2); return Math.sqrt(Math.max(0, r * r - e * e)); };

export function create(engine) {
  if (!document.getElementById("mito-css")) {
    const st = document.createElement("style");
    st.id = "mito-css"; st.textContent = CSS;
    document.head.appendChild(st);
  }
  const lens = engine.lens;
  const M = new MitoModel();
  const root = new THREE.Group();
  const pickables = [], fallbackPickables = [];
  const tmpM = new THREE.Matrix4(), tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpE = new THREE.Euler();
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
  const tag = (o, kind) => { o.traverse?.((m) => { if (m.isMesh || m.isInstancedMesh) m.userData.kind = kind; }); o.userData.kind = kind; return o; };
  const shared = { supply: M.supply, o2: M.o2, anoxia: false, cyanide: false, dnp: false, olig: false, dirty: false };
  const state = { dived: false, cut: true, labels: true };

  // ---------- cut-away plane (follows the camera, opening the near side) ----------
  const cut = new THREE.Plane(new THREE.Vector3(0, 0, -1), CUT_C);
  const clip = [cut];

  // ---------- membranes ----------
  const capsule = (r) => { const g = new THREE.CapsuleGeometry(r, LEN, 16, 64); g.rotateZ(Math.PI / 2); return g; };
  const outerMat = glass("#ea580c", { rim: "#fdba74", minAlpha: 0.1, maxAlpha: 0.85, rimStrength: 0.7, side: THREE.DoubleSide, clippingPlanes: clip, emissive: new THREE.Color("#000") });
  const outer = tag(new THREE.Mesh(capsule(RO), outerMat), "outer");
  outer.renderOrder = 2;
  const innerMat = glass("#f97316", { rim: "#fed7aa", minAlpha: 0.16, maxAlpha: 0.9, rimStrength: 0.55, side: THREE.DoubleSide, clippingPlanes: clip, emissive: new THREE.Color("#000") });
  const inner = tag(new THREE.Mesh(capsule(RI), innerMat), "inner");
  inner.renderOrder = 1;
  root.add(inner, outer);
  fallbackPickables.push(outer, inner);
  // the cut edge reads as a rim: thin bright rings where the membranes are sliced are approximated by the fresnel rims

  // ---------- cristae (lamellar plates spanning the matrix) ----------
  const cristaMat = glass("#fb923c", { rim: "#ffedd5", minAlpha: 0.42, maxAlpha: 0.95, rimStrength: 0.6, side: THREE.DoubleSide, clippingPlanes: clip, emissive: new THREE.Color("#f472b6"), emissiveIntensity: 0 });
  const plates = [];
  const DEPTH = 0.2, BEV = 0.07;
  CRISTAE.forEach((xc, i) => {
    const R = innerR(xc) - 0.12 - BEV, h = R * (0.42 + 0.12 * hash(i * 3));
    const a0 = Math.asin(h / R);
    const sh = new THREE.Shape();
    // region of the disc below the chord v = h: attached to the boundary membrane, free edge at the chord
    sh.moveTo(Math.cos(Math.PI - a0) * R, h);
    sh.absarc(0, 0, R, Math.PI - a0, TAU + a0, false);
    sh.lineTo(Math.cos(Math.PI - a0) * R, h);
    const g = new THREE.ExtrudeGeometry(sh, { depth: DEPTH, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 3, curveSegments: 40 });
    g.translate(0, 0, -DEPTH / 2);
    g.rotateY(Math.PI / 2);
    const m = tag(new THREE.Mesh(g, cristaMat), "crista");
    m.position.x = xc;
    m.rotation.x = i === PORTAL_I ? 0 : (i * 2.39 + 0.6) % TAU;
    m.userData.i = i;
    root.add(m);
    pickables.push(m);
    plates.push({ m, xc, R, h, w: Math.sqrt(R * R - h * h) });
  });
  // a few tubular cristae near the ends (real cristae vary)
  const tubeMat = cristaMat;
  for (let k = 0; k < 4; k++) {
    const sx = k < 2 ? -1 : 1, x = sx * (LEN / 2 + 1.6 + (k % 2) * 0.9);
    const r = innerR(x) - 0.2, a = hash(k + 40) * TAU;
    const pts = [new THREE.Vector3(x, Math.cos(a) * r, Math.sin(a) * r), new THREE.Vector3(x - sx * 0.5, Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45), new THREE.Vector3(x - sx * 0.3, Math.cos(a + 0.6) * r * 0.1, Math.sin(a + 0.6) * r * 0.1)];
    const t = tag(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.22, 10), tubeMat), "crista");
    root.add(t); pickables.push(t);
  }

  // ---------- ATP synthase dimers along the crista rims + ETC complexes on the faces ----------
  const lolli = (() => {
    const stalk = new THREE.CylinderGeometry(0.028, 0.028, 0.26, 6); stalk.translate(0, 0.13, 0);
    const head = new THREE.SphereGeometry(0.1, 10, 8); head.translate(0, 0.3, 0);
    const base = new THREE.CylinderGeometry(0.06, 0.06, 0.08, 8); base.translate(0, 0.0, 0);
    return mergeGeometries([paint(stalk, "#fb7185"), paint(head, "#fde68a"), paint(base, "#93c5fd")]);
  })();
  const synMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, clearcoat: 0.8, emissive: new THREE.Color("#fbbf24"), emissiveIntensity: 0, clippingPlanes: clip });
  const synSpots = [];
  const plateLocal = (pl, u, v, side, out) => out.set(side * (DEPTH / 2 + BEV), v, -u); // local (before plate rotation)
  for (const pl of plates) {
    for (let u = -pl.w + 0.35; u <= pl.w - 0.35; u += 0.46) {
      for (const side of [1, -1]) synSpots.push({ pl, u, v: pl.h - 0.06, side });
    }
  }
  const synthase = new THREE.InstancedMesh(lolli, synMat, synSpots.length * 2);
  {
    const p = new THREE.Vector3(), n = new THREE.Vector3(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
    let i = 0;
    for (const sp of synSpots) {
      const pm = sp.pl.m; pm.updateMatrixWorld(true);
      for (const tilt of [-0.38, 0.38]) {
        plateLocal(sp.pl, sp.u + tilt * 0.12, sp.v, sp.side, p);
        n.set(sp.side, 0, 0);
        q.setFromUnitVectors(Y, n);                     // stalk + head point out of the face, into the matrix
        q2.setFromAxisAngle(Y, tilt * sp.side);            // the two monomers of a dimer splay apart along the rim
        const qq = q2.multiply(q).premultiply(pm.quaternion);
        p.applyMatrix4(pm.matrixWorld);
        synthase.setMatrixAt(i++, tmpM.compose(p, qq, s));
      }
    }
  }
  tag(synthase, "synthase");
  root.add(synthase);
  pickables.push(synthase);

  const etcMat = physical("#818cf8", { roughness: 0.4, emissive: new THREE.Color("#fff3b0"), emissiveIntensity: 0, clippingPlanes: clip });
  const etcGeo = new THREE.SphereGeometry(0.11, 8, 6); etcGeo.scale(0.6, 1, 1.4);
  const etcN = plates.length * 2 * 14;
  const etc = new THREE.InstancedMesh(etcGeo, etcMat, etcN);
  const etcSpots = [];
  {
    const p = new THREE.Vector3(), cols = ["#60a5fa", "#a78bfa", "#2dd4bf", "#34d399"].map((c) => new THREE.Color(c));
    let i = 0;
    for (const pl of plates) pl.m.updateMatrixWorld(true);
    for (const pl of plates) for (const side of [1, -1]) for (let k = 0; k < 14; k++) {
      const u = (hash(i * 3.1) * 2 - 1) * pl.w * 0.9, v = pl.h - 0.5 - hash(i * 5.7) * (pl.R + pl.h - 0.9);
      plateLocal(pl, u, Math.max(v, -Math.sqrt(Math.max(0, (pl.R - 0.35) ** 2 - u * u))), side, p);
      p.x += side * 0.04;
      p.applyMatrix4(pl.m.matrixWorld);
      etcSpots.push(p.clone());
      etc.setMatrixAt(i, tmpM.compose(p, pl.m.quaternion, tmpS.set(1, 1, 1)));
      etc.setColorAt(i, cols[i % 4]);
      i++;
    }
  }
  root.add(etc);

  // ---------- portal: a glowing ring on one crista ----------
  const portalPlate = plates[PORTAL_I];
  const PORTAL = new THREE.Vector3(portalPlate.xc + DEPTH / 2 + BEV + 0.06, -1.1, -1.3);
  const portalRing = tag(new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.07, 12, 48), physical("#5eead4", { emissive: new THREE.Color("#2dd4bf"), emissiveIntensity: 1.2 })), "portal");
  portalRing.rotation.y = Math.PI / 2; portalRing.position.copy(PORTAL);
  const portalDisc = tag(new THREE.Mesh(new THREE.CircleGeometry(0.8, 32), new THREE.MeshBasicMaterial({ color: "#5eead4", transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide })), "portal");
  portalDisc.rotation.y = Math.PI / 2; portalDisc.position.copy(PORTAL);
  root.add(portalRing, portalDisc);
  pickables.push(portalRing, portalDisc);

  // ---------- matrix contents: Krebs cycle, mtDNA, ribosomes, granules ----------
  const krebsMat = physical("#fb7185", { emissive: new THREE.Color("#fb7185"), emissiveIntensity: 0.5 });
  const krebs = new THREE.Group();
  krebs.position.copy(KREBS);
  krebs.add(new THREE.Mesh(new THREE.TorusGeometry(KR, 0.06, 10, 80), krebsMat));
  const krebsHit = new THREE.Mesh(new THREE.TorusGeometry(KR, 0.35, 6, 32), new THREE.MeshBasicMaterial({ visible: false }));
  krebs.add(krebsHit);
  tag(krebs, "krebs");
  pickables.push(krebsHit);
  const beadCols = ["#fb7185", "#f472b6", "#e879f9", "#c084fc", "#a78bfa", "#818cf8", "#f9a8d4", "#fda4af"];
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 14, 10), physical("#ffffff", { emissive: new THREE.Color("#fb7185"), emissiveIntensity: 0.35 }), 8);
  beadCols.forEach((c, i) => beads.setColorAt(i, new THREE.Color(c)));
  krebs.add(beads);
  root.add(krebs);
  let krebsPhase = 0;

  const dnaMat = physical("#e879f9", { emissive: new THREE.Color("#c026d3"), emissiveIntensity: 0.45, roughness: 0.5 });
  const dna = new THREE.Group();
  for (const [cx, cy, cz, r, s] of [[1.9, -2.3, 0.4, 0.75, 1], [-1.6, -2.5, -1.3, 0.6, 2], [2.2, 2.1, -1.6, 0.5, 3]]) {
    const pts = [];
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU, rr = r * (0.75 + 0.35 * hash(s * 10 + k));
      pts.push(new THREE.Vector3(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.7, cz + (hash(s * 7 + k) - 0.5) * 0.6));
    }
    dna.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 90, 0.04, 6, true), dnaMat));
  }
  tag(dna, "mtdna");
  dna.children.forEach((c) => pickables.push(c));
  root.add(dna);

  const ribo = (() => {
    const g = mergeGeometries([paint(new THREE.SphereGeometry(0.1, 10, 8), "#93c5fd"), paint(new THREE.SphereGeometry(0.075, 10, 8).translate(0, 0.11, 0), "#bfdbfe")]);
    const im = new THREE.InstancedMesh(g, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.4, clearcoat: 0.6 }), 26);
    for (let i = 0; i < 26; i++) {
      const p = tmpV.set((hash(i * 2.3) - 0.5) * 5.2, (hash(i * 4.1) - 0.5) * 6, (hash(i * 6.7) - 0.5) * 5.5);
      if (Math.hypot(p.y, p.z) > RI - 0.6) p.multiplyScalar(0.6);
      im.setMatrixAt(i, tmpM.compose(p, tmpQ.setFromEuler(tmpE.set(i, i * 2, 0)), tmpS.set(1, 1, 1)));
    }
    return tag(im, "ribo");
  })();
  root.add(ribo); pickables.push(ribo);
  const gran = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 12, 8), physical("#334155", { roughness: 0.3 }), 12);
  for (let i = 0; i < 12; i++) {
    const x = CRISTAE[i % 8] + (i % 2 ? 0.95 : -0.95) * (i % 3 ? 1 : 0.9), r = innerR(x) * 0.6, a = hash(i * 9) * TAU;
    gran.setMatrixAt(i, tmpM.makeTranslation(x * (i % 8 === 3 || i % 8 === 4 ? 0.8 : 1), Math.cos(a) * r, Math.sin(a) * r));
  }
  root.add(gran);

  // matrix specks + cytosol specks
  const speck = (n, fn, size, colors, opacity) => {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), pal = colors.map((c) => new THREE.Color(c));
    for (let i = 0; i < n; i++) { fn(i, tmpV); pos.set([tmpV.x, tmpV.y, tmpV.z], i * 3); const c = pal[i % pal.length]; col.set([c.r, c.g, c.b], i * 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ size, map: softDot(), vertexColors: true, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  };
  root.add(speck(260, (i, v) => { const x = (hash(i * 1.7) - 0.5) * 2 * (HALF - 1.5), r = innerR(x) * Math.sqrt(hash(i * 2.9)) * 0.92, a = hash(i * 4.3) * TAU; v.set(x, Math.cos(a) * r, Math.sin(a) * r); }, 0.12, ["#5eead4", "#99f6e4", "#fef3c7"], 0.35));
  const cyto = speck(500, (i, v) => { do v.set((Math.random() - 0.5) * 80, (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50); while (Math.abs(v.x) < HALF + 1 && Math.hypot(v.y, v.z) < RO + 1); }, 0.3, ["#99f6e4", "#c4b5fd", "#fef3c7", "#a3e635"], 0.3);
  root.add(cyto);
  // out-of-focus neighbours: a chloroplast and the ER in the background
  const chl = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), physical("#15803d", { transparent: true, opacity: 0.45, roughness: 0.5 }));
  chl.scale.set(16, 6, 9); chl.position.set(14, -12, -26); root.add(chl);
  const er = new THREE.Mesh(new THREE.TorusKnotGeometry(6, 0.9, 120, 10, 2, 3), physical("#14b8a6", { transparent: true, opacity: 0.3 }));
  er.position.set(-34, 18, -50); er.material.opacity = 0.16; root.add(er);

  // H⁺ in the intermembrane space + crista lumens (brightness ∝ gradient)
  const hPts = speck(300, (i, v) => {
    if (i < 150) { const x = (hash(i * 1.3) - 0.5) * 2 * (HALF - 0.6), a = hash(i * 2.1) * TAU, r = innerR(x, (RO + RI) / 2 + 0.02); v.set(x, Math.cos(a) * r, Math.sin(a) * r); }
    else { const pl = plates[i % plates.length], u = (hash(i * 3.3) * 2 - 1) * pl.w, vv = pl.h - hash(i * 5.1) * (pl.h + pl.R * 0.8); plateLocal(pl, u, vv, 0, v); v.applyMatrix4(pl.m.matrixWorld); }
  }, 0.24, ["#f472b6", "#f9a8d4"], 0.6);
  hPts.material.clippingPlanes = clip;
  root.add(hPts);

  // glycolysis "station" in the cytosol: a cluster of enzymes
  const glyG = new THREE.Group();
  glyG.position.copy(GLY);
  const glyMat = physical("#84cc16", { emissive: new THREE.Color("#a3e635"), emissiveIntensity: 0.25 });
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 2), glyMat); m.position.set((hash(i) - 0.5) * 1.8, (hash(i + 3) - 0.5) * 1.0, (hash(i + 6) - 0.5) * 1.2); glyG.add(m); }
  tag(glyG, "glycolysis");
  glyG.children.forEach((c) => pickables.push(c));
  root.add(glyG);
  const fermG = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 2), physical("#94a3b8", { emissive: new THREE.Color("#cbd5e1"), emissiveIntensity: 0.1 }));
  fermG.position.copy(FERM); fermG.visible = false; root.add(fermG);

  // ---------- flows (instanced molecules on curved paths) ----------
  const geo = {
    glucose: new THREE.TorusGeometry(0.28, 0.1, 6, 6),
    pyr: mergeGeometries([paint(new THREE.SphereGeometry(0.12, 10, 8).translate(-0.14, 0, 0), "#facc15"), paint(new THREE.SphereGeometry(0.12, 10, 8), "#facc15"), paint(new THREE.SphereGeometry(0.12, 10, 8).translate(0.14, 0, 0), "#fde047")]),
    acoa: mergeGeometries([paint(new THREE.SphereGeometry(0.12, 10, 8), "#fb7185"), paint(new THREE.CapsuleGeometry(0.06, 0.3, 4, 8).rotateZ(Math.PI / 2).translate(0.28, 0, 0), "#fecdd3")]),
    co2: mergeGeometries([paint(new THREE.SphereGeometry(0.12, 10, 8), "#475569"), paint(new THREE.SphereGeometry(0.12, 10, 8).translate(-0.2, 0, 0), "#ef4444"), paint(new THREE.SphereGeometry(0.12, 10, 8).translate(0.2, 0, 0), "#ef4444")]),
    nadh: mergeGeometries([paint(new THREE.SphereGeometry(0.13, 10, 8).translate(-0.1, 0, 0), "#60a5fa"), paint(new THREE.SphereGeometry(0.13, 10, 8).translate(0.1, 0, 0), "#93c5fd")]),
    fadh: mergeGeometries([paint(new THREE.SphereGeometry(0.12, 10, 8).translate(-0.09, 0, 0), "#4ade80"), paint(new THREE.SphereGeometry(0.12, 10, 8).translate(0.09, 0, 0), "#86efac")]),
    o2: mergeGeometries([paint(new THREE.SphereGeometry(0.13, 10, 8).translate(-0.1, 0, 0), "#f87171"), paint(new THREE.SphereGeometry(0.13, 10, 8).translate(0.1, 0, 0), "#f87171")]),
    h2o: mergeGeometries([paint(new THREE.SphereGeometry(0.12, 10, 8), "#7dd3fc"), paint(new THREE.SphereGeometry(0.07, 8, 6).translate(0.1, -0.08, 0), "#f1f5f9"), paint(new THREE.SphereGeometry(0.07, 8, 6).translate(-0.1, -0.08, 0), "#f1f5f9")]),
    atp: mergeGeometries([paint(new THREE.SphereGeometry(0.15, 12, 10), "#fbbf24"), paint(new THREE.SphereGeometry(0.08, 8, 6).translate(0.2, 0, 0), "#fde68a"), paint(new THREE.SphereGeometry(0.08, 8, 6).translate(0.33, 0, 0), "#fde68a"), paint(new THREE.SphereGeometry(0.08, 8, 6).translate(0.46, 0, 0), "#fde68a")]),
    adp: mergeGeometries([paint(new THREE.SphereGeometry(0.13, 10, 8), "#b7791f"), paint(new THREE.SphereGeometry(0.07, 8, 6).translate(0.18, 0, 0), "#fde68a"), paint(new THREE.SphereGeometry(0.07, 8, 6).translate(0.3, 0, 0), "#fde68a")]),
  };
  geo.glucose = paint(geo.glucose, "#a3e635");
  const FLOW = {
    glucose: { max: 18, label: { "y7-8": "Glucose", y11: "Glucose" }, color: "#a3e635" },
    pyr: { max: 40, label: { "y7-8": "Glucose halves (pyruvate)", "y9-10": "Pyruvate" }, color: "#facc15" },
    acoa: { max: 20, label: "Acetyl-CoA", color: "#fb7185", band: "y11" },
    co2: { max: 40, label: { "y7-8": "Carbon dioxide", "y9-10": "CO₂" }, color: "#94a3b8" },
    nadh: { max: 40, label: { "y7-8": "Energy carriers (NADH)", "y9-10": "NADH" }, color: "#60a5fa" },
    fadh: { max: 14, label: "FADH₂", color: "#4ade80", band: "y11" },
    o2: { max: 30, label: { "y7-8": "Oxygen", "y9-10": "O₂" }, color: "#f87171" },
    h2o: { max: 24, label: { "y7-8": "Water", "y9-10": "H₂O" }, color: "#7dd3fc" },
    atp: { max: 40, label: { "y7-8": "Energy (ATP)", "y9-10": "ATP" }, color: "#fbbf24" },
    adp: { max: 20, label: "ADP", color: "#b7791f", band: "y9-10" },
  };
  const flowMat = (k) => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.25, clearcoat: 1, emissive: new THREE.Color(k === "atp" ? "#fbbf24" : FLOW[k].color), emissiveIntensity: k === "atp" ? 0.8 : 0.22 });
  const flows = {};
  for (const k of Object.keys(FLOW)) {
    const im = new THREE.InstancedMesh(geo[k], flowMat(k), FLOW[k].max + 20);
    im.count = 0; im.frustumCulled = false;
    root.add(im);
    flows[k] = { im, parts: [], acc: 0 };
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  const randDir = (v) => v.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize();
  const outside = (v, near) => { // a point out in the cytosol beyond the outer membrane
    const x = THREE.MathUtils.clamp(near ? near.x : rnd(-HALF, HALF), -HALF + 2, HALF - 2);
    const a = rnd(0, TAU), r = RO + rnd(2.5, 4.5);
    return v.set(x + rnd(-1.5, 1.5), Math.cos(a) * r, -Math.abs(Math.sin(a)) * r * 0.4 + rnd(-1, 2.5));
  };
  const synPos = (v) => { synthase.getMatrixAt(Math.floor(Math.random() * synthase.count), tmpM); return v.setFromMatrixPosition(tmpM); };
  const etcPos = (v) => v.copy(etcSpots[Math.floor(Math.random() * etcSpots.length)]);
  const krebsPoint = (v, a = rnd(0, TAU)) => v.set(KREBS.x + Math.cos(a) * KR, KREBS.y + Math.sin(a) * KR, KREBS.z);

  function spawn(k, a, b, dur, c) {
    const f = flows[k];
    if (f.parts.length >= FLOW[k].max) return;
    const ctrl = c ? c.clone() : a.clone().lerp(b, 0.5).add(randDir(tmpV2).multiplyScalar(a.distanceTo(b) * 0.25));
    f.parts.push({ a: a.clone(), b: b.clone(), c: ctrl, t: 0, dur, spin: Math.random() * 6 });
  }
  const shown = (k) => lens.atLeast(FLOW[k].band || "y7-8");
  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3();

  function emitFlows(dt) {
    const F = M.F;
    const want = (k, rate, fn) => {
      const f = flows[k];
      if (!shown(k)) return;
      f.acc += Math.max(0, rate) * dt;
      let n = 0;
      while (f.acc >= 1 && n++ < 4) { f.acc -= 1; fn(); }
      if (f.acc > 3) f.acc = 3;
    };
    // glycolysis in the cytosol: glucose arrives at the enzymes, 2 pyruvate leave
    want("glucose", F.gly * 1.4, () => spawn("glucose", pa.set(GLY.x - 9 + rnd(-2, 2), GLY.y + 4 + rnd(-2, 2), GLY.z + rnd(-3, 3)), GLY, 2.6));
    want("pyr", F.imp * 1.4, () => spawn("pyr", tmpV.copy(GLY).add(randDir(pa).multiplyScalar(0.6)), tmpV2.copy(PDH).add(randDir(pb).multiplyScalar(0.4)), 3.2, pc.copy(ENTRY).add(randDir(pa).multiplyScalar(0.6))));
    if (F.ferm > 0.05) want("pyr", F.ferm * 1.4, () => spawn("pyr", GLY, FERM, 2.4));
    want("acoa", F.pdh * 1.2, () => spawn("acoa", PDH, krebsPoint(pa, Math.PI * 0.6), 1.2));
    want("co2", (F.pdh + 2 * F.krebs) * 0.7, () => { const from = Math.random() < 0.33 ? PDH : krebsPoint(pa); spawn("co2", from, outside(pb, from), 3.4); });
    if (F.ferm > 0.05) want("co2", F.ferm * 0.7, () => spawn("co2", FERM, pb.set(FERM.x - rnd(4, 8), FERM.y + rnd(-2, 4), FERM.z + rnd(-3, 3)), 2.6));
    want("nadh", (F.pdh + 3 * F.krebs) * 0.45, () => { const from = Math.random() < 0.25 ? PDH : krebsPoint(pa); spawn("nadh", from, etcPos(pb), 1.8); });
    want("fadh", F.krebs * 0.35, () => spawn("fadh", krebsPoint(pa), etcPos(pb), 1.8));
    want("o2", F.o2 * 0.9, () => spawn("o2", outside(pa), etcPos(pb), 3.0));
    want("h2o", F.h2o * 0.25, () => { etcPos(pa); spawn("h2o", pa, pb.copy(pa).multiplyScalar(0.7).add(randDir(pc).multiplyScalar(0.6)), 2.2); });
    want("atp", F.atpMito * 0.32, () => { synPos(pa); spawn("atp", pa, outside(pb, pa), 3.4); });
    want("atp", 2 * F.gly * 0.5, () => spawn("atp", GLY, pb.copy(GLY).add(randDir(pc).multiplyScalar(rnd(2, 4))), 2.0));
    want("adp", F.atpMito * 0.14, () => { synPos(pb); spawn("adp", outside(pa, pb), pb, 3.4); });
  }

  function drawFlows(dt) {
    const s = tmpS;
    for (const [k, f] of Object.entries(flows)) {
      let n = 0;
      if (dt > 0) f.parts = f.parts.filter((p) => (p.t += dt / p.dur) < 1);
      for (const p of f.parts) {
        const t = p.t, u = 1 - t;
        tmpV.set(0, 0, 0).addScaledVector(p.a, u * u).addScaledVector(p.c, 2 * u * t).addScaledVector(p.b, t * t);
        tmpQ.setFromEuler(tmpE.set(p.spin + t * 3, p.spin * 0.7 + t * 2, 0));
        const sc = Math.min(1, t * 6, (1 - t) * 6);
        f.im.setMatrixAt(n++, tmpM.compose(tmpV, tmpQ, s.set(sc, sc, sc)));
      }
      // backed-up pools: pyruvate waiting at the carrier, NADH crowding the matrix
      if (k === "pyr") n = drawWaiting(f.im, n, Math.round((M.pyr / 15) * 16), PDH, 0.9, 1);
      if (k === "nadh") n = drawWaiting(f.im, n, Math.round(Math.max(0, M.nadh - 0.45) * 30), KREBS, 2.3, 2);
      f.im.count = n;
      f.im.instanceMatrix.needsUpdate = true;
    }
  }
  function drawWaiting(im, n, count, centre, spread, seed) {
    const t = simTime;
    for (let i = 0; i < count && n < im.instanceMatrix.count; i++) {
      const j = engine.reducedMotion ? 0 : Math.sin(t * 2 + i) * 0.08;
      tmpV.set(centre.x + (hash(i * 3 + seed) - 0.5) * spread * 2 + j, centre.y + (hash(i * 5 + seed) - 0.5) * spread * 1.4, centre.z + (hash(i * 7 + seed) - 0.5) * spread * 1.6);
      tmpQ.setFromEuler(tmpE.set(i, i * 1.3 + t * 0.3, 0));
      im.setMatrixAt(n++, tmpM.compose(tmpV, tmpQ, tmpS.set(0.9, 0.9, 0.9)));
    }
    return n;
  }

  // ---------- heat shimmer (uncoupler) ----------
  const heat = [];
  for (let i = 0; i < 16; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: "#fb923c", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    s.visible = false; root.add(s); heat.push(s);
  }
  const selGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: "#5eead4", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 }));
  selGlow.visible = false; root.add(selGlow);

  // ---------- portals ----------
  const portals = [{ to: "cristae", label: "Inner membrane (cristae)", object: portalRing, objects: [portalRing, portalDisc], radius: 1.0, center: () => PORTAL.clone() }];

  // ---------- labels ----------
  const labels = {};
  const LBL = {
    outer: () => tmpV.set(-3, RO + 0.6, 0.6),
    ims: () => tmpV.set(6.5, -(RO + RI) / 2 - 0.1, -0.8),
    inner: () => tmpV.set(-10.6, -2.6, -1.4),
    crista: () => tmpV.set(CRISTAE[4], -2.9, -1.0),
    matrix: () => tmpV.set(-1.9, -1.4, 1.8),
    krebs: () => tmpV.set(KREBS.x + KR + 0.9, KREBS.y + 0.9, KREBS.z),
    glycolysis: () => tmpV.set(GLY.x, GLY.y + 1.3, GLY.z),
    synthase: () => tmpV.set(CRISTAE[7] + 0.3, plates[7].h * Math.cos(plates[7].m.rotation.x), plates[7].h * Math.sin(plates[7].m.rotation.x)),
    mtdna: () => tmpV.set(2.3, -3.2, 0.6),
    ribo: () => tmpV.set(-1.4, 3.0, 1.0),
  };
  const LBL_BAND = { mtdna: "y9-10", ribo: "y11", ims: "y9-10" };
  const diveLbl = engine.label("", "dive");
  const fermLbl = engine.label("", "org");
  function makeLabels() {
    for (const el of Object.values(labels)) el.remove();
    for (const k of Object.keys(LBL)) labels[k] = engine.label("", "org");
  }
  function status(k) {
    const F = M.F, y7 = lens.band === "y7-8";
    if (k === "krebs") return F.krebs < 0.1 ? (M.nadh > 0.85 ? (y7 ? "stopped" : "stalled — no NAD⁺") : "stopped — no fuel") : `${F.krebs.toFixed(1)} turns/s`;
    if (k === "glycolysis") return F.gly < 0.02 ? "no glucose" : `${F.gly.toFixed(1)} glucose/s`;
    if (k === "synthase") return M.olig ? "blocked (oligomycin)" : F.atpMito < 0.5 ? "stopped" : `${F.atpMito.toFixed(0)} ATP/s`;
    if (k === "crista") return M.o2f === 0 ? (M.cyanide ? "ETC blocked (cyanide)" : "ETC stopped — no O₂") : `H⁺ gradient ${Math.round(M.G * 100)}%`;
    return "";
  }
  const NARROW_HIDE = { ims: 1, ribo: 1, mtdna: 1, matrix: 1, inner: 1 }; // too crowded on a phone in portrait
  function updateLabels() {
    const narrow = engine.camera.aspect < 0.8;
    for (const [k, el] of Object.entries(labels)) {
      if (!state.labels || (LBL_BAND[k] && !lens.atLeast(LBL_BAND[k])) || (narrow && NARROW_HIDE[k])) { el.style.display = "none"; continue; }
      const s = status(k);
      const html = `${lens.pick(PARTS[k].name)}${s ? `<small>${s}</small>` : ""}`;
      if (el._h !== html) { el.innerHTML = html; el._h = html; }
      el.classList.toggle("off", /stopped|stalled|blocked|no /.test(s));
      engine.place(el, LBL[k]());
    }
    const dh = lens.pick({ "y7-8": "🔍 Zoom into a fold", "y9-10": "🔍 Zoom into the inner membrane" });
    if (diveLbl._h !== dh) { diveLbl.innerHTML = dh; diveLbl._h = dh; }
    engine.place(diveLbl, tmpV.copy(PORTAL).add(tmpV2.set(0.3, 1.25, 0)));
    const showF = state.labels && M.F.ferm > 0.1;
    fermG.visible = M.F.ferm > 0.1;
    if (showF) {
      const fh = `${lens.pick({ "y7-8": "Fermentation (cytoplasm)", "y9-10": "Fermentation (cytoplasm)", y11: "Fermentation (cytosol)" })}<small>${lens.pick({ "y7-8": "ethanol + CO₂", y11: `ethanol + CO₂ · ${M.F.ferm.toFixed(1)} pyruvate/s` })}</small>`;
      if (fermLbl._h !== fh) { fermLbl.innerHTML = fh; fermLbl._h = fh; }
      engine.place(fermLbl, tmpV.copy(FERM).add(tmpV2.set(0, 1.1, 0)));
    } else fermLbl.style.display = "none";
  }

  // ---------- info / selection ----------
  function infoFor(kind, obj) {
    const p = PARTS[kind === "portal" ? "crista" : kind];
    if (!p) return null;
    const portal = kind === "portal" || kind === "crista" ? portals[0] : null;
    return { kind: kind === "portal" ? "crista" : kind, title: lens.pick(p.name), portal, object: obj };
  }

  // ---------- panel ----------
  let progress = null, panelEl, explainBody, selCard, chart, chartCtx, mission, ctl = {}, chipFns = null;
  function buildPanel(el) {
    panelEl = el;
    const host = document.createElement("div");
    host.style.display = "contents";
    host.className = "mito";
    el.appendChild(host);
    progress = { band: lens.band, node: host };
    el = host;
    const y7 = lens.band === "y7-8";

    const ex = K.card(el, "What's happening", "explain");
    explainBody = document.createElement("div");
    ex.appendChild(explainBody);
    ex.insertAdjacentHTML("beforeend", `<p class="hint">${lens.pick({ "y7-8": "Not to scale: molecules are drawn huge and everything is slowed down. Click a part to learn what it does.", "y9-10": "Not to scale (molecules drawn huge, slowed down). Click a part; zoom into the glowing ring to see the inner membrane up close.", y11: "Not to scale: molecules drawn ≈ 50× too big and rates slowed. The membranes are sliced open on the side facing you (cut-away view). Click any part for its inputs and outputs." })}</p>`);

    selCard = K.card(el, "Selected", "sel-card");
    selCard.style.display = "none";

    const cond = K.card(el, "Conditions");
    ctl.supply = K.slider(cond, { label: lens.pick({ "y7-8": "Glucose (food) supply", "y9-10": "Glucose supply (→ pyruvate)" }), min: 0, max: 100, step: 5, value: M.supply, unit: " %", onInput: (v) => { M.supply = v; shared.supply = v; } });
    ctl.o2 = K.slider(cond, { label: lens.pick({ "y7-8": "Oxygen", "y9-10": "Oxygen (O₂)" }), min: 0, max: 100, step: 5, value: M.o2, unit: " %", onInput: (v) => { M.o2 = v; shared.o2 = v; } });
    ctl.demand = K.slider(cond, { label: lens.pick({ "y7-8": "How much energy the cell is using", "y9-10": "ATP demand (how fast the cell uses ATP)", y11: "ATP demand (ADP supply)" }), min: 0, max: 100, step: 5, value: M.demand, unit: " %", onInput: (v) => (M.demand = v) });
    const r = K.buttonRow(cond);
    K.button(r, "Reset", () => {
      Object.assign(M, { supply: 70, o2: 100, demand: 40, cyanide: false, anoxia: false, dnp: false, olig: false });
      M.reset(); syncShared(); syncControls();
      for (const f of Object.values(flows)) { f.parts.length = 0; f.acc = 0; }
      engine.toast("Reset");
    });

    const ko = K.card(el, lens.pick({ "y7-8": "Break something", "y9-10": "Knockouts and poisons" }), "ko");
    const KO = [
      ["cyanide", { "y7-8": "Cyanide (poison)", "y9-10": "Cyanide — blocks complex IV" }, { "y7-8": "Stops oxygen being used.", "y9-10": "Electrons can't reach O₂." }],
      ["anoxia", { "y7-8": "No oxygen", "y9-10": "No O₂ (anoxia)" }, { "y7-8": "Takes all the oxygen away.", "y9-10": "Flooded roots, sealed container…" }],
      ["dnp", { "y7-8": "Uncoupler (leaky membrane)", "y9-10": "Uncoupler (DNP)" }, { "y7-8": "H⁺ leak back without making ATP.", "y9-10": "H⁺ leak across the inner membrane → heat." }],
      ["olig", { "y7-8": "Oligomycin (jams the motors)", "y9-10": "Oligomycin — blocks ATP synthase" }, { "y7-8": "ATP-making motors stop.", "y9-10": "H⁺ can't flow back through F₀." }],
    ];
    for (const [key, label, hint] of KO) {
      ctl[key] = K.checkbox(ko, lens.pick(label), M[key], (v) => {
        M[key] = v; shared[key] = v;
        engine.toast(`${lens.pick(label)}: ${v ? "on" : "off"}`);
      });
      ko.insertAdjacentHTML("beforeend", `<small>${lens.pick(hint)}</small>`);
    }

    const view = K.card(el, "View");
    K.checkbox(view, "Cut-away (slice open the side facing you)", state.cut, (v) => (state.cut = v));
    K.checkbox(view, "Show labels", state.labels, (v) => (state.labels = v));
    const key = document.createElement("div");
    key.className = "flow-key"; key.style.marginTop = "8px";
    for (const [k, f] of Object.entries(FLOW)) if (shown(k)) key.insertAdjacentHTML("beforeend", `<span><i style="background:${f.color};box-shadow:0 0 8px ${f.color}"></i>${lens.pick(f.label)}</span>`);
    key.insertAdjacentHTML("beforeend", `<span><i style="background:#f472b6;box-shadow:0 0 8px #f472b6"></i>H⁺</span>`);
    view.appendChild(key);

    const ch = K.card(el, lens.pick({ "y7-8": "Energy output over time", "y9-10": "Respiration over time" }));
    chart = document.createElement("canvas");
    chart.className = "mini-chart";
    chart.setAttribute("role", "img");
    ch.appendChild(chart);
    chartCtx = chart.getContext("2d");
    ch.insertAdjacentHTML("beforeend", `<div class="legend" style="margin-top:6px"><span><i style="background:#fbbf24"></i>${y7 ? "Energy (ATP)/s" : "ATP/s"}</span><span><i style="background:#f87171"></i>${y7 ? "Oxygen used" : "O₂ use"}</span><span><i style="background:#f472b6"></i>${y7 ? "H⁺ build-up" : "H⁺ gradient"}</span>${lens.atLeast("y11") ? `<span><i style="background:#60a5fa"></i>NADH (reduced %)</span>` : ""}</div>`);

    const bp = K.card(el, lens.pick({ "y7-8": "The big picture", "y9-10": "The big picture: respiration" }));
    bp.insertAdjacentHTML("beforeend", lens.pick(BIG_PICTURE));
    const r2 = K.buttonRow(bp);
    K.button(r2, lens.pick({ "y7-8": "Zoom into a fold ▸", "y9-10": "Zoom into the inner membrane ▸" }), () => engine.dive(portals[0]), { kind: "primary" });

    mission = K.missions(el, lens.filter(MISSIONS).map((m) => ({ text: lens.pick(m.text), check: () => m.check(M, state) })), (m) => engine.toast(`🎯 Mission complete: ${m.text}`, 3600));
    K.quiz(el, lens.filter(QUIZ));
  }

  function buildChips() {
    const ov = engine.overlay;
    ov.innerHTML = "";
    chipFns = { pyr: K.chip(ov), atp: K.chip(ov), o2: K.chip(ov), co2: K.chip(ov), g: K.chip(ov), y: K.chip(ov) };
    chipFns.els = [...ov.children];
    for (const c of chipFns.els) c.classList.add("mito-chip");
  }
  function updateChips() {
    if (!chipFns) return;
    const F = M.F, S = M.smooth, y7 = lens.band === "y7-8", d = (c) => `<i class="dot" style="background:${c}"></i>`;
    chipFns.pyr(`${d("#facc15")}${y7 ? "Food in" : "Pyruvate in"} <b>${F.imp.toFixed(1)}</b><span class="w">/s</span>`);
    chipFns.atp(`${d("#fbbf24")}${y7 ? "Energy (ATP) out" : "ATP out"} <b>${S.atp.toFixed(0)}</b><span class="w">/s</span>`);
    chipFns.o2(`${d("#f87171")}${y7 ? "Oxygen used" : "O₂ use"} <b>${F.o2.toFixed(1)}</b><span class="w">/s</span>`);
    chipFns.co2(`${d("#94a3b8")}CO₂ out <b>${F.co2.toFixed(1)}</b><span class="w">/s</span>`);
    chipFns.g(`${d("#f472b6")}${y7 ? "H⁺ build-up" : "H⁺ gradient"} <b>${Math.round(M.G * 100)}%</b>`);
    const showY = lens.atLeast("y11");
    chipFns.y(showY ? `ATP per glucose <b>${F.gly > 0.02 ? (M.steady ? Math.round(S.yield) : "settling…") : "—"}</b>` : "");
    chipFns.els[5].style.display = showY ? "" : "none";
    chipFns.els[1].classList.toggle("warn", S.atp < 3);
  }

  function drawChart() {
    if (!chart) return;
    const w = chart.clientWidth, h = chart.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    if (!w) return;
    if (chart.width !== Math.round(w * dpr)) { chart.width = Math.round(w * dpr); chart.height = Math.round(h * dpr); }
    const c = chartCtx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    c.strokeStyle = "rgba(255,255,255,0.08)";
    for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(0, (h * i) / 4); c.lineTo(w, (h * i) / 4); c.stroke(); }
    const H = M.hist;
    chart.setAttribute("aria-label", `ATP output ${M.smooth.atp.toFixed(0)} per second, oxygen use ${M.F.o2.toFixed(1)} per second, H⁺ gradient ${Math.round(M.G * 100)} percent.`);
    if (H.length < 2) return;
    const series = [["G", "#f472b6", 1], ["o2", "#f87171", 6], ["atp", "#fbbf24", MitoModel.ATP_SCALE]];
    if (lens.atLeast("y11")) series.unshift(["nadh", "#60a5fa", 1]);
    for (const [k, col, max] of series) {
      c.strokeStyle = col; c.lineWidth = 2; c.beginPath();
      H.forEach((p, i) => { const x = (i / 239) * w, y = h - Math.min(1, p[k] / max) * (h - 4) - 2; i ? c.lineTo(x, y) : c.moveTo(x, y); });
      c.stroke();
    }
  }

  function syncShared() { Object.assign(shared, { supply: M.supply, o2: M.o2, anoxia: M.anoxia, cyanide: M.cyanide, dnp: M.dnp, olig: M.olig, dirty: false }); }
  function syncControls() {
    if (!ctl.supply) return;
    ctl.supply.value = M.supply; ctl.o2.value = M.o2; ctl.demand.value = M.demand;
    for (const k of ["cyanide", "anoxia", "dnp", "olig"]) if (ctl[k]) ctl[k].checked = M[k];
  }

  function showSelection(info) {
    if (!selCard) return;
    if (!info) { selCard.style.display = "none"; selGlow.visible = false; return; }
    const p = PARTS[info.kind];
    const now = status(info.kind);
    selCard.style.display = "";
    selCard.innerHTML = `<h2>Selected</h2><p style="color:var(--ink);font-weight:600;margin-bottom:4px"><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};margin-right:6px"></i>${lens.pick(p.name)}</p>
      <p>${lens.pick(p.role)}</p>
      ${p.inputs || now ? `<div class="io">${p.inputs ? `<b>In</b><span>${lens.pick(p.inputs)}</span><b>Out</b><span>${lens.pick(p.outputs)}</span>` : ""}${now ? `<b>Now</b><span>${now}</span>` : ""}</div>` : ""}
      ${info.portal ? `<div class="btn-row"><button class="btn primary" data-act="zoom">Zoom into the inner membrane ▸</button></div>` : ""}`;
    selCard.querySelector('[data-act="zoom"]')?.addEventListener("click", () => engine.dive(info.portal));
    selGlow.visible = !!info.point;
    if (info.point) { selGlow.position.copy(info.point); selGlow.scale.setScalar(2.2); }
    if (panelEl) panelEl.parentElement?.scrollTo?.({ top: 0, behavior: "smooth" });
  }

  function updateExplain() {
    if (!explainBody) return;
    const html = narrative(M, lens.band).map((p) => `<p>${p}</p>`).join("");
    if (explainBody.innerHTML !== html) explainBody.innerHTML = html;
  }

  // ---------- per-frame visuals ----------
  const camDir = new THREE.Vector3();
  function animate(dt, t) {
    const F = M.F, still = engine.reducedMotion;
    // cut-away plane faces the camera
    if (state.cut) {
      camDir.copy(engine.camera.position).sub(engine.controls.target).normalize();
      cut.normal.copy(camDir).negate();
      cut.constant = CUT_C;
    } else { cut.normal.set(0, 0, -1); cut.constant = 1e4; }
    // Krebs cycle turns at the model's rate
    krebsPhase += dt * F.krebs * 1.6;
    for (let i = 0; i < 8; i++) {
      const a = krebsPhase + (i / 8) * TAU;
      beads.setMatrixAt(i, tmpM.makeTranslation(Math.cos(a) * KR, Math.sin(a) * KR, 0));
    }
    beads.instanceMatrix.needsUpdate = true;
    krebsMat.emissiveIntensity = 0.15 + Math.min(1.2, F.krebs * 0.8);
    beads.material.emissiveIntensity = 0.15 + Math.min(1, F.krebs * 0.6);
    // H⁺ gradient: pink glow in the crista lumens + IMS points
    cristaMat.emissiveIntensity = M.G * 0.32;
    hPts.material.opacity = 0.08 + 0.7 * M.G;
    hPts.material.size = 0.14 + 0.16 * M.G;
    // ETC activity: complexes flicker with electron flow; cyanide turns them dull red
    etcMat.emissiveIntensity = Math.min(0.9, (F.eN + F.eF) * 0.08) * (still ? 1 : 0.85 + 0.15 * Math.sin(t * 9));
    etcMat.color.set(M.cyanide ? "#7f1d1d" : "#c7d2fe");
    // ATP synthase glow ∝ synthesis rate; grey when oligomycin-blocked
    synMat.emissiveIntensity = Math.min(0.9, F.atpMito * 0.05);
    synMat.color.set(M.olig ? "#6b7280" : "#ffffff");
    // heat from proton leak
    const ht = M.heat;
    outerMat.emissive.set("#fb923c").multiplyScalar(ht * (0.35 + (still ? 0 : 0.15 * Math.sin(t * 6))));
    for (let i = 0; i < heat.length; i++) {
      const s = heat[i];
      s.visible = ht > 0.05 && !still;
      if (!s.visible) continue;
      const ph = (t * 0.25 + i * 0.0625) % 1, x = -HALF + 1 + ((i * 7.7) % (2 * HALF - 2)), a = (i * 2.4) % TAU;
      s.position.set(x, Math.cos(a) * (RO + ph * 3), Math.sin(a) * (RO + ph * 3));
      s.material.opacity = 0.5 * ht * (1 - ph);
      s.scale.setScalar(2 + ph * 3);
    }
    // portal ring
    portalRing.rotation.x = still ? 0 : t * 0.4;
    portalRing.material.emissiveIntensity = 0.9 + Math.sin(t * 2.5) * 0.4;
    glyMat.emissiveIntensity = 0.1 + Math.min(0.8, F.gly * 0.8);
    if (!still) { cyto.rotation.y = Math.sin(t * 0.02) * 0.05; dna.rotation.x = Math.sin(t * 0.1) * 0.05; }
    if (selGlow.visible) selGlow.material.opacity = 0.35 + 0.2 * Math.sin(t * 3);
  }

  // ---------- level object ----------
  let uiT = 0, exT = 0, chT = 0, simTime = 0;
  const level = {
    title: "Mitochondrion",
    topics: ["respiration", "atp", "organelles", "cell-structure", "enzymes"],
    root, pickables, fallbackPickables, portals, shared,
    entryRadius: 14,                   // portal radius 1.4 µm in the cell ↔ 14 units here (1 unit = 100 nm)
    get view() {
      const a = engine.camera.aspect, t = Math.tan(THREE.MathUtils.degToRad(engine.camera.fov / 2));
      const halfW = a < 0.9 ? 12.5 : 14;
      return { target: new THREE.Vector3(-0.8, 1.2, 0), distance: Math.min(70, Math.max(26, halfW / (t * a))), dir: new THREE.Vector3(0.42, 0.36, 1) };
    },
    minDistance: 4, maxDistance: 75, near: 0.05, far: 600,
    env: { bg: ["#0b1a2e", "#1c2a1a", "#3a1c12"], fog: ["#0c1c26", 0.008], exposure: 1.05, bloom: [0.5, 0.55, 0.84], aperture: 0.0009 },
    info(obj) {
      const kind = obj.userData.kind;
      if (!kind) return null;
      return infoFor(kind, obj);
    },
    onSelect(info) { showSelection(info); },
    mountPanel(el) {
      makeLabels();
      if (progress && progress.band === lens.band) { panelEl = el; el.appendChild(progress.node); }
      else buildPanel(el);
      buildChips();
    },
    unmountPanel() { for (const el of Object.values(labels)) el.style.display = "none"; diveLbl.style.display = "none"; fermLbl.style.display = "none"; engine.overlay.innerHTML = ""; chipFns = null; },
    onPause() { state.dived = true; },
    onResume() {
      makeLabels();
      if (shared.dirty) {
        M.supply = shared.supply; M.o2 = shared.anoxia ? M.o2 : shared.o2; M.anoxia = shared.anoxia;
        M.cyanide = shared.cyanide; M.dnp = shared.dnp; M.olig = shared.olig;
        shared.dirty = false;
        syncControls();
        engine.toast(lens.pick({ "y7-8": "Your changes inside the fold are still switched on here.", "y9-10": "Conditions you set on the inner membrane carry over to the whole mitochondrion." }), 3200);
      }
    },
    onLens() { progress = null; panelEl.innerHTML = ""; buildPanel(panelEl); buildChips(); },
    dispose() {
      for (const el of Object.values(labels)) el.remove();
      diveLbl.remove(); fermLbl.remove();
    },
    update(dt, t, realDt) {
      const rdt = realDt ?? dt;
      simTime = t;
      M.step(dt);
      emitFlows(dt);
      drawFlows(dt);
      animate(dt, t);
      updateLabels();
      uiT -= rdt; exT -= rdt; chT -= rdt;
      if (uiT <= 0) { uiT = 0.25; updateChips(); }
      if (exT <= 0) { exT = 0.6; updateExplain(); }
      if (chT <= 0) { chT = 0.5; drawChart(); }
      mission?.update();
    },
  };
  return level;
}
