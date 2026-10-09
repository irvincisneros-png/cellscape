// A working model of a plant cell nucleus (interphase). No DOM — testable with node.
//
//  per gene i:   open_i  → relaxes toward  base_i × (1 − 0.95·condense) × epi_i       (chromatin state)
//                rate_i  = kmax_i · open_i · ntp · polII                               (initiations / s)
//  pre-mRNA  ─(capping, splicing, poly-A; needs ATP)→  mature mRNA  ─(nuclear pores, Ran-GTP)→  cytoplasm
//  nucleolus: RNA polymerase I makes rRNA (rate ∝ ntp) → assembled with imported ribosomal proteins
//             → ribosomal subunits → exported through the pores
//  imports through the pores: RNA polymerase, ribosomal proteins and histones (made in the cytoplasm)
//  Inhibitors: α-amanitin blocks RNA polymerase II only (mRNA genes); actinomycin D blocks all transcription.
//  Units are relative ("molecules per second" in the slowed-down world of the animation).

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sat = (x, k) => (x <= 0 ? 0 : x / (x + k));

/** Genes drawn in the nucleus. kmax: max initiations/s when fully open. base: openness in a leaf cell. */
export const GENES = [
  { id: "hbb", kmax: 0.8, base: 0.9, model: true, introns: 2 },
  { id: "rbcs", kmax: 1.3, base: 1.0, introns: 3 },
  { id: "lhcb", kmax: 1.1, base: 1.0, introns: 0 },
  { id: "act", kmax: 0.6, base: 0.85, introns: 3 },
  { id: "h4", kmax: 0.7, base: 0.9, introns: 0 },
  { id: "te", kmax: 0.8, base: 0.03, hetero: true, introns: 0 },   // silenced transposon in heterochromatin
];

export class NucleusModel {
  constructor() { this.reset(); }

  reset() {
    this.supply = 80;        // ATP / NTP supply from the cytoplasm (%)
    this.condense = 0;       // extra chromatin compaction applied by the student (%)
    this.poresBlocked = false;
    this.amanitin = false;   // α-amanitin: blocks RNA polymerase II
    this.actD = false;       // actinomycin D: blocks all transcription (Pol I, II, III)
    this.genes = GENES.map((g) => ({ ...g, closed: false, epi: 1, open: g.base, rate: 0, made: 0 }));
    this.pol = 1;            // RNA polymerase II available (imported), 0–1
    this.rp = 1;             // ribosomal proteins available (imported), 0–1
    this.histones = 1;       // histones available (imported), 0–1
    this.pre = 3;            // pre-mRNA being processed
    this.mrna = 6;           // mature mRNA waiting in the nucleus
    this.rrna = 3;           // rRNA in the nucleolus (not yet assembled)
    this.sub = 3;            // assembled ribosomal subunits waiting to leave
    this.time = 0;
    this.exported = 0; this.subOut = 0; this.imported = 0;
    this.F = { tx: 0, proc: 0, exp: 0, rtx: 0, asm: 0, subExp: 0, impPol: 0, impRp: 0, impHist: 0, imp: 0, ntp: 0 };
    this.smooth = { tx: 0, exp: 0, subExp: 0, imp: 0 };
    this.histT = 0;
    this.history = [];
  }

  get ntp() { const s = this.supply / 100; return s <= 0 ? 0 : (s / (s + 0.2)) * 1.2; }
  get stopped() { return this.actD || this.amanitin; }
  gene(id) { return this.genes.find((g) => g.id === id); }

  step(dt) {
    if (!dt) return;
    const n = Math.max(1, Math.ceil(dt / 0.05));
    for (let i = 0; i < n; i++) this.stepOnce(dt / n);
  }

  stepOnce(dt) {
    const F = this.F, ntp = this.ntp, pore = this.poresBlocked ? 0 : 1;
    this.time += dt;
    F.ntp = ntp;
    // import through the pores needs the Ran-GTP cycle (GTP from the cytoplasm)
    const impF = pore * (0.3 + 0.7 * ntp);
    // chromatin state and transcription of each gene by RNA polymerase II
    const polF = sat(this.pol, 0.25) / sat(1, 0.25);
    let tx = 0;
    for (const g of this.genes) {
      const target = (g.hetero ? g.base : g.closed ? 0.03 : g.base) * (1 - 0.95 * this.condense / 100) * g.epi;
      g.open += (target - g.open) * Math.min(1, dt * 0.8);
      g.rate = this.stopped ? 0 : g.kmax * g.open * ntp * polF;
      g.made += g.rate * dt;
      tx += g.rate;
    }
    F.tx = tx;
    // processing: 5′ cap, splicing (spliceosomes use ATP), poly-A tail
    F.proc = 0.55 * this.pre * (0.25 + 0.75 * ntp);
    // export of mature mRNA through the pores (mRNA that can't leave is slowly degraded in the nucleus)
    F.exp = 0.22 * this.mrna * pore * (0.4 + 0.6 * ntp);
    this.pre += (tx - F.proc - 0.02 * this.pre) * dt;
    this.mrna += (F.proc - F.exp - 0.012 * this.mrna) * dt;
    // nucleolus: RNA polymerase I (insensitive to α-amanitin; blocked by actinomycin D)
    F.rtx = this.actD ? 0 : 1.1 * ntp;
    const rpF = sat(this.rp, 0.2) / sat(1, 0.2);
    F.asm = 0.5 * this.rrna * rpF;
    F.subExp = 0.25 * this.sub * pore;
    this.rrna += (F.rtx - F.asm - 0.06 * this.rrna) * dt;
    this.sub += (F.asm - F.subExp) * dt;
    // imported proteins: pools relax toward the import supply (they are used up / turned over)
    this.pol += (impF - this.pol) * 0.12 * dt;
    this.rp += (impF - this.rp) * 0.14 * dt;
    this.histones += (impF - this.histones) * 0.05 * dt;
    F.impPol = 0.6 * impF;
    F.impRp = 1.3 * impF * (0.3 + 0.7 * Math.min(1, F.rtx));
    F.impHist = 0.7 * impF;
    F.imp = F.impPol + F.impRp + F.impHist;
    this.pre = clamp(this.pre, 0, 40); this.mrna = clamp(this.mrna, 0, 40);
    this.rrna = clamp(this.rrna, 0, 30); this.sub = clamp(this.sub, 0, 30);
    this.exported += F.exp * dt; this.subOut += F.subExp * dt; this.imported += F.imp * dt;
    const k = Math.min(1, dt * 1.5), S = this.smooth;
    S.tx += (F.tx - S.tx) * k; S.exp += (F.exp - S.exp) * k; S.subExp += (F.subExp - S.subExp) * k; S.imp += (F.imp - S.imp) * k;
    this.histT += dt;
    if (this.histT >= 0.5) {
      this.histT = 0;
      this.history.push({ tx: S.tx, exp: S.exp, sub: S.subExp, imp: S.imp, mrna: this.mrna });
      if (this.history.length > 240) this.history.shift();
    }
  }
}
