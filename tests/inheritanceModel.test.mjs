import assert from "node:assert/strict";
import * as M from "../assets/js/world/levels/inheritanceModel.js";
const eq = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, `${m}: ${a} != ${b}`);
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; };

// monohybrid: every preset, every parental pairing
for (const id of M.MODE_PRESETS.mono) {
  const sp = M.PRESETS[id], opts = M.genotypeOptions(sp.alleles);
  for (const a of opts) for (const b of opts) {
    const cr = M.buildCross(sp, [a], [b]);
    ok(cr.n === 4, "2x2");
    let tot = 0; for (const c of cr.cls.values()) tot += c.p; eq(tot, 1, id + " sums");
  }
  const het = M.buildCross(sp, [sp.alleles[0] + sp.alleles[1]], [sp.alleles[0] + sp.alleles[1]]);
  eq(het.geno.get(sp.alleles[0] + sp.alleles[0]).p, 0.25, id + " 1/4 homdom");
  eq(het.geno.get(sp.alleles[0] + sp.alleles[1]).p, 0.5, id + " 1/2 het");
  eq(het.geno.get(sp.alleles[1] + sp.alleles[1]).p, 0.25, id + " 1/4 homrec");
  const test = M.buildCross(sp, [sp.alleles[0] + sp.alleles[1]], [sp.alleles[1] + sp.alleles[1]]);
  eq(test.geno.get(sp.alleles[0] + sp.alleles[1]).p, 0.5, id + " testcross 1/2");
  console.log(id, "het x het:", M.ratioString(het), "| test cross:", M.ratioString(test), "| geno", M.genoRatioString(het));
}
// phenotype ratios
eq(M.crossClasses(M.buildCross(M.PRESETS.cf, ["Cc"], ["Cc"])).find(c => c.id === "d").p, 0.25, "CF 1/4 affected");
eq(M.crossClasses(M.buildCross(M.PRESETS.huntington, ["Hh"], ["hh"])).find(c => c.id === "d").p, 0.5, "HD 1/2");
eq(M.crossClasses(M.buildCross(M.PRESETS.huntington, ["HH"], ["hh"])).find(c => c.id === "d").p, 1, "HD HHxhh all");
eq(M.crossClasses(M.buildCross(M.PRESETS.cf, ["CC"], ["cc"])).length, 1, "CC x cc all unaffected");
assert.equal(M.ratioString(M.buildCross(M.PRESETS.cf, ["Cc"], ["Cc"])), "3 : 1");
assert.equal(M.ratioString(M.buildCross(M.PRESETS.sickle, ["AS"], ["AS"])), "1 : 2 : 1");
assert.equal(M.ratioString(M.buildCross(M.PRESETS.cf, ["CC"], ["CC"])), "all the same");
pass += 4;

// ABO: all 36 pairings; known results
const ab = M.PRESETS.abo, abOpts = M.genotypeOptions(ab.alleles);
ok(abOpts.length === 6, "6 ABO genotypes");
for (const a of abOpts) for (const b of abOpts) { const cr = M.buildCross(ab, [a], [b]); let t = 0; for (const c of cr.cls.values()) t += c.p; eq(t, 1, "abo sum"); }
const aibi = M.buildCross(ab, ["Ai"], ["Bi"]);
for (const id of ["A", "B", "AB", "O"]) eq(aibi.cls.get(id).p, 0.25, "Ai x Bi " + id);
eq(M.buildCross(ab, ["AB"], ["ii"]).cls.get("A").p, 0.5, "AB x O -> A 1/2");
eq(M.buildCross(ab, ["AB"], ["ii"]).cls.get("B").p, 0.5, "AB x O -> B 1/2");
ok(!M.buildCross(ab, ["AB"], ["ii"]).cls.has("O"), "AB x O never O");
ok(!M.buildCross(ab, ["AA"], ["BB"]).cls.has("O"), "AA x BB no O");
eq(M.buildCross(ab, ["AB"], ["AB"]).cls.get("AB").p, 0.5, "AB x AB: half AB");
eq(M.buildCross(ab, ["AB"], ["AB"]).cls.get("A").p, 0.25, "AB x AB: quarter A");
eq(M.buildCross(ab, ["Ai"], ["Ai"]).cls.get("O").p, 0.25, "Ai x Ai O 1/4");
console.log("ABO Ai x Bi:", M.ratioString(aibi));

// sex-linked
for (const id of M.MODE_PRESETS.xlinked) {
  const sp = M.PRESETS[id], [d, r] = sp.alleles;
  // carrier mother x unaffected father
  const cm = M.buildCross(sp, d, d + r);
  eq(cm.cls.get("Fu").p, 0.25, id + " F unaffected"); eq(cm.cls.get("Fc").p, 0.25, id + " F carrier");
  eq(cm.cls.get("Mu").p, 0.25, id + " M unaffected"); eq(cm.cls.get("Ma").p, 0.25, id + " M affected");
  ok(!cm.cls.has("Fa"), id + " no affected daughters");
  // among sons: half affected
  eq(cm.cls.get("Ma").n / (cm.cls.get("Ma").n + cm.cls.get("Mu").n), 0.5, id + " half sons");
  // affected father x unaffected homozygous mother: all daughters carriers, all sons unaffected (criss-cross)
  const af = M.buildCross(sp, r, d + d);
  eq(af.cls.get("Fc").p, 0.5, id + " daughters all carriers"); eq(af.cls.get("Mu").p, 0.5, id + " sons all unaffected");
  ok(!af.cls.has("Ma") && !af.cls.has("Fa"), id + " nobody affected");
  // affected father x carrier mother: half of daughters affected
  const ac = M.buildCross(sp, r, d + r);
  eq(ac.cls.get("Fa").p, 0.25, id + " affected daughters"); eq(ac.cls.get("Ma").p, 0.25, id + " affected sons");
  // affected mother x unaffected father: all sons affected, all daughters carriers
  const am = M.buildCross(sp, d, r + r);
  eq(am.cls.get("Ma").p, 0.5, id + " all sons affected"); eq(am.cls.get("Fc").p, 0.5, id + " all daughters carriers");
  ok(!am.cls.has("Mu"), "no unaffected sons");
  // no male-to-male transmission of the allele: son's X always the mother's
  for (const row of cm.cells) for (const c of row) if (c.sex === "M") ok(c.parts[0] === d || c.parts[0] === r, "son has one X");
  console.log(id, "carrier mother x unaffected father:", M.ratioString(cm));
}

// dihybrid
const di = M.buildCross(M.DIHYBRID, ["Rr", "Yy"], ["Rr", "Yy"]);
ok(di.n === 16 && di.rows.length === 4 && di.cols.length === 4, "4x4");
assert.deepEqual(M.crossClasses(di).map(c => c.n), [9, 3, 3, 1]); assert.equal(M.ratioString(di), "9 : 3 : 3 : 1");
assert.equal(di.geno.size, 9);
const tc = M.buildCross(M.DIHYBRID, ["Rr", "Yy"], ["rr", "yy"]);
assert.equal(M.ratioString(tc), "1 : 1 : 1 : 1");
assert.equal(M.ratioString(M.buildCross(M.DIHYBRID, ["RR", "yy"], ["rr", "YY"])), "all the same");
assert.equal(M.ratioString(M.buildCross(M.DIHYBRID, ["Rr", "Yy"], ["Rr", "yy"])), "3 : 3 : 1 : 1");
console.log("dihybrid RrYy x RrYy:", M.ratioString(di), "geno cells", di.geno.size);
pass += 6;

// sampling converges and chi-square
const R = M.mulberry32(42), cr = M.buildCross(M.PRESETS.cf, ["Cc"], ["Cc"]);
const cnt = { u: 0, d: 0 }; const N = 100000;
for (let i = 0; i < N; i++) cnt[M.sampleChild(cr, R).cell.cls]++;
ok(Math.abs(cnt.d / N - 0.25) < 0.01, "sample 1/4"); console.log("CF sample", cnt);
const ch = M.chiSquare({ u: 78, d: 22 }, { u: 0.75, d: 0.25 }, 100);
eq(ch.chi2, 0.48, "chi2"); ok(ch.fits && ch.df === 1 && ch.crit === 3.841, "chi fits");
ok(!M.chiSquare({ u: 60, d: 40 }, { u: 0.75, d: 0.25 }, 100).fits, "60:40 vs 3:1 rejected");
// independence: after 3 affected children the 4th is still 1/4 (simulation)
let after = 0, tot = 0; for (let t = 0; t < 200000; t++) { const a = M.sampleChild(cr, R).cell.cls, b = M.sampleChild(cr, R).cell.cls, c = M.sampleChild(cr, R).cell.cls; if (a === "d" && b === "d" && c === "d") { tot++; if (M.sampleChild(cr, R).cell.cls === "d") after++; } }
ok(Math.abs(after / tot - 0.25) < 0.06, "independence after streak"); console.log("P(affected | 3 affected before) ~", (after / tot).toFixed(3), "n=", tot);

// polygenic
for (const n of [1, 2, 3, 4, 6]) {
  const st = M.polyStats(n, n, n, 0);
  eq(st.mean, n, "poly mean N"); eq(st.varG, n / 2, "poly var N/2");
  const vals = []; const RR = M.mulberry32(n); for (let i = 0; i < 20000; i++) { const c = M.polyChild(n, n, n, 0, RR); vals.push(c.g + c.e); }
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length, v = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
  ok(Math.abs(mean - n) < 0.05 * n + 0.03, `sample mean N=${n}: ${mean}`); ok(Math.abs(v - n / 2) < 0.06 * n + 0.03, `sample var N=${n}: ${v}`);
  console.log("poly N=" + n, "mean", mean.toFixed(3), "var", v.toFixed(3), "(theory", n, n / 2 + ")");
}
const s2 = M.polyStats(4, 4, 4, 2); eq(s2.varP, 2 + 4, "var with env"); eq(s2.h2, 2 / 6, "h2");
{ // parent with 6 plus (all ++) and parent with 0: offspring all exactly 3 -> var 0
  const s = M.polyStats(3, 6, 0, 0); console.log("++ x -- : mean", s.mean, "var", s.varG); }
ok(M.polyStats(3, 6, 0, 0).varG === 0, "homozygous opposite parents: no genetic variance");
// bell: kurtosis of N=6 closer to normal than N=1
const kurt = (vals) => { const m = vals.reduce((a, b) => a + b) / vals.length, s2 = vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length; return vals.reduce((a, b) => a + (b - m) ** 4, 0) / vals.length / s2 ** 2; };
const kk = (n) => { const RR = M.mulberry32(9); const v = []; for (let i = 0; i < 30000; i++) { const c = M.polyChild(n, n, n, 0, RR); v.push(c.g); } return kurt(v); };
console.log("excess kurtosis N=1", (kk(1) - 3).toFixed(2), "N=6", (kk(6) - 3).toFixed(2)); ok(Math.abs(kk(6) - 3) < Math.abs(kk(1) - 3), "kurtosis -> normal");
ok(M.eyeColour(0) !== M.eyeColour(1), "eye colours"); 

// pedigree
const counts = {};
for (const pat of M.PATTERNS) {
  let made = 0, uniq = 0, margins = [];
  for (let s = 1; s <= 40; s++) {
    const r = M.generatePedigree(pat, s * 7919);
    ok(r, `generated ${pat} seed ${s}`);
    made++;
    const an = M.analysePedigree(r.ped);
    ok(an.consistent.includes(pat), pat + " consistent");
    ok(an.best === pat, `${pat} best (got ${an.best})`);
    if (an.decisive) uniq++;
    margins.push(an.margin);
    for (const p of r.ped) if (p.f != null) { ok(r.ped[p.f].sex === "M" && r.ped[p.m].sex === "F", "parents sex"); }
    // possible genotypes always include truth? (can't know truth here) -> at least nonempty
    const fit = an.fit[pat]; for (const s of fit.possible) ok(s.size > 0, "possible set nonempty");
    r.truth.forEach((c, i) => ok(fit.possible[i].has(c), `truth genotype possible ${pat} person ${i}`));
    // phenotypes agree with genotypes
    for (const p of r.ped) { const c = r.truth[p.id]; const aff = pat === 'AD' ? c >= 1 : pat === 'AR' ? c === 2 : p.sex === 'M' ? c === 1 : c === 2; ok(aff === p.affected, 'pheno matches truth'); }
    if (pat === 'XR') ok(r.ped.every(p => !(p.sex === 'M' && p.affected && p.f != null && r.ped[p.f].affected)), 'XR family has no affected father->affected son');
  }
  counts[pat] = { made, uniquelyConsistent: uniq, minMargin: Math.min(...margins).toFixed(1) };
}
console.log("pedigrees", counts);
// rule checks on hand-built pedigrees
const mk = (spec) => spec.map((s, i) => ({ id: i, label: s.l, sex: s.s, f: s.f ?? null, m: s.m ?? null, affected: !!s.a }));
// classic XR: unaffected parents, affected son
const xr = mk([{ l: "I-1", s: "M" }, { l: "I-2", s: "F" }, { l: "II-1", s: "M", f: 0, m: 1, a: 1 }, { l: "II-2", s: "F", f: 0, m: 1 }]);
let an = M.analysePedigree(xr); console.log("one affected son:", an.consistent, "excluded AD:", !an.consistent.includes("AD"));
ok(!an.consistent.includes("AD") && an.consistent.includes("AR") && an.consistent.includes("XR"), "unaffected parents + affected son: AR or XR, not AD");
// unaffected parents, affected daughter: AR only
const arD = mk([{ l: "I-1", s: "M" }, { l: "I-2", s: "F" }, { l: "II-1", s: "F", f: 0, m: 1, a: 1 }]);
an = M.analysePedigree(arD); ok(an.decisive && an.consistent[0] === "AR", "unaffected parents + affected daughter: AR only"); console.log("affected daughter:", an.consistent);
// affected father, affected son, unaffected mother
const mm = mk([{ l: "I-1", s: "M", a: 1 }, { l: "I-2", s: "F" }, { l: "II-1", s: "M", f: 0, m: 1, a: 1 }]);
an = M.analysePedigree(mm); console.log("affected father & son:", an.consistent, an.rules.notes.length);
ok(an.consistent.includes("AD") && an.rules.notes.length === 1, "note on male-to-male");
// affected mother, unaffected son excludes XR
const ms = mk([{ l: "I-1", s: "M" }, { l: "I-2", s: "F", a: 1 }, { l: "II-1", s: "M", f: 0, m: 1 }]);
an = M.analysePedigree(ms); ok(!an.consistent.includes("XR"), "affected mother + unaffected son excludes XR");
// two affected parents, unaffected child excludes recessives
const tp = mk([{ l: "I-1", s: "M", a: 1 }, { l: "I-2", s: "F", a: 1 }, { l: "II-1", s: "F", f: 0, m: 1 }]);
an = M.analysePedigree(tp); ok(an.consistent.length === 1 && an.consistent[0] === "AD", "both affected, unaffected child -> AD only"); 
// AD pedigree has no skipped generations; AR skip
console.log("TESTS PASSED:", pass);
