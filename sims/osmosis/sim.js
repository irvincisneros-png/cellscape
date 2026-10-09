// Osmosis & Tonicity — CellScape
// Two linked views: a membrane close-up (water through aquaporins, solutes blocked) and
// a beaker view where a red blood cell or plant cell gains/loses water over time.
//
// Model (simplified Boyle–van 't Hoff + water-potential style):
//   cell volume V = b + W        (b = osmotically inactive volume, W = cell water)
//   internal concentration Ci = n / W   (n = fixed amount of internal solute, NaCl-equivalent %)
//   turgor (plant only) P = E·(V − Vc)/Vc when the protoplast presses on the wall (V > Vc), else 0
//   net water flux into cell  J = Ci − Cout − P       (rate ∝ concentration difference)
//   dW/dt = k·J
// Red blood cell: isotonic at 0.9 % NaCl, lyses when V ≥ 1.6 (≈ below 0.47 % NaCl).
// Plant cell: incipient plasmolysis at 1.0 % NaCl; the stiff wall caps volume at ≈ 102 %.
import * as K from "../../assets/js/kit.js";
import { SPRITES, drawSprite, frame, drawRBC, rbcRadius, drawPlant, drawShaker, shakerMouth } from "./draw.js";

const { C, clamp, lerp, rand, TAU } = K;
const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const stageEl = K.$("#stage");
const panel = K.$("#panel");
const overlay = K.$("#overlay");
const canvas = K.$("#canvas");
let layoutDirty = true;
const stage = K.createStage(canvas, () => { layoutDirty = true; });
const { ctx } = stage;
const toast = K.toaster(stageEl);

// ---------------------------------------------------------------- model
const MODELS = {
  rbc: { name: "red blood cell", b: 0.35, n: 0.585, k: 0.09, iso: 0.9, lysisV: 1.6, V0: 1 },
  plant: { name: "plant cell", b: 0.1, n: 0.87, k: 0.06, iso: 1.0, Vc: 0.97, E: 20, V0: 1.0 },
};
const DEFAULT_C = [0, 0.9, 3];
const BEAKER_NAMES = ["A", "B", "C"];

const S = { type: "rbc", beakers: DEFAULT_C.map((c) => ({ c })), t: 0 };
const cell = { V: 1, W: 0.65, lysed: false, lysedT: 0, beaker: 1, x: NaN, y: NaN, drag: false };
const F = { burst: false, cren: false, iso: false, plasmo: false, wasPlasmo: false, recovered: false,
  plantWater: false, explained: false, deviated: false, isoT: 0, waterT: 0 };
let hist = [], histAcc = 0;
let frags = [];

const model = () => MODELS[S.type];
const sol = () => S.beakers[cell.beaker].c;
const pressure = () => {
  const m = model();
  return S.type === "plant" && cell.V > m.Vc ? (m.E * (cell.V - m.Vc)) / m.Vc : 0;
};
const internal = () => (cell.lysed ? sol() : model().n / cell.W);
const flux = () => (cell.lysed ? 0 : internal() - sol() - pressure());

function newCell() {
  const m = model();
  cell.V = m.V0; cell.W = m.V0 - m.b;
  cell.lysed = false; frags = [];
  hist = []; histAcc = 0;
  F.isoT = 0; F.waterT = 0;
  syncSlider();
}

function physics(dt) {
  if (cell.lysed || dt <= 0) return;
  const m = model(), n = 6, h = dt / n;
  for (let i = 0; i < n; i++) {
    cell.W = Math.max(0.04, cell.W + m.k * flux() * h);
    cell.V = m.b + cell.W;
  }
  if (S.type === "rbc" && cell.V >= m.lysisV) lyse();
}

function lyse() {
  cell.lysed = true;
  cell.lysedT = S.t;
  F.burst = true;
  frags = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + rand(-0.15, 0.15), sp = rand(60, 150);
    frags.push({ a, d: 0, v: sp, rot: a + Math.PI / 2, vr: rand(-4, 4), len: rand(0.25, 0.55), life: 1 });
  }
  toast("<strong>Pop!</strong> Too much water moved in — the red blood cell <strong>lysed</strong> (burst).", 3400);
}

function phase() {
  const V = cell.V, J = flux();
  if (S.type === "rbc") {
    if (cell.lysed) return "lysed";
    if (V >= 1.4) return "danger";
    if (V > 1.04) return "swollen";
    if (V < 0.94) return "crenated";
    if (J > 0.03) return "swelling";
    if (J < -0.03) return "shrinking";
    return "normal";
  }
  const m = model();
  if (V < m.Vc - 0.015) return "plasmolysed";
  if (pressure() > 0.3) return "turgid";
  return "flaccid";
}
const PHASE_LABEL = {
  lysed: ["Lysed (burst)", C.red], danger: ["Swollen — about to burst", C.red], swollen: ["Swollen", C.blue],
  swelling: ["Swelling", C.blue], normal: ["Normal biconcave disc", C.green], shrinking: ["Shrinking", C.amber],
  crenated: ["Crenated (shrivelled)", C.amber], turgid: ["Turgid", C.green], flaccid: ["Flaccid", C.amber],
  plasmolysed: ["Plasmolysed", C.red],
};
function tonicity(c) {
  const iso = model().iso;
  if (c < iso - 0.05) return ["hypotonic", C.blue];
  if (c > iso + 0.05) return ["hypertonic", C.amber];
  return ["isotonic", C.green];
}

// ---------------------------------------------------------------- layout
let Lay = null, layTimer = 0;
function layout() {
  const w = stage.w, h = stage.h, pad = 10;
  const top = Math.min(h * 0.28, overlay.getBoundingClientRect().height + (w < 600 ? 14 : 22));
  const wide = w >= 720 && w / h > 1.2;
  let cv, mol, gr;
  if (wide) {
    const sw = w * 0.58;
    cv = { x: pad, y: top, w: sw - pad * 1.5, h: h - top - pad };
    const rx = sw + pad * 0.5, rw = w - rx - pad, mh = (h - top - pad * 2) * 0.6;
    mol = { x: rx, y: top, w: rw, h: mh };
    gr = { x: rx, y: top + mh + pad, w: rw, h: h - top - pad * 2 - mh };
  } else {
    const ch = (h - top - pad * 2) * 0.58;
    cv = { x: pad, y: top, w: w - pad * 2, h: ch };
    const by = top + ch + pad, bh = h - by - pad, mw = (w - pad * 3) * 0.56;
    mol = { x: pad, y: by, w: mw, h: bh };
    gr = { x: pad * 2 + mw, y: by, w: w - pad * 3 - mw, h: bh };
  }
  // beakers
  const gap = Math.max(10, cv.w * 0.035);
  const titleH = 28, labelH = 40, shakerH = clamp(cv.h * 0.16, 40, 80);
  const availH = Math.max(40, cv.h - titleH - labelH - shakerH);
  const bw = Math.max(40, Math.min((cv.w - gap * 4) / 3, availH / 1.12));
  const bh = Math.min(availH, bw * 1.45);
  const totalW = bw * 3 + gap * 2, x0 = cv.x + (cv.w - totalW) / 2;
  const by = cv.y + titleH + shakerH + (availH - bh) * 0.6;
  const beakers = [0, 1, 2].map((i) => ({ x: x0 + i * (bw + gap), y: by, w: bw, h: bh, liq: by + bh * 0.16, gap }));
  const shakerS = clamp(cv.h * 0.13, 30, 50);
  const shakerHome = { x: cv.x + cv.w - shakerS * 0.6 - 8, y: cv.y + titleH + shakerS * 0.55 };
  const prev = Lay && Lay.mol;
  Lay = { w, h, cv, mol, gr, beakers, shakerHome, shakerS, wide };
  if (!prev || Math.abs(prev.w - mol.w) > 1 || Math.abs(prev.h - mol.h) > 1 || Math.abs(prev.x - mol.x) > 1 || Math.abs(prev.y - mol.y) > 1) spawnMol();
}

function cellTarget(i = cell.beaker) {
  const b = Lay.beakers[i];
  return [b.x + b.w / 2, b.liq + (b.y + b.h - b.liq) * 0.5];
}
function cellSize(i = cell.beaker) {
  const b = Lay.beakers[i];
  const liqH = b.y + b.h - b.liq;
  const r0 = Math.min(b.w * 0.24, liqH * 0.24);
  const pW = Math.min(b.w * 0.78, (liqH * 0.7) / 0.72);
  return { r0, pW, pH: pW * 0.72 };
}
function beakerAt(x, y) {
  if (!Lay) return -1;
  const cv = Lay.cv;
  if (y < cv.y || y > cv.y + cv.h) return -1;
  for (let i = 0; i < 3; i++) {
    const b = Lay.beakers[i];
    if (x >= b.x - b.gap / 2 && x <= b.x + b.w + b.gap / 2) return i;
  }
  return -1;
}

// ---------------------------------------------------------------- background depth particles
const dust = Array.from({ length: 36 }, () => ({ u: Math.random(), v: Math.random(), z: rand(0.2, 1), p: rand(TAU) }));

// ---------------------------------------------------------------- membrane close-up particles
const mol = { water: [], ions: [], inner: [], acc: [0, 0, 0, 0], log: [], fibres: [] };
function G() {
  const r = Lay.mol;
  const th = clamp(r.h * 0.12, 22, 40), headR = th / 5;
  const memY = r.y + r.h * 0.56;
  return {
    r, th, headR, memY, top: memY - th / 2, bot: memY + th / 2,
    outTop: r.y + 28, inBot: r.y + r.h - 6,
    ch: [r.x + r.w * 0.3, r.x + r.w * 0.7], aw: clamp(th * 0.95, 20, 36),
    gapX: r.x + r.w * 0.5, gapW: r.w * 0.2,
  };
}
function regionY(side, g) { return side === 1 ? [g.outTop + 6, g.top - 6] : [g.bot + 6, g.inBot - 6]; }
function newParticle(side, g, extra) {
  const [y0, y1] = regionY(side, g);
  return { x: rand(g.r.x + 8, g.r.x + g.r.w - 8), y: rand(y0, Math.max(y0 + 1, y1)), vx: 0, vy: 0, side, a: 1, ...extra };
}
function spawnMol() {
  const g = G();
  mol.water = [];
  for (let i = 0; i < 64; i++) mol.water.push(newParticle(i % 2 ? 1 : -1, g, { r: 4.5, spr: i % 4, fade: 0, tr: null }));
  mol.ions = []; mol.inner = [];
  mol.fibres = Array.from({ length: 26 }, () => ({ u: Math.random(), v: Math.random(), a: rand(-0.5, 0.5), l: rand(0.08, 0.2) }));
}

function confine(p, g) {
  const x0 = g.r.x + p.r + 2, x1 = g.r.x + g.r.w - p.r - 2;
  if (p.x < x0) { p.x = x0; p.vx = Math.abs(p.vx); }
  if (p.x > x1) { p.x = x1; p.vx = -Math.abs(p.vx); }
  const inGap = cell.lysed && Math.abs(p.x - g.gapX) < g.gapW / 2;
  let ymin, ymax;
  if (inGap) { ymin = g.outTop + p.r; ymax = g.inBot - p.r; }
  else if (p.side === 1) { ymin = g.outTop + p.r; ymax = g.top - p.r; }
  else { ymin = g.bot + p.r; ymax = g.inBot - p.r; }
  if (p.y < ymin) { p.y = ymin; p.vy = Math.abs(p.vy); }
  if (p.y > ymax) { p.y = ymax; p.vy = -Math.abs(p.vy); }
  if (cell.lysed && inGap) p.side = p.y < g.memY ? 1 : -1;
}

function adjustCount(arr, kind, target, side, g, r) {
  let alive = 0;
  for (const p of arr) if (p.kind === kind && !p.dying) alive++;
  if (alive < target) {
    for (let i = alive; i < target; i++) arr.push(newParticle(side, g, { r, kind, a: 0, dying: false }));
  } else if (alive > target) {
    let k = alive - target;
    for (const p of arr) { if (k <= 0) break; if (p.kind === kind && !p.dying) { p.dying = true; k--; } }
  }
}

function startTransit(ch, dir, g) {
  const fromSide = dir > 0 ? 1 : -1;
  const mx = g.ch[ch], my = dir > 0 ? g.top - 6 : g.bot + 6;
  let best = null, bd = Infinity;
  for (const w of mol.water) {
    if (w.side !== fromSide || w.tr || w.fade) continue;
    const d = (w.x - mx) ** 2 + (w.y - my) ** 2;
    if (d < bd) { bd = d; best = w; }
  }
  if (!best) return;
  best.tr = { ch, dir, t: 0, x0: best.x, y0: best.y };
  mol.log.push({ t: S.t, dir });
}

function finishTransit(w, g) {
  w.side = -w.side;
  w.vy = w.tr.dir * 40; w.vx = rand(-20, 20);
  w.tr = null;
  // keep both reservoirs stocked: quietly recycle a far-away molecule to the other side
  const [y0, y1] = regionY(w.side, g);
  const far = (p) => (w.side === 1 ? p.y < lerp(y0, y1, 0.45) : p.y > lerp(y0, y1, 0.55));
  const cands = mol.water.filter((p) => p !== w && p.side === w.side && !p.tr && !p.fade && far(p));
  if (cands.length) K.pick(cands).fade = 1;
}

function updMol(dt, rdt) {
  const g = G();
  const bias = clamp(flux() * 1.1, -0.85, 0.85);
  const R0 = 1.1;
  if (!cell.lysed && dt > 0) {
    for (let ch = 0; ch < 2; ch++) {
      mol.acc[ch] += R0 * (1 + bias) * dt * rand(0.6, 1.4);
      mol.acc[ch + 2] += R0 * (1 - bias) * dt * rand(0.6, 1.4);
      while (mol.acc[ch] >= 1) { mol.acc[ch] -= 1; startTransit(ch, 1, g); }
      while (mol.acc[ch + 2] >= 1) { mol.acc[ch + 2] -= 1; startTransit(ch, -1, g); }
    }
  }
  while (mol.log.length && mol.log[0].t < S.t - 5) mol.log.shift();

  for (const w of mol.water) {
    if (w.tr) {
      const tr = w.tr, cx = g.ch[tr.ch];
      tr.t += dt / 0.9;
      const ya = tr.dir > 0 ? g.top - 7 : g.bot + 7, yb = tr.dir > 0 ? g.bot + 7 : g.top - 7;
      if (tr.t < 0.35) {
        const u = K.easeInOut(tr.t / 0.35);
        w.x = lerp(tr.x0, cx, u); w.y = lerp(tr.y0, ya, u);
      } else if (tr.t < 0.85) {
        const u = (tr.t - 0.35) / 0.5;
        w.x = cx + Math.sin(u * 9) * 1.5; w.y = lerp(ya, yb, u);
      } else {
        w.x = cx; w.y = yb + tr.dir * 10 * ((tr.t - 0.85) / 0.15);
      }
      if (tr.t >= 1) finishTransit(w, g);
      continue;
    }
    K.brownian(w, dt, 320, 0.92);
    confine(w, g);
    if (w.fade === 1) {
      w.a -= rdt * 2.5;
      if (w.a <= 0) {
        const np = newParticle(-w.side, g, {});
        w.side = -w.side; w.x = np.x;
        const [y0, y1] = regionY(w.side, g);
        w.y = w.side === 1 ? lerp(y0, y1, rand(0, 0.35)) : lerp(y0, y1, rand(0.65, 1));
        w.fade = 2; w.a = 0;
      }
    } else if (w.fade === 2) {
      w.a += rdt * 2.5;
      if (w.a >= 1) { w.a = 1; w.fade = 0; }
    }
  }

  // solutes: Na+/Cl- outside track the beaker; cell solutes inside track Ci
  const pairs = Math.round(sol() * 7);
  adjustCount(mol.ions, "na", pairs, 1, g, 4.6);
  adjustCount(mol.ions, "cl", pairs, 1, g, 5.6);
  if (!cell.lysed) adjustCount(mol.inner, "s", Math.min(40, Math.round(internal() * 11)), -1, g, 4.8);
  for (const arr of [mol.ions, mol.inner]) {
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      K.brownian(p, dt, 170, 0.9);
      confine(p, g);
      if (p.dying) { p.a -= rdt * 2; if (p.a <= 0) arr.splice(i, 1); }
      else if (p.a < 1) p.a = Math.min(1, p.a + rdt * 2);
    }
  }
}

function drawMol(t) {
  const g = G(), r = g.r, m = model();
  frame(ctx, r, r.w > 300 ? "Membrane close-up · not to scale" : "Membrane close-up");
  ctx.save();
  K.roundRect(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 13);
  ctx.clip();
  // compartment tints
  const outA = 0.05 + sol() * 0.04;
  ctx.fillStyle = K.withAlpha(K.mix("#60a5fa", "#a78bfa", clamp(sol() / 3, 0, 1)), outA);
  ctx.fillRect(r.x, g.outTop - 4, r.w, g.top - g.outTop + 4);
  ctx.fillStyle = S.type === "rbc" ? "rgba(248,113,113,0.07)" : "rgba(74,222,128,0.06)";
  ctx.fillRect(r.x, g.bot, r.w, g.inBot - g.bot + 6);

  for (const w of mol.water) if (!w.tr) drawSprite(ctx, SPRITES.water[w.spr], w.x, w.y, w.a);
  for (const p of mol.ions) drawSprite(ctx, p.kind === "na" ? SPRITES.na : SPRITES.cl, p.x, p.y, p.a);
  for (const p of mol.inner) drawSprite(ctx, SPRITES.solute, p.x, p.y, p.a);

  // bilayer with gaps for aquaporins (and a tear if lysed)
  const skip = (x) => Math.abs(x - g.ch[0]) < g.aw * 0.62 || Math.abs(x - g.ch[1]) < g.aw * 0.62 ||
    (cell.lysed && Math.abs(x - g.gapX) < g.gapW / 2);
  K.bilayer(ctx, r.x - g.headR, r.x + r.w + g.headR, g.top + g.headR, g.bot - g.headR, { t, headR: g.headR, skip });
  for (const cx of g.ch) {
    const bw = g.aw * 0.4, bh = g.th + g.headR * 1.6;
    K.blob(ctx, cx - g.aw * 0.3, g.memY, bw, bh, C.blue, bw * 0.45);
    K.blob(ctx, cx + g.aw * 0.3, g.memY, bw, bh, C.blue, bw * 0.45);
  }
  for (const w of mol.water) if (w.tr) drawSprite(ctx, SPRITES.water[w.spr], w.x, w.y, 1, 1.1);

  // plant: freely permeable cellulose wall just outside the membrane
  if (S.type === "plant") {
    const room = g.top - g.outTop - 26;
    const gap = clamp((m.Vc - cell.V) / 0.3, 0, 1) * room * 0.75;
    const wh = clamp(r.h * 0.06, 8, 14), wy1 = g.top - 3 - gap, wy0 = wy1 - wh;
    ctx.fillStyle = "rgba(127,174,78,0.22)";
    ctx.fillRect(r.x, wy0, r.w, wh);
    ctx.strokeStyle = "rgba(170,215,110,0.75)"; ctx.lineWidth = 1.4;
    for (const f of mol.fibres) {
      const fx = r.x + f.u * r.w, fy = wy0 + f.v * wh, L = f.l * r.w * 0.5;
      ctx.beginPath(); ctx.moveTo(fx - Math.cos(f.a) * L, fy - Math.sin(f.a) * L * 0.2);
      ctx.lineTo(fx + Math.cos(f.a) * L, fy + Math.sin(f.a) * L * 0.2); ctx.stroke();
    }
    if (r.w > 200) K.label(ctx, gap > 6 ? "cell wall (membrane has pulled away)" : "cell wall (freely permeable)", r.x + r.w - 8, wy0 - 9, { size: 10, align: "right", color: "#c5e79c" });
    const P = pressure();
    if (P > 0.15 && gap < 2) {
      for (const ax of [r.x + r.w * 0.12, r.x + r.w * 0.88]) K.arrow(ctx, ax, g.bot + 18, ax, g.top - 2, withA(C.amber, clamp(P, 0.3, 1)), 2);
      if (r.w > 220) K.label(ctx, "turgor pressure", r.x + r.w * 0.12, g.bot + 30, { size: 10, color: C.amber, align: "left" });
    }
  }

  // labels
  const fs = r.w < 260 ? 10 : 11;
  K.label(ctx, `OUTSIDE · ${sol().toFixed(2)}% NaCl`, r.x + 8, g.outTop + 6, { size: fs, align: "left", color: C.inkDim });
  K.label(ctx, cell.lysed ? "INSIDE (cell burst)" : `INSIDE · ${internal().toFixed(2)}%`, r.x + 8, g.inBot - 10, { size: fs, align: "left", color: C.inkDim });
  if (r.w > 240) K.label(ctx, "aquaporin", g.ch[1], g.bot + g.headR + 12, { size: 10, color: "#bfdbfe" });

  if (cell.lysed) {
    K.label(ctx, "membrane ruptured", g.gapX, g.memY, { size: 11, color: C.red });
  } else {
    // net water arrow across the membrane between the two channels
    const bias = clamp(flux() * 1.1, -0.85, 0.85), ax = g.gapX;
    if (Math.abs(bias) > 0.04) {
      const dir = Math.sign(bias), L = g.th * 0.55 + 26 * Math.abs(bias);
      K.glow(ctx, ax, g.memY, L * 1.2, C.teal, 0.2 * Math.abs(bias));
      K.arrow(ctx, ax, g.memY - dir * L, ax, g.memY + dir * L, C.teal, 2 + 3 * Math.abs(bias));
    } else {
      K.arrow(ctx, ax - 6, g.memY - 18, ax - 6, g.memY + 18, withA(C.teal, 0.8), 1.6);
      K.arrow(ctx, ax + 6, g.memY + 18, ax + 6, g.memY - 18, withA(C.teal, 0.8), 1.6);
    }
  }
  let nin = 0, nout = 0;
  for (const e of mol.log) e.dir > 0 ? nin++ : nout++;
  const txt = r.w > 420 ? `water crossings (5 s): in ${nin} · out ${nout}` : `in ${nin} · out ${nout}`;
  K.label(ctx, txt, r.x + r.w - 8, g.inBot - 10, { size: fs, align: "right", color: C.teal });
  ctx.restore();
}
const withA = (hex, a) => K.withAlpha(hex, a);

// ---------------------------------------------------------------- salt shaker + crystals
const shaker = { drag: false, x: 0, y: 0, moved: 0, emit: 0 };
let crystals = [];
function updCrystals(rdt) {
  if (shaker.drag) {
    const tilt = Math.PI * 0.82;
    const [mx, my] = shakerMouth(shaker.x, shaker.y, Lay.shakerS, tilt);
    const bi = beakerAt(mx, my);
    if (bi >= 0 && my < Lay.beakers[bi].liq) {
      shaker.emit += rdt * 12;
      while (shaker.emit >= 1) {
        shaker.emit -= 1;
        crystals.push({ x: mx + rand(-4, 4), y: my, vy: rand(30, 70), vx: rand(-12, 12), rot: rand(TAU), st: 0, life: 1, b: -1 });
      }
    }
  }
  for (let i = crystals.length - 1; i >= 0; i--) {
    const c = crystals[i];
    if (c.st === 0) {
      c.vy += 600 * rdt; c.x += c.vx * rdt; c.y += c.vy * rdt; c.rot += rdt * 6;
      const bi = beakerAt(c.x, c.y);
      if (bi >= 0) {
        const b = Lay.beakers[bi];
        if (c.x > b.x + 3 && c.x < b.x + b.w - 3 && c.y >= b.liq) {
          c.st = 1; c.b = bi; c.vy = 25;
          S.beakers[bi].c = Math.min(3, Math.round((S.beakers[bi].c + 0.025) * 1000) / 1000);
          if (bi === cell.beaker) syncSlider();
        }
      }
      if (c.y > stage.h + 10) crystals.splice(i, 1);
    } else {
      c.y += c.vy * rdt; c.vy *= 0.97; c.life -= rdt * 1.4;
      if (c.life <= 0) crystals.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------- cell view
function drawBeaker(i, t, hot) {
  const b = Lay.beakers[i], c = S.beakers[i].c;
  const x0 = b.x, x1 = b.x + b.w, y0 = b.y, y1 = b.y + b.h, rr = b.w * 0.09;
  const glassPath = () => {
    ctx.beginPath();
    ctx.moveTo(x0 - 4, y0);
    ctx.lineTo(x0, y0 + 6);
    ctx.lineTo(x0, y1 - rr);
    ctx.quadraticCurveTo(x0, y1, x0 + rr, y1);
    ctx.lineTo(x1 - rr, y1);
    ctx.quadraticCurveTo(x1, y1, x1, y1 - rr);
    ctx.lineTo(x1, y0 + 6);
    ctx.lineTo(x1 + 4, y0);
  };
  // liquid
  ctx.save();
  glassPath(); ctx.closePath(); ctx.clip();
  const tint = K.mix("#5fb8ff", "#b9a3ff", clamp(c / 3, 0, 1));
  const lg = ctx.createLinearGradient(0, b.liq, 0, y1);
  lg.addColorStop(0, K.withAlpha(tint, 0.16 + c * 0.05));
  lg.addColorStop(1, K.withAlpha(tint, 0.3 + c * 0.07));
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.moveTo(x0 - 5, y1 + 2);
  for (let x = x0 - 5; x <= x1 + 5; x += 6) ctx.lineTo(x, b.liq + Math.sin(x * 0.06 + t * 1.6) * 1.3);
  ctx.lineTo(x1 + 5, y1 + 2);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let x = x0; x <= x1; x += 6) { const yy = b.liq + Math.sin(x * 0.06 + t * 1.6) * 1.3; x === x0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); }
  ctx.stroke();
  ctx.restore();
  // glass
  ctx.save();
  glassPath();
  ctx.strokeStyle = hot ? C.teal : "rgba(200,225,255,0.45)";
  ctx.lineWidth = hot ? 2.5 : 1.6;
  if (hot) { ctx.shadowColor = C.teal; ctx.shadowBlur = 14; }
  ctx.stroke();
  ctx.restore();
  const hl = ctx.createLinearGradient(x0, 0, x0 + b.w * 0.18, 0);
  hl.addColorStop(0, "rgba(255,255,255,0.10)"); hl.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = hl;
  ctx.fillRect(x0 + 3, y0 + 8, b.w * 0.18, b.h - 16);
  ctx.strokeStyle = "rgba(200,225,255,0.35)"; ctx.lineWidth = 1;
  for (let k = 1; k <= 4; k++) {
    const yy = lerp(y1 - 6, b.liq, k / 4.2);
    ctx.beginPath(); ctx.moveTo(x1 - 3, yy); ctx.lineTo(x1 - (k % 2 ? 8 : 13), yy); ctx.stroke();
  }
  // labels
  const fs = b.w < 110 ? 10 : 12;
  K.label(ctx, `${BEAKER_NAMES[i]} · ${c.toFixed(2)}%`, b.x + b.w / 2, y1 + 13, { size: fs, color: i === cell.beaker ? C.ink : C.inkDim, bg: i === cell.beaker ? "rgba(79,209,197,0.22)" : undefined });
  const [word, col] = tonicity(c);
  K.label(ctx, word, b.x + b.w / 2, y1 + 31, { size: fs - 1, color: col, bg: null });
}

function drawWaterArrows(x, y, rx, ry, t) {
  const bias = clamp(flux() * 1.1, -0.85, 0.85);
  if (cell.lysed || cell.drag || Math.abs(bias) < 0.05) return;
  const dir = Math.sign(bias), n = 10, A = Math.abs(bias);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + 0.3;
    let ph = (t * 0.7 + i * 0.37) % 1;
    if (dir < 0) ph = 1 - ph;
    const far = 30, near = 7;
    const d0 = lerp(far, near, ph), d1 = d0 - 11;
    const ca = Math.cos(a), sa = Math.sin(a);
    const ox = x + ca * (rx + (dir > 0 ? d0 : d1)), oy = y + sa * (ry + (dir > 0 ? d0 : d1));
    const ix = x + ca * (rx + (dir > 0 ? d1 : d0)), iy = y + sa * (ry + (dir > 0 ? d1 : d0));
    const alpha = A * Math.sin(Math.PI * ph) * 0.95;
    K.arrow(ctx, ox, oy, ix, iy, withA(C.teal, alpha), 1.6);
  }
}

function drawCellView(t, rdt) {
  const cv = Lay.cv;
  frame(ctx, cv, cv.w > 420 ? "Cell view · drag the cell or the salt shaker" : "Cell view · drag the cell");
  const hotB = cell.drag ? beakerAt(cell.x, cell.y) : -1;
  let hotS = -1;
  if (shaker.drag) {
    const [mx, my] = shakerMouth(shaker.x, shaker.y, Lay.shakerS, Math.PI * 0.82);
    hotS = beakerAt(mx, my);
  }
  for (let i = 0; i < 3; i++) drawBeaker(i, t, i === hotB || i === hotS);

  // crystals
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  for (const c of crystals) {
    ctx.save();
    ctx.globalAlpha = c.st ? Math.max(0, c.life) * 0.8 : 1;
    ctx.translate(c.x, c.y); ctx.rotate(c.rot);
    const s = c.st ? 2.6 * c.life + 0.5 : 3;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.restore();
  }

  // the cell
  const [tx, ty] = cellTarget();
  if (!cell.drag) {
    if (Number.isNaN(cell.x)) { cell.x = tx; cell.y = ty; }
    const k = 1 - Math.exp(-rdt * 9);
    cell.x = lerp(cell.x, tx, k); cell.y = lerp(cell.y, ty, k);
  }
  const sz = cellSize(hotB >= 0 ? hotB : cell.beaker);
  const lift = cell.drag ? 1 : 0;
  if (S.type === "rbc") {
    if (cell.lysed) drawLysis(cell.x, cell.y, sz.r0, t);
    else {
      const R = rbcRadius(sz.r0, cell.V);
      drawWaterArrows(cell.x, cell.y, R, R, t);
      drawRBC(ctx, cell.x, cell.y, sz.r0, cell.V, t, { lift });
    }
  } else {
    const m = model();
    drawWaterArrows(cell.x, cell.y, sz.pW * 0.5, sz.pH * 0.5, t);
    drawPlant(ctx, cell.x, cell.y, sz.pW, sz.pH, cell.V, pressure(), t, m.Vc, { lift });
  }
  if (!cell.drag && cv.w > 300) {
    const b = Lay.beakers[cell.beaker];
    K.label(ctx, "cell magnified", b.x + b.w / 2, b.liq + 12, { size: 9, color: C.inkFaint, bg: null });
  }

  // shaker
  const home = Lay.shakerHome;
  if (shaker.drag) drawShaker(ctx, shaker.x, shaker.y, Lay.shakerS, Math.PI * 0.82 + Math.sin(t * 22) * 0.12, true);
  else {
    drawShaker(ctx, home.x, home.y, Lay.shakerS, Math.sin(t * 2) * 0.05, false);
    if (cv.w > 300) K.label(ctx, "drag over a beaker", home.x - Lay.shakerS * 0.5 - 6, home.y, { size: 10, align: "right", color: C.inkFaint, bg: null });
  }
}

function drawLysis(x, y, r0, t) {
  const age = S.t - cell.lysedT;
  // haemoglobin cloud diffusing away
  const spread = clamp(age / 3, 0, 1);
  K.glow(ctx, x, y, r0 * (1.4 + spread * 2.4), C.red, 0.55 * (1 - spread * 0.75));
  // flash ring
  if (age < 0.45) {
    const u = age / 0.45;
    ctx.strokeStyle = `rgba(255,230,230,${1 - u})`;
    ctx.lineWidth = 3 * (1 - u) + 0.5;
    ctx.beginPath(); ctx.arc(x, y, r0 * (1.3 + u * 1.6), 0, TAU); ctx.stroke();
  }
  // membrane ghost
  ctx.save();
  ctx.setLineDash([7, 6]);
  ctx.strokeStyle = `rgba(255,190,195,${0.15 + 0.2 * spread})`;
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(x, y, r0 * 1.2, 0, TAU); ctx.stroke();
  ctx.restore();
  // fragments
  for (const f of frags) {
    if (f.life <= 0) continue;
    const fx = x + Math.cos(f.a) * (r0 * 1.2 + f.d), fy = y + Math.sin(f.a) * (r0 * 1.2 + f.d);
    ctx.strokeStyle = `rgba(240,90,110,${f.life})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(fx, fy, r0 * 0.35, f.rot, f.rot + f.len * 2); ctx.stroke();
  }
  if (age > 1.2) K.label(ctx, "membrane 'ghost'", x, y + r0 * 1.2 + 14, { size: 10, color: "#fecdd3", bg: null });
}
function updFrags(dt) {
  for (const f of frags) {
    f.d += f.v * dt; f.v *= Math.pow(0.9, dt * 60); f.rot += f.vr * dt; f.life -= dt * 0.45;
  }
}

// ---------------------------------------------------------------- graph
function drawGraph() {
  const r = Lay.gr;
  frame(ctx, r, S.type === "rbc" ? "Cell volume over time" : "Protoplast volume over time");
  const px0 = r.x + 40, px1 = r.x + r.w - 12, py0 = r.y + 30, py1 = r.y + r.h - 22;
  if (py1 - py0 < 30 || px1 - px0 < 40) return;
  const [lo, hi, ticks] = S.type === "rbc" ? [40, 175, [50, 100, 150]] : [30, 115, [50, 100]];
  const Y = (v) => py1 - ((v - lo) / (hi - lo)) * (py1 - py0);
  ctx.save();
  ctx.font = "600 10px Inter, system-ui, sans-serif";
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  for (const v of ticks) {
    ctx.strokeStyle = v === 100 ? "rgba(232,241,255,0.22)" : "rgba(232,241,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px0, Y(v)); ctx.lineTo(px1, Y(v)); ctx.stroke();
    ctx.fillStyle = C.inkFaint; ctx.fillText(`${v}%`, px0 - 5, Y(v));
  }
  const refV = S.type === "rbc" ? 160 : model().Vc * 100;
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = withA(S.type === "rbc" ? C.red : C.green, 0.7);
  ctx.beginPath(); ctx.moveTo(px0, Y(refV)); ctx.lineTo(px1, Y(refV)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.textAlign = "left";
  ctx.fillStyle = withA(S.type === "rbc" ? C.red : C.green, 0.9);
  ctx.fillText(S.type === "rbc" ? "bursts" : "fills cell wall", px0 + 4, Y(refV) - 8);
  ctx.fillStyle = C.inkFaint;
  ctx.textBaseline = "top";
  ctx.fillText("−60 s", px0, py1 + 5);
  ctx.textAlign = "right";
  ctx.fillText("now", px1, py1 + 5);

  const now = S.t, win = 60;
  const X = (tt) => px1 - ((now - tt) / win) * (px1 - px0);
  ctx.beginPath();
  let started = false, lastPt = null;
  for (const p of hist) {
    if (p.t < now - win) continue;
    const x = X(p.t), y = Y(clamp(p.v, lo, hi));
    if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    lastPt = [x, y];
  }
  ctx.strokeStyle = S.type === "rbc" ? "#fb7185" : C.green;
  ctx.lineWidth = 2.2; ctx.lineJoin = "round";
  ctx.stroke();
  if (cell.lysed && cell.lysedT > now - win) {
    const x = X(cell.lysedT), y = Y(160);
    ctx.strokeStyle = C.red; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x - 5, y - 5); ctx.lineTo(x + 5, y + 5); ctx.moveTo(x + 5, y - 5); ctx.lineTo(x - 5, y + 5); ctx.stroke();
  } else if (lastPt && !cell.lysed) {
    K.glow(ctx, lastPt[0], lastPt[1], 10, S.type === "rbc" ? "#fb7185" : C.green, 0.6);
    K.sphere(ctx, lastPt[0], lastPt[1], 3, S.type === "rbc" ? "#fb7185" : C.green);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- pointer
const ptr = K.pointer(canvas, {
  down(p) {
    if (!Lay) return;
    const home = Lay.shakerHome;
    if (K.dist(p.x, p.y, home.x, home.y) < Math.max(28, Lay.shakerS * 0.7)) {
      shaker.drag = true; shaker.x = p.x; shaker.y = p.y; shaker.moved = 0; shaker.sx = p.x; shaker.sy = p.y;
      return;
    }
    const sz = cellSize();
    const hit = S.type === "rbc"
      ? K.dist(p.x, p.y, cell.x, cell.y) < Math.max(26, rbcRadius(sz.r0, cell.lysed ? 1.2 : cell.V) * 1.25)
      : Math.abs(p.x - cell.x) < sz.pW / 2 + 12 && Math.abs(p.y - cell.y) < sz.pH / 2 + 12;
    if (hit) { cell.drag = true; cell.ox = cell.x - p.x; cell.oy = cell.y - p.y; canvas.style.cursor = "grabbing"; }
  },
  move(p) {
    if (shaker.drag) {
      shaker.moved = Math.max(shaker.moved, K.dist(p.x, p.y, shaker.sx, shaker.sy));
      shaker.x = p.x; shaker.y = p.y - 8;
    } else if (cell.drag) {
      cell.x = p.x + cell.ox; cell.y = p.y + cell.oy;
    } else if (Lay) {
      const home = Lay.shakerHome, sz = cellSize();
      const over = K.dist(p.x, p.y, home.x, home.y) < Math.max(28, Lay.shakerS * 0.7) ||
        K.dist(p.x, p.y, cell.x, cell.y) < Math.max(26, (S.type === "rbc" ? sz.r0 : sz.pW * 0.5) * 1.2);
      canvas.style.cursor = over ? "grab" : "default";
    }
  },
  up(p) {
    if (shaker.drag) {
      shaker.drag = false;
      if (shaker.moved < 6) toast("Drag the salt shaker over a beaker and hold it there to shake salt in.");
      return;
    }
    if (cell.drag) {
      cell.drag = false; canvas.style.cursor = "grab";
      const bi = beakerAt(cell.x, cell.y);
      if (bi >= 0 && bi !== cell.beaker) {
        cell.beaker = bi;
        syncSlider();
        const c = S.beakers[bi].c;
        toast(`Cell moved to beaker ${BEAKER_NAMES[bi]} (${c.toFixed(2)}% NaCl — ${tonicity(c)[0]})`);
      }
    }
  },
});

// ---------------------------------------------------------------- panel
const explain = K.card(panel, "What's happening", "explain");
const explainBody = document.createElement("div");
explainBody.setAttribute("aria-live", "polite");
explain.appendChild(explainBody);

const ctl = K.card(panel, "Controls");
const typeSeg = K.segmented(ctl, [{ value: "rbc", label: "Red blood cell" }, { value: "plant", label: "Plant cell" }], "rbc", (v) => {
  if (v === S.type) return;
  S.type = v; newCell();
  toast(v === "rbc" ? "Animal cell: a red blood cell (no cell wall)." : "Plant cell: cell wall + large central vacuole.");
});
ctl.appendChild(Object.assign(document.createElement("div"), { className: "gap" }));
const solSlider = K.slider(ctl, {
  label: "Solution in the cell's beaker", min: 0, max: 3, step: 0.05, value: S.beakers[cell.beaker].c,
  format: (v) => `${v.toFixed(2)}% NaCl`, onInput: (v) => { S.beakers[cell.beaker].c = v; },
});
function syncSlider() { solSlider.value = Math.round(S.beakers[cell.beaker].c * 100) / 100; }
const r1 = K.buttonRow(ctl);
K.button(r1, "Add salt (+0.10%)", () => {
  const b = S.beakers[cell.beaker];
  b.c = Math.min(3, Math.round((b.c + 0.1) * 100) / 100); syncSlider();
});
K.button(r1, "Add water (dilute)", () => {
  const b = S.beakers[cell.beaker], before = b.c;
  b.c = b.c < 0.04 ? 0 : Math.round(b.c * 0.75 * 100) / 100; syncSlider();
  toast(`Added water to beaker ${BEAKER_NAMES[cell.beaker]}: ${before.toFixed(2)}% → ${b.c.toFixed(2)}%`);
});
const r2 = K.buttonRow(ctl);
const pauseBtn = K.button(r2, "Pause", () => { pauseBtn.textContent = L.toggle() ? "Pause" : "Play"; });
K.button(r2, "New cell", () => { newCell(); toast(`A fresh ${model().name} in beaker ${BEAKER_NAMES[cell.beaker]}.`); });
K.button(r2, "Reset", () => {
  S.beakers.forEach((b, i) => (b.c = DEFAULT_C[i]));
  cell.beaker = 1; crystals = [];
  newCell(); if (Lay) spawnMol();
});
K.slider(ctl, {
  label: "Speed", min: 0.25, max: 3, step: 0.25, value: reduceMotion ? 0.5 : 1,
  format: (v) => `${v}×`, onInput: (v) => { L.speed = v; },
});
ctl.insertAdjacentHTML("beforeend", `<p class="hint">Drag the cell into another beaker, or drag the salt shaker over any beaker and hold to shake salt in. Beakers start at 0% (distilled water), 0.9% and 3% NaCl.</p>`);

const leg = K.card(panel, "Legend");
leg.insertAdjacentHTML("beforeend", `<div class="legend">
  <span><i style="background:${C.teal}"></i>Water (H₂O)</span>
  <span><i style="background:${C.violet}"></i>Na⁺ ion</span>
  <span><i style="background:${C.green}"></i>Cl⁻ ion</span>
  <span><i style="background:${C.amber}"></i>Cell solutes (K⁺, sugars…)</span>
  <span><i style="background:${C.blue};border-radius:3px"></i>Aquaporin</span>
  <span><i style="background:${C.lipidHead}"></i>Phospholipid</span>
</div><p class="hint">Beaker tint stands for salt concentration (real salt solutions are colourless).</p>`);

const mis = K.missions(panel, [
  { text: "Make a red blood cell <strong>burst</strong> (lyse)", check: () => F.burst },
  { text: "<strong>Crenate</strong> a red blood cell (shrink it below 80% volume)", check: () => F.cren },
  { text: "Find the <strong>isotonic</strong> concentration: bring a swollen or shrunken red blood cell back to normal with no net water movement", check: () => F.iso },
  { text: "<strong>Plasmolyse</strong> a plant cell", check: () => F.plasmo },
  { text: "Recover the plasmolysed plant cell back to <strong>turgid</strong>", check: () => F.recovered },
  { text: "Put a plant cell in distilled water, then explain why it doesn't burst (card below)", check: () => F.plantWater && F.explained },
], (m) => toast(`Mission complete: ${m.text}`, 3200));

// explain-it mini question (feeds mission 6)
const ex = K.card(panel, "Explain it: why don't plant cells burst?", "quiz");
ex.insertAdjacentHTML("beforeend", `<div class="q">A plant cell sits in distilled water. Water keeps moving in by osmosis, yet the cell never bursts. Why?</div><div class="opts"></div><div class="fb" aria-live="polite"></div>`);
const exOpts = ex.querySelector(".opts"), exFb = ex.querySelector(".fb");
const EX = [
  ["The cell membrane stops letting water in once the vacuole is full.", false, "Not quite — the membrane stays permeable to water the whole time. Water still crosses in both directions."],
  ["The rigid cell wall resists expansion; turgor pressure builds until water enters and leaves at the same rate.", true, "Yes! The strong cellulose wall pushes back on the swelling protoplast. This <strong>turgor pressure</strong> balances the osmotic pull, so there is no further net water gain — the cell is <strong>turgid</strong>, not burst."],
  ["The vacuole uses ATP to pump the extra water back out.", false, "No — osmosis is passive. (Some single-celled protists use contractile vacuoles, but plant cells rely on their cell wall.)"],
  ["Distilled water has no solutes, so osmosis cannot happen.", false, "Distilled water is the most hypotonic solution possible — osmosis into the cell is fastest here."],
];
EX.forEach(([txt, right, why]) => {
  const b = K.button(exOpts, txt, () => {
    [...exOpts.children].forEach((x) => x.classList.remove("right", "wrong"));
    b.classList.add(right ? "right" : "wrong");
    exFb.innerHTML = why + (right && !F.plantWater ? " <em>Now put a plant cell in 0% to finish the mission.</em>" : "");
    if (right) F.explained = true;
  });
});

// potato chip experiment (extension)
const potato = K.card(panel, "Potato chip experiment (extension)", "potato");
potato.insertAdjacentHTML("beforeend", `<p>Soak potato chips (2.00 g each) in different salt solutions for 30 minutes, then weigh them. Plot the <strong>% change in mass</strong>. Where the line crosses 0% is the potato's <strong>isotonic point</strong>.</p>`);
const pc = document.createElement("canvas");
pc.setAttribute("role", "img");
pc.setAttribute("aria-label", "Graph of potato chip percentage mass change against salt concentration");
potato.appendChild(pc);
const potatoIso = Math.round(rand(0.8, 1.3) * 20) / 20;
let potatoPts = [], potatoReveal = false;
const pSlider = K.slider(potato, { label: "Soak solution", min: 0, max: 3, step: 0.25, value: 0.5, format: (v) => `${v.toFixed(2)}% NaCl` });
const pr = K.buttonRow(potato);
const pRead = document.createElement("p");
pRead.className = "readout"; pRead.setAttribute("aria-live", "polite");
K.button(pr, "Soak a chip", () => {
  const s = pSlider.value;
  const pct = 22 * Math.tanh((potatoIso - s) * 0.9) + rand(-1.2, 1.2);
  const end = 2 * (1 + pct / 100);
  potatoPts.push({ s, m: pct });
  pRead.innerHTML = `Chip in ${s.toFixed(2)}%: 2.00 g → ${end.toFixed(2)} g (<strong>${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%</strong>). ${potatoEstimate()}`;
  drawPotato();
}, { kind: "primary" });
K.button(pr, "Clear", () => { potatoPts = []; potatoReveal = false; pRead.textContent = ""; drawPotato(); });
K.button(pr, "Reveal", () => { potatoReveal = true; pRead.innerHTML = `This potato's isotonic point is about <strong>${potatoIso.toFixed(2)}% NaCl</strong>. ${potatoEstimate()}`; drawPotato(); });
potato.appendChild(pRead);

function potatoEstimate() {
  const pts = [...potatoPts].sort((a, b) => a.s - b.s);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (a.s !== b.s && a.m >= 0 && b.m < 0) {
      const x = a.s + (a.m / (a.m - b.m)) * (b.s - a.s);
      return `Your graph crosses 0% at about <strong>${x.toFixed(2)}% NaCl</strong>.`;
    }
  }
  return pts.length < 3 ? "Test several concentrations on both sides of the crossing." : "Keep going — you need points on both sides of 0%.";
}
function drawPotato() {
  const w = pc.clientWidth || 300, h = pc.clientHeight || 190, dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (pc.width !== Math.round(w * dpr)) { pc.width = Math.round(w * dpr); pc.height = Math.round(h * dpr); }
  const c = pc.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  const x0 = 36, x1 = w - 10, y0 = 12, y1 = h - 26;
  const X = (s) => x0 + (s / 3) * (x1 - x0), Y = (m) => y0 + ((25 - m) / 55) * (y1 - y0);
  c.font = "600 10px Inter, system-ui, sans-serif";
  c.fillStyle = K.cssVar("--ink-faint", C.inkFaint); c.textAlign = "right"; c.textBaseline = "middle";
  for (const m of [20, 10, 0, -10, -20]) {
    c.strokeStyle = K.cssVar(m === 0 ? "--ink-faint" : "--grid-line", "rgba(232,241,255,0.2)");
    c.beginPath(); c.moveTo(x0, Y(m)); c.lineTo(x1, Y(m)); c.stroke();
    c.fillText(`${m > 0 ? "+" : ""}${m}%`, x0 - 4, Y(m));
  }
  c.textAlign = "center"; c.textBaseline = "top";
  for (const s of [0, 1, 2, 3]) c.fillText(`${s}%`, X(s), y1 + 4);
  c.fillText("NaCl concentration", (x0 + x1) / 2, y1 + 14);
  const pts = [...potatoPts].sort((a, b) => a.s - b.s);
  if (pts.length > 1) {
    c.strokeStyle = withA(C.amber, 0.5); c.lineWidth = 1.5;
    c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(X(p.s), Y(p.m)) : c.moveTo(X(p.s), Y(p.m)))); c.stroke();
  }
  for (const p of pts) K.sphere(c, X(p.s), Y(p.m), 4, C.amber);
  if (potatoReveal) {
    c.setLineDash([4, 4]); c.strokeStyle = C.green;
    c.beginPath(); c.moveTo(X(potatoIso), y0); c.lineTo(X(potatoIso), y1); c.stroke(); c.setLineDash([]);
  }
}
new ResizeObserver(drawPotato).observe(pc);

K.quiz(panel, [
  { q: "A solution is <strong>hypotonic</strong> to a cell when…", options: [
    "it has a higher solute concentration than the cell's contents",
    "it has a lower solute concentration (more free water) than the cell's contents",
    "it has the same solute concentration as the cell's contents",
    "it contains no water"], answer: 1,
    why: "Hypo = 'under'. A hypotonic solution has fewer dissolved solute particles than the cytoplasm, so there is a net movement of water <strong>into</strong> the cell." },
  { q: "A red blood cell is placed in 3% salt solution. What happens?", options: [
    "Net water moves into the cell and it bursts",
    "Salt moves into the cell until it bursts",
    "Net water moves out of the cell and it shrivels (crenates)",
    "Nothing — the membrane blocks water"], answer: 2,
    why: "3% NaCl is <strong>hypertonic</strong> to blood (≈ 0.9%). Water moves by osmosis from the dilute cytoplasm to the concentrated solution, so the cell shrinks and crenates. The ions themselves can't cross freely." },
  { q: "Why are intravenous (IV) drips made with <strong>0.9% saline</strong> rather than pure water?", options: [
    "0.9% saline is isotonic with blood plasma, so red blood cells neither swell nor shrink",
    "Salt kills bacteria in the drip bag",
    "Pure water would make red blood cells crenate",
    "Red blood cells need salt as food"], answer: 0,
    why: "0.9% NaCl has about the same solute concentration as plasma — <strong>isotonic</strong>. Pure water is hypotonic and would cause haemolysis (bursting) of red blood cells." },
  { q: "In an <strong>isotonic</strong> solution, water molecules…", options: [
    "stop moving completely",
    "only move into the cell",
    "keep crossing the membrane both ways at equal rates, so there is no net movement",
    "only move out of the cell"], answer: 2,
    why: "Molecules never stop moving. Look at the membrane close-up: water still passes through aquaporins in both directions — the rates are just equal (a dynamic equilibrium)." },
  { q: "What is the role of the <strong>cell wall</strong> when a plant cell is in pure water?", options: [
    "It is impermeable, so it keeps the water out",
    "It resists expansion, producing turgor pressure that stops further net water entry",
    "It actively pumps water out of the cell",
    "It makes the cell plasmolyse"], answer: 1,
    why: "The cellulose wall is freely permeable but strong. As the vacuole swells, the wall pushes back (turgor pressure) until water in = water out. The cell becomes turgid instead of bursting." },
  { q: "Osmosis is a type of <strong>passive transport</strong>. This means…", options: [
    "it needs ATP from respiration",
    "water moves down its concentration gradient without the cell using energy",
    "it only happens in plant cells",
    "solute particles are carried across by pumps"], answer: 1,
    why: "Osmosis is the net diffusion of water across a selectively permeable membrane from a region of lower solute concentration to higher solute concentration. It needs no ATP." },
]);

// ---------------------------------------------------------------- chips + explain text
const chipSol = K.chip(overlay), chipIn = K.chip(overlay), chipNet = K.chip(overlay), chipVol = K.chip(overlay), chipState = K.chip(overlay);

function explainHTML() {
  const c = sol(), m = model(), [word, wcol] = tonicity(c), ph = phase(), [plab, pcol] = PHASE_LABEL[ph];
  const who = S.type === "rbc" ? "red blood cell" : "plant cell";
  let html = `<span class="state" style="color:${pcol}">${plab}</span>`;
  html += `<p>The ${who} is in <strong>${c.toFixed(2)}% NaCl</strong>, which is <strong style="color:${wcol}">${word}</strong> to it (its contents ≈ ${m.iso.toFixed(1)}% when normal).</p>`;
  const T = {
    normal: "Water is still crossing the membrane in <strong>both directions</strong> through aquaporins, but at equal rates — no <strong>net</strong> movement. The cell keeps its <strong>biconcave disc</strong> shape. This is why IV drips use <strong>0.9% saline</strong>.",
    swelling: "The outside solution has a <strong>lower solute concentration</strong> than the cytoplasm, so there is a net movement of water <strong>into</strong> the cell by <strong>osmosis</strong>. The solute particles can't cross the membrane to even things out.",
    swollen: "Water has moved <strong>in</strong> by osmosis and the cell has swollen into a rounder shape. Animal cells have <strong>no cell wall</strong>, so only the stretchy membrane holds them together.",
    danger: "The membrane is stretched almost to its limit. Animal cells have <strong>no cell wall</strong> to push back — if more water enters it will <strong>lyse</strong> (burst).",
    lysed: "The membrane ruptured and <strong>haemoglobin</strong> spilled out — this is <strong>haemolysis</strong>. Only an empty membrane 'ghost' is left. Press <strong>New cell</strong> to try again.",
    shrinking: "The solution is more concentrated than the cytoplasm, so there is a net movement of water <strong>out of</strong> the cell by osmosis and it starts to shrink.",
    crenated: "In this <strong>hypertonic</strong> solution water has moved <strong>out</strong>. The red blood cell has shrunk and its membrane has puckered into spikes — <strong>crenation</strong>.",
    turgid: "Water has moved into the large central <strong>vacuole</strong>, pressing the membrane against the <strong>cell wall</strong>. The wall pushes back (<strong>turgor pressure</strong>) until water enters and leaves at the same rate, so the cell is firm — <strong>turgid</strong> — and cannot burst.",
    flaccid: "The protoplast only just fills the cell wall and there is little or no turgor pressure, so the cell is soft — <strong>flaccid</strong> (think of a wilting leaf).",
    plasmolysed: "Net water loss from the vacuole has shrunk the protoplast so the <strong>cell membrane pulls away from the cell wall</strong> — <strong>plasmolysis</strong>. The wall is freely permeable, so salt solution fills the gap. Move it to a hypotonic solution to recover it.",
  };
  html += `<p>${T[ph]}</p>`;
  html += `<p class="note">Not to scale: cells are magnified and molecules simplified. The cell's internal concentration is shown as an NaCl-equivalent; the real solutes are mostly K⁺, sugars and proteins.</p>`;
  return html;
}
let explainCache = "", explainTimer = 0;

// ---------------------------------------------------------------- flags for missions
function updFlags(dt) {
  if (S.type === "rbc" && !cell.lysed) {
    if (cell.V < 0.95 || cell.V > 1.05) F.deviated = true;
    if (cell.V < 0.8) F.cren = true;
    const c = sol();
    if (F.deviated && c >= 0.85 && c <= 0.95 && Math.abs(cell.V - 1) < 0.04 && Math.abs(flux()) < 0.025) F.isoT += dt; else F.isoT = 0;
    if (F.isoT > 1.5) F.iso = true;
  }
  if (S.type === "plant") {
    const ph = phase();
    if (ph === "plasmolysed" && cell.V < model().Vc - 0.05) { F.plasmo = true; F.wasPlasmo = true; }
    if (F.wasPlasmo && ph === "turgid") F.recovered = true;
    if (ph === "turgid" && sol() < 0.05) F.waterT += dt; else F.waterT = 0;
    if (F.waterT > 2) F.plantWater = true;
  }
}

// ---------------------------------------------------------------- main loop
let lastNow = performance.now();
const L = K.loop((dt, t) => {
  const now = performance.now();
  const rdt = Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;
  S.t = t;
  layTimer += rdt;
  if (layoutDirty || layTimer > 0.5 || !Lay) { layout(); layoutDirty = false; layTimer = 0; }

  physics(dt);
  updFlags(dt);
  updMol(dt, rdt);
  updCrystals(rdt);
  updFrags(dt);
  histAcc += dt;
  if (histAcc >= 0.2) {
    histAcc = 0;
    if (!cell.lysed) hist.push({ t: S.t, v: cell.V * 100 });
    if (hist.length > 320) hist.shift();
  }

  // draw
  K.backdrop(ctx, stage.w, stage.h, S.type === "rbc" ? "#2a1430" : "#0d3b44");
  for (const d of dust) {
    const x = ((d.u * stage.w + t * 6 * d.z) % (stage.w + 20)) - 10;
    const y = d.v * stage.h + Math.sin(t * 0.3 + d.p) * 8 * d.z;
    ctx.fillStyle = `rgba(160,200,255,${0.05 + d.z * 0.08})`;
    ctx.beginPath(); ctx.arc(x, y, 0.8 + d.z * 1.6, 0, TAU); ctx.fill();
  }
  drawCellView(t, rdt);
  drawMol(t);
  drawGraph();

  // readouts
  const J = flux();
  chipSol(`Solution <b>${sol().toFixed(2)}% NaCl</b>`);
  chipIn(`Cell internal <b>${cell.lysed ? "—" : internal().toFixed(2) + "%"}</b>`);
  chipNet(`Net water <b>${cell.lysed ? "—" : Math.abs(J) < 0.02 ? "≈ none (balanced)" : J > 0 ? "into cell ↓" : "out of cell ↑"}</b>`);
  chipVol(`${S.type === "rbc" ? "Cell" : "Protoplast"} volume <b>${cell.lysed ? "burst" : Math.round(cell.V * 100) + "%"}</b>`);
  const [plab, pcol] = PHASE_LABEL[phase()];
  chipState(`State <b style="color:${pcol}">${plab}</b>`);

  explainTimer += rdt;
  if (explainTimer > 0.25) {
    explainTimer = 0;
    const html = explainHTML();
    if (html !== explainCache) { explainCache = html; explainBody.innerHTML = html; }
  }
  mis.update();
});
L.speed = reduceMotion ? 0.5 : 1;
newCell();
