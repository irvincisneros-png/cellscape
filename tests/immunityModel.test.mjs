import { ImmuneModel, HerdSim, herdThreshold } from "../assets/js/world/levels/immunityModel.js";
import assert from "node:assert";
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
assert(h(0)>0.9 && h(0.95)<0.1); console.log("herd ok"); console.log("ALL PASS");
