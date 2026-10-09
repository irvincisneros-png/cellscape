// Chromatin state at the model gene (β-globin fragment). No DOM — testable with node.
//
//  writers / erasers (toggled by the student):
//    histone acetylation  ac → 1 with HATs on, → 0 with HDACs (and methylated DNA recruits HDACs: ac ≤ 1 − 0.85·me)
//    DNA methylation      me → 1 with DNMTs on the promoter CpGs, → 0 slowly when removed (TET / replication)
//  openness   open → (0.12 + 0.88·ac) · (1 − 0.9·me) · (1 − cond)      (cond = mitotic condensation, 0–1)
//  transcription   tx = kmax · smoothstep(0.35, 0.75, open) · ntp       (RNA pol II needs a nucleosome-free promoter)
//  The DNA sequence never changes: only tags and packing do (epigenetics).

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export class ChromatinModel {
  constructor() { this.reset(); }

  reset() {
    this.stage = "interphase";   // "interphase" (working) | "mitosis" (dividing)
    this.cond = 0;               // mitotic condensation 0–1 (animated)
    this.acOn = true;            // HATs acetylating the gene's histone tails
    this.meOn = false;           // DNMTs methylating the promoter CpGs
    this.ac = 1; this.me = 0;
    this.open = 0.88;
    this.supply = 80;            // NTP supply (%), shared with the nucleus
    this.kmax = 0.5;             // initiations / s when fully open
    this.tx = 0; this.made = 0;
    this.time = 0;
    this.smoothTx = 0;
    this.history = []; this.histT = 0;
  }

  get ntp() { const s = this.supply / 100; return s <= 0 ? 0 : (s / (s + 0.2)) * 1.2; }
  /** the gene's openness ignoring mitosis (what the nucleus level uses) */
  get epiOpen() { return (0.12 + 0.88 * this.ac) * (1 - 0.9 * this.me); }
  get accessible() { return this.open > 0.55; }

  step(dt) {
    if (!dt) return;
    const n = Math.max(1, Math.ceil(dt / 0.05));
    for (let i = 0; i < n; i++) this.stepOnce(dt / n);
  }

  stepOnce(dt) {
    this.time += dt;
    const condT = this.stage === "mitosis" ? 1 : 0;
    this.cond += (condT - this.cond) * Math.min(1, dt * 0.9);
    if (Math.abs(condT - this.cond) < 0.002) this.cond = condT;
    this.me += ((this.meOn ? 1 : 0) - this.me) * Math.min(1, dt * (this.meOn ? 0.5 : 0.25));
    const acT = this.acOn ? 1 - 0.85 * this.me : 0;
    this.ac += (acT - this.ac) * Math.min(1, dt * 0.9);
    const openT = clamp(this.epiOpen * (1 - this.cond), 0, 1);
    this.open += (openT - this.open) * Math.min(1, dt * 0.8);
    this.tx = this.kmax * smooth(0.35, 0.75, this.open) * this.ntp;
    this.made += this.tx * dt;
    this.smoothTx += (this.tx - this.smoothTx) * Math.min(1, dt * 1.5);
    this.histT += dt;
    if (this.histT >= 0.5) {
      this.histT = 0;
      this.history.push({ tx: this.smoothTx, open: this.open, ac: this.ac, me: this.me, cond: this.cond });
      if (this.history.length > 240) this.history.shift();
    }
  }
}
