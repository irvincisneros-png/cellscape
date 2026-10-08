// Drawing helpers for the photosynthesis sim (membrane, proteins, Rubisco, Elodea inset).
import * as K from "../../assets/js/kit.js";

const { C, TAU, lerp, clamp } = K;
const HEAD = "#86c99a", TAIL = "#4d6b3c";

// ---------- thylakoid membrane (pre-rendered, green-tinted bilayer) ----------
let memCache = { key: "", cv: null, hr: 0 };
function buildMembrane(L) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const hr = 6.2 * L.sc;
  const W = Math.ceil(L.x1 - L.x0), H = Math.ceil(2 * L.u + 2 * hr + 6);
  const key = [W, H, L.psii, L.b6f, L.psi, L.atps, dpr].map((v) => Math.round(v)).join(",");
  if (memCache.key === key) return memCache;
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, W * dpr); cv.height = Math.max(1, H * dpr);
  const c = cv.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const y0 = hr + 3, y1 = H - hr - 3, mid = H / 2;
  // hydrophobic core glow
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, "rgba(60,110,60,0.0)"); g.addColorStop(0.5, "rgba(70,130,60,0.42)"); g.addColorStop(1, "rgba(60,110,60,0.0)");
  c.fillStyle = g; c.fillRect(0, y0, W, y1 - y0);
  const gaps = [[L.psii, 2.55 * L.u], [L.b6f, 1.2 * L.u], [L.psi, 2.45 * L.u], [L.atps, 1.25 * L.u]].map(([x, hw]) => [x - L.x0, hw]);
  const skip = (x) => gaps.some(([gx, hw]) => Math.abs(x - gx) < hw);
  const step = hr * 2.05;
  for (let x = hr; x < W; x += step) {
    if (skip(x)) continue;
    const wob = Math.sin(x * 0.07) * 1.1;
    c.strokeStyle = TAIL; c.lineWidth = 1.5;
    for (const dx of [-hr * 0.35, hr * 0.35]) {
      c.beginPath(); c.moveTo(x + dx, y0 + hr * 0.8 + wob); c.quadraticCurveTo(x + dx + Math.sin(x) * 1.5, (y0 + mid) / 2, x + dx, mid - 2); c.stroke();
      c.beginPath(); c.moveTo(x + dx, y1 - hr * 0.8 + wob); c.quadraticCurveTo(x + dx - Math.sin(x) * 1.5, (y1 + mid) / 2, x + dx, mid + 2); c.stroke();
    }
    K.sphere(c, x, y0 + wob, hr, HEAD);
    K.sphere(c, x, y1 + wob, hr, HEAD);
  }
  memCache = { key, cv, hr, W, H };
  return memCache;
}

export function drawMembrane(ctx, L) {
  const m = buildMembrane(L);
  ctx.drawImage(m.cv, L.x0, L.memY - m.H / 2, m.W, m.H);
  if (L.x1 < L.w - 1) {
    // rounded thylakoid edge: lumen closes off
    ctx.save();
    ctx.strokeStyle = "rgba(134,201,154,0.45)"; ctx.lineWidth = 2 * L.u * 0.7; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(L.x1 - 2, L.memY); ctx.lineTo(L.x1 + 2, L.memY); ctx.stroke();
    ctx.restore();
  }
}

// ---------- proteins ----------
function chlorophyllDots(ctx, x, y, w, h, t, seed) {
  for (let i = 0; i < 6; i++) {
    const px = x + Math.sin(i * 2.3 + seed) * w * 0.35, py = y + Math.cos(i * 1.7 + seed) * h * 0.3;
    K.glow(ctx, px, py, 5, "#86efac", 0.25 + 0.15 * Math.sin(t * 2 + i));
  }
}

export function drawPSII(ctx, L, t) {
  const { u, sc, memY } = L, x = L.psii, h = 2 * u + 26 * sc;
  K.blob(ctx, x - 1.85 * u, memY, 1.3 * u, 2 * u + 8 * sc, "#3fa86a");
  K.blob(ctx, x + 1.85 * u, memY, 1.3 * u, 2 * u + 8 * sc, "#3fa86a");
  chlorophyllDots(ctx, x - 1.85 * u, memY, 1.3 * u, 2 * u, t, 1);
  chlorophyllDots(ctx, x + 1.85 * u, memY, 1.3 * u, 2 * u, t, 4);
  K.blob(ctx, x, memY, 2.4 * u, h, "#23855a", u * 0.7);
  K.glow(ctx, x, memY, 12 * sc, "#d9f99d", 0.35);
  // oxygen-evolving complex (Mn₄CaO₅) on the lumen side
  const oy = L.oec.y;
  for (let i = 0; i < 4; i++) K.sphere(ctx, x - 7 * sc + i * 4.6 * sc, oy + (i % 2) * 2, 3 * sc, i === 3 ? "#e2e8f0" : "#c2410c");
}

export function drawB6f(ctx, L) {
  const { u, sc, memY } = L, x = L.b6f, h = 2 * u + 30 * sc;
  K.blob(ctx, x - 0.45 * u, memY, 1.05 * u, h, "#7a5cc8", u * 0.45);
  K.blob(ctx, x + 0.45 * u, memY, 1.05 * u, h, "#6b4fb5", u * 0.45);
  K.sphere(ctx, x, memY - u - 6 * sc, 4 * sc, "#f87171");
}

export function drawPSI(ctx, L, t) {
  const { u, sc, memY } = L, x = L.psi, h = 2 * u + 22 * sc;
  K.blob(ctx, x - 1.75 * u, memY, 1.25 * u, 2 * u + 6 * sc, "#4aa35a");
  chlorophyllDots(ctx, x - 1.75 * u, memY, 1.25 * u, 2 * u, t, 7);
  K.blob(ctx, x, memY, 2.3 * u, h, "#2e7d4a", u * 0.7);
  K.glow(ctx, x, memY, 12 * sc, "#d9f99d", 0.35);
  // ferredoxin + NADP⁺ reductase on the stroma side
  K.sphere(ctx, L.fd.x, L.fd.y, 5 * sc, "#b45309");
  K.blob(ctx, L.fnr.x, L.fnr.y, 22 * sc, 14 * sc, "#ca8a04", 7 * sc);
}

export function drawSynthase(ctx, L, rotor, t) {
  const { u, sc, memY } = L, x = L.atps, head = L.head;
  // peripheral stalk (stator)
  ctx.save();
  ctx.strokeStyle = "#a16207"; ctx.lineWidth = 4 * sc; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x + 1.15 * u, memY); ctx.lineTo(x + 1.15 * u, head.y - 8 * sc); ctx.lineTo(x + 20 * sc, head.y - 4 * sc); ctx.stroke();
  ctx.restore();
  // c-ring rotor in the membrane (stripes slide round to look like rotation)
  K.blob(ctx, x, memY, 2.1 * u, 2 * u + 4 * sc, "#b7794a", u * 0.5);
  ctx.save();
  ctx.beginPath(); K.roundRect(ctx, x - 1.05 * u, memY - u - 2 * sc, 2.1 * u, 2 * u + 4 * sc, u * 0.5); ctx.clip();
  for (let k = 0; k < 10; k++) {
    const a = rotor + (k / 10) * TAU;
    const c = Math.cos(a);
    if (c < 0) continue;
    const sx = x + Math.sin(a) * u * 0.95;
    ctx.strokeStyle = `rgba(255,220,180,${0.15 + 0.35 * c})`; ctx.lineWidth = 3 * sc;
    ctx.beginPath(); ctx.moveTo(sx, memY - u); ctx.lineTo(sx, memY + u); ctx.stroke();
  }
  ctx.restore();
  // central stalk (γ) — rotates
  const gx = x + Math.sin(rotor) * 3 * sc;
  ctx.save();
  ctx.strokeStyle = "#e7c9a0"; ctx.lineWidth = 5 * sc; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x, memY + u); ctx.lineTo(gx, head.y); ctx.stroke();
  ctx.restore();
  // α3β3 head (static) — the active β subunit cycles with rotation
  const rx = 17 * sc, ry = 10 * sc;
  const active = Math.floor(((rotor % TAU) + TAU) % TAU / (TAU / 3));
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU;
    const px = head.x + Math.cos(a) * rx, py = head.y + Math.sin(a) * ry;
    const beta = k % 2 === 1;
    const hot = beta && (k - 1) / 2 === active;
    K.sphere(ctx, px, py, 8.5 * sc, beta ? (hot ? "#fbbf24" : "#c9733a") : "#e8b86d");
  }
  K.sphere(ctx, gx, head.y, 4 * sc, "#fde68a");
}

// ---------- Rubisco (L8S8 complex) ----------
export function drawRubisco(ctx, x, y, r, t, pulse, dmg, dead) {
  const base = K.mix("#34d399", "#9a3b3b", clamp(dmg, 0, 1));
  K.glow(ctx, x, y, r * (1.6 + pulse * 0.6), dead ? C.red : C.teal, 0.18 + pulse * 0.35);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + t * 0.15;
    const spread = 0.5 + dmg * (0.35 + 0.15 * Math.sin(t * 5 + k));
    const jx = dmg * Math.sin(t * 9 + k * 3) * 2, jy = dmg * Math.cos(t * 7 + k) * 2;
    K.sphere(ctx, x + Math.cos(a) * r * spread + jx, y + Math.sin(a) * r * spread + jy, r * 0.36, k % 2 ? base : K.mix(base, "#0f766e", 0.3));
  }
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + 0.4 - t * 0.2;
    K.sphere(ctx, x + Math.cos(a) * r * 0.22 * (1 + dmg), y + Math.sin(a) * r * 0.22 * (1 + dmg), r * 0.2, K.mix("#a7f3d0", "#fca5a5", dmg));
  }
}

export function drawCO2(ctx, x, y, s, rot, alpha = 1) {
  const dx = Math.cos(rot) * 7.5 * s, dy = Math.sin(rot) * 7.5 * s;
  K.sphere(ctx, x - dx, y - dy, 4.2 * s, C.red, { alpha });
  K.sphere(ctx, x + dx, y + dy, 4.2 * s, C.red, { alpha });
  K.sphere(ctx, x, y, 5 * s, "#9ca3af", { alpha });
}

export function drawHex(ctx, x, y, r, col, glowA = 0.4) {
  if (glowA > 0) K.glow(ctx, x, y, r * 2.4, col, glowA * 0.6);
  ctx.save();
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + Math.PI / 6;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, K.shade(col, 0.5)); g.addColorStop(1, K.shade(col, -0.35));
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = K.shade(col, 0.6); ctx.lineWidth = 1.2; ctx.stroke();
  ctx.restore();
}

// ---------- Elodea bubble-counter inset ----------
export function drawInset(ctx, R, o) {
  const { x, y, w, h } = R;
  ctx.save();
  K.roundRect(ctx, x, y, w, h, 12);
  ctx.fillStyle = "rgba(5,11,22,0.82)"; ctx.fill();
  ctx.strokeStyle = "rgba(120,190,255,0.22)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.clip();
  // beaker of water
  const bx = x + w * 0.2, bw = w * 0.6, by = y + h * 0.2, bh = h * 0.62;
  const wg = ctx.createLinearGradient(0, by, 0, by + bh);
  wg.addColorStop(0, "rgba(56,189,248,0.25)"); wg.addColorStop(1, "rgba(14,116,144,0.35)");
  ctx.fillStyle = wg; ctx.fillRect(bx, by + bh * 0.08, bw, bh * 0.92);
  ctx.strokeStyle = "rgba(226,232,240,0.55)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by); ctx.stroke();
  // lamp glow on the left
  if (o.lampOn) K.glow(ctx, x + 4, by + bh * 0.5, w * 0.35 + w * 0.3 * Math.min(1, o.light), o.lampCol, 0.15 + 0.35 * Math.min(1, o.light));
  // Elodea sprig (cut end up, as in the prac)
  const sx = bx + bw * 0.5, top = by + bh * 0.3, bot = by + bh * 0.97;
  ctx.strokeStyle = "#4ade80"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(sx, bot); ctx.quadraticCurveTo(sx + 5 + Math.sin(o.t) * 1.5, (top + bot) / 2, sx, top); ctx.stroke();
  for (let k = 0; k < 7; k++) {
    const ly = lerp(bot - 4, top + 6, k / 6);
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(sx + 2 * Math.sin(k), ly);
      ctx.rotate(side * (0.9 + 0.1 * Math.sin(o.t * 1.3 + k)) + Math.PI);
      ctx.fillStyle = k % 2 ? "#22c55e" : "#16a34a";
      ctx.beginPath(); ctx.ellipse(0, -6, 2.4, 6.5, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
  // bubbles rising from the cut end to the surface
  const surf = by + bh * 0.08;
  for (const b of o.bubbles) {
    const py = lerp(top - 2, surf + 2, b.y);
    const px = sx + b.x * 3 + Math.sin(b.y * 12 + b.x * 5) * 2;
    ctx.strokeStyle = "rgba(224,242,254,0.85)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(px, py, 2.2 * b.r, 0, TAU); ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  ctx.fillStyle = C.inkDim; ctx.font = "600 10px Inter, system-ui, sans-serif";
  ctx.fillText("Pondweed (Elodea)", x + w / 2, y + 6);
  ctx.fillStyle = C.ink; ctx.font = `600 ${w > 120 ? 13 : 11}px "Space Grotesk", Inter, sans-serif`;
  ctx.fillText(`${o.rate.toFixed(o.rate < 10 ? 1 : 0)} bubbles/min`, x + w / 2, y + h - 30);
  ctx.fillStyle = C.inkFaint; ctx.font = "9px Inter, system-ui, sans-serif";
  ctx.fillText(`counted ${o.counted} · ×6 speed`, x + w / 2, y + h - 14);
  ctx.restore();
}

export function wrapLines(ctx, text, maxW) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const wd of words) {
    const test = cur ? cur + " " + wd : wd;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = wd; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}
