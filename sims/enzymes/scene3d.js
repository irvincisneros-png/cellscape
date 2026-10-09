// Enzyme Lab — 3D renderer for the CellScape engine. Reads the tested 2D model (model.js) every frame and maps
// it into a 3D volume of cytosol: model x → X, model y → Y (up), and each molecule gets its own depth (Z) that
// drifts by Brownian motion. Collisions, binding, catalysis and denaturation all stay in the model; depth is
// visual only, so a molecule touching an enzyme in the model is pulled to that enzyme's depth.
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { G as GM, fitPH, motion } from "./model.js";
import { LOOK, CI_COL, NI_COL, DEAD_COL, SITE_COL } from "./draw.js";
import { physical, glass, softDot, paint, hash, wobble } from "../../assets/js/world/materials.js";

export const WW = 600, WH = 380;          // fixed model size (same as the headless experiments)
export const S = 0.03;                    // world units per model unit
const R = GM.R * S;                       // enzyme radius in world units (0.9)
const ZE = 2.2, ZL = 3.0;                 // depth half-range for enzymes / small molecules
const MAXE = 24, BEADS = 40;
const CAP = { S: 230, CI: 48, NI: 36, P: 110, P2: 110, B: 70 };
const PEP = ["#fb923c", "#f472b6", "#fbbf24", "#fca5a5"];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);

// ---------- enzyme body shader: induced fit, pH distortion, allosteric dimple and unfolding on the GPU ----------
const VERT_DECL = /* glsl */`
uniform float uClose, uDD, uSkew, uFold, uAllo, uT;
uniform vec3 uSeed;
varying float vSite;
varying float vAllo;
float gSite; float gAllo;
float bodyR(vec3 n) {
  float f = uFold, u = 1.0 - f;
  float r = 1.0 + 0.05 * sin(3.0 * n.y + 2.0 * n.z + uSeed.x) + 0.035 * sin(5.0 * n.z + 3.0 * n.x + uSeed.y)
          + 0.02 * sin(7.0 * n.x + 4.0 * n.y + uSeed.z + uT * 0.6);
  // active-site groove centred on +X, its long axis along Y (where the substrate lies)
  float aN = 0.5 * (1.0 - 0.3 * uDD), wN = 0.34 * (1.0 - 0.3 * uDD);
  float c0 = uSkew * uDD * 0.35, c1 = -uSkew * uDD * 0.2;            // pH skews and twists the site
  float gy = asin(clamp(n.y, -1.0, 1.0)) - c0, gz = asin(clamp(n.z, -1.0, 1.0)) - c1;
  float front = smoothstep(0.05, 0.4, n.x);
  float xg = gy / aN, zg = gz / wN;
  float rho = xg * xg * 0.85 + zg * zg;                               // elliptical cleft, rounded floor
  float m = pow(max(0.0, 1.0 - rho * rho), 0.55) * front;
  r -= 0.47 * f * (1.0 - 0.45 * uDD) * m;
  gSite = m * f;
  // induced fit: the lips along both long edges rise and close over the groove
  float wL = wN * (1.0 - 0.32 * uClose);
  float xl = abs(gz) / wL;
  float alongL = max(0.0, 1.0 - pow(abs(gy) / (aN * 1.15), 4.0));
  if (xl >= 0.92 && xl < 2.3) r += sin(3.14159 * (xl - 0.92) / 1.38) * (0.04 + 0.1 * uClose) * f * alongL * front;
  // allosteric site: a dimple on the far side
  float ab = acos(clamp(-n.x, -1.0, 1.0)) / 0.32;
  gAllo = max(0.0, 1.0 - ab) * f;
  r -= 0.27 * f * max(0.0, 1.0 - ab) * (uAllo > 0.5 ? 0.55 : 1.0);
  // unfolding: the compact shape loosens
  r = r * (1.0 + 0.12 * u) + u * (0.2 * sin(9.0 * n.x + uSeed.x * 3.0 + uT * 0.8) + 0.14 * sin(4.0 * n.y + uSeed.y * 2.0));
  return r;
}
`;
const VERT_NORMAL = /* glsl */`
  vec3 n0 = normalize(position);
  vec3 axT = abs(n0.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 tA = normalize(cross(n0, axT)), tB = cross(n0, tA);
  vec3 nA = normalize(n0 + 0.015 * tA), nB = normalize(n0 + 0.015 * tB);
  vec3 pA = nA * bodyR(nA), pB = nB * bodyR(nB);
  vec3 dispPos = n0 * bodyR(n0);
  vec3 objectNormal = normalize(cross(pA - dispPos, pB - dispPos));
  if (dot(objectNormal, n0) < 0.0) objectNormal = -objectNormal;
  vSite = gSite; vAllo = gAllo;
`;

function enzymeMaterial(color) {
  const m = physical(color, { roughness: 0.3, clearcoat: 0.9 });
  const u = {
    uClose: { value: 0 }, uDD: { value: 0 }, uSkew: { value: 1 }, uFold: { value: 1 }, uAllo: { value: 0 }, uT: { value: 0 },
    uSeed: { value: new THREE.Vector3() }, uSiteCol: { value: new THREE.Color(SITE_COL) }, uSiteK: { value: 0.7 }, uSiteGlow: { value: 0.25 },
    uAlloCol: { value: new THREE.Color(NI_COL) }, uAlloK: { value: 0.35 },
  };
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace("void main() {", VERT_DECL + "\nvoid main() {")
      .replace("#include <beginnormal_vertex>", VERT_NORMAL)
      .replace("#include <begin_vertex>", "vec3 transformed = dispPos;");
    sh.fragmentShader = sh.fragmentShader
      .replace("void main() {", "uniform vec3 uSiteCol, uAlloCol; uniform float uSiteK, uSiteGlow, uAlloK; varying float vSite; varying float vAllo;\nvoid main() {")
      .replace("#include <color_fragment>", `#include <color_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, uSiteCol, clamp(vSite * uSiteK, 0.0, 1.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, uAlloCol, clamp(vAllo * uAlloK, 0.0, 1.0));`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        totalEmissiveRadiance += uSiteCol * vSite * uSiteGlow;`);
  };
  m.customProgramCacheKey = () => "cs-enzyme-body";
  return m;
}

// ---------- small-molecule geometries (long axis along X, centred) ----------
const sphereAt = (r, x, y, z, col, ws = 14, hs = 10) => { const g = new THREE.SphereGeometry(r, ws, hs); g.translate(x, y, z); return paint(g, col); };
const hexAt = (r, x, col) => { const g = new THREE.CylinderGeometry(r, r, 0.08, 6); g.rotateX(Math.PI / 2); g.rotateZ(Math.PI / 6); g.translate(x, 0, 0); return paint(g, col); };
const rod = (x0, x1, rad, col) => { const g = new THREE.CylinderGeometry(rad, rad, Math.abs(x1 - x0), 8); g.rotateZ(Math.PI / 2); g.translate((x0 + x1) / 2, 0, 0); return paint(g, col); };
const XS = [-10.5, -3.5, 3.5, 10.5].map((x) => x * S);

function ligandGeos(key) {
  const out = {};
  if (key === "amylase") {
    out.S = mergeGeometries([rod(XS[0], XS[3], 0.025, "#fef3c7"), ...XS.map((x) => hexAt(3.9 * S, x, "#fde68a")), sphereAt(0.045, 0, 0, 0, "#ffffff", 10, 8)]);
    out.P = out.P2 = mergeGeometries([rod(XS[1], XS[2], 0.025, "#fef3c7"), hexAt(3.9 * S, XS[1], "#fcd34d"), hexAt(3.9 * S, XS[2], "#fcd34d")]);
  } else if (key === "pepsin") {
    out.S = mergeGeometries([rod(XS[0], XS[3], 0.03, "#fde4d4"), ...XS.map((x, i) => sphereAt(4.2 * S, x, 0, 0, PEP[i]))]);
    out.P = mergeGeometries([rod(XS[1], XS[2], 0.03, "#fde4d4"), sphereAt(4.2 * S, XS[1], 0, 0, PEP[0]), sphereAt(4.2 * S, XS[2], 0, 0, PEP[1])]);
    out.P2 = mergeGeometries([rod(XS[1], XS[2], 0.03, "#fde4d4"), sphereAt(4.2 * S, XS[1], 0, 0, PEP[2]), sphereAt(4.2 * S, XS[2], 0, 0, PEP[3])]);
  } else {
    // H₂O₂ (skewed, as the real molecule is) and H₂O
    out.S = mergeGeometries([sphereAt(5 * S, -3.6 * S, 0, 0, "#f87171"), sphereAt(5 * S, 3.6 * S, 0, 0, "#f87171"),
      sphereAt(2.9 * S, -9 * S, 4 * S, 2 * S, "#e8f1ff"), sphereAt(2.9 * S, 9 * S, -1 * S, 4 * S, "#e8f1ff")]);
    const a = (104.5 / 2) * Math.PI / 180, d = 6.5 * S;
    out.P = out.P2 = mergeGeometries([sphereAt(5 * S, 0, 0, 0, "#f87171"), sphereAt(2.9 * S, Math.sin(a) * d, -Math.cos(a) * d, 0, "#e8f1ff"), sphereAt(2.9 * S, -Math.sin(a) * d, -Math.cos(a) * d, 0, "#e8f1ff")]);
  }
  return out;
}
function inhibitorGeos() {
  const cap = new THREE.CapsuleGeometry(5 * S, 15 * S, 6, 14); cap.rotateZ(Math.PI / 2);
  const parts = [paint(cap, CI_COL)];
  for (const x of [-6, 0, 6]) { const t = new THREE.TorusGeometry(5.05 * S, 0.012, 6, 20); t.rotateY(Math.PI / 2); t.translate(x * S, 0, 0); parts.push(paint(t, "#5f0a1c")); }
  const CI = mergeGeometries(parts);
  const oct = new THREE.OctahedronGeometry(1, 0); oct.scale(8 * S, 6 * S, 5 * S);
  const NI = paint(oct, NI_COL);
  return { CI, NI };
}

function ringTexture(dashed) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const c = cv.getContext("2d");
  c.strokeStyle = "#ffffff"; c.lineWidth = 6;
  if (dashed) c.setLineDash([12, 10]);
  c.beginPath(); c.arc(64, 64, 54, 0, Math.PI * 2); c.stroke();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(1, 1, 1);
const _c = new THREE.Color(), _c2 = new THREE.Color(), _mb = new THREE.Matrix4();

export class Scene3D {
  constructor(engine, labelLayer) {
    this.engine = engine;
    this.labelLayer = labelLayer;
    this.root = new THREE.Group();
    this.pickables = [];
    this.reduced = engine.reducedMotion;
    this.buildEnvironment();
    this.buildEnzymes();
    this.buildLigands();
    this.buildFx();
    this.buildLabels();
    this.key = null;
  }

  // ---------- coordinates ----------
  toWorld(x, y, z, out = new THREE.Vector3()) { return out.set((x - WW / 2) * S, (WH / 2 - y) * S, z); }
  toModelXY(X, Y) { return { x: X / S + WW / 2, y: WH / 2 - Y / S }; }

  view() {
    const cam = this.engine.camera, a = cam.aspect, t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const halfW = a < 1 ? 6.6 : 9.4, halfH = 5.9;
    const d = clamp(Math.max(halfW / (t * a), halfH / t), 9, 40) + 3;
    return { target: new THREE.Vector3(0, -0.2, 0), distance: d, dir: new THREE.Vector3(0.08, 0.16, 1) };
  }

  // ---------- environment: crowded cytosol ----------
  buildEnvironment() {
    const env = (this.env = new THREE.Group());
    this.root.add(env);
    env.add(this.speck = makeSpecks());
    // other macromolecules crowding the cytosol, framing the working volume
    const ico = new THREE.IcosahedronGeometry(1, 4); ico.deleteAttribute("normal"); ico.deleteAttribute("uv");
    const g = wobble(mergeVertices(ico), 0.14, 2.3, 1.7);
    const mat = physical("#ffffff", { roughness: 0.55, clearcoat: 0.4 });
    const n = 90, crowd = new THREE.InstancedMesh(g, mat, n);
    const pal = ["#5b7fa6", "#7c6aa6", "#4f8f87", "#a07a5a", "#6d7f99", "#8a6f8f"].map((c) => new THREE.Color(c));
    for (let i = 0; i < n; i++) {
      let x, y, z;
      if (i < 55) { x = (hash(i * 3.1) - 0.5) * 50; y = (hash(i * 5.7) - 0.5) * 32; z = -5.5 - hash(i * 7.9) * 13; }
      else {
        // around the edges of the working volume
        const side = i % 4;
        x = side < 2 ? (side ? 1 : -1) * (10.6 + hash(i * 1.3) * 5) : (hash(i * 2.1) - 0.5) * 26;
        y = side >= 2 ? (side === 2 ? 1 : -1) * (6.9 + hash(i * 4.3) * 3.5) : (hash(i * 6.1) - 0.5) * 16;
        z = (hash(i * 8.3) - 0.5) * 7;
      }
      const sc = (i < 55 ? 0.45 + hash(i * 9.1) * 0.9 : 0.35 + hash(i * 9.1) * 0.5);
      _e.set(hash(i) * 6, hash(i + 1) * 6, hash(i + 2) * 6);
      _m.compose(_v.set(x, y, z), _q.setFromEuler(_e), _v2.set(sc, sc * (0.8 + hash(i + 3) * 0.4), sc));
      crowd.setMatrixAt(i, _m);
      crowd.setColorAt(i, _c.copy(pal[i % pal.length]).multiplyScalar(0.75));
    }
    env.add(crowd);
    // a few cytoskeleton filaments in the background
    const fmat = physical("#94a3b8", { roughness: 0.45 });
    for (let k = 0; k < 3; k++) {
      const pts = [];
      for (let j = 0; j <= 6; j++) pts.push(new THREE.Vector3(-30 + j * 10, (hash(k * 11 + j) - 0.5) * 8 + (k - 1) * 8, -8 - k * 3 - hash(k + j) * 2));
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.16, 8), fmat);
      env.add(tube);
    }
  }

  // ---------- enzymes ----------
  buildEnzymes() {
    const geo = new THREE.SphereGeometry(1, 72, 48);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.25);
    this.enz = [];
    for (let i = 0; i < MAXE; i++) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(geo, enzymeMaterial("#a78bfa"));
      body.userData.enzIdx = i;
      group.add(body);
      group.visible = false;
      this.root.add(group);
      // unfolded-chain paths (group-local): compact yarn ball → extended random coil
      const compact = new Float32Array(BEADS * 3), ext = new Float32Array(BEADS * 3);
      let px = R * 0.7, py = 0, pz = 0, dx = 1, dy = 0, dz = 0;
      for (let b = 0; b < BEADS; b++) {
        const th = b * 0.9 + i, ph = Math.acos(1 - (2 * (b + 0.5)) / BEADS);
        compact[b * 3] = Math.sin(ph) * Math.cos(th) * R * 0.5; compact[b * 3 + 1] = Math.cos(ph) * R * 0.5; compact[b * 3 + 2] = Math.sin(ph) * Math.sin(th) * R * 0.5;
        ext[b * 3] = px; ext[b * 3 + 1] = py; ext[b * 3 + 2] = pz;
        dx += (hash(i * 97 + b * 3) - 0.5) * 1.4; dy += (hash(i * 89 + b * 5) - 0.5) * 1.4; dz += (hash(i * 83 + b * 7) - 0.5) * 1.0;
        const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
        px += dx * 0.15; py += dy * 0.15; pz += dz * 0.15;
      }
      this.enz.push({ group, body, mat: body.material, compact, ext });
    }
    this.beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.085, 10, 8), physical("#ffffff", { roughness: 0.35 }), MAXE * BEADS);
    this.beads.count = 0; this.beads.frustumCulled = false;
    this.root.add(this.beads);
  }

  // ---------- small molecules ----------
  buildLigands() {
    const mat = () => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15 });
    const inst = (geo, cap, kind) => {
      const m = new THREE.InstancedMesh(geo, mat(), cap);
      m.count = 0; m.frustumCulled = false;
      m.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);
      m.userData.ligKind = kind; m.userData.list = [];
      this.root.add(m);
      return m;
    };
    const ig = inhibitorGeos();
    this.lm = { S: inst(new THREE.BufferGeometry(), CAP.S, "S"), CI: inst(ig.CI, CAP.CI, "CI"), NI: inst(ig.NI, CAP.NI, "NI") };
    this.pm = { P: inst(new THREE.BufferGeometry(), CAP.P, "P"), P2: inst(new THREE.BufferGeometry(), CAP.P2, "P") };
    this.bub = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), glass("#bfe6ff", { rim: "#e0f2ff", minAlpha: 0.1, maxAlpha: 0.75, rimStrength: 0.9 }), CAP.B);
    this.bub.count = 0; this.bub.frustumCulled = false;
    this.root.add(this.bub);
    this.pickables.push(this.lm.S, this.lm.CI, this.lm.NI);
    // ghost showing where a dragged molecule would dock
    this.ghost = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: "#e8f1ff", transparent: true, opacity: 0.28, depthWrite: false }));
    this.ghost.visible = false;
    this.root.add(this.ghost);
  }

  setEnzyme(key) {
    if (key === this.key) return;
    this.key = key;
    const g = ligandGeos(key);
    for (const k of ["P", "P2"]) { if (this.pm[k].geometry !== g.P && this.pm[k].geometry !== g.P2) this.pm[k].geometry.dispose(); }
    this.lm.S.geometry.dispose();
    this.lm.S.geometry = g.S; this.pm.P.geometry = g.P; this.pm.P2.geometry = g.P2;
    const col = LOOK[key].enzyme;
    for (const v of this.enz) v.mat.color.set(col);
    this.baseCol = new THREE.Color(col);
  }

  buildFx() {
    const dot = softDot(), ring = ringTexture(false);
    this.ringTex = ring;
    const sprite = (map) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.visible = false; this.root.add(s); return s; };
    this.glows = Array.from({ length: 36 }, () => sprite(dot));
    this.rings = Array.from({ length: 20 }, () => sprite(ring));
    this.selRing = sprite(ringTexture(true));
    this.selRing.material.blending = THREE.NormalBlending;
  }

  buildLabels() {
    const mk = (cls, html = "") => { const d = document.createElement("div"); d.className = `lbl3d ${cls}`; d.innerHTML = html; d.style.display = "none"; this.labelLayer.appendChild(d); return d; };
    this.mk = mk;
    this.siteLbl = mk("ez-tag site", "active site");
    this.alloLbl = mk("ez-tag allo", "allosteric site");
    this.statusLbl = mk("ez-status");
    this.guideLbl = mk("ez-tag guide", "enzyme");
    this.guideSite = mk("ez-tag site", "active site");
    this.floaters = [];
  }

  /** Floating message near a world point. */
  float(text, pos, color) {
    const el = this.mk("ez-float", text);
    el.style.color = color;
    this.floaters.push({ el, pos: pos.clone(), t: 0 });
    if (this.floaters.length > 5) this.floaters.shift().el.remove();
  }

  // ---------- depth model (visual only) ----------
  prepare(w) {
    for (const e of w.enz) if (!e.v3) e.v3 = { z: (Math.random() - 0.5) * 2 * ZE, vz: 0, made: 0 };
    for (const l of w.lig) if (!l.v3) l.v3 = { z: (Math.random() - 0.5) * 2 * ZL, vz: 0, spin: rnd(0, 6.28), vs: 0, tilt: rnd(-0.3, 0.3), zv: 0 };
  }

  /** Depth a molecule appears at: its own depth, pulled to the depth of any enzyme it is touching in the model. */
  blendZ(w, x, y, zOwn) {
    let sw = 0, sz = 0;
    for (const e of w.enz) {
      if (!e.v3) continue;
      const dx = x - e.x, dy = y - e.y;
      if (dx > 110 || dx < -110 || dy > 110 || dy < -110) continue;
      const d = Math.sqrt(dx * dx + dy * dy);
      let k = 1 - (d - (GM.R + 12)) / 55;
      if (k <= 0) continue;
      if (k > 1) k = 1;
      k = k * k * (3 - 2 * k);
      sw += k; sz += k * e.v3.z;
    }
    if (sw <= 0) return zOwn;
    return zOwn + (sz / sw - zOwn) * Math.min(1, sw);
  }

  nearestEnzyme(w, x, y) {
    let best = null, bd = Infinity;
    for (const e of w.enz) { const d = (e.x - x) ** 2 + (e.y - y) ** 2; if (d < bd) { bd = d; best = e; } }
    return best;
  }

  stepDepth(w, dt, T) {
    if (dt <= 0) return;
    const mot = motion(T), n = Math.max(1, Math.ceil(dt * 60)), h = dt / n;
    for (let s = 0; s < n; s++) {
      const dE = Math.pow(0.94, h * 60), dL = Math.pow(0.95, h * 60);
      for (const e of w.enz) {
        const v = e.v3;
        v.vz = (v.vz + rnd(-1, 1) * 420 * S * 0.6 * mot * h) * dE;
        v.z += v.vz * h;
        if (v.z > ZE) { v.z = ZE; v.vz = -Math.abs(v.vz); } else if (v.z < -ZE) { v.z = -ZE; v.vz = Math.abs(v.vz); }
      }
      for (const l of w.lig) {
        const v = l.v3;
        if (l.bound) { v.z = l.bound.v3.z; v.vz = 0; continue; }
        if (l.drag) continue;
        v.vz = (v.vz + rnd(-1, 1) * 2600 * S * 0.5 * mot * h) * dL;
        v.z += v.vz * h;
        if (v.z > ZL) { v.z = ZL; v.vz = -Math.abs(v.vz); } else if (v.z < -ZL) { v.z = -ZL; v.vz = Math.abs(v.vz); }
        v.vs = (v.vs + rnd(-1, 1) * 30 * mot * h) * dL;
        v.spin += v.vs * h;
      }
      for (const q of w.prod) {
        const v = q.v3;
        if (!v || q.bubble) continue;
        v.vz = (v.vz + rnd(-1, 1) * 2600 * S * 0.45 * mot * h) * dL;
        v.z = clamp(v.z + v.vz * h, -ZL, ZL);
      }
    }
  }

  // ---------- poses ----------
  /** Enzyme group transform from the model (+ a gentle cosmetic tumble about the active-site axis). */
  enzymePose(e, group) {
    this.toWorld(e.x, e.y, e.v3.z, group.position);
    const rx = this.reduced ? 0.22 * Math.sin(e.s1) : 0.25 * Math.sin(e.wob * 0.7 + e.s1);
    // the active site is turned partly toward the viewer (+Z) so students can look into the groove
    const ry = -0.75 + (this.reduced ? 0.12 * Math.sin(e.s2) : 0.14 * Math.sin(e.wob * 0.5 + e.s2));
    group.quaternion.setFromEuler(_e.set(rx, ry, -e.a, "ZYX"));
    group.updateMatrixWorld(true);
  }

  /** Bound-ligand matrix: at the active site (or allosteric site) in the enzyme's frame. */
  boundMatrix(l, out) {
    const e = l.bound, g = this.enz[this.idxOf(e)].group;
    const allo = l.site === "allo";
    _v.set(allo ? -(GM.R - 3) * S : (GM.R - 4) * S, 0, 0);
    _q.setFromAxisAngle(_v2.set(0, 0, 1), -(l.a - e.a));
    _mb.compose(_v, _q, _s.set(1, 1, 1));
    return out.multiplyMatrices(g.matrixWorld, _mb);
  }

  idxOf(e) { return this.w.enz.indexOf(e); }

  sitePoint(e, allo, out) {
    const g = this.enz[this.idxOf(e)].group;
    return out.set(allo ? -R * 1.05 : R * 1.05, 0, 0).applyMatrix4(g.matrixWorld);
  }

  enzWorldPos(e, out) { return this.toWorld(e.x, e.y, e.v3?.z || 0, out); }

  // ---------- per frame ----------
  update(w, dt, t, ui) {
    this.w = w;
    this.prepare(w);
    this.stepDepth(w, dt, w.p.temp);
    if (!this.reduced) {
      this.env.rotation.y = Math.sin(t * 0.03) * 0.03;
      this.speck.position.y = Math.sin(t * 0.05) * 0.3;
    }
    const E = ui.E, fit = fitPH(E, w.p.pH), dd = 1 - fit, skew = w.p.pH >= E.pHopt ? 1 : -1;
    this.updateEnzymes(w, t, dd, skew, ui);
    this.updateLigands(w, ui);
    this.updateProducts(w);
    this.updateFx(w, dt, t, ui);
    this.updateLabels(w, ui.realDt ?? dt, ui, fit);
  }

  updateEnzymes(w, t, dd, skew, ui) {
    let b = 0;
    const dead = _c2.set(DEAD_COL);
    this.pickables.length = 3;
    for (let i = 0; i < MAXE; i++) {
      const v = this.enz[i], e = w.enz[i];
      if (!e) { v.group.visible = false; continue; }
      v.group.visible = true;
      this.pickables.push(v.body);
      this.enzymePose(e, v.group);
      const f = e.fold, u = 1 - f, U = v.mat.userData.u;
      U.uClose.value = e.close; U.uDD.value = e.allo ? Math.max(dd, 0.75) : dd; U.uSkew.value = skew;
      U.uFold.value = f; U.uAllo.value = e.allo ? 1 : 0; U.uT.value = e.wob; U.uSeed.value.set(e.s1, e.s2, e.s3);
      U.uSiteK.value = (e.site ? 0.25 : 0.75) * f;
      U.uSiteGlow.value = (e.site ? 0.05 : 0.22 + (ui.hoverE === e ? 0.3 : 0)) * f + e.flash * 0.9;
      U.uSiteCol.value.set(e.allo ? "#f59e0b" : SITE_COL);
      U.uAlloK.value = ui.showAllo ? 0.35 : 0;
      v.mat.color.copy(this.baseCol).lerp(dead, Math.min(1, u * 0.9 + (e.state !== "ok" ? 0.15 : 0)));
      v.mat.emissive.set(e.reject > 0 ? "#f87171" : "#000000").multiplyScalar(e.reject * 0.5);
      const sc = R * (0.28 + 0.72 * f);
      v.body.scale.setScalar(sc);
      // unfolding chain
      if (u > 0.02 && b + BEADS <= MAXE * BEADS) {
        const wig = this.reduced ? 0 : 0.035 * u;
        _c.copy(this.baseCol).lerp(dead, Math.min(1, u * 1.2));
        for (let k = 0; k < BEADS; k++) {
          const j = k * 3;
          _v.set(lerp(v.compact[j], v.ext[j], u), lerp(v.compact[j + 1], v.ext[j + 1], u), lerp(v.compact[j + 2], v.ext[j + 2], u));
          if (wig) _v.x += Math.sin(t * 1.3 + k * 0.7 + i) * wig, _v.y += Math.cos(t * 1.1 + k * 0.9 + i) * wig;
          _v.applyMatrix4(v.group.matrixWorld);
          _m.makeTranslation(_v.x, _v.y, _v.z);
          this.beads.setMatrixAt(b, _m);
          this.beads.setColorAt(b, _c);
          b++;
        }
      }
    }
    this.beads.count = b;
    this.beads.instanceMatrix.needsUpdate = true;
    if (this.beads.instanceColor) this.beads.instanceColor.needsUpdate = true;
  }

  updateLigands(w, ui) {
    const lists = { S: this.lm.S.userData.list, CI: this.lm.CI.userData.list, NI: this.lm.NI.userData.list };
    lists.S.length = lists.CI.length = lists.NI.length = 0;
    for (const l of w.lig) {
      const mesh = this.lm[l.kind], list = lists[l.kind];
      if (list.length >= CAP[l.kind]) continue;
      const v = l.v3;
      const sc = l.alpha < 1 ? Math.max(0.05, l.alpha) : 1;
      if (l.bound && this.idxOf(l.bound) >= 0) {
        this.boundMatrix(l, _m);
        if (l.snap < 1) {
          // easing into the site: blend from the free pose at binding to the exact bound pose
          const k = l.snap * l.snap * (3 - 2 * l.snap);
          const z0 = v.zv;
          this.toWorld(l.x, l.y, lerp(z0, l.bound.v3.z, k), _v2);
          _q2.setFromEuler(_e.set(v.spin * (1 - k), 0, -l.a, "ZYX"));
          _m.decompose(_v, _q, _s);
          _v.lerp(_v2, 1 - k); _q2.slerp(_q, k);
          _m.compose(_v, _q2, _s.set(sc, sc, sc));
        }
        v.px = _m.elements[12]; v.py = _m.elements[13]; v.pz = _m.elements[14];
      } else {
        const z = l.drag ? v.z : this.blendZ(w, l.x, l.y, v.z);
        v.zv = z;
        this.toWorld(l.x, l.y, z, _v);
        // tumbling: a spin about the molecule's own long axis and a small tilt out of the plane, settling as it nears an enzyme
        const near = Math.abs(z - v.z) < 0.02 ? 1 : 0.4;
        _q.setFromEuler(_e.set(this.reduced ? 0.6 : v.spin, v.tilt * near, -l.a, "ZYX"));
        _m.compose(_v, _q, _s.set(sc, sc, sc));
        v.px = _v.x; v.py = _v.y; v.pz = _v.z;
      }
      mesh.setMatrixAt(list.length, _m);
      list.push(l);
    }
    for (const k of ["S", "CI", "NI"]) { const m = this.lm[k]; m.count = lists[k].length; m.instanceMatrix.needsUpdate = true; }
  }

  updateProducts(w) {
    let a = 0, b = 0, c = 0;
    const P = this.pm.P, P2 = this.pm.P2;
    for (const q of w.prod) {
      if (!q.v3) { const e = this.nearestEnzyme(w, q.x, q.y); q.v3 = { z: e?.v3 ? e.v3.z : 0, vz: 0, spin: rnd(0, 6.28) }; }
      const fade = Math.min(1, q.life * 1.5);
      if (q.bubble) {
        if (c >= CAP.B) continue;
        const r = q.r * S * Math.min(1, q.life * 3);
        this.toWorld(q.x, q.y, q.v3.z, _v);
        _m.compose(_v, _q.identity(), _s.set(r, r, r));
        this.bub.setMatrixAt(c++, _m);
        continue;
      }
      const toP2 = (a + b) & 1;
      if (toP2 ? b >= CAP.P2 : a >= CAP.P) continue;
      this.toWorld(q.x, q.y, q.v3.z, _v);
      _q.setFromEuler(_e.set(this.reduced ? 0.5 : q.v3.spin + q.a * 0.3, 0, -q.a, "ZYX"));
      _m.compose(_v, _q, _s.set(fade, fade, fade));
      if (toP2) P2.setMatrixAt(b++, _m); else P.setMatrixAt(a++, _m);
    }
    P.count = a; P2.count = b; this.bub.count = c;
    P.instanceMatrix.needsUpdate = P2.instanceMatrix.needsUpdate = this.bub.instanceMatrix.needsUpdate = true;
  }

  updateFx(w, dt, t, ui) {
    let gi = 0, ri = 0;
    const glow = (pos, col, op, sc) => { if (gi >= this.glows.length) return; const g = this.glows[gi++]; g.visible = true; g.position.copy(pos); g.material.color.set(col); g.material.opacity = op; g.scale.setScalar(sc); };
    const ring = (pos, col, op, sc) => { if (ri >= this.rings.length) return; const g = this.rings[ri++]; g.visible = true; g.position.copy(pos); g.material.color.set(col); g.material.opacity = op; g.scale.setScalar(sc); };
    // reaction flashes at the active site + expanding rings
    for (const e of w.enz) {
      if (e.flash > 0.02) glow(this.sitePoint(e, false, _v), "#fde68a", 0.9 * e.flash, R * 1.6 * (0.5 + e.flash));
      if (e.reject > 0.02) ring(this.enzWorldPos(e, _v), "#f87171", 0.85 * e.reject, R * 2.9);
    }
    for (const f of w.fx) {
      if (!f.v3) { const e = this.nearestEnzyme(w, f.x, f.y); f.v3 = { z: e?.v3 ? e.v3.z : 0 }; }
      ring(this.toWorld(f.x, f.y, f.v3.z, _v), "#fde68a", (1 - f.t / 0.6) * 0.8, (4 + f.t * 45) * S * 2);
    }
    // tap-to-rotate feedback
    if (ui.spin && ui.spin.k > 0) {
      const l = ui.spin.l;
      if (l.v3) ring(_v.set(l.v3.px, l.v3.py, l.v3.pz), "#e8f1ff", ui.spin.k, 0.95);
      ui.spin.k -= (ui.realDt ?? dt) * 1.6 + 0.01;
    }
    // dragging: highlight + docking guide (ghost at the nearest free site, ring green = right way round)
    this.ghost.visible = false;
    const d = ui.drag;
    if (d && d.moved && d.l.v3) {
      const l = d.l;
      _v2.set(l.v3.px, l.v3.py, l.v3.pz);
      glow(_v2, "#ffffff", 0.35, 1.4);
      const near = ui.dockTarget;
      if (near) {
        const allo = l.kind === "NI";
        const g = this.enz[this.idxOf(near)].group;
        _v.set(allo ? -(GM.R - 3) * S : (GM.R - 4) * S, 0, 0);
        _q.setFromAxisAngle(_v2.set(0, 0, 1), allo ? Math.PI : -Math.PI / 2);
        _m.compose(_v, _q, _s.set(1, 1, 1)).premultiply(g.matrixWorld);
        this.ghost.geometry = this.lm[l.kind].geometry;
        _m.decompose(this.ghost.position, this.ghost.quaternion, this.ghost.scale);
        this.ghost.visible = true;
        ring(_v.set(l.v3.px, l.v3.py, l.v3.pz), ui.dockGood ? "#4ade80" : "#f87171", 0.95, 1.1);
      }
    }
    // selection ring
    const sel = ui.sel;
    this.selRing.visible = !!(sel && w.enz.includes(sel));
    if (this.selRing.visible) {
      this.enzWorldPos(sel, this.selRing.position);
      this.selRing.scale.setScalar(R * 3.1);
      this.selRing.material.rotation = this.reduced ? 0 : t * 0.4;
      this.selRing.material.opacity = 0.8;
    }
    for (; gi < this.glows.length; gi++) this.glows[gi].visible = false;
    for (; ri < this.rings.length; ri++) this.rings[ri].visible = false;
  }

  updateLabels(w, dt, ui, fit) {
    const E = this.engine;
    const sel = ui.sel && w.enz.includes(ui.sel) ? ui.sel : null;
    const show = (el, on) => { if (!on) el.style.display = "none"; return on; };
    // selected enzyme: name its sites and its state
    if (show(this.siteLbl, !!sel && sel.fold > 0.3)) E.place(this.siteLbl, this.sitePoint(sel, false, _v).addScaledVector(this.engine.camera.up, 0.05), 0, -16);
    if (show(this.alloLbl, !!sel && sel.fold > 0.3 && ui.showAllo)) E.place(this.alloLbl, this.sitePoint(sel, true, _v), 0, -16);
    if (show(this.statusLbl, !!sel)) {
      if (this.statusLbl.innerHTML !== ui.statusText) this.statusLbl.innerHTML = ui.statusText;
      this.enzWorldPos(sel, _v2); this.sitePoint(sel, false, _v).sub(_v2).setZ(0).normalize(); if (_v.y > 0.3) _v.set(0, -1, 0); else _v.set(0, 1, 0);
      E.place(this.statusLbl, _v2.addScaledVector(_v, R * 2.1));
    }
    // guide labels on one enzyme while nothing is selected
    const g = !sel && ui.guide ? w.enz.find((e) => e.state === "ok") : null;
    if (show(this.guideLbl, !!g)) {
      if (this.guideLbl.innerHTML !== ui.guideText) this.guideLbl.innerHTML = ui.guideText;
      // opposite the active site so the two tags never overlap
      this.enzWorldPos(g, _v2); this.sitePoint(g, false, _v).sub(_v2).setZ(0).normalize();
      E.place(this.guideLbl, _v2.addScaledVector(_v, -R * 1.9));
    }
    if (show(this.guideSite, !!g)) E.place(this.guideSite, this.sitePoint(g, false, _v), 0, -14);
    // floating messages
    for (const f of this.floaters) {
      f.t += dt;
      f.el.style.opacity = String(Math.max(0, Math.min(1, (2.2 - f.t) * 2)));
      E.place(f.el, f.pos, 0, -24 - f.t * 14);
    }
    while (this.floaters.length && this.floaters[0].t > 2.2) this.floaters.shift().el.remove();
  }

  hideLabels() {
    for (const el of [this.siteLbl, this.alloLbl, this.statusLbl, this.guideLbl, this.guideSite]) el.style.display = "none";
  }
}

function makeSpecks() {
  const n = 420, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const pal = ["#5eead4", "#a78bfa", "#fbbf24", "#93c5fd", "#f9a8d4"].map((c) => new THREE.Color(c));
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 46; pos[i * 3 + 1] = (Math.random() - 0.5) * 30; pos[i * 3 + 2] = -Math.random() * 22 + 4;
    const c = pal[i % pal.length]; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 0.12, map: softDot(), vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
}
