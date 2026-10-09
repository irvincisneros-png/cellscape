// Specialised cells: small, testable models plus the lens-aware text for the "gallery of specialists" level.
// Pure data and maths (no THREE, no DOM) so the numbers can be checked with node (see the checks at the bottom of
// the brief). Each demo's narrative is generated from the model's numbers, never from switch states alone.
//
// Wording for the structure-function statements follows the LifeLens provenance file (six cases + limits); extra
// cells (sperm, ciliated, guard) use the same careful phrasing. Known errors in older sources are avoided:
//   - microvilli are NOT mentioned with the 600x figure (that was villi + folds + microvilli together);
//   - root hair cells take in water by OSMOSIS and mineral ions by ACTIVE TRANSPORT;
//   - mature red blood cells have no nucleus and no mitochondria (so "all cells have..." is never written).

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const f0 = (v) => Math.round(v);
const f1 = (v) => v.toFixed(1);
const f2 = (v) => v.toFixed(2);

// =====================================================================================================================
// 1. Red blood cell: shape -> surface area : volume -> oxygen loading time, and squeezing through a capillary
// =====================================================================================================================
export const RBC = {
  V: 90,                 // volume, fL = um^3 (mean corpuscular volume of a healthy adult is about 80-100 fL)
  A_BI: 130,             // set below from the drawn profile (real cells: about 130-140 um^2)
  T95_BI: 45,            // ms: time to ~95 % oxygen saturation for the real shape (in vitro half-times are tens of ms)
  D_BI: 1.25,            // um: greatest distance from the inside of a biconcave cell to its surface (about half the rim thickness)
};
/** Evans-Fung biconcave profile blended from a sphere (s = 0); scaled so the volume stays 90 fL. Area is integrated from that same profile. */
export function rbcShape(s) {
  const co = [lerp(1, 0.2072, s), lerp(0, 2.0026, s), lerp(0, -1.1228, s)], f = lerp(1, 0.5, s);
  const zeta = (r) => f * Math.sqrt(Math.max(0, 1 - r * r)) * (co[0] + co[1] * r * r + co[2] * r ** 4);
  let I = 0; const n = 400;
  for (let i = 0; i < n; i++) { const r = (i + 0.5) / n; I += (r * zeta(r)) / n; }
  const R = Math.cbrt(RBC.V / (4 * Math.PI * I));
  let A = 0, px = 0, pz = zeta(0); const m = 800;
  for (let i = 1; i <= m; i++) { const rho = Math.sin((i / m) * Math.PI / 2), z = zeta(rho); A += ((rho + px) / 2) * Math.hypot(rho - px, z - pz); px = rho; pz = z; }
  return { R, zeta, area: 4 * Math.PI * R * R * A };
}
RBC.R_SPHERE = Math.cbrt((3 * RBC.V) / (4 * Math.PI));          // 2.78 um
RBC.A_SPHERE = 4 * Math.PI * RBC.R_SPHERE ** 2;                  // 97.1 um^2
RBC.A_BI = rbcShape(1).area;                                      // about 130 um^2 from the drawn profile (real cells: about 130-140)
/** Area needed to fold the cell into a capsule (cylinder with hemispherical ends) that fills a tube of radius a. */
export function areaInTube(a) {
  const capV = (4 / 3) * Math.PI * a ** 3;
  if (capV >= RBC.V) return RBC.A_SPHERE * (a >= RBC.R_SPHERE ? 1 : 1);           // wide tube: the cell can stay a ball
  const L = (RBC.V - capV) / (Math.PI * a * a);
  return 2 * Math.PI * a * L + 4 * Math.PI * a * a;
}
/** Smallest tube radius this shape can enter without stretching its membrane (a lipid bilayer tears if stretched much past ~3 %). */
export function minTubeRadius(area) {
  if (area >= areaInTube(0.05)) return 0.05;
  let lo = 0.05, hi = RBC.R_SPHERE;
  for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (areaInTube(m) > area) lo = m; else hi = m; }
  return hi;
}
/** s: 0 = sphere, 1 = biconcave disc. tubeDiam: capillary diameter in um. */
export function rbcState(s, tubeDiam = 4) {
  const A = rbcShape(s).area;                                   // the same volume-normalised profile that is drawn
  const sav = A / RBC.V;
  const savBi = RBC.A_BI / RBC.V;
  const t95 = RBC.T95_BI * (savBi / sav);                       // loading is limited by the membrane area: tau = V / (P A)
  const d = RBC.R_SPHERE - (RBC.R_SPHERE - RBC.D_BI) * s;       // diffusion distance
  const aMin = minTubeRadius(A);
  const minDiam = 2 * aMin;
  return { s, A, V: RBC.V, sav, savBi, t95, tau: t95 / 3, d, minDiam, tubeDiam, canPass: tubeDiam >= minDiam - 1e-6, surplus: A / RBC.A_SPHERE - 1 };
}
/** Oxygen saturation (0-1) after t seconds of "lungs" (loading) or "tissue" (unloading), with time slowed by `slow`. */
export function rbcSaturation(prev, loading, dt, st, slow = 50) {
  const k = dt / ((st.tau / 1000) * slow);
  return loading ? prev + (1 - prev) * (1 - Math.exp(-k)) : prev + (0.25 - prev) * (1 - Math.exp(-k * 0.8));
}

// =====================================================================================================================
// 2. Motor neuron: fibre diameter + myelin -> conduction speed (saltatory conduction)
// =====================================================================================================================
/** d: AXON (core) diameter in um. Myelin adds an insulating sheath, so the whole fibre is D = d / 0.65 wide (g-ratio ~0.65).
 *  Unmyelinated: v ~ 1.1 sqrt(d) m/s (a 1 um C fibre ~ 1 m/s; squid giant axon, 500 um, ~ 25 m/s).
 *  Myelinated: v ~ 6 D m/s (Hursh: a 16 um fibre ~ 100 m/s). Internodes are about 100 D long. */
export function neuronState(myelin, d) {
  const D = d / 0.65;
  const v = myelin ? 6 * D : 1.1 * Math.sqrt(d);
  const internode = 100 * D;                                   // um between nodes of Ranvier
  const tMetre = 1 / v;                                        // s to travel 1 m (motor neuron from spinal cord to foot)
  const exposed = myelin ? 1 / internode : 1;                  // fraction of membrane where ions cross (1 um node / internode)
  return { myelin, d, D, v, internode, tMetre, nodesPerMetre: myelin ? 1e6 / internode : 0, exposed, vUnmyel: 1.1 * Math.sqrt(d), vMyel: 6 * D };
}
/** On-screen travel time (s) for the (slowed, compressed) animation: v = 100 m/s -> 1.2 s, v = 1 m/s -> about 7.6 s. */
export const neuronScreenTime = (v) => 1.2 * Math.pow(100 / clamp(v, 0.3, 140), 0.4);

// =====================================================================================================================
// 3. Skeletal muscle fibre: activation -> sarcomere shortening; ATP supply from mitochondria -> fatigue
// =====================================================================================================================
export class MuscleModel {
  constructor() {
    this.atp = 1;            // ATP available to cross-bridges, as a fraction of the resting level
    this.act = 0;            // neural drive 0-1 (what the student holds)
    this.force = 0;          // 0-1
    this.SL = 2.6;           // sarcomere length, um (rest ~2.5-2.6 um; ~1.8 um when strongly contracted)
    this.mito = 1;           // relative mitochondrial density
    this.cycles = 0;         // contractions completed (for missions)
    this.fatigued = false; this.fatigueSeen = false; this.recovered = false;
    this._prevAct = 0;
  }
  static P = 0.15; static C = 0.3; static K = 0.1;
  fForce(x) { return (x * (1 + MuscleModel.K)) / (x + MuscleModel.K); }
  step(dt) {
    const M = MuscleModel;
    const a = this.act;
    // dx/dt = supply - use. Supply: aerobic respiration in the mitochondria refills ATP; use: cross-bridge cycling needs ATP per pull.
    const atp0 = this.atp;
    const sub = Math.max(1, Math.ceil(dt / 0.05));
    for (let i = 0; i < sub; i++) {
      const h = dt / sub;
      this.atp = clamp(this.atp + h * (M.P * this.mito * (1 - this.atp) - M.C * a * this.atp / (this.atp + 0.1)), 0, 1);
    }
    this.trend = (this.trend ?? 0) + (((this.atp - atp0) / Math.max(dt, 1e-3)) - (this.trend ?? 0)) * clamp(dt / 0.6, 0, 1);
    this.force = a * this.fForce(this.atp);
    const target = 2.6 - 0.8 * this.force;
    this.SL += (target - this.SL) * clamp(dt / 0.12, 0, 1);
    if (a > 0.6 && this._prevAct <= 0.6) this.cycles++;
    this._prevAct = a;
    this.fatigued = a > 0.6 && this.force < 0.55 * a;
    if (this.fatigued) this.fatigueSeen = true;
    if (a < 0.1 && this.fatigueSeen && this.atp > 0.8) this.recovered = true;
    return this;
  }
  get shorten() { return 1 - this.SL / 2.6; }
}

// =====================================================================================================================
// 4. Sperm: midpiece mitochondria -> ATP -> beat frequency -> swimming speed
// =====================================================================================================================
export class SpermModel {
  constructor() { this.atp = 0.7; this.mito = 1; this.F = 0.9; this.speed = 0; this.moved = 0; this.peak = 0; this.timeFast = 0; }
  static P = 0.6; static G = 0.025; static U = 0.5; static K = 0.5; static VMAX = 110; static FMAX = 12;   // um/s, Hz (real beat ~10-20 Hz)
  step(dt) {
    const S = SpermModel;
    const sub = Math.max(1, Math.ceil(dt / 0.05));
    for (let i = 0; i < sub; i++) {
      const h = dt / sub;
      const F = (this.atp * (1 + S.K)) / (this.atp + S.K);
      this.atp = clamp(this.atp + h * ((S.P * this.mito + S.G) * (1 - this.atp) - S.U * F * this.atp), 0, 1);   // mitochondria + a small glycolytic supply along the tail
    }
    this.F = (this.atp * (1 + SpermModel.K)) / (this.atp + SpermModel.K);
    this.speed = SpermModel.VMAX * this.F;
    this.hz = SpermModel.FMAX * this.F;
    this.moved += this.speed * dt;
    this.peak = Math.max(this.peak, this.speed);
    return this;
  }
  /** steady-state speed for a given mitochondrial fraction (for tests / narrative) */
  static steady(m) {
    const k = Math.round(m * 1000), c = (SpermModel._c ||= new Map());
    if (!c.has(k)) { const sp = new SpermModel(); sp.mito = k / 1000; for (let i = 0; i < 4000; i++) sp.step(0.05); c.set(k, sp.speed); }
    return c.get(k);
  }
}

// =====================================================================================================================
// 5. Ciliated airway cell: ciliary activity (and smoke) -> mucus speed -> particles cleared
// =====================================================================================================================
export const CILIA = { VMAX_MM_MIN: 10, SLOW: 6 };         // mucus moves about 4-20 mm/min in healthy airways; the animation is slowed 6x
export function ciliaState(activity, smoke) {
  const eff = smoke ? activity * 0.12 : activity;           // smoke slows and paralyses cilia (and damages them with long exposure)
  const vmm = CILIA.VMAX_MM_MIN * eff ** 1.15;              // coordinated beating: the effect of a lower beat is slightly more than proportional
  return { activity, smoke, eff, mmPerMin: vmm, umPerS: (vmm * 1000) / 60, beatHz: 12 * eff, mucus: smoke ? 1.6 : 1 };
}

// =====================================================================================================================
// 6. Root hair cell: hair length -> surface area; soil water potential -> osmosis; ATP -> active uptake of ions
// =====================================================================================================================
export const ROOT = { A_BODY: 6000, R_HAIR: 5, PSI_CELL: -0.8, PSI_REF: -0.05, CSOIL: 0.5, CCELL: 100 };
export function rootState(L, psiSoil, o2) {
  const A_hair = 2 * Math.PI * ROOT.R_HAIR * L;
  const A = ROOT.A_BODY + A_hair;
  const ratio = A / ROOT.A_BODY;
  const dPsi = psiSoil - ROOT.PSI_CELL;                       // MPa; > 0: water potential is higher (less negative) in the soil, so water enters
  const dRef = ROOT.PSI_REF - ROOT.PSI_CELL;
  const water = ratio * (dPsi / dRef);                        // relative to a hairless cell in wet soil (= 1)
  const atpF = o2 ? 1 : 0.1;                                   // waterlogged soil: little O2, so little aerobic ATP
  const ion = ratio * atpF;                                    // active transport proteins x ATP; relative to a hairless cell with oxygen
  const losing = dPsi < 0;
  return { L, A, A_hair, ratio, dPsi, water, ion, atpF, losing, wiltRisk: dPsi < 0.1 };
}

// =====================================================================================================================
// 7. Palisade mesophyll: light (and CO2) -> rate of photosynthesis, with chloroplast avoidance in strong light
// =====================================================================================================================
export function palisadeState(light, co2 = 1, avoidance = true) {
  const avoid = avoidance ? smooth(light, 0.7, 1.0) : 0;       // fraction of chloroplasts that have moved to the side walls
  const absorbed = light * (1 - 0.3 * avoid);                 // chloroplasts edge-on to the light absorb less
  const K = 0.25, Kc = 0.3;
  const rate = clamp(100 * (absorbed * (1 + K) / (absorbed + K)) * (co2 * (1 + Kc) / (co2 + Kc)), 0, 100);
  // limiting factor from the model's own sensitivity: how much +10 % of full light or CO2 would add
  const at = (l, c) => { const a = l * (1 - 0.3 * (avoidance ? smooth(l, 0.7, 1.0) : 0)); return clamp(100 * (a * (1 + K) / (a + K)) * (c * (1 + Kc) / (c + Kc)), 0, 100); };
  const gainLight = at(Math.min(1, light + 0.1), co2) - rate, gainCo2 = at(light, Math.min(1, co2 + 0.1)) - rate;
  const limiting = gainLight > 1.6 * gainCo2 ? "light" : gainCo2 > 1.6 * gainLight ? "co2" : "both";
  return { light, co2, avoid, absorbed, rate, limiting, gainLight, gainCo2, o2: rate, glucose: rate };
}

// =====================================================================================================================
// 8. Guard cells: light (K+ uptake) and water supply -> turgor -> stomatal pore width
// =====================================================================================================================
export class GuardModel {
  constructor() { this.light = 0.1; this.water = 1; this.K = 0.2; this.P = 0; this.open = 0.7; this.maxOpen = 0; this.closedByDrought = false; this.openSeen = false; this._init(); }
  _init() { for (let i = 0; i < 400; i++) this.step(0.05); this.maxOpen = 0; this.openSeen = false; this.closedByDrought = false; }
  get aba() { return smooth(1 - this.water, 0.4, 0.9); }                    // the drought hormone rises as the leaf dries
  get psiLeaf() { return 0.3 + 1.2 * (1 - this.water); }                    // |water potential| of the leaf apoplast, MPa
  get kTarget() { return (0.08 + 0.9 * this.light) * (1 - 0.9 * this.aba); }
  get osm() { return 0.3 + 1.6 * this.K; }                                   // solute potential magnitude of a guard cell, MPa
  step(dt) {
    this.K += (this.kTarget - this.K) * clamp(dt / 4, 0, 1);                 // time constant sped up (real: tens of minutes)
    this.P = Math.max(0, this.osm - this.psiLeaf);                           // equilibrium: psi_cell = -osm + P = psi_apoplast
    const target = clamp(this.P / 1.2, 0, 1);
    this.open += (target - this.open) * clamp(dt / 1.2, 0, 1);
    this.maxOpen = Math.max(this.maxOpen, this.open);
    if (this.open > 0.8) this.openSeen = true;
    if (this.openSeen && this.open < 0.15 && this.water < 0.5 && this.light > 0.5) this.closedByDrought = true;
    return this;
  }
  get pore() { return 10 * this.open; }                                       // um (pore width at the middle)
  get co2In() { return this.open; }
  get waterLoss() { return this.open; }
}

// =====================================================================================================================
// 9. Xylem vessel: diameter -> flow (Hagen-Poiseuille), air bubble (embolism)
// =====================================================================================================================
export function xylemState(d, tension, bubble) {
  const rel = (d / 20) ** 4;                                   // flow per unit pressure gradient ~ r^4 (relative to a 20 um vessel)
  const flow = bubble ? 0 : rel * tension;
  // the neighbouring (22 um) vessel: its own flow, plus the share of water bypassing a blocked vessel through pits; zero when there is no pull
  const relNb = (22 / 20) ** 4, flowNb = tension * (relNb + (bubble ? 0.5 * rel : 0));
  return { d, tension, bubble, rel, flow, flowNb, risk: smooth(d, 40, 140) };
}

// =====================================================================================================================
// Specialists: text and structure-function rows
// =====================================================================================================================
export const ORDER = ["rbc", "neuron", "muscle", "sperm", "cilia", "roothair", "palisade", "guard", "xylem"];
export const KINGDOM = { rbc: "animal", neuron: "animal", muscle: "animal", sperm: "animal", cilia: "animal", roothair: "plant", palisade: "plant", guard: "plant", xylem: "plant" };

export const SPEC = {
  rbc: {
    name: "Red blood cell", color: "#e0414c", band: "y7-8",
    size: { "y7-8": "about 7.5 µm across (a hundred would fit across a full stop)", "y9-10": "about 7.5 µm across, 2 µm thick" },
    job: "Carries oxygen around the body",
    jobCard: { "y7-8": "Carries oxygen around the body in the blood", "y9-10": "Carries oxygen from the lungs to the tissues" },
    rows: [
      { part: "Biconcave disc", how: {
        "y7-8": "The dip in the middle makes the cell thin, so oxygen has only a short way to go. The flat shape also gives it lots of surface for its size.",
        "y9-10": "A flattened disc has a large surface area compared with its volume (a high <strong>SA:V</strong>), so oxygen moves in and out quickly.",
        y11: "Area ≈ 130 µm² for a volume ≈ 90 fL (SA:V ≈ 1.45 µm⁻¹); a sphere of the same volume has only ≈ 97 µm². The disc also keeps every part of the cytoplasm within about 1 µm of the membrane (a short diffusion distance), and the spare membrane lets the cell fold without stretching." } },
      { part: "No nucleus or mitochondria (when mature)", how: {
        "y7-8": "A mature red blood cell has lost its nucleus, which leaves more room for the oxygen-carrying protein. It has no mitochondria, so it does not use up the oxygen it carries.",
        "y9-10": "Mature mammalian red blood cells have no nucleus and no mitochondria. More space for haemoglobin, and the cell does not respire aerobically, so it does not consume the oxygen it carries.",
        y11: "A mature mammalian erythrocyte has ejected its nucleus and lost its mitochondria. It makes ATP by <strong>glycolysis</strong> in the cytosol (forming lactate), which keeps its pumps and membrane working. With no nucleus it cannot make new proteins, so it survives about 120 days." } },
      { part: "Packed with haemoglobin", how: {
        "y7-8": "Each cell is full of <strong>haemoglobin</strong>, a red protein that picks up oxygen in the lungs and lets go of it where it is needed.",
        "y9-10": "About a third of the cell's content is the protein <strong>haemoglobin</strong>, which contains iron and binds oxygen reversibly, so it loads in the lungs and unloads in the tissues.",
        y11: "Roughly 270 million haemoglobin molecules per cell; each binds up to four O₂ at its haem groups. Binding is cooperative, so the O₂ saturation curve is S-shaped: haemoglobin is almost full across the high-pO₂ plateau in the lungs, and the steep middle part means a small fall in pO₂ in working tissue releases a lot of O₂." } },
      { part: "Flexible", how: {
        "y7-8": "The cell can squash and bend to squeeze through the tiniest blood vessels, which can be narrower than the cell.",
        "y9-10": "The cell is soft and flexible: it folds to pass through capillaries as narrow as about 3 µm, then springs back.",
        y11: "A flexible spectrin–actin network under the membrane lets the cell fold into a bullet or parachute shape in a capillary narrower than itself. The membrane cannot stretch much, so the spare area of the biconcave shape is what makes this possible." } },
    ],
    limit: "This is a mature mammalian example. Red blood cells of birds and reptiles keep their nucleus.",
    chain: null,
    chainNote: { "y7-8": "Red blood cells float in plasma. Together they make blood, which is counted as a tissue.", "y9-10": "Blood is a connective tissue (red cells, white cells, platelets and plasma). The activity in this level does not build a full cell-to-organism chain for it." },
  },
  neuron: {
    name: "Motor neuron", color: "#b794f6", band: "y7-8",
    size: { "y7-8": "cell body about 20 µm; the axon can be up to a metre long (drawn shortened)", "y9-10": "cell body 10–50 µm; axon up to about 1 m (drawn truncated, not to scale)" },
    job: "Sends electrical signals quickly over long distances",
    jobCard: { "y7-8": "Sends electrical signals quickly along the body", "y9-10": "Transmits electrical impulses over long distances" },
    rows: [
      { part: "Dendrites", how: {
        "y7-8": "Branching arms that receive signals from other cells.",
        "y9-10": "Short, branching extensions with a large surface that receive signals from other neurons.",
        y11: "Dendrites carry many synapses. Inputs add up (summation) at the axon hillock; if the sum reaches threshold an action potential starts." } },
      { part: "Cell body (with nucleus)", how: {
        "y7-8": "The control centre: it holds the nucleus and keeps the whole cell alive.",
        "y9-10": "Holds the nucleus and most organelles. It makes the proteins and membranes that the long axon needs.",
        y11: "Ribosomes, rough ER and mitochondria make proteins and ATP; motor proteins carry cargo down the axon on microtubules (axonal transport)." } },
      { part: "Long axon", how: {
        "y7-8": "A long thin 'wire' that carries the signal away from the cell body, sometimes for a metre.",
        "y9-10": "A long, thin extension that carries the impulse away from the cell body to the next cell.",
        y11: "An axon of a motor neuron can reach about 1 m, but is only a few µm wide: a high ratio of length to width. The wider the axon, the faster the impulse (much more so with myelin)." } },
      { part: "Myelin sheath and nodes of Ranvier", how: {
        "y7-8": "A fatty insulating coat with small gaps. The signal jumps from gap to gap, which makes it much faster.",
        "y9-10": "Myelin insulates the axon. The impulse jumps between the gaps (<strong>nodes of Ranvier</strong>), so it travels faster (about 100 m/s instead of 1 m/s).",
        y11: "Myelin is made by Schwann cells in the peripheral nervous system (oligodendrocytes in the brain and spinal cord). Voltage-gated Na⁺ channels are concentrated at the nodes, so the action potential regenerates only there and the current jumps between nodes (<strong>saltatory conduction</strong>). Far fewer ions cross the membrane, so far less ATP is spent restoring them." } },
      { part: "Synaptic terminals", how: {
        "y7-8": "The tips of the axon pass the message on to the next cell, here a muscle fibre.",
        "y9-10": "The axon ends in swellings that release a chemical (a <strong>neurotransmitter</strong>) across the gap to the next cell.",
        y11: "The arriving action potential opens Ca²⁺ channels, so vesicles fuse and release neurotransmitter (acetylcholine at a neuromuscular junction) into the synaptic cleft." } },
    ],
    limit: "Neurons vary in shape and connections. This is a motor neuron; sensory and inter-neurons look different.",
    chain: ["motor neuron", "nervous tissue (grey matter)", "spinal cord", "nervous system", "human"],
  },
  muscle: {
    name: "Skeletal muscle fibre", color: "#ef6f6c", band: "y7-8",
    size: { "y7-8": "about 50 µm wide, but can be several centimetres long (drawn shortened)", "y9-10": "10–100 µm wide, up to many cm long (drawn truncated)" },
    job: "Shortens to help produce movement",
    jobCard: { "y7-8": "Shortens (contracts) to make the body move", "y9-10": "Contracts to produce movement" },
    rows: [
      { part: "Long, with many nuclei", how: {
        "y7-8": "One very long cell with many nuclei, so there are many sets of instructions along its length.",
        "y9-10": "A single long cell with many nuclei (it forms when many small cells fuse), giving many sites that make proteins along its length.",
        y11: "The multinucleate fibre forms when myoblasts fuse. The nuclei lie just under the cell membrane (the sarcolemma), leaving the centre free for contractile proteins." } },
      { part: "Striped (striated) myofibrils", how: {
        "y7-8": "Inside are bundles of thread-like parts. They make the cell look striped and they do the shortening.",
        "y9-10": "Bundles of <strong>myofibrils</strong> made of repeating units called <strong>sarcomeres</strong>; these give the striped look and do the shortening.",
        y11: "Each sarcomere is thick <strong>myosin</strong> filaments between thin <strong>actin</strong> filaments. In the <strong>sliding filament</strong> model, myosin heads bind actin, pivot and pull the thin filaments inwards, so the sarcomere shortens while the filaments keep their length. Each cross-bridge cycle uses one ATP." } },
      { part: "Many mitochondria", how: {
        "y7-8": "Lots of tiny power stations that release the energy the muscle needs.",
        "y9-10": "Many <strong>mitochondria</strong> supply the ATP for contraction by aerobic respiration. If ATP supply cannot keep up, the muscle tires (a simplification used in this demo).",
        y11: "ATP is needed for the myosin power stroke and to detach myosin from actin, and for the Ca²⁺ pumps that relax the fibre. Real fatigue is not just ATP running out: it comes from interacting metabolic changes (for example phosphate, ADP and pH), ionic shifts (such as K⁺) and failures in excitation–contraction coupling. This demo simplifies it to ATP supply versus use." } },
    ],
    limit: "A fibre is one specialised cell, not the whole biceps muscle.",
    chain: ["skeletal muscle fibre", "skeletal muscle tissue", "biceps brachii", "muscular system", "human"],
  },
  sperm: {
    name: "Sperm cell", color: "#7dd3fc", band: "y7-8",
    size: { "y7-8": "about 55 µm long in total (the head is only about 5 µm)", "y9-10": "about 55 µm long; head about 5 µm" },
    job: "Swims to an egg cell and fertilises it",
    jobCard: { "y7-8": "Swims to an egg cell and joins with it", "y9-10": "Swims to and fertilises an egg cell" },
    rows: [
      { part: "Head: nucleus and acrosome", how: {
        "y7-8": "The head carries half of a person's genetic information. A cap at the front holds chemicals that help the sperm get into the egg.",
        "y9-10": "The head holds a <strong>haploid</strong> nucleus (23 chromosomes, half the usual set). The <strong>acrosome</strong> at the front holds enzymes that help the sperm penetrate the egg's outer layers.",
        y11: "The haploid nucleus (n = 23) is tightly packed. On contact with the egg coat the acrosome releases hydrolytic enzymes (the acrosome reaction); after fusion the egg's membrane changes to block other sperm." } },
      { part: "Midpiece full of mitochondria", how: {
        "y7-8": "A section packed with power stations that supply the energy for swimming.",
        "y9-10": "Packed with <strong>mitochondria</strong> that supply the ATP for the tail to beat.",
        y11: "Mitochondria wrap the midpiece in a spiral. ATP from them (and from glycolysis along the tail) powers the dynein motors that make the flagellum bend." } },
      { part: "Flagellum (tail)", how: {
        "y7-8": "A long tail that whips from side to side and pushes the sperm forward.",
        "y9-10": "A long <strong>flagellum</strong> beats in waves to push the cell forward through fluid.",
        y11: "The tail's core is a 9 + 2 arrangement of microtubules. Dynein arms slide the microtubule doublets past each other, and because they are anchored the tail bends. The wave travels from head to tail." } },
      { part: "Streamlined, with little cytoplasm", how: {
        "y7-8": "Small and smooth-shaped, so it moves through fluid easily.",
        "y9-10": "The streamlined head and the small amount of cytoplasm reduce drag and weight.",
        y11: "Most of the cytoplasm is shed during development, which reduces mass and drag." } },
    ],
    limit: "Sperm are gametes, not part of a tissue. Not every sperm is a strong swimmer.",
    chain: null,
    chainNote: { "y7-8": "Sperm are made in the testes and are not part of a tissue the way muscle fibres are.", "y9-10": "Sperm are gametes made in the testes (an organ) in the male reproductive system; they do not form a tissue themselves." },
  },
  cilia: {
    name: "Ciliated epithelial cell (airway)", color: "#f9a8d4", band: "y7-8",
    size: { "y7-8": "about 25 µm tall; each cilium is about 6 µm long", "y9-10": "about 25–30 µm tall, with a few hundred cilia, each about 6 µm" },
    job: "Sweeps mucus and trapped particles out of the airways",
    jobCard: { "y7-8": "Sweeps mucus and dust out of the airways", "y9-10": "Moves mucus (and trapped particles) along the airway" },
    rows: [
      { part: "Cilia (hair-like projections)", how: {
        "y7-8": "Tiny hairs that sweep back and forth together like a field of grass in the wind, pushing the mucus along.",
        "y9-10": "Hundreds of <strong>cilia</strong> beat in coordinated waves, moving the layer of mucus (with the dust and microbes it traps) up and out of the airway.",
        y11: "Each cilium has a 9 + 2 microtubule core and dynein motors, with a fast, straight power stroke and a slow, bent recovery stroke. Neighbouring cilia beat slightly out of step (a metachronal wave), which gives a steady flow." } },
      { part: "Many mitochondria near the surface", how: {
        "y7-8": "Power stations close to the cilia give them the energy to keep beating.",
        "y9-10": "Mitochondria packed just under the cilia supply the ATP for beating.",
        y11: "Dynein ATPase powers each beat. Mitochondria are concentrated at the apex, close to the basal bodies that anchor the cilia." } },
      { part: "Neighbouring goblet cells", how: {
        "y7-8": "Nearby cells make the sticky mucus that traps germs and dust.",
        "y9-10": "<strong>Goblet cells</strong> between the ciliated cells secrete the mucus that traps particles.",
        y11: "Goblet cells release mucin glycoproteins by exocytosis; the mucus layer floats on a watery layer in which the cilia beat." } },
    ],
    limit: "Not every airway cell is ciliated: goblet cells and others sit between them. Cigarette smoke slows and damages cilia.",
    chain: ["ciliated epithelial cell", "ciliated epithelium", "trachea", "respiratory system", "human"],
    chainExtra: true,
  },
  roothair: {
    name: "Root hair cell", color: "#fbbf77", band: "y7-8",
    size: { "y7-8": "the hair is about 10 µm wide and can be a millimetre long (drawn shortened)", "y9-10": "hair about 10 µm wide, 0.1–1 mm or more long (drawn truncated)" },
    job: "Absorbs water and mineral ions from the soil",
    jobCard: { "y7-8": "Takes in water and minerals from the soil", "y9-10": "Absorbs water and mineral ions from the soil" },
    rows: [
      { part: "Long hair-like extension", how: {
        "y7-8": "A thin, long hair that reaches between soil particles and gives a very large surface to take in water.",
        "y9-10": "The hair greatly increases the <strong>surface area</strong> in contact with the soil water, so more water and minerals can be absorbed.",
        y11: "The hair is a tubular outgrowth of one epidermal cell. It adds a lot of membrane for a tiny extra volume, which raises the SA:V. It does not pump water by itself; water follows the water-potential gradient." } },
      { part: "Thin wall, large vacuole", how: {
        "y7-8": "A thin wall lets water pass easily, and the big central space is full of a salty solution.",
        "y9-10": "Water moves into the cell by <strong>osmosis</strong>, from the soil water (high water potential) to the cell sap (lower water potential).",
        y11: "Water moves by osmosis down a water-potential gradient from soil to the vacuole (cell sap has a more negative solute potential). If the soil is drier than the cell, water leaves instead." } },
      { part: "Many mitochondria", how: {
        "y7-8": "Power stations supply the energy for taking in minerals.",
        "y9-10": "Many mineral ions (for example nitrate) are scarce in the soil and the inside of the cell is electrically negative, so they are taken in by <strong>active transport</strong>, which needs ATP from respiration.",
        y11: "Proton pumps (H⁺-ATPase) use ATP to push H⁺ out, making the outside acidic and the inside negative (about −120 mV). Nitrate is then brought in with H⁺ by a cotransporter (NO₃⁻/H⁺) against its electrochemical gradient: the negative inside repels the anion as well as its concentration being low. In waterlogged, low-oxygen soil, ATP supply drops and uptake falls." } },
      { part: "No chloroplasts", how: {
        "y7-8": "No chloroplasts: it is underground where there is no light.",
        "y9-10": "It has no chloroplasts because it is underground, out of the light.",
        y11: "Without light there is no photosynthesis here, so the cell relies on sugars sent from the leaves for respiration." } },
    ],
    limit: "The extension increases surface area; it does not pump all water by itself.",
    chain: ["root hair cell", "root epidermal tissue", "root", "root system", "flowering plant"],
  },
  palisade: {
    name: "Palisade mesophyll cell", color: "#4ade80", band: "y7-8",
    size: { "y7-8": "about 20 µm wide and 80 µm tall", "y9-10": "about 15–30 µm wide, 60–100 µm tall" },
    job: "Captures light for photosynthesis in a leaf",
    jobCard: { "y7-8": "Catches sunlight to make food by photosynthesis", "y9-10": "Carries out most of the leaf's photosynthesis" },
    rows: [
      { part: "Tall column, tightly packed near the top surface", how: {
        "y7-8": "Tall cells stand side by side just under the top of the leaf where the light arrives.",
        "y9-10": "Tall, column-shaped cells in a layer just under the upper epidermis: they catch the light first and pass it down through the layer.",
        y11: "The palisade layer lies just under the upper epidermis and cuticle. Its columns let light penetrate deep, and the narrow air gaps between them let CO₂ diffuse to the long cell walls." } },
      { part: "Many chloroplasts", how: {
        "y7-8": "Packed with green chloroplasts, the parts that catch light.",
        "y9-10": "Packed with <strong>chloroplasts</strong>, which hold the chlorophyll that absorbs light for photosynthesis.",
        y11: "A mesophyll cell can have tens of chloroplasts. In weak light they spread over the walls facing the light; in strong light they move to the side walls (<strong>chloroplast avoidance</strong>), which reduces light damage." } },
      { part: "Large vacuole, chloroplasts near the wall", how: {
        "y7-8": "A big central space pushes the chloroplasts to the edge of the cell, close to the light and the air.",
        "y9-10": "A large vacuole pushes the cytoplasm and chloroplasts out against the cell wall, close to the light and to the carbon dioxide.",
        y11: "The thin layer of cytoplasm pressed against the wall shortens the diffusion path for CO₂ and exposes the chloroplasts to light." } },
    ],
    limit: "This is a common leaf arrangement, not a claim about every plant cell.",
    chain: ["palisade mesophyll cell", "palisade tissue", "leaf", "shoot system", "flowering plant"],
  },
  guard: {
    name: "Guard cells (with a stoma)", color: "#86efac", band: "y7-8",
    size: { "y7-8": "the pair is about 30 µm long", "y9-10": "a pair is about 20–50 µm long; the pore is up to about 10 µm wide" },
    job: "Open and close the leaf pore (stoma)",
    jobCard: { "y7-8": "Open and close tiny holes in a leaf", "y9-10": "Open and close a leaf pore (stoma) to control gas exchange and water loss" },
    rows: [
      { part: "A pair of bean-shaped cells around a pore", how: {
        "y7-8": "Two curved cells form the edges of a tiny hole (a stoma). When they swell the hole opens; when they go floppy it closes.",
        "y9-10": "Two cells surround each <strong>stoma</strong>. Water entering makes them <strong>turgid</strong> and bend apart, opening the pore; water loss makes them flaccid and the pore closes.",
        y11: "Pore width tracks guard-cell turgor, which is set by solute content. In light, blue-light receptors drive H⁺-ATPases; the membrane hyperpolarises and K⁺ (with Cl⁻ and malate) enters, so water follows by osmosis and the cells swell." } },
      { part: "Thicker inner wall", how: {
        "y7-8": "One side of each cell has a thicker wall, so when the cell swells it bends outward instead of just getting fatter.",
        "y9-10": "The wall next to the pore is thicker than the outer wall, so when the cell swells it bows outward and the pore opens.",
        y11: "Cellulose microfibrils run around the cell like hoops, so it lengthens rather than widens. The thicker inner wall stretches less than the thin outer wall, so the cell curves apart." } },
      { part: "Chloroplasts", how: {
        "y7-8": "Unlike the cells around them, guard cells contain chloroplasts.",
        "y9-10": "Guard cells have chloroplasts, unlike most other epidermal cells.",
        y11: "Guard-cell chloroplasts are smaller and fewer than those in mesophyll cells. The stoma lets CO₂ in and water vapour out, so the plant trades photosynthesis against water loss." } },
    ],
    limit: "Guard cells in grasses are dumbbell-shaped, not bean-shaped.",
    chain: ["guard cell", "leaf epidermis", "leaf", "shoot system", "flowering plant"],
    chainExtra: true,
  },
  xylem: {
    name: "Xylem vessel element", color: "#d6b98c", band: "y9-10",
    size: { "y9-10": "about 20–200 µm wide and a few hundred µm long; elements join end to end" },
    job: "Carries water up the plant",
    jobCard: { "y9-10": "Carries water up the plant and helps support it" },
    rows: [
      { part: "Dead at maturity, hollow", how: {
        "y9-10": "At maturity the living contents are gone, leaving an empty tube that water can flow through with little resistance.",
        y11: "A vessel element dies and its contents are broken down at maturity, so water meets no cytoplasm. Water moves up by the cohesion–tension mechanism: transpiration pulls a continuous column of water held together by cohesion." } },
      { part: "Lignified walls", how: {
        "y9-10": "The walls are strengthened with lignin, which makes them strong and waterproof, so the tubes do not collapse under the pull of the water and also help to support the plant.",
        y11: "Lignin is laid down in rings or spirals (annular and spiral thickening) or in pitted walls. It resists the negative pressure in the water column and stops the vessel from collapsing." } },
      { part: "End walls lost (perforation plates)", how: {
        "y9-10": "The end walls break down, so the elements join into one long continuous tube.",
        y11: "Perforation plates between vessel elements give a continuous pipe. Water can also leave sideways through pits, and bypass an air bubble (embolism) that blocks one vessel." } },
    ],
    limit: "A vessel is made from connected vessel elements. Xylem also contains other cell types.",
    chain: ["xylem vessel element", "xylem tissue", "stem", "shoot system", "flowering plant"],
  },
};

/** Step captions for the hierarchy ladder (cell -> tissue -> organ -> system -> organism). */
export const LADDER = ["Cell", "Tissue", "Organ", "Organ system", "Organism"];
export const LADDER_TEXT = {
  muscle: [
    null,
    { "y7-8": "Skeletal muscle tissue: lots of muscle fibres lie side by side in bundles.", "y9-10": "<strong>Skeletal muscle tissue</strong>: fibres lie parallel in bundles (fascicles), held together by connective tissue." },
    { "y7-8": "The biceps is an organ: muscle tissue plus tendons, nerves and blood vessels.", "y9-10": "The <strong>biceps brachii</strong> is an organ: skeletal muscle tissue, connective tissue (tendons), nerve tissue and blood vessels working together." },
    { "y7-8": "The muscles work with the skeleton as a system to move the body.", "y9-10": "The <strong>muscular system</strong> (working with the skeleton as the musculoskeletal system) moves the body." },
    { "y7-8": "All the systems together make a whole human.", "y9-10": "The organism: a human, with all its systems working together." },
  ],
  neuron: [
    null,
    { "y7-8": "Nervous tissue: many nerve cells and supporting cells packed together.", "y9-10": "<strong>Nervous tissue</strong> (grey matter): motor neuron cell bodies and dendrites with supporting glial cells." },
    { "y7-8": "The spinal cord is an organ. Our motor neuron starts here and sends its long axon out to a muscle.", "y9-10": "The <strong>spinal cord</strong> is an organ: nervous tissue (grey matter with motor neuron cell bodies, white matter with axons) plus blood vessels and protective coverings. A lower motor neuron has its cell body here." },
    { "y7-8": "The brain, spinal cord and nerves form the nervous system.", "y9-10": "The <strong>nervous system</strong>: brain, spinal cord and nerves." },
    { "y7-8": "The whole human.", "y9-10": "The organism: a human." },
  ],
  roothair: [
    null,
    { "y7-8": "Root skin tissue: many root hair cells side by side.", "y9-10": "<strong>Root epidermal tissue</strong>: the outer layer of the root, where many cells grow hairs." },
    { "y7-8": "The root is an organ that holds the plant in the soil and takes in water.", "y9-10": "The <strong>root</strong> is an organ: epidermis, cortex and the vascular tissues that carry water on." },
    { "y7-8": "All the roots together form the root system.", "y9-10": "The <strong>root system</strong>: all the roots of the plant." },
    { "y7-8": "The whole flowering plant.", "y9-10": "The organism: a flowering plant." },
  ],
  palisade: [
    null,
    { "y7-8": "Palisade tissue: a row of tall cells under the top of the leaf.", "y9-10": "<strong>Palisade (mesophyll) tissue</strong>: a layer of tall, tightly packed cells." },
    { "y7-8": "A leaf is an organ: it catches light and makes food.", "y9-10": "The <strong>leaf</strong> is an organ: epidermis, palisade and spongy mesophyll, and veins (xylem and phloem)." },
    { "y7-8": "Stem, leaves and buds form the shoot system.", "y9-10": "The <strong>shoot system</strong>: stems, leaves, buds and flowers." },
    { "y7-8": "The whole flowering plant.", "y9-10": "The organism: a flowering plant." },
  ],
  xylem: [
    null,
    { "y9-10": "<strong>Xylem tissue</strong>: vessels together with fibres and other cells." },
    { "y9-10": "The <strong>stem</strong> is an organ: it holds the leaves up and carries water and sugars." },
    { "y9-10": "The <strong>shoot system</strong>: stems, leaves, buds and flowers." },
    { "y9-10": "The organism: a flowering plant." },
  ],
  cilia: [
    null,
    { "y7-8": "Airway lining: ciliated cells and mucus-making cells side by side.", "y9-10": "<strong>Ciliated epithelium</strong> (with goblet cells): the lining of the airway." },
    { "y7-8": "The windpipe (trachea) is an organ.", "y9-10": "The <strong>trachea</strong> is an organ: lined by ciliated epithelium, with cartilage rings and muscle." },
    { "y7-8": "Airways and lungs form the breathing system.", "y9-10": "The <strong>respiratory system</strong>: airways and lungs." },
    { "y7-8": "The whole human.", "y9-10": "The organism: a human." },
  ],
  guard: [
    null,
    { "y7-8": "The leaf's skin (epidermis): flat cells with pores.", "y9-10": "<strong>Leaf epidermis</strong>: flat cells with stomata, each surrounded by two guard cells." },
    { "y7-8": "The leaf.", "y9-10": "The <strong>leaf</strong> is an organ." },
    { "y7-8": "The shoot system.", "y9-10": "The <strong>shoot system</strong>." },
    { "y7-8": "The whole flowering plant.", "y9-10": "The organism: a flowering plant." },
  ],
};

export const DIFFERENTIATION = {
  "y9-10": "The nucleated body cells of one organism (for example the muscle fibre, neuron and ciliated cell of a person) carry the <strong>same genome</strong>, copied from one fertilised egg. They look different because different genes are switched on in each. Exceptions: a mature red blood cell has lost its nucleus, a sperm carries only half the genome, and a xylem vessel is dead at maturity. The plant cells share the genome of their plant, not ours.",
  y11: "Within one organism, nucleated somatic cells share the same genome, but not every cell does: mature erythrocytes have no nucleus, gametes are haploid and recombined, and xylem vessel elements are dead at maturity. <strong>Cell differentiation</strong> is a heritable pattern of gene expression: transcription factors and epigenetic marks (such as DNA methylation and histone modification) switch genes on or off, and the pattern is passed on when the cell divides. <strong>Stem cells</strong> keep the ability to divide and to differentiate; a differentiated cell expresses only part of its genome. The human and plant cells here belong to different organisms with different genomes. Links: the Nucleus and Chromatin levels, and the hepatocyte (liver cell) in the Animal cell level, itself specialised for metabolism and detoxification, with abundant mitochondria and smooth ER.",
};

export const NOTE = {
  "y7-8": "This is a model. Cell sizes are to scale on the shelf (use the scale bar), but long cells are drawn shortened, and the animations are slowed down so you can see them. Real cells vary from one to the next.",
  "y9-10": "Honest simplifications: sizes are to scale on the shelf, but a neuron's axon (up to ~1 m), a muscle fibre (up to many cm) and a root hair (up to 1 mm or more) are drawn truncated and marked with a break. Animations are slowed down (the clock shows real time), and the numbers are teaching-scale. Real cells vary: each is one example.",
  y11: "Honest simplifications: sizes are to scale on the shelf, except the truncated axon, fibre and root hair. Models: RBC loading time ∝ V/A (membrane-limited, not the full diffusion-and-binding picture; capillary transit is about 0.75 s, so a healthy cell is loaded well before it leaves the lungs); impulse speed v ≈ 1.1√d m/s (unmyelinated; d = axon diameter in µm) or 6D m/s (myelinated; D = whole fibre width including myelin = d / 0.65); muscle fatigue as an ATP supply–use balance (real fatigue also involves Pi, H⁺, K⁺ and Ca²⁺ handling); guard-cell K⁺ and turgor responses are sped up from minutes to seconds. Only the mature mammalian red cell has no nucleus or mitochondria.",
};

// =====================================================================================================================
// Narrative: generated from the models' numbers
// =====================================================================================================================
const P = (v) => `<p>${v}</p>`;
export function narrative(id, S, band) {
  const y7 = band === "y7-8", adv = band === "y11" || band === "y12";
  const out = [];
  if (id === "rbc") {
    const r = rbcState(S.shape, S.tube);
    out.push(y7
      ? `The cell is ${r.s > 0.85 ? "a dimpled disc, like a real red blood cell" : r.s < 0.15 ? "a ball" : "partway between a ball and a disc"}. ${r.s > 0.85 ? "It has a lot of surface for its size, so oxygen gets in quickly" : "The rounder it is, the less surface it has for its size, so oxygen gets in more slowly"}: about <b>${f0(r.t95)} ms</b> to fill up.`
      : `Surface area <b>${f0(r.A)} µm²</b> for a volume of ${r.V} µm³: SA:V = <b>${f2(r.sav)} µm⁻¹</b>. Oxygen enters across the membrane, so loading time scales with V/A: about <b>${f0(r.t95)} ms</b> to reach 95 % saturation${r.s < 0.2 ? ` (${f0(100 * (r.t95 / RBC.T95_BI - 1))} % slower than the real shape)` : ""}.${adv ? ` The greatest distance from the cytoplasm to the membrane is ${f2(r.d)} µm.` : ""}`);
    out.push(r.canPass
      ? (y7 ? `The ${r.tubeDiam.toFixed(1)} µm capillary is narrower than the cell, but this shape can fold to fit through.` : `A tube ${r.tubeDiam.toFixed(1)} µm wide needs the cell to fold into a capsule of area ${f0(areaInTube(r.tubeDiam / 2))} µm². This shape has ${f0(r.A)} µm², so it <b>fits</b> (narrowest it can enter: ${f1(r.minDiam)} µm).`)
      : (y7 ? `This shape is too round and stiff to squeeze into the ${r.tubeDiam.toFixed(1)} µm capillary: it would get stuck and block the vessel.` : `A tube ${r.tubeDiam.toFixed(1)} µm wide needs ${f0(areaInTube(r.tubeDiam / 2))} µm² of membrane, but this shape has only ${f0(r.A)} µm². The membrane cannot stretch much, so the cell <b>jams</b> (narrowest it can enter: ${f1(r.minDiam)} µm).`));
    return out;
  }
  if (id === "neuron") {
    const n = neuronState(S.myelin, S.d);
    out.push(S.myelin
      ? (y7 ? `The impulse <b>jumps</b> from gap to gap along the insulated axon, so it moves at about <b>${f0(n.v)} m/s</b>.` : `Myelin insulates the axon, so the impulse is regenerated only at the nodes of Ranvier, about ${f0(n.internode)} µm apart, and the current jumps between them (<b>saltatory conduction</b>): <b>${f0(n.v)} m/s</b> for an axon ${f1(n.d)} µm wide.`)
      : (y7 ? `With no insulation the impulse has to travel along every bit of the axon, so it moves at only about <b>${f1(n.v)} m/s</b>.` : `Without myelin the action potential must be regenerated at every point along the membrane, so an axon ${f1(n.d)} µm wide conducts at only <b>${f1(n.v)} m/s</b> (about ${f0(n.vMyel / n.vUnmyel)}× slower than the same fibre with myelin).`));
    out.push(`For a motor axon about 1 m long (spinal cord to foot) that is <b>${n.tMetre < 0.1 ? f0(n.tMetre * 1000) + " ms" : n.tMetre.toFixed(2) + " s"}</b> in real time.${S.myelin && adv ? ` Only about 1 µm of every ${f0(n.internode)} µm of membrane is exposed, so far fewer ions cross it and the Na⁺/K⁺ pumps use far less ATP.` : ""}`);
    if (!y7 && !S.myelin) out.push("A thicker fibre conducts faster (about the square root of the diameter), but a nerve of thick unmyelinated axons would be huge. Myelin is the efficient way to be fast.");
    return out;
  }
  if (id === "muscle") {
    const m = S.model, drive = f0(100 * m.act), fr = m.act > 0.05 ? m.force / m.act : 1;
    out.push(m.act < 0.05
      ? (y7 ? `The muscle fibre is relaxed. Each repeating unit (sarcomere) is long: ${f1(m.SL)} µm.` : `Relaxed: sarcomere length <b>${f1(m.SL)} µm</b>, so the thin and thick filaments overlap only a little.`)
      : (y7 ? `The fibre is contracting: each stripe unit shortens, so the whole cell is about <b>${f0(100 * m.shorten)} %</b> shorter.` : `Sarcomeres have shortened from 2.6 to <b>${f1(m.SL)} µm</b> (the fibre is ${f0(100 * m.shorten)} % shorter) as myosin heads pull the thin actin filaments inwards. The filaments keep their length; they slide, so the I band and H zone shrink but the A band does not.`));
    if (m.act < 0.05) {
      out.push(m.atp < 0.97 ? (y7 ? `The mitochondria are refilling the energy (ATP): ${f0(100 * m.atp)} % so far.` : `ATP is recovering (<b>${f0(100 * m.atp)} %</b> of the resting level) as the mitochondria (${f1(m.mito)}×) resupply it.`) : (y7 ? "The energy store (ATP) is full." : "ATP is back at its resting level."));
    } else {
      const falling = (m.trend ?? 0) < -0.02, rising = (m.trend ?? 0) > 0.02;
      const energy = m.atp < 0.35 ? (y7 ? "The muscle is running low on energy (ATP), so it pulls much less hard than the signal asks for: it is getting tired. Rest to let the mitochondria refill it." : `ATP is low (<b>${f0(100 * m.atp)} %</b>): force is only ${f0(100 * fr)} % of what full ATP would give at this drive (${drive} %). In this demo that is <b>fatigue</b>; with ${f1(m.mito)}× mitochondria, aerobic supply is too slow to keep up.`)
        : falling ? (y7 ? `The energy (ATP) is being used faster than it is made (${f0(100 * m.atp)} %), so the pull will weaken if this goes on.` : `ATP is falling (<b>${f0(100 * m.atp)} %</b>): use exceeds supply from the mitochondria (${f1(m.mito)}×). Force is ${f0(100 * m.force)} % at a drive of ${drive} %.`)
        : (y7 ? `The mitochondria are keeping up: energy (ATP) is ${f0(100 * m.atp)} %, so the muscle pulls ${fr > 0.9 ? "at full strength" : "fairly strongly"}.` : `ATP is ${rising ? "recovering" : "steady"} at <b>${f0(100 * m.atp)} %</b>: supply (${f1(m.mito)}×) roughly matches use, so force is ${f0(100 * m.force)} % at a drive of ${drive} %.`);
      out.push(energy);
    }
    out.push(y7 ? "(In this demo, tiredness is shown as the energy running low. Real muscle tiredness has several causes.)" : "<span class=\"hint\">Simplification: real fatigue is multifactorial (phosphate, ADP, pH, K⁺ shifts, excitation–contraction coupling); this demo models only ATP supply versus use.</span>");
    return out;
  }
  if (id === "sperm") {
    const m = S.model, off = m.mito < 0.05, steady = SpermModel.steady(m.mito);
    out.push(off
      ? (y7 ? `The mitochondria are switched off, so the main energy supply is gone. The tail beats more weakly (${f0(m.speed)} µm per second).` : `Mitochondrial ATP is off. ATP is at <b>${f0(100 * m.atp)} %</b> and the beat is ${f1(m.hz)} Hz, so the cell swims at <b>${f0(m.speed)} µm/s</b>. ${m.speed > steady + 3 ? "Supply is still declining toward the level that glycolysis along the tail alone can support." : `Only glycolysis along the tail keeps this weak beat going (about ${f0(steady)} µm/s).`}`)
      : (y7 ? `The mitochondria in the middle supply energy for the tail. The tail beats and the sperm swims at about <b>${f0(m.speed)} µm per second</b>.` : `Midpiece mitochondria (and some glycolysis) keep ATP at <b>${f0(100 * m.atp)} %</b> of full, so the flagellum beats at ${f1(m.hz)} Hz (real; shown slowed) and the cell swims at <b>${f0(m.speed)} µm/s</b>, about ${f1(m.speed / 55)} body lengths per second.`));
    out.push(m.mito < 0.5 ? "With fewer mitochondria less ATP is made, so the beat is weaker and slower, though glycolysis along the tail still gives a little." : "More mitochondria mean a faster ATP supply, and the sperm swims faster. The speed levels off because the motors can only beat so fast.");
    return out;
  }
  if (id === "cilia") {
    const c = ciliaState(S.activity, S.smoke);
    out.push(c.eff < 0.05 ? (y7 ? "The cilia are not moving, so the mucus (and the dust and germs stuck in it) just sits there." : "The cilia are still, so the mucus stops moving and trapped particles stay in the airway.")
      : (y7 ? `The cilia beat together in a wave and push the mucus along. Dust and germs stuck in it get carried out of the airway.` : `Cilia beating at about ${f1(c.beatHz)} Hz (shown slowed) move the mucus at <b>${f1(c.mmPerMin)} mm/min</b>, carrying trapped particles towards the throat to be swallowed or coughed up.`));
    if (S.smoke) out.push(y7 ? "<b>Smoking</b> paralyses cilia, so the mucus and the dirt stay in the lungs. That is part of why smokers cough." : "<b>Cigarette smoke</b> slows or paralyses cilia (and, with long exposure, destroys them), and the goblet cells make extra mucus, so particles pile up. The cough is the back-up clearance.");
    out.push(`Cleared so far: <b>${S.cleared}</b> particles${S.waiting ? ` · still stuck: ${S.waiting}` : ""}.`);
    return out;
  }
  if (id === "roothair") {
    const r = rootState(S.L, S.psi, S.o2);
    out.push(y7 ? (S.L < 20 ? "With no hair the cell has only a small surface touching the soil, so it takes in little." : `The hair adds a lot of surface, so this cell takes in about <b>${f1(r.ratio)}×</b> as much as a cell with no hair.`)
      : `Membrane area <b>${f0(r.A)} µm²</b> (cell body ${f0(ROOT.A_BODY)} + hair ${f0(r.A_hair)}) is <b>${f1(r.ratio)}×</b> a hairless cell for a tiny extra volume.`);
    out.push(r.losing
      ? (y7 ? "The soil is so dry that water is pulled <b>out</b> of the cell. The plant would wilt." : `The soil water potential (${S.psi.toFixed(2)} MPa) is lower than the cell's (${ROOT.PSI_CELL} MPa), so water leaves the cell by osmosis: <b>negative uptake</b>, and the plant wilts.`)
      : (y7 ? "Water moves into the cell from the wetter soil to the saltier cell sap. That is <b>osmosis</b>." : `Water enters by <b>osmosis</b> down a water-potential difference of ${f2(r.dPsi)} MPa: relative uptake <b>${f1(r.water)}</b> (a hairless cell in wet soil = 1).`));
    out.push(S.o2
      ? (y7 ? "Minerals are in short supply in the soil, so the cell uses energy from its mitochondria to pull them in (<b>active transport</b>)." : `Nitrate is scarce in the soil solution (about ${ROOT.CSOIL} mM here) and the inside of the cell is electrically negative, so it is brought in with H⁺ by a cotransporter driven by ATP-powered proton pumps (<b>active transport</b>): relative uptake <b>${f1(r.ion)}</b>.`)
      : (y7 ? "In waterlogged soil there is little oxygen, so the cell cannot make enough energy and mineral uptake almost stops." : `Waterlogged soil has little O₂, so aerobic ATP supply falls to about 10 % and active uptake collapses (relative <b>${f2(r.ion)}</b>). Osmosis of water carries on, because it needs no ATP.`));
    return out;
  }
  if (id === "palisade") {
    const p = palisadeState(S.light, S.co2, S.avoid), gl = p.gainLight, gc = p.gainCo2;
    const lim = p.limiting;
    out.push(y7
      ? `Photosynthesis is running at <b>${f0(p.rate)} %</b> of its maximum. ${lim === "light" ? "More light would help most." : lim === "co2" ? "More carbon dioxide would help more than more light." : "More of either would help a little: it is close to its limit."}`
      : `Rate: <b>${f0(p.rate)} %</b> of maximum. Raising light by 10 % of full would change it by <b>${gl >= 0 ? "+" : ""}${f1(gl)} %</b>; raising CO₂ by 10 % of full would give <b>${gc >= 0 ? "+" : ""}${f1(gc)} %</b>. So the limiting factor is ${lim === "light" ? "<b>light</b>" : lim === "co2" ? "<b>CO₂</b>" : "<b>both light and CO₂ about equally</b>"}.`);
    if (S.avoid && p.avoid > 0.15) out.push(adv ? `In bright light about ${f0(100 * p.avoid)} % of the chloroplasts have moved to the side walls (<b>chloroplast avoidance</b>), which reduces light absorbed to ${f0(100 * p.absorbed / Math.max(p.light, 0.01))} % of the incident light and protects the photosystems.` : "In very bright light the chloroplasts slide to the sides of the cell, away from the light, so they do not get damaged.");
    out.push(`Oxygen made and glucose made rise and fall with the rate (here ${f0(p.o2)} % of max).`);
    return out;
  }
  if (id === "guard") {
    const g = S.model;
    out.push(g.open > 0.7 ? (y7 ? "The guard cells are full of water, so they have bent apart and the pore is <b>open</b>." : `Turgor is <b>${f2(g.P)} MPa</b>: the guard cells are turgid, bow outwards (the thicker inner walls stretch less) and the pore is <b>${f1(g.pore)} µm</b> wide.`)
      : g.open < 0.2 ? (y7 ? "The guard cells are floppy, so they lie together and the pore is <b>closed</b>." : `Turgor has fallen to <b>${f2(g.P)} MPa</b>: the guard cells are flaccid and the pore is almost <b>closed</b> (${f1(g.pore)} µm).`)
        : (y7 ? "The pore is partly open." : `Turgor ${f2(g.P)} MPa: the pore is partly open (${f1(g.pore)} µm).`));
    out.push(g.aba > 0.3 ? (y7 ? "The leaf is short of water, so the guard cells lose water and close the pore to save it." : `The leaf is drying (water potential −${f2(g.psiLeaf)} MPa), so abscisic acid rises, K⁺ leaves the guard cells and water follows: the stoma closes to cut water loss${adv ? " (even in the light)" : ""}.`)
      : (g.light > 0.5 ? (y7 ? "Light makes the guard cells take in salts, so water follows them in and they swell." : adv ? `Light drives H⁺ pumping, K⁺ (and Cl⁻, malate) enters the guard cells (K⁺ level ${f2(g.K)}), water follows by osmosis, and turgor rises.` : "Light makes the guard cells take in salts (K⁺ ions); water follows by osmosis and the cells swell.")
        : (y7 ? "In the dark the guard cells lose their salts and water, so the pore closes." : "With little light, K⁺ drifts out of the guard cells, water follows, and the pore closes.")));
    out.push(`Gas exchange now: CO₂ in <b>${f0(100 * g.co2In)} %</b> of full · water vapour out <b>${f0(100 * g.waterLoss)} %</b>. An open stoma lets CO₂ in for photosynthesis but also lets water out.`);
    return out;
  }
  if (id === "xylem") {
    const x = xylemState(S.d, S.tension, S.bubble);
    out.push(S.bubble ? "An air bubble has formed, so this vessel is blocked: the water column is broken and the flow stops. Water has to go sideways through pits into a neighbouring vessel." : `Transpiration pulls the water up. Flow in this vessel is <b>${f1(x.flow)}×</b> that of a 20 µm vessel at full pull.`);
    out.push(`A vessel ${S.d} µm wide carries about <b>${f0(x.rel)}×</b> the water of a 20 µm one (flow depends on the fourth power of the radius).${x.risk > 0.4 ? " Wide vessels carry the most but are the most likely to get air bubbles in a drought." : ""}`);
    return out;
  }
  return out;
}

// =====================================================================================================================
// Match the job
// =====================================================================================================================
export const MATCH = ORDER.map((id) => ({ id, minBand: id === "cilia" || id === "xylem" ? "y9-10" : "y7-8" }));

// =====================================================================================================================
// Missions and quiz
// =====================================================================================================================
export const MISSIONS = [
  { id: "rbc", band: "y7-8", text: "<strong>Red blood cell:</strong> turn the cell into a ball and read the oxygen time, then bring it back to the real disc shape. Which loads faster?", check: (s) => s.rbcBest },
  { id: "squeeze", band: "y9-10", text: "<strong>Capillary:</strong> make a red blood cell that fits a <b>3.5 µm</b> capillary, then send it through.", check: (s) => s.squeezed35 },
  { id: "nerve", band: "y7-8", maxBand: "y7-8", text: "<strong>Nerve:</strong> send an impulse with the myelin switched off, then with it on. Which is faster?", check: (s) => s.nerveUnSent && s.nerveMyelSent },
  { id: "nerve2", band: "y9-10", text: "<strong>Nerve:</strong> make an impulse that travels at <b>60 m/s or faster</b> (hint: thick, with myelin).", check: (s) => s.nerveFast },
  { id: "muscle", band: "y7-8", maxBand: "y7-8", text: "<strong>Muscle:</strong> contract the fibre 5 times.", check: (s) => s.muscleCycles >= 5 },
  { id: "muscle2", band: "y9-10", text: "<strong>Muscle:</strong> hold a contraction until the fibre <b>fatigues</b>, then rest until ATP recovers.", check: (s) => s.muscleRecovered },
  { id: "sperm", band: "y7-8", maxBand: "y9-10", text: "<strong>Sperm:</strong> give it enough mitochondria to swim at <b>80 µm/s or more</b>.", check: (s) => s.spermFast },
  { id: "sperm2", band: "y11", text: "<strong>Sperm:</strong> compare <b>0 %</b>, <b>20 %</b> and <b>100 %</b> mitochondria, giving each setting time to settle (the speed must level off for about 4 s), and note the speed at each.", check: (s) => s.sperm0 && s.sperm20 && s.sperm100 },
  { id: "stoma", band: "y7-8", text: "<strong>Stoma:</strong> open it at least <b>80 %</b>.", check: (s) => s.stomaOpen },
  { id: "drought", band: "y9-10", text: "<strong>Drought:</strong> close the stoma again by drying the leaf, not by switching off the light.", check: (s) => s.stomaDrought },
  { id: "match", band: "y7-8", text: "<strong>Match the job:</strong> drag each job card onto the right cell.", check: (s) => s.matched() },
  { id: "photo", band: "y9-10", text: "<strong>Palisade:</strong> find a light level that gives <b>90 %</b> or more of the maximum rate without full sunlight.", check: (s) => s.photo90 },
  { id: "cilia", band: "y7-8", maxBand: "y7-8", text: "<strong>Airway:</strong> turn the cilia right down and watch the mucus slow, then turn them back up again.", check: (s) => s.ciliaLow && s.ciliaBack },
  { id: "root", band: "y9-10", text: "<strong>Root hair:</strong> reach <b>2.5×</b> the uptake of a hairless cell for both water and minerals (long hair, wet soil, plenty of oxygen).", check: (s) => s.root3 },
];
// A student sees at most six: keep them banded so each year level gets a coherent set.
export const MISSION_SETS = {
  "y7-8": ["rbc", "nerve", "muscle", "stoma", "match", "cilia"],
  "y9-10": ["rbc", "squeeze", "nerve2", "muscle2", "drought", "match"],
  y11: ["squeeze", "nerve2", "muscle2", "sperm2", "photo", "root"],
  y12: ["squeeze", "nerve2", "muscle2", "sperm2", "photo", "drought"],
};

export const QUIZ = [
  { band: "y7-8", maxBand: "y9-10", q: "Which feature of a red blood cell helps it carry oxygen?", options: ["It has a large nucleus", "It is a thin disc packed with haemoglobin", "It has many chloroplasts", "It is very long"], answer: 1, why: "A mature red blood cell has no nucleus, so there is room for haemoglobin, and its flat shape gives a large surface for its size." },
  { band: "y7-8", q: "Which cell has a long extension to take in water from the soil?", options: ["Root hair cell", "Palisade cell", "Neuron", "Sperm cell"], answer: 0, why: "The hair gives the root hair cell a very large surface area in contact with the soil water." },
  { band: "y7-8", q: "Why is a muscle cell full of mitochondria?", options: ["To make it striped", "To supply the energy it needs to contract", "To store water", "To catch light"], answer: 1, why: "Mitochondria release the energy (ATP) that the muscle uses to contract." },
  { band: "y7-8", maxBand: "y9-10", q: "Which cell part lets a nerve impulse travel fast along a long axon?", options: ["The nucleus", "The myelin sheath", "The cell wall", "The vacuole"], answer: 1, why: "Myelin insulates the axon, and the impulse jumps between the gaps in it." },
  { band: "y7-8", q: "In what order do these get bigger? cell, organ, tissue", options: ["cell, tissue, organ", "tissue, cell, organ", "organ, tissue, cell", "cell, organ, tissue"], answer: 0, why: "Cells make tissues, tissues make organs, organs make organ systems, and systems make an organism." },
  { band: "y7-8", q: "What makes a guard cell open the pore in a leaf?", options: ["It fills with water and swells", "It loses all its water", "It makes more chloroplasts", "It divides"], answer: 0, why: "When guard cells take in water they swell and bend apart, which opens the pore." },
  { band: "y9-10", q: "A tall column-shaped palisade cell has many chloroplasts. Why are they near the top of the leaf?", options: ["That is where the light arrives", "Chloroplasts need soil", "So the cells can take in minerals", "To stop water loss"], answer: 0, why: "Palisade cells sit just under the upper surface, so they receive light first and make most of the leaf's food." },
  { band: "y9-10", maxBand: "y9-10", q: "A sphere and a flat disc have the same volume. Which loads oxygen faster, and why?", options: ["The sphere: a smaller surface", "The disc: a larger surface area to volume ratio", "They are the same", "The sphere: it has more haemoglobin"], answer: 1, why: "A flatter shape has more surface area per unit volume, so oxygen enters and leaves faster." },
  { band: "y9-10", q: "Root hair cells take up mineral ions from the soil using what process?", options: ["Osmosis", "Active transport", "Photosynthesis", "Evaporation"], answer: 1, why: "Minerals are usually at a lower concentration in the soil than in the cell, so the cell moves them in against the gradient using ATP (active transport). Water enters by osmosis." },
  { band: "y9-10", maxBand: "y9-10", q: "Smoking damages cilia in the airways. What is the effect?", options: ["More oxygen is made", "Mucus and trapped particles are not cleared", "Air cannot enter the lungs at all", "The cells make more chloroplasts"], answer: 1, why: "Cilia normally sweep mucus and the dust and microbes it traps out of the airway. If they are paralysed the particles stay in the lungs." },
  { band: "y9-10", q: "A sperm cell has a midpiece full of mitochondria. What do they supply?", options: ["Genetic information", "ATP for the tail to beat", "Enzymes for the acrosome", "Mucus"], answer: 1, why: "The mitochondria supply the ATP the flagellum uses to beat and push the sperm along." },
  { band: "y9-10", q: "Why does a thick myelinated axon conduct impulses faster than a thin unmyelinated one?", options: ["It has more nuclei", "The impulse jumps between nodes instead of travelling along the whole membrane", "It contains more water", "It has no ions"], answer: 1, why: "Myelin insulates the axon so the action potential is regenerated only at the nodes of Ranvier (saltatory conduction). A wider axon also has less resistance." },
  { band: "y9-10", q: "Water stress makes the stomata close. How does that help the plant?", options: ["It lets more CO₂ in", "It reduces water loss by transpiration", "It increases photosynthesis", "It cools the roots"], answer: 1, why: "Closed stomata cut transpiration, saving water, but they also cut CO₂ entry, so photosynthesis slows." },
  { band: "y11", q: "Which statement about a mature mammalian red blood cell is correct?", options: ["It makes ATP by aerobic respiration in mitochondria", "It has no nucleus or mitochondria and gets ATP from glycolysis", "It has a nucleus but no mitochondria", "It makes new haemoglobin continuously"], answer: 1, why: "A mature mammalian erythrocyte has no nucleus and no mitochondria. It makes ATP by glycolysis in the cytosol, so it does not consume the oxygen it carries." },
  { band: "y11", q: "In the sliding filament model, what happens to the filaments as a sarcomere shortens?", options: ["Both filament types shorten", "The thin filaments are pulled past the thick filaments; the filaments keep their length", "The thick filaments are digested", "The Z lines move apart"], answer: 1, why: "Myosin heads bind actin and pull the thin filaments towards the centre; the sarcomere shortens while the filaments stay the same length." },
  { band: "y11", q: "Why do the nodes of Ranvier speed up conduction?", options: ["Voltage-gated Na⁺ channels are concentrated there and the current jumps between them (saltatory conduction)", "They store neurotransmitter", "They pump K⁺ out faster", "They stop the impulse"], answer: 0, why: "Myelin insulates the internodes; the action potential is regenerated only at the nodes, so it jumps from node to node." },
  { band: "y11", q: "Light triggers stomatal opening. Which sequence is correct?", options: ["K⁺ uptake, water enters by osmosis, turgor rises, the cells bow apart", "Water enters, then K⁺ is taken up, then turgor falls", "K⁺ leaves, turgor rises, the pore opens", "The cell wall dissolves"], answer: 0, why: "Light drives H⁺-pumping and K⁺ uptake; the water potential falls, water enters by osmosis, turgor rises and the thicker inner walls make the cells curve apart." },
  { band: "y11", q: "Why does a root hair cell in waterlogged soil take up fewer minerals, even though it still takes up water?", options: ["Osmosis stops", "Little O₂ means little aerobic ATP, so active transport slows", "The vacuole disappears", "Minerals cannot dissolve"], answer: 1, why: "Active transport needs ATP; with little oxygen the supply falls. Osmosis needs no ATP, so water uptake continues while the water potential gradient allows." },
  { band: "y11", q: "A muscle fibre and a motor neuron in the same person are both nucleated body cells with the same genome. What mainly explains their different structures?", options: ["They have lost different genes", "Different genes are expressed in each (differential gene expression)", "They use different DNA bases", "Their chromosomes differ in number"], answer: 1, why: "Differentiation is a heritable pattern of gene expression set by transcription factors and epigenetic marks. (Exceptions to 'same genome': mature red blood cells have no nucleus, and sperm are haploid.)" },
  { band: "y11", q: "A palisade cell is moved from medium to very bright light. What can happen to its chloroplasts?", options: ["They move to the side walls, reducing light absorbed (avoidance)", "They all disappear", "They fuse into one", "They move to the nucleus"], answer: 0, why: "In strong light, chloroplasts move to the walls parallel to the light, which reduces absorption and protects the photosystems." },
];
