// Inheritance lab (Phase 5b): a 3D "family" laboratory. Two parents carry glowing homologous chromosomes; gametes fly
// into a Punnett board where offspring appear as small figures. Modes: monohybrid, ABO, sex-linked, dihybrid,
// polygenic (500 offspring), pedigree. Maths lives in inheritanceModel.js, words in inheritanceContent.js.
// Units: 1 world unit = 1 m (parents are about 1.75 tall). Body colour = phenotype; the ring under a figure = genotype.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import * as K from "../../kit.js";
import { physical, glass, specks, softDot } from "../materials.js";
import * as M from "./inheritanceModel.js";
import * as T from "./inheritanceContent.js";
import { ORIGINAL_GENE, SICKLE_GENE, SICKLE_INDEX, toRNA, CODE, AA, CLASS_COL } from "../../../../sims/protein-synthesis/model.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const backOut = (t) => { t = clamp(t, 0, 1); const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const TAN_HALF = Math.tan(THREE.MathUtils.degToRad(19));
const ALLELE_COL = [["#60a5fa", "#fb923c"], ["#4ade80", "#f472b6"]];
const ABO_COL = { A: "#f87171", B: "#60a5fa", i: "#cbd5e1" };
const HOMOLOGUE = ["#a5d8ff", "#ffc9e3"];
const PS = 1.2, BOARD_Z = 3.0, PAR_Z = -0.3, KID_Z0 = 5.05, KCAP = 150, ROWS = 4;
const SHORT = {
  sickle: { u: "No sickling", t: "Trait", d: "Anaemia (SS)" }, cf: { u: "Unaffected", d: "CF" }, huntington: { u: "Unaffected", d: "HD" }, lactose: { p: "Persistent", n: "Non-persistent" },
  mc1r: { n: "Not red", r: "Red hair" }, abo: { A: "A", B: "B", AB: "AB", O: "O" },
  haemophilia: { Fu: "Girl", Fc: "Carrier girl", Fa: "Affected girl", Mu: "Boy", Ma: "Affected boy" }, dmd: { Fu: "Girl", Fc: "Carrier girl", Fa: "Affected girl", Mu: "Boy", Ma: "Affected boy" },
  peas: { RY: "Round yellow", Ry: "Round green", rY: "Wrinkled yellow", ry: "Wrinkled green" },
};
const CSS = `
.inh-modes{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.inh-modes .btn{padding:7px 4px;font-size:.8rem;text-align:center}
.inh-presets{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}
.inh-presets .btn{padding:5px 9px;font-size:.8rem}
.inh-par{margin:8px 0}
.inh-par>b{display:block;font-size:.8rem;color:var(--ink-faint);font-weight:600;margin-bottom:3px}
.inh-par small{display:block;color:var(--ink-dim);margin-top:3px;font-size:.78rem;min-height:1.1em}
.inh-par .segmented button{font-size:.86rem;padding:6px 3px}
.inh-tbl{width:100%;border-collapse:collapse;font-size:.82rem;margin:4px 0}
.inh-tbl th{font-weight:600;color:var(--ink-faint);text-align:left;padding:2px 4px;font-size:.74rem}
.inh-tbl td{padding:3px 4px;vertical-align:middle;color:var(--ink-dim)}
.inh-tbl td.n{font-variant-numeric:tabular-nums;text-align:right;color:var(--ink)}
.inh-tbl .bar{display:block;height:5px;border-radius:3px;margin-top:3px;background:rgba(255,255,255,.1);position:relative;overflow:hidden}
.inh-tbl .bar i{position:absolute;left:0;top:0;bottom:0;border-radius:3px;opacity:.85}
.inh-tbl .bar u{position:absolute;top:-1px;bottom:-1px;width:2px;background:#fff;opacity:.85;text-decoration:none}
.inh-sw{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:-1px}
.inh-legend{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:.76rem;color:var(--ink-dim);margin-top:6px}
.inh-note{border-left:3px solid var(--accent);padding:2px 0 2px 9px;margin:8px 0 0;font-size:.82rem;color:var(--ink-dim)}
.inh-gene{font-family:ui-monospace,Menlo,monospace;letter-spacing:.04em;font-size:.82rem}
.inh-codon{display:inline-flex;flex-direction:column;align-items:center;margin:2px 3px;padding:3px 7px;border-radius:8px;background:rgba(255,255,255,.05);font-family:ui-monospace,Menlo,monospace;font-size:.78rem}
.inh-codon.hit{background:rgba(248,113,113,.18);outline:1px solid rgba(248,113,113,.6)}
.inh-codon small{font-size:.7rem}
.lbl3d.inh-tag{background:rgba(5,11,22,.74);border:1px solid rgba(125,190,255,.3);padding:1px 8px;border-radius:999px;color:var(--ink);font-size:.74rem;backdrop-filter:blur(3px)}
.lbl3d.inh-geno{font-size:.88rem;font-weight:700;color:#fff;text-shadow:0 1px 4px #000,0 0 8px #000}
.lbl3d.inh-geno small{display:block;font-weight:400;font-size:.62rem;opacity:.8}
.lbl3d.inh-cap{color:var(--ink-dim);font-size:.72rem;text-shadow:0 1px 5px #000;letter-spacing:.04em}
.lbl3d.inh-allele{font-size:.74rem;font-weight:600;color:#fff;text-shadow:0 1px 4px #000,0 0 6px #000}
.lbl3d.inh-ped{font-size:.84rem;font-weight:700;color:#fff;text-shadow:0 1px 4px #000,0 0 8px #000}
.lbl3d.inh-ped small{display:block;font-weight:500;font-size:.66rem;color:var(--ink-dim)}
.lbl3d.inh-ok{color:#86efac}.lbl3d.inh-bad{color:#fca5a5}
.inh-feedback p{margin:0 0 7px}
@media (max-width:860px){.inh-modes{grid-template-columns:repeat(3,1fr)}}
`;

export function create(engine) {
  const lens = engine.lens;
  const root = new THREE.Group();
  const pickables = [], portals = [];
  const SH = [];
  const share = (r) => { r.userData.shared = true; SH.push(r); return r; };
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _col = new THREE.Color();
  const REDUCED = () => engine.reducedMotion;

  // CSS (level-local)
  if (!document.getElementById("inh-css")) { const st = document.createElement("style"); st.id = "inh-css"; st.textContent = CSS; document.head.appendChild(st); }

  // ------------------------------------------------------------------ state
  const st = {
    mode: "mono", preset: "cf", father: ["Cc"], mother: ["Cc"],
    poly: { trait: "eyes", N: 3, kA: 3, kB: 3, env: 0.5 },
    ped: { pattern: "AR", mystery: false, ambiguous: false },
  };
  const S = {   // mission counters
    maxN: 0, carrierCross: false, sawAffectedSingle: false, unaffectedParentsAffectedChild: false, presets: new Set(), parentChanges: 0,
    carrier100: false, aboHeteroAB: false, xrSonAffected: false, poly500N4: false, pedSolved: 0, di100: false, testCross100: false,
    polyN: new Set(), patternsSolved: new Set(), xrAffectedDaughter: false, singleRun: 0,
  };
  let spec = M.PRESETS.cf, cross = null, tally = null;
  let clock = 0;

  const startPreset = engine.inheritancePreset;
  engine.inheritancePreset = null;
  let notice = "";
  const MODE_BAND = Object.fromEntries(T.MODES.map((m) => [m.id, m.band]));
  function applyPreset(id) {
    let mode = M.modeForPreset(id);
    if (!mode) return;
    if (!lens.atLeast(MODE_BAND[mode])) {
      // this kind of cross is Year 9+: say so and show the closest one-gene trait
      const near = mode === "poly" ? "mc1r" : mode === "abo" ? "lactose" : "cf";
      notice = `That one (${T.pickBand("y9-10", mode === "poly" ? T.POLY_INFO.eyes.name : T.PRESET_INFO[id].name)}) is a Year 9+ topic, so here is the closest one-gene trait: ${T.pickBand("y7-8", T.PRESET_INFO[near].name).toLowerCase()}. Switch to Years 9\u201310 to explore it.`;
      id = near; mode = "mono";
    }
    if (mode === "poly") { st.mode = "poly"; st.poly.trait = "eyes"; return; }
    st.mode = mode;
    st.preset = id; S.presets.add(id);
    const d = M.PRESETS[id].defaults;
    st.father = Array.isArray(d.father) ? [...d.father] : d.father;
    st.mother = Array.isArray(d.mother) ? [...d.mother] : d.mother;
  }
  if (startPreset) applyPreset(startPreset);
  else { st.father = [...M.PRESETS.cf.defaults.father]; st.mother = [...M.PRESETS.cf.defaults.mother]; }

  // ------------------------------------------------------------------ shared materials and geometry
  const matCache = new Map();
  const emi = (color, k = 0.55) => {
    const key = color + "|" + k;
    if (!matCache.has(key)) matCache.set(key, share(new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.35, metalness: 0 })));
    return matCache.get(key);
  };
  const chromMat = (color) => {
    const key = "c" + color;
    if (!matCache.has(key)) matCache.set(key, share(physical(color, { emissive: new THREE.Color(color), emissiveIntensity: 0.1, roughness: 0.35 })));
    return matCache.get(key);
  };
  const geoCache = new Map();
  const cached = (key, make) => { if (!geoCache.has(key)) geoCache.set(key, share(make())); return geoCache.get(key); };

  function figureGeo(female, seg = 20) {
    const parts = [];
    const add = (g, x = 0, y = 0, z = 0, rz = 0) => { if (rz) g.rotateZ(rz); g.translate(x, y, z); parts.push(g); };
    add(new THREE.SphereGeometry(0.115, seg, Math.max(8, seg * 0.7 | 0)), 0, 1.63, 0);
    add(new THREE.CylinderGeometry(0.042, 0.05, 0.12, 12), 0, 1.5, 0);
    const prof = female
      ? [[0.001, 0.86], [0.17, 0.88], [0.215, 1.02], [0.17, 1.2], [0.165, 1.34], [0.185, 1.42], [0.08, 1.48], [0.001, 1.48]]
      : [[0.001, 0.9], [0.15, 0.92], [0.18, 1.1], [0.215, 1.34], [0.245, 1.42], [0.09, 1.48], [0.001, 1.48]];
    const torso = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), seg);
    torso.scale(1, 1, 0.62); parts.push(torso);
    for (const s of [-1, 1]) {
      add(new THREE.CapsuleGeometry(female ? 0.034 : 0.04, 0.5, 4, 10), s * (female ? 0.235 : 0.28), 1.14, 0, s * 0.1);
      add(new THREE.CapsuleGeometry(0.062, 0.66, 4, 10), s * 0.085, 0.45, 0);
    }
    return mergeGeometries(parts);
  }
  function plantGeo() {
    const parts = [];
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.06, 0.5, 0), new THREE.Vector3(-0.05, 1.0, 0), new THREE.Vector3(0.05, 1.5, 0)]);
    parts.push(new THREE.TubeGeometry(curve, 24, 0.03, 8));
    const leaf = (y, a, sc) => { const g = new THREE.SphereGeometry(0.22 * sc, 14, 8); g.scale(1, 0.16, 0.55); g.rotateZ(a); g.translate(Math.sin(a) * -0.2 * sc * Math.sign(a || 1) + (a > 0 ? -0.16 : 0.16) * sc, y, 0); return g; };
    parts.push(leaf(0.35, 0.5, 1.1), leaf(0.6, -0.45, 1.0), leaf(0.9, 0.55, 0.95), leaf(1.15, -0.5, 0.85), leaf(1.4, 0.4, 0.7));
    const pod = new THREE.CapsuleGeometry(0.075, 0.4, 4, 10); pod.rotateZ(1.25); pod.translate(0.27, 1.02, 0); parts.push(pod);
    const pod2 = new THREE.CapsuleGeometry(0.065, 0.3, 4, 10); pod2.rotateZ(-1.2); pod2.translate(-0.22, 0.75, 0); parts.push(pod2);
    return mergeGeometries(parts);
  }
  function chromGeo(len, rad, cen) {
    return cached(`ch${len}|${rad}|${cen}`, () => {
      const pLen = len * cen, qLen = len * (1 - cen), ov = rad * 0.75;
      const a = new THREE.CapsuleGeometry(rad, Math.max(0.001, pLen - 2 * rad), 4, 12); a.translate(0, len / 2 - pLen / 2 - ov * 0.5, 0);
      const b = new THREE.CapsuleGeometry(rad, Math.max(0.001, qLen - 2 * rad), 4, 12); b.translate(0, -len / 2 + qLen / 2 + ov * 0.5, 0);
      const c = new THREE.SphereGeometry(rad * 0.7, 10, 8); c.translate(0, len / 2 - pLen, 0);
      return mergeGeometries([a, b, c]);
    });
  }
  const bandGeo = (rad) => cached("band" + rad, () => { const g = new THREE.TorusGeometry(rad * 1.45, rad * 0.55, 10, 28); g.rotateX(Math.PI / 2); return g; });
  const FIG_M = share(figureGeo(false, 20)), FIG_F = share(figureGeo(true, 20)), FIG_KID = share(figureGeo(false, 12));
  const PLANT = share(plantGeo());

  // ------------------------------------------------------------------ stage: floor, dust, lights
  const gStage = new THREE.Group(); root.add(gStage);
  {
    const disc = new THREE.Mesh(share(new THREE.CircleGeometry(14, 64)), share(new THREE.MeshStandardMaterial({ color: "#0a1b2d", roughness: 1, metalness: 0, envMapIntensity: 0 })));
    disc.rotation.x = -Math.PI / 2; disc.position.y = -0.01; gStage.add(disc);
    const cv = document.createElement("canvas"); cv.width = cv.height = 256;
    const c = cv.getContext("2d"), g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(94,234,212,0.55)"); g.addColorStop(0.45, "rgba(94,160,255,0.16)"); g.addColorStop(1, "rgba(94,160,255,0)");
    c.fillStyle = g; c.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.userData.shared = true; SH.push(tex);
    const pool = new THREE.Mesh(share(new THREE.PlaneGeometry(1, 1)), share(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.005, 2.4); pool.scale.set(12, 9, 1); pool.userData.clayHide = true; gStage.add(pool);
    for (const [r, o] of [[4.9, 0.18], [8.2, 0.1]]) {
      const ring = new THREE.Mesh(share(new THREE.RingGeometry(r, r + 0.03, 96)), share(new THREE.MeshBasicMaterial({ color: "#5eead4", transparent: true, opacity: o, side: THREE.DoubleSide, depthWrite: false })));
      ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.006, 2.4); ring.userData.clayHide = true; gStage.add(ring);
    }
    const dust = specks(110, 0.06, [18, 7, 16], ["#5eead4", "#a78bfa", "#93c5fd", "#f9a8d4"], 0.5);
    dust.position.set(0, 3.2, 2.6); dust.userData.clayHide = true; gStage.add(dust);
    gStage.userData.dust = dust;
    const l1 = new THREE.PointLight("#7dd3fc", 3, 7, 1.8); l1.position.set(-3.6, 1.8, 1.2);
    const l2 = new THREE.PointLight("#f0abfc", 3, 7, 1.8); l2.position.set(3.6, 1.8, 1.2);
    const l3 = new THREE.PointLight("#5eead4", 2.5, 9, 1.8); l3.position.set(0, 2.5, 3.6);
    gStage.add(l1, l2, l3);
  }

  // ------------------------------------------------------------------ labels
  const LBL = { parent: [], board: [], kids: [], poly: [], ped: [] };
  const mkLabel = (set, html, cls, getPos, dx = 0, dy = 0) => {
    const el = engine.label(html, cls);
    const o = { el, getPos, dx, dy, set };
    LBL[set].push(o);
    return o;
  };
  const clearLabels = (set) => { for (const o of LBL[set]) o.el.remove(); LBL[set].length = 0; };
  let activeSets = ["parent", "board", "kids"];
  function updateLabels() {
    for (const set of Object.keys(LBL)) {
      const on = activeSets.includes(set);
      for (const o of LBL[set]) {
        if (!on || !mounted) { o.el.style.display = "none"; continue; }
        o.getPos(_v);
        engine.place(o.el, _v, o.dx, o.dy);
      }
    }
  }
  let mounted = false;

  // ------------------------------------------------------------------ parents
  const gParents = new THREE.Group(); root.add(gParents);
  const PX = () => (engine.camera.aspect < 0.9 ? 2.4 : 3.0);
  const parents = [];
  const bodyMats = [share(glass("#7dd3fc", { rim: "#9be7ff", rimStrength: 0.9, rimPower: 2.0, minAlpha: 0.1, maxAlpha: 0.75 })), share(glass("#c4b5fd", { rim: "#e9d5ff", rimStrength: 0.9, rimPower: 2.0, minAlpha: 0.1, maxAlpha: 0.75 }))];
  const plantMat = share(glass("#86efac", { rim: "#bbf7d0", rimStrength: 0.8, rimPower: 2.0, minAlpha: 0.14, maxAlpha: 0.8 }));
  const bubbleMat = share(glass("#bfe9ff", { rim: "#9be7ff", rimStrength: 0.7, rimPower: 2.4, minAlpha: 0.025, maxAlpha: 0.5 }));
  const bubbleGeo = share(new THREE.SphereGeometry(0.58, 36, 24));
  const padGeo = share(new THREE.CircleGeometry(0.85, 48));
  for (let w = 0; w < 2; w++) {
    const g = new THREE.Group();
    const human = new THREE.Mesh(w === 0 ? FIG_M : FIG_F, bodyMats[w]); human.userData = { kind: "parent", who: w };
    const plant = new THREE.Mesh(PLANT, plantMat); plant.userData = { kind: "parent", who: w }; plant.visible = false;
    const bubble = new THREE.Mesh(bubbleGeo, bubbleMat); bubble.position.set(0, 1.28, 0.72); bubble.userData = { kind: "parent", who: w, clayHide: true };
    const holder = new THREE.Group(); holder.position.copy(bubble.position);
    const pad = new THREE.Mesh(padGeo, share(new THREE.MeshBasicMaterial({ color: w ? "#c4b5fd" : "#7dd3fc", transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending })));
    pad.rotation.x = -Math.PI / 2; pad.position.y = 0.012; pad.userData.clayHide = true;
    // a soft tether from the body to the bubble
    g.add(pad, human, plant, bubble, holder);
    gParents.add(g);
    parents.push({ g, human, plant, bubble, holder, chroms: [], bands: [] });
    pickables.push(human, plant, bubble);
  }
  function layoutParents() {
    const x = PX();
    parents[0].g.scale.setScalar(PS); parents[1].g.scale.setScalar(PS);
    parents[0].g.position.set(-x, 0, PAR_Z);
    parents[1].g.position.set(x, 0, PAR_Z);
    parents[0].g.rotation.y = 0.28; parents[1].g.rotation.y = -0.28;
    // bubbles sit in front of the chest, nudged toward the middle so the chromosomes face the camera
  }

  /** position (fraction from the top, p arm on top) of a gene's locus on its chromosome, from its arm and how far along the arm it lies */
  const locusPos = (l) => (l.arm === "p" ? l.cen * (1 - l.f) : l.cen + (1 - l.cen) * l.f);
  function alleleColor(sp, geneIdx, a) {
    if (sp.id === "abo") return ABO_COL[a];
    const g = sp.genes ? sp.genes[geneIdx] : sp;
    const k = g.alleles.indexOf(a);
    return ALLELE_COL[Math.min(geneIdx, 1)][Math.min(k, 1)];
  }
  /** build one chromosome mesh group: body + coloured bands. bands: [{pos 0..1 from top, color, k}] */
  function chromosome(len, rad, cen, color, bands) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(chromGeo(len, rad, cen), chromMat(color));
    g.add(body);
    const ms = [];
    for (const b of bands) {
      const m = new THREE.Mesh(bandGeo(rad), emi(b.color, b.k ?? 0.6));
      m.position.y = len / 2 - b.pos * len;
      g.add(m); ms.push({ mesh: m, ...b });
    }
    return { group: g, bands: ms, body };
  }
  function clearHolder(p) {
    while (p.holder.children.length) p.holder.remove(p.holder.children[0]);
    p.chroms = []; p.bands = [];
  }
  /** (re)build the chromosomes in a parent's bubble for the current mode and genotypes */
  function buildChromosomes() {
    clearLabels("parent");
    for (let w = 0; w < 2; w++) {
      const p = parents[w];
      clearHolder(p);
      const geno = w === 0 ? st.father : st.mother;
      const add = (c, x, y = 0, rotY = 0) => { c.group.position.set(x, y, 0); p.holder.add(c.group); p.chroms.push(c); return c; };
      const armLabels = (c, len) => {
        mkLabel("parent", "p", "inh-cap", (out) => { out.set(0, len / 2 + 0.07, 0); c.group.localToWorld(out); });
        mkLabel("parent", "q", "inh-cap", (out) => { out.set(0, -len / 2 - 0.07, 0); c.group.localToWorld(out); });
      };
      const labelBand = (c, text, side) => {
        const b = c.bands[0]; if (!b) return;
        mkLabel("parent", text, "inh-allele", (out) => b.mesh.getWorldPosition(out), side * 30, 0);
      };
      if (st.mode === "poly") {
        const N = st.poly.N, k = w === 0 ? st.poly.kA : st.poly.kB;
        const loci = M.polyLoci(N, k);
        const mk = (h) => {
          const bands = loci.map((c, i) => ({ pos: 0.1 + (0.8 * (i + 0.5)) / N, color: (h === 0 ? c >= 1 : c >= 2) ? "#4ade80" : "#475569", k: (h === 0 ? c >= 1 : c >= 2) ? 1.2 : 0.15 }));
          return chromosome(0.78, 0.055, 0.4, HOMOLOGUE[h], bands);
        };
        add(mk(0), -0.12); add(mk(1), 0.12);
      } else if (st.mode === "xlinked") {
        const sp = spec, [d, r] = sp.alleles;
        const LC = sp.locus, xBands = (a) => [{ pos: locusPos(LC), color: a === d ? ALLELE_COL[0][0] : ALLELE_COL[0][1] }];
        if (w === 0) {
          const x = chromosome(0.7, 0.055, LC.cen, HOMOLOGUE[0], xBands(geno));
          const y = chromosome(0.34, 0.05, 0.3, "#9ca3af", []);
          add(x, -0.12); add(y, 0.12, -0.18);
          labelBand(x, sp.fmt[geno], -1); armLabels(x, 0.7);
          mkLabel("parent", "Y", "inh-allele", (out) => { y.body.getWorldPosition(out); }, 24, 0);
          mkLabel("parent", "X", "inh-cap", (out) => { x.body.getWorldPosition(out); out.y += 0.42; });
        } else {
          const a = geno[0], b = geno[1];
          const x1 = chromosome(0.7, 0.055, LC.cen, HOMOLOGUE[0], xBands(a)), x2 = chromosome(0.7, 0.055, LC.cen, HOMOLOGUE[1], xBands(b));
          add(x1, -0.12); add(x2, 0.12);
          labelBand(x1, sp.fmt[a], -1); labelBand(x2, sp.fmt[b], 1); armLabels(x1, 0.7);
          mkLabel("parent", "X", "inh-cap", (out) => { x1.body.getWorldPosition(out); out.y += 0.42; }, 0, 0);
          mkLabel("parent", "X", "inh-cap", (out) => { x2.body.getWorldPosition(out); out.y += 0.42; }, 0, 0);
        }
      } else if (st.mode === "dihybrid") {
        const sp = spec;
        for (let gi = 0; gi < 2; gi++) {
          const gt = geno[gi];
          const L = gi === 0 ? 0.66 : 0.5, x0 = gi === 0 ? -0.28 : 0.1;
          const c1 = chromosome(L, 0.045, 0.4, HOMOLOGUE[0], [{ pos: gi === 0 ? 0.62 : 0.55, color: alleleColor(sp, gi, gt[0]) }]);
          const c2 = chromosome(L, 0.045, 0.4, HOMOLOGUE[1], [{ pos: gi === 0 ? 0.62 : 0.55, color: alleleColor(sp, gi, gt[1]) }]);
          add(c1, x0, 0); add(c2, x0 + 0.17, 0);
          labelBand(c1, sp.genes[gi].fmt[gt[0]], -1); labelBand(c2, sp.genes[gi].fmt[gt[1]], 1);
        }
      } else {
        const sp = spec, gt = geno[0];
        const LC = sp.locus, lp = locusPos(LC);
        const c1 = chromosome(0.74, 0.058, LC.cen, HOMOLOGUE[0], [{ pos: lp, color: alleleColor(sp, 0, gt[0]) }]);
        const c2 = chromosome(0.74, 0.058, LC.cen, HOMOLOGUE[1], [{ pos: lp, color: alleleColor(sp, 0, gt[1]) }]);
        add(c1, -0.13); add(c2, 0.13);
        labelBand(c1, sp.fmt[gt[0]], -1); labelBand(c2, sp.fmt[gt[1]], 1); armLabels(c1, 0.74);
      }
      // parent name tag
      const who = w === 0 ? "Father" : "Mother";
      mkLabel("parent", who, "inh-tag", (out) => { out.set(parents[w].g.position.x, 1.95 * PS + 0.12, parents[w].g.position.z); });
    }
    const plants = st.mode === "dihybrid";
    for (const p of parents) { p.human.visible = !plants; p.plant.visible = plants; }
  }

  // ------------------------------------------------------------------ gametes (flying egg and sperm)
  const gGametes = new THREE.Group(); root.add(gGametes);
  const eggShell = share(new THREE.SphereGeometry(0.17, 24, 16)), spHead = share(new THREE.SphereGeometry(0.1, 20, 14)), spTail = share(new THREE.ConeGeometry(0.05, 0.42, 10));
  spTail.rotateX(-Math.PI / 2); spTail.translate(0, 0, -0.26);
  const eggMat = share(glass("#fde68a", { rim: "#fff7cc", rimStrength: 1.0, minAlpha: 0.12, maxAlpha: 0.75 })), spMat = share(glass("#7dd3fc", { rim: "#d6f3ff", rimStrength: 1.0, minAlpha: 0.2, maxAlpha: 0.85 }));
  const gamPool = [];
  function makeGamete(isEgg) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(isEgg ? eggShell : spHead, isEgg ? eggMat : spMat));
    if (!isEgg) g.add(new THREE.Mesh(spTail, spMat));
    const holder = new THREE.Group(); g.add(holder);
    g.visible = false; gGametes.add(g);
    return { g, holder, isEgg, busy: false };
  }
  for (let i = 0; i < 8; i++) gamPool.push(makeGamete(false), makeGamete(true));
  function configGamete(gm, gamete) {
    while (gm.holder.children.length) gm.holder.remove(gm.holder.children[0]);
    const scale = gm.isEgg ? 0.8 : 0.5;
    if (gamete.y) { const c = chromosome(0.2, 0.025, 0.3, "#9ca3af", []); c.group.scale.setScalar(scale * 1.1); c.group.rotation.z = 1.2; gm.holder.add(c.group); return; }
    const als = gamete.alleles;
    const n = spec.kind === "x" ? 1 : als.length;
    for (let gi = 0; gi < n; gi++) {
      const a = als[gi];
      const col = spec.kind === "x" ? (a === spec.alleles[0] ? ALLELE_COL[0][0] : ALLELE_COL[0][1]) : alleleColor(spec, gi, a);
      const c = chromosome(0.22, 0.03, 0.4, gi ? HOMOLOGUE[1] : HOMOLOGUE[0], [{ pos: 0.6, color: col, k: 0.9 }]);
      c.group.scale.setScalar(scale * (n > 1 ? 0.85 : 1.1));
      c.group.position.x = n > 1 ? (gi - 0.5) * 0.11 : 0; c.group.rotation.z = gm.isEgg ? 0.5 : 1.3;
      gm.holder.add(c.group);
    }
  }
  const flights = [];
  const flash = [];      // merge sparkles
  const sparkMat = share(new THREE.SpriteMaterial({ map: softDot(), color: "#ffffff", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  function pathAt(P0, P1, P2, t, out, lift) {
    // two quadratic-ish segments through the header point (P1) to the cell (P2)
    if (t < 0.5) { const u = easeOut(t * 2); out.lerpVectors(P0, P1, u); out.y += Math.sin(u * Math.PI) * lift; }
    else { const u = (t - 0.5) * 2; const e = u * u * (3 - 2 * u); out.lerpVectors(P1, P2, e); out.y += Math.sin(e * Math.PI) * lift * 0.4; }
    return out;
  }
  function startFlight(i, j, onDone) {
    const sp = gamPool.find((g) => !g.isEgg && !g.busy), eg = gamPool.find((g) => g.isEgg && !g.busy);
    if (!sp || !eg || !board) return false;
    const col = cross.cols[j], row = cross.rows[i];
    configGamete(sp, col); configGamete(eg, row);
    sp.busy = eg.busy = true; sp.g.visible = eg.g.visible = true;
    const f = { sp, eg, i, j, t: 0, dur: 1.5, onDone,
      s0: parents[0].bubble.getWorldPosition(new THREE.Vector3()), e0: parents[1].bubble.getWorldPosition(new THREE.Vector3()),
      s1: board.colHeader(j, new THREE.Vector3()), e1: board.rowHeader(i, new THREE.Vector3()), c: board.cell(i, j, new THREE.Vector3()) };
    f.s1.y = f.e1.y = 0.7; f.c.y = 0.35;
    flights.push(f);
    return true;
  }
  function updateFlights(dt) {
    for (let k = flights.length - 1; k >= 0; k--) {
      const f = flights[k];
      f.t = Math.min(1, f.t + dt / f.dur);
      pathAt(f.s0, f.s1, f.c, f.t, f.sp.g.position, 1.3);
      pathAt(f.e0, f.e1, f.c, f.t, f.eg.g.position, 1.0);
      _p.copy(f.sp.g.position); pathAt(f.s0, f.s1, f.c, Math.min(1, f.t + 0.02), _v, 1.3);
      if (_v.distanceToSquared(_p) > 1e-8) f.sp.g.lookAt(_v.x * 2 - _p.x, _v.y * 2 - _p.y, _v.z * 2 - _p.z);
      f.sp.g.rotateY(Math.PI);
      f.sp.holder.rotation.y += dt * 4; f.eg.holder.rotation.y -= dt * 3;
      if (f.t >= 1) {
        f.sp.g.visible = f.eg.g.visible = false; f.sp.busy = f.eg.busy = false;
        spark(f.c);
        flights.splice(k, 1);
        f.onDone && f.onDone();
      }
    }
  }
  const sparkPool = [];
  function spark(pos) {
    let s = sparkPool.find((x) => !x.alive);
    if (!s) { s = { alive: false, sprite: new THREE.Sprite(sparkMat.clone()) }; s.sprite.material.userData.shared = false; gGametes.add(s.sprite); sparkPool.push(s); }
    s.alive = true; s.t = 0; s.sprite.position.copy(pos); s.sprite.visible = true; s.sprite.userData.clayHide = true;
  }
  function updateSparks(dt) {
    for (const s of sparkPool) {
      if (!s.alive) continue;
      s.t += dt / 0.6;
      const k = easeOut(s.t);
      s.sprite.scale.setScalar(0.3 + k * 1.4); s.sprite.material.opacity = Math.max(0, 1 - s.t);
      if (s.t >= 1) { s.alive = false; s.sprite.visible = false; }
    }
  }

  // ------------------------------------------------------------------ crowds (instanced offspring)
  const ringGeo = share(new THREE.CylinderGeometry(1, 1, 0.035, 28));
  const seedGeoR = share(new THREE.IcosahedronGeometry(0.1, 2));
  const seedGeoW = (() => {
    const g = new THREE.IcosahedronGeometry(0.1, 2); const P = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i);
      const k = 1 + 0.16 * Math.sin(v.x * 70 + v.y * 40) * Math.sin(v.z * 60 + v.x * 30) + 0.1 * Math.sin(v.y * 90 + v.z * 20);
      v.multiplyScalar(k); v.x *= 0.92; v.y *= 0.82; P.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals(); return share(g);
  })();
  const figMat = share(physical("#ffffff", { roughness: 0.38, clearcoat: 0.6 }));
  const seedMat = share(physical("#ffffff", { roughness: 0.45, clearcoat: 0.35 }));
  const ringMat = share(new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.9 }));
  class Crowd {
    constructor(cap, parent, pickKind) {
      this.cap = cap;
      const mk = (geo, mat, kind) => {
        const m = new THREE.InstancedMesh(geo, mat, cap);
        m.frustumCulled = false; m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 4), 30);
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0;
        m.setColorAt(0, _col.set("#ffffff"));
        parent.add(m);
        if (kind) m.userData.kind = kind;
        return m;
      };
      this.fig = mk(FIG_KID, figMat, pickKind); this.ring = mk(ringGeo, ringMat, null);
      this.seedR = mk(seedGeoR, seedMat, pickKind); this.seedW = mk(seedGeoW, seedMat, pickKind);
      this.meshes = [this.fig, this.ring, this.seedR, this.seedW];
      this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
    }
    setCount(n) { for (const m of this.meshes) m.count = n; }
    /** o: { x, y, z, s, color, ring (hex), seed: 0 none | 1 round | 2 wrinkled } */
    set(slot, o) {
      _q.identity();
      const seed = o.seed || 0;
      _s.setScalar(o.s); _p.set(o.x, o.y, o.z);
      this.fig.setMatrixAt(slot, seed ? this.zero : _m4.compose(_p, _q, _s));
      this.fig.setColorAt(slot, _col.set(o.color));
      _s.set(o.s * 0.46, 1, o.s * 0.46); _p.set(o.x, 0.018, o.z);
      this.ring.setMatrixAt(slot, o.s > 0.001 ? _m4.compose(_p, _q, _s) : this.zero);
      this.ring.setColorAt(slot, _col.set(o.ring));
      _s.setScalar(o.s * 2.2 / 1.0); _p.set(o.x, 0.1 * o.s * 2.2 + 0.03, o.z);
      this.seedR.setMatrixAt(slot, seed === 1 ? _m4.compose(_p, _q, _s) : this.zero);
      this.seedW.setMatrixAt(slot, seed === 2 ? _m4.compose(_p, _q, _s) : this.zero);
      this.seedR.setColorAt(slot, _col.set(o.color)); this.seedW.setColorAt(slot, _col.set(o.color));
    }
    flush() { for (const m of this.meshes) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; } }
  }
  const gBoard = new THREE.Group(); root.add(gBoard);
  const gKids = new THREE.Group(); root.add(gKids);
  const cellCrowd = new Crowd(16, gBoard, "cellkid");
  const kidCrowd = new Crowd(KCAP, gKids, "kid");

  // ------------------------------------------------------------------ the Punnett board
  let board = null;
  const tileGeos = {};
  const tileMats = {};
  const tileMat = (c) => tileMats[c] ||= share(glass(c, { rim: c, rimStrength: 0.7, rimPower: 1.6, minAlpha: 0.2, maxAlpha: 0.6 }));
  const slabMat = share(glass("#7aa7d9", { rim: "#9bd0ff", rimStrength: 0.6, minAlpha: 0.1, maxAlpha: 0.4 }));
  const glowGeo = share(new THREE.PlaneGeometry(1, 1)); glowGeo.rotateX(-Math.PI / 2);
  let boardAnim = 0;
  const popped = [];   // per-cell figure pop times

  function genoRing(cell) {
    if (spec.id === "abo") return { AA: "#f87171", Ai: "#fb923c", BB: "#60a5fa", Bi: "#38bdf8", AB: "#c084fc", ii: "#cbd5e1" }[cell.parts[0]];
    if (spec.kind === "x") {
      const g = cell.parts[0], [d] = spec.alleles;
      if (cell.sex === "M") return g === d ? "#60a5fa" : "#c084fc";
      return g[0] === g[1] ? (g[0] === d ? "#60a5fa" : "#c084fc") : "#fbbf24";
    }
    if (spec.mode === "dihybrid") {
      const keys = [...cross.geno.keys()], idx = keys.indexOf(cell.key);
      return "#" + _col.setHSL((idx / Math.max(1, keys.length)) * 0.9, 0.55, 0.62).getHexString();
    }
    const g = cell.parts[0];
    return g[0] !== g[1] ? "#fbbf24" : g[0] === spec.alleles[0] ? "#60a5fa" : "#c084fc";
  }
  function ringLegend() {
    if (!cross) return [];
    if (spec.id === "abo") return [["#f87171", "IᴬIᴬ"], ["#fb923c", "Iᴬi"], ["#60a5fa", "IᴮIᴮ"], ["#38bdf8", "Iᴮi"], ["#c084fc", "IᴬIᴮ"], ["#cbd5e1", "ii"]];
    if (spec.mode === "dihybrid") return [];
    if (spec.kind === "x") return [["#60a5fa", "dominant allele only (a boy has just one X)"], ["#fbbf24", "girl with one of each (carrier)"], ["#c084fc", "recessive allele only (girl: both X)"]];
    return [["#60a5fa", "two dominant alleles"], ["#fbbf24", "one of each"], ["#c084fc", "two recessive alleles"]];
  }
  function seedKind(cell) { return spec.mode === "dihybrid" ? (cell.cls[0] === "R" ? 1 : 2) : 0; }
  function classColor(id) { return spec.classes.find((c) => c.id === id).color; }
  const kidScaleFor = () => (board ? board.cs * 0.4 : 0.5);

  function buildBoard() {
    clearLabels("board");
    for (const o of [...gBoard.children]) if (o.userData.boardPart) { gBoard.remove(o); if (o.material?.userData?.own) o.material.dispose(); }
    for (let i = pickables.length - 1; i >= 0; i--) if (pickables[i].userData.kind === "tile") pickables.splice(i, 1);
    board = null; popped.length = 0;
    if (!cross) { cellCrowd.setCount(0); cellCrowd.flush(); return; }
    const nr = cross.rows.length, nc = cross.cols.length;
    const cs = nc > 2 ? 0.95 : 1.4;
    const W = nc * cs, D = nr * cs;
    const x0 = -W / 2, z0 = BOARD_Z - D / 2;
    const b = {
      nr, nc, cs, W, D, tiles: [], glows: [],
      cell: (i, j, out) => out.set(x0 + (j + 0.5) * cs, 0.06, z0 + (i + 0.5) * cs),
      colHeader: (j, out) => out.set(x0 + (j + 0.5) * cs, 0.1, z0 - 0.42),
      rowHeader: (i, out) => out.set(x0 - 0.48, 0.1, z0 + (i + 0.5) * cs),
    };
    const slab = new THREE.Mesh(cached(`slab${W}|${D}`, () => new THREE.BoxGeometry(W + 0.7, 0.07, D + 0.7)), slabMat);
    slab.position.set(0, -0.0, BOARD_Z); slab.userData.boardPart = true; gBoard.add(slab);
    const tg = cached(`tile${cs}`, () => new THREE.BoxGeometry(cs * 0.94, 0.07, cs * 0.94));
    for (let i = 0; i < nr; i++) { b.tiles[i] = []; b.glows[i] = []; for (let j = 0; j < nc; j++) {
      const cell = cross.cells[i][j];
      const t = new THREE.Mesh(tg, tileMat(classColor(cell.cls)));
      b.cell(i, j, t.position); t.position.y = 0.05;
      t.userData = { kind: "tile", i, j, boardPart: true }; gBoard.add(t); pickables.push(t); b.tiles[i][j] = t;
      const gl = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      gl.material.userData.own = true; gl.scale.set(cs * 0.98, 1, cs * 0.98); gl.position.set(t.position.x, 0.095, t.position.z); gl.userData = { boardPart: true, clayHide: true };
      gBoard.add(gl); b.glows[i][j] = gl;
    } }
    board = b;
    // header and cell labels
    for (let j = 0; j < nc; j++) mkLabel("board", cross.cols[j].label, "inh-tag", (out) => b.colHeader(j, out));
    for (let i = 0; i < nr; i++) mkLabel("board", cross.rows[i].label, "inh-tag", (out) => b.rowHeader(i, out));
    mkLabel("board", "Father's sperm", "inh-cap", (out) => out.set(0, 0.1, z0 - 0.95));
    mkLabel("board", "Mother's eggs", "inh-cap", (out) => out.set(x0 - 1.15, 0.1, BOARD_Z), 0, 0);
    for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
      const cell = cross.cells[i][j];
      mkLabel("board", cell.label, "inh-geno", (out) => { b.cell(i, j, out); out.y = 0.12; out.z += cs * 0.34; });
    }
    // little figures in each cell, popping in one after another
    cellCrowd.setCount(nr * nc);
    for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) popped[i * nc + j] = REDUCED() ? 1 : -(i * nc + j) * 0.09 - 0.25;
    writeCellKids();
  }
  function writeCellKids() {
    if (!board) return;
    const { nr, nc } = board;
    const s0 = kidScaleFor();
    for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
      const cell = cross.cells[i][j], slot = i * nc + j, p = popped[slot];
      const k = p <= 0 ? 0 : backOut(p / 0.5);
      board.cell(i, j, _v);
      cellCrowd.set(slot, { x: _v.x, y: 0.085, z: _v.z - board.cs * 0.08, s: s0 * clamp(k, 0, 1.15), color: classColor(cell.cls), ring: genoRing(cell), seed: seedKind(cell) });
    }
    cellCrowd.flush();
  }
  function flashCell(i, j, color) { if (board) board.glows[i][j].userData.flash = 1; if (board) board.glows[i][j].material.color.set(color); }

  // ------------------------------------------------------------------ offspring (sampling) and the family row
  const kids = [];
  const queue = [];
  let kidLabelDirty = true, kidsDirty = true;
  const sampleStats = { dirty: true };
  function newTally() { return { n: 0, cls: {}, geno: {}, last: null, run: 0, singles: 0, singleRunAffected: false }; }
  function clearKids() {
    kids.length = 0; queue.length = 0;
    for (const f of flights) { f.sp.g.visible = f.eg.g.visible = false; f.sp.busy = f.eg.busy = false; }
    flights.length = 0;
    kidCrowd.setCount(0); kidCrowd.flush(); clearLabels("kids"); kidsDirty = true; dirtyPanel = true;
  }
  function targetClass() { return spec.affectedClass ?? spec.classes[spec.classes.length - 1].id; }
  function birth(i, j) {
    const cell = cross.cells[i][j];
    tally.n++; tally.cls[cell.cls] = (tally.cls[cell.cls] || 0) + 1; tally.geno[cell.key] = (tally.geno[cell.key] || 0) + 1;
    tally.run = tally.last && tally.last.id === cell.cls ? tally.run + 1 : 1;
    tally.last = { id: cell.cls, n: cross.cls.get(cell.cls).n };
    S.maxN = Math.max(S.maxN, tally.n);
    if (spec.mode === "mono" && cell.cls === targetClass()) tally.hitTarget = true;
    if (st.mode === "xlinked" && cell.cls === "Ma" && st.father === spec.alleles[0] && st.mother === spec.alleles[0] + spec.alleles[1]) S.xrSonAffected = true;
    if (st.mode === "xlinked" && cell.cls === "Fa" && st.father === spec.alleles[1] && st.mother === spec.alleles[0] + spec.alleles[1]) S.xrAffectedDaughter = true;
    if (tally.n >= 100) {
      if (spec.mode === "mono" && spec.recessive && st.father[0][0] !== st.father[0][1] && st.mother[0][0] !== st.mother[0][1]) S.carrier100 = true;
      if (st.mode === "dihybrid") {
        const f = st.father.join(""), m = st.mother.join("");
        if (f === "RrYy" && m === "RrYy") S.di100 = true;
        if ((f === "RrYy" && m === "rryy") || (f === "rryy" && m === "RrYy")) S.testCross100 = true;
      }
    }
    if (kids.length < KCAP) {
      board.cell(i, j, _v);
      kids.push({ cls: cell.cls, key: cell.key, sex: cell.sex, label: cell.label, i, j, born: clock, x: _v.x, y: 0.1, z: _v.z, tx: _v.x, tz: KID_Z0, s: 0, parts: cell.parts, seed: seedKind(cell), ring: genoRing(cell), color: classColor(cell.cls) });
      kidsDirty = true;
    }
    flashCell(i, j, classColor(cell.cls));
    dirtyPanel = true;
  }
  function haveChildren(n) {
    if (!cross || !board) return;
    const single = n === 1;
    const single_prev = tally.singleStreak;
    tally.singleStreak = single ? (tally.singleStreak || 0) + 1 : 0;
    if (single) { S.singleRun = Math.max(S.singleRun, tally.singleStreak); }
    const fl = REDUCED() ? 0 : n <= 10 ? n : 6;
    let at = clock + 0.05;
    for (let k = 0; k < n; k++) {
      const s = M.sampleChild(cross);
      if (k < fl) { queue.push({ at, i: s.i, j: s.j, flight: true, single }); at += n === 1 ? 0 : 0.5; }
      else queue.push({ at: clock + 0.25 + (k - fl) * (REDUCED() ? 0 : 0.025), i: s.i, j: s.j, flight: false, single });
    }
  }
  function processQueue() {
    for (let k = 0; k < queue.length; ) {
      const q = queue[k];
      if (q.at > clock) { k++; continue; }
      if (q.flight && startFlight(q.i, q.j, () => { birth(q.i, q.j); if (q.single && spec.mode === "mono" && cross.cells[q.i][q.j].cls === targetClass()) S.sawAffectedSingle = true; })) { queue.splice(k, 1); continue; }
      if (q.flight && flights.length) { q.at = clock + 0.3; k++; continue; }
      birth(q.i, q.j);
      if (q.single && spec.mode === "mono" && cross.cells[q.i][q.j].cls === targetClass()) S.sawAffectedSingle = true;
      queue.splice(k, 1);
    }
  }
  function layoutKids() {
    kidsDirty = false;
    clearLabels("kids");
    const present = spec.classes.filter((c) => kids.some((k) => k.cls === c.id));
    const total = kids.length;
    const sp = total > 70 ? 0.22 : total > 30 ? 0.3 : 0.42;
    const gap = total > 30 ? 0.3 : 0.45;
    const blocks = present.map((c) => ({ c, list: kids.filter((k) => k.cls === c.id) }));
    const RW = engine.camera.aspect < 0.9 ? 6 : ROWS;
    for (const b of blocks) b.cols = Math.ceil(b.list.length / RW);
    const width = blocks.reduce((s, b) => s + b.cols * sp, 0) + gap * Math.max(0, blocks.length - 1);
    let x = -width / 2;
    kidSp = sp;
    for (const b of blocks) {
      b.list.forEach((k, idx) => { k.tx = x + (Math.floor(idx / RW) + 0.5) * sp; k.tz = KID_Z0 + (idx % RW) * sp; });
      const cx = x + (b.cols * sp) / 2, id = b.c.id;
      mkLabel("kids", "", "inh-tag", (out) => out.set(cx, 0.1, KID_Z0 - 0.4), 0, (blocks.indexOf(b) % 2) * -24).el.dataset.cls = id;
      x += b.cols * sp + gap;
    }
    kidCrowd.setCount(kids.length); kidCrowd._dirty = true;
    updateKidLabels();
  }
  let kidSp = 0.4;
  function updateKidLabels() {
    for (const o of LBL.kids) {
      const id = o.el.dataset.cls, c = spec.classes.find((c) => c.id === id);
      const cnt = tally.cls[id] || 0, pct = tally.n ? Math.round((cnt / tally.n) * 100) : 0;
      const html = `<i class="inh-sw" style="background:${c.color}"></i>${shortLabel(c)} · ${cnt} (${pct}%)`;
      if (o.el.innerHTML !== html) o.el.innerHTML = html;
    }
  }
  const shortLabel = (c) => SHORT[spec.id]?.[c.id] ?? T.pickBand(lens.band, c.label);
  function animateKids(dt) {
    if (!kids.length) return;
    if (kidsDirty) layoutKids();
    let changed = false;
    const s0 = kidSp * 0.72, rate = 1 - Math.exp(-7 * Math.max(dt, 0.001));
    for (let n = 0; n < kids.length; n++) {
      const k = kids[n], dx = k.tx - k.x, dz = k.tz - k.z;
      if (dt > 0 && (Math.abs(dx) > 0.002 || Math.abs(dz) > 0.002)) { k.x += REDUCED() ? dx : dx * rate; k.z += REDUCED() ? dz : dz * rate; changed = true; }
      const ns = s0 * (REDUCED() ? 1 : backOut((clock - k.born) / 0.5));
      if (Math.abs(ns - k.s) > 1e-4) { k.s = ns; changed = true; }
    }
    if (!changed && !kidCrowd._dirty) return;
    kidCrowd._dirty = false;
    for (let n = 0; n < kids.length; n++) { const k = kids[n]; kidCrowd.set(n, { x: k.x, y: 0.03, z: k.z, s: k.s, color: k.color, ring: k.ring, seed: k.seed }); }
    kidCrowd.flush();
  }

  // ------------------------------------------------------------------ polygenic histogram
  const gHist = new THREE.Group(); gHist.visible = false; root.add(gHist);
  const NB = 30, HZ = 3.3, HW = 9.6, HMAX = 3.0;
  const barGeo = share(new THREE.BoxGeometry(1, 1, 1)); barGeo.translate(0, 0.5, 0);
  const bars = new THREE.InstancedMesh(barGeo, share(physical("#ffffff", { roughness: 0.5, clearcoat: 0.3 })), NB);
  bars.frustumCulled = false; bars.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, HZ), 8); bars.userData.kind = "bar";
  bars.instanceMatrix.setUsage(THREE.DynamicDrawUsage); bars.setColorAt(0, _col.set("#fff")); gHist.add(bars);
  {
    const slab = new THREE.Mesh(share(new THREE.BoxGeometry(HW + 0.8, 0.07, 1.4)), slabMat); slab.position.set(0, -0.01, HZ); gHist.add(slab);
  }
  let hist = null, curve = null;
  const traitOf = () => (st.poly.trait === "eyes" ? T.POLY_INFO.eyes : T.POLY_INFO.height);
  const traitVal = (v) => (st.poly.trait === "eyes" ? v.toFixed(1) : `${(168 + 2 * (v - st.poly.N)).toFixed(0)} cm`);
  const binX = (b) => -HW / 2 + ((b + 0.5) * HW) / (hist ? hist.nb : NB);
  function polyColor(v) {
    if (st.poly.trait === "eyes") return M.eyeColour(v / (2 * st.poly.N));
    return "#" + _col.setHSL(0.5 + 0.2 * clamp(v / (2 * st.poly.N), 0, 1), 0.6, 0.58).getHexString();
  }
  function polyTicks() {
    clearLabels("poly");
    if (!hist) return;
    for (let k = 0; k < 5; k++) {
      const v = hist.lo + ((hist.hi - hist.lo) * (k + 0.5)) / 5, x = -HW / 2 + ((k + 0.5) * HW) / 5;
      mkLabel("poly", traitVal(v), "inh-cap", (out) => out.set(x, 0.0, HZ + 1.05));
    }
    mkLabel("poly", st.poly.trait === "eyes" ? "Iris pigment score (+ alleles + environment)" : "Height (cm)", "inh-tag", (out) => out.set(0, 0, HZ + 1.55));
    mkLabel("poly", "Number of offspring \u2191", "inh-cap", (out) => out.set(-HW / 2 + 1.2, 3.3, HZ));
  }
  function buildCurve() {
    if (curve) { gHist.remove(curve); curve.geometry.dispose(); curve = null; }
    if (!hist || hist.st.sd < 1e-9) return;   // no variation at all: there is no curve to draw
    const pts = [];
    for (let k = 0; k <= 80; k++) {
      const v = hist.lo + ((hist.hi - hist.lo) * k) / 80;
      pts.push(new THREE.Vector3(-HW / 2 + (HW * k) / 80, 0.05 + hist.vals.length * hist.w * M.normalPdf(v, hist.st.mean, Math.max(0.35, hist.st.sd)) * hist.unit, HZ + 0.4));
    }
    curve = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 100, 0.028, 6), emi("#fde68a", 1.0));
    curve.userData.clayHide = true; gHist.add(curve);
  }
  function breed(n = 500) {
    const { N, kA, kB, env } = st.poly;
    const stt = M.polyStats(N, kA, kB, env), sd = Math.max(0.35, stt.sd);
    let lo = stt.mean - 4 * sd, hi = stt.mean + 4 * sd, nb = NB;
    if (env < 0.4) {          // (nearly) no environment: the scores are whole numbers, so use one bar per score
      lo = Math.round(stt.mean - 4 * sd) - 0.5; nb = Math.min(NB, Math.ceil(stt.mean + 4 * sd - lo) + 1); hi = lo + nb;
    }
    const vals = []; for (let i = 0; i < n; i++) { const c = M.polyChild(N, kA, kB, env); vals.push(c.g + c.e); }
    const fin = M.histogram(vals, lo, hi, nb), maxC = Math.max(...fin);
    hist = { vals, lo, hi, nb, w: (hi - lo) / nb, cur: new Array(nb).fill(0), cursor: 0, unit: HMAX / Math.max(maxC, 12), final: fin, st: stt, h: new Float32Array(NB), mean: 0, sd: 0, sum: 0, sum2: 0, n };
    if (REDUCED()) { hist.cur = fin.slice(); for (let b = 0; b < nb; b++) hist.h[b] = fin[b] * hist.unit; polyAdvance(n); }
    buildCurve(); polyTicks(); writeBars();
    if (n >= 500) { S.polyN.add(N); if (N >= 4) S.poly500N4 = true; }
    dirtyPanel = true;
  }
  function writeBars() {
    const nb = hist ? hist.nb : NB;
    for (let b = 0; b < NB; b++) {
      const h = hist && b < nb ? hist.h[b] : 0;
      _p.set(binX(b), 0.04, HZ); _s.set(b < nb ? (HW / nb) * 0.86 : 0.0001, Math.max(0.0001, h), b < nb ? 0.7 : 0.0001); _q.identity();
      bars.setMatrixAt(b, _m4.compose(_p, _q, _s));
      bars.setColorAt(b, _col.set(hist ? polyColor(hist.lo + (b + 0.5) * hist.w) : "#ffffff"));
    }
    bars.instanceMatrix.needsUpdate = true; if (bars.instanceColor) bars.instanceColor.needsUpdate = true;
  }
  /** reveal offspring up to index `upto`, keeping running mean / SD of just the revealed ones */
  function polyAdvance(upto) {
    for (; hist.cursor < upto; hist.cursor++) {
      const v = hist.vals[hist.cursor], b = Math.min(hist.nb - 1, Math.max(0, Math.floor((v - hist.lo) / hist.w)));
      hist.cur[b]++; hist.sum += v; hist.sum2 += v * v;
    }
    const k = hist.cursor;
    hist.mean = k ? hist.sum / k : 0;
    hist.sd = k ? Math.sqrt(Math.max(0, hist.sum2 / k - hist.mean * hist.mean)) : 0;
  }
  function updatePoly(dt, realDt) {
    if (!hist) return;
    let moving = false;
    if (hist.cursor < hist.n) {
      const upto = Math.min(hist.n, hist.cursor + Math.max(1, Math.round(380 * Math.max(dt, 0))));
      polyAdvance(upto);
      moving = true; dirtyPanel = true;
    }
    const k = 1 - Math.exp(-10 * Math.max(dt, 0));
    for (let b = 0; b < hist.nb; b++) { const tgt = hist.cur[b] * hist.unit, d = tgt - hist.h[b]; if (Math.abs(d) > 1e-3) { hist.h[b] += REDUCED() ? d : d * k; moving = true; } }
    if (moving) writeBars();
  }

  // ------------------------------------------------------------------ pedigree
  const gPed = new THREE.Group(); gPed.visible = false; root.add(gPed);
  let fam = null, pedMeshes = [], pedRings = [];
  const ped = { assign: [], answered: false, revealed: false, tries: 0, sel: -1, checked: null, feedback: "", showPossible: false };
  const pedMatU = share(glass("#bfe6ff", { rim: "#bfe6ff", rimStrength: 0.7, rimPower: 1.6, minAlpha: 0.12, maxAlpha: 0.55 }));
  const pedMatA = share(physical("#f472b6", { roughness: 0.35, emissive: new THREE.Color("#f472b6"), emissiveIntensity: 0.25 }));
  const lineMat = share(new THREE.MeshStandardMaterial({ color: "#8fb7e8", emissive: "#8fb7e8", emissiveIntensity: 0.4, roughness: 0.5 }));
  const boxGeo = share(new THREE.BoxGeometry(1, 1, 1));
  const pedBackGeo = share(new THREE.PlaneGeometry(14.6, 4.9)), pedBackMat = share(glass("#7aa7d9", { rim: "#9bd0ff", rimStrength: 0.4, minAlpha: 0.05, maxAlpha: 0.25 }));
  const sqGeo = share(new THREE.BoxGeometry(0.66, 0.66, 0.14));
  const ciGeo = share((() => { const g = new THREE.CylinderGeometry(0.37, 0.37, 0.14, 40); g.rotateX(Math.PI / 2); return g; })());
  const ringG = share(new THREE.RingGeometry(0.5, 0.57, 48));
  const okMat = share(new THREE.MeshBasicMaterial({ color: "#4ade80", side: THREE.DoubleSide })), badMat = share(new THREE.MeshBasicMaterial({ color: "#f87171", side: THREE.DoubleSide })), selMat = share(new THREE.MeshBasicMaterial({ color: "#5eead4", side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
  const selPed = new THREE.Mesh(share(new THREE.RingGeometry(0.58, 0.66, 48)), selMat); selPed.visible = false; selPed.userData.clayHide = true; gPed.add(selPed);
  const PATTERN_ALLELES = { AD: ["d", "D"], AR: ["A", "a"], XR: ["A", "a"] };
  function pedGenoHtml(pat, sex, c) {
    if (c == null) return "";
    if (pat === "XR") {
      const a = (n) => `X<sup>${n ? "a" : "A"}</sup>`;
      return sex === "M" ? a(c) + "Y" : c === 0 ? a(0) + a(0) : c === 1 ? a(0) + a(1) : a(1) + a(1);
    }
    if (pat === "AD") return c === 0 ? "dd" : c === 1 ? "Dd" : "DD";
    return c === 0 ? "AA" : c === 1 ? "Aa" : "aa";
  }
  const pedChoices = (pat, sex) => (pat === "XR" && sex === "M" ? [0, 1] : [0, 1, 2]);
  const pedKnown = () => fam && (!st.ped.mystery || ped.answered);

  function buildPed() {
    clearLabels("ped");
    for (const o of [...gPed.children]) if (o !== selPed) { gPed.remove(o); }
    pedMeshes = []; pedRings = []; ped.sel = -1; selPed.visible = false;
    if (!fam) return;
    const P = fam.ped;
    const back = new THREE.Mesh(pedBackGeo, pedBackMat);
    back.position.set(0, 1.85, -0.16); gPed.add(back);
    const seg = (x1, y1, x2, y2) => {
      const m = new THREE.Mesh(boxGeo, lineMat); m.position.set((x1 + x2) / 2, (y1 + y2) / 2, 0);
      m.scale.set(Math.max(0.045, Math.abs(x2 - x1)), Math.max(0.045, Math.abs(y2 - y1)), 0.045); gPed.add(m);
    };
    const X = (i) => P[i].x, Y = (i) => P[i].y, hw = 0.4;
    const couple = (a, b, kids, barY) => {
      const l = Math.min(X(a), X(b)), r = Math.max(X(a), X(b)), mid = (l + r) / 2, y = Y(a);
      seg(l + hw, y, r - hw, y);
      seg(mid, y, mid, barY);
      const xs = kids.map(X);
      seg(Math.min(...xs, mid), barY, Math.max(...xs, mid), barY);
      for (const k of kids) seg(X(k), barY, X(k), Y(k) + hw);
    };
    couple(0, 1, [2, 3, 4], 2.65); couple(2, 5, [7, 8], 1.05); couple(6, 3, [9, 10, 11], 1.05);
    P.forEach((p, i) => {
      const m = new THREE.Mesh(p.sex === "M" ? sqGeo : ciGeo, p.affected ? pedMatA : pedMatU);
      m.position.set(p.x, p.y, 0); m.userData = { kind: "ped", i }; gPed.add(m); pedMeshes[i] = m;
      const ring = new THREE.Mesh(ringG, okMat); ring.position.set(p.x, p.y, 0.1); ring.visible = false; ring.userData.clayHide = true; gPed.add(ring); pedRings[i] = ring;
      mkLabel("ped", p.label, "inh-ped", (out) => out.set(p.x, p.y - 0.62, 0.1));
      const g = mkLabel("ped", "", "inh-ped", (out) => out.set(p.x, p.y, 0.12)); g.idx = i;
    });
    if (engine.camera.aspect >= 0.9) for (const [t, y] of [["Gen. I", 3.4], ["Gen. II", 1.8], ["Gen. III", 0.2]]) mkLabel("ped", t, "inh-cap", (out) => out.set(-6.7, y, 0));
    mkLabel("ped", "□ male   ○ female   shaded = has the condition", "inh-cap", (out) => out.set(0, -0.62, 0.1));
    refreshPedLabels();
    setPickables();
  }
  function refreshPedLabels() {
    if (!fam) return;
    for (const o of LBL.ped) {
      if (o.idx == null) continue;
      const i = o.idx, p = fam.ped[i], pat = fam.pattern;
      let html = "";
      if (ped.showPossible && pedKnown()) {
        const set = [...fam.analysis.fit[pat].possible[i]].sort();
        html = set.map((c) => pedGenoHtml(pat, p.sex, c)).join(" / ");
      } else if (pedKnown() && ped.assign[i] != null) html = pedGenoHtml(pat, p.sex, ped.assign[i]);
      if (o.el.innerHTML !== html) o.el.innerHTML = html;
      o.el.className = "lbl3d inh-ped" + (ped.checked && ped.assign[i] != null && !ped.showPossible ? (ped.checked[i] ? " inh-ok" : " inh-bad") : "");
      const ring = pedRings[i];
      if (ring) { ring.visible = !!(ped.checked && ped.assign[i] != null); if (ring.visible) ring.material = ped.checked[i] ? okMat : badMat; }
    }
  }
  function newFamily() {
    const pat = st.ped.mystery ? M.PATTERNS[Math.floor(Math.random() * 3)] : st.ped.pattern;
    fam = M.generatePedigree(pat, undefined, { ambiguous: st.ped.mystery && st.ped.ambiguous }) || M.generatePedigree(pat);
    ped.assign = fam.ped.map(() => null); ped.answered = false; ped.revealed = false; ped.tries = 0; ped.checked = null; ped.feedback = ""; ped.showPossible = false;
    buildPed(); dirtyPanel = true;
  }
  function pedClick(i) {
    ped.sel = i;
    const m = pedMeshes[i]; selPed.position.set(m.position.x, m.position.y, 0.1); selPed.visible = true;
    engine.select({ title: fam.ped[i].label, kind: "Person", object: m, ped: i });
  }
  function assignGeno(i, c) {
    ped.assign[i] = c; ped.checked = null; ped.showPossible = false; refreshPedLabels(); showSelection(engine.selected);
  }
  function checkAssign() {
    const pat = fam.pattern, poss = fam.analysis.fit[pat].possible;
    const res = M.checkAssignment(fam.ped, pat, ped.assign, poss);
    ped.checked = res.ok;
    const given = ped.assign.filter((a) => a != null).length, good = res.ok.filter(Boolean).length;
    const forced = fam.ped.filter((p, i) => poss[i].size === 1).length;
    const indivBad = ped.assign.filter((a, i) => a != null && !res.individual[i]).length;
    let msg;
    if (given === 0) msg = "Click a person, then choose a genotype for them.";
    else if (res.joint && good === given) msg = `<p>All ${given} genotype${given === 1 ? "" : "s"} you gave fit together as one complete explanation of this family. Green means possible, not necessarily certain.</p>`;
    else if (indivBad === 0) msg = `<p>Each genotype you gave is possible on its own, but they cannot all be true together: no complete set of genotypes for the family agrees with all of them. Red marks the ones that clash with the genotypes accepted before them (reading the tree from the top).</p>`;
    else msg = `<p>${good} of ${given} genotypes you gave fit this family. Red marks a genotype that cannot be right (it would break the rules for this pattern, or clash with another genotype you gave).</p>`;
    ped.feedback = msg + (given ? `<p>${forced} ${forced === 1 ? "person's" : "people's"} genotype can be worked out for certain. For the others, more than one genotype fits \u2014 for example an unaffected person in an autosomal recessive family could be AA or Aa unless a child or a parent tells you.</p>` : "");
    refreshPedLabels(); dirtyPanel = true;
  }
  const diag = () => T.patternDiagnosis(fam.analysis, lens.band).map((x) => `<p>${x}</p>`).join("");
  function answerPattern(p) {
    const an = fam.analysis, truth = fam.pattern, name = T.PED_INFO[p].name;
    ped.tries++;
    const accepted = p === truth || (st.ped.ambiguous && an.consistent.includes(p));   // hard mode: any pattern the data allow is correct
    if (accepted) {
      ped.answered = true; S.pedSolved++; S.patternsSolved.add(p);
      ped.feedback = `<p><b>Yes: ${name}.</b> ${an.decisive ? "It is the only one of the three patterns that fits these phenotypes." : "It fits the data, but other patterns fit too, so say 'consistent with' rather than 'must be'."}</p><p class="hint">How this family was generated: ${T.PED_INFO[truth].name}. What the phenotypes alone support is listed below.</p>` + diag();
    } else if (!an.consistent.includes(p)) {
      ped.feedback = `<p><b>Not ${name}.</b> ${an.rules[p].why[0] || "No way to give the family genotypes that fits."}</p><p>Look at the rule that was broken, then try another pattern.</p>`;
    } else {
      ped.answered = true;
      ped.feedback = `<p><b>${name} is consistent with this family's phenotypes</b>, but the family was generated as <b>${T.PED_INFO[truth].name}</b>. A pedigree alone can't always tell them apart.</p>` + diag();
    }
    refreshPedLabels(); dirtyPanel = true; buildPedPanel();
  }
  function revealPattern() { ped.answered = true; ped.revealed = true; ped.feedback = `<p>This family was generated as <b>${T.PED_INFO[fam.pattern].name}</b>. What the phenotypes alone support:</p>` + diag(); refreshPedLabels(); dirtyPanel = true; buildPedPanel(); }

  function setPickables() {
    pickables.length = 0;
    if (st.mode === "pedigree") { pickables.push(...pedMeshes); return; }
    for (const p of parents) pickables.push(p.human, p.plant, p.bubble);
    if (st.mode === "poly") { pickables.push(bars); return; }
    if (board) for (const row of board.tiles) pickables.push(...row);
    pickables.push(kidCrowd.fig, kidCrowd.seedR, kidCrowd.seedW);
  }

  // ------------------------------------------------------------------ selection ring
  const selMark = new THREE.Mesh(share(new THREE.RingGeometry(0.34, 0.42, 40)), share(new THREE.MeshBasicMaterial({ color: "#5eead4", side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false })));
  selMark.rotation.x = -Math.PI / 2; selMark.visible = false; selMark.userData.clayHide = true; root.add(selMark);

  // ------------------------------------------------------------------ cross management
  let dirtyPanel = true;
  const classOfParent = (g) => spec.classes.find((c) => c.geno.includes(g))?.id;
  function setSpec() { spec = st.mode === "dihybrid" ? M.DIHYBRID : M.PRESETS[st.preset]; }
  function rebuildCross() {
    setSpec();
    clearKids();
    if (st.mode === "poly" || st.mode === "pedigree") { cross = null; tally = newTally(); buildBoard(); return; }
    cross = M.buildCross(spec, st.father, st.mother);
    tally = newTally();
    // mission flags that depend on the set-up alone
    if (st.mode === "mono") {
      const f = st.father[0], m = st.mother[0], het = (g) => g[0] !== g[1];
      if (spec.recessive && spec.affectedClass && het(f) && het(m)) S.carrierCross = true;
      const tc = targetClass();
      if (cross.cls.has(tc) && classOfParent(f) !== tc && classOfParent(m) !== tc && cross.cls.get(tc).p > 0) S.unaffectedParentsAffectedChild = true;
    }
    if (st.mode === "abo" && cross.cls.has("O")) {
      const pf = classOfParent(st.father[0]), pm = classOfParent(st.mother[0]);
      if ((pf === "A" && pm === "B") || (pf === "B" && pm === "A")) S.aboHeteroAB = true;
    }
    buildBoard();
  }
  function pickDefaults() {
    const d = spec.defaults;
    st.father = Array.isArray(d.father) ? [...d.father] : d.father;
    st.mother = Array.isArray(d.mother) ? [...d.mother] : d.mother;
  }
  function selectPreset(id) {
    st.preset = id; S.presets.add(id); setSpec(); pickDefaults(); refreshCross(true);
  }
  function setMode(m, silent = false) {
    st.mode = m;
    if (m === "mono" && !M.MODE_PRESETS.mono.includes(st.preset)) st.preset = "cf";
    if (m === "abo") st.preset = "abo";
    if (m === "xlinked" && !M.MODE_PRESETS.xlinked.includes(st.preset)) st.preset = "haemophilia";
    setSpec();
    if (m !== "poly" && m !== "pedigree") pickDefaults();
    if (m === "poly") st.poly.kA = st.poly.kB = st.poly.N;
    activeSets = m === "pedigree" ? ["ped"] : m === "poly" ? ["parent", "poly"] : ["parent", "board", "kids"];
    gParents.visible = m !== "pedigree"; gBoard.visible = gKids.visible = m !== "poly" && m !== "pedigree"; gHist.visible = m === "poly"; gPed.visible = m === "pedigree";
    gStage.visible = m !== "pedigree";
    selMark.visible = false;
    refreshCross(true);
    if (m === "poly") breed();    // parents were reset, so the old histogram no longer matches
    if (m === "pedigree" && !fam) newFamily();
    if (m === "pedigree") { ped.sel = -1; selPed.visible = false; }
    setPickables();
    if (!silent) { buildDyn(); flyToView(); }
  }
  function refreshCross(full) {
    rebuildCross();
    buildChromosomes();
    if (st.mode === "poly") { if (hist) { /* parents' genes changed: keep the old bars until re-bred */ } }
    dirtyPanel = true;
    setPickables();
    if (mounted) engine.select(null);
  }

  // ------------------------------------------------------------------ view
  function currentView() {
    const a = engine.camera.aspect, pedm = st.mode === "pedigree";
    const narrow = a < 0.9;
    const needW = pedm ? 14.2 : st.mode === "poly" ? (narrow ? 9.2 : 10.6) : narrow ? 6.6 : st.mode === "dihybrid" ? 9.4 : 8.2, needH = pedm ? 5.4 : 5.8;
    const d = Math.max(needW / (2 * TAN_HALF * a), needH / (2 * TAN_HALF));
    const target = pedm ? new THREE.Vector3(0, 1.8, 0) : st.mode === "poly" ? new THREE.Vector3(0, 1.1, 2.4) : new THREE.Vector3(0, 0.95, 3.2);
    const dir = pedm ? new THREE.Vector3(0, 0.04, 1) : new THREE.Vector3(0, 0.5, 1);
    return { target, distance: clamp(d, 7, 55), dir };
  }
  function flyToView() {
    const v = currentView(), p = v.target.clone().addScaledVector(v.dir.clone().normalize(), v.distance);
    engine.fly(v.target, p, 0.9);
  }

  // ------------------------------------------------------------------ panel
  const panel = document.createElement("div");
  panel.style.display = "contents";
  let dyn = null, probBody = null, narrBody = null, selCard = null, mission = null, built = false, builtBand = null;
  let setChips = null, chips = null, genoOpen = false, capEls = [], pedFbEl = null, polyBody = null;
  const bandName = () => lens.band;
  const y7 = () => lens.band === "y7-8";
  const sen = () => lens.atLeast("y11");
  const h = (html, tag = "div", cls = "") => { const e = document.createElement(tag); if (cls) e.className = cls; e.innerHTML = html; return e; };
  const pct = (p) => `${Math.round(p * 1000) / 10}%`;
  const availableModes = () => T.MODES.filter((m) => lens.atLeast(m.band));

  function buildModeCard() {
    const modes = availableModes();
    const c = K.card(panel, y7() ? "Inheritance lab" : "Inheritance lab");
    if (modes.length > 1) {
      const g = h("", "div", "inh-modes");
      const btns = modes.map((m) => {
        const b = K.button(g, T.pickBand(bandName(), m.label) || m.full, () => { if (st.mode !== m.id) setMode(m.id); syncModes(); }, { toggle: false });
        b.dataset.m = m.id; b.title = m.full; return b;
      });
      c.appendChild(g);
    }
    if (notice) c.appendChild(h(notice, "p", "inh-note"));
    const intro = h("", "p", "");
    intro.id = "inh-intro"; intro.style.marginTop = "8px"; c.appendChild(intro);
    if (modes.length === 1) c.appendChild(h("More kinds of crosses unlock in Years 9–10.", "p", "hint"));
    syncModes();
    function syncModes() {
      for (const b of c.querySelectorAll("[data-m]")) b.setAttribute("aria-pressed", String(b.dataset.m === st.mode));
      intro.innerHTML = T.pickBand(bandName(), T.MODE_INTRO[st.mode]);
    }
    modeSync = syncModes;
  }
  let modeSync = () => {};

  function panelBuild() {
    panel.innerHTML = "";
    buildModeCard();
    dyn = document.createElement("div"); dyn.style.display = "contents"; panel.appendChild(dyn);
    buildDyn();
    mission = K.missions(panel, lens.filter(T.MISSIONS).map((m) => ({ text: m.text, check: () => m.check(S) })), (m) => engine.toast(`🎯 Mission complete: ${m.text.replace(/<[^>]+>/g, "")}`, 3400));
    K.quiz(panel, lens.filter(T.QUIZ));
    built = true; builtBand = lens.band;
  }
  function buildDyn() {
    if (!dyn) return;
    dyn.innerHTML = ""; probBody = narrBody = selCard = pedFbEl = polyBody = null; capEls = [];
    if (st.mode === "poly") buildPolyPanel();
    else if (st.mode === "pedigree") buildPedPanel();
    else buildCrossPanel();
    modeSync();
    dirtyPanel = true;
  }

  // ---- parents
  function phenoOfParent(who) {
    if (spec.kind === "x") {
      const [d, r] = spec.alleles;
      if (who === 0) return st.father === r ? "Affected male" : "Unaffected male";
      const m = st.mother, n = [...m].filter((a) => a === r).length;
      return n === 0 ? "Unaffected, not a carrier" : n === 1 ? "Unaffected carrier" : "Affected female";
    }
    const g = who === 0 ? st.father : st.mother;
    if (spec.mode === "dihybrid") {
      const a = g[0].includes("R") ? "Round" : "Wrinkled", b = g[1].includes("Y") ? "yellow" : "green";
      return `${a}, ${b} seed`;
    }
    return T.describeGeno(spec, g[0], bandName());
  }
  function genoHtml(who) {
    const g = who === 0 ? st.father : st.mother;
    if (spec.kind === "x") { const f = (a) => `X<sup>${spec.fmt[a]}</sup>`; return who === 0 ? f(g) + "Y" : [...g].map(f).join(""); }
    return g.map((gt, gi) => M.fmtGeno(spec, gt, gi)).join("");
  }
  function updateCaptions() { capEls.forEach((el, w) => { if (el) el.textContent = phenoOfParent(w); }); }
  function parentPickers(card) {
    const mk = (who) => {
      const wrap = h(`<b>${who === 0 ? "Father" : "Mother"}${y7() ? "'s genes" : ""}</b>`, "div", "inh-par");
      const onPick = () => { S.parentChanges++; refreshCross(); updateCaptions(); };
      if (spec.kind === "x") {
        const [d, r] = spec.alleles, f = (a) => `X<sup>${spec.fmt[a]}</sup>`;
        const opts = who === 0 ? [d, r].map((a) => ({ value: a, label: f(a) + "Y" })) : [d + d, d + r, r + r].map((g) => ({ value: g, label: [...g].map(f).join("") }));
        K.segmented(wrap, opts, who === 0 ? st.father : st.mother, (v) => { if (who === 0) st.father = v; else st.mother = v; onPick(); });
      } else if (spec.mode === "dihybrid") {
        if (sen()) spec.genes.forEach((gn, gi) => {
          const opts = M.genotypeOptions(gn.alleles).map((g) => ({ value: g, label: M.fmtGeno(spec, g, gi) }));
          K.segmented(wrap, opts, (who === 0 ? st.father : st.mother)[gi], (v) => { (who === 0 ? st.father : st.mother)[gi] = v; onPick(); }).el.style.marginTop = gi ? "4px" : "0";
        });
        else wrap.appendChild(h(genoHtml(who), "div", "inh-gene"));
      } else {
        const opts = M.genotypeOptions(spec.alleles).map((g) => ({ value: g, label: M.fmtGeno(spec, g) }));
        K.segmented(wrap, opts, (who === 0 ? st.father : st.mother)[0], (v) => { (who === 0 ? st.father : st.mother)[0] = v; onPick(); });
      }
      const cap = document.createElement("small"); wrap.appendChild(cap); capEls[who] = cap;
      card.appendChild(wrap);
    };
    mk(0); mk(1);
    updateCaptions();
  }

  function buildCrossPanel() {
    setSpec();
    const cc = K.card(dyn, y7() ? "Choose a trait and the parents" : "Set up the cross");
    if (st.mode === "mono" || st.mode === "xlinked") {
      const row = h("", "div", "inh-presets");
      for (const id of M.MODE_PRESETS[st.mode]) {
        const b = K.button(row, T.pickBand(bandName(), T.PRESET_INFO[id].name), () => { selectPreset(id); buildDyn(); }, { toggle: false });
        b.setAttribute("aria-pressed", String(id === st.preset));
      }
      cc.appendChild(row);
    } else if (st.mode === "dihybrid" && sen()) {
      const row = h("", "div", "inh-presets");
      const set = (f, m) => () => { st.father = f; st.mother = m; S.parentChanges++; refreshCross(); buildDyn(); };
      K.button(row, "Dihybrid cross: RrYy × RrYy", set(["Rr", "Yy"], ["Rr", "Yy"]));
      K.button(row, "Test cross: RrYy × rryy", set(["Rr", "Yy"], ["rr", "yy"]));
      K.button(row, "Pure lines: RRYY × rryy", set(["RR", "YY"], ["rr", "yy"]));
      cc.appendChild(row);
    }
    parentPickers(cc);
    const lg = ringLegend();
    cc.appendChild(h(`<span><i class="inh-sw" style="background:linear-gradient(135deg,#7dd3fc,#f472b6)"></i>body colour = phenotype</span>${lg.length ? `<span>ring under the figure = genotype: ${lg.map(([c, t]) => `<i class="inh-sw" style="background:${c};margin-left:4px"></i>${t}`).join(" ")}</span>` : ""}`, "div", "inh-legend"));

    const pc = K.card(dyn, y7() ? "What might happen" : "Prediction and sampling");
    probBody = h(""); pc.appendChild(probBody);
    const r = K.buttonRow(pc);
    const mk = (n, label) => K.button(r, label, () => haveChildren(n), { kind: n === 1 ? "primary" : "" });
    mk(1, "Have 1 child"); mk(10, "10"); mk(100, "100");
    K.button(r, "Clear", () => { clearKids(); tally = newTally(); dirtyPanel = true; });
    pc.appendChild(h(T.pickBand(bandName(), T.INDEPENDENCE), "p", "inh-note"));

    const nc = K.card(dyn, "What's happening", "explain");
    narrBody = h(""); nc.appendChild(narrBody);

    selCard = K.card(dyn, "Selected", "sel-card"); selCard.style.display = "none";

    // about this trait
    const info = st.mode === "dihybrid" ? T.DIHYBRID_INFO : T.PRESET_INFO[st.preset];
    const ac = K.card(dyn, y7() ? "About this trait" : "About this gene");
    const nm = T.pickBand(bandName(), info.name);
    const pt = info.pattern ? T.pickBand(bandName(), info.pattern) : "";
    ac.appendChild(h(`<b style="color:var(--ink)">${nm}</b>${pt ? ` · <span style="color:var(--accent)">${pt}</span>` : ""}`, "p"));
    const spec_ = spec.gene ? `<span class="inh-gene">${spec.gene}</span>${spec.locus ? ` · ${spec.locus.text} (${spec.locus.arm === "p" ? "short" : "long"} arm)` : spec.chr ? ` · chromosome ${spec.chr}` : ""}` : "";
    if (spec_ && !y7()) ac.appendChild(h(spec_, "p", "hint"));
    ac.appendChild(h(T.pickBand(bandName(), info.blurb), "p"));
    if (info.note) ac.appendChild(h(T.pickBand(bandName(), info.note), "p", "hint"));
    if (info.aside && sen()) ac.appendChild(h(T.pickBand(bandName(), info.aside), "p", "inh-note"));
    if (st.preset === "mc1r" && st.mode === "mono") ac.appendChild(h("<b>Simplified:</b> real hair colour depends on many genes, so this one-gene model is a teaching simplification.", "p", "inh-note"));
    if (st.mode === "dihybrid") ac.appendChild(h(`<b>Linked genes break this.</b> Independent assortment only holds for genes on different chromosomes (or far apart on one). Genes close together on the same chromosome are linked and are usually inherited together; crossing over is what separates them. <a href="${engine.root}sims/meiosis/index.html" style="color:var(--accent)">See crossing over in the Meiosis lab ▸</a>`, "p", "inh-note"));
    if (st.mode === "abo") ac.appendChild(h("A person with blood group A (or B) could have one or two copies of that allele: the phenotype doesn't tell you the genotype. Group O is always <i>ii</i>.", "p", "inh-note"));
    if (st.mode === "xlinked") ac.appendChild(h("<b>Criss-cross inheritance:</b> an affected father passes his X to all his daughters (carriers if the mother is not a carrier, affected if she is one too) and his Y to his sons, so he never passes it to a son. So with an affected father and a carrier mother, half the daughters are affected (X<sup>h</sup>X<sup>h</sup>) and half are carriers; with a mother who is not a carrier, all daughters are carriers. A carrier mother passes it to about half her sons and half her daughters. Carrier females can sometimes have symptoms (random X-inactivation).", "p", "inh-note"));
    if (!y7()) ac.appendChild(h("Dominant and recessive describe how an allele behaves in a heterozygote. They say nothing about how common the allele is.", "p", "hint"));
    if (st.mode === "mono" && st.preset === "sickle" && !y7()) mutationCard();
    if (sen()) {
      const c = K.card(dyn, "Beyond simple Mendelian ratios");
      c.appendChild(h("<b>Penetrance and expressivity.</b> Not everyone with a disease genotype shows the phenotype (incomplete penetrance), and those who do can be mildly or severely affected (variable expressivity). Punnett squares give genotype probabilities, not guarantees about phenotype.", "p"));
      c.appendChild(h("<b>Epigenetics.</b> Not all heritable variation is in the DNA base sequence: some chromatin marks (DNA methylation, histone modifications) are copied through cell divisions and occasionally across generations, though most are reset in gametes. Punnett squares model sequence variants only.", "p"));
    }
    addWords();
  }
  function addWords() {
    const c = K.card(dyn, "Key words");
    c.appendChild(h(T.WORDS[lens.band === "y12" ? "y11" : lens.band].map(([a, b]) => `<p><b style="color:var(--ink)">${a}:</b> ${b}</p>`).join("")));
  }
  function mutationCard() {
    const c = K.card(dyn, "The sickle mutation");
    const ci = Math.floor(SICKLE_INDEX / 3);
    const row = (g, label, hit) => `<div style="margin:4px 0"><span class="hint" style="margin-right:6px">${label}</span>${[ci - 1, ci, ci + 1].map((k, idx) => {
      const dna = g.slice(k * 3, k * 3 + 3), rna = toRNA(dna), aa = AA[CODE[rna]];
      return `<span class="inh-codon${idx === 1 && hit ? " hit" : ""}">${dna}<small>${rna}</small><small style="color:${CLASS_COL[aa[2]]}">${aa[0]}</small></span>`;
    }).join("")}</div>`;
    c.insertAdjacentHTML("beforeend", `<p>The <i>HBB</i> gene makes \u03b2-globin. Sickle-cell disease comes from <b>one base change</b> in codon 6 (counting from the first amino acid after Met): <b>GAG \u2192 GTG</b>, so glutamic acid becomes valine.</p>${row(ORIGINAL_GENE, "HbA", false)}${row(SICKLE_GENE, "HbS", true)}`);
    c.insertAdjacentHTML("beforeend", `<p class="hint">Glutamic acid is acidic and water-loving; valine is non-polar and water-hating. On deoxygenated haemoglobin the valine makes molecules stick together in long fibres, which bend the red blood cell. (A human gene shown in a plant cell for teaching: a simplified fragment of HBB.)</p>`);
    c.insertAdjacentHTML("beforeend", `<div class="btn-row"><a class="btn" href="${engine.root}sims/protein-synthesis/index.html">See how a base change alters a protein \u25b8</a></div>`);
  }

  // ---- probability table and narrative
  function describeParentFull(who) { return `${genoHtml(who)} (${phenoOfParent(who).toLowerCase()})`; }
  function renderProb() {
    if (!probBody || !cross) return;
    const n = tally.n, cs = M.crossClasses(cross);
    const lbl = (c) => T.pickBand(bandName(), spec.classes.find((k) => k.id === c.id).label);
    let html = `<table class="inh-tbl"><tr><th>${y7() ? "What a child could be" : "Outcome"}</th><th class="n">Expected</th>${n ? '<th class="n">Observed</th>' : ""}</tr>`;
    for (const c of cs) {
      const o = tally.cls[c.id] || 0;
      html += `<tr><td><i class="inh-sw" style="background:${c.color}"></i>${lbl(c)}<span class="bar"><i style="width:${n ? (o / n) * 100 : 0}%;background:${c.color}"></i><u style="left:calc(${c.p * 100}% - 1px)"></u></span></td><td class="n">${M.fraction(c.n, cross.n)}<br><small>${pct(c.p)}</small></td>${n ? `<td class="n">${o}<br><small>${pct(o / n)} · exp ${(c.p * n).toFixed(1)}</small></td>` : ""}</tr>`;
    }
    html += "</table>";
    if (!y7()) html += `<p class="hint" style="margin:2px 0 6px">${cs.length > 1 ? `Phenotype ratio ${M.ratioString(cross)}` : "All children have the same phenotype"}${cross.geno.size > cs.length ? ` · genotype ratio ${M.genoRatioString(cross)}` : ""}. The white mark on each bar is the expected share.</p>`;
    if (!y7() && cross.geno.size > 1) {
      html += `<details${genoOpen ? " open" : ""}><summary style="cursor:pointer;color:var(--ink-dim);font-size:.82rem">Genotypes</summary><table class="inh-tbl"><tr><th>Genotype</th><th class="n">Expected</th>${n ? '<th class="n">Observed</th>' : ""}</tr>`;
      for (const [k, g] of cross.geno) html += `<tr><td class="inh-gene">${g.label}</td><td class="n">${M.fraction(g.n, cross.n)}</td>${n ? `<td class="n">${tally.geno[k] || 0}</td>` : ""}</tr>`;
      html += "</table></details>";
    }
    if (probBody._h !== html) {
      probBody._h = html; probBody.innerHTML = html;
      const d = probBody.querySelector("details"); if (d) d.addEventListener("toggle", () => (genoOpen = d.open));
    }
  }
  function renderNarr() {
    if (!narrBody || !cross) return;
    const paras = T.crossNarrative({ band: bandName(), cross, spec, n: tally.n, counts: tally.cls, fatherDesc: describeParentFull(0), motherDesc: describeParentFull(1), last: tally.last, run: tally.run });
    const html = paras.map((p) => `<p>${p}</p>`).join("");
    if (narrBody._h !== html) { narrBody._h = html; narrBody.innerHTML = html; }
  }

  // ---- polygenic panel
  function buildPolyPanel() {
    const pc = K.card(dyn, y7() ? "Many genes" : "Genes and environment");
    const seg = K.segmented(pc, [{ value: "eyes", label: "Eye colour" }, { value: "height", label: "Height-like trait" }], st.poly.trait, (v) => { st.poly.trait = v; if (hist) { breed(); } buildDyn(); });
    seg.el.style.marginBottom = "8px";
    const info = traitOf();
    const sl1 = K.slider(pc, { label: "Number of genes (N)", min: 1, max: 6, step: 1, value: st.poly.N, onInput: (v) => { st.poly.N = v; st.poly.kA = st.poly.kB = v; buildChromosomes(); if (sl2) { sl2.input.max = 2 * v; sl2.value = v; } if (sl3) { sl3.input.max = 2 * v; sl3.value = v; } breed(); } });
    let sl2 = null, sl3 = null;
    K.slider(pc, { label: "Environment variation (SD)", min: 0, max: 2.5, step: 0.1, value: st.poly.env, format: (v) => v.toFixed(1), onInput: (v) => { st.poly.env = v; breed(); } });
    if (sen()) {
      sl2 = K.slider(pc, { label: "Parent 1: number of + alleles", min: 0, max: 2 * st.poly.N, step: 1, value: st.poly.kA, onInput: (v) => { st.poly.kA = v; buildChromosomes(); breed(); } });
      sl3 = K.slider(pc, { label: "Parent 2: number of + alleles", min: 0, max: 2 * st.poly.N, step: 1, value: st.poly.kB, onInput: (v) => { st.poly.kB = v; buildChromosomes(); breed(); } });
    }
    const r = K.buttonRow(pc);
    K.button(r, "Breed 500 offspring", () => breed(), { kind: "primary" });
    if (sen()) K.button(r, "Extreme parents (++ × −−)", () => { st.poly.kA = 2 * st.poly.N; st.poly.kB = 0; buildChromosomes(); breed(); buildDyn(); });
    if (sen()) K.button(r, "Reset parents", () => { st.poly.kA = st.poly.kB = st.poly.N; buildChromosomes(); breed(); buildDyn(); });
    pc.appendChild(h("Green bands are + alleles (each adds to the trait); grey bands are − alleles. By default each parent is heterozygous at every gene.", "p", "hint"));
    polyBody = h(""); const sc = K.card(dyn, "Expected and observed"); sc.appendChild(polyBody);
    const nc = K.card(dyn, "What's happening", "explain"); narrBody = h(""); nc.appendChild(narrBody);
    selCard = K.card(dyn, "Selected", "sel-card"); selCard.style.display = "none";
    const ac = K.card(dyn, "About this trait");
    ac.appendChild(h(`<b style="color:var(--ink)">${T.pickBand(bandName(), info.name)}</b>`, "p"));
    ac.appendChild(h(T.pickBand(bandName(), info.blurb), "p"));
    if (st.poly.trait === "eyes") ac.appendChild(h("Eye colour is not a single brown/blue gene. OCA2 and HERC2 (chromosome 15q12–13) are the major genes, but several others contribute, so it is not a simple Mendelian trait.", "p", "inh-note"));
    ac.appendChild(h("The genes in this model are drawn on one chromosome pair for simplicity. Real genes affecting a trait are usually scattered over many chromosomes.", "p", "hint"));
    addWords();
  }
  function renderPoly() {
    if (!polyBody || st.mode !== "poly") return;
    const { N, kA, kB, env } = st.poly, stt = M.polyStats(N, kA, kB, env);
    const u = y7() ? "" : "";
    let html = `<table class="inh-tbl"><tr><th></th><th class="n">Expected</th>${hist && hist.cursor ? '<th class="n">Observed</th>' : ""}</tr>
      <tr><td>Mean (+ alleles)</td><td class="n">${stt.mean.toFixed(2)}</td>${hist && hist.cursor ? `<td class="n">${hist.mean.toFixed(2)}</td>` : ""}</tr>
      <tr><td>Spread (SD)</td><td class="n">${stt.sd.toFixed(2)}</td>${hist && hist.cursor ? `<td class="n">${hist.sd.toFixed(2)}</td>` : ""}</tr>
      ${sen() ? `<tr><td>Genetic variance</td><td class="n">${stt.varG.toFixed(2)}</td><td></td></tr><tr><td>Environmental variance</td><td class="n">${stt.varE.toFixed(2)}</td><td></td></tr><tr><td>Heritability H²</td><td class="n">${stt.h2 == null ? "undefined" : stt.h2.toFixed(2)}</td><td></td></tr>` : ""}</table>`;
    if (polyBody._h !== html) { polyBody._h = html; polyBody.innerHTML = html; }
    const paras = T.polyNarrative({ band: bandName(), N, kA, kB, env, st: stt, n: hist ? hist.cursor : 0, sample: hist && hist.cursor ? { mean: hist.mean, sd: hist.sd } : null, trait: st.poly.trait === "eyes" ? "iris colour" : "height" });
    const nh = paras.map((p) => `<p>${p}</p>`).join("");
    if (narrBody && narrBody._h !== nh) { narrBody._h = nh; narrBody.innerHTML = nh; }
  }

  // ---- pedigree panel
  function buildPedPanel() {
    if (!dyn) return;
    dyn.innerHTML = ""; pedFbEl = null; selCard = null; narrBody = null; probBody = null; polyBody = null;
    const pc = K.card(dyn, "Family tree");
    if (!st.ped.mystery) {
      K.segmented(pc, M.PATTERNS.map((p) => ({ value: p, label: p === "AD" ? "Autosomal dominant" : p === "AR" ? "Autosomal recessive" : "X-linked recessive" })), st.ped.pattern, (v) => { st.ped.pattern = v; newFamily(); buildPedPanel(); }).el.style.marginBottom = "8px";
    }
    K.checkbox(pc, "Mystery family: hide the pattern", st.ped.mystery, (v) => { st.ped.mystery = v; newFamily(); buildPedPanel(); });
    if (st.ped.mystery && sen()) K.checkbox(pc, "Allow families that fit more than one pattern", st.ped.ambiguous, (v) => { st.ped.ambiguous = v; newFamily(); buildPedPanel(); });
    const r = K.buttonRow(pc);
    K.button(r, "New family", () => { newFamily(); buildPedPanel(); }, { kind: "primary" });
    const known = pedKnown();
    if (st.ped.mystery && !ped.answered) {
      const q = K.card(dyn, "Which pattern?");
      q.appendChild(h("Look for the clues, then choose. Click people in the tree to see their details.", "p"));
      const rr = K.buttonRow(q);
      for (const p of M.PATTERNS) K.button(rr, T.PED_INFO[p].name, () => answerPattern(p));
      const rr2 = K.buttonRow(q); K.button(rr2, "I give up: show me", revealPattern);
      q.appendChild(h(T.pickBand(bandName(), { "y9-10": "Clues to check: Does every affected person have an affected parent? Can two unaffected parents have an affected child? Are mostly males affected?", y11: "Check each generation, the sex ratio, whether unaffected parents have affected children, and any male-to-male transmission." }), "p", "hint"));
    } else {
      const rc = K.card(dyn, T.PED_INFO[fam.pattern].name + (st.ped.mystery ? " (revealed)" : ""));
      rc.appendChild(h(T.pickBand(bandName(), T.PED_INFO[fam.pattern].rules), "p"));
      if (!st.ped.mystery) for (const x of T.patternDiagnosis(fam.analysis, bandName()).slice(0, 1)) rc.appendChild(h(x, "p", "hint"));
    }
    pedFbEl = K.card(dyn, "Feedback", "inh-feedback");
    pedFbEl.style.display = ped.feedback ? "" : "none";
    if (ped.feedback) pedFbEl.insertAdjacentHTML("beforeend", ped.feedback);
    if (known) {
      const gc = K.card(dyn, y7() ? "Work out the genes" : "Assign genotypes");
      gc.appendChild(h(`Click a person in the tree, then choose a genotype. Key: <b>${fam.pattern === "AD" ? "D = condition allele (dominant)" : fam.pattern === "AR" ? "a = condition allele (recessive)" : "X<sup>a</sup> = condition allele on the X"}</b>. Real pedigrees show phenotypes only: a genotype is "possible" if it can be part of a consistent explanation of the whole family.`, "p"));
      const gr = K.buttonRow(gc);
      K.button(gr, "Check my genotypes", () => { checkAssign(); buildPedPanel(); }, { kind: "primary" });
      K.button(gr, ped.showPossible ? "Hide possible genotypes" : "Show all possible genotypes", () => { ped.showPossible = !ped.showPossible; ped.checked = null; refreshPedLabels(); buildPedPanel(); });
      K.button(gr, "Clear mine", () => { ped.assign = ped.assign.map(() => null); ped.checked = null; ped.feedback = ""; refreshPedLabels(); buildPedPanel(); });
    }
    selCard = K.card(dyn, "Selected", "sel-card"); selCard.style.display = "none";
    if (ped.sel >= 0) showSelection(engine.selected);
    const ac = K.card(dyn, "Reading a pedigree");
    ac.appendChild(h("Squares are males and circles are females. A line between two people is a partnership; a line down to a row of symbols leads to their children. Shaded symbols have the condition.", "p"));
    ac.appendChild(h("Unaffected people in the tree may still be carriers; the tree shows phenotypes only. Pedigree rules assume the condition is fully penetrant and nobody has a new mutation. Small pedigrees often fit more than one pattern, so say “consistent with” unless the evidence is decisive.", "p", "hint"));
    addWords();
    dirtyPanel = true;
  }

  // ---- selection
  function gametesText(who) {
    const list = who === 0 ? cross.cols : cross.rows, cnt = {};
    for (const g of list) cnt[g.label] = (cnt[g.label] || 0) + 1;
    return Object.entries(cnt).map(([l, n]) => `${M.fraction(n, list.length)} carry ${l}`).join(", ");
  }
  function cellInfoHtml(cell, extra = "") {
    const cl = spec.classes.find((c) => c.id === cell.cls), g = cross.geno.get(cell.key), pc = cross.cls.get(cell.cls);
    return `<p style="color:var(--ink);font-weight:600;margin-bottom:4px"><i class="inh-sw" style="background:${cl.color}"></i>${T.pickBand(bandName(), cl.label)}</p>
      <div class="io"><b>Genotype</b><span class="inh-gene">${cell.label}</span><b>Phenotype</b><span>${T.pickBand(bandName(), cl.label)}</span><b>This box</b><span>1 in ${cross.n}</span><b>This genotype</b><span>${M.fraction(g.n, cross.n)} (${pct(g.p)}) of children</span><b>This phenotype</b><span>${M.fraction(pc.n, cross.n)} (${pct(pc.p)}) of children</span></div>${extra}`;
  }
  function showSelection(info) {
    if (!selCard) return;
    if (!info) { selCard.style.display = "none"; selMark.visible = false; if (st.mode === "pedigree") { selPed.visible = false; ped.sel = -1; } return; }
    const ud = info.object?.userData || {};
    let html = "";
    selMark.visible = false;
    if (st.mode === "pedigree" && info.ped != null && fam) {
      const i = info.ped, p = fam.ped[i], pat = fam.pattern;
      const par = p.f != null ? `${fam.ped[p.f].label} (${fam.ped[p.f].affected ? "affected" : "unaffected"}) and ${fam.ped[p.m].label} (${fam.ped[p.m].affected ? "affected" : "unaffected"})` : "not shown in this tree";
      const kidsOf = fam.ped.filter((q) => q.f === i || q.m === i);
      html = `<h2>Selected</h2><p style="color:var(--ink);font-weight:600;margin-bottom:4px">${p.label} · ${p.sex === "M" ? "male" : "female"} · ${p.affected ? "has the condition" : "does not have the condition"}</p>
        <div class="io"><b>Parents</b><span>${par}</span><b>Children</b><span>${kidsOf.length ? kidsOf.map((q) => `${q.label} (${q.affected ? "affected" : "unaffected"})`).join(", ") : "none shown"}</span></div>`;
      if (pedKnown()) {
        html += `<p class="hint" style="margin-top:6px">Choose a genotype for ${p.label}:</p><div class="btn-row">` + pedChoices(pat, p.sex).map((c) => `<button class="btn" type="button" data-g="${c}" aria-pressed="${ped.assign[i] === c}">${pedGenoHtml(pat, p.sex, c)}</button>`).join("") + `<button class="btn" type="button" data-g="x">clear</button></div>`;
        if (ped.showPossible || ped.checked) {
          const set = [...fam.analysis.fit[pat].possible[i]].sort().map((c) => pedGenoHtml(pat, p.sex, c)).join(" or ");
          html += `<p class="hint">Possible for this person in this family: ${set}.</p>`;
        }
      } else html += `<p class="hint" style="margin-top:6px">Choose the family's pattern first; then you can assign genotypes.</p>`;
      selCard.innerHTML = html; selCard.style.display = "";
      for (const b of selCard.querySelectorAll("[data-g]")) b.addEventListener("click", () => assignGeno(i, b.dataset.g === "x" ? null : +b.dataset.g));
      return;
    }
    if (ud.kind === "parent" && st.mode === "poly") {
      const w = ud.who, k = w === 0 ? st.poly.kA : st.poly.kB, N = st.poly.N, loci = M.polyLoci(N, k), het = loci.filter((c) => c === 1).length;
      html = `<h2>Selected</h2><p style="color:var(--ink);font-weight:600;margin-bottom:4px">${w === 0 ? "Father" : "Mother"}</p><div class="io"><b>Genes</b><span>${k} + alleles out of ${2 * N} (${loci.filter((c) => c === 2).length} genes ++, ${het} genes +\u2212, ${loci.filter((c) => c === 0).length} genes \u2212\u2212)</span><b>Passes on</b><span>one allele of each gene: always + at ++ genes, always \u2212 at \u2212\u2212 genes, a coin flip at the ${het} +\u2212 gene${het === 1 ? "" : "s"}.</span></div>`;
      const o = parents[w].g.position; selMark.position.set(o.x, 0.03, o.z); selMark.scale.setScalar(1.8); selMark.visible = true;
    } else if (ud.kind === "parent" && cross) {
      const w = ud.who, g = genoHtml(w);
      html = `<h2>Selected</h2><p style="color:var(--ink);font-weight:600;margin-bottom:4px">${w === 0 ? "Father" : "Mother"}</p>
        <div class="io"><b>Genotype</b><span class="inh-gene">${g}</span><b>Phenotype</b><span>${phenoOfParent(w)}</span><b>Makes</b><span>${gametesText(w)} of ${w === 0 ? "sperm" : "eggs"}</span></div>
        <p class="hint">Meiosis gives each sex cell just one allele of each gene. Which one is chance (and for two genes, they are shuffled independently).</p>`;
      const o = parents[w].g.position; selMark.position.set(o.x, 0.03, o.z); selMark.scale.setScalar(1.8); selMark.visible = true;
    } else if (ud.kind === "tile" && cross) {
      const cell = cross.cells[ud.i][ud.j];
      html = `<h2>Selected</h2>` + cellInfoHtml(cell, `<p class="hint">Mother's egg: ${cross.rows[ud.i].label}. Father's sperm: ${cross.cols[ud.j].label}.</p>`);
      board.cell(ud.i, ud.j, _v); selMark.position.set(_v.x, 0.11, _v.z); selMark.scale.setScalar(board.cs * 1.5); selMark.visible = true;
    } else if ((info.object === kidCrowd.fig || info.object === kidCrowd.seedR || info.object === kidCrowd.seedW) && info.kid != null && kids[info.kid]) {
      const k = kids[info.kid], cell = cross.cells[k.i][k.j];
      html = `<h2>Selected</h2>` + cellInfoHtml(cell, `<p class="hint">This child came from the box (egg ${cross.rows[k.i].label}, sperm ${cross.cols[k.j].label}).</p>`);
      selMark.position.set(k.x, 0.04, k.z); selMark.scale.setScalar(kidSp * 1.9); selMark.visible = true;
    } else if (info.object === bars && info.bar != null && hist) {
      const b = info.bar, lo = hist.lo + b * hist.w, hi = lo + hist.w;
      html = `<h2>Selected</h2><p style="color:var(--ink);font-weight:600;margin-bottom:4px">${traitVal(lo)} to ${traitVal(hi)}</p><div class="io"><b>Offspring</b><span>${hist.cur[b]} of ${hist.n}</span><b>Expected</b><span>${(hist.n * hist.w * M.normalPdf(lo + hist.w / 2, hist.st.mean, Math.max(0.35, hist.st.sd))).toFixed(1)} (normal curve)</span></div>`;
    } else { selCard.style.display = "none"; return; }
    selCard.innerHTML = html; selCard.style.display = "";
    selCard.parentElement?.parentElement?.scrollTo?.({ top: 0, behavior: "smooth" });
  }

  // ------------------------------------------------------------------ chips
  function buildChips() {
    const ov = engine.overlay; ov.innerHTML = "";
    const mk = () => { const set = K.chip(ov), el = ov.lastElementChild; el.style.display = "none"; return (htm) => { set(htm); el.style.display = htm ? "" : "none"; }; };
    chips = { a: mk(), b: mk(), c: mk() };
  }
  function updateChips() {
    if (!chips) return;
    const dot = (c) => `<i class="dot" style="background:${c}"></i>`;
    if (st.mode === "poly") {
      chips.a(`${dot("#5eead4")}Genes <b>${st.poly.N}</b>`); chips.b(hist ? `${dot("#fde68a")}Offspring <b>${hist.cursor}</b>` : ""); chips.c(hist && hist.cursor ? `${dot("#a78bfa")}Mean <b>${hist.mean.toFixed(2)}</b> · SD <b>${hist.sd.toFixed(2)}</b>` : "");
    } else if (st.mode === "pedigree") {
      const aff = fam ? fam.ped.filter((p) => p.affected).length : 0;
      chips.a(`${dot("#f472b6")}Affected <b>${aff}</b> of ${fam ? fam.ped.length : 0}`); chips.b(`${dot("#5eead4")}Pattern <b>${!fam ? "" : st.ped.mystery && !ped.answered ? "?" : T.PED_INFO[fam.pattern].name}</b>`); chips.c("");
    } else if (cross) {
      const tc = spec.kind === "x" ? "Ma" : targetClass(), c = spec.classes.find((c) => c.id === tc), exp = cross.cls.get(tc)?.p ?? 0, n = tally.n, o = tally.cls[tc] || 0;
      chips.a(`${dot("#5eead4")}Children <b>${n}</b>`);
      chips.b(cross.cls.has(tc) || n ? `${dot(c.color)}${T.pickBand(bandName(), c.label)} <b>${n ? pct(o / n) : "—"}</b> · expected <b>${pct(exp)}</b>` : "");
      chips.c(tally.run >= 3 ? `${dot("#fbbf24")}${tally.run} the same in a row: still independent` : "");
    }
  }

  // ------------------------------------------------------------------ the level
  function renderAll() {
    if (st.mode === "poly") renderPoly();
    else if (st.mode === "pedigree") { if (pedFbEl && pedFbEl._h !== ped.feedback) { pedFbEl._h = ped.feedback; pedFbEl.innerHTML = `<h2>Feedback</h2>${ped.feedback}`; pedFbEl.style.display = ped.feedback ? "" : "none"; } }
    else { renderProb(); renderNarr(); if (LBL.kids.length) updateKidLabels(); }
  }
  let panelT = 0, chipT = 0, missT = 0;

  const level = {
    title: "Inheritance lab",
    topics: ["inheritance", "genes", "epigenetics", "mutation", "meiosis"],
    root, pickables, portals,
    metersPerUnit: 1,
    showScale: false,   // figures and the Punnett board are stylised, not to scale
    get view() { return currentView(); },
    minDistance: 3, maxDistance: 45, near: 0.1, far: 300, minPolar: 0.15, maxPolar: Math.PI * 0.49,
    env: { bg: ["#07142a", "#0d2a47", "#241d52"], fog: ["#0a1d33", 0.005], exposure: 1.12, bloom: [0.5, 0.6, 0.85], aperture: 0.0001 },
    info(obj) {
      const k = obj.userData.kind;
      if (k === "parent") return { title: obj.userData.who === 0 ? "Father" : "Mother", kind: "Parent: glowing chromosomes carry the alleles" };
      if (k === "tile") return { title: cross.cells[obj.userData.i][obj.userData.j].label, kind: "Punnett box: click for the chances" };
      if (k === "kid") return { title: "Child", kind: "Click for this child's genotype" };
      if (k === "bar") return { title: "Histogram bar", kind: "Click for the count" };
      if (k === "ped") return { title: fam.ped[obj.userData.i].label, kind: fam.ped[obj.userData.i].affected ? "Affected" : "Unaffected" };
      return null;
    },
    onSelect(info) { showSelection(info); },
    onClick(e, hit) {
      if (!hit) return false;
      const o = hit.object, ud = o.userData;
      if (ud.kind === "ped") { pedClick(ud.i); return true; }
      if (o === kidCrowd.fig || o === kidCrowd.seedR || o === kidCrowd.seedW) { engine.select({ title: "Child", kind: "Child", object: o, point: hit.point, kid: hit.instanceId }); return true; }
      if (o === bars) { engine.select({ title: "Bar", kind: "Histogram", object: o, point: hit.point, bar: hit.instanceId }); return true; }
      return false;
    },
    mountPanel(el) {
      mounted = true;
      if (!built || builtBand !== lens.band) panelBuild();
      el.appendChild(panel);
      buildChips(); updateChips();
      layoutParents();
    },
    unmountPanel() {
      mounted = false;
      for (const set of Object.keys(LBL)) for (const o of LBL[set]) o.el.style.display = "none";
      engine.overlay.innerHTML = ""; chips = null;
    },
    onResume() { mounted = true; },
    onResize() { layoutParents(); },
    onLens() {
      const ok = T.MODES.some((m) => m.id === st.mode && lens.atLeast(m.band));
      if (st.mode === "dihybrid" && !lens.atLeast("y11") && (st.father.join("") !== "RrYy" || st.mother.join("") !== "RrYy")) { st.father = ["Rr", "Yy"]; st.mother = ["Rr", "Yy"]; refreshCross(); }
      if (!ok) { notice = "That kind of cross is a Year 9+ topic, so you are back on the one-gene crosses."; setMode("mono", true); } else if (lens.atLeast("y9-10")) notice = "";
      panelBuild(); dirtyPanel = true;
      if (!ok) flyToView();
    },
    dispose() {
      for (const set of Object.keys(LBL)) clearLabels(set);
      for (const r of SH) r.dispose?.();
      if (curve) curve.geometry.dispose();
      for (const f of tileMats ? Object.values(tileMats) : []) f.dispose?.();
      panel.remove();
    },
    update(dt, t, rdt = dt) {
      clock += dt;
      const calm = REDUCED();
      if (!calm && dt > 0) {
        parents[0].g.rotation.y = 0.28 + Math.sin(t * 0.45) * 0.04; parents[1].g.rotation.y = -0.28 + Math.sin(t * 0.45 + 1.7) * 0.04;
        for (const p of parents) { p.holder.rotation.y = Math.sin(t * 0.5 + p.g.position.x) * 0.45; p.bubble.scale.setScalar(1 + Math.sin(t * 1.3) * 0.012); }
        gStage.userData.dust.rotation.y = t * 0.01;
      }
      if (st.mode !== "poly" && st.mode !== "pedigree") {
        processQueue(); updateFlights(dt); updateSparks(dt);
        if (board) {
          let anim = false;
          for (let s = 0; s < popped.length; s++) if (popped[s] < 0.6) { popped[s] += dt; anim = true; }
          if (anim) writeCellKids();
          for (const row of board.glows) for (const gl of row) { const f = gl.userData.flash; if (f > 0) { gl.userData.flash = Math.max(0, f - dt * 1.3); gl.material.opacity = gl.userData.flash * 0.8; } }
        }
        animateKids(dt);
      }
      if (st.mode === "poly") updatePoly(dt, rdt);
      if (selMark.visible) { selMark.material.opacity = 0.6 + 0.3 * Math.sin(t * 4); }
      if (selPed.visible) selMat.opacity = 0.6 + 0.3 * Math.sin(t * 4);
      updateLabels();
      if ((panelT -= rdt) <= 0 && dirtyPanel) { panelT = 0.12; dirtyPanel = false; renderAll(); }
      if ((chipT -= rdt) <= 0) { chipT = 0.25; updateChips(); }
      if ((missT -= rdt) <= 0) { missT = 0.4; mission?.update(); }
    },
  };

  // ------------------------------------------------------------------ initial state
    layoutParents();
  if (startPreset === "eyes" && lens.atLeast("y9-10")) { st.mode = "poly"; st.poly.trait = "eyes"; }
  setMode(st.mode, true);
  return level;
}
