// Oxygen Transport: Haemoglobin & Red Blood Cells — CellScape
import * as K from "../../assets/js/kit.js";
import * as M from "./model.js";
import { COL, rbcColour, dot, molecule, drawRBC, drawHeart, wrap, drawTetramer } from "./draw.js";

const stageEl = K.$("#stage");
const panel = K.$("#panel");
const overlay = K.$("#overlay");
const canvas = K.$("#canvas");
let needLayout = true;
const stage = K.createStage(canvas, () => { needLayout = true; });
const { ctx } = stage;
const toast = K.toaster(stageEl);
const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------------------------------------------------------------- state
const st = { ...M.DEFAULTS };
let C = M.conditions(st);
let L = null;               // layout
let rbcs = [];
let nextId = 1;
let followId = null;
let userFollowed = false;
const flyers = [];          // molecules moving between compartments
let alvO2 = [], alvCO = [], maternal = [];
let beatPhase = 0, breathPhase = 0, simT = 0;
const off = document.createElement("canvas"); // pre-rendered static layer
let offKey = "";

const TAGS_ART = new Set(["pv", "heartL", "artery"]);
const TAGS_VEN = new Set(["vein", "heartR", "pa"]);
const ZONE_NAME = {
  lung: "Lung capillary", pv: "Pulmonary vein", heartL: "Heart (left side)", artery: "Artery → body",
  tissue: "Muscle capillary", vein: "Vein → heart", heartR: "Heart (right side)", pa: "Pulmonary artery",
};

// ---------------------------------------------------------------- layout & path
function roundedPolyPath(corners, radii, tagFor) {
  // Returns raw samples [{x,y,tag}] along a closed rounded polygon (straight runs stay straight).
  const n = corners.length, pts = [];
  const A = [], B = [];
  for (let i = 0; i < n; i++) {
    const p = corners[i], a = corners[(i - 1 + n) % n], b = corners[(i + 1) % n];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const r = Math.min(radii[i], la * 0.45, lb * 0.45);
    A[i] = [p[0] + ((a[0] - p[0]) / la) * r, p[1] + ((a[1] - p[1]) / la) * r];
    B[i] = [p[0] + ((b[0] - p[0]) / lb) * r, p[1] + ((b[1] - p[1]) / lb) * r];
  }
  for (let i = 0; i < n; i++) {
    const p = corners[i], a = A[i], b = B[i];
    const prevSeg = (i - 1 + n) % n;
    for (let k = 0; k < 12; k++) {
      const t = k / 12, u = 1 - t;
      const x = u * u * a[0] + 2 * u * t * p[0] + t * t * b[0];
      const y = u * u * a[1] + 2 * u * t * p[1] + t * t * b[1];
      pts.push({ x, y, tag: tagFor(t < 0.5 ? prevSeg : i, x, y) });
    }
    const nx = A[(i + 1) % n];
    const len = Math.hypot(nx[0] - b[0], nx[1] - b[1]);
    const m = Math.max(1, Math.ceil(len / 3));
    for (let k = 0; k < m; k++) {
      const x = K.lerp(b[0], nx[0], k / m), y = K.lerp(b[1], nx[1], k / m);
      pts.push({ x, y, tag: tagFor(i, x, y) });
    }
  }
  return pts;
}

function computeLayout() {
  const w = stage.w, h = stage.h;
  const top = overlay.offsetTop + overlay.offsetHeight + 10;
  const narrow = w < 640;
  let inset, box;
  if (!narrow) {
    const iw = K.clamp(w * 0.27, 210, 310);
    const ih = Math.max(200, Math.min(h - top - 14, iw * 2));
    inset = { x: w - iw - 12, y: top, w: iw, h: ih, wide: true };
    box = { x0: 10, y0: top + 4, x1: w - iw - 26, y1: h - 14 };
  } else {
    const ih = K.clamp(h * 0.32, 124, 176);
    inset = { x: 8, y: h - ih - 8, w: w - 16, h: ih, wide: false };
    box = { x0: 6, y0: top + 2, x1: w - 6, y1: h - ih - 14 };
  }
  const W = box.x1 - box.x0, H = Math.max(140, box.y1 - box.y0);
  box.y1 = box.y0 + H;
  const rr = K.clamp(Math.min(W, H) * 0.026, 5, 10);
  const capHalf = rr * 1.15, bigHalf = rr * 1.5;
  const alvW = W * 0.22, musW = W * 0.17;
  const xl = box.x0 + alvW + capHalf + 4;
  const xr = box.x1 - musW - capHalf - 4;
  const D = xr - xl;
  const yTop = box.y0 + bigHalf + 4, yBot = box.y1 - bigHalf - 4;
  const yt = box.y0 + H * 0.22, yb = box.y0 + H * 0.78;
  const hx = (xl + xr) / 2, hy = box.y0 + H * 0.5;
  const hs = Math.max(14, Math.min(D * 0.15, H * 0.17));
  const corners = [
    [xl, yBot], [xl, yTop], [hx - hs * 1.7, yTop], [hx - hs * 0.8, hy - hs * 0.32],
    [hx + hs * 0.8, hy - hs * 0.32], [hx + hs * 1.7, yTop], [xr, yTop], [xr, yBot],
    [hx + hs * 1.7, yBot], [hx + hs * 0.8, hy + hs * 0.4], [hx - hs * 0.8, hy + hs * 0.4], [hx - hs * 1.7, yBot],
  ];
  const big = Math.min(H * 0.12, D * 0.12);
  const radii = [big, big, hs * 0.7, hs * 0.45, hs * 0.45, hs * 0.7, big, big, hs * 0.7, hs * 0.45, hs * 0.45, hs * 0.7];
  const segTag = ["lungcol", "pv", "pv", "heartL", "artery", "artery", "tiscol", "vein", "vein", "heartR", "pa", "pa"];
  const tagFor = (seg, x, y) => {
    const t = segTag[seg];
    if (t === "lungcol") return y > yb ? "pa" : y < yt ? "pv" : "lung";
    if (t === "tiscol") return y < yt ? "artery" : y > yb ? "vein" : "tissue";
    return t;
  };
  const raw = roundedPolyPath(corners, radii, tagFor);
  // arc-length resample to uniform spacing
  const cum = [0];
  for (let i = 1; i <= raw.length; i++) {
    const a = raw[i - 1], b = raw[i % raw.length];
    cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const len = cum[raw.length];
  const N = Math.ceil(len / 2);
  const X = new Float32Array(N), Y = new Float32Array(N), A = new Float32Array(N), Wd = new Float32Array(N);
  const T = new Array(N);
  let j = 0;
  for (let i = 0; i < N; i++) {
    const s = (i / N) * len;
    while (cum[j + 1] < s) j++;
    const a = raw[j], b = raw[(j + 1) % raw.length];
    const f = (s - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]);
    X[i] = K.lerp(a.x, b.x, f); Y[i] = K.lerp(a.y, b.y, f); T[i] = a.tag;
  }
  for (let i = 0; i < N; i++) {
    const n1 = (i + 1) % N, n0 = (i - 1 + N) % N;
    A[i] = Math.atan2(Y[n1] - Y[n0], X[n1] - X[n0]);
  }
  const base = T.map((t) => (t === "lung" || t === "tissue" ? capHalf : t.startsWith("heart") ? bigHalf * 1.15 : bigHalf));
  const R = 10;
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (let k = -R; k <= R; k++) s += base[(i + k + N) % N];
    Wd[i] = s / (2 * R + 1);
  }
  // compartments
  const alv = { x0: box.x0 + 4, x1: xl - capHalf - 3, y0: yt - 4, y1: yb + 4 };
  const mus = { x0: xr + capHalf + 3, x1: box.x1, y0: yt - 6, y1: yb + 6 };
  const innerW = Math.min(musW * 0.55, D * 0.12);
  const musIn = { x0: xr - capHalf - 3 - innerW, x1: xr - capHalf - 3, y0: yt + 6, y1: yb - 6 };
  const mitos = [];
  for (let i = 0; i < 12; i++) {
    const R2 = i < 8 ? mus : musIn;
    mitos.push({ x: K.rand(R2.x0 + 6, R2.x1 - 6), y: K.rand(R2.y0 + 10, R2.y1 - 10), a: K.rand(-0.3, 0.3) + Math.PI / 2, ph: K.rand(0, K.TAU) });
  }
  return { w, h, narrow, inset, box, W, H, rr, capHalf, bigHalf, xl, xr, yt, yb, yTop, yBot, hx, hy, hs, X, Y, A, T, Wd, N, len, alv, mus, musIn, mitos };
}

const idxAt = (u) => Math.min(L.N - 1, Math.floor(((u % 1) + 1) % 1 * L.N));

// ---------------------------------------------------------------- static layer
function renderStatic() {
  const { w, h } = L, dpr = stage.dpr;
  off.width = Math.round(w * dpr); off.height = Math.round(h * dpr);
  const o = off.getContext("2d");
  o.setTransform(dpr, 0, 0, dpr, 0, 0);
  K.backdrop(o, w, h, "#2a0d26");
  // far layer: blurred plasma proteins / bokeh
  for (let i = 0; i < 26; i++) {
    K.glow(o, K.rand(0, w), K.rand(0, h), K.rand(10, 40), K.pick([K.C.violet, K.C.teal, "#ff5577"]), K.rand(0.03, 0.08));
  }
  // muscle fibres (striated, multinucleate)
  const fibres = (R, fw) => {
    const n = Math.max(1, Math.floor((R.x1 - R.x0) / (fw + 4)));
    const gap = (R.x1 - R.x0 - n * fw) / Math.max(1, n);
    for (let i = 0; i < n; i++) {
      const cx = R.x0 + gap / 2 + fw / 2 + i * (fw + gap);
      const cy = (R.y0 + R.y1) / 2, fh = R.y1 - R.y0 - (i % 2) * 10;
      K.blob(o, cx, cy, fw, fh, "#8e2443", fw * 0.48);
      o.save();
      K.roundRect(o, cx - fw / 2, cy - fh / 2, fw, fh, fw * 0.48); o.clip();
      o.strokeStyle = "rgba(255,190,200,0.13)"; o.lineWidth = 1.2;
      for (let y = cy - fh / 2; y < cy + fh / 2; y += 4.5) { o.beginPath(); o.moveTo(cx - fw / 2, y); o.lineTo(cx + fw / 2, y); o.stroke(); }
      o.restore();
      for (let k = 0; k < 3; k++) {
        o.fillStyle = "rgba(167,139,250,0.55)";
        o.beginPath(); o.ellipse(cx + (k % 2 ? fw * 0.32 : -fw * 0.32), cy - fh * 0.3 + k * fh * 0.3, 1.8, 4, 0, 0, K.TAU); o.fill();
      }
    }
  };
  fibres(L.mus, K.clamp((L.mus.x1 - L.mus.x0) / 3.4, 10, 18));
  if (L.musIn.x1 - L.musIn.x0 > 10) fibres(L.musIn, K.clamp(L.musIn.x1 - L.musIn.x0 - 4, 8, 16));
  // vessels: wall, lumen, plasma tint by expected oxygenation
  const { X, Y, Wd, T, N } = L;
  o.lineCap = "round";
  const oxyAt = (i) => {
    const t = T[i];
    if (TAGS_ART.has(t)) return 1;
    if (TAGS_VEN.has(t)) return 0;
    if (t === "lung") return K.clamp((L.yb - Y[i]) / (L.yb - L.yt) * 2.2, 0, 1);
    return K.clamp(1 - (Y[i] - L.yt) / (L.yb - L.yt) * 1.6, 0, 1);
  };
  for (const pass of [0, 1, 2]) {
    for (let i = 0; i < N; i++) {
      const k = (i + 1) % N;
      o.beginPath(); o.moveTo(X[i], Y[i]); o.lineTo(X[k], Y[k]);
      if (pass === 0) { o.strokeStyle = "rgba(255,120,150,0.42)"; o.lineWidth = Wd[i] * 2 + (T[i] === "lung" || T[i] === "tissue" ? 2.5 : 5); }
      else if (pass === 1) { o.strokeStyle = "#1c0712"; o.lineWidth = Wd[i] * 2; }
      else { o.strokeStyle = K.withAlpha(K.mix(COL.deoxy, COL.oxy, oxyAt(i)), 0.28); o.lineWidth = Wd[i] * 2; }
      o.stroke();
    }
  }
  // flow arrows
  for (let s = 60; s < L.len; s += 170) {
    const i = idxAt(s / L.len);
    const a = L.A[i], x = X[i], y = Y[i], d = 5;
    o.fillStyle = "rgba(255,220,230,0.35)";
    o.beginPath();
    o.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
    o.lineTo(x + Math.cos(a + 2.5) * d, y + Math.sin(a + 2.5) * d);
    o.lineTo(x + Math.cos(a - 2.5) * d, y + Math.sin(a - 2.5) * d);
    o.fill();
  }
}

// ---------------------------------------------------------------- red blood cells
function initCell(u) {
  const i = idxAt(u), t = L.T[i];
  const venous = TAGS_VEN.has(t) || t === "lung";
  return { id: nextId++, u, off: K.rand(-1, 1), ph: K.rand(0, K.TAU), p: venous ? C.Pt : C.Psrc, env: venous ? 1 : 0, sat: 0, prev: null, acc: 0, x: 0, y: 0, hist: [] };
}
function targetCount() { return Math.round(K.clamp(L.len / 52, 12, 44) * (st.hb / 150)); }
function syncCellCount() {
  const n = Math.max(4, targetCount());
  while (rbcs.length > n) {
    let k = rbcs.length - 1;
    if (rbcs[k].id === followId) k--;
    rbcs.splice(k, 1);
  }
  while (rbcs.length < n) {
    // put the new cell in the largest gap
    const us = rbcs.map((r) => r.u).sort((a, b) => a - b);
    let best = Math.random(), gapMax = -1;
    for (let i = 0; i < us.length; i++) {
      const a = us[i], b = i + 1 < us.length ? us[i + 1] : us[0] + 1;
      if (b - a > gapMax) { gapMax = b - a; best = (a + (b - a) / 2) % 1; }
    }
    rbcs.push(initCell(best));
  }
}
function resetCells() {
  rbcs = []; nextId = 1;
  const n = targetCount();
  for (let i = 0; i < n; i++) rbcs.push(initCell((i + K.rand(-0.2, 0.2)) / n));
  followId = rbcs[Math.floor(rbcs.length * 0.05)].id;
  userFollowed = false;
}
const followed = () => rbcs.find((r) => r.id === followId) || rbcs[0];

// ---------------------------------------------------------------- alveolus contents
function syncAlveolus() {
  const a = L.alv;
  const nO2 = st.fetal ? 6 : Math.round(K.clamp(22 * C.Psrc / 100, 3, 24));
  const nCO = st.coPpm > 0 ? Math.round(K.clamp(st.coPpm / 60, 1, 14)) : 0;
  const mk = () => ({ x: K.rand(a.x0 + 8, a.x1 - 8), y: K.rand(a.y0 + 8, a.y1 - 8), vx: K.rand(-30, 30), vy: K.rand(-30, 30), r: 4, ang: K.rand(0, K.TAU), spin: K.rand(-2, 2) });
  while (alvO2.length < nO2) alvO2.push(mk());
  alvO2.length = nO2;
  while (alvCO.length < nCO) alvCO.push(mk());
  alvCO.length = nCO;
  const nM = st.fetal ? 5 : 0;
  while (maternal.length < nM) maternal.push({ ...mk(), r: L.rr * 1.1, ph: K.rand(0, K.TAU) });
  maternal.length = nM;
}
function alvPoint() {
  const a = L.alv;
  return { x: K.rand(a.x0 + (a.x1 - a.x0) * 0.35, a.x1 - 6), y: K.rand(a.y0 + 10, a.y1 - 10) };
}

// ---------------------------------------------------------------- flying molecules
function spawn(type, x, y, target, opts = {}) {
  if (flyers.length > 170) return;
  flyers.push({ type, x, y, target, tx: opts.tx, ty: opts.ty, speed: opts.speed || K.rand(80, 130), age: 0, life: opts.life || 6, ang: K.rand(0, K.TAU), wob: K.rand(0, K.TAU), onArrive: opts.onArrive, drift: opts.drift });
}
function updateFlyers(dt) {
  for (let i = flyers.length - 1; i >= 0; i--) {
    const f = flyers[i];
    f.age += dt; f.ang += dt * 3;
    if (f.drift) { // free drift (e.g. HCO3− leaving the cell into plasma)
      f.x += f.drift.x * dt; f.y += f.drift.y * dt;
      if (f.age > f.life) flyers.splice(i, 1);
      continue;
    }
    const tx = f.target ? f.target.x : f.tx, ty = f.target ? f.target.y : f.ty;
    const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy);
    const step = f.speed * dt;
    if (d < step + 3 || f.age > f.life) {
      if (f.onArrive && d < step + 3) f.onArrive(f);
      flyers.splice(i, 1);
      continue;
    }
    f.wob += dt * 9;
    const w = Math.sin(f.wob) * 18 * dt;
    f.x += (dx / d) * step - (dy / d) * w;
    f.y += (dy / d) * step + (dx / d) * w;
  }
}

// ---------------------------------------------------------------- haemoglobin zoom state
const SITE_ORDER = [0, 3, 1, 2];
const tets = Array.from({ length: 4 }, () => ({ r: 0, sites: Array.from({ length: 4 }, () => ({ type: null, f: 0, want: null })) }));
let tetFor = null;
function updateTetramers(cell, dt) {
  const snap = tetFor !== cell.id; // new cell followed: show its state immediately
  tetFor = cell.id;
  const fCO = C.fCO;
  const c = Math.round(fCO * 16);
  const k = Math.min(16 - c, Math.round(cell.sat * 16));
  const coN = [0, 1, 2, 3].map((t) => Math.floor(c / 4) + (t < c % 4 ? 1 : 0));
  const o2N = [0, 0, 0, 0];
  const order = [0, 1, 2, 3].sort((a, b) => coN[b] - coN[a] || a - b);
  let left = k;
  for (const t of order) { const take = Math.min(4 - coN[t], left); o2N[t] = take; left -= take; }
  tets.forEach((tet, t) => {
    SITE_ORDER.forEach((s, j) => {
      tet.sites[s].want = j < coN[t] ? "co" : j < coN[t] + o2N[t] ? "o2" : null;
    });
    let lig = 0;
    for (const s of tet.sites) {
      if (snap) { s.type = s.want; s.f = s.want ? 1 : 0; }
      if (s.type !== s.want) {
        if (s.f > 0 && s.type) s.f = Math.max(0, s.f - dt * 3);
        if (s.f <= 0 || !s.type) { s.type = s.want; s.f = 0; }
      } else if (s.type) s.f = Math.min(1, s.f + dt * 2.5);
      if (s.type && s.f > 0.5) lig++;
    }
    const target = lig >= 2 ? 1 : lig === 1 ? 0.22 : 0;
    tet.r = snap ? target : tet.r + (target - tet.r) * (1 - Math.exp(-4 * dt));
  });
}

// ---------------------------------------------------------------- panel UI
const explain = K.card(panel, "What's happening", "explain");
const expBody = document.createElement("div");
explain.appendChild(expBody);

const gCard = K.card(panel, "O₂–haemoglobin dissociation curve");
const gWrap = document.createElement("div");
gWrap.className = "graph-wrap";
const gCanvas = document.createElement("canvas");
gCanvas.setAttribute("aria-label", "Oxygen–haemoglobin dissociation curve. Drag sideways to set the muscle tissue pO2.");
gWrap.appendChild(gCanvas);
gCard.appendChild(gWrap);
const gCap = document.createElement("p");
gCap.className = "graph-cap";
gCard.appendChild(gCap);
const gStage = K.createStage(gCanvas);

const controls = K.card(panel, "Controls");
const sEx = K.slider(controls, {
  label: "Exercise intensity", min: 0, max: 100, step: 5, value: 0,
  format: (v) => (v === 0 ? "Rest" : `${v}%`),
  onInput: (v) => { st.exercise = v / 100; st.ptManual = null; },
});
const sAlt = K.slider(controls, {
  label: "Altitude", min: 0, max: 8849, step: 1, value: 0,
  format: (v) => (v < 20 ? "Sea level" : `${v.toLocaleString("en-AU")} m${v >= 8700 ? " · Everest" : ""}`),
  onInput: (v) => { st.altitude = v; },
});
const altRow = K.buttonRow(controls);
K.button(altRow, "Sea level", () => { st.altitude = 0; sAlt.value = 0; });
K.button(altRow, "Mexico City 2,240 m", () => { st.altitude = 2240; sAlt.value = 2240; });
K.button(altRow, "Everest 8,849 m", () => { st.altitude = 8849; sAlt.value = 8849; });
const sCO = K.slider(controls, {
  label: "Carbon monoxide in air", min: 0, max: 800, step: 10, value: 0,
  format: (v) => (v === 0 ? "None" : `${v} ppm`),
  onInput: (v) => { st.coPpm = v; },
});
const sHb = K.slider(controls, {
  label: "Haemoglobin (anaemia ↓)", min: 60, max: 160, step: 5, value: 150,
  format: (v) => `${v} g/L${v < 120 ? " · anaemia" : ""}`,
  onInput: (v) => { st.hb = v; syncCellCount(); },
});
const sBPG = K.slider(controls, {
  label: "2,3-BPG in red cells", min: 3, max: 8, step: 0.5, value: 5,
  format: (v) => `${v.toFixed(1)} mmol/L`,
  onInput: (v) => { st.bpg = v; },
});
const cbFetal = K.checkbox(controls, "Fetal haemoglobin (HbF) at the placenta", false, (v) => {
  st.fetal = v; st.ptManual = null; offKey = ""; setFetalUI(v);
});
function setFetalUI(v) {
  // A fetus doesn't exercise: the slider is disabled in fetal mode
  sEx.input.disabled = v;
  sEx.el.style.opacity = v ? "0.45" : "";
  sEx.el.title = v ? "Not used in fetal mode — fetal tissue pO₂ is about 22 mmHg" : "";
}
const row = K.buttonRow(controls);
const pauseBtn = K.button(row, "Pause", () => { pauseBtn.textContent = loopCtl.toggle() ? "Pause" : "Play"; });
K.button(row, "Reset", () => reset());
K.button(row, "Follow next cell", () => {
  const i = rbcs.findIndex((r) => r.id === followId);
  followId = rbcs[(i + 1) % rbcs.length].id; userFollowed = true;
});
const sSpeed = K.slider(controls, {
  label: "Simulation speed", min: 0.25, max: 3, step: 0.25, value: reduced ? 0.5 : 1,
  format: (v) => `${v}×`, onInput: (v) => { loopCtl.speed = v; },
});

const legend = K.card(panel, "Legend");
legend.insertAdjacentHTML("beforeend", `<div class="legend">
  <span><i style="background:${COL.oxy}"></i>RBC, oxygenated</span>
  <span><i style="background:${COL.deoxy}"></i>RBC, deoxygenated</span>
  <span><i style="background:${COL.coHb}"></i>RBC with COHb</span>
  <span><i style="background:${COL.o2}"></i>O₂</span>
  <span><i style="background:${COL.co2}"></i>CO₂</span>
  <span><i style="background:${COL.co}"></i>CO</span>
  <span><i style="background:${COL.hco3}"></i>HCO₃⁻ (bicarbonate)</span>
  <span><i style="background:#fb923c"></i>Mitochondria</span>
  <span><i style="background:${COL.tState}"></i>Hb subunit, T state</span>
  <span><i style="background:${COL.rState}"></i>Hb subunit, R state</span>
</div><p class="small" style="margin-top:8px;font-size:.78rem;color:var(--ink-faint)">Deoxygenated blood is dark red — never blue.</p>`);

const missions = K.missions(panel, [
  { text: "Tap a red blood cell to follow it, and watch its haemoglobin reach ~97% saturation in the lungs.",
    check: () => userFollowed && ["lung", "pv"].includes(L.T[idxAt(followed().u)]) && followed().sat >= 0.96 },
  { text: "Exercise hard (≥ 60%): the Bohr shift pushes muscle P50 above 34 mmHg and Hb unloads over 60% of its O₂.",
    check: () => st.exercise >= 0.6 && C.p50T > 34 && C.unloaded > 0.6 },
  { text: "Climb Mount Everest: arterial saturation falls below 80%, and even light exercise (10–20%) now outstrips supply — O₂ demand not met.",
    check: () => st.altitude >= 8000 && !st.fetal && C.satL < 0.8 && !C.met },
  { text: "At sea level and at rest, add carbon monoxide until the blood's maximum O₂ supply halves and muscle pO₂ falls below 25 mmHg — even though arterial pO₂ is normal.",
    check: () => st.altitude < 500 && st.coPpm > 0 && C.Pa > 90 && C.e < 0.1 && !st.fetal && st.ptManual == null && C.capacity < 1.65 && C.Pt < 25 },
  { text: "Model anaemia (Hb ≤ 90 g/L): saturation stays ~97%, yet the blood's maximum O₂ supply drops by over a third and muscle pO₂ falls.",
    check: () => st.hb <= 90 && C.satL > 0.95 && C.capacity < 2.2 && C.Pt < 32 && C.e < 0.1 && st.ptManual == null },
  { text: "Switch on fetal Hb: at the placenta it is > 12 percentage points more saturated than the mother's Hb.",
    check: () => st.fetal && C.satL - C.satAdultSrc > 0.12 },
], (m) => toast(`Mission complete ✓ ${m.text.split(":")[0]}`, 3200));

K.quiz(panel, [
  { q: "Why is the oxygen–haemoglobin dissociation curve S-shaped (sigmoidal)?",
    options: ["Oxygen dissolves better in plasma at high pO₂", "Binding of one O₂ changes Hb's shape (T → R), making it easier for the next O₂ molecules to bind — cooperative binding", "Red blood cells burst at low pO₂", "Each haem group can hold up to four O₂ molecules"],
    answer: 1, why: "The first O₂ binds to tense (T) Hb with low affinity. Binding shifts the subunits toward the relaxed (R) state, raising the affinity of the remaining haem groups — so the curve is shallow at first, then steep, then plateaus." },
  { q: "During exercise, muscle is warmer, more acidic and has more CO₂. What does this do to the curve?",
    options: ["Shifts it left — Hb holds O₂ more tightly", "Shifts it right — Hb's affinity falls and more O₂ is unloaded in the tissue", "No change — only pO₂ matters", "Makes the curve a straight line"],
    answer: 1, why: "This is the Bohr effect: H⁺ and CO₂ bind to Hb and stabilise the T state, raising P50. At the same tissue pO₂ Hb is less saturated, so it gives up more O₂ exactly where it is needed." },
  { q: "Why is carbon monoxide so dangerous, even when a person is breathing air with normal pO₂?",
    options: ["CO binds haem ~200–250× more tightly than O₂, blocking sites AND shifting the curve left so the remaining O₂ is held more tightly", "CO makes blood turn blue", "CO lowers the alveolar pO₂ to zero", "CO destroys red blood cells immediately"],
    answer: 0, why: "COHb cannot carry O₂, and CO on one subunit locks the tetramer toward the R state, so the O₂ that is bound is unloaded less readily. Arterial pO₂ stays normal, so breathing isn't stimulated and a basic pulse oximeter can read falsely high." },
  { q: "Which features make alveoli efficient sites of gas exchange?",
    options: ["Thick walls and a small surface area", "A huge total surface area (~70 m²), walls only one thin cell thick, moist surfaces and a dense capillary network with constant blood flow", "Cartilage rings and cilia", "Low blood flow to keep the gradient small"],
    answer: 1, why: "Fick's law: diffusion rate ∝ surface area × concentration difference ÷ distance. Huge area, a ~0.5 µm barrier, and ventilation plus blood flow that keep the pO₂ gradient steep all maximise diffusion." },
  { q: "How is most CO₂ carried from the tissues to the lungs?",
    options: ["Bound to the haem iron, like O₂", "As hydrogencarbonate (HCO₃⁻) in plasma, made inside red cells by carbonic anhydrase: CO₂ + H₂O → H₂CO₃ → H⁺ + HCO₃⁻", "As bubbles of CO₂ gas", "Only dissolved in plasma"],
    answer: 1, why: "About 70% travels as HCO₃⁻ (with ~20% as carbaminohaemoglobin and ~10% dissolved). The H⁺ produced binds to Hb, which both buffers the blood and promotes O₂ release (Bohr effect). In the lungs the reaction reverses and CO₂ is breathed out." },
  { q: "Fetal haemoglobin's curve lies to the LEFT of adult haemoglobin's. What does this allow?",
    options: ["The fetus can breathe air in the uterus", "At the low pO₂ of the placenta, HbF has a higher affinity than maternal HbA, so O₂ moves from the mother's blood to the fetus's", "The fetus needs no oxygen", "HbF releases O₂ more easily to the mother"],
    answer: 1, why: "At the same pO₂ (~35 mmHg in the placenta) HbF is ~80% saturated while maternal HbA is only ~65%, so O₂ diffuses from maternal to fetal blood." },
]);

// ---------------------------------------------------------------- chips
const chipPA = K.chip(overlay), chipPt = K.chip(overlay), chipSL = K.chip(overlay), chipST = K.chip(overlay), chipDel = K.chip(overlay);
function updateChips() {
  const f0 = (v) => v.toFixed(0);
  chipPA(st.fetal ? `<span class="lab">Placental pO₂</span> <b>${f0(C.Psrc)} mmHg</b>`
    : `<span class="lab">pO₂ alveolar</span> <b>${f0(C.PA)}</b> <span class="lab">· arterial</span> <b>${f0(C.Pa)} mmHg</b>`);
  chipPt(`<span class="lab">Muscle pO₂</span> <b>${f0(C.Pt)} mmHg</b>${st.ptManual != null ? " ✋" : ""}`);
  chipSL(`<span class="lab">Sat · ${st.fetal ? "placenta" : "lungs"}</span> <b>${f0(C.satL * 100)}%</b>${C.fCO > 0.01 ? ` <span class="lab">+COHb ${f0(C.fCO * 100)}%</span>` : ""}`);
  chipST(`<span class="lab">Sat · muscle</span> <b>${f0(C.satT * 100)}%</b>`);
  const d = (v) => v.toFixed(v < 10 ? 2 : 1);
  chipDel(C.met
    ? `<span class="lab">O₂ delivered/min</span> <b>×${d(C.delivery)}</b> <span class="lab">✓ demand met · max ×${d(C.capacity)}</span>`
    : `<span class="lab">O₂ delivered/min</span> <b>×${d(C.delivery)}</b> <b style="color:var(--danger)">⚠ demand not met (${f0(C.fracMet * 100)}%)</b>`);
}

// ---------------------------------------------------------------- explain text
let lastExplain = "";
function updateExplain() {
  const cell = followed();
  const tag = L.T[idxAt(cell.u)];
  const s = Math.round(cell.sat * 100);
  const f0 = (v) => v.toFixed(0);
  let p1;
  if (tag === "lung") {
    p1 = st.fetal
      ? `<strong>At the placenta:</strong> the mother's blood (pO₂ ≈ ${f0(C.Psrc)} mmHg) and fetal blood flow close together but never mix. O₂ leaves the mother's Hb and diffuses into the fetal red cell, where <strong>fetal haemoglobin</strong> grabs it. This cell is <strong>${s}%</strong> saturated.`
      : `<strong>In the lungs:</strong> O₂ diffuses down its partial-pressure gradient from the alveolus (pO₂ ${f0(C.PA)} mmHg) across the very thin alveolar and capillary walls, into the plasma and into the red blood cell, where it binds the <strong>haem</strong> groups of haemoglobin. This cell is now <strong>${s}%</strong> saturated. CO₂ diffuses the other way and is breathed out.`;
  } else if (tag === "tissue") {
    p1 = `<strong>${st.fetal ? "In fetal tissues" : "In working muscle"}:</strong> pO₂ is only <strong>${f0(C.Pt)} mmHg</strong>${C.e > 0.05 ? ", and exercise has made the tissue warmer, more acidic and richer in CO₂" : ""}. Haemoglobin's affinity falls (<strong>Bohr effect</strong>), so it <strong>unloads O₂</strong>, which diffuses to the mitochondria for aerobic respiration. CO₂ enters the red cell, where <strong>carbonic anhydrase</strong> converts it to H⁺ + HCO₃⁻. This cell is now <strong>${s}%</strong> saturated.`;
  } else if (TAGS_ART.has(tag)) {
    p1 = st.fetal ? `<strong>Oxygenated fetal blood</strong> travels from the placenta through the umbilical vein to the fetal heart, which pumps it to the fetus's tissues. Hb stays about <strong>${s}%</strong> saturated.` : `<strong>Oxygenated blood</strong> flows to the <strong>left side of the heart</strong>, which pumps it to the body. No gas exchange happens through the thick walls of big vessels, so Hb stays about <strong>${s}%</strong> saturated.`;
  } else if (st.fetal) {
    p1 = `<strong>Deoxygenated fetal blood</strong> (dark red, not blue!) returns through the fetal heart and umbilical arteries to the placenta to pick up more O₂. Hb is still about <strong>${s}%</strong> saturated.`;
  } else {
    p1 = `<strong>Deoxygenated blood</strong> (dark red, not blue!) returns to the <strong>right side of the heart</strong>, which pumps it to the lungs. Hb is still about <strong>${s}%</strong> saturated — a reserve the body can draw on during exercise.`;
  }
  const notes = [];
  if (C.e >= 0.2 && st.ptManual == null) notes.push(`Exercise ${f0(st.exercise * 100)}%: heart rate ${f0(C.HR)} bpm, muscle pH ${C.tissuePH.toFixed(2)}, ${C.tissueT.toFixed(1)} °C. The Bohr shift adds <strong>+${f0(C.bohrBonus * 100)}%</strong> extra unloading.`);
  if (!C.met) notes.push(`<strong style="color:var(--danger)">O₂ demand not met:</strong> the muscle needs ×${C.demand.toFixed(1)} its resting O₂ use, but even extracting down to the critical pO₂ (${M.P_CRIT} mmHg) the blood can only supply ×${C.delivery.toFixed(1)} (${f0(C.fracMet * 100)}%). The shortfall must come from anaerobic respiration (lactate) — fatigue follows.`);
  if (st.ptManual != null) notes.push(`You set muscle pO₂ to <strong>${f0(C.Pt)} mmHg</strong> on the curve — a "what if": that's how much O₂ the muscle would be using. Move the exercise slider to return to automatic (demand-driven).`);
  if (st.altitude >= 500) notes.push(`Altitude ${st.altitude.toLocaleString("en-AU")} m: air pressure ${f0(C.Pb)} mmHg, so alveolar pO₂ is only ${f0(C.PA)} mmHg. Faster breathing lowers CO₂ (pH ${C.lungPH.toFixed(2)}), shifting the curve left and helping loading a little.${C.AaGrad > 5 ? ` The pressure gradient is now so small that O₂ can't fully diffuse across the alveolar wall before the blood leaves (<strong>diffusion limitation</strong>): arterial pO₂ is only ${f0(C.Pa)} mmHg${C.e > 0.05 ? " — worse during exercise, because blood rushes through faster" : ""}.` : ""}`);
  if (C.fCO > 0.01 || st.coPpm > 0) notes.push(`Carbon monoxide: <strong>${f0(C.fCO * 100)}%</strong> of haem is now COHb (cherry red). CO binds ~${M.HALDANE_M}× more tightly than O₂ and shifts the curve left, so the blood's maximum O₂ supply is only <strong>×${C.capacity.toFixed(2)}</strong> (normal ×3.3) and muscle pO₂ has fallen to ${f0(C.Pt)} mmHg.`);
  if (st.hb < 120) notes.push(`Anaemia: only ${st.hb} g/L haemoglobin (fewer red cells). Each Hb is still fully saturated, but the blood carries less O₂ in total, so tissues must extract more (muscle pO₂ ${f0(C.Pt)} mmHg) and the maximum supply falls to ×${C.capacity.toFixed(2)} (normal ×3.3).`);
  if (st.fetal) notes.push(`Fetal Hb is <strong>${f0(C.satL * 100)}%</strong> saturated at the placenta, while the mother's adult Hb would be only <strong>${f0(C.satAdultSrc * 100)}%</strong> at the same pO₂ — so O₂ moves to the fetus.`);
  if (st.bpg !== 5) notes.push(`2,3-BPG ${st.bpg > 5 ? "raised" : "lowered"} (${st.bpg} mmol/L): it binds the T state, shifting the curve ${st.bpg > 5 ? "right (P50 ↑, easier unloading — a high-altitude adaptation)" : "left"}.${st.fetal ? " HbF binds 2,3-BPG weakly, so the effect is small." : ""}`);
  const html = `<p>${p1}</p>${notes.map((n) => `<p>${n}</p>`).join("")}<p class="small">Not to scale: real capillaries are ~5–10 µm wide, a red cell holds ~270 million Hb molecules, and the full journey takes about a minute at rest.</p>`;
  if (html !== lastExplain) { expBody.innerHTML = html; lastExplain = html; }
}

// ---------------------------------------------------------------- graph
const G = { pad: { l: 40, r: 14, t: 14, b: 32 }, pmax: 120, dragging: false };
const gx = (p) => G.pad.l + (p / G.pmax) * (gStage.w - G.pad.l - G.pad.r);
const gy = (s) => G.pad.t + (1 - s) * (gStage.h - G.pad.t - G.pad.b);
const gp = (x) => ((x - G.pad.l) / (gStage.w - G.pad.l - G.pad.r)) * G.pmax;
function setPtFromGraph(x) {
  st.ptManual = K.clamp(gp(x), 4, Math.max(5, C.Psrc - 4));
}
gCanvas.addEventListener("pointerdown", (e) => {
  const r = gCanvas.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  if (x < G.pad.l - 10 || y > gStage.h - G.pad.b + 10) return;
  G.dragging = true; gCanvas.setPointerCapture(e.pointerId);
  setPtFromGraph(x);
});
gCanvas.addEventListener("pointermove", (e) => {
  if (!G.dragging) return;
  const r = gCanvas.getBoundingClientRect();
  setPtFromGraph(e.clientX - r.left);
});
const endDrag = () => { G.dragging = false; };
gCanvas.addEventListener("pointerup", endDrag);
gCanvas.addEventListener("pointercancel", endDrag);

function curve(g, fn, color, width, dash) {
  g.save();
  g.strokeStyle = color; g.lineWidth = width; if (dash) g.setLineDash(dash);
  g.beginPath();
  for (let p = 0; p <= G.pmax; p += 1) {
    const x = gx(p), y = gy(fn(p));
    p === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.stroke(); g.restore();
}
function drawGraph(t) {
  const g = gStage.ctx, W = gStage.w, H = gStage.h;
  g.clearRect(0, 0, W, H);
  const x0 = G.pad.l, x1 = W - G.pad.r, y0 = G.pad.t, y1 = H - G.pad.b;
  g.fillStyle = "rgba(5,11,22,0.55)"; K.roundRect(g, x0, y0, x1 - x0, y1 - y0, 6); g.fill();
  g.font = "10px Inter, system-ui, sans-serif"; g.fillStyle = K.C.inkFaint;
  g.strokeStyle = "rgba(255,255,255,0.06)"; g.lineWidth = 1;
  g.textAlign = "center"; g.textBaseline = "top";
  for (let p = 0; p <= G.pmax; p += 20) {
    g.beginPath(); g.moveTo(gx(p), y0); g.lineTo(gx(p), y1); g.stroke();
    g.fillText(String(p), gx(p), y1 + 4);
  }
  g.textAlign = "right"; g.textBaseline = "middle";
  for (let s = 0; s <= 1.001; s += 0.25) {
    g.beginPath(); g.moveTo(x0, gy(s)); g.lineTo(x1, gy(s)); g.stroke();
    g.fillText(`${Math.round(s * 100)}`, x0 - 5, gy(s));
  }
  g.textAlign = "center"; g.textBaseline = "bottom";
  g.fillText("pO₂ (mmHg)", (x0 + x1) / 2, H - 1);
  g.save(); g.translate(11, (y0 + y1) / 2); g.rotate(-Math.PI / 2); g.textBaseline = "middle"; g.fillText("Hb saturation (%)", 0, 0); g.restore();

  // reference curve
  if (st.fetal) {
    const p50m = M.p50For({ pH: C.lungPH, pco2: C.paco2, bpg: st.bpg, fCO: C.fCO });
    curve(g, (p) => M.satTotal(p, p50m, C.fCO), K.C.pink, 1.6, [5, 4]);
  } else {
    curve(g, (p) => M.hill(p, C.p50Ref), "rgba(200,215,235,0.4)", 1.4, [5, 4]);
  }
  // COHb ceiling
  if (C.fCO > 0.02) {
    g.save(); g.setLineDash([2, 4]); g.strokeStyle = COL.coHb; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x0, gy(1 - C.fCO)); g.lineTo(x1, gy(1 - C.fCO)); g.stroke(); g.restore();
    g.fillStyle = COL.coHb; g.textAlign = "right"; g.textBaseline = "bottom"; g.font = "600 10px Inter, system-ui, sans-serif";
    g.fillText(`max O₂Hb — ${Math.round(C.fCO * 100)}% is COHb`, x1 - 4, gy(1 - C.fCO) - 2);
  }
  // critical tissue pO2
  g.save(); g.setLineDash([2, 3]); g.strokeStyle = "rgba(248,113,113,0.55)"; g.lineWidth = 1;
  g.beginPath(); g.moveTo(gx(M.P_CRIT), y0); g.lineTo(gx(M.P_CRIT), y1); g.stroke(); g.restore();
  g.save(); g.translate(gx(M.P_CRIT) - 3, y0 + 4); g.rotate(-Math.PI / 2); g.fillStyle = "rgba(248,113,113,0.8)";
  g.font = "600 9px Inter, system-ui, sans-serif"; g.textAlign = "right"; g.textBaseline = "bottom"; g.fillText("critical pO₂", 0, 0); g.restore();
  // unloaded band
  g.fillStyle = "rgba(251,146,60,0.10)";
  g.fillRect(x0, gy(C.satL), x1 - x0, gy(C.satT) - gy(C.satL));
  // live curves
  curve(g, (p) => M.satTotal(p, C.p50T, C.fCO), COL.tissue, 2.4);
  curve(g, (p) => M.satTotal(p, C.p50L, C.fCO), COL.lungs, 2.4);
  // drop lines
  const pt = (p, s, col) => {
    g.save(); g.setLineDash([3, 3]); g.strokeStyle = K.withAlpha(col, 0.6); g.lineWidth = 1;
    g.beginPath(); g.moveTo(gx(p), y1); g.lineTo(gx(p), gy(s)); g.lineTo(x0, gy(s)); g.stroke(); g.restore();
  };
  pt(C.Psrc, C.satL, COL.lungs);
  pt(C.Pt, C.satT, COL.tissue);
  // bracket
  const bx = Math.min(x1 - 8, gx(Math.max(C.Psrc, C.Pt)) + 16);
  g.strokeStyle = K.C.ink; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(bx - 4, gy(C.satL)); g.lineTo(bx, gy(C.satL)); g.lineTo(bx, gy(C.satT)); g.lineTo(bx - 4, gy(C.satT)); g.stroke();
  const unl = `unloaded ${Math.round(C.unloaded * 100)}%`;
  g.font = "600 11px Inter, system-ui, sans-serif";
  const tw = g.measureText(unl).width;
  const lx = bx + 6 + tw > x1 ? bx - 8 - tw : bx + 6;
  K.label(g, unl, lx, (gy(C.satL) + gy(C.satT)) / 2, { size: 10, align: "left", color: K.C.ink });
  // points
  K.glow(g, gx(C.Psrc), gy(C.satL), 14, COL.lungs, 0.5);
  K.sphere(g, gx(C.Psrc), gy(C.satL), 5.5, COL.lungs);
  const hx = gx(C.Pt), hy = gy(C.satT);
  K.glow(g, hx, hy, 18, COL.tissue, 0.55);
  g.strokeStyle = K.withAlpha(COL.tissue, 0.7 + 0.3 * Math.sin(t * 4)); g.lineWidth = 2;
  g.beginPath(); g.arc(hx, hy, 11, 0, K.TAU); g.stroke();
  K.sphere(g, hx, hy, 6, COL.tissue);
  K.label(g, st.fetal ? "placenta" : "lungs", gx(C.Psrc), gy(C.satL) + 15, { size: 10, color: COL.lungs });
  K.label(g, G.dragging ? "muscle" : "muscle ↔ drag", K.clamp(hx, x0 + 40, x1 - 40), Math.min(y1 - 10, hy + 22), { size: 10, color: COL.tissue });
  // the followed cell
  const cell = followed();
  K.sphere(g, gx(cell.p), gy(cell.sat), 4, "#ffffff");
  g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 1.2;
  g.beginPath(); g.arc(gx(cell.p), gy(cell.sat), 7, 0, K.TAU); g.stroke();
  // legend
  g.font = "600 10px Inter, system-ui, sans-serif"; g.textAlign = "left"; g.textBaseline = "middle";
  const lg = [[COL.lungs, st.fetal ? "HbF at placenta" : "lung conditions"], [COL.tissue, "muscle conditions"], [st.fetal ? K.C.pink : "rgba(200,215,235,0.6)", st.fetal ? "mother's HbA" : "normal (pH 7.4, 37 °C)"]];
  lg.forEach(([c, txt], i) => {
    const ly = gy(0.24) + i * 14;
    g.fillStyle = c; g.fillRect(gx(58), ly - 1.5, 12, 3);
    g.fillStyle = K.C.inkDim; g.fillText(txt, gx(58) + 16, ly);
  });
}
let lastCap = "";
function updateCaption() {
  const f0 = (v) => Math.round(v * 100);
  const html = `O₂ unloaded = sat(${st.fetal ? "placenta" : "lungs"}) − sat(muscle) = <b>${f0(C.satL)}%</b> − <b>${f0(C.satT)}%</b> = <b>${f0(C.unloaded)}%</b> of the Hb's sites each pass.<br>
P50 (pO₂ for 50% saturation): ${st.fetal ? "placenta" : "lungs"} <b>${C.p50L.toFixed(1)}</b> · muscle <b>${C.p50T.toFixed(1)}</b> mmHg. Bohr shift adds <b>+${f0(Math.max(0, C.bohrBonus))}%</b>.<br>
<span style="color:var(--ink-faint)">Model: Hill equation S = pⁿ ⁄ (pⁿ + P50ⁿ), n ≈ ${C.n.toFixed(1)}. Drag on the graph to set muscle pO₂.</span>`;
  if (html !== lastCap) { gCap.innerHTML = html; lastCap = html; }
}

// ---------------------------------------------------------------- stage pointer (tap to follow)
K.pointer(canvas, {
  down: (p) => {
    if (!L) return;
    let best = null, bd = Math.max(24, L.rr * 2.4);
    for (const r of rbcs) {
      const d = K.dist(p.x, p.y, r.x, r.y);
      if (d < bd) { bd = d; best = r; }
    }
    if (best) {
      followId = best.id; userFollowed = true; best.hist = [];
      toast(`Following red blood cell #${best.id} — see its haemoglobin in the zoom panel`, 2200);
    } else if (!(p.x > L.inset.x && p.x < L.inset.x + L.inset.w && p.y > L.inset.y && p.y < L.inset.y + L.inset.h)) {
      toast("Tap a red blood cell (red disc) to follow it", 1800);
    }
  },
});

// ---------------------------------------------------------------- drawing: stage
function alvShape(c, a, k) {
  // sac with a flat wall against the capillary; k = breathing scale
  const x1 = a.x1, x0 = x1 - (x1 - a.x0) * k;
  const y0 = a.y0 - (k - 1) * 20, y1 = a.y1 + (k - 1) * 20;
  const rl = Math.min((x1 - x0) * 0.55, (y1 - y0) * 0.35), rr = 8;
  c.beginPath();
  c.moveTo(x0 + rl, y0);
  c.lineTo(x1 - rr, y0); c.quadraticCurveTo(x1, y0, x1, y0 + rr);
  c.lineTo(x1, y1 - rr); c.quadraticCurveTo(x1, y1, x1 - rr, y1);
  c.lineTo(x0 + rl, y1); c.quadraticCurveTo(x0, y1, x0, y1 - rl);
  c.lineTo(x0, y0 + rl); c.quadraticCurveTo(x0, y0, x0 + rl, y0);
  c.closePath();
  return { x0, x1, y0, y1 };
}

function drawAlveolus(dt) {
  const a = L.alv;
  const k = 1 + 0.035 * Math.sin(breathPhase);
  // bronchiole leading to the sac
  const bx = a.x0 + (a.x1 - a.x0) * 0.35, bw = Math.max(10, (a.x1 - a.x0) * 0.22);
  if (!st.fetal) {
    ctx.fillStyle = "rgba(140,200,255,0.07)"; ctx.strokeStyle = "rgba(200,225,255,0.35)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.rect(bx - bw / 2, L.box.y0 - 4, bw, a.y0 - L.box.y0 + 8); ctx.fill();
    ctx.beginPath(); ctx.moveTo(bx - bw / 2, L.box.y0); ctx.lineTo(bx - bw / 2, a.y0 + 2); ctx.moveTo(bx + bw / 2, L.box.y0); ctx.lineTo(bx + bw / 2, a.y0 + 2); ctx.stroke();
    const inhale = Math.cos(breathPhase) > 0;
    const ay = (L.box.y0 + a.y0) / 2;
    if (a.y0 - L.box.y0 > 24) K.arrow(ctx, bx, inhale ? ay - 8 : ay + 8, bx, inhale ? ay + 8 : ay - 8, "rgba(200,225,255,0.6)", 1.5);
  }
  const b = alvShape(ctx, a, k);
  if (st.fetal) {
    const g = ctx.createLinearGradient(b.x0, 0, b.x1, 0);
    g.addColorStop(0, "rgba(160,30,60,0.35)"); g.addColorStop(1, "rgba(200,50,80,0.18)");
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = "rgba(255,160,180,0.6)"; ctx.lineWidth = 1.6; ctx.stroke();
  } else {
    const g = ctx.createRadialGradient(b.x0 + (b.x1 - b.x0) * 0.4, b.y0 + (b.y1 - b.y0) * 0.35, 4, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.y1 - b.y0) * 0.7);
    g.addColorStop(0, `rgba(150,210,255,${0.06 + 0.12 * C.Psrc / 100})`);
    g.addColorStop(1, "rgba(80,140,220,0.05)");
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = "rgba(210,230,255,0.75)"; ctx.lineWidth = 1.4; ctx.stroke();
  }
  // contents bounce inside
  const bnd = { x0: b.x0 + 6, x1: b.x1 - 5, y0: b.y0 + 6, y1: b.y1 - 6 };
  const move = (q) => {
    K.brownian(q, dt, 90, 0.97);
    const sp = Math.hypot(q.vx, q.vy);
    if (sp < 18) { q.vx *= 1.05; q.vy *= 1.05; }
    K.bounce(q, bnd.x0, bnd.y0, bnd.x1, bnd.y1);
    q.ang += q.spin * dt;
  };
  for (const q of maternal) {
    move(q);
    drawRBC(ctx, q.x, q.y, q.r, Math.atan2(q.vy, q.vx), rbcColour(C.satAdultSrc * 0.85, C.fCO), 0.75 + 0.25 * Math.sin(simT + q.ph));
  }
  for (const q of alvO2) { move(q); molecule(ctx, "o2", q.x, q.y, q.ang, 1); }
  for (const q of alvCO) { move(q); molecule(ctx, "co", q.x, q.y, q.ang, 1); }
}

function drawMuscle(t) {
  const e = C.e;
  const m = L.mus;
  if (e > 0.02) {
    K.glow(ctx, (m.x0 + m.x1) / 2, (m.y0 + m.y1) / 2, (m.y1 - m.y0) * 0.6, "#ff7a2f", 0.08 + 0.22 * e);
  }
  for (const mi of L.mitos) {
    const pulse = 0.5 + 0.5 * Math.sin(t * (2 + 6 * e) + mi.ph);
    K.glow(ctx, mi.x, mi.y, 9 + 5 * e, "#fb923c", 0.15 + 0.35 * e * pulse);
    ctx.save(); ctx.translate(mi.x, mi.y); ctx.rotate(mi.a);
    ctx.fillStyle = "#c2551a"; ctx.strokeStyle = "#fdba74"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, 0, 6, 3.2, 0, 0, K.TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "rgba(255,220,180,0.7)"; ctx.beginPath(); ctx.moveTo(-4, 0);
    for (let k = -3; k <= 4; k += 1.4) ctx.lineTo(k, (k * 3) % 2 > 1 ? 1.6 : -1.6);
    ctx.stroke();
    ctx.restore();
  }
}

function cellPos(r) {
  const i = idxAt(r.u);
  const a = L.A[i], w = L.Wd[i];
  const amp = Math.max(0, w - L.rr) * 0.8;
  return { x: L.X[i] - Math.sin(a) * r.off * amp, y: L.Y[i] + Math.cos(a) * r.off * amp, a, tag: L.T[i], w };
}

function drawLabels() {
  const f0 = (v) => v.toFixed(0);
  const sz = L.narrow ? 10 : 11;
  const a = L.alv;
  const ax = (a.x0 + a.x1) / 2;
  if (st.fetal) {
    K.label(ctx, "Placenta: mother's blood", ax, a.y1 + 14, { size: sz, color: K.C.pink });
    if (!L.narrow) K.label(ctx, `pO₂ ${f0(C.Psrc)} mmHg`, ax, a.y1 + 31, { size: sz - 1, color: K.C.inkDim });
  } else {
    K.label(ctx, L.narrow ? "Alveolus" : "Alveolus (air)", ax, a.y1 + 14, { size: sz, color: "#bfe3ff" });
    K.label(ctx, `pO₂ ${f0(C.PA)} mmHg`, ax, a.y1 + 31, { size: sz - 1, color: K.C.inkDim });
  }
  if (!L.narrow && L.H > 300) K.label(ctx, "thin walls ≈ 0.5 µm", ax, a.y0 + 14, { size: 10, color: K.C.inkFaint });
  const m = L.mus;
  const mx = (m.x0 + m.x1) / 2;
  K.label(ctx, st.fetal ? "Fetal tissue" : L.narrow ? "Muscle" : "Working muscle", mx, m.y1 + 14, { size: sz, color: COL.tissue });
  K.label(ctx, `pO₂ ${f0(C.Pt)}`, mx, m.y1 + 31, { size: sz - 1, color: K.C.inkDim });
  if (!L.narrow) K.label(ctx, `pH ${C.tissuePH.toFixed(2)} · ${C.tissueT.toFixed(1)} °C`, mx, m.y1 + 47, { size: 10, color: K.C.inkFaint });
  K.label(ctx, `Heart · ${f0(C.HR)} bpm`, L.hx, L.hy + L.hs * 1.35, { size: sz, color: "#ffb3c1" });
  if (!L.narrow && L.W > 520) {
    K.label(ctx, "left side → body", L.hx, L.hy - L.hs * 1.15, { size: 10, color: K.C.inkDim });
    K.label(ctx, "Pulmonary vein", (L.xl + L.hx) / 2 - L.hs * 0.4, L.yTop + L.bigHalf + 12, { size: 10, color: K.C.inkFaint, bg: null });
    K.label(ctx, "Aorta → body", (L.xr + L.hx) / 2 + L.hs * 0.4, L.yTop + L.bigHalf + 12, { size: 10, color: K.C.inkFaint, bg: null });
    K.label(ctx, "Vena cava", (L.xr + L.hx) / 2 + L.hs * 0.4, L.yBot - L.bigHalf - 12, { size: 10, color: K.C.inkFaint, bg: null });
    K.label(ctx, "Pulmonary artery", (L.xl + L.hx) / 2 - L.hs * 0.4, L.yBot - L.bigHalf - 12, { size: 10, color: K.C.inkFaint, bg: null });
  }
}

function drawInset(t, cell) {
  const I = L.inset;
  ctx.save();
  ctx.fillStyle = "rgba(6,12,24,0.88)"; ctx.strokeStyle = "rgba(120,190,255,0.25)"; ctx.lineWidth = 1;
  K.roundRect(ctx, I.x, I.y, I.w, I.h, 12); ctx.fill(); ctx.stroke();
  const tag = L.T[idxAt(cell.u)];
  const zoneCol = tag === "lung" ? COL.lungs : tag === "tissue" ? COL.tissue : TAGS_ART.has(tag) ? "#ff8095" : "#c06080";
  ctx.font = "600 12px 'Space Grotesk', Inter, sans-serif"; ctx.textBaseline = "middle"; ctx.textAlign = "left";
  ctx.fillStyle = K.C.ink;
  ctx.fillText(`Zoom: red cell #${cell.id}`, I.x + 10, I.y + 14);
  ctx.font = "600 10px Inter, sans-serif"; ctx.textAlign = "right"; ctx.fillStyle = zoneCol;
  let zn = ZONE_NAME[tag];
  if (st.fetal && tag === "lung") zn = "Placenta";
  ctx.fillText(zn, I.x + I.w - 10, I.y + 14);
  if (!userFollowed) {
    ctx.textAlign = "left"; ctx.fillStyle = K.withAlpha(K.C.amber, 0.7 + 0.3 * Math.sin(t * 3));
    ctx.fillText("Tap any red cell to follow it", I.x + 10, I.y + 29);
  }
  // tetramers
  const col = rbcColour(cell.sat, C.fCO);
  let textX, textY, textW, tetSize;
  const tPos = [];
  if (I.wide) {
    const discR = Math.min(I.w * 0.46, I.h * 0.25);
    const cx = I.x + I.w / 2, cy = I.y + 38 + discR;
    ctx.globalAlpha = 0.55; drawRBC(ctx, cx, cy, discR, 0, col, 1); ctx.globalAlpha = 1;
    tetSize = discR * 0.8;
    for (let i = 0; i < 4; i++) tPos.push([cx + (i % 2 ? 1 : -1) * discR * 0.46, cy + (i < 2 ? -1 : 1) * discR * 0.46]);
    textX = I.x + 12; textY = cy + discR + 14; textW = I.w - 24;
  } else {
    const areaW = I.w * 0.52;
    tetSize = Math.min(areaW / 4.3, I.h - 54);
    const cy = I.y + 30 + (I.h - 36) / 2;
    ctx.globalAlpha = 0.45;
    drawRBC(ctx, I.x + 8 + areaW / 2, cy, Math.min(areaW / 2, (I.h - 36) / 2 + 6), 0, col, 1);
    ctx.globalAlpha = 1;
    for (let i = 0; i < 4; i++) tPos.push([I.x + 8 + areaW * (i + 0.5) / 4, cy]);
    textX = I.x + areaW + 18; textY = I.y + 36; textW = I.w - areaW - 26;
  }
  tets.forEach((tet, i) => {
    drawTetramer(ctx, tPos[i][0], tPos[i][1], tetSize, tet.sites, tet.r, t + i);
    const lig = tet.sites.filter((s) => s.type && s.f > 0.5).length;
    K.label(ctx, `${tet.r > 0.6 ? "R" : "T"} · ${lig}/4`, tPos[i][0], tPos[i][1] + tetSize * 0.62, { size: 9, color: tet.r > 0.6 ? COL.rState : COL.tState, bg: "rgba(5,11,22,0.6)" });
  });
  // saturation bar
  const barH = 9;
  const o2 = cell.sat, co = C.fCO;
  ctx.fillStyle = COL.deoxy; K.roundRect(ctx, textX, textY, textW, barH, 4); ctx.fill();
  ctx.fillStyle = COL.oxy; ctx.fillRect(textX, textY, textW * o2, barH);
  if (co > 0.005) { ctx.fillStyle = COL.coHb; ctx.fillRect(textX + textW * o2, textY, textW * co, barH); }
  ctx.font = "600 10.5px Inter, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillStyle = K.C.ink;
  let y = textY + barH + 5;
  ctx.fillText(`O₂Hb ${Math.round(o2 * 100)}%${co > 0.005 ? ` · COHb ${Math.round(co * 100)}%` : ""} · pO₂ ${Math.round(cell.p)}`, textX, y);
  y += 15;
  ctx.font = "10px Inter, sans-serif"; ctx.fillStyle = K.C.inkDim;
  let note;
  if (tag === "tissue") note = "CO₂ + H₂O → H₂CO₃ → H⁺ + HCO₃⁻ (carbonic anhydrase). H⁺ binds Hb, favouring T state → O₂ released (Bohr).";
  else if (tag === "lung") note = st.fetal ? "HbF has a higher O₂ affinity than the mother's HbA, so it takes O₂ from her blood." : "HCO₃⁻ + H⁺ → H₂CO₃ → CO₂ + H₂O; CO₂ diffuses out. O₂ binds: 1st O₂ binds weakly (T), each bound O₂ makes the next bind more easily (→ R).";
  else note = "Hb = 4 subunits (2α, 2β), each with one haem (Fe²⁺) → carries up to 4 O₂. T = tense, low affinity; R = relaxed, high affinity.";
  if (C.fCO > 0.05) note = "CO occupies haem sites and locks Hb toward the R state, so the remaining O₂ is held tightly and unloaded poorly.";
  const lines = wrap(ctx, note, textW);
  const maxLines = Math.max(1, Math.floor((I.y + I.h - y - (I.wide ? 46 : 6)) / 12.5));
  lines.slice(0, maxLines).forEach((ln, i) => ctx.fillText(ln, textX, y + i * 12.5));
  y += Math.min(lines.length, maxLines) * 12.5 + 6;
  // sparkline of this cell's saturation
  if (I.wide && I.y + I.h - y > 34) {
    const sx = textX, sw = textW, sy = I.y + I.h - 10, sh = Math.min(70, I.y + I.h - y - 14);
    ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.strokeRect(sx, sy - sh, sw, sh);
    ctx.fillStyle = K.C.inkFaint; ctx.font = "9px Inter, sans-serif"; ctx.textBaseline = "bottom";
    ctx.fillText("saturation over time", sx + 3, sy - sh + 11);
    const hist = cell.hist;
    if (hist.length > 1) {
      ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.beginPath();
      hist.forEach((v, i) => {
        const px = sx + (i / 119) * sw, py = sy - 2 - v * (sh - 4);
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      });
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- reset
function reset() {
  Object.assign(st, M.DEFAULTS);
  sEx.value = 0; sAlt.value = 0; setFetalUI(false); sCO.value = 0; sHb.value = 150; sBPG.value = 5; cbFetal.checked = false;
  flyers.length = 0;
  C = M.conditions(st);
  if (L) { resetCells(); syncAlveolus(); }
  offKey = "";
}

// ---------------------------------------------------------------- main loop
let chipTimer = 7, expTimer = 19, histTimer = 0, lastOverlayH = -1;
const loopCtl = K.loop((dt, t) => {
  if (overlay.offsetHeight !== lastOverlayH) { lastOverlayH = overlay.offsetHeight; needLayout = true; }
  if (needLayout) {
    const old = L;
    L = computeLayout();
    needLayout = false; offKey = "";
    if (!old) resetCells(); else syncCellCount();
    syncAlveolus();
  }
  const key = `${stage.w}x${stage.h}@${stage.dpr}|${L.len}`;
  if (key !== offKey) { renderStatic(); offKey = key; }
  simT = t;

  // ---- model
  const tauCO = C.fCOeq > st.fCO ? 4 : 10;
  st.fCO += (C.fCOeq - st.fCO) * (1 - Math.exp(-dt / tauCO));
  if (st.fCO < 1e-4) st.fCO = 0;
  C = M.conditions(st);
  syncAlveolus();
  if (st.ptManual != null) st.ptManual = K.clamp(st.ptManual, 4, Math.max(5, C.Psrc - 4));
  beatPhase += dt * (C.HR / 60) * K.TAU;
  breathPhase += dt * ((12 + 28 * C.e) / 60) * K.TAU;
  const beat = Math.pow(Math.max(0, Math.sin(beatPhase)), 3);

  // ---- cells
  const base = L.len / 16;
  const flow = 1 + 1.4 * C.e;
  const pulse = 1 + 0.3 * Math.sin(beatPhase);
  const lnL = Math.log(C.p50L), lnT = Math.log(C.p50T);
  const kx = 1 - Math.exp(-3.2 * dt);
  const emitK = 12;
  for (const r of rbcs) {
    const i0 = idxAt(r.u), tag0 = L.T[i0];
    const zf = tag0 === "lung" || tag0 === "tissue" ? 0.55 : 1;
    r.u = (r.u + (base * flow * zf * pulse * dt) / L.len) % 1;
    const pos = cellPos(r);
    r.x = pos.x; r.y = pos.y; r.ang = pos.a; r.tag = pos.tag;
    if (pos.tag === "lung") { r.p += (C.Psrc - r.p) * kx; r.env += (0 - r.env) * kx; }
    else if (pos.tag === "tissue") { r.p += (C.Pt - r.p) * kx; r.env += (1 - r.env) * kx; }
    const p50 = Math.exp(K.lerp(lnL, lnT, r.env));
    const sat = M.satTotal(r.p, p50, C.fCO);
    if (r.prev == null) r.prev = sat;
    if (dt > 0 && (pos.tag === "lung" || pos.tag === "tissue")) {
      r.acc += (sat - r.prev) * emitK;
      while (r.acc >= 1) { // O2 loading: alveolus → plasma → RBC
        const s = alvPoint(); spawn("o2", s.x, s.y, r); r.acc -= 1;
      }
      while (r.acc <= -1) { // O2 unloading: RBC → muscle mitochondria
        const m = K.pick(L.mitos); spawn("o2", r.x, r.y, null, { tx: m.x, ty: m.y }); r.acc += 1;
      }
      const co2Rate = 0.5 + 2.2 * C.e;
      if (pos.tag === "tissue" && Math.random() < co2Rate * dt) {
        const m = K.pick(L.mitos);
        spawn("co2", m.x, m.y, r, { onArrive: (f) => spawn("hco3", f.x, f.y, null, { drift: { x: K.rand(-25, 25), y: K.rand(-25, 25) }, life: 1.3 }) });
      }
      if (pos.tag === "lung" && Math.random() < co2Rate * dt) {
        const s = alvPoint(); spawn("co2", r.x, r.y, null, { tx: s.x, ty: s.y });
      }
      if (pos.tag === "lung" && st.coPpm > 0 && Math.random() < (st.coPpm / 300) * dt) {
        const s = alvPoint(); spawn("co", s.x, s.y, r);
      }
    } else r.acc = 0;
    r.prev = sat; r.sat = sat;
  }
  updateFlyers(dt);
  const cell = followed();
  histTimer += dt;
  if (histTimer > 0.1) { histTimer = 0; cell.hist.push(cell.sat); if (cell.hist.length > 120) cell.hist.shift(); }
  updateTetramers(cell, dt);

  // ---- draw
  ctx.drawImage(off, 0, 0, L.w, L.h);
  drawMuscle(t);
  drawAlveolus(dt);
  drawHeart(ctx, L.hx, L.hy, L.hs, beat);
  for (const r of rbcs) {
    const tilt = r.tag === "lung" || r.tag === "tissue" ? 0.55 : 0.5 + 0.45 * Math.abs(Math.sin(t * 0.8 + r.ph));
    drawRBC(ctx, r.x, r.y, L.rr, r.ang, rbcColour(r.sat, C.fCO), tilt);
  }
  for (const f of flyers) {
    const a = f.drift ? 1 - f.age / f.life : Math.min(1, f.age * 4);
    molecule(ctx, f.type, f.x, f.y, f.ang, 1, Math.max(0, a));
  }
  // followed cell highlight + connector to zoom panel
  K.glow(ctx, cell.x, cell.y, L.rr * 3.2, "#ffffff", 0.18);
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(cell.x, cell.y, L.rr * 1.7 + Math.sin(t * 4) * 1.2, 0, K.TAU); ctx.stroke();
  const I = L.inset;
  const tx = K.clamp(cell.x, I.x + 12, I.x + I.w - 12), ty = K.clamp(cell.y, I.y + 12, I.y + I.h - 12);
  ctx.setLineDash([3, 5]); ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cell.x, cell.y); ctx.lineTo(I.wide ? I.x : tx, I.wide ? ty : I.y); ctx.stroke();
  ctx.restore();
  drawLabels();
  drawInset(t, cell);

  drawGraph(t);
  chipTimer += 1; expTimer += 1;
  if (chipTimer % 8 === 0) updateChips();
  if (expTimer % 20 === 0) { updateExplain(); updateCaption(); }
  missions.update();
});
loopCtl.speed = sSpeed.value;
