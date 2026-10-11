// Organelle level: the plant cell's nucleus, magnified (1 unit = 0.5 µm; nucleus ≈ 10 µm across).
// A working nucleus driven by NucleusModel (nucleusModel.js): chromatin state + NTP supply + imported
// RNA polymerase → transcription of individual genes (polymerases and growing mRNA on each gene) →
// processing → export through 8-fold nuclear pore complexes; the nucleolus makes ribosomal subunits;
// proteins (polymerase, histones, ribosomal proteins) are imported through the same pores.
import * as THREE from "three";
import * as K from "../../kit.js";
import { physical, glass, softDot, hash, paint, wobble } from "../materials.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { NucleusModel } from "./nucleusModel.js";
import { PARTS, GENE_INFO, BIG_PICTURE, MISSIONS, QUIZ, narrative } from "./nucleusContent.js";

const TAU = Math.PI * 2;
const RO = 10, RI = 9.55, RM = (RO + RI) / 2, LAM = 9.38;   // outer / inner membrane, pore ring, lamina
const CUT_C = 1.2;                                          // cut-away plane offset toward the camera
const NO = new THREE.Vector3(-2.7, 1.9, -2.6), NO_R = 2.5;   // nucleolus
const NPORE = 120;
const TR = 2.55;                                             // chromosome territory radius
const TERR_COL = ["#f472b6", "#f9a8d4", "#c084fc", "#ddd6fe", "#fb923c", "#fdba74", "#2dd4bf", "#99f6e4", "#818cf8", "#c7d2fe"];
const MRNA_COL = "#60a5fa";
// gene → territory, and the direction (from the territory centre) the gene loop points
const GENE_PLACE = { hbb: [0, 0], rbcs: [2, 1], lhcb: [4, 2], act: [6, 3], h4: [8, 4] };
// exon / intron layout of the β-globin transcript (fractions of its length): exon1, intron1, exon2, intron2, exon3
const HBB_INTRONS = [[0.089, 0.17], [0.31, 0.84]];

const CSS = `
.nuc-chip .w { color: var(--ink-faint); }
.nuc .flow { list-style: none; padding: 0; margin: 8px 0 10px; display: flex; flex-direction: column; gap: 12px; }
.nuc .flow li { position: relative; display: grid; grid-template-columns: 1fr auto; gap: 1px 8px; padding: 7px 9px; border-radius: 9px; font-size: 0.84rem; background: var(--tint-1); border: 1px solid var(--panel-border); }
.nuc .flow li b { color: var(--ink); font-weight: 600; }
.nuc .flow li span { grid-column: 1; color: var(--ink-faint); font-size: 0.76rem; }
.nuc .flow li em { grid-column: 2; grid-row: 1 / span 2; align-self: center; text-align: right; font-style: normal; color: var(--accent-3); font-size: 0.78rem; }
.nuc .flow li + li::before { content: "↓"; position: absolute; top: -13px; left: 14px; color: var(--ink-faint); font-size: 0.7rem; }
.nuc .ko small { display: block; color: var(--ink-faint); font-size: 0.74rem; margin: -2px 0 6px 24px; }
.nuc .gene-bar { height: 4px; border-radius: 2px; background: var(--tint-3); margin-top: 3px; overflow: hidden; }
.nuc .gene-bar i { display: block; height: 100%; background: #60a5fa; transition: width 0.3s; }
`;

/** Small deterministic RNG. */
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Cylinder geometry between two points. */
function cyl(a, b, r, seg = 5) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1, true);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

/** One nuclear pore complex (local frame: +z points out to the cytoplasm). 8-fold symmetric. */
function poreGeometry() {
  const parts = [], v = (x, y, z) => new THREE.Vector3(x, y, z);
  const blob = (r, x, y, z, sz, col) => { const g = new THREE.IcosahedronGeometry(r, 1); g.scale(1, 1, sz); g.translate(x, y, z); parts.push(paint(g, col)); };
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU, c = Math.cos(a), s = Math.sin(a);
    blob(0.085, c * 0.31, s * 0.31, 0.16, 0.8, "#ede9fe");            // cytoplasmic ring
    blob(0.085, c * 0.31, s * 0.31, -0.16, 0.8, "#c4b5fd");           // nuclear ring
    blob(0.07, c * 0.25, s * 0.25, 0, 2.0, "#a78bfa");                // spokes spanning the membranes
    parts.push(paint(cyl(v(c * 0.31, s * 0.31, 0.2), v(c * 0.36, s * 0.36, 0.52), 0.016, 4), "#f5f3ff"));      // cytoplasmic filaments
    parts.push(paint(cyl(v(c * 0.31, s * 0.31, -0.2), v(c * 0.11, s * 0.11, -0.6), 0.016, 4), "#ddd6fe"));     // nuclear basket
  }
  const ring = new THREE.TorusGeometry(0.11, 0.022, 4, 16); ring.translate(0, 0, -0.6);
  parts.push(paint(ring, "#ddd6fe"));
  const fg = new THREE.SphereGeometry(0.15, 10, 6); fg.scale(1, 1, 0.9);
  parts.push(paint(fg, "#6d28d9"));                                    // FG-repeat meshwork in the channel
  return mergeGeometries(parts);
}

export function create(engine) {
  if (!document.getElementById("nuc-css")) {
    const st = document.createElement("style");
    st.id = "nuc-css"; st.textContent = CSS;
    document.head.appendChild(st);
  }
  const lens = engine.lens;
  const M = new NucleusModel();
  // the plant cell may expose its whole-cell model (ATP pool); otherwise the supply slider is local
  const parentModel = engine.stack.at(-1)?.inst?.model;
  if (parentModel && typeof parentModel.atp === "number") M.supply = Math.round(Math.max(0, Math.min(100, parentModel.atp)));
  const root = new THREE.Group();
  const pickables = [], fallbackPickables = [];
  const tmpM = new THREE.Matrix4(), tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpV3 = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpE = new THREE.Euler();
  const Z = new THREE.Vector3(0, 0, 1);
  const tag = (o, kind, i = 0) => { o.traverse?.((m) => { if (m.isMesh || m.isInstancedMesh || m.isLineSegments) { m.userData.kind = kind; m.userData.i = i; } }); o.userData.kind = kind; o.userData.i = i; return o; };
  const state = { dived: false, cut: true, labels: true };

  // ---------- cut-away plane (faces the camera, opening the near side) ----------
  const cut = new THREE.Plane(new THREE.Vector3(0, 0, -1), CUT_C);
  const clip = [cut];
  const camDir = new THREE.Vector3(0, 0, 1);

  // ---------- double nuclear envelope ----------
  const outerMat = glass("#8b5cf6", { rim: "#ddd6fe", minAlpha: 0.08, maxAlpha: 0.8, rimStrength: 0.75, side: THREE.DoubleSide, clippingPlanes: clip });
  const outer = tag(new THREE.Mesh(new THREE.SphereGeometry(RO, 72, 48), outerMat), "envelope");
  outer.renderOrder = 3;
  const innerMat = glass("#a78bfa", { rim: "#c4b5fd", minAlpha: 0.06, maxAlpha: 0.6, rimStrength: 0.5, side: THREE.DoubleSide, clippingPlanes: clip });
  const inner = tag(new THREE.Mesh(new THREE.SphereGeometry(RI, 64, 40), innerMat), "envelope");
  inner.renderOrder = 2;
  root.add(outer, inner);
  fallbackPickables.push(outer, inner);
  // the cut edge: two bright rims (outer + inner membrane) and the perinuclear space between them
  const cutEdge = new THREE.Group();
  const rimR = (r) => Math.sqrt(r * r - CUT_C * CUT_C);
  const rimMat = new THREE.MeshBasicMaterial({ color: "#e9d5ff", transparent: true, opacity: 0.85, toneMapped: false });
  cutEdge.add(new THREE.Mesh(new THREE.TorusGeometry(rimR(RO), 0.045, 6, 160), rimMat));
  cutEdge.add(new THREE.Mesh(new THREE.TorusGeometry(rimR(RI), 0.04, 6, 160), rimMat));
  cutEdge.add(new THREE.Mesh(new THREE.RingGeometry(rimR(RI), rimR(RO), 160), new THREE.MeshBasicMaterial({ color: "#7c3aed", transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })));
  root.add(cutEdge);

  // ---------- nuclear lamina (meshwork lining the inner membrane) ----------
  const lamGeo = new THREE.WireframeGeometry(wobble(new THREE.IcosahedronGeometry(LAM, 4), 0.06, 1.3, 2));
  const lamina = tag(new THREE.LineSegments(lamGeo, new THREE.LineBasicMaterial({ color: "#5eead4", transparent: true, opacity: 0.16, clippingPlanes: clip, depthWrite: false })), "lamina");
  root.add(lamina);

  // ---------- nuclear pore complexes (instanced, 8-fold) ----------
  const poreDirs = [], poreIn = [], poreOut = [];
  const poreMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.35, clearcoat: 0.7, emissive: new THREE.Color("#a78bfa"), emissiveIntensity: 0.35, clippingPlanes: clip });
  const pores = tag(new THREE.InstancedMesh(poreGeometry(), poreMat, NPORE), "pore");
  const plugs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 12, 8).scale(1, 1, 0.7), physical("#ef4444", { emissive: new THREE.Color("#dc2626"), emissiveIntensity: 0.9, clippingPlanes: clip }), NPORE);
  for (let i = 0; i < NPORE; i++) {
    const y = 1 - ((i + 0.5) / NPORE) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963 + 0.4;
    const d = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
    poreDirs.push(d);
    poreIn.push(d.clone().multiplyScalar(RI - 0.55));
    poreOut.push(d.clone().multiplyScalar(RO + 0.45));
    tmpQ.setFromUnitVectors(Z, d).multiply(new THREE.Quaternion().setFromAxisAngle(Z, hash(i) * TAU));
    tmpM.compose(tmpV.copy(d).multiplyScalar(RM), tmpQ, tmpS.set(1, 1, 1));
    pores.setMatrixAt(i, tmpM);
    plugs.setMatrixAt(i, tmpM);
  }
  plugs.visible = false;
  root.add(pores, plugs);
  pickables.push(pores);

  // ribosomes on the outer membrane (continuous with the rough ER)
  const riboGeo = mergeGeometries([paint(new THREE.SphereGeometry(0.09, 8, 6), "#93c5fd"), paint(new THREE.SphereGeometry(0.065, 8, 6).translate(0, 0.1, 0), "#bfdbfe")]);
  const riboMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.4, clearcoat: 0.5 });
  const omRibo = new THREE.InstancedMesh(riboGeo, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.4, clearcoat: 0.5, clippingPlanes: clip }), 140);
  for (let i = 0; i < 140; i++) {
    tmpV.set(hash(i * 3.1) * 2 - 1, hash(i * 5.3) * 2 - 1, hash(i * 7.7) * 2 - 1).normalize();
    omRibo.setMatrixAt(i, tmpM.compose(tmpV2.copy(tmpV).multiplyScalar(RO + 0.08), tmpQ.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tmpV), tmpS.set(1, 1, 1)));
  }
  root.add(omRibo);

  // ---------- nucleolus ----------
  const nucleolus = new THREE.Group();
  nucleolus.position.copy(NO);
  const noShellMat = glass("#9333ea", { rim: "#e9d5ff", minAlpha: 0.3, maxAlpha: 0.95, rimStrength: 0.6, clippingPlanes: clip, emissive: new THREE.Color("#7e22ce"), emissiveIntensity: 0.3 });
  const noShell = new THREE.Mesh(wobble(new THREE.IcosahedronGeometry(NO_R, 5), 0.14, 1.6, 4), noShellMat);
  nucleolus.add(noShell);
  // granular component: pre-ribosomal particles
  const gcN = 90;
  const gc = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.13, 1), physical("#c084fc", { roughness: 0.45, clippingPlanes: clip }), gcN);
  for (let i = 0; i < gcN; i++) {
    tmpV.set(hash(i * 1.7) * 2 - 1, hash(i * 2.9) * 2 - 1, hash(i * 4.3) * 2 - 1).normalize().multiplyScalar(NO_R * (0.45 + 0.45 * Math.cbrt(hash(i * 8.1))));
    gc.setMatrixAt(i, tmpM.compose(tmpV, tmpQ.identity(), tmpS.setScalar(0.7 + hash(i * 9.9) * 0.6)));
  }
  nucleolus.add(gc);
  // fibrillar centres (rDNA transcription by RNA pol I) with a dense fibrillar shell
  const fcMat = physical("#fdf4ff", { emissive: new THREE.Color("#f0abfc"), emissiveIntensity: 0.8, clippingPlanes: clip });
  const dfcMat = glass("#f0abfc", { rim: "#fdf4ff", minAlpha: 0.25, maxAlpha: 0.8, clippingPlanes: clip });
  const FC = [[0.6, 0.5, 0.4], [-0.7, 0.2, 0.6], [0.1, -0.7, 0.3], [-0.2, 0.6, -0.8], [0.8, -0.3, -0.6]];
  for (const [x, y, z] of FC) {
    const fc = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), fcMat); fc.position.set(x, y, z);
    const dfc = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), dfcMat); dfc.position.set(x, y, z);
    nucleolus.add(fc, dfc);
  }
  tag(nucleolus, "nucleolus");
  pickables.push(noShell);
  root.add(nucleolus);

  // ---------- chromosome territories (10 = 5 homologous pairs) ----------
  const terr = [];
  {
    const R = rng(11);
    const cands = [new THREE.Vector3(2.1, -1.9, 0.2)];   // territory 0 (model gene) sits in the middle
    for (let i = 0; i < 400 && cands.length < 10; i++) {
      const p = new THREE.Vector3(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1);
      if (p.lengthSq() > 1) continue;
      p.multiplyScalar(6.1);
      if (p.length() < 2.6 || p.distanceTo(NO) < NO_R + TR - 0.3) continue;
      if (cands.some((q) => q.distanceTo(p) < TR * 1.55)) continue;
      cands.push(p);
    }
    cands.forEach((c, ti) => {
      // confined random walk = a tangled chromatin fibre
      const pts = [], p = c.clone().add(new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5)), step = new THREE.Vector3();
      for (let k = 0; k < 170; k++) {
        step.set(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1).normalize().multiplyScalar(0.42);
        p.add(step);
        if (p.distanceTo(c) > TR) p.sub(c).multiplyScalar(0.86).add(c);
        if (p.length() > 8.7) p.multiplyScalar(0.96);
        if (p.distanceTo(NO) < NO_R + 0.3) p.sub(NO).setLength(NO_R + 0.35).add(NO);
        pts.push(p.clone());
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const SEG = 720, RAD = 5;
      const g = new THREE.TubeGeometry(curve, SEG, 0.075, RAD);
      // condensed copy: the fibre's centreline pulled toward the territory centre (tube thickness kept)
      const pos = g.attributes.position, base = pos.array.slice(), comp = new Float32Array(base.length);
      const cp = new THREE.Vector3();
      for (let i = 0; i <= SEG; i++) {
        curve.getPointAt(i / SEG, cp);
        const tx = c.x + (cp.x - c.x) * 0.42, ty = c.y + (cp.y - c.y) * 0.42, tz = c.z + (cp.z - c.z) * 0.42;
        for (let j = 0; j <= RAD; j++) {
          const o = (i * (RAD + 1) + j) * 3;
          comp[o] = base[o] - cp.x + tx; comp[o + 1] = base[o + 1] - cp.y + ty; comp[o + 2] = base[o + 2] - cp.z + tz;
        }
      }
      const col = TERR_COL[ti];
      const mat = physical(col, { roughness: 0.45, emissive: new THREE.Color(col), emissiveIntensity: 0.5, clippingPlanes: clip });
      const mesh = tag(new THREE.Mesh(g, mat), "chromatin", ti);
      root.add(mesh);
      pickables.push(mesh);
      // heterochromatin: a dense chromocentre pressed against the envelope / lamina
      const hd = c.clone().normalize();
      const hc = hd.clone().multiplyScalar(8.25);
      const hp = [], q = hc.clone();
      for (let k = 0; k < 70; k++) {
        q.add(step.set(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1).normalize().multiplyScalar(0.2));
        if (q.distanceTo(hc) > 0.75) q.sub(hc).multiplyScalar(0.8).add(hc);
        hp.push(q.clone());
      }
      const hcol = new THREE.Color(col).multiplyScalar(0.55);
      const hmesh = tag(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hp), 260, 0.085, 5), physical(hcol, { roughness: 0.5, emissive: hcol, emissiveIntensity: 0.18, clippingPlanes: clip })), "hetero", ti);
      root.add(hmesh);
      pickables.push(hmesh);
      terr.push({ c, curve, mesh, mat, base, comp, cur: 0, hc, hmesh });
    });
  }
  function applyCondense(k) {
    for (const t of terr) {
      if (Math.abs(t.cur - k) < 0.003) continue;
      t.cur = k;
      const a = t.mesh.geometry.attributes.position, arr = a.array;
      for (let i = 0; i < arr.length; i++) arr[i] = t.base[i] + (t.comp[i] - t.base[i]) * k;
      a.needsUpdate = true;
      t.mesh.geometry.computeBoundingSphere();
    }
  }

  // ---------- genes: loops out of their territories, with polymerases and growing transcripts ----------
  const genes = [];
  const geneHitMat = new THREE.MeshBasicMaterial({ visible: false });
  M.genes.forEach((gm, gi) => {
    let base, dir, side;
    if (gm.hetero) {
      const t = terr[3];
      base = t.hc.clone(); dir = t.hc.clone().normalize().negate(); side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    } else {
      const [ti, k] = GENE_PLACE[gm.id], t = terr[ti];
      // point the loop toward the nucleus interior (interchromatin space), with some variety
      dir = t.c.clone().negate().normalize().add(new THREE.Vector3(hash(k * 3) - 0.5, hash(k * 5) - 0.5, hash(k * 7) - 0.5).multiplyScalar(0.9));
      if (gm.id === "hbb") dir.set(-0.6, 0.75, 0.2);
      dir.normalize();
      base = t.c.clone().addScaledVector(dir, TR * 0.85);
      side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0.3, 1, 0.2).normalize()).normalize();
    }
    const L = gm.hetero ? 0.5 : 1.25;
    const curve = new THREE.CatmullRomCurve3([
      base.clone().addScaledVector(side, -0.7),
      base.clone().addScaledVector(side, -0.55).addScaledVector(dir, L * 0.75),
      base.clone().addScaledVector(dir, L * 1.15),
      base.clone().addScaledVector(side, 0.55).addScaledVector(dir, L * 0.75),
      base.clone().addScaledVector(side, 0.7),
    ]);
    const info = GENE_INFO[gm.id];
    const col = gm.hetero ? "#64748b" : info.color;
    const mat = physical(col, { roughness: 0.35, emissive: new THREE.Color(col), emissiveIntensity: 0.6, clippingPlanes: clip });
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, gm.model ? 0.095 : 0.08, 6), mat);
    const hit = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.4, 6), geneHitMat);
    tag(tube, "gene", gi); tag(hit, "gene", gi);
    root.add(tube, hit);
    pickables.push(hit);
    genes.push({ gm, gi, curve, dir, side, base, tube, mat, pols: [], acc: 0 });
  });
  const hbbGene = genes.find((g) => g.gm.id === "hbb");

  // RNA polymerase II (instanced) and nascent transcripts (instanced beads)
  const POLMAX = 40, BEADMAX = 300;
  const polMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.12, 2), physical("#f8fafc", { emissive: new THREE.Color("#bae6fd"), emissiveIntensity: 0.7, clippingPlanes: clip }), POLMAX);
  polMesh.count = 0; polMesh.frustumCulled = false;
  const beadMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 8, 6), physical("#ffffff", { emissive: new THREE.Color(MRNA_COL), emissiveIntensity: 0.6, clippingPlanes: clip }), BEADMAX);
  beadMesh.count = 0; beadMesh.frustumCulled = false;
  const cExon = new THREE.Color(MRNA_COL), cIntron = new THREE.Color("#f472b6");
  for (let i = 0; i < BEADMAX; i++) beadMesh.setColorAt(i, cExon);
  root.add(polMesh, beadMesh);

  // ---------- nuclear speckles (splicing factors) ----------
  const speckPos = [];
  {
    const R = rng(5);
    for (let i = 0; i < 400 && speckPos.length < 6; i++) {
      const p = new THREE.Vector3(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1).multiplyScalar(5.5);
      if (p.length() > 6.5 || p.distanceTo(NO) < NO_R + 0.8) continue;
      if (terr.some((t) => t.c.distanceTo(p) < TR + 0.4)) continue;
      if (speckPos.some((q) => q.distanceTo(p) < 2)) continue;
      speckPos.push(p);
    }
    // one next to the model gene, as active genes often are
    speckPos[0] = hbbGene.base.clone().addScaledVector(hbbGene.dir, 2.1).addScaledVector(hbbGene.side, 0.9);
  }
  const speckMat = glass("#bef264", { rim: "#ecfccb", minAlpha: 0.3, maxAlpha: 0.85, emissive: new THREE.Color("#a3e635"), emissiveIntensity: 0.35, clippingPlanes: clip });
  const speckles = new THREE.Group();
  speckPos.forEach((p, i) => {
    const m = new THREE.Mesh(wobble(new THREE.IcosahedronGeometry(0.42 + hash(i) * 0.15, 3), 0.06, 4, i), speckMat);
    m.position.copy(p); speckles.add(m); pickables.push(m);
  });
  tag(speckles, "speckle");
  root.add(speckles);

  // ---------- nucleoplasm + cytoplasm specks ----------
  const speck = (n, fn, size, colors, opacity, clipIt) => {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), pal = colors.map((c) => new THREE.Color(c));
    for (let i = 0; i < n; i++) { fn(i, tmpV); pos.set([tmpV.x, tmpV.y, tmpV.z], i * 3); const c = pal[i % pal.length]; col.set([c.r, c.g, c.b], i * 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ size, map: softDot(), vertexColors: true, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, clippingPlanes: clipIt ? clip : [] }));
  };
  const ntpPts = speck(240, (i, v) => v.set(hash(i * 1.3) * 2 - 1, hash(i * 2.7) * 2 - 1, hash(i * 3.9) * 2 - 1).normalize().multiplyScalar(9 * Math.cbrt(hash(i * 5.1))), 0.16, ["#fde68a", "#a5b4fc", "#fbcfe8", "#bbf7d0"], 0.5, true);
  root.add(ntpPts);
  const cyto = speck(420, (i, v) => { do v.set((Math.random() - 0.5) * 70, (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50); while (v.length() < RO + 1.5); }, 0.26, ["#99f6e4", "#c4b5fd", "#fef3c7"], 0.28, false);
  root.add(cyto);

  // ---------- rough ER sheets continuous with the outer membrane ----------
  const erMat = glass("#14b8a6", { rim: "#99f6e4", minAlpha: 0.18, maxAlpha: 0.8, rimStrength: 0.6, side: THREE.DoubleSide });
  const er = new THREE.Group(), erPts = [];
  const ER_DEF = [[-2.4, 0.6, 1.0], [-0.6, -2.2, 1.0], [2.6, 0.5, 0.9], [1.0, 2.4, 0.8], [-3.0, -0.9, 0.7]];
  ER_DEF.forEach(([a, b, arc], i) => {
    const dir = new THREE.Vector3(Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b)).normalize();
    const ax = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0.3)).normalize();
    const pts = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8, r = RO + 0.25 + t * 4.5;
      const d = dir.clone().applyAxisAngle(ax, (t - 0.2) * arc);
      pts.push(d.multiplyScalar(r).addScaledVector(ax, Math.sin(t * 5 + i) * 0.4));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const g = new THREE.TubeGeometry(curve, 60, 0.42, 10);
    const sheet = new THREE.Mesh(g, erMat);
    er.add(sheet); pickables.push(sheet);
    for (let k = 0; k < 6; k++) erPts.push(curve.getPointAt(0.35 + k * 0.11));
  });
  const erRibo = new THREE.InstancedMesh(riboGeo, riboMat, 160);
  {
    let n = 0;
    er.children.forEach((sheet, si) => {
      const pos = sheet.geometry.attributes.position, nor = sheet.geometry.attributes.normal;
      for (let k = 0; k < 32; k++) {
        const idx = Math.floor(hash(si * 50 + k) * pos.count * 0.8 + pos.count * 0.1);
        tmpV.fromBufferAttribute(pos, idx); tmpV2.fromBufferAttribute(nor, idx);
        erRibo.setMatrixAt(n++, tmpM.compose(tmpV.addScaledVector(tmpV2, 0.05), tmpQ.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tmpV2), tmpS.set(1, 1, 1)));
      }
    });
  }
  er.add(erRibo);
  tag(er, "er");
  root.add(er);

  // ---------- portal: a glowing ring around the model gene's chromatin ----------
  const PORTAL = hbbGene.base.clone().addScaledVector(hbbGene.dir, -0.9);
  const portalRing = tag(new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.06, 12, 64), physical("#5eead4", { emissive: new THREE.Color("#2dd4bf"), emissiveIntensity: 1.2 })), "portal");
  portalRing.position.copy(PORTAL);
  portalRing.quaternion.setFromUnitVectors(Z, hbbGene.dir);
  const portalDisc = tag(new THREE.Mesh(new THREE.CircleGeometry(1.2, 40), new THREE.MeshBasicMaterial({ color: "#5eead4", transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide })), "portal");
  portalDisc.position.copy(PORTAL); portalDisc.quaternion.copy(portalRing.quaternion);
  root.add(portalRing, portalDisc);
  pickables.push(portalRing, portalDisc);
  const portals = [{ to: "chromatin", label: "Chromosome & chromatin", object: portalRing, objects: [portalRing, portalDisc, terr[0].mesh], radius: 1.3, center: () => PORTAL.clone() }];

  // ---------- flows: mRNA out, ribosomal subunits out, proteins in ----------
  const geo = {
    mrna: (() => {
      const parts = [paint(new THREE.CapsuleGeometry(0.06, 0.55, 3, 6).rotateZ(Math.PI / 2), MRNA_COL), paint(new THREE.SphereGeometry(0.085, 8, 6).translate(-0.36, 0, 0), "#fbbf24")];
      for (let k = 0; k < 4; k++) parts.push(paint(new THREE.SphereGeometry(0.04, 6, 4).translate(0.38 + k * 0.07, Math.sin(k * 1.7) * 0.03, 0), "#e2e8f0"));
      return mergeGeometries(parts);
    })(),
    pre: (() => {
      const parts = [paint(new THREE.CapsuleGeometry(0.055, 0.7, 3, 6).rotateZ(Math.PI / 2), MRNA_COL), paint(new THREE.TorusGeometry(0.11, 0.035, 5, 12).translate(-0.1, 0.13, 0), "#f472b6"), paint(new THREE.TorusGeometry(0.09, 0.035, 5, 12).translate(0.22, 0.11, 0), "#f472b6")];
      return mergeGeometries(parts);
    })(),
    lariat: paint(new THREE.TorusGeometry(0.1, 0.03, 5, 12), "#f472b6"),
    lsu: paint(wobble(new THREE.IcosahedronGeometry(0.19, 2), 0.03, 6), "#a5b4fc"),
    ssu: paint(wobble(new THREE.IcosahedronGeometry(0.13, 2), 0.025, 7, 1).scale(1.3, 0.8, 1), "#c7d2fe"),
    prot: new THREE.IcosahedronGeometry(0.12, 1),
  };
  const FLOW = {
    pre: { max: 24, band: "y11", label: "pre-mRNA (introns in pink)", color: "#f472b6" },
    mrna: { max: 60, label: { "y7-8": "mRNA (messages)", "y9-10": "mRNA", y11: "mature mRNA (cap + poly-A tail)" }, color: MRNA_COL },
    lariat: { max: 20, band: "y11", label: "Excised introns", color: "#f9a8d4", hide: true },
    lsu: { max: 30, label: { "y7-8": "Ribosome parts", "y9-10": "Ribosome subunits", y11: "60S / 40S subunits" }, color: "#a5b4fc" },
    ssu: { max: 30, color: "#c7d2fe", hide: true },
    prot: { max: 60, label: { "y7-8": "Proteins coming in", "y9-10": "Imported proteins", y11: "Imported proteins (pol, histones, r-proteins)" }, color: "#fbbf24" },
  };
  const PROT_COL = { pol: new THREE.Color("#f8fafc"), hist: new THREE.Color("#fb923c"), rp: new THREE.Color("#a3e635") };
  const flows = {};
  for (const k of Object.keys(FLOW)) {
    const mat = k === "prot"
      ? physical("#ffffff", { emissive: new THREE.Color("#fde68a"), emissiveIntensity: 0.35, clippingPlanes: clip })
      : new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, clearcoat: 0.9, emissive: new THREE.Color(FLOW[k].color), emissiveIntensity: k === "mrna" ? 0.55 : 0.3, clippingPlanes: clip });
    const im = new THREE.InstancedMesh(geo[k], mat, FLOW[k].max + 50);
    im.count = 0; im.frustumCulled = false;
    if (k === "prot") for (let i = 0; i < FLOW[k].max + 50; i++) im.setColorAt(i, PROT_COL.pol);
    root.add(im);
    flows[k] = { im, parts: [], acc: 0 };
  }
  const shown = (k) => lens.atLeast(FLOW[k].band || "y7-8");
  const rnd = (a, b) => a + Math.random() * (b - a);
  const randDir = (v) => v.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize();
  /** a pore on the far (visible) side of the cut-away, preferably near `near` */
  function pickPore(near) {
    let best = 0, bs = -1e9;
    for (let k = 0; k < 10; k++) {
      const i = Math.floor(Math.random() * NPORE), d = poreDirs[i];
      let s = -d.dot(camDir) * 2 + Math.random();
      if (near) s += d.dot(tmpV3.copy(near).normalize()) * 1.5;
      if (s > bs) { bs = s; best = i; }
    }
    return best;
  }
  const nucleoplasmPoint = (v) => {
    for (let k = 0; k < 8; k++) {
      v.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(6.5);
      if (v.length() < 7.5 && v.dot(camDir) < CUT_C - 0.5) return v;
    }
    return v.copy(camDir).multiplyScalar(-3);
  };
  /**
   * Particle on up to three segments: a →(curve) pIn, pIn →(straight, slow: through the pore) pOut, pOut →(curve) b.
   * Without a pore it is a single curved hop a → b.
   */
  function spawn(k, a, b, dur, pore = -1, outward = true, extra = {}) {
    const f = flows[k];
    if (f.parts.length >= FLOW[k].max) return null;
    const p = { a: a.clone(), b: b.clone(), t: 0, dur, spin: Math.random() * 6, pore, ...extra };
    if (pore >= 0) {
      p.p1 = (outward ? poreIn : poreOut)[pore].clone();
      p.p2 = (outward ? poreOut : poreIn)[pore].clone();
      p.c1 = p.a.clone().lerp(p.p1, 0.5).add(randDir(tmpV).multiplyScalar(p.a.distanceTo(p.p1) * 0.25));
      p.c2 = p.p2.clone().lerp(p.b, 0.5).add(randDir(tmpV).multiplyScalar(p.p2.distanceTo(p.b) * 0.25));
      const l1 = p.a.distanceTo(p.p1), l3 = p.p2.distanceTo(p.b);
      const tot = l1 + l3 + 2.5;                           // the pore crossing takes as long as 2.5 units of travel
      p.s1 = l1 / tot; p.s2 = (l1 + 2.5) / tot;
    } else p.c1 = p.a.clone().lerp(p.b, 0.5).add(randDir(tmpV).multiplyScalar(p.a.distanceTo(p.b) * 0.3));
    f.parts.push(p);
    return p;
  }
  const bez = (out, a, c, b, t) => { const u = 1 - t; return out.set(0, 0, 0).addScaledVector(a, u * u).addScaledVector(c, 2 * u * t).addScaledVector(b, t * t); };
  function partPos(p, out) {
    const t = p.t;
    if (p.pore < 0) return bez(out, p.a, p.c1, p.b, t);
    if (t < p.s1) return bez(out, p.a, p.c1, p.p1, t / p.s1);
    if (t < p.s2) return out.lerpVectors(p.p1, p.p2, (t - p.s1) / (p.s2 - p.s1));
    return bez(out, p.p2, p.c2, p.b, (t - p.s2) / (1 - p.s2));
  }
  const outsidePoint = (pore, v) => v.copy(poreDirs[pore]).multiplyScalar(RO + rnd(2.5, 5)).add(randDir(tmpV).multiplyScalar(1.2));
  const erPoint = (pore, v) => { // ER ribosome site nearest-ish to the pore
    let best = erPts[0], bd = 1e9;
    for (let k = 0; k < 6; k++) { const q = erPts[Math.floor(Math.random() * erPts.length)], d = q.distanceToSquared(poreOut[pore]); if (d < bd) { bd = d; best = q; } }
    return bd < 60 ? v.copy(best) : outsidePoint(pore, v);
  };
  const pa = new THREE.Vector3(), pb = new THREE.Vector3();

  function emitFlows(dt) {
    const F = M.F;
    const want = (k, rate, fn) => {
      const f = flows[k];
      if (!shown(k)) return;
      f.acc += Math.max(0, rate) * dt;
      let n = 0;
      while (f.acc >= 1 && n++ < 3) { f.acc -= 1; fn(); }
      if (f.acc > 3) f.acc = 3;
    };
    const senior = lens.atLeast("y11");
    // export of mature mRNA (from speckles / nucleoplasm, through a far-side pore, to the rough ER)
    want("mrna", F.exp * 0.9, () => {
      const from = senior && Math.random() < 0.6 ? speckPos[Math.floor(Math.random() * speckPos.length)] : nucleoplasmPoint(pa);
      const pore = pickPore(from);
      spawn("mrna", from, erPoint(pore, pb), rnd(4.5, 6), pore, true);
    });
    // ribosomal subunits: nucleolus → pore → cytoplasm (large and small made separately)
    want("lsu", F.subExp * 0.45, () => { const pore = pickPore(NO); spawn("lsu", tmpV2.copy(NO).add(randDir(pa).multiplyScalar(NO_R * 0.9)), outsidePoint(pore, pb), rnd(5, 6.5), pore, true); });
    want("ssu", F.subExp * 0.45, () => { const pore = pickPore(NO); spawn("ssu", tmpV2.copy(NO).add(randDir(pa).multiplyScalar(NO_R * 0.9)), outsidePoint(pore, pb), rnd(4.5, 6), pore, true); });
    // imports: RNA polymerase → genes, histones → chromatin, ribosomal proteins → nucleolus
    const imp = (kind, rate, dest) => want("prot", rate, () => {
      const d = dest(), pore = pickPore(d), p = spawn("prot", outsidePoint(pore, pa), d, rnd(4, 5.5), pore, false, { kind });
      if (p) p.col = PROT_COL[kind];
    });
    imp("pol", F.impPol * 0.9, () => { const g = genes[Math.floor(Math.random() * 5)]; return g.base.clone().addScaledVector(g.dir, 0.6); });
    imp("hist", F.impHist * 0.9, () => terr[Math.floor(Math.random() * terr.length)].c.clone().add(randDir(tmpV).multiplyScalar(TR * 0.7)));
    imp("rp", F.impRp * 0.7, () => tmpV.copy(NO).add(randDir(pa).multiplyScalar(NO_R * 0.8)).clone());
  }

  /** a gene finished a transcript: release it (Y11+: as pre-mRNA to a speckle, shedding its introns) */
  function release(g) {
    const end = g.curve.getPointAt(1, pa).addScaledVector(g.dir, 0.3);
    if (lens.atLeast("y11")) {
      let sp = speckPos[0], bd = 1e9;
      for (const q of speckPos) { const d = q.distanceToSquared(end); if (d < bd) { bd = d; sp = q; } }
      spawn("pre", end, tmpV2.copy(sp).add(randDir(pb).multiplyScalar(0.35)), rnd(2.2, 3), -1, true, { introns: g.gm.introns });
    }
  }

  const waitPts = [];   // fixed spots just inside / outside each pore for backed-up cargo
  for (let i = 0; i < 90; i++) {
    const pi = (i * 37) % NPORE, d = poreDirs[pi], lay = Math.floor(i / NPORE * 3);
    waitPts.push({ pin: d.clone().multiplyScalar(RI - 0.55 - lay * 0.3 - hash(i) * 0.2).add(new THREE.Vector3(hash(i * 3) - 0.5, hash(i * 5) - 0.5, hash(i * 7) - 0.5).multiplyScalar(0.35)), pout: d.clone().multiplyScalar(RO + 0.6 + hash(i * 9) * 0.5) });
  }
  let simTime = 0;
  function drawFlows(dt) {
    const still = engine.reducedMotion;
    for (const [k, f] of Object.entries(flows)) {
      let n = 0;
      if (dt > 0) {
        for (let i = f.parts.length - 1; i >= 0; i--) {
          const p = f.parts[i];
          p.t += dt / p.dur;
          if (p.t >= 1) {
            f.parts.splice(i, 1);
            if (k === "pre") { // processing done at the speckle: introns go, mature mRNA joins the pool
              for (let j = 0; j < p.introns; j++) spawn("lariat", p.b, tmpV.copy(p.b).add(randDir(pa).multiplyScalar(rnd(0.8, 1.4))), rnd(1.8, 2.6));
            }
          }
        }
      }
      for (const p of f.parts) {
        partPos(p, tmpV);
        tmpQ.setFromEuler(tmpE.set(p.spin + p.t * 3, p.spin * 0.7 + p.t * 2, 0));
        let sc = Math.min(1, p.t * 8, (1 - p.t) * 8);
        if (k === "lariat") sc = Math.min(1, (1 - p.t) * 2);
        f.im.setMatrixAt(n, tmpM.compose(tmpV, tmpQ, tmpS.set(sc, sc, sc)));
        if (k === "prot") f.im.setColorAt(n, p.col);
        n++;
      }
      // backed-up cargo: mRNA and subunits held inside blocked pores, proteins waiting outside
      if (k === "mrna" && M.mrna > 12) n = drawWaiting(f.im, n, Math.round((M.mrna - 12) * 1.4), true, 0);
      if (k === "lsu" && M.poresBlocked) n = drawWaiting(f.im, n, Math.round(M.sub * 0.8), true, 30);
      if (k === "prot" && M.poresBlocked) n = drawWaiting(f.im, n, 30, false, 50, still);
      f.im.count = n;
      f.im.instanceMatrix.needsUpdate = true;
      if (k === "prot" && f.im.instanceColor) f.im.instanceColor.needsUpdate = true;
    }
  }
  function drawWaiting(im, n, count, inside, seed) {
    const t = simTime, max = im.instanceMatrix.count;
    for (let i = 0; i < count && n < max; i++) {
      const w = waitPts[(i + seed) % waitPts.length], j = engine.reducedMotion ? 0 : Math.sin(t * 2 + i) * 0.05;
      tmpV.copy(inside ? w.pin : w.pout).addScalar(j);
      tmpQ.setFromEuler(tmpE.set(i, i * 1.3 + t * 0.2, 0));
      im.setMatrixAt(n, tmpM.compose(tmpV, tmpQ, tmpS.set(0.85, 0.85, 0.85)));
      if (im === flows.prot.im) im.setColorAt(n, PROT_COL[["pol", "hist", "rp"][i % 3]]);
      n++;
    }
    return n;
  }

  // ---------- transcription on each gene: polymerases initiate, elongate and release ----------
  function updateGenes(dt) {
    const stalled = M.stopped, v = 0.22 * (0.15 + 0.85 * Math.min(1, M.F.ntp));
    for (const g of genes) {
      if (g.gm.hetero) continue;
      if (!stalled) {
        g.acc += g.gm.rate * dt;
        // a polymerase can only bind the promoter if the previous one has moved on
        while (g.acc >= 1) {
          g.acc -= 1;
          if (g.pols.length < 7 && (!g.pols.length || g.pols[g.pols.length - 1].s > 0.12)) g.pols.push({ s: 0, ph: Math.random() * 6 });
        }
        if (g.acc > 2) g.acc = 2;
        for (let i = g.pols.length - 1; i >= 0; i--) {
          const p = g.pols[i];
          p.s += v * dt;
          if (p.s >= 1) { g.pols.splice(i, 1); release(g); }
        }
      }
      g.mat.emissiveIntensity = 0.25 + Math.min(1.1, g.gm.rate * 0.9);
    }
  }
  function drawGenes(t) {
    let np = 0, nb = 0;
    const stalled = M.stopped, senior = lens.atLeast("y11");
    polMesh.material.color.set(stalled ? "#64748b" : "#f8fafc");
    polMesh.material.emissiveIntensity = stalled ? 0.05 : 0.7;
    for (const g of genes) {
      for (const p of g.pols) {
        if (np >= POLMAX) break;
        g.curve.getPointAt(Math.min(1, p.s), tmpV);
        polMesh.setMatrixAt(np++, tmpM.compose(tmpV, tmpQ.identity(), tmpS.set(1, 1, 1)));
        // the growing transcript: longer the further the polymerase has gone (a "Christmas tree")
        const beads = Math.max(1, Math.round(p.s * 9));
        g.curve.getTangentAt(Math.min(1, p.s), tmpV2);
        for (let k = 1; k <= beads && nb < BEADMAX; k++) {
          const w = engine.reducedMotion ? 0 : Math.sin(t * 2.2 + p.ph + k * 0.9) * 0.035;
          tmpV3.copy(tmpV).addScaledVector(g.dir, 0.06 + k * 0.075).addScaledVector(tmpV2, w + Math.sin(k * 1.3 + p.ph) * 0.04);
          beadMesh.setMatrixAt(nb, tmpM.compose(tmpV3, tmpQ, tmpS.set(1, 1, 1)));
          // β-globin at Y11+: beads made from intron sequence are pink (splicing can begin co-transcriptionally)
          let col = cExon;
          if (senior && g.gm.model) { const f = p.s * (1 - (k - 1) / beads); if (HBB_INTRONS.some(([a, b]) => f >= a && f < b)) col = cIntron; }
          beadMesh.setColorAt(nb, col);
          nb++;
        }
      }
    }
    polMesh.count = np; beadMesh.count = nb;
    polMesh.instanceMatrix.needsUpdate = true; beadMesh.instanceMatrix.needsUpdate = true;
    if (beadMesh.instanceColor) beadMesh.instanceColor.needsUpdate = true;
  }

  // ---------- labels ----------
  const labels = {};
  const LBL = {
    envelope: () => tmpV.set(-1.2, RO + 0.9, 0),
    pore: () => tmpV.copy(poreDirs[pickLabelPore()]).multiplyScalar(RO + 0.9),
    nucleolus: () => tmpV.copy(NO).add(tmpV2.set(0, NO_R + 0.7, 0)),
    chromatin: () => tmpV.copy(terr[4].c).add(tmpV2.set(0, -TR * 0.8, 0)),
    hetero: () => tmpV.copy(terr[5].hc).multiplyScalar(0.92),
    gene: () => tmpV.copy(hbbGene.base).addScaledVector(hbbGene.dir, 2.0),
    lamina: () => tmpV.set(0, -LAM + 0.6, -2),
    speckle: () => tmpV.copy(speckPos[speckPos.length - 1]).add(tmpV2.set(0, 0.8, 0)),
    er: () => tmpV.copy(erPts[9]).add(tmpV2.set(0, 1, 0)),
  };
  const LBL_BAND = { hetero: "y9-10", lamina: "y11", speckle: "y11", er: "y9-10" };
  const NARROW_HIDE = { lamina: 1, speckle: 1, er: 1, hetero: 1, envelope: 1 };
  let labelPore = 0, labelPoreT = 0;
  function pickLabelPore() { // a pore on the upper far rim, so its label isn't in the cut-away
    if (simTime - labelPoreT > 2 || labelPoreT === 0) {
      labelPoreT = simTime + 0.001;
      let best = 0, bs = -1e9;
      for (let i = 0; i < NPORE; i++) { const d = poreDirs[i], s = -Math.abs(d.dot(camDir) + 0.1) * 3 + d.y + d.x * 0.3; if (s > bs) { bs = s; best = i; } }
      labelPore = best;
    }
    return labelPore;
  }
  const diveLbl = engine.label("", "dive");
  function makeLabels() {
    for (const el of Object.values(labels)) el.remove();
    for (const k of Object.keys(LBL)) labels[k] = engine.label("", "org");
  }
  function status(k) {
    const F = M.F, y7 = lens.band === "y7-8", g = M.gene("hbb");
    if (k === "pore") return M.poresBlocked ? "blocked" : y7 ? "messages out, proteins in" : `${M.smooth.exp.toFixed(1)} mRNA/s out`;
    if (k === "nucleolus") return M.actD ? "stopped (actinomycin D)" : F.rtx < 0.1 ? "no NTPs" : M.poresBlocked ? (y7 ? "parts piling up" : "subunits piling up") : y7 ? "making ribosome parts" : `${M.smooth.subExp.toFixed(1)} subunits/s out`;
    if (k === "gene") return M.stopped ? (y7 ? "copying stopped" : "polymerases stalled") : g.rate < 0.05 ? (y7 ? "switched off" : "chromatin closed — silent") : y7 ? "being copied" : `${g.rate.toFixed(1)} transcripts/s`;
    if (k === "chromatin") return M.condense > 60 ? (y7 ? "wound up tightly" : "condensed") : "";
    if (k === "hetero") return y7 ? "packed away" : "silent";
    return "";
  }
  function updateLabels() {
    const narrow = engine.camera.aspect < 0.8;
    for (const [k, el] of Object.entries(labels)) {
      if (!state.labels || (LBL_BAND[k] && !lens.atLeast(LBL_BAND[k])) || (narrow && NARROW_HIDE[k])) { el.style.display = "none"; continue; }
      const s = status(k);
      const name = k === "gene" ? GENE_INFO.hbb.name : PARTS[k].name;
      const html = `${lens.pick(name)}${s ? `<small>${s}</small>` : ""}`;
      if (el._h !== html) { el.innerHTML = html; el._h = html; }
      el.classList.toggle("off", /stopped|stalled|blocked|no |silent|off|piling/.test(s));
      engine.place(el, LBL[k]());
    }
    const dh = lens.pick({ "y7-8": "🔍 Zoom into the DNA", "y9-10": "🔍 Zoom into a chromosome", y11: "🔍 Zoom into the chromatin" });
    if (diveLbl._h !== dh) { diveLbl.innerHTML = dh; diveLbl._h = dh; }
    engine.place(diveLbl, tmpV.copy(PORTAL).addScaledVector(hbbGene.side, -1.9).add(tmpV2.set(0, -1.2, 0)));
  }

  // ---------- info / selection ----------
  const selGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: "#5eead4", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 }));
  selGlow.visible = false; root.add(selGlow);
  function infoFor(kind, obj) {
    if (kind === "portal") kind = "chromatin";
    if (kind === "gene") {
      const g = M.genes[obj?.userData.i ?? 0];
      return { kind, gene: g.id, title: lens.pick(GENE_INFO[g.id].name), portal: g.model ? portals[0] : null, object: obj };
    }
    const p = PARTS[kind];
    if (!p) return null;
    if ((kind === "lamina" || kind === "speckle") && !lens.atLeast("y11")) return null;
    const portal = kind === "chromatin" ? portals[0] : null;
    return { kind, title: lens.pick(p.name), portal, object: obj };
  }

  // ---------- panel ----------
  let progress = null, panelEl, explainBody, selCard, chart, chartCtx, mission, ctl = {}, chipFns = null, geneRows = {};
  function buildPanel(el) {
    panelEl = el;
    const host = document.createElement("div");
    host.style.display = "contents";
    host.className = "nuc";
    el.appendChild(host);
    progress = { band: lens.band, node: host };
    el = host;
    const y7 = lens.band === "y7-8", senior = lens.atLeast("y11");

    const ex = K.card(el, "What's happening", "explain");
    explainBody = document.createElement("div");
    ex.appendChild(explainBody);
    ex.insertAdjacentHTML("beforeend", `<p class="hint">${lens.pick({ "y7-8": "Not to scale: the pores and molecules are drawn much bigger, and everything is slowed down. Click any part to learn what it does.", "y9-10": "Not to scale (pores and molecules drawn huge; a real nucleus has thousands of pores). The near side is cut away so you can see inside. Click a part or a gene.", y11: "Not to scale: pores ≈ 3× and molecules ≈ 50× too big, far fewer pores and genes than a real nucleus, rates slowed. The envelope is cut away on the side facing you. Click any gene to see its transcription rate." })}</p>`);

    selCard = K.card(el, "Selected", "sel-card");
    selCard.style.display = "none";

    const note = K.card(el, "Model gene");
    note.insertAdjacentHTML("beforeend", `<p>${lens.pick({ "y7-8": "The gold gene is a <strong>human</strong> gene (for part of haemoglobin), added to this plant cell for teaching. We follow it all the way down to its DNA letters.", "y9-10": "The gold gene is a <strong>human</strong> gene, β-globin (part of haemoglobin), shown in a plant cell for teaching. It's the same model gene on every level, down to the DNA bases and the sickle-cell mutation. The other genes are real plant genes.", y11: "Gold = a simplified fragment of human <strong>β-globin (HBB)</strong>, shown in a plant nucleus for teaching (plants don't have it). It's the model gene on every level, down to codon 6 (GAG → GTG, sickle cell). The other genes are real leaf-cell genes: RBCS, LHCB, actin, histone H4 and a silenced transposon." })}</p>`);

    const cond = K.card(el, "Conditions");
    ctl.supply = K.slider(cond, { label: lens.pick({ "y7-8": "Energy supply (ATP) from the cell", "y9-10": "ATP / NTP supply from the cytoplasm", y11: "NTP supply (ATP, GTP, CTP, UTP)" }), min: 0, max: 100, step: 5, value: M.supply, unit: " %", onInput: (v) => (M.supply = v) });
    ctl.condense = K.slider(cond, { label: lens.pick({ "y7-8": "Wind up the DNA (condense it)", "y9-10": "Condense the chromatin", y11: "Chromatin condensation (all genes)" }), min: 0, max: 100, step: 5, value: M.condense, unit: " %", onInput: (v) => (M.condense = v) });
    if (parentModel && typeof parentModel.atp === "number") cond.insertAdjacentHTML("beforeend", `<p class="hint">Started from the cell's ATP level.</p>`);
    const r = K.buttonRow(cond);
    K.button(r, "Reset", () => {
      M.reset(); syncControls(); renderGenes();
      for (const f of Object.values(flows)) { f.parts.length = 0; f.acc = 0; }
      for (const g of genes) g.pols.length = 0;
      engine.toast("Reset");
    });

    const ko = K.card(el, lens.pick({ "y7-8": "Break something", "y9-10": "Knockouts and blockers" }), "ko");
    const KO = senior ? [
      ["poresBlocked", "Block the nuclear pores", "e.g. a lectin (WGA) plugging the channel: no export or import."],
      ["amanitin", "α-amanitin (blocks RNA polymerase II)", "Death-cap mushroom toxin: stops mRNA genes only."],
      ["actD", "Actinomycin D (blocks all transcription)", "Wedges into DNA: Pol I, II and III all stop."],
    ] : [
      ["poresBlocked", { "y7-8": "Block the pores", "y9-10": "Block the nuclear pores" }, { "y7-8": "Nothing can get in or out.", "y9-10": "No mRNA out, no proteins in." }],
      ["actD", { "y7-8": "Stop the copying (a poison)", "y9-10": "Stop transcription (actinomycin D)" }, { "y7-8": "Genes can't be copied into messages.", "y9-10": "RNA polymerases can't copy DNA." }],
    ];
    for (const [key, label, hint] of KO) {
      ctl[key] = K.checkbox(ko, lens.pick(label), M[key], (v) => { M[key] = v; engine.toast(`${lens.pick(label)}: ${v ? "on" : "off"}`); });
      ko.insertAdjacentHTML("beforeend", `<small>${lens.pick(hint)}</small>`);
    }

    const gc = K.card(el, lens.pick({ "y7-8": "Genes being copied", "y9-10": "Genes", y11: "Genes and chromatin state" }));
    gc.insertAdjacentHTML("beforeend", `<p class="hint" style="margin:0 0 8px">${lens.pick({ "y7-8": "Switch a gene off by packing its DNA away. The gene is still there — it just can't be read.", "y9-10": "Switch = open (readable) or packed (closed) chromatin at that gene. The DNA sequence doesn't change.", y11: "Switch = open euchromatin vs closed chromatin at that gene's promoter. The bar shows its transcription rate; the sequence is unchanged — this is epigenetic control." })}</p>`);
    const list = document.createElement("div");
    list.className = "org-list";
    gc.appendChild(list);
    geneRows = {};
    M.genes.forEach((g, gi) => {
      const info = GENE_INFO[g.id], row = document.createElement("div");
      row.className = "org-row";
      row.innerHTML = `<i style="background:${g.hetero ? "#64748b" : info.color}"></i><button type="button" class="org-name" title="Show me">${lens.pick(info.name)}<small></small><div class="gene-bar"><i style="width:0"></i></div></button>${g.hetero ? "" : `<label class="switch"><input type="checkbox" ${g.closed ? "" : "checked"} aria-label="${lens.pick(info.name)} chromatin open"><span></span></label>`}`;
      const cb = row.querySelector("input");
      cb?.addEventListener("change", () => { g.closed = !cb.checked; engine.toast(`${lens.pick(info.name)}: chromatin ${g.closed ? "closed" : "open"}`); if (engine.selected?.gene === g.id) showSelection(engine.selected); });
      row.querySelector(".org-name").addEventListener("click", () => focusGene(gi));
      list.appendChild(row);
      geneRows[g.id] = { row, cb, small: row.querySelector("small"), bar: row.querySelector(".gene-bar i") };
    });

    const view = K.card(el, "View");
    K.checkbox(view, "Cut-away (slice open the side facing you)", state.cut, (v) => (state.cut = v));
    K.checkbox(view, "Show labels", state.labels, (v) => (state.labels = v));
    const key = document.createElement("div");
    key.className = "flow-key"; key.style.marginTop = "8px";
    for (const [k, f] of Object.entries(FLOW)) if (shown(k) && !f.hide) key.insertAdjacentHTML("beforeend", `<span><i style="background:${f.color};box-shadow:0 0 8px ${f.color}"></i>${lens.pick(f.label)}</span>`);
    key.insertAdjacentHTML("beforeend", `<span><i style="background:#f8fafc;box-shadow:0 0 8px #bae6fd"></i>${y7 ? "Copying machine (RNA polymerase)" : "RNA polymerase"}</span>`);
    if (!y7) key.insertAdjacentHTML("beforeend", `<span><i style="background:#fb923c"></i>Histones in</span><span><i style="background:#a3e635"></i>${senior ? "Ribosomal proteins in" : "Ribosome proteins in"}</span>`);
    view.appendChild(key);

    const ch = K.card(el, lens.pick({ "y7-8": "Traffic over time", "y9-10": "Transcription and pore traffic" }));
    chart = document.createElement("canvas");
    chart.className = "mini-chart";
    chart.setAttribute("role", "img");
    ch.appendChild(chart);
    chartCtx = chart.getContext("2d");
    ch.insertAdjacentHTML("beforeend", `<div class="legend" style="margin-top:6px"><span><i style="background:var(--ink)"></i>${y7 ? "Messages made/s" : "Transcription/s"}</span><span><i style="background:${MRNA_COL}"></i>${y7 ? "Messages out/s" : "mRNA export/s"}</span><span><i style="background:#a5b4fc"></i>${y7 ? "Ribosome parts out/s" : "Subunits out/s"}</span><span><i style="background:#fbbf24"></i>${y7 ? "Proteins in/s" : "Import/s"}</span></div>`);

    const bp = K.card(el, lens.pick({ "y7-8": "The big picture", "y9-10": "The big picture: from gene to protein" }));
    bp.insertAdjacentHTML("beforeend", lens.pick(BIG_PICTURE));
    const r2 = K.buttonRow(bp);
    K.button(r2, lens.pick({ "y7-8": "Zoom into the DNA ▸", "y9-10": "Zoom into a chromosome ▸", y11: "Zoom into the chromatin ▸" }), () => engine.dive(portals[0]), { kind: "primary" });
    const hg = K.card(el, lens.pick({ "y7-8": "Your genes", "y9-10": "Human genes and inheritance" }));
    hg.insertAdjacentHTML("beforeend", `<p class="hint" style="margin:0 0 8px">${lens.pick({ "y7-8": "See all 46 human chromosomes, find genes on them, and work out how traits are passed from parents to children.", "y9-10": "Sort a human karyotype, find where genes sit on chromosomes, then predict inheritance with Punnett squares and pedigrees.", y11: "Karyotype (23 pairs, sex chromosomes, aneuploidy), gene loci, then monohybrid, dihybrid, sex-linked, codominant and polygenic inheritance." })}</p>`);
    const r3 = K.buttonRow(hg);
    const nucPortal = (to, label) => ({ to, label, radius: portals[0].radius, center: portals[0].center, object: portals[0].object });
    K.button(r3, lens.pick({ "y7-8": "See the chromosomes ▸", "y9-10": "Karyotype ▸" }), () => engine.dive(nucPortal("karyotype", "Karyotype")));
    K.button(r3, lens.pick({ "y7-8": "Inheritance lab ▸", "y9-10": "Inheritance lab ▸" }), () => engine.dive(nucPortal("inheritance", "Inheritance lab")));
    K.button(r3, lens.pick({ "y7-8": "Switching genes on and off ▸", "y9-10": "Epigenetics ▸" }), () => engine.dive(nucPortal("epigenetics", "Epigenetics")));

    mission = K.missions(el, lens.filter(MISSIONS).map((m) => ({ text: lens.pick(m.text), check: () => m.check(M, state) })), (m) => engine.toast(`🎯 Mission complete: ${m.text}`, 3600));
    K.quiz(el, lens.filter(QUIZ));
    renderGenes();
  }

  function renderGenes() {
    const y7 = lens.band === "y7-8";
    for (const g of M.genes) {
      const r = geneRows[g.id];
      if (!r) continue;
      const s = g.hetero ? (y7 ? "packed away — never read" : "silenced in heterochromatin") : M.stopped ? (y7 ? "copying stopped" : "polymerase blocked") : g.rate < 0.05 ? (g.closed || g.epi < 0.3 ? (y7 ? "packed away — off" : "closed chromatin — off") : "off") : y7 ? "being copied" : `${g.rate.toFixed(2)} transcripts/s · ${Math.round(g.open * 100)}% open`;
      if (r.small.textContent !== s) r.small.textContent = s;
      r.bar.style.width = `${Math.min(100, (g.rate / 1.3) * 100).toFixed(0)}%`;
      r.row.classList.toggle("off", g.rate < 0.05);
      if (r.cb && r.cb.checked === g.closed) r.cb.checked = !g.closed;
    }
  }

  function buildChips() {
    const ov = engine.overlay;
    ov.innerHTML = "";
    chipFns = { tx: K.chip(ov), exp: K.chip(ov), sub: K.chip(ov), imp: K.chip(ov), wait: K.chip(ov) };
    chipFns.els = [...ov.children];
    for (const c of chipFns.els) c.classList.add("nuc-chip");
  }
  function updateChips() {
    if (!chipFns) return;
    const S = M.smooth, y7 = lens.band === "y7-8", d = (c) => `<i class="dot" style="background:${c}"></i>`;
    chipFns.tx(`${d("#f8fafc")}${y7 ? "Genes copied" : "Transcription"} <b>${S.tx.toFixed(1)}</b><span class="w">/s</span>`);
    chipFns.exp(`${d(MRNA_COL)}${y7 ? "Messages out" : "mRNA out"} <b>${S.exp.toFixed(1)}</b><span class="w">/s</span>`);
    chipFns.sub(`${d("#a5b4fc")}${y7 ? "Ribosome parts out" : "Subunits out"} <b>${S.subExp.toFixed(1)}</b><span class="w">/s</span>`);
    chipFns.imp(`${d("#fbbf24")}${y7 ? "Proteins in" : "Imports"} <b>${S.imp.toFixed(1)}</b><span class="w">/s</span>`);
    chipFns.wait(`${y7 ? "Messages waiting" : "mRNA in nucleus"} <b>${Math.round(M.mrna)}</b>`);
    chipFns.els[1].classList.toggle("warn", M.poresBlocked);
    chipFns.els[4].classList.toggle("warn", M.mrna > 30);
  }

  function drawChart() {
    if (!chart) return;
    const w = chart.clientWidth, h = chart.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    if (!w) return;
    if (chart.width !== Math.round(w * dpr)) { chart.width = Math.round(w * dpr); chart.height = Math.round(h * dpr); }
    const c = chartCtx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    c.strokeStyle = K.cssVar("--grid-line", "rgba(255,255,255,0.08)");
    for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(0, (h * i) / 4); c.lineTo(w, (h * i) / 4); c.stroke(); }
    const H = M.history;
    chart.setAttribute("aria-label", `Transcription ${M.smooth.tx.toFixed(1)} per second, mRNA export ${M.smooth.exp.toFixed(1)} per second, ribosomal subunit export ${M.smooth.subExp.toFixed(1)} per second, import ${M.smooth.imp.toFixed(1)} per second.`);
    if (H.length < 2) return;
    for (const [k, col] of [["imp", "#fbbf24"], ["sub", "#a5b4fc"], ["exp", MRNA_COL], ["tx", K.cssVar("--ink", "#f8fafc")]]) {
      c.strokeStyle = k === "tx" ? col : K.chartCol(col); c.lineWidth = 2; c.beginPath();
      H.forEach((p, i) => { const x = (i / 239) * w, y = h - Math.min(1, p[k] / 6) * (h - 4) - 2; i ? c.lineTo(x, y) : c.moveTo(x, y); });
      c.stroke();
    }
  }

  function syncControls() {
    if (!ctl.supply) return;
    ctl.supply.value = M.supply; ctl.condense.value = M.condense;
    for (const k of ["poresBlocked", "amanitin", "actD"]) if (ctl[k]) ctl[k].checked = M[k];
  }

  function focusGene(gi) {
    const g = genes[gi];
    const target = g.base.clone().addScaledVector(g.dir, 0.6);
    const dir = engine.camera.position.clone().sub(engine.controls.target).normalize();
    if (dir.dot(g.dir) < 0.2) dir.copy(g.dir).add(tmpV.set(0.2, 0.3, 0.4)).normalize();
    engine.fly(target, target.clone().addScaledVector(dir, 9));
    engine.select({ ...infoFor("gene", g.tube), point: target });
  }

  function showSelection(info) {
    if (!selCard) return;
    if (!info) { selCard.style.display = "none"; selGlow.visible = false; return; }
    let name, role, color, io = "", extra = "";
    if (info.kind === "gene") {
      const g = M.gene(info.gene), gi = GENE_INFO[g.id];
      name = gi.name; role = gi.role; color = gi.color;
      const now = renderNow(g);
      io = `<div class="io"><b>Now</b><span>${now}</span>${lens.atLeast("y9-10") ? `<b>Chromatin</b><span>${Math.round(g.open * 100)}% open</span>` : ""}</div>`;
      if (!g.hetero) extra = `<div class="btn-row"><button class="btn" data-act="toggle">${g.closed ? lens.pick({ "y7-8": "Unpack this gene (switch on)", "y9-10": "Open its chromatin" }) : lens.pick({ "y7-8": "Pack this gene away (switch off)", "y9-10": "Close its chromatin" })}</button></div>`;
    } else {
      const p = PARTS[info.kind];
      name = p.name; role = p.role; color = p.color;
      const now = status(info.kind);
      if (p.inputs || now) io = `<div class="io">${p.inputs ? `<b>In</b><span>${lens.pick(p.inputs)}</span><b>Out</b><span>${lens.pick(p.outputs)}</span>` : ""}${now ? `<b>Now</b><span>${now}</span>` : ""}</div>`;
    }
    selCard.style.display = "";
    selCard.innerHTML = `<h2>Selected</h2><p style="color:var(--ink);font-weight:600;margin-bottom:4px"><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:6px"></i>${lens.pick(name)}</p>
      <p>${lens.pick(role)}</p>${io}${extra}
      ${info.portal ? `<div class="btn-row"><button class="btn primary" data-act="zoom">${lens.pick({ "y7-8": "Zoom into the DNA ▸", "y9-10": "Zoom into the chromosome ▸", y11: "Zoom into the chromatin ▸" })}</button></div>` : ""}`;
    selCard.querySelector('[data-act="zoom"]')?.addEventListener("click", () => engine.dive(info.portal));
    selCard.querySelector('[data-act="toggle"]')?.addEventListener("click", () => {
      const g = M.gene(info.gene); g.closed = !g.closed; renderGenes(); showSelection(info);
      engine.toast(`${lens.pick(GENE_INFO[g.id].name)}: chromatin ${g.closed ? "closed" : "open"}`);
    });
    selGlow.visible = !!info.point;
    if (info.point) { selGlow.position.copy(info.point); selGlow.scale.setScalar(2.2); }
    if (panelEl) panelEl.parentElement?.scrollTo?.({ top: 0, behavior: "smooth" });
  }
  function renderNow(g) {
    const y7 = lens.band === "y7-8";
    if (g.hetero) return y7 ? "packed away, not read" : "silent — heterochromatin";
    if (M.stopped) return y7 ? "copying stopped by a poison" : M.amanitin ? "RNA pol II blocked (α-amanitin)" : "transcription blocked (actinomycin D)";
    if (g.rate < 0.05) return y7 ? "switched off" : "silent — closed chromatin";
    return y7 ? "being copied into messages" : `${g.rate.toFixed(2)} transcripts/s`;
  }

  function updateExplain() {
    if (!explainBody) return;
    const html = narrative(M, lens.band).map((p) => `<p>${p}</p>`).join("");
    if (explainBody.innerHTML !== html) explainBody.innerHTML = html;
  }

  // ---------- per-frame visuals ----------
  const q0 = new THREE.Quaternion();
  function animate(dt, t) {
    const F = M.F, still = engine.reducedMotion;
    camDir.copy(engine.camera.position).sub(engine.controls.target).normalize();
    if (state.cut) {
      cut.normal.copy(camDir).negate();
      cut.constant = CUT_C;
      cutEdge.visible = true;
      cutEdge.position.copy(camDir).multiplyScalar(CUT_C);
      cutEdge.quaternion.copy(q0.setFromUnitVectors(Z, camDir));
    } else { cut.normal.set(0, 0, -1); cut.constant = 1e4; cutEdge.visible = false; }
    // chromatin condensation: fibres pull together and dim
    const k = M.condense / 100;
    applyCondense(k);
    for (const tr of terr) tr.mat.emissiveIntensity = 0.5 - 0.3 * k;
    // nucleolus glows with rRNA synthesis
    noShellMat.emissiveIntensity = 0.1 + Math.min(0.6, F.rtx * 0.45);
    fcMat.emissiveIntensity = 0.2 + Math.min(1.2, F.rtx);
    // pores: plugged and dull when blocked
    plugs.visible = M.poresBlocked;
    poreMat.emissiveIntensity = M.poresBlocked ? 0.05 : 0.25 + Math.min(0.5, M.smooth.exp * 0.08);
    // NTP specks fade with the supply
    ntpPts.material.opacity = 0.08 + 0.5 * (M.supply / 100);
    portalRing.material.emissiveIntensity = 0.9 + Math.sin(t * 2.5) * 0.4;
    if (!still) { portalRing.rotateZ(dt * 0.4); cyto.rotation.y = Math.sin(t * 0.02) * 0.05; nucleolus.rotation.y = t * 0.03; }
    if (selGlow.visible) selGlow.material.opacity = 0.35 + 0.2 * Math.sin(t * 3);
  }

  // ---------- level object ----------
  let uiT = 0, exT = 0, chT = 0;
  const level = {
    title: "Nucleus",
    topics: ["organelles", "cell-structure", "dna-structure", "genes", "protein-synthesis", "epigenetics"],
    root, pickables, fallbackPickables, portals,
    model: M,                        // shared with the chromatin level (the model gene's chromatin state)
    entryRadius: RO,                 // nucleus radius 5 µm in the cell ↔ 10 units here (1 unit = 0.5 µm)
    get view() {
      const a = engine.camera.aspect, t = Math.tan(THREE.MathUtils.degToRad(engine.camera.fov / 2));
      const halfW = a < 0.9 ? 11.5 : 13.5;
      return { target: new THREE.Vector3(0, 0, 0), distance: Math.min(85, Math.max(32, halfW / (t * a))), dir: new THREE.Vector3(0.3, 0.3, 1) };
    },
    minDistance: 3, maxDistance: 90, near: 0.05, far: 700,
    env: { bg: ["#0c0f2e", "#16203f", "#3b1660"], fog: ["#0e1232", 0.0075], exposure: 1.05, bloom: [0.6, 0.55, 0.8], aperture: 0.0008 },
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
    unmountPanel() { for (const el of Object.values(labels)) el.style.display = "none"; diveLbl.style.display = "none"; engine.overlay.innerHTML = ""; chipFns = null; },
    onPause() { state.dived = true; },
    onResume() {
      makeLabels();
      syncControls(); renderGenes();
      const g = M.gene("hbb");
      if (M.shared?.dirty) {
        M.shared.dirty = false;
        engine.toast(lens.pick(g.epi < 0.3
          ? { "y7-8": "You packed the model gene away down there — it's switched off here too.", "y9-10": "The model gene's chromatin is closed now, so it is silent in the nucleus too.", y11: "The model gene is epigenetically silenced: its transcription here has fallen to zero." }
          : { "y7-8": "The model gene is open and being copied again.", y11: "The model gene's chromatin is open, so it is transcribed again here." }), 3400);
      }
    },
    onLens() { progress = null; panelEl.innerHTML = ""; buildPanel(panelEl); buildChips(); },
    dispose() {
      for (const el of Object.values(labels)) el.remove();
      diveLbl.remove();
    },
    update(dt, t, realDt) {
      const rdt = realDt ?? dt;
      simTime = t;
      M.step(dt);
      updateGenes(dt);
      emitFlows(dt);
      drawFlows(dt);
      drawGenes(t);
      animate(dt, t);
      updateLabels();
      uiT -= rdt; exT -= rdt; chT -= rdt;
      if (uiT <= 0) { uiT = 0.25; updateChips(); renderGenes(); }
      if (exT <= 0) { exT = 0.6; updateExplain(); }
      if (chT <= 0) { chT = 0.5; drawChart(); }
      mission?.update();
    },
  };
  return level;
}
