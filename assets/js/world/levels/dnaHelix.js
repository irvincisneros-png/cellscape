// Shared molecular-DNA renderer for the genetics levels (dna, expression).
// B-DNA geometry: right-handed, 10.5 bp per turn, 0.34 nm rise, ~2 nm wide (1 unit = 1 nm in local space).
// Everything repeated is instanced: phosphates (spheres), deoxyribose/ribose (pentagons), bases (slabs),
// backbone links (sticks) and hydrogen bonds (glowing dots), so a whole gene costs a handful of draw calls.
import * as THREE from "three";
import { BASE_COL, DNA_PAIR } from "../../../../sims/protein-synthesis/model.js";
import { physical, softDot } from "../materials.js";

export const RISE = 0.34;                        // nm per base pair
export const TWIST = (Math.PI * 2) / 10.5;       // rad per base pair (10.5 bp per turn)
export const R_P = 1.0;                          // phosphate radius (helix ≈ 2 nm wide)
export const R_S = 0.72;                         // sugar radius
export const GAP = 2.25;                         // angle between the two glycosidic sides (minor groove ≈ 129°)
export const CH0 = 2 * R_S * Math.sin(GAP / 2);  // sugar–sugar chord across a base pair
const HB_GAP = 0.18;                             // gap between paired base tips (where H-bonds are drawn)
export const PURINE = { A: true, G: true };
export const HBONDS = (a, b) => ((a === "G" && b === "C") || (a === "C" && b === "G") ? 3 : 2);
export const COL = {
  phosphate: "#e8803a", sugar: "#c9d6e6", newSugar: "#5eead4", ribose: "#e9d5ff", primer: "#c084fc",
  strand0: "#7aa2c9", strand1: "#a394e0", newLink: "#5eead4", rnaLink: "#c084fc", hbond: "#e0f2fe",
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => t * t * (3 - 2 * t);
const wrapPi = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };

// ---------- instanced nucleotide renderer ----------
const _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
const _d = new THREE.Vector3(), _c = new THREE.Color(), _q = new THREE.Vector3();

export class NucRenderer {
  constructor(cap, o = {}) {
    this.cap = cap;
    this.slabW = o.slabW ?? 0.42;
    this.slabT = o.slabT ?? 0.1;
    this.group = new THREE.Group();
    const sphere = new THREE.SphereGeometry(1, 14, 10);
    const pent = new THREE.CylinderGeometry(1, 1, 0.42, 5); pent.rotateX(Math.PI / 2);
    const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0.5, 0, 0);
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 7, 1);
    const mk = (g, m, n) => {
      const im = new THREE.InstancedMesh(g, m, n);
      im.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < n; i++) im.setColorAt(i, _c.set("#ffffff"));
      im.count = 0;
      this.group.add(im);
      return im;
    };
    this.P = mk(sphere, physical("#ffffff", { roughness: 0.5, clearcoat: 0.4 }), cap);
    this.S = mk(pent, physical("#ffffff", { roughness: 0.35 }), cap);
    this.B = mk(box, physical("#ffffff", { roughness: 0.38, clearcoat: 0.5 }), cap);
    this.L = mk(cyl, physical("#ffffff", { roughness: 0.45, clearcoat: 0.4 }), cap * 2);
    this.B.userData.bases = true;
    this.meta = new Array(cap);
    // hydrogen bonds: dashed glowing dots
    this.hbCap = cap * 9;
    this.hbPos = new Float32Array(this.hbCap * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.hbPos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.H = new THREE.Points(g, new THREE.PointsMaterial({ size: o.hbSize ?? 0.13, map: softDot(), color: COL.hbond, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.H.frustumCulled = false;
    this.group.add(this.H);
    this.linkScale = 1;
  }
  begin() { this.nP = this.nS = this.nB = this.nL = this.nH = 0; }
  phos(p, color, r = 0.13) {
    if (this.nP >= this.cap) return;
    _m.makeScale(r, r, r).setPosition(p);
    this.P.setMatrixAt(this.nP, _m); this.P.setColorAt(this.nP++, _c.set(color));
  }
  sugar(p, color, normal, r = 0.17) {
    if (this.nS >= this.cap) return;
    _z.copy(normal).normalize();
    _x.set(0, 1, 0); if (Math.abs(_z.y) > 0.9) _x.set(1, 0, 0);
    _y.crossVectors(_z, _x).normalize(); _x.crossVectors(_y, _z);
    _m.makeBasis(_x.multiplyScalar(r), _y.multiplyScalar(r), _z.multiplyScalar(r)).setPosition(p);
    this.S.setMatrixAt(this.nS, _m); this.S.setColorAt(this.nS++, _c.set(color));
  }
  /** slab from `start` along unit `dir` for `len`; `up` = the thin axis (helix axis) */
  base(start, dir, len, up, color, meta) {
    if (this.nB >= this.cap) return;
    _x.copy(dir);
    _z.copy(up).addScaledVector(_x, -up.dot(_x)).normalize();
    _y.crossVectors(_z, _x);
    _m.makeBasis(_x.multiplyScalar(len), _y.multiplyScalar(this.slabW), _z.multiplyScalar(this.slabT)).setPosition(start);
    this.meta[this.nB] = meta;
    this.B.setMatrixAt(this.nB, _m); this.B.setColorAt(this.nB++, _c.set(color));
  }
  link(a, b, color, r = 0.05) {
    if (this.nL >= this.cap * 2) return;
    _y.subVectors(b, a); const len = _y.length(); if (len < 1e-5) return;
    _y.multiplyScalar(1 / len);
    _x.set(1, 0, 0); if (Math.abs(_y.x) > 0.9) _x.set(0, 1, 0);
    _z.crossVectors(_x, _y).normalize(); _x.crossVectors(_y, _z);
    r *= this.linkScale;
    _q.addVectors(a, b).multiplyScalar(0.5);
    _m.makeBasis(_x.multiplyScalar(r), _y.multiplyScalar(len), _z.multiplyScalar(r)).setPosition(_q);
    this.L.setMatrixAt(this.nL, _m); this.L.setColorAt(this.nL++, _c.set(color));
  }
  /** n hydrogen bonds between two base tips, spread along `side` */
  hb(a, b, n, side) {
    for (let k = 0; k < n; k++) {
      const off = (k - (n - 1) / 2) * 0.13;
      for (let j = 0; j < 3; j++) {
        if (this.nH >= this.hbCap) return;
        const t = 0.2 + 0.3 * j, i = this.nH++ * 3;
        this.hbPos[i] = a.x + (b.x - a.x) * t + side.x * off;
        this.hbPos[i + 1] = a.y + (b.y - a.y) * t + side.y * off;
        this.hbPos[i + 2] = a.z + (b.z - a.z) * t + side.z * off;
      }
    }
  }
  end() {
    for (const [im, n] of [[this.P, this.nP], [this.S, this.nS], [this.B, this.nB], [this.L, this.nL]]) {
      im.count = n; im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.boundingSphere = null;
    }
    this.H.geometry.setDrawRange(0, this.nH);
    this.H.geometry.attributes.position.needsUpdate = true;
  }
  /** dim a part: "P" | "S" | "B" | "L" | "H" */
  setOpacity(part, a) {
    const m = this[part].material;
    const tr = a < 0.999 || part === "H";
    if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
    m.opacity = part === "H" ? 0.95 * a : a;
    m.depthWrite = !tr;
  }
  setGlow(part, color, k) {
    const m = this[part].material;
    if (!m.emissive) return;
    m.emissive.set(color); m.emissiveIntensity = k;
  }
}

// ---------- the double helix ----------
/**
 * A double helix of `cap` base pairs along the local x axis. Strand 0 (the coding strand) runs 5′→3′ towards +x,
 * strand 1 runs antiparallel. Per-bp pose arrays let a level open the helix (helicase, RNA polymerase), lift a
 * strand, and pair new nucleotides onto an exposed template (replication or transcription).
 */
export class Helix {
  constructor(cap, o = {}) {
    this.cap = cap;
    this.R = new NucRenderer(cap * 4, o);
    this.group = this.R.group;
    this.twist = 1;
    this.open = new Float32Array(cap);     // 0 paired helix … 1 separated, untwisted
    this.off0 = new Float32Array(cap);     // extra y-offset of strand 0 / strand 1
    this.off1 = new Float32Array(cap);
    this.nb = [new Array(cap).fill(""), new Array(cap).fill("")];      // new partner base on each strand ("" = none)
    this.nbCol = [new Array(cap).fill(COL.newSugar), new Array(cap).fill(COL.newSugar)];
    this.nbLink = [new Array(cap).fill(COL.newLink), new Array(cap).fill(COL.newLink)];
    this.nick = [new Uint8Array(cap), new Uint8Array(cap)];           // no backbone link between i and its 3′ neighbour
    this.S = [new Float32Array(cap * 3), new Float32Array(cap * 3)];   // sugar positions (for labels, picking, atoms)
    this.D = [new Float32Array(cap * 3), new Float32Array(cap * 3)];   // base directions
    this.hideBP = -1;
    this.dim = {};
    this.seq = "";
    this.n = 0;
    this.dirty = true;
    this.pairHB = true;
    // strand-direction arrows
    const cone = new THREE.ConeGeometry(0.16, 0.42, 10);
    this.arrows = new THREE.InstancedMesh(cone, new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.9, depthWrite: false }), Math.ceil(cap / 5) * 2 + 4);
    this.arrows.frustumCulled = false;
    for (let i = 0; i < this.arrows.count; i++) this.arrows.setColorAt(i, _c.set("#ffffff"));
    this.arrows.visible = false;
    this.group.add(this.arrows);
  }
  setSeq(seq) {
    this.seq = seq; this.n = Math.min(seq.length, this.cap);
    this.x0 = -((this.n - 1) * RISE) / 2;
    this.open.fill(0); this.off0.fill(0); this.off1.fill(0);
    this.nb[0].fill(""); this.nb[1].fill(""); this.nick[0].fill(0); this.nick[1].fill(0);
    this.dirty = true;
  }
  bpX(i) { return this.x0 + i * RISE; }
  base(i, s) { const b = this.seq[i]; return s ? DNA_PAIR[b] : b; }
  sugarPos(i, s, out) { const a = this.S[s]; return out.set(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]); }
  baseDir(i, s, out) { const a = this.D[s]; return out.set(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]); }
  /** where a new partner nucleotide's sugar sits opposite strand s at bp i */
  partnerPos(i, s, out) { this.sugarPos(i, s, out); return out.addScaledVector(this.baseDir(i, s, _d), CH0); }
  mid(i, out) { return this.sugarPos(i, 0, out).add(this.sugarPos(i, 1, _d)).multiplyScalar(0.5); }

  /** strand angle for bp i (helix pose blended to a flat ladder by `open`) */
  _angle(i, s, o) {
    const tw = this.twist, gap = Math.PI + (GAP - Math.PI) * tw;
    const a0 = i * TWIST * tw + (Math.PI - gap) / 2;
    const aH = s ? a0 + gap : a0, aL = s ? Math.PI : 0;
    return aH + wrapPi(aL - aH) * o;
  }

  build() {
    if (!this.dirty) return;
    this.dirty = false;
    const R = this.R, n = this.n, tw = this.twist, AX = _AX;
    R.begin();
    // pass 1: sugar/phosphate positions and base directions
    for (let i = 0; i < n; i++) {
      const o = this.open[i], x = this.bpX(i);
      for (let s = 0; s < 2; s++) {
        const a = this._angle(i, s, o), off = s ? this.off1[i] : this.off0[i];
        const S = this.S[s];
        S[i * 3] = x; S[i * 3 + 1] = R_S * Math.cos(a) + off; S[i * 3 + 2] = R_S * Math.sin(a);
      }
    }
    for (let i = 0; i < n; i++) {
      const o = this.open[i];
      _s0.fromArray(this.S[0], i * 3); _s1.fromArray(this.S[1], i * 3);
      _dc.subVectors(_s1, _s0).normalize();
      for (let s = 0; s < 2; s++) {
        _dd.set(0, s ? 1 : -1, 0);
        _dt.copy(_dc).multiplyScalar(s ? -1 : 1).lerp(_dd, o).normalize().toArray(this.D[s], i * 3);
      }
    }
    // pass 2: emit geometry
    for (let i = 0; i < n; i++) {
      const o = this.open[i], x = this.bpX(i);
      const chord = _s0.fromArray(this.S[0], i * 3).distanceTo(_s1.fromArray(this.S[1], i * 3));
      const CHe = chord + (CH0 - chord) * clamp(o * 1.5, 0, 1);
      const tips = [_t0, _t1];
      for (let s = 0; s < 2; s++) {
        const S = _sv.fromArray(this.S[s], i * 3), dir = _dv.fromArray(this.D[s], i * 3);
        const b = this.base(i, s), off = s ? this.off1[i] : this.off0[i];
        const a = this._angle(i, s, o);
        // phosphate on this nucleotide's 5′ side
        const sgn = s ? -1 : 1;
        const pa = a - sgn * TWIST * tw * 0.5 * (1 - o);
        _p.set(x - sgn * RISE * 0.5, R_P * Math.cos(pa) + off, R_P * Math.sin(pa));
        R.phos(_p, COL.phosphate);
        R.sugar(S, COL.sugar, AX);
        R.link(S, _p, s ? COL.strand1 : COL.strand0);
        // link phosphate to the previous (5′-side) sugar
        const j = i - sgn;
        if (j >= 0 && j < n && !this.nick[s][Math.min(i, j)]) R.link(_p, _q2.fromArray(this.S[s], j * 3), s ? COL.strand1 : COL.strand0);
        const frac = PURINE[b] ? 0.57 : 0.43;
        const len = Math.max(0.1, frac * (CHe - 0.24 - HB_GAP));
        _bs.copy(S).addScaledVector(dir, 0.12);
        tips[s].copy(_bs).addScaledVector(dir, len);
        if (i !== this.hideBP) R.base(_bs, dir, len, AX, BASE_COL[b], { i, s });
        // a new partner nucleotide paired onto this (exposed) strand
        const nb = this.nb[s][i];
        if (nb) {
          _ps.copy(S).addScaledVector(dir, CH0);
          const pfrac = PURINE[nb] ? 0.57 : 0.43;
          const plen = pfrac * (CH0 - 0.24 - HB_GAP);
          const len2 = (PURINE[b] ? 0.57 : 0.43) * (CH0 - 0.24 - HB_GAP);
          _t2.copy(S).addScaledVector(dir, 0.12 + len2);
          _bs.copy(_ps).addScaledVector(dir, -0.12);
          _nd.copy(dir).negate();
          R.base(_bs, _nd, plen, AX, BASE_COL[nb], { i, s: s + 2 });
          R.sugar(_ps, this.nbCol[s][i], AX);
          _pp.copy(_ps).addScaledVector(dir, 0.28); _pp.x += sgn * RISE * 0.5;
          R.phos(_pp, COL.phosphate);
          R.link(_ps, _pp, this.nbLink[s][i]);
          const k = i + sgn;   // partner strand runs opposite to its template
          if (k >= 0 && k < n && this.nb[s][k] && !this.nick[s][Math.min(i, k)]) {
            _q2.fromArray(this.S[s], k * 3).addScaledVector(_dv2.fromArray(this.D[s], k * 3), CH0);
            R.link(_pp, _q2, this.nbLink[s][i]);
          }
          if (this.pairHB) R.hb(_bs.copy(_ps).addScaledVector(dir, -0.12 - plen), _t2, HBONDS(b, nb), _side(dir));
        }
      }
      if (this.pairHB && o < 0.35 && i !== this.hideBP) R.hb(_t0, _t1, HBONDS(this.seq[i], DNA_PAIR[this.seq[i]]), _side(_dv.fromArray(this.D[0], i * 3)));
    }
    R.end();
    this.buildArrows();
  }

  buildArrows() {
    const A = this.arrows;
    if (!A.visible) return;
    let k = 0;
    for (let s = 0; s < 2; s++) {
      for (let i = 2; i < this.n - 2; i += 5) {
        const ii = s ? i + 2 : i;
        _p.fromArray(this.S[s], ii * 3);
        _q2.fromArray(this.S[s], (s ? ii - 1 : ii + 1) * 3);
        _y.subVectors(_q2, _p).normalize();
        _x.set(_p.x, _p.y, _p.z); _x.x = 0; const rr = _x.length() || 1; _x.multiplyScalar(1 / rr);
        _z.copy(_p).addScaledVector(_x, 0.55).addScaledVector(_y, 0.17);
        _x.set(1, 0, 0); if (Math.abs(_y.x) > 0.95) _x.set(0, 0, 1);
        _zz.crossVectors(_x, _y).normalize(); _x.crossVectors(_y, _zz);
        _m.makeBasis(_x, _y, _zz).setPosition(_z);
        A.setMatrixAt(k, _m); A.setColorAt(k++, _c.set(s ? "#c4b5fd" : "#bae6fd"));
        if (k >= A.instanceMatrix.count) break;
      }
    }
    A.count = k; A.instanceMatrix.needsUpdate = true; if (A.instanceColor) A.instanceColor.needsUpdate = true;
  }

  setArrows(v) { this.arrows.visible = v; this.dirty = true; }
  /** far = thick ribbon only; near = phosphates and sugars visible */
  setDetail(near) {
    if (this._near === near) return;
    this._near = near;
    this.R.P.visible = this.R.S.visible = near;
    this.R.linkScale = near ? 1 : 2.2;
    this.dirty = true;
  }
}
const _AX = new THREE.Vector3(1, 0, 0);
const _s0 = new THREE.Vector3(), _s1 = new THREE.Vector3(), _dc = new THREE.Vector3(), _dd = new THREE.Vector3();
const _sv = new THREE.Vector3(), _dv = new THREE.Vector3(), _dv2 = new THREE.Vector3(), _p = new THREE.Vector3(), _q2 = new THREE.Vector3();
const _bs = new THREE.Vector3(), _t0 = new THREE.Vector3(), _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3();
const _dt = new THREE.Vector3(), _zz = new THREE.Vector3();
const _ps = new THREE.Vector3(), _pp = new THREE.Vector3(), _nd = new THREE.Vector3(), _sd = new THREE.Vector3();
const _side = (dir) => _sd.crossVectors(_AX, dir).normalize();

// ---------- ball-and-stick base pair ----------
const D2R = Math.PI / 180;
/**
 * Approximate planar atom coordinates (nm) of a Watson–Crick pair, purine on the left, pyrimidine on the right,
 * major-groove edge at +y. Hydrogens shown only where they take part in hydrogen bonds.
 */
export function pairAtoms(pur, pyr) {
  const atoms = [], bonds = [], hb = [];
  const add = (el, x, y, name) => (atoms.push({ el, x, y, name }), atoms.length - 1);
  const pol = (cx, r, deg) => [cx + r * Math.cos(deg * D2R), r * Math.sin(deg * D2R)];
  const xu = -0.285, xp = 0.285, B = 0.14;
  // purine 6-ring
  const u = {};
  [["N1", "N", 0], ["C6", "C", 60], ["C5", "C", 120], ["C4", "C", 180], ["N3", "N", 240], ["C2", "C", 300]].forEach(([n, e, a]) => { u[n] = add(e, ...pol(xu, B, a), n); });
  [["N1", "C6"], ["C6", "C5"], ["C5", "C4"], ["C4", "N3"], ["N3", "C2"], ["C2", "N1"]].forEach(([a, b]) => bonds.push([u[a], u[b]]));
  // fused 5-ring on C4–C5
  const c4 = atoms[u.C4], c5 = atoms[u.C5];
  const mx = (c4.x + c5.x) / 2, my = (c4.y + c5.y) / 2;
  let ox = mx - xu, oy = my; const ol = Math.hypot(ox, oy); ox /= ol; oy /= ol;
  const ap = B / (2 * Math.tan(36 * D2R)), R5 = B / (2 * Math.sin(36 * D2R));
  const px = mx + ox * ap, py = my + oy * ap;
  const a5 = Math.atan2(c5.y - py, c5.x - px), a4 = Math.atan2(c4.y - py, c4.x - px);
  const step = -Math.sign(wrapPi(a4 - a5)) * 72 * D2R;
  u.N7 = add("N", px + R5 * Math.cos(a5 + step), py + R5 * Math.sin(a5 + step), "N7");
  u.C8 = add("C", px + R5 * Math.cos(a5 + 2 * step), py + R5 * Math.sin(a5 + 2 * step), "C8");
  u.N9 = add("N", px + R5 * Math.cos(a5 + 3 * step), py + R5 * Math.sin(a5 + 3 * step), "N9");
  bonds.push([u.C5, u.N7], [u.N7, u.C8], [u.C8, u.N9], [u.N9, u.C4]);
  const n9 = atoms[u.N9]; let gx = n9.x - px, gy = n9.y - py; const gl = Math.hypot(gx, gy); gx /= gl; gy /= gl;
  const c1u = { x: n9.x + gx * 0.147, y: n9.y + gy * 0.147 };
  // pyrimidine ring
  const p = {};
  [["N3", "N", 180], ["C4", "C", 120], ["C5", "C", 60], ["C6", "C", 0], ["N1", "N", -60], ["C2", "C", -120]].forEach(([n, e, a]) => { p[n] = add(e, ...pol(xp, B, a), n); });
  [["N3", "C4"], ["C4", "C5"], ["C5", "C6"], ["C6", "N1"], ["N1", "C2"], ["C2", "N3"]].forEach(([a, b]) => bonds.push([p[a], p[b]]));
  const c1p = { x: xp + 0.287 * Math.cos(-60 * D2R), y: 0.287 * Math.sin(-60 * D2R) };
  // exocyclic groups
  const sub = (ring, at, el, r, deg, name, cx) => { const i = add(el, ...pol(cx, r, deg), name); bonds.push([ring[at], i]); return i; };
  const H = (donor, acc) => {
    const d = atoms[donor], a = atoms[acc];
    const l = Math.hypot(a.x - d.x, a.y - d.y);
    const h = add("H", d.x + ((a.x - d.x) / l) * 0.1, d.y + ((a.y - d.y) / l) * 0.1, "H");
    bonds.push([donor, h]); hb.push([h, acc]);
  };
  if (pur === "A") {
    const n6 = sub(u, "C6", "N", 0.274, 60, "N6", xu);
    const o4 = sub(p, "C4", "O", 0.263, 120, "O4", xp);
    sub(p, "C5", "C", 0.29, 60, "CH₃", xp);
    const o2 = sub(p, "C2", "O", 0.263, -120, "O2", xp); void o2;
    H(n6, o4);             // A N6–H ··· O4 T
    H(p.N3, u.N1);         // T N3–H ··· N1 A
  } else {
    const o6 = sub(u, "C6", "O", 0.263, 60, "O6", xu);
    const n2 = sub(u, "C2", "N", 0.274, 300, "N2", xu);
    const n4 = sub(p, "C4", "N", 0.274, 120, "N4", xp);
    const o2 = sub(p, "C2", "O", 0.263, -120, "O2", xp);
    H(n4, o6);             // C N4–H ··· O6 G
    H(u.N1, p.N3);         // G N1–H ··· N3 C
    H(n2, o2);             // G N2–H ··· O2 C
  }
  return { atoms, bonds, hb, c1: [c1u, c1p], glyco: [[u.N9, 0], [p.N1, 1]], purC: { x: xu - 0.05, y: 0 }, pyrC: { x: xp, y: 0 } };
}

const EL_COL = { C: "#8c939c", N: "#3f74d6", O: "#d63f3f", H: "#cfd6de" };
const EL_R = { C: 0.055, N: 0.055, O: 0.055, H: 0.032 };

/** Builds ball-and-stick base-pair groups whose C1′ atoms land on two given sugar positions. */
export class AtomModel {
  constructor() {
    this.sphere = new THREE.SphereGeometry(1, 16, 12);
    this.cyl = new THREE.CylinderGeometry(1, 1, 1, 8);
    this.mats = {};
    for (const [e, c] of Object.entries(EL_COL)) this.mats[e] = physical(c, { roughness: 0.5, clearcoat: 0.35, sheen: 0.2 });
    this.stick = physical("#9aa6b4", { roughness: 0.55, clearcoat: 0.2 });
    this.disc = new THREE.CircleGeometry(1, 48);
    this.backMat = new THREE.MeshBasicMaterial({ color: "#081a30", side: THREE.DoubleSide, fog: false });
    this.ringGeo = new THREE.RingGeometry(0.97, 1.0, 64);
    this.ringMat = new THREE.MeshBasicMaterial({ color: "#fde68a", side: THREE.DoubleSide, fog: false });
    this.pent = new THREE.CylinderGeometry(1, 1, 0.42, 5); this.pent.rotateX(Math.PI / 2);
    this.sugarMat = physical(COL.sugar, { roughness: 0.4, transparent: true, opacity: 0.85 });
    this.hbMat = new THREE.MeshBasicMaterial({ color: "#7dd3fc", transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
    this.group = new THREE.Group();
    this.key = "";
    this.info = null;
  }
  /** b0 = base on the strand-0 side, S0/S1 = sugar positions, major = unit vector towards the major groove */
  set(b0, S0, S1, major, facing = null) {
    const b1 = DNA_PAIR[b0];
    const pur = PURINE[b0] ? b0 : b1, pyr = PURINE[b0] ? b1 : b0;
    const key = b0;
    if (key !== this.key) {
      this.key = key;
      for (const c of [...this.group.children]) this.group.remove(c);
      const P = pairAtoms(pur, pyr);
      // canonical frame: C1′(purine) → C1′(pyrimidine) along +x, centred
      const [cu, cp] = P.c1;
      const ang = Math.atan2(cp.y - cu.y, cp.x - cu.x), mx = (cu.x + cp.x) / 2, my = (cu.y + cp.y) / 2;
      const len = Math.hypot(cp.x - cu.x, cp.y - cu.y);
      const tf = (q) => { const x = q.x - mx, y = q.y - my, c = Math.cos(-ang), s = Math.sin(-ang); return new THREE.Vector3((x * c - y * s) / len, (x * s + y * c) / len, 0); };
      const pts = P.atoms.map(tf);
      const c1 = P.c1.map(tf);
      const inner = new THREE.Group();
      this.inner = inner;
      const k = 1 / len;   // atoms are sized in nm, the frame is normalised to C1′–C1′ = 1
      pts.forEach((v, i) => {
        const e = P.atoms[i].el, m = new THREE.Mesh(this.sphere, this.mats[e]);
        m.position.copy(v); m.scale.setScalar(EL_R[e] * k);
        inner.add(m);
      });
      const stick = (a, b, mat, r) => {
        const d = new THREE.Vector3().subVectors(b, a), l = d.length();
        const m = new THREE.Mesh(this.cyl, mat);
        m.position.copy(a).addScaledVector(d, 0.5);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
        m.scale.set(r, l, r);
        inner.add(m);
      };
      for (const [a, b] of P.bonds) stick(pts[a], pts[b], this.stick, 0.016 * k);
      for (const [ai, side] of P.glyco) stick(pts[ai], c1[side], this.stick, 0.016 * k);
      // an opaque "magnifier" disc: clears depth so the callout always reads on top of the helix behind it
      const back = new THREE.Mesh(this.disc, this.backMat);
      back.position.set(0, 0.05, -0.08); back.scale.set(0.82, 0.62, 1);
      back.renderOrder = 998;
      back.onBeforeRender = (r) => r.clearDepth();
      inner.add(back);
      const ring = new THREE.Mesh(this.ringGeo, this.ringMat);
      ring.position.copy(back.position); ring.scale.copy(back.scale); ring.renderOrder = 999;
      inner.add(ring);
      for (const c of c1) { const m = new THREE.Mesh(this.pent, this.sugarMat); m.position.copy(c); m.scale.setScalar(0.11 * k); inner.add(m); }
      for (const [h, a] of P.hb) {
        const A = pts[h], Bv = pts[a], d = new THREE.Vector3().subVectors(Bv, A);
        for (let t = 0.18; t < 0.9; t += 0.2) {
          const m = new THREE.Mesh(this.sphere, this.hbMat);
          m.position.copy(A).addScaledVector(d, t); m.scale.setScalar(0.012 * k);
          inner.add(m);
        }
      }
      this.purLeft = true;
      this.info = { pur, pyr, purC: tf(P.purC), pyrC: tf(P.pyrC), nHB: P.hb.length };
      inner.traverse((o) => { if (o.isMesh && o.renderOrder === 0) o.renderOrder = 1000; });
      this.group.add(inner);
    }
    // place: canonical x runs purine C1′ → pyrimidine C1′
    const left = PURINE[b0] ? S0 : S1, right = PURINE[b0] ? S1 : S0;
    const ex = new THREE.Vector3().subVectors(right, left), L = ex.length(); ex.normalize();
    const ey = major.clone().addScaledVector(ex, -major.dot(ex)).normalize();
    const ez = new THREE.Vector3().crossVectors(ex, ey);
    if (facing && ez.dot(facing) < 0) { ey.negate(); ez.negate(); }   // view the planar pair from the camera's side
    const m = new THREE.Matrix4().makeBasis(ex.multiplyScalar(L), ey.multiplyScalar(L), ez.multiplyScalar(L));
    m.setPosition(new THREE.Vector3().addVectors(left, right).multiplyScalar(0.5));
    this.group.matrixAutoUpdate = false;
    this.group.matrix.copy(m);
    this.group.matrixWorldNeedsUpdate = true;
    this.frame = m;
  }
  /** world position (in the parent's space) of a canonical point */
  local(v, out) { return out.copy(v).applyMatrix4(this.frame); }
}

// ---------- draggable floating molecules ----------
/**
 * Free molecules that drift (Brownian) in a box, can be dragged on a camera-facing plane, and fly to a target.
 * items: { obj, pos, vel, fly, shake, alpha, data }. The caller owns obj creation.
 */
export class Floaters {
  constructor(engine, parent) {
    this.engine = engine;
    this.parent = parent;          // Object3D the items live in (positions are in its local space)
    this.items = [];
    this.center = new THREE.Vector3();
    this.size = new THREE.Vector3(6, 1.5, 2);
    this.plane = new THREE.Plane();
    this._v = new THREE.Vector3(); this._w = new THREE.Vector3();
    this.drag = null;
  }
  add(obj, data, at) {
    const it = { obj, data, pos: new THREE.Vector3(), vel: new THREE.Vector3(), fly: null, shake: 0, alpha: 0, ph: Math.random() * 6.28, leaving: false };
    if (at) it.pos.copy(at);
    else it.pos.set(this.center.x + (Math.random() - 0.5) * this.size.x * 2, this.center.y + (Math.random() - 0.5) * this.size.y * 2, this.center.z + (Math.random() - 0.5) * this.size.z * 2);
    obj.position.copy(it.pos);
    obj.userData.item = it;
    obj.traverse((c) => (c.userData.item = it));
    this.parent.add(obj);
    this.items.push(it);
    return it;
  }
  remove(it) {
    const i = this.items.indexOf(it);
    if (i >= 0) this.items.splice(i, 1);
    this.parent.remove(it.obj);
    it.lbl?.remove();
    it.obj.traverse((c) => { if (c.geometry && !c.geometry.userData.shared) c.geometry.dispose(); });
    if (this.drag?.it === it) this.drag = null;
  }
  clear() { for (const it of [...this.items]) this.remove(it); }
  /** stop managing an item but leave its object in the scene (e.g. a tRNA that has bound the ribosome) */
  detach(it) { const i = this.items.indexOf(it); if (i >= 0) this.items.splice(i, 1); if (this.drag?.it === it) this.drag = null; it.obj.traverse((c) => delete c.userData.item); }
  meshes(out = []) { out.length = 0; for (const it of this.items) if (!it.leaving) it.obj.traverse((c) => c.isMesh && out.push(c)); return out; }
  flyTo(it, target, dur, done) { it.fly = { t: 0, dur, from: it.pos.clone(), target, done }; }
  reject(it) { it.shake = 0.5; it.vel.set((Math.random() - 0.5) * 3, -3, 1.5); }
  update(dt, t, still) {
    const c = this.center, sz = this.size;
    for (const it of [...this.items]) {
      if (this.drag?.it === it) { it.alpha = 1; continue; }
      if (it.fly) {
        const f = it.fly; f.t += dt;
        const k = smooth(Math.min(1, f.t / f.dur));
        const tg = typeof f.target === "function" ? f.target(this._w) : f.target;
        it.pos.lerpVectors(f.from, tg, k);
        if (f.t >= f.dur) { it.fly = null; f.done?.(it); }
        continue;
      }
      if (it.leaving) { it.alpha -= dt * 2; it.pos.y -= dt * 0.8; if (it.alpha <= 0) this.remove(it); continue; }
      it.alpha = Math.min(1, it.alpha + dt * 2);
      if (it.shake > 0) it.shake -= dt;
      if (!still) { it.vel.x += (Math.random() - 0.5) * dt * 3; it.vel.y += (Math.random() - 0.5) * dt * 3; it.vel.z += (Math.random() - 0.5) * dt * 2; }
      // spring back into the box
      for (const ax of ["x", "y", "z"]) {
        const d = it.pos[ax] - c[ax], h = sz[ax];
        if (d > h) it.vel[ax] -= (d - h) * dt * 4; else if (d < -h) it.vel[ax] -= (d + h) * dt * 4;
      }
      it.vel.multiplyScalar(Math.pow(0.9, dt * 60));
      it.pos.addScaledVector(it.vel, dt);
    }
    // keep apart
    const A = this.items;
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
      const a = A[i], b = A[j];
      if (a.fly || b.fly || a === this.drag?.it || b === this.drag?.it) continue;
      this._v.subVectors(b.pos, a.pos); const d = this._v.length();
      if (d > 0.001 && d < this.minGap) { this._v.multiplyScalar(((this.minGap - d) / d) * 0.5 * Math.min(1, dt * 8)); a.pos.sub(this._v); b.pos.add(this._v); }
    }
    for (const it of A) {
      it.obj.position.copy(it.pos);
      if (it.shake > 0) it.obj.position.x += Math.sin(it.shake * 60) * 0.12;
    }
  }
  /** start dragging: plane through the item facing the camera */
  startDrag(it, e) {
    const cam = this.engine.camera;
    const wp = this.parent.localToWorld(this._v.copy(it.pos));
    cam.getWorldDirection(this._w);
    this.plane.setFromNormalAndCoplanarPoint(this._w, wp);
    this.drag = { it, x: e.clientX, y: e.clientY, t0: performance.now(), moved: false };
    it.fly = null;
  }
  moveDrag(e) {
    const d = this.drag; if (!d) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) d.moved = true;
    const ray = this.engine.setRay(e.clientX, e.clientY).ray;
    if (ray.intersectPlane(this.plane, this._v)) d.it.pos.copy(this.parent.worldToLocal(this._v));
  }
  endDrag() { const d = this.drag; this.drag = null; if (!d) return null; return { it: d.it, tapped: !d.moved && performance.now() - d.t0 < 450 }; }
  /** screen distance (px) between a local point and the item */
  screenDist(it, localPt) {
    const e = this.engine, a = this.parent.localToWorld(this._v.copy(it.pos)).project(e.camera);
    const b = this.parent.localToWorld(this._w.copy(localPt)).project(e.camera);
    return Math.hypot((a.x - b.x) * e.w * 0.5, (a.y - b.y) * e.h * 0.5);
  }
}
Floaters.prototype.minGap = 1.2;

/** One merged, vertex-coloured nucleotide (base slab + sugar + 1–3 phosphates) for the free pools. */
export function nucleotideMesh(base, { sugar = COL.sugar, phosphates = 3 } = {}) {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(_nucGeo.box, _mat(BASE_COL[base]));
  const len = PURINE[base] ? 0.62 : 0.48;
  slab.scale.set(len, 0.42, 0.12); slab.position.x = 0.14;
  const s = new THREE.Mesh(_nucGeo.pent, _mat(sugar));
  s.scale.setScalar(0.18);
  g.add(slab, s);
  for (let k = 0; k < phosphates; k++) {
    const p = new THREE.Mesh(_nucGeo.sphere, _mat(COL.phosphate));
    p.scale.setScalar(0.14); p.position.set(-0.22 - k * 0.27, 0.12 - k * 0.04, 0);
    g.add(p);
  }
  g.userData.base = base;
  return g;
}
const _nucGeo = (() => {
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0.5, 0, 0);
  const pent = new THREE.CylinderGeometry(1, 1, 0.42, 5); pent.rotateX(Math.PI / 2);
  const sphere = new THREE.SphereGeometry(1, 12, 9);
  for (const g of [box, pent, sphere]) g.userData.shared = true;
  return { box, pent, sphere };
})();
const _mats = new Map();
/** cached shared materials for the free molecules (few colours; never disposed per level) */
export function _mat(color) {
  let m = _mats.get(color);
  if (!m) { m = physical(color, { roughness: 0.3, clearcoat: 1 }); m.userData.shared = true; _mats.set(color, m); }
  return m;
}
