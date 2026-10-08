// Drawing helpers for "Cellular Respiration: The ATP Factory".
// Sprites (pre-rendered glowing molecules), membrane bitmap, ETC complexes, ATP synthase, mitochondrion map.
import * as K from "../../assets/js/kit.js";

const { C, TAU } = K;

export const COL = {
  H: C.pink, e: "#fff3b0", nadh: C.blue, nad: "#9fb3cf", fadh: C.green,
  o2: C.red, h2o: "#7dd3fc", atp: C.amber, adp: "#b7791f", pi: "#fde68a",
  q: "#d9f99d", cytc: C.orange, dnp: "#facc15",
  c1: "#4f7cff", c2: "#34d399", c3: "#a78bfa", c4: "#2dd4bf",
  cring: "#60c5f6", stator: "#64748b", gamma: "#fb7185", alpha: "#dbe4f0", beta: "#8b93f8",
};

/** Point (lx, ly) in a frame rotated by a around (cx, cy) — same maths as ctx.rotate. */
export function rotP(cx, cy, a, lx, ly) {
  const c = Math.cos(a), s = Math.sin(a);
  return [cx + lx * c - ly * s, cy + lx * s + ly * c];
}

// ---------- sprites ----------
function mk(dpr, w, h, draw) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w * dpr));
  c.height = Math.max(1, Math.ceil(h * dpr));
  const g = c.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw(g, w / 2, h / 2);
  return { c, w, h };
}

export function buildSprites(dpr, s) {
  const r = Math.max(2.6, 4 * s); // H+ radius
  const R = Math.max(3.4, 5.6 * s); // molecule unit
  const S = { r, R };
  S.H = mk(dpr, r * 5, r * 5, (g, x, y) => { K.glow(g, x, y, r * 2.4, COL.H, 0.4); K.sphere(g, x, y, r, COL.H); });
  S.Hhot = mk(dpr, r * 6, r * 6, (g, x, y) => { K.glow(g, x, y, r * 3, C.orange, 0.6); K.sphere(g, x, y, r, COL.H); });
  S.e = mk(dpr, r * 6, r * 6, (g, x, y) => { K.glow(g, x, y, r * 3, COL.e, 0.8); K.sphere(g, x, y, r * 0.7, "#fffbe8"); });
  S.atp = mk(dpr, R * 8, R * 4.4, (g, x, y) => {
    K.glow(g, x, y, R * 3.8, COL.atp, 0.5);
    const ax = x - R * 1.4;
    for (let i = 2; i >= 0; i--) K.sphere(g, ax + R * 1.25 + i * R * 0.95, y, R * 0.5, COL.pi);
    K.sphere(g, ax, y, R, COL.atp);
  });
  S.adp = mk(dpr, R * 6, R * 3, (g, x, y) => {
    const ax = x - R * 0.9;
    for (let i = 1; i >= 0; i--) K.sphere(g, ax + R * 1.25 + i * R * 0.95, y, R * 0.5, COL.pi);
    K.sphere(g, ax, y, R * 0.95, COL.adp);
  });
  S.pi = mk(dpr, R * 2, R * 2, (g, x, y) => K.sphere(g, x, y, R * 0.55, COL.pi));
  S.h2o = mk(dpr, R * 3.4, R * 3.4, (g, x, y) => {
    K.glow(g, x, y, R * 1.6, COL.h2o, 0.25);
    K.sphere(g, x - R * 0.72, y + R * 0.5, R * 0.45, "#f1f5f9");
    K.sphere(g, x + R * 0.72, y + R * 0.5, R * 0.45, "#f1f5f9");
    K.sphere(g, x, y, R * 0.8, COL.h2o);
  });
  S.o2 = mk(dpr, R * 3.4, R * 2.4, (g, x, y) => {
    K.sphere(g, x - R * 0.45, y, R * 0.7, COL.o2);
    K.sphere(g, x + R * 0.45, y, R * 0.7, COL.o2);
  });
  S.nadh = mk(dpr, R * 4, R * 3, (g, x, y) => {
    K.glow(g, x, y, R * 1.8, COL.nadh, 0.25);
    K.sphere(g, x - R * 0.55, y, R * 0.72, COL.nadh);
    K.sphere(g, x + R * 0.55, y, R * 0.72, COL.nadh);
  });
  S.nad = mk(dpr, R * 4, R * 3, (g, x, y) => {
    K.sphere(g, x - R * 0.55, y, R * 0.7, COL.nad);
    K.sphere(g, x + R * 0.55, y, R * 0.7, COL.nad);
  });
  S.q = mk(dpr, R * 2.4, R * 2.4, (g, x, y) => K.sphere(g, x, y, R * 0.72, COL.q));
  S.qred = mk(dpr, R * 4, R * 4, (g, x, y) => { K.glow(g, x, y, R * 1.9, COL.e, 0.55); K.sphere(g, x, y, R * 0.72, COL.q); });
  S.cytc = mk(dpr, R * 3.4, R * 3.4, (g, x, y) => { K.glow(g, x, y, R * 1.5, COL.cytc, 0.25); K.sphere(g, x, y, R * 0.85, COL.cytc); });
  S.dnp = mk(dpr, R * 2, R * 2, (g, x, y) => K.sphere(g, x, y, R * 0.5, COL.dnp));
  return S;
}

export function spr(ctx, sp, x, y, a = 1) {
  if (a <= 0.01) return;
  if (a < 1) ctx.globalAlpha = a;
  ctx.drawImage(sp.c, x - sp.w / 2, y - sp.h / 2, sp.w, sp.h);
  if (a < 1) ctx.globalAlpha = 1;
}

// ---------- membrane (pre-rendered once per resize) ----------
export function buildMembrane(dpr, L) {
  const pad = 6, hh = L.th + pad * 2;
  const m = mk(dpr, L.w, hh, (g) => {
    const y0 = pad, y1 = pad + L.th;
    const core = g.createLinearGradient(0, y0, 0, y1);
    core.addColorStop(0, "rgba(91,74,58,0)");
    core.addColorStop(0.5, "rgba(125,98,72,0.35)");
    core.addColorStop(1, "rgba(91,74,58,0)");
    g.fillStyle = core;
    g.fillRect(0, y0, L.w, L.th);
    K.bilayer(g, 0, L.w, y0 + L.headR, y1 - L.headR, { t: 0, headR: L.headR, skip: L.skip });
  });
  m.y = L.top - pad;
  return m;
}

function numeral(ctx, text, x, y, s) {
  ctx.save();
  ctx.font = `700 ${Math.round(10 + 5 * s)}px "Space Grotesk", Inter, sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(text, x, y + 1);
  ctx.restore();
}

// ---------- electron transport chain ----------
export function drawETC(ctx, L, d) {
  const { s, x1, x2, x3, x4, top, bot, mid, th } = L;
  const red = d.reduced;

  // Complex I: membrane arm + peripheral arm reaching into the matrix
  ctx.save();
  ctx.translate(L.armBase[0], L.armBase[1]);
  ctx.rotate(-0.25);
  K.blob(ctx, 0, 32 * s, 32 * s, 70 * s, COL.c1, 14 * s);
  ctx.restore();
  K.blob(ctx, x1, mid, L.hw1 * 2, th + 14 * s, COL.c1, 16 * s);
  for (let i = 0; i < 5; i++) {
    const [px, py] = rotP(L.armBase[0], L.armBase[1], -0.25, 0, 56 * s - i * 12 * s);
    K.sphere(ctx, px, py, 2.4 * s + 0.6, C.orange);
  }
  numeral(ctx, "I", x1, mid, s);

  // Complex II (no pumping)
  K.blob(ctx, x2, mid + 4 * s, L.hw2 * 2, th * 0.86, COL.c2, 10 * s);
  K.sphere(ctx, x2, bot + 16 * s, 17 * s, COL.c2);
  numeral(ctx, "II", x2, mid + 2 * s, s * 0.85);

  // Complex III (dimer)
  K.sphere(ctx, x3 - 12 * s, top - 12 * s, 9 * s + 1, COL.c3);
  K.sphere(ctx, x3 + 12 * s, top - 12 * s, 9 * s + 1, COL.c3);
  K.blob(ctx, x3 - 13 * s, mid, 26 * s, th + 30 * s, COL.c3, 11 * s);
  K.blob(ctx, x3 + 13 * s, mid, 26 * s, th + 30 * s, COL.c3, 11 * s);
  numeral(ctx, "III", x3, mid, s);

  // Complex IV
  K.sphere(ctx, x4 - 9 * s, top - 9 * s, 10 * s + 1, COL.c4);
  K.sphere(ctx, x4 + 8 * s, bot + 9 * s, 11 * s + 1, COL.c4);
  K.blob(ctx, x4, mid, L.hw4 * 2, th + 18 * s, COL.c4, 14 * s);
  numeral(ctx, "IV", x4, mid, s);

  // activity flashes and "backed-up" (reduced) glow
  const f = d.flash;
  if (f.I > 0.01) K.glow(ctx, x1, mid, 52 * s, COL.e, 0.35 * f.I);
  if (f.II > 0.01) K.glow(ctx, x2, bot + 10 * s, 40 * s, COL.fadh, 0.45 * f.II);
  if (f.III > 0.01) K.glow(ctx, x3, mid, 50 * s, COL.e, 0.3 * f.III);
  if (f.IV > 0.01) K.glow(ctx, x4, mid, 46 * s, COL.e, 0.35 * f.IV);
  if (red > 0.05) {
    const pulse = 0.75 + 0.25 * Math.sin(d.t * 5);
    K.glow(ctx, x1, mid, 46 * s, COL.e, 0.22 * red * pulse);
    K.glow(ctx, x3, mid, 46 * s, COL.e, 0.22 * red * pulse);
    K.glow(ctx, x4, top - 4 * s, 40 * s, COL.e, 0.25 * red * pulse);
  }

  if (d.cyanide) {
    K.sphere(ctx, x4 + 7 * s, mid + 3 * s, 6 * s + 1.5, "#991b1b", { glow: 10 });
    K.label(ctx, "CN⁻", x4 + 7 * s, bot + 32 * s + 6, { color: C.red, size: 11 });
  }
}

// ---------- ATP synthase ----------
const STATE_COL = [COL.beta, K.mix(COL.beta, "#2e1065", 0.4), K.mix(COL.beta, "#ffffff", 0.3)]; // L, T, O

export function betaState(j, kA) { return (((j + kA) % 3) + 3) % 3; } // 0 = L(oose), 1 = T(ight), 2 = O(pen)

export function drawSynthase(ctx, L, th, kA, d) {
  const { s, x5, bot, mid, Rc, F1r, f1y, ax } = L;

  // peripheral stalk (stator) — holds α3β3 still
  ctx.save();
  ctx.strokeStyle = COL.stator; ctx.lineCap = "round"; ctx.lineWidth = 5 * s + 1;
  ctx.beginPath();
  ctx.moveTo(ax + 2 * s, bot - 6 * s);
  ctx.quadraticCurveTo(x5 + F1r + 16 * s, f1y - F1r * 0.2, x5 + F1r * 0.5, f1y + F1r + 2 * s);
  ctx.stroke();
  ctx.restore();

  // a-subunit (stator, contains the two half-channels)
  K.blob(ctx, ax, mid, 15 * s + 2, L.th * 0.96, COL.stator, 6 * s);

  // c-ring (rotor) — 9 subunits seen from the side
  const sub = [];
  for (let i = 0; i < 9; i++) {
    const p = th + (i * TAU) / 9;
    sub.push({ x: x5 + Rc * Math.sin(p), z: Math.cos(p), i });
  }
  sub.sort((a, b) => a.z - b.z);
  const cw = 9 * s + 2, chh = L.th * 0.8;
  const drawSub = (c) => {
    const col = K.mix("#123049", COL.cring, 0.3 + 0.7 * (c.z + 1) / 2);
    K.blob(ctx, c.x, mid, cw * (0.7 + 0.3 * Math.abs(c.z)), chh, col, cw * 0.45);
    if (c.i === 0 && c.z > -0.3) K.sphere(ctx, c.x, mid, 2.4 * s + 1.2, C.amber);
  };
  for (const c of sub) if (c.z < 0) drawSub(c);

  // central stalk γ (+ ε) — rotates with the c-ring
  K.blob(ctx, x5, (mid + f1y) / 2 + 4 * s, 9 * s + 2, f1y - mid, COL.gamma, 4 * s);
  const cz = Math.cos(th);
  K.sphere(ctx, x5 + Math.sin(th) * 5 * s, bot + 10 * s, 4.5 * s + 1, K.mix("#5b1e2b", "#fecdd3", 0.35 + 0.5 * (cz + 1) / 2));

  for (const c of sub) if (c.z >= 0) drawSub(c);

  // F1 head: α3β3 hexamer (stationary). β states cycle Loose → Tight → Open as γ turns.
  for (const lb of L.lobesSorted) {
    const depth = 0.55 + 0.45 * (lb.z + 1) / 2;
    let col, r = F1r * 0.5 * (0.9 + 0.1 * lb.z), x = lb.x, y = lb.y, state = -1;
    if (lb.alpha) col = COL.alpha;
    else {
      state = betaState(lb.j, kA);
      col = STATE_COL[state];
      if (state === 2) { r *= 0.93; x += lb.sx * 3 * s; }
    }
    K.sphere(ctx, x, y, r, K.mix("#0b1626", col, depth));
    if (state >= 0 && lb.z > -0.6) {
      if (state === 0) {
        K.sphere(ctx, x - r * 0.25, y + r * 0.15, r * 0.2, COL.adp);
        K.sphere(ctx, x + r * 0.22, y + r * 0.2, r * 0.15, COL.pi);
      } else if (state === 1) {
        K.glow(ctx, x, y + r * 0.1, r * 0.75, COL.atp, 0.55);
        K.sphere(ctx, x, y + r * 0.1, r * 0.22, COL.atp);
      }
      if (d.showStates) {
        ctx.save();
        ctx.font = `700 ${Math.round(8 + 2 * s)}px Inter, sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillText("LTO"[state], x, y - r * 0.45);
        ctx.restore();
      }
    }
  }
  K.sphere(ctx, x5 + F1r * 0.45, f1y + F1r * 0.98, 5 * s + 1, COL.stator); // δ

  if (d.olig) {
    K.sphere(ctx, ax - 8 * s, mid - 5 * s, 5 * s + 1.5, "#ef4444", { glow: 8 });
    K.sphere(ctx, ax - 8 * s, mid + 7 * s, 4 * s + 1.2, "#b91c1c");
  }
}

// ---------- mitochondrion map ----------
export function drawMito(ctx, x, y, w, h, t, { marker = true, labels = false, compact = false } = {}) {
  const r = h / 2, lw = Math.max(1.2, h * 0.035), d = h * 0.11;
  const IMS = "#3b1f3f", MAT = "#123f52";
  ctx.save();
  K.glow(ctx, x + w / 2, y + h / 2, w * 0.6, C.teal, 0.08);
  K.roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = IMS; ctx.fill();
  ctx.lineWidth = lw; ctx.strokeStyle = "#d8c7e6"; ctx.stroke();
  K.roundRect(ctx, x + d, y + d, w - 2 * d, h - 2 * d, r - d);
  const mg = ctx.createRadialGradient(x + w * 0.4, y + h * 0.35, 0, x + w / 2, y + h / 2, w * 0.6);
  mg.addColorStop(0, "#1d5a70"); mg.addColorStop(1, MAT);
  ctx.fillStyle = mg; ctx.fill();
  ctx.strokeStyle = C.lipidHead; ctx.stroke();

  const n = Math.max(3, Math.round(w / (h * 0.42)));
  const cw = h * 0.085;
  let mk = null, c1 = null;
  ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const cx = x + r * 0.9 + ((w - r * 1.8) * (i + 0.5)) / n;
    const fromTop = i % 2 === 0;
    const y0 = fromTop ? y + d : y + h - d;
    const len = h * (0.5 + 0.07 * Math.sin(i * 2.3));
    const y1 = fromTop ? y0 + len : y0 - len;
    const bend = ((i % 3) - 1) * h * 0.07;
    const path = () => {
      ctx.beginPath(); ctx.moveTo(cx, y0);
      ctx.quadraticCurveTo(cx + bend, (y0 + y1) / 2, cx + bend * 0.5, y1);
    };
    path(); ctx.strokeStyle = C.lipidHead; ctx.lineWidth = cw; ctx.stroke();
    path(); ctx.strokeStyle = IMS; ctx.lineWidth = Math.max(0.6, cw - 2 * lw); ctx.stroke();
    const my = (y0 + y1) / 2;
    if (i === 1) c1 = { x: cx + bend * 0.6, y: my };
    if (i === n - 2) {
      const sz = Math.max(8, h * 0.2);
      mk = { x: cx + bend * 0.6 - sz / 2, y: my - sz / 2, w: sz, h: sz, cx: cx + bend * 0.6, cy: my };
    }
  }
  if (marker && mk) {
    ctx.strokeStyle = K.withAlpha(C.amber, 0.6 + 0.4 * Math.sin(t * 3));
    ctx.lineWidth = 1.8;
    ctx.strokeRect(mk.x, mk.y, mk.w, mk.h);
  }
  if (labels) {
    const lab = (text, tx, ty, px, py) => {
      ctx.strokeStyle = "rgba(232,241,255,0.45)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(px, py); ctx.stroke();
      K.label(ctx, text, tx, ty, { size: compact ? 11 : 12 });
    };
    lab("Outer membrane", x + w * 0.2, y - 22, x + w * 0.2, y + 1);
    lab(compact ? "Intermembrane space" : "Intermembrane space (H⁺ pumped here)", x + w * 0.66, y - 22, x + w * 0.66, y + d * 0.5);
    const gapX = x + r * 0.9 + (w - r * 1.8) * (1 / n);
    K.label(ctx, "Matrix", gapX, y + h * 0.5, { size: compact ? 11 : 12, color: C.teal });
    if (c1) lab(compact ? "Cristae" : "Cristae (folds of inner membrane)", x + w * 0.26, y + h + 24, c1.x, c1.y);
    if (mk) lab(compact ? "You are here" : "You are here: ETC + ATP synthase", Math.min(mk.cx, x + w * 0.78), y + h + 50, mk.cx, mk.y + mk.h);
  }
  ctx.restore();
  return mk;
}
