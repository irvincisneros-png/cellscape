import * as K from "./kit.js";
import { SIMS, THEMES } from "./catalog.js";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- hero: a living membrane that reacts to the pointer ----------
const heroCanvas = K.$("#hero");
const hero = K.createStage(heroCanvas);
const hp = { x: -999, y: -999 };
addEventListener("pointermove", (e) => {
  const r = heroCanvas.getBoundingClientRect();
  hp.x = e.clientX - r.left; hp.y = e.clientY - r.top;
});

const ions = K.makeParticles(70, () => ({
  x: K.rand(0, 1600), y: K.rand(0, 700), vx: 0, vy: 0, r: K.rand(3, 7),
  col: K.pick([K.C.violet, K.C.amber, K.C.teal, K.C.red, K.C.blue]), z: K.rand(0.4, 1),
}));

// proteins sit in the membrane at fixed fractions of width
const proteins = [
  { f: 0.52, col: K.C.amber, w: 70, kind: "channel" },
  { f: 0.68, col: K.C.violet, w: 60, kind: "pump" },
  { f: 0.82, col: K.C.blue, w: 46, kind: "channel" },
  { f: 0.94, col: K.C.green, w: 40, kind: "carrier" },
];

function membraneY(x, t, w, h) {
  // gentle diagonal curve like the reference animation
  return h * 0.78 - (x / w) * h * 0.45 + Math.sin(x * 0.006 + t * 0.4) * 14;
}

function drawHero(dt, t) {
  const { ctx, w, h } = hero;
  K.backdrop(ctx, w, h, "#16305a");
  K.glow(ctx, w * 0.75, h * 0.25, h * 0.7, K.C.violet, 0.12);
  K.glow(ctx, w * 0.2, h * 0.9, h * 0.6, K.C.teal, 0.12);

  // far particles
  for (const p of ions) {
    K.brownian(p, dt, 40);
    const dx = p.x - hp.x, dy = p.y - hp.y, d = Math.hypot(dx, dy);
    if (d < 120 && d > 0) { p.vx += (dx / d) * 300 * dt; p.vy += (dy / d) * 300 * dt; }
    if (p.x < -10) p.x = w + 10; if (p.x > w + 10) p.x = -10;
    if (p.y < -10) p.y = h + 10; if (p.y > h + 10) p.y = -10;
    K.sphere(ctx, p.x, p.y, p.r * p.z, p.col, { alpha: 0.35 + p.z * 0.6 });
  }

  // membrane: heads along curve, two leaflets
  const thick = Math.max(34, h * 0.075), headR = Math.max(5, h * 0.011);
  const gaps = proteins.map((p) => ({ x: p.f * w, half: p.w / 2 + headR }));
  for (let x = -headR; x < w + headR; x += headR * 2.05) {
    if (gaps.some((g) => Math.abs(x - g.x) < g.half)) continue;
    const y = membraneY(x, t, w, h);
    const bulge = Math.max(0, 1 - Math.hypot(x - hp.x, y - hp.y) / 140) * 10;
    ctx.strokeStyle = K.C.lipidTail; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x - 2, y - thick / 2); ctx.lineTo(x - 2, y + thick / 2); ctx.moveTo(x + 2, y - thick / 2); ctx.lineTo(x + 2, y + thick / 2); ctx.stroke();
    K.sphere(ctx, x, y - thick / 2 - bulge, headR, K.C.lipidHead);
    K.sphere(ctx, x, y + thick / 2 + bulge, headR, K.mix(K.C.lipidHead, "#7c6a90", 0.4));
  }
  for (const p of proteins) {
    const x = p.f * w, y = membraneY(x, t, w, h);
    const ph = thick * 2.2;
    if (p.kind === "pump") {
      const open = (Math.sin(t * 1.6) + 1) / 2;
      K.blob(ctx, x - p.w * 0.22 - open * 4, y, p.w * 0.5, ph, p.col);
      K.blob(ctx, x + p.w * 0.22 + open * 4, y, p.w * 0.5, ph, p.col);
    } else {
      K.blob(ctx, x - p.w * 0.27, y, p.w * 0.46, ph, p.col);
      K.blob(ctx, x + p.w * 0.27, y, p.w * 0.46, ph, p.col);
    }
    // ion passing through
    const k = ((t * 0.6 + p.f * 3) % 1);
    const iy = y - ph * 0.8 + k * ph * 1.6;
    K.sphere(ctx, x, iy, 6, p.kind === "pump" ? K.C.violet : K.C.teal, { glow: 12 });
  }
  if (K.dist(hp.x, hp.y, w / 2, h / 2) < Math.max(w, h)) K.glow(ctx, hp.x, hp.y, 90, K.C.teal, 0.12);
  // scrim so the headline stays legible over the membrane
  const s = ctx.createLinearGradient(0, 0, Math.min(w, 1100) * 0.7, 0);
  s.addColorStop(0, "rgba(5,11,22,0.85)");
  s.addColorStop(0.6, "rgba(5,11,22,0.55)");
  s.addColorStop(1, "rgba(5,11,22,0)");
  ctx.fillStyle = s;
  ctx.fillRect(0, 0, w, h);
}

// ---------- card thumbnails ----------
const motifs = {
  cell(ctx, w, h, t) {
    K.sphere(ctx, w / 2, h / 2, h * 0.42, "#1f6f6a", { alpha: 0.85 });
    K.sphere(ctx, w / 2 - 10, h / 2 - 4, h * 0.16, K.C.violet);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.25 + t * 0.3, r = h * 0.28;
      K.blob(ctx, w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r * 0.8, 22, 11, K.C.orange, 6);
    }
  },
  membrane(ctx, w, h, t) {
    K.bilayer(ctx, 0, w, h / 2 - 18, h / 2 + 18, { t, headR: 6, skip: (x) => Math.abs(x - w * 0.6) < 22 });
    K.blob(ctx, w * 0.6 - 10, h / 2, 18, 62, K.C.violet);
    K.blob(ctx, w * 0.6 + 10, h / 2, 18, 62, K.C.violet);
    const k = (t * 0.5) % 1;
    K.sphere(ctx, w * 0.6, h * 0.1 + k * h * 0.8, 7, K.C.amber, { glow: 10 });
  },
  rbc(ctx, w, h, t) {
    const s = 1 + Math.sin(t) * 0.12;
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.scale(s, 1 / s);
    K.sphere(ctx, 0, 0, h * 0.34, "#c0262d");
    K.sphere(ctx, 0, 0, h * 0.16, "#8e1a20", { alpha: 0.7 });
    ctx.restore();
  },
  enzyme(ctx, w, h, t) {
    K.blob(ctx, w / 2 - 20, h / 2, 90, 80, K.C.teal, 34);
    const k = (Math.sin(t * 1.4) + 1) / 2;
    K.sphere(ctx, w / 2 + 70 - k * 40, h / 2, 14, K.C.amber, { glow: 10 });
    ctx.fillStyle = K.C.bg1; ctx.beginPath(); ctx.arc(w / 2 + 25, h / 2, 16, 0, K.TAU); ctx.fill();
  },
  leaf(ctx, w, h, t) {
    for (let i = 0; i < 4; i++) K.blob(ctx, w / 2, h * 0.3 + i * 18, 120, 14, "#2f9e5a", 7);
    for (let i = 0; i < 4; i++) {
      const k = (t * 0.6 + i / 4) % 1;
      K.glow(ctx, w * 0.2 + k * w * 0.3, h * 0.1 + k * h * 0.3, 12, K.C.amber, 0.8);
    }
  },
  rotor(ctx, w, h, t) {
    K.bilayer(ctx, 0, w, h * 0.3, h * 0.55, { t, headR: 5, skip: (x) => Math.abs(x - w / 2) < 28 });
    K.blob(ctx, w / 2, h * 0.43, 50, 34, K.C.orange, 12);
    K.blob(ctx, w / 2, h * 0.65, 10, 30, K.C.inkDim, 4);
    for (let i = 0; i < 6; i++) {
      const a = t * 2 + (i * K.TAU) / 6;
      K.sphere(ctx, w / 2 + Math.cos(a) * 26, h * 0.82 + Math.sin(a) * 8, 10, i % 2 ? K.C.red : K.C.amber);
    }
  },
  hb(ctx, w, h, t) {
    const pos = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    pos.forEach(([a, b], i) => {
      K.sphere(ctx, w / 2 + a * 22, h / 2 + b * 20, 22, i % 2 ? "#b91c1c" : "#dc2626");
      if ((t * 0.8 + i * 0.25) % 2 < 1.2) K.sphere(ctx, w / 2 + a * 34, h / 2 + b * 32, 6, K.C.blue, { glow: 8 });
    });
  },
  mitosis(ctx, w, h, t) {
    const k = (Math.sin(t * 0.8) + 1) / 2;
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const x = w / 2 + s * (6 + k * 50), y = h / 2 - 24 + i * 24;
      ctx.save(); ctx.translate(x, y); ctx.rotate(s * (0.5 - k * 0.4));
      K.blob(ctx, 0, 0, 9, 26, i === 1 ? K.C.blue : K.C.pink, 4); ctx.restore();
    }
  },
  meiosis(ctx, w, h, t) {
    for (let i = 0; i < 4; i++) {
      const a = (i * K.TAU) / 4 + t * 0.3;
      K.sphere(ctx, w / 2 + Math.cos(a) * 44, h / 2 + Math.sin(a) * 34, 20, "#1f4f6a", { alpha: 0.9 });
      K.blob(ctx, w / 2 + Math.cos(a) * 44, h / 2 + Math.sin(a) * 34, 7, 20, i % 2 ? K.C.blue : K.C.pink, 3);
    }
  },
  dna(ctx, w, h, t) {
    for (let x = 10; x < w - 10; x += 9) {
      const p = x * 0.06 + t * 1.2, a = Math.sin(p) * h * 0.25, b = -a;
      ctx.strokeStyle = [K.C.red, K.C.blue, K.C.green, K.C.amber][Math.floor(x / 9) % 4];
      ctx.globalAlpha = 0.5 + Math.cos(p) * 0.3; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, h / 2 + a); ctx.lineTo(x, h / 2 + b); ctx.stroke();
      ctx.globalAlpha = 1;
      K.sphere(ctx, x, h / 2 + a, 3.5, K.C.inkDim); K.sphere(ctx, x, h / 2 + b, 3.5, K.C.inkDim);
    }
  },
};

const thumbs = [];
function buildCards(filter) {
  const blocks = K.$("#blocks");
  blocks.innerHTML = "";
  thumbs.length = 0;
  for (const [key, theme] of Object.entries(THEMES)) {
    const sims = SIMS.filter((s) => s.theme === key && (filter === "all" || s.tags.some((t) => t.startsWith(filter))));
    if (!sims.length) continue;
    const sec = document.createElement("section");
    sec.className = "theme-block";
    sec.innerHTML = `<h2><i style="background:${theme.color}"></i>${theme.label}</h2><div class="grid"></div>`;
    const grid = sec.querySelector(".grid");
    for (const s of sims) {
      const a = document.createElement("a");
      a.className = "sim-card";
      a.href = `sims/${s.slug}/index.html`;
      a.style.setProperty("--c", theme.color);
      a.innerHTML = `<canvas aria-hidden="true"></canvas><div class="body"><h3>${s.title}</h3><p>${s.blurb}</p><div class="tags">${s.featured ? '<span class="feat">★ Featured</span>' : ""}${s.tags.map((t) => `<span>${t}</span>`).join("")}</div></div>`;
      grid.appendChild(a);
      const cv = a.querySelector("canvas");
      const st = K.createStage(cv);
      const th = { st, motif: motifs[s.motif], hover: false };
      a.addEventListener("pointerenter", () => (th.hover = true));
      a.addEventListener("pointerleave", () => (th.hover = false));
      thumbs.push(th);
    }
    blocks.appendChild(sec);
  }
}

const filters = [
  { value: "all", label: "All" },
  { value: "Stage 4", label: "Stage 4 (Y7–8)" },
  { value: "Stage 5", label: "Stage 5 (Y9–10)" },
  { value: "Bio Y11", label: "Biology Y11" },
  { value: "Bio Y12", label: "Biology Y12" },
];
const fwrap = K.$("#filters");
const fbtns = filters.map((f) => {
  const b = K.button(fwrap, f.label, () => {
    fbtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    buildCards(f.value);
  }, { toggle: true, pressed: f.value === "all" });
  return b;
});
buildCards("all");

let thumbT = 0;
K.loop((dt, t) => {
  drawHero(reduced ? dt * 0.3 : dt, t);
  thumbT += dt;
  for (const th of thumbs) {
    const { ctx, w, h } = th.st;
    if (!th.motif) continue;
    th.t = (th.t || 0) + dt * (th.hover ? 1.6 : 0.5) * (reduced ? 0.2 : 1);
    K.backdrop(ctx, w, h, "#12294a");
    th.motif(ctx, w, h, th.t);
  }
});
