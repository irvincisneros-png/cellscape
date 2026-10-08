// Enzyme Lab — physics + kinetics model (no DOM). Used both by the live stage and by the
// headless "Run experiment" sweeps, so graph points are genuinely measured from this simulation.
//
// Model summary (simplified, not to scale):
//  • Molecules move by Brownian motion; motion speed rises with temperature.
//  • A free substrate that touches the mouth of the active site in the right orientation binds
//    (probability scaled by active-site "fit", which falls as pH moves from the optimum).
//  • The enzyme–substrate complex then either reacts (rate kcat, Q10 ≈ 2) or the substrate
//    simply drifts off again (rate koff). This gives Michaelis–Menten saturation naturally.
//  • Above ~optimum + 1 °C each enzyme has a hazard of denaturing (rises steeply with T);
//    extreme pH also denatures. Denaturation is permanent.
//  • Competitive inhibitor: occupies the active site for a while, then leaves.
//  • Non-competitive inhibitor: binds the allosteric site, distorts the active site → no catalysis.

const TAU = Math.PI * 2;
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);

export const ENZYMES = {
  amylase: {
    key: "amylase", name: "Amylase", Topt: 37, pHopt: 7, pHw: 2.0, pHden: 3.6, kcat: 0.55, koff: 0.15,
    reaction: "starch → maltose", where: "saliva and the small intestine",
  },
  pepsin: {
    key: "pepsin", name: "Pepsin", Topt: 37, pHopt: 2, pHw: 1.7, pHden: 3.6, kcat: 0.5, koff: 0.15,
    reaction: "protein → peptides", where: "the stomach (acidic gastric juice)",
  },
  catalase: {
    key: "catalase", name: "Catalase", Topt: 37, pHopt: 7, pHw: 2.6, pHden: 4.2, kcat: 2.0, koff: 0.3,
    reaction: "2 H₂O₂ → 2 H₂O + O₂", where: "almost all cells (e.g. liver) — it removes toxic hydrogen peroxide",
  },
};

export const G = {
  R: 30,          // enzyme radius (world units)
  notchA: 0.5,    // half-angle of active-site groove
  capR: 13,       // capture radius around the mouth of a site
  minGap: 4,      // small molecules are pushed out to R + minGap
  oriTolS: 0.7,   // orientation tolerance for substrate (rad, mod π)
  oriTolCI: 0.75,
};
export const WORLD_AREA = 600 * 380;

// ---- condition-dependent factors ----
export const motion = (T) => 0.4 + 0.6 * (T / 37);
export const fitPH = (E, pH) => Math.exp(-(((pH - E.pHopt) / E.pHw) ** 2));
export const kcatAt = (E, T, pH) => E.kcat * Math.pow(2, (T - E.Topt) / 10) * Math.sqrt(fitPH(E, pH));
export function heatHazard(E, T, stab = 0) {
  if (T <= E.Topt + 1) return 0;
  return 0.04 * Math.exp((T - E.Topt - 5 - stab) / 1.6);
}
export function pHHazard(E, pH, stab = 0) {
  const d = Math.abs(pH - E.pHopt) - stab * 0.1;
  if (d <= E.pHden) return 0;
  return 0.06 * Math.exp((d - E.pHden) / 0.45);
}

const SECT = 1.3, SECT_NI = 0.8; // half-width (rad) of the surface patch around each site
const KOFF_CI = 0.4, KOFF_NI = 0.08, P_BIND = 0.9, P_BIND_CI = 0.9, P_BIND_NI = 0.3;

// ---- world ----
export function createWorld(W, H, params, { headless = false } = {}) {
  const w = { W, H, p: { ...params }, enz: [], lig: [], prod: [], t: 0, made: 0, events: [], headless, fx: [] };
  for (let i = 0; i < params.nE; i++) addEnzyme(w);
  for (let i = 0; i < params.nS; i++) addLigand(w, "S");
  for (let i = 0; i < params.nCI; i++) addLigand(w, "CI");
  for (let i = 0; i < params.nNI; i++) addLigand(w, "NI");
  return w;
}

export function addEnzyme(w) {
  const R = G.R;
  let x = rnd(R + 6, w.W - R - 6), y = rnd(R + 6, w.H - R - 6);
  for (let k = 0; k < 30; k++) { // try to avoid overlaps
    if (w.enz.every((e) => Math.hypot(e.x - x, e.y - y) > 2 * R + 8)) break;
    x = rnd(R + 6, w.W - R - 6); y = rnd(R + 6, w.H - R - 6);
  }
  const e = {
    x, y, vx: 0, vy: 0, a: rnd(0, TAU), va: 0, stab: rnd(-1.5, 1.5),
    state: "ok", fold: 1, cause: null, site: null, allo: null, close: 0, flash: 0, reject: 0,
    s1: rnd(0, TAU), s2: rnd(0, TAU), s3: rnd(0, TAU), wob: rnd(0, TAU),
  };
  w.enz.push(e);
  return e;
}

export function addLigand(w, kind, fade = false) {
  const l = {
    kind, x: rnd(10, w.W - 10), y: rnd(10, w.H - 10), vx: 0, vy: 0, a: rnd(0, TAU), va: 0,
    bound: null, snap: 1, bx: 0, by: 0, ba: 0, drag: false, alpha: fade ? 0 : 1, r: kind === "NI" ? 8 : 12,
  };
  // nudge out of enzymes
  for (const e of w.enz) {
    const d = Math.hypot(l.x - e.x, l.y - e.y);
    if (d < G.R + 8) { const ang = Math.atan2(l.y - e.y, l.x - e.x); l.x = e.x + Math.cos(ang) * (G.R + 10); l.y = e.y + Math.sin(ang) * (G.R + 10); }
  }
  w.lig.push(l);
  return l;
}

/** Remove n ligands of a kind — free ones first, then bound ones. */
export function removeLigands(w, kind, n) {
  const free = w.lig.filter((l) => l.kind === kind && !l.bound && !l.drag);
  const bound = w.lig.filter((l) => l.kind === kind && l.bound);
  const out = [...free, ...bound].slice(0, n);
  for (const l of out) { unbind(l); }
  const set = new Set(out);
  w.lig = w.lig.filter((l) => !set.has(l));
}

export function removeEnzymes(w, n) {
  for (let i = 0; i < n && w.enz.length; i++) {
    const e = w.enz.pop();
    if (e.site) unbind(e.site);
    if (e.allo) unbind(e.allo);
  }
}

export const count = (w, kind) => w.lig.reduce((n, l) => n + (l.kind === kind ? 1 : 0), 0);

export function pocket(e) { // mouth / seat of the active site
  return { x: e.x + Math.cos(e.a) * (G.R - 7), y: e.y + Math.sin(e.a) * (G.R - 7) };
}
export function alloSite(e) {
  return { x: e.x - Math.cos(e.a) * (G.R - 3), y: e.y - Math.sin(e.a) * (G.R - 3) };
}
const mouth = (e, back = false) => {
  const s = back ? -1 : 1;
  return { x: e.x + s * Math.cos(e.a) * (G.R + 3), y: e.y + s * Math.sin(e.a) * (G.R + 3) };
};

/** Angle difference between ligand axis and the groove tangent, modulo π (0..π/2). */
export function oriErr(l, e) {
  let d = (l.a - (e.a + Math.PI / 2)) % Math.PI;
  if (d < 0) d += Math.PI;
  return Math.min(d, Math.PI - d);
}

function bind(l, e, siteKey) {
  l.bound = e; l.site = siteKey; l.snap = 0; l.bx = l.x; l.by = l.y; l.ba = l.a; l.vx = l.vy = 0;
  e[siteKey] = l;
}
export function unbind(l, kick = 40) {
  const e = l.bound;
  if (!e) return;
  if (e[l.site] === l) e[l.site] = null;
  const dir = l.site === "allo" ? e.a + Math.PI : e.a;
  l.x = e.x + Math.cos(dir) * (G.R + G.minGap + 2);
  l.y = e.y + Math.sin(dir) * (G.R + G.minGap + 2);
  l.vx = Math.cos(dir) * kick; l.vy = Math.sin(dir) * kick;
  l.bound = null; l.site = null; l.snap = 1;
}

function denature(w, e, cause) {
  e.state = "unfolding"; e.cause = cause;
  if (e.site) unbind(e.site, 30);
  if (e.allo) unbind(e.allo, 30);
}

function brown(p, h, s, damp) {
  p.vx += rnd(-1, 1) * s * h; p.vy += rnd(-1, 1) * s * h;
  const d = Math.pow(damp, h * 60);
  p.vx *= d; p.vy *= d;
  p.x += p.vx * h; p.y += p.vy * h;
}
function box(p, r, W, H) {
  if (p.x < r) { p.x = r; p.vx = Math.abs(p.vx); }
  if (p.x > W - r) { p.x = W - r; p.vx = -Math.abs(p.vx); }
  if (p.y < r) { p.y = r; p.vy = Math.abs(p.vy); }
  if (p.y > H - r) { p.y = H - r; p.vy = -Math.abs(p.vy); }
}

/** Try to dock a hand-dragged ligand. Returns null (not near), or {ok, reason, e}. */
export function tryDock(w, l) {
  const E = ENZYMES[w.p.enzyme];
  for (const e of w.enz) {
    const back = l.kind === "NI";
    const m = mouth(e, back);
    const dm = Math.hypot(l.x - m.x, l.y - m.y);
    if (dm > G.capR + 8) continue;
    if (e.state !== "ok") return { ok: false, e, reason: "denatured — the active site has lost its shape" };
    if (back) {
      if (e.allo) return { ok: false, e, reason: "allosteric site already taken" };
      bind(l, e, "allo"); l.drag = false; return { ok: true, e, reason: "bound to the allosteric site" };
    }
    if (e.site) return { ok: false, e, reason: "active site is already occupied" };
    if (e.allo) return { ok: false, e, reason: "active site distorted by the non-competitive inhibitor" };
    const tol = l.kind === "S" ? G.oriTolS + 0.1 : G.oriTolCI + 0.1;
    if (oriErr(l, e) > tol) return { ok: false, e, reason: "wrong orientation — tap the molecule to rotate it" };
    if (Math.random() > Math.sqrt(fitPH(E, w.p.pH)) + 0.05) return { ok: false, e, reason: "poor fit — the pH has changed the active site's shape" };
    bind(l, e, "site"); l.drag = false;
    return { ok: true, e, reason: l.kind === "S" ? "enzyme–substrate complex formed" : "inhibitor is blocking the active site" };
  }
  // also allow dropping onto the back of an enzyme with the wrong molecule type
  return null;
}

export function step(w, dt) {
  const n = Math.max(1, Math.ceil(dt / (1 / 60)));
  const h = dt / n;
  for (let i = 0; i < n; i++) sub(w, h);
}

function sub(w, h) {
  const p = w.p, E = ENZYMES[p.enzyme], R = G.R;
  w.t += h;
  const mot = motion(p.temp);
  const fit = fitPH(E, p.pH);
  const kcat = kcatAt(E, p.temp, p.pH);
  const enz = w.enz, lig = w.lig;

  // enzymes
  for (const e of enz) {
    brown(e, h, 420 * mot, 0.94);
    e.va += rnd(-1, 1) * 2.2 * mot * h; e.va *= Math.pow(0.97, h * 60); e.a += e.va * h;
    box(e, R + 2, w.W, w.H);
    e.wob += h * (1 + mot);
    if (e.flash > 0) e.flash = Math.max(0, e.flash - h * 3);
    if (e.reject > 0) e.reject = Math.max(0, e.reject - h * 2);
    const target = e.site ? 1 : 0;
    e.close += (target - e.close) * Math.min(1, h * 10);
    if (e.state === "ok") {
      const hz = heatHazard(E, p.temp, e.stab), hp = pHHazard(E, p.pH, e.stab);
      if ((hz + hp) > 0 && Math.random() < (hz + hp) * h) denature(w, e, hz >= hp ? "heat" : "pH");
    } else if (e.state === "unfolding") {
      e.fold -= h / 1.4;
      if (e.fold <= 0) { e.fold = 0; e.state = "dead"; }
    }
  }
  // enzyme–enzyme repulsion
  for (let i = 0; i < enz.length; i++) {
    const a = enz[i];
    for (let j = i + 1; j < enz.length; j++) {
      const b = enz[j];
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy, md = 2 * R + 4;
      if (d2 < md * md && d2 > 0.01) {
        const d = Math.sqrt(d2), push = (md - d) / 2, ux = dx / d, uy = dy / d;
        a.x -= ux * push; a.y -= uy * push; b.x += ux * push; b.y += uy * push;
      }
    }
  }

  // ligands
  const strength = 2600 * mot;
  for (const l of lig) {
    if (l.alpha < 1) l.alpha = Math.min(1, l.alpha + h * 2);
    if (l.bound) {
      const e = l.bound;
      if (l.snap < 1) l.snap = Math.min(1, l.snap + h * 7);
      const s = l.site === "allo" ? alloSite(e) : pocket(e);
      const ta = l.site === "allo" ? e.a + Math.PI : e.a + Math.PI / 2;
      // choose the equivalent target angle nearest the binding angle (axis is symmetric mod π)
      let da = ((ta - l.ba) % Math.PI + Math.PI * 1.5) % Math.PI - Math.PI / 2;
      const k = l.snap * l.snap * (3 - 2 * l.snap);
      l.x = l.bx + (s.x - l.bx) * k; l.y = l.by + (s.y - l.by) * k; l.a = l.ba + da * k;
      if (l.snap >= 1) { l.bx = s.x; l.by = s.y; l.ba = l.a; }
      continue;
    }
    if (l.drag) continue;
    brown(l, h, strength * (l.kind === "NI" ? 1.1 : 1), 0.95);
    l.va += rnd(-1, 1) * 30 * mot * h; l.va *= Math.pow(0.95, h * 60); l.a += l.va * h;
    box(l, 6, w.W, w.H);
  }

  // ligand–enzyme contacts
  const reach = R + 18;
  for (const e of enz) {
    const ok = e.state === "ok";
    for (const l of lig) {
      if (l.bound || l.drag) continue;
      const dx = l.x - e.x, dy = l.y - e.y;
      if (dx > reach || dx < -reach || dy > reach || dy < -reach) continue;
      const d2 = dx * dx + dy * dy;
      if (d2 > reach * reach) continue;
      const d = Math.sqrt(d2) || 0.01, md = R + G.minGap;
      if (d < md) {
        const ux = dx / d, uy = dy / d;
        l.x = e.x + ux * md; l.y = e.y + uy * md;
        const vn = l.vx * ux + l.vy * uy;
        if (vn < 0) { l.vx -= 2 * vn * ux; l.vy -= 2 * vn * uy; }
      }
      if (!ok || d > md + 8) continue; // only molecules actually touching the enzyme surface
      // where on the surface did it touch? (angle from the active-site direction)
      let rel = Math.atan2(dy, dx) - e.a;
      rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      if (l.kind === "NI") {
        if (!e.allo && Math.abs(rel) > Math.PI - SECT_NI && Math.random() < P_BIND_NI) bind(l, e, "allo");
        continue;
      }
      if (e.site || e.allo || Math.abs(rel) > SECT) continue;
      if (l.kind === "S") {
        if (oriErr(l, e) < G.oriTolS && Math.random() < P_BIND * fit) bind(l, e, "site");
      } else if (oriErr(l, e) < G.oriTolCI && Math.random() < P_BIND_CI * fit) bind(l, e, "site");
    }
  }

  // complex events
  for (const e of enz) {
    if (e.allo && Math.random() < KOFF_NI * h) unbind(e.allo, 30);
    const l = e.site;
    if (!l) continue;
    if (l.kind === "CI") { if (Math.random() < KOFF_CI * h) unbind(l, 35); continue; }
    if (l.snap < 1) continue;
    if (!e.allo && Math.random() < kcat * h) react(w, e, l);
    else if (Math.random() < E.koff * h) unbind(l, 35);
  }

  // products (visual only)
  if (!w.headless) {
    for (const q of w.prod) {
      q.life -= h;
      if (q.bubble) {
        q.vy -= 60 * h; q.vx += rnd(-1, 1) * 80 * h; q.vx *= 0.98;
        q.x += q.vx * h; q.y += q.vy * h; q.r = Math.min(q.rMax, q.r + h * 6);
        if (q.y < q.r + 2) q.life = Math.min(q.life, 0.15);
      } else {
        brown(q, h, strength * 0.9, 0.95);
        q.va += rnd(-1, 1) * 10 * h; q.a += q.va * h;
        box(q, 5, w.W, w.H);
      }
    }
    if (w.prod.some((q) => q.life <= 0)) w.prod = w.prod.filter((q) => q.life > 0);
    for (const f of w.fx) f.t += h;
    if (w.fx.length && w.fx[0].t > 0.6) w.fx = w.fx.filter((f) => f.t <= 0.6);
  }
}

function react(w, e, l) {
  const pk = pocket(e);
  e.site = null; e.flash = 1;
  w.lig.splice(w.lig.indexOf(l), 1);
  w.made++;
  w.events.push(w.t);
  if (w.events.length > 400) w.events.splice(0, w.events.length - 400);
  if (!w.headless) {
    const ta = e.a + Math.PI / 2;
    const out = (sgn, extra = {}) => ({
      x: pk.x + Math.cos(ta) * 8 * sgn + Math.cos(e.a) * 6, y: pk.y + Math.sin(ta) * 8 * sgn + Math.sin(e.a) * 6,
      vx: Math.cos(e.a) * 70 + Math.cos(ta) * 55 * sgn, vy: Math.sin(e.a) * 70 + Math.sin(ta) * 55 * sgn,
      a: l.a, va: sgn * 3, life: 3.2, ...extra,
    });
    if (w.p.enzyme === "catalase") {
      w.prod.push(out(1, { type: "water" }));
      w.prod.push({ ...out(-1), bubble: true, r: 2, rMax: rnd(4, 7), life: 6 });
    } else {
      w.prod.push(out(1, { type: "half" }), out(-1, { type: "half" }));
    }
    if (w.prod.length > 140) w.prod.splice(0, w.prod.length - 140);
    w.fx.push({ x: pk.x, y: pk.y, t: 0 });
  }
  if (w.p.topUp) addLigand(w, "S", !w.headless);
}

/** Products per second over the last `win` seconds of world time. */
export function rate(w, win = 4) {
  const t0 = w.t - win;
  let n = 0;
  for (let i = w.events.length - 1; i >= 0 && w.events[i] > t0; i--) n++;
  return n / Math.min(win, Math.max(0.5, w.t));
}

export function stats(w) {
  let busy = 0, dead = 0, ci = 0, ni = 0;
  for (const e of w.enz) {
    if (e.state !== "ok") dead++;
    if (e.site && e.site.kind === "S" && !e.allo && e.state === "ok") busy++;
    if (e.site && e.site.kind === "CI") ci++;
    if (e.allo) ni++;
  }
  const n = Math.max(1, w.enz.length);
  return { busy: busy / n, dead: dead / n, ci: ci / n, ni: ni / n, nE: w.enz.length };
}

/** Headless measurement: fresh enzyme, incubate, then count products. Returns products/s. */
export function measure(params, W, H, { warm = 3, span = 40 } = {}) {
  const w = createWorld(W, H, { ...params, topUp: true }, { headless: true });
  step(w, warm);
  const m0 = w.made;
  step(w, span);
  return (w.made - m0) / span;
}
