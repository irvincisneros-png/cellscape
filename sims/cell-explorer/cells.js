// Cell Explorer — world geometry (units: micrometres), drawing with level of detail, hit testing.
// Every cell is drawn in world space: the caller sets ctx.setTransform() from the camera.
import * as K from "../../assets/js/kit.js";
import { COL } from "./info.js";

const { TAU, clamp } = K;

// ---------- shared helpers ----------
export function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let GA = 1; // global alpha of the cell currently being drawn (for cross-fades)
const al = (ctx, a = 1) => { ctx.globalAlpha = GA * a; };

/** log-scale fade: 0 below zoom a, 1 above zoom b. */
export const lod = (s, a, b) => clamp(Math.log(s / a) / Math.log(b / a), 0, 1);

const gradCache = new Map();
function unitGrad(ctx, col) {
  let g = gradCache.get(col);
  if (!g) {
    g = ctx.createRadialGradient(-0.35, -0.4, 0.08, 0, 0, 1);
    g.addColorStop(0, K.shade(col, 0.55));
    g.addColorStop(0.55, col);
    g.addColorStop(1, K.shade(col, -0.45));
    gradCache.set(col, g);
  }
  return g;
}
/** Glossy sphere using a cached unit gradient (cheap; respects the cross-fade alpha). */
function ball(ctx, x, y, r, col) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(r, r);
  ctx.fillStyle = unitGrad(ctx, col);
  ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill();
  ctx.restore();
}

function mkPoly(arr) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < arr.length; i += 2) {
    x0 = Math.min(x0, arr[i]); x1 = Math.max(x1, arr[i]);
    y0 = Math.min(y0, arr[i + 1]); y1 = Math.max(y1, arr[i + 1]);
  }
  return { p: arr, bb: [x0, y0, x1, y1] };
}
const polyVis = (pl, v, pad = 0.3) => pl.bb[2] + pad > v.x0 && pl.bb[0] - pad < v.x1 && pl.bb[3] + pad > v.y0 && pl.bb[1] - pad < v.y1;
const inView = (v, x, y, r) => x + r > v.x0 && x - r < v.x1 && y + r > v.y0 && y - r < v.y1;

function tracePoly(ctx, p) {
  const n = p.length;
  ctx.moveTo(p[0], p[1]);
  if (n < 6) { if (n >= 4) ctx.lineTo(p[2], p[3]); return; }
  for (let i = 2; i < n - 2; i += 2) {
    ctx.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[i + 2]) / 2, (p[i + 1] + p[i + 3]) / 2);
  }
  ctx.lineTo(p[n - 2], p[n - 1]);
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}
function distPoly(x, y, p) {
  let b = Infinity;
  for (let i = 0; i < p.length - 2; i += 2) b = Math.min(b, segDist(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]));
  return b;
}
function nearestInFlat(x, y, p) {
  let bi = 0, bd = Infinity;
  for (let i = 0; i < p.length; i += 2) {
    const d = (p[i] - x) ** 2 + (p[i + 1] - y) ** 2;
    if (d < bd) { bd = d; bi = i; }
  }
  return { x: p[bi], y: p[bi + 1], i: bi, d: Math.sqrt(bd) };
}
function nearestObj(x, y, arr, posFn) {
  let best = null, bd = Infinity;
  for (const o of arr) {
    const q = posFn(o);
    const d = (q.x - x) ** 2 + (q.y - y) ** 2;
    if (d < bd) { bd = d; best = { o, x: q.x, y: q.y, d: Math.sqrt(d) }; }
  }
  return best;
}
const jig = (o, t, amp) => ({
  x: o.x + amp * Math.sin(t * o.f1 + o.p1),
  y: o.y + amp * Math.cos(t * o.f2 + o.p2),
  a: (o.a || 0) + 0.08 * Math.sin(t * o.f3 + o.p3),
});
const addJig = (o, R) => Object.assign(o, { f1: 0.3 + R() * 0.5, f2: 0.3 + R() * 0.5, f3: 0.2 + R() * 0.3, p1: R() * TAU, p2: R() * TAU, p3: R() * TAU });

/** Signed distance to a rounded rectangle centred at the origin. */
export function sdRR(x, y, hx, hy, r) {
  const qx = Math.abs(x) - (hx - r), qy = Math.abs(y) - (hy - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
/** Point + unit tangent at fraction u along a rounded rect perimeter (starts top-left, runs +x). */
function rrPoint(hx, hy, r, u) {
  const a = 2 * (hx - r), b = 2 * (hy - r), q = (Math.PI * r) / 2, P = 2 * a + 2 * b + 4 * q;
  let d = (((u % 1) + 1) % 1) * P;
  const segs = [
    [a, 0, -hx + r, -hy, 1, 0], [q, 1, hx - r, -(hy - r), -Math.PI / 2],
    [b, 0, hx, -(hy - r), 0, 1], [q, 1, hx - r, hy - r, 0],
    [a, 0, hx - r, hy, -1, 0], [q, 1, -(hx - r), hy - r, Math.PI / 2],
    [b, 0, -hx, hy - r, 0, -1], [q, 1, -(hx - r), -(hy - r), Math.PI],
  ];
  for (const g of segs) {
    if (d <= g[0] || g === segs[7]) {
      if (g[1] === 0) return { x: g[2] + g[4] * d, y: g[3] + g[5] * d, tx: g[4], ty: g[5] };
      const ang = g[4] + d / r;
      return { x: g[2] + Math.cos(ang) * r, y: g[3] + Math.sin(ang) * r, tx: -Math.sin(ang), ty: Math.cos(ang) };
    }
    d -= g[0];
  }
}
const rrLen = (hx, hy, r) => 4 * (hx - r) + 4 * (hy - r) + 2 * Math.PI * r;

function computeNormals(p, nrm) {
  const n = p.length / 2;
  for (let i = 0; i < n; i++) {
    const a = ((i - 1 + n) % n) * 2, b = ((i + 1) % n) * 2;
    const tx = p[b] - p[a], ty = p[b + 1] - p[a + 1], L = Math.hypot(tx, ty) || 1;
    nrm[i * 2] = ty / L; nrm[i * 2 + 1] = -tx / L;
  }
}
/** Closed boundary path offset by d along normals; clip=true skips points outside the view. */
function boundaryPath(ctx, p, nrm, d, v, clip) {
  ctx.beginPath();
  const n = p.length / 2, pad = 0.05 + 30 * v.px;
  let pen = false;
  for (let i = 0; i <= n; i++) {
    const j = (i % n) * 2;
    const x = p[j] + nrm[j] * d, y = p[j + 1] + nrm[j + 1] * d;
    if (clip && (x < v.x0 - pad || x > v.x1 + pad || y < v.y0 - pad || y > v.y1 + pad)) { pen = false; continue; }
    if (pen) ctx.lineTo(x, y); else { ctx.moveTo(x, y); pen = true; }
  }
}
/** Cell membrane with level of detail: glowing line → phospholipid bilayer. */
function drawMembrane(ctx, v, p, nrm, col = COL.membrane) {
  const s = v.s, clip = s > 150;
  ctx.lineJoin = "round";
  boundaryPath(ctx, p, nrm, 0, v, clip);
  al(ctx, 0.16); ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.03, 8 * v.px); ctx.stroke();
  const f = lod(s, 500, 1100);
  if (f < 1) {
    al(ctx, 0.95 * (1 - f)); ctx.lineWidth = Math.max(0.008, 2.2 * v.px); ctx.stroke();
  }
  if (f > 0) {
    // hydrophobic tails (middle) and two layers of phosphate heads
    al(ctx, 0.75 * f); ctx.strokeStyle = "#7a6248"; ctx.lineWidth = 0.0045; ctx.stroke();
    al(ctx, f); ctx.strokeStyle = col; ctx.lineWidth = 0.0017;
    ctx.setLineDash([0.0009, 0.0003]);
    boundaryPath(ctx, p, nrm, 0.0029, v, true); ctx.stroke();
    boundaryPath(ctx, p, nrm, -0.0029, v, true); ctx.stroke();
    ctx.setLineDash([]);
  }
  al(ctx, 1);
}

/** Batch-draw ribosomes (flat x,y array). Two subunits when very zoomed in. */
function drawRibos(ctx, arr, v, a, rr) {
  if (a <= 0.01) return;
  const r = Math.max(rr, 0.9 * v.px);
  al(ctx, a); ctx.fillStyle = COL.ribosome;
  ctx.beginPath();
  const big = v.s > 120;
  for (let i = 0; i < arr.length; i += 2) {
    const x = arr[i], y = arr[i + 1];
    if (x < v.x0 - r || x > v.x1 + r || y < v.y0 - r || y > v.y1 + r) continue;
    if (big) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); } else ctx.rect(x - r, y - r, 2 * r, 2 * r);
  }
  ctx.fill();
  if (v.s > 500) { // small subunit
    ctx.fillStyle = "#c9a74a"; ctx.beginPath();
    for (let i = 0; i < arr.length; i += 2) {
      const x = arr[i], y = arr[i + 1];
      if (x < v.x0 - r || x > v.x1 + r || y < v.y0 - r || y > v.y1 + r) continue;
      ctx.moveTo(x + r * 0.55 + r * 0.6, y - r * 0.45); ctx.arc(x + r * 0.55, y - r * 0.45, r * 0.6, 0, TAU);
    }
    ctx.fill();
  }
  al(ctx, 1);
}
function hitFlat(arr, x, y, tol) {
  let bi = -1, bd = tol;
  for (let i = 0; i < arr.length; i += 2) {
    const d = Math.hypot(arr[i] - x, arr[i + 1] - y);
    if (d < bd) { bd = d; bi = i; }
  }
  return bi;
}

/** Molecular crowding specks at very high zoom (procedural, only in view). */
function drawCrowd(ctx, v, t, inside) {
  const f = lod(v.s, 250, 600);
  if (f <= 0) return;
  const g = 0.12;
  const i0 = Math.floor(v.x0 / g), i1 = Math.ceil(v.x1 / g), j0 = Math.floor(v.y0 / g), j1 = Math.ceil(v.y1 / g);
  if ((i1 - i0) * (j1 - j0) > 1600) return;
  al(ctx, 0.35 * f); ctx.fillStyle = "#9ee7df"; ctx.beginPath();
  for (let i = i0; i < i1; i++) for (let j = j0; j < j1; j++) {
    for (let k = 0; k < 3; k++) {
      const h = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
      const h2 = Math.sin(i * 269.5 + j * 183.3 + k * 246.1) * 43758.5453;
      const fx = h - Math.floor(h), fy = h2 - Math.floor(h2);
      const x = (i + fx) * g + 0.004 * Math.sin(t * 3 + h), y = (j + fy) * g + 0.004 * Math.cos(t * 2.6 + h2);
      if (!inside(x, y)) continue;
      const r = 0.0025 + 0.003 * fx;
      ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
    }
  }
  ctx.fill(); al(ctx, 1);
}

// ---------- organelle painters (world units) ----------
function drawMito(ctx, m, q, t, v) {
  if (!inView(v, q.x, q.y, m.L)) return;
  const { L, W } = m;
  ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.a);
  K.glow(ctx, 0, 0, L * 0.75, COL.mito, 0.1 + 0.05 * Math.sin(t * 1.3 + m.p1));
  if (!m.g) {
    m.g = ctx.createLinearGradient(0, -W / 2, 0, W / 2);
    m.g.addColorStop(0, K.shade(COL.mito, -0.3)); m.g.addColorStop(0.35, K.shade(COL.mito, 0.25)); m.g.addColorStop(1, K.shade(COL.mito, -0.5));
  }
  K.roundRect(ctx, -L / 2, -W / 2, L, W, W / 2);
  ctx.fillStyle = m.g; ctx.fill();
  ctx.strokeStyle = K.shade(COL.mito, -0.55); ctx.lineWidth = Math.max(0.012, 1 * v.px); ctx.stroke();
  const cr = lod(v.s, 30, 70);
  if (cr > 0) {
    const ins = 0.055;
    al(ctx, cr);
    K.roundRect(ctx, -L / 2 + ins, -W / 2 + ins, L - 2 * ins, W - 2 * ins, W / 2 - ins);
    ctx.fillStyle = "rgba(90,40,10,0.35)"; ctx.fill();
    ctx.strokeStyle = K.shade(COL.mito, 0.45); ctx.lineWidth = 0.022; ctx.stroke();
    // cristae: folds of the inner membrane
    ctx.beginPath();
    let k = 0;
    for (let x = -L / 2 + W * 0.45; x < L / 2 - W * 0.45; x += 0.17, k++) {
      const top = k % 2 === 0, y0 = top ? -W / 2 + ins : W / 2 - ins, depth = W * (0.55 + 0.1 * Math.sin(k * 1.7));
      const y1 = top ? y0 + depth : y0 - depth;
      ctx.moveTo(x, y0); ctx.quadraticCurveTo(x + 0.04 * Math.sin(t + k), (y0 + y1) / 2, x + 0.01, y1);
    }
    ctx.lineWidth = 0.035; ctx.strokeStyle = K.shade(COL.mito, 0.5); ctx.lineCap = "round"; ctx.stroke();
    al(ctx, 1);
  }
  ctx.restore();
}
function mitoHit(m, t, x, y, tol) {
  const q = jig(m, t, 0.1), c = Math.cos(q.a), s = Math.sin(q.a);
  const dx = x - q.x, dy = y - q.y, lx = dx * c + dy * s, ly = -dx * s + dy * c;
  return Math.hypot(Math.max(Math.abs(lx) - (m.L / 2 - m.W / 2), 0), ly) - m.W / 2 < tol;
}
function mitoOutline(m, t) {
  return (ctx) => {
    const q = jig(m, t(), 0.1);
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.a);
    K.roundRect(ctx, -m.L / 2, -m.W / 2, m.L, m.W, m.W / 2); ctx.restore();
  };
}

function drawChloro(ctx, c, q, v, t) {
  if (!inView(v, q.x, q.y, c.rx)) return;
  const { rx, ry } = c;
  ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.a);
  K.glow(ctx, 0, 0, rx * 1.15, COL.chloroplast, 0.12 + 0.04 * Math.sin(t + c.ph));
  if (!c.g) {
    c.g = ctx.createLinearGradient(0, -ry, 0, ry);
    c.g.addColorStop(0, K.shade(COL.chloroplast, -0.35)); c.g.addColorStop(0.35, K.shade(COL.chloroplast, 0.15)); c.g.addColorStop(1, K.shade(COL.chloroplast, -0.6));
  }
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
  ctx.fillStyle = c.g; ctx.fill();
  ctx.strokeStyle = K.shade(COL.chloroplast, 0.5); ctx.lineWidth = Math.max(0.025, 1 * v.px); ctx.stroke();
  const f = lod(v.s, 14, 40);
  if (f > 0) {
    al(ctx, f);
    ctx.beginPath(); ctx.ellipse(0, 0, rx - 0.07, ry - 0.07, 0, 0, TAU);
    ctx.strokeStyle = K.shade(COL.chloroplast, 0.3); ctx.lineWidth = 0.02; ctx.stroke();
    // stroma lamellae linking grana
    ctx.beginPath();
    for (const gr of c.grana) { ctx.moveTo(gr.x - 0.4, gr.y + 0.05); ctx.lineTo(gr.x + 0.45, gr.y - 0.06); }
    ctx.strokeStyle = "rgba(20,80,40,0.8)"; ctx.lineWidth = 0.03; ctx.stroke();
    // grana: stacks of thylakoid discs
    for (const gr of c.grana) {
      for (let k = 0; k < gr.n; k++) {
        const y = gr.y - (gr.n * 0.075) / 2 + k * 0.075;
        K.roundRect(ctx, gr.x - 0.22, y, 0.44, 0.055, 0.025);
        ctx.fillStyle = "#14532d"; ctx.fill();
        if (v.s > 60) { ctx.strokeStyle = "#86efac"; ctx.lineWidth = 0.008; ctx.stroke(); }
      }
    }
    // starch grain
    ctx.beginPath(); ctx.ellipse(c.st.x, c.st.y, 0.32, 0.2, 0.3, 0, TAU);
    ctx.fillStyle = "rgba(240,240,220,0.55)"; ctx.fill();
    al(ctx, 1);
  }
  ctx.restore();
}

function drawGolgi(ctx, g, v, t) {
  if (!inView(v, g.x, g.y, 2)) return;
  ctx.lineCap = "round";
  g.cis.forEach((pl, i) => {
    ctx.beginPath(); tracePoly(ctx, pl.p);
    ctx.strokeStyle = K.shade(COL.golgi, -0.45); ctx.lineWidth = 0.17 * g.k; ctx.stroke();
    ctx.strokeStyle = K.shade(COL.golgi, 0.1 + i * 0.06); ctx.lineWidth = 0.11 * g.k; ctx.stroke();
    if (v.s > 40) { ctx.strokeStyle = "rgba(255,230,245,0.45)"; ctx.lineWidth = 0.025 * g.k; ctx.stroke(); }
    const n = pl.p.length;
    ball(ctx, pl.p[0], pl.p[1], 0.085 * g.k, COL.golgi);
    ball(ctx, pl.p[n - 2], pl.p[n - 1], 0.085 * g.k, COL.golgi);
  });
  for (const b of g.buds) {
    const bob = 0.05 * Math.sin(t * 1.5 + b.ph);
    ball(ctx, b.x + g.ux * bob, b.y + g.uy * bob, 0.07 * g.k, COL.vesicle);
  }
  ctx.lineCap = "butt";
}
function makeGolgi(x, y, ux, uy, k, R) {
  const vx = -uy, vy = ux, lens = [2.0, 2.4, 2.55, 2.3, 1.85];
  const cis = lens.map((L, i) => {
    const off = (0.5 - i * 0.25) * k, pts = [];
    for (let p = -L / 2; p <= L / 2 + 1e-6; p += 0.12) {
      const bend = -0.38 * (p / (L / 2)) ** 2;
      pts.push(x + (vx * p) * k + ux * (off + bend * k), y + (vy * p) * k + uy * (off + bend * k));
    }
    return mkPoly(pts);
  });
  const buds = [];
  for (let i = 0; i < 5; i++) {
    const side = i % 2 ? 1 : -1, p = side * (0.75 + R() * 0.45);
    buds.push({ x: x + vx * p * k - ux * (0.65 + R() * 0.3) * k, y: y + vy * p * k - uy * (0.65 + R() * 0.3) * k, ph: R() * TAU });
  }
  return { x, y, ux, uy, k, cis, buds, cisPt: { x: x + ux * 0.8 * k, y: y + uy * 0.8 * k }, transPt: { x: x - ux * 0.8 * k, y: y - uy * 0.8 * k } };
}
const golgiHit = (g, x, y, tol) => {
  const dx = x - g.x, dy = y - g.y, a = dx * g.ux + dy * g.uy, b = dx * -g.uy + dy * g.ux;
  return Math.abs(a) < 0.95 * g.k + tol && Math.abs(b) < 1.35 * g.k + tol;
};
const golgiOutline = (g) => (ctx) => { for (const pl of g.cis) tracePoly(ctx, pl.p); };

function drawER(ctx, v, list, rough) {
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath();
  for (const pl of list) if (polyVis(pl, v)) tracePoly(ctx, pl.p);
  al(ctx, rough ? 0.55 : 0.5); ctx.strokeStyle = K.shade(rough ? COL.rer : COL.ser, -0.4); ctx.lineWidth = rough ? 0.17 : 0.11; ctx.stroke();
  al(ctx, rough ? 0.6 : 0.55); ctx.strokeStyle = K.shade(rough ? COL.rer : COL.ser, 0.15); ctx.lineWidth = rough ? 0.09 : 0.055; ctx.stroke();
  al(ctx, 1); ctx.lineCap = "butt";
}
function erRibosomes(list, R, off) {
  const out = [];
  for (const pl of list) {
    const p = pl.p;
    for (let i = 2; i < p.length - 2; i += 2) {
      const tx = p[i + 2] - p[i - 2], ty = p[i + 3] - p[i - 1], L = Math.hypot(tx, ty) || 1;
      const nx = ty / L, ny = -tx / L;
      for (const sd of [-1, 1]) {
        const j = (R() - 0.5) * 0.06;
        out.push(p[i] + nx * off * sd + (tx / L) * j, p[i + 1] + ny * off * sd + (ty / L) * j);
      }
    }
  }
  return new Float32Array(out);
}
function drawCytoLines(ctx, v, list, width, alpha, col = COL.cytoskeleton) {
  ctx.beginPath();
  for (const pl of list) if (polyVis(pl, v)) tracePoly(ctx, pl.p);
  al(ctx, alpha); ctx.strokeStyle = col; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.stroke();
  al(ctx, 1); ctx.lineCap = "butt";
}

// ---------- vesicle traffic ----------
function pathOf(points) {
  const cum = [0];
  for (let i = 2; i < points.length; i += 2) cum.push(cum[cum.length - 1] + Math.hypot(points[i] - points[i - 2], points[i + 1] - points[i - 1]));
  return { p: points, cum, total: cum[cum.length - 1] };
}
function pathPos(P, d) {
  const { p, cum } = P;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const t = clamp((d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1), 0, 1);
  return { x: p[(i - 1) * 2] + (p[i * 2] - p[(i - 1) * 2]) * t, y: p[(i - 1) * 2 + 1] + (p[i * 2 + 1] - p[(i - 1) * 2 + 1]) * t };
}
function makeTraffic(n, newPath, speed) {
  const ves = [];
  for (let i = 0; i < n; i++) { const P = newPath(); ves.push({ P, d: (i / n) * P.total, spd: speed * (0.8 + Math.random() * 0.4) }); }
  const flashes = [];
  return {
    ves, flashes,
    update(dt) {
      for (const q of ves) {
        const inG = q.d > q.P.cisD && q.d < q.P.transD;
        q.d += q.spd * dt * (inG ? 0.45 : 1);
        if (q.d >= q.P.total) {
          const e = pathPos(q.P, q.P.total);
          flashes.push({ x: e.x, y: e.y, age: 0 });
          q.P = newPath(); q.d = 0;
        }
      }
      for (const f of flashes) f.age += dt;
      while (flashes.length && flashes[0].age > 1.2) flashes.shift();
    },
    pos(q) { return pathPos(q.P, q.d); },
    draw(ctx, v) {
      const r = Math.max(0.045, 2.4 * v.px);
      for (const q of ves) {
        const p = pathPos(q.P, q.d);
        if (!inView(v, p.x, p.y, r)) continue;
        const inG = q.d > q.P.cisD && q.d < q.P.transD;
        if (inG) { al(ctx, 0.35); ball(ctx, p.x, p.y, r * 0.8, COL.vesicle); al(ctx, 1); continue; }
        const col = q.d <= q.P.cisD ? COL.rer : COL.vesicle;
        ball(ctx, p.x, p.y, r, col);
        if (v.s > 120) { ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 0.008; ctx.stroke(); }
      }
      for (const f of flashes) {
        const k = f.age / 1.2;
        ctx.beginPath(); ctx.arc(f.x, f.y, 0.06 + k * 0.5, 0, TAU);
        al(ctx, (1 - k) * 0.9); ctx.strokeStyle = COL.vesicle; ctx.lineWidth = Math.max(0.02, 1.5 * v.px); ctx.stroke();
        al(ctx, 1);
        K.glow(ctx, f.x, f.y, 0.3 + k * 0.4, COL.vesicle, 0.5 * (1 - k));
      }
    },
    hit(x, y, tol) {
      for (const q of ves) { const p = pathPos(q.P, q.d); if (Math.hypot(p.x - x, p.y - y) < tol) return q; }
      return null;
    },
  };
}

function resultBase(id, x, y, focus, outline) { return { id, x, y, focus, outline }; }

// =====================================================================
// ANIMAL CELL  (~20 µm across)
// =====================================================================
export function buildAnimal() {
  const R = rng(11), r = (a, b) => a + (b - a) * R();
  const RAD = 10;
  let T = 0;
  const N = { x: -1.2, y: 0.6, r: 3.0 }, NO = { x: -0.45, y: 0.15, r: 0.85 };
  const bR = (th, t) => RAD * (1 + 0.02 * Math.sin(3 * th + 0.25 * t) + 0.013 * Math.sin(5 * th - 0.17 * t + 1) + 0.009 * Math.sin(2 * th + 0.11 * t + 2));
  const NB = 360, bp = new Float32Array(NB * 2), bn = new Float32Array(NB * 2);
  const updB = (t) => {
    for (let i = 0; i < NB; i++) { const th = (i / NB) * TAU, rr = bR(th, t); bp[2 * i] = Math.cos(th) * rr; bp[2 * i + 1] = Math.sin(th) * rr; }
    computeNormals(bp, bn);
  };
  updB(0);
  const sdCell = (x, y) => Math.hypot(x, y) - bR(Math.atan2(y, x), T);

  // nucleus detail
  const chrom = [];
  for (let i = 0; i < 420; i++) {
    const th = R() * TAU, rr = N.r * 0.94 * Math.sqrt(R()), x = N.x + Math.cos(th) * rr, y = N.y + Math.sin(th) * rr;
    if (Math.hypot(x - NO.x, y - NO.y) < NO.r + 0.1) continue;
    chrom.push({ x, y, r: r(0.025, 0.08) * (rr > N.r * 0.75 ? 1.4 : 1) });
  }
  const pores = Array.from({ length: 36 }, (_, i) => (i / 36) * TAU + r(-0.05, 0.05));

  // golgi + centrosome positions
  const gA = -0.25, gx = N.x + 6.9 * Math.cos(gA), gy = N.y + 6.9 * Math.sin(gA);
  const G = makeGolgi(gx, gy, -Math.cos(gA), -Math.sin(gA), 1.25, R);
  const C = { x: N.x + 5.6 * Math.cos(-0.85), y: N.y + 5.6 * Math.sin(-0.85) };

  // rough ER: wavy sheets wrapped around the nucleus
  const rer = [];
  for (let k = 0; k < 4; k++) {
    const rad0 = N.r + 0.6 + k * 0.45;
    let a = r(-0.6, 0.3) + k * 0.5;
    const aEnd = a + r(3.8, 4.9);
    while (a < aEnd) {
      const segEnd = Math.min(aEnd, a + r(1.0, 2.0)), pts = [];
      for (let th = a; th <= segEnd; th += 0.12 / rad0) {
        const rr = rad0 + 0.16 * Math.sin(th * 6 + k * 1.7) + 0.07 * Math.sin(th * 15 + k * 3);
        pts.push(N.x + Math.cos(th) * rr, N.y + Math.sin(th) * rr);
      }
      if (pts.length > 6) rer.push(mkPoly(pts));
      a = segEnd + r(0.12, 0.3);
    }
  }
  const riboER = erRibosomes(rer, R, 0.097);
  // smooth ER: branching tubules on the far side
  const ser = [];
  for (let i = 0; i < 10; i++) {
    const th = r(1.7, 4.3);
    let x = N.x + Math.cos(th) * (N.r + 2.4), y = N.y + Math.sin(th) * (N.r + 2.4), a = th + r(-0.6, 0.6);
    const pts = [x, y], n = r(16, 30);
    for (let j = 0; j < n; j++) {
      a += r(-0.4, 0.4); x += Math.cos(a) * 0.16; y += Math.sin(a) * 0.16;
      if (Math.hypot(x, y) > RAD * 0.88 || Math.hypot(x - N.x, y - N.y) < N.r + 2.1) break;
      pts.push(x, y);
    }
    if (pts.length > 8) ser.push(mkPoly(pts));
  }
  // microtubules radiating from the centrosome
  const mts = [];
  for (let i = 0; i < 34; i++) {
    let a = (i / 34) * TAU + r(-0.08, 0.08), x = C.x, y = C.y;
    const pts = [x, y], drift = r(-0.035, 0.035);
    for (let j = 0; j < 90; j++) {
      a += drift + r(-0.03, 0.03);
      x += Math.cos(a) * 0.3; y += Math.sin(a) * 0.3;
      const dn = Math.hypot(x - N.x, y - N.y);
      if (dn < N.r + 0.45) {
        const f = (N.r + 0.45) / dn; x = N.x + (x - N.x) * f; y = N.y + (y - N.y) * f;
        const ta = Math.atan2(y - N.y, x - N.x) + Math.PI / 2;
        a = Math.cos(ta - a) > 0 ? ta : ta + Math.PI;
      }
      if (Math.hypot(x, y) > RAD * 0.93) break;
      pts.push(x, y);
    }
    mts.push(mkPoly(pts));
  }
  // actin cortex just under the membrane
  const actin = Array.from({ length: 260 }, () => ({ th: R() * TAU, d: r(0.05, 0.5), tilt: r(-0.7, 0.7), L: r(0.25, 0.6) }));

  // organelle placement
  const placed = [];
  const free = (x, y, rad) => Math.hypot(x, y) < RAD * 0.87 - rad && Math.hypot(x - N.x, y - N.y) > N.r + 2.2 + rad * 0.4 &&
    Math.hypot(x - G.x, y - G.y) > 1.7 + rad && Math.hypot(x - C.x, y - C.y) > 0.7 + rad &&
    placed.every((p) => Math.hypot(x - p.x, y - p.y) > p.rad + rad + 0.12);
  const place = (rad) => {
    for (let k = 0; k < 4000; k++) {
      const th = R() * TAU, rr = Math.sqrt(R()) * RAD * 0.9, x = Math.cos(th) * rr, y = Math.sin(th) * rr;
      if (free(x, y, rad)) { placed.push({ x, y, rad }); return { x, y }; }
    }
    return null;
  };
  const mitos = [];
  for (let i = 0; i < 22; i++) {
    const L = r(1.3, 2.3), W = r(0.5, 0.7), p = place(L * 0.45);
    if (p) mitos.push(addJig({ ...p, L, W, a: R() * TAU }, R));
  }
  const lysos = [], perox = [];
  for (let i = 0; i < 8; i++) { const rr = r(0.22, 0.4), p = place(rr); if (p) lysos.push(addJig({ ...p, r: rr, dots: Array.from({ length: 7 }, () => [r(-0.6, 0.6), r(-0.6, 0.6)]) }, R)); }
  for (let i = 0; i < 7; i++) { const rr = r(0.16, 0.27), p = place(rr); if (p) perox.push(addJig({ ...p, r: rr, a: R() * TAU }, R)); }

  // free ribosomes (polysomes: little chains on one mRNA)
  const fr = [];
  for (let c = 0; c < 95; c++) {
    let x, y, ok = false;
    for (let k = 0; k < 200 && !ok; k++) {
      const th = R() * TAU, rr = Math.sqrt(R()) * RAD * 0.92; x = Math.cos(th) * rr; y = Math.sin(th) * rr;
      ok = Math.hypot(x - N.x, y - N.y) > N.r + 0.25 && Math.hypot(x - G.x, y - G.y) > 1.3;
    }
    if (!ok) continue;
    let a = R() * TAU;
    for (let j = 0; j < 4; j++) { fr.push(x, y); a += r(0.4, 0.9); x += Math.cos(a) * 0.036; y += Math.sin(a) * 0.036; }
  }
  const riboFree = new Float32Array(fr);
  const cytoAnchors = [];
  for (let i = 0; i < fr.length; i += 16) cytoAnchors.push(fr[i], fr[i + 1]);

  // vesicle traffic: ER exit site → Golgi (cis → trans) → along a microtubule → membrane
  const erExit = (() => { let b = null; for (const pl of rer) { const q = nearestInFlat(G.cisPt.x, G.cisPt.y, pl.p); if (!b || q.d < b.d) b = q; } return b; })();
  const outMts = mts.filter((m) => { const p = m.p, n = p.length; return (p[n - 2] - N.x) * (G.x - N.x) + (p[n - 1] - N.y) * (G.y - N.y) > 0 && n > 20; });
  const newPath = () => {
    const m = K.pick(outMts), near = nearestInFlat(G.transPt.x, G.transPt.y, m.p);
    const pts = [erExit.x, erExit.y, G.cisPt.x, G.cisPt.y, G.x, G.y, G.transPt.x, G.transPt.y];
    for (let i = near.i; i < m.p.length; i += 2) pts.push(m.p[i], m.p[i + 1]);
    const P = pathOf(pts);
    P.cisD = P.cum[1]; P.transD = P.cum[3];
    return P;
  };
  const traffic = makeTraffic(9, newPath, 0.9);

  let cytoGrad = null, nucGrad = null;
  const cell = {
    type: "animal", fit: { x: 0, y: 0, w: 22.5, h: 22.5 }, bounds: { x0: -11, x1: 11, y0: -11, y1: 11 },
    update(dt, t) { T = t; traffic.update(dt); },
    draw(ctx, v, t, A) {
      GA = A; T = t; updB(t);
      const s = v.s, px = v.px;
      if (!cytoGrad) {
        cytoGrad = ctx.createRadialGradient(-2, -2, 0, 0, 0, RAD * 1.05);
        cytoGrad.addColorStop(0, "rgba(79,209,197,0.16)"); cytoGrad.addColorStop(0.75, "rgba(40,120,150,0.12)"); cytoGrad.addColorStop(1, "rgba(120,220,210,0.22)");
        nucGrad = ctx.createRadialGradient(N.x - 1, N.y - 1.2, 0.3, N.x, N.y, N.r);
        nucGrad.addColorStop(0, "rgba(150,165,255,0.55)"); nucGrad.addColorStop(1, "rgba(70,80,190,0.45)");
      }
      al(ctx, 1);
      boundaryPath(ctx, bp, bn, 0, v, false);
      ctx.fillStyle = cytoGrad; ctx.fill();
      drawCrowd(ctx, v, t, (x, y) => sdCell(x, y) < -0.01 && Math.hypot(x - N.x, y - N.y) > N.r);
      // cytoskeleton
      const af = lod(s, 40, 90);
      if (af > 0) {
        ctx.beginPath();
        for (const f of actin) {
          const rr = bR(f.th, t) - f.d, cx = Math.cos(f.th) * rr, cy = Math.sin(f.th) * rr;
          if (!inView(v, cx, cy, f.L)) continue;
          const ta = f.th + Math.PI / 2 + f.tilt, dx = Math.cos(ta) * f.L / 2, dy = Math.sin(ta) * f.L / 2;
          ctx.moveTo(cx - dx, cy - dy); ctx.lineTo(cx + dx, cy + dy);
        }
        al(ctx, 0.3 * af); ctx.strokeStyle = "#f0abfc"; ctx.lineWidth = Math.max(0.007, 0.7 * px); ctx.stroke(); al(ctx, 1);
      }
      drawCytoLines(ctx, v, mts, Math.max(0.025, 0.9 * px), 0.22);
      if (s > 400) drawCytoLines(ctx, v, mts, 0.01, 0.35, "#0b1a2e"); // hollow tube look
      drawER(ctx, v, ser, false);
      drawER(ctx, v, rer, true);
      const rf = lod(s, 45, 100);
      drawRibos(ctx, riboER, v, rf, 0.0125);
      drawRibos(ctx, riboFree, v, rf, 0.0125);
      // centrosome: two centrioles at right angles
      if (inView(v, C.x, C.y, 1)) {
        K.glow(ctx, C.x, C.y, 0.9, COL.centriole, 0.22);
        ctx.save(); ctx.translate(C.x, C.y); ctx.rotate(0.4);
        K.roundRect(ctx, -0.25, -0.1, 0.5, 0.2, 0.04);
        ctx.fillStyle = K.shade(COL.centriole, -0.2); ctx.fill();
        ctx.beginPath(); for (const yy of [-0.06, 0, 0.06]) { ctx.moveTo(-0.23, yy); ctx.lineTo(0.23, yy); }
        ctx.strokeStyle = K.shade(COL.centriole, 0.5); ctx.lineWidth = 0.018; ctx.stroke();
        // second centriole seen end-on: ring of 9 triplets
        ctx.translate(0.02, 0.32);
        ctx.beginPath(); ctx.arc(0, 0, 0.1, 0, TAU); ctx.fillStyle = K.shade(COL.centriole, -0.35); ctx.fill();
        const tf = lod(s, 150, 320);
        if (tf > 0) {
          al(ctx, tf); ctx.fillStyle = K.shade(COL.centriole, 0.55); ctx.beginPath();
          for (let i = 0; i < 9; i++) {
            const a = (i / 9) * TAU + t * 0.05;
            for (let k = 0; k < 3; k++) {
              const rr = 0.083 - k * 0.0, ang = a + (k - 1) * 0.12, x = Math.cos(ang) * (rr - k * 0.012), y = Math.sin(ang) * (rr - k * 0.012);
              ctx.moveTo(x + 0.0125, y); ctx.arc(x, y, 0.0125, 0, TAU);
            }
          }
          ctx.fill(); al(ctx, 1);
        } else { ctx.strokeStyle = K.shade(COL.centriole, 0.4); ctx.lineWidth = 0.02; ctx.stroke(); }
        ctx.restore();
      }
      drawGolgi(ctx, G, v, t);
      for (const m of mitos) drawMito(ctx, m, jig(m, t, 0.1), t, v);
      const lf = lod(s, 60, 120);
      for (const l of lysos) {
        const q = jig(l, t, 0.12); if (!inView(v, q.x, q.y, l.r)) continue;
        ball(ctx, q.x, q.y, l.r, COL.lysosome);
        if (lf > 0) { al(ctx, lf); ctx.fillStyle = "#3b1d78"; ctx.beginPath(); for (const d of l.dots) { const x = q.x + d[0] * l.r, y = q.y + d[1] * l.r; ctx.moveTo(x + 0.025, y); ctx.arc(x, y, 0.025, 0, TAU); } ctx.fill(); al(ctx, 1); }
      }
      for (const p of perox) {
        const q = jig(p, t, 0.12); if (!inView(v, q.x, q.y, p.r)) continue;
        ball(ctx, q.x, q.y, p.r, COL.peroxisome);
        if (lf > 0) { al(ctx, lf * 0.8); ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(p.a); ctx.fillStyle = "#3f6212"; ctx.fillRect(-p.r * 0.4, -p.r * 0.3, p.r * 0.8, p.r * 0.6); ctx.restore(); al(ctx, 1); }
      }
      traffic.draw(ctx, v);
      // nucleus
      if (inView(v, N.x, N.y, N.r + 0.3)) {
        K.glow(ctx, N.x, N.y, N.r * 1.35, COL.nucleus, 0.16);
        ctx.beginPath(); ctx.arc(N.x, N.y, N.r, 0, TAU); ctx.fillStyle = nucGrad; ctx.fill();
        const cf = lod(s, 22, 50);
        if (cf > 0) {
          al(ctx, 0.3 * cf); ctx.fillStyle = "#c7d2fe"; ctx.beginPath();
          for (const c of chrom) { if (!inView(v, c.x, c.y, c.r)) continue; ctx.moveTo(c.x + c.r, c.y); ctx.arc(c.x, c.y, c.r, 0, TAU); }
          ctx.fill(); al(ctx, 1);
        }
        ball(ctx, NO.x, NO.y, NO.r, COL.nucleolus);
        // nuclear envelope: double membrane with pores
        ctx.strokeStyle = K.shade(COL.nucleus, 0.35);
        const ef = lod(s, 25, 60);
        ctx.lineWidth = Math.max(0.05, 1.5 * px);
        ctx.beginPath(); ctx.arc(N.x, N.y, N.r, 0, TAU); al(ctx, 1 - ef * 0.6); ctx.stroke();
        if (ef > 0) {
          al(ctx, ef); ctx.lineWidth = Math.max(0.012, 1 * px);
          ctx.beginPath(); ctx.arc(N.x, N.y, N.r + 0.03, 0, TAU); ctx.stroke();
          ctx.beginPath(); ctx.arc(N.x, N.y, N.r - 0.03, 0, TAU); ctx.stroke();
          for (const a of pores) {
            const x = N.x + Math.cos(a) * N.r, y = N.y + Math.sin(a) * N.r;
            if (!inView(v, x, y, 0.1)) continue;
            ctx.beginPath(); ctx.arc(x, y, 0.06, 0, TAU); ctx.fillStyle = "#0a1628"; ctx.fill();
            ctx.lineWidth = 0.018; ctx.strokeStyle = "#e0e7ff"; ctx.stroke();
          }
        }
        al(ctx, 1);
      }
      drawMembrane(ctx, v, bp, bn);
    },
    hit(x, y, px) {
      const tol = 6 * px, t = T;
      if (lod(1 / px, 45, 100) > 0.3) {
        let i = hitFlat(riboER, x, y, Math.max(0.02, 10 * px));
        let arr = riboER;
        if (i < 0) { i = hitFlat(riboFree, x, y, Math.max(0.02, 10 * px)); arr = riboFree; }
        if (i >= 0) { const rx = arr[i], ry = arr[i + 1]; return resultBase("ribosome", rx, ry, 0.5, (ctx) => ctx.arc(rx, ry, 0.03, 0, TAU)); }
      }
      const vq = traffic.hit(x, y, Math.max(0.06, 10 * px));
      if (vq) return resultBase("vesicle", traffic.pos(vq).x, traffic.pos(vq).y, 0.8, (ctx) => { const p = traffic.pos(vq); ctx.arc(p.x, p.y, 0.08, 0, TAU); });
      if (Math.hypot(x - C.x, y - C.y) < Math.max(0.45, 12 * px)) return resultBase("centriole", C.x, C.y, 1.4, (ctx) => ctx.arc(C.x, C.y, 0.45, 0, TAU));
      for (const l of lysos) { const q = jig(l, t, 0.12); if (Math.hypot(x - q.x, y - q.y) < l.r + tol) return resultBase("lysosome", q.x, q.y, 1.6, (ctx) => { const p = jig(l, T, 0.12); ctx.arc(p.x, p.y, l.r, 0, TAU); }); }
      for (const p of perox) { const q = jig(p, t, 0.12); if (Math.hypot(x - q.x, y - q.y) < p.r + tol) return resultBase("peroxisome", q.x, q.y, 1.3, (ctx) => { const z = jig(p, T, 0.12); ctx.arc(z.x, z.y, p.r, 0, TAU); }); }
      for (const m of mitos) if (mitoHit(m, t, x, y, tol)) { const q = jig(m, t, 0.1); return resultBase("mito", q.x, q.y, 3, mitoOutline(m, () => T)); }
      if (golgiHit(G, x, y, tol)) return resultBase("golgi", G.x, G.y, 3.6, golgiOutline(G));
      if (Math.hypot(x - NO.x, y - NO.y) < NO.r + tol * 0.5) return resultBase("nucleolus", NO.x, NO.y, 2.6, (ctx) => ctx.arc(NO.x, NO.y, NO.r, 0, TAU));
      if (Math.hypot(x - N.x, y - N.y) < N.r + tol) return resultBase("nucleus", N.x, N.y, 7.5, (ctx) => ctx.arc(N.x, N.y, N.r, 0, TAU));
      for (const pl of rer) if (distPoly(x, y, pl.p) < 0.1 + tol) return resultBase("rer", x, y, 4.5, (ctx) => { for (const q of rer) tracePoly(ctx, q.p); });
      for (const pl of ser) if (distPoly(x, y, pl.p) < 0.07 + tol) return resultBase("ser", x, y, 3.5, (ctx) => { for (const q of ser) tracePoly(ctx, q.p); });
      const sd = sdCell(x, y);
      if (Math.abs(sd) < Math.max(0.04, 9 * px)) return resultBase("membrane", x, y, 0, (ctx) => { for (let i = 0; i < NB; i++) i ? ctx.lineTo(bp[2 * i], bp[2 * i + 1]) : ctx.moveTo(bp[0], bp[1]); ctx.closePath(); });
      for (const pl of mts) if (distPoly(x, y, pl.p) < 0.0125 + 4 * px) return resultBase("cytoskeleton", x, y, 0, (ctx) => { for (const q of mts) tracePoly(ctx, q.p); });
      if (sd < 0) return resultBase("cytoplasm", x, y, 0, (ctx) => { for (let i = 0; i < NB; i++) i ? ctx.lineTo(bp[2 * i] * 0.985, bp[2 * i + 1] * 0.985) : ctx.moveTo(bp[0] * 0.985, bp[1] * 0.985); ctx.closePath(); });
      return null;
    },
    anchors(cx, cy) {
      const t = T, out = [];
      const nb = nearestInFlat(cx, cy, bp);
      out.push({ id: "membrane", x: nb.x, y: nb.y });
      const ca = nearestInFlat(cx, cy, new Float32Array(cytoAnchors)); out.push({ id: "cytoplasm", x: ca.x, y: ca.y });
      out.push({ id: "nucleus", x: N.x - N.r * 0.55, y: N.y + N.r * 0.6 });
      out.push({ id: "nucleolus", x: NO.x, y: NO.y });
      let best = null; for (const pl of rer) { const q = nearestInFlat(cx, cy, pl.p); if (!best || q.d < best.d) best = q; } out.push({ id: "rer", x: best.x, y: best.y });
      best = null; for (const pl of ser) { const q = nearestInFlat(cx, cy, pl.p); if (!best || q.d < best.d) best = q; } out.push({ id: "ser", x: best.x, y: best.y });
      const rb = nearestInFlat(cx, cy, riboER); out.push({ id: "ribosome", x: rb.x, y: rb.y });
      out.push({ id: "golgi", x: G.x, y: G.y });
      const mm = nearestObj(cx, cy, mitos, (m) => jig(m, t, 0.1)); out.push({ id: "mito", x: mm.x, y: mm.y });
      const ll = nearestObj(cx, cy, lysos, (m) => jig(m, t, 0.12)); out.push({ id: "lysosome", x: ll.x, y: ll.y });
      const pp = nearestObj(cx, cy, perox, (m) => jig(m, t, 0.12)); out.push({ id: "peroxisome", x: pp.x, y: pp.y });
      out.push({ id: "centriole", x: C.x, y: C.y });
      best = null; for (const pl of mts) { const q = nearestInFlat(cx, cy, pl.p); if (!best || q.d < best.d) best = q; } out.push({ id: "cytoskeleton", x: best.x, y: best.y });
      const vv = nearestObj(cx, cy, traffic.ves, (q) => traffic.pos(q)); out.push({ id: "vesicle", x: vv.x, y: vv.y });
      return out;
    },
    erVisible(v) {
      const mx = (v.x1 - v.x0) * 0.15, my = (v.y1 - v.y0) * 0.15;
      return rer.some((pl) => { for (let i = 0; i < pl.p.length; i += 2) if (pl.p[i] > v.x0 + mx && pl.p[i] < v.x1 - mx && pl.p[i + 1] > v.y0 + my && pl.p[i + 1] < v.y1 - my) return true; return false; });
    },
  };
  return cell;
}

// =====================================================================
// PLANT CELL  (~36 × 25 µm, cell wall, chloroplasts, central vacuole, streaming)
// =====================================================================
export function buildPlant() {
  const R = rng(23), r = (a, b) => a + (b - a) * R();
  let T = 0;
  const HX = 18, HY = 12.5, RC = 2.0, WALL = 0.5;
  const VX = 14.2, VY = 8.8, VR = 6;
  const LX = 16.1, LY = 10.65, LR = 4, LP = rrLen(LX, LY, LR); // streaming loop
  const N = { x: -14.8, y: -9.0, r: 2.0 }, NO = { x: -14.4, y: -8.7, r: 0.65 };
  const sdCell = (x, y) => sdRR(x, y, HX, HY, RC);
  const sdVac = (x, y) => sdRR(x, y, VX, VY, VR);
  const NB = 720, bp = new Float32Array(NB * 2), bn = new Float32Array(NB * 2);
  for (let i = 0; i < NB; i++) { const q = rrPoint(HX, HY, RC, i / NB); bp[2 * i] = q.x; bp[2 * i + 1] = q.y; }
  computeNormals(bp, bn);
  const grad = (x, y) => { const e = 0.01, d = sdCell(x, y); const gx = (sdCell(x + e, y) - d) / e, gy = (sdCell(x, y + e) - d) / e, L = Math.hypot(gx, gy) || 1; return { x: gx / L, y: gy / L, d }; };

  // streaming organelles (carried along actin cables by myosin)
  const flowPos = (o, t, spd) => {
    const q = rrPoint(LX, LY, LR, o.u + (t * spd) / LP);
    const nx = q.ty, ny = -q.tx; // outward normal
    const lat = o.lat + 0.08 * Math.sin(t * o.f1 + o.p1);
    return { x: q.x + nx * lat, y: q.y + ny * lat, a: Math.atan2(q.ty, q.tx) + 0.1 * Math.sin(t * o.f3 + o.p3) };
  };
  let flowT = 0; // integrated streaming distance (µm)
  const chloros = [];
  for (let i = 0; i < 13; i++) {
    const c = addJig({ u: i / 13 + r(-0.015, 0.015), lat: r(-0.55, 0.55), rx: r(2.1, 2.5), ry: r(0.9, 1.1), ph: R() * TAU }, R);
    c.grana = [];
    for (let k = 0; k < 9; k++) c.grana.push({ x: -c.rx * 0.62 + (k % 5) * c.rx * 0.31 + (k >= 5 ? c.rx * 0.15 : 0), y: k >= 5 ? 0.3 : -0.25, n: 4 + Math.floor(R() * 4) });
    c.st = { x: r(-0.6, 0.6), y: r(-0.1, 0.25) };
    chloros.push(c);
  }
  const mitos = Array.from({ length: 10 }, () => addJig({ u: R(), lat: r(-1.4, 1.4), L: r(1.2, 2.0), W: r(0.5, 0.65) }, R));
  const perox = Array.from({ length: 5 }, () => addJig({ u: R(), lat: r(-1.3, 1.3), r: r(0.18, 0.28) }, R));

  // cortical ER sheets in the band + a few around the nucleus
  const rer = [];
  const sheet = (hx, hy, rr, u0, u1, wob) => {
    const pts = [];
    for (let u = u0; u <= u1; u += 0.12 / rrLen(hx, hy, rr)) {
      const q = rrPoint(hx, hy, rr, u), nx = q.ty, ny = -q.tx, w = wob * Math.sin(u * 220) + 0.06 * Math.sin(u * 640);
      pts.push(q.x + nx * w, q.y + ny * w);
    }
    rer.push(mkPoly(pts));
  };
  sheet(17.2, 11.7, 2.8, 0.27, 0.36, 0.12); sheet(17.0, 11.5, 3, 0.39, 0.5, 0.15);
  sheet(15.0, 9.6, 5.2, 0.52, 0.66, 0.12); sheet(17.1, 11.6, 2.9, 0.06, 0.16, 0.12);
  for (const [rad, a0, a1] of [[N.r + 0.45, 2.2, 4.3], [N.r + 0.85, 2.4, 4.1]]) {
    const pts = [];
    for (let a = a0; a <= a1; a += 0.1 / rad) { const rr = rad + 0.08 * Math.sin(a * 9); pts.push(N.x + Math.cos(a) * rr, N.y + Math.sin(a) * rr); }
    rer.push(mkPoly(pts));
  }
  const riboER = erRibosomes(rer, R, 0.097);
  const ser = [];
  for (let i = 0; i < 6; i++) {
    let x = r(-17, -15.5), y = r(-2, 6), a = r(0, TAU);
    const pts = [x, y];
    for (let j = 0; j < 26; j++) {
      a += r(-0.45, 0.45); const nx = x + Math.cos(a) * 0.16, ny = y + Math.sin(a) * 0.16;
      if (sdCell(nx, ny) > -0.4 || sdVac(nx, ny) < 0.35) { a += Math.PI * 0.6; continue; }
      x = nx; y = ny; pts.push(x, y);
    }
    if (pts.length > 8) ser.push(mkPoly(pts));
  }
  // Golgi stacks (dictyosomes) lying in the band
  const golgis = [0.2, 0.6].map((u) => {
    const q = rrPoint(LX, LY, LR, u);
    return makeGolgi(q.x - q.ty * 0.2, q.y + q.tx * 0.2, -q.ty, q.tx, 0.62, R); // axis points inward (cis towards ER/vacuole side)
  });
  // actin cables along the streaming path
  const cables = [-1.25, -0.1, 1.15].map((lat, k) => {
    const pts = [];
    for (let i = 0; i <= 500; i++) {
      const q = rrPoint(LX, LY, LR, i / 500), w = lat + 0.12 * Math.sin(i * 0.37 + k * 2);
      pts.push(q.x + q.ty * w, q.y - q.tx * w);
    }
    return mkPoly(pts);
  });
  // free ribosomes in the cytoplasm band
  const fr = [];
  for (let i = 0; i < 420; i++) {
    const x = r(-HX, HX), y = r(-HY, HY);
    if (sdCell(x, y) < -0.12 && sdVac(x, y) > 0.1 && Math.hypot(x - N.x, y - N.y) > N.r + 0.15) fr.push(x, y);
  }
  const riboFree = new Float32Array(fr);
  // vesicles: ER → Golgi → membrane (wall-building materials)
  const newPath = () => {
    const g = K.pick(golgis);
    let er = null;
    for (const pl of rer) { const q = nearestInFlat(g.cisPt.x, g.cisPt.y, pl.p); if (!er || q.d < er.d) er = q; }
    const start = { x: g.cisPt.x + g.ux * 0.7 + r(-0.3, 0.3), y: g.cisPt.y + g.uy * 0.7 + r(-0.3, 0.3) };
    const sx = sdCell(start.x, start.y) > -0.2 ? er.x : start.x, sy = sdCell(start.x, start.y) > -0.2 ? er.y : start.y;
    const out = { x: g.transPt.x + r(-0.8, 0.8) * -g.uy, y: g.transPt.y + r(-0.8, 0.8) * g.ux };
    const gq = grad(out.x, out.y);
    const pts = [sx, sy, g.cisPt.x, g.cisPt.y, g.x, g.y, g.transPt.x, g.transPt.y, out.x - gq.x * gq.d, out.y - gq.y * gq.d];
    const P = pathOf(pts); P.cisD = P.cum[1]; P.transD = P.cum[3];
    return P;
  };
  const traffic = makeTraffic(6, newPath, 0.7);

  const neighbours = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if (i || j) neighbours.push({ x: i * 2 * (HX + WALL), y: j * 2 * (HY + WALL) });
  const nbChloro = Array.from({ length: 10 }, (_, k) => { const q = rrPoint(LX, LY, LR, k / 10 + 0.03); return { x: q.x, y: q.y, a: Math.atan2(q.ty, q.tx) }; });

  let cytoGrad = null, vacGrad = null, nucGrad = null;
  const cell = {
    type: "plant", fit: { x: 0, y: 0, w: 39, h: 28 }, bounds: { x0: -20, x1: 20, y0: -14, y1: 14 },
    update(dt, t) { T = t; flowT += dt * 1.6; traffic.update(dt); },
    draw(ctx, v, t, A) {
      GA = A; T = t;
      const s = v.s, px = v.px;
      if (!cytoGrad) {
        cytoGrad = ctx.createLinearGradient(-HX, -HY, HX, HY);
        cytoGrad.addColorStop(0, "rgba(79,209,197,0.2)"); cytoGrad.addColorStop(1, "rgba(60,170,150,0.14)");
        vacGrad = ctx.createRadialGradient(-3, -3, 1, 0, 0, VX * 1.1);
        vacGrad.addColorStop(0, "rgba(125,211,252,0.06)"); vacGrad.addColorStop(1, "rgba(125,211,252,0.16)");
        nucGrad = ctx.createRadialGradient(N.x - 0.6, N.y - 0.7, 0.2, N.x, N.y, N.r);
        nucGrad.addColorStop(0, "rgba(150,165,255,0.65)"); nucGrad.addColorStop(1, "rgba(70,80,190,0.55)");
      }
      // neighbouring cells (tissue context)
      for (const nb of neighbours) {
        if (!inView(v, nb.x, nb.y, HX + 1)) continue;
        ctx.save(); ctx.translate(nb.x, nb.y);
        al(ctx, 0.35);
        K.roundRect(ctx, -HX, -HY, 2 * HX, 2 * HY, RC); ctx.fillStyle = "rgba(79,209,197,0.12)"; ctx.fill();
        K.roundRect(ctx, -VX, -VY, 2 * VX, 2 * VY, VR); ctx.fillStyle = "rgba(5,11,22,0.35)"; ctx.fill();
        for (const c of nbChloro) { ctx.beginPath(); ctx.ellipse(c.x, c.y, 2.2, 0.95, c.a, 0, TAU); ctx.fillStyle = "#1f6b3a"; ctx.fill(); }
        al(ctx, 0.5);
        K.roundRect(ctx, -HX - WALL / 2, -HY - WALL / 2, 2 * HX + WALL, 2 * HY + WALL, RC + WALL / 2);
        ctx.strokeStyle = COL.cellwall; ctx.lineWidth = WALL; ctx.stroke();
        ctx.restore();
      }
      al(ctx, 1);
      // cell wall (cellulose) with middle lamella
      K.roundRect(ctx, -HX - WALL / 2, -HY - WALL / 2, 2 * HX + WALL, 2 * HY + WALL, RC + WALL / 2);
      ctx.strokeStyle = K.shade(COL.cellwall, -0.15); ctx.lineWidth = WALL; ctx.stroke();
      const wf = lod(s, 30, 80);
      if (wf > 0) {
        al(ctx, 0.6 * wf); ctx.strokeStyle = "#e6efb0"; ctx.lineWidth = Math.max(0.02, 0.8 * px);
        for (const off of [0.12, 0.26, 0.4]) {
          ctx.setLineDash([0.45, 0.18]); ctx.lineDashOffset = off * 3;
          K.roundRect(ctx, -HX - off, -HY - off, 2 * (HX + off), 2 * (HY + off), RC + off); ctx.stroke();
        }
        ctx.setLineDash([]); ctx.lineDashOffset = 0; al(ctx, 1);
      }
      K.roundRect(ctx, -HX - WALL, -HY - WALL, 2 * (HX + WALL), 2 * (HY + WALL), RC + WALL);
      ctx.strokeStyle = "#5b5a2a"; ctx.lineWidth = Math.max(0.03, 1 * px); ctx.stroke();
      // cytoplasm
      K.roundRect(ctx, -HX, -HY, 2 * HX, 2 * HY, RC); ctx.fillStyle = cytoGrad; ctx.fill();
      drawCrowd(ctx, v, t, (x, y) => sdCell(x, y) < -0.01 && sdVac(x, y) > 0.01);
      const tf = flowT;
      drawCytoLines(ctx, v, cables, Math.max(0.012, 0.9 * px), 0.2, "#f0abfc");
      drawER(ctx, v, ser, false);
      drawER(ctx, v, rer, true);
      const rf = lod(s, 45, 100);
      drawRibos(ctx, riboER, v, rf, 0.0125);
      drawRibos(ctx, riboFree, v, rf, 0.0125);
      for (const g of golgis) drawGolgi(ctx, g, v, t);
      // central vacuole + tonoplast
      K.roundRect(ctx, -VX, -VY, 2 * VX, 2 * VY, VR); ctx.fillStyle = "rgba(6,20,40,0.55)"; ctx.fill();
      ctx.fillStyle = vacGrad; ctx.fill();
      ctx.strokeStyle = K.withAlpha(COL.vacuole, 0.85); ctx.lineWidth = Math.max(0.015, 1.6 * px); ctx.stroke();
      if (inView(v, 0, 0, VX)) {
        al(ctx, 0.5);
        for (let k = 0; k < 6; k++) {
          const x = Math.sin(t * 0.07 + k * 2.1) * VX * 0.6, y = Math.cos(t * 0.05 + k * 1.3) * VY * 0.55;
          K.glow(ctx, x, y, 3.5, COL.vacuole, 0.08);
        }
        al(ctx, 1);
      }
      // streaming organelles
      for (const m of mitos) drawMito(ctx, m, flowPos(m, tf, 1), t, v);
      for (const p of perox) { const q = flowPos(p, tf, 1); if (inView(v, q.x, q.y, p.r)) ball(ctx, q.x, q.y, p.r, COL.peroxisome); }
      for (const c of chloros) drawChloro(ctx, c, flowPos(c, tf, 1), v, t);
      traffic.draw(ctx, v);
      // nucleus (pressed into a corner by the vacuole)
      if (inView(v, N.x, N.y, N.r + 0.3)) {
        K.glow(ctx, N.x, N.y, N.r * 1.4, COL.nucleus, 0.18);
        ctx.beginPath(); ctx.arc(N.x, N.y, N.r, 0, TAU); ctx.fillStyle = "#18204a"; ctx.fill(); ctx.fillStyle = nucGrad; ctx.fill();
        ball(ctx, NO.x, NO.y, NO.r, COL.nucleolus);
        const ef = lod(s, 25, 60);
        ctx.strokeStyle = K.shade(COL.nucleus, 0.35); ctx.lineWidth = Math.max(0.05, 1.5 * px);
        ctx.beginPath(); ctx.arc(N.x, N.y, N.r, 0, TAU); ctx.stroke();
        if (ef > 0) {
          al(ctx, ef);
          for (let k = 0; k < 26; k++) {
            const a = (k / 26) * TAU, x = N.x + Math.cos(a) * N.r, y = N.y + Math.sin(a) * N.r;
            ctx.beginPath(); ctx.arc(x, y, 0.06, 0, TAU); ctx.fillStyle = "#0a1628"; ctx.fill(); ctx.lineWidth = 0.018; ctx.strokeStyle = "#e0e7ff"; ctx.stroke();
          }
          al(ctx, 1);
        }
      }
      drawMembrane(ctx, v, bp, bn);
    },
    hit(x, y, px) {
      const tol = 6 * px, tf = flowT;
      if (lod(1 / px, 45, 100) > 0.3) {
        let i = hitFlat(riboER, x, y, Math.max(0.02, 10 * px)), arr = riboER;
        if (i < 0) { i = hitFlat(riboFree, x, y, Math.max(0.02, 10 * px)); arr = riboFree; }
        if (i >= 0) { const rx = arr[i], ry = arr[i + 1]; return resultBase("ribosome", rx, ry, 0.5, (ctx) => ctx.arc(rx, ry, 0.03, 0, TAU)); }
      }
      const vq = traffic.hit(x, y, Math.max(0.06, 10 * px));
      if (vq) { const p = traffic.pos(vq); return resultBase("vesicle", p.x, p.y, 0.8, (ctx) => { const q = traffic.pos(vq); ctx.arc(q.x, q.y, 0.08, 0, TAU); }); }
      if (Math.hypot(x - NO.x, y - NO.y) < NO.r + tol * 0.5) return resultBase("nucleolus", NO.x, NO.y, 2.2, (ctx) => ctx.arc(NO.x, NO.y, NO.r, 0, TAU));
      if (Math.hypot(x - N.x, y - N.y) < N.r + tol) return resultBase("nucleus", N.x, N.y, 5.5, (ctx) => ctx.arc(N.x, N.y, N.r, 0, TAU));
      for (const p of perox) { const q = flowPos(p, tf, 1); if (Math.hypot(x - q.x, y - q.y) < p.r + tol) return resultBase("peroxisome", q.x, q.y, 1.3, (ctx) => { const z = flowPos(p, flowT, 1); ctx.arc(z.x, z.y, p.r, 0, TAU); }); }
      for (const c of chloros) {
        const q = flowPos(c, tf, 1), cs = Math.cos(q.a), sn = Math.sin(q.a), dx = x - q.x, dy = y - q.y;
        const lx = dx * cs + dy * sn, ly = -dx * sn + dy * cs;
        if ((lx / (c.rx + tol)) ** 2 + (ly / (c.ry + tol)) ** 2 < 1)
          return resultBase("chloroplast", q.x, q.y, 6.5, (ctx) => { const z = flowPos(c, flowT, 1); ctx.ellipse(z.x, z.y, c.rx, c.ry, z.a, 0, TAU); });
      }
      for (const m of mitos) {
        const q = flowPos(m, tf, 1), cs = Math.cos(q.a), sn = Math.sin(q.a), dx = x - q.x, dy = y - q.y;
        const lx = dx * cs + dy * sn, ly = -dx * sn + dy * cs;
        if (Math.hypot(Math.max(Math.abs(lx) - (m.L / 2 - m.W / 2), 0), ly) - m.W / 2 < tol)
          return resultBase("mito", q.x, q.y, 3, (ctx) => { const z = flowPos(m, flowT, 1); ctx.save(); ctx.translate(z.x, z.y); ctx.rotate(z.a); K.roundRect(ctx, -m.L / 2, -m.W / 2, m.L, m.W, m.W / 2); ctx.restore(); });
      }
      for (const g of golgis) if (golgiHit(g, x, y, tol)) return resultBase("golgi", g.x, g.y, 2.6, golgiOutline(g));
      for (const pl of rer) if (distPoly(x, y, pl.p) < 0.1 + tol) return resultBase("rer", x, y, 4.5, (ctx) => { for (const q of rer) tracePoly(ctx, q.p); });
      for (const pl of ser) if (distPoly(x, y, pl.p) < 0.07 + tol) return resultBase("ser", x, y, 3, (ctx) => { for (const q of ser) tracePoly(ctx, q.p); });
      const sd = sdCell(x, y), mt = Math.max(0.03, 7 * px);
      if (sd > -mt && sd <= Math.min(0.12, mt * 0.6)) return resultBase("membrane", x, y, 0, (ctx) => K.roundRect(ctx, -HX, -HY, 2 * HX, 2 * HY, RC));
      if (sd > 0 && sd < WALL + tol) return resultBase("cellwall", x, y, 0, (ctx) => K.roundRect(ctx, -HX - WALL / 2, -HY - WALL / 2, 2 * HX + WALL, 2 * HY + WALL, RC + WALL / 2));
      for (const pl of cables) if (distPoly(x, y, pl.p) < 0.02 + 4 * px) return resultBase("cytoskeleton", x, y, 0, (ctx) => { for (const q of cables) tracePoly(ctx, q.p); });
      if (sdVac(x, y) < tol) return resultBase("vacuole", 0, 0, 0, (ctx) => K.roundRect(ctx, -VX, -VY, 2 * VX, 2 * VY, VR));
      if (sd < 0) return resultBase("cytoplasm", x, y, 0, (ctx) => K.roundRect(ctx, -HX + 0.1, -HY + 0.1, 2 * HX - 0.2, 2 * HY - 0.2, RC));
      return null;
    },
    anchors(cx, cy) {
      const tf = flowT, out = [];
      const nb = nearestInFlat(cx, cy, bp);
      out.push({ id: "membrane", x: nb.x, y: nb.y });
      const gq = grad(nb.x, nb.y);
      out.push({ id: "cellwall", x: nb.x + gq.x * 0.3, y: nb.y + gq.y * 0.3 });
      const ca = nearestInFlat(cx, cy, riboFree); out.push({ id: "cytoplasm", x: ca.x, y: ca.y });
      out.push({ id: "nucleus", x: N.x - 0.9, y: N.y + 1.0 });
      out.push({ id: "nucleolus", x: NO.x, y: NO.y });
      let best = null; for (const pl of rer) { const q = nearestInFlat(cx, cy, pl.p); if (!best || q.d < best.d) best = q; } out.push({ id: "rer", x: best.x, y: best.y });
      best = null; for (const pl of ser) { const q = nearestInFlat(cx, cy, pl.p); if (!best || q.d < best.d) best = q; } out.push({ id: "ser", x: best.x, y: best.y });
      const rb = nearestInFlat(cx, cy, riboER); out.push({ id: "ribosome", x: rb.x, y: rb.y });
      const gg = nearestObj(cx, cy, golgis, (g) => g); out.push({ id: "golgi", x: gg.x, y: gg.y });
      const mm = nearestObj(cx, cy, mitos, (m) => flowPos(m, tf, 1)); out.push({ id: "mito", x: mm.x, y: mm.y });
      const ch = nearestObj(cx, cy, chloros, (m) => flowPos(m, tf, 1)); out.push({ id: "chloroplast", x: ch.x, y: ch.y });
      const vx = clamp(cx, -VX * 0.6, VX * 0.6), vy = clamp(cy, -VY * 0.6, VY * 0.6); out.push({ id: "vacuole", x: vx, y: vy });
      const pp = nearestObj(cx, cy, perox, (m) => flowPos(m, tf, 1)); out.push({ id: "peroxisome", x: pp.x, y: pp.y });
      best = null; for (const pl of cables) { const q = nearestInFlat(cx, cy, pl.p); if (!best || q.d < best.d) best = q; } out.push({ id: "cytoskeleton", x: best.x, y: best.y });
      const vv = nearestObj(cx, cy, traffic.ves, (q) => traffic.pos(q)); out.push({ id: "vesicle", x: vv.x, y: vv.y });
      return out;
    },
    erVisible(v) {
      const mx = (v.x1 - v.x0) * 0.15, my = (v.y1 - v.y0) * 0.15;
      return rer.some((pl) => { for (let i = 0; i < pl.p.length; i += 2) if (pl.p[i] > v.x0 + mx && pl.p[i] < v.x1 - mx && pl.p[i + 1] > v.y0 + my && pl.p[i + 1] < v.y1 - my) return true; return false; });
    },
  };
  return cell;
}

// =====================================================================
// BACTERIUM  (rod ~2 µm × 0.8 µm; prokaryote)
// =====================================================================
export function buildBacterium() {
  const R = rng(5), r = (a, b) => a + (b - a) * R();
  let T = 0;
  const L = 0.6, RB = 0.4, HX = L + RB, CAP = 0.14, WALLW = 0.03, MEM = 0.038;
  const sd = (x, y) => sdRR(x, y, HX, RB, RB);
  const NB = 420, bp = new Float32Array(NB * 2), bn = new Float32Array(NB * 2), mp = new Float32Array(NB * 2);
  for (let i = 0; i < NB; i++) { const q = rrPoint(HX, RB, RB, i / NB); bp[2 * i] = q.x; bp[2 * i + 1] = q.y; }
  computeNormals(bp, bn);
  for (let i = 0; i < NB * 2; i++) mp[i] = bp[i] - bn[i] * MEM; // membrane line, inside the wall
  const stadium = (ctx, d) => { ctx.beginPath(); ctx.arc(L, 0, RB + d, -Math.PI / 2, Math.PI / 2); ctx.arc(-L, 0, RB + d, Math.PI / 2, Math.PI * 1.5); ctx.closePath(); };

  // nucleoid: long tangled loop of DNA confined to the middle
  const dna = [];
  { let x = 0, y = 0, a = 0;
    for (let i = 0; i < 1300; i++) {
      a += r(-0.7, 0.7);
      let nx = x + Math.cos(a) * 0.022, ny = y + Math.sin(a) * 0.022;
      if ((nx / 0.6) ** 2 + (ny / 0.21) ** 2 > 1) { a = Math.atan2(-y, -x) + r(-0.9, 0.9); nx = x + Math.cos(a) * 0.022; ny = y + Math.sin(a) * 0.022; }
      x = nx; y = ny; dna.push(x, y);
    }
  }
  const dnaPoly = new Float32Array(dna);
  const plasmids = [{ x: -0.74, y: 0.18 }, { x: 0.78, y: -0.15 }, { x: 0.45, y: 0.25 }].map((p) => ({ ...p, ph: R() * TAU }));
  const rib = [];
  while (rib.length < 640) {
    const x = r(-HX, HX), y = r(-RB, RB);
    if (sd(x, y) < -0.065 && (x / 0.6) ** 2 + (y / 0.21) ** 2 > 0.8 && plasmids.every((p) => Math.hypot(x - p.x, y - p.y) > 0.07)) rib.push(x, y);
  }
  const ribo = new Float32Array(rib);
  // pili: short hair-like fibres around the surface
  const pili = [];
  for (let i = 0; i < 22; i++) {
    const u = R(), q = rrPoint(HX, RB, RB, u), nx = q.ty, ny = -q.tx;
    if (q.x > HX - 0.15 && Math.abs(q.y) < 0.2) continue; // keep the flagellum pole clear
    const len = r(0.18, 0.42), bend = r(-0.06, 0.06);
    pili.push({ x0: q.x, y0: q.y, x1: q.x + nx * len - ny * bend * 2, y1: q.y + ny * len + nx * bend * 2, cx: q.x + nx * len * 0.5 + -ny * bend, cy: q.y + ny * len * 0.5 + nx * bend, ph: R() * TAU });
  }
  const capFib = Array.from({ length: 220 }, () => { const q = rrPoint(HX, RB, RB, R()); return { x: q.x, y: q.y, nx: q.ty, ny: -q.tx, l: r(0.04, 0.13) }; });

  // flagellum: helical filament driven by a rotary motor at the pole
  const FL = 5.5, AMP = 0.2, LAM = 2.2;
  let phase = 0;
  const flag = new Float32Array(2 * 140);
  const base = { x: HX - MEM, y: 0 };
  const updFlag = () => {
    const ang = 0.06;
    for (let i = 0; i < 140; i++) {
      const s = (i / 139) * FL, ramp = Math.min(1, s / 0.7);
      const lx = s, ly = AMP * ramp * Math.sin((TAU * s) / LAM - phase);
      const hx = HX + 0.1 + lx, hy = ly + 0.05 * Math.min(1, s / 0.15);
      flag[2 * i] = hx * Math.cos(ang) - hy * Math.sin(ang) * 0.2; flag[2 * i + 1] = hy + (hx - HX) * Math.sin(ang);
    }
  };
  updFlag();

  let cytoGrad = null, capGrad = null;
  const cell = {
    type: "bacteria", fit: { x: 0.8, y: 0, w: 4.2, h: 1.8 }, bounds: { x0: -1.6, x1: 7, y0: -1.2, y1: 1.2 },
    update(dt, t) { T = t; phase += dt * TAU * 1.2; updFlag(); },
    draw(ctx, v, t, A) {
      GA = A; T = t;
      const s = v.s, px = v.px;
      if (!cytoGrad) {
        cytoGrad = ctx.createLinearGradient(0, -RB, 0, RB);
        cytoGrad.addColorStop(0, "rgba(79,209,197,0.28)"); cytoGrad.addColorStop(0.5, "rgba(50,150,150,0.18)"); cytoGrad.addColorStop(1, "rgba(79,209,197,0.26)");
        capGrad = ctx.createRadialGradient(0, 0, 0.3, 0, 0, HX + CAP);
        capGrad.addColorStop(0, "rgba(148,163,184,0.18)"); capGrad.addColorStop(1, "rgba(148,163,184,0.1)");
      }
      // flagellum (behind the cell)
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); tracePoly(ctx, flag);
      al(ctx, 0.18); ctx.strokeStyle = COL.flagellum; ctx.lineWidth = Math.max(0.06, 6 * px); ctx.stroke();
      al(ctx, 0.95); ctx.lineWidth = Math.max(0.02, 1.6 * px); ctx.stroke();
      if (s > 400) { // helical sheen: bright dashes travelling with the wave
        al(ctx, 0.6); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = Math.max(0.006, 0.6 * px);
        ctx.setLineDash([0.06, 0.12]); ctx.lineDashOffset = -phase * 0.06; ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
      }
      al(ctx, 1);
      // pili
      ctx.beginPath();
      for (const p of pili) { if (!inView(v, p.cx, p.cy, 0.5)) continue; const w = 0.02 * Math.sin(t * 1.3 + p.ph); ctx.moveTo(p.x0, p.y0); ctx.quadraticCurveTo(p.cx + w, p.cy - w, p.x1, p.y1); }
      al(ctx, 0.7); ctx.strokeStyle = COL.pili; ctx.lineWidth = Math.max(0.007, 0.9 * px); ctx.stroke(); al(ctx, 1);
      // capsule
      stadium(ctx, CAP); ctx.fillStyle = capGrad; ctx.fill();
      al(ctx, 0.35); ctx.strokeStyle = COL.capsule; ctx.lineWidth = Math.max(0.004, 1 * px); ctx.setLineDash([0.03, 0.03]); ctx.stroke(); ctx.setLineDash([]); al(ctx, 1);
      const cf = lod(s, 350, 800);
      if (cf > 0) {
        ctx.beginPath();
        for (const f of capFib) { if (!inView(v, f.x, f.y, 0.2)) continue; ctx.moveTo(f.x + f.nx * 0.02, f.y + f.ny * 0.02); ctx.lineTo(f.x + f.nx * f.l, f.y + f.ny * f.l); }
        al(ctx, 0.35 * cf); ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 0.004; ctx.stroke(); al(ctx, 1);
      }
      // cell wall (peptidoglycan)
      stadium(ctx, -WALLW / 2); ctx.strokeStyle = K.withAlpha("#d4a373", 0.95); ctx.lineWidth = WALLW; ctx.stroke();
      const pf = lod(s, 900, 1800);
      if (pf > 0) { al(ctx, pf * 0.7); ctx.strokeStyle = "#7c4a1e"; ctx.lineWidth = 0.004; ctx.setLineDash([0.006, 0.004]); stadium(ctx, -WALLW * 0.3); ctx.stroke(); stadium(ctx, -WALLW * 0.7); ctx.stroke(); ctx.setLineDash([]); al(ctx, 1); }
      // cytoplasm
      stadium(ctx, -MEM); ctx.fillStyle = cytoGrad; ctx.fill();
      drawCrowd(ctx, v, t, (x, y) => sd(x, y) < -MEM - 0.005);
      // nucleoid
      ctx.save(); ctx.translate(0, 0); ctx.scale(1, 0.38); K.glow(ctx, 0, 0, 0.75, COL.nucleoid, 0.22); ctx.restore();
      ctx.save(); ctx.translate(0.01 * Math.sin(t * 0.7), 0.006 * Math.cos(t * 0.9));
      ctx.beginPath(); tracePoly(ctx, dnaPoly);
      al(ctx, 0.75); ctx.strokeStyle = COL.nucleoid; ctx.lineWidth = Math.max(0.003, 0.9 * px); ctx.stroke(); al(ctx, 1);
      ctx.restore();
      // plasmids (supercoiled rings)
      for (const p of plasmids) {
        if (!inView(v, p.x, p.y, 0.1)) continue;
        ctx.beginPath();
        for (let k = 0; k <= 60; k++) {
          const a = (k / 60) * TAU, rr = 0.045 + 0.008 * Math.sin(4 * a + t * 0.6 + p.ph);
          const x = p.x + Math.cos(a) * rr, y = p.y + Math.sin(a) * rr * 0.75;
          k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.strokeStyle = COL.plasmid; ctx.lineWidth = Math.max(0.005, 1.4 * px); ctx.stroke();
        K.glow(ctx, p.x, p.y, 0.09, COL.plasmid, 0.25);
      }
      drawRibos(ctx, ribo, v, lod(s, 60, 130), 0.01);
      // membrane (just inside the wall)
      drawMembrane(ctx, v, mp, bn);
      // flagellar motor at the pole
      const mf = lod(s, 500, 1100);
      if (mf > 0 && inView(v, base.x, base.y, 0.1)) {
        al(ctx, mf);
        ctx.save(); ctx.translate(HX, 0);
        for (const [x, h, c] of [[-0.065, 0.045, "#94a3b8"], [-0.038, 0.032, "#fbbf24"], [-0.015, 0.026, "#cbd5e1"], [0.004, 0.024, "#cbd5e1"]]) {
          K.roundRect(ctx, x - 0.006, -h, 0.012, 2 * h, 0.004); ctx.fillStyle = c; ctx.fill();
        }
        ctx.fillStyle = "#64748b"; ctx.fillRect(-0.065, -0.008, 0.18, 0.016);
        // rotation tick
        const k = Math.sin(phase); ctx.fillStyle = "#ffffff"; ctx.fillRect(-0.069, k * 0.04 - 0.004, 0.008, 0.008);
        ctx.restore(); al(ctx, 1);
      }
    },
    hit(x, y, px) {
      const tol = 6 * px;
      if (lod(1 / px, 60, 130) > 0.3) {
        const i = hitFlat(ribo, x, y, Math.max(0.015, 9 * px));
        if (i >= 0) { const rx = ribo[i], ry = ribo[i + 1]; return resultBase("ribosome", rx, ry, 0.25, (ctx) => ctx.arc(rx, ry, 0.022, 0, TAU)); }
      }
      for (const p of plasmids) if (Math.hypot(x - p.x, y - p.y) < 0.06 + tol) return resultBase("plasmid", p.x, p.y, 0.4, (ctx) => ctx.arc(p.x, p.y, 0.065, 0, TAU));
      const d = sd(x, y);
      if (d > 0.02 && distPoly(x, y, flag) < 0.02 + tol) return resultBase("flagellum", x, y, 0, (ctx) => tracePoly(ctx, flag));
      for (const p of pili) if (d > 0 && segDist(x, y, p.x0, p.y0, p.x1, p.y1) < 0.01 + tol) return resultBase("pili", x, y, 0, (ctx) => { for (const q of pili) { ctx.moveTo(q.x0, q.y0); ctx.quadraticCurveTo(q.cx, q.cy, q.x1, q.y1); } });
      const wallD = Math.abs(d + WALLW / 2) - WALLW / 2, memD = Math.abs(d + MEM);
      const tw = Math.max(0.006, 5 * px);
      if (Math.min(wallD, memD) < tw) {
        if (memD < wallD) return resultBase("membrane", x, y, 0, (ctx) => { for (let i = 0; i < NB; i++) i ? ctx.lineTo(mp[2 * i], mp[2 * i + 1]) : ctx.moveTo(mp[0], mp[1]); ctx.closePath(); });
        return resultBase("cellwall", x, y, 0, (ctx) => stadium(ctx, -WALLW / 2));
      }
      if (d > 0 && d < CAP + tol) return resultBase("capsule", x, y, 0, (ctx) => stadium(ctx, CAP));
      if (d < 0 && (x / 0.62) ** 2 + (y / 0.23) ** 2 < 1) return resultBase("nucleoid", 0, 0, 1.6, (ctx) => ctx.ellipse(0, 0, 0.62, 0.23, 0, 0, TAU));
      if (d < 0) return resultBase("cytoplasm", x, y, 0, (ctx) => stadium(ctx, -MEM - 0.004));
      return null;
    },
    anchors(cx, cy) {
      const out = [];
      out.push({ id: "capsule", x: -HX - CAP * 0.6, y: -0.15 });
      out.push({ id: "cellwall", x: -0.2, y: -RB + WALLW / 2 });
      out.push({ id: "membrane", x: 0.3, y: RB - MEM });
      out.push({ id: "cytoplasm", x: -0.55, y: -0.22 });
      out.push({ id: "nucleoid", x: 0.1, y: 0.05 });
      const pl = nearestObj(cx, cy, plasmids, (p) => p); out.push({ id: "plasmid", x: pl.x, y: pl.y });
      const rb = nearestInFlat(cx, cy, ribo); out.push({ id: "ribosome", x: rb.x, y: rb.y });
      const fl = nearestInFlat(Math.max(cx, HX + 0.6), cy, flag); out.push({ id: "flagellum", x: fl.x, y: fl.y });
      const pp = nearestObj(cx, cy, pili, (p) => ({ x: p.x1, y: p.y1 })); out.push({ id: "pili", x: pp.x, y: pp.y });
      return out;
    },
    erVisible() { return false; },
  };
  return cell;
}
