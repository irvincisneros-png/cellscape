// Membrane Transport — 3D level renderer (Three.js, inside the CellScape engine). Reads the 2D model (model.js) every frame and
// maps it onto a curved 3D bilayer: model x → along the membrane, model y → across it, and each
// particle gets its own depth. The model stays the single source of truth for the science.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { SP } from "./model.js";

export const VW = 1000, VH = 620;          // fixed virtual model size
const S = 0.02;                              // world units per model px (water)
const SM = 0.03;                             // membrane band is drawn thicker
const PS = 1.45;                             // protein scale
const PART = 1.35;                           // particle scale
const BEND = 0.012;                          // membrane curvature
const VIS = 2.1;                             // particles drawn larger than their model radius
const PROT_Z = { aqp: -1.2, kch: 1.0, glut: -0.4, pump: 0.9, nach: -1.4, suc: -0.4, hpump: 0.9, nit: -1.4 };
const VES_Z = 0.4;
const SPECIES_PROT = { h2o: ["aqp"], k: ["kch", "pump"], na: ["nach", "pump"], glc: ["glut"] };
const SPECIES_PROT_PLANT = { h2o: ["aqp"], k: ["kch"], suc: ["suc"], h: ["hpump", "suc", "nit"], no3: ["nit"] };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export const bend = (X) => -BEND * X * X;
const slope = (X) => -2 * BEND * X;

function physical(color, o = {}) {
  const c = new THREE.Color(color);
  return new THREE.MeshPhysicalMaterial({
    color: c, roughness: 0.3, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.2,
    sheen: 0.5, sheenRoughness: 0.5, sheenColor: c.clone().lerp(new THREE.Color("#ffffff"), 0.5),
    ...o,
  });
}

function sphereAt(r, x, y, z, color, ws = 16, hs = 12) {
  const g = new THREE.SphereGeometry(r, ws, hs);
  g.translate(x, y, z);
  return paint(g, color);
}
function paint(g, color) {
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3));
  if (g.index) g = g.toNonIndexed();
  g.deleteAttribute("uv");
  return g;
}

function labelTexture(text, base) {
  const cv = document.createElement("canvas");
  cv.width = 512; cv.height = 256;
  const c = cv.getContext("2d");
  c.fillStyle = base; c.fillRect(0, 0, 512, 256);
  c.font = "700 64px Inter, system-ui, sans-serif";
  c.textAlign = "center"; c.textBaseline = "middle";
  c.fillStyle = "rgba(0,0,0,0.25)"; c.fillText(text, 130, 132);
  c.fillStyle = "#ffffff"; c.fillText(text, 128, 128);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function softDot(inner = "rgba(255,255,255,1)") {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 64;
  const c = cv.getContext("2d"), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner); g.addColorStop(0.35, "rgba(255,255,255,0.35)"); g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- particle geometries (merged, vertex-coloured) ----------
function particleGeometry(sp) {
  const col = SP[sp].color;
  switch (sp) {
    case "o2": return mergeGeometries([sphereAt(0.12, -0.1, 0, 0, col), sphereAt(0.12, 0.1, 0, 0, col)]);
    case "co2": return mergeGeometries([sphereAt(0.1, 0, 0, 0, "#3b4250"), sphereAt(0.105, -0.17, 0, 0, "#e5484d"), sphereAt(0.105, 0.17, 0, 0, "#e5484d")]);
    case "h2o": {
      const a = (104.5 / 2) * Math.PI / 180, d = 0.12;
      return mergeGeometries([sphereAt(0.11, 0, 0, 0, "#e5484d"), sphereAt(0.07, Math.sin(a) * d, -Math.cos(a) * d, 0, "#f1f5f9"), sphereAt(0.07, -Math.sin(a) * d, -Math.cos(a) * d, 0, "#f1f5f9")]);
    }
    case "glc": {
      const ring = paint(new THREE.TorusGeometry(0.17, 0.06, 8, 6), col);
      const parts = [ring];
      for (let i = 0; i < 6; i++) {
        if (i === 4) continue;
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        parts.push(sphereAt(0.055, Math.cos(a) * 0.29, Math.sin(a) * 0.29, 0, i === 1 ? "#e5484d" : "#ecfccb", 8, 6));
      }
      return mergeGeometries(parts);
    }
    case "no3": { // planar NO₃⁻: N in the middle, three O at 120°
      const parts = [sphereAt(0.1, 0, 0, 0, "#3b82f6", 16, 12)];
      for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + Math.PI / 2; parts.push(sphereAt(0.105, Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0, "#e5484d", 16, 12)); }
      return mergeGeometries(parts);
    }
    case "suc": { // sucrose: a six-membered glucose ring joined through an O to a five-membered fructose ring
      const glc = paint(new THREE.TorusGeometry(0.15, 0.052, 8, 6), col), fru = paint(new THREE.TorusGeometry(0.12, 0.05, 8, 5), "#d9f99d");
      glc.translate(-0.25, 0, 0); fru.translate(0.27, 0.02, 0);
      const parts = [glc, fru, sphereAt(0.065, 0, 0.0, 0, "#e5484d", 10, 8)];
      for (const [x, y, c] of [[-0.25, 0.25, "#ecfccb"], [-0.43, -0.12, "#ecfccb"], [-0.25, -0.26, "#e5484d"], [0.27, 0.27, "#ecfccb"], [0.43, -0.17, "#e5484d"]]) parts.push(sphereAt(0.05, x, y, 0, c, 8, 6));
      return mergeGeometries(parts);
    }
    case "prot": {
      const g = new THREE.IcosahedronGeometry(0.36, 3);
      const p = g.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const n = 1 + 0.16 * Math.sin(v.x * 9) * Math.cos(v.y * 7) + 0.1 * Math.sin(v.z * 11 + v.x * 3);
        v.multiplyScalar(n); p.setXYZ(i, v.x, v.y, v.z);
      }
      g.computeVertexNormals();
      return paint(g, col);
    }
    default: return null; // ions use textured spheres
  }
}

function atpGeometry(scale = 1) {
  const g = mergeGeometries([
    sphereAt(0.085, -0.25, 0.02, 0, "#c4b5fd", 12, 10), sphereAt(0.07, -0.16, -0.05, 0, "#c4b5fd", 12, 10),
    sphereAt(0.07, -0.06, 0.02, 0, "#fde68a", 12, 10),
    sphereAt(0.06, 0.06, 0, 0, "#f59e0b", 12, 10), sphereAt(0.06, 0.17, 0.02, 0, "#f59e0b", 12, 10), sphereAt(0.06, 0.28, 0, 0, "#f59e0b", 12, 10),
  ]);
  g.scale(scale, scale, scale);
  return g;
}

// ---------- proteins ----------
function capsule(r, len, mat) {
  return new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 20), mat);
}

function buildChannel(P) {
  const g = new THREE.Group(), mat = physical(P.color);
  const subs = [];
  const n = 4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / 4;
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42);
    const m = capsule(0.3, 2.15, mat);
    pivot.add(m);
    pivot.userData.a = a;
    g.add(pivot);
    subs.push(pivot);
  }
  // selectivity filter ring at the outer mouth
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 10, 28), physical(P.color, { emissive: new THREE.Color(P.color), emissiveIntensity: 0.25 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.9;
  g.add(ring);
  g.userData = { subs, mat, ring };
  return g;
}

function buildGlut(P) {
  const g = new THREE.Group(), mat = physical(P.color);
  const lobes = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.x = s * 0.42;
    const a = capsule(0.42, 1.95, mat);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.36, 24, 16), mat);
    b.position.set(s * 0.18, -0.2, 0.25);
    pivot.add(a, b);
    g.add(pivot);
    return pivot;
  });
  const inhib = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), physical("#ef4444", { emissive: new THREE.Color("#ef4444"), emissiveIntensity: 0.4 }));
  inhib.visible = false;
  g.add(inhib);
  g.userData = { lobes, mat, inhib };
  return g;
}

function buildPump(P, plant = false) {
  const g = new THREE.Group(), mat = physical(P.color), matB = physical("#99f6e4"), matD = physical("#14b8a6");
  const subs = [], nSub = plant ? 6 : 4; // the H⁺-ATPase is one chain crossing the bilayer ~10 times; drawn as a ring of helices
  for (let i = 0; i < nSub; i++) {
    const a = (i / nSub) * Math.PI * 2 + Math.PI / 4;
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(a) * (plant ? 0.58 : 0.5), 0, Math.sin(a) * (plant ? 0.58 : 0.5));
    pivot.add(capsule(0.34, 2.05, mat));
    pivot.userData.a = a;
    g.add(pivot);
    subs.push(pivot);
  }
  // cytoplasmic N, P and A domains (where ATP binds)
  const dom = new THREE.Group();
  dom.position.y = -1.75;
  const N = new THREE.Mesh(new THREE.SphereGeometry(0.62, 32, 24), matD); N.position.set(0.35, -0.15, 0);
  const Pd = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 24), matD); Pd.position.set(-0.4, 0.05, 0.1);
  const A = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 24), mat); A.position.set(-0.1, -0.55, -0.25);
  dom.add(N, Pd, A);
  g.add(dom);
  if (plant) {
    // C-terminal regulatory domain (autoinhibitory tail) on the cytoplasmic side: no β-subunit in plants
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 18), physical("#5eead4"));
    tail.position.set(0.7, -2.2, 0.2);
    dom.add(tail);
  } else {
    // β-subunit on the outside with a sugar chain
    const beta = capsule(0.3, 0.55, matB);
    beta.position.set(0.25, 1.6, -0.1); beta.rotation.z = -0.35;
    g.add(beta);
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), physical("#fef3c7"));
      s.position.set(0.5 + i * 0.12, 2.0 + i * 0.13, -0.1 + (i % 2) * 0.08);
      g.add(s);
    }
  }
  const phos = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), physical("#fbbf24", { emissive: new THREE.Color("#f59e0b"), emissiveIntensity: 1.6 }));
  phos.position.set(-0.75, -1.6, 0.55);
  phos.visible = false;
  g.add(phos);
  g.userData = { subs, dom, phos, mat, matD };
  return g;
}

export class Scene3D {
  /** Renders the membrane model inside a CellScape engine (engine owns renderer, camera, controls, post). */
  constructor(M, engine, labelLayer) {
    this.M = M;
    this.engine = engine;
    this.camera = engine.camera;
    this.labelLayer = labelLayer;
    this.root = new THREE.Group();          // the level's root (engine adds it to its scene)
    this.world = new THREE.Group();
    this.world.rotation.z = -0.1;
    this.root.add(this.world);

    this.plant = M.plant;
    this.protZ = PROT_Z;
    this.addBackground();
    this.buildMembrane();
    this.buildProteins();
    this.buildParticles();
    this.buildVesicle();
    this.buildFx();
    this.buildLabels();

    this.tmpM = new THREE.Matrix4();
    this.tmpQ = new THREE.Quaternion();
    this.tmpV = new THREE.Vector3();
    this.tmpS = new THREE.Vector3();
    this.tmpE = new THREE.Euler();
  }

  /** Default framing: ~16 world units across whatever the aspect. */
  view() {
    const cam = this.camera, halfW = cam.aspect < 1 ? 6.5 : 8.2, t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const d = clamp(halfW / (t * cam.aspect), 9, 30);
    return { target: new THREE.Vector3(-0.6, -0.2, 0), distance: d, dir: new THREE.Vector3(0, 0.55, 1) };
  }

  // ---------- coordinates ----------
  /** Model (x, y) + depth z → local world position (inside this.world). */
  toLocal(x, y, z, out = new THREE.Vector3()) {
    const X = (x - VW / 2) * S;
    return out.set(X, this.yMap(y) + bend(X), z);
  }

  yMap(y) {
    const L = this.M.L, hb = (L.th / 2) * SM;
    if (y <= L.memTop) return hb + (L.memTop - y) * S;
    if (y >= L.memBot) return -hb - (y - L.memBot) * S;
    return (L.midY - y) * SM;
  }

  yUnmap(Y) {
    const L = this.M.L, hb = (L.th / 2) * SM;
    if (Y >= hb) return L.memTop - (Y - hb) / S;
    if (Y <= -hb) return L.memBot + (-hb - Y) / S;
    return L.midY - Y / SM;
  }

  // ---------- environment ----------
  addBackground() {
    // drifting specks for depth
    const n = 900, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const pal = ["#5eead4", "#a78bfa", "#fbbf24", "#93c5fd", "#f9a8d4"].map((c) => new THREE.Color(c));
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60; pos[i * 3 + 1] = (Math.random() - 0.5) * 34; pos[i * 3 + 2] = -Math.random() * 40 + 8;
      const c = pal[i % pal.length]; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    pg.setAttribute("color", new THREE.BufferAttribute(col, 3));
    this.specks = new THREE.Points(pg, new THREE.PointsMaterial({
      size: 0.18, map: softDot(), vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.root.add(this.specks);

    // out-of-focus organelles deep in the cytoplasm
    const mito = physical("#f472b6", { transparent: true, opacity: 0.35, roughness: 0.5 });
    for (const [x, y, z, r, rz] of [[-7, -7.5, -6, 1.1, 0.4], [5, -9, -10, 1.4, -0.3], [11, -6, -14, 1.2, 0.8]]) {
      const m = capsule(r, r * 2.6, mito);
      m.position.set(x, y, z); m.rotation.set(0.3, 0.2, Math.PI / 2 + rz);
      this.world.add(m);
    }
  }

  // ---------- membrane ----------
  footprints() {
    const L = this.M.L;
    return this.M.prot.map((P) => ({
      X: (P.x - VW / 2) * S, Z: PROT_Z[P.id],
      r: PS * (P.kind === "pump" ? 1.0 : P.kind === "carrier" ? 1.0 : 0.8),
    }));
  }

  buildMembrane() {
    const L = this.M.L, half = (L.th / 2) * SM, foot = this.footprints();
    const dx = 0.41, dz = 0.37, x0 = -13, x1 = 13, z0 = -9, z1 = 4.5;
    const heads = [];
    for (let row = 0, z = z0; z <= z1; z += dz, row++) {
      for (let x = x0 + (row % 2) * dx * 0.5; x <= x1; x += dx) {
        const X = x + (hash(row * 991 + x * 13) - 0.5) * 0.05, Z = z + (hash(row * 17 + x * 7) - 0.5) * 0.05;
        if (foot.some((f) => Math.hypot(X - f.X, Z - f.Z) < f.r)) continue;
        heads.push([X, Z, hash(X * 31 + Z * 57)]);
      }
    }
    // Order the lipids so any prefix of the buffer is an even, quasi-random spread over the sheet (golden-ratio ranks).
    // That way the engine's LOD (it just lowers InstancedMesh.count) thins the bilayer evenly instead of cutting off its front rows.
    const ranked = heads.map((h, j) => [(j * 0.6180339887) % 1, h]).sort((a, b) => a[0] - b[0]).map((r) => r[1]);
    heads.length = 0; heads.push(...ranked);
    const n = heads.length * 2;
    const headGeo = new THREE.SphereGeometry(0.2, 12, 9);
    const headMat = physical("#c3b4d6", { roughness: 0.38, clearcoat: 0.6, sheen: 0.8 });
    const tailGeo = new THREE.CylinderGeometry(0.04, 0.026, half * 0.92, 5, 1, true);
    const tailMat = new THREE.MeshStandardMaterial({ color: "#6b5a3e", roughness: 0.7 });
    this.heads = new THREE.InstancedMesh(headGeo, headMat, n);
    this.tails = new THREE.InstancedMesh(tailGeo, tailMat, n * 2);
    this.heads.userData.lod = true;   // decorative crowding: fewer lipids still show a bilayer (engine.lodScale thins them)
    this.tails.userData.lod = true;
    this.headScale = 1; this.lodApplied = 1;
    this.headData = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    const cA = new THREE.Color("#c9bbdb"), cB = new THREE.Color("#9f8fba"), cC = new THREE.Color("#d8cbe6"), c = new THREE.Color();
    let i = 0, k = 0;
    for (const [X, Z, h] of heads) {
      const Y0 = bend(X), tilt = Math.atan(slope(X));
      for (const sgn of [1, -1]) {
        p.set(X, Y0 + sgn * (half + 0.02), Z);
        m.compose(p, q.identity(), s);
        this.heads.setMatrixAt(i, m);
        c.copy(h < 0.5 ? cA : cB).lerp(cC, hash(i) * 0.6);
        if (sgn < 0) c.multiplyScalar(0.85);
        this.heads.setColorAt(i, c);
        this.headData.push({ X, Z, Y: p.y });
        for (const off of [-0.07, 0.07]) {
          e.set((hash(i + off) - 0.5) * 0.3, 0, tilt + (hash(i * 3 + off) - 0.5) * 0.3);
          p.set(X + off, Y0 + sgn * half * 0.5, Z);
          m.compose(p, q.setFromEuler(e), s);
          this.tails.setMatrixAt(k++, m);
        }
        i++;
      }
    }
    this.heads.instanceMatrix.needsUpdate = true;
    this.world.add(this.heads, this.tails);
    // dark hydrophobic core sheet so gaps between tails read as oily interior
    const core = new THREE.PlaneGeometry(26, 13.5, 64, 1);
    core.rotateX(-Math.PI / 2);
    const cp = core.attributes.position;
    for (let j = 0; j < cp.count; j++) cp.setY(j, bend(cp.getX(j)));
    core.translate(0, 0, (z0 + z1) / 2);
    this.core = new THREE.Mesh(core, new THREE.MeshStandardMaterial({ color: "#2b2418", roughness: 1, side: THREE.DoubleSide }));
    this.world.add(this.core);
    // vesicle site: indices of heads that may need hiding
    const vx = (this.M.L.vesX - VW / 2) * S;
    this.vesHeads = [];
    this.headData.forEach((d, j) => { if (Math.hypot(d.X - vx, d.Z - VES_Z) < 2.6) this.vesHeads.push(j); });
    this.vesHidden = false;
  }

  // ---------- proteins ----------
  buildProteins() {
    this.protObj = {};
    this.pickables = [];
    for (const P of this.M.prot) {
      const g = P.kind === "pump" ? buildPump(P, this.plant) : P.kind === "carrier" || P.kind === "symport" ? buildGlut(P) : buildChannel(P);
      const X = (P.x - VW / 2) * S;
      g.position.set(X, bend(X), PROT_Z[P.id]);
      g.rotation.z = Math.atan(slope(X));
      g.scale.setScalar(PS);
      g.traverse((o) => { if (o.isMesh) { o.userData.protId = P.id; this.pickables.push(o); } });
      this.world.add(g);
      this.protObj[P.id] = g;
    }
  }

  // ---------- particles ----------
  buildParticles() {
    this.pmesh = {};
    const MAX = 160;
    for (const sp of this.M.order) {
      let geo = particleGeometry(sp), mat;
      if (geo) mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.15 });
      else {
        geo = new THREE.SphereGeometry(sp === "k" ? 0.27 : sp === "h" ? 0.2 : 0.22, 32, 24);
        mat = physical("#ffffff", { map: labelTexture(SP[sp].name, SP[sp].color), roughness: 0.18, clearcoat: 1 });
      }
      const mesh = new THREE.InstancedMesh(geo, mat, MAX);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.userData.sp = sp;
      this.world.add(mesh);
      this.pmesh[sp] = mesh;
    }
    this.atpMesh = new THREE.InstancedMesh(atpGeometry(1.15), new THREE.MeshPhysicalMaterial({
      vertexColors: true, roughness: 0.25, clearcoat: 1, emissive: new THREE.Color("#f59e0b"), emissiveIntensity: 0.18,
    }), 32);
    this.atpMesh.count = 0; this.atpMesh.frustumCulled = false;
    this.world.add(this.atpMesh);
    this.piMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 12, 10), physical("#fbbf24", { emissive: new THREE.Color("#f59e0b"), emissiveIntensity: 0.6 }), 16);
    this.piMesh.count = 0; this.piMesh.frustumCulled = false;
    this.world.add(this.piMesh);
    this.depth = new Map(); // particle id → smoothed depth
  }

  // ---------- vesicle ----------
  buildVesicle() {
    const L = this.M.L, R = L.vesR * S, half = (L.th / 2) * SM;
    const pts = (n, r) => {
      const out = [], ga = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < n; i++) {
        const y = 1 - (i / (n - 1)) * 2, rr = Math.sqrt(1 - y * y), th = ga * i;
        out.push(new THREE.Vector3(Math.cos(th) * rr * r, y * r, Math.sin(th) * rr * r));
      }
      return out;
    };
    const outer = pts(230, R + half), inner = pts(40, Math.max(0.3, R - half));
    const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.19, 10, 8), this.heads.material, outer.length + inner.length);
    const m = new THREE.Matrix4();
    [...outer, ...inner].forEach((p, i) => { m.makeTranslation(p.x, p.y, p.z); mesh.setMatrixAt(i, m); });
    const shell = new THREE.Mesh(new THREE.SphereGeometry(R + half * 0.85, 32, 24), new THREE.MeshStandardMaterial({ color: "#4a3d2b", roughness: 1, transparent: true, opacity: 0.55 }));
    this.vesicle = new THREE.Group();
    this.vesicle.add(mesh, shell);
    this.vesicle.visible = false;
    this.world.add(this.vesicle);
  }

  // ---------- fx ----------
  buildFx() {
    const tex = softDot();
    this.glows = [];
    for (let i = 0; i < 40; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.visible = false;
      this.world.add(s);
      this.glows.push(s);
    }
  }

  // ---------- DOM labels ----------
  buildLabels() {
    const mk = (cls, html) => {
      const d = document.createElement("div");
      d.className = `lbl3d ${cls}`;
      d.innerHTML = html;
      this.labelLayer.appendChild(d);
      return d;
    };
    this.protLabels = {};
    for (const P of this.M.prot) this.protLabels[P.id] = mk("prot", P.short);
    this.pumpStatus = mk("status", "");
    this.sideOut = mk("side", "OUTSIDE · extracellular fluid");
    this.sideIn = mk("side", "INSIDE · cytoplasm");
    this.inspectLbl = mk("inspect", "");
    this.floaters = new Map();
    this.mk = mk;
  }

  place(el, v, dx = 0, dy = 0) {
    this.engine.place(el, this.world.localToWorld(this.tmpV.copy(v)), dx, dy);
  }


  // ---------- picking ----------
  pickProtein(cx, cy) {
    this.ray = this.engine.setRay(cx, cy);
    const hit = this.ray.intersectObjects(this.pickables, false)[0];
    return hit ? hit.object.userData.protId : null;
  }

  pickParticle(cx, cy) {
    this.ray = this.engine.setRay(cx, cy);
    const meshes = Object.values(this.pmesh);
    const hit = this.ray.intersectObjects(meshes, false)[0];
    if (!hit) return null;
    return hit.object.userData.list?.[hit.instanceId] || null;
  }

  /** Screen point → model coords on the vertical plane through the membrane's centre line. */
  toModel(cx, cy, planeZ = 0) {
    this.ray = this.engine.setRay(cx, cy);
    const inv = this.tmpM.copy(this.world.matrixWorld).invert();
    const o = this.ray.ray.origin.clone().applyMatrix4(inv);
    const d = this.ray.ray.direction.clone().transformDirection(inv);
    if (Math.abs(d.z) < 1e-4) return null;
    const t = (planeZ - o.z) / d.z;
    if (t < 0) return null;
    const p = o.addScaledVector(d, t);
    const x = p.x / S + VW / 2, y = this.yUnmap(p.y - bend(p.x));
    return { x: clamp(x, 8, VW - 8), y };
  }

  // ---------- per-frame ----------
  /** Performance tier: when the engine thins the lipids (lodScale < 1) the remaining heads grow a little so the sheet still reads as continuous. */
  applyLod(ls) {
    this.lodApplied = ls;
    this.headScale = Math.min(1.4, 1 / Math.sqrt(ls));
    const m = this.tmpM, hs = this.headScale, p = this.tmpV, q = this.tmpQ.identity(), sc = this.tmpS.set(hs, hs, hs);
    this.headData.forEach((d, j) => { m.compose(p.set(d.X, d.Y, d.Z), q, sc); this.heads.setMatrixAt(j, m); });
    this.heads.instanceMatrix.needsUpdate = true;
    // cheaper lipid heads on the lower tiers (216 -> 120 -> 80 triangles each)
    this.headGeos ??= { 1: this.heads.geometry };
    const seg = ls >= 1 ? 1 : ls >= 0.75 ? 0.75 : 0.5;
    this.headGeos[seg] ??= seg === 0.75 ? new THREE.SphereGeometry(0.2, 10, 6) : new THREE.SphereGeometry(0.2, 8, 5);
    this.heads.geometry = this.headGeos[seg];
    this.vesHidden = true;       // let updateVesicle re-apply the hole if one is open
    this.specks.geometry.setDrawRange(0, Math.ceil(this.specks.geometry.attributes.position.count * ls));
  }

  /** Text for the "outside / inside" tags and protein labels (the level sets these from the year lens). */
  setLabels({ out, inside, prot } = {}) {
    if (out != null) this.sideOut.textContent = out;
    if (inside != null) this.sideIn.textContent = inside;
    if (prot) for (const id in prot) if (this.protLabels[id]) this.protLabels[id].textContent = prot[id];
  }

  update(dt, t, ui = {}) {
    const ls = this.engine.lodScale ?? 1;
    if (ls !== this.lodApplied) this.applyLod(ls);
    this.specks.rotation.y = Math.sin(t * 0.03) * 0.05;
    this.specks.position.y = Math.sin(t * 0.05) * 0.4;
    this.world.rotation.y = Math.sin(t * 0.07) * 0.035;
    this.updateProteins(t, ui);
    this.updateParticles(dt, t);
    this.updateVesicle();
    this.updateFx(t);
    this.updateLabels(ui);
  }

  dispose() { this.labelLayer.remove(); }

  updateProteins(t, ui) {
    const M = this.M;
    for (const P of M.prot) {
      const g = this.protObj[P.id], u = g.userData;
      const hover = ui.hover === P.id;
      const glow = Math.max(P.flash || 0, hover ? 0.35 : 0);
      if (P.kind === "channel") {
        const open = P.openAnim;
        u.subs.forEach((s, i) => {
          const a = s.userData.a, r = lerp(0.3, 0.46, open);
          s.position.set(Math.cos(a) * r, Math.sin(t * 2 + i) * 0.015, Math.sin(a) * r);
          // closed: subunits lean together like an iris
          s.rotation.set(Math.sin(a) * (1 - open) * 0.28, 0, -Math.cos(a) * (1 - open) * 0.28);
        });
        u.ring.material.emissiveIntensity = 0.2 + open * 0.6 + glow * 2;
        u.mat.emissive.set(P.color).multiplyScalar(glow * 0.6);
      } else if (P.kind === "symport") {
        const S2 = M.sym[P.id], th = 0.24 * -S2.c;
        u.lobes[0].rotation.z = th; u.lobes[1].rotation.z = -th;
        u.lobes[0].position.y = u.lobes[1].position.y = Math.sin(t * 1.7 + P.fx * 9) * 0.02;
        u.inhib.visible = S2.blocked;
        u.inhib.position.set(0, 1.3, 0.1);
        u.inhib.rotation.set(t, t * 0.7, 0);
        u.mat.emissive.set(P.color).multiplyScalar(glow * 0.6);
      } else if (P.kind === "carrier") {
        const gl = M.glut, th = 0.24 * -gl.c;
        u.lobes[0].rotation.z = th; u.lobes[1].rotation.z = -th;
        u.lobes[0].position.y = u.lobes[1].position.y = Math.sin(t * 1.7) * 0.02;
        u.inhib.visible = gl.blocked;
        u.inhib.position.set(0, 1.3, 0.1);
        u.inhib.rotation.set(t, t * 0.7, 0);
        u.mat.emissive.set(P.color).multiplyScalar(glow * 0.6);
      } else {
        const pu = M.pump, c = pu.c; // 0 = open to inside, 1 = open to outside
        u.subs.forEach((s) => {
          const a = s.userData.a, side = Math.cos(a) > 0 ? 1 : -1;
          s.rotation.z = side * lerp(-0.18, 0.18, c);
        });
        u.dom.rotation.z = lerp(0.15, -0.25, c);
        u.dom.position.x = lerp(0.1, -0.15, c);
        u.phos.visible = pu.phos;
        u.matD.emissive.set("#f59e0b").multiplyScalar((pu.flash || 0) * 0.8 + (M.feeding ? 0.25 + 0.15 * Math.sin(t * 12) : 0));
        u.mat.emissive.set(P.color).multiplyScalar(glow * 0.5);
      }
    }
  }

  depthFor(p, dt) {
    const L = this.M.L;
    let own = this.depth.get(p.id);
    if (own === undefined) {
      own = { base: lerp(-3.8, 2.6, hash(p.id)), z: 0, init: false };
      if (p.zHint !== undefined) { own.base = p.zHint; }
      this.depth.set(p.id, own);
    }
    let target = own.base, w = 0, pz = 0;
    if (p.mode === "transit" && p.tr && PROT_Z[p.tr.via] !== undefined) { w = 1; pz = PROT_Z[p.tr.via]; }
    else if (p.mode === "bound") { w = 1; pz = PROT_Z[p.bid] ?? (p.sp === "glc" ? PROT_Z.glut : PROT_Z.pump); }
    else if (p.mode === "ves") { w = 1; pz = VES_Z; }
    else {
      // drift toward the depth of a protein the particle is approaching
      for (const id of (this.plant ? SPECIES_PROT_PLANT : SPECIES_PROT)[p.sp] || []) {
        const P = this.M.byId[id];
        const d = Math.hypot(p.x - P.x, p.y - L.midY);
        const ww = Math.exp(-((d / 70) ** 2));
        if (ww > w) { w = ww; pz = PROT_Z[id]; }
      }
    }
    target = lerp(own.base, pz, w);
    if (!own.init) { own.z = target; own.init = true; }
    own.z += (target - own.z) * Math.min(1, dt * (w > 0.9 ? 12 : 3));
    return own.z;
  }

  updateParticles(dt, t) {
    const M = this.M, m = this.tmpM, q = this.tmpQ, v = this.tmpV, s = this.tmpS, e = this.tmpE;
    const lists = {};
    for (const sp of M.order) lists[sp] = [];
    for (const p of M.parts) if (!p.dead && lists[p.sp].length < 160) lists[p.sp].push(p);
    const seen = new Set();
    let glowI = 0;
    for (const sp of M.order) {
      const mesh = this.pmesh[sp], list = lists[sp], ion = sp === "na" || sp === "k" || sp === "h";
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        seen.add(p.id);
        const z = this.depthFor(p, dt);
        this.toLocal(p.x, p.y, z, v);
        if (ion) q.identity();
        else q.setFromEuler(e.set(p.rot * 0.7 + p.id, p.rot, p.rot * 0.4));
        const sc = PART * (ion ? 1.05 : 1.0);
        s.set(sc, sc, sc);
        m.compose(v, q, s);
        mesh.setMatrixAt(i, m);
        if ((p.mode === "transit" || p.mode === "bound") && glowI < this.glows.length) {
          const g = this.glows[glowI++];
          g.visible = true; g.position.copy(v);
          g.material.color.set(SP[sp].color);
          g.material.opacity = 0.85;
          g.scale.setScalar(1.1);
        }
      }
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.userData.list = list;
    }
    for (const id of this.depth.keys()) if (!seen.has(id)) this.depth.delete(id);
    this.glowUsed = glowI;

    // ATP in the cytoplasm + the one flying to the pump
    let a = 0;
    for (const d of M.atpDots) {
      this.toLocal(d.x, d.y, lerp(-3, 2.2, hash(d.x * 0.01 + a)), v);
      m.compose(v, q.setFromEuler(e.set(d.rot, d.rot * 0.5, 0)), s.set(d.a, d.a, d.a));
      this.atpMesh.setMatrixAt(a++, m);
    }
    const fly = M.pump.fly;
    if (fly && a < 32) {
      const k = fly.t, x = lerp(fly.from.x, fly.to.x, k), y = lerp(fly.from.y, fly.to.y, k) - Math.sin(k * Math.PI) * 30;
      this.toLocal(x, y, lerp(0, PROT_Z[M.pumpId] + 0.6, k), v);
      m.compose(v, q.identity(), s.set(1.2, 1.2, 1.2));
      this.atpMesh.setMatrixAt(a++, m);
    }
    this.atpMesh.count = a;
    this.atpMesh.instanceMatrix.needsUpdate = true;

    let b = 0;
    for (const sp of M.fx.sprites) {
      if (b >= 16) break;
      this.toLocal(sp.x, sp.y, PROT_Z[M.pumpId] + 0.6, v);
      const k = (1 - sp.t) * (sp.kind === "ADP" ? 1.3 : 0.9);
      m.compose(v, q.identity(), s.set(k, k, k));
      this.piMesh.setMatrixAt(b++, m);
    }
    this.piMesh.count = b;
    this.piMesh.instanceMatrix.needsUpdate = true;
  }

  updateVesicle() {
    const M = this.M, V = M.ves, L = M.L;
    const c = V.circle;
    this.vesicle.visible = !!c;
    if (c) this.toLocal(c.x, c.y, VES_Z, this.vesicle.position);
    // open a hole in the flat membrane while a pocket / fusion is in progress
    const want = !!(V.pocket && V.pocket.k > 0.05);
    const R = want ? (L.vesR * S + (L.th / 2) * SM) * clamp(V.pocket.k * 1.2, 0, 1.15) : 0;
    if (!want && !this.vesHidden) return;
    const m = this.tmpM, vx = (L.vesX - VW / 2) * S;
    for (const j of this.vesHeads) {
      const d = this.headData[j];
      const hide = want && Math.hypot(d.X - vx, d.Z - VES_Z) < R;
      const hs = hide ? 0 : this.headScale;
      m.compose(this.tmpV.set(d.X, d.Y, d.Z), this.tmpQ.identity(), this.tmpS.set(hs, hs, hs));
      this.heads.setMatrixAt(j, m);
    }
    this.heads.instanceMatrix.needsUpdate = true;
    this.vesHidden = want;
  }

  updateFx(t) {
    const M = this.M;
    let i = this.glowUsed || 0;
    for (const f of M.fx.flashes) {
      if (i >= this.glows.length) break;
      const g = this.glows[i++];
      g.visible = true;
      this.toLocal(f.x, f.y, PROT_Z[M.pumpId] + 0.7, g.position);
      g.material.color.set(f.color);
      g.material.opacity = (1 - f.t) * 1.2;
      g.scale.setScalar((f.r * S) * 4 * (0.6 + f.t));
    }
    // pump glow while feeding ATP
    if (M.feeding && i < this.glows.length) {
      const g = this.glows[i++], P = M.byId[M.pumpId];
      g.visible = true;
      this.toLocal(P.x, M.L.memBot + 70, PROT_Z[M.pumpId] + 0.6, g.position);
      g.material.color.set("#fbbf24");
      g.material.opacity = 0.6 + 0.3 * Math.sin(t * 12);
      g.scale.setScalar(2.6);
    }
    for (; i < this.glows.length; i++) this.glows[i].visible = false;
  }

  updateLabels(ui) {
    const M = this.M, L = M.L, v = new THREE.Vector3();
    for (const P of M.prot) {
      const el = this.protLabels[P.id];
      const X = (P.x - VW / 2) * S;
      v.set(X, bend(X) + PS * (P.kind === "pump" ? 2.65 : 1.95), PROT_Z[P.id]);
      this.place(el, v);
      el.classList.toggle("hover", ui.hover === P.id);
      el.classList.toggle("off", (P.kind === "channel" && !P.open) || (P.kind === "carrier" && M.glut.blocked) || (P.kind === "symport" && M.sym[P.id].blocked) || (P.kind === "pump" && M.plant && M.pump.blocked));
    }
    const P = M.byId[M.pumpId];
    this.pumpStatus.textContent = M.pumpStatus();
    v.set((P.x - VW / 2) * S, bend((P.x - VW / 2) * S) - PS * 2.9, PROT_Z[M.pumpId] + 0.4);
    this.place(this.pumpStatus, v);
    this.place(this.sideOut, this.toLocal(260, 120, 0, v)); // below the stage's chip rows (plant mode has an extra chip)
    this.place(this.sideIn, this.toLocal(260, L.uh - 40, 0, v));

    // floating event text
    const live = new Set();
    for (const f of M.fx.floaters) {
      live.add(f);
      let el = this.floaters.get(f);
      if (!el) { el = this.mk("floater", f.text); el.style.color = f.color; this.floaters.set(f, el); }
      el.style.opacity = String(f.t < 0.15 ? f.t / 0.15 : 1 - Math.max(0, (f.t - 0.6) / 0.4));
      this.place(el, this.toLocal(f.x, f.y, PROT_Z[M.pumpId] + 0.5, v));
    }
    for (const [f, el] of this.floaters) if (!live.has(f)) { el.remove(); this.floaters.delete(f); }

    // inspected particle
    const ins = M.inspect;
    if (ins && !ins.p.dead) {
      const p = ins.p, d = this.depth.get(p.id);
      this.inspectLbl.innerHTML = ui.inspectHTML ? ui.inspectHTML(p) : SP[p.sp].long;
      this.place(this.inspectLbl, this.toLocal(p.x, p.y, d ? d.z : 0, v), 0, -34);
    } else this.inspectLbl.style.display = "none";
  }
}
