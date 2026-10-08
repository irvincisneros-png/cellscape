// Osmosis & Tonicity — drawing helpers (cells, beakers, shaker, sprites).
import * as K from "../../assets/js/kit.js";

const { C, TAU, clamp, lerp } = K;

// ---------- sprites (pre-rendered so many particles stay cheap) ----------
export function makeSprite(radius, paint) {
  const dpr = 2, size = Math.ceil(radius * 2 + 6);
  const c = document.createElement("canvas");
  c.width = c.height = size * dpr;
  const x = c.getContext("2d");
  x.scale(dpr, dpr);
  paint(x, size / 2, size / 2);
  return { img: c, size };
}

export function drawSprite(ctx, sp, x, y, alpha = 1, scale = 1) {
  if (alpha <= 0.01) return;
  const s = sp.size * scale;
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.drawImage(sp.img, x - s / 2, y - s / 2, s, s);
  if (alpha !== 1) ctx.globalAlpha = 1;
}

const ion = (color, r, sign) => makeSprite(r, (c, x, y) => {
  K.sphere(c, x, y, r, color);
  c.fillStyle = "rgba(10,10,30,0.85)";
  c.font = `700 ${Math.round(r * 1.5)}px Inter, system-ui, sans-serif`;
  c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText(sign, x, y + 0.5);
});

const water = (ang) => makeSprite(7, (c, x, y) => {
  const hx = Math.cos(ang), hy = Math.sin(ang);
  // two H atoms at 104.5 degrees around the O
  for (const s of [-1, 1]) {
    const a = Math.atan2(hy, hx) + s * 0.91;
    K.sphere(c, x + Math.cos(a) * 3.6, y + Math.sin(a) * 3.6, 2.3, "#e8f1ff");
  }
  K.sphere(c, x, y, 4.2, C.teal);
});

export const SPRITES = {
  water: [0, 1.6, 3.1, 4.7].map(water),
  na: ion(C.violet, 4.6, "+"),
  cl: ion(C.green, 5.6, "−"),
  solute: makeSprite(4.8, (c, x, y) => K.sphere(c, x, y, 4.6, C.amber)),
};

// ---------- panels ----------
export function frame(ctx, r, title) {
  ctx.save();
  K.roundRect(ctx, r.x, r.y, r.w, r.h, 14);
  ctx.fillStyle = "rgba(5,11,22,0.38)";
  ctx.fill();
  ctx.strokeStyle = "rgba(120,190,255,0.16)";
  ctx.lineWidth = 1;
  ctx.stroke();
  if (title) {
    ctx.font = "600 11px 'Space Grotesk', Inter, sans-serif";
    ctx.fillStyle = C.inkFaint;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText(title.toUpperCase(), r.x + 12, r.y + 9);
  }
  ctx.restore();
}

// Rounded rectangle whose straight sides bulge outward by `bul` px.
export function bulgeRect(ctx, x0, y0, x1, y1, r, bul = 0) {
  r = Math.max(0.5, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2));
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, b = bul * 2;
  ctx.beginPath();
  ctx.moveTo(x0 + r, y0);
  ctx.quadraticCurveTo(mx, y0 - b, x1 - r, y0);
  ctx.quadraticCurveTo(x1, y0, x1, y0 + r);
  ctx.quadraticCurveTo(x1 + b, my, x1, y1 - r);
  ctx.quadraticCurveTo(x1, y1, x1 - r, y1);
  ctx.quadraticCurveTo(mx, y1 + b, x0 + r, y1);
  ctx.quadraticCurveTo(x0, y1, x0, y1 - r);
  ctx.quadraticCurveTo(x0 - b, my, x0, y0 + r);
  ctx.quadraticCurveTo(x0, y0, x0 + r, y0);
  ctx.closePath();
}

// ---------- red blood cell ----------
/** Radius actually drawn for a red blood cell of relative volume V. */
export const rbcRadius = (r0, V) => r0 * Math.pow(Math.max(V, 0.2), 0.42);

export function drawRBC(ctx, x, y, r0, V, t, { lift = 0 } = {}) {
  const sph = clamp((V - 1.0) / 0.55, 0, 1);        // 0 = biconcave disc, 1 = sphere
  const cren = clamp((0.97 - V) / 0.37, 0, 1);      // 0 = smooth, 1 = very spiky
  const R = rbcRadius(r0, V) * (1 + lift * 0.06);
  const tremble = V > 1.42 ? (V - 1.42) * 0.09 : 0;

  K.glow(ctx, x, y, R * 1.9, C.red, 0.16 + lift * 0.1);
  ctx.save();
  ctx.beginPath();
  const N = 160, spikes = 15;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * TAU;
    let rr = R * (1 - cren * 0.12 + cren * 0.34 * Math.pow(0.5 + 0.5 * Math.cos(spikes * a + 0.6), 6));
    rr *= 1 + tremble * Math.sin(a * 5 + t * 38) + 0.012 * Math.sin(a * 3 + t * 1.3);
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(x - R * 0.35, y - R * 0.4, R * 0.05, x, y, R * 1.08);
  g.addColorStop(0, sph > 0.5 ? "#ff9d9d" : "#f26b7a");
  g.addColorStop(0.5, "#d0283f");
  g.addColorStop(1, "#5e0816");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // biconcave dimple: shaded central hollow surrounded by a bright thick rim (torus)
  const dim = (1 - sph) * (1 - cren * 0.55);
  if (dim > 0.02) {
    const d = ctx.createRadialGradient(x + R * 0.04, y + R * 0.06, 0, x, y, R);
    d.addColorStop(0, `rgba(70,0,14,${0.55 * dim})`);
    d.addColorStop(0.42, `rgba(70,0,14,${0.18 * dim})`);
    d.addColorStop(0.66, `rgba(255,160,170,${0.16 * dim})`);
    d.addColorStop(0.85, "rgba(255,160,170,0)");
    d.addColorStop(1, `rgba(40,0,10,${0.3 * dim})`);
    ctx.fillStyle = d;
    ctx.fillRect(x - R * 1.4, y - R * 1.4, R * 2.8, R * 2.8);
  }
  // specular highlight
  const s = ctx.createRadialGradient(x - R * 0.42, y - R * 0.48, 0, x - R * 0.42, y - R * 0.48, R * (0.35 + sph * 0.15));
  s.addColorStop(0, `rgba(255,235,235,${0.45 + sph * 0.25})`);
  s.addColorStop(1, "rgba(255,235,235,0)");
  ctx.fillStyle = s;
  ctx.fillRect(x - R * 1.4, y - R * 1.4, R * 2.8, R * 2.8);
  ctx.restore();
  ctx.strokeStyle = `rgba(255,170,175,${0.35 + sph * 0.35})`;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
  return R;
}

// ---------- plant cell ----------
export function drawPlant(ctx, x, y, W, H, V, P, t, Vc, { lift = 0 } = {}) {
  const wallT = Math.max(4, W * 0.055);
  const bul = clamp(P, 0, 1.2) * W * 0.018;
  const x0 = x - W / 2, y0 = y - H / 2, x1 = x + W / 2, y1 = y + H / 2;
  const rad = W * 0.1;
  ctx.save();
  if (lift) K.glow(ctx, x, y, W * 0.8, C.green, 0.12);
  // cell wall
  bulgeRect(ctx, x0, y0, x1, y1, rad, bul);
  ctx.fillStyle = "rgba(8,26,22,0.35)";
  ctx.fill();
  ctx.lineWidth = wallT;
  ctx.strokeStyle = "#7fae4e";
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(225,255,190,0.5)";
  ctx.stroke();

  // protoplast (cytoplasm + membrane); shrinks away from the wall below Vc
  const f = V >= Vc ? 1 : Math.sqrt(Math.max(0.04, V / Vc));
  const pull = clamp((1 - f) * 3.2, 0, 1);
  const iw = W - wallT * 2 - 2, ih = H - wallT * 2 - 2;
  const pw = iw * f, ph = ih * f;
  const pr = lerp(rad * 0.75, Math.min(pw, ph) * 0.45, pull);
  const pb = V >= Vc ? bul : 0;
  bulgeRect(ctx, x - pw / 2, y - ph / 2, x + pw / 2, y + ph / 2, pr, pb);
  const cg = ctx.createRadialGradient(x - pw * 0.2, y - ph * 0.3, 0, x, y, Math.max(pw, ph) * 0.7);
  cg.addColorStop(0, "rgba(170,240,190,0.35)");
  cg.addColorStop(1, "rgba(80,170,120,0.28)");
  ctx.fillStyle = cg;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.teal;
  ctx.stroke();

  // vacuole
  const m = Math.min(pw, ph) * 0.15;
  const vw = Math.max(2, pw - m * 2), vh = Math.max(2, ph - m * 2);
  bulgeRect(ctx, x - vw / 2, y - vh / 2, x + vw / 2, y + vh / 2, Math.max(2, pr - m * 0.7), pb);
  const vg = ctx.createRadialGradient(x - vw * 0.25, y - vh * 0.3, 0, x, y, Math.max(vw, vh) * 0.7);
  vg.addColorStop(0, "rgba(147,197,253,0.42)");
  vg.addColorStop(1, "rgba(59,130,246,0.30)");
  ctx.fillStyle = vg;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "rgba(191,219,254,0.6)";
  ctx.stroke();

  // chloroplasts streaming around the cytoplasm
  const hw = pw / 2 - m * 0.5, hh = ph / 2 - m * 0.5;
  const se = (a) => {
    const c = Math.cos(a), s = Math.sin(a);
    return [x + hw * Math.sign(c) * Math.pow(Math.abs(c), 0.4), y + hh * Math.sign(s) * Math.pow(Math.abs(s), 0.4)];
  };
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + 0.3 + t * 0.04;
    const [cx, cy] = se(a), [nx, ny] = se(a + 0.02);
    const ang = Math.atan2(ny - cy, nx - cx);
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(ang);
    const gg = ctx.createLinearGradient(0, -m * 0.25, 0, m * 0.25);
    gg.addColorStop(0, "#86efac"); gg.addColorStop(1, "#15803d");
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.ellipse(0, 0, m * 0.42, m * 0.22, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // nucleus
  const [nx, ny] = se(2.35 + t * 0.04);
  K.sphere(ctx, nx, ny, Math.max(2, m * 0.42), C.violet);
  ctx.restore();
  return { wallT, pw, ph };
}

// ---------- salt shaker ----------
export function shakerMouth(x, y, s, tilt) {
  return [x + (s / 2) * Math.sin(tilt), y - (s / 2) * Math.cos(tilt)];
}

export function drawShaker(ctx, x, y, s, tilt = 0, hot = false) {
  ctx.save();
  if (hot) K.glow(ctx, x, y, s * 1.3, C.ink, 0.14);
  ctx.translate(x, y);
  ctx.rotate(tilt);
  const w = s * 0.62, h = s;
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, "rgba(200,220,245,0.35)");
  g.addColorStop(0.4, "rgba(255,255,255,0.8)");
  g.addColorStop(1, "rgba(150,170,200,0.35)");
  K.roundRect(ctx, -w / 2, -h * 0.28, w, h * 0.78, w * 0.22);
  ctx.fillStyle = g;
  ctx.fill();
  K.roundRect(ctx, -w / 2 + 3, h * 0.08, w - 6, h * 0.38, w * 0.15);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fill();
  // metal cap with holes
  const cg = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  cg.addColorStop(0, "#64748b"); cg.addColorStop(0.45, "#e2e8f0"); cg.addColorStop(1, "#475569");
  K.roundRect(ctx, -w / 2 - 1, -h * 0.5, w + 2, h * 0.24, w * 0.25);
  ctx.fillStyle = cg;
  ctx.fill();
  ctx.fillStyle = "#1e293b";
  for (const dx of [-w * 0.2, 0, w * 0.2]) { ctx.beginPath(); ctx.arc(dx, -h * 0.45, 1.3, 0, TAU); ctx.fill(); }
  ctx.fillStyle = "#334155";
  ctx.font = `700 ${Math.round(s * 0.2)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("NaCl", 0, h * 0.27);
  ctx.restore();
}
