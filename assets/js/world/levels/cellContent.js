// Lens-aware text for the plant-cell level. Each value may be a plain string or
// { "y7-8": ..., "y9-10": ..., "y11": ..., "y12": ... } (lens.pick chooses the right one).

export const ORGANELLES = {
  chloroplast: {
    name: "Chloroplast", color: "#4ade80", portal: "chloroplast", sim: "photosynthesis",
    role: {
      "y7-8": "Uses <strong>light energy</strong> to make <strong>glucose</strong> (a sugar) and <strong>oxygen</strong>. This is <strong>photosynthesis</strong>.",
      "y9-10": "Site of <strong>photosynthesis</strong>: carbon dioxide + water → glucose + oxygen, powered by light absorbed by <strong>chlorophyll</strong>. Spare glucose is stored as <strong>starch</strong>.",
      y11: "Light-dependent reactions on the <strong>thylakoid membranes</strong> split water (releasing O₂) and make ATP + NADPH; the <strong>Calvin cycle</strong> in the stroma uses them to fix CO₂ into sugar. Excess sugar is stored as starch grains.",
    },
    inputs: { "y7-8": "light, carbon dioxide, water", y11: "light, CO₂, H₂O (+ ADP, NADP⁺ recycled)" },
    outputs: { "y7-8": "glucose, oxygen", "y9-10": "glucose (→ starch store), oxygen", y11: "glucose/starch, O₂" },
    feeds: "mitochondria (glucose + O₂)",
  },
  mitochondrion: {
    name: "Mitochondrion", color: "#fb923c", portal: "mitochondrion", sim: "atp-synthase",
    role: {
      "y7-8": "The cell's power station: uses <strong>glucose</strong> and <strong>oxygen</strong> to release <strong>energy</strong> the cell can use (stored in <strong>ATP</strong>).",
      "y9-10": "Site of <strong>aerobic respiration</strong>: glucose + oxygen → carbon dioxide + water + energy (ATP). Plant cells need mitochondria too — day and night.",
      y11: "Krebs cycle in the matrix and the <strong>electron transport chain</strong> on the cristae; ATP synthase uses the H⁺ gradient to make ~30 ATP per glucose. Rate is set by demand: when ATP is high, respiration slows.",
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
      "y9-10": "Ribosomes on the rough ER read mRNA and join amino acids into <strong>proteins</strong>. The ER folds them and sends them on to the Golgi in vesicles.",
      y11: "<strong>Translation</strong> at ER-bound ribosomes: tRNAs deliver amino acids matching each codon. New polypeptides enter the ER lumen to fold, then bud off in vesicles to the Golgi.",
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
      y11: "Modifies proteins (e.g. adds sugars), sorts them and packages them in vesicles; in plant cells it also makes cell-wall polysaccharides. Exocytosis needs ATP.",
    },
    inputs: "proteins from the ER, energy", outputs: "vesicles to the membrane and cell wall", feeds: "cell membrane and cell wall",
  },
  vacuole: {
    name: "Central vacuole", color: "#7dd3fc", sim: "osmosis",
    role: {
      "y7-8": "A big bag of water. When it's full it pushes out against the cell wall and keeps the plant <strong>firm</strong>.",
      "y9-10": "Stores water and dissolved substances. Water enters by <strong>osmosis</strong>; a full vacuole pushes on the cell wall (<strong>turgor</strong>). If it loses water, the plant wilts.",
      y11: "Bounded by the tonoplast. Ions pumped in (using ATP) lower its water potential, so water follows by osmosis through aquaporins, creating turgor pressure against the wall.",
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
      y11: "Cellulose microfibrils in a matrix of other polysaccharides, laid down by vesicles from the Golgi. Fully permeable; resists turgor pressure. Plasmodesmata link cytoplasm of adjacent cells.",
    },
    inputs: "building materials from Golgi vesicles", outputs: "support, shape", feeds: "the whole plant's structure",
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
  { band: "y7-8", text: "Ship <strong>10 loads of protein</strong> to the cell wall.", check: (m, s) => m.wallBuilt - s.wall0 >= 10 },
  { band: "y9-10", text: "Block the <strong>nuclear pores</strong>. Where does the mRNA pile up, and which organelles go quiet?", check: (m) => !m.on.pores && m.mrna > 70 },
  { band: "y9-10", text: "Find a <strong>limiting factor</strong>: with bright light, cut CO₂ so photosynthesis slows.", check: (m) => m.light > 60 && m.co2Out < 8 && m.flux.photo < 2.5 },
  { band: "y11", text: "Show <strong>demand control</strong>: in bright light, ATP stays high and the mitochondria slow down.", check: (m) => m.atp > 80 && m.flux.resp < 1.5 && m.light > 60 },
  { band: "y11", text: "At night, run the <strong>starch store</strong> down below 40.", check: (m) => m.light < 10 && m.starch < 40 },
  { band: "y11", text: "Switch off the <strong>aquaporins</strong>, then the pumps: compare how fast turgor falls with and without water channels.", check: (m) => !m.on.aquaporins && !m.on.pumps && m.turgor < 60 },
];

export const QUIZ = [
  { band: "y7-8", maxBand: "y7-8", q: "Which organelle uses light to make glucose?", options: ["Mitochondrion", "Chloroplast", "Nucleus", "Vacuole"], answer: 1, why: "Chloroplasts contain chlorophyll, which captures light for photosynthesis." },
  { band: "y7-8", q: "Plant cells have chloroplasts. Why do they ALSO need mitochondria?", options: ["They don't — mitochondria are only in animals", "To turn glucose into usable energy (ATP), day and night", "To store water", "To make chlorophyll"], answer: 1, why: "Chloroplasts make glucose, but mitochondria release its energy as ATP. At night there's no photosynthesis, but respiration keeps going." },
  { band: "y7-8", q: "If the mitochondria stop working, what happens to the cell membrane pumps?", options: ["Nothing", "They stop, because they need energy (ATP)", "They speed up", "They turn into chloroplasts"], answer: 1, why: "Pumps use ATP. No ATP → no pumping → water leaves the vacuole → the cell goes floppy." },
  { band: "y7-8", q: "What keeps a plant cell firm?", options: ["The nucleus", "A full vacuole pushing against the cell wall", "Chloroplasts", "Mitochondria"], answer: 1, why: "Water in the vacuole pushes out against the strong cell wall (turgor)." },
  { band: "y9-10", q: "The nuclear pores are blocked. What happens FIRST?", options: ["Ribosomes run out of mRNA instructions", "Photosynthesis stops", "The cell wall dissolves", "Oxygen can't get in"], answer: 0, why: "mRNA must leave the nucleus to reach ribosomes. Without it, protein production stops; the Golgi then has nothing to ship." },
  { band: "y9-10", q: "At night, a leaf cell takes in O₂ and releases CO₂. Why?", options: ["Photosynthesis runs backwards", "Respiration continues but photosynthesis has stopped", "The cell is dying", "Chloroplasts make CO₂ at night"], answer: 1, why: "Mitochondria respire all the time. In daylight photosynthesis outpaces respiration, so net O₂ leaves; at night only respiration happens." },
  { band: "y11", q: "Bright light, high CO₂: ATP is near maximum. Why does the rate of aerobic respiration fall?", options: ["Glucose runs out", "Low ADP availability slows the electron transport chain and ATP synthase (respiratory control)", "Oxygen becomes toxic", "Chloroplasts inhibit mitochondria directly"], answer: 1, why: "Respiration is demand-led: ATP synthase needs ADP + Pᵢ. When ATP is high, ADP is low and the whole pathway slows." },
  { band: "y11", q: "Ion pumps in the membrane stop. Which sequence follows?", options: ["Ions leak out → vacuole water potential rises → water leaves by osmosis → turgor falls", "Water rushes in → cell bursts", "Turgor rises", "Nothing — water moves independently of ions"], answer: 0, why: "Pumped-in solutes keep the vacuole's water potential low. Lose them and water follows them out by osmosis." },
];

/** Live "why is this happening" narrative, built from the model state. */
export function narrative(m, band) {
  const y7 = band === "y7-8";
  const on = m.on, F = m.flux, out = [];
  const E = y7 ? "energy (ATP)" : "ATP";
  if (m.light < 8) out.push(y7
    ? `It's <strong>dark</strong>, so the chloroplasts can't make glucose. The cell is using its <strong>stored starch</strong> instead. Mitochondria still turn glucose into ${E}, so the cell is now taking <strong>in</strong> oxygen.`
    : `<strong>Dark</strong>: no photosynthesis. Starch in the chloroplasts is broken down to glucose for respiration (starch ${m.starch.toFixed(0)}%). Net gas exchange has reversed: O₂ in, CO₂ out.`);
  else if (!on.chloroplast) out.push(`Chloroplasts are <strong>off</strong>: no new glucose. The cell lives on stored starch (${m.starch.toFixed(0)}%) until it runs out.`);
  else if (F.photo < 2 && m.co2Out < 10) out.push(`Plenty of light but very little <strong>CO₂</strong> — CO₂ is now the <strong>limiting factor</strong> for photosynthesis.`);
  else out.push(y7
    ? `Daytime: <strong>chloroplasts</strong> use light to make <strong>glucose and oxygen</strong>. <strong>Mitochondria</strong> use them to release ${E}. Spare glucose is stored as <strong>starch</strong>.`
    : `Chloroplasts make glucose + O₂; mitochondria use them to make ATP + CO₂, which the chloroplasts reuse. Photosynthesis is faster than respiration, so the cell <strong>releases</strong> O₂ (${F.o2Out.toFixed(1)}/s) and stores spare glucose as starch.`);

  if (!on.mitochondrion) out.push(y7
    ? `<strong>Mitochondria off</strong> → hardly any ${E} → pumps stop → water leaks out of the vacuole → the cell goes floppy. The nucleus and ribosomes slow down too.`
    : `<strong>Mitochondria off</strong>: only glycolysis/fermentation in the cytoplasm makes ATP (a tiny amount). ATP ${m.atp.toFixed(0)}% → pumps, transcription, translation and shipping all stall.`);
  else if (m.atp < 15) out.push(`${E} is very low, so everything that needs energy is slowing down.`);
  if (!on.pores) out.push(`<strong>Nuclear pores blocked</strong>: mRNA is trapped in the nucleus (${m.mrna.toFixed(0)}%), so ribosomes get no instructions → no new proteins → the Golgi has nothing to ship.`);
  if (!on.nucleus) out.push(`<strong>Nucleus off</strong>: no new mRNA. Ribosomes finish the instructions they have, then stop.`);
  if (!on.er) out.push(`<strong>Ribosomes/ER off</strong>: mRNA arrives but no proteins are made.`);
  if (!on.golgi) out.push(`<strong>Golgi off</strong>: proteins pile up in the ER and nothing reaches the cell wall.`);
  if (!on.pumps) out.push(y7 ? `<strong>Pumps off</strong>: the cell can't hold onto dissolved substances, so water leaves the vacuole and the cell goes floppy.` : `<strong>Pumps off</strong>: ions leak out of the vacuole, its water potential rises, and water leaves by osmosis → turgor ${m.turgor.toFixed(0)}%.`);
  if (!on.aquaporins) out.push(`<strong>Aquaporins off</strong>: water can still cross the lipid bilayer, but much more slowly.`);
  return out;
}
