import { ImmuneModel, HerdSim, herdThreshold, coverageNeeded, herdReached } from "../assets/js/world/levels/immunityModel.js";
import assert from "node:assert";
import { narrative } from "../assets/js/world/levels/immunityContent.js";
const adv=(m,d)=>{const t=m.day; while(m.day-t<d) m.step(0.02);};
for (const id of ["bacterium","virus"]) {
  const m=new ImmuneModel(); m.infect(id); adv(m,60); m.infect(id); adv(m,40);
  const [p,s]=m.records;
  console.log(id,"lag",p.detect.toFixed(1),s.detect.toFixed(1),"peak ratio",(s.peakAb/p.peakAb).toFixed(1),m.illness(p),m.illness(s));
  assert(p.detect>=7&&p.detect<=10); assert(s.detect>=1&&s.detect<=3); assert(s.peakAb/p.peakAb>=5); assert(m.illness(s)==="none");
}
const v=new ImmuneModel(); v.vaccinate("bacterium"); adv(v,35); v.infect("bacterium"); adv(v,20);
assert(v.illness(v.records[0])==="none"&&v.records[1].secondary&&v.illness(v.records[1])==="none");
const d=new ImmuneModel(); d.infect("bacterium"); adv(d,60); d.infect("virus"); adv(d,30); assert(!d.records[1].secondary);
assert(Math.abs(herdThreshold(15)-(1-1/15))<1e-12);
const h=(c)=>{let t=0; for(let s=1;s<=20;s++) t+=new HerdSim({r0:15,coverage:c,seed:s}).run(); return t/20;};
assert(h(0)>0.9 && h(0.95)<0.1); console.log("herd ok");
// 9: herd immunity needs R0 x (1 - coverage x effectiveness) < 1; coverage can exceed 100%
assert(Math.abs(coverageNeeded(15,0.4)-(1-1/15)/0.4)<1e-9 && coverageNeeded(15,0.4)>2);
assert(!herdReached(15,1,0.4)); assert(herdReached(15,0.94,1)); assert(!herdReached(15,0.93,1)); assert(herdReached(15,1,0.95)===false || herdReached(15,0.99,0.95));
// 10: first-generation infections in a fully susceptible population reproduce the displayed R0
for (const r0 of [1.5,3,6,12,15,18]) { let t=0; const N=300; for(let s=1;s<=N;s++){ const g=new HerdSim({r0,seed:s}); for(let d=0;d<4;d++) g.step(); t+=g.firstGeneration()/2; } const mean=t/N; console.log("R0",r0,"gen1",mean.toFixed(2)); assert(Math.abs(mean-r0)/r0<0.15,"R0 "+r0+" gave "+mean); }
// 11: a cleared virus stays cleared
for (const id of ["virus","bacterium"]) { const m=new ImmuneModel(); m.infect(id); adv(m,40); assert(!m.active(id),id+" still active at 40"); for (const day of [100,200,400,600]) { adv(m,day===100?60:day===200?100:200); assert(!m.active(id)&&m.slot(id).P===0&&m.slot(id).I===0,id+" rebounded by day "+day); } }
// 12: a vaccine record is closed when a later exposure starts
{ const m=new ImmuneModel(); m.vaccinate("bacterium"); adv(m,35); const peak=m.records[0].peakAb; m.infect("bacterium"); adv(m,30); assert(m.records[0].closed&&Math.abs(m.records[0].peakAb-peak)<1e-9,"vaccine record changed after infection"); assert(m.records[1].secondary); }
// 7/8: narrative never claims memory right after a vaccine, and never blames the chosen pathogen for another's infection
{ const m=new ImmuneModel(); m.vaccinate("bacterium"); const t0=narrative(m,"y11",{id:"bacterium"}).join(" "); assert(!/Memory B and T cells now remain|memory cells now remain/i.test(t0),t0); assert(/pending|no antibodies/i.test(t0));
  const b=new ImmuneModel(); b.infect("bacterium"); adv(b,2); const tv=narrative(b,"y11",{id:"virus"}).join(" "); assert(/No virus has entered/.test(tv)&&/bacterial infection/.test(tv)&&!/virus have just entered|host cells are infected/.test(tv),tv); }
console.log("ALL PASS");
