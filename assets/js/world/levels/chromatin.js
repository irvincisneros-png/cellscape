// Molecular level: chromosome → chromatin loops → fibre → nucleosomes → bare DNA, in one continuous zoom.
// True relative scale (1 unit = 10 nm): a chromatid is ≈ 0.5 µm thick, a nucleosome 11 nm, DNA 2 nm.
// Zooming in reveals the next layer of packing around the model gene (a β-globin fragment, imported from
// sims/protein-synthesis/model.js). ChromatinModel (chromatinModel.js) links histone acetylation, promoter
// DNA methylation and mitotic condensation to how open the gene is and whether RNA polymerase can transcribe it.
import * as THREE from "three";
import * as K from "../../kit.js";
import { physical, softDot, hash, paint, wobble } from "../materials.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ChromatinModel } from "./chromatinModel.js";
import { PARTS, ZOOM, MISSIONS, QUIZ, narrative } from "./chromatinContent.js";
import { CODING, UPSTREAM, BASE_COL, DNA_PAIR } from "../../../../sims/protein-synthesis/model.js";

const TAU = Math.PI * 2;
const LEN = 400, Y0 = 130;                       // chromosome length (4 µm), p-arm tip at y = 130
const U_C = 0.325, U_G = 0.0625, U_INS = 0.026;  // centromere, β-globin band (11p15.4), insulin band (11p15.5)
const BAND_W = 0.008;
const HX = [0, 175];                             // maternal / paternal chromosome x in mitosis
const SEG = 600, RAD = 16;
const C0M = new THREE.Vector3(87, -70, 0), C0I = new THREE.Vector3(18, 55, -20);   // centre of the whole-pair view (mitosis / interphase)
const C0 = C0M.clone();
const COL = [{ light: "#f9a8d4", dark: "#831843" }, { light: "#93c5fd", dark: "#1e3a8a" }];
const DNA_COL = "#e9d5ff", MRNA_COL = "#60a5fa";
const HBB_INTRONS = [[0.089, 0.17], [0.31, 0.84]];
const BP = 0.034, HELIX_R = 0.1, PITCH = 10.5 * BP;   // B-DNA: 0.34 nm per bp, 10.5 bp per turn, 2 nm wide

const CSS = `
.chr-chip .w { color: var(--ink-faint); }
.chr-ladder { display: flex; gap: 2px; padding: 3px; }
.chr-ladder button { background: none; border: 0; color: var(--ink-faint); font: inherit; font-size: 0.74rem; padding: 3px 7px; border-radius: 999px; cursor: pointer; }
.chr-ladder button[aria-current="true"] { background: rgba(79,209,197,0.18); color: var(--ink); }
.chr .seq { font-family: ui-monospace, Menlo, monospace; font-size: 0.78rem; line-height: 1.6; word-break: break-all; color: var(--ink); background: var(--tint-1); border: 1px solid var(--panel-border); border-radius: 8px; padding: 6px 8px; margin: 6px 0; }
.chr .seq .me { color: var(--t-pink); text-shadow: 0 0 6px var(--t-pink); }
.chr .seq small { display: block; color: var(--ink-faint); font-family: var(--font-body, inherit); font-size: 0.72rem; }
.chr .ko small { display: block; color: var(--ink-faint); font-size: 0.74rem; margin: -2px 0 6px 24px; }
.chr .ok { color: var(--good); font-weight: 600; }
`;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fade = (d, far, near) => { const t = clamp((far - d) / (far - near), 0, 1); return t * t * (3 - 2 * t); };
const taper = (u) => Math.sqrt(clamp(u / 0.035, 0.02, 1)) * Math.sqrt(clamp((1 - u) / 0.035, 0.02, 1));
const radMito = (u) => 26 * taper(u) * (1 - 0.5 * Math.exp(-(((u - U_C) / 0.018) ** 2)));
const radInter = (u) => 8 * taper(u);

/** Mitotic centreline: two sister chromatids (s = ±1) side by side, touching at the centromere. */
function mitoPoint(h, s, u, out) {
  const y = Y0 - LEN * u;
  return out.set(HX[h] + s * (0.97 * radMito(u) + 0.11 * Math.abs(y)), y, 4 * Math.sin(u * 9 + h * 2 + s));
}
/** Interphase centreline: a long, loose tangle (a chromosome territory). */
function tangle(h, u, out) {
  const p = h ? [0.4, 2.1, 1.3, 0.2, 2.9, 0.8, 1.7, 3.1, 0.5] : [0.3, 1.1, 2.2, 0.7, 2.0, 1.4, 1.7, 0.4, 2.6];
  const A = 78;
  return out.set(
    A * (0.55 * Math.sin(TAU * 2.3 * u + p[0]) + 0.33 * Math.sin(TAU * 5.7 * u + p[1]) + 0.14 * Math.sin(TAU * 13 * u + p[2])),
    A * (0.6 * Math.cos(TAU * 1.9 * u + p[3]) + 0.33 * Math.sin(TAU * 6.3 * u + p[4]) + 0.14 * Math.cos(TAU * 11 * u + p[5])),
    A * 0.7 * (0.5 * Math.sin(TAU * 2.9 * u + p[6]) + 0.33 * Math.cos(TAU * 4.9 * u + p[7]) + 0.14 * Math.sin(TAU * 12 * u + p[8])));
}

/** B-DNA backbone helix along x, centred at the origin. */
class HelixCurve extends THREE.Curve {
  constructor(len, phase) { super(); this.len = len; this.phase = phase; }
  getPoint(t, target = new THREE.Vector3()) {
    const x = -this.len / 2 + t * this.len, a = this.phase + (TAU * x) / PITCH;
    return target.set(x, HELIX_R * Math.cos(a), HELIX_R * Math.sin(a));
  }
}

/** A nucleosome (local z = superhelical axis). detail adds a histone octamer of 8 blobs and 4 tails. */
const TAIL_TIPS = [[0.62, 0.28, 0.3], [-0.58, 0.32, -0.3], [0.22, -0.64, 0.28], [-0.3, -0.58, -0.26]];
function nucleosomeGeo(detail) {
  const parts = [];
  const turns = 1.65, R = 0.43, H = 0.46;
  const wrap = new THREE.Curve();
  wrap.getPoint = (t, out = new THREE.Vector3()) => {
    const a = (t - 0.5) * turns * TAU;
    return out.set(R * Math.cos(a), R * Math.sin(a), (t - 0.5) * H);
  };
  parts.push(paint(new THREE.TubeGeometry(wrap, detail ? 80 : 36, 0.1, detail ? 8 : 5), DNA_COL));
  if (detail) {
    const cols = ["#818cf8", "#34d399", "#fbbf24", "#fb7185"]; // H3, H4, H2A, H2B
    for (let k = 0; k < 8; k++) {
      const layer = k < 4 ? 1 : -1, a = ((k % 4) / 4) * TAU + (layer > 0 ? 0 : Math.PI / 4);
      const g = new THREE.IcosahedronGeometry(0.19, 2);
      g.translate(Math.cos(a) * 0.19, Math.sin(a) * 0.19, layer * 0.12);
      parts.push(paint(g, cols[k % 4]));
    }
    for (const [x, y, z] of TAIL_TIPS) {
      const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x * 0.4, y * 0.4, z * 0.5), new THREE.Vector3(x * 0.85, y * 0.7, z * 1.2), new THREE.Vector3(x, y, z));
      parts.push(paint(new THREE.TubeGeometry(c, 8, 0.028, 4), "#c7d2fe"));
    }
  } else {
    parts.push(paint(new THREE.CylinderGeometry(0.36, 0.36, 0.5, 14).rotateX(Math.PI / 2), "#a5b4fc"));
  }
  return mergeGeometries(parts);
}

export function create(engine) {
  if (!document.getElementById("chr-css")) {
    const st = document.createElement("style");
    st.id = "chr-css"; st.textContent = CSS;
    document.head.appendChild(st);
  }
  const lens = engine.lens;
  const M = new ChromatinModel();
  const root = new THREE.Group();
  const pickables = [];
  const tmpM = new THREE.Matrix4(), tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpV3 = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0), Zv = new THREE.Vector3(0, 0, 1);
  const tag = (o, kind, extra = {}) => { o.traverse?.((m) => { if (m.isMesh || m.isInstancedMesh) Object.assign(m.userData, { kind }, extra); }); Object.assign(o.userData, { kind }, extra); return o; };
  const state = { dived: false, labels: true, minD: Infinity, clicked: {}, wasSilenced: false, memA: false, memory: false };

  // ---------- link to the nucleus (the same model gene) ----------
  const pm = engine.stack.at(-1)?.inst?.model;
  const parentGene = pm && Array.isArray(pm.genes) ? pm.genes.find((g) => g.id === "hbb") : null;
  if (parentGene) {
    M.supply = pm.supply ?? M.supply;
    M.acOn = !parentGene.closed;
    if (parentGene.epi < 0.5) { M.meOn = true; M.me = 1; }
    M.ac = M.acOn ? 1 - 0.85 * M.me : 0;
    M.open = M.epiOpen;
  }
  function pushParent(userChange) {
    if (!parentGene) return;
    parentGene.closed = !M.acOn;
    parentGene.epi = Math.max(0, 1 - 0.97 * M.me);
    if (userChange) { pm.shared = pm.shared || {}; pm.shared.dirty = true; }
  }

  // ---------- the chromosome pair: 4 chromatid tubes that morph between interphase and mitosis ----------
  const L = new THREE.Vector3();                   // the β-globin locus (maternal, sister −1), fixed in both states
  mitoPoint(0, -1, U_G, L);
  const centres = [];                              // per tube: { mito: Float32Array, inter: Float32Array } centreline samples
  const bodyUniforms = { uHoleC: { value: L.clone() }, uHoleR: { value: 0 }, uGeneGlow: { value: 0.6 } };
  const bodyMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color("#fde2ff"), side: THREE.DoubleSide });
  holeShader(bodyMat, bodyUniforms, true);
  const tubes = [];
  {
    const shift = new THREE.Vector3();
    tangle(0, U_G, shift); shift.negate().add(L);   // maternal tangle passes through the locus
    const pShift = new THREE.Vector3(120, 0, -40);
    const cM = new THREE.Vector3(), cI = new THREE.Vector3(), tA = new THREE.Vector3(), nA = new THREE.Vector3(), bA = new THREE.Vector3();
    const bands = bandPattern();
    for (let h = 0; h < 2; h++) for (const s of [-1, 1]) {
      const n = (SEG + 1) * (RAD + 1);
      const posM = new Float32Array(n * 3), posI = new Float32Array(n * 3), norM = new Float32Array(n * 3), norI = new Float32Array(n * 3);
      const col = new Float32Array(n * 3), glow = new Float32Array(n), uA = new Float32Array(n);
      const cm = new Float32Array((SEG + 1) * 3), ci = new Float32Array((SEG + 1) * 3);
      for (let i = 0; i <= SEG; i++) {
        const u = i / SEG;
        mitoPoint(h, s, u, cM);
        tangle(h, u, cI);
        if (h === 0) {
          cI.add(shift);
          if (s === 1) cI.add(tmpV.set(9 * Math.sin(u * 140), 9 * Math.cos(u * 140), 0));
          else { const w = Math.exp(-(((u - U_G) / 0.012) ** 2)); cI.lerp(cM, w); }
        } else {
          cI.add(pShift);
          if (s === 1) cI.add(tmpV.set(9 * Math.sin(u * 140 + 1), 9 * Math.cos(u * 140 + 1), 0));
        }
        cM.toArray(cm, i * 3); cI.toArray(ci, i * 3);
      }
      // parallel-transport frames for each state, then the ring of vertices
      for (const [cl, pos, nor, rad] of [[cm, posM, norM, radMito], [ci, posI, norI, radInter]]) {
        nA.set(0, 0, 1);
        for (let i = 0; i <= SEG; i++) {
          const i0 = Math.max(0, i - 1), i1 = Math.min(SEG, i + 1);
          tA.set(cl[i1 * 3] - cl[i0 * 3], cl[i1 * 3 + 1] - cl[i0 * 3 + 1], cl[i1 * 3 + 2] - cl[i0 * 3 + 2]).normalize();
          nA.addScaledVector(tA, -nA.dot(tA));
          if (nA.lengthSq() < 1e-6) nA.set(1, 0, 0).addScaledVector(tA, -tA.x);
          nA.normalize();
          bA.crossVectors(tA, nA);
          const r = rad(i / SEG);
          for (let j = 0; j <= RAD; j++) {
            const a = (j / RAD) * TAU, cx = Math.cos(a), sx = Math.sin(a);
            const o = (i * (RAD + 1) + j) * 3;
            const nx = nA.x * cx + bA.x * sx, ny = nA.y * cx + bA.y * sx, nz = nA.z * cx + bA.z * sx;
            pos[o] = cl[i * 3] + nx * r; pos[o + 1] = cl[i * 3 + 1] + ny * r; pos[o + 2] = cl[i * 3 + 2] + nz * r;
            nor[o] = nx; nor[o + 1] = ny; nor[o + 2] = nz;
          }
        }
      }
      // G-band colours, the gold β-globin band and the teal insulin band
      const light = new THREE.Color(COL[h].light), dark = new THREE.Color(COL[h].dark), gold = new THREE.Color("#fbbf24"), teal = new THREE.Color("#2dd4bf"), cen = new THREE.Color("#7e22ce"), c = new THREE.Color();
      for (let i = 0; i <= SEG; i++) {
        const u = i / SEG;
        let g = 0;
        if (Math.abs(u - U_G) < BAND_W) { c.copy(gold); g = 1; }
        else if (Math.abs(u - U_INS) < BAND_W * 0.7) { c.copy(teal); g = 0.35; }
        else if (Math.abs(u - U_C) < 0.02) c.copy(cen);
        else c.copy(light).lerp(dark, bands(u));
        if (u < 0.012 || u > 0.988) c.lerp(new THREE.Color("#ffffff"), 0.5);
        for (let j = 0; j <= RAD; j++) { const k = i * (RAD + 1) + j; col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; glow[k] = g; uA[k] = u; }
      }
      const idx = [];
      for (let i = 0; i < SEG; i++) for (let j = 0; j < RAD; j++) {
        const a = i * (RAD + 1) + j, b = a + RAD + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
      const g = new THREE.BufferGeometry();
      g.setIndex(idx);
      g.setAttribute("position", new THREE.BufferAttribute(posI.slice(), 3));
      g.setAttribute("normal", new THREE.BufferAttribute(norI.slice(), 3));
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      g.setAttribute("glow", new THREE.BufferAttribute(glow, 1));
      g.setAttribute("uval", new THREE.BufferAttribute(uA, 1));
      g.computeBoundingSphere();
      const mesh = tag(new THREE.Mesh(g, bodyMat), "chromatid", { h, s });
      root.add(mesh); pickables.push(mesh);
      tubes.push({ mesh, h, s, posM, posI, norM, norI, cur: 0 });
      centres.push({ h, s, mito: cm, inter: ci });
    }
  }
  function bandPattern() {
    const edges = [];
    let u = 0, k = 0;
    while (u < 1) { const w = 0.012 + hash(k * 3.7) * 0.03; edges.push([u, u + w, k % 2 ? 0.25 + hash(k * 5.1) * 0.55 : hash(k * 2.3) * 0.12]); u += w; k++; }
    return (x) => { for (const [a, b, v] of edges) if (x >= a && x < b) return v; return 0; };
  }
  function applyMorph(k) {
    for (const t of tubes) {
      if (Math.abs(t.cur - k) < 0.002) continue;
      t.cur = k;
      const p = t.mesh.geometry.attributes.position.array, n = t.mesh.geometry.attributes.normal.array;
      for (let i = 0; i < p.length; i++) { p[i] = t.posI[i] + (t.posM[i] - t.posI[i]) * k; n[i] = t.norI[i] + (t.norM[i] - t.norI[i]) * k; }
      t.mesh.geometry.attributes.position.needsUpdate = true;
      t.mesh.geometry.attributes.normal.needsUpdate = true;
      t.mesh.geometry.computeBoundingSphere();
    }
  }
  /** a point on a chromatid's centreline at u, for the current morph */
  function centreAt(h, s, u, out) {
    const c = centres.find((q) => q.h === h && q.s === s), i = Math.round(clamp(u, 0, 1) * SEG) * 3, k = morphK;
    return out.set(c.inter[i] + (c.mito[i] - c.inter[i]) * k, c.inter[i + 1] + (c.mito[i + 1] - c.inter[i + 1]) * k, c.inter[i + 2] + (c.mito[i + 2] - c.inter[i + 2]) * k);
  }

  /** Inject a world-space "hole" (cut-away around the zoom focus) + per-vertex glow into a physical material. */
  function holeShader(mat, uni, withGlow) {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uni);
      sh.vertexShader = sh.vertexShader
        .replace("void main() {", `${withGlow ? "attribute float glow; varying float vGlow;" : ""} varying vec3 vWP;\nvoid main() {`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>\n${withGlow ? "vGlow = glow;" : ""}\n#ifdef USE_INSTANCING\nvWP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#else\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#endif`);
      sh.fragmentShader = sh.fragmentShader
        .replace("void main() {", `uniform vec3 uHoleC; uniform float uHoleR; ${withGlow ? "uniform float uGeneGlow; varying float vGlow;" : ""} varying vec3 vWP;\nvoid main() {\nfloat hd = distance(vWP, uHoleC);\nif (hd < uHoleR) discard;`)
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n${withGlow ? "totalEmissiveRadiance += vGlow * vec3(1.0, 0.72, 0.2) * uGeneGlow;" : ""}\ntotalEmissiveRadiance += vec3(0.85, 0.45, 1.0) * (1.0 - smoothstep(uHoleR, uHoleR * 1.08 + 0.6, hd)) * step(0.01, uHoleR) * 0.8;`);
    };
    mat.customProgramCacheKey = () => `chr-hole-${withGlow ? 1 : 0}`;
    mat.userData.clayPatch = mat.onBeforeCompile; mat.userData.clayPatchKey = `chr-hole-${withGlow ? 1 : 0}`;   // keep the zoom cut-away and gene glow in the clay look
  }

  // ---------- chromatin loops around the locus (radial loops on the scaffold) ----------
  const loopGeo = (() => {
    const pts = [[0, -0.05, 0], [0.3, -0.13, 0.02], [0.72, -0.12, -0.03], [1, 0, 0], [0.72, 0.12, 0.03], [0.3, 0.13, -0.02], [0, 0.05, 0]].map((p) => new THREE.Vector3(...p));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.055, 6);
  })();
  const NLOOP = 300;
  const loopMat = physical(COL[0].light, { roughness: 0.45, emissive: new THREE.Color("#db2777"), emissiveIntensity: 0.25 });
  const loops = tag(new THREE.InstancedMesh(loopGeo, loopMat, NLOOP), "loops");
  const loopDef = [];
  for (let i = 0; i < NLOOP; i++) {
    const row = Math.floor(i / 10), dy = -50 + row * 3.4 + hash(i) * 1.5, ang = ((i % 10) / 10) * TAU + row * 0.37 + hash(i * 3) * 0.4;
    loopDef.push({ dy, ang, tilt: (hash(i * 7) - 0.5) * 0.6, len: 0.8 + hash(i * 11) * 0.3 });
  }
  root.add(loops); pickables.push(loops);
  let loopScale = -1;
  function placeLoops(r) {
    if (Math.abs(r - loopScale) < 0.05) return;
    loopScale = r;
    for (let i = 0; i < NLOOP; i++) {
      const d = loopDef[i];
      tmpQ.setFromAxisAngle(Y, d.ang).multiply(tmpQ2.setFromAxisAngle(Zv, d.tilt));
      const sc = r * d.len;
      loops.setMatrixAt(i, tmpM.compose(tmpV.set(L.x, L.y + d.dy * (0.35 + 0.65 * r / 26), L.z), tmpQ, tmpS.set(sc, sc, sc)));
    }
    loops.instanceMatrix.needsUpdate = true;
    loops.computeBoundingSphere();
  }
  const tmpQ2 = new THREE.Quaternion();

  // ---------- the gene's loop: 30 nm fibre out to the promoter, the gene itself, and back ----------
  const detail = new THREE.Group();
  detail.position.copy(L);
  root.add(detail);
  const F = new THREE.Vector3(0, 0, 44);             // promoter centre (local) = the zoom focus and portal
  const P0 = new THREE.Vector3(-3, 0, 44), P1 = new THREE.Vector3(3, 0, 44), P2 = new THREE.Vector3(5, 3.2, 43);
  const FW = F.clone().add(L);                        // world focus
  const fibreA = new THREE.CatmullRomCurve3([new THREE.Vector3(-3, -4, 0), new THREE.Vector3(-7, -3, 18), new THREE.Vector3(-6.5, -1.2, 34), new THREE.Vector3(-4.6, -0.3, 41.5), P0]);
  const fibreB = new THREE.CatmullRomCurve3([P2, new THREE.Vector3(6.4, 4, 39), new THREE.Vector3(7.5, 4.5, 30), new THREE.Vector3(5, 4.2, 16), new THREE.Vector3(2, 4, 0)]);
  const fibreUniforms = { uHoleC: { value: FW.clone() }, uHoleR: { value: 0 } };
  const fibreMat = physical("#f0abfc", { roughness: 0.45, emissive: new THREE.Color("#c026d3"), emissiveIntensity: 0.35 });
  holeShader(fibreMat, fibreUniforms, false);
  for (const c of [fibreA, fibreB]) {
    const m = tag(new THREE.Mesh(new THREE.TubeGeometry(c, 160, 1.5, 12), fibreMat), "fibre");
    detail.add(m); pickables.push(m);
  }
  // nucleosomes inside the fibre (a solenoid), revealed when the fibre's surface is cut away near the focus
  const lowNuc = nucleosomeGeo(false), hiNuc = nucleosomeGeo(true);
  const nucMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.35, clearcoat: 0.8, emissive: new THREE.Color("#7c3aed"), emissiveIntensity: 0.12 });
  const fibreNuc = [];
  {
    const fr = new THREE.Vector3(), t = new THREE.Vector3(), n = new THREE.Vector3(), b = new THREE.Vector3(), p = new THREE.Vector3();
    for (const [c, fromEnd] of [[fibreA, true], [fibreB, false]]) {
      const len = c.getLength();
      for (let k = 0; k * 0.19 < 36; k++) {
        const s = k * 0.19, u = clamp(fromEnd ? 1 - (s + 0.6) / len : (s + 0.6) / len, 0, 1);
        c.getPointAt(u, p); c.getTangentAt(u, t);
        n.copy(Math.abs(t.y) < 0.9 ? Y : Zv).cross(t).normalize(); b.crossVectors(t, n);
        const a = k * (TAU / 6);
        fr.copy(n).multiplyScalar(Math.cos(a)).addScaledVector(b, Math.sin(a));
        const circ = new THREE.Vector3().crossVectors(t, fr);
        fibreNuc.push(tmpM.makeBasis(fr, t, circ).setPosition(p.clone().addScaledVector(fr, 0.92)).clone());
      }
    }
  }
  const fibreNucMesh = tag(new THREE.InstancedMesh(lowNuc, nucMat, fibreNuc.length), "nucleosome");
  fibreNuc.forEach((m, i) => fibreNucMesh.setMatrixAt(i, m));
  detail.add(fibreNucMesh); pickables.push(fibreNucMesh);

  // the gene: a DNA string with 8 nucleosomes — "beads on a string" when open, packed when closed
  const ARC_OPEN = [P1, new THREE.Vector3(6.2, -1.6, 45.4), new THREE.Vector3(9.4, 1.4, 46.4), new THREE.Vector3(9.8, 6, 46), new THREE.Vector3(7.4, 8.2, 45), new THREE.Vector3(5.6, 5.8, 44), P2];
  const ARC_SHUT = [P1, new THREE.Vector3(3.4, 0.4, 43.9), new THREE.Vector3(3.8, 0.9, 43.8), new THREE.Vector3(4.2, 1.5, 43.6), new THREE.Vector3(4.5, 2.1, 43.4), new THREE.Vector3(4.8, 2.7, 43.2), P2];
  const ARC_C = new THREE.Vector3(6.5, 3.5, 44);
  const arcPts = ARC_OPEN.map((p) => p.clone());
  const arc = new THREE.CatmullRomCurve3(arcPts);
  const dnaMat = physical(DNA_COL, { roughness: 0.3, emissive: new THREE.Color("#c084fc"), emissiveIntensity: 0.45 });
  const geneString = tag(new THREE.Mesh(new THREE.TubeGeometry(arc, 140, 0.1, 6), dnaMat), "dna");
  detail.add(geneString);
  let arcOpen = -1;
  const NG = 8;
  const geneNuc = tag(new THREE.InstancedMesh(hiNuc, nucMat, NG + 1), "nucleosome");
  detail.add(geneNuc); pickables.push(geneNuc);
  const h1 = tag(new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.17, 1).scale(1, 1.4, 1), physical("#94a3b8", { roughness: 0.5 }), NG + 1), "h1");
  detail.add(h1); pickables.push(h1);
  const acetyl = tag(new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 10, 8), physical("#bef264", { emissive: new THREE.Color("#a3e635"), emissiveIntensity: 1.3 }), (NG + 1) * 4), "acetyl");
  detail.add(acetyl); pickables.push(acetyl);
  const nucM = [];                                   // current matrices of the 9 gene nucleosomes (0 = promoter)
  for (let i = 0; i <= NG; i++) nucM.push(new THREE.Matrix4());
  const _circ = new THREE.Vector3(), _fr = new THREE.Vector3();
  function layoutGene(o) {
    // o: 0 (closed) … 1 (open)
    if (Math.abs(o - arcOpen) > 0.004) {
      arcOpen = o;
      for (let i = 0; i < arcPts.length; i++) arcPts[i].lerpVectors(ARC_SHUT[i], ARC_OPEN[i], o);
      arc.updateArcLengths();
      geneString.geometry.dispose();
      geneString.geometry = new THREE.TubeGeometry(arc, 140, 0.1, 6);
    }
    const t = tmpV, n = tmpV2, p = tmpV3, circ = _circ, fr = _fr;
    for (let i = 1; i <= NG; i++) {
      const u = (i - 0.5) / NG;
      arc.getPointAt(u, p); arc.getTangentAt(u, t);
      n.copy(Math.abs(t.z) < 0.9 ? Zv : Y).cross(t).normalize();
      const a = i * (TAU / 6) * (1 - o) + (i % 2 ? 0 : Math.PI) * o;   // solenoid when closed, zig-zag when open
      fr.copy(n).applyAxisAngle(t, a);
      circ.crossVectors(t, fr);
      nucM[i].makeBasis(fr, t, circ).setPosition(p.addScaledVector(fr, 0.45 + 0.45 * (1 - o)));
    }
    // promoter nucleosome: sits on the promoter when closed, evicted (nucleosome-free region) when open
    const sc = clamp((0.62 - o) / 0.3, 0, 1);
    nucM[0].compose(tmpV.copy(F).add(tmpV2.set(0, 0.42, 0)), tmpQ.setFromAxisAngle(Y, Math.PI / 2), tmpS.setScalar(Math.max(sc, 0.0001)));
    for (let i = 0; i <= NG; i++) geneNuc.setMatrixAt(i, nucM[i]);
    geneNuc.instanceMatrix.needsUpdate = true;
    geneNuc.computeBoundingSphere();
    // linker histone H1 at each nucleosome's dyad, present in closed chromatin
    const hs = clamp((0.7 - o) / 0.4, 0, 1);
    for (let i = 0; i <= NG; i++) {
      tmpM.copy(nucM[i]);
      tmpV.set(0.62, 0, 0).applyMatrix4(tmpM);
      h1.setMatrixAt(i, tmpM.compose(tmpV, tmpQ.setFromRotationMatrix(nucM[i]), tmpS.setScalar(Math.max(0.0001, hs * (i === 0 ? sc : 1)))));
    }
    h1.instanceMatrix.needsUpdate = true;
    h1.computeBoundingSphere();
  }
  function layoutAcetyl(ac) {
    let k = 0;
    for (let i = 0; i <= NG; i++) for (let j = 0; j < 4; j++, k++) {
      const thr = ((k * 7) % 36 + 0.5) / 36, sc = clamp((ac - thr) * 6 + 1, 0, 1) * (i === 0 ? clamp((0.62 - arcOpen) / 0.3, 0, 1) : 1);
      tmpV.set(...TAIL_TIPS[j]).applyMatrix4(nucM[i]);
      acetyl.setMatrixAt(k, tmpM.compose(tmpV, tmpQ.identity(), tmpS.setScalar(Math.max(0.0001, sc))));
    }
    acetyl.instanceMatrix.needsUpdate = true;
    acetyl.computeBoundingSphere();
  }

  // ---------- the promoter: bare double-helix DNA (portal), with CpG methylation sites ----------
  const NBP = Math.round((P1.x - P0.x) / BP);
  const seq = (() => {
    const a = [];
    for (let i = 0; i < NBP; i++) a.push("ATTGCAAT"[Math.floor(hash(i * 3.3 + 1) * 8)]);
    const CPG = [8, 21, 33, 46, 58, 71, 84, 97];
    for (let i = 1; i < NBP; i++) if (a[i - 1] === "C" && a[i] === "G" && !CPG.includes(i - 1)) a[i] = "A";
    for (const i of CPG) { a[i] = "C"; a[i + 1] = "G"; }
    const tata = NBP - 64; for (let k = 0; k < UPSTREAM.length; k++) a[tata + k] = UPSTREAM[k];
    const cod = NBP - CODING.length; for (let k = 0; k < CODING.length; k++) a[cod + k] = CODING[k];
    return { bases: a, cpg: CPG, tss: NBP - 36 };
  })();
  const helix = new THREE.Group();
  helix.position.copy(F);
  const len = NBP * BP;
  const bbMat = [physical("#f0abfc", { roughness: 0.3, emissive: new THREE.Color("#c026d3"), emissiveIntensity: 0.4 }), physical("#c4b5fd", { roughness: 0.3, emissive: new THREE.Color("#7c3aed"), emissiveIntensity: 0.4 })];
  const PH2 = 2.4;                                    // angular offset of the second strand (minor/major grooves)
  helix.add(new THREE.Mesh(new THREE.TubeGeometry(new HelixCurve(len, 0), NBP * 6, 0.022, 5), bbMat[0]));
  helix.add(new THREE.Mesh(new THREE.TubeGeometry(new HelixCurve(len, PH2), NBP * 6, 0.022, 5), bbMat[1]));
  const rung = new THREE.CylinderGeometry(0.016, 0.016, 1, 5);
  const rungs = new THREE.InstancedMesh(rung, physical("#ffffff", { roughness: 0.35 }), NBP * 2);
  const bpPoint = (i, strand, out) => { const x = -len / 2 + (i + 0.5) * BP, a = (TAU * x) / PITCH + (strand ? PH2 : 0); return out.set(x, HELIX_R * Math.cos(a), HELIX_R * Math.sin(a)); };
  {
    const a = new THREE.Vector3(), b = new THREE.Vector3(), m = new THREE.Vector3(), d = new THREE.Vector3(), c = new THREE.Color();
    for (let i = 0; i < NBP; i++) {
      bpPoint(i, 0, a); bpPoint(i, 1, b); m.lerpVectors(a, b, 0.5);
      for (const [p0, base, k] of [[a, seq.bases[i], 0], [b, DNA_PAIR[seq.bases[i]], 1]]) {
        d.subVectors(m, p0); const l = d.length();
        tmpQ.setFromUnitVectors(Y, d.normalize());
        rungs.setMatrixAt(i * 2 + k, tmpM.compose(tmpV.copy(p0).lerp(m, 0.5), tmpQ, tmpS.set(1, l, 1)));
        rungs.setColorAt(i * 2 + k, c.set(BASE_COL[base]));
      }
    }
  }
  helix.add(rungs);
  // methyl tags on both strands' C of each CpG (symmetric methylation)
  const methylPos = [];
  for (const i of seq.cpg) {
    bpPoint(i, 0, tmpV); methylPos.push(tmpV.clone().multiplyScalar(1.6).setX(tmpV.x));
    bpPoint(i + 1, 1, tmpV); methylPos.push(tmpV.clone().multiplyScalar(1.6).setX(tmpV.x));
  }
  const methyl = tag(new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 10, 8), physical("#f5d0fe", { emissive: new THREE.Color("#e879f9"), emissiveIntensity: 1.6 }), methylPos.length), "methyl");
  helix.add(methyl); pickables.push(methyl);
  const methylHalo = methylPos.map(() => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: "#e879f9", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 }));
    helix.add(s); return s;
  });
  methylPos.forEach((p, i) => methylHalo[i].position.copy(p));
  const helixHit = tag(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, len, 10).rotateZ(Math.PI / 2), new THREE.MeshBasicMaterial({ visible: false })), "dna");
  helix.add(helixHit); pickables.push(helixHit);
  tag(helix.children[0], "dna"); tag(helix.children[1], "dna"); tag(rungs, "dna");
  detail.add(helix);
  // a soft glow marks the promoter / portal from afar
  const portalGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: "#5eead4", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 }));
  portalGlow.position.copy(F); detail.add(portalGlow);
  const portals = [{ to: "dna", label: "DNA double helix", object: helixHit, objects: [helixHit, ...helix.children], radius: 0.9, center: () => FW.clone() }];

  // ---------- RNA polymerase II and the growing mRNA ----------
  const polGeo = wobble(new THREE.IcosahedronGeometry(0.72, 3), 0.08, 3.5, 2);
  const polMat = physical("#a5b4fc", { roughness: 0.45, emissive: new THREE.Color("#7dd3fc"), emissiveIntensity: 0.12 });
  const polMesh = tag(new THREE.InstancedMesh(polGeo, polMat, 4), "pol");
  polMesh.count = 0; polMesh.frustumCulled = false;
  detail.add(polMesh); pickables.push(polMesh);
  const BEADS = 90;
  const beadMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 8, 6), physical("#ffffff", { emissive: new THREE.Color(MRNA_COL), emissiveIntensity: 0.9 }), BEADS);
  beadMesh.count = 0; beadMesh.frustumCulled = false;
  const cExon = new THREE.Color(MRNA_COL), cIntron = new THREE.Color("#f472b6");
  for (let i = 0; i < BEADS; i++) beadMesh.setColorAt(i, cExon);
  detail.add(beadMesh);
  const pols = [];
  let polAcc = 0;
  const tssX = -len / 2 + (seq.tss + 0.5) * BP;
  function polPos(s, out) {
    if (s < 0.1) return out.set(F.x + tssX + (P1.x - F.x - tssX) * (s / 0.1), F.y + 0.3, F.z + 0.35);
    return arc.getPointAt((s - 0.1) / 0.9, out).add(tmpV3.set(0, 0.3, 0.35));
  }
  function updatePols(dt) {
    const v = 0.11 * (0.2 + 0.8 * Math.min(1, M.ntp));
    if (M.accessible && M.cond < 0.1) {
      polAcc += M.tx * dt;
      while (polAcc >= 1) { polAcc -= 1; if (pols.length < 3 && (!pols.length || pols[pols.length - 1].s > 0.2)) pols.push({ s: 0, ph: Math.random() * 6 }); }
      if (polAcc > 2) polAcc = 2;
    } else polAcc = 0;
    for (let i = pols.length - 1; i >= 0; i--) {
      const p = pols[i];
      // condensing for mitosis strips polymerases off; otherwise elongating polymerases finish the gene
      if (M.cond > 0.3) { pols.splice(i, 1); continue; }
      p.s += v * dt;
      if (p.s >= 1) pols.splice(i, 1);
    }
  }
  function drawPols(t) {
    let np = 0, nb = 0;
    const senior = lens.atLeast("y11"), still = engine.reducedMotion;
    for (const p of pols) {
      polPos(p.s, tmpV);
      polMesh.setMatrixAt(np++, tmpM.compose(tmpV, tmpQ.setFromAxisAngle(Y, p.ph), tmpS.set(1, 1, 1)));
      const n = Math.round(p.s * 28);
      tmpV2.copy(tmpV).sub(ARC_C).setZ(Math.max(0.3, tmpV.z - ARC_C.z + 2)).normalize();
      for (let k = 1; k <= n && nb < BEADS; k++) {
        const w = still ? 0 : Math.sin(t * 2 + p.ph + k * 0.8) * 0.12;
        tmpV3.copy(tmpV).addScaledVector(tmpV2, 0.75 + k * 0.24).add(tmpS.set(Math.sin(k * 1.2 + p.ph) * 0.25 + w, Math.cos(k * 0.9 + p.ph) * 0.2, 0));
        beadMesh.setMatrixAt(nb, tmpM.compose(tmpV3, tmpQ.identity(), tmpS.set(1, 1, 1)));
        let col = cExon;
        if (senior) { const f = p.s * (1 - (k - 1) / Math.max(1, n)); if (HBB_INTRONS.some(([a, b]) => f >= a && f < b)) col = cIntron; }
        beadMesh.setColorAt(nb++, col);
      }
    }
    // a polymerase trying (and failing) to bind a closed promoter
    if (!M.accessible && M.cond < 0.5 && np < 4) {
      const bob = still ? 0 : Math.sin(t * 2.4) * 0.35;
      polMesh.setMatrixAt(np++, tmpM.compose(tmpV.set(F.x + 0.8, F.y + 1.9 + bob, F.z + 1.2), tmpQ.identity(), tmpS.set(1, 1, 1)));
    }
    polMat.emissiveIntensity = M.accessible ? 0.14 : 0.02;
    polMesh.count = np; beadMesh.count = nb;
    polMesh.instanceMatrix.needsUpdate = true; beadMesh.instanceMatrix.needsUpdate = true;
    if (beadMesh.instanceColor) beadMesh.instanceColor.needsUpdate = true;
  }

  // ---------- background specks (nucleoplasm), sized for each zoom ----------
  const speck = (n, spread, size, colors, opacity) => {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), pal = colors.map((c) => new THREE.Color(c));
    for (let i = 0; i < n; i++) { pos.set([(hash(i * 1.1) - 0.5) * spread, (hash(i * 2.3) - 0.5) * spread, (hash(i * 3.7) - 0.5) * spread], i * 3); const c = pal[i % pal.length]; col.set([c.r, c.g, c.b], i * 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ size, map: softDot(), vertexColors: true, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  };
  const farSpecks = speck(260, 1400, 7, ["#c4b5fd", "#fbcfe8", "#a5f3fc"], 0.35); farSpecks.position.copy(C0); root.add(farSpecks);
  const nearSpecks = speck(200, 40, 0.18, ["#fde68a", "#c4b5fd", "#a5f3fc"], 0.45); nearSpecks.position.copy(FW); root.add(nearSpecks);

  const selGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: "#5eead4", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 }));
  selGlow.visible = false; root.add(selGlow);

  // ---------- picking: the chromatid's u coordinate tells band / centromere / telomere ----------
  let lastHit = null;
  function chromKind(obj, hit) {
    const { h, s } = obj.userData;
    let u = null;
    if (hit && hit.object === obj && hit.face) u = obj.geometry.attributes.uval.getX(hit.face.a);
    if (u != null) {
      if (Math.abs(u - U_G) < BAND_W * 1.6) return { kind: "band", h, s };
      if (Math.abs(u - U_INS) < BAND_W * 1.2 && lens.atLeast("y9-10")) return { kind: "ins", h, s };
      if (Math.abs(u - U_C) < 0.03 && morphK > 0.5) return { kind: "centromere", h, s };
      if ((u < 0.02 || u > 0.98) && lens.atLeast("y9-10")) return { kind: "telomere", h, s };
    }
    return { kind: h === 1 && lens.atLeast("y9-10") ? "homologue" : "chromatid", h, s };
  }
  function infoFor(obj, hit) {
    let kind = obj.userData.kind, extra = {};
    if (!kind) return null;
    if (kind === "chromatid") { const k = chromKind(obj, hit); kind = k.kind; extra = { h: k.h, s: k.s }; }
    if (kind === "h1" && !lens.atLeast("y9-10")) return null;
    const p = PARTS[kind];
    if (!p) return null;
    return { kind, title: lens.pick(p.name) + (extra.h != null && lens.atLeast("y9-10") ? (extra.h ? " · from father" : " · from mother") : ""), portal: kind === "dna" ? portals[0] : null, object: obj, ...extra };
  }

  // ---------- labels (each appears at the zoom where its structure is visible) ----------
  const labels = {};
  const LBL = {
    chromM: { at: () => centreAt(0, 1, 0.55, tmpV).add(tmpV2.set(34, 0, 0)), d: [180, 1e9], name: () => lens.pick({ "y7-8": "Chromosome (from mother)", "y9-10": "Maternal chromosome", y11: "Maternal homologue" }) },
    chromP: { at: () => centreAt(1, 1, 0.55, tmpV).add(tmpV2.set(34, 0, 0)), d: [180, 1e9], name: () => lens.pick({ "y7-8": "Matching chromosome (from father)", "y9-10": "Paternal chromosome", y11: "Paternal homologue" }) },
    sister: { at: () => centreAt(0, 1, 0.82, tmpV).add(tmpV2.set(30, 0, 0)), d: [180, 1e9], band: "y7-8", when: () => morphK > 0.6, name: () => lens.pick({ "y7-8": "Two identical copies", "y9-10": "Sister chromatids (identical copies)" }) },
    centromere: { at: () => centreAt(0, 1, U_C, tmpV).add(tmpV2.set(-12, 0, 30)), d: [180, 1e9], band: "y9-10", when: () => morphK > 0.6, name: () => PARTS.centromere.name },
    band: { at: () => tmpV.copy(L).add(tmpV2.set(-36, 6, 10)), d: [120, 1e9], name: () => lens.pick({ "y7-8": "Model gene", "y9-10": "β-globin gene (HbA allele)", y11: "β-globin · HbA allele" }), small: () => statusTxt() },
    bandP: { at: () => centreAt(1, -1, U_G, tmpV).add(tmpV2.set(-30, 6, 10)), d: [180, 1e9], band: "y9-10", name: () => lens.pick({ "y9-10": "β-globin gene (HbS allele)", y11: "β-globin · HbS allele" }) },
    ins: { at: () => centreAt(0, 1, U_INS, tmpV).add(tmpV2.set(30, 4, 0)), d: [180, 1e9], band: "y11", name: () => "INS (insulin)" },
    loops: { at: () => tmpV.copy(L).add(tmpV2.set(-30, -26, 20)), d: [45, 300], name: () => lens.pick(PARTS.loops.name) },
    geneLoop: { at: () => tmpV.copy(L).add(tmpV2.set(-9, 4, 28)), d: [40, 160], name: () => lens.pick({ "y7-8": "The gene loops out to be read", "y9-10": "Active gene loop", y11: "Active gene loops out of the compact chromatin" }) },
    fibre: { at: () => tmpV.copy(L).add(tmpV2.set(7.6, 4.6, 33)), d: [9, 70], name: () => lens.pick(PARTS.fibre.name) },
    nucleosome: { at: () => tmpV.copy(L).add(arc.getPointAt(0.55, tmpV2)).add(tmpV3.set(0, 1.4, 0)), d: [2.5, 40], name: () => lens.pick(PARTS.nucleosome.name) },
    pol: { at: () => (pols.length ? polPos(pols[0].s, tmpV) : tmpV.set(F.x + 0.8, F.y + 1.9, F.z + 1.2)).add(L).add(tmpV2.set(0, 1.1, 0)), d: [2.5, 60], when: () => M.cond < 0.5 && (pols.length > 0 || !M.accessible), name: () => lens.pick(PARTS.pol.name), small: () => (M.accessible ? "" : lens.pick({ "y7-8": "can't get on", y11: "can't bind — promoter closed" })) },
    acetyl: { at: () => tmpV.set(...TAIL_TIPS[0]).applyMatrix4(nucM[3]).add(L).add(tmpV2.set(0, 0.5, 0)), d: [0, 12], when: () => M.ac > 0.15, name: () => lens.pick(PARTS.acetyl.name) },
    methyl: { at: () => tmpV.copy(methylPos[4]).add(F).add(L).add(tmpV2.set(0, -0.5, 0)), d: [0, 14], when: () => M.me > 0.15, band: "y11", name: () => lens.pick(PARTS.methyl.name) },
    h1: { at: () => tmpV.set(0.62, 0, 0).applyMatrix4(nucM[5]).add(L).add(tmpV2.set(0, -0.6, 0)), d: [0, 12], band: "y11", when: () => arcOpen < 0.5, name: () => "H1" },
  };
  const NARROW_HIDE = { ins: 1, sister: 1, loops: 1, h1: 1, centromere: 1, bandP: 1, chromP: 1 };
  const diveLbl = engine.label("", "dive");
  function makeLabels() {
    for (const el of Object.values(labels)) el.remove();
    for (const k of Object.keys(LBL)) labels[k] = engine.label("", "org");
  }
  function statusTxt() {
    const y7 = lens.band === "y7-8";
    if (M.cond > 0.5) return y7 ? "packed for division" : "condensed — silent";
    if (M.smoothTx > 0.05) return y7 ? "being copied" : `${M.smoothTx.toFixed(2)} transcripts/s`;
    return y7 ? "switched off" : M.me > 0.5 ? "methylated — silent" : "closed — silent";
  }
  let curD = 700;
  function updateLabels() {
    const narrow = engine.camera.aspect < 0.8;
    for (const [k, def] of Object.entries(LBL)) {
      const el = labels[k];
      if (!state.labels || curD < def.d[0] || curD > def.d[1] || (def.band && !lens.atLeast(def.band)) || (def.when && !def.when()) || (narrow && NARROW_HIDE[k])) { el.style.display = "none"; continue; }
      const sm = def.small ? def.small() : "";
      const html = `${def.name()}${sm ? `<small>${sm}</small>` : ""}`;
      if (el._h !== html) { el.innerHTML = html; el._h = html; }
      el.classList.toggle("off", /silent|can't|off/.test(sm));
      engine.place(el, def.at());
    }
    const dh = curD > 60 ? lens.pick({ "y7-8": "🔍 Zoom in on the model gene", "y9-10": "🔍 Zoom in on the β-globin gene" }) : lens.pick({ "y7-8": "🔍 Zoom into the bare DNA", "y9-10": "🔍 Zoom into the DNA at the promoter" });
    if (diveLbl._h !== dh) { diveLbl.innerHTML = dh; diveLbl._h = dh; }
    if (curD < 1.6) diveLbl.style.display = "none";
    else engine.place(diveLbl, tmpV.copy(FW).add(tmpV2.set(0, -curD * 0.09, 0)));
  }

  // ---------- panel ----------
  let progress = null, panelEl, explainBody, selCard, chart, chartCtx, mission, ctl = {}, chipFns = null, ladderEl = null, seqEl = null;
  function buildPanel(el) {
    panelEl = el;
    const host = document.createElement("div");
    host.style.display = "contents";
    host.className = "chr";
    el.appendChild(host);
    progress = { band: lens.band, node: host };
    el = host;
    const y7 = lens.band === "y7-8", senior = lens.atLeast("y11");

    const ex = K.card(el, "What's happening", "explain");
    explainBody = document.createElement("div");
    ex.appendChild(explainBody);
    ex.insertAdjacentHTML("beforeend", `<p class="hint">${lens.pick({ "y7-8": "Scroll or pinch to zoom: each zoom shows the next layer of how DNA is packed. Everything here is to scale with everything else (see the scale bar).", "y9-10": "One continuous zoom, all drawn to the same scale (bottom-left bar): chromosome → loops → fibre → nucleosomes → DNA. Use the zoom steps at the top to jump.", y11: "One continuous, true-relative-scale zoom (1 unit = 10 nm): chromatid ≈ 0.5 µm, nucleosome 11 nm, DNA 2 nm. Molecular detail is simplified; the tidy 30 nm solenoid is a textbook model." })}</p>`);

    selCard = K.card(el, "Selected", "sel-card");
    selCard.style.display = "none";

    const note = K.card(el, "Model chromosome");
    note.insertAdjacentHTML("beforeend", `<p>${lens.pick({ "y7-8": "This chromosome and its gold gene are <strong>human</strong> (the gene for part of haemoglobin), shown in a plant cell for teaching. Plant chromosomes are packed in exactly the same way.", "y9-10": "Based on <strong>human chromosome 11</strong>, which carries the β-globin gene, shown in a plant cell for teaching. One chromosome came from each parent: the mother's carries the normal allele (HbA), the father's the sickle-cell allele (HbS).", y11: "Modelled on human chromosome 11 (≈ 135 Mb, ≈ 1300 protein-coding genes), shown in a plant nucleus for teaching. Packing (nucleosomes, loops, condensation) and epigenetic marks work the same way in plants, which also methylate CHG and CHH sites. Alleles: maternal HbA, paternal HbS." })}</p>`);

    const stage = K.card(el, lens.pick({ "y7-8": "What is the cell doing?", "y9-10": "Cell stage" }));
    ctl.stage = K.segmented(stage, [
      { value: "interphase", label: lens.pick({ "y7-8": "Working", "y9-10": "Interphase (working)" }) },
      { value: "mitosis", label: lens.pick({ "y7-8": "Dividing", "y9-10": "Mitosis (dividing)" }) },
    ], M.stage, (v) => { M.stage = v; engine.toast(v === "mitosis" ? lens.pick({ "y7-8": "The DNA winds up for division…", "y9-10": "Condensing into sister chromatids…" }) : lens.pick({ "y7-8": "The DNA unwinds so genes can be read…", "y9-10": "Decondensing into a chromosome territory…" })); if (v === "mitosis") flyTo(0); });
    stage.insertAdjacentHTML("beforeend", `<p class="hint">${lens.pick({ "y7-8": "The DNA has already been copied, so there are two identical copies held together.", "y9-10": "This cell has already replicated its DNA (after S phase), so each chromosome is two sister chromatids.", y11: "G2 → mitosis: the replicated chromatids (held by cohesin) condense via condensin. Watch transcription shut down as the chromatin compacts." })}</p>`);

    const epi = K.card(el, lens.pick({ "y7-8": "Switch the gene on or off", "y9-10": "Packing the gene", y11: "Epigenetic control of the gene" }), "ko");
    ctl.ac = K.checkbox(epi, lens.pick({ "y7-8": "Unwrap the gene (loose packing)", "y9-10": "Open chromatin (acetyl tags on the histones)", y11: "Histone acetylation (HATs on; off = HDACs remove the tags)" }), M.acOn, (v) => { M.acOn = v; pushParent(true); engine.toast(lens.pick(v ? { "y7-8": "Loosening the wrapping…", "y9-10": "Adding acetyl tags…", y11: "HATs acetylating H3/H4 tails…" } : { "y7-8": "Packing the gene away…", "y9-10": "Removing acetyl tags…", y11: "HDACs removing acetyl groups…" })); });
    epi.insertAdjacentHTML("beforeend", `<small>${lens.pick({ "y7-8": "Loose = the copying machine can reach the gene.", "y9-10": "Tags loosen the histones' grip on DNA.", y11: "Acetylated lysines lose their + charge, so tails grip DNA less." })}</small>`);
    if (senior) {
      ctl.me = K.checkbox(epi, lens.band === "y11" ? "Extension: DNA methylation of the promoter (DNMTs)" : "DNA methylation of the promoter CpGs (DNMTs)", M.meOn, (v) => { M.meOn = v; pushParent(true); engine.toast(v ? "DNMTs methylating CpG cytosines…" : "Methylation being removed (slow: TET enzymes / replication)…"); });
      epi.insertAdjacentHTML("beforeend", `<small>5-methylcytosine on both strands of each CG; recruits HDACs and silences the gene.</small>`);
    }
    seqEl = document.createElement("div");
    seqEl.className = "seq";
    epi.appendChild(seqEl);

    const view = K.card(el, "View");
    K.checkbox(view, "Show labels", state.labels, (v) => (state.labels = v));
    const r = K.buttonRow(view);
    ZOOM.forEach((z, i) => K.button(r, lens.pick(z.label), () => flyTo(i)));
    if (!y7) view.insertAdjacentHTML("beforeend", `<div class="flow-key" style="margin-top:8px">
      <span><i style="background:#818cf8"></i>H3</span><span><i style="background:#34d399"></i>H4</span><span><i style="background:#fbbf24"></i>H2A</span><span><i style="background:#fb7185"></i>H2B</span>
      <span><i style="background:#bef264;box-shadow:0 0 8px #a3e635"></i>Acetyl tags</span>${senior ? `<span><i style="background:#f5d0fe;box-shadow:0 0 8px #e879f9"></i>Methyl tags (CH₃)</span>` : ""}
      <span><i style="background:#f8fafc"></i>RNA polymerase</span><span><i style="background:${MRNA_COL}"></i>mRNA${senior ? " (introns pink)" : ""}</span></div>`);

    const ch = K.card(el, lens.pick({ "y7-8": "Gene activity over time", "y9-10": "Chromatin and transcription" }));
    chart = document.createElement("canvas");
    chart.className = "mini-chart";
    chart.setAttribute("role", "img");
    ch.appendChild(chart);
    chartCtx = chart.getContext("2d");
    ch.insertAdjacentHTML("beforeend", `<div class="legend" style="margin-top:6px"><span><i style="background:${MRNA_COL}"></i>${y7 ? "Copies made/s" : "Transcription/s"}</span><span><i style="background:#f0abfc"></i>${y7 ? "How open" : "Openness"}</span>${lens.atLeast("y9-10") ? `<span><i style="background:#a3e635"></i>Acetylation</span>` : ""}${senior ? `<span><i style="background:#e879f9"></i>Methylation</span>` : ""}</div>`);

    const bp = K.card(el, lens.pick({ "y7-8": "The big picture", "y9-10": "The big picture: packing DNA" }));
    bp.insertAdjacentHTML("beforeend", lens.pick({
      "y7-8": "<p>Your DNA is about 2 metres long if stretched out, but it fits in a nucleus a hundred-thousandth of that size. It's <strong>wrapped</strong> around protein beads, <strong>coiled</strong>, and <strong>looped</strong>. Packed DNA can't be read, so packing also decides which genes are switched on.</p>",
      "y9-10": "<p><strong>DNA → nucleosomes</strong> (wrapped on histones) <strong>→ fibre → loops → chromosome</strong>. A <strong>gene</strong> is one section of this DNA; each chromosome carries hundreds to thousands. Body cells have homologous pairs — one chromosome from each parent — so they carry two alleles of each gene.</p>",
      y11: "<p>Packing levels: 147 bp around each histone octamer (≈ 7× compaction) → compact fibre with H1 → loops anchored by cohesin/condensin → mitotic chromatid (≈ 10 000×). <strong>Euchromatin</strong> is open and transcribable; <strong>heterochromatin</strong> is condensed and silent. Tags on histones and DNA (<strong>epigenetic marks</strong>) shift genes between the two without changing the sequence.</p>",
    }));
    const r2 = K.buttonRow(bp);
    K.button(r2, lens.pick({ "y7-8": "Zoom into the DNA ▸", "y9-10": "Zoom into the DNA double helix ▸" }), () => engine.dive(portals[0]), { kind: "primary" });
    K.button(r2, lens.pick({ "y7-8": "How cells remember which genes are off ▸", "y9-10": "Epigenetics: marks, memory and environment ▸" }), () => engine.dive({ to: "epigenetics", label: "Epigenetics", radius: 6, center: () => FW.clone(), object: helixHit, start: { view: "marks" } }));

    mission = K.missions(el, lens.filter(MISSIONS).map((m) => ({ text: lens.pick(m.text), check: () => m.check(M, state) })), (m) => engine.toast(`🎯 Mission complete: ${m.text}`, 3600));
    K.quiz(el, lens.filter(QUIZ));
    renderSeq();
  }

  function renderSeq() {
    if (!seqEl) return;
    const senior = lens.atLeast("y11"), sites = Math.round(M.me * 8);
    const codons = CODING.match(/.{3}/g).join(" ");
    const prom = senior ? `<small>Promoter CpG sites (${sites}/8 methylated):</small>${seq.cpg.map((_, i) => `<span class="${i < sites ? "me" : ""}">${i < sites ? "<b>C</b>ᵐG" : "CG"}</span>`).join(" · ")}` : "";
    const html = `${prom}<small>${lens.pick({ "y7-8": "The gene's DNA letters (start):", "y9-10": "Coding strand of the model gene (5′→3′):" })}</small>${codons}<small class="ok">✓ ${lens.pick({ "y7-8": "Same letters whether the gene is on or off", "y9-10": "Sequence unchanged — only the packing changes", y11: "Sequence unchanged — epigenetic marks alter access, not the code" })}</small>`;
    if (seqEl._h !== html) { seqEl.innerHTML = html; seqEl._h = html; }
  }

  function buildChips() {
    const ov = engine.overlay;
    ov.innerHTML = "";
    ladderEl = document.createElement("div");
    ladderEl.className = "chip chr-ladder";
    ladderEl.setAttribute("role", "group");
    ladderEl.setAttribute("aria-label", "Zoom level");
    ZOOM.forEach((z, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = lens.pick(z.label);
      b.addEventListener("click", () => flyTo(i));
      ladderEl.appendChild(b);
    });
    ov.appendChild(ladderEl);
    chipFns = { gene: K.chip(ov), open: K.chip(ov), marks: K.chip(ov) };
    chipFns.els = [...ov.children].slice(1);
    for (const c of chipFns.els) c.classList.add("chr-chip");
  }
  function updateChips() {
    if (!chipFns) return;
    const y7 = lens.band === "y7-8", d = (c) => `<i class="dot" style="background:${c}"></i>`, on = M.smoothTx > 0.05;
    chipFns.gene(`${d("#fbbf24")}${y7 ? "Model gene" : "β-globin"} <b>${on ? "ON" : "OFF"}</b>${on && !y7 ? ` <span class="w">${M.smoothTx.toFixed(2)}/s</span>` : ""}`);
    chipFns.open(`${d("#f0abfc")}${y7 ? "Unwrapped" : "Chromatin open"} <b>${Math.round(M.open * 100)}%</b>`);
    const showMarks = lens.atLeast("y9-10");
    chipFns.marks(showMarks ? `${d("#a3e635")}Acetyl <b>${Math.round(M.ac * 100)}%</b>${lens.atLeast("y11") ? ` · ${d("#e879f9")}CH₃ <b>${Math.round(M.me * 100)}%</b>` : ""}` : "");
    chipFns.els[2].style.display = showMarks ? "" : "none";
    chipFns.els[0].classList.toggle("warn", !on);
    // highlight the current zoom step
    if (ladderEl) {
      let cur = 0;
      ZOOM.forEach((z, i) => { if (curD < (i ? Math.sqrt(ZOOM[i - 1].d * z.d) : 1e9)) cur = i; });
      [...ladderEl.children].forEach((b, i) => b.setAttribute("aria-current", String(i === cur)));
    }
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
    chart.setAttribute("aria-label", `Transcription ${M.smoothTx.toFixed(2)} per second, chromatin ${Math.round(M.open * 100)} percent open, acetylation ${Math.round(M.ac * 100)} percent, methylation ${Math.round(M.me * 100)} percent.`);
    const H = M.history;
    if (H.length < 2) return;
    const series = [["open", "#f0abfc", 1], ["tx", MRNA_COL, 0.5]];
    if (lens.atLeast("y9-10")) series.push(["ac", "#a3e635", 1]);
    if (lens.atLeast("y11")) series.push(["me", "#e879f9", 1]);
    for (const [k, col, max] of series) {
      c.strokeStyle = col; c.lineWidth = 2; c.beginPath();
      H.forEach((p, i) => { const x = (i / 239) * w, y = h - Math.min(1, p[k] / max) * (h - 4) - 2; i ? c.lineTo(x, y) : c.moveTo(x, y); });
      c.stroke();
    }
  }

  function showSelection(info) {
    if (!selCard) return;
    if (!info) { selCard.style.display = "none"; selGlow.visible = false; return; }
    const p = PARTS[info.kind];
    let extra = "";
    if (info.kind === "band" && lens.atLeast("y9-10")) extra = `<div class="io"><b>Allele</b><span>${info.h ? "HbS (sickle-cell: codon 6 GAG → GTG)" : "HbA (normal)"}</span><b>Gene now</b><span>${statusTxt()}</span></div>`;
    else if (info.kind === "band") extra = `<div class="io"><b>Now</b><span>${statusTxt()}</span></div>`;
    if (info.kind === "pol" || info.kind === "dna") extra = `<div class="io"><b>Promoter</b><span>${M.accessible ? lens.pick({ "y7-8": "unwrapped — the copier can get on", y11: "nucleosome-free — open to RNA pol II" }) : lens.pick({ "y7-8": "wrapped up — the copier can't get on", y11: "covered by a nucleosome — closed" })}</span></div>`;
    selCard.style.display = "";
    selCard.innerHTML = `<h2>Selected</h2><p style="color:var(--ink);font-weight:600;margin-bottom:4px"><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};margin-right:6px"></i>${info.title}</p>
      <p>${lens.pick(p.role)}</p>${extra}
      ${info.kind === "band" ? `<div class="btn-row"><button class="btn" data-act="zoomgene">Zoom in on this gene ▸</button></div>` : ""}
      ${info.portal ? `<div class="btn-row"><button class="btn primary" data-act="zoom">${lens.pick({ "y7-8": "Zoom into the DNA ▸", "y9-10": "Zoom into the double helix ▸" })}</button></div>` : ""}`;
    selCard.querySelector('[data-act="zoom"]')?.addEventListener("click", () => engine.dive(info.portal));
    selCard.querySelector('[data-act="zoomgene"]')?.addEventListener("click", () => flyTo(2));
    selGlow.visible = !!info.point;
    if (info.point) { selGlow.position.copy(info.point); selGlow.scale.setScalar(Math.max(0.6, curD * 0.08)); }
    if (panelEl) panelEl.parentElement?.scrollTo?.({ top: 0, behavior: "smooth" });
  }

  function updateExplain() {
    if (!explainBody) return;
    const html = narrative(M, lens.band, { pols: pols.length }).map((p) => `<p>${p}</p>`).join("");
    if (explainBody.innerHTML !== html) explainBody.innerHTML = html;
  }

  // ---------- guided zoom: the view slides from the whole pair onto the gene as you zoom in ----------
  const guideT = new THREE.Vector3();
  const GENE_MID = new THREE.Vector3(4.2, 2.6, 44.6).add(L);   // frames the promoter + the gene's nucleosomes
  function guideTarget(d, out) {
    C0.lerpVectors(C0I, C0M, morphK);
    out.lerpVectors(C0, GENE_MID, fade(d, 700, 260));
    return out.lerp(FW, fade(d, 7, 2.6));            // finally centre on the promoter (the portal)
  }
  function flyTo(i) {
    const d = ZOOM[i].d, dir = engine.camera.position.clone().sub(engine.controls.target).normalize();
    if (i >= 2 && dir.z < 0.3) dir.set(0.32, 0.26, 1).normalize();
    const t = guideTarget(d, new THREE.Vector3());
    engine.fly(t, t.clone().addScaledVector(dir, d), 1.2);
  }

  // ---------- per-frame ----------
  let morphK = 0, lastNear = 0;
  const applyLOD = () => {
    const d = curD;
    bodyUniforms.uHoleR.value = Math.min(46, 0.42 * d) * fade(d, 340, 200);
    loops.visible = d < 400 && d > 30;
    fibreUniforms.uHoleR.value = 34 * fade(d, 60, 28);
    fibreNucMesh.visible = d < 70;
    const near = d < 170;
    geneNuc.visible = geneString.visible = h1.visible = acetyl.visible = near;
    helix.visible = d < 170;
    rungs.visible = d < 30;
    methyl.visible = d < 40;
    for (const s of methylHalo) { s.visible = d < 200 && s.userData.on; s.scale.setScalar(clamp(d * 0.035, 0.25, 4)); }
    portalGlow.scale.setScalar(clamp(d * 0.12, 1.2, 30));
    portalGlow.material.opacity = 0.25 + 0.3 * fade(d, 40, 6);
    nearSpecks.visible = d < 60;
    farSpecks.visible = d > 60;
    // camera clip planes, fog and depth of field follow the zoom (1000× range in one level)
    const cam = engine.camera, n = clamp(d * 0.02, 0.02, 20);
    if (Math.abs(n - lastNear) / n > 0.05) { lastNear = n; cam.near = n; cam.far = d * 30 + 60; cam.updateProjectionMatrix(); }
    if (engine.scene.fog) engine.scene.fog.density = 0.5 / d;
    engine.bokeh.uniforms.aperture.value = 0.022 / d;
  };

  let uiT = 0, exT = 0, chT = 0;
  const level = {
    title: "Chromosome & chromatin",
    topics: ["dna-structure", "genes", "epigenetics", "inheritance", "cell-cycle", "mitosis"],
    root, pickables, portals,
    metersPerUnit: 1e-8,              // 1 unit = 10 nm
    model: M,
    get view() {
      const a = engine.camera.aspect, t = Math.tan(THREE.MathUtils.degToRad(engine.camera.fov / 2));
      return { target: C0.lerpVectors(C0I, C0M, morphK).clone(), distance: clamp(Math.max(265 / t, 210 / (t * a)), 720, 1250), dir: new THREE.Vector3(0.2, 0.18, 1) };
    },
    minDistance: 1.0, maxDistance: 1300, near: 1, far: 30000,
    enablePan: false,
    env: { bg: ["#0a0d2a", "#14183a", "#3a1450"], fog: ["#0d1030", 0.0008], exposure: 1.05, bloom: [0.55, 0.5, 0.82], aperture: 0.00003 },
    info(obj) { const hit = lastHit && lastHit.object === obj ? lastHit : null; return infoFor(obj, hit); },
    onClick(e, hit) {
      lastHit = hit;
      if (hit) {
        const info = infoFor(hit.object, hit);
        if (info?.kind === "band") { state.clicked.band = true; if (info.h) state.clicked.bandP = true; else state.clicked.bandM = true; }
        if (info?.kind === "centromere") state.clicked.centromere = true;
      }
      return false;
    },
    onSelect(info) { showSelection(info); },
    mountPanel(el) {
      makeLabels();
      if (progress && progress.band === lens.band) { panelEl = el; el.appendChild(progress.node); }
      else buildPanel(el);
      buildChips();
      engine.controls.zoomToCursor = false;
      engine.controls.zoomSpeed = 2.0;
    },
    unmountPanel() {
      for (const el of Object.values(labels)) el.style.display = "none";
      diveLbl.style.display = "none"; engine.overlay.innerHTML = ""; chipFns = null; ladderEl = null;
      engine.controls.zoomToCursor = true;
      engine.controls.zoomSpeed = 0.9;
    },
    onPause() { state.dived = true; },
    onResume() { makeLabels(); lastNear = 0; },
    onLens() { progress = null; panelEl.innerHTML = ""; buildPanel(panelEl); buildChips(); },
    dispose() {
      for (const el of Object.values(labels)) el.remove();
      diveLbl.remove();
      engine.controls.zoomToCursor = true;
      engine.controls.zoomSpeed = 0.9;
    },
    update(dt, t, realDt) {
      const rdt = realDt ?? dt;
      const c = engine.controls, cam = engine.camera;
      // keep the view sliding toward the gene as the student zooms (not during scripted flights)
      if (!engine.flight && !engine.busy) {
        const d0 = cam.position.distanceTo(c.target);
        guideTarget(d0, guideT);
        tmpV.subVectors(guideT, c.target);
        if (tmpV.lengthSq() > 1e-8) { c.target.add(tmpV); cam.position.add(tmpV); }
      }
      curD = cam.position.distanceTo(c.target);
      state.minD = Math.min(state.minD, curD);
      M.step(dt);
      if (parentGene) pushParent(false);
      // epigenetic memory and re-activation bookkeeping for missions
      if (M.me > 0.9 && M.cond > 0.95) state.memA = true;
      if (state.memA && M.stage === "interphase" && M.cond < 0.05 && M.me > 0.9 && M.smoothTx < 0.02) state.memory = true;
      if (M.stage === "interphase" && M.cond < 0.05 && (!M.acOn || M.meOn) && M.smoothTx < 0.02) state.wasSilenced = true;
      morphK = M.cond * M.cond * (3 - 2 * M.cond);
      applyMorph(morphK);
      placeLoops(8 + (26 - 8) * morphK);
      layoutGene(clamp((M.open - 0.12) / 0.7, 0, 1));
      layoutAcetyl(M.ac);
      for (let i = 0; i < methylPos.length; i++) {
        const thr = (Math.floor(i / 2) + 0.5) / 8, sc = clamp((M.me - thr) * 8 + 0.5, 0, 1);
        methyl.setMatrixAt(i, tmpM.compose(methylPos[i], tmpQ.identity(), tmpS.setScalar(Math.max(0.0001, sc))));
        methylHalo[i].userData.on = sc > 0.05;
        methylHalo[i].material.opacity = 0.65 * sc;
      }
      methyl.instanceMatrix.needsUpdate = true;
      updatePols(dt);
      drawPols(t);
      bodyUniforms.uGeneGlow.value = 0.25 + Math.min(1.2, M.smoothTx * 2.4);
      dnaMat.emissiveIntensity = 0.25 + Math.min(0.6, M.smoothTx);
      applyLOD();
      if (!engine.reducedMotion) { portalGlow.material.rotation = t * 0.3; nearSpecks.rotation.y = t * 0.02; }
      if (selGlow.visible) selGlow.material.opacity = 0.35 + 0.2 * Math.sin(t * 3);
      updateLabels();
      uiT -= rdt; exT -= rdt; chT -= rdt;
      if (uiT <= 0) { uiT = 0.25; updateChips(); renderSeq(); }
      if (exT <= 0) { exT = 0.6; updateExplain(); }
      if (chT <= 0) { chT = 0.5; drawChart(); }
      mission?.update();
    },
  };
  return level;
}
