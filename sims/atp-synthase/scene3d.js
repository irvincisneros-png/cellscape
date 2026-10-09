// The inner mitochondrial membrane (a crista) in 3D, driven by ETCModel (model.js).
// Model coordinates are the 2D sim's reference layout (REF): x along the membrane, y across it
// (intermembrane space / crista lumen on top, matrix below). P() maps them onto a gently curved 3D membrane.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { physical, softDot, paint, hash } from "../../assets/js/world/materials.js";
import { REF, PCAP, TAU, betaState } from "./model.js";
import { COL } from "./draw.js";

export const S = 0.026;              // world units per REF px → membrane (72 px) ≈ 1.87 units ≈ 7.5 nm
const CX = 430;                       // REF x at the world origin
const BEND = 0.006;
export const Z0 = 0.6;                // depth of the main row of proteins
const HB = (REF.th / 2) * S;          // half bilayer thickness
const bend = (X) => -BEND * X * X;
const slope = (X) => -2 * BEND * X;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export const toX = (x) => (x - CX) * S;
/** REF (x, y) + depth z → position inside the scene's `world` group. */
export function P(x, y, z = Z0, out = new THREE.Vector3()) {
  const X = (x - CX) * S;
  return out.set(X, (REF.mid - y) * S + bend(X), z);
}

function sphereAt(r, x, y, z, color, ws = 14, hs = 10) {
  const g = new THREE.SphereGeometry(r, ws, hs);
  g.translate(x, y, z);
  return paint(g, color);
}
const vmat = (o = {}) => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15, ...o });
function capsuleBetween(a, b, r, mat) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, len), 8, 18), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

// molecule geometries (merged, vertex-coloured)
const GEO = {
  nadh: () => mergeGeometries([sphereAt(0.15, -0.12, 0, 0, COL.nadh), sphereAt(0.15, 0.12, 0, 0, COL.nadh), sphereAt(0.07, 0, 0.14, 0, "#bfdbfe")]),
  nad: () => mergeGeometries([sphereAt(0.14, -0.12, 0, 0, COL.nad), sphereAt(0.14, 0.12, 0, 0, COL.nad)]),
  o2: () => mergeGeometries([sphereAt(0.13, -0.1, 0, 0, COL.o2), sphereAt(0.13, 0.1, 0, 0, COL.o2)]),
  h2o: () => { const a = (104.5 / 2) * Math.PI / 180, d = 0.13; return mergeGeometries([sphereAt(0.12, 0, 0, 0, "#e5484d"), sphereAt(0.075, Math.sin(a) * d, -Math.cos(a) * d, 0, "#f1f5f9"), sphereAt(0.075, -Math.sin(a) * d, -Math.cos(a) * d, 0, "#f1f5f9")]); },
  atp: () => mergeGeometries([sphereAt(0.14, -0.2, 0, 0, COL.atp), sphereAt(0.075, -0.02, 0, 0, COL.pi), sphereAt(0.075, 0.12, 0, 0, COL.pi), sphereAt(0.075, 0.26, 0, 0, COL.pi)]),
  adp: () => mergeGeometries([sphereAt(0.13, -0.12, 0, 0, COL.adp), sphereAt(0.07, 0.05, 0, 0, COL.pi), sphereAt(0.07, 0.18, 0, 0, COL.pi)]),
  pi: () => sphereAt(0.08, 0, 0, 0, COL.pi),
};
const MOL_MAX = { nadh: 24, nad: 16, o2: 12, h2o: 30, atp: 30, adp: 16, pi: 16 };

export class CristaeScene {
  constructor(M, engine, labelLayer) {
    this.M = M;
    this.engine = engine;
    this.labelLayer = labelLayer;
    this.root = new THREE.Group();
    this.world = new THREE.Group();
    this.world.rotation.x = 0.04;
    this.root.add(this.world);
    this.pickables = [];
    this.tv = new THREE.Vector3(); this.tv2 = new THREE.Vector3(); this.tq = new THREE.Quaternion();
    this.tm = new THREE.Matrix4(); this.ts = new THREE.Vector3(); this.te = new THREE.Euler(); this.tc = new THREE.Color();
    this.pp = { x: 0, y: 0 };
    this.buildBackdrop();
    this.buildMembrane();
    this.buildComplexes();
    this.buildSynthase();
    this.buildProtons();
    this.buildMolecules();
    this.buildFx();
    this.buildLabels();
  }

  // ---------- environment ----------
  buildBackdrop() {
    const n = 700, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const pal = ["#f9a8d4", "#a78bfa", "#fbbf24", "#93c5fd", "#5eead4"].map((c) => new THREE.Color(c));
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60; pos[i * 3 + 1] = (Math.random() - 0.5) * 34; pos[i * 3 + 2] = -Math.random() * 40 + 6;
      const c = pal[i % pal.length]; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    this.specks = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.16, map: softDot(), vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.root.add(this.specks);
    // the facing membrane of the same crista, far above (the lumen is a narrow sheet between two membranes)
    const far = new THREE.Mesh(new THREE.PlaneGeometry(40, 16, 1, 1), new THREE.MeshStandardMaterial({ color: "#3b2a4a", roughness: 0.9, transparent: true, opacity: 0.35, depthWrite: false }));
    far.rotation.x = Math.PI / 2; far.position.set(0, 6.2, -4);
    this.world.add(far);
    // pink "H⁺ haze" in the intermembrane space / crista lumen — brightness follows the gradient
    this.haze = new THREE.Mesh(new THREE.BoxGeometry(26, 3.6, 10), new THREE.MeshBasicMaterial({ color: COL.H, transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide }));
    this.haze.position.set(0, HB + 1.9 - 0.25, -2.2);
    this.world.add(this.haze);
  }

  // ---------- membrane ----------
  footprints() {
    const f = [
      { X: toX(REF.x1), r: 1.55 }, { X: toX(REF.x2), r: 0.6 }, { X: toX(REF.x3), r: 1.0 }, { X: toX(REF.x4), r: 0.85 },
      { X: toX(REF.x5) + 0.2, r: 1.25 },
    ].map((o) => ({ ...o, Z: Z0 }));
    f.push({ X: toX(REF.x5) + 0.4, Z: Z0 - 2.6, r: 1.25 }); // dimer partner
    for (const b of this.bg || []) f.push(b);
    return f;
  }

  buildMembrane() {
    // a few background complexes, deeper in the membrane (decorative)
    this.bg = [];
    for (let i = 0; i < 7; i++) this.bg.push({ X: -10 + i * 3.3 + (hash(i) - 0.5), Z: -4.6 - hash(i + 9) * 1.6, r: 0.7, kind: i % 4 });
    const foot = this.footprints();
    const dx = 0.42, dz = 0.38, x0 = -12.5, x1 = 12.5, z0 = -7.2, z1 = Z0 + 0.1; // front edge cut through the protein row
    const heads = [];
    for (let row = 0, z = z0; z <= z1; z += dz, row++) {
      for (let x = x0 + (row % 2) * dx * 0.5; x <= x1; x += dx) {
        const X = x + (hash(row * 991 + x * 13) - 0.5) * 0.05, Z = z + (hash(row * 17 + x * 7) - 0.5) * 0.05;
        if (foot.some((f) => Math.hypot(X - f.X, Z - f.Z) < f.r)) continue;
        heads.push([X, Z, hash(X * 31 + Z * 57)]);
      }
    }
    const n = heads.length * 2;
    this.heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 10, 8), physical("#d6b9c9", { roughness: 0.4, clearcoat: 0.6 }), n);
    this.tails = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.04, 0.026, HB * 0.92, 5, 1, true), new THREE.MeshStandardMaterial({ color: "#6b5a3e", roughness: 0.7 }), n * 2);
    const m = this.tm, q = this.tq, e = this.te, p = this.tv, s = this.ts.set(1, 1, 1);
    const cA = new THREE.Color("#dcbfd0"), cB = new THREE.Color("#b493b0"), cC = new THREE.Color("#ecd8e2"), c = this.tc, cl = new THREE.Color("#f0b37e");
    let i = 0, k = 0;
    for (const [X, Z, h] of heads) {
      const Y0 = bend(X), tilt = Math.atan(slope(X));
      for (const sgn of [1, -1]) {
        p.set(X, Y0 + sgn * (HB + 0.02), Z);
        this.heads.setMatrixAt(i, m.compose(p, q.identity(), s));
        c.copy(h < 0.5 ? cA : cB).lerp(cC, hash(i) * 0.6);
        if (h > 0.93) c.copy(cl);                 // cardiolipin-rich patches (inner membrane lipid)
        if (sgn < 0) c.multiplyScalar(0.85);
        this.heads.setColorAt(i, c);
        for (const off of [-0.07, 0.07]) {
          e.set((hash(i + off) - 0.5) * 0.3, 0, tilt + (hash(i * 3 + off) - 0.5) * 0.3);
          p.set(X + off, Y0 + sgn * HB * 0.5, Z);
          this.tails.setMatrixAt(k++, m.compose(p, q.setFromEuler(e), s));
        }
        i++;
      }
    }
    this.world.add(this.heads, this.tails);
    const core = new THREE.PlaneGeometry(25, z1 - z0, 64, 1);
    core.rotateX(-Math.PI / 2);
    const cp = core.attributes.position;
    for (let j = 0; j < cp.count; j++) cp.setY(j, bend(cp.getX(j)));
    core.translate(0, 0, (z0 + z1) / 2);
    this.coreMat = new THREE.MeshStandardMaterial({ color: "#2b2418", roughness: 1, side: THREE.DoubleSide, emissive: new THREE.Color("#000000") });
    this.world.add(new THREE.Mesh(core, this.coreMat));
  }

  // ---------- ETC complexes ----------
  tagPick(obj, kind) { obj.traverse((o) => { if (o.isMesh) { o.userData.kind = kind; this.pickables.push(o); } }); return obj; }

  buildComplexes() {
    const R = REF, w = this.world;
    this.cx = {};
    const mk = (kind, color) => { const mat = physical(color, { emissive: new THREE.Color(color), emissiveIntensity: 0 }); const g = new THREE.Group(); g.userData.mat = mat; this.cx[kind] = g; w.add(g); return { g, mat }; };
    // Complex I: membrane arm + peripheral arm reaching into the matrix (L-shape)
    {
      const { g, mat } = mk("I", COL.c1);
      const a = P(R.x1 - 34, R.mid), b = P(R.x1 + 30, R.mid);
      g.add(capsuleBetween(a, b, 0.62, mat));
      g.add(capsuleBetween(P(R.x1 - 18, R.mid - 10, Z0 - 0.35), P(R.x1 + 14, R.mid - 8, Z0 - 0.35), 0.45, mat));
      const ab = P(R.armBase[0], R.armBase[1]), tip = P(R.nodes.N[0].x + 4, R.nodes.N[0].y + 8);
      g.add(capsuleBetween(ab, tip, 0.5, mat));
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.62, 28, 20), mat); bulb.position.copy(tip); bulb.scale.set(1, 0.85, 1); g.add(bulb);
      const fes = physical("#fb923c", { emissive: new THREE.Color("#f97316"), emissiveIntensity: 0.6 });
      for (let i = 0; i < 5; i++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), fes);
        s.position.copy(ab).lerp(tip, 0.15 + i * 0.18); s.z += 0.52;
        g.add(s);
      }
      this.tagPick(g, "I");
    }
    // Complex II (succinate dehydrogenase) — no pumping
    {
      const { g, mat } = mk("II", COL.c2);
      g.add(capsuleBetween(P(R.x2, R.mid - 18), P(R.x2, R.mid + 24), 0.4, mat));
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.5, 28, 20), mat); P(R.x2, R.bot + 16, Z0, h.position); g.add(h);
      const fad = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), physical(COL.fadh, { emissive: new THREE.Color(COL.fadh), emissiveIntensity: 0.4 }));
      P(R.x2, R.bot + 18, Z0 + 0.48, fad.position); g.add(fad);
      this.tagPick(g, "II");
    }
    // Complex III (cytochrome bc₁ dimer)
    {
      const { g, mat } = mk("III", COL.c3);
      for (const d of [-13, 13]) {
        g.add(capsuleBetween(P(R.x3 + d, R.top - 4), P(R.x3 + d, R.bot + 6), 0.38, mat));
        const ims = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 14), mat); P(R.x3 + d * 0.9, R.top - 13, Z0, ims.position); g.add(ims);
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 16), mat); P(R.x3 + d, R.bot + 16, Z0, core.position); g.add(core);
      }
      this.tagPick(g, "III");
    }
    // Complex IV (cytochrome c oxidase)
    {
      const { g, mat } = mk("IV", COL.c4);
      g.add(capsuleBetween(P(R.x4, R.top - 2), P(R.x4, R.bot + 2), 0.6, mat));
      const a = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), mat); P(R.x4 - 9, R.top - 9, Z0, a.position); g.add(a);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 14), mat); P(R.x4 + 8, R.bot + 9, Z0, b.position); g.add(b);
      this.cn = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), physical("#dc2626", { emissive: new THREE.Color("#ef4444"), emissiveIntensity: 0.8 }));
      P(R.x4 + 7, R.mid + 3, Z0 + 0.62, this.cn.position); this.cn.visible = false; g.add(this.cn);
      this.tagPick(g, "IV");
    }
    // tilt each complex with the membrane's curvature
    // background complexes (dimmer)
    const bgMat = [COL.c1, COL.c3, COL.c4, COL.c2].map((c) => physical(c, { roughness: 0.5 }));
    for (const b of this.bg) {
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.2, 6, 14), bgMat[b.kind]);
      m.position.set(b.X, bend(b.X), b.Z);
      m.rotation.z = Math.atan(slope(b.X));
      w.add(m);
    }
    // mobile carriers: idle ubiquinone (in the membrane) + cytochrome c (on the intermembrane face)
    this.qMat = physical(COL.q, { emissive: new THREE.Color(COL.e), emissiveIntensity: 0 });
    this.qIdle = [0, 1, 2].map((i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), this.qMat); m.userData.ph = hash(i * 5) * TAU; m.userData.kind = "Q"; this.pickables.push(m); w.add(m); return m; });
    const cMat = physical(COL.cytc, { emissive: new THREE.Color(COL.cytc), emissiveIntensity: 0.2 });
    this.cIdle = [0, 1].map((i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 14), cMat); m.userData.ph = hash(i * 7 + 1) * TAU; m.userData.kind = "cytc"; this.pickables.push(m); w.add(m); return m; });
    // carriers riding with electron pairs
    this.qRide = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 14, 10), physical(COL.q, { emissive: new THREE.Color(COL.e), emissiveIntensity: 0.5 }), 12);
    this.cRide = new THREE.InstancedMesh(new THREE.SphereGeometry(0.24, 16, 12), cMat, 12);
    this.eMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 10, 8), new THREE.MeshBasicMaterial({ color: "#fffbe8" }), 40);
    for (const im of [this.qRide, this.cRide, this.eMesh]) { im.count = 0; im.frustumCulled = false; w.add(im); }
  }

  // ---------- ATP synthase ----------
  buildSynthase() {
    const R = REF;
    this.f1y = (R.mid - R.f1y) * S;                          // F1 centre relative to membrane mid
    this.ringR = 1.6;
    const makeOne = (partner) => {
      const grp = new THREE.Group();
      const rotor = new THREE.Group();
      grp.add(rotor);
      const cMat = physical(COL.cring, { emissive: new THREE.Color(COL.cring), emissiveIntensity: 0.05 });
      const mark = physical(COL.atp, { emissive: new THREE.Color(COL.atp), emissiveIntensity: 0.25 });
      const cGeo = new THREE.CapsuleGeometry(0.15, 1.25, 6, 12);
      const Rc = R.Rc * S;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU, m = new THREE.Mesh(cGeo, i === 0 ? mark : cMat);
        m.position.set(Math.cos(a) * Rc, 0, Math.sin(a) * Rc);
        rotor.add(m);
      }
      const gMat = physical(COL.gamma);
      const gam = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, -this.f1y + 0.2, 14), gMat);
      gam.position.y = this.f1y / 2 - 0.15; rotor.add(gam);
      const eps = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), gMat); eps.position.set(0.22, -1.15, 0); rotor.add(eps);
      const cam = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), gMat); cam.position.set(0.16, this.f1y + 0.3, 0); rotor.add(cam);
      // stator: a-subunit (half-channels), peripheral stalk (b), δ cap
      const stMat = physical(COL.stator);
      const ax = (R.ax - R.x5) * S;
      const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 1.25, 6, 14), stMat); a.position.set(ax, 0, 0); grp.add(a);
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(ax, -0.7, 0), new THREE.Vector3(ax + 0.45, -1.7, 0.1), new THREE.Vector3(ax + 0.35, this.f1y - 0.4, 0.15), new THREE.Vector3(0.45, this.f1y - 1.0, 0.1)]);
      grp.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.075, 8), stMat));
      const delta = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), stMat); delta.position.set(0.3, this.f1y - 0.95, 0.05); grp.add(delta);
      // F1 head: α3β3 (stationary)
      const lobes = [];
      const aMat = physical("#aeb9cc", { roughness: 0.45, clearcoat: 0.5 });
      const lGeo = new THREE.SphereGeometry(0.5, 28, 20);
      for (let k = 0; k < 6; k++) {
        const p = (k * TAU) / 6 + TAU / 12, alpha = k % 2 === 0;
        const mat = alpha ? aMat : physical(COL.beta, { emissive: new THREE.Color(COL.atp), emissiveIntensity: 0 });
        const m = new THREE.Mesh(lGeo, mat);
        const base = new THREE.Vector3(Math.cos(p) * 0.6, this.f1y, Math.sin(p) * 0.6);
        m.position.copy(base); m.scale.set(1, 1.25, 1);
        grp.add(m);
        lobes.push({ m, base, alpha, j: (k - 1) / 2, dir: new THREE.Vector3(Math.cos(p), 0, Math.sin(p)), mat });
      }
      grp.userData = { rotor, lobes, partner, a };
      return grp;
    };
    const X5 = toX(R.x5);
    this.syn = makeOne(false);
    this.syn.position.set(X5, bend(X5), Z0);
    this.syn.rotation.z = Math.atan(slope(X5));
    this.world.add(this.syn);
    this.tagPick(this.syn, "synthase");
    this.partner = makeOne(true);
    this.partner.position.set(X5 + 0.4, bend(X5 + 0.4) - 0.1, Z0 - 2.6);
    this.partner.rotation.set(0.32, 0.4, Math.atan(slope(X5)));
    this.world.add(this.partner);
    // bound nucleotides on the β subunits (one each): ADP + Pi (Loose), ATP (Tight), empty (Open)
    this.betaATP = new THREE.InstancedMesh(GEO.atp(), vmat({ emissive: new THREE.Color(COL.atp), emissiveIntensity: 0.6 }), 3);
    this.betaADP = new THREE.InstancedMesh(GEO.adp(), vmat(), 3);
    for (const im of [this.betaATP, this.betaADP]) { im.count = 0; im.frustumCulled = false; this.syn.add(im); }
    // crank: a glowing ring around F1 with a gold handle (the user's "hand" on the rotor)
    const ringMat = new THREE.MeshBasicMaterial({ color: COL.atp, transparent: true, opacity: 0.35, depthWrite: false });
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(this.ringR, 0.035, 8, 96), ringMat);
    this.ring.rotation.x = Math.PI / 2; this.ring.position.y = this.f1y;
    this.syn.add(this.ring);
    this.ringHit = new THREE.Mesh(new THREE.TorusGeometry(this.ringR, 0.38, 6, 48), new THREE.MeshBasicMaterial({ visible: false }));
    this.ringHit.rotation.x = Math.PI / 2; this.ringHit.position.y = this.f1y; this.ringHit.userData.kind = "rotor";
    this.syn.add(this.ringHit); this.pickables.push(this.ringHit);
    this.handle = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), physical(COL.atp, { emissive: new THREE.Color(COL.atp), emissiveIntensity: 0.7 }));
    this.handle.userData.kind = "rotor"; this.pickables.push(this.handle);
    this.syn.add(this.handle);
    // direction arrows on the ring (synthesis = clockwise seen from the intermembrane side)
    const arrowGeo = new THREE.ConeGeometry(0.11, 0.3, 10);
    this.arrows = [];
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: COL.atp, transparent: true, opacity: 0.6, depthWrite: false }));
      const phi = Math.PI / 2 + (i - 1) * 0.5;      // front of the ring
      c.position.set(Math.cos(phi) * this.ringR, this.f1y, Math.sin(phi) * this.ringR);
      // tangent in the direction of increasing φ (synthesis), see level.js
      const t = new THREE.Vector3(-Math.sin(phi), 0, Math.cos(phi));
      c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), t);
      this.syn.add(c); this.arrows.push(c);
    }
    this.olig = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), physical("#dc2626", { emissive: new THREE.Color("#ef4444"), emissiveIntensity: 0.8 }));
    this.olig.position.set((REF.ax - REF.x5) * S - 0.3, 0.1, 0.25); this.olig.visible = false;
    this.syn.add(this.olig);
  }

  /** World position of the F1 head centre (for crank input). */
  f1World(out) { return this.syn.localToWorld(out.set(0, this.f1y, 0)); }
  ringWorld(phi, out) { return this.syn.localToWorld(out.set(Math.cos(phi) * this.ringR, this.f1y, Math.sin(phi) * this.ringR)); }

  // ---------- protons ----------
  buildProtons() {
    const geo = new THREE.SphereGeometry(0.095, 10, 8);
    const mat = physical(COL.H, { emissive: new THREE.Color(COL.H), emissiveIntensity: 0.55 });
    this.hCrowd = new THREE.InstancedMesh(geo, mat, 150);
    this.hCrowd.frustumCulled = false;
    this.crowd = [];
    for (let i = 0; i < 150; i++) this.crowd.push(this.randomIMS(new THREE.Vector3(), i).clone());
    this.crowdV = this.crowd.map(() => new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(0.6));
    this.hMove = new THREE.InstancedMesh(geo, mat.clone(), 70);
    this.hMove.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(70 * 3), 3);
    this.hMove.frustumCulled = false;
    this.moving = [];
    this.hotC = new THREE.Color("#fb923c"); this.pinkC = new THREE.Color(COL.H);
    this.world.add(this.hCrowd, this.hMove);
  }

  randomIMS(out, seed = Math.random() * 1000) {
    const X = rand(-11.5, 11.5), Z = rand(-6.5, 2.2);
    return out.set(X, bend(X) + HB + 0.35 + Math.random() * 3.0, Z);
  }

  /** Animate a proton along world-local points [Vector3…] with per-segment durations. */
  addMover(pts, durs, delay = 0, hot = false) {
    if (this.moving.length >= 70) this.moving.shift();
    this.moving.push({ pts, durs, seg: 0, t: 0, d: delay, hot });
  }

  // ---------- matrix molecules ----------
  buildMolecules() {
    this.mol = {};
    for (const k of Object.keys(MOL_MAX)) {
      const im = new THREE.InstancedMesh(GEO[k](), vmat(k === "atp" ? { emissive: new THREE.Color(COL.atp), emissiveIntensity: 0.25 } : {}), MOL_MAX[k]);
      im.count = 0; im.frustumCulled = false;
      this.world.add(im);
      this.mol[k] = { im, list: [] };
    }
    // NADH waiting in the matrix, O₂ diffusing in, ADP + Pi near ATP synthase
    this.nadhs = []; this.o2s = []; this.amb = [];
    for (let i = 0; i < 3; i++) this.amb.push(this.newMol("adp", this.matrixPoint(new THREE.Vector3(), 5.2, 9.5)));
    for (let i = 0; i < 3; i++) this.amb.push(this.newMol("pi", this.matrixPoint(new THREE.Vector3(), 5.2, 9.5)));
    this.o2Refill = 0; this.nadhRefill = 0;
  }

  matrixPoint(out, x0 = -11, x1 = 11) {
    const X = rand(x0, x1);
    return out.set(X, bend(X) - HB - rand(0.8, 4.2), rand(-4.5, 2.4));
  }

  newMol(k, p, v = null, life = Infinity) {
    return { k, p: p.clone(), v: v ? v.clone() : new THREE.Vector3(rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.3, 0.3)), life, max: life, rot: Math.random() * TAU, dock: null };
  }

  addProduct(k, p, v, life) {
    const L = this.mol[k].list;
    if (L.length >= MOL_MAX[k]) L.shift();
    L.push(this.newMol(k, p, v, life));
  }

  // ---------- fx ----------
  buildFx() {
    const tex = softDot();
    this.glows = [];
    for (let i = 0; i < 56; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.visible = false;
      this.world.add(s);
      this.glows.push(s);
    }
    this.fx = []; // { k, p, t, dur, color, r }
  }
  addFx(k, p, dur, color, r) { if (this.fx.length > 60) this.fx.shift(); this.fx.push({ k, p: p.clone(), t: 0, dur, color, r }); }

  // ---------- DOM labels ----------
  buildLabels() {
    const mk = (cls, html = "") => { const d = document.createElement("div"); d.className = `lbl3d ${cls}`; d.innerHTML = html; this.labelLayer.appendChild(d); return d; };
    this.mkLabel = mk;
    this.lbl = {
      I: mk("prot"), II: mk("prot"), III: mk("prot"), IV: mk("prot"), Q: mk("prot small"), cytc: mk("prot small"), syn: mk("prot"),
      F0: mk("side"), F1: mk("side"), ims: mk("side"), matrix: mk("side"), crank: mk("crank"), warn: mk("warn"), heat: mk("heatlbl"),
    };
    this.floaters = [];
  }
  floater(text, p, color) {
    if (this.floaters.some((f) => f.text === text)) return;
    if (this.floaters.length >= 3) { const f = this.floaters.shift(); f.el.remove(); }
    const el = this.mkLabel("floater", text); el.style.color = color;
    this.floaters.push({ text, p: p.clone(), el, life: 1.8 });
  }
  place(el, v, dx = 0, dy = 0) { return this.engine.place(el, this.world.localToWorld(this.tv2.copy(v)), dx, dy); }

  // ---------- events from the model ----------
  onEvents(evts, ui) {
    const R = REF;
    for (const e of evts) {
      switch (e.k) {
        case "pump": {
          const x = R[{ I: "x1", III: "x3", IV: "x4" }[e.at]];
          for (let i = 0; i < e.n; i++) {
            const a = P(x + rand(-8, 8), R.bot + 18, Z0 + rand(0.2, 0.7)), b = P(x + rand(-5, 5), R.mid, Z0 + 0.5), c = P(x + rand(-14, 14), R.top - 14, Z0 + rand(-0.6, 0.8));
            this.addMover([a, b, c], [0.35, 0.35], i * 0.13);
          }
          break;
        }
        case "synIn": {
          const s = this.randomIMS(this.tv); s.x = toX(R.ax) + rand(-1.2, 1.2); s.y = Math.min(s.y, bend(s.x) + HB + 1.5);
          this.addMover([s.clone(), P(R.ax - 2, R.top - 3, Z0), P(R.ax - 7, R.mid, Z0 + 0.3), P(R.x5 + R.Rc * 0.45, R.bot + 6, Z0 + 0.4), P(R.x5 + R.Rc * 0.45 + rand(-10, 10), R.bot + 40, Z0 + rand(0, 1))], [0.35, 0.2, 0.2, 0.5]);
          break;
        }
        case "synOut":
          this.addMover([P(R.x5 + R.Rc * 0.45, R.bot + 8), P(R.ax - 7, R.mid, Z0 + 0.3), P(R.ax - 2, R.top - 3), P(R.ax + rand(-16, 16), R.top - 20, Z0 + rand(-0.5, 0.8))], [0.2, 0.2, 0.25]);
          break;
        case "leak": {
          let X = rand(-11, 11);
          for (let k = 0; k < 10 && this.footprints().some((f) => Math.abs(X - f.X) < f.r && Math.abs(f.Z - Z0) < 0.1); k++) X = rand(-11, 11);
          const z = rand(-2, 1.8), y0 = bend(X);
          this.addMover([new THREE.Vector3(X, y0 + HB + 1.2, z), new THREE.Vector3(X, y0 + HB, z), new THREE.Vector3(X, y0 - HB - 0.2, z), new THREE.Vector3(X, y0 - HB - 1.2, z)], [0.3, e.hot ? 0.35 : 0.6, 0.4], 0, e.hot);
          if (e.hot) this.addFx("heat", this.tv.set(X, y0, z), 0.9, "#fb923c", 1.2);
          break;
        }
        case "water":
          this.addProduct("h2o", P(R.x4 + rand(-6, 6), R.bot + 16, Z0 + 0.3), this.tv.set(rand(-0.5, 0.5), rand(-0.9, -0.5), rand(-0.3, 0.6)), 5);
          if (this.M.water % 5 === 1 && ui.eq) this.floater("½O₂ + 2H⁺ + 2e⁻ → H₂O", P(R.x4, R.bot + 50), COL.h2o);
          break;
        case "o2used": {
          let best = -1, bd = Infinity; const t = P(R.x4, R.bot);
          this.o2s.forEach((o, i) => { const d = o.p.distanceToSquared(t); if (d < bd) { bd = d; best = i; } });
          if (best >= 0) { const o = this.o2s.splice(best, 1)[0]; this.addFx("pop", o.p, 0.5, COL.o2, 0.8); }
          break;
        }
        case "nadh": {
          const tip = P(R.nodes.N[0].x, R.nodes.N[0].y + 10, Z0 + 0.5);
          let best = null, bd = Infinity;
          for (const n of this.nadhs) if (n.dock == null) { const d = n.p.distanceToSquared(tip); if (d < bd) { bd = d; best = n; } }
          if (best) { best.dock = 0; best.from = best.p.clone(); best.to = tip; }
          if (ui.eq && Math.random() < 0.3) this.floater("NADH → NAD⁺ + H⁺ + 2e⁻", P(R.x1 + 40, R.nodes.N[0].y + 40), COL.nadh);
          break;
        }
        case "fadh":
          if (ui.eq && Math.random() < 0.5) this.floater("FADH₂ → FAD + 2e⁻", P(R.x2, R.bot + 50), COL.fadh);
          break;
        case "atp": {
          const L = this.syn.userData.lobes.filter((l) => !l.alpha);
          const open = L.find((l) => betaState(l.j, this.M.rotor.kA) === 2) || L[0];
          const p = this.syn.localToWorld(this.tv.copy(open.base).addScaledVector(open.dir, 0.55));
          this.world.worldToLocal(p);
          this.addProduct("atp", p, this.tv2.set(open.dir.x * 0.6 + rand(-0.2, 0.2), rand(-0.8, -0.3), open.dir.z * 0.6), 6);
          this.addFx("snap", p, 0.6, COL.atp, 1.3);
          if (ui.eq && (e.byHand || this.M.made % 7 === 1)) this.floater("ADP + Pᵢ → ATP", p.clone().add(this.tv2.set(-1.6, -0.6, 0)), COL.atp);
          break;
        }
        case "hydro": {
          const L = this.syn.userData.lobes.filter((l) => !l.alpha);
          const lo = L.find((l) => betaState(l.j, this.M.rotor.kA) === 0) || L[0];
          const p = this.syn.localToWorld(this.tv.copy(lo.base).addScaledVector(lo.dir, 0.55));
          this.world.worldToLocal(p);
          this.addProduct("adp", p, this.tv2.set(rand(-0.8, -0.2), rand(-0.8, -0.3), 0.3), 3);
          this.addProduct("pi", p, this.tv2.set(rand(0.2, 0.8), rand(-0.8, -0.3), 0.3), 3);
          this.addFx("snap", p, 0.4, "#fb923c", 1.0);
          if (ui.eq) this.floater("ATP → ADP + Pᵢ", p.clone().add(this.tv2.set(-1.6, -0.9, 0)), "#fb923c");
          break;
        }
      }
    }
  }

  // ---------- per-frame ----------
  update(dt, t, ui) {
    const M = this.M, still = this.engine.reducedMotion;
    if (!still) { this.specks.rotation.y = Math.sin(t * 0.03) * 0.05; this.specks.position.y = Math.sin(t * 0.05) * 0.4; }
    this.updateComplexes(dt, t, ui);
    this.updateSynthase(t, ui);
    this.updateProtons(dt, t);
    this.updateMolecules(dt, t);
    this.updateFx(dt, t);
    this.updateLabels(dt, ui);
  }

  updateComplexes(dt, t, ui) {
    const M = this.M, R = REF, f = M.flash, red = M.reduced, pulse = 0.75 + 0.25 * Math.sin(t * 5);
    const em = { I: f.I * 0.9 + red * 0.35 * pulse, II: f.II * 0.9, III: f.III * 0.9 + red * 0.35 * pulse, IV: f.IV * 0.9 + red * 0.45 * pulse };
    for (const k of ["I", "II", "III", "IV"]) {
      const mat = this.cx[k].userData.mat;
      mat.emissive.set(red > 0.3 && k !== "II" ? COL.e : k === "II" ? COL.fadh : COL.e);
      mat.emissiveIntensity = em[k] * 0.6 + (ui.hover === k ? 0.25 : 0);
    }
    this.cn.visible = M.st.cyanide;
    if (this.cn.visible) this.cn.rotation.set(t, t * 0.7, 0);
    // idle carriers
    const qa = R.x1 + R.hw1 + 8, qb = R.x3 - R.hw3 - 8;
    this.qIdle.forEach((q, i) => {
      const ph = q.userData.ph;
      P(lerp(qa, qb, 0.5 + 0.45 * Math.sin(t * 0.5 + ph)), R.mid + Math.sin(t * 1.3 + ph) * 3, Z0 + (i - 1) * 0.55, q.position);
    });
    this.qMat.emissiveIntensity = red > 0.4 ? 0.6 : 0;
    this.cIdle.forEach((c, i) => {
      const ph = c.userData.ph;
      P(lerp(R.x3 + 14, R.x4 - 14, 0.5 + 0.4 * Math.sin(t * 0.7 + ph)), R.top - 14 + Math.sin(t * 1.7 + ph) * 2, Z0 + (i ? -0.7 : 0.6), c.position);
    });
    // electron pairs + carriers
    const m = this.tm, q = this.tq.identity(), s = this.ts, v = this.tv;
    let ne = 0, nq = 0, nc = 0;
    for (const p of M.packets) {
      M.packetPos(p, this.pp);
      P(this.pp.x, this.pp.y, Z0 + 0.62, v);
      if (p.carryQ && nq < 12) this.qRide.setMatrixAt(nq++, m.compose(v, q, s.set(1, 1, 1)));
      if (p.carryC && nc < 12) this.cRide.setMatrixAt(nc++, m.compose(v, q, s.set(1, 1, 1)));
      const ph = t * 7 + p.ph, ox = Math.cos(ph) * 0.11, oy = Math.sin(ph) * 0.08;
      const sc = p.d > 0 ? 0.5 : 1;
      if (ne < 39) {
        this.eMesh.setMatrixAt(ne++, m.compose(this.tv2.set(v.x + ox, v.y + oy, v.z + 0.12), q, s.set(sc, sc, sc)));
        this.eMesh.setMatrixAt(ne++, m.compose(this.tv2.set(v.x - ox, v.y - oy, v.z + 0.12), q, s.set(sc, sc, sc)));
      }
    }
    this.qRide.count = nq; this.cRide.count = nc; this.eMesh.count = ne;
    this.qRide.instanceMatrix.needsUpdate = this.cRide.instanceMatrix.needsUpdate = this.eMesh.instanceMatrix.needsUpdate = true;
  }

  updateSynthase(t, ui) {
    const M = this.M, R = M.rotor;
    for (const g of [this.syn, this.partner]) {
      const u = g.userData;
      u.rotor.rotation.y = -R.th;                 // +θ = synthesis = clockwise seen from the intermembrane side
      for (const l of u.lobes) {
        if (l.alpha) continue;
        const st = betaState(l.j, R.kA);
        l.mat.color.set(st === 0 ? COL.beta : st === 1 ? "#5b4fc4" : "#b9bdfb");
        l.mat.emissiveIntensity = st === 1 ? 0.18 : 0;
        l.m.position.copy(l.base).addScaledVector(l.dir, st === 2 ? 0.1 : 0);
        const k = st === 2 ? 0.93 : 1;
        l.m.scale.set(k, 1.25 * k, k);
      }
    }
    // nucleotides bound to the hero's β subunits
    const m = this.tm, s = this.ts.set(1, 1, 1), q = this.tq;
    let na = 0, nd = 0;
    for (const l of this.syn.userData.lobes) {
      if (l.alpha) continue;
      const st = betaState(l.j, R.kA);
      const p = this.tv.copy(l.base).addScaledVector(l.dir, 0.5); p.y -= 0.05;
      q.setFromAxisAngle(this.tv2.set(0, 1, 0), Math.atan2(-l.dir.z, l.dir.x) + Math.PI / 2);
      if (st === 1) this.betaATP.setMatrixAt(na++, m.compose(p, q, s.set(0.9, 0.9, 0.9)));
      else if (st === 0) this.betaADP.setMatrixAt(nd++, m.compose(p, q, s.set(0.9, 0.9, 0.9)));
    }
    this.betaATP.count = na; this.betaADP.count = nd;
    this.betaATP.instanceMatrix.needsUpdate = this.betaADP.instanceMatrix.needsUpdate = true;
    // crank handle rides the ring at φ = θ
    this.handle.position.set(Math.cos(R.th) * this.ringR, this.f1y, Math.sin(R.th) * this.ringR);
    const active = ui.grabbed || ui.hover === "rotor";
    this.ring.material.opacity = active ? 0.75 : ui.firstGrab ? 0.3 + 0.25 * (0.5 + 0.5 * Math.sin(t * 4)) : 0.3;
    this.handle.material.emissiveIntensity = active ? 1.4 : 0.6 + (ui.firstGrab ? 0.5 * Math.sin(t * 4) : 0);
    for (const a of this.arrows) a.material.opacity = active ? 0.9 : 0.45;
    this.olig.visible = M.st.olig;
  }

  updateProtons(dt, t) {
    const M = this.M, m = this.tm, q = this.tq.identity(), s = this.ts.set(1, 1, 1);
    // crowd in the intermembrane space = the model's pool
    const n = Math.min(150, Math.round(M.pool * 1.15));
    const k = Math.min(1, dt * 1.2);
    for (let i = 0; i < n; i++) {
      const p = this.crowd[i], v = this.crowdV[i];
      if (dt > 0) {
        v.x += rand(-1, 1) * 2.4 * dt; v.y += rand(-1, 1) * 2.4 * dt; v.z += rand(-1, 1) * 2.4 * dt;
        v.multiplyScalar(1 - k * 0.5);
        p.addScaledVector(v, dt);
        const yb = bend(p.x) + HB + 0.3;
        if (p.x < -11.8 || p.x > 11.8) v.x = -v.x, p.x = clamp(p.x, -11.8, 11.8);
        if (p.z < -6.8 || p.z > 2.4) v.z = -v.z, p.z = clamp(p.z, -6.8, 2.4);
        if (p.y < yb) { p.y = yb; v.y = Math.abs(v.y); }
        if (p.y > yb + 3.3) { p.y = yb + 3.3; v.y = -Math.abs(v.y); }
      }
      this.hCrowd.setMatrixAt(i, m.compose(p, q, s));
    }
    this.hCrowd.count = n;
    this.hCrowd.instanceMatrix.needsUpdate = true;
    // movers (pumped, through ATP synthase, leaking)
    let j = 0;
    const hotC = this.hotC, pinkC = this.pinkC;
    for (let i = this.moving.length - 1; i >= 0; i--) {
      const mv = this.moving[i];
      if (mv.d > 0) { mv.d -= dt; continue; }
      mv.t += dt / mv.durs[mv.seg];
      while (mv.t >= 1 && mv.seg < mv.pts.length - 2) { mv.t -= 1; mv.seg++; }
      if (mv.t >= 1) { this.moving.splice(i, 1); continue; }
      const a = mv.pts[mv.seg], b = mv.pts[mv.seg + 1];
      this.tv.copy(a).lerp(b, easeInOut(mv.t));
      if (j < 70) {
        this.hMove.setMatrixAt(j, m.compose(this.tv, q, s));
        this.hMove.setColorAt(j, mv.hot ? hotC : pinkC);
        j++;
      }
    }
    this.hMove.count = j;
    this.hMove.instanceMatrix.needsUpdate = true;
    if (this.hMove.instanceColor) this.hMove.instanceColor.needsUpdate = true;
    // haze in the lumen follows the gradient
    this.haze.material.opacity = 0.015 + 0.085 * M.gradient();
    this.coreMat.emissive.set("#fb923c").multiplyScalar(M.heat * (0.35 + 0.1 * Math.sin(t * 7)));
  }

  updateMolecules(dt, t) {
    const M = this.M, st = M.st;
    // O₂ diffusing into the matrix
    const o2Target = st.o2 > 0 ? Math.max(1, Math.round((st.o2 / 100) * 7)) : 0;
    if (this.o2s.length < o2Target) {
      this.o2Refill += dt * 1.5;
      if (this.o2Refill >= 1) { this.o2Refill = 0; this.o2s.push(this.newMol("o2", this.matrixPoint(this.tv, -4.5, 4))); }
    } else if (this.o2s.length > o2Target) this.o2s.pop();
    // NADH pool (grows if the chain is blocked — NAD⁺ is not regenerated)
    const nTarget = (st.nadh > 0 ? Math.round(1 + st.nadh / 20) : 0) + Math.min(8, Math.round(M.backlog));
    const free = this.nadhs.filter((n) => n.dock == null).length;
    if (free < nTarget) {
      this.nadhRefill += dt * 2;
      if (this.nadhRefill >= 1) { this.nadhRefill = 0; this.nadhs.push(this.newMol("nadh", this.matrixPoint(this.tv, -11.5, -4))); }
    } else if (free > nTarget) { const i = this.nadhs.findIndex((n) => n.dock == null); if (i >= 0) this.nadhs.splice(i, 1); }
    for (let i = this.nadhs.length - 1; i >= 0; i--) {
      const n = this.nadhs[i];
      if (n.dock != null) {
        n.dock += dt / 0.35;
        n.p.copy(n.from).lerp(n.to, easeInOut(Math.min(1, n.dock)));
        if (n.dock >= 1) { this.nadhs.splice(i, 1); this.addProduct("nad", n.p, this.tv.set(rand(-0.6, 0.2), rand(-0.8, -0.4), rand(-0.2, 0.4)), 3); }
      } else this.drift(n, dt, -11.8, -3.6);
    }
    for (const o of this.o2s) this.drift(o, dt, -5.2, 5);
    for (const a of this.amb) this.drift(a, dt, 4.6, 10.5);
    // draw
    const m = this.tm, q = this.tq, s = this.ts.set(1, 1, 1), e = this.te;
    const counts = {};
    const put = (k, o, sc = 1) => {
      const ent = this.mol[k]; let c = counts[k] || 0;
      if (c >= MOL_MAX[k]) return;
      q.setFromEuler(e.set(o.rot * 0.7, o.rot, o.rot * 0.3));
      ent.im.setMatrixAt(c, m.compose(o.p, q, s.set(sc, sc, sc)));
      counts[k] = c + 1;
    };
    for (const n of this.nadhs) put("nadh", n);
    for (const o of this.o2s) put("o2", o);
    for (const a of this.amb) put(a.k, a, 0.9);
    for (const [k, ent] of Object.entries(this.mol)) {
      const L = ent.list;
      for (let i = L.length - 1; i >= 0; i--) {
        const o = L[i];
        o.life -= dt;
        if (o.life <= 0) { L.splice(i, 1); continue; }
        o.p.addScaledVector(o.v, dt); o.v.multiplyScalar(1 - Math.min(1, dt * 0.6)); o.rot += dt;
        const yb = bend(o.p.x) - HB - 0.25; if (o.p.y > yb) o.p.y = yb;
        put(k, o, Math.min(1, o.life / 1.2, (o.max - o.life) * 5 + 0.3));
      }
    }
    for (const [k, ent] of Object.entries(this.mol)) { ent.im.count = counts[k] || 0; ent.im.instanceMatrix.needsUpdate = true; }
  }

  drift(o, dt, x0, x1) {
    if (dt <= 0) return;
    o.v.x += rand(-1, 1) * 1.6 * dt; o.v.y += rand(-1, 1) * 1.6 * dt; o.v.z += rand(-1, 1) * 1.6 * dt;
    o.v.multiplyScalar(1 - Math.min(1, dt * 1.5));
    o.p.addScaledVector(o.v, dt); o.rot += dt * 0.6;
    const yb = bend(o.p.x) - HB - 0.6;
    if (o.p.x < x0 || o.p.x > x1) { o.v.x = -o.v.x; o.p.x = clamp(o.p.x, x0, x1); }
    if (o.p.y > yb) { o.p.y = yb; o.v.y = -Math.abs(o.v.y); }
    if (o.p.y < yb - 4) { o.p.y = yb - 4; o.v.y = Math.abs(o.v.y); }
    if (o.p.z < -4.5 || o.p.z > 2.6) { o.v.z = -o.v.z; o.p.z = clamp(o.p.z, -4.5, 2.6); }
  }

  updateFx(dt, t) {
    const M = this.M;
    let i = 0;
    for (let k = this.fx.length - 1; k >= 0; k--) { const f = this.fx[k]; f.t += dt; if (f.t >= f.dur) this.fx.splice(k, 1); }
    for (const f of this.fx) {
      if (i >= this.glows.length) break;
      const g = this.glows[i++], u = f.t / f.dur;
      g.visible = true; g.position.copy(f.p);
      if (f.k === "heat") g.position.y += u * 0.8;
      g.material.color.set(f.color);
      g.material.opacity = (1 - u) * 0.9;
      g.scale.setScalar(f.r * (0.6 + u));
    }
    // activity glows on the complexes
    const R = REF, fl = M.flash;
    const spots = [["I", R.x1, R.mid, COL.e], ["II", R.x2, R.bot + 12, COL.fadh], ["III", R.x3, R.mid, COL.e], ["IV", R.x4, R.mid, COL.e]];
    for (const [k, x, y, c] of spots) {
      if (fl[k] < 0.02 || i >= this.glows.length) continue;
      const g = this.glows[i++];
      g.visible = true; P(x, y, Z0 + 0.9, g.position);
      g.material.color.set(c); g.material.opacity = 0.7 * fl[k]; g.scale.setScalar(2.4);
    }
    // heat shimmer (uncoupler): warm glows rising off both faces of the membrane
    if (M.heat > 0.05 && !this.engine.reducedMotion) {
      for (let k = 0; k < 10 && i < this.glows.length; k++) {
        const g = this.glows[i++], ph = (t * 0.35 + k * 0.137) % 1, X = -11 + ((k * 7.3) % 22);
        g.visible = true;
        const up = k % 2 ? 1 : -1;
        g.position.set(X + Math.sin(t * 2 + k) * 0.3, bend(X) + up * (HB + ph * 2.2), -1.5 + (k % 3) * 1.2);
        g.material.color.set("#fb923c"); g.material.opacity = 0.45 * M.heat * (1 - ph); g.scale.setScalar(1.6 + ph * 1.4);
      }
    }
    for (; i < this.glows.length; i++) this.glows[i].visible = false;
  }

  updateLabels(dt, ui) {
    const R = REF, M = this.M, v = this.tv, L = this.lbl, show = ui.labels;
    const names = ui.names;
    const set = (el, html) => { if (el._h !== html) { el.innerHTML = html; el._h = html; } };
    const put = (el, html, pos, dy = 0) => { if (!show || !html) { el.style.display = "none"; return; } set(el, html); this.place(el, pos, 0, dy); };
    put(L.I, names.I, P(R.x1 - 10, R.top - 40, Z0));
    put(L.II, names.II, P(R.x2, R.bot + 52, Z0));
    put(L.III, names.III, P(R.x3, R.top - 44, Z0));
    put(L.IV, names.IV, P(R.x4 + 6, R.bot + 44, Z0));
    put(L.Q, names.Q, this.qIdle[1].position.clone().setY(this.qIdle[1].position.y + 0.55));
    put(L.cytc, names.cytc, this.cIdle[0].position.clone().setY(this.cIdle[0].position.y + 0.55));
    const synTop = this.syn.localToWorld(v.set(0, 1.5, 0)); this.world.worldToLocal(synTop);
    put(L.syn, names.syn, synTop);
    put(L.F0, names.F0, this.world.worldToLocal(this.syn.localToWorld(v.set(-1.15, 0, 0))));
    put(L.F1, names.F1, this.world.worldToLocal(this.syn.localToWorld(v.set(-1.25, this.f1y, 0))));
    put(L.ims, names.ims, this.tv.set(-9.5, bend(-9.5) + HB + 3.0, Z0));
    put(L.matrix, names.matrix, this.tv.set(-9.5, bend(-9.5) - HB - 3.6, Z0));
    // crank prompt (always shown until first grab)
    const cr = this.world.worldToLocal(this.syn.localToWorld(v.set(0, this.f1y - 1.45, this.ringR * 0.7)));
    if (ui.crankText) { set(L.crank, ui.crankText); this.place(L.crank, cr); } else L.crank.style.display = "none";
    // warnings
    let warn = "";
    if (M.queueN >= 4) warn = ui.warnBacked;
    if (warn) { set(L.warn, warn); this.place(L.warn, P((R.x3 + R.x4) / 2, R.top - 70, Z0)); } else L.warn.style.display = "none";
    if (M.heat > 0.3) { set(L.heat, ui.heatText); this.place(L.heat, P((R.x4 + R.x5) / 2 - 40, R.top - 95, Z0)); } else L.heat.style.display = "none";
    // floaters
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      if (f.life <= 0 || !show) { f.el.remove(); this.floaters.splice(i, 1); continue; }
      f.el.style.opacity = String(clamp(f.life * 1.5, 0, 1));
      this.place(f.el, f.p);
    }
  }

  dispose() { this.labelLayer.remove(); }
}
