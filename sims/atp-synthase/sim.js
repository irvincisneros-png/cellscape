// Cellular Respiration: The ATP Factory — electron transport chain + chemiosmosis + ATP synthase.
//
// Model (simplified, see "Not to scale" note in the explain card):
//  • NADH / FADH₂ arrive at rate  J = SUPPLY_MAX · NADH% · bp,  bp = 1 − 0.85·G³  (respiratory control:
//    pumping against a steep gradient is harder). NADH : FADH₂ ≈ 5 : 1 (as per glucose: 10 NADH, 2 FADH₂).
//  • Each electron pair pumps H⁺ into the intermembrane space: complex I 4, III 4, IV 2 (NADH → 10, FADH₂ → 6).
//  • Complex IV needs O₂: hand-off rate ∝ f(O₂) = 1.15·O₂/(O₂+15%) (0 with cyanide). Blocked → electrons back up.
//  • Gradient G = (H⁺ in intermembrane space) / PCAP.
//  • ATP synthase turns at ω = TURNS_MAX · max(0, (G − 0.2)/0.8) turns/s; 9 H⁺ per turn, 3 ATP per turn
//    (one ATP per 120°, i.e. 3 H⁺ per ATP). Oligomycin → ω = 0.
//  • Leak: H⁺ return across the bilayer at (0.4 + 30·DNP)·G per s; with DNP the energy is released as heat.
import * as K from "../../assets/js/kit.js";
import { COL, buildSprites, spr, buildMembrane, drawMito, drawETC, drawSynthase, rotP, betaState } from "./draw.js";

const { C, TAU, clamp, lerp, rand } = K;

const stageEl = K.$("#stage");
const panel = K.$("#panel");
const overlay = K.$("#overlay");
const canvas = K.$("#canvas");
const stage = K.createStage(canvas);
const { ctx } = stage;
const toast = K.toaster(stageEl);
const reduceMotion = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

// ---------- model constants ----------
const PCAP = 120; // H⁺ in the intermembrane space at 100 % gradient
const H_PER_TURN = 9, ATP_PER_TURN = 3;
const STEP_H = TAU / H_PER_TURN, STEP_A = TAU / ATP_PER_TURN;
const TURNS_MAX = 1.0; // rotor turns per (sim) second at full gradient — real enzyme ≈ 100+ per second
const G_THRESH = 0.2; // minimum gradient needed to drive synthesis
const SUPPLY_MAX = 1.2; // electron pairs per second at 100 % NADH supply
const LEAK_BASE = 0.4, LEAK_DNP = 30;
const DEF = { o2: 100, nadh: 50 };

const st = { o2: DEF.o2, nadh: DEF.nadh, cyanide: false, dnp: false, olig: false };
let L = { w: 0, h: 0, dpr: 0 };
let S = null, MEM = null;
let sim = null;
let zoom = 0, zoomTarget = 0;
let hover = null, grabbedOnce = false;
const far = Array.from({ length: 36 }, () => ({ x: Math.random(), y: Math.random(), r: rand(0.6, 1.8), sp: rand(0.004, 0.015) }));

const gradient = () => clamp(sim.pool / PCAP, 0, 1);
const geff = (G) => clamp((G - G_THRESH) / (1 - G_THRESH), 0, 1);
const backpressure = (G) => Math.max(0.1, 1 - 0.85 * G * G * G);
const o2f = () => (st.cyanide ? 0 : (st.o2 / (st.o2 + 40)) * 1.4);
const netATP = () => sim.made - sim.hydro;

// ---------- layout ----------
function computeLayout() {
  const w = stage.w, h = stage.h;
  const s = clamp(Math.min(w / 900, h / 560), 0.45, 1.3);
  const th = 60 * s + 12;
  const mid = h * 0.46;
  const top = mid - th / 2, bot = mid + th / 2;
  const x1 = w * 0.11, x2 = w * 0.255, x3 = w * 0.41, x4 = w * 0.565, x5 = w * 0.795;
  const hw1 = 34 * s, hw2 = 20 * s, hw3 = 30 * s, hw4 = 27 * s;
  const Rc = 26 * s, F1r = 38 * s;
  const f1y = bot + 24 * s + F1r;
  L = {
    w, h, dpr: stage.dpr, s, th, mid, top, bot, headR: clamp(6.2 * s, 3.6, 8),
    x1, x2, x3, x4, x5, hw1, hw2, hw3, hw4, Rc, F1r, f1y,
    ringR: Math.max(F1r + 24 * s + 6, 44), ax: x5 + Rc + 8 * s,
  };
  const ranges = [[x1 - hw1 - 2, x1 + hw1 + 2], [x2 - hw2 - 2, x2 + hw2 + 2], [x3 - hw3 - 2, x3 + hw3 + 2],
    [x4 - hw4 - 2, x4 + hw4 + 2], [x5 - Rc - 6 * s, L.ax + 10 * s]];
  L.skip = (x) => ranges.some(([a, b]) => x > a && x < b);
  L.armBase = [x1 + 6 * s, bot - 4 * s];
  const tip = rotP(L.armBase[0], L.armBase[1], -0.25, 0, 60 * s);
  const am = rotP(L.armBase[0], L.armBase[1], -0.25, 0, 22 * s);
  const ctop = top - 12 * s;
  const tail = [
    { x: x3 - hw3 - 4 * s, y: mid, ev: "qOff" },
    { x: x3, y: mid, ev: "pumpIII" },
    { x: x3, y: ctop, ev: "cOn" },
    { x: x4, y: ctop, ev: "gate" },
    { x: x4, y: mid, ev: "pumpIV" },
    { x: x4, y: bot + 12 * s, ev: "water" },
  ];
  L.nodes = {
    N: [{ x: tip[0], y: tip[1] }, { x: am[0], y: am[1] }, { x: x1, y: mid, ev: "pumpI" }, { x: x1 + hw1 + 4 * s, y: mid, ev: "qOn" }].concat(tail),
    F: [{ x: x2, y: bot + 16 * s }, { x: x2, y: mid, ev: "II" }, { x: x2 + hw2 + 4 * s, y: mid, ev: "qOn" }].concat(tail),
  };
  L.gi = { N: L.nodes.N.length - 3, F: L.nodes.F.length - 3 };
  L.lobes = [];
  for (let k = 0; k < 6; k++) {
    const p = (k * TAU) / 6 + TAU / 12;
    L.lobes.push({ k, alpha: k % 2 === 0, j: (k - 1) / 2, x: x5 + Math.sin(p) * F1r * 0.6, y: f1y + Math.cos(p) * F1r * 0.14, z: Math.cos(p), sx: Math.sin(p) });
  }
  L.lobesSorted = [...L.lobes].sort((a, b) => a.z - b.z);
  L.beta = [L.lobes[1], L.lobes[3], L.lobes[5]];
  const mw = clamp(w * 0.16, 96, 170), mh = mw * 0.58;
  L.map = { x: 10, y: h - mh - 24, w: mw, h: mh };
  const gw = clamp(w * 0.24, 140, 240), gh = clamp(h * 0.12, 50, 84);
  L.graph = { x: w - gw - 10, y: h - gh - 10, w: gw, h: gh };
  S = buildSprites(stage.dpr, s);
  MEM = buildMembrane(stage.dpr, L);
}

// ---------- simulation state ----------
function freshSim() {
  return {
    pool: 0, protons: [], packets: [], mols: [], fx: [], o2s: [], nadhs: [], amb: [], flabels: [],
    spawnAcc: 0, nextSpawn: 0.5, backlog: 0, gateHead: null, queueN: 0, reduced: 0,
    made: 0, hydro: 0, crankMade: 0, crankHydro: 0, water: 0, o2Refill: 0, nadhRefill: 0,
    rate: 0, rateAcc: 0, hist: [], histT: 0, heat: 0, leakAcc: 0,
    flash: { I: 0, II: 0, III: 0, IV: 0 },
    rotor: { th: 0, om: 0, kH: 0, kA: 0, grabbed: false, lastAng: 0, pend: 0, hand: 0, queue: 0 },
    highT: 0, cnT: 0, dnpT: 0, noO2T: 0,
    qIdle: [0, 1, 2].map(() => ({ ph: rand(0, TAU) })), cIdle: [0, 1].map(() => ({ ph: rand(0, TAU) })),
  };
}

function seedSim() {
  sim = freshSim();
  const n0 = Math.round(PCAP * 0.55);
  for (let i = 0; i < n0; i++) {
    sim.protons.push({ x: rand(8, L.w - 8), y: rand(8, L.top - 6), vx: 0, vy: 0, r: 3, st: "ims" });
    sim.pool++;
  }
  for (let i = 0; i < 3; i++) sim.amb.push(newMol("adp", rand(L.x5 - 100 * L.s, L.x5 + 100 * L.s), rand(L.bot + 20, L.h - 10)));
  for (let i = 0; i < 3; i++) sim.amb.push(newMol("pi", rand(L.x5 - 100 * L.s, L.x5 + 100 * L.s), rand(L.bot + 20, L.h - 10)));
  sim.rotor.om = st.olig ? 0 : TAU * TURNS_MAX * geff(gradient());
}

function newMol(k, x, y, vx = 0, vy = 0, life = Infinity) {
  return { k, x, y, vx, vy, dx: vx * 0.8, dy: vy * 0.8, r: 6, life, max: life };
}

// ---------- protons ----------
function setPath(p, pts, durs, delay = 0) { p.path = pts; p.durs = durs; p.seg = 0; p.pt = 0; p.d = delay; }
function followPath(p, dt) {
  if (p.d > 0) { p.d -= dt; p.x = p.path[0][0]; p.y = p.path[0][1]; return false; }
  p.pt += dt / p.durs[p.seg];
  while (p.pt >= 1) {
    if (p.seg >= p.path.length - 2) { const e = p.path[p.path.length - 1]; p.x = e[0]; p.y = e[1]; return true; }
    p.pt -= 1; p.seg++;
  }
  const a = p.path[p.seg], b = p.path[p.seg + 1], u = K.easeInOut(p.pt);
  p.x = lerp(a[0], b[0], u); p.y = lerp(a[1], b[1], u);
  return false;
}

function takeProton(x, y) {
  let best = null, bd = Infinity;
  for (const p of sim.protons) {
    if (p.st !== "ims") continue;
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bd) { bd = d; best = p; }
  }
  if (!best) best = sim.protons.find((p) => p.st === "pump") || null;
  if (!best) return null;
  sim.pool = Math.max(0, sim.pool - 1);
  return best;
}

function pumpFrom(x, n) {
  const s = L.s;
  for (let i = 0; i < n; i++) {
    const p = { x, y: L.bot + 16 * s, vx: 0, vy: 0, r: 3, st: "pump" };
    setPath(p, [[x + rand(-8, 8) * s, L.bot + 18 * s], [x + rand(-5, 5) * s, L.mid], [x + rand(-12, 12) * s, L.top - 8 * s]], [0.35, 0.35], i * 0.13);
    sim.protons.push(p);
    sim.pool++;
  }
}

function protonThroughSynthase() {
  const p = takeProton(L.ax, L.top);
  if (!p) return;
  const s = L.s, d0 = Math.hypot(p.x - L.ax, p.y - L.top);
  setPath(p, [[p.x, p.y], [L.ax - 2 * s, L.top - 3 * s], [L.ax - 7 * s, L.mid], [L.x5 + L.Rc * 0.45, L.bot + 6 * s]], [clamp(d0 / 420, 0.12, 0.5), 0.2, 0.2]);
  p.st = "syn";
}

function protonPumpedBySynthase() {
  const s = L.s;
  const p = { x: L.x5 + L.Rc * 0.45, y: L.bot + 8 * s, vx: 0, vy: 0, r: 3, st: "pump" };
  setPath(p, [[L.x5 + L.Rc * 0.45, L.bot + 8 * s], [L.ax - 7 * s, L.mid], [L.ax - 2 * s, L.top - 3 * s], [L.ax + rand(-16, 16) * s, L.top - 16 * s]], [0.2, 0.2, 0.25]);
  sim.protons.push(p);
  sim.pool++;
}

function leakEvent(hot) {
  const p = takeProton(rand(10, L.w - 10), L.top);
  if (!p) return;
  let xt = p.x;
  for (let k = 0; k < 12 && (L.skip(xt) || xt < 8 || xt > L.w - 8); k++) xt = rand(10, L.w - 10);
  setPath(p, [[p.x, p.y], [xt, L.top - 2], [xt, L.bot + 5]], [0.3, hot ? 0.35 : 0.6]);
  p.st = "leak"; p.hot = hot;
}

function updateProtons(dt) {
  const ps = sim.protons;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    if (p.st === "ims") {
      // gas-like wandering so H⁺ spread through the whole intermembrane space
      if (!p.sp) p.sp = rand(35, 85);
      p.vx += rand(-1, 1) * 260 * dt; p.vy += rand(-1, 1) * 260 * dt;
      const sp = Math.hypot(p.vx, p.vy) || 1;
      p.vx *= p.sp / sp; p.vy *= p.sp / sp;
      p.x += p.vx * dt; p.y += p.vy * dt;
      K.bounce(p, 4, 6, L.w - 4, L.top - 3);
    } else if (p.st === "out") {
      p.life -= dt * 0.9; p.y += 18 * dt; p.x += p.vx * dt;
      if (p.life <= 0) ps.splice(i, 1);
    } else if (followPath(p, dt)) {
      if (p.st === "pump") { p.st = "ims"; p.vx = rand(-20, 20); p.vy = rand(-40, -10); }
      else {
        if (p.st === "leak" && p.hot && sim.fx.length < 40) sim.fx.push({ k: "heat", x: p.x, y: L.mid, t: 0, dur: 0.9 });
        p.st = "out"; p.life = 1; p.vx = rand(-10, 10);
      }
    }
  }
}

// ---------- electron packets (2 e⁻ each) ----------
function flabel(text, x, y, color, force = false) {
  if (!force && L.w < 520) return;
  if (sim.flabels.some((f) => f.text === text)) return;
  sim.flabels.push({ text, x, y, color, life: 1.8 });
  if (sim.flabels.length > 3) sim.flabels.shift();
}

function spawnPacket() {
  const type = Math.random() < 1 / 6 ? "F" : "N";
  const p = { type, seg: 0, u: 0, d: type === "N" ? 0.35 : 0.15, ph: rand(0, TAU), carryQ: false, carryC: false, waiting: false, wait: 0 };
  if (type === "N") {
    const [tx, ty] = [L.nodes.N[0].x, L.nodes.N[0].y];
    let best = null, bd = Infinity;
    for (const n of sim.nadhs) if (n.dock == null) { const d = (n.x - tx) ** 2 + (n.y - ty) ** 2; if (d < bd) { bd = d; best = n; } }
    if (best) { best.dock = 0; best.fx0 = best.x; best.fy0 = best.y; }
    if (Math.random() < 0.3) flabel("NADH → NAD⁺ + H⁺ + 2e⁻", tx + 40 * L.s, ty + 16 * L.s, COL.nadh);
  } else {
    sim.flash.II = 1;
    if (Math.random() < 0.5) flabel("FADH₂ → FAD + 2e⁻", L.x2, L.bot + 46 * L.s, COL.fadh);
  }
  sim.packets.push(p);
}

function fireEvent(p, ev) {
  switch (ev) {
    case "pumpI": pumpFrom(L.x1, 4); sim.flash.I = 1; break;
    case "II": sim.flash.II = 1; break;
    case "qOn": p.carryQ = true; break;
    case "qOff": p.carryQ = false; break;
    case "pumpIII": pumpFrom(L.x3, 4); sim.flash.III = 1; break;
    case "cOn": p.carryC = true; break;
    case "pumpIV": pumpFrom(L.x4, 2); sim.flash.IV = 1; break;
    case "water": makeWater(); p.done = true; break;
  }
}

function advance(p, ds) {
  const nodes = L.nodes[p.type], gi = L.gi[p.type];
  let rem = ds;
  while (rem > 0 && !p.done) {
    const a = nodes[p.seg], b = nodes[p.seg + 1];
    const len = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
    const left = (1 - p.u) * len;
    if (rem < left) { p.u += rem / len; break; }
    rem -= left; p.seg++; p.u = 0;
    fireEvent(p, nodes[p.seg].ev);
    if (p.seg >= nodes.length - 1) { p.done = true; break; }
    if (p.seg === gi - 1) break; // now approaching complex IV: single-file queue below
  }
}

function updatePackets(dt, G) {
  const v = 150 * L.s * backpressure(G);
  const spacing = Math.max(16 * L.s, 10);
  const approach = [];
  for (const p of sim.packets) {
    if (p.d > 0) { p.d -= dt; continue; }
    if (p.waiting) continue;
    if (p.seg === L.gi[p.type] - 1) { approach.push(p); continue; }
    advance(p, v * dt);
  }
  // single file along cytochrome c's route to complex IV
  approach.sort((a, b) => b.u - a.u);
  let lim = sim.gateHead ? spacing : 0;
  for (const p of approach) {
    const nodes = L.nodes[p.type], gi = L.gi[p.type];
    const a = nodes[gi - 1], b = nodes[gi];
    const len = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
    const maxU = 1 - lim / len;
    if (p.u < maxU) p.u = Math.min(maxU, p.u + (v * dt) / len);
    if (p.u >= 1 && !sim.gateHead) {
      p.seg = gi; p.u = 0; p.waiting = true; p.wait = 0; sim.gateHead = p; lim = spacing;
      continue;
    }
    lim = (1 - p.u) * len + spacing;
  }
  // complex IV hands electrons to O₂ one pair at a time
  const g = sim.gateHead;
  if (g) {
    g.wait += (dt * o2f()) / 0.25;
    if (g.wait >= 1) { g.waiting = false; g.carryC = false; sim.gateHead = null; sim.flash.IV = 1; }
  }
  sim.queueN = approach.length + (sim.gateHead ? 1 : 0);
  sim.packets = sim.packets.filter((p) => !p.done);

  // supply of NADH / FADH₂
  const supply = (SUPPLY_MAX * st.nadh) / 100;
  const bp = backpressure(G);
  const full = sim.queueN >= 5 || sim.pool >= PCAP * 1.05;
  if (!full) {
    const extra = sim.backlog > 0.5 ? 0.5 : 0;
    sim.spawnAcc += (supply + extra) * bp * dt;
    if (extra) sim.backlog = Math.max(0, sim.backlog - extra * bp * dt);
  } else {
    sim.backlog = Math.min(20, sim.backlog + supply * dt * 0.5);
  }
  if (sim.spawnAcc >= sim.nextSpawn) {
    sim.spawnAcc -= sim.nextSpawn;
    sim.nextSpawn = rand(0.5, 1.5);
    spawnPacket();
  }
}

function packetPos(p) {
  const nodes = L.nodes[p.type];
  if (p.waiting) { const g = nodes[L.gi[p.type]]; return [g.x, g.y]; }
  if (p.seg >= nodes.length - 1) { const e = nodes[nodes.length - 1]; return [e.x, e.y]; }
  const a = nodes[p.seg], b = nodes[p.seg + 1];
  return [lerp(a.x, b.x, p.u), lerp(a.y, b.y, p.u)];
}

function makeWater() {
  sim.water++;
  const s = L.s;
  sim.mols.push(newMol("h2o", L.x4 + rand(-6, 6) * s, L.bot + 16 * s, rand(-20, 20) * s, rand(25, 45) * s, 5));
  if (sim.water % 2 === 0) {
    // ½ O₂ per electron pair → one O₂ molecule per two water molecules
    let best = -1, bd = Infinity;
    sim.o2s.forEach((o, i) => { const d = (o.x - L.x4) ** 2 + (o.y - L.bot) ** 2; if (d < bd) { bd = d; best = i; } });
    if (best >= 0) {
      const o = sim.o2s.splice(best, 1)[0];
      sim.fx.push({ k: "pop", x: o.x, y: o.y, t: 0, dur: 0.5 });
    }
  }
  if (sim.water % 5 === 1) flabel("½O₂ + 2H⁺ + 2e⁻ → H₂O", L.x4, L.bot + 44 * s, COL.h2o);
  capMols();
}

function capMols() { while (sim.mols.length > 70) sim.mols.shift(); }

// ---------- ATP synthase rotor ----------
function betaWith(state) {
  for (let j = 0; j < 3; j++) if (betaState(j, sim.rotor.kA) === state) return L.beta[j];
  return L.beta[0];
}

function makeATP(byHand) {
  sim.made++;
  if (byHand) sim.crankMade++;
  sim.rateAcc += 1;
  const bt = betaWith(1), bo = betaWith(2); // new Tight site forms ATP; new Open site releases one
  sim.fx.push({ k: "snap", x: bt.x, y: bt.y, t: 0, dur: 0.6 });
  sim.mols.push(newMol("atp", bo.x, bo.y + 4, rand(-45, -10), rand(15, 35), 6));
  if (byHand || sim.made % 7 === 1) flabel("ADP + Pi → ATP", Math.max(60, L.x5 - L.ringR - 56), L.f1y, COL.atp, byHand);
  capMols();
}

function hydrolyse() {
  sim.hydro++;
  sim.crankHydro++;
  sim.rateAcc -= 1;
  const b = betaWith(0);
  sim.fx.push({ k: "atpIn", x: b.x, y: b.y, t: 0, dur: 0.3 });
  sim.mols.push(newMol("adp", b.x, b.y + 4, rand(-40, -10) * L.s, rand(20, 40) * L.s, 3));
  sim.mols.push(newMol("pi", b.x, b.y + 4, rand(10, 40) * L.s, rand(20, 40) * L.s, 3));
  flabel("ATP → ADP + Pi", Math.max(60, L.x5 - L.ringR - 56), L.f1y + 22, C.orange, true);
  capMols();
}

const lastNote = {};
function notifyOnce(key, msg, ms = 3500) {
  const now = performance.now();
  if (lastNote[key] && now - lastNote[key] < ms) return;
  lastNote[key] = now;
  toast(msg, 3000);
}

function updateRotor(dt, G) {
  const R = sim.rotor;
  const hand = R.grabbed || Math.abs(R.queue) > 1e-4;
  if (hand) {
    let d = 0;
    if (R.grabbed) { d = R.pend; R.pend = 0; }
    else { d = Math.sign(R.queue) * Math.min(Math.abs(R.queue), 5 * dt); R.queue -= d; }
    if (dt <= 0) { if (d !== 0) notifyOnce("paused", "The simulation is paused — press Play to crank."); d = 0; R.queue = 0; }
    if (d !== 0 && st.olig) { d = 0; R.queue = 0; notifyOnce("olig", "Oligomycin has jammed the F₀ rotor — it won't turn."); }
    d = clamp(d, -STEP_A * 0.45, STEP_A * 0.45);
    if (d < 0 && Math.floor((R.th + d) / STEP_A) < R.kA && netATP() <= 0) {
      d = Math.min(0, R.kA * STEP_A + 1e-4 - R.th); R.queue = 0;
      notifyOnce("noatp", "No ATP left to hydrolyse — running backwards needs ATP as fuel.");
    }
    R.th += d;
    if (dt > 0) R.hand = lerp(R.hand, d / dt, 0.25);
    R.om = R.hand;
  } else {
    R.hand *= 0.85;
    const target = st.olig ? 0 : TAU * TURNS_MAX * geff(G);
    R.om = Math.max(0, R.om + (target - R.om) * (1 - Math.exp(-dt * (st.olig ? 8 : 2.5))));
    if (Math.floor((R.th + R.om * dt) / STEP_H) > R.kH && sim.pool <= 0) { R.om = 0; }
    R.th += R.om * dt;
  }
  const kH = Math.floor(R.th / STEP_H);
  while (kH > R.kH) { R.kH++; protonThroughSynthase(); }
  while (kH < R.kH) { R.kH--; protonPumpedBySynthase(); }
  const kA = Math.floor(R.th / STEP_A);
  while (kA > R.kA) { R.kA++; makeATP(hand); }
  while (kA < R.kA) { R.kA--; hydrolyse(); }
  return hand;
}

// ---------- ambient molecules ----------
function updateMolecules(dt) {
  const s = L.s;
  // O₂ diffusing in from the blood
  const o2Target = st.o2 > 0 ? Math.max(1, Math.round((st.o2 / 100) * 7)) : 0;
  if (sim.o2s.length < o2Target) {
    sim.o2Refill += dt * 1.5;
    if (sim.o2Refill >= 1) { sim.o2Refill = 0; sim.o2s.push(newMol("o2", rand(L.x2 + 20 * s, L.x5 - L.F1r - 20 * s), rand(L.bot + 30 * s, L.h - 10), rand(-20, 20), rand(-20, 20))); }
  } else if (sim.o2s.length > o2Target) sim.o2s.pop();
  for (const o of sim.o2s) { K.brownian(o, dt, 600, 0.9); K.bounce(o, L.x2 + 10 * s, L.bot + 26 * s, L.x5 - L.F1r - 10 * s, L.h - 6); }

  // NADH pool (grows if the chain is blocked — NAD⁺ is not regenerated)
  const nTarget = (st.nadh > 0 ? Math.round(1 + st.nadh / 20) : 0) + Math.min(8, Math.round(sim.backlog));
  const free = sim.nadhs.filter((n) => n.dock == null).length;
  if (free < nTarget) {
    sim.nadhRefill += dt * 2;
    if (sim.nadhRefill >= 1) { sim.nadhRefill = 0; sim.nadhs.push(newMol("nadh", rand(10, Math.max(L.x2, 60)), rand(L.bot + 30 * s, L.h - 10), rand(-20, 20), rand(-20, 20))); }
  } else if (free > nTarget) {
    const i = sim.nadhs.findIndex((n) => n.dock == null);
    if (i >= 0) sim.nadhs.splice(i, 1);
  }
  const tip = L.nodes.N[0];
  for (let i = sim.nadhs.length - 1; i >= 0; i--) {
    const n = sim.nadhs[i];
    if (n.dock != null) {
      n.dock += dt / 0.35;
      const u = K.easeInOut(Math.min(1, n.dock));
      n.x = lerp(n.fx0, tip.x, u); n.y = lerp(n.fy0, tip.y + 6 * s, u);
      if (n.dock >= 1) {
        sim.nadhs.splice(i, 1);
        sim.mols.push(newMol("nad", n.x, n.y, rand(-30, 10) * s, rand(20, 40) * s, 3));
      }
    } else {
      K.brownian(n, dt, 600, 0.9);
      K.bounce(n, 8, L.bot + 26 * s, Math.max(L.x2 + 10 * s, 60), L.h - 6);
    }
  }
  // ADP + Pi waiting near ATP synthase
  for (const a of sim.amb) { K.brownian(a, dt, 500, 0.9); K.bounce(a, Math.max(4, L.x5 - 110 * s), L.f1y - 4 * s, Math.min(L.w - 4, L.x5 + 110 * s), L.h - 6); }
  // released products
  for (let i = sim.mols.length - 1; i >= 0; i--) {
    const m = sim.mols[i];
    K.brownian(m, dt, 500, 0.92);
    m.x += m.dx * dt; m.y += m.dy * dt;
    K.bounce(m, 4, L.bot + 6, L.w - 4, L.h - 4);
    m.life -= dt;
    if (m.life <= 0) sim.mols.splice(i, 1);
  }
}

// ---------- main update ----------
function update(dt) {
  let G = gradient();
  const hand = updateRotor(dt, G);
  updatePackets(dt, G);

  // leak across the bilayer (basal + uncoupler)
  G = gradient();
  const lb = LEAK_BASE * G, ld = st.dnp ? LEAK_DNP * G : 0;
  sim.leakAcc += (lb + ld) * dt;
  while (sim.leakAcc >= 1) {
    sim.leakAcc -= 1;
    if (sim.pool > 0) leakEvent(st.dnp && Math.random() < ld / (lb + ld));
  }
  const heatTarget = st.dnp ? clamp(0.35 + ld / 8, 0, 1) : 0;
  sim.heat += (heatTarget - sim.heat) * (1 - Math.exp(-dt * 1.5));

  updateProtons(dt);
  updateMolecules(dt);

  for (const k in sim.flash) sim.flash[k] = Math.max(0, sim.flash[k] - dt * 2.2);
  sim.reduced += (clamp((sim.queueN - 2) / 3, 0, 1) - sim.reduced) * (1 - Math.exp(-dt * 3));
  for (let i = sim.fx.length - 1; i >= 0; i--) { const f = sim.fx[i]; f.t += dt; if (f.t >= f.dur) sim.fx.splice(i, 1); }
  for (let i = sim.flabels.length - 1; i >= 0; i--) { const f = sim.flabels[i]; f.life -= dt; if (f.life <= 0) sim.flabels.splice(i, 1); }

  // ATP rate (exponential moving average, τ = 2 s) and history
  if (dt > 0) {
    sim.rate = sim.rate * Math.exp(-dt / 2) + sim.rateAcc / 2;
    sim.rateAcc = 0;
    sim.histT += dt;
    while (sim.histT >= 0.25) { sim.histT -= 0.25; sim.hist.push(sim.rate); if (sim.hist.length > 120) sim.hist.shift(); }
  }

  // mission timers
  if (!hand && sim.rate >= 1.9) sim.highT += dt; else if (hand || sim.rate < 1.8) sim.highT = 0;
  sim.cnT = st.cyanide ? sim.cnT + dt : 0;
  sim.dnpT = st.dnp ? sim.dnpT + dt : 0;
  sim.noO2T = st.o2 === 0 ? sim.noO2T + dt : 0;
}

// ---------- rendering ----------
function render(t) {
  const { w, h, s } = L;
  const G = gradient();
  const R = sim.rotor;

  K.backdrop(ctx, w, h, "#0e2c45");
  let g = ctx.createLinearGradient(0, 0, 0, L.top);
  g.addColorStop(0, K.withAlpha(COL.H, 0.02));
  g.addColorStop(1, K.withAlpha(COL.H, 0.05 + 0.17 * G));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, L.top);
  g = ctx.createLinearGradient(0, L.bot, 0, h);
  g.addColorStop(0, "rgba(79,209,197,0.08)"); g.addColorStop(1, "rgba(79,209,197,0.01)");
  ctx.fillStyle = g; ctx.fillRect(0, L.bot, w, h - L.bot);

  // far, out-of-focus layer
  ctx.fillStyle = "rgba(160,200,255,0.08)";
  for (const f of far) {
    const x = ((f.x + t * f.sp) % 1) * w, y = f.y * h;
    ctx.beginPath(); ctx.arc(x, y, f.r * (1 + s), 0, TAU); ctx.fill();
  }

  // electron route guide
  ctx.save();
  ctx.setLineDash([3, 6]); ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(255,243,176,0.16)";
  ctx.beginPath();
  L.nodes.N.forEach((n, i) => (i ? ctx.lineTo(n.x, n.y) : ctx.moveTo(n.x, n.y)));
  ctx.moveTo(L.nodes.F[0].x, L.nodes.F[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(L.nodes.F[i].x, L.nodes.F[i].y);
  ctx.stroke();
  ctx.restore();

  ctx.drawImage(MEM.c, 0, MEM.y, MEM.w, MEM.h);
  if (sim.heat > 0.02) {
    ctx.fillStyle = K.withAlpha(C.orange, 0.26 * sim.heat * (0.8 + 0.2 * Math.sin(t * 7)));
    ctx.fillRect(0, L.top, w, L.th);
  }

  drawETC(ctx, L, { t, flash: sim.flash, reduced: sim.reduced, cyanide: st.cyanide });

  // idle ubiquinone (in the membrane) and cytochrome c (on the IMS face)
  const qa = L.x1 + L.hw1 + 8 * s, qb = L.x3 - L.hw3 - 8 * s;
  for (const q of sim.qIdle) {
    const x = lerp(qa, qb, 0.5 + 0.45 * Math.sin(t * 0.5 + q.ph));
    spr(ctx, sim.reduced > 0.4 ? S.qred : S.q, x, L.mid + Math.sin(t * 1.3 + q.ph) * 3 * s, 0.85);
  }
  for (const c of sim.cIdle) {
    const x = lerp(L.x3 + 14 * s, L.x4 - 14 * s, 0.5 + 0.4 * Math.sin(t * 0.7 + c.ph));
    spr(ctx, S.cytc, x, L.top - 14 * s + Math.sin(t * 1.7 + c.ph) * 2, 0.8);
  }

  drawSynthase(ctx, L, R.th, R.kA, { olig: st.olig, showStates: w >= 700 });

  // matrix molecules
  for (const o of sim.o2s) spr(ctx, S.o2, o.x, o.y, 0.9);
  for (const n of sim.nadhs) spr(ctx, S.nadh, n.x, n.y);
  for (const a of sim.amb) spr(ctx, a.k === "adp" ? S.adp : S.pi, a.x, a.y, 0.75);
  for (const m of sim.mols) {
    const a = clamp(m.life / 1.2, 0, 1);
    const sp = m.k === "atp" ? S.atp : m.k === "h2o" ? S.h2o : m.k === "nad" ? S.nad : m.k === "adp" ? S.adp : S.pi;
    spr(ctx, sp, m.x, m.y, a);
  }

  // H⁺
  for (const p of sim.protons) {
    if (p.d > 0) continue;
    let a = 1;
    if (p.st === "out") a = p.life * 0.8;
    else if (p.st === "pump" && p.seg === 0) a = 0.35 + 0.65 * p.pt;
    const hot = p.st === "leak" && p.hot;
    spr(ctx, hot ? S.Hhot : S.H, p.x, p.y, a);
    if (hot) spr(ctx, S.dnp, p.x + 5 * s + 2, p.y - 3 * s);
  }

  // electron pairs (+ the carrier they ride on)
  for (const p of sim.packets) {
    let [x, y] = packetPos(p);
    let a = 1;
    if (p.d > 0) a = 0.4;
    if (p.waiting === false && p.seg === L.gi[p.type] - 1 && p.u < 0.02 && sim.queueN > 3) a = 0.8;
    if (p.carryQ) spr(ctx, S.qred, x, y);
    if (p.carryC) spr(ctx, S.cytc, x, y);
    const ph = t * 7 + p.ph, ox = Math.cos(ph) * 3.5 * s, oy = Math.sin(ph) * 2.5 * s;
    spr(ctx, S.e, x + ox, y + oy, a);
    spr(ctx, S.e, x - ox, y - oy, a);
  }

  // effects
  for (const f of sim.fx) {
    const u = f.t / f.dur;
    if (f.k === "snap") {
      if (f.t < 0.3) {
        const v = K.easeOut(f.t / 0.3);
        spr(ctx, S.adp, lerp(f.x - 26 * s, f.x, v), lerp(f.y + 22 * s, f.y, v));
        spr(ctx, S.pi, lerp(f.x + 26 * s, f.x, v), lerp(f.y + 22 * s, f.y, v));
      } else {
        K.glow(ctx, f.x, f.y, (14 + 26 * u) * s + 6, C.amber, 0.7 * (1 - u));
      }
    } else if (f.k === "atpIn") {
      const v = K.easeInOut(Math.min(1, u * 1.3));
      spr(ctx, S.atp, f.x, lerp(f.y + 34 * s, f.y, v), 1 - u * 0.6);
      K.glow(ctx, f.x, f.y, 24 * s + 4, C.orange, 0.4 * u);
    } else if (f.k === "heat") {
      K.glow(ctx, f.x, f.y - 10 * s * u, (12 + 22 * u) * s + 4, C.orange, 0.55 * (1 - u));
    } else if (f.k === "pop") {
      K.glow(ctx, f.x, f.y, (10 + 16 * u) * s + 3, COL.o2, 0.5 * (1 - u));
    }
  }

  // heat shimmer (uncoupler)
  if (sim.heat > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineWidth = 5 * s + 2;
    ctx.lineCap = "round";
    const n = Math.max(8, Math.round(w / 70));
    for (let i = 0; i < n; i++) {
      const x0 = ((i + 0.5) / n) * w + Math.sin(t * 0.7 + i * 1.7) * 12;
      const amp = (3 + 4 * sim.heat) * s + 1;
      for (const dir of [-1, 1]) {
        const y0 = dir < 0 ? L.top - 4 : L.bot + 4;
        const len = (dir < 0 ? L.top : h - L.bot) * 0.45 * (0.6 + 0.4 * Math.sin(i * 2.1 + t * 0.9));
        const gr = ctx.createLinearGradient(0, y0, 0, y0 + dir * len);
        gr.addColorStop(0, K.withAlpha(C.orange, 0.4 * sim.heat));
        gr.addColorStop(1, K.withAlpha(C.orange, 0));
        ctx.strokeStyle = gr;
        ctx.beginPath();
        for (let k = 0; k <= 12; k++) {
          const yy = y0 + (dir * len * k) / 12;
          const xx = x0 + Math.sin(yy * 0.07 + t * 6 + i) * amp;
          k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawCrank(t);
  drawLabels(t);
  drawMeter(G);
  drawGraph();
  drawMapInset(t);
  drawZoom(t);
}

function drawCrank(t) {
  const R = sim.rotor, s = L.s, cx = L.x5, cy = L.f1y, rr = L.ringR;
  const active = R.grabbed || hover === "rotor";
  ctx.save();
  ctx.setLineDash([4, 6]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = active ? "rgba(251,191,36,0.6)" : "rgba(251,191,36,0.2)";
  ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  // "make ATP" direction (anticlockwise on screen)
  ctx.strokeStyle = active ? "rgba(251,191,36,0.75)" : "rgba(251,191,36,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, rr + 9, -0.25, -1.25, true); ctx.stroke();
  const ae = -1.35, ab = -1.15;
  K.arrow(ctx, cx + Math.cos(ab) * (rr + 9), cy + Math.sin(ab) * (rr + 9), cx + Math.cos(ae) * (rr + 9), cy + Math.sin(ae) * (rr + 9), active ? "rgba(251,191,36,0.85)" : "rgba(251,191,36,0.4)", 2);
  if (L.w >= 480) {
    ctx.font = `600 ${Math.round(9 + 2 * s)}px Inter, sans-serif`;
    ctx.fillStyle = active ? "rgba(251,191,36,0.95)" : "rgba(251,191,36,0.55)";
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("make ATP", cx + Math.cos(-0.55) * (rr + 14), cy + Math.sin(-0.55) * (rr + 14));
  }
  // crank arm + handle
  const ha = -R.th - Math.PI / 2;
  const hx = cx + Math.cos(ha) * rr, hy = cy + Math.sin(ha) * rr;
  ctx.strokeStyle = active ? "rgba(251,191,36,0.45)" : "rgba(251,191,36,0.15)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(hx, hy); ctx.stroke();
  ctx.restore();
  const hr = Math.max(8, 9 * s);
  K.glow(ctx, hx, hy, hr * 2.4, C.amber, active ? 0.6 : 0.3);
  K.sphere(ctx, hx, hy, hr, C.amber);
  if (!grabbedOnce) {
    const pr = hr + 6 + 6 * (0.5 + 0.5 * Math.sin(t * 4));
    ctx.save(); ctx.strokeStyle = "rgba(251,191,36,0.6)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(hx, hy, pr, 0, TAU); ctx.stroke(); ctx.restore();
    K.label(ctx, "Drag the handle in a circle", clamp(cx, 90, L.w - 90), cy + rr + 22, { color: C.amber, size: 11 });
  }
}

function drawLabels(t) {
  const { s, w } = L;
  ctx.save();
  ctx.font = `600 ${Math.round(10 + s)}px Inter, sans-serif`;
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(244,114,182,0.75)";
  ctx.fillText(w < 560 ? "INTERMEMBRANE SPACE" : "INTERMEMBRANE SPACE · high [H⁺]", 12, L.top - 30 * s - 8);
  ctx.fillStyle = "rgba(79,209,197,0.75)";
  ctx.fillText(w < 560 ? "MATRIX" : "MATRIX · low [H⁺]", 12, L.map.y - 14);
  if (w >= 700) {
    ctx.textAlign = "right"; ctx.fillStyle = "rgba(232,241,255,0.45)";
    ctx.fillText("INNER MEMBRANE", w - 10, L.mid);
  }
  ctx.restore();
  K.label(ctx, "ATP synthase", L.x5, L.top - 22 * s - 8, { size: 11, color: C.amber });
  if (w >= 520) {
    K.label(ctx, "Q", lerp(L.x1 + L.hw1, L.x3 - L.hw3, 0.5), L.mid - 16 * s - 6, { size: 10, color: COL.q, bg: null });
    K.label(ctx, "cyt c", (L.x3 + L.x4) / 2, L.top - 30 * s - 6, { size: 10, color: COL.cytc, bg: null });
  }
  if (w >= 800) {
    K.label(ctx, "F₀", L.x5 - L.Rc - 16 * s, L.mid, { size: 10, color: COL.cring, bg: null });
    K.label(ctx, "F₁", L.x5 - L.F1r - 12 * s, L.f1y, { size: 10, color: COL.beta, bg: null });
  }
  if (sim.heat > 0.3) {
    K.label(ctx, w < 560 ? "Heat released" : "Energy released as heat, not ATP", (L.x4 + L.x5) / 2, L.top - 44 * s - 10, { size: 11, color: C.orange });
  }
  if (sim.queueN >= 4) {
    K.label(ctx, w < 560 ? "e⁻ backed up!" : "e⁻ backed up — complex IV can't pass them on", (L.x3 + L.x4) / 2, L.top - 44 * s - 10, { size: 11, color: C.red });
  }
  for (const f of sim.flabels) {
    ctx.globalAlpha = clamp(f.life * 1.5, 0, 1);
    K.label(ctx, f.text, f.x, f.y, { size: 11, color: f.color });
    ctx.globalAlpha = 1;
  }
}

function drawMeter(G) {
  const x = L.w - 22, y0 = Math.max(L.top * 0.42, 50), y1 = L.top - 12;
  if (y1 - y0 < 30) return;
  ctx.save();
  K.roundRect(ctx, x, y0, 12, y1 - y0, 6);
  ctx.fillStyle = "rgba(5,11,22,0.65)"; ctx.fill();
  ctx.strokeStyle = "rgba(120,190,255,0.25)"; ctx.lineWidth = 1; ctx.stroke();
  const fh = (y1 - y0 - 4) * G;
  if (fh > 1) {
    const gr = ctx.createLinearGradient(0, y1, 0, y0);
    gr.addColorStop(0, "#7c3aed"); gr.addColorStop(1, COL.H);
    K.roundRect(ctx, x + 2, y1 - 2 - fh, 8, fh, 4);
    ctx.fillStyle = gr; ctx.fill();
  }
  // threshold tick (minimum gradient that can drive ATP synthase)
  const ty = y1 - 2 - (y1 - y0 - 4) * G_THRESH;
  ctx.strokeStyle = "rgba(251,191,36,0.6)"; ctx.beginPath(); ctx.moveTo(x - 3, ty); ctx.lineTo(x + 15, ty); ctx.stroke();
  ctx.font = "600 10px Inter, sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = COL.H;
  ctx.fillText("H⁺", x + 6, y0 - 8);
  ctx.restore();
}

function drawGraph() {
  const gr = L.graph, hist = sim.hist;
  ctx.save();
  K.roundRect(ctx, gr.x, gr.y, gr.w, gr.h, 10);
  ctx.fillStyle = "rgba(5,11,22,0.75)"; ctx.fill();
  ctx.strokeStyle = "rgba(120,190,255,0.18)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.font = "600 10px Inter, sans-serif"; ctx.textBaseline = "middle";
  ctx.fillStyle = C.inkDim; ctx.textAlign = "left";
  ctx.fillText("ATP made per second", gr.x + 8, gr.y + 10);
  ctx.textAlign = "right"; ctx.fillStyle = C.amber;
  ctx.fillText(sim.rate.toFixed(1), gr.x + gr.w - 8, gr.y + 10);
  const px0 = gr.x + 8, px1 = gr.x + gr.w - 8, py0 = gr.y + 20, py1 = gr.y + gr.h - 6;
  let maxV = 2.5, minV = 0;
  for (const v of hist) { if (v > maxV) maxV = v; if (v < minV) minV = v; }
  const Y = (v) => py1 - ((v - minV) / (maxV - minV)) * (py1 - py0);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath(); ctx.moveTo(px0, Y(0)); ctx.lineTo(px1, Y(0)); ctx.stroke();
  ctx.setLineDash([2, 4]);
  ctx.beginPath(); ctx.moveTo(px0, Y(2)); ctx.lineTo(px1, Y(2)); ctx.stroke();
  ctx.setLineDash([]);
  if (hist.length > 1) {
    const X = (i) => px1 - ((hist.length - 1 - i) / 119) * (px1 - px0);
    ctx.beginPath();
    hist.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
    ctx.lineTo(X(hist.length - 1), Y(0)); ctx.lineTo(X(0), Y(0)); ctx.closePath();
    ctx.fillStyle = "rgba(251,191,36,0.14)"; ctx.fill();
    ctx.beginPath();
    hist.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
    ctx.strokeStyle = C.amber; ctx.lineWidth = 1.8; ctx.stroke();
  }
  ctx.restore();
}

function drawMapInset(t) {
  const m = L.map;
  ctx.save();
  K.roundRect(ctx, m.x - 4, m.y - 4, m.w + 8, m.h + 22, 10);
  ctx.fillStyle = "rgba(5,11,22,0.7)"; ctx.fill();
  ctx.strokeStyle = hover === "map" ? C.amber : "rgba(120,190,255,0.2)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
  drawMito(ctx, m.x + 4, m.y + 3, m.w - 8, m.h - 6, t, { marker: true });
  ctx.save();
  ctx.font = "600 10px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = C.inkDim;
  ctx.fillText(m.w < 140 ? "Tap to zoom out" : "Tap: whole mitochondrion", m.x + m.w / 2, m.y + m.h + 9);
  ctx.restore();
}

function drawZoom(t) {
  if (zoom <= 0.001) return;
  const { w, h } = L;
  const e = K.easeInOut(zoom);
  ctx.fillStyle = `rgba(5,11,22,${0.93 * e})`;
  ctx.fillRect(0, 0, w, h);
  const compact = w < 600;
  const bw = Math.min(w * 0.84, h * 0.46 * 1.9), bh = bw / 1.9;
  const big = { x: (w - bw) / 2, y: Math.max(112, h * 0.45 - bh / 2), w: bw, h: bh };
  const m = L.map;
  const sm = { x: m.x + 4, y: m.y + 3, w: m.w - 8, h: m.h - 6 };
  const r = { x: lerp(sm.x, big.x, e), y: lerp(sm.y, big.y, e), w: lerp(sm.w, big.w, e), h: lerp(sm.h, big.h, e) };
  const mk = drawMito(ctx, r.x, r.y, r.w, r.h, t, { marker: true, labels: e > 0.97, compact });
  if (mk && e > 0.02 && e < 0.98) {
    const a = 4 * e * (1 - e);
    ctx.strokeStyle = K.withAlpha(C.amber, 0.8 * a); ctx.lineWidth = 2;
    ctx.strokeRect(lerp(0, mk.x, e), lerp(0, mk.y, e), lerp(w, mk.w, e), lerp(h, mk.h, e));
  }
  if (e > 0.97) {
    K.label(ctx, "A mitochondrion · about 1–2 µm long", w / 2, big.y - 54, { size: 13 });
    K.label(ctx, "Tap anywhere to zoom back into the inner membrane", w / 2, Math.min(h - 16, big.y + big.h + 82), { size: 11, color: C.amber });
  }
}

// ---------- pointer ----------
function onRotor(x, y) {
  return K.dist(x, y, L.x5, L.f1y) <= L.ringR + 22 ||
    (Math.abs(x - L.x5) < L.Rc + 18 * L.s && y > L.top - 10 && y < L.bot + 10);
}
function onMap(x, y) {
  const m = L.map;
  return x >= m.x - 6 && x <= m.x + m.w + 6 && y >= m.y - 6 && y <= m.y + m.h + 20;
}
const INFO = {
  I: "<strong>Complex I</strong> (NADH dehydrogenase): takes 2 e⁻ from NADH and pumps <strong>4 H⁺</strong> into the intermembrane space.",
  II: "<strong>Complex II</strong> (succinate dehydrogenase — also a Krebs cycle enzyme): passes 2 e⁻ from FADH₂ to ubiquinone. It pumps <strong>no H⁺</strong>, so FADH₂ yields less ATP than NADH.",
  III: "<strong>Complex III</strong> (cytochrome bc₁): takes e⁻ from ubiquinol (QH₂), passes them to cytochrome c and moves <strong>4 H⁺</strong> into the intermembrane space.",
  IV: "<strong>Complex IV</strong> (cytochrome c oxidase): gives e⁻ to <strong>O₂</strong>, the final electron acceptor, making water, and pumps <strong>2 H⁺</strong>. Cyanide blocks it.",
};
function complexAt(x, y) {
  const { s } = L;
  if (y < L.top - 34 * s || y > L.bot + 66 * s) return null;
  const list = [["I", L.x1, L.hw1 + 10 * s], ["II", L.x2, L.hw2], ["III", L.x3, L.hw3], ["IV", L.x4, L.hw4]];
  for (const [k, x0, hw] of list) if (Math.abs(x - x0) < hw + 6) return k;
  return null;
}

K.pointer(canvas, {
  down(p) {
    if (zoomTarget === 1 || zoom > 0.5) { zoomTarget = 0; return; }
    if (onMap(p.x, p.y)) { zoomTarget = 1; return; }
    if (onRotor(p.x, p.y)) {
      const R = sim.rotor;
      R.grabbed = true; R.pend = 0; R.queue = 0;
      R.lastAng = Math.atan2(p.y - L.f1y, p.x - L.x5);
      grabbedOnce = true;
      canvas.style.cursor = "grabbing";
      return;
    }
    const c = complexAt(p.x, p.y);
    if (c) toast(INFO[c], 5000);
  },
  move(p) {
    const R = sim.rotor;
    if (R.grabbed) {
      const a = Math.atan2(p.y - L.f1y, p.x - L.x5);
      if (K.dist(p.x, p.y, L.x5, L.f1y) > 8) {
        let d = a - R.lastAng;
        if (d > Math.PI) d -= TAU;
        if (d < -Math.PI) d += TAU;
        R.pend -= d; // anticlockwise on screen = synthesis direction
      }
      R.lastAng = a;
      return;
    }
    hover = zoom > 0.5 ? null : onMap(p.x, p.y) ? "map" : onRotor(p.x, p.y) ? "rotor" : complexAt(p.x, p.y) ? "complex" : null;
    canvas.style.cursor = zoom > 0.5 ? "zoom-in" : hover === "rotor" ? "grab" : hover === "map" ? "zoom-out" : hover === "complex" ? "help" : "default";
  },
  up() { releaseRotor(); },
});
function releaseRotor() { if (sim) { sim.rotor.grabbed = false; sim.rotor.pend = 0; } canvas.style.cursor = "default"; }
canvas.addEventListener("pointercancel", releaseRotor);
canvas.addEventListener("lostpointercapture", releaseRotor);

// ---------- panel ----------
const explain = K.card(panel, "What's happening", "explain");
const exBody = document.createElement("div");
explain.appendChild(exBody);
const note = document.createElement("p");
note.className = "note";
note.innerHTML = "Not to scale and slowed ~100× (a real ATP synthase spins over 100 times a second). Simplified: each glowing pair = 2 electrons (cytochrome c really carries one at a time); 10 H⁺ pumped per NADH (4 + 4 + 2) and 6 per FADH₂; 9 H⁺ per rotor turn → 3 H⁺ per ATP. Real human ATP synthase has 8 c-subunits (≈ 2.7 H⁺ per ATP, plus ≈ 1 H⁺ to bring phosphate in). Tap a complex for details.";
explain.appendChild(note);

const ctrl = K.card(panel, "Controls");
const sO2 = K.slider(ctrl, { label: "Oxygen (O₂) level", min: 0, max: 100, step: 5, value: st.o2, unit: "%", onInput: (v) => (st.o2 = v) });
const sN = K.slider(ctrl, { label: "NADH supply (glucose / Krebs input)", min: 0, max: 100, step: 5, value: st.nadh, unit: "%", onInput: (v) => (st.nadh = v) });
const cbCN = K.checkbox(ctrl, "Cyanide — blocks complex IV", false, (v) => {
  st.cyanide = v;
  if (v) toast("Cyanide has bound complex IV. Watch the electrons back up…");
});
const cbDNP = K.checkbox(ctrl, "Uncoupler (DNP) — H⁺ leak through membrane", false, (v) => {
  st.dnp = v;
  if (v) toast("DNP is ferrying H⁺ straight across the membrane — feel the heat.");
});
const cbOl = K.checkbox(ctrl, "Oligomycin — blocks ATP synthase", false, (v) => {
  st.olig = v;
  if (v) toast("Oligomycin has plugged ATP synthase's F₀ channel.");
});
const row = K.buttonRow(ctrl);
const pauseBtn = K.button(row, "Pause", () => { pauseBtn.textContent = loopCtl.toggle() ? "Pause" : "Play"; });
K.button(row, "Reset", reset);
const mapBtn = K.button(row, "Mitochondrion map", () => { zoomTarget = zoomTarget ? 0 : 1; });
const row2 = K.buttonRow(ctrl);
K.button(row2, "Crank ↺ 120° (make ATP)", () => { sim.rotor.queue += STEP_A; grabbedOnce = true; });
K.button(row2, "Crank ↻ 120° (reverse)", () => { sim.rotor.queue -= STEP_A; grabbedOnce = true; });
const spLabel = document.createElement("div");
spLabel.className = "speed-label";
spLabel.textContent = "Speed";
ctrl.appendChild(spLabel);
const defSpeed = reduceMotion ? 0.5 : 1;
const speedSeg = K.segmented(ctrl, [0.25, 0.5, 1, 2, 3].map((v) => ({ value: v, label: `${v}×` })), defSpeed, (v) => (loopCtl.speed = v));

const legend = K.card(panel, "Key");
const lg = document.createElement("div");
lg.className = "legend";
lg.innerHTML = [
  [COL.H, "H⁺ (hydrogen ion)"], [COL.e, "Electrons (e⁻ pair)"], [COL.nadh, "NADH"], [COL.fadh, "FADH₂ (in complex II)"],
  [COL.q, "Ubiquinone (Q)"], [COL.cytc, "Cytochrome c"], [COL.o2, "O₂"], [COL.h2o, "H₂O"],
  [COL.atp, "ATP"], [COL.adp, "ADP + Pi"],
].map(([c, n]) => `<span><i style="background:${c}"></i>${n}</span>`).join("");
legend.appendChild(lg);

const resp = K.card(panel, "The big picture: respiration", "resp");
resp.insertAdjacentHTML("beforeend", `
  <details>
    <summary>Glycolysis → link reaction → Krebs cycle → ETC (per glucose)</summary>
    <ol class="flow">
      <li><b>Glycolysis</b><span>cytoplasm · glucose → 2 pyruvate</span><em>2 ATP<br>2 NADH</em></li>
      <li><b>Link reaction</b><span>matrix · pyruvate → acetyl-CoA + CO₂</span><em>2 NADH<br>2 CO₂</em></li>
      <li><b>Krebs cycle</b><span>matrix · two turns</span><em>2 ATP · 6 NADH<br>2 FADH₂ · 4 CO₂</em></li>
      <li class="here"><b>ETC + chemiosmosis</b><span>inner membrane · you are here</span><em>≈ 26–28 ATP</em></li>
    </ol>
    <p>Total ≈ <strong>30–32 ATP per glucose</strong> (≈ 2.5 ATP per NADH, ≈ 1.5 per FADH₂). Older textbooks say <strong>36–38</strong>: they assumed 3 per NADH and 2 per FADH₂ and ignored the cost of moving ATP, ADP and phosphate across the membrane.</p>
    <p>Without O₂ only glycolysis works (+ fermentation to recycle NAD⁺): <strong>2 ATP per glucose</strong>.</p>
  </details>`);

const missions = K.missions(panel, [
  { text: "Grab the gold handle on ATP synthase and crank it in a circle until you make your first ATP by hand", check: () => sim.crankMade >= 1 },
  { text: "Reach a high, steady ATP rate: hold ≥ 1.9 ATP/s for 5 s without cranking (hint: fuel + oxygen)", check: () => sim.highT >= 5 },
  { text: "Poison complex IV with cyanide and watch ATP production stop", check: () => st.cyanide && sim.cnT > 3 && sim.rate < 0.25 },
  { text: "Add the uncoupler DNP: collapse the gradient below 30 % and turn the energy into heat", check: () => st.dnp && sim.dnpT > 4 && gradient() < 0.3 },
  { text: "Take away all the oxygen (no cyanide) and find out what happens to the chain", check: () => st.o2 === 0 && !st.cyanide && sim.noO2T > 3 && sim.rate < 0.25 },
  { text: "Run the motor backwards: crank ↻ to hydrolyse 3 ATP and pump H⁺ back up", check: () => sim.crankHydro >= 3 },
], (m) => {
  const msg = {
    0: "Mission complete! Your hand did the work the H⁺ flow normally does — 120° of rotation = 1 ATP.",
    1: "Mission complete! Plenty of NADH + O₂ keeps the gradient high and the rotor spinning fast.",
    2: "Mission complete! No electron acceptor → no pumping → gradient drains → no ATP. That's why cyanide kills.",
    3: "Mission complete! H⁺ leak back without turning ATP synthase, so the gradient's energy is released as heat.",
    4: "Mission complete! No O₂ = no final electron acceptor. Cells must fall back on anaerobic respiration (2 ATP/glucose).",
    5: "Mission complete! Running backwards, ATP synthase is an ATP-powered H⁺ pump — real mitochondria can do this.",
  };
  const i = missionList.indexOf(m.text);
  toast(msg[i] || `Mission complete: ${m.text}`, 4200);
});
const missionList = [
  "Grab the gold handle on ATP synthase and crank it in a circle until you make your first ATP by hand",
  "Reach a high, steady ATP rate: hold ≥ 1.9 ATP/s for 5 s without cranking (hint: fuel + oxygen)",
  "Poison complex IV with cyanide and watch ATP production stop",
  "Add the uncoupler DNP: collapse the gradient below 30 % and turn the energy into heat",
  "Take away all the oxygen (no cyanide) and find out what happens to the chain",
  "Run the motor backwards: crank ↻ to hydrolyse 3 ATP and pump H⁺ back up",
];

K.quiz(panel, [
  {
    q: "What is the final electron acceptor of the electron transport chain?",
    options: ["NAD⁺", "Oxygen (O₂)", "ATP synthase", "Carbon dioxide"], answer: 1,
    why: "At complex IV, electrons are passed to O₂, which also picks up H⁺ to form water. Without O₂ the whole chain backs up.",
  },
  {
    q: "Which statement best describes chemiosmosis?",
    options: [
      "Electrons flowing through ATP synthase to make ATP",
      "H⁺ flowing down their concentration gradient through ATP synthase, driving ATP synthesis",
      "Water moving across the inner membrane by osmosis",
      "Glucose being split into pyruvate in the cytoplasm",
    ], answer: 1,
    why: "The ETC uses electron energy to pump H⁺; the H⁺ gradient then powers ATP synthase. Electrons never pass through ATP synthase.",
  },
  {
    q: "Where do H⁺ ions build up during aerobic respiration?",
    options: ["In the matrix", "In the intermembrane space", "In the cytoplasm", "Inside the cristae proteins"], answer: 1,
    why: "Complexes I, III and IV pump H⁺ from the matrix into the intermembrane space, so it has a higher H⁺ concentration (lower pH) than the matrix.",
  },
  {
    q: "Why is cyanide so deadly?",
    options: [
      "It destroys glucose in the blood",
      "It blocks complex IV, so electrons can't reach O₂ — pumping stops and mitochondrial ATP production collapses",
      "It makes ATP synthase spin too fast",
      "It stops oxygen entering the lungs",
    ], answer: 1,
    why: "Even with plenty of O₂ in the blood, cells can't use it. Glycolysis alone gives only 2 ATP per glucose — not enough for the heart and brain.",
  },
  {
    q: "Approximately how much ATP per glucose do aerobic and anaerobic respiration yield?",
    options: ["Aerobic ≈ 30–32, anaerobic 2", "Aerobic 2, anaerobic ≈ 30–32", "Both about 36", "Aerobic ≈ 10, anaerobic 4"], answer: 0,
    why: "Modern estimates are ≈ 30–32 ATP aerobically (older textbooks: 36–38). Anaerobic respiration (glycolysis + fermentation) gives just 2.",
  },
  {
    q: "The uncoupler DNP makes the inner membrane leaky to H⁺. What happens?",
    options: [
      "ATP production rises and body temperature falls",
      "Electron flow stops completely",
      "The chain runs fast and uses more O₂, but the gradient's energy is released as heat instead of making ATP",
      "H⁺ build up even more in the intermembrane space",
    ], answer: 2,
    why: "H⁺ bypass ATP synthase, so little ATP is made but electron flow (and O₂ use) speeds up. DNP was once sold as a diet pill — it caused fatal overheating. Brown fat uses a natural uncoupler (thermogenin) to keep babies warm.",
  },
]);

const chipG = K.chip(overlay), chipR = K.chip(overlay), chipT = K.chip(overlay), chipO = K.chip(overlay), chipW = K.chip(overlay);

function explainHTML() {
  const G = gradient(), R = sim.rotor;
  const hand = R.grabbed || Math.abs(R.queue) > 1e-4;
  let main;
  if (zoom > 0.5) {
    main = "You're looking at a whole <strong>mitochondrion</strong>. The smooth <strong>outer membrane</strong> surrounds the <strong>intermembrane space</strong>. The <strong>inner membrane</strong> is folded into <strong>cristae</strong>, giving a huge surface for the electron transport chain and ATP synthase. Inside is the <strong>matrix</strong>, where the link reaction and Krebs cycle make NADH and FADH₂. Tap to zoom back in.";
  } else if (hand && R.hand > 0.2) {
    main = "You're cranking <strong>ATP synthase</strong> by hand! Each 120° turn of the central stalk (γ) changes the shape of the β subunits (Loose → Tight → Open), squeezing <strong>ADP + Pi → ATP</strong> — 3 ATP per full turn. Normally the energy comes from H⁺ flowing through F₀; here it comes from your hand. (Scientists really have made ATP by twisting F₁ with magnetic beads.)";
  } else if (hand && R.hand < -0.2) {
    main = netATP() > 0
      ? "Running in reverse! ATP synthase now works as an <strong>ATPase</strong>: it hydrolyses <strong>ATP → ADP + Pi</strong> and uses that energy to pump H⁺ <em>back</em> into the intermembrane space. Real mitochondria do this when the gradient collapses (e.g. no oxygen); an inhibitor protein (IF1) limits how much ATP is wasted."
      : "Running in reverse needs ATP as fuel — and you've run out. Make some ATP first (crank ↺ or let respiration run).";
  } else if (hand) {
    main = "You've got hold of the rotor. Drag around in a circle: <strong>anticlockwise (↺)</strong> makes ATP, <strong>clockwise (↻)</strong> runs the motor backwards.";
  } else if (st.cyanide) {
    main = "<strong>Cyanide</strong> binds complex IV (cytochrome c oxidase), so electrons can't be passed to O₂. Electrons <strong>back up</strong> along the chain and H⁺ pumping stops. ";
    main += geff(G) > 0.08
      ? "ATP synthase is still running on the leftover H⁺ gradient — watch it run down."
      : "The gradient is spent, so ATP production by the mitochondria has stopped. Glycolysis alone (2 ATP per glucose) can't keep the heart and brain alive — that's why cyanide kills within minutes.";
  } else if (st.o2 === 0) {
    main = "<strong>No oxygen</strong> = no final electron acceptor. Electrons pile up in the chain, pumping stops, the gradient runs down and ATP production stops. NADH can't be recycled to NAD⁺, so the Krebs cycle stalls too. Cells switch to <strong>anaerobic respiration</strong>: glycolysis + fermentation (lactate in your muscles; ethanol + CO₂ in yeast) recycles NAD⁺ but gives only <strong>2 ATP per glucose</strong> instead of ≈ 30–32.";
  } else if (st.olig && st.dnp) {
    main = "<strong>Oligomycin</strong> blocks ATP synthase, but <strong>DNP</strong> lets H⁺ leak straight back across the membrane. The chain races and uses lots of O₂, yet <strong>no ATP</strong> is made — all the energy becomes <strong>heat</strong>.";
  } else if (st.olig) {
    main = "<strong>Oligomycin</strong> plugs the F₀ proton channel, so H⁺ can't flow back through ATP synthase and no ATP is made. The gradient climbs to its maximum and the chain <strong>slows right down</strong> — pumping against such a steep gradient is too hard — so less O₂ is used. This coupling of electron flow to ATP synthesis is called <strong>respiratory control</strong>.";
  } else if (st.dnp) {
    main = "The <strong>uncoupler DNP</strong> carries H⁺ straight back across the membrane, bypassing ATP synthase. The gradient collapses, so ATP production drops — but the chain runs <em>faster</em> and uses more O₂. The gradient's energy is released as <strong>heat</strong>. DNP was sold as a diet pill in the 1930s and caused fatal overheating; brown fat does this safely with thermogenin (UCP1) to keep babies warm.";
  } else if (st.nadh === 0 && sim.packets.length === 0) {
    main = "No NADH or FADH₂ is arriving (no glucose / Krebs cycle input), so there are no electrons to move along the chain. Pumping stops, the gradient leaks away and ATP synthase winds down.";
  } else {
    main = "<strong>NADH</strong> and <strong>FADH₂</strong> hand <strong>electrons</strong> to the chain. As electrons pass complexes I, III and IV, their energy is used to pump <strong>H⁺</strong> into the intermembrane space. The H⁺ flow back through <strong>ATP synthase</strong> (<strong>chemiosmosis</strong>), spinning its rotor: every 120° makes one ATP. At complex IV, <strong>O₂</strong> is the <strong>final electron acceptor</strong>, forming water.";
    if (st.o2 > 0 && st.o2 < 25 && sim.queueN >= 2) main += " Oxygen is scarce, so complex IV hands on electrons slowly and becomes the bottleneck.";
  }
  const turns = Math.abs(R.om / TAU).toFixed(2);
  let live = `Gradient <strong>${Math.round(G * 100)}%</strong> · rotor <strong>${turns}</strong> turns/s · <strong>${sim.rate.toFixed(1)}</strong> ATP/s`;
  if (sim.queueN >= 4) live += " · <strong>electrons backed up</strong>";
  if (sim.backlog > 2) live += " · NADH piling up";
  return `<p>${main}</p><p>${live}</p>`;
}

function reset() {
  st.o2 = DEF.o2; st.nadh = DEF.nadh; st.cyanide = st.dnp = st.olig = false;
  sO2.value = DEF.o2; sN.value = DEF.nadh;
  cbCN.checked = cbDNP.checked = cbOl.checked = false;
  zoomTarget = 0;
  seedSim();
}

// ---------- loop ----------
computeLayout();
seedSim();
let lastEx = 0, lastHTML = "";
const loopCtl = K.loop((dt, t) => {
  if (stage.w !== L.w || stage.h !== L.h || stage.dpr !== L.dpr) computeLayout();
  const rdt = 1 / 60;
  zoom = clamp(zoom + Math.sign(zoomTarget - zoom) * rdt * 2.2, 0, 1);
  if (Math.abs(zoom - zoomTarget) < 0.02) zoom = zoomTarget;
  mapBtn.setAttribute("aria-pressed", String(zoomTarget === 1));
  const ov = zoom > 0.3 ? "0" : "1";
  if (overlay.style.opacity !== ov) overlay.style.opacity = ov;

  update(dt);
  render(t);

  const G = gradient();
  chipG(`H⁺ gradient <b>${Math.round(G * 100)}%</b>`);
  chipR(`ATP/s <b>${sim.rate.toFixed(1)}</b>`);
  chipT(`Total ATP <b>${netATP()}</b>`);
  chipO(`O₂ used <b>${Math.floor(sim.water / 2)}</b>`);
  chipW(`H₂O made <b>${sim.water}</b>`);
  missions.update();

  const now = performance.now();
  if (now - lastEx > 300) {
    lastEx = now;
    const html = explainHTML();
    if (html !== lastHTML) { exBody.innerHTML = html; lastHTML = html; }
  }
});
loopCtl.speed = defSpeed;
