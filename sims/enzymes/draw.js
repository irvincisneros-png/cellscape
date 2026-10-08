// Enzyme Lab — drawing: pre-rendered molecule sprites + procedural enzyme bodies.
import * as K from "../../assets/js/kit.js";
import { G } from "./model.js";

export const LOOK = {
  amylase: { enzyme: "#a78bfa", sub: "Starch (chain)", prod: "Maltose", subCol: "#fde68a", prodCol: "#fcd34d" },
  pepsin: { enzyme: "#60a5fa", sub: "Protein (chain)", prod: "Peptides", subCol: "#fb923c", prodCol: "#f472b6" },
  catalase: { enzyme: "#4fd1c5", sub: "Hydrogen peroxide", prod: "Water + O₂ bubbles", subCol: "#f87171", prodCol: "#e8f1ff" },
};
export const CI_COL = "#e11d48";
export const NI_COL = "#a3e635";
export const DEAD_COL = "#7b8794";
export const SITE_COL = "#bae6fd";

// ---------- sprites ----------
function makeSprite(wW, hW, px, draw) {
  const c = document.createElement("canvas");
  c.width = Math.max(2, Math.ceil(wW * px));
  c.height = Math.max(2, Math.ceil(hW * px));
  const g = c.getContext("2d");
  g.setTransform(px, 0, 0, px, c.width / 2, c.height / 2);
  draw(g);
  return { c, w: wW, h: hW };
}

function hex(g, x, y, r, col) {
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.closePath();
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1);
  gr.addColorStop(0, K.shade(col, 0.6)); gr.addColorStop(0.6, col); gr.addColorStop(1, K.shade(col, -0.4));
  g.fillStyle = gr; g.fill();
  g.strokeStyle = K.shade(col, -0.45); g.lineWidth = 0.7; g.stroke();
}

function bond(g, x0, x1, col, w = 1.6) {
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = "round";
  g.beginPath(); g.moveTo(x0, 0); g.lineTo(x1, 0); g.stroke();
}

const XS = [-10.5, -3.5, 3.5, 10.5];
const PEP = ["#fb923c", "#f472b6", "#fbbf24", "#fca5a5"];

export function buildSprites(key, px) {
  const sp = {};
  if (key === "amylase") {
    sp.S = makeSprite(32, 14, px, (g) => {
      bond(g, -10.5, 10.5, "rgba(253,230,138,0.7)");
      XS.forEach((x) => hex(g, x, 0, 3.9, "#fde68a"));
      K.glow(g, 0, 0, 3, "#ffffff", 0.7); // the glycosidic bond that gets broken
    });
    sp.P = sp.P2 = makeSprite(18, 12, px, (g) => {
      bond(g, -3.5, 3.5, "rgba(252,211,77,0.8)");
      hex(g, -3.5, 0, 3.9, "#fcd34d"); hex(g, 3.5, 0, 3.9, "#fcd34d");
    });
  } else if (key === "pepsin") {
    sp.S = makeSprite(32, 14, px, (g) => {
      bond(g, -10.5, 10.5, "rgba(255,220,200,0.6)", 2);
      XS.forEach((x, i) => K.sphere(g, x, 0, 4.2, PEP[i]));
    });
    sp.P = makeSprite(18, 12, px, (g) => { bond(g, -3.5, 3.5, "rgba(255,220,200,0.6)", 2); K.sphere(g, -3.5, 0, 4.2, PEP[0]); K.sphere(g, 3.5, 0, 4.2, PEP[1]); });
    sp.P2 = makeSprite(18, 12, px, (g) => { bond(g, -3.5, 3.5, "rgba(255,220,200,0.6)", 2); K.sphere(g, -3.5, 0, 4.2, PEP[2]); K.sphere(g, 3.5, 0, 4.2, PEP[3]); });
  } else {
    sp.S = makeSprite(32, 16, px, (g) => {
      K.sphere(g, -9.5, -4, 2.9, "#e8f1ff"); K.sphere(g, 9.5, 4, 2.9, "#e8f1ff");
      K.sphere(g, -3.6, 0, 5, "#f87171"); K.sphere(g, 3.6, 0, 5, "#f87171");
    });
    sp.P = sp.P2 = makeSprite(20, 16, px, (g) => {
      K.sphere(g, -5.5, 3.5, 2.9, "#e8f1ff"); K.sphere(g, 5.5, 3.5, 2.9, "#e8f1ff");
      K.sphere(g, 0, 0, 5, "#f87171");
    });
  }
  sp.CI = makeSprite(30, 14, px, (g) => {
    K.roundRect(g, -12.5, -5, 25, 10, 5);
    const gr = g.createLinearGradient(0, -5, 0, 5);
    gr.addColorStop(0, K.shade(CI_COL, 0.5)); gr.addColorStop(0.5, CI_COL); gr.addColorStop(1, K.shade(CI_COL, -0.5));
    g.fillStyle = gr; g.fill();
    g.strokeStyle = "rgba(40,0,10,0.55)"; g.lineWidth = 1.6;
    for (const x of [-6, 0, 6]) { g.beginPath(); g.moveTo(x, -4.6); g.lineTo(x, 4.6); g.stroke(); }
    g.fillStyle = "rgba(255,255,255,0.35)"; K.roundRect(g, -10, -4, 20, 2.4, 1.2); g.fill();
  });
  sp.NI = makeSprite(20, 16, px, (g) => {
    g.beginPath(); g.moveTo(-8, 0); g.lineTo(0, -6); g.lineTo(8, 0); g.lineTo(0, 6); g.closePath();
    const gr = g.createRadialGradient(-2, -2, 0.5, 0, 0, 9);
    gr.addColorStop(0, K.shade(NI_COL, 0.6)); gr.addColorStop(0.6, NI_COL); gr.addColorStop(1, K.shade(NI_COL, -0.5));
    g.fillStyle = gr; g.fill();
    g.strokeStyle = K.shade(NI_COL, -0.5); g.lineWidth = 0.8; g.stroke();
  });
  sp.dust = makeSprite(16, 16, px, (g) => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 8);
    gr.addColorStop(0, "rgba(160,220,255,0.9)"); gr.addColorStop(1, "rgba(160,220,255,0)");
    g.fillStyle = gr; g.fillRect(-8, -8, 16, 16);
  });
  return sp;
}

export function drawSprite(ctx, s, x, y, a, alpha = 1) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(a);
  if (alpha < 1) ctx.globalAlpha = alpha;
  ctx.drawImage(s.c, -s.w / 2, -s.h / 2, s.w, s.h);
  ctx.restore();
}

export function drawLigand(ctx, sp, l, ox = 0, oy = 0) {
  const s = l.kind === "S" ? sp.S : l.kind === "CI" ? sp.CI : sp.NI;
  drawSprite(ctx, s, l.x + ox, l.y + oy, l.a, l.alpha);
}

export function drawBubble(ctx, q) {
  const a = Math.min(1, q.life * 3);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = "rgba(190,230,255,0.12)";
  ctx.strokeStyle = "rgba(225,245,255,0.75)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, K.TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.beginPath(); ctx.arc(q.x - q.r * 0.35, q.y - q.r * 0.4, q.r * 0.22, 0, K.TAU); ctx.fill();
  ctx.restore();
}

// ---------- enzymes ----------
const N = 72;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** Build the enzyme outline path at (cx, cy). dd = active-site distortion 0..1, skew = ±1. */
function enzymePath(ctx, e, cx, cy, dd, skew) {
  const R = G.R, f = e.fold, u = 1 - f, close = e.close, t = e.wob;
  const aN = G.notchA * (1 - 0.3 * dd);
  const aL = aN * (1 - 0.32 * close); // lips creep over the groove edges (induced fit)
  const c0 = skew * dd * 0.35;
  const depth = 14 * f * (1 - 0.45 * dd);
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const rel = -Math.PI + (i / N) * K.TAU;
    let r = R * (1 + 0.05 * Math.sin(3 * rel + e.s1) + 0.035 * Math.sin(5 * rel + e.s2) + 0.015 * Math.sin(7 * rel + e.s3 + t * 0.6));
    const x = (rel - c0) / aN;
    if (Math.abs(x) < 1) r -= depth * (1 - x ** 4);
    const xl = Math.abs(rel - c0) / aL;
    if (xl >= 0.92 && xl < 2.3) r += Math.sin((Math.PI * (xl - 0.92)) / 1.38) * (1.5 + 8 * close) * f;
    const xb = wrap(rel - Math.PI) / 0.32;
    if (Math.abs(xb) < 1) r -= 8 * f * (1 - Math.abs(xb)) * (e.allo ? 0.55 : 1);
    if (u > 0) r = r * (1 + 0.12 * u) + u * R * (0.2 * Math.sin(9 * rel + e.s1 * 3 + t * 0.8) + 0.14 * Math.sin(4 * rel + e.s2 * 2));
    const th = e.a + rel;
    const px = cx + Math.cos(th) * r, py = cy + Math.sin(th) * r;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}

/**
 * Draw one enzyme with its bound ligands. o = { dd, skew, sp, selected, ox, oy, glowOn }
 * (ox, oy) shifts the whole thing (used by the zoom lens).
 */
export function drawEnzyme(ctx, e, base, o) {
  const R = G.R, f = e.fold, u = 1 - f;
  const cx = e.x + (o.ox || 0), cy = e.y + (o.oy || 0);
  const dd = e.allo ? Math.max(o.dd, 0.75) : o.dd;
  const col = K.mix(base, DEAD_COL, Math.min(1, u * 0.9 + (e.state !== "ok" ? 0.15 : 0)));
  if (o.glowOn) K.glow(ctx, cx, cy, R * 1.9, col, 0.16 * (0.4 + 0.6 * f));

  // loose strands of unfolded chain
  if (u > 0.12) {
    ctx.save();
    ctx.strokeStyle = K.withAlpha(col, 0.85); ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (let k = 0; k < 3; k++) {
      const a0 = e.a + 1.6 + k * 2.1 + e.s1;
      ctx.beginPath();
      let x = cx + Math.cos(a0) * R * 0.9, y = cy + Math.sin(a0) * R * 0.9;
      ctx.moveTo(x, y);
      const len = u * R * (1 + 0.4 * k);
      for (let j = 1; j <= 8; j++) {
        const d = (j / 8) * len, wig = Math.sin(j * 1.7 + e.wob * 1.5 + k) * 5 * u;
        x = cx + Math.cos(a0) * (R * 0.9 + d) + Math.cos(a0 + Math.PI / 2) * wig;
        y = cy + Math.sin(a0) * (R * 0.9 + d) + Math.sin(a0 + Math.PI / 2) * wig;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  enzymePath(ctx, e, cx, cy, dd, o.skew);
  const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, 2, cx, cy, R * 1.35);
  g.addColorStop(0, K.shade(col, 0.5)); g.addColorStop(0.5, col); g.addColorStop(1, K.shade(col, -0.6));
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = K.withAlpha(col, 0.55); ctx.lineWidth = 1; ctx.stroke();

  // secondary-structure ribbons inside the body
  ctx.save();
  ctx.clip();
  ctx.translate(cx, cy); ctx.rotate(e.a + e.s2);
  ctx.strokeStyle = K.withAlpha("#ffffff", 0.13 + 0.05 * f); ctx.lineWidth = 2.6; ctx.lineCap = "round";
  for (let k = -1; k <= 1; k++) {
    ctx.beginPath();
    for (let j = 0; j <= 14; j++) {
      const xx = -R * 0.7 + (j / 14) * R * 1.4;
      const yy = k * R * 0.32 + Math.sin(j * 1.25 + k + e.s3) * (3 + u * 6) + u * Math.sin(j * 3.1 + e.wob) * 4;
      j ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
    }
    ctx.stroke();
  }
  ctx.restore();

  // active site (highlight the groove floor) and allosteric site marker
  const ca = Math.cos(e.a), sa = Math.sin(e.a);
  if (f > 0.3) {
    const aN = G.notchA * (1 - 0.3 * dd), c0 = o.skew * dd * 0.35, rr = R - 14 * f * (1 - 0.45 * dd) + 1.5;
    ctx.save();
    ctx.strokeStyle = K.withAlpha(e.allo ? "#f59e0b" : SITE_COL, (e.site ? 0.35 : 0.8) * f);
    ctx.lineWidth = 2.4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(cx, cy, rr, e.a + c0 - aN * 0.75, e.a + c0 + aN * 0.75); ctx.stroke();
    ctx.restore();
    if (!e.site && o.glowOn) K.glow(ctx, cx + ca * (R - 6), cy + sa * (R - 6), 15, SITE_COL, 0.3 * f);
    if (!e.allo) {
      ctx.fillStyle = K.withAlpha(NI_COL, 0.35 * f);
      ctx.beginPath(); ctx.arc(cx - ca * (R - 4), cy - sa * (R - 4), 2.2, 0, K.TAU); ctx.fill();
    }
  }
  if (e.flash > 0) K.glow(ctx, cx + ca * (R - 2), cy + sa * (R - 2), 26 * (0.5 + e.flash), "#fde68a", 0.55 * e.flash);
  if (e.reject > 0) {
    ctx.strokeStyle = K.withAlpha("#f87171", 0.8 * e.reject); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R + 8, 0, K.TAU); ctx.stroke();
  }
  if (o.selected) {
    ctx.save();
    ctx.setLineDash([4, 4]); ctx.lineDashOffset = -e.wob * 10;
    ctx.strokeStyle = "rgba(232,241,255,0.75)"; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(cx, cy, R + 11, 0, K.TAU); ctx.stroke();
    ctx.restore();
  }
  // bound ligands
  if (e.site) drawLigand(ctx, o.sp, e.site, o.ox || 0, o.oy || 0);
  if (e.allo) drawLigand(ctx, o.sp, e.allo, o.ox || 0, o.oy || 0);
}
