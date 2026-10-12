import assert from "node:assert/strict";
import { Model, rtfAt } from "../sims/membrane-transport/model.js";
let pass = 0;
const realRandom = Math.random;
const seed = (a) => { Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }; const ok = (c, m) => { assert.ok(c, m); pass++; };
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, `${m}: ${a} vs ${b}`);
const fresh = () => { const M = new Model("plant"); M.setSize(1000, 620); M.setPumpBlocked(true); return M; };
const clear = (M) => { M.parts = []; };
const put = (M, sp, side, n) => { for (let i = 0; i < n; i++) M.add(sp, side); };

// 0. temperature sets RT/F
near(rtfAt(37), 26.7, 0.05, "RT/F at 37 C");
{ const M = fresh(); M.temp = 10; M.step(1 / 60); near(M.rtf, rtfAt(10), 1e-9, "model follows the temperature slider"); }

// 1. nitrate cycle: a loaded flip moves the cycle's signed net charge once (export of 1 NO3- + 2 H+ = +1 out, q +1/Q_CAP); not clamped at 0
for (const q0 of [4, -5]) {
  const M = fresh(); clear(M); const S = M.sym.nit; M.q = q0;
  const c = M.add("no3", "in"), h1 = M.add("h", "in"), h2 = M.add("h", "in");
  for (const p of [c, h1, h2]) { p.mode = "bound"; p.from = "in"; p.bid = "nit"; }
  S.cargo = c; S.h = [h1, h2]; S.c = -0.99; S.target = -1; S.state = "moving";
  M.updateSym(S, 1 / 60);
  near(M.q - q0, 1 / 4, 1e-9, `export flip net charge (q0=${q0})`);
  ok(S.cargo === c && S.c === -1, "cargo stays bound after the flip");
  M.unloadSym(S);
  ok(S.cargo === null && S.h.length === 0 && M.cross.no3.out === 1 && M.cross.h.out === 2, "unloaded on the other face and recorded once");
  near(M.q - q0, 1 / 4, 1e-9, "unloading moves no further charge");
}
{ const M = fresh(); M.q = -3; M.moveCharge(1); near(M.q, -3.25, 1e-9, "inside-positive allowed"); }

// 2. passive ions obey Nernst: forward/reverse acceptance ratio = e^(z Vm/RT_F); H+ leak too
{
  const M = fresh();
  for (const vm of [-120, -60, 0, 40]) {
    M.vmFixed = vm;
    for (const sp of ["k", "h"]) near(Math.log(M.driveFactor(sp, "out") / M.driveFactor(sp, "in")), -vm / M.rtf, 1e-9, `${sp} Nernst ratio at ${vm} mV`);
    ok(M.driveFactor("o2", "out") === 1 && M.driveFactor("h2o", "in") === 1, "uncharged unaffected");
  }
  // stochastic: per-particle flux ratio through the open K+ channel approaches e^(-Vm/RT_F)
  seed(5); M.vmFixed = -60; clear(M); put(M, "k", "out", 25); put(M, "k", "in", 25);
  let so = 0, si = 0, n = 0;
  for (let i = 0; i < 60 * 90; i++) { M.step(1 / 60); if (i % 30 === 0) { const c = M.counts(); so += c.k.out; si += c.k.in; n++; } }
  const jin = M.cross.k.in / (so / n), jout = M.cross.k.out / (si / n), want = Math.exp(60 / M.rtf);
  ok(jin / jout > want * 0.5 && jin / jout < want * 2, `K flux ratio ${jin / jout} vs Nernst ${want}`);
}

Math.random = realRandom;
// 3. symporters: full-cycle detailed balance with fixed reservoirs (seeded). Net ~ 0 at equilibrium, reversal on either side, for both carriers.
function cycleRun(id, vm, Ho, Hi, Co, Ci, secs, sd) {
  seed(sd);
  const M = fresh(), S = M.sym[id], sp = S.sp; M.vmFixed = vm; clear(M);
  const want = { h: { out: Ho, in: Hi }, [sp]: { out: Co, in: Ci } };
  for (let i = 0; i < secs * 30; i++) {
    for (const k in want) for (const side of ["out", "in"]) { // top up / trim the free reservoirs every step
      let n = 0; for (const p of M.parts) if (p.sp === k && p.side === side && p.mode === "free") n++;
      while (n < want[k][side]) { M.add(k, side); n++; }
      if (n > want[k][side]) { for (const p of M.parts) if (n > want[k][side] && p.sp === k && p.side === side && p.mode === "free") { p.dead = true; n--; } }
    }
    M.step(1 / 30);
  }
  return { net: M.cross[sp].in - M.cross[sp].out, tot: M.cross[sp].in + M.cross[sp].out };
}
for (const [id, vm, Ho, Hi] of [["suc", -60, 20, 20], ["nit", -60, 20, 20], ["nit", 30, 20, 20]]) {
  const M0 = fresh(), S = M0.sym[id], q = (S.n + (id === "nit" ? -1 : 0)) * vm / M0.rtf;
  const ratio = Math.pow(Ho / Hi, S.n) * Math.exp(-q);            // equilibrium [S]in/[S]out
  const Co = ratio > 6 ? 5 : 40, Ci = Math.round(Co * ratio);
  const eq = cycleRun(id, vm, Ho, Hi, Co, Ci, 400, 11);
  ok(eq.tot > 100 && Math.abs(eq.net) <= 3.5 * Math.sqrt(eq.tot), `${id} ${vm} mV equilibrium: net ${eq.net} of ${eq.tot} crossings`);
  const lo = cycleRun(id, vm, Ho, Hi, Co, Math.max(1, Math.round(Ci * 0.25)), 700, 12), hi = cycleRun(id, vm, Ho, Hi, Math.max(1, Math.round(Co / 4)), Ci, 700, 13);
  ok(lo.net > 2.5 * Math.sqrt(lo.tot) && lo.net > 0, `${id} ${vm} mV below equilibrium runs inward (${lo.net})`);
  ok(hi.net < -2.5 * Math.sqrt(hi.tot), `${id} ${vm} mV above equilibrium runs outward (${hi.net})`);
}
Math.random = realRandom;

// 4. blocking a moving symporter cancels the flip: starting endpoint, particles back on their own side, timers reset
{
  const M = fresh(); clear(M); const S = M.sym.suc;
  const c = M.add("suc", "in"), h = M.add("h", "in");
  for (const p of [c, h]) { p.mode = "bound"; p.from = "in"; p.bid = "suc"; }
  S.cargo = c; S.h = [h]; S.c = 0.2; S.target = -1; S.state = "moving"; S.dwell = 0.4;
  M.setSymBlocked("suc", true);
  ok(S.c === 1 && S.target === 1 && S.state === "open" && S.dwell === 0, "endpoint, state and timers restored");
  ok(S.cargo === null && S.h.length === 0, "carrier emptied");
  ok(c.mode === "free" && c.side === "in" && h.mode === "free" && h.side === "in", "particles returned to the side they came from");
  ok(M.cross.suc.out === 0 && M.cross.suc.in === 0, "nothing recorded as crossed");
}

// 5. default plant mode: the membrane potential stays inside-negative between 60 and 180 s for 100 seeds
{
  let worst = -Infinity, sum = 0, n = 0;
  for (let sd = 1; sd <= 100; sd++) {
    seed(sd); const M = new Model("plant"); M.setSize(1000, 620);
    for (let i = 0; i < 180 * 20; i++) { M.step(1 / 20); if (i >= 60 * 20) { worst = Math.max(worst, M.vmAvg); sum += M.vmAvg; n++; } }
  }
  Math.random = realRandom;
  ok(worst < 0, `vmAvg stays negative (worst ${worst.toFixed(1)} mV, mean ${(sum / n).toFixed(0)} mV)`);
  console.log(`  default plant Vm 60-180 s over 100 seeds: worst ${worst.toFixed(1)}, mean ${(sum / n).toFixed(0)} mV`);
}

console.log(`membraneModel: ${pass} checks passed`);
