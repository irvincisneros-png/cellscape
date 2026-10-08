// Drawing helpers for the oxygen-transport sim (local to this folder).
import * as K from "../../assets/js/kit.js";

const { TAU } = K;

export const COL = {
  oxy: "#e8203a",    // oxyhaemoglobin — bright scarlet
  deoxy: "#6e1129",  // deoxyhaemoglobin — dark maroon (NOT blue)
  coHb: "#ff4f86",   // carboxyhaemoglobin — cherry pink-red
  o2: "#9fdcff",
  co2: "#fbbf24",
  co: "#ff6fa3",
  hco3: "#4ade80",
  tState: "#a78bfa",
  rState: "#4fd1c5",
  lungs: "#4fd1c5",
  tissue: "#fb923c",
};

/** RBC colour from O2Hb and COHb fractions (of all Hb). */
export function rbcColour(sat, fCO) {
  const oxyFrac = K.clamp(sat / Math.max(0.05, 1 - fCO), 0, 1); // how full the non-CO sites are
  const base = K.mix(COL.deoxy, COL.oxy, oxyFrac);
  return fCO > 0.01 ? K.mix(base, COL.coHb, K.clamp(fCO * 1.3, 0, 1)) : base;
}

// ---------- pre-rendered glossy sphere sprites (cheap to draw many) ----------
const spriteCache = new Map();
export function sprite(color, r) {
  const key = color + "|" + r;
  let c = spriteCache.get(key);
  if (!c) {
    const s = 3; // supersample for HiDPI
    c = document.createElement("canvas");
    c.width = c.height = Math.ceil(r * 2 * s + 4);
    const g = c.getContext("2d");
    g.scale(s, s);
    K.sphere(g, r + 0.6, r + 0.6, r, color);
    spriteCache.set(key, c);
  }
  return c;
}
export function dot(ctx, x, y, r, color, alpha = 1) {
  const sp = sprite(color, r);
  const d = r * 2 + 4 / 3;
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.drawImage(sp, x - r - 0.6, y - r - 0.6, d, d);
  if (alpha !== 1) ctx.globalAlpha = 1;
}

/** Small molecules: O2 / CO dumbbells, CO2 triple, HCO3⁻ bead. */
export function molecule(ctx, type, x, y, ang = 0, s = 1, alpha = 1) {
  const c = Math.cos(ang), sn = Math.sin(ang);
  if (type === "o2" || type === "co") {
    const col = type === "o2" ? COL.o2 : COL.co;
    const r = 2.6 * s, d = 2.1 * s;
    if (type === "co") {
      dot(ctx, x - c * d, y - sn * d, r * 0.9, "#9aa4b5", alpha);
      dot(ctx, x + c * d, y + sn * d, r, col, alpha);
    } else {
      dot(ctx, x - c * d, y - sn * d, r, col, alpha);
      dot(ctx, x + c * d, y + sn * d, r, col, alpha);
    }
  } else if (type === "co2") {
    const r = 2.3 * s, d = 3.6 * s;
    dot(ctx, x - c * d, y - sn * d, r, COL.co2, alpha);
    dot(ctx, x + c * d, y + sn * d, r, COL.co2, alpha);
    dot(ctx, x, y, r * 0.95, "#8b94a3", alpha);
  } else if (type === "hco3") {
    dot(ctx, x, y, 2.8 * s, COL.hco3, alpha);
  }
}

/** Biconcave red blood cell. ang = flow direction; tilt squashes along the flow (0.4–1). */
export function drawRBC(ctx, x, y, r, ang, color, tilt = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.scale(tilt, 1);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  g.addColorStop(0, K.shade(color, 0.42));
  g.addColorStop(0.55, color);
  g.addColorStop(1, K.shade(color, -0.55));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  // central pale dimple of the biconcave disc
  const g2 = ctx.createRadialGradient(r * 0.08, r * 0.1, 0, 0, 0, r * 0.58);
  g2.addColorStop(0, "rgba(0,0,0,0.34)");
  g2.addColorStop(0.7, "rgba(0,0,0,0.12)");
  g2.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g2;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, TAU); ctx.fill();
  // glossy rim highlight
  ctx.strokeStyle = "rgba(255,230,235,0.35)";
  ctx.lineWidth = Math.max(1, r * 0.14);
  ctx.beginPath(); ctx.arc(0, 0, r * 0.8, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
  ctx.restore();
}

export function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.95);
  ctx.bezierCurveTo(x - s * 1.25, y + s * 0.15, x - s * 1.05, y - s * 1.0, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 1.05, y - s * 1.0, x + s * 1.25, y + s * 0.15, x, y + s * 0.95);
  ctx.closePath();
}

export function drawHeart(ctx, x, y, s, beat) {
  const k = 1 + 0.07 * beat;
  K.glow(ctx, x, y, s * 2.1, "#ff3b5c", 0.18 + 0.12 * beat);
  ctx.save();
  ctx.translate(x, y); ctx.scale(k, k); ctx.translate(-x, -y);
  heartPath(ctx, x, y, s);
  const g = ctx.createRadialGradient(x - s * 0.4, y - s * 0.5, s * 0.1, x, y, s * 1.3);
  g.addColorStop(0, "rgba(255,120,140,0.55)");
  g.addColorStop(0.6, "rgba(170,30,60,0.45)");
  g.addColorStop(1, "rgba(80,10,30,0.55)");
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = "rgba(255,150,170,0.7)"; ctx.lineWidth = 2; ctx.stroke();
  // septum dividing the two pumps
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "rgba(255,200,210,0.45)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x - s * 0.95, y + s * 0.02); ctx.quadraticCurveTo(x, y + s * 0.12, x + s * 0.95, y + s * 0.02); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/** Word-wrap text into lines that fit maxW (uses current ctx.font). */
export function wrap(ctx, text, maxW) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Haemoglobin tetramer. sites: [{type:'o2'|'co'|null, f:0..1}] ×4 (α1, β1, β2, α2).
 * r: 0 = T (tense) … 1 = R (relaxed).
 */
export function drawTetramer(ctx, cx, cy, size, sites, r, t) {
  const sr = size * 0.25;
  const d = size * K.lerp(0.22, 0.27, r);
  const rot = K.lerp(0, 0.26, r); // ≈15° rotation of one αβ dimer relative to the other
  const pos = [
    [-1, -1, "α", -rot / 2], [1, -1, "β", -rot / 2],
    [-1, 1, "β", rot / 2], [1, 1, "α", rot / 2],
  ];
  const tCol = K.mix(COL.tState, COL.rState, r);
  // salt bridges (T state constraints)
  const pts = pos.map(([sx, sy, , a]) => {
    const x0 = sx * d, y0 = sy * d;
    return [cx + x0 * Math.cos(a) - y0 * Math.sin(a), cy + x0 * Math.sin(a) + y0 * Math.cos(a)];
  });
  if (r < 0.95) {
    ctx.save();
    ctx.strokeStyle = `rgba(251,191,36,${0.75 * (1 - r)})`;
    ctx.lineWidth = 1.6; ctx.setLineDash([3, 3]);
    for (const [a, b] of [[0, 3], [1, 2], [0, 2], [1, 3]]) {
      ctx.beginPath(); ctx.moveTo(pts[a][0], pts[a][1]); ctx.lineTo(pts[b][0], pts[b][1]); ctx.stroke();
    }
    ctx.restore();
  }
  pos.forEach(([sx, sy, kind, a], i) => {
    const [x, y] = pts[i];
    const col = kind === "α" ? K.mix(tCol, "#ffffff", 0.12) : K.mix(tCol, "#1a1040", 0.3);
    ctx.save();
    ctx.translate(x, y); ctx.rotate(a + (1 - r) * 0.06 * Math.sin(t * 3 + i));
    K.blob(ctx, 0, 0, sr * 2, sr * 2, col, K.lerp(sr * 0.35, sr, r));
    ctx.restore();
    // haem pocket (flat porphyrin plate with Fe2+)
    const hx = x + sx * sr * 0.28, hy = y + sy * sr * 0.28;
    ctx.save();
    ctx.translate(hx, hy); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#5a0d1d"; ctx.strokeStyle = "rgba(255,140,150,0.6)"; ctx.lineWidth = 1;
    ctx.fillRect(-sr * 0.36, -sr * 0.36, sr * 0.72, sr * 0.72);
    ctx.strokeRect(-sr * 0.36, -sr * 0.36, sr * 0.72, sr * 0.72);
    ctx.restore();
    dot(ctx, hx, hy, Math.max(1.6, sr * 0.14), "#f59e0b");
    const s = sites[i];
    if (s && s.type && s.f > 0.02) {
      const sc = (sr / 13) * (0.4 + 0.6 * s.f);
      const off = (1 - s.f) * sr * 1.6; // flies in from outside
      molecule(ctx, s.type, hx + sx * off, hy + sy * off - sr * 0.12, -0.6, Math.max(0.6, sc), s.f);
    }
  });
}
