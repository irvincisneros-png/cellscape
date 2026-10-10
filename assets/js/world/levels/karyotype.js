// Level: the human karyotype (Phase 5b). 1 world unit = 1 µm.
// A stylised metaphase spread of all 46 human chromosomes: X-shaped sister-chromatid pairs with the correct relative
// length, centromere position (metacentric / submetacentric / acrocentric, satellites on 13-15, 21, 22) and a G-banding
// pattern approximating ISCN ideograms. Students pair chromosomes by dragging, sort them into a karyogram (or drag them
// into numbered slots), switch sex and aneuploidy (trisomy 21, XXY, 45,X) and click a chromosome to see its ideogram and
// real gene loci. Data and text live in karyotypeContent.js.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import * as K from "../../kit.js";
import { softDot, hash, specks } from "../materials.js";
import { IDS, CHROMS, STAIN_VAL, bandU, GROUPS, groupOf, ROWS, GENES, GENE_BY_ID, genesOn, CONDITIONS, NOTE, PLANT_NOTE, CLASS_TEXT, MISSIONS, QUIZ, narrative } from "./karyotypeContent.js";

const TAU = Math.PI * 2;
const R0 = 0.42;                 // chromatid radius (µm)
const PITCH = 2.35;              // spacing between chromosomes in the karyogram
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
function mulberry32(a) { return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const h2 = (x, y) => hash(x * 57.3 + y * 131.7 + 3.1);
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const CSS = `
.kary .krow { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 8px 0 0; }
.kary .klbl { font-size: 0.76rem; color: var(--ink-faint); margin: 10px 0 4px; }
.kary .segmented button { padding: 6px 4px; font-size: 0.78rem; }
.kary .tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin: 8px 0; }
.kary .tile { text-align: center; padding: 6px 2px; border-radius: 9px; border: 1px solid var(--panel-border); background: var(--tint-1); font-size: 0.7rem; color: var(--ink-faint); }
.kary .tile b { display: block; font-family: var(--font-display); font-size: 1.15rem; color: var(--ink); font-variant-numeric: tabular-nums; }
.kary .ideo-wrap { display: flex; gap: 10px; align-items: flex-start; margin: 8px 0; }
.kary .ideo-wrap canvas { flex: none; width: 150px; height: 300px; border-radius: 10px; background: var(--tint-1); border: 1px solid var(--panel-border); }
.kary .facts { font-size: 0.82rem; color: var(--ink-dim); display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.kary .facts b { color: var(--ink); }
.kary .genes { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
.kary .gchip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 9px; border-radius: 999px; border: 1px solid var(--panel-border); background: var(--tint-1); color: var(--ink); font-size: 0.78rem; cursor: pointer; font-family: inherit; }
.kary .gchip i { width: 9px; height: 9px; border-radius: 50%; box-shadow: 0 0 8px currentColor; }
.kary .gchip small { color: var(--ink-faint); font-size: 0.68rem; }
.kary .gchip:hover, .kary .gchip[aria-pressed="true"] { border-color: var(--accent); background: rgba(79,209,197,0.14); }
.kary .gdetail { margin-top: 8px; padding: 10px; border-radius: 10px; border: 1px solid var(--panel-border); background: var(--tint-1); font-size: 0.84rem; color: var(--ink-dim); }
.kary .gdetail h3 { margin: 0 0 4px; font-size: 0.95rem; color: var(--ink); font-family: var(--font-display); }
.kary .gdetail p { margin: 0 0 6px; }
.kary .gdetail .pat { display: inline-block; padding: 2px 8px; border-radius: 999px; background: rgba(167,139,250,0.18); border: 1px solid rgba(167,139,250,0.45); color: var(--t-violet); font-size: 0.74rem; }
.kary .age { width: 100%; border-collapse: collapse; font-size: 0.8rem; color: var(--ink-dim); margin: 6px 0; }
.kary .age td, .kary .age th { padding: 4px; border-bottom: 1px solid var(--panel-border); text-align: left; }
.kary .pnote { border-left: 3px solid var(--accent-3); padding-left: 9px; }
.lbl3d.kyl { background: rgba(5,11,22,0.62); border: 1px solid rgba(127,230,255,0.28); padding: 1px 7px; border-radius: 999px; color: var(--ink); font-weight: 600; font-size: 0.7rem; }
.lbl3d.kyg { color: #7fe6ff; font-weight: 700; font-size: 0.85rem; letter-spacing: 0.06em; text-shadow: 0 1px 6px #000; }
.lbl3d.kyx { background: rgba(251,191,36,0.16); border: 1px solid rgba(251,191,36,0.6); padding: 1px 7px; border-radius: 999px; color: #fde68a; font-weight: 600; font-size: 0.7rem; }
.lbl3d.kygene { background: rgba(5,11,22,0.78); border: 1px solid currentColor; padding: 1px 8px; border-radius: 999px; font-weight: 700; font-size: 0.74rem; }
.kary-light .lbl3d.kyl { background: rgba(255,255,255,0.8); color: #2b2159; border-color: rgba(60,40,120,0.4); }
.kary-light .lbl3d.kyg { color: #4c3a9a; text-shadow: none; }
`;

// ---------- chromosome centre line and shape (shared by the mesh and the gene markers) ----------
function bendOf(ch) { return (hash(ch.mb) - 0.5) * 0.05 * ch.lenUm; }
/** profile factor for the tube radius at arc-length fraction u (constriction, stalk, satellites) */
function profile(ch, u) {
  const y = ch.pLen - u * ch.lenUm;
  let f = 1 - 0.40 * Math.exp(-Math.pow(y / 0.5, 2));           // primary constriction (centromere)
  if (ch.cls === "acrocentric" && ch.id !== "Y") {
    const t = u / ch.ci;
    if (t < 1) f *= 1 - 0.74 * sstep(0.30, 0.38, t) * (1 - sstep(0.60, 0.70, t));   // stalk (NOR) between satellite and arm
    if (t < 0.34) f *= 0.92;
  }
  return f;
}
function centreAt(ch, u, sigma) {
  const L = ch.lenUm, y = ch.pLen - u * L;
  const armLen = y >= 0 ? ch.pLen : ch.qLen;
  const s = Math.abs(y) / Math.max(armLen, 0.01);
  const f = profile(ch, u);
  const splay = R0 * 0.62 * Math.pow(s, 1.8) * (f > 0.6 ? 1 : f / 0.6);
  const x = sigma * (R0 * 0.92 * Math.min(f * 1.15, 1) + splay) + bendOf(ch) * Math.sin(Math.PI * u);
  return { x, y, r: R0 * f };
}

function buildGeometry(ch, row, nRows) {
  const L = ch.lenUm, ns = clamp(Math.round(L * 12), 44, 130), nr = 20, v = (row + 0.5) / nRows;
  const parts = [];
  for (const sigma of [1, -1]) {
    const pos = new Float32Array((ns + 1) * (nr + 1) * 3), uv = new Float32Array((ns + 1) * (nr + 1) * 2), uv1 = new Float32Array((ns + 1) * (nr + 1) * 2);
    const seed = sigma > 0 ? 0 : 4.7;
    for (let i = 0; i <= ns; i++) {
      const u = i / ns;
      const c = centreAt(ch, u, sigma), c2 = centreAt(ch, Math.min(1, u + 1 / ns), sigma), c1 = centreAt(ch, Math.max(0, u - 1 / ns), sigma);
      let tx = c2.x - c1.x, ty = c2.y - c1.y; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const bx = ty, by = -tx;                                   // in-plane normal
      const dTip = Math.min(u * L, (1 - u) * L), capL = R0 * 1.15;
      const cap = dTip >= capL ? 1 : Math.sqrt(Math.max(0.0009, 1 - Math.pow((capL - dTip) / capL, 2)));
      const tw = u * L * 0.7;
      for (let j = 0; j <= nr; j++) {
        const th = (j / nr) * TAU, ct = Math.cos(th), st = Math.sin(th), ang = th + tw;
        const coil = 0.075 * Math.sin(ang * 2 + u * L * (TAU / 1.05));
        const lump = 0.20 * (vnoise(ct * 1.7 + 3.1 + seed, st * 1.7 + c.y * 1.4) - 0.5);
        const fine = 0.09 * (vnoise(ct * 4.2 + seed, st * 4.2 + c.y * 4.3 + 9) - 0.5);
        const rr = c.r * cap * (1 + (coil + lump + fine) * (0.4 + 0.6 * cap));
        const k = i * (nr + 1) + j;
        pos[k * 3] = c.x + rr * st * bx; pos[k * 3 + 1] = c.y + rr * st * by; pos[k * 3 + 2] = rr * ct;
        uv[k * 2] = u; uv[k * 2 + 1] = v;
        uv1[k * 2] = (j / nr) * 3; uv1[k * 2 + 1] = u * L * 0.9;
      }
    }
    const idx = [];
    for (let i = 0; i < ns; i++) for (let j = 0; j < nr; j++) {
      const a = i * (nr + 1) + j, b = a + nr + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setAttribute("uv1", new THREE.BufferAttribute(uv1, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const nrm = g.attributes.normal;                              // weld the seam normals
    for (let i = 0; i <= ns; i++) {
      const a = i * (nr + 1), b = a + nr;
      const x = nrm.getX(a) + nrm.getX(b), y = nrm.getY(a) + nrm.getY(b), z = nrm.getZ(a) + nrm.getZ(b), l = Math.hypot(x, y, z) || 1;
      nrm.setXYZ(a, x / l, y / l, z / l); nrm.setXYZ(b, x / l, y / l, z / l);
    }
    parts.push(g);
  }
  const g = mergeGeometries(parts);
  g.computeBoundingSphere();
  return g;
}

// ---------- textures ----------
const ATLAS_W = 1024, ROW_H = 8;
function atlasTexture(style) {
  const n = IDS.length, cv = document.createElement("canvas");
  cv.width = ATLAS_W; cv.height = n * ROW_H;
  const ctx = cv.getContext("2d"), img = ctx.createImageData(ATLAS_W, cv.height);
  const lo = style === "fluor" ? [26, 84, 140] : [196, 183, 226], hi = style === "fluor" ? [226, 246, 255] : [46, 28, 104];
  IDS.forEach((id, r) => {
    const ch = CHROMS[id], raw = new Float32Array(ATLAS_W);
    for (const b of ch.bands) {
      let val = b.stain === "a" ? 0.62 : STAIN_VAL[b.stain] ?? 0;
      for (let x = Math.floor(b.u0 * ATLAS_W); x < Math.ceil(b.u1 * ATLAS_W) && x < ATLAS_W; x++) raw[x] = val;
    }
    const sm = new Float32Array(ATLAS_W);
    for (let x = 0; x < ATLAS_W; x++) {                           // soften the band edges a little
      let s = 0, w = 0;
      for (let d = -3; d <= 3; d++) { const k = 4 - Math.abs(d); s += raw[clamp(x + d, 0, ATLAS_W - 1)] * k; w += k; }
      sm[x] = s / w;
    }
    for (let x = 0; x < ATLAS_W; x++) {
      const t = clamp(sm[x] * (1 + 0.10 * (vnoise(x * 0.35, r * 3.7) - 0.5)), 0, 1), e = Math.pow(t, 0.9);
      for (let yy = 0; yy < ROW_H; yy++) {
        const o = ((r * ROW_H + yy) * ATLAS_W + x) * 4;
        img.data[o] = lerp(lo[0], hi[0], e); img.data[o + 1] = lerp(lo[1], hi[1], e); img.data[o + 2] = lerp(lo[2], hi[2], e); img.data[o + 3] = 255;
      }
    }
  });
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
  return tex;
}
function fibreBump() {
  const S = 256, cv = document.createElement("canvas"); cv.width = cv.height = S;
  const c = cv.getContext("2d");
  c.fillStyle = "#808080"; c.fillRect(0, 0, S, S);
  const rnd = mulberry32(77);
  c.lineCap = "round";
  for (let i = 0; i < 520; i++) {
    const x = rnd() * S, y = rnd() * S, a = (rnd() - 0.5) * 1.2 + Math.PI / 2, l = 10 + rnd() * 26, w = 1.5 + rnd() * 2.5;
    c.strokeStyle = rnd() < 0.5 ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)"; c.lineWidth = w;
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      c.beginPath(); c.moveTo(x + ox, y + oy);
      c.quadraticCurveTo(x + ox + Math.cos(a + 0.8) * l * 0.5, y + oy + Math.sin(a + 0.8) * l * 0.5, x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l);
      c.stroke();
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.channel = 1;
  return t;
}

// ---------- the level ----------
export function create(engine) {
  const lens = engine.lens;
  const root = new THREE.Group();
  const pickables = [];
  const rimU = { rimCol: { value: new THREE.Color("#7fe6ff") }, rimK: { value: 0.4 } };
  const portrait = () => engine.camera.aspect < 0.9;
  const plantRoot = engine.stack[0]?.id === "cell";

  // --- state ---
  const S = {
    sex: "XY", cond: "none", sorted: false, challenge: false, stain: "fluor", showDiff: true,
    sel: null, gene: null, hover: null,
    everPaired: false, allPaired: false, everSorted: false, sexSelected: false, t21Selected: false, seenGene: new Set(), challengeDone: false, counted: false,
  };

  // --- shared GPU resources ---
  const atlas = { fluor: atlasTexture("fluor"), giemsa: atlasTexture("giemsa") };
  const bump = fibreBump();
  const geos = {}, proxyGeos = {};
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  IDS.forEach((id, r) => {
    const ch = CHROMS[id];
    geos[id] = buildGeometry(ch, r, IDS.length);
    const rad = Math.max(0.9, R0 * 2.4);
    const cg = new THREE.CapsuleGeometry(rad, Math.max(0.1, ch.lenUm - 2 * rad + 0.4), 4, 10);
    cg.translate(0, (ch.pLen - ch.qLen) / 2, 0);
    proxyGeos[id] = cg;
  });
  function makeMaterial() {
    const hi = { value: 0 }, hiCol = { value: new THREE.Color("#ffffff") };
    const m = new THREE.MeshPhysicalMaterial({
      color: "#ffffff", map: atlas.fluor, emissiveMap: atlas.fluor, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.55,
      roughness: 0.46, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.45, sheen: 0.7, sheenRoughness: 0.45, sheenColor: new THREE.Color("#9fe8ff"),
      bumpMap: bump, bumpScale: 1.6,
    });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.rimCol = rimU.rimCol; sh.uniforms.rimK = rimU.rimK; sh.uniforms.uHi = hi; sh.uniforms.uHiCol = hiCol;
      sh.fragmentShader = sh.fragmentShader
        .replace("void main() {", "uniform vec3 rimCol; uniform float rimK; uniform float uHi; uniform vec3 uHiCol;\nvoid main() {")
        .replace("#include <opaque_fragment>", `
          float frn = pow(1.0 - clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0), 2.6);
          outgoingLight += rimCol * frn * rimK + uHiCol * uHi * (0.30 + 0.9 * frn);
          #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => "karyChromosome";
    m.userData.hi = hi; m.userData.hiCol = hiCol;
    return m;
  }

  // --- lights, backdrop ---
  const rim = new THREE.DirectionalLight("#5fe9ff", 1.6); rim.position.set(-8, 6, -10);
  const fill = new THREE.DirectionalLight("#dff6ff", 1.2); fill.position.set(6, 10, 14);
  root.add(rim, fill);
  const dust = specks(90, 0.9, [96, 64, 8], ["#7fd1ff", "#a5b4fc", "#5eead4"], 0.22);
  dust.position.z = -3; root.add(dust);

  // --- chromosome instances ---
  const chroms = [];
  const addChrom = (id, key, tag, order) => {
    const g = new THREE.Group();
    const mat = makeMaterial();
    const mesh = new THREE.Mesh(geos[id], mat);
    mesh.frustumCulled = false;
    mesh.userData.keepMaterial = true;          // the G-banding is the science: keep it in every art style
    const proxy = new THREE.Mesh(proxyGeos[id], proxyMat);
    const c = {
      id, key, tag, order, g, mesh, proxy, mat, ch: CHROMS[id],
      cur: { x: 0, y: 0, z: 0, rot: 0, flat: 0 }, from: null, to: null, t: 1, delay: 0, dur: 1.4, moving: false,
      spread: null, tiltX: 0, tiltY: 0, phase: Math.random() * TAU,
      want: false, appear: 0, paired: false, revealed: false, placed: false, locked: false, extra: false,
      flash: 0, flashCol: new THREE.Color("#fbbf24"), hoverK: 0,
    };
    proxy.userData.chrom = c;
    g.add(mesh, proxy);
    g.visible = false;
    root.add(g);
    chroms.push(c);
    return c;
  };
  IDS.forEach((id) => {
    if (id === "X") { addChrom("X", "S", "1", 0); addChrom("X", "S", "2", 1); }
    else if (id === "Y") addChrom("Y", "S", "3", 2);
    else { const k = String(id); addChrom(id, k, "a", 0); addChrom(id, k, "b", 1); if (id === 21) addChrom(id, k, "c", 2).extra = true; }
  });
  chroms.find((c) => c.id === "X" && c.tag === "2").extra = true;      // the second X only counts as "extra" in 47,XXY
  const xxyExtra = chroms.find((c) => c.id === "X" && c.tag === "2");

  // --- the spread: scattered like a squashed metaphase on a slide ---
  // the tray: the scattered chromosomes; during the manual challenge it moves beside / below the numbered board
  const trayCfg = () => (!S.challenge ? { cx: 0, cy: 0, RX: portrait() ? 15 : 25, RY: portrait() ? 27 : 17 }
    : portrait() ? { cx: 0, cy: -27, RX: 17, RY: 24 } : { cx: 31, cy: 0, RX: 21, RY: 26 });
  const boardShift = () => (!S.challenge ? { x: 0, y: 0 } : portrait() ? { x: 0, y: 27 } : { x: -27, y: 0 });
  function makeSpread() {
    const rnd = mulberry32(20261009), pts = [];
    const { cx, cy, RX, RY } = trayCfg();
    const order = [...chroms].sort((a, b) => b.ch.lenUm - a.ch.lenUm);
    for (const c of order) {
      let best = null, bestScore = -1;
      for (let k = 0; k < 700; k++) {
        const x = cx + (rnd() * 2 - 1) * RX, y = cy + (rnd() * 2 - 1) * RY;
        if (((x - cx) / RX) ** 2 + ((y - cy) / RY) ** 2 > 1) continue;
        const rot = rnd() * TAU, sx = -Math.sin(rot), sy = Math.cos(rot), mine = [];
        for (let s = -c.ch.qLen + 0.6; s <= c.ch.pLen - 0.4; s += 1.3) mine.push([x + sx * s, y + sy * s]);
        let dmin = 99;
        for (const m of mine) for (const p of pts) dmin = Math.min(dmin, Math.hypot(m[0] - p[0], m[1] - p[1]));
        if (dmin > bestScore) { bestScore = dmin; best = { x, y, rot, mine }; }
        if (dmin >= 3.3) break;
      }
      c.spread = { x: best.x, y: best.y, z: (rnd() - 0.5) * 1.2, rot: best.rot, flat: 0 };
      c.tiltX = (rnd() - 0.5) * 0.35; c.tiltY = (rnd() - 0.5) * 0.35;
      for (const m of best.mine) pts.push(m);
    }
  }
  makeSpread();
  for (const c of chroms) Object.assign(c.cur, c.spread);

  // --- karyogram slots ---
  const slots = [];           // {key, label, x0, x1, yc, up, down, members, row}
  const slotById = new Map();
  const groupLabels = [];     // {text, x, y}
  function layoutKaryo() {
    slots.length = 0; slotById.clear(); groupLabels.length = 0;
    const rows = portrait()
      ? [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20], [21, 22, "S"]]
      : ROWS;
    const want = (key) => chroms.filter((c) => c.key === String(key) && c.want).sort((a, b) => a.order - b.order);
    const rowInfo = rows.map((ids) => {
      const keys = ids.map(String);
      const up = Math.max(...ids.map((i) => (i === "S" ? CHROMS.X.pLen : CHROMS[i].pLen))) + 0.5;
      const down = Math.max(...ids.map((i) => (i === "S" ? CHROMS.X.qLen : CHROMS[i].qLen))) + 0.5;
      const n = keys.map((k) => Math.max(1, want(k).length));
      const widths = n.map((m) => m * PITCH), gap = 0.9;
      const total = widths.reduce((a, b) => a + b, 0) + gap * (ids.length - 1);
      return { ids, keys, up, down, widths, gap, total };
    });
    const labelTop = 2.0, labelBot = 2.2, rowGap = 0.6;
    let cursor = 0;
    rowInfo.forEach((r) => { r.yc = cursor - labelTop - r.up; cursor = r.yc - r.down - labelBot - rowGap; });
    const sh = boardShift(), shift = (cursor + rowGap) / 2 - sh.y;     // centre vertically (the challenge board is offset from the tray)
    rowInfo.forEach((r, ri) => {
      r.yc -= shift;
      let x = -r.total / 2 + sh.x;
      r.ids.forEach((id, k) => {
        const mem = want(r.keys[k]), cands = mem.length ? mem : [chroms[0]];
        // each tile is only as tall as its own chromosomes (nothing is scaled to fit)
        const s = { key: r.keys[k], id, label: id === "S" ? "X/Y" : String(id), x0: x, x1: x + r.widths[k], yc: r.yc, up: Math.max(...cands.map((c) => c.ch.pLen)) + 0.5, down: Math.max(...cands.map((c) => c.ch.qLen)) + 0.5, rowDown: r.down, members: mem, row: ri };
        slots.push(s); slotById.set(s.key, s);
        s.members.forEach((c, i) => { c.karyo = { x: s.x0 + (i + 0.5) * PITCH, y: r.yc, z: 0, rot: 0, flat: 1 }; });
        x += r.widths[k] + r.gap;
      });
      // group letters
      for (const grp of GROUPS) {
        const ss = slots.filter((s) => s.row === ri && grp.ids.includes(s.id));
        if (ss.length) groupLabels.push({ text: grp.g, x: (ss[0].x0 + ss.at(-1).x1) / 2, y: r.yc + r.up + 1.0 });
      }
      const sx = slots.find((s) => s.row === ri && s.id === "S");
      if (sx) groupLabels.push({ text: "Sex", x: (sx.x0 + sx.x1) / 2, y: r.yc + r.up + 1.0 });
    });
    // unwanted instances keep a sensible pose too
    for (const c of chroms) if (!c.karyo) c.karyo = { x: 0, y: 0, z: 0, rot: 0, flat: 1 };
    syncSlotMeshes();
  }
  // slot visuals: a faint outlined rectangle per slot + number labels
  const slotGroup = new THREE.Group(); slotGroup.visible = false; root.add(slotGroup);
  const slotPlaneGeo = new THREE.PlaneGeometry(1, 1), slotEdgeGeo = new THREE.EdgesGeometry(slotPlaneGeo);
  const slotPlaneMat = new THREE.MeshBasicMaterial({ color: "#7fe6ff", transparent: true, opacity: 0.05, depthWrite: false });
  const slotEdgeMat = new THREE.LineBasicMaterial({ color: "#7fe6ff", transparent: true, opacity: 0.35 });
  const slotMeshes = [];
  for (let i = 0; i < 25; i++) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(slotPlaneGeo, slotPlaneMat), new THREE.LineSegments(slotEdgeGeo, slotEdgeMat));
    g.visible = false; slotGroup.add(g); slotMeshes.push(g);
  }
  slotGroup.position.z = -0.8;
  const slotLbls = [], groupLbls = [];
  function syncSlotMeshes() {
    slotMeshes.forEach((m, i) => {
      const s = slots[i];
      m.visible = !!s;
      if (s) { m.position.set((s.x0 + s.x1) / 2, s.yc + (s.up - s.down) / 2, 0); m.scale.set(s.x1 - s.x0 + 0.2, s.up + s.down + 0.6, 1); }
    });
  }

  // --- movement ---
  const reduce = () => engine.reducedMotion;
  function sendTo(c, to, delay = 0, dur = 1.5) {
    c.from = { ...c.cur }; c.to = to; c.t = 0; c.delay = delay; c.dur = reduce() ? 0.01 : dur; c.moving = true;
  }
  function poseNow(c) { return S.sorted || c.placed ? c.karyo : c.spread; }
  const visibleChroms = () => chroms.filter((c) => c.want);

  function applyComplement() {
    const sx = S.cond === "xxy" ? ["X", "X", "Y"] : S.cond === "turner" ? ["X"] : S.sex === "XX" ? ["X", "X"] : ["X", "Y"];
    const nX = sx.filter((v) => v === "X").length, hasY = sx.includes("Y");
    for (const c of chroms) {
      let w;
      if (c.id === "X") w = c.tag === "1" ? nX >= 1 : nX >= 2;
      else if (c.id === "Y") w = hasY;
      else w = c.tag !== "c" || S.cond === "t21";
      c.extra = (c.id === 21 && c.tag === "c") || (c === xxyExtra && S.cond === "xxy");
      if (w !== c.want) { c.want = w; if (c.key === "S" || c.key === "21") c.paired = false; }
    }
    pickables.length = 0;
    for (const c of chroms) if (c.want) pickables.push(c.proxy);
    layoutKaryo();
    for (const c of chroms) {
      if (!c.want) continue;
      if (c.appear <= 0.01) { Object.assign(c.cur, poseNow(c)); c.moving = false; }
      else if (S.sorted || c.placed) sendTo(c, c.karyo, 0, 0.9);
    }
    if (S.sel && !S.sel.c.want) clearSel();
    else if (S.sel) buildMarkers();
  }

  function sortAll() {
    const wasCh = S.challenge;
    S.sorted = true; S.everSorted = true; S.challenge = false;
    if (wasCh) makeSpread();
    layoutKaryo();
    const list = visibleChroms().sort((a, b) => (typeof a.id === "number" ? a.id : 30) - (typeof b.id === "number" ? b.id : 30));
    list.forEach((c, i) => { c.revealed = true; c.locked = true; sendTo(c, c.karyo, i * 0.04, 1.6); });
    if (wasCh && engine.current === level && !engine.busy) resetView();
    syncUi();
  }
  function scatter() {
    const wasCh = S.challenge;
    S.sorted = false; S.challenge = false;
    if (wasCh) { makeSpread(); layoutKaryo(); }
    visibleChroms().forEach((c, i) => { c.revealed = false; c.locked = false; c.placed = false; c.paired = false; sendTo(c, c.spread, i * 0.02, 1.4); });
    for (const c of chroms) if (!c.want) { c.placed = false; c.paired = false; c.revealed = false; c.locked = false; }
    clearSel(); syncUi();
    if (wasCh && engine.current === level && !engine.busy) resetView();
  }
  function setChallenge(on) {
    if (S.sorted && on) scatter();
    S.challenge = on;
    visibleChroms().forEach((c) => { if (!c.placed) c.paired = false; });
    makeSpread();                                   // tray moves beside / below the board (or back to the middle)
    layoutKaryo();
    for (const c of visibleChroms()) { if (c.placed) sendTo(c, c.karyo, 0, 0.8); else { c.spread = { ...c.spread }; sendTo(c, c.spread, 0, 1.0); } }
    syncUi();
    if (engine.current === level && !engine.busy) resetView();
  }
  function finishChallenge() {
    S.challengeDone = true; S.challenge = false; S.sorted = true;
    makeSpread(); layoutKaryo();
    for (const c of visibleChroms()) sendTo(c, c.karyo, 0, 1.0);
    syncUi();
    if (engine.current === level && !engine.busy) resetView();
  }

  // --- pairing ---
  function groupStats() {
    const keys = {};
    for (const c of visibleChroms()) (keys[c.key] ||= []).push(c);
    let expected = 0, found = 0, all = true;
    for (const k in keys) {
      const m = keys[k];
      if (m.length < 2) continue;
      expected++;
      const pairedN = m.filter((c) => c.paired).length;
      if (pairedN >= 2) found++;
      if (pairedN < m.length) all = false;
    }
    return { expected, found, all: all && expected > 0 };
  }
  function pairUp(a, b) {
    const m = visibleChroms().filter((c) => c.key === a.key && (c === a || c === b || c.paired)).sort((p, q) => p.order - q.order);
    const cx = b.cur.x, cy = b.cur.y;
    m.forEach((c, i) => {
      c.paired = true; c.revealed = true;
      sendTo(c, { x: cx + (i - (m.length - 1) / 2) * PITCH * 1.1, y: cy, z: 0, rot: 0, flat: 0.6 }, 0, 0.7);
      c.spread = { ...c.to, flat: 0 };
      c.flash = 0.9; c.flashCol.set("#4ade80");
    });
    S.everPaired = true;
  }

  // --- selection, genes, markers ---
  const markerGeo = new THREE.TorusGeometry(R0 * 1.3, 0.085, 10, 36); markerGeo.rotateX(Math.PI / 2); markerGeo.userData.shared = true;
  let markers = [];                                  // {obj, sprite, gene, c}
  const geneLbls = [];
  function clearMarkers() {
    for (const m of markers) {
      m.obj.parent?.remove(m.obj);
      m.obj.traverse((o) => { if (o.material) o.material.dispose(); });
    }
    markers = [];
  }
  function buildMarkers() {
    clearMarkers();
    if (!S.sel || !S.sel.revealed) return;
    const genes = genesOn(S.sel.id);
    const members = visibleChroms().filter((c) => c.key === S.sel.c.key && (S.sel.id !== "X" && S.sel.id !== "Y" ? true : c.id === S.sel.id));
    for (const c of members) for (const gn of genes) for (const sigma of [1, -1]) {
      const us = gn.bands.map((b) => bandU(c.id, b)), u = us.reduce((a, b) => a + b, 0) / us.length;
      const p = centreAt(c.ch, u, sigma);
      const colr = new THREE.Color(gn.color);
      const ring = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: colr, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: colr, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
      sprite.scale.setScalar(1.3);
      const o = new THREE.Group(); o.position.set(p.x, p.y, 0); o.add(ring, sprite); o.renderOrder = 20; ring.renderOrder = 20; sprite.renderOrder = 21;
      c.g.add(o);
      markers.push({ obj: o, ring, sprite, gene: gn, c, first: c === members[0] && sigma === 1 });
    }
  }
  function select(c, geneId = null, fly = false) {
    const prev = S.sel;
    const revealed = c.revealed || S.sorted || c.placed || c.paired;
    S.sel = { c, id: c.id, revealed, cls: c.ch.cls, mb: Math.round(c.ch.mb) };
    S.gene = geneId;
    if (revealed) {
      if (c.id === "X" || c.id === "Y") S.sexSelected = true;
      if (c.id === 21 && S.cond === "t21") S.t21Selected = true;
    }
    if (geneId && revealed) S.seenGene.add(geneId);
    buildMarkers();
    renderSel();
    if (fly) zoomToSel();
    if (!prev || prev.c !== c) uiT = 0;
  }
  function clearSel() { S.sel = null; S.gene = null; clearMarkers(); renderSel(); }
  function selectGene(geneId) {
    const gn = GENE_BY_ID[geneId];
    let c = visibleChroms().find((x) => x.id === gn.chr);
    if (!c) { engine.toast(`This karyotype has no chromosome ${gn.chr}.`); return; }
    visibleChroms().filter((x) => x.id === gn.chr).forEach((x) => { x.revealed = true; });
    select(c, geneId, true);
  }
  const _v = new THREE.Vector3();
  function zoomToSel() {
    if (!S.sel) return;
    const c = S.sel.c, ch = c.ch;
    const pose = S.sorted || c.placed ? c.karyo : c.cur;
    const target = new THREE.Vector3(pose.x, pose.y + (ch.pLen - ch.qLen) / 2 * Math.cos(pose.rot), pose.z);
    const d = clamp(ch.lenUm * 2.1, 11, 40) * (portrait() ? 1.6 : 1);
    engine.fly(target, target.clone().add(new THREE.Vector3(0, 0.03, 1).normalize().multiplyScalar(d)), 0.9);
  }
  function resetView() {
    const v = level.view; engine.fly(v.target, v.target.clone().addScaledVector(v.dir.clone().normalize(), v.distance), 0.9);
  }

  // --- interaction ---
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hitP = new THREE.Vector3();
  let drag = null, uiT = 0, hoverC = null;
  function rayPoint(e, z) {
    engine.setRay(e.clientX, e.clientY);
    plane.constant = -z;
    const r = engine.ray.ray;
    if (Math.abs(r.direction.z) < 0.12) { engine.camera.getWorldDirection(plane.normal).negate(); plane.constant = -plane.normal.dot(_v.set(0, 0, z)); }
    else plane.normal.set(0, 0, 1);
    return r.intersectPlane(plane, hitP) ? hitP : null;
  }
  function nearestSlot(x, y) {
    let best = null, bd = 1e9;
    for (const s of slots) {
      const cx = (s.x0 + s.x1) / 2, cy = s.yc + (s.up - s.down) / 2;
      const dx = Math.max(0, Math.abs(x - cx) - (s.x1 - s.x0) / 2), dy = Math.max(0, Math.abs(y - cy) - (s.up + s.down) / 2);
      const d = Math.hypot(dx, dy);
      if (d < bd) { bd = d; best = s; }
    }
    return bd < 1.2 ? best : null;
  }
  const level = {
    title: "Human karyotype",
    topics: ["genes", "inheritance", "meiosis", "mutation", "dna-structure", "cell-cycle", "epigenetics"],
    root, pickables, portals: [],
    metersPerUnit: 1e-6,
    get view() {
      const a = engine.camera.aspect, p = a < 0.9;
      const ch = S.challenge;
      const d = Math.max((p ? (ch ? 112 : 62) : 54) / 0.688, (p ? 38 : ch ? 102 : 60) / (0.688 * a));
      return { target: new THREE.Vector3(!p && ch ? 2 : 0, p ? (ch ? 0 : 3) : 0, 0), distance: clamp(d, 20, 260), dir: new THREE.Vector3(0, 0.04, 1) };
    },
    minDistance: 5, maxDistance: 260, near: 0.3, far: 900,
    env: null,
    info(obj) {
      const c = obj.userData.chrom;
      if (!c) return null;
      const rv = c.revealed || S.sorted || c.placed || c.paired;
      return { title: rv ? `Chromosome ${c.id} · ${c.ch.cls}` : "Unsorted chromosome" + (c.locked ? "" : "<small>drag onto its partner, or click to inspect</small>") };
    },
    onHover(obj) { hoverC = obj?.userData?.chrom || null; },
    onSelect(info) { if (!info && S.sel) clearSel(); },
    onPointerDown(e, hit) {
      const c = hit?.object?.userData?.chrom;
      if (!c) return false;
      const members = !c.locked && c.paired ? visibleChroms().filter((o) => o.key === c.key && o.paired) : [c];
      const p = rayPoint(e, c.cur.z);
      drag = { c, members, sx: e.clientX, sy: e.clientY, moved: false, p0: p ? p.clone() : null, offs: members.map((o) => ({ x: o.cur.x, y: o.cur.y, z: o.cur.z, rot: o.cur.rot, o })) };
      return true;
    },
    onPointerDrag(e) {
      if (!drag) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) {
        if (drag.c.locked) return;
        drag.moved = true;
        drag.offs.forEach((o) => { o.o.moving = false; });
      }
      if (!drag.moved || !drag.p0) return;
      const p = rayPoint(e, drag.c.cur.z);
      if (!p) return;
      for (const o of drag.offs) {
        o.o.cur.x = o.x + p.x - drag.p0.x; o.o.cur.y = o.y + p.y - drag.p0.y;
        o.o.cur.z = 2.4; o.o.moving = false;
      }
    },
    onPointerUp(e) {
      const d = drag; drag = null;
      if (!d) return;
      if (!d.moved) { select(d.c); return; }
      const c = d.c;
      d.offs.forEach((o) => { o.o.cur.z = o.z; });
      const back = () => d.offs.forEach((o) => { sendTo(o.o, { x: o.x, y: o.y, z: o.z, rot: o.rot, flat: o.o.cur.flat }, 0, 0.5); });
      const wrong = (msg) => { engine.toast(msg, 3200); c.flash = 0.7; c.flashCol.set("#f87171"); back(); };
      // 1. a numbered slot (challenge)
      if (S.challenge) {
        const s = nearestSlot(c.cur.x, c.cur.y);
        if (s) {
          if (s.key === c.key) {
            c.placed = true; c.revealed = true; c.locked = true; sendTo(c, c.karyo, 0, 0.6); c.flash = 0.9; c.flashCol.set("#4ade80");
            const left = visibleChroms().filter((o) => !o.placed).length;
            if (!left) { finishChallenge(); engine.toast("Karyogram complete! Every chromosome is in its slot.", 3600); }
            else engine.toast(`Slot ${s.label}: correct. ${left} to go.`, 1600);
          } else wrong(`Not slot ${s.label}. Compare the length, the centromere position and the band pattern.`);
          syncUi();
          return;
        }
      }
      // 2. a partner
      engine.setRay(e.clientX, e.clientY);
      const others = pickables.filter((p) => !d.members.includes(p.userData.chrom) && !p.userData.chrom.locked);
      const hit = engine.ray.intersectObjects(others, false)[0];
      const o = hit?.object.userData.chrom;
      if (o) {
        if (o.key === c.key) {
          pairUp(c, o);
          engine.toast(c.key === "S" ? "X and Y are the sex pair. They are different sizes, but they pair up in meiosis." : "A pair! One chromosome of each pair came from each parent.", 2600);
          syncUi();
        } else wrong(lens.pick({ "y7-8": "Not a match. Look at the length and where the pinched middle is.", "y9-10": "Not homologous. Compare length, centromere position and the banding pattern." }));
        return;
      }
      // dropped on empty space: stays where it is
      for (const o of d.offs) { o.o.spread = { x: o.o.cur.x, y: o.o.cur.y, z: clamp(o.x === undefined ? 0 : o.z, -1, 1), rot: o.o.cur.rot, flat: 0 }; o.o.cur.z = o.o.spread.z; }   // pairs stay paired and move together
      syncUi();
    },
  };
  Object.defineProperty(level, "env", {
    get() {
      return S.stain === "fluor"
        ? { bg: ["#02050c", "#05101f", "#0a2a40"], fog: ["#030a14", 0.0012], exposure: 0.95, bloom: [0.3, 0.55, 0.9], aperture: 0.0003 }
        : { bg: ["#f3eff8", "#f8f5ee", "#e6dff2"], fog: ["#f5f2f8", 0.0008], exposure: 0.95, bloom: [0.04, 0.4, 1.0], aperture: 0.0002 };
    },
  });
  function applyStain() {
    const fl = S.stain === "fluor";
    for (const c of chroms) {
      c.mat.map = c.mat.emissiveMap = atlas[S.stain];
      c.mat.emissiveIntensity = fl ? 0.3 : 0.22; c.mat.color.set(fl ? "#c8d8e8" : "#ffffff");
      c.mat.sheenColor.set(fl ? "#9fe8ff" : "#c8b6ff");
    }
    rimU.rimK.value = fl ? 0.4 : 0.07; rimU.rimCol.value.set(fl ? "#7fe6ff" : "#8f7bd8");
    rim.intensity = fl ? 1.6 : 0.6; dust.visible = fl;
    slotEdgeMat.color.set(fl ? "#7fe6ff" : "#4c3a9a"); slotPlaneMat.color.set(fl ? "#7fe6ff" : "#4c3a9a");
    engine.stageEl.classList.toggle("kary-light", !fl);
    if (engine.current === level) engine.applyEnv(level.env);
  }

  // --- labels ---
  const lbl = (cls, html = "") => { const d = engine.label(html, cls); d.style.display = "none"; return d; };
  for (let i = 0; i < 25; i++) slotLbls.push(lbl("kyl"));
  for (let i = 0; i < 9; i++) groupLbls.push(lbl("kyg"));
  for (let i = 0; i < 3; i++) geneLbls.push(lbl("kygene"));
  const extraLbl = lbl("kyx", "extra");
  const hideLabels = () => { [...slotLbls, ...groupLbls, ...geneLbls, extraLbl].forEach((l) => (l.style.display = "none")); };
  const _w = new THREE.Vector3();
  function updateLabels() {
    const showSlots = S.sorted || S.challenge;
    slotLbls.forEach((l, i) => {
      const s = showSlots && slots[i];
      if (!s) { l.style.display = "none"; return; }
      if (l._t !== s.label) { l._t = s.label; l.textContent = s.label; }
      _w.set((s.x0 + s.x1) / 2, s.yc - s.rowDown - 1.0, 0);
      engine.place(l, _w);
    });
    groupLbls.forEach((l, i) => {
      const g = showSlots && groupLabels[i];
      if (!g) { l.style.display = "none"; return; }
      if (l._t !== g.text) { l._t = g.text; l.textContent = g.text; }
      _w.set(g.x, g.y, 0); engine.place(l, _w);
    });
    // gene labels (first marker per gene)
    let n = 0;
    for (const m of markers) {
      if (!m.first && !(m.gene.id !== markers[0]?.gene.id && markers.findIndex((q) => q.gene === m.gene) === markers.indexOf(m))) continue;
      const l = geneLbls[n++]; if (!l) break;
      const txt = m.gene.sym; if (l._t !== txt) { l._t = txt; l.textContent = txt; l.style.color = m.gene.color; }
      m.obj.getWorldPosition(_w); _w.y += 0; engine.place(l, _w, 34, -16);
    }
    for (let i = n; i < geneLbls.length; i++) geneLbls[i].style.display = "none";
    // "extra" tag
    const ex = S.showDiff && S.cond !== "none" && S.sorted ? chroms.find((c) => c.want && c.extra) : null;
    if (ex) { _w.set(ex.cur.x, ex.cur.y - ex.ch.qLen - 2.7, 0); engine.place(extraLbl, _w); } else extraLbl.style.display = "none";
  }

  // --- counting ---
  let counting = null;
  function startCount() {
    if (counting) return;
    counting = { list: visibleChroms().sort((a, b) => a.cur.x - b.cur.x), i: 0, t: 0 };
  }

  // =================================================================== UI
  let panelEl = null, progress = null, mission = null, nodes = {}, chips = null, narrKey = "", chipKey = "";
  function syncUi() {
    if (!progress) return;
    nodes.sortBtn.textContent = S.sorted ? "Scatter them again" : lens.pick({ "y7-8": "Arrange the pairs by size ▸", "y9-10": "Sort into a karyogram ▸", y11: "Auto-sort into a karyogram ▸" });
    nodes.sortBtn.classList.toggle("primary", !S.sorted);
    if (nodes.chal) { nodes.chal.setAttribute("aria-pressed", String(S.challenge)); nodes.chal.textContent = S.challenge ? "Stop the challenge" : "Manual challenge: drag to slots"; }
    nodes.hint.innerHTML = S.sorted ? "The chromosomes are in standard karyogram order." : S.challenge
      ? "Drag each chromosome into its numbered slot. Compare the length, the centromere and the band pattern. Wrong slots bounce back."
      : lens.pick({ "y7-8": "Drag a chromosome onto its look-alike partner. A matching pair turns green and snaps together.", "y9-10": "Drag a chromosome onto its homologous partner to pair them, or press Sort to build the karyogram.", y11: "Pair homologues by length, centromere position and banding, auto-sort, or run the manual karyogram challenge." });
    nodes.cond?.set(S.cond); nodes.sex.set(S.sex);
    nodes.sexWrap.style.opacity = S.cond === "xxy" || S.cond === "turner" ? 0.45 : 1;
    nodes.stain.set(S.stain);
    narrKey = "";
  }
  function el(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }

  function buildPanel(parent) {
    const node = el("div", "kary"); node.style.display = "contents";
    parent.appendChild(node);
    panelEl = parent;
    progress = { band: lens.band, node };
    const L = (v) => lens.pick(v);

    const about = K.card(node, "Human karyotype");
    about.insertAdjacentHTML("beforeend", `<p>${L(NOTE)}</p>`);
    about.insertAdjacentHTML("beforeend", `<p class="hint">${L({ "y7-8": "Drag chromosomes to move them. Right-drag (or drag empty space) to look around.", "y9-10": "Click a chromosome to see its ideogram and genes. Drag to move one.", y11: "Click a chromosome for its ideogram, ISCN loci and genes. Drag to reposition, or onto a slot or partner." })}</p>`);

    const arr = K.card(node, "Arrange the chromosomes");
    nodes.hint = el("p", "hint"); nodes.hint.style.margin = "0 0 8px"; arr.appendChild(nodes.hint);
    const row = K.buttonRow(arr);
    nodes.sortBtn = K.button(row, "Sort", () => (S.sorted ? scatter() : sortAll()), { kind: "primary" });
    K.button(row, "Count them", () => startCount());
    if (lens.atLeast("y9-10")) nodes.chal = K.button(row, "Manual challenge", () => setChallenge(!S.challenge), { toggle: true });
    arr.insertAdjacentHTML("beforeend", `<div class="klbl">Stain</div>`);
    nodes.stain = K.segmented(arr, [{ value: "fluor", label: "Fluorescence (DAPI-like)" }, { value: "giemsa", label: "Giemsa (brightfield)" }], S.stain, (v) => { S.stain = v; applyStain(); syncUi(); });
    arr.insertAdjacentHTML("beforeend", `<p class="hint">${L({ "y7-8": "Two ways of staining the same chromosomes.", "y9-10": "Both show similar band patterns. Giemsa-dark bands tend to be bright with DAPI.", y11: "G-banding: trypsin then Giemsa makes AT-rich, gene-poor, late-replicating regions stain dark. DAPI also binds AT-rich DNA preferentially, so a similar (not identical) pattern of bands appears bright." })}</p>`);

    const who = K.card(node, L({ "y7-8": "Boy or girl?", "y9-10": "Whose chromosomes are these?" }));
    nodes.sexWrap = el("div"); who.appendChild(nodes.sexWrap);
    nodes.sex = K.segmented(nodes.sexWrap, [{ value: "XX", label: "46,XX (female)" }, { value: "XY", label: "46,XY (male)" }], S.sex, (v) => { if (S.cond === "xxy" || S.cond === "turner") { nodes.sex.set(S.sex); return; } S.sex = v; applyComplement(); syncUi(); });
    if (lens.atLeast("y9-10")) {
      who.insertAdjacentHTML("beforeend", `<div class="klbl">Chromosome number conditions (aneuploidy)</div>`);
      const opts = [{ value: "none", label: "Typical" }, { value: "t21", label: "Down (+21)" }, { value: "xxy", label: "XXY" }, { value: "turner", label: "45,X" }];
      nodes.cond = K.segmented(who, opts, S.cond, (v) => {
        S.cond = v; S.t21Selected = false; applyComplement(); syncUi();
        if (v !== "none") engine.toast(`${CONDITIONS[v].label}: ${v === "t21" ? "47" : v === "xxy" ? "47" : "45"} chromosomes. ${S.sorted ? "" : "Sort them to see the difference."}`, 3000);
      });
      K.checkbox(who, "Mark the extra chromosome (after sorting)", true, (v) => { S.showDiff = v; });
    }
    const cp = el("p", "hint", ""); cp.style.marginTop = "8px"; who.appendChild(cp); nodes.condNote = cp;
    if (lens.atLeast("y9-10")) {
      const xr = K.buttonRow(who);
      K.button(xr, "Why one X is switched off (Barr bodies) ▸", () => {
        const kt = S.cond === "xxy" ? "XXY" : S.cond === "turner" ? "X0" : S.sex;
        engine.dive({ to: "epigenetics", label: "Epigenetics", radius: 10, center: () => new THREE.Vector3(0, 0, 0), object: root, start: { view: "x", karyotype: kt } });
      });
    }

    nodes.selCard = K.card(node, "Selected chromosome"); nodes.selCard.style.display = "none";

    const gm = K.card(node, L({ "y7-8": "Find a gene", "y9-10": "Gene map", y11: "Gene map (ISCN loci)" }));
    gm.insertAdjacentHTML("beforeend", `<p class="hint" style="margin:0 0 6px">${L({ "y7-8": "Genes are sections of chromosomes. Click a gene to find its chromosome.", "y9-10": "Real genes at their correct positions. Click one to zoom to its chromosome.", y11: "Click a gene to select its chromosome and show the locus (chromosome, arm, region, band)." })}</p>`);
    const gl = el("div", "genes"); gm.appendChild(gl);
    nodes.geneChips = GENES.map((g) => {
      const b = el("button", "gchip", `<i style="background:${g.color};color:${g.color}"></i>${esc(g.sym)}<small>${lens.atLeast("y9-10") ? g.loc : "chr " + g.chr}</small>`);
      b.type = "button"; b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", () => selectGene(g.id));
      gl.appendChild(b); return b;
    });

    if (lens.atLeast("y9-10")) {
      const nd = K.card(node, "Where do extra chromosomes come from?");
      nd.insertAdjacentHTML("beforeend", `<p>${L({ "y9-10": "Most aneuploidies start with <strong>nondisjunction</strong> in meiosis: a pair of homologues (or sister chromatids) fails to separate, so a gamete gets two copies or none. The fertilised egg then has 47 or 45 chromosomes.", y11: "Most aneuploidies arise from <strong>nondisjunction</strong> in meiosis I (homologues stay together) or meiosis II (sister chromatids stay together). The gamete is n+1 or n−1, so fertilisation gives a trisomic or monosomic zygote. Trisomy 21 is mostly maternal in origin." })}</p>
        <p>The risk of trisomy 21 rises with the mother's age, because her egg cells begin meiosis before she is born and wait, in prophase I, for decades:</p>
        <table class="age"><tr><th>Mother's age</th><th>20</th><th>30</th><th>35</th><th>40</th><th>45</th></tr><tr><td>Approx. chance</td><td>1 in 1,500</td><td>1 in 900</td><td>1 in 350</td><td>1 in 100</td><td>1 in 30</td></tr></table>
        <p class="hint">Approximate rates among live births (Hook 1981), not at conception. Figures vary between studies.</p>`);
      const r = K.buttonRow(nd);
      K.button(r, "See nondisjunction in meiosis ▸", () => engine.dive({ to: "meiosis", label: "Meiosis", radius: 10, center: () => new THREE.Vector3(0, 0, 0), object: root }), { kind: "primary" });
    }
    if (plantRoot) {
      const pl = K.card(node, "A note from the plant cell");
      pl.insertAdjacentHTML("beforeend", `<p class="pnote">${PLANT_NOTE}</p>`);
    }
    const ex = K.card(node, "What's happening");
    nodes.narr = el("div"); ex.appendChild(nodes.narr);

    mission = K.missions(node, lens.filter(MISSIONS).map((m) => ({ text: m.text, check: () => m.check(S) })), (m) => engine.toast(`🎯 Mission complete: ${m.text}`, 3400));
    K.quiz(node, lens.filter(QUIZ));
    syncUi(); renderSel(); updateNarr(true);
  }

  // ---------- ideogram ----------
  function drawIdeogram(cv, id, hiGene) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), W = 150, H = 300;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const ch = CHROMS[id], x0 = 84, w = 26, top = 16, hh = 268, y = (u) => top + u * hh;
    const ycen = y(ch.ci), lo = [233, 240, 251], hi = [36, 48, 73];
    const rr = (a, b, rad) => { ctx.beginPath(); ctx.roundRect(x0 - w / 2, a, w, b - a, rad); };
    const arm = (a, b, pArm) => {
      ctx.save(); rr(a, b, pArm ? [12, 12, 3, 3] : [3, 3, 12, 12]); ctx.clip();
      for (const b of ch.bands) {
        if (b.stain === "a") continue;
        if ((b.u0 + b.u1) / 2 < ch.ci !== pArm) continue;
        const v = b.stain === "s" ? 0 : STAIN_VAL[b.stain], col = lo.map((l, i) => Math.round(l + (hi[i] - l) * v));
        ctx.fillStyle = `rgb(${col})`; ctx.fillRect(x0 - w / 2, y(b.u0), w, y(b.u1) - y(b.u0) + 0.5);
        if (b.stain === "v") { ctx.strokeStyle = "rgba(233,240,251,0.35)"; ctx.lineWidth = 1; for (let yy = y(b.u0); yy < y(b.u1); yy += 4) { ctx.beginPath(); ctx.moveTo(x0 - w / 2, yy); ctx.lineTo(x0 + w / 2, yy + 3); ctx.stroke(); } }
        if (b.stain === "s") { ctx.clearRect(x0 - w / 2 - 1, y(b.u0), w / 2 - 3, y(b.u1) - y(b.u0)); ctx.clearRect(x0 + 3, y(b.u0), w / 2 + 1, y(b.u1) - y(b.u0)); ctx.fillStyle = "rgb(190,200,220)"; ctx.fillRect(x0 - 3, y(b.u0), 6, y(b.u1) - y(b.u0)); }
      }
      ctx.restore();
      ctx.save(); ctx.strokeStyle = "rgba(159,179,207,0.9)"; ctx.lineWidth = 1.2; rr(a, b, pArm ? [12, 12, 3, 3] : [3, 3, 12, 12]); ctx.stroke(); ctx.restore();
    };
    arm(y(0), ycen - 1.5, true); arm(ycen + 1.5, y(1), false);
    ctx.font = "600 11px Inter, system-ui, sans-serif"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#9fb3cf"; ctx.textAlign = "left";
    ctx.fillText("p", x0 + w / 2 + 6, y(ch.ci / 2)); ctx.fillText("q", x0 + w / 2 + 6, y((1 + ch.ci) / 2));
    // ISCN region labels on the right (skip those too close together)
    ctx.font = "10px Inter, system-ui, sans-serif"; ctx.fillStyle = "#6a7f9c";
    let lastY = -99, lastReg = "";
    for (const b of ch.bands) {
      if (b.stain === "a") continue;
      const reg = b.name.split(".")[0];
      if (reg === lastReg) continue;
      const yy = y((b.u0 + b.u1) / 2);
      if (yy - lastY < 12 || Math.abs(yy - ycen) < 9) continue;
      ctx.fillText(reg, x0 + w / 2 + 22, yy); lastReg = reg; lastY = yy;
    }
    ctx.fillStyle = "#9fb3cf"; ctx.fillText("cen", x0 + w / 2 + 22, ycen);
    // gene loci on the left
    ctx.textAlign = "right";
    for (const g of genesOn(id)) {
      const u = g.bands.map((b) => bandU(id, b)).reduce((a, b) => a + b, 0) / g.bands.length, yy = y(u);
      const hl = hiGene === g.id;
      ctx.strokeStyle = g.color; ctx.fillStyle = g.color; ctx.lineWidth = hl ? 2.2 : 1.4;
      ctx.shadowColor = g.color; ctx.shadowBlur = hl ? 12 : 6;
      ctx.beginPath(); ctx.moveTo(x0 - w / 2 - 9, yy); ctx.lineTo(x0 + w / 2 + 2, yy); ctx.stroke();
      ctx.beginPath(); ctx.arc(x0 - w / 2 - 9, yy, hl ? 4 : 3, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.font = `${hl ? 700 : 600} 11px Inter, system-ui, sans-serif`;
      ctx.fillText(g.sym.split(" ")[0], x0 - w / 2 - 15, yy - 1);
    }
  }

  function renderSel() {
    const card = nodes.selCard;
    if (!card) return;
    nodes.geneChips?.forEach((b, i) => b.setAttribute("aria-pressed", String(S.gene === GENES[i].id)));
    if (!S.sel) { card.style.display = "none"; return; }
    card.style.display = "";
    const L = (v) => lens.pick(v), s = S.sel, ch = s.c.ch;
    const len = ch.lenUm.toFixed(1), ci = ch.ci.toFixed(2);
    let html = `<h2>${s.revealed ? `Chromosome ${s.id}` : "Unlabelled chromosome"}</h2>`;
    if (!s.revealed) {
      html += `<div class="facts"><div>Length at metaphase: <b>${len} µm</b></div><div>Centromere position (p arm ÷ whole): <b>${ci}</b></div><div>${L(CLASS_TEXT[ch.cls])}</div></div>
        <p class="hint">Which numbered pair is it? Compare with the others, pair it up or sort the spread to find out. The ideogram and genes appear once it is identified.</p>`;
      card.innerHTML = html; return;
    }
    const grp = groupOf(s.id);
    html += `<div class="ideo-wrap"><canvas width="150" height="300" aria-label="Ideogram of chromosome ${s.id}"></canvas><div class="facts">
      <div>Group <b>${grp}</b></div>
      <div>Length at metaphase: <b>${len} µm</b> (${ch.mb.toFixed(0)} million base pairs)</div>
      <div>${L(CLASS_TEXT[ch.cls])}</div>
      ${lens.atLeast("y11") ? `<div>Centromere index <b>${ci}</b>: p arm ${(ch.pLen).toFixed(1)} µm, q arm ${(ch.qLen).toFixed(1)} µm</div><div>Dark bands: AT-rich, gene-poor. Light bands: GC-rich, gene-rich.</div>` : ""}
      ${s.id === 21 ? `<div>${L({ "y9-10": "Chromosome 21 is the smallest autosome by DNA, even though it was numbered before 22.", y11: "Chromosome 21 holds fewer genes than 22 but is numbered first because it was identified before sizes were measured precisely." })}</div>` : ""}
      <div><button type="button" class="btn" data-act="zoom">Zoom to it</button></div>
      <div class="hint" style="font-size:0.72rem">Ideogram drawn to a fixed height, not to scale.</div></div></div>`;
    const genes = genesOn(s.id);
    html += genes.length ? `<div class="klbl">Genes on this chromosome</div><div class="genes">${genes.map((g) => `<button type="button" class="gchip" data-g="${g.id}" aria-pressed="${S.gene === g.id}"><i style="background:${g.color};color:${g.color}"></i>${esc(g.sym)}<small>${g.loc}</small></button>`).join("")}</div>`
      : `<p class="hint">None of the ten example genes in the gene map sit on this chromosome. Every chromosome carries many genes.</p>`;
    if (S.gene) {
      const g = GENE_BY_ID[S.gene];
      html += `<div class="gdetail"><h3>${esc(g.sym)} <span style="color:var(--ink-faint);font-weight:400;font-size:0.8rem">${g.loc}</span></h3>
        <p><b>Codes for</b> ${g.codes}.</p><p>${L(g.trait)}</p><p><span class="pat">${g.pattern}</span></p><p>${L(g.inherit)}</p>${g.note ? `<p class="hint">${g.note}</p>` : ""}
        ${g.preset ? `<div class="btn-row"><button type="button" class="btn primary" data-lab="${g.preset}">Try it in the Inheritance lab ▸</button></div>` : ""}</div>`;
    }
    card.innerHTML = html;
    drawIdeogram(card.querySelector("canvas"), s.id, S.gene);
    card.querySelector("[data-act=zoom]")?.addEventListener("click", zoomToSel);
    card.querySelectorAll("[data-g]").forEach((b) => b.addEventListener("click", () => { select(s.c, b.dataset.g, true); }));
    card.querySelector("[data-lab]")?.addEventListener("click", (e) => {
      engine.inheritancePreset = e.currentTarget.dataset.lab;
      const c = s.c;
      engine.dive({ to: "inheritance", label: "Inheritance lab", radius: Math.max(5, c.ch.lenUm * 0.6), center: () => new THREE.Vector3(c.cur.x, c.cur.y, c.cur.z), object: root });
    });
  }

  function currentS() {
    const n = visibleChroms().length, gs = groupStats();
    const sexN = visibleChroms().filter((c) => c.key === "S").length;
    return {
      sex: S.sex, cond: S.cond, total: n, autosomes: n - sexN, view: S.sorted ? "karyogram" : "spread",
      notation: notation(), pairsFound: gs.found, pairsExpected: gs.expected,
      sel: S.sel && { id: S.sel.id, revealed: S.sel.revealed, cls: S.sel.cls, mb: S.sel.mb, gene: S.gene ? GENE_BY_ID[S.gene] : null },
    };
  }
  function notation() {
    const n = visibleChroms().length;
    const sx = S.cond === "xxy" ? "XXY" : S.cond === "turner" ? "X" : S.sex;
    return `${n},${sx}${S.cond === "t21" ? ",+21" : ""}`;
  }
  function updateNarr(force) {
    if (!nodes.narr) return;
    const st = currentS();
    const k = JSON.stringify([st.sex, st.cond, st.view, st.pairsFound, st.sel && [st.sel.id, st.sel.revealed, st.sel.gene?.id], lens.band]);
    if (!force && k === narrKey) return;
    narrKey = k;
    nodes.narr.innerHTML = narrative(st, lens);
    if (nodes.condNote) nodes.condNote.innerHTML = "";
    if (nodes.condNote && S.cond !== "none") nodes.condNote.innerHTML = `<strong>${notation()}</strong> · ${CONDITIONS[S.cond].label}`;
    ms_update(st);
  }
  function ms_update(st) { S.allPaired = groupStats().all; }

  function buildChips() {
    engine.overlay.innerHTML = "";
    chips = { count: K.chip(engine.overlay, ""), pairs: K.chip(engine.overlay, "") };
    chipKey = "";
  }
  function updateChips() {
    if (!chips) return;
    const st = currentS();
    const sexTxt = S.cond === "xxy" ? "XXY" : S.cond === "turner" ? "X" : S.sex;
    const n = counting ? counting.i : st.total;
    const pairsTxt = S.cond === "t21" ? "22 pairs + a third 21" : `${st.autosomes / 2 | 0} autosome pairs`;
    const k = `${n}|${st.autosomes}|${sexTxt}|${S.cond}|${st.pairsFound}|${S.sorted}|${counting ? 1 : 0}`;
    if (k === chipKey) return; chipKey = k;
    chips.count(`<span class="dot" style="background:#7fe6ff"></span>Chromosomes <b>${n}</b>${counting ? "…" : ""} · ${pairsTxt}${S.cond === "t21" ? "" : ""} + sex chromosomes <b>${sexTxt}</b>`);
    chips.pairs(S.sorted ? `<span class="dot" style="background:#4ade80"></span>Karyogram: groups A to G` : `<span class="dot" style="background:#fbbf24"></span>Pairs found <b>${st.pairsFound}</b> / ${st.pairsExpected}`);
  }

  // =================================================================== frame update
  const _c = new THREE.Color();
  function updateChrom(c, dt, t) {
    // appear / disappear
    const want = c.want ? 1 : 0;
    c.appear = want > c.appear ? Math.min(1, c.appear + dt * 3) : Math.max(0, c.appear - dt * 3);
    if (c.appear <= 0.001) { c.g.visible = false; return; }
    c.g.visible = true;
    const dragging = drag && drag.offs.some((o) => o.o === c) && drag.moved;
    if (c.moving && !dragging) {
      if (c.delay > 0) c.delay -= dt;
      else {
        c.t = Math.min(1, c.t + dt / c.dur);
        const k = ease(c.t), f = c.from, to = c.to;
        c.cur.x = lerp(f.x, to.x, k); c.cur.y = lerp(f.y, to.y, k);
        c.cur.z = lerp(f.z, to.z, k) + Math.sin(Math.PI * k) * (S.sorted ? 3.2 : 1.2);
        c.cur.rot = f.rot + wrapPi(to.rot - f.rot) * k; c.cur.flat = lerp(f.flat, to.flat, k);
        if (c.t >= 1) { c.moving = false; Object.assign(c.cur, { x: to.x, y: to.y, z: to.z, rot: to.rot, flat: to.flat }); }
      }
    }
    const idle = !c.moving && !dragging && !S.sorted && !c.placed && !reduce() ? Math.sin(t * 0.5 + c.phase) * 0.035 : 0;
    const fl = c.cur.flat;
    c.g.position.set(c.cur.x, c.cur.y, c.cur.z);
    c.g.rotation.set(c.tiltX * (1 - fl), c.tiltY * (1 - fl), c.cur.rot + idle, "ZXY");
    const sc = (0.2 + 0.8 * ease(c.appear)) * (dragging ? 1.05 : 1);
    c.g.scale.setScalar(sc);
    // highlight
    let col = null, k = 0;
    const selMatch = S.sel && (S.sel.c === c || (S.sel.revealed && c.key === S.sel.c.key && c.revealed));
    if (c.flash > 0) { c.flash -= dt; col = c.flashCol; k = Math.min(1, c.flash * 1.6) * 0.6; }
    else if (selMatch) { col = _c.set("#ffd76a"); k = 0.22 + 0.06 * Math.sin(t * 3); }
    else if (hoverC === c) { col = _c.set("#a5f3fc"); k = 0.3; }
    else if (S.showDiff && c.extra && S.cond !== "none" && c.revealed && (S.sorted || c.placed || c.paired)) { col = _c.set("#fbbf24"); k = 0.22 + 0.1 * Math.sin(t * 3); }
    const u = c.mat.userData;
    if (col) u.hiCol.value.copy(col);
    u.hi.value = lerp(u.hi.value, k, Math.min(1, dt * 14 + 0.001));
  }
  level.update = (dt, t, rdt = dt) => {
    for (const c of chroms) updateChrom(c, dt || 0, t);
    dust.rotation.z = reduce() ? 0 : t * 0.004;
    for (const m of markers) {
      const k = 0.85 + 0.15 * Math.sin(t * 3 + m.c.phase), hl = S.gene && m.gene.id === S.gene ? 1.5 : 1;
      m.sprite.scale.setScalar(1.3 * k * hl); m.ring.scale.setScalar(hl > 1 ? 1.2 : 1);
    }
    if (counting) {
      counting.t -= rdt;
      if (counting.t <= 0) {
        const c = counting.list[counting.i];
        if (c) { c.flash = 0.7; c.flashCol.set("#7fe6ff"); counting.i++; counting.t = reduce() ? 0.01 : Math.max(0.05, 2.2 / counting.list.length); }
        else { S.counted = true; engine.toast(`${counting.list.length} chromosomes: ${currentS().autosomes} autosomes (${currentS().autosomes / 2 | 0} pairs) + sex chromosomes ${S.cond === "xxy" ? "XXY" : S.cond === "turner" ? "X" : S.sex}.`, 4200); counting = null; chipKey = ""; }
      }
    }
    slotGroup.visible = S.sorted || S.challenge;
    updateLabels();
    if ((uiT -= rdt) <= 0) { uiT = 0.3; updateChips(); updateNarr(false); }
    mission?.update();
  };

  level.mountPanel = (el) => {
    if (progress && progress.band === lens.band) { panelEl = el; el.appendChild(progress.node); }
    else buildPanel(el);
    buildChips();
    applyStain();
  };
  level.unmountPanel = () => { hideLabels(); engine.overlay.innerHTML = ""; chips = null; engine.stageEl.classList.remove("kary-light"); drag = null; };
  level.onResume = () => { applyStain(); };
  level.clayEnv = { bg: ["#f3eff8", "#f8f5ee", "#e6dff2"], fog: ["#f5f2f8", 0.0008], exposure: 0.95, bloom: [0, 0.4, 1], aperture: 0.0002 };
  level.onStyle = (name) => {            // the clay look has a light backdrop: use the brightfield (Giemsa) stain there
    const want = name === "clay" ? "giemsa" : "fluor";
    if (S.stain === want) return;
    S.stain = want; applyStain(); nodes.stain?.set(want);
  };
  level.onLens = () => { progress = null; panelEl.innerHTML = ""; buildPanel(panelEl); buildChips(); };
  level.onResize = () => {
    const sp = portrait();
    if (sp !== level._portrait) {
      level._portrait = sp;
      makeSpread();
      for (const c of chroms) { if (!c.placed && !S.sorted) { if (!c.paired) { c.cur = { ...c.cur }; sendTo(c, c.spread, 0, 0.8); } } }
      layoutKaryo();
      if (S.sorted || visibleChroms().some((c) => c.placed)) for (const c of visibleChroms()) if (S.sorted || c.placed) sendTo(c, c.karyo, 0, 0.8);
      if (engine.current === level && !engine.busy) resetView();
    }
  };
  level.dispose = () => {
    hideLabels(); [...slotLbls, ...groupLbls, ...geneLbls, extraLbl].forEach((l) => l.remove());
    clearMarkers(); markerGeo.dispose();
    for (const c of chroms) c.mat.dispose();
    atlas.fluor.dispose(); atlas.giemsa.dispose(); bump.dispose();
    engine.stageEl.classList.remove("kary-light");
  };
  // inject level-local CSS once
  if (!document.getElementById("karyotype-css")) { const st = document.createElement("style"); st.id = "karyotype-css"; st.textContent = CSS; document.head.appendChild(st); }

  level._portrait = portrait();
  level.debug = { S, chroms, slots, sortAll, scatter, select, applyComplement, setChallenge, startCount, selectGene, groupStats };
  applyComplement();
  for (const c of chroms) if (c.want) { c.appear = 1; Object.assign(c.cur, c.spread); }
  applyStain();
  return level;
}
