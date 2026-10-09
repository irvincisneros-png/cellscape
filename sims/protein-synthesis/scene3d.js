// 3D scene for the "DNA to protein" level: nucleus (DNA helix + RNA polymerase), the nuclear envelope with a pore,
// and the cytoplasm (mRNA on a ribosome with A/P/E sites, tRNAs, the growing polypeptide). The level (level.js)
// owns the state machine from the reviewed 2D sim; this file only turns that state into geometry each frame.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import * as M from "./model.js";
import { glass, physical, paint, wobble, softDot, specks } from "../../assets/js/world/materials.js";
import { Helix, NucRenderer, Floaters, nucleotideMesh, COL, RISE, PURINE, _mat } from "../../assets/js/world/levels/dnaHelix.js";

export const UPL = M.UPSTREAM.length;
export const GENE_MAX = 48, GENE_MIN = 6;
export const NT2 = 0.62;                                  // nucleotide spacing on the mRNA at the ribosome
export const MX0 = 9.5;                                   // x of the first mRNA nucleotide at the ribosome
const DNA_AT = new THREE.Vector3(-18, -0.5, 0), DNA_S = 1.5;
export const PORE = new THREE.Vector3(3.9, 7.2, 0);
const RIBO_COL = "#7c96ee", TRNA_COL = "#ec6fae";
const K_clampI = (v, a, b) => Math.max(a, Math.min(b, v));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const RIBOSE = COL.ribose, RNA_LINK = COL.rnaLink;

// ---------- molecule builders ----------
function capsule(r, len, x, y, z, rz, color) {
  const g = new THREE.CapsuleGeometry(r, len, 4, 10);
  g.rotateZ(rz); g.translate(x, y, z);
  return paint(g, color);
}
function boxAt(w, h, d, x, y, z, color) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return paint(g, color); }

/** tRNA (simplified L shape): anticodon slabs at the bottom (pairing with the codon below), amino acid on top. */
export function makeTRNA(codon, aa) {
  const anti = M.anticodonOf(codon);
  const parts = [
    capsule(0.3, 1.4, 0, 2.2, 0, 0, TRNA_COL),
    capsule(0.25, 0.85, -0.55, 3.15, 0, 1.2, "#d9579a"),
    capsule(0.15, 0.45, 0.2, 3.45, 0, -0.35, "#f9a8d4"),
    (() => { const g = new THREE.TorusGeometry(0.42, 0.13, 8, 18); g.translate(0, 1.42, 0); return paint(g, TRNA_COL); })(),
    boxAt(2 * NT2 + 0.42, 0.1, 0.14, 0, 1.2, 0, TRNA_COL),
  ];
  for (let j = 0; j < 3; j++) parts.push(boxAt(0.42, 0.46, 0.13, (j - 1) * NT2, 0.95, 0, M.BASE_COL[anti[j]]));
  const g = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  const grp = new THREE.Group();
  const body = new THREE.Mesh(g, _vcMat());
  grp.add(body);
  const aaM = new THREE.Mesh(_sphere, _mat(M.aaCol(aa)));
  aaM.scale.setScalar(0.4); aaM.position.set(0.32, 4.02, 0);
  grp.add(aaM);
  grp.userData.aa = aaM;
  return grp;
}
let _vc;
function _vcMat() { if (!_vc) { _vc = physical("#ffffff", { vertexColors: true, roughness: 0.35, clearcoat: 0.7 }); _vc.userData.shared = true; } return _vc; }
const _sphere = new THREE.SphereGeometry(1, 18, 14); _sphere.userData.shared = true;

export function makeRF() {
  const g = wobble(new THREE.IcosahedronGeometry(0.8, 3), 0.08, 3.2, 7);
  g.translate(0, 1.6, 0);
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(g, _mat("#2dd4bf")));
  return grp;
}

export class ExprScene {
  constructor(engine, labelLayer) {
    this.engine = engine;
    this.labelLayer = labelLayer;
    this.root = new THREE.Group();
    this.pickables = [];
    this._v = new THREE.Vector3(); this._w = new THREE.Vector3(); this._u = new THREE.Vector3();
    this._P = new THREE.Vector3(); this._B = new THREE.Vector3(); this._Y = new THREE.Vector3(0, 1, 0);
    this._M = new THREE.Matrix4(); this._Q = new THREE.Quaternion(); this._C = new THREE.Color();

    // nucleus: DNA
    this.dnaG = new THREE.Group();
    this.dnaG.position.copy(DNA_AT); this.dnaG.scale.setScalar(DNA_S);
    this.root.add(this.dnaG);
    this.helix = new Helix(UPL + GENE_MAX + M.DOWNSTREAM.length);
    this.dnaG.add(this.helix.group);
    this.helix.setDetail(true);
    this.pol = new THREE.Mesh(wobble(new THREE.SphereGeometry(1, 40, 28), 0.05, 2.6, 3), glass("#7c5cd6", { rim: "#c4b5fd", rimStrength: 0.7, minAlpha: 0.05, maxAlpha: 0.45 }));
    this.pol.scale.set(3.4, 2.5, 2.3);
    this.pol.userData.kind = "pol";
    this.dnaG.add(this.pol);
    this.slot = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: "#fbbf24", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.slot.scale.setScalar(1.1);
    this.dnaG.add(this.slot);
    this.pool1 = new Floaters(engine, this.dnaG);
    this.pool1.size.set(2.4, 0.5, 0.6); this.pool1.minGap = 0.9;

    // nuclear envelope (double membrane, seen edge-on from the front) with one pore
    const envMat = glass("#a78bfa", { rim: "#c4b5fd", rimStrength: 0.45, rimPower: 2.4, minAlpha: 0.02, maxAlpha: 0.3, side: THREE.DoubleSide });
    for (const dx of [-0.45, 0.45]) {
      const g = new THREE.PlaneGeometry(13, 30, 1, 24);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, -0.004 * y * y); }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, envMat);
      m.rotation.y = Math.PI / 2; m.position.set(PORE.x + dx, 2, -6);
      this.root.add(m);
    }
    const pore = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.38, 14, 32), physical("#7c6fd6", { emissive: new THREE.Color("#4c1d95"), emissiveIntensity: 0.5 }));
    pore.rotation.y = Math.PI / 2; pore.position.copy(PORE);
    pore.userData.kind = "pore";
    this.root.add(pore);
    this.pore = pore;

    // cytoplasm: mRNA, ribosome, tRNAs, polypeptide
    this.mrna = new NucRenderer(GENE_MAX + 12, { slabW: 0.4 });
    this.root.add(this.mrna.group);
    this.cap = new THREE.Mesh(_sphere, _mat("#86efac")); this.cap.scale.setScalar(0.3);
    this.polyA = new THREE.InstancedMesh(_sphere, _mat(M.BASE_COL.A), 8);
    this.polyA.frustumCulled = false;
    this.root.add(this.cap, this.polyA);
    const sub = (rx, ry, rz, seed, col) => {
      const m = new THREE.Mesh(wobble(new THREE.SphereGeometry(1, 48, 32), 0.07, 2.4, seed), glass(col, { rim: "#c7d2fe", rimStrength: 0.75, minAlpha: 0.14, maxAlpha: 0.78 }));
      m.scale.set(rx, ry, rz); m.userData.kind = "ribo";
      this.root.add(m);
      return m;
    };
    this.large = sub(3.4, 2.3, 2.5, 11, RIBO_COL);
    this.small = sub(3.0, 1.15, 2.3, 5, "#94a8f2");
    this.pool2 = new Floaters(engine, this.root);
    this.pool2.size.set(4.2, 0.4, 0.6); this.pool2.minGap = 2.1;
    this.beads = new THREE.InstancedMesh(_sphere, physical("#ffffff", { roughness: 0.3, clearcoat: 1 }), GENE_MAX);
    this.links = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 8), physical("#e2e8f0", { roughness: 0.4 }), GENE_MAX);
    for (const im of [this.beads, this.links]) { im.frustumCulled = false; im.count = 0; for (let i = 0; i < GENE_MAX; i++) im.setColorAt(i, new THREE.Color("#ffffff")); this.root.add(im); }
    this.beads.userData.kind = "chain";
    this.glow = new THREE.Mesh(_sphere, new THREE.MeshBasicMaterial({ color: "#5eead4", transparent: true, opacity: 0.045, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.glow.userData.kind = "portal";
    this.glow.visible = false;
    this.root.add(this.glow);
    this.glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: "#5eead4", transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.root.add(this.glowSprite);

    const sp = specks(240, 0.2, [80, 36, 40], ["#a78bfa", "#5eead4", "#f9a8d4", "#93c5fd"], 0.4);
    sp.position.set(-4, 2, -14);
    this.root.add(sp);
    this.specks = sp;

    this.pickables.push(this.helix.R.B, this.pol, this.large, this.small, this.beads, this.glow, pore);
    this.basePick = this.pickables.length;
    this.buildLabels();
    this.mPos = Array.from({ length: GENE_MAX + 2 }, () => new THREE.Vector3());
    this.mDir = Array.from({ length: GENE_MAX + 2 }, () => new THREE.Vector3());
    this.tailPos = Array.from({ length: GENE_MAX + 2 }, () => new THREE.Vector3());
    this.buildPath(M.ORIGINAL_GENE.length);
  }

  buildLabels() {
    const mk = (cls, html = "") => { const d = document.createElement("div"); d.className = `lbl3d ${cls}`; d.innerHTML = html; this.labelLayer.appendChild(d); return d; };
    this.mk = mk;
    this.L = {
      pol: mk("ps3"), ribo: mk("ps3"), mrna: mk("ps3"), nuc: mk("pszone"), cyto: mk("pszone"), env: mk("ps3 small"),
      chain: mk("dive"), cap: mk("ps3 small"), polyA: mk("ps3 small"), coding: mk("ps3 small"), template: mk("ps3 small"),
      prom: mk("ps3 small"), E: mk("site"), P: mk("site"), A: mk("site"),
    };
    this.codonL = Array.from({ length: 17 }, () => mk("codon"));
  }

  // ---------- coordinates ----------
  codonX(t2, c) { return MX0 + (t2.start + 3 * c + 1) * NT2; }
  dnaWorld(local, out) { return this.dnaG.localToWorld(out.copy(local)); }
  place(el, v, dx, dy) { return this.engine.place(el, v, dx, dy); }

  /** export path: nucleus → pore → round to the right-hand end of the ribosome track → leftwards along it */
  buildPath(len) {
    const Lm = (len - 1) * NT2;
    const cr = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-9, 7.5, 0.5), new THREE.Vector3(-2, 8, 0.3), PORE.clone(), new THREE.Vector3(8, 8.5, 0.5),
      new THREE.Vector3(MX0 + Lm + 3.5, 4.5, 0.6), new THREE.Vector3(MX0 + Lm + 1.2, 0.6, 0.2), new THREE.Vector3(MX0 + Lm, 0, 0),
    ], false, "centripetal");
    this.path = new THREE.CurvePath();
    this.path.add(cr);
    this.path.add(new THREE.LineCurve3(new THREE.Vector3(MX0 + Lm, 0, 0), new THREE.Vector3(MX0, 0, 0)));
    this.pathLen = this.path.getLength();
    this.pathFor = len;
  }
  pathPoint(u, out) {
    if (u <= 0) { const p0 = this.path.getPointAt(0); return out.copy(p0).add(this._u.set(u, 0, 0)); }
    return out.copy(this.path.getPointAt(Math.min(1, u / this.pathLen)));
  }

  setGene(gene) {
    const seq = M.UPSTREAM + gene + M.DOWNSTREAM;
    if (seq !== this.helix.seq) this.helix.setSeq(seq);
  }

  // ---------- act 1: transcription ----------
  /** tail (released mRNA in the nucleus) positions in world space for gene indices < count */
  tailLayout(t1, gene, count, hybridStart) {
    const h = this.helix, j = UPL + Math.max(0, hybridStart) - 1;
    const E = this.dnaWorld(this._v.set(h.bpX(Math.max(0, j)), 1.2, 0.5), this._w);
    for (let n = 0; n < count; n++) {
      const k = count - 1 - n;
      this.tailPos[n].set(E.x - 0.26 * k - 0.004 * k * k, E.y + 0.36 * k - 0.0045 * k * k, E.z + 0.7 * Math.sin(k * 0.33));
    }
  }

  updateAct1(S, gene, t, ui) {
    const h = this.helix, t1 = S.t1, G = gene.length;
    this.setGene(gene);
    const a = UPL + t1.polA;
    const busy = t1.phase === "ready" || t1.phase === "elong" || t1.phase === "term";
    // bubble
    for (let j = 0; j < h.n; j++) {
      let o = 0;
      if (busy) o = smooth(a - 11, a - 8.5, j) * (1 - smooth(a + 1, a + 3, j)) * t1.openF;
      if (Math.abs(o - h.open[j]) > 1e-4) { h.open[j] = o; h.off0[j] = 1.35 * o; h.off1[j] = -0.35 * o; h.dirty = true; }
    }
    // RNA–DNA hybrid (≈8 nt) inside the polymerase; earlier nucleotides have peeled off as the mRNA tail
    const HY = busy ? Math.round(8 * (1 - t1.relF)) : 0;
    const pl = t1.phase === "export" || t1.phase === "exported" ? G : t1.placed;
    const h0 = Math.max(0, pl - HY);
    for (let j = 0; j < h.n; j++) {
      const gi = j - UPL;
      const want = busy && gi >= h0 && gi < pl ? M.toRNA(gene[gi]) : "";
      if (h.nb[1][j] !== want) { h.nb[1][j] = want; h.nbCol[1][j] = RIBOSE; h.nbLink[1][j] = RNA_LINK; h.dirty = true; }
    }
    h.build();
    // polymerase
    this.pol.visible = t1.polLift < 0.99 && (t1.phase !== "export" && t1.phase !== "exported");
    this.pol.position.set(h.bpX(a - 3.5), 0.35 + t1.polLift * 3, 0);
    this.pol.material.opacity = 1 - t1.polLift;
    // slot
    const canPlace = (t1.phase === "ready" || t1.phase === "elong") && t1.placed < G;
    this.slot.visible = canPlace;
    if (canPlace) { h.partnerPos(UPL + t1.placed, 1, this.slot.position); this.slot.material.opacity = 0.5 + 0.4 * Math.sin(t * 5); }
    const portrait = this.engine.camera.aspect < 0.8;
    this.pool1.center.copy(h.partnerPos(Math.min(h.n - 1, UPL + t1.placed), 1, this._v)).add(this._w.set(portrait ? 0 : 1.6, portrait ? -2.3 : -1.8, 2.4));
    this.pool1.size.set(portrait ? 1.5 : 2.4, portrait ? 0.7 : 0.5, 0.6);
    // mRNA
    let n = 0;
    if (t1.phase === "export" || t1.phase === "exported") {
      if (this.pathFor !== G) this.buildPath(G);
      this.tailLayout(t1, gene, G, G);
      const E = t1.phase === "exported" ? 1 : clamp(t1.phaseT / 3.4, 0, 1);
      const gather = smooth(0, 0.18, E), s = smooth(0.12, 1, E) * this.pathLen;
      for (let i = 0; i < G; i++) {
        this.pathPoint(Math.min(s - i * NT2, this.pathLen - i * NT2), this._v);
        this.mPos[i].lerpVectors(this.tailPos[i], this._v, gather);
      }
      n = G;
    } else {
      this.tailLayout(t1, gene, h0, h0);
      for (let i = 0; i < h0; i++) this.mPos[i].copy(this.tailPos[i]);
      n = h0;
    }
    this.drawRNA(gene, n, ui.processing && (t1.phase !== "ready" && t1.phase !== "elong"));
    return n;
  }

  /** draw the free mRNA strand from this.mPos[0..n) */
  drawRNA(gene, n, processing) {
    const R = this.mrna, Z = this._u.set(0, 0, 1);
    R.begin();
    const T = this._w, D = this._v, P = this._P, B = this._B;
    for (let i = 0; i < n; i++) {
      const a = this.mPos[Math.max(0, i - 1)], b = this.mPos[Math.min(n - 1, i + 1)];
      T.subVectors(b, a); if (T.lengthSq() < 1e-6) T.set(1, 0, 0); T.normalize();
      D.crossVectors(Z, T).normalize();
      this.mDir[i].copy(D);
      const S = this.mPos[i], base = M.toRNA(gene[i]);
      if (i > 0) P.addVectors(S, this.mPos[i - 1]).multiplyScalar(0.5).addScaledVector(D, -0.22);
      else P.copy(S).addScaledVector(T, -0.3).addScaledVector(D, -0.2);
      R.phos(P, COL.phosphate, 0.12);
      R.sugar(S, RIBOSE, T, 0.16);
      R.link(S, P, RNA_LINK, 0.055);
      if (i > 0) R.link(P, this.mPos[i - 1], RNA_LINK, 0.055);
      B.copy(S).addScaledVector(D, 0.12);
      R.base(B, D, PURINE[base] ? 0.5 : 0.4, T, M.BASE_COL[base], { n: i });
    }
    R.end();
    // 5′ cap and poly-A tail (Year 11+ processing)
    const show = processing && n > 1;
    this.cap.visible = show;
    this.polyA.visible = show;
    if (show) {
      this.cap.position.copy(this.mPos[0]).addScaledVector(T.subVectors(this.mPos[0], this.mPos[1]).normalize(), 0.45);
      T.subVectors(this.mPos[n - 1], this.mPos[n - 2]).normalize();
      const m = this._M;
      for (let k = 0; k < 8; k++) {
        P.copy(this.mPos[n - 1]).addScaledVector(T, 0.45 + k * 0.36);
        P.y += Math.sin(k * 1.3) * 0.12;
        m.makeScale(0.15, 0.15, 0.15).setPosition(P);
        this.polyA.setMatrixAt(k, m);
      }
      this.polyA.instanceMatrix.needsUpdate = true;
    }
  }

  // ---------- act 2: translation ----------
  updateAct2(S, t, dt, ui) {
    const t2 = S.t2, G = t2.gene.length;
    for (let i = 0; i < G; i++) this.mPos[i].set(MX0 + i * NT2, 0, 0);
    this.drawRNA(t2.gene, G, ui.processing);
    const okStart = t2.start >= 0;
    const ribX = okStart ? this.codonX(t2, t2.rk) : MX0;
    this.ribX = ribX;
    const smallIn = t2.small, largeIn = t2.large, sep = t2.sep;
    this.small.visible = smallIn > 0.01;
    this.large.visible = largeIn > 0.01;
    this.small.position.set(ribX - (1 - smallIn) * 7, -1.25 - sep * 2.5, 0);
    this.small.material.opacity = smallIn * (1 - sep * 0.8);
    this.large.position.set(ribX, 2.55 + (1 - largeIn) * 6 + sep * 3.5, -0.2);
    this.large.material.opacity = largeIn * (1 - sep * 0.8);
    // bound tRNAs / release factor
    for (const b of t2.bound) {
      if (!b.obj) continue;
      const x = this.codonX(t2, b.c), l = Math.max(0, b.leave);
      b.obj.position.set(x - l * 1.6, l * 3.2, l * 2.2);
      b.obj.scale.setScalar(Math.max(0.001, 1 - l));
      b.obj.rotation.z = l * 0.5;
      if (b.obj.userData.aa) b.obj.userData.aa.visible = b.charged;
    }
    if (t2.rfObj) { t2.rfObj.position.set(this.codonX(t2, t2.k + 1), 0, 0); t2.rfObj.visible = t2.rfBound; }
    const portrait = this.engine.camera.aspect < 0.8;
    this.pool2.center.set(ribX + (portrait ? 0.8 : 2.2), -4.7, 3.4);
    this.pool2.size.x = portrait ? 2.6 : 4.2;
    this.stepChain(t2, dt, t);
    this.drawChain(t2, t);
  }

  aaPos(t2, c, out) { return out.set(this.codonX(t2, c) + 0.32, 4.02, 0); }

  stepChain(t2, dt, t) {
    const ch = t2.chain;
    if (!ch.length || dt === 0) return;
    const BL = 0.88, ribX = this.ribX;
    let anchor = null;
    if (t2.chainOn !== null) {
      const b = t2.bound.find((q) => q.c === t2.chainOn);
      anchor = this.aaPos(t2, t2.chainOn, this._v);
      if (b && b.leave >= 0) anchor = null;
      if (t2.phase === "bond" && anchor) {
        const e = smooth(0, 0.6, t2.phaseT);
        const to = this.aaPos(t2, t2.k + 1, this._w);
        anchor.lerp(to.add(this._u.set(-0.3, 0.35, 0)), e);
      }
    }
    const exit = this._u.set(ribX - 0.9, 5.3, -0.2);
    const still = this.engine.reducedMotion;
    for (let i = 0; i < ch.length; i++) {
      const p = ch[i].p;
      if (i === 0 && anchor) { p.lerp(anchor, Math.min(1, dt * 12)); continue; }
      if (anchor && i <= 2) {
        const gx = anchor.x + (exit.x - anchor.x) * (i / 2.5), gy = anchor.y + (exit.y - anchor.y) * (i / 2.5);
        p.x += (gx - p.x) * Math.min(1, dt * 6); p.y += (gy - p.y) * Math.min(1, dt * 6); p.z += (exit.z - p.z) * Math.min(1, dt * 6);
      } else if (anchor) {
        p.y += 0.55 * dt; p.x -= 0.15 * dt;
        if (!still) { p.x += Math.sin(t * 1.3 + i * 1.7) * 0.25 * dt; p.z += Math.cos(t * 1.1 + i * 2.3) * 0.3 * dt; }
        if (p.y < 5.0) p.y += (5.0 - p.y) * Math.min(1, dt * 4);
      } else {
        // released: drift up and away from the ribosome
        const tx = ribX - 1.2, ty = 8.2;
        let cx = 0, cy = 0;
        for (const q of ch) { cx += q.p.x; cy += q.p.y; }
        cx /= ch.length; cy /= ch.length;
        p.x += (tx - cx) * dt * 0.8; p.y += (ty - cy) * dt * 0.8;
        if (!still) { p.x += Math.sin(t * 0.9 + i * 1.7) * 0.2 * dt; p.z += Math.cos(t * 0.8 + i * 2.1) * 0.2 * dt; }
      }
    }
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < ch.length; i++) {
        const a = ch[i - 1].p, b = ch[i].p;
        const d = this._w.subVectors(b, a), l = d.length() || 1e-3;
        const k = (l - BL) / l;
        if (anchor) b.addScaledVector(d, -k);
        else { a.addScaledVector(d, k * 0.5); b.addScaledVector(d, -k * 0.5); }
      }
      for (let i = 0; i < ch.length; i++) for (let j = i + 2; j < ch.length; j++) {
        const a = ch[i].p, b = ch[j].p, d = this._w.subVectors(b, a), l = d.length();
        if (l > 1e-4 && l < 0.82) { d.multiplyScalar((0.82 - l) / l * 0.5); if (!(anchor && i === 0)) a.sub(d); b.add(d); }
      }
    }
  }

  drawChain(t2, t) {
    const ch = t2.chain, m = this._M, c = this._C;
    for (let i = 0; i < ch.length; i++) {
      m.makeScale(0.38, 0.38, 0.38).setPosition(ch[i].p);
      this.beads.setMatrixAt(i, m); this.beads.setColorAt(i, c.set(M.aaCol(ch[i].a)));
    }
    this.beads.count = ch.length;
    this.beads.instanceMatrix.needsUpdate = true; if (this.beads.instanceColor) this.beads.instanceColor.needsUpdate = true;
    this.beads.boundingSphere = null;
    let k = 0;
    const y = this._Y, d = this._B, q = this._Q, s = this._P;
    for (let i = 1; i < ch.length; i++) {
      d.subVectors(ch[i].p, ch[i - 1].p); const l = d.length();
      q.setFromUnitVectors(y, d.normalize());
      m.compose(s.addVectors(ch[i].p, ch[i - 1].p).multiplyScalar(0.5), q, this._w.set(0.09, l, 0.09));
      this.links.setMatrixAt(k++, m);
    }
    this.links.count = k; this.links.instanceMatrix.needsUpdate = true;
    // released chain glows: it is the portal to the folding level
    const free = t2.released && ch.length > 0 && (t2.phase === "done" || t2.phase === "stall");
    this.glow.visible = free;
    this.glowSprite.visible = free;
    if (free) {
      const cen = this.chainCenter(t2, this._v);
      let r = 1.2;
      for (const b of ch) r = Math.max(r, b.p.distanceTo(cen) + 0.6);
      this.glow.position.copy(cen); this.glow.scale.setScalar(r);
      this.glowSprite.position.copy(cen); this.glowSprite.scale.setScalar(r * 3.2);
      this.glowSprite.material.opacity = 0.35 + 0.15 * Math.sin(t * 2.4);
      this.glowR = r;
    }
  }
  chainCenter(t2, out) {
    out.set(0, 0, 0);
    for (const b of t2.chain) out.add(b.p);
    return out.multiplyScalar(1 / Math.max(1, t2.chain.length));
  }

  refreshPick() {
    const P = this.pickables;
    P.length = this.basePick;
    this.pool1.meshes(this._m1 ||= []); this.pool2.meshes(this._m2 ||= []);
    P.push(...this._m1, ...this._m2);
  }

  // ---------- labels ----------
  labels(S, ui) {
    const L = this.L, band = ui.band, show = ui.labels, pick = ui.pick;
    const hide = (el) => (el.style.display = "none");
    const v = this._v;
    const act1 = S.act === 1, t1 = S.t1, t2 = S.t2;
    // zones
    if (show) {
      L.nuc.textContent = pick(ui.names.nuc).toUpperCase(); this.place(L.nuc, v.set(-7, 9.5, -3));
      L.cyto.textContent = pick(ui.names.cyto).toUpperCase(); this.place(L.cyto, v.set(12, 9.5, -3));
      L.env.textContent = pick(ui.names.env); this.place(L.env, v.copy(PORE).add(this._w.set(0, 2.1, 0)));
    } else [L.nuc, L.cyto, L.env].forEach(hide);
    // polymerase / strands
    if (show && act1 && this.pol.visible) { L.pol.textContent = pick(ui.names.pol); this.place(L.pol, this.dnaWorld(v.copy(this.pol.position).add(this._w.set(0, 2.9, 0)), this._u)); } else hide(L.pol);
    const h = this.helix;
    if (show && act1 && band !== "y7-8") {
      L.coding.textContent = band === "y9-10" ? "coding strand 5′→3′" : "coding strand 5′ → 3′";
      L.template.textContent = band === "y9-10" ? "template strand 3′→5′" : "template strand 3′ ← 5′ (read 3′→5′)";
      const jl = K_clampI(Math.round(UPL + t1.polA - 7), 0, h.n - 1);
      this.place(L.coding, this.dnaWorld(h.sugarPos(jl, 0, v).add(this._w.set(0, 1.0, 0)), this._u));
      this.place(L.template, this.dnaWorld(h.sugarPos(jl, 1, v).add(this._w.set(0, -1.0, 0)), this._u));
      L.prom.textContent = band === "y9-10" ? "promoter" : "promoter (TATA box)";
      this.place(L.prom, this.dnaWorld(v.set(h.bpX(UPL / 2), -2.7, 0), this._u));
    } else [L.coding, L.template, L.prom].forEach(hide);
    // mRNA label
    const mN = ui.mrnaN || 0;
    if (show && mN > 2) { L.mrna.textContent = pick(ui.names.mrna) + " 5′"; this.place(L.mrna, v.copy(this.mPos[0]).add(act1 ? this._w.set(-1.4, 1.3, 0) : this._w.set(-2.6, -0.2, 0))); } else hide(L.mrna);
    const proc = ui.processing && this.cap.visible && show;
    if (proc) { L.cap.textContent = "5′ cap"; this.place(L.cap, v.copy(this.cap.position).add(this._w.set(-0.3, act1 ? 0.6 : -0.9, 0))); L.polyA.textContent = "poly-A tail"; this.place(L.polyA, v.copy(this.mPos[Math.max(0, mN - 1)]).add(this._w.set(1.5, -0.7, 0))); }
    else [L.cap, L.polyA].forEach(hide);
    // ribosome
    const a2 = !act1 && t2 && t2.start >= 0;
    if (show && a2 && this.large.visible) { L.ribo.textContent = pick(ui.names.ribo); this.place(L.ribo, v.set(this.ribX + 2.6, 4.4, 0)); } else hide(L.ribo);
    for (const [k, dc] of [["E", -1], ["P", 0], ["A", 1]]) {
      const el = L[k];
      if (show && a2 && this.large.visible && t2.large > 0.9 && band !== "y7-8" && t2.sep < 0.1) { el.textContent = k; this.place(el, v.set(this.codonX(t2, t2.k + dc), 1.55, 2.6)); }
      else hide(el);
    }
    // codons
    let n = 0;
    if (show && a2) {
      const cur = ["needP", "init"].includes(t2.phase) ? 0 : t2.k + 1;
      for (let c = 0; c < t2.tr.codons.length && n < this.codonL.length; c++) {
        const el = this.codonL[n++], cod = t2.tr.codons[c];
        const txt = band === "y7-8" ? cod : `${cod}${M.CODE[cod] === "*" ? " stop" : ""}`;
        if (el.textContent !== txt) el.textContent = txt;
        el.classList.toggle("hl", c === cur && !["done", "stall", "release"].includes(t2.phase));
        el.classList.toggle("stop", M.CODE[cod] === "*");
        this.place(el, v.set(this.codonX(t2, c), -0.75, 2.45));
      }
    }
    for (let k = n; k < this.codonL.length; k++) hide(this.codonL[k]);
    // released chain → folding portal
    if (show && !act1 && this.glow.visible) { L.chain.textContent = pick({ "y7-8": "🔍 See how this protein folds", "y9-10": "🔍 Dive in: see how this polypeptide folds" }); this.place(L.chain, v.copy(this.glow.position).add(this._w.set(0, this.glowR + 0.5, 0))); }
    else hide(L.chain);
    // pool labels
    for (const it of this.pool1.items) if (it.lbl) { if (show && act1) this.place(it.lbl, this.dnaWorld(v.copy(it.pos).add(this._w.set(0.2, 0.42, 0)), this._u)); else hide(it.lbl); }
    for (const it of this.pool2.items) if (it.lbl) { if (show && !act1) this.place(it.lbl, v.copy(it.pos).add(this._w.set(0, 0.25, 0.3)), 0, 14); else hide(it.lbl); }
  }

  dispose() { this.labelLayer.innerHTML = ""; }
}
void RISE;
