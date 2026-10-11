import assert from "node:assert/strict";
import { PlantCellModel, LeafLab, LEAVES } from "../assets/js/world/levels/plantCellModel.js";
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; };
const run = (m, lab, secs, dt = 0.1) => { for (let t = 0; t < secs; t += dt) { m.step(dt); lab.update(dt); } };

// original (generic) leaf and stomata at defaults must behave as before: photosynthesis ~4 at full sun, 0 in the dark
{ const m = new PlantCellModel(); m.light = 100; for (let i = 0; i < 600; i++) m.step(0.1);
  ok(m.stomata === 1 && m.flux.photo > 3.5 && m.flux.photo < 4.5, "generic photo " + m.flux.photo);
  m.light = 0; for (let i = 0; i < 100; i++) m.step(0.1); ok(m.flux.photo === 0 && m.flux.resp > 0.5, "respires in the dark"); }

// compensation point: shade < sun, found by holding each leaf at steady light
const comp = {}; ;
for (const leaf of ["sun", "shade", "generic"]) {   // first whole-% light where photosynthesis is on and net O2 is within tolerance (same rule as LeafLab)
  const m = new PlantCellModel(), lab = new LeafLab(m); m.leaf = leaf; comp[leaf] = null;
  for (let L = 0; L <= 40 && comp[leaf] === null; L++) { m.light = L; run(m, lab, 20); if (m.flux.photo > 0.3 && Math.abs(m.flux.net) <= 0.25) comp[leaf] = L; }
  ok(comp[leaf] !== null, leaf + " compensation found");
}
ok(comp.shade < comp.generic && comp.generic < comp.sun, JSON.stringify(comp));

// low light: shade wins; full sun: sun wins (steady-state net O2)
{ const m = new PlantCellModel(), lab = new LeafLab(m);
  for (const leaf of ["sun", "shade"]) { m.leaf = leaf; for (const L of [15, 100]) { m.light = L; run(m, lab, 30); } }
  ok(lab.compared, "matched shade-vs-sun comparison"); }

// readings taken under different conditions (salt, a knocked-out organelle) are never compared with each other
{ const m = new PlantCellModel(), lab = new LeafLab(m);
  m.leaf = "sun"; m.light = 15; run(m, lab, 30); m.light = 100; run(m, lab, 30);
  m.leaf = "shade"; m.outside = 20; m.light = 15; run(m, lab, 30); m.light = 100; run(m, lab, 30);
  ok(!lab.compared, "salt changes the environment: no match");
  m.outside = 0; m.on.pumps = false; m.light = 15; run(m, lab, 30); m.light = 100; run(m, lab, 30);
  ok(!lab.compared, "pumps off changes the environment: no match");
  m.on.pumps = true; m.light = 15; run(m, lab, 90); m.light = 100; run(m, lab, 90);
  ok(lab.compared, "matched again once conditions match"); }

// a reading is not steady while the flux is still moving (light changed a moment ago)
{ const m = new PlantCellModel(), lab = new LeafLab(m); m.leaf = "shade"; m.light = 100; run(m, lab, 60); m.light = 15; run(m, lab, 3);
  ok(lab.obs.low.size === 0, "no low-light reading after 3 s"); }

// 24 h: dark respiration continues, a dim day loses sugar, a bright day does not
{ const res = {};
  for (const peak of [10, 85]) { const m = new PlantCellModel(), lab = new LeafLab(m); m.leaf = "sun"; m.auto = true; m.peak = peak; m.hour = 0; run(m, lab, 125); res[peak] = lab.last; }
  ok(res[10] && !res[10].ok && res[10].change < 0 && res[85].ok && res[85].change >= 0 && res[85].min > 0.5, JSON.stringify(res)); ok(res[85].nightResp > 0.3, "night respiration"); }

// stomata close in hot dry air and limit CO2 -> photosynthesis falls even with lots of CO2 outside and bright light
{ const m = new PlantCellModel(); m.light = 90; for (let i = 0; i < 400; i++) m.step(0.1); const p0 = m.flux.photo;
  m.heat = 90; for (let i = 0; i < 400; i++) m.step(0.1);
  ok(m.stomata < 0.1 && m.co2 < 8 && m.flux.photo < p0 * 0.4, `stomata ${m.stomata} photo ${m.flux.photo} vs ${p0}`); }
ok(LEAVES.sun.n > LEAVES.shade.n && LEAVES.sun.K > LEAVES.shade.K && LEAVES.sun.upkeep > LEAVES.shade.upkeep, "leaf parameters");
console.log(`leafModel: ${pass} checks passed`);
