// Lens-aware text for the plant-cell level. Each value may be a plain string or
// { "y7-8": ..., "y9-10": ..., "y11": ..., "y12": ... } (lens.pick chooses the right one).

import { LEAVES } from "./plantCellModel.js";

export const ORGANELLES = {
  chloroplast: {
    name: "Chloroplast", color: "#4ade80", portal: "chloroplast", sim: "photosynthesis",
    role: {
      "y7-8": "Uses <strong>light energy</strong> to make <strong>glucose</strong> (a sugar) and <strong>oxygen</strong>. This is <strong>photosynthesis</strong>.",
      "y9-10": "Site of <strong>photosynthesis</strong>: carbon dioxide + water → glucose + oxygen, powered by light absorbed by <strong>chlorophyll</strong>. Spare glucose is stored as <strong>starch</strong>.",
      y11: "Light-dependent reactions on the <strong>thylakoid membranes</strong> split water (releasing O₂) and make ATP + NADPH; the <strong>Calvin cycle</strong> in the stroma uses them to fix CO₂ into sugar. Excess sugar is stored as starch grains.",
    },
    inputs: { "y7-8": "light, carbon dioxide, water", y11: "light, CO₂, H₂O (+ ADP, NADP⁺ recycled)" },
    outputs: { "y7-8": "glucose, oxygen", "y9-10": "glucose (→ starch store), oxygen", y11: "O₂; sugar exported as triose phosphate (→ sucrose); starch stored by day and broken down at night (exported mainly as maltose)" },
    feeds: "mitochondria (glucose + O₂)",
  },
  mitochondrion: {
    name: "Mitochondrion", color: "#fb923c", portal: "mitochondrion", sim: "atp-synthase",
    role: {
      "y7-8": "The cell's power station: uses <strong>glucose</strong> and <strong>oxygen</strong> to release <strong>energy</strong> the cell can use (stored in <strong>ATP</strong>).",
      "y9-10": "Site of <strong>aerobic respiration</strong>: glucose + oxygen → carbon dioxide + water + energy (ATP). Plant cells need mitochondria too — day and night.",
      y11: "Glycolysis happens in the cytosol; its pyruvate enters the mitochondrion, becomes acetyl-CoA and feeds the <strong>Krebs cycle</strong> in the matrix. The <strong>electron transport chain</strong> on the cristae builds an H⁺ gradient that ATP synthase uses. Complete oxidation of one glucose yields roughly 30 ATP in total. Rate is demand-led: when ATP is high (little ADP), respiration slows.",
    },
    inputs: { "y7-8": "glucose, oxygen", y11: "pyruvate (from glucose), O₂, ADP + Pᵢ" },
    outputs: { "y7-8": "energy (ATP), carbon dioxide, water", y11: "ATP, CO₂, H₂O" },
    feeds: "everything that needs energy: nucleus, ribosomes, Golgi, membrane pumps",
  },
  nucleus: {
    name: "Nucleus", color: "#a78bfa", portal: "nucleus", sim: "protein-synthesis",
    role: {
      "y7-8": "The <strong>control centre</strong>. It holds the <strong>DNA</strong> — the instructions for making everything the cell needs.",
      "y9-10": "Holds DNA in chromosomes. Genes are copied into <strong>mRNA</strong>, which leaves through <strong>nuclear pores</strong> to tell ribosomes which protein to make.",
      y11: "<strong>Transcription</strong>: RNA polymerase copies genes into mRNA (processed before export). mRNA exits through nuclear pore complexes to ribosomes on the rough ER. Needs ATP/NTPs.",
    },
    inputs: { "y7-8": "energy (ATP)", y11: "ATP/NTPs, nucleotides" },
    outputs: { "y7-8": "instructions (mRNA) for making proteins", y11: "mRNA" },
    feeds: "ribosomes on the rough ER (mRNA)",
  },
  er: {
    name: { "y7-8": "Rough ER + ribosomes", y11: "Rough endoplasmic reticulum" }, color: "#5eead4", portal: "ribosome", sim: "protein-synthesis",
    role: {
      "y7-8": "A network of tubes covered in <strong>ribosomes</strong>, which build <strong>proteins</strong> by following the nucleus's instructions.",
      "y9-10": "Ribosomes on the rough ER read mRNA and join amino acids into proteins that will be <strong>exported</strong> or sent to membranes. (Free ribosomes in the cytoplasm make the cell's other proteins.) The ER folds them and sends them to the Golgi in vesicles.",
      y11: "<strong>Translation</strong>: a signal sequence on the growing polypeptide directs its ribosome to the ER, where the protein enters the lumen (or inserts into the membrane) and folds; it then travels in vesicles to the Golgi. Proteins for the cytosol, nucleus, mitochondria and chloroplasts are made on free ribosomes instead. Each mRNA is read many times, often by several ribosomes at once (polysomes).",
    },
    inputs: { "y7-8": "mRNA instructions, energy", y11: "mRNA, amino acids, ATP/GTP" },
    outputs: "proteins (in vesicles)",
    feeds: "Golgi apparatus",
  },
  golgi: {
    name: { "y7-8": "Golgi apparatus", y11: "Golgi apparatus" }, color: "#f0abfc",
    role: {
      "y7-8": "The cell's <strong>post office</strong>: packs proteins into little bubbles (<strong>vesicles</strong>) and sends them where they're needed.",
      "y9-10": "Modifies, sorts and packages proteins into <strong>vesicles</strong>. Some vesicles fuse with the membrane to release their contents (and build the cell wall).",
      y11: "Modifies proteins (e.g. adds sugars), sorts them and packages them in vesicles. In plant cells it also makes the wall's <strong>matrix polysaccharides</strong> (pectins, hemicelluloses). Exocytosis needs ATP.",
    },
    inputs: "proteins from the ER, energy", outputs: "vesicles to the membrane (secreted proteins, wall materials)", feeds: "cell membrane and cell wall",
  },
  vacuole: {
    name: "Central vacuole", color: "#7dd3fc", sim: "osmosis",
    role: {
      "y7-8": "A big bag of water. When it's full it pushes out against the cell wall and keeps the plant <strong>firm</strong>.",
      "y9-10": "Stores water and dissolved substances. Water enters by <strong>osmosis</strong> when the cell sap is more concentrated than its surroundings; a full vacuole pushes on the cell wall (<strong>turgor</strong>). In a salty solution, or if the cell can't keep its solutes, water leaves and the plant wilts.",
      y11: "Bounded by the tonoplast. Solutes pumped in (using ATP, via both the plasma membrane and tonoplast) lower its water potential, so water enters through aquaporins until turgor pressure balances the solute difference — then net flow stops. A more negative external water potential reverses the flow (plasmolysis).",
    },
    inputs: "water, ions", outputs: "turgor (firmness)", feeds: "the whole cell's shape",
  },
  membrane: {
    name: "Cell membrane", color: "#c4b5fd", portal: "membrane", sim: "membrane-transport",
    role: {
      "y7-8": "A thin, flexible layer that <strong>controls what goes in and out</strong> of the cell.",
      "y9-10": "A <strong>partially permeable</strong> phospholipid bilayer. Small molecules diffuse through; proteins carry or pump others. Pumps use ATP.",
      y11: "Fluid-mosaic phospholipid bilayer: simple diffusion (O₂, CO₂), facilitated diffusion and osmosis (channels, aquaporins), active transport (ATP-powered pumps), and endo/exocytosis.",
    },
    inputs: "energy (ATP) for pumps", outputs: "controls entry/exit of water, ions, gases", feeds: "vacuole (water), everything (gases)",
  },
  wall: {
    name: "Cell wall", color: "#86efac",
    role: {
      "y7-8": "A tough outer layer made of <strong>cellulose</strong> that supports and protects the plant cell.",
      "y9-10": "Rigid cellulose wall. It stops the cell bursting when the vacuole is full. Tiny channels (plasmodesmata) connect neighbouring cells.",
      y11: "Cellulose microfibrils are spun at the plasma membrane by <strong>cellulose synthase</strong> complexes; the Golgi supplies the matrix (pectins, hemicelluloses) and wall proteins by exocytosis. Fully permeable; resists turgor pressure. Plasmodesmata link the cytoplasm of adjacent cells.",
    },
    inputs: { "y7-8": "building materials", y11: "cellulose (made at the membrane) + matrix from Golgi vesicles" }, outputs: "support, shape", feeds: "the whole plant's structure",
  },
  cytosol: {
    name: { "y7-8": "Cytoplasm", "y9-10": "Cytosol (cytoplasm)" }, color: "#fbbf24", portal: "enzymes", sim: "enzymes",
    role: {
      "y7-8": "The jelly-like fluid that fills the cell. Thousands of <strong>enzymes</strong> work here, speeding up the cell's chemical reactions.",
      "y9-10": "The fluid part of the cytoplasm, packed with <strong>enzymes</strong> — biological catalysts that speed up reactions without being used up. Glycolysis happens here.",
      y11: "Aqueous, crowded with proteins (~20–30% by mass). Site of glycolysis and many metabolic pathways, each step catalysed by a specific enzyme whose activity depends on temperature, pH, substrate concentration and inhibitors.",
    },
    inputs: "substrates (e.g. glucose)", outputs: "products of enzyme-catalysed reactions", feeds: "every organelle",
  },
  peroxisome: {
    name: "Peroxisome", color: "#facc15", band: "y11",
    role: "Breaks down harmful hydrogen peroxide with the enzyme catalase, and helps recycle by-products of photosynthesis (photorespiration).",
    inputs: "H₂O₂, glycolate", outputs: "H₂O + O₂", feeds: "chloroplasts and mitochondria (photorespiration)",
  },
};

/** Switchable parts (knockouts) shown in the panel, by lens. */
export const SWITCHES = [
  { key: "chloroplast", label: "Chloroplasts" },
  { key: "mitochondrion", label: "Mitochondria" },
  { key: "nucleus", label: "Nucleus" },
  { key: "pores", label: "Nuclear pores", band: "y9-10" },
  { key: "er", label: { "y7-8": "Ribosomes / rough ER", y11: "Ribosomes on rough ER" } },
  { key: "golgi", label: "Golgi apparatus" },
  { key: "pumps", label: { "y7-8": "Membrane pumps", y11: "Membrane ion pumps (ATP)" } },
  { key: "aquaporins", label: "Aquaporins (water channels)", band: "y9-10" },
];

export const FLOWS = {
  light: { label: "Light", color: "#fde68a", group: "energy" },
  glucose: { label: "Glucose", color: "#a3e635", group: "energy" },
  o2: { label: "Oxygen (O₂)", color: "#f87171", group: "gases" },
  co2: { label: "Carbon dioxide (CO₂)", color: "#cbd5e1", group: "gases" },
  atp: { label: { "y7-8": "Energy (ATP)", "y9-10": "ATP" }, color: "#fbbf24", group: "energy" },
  mrna: { label: "mRNA (instructions)", color: "#60a5fa", group: "protein", band: "y9-10" },
  protein: { label: { "y7-8": "Proteins in vesicles", "y9-10": "Protein vesicles" }, color: "#f472b6", group: "protein" },
  water: { label: "Water", color: "#38bdf8", group: "water" },
};

export const MISSIONS = [
  { band: "y7-8", maxBand: "y9-10", text: "Get the cell <strong>releasing oxygen</strong> into the leaf.", check: (m) => m.flux.o2Out > 1 },
  { band: "y7-8", text: "Make it <strong>night</strong> (light under 10%) for 15 s. Does the cell still have energy (ATP)? Where is its glucose coming from?", check: (m, s) => s.nightTime > 15 && m.atp > 30 },
  { band: "y7-8", text: "Switch off the <strong>mitochondria</strong> and watch the cell's energy (ATP) run out.", check: (m) => !m.on.mitochondrion && m.atp < 10 },
  { band: "y7-8", text: "Make the <strong>vacuole shrink</strong> so the cell goes floppy. (Hint: what keeps water in?)", check: (m) => m.turgor < 40 },
  { band: "y7-8", text: "Deliver <strong>10 loads</strong> of packaged proteins to the cell membrane.", check: (m, s) => m.secreted - s.sec0 >= 10 },
  { band: "y9-10", text: "Put the cell in a <strong>salty solution</strong> until it goes flaccid, then rescue it.", check: (m, s) => s.wasFlaccid && m.turgor > 75 && m.outside < 20 },
  { band: "y9-10", text: "Block the <strong>nuclear pores</strong>. Where does the mRNA pile up, and which organelles go quiet?", check: (m) => !m.on.pores && m.mrna > 70 },
  { band: "y9-10", text: "Find a <strong>limiting factor</strong>: with bright light, cut CO₂ so photosynthesis slows.", check: (m) => m.light > 60 && m.co2Out < 8 && m.flux.photo < 2.5 },
  // Sun and shade leaf missions: the checks read what a LeafLab (plantCellModel.js) recorded from the real fluxes.
  { band: "y7-8", maxBand: "y7-8", text: "<strong>Sun leaf or shade leaf?</strong> Pick each leaf in turn and slide the light until the cell takes in and gives out the <em>same</em> amount of oxygen (20 s or so, hold it still). That light is its <strong>compensation point</strong>. Which leaf needs less light to break even?", check: (m, s) => s.lab.comp.sun !== null && s.lab.comp.shade !== null },
  { band: "y9-10", text: "Find the <strong>light compensation point</strong> (net O₂ exchange = 0) for the sun leaf and for the shade leaf. Hold the light steady for 20 s or so at each try, with the day cycle off and CO₂ high.", check: (m, s) => s.lab.comp.sun !== null && s.lab.comp.shade !== null },
  { band: "y7-8", maxBand: "y7-8", text: "Turn on the <strong>24 h day</strong>. Can you choose a brightness so the cell finishes the whole day with <em>at least as much sugar</em> as it started with? (It respires all night, so the store drops in the dark.)", check: (m, s) => !!s.lab.last?.ok },
  { band: "y9-10", text: "Run the <strong>24 h day</strong> and choose a peak light so the sugar store ends the day <strong>no lower than it started</strong>, even though respiration continues all night. Leave all settings alone for the full 24 h.", check: (m, s) => !!s.lab.last?.ok },
  { band: "y7-8", maxBand: "y7-8", text: "<strong>Who wins?</strong> Hold dim light (10–20 %) and then full sun (90 % or more) for each leaf. Which leaf gives out more oxygen in dim light, and which in full sun?", check: (m, s) => s.lab.compared },
  { band: "y9-10", text: "Show that the <strong>shade leaf wins at low light</strong> (10–20 %) and the <strong>sun leaf wins in full sun</strong> (90 % or more): hold each light steady for 20 s or so on both leaf types.", check: (m, s) => s.lab.compared },
  { band: "y9-10", text: "On a bright, <strong>hot, dry</strong> day (light 60 % or more, plenty of CO₂ outside) turn up the heat until the <strong>stomata close</strong> and CO₂ inside the leaf limits photosynthesis.", check: (m) => m.on.chloroplast && ["co2", "stomata"].includes(limiter(m)) && m.stomata < 0.3 && m.light >= 60 && m.co2Out >= 30 && m.co2 < 8 && m.flux.photo < 2 },
  { band: "y11", text: "Show <strong>demand control</strong>: in bright light, ATP stays high and the mitochondria slow down.", check: (m) => m.atp > 80 && m.flux.resp < 1.5 && m.light > 60 },
  { band: "y11", text: "At night, run the <strong>starch store</strong> down below 40.", check: (m) => m.light < 10 && m.starch < 40 },
  { band: "y11", text: "Switch off the <strong>aquaporins</strong>, then the pumps: compare how fast turgor falls with and without water channels.", check: (m) => !m.on.aquaporins && !m.on.pumps && m.turgor < 60 },
  { band: "y11", text: "Switch off <strong>transcription</strong> but leave the pores open: show that mRNA already made still reaches the ribosomes for a while.", check: (m) => !m.on.nucleus && m.on.pores && m.mrnaCyto > 5 && m.mrna < 3 },
];

/** Sun-leaf / shade-leaf choice: text for the leaf card, by year band. */
export const LEAF_CHOICES = [
  { value: "generic", label: { "y7-8": "Ordinary leaf", "y9-10": "Typical leaf" },
    about: { "y7-8": "A general leaf cell: the starting settings.", "y9-10": "The model's starting leaf cell, between a sun leaf and a shade leaf." } },
  { value: "sun", label: "☀ Sun leaf",
    about: {
      "y7-8": "A leaf that grows in <strong>bright sun</strong>. It has a <strong>thick layer</strong> of tall cells packed with <strong>extra chloroplasts</strong> in each patch of leaf, so it makes lots of sugar in strong light. But it needs a lot of light just to break even, and it uses more energy to run.",
      "y9-10": "Grows in full sun. A thicker <strong>palisade layer</strong> holds <strong>more chloroplasts per area of leaf</strong>, with more enzyme in each, so it keeps making more sugar as light rises (a <strong>higher light-saturation point</strong>). Its upkeep is higher too: a <strong>higher respiration rate</strong> and a <strong>higher compensation point</strong>.",
      y11: "Sun leaf: a thicker palisade mesophyll with more chloroplasts per unit of leaf area and more Rubisco and electron-transport capacity per chloroplast. The ceiling for photosynthesis (and the light-saturation point) is high, but dark respiration is higher, so the <strong>light compensation point</strong> is higher too.",
      y12: "Sun leaf: thick palisade mesophyll, more chloroplasts per unit leaf area, high Rubisco and electron-transport capacity per unit leaf area. The light-response curve rises more slowly but to a higher plateau; dark respiration (R) is greater, so the light compensation point (net CO₂ or O₂ exchange = 0) sits at a higher light level.",
    } },
  { value: "shade", label: "🌿 Shade leaf",
    about: {
      "y7-8": "A leaf that grows in the <strong>shade</strong>. It is thinner, with <strong>bigger stacks of membranes (grana) holding lots of chlorophyll</strong> in each chloroplast, so it catches dim light well. It tops out early in strong light, but it uses less energy to run.",
      "y9-10": "Grows in shade. Fewer chloroplasts, but <strong>bigger grana</strong> and <strong>more chlorophyll per chloroplast</strong> catch dim light, so it saturates at <strong>low light</strong>. Its upkeep is cheaper, so its respiration is lower and its <strong>compensation point is lower</strong>.",
      y11: "Shade leaf: thinner, with fewer chloroplasts per unit leaf area but larger grana and more chlorophyll (and light-harvesting antenna) per chloroplast. It is efficient in dim light and saturates early; low Rubisco and respiration costs give a <strong>lower light compensation point</strong>.",
      y12: "Shade leaf: thin blade, fewer chloroplasts per unit leaf area but larger grana and more chlorophyll per chloroplast. A steeper initial slope on the light-response curve (more light captured per unit of light), an early plateau (lower Rubisco and electron-transport capacity), and low dark respiration, giving a low light compensation point.",
    } },
];

/** Plain-language time of day, e.g. "14:30 · afternoon". Light is zero from 18:00 to 06:00 in this model. */
export function clockText(hour) {
  const h = Math.floor(hour) % 24, m = Math.floor((hour - Math.floor(hour)) * 60);
  const part = hour < 6 || hour >= 18 ? "night" : hour < 11 ? "morning" : hour < 13 ? "midday" : "afternoon";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} · ${part}`;
}

export const LEAF_NOTE = "These compensation points and light levels are <strong>teaching-scale numbers</strong>, chosen to show the pattern. Real values depend on the species, temperature and CO₂, and are measured in the lab.";

export const QUIZ = [
  { band: "y7-8", maxBand: "y7-8", q: "Which organelle uses light to make glucose?", options: ["Mitochondrion", "Chloroplast", "Nucleus", "Vacuole"], answer: 1, why: "Chloroplasts contain chlorophyll, which captures light for photosynthesis." },
  { band: "y7-8", q: "Plant cells have chloroplasts. Why do they ALSO need mitochondria?", options: ["They don't — mitochondria are only in animals", "To turn glucose into usable energy (ATP), day and night", "To store water", "To make chlorophyll"], answer: 1, why: "Chloroplasts make glucose, but mitochondria release its energy as ATP. At night there's no photosynthesis, but respiration keeps going." },
  { band: "y7-8", q: "If the mitochondria stop working, what happens to the cell membrane pumps?", options: ["Nothing", "They stop, because they need energy (ATP)", "They speed up", "They turn into chloroplasts"], answer: 1, why: "Pumps use ATP. No ATP → no pumping → the cell can't hold onto dissolved substances, so it gradually loses water and goes floppy." },
  { band: "y7-8", q: "What keeps a plant cell firm?", options: ["The nucleus", "A full vacuole pushing against the cell wall", "Chloroplasts", "Mitochondria"], answer: 1, why: "Water in the vacuole pushes out against the strong cell wall (turgor)." },
  { band: "y9-10", q: "The nuclear pores are blocked. What happens FIRST?", options: ["Ribosomes run out of mRNA instructions", "Photosynthesis stops", "The cell wall dissolves", "Oxygen can't get in"], answer: 0, why: "mRNA must leave the nucleus to reach ribosomes. Without it, protein production stops; the Golgi then has nothing to ship." },
  { band: "y9-10", q: "At night, a leaf cell takes in O₂ and releases CO₂. Why?", options: ["Photosynthesis runs backwards", "Respiration continues but photosynthesis has stopped", "The cell is dying", "Chloroplasts make CO₂ at night"], answer: 1, why: "Mitochondria respire all the time. In good light photosynthesis usually outpaces respiration, so there is a net release of O₂; in dim light the two can balance (the compensation point), and at night only respiration happens." },
  { band: "y11", q: "Bright light, high CO₂: ATP is near maximum. Why does the rate of aerobic respiration fall?", options: ["Glucose runs out", "Low ADP availability slows the electron transport chain and ATP synthase (respiratory control)", "Oxygen becomes toxic", "Chloroplasts inhibit mitochondria directly"], answer: 1, why: "Respiration is demand-led: ATP synthase needs ADP + Pᵢ. When ATP is high, ADP is low and the whole pathway slows." },
  { band: "y11", q: "Ion pumps in the membrane stop (the cell is in fresh water). Which sequence follows?", options: ["Solutes leak out → cell water potential rises toward the outside's → less turgor can be sustained → water leaves until pressure and solute potentials balance again", "Water rushes in → cell bursts", "Turgor rises", "Nothing — water moves independently of solutes"], answer: 0, why: "Pumped-in solutes keep the cell's solute potential low. As they leak away, the turgor the cell can hold at equilibrium falls, so water leaves by osmosis until a new balance is reached." },
];

/** Live "why is this happening" narrative, built from what the model is actually doing (fluxes), not just the switches. */
/** Which term of the model's photosynthesis rate is actually smallest right now (same terms as plantCellModel.stepOnce), or null if none is clearly limiting. */
function limiter(m) {
  if (!m.on.chloroplast) return "off";
  const lf = LEAVES[m.leaf] || LEAVES.generic, sat = (x, k) => (x <= 0 ? 0 : x / (x + k));
  const L = sat(m.light, lf.K), C = sat(m.co2 + m.co2Out * 0.6 * m.stomata, 30), W = Math.max(0.2, Math.min(1, m.turgor / 60));
  const low = Math.min(L, C, W);
  if (low >= 0.6) return null;
  if (low === L) return "light";
  if (low === C) return m.stomata < 0.7 && m.co2Out >= 10 ? "stomata" : "co2";
  return "water";
}
const LIMIT_TEXT = {
  light: { y7: "there is not much light for it", adv: "light is the limiting factor" },
  co2: { y7: "there is little carbon dioxide for it", adv: "CO₂ supply is the limiting factor" },
  stomata: { y7: "the leaf's pores are mostly shut, so little carbon dioxide gets in", adv: "closed stomata restrict CO₂ entry, which is the limiting factor" },
  water: { y7: "the cell is short of water", adv: "low turgor (water) is the limiting factor" },
};

const lens_y11 = (band) => band === "y11" || band === "y12";
export function narrative(m, band) {
  const y7 = band === "y7-8";
  const on = m.on, F = m.flux, out = [];
  const E = y7 ? "energy (ATP)" : "ATP";
  const photo = F.photo || 0, resp = F.resp || 0, o2 = F.o2Out || 0, mob = F.mobilise || 0, store = F.store || 0;
  // net gas exchange and the photosynthesis/respiration balance are reported separately: right after a change,
  // O₂ made earlier can still be diffusing out even though respiration is now faster
  const balance = photo > resp * 1.1 ? "photosynthesis is faster than respiration" : resp > photo * 1.1 ? "respiration is faster than photosynthesis" : "photosynthesis and respiration are about balanced";
  const lag = (o2 > 0.15 && photo < resp) || (o2 < -0.15 && photo > resp);
  const gas = Math.abs(o2) < 0.15 ? (y7 ? "Oxygen going in and out is about balanced." : `Net O₂ exchange is about zero (${balance}).`)
    : lag ? (y7 ? `Oxygen is still ${o2 > 0 ? "leaving" : "coming in"} from before, but that is about to reverse.` : `Net O₂ is still ${o2 > 0 ? "leaving" : "entering"} (${Math.abs(o2).toFixed(1)}/s) as the cell catches up — but now ${balance}, so this will reverse.`)
    : o2 > 0 ? (y7 ? "Overall, the cell is <strong>giving out oxygen</strong>." : `Net O₂ is <strong>leaving</strong> the cell (${o2.toFixed(1)}/s): ${balance}.`)
    : (y7 ? "Overall, the cell is <strong>taking in oxygen</strong>." : `Net O₂ is <strong>entering</strong> the cell (${(-o2).toFixed(1)}/s): ${balance}.`);
  const co2Limited = m.light > 30 && (m.co2Out < 10 || m.stomata < 0.4) && m.co2 < 10;
  if (!on.chloroplast) out.push(`Chloroplasts are <strong>off</strong>: no new glucose is being made.`);
  else if (co2Limited) out.push(`Plenty of light but very little <strong>CO₂</strong> — CO₂ is the <strong>limiting factor</strong>, so photosynthesis is ${photo < 0.15 ? "almost stopped" : "slow"}.`);
  else if (photo < 0.15) out.push(y7 ? `There's <strong>not enough light</strong>, so the chloroplasts have stopped making glucose.` : `<strong>Almost no photosynthesis</strong> right now — light (${m.light.toFixed(0)}%) is limiting.`);
  else out.push(y7
    ? `<strong>Chloroplasts</strong> are using light to make <strong>glucose and oxygen</strong>.`
    : `Chloroplasts are photosynthesising (${photo.toFixed(1)}/s). Mitochondria use the sugar and O₂ to make ATP; their CO₂ is reused by the chloroplasts.`);
  if (mob > 0.05) out.push(y7 ? `The cell is using its <strong>stored starch</strong> for glucose.` : `Starch is being broken down to keep sugar flowing to the mitochondria (starch ${m.starch.toFixed(0)}%).`);
  else if (store > 0.05) out.push(y7 ? `Spare glucose is being stored as <strong>starch</strong>.` : `Spare sugar is being stored as starch (${m.starch.toFixed(0)}%).`);
  out.push(gas);

  if (!on.mitochondrion) out.push(y7
    ? `<strong>Mitochondria off</strong> → hardly any ${E}. Everything that needs energy slows down: the pumps, the nucleus and the ribosomes.`
    : `<strong>Mitochondria off</strong>: only glycolysis/fermentation in the cytosol makes ATP (a tiny amount). ATP ${m.atp.toFixed(0)}% → pumps, transcription, translation and shipping stall.`);
  else if (resp > 0.3 && m.atp > 80 && !y7) out.push(`ATP is high, so respiration has slowed — it runs on demand.`);
  else if (m.atp < 15) out.push(`${E} is very low, so everything that needs energy is slowing down.`);
  if (!on.pores) out.push(`<strong>Nuclear pores blocked</strong>: ${on.nucleus ? `new mRNA is trapped in the nucleus (${m.mrna.toFixed(0)}%)` : "no mRNA can leave the nucleus"}. Ribosomes keep reading the mRNA already outside until it breaks down, then protein production stops.`);
  if (!on.nucleus) out.push(on.pores ? `<strong>Transcription off</strong>: no new mRNA. The mRNA already made still leaves the nucleus and is read until it breaks down.` : `<strong>Transcription off</strong> as well: no new mRNA is being made.`);
  if (!on.er) out.push(`<strong>Ribosomes/ER off</strong>: mRNA arrives but no secreted proteins are made.`);
  if (!on.golgi) out.push(`<strong>Golgi off</strong>: proteins pile up in the ER and nothing is shipped to the membrane.`);
  // ---- sun / shade leaf, day cycle and stomata: all read from the live fluxes ----
  const leafOn = m.leaf && m.leaf !== "generic";
  if (m.auto) out.push(`It is <strong>${clockText(m.hour)}</strong> — light ${m.light.toFixed(0)}%.`);
  if ((leafOn || m.auto) && on.chloroplast && on.mitochondrion) {
    const net = F.net || 0, name = m.leaf === "sun" ? "sun leaf" : m.leaf === "shade" ? "shade leaf" : "leaf";
    if (m.light < 1) out.push(y7
      ? `It is dark, so there is <strong>no photosynthesis</strong>, but the cell keeps <strong>respiring</strong>: it uses up oxygen and sugar all night.`
      : `Dark: photosynthesis is 0 but respiration continues (${resp.toFixed(1)}/s), so net O₂ exchange is −${resp.toFixed(1)}/s and the sugar store falls (${m.sugar.toFixed(0)}%).`);
    else if (photo > 0.1 && Math.abs(net) <= 0.25 && !["light", null].includes(limiter(m))) out.push(y7
      ? `The ${name} makes about as much oxygen as it uses, but that is because ${LIMIT_TEXT[limiter(m)]?.y7 || "something is switched off"}, not because the light is low.`
      : `Net O₂ exchange ≈ 0 (photosynthesis ${photo.toFixed(1)}/s ≈ respiration ${resp.toFixed(1)}/s), but photosynthesis is held down because ${LIMIT_TEXT[limiter(m)]?.adv || "chloroplasts are off"} — this is not the light compensation point.`);
    else if (photo > 0.3 && Math.abs(net) <= 0.25) out.push(y7
      ? `The ${name} makes about as much oxygen as it uses: this light is its <strong>compensation point</strong>.`
      : `At the <strong>light compensation point</strong> for this ${name}: photosynthesis (${photo.toFixed(1)}/s) ≈ respiration (${resp.toFixed(1)}/s), so net O₂ exchange ≈ 0.`);
    else if (net < 0) {
      const lim = limiter(m);
      const why = lim === "off" ? (y7 ? " The chloroplasts are switched off." : " Chloroplasts are switched off.")
        : lim ? (y7 ? ` Photosynthesis is held back because ${LIMIT_TEXT[lim].y7}.` : ` Photosynthesis is held back: ${LIMIT_TEXT[lim].adv}.`)
        : (y7 ? "" : " No single input is clearly limiting photosynthesis; respiration is simply faster (check the organelle switches).");
      out.push(y7
        ? `This ${name} is using <strong>more oxygen than it makes</strong>, so it is living off stored sugar.${why}`
        : `Net O₂ is negative for this ${name}: photosynthesis ${photo.toFixed(1)}/s < respiration ${resp.toFixed(1)}/s, so net O₂ is −${(-net).toFixed(1)}/s and the sugar store is being drawn on (light ${m.light.toFixed(0)}%).${why}`);
    }
    else if (!y7) out.push(`Above the compensation point for this ${name}: net O₂ production is +${net.toFixed(1)}/s (photosynthesis ${photo.toFixed(1)}/s − respiration ${resp.toFixed(1)}/s).`);
  }
  if (m.stomata < 0.7) out.push(`<strong>Stomata ${m.stomata < 0.15 ? "are nearly shut" : "are closing"}</strong> (${(m.stomata * 100).toFixed(0)}% open) in the hot, dry air. This saves water, but CO₂ can't get in fast enough: CO₂ inside the leaf is ${m.co2.toFixed(0)}%, so ${["co2", "stomata"].includes(limiter(m)) ? "<strong>CO₂ limits photosynthesis</strong>" : "photosynthesis is slowed"} (${photo.toFixed(1)}/s).${lens_y11(band) ? " The guard cells lose turgor and shut the pore: water is saved, but the CO₂ supply is cut." : ""}`);
  const w = F.water || 0;
  const wDir = w < -0.2 ? "out" : w > 0.2 ? "in" : "none";
  if (m.outside > 25) out.push(y7
    ? `The cell is sitting in <strong>salty water</strong>. ${wDir === "out" ? "Water is being drawn out of the vacuole." : wDir === "in" ? "Water is moving back in." : "Water in and out has balanced."}`
    : `The surrounding solution is concentrated (more negative water potential). ${wDir === "out" ? "Water is leaving the vacuole by osmosis" : wDir === "in" ? "Water is moving back in by osmosis" : "Net water movement has stopped — the water potentials are balanced"}${m.turgor < 30 ? " — the protoplast has pulled away from the wall (plasmolysis)" : ""}.`);
  else if (wDir === "in" && m.turgor < 70) out.push(y7 ? `Water is flowing back into the vacuole, so the cell is firming up.` : `Water is re-entering the vacuole by osmosis; turgor is recovering (${m.turgor.toFixed(0)}%).`);
  if (!on.pumps) out.push(y7 ? `<strong>Pumps off</strong>: dissolved substances leak away, so the cell slowly loses water${wDir === "out" ? " — it's happening now" : ""}.` : `<strong>Pumps off</strong>: solutes leak out, so the turgor the cell can sustain falls; water ${wDir === "out" ? "is leaving" : wDir === "in" ? "is moving back in" : "has stopped moving"} (turgor ${m.turgor.toFixed(0)}%).`);
  if (!on.aquaporins) out.push(`<strong>Aquaporins off</strong>: water can still cross the lipid bilayer, but much more slowly.`);
  return out;
}
