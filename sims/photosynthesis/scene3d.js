// Photosynthesis — 3D thylakoid membrane + Calvin cycle (Three.js, inside the CellScape engine).
// A port of the 2D sim's entity logic (sim2d.js) into world space. Every animation is paced by the same
// limiting-factors model (model.js): electrons, H⁺, ATP/NADPH tokens and carbon fixation all follow model.rate.
// Units: 1 world unit ≈ 3.5 nm (bilayer ≈ 2.2 units ≈ 7.7 nm); proteins are drawn roughly to that scale, molecules larger.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import * as PM from "./model.js";

export const METERS_PER_UNIT = 3.5e-9;
const BEND = 0.0045;
export const bend = (x) => -BEND * x * x;
const HALF = 1.0;                      // head-group centres at ±HALF
const TOPM = 7.4;                      // the far membrane of the thylakoid sac (lumen in between)
export const X = { psii: -10, b6f: -4, psi: 2, atps: 9 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const TAU = Math.PI * 2;
const DOWN = new THREE.Vector3(0, -1, 0);
/** point at membrane-relative height dy above the (curved) mid-plane */
export const at = (x, dy, z, out = new THREE.Vector3()) => out.set(x, bend(x) + dy, z);

export const COL = { e: "#fde047", h: "#f472b6", o2: "#f87171", h2o: "#67e8f9", atp: "#fbbf24", nadph: "#a78bfa", rubp: "#60a5fa", pga: "#fb923c", g3p: "#a3e635", glu: "#4ade80" };

function physical(color, o = {}) {
  const c = new THREE.Color(color);
  return new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.32, metalness: 0, clearcoat: 0.85, clearcoatRoughness: 0.22, sheen: 0.5, sheenRoughness: 0.5, sheenColor: c.clone().lerp(new THREE.Color("#fff"), 0.5), ...o });
}
function paint(g, color) {
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3));
  if (g.index) g = g.toNonIndexed();
  g.deleteAttribute("uv");
  return g;
}
const sphereAt = (r, x, y, z, color, w = 14, h = 10) => { const g = new THREE.SphereGeometry(r, w, h); g.translate(x, y, z); return paint(g, color); };
const capsule = (r, len, mat) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 18), mat);
function dotTexture() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 64;
  const c = cv.getContext("2d"), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,0.35)"); g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Thylakoid3D {
  /** S: the sim state (same fields as the 2D sim). hooks: { toast(msg) } */
  constructor(S, engine, hooks = {}) {
    this.S = S; this.engine = engine; this.hooks = hooks;
    this.root = new THREE.Group();
    this.pickables = [];
    this.tmpM = new THREE.Matrix4(); this.tmpQ = new THREE.Quaternion(); this.tmpV = new THREE.Vector3(); this.tmpS = new THREE.Vector3(); this.tmpE = new THREE.Euler();
    this.tA = new THREE.Vector3(); this.tB = new THREE.Vector3(); this.tC = new THREE.Color();
    this.dot = dotTexture();
    this.pts = {
      oec: at(X.psii, 2.15, 0.2), pc: at(-1, 2.3, 0.5), fd: at(3.8, -2.2, 0.3), fnr: at(5.1, -3.0, 0.5),
      head: at(X.atps, -4.4, 0), T: at(-4, 1.2, 0),
    };
    this.WC = new THREE.Vector3(0.5, -11, 2.5); this.WR = 3.1;
    this.aR = (5 * Math.PI) / 6;                     // fixation node (upper left); the cycle runs clockwise
    const node = (a) => new THREE.Vector3(this.WC.x + this.WR * Math.cos(a), this.WC.y + this.WR * Math.sin(a), this.WC.z);
    this.rubPos = node(this.aR); this.redPos = node(this.aR - TAU / 3); this.regPos = node(this.aR - (2 * TAU) / 3);
    this.zone = { x0: -7, x1: 9, y0: -16, y1: -6.2, z0: 1, z1: 4.5 };
    this.buildEnvironment();
    this.buildMembrane();
    this.buildProteins();
    this.buildCalvin();
    this.buildLamp();
    this.buildDynamic();
    this.reset();
  }

  reset() {
    this.photons = []; this.electrons = []; this.hions = []; this.movers = []; this.o2s = []; this.waters = []; this.tokens = [];
    this.co2s = []; this.flyCO2 = []; this.g3ps = []; this.pops = []; this.flashes = []; this.bubbles = [];
    this.acc = { photon: 0, e: 0, fix: 0, atp: 0, bubble: 0 };
    this.rotor = 0; this.rotorSpeed = 0; this.wheelPhase = 0; this.rubPulse = 0; this.tokenFlip = 0;
  }

  // ---------- build ----------
  buildEnvironment() {
    const n = 700, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const pal = ["#5eead4", "#86efac", "#fde68a", "#a7f3d0"].map((c) => new THREE.Color(c));
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 70; pos[i * 3 + 1] = -Math.random() * 30 - 3; pos[i * 3 + 2] = (Math.random() - 0.5) * 40 - 6;
      const c = pal[i % pal.length]; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    this.specks = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.2, map: this.dot, vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.root.add(this.specks);
    // out-of-focus grana deep in the stroma (other thylakoid stacks)
    const gm = physical("#1f9d55", { transparent: true, opacity: 0.22, roughness: 0.5 });
    for (const [x, y, z] of [[-26, -20, -42], [18, -26, -48], [36, -8, -55]]) {
      for (let k = 0; k < 7; k++) {
        const d = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.5, 24), gm);
        d.position.set(x, y + k * 0.8, z);
        this.root.add(d);
      }
    }
  }

  buildMembrane() {
    const foot = [[X.psii, 0, 3.0], [X.b6f, 0, 1.5], [X.psi, 0, 2.6], [X.atps, 0, 1.35]];
    const dx = 0.46, dz = 0.42, x0 = -17, x1 = 17, z0 = -9, z1 = 5;
    const heads = [];
    for (let row = 0, z = z0; z <= z1; z += dz, row++) {
      for (let x = x0 + (row % 2) * dx * 0.5; x <= x1; x += dx) {
        const Xp = x + (hash(row * 991 + x * 13) - 0.5) * 0.06, Z = z + (hash(row * 17 + x * 7) - 0.5) * 0.06;
        if (foot.some(([fx, fz, r]) => Math.hypot(Xp - fx, Z - fz) < r)) continue;
        heads.push([Xp, Z, hash(Xp * 31 + Z * 57)]);
      }
    }
    const geo = new THREE.SphereGeometry(0.23, 10, 8);
    const mat = physical("#8fd3a2", { roughness: 0.4, clearcoat: 0.6, sheen: 0.8 });
    this.heads = new THREE.InstancedMesh(geo, mat, heads.length * 2);
    const front = heads.filter((h) => h[1] > z1 - 1.3);
    this.tails = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.045, 0.03, HALF * 0.9, 5, 1, true), new THREE.MeshStandardMaterial({ color: "#5a6b3a", roughness: 0.7 }), front.length * 4);
    const m = this.tmpM, q = this.tmpQ, p = this.tmpV, s = this.tmpS.set(1, 1, 1), e = this.tmpE, c = this.tC;
    const cA = new THREE.Color("#93d9a8"), cB = new THREE.Color("#6fbf8a"), cC = new THREE.Color("#c4f0cf");
    let i = 0, k = 0;
    for (const [Xp, Z, h] of heads) {
      const Y0 = bend(Xp), tilt = Math.atan(-2 * BEND * Xp), isFront = Z > z1 - 1.3;
      for (const sg of [1, -1]) {
        this.heads.setMatrixAt(i, m.compose(p.set(Xp, Y0 + sg * HALF, Z), q.identity(), s));
        c.copy(h < 0.5 ? cA : cB).lerp(cC, hash(i) * 0.5);
        if (sg < 0) c.multiplyScalar(0.85);
        this.heads.setColorAt(i++, c);
        if (isFront) for (const off of [-0.07, 0.07]) {
          e.set((hash(i + off) - 0.5) * 0.3, 0, tilt + (hash(i * 3 + off) - 0.5) * 0.3);
          this.tails.setMatrixAt(k++, m.compose(p.set(Xp + off, Y0 + sg * HALF * 0.5, Z), q.setFromEuler(e), s));
        }
      }
    }
    this.tails.count = k;
    this.root.add(this.heads, this.tails);
    const core = new THREE.PlaneGeometry(34, 14, 64, 1);
    core.rotateX(-Math.PI / 2);
    const cp = core.attributes.position;
    for (let j = 0; j < cp.count; j++) cp.setY(j, bend(cp.getX(j)));
    core.translate(0, 0, (z0 + z1) / 2);
    this.root.add(new THREE.Mesh(core, new THREE.MeshStandardMaterial({ color: "#26331b", roughness: 1, side: THREE.DoubleSide })));
    // the far side of the thylakoid sac + the lumen between
    const top = new THREE.PlaneGeometry(34, 14, 48, 1);
    top.rotateX(-Math.PI / 2);
    const tp = top.attributes.position;
    for (let j = 0; j < tp.count; j++) tp.setY(j, bend(tp.getX(j)) + TOPM);
    top.translate(0, 0, (z0 + z1) / 2);
    this.topMem = new THREE.Mesh(top, new THREE.MeshPhysicalMaterial({ color: "#4ade80", transparent: true, opacity: 0.16, roughness: 0.2, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }));
    this.root.add(this.topMem);
    const lum = new THREE.BoxGeometry(34, TOPM - 2 * HALF - 0.4, 14, 48, 1, 1);
    const lp = lum.attributes.position;
    for (let j = 0; j < lp.count; j++) lp.setY(j, lp.getY(j) + bend(lp.getX(j)) + TOPM / 2);
    lum.translate(0, 0, (z0 + z1) / 2);
    this.lumenMat = new THREE.MeshBasicMaterial({ color: "#1f5e4a", transparent: true, opacity: 0.1, depthWrite: false });
    this.root.add(new THREE.Mesh(lum, this.lumenMat));
  }

  addProtein(key, group) {
    group.traverse((o) => { if (o.isMesh) { o.userData.key = key; this.pickables.push(o); } });
    this.root.add(group);
    return group;
  }

  buildProteins() {
    const P = (this.prot = {});
    const chlMat = physical("#bef264", { emissive: new THREE.Color("#a3e635"), emissiveIntensity: 0.6 });
    const chlorophyll = (g, w, seed) => {
      for (let i = 0; i < 7; i++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), chlMat);
        s.position.set((hash(seed + i) - 0.5) * w, (hash(seed + i * 3) - 0.5) * 1.6, 0.75 + hash(seed + i * 7) * 0.3);
        g.add(s);
      }
    };
    // Photosystem II (dimer core + LHCII antenna + Mn₄CaO₅ cluster on the lumen side)
    {
      const g = new THREE.Group(), core = physical("#2f9e5e"), lhc = physical("#55c27a");
      for (const sx of [-0.95, 0.95]) { const c = capsule(0.92, 2.3, core); c.position.x = sx; g.add(c); }
      for (const [sx, sz] of [[-2.1, 0.7], [-2.1, -0.8], [2.1, 0.7], [2.1, -0.8]]) { const c = capsule(0.62, 1.7, lhc); c.position.set(sx, 0, sz); g.add(c); }
      chlorophyll(g, 4.2, 1);
      const oec = new THREE.Group();
      [["#c2410c", -0.36, 0], ["#ea580c", -0.12, 0.1], ["#c2410c", 0.12, 0], ["#ea580c", 0.36, 0.1], ["#e2e8f0", 0, -0.22]].forEach(([c, x, y]) => {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 10), physical(c, { emissive: new THREE.Color(c), emissiveIntensity: 0.3 }));
        s.position.set(x, y, 0); oec.add(s);
      });
      oec.position.set(0, 2.15, 0.2);
      g.add(oec);
      g.position.copy(at(X.psii, 0, 0)); g.rotation.z = Math.atan(-2 * BEND * X.psii);
      P.psii = this.addProtein("psii", g);
      g.userData.mats = [core, lhc];
    }
    // cytochrome b6f (dimer) with the Rieske iron–sulfur protein on the lumen side
    {
      const g = new THREE.Group(), a = physical("#7a5cc8"), b = physical("#6b4fb5");
      const c1 = capsule(0.66, 2.6, a); c1.position.x = -0.6; const c2 = capsule(0.66, 2.6, b); c2.position.x = 0.6;
      const r = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), physical("#f87171")); r.position.set(0, 2.2, 0.3);
      g.add(c1, c2, r);
      g.position.copy(at(X.b6f, 0, 0)); g.rotation.z = Math.atan(-2 * BEND * X.b6f);
      P.b6f = this.addProtein("b6f", g);
      g.userData.mats = [a, b];
    }
    // Photosystem I + LHCI, ferredoxin and FNR on the stroma side
    {
      const g = new THREE.Group(), core = physical("#2e7d4a"), lhc = physical("#4aa35a");
      for (const sx of [-0.5, 0.75]) { const c = capsule(0.95, 2.0, core); c.position.x = sx; g.add(c); }
      for (const sz of [-1.0, 0, 1.0]) { const c = capsule(0.52, 1.6, lhc); c.position.set(-2.0, 0, sz * 0.9); g.add(c); }
      chlorophyll(g, 3.6, 9);
      g.position.copy(at(X.psi, 0, 0)); g.rotation.z = Math.atan(-2 * BEND * X.psi);
      P.psi = this.addProtein("psi", g);
      g.userData.mats = [core, lhc];
      const fd = new THREE.Mesh(new THREE.SphereGeometry(0.45, 18, 14), physical("#b45309"));
      fd.position.copy(this.pts.fd);
      const fnr = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), physical("#ca8a04"));
      fnr.scale.set(0.85, 0.55, 0.65); fnr.position.copy(this.pts.fnr);
      const fg = new THREE.Group(); fg.add(fd, fnr);
      this.addProtein("psi", fg);
    }
    // ATP synthase: CF₀ c-ring rotor in the membrane, γ stalk, α₃β₃ head in the stroma, peripheral stalk
    {
      const g = new THREE.Group(), cMat = physical("#b7794a"), stalk = physical("#e7c9a0");
      g.position.copy(at(X.atps, 0, 0));
      const rotor = new THREE.Group();
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU, c = capsule(0.2, 1.9, cMat);
        c.position.set(Math.cos(a) * 0.8, 0, Math.sin(a) * 0.8);
        rotor.add(c);
      }
      const gamma = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 4.0, 12), stalk);
      gamma.position.y = -2.2; rotor.add(gamma);
      const eps = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), stalk); eps.position.set(0.25, -1.0, 0); rotor.add(eps);
      const mark = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), physical("#fde68a", { emissive: new THREE.Color("#fde68a"), emissiveIntensity: 0.9 }));
      mark.position.set(0.95, 0.85, 0); rotor.add(mark);
      g.add(rotor);
      const aSub = physical("#e8b86d"), bSub = physical("#c9733a"), bHot = physical("#fbbf24", { emissive: new THREE.Color("#f59e0b"), emissiveIntensity: 0.8 });
      const head = new THREE.Group(); head.position.y = -4.4;
      this.betas = [];
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU, beta = k % 2 === 1;
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.78, 24, 16), beta ? bSub : aSub);
        s.position.set(Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95);
        head.add(s);
        if (beta) this.betas.push(s);
      }
      const delta = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), aSub); delta.position.y = -0.9; head.add(delta);
      g.add(head);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.2, 8), stalk);
      b.position.set(1.65, -2.4, -0.4); b.rotation.z = 0.08; g.add(b);
      g.rotation.z = Math.atan(-2 * BEND * X.atps);
      P.atps = this.addProtein("atps", g);
      g.userData.mats = [cMat];
      this.rotorObj = rotor; this.bMats = { bSub, bHot };
    }
    // plastoquinone (in the membrane) and plastocyanin (lumen) shuttles
    this.pq = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), physical("#facc15", { emissive: new THREE.Color("#eab308"), emissiveIntensity: 0.4 }));
    this.pc = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), physical("#38bdf8", { emissive: new THREE.Color("#0ea5e9"), emissiveIntensity: 0.3 }));
    this.pq.userData.key = "pq"; this.pc.userData.key = "pc";
    this.pickables.push(this.pq, this.pc);
    this.root.add(this.pq, this.pc);
  }

  buildCalvin() {
    const W = this.WC;
    this.wheelMat = physical("#4fd1c5", { emissive: new THREE.Color("#14b8a6"), emissiveIntensity: 0.25, transparent: true, opacity: 0.55 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(this.WR, 0.11, 10, 120), this.wheelMat);
    ring.position.copy(W);
    ring.userData.key = "calvin";
    this.pickables.push(ring);
    this.root.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(this.WR * 0.92, 48), new THREE.MeshBasicMaterial({ color: "#0f766e", transparent: true, opacity: 0.12, depthWrite: false }));
    disc.position.copy(W); disc.userData.key = "calvin";
    this.pickables.push(disc);
    this.root.add(disc);
    // clockwise direction arrows
    const coneGeo = new THREE.ConeGeometry(0.22, 0.55, 12);
    for (let k = 0; k < 3; k++) {
      const a = this.aR - TAU / 6 - (k * TAU) / 3;
      const c = new THREE.Mesh(coneGeo, this.wheelMat);
      c.position.set(W.x + this.WR * Math.cos(a), W.y + this.WR * Math.sin(a), W.z);
      c.rotation.z = a + Math.PI;           // tangent pointing clockwise
      this.root.add(c);
    }
    this.carbons = new THREE.InstancedMesh(new THREE.SphereGeometry(0.3, 14, 10), physical("#ffffff", { roughness: 0.3 }), 12);
    this.carbons.frustumCulled = false;
    this.root.add(this.carbons);
    // Rubisco (L₈S₈)
    const rg = new THREE.Group();
    this.rubL = physical("#34d399"); this.rubL2 = physical("#14b8a6"); this.rubS = physical("#a7f3d0");
    this.rubParts = [];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU, s = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), k % 2 ? this.rubL : this.rubL2);
      s.userData.base = new THREE.Vector3(Math.cos(a) * 0.55, (k < 4 ? 1 : -1) * 0.28, Math.sin(a) * 0.55);
      rg.add(s); this.rubParts.push(s);
    }
    for (let k = 0; k < 8; k++) {
      const a = (k / 4) * TAU + 0.4, s = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), this.rubS);
      s.userData.base = new THREE.Vector3(Math.cos(a) * 0.35, (k < 4 ? 1 : -1) * 0.72, Math.sin(a) * 0.35);
      rg.add(s); this.rubParts.push(s);
    }
    rg.position.copy(this.rubPos);
    rg.scale.setScalar(1.25);
    rg.traverse((o) => { if (o.isMesh) { o.userData.key = "rubisco"; this.pickables.push(o); } });
    this.rubGroup = rg;
    this.root.add(rg);
    this.rubGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dot, color: "#4fd1c5", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.3 }));
    this.rubGlow.position.copy(this.rubPos);
    this.root.add(this.rubGlow);
    // glucose hexagon in the centre
    const hg = new THREE.CylinderGeometry(0.75, 0.75, 0.32, 6);
    hg.rotateX(Math.PI / 2);
    this.hex = new THREE.Mesh(hg, physical("#4ade80", { emissive: new THREE.Color("#22c55e"), emissiveIntensity: 0.35 }));
    this.hex.position.set(W.x, W.y + 0.75, W.z);
    this.hex.userData.key = "calvin";
    this.pickables.push(this.hex);
    this.root.add(this.hex);
  }

  buildLamp() {
    const g = new THREE.Group();
    this.bulbMat = new THREE.MeshBasicMaterial({ color: "#fff4cf", toneMapped: false });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 16), this.bulbMat);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.2, 0.9, 24, 1, true), physical("#334155", { side: THREE.DoubleSide }));
    shade.position.y = 0.55;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.8, 12), physical("#475569")); cap.position.y = 1.3;
    g.add(bulb, shade, cap);
    g.traverse((o) => { if (o.isMesh) { o.userData.key = "lamp"; this.pickables.push(o); } });
    this.lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dot, color: "#fff4cf", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 }));
    this.lampGlow.scale.setScalar(6);
    g.add(this.lampGlow);
    this.lampLight = new THREE.PointLight("#fff4cf", 40, 60, 1.6);
    g.add(this.lampLight);
    this.lamp = g;
    this.root.add(g);
    // light beam: a soft cone from the lamp to the photosystems
    const cone = new THREE.ConeGeometry(1, 1, 32, 1, true);
    cone.translate(0, -0.5, 0);
    this.beamMat = new THREE.MeshBasicMaterial({ color: "#fff4cf", transparent: true, opacity: 0.06, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.beam = new THREE.Mesh(cone, this.beamMat);
    this.root.add(this.beam);
  }

  buildDynamic() {
    const R = this.root;
    const inst = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.count = 0; m.frustumCulled = false; R.add(m); return m; };
    const glow = (c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2), toneMapped: false });
    this.mPhoton = inst(new THREE.CapsuleGeometry(0.07, 2.2, 3, 6), new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false, transparent: true }), 48);
    this.mElectron = inst(new THREE.SphereGeometry(0.2, 12, 8), glow(COL.e), 44);
    this.mH = inst(new THREE.SphereGeometry(0.17, 10, 8), physical(COL.h, { emissive: new THREE.Color(COL.h), emissiveIntensity: 0.6 }), 140);
    const o2g = mergeGeometries([sphereAt(0.22, -0.18, 0, 0, COL.o2), sphereAt(0.22, 0.18, 0, 0, COL.o2)]);
    this.mO2 = inst(o2g, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.25, clearcoat: 1, emissive: new THREE.Color("#7f1d1d"), emissiveIntensity: 0.4 }), 28);
    const a = (104.5 / 2) * Math.PI / 180, d = 0.22;
    const h2o = mergeGeometries([sphereAt(0.2, 0, 0, 0, "#e5484d"), sphereAt(0.13, Math.sin(a) * d, -Math.cos(a) * d, 0, "#f1f5f9"), sphereAt(0.13, -Math.sin(a) * d, -Math.cos(a) * d, 0, "#f1f5f9")]);
    this.mH2O = inst(h2o, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.25, clearcoat: 1 }), 16);
    const co2 = mergeGeometries([sphereAt(0.2, 0, 0, 0, "#4b5563"), sphereAt(0.19, -0.33, 0, 0, "#e5484d"), sphereAt(0.19, 0.33, 0, 0, "#e5484d")]);
    this.mCO2 = inst(co2, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.25, clearcoat: 1 }), 60);
    this.mCO2.userData.key = "co2";
    this.pickables.push(this.mCO2);
    const atp = mergeGeometries([sphereAt(0.17, -0.4, 0, 0, "#c4b5fd"), sphereAt(0.15, -0.2, 0.05, 0, "#fde68a"), sphereAt(0.12, 0.0, 0, 0, "#f59e0b"), sphereAt(0.12, 0.2, 0.03, 0, "#f59e0b"), sphereAt(0.12, 0.4, 0, 0, "#f59e0b")]);
    this.mATP = inst(atp, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.25, clearcoat: 1, emissive: new THREE.Color("#f59e0b"), emissiveIntensity: 0.35 }), 56);
    const nad = mergeGeometries([sphereAt(0.24, 0, 0, 0, COL.nadph), sphereAt(0.14, 0.3, 0.16, 0, "#e9d5ff")]);
    this.mNADPH = inst(nad, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.25, clearcoat: 1, emissive: new THREE.Color("#7c3aed"), emissiveIntensity: 0.4 }), 56);
    this.mG3P = inst(new THREE.SphereGeometry(0.2, 10, 8), physical(COL.g3p, { emissive: new THREE.Color(COL.g3p), emissiveIntensity: 0.4 }), 36);
    this.sprites = [];
    for (let i = 0; i < 36; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.visible = false; R.add(s); this.sprites.push(s);
    }
    this.electronPath = [at(X.psii, 0, 0.4), at(-7, -0.35, 0.9), at(X.b6f, 0, 0.4), this.pts.pc.clone(), at(X.psi, 0, 0.4), this.pts.fd.clone(), this.pts.fnr.clone()];
  }

  // ---------- geometry helpers ----------
  /** Lamp position from S.dcm (10–60 cm) and the horizontal preference S.fx (0–1). */
  lampPos(out = new THREE.Vector3()) {
    const S = this.S, T = this.pts.T;
    const d = lerp(8, 24, (S.dcm - 10) / 50), th = lerp(-1.0, 1.0, S.fx);
    return out.set(T.x + Math.sin(th) * d, T.y + Math.cos(th) * d, T.z + 1.5);
  }
  /** Inverse: a point (on the plane z = lamp z) → { dcm, fx }. */
  lampFromPoint(p) {
    const T = this.pts.T, dx = p.x - T.x, dy = Math.max(0.5, p.y - T.y);
    const d = Math.hypot(dx, dy), th = clamp(Math.atan2(dx, dy), -1, 1);
    return { dcm: Math.round(clamp(10 + ((d - 8) / 16) * 50, 10, 60)), fx: (th + 1) / 2 };
  }
  lampHex() { return this.S.white ? "#fff4cf" : PM.waveColour(this.S.lambda); }

  flash(pos, r, col, max = 0.35, rise = false) {
    if (this.flashes.length < 30) this.flashes.push({ p: pos.clone(), r, col, life: 0, max, rise });
  }

  // ---------- events (ported from the 2D sim) ----------
  fixOne(visual = true) {
    const S = this.S;
    S.atpStore = Math.max(0, S.atpStore - 1.2);
    S.nadphStore = Math.max(0, S.nadphStore - 0.9);
    S.co2Fixed++;
    this.rubPulse = 1;
    if (visual && this.flyCO2.length < 20) {
      let best = null, bd = 1e9;
      for (const c of this.co2s) { if (c.held) continue; const d = c.p.distanceToSquared(this.rubPos); if (d < bd) { bd = d; best = c; } }
      if (best) { this.co2s.splice(this.co2s.indexOf(best), 1); this.flyCO2.push({ s: best.p.clone(), t: 0, dur: 0.5 }); }
    }
    if (S.co2Fixed % 3 === 0) { S.g3pCount++; this.g3ps.push({ t: 0, dur: 0.9 }); }
    if (S.co2Fixed % 6 === 0) { S.glucose++; this.pops.push({ t: 0 }); }
  }

  manualFix(c, model, msgs) {
    const S = this.S;
    if (model.P < 4) { this.hooks.toast?.(S.temp >= 40 ? msgs.denatured : msgs.cold); c.v.set(rand(-2, 2), rand(-3, -1.5), 0); return; }
    if (S.atpStore < 1.2 || S.nadphStore < 0.9) { this.hooks.toast?.(msgs.noFuel); c.v.set(rand(-2, 2), rand(-3, -1.5), 0); return; }
    this.co2s.splice(this.co2s.indexOf(c), 1);
    this.flash(this.rubPos, 4, "#4fd1c5", 0.5);
    S.manualFixed++;
    if (S.manualFixed === 1) this.hooks.toast?.(msgs.first);
    this.fixOne(false);
  }

  fireElectron() {
    const S = this.S, P = this.pts;
    S.eCount++;
    S.hPool += 2; // 1 H⁺ from water at PSII + 1 pumped by cyt b6f (simplified, as in the 2D sim)
    if (this.electrons.length < 40) this.electrons.push({ seg: 0, t: 0, flashedPSI: false });
    this.flash(at(X.psii, 0, 0.6), 3.2, "#bbf7d0");
    if (this.hions.length < 75) this.hions.push({ p: P.oec.clone().add(this.tA.set(rand(-0.3, 0.3), 0.3, rand(-0.3, 0.3))), v: new THREE.Vector3(rand(-1.5, 1.5), rand(0.5, 2), rand(-1, 1)) });
    if (this.movers.length < 40) this.movers.push({ pts: [at(X.b6f + rand(-0.4, 0.4), -3, 0.6), at(X.b6f, 0, 0.6), at(X.b6f + rand(-0.4, 0.4), 2.3, 0.6)], seg: 0, t: 0, segDur: 0.45, end: "lumen" });
    if (S.eCount % 2 === 0 && this.waters.length < 12) this.waters.push({ s: at(P.oec.x + rand(-4, 4), rand(3.5, 6), rand(-3, 2.5)), t: 0, dur: 0.9 });
    if (S.eCount % 4 === 0 && this.o2s.length < 24) this.o2s.push({ p: P.oec.clone(), v: new THREE.Vector3(rand(-1, 0.6), rand(1.0, 1.5), rand(-0.4, 0.4)), life: 0 });
    if (S.eCount % 2 === 0) this.spawnToken("nadph");
  }

  spawnToken(type) {
    const P = this.pts;
    const s = type === "atp" ? P.head.clone().add(this.tA.set(rand(-0.6, 0.6), -1.2, rand(-0.4, 0.6))) : P.fnr.clone().add(this.tA.set(0.3, -0.5, 0));
    const site = type === "nadph" || this.tokenFlip++ % 3 !== 0 ? this.redPos : this.regPos;
    const e = site.clone();
    if (this.tokens.length > 70) { this.arriveToken(type); return; }
    const d = s.distanceTo(e);
    const mid = s.clone().lerp(e, 0.5).add(this.tA.set((e.y - s.y) * rand(-0.25, 0.25), -(e.x - s.x) * rand(-0.25, 0.25), rand(0.5, 2)));
    this.tokens.push({ type, s, e, mid, p: s.clone(), t: 0, dur: clamp(d / 7, 1.2, 4), wob: rand(0, TAU) });
  }
  arriveToken(type) {
    const S = this.S;
    if (type === "atp") S.atpStore = Math.min(24, S.atpStore + 1);
    else S.nadphStore = Math.min(24, S.nadphStore + 1);
  }

  spawnPhoton(lp) {
    const S = this.S, toPSII = Math.random() < 0.5;
    const tgt = at((toPSII ? X.psii : X.psi) + rand(-1.8, 1.8), HALF + 0.4, rand(-0.6, 1.2));
    const lam = S.white ? rand(400, 700) : S.lambda;
    const dir = tgt.clone().sub(lp), d = dir.length();
    dir.normalize();
    this.photons.push({ s: lp.clone(), tg: tgt, dir, p: lp.clone(), t: 0, dur: d / 26, col: new THREE.Color(PM.waveColour(lam)), abs: Math.random() < PM.absorb(lam), pass: -1, toPSII });
  }

  // ---------- per-frame simulation (dt = sim time) ----------
  step(dt, t, model) {
    const S = this.S, acc = this.acc;
    let guard = 0;
    acc.e += model.rate * 0.15 * dt;
    while (acc.e >= 1 && guard++ < 10) { acc.e -= 1; this.fireElectron(); }
    const flux = 0.6 * S.hPool;
    S.hPool = Math.max(0, S.hPool - flux * dt);
    acc.atp += (flux * dt) / 3;
    guard = 0;
    while (acc.atp >= 1 && guard++ < 10) { acc.atp -= 1; this.spawnToken("atp"); }
    this.rotorSpeed = lerp(this.rotorSpeed, Math.min(14, flux * 0.9), Math.min(1, dt * 3));
    this.rotor += this.rotorSpeed * dt;
    acc.fix += (model.rate / 12) * dt;
    guard = 0;
    while (acc.fix >= 1 && guard++ < 10) { acc.fix -= 1; this.fixOne(true); }
    this.wheelPhase += dt * (model.rate / 12) * 0.55;
    this.rubPulse = Math.max(0, this.rubPulse - dt * 2.5);
    // Elodea bubbles (time-lapse ×6)
    acc.bubble += (model.rate / 60) * 6 * dt;
    guard = 0;
    while (acc.bubble >= 1 && guard++ < 5) { acc.bubble -= 1; if (this.bubbles.length < 40) this.bubbles.push({ y: 0, x: rand(-1, 1), r: rand(0.8, 1.3), v: rand(0.85, 1.15) }); }
    for (const b of this.bubbles) b.y += dt * 0.32 * b.v;
    for (let i = this.bubbles.length - 1; i >= 0; i--) if (this.bubbles[i].y >= 1) { this.bubbles.splice(i, 1); S.bubblesCounted++; }
    this.stepMembrane(dt, model);
    this.stepCalvin(dt);
    for (let i = this.tokens.length - 1; i >= 0; i--) {
      const k = this.tokens[i];
      k.t += dt / k.dur;
      if (k.t >= 1) { this.tokens.splice(i, 1); this.arriveToken(k.type); this.flash(k.e, 1.6, COL[k.type], 0.3); continue; }
      const e = ease(k.t), a = (1 - e) * (1 - e), b = 2 * (1 - e) * e, c = e * e;
      k.p.set(0, 0, 0).addScaledVector(k.s, a).addScaledVector(k.mid, b).addScaledVector(k.e, c);
      k.p.x += Math.sin(t * 3 + k.wob) * 0.15; k.p.y += Math.cos(t * 2.6 + k.wob) * 0.15;
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) { this.flashes[i].life += dt; if (this.flashes[i].life > this.flashes[i].max) this.flashes.splice(i, 1); }
  }

  stepMembrane(dt, model) {
    const S = this.S;
    const lp = this.lampPos(this.tB);
    const rateP = S.lampOn ? 2 + 22 * Math.min(1, model.I) : 0;
    this.acc.photon += rateP * dt;
    let guard = 0;
    while (this.acc.photon >= 1 && guard++ < 6) { this.acc.photon -= 1; if (this.photons.length < 44) this.spawnPhoton(lp); }
    for (let i = this.photons.length - 1; i >= 0; i--) {
      const p = this.photons[i];
      if (p.pass < 0) {
        p.t += dt / Math.max(0.05, p.dur);
        p.p.lerpVectors(p.s, p.tg, Math.min(1, p.t));
        if (p.t >= 1) {
          if (p.abs) {
            this.flash(p.tg, 2.2, "#" + p.col.getHexString(), 0.4);
            const excess = model.L > 0 ? 1 - model.rate / model.L : 0;
            if (Math.random() < excess * 0.7) this.flash(at(p.tg.x, 2.2, p.tg.z), 1.5, "#fb923c", 0.8, true);
            this.photons.splice(i, 1);
          } else p.pass = 0;
        }
      } else {
        p.pass += dt;
        p.p.copy(p.tg).addScaledVector(p.dir, 26 * p.pass);
        if (p.pass > 0.5) this.photons.splice(i, 1);
      }
    }
    const path = this.electronPath;
    for (let i = this.electrons.length - 1; i >= 0; i--) {
      const e = this.electrons[i];
      e.t += dt / 0.32;
      while (e.t >= 1) { e.t -= 1; e.seg++; }
      if (e.seg === 4 && !e.flashedPSI) { e.flashedPSI = true; this.flash(at(X.psi, 0, 0.6), 3, "#bbf7d0"); }
      if (e.seg >= path.length - 1) this.electrons.splice(i, 1);
    }
    // lumen H⁺ (Brownian, bounded by the two membranes)
    const lx0 = -15.5, lx1 = 15.5, z0 = -5, z1 = 3.8;
    for (const h of this.hions) {
      const v = h.v, d = Math.pow(0.92, dt * 60);
      v.x += rand(-1, 1) * 5.6 * dt; v.y += rand(-1, 1) * 5.6 * dt; v.z += rand(-1, 1) * 4 * dt;
      v.multiplyScalar(d);
      h.p.addScaledVector(v, dt);
      const b = bend(h.p.x), ly0 = b + HALF + 0.45, ly1 = b + TOPM - HALF - 0.45;
      if (h.p.x < lx0) { h.p.x = lx0; v.x = Math.abs(v.x); } if (h.p.x > lx1) { h.p.x = lx1; v.x = -Math.abs(v.x); }
      if (h.p.y < ly0) { h.p.y = ly0; v.y = Math.abs(v.y); } if (h.p.y > ly1) { h.p.y = ly1; v.y = -Math.abs(v.y); }
      if (h.p.z < z0) { h.p.z = z0; v.z = Math.abs(v.z); } if (h.p.z > z1) { h.p.z = z1; v.z = -Math.abs(v.z); }
    }
    const target = Math.min(70, Math.round(S.hPool));
    guard = 0;
    const exitP = at(X.atps - 0.6, HALF + 0.6, 0);
    while (this.hions.length > target + 1 && guard++ < 4) {
      let bi = 0, bd = 1e9;
      this.hions.forEach((h, k) => { const d = h.p.distanceToSquared(exitP); if (d < bd) { bd = d; bi = k; } });
      const h = this.hions.splice(bi, 1)[0];
      if (this.movers.length < 40) this.movers.push({ pts: [h.p.clone(), exitP.clone(), at(X.atps - 0.7, -0.6, 0.4), at(X.atps + rand(-0.6, 0.6), -5.8, rand(-0.5, 0.8))], seg: 0, t: 0, segDur: 0.3, end: "stroma" });
    }
    guard = 0;
    while (this.hions.length < target - 3 && guard++ < 3) {
      const x = rand(lx0, lx1);
      this.hions.push({ p: at(x, rand(HALF + 0.6, TOPM - HALF - 0.6), rand(z0, z1)), v: new THREE.Vector3() });
    }
    for (let i = this.movers.length - 1; i >= 0; i--) {
      const m = this.movers[i];
      m.t += dt / m.segDur;
      while (m.t >= 1) { m.t -= 1; m.seg++; }
      if (m.seg >= m.pts.length - 1) {
        this.movers.splice(i, 1);
        if (m.end === "lumen" && this.hions.length < 75) this.hions.push({ p: m.pts[m.pts.length - 1].clone(), v: new THREE.Vector3(rand(-0.8, 0.8), rand(0, 1.2), rand(-0.5, 0.5)) });
      }
    }
    for (let i = this.o2s.length - 1; i >= 0; i--) {
      const o = this.o2s[i];
      o.life += dt; o.p.addScaledVector(o.v, dt);
      if (o.life > 4.5) this.o2s.splice(i, 1);
    }
    for (let i = this.waters.length - 1; i >= 0; i--) {
      const w = this.waters[i];
      w.t += dt / w.dur;
      if (w.t >= 1) { this.waters.splice(i, 1); this.flash(this.pts.oec, 1.4, COL.h2o, 0.3); }
    }
  }

  stepCalvin(dt) {
    const S = this.S, Z = this.zone;
    const want = Math.round(3 + S.co2 * 70);
    if (this.co2s.length < want && Math.random() < dt * 4) {
      const side = Math.floor(Math.random() * 4);
      const x = side === 0 ? Z.x0 : side === 1 ? Z.x1 : rand(Z.x0, Z.x1), y = side === 2 ? Z.y0 : side === 3 ? Z.y1 : rand(Z.y0, Z.y1);
      this.co2s.push({ p: new THREE.Vector3(x, y, rand(Z.z0, Z.z1)), v: new THREE.Vector3(), a: 0, rot: rand(0, TAU), spin: rand(0, TAU) });
    }
    if (this.co2s.length > want + 2) { const c = this.co2s.find((cc) => !cc.held); if (c) c.leaving = true; }
    const W = this.WC;
    for (let i = this.co2s.length - 1; i >= 0; i--) {
      const c = this.co2s[i];
      c.a = c.leaving ? c.a - dt * 2 : Math.min(1, c.a + dt * 2);
      if (c.leaving && c.a <= 0) { this.co2s.splice(i, 1); continue; }
      if (c.held) continue;
      const v = c.v, d = Math.pow(0.9, dt * 60);
      v.x += rand(-1, 1) * 3.6 * dt; v.y += rand(-1, 1) * 3.6 * dt;
      v.multiplyScalar(d);
      c.p.addScaledVector(v, dt);
      c.rot += dt * 0.6;
      if (c.p.x < Z.x0) { c.p.x = Z.x0; v.x = Math.abs(v.x); } if (c.p.x > Z.x1) { c.p.x = Z.x1; v.x = -Math.abs(v.x); }
      if (c.p.y < Z.y0) { c.p.y = Z.y0; v.y = Math.abs(v.y); } if (c.p.y > Z.y1) { c.p.y = Z.y1; v.y = -Math.abs(v.y); }
      const dx = c.p.x - W.x, dy = c.p.y - W.y, dd = Math.hypot(dx, dy) || 1;
      if (dd < this.WR * 0.75) { v.x += (dx / dd) * 1.2; v.y += (dy / dd) * 1.2; }
    }
    for (let i = this.flyCO2.length - 1; i >= 0; i--) {
      const f = this.flyCO2[i];
      f.t += dt / f.dur;
      if (f.t >= 1) { this.flyCO2.splice(i, 1); this.flash(this.rubPos, 3, "#4fd1c5", 0.35); }
    }
    for (let i = this.g3ps.length - 1; i >= 0; i--) { this.g3ps[i].t += dt / this.g3ps[i].dur; if (this.g3ps[i].t >= 1) this.g3ps.splice(i, 1); }
    for (let i = this.pops.length - 1; i >= 0; i--) { this.pops[i].t += dt; if (this.pops[i].t > 1.2) this.pops.splice(i, 1); }
  }

  // ---------- per-frame drawing ----------
  render(t, model, ui = {}) {
    const S = this.S, m = this.tmpM, q = this.tmpQ, v = this.tmpV, s = this.tmpS, still = this.engine.reducedMotion;
    if (!still) { this.specks.rotation.y = Math.sin(t * 0.03) * 0.04; }
    // lamp + beam
    const lp = this.lampPos(this.tB), hex = this.lampHex(), I = Math.min(1, model.I);
    this.lamp.position.copy(lp);
    this.bulbMat.color.set(S.lampOn ? hex : "#475569");
    if (S.lampOn) this.bulbMat.color.multiplyScalar(1.6);
    this.lampGlow.visible = S.lampOn;
    this.lampGlow.material.color.set(hex);
    this.lampGlow.scale.setScalar(4 + 5 * I);
    this.lampLight.intensity = S.lampOn ? 8 + 34 * I : 0;
    this.lampLight.color.set(hex);
    this.beam.visible = S.lampOn;
    if (S.lampOn) {
      const T = this.pts.T, dir = this.tA.copy(T).sub(lp), len = dir.length();
      this.beam.position.copy(lp);
      this.beam.quaternion.setFromUnitVectors(DOWN, dir.normalize());
      this.beam.scale.set(8, len, 3.2);
      this.beamMat.color.set(hex);
      this.beamMat.opacity = 0.03 + 0.08 * I;
    }
    // proteins: hover glow
    for (const [k, g] of Object.entries(this.prot)) {
      const hot = ui.hover === k ? 0.35 : 0;
      for (const mat of g.userData.mats || []) mat.emissive.set(mat.color).multiplyScalar(hot);
    }
    // PQ / PC shuttles
    const ph = still ? 0.5 : 0.5 + 0.5 * Math.sin(t * 2.2);
    this.pq.position.copy(at(lerp(X.psii + 1.6, X.b6f - 1.1, ph), -0.4, 0.9));
    this.pc.position.copy(this.pts.pc).add(this.tA.set(still ? 0 : Math.sin(t * 1.7) * 0.6, 0, 0));
    // ATP synthase rotor and the active β subunit
    this.rotorObj.rotation.y = this.rotor;
    const active = Math.floor((((this.rotor % TAU) + TAU) % TAU) / (TAU / 3));
    this.betas.forEach((b, i) => { b.material = i === active && this.rotorSpeed > 0.3 ? this.bMats.bHot : this.bMats.bSub; });
    // lumen colour follows pH
    const pH = this.pH();
    this.lumenMat.color.set("#1f5e4a").lerp(this.tC.set("#9d2f7e"), clamp((7.6 - pH) / 2.8, 0, 1));
    this.lumenMat.opacity = 0.08 + 0.12 * clamp((7.6 - pH) / 2.8, 0, 1);
    // photons
    let n = 0;
    for (const p of this.photons) {
      const k = 1 + 0.6 * Math.sin(t * 20 + p.t * 8);
      q.setFromUnitVectors(this.tA.set(0, 1, 0), p.dir);
      const fade = p.pass >= 0 ? Math.max(0, 1 - p.pass / 0.5) : 1;
      this.mPhoton.setMatrixAt(n, m.compose(p.p, q, s.set(k * fade, 1, k * fade)));
      this.mPhoton.setColorAt(n++, this.tC.copy(p.col).multiplyScalar(2.2 * fade));
    }
    this.mPhoton.count = n; this.mPhoton.instanceMatrix.needsUpdate = true; if (this.mPhoton.instanceColor) this.mPhoton.instanceColor.needsUpdate = true;
    // electrons
    n = 0;
    const path = this.electronPath;
    for (const e of this.electrons) {
      const a = path[e.seg], b = path[Math.min(e.seg + 1, path.length - 1)];
      v.lerpVectors(a, b, ease(e.t));
      this.mElectron.setMatrixAt(n++, m.makeTranslation(v.x, v.y, v.z));
    }
    this.mElectron.count = n; this.mElectron.instanceMatrix.needsUpdate = true;
    // H⁺ (lumen + moving)
    n = 0;
    for (const h of this.hions) this.mH.setMatrixAt(n++, m.makeTranslation(h.p.x, h.p.y, h.p.z));
    for (const mv of this.movers) {
      const a = mv.pts[mv.seg], b = mv.pts[Math.min(mv.seg + 1, mv.pts.length - 1)];
      v.lerpVectors(a, b, mv.t);
      if (n < 140) this.mH.setMatrixAt(n++, m.makeTranslation(v.x, v.y, v.z));
    }
    this.mH.count = n; this.mH.instanceMatrix.needsUpdate = true;
    // O₂, H₂O
    n = 0;
    for (const o of this.o2s) {
      const a = clamp(Math.min(o.life * 3, (4.5 - o.life) / 1.2), 0, 1);
      this.mO2.setMatrixAt(n++, m.compose(o.p, q.setFromEuler(this.tmpE.set(0, o.life, o.life * 0.5)), s.setScalar(a)));
    }
    this.mO2.count = n; this.mO2.instanceMatrix.needsUpdate = true;
    n = 0;
    for (const w of this.waters) { v.lerpVectors(w.s, this.pts.oec, ease(w.t)); this.mH2O.setMatrixAt(n++, m.compose(v, q.setFromEuler(this.tmpE.set(0, w.t * 3, 0)), s.set(1, 1, 1))); }
    this.mH2O.count = n; this.mH2O.instanceMatrix.needsUpdate = true;
    // tokens
    let na = 0, nn = 0;
    for (const k of this.tokens) {
      q.setFromEuler(this.tmpE.set(0, k.t * 4 + k.wob, Math.sin(k.wob) * 0.4));
      if (k.type === "atp") this.mATP.setMatrixAt(na++, m.compose(k.p, q, s.set(1, 1, 1)));
      else this.mNADPH.setMatrixAt(nn++, m.compose(k.p, q, s.set(1, 1, 1)));
    }
    this.mATP.count = na; this.mATP.instanceMatrix.needsUpdate = true;
    this.mNADPH.count = nn; this.mNADPH.instanceMatrix.needsUpdate = true;
    // CO₂ (free + flying to Rubisco)
    n = 0;
    const list = [];
    for (const c of this.co2s) {
      const sc = c.a * (c.held ? 1.35 : 1);
      this.mCO2.setMatrixAt(n++, m.compose(c.p, q.setFromEuler(this.tmpE.set(c.spin, 0, c.rot)), s.setScalar(Math.max(0.001, sc))));
      list.push(c);
    }
    for (const f of this.flyCO2) {
      if (n >= 60) break;
      v.lerpVectors(f.s, this.rubPos, ease(f.t));
      this.mCO2.setMatrixAt(n++, m.compose(v, q.identity(), s.setScalar(1 - f.t * 0.4)));
    }
    this.mCO2.count = n; this.mCO2.instanceMatrix.needsUpdate = true;
    this.mCO2.userData.list = list;
    this.mCO2.computeBoundingSphere();
    // Calvin wheel: carbon compounds circulating clockwise
    const dead = model.P < 4, W = this.WC;
    for (let k = 0; k < 12; k++) {
      const a = this.aR - this.wheelPhase - (k / 12) * TAU;
      let rel = (this.aR - a) % TAU; if (rel < 0) rel += TAU;
      const col = rel < TAU / 3 ? COL.pga : rel < (2 * TAU) / 3 ? COL.g3p : COL.rubp;
      this.carbons.setMatrixAt(k, m.makeTranslation(W.x + this.WR * Math.cos(a), W.y + this.WR * Math.sin(a), W.z));
      this.carbons.setColorAt(k, this.tC.set(col).multiplyScalar(dead ? 0.4 : 1));
    }
    this.carbons.instanceMatrix.needsUpdate = true; this.carbons.instanceColor.needsUpdate = true;
    this.wheelMat.color.set(dead ? "#f87171" : "#4fd1c5");
    this.wheelMat.emissive.set(dead ? "#7f1d1d" : "#14b8a6");
    // G3P leaving the cycle toward the centre
    n = 0;
    for (const g of this.g3ps) {
      v.lerpVectors(this.redPos, this.hex.position, ease(g.t));
      for (let j = 0; j < 3; j++) this.mG3P.setMatrixAt(n++, m.makeTranslation(v.x + (j - 1) * 0.3, v.y, v.z + 0.2));
    }
    this.mG3P.count = n; this.mG3P.instanceMatrix.needsUpdate = true;
    const pop = this.pops.length ? 1 + 0.35 * Math.sin(Math.min(1, this.pops[this.pops.length - 1].t * 2) * Math.PI) : 1;
    this.hex.scale.setScalar(pop);
    this.hex.material.emissiveIntensity = this.pops.length ? 0.9 : 0.3;
    if (!still) this.hex.rotation.z = t * 0.2;
    // Rubisco: pulses when it fixes CO₂; heat damage loosens and reddens it
    const dmg = clamp(Math.max(S.den, (S.temp - 36) / 8), 0, 1);
    this.rubL.color.set("#34d399").lerp(this.tC.set("#9a3b3b"), dmg);
    this.rubL2.color.set("#14b8a6").lerp(this.tC.set("#7f1d1d"), dmg);
    this.rubS.color.set("#a7f3d0").lerp(this.tC.set("#fca5a5"), dmg);
    for (const [i, p] of this.rubParts.entries()) {
      const spread = 1 + dmg * (0.5 + 0.25 * Math.sin(t * 5 + i));
      p.position.copy(p.userData.base).multiplyScalar(spread);
      if (dmg > 0 && !still) p.position.x += Math.sin(t * 9 + i * 3) * 0.06 * dmg;
    }
    if (!still) this.rubGroup.rotation.y = t * 0.3;
    const hot = ui.hover === "rubisco" ? 0.3 : 0;
    this.rubL.emissive.set("#14b8a6").multiplyScalar(this.rubPulse * 0.9 + hot);
    this.rubGlow.material.color.set(dead ? "#f87171" : "#4fd1c5");
    this.rubGlow.material.opacity = 0.18 + this.rubPulse * 0.5;
    this.rubGlow.scale.setScalar(4 + this.rubPulse * 2);
    // flashes
    let si = 0;
    for (const f of this.flashes) {
      if (si >= this.sprites.length) break;
      const sp = this.sprites[si++], a = 1 - f.life / f.max;
      sp.visible = true;
      sp.position.copy(f.p); if (f.rise) sp.position.y += f.life * 1.3;
      sp.material.color.set(f.col);
      sp.material.opacity = 0.75 * a;
      sp.scale.setScalar(f.r * (0.6 + 0.6 * (1 - a)));
    }
    for (; si < this.sprites.length; si++) this.sprites[si].visible = false;
  }

  pH() { return clamp(7.6 - this.S.hPool * 0.05, 4.8, 7.6); }
}
