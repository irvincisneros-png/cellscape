// Membrane Transport — rendering. Everything is drawn in CSS pixels from the model's layout.
import * as K from "../../assets/js/kit.js";
import { SP, ORDER } from "./model.js";

const { TAU, C } = K;

// ---------- sprite cache (pre-rendered glossy molecules, cheap to blit) ----------
const cache = new Map();
function sprite(key, radius, dpr, paint) {
  const k = `${key}|${radius.toFixed(2)}|${dpr}`;
  let s = cache.get(k);
  if (s) return s;
  const half = Math.ceil(radius * 2.1);
  const cv = document.createElement("canvas");
  cv.width = cv.height = Math.ceil(half * 2 * dpr);
  const c = cv.getContext("2d");
  c.scale(dpr, dpr);
  c.translate(half, half);
  paint(c, radius);
  s = { cv, half };
  if (cache.size > 160) cache.clear();
  cache.set(k, s);
  return s;
}

function halo(c, r, color, a = 0.32, k = 2) {
  const g = c.createRadialGradient(0, 0, r * 0.4, 0, 0, r * k);
  g.addColorStop(0, K.withAlpha(color, a));
  g.addColorStop(1, K.withAlpha(color, 0));
  c.fillStyle = g;
  c.beginPath(); c.arc(0, 0, r * k, 0, TAU); c.fill();
}

function plus(c, r) {
  c.strokeStyle = "rgba(255,255,255,0.92)";
  c.lineWidth = Math.max(1.2, r * 0.22);
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(-r * 0.42, 0); c.lineTo(r * 0.42, 0);
  c.moveTo(0, -r * 0.42); c.lineTo(0, r * 0.42);
  c.stroke();
}

const PAINT = {
  o2(c, r) {
    halo(c, r, SP.o2.color);
    K.sphere(c, -r * 0.4, 0, r * 0.62, SP.o2.color);
    K.sphere(c, r * 0.4, 0, r * 0.62, SP.o2.color);
  },
  co2(c, r) {
    halo(c, r, SP.co2.color, 0.25);
    K.sphere(c, -r * 0.68, 0, r * 0.46, "#cbd5e1");
    K.sphere(c, r * 0.68, 0, r * 0.46, "#cbd5e1");
    K.sphere(c, 0, 0, r * 0.5, "#475569");
  },
  h2o(c, r) {
    halo(c, r, SP.h2o.color, 0.28);
    K.sphere(c, -r * 0.55, r * 0.42, r * 0.36, "#f1f5f9");
    K.sphere(c, r * 0.55, r * 0.42, r * 0.36, "#f1f5f9");
    K.sphere(c, 0, -r * 0.05, r * 0.66, SP.h2o.color);
  },
  glc(c, r) {
    halo(c, r, SP.glc.color, 0.3);
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + Math.PI / 6;
      c[i ? "lineTo" : "moveTo"](Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
    }
    c.closePath();
    const g = c.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
    g.addColorStop(0, K.shade(SP.glc.color, 0.55));
    g.addColorStop(0.6, SP.glc.color);
    g.addColorStop(1, K.shade(SP.glc.color, -0.45));
    c.fillStyle = g; c.fill();
    c.strokeStyle = K.shade(SP.glc.color, 0.4); c.lineWidth = 1.2; c.stroke();
    c.fillStyle = "rgba(10,30,5,0.55)";
    c.beginPath(); c.arc(0, 0, r * 0.3, 0, TAU); c.fill();
    K.sphere(c, Math.cos(-Math.PI / 6) * r * 0.9, Math.sin(-Math.PI / 6) * r * 0.9, r * 0.22, "#ff6b6b");
  },
  na(c, r) { halo(c, r, SP.na.color, 0.4); K.sphere(c, 0, 0, r, SP.na.color); plus(c, r); },
  k(c, r) { halo(c, r, SP.k.color, 0.4); K.sphere(c, 0, 0, r, SP.k.color); plus(c, r); },
  prot(c, r) {
    halo(c, r, SP.prot.color, 0.25, 1.7);
    const blobs = [[-0.42, -0.3, 0.5], [0.38, -0.36, 0.46], [0.5, 0.25, 0.44], [-0.1, 0.42, 0.48], [-0.55, 0.25, 0.38], [0.02, -0.02, 0.52]];
    for (const [x, y, rr] of blobs) K.sphere(c, x * r, y * r, rr * r, SP.prot.color);
  },
  atp(c, r) {
    halo(c, r, C.amber, 0.45, 2.2);
    for (let i = 0; i < 3; i++) K.sphere(c, r * (0.55 + i * 0.5), r * 0.35, r * 0.3, "#fb923c");
    K.sphere(c, -r * 0.2, 0, r * 0.8, C.amber);
  },
  adp(c, r) {
    halo(c, r, C.amber, 0.3, 1.8);
    for (let i = 0; i < 2; i++) K.sphere(c, r * (0.55 + i * 0.5), r * 0.35, r * 0.3, "#fb923c");
    K.sphere(c, -r * 0.2, 0, r * 0.8, K.mix(C.amber, "#000000", 0.25));
  },
  pi(c, r) { halo(c, r, "#fb923c", 0.5, 2.2); K.sphere(c, 0, 0, r * 0.6, "#fb923c"); },
  head(c, r) { K.sphere(c, 0, 0, r, C.lipidHead); },
};

export function drawSprite(ctx, key, x, y, r, dpr, rot = 0, alpha = 1) {
  const s = sprite(key, r, dpr, PAINT[key]);
  if (alpha <= 0) return;
  const ga = ctx.globalAlpha;
  ctx.globalAlpha = ga * alpha;
  if (rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.drawImage(s.cv, -s.half, -s.half, s.half * 2, s.half * 2);
    ctx.restore();
  } else ctx.drawImage(s.cv, x - s.half, y - s.half, s.half * 2, s.half * 2);
  ctx.globalAlpha = ga;
}

// ---------- background ----------
let specks = null, fibres = null;
function initBg() {
  specks = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: K.rand(0.6, 1.8), z: K.rand(0.3, 1), a: K.rand(0.08, 0.25) }));
  fibres = Array.from({ length: 7 }, () => ({ x0: Math.random(), y0: K.rand(0.15, 1), x1: Math.random(), y1: K.rand(0.15, 1), cx: Math.random(), cy: Math.random(), w: K.rand(1, 2.4) }));
}

export function drawBackground(ctx, M, t) {
  const L = M.L, { w, h } = L;
  if (!specks) initBg();
  K.backdrop(ctx, w, h, "#0d3b44");
  // cytoplasm wash
  const g = ctx.createLinearGradient(0, L.midY, 0, L.uh);
  g.addColorStop(0, "rgba(76,40,120,0.30)");
  g.addColorStop(1, "rgba(40,24,80,0.45)");
  ctx.fillStyle = g;
  ctx.fillRect(0, L.midY, w, L.uh - L.midY);
  // extracellular wash
  const g2 = ctx.createLinearGradient(0, 0, 0, L.midY);
  g2.addColorStop(0, "rgba(20,90,110,0.18)");
  g2.addColorStop(1, "rgba(20,90,110,0.05)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, w, L.midY);
  // faint cytoskeleton fibres (far layer)
  ctx.save();
  ctx.strokeStyle = "rgba(167,139,250,0.08)";
  ctx.lineCap = "round";
  for (const f of fibres) {
    const y = (v) => L.memBot + 20 + v * (L.uh - L.memBot - 20);
    ctx.lineWidth = f.w;
    ctx.beginPath();
    ctx.moveTo(f.x0 * w, y(f.y0));
    ctx.quadraticCurveTo(f.cx * w + Math.sin(t * 0.2 + f.cx * 9) * 10, y(f.cy), f.x1 * w, y(f.y1));
    ctx.stroke();
  }
  ctx.restore();
  // drifting specks (parallax)
  ctx.save();
  for (const s of specks) {
    const x = (((s.x + t * 0.006 * s.z) % 1) + 1) % 1 * w;
    const y = (s.y * L.uh + Math.sin(t * 0.3 + s.x * 20) * 6 * s.z);
    ctx.fillStyle = `rgba(200,225,255,${s.a})`;
    ctx.beginPath(); ctx.arc(x, y, s.r * s.z, 0, TAU); ctx.fill();
  }
  ctx.restore();
  // compartment names, vertical along the left edge
  ctx.save();
  ctx.font = `600 ${Math.round(10 * Math.max(1, L.sc))}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = "rgba(159,179,207,0.55)";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const vt = (txt, cy) => { ctx.save(); ctx.translate(9, cy); ctx.rotate(-Math.PI / 2); ctx.fillText(txt, 0, 0); ctx.restore(); };
  const fit = (long, short, room) => (ctx.measureText(long).width < room - 24 ? long : short);
  vt(fit("OUTSIDE · EXTRACELLULAR FLUID", "OUTSIDE", L.memTop - 50), L.memTop / 2 + 25);
  vt(fit("INSIDE · CYTOPLASM", "INSIDE", L.uh - L.memBot), (L.memBot + L.uh) / 2);
  ctx.restore();
}

// ---------- membrane ----------
function resample(pts, step) {
  const out = [];
  let acc = step / 2;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const seg = Math.hypot(bx - ax, by - ay);
    if (seg === 0) continue;
    const tx = (bx - ax) / seg, ty = (by - ay) / seg;
    while (acc <= seg) {
      out.push({ x: ax + tx * acc, y: ay + ty * acc, tx, ty });
      acc += step;
    }
    acc -= seg;
  }
  return out;
}

/** Draw a bilayer along a polyline (or closed circle). skip(x,y) leaves gaps for proteins. */
function bilayerAlong(ctx, pts, L, t, dpr, skip, closed = false) {
  const hr = L.headR, half = L.th / 2;
  // hydrophobic core
  ctx.save();
  ctx.lineJoin = "round"; ctx.lineCap = closed ? "round" : "butt";
  ctx.beginPath();
  pts.forEach(([x, y], i) => ctx[i ? "lineTo" : "moveTo"](x, y));
  if (closed) ctx.closePath();
  ctx.strokeStyle = "rgba(58,40,26,0.92)";
  ctx.lineWidth = L.th - hr * 1.4;
  ctx.stroke();
  ctx.strokeStyle = "rgba(120,86,50,0.22)";
  ctx.lineWidth = (L.th - hr * 1.4) * 0.35;
  ctx.stroke();
  ctx.restore();

  const samples = resample(closed ? [...pts, pts[0]] : pts, hr * 2.05);
  // tails (one batched path)
  ctx.save();
  ctx.strokeStyle = "rgba(150,112,72,0.75)";
  ctx.lineWidth = Math.max(1, hr * 0.22);
  ctx.beginPath();
  const heads = [];
  for (const s of samples) {
    if (skip && skip(s.x, s.y)) continue;
    const nx = s.ty, ny = -s.tx; // points toward the outside (extracellular) leaflet
    const wob = Math.sin(s.x * 0.05 + s.y * 0.03 + t * 1.5) * hr * 0.16;
    for (const sg of [1, -1]) {
      const hx = s.x + nx * sg * (half - hr + wob), hy = s.y + ny * sg * (half - hr + wob);
      heads.push(hx, hy);
      for (const o of [-0.35, 0.35]) {
        const bx = hx + s.tx * hr * o, by = hy + s.ty * hr * o;
        const ex = s.x + nx * sg * 2 + s.tx * hr * o, ey = s.y + ny * sg * 2 + s.ty * hr * o;
        const k = Math.sin(t * 1.3 + s.x * 0.7 + o * 9) * hr * 0.35;
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo((bx + ex) / 2 + s.tx * k, (by + ey) / 2 + s.ty * k, ex, ey);
      }
    }
  }
  ctx.stroke();
  ctx.restore();
  for (let i = 0; i < heads.length; i += 2) drawSprite(ctx, "head", heads[i], heads[i + 1], hr, dpr);
}

export function drawMembrane(ctx, M, t, dpr) {
  const L = M.L;
  const gaps = M.prot.map((P) => ({ x: P.x, hw: protW(P, L) / 2 + L.headR * 0.2 }));
  const skip = (x, y) => Math.abs(y - L.midY) < 3 && gaps.some((g) => Math.abs(x - g.x) < g.hw);
  bilayerAlong(ctx, M.membraneLine(), L, t, dpr, skip);
}

export function drawVesicle(ctx, M, t, dpr) {
  const V = M.ves.vesicle, L = M.L;
  if (!V || V.a <= 0) return;
  ctx.save();
  ctx.globalAlpha = V.a;
  // lumen holds extracellular fluid
  ctx.fillStyle = "rgba(13,59,68,0.85)";
  ctx.beginPath(); ctx.arc(V.x, V.y, Math.max(2, V.R - L.th / 2), 0, TAU); ctx.fill();
  const pts = [];
  for (let i = 0; i < 40; i++) { const a = (i / 40) * TAU; pts.push([V.x + Math.cos(a) * V.R, V.y + Math.sin(a) * V.R]); }
  bilayerAlong(ctx, pts, L, t, dpr, null, true);
  ctx.restore();
}

// ---------- proteins ----------
export function protW(P, L) {
  return P.kind === "pump" ? L.pw * 1.56 : P.kind === "carrier" ? L.pw * 1.24 : L.pw;
}

/** Left half of a two-part membrane protein; inner edge follows gaps at top/middle/bottom. */
function halfPath(ctx, cx, cy, W, H, gT, gM, gB) {
  const top = cy - H / 2, bot = cy + H / 2, xo = cx - W / 2, rr = Math.min(W * 0.2, 12);
  ctx.beginPath();
  ctx.moveTo(xo + rr, top);
  ctx.lineTo(cx - gT / 2, top);
  ctx.quadraticCurveTo(cx - gM + (gT + gB) / 4, cy, cx - gB / 2, bot);
  ctx.lineTo(xo + rr, bot);
  ctx.quadraticCurveTo(xo - W * 0.12, cy, xo + rr, top);
  ctx.closePath();
}

function twoHalves(ctx, cx, cy, W, H, gT, gM, gB, color, tilt = 0) {
  for (const side of [1, -1]) {
    ctx.save();
    if (side < 0) { ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0); }
    if (tilt) { ctx.translate(cx, cy); ctx.rotate(tilt * side); ctx.translate(-cx, -cy); }
    halfPath(ctx, cx, cy, W, H, gT, gM, gB);
    const g = ctx.createLinearGradient(cx - W / 2, 0, cx, 0);
    g.addColorStop(0, K.shade(color, -0.5));
    g.addColorStop(0.4, K.shade(color, 0.25));
    g.addColorStop(0.85, color);
    g.addColorStop(1, K.shade(color, -0.3));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = K.withAlpha("#ffffff", 0.16);
    ctx.lineWidth = 1;
    ctx.stroke();
    // helix hints
    ctx.strokeStyle = K.withAlpha("#000000", 0.18);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 4; i++) {
      const x = cx - W / 2 + (W / 2) * (i / 4.2);
      ctx.moveTo(x, cy - H * 0.38); ctx.lineTo(x + 2, cy + H * 0.38);
    }
    ctx.stroke();
    ctx.restore();
  }
}

export function drawProteins(ctx, M, t, dpr, opts) {
  const L = M.L, s = L.sc, cy = L.midY, H = L.protH;
  for (const P of M.prot) {
    const W = protW(P, L), cx = P.x;
    K.glow(ctx, cx, cy, W * 1.2, P.color, 0.14 + P.flash * 0.3 + (opts.hover === P.id ? 0.18 : 0));
    if (P.kind === "channel") {
      const o = P.openAnim;
      // pore lumen
      ctx.fillStyle = K.withAlpha(P.color, 0.12 + 0.2 * o);
      ctx.fillRect(cx - 6 * s, cy - H / 2, 12 * s, H);
      if (P.id === "aqp") twoHalves(ctx, cx, cy, W, H, 12 * s, K.lerp(0, 5 * s, o), 12 * s, P.color);
      else {
        if (P.id === "nach") { // voltage-sensor domains
          K.sphere(ctx, cx - W * 0.56, cy - H * 0.05, W * 0.18, K.mix(P.color, "#000000", 0.2));
          K.sphere(ctx, cx + W * 0.56, cy - H * 0.05, W * 0.18, K.mix(P.color, "#000000", 0.2));
        }
        twoHalves(ctx, cx, cy, W, H, 11 * s, 6 * s, K.lerp(0, 14 * s, o), P.color);
        // selectivity filter
        for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
          ctx.fillStyle = "rgba(251,191,36,0.85)";
          ctx.beginPath(); ctx.arc(cx + sx * 4.2 * s, cy - H * 0.3 + i * 4 * s, 1.4 * s, 0, TAU); ctx.fill();
        }
      }
      if (o < 0.5) { // closed gate bar
        ctx.strokeStyle = "rgba(248,113,113,0.85)";
        ctx.lineWidth = 2.5 * s; ctx.lineCap = "round";
        const gy = P.id === "aqp" ? cy : cy + H * 0.42;
        ctx.beginPath(); ctx.moveTo(cx - 7 * s, gy); ctx.lineTo(cx + 7 * s, gy); ctx.stroke();
      }
    } else if (P.kind === "carrier") {
      const g = M.glut, u = (g.c + 1) / 2; // 0 = open to outside, 1 = open to inside
      ctx.fillStyle = K.withAlpha(P.color, 0.18);
      ctx.fillRect(cx - 8 * s, cy - H * 0.45, 16 * s, H * 0.9);
      twoHalves(ctx, cx, cy, W, H, K.lerp(22 * s, 0, u), 12 * s, K.lerp(0, 22 * s, u), P.color, (0.5 - u) * 0.12);
      if (g.blocked) {
        K.sphere(ctx, cx, L.memTop - 4 * s, 7 * s, "#ef4444", { glow: 10 });
        ctx.strokeStyle = "rgba(248,113,113,0.8)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, W * 0.62, 0, TAU); ctx.stroke();
      }
    } else if (P.kind === "pump") {
      const pp = M.pump, c = pp.c;
      // cytoplasmic domains (actuator / phosphorylation / nucleotide-binding)
      K.blob(ctx, cx + W * 0.08, L.memBot + H * 0.3, W * 0.95, H * 0.46, K.mix(P.color, "#0b3b5a", 0.35));
      K.sphere(ctx, cx + L.pw * 0.32, L.memBot + H * 0.42, W * 0.22, K.mix(P.color, "#fbbf24", 0.25));
      // β-subunit on the outer face
      K.blob(ctx, cx - W * 0.5, L.memTop - H * 0.08, W * 0.3, H * 0.42, "#5eead4");
      twoHalves(ctx, cx, cy, W, H, K.lerp(0, 16 * s, c), 10 * s, K.lerp(16 * s, 0, c), P.color);
      if (pp.phos) {
        K.sphere(ctx, cx - W * 0.1, L.memBot + H * 0.22, 5 * s, "#fb923c", { glow: 8 });
        ctx.fillStyle = "#1a0d00"; ctx.font = `700 ${Math.round(7 * s)}px Inter, sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("P", cx - W * 0.1, L.memBot + H * 0.22 + 0.5);
      }
      if (pp.flash > 0) K.glow(ctx, cx, cy + H * 0.2, W * 1.6, C.amber, 0.55 * pp.flash);
      if (M.feeding) {
        ctx.strokeStyle = K.withAlpha(C.amber, 0.5 + 0.3 * Math.sin(t * 10));
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy + H * 0.15, W * 0.85, 0, TAU); ctx.stroke();
      }
      if (pp.fly) {
        const e = K.easeInOut(pp.fly.t);
        const x = K.lerp(pp.fly.from.x, pp.fly.to.x, e), y = K.lerp(pp.fly.from.y, pp.fly.to.y, e);
        K.glow(ctx, x, y, 22 * s, C.amber, 0.5);
        drawSprite(ctx, "atp", x, y, 6 * s, dpr);
      }
    }
  }
}

export function drawProteinLabels(ctx, M, opts) {
  const L = M.L, narrow = L.w < 640, size = narrow ? 10 : 11;
  M.prot.forEach((P, i) => {
    const up = narrow && i % 2 === 1 ? 16 : 0;
    const name = narrow ? P.tiny : P.short;
    K.label(ctx, name, P.x, L.memTop - L.protH * 0.42 - 12 - up, { size, color: P.color });
    let st = "", col = C.inkDim;
    if (P.kind === "channel") { st = P.open ? "open" : "closed"; col = P.open ? C.green : C.red; }
    else if (P.kind === "carrier") { st = M.glut.blocked ? "blocked" : M.glut.cargo ? "carrying" : ""; col = M.glut.blocked ? C.red : C.green; }
    else if (P.kind === "pump") { st = M.pumpStatus(); col = M.pump.waiting ? C.red : C.amber; }
    if (st) {
      const y = P.kind === "pump" ? L.memBot + L.protH * 0.62 + 10 : L.memBot + L.protH * 0.25 + 12 + up;
      K.label(ctx, st, P.x, y, { size: size - 1, color: col });
    }
  });
}

// ---------- particles ----------
export function drawParticles(ctx, M, dpr, filter) {
  const s = M.L.sc;
  for (const p of M.parts) {
    if (!filter(p)) continue;
    const r = SP[p.sp].r * s;
    const rot = p.sp === "na" || p.sp === "k" ? 0 : p.rot;
    drawSprite(ctx, p.sp, p.x, p.y, r, dpr, rot, p.mode === "transit" && p.tr.via === "lipid" ? 0.85 : 1);
  }
}

export function drawAtpDots(ctx, M, dpr) {
  const s = M.L.sc;
  for (const d of M.atpDots) drawSprite(ctx, "atp", d.x, d.y, 5.5 * s, dpr, Math.sin(d.rot) * 0.4, d.a * 0.95);
}

export function drawFx(ctx, M, dpr) {
  const s = M.L.sc, F = M.fx;
  for (const f of F.flashes) K.glow(ctx, f.x, f.y, f.r * (0.6 + f.t), f.color, 0.7 * (1 - f.t));
  for (const sp of F.sprites) {
    const a = 1 - sp.t;
    drawSprite(ctx, sp.kind === "ADP" ? "adp" : "pi", sp.x, sp.y, 5.5 * s, dpr, 0, a);
    ctx.save(); ctx.globalAlpha = a;
    K.label(ctx, sp.kind, sp.x, sp.y + 13 * s, { size: 10, color: C.amber, bg: null });
    ctx.restore();
  }
  for (const f of F.floaters) {
    ctx.save();
    ctx.globalAlpha = f.t < 0.15 ? f.t / 0.15 : 1 - Math.max(0, (f.t - 0.6) / 0.4);
    K.label(ctx, f.text, f.x, f.y, { size: 12, color: f.color });
    ctx.restore();
  }
}

const INFO = {
  o2: "small, non-polar → straight through the lipids",
  co2: "small, non-polar → straight through the lipids",
  h2o: "small but polar → mostly via aquaporins",
  glc: "large & polar → needs the GLUT carrier",
  na: "charged ion → needs a channel or the pump",
  k: "charged ion → needs a channel or the pump",
  prot: "too big for any protein → vesicles only",
};

export function drawInspect(ctx, M) {
  const I = M.inspect;
  if (!I) return;
  const p = I.p, L = M.L, r = SP[p.sp].r * L.sc;
  const a = Math.min(1, (4 - (M.time - I.t)) / 0.5);
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.arc(p.x, p.y, r + 7, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  const above = p.y > 60;
  const y = above ? p.y - r - 30 : p.y + r + 30;
  const x = K.clamp(p.x, 120, L.w - 120);
  K.label(ctx, `${SP[p.sp].long} (${SP[p.sp].name})`, x, y - 9, { size: 12, color: SP[p.sp].color });
  K.label(ctx, INFO[p.sp], x, y + 11, { size: 11, color: C.ink });
  ctx.restore();
}

// ---------- palette ----------
export function paletteRects(L) {
  const n = ORDER.length, pad = 8;
  const tw = Math.min(84, (L.w - pad * 2 - (n - 1) * 6) / n);
  const total = n * tw + (n - 1) * 6;
  const x0 = Math.max(pad, (L.w - total) / 2);
  const y = L.uh + 6, h = L.palH - 12;
  return ORDER.map((sp, i) => ({ sp, x: x0 + i * (tw + 6), y, w: tw, h }));
}

export function drawPalette(ctx, M, dpr, sel, drag) {
  const L = M.L;
  ctx.fillStyle = "rgba(5,11,22,0.88)";
  ctx.fillRect(0, L.uh, L.w, L.palH);
  ctx.strokeStyle = "rgba(120,190,255,0.16)";
  ctx.beginPath(); ctx.moveTo(0, L.uh + 0.5); ctx.lineTo(L.w, L.uh + 0.5); ctx.stroke();
  for (const R of paletteRects(L)) {
    const on = R.sp === sel;
    K.roundRect(ctx, R.x, R.y, R.w, R.h, 10);
    ctx.fillStyle = on ? K.withAlpha(SP[R.sp].color, 0.18) : "rgba(255,255,255,0.04)";
    ctx.fill();
    ctx.strokeStyle = on ? SP[R.sp].color : "rgba(120,190,255,0.14)";
    ctx.lineWidth = on ? 1.5 : 1;
    ctx.stroke();
    const rr = Math.min(SP[R.sp].r * 1.15, R.h * 0.26);
    drawSprite(ctx, R.sp, R.x + R.w / 2, R.y + R.h * 0.36, rr, dpr);
    ctx.font = `600 ${R.w < 52 ? 9 : 10.5}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = on ? C.ink : C.inkDim;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(R.w < 60 ? SP[R.sp].short : SP[R.sp].name, R.x + R.w / 2, R.y + R.h * 0.8);
  }
  if (drag && drag.moved) {
    const side = drag.y < L.memTop ? "outside" : drag.y > L.memBot && drag.y < L.uh ? "inside" : null;
    drawSprite(ctx, drag.sp, drag.x, drag.y, SP[drag.sp].r * L.sc * 1.4, dpr, 0, 0.9);
    K.label(ctx, side ? `Drop to add 5 ${side}` : "Drop above or below the membrane", drag.x, drag.y - 28, { size: 11, color: side ? C.ink : C.red });
  }
}

// ---------- inset chart ----------
export function drawChart(ctx, x, y, w, h, counts, opts = {}) {
  ctx.save();
  if (opts.panel !== false) {
    K.roundRect(ctx, x, y, w, h, 10);
    ctx.fillStyle = "rgba(5,11,22,0.78)"; ctx.fill();
    ctx.strokeStyle = "rgba(120,190,255,0.16)"; ctx.stroke();
  }
  ctx.font = "600 10px Inter, system-ui, sans-serif";
  ctx.textBaseline = "middle"; ctx.textAlign = "left";
  ctx.fillStyle = C.inkDim;
  ctx.fillText("Concentration", x + 10, y + 11);
  // key
  ctx.fillStyle = "rgba(232,241,255,0.35)"; ctx.fillRect(x + w - 104, y + 7, 8, 8);
  ctx.fillStyle = C.inkDim; ctx.fillText("out", x + w - 92, y + 11);
  ctx.fillStyle = "rgba(232,241,255,0.95)"; ctx.fillRect(x + w - 62, y + 7, 8, 8);
  ctx.fillStyle = C.inkDim; ctx.fillText("in", x + w - 50, y + 11);
  const top = y + 22, bot = y + h - 16, gx = x + 8, gw = w - 16;
  let max = 10;
  for (const sp of ORDER) max = Math.max(max, counts[sp].out, counts[sp].in);
  max = Math.ceil(max / 10) * 10;
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath(); ctx.moveTo(gx, bot + 0.5); ctx.lineTo(gx + gw, bot + 0.5); ctx.stroke();
  const n = ORDER.length, gwid = gw / n, bw = Math.max(3, gwid * 0.32);
  ORDER.forEach((sp, i) => {
    const cx = gx + gwid * (i + 0.5), col = SP[sp].color;
    const ho = ((bot - top) * counts[sp].out) / max, hi = ((bot - top) * counts[sp].in) / max;
    ctx.fillStyle = K.withAlpha(col, 0.35);
    ctx.fillRect(cx - bw - 1, bot - ho, bw, ho);
    ctx.strokeStyle = K.withAlpha(col, 0.8); ctx.lineWidth = 1;
    ctx.strokeRect(cx - bw - 0.5, bot - ho + 0.5, bw - 1, Math.max(0, ho - 1));
    ctx.fillStyle = col;
    ctx.fillRect(cx + 1, bot - hi, bw, hi);
    ctx.fillStyle = C.inkDim; ctx.textAlign = "center";
    ctx.fillText(SP[sp].short, cx, bot + 8);
  });
  ctx.restore();
}
