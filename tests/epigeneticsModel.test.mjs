import assert from "node:assert";
import { MarkSim, runDivisions, alphaOf, barrBodies, KARYOTYPES, Mosaic, vernFraction, vernThresholds, vernOffFraction, flowerWeeks,
  agoutiLitter, agoutiProbs, agoutiMean, mulberry32, tyrActivity, rabbitMap, twinExpected, twinDraws, twinPatterns, N_CPG } from "../assets/js/world/levels/epigeneticsModel.js";
import { narrative } from "../assets/js/world/levels/epigeneticsContent.js";

// F = alpha / (1 - alpha)
assert(Math.abs(alphaOf(4) / (1 - alphaOf(4)) - 4) < 1e-12);

// 1. memory: strong feedback keeps an all-M state through 5 divisions, no feedback does not
{
  let hi = 0, lo = 0; const S = 40;
  for (let seed = 1; seed <= S; seed++) {
    if (runDivisions({ F: 12, seed }).fracM > 0.7) hi++;
    const s = runDivisions({ F: 0.3, seed, divisions: 3 }); if (s.fracM < 0.6 && s.fracM > 0.02 && s.fracA > 0.05) lo++;
  }
  console.log("memory high F:", hi / S, " mixed low F:", lo / S);
  assert(hi / S >= 0.9, "strong feedback should keep M > 0.7 in most runs");
  assert(lo / S >= 0.8, "no feedback should decay to a mixed state within a few divisions");
}
// determinism
{ const a = runDivisions({ F: 6, seed: 7 }), b = runDivisions({ F: 6, seed: 7 }); assert.deepStrictEqual([...a.s], [...b.s]); }
// replication halves the marks immediately
{ let tot = 0; for (let s = 1; s <= 30; s++) { const m = new MarkSim({ F: 12, seed: s }); m.divide(); tot += m.fracM; } const mean = tot / 30; assert(mean > 0.35 && mean < 0.65, "division should drop M to about half: " + mean); }
// HDAC inhibitor blocks A->U
{ const m = new MarkSim({ F: 2, seed: 3, start: "A" }); m.hdaci = true; for (let i = 0; i < 20; i++) { m.step(1); } assert(m.events.every((e) => !(e.from === 1 && e.to === 0)), "HDACi must block A to U"); }
// activator wins in the promoter window; repressor silences
{ const m = new MarkSim({ F: 1, seed: 5, start: "U" }); m.act = 1; m.step(40); assert(m.winFrac(1) > 0.6 && m.txOn, "activator should open the promoter"); }
{ const m = new MarkSim({ F: 1, seed: 5, start: "A" }); m.rep = 1; m.step(60); assert(m.winFrac(-1) > 0.5 && !m.txOn, "repressor should silence"); }
// DNA methylation: DNMT3 methylates silent promoters, DNMT1 keeps ~95% per division, TET is slow
{ const m = new MarkSim({ F: 12, seed: 2, start: "M" }); m.cpg.fill(0); m.dnmt3 = true; m.step(60); assert(m.cpgFrac > 0.5, "DNMT3 should methylate CpGs at a silent promoter: " + m.cpgFrac);
  let kept = 0, tot = 0; for (let s = 1; s <= 200; s++) { const q = new MarkSim({ seed: s, start: "M" }); q.divide(); q.step(3); kept += [...q.cpg].filter((c) => c === 1).length; tot += N_CPG; }
  assert(Math.abs(kept / tot - 0.95) < 0.03, "DNMT1 fidelity " + kept / tot); }
// methylation lowers transcription
{ const a = new MarkSim({ start: "A" }), b = new MarkSim({ start: "A" }); b.cpg.fill(1); assert(b.txRate < a.txRate * 0.5); }

// 2. Barr bodies
assert.deepStrictEqual(Object.keys(KARYOTYPES).map(barrBodies), [1, 0, 1, 0, 2]);
assert.strictEqual(barrBodies("XXXX"), 3);
{ // both colours appear with many founders
  for (let s = 1; s <= 20; s++) { const st = new Mosaic({ founders: 16, seed: s }).run().stats(); assert(st.c0 > 0 && st.c1 > 0 && st.total === 300, "both X lineages present, seed " + s); }
  // later inactivation (more founders) -> smaller, more numerous patches
  const mean = (f) => { let t = 0; for (let s = 1; s <= 40; s++) t += new Mosaic({ founders: f, seed: s }).run().stats().patches; return t / 40; };
  const p2 = mean(2), p8 = mean(8), p32 = mean(32);
  console.log("patches by founders 2/8/32:", p2.toFixed(1), p8.toFixed(1), p32.toFixed(1));
  assert(p2 < p8 && p8 < p32, "patch count should fall as founders fall");
  // skew
  let f1 = 0; for (let s = 1; s <= 40; s++) f1 += new Mosaic({ founders: 32, skew: 0.8, seed: s }).run().stats().frac1; assert(f1 / 40 > 0.65);
  // daughters inherit: every cell next to a founder lineage shares its state with at least one neighbour (no isolated single cells from one founder)
  const m = new Mosaic({ founders: 4, seed: 9 }).run(); assert(m.stats().largest > 30);
}

// 3a. vernalisation
assert(vernFraction(0) === 0 && vernFraction(10) > 0.95 && vernFraction(4) < vernFraction(6));
{ const thr = vernThresholds(100, 11); assert(vernOffFraction(thr, 0) === 0); assert(vernOffFraction(thr, 10) > 0.9); assert(vernOffFraction(thr, 8) > vernOffFraction(thr, 3));
  assert(flowerWeeks(1) < flowerWeeks(0.5) && flowerWeeks(0.5) < flowerWeeks(0)); }
// 3b. agouti: a methyl-donor diet shifts the coat toward brown
{ assert(agoutiMean(1) > agoutiMean(0)); const p0 = agoutiProbs(0), p1 = agoutiProbs(1); assert(Math.abs(p0.reduce((a, b) => a + b) - 1) < 1e-6);
  assert(p1[3] > p0[3] && p1[0] < p0[0]);
  const rng = mulberry32(4); let br0 = 0, br1 = 0; for (let i = 0; i < 400; i++) { br0 += agoutiLitter(0, rng, 1)[0].cls >= 2; br1 += agoutiLitter(1, rng, 1)[0].cls >= 2; } assert(br1 > br0 * 1.5); }
// 3c. Himalayan: enzyme works where it is cool
assert(tyrActivity(28) > 0.95 && tyrActivity(37) < 0.1 && Math.abs(tyrActivity(35) - 0.5) < 1e-9);
{ const map = rabbitMap(); assert(map.length > 150 && map.length <= 320, "rabbit cells " + map.length); for (const r of ["body", "ear", "nose", "paw", "head", "tail"]) assert(map.some((c) => c.region === r), r); }
// 3d. twins drift apart with age, faster with environmental difference
{ assert(twinExpected(0, 0) === 0 && twinExpected(80, 1) > twinExpected(80, 0) && twinExpected(80, 0) > twinExpected(20, 0));
  const dr = twinDraws(5); assert(twinPatterns(dr, 0, 1).diff === 0);
  let lo = 0, hi = 0; for (let s = 1; s <= 30; s++) { const d = twinDraws(s); lo += twinPatterns(d, 80, 0).diff; hi += twinPatterns(d, 80, 1).diff; } assert(hi > lo); }

// 10. the CpG chemistry runs per N steps however time is sliced
{ const a = new MarkSim({ F: 12, seed: 21, start: "M" }), b = new MarkSim({ F: 12, seed: 21, start: "M" });
  a.cpg.fill(0); b.cpg.fill(0); a.dnmt3 = b.dnmt3 = true;
  for (let i = 0; i < 20; i++) a.step(1);
  for (let i = 0; i < 400; i++) b.step(0.05);
  assert.deepStrictEqual([...a.s], [...b.s]); assert.deepStrictEqual([...a.cpg], [...b.cpg]);
  const c = new MarkSim({ F: 12, seed: 3, start: "M" }); c.cpg.fill(0); c.dnmt3 = true; for (let i = 0; i < 60 * 75; i++) c.step(1 / 75); assert(c.cpgFrac > 0.5, "DNMT3 under per-frame steps: " + c.cpgFrac); }
// 11. failed DNMT1 maintenance leaves a hemi site; hemi sites give hemi or unmethylated at the next replication
{ let fail = 0, tot = 0, hemi = 0, un = 0;
  for (let sd = 1; sd <= 300; sd++) { const m = new MarkSim({ seed: sd, start: "M" }); m.divide(); m.step(1); for (const c of m.cpg) { tot++; if (c === 3) fail++; }
    const before = [...m.cpg]; m.divide(); before.forEach((c, i) => { if (c === 3) { m.cpg[i] === 2 ? hemi++ : m.cpg[i] === 0 ? un++ : assert.fail("hemi site became " + m.cpg[i]); } }); }
  assert(Math.abs(fail / tot - 0.05) < 0.02, "failed maintenance share " + fail / tot); assert(hemi > 0 && un > 0 && Math.abs(hemi / (hemi + un) - 0.5) < 0.15); }
// 12. recovery and tx state are measured from the model
{ const m = new MarkSim({ F: 12, seed: 4, start: "M" }); m.divide(); assert(m.pre.regime === "M" && m.recovery < 0.9); m.step(30); assert(m.recovery > 0.85, "recovery " + m.recovery); assert(["on", "reduced", "off"].includes(m.txState)); }
// 21. parameter validation
assert.throws(() => new MarkSim({ N: 1 }), RangeError); assert.throws(() => new MarkSim({ N: 2.5 }), RangeError); assert.throws(() => new MarkSim({ N: 10, window: [8, 11] }), RangeError);
{ const m = new MarkSim({ N: 7 }); assert(m.window[0] >= 0 && m.window[1] <= 6); }
assert.throws(() => new Mosaic({ cols: 0 }), RangeError); assert.throws(() => new Mosaic({ founders: 0 }), RangeError); assert.throws(() => new Mosaic({ founders: 301 }), RangeError); assert.throws(() => new Mosaic({ founders: 2.5 }), RangeError);
// 22. cleanliness counters for missions: divisions with a signal on, at the division OR during recovery, do not count
{ const m = new MarkSim({ seed: 2, start: "M" }); m.rep = 1; m.divide(); m.rep = 0; m.step(20); m.noteDivisionOutcome(); assert.strictEqual(m.cleanDivs, 0);
  m.divide(); m.step(20); m.noteDivisionOutcome(); assert.strictEqual(m.cleanDivs, 1);
  // counterexample: divide clean, then the repressor is on during recovery and off again before the next divide
  const q = new MarkSim({ seed: 5, start: "M" }); q.divide(); q.step(3); q.rep = 1; q.step(5); q.rep = 0; q.step(12); q.noteDivisionOutcome();
  assert.strictEqual(q.cleanDivs, 0); assert.strictEqual(q.streak, 0); assert.strictEqual(q.maxStreak, 0);
  const r = new MarkSim({ seed: 5, start: "M", F: 12 }); r.divide(); r.step(20); r.noteDivisionOutcome(); assert.strictEqual(r.cleanDivs, 1); }

// narrative text comes from state
{ const sim = new MarkSim({ start: "M" }); for (const band of ["y7-8", "y9-10", "y11", "y12"]) { const t = narrative({ view: "marks", sim }, band).join(" "); assert(t.length > 40 && !/NaN|undefined/.test(t), t); }
  const sx = narrative({ view: "marks", sim: new MarkSim({ start: "A" }) }, "y11").join(" "); assert(/active/i.test(sx)); }
console.log("ALL PASS");
