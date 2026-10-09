// 3D scene for the cell-division level. Pure view: it turns MitosisModel.pose() into geometry each frame.
// Everything inside `world` is in micrometres; world.scale = SCALE, so 1 scene unit = 0.1 µm (metersPerUnit 1e-7).
//   chromatids: 8 tubes rebuilt every frame (interphase tangle ⇄ condensed rod, V-shaped in anaphase)
//   microtubules: one InstancedMesh (kinetochore fibres, dynamic search/astral MTs with growing/shrinking tips,
//                 interpolar MTs, plant cortical array → preprophase band, phragmoplast)
//   kinetochores (+ "wait" glow), cohesin rings, separase/securin, nuclear envelope (glass + fragments),
//   plant: wall, cell plate (clipped to the wall), Golgi stacks + vesicles; animal: deformable membrane, centrosomes, contractile ring.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { physical, glass, softDot, hash } from "../../assets/js/world/materials.js";
import { CHR3, SLOTS, NUC_R, NUC_R2, PLANT, ANIMAL, CHR_R, FIBRE_R, ORIGINS, I } from "./model.js";

export const SCALE = 10;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const SEG = 96, RAD = 10;
const UP = new THREE.Vector3(0, 1, 0), ZAX = new THREE.Vector3(0, 0, 1);

// MT pool layout
const N_KF = 32, N_DYN = 40, N_IP = 20, N_AST = 32, N_CORT = 72, N_PHR = 56;
const O_KF = 0, O_DYN = O_KF + N_KF, O_IP = O_DYN + N_DYN, O_AST = O_IP + N_IP, O_CORT = O_AST + N_AST, O_PHR = O_CORT + N_CORT;
const N_MT = O_PHR + N_PHR;
const N_TIP = N_DYN + N_AST;

/** point + tangent on a rounded rectangle (y–z cross-section), t in [0,1) */
function rrPoint(t, hy, hz, rc, out) {
  const sy = hy - rc, sz = hz - rc;
  const L = [2 * sz, (Math.PI / 2) * rc, 2 * sy, (Math.PI / 2) * rc, 2 * sz, (Math.PI / 2) * rc, 2 * sy, (Math.PI / 2) * rc];
  const tot = L.reduce((a, b) => a + b, 0);
  let d = (((t % 1) + 1) % 1) * tot, k = 0;
  while (d > L[k]) { d -= L[k]; k++; }
  const f = d / L[k];
  // start at (y = hy, z = -sz) going +z
  let y, z, ty, tz;
  if (k === 0) { y = hy; z = -sz + 2 * sz * f; ty = 0; tz = 1; }
  else if (k === 2) { z = hz; y = sy - 2 * sy * f; ty = -1; tz = 0; }
  else if (k === 4) { y = -hy; z = sz - 2 * sz * f; ty = 0; tz = -1; }
  else if (k === 6) { z = -hz; y = -sy + 2 * sy * f; ty = 1; tz = 0; }
  else {
    const cy = k === 1 || k === 7 ? sy : -sy, cz = k === 1 || k === 3 ? sz : -sz;
    const a0 = k === 1 ? Math.PI / 2 : k === 3 ? 0 : k === 5 ? -Math.PI / 2 : Math.PI;
    const a = a0 - f * (Math.PI / 2);
    y = cy + rc * Math.sin(a); z = cz + rc * Math.cos(a);
    ty = -Math.cos(a); tz = Math.sin(a);
  }
  out[0] = y; out[1] = z; out[2] = ty; out[3] = tz;
  return out;
}

export class Scene3D {
  constructor(engine) {
    this.engine = engine;
    this.root = new THREE.Group();
    const W = (this.world = new THREE.Group());
    W.scale.setScalar(SCALE);
    this.root.add(W);
    this.pickables = [];
    this.fallback = [];
    this.cellType = null;
    this.mtsOn = true;
    this.t = 0;
    const v1 = (this.v1 = new THREE.Vector3()), v2 = (this.v2 = new THREE.Vector3()), v3 = (this.v3 = new THREE.Vector3());
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s3 = new THREE.Vector3(); this.col = new THREE.Color();
    void v1; void v2; void v3;
    this.rr = [0, 0, 0, 0];
    const tag = (o, kind, extra = {}) => { Object.assign(o.userData, { kind }, extra); return o; };
    this.tag = tag;

    // ---------- chromatids ----------
    this.chromatids = [];
    const idx = [];
    for (let i = 0; i < SEG; i++) for (let j = 0; j < RAD; j++) { const a = i * (RAD + 1) + j, b = a + RAD + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    for (let i = 0; i < 4; i++) for (let s = 0; s < 2; s++) {
      const C = CHR3[i];
      const g = new THREE.BufferGeometry();
      const n = (SEG + 1) * (RAD + 1);
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
      const col = new Float32Array(n * 3), base = new THREE.Color(C.mat ? "#e8458f" : "#3b82f6"), dark = base.clone().multiplyScalar(0.45), tip = base.clone().lerp(new THREE.Color("#ffffff"), 0.45), c = new THREE.Color();
      for (let k = 0; k <= SEG; k++) {
        const u = k / SEG;
        const cen = Math.exp(-(((u - C.cpos) / 0.035) ** 2));
        c.copy(base).lerp(dark, cen * 0.8);
        // faint G-band-like stripes so the two pairs read as different chromosomes
        c.multiplyScalar(0.86 + 0.14 * Math.sin(u * (C.pair === 1 ? 46 : 33) + C.seed));
        if (u < 0.02 || u > 0.98) c.lerp(tip, 0.6);
        for (let j = 0; j <= RAD; j++) { const q = (k * (RAD + 1) + j) * 3; col[q] = c.r; col[q + 1] = c.g; col[q + 2] = c.b; }
      }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      g.setIndex(idx);
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);
      const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.4, sheen: 0.25, sheenRoughness: 0.6, sheenColor: new THREE.Color(C.col), emissive: new THREE.Color(C.col), emissiveIntensity: 0.08 });
      const m = new THREE.Mesh(g, mat);
      m.frustumCulled = false;
      tag(m, "chromatid", { chr: i, sis: s });
      W.add(m);
      this.chromatids.push({ mesh: m, i, s, cl: new Float32Array((SEG + 1) * 3), r: new Float32Array(SEG + 1) });
    }

    // ---------- kinetochores (+ invisible, generous hit spheres) ----------
    this.kt = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 18), new THREE.MeshStandardMaterial({ roughness: 0.4, emissive: "#ffffff", emissiveIntensity: 0.35 }), 8);
    this.kt.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(24), 3);
    tag(this.kt, "kinetochore");
    this.kt.frustumCulled = false;
    W.add(this.kt);
    this.ktHit = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ visible: false }), 8);
    tag(this.ktHit, "kinetochore");
    this.ktHit.frustumCulled = false;
    W.add(this.ktHit);
    this.ktPos = Array.from({ length: 8 }, () => new THREE.Vector3());
    this.ktShown = false;
    // "wait" signal glows (unattached kinetochores)
    this.wait = [];
    for (let k = 0; k < 8; k++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: "#fbbf24", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.visible = false; W.add(sp); this.wait.push(sp);
    }

    // ---------- cohesin rings ----------
    this.cohU = CHR3.map((c) => [c.cpos, c.cpos - 0.2, c.cpos + 0.2, Math.max(0.06, c.cpos - 0.4), Math.min(0.94, c.cpos + 0.4)]);
    this.coh = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.11, 8, 28), physical("#fb923c", { emissive: new THREE.Color("#fb923c"), emissiveIntensity: 0.35 }), 20);
    tag(this.coh, "cohesin");
    this.coh.frustumCulled = false;
    W.add(this.coh);
    this.cohFlash = [];
    for (let i = 0; i < 4; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: "#fde68a", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.visible = false; W.add(sp); this.cohFlash.push(sp);
    }

    // ---------- separase (+ securin) ----------
    this.sepHome = Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * TAU + 0.3; return new THREE.Vector3((hash(k + 3) - 0.5) * 5, Math.cos(a) * 6.2, Math.sin(a) * 6.2); });
    this.sep = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.28, 1), physical("#fb7185", { emissive: new THREE.Color("#fb7185"), emissiveIntensity: 0.2 }), 8);
    this.sec = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.18, 1), physical("#94a3b8"), 8);
    tag(this.sep, "separase"); tag(this.sec, "separase");
    this.sep.frustumCulled = this.sec.frustumCulled = false;
    W.add(this.sep, this.sec);

    // ---------- microtubules ----------
    const mtGeo = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true); mtGeo.translate(0, 0.5, 0);
    this.mt = new THREE.InstancedMesh(mtGeo, new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.8, depthWrite: false }), N_MT);
    this.mt.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N_MT * 3), 3);
    tag(this.mt, "mt");
    this.mt.frustumCulled = false;
    W.add(this.mt);
    this.tips = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: "#ffffff" }), N_TIP);
    this.tips.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N_TIP * 3), 3);
    this.tips.frustumCulled = false;
    W.add(this.tips);
    // dynamic-instability state for DYN + AST microtubules
    this.dyn = Array.from({ length: N_TIP }, (_, k) => ({ len: hash(k * 7.1) * 3, grow: hash(k * 3.3) > 0.4, dir: new THREE.Vector3(), base: new THREE.Vector3(), max: 6, seed: k }));
    this.mtCol = { kf: new THREE.Color("#5eead4"), kfT: new THREE.Color("#99f6e4"), dyn: new THREE.Color("#67e8f9"), ip: new THREE.Color("#2dd4bf"), ast: new THREE.Color("#5eead4"), cort: new THREE.Color("#86efac"), phr: new THREE.Color("#6ee7b7"), grow: new THREE.Color("#ecfeff"), shrink: new THREE.Color("#fb7185"), taxol: new THREE.Color("#a5b4fc") };
    // motor proteins: kinesin-5 at the interpolar overlap + kinetochore motors
    this.motors = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.17, 1), physical("#c4b5fd", { emissive: new THREE.Color("#c4b5fd"), emissiveIntensity: 0.4 }), 18);
    this.motors.frustumCulled = false;
    tag(this.motors, "motor");
    W.add(this.motors);

    // ---------- nucleus ----------
    this.ne = new THREE.Mesh(new THREE.SphereGeometry(NUC_R, 48, 32), glass("#a78bfa", { rim: "#c4b5fd", maxAlpha: 0.55, minAlpha: 0.05 }));
    tag(this.ne, "nucleus"); W.add(this.ne);
    this.ne2 = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), glass("#a78bfa", { rim: "#c4b5fd", maxAlpha: 0.55, minAlpha: 0.05 })); tag(m, "nucleus"); W.add(m); return m; });
    // fragments for breakdown / re-formation
    const NF = 64;
    this.frag = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6), physical("#a78bfa", { transparent: true, opacity: 0.55, depthWrite: false, emissive: new THREE.Color("#7c3aed"), emissiveIntensity: 0.2 }), NF);
    this.frag.frustumCulled = false;
    W.add(this.frag);
    this.fragDir = Array.from({ length: NF }, (_, k) => {
      const y = 1 - (2 * (k + 0.5)) / NF, r = Math.sqrt(1 - y * y), a = k * 2.399963;
      return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    });
    this.nucleolus = new THREE.Mesh(new THREE.SphereGeometry(1.15, 24, 16), physical("#7c5cc4", { emissive: new THREE.Color("#5b21b6"), emissiveIntensity: 0.25 }));
    this.nucleolus.position.set(1.9, -1.6, 1.4);
    tag(this.nucleolus, "nucleolus"); W.add(this.nucleolus);
    this.nucleoli2 = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.8, 20, 14), this.nucleolus.material); tag(m, "nucleolus"); W.add(m); return m; });

    // ---------- replication forks + DNA damage ----------
    const pts = (n, col, size) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
      const p = new THREE.Points(g, new THREE.PointsMaterial({ size, map: softDot(), color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
      p.frustumCulled = false; W.add(p); return p;
    };
    this.forks = pts(4 * ORIGINS * 2, "#fde68a", 1.1);
    this.dmg = pts(10, "#ef4444", 1.6);
    this.dmgU = Array.from({ length: 10 }, (_, k) => [k % 4, 0.12 + 0.76 * hash(k * 5.3)]);

    // ---------- metaphase plate guide ----------
    this.plateGuide = new THREE.Group();
    const pg = new THREE.Mesh(new THREE.CircleGeometry(4.6, 48), new THREE.MeshBasicMaterial({ color: "#fbbf24", transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide }));
    pg.rotation.y = Math.PI / 2;
    const pr = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.05, 6, 64), new THREE.MeshBasicMaterial({ color: "#fbbf24", transparent: true, opacity: 0.6 }));
    pr.rotation.y = Math.PI / 2;
    this.plateGuide.add(pg, pr);
    this.slotRings = SLOTS.map((sl) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.05, 6, 32), new THREE.MeshBasicMaterial({ color: "#fde68a", transparent: true, opacity: 0.8 }));
      m.position.set(...sl.c); m.rotation.y = Math.PI / 2; this.plateGuide.add(m); return m;
    });
    this.plateGuide.visible = false;
    W.add(this.plateGuide);

    // ---------- shared cytoplasm ----------
    this.mitos = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.45, 1.3, 6, 12), physical("#fb923c", { emissive: new THREE.Color("#f97316"), emissiveIntensity: 0.3 }), 8);
    tag(this.mitos, "mito");
    this.mitos.frustumCulled = false;
    W.add(this.mitos);
    this.mitoBase = Array.from({ length: 8 }, (_, k) => [((k % 2 ? 1 : -1) * (0.45 + 0.4 * hash(k + 11))), (hash(k * 2.7) - 0.5) * 1.5, (hash(k * 4.1) - 0.5) * 1.5, hash(k * 9.1) * TAU]);
    const NS = 200;
    this.specks = pts(NS, "#bae6fd", 0.35);
    this.specks.material.vertexColors = false;
    this.specks.material.opacity = 0.45;
    this.speckBase = Array.from({ length: NS }, (_, k) => [hash(k * 1.3) * 2 - 1, hash(k * 2.9) * 2 - 1, hash(k * 5.7) * 2 - 1]);

    // ---------- plant parts ----------
    const P = PLANT;
    this.plant = new THREE.Group();
    this.wall = new THREE.Mesh(new RoundedBoxGeometry(2 * P.hx + 1, 2 * P.hy + 1, 2 * P.hz + 1, 4, 2.4), glass("#86efac", { rim: "#bbf7d0", maxAlpha: 0.4, minAlpha: 0.02, rimStrength: 0.45, side: THREE.BackSide }));
    tag(this.wall, "wall");
    this.plant.add(this.wall);
    this.wallEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new RoundedBoxGeometry(2 * P.hx + 1, 2 * P.hy + 1, 2 * P.hz + 1, 2, 2.4), 30), new THREE.LineBasicMaterial({ color: "#4ade80", transparent: true, opacity: 0.25 }));
    this.plant.add(this.wallEdge);
    const clip = [new THREE.Plane(new THREE.Vector3(0, -1, 0), (P.hy + 0.2) * SCALE), new THREE.Plane(new THREE.Vector3(0, 1, 0), (P.hy + 0.2) * SCALE), new THREE.Plane(new THREE.Vector3(0, 0, -1), (P.hz + 0.2) * SCALE), new THREE.Plane(new THREE.Vector3(0, 0, 1), (P.hz + 0.2) * SCALE)];
    this.plateMat = physical("#bef264", { transparent: true, opacity: 0.85, clippingPlanes: clip, emissive: new THREE.Color("#65a30d"), emissiveIntensity: 0.25, side: THREE.DoubleSide });
    this.cellPlate = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.28, 72), this.plateMat);
    this.cellPlate.rotation.z = Math.PI / 2;
    tag(this.cellPlate, "plate");
    this.plant.add(this.cellPlate);
    // cortical division zone marker (the PPB's "memory" on the wall)
    const cdzPts = [];
    for (let k = 0; k < 96; k++) { rrPoint(k / 96, P.hy - 0.1, P.hz - 0.1, 2.3, this.rr); cdzPts.push(new THREE.Vector3(0, this.rr[0], this.rr[1])); }
    this.cdz = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cdzPts, true), 120, 0.09, 5, true), new THREE.MeshBasicMaterial({ color: "#86efac", transparent: true, opacity: 0.28, depthWrite: false }));
    tag(this.cdz, "ppb");
    this.plant.add(this.cdz);
    // Golgi stacks + vesicles
    this.golgiPos = [[-8.6, 4.2, -3.6], [-9.0, -4.6, 3.8], [-5.0, 6.8, 4.6], [8.4, 4.8, 3.2], [9.2, -4.2, -3.8], [5.2, -6.8, -4.4]].map((p) => new THREE.Vector3(...p));
    this.golgi = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 24), physical("#f472b6", { emissive: new THREE.Color("#be185d"), emissiveIntensity: 0.2 }), 24);
    tag(this.golgi, "golgi");
    {
      let n = 0;
      for (const gp of this.golgiPos) {
        const q = new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(hash(n) - 0.5, 1, hash(n + 1) - 0.5).normalize());
        for (let c = 0; c < 4; c++) {
          const r = 1.15 - Math.abs(c - 1.5) * 0.18;
          this.golgi.setMatrixAt(n++, this.m4.compose(gp.clone().add(new THREE.Vector3(0, (c - 1.5) * 0.3, 0).applyQuaternion(q)), q, this.s3.set(r, 0.12, r * 0.75)));
        }
      }
    }
    this.plant.add(this.golgi);
    const NV = 64;
    this.ves = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 10, 8), physical("#f9a8d4", { emissive: new THREE.Color("#f472b6"), emissiveIntensity: 0.45 }), NV);
    this.ves.frustumCulled = false;
    tag(this.ves, "vesicle");
    this.plant.add(this.ves);
    this.vesS = Array.from({ length: NV }, (_, k) => ({ t: hash(k * 3.7), g: k % 6, a: hash(k * 1.9) * TAU, sp: 0.35 + 0.3 * hash(k * 8.3) }));
    this.polarCaps = [0, 1].map(() => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: "#5eead4", transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })); sp.scale.setScalar(4); this.plant.add(sp); return sp; });
    W.add(this.plant);

    // ---------- animal parts ----------
    this.animal = new THREE.Group();
    const sg = new THREE.SphereGeometry(1, 72, 48);
    this.memBase = sg.attributes.position.array.slice();
    this.mem = new THREE.Mesh(sg, glass("#4fd1c5", { rim: "#99f6e4", maxAlpha: 0.5, minAlpha: 0.04 }));
    this.mem.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
    tag(this.mem, "membrane");
    this.animal.add(this.mem);
    this.memKey = "";
    this.ringMesh = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 10, 96), physical("#f87171", { emissive: new THREE.Color("#ef4444"), emissiveIntensity: 0.6 }));
    this.ringMesh.rotation.y = Math.PI / 2;
    tag(this.ringMesh, "ring");
    this.animal.add(this.ringMesh);
    this.myo = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.2, 1), physical("#fca5a5", { emissive: new THREE.Color("#f87171"), emissiveIntensity: 0.5 }), 20);
    this.myo.frustumCulled = false;
    tag(this.myo, "ring");
    this.animal.add(this.myo);
    // centrosomes: two orthogonal centrioles in a glowing cloud
    this.centro = [0, 1].map(() => {
      const g = new THREE.Group();
      const cm = physical("#fbbf24", { emissive: new THREE.Color("#f59e0b"), emissiveIntensity: 0.5 });
      const c1 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.7, 9), cm);
      const c2 = c1.clone(); c2.rotation.x = Math.PI / 2; c2.position.set(0.25, 0.3, 0);
      const cloud = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: "#fbbf24", transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
      cloud.scale.setScalar(3);
      tag(c1, "pole"); tag(c2, "centriole");
      g.add(c1, c2, cloud);
      this.animal.add(g);
      return g;
    });
    W.add(this.animal);

    // selection glow
    this.selGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: "#fde68a", transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.selGlow.visible = false;
    W.add(this.selGlow);

    for (const o of [this.mt, this.tips]) o.renderOrder = 2;
  }

  setCellType(type) {
    if (type === this.cellType) return;
    this.cellType = type;
    this.plant.visible = type === "plant";
    this.animal.visible = type === "animal";
    for (const d of this.dyn) { d.len = 0; d.grow = true; }
  }

  // ---------- cell geometry helpers ----------
  /** map a base point in [-1,1]³ into the current cell (µm) */
  cellPoint(o, b, out) {
    if (this.cellType === "plant") return out.set(b[0] * (PLANT.hx - 1.2), b[1] * (PLANT.hy - 1.2), b[2] * (PLANT.hz - 1.2));
    const R = ANIMAL.R * 0.82;
    let x = b[0] * R * o.a;
    const rho = Math.hypot(b[1], b[2]) || 1e-6;
    const sig = 0.2 * o.a * ANIMAL.R;
    const pinch = 1 - o.f * Math.exp(-(x * x) / (2 * sig * sig));
    let r = rho * R * o.b * Math.max(0.05, pinch);
    if (o.split) {
      const side = x < 0 ? -1 : 1, dc = side * (o.dcx + o.g * ANIMAL.R);
      x += side * o.g * ANIMAL.R;
      const an = Math.atan2(r, x - dc), m = Math.hypot(x - dc, r), lim = ANIMAL.R * 0.62 * Math.min(1, rho + Math.abs(b[0]) * 0.5);
      const k = m > lim ? lim / m : 1;
      x = lerp(x, dc + (x - dc) * k, o.round); r = lerp(r, r * k, o.round);
      void an;
    }
    return out.set(x, (b[1] / rho) * r, (b[2] / rho) * r);
  }

  updateMembrane(o) {
    const key = `${o.a.toFixed(3)}|${o.b.toFixed(3)}|${o.f.toFixed(3)}|${o.round.toFixed(3)}|${o.g.toFixed(3)}|${o.split}`;
    if (key === this.memKey) return;
    this.memKey = key;
    const pos = this.mem.geometry.attributes.position, A = pos.array, B = this.memBase, R = ANIMAL.R;
    const sig = 0.2 * o.a * R, RD = R * 0.75;
    for (let i = 0; i < pos.count; i++) {
      const bx = B[i * 3], by = B[i * 3 + 1], bz = B[i * 3 + 2];
      let x = bx * R * o.a;
      const rho0 = Math.hypot(by, bz);
      let r = rho0 * R * o.b * (1 - o.f * Math.exp(-(x * x) / (2 * sig * sig)));
      if (o.split) {
        const side = x < 0 || (x === 0 && i % 2) ? -1 : 1, dc = side * (o.dcx + o.g * R);
        x += side * o.g * R;
        const an = Math.atan2(r, x - dc);
        x = lerp(x, dc + RD * Math.cos(an), o.round); r = lerp(r, RD * Math.sin(an), o.round);
      }
      const k = rho0 > 1e-6 ? r / rho0 : 0;
      A[i * 3] = x; A[i * 3 + 1] = by * k; A[i * 3 + 2] = bz * k;
    }
    pos.needsUpdate = true;
    this.mem.geometry.computeVertexNormals();
    this.mem.geometry.computeBoundingSphere();
  }

  // ---------- chromatid centrelines ----------
  tangle(i, s, u, tc, sc, out) {
    const C = CHR3[i], p = C.seed, A = 1.9 * sc * (C.pair === 1 ? 1 : 0.8);
    out.set(
      A * (0.55 * Math.sin(TAU * 2.3 * u + p) + 0.33 * Math.sin(TAU * 5.7 * u + p * 1.7) + 0.14 * Math.sin(TAU * 13 * u + p * 2.3)),
      A * (0.6 * Math.cos(TAU * 1.9 * u + p * 0.6) + 0.33 * Math.sin(TAU * 6.3 * u + p * 2.9) + 0.14 * Math.cos(TAU * 11 * u + p * 1.1)),
      A * 0.8 * (0.5 * Math.sin(TAU * 2.9 * u + p * 3.1) + 0.33 * Math.cos(TAU * 4.9 * u + p * 0.4) + 0.14 * Math.sin(TAU * 12 * u + p * 1.9)));
    out.x += tc[0]; out.y += tc[1]; out.z += tc[2];
    if (s) { const w = u * 70 + p; out.x += 0.16 * Math.sin(w); out.y += 0.16 * Math.cos(w); out.z += 0.1 * Math.sin(w * 0.7); }
    return out;
  }

  buildChromatid(ch, o, M) {
    const { i, s, cl, r } = ch;
    const C = CHR3[i], P = o.chr[i], si = P.sis[s];
    const w = 1 - P.tangleW, L = C.len, cond = o.cond;
    const tv = this.v1, rv = this.v2;
    const K = si.K, a = P.a, tr = si.trail, kn = si.kn;
    const rep = P.rep;
    const repHalf = rep * (0.5 / ORIGINS) + (rep >= 1 ? 0.01 : 0);
    for (let k = 0; k <= SEG; k++) {
      const u = k / SEG;
      this.tangle(i, s, u, si.tc, si.tScale, tv);
      const sa = (u - C.cpos) * L, d = Math.abs(sa), sg = sa < 0 ? -1 : 1;
      const th = si.bend * 1.25 * (d / (d + 0.8));
      const ct = Math.cos(th), st = Math.sin(th), spl = 0.06 * d * (1 - si.bend);
      const wig = 0.06 * Math.sin(u * 9 + C.seed + s);
      rv.set(
        K[0] + a[0] * sg * d * ct + tr[0] * d * st + kn[0] * spl + wig * a[1],
        K[1] + a[1] * sg * d * ct + tr[1] * d * st + kn[1] * spl + wig * a[2],
        K[2] + a[2] * sg * d * ct + tr[2] * d * st + kn[2] * spl + wig * a[0]);
      tv.lerp(rv, w);
      cl[k * 3] = tv.x; cl[k * 3 + 1] = tv.y; cl[k * 3 + 2] = tv.z;
      // radius: fibre → chromatid, tapered tips, pinched centromere, hidden where not yet replicated (sister 1)
      const taper = Math.sqrt(clamp(u / 0.03, 0.05, 1)) * Math.sqrt(clamp((1 - u) / 0.03, 0.05, 1));
      let rr = lerp(FIBRE_R, CHR_R, cond) * taper * (1 - 0.42 * cond * Math.exp(-(((u - C.cpos) / 0.03) ** 2)));
      if (s === 1 && rep < 1) {
        let m = 0;
        for (let j = 0; j < ORIGINS; j++) { const oj = (j + 0.5) / ORIGINS; m = Math.max(m, clamp((repHalf - Math.abs(u - oj)) / 0.01, 0, 1)); }
        rr *= m;
      }
      r[k] = Math.max(rr, 0.0005);
    }
    // tube from parallel-transported frames
    const pos = ch.mesh.geometry.attributes.position.array, nor = ch.mesh.geometry.attributes.normal.array;
    const T = this.v1, N = this.v2, B = this.v3;
    N.set(0, 0, 1);
    for (let k = 0; k <= SEG; k++) {
      const k0 = Math.max(0, k - 1), k1 = Math.min(SEG, k + 1);
      T.set(cl[k1 * 3] - cl[k0 * 3], cl[k1 * 3 + 1] - cl[k0 * 3 + 1], cl[k1 * 3 + 2] - cl[k0 * 3 + 2]);
      if (T.lengthSq() < 1e-12) T.set(1, 0, 0);
      T.normalize();
      N.addScaledVector(T, -N.dot(T));
      if (N.lengthSq() < 1e-6) { N.set(T.y, -T.x, 0); if (N.lengthSq() < 1e-6) N.set(0, T.z, -T.y); }
      N.normalize();
      B.crossVectors(T, N);
      const rr = r[k];
      for (let j = 0; j <= RAD; j++) {
        const an = (j / RAD) * TAU, cx = Math.cos(an), sx = Math.sin(an);
        const q = (k * (RAD + 1) + j) * 3;
        const nx = N.x * cx + B.x * sx, ny = N.y * cx + B.y * sx, nz = N.z * cx + B.z * sx;
        pos[q] = cl[k * 3] + nx * rr; pos[q + 1] = cl[k * 3 + 1] + ny * rr; pos[q + 2] = cl[k * 3 + 2] + nz * rr;
        nor[q] = nx; nor[q + 1] = ny; nor[q + 2] = nz;
      }
    }
    ch.mesh.geometry.attributes.position.needsUpdate = true;
    ch.mesh.geometry.attributes.normal.needsUpdate = true;
    ch.mesh.visible = !(s === 1 && rep <= 0);
  }

  /** point on chromatid (i,s) centreline at u (after buildChromatid) */
  clAt(i, s, u, out) {
    const cl = this.chromatids[i * 2 + s].cl, f = clamp(u, 0, 1) * SEG, k = Math.min(SEG - 1, Math.floor(f)), t = f - k;
    return out.set(lerp(cl[k * 3], cl[k * 3 + 3], t), lerp(cl[k * 3 + 1], cl[k * 3 + 4], t), lerp(cl[k * 3 + 2], cl[k * 3 + 5], t));
  }

  // ---------- microtubules ----------
  setMT(idx, ax, ay, az, bx, by, bz, rad, col) {
    const d = this.v3.set(bx - ax, by - ay, bz - az), len = d.length();
    if (len < 0.02 || rad <= 0) { this.mt.setMatrixAt(idx, this.zeroM); return; }
    d.divideScalar(len);
    this.q.setFromUnitVectors(UP, d);
    this.mt.setMatrixAt(idx, this.m4.compose(this.v2.set(ax, ay, az), this.q, this.s3.set(rad, len, rad)));
    this.mt.setColorAt(idx, col);
  }
  hideMT(a, b) { for (let k = a; k < b; k++) this.mt.setMatrixAt(k, this.zeroM); }

  /** dynamic-instability MTs (search MTs from poles, astral / interphase arrays): grow, catastrophe, shrink, rescue */
  stepDynamic(d, dt, M, active, reseed) {
    const vg = 2.6, vs = 7, fc = M.taxol ? 0 : 0.22, fr = 0.12;
    if (!active || !M.mtsOK) { d.grow = false; d.len = Math.max(0, d.len - vs * 1.5 * dt); return; }
    if (d.len <= 0.05 && !d.grow) { reseed(d); d.grow = true; d.len = 0.05; }
    if (d.grow) {
      d.len += vg * dt * (M.taxol ? 0.6 : 1);
      if (d.len >= d.max) { d.len = d.max; if (!M.taxol) d.grow = false; }
      else if (Math.random() < fc * dt) d.grow = false;
    } else {
      if (M.taxol) { d.grow = true; return; }      // stabilised lattice can't depolymerise
      d.len -= vs * dt;
      if (d.len > 0.5 && Math.random() < fr * dt) d.grow = true;
      if (d.len < 0) d.len = 0;
    }
  }

  // ---------- per-frame ----------
  update(o, M, dt, t, opts) {
    this.t = t;
    this.zeroM ||= new THREE.Matrix4().makeScale(0, 0, 0);
    const plant = this.cellType === "plant";
    const k = o.k, W = this.world;
    const pick = this.pickables, fb = this.fallback;
    pick.length = 0; fb.length = 0;

    // chromatids
    for (const ch of this.chromatids) {
      this.buildChromatid(ch, o, M);
      if (ch.mesh.visible) pick.push(ch.mesh);
      const sel = opts.highlight === ch.i;
      ch.mesh.material.emissiveIntensity = sel ? 0.45 + 0.15 * Math.sin(t * 6) : 0.08 + (o.cond < 0.3 ? 0.12 : 0);
    }

    // nucleus + fragments
    this.ne.visible = o.env > 0.02;
    this.ne.material.opacity = o.env;
    if (this.ne.visible && o.env > 0.5) fb.push(this.ne);
    const dcx = o.dcx, restit = o.restit;
    const dR = restit ? NUC_R * 1.05 : NUC_R2;
    this.ne2.forEach((m, j) => {
      m.visible = o.ref > 0.02 && (!restit || j === 0);
      m.position.set(restit ? 0 : (j ? 1 : -1) * dcx + (o.split ? (j ? 1 : -1) * o.g * ANIMAL.R : 0), 0, 0);
      m.scale.setScalar(dR * lerp(1.12, 1, o.ref));
      m.material.opacity = o.ref;
      if (m.visible && o.ref > 0.6) fb.push(m);
    });
    const brk = k === I.prometa ? 1 - o.env : 0, refm = k === I.telo ? o.ref : 0;
    const showFrag = (brk > 0 && brk < 1) || (refm > 0 && refm < 1) || (k === I.prometa && o.p < 0.6);
    this.frag.visible = showFrag;
    if (showFrag) {
      for (let f = 0; f < this.fragDir.length; f++) {
        const dir = this.fragDir[f];
        let px, py, pz, sc;
        if (k === I.prometa) {
          const b = clamp(brk * 1.4 - hash(f) * 0.4, 0, 1), rr = NUC_R + b * (2 + 4 * hash(f * 3.1));
          px = dir.x * rr; py = dir.y * rr; pz = dir.z * rr; sc = lerp(1.25, 0.35, b) * (1 - clamp((o.p - 0.45) / 0.15, 0, 1));
        } else {
          const side = restit ? 0 : f % 2 ? 1 : -1, b = clamp(refm * 1.3 - hash(f) * 0.3, 0, 1);
          const cx = side * dcx, rr = lerp(dR + 3 + 3 * hash(f * 3.1), dR, b);
          px = cx + dir.x * rr; py = dir.y * rr; pz = dir.z * rr; sc = lerp(0.35, 1.0, b) * (1 - clamp((refm - 0.85) / 0.15, 0, 1));
        }
        this.v1.set(px, py, pz);
        this.q.setFromUnitVectors(ZAX, this.v2.copy(dir));
        this.frag.setMatrixAt(f, this.m4.compose(this.v1, this.q, this.s3.set(sc, sc, sc * 0.16)));
      }
      this.frag.instanceMatrix.needsUpdate = true;
    }
    this.nucleolus.visible = o.nucleolus > 0.02;
    this.nucleolus.scale.setScalar(Math.max(0.01, 0.4 + 0.6 * o.nucleolus));
    this.nucleoli2.forEach((m, j) => {
      m.visible = o.nucleolus2 > 0.02 && (!restit || j < 2);
      const cx = restit ? (j ? 1.6 : -1.4) : (j ? 1 : -1) * dcx + (o.split ? (j ? 1 : -1) * o.g * ANIMAL.R : 0);
      m.position.set(cx + 0.9, -0.9, 0.8);
      m.scale.setScalar(Math.max(0.01, o.nucleolus2));
    });
    if (this.nucleolus.visible) pick.push(this.nucleolus);

    // poles
    const P0 = o.poles[0], P1 = o.poles[1], spread = o.poleSpread;

    // kinetochores
    const showKT = M.kinetochoresUp && k < I.telo && o.cond > 0.6;
    this.ktShown = showKT;
    this.kt.visible = this.ktHit.visible = showKT;
    let nWait = 0;
    for (let i = 0; i < 4; i++) for (let s = 0; s < 2; s++) {
      const id = i * 2 + s, si = o.chr[i].sis[s];
      const kp = this.ktPos[id].set(si.K[0] + si.kn[0] * (CHR_R + 0.04), si.K[1] + si.kn[1] * (CHR_R + 0.04), si.K[2] + si.kn[2] * (CHR_R + 0.04));
      this.q.setFromUnitVectors(UP, this.v2.set(si.kn[0], si.kn[1], si.kn[2]));
      this.kt.setMatrixAt(id, this.m4.compose(kp, this.q, showKT ? this.s3.set(0.3, 0.13, 0.3) : this.s3.set(0, 0, 0)));
      this.ktHit.setMatrixAt(id, this.m4.compose(kp, this.q, this.s3.setScalar(showKT ? 0.95 : 0)));
      const att = M.att[i][s], tension = o.chr[i].tension;
      const waiting = showKT && k <= I.meta && !o.restit && (att < 0.95 || (M.taxol && att > 0.95));
      this.col.set(att < 0.95 ? "#fbbf24" : tension ? "#4ade80" : "#fde68a");
      if (att < 0.95) this.col.multiplyScalar(1.2 + 0.5 * Math.sin(t * 6 + id));
      this.kt.setColorAt(id, this.col);
      const ws = this.wait[id];
      ws.visible = waiting;
      if (waiting) {
        nWait++;
        ws.position.copy(kp);
        const pulse = 0.5 + 0.5 * Math.sin(t * 5 + id * 0.9);
        ws.scale.setScalar((M.taxol && att > 0.95 ? 1.1 : 1.8) + 0.8 * pulse);
        ws.material.opacity = (M.taxol && att > 0.95 ? 0.35 : 0.75) * (0.55 + 0.45 * pulse);
      }
    }
    this.nWait = nWait;
    this.kt.instanceMatrix.needsUpdate = true; this.kt.instanceColor.needsUpdate = true; this.ktHit.instanceMatrix.needsUpdate = true;
    if (showKT) pick.push(this.ktHit);

    // cohesin rings (between the sisters)
    let ci = 0;
    const flashOn = k === I.ana && o.sepase > 0.7 && o.s < 0.15;
    for (let i = 0; i < 4; i++) {
      const P = o.chr[i];
      for (let j = 0; j < 5; j++, ci++) {
        const u = this.cohU[i][j];
        let vis = j === 0 ? P.cohesin : P.cohesinArm * (P.rep >= 1 || Math.abs(u - 0.5) < P.rep * 0.5 ? 1 : 0);
        if (k === I.S && P.rep < 1) { let rep = false; for (let q = 0; q < ORIGINS; q++) if (Math.abs(u - (q + 0.5) / ORIGINS) < P.rep * (0.5 / ORIGINS)) rep = true; vis = rep ? 1 : 0; }
        if (vis <= 0.02 || P.rep <= 0) { this.coh.setMatrixAt(ci, this.zeroM); continue; }
        const a = this.clAt(i, 0, u, this.v1), b = this.clAt(i, 1, u, this.v2);
        const mid = this.v3.copy(a).add(b).multiplyScalar(0.5);
        const half = a.distanceTo(b) * 0.5;
        const ta = this.clAt(i, 0, Math.min(1, u + 0.01), this.v2).sub(a).normalize();
        this.q.setFromUnitVectors(ZAX, ta);
        const rad = (half + lerp(FIBRE_R, CHR_R, o.cond) * 0.95 + 0.04) * Math.sqrt(vis);
        this.coh.setMatrixAt(ci, this.m4.compose(mid, this.q, this.s3.set(rad, rad, Math.max(0.6, rad * 0.8))));
        if (j === 0) { const fl = this.cohFlash[i]; fl.visible = flashOn; if (flashOn) { fl.position.copy(mid); fl.scale.setScalar(2.4 * (1 - o.s / 0.15)); fl.material.opacity = 0.9; } }
      }
      if (!flashOn) this.cohFlash[i].visible = false;
      if (flashOn && P.cohesin > 0) this.cohFlash[i].visible = false;
    }
    this.coh.instanceMatrix.needsUpdate = true;
    this.coh.visible = opts.cohesinOn !== false && (k >= I.S && k <= I.ana || o.chr.some((c) => c.joined));
    if (this.coh.visible) pick.push(this.coh);

    // separase held by securin, released at anaphase onset
    const sepVis = k >= I.prometa && k <= I.ana && !(k === I.ana && o.s > 0.4) && !o.restit;
    this.sep.visible = this.sec.visible = sepVis;
    if (sepVis) {
      for (let q = 0; q < 8; q++) {
        const i = q >> 1, h = this.sepHome[q];
        const bob = engineReduced(this.engine) ? 0 : 0.3 * Math.sin(t * 1.3 + q);
        this.v1.set(h.x, h.y + bob, h.z);
        let secS = 0.9;
        if (k === I.ana) {
          const tgt = this.clAt(i, q & 1, CHR3[i].cpos, this.v2);
          const f = clamp(o.sepase * 1.05, 0, 1);
          this.v1.lerp(tgt, f * f * (3 - 2 * f));
          secS = Math.max(0, 1 - o.sepase * 3);
        }
        const sc = k === I.ana ? 1.25 : 0.85;
        this.sep.setMatrixAt(q, this.m4.compose(this.v1, this.q.identity(), this.s3.setScalar(sc)));
        this.v2.copy(this.v1).add(this.v3.set(0.3, 0.25, 0));
        this.sec.setMatrixAt(q, this.m4.compose(this.v2, this.q, this.s3.setScalar(secS)));
      }
      this.sep.instanceMatrix.needsUpdate = true; this.sec.instanceMatrix.needsUpdate = true;
      this.sep.material.emissiveIntensity = k === I.ana ? 0.9 : 0.15;
      pick.push(this.sep);
    }

    // ---------- microtubules ----------
    const mtsOn = this.mtsOn;
    const C = this.mtCol;
    const tub = M.taxol ? C.taxol : null;
    // kinetochore fibres
    for (let i = 0; i < 4; i++) for (let s = 0; s < 2; s++) {
      const id = i * 2 + s, si = o.chr[i].sis[s], kp = this.ktPos[id];
      const att = M.att[i][s] * o.kmt;
      const side = si.dest ? si.dest : s === 0 ? -1 : 1;
      const Pp = side < 0 ? P0 : P1;
      for (let f = 0; f < 4; f++) {
        const idx = O_KF + id * 4 + f;
        if (!mtsOn || att <= 0.01 || !showKT && k < I.ana || o.restit || side === 0) { this.mt.setMatrixAt(idx, this.zeroM); continue; }
        const h1 = hash(idx * 1.7) - 0.5, h2 = hash(idx * 2.3) - 0.5;
        const ax = Pp[0] + (plant ? 0 : 0), ay = Pp[1] + h1 * spread * 0.9, az = Pp[2] + h2 * spread * 0.9;
        const ex = kp.x, ey = kp.y + h1 * 0.25, ez = kp.z + h2 * 0.25;
        this.setMT(idx, ax, ay, az, lerp(ax, ex, att), lerp(ay, ey, att), lerp(az, ez, att), 0.045, tub || (o.chr[i].tension ? C.kfT : C.kf));
      }
    }
    // dynamic search MTs from the poles (prophase → metaphase)
    const dynActive = mtsOn && k >= I.pro && k <= I.meta && o.sg > 0.05 && !o.restit;
    for (let q = 0; q < N_DYN; q++) {
      const d = this.dyn[q], side = q < N_DYN / 2 ? -1 : 1;
      this.stepDynamic(d, dt, M, dynActive && (q % 20) / 20 < o.sg, (dd) => {
        const tgt = this.v1.set((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
        dd.base.set((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, 0);
        const Pp = side < 0 ? P0 : P1;
        dd.dir.set(tgt.x - Pp[0], tgt.y - Pp[1] - dd.base.x, tgt.z - Pp[2] - dd.base.y);
        dd.max = dd.dir.length() + 1.5; dd.dir.normalize();
      });
      const idx = O_DYN + q, Pp = side < 0 ? P0 : P1;
      if (d.len < 0.05 || !mtsOn) { this.mt.setMatrixAt(idx, this.zeroM); this.tips.setMatrixAt(q, this.zeroM); continue; }
      const ax = Pp[0], ay = Pp[1] + d.base.x, az = Pp[2] + d.base.y;
      const bx = ax + d.dir.x * d.len, by = ay + d.dir.y * d.len, bz = az + d.dir.z * d.len;
      this.setMT(idx, ax, ay, az, bx, by, bz, 0.035, tub || C.dyn);
      this.tips.setMatrixAt(q, this.m4.compose(this.v1.set(bx, by, bz), this.q.identity(), this.s3.setScalar(1)));
      this.tips.setColorAt(q, d.grow ? C.grow : C.shrink);
    }
    // interpolar MTs: overlap at the midzone, slide apart in anaphase B
    const ipVis = mtsOn && o.sg > 0.02 && k >= I.pro && !o.restit;
    const ov = k < I.ana ? 1.6 : k === I.ana ? lerp(1.6, 0.9, o.s) : 0.8;
    const ipR = plant ? 2.6 : 1.5;
    for (let q = 0; q < N_IP; q++) {
      const idx = O_IP + q, side = q < N_IP / 2 ? -1 : 1, Pp = side < 0 ? P0 : P1;
      if (!ipVis) { this.mt.setMatrixAt(idx, this.zeroM); continue; }
      const a = hash(q * 4.7) * TAU, rr = Math.sqrt(hash(q * 1.3)) * ipR;
      const ay = Pp[1] + Math.cos(a) * spread * 0.4, az = Pp[2] + Math.sin(a) * spread * 0.4;
      const ex = -side * ov * (0.6 + 0.4 * hash(q * 9.1)), ey = Math.cos(a) * rr * (o.split ? 0 : 1 - 0.8 * o.f), ez = Math.sin(a) * rr * (1 - 0.8 * o.f);
      const g = o.sg;
      this.setMT(idx, Pp[0], ay, az, lerp(Pp[0], ex, g), lerp(ay, ey, g), lerp(az, ez, g), 0.035, tub || C.ip);
    }
    // astral MTs (animal) — also the interphase radial array
    for (let q = 0; q < N_AST; q++) {
      const idx = O_AST + q, d = this.dyn[N_DYN + q], c = q < N_AST / 2 ? 0 : 1;
      const cs = o.cs[c];
      const active = mtsOn && !plant && (c === 0 || o.dup > 0.5) && (k <= I.meta || k >= I.ana) && !o.restit;
      const mitotic = k >= I.pro && k < I.done;
      this.stepDynamic(d, dt, M, active, (dd) => {
        dd.dir.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        if (mitotic) { const sx = cs[0] < 0 ? -1 : 1; dd.dir.x = sx * Math.abs(dd.dir.x) + sx * 0.4; dd.dir.normalize(); }
        dd.max = mitotic ? 3 + 2.5 * Math.random() : 4 + 4 * Math.random();
      });
      const tipI = N_DYN + q;
      if (d.len < 0.05 || plant) { this.mt.setMatrixAt(idx, this.zeroM); this.tips.setMatrixAt(tipI, this.zeroM); continue; }
      const bx = cs[0] + d.dir.x * d.len, by = cs[1] + d.dir.y * d.len, bz = cs[2] + d.dir.z * d.len;
      this.setMT(idx, cs[0], cs[1], cs[2], bx, by, bz, 0.035, tub || C.ast);
      this.tips.setMatrixAt(tipI, this.m4.compose(this.v1.set(bx, by, bz), this.q.identity(), this.s3.setScalar(1)));
      this.tips.setColorAt(tipI, d.grow ? C.grow : C.shrink);
    }
    // plant cortical array → preprophase band
    const P = PLANT;
    for (let q = 0; q < N_CORT; q++) {
      const idx = O_CORT + q;
      if (!plant || !mtsOn || !M.mtsOK) { this.mt.setMatrixAt(idx, this.zeroM); continue; }
      const inBand = o.ppb, spreadV = o.cortical;
      const vis = Math.max(inBand, spreadV * (k <= I.G2 ? 1 : 0), k >= I.done ? 1 : 0);
      if (vis < 0.02) { this.mt.setMatrixAt(idx, this.zeroM); continue; }
      const along = hash(q * 2.1);
      let x = (hash(q * 5.9) * 2 - 1) * (P.hx - 1.6);
      if (k >= I.done) x = (hash(q * 5.9) < 0.5 ? -1 : 1) * (0.8 + hash(q * 7.7) * (P.hx - 2.6));
      const xb = (hash(q * 3.3) - 0.5) * 2.2;
      x = lerp(x, xb, inBand);
      rrPoint(along, P.hy - 0.45, P.hz - 0.45, 2.1, this.rr);
      const len = 2.4 * vis;
      const y0 = this.rr[0], z0 = this.rr[1];
      this.setMT(idx, x, y0 - this.rr[2] * len * 0.5, z0 - this.rr[3] * len * 0.5, x, y0 + this.rr[2] * len * 0.5, z0 + this.rr[3] * len * 0.5, 0.045, C.cort);
    }
    // phragmoplast (plant): two short opposed arrays at the edge of the growing cell plate
    const Rp = o.plate * 14.4;
    for (let q = 0; q < N_PHR; q++) {
      const idx = O_PHR + q;
      if (!plant || !mtsOn || o.phrag < 0.02 || !M.mtsOK) { this.mt.setMatrixAt(idx, this.zeroM); continue; }
      const side = q % 2 ? 1 : -1, a = (Math.floor(q / 2) / (N_PHR / 2)) * TAU + hash(q) * 0.2;
      let rr = Math.max(0.5 + hash(q * 3.1) * 1.4, Rp + 0.2 + hash(q * 3.1) * 0.6);
      const y = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (Math.abs(y) > P.hy - 0.3 || Math.abs(z) > P.hz - 0.3) { this.mt.setMatrixAt(idx, this.zeroM); continue; }
      const L = 1.9 * o.phrag;
      this.setMT(idx, side * 0.12, y, z, side * (0.12 + L), y, z, 0.045, C.phr);
    }
    this.mt.instanceMatrix.needsUpdate = true;
    if (this.mt.instanceColor) this.mt.instanceColor.needsUpdate = true;
    this.tips.instanceMatrix.needsUpdate = true;
    if (this.tips.instanceColor) this.tips.instanceColor.needsUpdate = true;
    this.tips.visible = mtsOn;
    if (mtsOn) fb.push(this.mt);

    // motors: kinesin-5 at the overlap, kinetochore motors in anaphase
    const motVis = mtsOn && ipVis && k >= I.prometa && k <= I.ana;
    this.motors.visible = motVis;
    if (motVis) {
      for (let q = 0; q < 10; q++) {
        const a = hash(q * 4.7) * TAU, rr = Math.sqrt(hash(q * 1.3)) * ipR * 0.8;
        const x = (hash(q * 6.1) - 0.5) * ov * 1.4 + (k === I.ana && !engineReduced(this.engine) ? 0.08 * Math.sin(t * 8 + q) : 0);
        this.motors.setMatrixAt(q, this.m4.compose(this.v1.set(x, Math.cos(a) * rr, Math.sin(a) * rr), this.q.identity(), this.s3.setScalar(1)));
      }
      for (let q = 0; q < 8; q++) {
        const kp = this.ktPos[q], on = k === I.ana && o.s > 0 && o.s < 1;
        this.motors.setMatrixAt(10 + q, this.m4.compose(kp, this.q.identity(), this.s3.setScalar(on ? 1.3 + 0.3 * Math.sin(t * 10 + q) : 0)));
      }
      this.motors.instanceMatrix.needsUpdate = true;
    }

    // replication forks
    {
      const pa = this.forks.geometry.attributes.position, A = pa.array;
      let n = 0;
      if (k === I.S) for (let i = 0; i < 4; i++) {
        const r = o.chr[i].rep;
        if (r <= 0 || r >= 1) continue;
        for (let j = 0; j < ORIGINS; j++) for (const sg of [-1, 1]) {
          const u = (j + 0.5) / ORIGINS + sg * r * (0.5 / ORIGINS);
          this.clAt(i, 0, u, this.v1);
          A[n * 3] = this.v1.x; A[n * 3 + 1] = this.v1.y; A[n * 3 + 2] = this.v1.z; n++;
        }
      }
      pa.needsUpdate = true;
      this.forks.geometry.setDrawRange(0, n);
      this.forks.material.size = 1.0 + 0.3 * Math.sin(t * 7);
    }
    // DNA damage
    {
      const pa = this.dmg.geometry.attributes.position, A = pa.array;
      let n = 0;
      if (M.damage > 0.02) for (const [i, u] of this.dmgU) { if (n / 10 > M.damage + 0.05) break; this.clAt(i, 0, u, this.v1); A[n * 3] = this.v1.x; A[n * 3 + 1] = this.v1.y; A[n * 3 + 2] = this.v1.z; n++; }
      pa.needsUpdate = true;
      this.dmg.geometry.setDrawRange(0, n);
      this.dmg.material.size = 1.3 + 0.5 * Math.sin(t * 5);
    }

    // metaphase plate guide (DIY)
    this.plateGuide.visible = !!opts.plateGuide || (k === I.meta && opts.showPlate);
    if (this.plateGuide.visible) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 3);
      this.plateGuide.children[1].material.opacity = 0.35 + 0.4 * pulse;
      this.slotRings.forEach((m, j) => { m.visible = !!opts.plateGuide && M.diy.occ[j] < 0; m.scale.setScalar(1 + 0.15 * pulse); });
    }

    // mitochondria + specks
    for (let q = 0; q < 8; q++) {
      const b = this.mitoBase[q];
      this.cellPoint(o, b, this.v1);
      this.q.setFromAxisAngle(this.v2.set(Math.sin(b[3]), Math.cos(b[3]), 0.3).normalize(), b[3] + (engineReduced(this.engine) ? 0 : t * 0.05));
      this.mitos.setMatrixAt(q, this.m4.compose(this.v1, this.q, this.s3.setScalar(1)));
    }
    this.mitos.instanceMatrix.needsUpdate = true;
    this.mitos.material.emissiveIntensity = 0.1 + 0.6 * M.atpF;
    pick.push(this.mitos);
    {
      const pa = this.specks.geometry.attributes.position, A = pa.array, sb = this.speckBase;
      const drift = engineReduced(this.engine) ? 0 : t * 0.05;
      for (let q = 0; q < sb.length; q++) {
        const b = sb[q];
        this.v2.set(b[0] + 0.05 * Math.sin(drift + q), b[1], b[2] + 0.05 * Math.cos(drift * 1.3 + q));
        const tb = this.tb ||= [0, 0, 0];
        tb[0] = this.v2.x * 0.95; tb[1] = this.v2.y * 0.95; tb[2] = this.v2.z * 0.95;
        this.cellPoint(o, tb, this.v1);
        A[q * 3] = this.v1.x; A[q * 3 + 1] = this.v1.y; A[q * 3 + 2] = this.v1.z;
      }
      pa.needsUpdate = true;
    }

    // ---------- plant ----------
    if (plant) {
      fb.push(this.wall);
      this.cellPlate.visible = o.plate > 0.004;
      this.cellPlate.scale.set(1, Math.max(0.01, Rp), Math.max(0.01, Rp));
      this.col.set("#bef264").lerp(this.col2 ||= new THREE.Color("#86efac"), k === I.done ? o.p : 0);
      this.plateMat.color.copy(this.col);
      if (this.cellPlate.visible) pick.push(this.cellPlate);
      this.cdz.visible = o.cdz > 0 && o.ppb < 0.6 && opts.cdz;
      // vesicles from the Golgi to the plate edge
      const vesOn = o.phrag > 0.05 && o.plate < 0.999;
      this.ves.visible = vesOn;
      if (vesOn) {
        const rate = opts.vesRate ?? 1;
        for (let q = 0; q < this.vesS.length; q++) {
          const v = this.vesS[q];
          v.t += dt * v.sp * rate;
          if (v.t >= 1) { v.t -= 1; v.g = (v.g + 1 + Math.floor(Math.random() * 5)) % 6; v.a = Math.random() * TAU; }
          const G = this.golgiPos[v.g];
          let rr = Math.max(0.6, Rp * (0.9 + 0.15 * hash(q)));
          let ty = Math.cos(v.a) * rr, tz = Math.sin(v.a) * rr;
          ty = clamp(ty, -P.hy + 0.6, P.hy - 0.6); tz = clamp(tz, -P.hz + 0.6, P.hz - 0.6);
          const f = v.t;
          // travel to the phragmoplast, then along it to the midplane
          const sx = G.x < 0 ? -1 : 1;
          const mx = sx * 2.2;
          let x, y, z;
          if (f < 0.7) { const g = f / 0.7; x = lerp(G.x, mx, g); y = lerp(G.y, ty, g); z = lerp(G.z, tz, g); }
          else { const g = (f - 0.7) / 0.3; x = lerp(mx, 0, g); y = ty; z = tz; }
          const sc = f > 0.96 ? (1 - f) / 0.04 : 1;
          this.ves.setMatrixAt(q, this.m4.compose(this.v1.set(x, y, z), this.q.identity(), this.s3.setScalar(sc)));
        }
        this.ves.instanceMatrix.needsUpdate = true;
        pick.push(this.ves);
      }
      pick.push(this.golgi);
      const capOn = k === I.pro || (k === I.prometa && o.p < 0.5);
      this.polarCaps.forEach((sp, j) => {
        sp.visible = capOn && M.mtsOK && mtsOn;
        sp.position.set((j ? 1 : -1) * (k === I.pro ? NUC_R + 0.4 : o.poles[1][0]), 0, 0);
        sp.material.opacity = 0.35 + 0.15 * Math.sin(t * 2 + j);
      });
    } else {
      // ---------- animal ----------
      this.updateMembrane(o);
      fb.push(this.mem);
      const ringOn = o.f > 0.01 && !o.split;
      this.ringMesh.visible = this.myo.visible = ringOn;
      if (ringOn) {
        const neck = ANIMAL.R * o.b * (1 - o.f) * 0.97 + 0.05;
        this.ringMesh.scale.set(neck, neck, neck);
        for (let q = 0; q < 20; q++) {
          const a = (q / 20) * TAU + (engineReduced(this.engine) ? 0 : t * 0.4 * (q % 2 ? 1 : -1) * 0.2);
          this.myo.setMatrixAt(q, this.m4.compose(this.v1.set(0, Math.cos(a) * neck, Math.sin(a) * neck), this.q.identity(), this.s3.setScalar(1)));
        }
        this.myo.instanceMatrix.needsUpdate = true;
        pick.push(this.ringMesh, this.myo);
      }
      this.centro.forEach((g, j) => {
        const cs = o.cs[j];
        g.visible = j === 0 || o.dup > 0.02;
        g.position.set(cs[0], cs[1], cs[2]);
        g.scale.setScalar(j === 1 ? Math.max(0.01, o.dup) : 1);
        if (!engineReduced(this.engine)) g.rotation.set(t * 0.3, t * 0.2 + j, 0);
        if (g.visible) pick.push(g.children[0], g.children[1]);
      });
    }

    // selection glow
    if (opts.sel) {
      this.selGlow.visible = true;
      this.selGlow.position.copy(opts.sel);
      this.selGlow.scale.setScalar(4);
      this.selGlow.material.opacity = 0.35 + 0.2 * Math.sin(t * 3);
    } else this.selGlow.visible = false;
    void W;
  }
}

function engineReduced(e) { return !!e.reducedMotion; }
