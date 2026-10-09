// DNA to Protein: Transcription & Translation — CellScape sim.
// Act 1: build mRNA on the DNA template inside the nucleus, export through a nuclear pore.
// Act 2: deliver tRNAs to a ribosome (A/P/E sites) to build a polypeptide.
// Mutation lab: substitute / insert / delete DNA bases and compare the resulting polypeptides.
import * as K from "../../assets/js/kit.js";
import * as M from "./model.js";

const { C, TAU } = K;
const stageEl = K.$("#stage"), panel = K.$("#panel"), overlay = K.$("#overlay");
const canvas = K.$("#canvas");
const stage = K.createStage(canvas);
const { ctx } = stage;
const toast = K.toaster(stageEl);
const reduced = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
const smooth = (a, b, x) => { const t = K.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const UPL = M.UPSTREAM.length;
const GENE_MIN = 6, GENE_MAX = 48;
let chipH = 34; // height of the chip overlay, so the stage layout can sit below it

// ---------------------------------------------------------------- state
const S = {
  act: 1, auto: false, autoT: 0, errors: 0, sound: true, tool: "off", picker: null,
  gene: M.ORIGINAL_GENE.split("").map((b) => ({ b, mut: false, del: false })),
  t1: null, t2: null,
  cam1: { x: 0, manual: false }, cam2: { x: 0, manual: false },
  flags: { transcribed: false, translated: false, silent: false, nonsense: false, frameshift: false, sickle: false },
  lastResult: null, drag: null, cbtn: null,
};
const geneStr = () => S.gene.map((n) => n.b).join("");
let trCache = { g: null, tr: null };
const curTr = () => { const g = geneStr(); if (trCache.g !== g) trCache = { g, tr: M.translate(M.toRNA(g)) }; return trCache.tr; };

// ---------------------------------------------------------------- sound
let actx = null;
function beep(kind) {
  if (!S.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain(), now = actx.currentTime;
    if (kind === "buzz") {
      o.type = "sawtooth"; o.frequency.setValueAtTime(150, now); o.frequency.linearRampToValueAtTime(85, now + 0.2);
      g.gain.setValueAtTime(0.05, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    } else {
      o.type = "sine"; o.frequency.setValueAtTime(kind === "bond" ? 520 : 760, now);
      if (kind === "bond") o.frequency.linearRampToValueAtTime(780, now + 0.12);
      g.gain.setValueAtTime(S.auto ? 0.015 : 0.035, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    }
    o.connect(g).connect(actx.destination); o.start(now); o.stop(now + 0.25);
  } catch { /* audio unavailable */ }
}

// ---------------------------------------------------------------- shared drawing
const far = K.makeParticles(46, () => ({ x: Math.random(), y: Math.random(), r: K.rand(0.8, 2.6), a: K.rand(0.07, 0.26), d: K.rand(0.12, 0.4), ph: K.rand(0, TAU) }));
const farBlobs = K.makeParticles(5, () => ({ x: Math.random(), y: Math.random(), r: K.rand(60, 140), d: K.rand(0.05, 0.15) }));
function drawFar(cam, T, col, blobCol) {
  const W = stage.w + 300;
  for (const b of farBlobs) {
    const x = ((b.x * W - cam * b.d) % W + W) % W - 150;
    K.glow(ctx, x, b.y * stage.h, b.r, blobCol, 0.12);
  }
  ctx.fillStyle = col;
  const W2 = stage.w + 80;
  for (const p of far) {
    const x = ((p.x * W2 - cam * p.d) % W2 + W2) % W2 - 40;
    const y = p.y * stage.h + Math.sin(T * 0.3 + p.ph) * 6;
    ctx.globalAlpha = p.a; ctx.beginPath(); ctx.arc(x, y, p.r, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function tile(x, y, b, sz, { alpha = 1, ring = null } = {}) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = M.BASE_COL[b];
  K.roundRect(ctx, x - sz / 2, y - sz / 2, sz, sz, sz * 0.28); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  K.roundRect(ctx, x - sz / 2 + 2, y - sz / 2 + 2, sz - 4, sz * 0.32, sz * 0.15); ctx.fill();
  if (ring) { ctx.strokeStyle = ring; ctx.lineWidth = 2; K.roundRect(ctx, x - sz / 2 - 2.5, y - sz / 2 - 2.5, sz + 5, sz + 5, sz * 0.34); ctx.stroke(); }
  ctx.fillStyle = "#06121f"; ctx.font = `700 ${Math.round(sz * 0.62)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(b, x, y + 0.5);
  ctx.globalAlpha = 1;
}

function canvasButton(x, y, text) {
  ctx.save();
  ctx.font = "600 14px Inter, system-ui, sans-serif";
  const w = ctx.measureText(text).width + 32, h = 38;
  ctx.shadowColor = C.teal; ctx.shadowBlur = 16;
  ctx.fillStyle = C.teal; K.roundRect(ctx, x - w / 2, y - h / 2, w, h, 12); ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = "#032024"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, x, y + 1);
  ctx.restore();
  return { x: x - w / 2, y: y - h / 2, w, h };
}

function shakeOff(it) { return it.shake > 0 ? Math.sin(it.shake * 70) * 5 : 0; }

function stepFly(it, dt) {
  const f = it.fly; f.t += dt;
  const e = K.easeInOut(Math.min(1, f.t / f.dur)); const tg = f.target();
  it.x = K.lerp(f.x0, tg.x, e); it.y = K.lerp(f.y0, tg.y, e);
  if (f.t >= f.dur) { it.fly = null; f.done(it); }
}

// =================================================================== ACT 1 — TRANSCRIPTION
function lay1() {
  const w = stage.w, h = stage.h;
  const sp = w < 600 ? 24 : 28;
  const envY = Math.max(60, h * 0.1, chipH + 22);
  const cy = Math.max(h * 0.42, envY + 152);
  return { w, h, sp, tl: Math.round(sp * 0.68), X0: 100, cy, A: 22, envY, poreX: w * 0.8, trackY: cy - 108, freeTop: cy + 92, freeBot: h - 16 };
}

function resetAct1() {
  const keep = S.t1 ? S.t1.items.filter((i) => !i.fly) : [];
  S.t1 = { phase: "ready", placed: 0, polA: 0, phaseT: 0, openF: 1, relF: 0, polLift: 0, items: keep, puffs: [], gene: geneStr() };
  S.cam1.manual = false;
  S.picker = null;
}

const neededBase = () => { const n = S.gene[S.t1.placed]; return n ? M.toRNA(n.b) : null; };

function spawnNuc(b, fromEdge) {
  const L = lay1();
  const it = {
    b, r: 13, vx: 0, vy: 0, shake: 0, alpha: fromEdge ? 0 : 1, ph: K.rand(0, TAU), fly: null,
    x: K.rand(20, L.w - 20),
    y: K.rand(L.freeTop, Math.max(L.freeTop, L.freeBot)),
  };
  S.t1.items.push(it);
  return it;
}
function randomNucBase() { return Math.random() < 0.12 ? "T" : K.pick(["A", "U", "G", "C"]); }

function maintainNucs() {
  const t1 = S.t1, L = lay1();
  const target = L.w < 600 ? 9 : 13;
  const free = t1.items.filter((i) => !i.fly);
  const need = (t1.phase === "ready" || t1.phase === "elong") ? neededBase() : null;
  if (need && !free.some((i) => i.b === need)) spawnNuc(need, true);
  if (t1.items.length < target) spawnNuc(randomNucBase(), true);
}

function slotPos() {
  const L = lay1();
  return { x: L.X0 + (UPL + S.t1.placed) * L.sp - S.cam1.x, y: L.cy - 11 };
}

function tryPlace1(it, tapped) {
  const t1 = S.t1;
  if (!(t1.phase === "ready" || t1.phase === "elong")) {
    toast("This gene is already transcribed. Press <strong>Reset</strong> to transcribe it again.");
    return;
  }
  if (it.b === neededBase()) {
    it.fly = { t: 0, dur: tapped ? 0.35 : 0.12, x0: it.x, y0: it.y, target: slotPos, done: arrive1 };
  } else reject1(it);
}

function arrive1(it) {
  const t1 = S.t1;
  if ((t1.phase === "ready" || t1.phase === "elong") && it.b === neededBase()) {
    t1.items.splice(t1.items.indexOf(it), 1);
    const sp = slotPos();
    for (let k = 0; k < 2; k++) t1.puffs.push({ x: sp.x - 14, y: sp.y, vx: K.rand(-40, -10), vy: K.rand(30, 70) * (k ? 1 : 0.6), life: 1 });
    t1.placed++; t1.phase = "elong";
    S.cam1.manual = false;
    beep("ok");
    if (t1.placed >= S.gene.length) startTerm();
  } else reject1(it);
}

function reject1(it) {
  const n = S.gene[S.t1.placed];
  if (!n) return;
  const tb = M.DNA_PAIR[n.b], need = M.RNA_FOR_TEMPLATE[tb];
  it.vx = K.rand(-150, 150); it.vy = 240; it.shake = 0.45;
  S.errors++; beep("buzz");
  toast(it.b === "T"
    ? "✗ <strong>T (thymine)</strong> is only used in DNA. RNA uses <strong>U (uracil)</strong> instead."
    : `✗ ${it.b} can't pair with template base <strong>${tb}</strong>. Template ${tb} pairs with RNA base <strong>${need}</strong>.`, 3200);
}

function startTerm() {
  const t1 = S.t1;
  t1.phase = "term"; t1.phaseT = 0;
  t1.items.forEach((i) => { if (i.fly) i.fly = null; });
  S.flags.transcribed = true;
  t1.gene = geneStr();
}

function autoComplete1() {
  const t1 = S.t1;
  if (t1.phase === "ready" || t1.phase === "elong") { t1.placed = S.gene.length; startTerm(); toast("Auto-completed transcription."); }
  else if (t1.phase === "term" || t1.phase === "export") { t1.phase = "exported"; t1.phaseT = 0; }
}

function update1(dt, rdt, T) {
  const t1 = S.t1, L = lay1(), G = S.gene.length;
  t1.phaseT += dt;
  if (t1.phase === "term") {
    const e = t1.phaseT;
    t1.polA = K.lerp(t1.polA, G + 4, Math.min(1, dt * 2.5));
    t1.openF = 1 - smooth(0.7, 1.6, e);
    t1.relF = smooth(0.2, 1.2, e);
    t1.polLift = smooth(0.9, 1.8, e);
    if (e > 2) { t1.phase = "export"; t1.phaseT = 0; }
  } else if (t1.phase === "export") {
    if (t1.phaseT > 3.6) { t1.phase = "exported"; t1.phaseT = 0; toast("mRNA has left the nucleus. On to translation!"); }
  } else if (t1.phase !== "exported") {
    t1.polA += (t1.placed - t1.polA) * Math.min(1, dt * 6);
    t1.openF = 1; t1.relF = 0; t1.polLift = 0;
  }
  // camera
  const n = UPL + G + M.DOWNSTREAM.length;
  const maxCam = L.X0 + n * L.sp + 50 - L.w;
  if (!S.cam1.manual && t1.phase !== "export") {
    const tgt = L.X0 + (UPL + Math.min(t1.polA, G)) * L.sp - L.w * 0.5;
    S.cam1.x += (tgt - S.cam1.x) * Math.min(1, rdt * 3);
  }
  S.cam1.x = maxCam < 0 ? maxCam / 2 : K.clamp(S.cam1.x, 0, maxCam);
  // nucleotides
  maintainNucs();
  for (const it of t1.items) {
    if (it === S.drag?.item) continue;
    if (it.fly) { stepFly(it, dt); continue; }
    it.alpha = Math.min(1, it.alpha + dt * 2);
    if (it.shake > 0) it.shake -= dt;
    K.brownian(it, dt, 90, 0.93);
    if (it.y < L.freeTop) it.y += (L.freeTop - it.y) * Math.min(1, dt * 2.5);
    if (it.y > L.freeBot) it.y += (L.freeBot - it.y) * Math.min(1, dt * 4);
    if (it.x < 16) it.x += (16 - it.x) * Math.min(1, dt * 3);
    if (it.x > L.w - 16) it.x += (L.w - 16 - it.x) * Math.min(1, dt * 3);
  }
  for (let i = 0; i < t1.items.length; i++) for (let j = i + 1; j < t1.items.length; j++) {
    const a = t1.items[i], b = t1.items[j];
    if (a.fly || b.fly) continue;
    const d = K.dist(a.x, a.y, b.x, b.y);
    if (d > 0.01 && d < 34) { const f = (34 - d) * 0.5 * Math.min(1, dt * 10), ux = (b.x - a.x) / d, uy = (b.y - a.y) / d; a.x -= ux * f; a.y -= uy * f; b.x += ux * f; b.y += uy * f; }
  }
  for (const p of t1.puffs) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 1.2; }
  t1.puffs = t1.puffs.filter((p) => p.life > 0);
}

function drawEnvelope(L, T) {
  const { w, envY, poreX } = L;
  const g = ctx.createLinearGradient(0, 0, 0, envY);
  g.addColorStop(0, "#0c3a46"); g.addColorStop(1, "#11304a");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, envY);
  const gap = 15;
  ctx.lineWidth = 3.5; ctx.strokeStyle = K.withAlpha(C.lipidHead, 0.7);
  for (const off of [-5, 5]) {
    for (const [x0, x1] of [[-12, poreX - gap], [poreX + gap, w + 12]]) {
      ctx.beginPath();
      for (let x = x0; x <= x1; x += 10) {
        const y = envY + off + Math.sin(x * 0.013 + T * 0.4) * 1.5;
        if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  K.glow(ctx, poreX, envY, 30, C.violet, 0.28);
  K.blob(ctx, poreX - gap - 1, envY, 11, 28, "#7c6fd6", 5);
  K.blob(ctx, poreX + gap + 1, envY, 11, 28, "#7c6fd6", 5);
  if (envY - chipH > 44) K.label(ctx, "Cytoplasm", 10, envY - 16, { align: "left", size: 10, color: C.inkDim });
  K.label(ctx, "Nucleus", 10, envY + 20, { align: "left", size: 10, color: C.inkDim });
  K.label(ctx, "Nuclear pore", poreX, envY + 24, { size: 10, color: C.inkDim });
}

function drawPolymerase(x, y, rx, ry, alpha) {
  ctx.save(); ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(x - rx * 0.3, y - ry * 0.4, 4, x, y, Math.max(rx, ry));
  g.addColorStop(0, "rgba(196,181,253,0.40)"); g.addColorStop(0.7, "rgba(139,92,246,0.22)"); g.addColorStop(1, "rgba(91,33,182,0.14)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = "rgba(196,181,253,0.6)"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
}

function draw1(T) {
  const t1 = S.t1, L = lay1();
  const { sp, cy, A, tl } = L;
  const cam = S.cam1.x;
  const g = geneStr(), G = g.length;
  const seq = M.UPSTREAM + g + M.DOWNSTREAM, n = seq.length;
  const sx = (j) => L.X0 + j * sp - cam;
  const tr = curTr();

  K.backdrop(ctx, L.w, L.h, "#23194d");
  drawFar(cam, T, "#b8a8ff", "#5b3fb0");
  drawEnvelope(L, T);

  const a = UPL + t1.polA;
  const back = Math.min(9, 3 + t1.polA);
  const openAt = (j) => smooth(a - back - 2.5, a - back, j) * (1 - smooth(a + 1.5, a + 3.5, j)) * t1.openF;
  const j0 = Math.max(0, Math.floor((cam - L.X0) / sp) - 2), j1 = Math.min(n - 1, Math.ceil((cam + L.w - L.X0) / sp) + 2);

  // region boxes
  const region = (ja, jb, col, text) => {
    const x0 = sx(ja) - sp / 2, x1 = sx(jb) - sp / 2;
    if (x1 < -20 || x0 > L.w + 20) return;
    ctx.fillStyle = K.withAlpha(col, 0.07); ctx.strokeStyle = K.withAlpha(col, 0.35); ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
    K.roundRect(ctx, x0 + 2, cy - A - 30, x1 - x0 - 4, 2 * A + 60, 10); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    K.label(ctx, text, (x0 + x1) / 2, cy - 62, { size: 10, color: col });
  };
  region(0, UPL, C.amber, "Promoter · TATA box");
  region(UPL + G, n, C.inkFaint, "Terminator");

  // per-bp geometry
  const P = [];
  for (let j = j0; j <= j1; j++) {
    const ph = j * TAU / 10.5 + (reduced ? 0 : T * 0.35);
    const hw = A * (0.62 + 0.38 * Math.cos(ph));
    const o = openAt(j);
    P.push({
      j, x: sx(j), o, br: 0.55 + 0.45 * (Math.cos(ph) + 1) / 2,
      cB: K.lerp(cy - hw, cy - 72, o), tB: K.lerp(cy + hw, cy + 30, o),
      cT: K.lerp(cy - A - 17, cy - 54, o), tT: K.lerp(cy + A + 17, cy + 12, o),
      cb: seq[j], tb: M.DNA_PAIR[seq[j]],
    });
  }
  // codon boxes and numbers on coding strand (frame from first AUG)
  if (tr.start >= 0) {
    tr.codons.forEach((cod, c) => {
      const jj = UPL + tr.start + 3 * c;
      const pts = P.filter((p) => p.j >= jj && p.j < jj + 3);
      if (!pts.length) return;
      const xs = sx(jj) - tl / 2 - 3, xe = sx(jj + 2) + tl / 2 + 3;
      const yAvg = pts.reduce((s, p) => s + p.cT, 0) / pts.length;
      const maxO = Math.max(...pts.map((p) => p.o));
      const stop = M.CODE[cod] === "*";
      if (maxO < 0.15) {
        ctx.fillStyle = c === 0 ? "rgba(74,222,128,0.16)" : stop ? "rgba(248,113,113,0.18)" : c % 2 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.10)";
        K.roundRect(ctx, xs, yAvg - tl / 2 - 3, xe - xs, tl + 6, 6); ctx.fill();
      }
      const lbl = c === 0 ? "start" : stop ? "stop" : String(c);
      ctx.globalAlpha = 1 - maxO * 0.7;
      ctx.font = "600 10px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = c === 0 ? C.green : stop ? C.red : C.inkFaint;
      ctx.fillText(lbl, sx(jj + 1), yAvg - tl / 2 - 11);
      ctx.globalAlpha = 1;
    });
    if (tr.stop && tr.end < G - 1) {
      const xm = (sx(UPL + tr.end) + sx(UPL + G - 1)) / 2;
      ctx.font = "600 10px Inter, system-ui, sans-serif"; ctx.fillStyle = C.inkFaint; ctx.textAlign = "center";
      ctx.fillText("3′ UTR (not translated)", xm, cy - A - 36);
    }
  }
  // rungs
  ctx.lineWidth = 3; ctx.lineCap = "round";
  for (const p of P) {
    const al = (1 - p.o) * p.br;
    if (al < 0.02) continue;
    const mid = (p.cB + p.tB) / 2;
    ctx.globalAlpha = al;
    ctx.strokeStyle = M.BASE_COL[p.cb]; ctx.beginPath(); ctx.moveTo(p.x, p.cB); ctx.lineTo(p.x, mid - 1); ctx.stroke();
    ctx.strokeStyle = M.BASE_COL[p.tb]; ctx.beginPath(); ctx.moveTo(p.x, mid + 1); ctx.lineTo(p.x, p.tB); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // backbones
  for (const key of ["cB", "tB"]) {
    ctx.beginPath();
    P.forEach((p, i) => (i ? ctx.lineTo(p.x, p[key]) : ctx.moveTo(p.x, p[key])));
    ctx.strokeStyle = "#5f86b3"; ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = "rgba(210,230,255,0.45)"; ctx.lineWidth = 1.5; ctx.stroke();
  }
  for (const p of P) {
    K.sphere(ctx, p.x, p.cB, 2.6 + p.br, "#9cc0e8");
    K.sphere(ctx, p.x, p.tB, 2.6 + p.br, "#9cc0e8");
  }
  // sticks in bubble + tiles
  ctx.lineWidth = 2.5;
  for (const p of P) {
    if (p.o > 0.05) {
      ctx.globalAlpha = p.o;
      ctx.strokeStyle = M.BASE_COL[p.cb]; ctx.beginPath(); ctx.moveTo(p.x, p.cB); ctx.lineTo(p.x, p.cT); ctx.stroke();
      ctx.strokeStyle = M.BASE_COL[p.tb]; ctx.beginPath(); ctx.moveTo(p.x, p.tB); ctx.lineTo(p.x, p.tT); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const gi = p.j - UPL;
    const node = gi >= 0 && gi < G ? S.gene[gi] : null;
    const inFlank = !node;
    const ring = node && node.mut ? C.red : null;
    tile(p.x, p.cT, p.cb, tl, { alpha: inFlank ? 0.6 : 1, ring });
    tile(p.x, p.tT, p.tb, tl, { alpha: inFlank ? 0.6 : 1, ring });
    if (node && node.del) {
      ctx.fillStyle = C.red; ctx.beginPath();
      const xx = p.x - sp / 2; ctx.moveTo(xx, p.cT - tl / 2 - 9); ctx.lineTo(xx - 5, p.cT - tl / 2 - 16); ctx.lineTo(xx + 5, p.cT - tl / 2 - 16); ctx.closePath(); ctx.fill();
    }
  }
  // strand end labels
  const yC = cy - A - 17, yT = cy + A + 17;
  K.label(ctx, "coding 5′", sx(0) - 16, yC, { size: 10, align: "right", color: C.inkDim });
  K.label(ctx, "template 3′", sx(0) - 16, yT, { size: 10, align: "right", color: C.inkDim });
  K.label(ctx, "3′", sx(n - 1) + 18, yC, { size: 10, color: C.inkDim });
  K.label(ctx, "5′", sx(n - 1) + 18, yT, { size: 10, color: C.inkDim });

  // mRNA
  if (t1.phase !== "export" && t1.phase !== "exported" && t1.placed > 0) {
    const pts = [];
    for (let i = 0; i < t1.placed; i++) {
      const j = UPL + i;
      let f = K.easeInOut(K.clamp((a - 9 - j) / 3.5, 0, 1));
      f = Math.max(f, t1.relF);
      const bb = K.lerp(cy - 27, L.trackY, f);
      pts.push({ x: sx(j), bb, ty: bb + 16, f, b: M.toRNA(g[i]), i });
    }
    // codon grouping on finished track
    if (tr.start >= 0) {
      for (let c = 0; c < tr.codons.length; c++) {
        const i0 = tr.start + 3 * c;
        if (i0 + 2 >= t1.placed) break;
        const q = pts[i0];
        if (pts[i0 + 2].f < 0.95 || q.f < 0.95) continue;
        ctx.fillStyle = c === 0 ? "rgba(74,222,128,0.16)" : M.CODE[tr.codons[c]] === "*" ? "rgba(248,113,113,0.18)" : c % 2 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.1)";
        K.roundRect(ctx, q.x - tl / 2 - 3, q.ty - tl / 2 - 3, 2 * sp + tl + 6, tl + 6, 6); ctx.fill();
      }
    }
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.bb) : ctx.moveTo(p.x, p.bb)));
    ctx.strokeStyle = "#c084fc"; ctx.lineWidth = 4.5; ctx.stroke();
    ctx.strokeStyle = "rgba(255,240,255,0.5)"; ctx.lineWidth = 1.3; ctx.stroke();
    for (const p of pts) {
      if (p.x < -20 || p.x > L.w + 20) continue;
      if (p.f < 0.4) { // hydrogen bonds to template in hybrid
        ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - p.f / 0.4)})`; ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.moveTo(p.x, p.ty + tl / 2); ctx.lineTo(p.x, cy + 12 - tl / 2); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.strokeStyle = M.BASE_COL[p.b]; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(p.x, p.bb); ctx.lineTo(p.x, p.ty); ctx.stroke();
      tile(p.x, p.ty, p.b, tl);
    }
    const p0 = pts[0];
    if (p0.f > 0.6) K.label(ctx, "mRNA 5′", p0.x - 16, p0.ty, { size: 10, align: "right", color: "#e9d5ff" });
  }

  // RNA polymerase
  if (t1.phase !== "export" && t1.phase !== "exported") {
    const px = sx(a - 3.5), py = cy - 20 - t1.polLift * 70;
    const rx = Math.min(6.2 * sp, 180), ry = 74;
    const al = 1 - t1.polLift;
    drawPolymerase(px, py, rx, ry, al);
    if (al > 0.05) {
      ctx.globalAlpha = al;
      K.label(ctx, "RNA polymerase →", px, py + ry + 10, { size: 11, color: "#ddd6fe" });
      ctx.globalAlpha = 1;
    }
  }
  // active slot
  if ((t1.phase === "ready" || t1.phase === "elong") && t1.placed < G) {
    const sp0 = slotPos();
    const pulse = 0.5 + 0.5 * Math.sin(T * 5);
    const near = S.drag?.item && K.dist(S.drag.item.x, S.drag.item.y, sp0.x, sp0.y) < 48;
    K.glow(ctx, sp0.x, sp0.y, 26, near ? C.green : C.amber, 0.25 + 0.2 * pulse);
    ctx.strokeStyle = near ? C.green : C.amber; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
    K.roundRect(ctx, sp0.x - tl / 2 - 2, sp0.y - tl / 2 - 2, tl + 4, tl + 4, 5); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = C.amber; ctx.font = "700 12px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("?", sp0.x, sp0.y + 0.5);
    ctx.strokeStyle = K.withAlpha(C.amber, 0.5 + 0.5 * pulse); ctx.lineWidth = 2;
    K.roundRect(ctx, sp0.x - tl / 2 - 3, cy + 12 - tl / 2 - 3, tl + 6, tl + 6, 6); ctx.stroke();
  }
  // export animation
  if (t1.phase === "export") drawExport(L, T, g);
  if (t1.phase === "exported") {
    K.label(ctx, "✓ mRNA exported to the cytoplasm", L.w / 2, L.envY + 52, { size: 12, color: C.green });
  }
  // PPi puffs
  for (const p of t1.puffs) {
    ctx.globalAlpha = Math.max(0, p.life);
    K.sphere(ctx, p.x, p.y, 3, "#fcd34d"); K.sphere(ctx, p.x + 6, p.y + 1, 3, "#fcd34d");
  }
  ctx.globalAlpha = 1;
  // free nucleotides
  for (const it of t1.items) if (it !== S.drag?.item) drawNuc(it, T);
  if (S.drag?.item) drawNuc(S.drag.item, T);
  // picker
  if (S.picker) drawPicker(L);
  if (t1.phase === "exported") S.cbtn = { ...canvasButton(L.w / 2, Math.min(L.h - 40, L.freeTop + 40), "Translate it in the cytoplasm →"), act: () => setAct(2) };
  if (t1.phase === "ready" && !S.drag && S.tool === "off") {
    K.label(ctx, L.w < 600 ? "Drag or tap the matching RNA nucleotide" : "Drag or tap the RNA nucleotide that pairs with the glowing template base", L.w / 2, L.h - 14, { size: 11, color: C.inkDim });
  }
  if (S.tool !== "off" && !S.picker) {
    K.label(ctx, `${L.w < 600 ? "Tap a DNA base to" : "Mutation tool: tap a DNA base to"} ${S.tool === "sub" ? "substitute it" : S.tool === "ins" ? "insert a base before it" : "delete it"}`, L.w / 2, L.h - 14, { size: 11, color: C.amber });
  }
}

function drawNuc(it, T) {
  const x = it.x + shakeOff(it), y = it.y, r = it.r;
  ctx.globalAlpha = it.alpha;
  for (let k = 0; k < 3; k++) {
    ctx.fillStyle = "#fcd34d";
    ctx.beginPath(); ctx.arc(x - r - 3 - k * 6.5, y - 2 + Math.sin(T * 3 + k + it.ph) * 1.5, 2.8, 0, TAU); ctx.fill();
  }
  K.sphere(ctx, x, y, r, M.BASE_COL[it.b]);
  if (it.shake > 0) { ctx.strokeStyle = C.red; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, TAU); ctx.stroke(); }
  ctx.fillStyle = "#06121f"; ctx.font = "700 13px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(it.b, x, y + 0.5);
  ctx.globalAlpha = 1;
}

function drawExport(L, T, g) {
  const t1 = S.t1, G = g.length;
  const E = t1.phaseT / 3.4;
  const px = L.poreX, py = L.envY;
  const pathPt = (s) => {
    if (s >= 0) return { x: px - 20 - s * 0.9, y: py + 36 + Math.sin(s * 0.09) * 7 };
    if (s >= -40) { const e = -s / 40; return { x: K.lerp(px - 20, px, e), y: K.lerp(py + 36, py, e) }; }
    return { x: px + Math.sin(s * 0.08) * 4, y: py + (s + 40) };
  };
  const pts = [];
  for (let i = 0; i < G; i++) {
    const S0 = { x: L.X0 + (UPL + i) * L.sp - S.cam1.x, y: L.trackY + 16 };
    let p, al = 1;
    if (E < 0.35) { const e = K.easeInOut(E / 0.35); const q = pathPt(i * 9); p = { x: K.lerp(S0.x, q.x, e), y: K.lerp(S0.y, q.y, e) }; }
    else { const s = i * 9 - ((E - 0.35) / 0.65) * (G * 9 + 140); p = pathPt(s); if (s < -40) al = K.clamp(1 + (s + 40) / 30, 0, 1); }
    pts.push({ ...p, al, b: M.toRNA(g[i]) });
  }
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.strokeStyle = "rgba(192,132,252,0.7)"; ctx.lineWidth = 3; ctx.stroke();
  const sz = E < 0.35 ? K.lerp(L.tl, 12, E / 0.35) : 12;
  for (const p of pts) if (p.al > 0.02) tile(p.x, p.y, p.b, sz, { alpha: p.al });
  K.label(ctx, "mRNA exits through the nuclear pore", L.w / 2, L.envY + 70, { size: 11, color: "#e9d5ff" });
}

function pickerTiles(L) {
  const pk = S.picker, out = [];
  const bases = ["A", "T", "G", "C"];
  const x0 = K.clamp(pk.x, 70, L.w - 70);
  bases.forEach((b, k) => out.push({ b, x: x0 + (k - 1.5) * 34, y: pk.y }));
  return out;
}
function drawPicker(L) {
  const tiles = pickerTiles(L);
  const x0 = tiles[0].x - 24, x1 = tiles[3].x + 24, y = tiles[0].y;
  ctx.fillStyle = "rgba(5,11,22,0.92)"; ctx.strokeStyle = C.amber; ctx.lineWidth = 1.5;
  K.roundRect(ctx, x0, y - 36, x1 - x0, 58, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.inkDim; ctx.font = "600 10px Inter, system-ui, sans-serif"; ctx.textAlign = "center";
  ctx.fillText(S.picker.mode === "sub" ? "Change base pair to:" : "Insert base pair:", (x0 + x1) / 2, y - 25);
  for (const t of tiles) tile(t.x, t.y, t.b, 26);
}

function columnAt(p) {
  const L = lay1();
  if (p.y < L.cy - 84 || p.y > L.cy + 56) return -1;
  const j = Math.round((p.x + S.cam1.x - L.X0) / L.sp);
  const gi = j - UPL;
  return gi >= 0 && gi < S.gene.length ? gi : -1;
}

function applyEdit(mode, gi, b) {
  const G = S.gene.length;
  if (mode === "sub") {
    if (S.gene[gi].b === b) return;
    S.gene[gi] = { ...S.gene[gi], b, mut: true };
  } else if (mode === "ins") {
    if (G >= GENE_MAX) { toast("The gene is long enough — try deleting instead."); return; }
    S.gene.splice(gi, 0, { b, mut: true, del: false });
  } else if (mode === "del") {
    if (G <= GENE_MIN) { toast("Can't delete any more bases."); return; }
    const gone = S.gene.splice(gi, 1)[0];
    const next = S.gene[gi];
    if (next) next.del = true;
    void gone;
  }
  beep("ok");
  afterDnaChange();
}

function afterDnaChange() {
  const t1 = S.t1;
  if (t1 && (t1.placed > 0 || t1.phase !== "ready")) toast("DNA changed — transcription restarted with the new sequence.");
  resetAct1();
  S.t2 = null;
  updateLab();
}

// =================================================================== ACT 2 — TRANSLATION
function lay2() {
  const w = stage.w, h = stage.h;
  const u = K.clamp(Math.min(h / 640, w / 640), 0.62, 1.05);
  const s = K.clamp(Math.round(26 * u), 17, 27);
  const ym = h * 0.5;
  let bandTop = ym + 7.9 * s, bandBot = h - 1.7 * s;
  if (bandTop > bandBot) bandTop = bandBot;
  return { w, h, s, ym, X0: 64, ay: ym - 0.98 * s, bandTop, bandBot };
}

function setupAct2(gene) {
  const mrna = M.toRNA(gene), tr = M.translate(mrna);
  S.t2 = {
    gene, mrna, tr, start: tr.start, k: 0, rk: 0, phase: tr.start < 0 ? "nostart" : "init", phaseT: 0,
    bound: [], chain: [], chainOn: null, items: [], large: 0, small: 0, sep: 0, rfBound: false, released: false,
    flash: 0,
  };
  S.cam2.manual = false;
  const L = lay2();
  S.cam2.x = tr.start < 0 ? 0 : L.X0 + (tr.start + 1) * L.s - L.w * 0.5;
  if (tr.start < 0) recordResult(gene);
}

const go2 = (ph) => { S.t2.phase = ph; S.t2.phaseT = 0; S.autoT = 0; };
const aCodon = () => { const t2 = S.t2, i = t2.start + 3 * (t2.k + 1); return i + 3 <= t2.mrna.length ? t2.mrna.slice(i, i + 3) : null; };

function needKey() {
  const t2 = S.t2;
  if (!t2) return null;
  if (t2.phase === "needP") return "AUG";
  if (t2.phase === "needA") return aCodon();
  if (t2.phase === "stop") return "RF";
  return null;
}
const itemKey = (it) => (it.kind === "rf" ? "RF" : it.codon);

function makeTRNA(codon) { return { kind: "trna", codon, anti: M.anticodonOf(codon), aa: M.CODE[codon] }; }

function distractorCodon(need) {
  const all = Object.keys(M.CODE);
  for (let tries = 0; tries < 60; tries++) {
    let c;
    if (need && need !== "RF" && Math.random() < 0.45) {
      const pos = K.randInt(0, 2);
      const nb = K.pick("UCAG".replace(need[pos], "").split(""));
      c = need.slice(0, pos) + nb + need.slice(pos + 1);
    } else c = K.pick(all);
    if (M.CODE[c] === "*") continue;
    if (need && need !== "RF" && M.CODE[c] === M.CODE[need]) continue; // never offer a synonymous (wobble) tRNA as "wrong"
    if (S.t2.items.some((i) => i.codon === c)) continue;
    return c;
  }
  return "GGC";
}

function spawn2(spec) {
  const L = lay2();
  const it = {
    ...spec, x: K.rand(0.08, 0.92) * L.w, y: K.rand(L.bandTop, L.bandBot) + 30, vx: 0, vy: -40,
    ph: K.rand(0, TAU), shake: 0, alpha: 0, leaving: false, fly: null,
  };
  S.t2.items.push(it);
  return it;
}

function maintainPool() {
  const t2 = S.t2, L = lay2();
  if (!t2 || ["nostart", "done", "stall", "release"].includes(t2.phase)) return;
  const target = L.w < 600 ? 4 : 6;
  const need = needKey();
  const active = t2.items.filter((i) => !i.leaving);
  if (need && !active.some((i) => itemKey(i) === need)) {
    if (active.length >= target) {
      const victims = active.filter((i) => !i.fly && i !== S.drag?.item && (need !== "RF" || i.kind !== "rf"));
      if (victims.length) K.pick(victims).leaving = true;
    }
    spawn2(need === "RF" ? { kind: "rf", codon: "RF" } : makeTRNA(need));
  }
  // remove stray release factors when not needed
  if (need !== "RF") t2.items.forEach((i) => { if (i.kind === "rf" && !i.leaving && i !== S.drag?.item) i.leaving = true; });
  const nActive = t2.items.filter((i) => !i.leaving).length;
  if (nActive < target) spawn2(makeTRNA(distractorCodon(need)));
}

function siteTarget(which) {
  const t2 = S.t2, L = lay2();
  const c = which === "P" ? t2.k : t2.k + 1;
  return { x: L.X0 + (t2.start + 3 * c + 1) * L.s - S.cam2.x, y: L.ay };
}

function tryPlace2(it, tapped) {
  const t2 = S.t2;
  const ph = t2.phase;
  if (!["needP", "needA", "stop"].includes(ph)) {
    if (["init", "join", "bond", "shift"].includes(ph)) toast("Wait a moment — the ribosome is busy.");
    return;
  }
  const site = ph === "needP" ? "P" : "A";
  const need = needKey();
  if (itemKey(it) === need) {
    it.fly = { t: 0, dur: tapped ? 0.45 : 0.15, x0: it.x, y0: it.y, target: () => siteTarget(site), done: arrive2 };
    it.ang = 0;
  } else reject2(it, need);
}

function reject2(it, need) {
  it.vx = K.rand(-120, 120); it.vy = 260; it.shake = 0.45;
  S.errors++; beep("buzz");
  let msg;
  if (need === "RF") msg = `✗ No tRNA has an anticodon for the stop codon <strong>${aCodon()}</strong>. A <strong>release factor</strong> protein binds instead.`;
  else if (it.kind === "rf") msg = "✗ Release factors only bind when a <strong>stop codon</strong> is in the A site.";
  else {
    const na = M.anticodonOf(need), aa = M.AA[M.CODE[need]];
    msg = `✗ Anticodon 3′-${it.anti}-5′ pairs with codon ${it.codon}, not <strong>${need}</strong>. You need anticodon <strong>3′-${na}-5′</strong> (carries ${aa[0]}).`;
  }
  toast(msg, 3400);
}

function arrive2(it) {
  const t2 = S.t2, L = lay2();
  const need = needKey();
  if (!need || itemKey(it) !== need) { reject2(it, need); return; }
  t2.items.splice(t2.items.indexOf(it), 1);
  beep("ok");
  if (t2.phase === "needP") {
    t2.bound.push({ c: 0, codon: "AUG", anti: "UAC", aa: "M", charged: false, leave: -1 });
    const ap = aaPos(L, 0);
    t2.chain = [{ a: "M", x: ap.x, y: ap.y, vx: 0, vy: 0 }];
    t2.chainOn = 0;
    go2("join");
  } else if (t2.phase === "needA") {
    t2.bound.push({ c: t2.k + 1, codon: it.codon, anti: it.anti, aa: it.aa, charged: true, leave: -1 });
    go2("bond");
  } else if (t2.phase === "stop") {
    t2.rfBound = true;
    go2("release");
  }
}

function aaPos(L, c) {
  const t2 = S.t2;
  return { x: L.X0 + (t2.start + 3 * c + 1) * L.s + 0.55 * L.s, y: L.ay - 4.55 * L.s };
}

function nextA() {
  const cod = aCodon();
  if (!cod) { go2("stall"); S.t2.items.forEach((i) => (i.leaving = true)); S.t2.released = true; S.t2.chainOn = null; recordResult(S.t2.gene); return; }
  go2(M.CODE[cod] === "*" ? "stop" : "needA");
}

function autoComplete2() {
  const t2 = S.t2;
  if (!t2 || ["nostart", "done", "stall", "release"].includes(t2.phase)) return;
  const L = lay2(), s = L.s, tr = t2.tr;
  const nA = tr.aas.length;
  t2.k = nA - 1; t2.rk = t2.k; t2.large = 1; t2.small = 1;
  t2.bound = [{ c: t2.k, codon: tr.codons[t2.k], anti: M.anticodonOf(tr.codons[t2.k]), aa: tr.aas[t2.k], charged: false, leave: -1 }];
  t2.chainOn = t2.k;
  const ap = aaPos(L, t2.k);
  const rx = L.X0 + (t2.start + 3 * t2.k + 1) * s;
  t2.chain = tr.aas.slice().reverse().map((a, i) => ({ a, x: i < 3 ? ap.x : rx - 0.9 * s - (i - 2) * 0.6 * s, y: ap.y - Math.min(i, 3) * 0.7 * s - Math.max(0, i - 2) * 0.6 * s, vx: 0, vy: 0 }));
  t2.items.forEach((i) => { i.leaving = true; i.fly = null; });
  if (tr.stop) { t2.rfBound = true; go2("release"); }
  else { go2("stall"); t2.released = true; t2.chainOn = null; recordResult(t2.gene); }
  toast("Auto-completed translation.");
}

function update2(dt, rdt, T) {
  const t2 = S.t2, L = lay2(), s = L.s;
  t2.phaseT += dt;
  t2.flash = Math.max(0, t2.flash - dt * 2);
  const ph = t2.phase, e = t2.phaseT;
  if (ph === "init") { t2.small = Math.min(1, e / 1.3); if (e > 1.5) go2("needP"); }
  else if (ph === "join") { t2.large = Math.min(1, e / 0.8); if (e > 0.9) nextA(); }
  else if (ph === "bond") {
    if (e > 0.65) {
      const b = t2.bound.find((q) => q.c === t2.k + 1);
      const ap = aaPos(L, t2.k + 1);
      t2.chain.unshift({ a: b.aa, x: ap.x, y: ap.y, vx: 0, vy: 0 });
      b.charged = false; t2.chainOn = t2.k + 1; t2.flash = 1;
      beep("bond");
      go2("shift");
    }
  } else if (ph === "shift") {
    t2.rk = t2.k + K.easeInOut(Math.min(1, e / 0.7));
    if (e >= 0.7) {
      t2.k++; t2.rk = t2.k;
      const old = t2.bound.find((q) => q.c === t2.k - 1 && q.leave < 0);
      if (old) old.leave = 0;
      nextA();
    }
  } else if (ph === "release") {
    if (e > 0.6 && !t2.released) { t2.released = true; t2.chainOn = null; }
    t2.sep = smooth(1.0, 2.3, e);
    if (e > 2.4) {
      t2.items.forEach((i) => (i.leaving = true));
      go2("done"); t2.rfBound = false; t2.bound = []; t2.large = 0; t2.small = 0;
      S.flags.translated = true;
      recordResult(t2.gene);
      toast(`Polypeptide complete: ${t2.chain.length} amino acids.`);
    }
  }
  for (const b of t2.bound) if (b.leave >= 0) b.leave += dt / 1.3;
  t2.bound = t2.bound.filter((b) => b.leave < 1);

  // camera
  if (t2.start >= 0) {
    const n = t2.mrna.length;
    const maxCam = L.X0 + n * s + 60 - L.w;
    if (!S.cam2.manual && t2.phase !== "done") {
      const rxW = L.X0 + (t2.start + 3 * t2.rk + 1) * s + 1.5 * s;
      S.cam2.x += (rxW - L.w * 0.5 - S.cam2.x) * Math.min(1, rdt * 3);
    }
    S.cam2.x = K.clamp(S.cam2.x, -L.w * 0.3, Math.max(-L.w * 0.3, maxCam));
  }
  // free items
  maintainPool();
  for (const it of t2.items) {
    if (it === S.drag?.item) continue;
    if (it.fly) { stepFly(it, dt); continue; }
    if (it.leaving) { it.alpha -= dt * 2.5; it.y += 30 * dt; continue; }
    it.alpha = Math.min(1, it.alpha + dt * 2.5);
    if (it.shake > 0) it.shake -= dt;
    K.brownian(it, dt, 60, 0.93);
    if (it.y < L.bandTop) it.y += (L.bandTop - it.y) * Math.min(1, dt * 2.5);
    if (it.y > L.bandBot) it.y += (L.bandBot - it.y) * Math.min(1, dt * 4);
    const mx = 1.9 * s;
    if (it.x < mx) it.x += (mx - it.x) * Math.min(1, dt * 3);
    if (it.x > L.w - mx) it.x += (L.w - mx - it.x) * Math.min(1, dt * 3);
  }
  t2.items = t2.items.filter((i) => !(i.leaving && i.alpha <= 0));
  const act = t2.items.filter((i) => !i.fly && !i.leaving && i !== S.drag?.item);
  const minD = 3.9 * s;
  for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) {
    const a = act[i], b = act[j];
    const d = Math.abs(b.x - a.x);
    if (d < minD) { const f = (minD - d) * 0.5 * Math.min(1, dt * 6) * (b.x >= a.x ? 1 : -1); a.x -= f; b.x += f; }
  }
  stepChain(dt, L, T);
}

function stepChain(dt, L, T) {
  const t2 = S.t2, s = L.s, ch = t2.chain;
  if (!ch.length || dt === 0) return;
  const bl = s * 1.05;
  const Rx = L.X0 + (t2.start + 3 * t2.rk + 1) * s;
  const exit = { x: Rx - 0.9 * s, y: L.ym - 6.3 * s };
  let anchor = null;
  if (t2.chainOn !== null) {
    const b = t2.bound.find((q) => q.c === t2.chainOn);
    anchor = aaPos(L, t2.chainOn);
    if (b && b.leave >= 0) anchor = null;
    if (t2.phase === "bond" && anchor) {
      const e = K.easeInOut(Math.min(1, t2.phaseT / 0.6));
      const to = aaPos(L, t2.k + 1);
      anchor = { x: K.lerp(anchor.x, to.x - 0.3 * s, e), y: K.lerp(anchor.y, to.y - 0.9 * s, e) };
    }
  }
  const cam = S.cam2.x;
  const fold = t2.released ? 10 : 7;
  const home = { x: cam + L.w * 0.5, y: Math.max(chipH + 50, L.ym - 7 * s) };
  for (let i = 0; i < ch.length; i++) {
    const b = ch[i];
    let pin = null;
    if (anchor) {
      if (i === 0) pin = anchor;
      else if (i === 1) pin = { x: (anchor.x + exit.x) / 2, y: (anchor.y + exit.y) / 2 - 0.2 * s };
      else if (i === 2) pin = exit;
    }
    if (pin) { const k = Math.min(1, dt * 10); b.x += (pin.x - b.x) * k; b.y += (pin.y - b.y) * k; b.vx = b.vy = 0; b.pin = true; continue; }
    b.pin = false;
    if (t2.released) {
      // drift towards a resting spot in open cytoplasm and fold there
      b.vx += (home.x - b.x) * 0.8 * dt; b.vy += (home.y - b.y) * 0.8 * dt;
    } else { b.vy -= 26 * dt; b.vx -= 8 * dt; }
    b.vx += K.rand(-1, 1) * 70 * dt; b.vy += K.rand(-1, 1) * 70 * dt;
    if (i >= 3) {
      const o = ch[i - 3];
      const d = K.dist(b.x, b.y, o.x, o.y) || 1, rest = bl * 1.5;
      const f = (d - rest) * fold * dt;
      b.vx -= ((b.x - o.x) / d) * f; b.vy -= ((b.y - o.y) / d) * f;
    }
    // soft bounds: stay above the ribosome / inside the view
    const top = chipH + 24, bottom = L.ym - (t2.released && t2.phase === "done" ? 2 * s : 6.6 * s);
    if (b.y < top) b.vy += (top - b.y) * 6 * dt;
    if (b.y > bottom && i >= 3) b.vy -= (b.y - bottom) * 6 * dt;
    if (b.x - cam < 14) b.vx += (14 - (b.x - cam)) * 6 * dt;
    if (b.x - cam > L.w - 14) b.vx -= ((b.x - cam) - (L.w - 14)) * 6 * dt;
    const damp = Math.pow(0.9, dt * 60);
    b.vx *= damp; b.vy *= damp;
    b.x += b.vx * dt; b.y += b.vy * dt;
  }
  for (let it = 0; it < 4; it++) {
    for (let i = 1; i < ch.length; i++) {
      const a = ch[i - 1], b = ch[i];
      const d = K.dist(a.x, a.y, b.x, b.y) || 0.001;
      const diff = (d - bl) / d;
      const wa = a.pin ? 0 : b.pin ? 1 : 0.5, wb = b.pin ? 0 : a.pin ? 1 : 0.5;
      a.x += (b.x - a.x) * diff * wa; a.y += (b.y - a.y) * diff * wa;
      b.x -= (b.x - a.x) * diff * wb; b.y -= (b.y - a.y) * diff * wb;
    }
    for (let i = 0; i < ch.length; i++) for (let j = i + 2; j < ch.length; j++) {
      const a = ch[i], b = ch[j];
      const d = K.dist(a.x, a.y, b.x, b.y), m = bl * 0.95;
      if (d > 0.001 && d < m) {
        const f = (m - d) / d * 0.5;
        if (!a.pin) { a.x -= (b.x - a.x) * f; a.y -= (b.y - a.y) * f; }
        if (!b.pin) { b.x += (b.x - a.x) * f; b.y += (b.y - a.y) * f; }
      }
    }
  }
}

function drawTRNA(x, y, s, o = {}) {
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.translate(x, y);
  if (o.ang) ctx.rotate(o.ang);
  if (o.hl) K.glow(ctx, 0, -2.2 * s, 3.2 * s, C.teal, 0.25);
  const body = "#ec6fae", rim = "#ffd1e8";
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  // acceptor stem + CCA tail
  ctx.strokeStyle = body; ctx.lineWidth = 0.5 * s;
  ctx.beginPath(); ctx.moveTo(0.2 * s, -2.9 * s); ctx.lineTo(0.25 * s, -3.75 * s); ctx.stroke();
  ctx.lineWidth = 0.18 * s; ctx.beginPath(); ctx.moveTo(0.25 * s, -3.75 * s); ctx.lineTo(0.5 * s, -4.1 * s); ctx.stroke();
  // anticodon stem
  ctx.lineWidth = 0.55 * s; ctx.beginPath(); ctx.moveTo(0, -0.7 * s); ctx.lineTo(0, -2.3 * s); ctx.stroke();
  // anticodon loop (open at the bottom where the bases face the codon)
  ctx.lineWidth = 0.28 * s;
  ctx.beginPath(); ctx.moveTo(-1.55 * s, 0.05 * s); ctx.lineTo(-1.55 * s, -0.45 * s); ctx.quadraticCurveTo(-1.55 * s, -0.75 * s, -1.1 * s, -0.75 * s);
  ctx.lineTo(1.1 * s, -0.75 * s); ctx.quadraticCurveTo(1.55 * s, -0.75 * s, 1.55 * s, -0.45 * s); ctx.lineTo(1.55 * s, 0.05 * s); ctx.stroke();
  // central body with D-arm and TΨC-arm lobes (cloverleaf, simplified)
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(0, -2.6 * s, 1.15 * s, 0.6 * s, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(-1.45 * s, -2.8 * s, 0.52 * s, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(1.45 * s, -2.8 * s, 0.52 * s, 0, TAU); ctx.fill();
  ctx.strokeStyle = K.withAlpha(rim, 0.6); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(0, -2.6 * s, 1.15 * s, 0.6 * s, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  ctx.fillStyle = "rgba(60,10,40,0.35)";
  ctx.beginPath(); ctx.arc(-1.45 * s, -2.8 * s, 0.22 * s, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(1.45 * s, -2.8 * s, 0.22 * s, 0, TAU); ctx.fill();
  // anticodon bases
  if (o.anti) for (let i = 0; i < 3; i++) tile((i - 1) * s, 0, o.anti[i], 0.8 * s);
  // amino acid
  if (o.aa) {
    const ax = 0.55 * s, ay = -4.55 * s, r = 0.58 * s;
    K.sphere(ctx, ax, ay, r, M.aaCol(o.aa));
    ctx.fillStyle = "#06121f"; ctx.font = `700 ${Math.max(7, Math.round(0.4 * s))}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(M.AA[o.aa][0], ax, ay + 0.5);
  }
  ctx.restore();
}

function drawRF(x, y, s, o = {}) {
  ctx.save(); ctx.globalAlpha = o.alpha ?? 1; ctx.translate(x, y); if (o.ang) ctx.rotate(o.ang);
  if (o.hl) K.glow(ctx, 0, -2.2 * s, 3.2 * s, C.amber, 0.3);
  K.blob(ctx, 0, -2.3 * s, 2.6 * s, 4.2 * s, "#f59e0b", 1.1 * s);
  K.blob(ctx, 0, -0.1 * s, 3.0 * s, 0.9 * s, "#d97706", 0.4 * s);
  ctx.fillStyle = "#1c0f02"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.round(0.6 * s)}px Inter, system-ui, sans-serif`; ctx.fillText("RF", 0, -2.6 * s);
  ctx.font = `600 ${Math.max(7, Math.round(0.32 * s))}px Inter, system-ui, sans-serif`;
  ctx.fillText("release", 0, -1.9 * s); ctx.fillText("factor", 0, -1.5 * s);
  ctx.restore();
}

function drawItem2(it, s, T) {
  const x = it.x + shakeOff(it);
  const ang = it.fly || it === S.drag?.item ? 0 : Math.sin(T * 0.9 + it.ph) * 0.12;
  const o = { alpha: it.alpha, ang, hl: it === S.drag?.item };
  if (it.kind === "rf") drawRF(x, it.y, s, o);
  else drawTRNA(x, it.y, s, { ...o, anti: it.anti, aa: it.aa });
  if (it.shake > 0) { ctx.strokeStyle = C.red; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, it.y - 2.2 * s, 2.6 * s, 0, TAU); ctx.stroke(); }
}

function draw2(T) {
  const t2 = S.t2, L = lay2(), s = L.s, cam = S.cam2.x;
  const { ym, ay } = L;
  K.backdrop(ctx, L.w, L.h, "#0d3b44");
  drawFar(cam, T, "#9be7df", "#1f7a74");
  K.label(ctx, "Cytoplasm", L.w - 10, chipH + 26, { align: "right", size: 10, color: C.inkDim });
  const X = (i) => L.X0 + i * s - cam;
  const n = t2.mrna.length, tr = t2.tr;
  const hasRib = t2.start >= 0 && t2.phase !== "done";
  const Rx = L.X0 + (t2.start + 3 * t2.rk + 1) * s - cam;
  const ease = K.easeInOut;

  // small subunit
  if (hasRib && t2.small > 0) {
    const xo = -(1 - ease(t2.small)) * 6 * s;
    ctx.save(); ctx.globalAlpha = Math.min(1, t2.small * 1.5) * (1 - t2.sep);
    const sy = ym + 1.3 * s + t2.sep * 2 * s;
    const g = ctx.createLinearGradient(0, sy - 1.3 * s, 0, sy + 1.3 * s);
    g.addColorStop(0, "rgba(120,150,235,0.55)"); g.addColorStop(1, "rgba(50,70,160,0.55)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(Rx + xo, sy, 5 * s, 1.3 * s, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(190,210,255,0.5)"; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
  }
  // mRNA
  const i0 = Math.max(0, Math.floor((cam - L.X0) / s) - 2), i1 = Math.min(n - 1, Math.ceil((cam + L.w - L.X0) / s) + 2);
  if (tr.start >= 0) {
    tr.codons.forEach((cod, c) => {
      const x = X(t2.start + 3 * c) - 0.5 * s;
      if (x > L.w || x + 3 * s < 0) return;
      ctx.fillStyle = c === 0 ? "rgba(74,222,128,0.18)" : M.CODE[cod] === "*" ? "rgba(248,113,113,0.2)" : c % 2 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.1)";
      K.roundRect(ctx, x + 1, ym - 0.6 * s, 3 * s - 2, 1.2 * s, 5); ctx.fill();
      if (c <= t2.k && t2.phase !== "init" && t2.phase !== "needP" && M.CODE[cod] !== "*") {
        ctx.fillStyle = M.aaCol(M.CODE[cod]); ctx.font = `600 ${Math.max(8, Math.round(0.36 * s))}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.globalAlpha = hasRib ? 0.0 : 0.9; // hidden under the ribosome; shown after release
        ctx.fillText(M.AA[M.CODE[cod]][0], x + 1.5 * s, ym + 1.0 * s);
        ctx.globalAlpha = 1;
      }
    });
  }
  ctx.beginPath(); ctx.moveTo(X(0) - 0.4 * s, ym + 0.62 * s); ctx.lineTo(X(n - 1) + 0.4 * s, ym + 0.62 * s);
  ctx.strokeStyle = "#c084fc"; ctx.lineWidth = 4; ctx.stroke();
  for (let i = i0; i <= i1; i++) {
    const inOrf = tr.start >= 0 && i >= tr.start && i < tr.end;
    tile(X(i), ym, t2.mrna[i], 0.8 * s, { alpha: inOrf ? 1 : 0.55 });
  }
  K.label(ctx, "5′", X(0) - 0.9 * s, ym, { size: 10, color: "#e9d5ff" });
  K.label(ctx, "3′", X(n - 1) + 0.9 * s, ym, { size: 10, color: "#e9d5ff" });
  K.label(ctx, "mRNA", X(0) - 0.9 * s, ym - 1.3 * s, { size: 10, color: "#e9d5ff" });

  // large subunit (fill behind tRNAs)
  const lgOn = hasRib && t2.large > 0;
  const lgY = ym - 3.05 * s - (1 - ease(Math.min(1, t2.large))) * 3 * s - t2.sep * 3 * s;
  const lgA = Math.min(1, t2.large) * (1 - t2.sep);
  if (lgOn) {
    ctx.save(); ctx.globalAlpha = lgA;
    const g = ctx.createRadialGradient(Rx - 2 * s, lgY - 1.5 * s, s, Rx, lgY, 5.6 * s);
    g.addColorStop(0, "rgba(150,175,255,0.30)"); g.addColorStop(1, "rgba(70,95,200,0.20)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(Rx, lgY, 5.4 * s, 3.2 * s, 0, 0, TAU); ctx.fill();
    // site pockets
    const target = t2.phase === "needP" ? 1 : (t2.phase === "needA" || t2.phase === "stop") ? 2 : -9;
    ["E", "P", "A"].forEach((nm, k) => {
      const px = Rx + (k - 1) * 3 * s;
      ctx.fillStyle = "rgba(0,0,0,0.14)";
      K.roundRect(ctx, px - 1.42 * s, lgY - 2.6 * s, 2.84 * s, 4.75 * s, 0.6 * s); ctx.fill();
      if (k === target) {
        const pulse = 0.5 + 0.5 * Math.sin(T * 5);
        ctx.strokeStyle = K.withAlpha(t2.phase === "stop" ? C.amber : C.teal, 0.5 + 0.5 * pulse); ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
        K.roundRect(ctx, px - 1.42 * s, lgY - 2.6 * s, 2.84 * s, 4.75 * s, 0.6 * s); ctx.stroke(); ctx.setLineDash([]);
      }
    });
    // exit tunnel
    ctx.fillStyle = "rgba(5,11,22,0.55)"; ctx.beginPath(); ctx.ellipse(Rx - 0.9 * s, lgY - 3.05 * s, 0.7 * s, 0.3 * s, 0, 0, TAU); ctx.fill();
    ctx.restore();
  } else if (hasRib && t2.phase === "needP") {
    const px = Rx;
    const pulse = 0.5 + 0.5 * Math.sin(T * 5);
    ctx.strokeStyle = K.withAlpha(C.teal, 0.5 + 0.5 * pulse); ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    K.roundRect(ctx, px - 1.42 * s, ay - 5.1 * s, 2.84 * s, 5.8 * s, 0.6 * s); ctx.stroke(); ctx.setLineDash([]);
  }
  // bound tRNAs
  for (const b of t2.bound) {
    const e = b.leave >= 0 ? ease(Math.min(1, b.leave)) : 0;
    const x = L.X0 + (t2.start + 3 * b.c + 1) * s - cam - e * 2.5 * s;
    const y = ay - e * 5 * s;
    const al = (1 - e) * (t2.phase === "release" ? 1 - t2.sep : 1);
    drawTRNA(x, y, s, { anti: b.anti, aa: b.charged ? b.aa : null, alpha: al, ang: -e * 0.5 });
    if (b.charged && t2.phase === "bond") K.glow(ctx, x + 0.55 * s, y - 4.55 * s, 1.6 * s, C.amber, 0.4);
  }
  if (t2.rfBound) drawRF(L.X0 + (t2.start + 3 * (t2.k + 1) + 1) * s - cam, ay, s, { alpha: 1 - t2.sep });
  // large subunit rim (over tRNAs)
  if (lgOn) {
    ctx.save(); ctx.globalAlpha = lgA;
    ctx.strokeStyle = "rgba(200,215,255,0.55)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(Rx, lgY, 5.4 * s, 3.2 * s, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  // site letters
  if (hasRib && t2.small > 0.6 && t2.sep < 0.5) {
    ["E", "P", "A"].forEach((nm, k) => K.label(ctx, nm + " site", Rx + (k - 1) * 3 * s, ym + 3.1 * s, { size: 10, color: nm === "A" ? C.teal : nm === "P" ? C.violet : C.inkDim }));
    if (lgOn) K.label(ctx, "Ribosome", Rx + 4.4 * s, lgY - 3.1 * s, { size: 10, color: "#c7d2fe" });
  }
  // peptide bond flash
  if (t2.flash > 0) K.glow(ctx, aaPos(L, t2.chainOn ?? t2.k).x - cam, aaPos(L, t2.chainOn ?? t2.k).y, 2.5 * s, C.amber, 0.6 * t2.flash);
  // chain
  drawChain(L, cam);
  // free items
  for (const it of t2.items) if (it !== S.drag?.item) drawItem2(it, s, T);
  if (S.drag?.item) drawItem2(S.drag.item, s, T);

  const narrow = L.w < 600;
  if (t2.phase === "needP" && !S.drag) K.label(ctx, narrow ? "Drag Met-tRNA (UAC) to the P site" : "Drag the tRNA with anticodon UAC (carrying Met) into the P site", L.w / 2, L.h - 10, { size: 11, color: C.inkDim });
  else if (t2.phase === "needA" && !S.drag) K.label(ctx, narrow ? `A site codon ${aCodon()}: drag the matching tRNA` : `A site codon: ${aCodon()} — drag the tRNA with the matching anticodon`, L.w / 2, L.h - 10, { size: 11, color: C.inkDim });
  else if (t2.phase === "stop" && !S.drag) K.label(ctx, narrow ? `Stop codon ${aCodon()}: drag the release factor` : `Stop codon ${aCodon()} — drag the release factor into the A site`, L.w / 2, L.h - 10, { size: 11, color: C.amber });
  if (t2.phase === "nostart") {
    K.label(ctx, "No AUG start codon in this mRNA — translation cannot begin", L.w / 2, ym - 4 * s, { size: 13, color: C.red });
  }
  if (["done", "stall", "nostart"].includes(t2.phase)) {
    S.cbtn = { ...canvasButton(L.w / 2, Math.min(L.h - 30, L.bandTop + 10), "Edit the DNA (mutation lab) ←"), act: () => { setAct(1); setTool("sub"); } };
  }
}

function drawChain(L, cam) {
  const ch = S.t2.chain, s = L.s;
  if (!ch.length) return;
  ctx.strokeStyle = "rgba(230,240,255,0.55)"; ctx.lineWidth = Math.max(2, 0.16 * s); ctx.lineCap = "round";
  ctx.beginPath(); ch.forEach((b, i) => (i ? ctx.lineTo(b.x - cam, b.y) : ctx.moveTo(b.x - cam, b.y))); ctx.stroke();
  const r = 0.52 * s;
  ctx.font = `700 ${Math.max(7, Math.round(0.4 * s))}px Inter, system-ui, sans-serif`;
  for (let i = ch.length - 1; i >= 0; i--) {
    const b = ch[i];
    K.sphere(ctx, b.x - cam, b.y, r, M.aaCol(b.a));
    ctx.fillStyle = "#06121f"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(M.AA[b.a][0], b.x - cam, b.y + 0.5);
  }
  if (ch.length > 1) {
    const nT = ch[ch.length - 1];
    K.label(ctx, "N-terminus", nT.x - cam, nT.y - r - 10, { size: 9, color: C.inkDim });
  }
}

// =================================================================== results / mutation lab
function recordResult(gene) {
  const cls = M.classify(M.ORIGINAL_GENE, gene);
  S.lastResult = { gene, cls };
  if (cls.kind === "silent") S.flags.silent = true;
  if (cls.kind === "nonsense") S.flags.nonsense = true;
  if (cls.kind === "frameshift") S.flags.frameshift = true;
  if (gene === M.SICKLE_GENE) { S.flags.sickle = true; toast("🩸 That's the sickle-cell mutation: Glu → Val at position 6 of β-globin.", 4000); }
  updateLab();
}

function protHTML(tr, ref) {
  if (tr.start < 0) return `<span class="none">— no protein (no start codon) —</span>`;
  const parts = tr.aas.map((a, i) => {
    const diff = ref && (ref.aas[i] !== a);
    return `<span class="aa${diff ? " diff" : ""}" style="background:${M.aaCol(a)}" title="${M.AA[a][1]}">${M.AA[a][0]}</span>`;
  });
  if (tr.stop) parts.push(`<span class="aa${ref && ref.aas.length !== tr.aas.length ? " diff" : ""}" style="background:${M.CLASS_COL.stop}">STOP</span>`);
  else parts.push(`<span class="none">(no stop codon)</span>`);
  return parts.join("");
}

let labKey = "";
function updateLab() {
  const g = geneStr();
  const key = g + "|" + (S.lastResult ? S.lastResult.gene : "") + "|" + S.gene.map((n) => (n.mut ? 1 : 0) + (n.del ? 2 : 0)).join("");
  if (key === labKey) return;
  labKey = key;
  const oTr = M.translate(M.toRNA(M.ORIGINAL_GENE)), mTr = M.translate(M.toRNA(g));
  const cls = M.classify(M.ORIGINAL_GENE, g);
  const observed = S.lastResult && S.lastResult.gene === g;
  const dna = S.gene.map((nd, i) => {
    const sep = i > 0 && i % 3 === 0 ? " " : "";
    const del = nd.del ? `<mark title="deletion here">▾</mark>` : "";
    return sep + del + (nd.mut ? `<mark>${nd.b}</mark>` : nd.b);
  }).join("");
  labOut.innerHTML = `
    <div><span class="row-lbl">Coding strand (5′→3′)</span><div class="dna-diff">${dna}</div></div>
    <div><span class="row-lbl">Original polypeptide</span><div class="prot">${protHTML(oTr)}</div></div>
    <div><span class="row-lbl">Your DNA's polypeptide</span><div class="prot">${protHTML(mTr, oTr)}</div></div>
    <div><span class="badge k-${cls.kind}">${cls.title}</span></div>
    <div style="color:var(--ink-dim)">${cls.detail}${g === M.SICKLE_GENE ? " This is the <strong>sickle-cell</strong> mutation (HbS): hydrophobic valine replaces charged glutamic acid, so deoxygenated haemoglobin molecules stick together into long fibres and red blood cells become sickle-shaped." : ""}</div>
    <div class="status ${observed ? "ok" : ""}">${cls.kind === "none" ? "Tap DNA bases in Act 1 with a mutation tool to change the gene." : observed ? "✓ Observed: the ribosome built this polypeptide." : "Prediction only — press <strong>Run it</strong> (or transcribe and translate yourself) to test it."}</div>`;
}

// =================================================================== UI
const explain = K.card(panel, "What's happening", "explain");
const exDyn = document.createElement("div");
explain.appendChild(exDyn);
const exNote = document.createElement("p");
exNote.className = "seq-note";
exNote.innerHTML = "Simplified fragment inspired by the start of the human <strong>β-globin</strong> gene (first 9 codons plus an added stop codon). Codons are numbered from the amino acid after the starting Met, as in haemoglobin. Not to scale: the TATA box really sits ~25–30 bases upstream, and real polymerases and ribosomes are larger.";
explain.appendChild(exNote);

const controls = K.card(panel, "Controls");
const actSeg = K.segmented(controls, [{ value: 1, label: "1 · Transcription" }, { value: 2, label: "2 · Translation" }], 1, (v) => setAct(v));
const row1 = K.buttonRow(controls);
const autoBtn = K.button(row1, "▶ Auto (watch)", (on) => { S.auto = on; S.autoT = 0; if (on) toast("Auto mode: sit back and watch."); }, { toggle: true });
K.button(row1, "⏭ Auto-complete", () => (S.act === 1 ? autoComplete1() : autoComplete2()));
K.button(row1, "Genetic code table", openCode);
const row2 = K.buttonRow(controls);
const pauseBtn = K.button(row2, "Pause", () => { pauseBtn.textContent = LOOP.toggle() ? "Pause" : "Play"; });
K.button(row2, "Reset act", () => {
  if (S.act === 1) resetAct1(); else setupAct2(S.t2 ? S.t2.gene : geneStr());
});
const initSpeed = reduced ? 0.75 : 1;
K.slider(controls, { label: "Speed", min: 0.25, max: 3, step: 0.25, value: initSpeed, format: (v) => `${v}×`, onInput: (v) => (LOOP.speed = v) });
K.checkbox(controls, "Sound effects", true, (v) => (S.sound = v));

const lab = K.card(panel, "Mutation lab");
lab.insertAdjacentHTML("beforeend", "<p>Pick a tool, then tap a base pair on the DNA in <strong>Act 1</strong>. Changing DNA restarts transcription. Then <strong>Run it</strong> to see what the ribosome makes.</p>");
const toolSeg = K.segmented(lab, [{ value: "off", label: "Off" }, { value: "sub", label: "Substitute" }, { value: "ins", label: "Insert" }, { value: "del", label: "Delete" }], "off", (v) => setTool(v));
const row3 = K.buttonRow(lab);
K.button(row3, "Run it ▶", () => {
  setAct(1); resetAct1();
  S.auto = true; S.autoT = 0; autoBtn.setAttribute("aria-pressed", "true");
  toast("Running: transcription then translation. Raise the speed or use Auto-complete to skip ahead.", 3200);
}, { kind: "primary" });
K.button(row3, "Restore original DNA", () => {
  S.gene = M.ORIGINAL_GENE.split("").map((b) => ({ b, mut: false, del: false }));
  afterDnaChange();
});
const labOut = document.createElement("div");
labOut.className = "lab-out";
lab.appendChild(labOut);

const legend = K.card(panel, "Legend");
legend.insertAdjacentHTML("beforeend", `<div class="legend">
  <span><i style="background:${M.BASE_COL.A}"></i>A adenine</span>
  <span><i style="background:${M.BASE_COL.T}"></i>T thymine (DNA only)</span>
  <span><i style="background:${M.BASE_COL.G}"></i>G guanine</span>
  <span><i style="background:${M.BASE_COL.C}"></i>C cytosine</span>
  <span><i style="background:${M.BASE_COL.U}"></i>U uracil (RNA only)</span>
  <span><i style="background:#fcd34d"></i>phosphates (NTP)</span>
  <span><i style="background:${M.CLASS_COL.np}"></i>non-polar amino acid</span>
  <span><i style="background:${M.CLASS_COL.pol}"></i>polar amino acid</span>
  <span><i style="background:${M.CLASS_COL.acid}"></i>acidic (−) amino acid</span>
  <span><i style="background:${M.CLASS_COL.base}"></i>basic (+) amino acid</span>
  <span><i style="background:#ec6fae"></i>tRNA</span>
  <span><i style="background:#6d8fe8"></i>ribosome</span>
</div>`);

const missionsApi = K.missions(panel, [
  { text: "Transcribe the whole gene into mRNA", check: () => S.flags.transcribed },
  { text: "Translate the mRNA all the way to the stop codon", check: () => S.flags.translated },
  { text: "Make a <strong>silent</strong> mutation and run it", check: () => S.flags.silent },
  { text: "Make a <strong>nonsense</strong> mutation (early stop) and run it", check: () => S.flags.nonsense },
  { text: "Cause a <strong>frameshift</strong> by inserting or deleting a base, and run it", check: () => S.flags.frameshift },
  { text: "Reproduce the <strong>sickle-cell</strong> substitution: codon 6 GAG → GTG", check: () => S.flags.sickle },
], (m) => toast(`Mission complete: ${m.text}`));

K.quiz(panel, [
  { q: "In DNA, adenine pairs with thymine. When RNA polymerase reads an <strong>A</strong> on the template strand, which base does it add to the mRNA?",
    options: ["Thymine (T)", "Uracil (U)", "Adenine (A)", "Guanine (G)"], answer: 1,
    why: "RNA contains uracil instead of thymine, so template A pairs with U. (G–C pairing is the same in DNA and RNA.)" },
  { q: "In a eukaryotic cell, where do transcription and translation happen?",
    options: ["Both in the nucleus", "Transcription in the cytoplasm, translation in the nucleus", "Transcription in the nucleus, translation at ribosomes in the cytoplasm", "Both at ribosomes"], answer: 2,
    why: "DNA stays in the nucleus, where mRNA is made. The mRNA leaves through nuclear pores and is translated by ribosomes in the cytoplasm (free or on rough ER)." },
  { q: "An mRNA codon reads 5′-GAG-3′. Which tRNA anticodon pairs with it?",
    options: ["3′-CTC-5′", "3′-CUC-5′", "3′-GAG-5′", "3′-GUG-5′"], answer: 1,
    why: "Anticodons are complementary and antiparallel to codons, and tRNA is RNA so it uses U, not T: G↔C, A↔U, G↔C gives 3′-CUC-5′ (carrying Glu)." },
  { q: "Which statement about start and stop codons is correct?",
    options: ["AUG starts translation and codes for Met; UAA, UAG and UGA stop it", "UAA starts translation; AUG stops it", "Stop codons are read by tRNAs carrying a 'stop' amino acid", "Every codon can start translation"], answer: 0,
    why: "AUG is the start codon (Met). Stop codons have no matching tRNA — a release factor binds instead and the polypeptide is released." },
  { q: "Why is a frameshift (inserting or deleting one base) usually more harmful than a single substitution?",
    options: ["It changes only one amino acid", "It shifts the reading frame, so every codon after it is read differently and a stop codon often appears early", "It stops transcription completely", "It always produces a silent mutation"], answer: 1,
    why: "Codons are read in groups of three from the start codon. Adding or removing one base changes every following triplet, scrambling the rest of the protein and often creating an early stop." },
  { q: "Sickle-cell anaemia is caused by GAG → GTG in codon 6 of the β-globin gene. What type of mutation is this?",
    options: ["Silent", "Nonsense", "Missense (substitution)", "Frameshift"], answer: 2,
    why: "One base is substituted, changing one amino acid (Glu → Val). The protein is full length, but the hydrophobic valine makes haemoglobin molecules clump when oxygen is low." },
]);

// chips
const chipAct = K.chip(overlay), chipCodon = K.chip(overlay), chipAA = K.chip(overlay), chipErr = K.chip(overlay);
function updateChips() {
  chipAct(`Act <b>${S.act === 1 ? "1 · Transcription" : "2 · Translation"}</b>`);
  if (S.act === 1) {
    const G = S.gene.length, tr = curTr();
    const nC = tr.start >= 0 ? tr.codons.length : Math.ceil(G / 3);
    const pl = S.t1.placed;
    const c = tr.start >= 0 ? K.clamp(Math.floor((pl - tr.start) / 3) + 1, 1, nC) : Math.min(Math.floor(pl / 3) + 1, nC);
    chipCodon(pl >= G ? `mRNA <b>${G} nt</b> complete` : `Codon <b>${c}/${nC}</b> · nt <b>${pl}/${G}</b>`);
  } else {
    const t2 = S.t2, nC = t2.tr.codons.length;
    const pos = ["init", "needP", "join", "nostart"].includes(t2.phase) ? 1 : Math.min(t2.k + 2, nC);
    chipCodon(t2.start < 0 ? "No start codon" : `A-site codon <b>${pos}/${nC}</b>`);
  }
  const nAA = S.t2 ? S.t2.chain.length : 0;
  chipAA(`Amino acids joined <b>${nAA}</b>`);
  chipErr(`Errors <b>${S.errors}</b>`);
}

// explain text
let exKey = "";
function explainHTML() {
  if (S.act === 1) {
    const t1 = S.t1, G = S.gene.length, pl = t1.placed;
    const n = S.gene[pl];
    const tb = n ? M.DNA_PAIR[n.b] : "";
    switch (t1.phase) {
      case "ready":
        return [`ready${G}`, `<p><strong>RNA polymerase</strong> has bound to the <strong>promoter</strong> (TATA box region) and unwound the start of the gene. The lower DNA strand is the <strong>template strand</strong>.</p>
          <p>Drag or tap the free <strong>RNA nucleotide</strong> that pairs with the glowing template base <strong>${tb}</strong>. RNA pairing: template A → <strong>U</strong>, T → A, G → C, C → G. RNA uses <strong>uracil (U)</strong>, never thymine (T).</p>`];
      case "elong":
        return [`el${pl}`, `<p>Transcribing: <strong>${pl} of ${G}</strong> nucleotides joined. Next template base: <strong>${tb}</strong> — which RNA base pairs with it?</p>
          <p>RNA polymerase reads the template <strong>3′→5′</strong> and builds mRNA <strong>5′→3′</strong>. Each nucleotide arrives with three phosphates; two are released to power the new bond. Behind the polymerase the mRNA peels away and the DNA rewinds. The mRNA matches the <strong>coding strand</strong>, with U in place of T.</p>`];
      case "term":
        return ["term", `<p>RNA polymerase has passed the end of the gene and reached the <strong>terminator</strong>. It lets go of the DNA, which zips back into a double helix, and releases the new mRNA (${G} nucleotides).</p>`];
      case "export":
      case "exported":
        return [t1.phase, `<p>The mRNA leaves the nucleus through a <strong>nuclear pore</strong>. The DNA itself never leaves the nucleus — only the copy does.${t1.phase === "exported" ? " Now switch to <strong>Act 2 · Translation</strong>." : ""}</p>
          <p><em>Note:</em> in eukaryotes the first copy (<strong>pre-mRNA</strong>) is <strong>processed</strong> before export: a 5′ cap and a poly-A tail are added, and <strong>introns are spliced out</strong> so only the exons remain. That step isn't shown here.</p>`];
    }
  }
  const t2 = S.t2;
  const cod = aCodon();
  const chainTxt = t2.chain.length ? t2.chain.slice().reverse().map((b) => M.AA[b.a][0]).join("–") : "";
  switch (t2.phase) {
    case "nostart":
      return ["ns", `<p>This mRNA has <strong>no AUG start codon</strong>, so a ribosome cannot begin translation and <strong>no polypeptide is made</strong>. Go back to Act 1 and change the DNA.</p>`];
    case "init":
      return ["init", `<p>The <strong>small ribosomal subunit</strong> attaches near the 5′ end of the mRNA and slides along until it finds the <strong>start codon AUG</strong>.</p>`];
    case "needP":
      return ["needP", `<p>The start codon <strong>AUG</strong> is in the <strong>P site</strong>. Drag the <strong>initiator tRNA</strong>, whose anticodon <strong>3′-UAC-5′</strong> pairs with AUG. It carries <strong>methionine (Met)</strong>, the first amino acid of every new polypeptide.</p>`];
    case "join":
      return ["join", `<p>The <strong>large subunit</strong> joins, completing the ribosome. It has three tRNA sites: <strong>A</strong> (aminoacyl — new tRNA arrives), <strong>P</strong> (peptidyl — holds the growing chain) and <strong>E</strong> (exit).</p>`];
    case "needA":
      return [`A${t2.k}`, `<p>Codon in the <strong>A site</strong>: <strong>${cod}</strong>. Drag the tRNA whose <strong>anticodon</strong> is complementary to it (A↔U, G↔C). Use the genetic code table to predict which amino acid it brings.</p><p>Chain so far: <strong>${chainTxt}</strong></p>`];
    case "bond":
      return [`B${t2.k}`, `<p>A <strong>peptide bond</strong> forms: the growing chain is transferred from the tRNA in the P site onto the amino acid held by the tRNA in the A site. The ribosome's rRNA catalyses this reaction.</p>`];
    case "shift":
      return [`S${t2.k}`, `<p><strong>Translocation:</strong> the ribosome moves along the mRNA by one codon (3 nucleotides) towards the 3′ end. The empty tRNA shifts into the <strong>E site</strong> and leaves (it can be reloaded with another amino acid); the A site is now free.</p>`];
    case "stop":
      return ["stop", `<p>Stop codon <strong>${cod}</strong> is in the A site. No tRNA has an anticodon for a stop codon — instead a <strong>release factor</strong> protein binds. Drag the release factor into the A site.</p><p>Chain so far: <strong>${chainTxt}</strong></p>`];
    case "release":
      return ["rel", `<p>The release factor causes the polypeptide to be cut free from the last tRNA. The ribosome's subunits separate and can be reused on another mRNA.</p>`];
    case "stall":
      return ["stall", `<p>The ribosome reached the 3′ end of the mRNA <strong>without meeting a stop codon in this reading frame</strong>. The incomplete chain (${t2.chain.length} amino acids) is released; cells detect and destroy faulty proteins like this.</p>`];
    case "done": {
      const cls = M.classify(M.ORIGINAL_GENE, t2.gene);
      return [`done${t2.gene}`, `<p>Finished! A polypeptide of <strong>${t2.chain.length} amino acids</strong>: ${chainTxt}. Its amino acid sequence determines how it <strong>folds</strong> into a 3D shape (the real β-globin chain is 146 amino acids long).</p>
        <p>Compared with the original gene: <strong>${cls.title}</strong>. ${cls.kind === "none" ? "Try the Mutation lab to change the DNA." : cls.detail}</p>`];
    }
  }
  return ["", ""];
}
function updateExplain() {
  const [k, html] = explainHTML();
  const key = S.act + k;
  if (key !== exKey) { exKey = key; exDyn.innerHTML = html; }
}

// genetic code dialog
const gcDialog = K.$("#gcDialog");
K.$("#gcClose").addEventListener("click", () => gcDialog.close());
gcDialog.addEventListener("click", (e) => { if (e.target === gcDialog) gcDialog.close(); });
(function buildCode() {
  let h = `<table class="gct"><thead><tr><th rowspan="2">1st</th><th colspan="4">2nd base</th><th rowspan="2">3rd</th></tr><tr>`;
  for (const b of M.ORDER) h += `<th class="b">${b}</th>`;
  h += `</tr></thead><tbody>`;
  for (const b1 of M.ORDER) {
    h += `<tr><th class="b">${b1}</th>`;
    for (const b2 of M.ORDER) {
      h += "<td>";
      for (const b3 of M.ORDER) {
        const c = b1 + b2 + b3, a = M.CODE[c], info = M.AA[a];
        const col = M.CLASS_COL[info[2]];
        const name = a === "*" ? "Stop" : c === "AUG" ? "Met · START" : info[0];
        h += `<div class="cd" data-c="${c}" style="border-left-color:${col}" title="${info[1]}"><b>${c}</b><span>${name}</span></div>`;
      }
      h += "</td>";
    }
    h += `<th class="third">U<br>C<br>A<br>G</th></tr>`;
  }
  h += "</tbody></table>";
  K.$("#gcTable").innerHTML = h;
})();
function currentCodon() {
  if (S.act === 2 && S.t2) return S.t2.phase === "needP" || S.t2.phase === "init" ? "AUG" : aCodon();
  const tr = curTr(), pl = S.t1.placed;
  if (tr.start < 0 || pl < tr.start) return null;
  const i = tr.start + 3 * Math.floor((pl - tr.start) / 3);
  const c = M.toRNA(geneStr().slice(i, i + 3));
  return c.length === 3 ? c : null;
}
function openCode() {
  const c = currentCodon();
  gcDialog.querySelectorAll(".cd").forEach((d) => d.classList.toggle("hl", d.dataset.c === c));
  if (gcDialog.showModal) gcDialog.showModal(); else gcDialog.setAttribute("open", "");
}

// act / tool switching
function setAct(n) {
  n = +n;
  if (n === 2) {
    const g = geneStr();
    if (!S.t2 || S.t2.gene !== g) {
      const done = S.t1.gene === g && ["term", "export", "exported"].includes(S.t1.phase);
      if (!done) toast("mRNA auto-transcribed from the current DNA so you can translate it.");
      setupAct2(g);
    }
    S.picker = null;
  } else if (S.t1.phase === "exported") resetAct1();
  S.act = n; actSeg.set(n); S.drag = null; S.autoT = 0;
}
function setTool(v) {
  S.tool = v; toolSeg.set(v); S.picker = null;
  if (v !== "off" && S.act !== 1) setAct(1);
}

// pointer
K.pointer(canvas, {
  down(p) {
    if (S.cbtn && p.x >= S.cbtn.x && p.x <= S.cbtn.x + S.cbtn.w && p.y >= S.cbtn.y && p.y <= S.cbtn.y + S.cbtn.h) { S.cbtn.act(); return; }
    if (S.act === 1) {
      const L = lay1();
      if (S.picker) {
        const hit = pickerTiles(L).find((t) => Math.abs(p.x - t.x) < 17 && Math.abs(p.y - t.y) < 20);
        const pk = S.picker; S.picker = null;
        if (hit) applyEdit(pk.mode, pk.gi, hit.b);
        return;
      }
      if (S.tool !== "off" && S.t1.phase !== "export") {
        const gi = columnAt(p);
        if (gi >= 0) {
          if (S.tool === "del") applyEdit("del", gi);
          else S.picker = { mode: S.tool, gi, x: L.X0 + (UPL + gi) * L.sp - S.cam1.x, y: L.cy - A_PICK };
          return;
        }
      }
      const items = S.t1.items;
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (!it.fly && K.dist(p.x, p.y, it.x, it.y) < it.r + 13) {
          S.drag = { item: it, ox: p.x - it.x, oy: p.y - it.y, sx: p.x, sy: p.y, t0: performance.now(), moved: false };
          items.splice(i, 1); items.push(it);
          return;
        }
      }
    } else if (S.t2) {
      const s = lay2().s, items = S.t2.items;
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (it.fly || it.leaving) continue;
        const dx = p.x - it.x, dy = p.y - it.y;
        if (Math.abs(dx) < Math.max(1.9 * s, 26) && dy > -5.2 * s && dy < Math.max(0.8 * s, 16)) {
          S.drag = { item: it, ox: dx, oy: dy, sx: p.x, sy: p.y, t0: performance.now(), moved: false };
          items.splice(i, 1); items.push(it);
          return;
        }
      }
    }
    const cam = S.act === 1 ? S.cam1 : S.cam2;
    S.drag = { pan: true, sx: p.x, cam0: cam.x, moved: false };
  },
  move(p) {
    const d = S.drag;
    if (!d || !p.isDown) return;
    if (Math.hypot(p.x - d.sx, p.y - (d.sy ?? p.y)) > 6) d.moved = true;
    if (d.pan) {
      const cam = S.act === 1 ? S.cam1 : S.cam2;
      if (d.moved) { cam.manual = true; cam.x = d.cam0 - (p.x - d.sx); }
    } else { d.item.x = p.x - d.ox; d.item.y = p.y - d.oy; d.item.vx = d.item.vy = 0; }
  },
  up(p) {
    const d = S.drag; S.drag = null;
    if (!d || d.pan) return;
    const it = d.item;
    const tapped = !d.moved && performance.now() - d.t0 < 400;
    if (S.act === 1) {
      const sp0 = slotPos();
      if (tapped || K.dist(it.x, it.y, sp0.x, sp0.y) < 48) tryPlace1(it, tapped);
    } else if (S.t2) {
      const ph = S.t2.phase;
      const site = ph === "needP" ? "P" : "A";
      const tg = siteTarget(site), s = lay2().s;
      const near = Math.abs(it.x - tg.x) < Math.max(1.9 * s, 44) && it.y > tg.y - 5.5 * s && it.y < tg.y + 2 * s;
      if (tapped || near) tryPlace2(it, tapped);
    }
  },
});
const A_PICK = 82;

// auto mode
function autoStep(dt) {
  if (!S.auto || dt === 0) return;
  S.autoT += dt;
  if (S.act === 1) {
    const t1 = S.t1;
    if ((t1.phase === "ready" || t1.phase === "elong") && t1.placed < S.gene.length) {
      if (S.autoT > 0.26 && !t1.items.some((i) => i.fly)) {
        S.autoT = 0;
        const need = neededBase();
        const sp0 = slotPos();
        let best = null, bd = 1e9;
        for (const it of t1.items) if (it.b === need && it !== S.drag?.item) { const dd = K.dist(it.x, it.y, sp0.x, sp0.y); if (dd < bd) { bd = dd; best = it; } }
        if (!best) best = spawnNuc(need, true);
        best.fly = { t: 0, dur: 0.3, x0: best.x, y0: best.y, target: slotPos, done: arrive1 };
      }
    } else if (t1.phase === "exported" && S.autoT > 1.2) setAct(2);
  } else if (S.t2) {
    const t2 = S.t2, key = needKey();
    if (key) {
      if (S.autoT > 0.8 && !t2.items.some((i) => i.fly)) {
        const it = t2.items.find((i) => itemKey(i) === key && !i.leaving && i !== S.drag?.item);
        if (it) { S.autoT = 0; tryPlace2(it, true); }
      }
    } else if (["done", "stall", "nostart"].includes(t2.phase) && S.autoT > 0.5) {
      S.auto = false; autoBtn.setAttribute("aria-pressed", "false");
    }
  }
}

// ---------------------------------------------------------------- boot
resetAct1();
for (let i = 0; i < (stage.w < 600 ? 9 : 13); i++) spawnNuc(i < 4 ? ["A", "U", "G", "C"][i] : randomNucBase(), false);
updateLab();

let lastNow = performance.now();
const LOOP = K.loop((dt, T) => {
  const now = performance.now();
  const rdt = Math.min((now - lastNow) / 1000, 0.05);
  lastNow = now;
  S.cbtn = null;
  chipH = overlay.offsetHeight;
  ctx.save();
  if (S.act === 1) { update1(dt, rdt, T); draw1(T); }
  else { update2(dt, rdt, T); draw2(T); }
  ctx.restore();
  autoStep(dt);
  updateChips();
  updateExplain();
  missionsApi.update();
});
LOOP.speed = initSpeed;
