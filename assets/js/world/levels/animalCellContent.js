// Lens-aware text for the animal-cell level (a human liver cell, or hepatocyte).
// Each value may be a plain string or { "y7-8": ..., "y9-10": ..., "y11": ..., "y12": ... } (lens.pick chooses the right one).
import { ORGANELLES as PLANT } from "./cellContent.js";

export const NOTE = {
  "y7-8": "A typical human body cell, modelled on a liver cell (hepatocyte). Sizes and numbers are simplified.",
  "y9-10": "A typical human body cell, modelled on a liver cell (hepatocyte). Sizes and numbers are simplified: a real liver cell has about 1,000–2,000 mitochondria (about 40 are drawn).",
  y11: "A typical human body cell, modelled on a liver cell (hepatocyte). Sizes and numbers are simplified, and all rates are teaching-scale. Not modelled: insulin and glucagon (they are the signals behind the glycogen switch), gluconeogenesis, regulatory volume recovery, and the fatty acids and amino acids a real liver burns (only a small background of \"other fuels\" is included).",
};

export const ORGANELLES = {
  nucleus: PLANT.nucleus,
  cytosol: PLANT.cytosol,
  mitochondrion: {
    name: "Mitochondria", color: "#fb923c", portal: "mitochondrion", sim: "atp-synthase",
    role: {
      "y7-8": "The cell's power stations: they use <strong>glucose</strong> and <strong>oxygen</strong> to release energy the cell can use (stored in <strong>ATP</strong>). A liver cell does so much work that it has <strong>lots</strong> of them. The dull, swollen ones are worn out.",
      "y9-10": "Site of <strong>aerobic respiration</strong>: glucose + oxygen → carbon dioxide + water + energy (ATP). Liver cells are packed with mitochondria. Over time some get damaged; damaged ones make little ATP and leak harmful <strong>reactive oxygen</strong> molecules, so the cell recycles them in lysosomes.",
      y11: "Glycolysis happens in the cytosol; pyruvate enters the mitochondrion, becomes acetyl-CoA and feeds the <strong>Krebs cycle</strong>, and the <strong>electron transport chain</strong> and ATP synthase make most of the ATP (about 30 per glucose in total). Respiration is demand-led: when ATP is high (little ADP), it slows. A hepatocyte has roughly 1,000–2,000 mitochondria. Damaged ones make less ATP and more <strong>ROS</strong>; ROS damage more mitochondria, so they are cleared by <strong>mitophagy</strong> and replaced by fission of healthy ones. Liver mitochondria also burn fatty acids.",
    },
    inputs: { "y7-8": "glucose, oxygen", y11: "pyruvate (from glucose) or fatty acids, O₂, ADP + Pᵢ" },
    outputs: { "y7-8": "energy (ATP), carbon dioxide, water", y11: "ATP, CO₂, H₂O; ROS (more when damaged)" },
    feeds: "everything that needs energy: the Na⁺/K⁺ pumps, nucleus, ribosomes, Golgi and glycogen storage",
  },
  er: {
    name: { "y7-8": "Rough ER + ribosomes", y11: "Rough endoplasmic reticulum" }, color: "#5eead4", portal: "ribosome", sim: "protein-synthesis",
    role: {
      "y7-8": "Flat folded sheets next to the nucleus, covered in <strong>ribosomes</strong>. They build <strong>proteins</strong> by following the nucleus's instructions. A liver cell makes a protein called <strong>albumin</strong> here and sends it out into the blood.",
      "y9-10": "Ribosomes on the rough ER read mRNA and join amino acids into proteins that will be <strong>exported</strong> (here, <strong>albumin</strong>, the most common protein in blood plasma). The ER folds them and sends them to the Golgi in vesicles.",
      y11: "<strong>Translation</strong> of secretory proteins: a signal sequence directs the ribosome to the ER, where the polypeptide enters the lumen and folds; it leaves in transport vesicles for the Golgi. Hepatocytes make albumin and most other plasma proteins this way. Proteins for the cytosol, nucleus and mitochondria are made on free ribosomes instead.",
    },
    inputs: { "y7-8": "mRNA instructions, energy", y11: "mRNA, amino acids, ATP/GTP" },
    outputs: "proteins (in vesicles)", feeds: "Golgi apparatus",
  },
  ser: {
    name: { "y7-8": "Smooth ER", y11: "Smooth endoplasmic reticulum" }, color: "#38bdf8",
    role: {
      "y7-8": "A web of smooth tubes with no ribosomes. In the liver it helps <strong>break down harmful substances</strong> and make fats. Glycogen granules sit beside it.",
      "y9-10": "A branching network of tubes with no ribosomes. In liver cells it <strong>detoxifies</strong> drugs and alcohol and makes lipids and cholesterol. Stored glycogen granules cluster around it.",
      y11: "Smooth ER has no bound ribosomes. Hepatocytes have a lot: it carries detoxifying enzymes (e.g. cytochrome P450), makes lipids, phospholipids and cholesterol, and holds <strong>glucose-6-phosphatase</strong> in its membrane, the enzyme that lets the liver free glucose from glycogen and release it into the blood.",
    },
    inputs: "lipid building blocks, drugs and toxins, glucose-6-phosphate", outputs: "lipids, detoxified substances, free glucose", feeds: "membranes, bile and the blood",
  },
  golgi: {
    name: "Golgi apparatus", color: "#f0abfc",
    role: {
      "y7-8": "The cell's <strong>post office</strong>: it packs proteins into little bubbles (<strong>vesicles</strong>) and sends them where they are needed. Here it packs albumin and sends it to the cell edge to be posted into the blood.",
      "y9-10": "Modifies, sorts and packages proteins into <strong>vesicles</strong>. Secretory vesicles bud off the Golgi and travel along microtubules to the membrane, where they fuse and release their contents by <strong>exocytosis</strong>.",
      y11: "Receives vesicles from the ER on its cis face, modifies and sorts proteins as they pass through the cisternae, and packages them at the trans face. Albumin is made as a slightly longer precursor, and the Golgi trims it. Hepatocytes secrete albumin <strong>constitutively</strong>: vesicles are released continuously, not stored and then triggered. Exocytosis needs ATP and motor proteins moving on microtubules.",
    },
    inputs: "proteins from the ER, energy", outputs: "secretory vesicles (albumin), lysosome enzymes, membrane proteins", feeds: "the cell membrane and the blood",
  },
  lysosome: {
    name: "Lysosomes", color: "#f87171",
    role: {
      "y7-8": "Little <strong>recycling bins</strong> full of strong digestive chemicals. They break down worn-out cell parts and things the cell has taken in. (Plant cells do a similar job in their vacuole.)",
      "y9-10": "Membrane bags of acidic <strong>digestive enzymes</strong>. They digest worn-out organelles (<strong>autophagy</strong>, \"self-eating\") and material brought into the cell. Here they clear damaged mitochondria. Plant vacuoles do similar digestion, so \"plants have no lysosomes\" is a simplification.",
      y11: "Acidic (about pH 4.5–5, kept by H⁺ pumps) organelles containing hydrolases made on the rough ER and tagged for delivery in the Golgi. In <strong>autophagy</strong> a damaged organelle is wrapped in a double membrane (an autophagosome) that fuses with a lysosome; for mitochondria this is <strong>mitophagy</strong>. Low lysosome activity lets damaged mitochondria and ROS build up. The plant equivalent is the lytic vacuole.",
    },
    inputs: "worn-out organelles, engulfed material", outputs: "small molecules (amino acids, sugars) reused by the cell", feeds: "the cytosol (recycled building blocks)",
  },
  peroxisome: {
    name: "Peroxisomes", color: "#facc15", band: "y11",
    role: "Abundant in liver cells. They break down hydrogen peroxide with catalase, break down very-long-chain fatty acids, and help detoxify some harmful substances.",
    inputs: "fatty acids, H₂O₂", outputs: "H₂O + O₂, shortened fatty acids", feeds: "mitochondria (fatty acids)",
  },
  centrosome: {
    name: { "y7-8": "Centrosome", y11: "Centrosome (two centrioles)" }, color: "#fb7185",
    role: {
      "y7-8": "A tiny organiser next to the nucleus made of two little tubes at right angles (<strong>centrioles</strong>). It anchors the cell's internal skeleton and helps the cell divide. Animal cells have them; most plant cells do not.",
      "y9-10": "Two <strong>centrioles</strong> at right angles surrounded by a cloud of protein. It organises the <strong>microtubules</strong> that radiate through the cell. Before cell division it is copied, and the two centrosomes become the poles of the spindle. Most flowering-plant cells have no centrioles.",
      y11: "The main microtubule-organising centre. Each centriole is a cylinder of nine microtubule triplets; the surrounding pericentriolar material nucleates the microtubules. It duplicates once per cell cycle, and the two centrosomes form the spindle poles in mitosis. Flowering plants build their spindle without centrosomes (acentrosomal).",
    },
    inputs: "tubulin", outputs: "microtubules", feeds: "vesicle transport and the spindle in cell division",
    note: { "y7-8": "Drawn larger than life so you can see it.", "y9-10": "Drawn larger than life. The star-shaped array is a simplified, general animal-cell arrangement.", y11: "Drawn larger than life. A single radial array is the simplified textbook arrangement: hepatocytes are polarised, and much of their microtubule network is non-centrosomal." },
  },
  microtubule: {
    name: "Microtubules", color: "#86efac",
    role: {
      "y7-8": "Thin hollow tubes that act like <strong>tracks</strong> across the cell. Vesicles carrying albumin are carried along them to the cell edge.",
      "y9-10": "Hollow protein tubes (the cytoskeleton) that radiate from the centrosome. Motor proteins carry vesicles along them like trains on rails. They also hold the cell's shape and make the spindle in cell division.",
      y11: "Polymers of tubulin dimers with their minus ends at the centrosome and plus ends towards the periphery. Kinesin motors walk towards the plus end carrying secretory vesicles from the Golgi to the membrane (using ATP); dynein walks the other way. Drawn thicker than life.",
    },
    inputs: "tubulin, GTP", outputs: "tracks for transport", feeds: "secretory vesicles, organelle positioning, the spindle",
    note: { "y7-8": "Drawn thicker than life, and simplified.", "y9-10": "Drawn thicker than life. Radiating from one centre is a simplified, general animal-cell arrangement.", y11: "Drawn thicker than life. Radiating from one centrosome is the simplified general animal-cell picture; hepatocytes are polarised and much of their microtubule array is non-centrosomal." },
  },
  glycogen: {
    name: "Glycogen granules", color: "#fbcfe8",
    role: {
      "y7-8": "The cell's <strong>store of sugar</strong>. After a meal the liver joins spare glucose into big branched chains. When blood sugar drops, it breaks them down again. (Plants store starch instead.)",
      "y9-10": "Glycogen is a branched polymer of glucose, the animal equivalent of starch. When blood glucose is <strong>high</strong> the cell stores glucose as glycogen (this costs ATP); when it is <strong>low</strong> the cell breaks glycogen down and releases glucose into the blood.",
      y11: "<strong>Glycogenesis</strong> (glucose → glucose-6-phosphate → UDP-glucose → glycogen, which costs ATP/UTP) when blood glucose is high; <strong>glycogenolysis</strong> (phosphorylase, then glucose-6-phosphatase) when it is low. The signals are insulin and glucagon, which this model does not simulate: the switch here is the blood glucose level itself. Liver glycogen supplies the whole body's blood glucose; muscle glycogen cannot, because muscle has no glucose-6-phosphatase.",
    },
    inputs: "glucose (when blood glucose is high), ATP", outputs: "glucose (when blood glucose is low)", feeds: "the blood glucose supply",
  },
  glut: {
    name: "GLUT2 transporters", color: "#a3e635", portal: "membrane", sim: "membrane-transport",
    role: {
      "y7-8": "Special doors in the membrane that let <strong>glucose</strong> through. They work both ways, so the liver cell can take glucose in or let it out.",
      "y9-10": "Transport proteins that move glucose across the membrane by <strong>facilitated diffusion</strong> (no ATP). Glucose moves from where it is more concentrated to where it is less concentrated, and GLUT2 lets it go either way depending on that gradient: into the liver cell when blood glucose is higher than the cell's, and out when the cell's is higher.",
      y11: "<strong>GLUT2</strong> is a high-capacity, low-affinity (high Km, about 17 mM) uniporter on the blood-facing side of the hepatocyte. Because uptake follows blood glucose, and it works in both directions, the liver can buffer it. It is insulin-independent. (GLUT4 in muscle and fat cells is the insulin-regulated one.)",
    },
    inputs: "glucose (either side)", outputs: "glucose (the other side)", feeds: "glycolysis, glycogen, or the blood",
  },
  membrane: {
    name: "Cell membrane", color: "#fda4af", portal: "membrane", sim: "membrane-transport",
    role: {
      "y7-8": "A thin, flexible layer that <strong>controls what goes in and out</strong>. An animal cell has <strong>no cell wall</strong>, so this is its outer edge. On the blood side it has tiny fingers (<strong>microvilli</strong>) to soak up more.",
      "y9-10": "A <strong>partially permeable</strong> phospholipid bilayer. Water crosses by osmosis; glucose uses transporters (GLUT2); <strong>Na⁺/K⁺ pumps</strong> use ATP to keep the cell's salts balanced, which stops it swelling. With no wall, the cell bursts in pure water and shrinks in salty water.",
      y11: "Fluid-mosaic bilayer: simple diffusion (O₂, CO₂), osmosis, facilitated diffusion (GLUT2), primary active transport (<strong>Na⁺/K⁺-ATPase</strong>: 3 Na⁺ out, 2 K⁺ in per ATP, a major ATP cost that offsets the leak of ions in), and exocytosis. Impermeant ions and proteins inside pull water in, so without the pump–leak balance the cell swells and lyses. Microvilli on the sinusoidal face increase surface area.",
    },
    inputs: "ATP for pumps", outputs: "controls entry and exit of water, glucose, ions and gases", feeds: "everything inside the cell",
  },
  sinusoid: {
    name: "Blood vessel (sinusoid)", color: "#f87171",
    role: {
      "y7-8": "A wide, slow blood vessel that runs past liver cells. Blood brings <strong>glucose</strong> and <strong>oxygen</strong> to the cell and carries away its products, like albumin.",
      "y9-10": "A <strong>sinusoid</strong> is a wide, leaky capillary. Blood flows slowly past the liver cells, which take up glucose and oxygen from it and release glucose, carbon dioxide and proteins such as albumin into it.",
      y11: "Hepatic sinusoids have a fenestrated endothelium and no continuous basement membrane, so plasma reaches the hepatocyte surface freely (the space of Disse). Blood glucose is the input signal for the cell's glycogen switch, and the cell's output (glucose, albumin) goes straight back into the blood.",
    },
    inputs: "glucose, oxygen, hormones", outputs: "CO₂, glucose and albumin from the liver cell", feeds: "the rest of the body",
  },
  rbc: {
    name: "Red blood cells", color: "#ef4444",
    role: {
      "y7-8": "Red blood cells carry <strong>oxygen</strong> to the liver cell. Their dished shape gives them lots of surface for soaking up and releasing oxygen.",
      "y9-10": "Biconcave discs about 7–8 µm across with no nucleus. They carry oxygen on <strong>haemoglobin</strong> and release it to cells such as the liver cell.",
      y11: "Anucleate, biconcave erythrocytes full of haemoglobin. The shape maximises surface area to volume for gas exchange, and the flexible cell can squeeze through narrow capillaries.",
    },
    inputs: "O₂ from the lungs", outputs: "O₂ to tissues; returns CO₂ to the lungs", feeds: "the mitochondria of every cell",
  },
  microvilli: {
    name: "Microvilli", color: "#fecdd3",
    role: {
      "y7-8": "Tiny finger-like folds on the blood side of the cell. They give it <strong>more surface</strong> for taking things in and letting them out.",
      "y9-10": "Finger-like projections of the membrane that increase the <strong>surface area</strong> facing the blood, so more glucose and oxygen can cross.",
      y11: "Microvilli on the sinusoidal (basolateral) face increase the membrane area available for GLUT2 and for exchange with plasma, raising the surface area to volume ratio.",
    },
    inputs: "—", outputs: "—", feeds: "exchange with the blood",
  },
};

export const SWITCHES = [
  { key: "mitochondrion", label: "Mitochondria" },
  { key: "nucleus", label: "Nucleus" },
  { key: "pores", label: "Nuclear pores", band: "y9-10" },
  { key: "er", label: { "y7-8": "Ribosomes / rough ER", y11: "Ribosomes on rough ER" } },
  { key: "golgi", label: "Golgi apparatus" },
  { key: "lysosome", label: "Lysosomes" },
  { key: "pumps", label: { "y7-8": "Membrane pumps", y11: "Na⁺/K⁺ pumps (ATP)" } },
  { key: "glut", label: { "y7-8": "Glucose doors", "y9-10": "Glucose transporters", y11: "GLUT2 transporters" } },
];

export const FLOWS = {
  glucose: { label: "Glucose", color: "#a3e635", group: "energy" },
  atp: { label: { "y7-8": "Energy (ATP)", "y9-10": "ATP" }, color: "#fbbf24", group: "energy" },
  o2: { label: "Oxygen (O₂)", color: "#f87171", group: "gases" },
  co2: { label: "Carbon dioxide (CO₂)", color: "#cbd5e1", group: "gases" },
  mrna: { label: "mRNA (instructions)", color: "#60a5fa", group: "protein", band: "y9-10" },
  albumin: { label: { "y7-8": "Albumin in vesicles", "y9-10": "Albumin vesicles" }, color: "#f472b6", group: "protein" },
  water: { label: "Water", color: "#38bdf8", group: "water" },
};

/** "What changed from the plant cell": kind = gain | loss | change. Lens-filtered by band. */
export const COMPARE = [
  { band: "y7-8", kind: "loss", text: "<strong>No cell wall.</strong> The membrane is the outer edge, so the cell is soft and can change shape." },
  { band: "y7-8", kind: "loss", text: "<strong>No chloroplasts.</strong> It cannot make its own food; glucose comes from the blood." },
  { band: "y7-8", kind: "loss", text: "<strong>No big central vacuole.</strong> There are only small vesicles." },
  { band: "y7-8", kind: "gain", text: "<strong>Lysosomes:</strong> recycling bins that break down worn-out parts." },
  { band: "y7-8", kind: "gain", text: "<strong>A centrosome</strong> (two centrioles) next to the nucleus, with microtubules spreading out from it." },
  { band: "y7-8", kind: "gain", text: "<strong>Glycogen</strong> as the sugar store (a plant stores starch)." },
  { band: "y9-10", kind: "change", text: "<strong>Osmosis:</strong> a plant cell in pure water goes firm (turgid) because its wall holds it. An animal cell has no wall, so it swells and can <strong>burst</strong>; in salty water it shrinks (osmotic shrinkage). Red blood cells are the familiar example of shrunken, spiky <strong>crenation</strong>." },
  { band: "y9-10", kind: "change", text: "<strong>Energy source:</strong> a plant cell makes its own glucose (photosynthesis). The photosynthetic plant cell shown makes its own glucose. An animal cell gets its glucose from the blood, and the liver cell also stores it as glycogen and releases it." },
  { band: "y9-10", kind: "change", text: "<strong>Recycling:</strong> plant vacuoles do lysosome-like digestion too, so \"plants have no lysosomes\" is a simplification." },
  { band: "y11", kind: "change", text: "<strong>Glucose supply:</strong> glucose crosses the membrane on <strong>GLUT2</strong> (facilitated diffusion, both ways). This model exchanges blood glucose and stores or releases glycogen; real hepatocytes also make glucose (gluconeogenesis), which is left out here. The photosynthetic plant cell shown makes its sugar in its chloroplasts." },
  { band: "y11", kind: "change", text: "<strong>Autophagy:</strong> lysosomes (pH about 5) digest damaged mitochondria (<strong>mitophagy</strong>). Plants do autophagy too, using the lytic vacuole." },
  { band: "y11", kind: "change", text: "<strong>Secretion:</strong> albumin leaves by <strong>constitutive</strong> secretion. A plant's Golgi vesicles mostly deliver wall matrix to the cell wall." },
  { band: "y11", kind: "change", text: "<strong>Division:</strong> animal spindles form around <strong>centrosomes</strong>; most flowering-plant cells build an acentrosomal spindle and divide with a cell plate instead of a cleavage furrow." },
  { band: "y11", kind: "change", text: "<strong>Cell volume:</strong> with no wall, volume is set by the <strong>Na⁺/K⁺-ATPase pump–leak</strong> balance and the outside osmolarity; a plant cell's volume is capped by turgor pressure against its wall." },
];

export const MISSIONS = [
  { band: "y7-8", maxBand: "y9-10", text: "<strong>After a meal:</strong> set the blood glucose to 9 or more for 10 s and watch the liver cell store sugar as glycogen.", check: (m, s) => s.highTime >= 10 },
  { band: "y11", text: "<strong>After a meal:</strong> hold blood glucose at 9 mM or more for 10 s with glycogen rising (glycogenesis).", check: (m, s) => s.highTime >= 10 },
  { band: "y9-10", maxBand: "y9-10", text: "<strong>A fast:</strong> lower the blood glucose to 3.5 mM or less and keep it there for 10 s while the cell releases glucose into the blood.", check: (m, s) => s.fastTime >= 10 },
  { band: "y11", text: "<strong>A fast:</strong> blood glucose at 3.5 mM or less for 10 s while the cell exports glucose (glycogenolysis + GLUT2).", check: (m, s) => s.fastTime >= 10 },
  { band: "y7-8", maxBand: "y7-8", text: "<strong>Burst a cell:</strong> put it in pure water. What stops it bursting in a plant cell?", check: (m) => m.burst },
  { band: "y9-10", maxBand: "y9-10", text: "<strong>Burst a cell</strong> in pure water, then press Reset cell.", check: (m, s) => s.burstSeen && !m.burst },
  { band: "y7-8", maxBand: "y7-8", text: "<strong>Shrink a cell</strong> in very salty water until its size is below 70 %.", check: (m, s) => s.crenSeen },
  { band: "y9-10", maxBand: "y9-10", text: "<strong>Shrink a cell:</strong> make the surroundings very salty until its volume falls below 70 % (osmotic shrinkage).", check: (m, s) => s.crenSeen },
  { band: "y7-8", maxBand: "y7-8", text: "Switch off the <strong>mitochondria</strong> and watch the cell's energy (ATP) run out.", check: (m) => !m.on.mitochondrion && m.atp < 10 },
  { band: "y9-10", maxBand: "y9-10", text: "Switch off the <strong>lysosomes</strong> and wait. Damaged mitochondria pile up and ATP falls below 30 (about a minute).", check: (m) => !m.on.lysosome && m.atp < 30 },
  { band: "y11", text: "Switch off the <strong>lysosomes</strong>: ROS rise as damaged mitochondria accumulate, and ATP falls below 30.", check: (m) => !m.on.lysosome && m.atp < 30 && m.ros > 50 },
  { band: "y11", text: "<strong>Pump–leak:</strong> switch off the Na⁺/K⁺ pumps in normal fluid and watch the cell swell by 20 % or more.", check: (m) => !m.on.pumps && m.outside >= -5 && m.vol >= 1.2 },
  { band: "y11", text: "<strong>Lysis:</strong> burst a cell in hypotonic fluid, then reset it. Explain what a plant cell's wall does differently.", check: (m, s) => s.burstSeen && !m.burst },
  { band: "y7-8", maxBand: "y7-8", text: "Send <strong>20 loads of albumin</strong> out of the cell into the blood.", check: (m, s) => m.secreted - s.sec0 >= 20 },
  { band: "y9-10", maxBand: "y9-10", text: "<strong>Secrete 20 albumin</strong> into the blood.", check: (m, s) => m.secreted - s.sec0 >= 20 },
  { band: "y11", text: "<strong>Secrete 20 albumin</strong> by constitutive secretion.", check: (m, s) => m.secreted - s.sec0 >= 20 },
];

export const QUIZ = [
  { band: "y7-8", maxBand: "y9-10", q: "Which of these does a plant cell have but a liver cell does not?", options: ["Nucleus", "Mitochondria", "Chloroplasts and a cell wall", "A cell membrane"], answer: 2, why: "Animal cells have no cell wall, no chloroplasts and no large permanent central vacuole. Both kinds of cell have a nucleus, mitochondria and a membrane." },
  { band: "y7-8", q: "Why does an animal cell burst in pure water but a plant cell doesn't?", options: ["Plant cells have no water inside", "A plant cell has a strong cell wall; an animal cell has only a thin, stretchy membrane", "Animal cells have no membrane", "Plant cells can't take in water"], answer: 1, why: "Water flows in by osmosis in both. The plant's wall stops it expanding, so the cell becomes firm (turgid). The animal cell has no wall to hold it, so it swells until it bursts." },
  { band: "y7-8", maxBand: "y9-10", q: "What do lysosomes do?", options: ["Make glucose using light", "Break down worn-out parts and waste so they can be recycled", "Store the cell's DNA", "Make proteins"], answer: 1, why: "Lysosomes contain strong digestive enzymes. They break down worn-out organelles such as damaged mitochondria, and the pieces are reused." },
  { band: "y7-8", maxBand: "y9-10", q: "Where does the glucose for a liver cell come from?", options: ["It makes it with chloroplasts", "From the blood (and its own glycogen store)", "From the nucleus", "From the air"], answer: 1, why: "An animal cell cannot photosynthesise. Glucose comes from the food we eat, travels in the blood and enters the cell through transporters in its membrane." },
  { band: "y7-8", maxBand: "y9-10", q: "After a big meal there is a lot of glucose in the blood. What does the liver do with the extra?", options: ["Stores it as glycogen", "Turns it into chlorophyll", "Throws it out of the body", "Nothing at all"], answer: 0, why: "Liver cells join spare glucose into glycogen. Later, when blood glucose falls, they break glycogen down again and release glucose into the blood." },
  { band: "y9-10", q: "It has been many hours since the last meal and blood glucose is falling. What does a liver cell do?", options: ["Takes up even more glucose", "Breaks down glycogen and releases glucose into the blood", "Stops all respiration", "Makes glucose using chloroplasts"], answer: 1, why: "The liver is the body's glucose supplier. In a fast it releases glucose from glycogen, and the glucose leaves through GLUT2 transporters." },
  { band: "y9-10", maxBand: "y9-10", q: "The Na⁺/K⁺ pumps stop working. What happens to the cell over time?", options: ["Nothing", "It slowly swells, because salts leak in and water follows", "It shrinks", "It makes more ATP"], answer: 1, why: "The pumps use ATP to keep salts out of the cell. Without them, salts leak in and water follows by osmosis, so the cell swells and can eventually burst." },
  { band: "y11", q: "Albumin leaves the hepatocyte by constitutive secretion. What does that mean?", options: ["It is stored in vesicles and released only when a hormone signals", "Vesicles are released continuously as albumin is made, without a storage and trigger step", "It leaves through channel proteins", "It is digested by lysosomes first"], answer: 1, why: "In constitutive secretion the Golgi packages albumin into vesicles that go straight to the membrane. This differs from regulated secretion (e.g. insulin from beta cells), where vesicles wait for a signal." },
  { band: "y11", q: "Why can a hepatocyte both take up glucose and release it, while it needs no ATP for either?", options: ["GLUT2 is a facilitated-diffusion uniporter with a high Km, so glucose moves down its concentration gradient in whichever direction applies", "GLUT2 is an ATP-driven pump", "Glucose diffuses through the lipid bilayer", "Insulin opens GLUT2 only when glucose is high"], answer: 0, why: "GLUT2 is passive and bidirectional, and its net flux follows the gradient between blood and cell. Insulin-regulated uptake is GLUT4 in muscle and fat cells." },
  { band: "y11", q: "The Na⁺/K⁺-ATPase is inhibited in an isotonic fluid. Which explains why the cell swells?", options: ["Water is actively pumped in", "Impermeant intracellular solutes plus leaking Na⁺ and Cl⁻ raise the internal osmolarity, so water enters by osmosis", "The membrane becomes permeable to proteins", "The nucleus enlarges"], answer: 1, why: "Cells hold impermeant anions and proteins. The pump–leak balance keeps Na⁺ out; without it ions accumulate, osmolarity inside rises and water follows." },
  { band: "y11", q: "Lysosome activity is low. Which sequence best describes the effect on energy supply?", options: ["Damaged mitochondria accumulate, ROS rise and damage more mitochondria, so ATP output falls", "ATP rises because mitochondria are not digested", "Glycolysis stops, so ATP is unchanged", "Nothing, since mitochondria repair themselves"], answer: 0, why: "Mitophagy removes damaged mitochondria. Without it they accumulate, ROS damage the healthy ones as well, and ATP production falls." },
];


/**
 * Live "why is this happening" narrative. Everything is read from the model's stores and fluxes, and each idea is
 * reported on its own: the blood-glucose level (an input), what glycogen is doing (synthesis / breakdown fluxes),
 * which way GLUT2 is carrying glucose (sign of the uptake flux), ATP, mitochondrial health, water movement and secretion.
 */
export function narrative(m, band) {
  const y7 = band === "y7-8", adv = band === "y11" || band === "y12", y12 = band === "y12";
  const on = m.on, F = m.flux || {}, out = [];
  const E = y7 ? "energy (ATP)" : "ATP";
  const f1 = (v) => (v ?? 0).toFixed(1);
  const pct = Math.round(m.vol * 100);
  const cap = (t) => t[0].toUpperCase() + t.slice(1);

  if (m.burst) {
    if (m.burstCause === "ion") {
      out.push(y7
        ? `<strong>The cell has burst!</strong> It could not keep salts out (the pumps were off or had no energy), so salts leaked in, water followed, and with no cell wall to hold it the membrane tore.`
        : `<strong>Lysis from failed ion regulation:</strong> the Na⁺/K⁺ pumps could not keep up with the leak of ions (${on.pumps ? "ATP was too low" : "pumps off"}), so internal osmolarity rose, water entered by osmosis and the cell passed about 160 % of its normal volume. This happened without any change to the fluid around it.${adv ? " (The lysis threshold is a teaching-scale value.)" : ""}`);
    } else {
      out.push(y7
        ? `<strong>The cell has burst!</strong> The water around it was much more dilute than the cell, so water kept flowing in. There is no cell wall to hold it, so the membrane tore. A plant cell in the same water would only go firm.`
        : `<strong>Lysis in a dilute solution:</strong> the surroundings were hypotonic, so water entered by osmosis until the cell passed about 160 % of its normal volume and the membrane ruptured. A plant cell in the same solution would become turgid instead, because its wall pushes back.${adv ? " (The lysis threshold is a teaching-scale value.)" : ""}`);
    }
    out.push(`All the cell's processes have stopped. Press <strong>Reset cell</strong> to start again.`);
    return out;
  }

  // ----- blood glucose (the input), glycogen (fluxes) and GLUT2 (direction of the uptake flux), reported separately -----
  const gb = m.bloodGlucose, up = F.uptake || 0, syn = F.synth || 0, brk = F.breakdown || 0;
  const cat = gb < 4.5 ? "low" : gb > 6 ? "high" : "in the normal range";
  const gly = brk > 0.03 ? (y7 ? "The cell is <strong>breaking down glycogen</strong> and releasing glucose." : `Glycogen is being <strong>broken down</strong> (glycogenolysis, ${f1(brk)} mM/s; ${m.glycogen.toFixed(0)} % left).`)
    : syn > 0.03 ? (y7 ? "The cell is <strong>storing glucose as glycogen</strong>." : `Glucose is being <strong>stored as glycogen</strong> (glycogenesis, ${f1(syn)} mM/s; ${m.glycogen.toFixed(0)} % full), which costs ATP.`)
    : m.glycogen < 2 && gb < 4.5 ? (y7 ? "The <strong>glycogen store is empty</strong>, so the liver cell can't top up the blood." : "<strong>Glycogen is used up</strong>, so the cell can no longer release glucose to support the blood.")
    : gb > 6 && m.glycogen > 90 ? (y7 ? "The glycogen store is nearly full, so little more is stored." : `The glycogen store is nearly full (${m.glycogen.toFixed(0)} %), so little more is being stored.`)
    : (y7 ? "Glycogen is staying about the same." : `Glycogen is steady (${m.glycogen.toFixed(0)} %): little is stored or released.`);
  const glut = !on.glut ? (y7 ? " The glucose doors are <strong>blocked</strong>, so no glucose can cross." : " <strong>GLUT2 is blocked</strong>, so glucose cannot cross the membrane either way.")
    : up > 0.03 ? (y7 ? " Glucose is moving <strong>into</strong> the cell." : ` GLUT2 is carrying glucose <strong>into</strong> the cell (net ${f1(up)} mM/s, down its concentration gradient).`)
    : up < -0.03 ? (y7 ? " Glucose is moving <strong>out</strong> into the blood." : ` GLUT2 is carrying glucose <strong>out</strong> into the blood (net ${f1(-up)} mM/s, because the cell's glucose is higher than the blood's).`)
    : (y7 ? " Glucose in and out is about balanced." : " GLUT2 net flux is about zero: cell and blood glucose are close to equal.");
  out.push(y7
    ? `Blood sugar is <strong>${cat}</strong> (${f1(gb)}). ${gly}${glut}`
    : `Blood glucose is <strong>${cat}</strong> (${f1(gb)} mM; the slider sets it). ${gly}${glut}${adv && (brk > 0.03 || syn > 0.03) ? ` In the body the signal is ${brk > 0.03 ? "glucagon" : "insulin"}; here the blood glucose level itself drives the switch.` : ""}${y12 && (brk > 0.03 || syn > 0.03) ? " In the body this is negative feedback (the response pushes blood glucose back towards normal); here blood glucose is a fixed input that you set." : ""}${adv && m.glycogen < 2 && gb < 4.5 ? " (A real liver would also make new glucose, gluconeogenesis, which is not modelled.)" : ""}`);

  // ----- ATP supply, from the actual ATP store and fluxes -----
  const aer = (F.resp || 0) + (F.fuel || 0), net = F.atpNet || 0;
  const trend = net < -0.25 ? " (falling)" : net > 0.25 ? " (rising)" : "";
  if (aer < 0.15 && on.mitochondrion === false) {
    out.push(y7 ? `<strong>Mitochondria are off.</strong> ${cap(E)} is at ${m.atp.toFixed(0)}${trend}, and only a trickle is being made.`
      : `<strong>Mitochondria off:</strong> only glycolysis in the cytosol makes ATP (a small amount). ATP is ${m.atp.toFixed(0)} %${trend}, so pumping, transcription, translation and secretion draw it down.`);
  } else if (m.atp < 15) {
    out.push(y7 ? `${cap(E)} is very low (${m.atp.toFixed(0)}), so everything that needs energy is slowing down.` : `ATP is very low (${m.atp.toFixed(0)} %): the Na⁺/K⁺ pumps, ribosomes and Golgi are all slowing.`);
  } else if (aer > 0.3) {
    out.push(y7 ? `<strong>Mitochondria</strong> use glucose and oxygen from the blood to make ${E}, and send carbon dioxide back out.`
      : m.atp > 80 ? `ATP is high (${m.atp.toFixed(0)} %), so respiration has slowed. It runs on demand.` : `Mitochondria make ATP from glucose and O₂ from the blood (${f1(F.resp)} units/s), plus a little from other fuels (ATP ${m.atp.toFixed(0)} %${trend}). CO₂ leaves into the blood.`);
  }

  // ----- mitochondrial health, from counts, ROS and the mitophagy flux -----
  const H = Math.round(m.mitoHealthy), D = Math.round(m.mitoDamaged), clr = F.mitophagy || 0;
  const isAre = D === 1 ? "is" : "are";
  if (D >= 3 && clr < 0.1 * D * 0.25) {
    out.push(y7 ? `Almost nothing is recycling the worn-out mitochondria, so they are piling up: ${D} ${isAre} damaged, and the cell is making less ${E}.`
      : `Mitophagy has almost stopped (${f1(clr)}/s${on.lysosome ? `; lysosome activity ${m.lysosome.toFixed(0)} %` : "; lysosomes off"}), so damaged mitochondria are accumulating (${D} of ${H + D})${adv ? `; ROS ${m.ros.toFixed(0)} %, and ROS damage still more mitochondria` : ""}. ATP ${m.atp.toFixed(0)} %.`);
  } else if (clr > 0.03) {
    out.push(y7 ? `Lysosomes are <strong>recycling worn-out mitochondria</strong> (the dull, swollen ones), and healthy ones divide to replace them.`
      : `Lysosomes are clearing damaged mitochondria (${adv ? "mitophagy, " : ""}${f1(clr)}/s); ${D} ${isAre} damaged now, and healthy ones divide to replace them.${adv ? ` ROS ${m.ros.toFixed(0)} %.` : ""}`);
  } else if (D <= 1) {
    out.push(y7 ? `Nearly all the mitochondria are healthy.` : `Nearly all the mitochondria are healthy (${H} of ${H + D}).${adv ? ` ROS ${m.ros.toFixed(0)} %.` : ""}`);
  } else {
    out.push(y7 ? `${D} mitochondria ${isAre} damaged and not much is being cleared away.` : `${D} mitochondria ${isAre} damaged and mitophagy is slow (${f1(clr)}/s).${adv ? ` ROS ${m.ros.toFixed(0)} %.` : ""}`);
  }
  if (clr < 0.01 && D < 3 && m.mitoDamaged < 3 && (on.lysosome === false || m.lysosome < 10)) out.push(y7 ? `Lysosomes are not working, so worn-out mitochondria will start to build up. Wait and watch.` : `No mitophagy is happening, so damaged mitochondria will accumulate over the next minute or two.`);

  // ----- water: the setting, the current direction (F.water) and the pump–leak balance, reported separately -----
  const w = F.water || 0, tol = 0.004, wDir = w > tol ? "in" : w < -tol ? "out" : "none";
  const cOut = m.cOut, cIn = m.cIn, near = Math.abs(cIn - cOut) < 0.05;
  const setting = cOut < 0.9 ? (y7 ? "The cell is in <strong>very dilute water</strong>." : `The surroundings are more dilute than normal (hypotonic, ${Math.round(cOut * 100)} % of normal osmolarity).`)
    : cOut > 1.1 ? (y7 ? "The cell is in <strong>salty water</strong>." : `The surroundings are more concentrated than normal (hypertonic, ${Math.round(cOut * 100)} % of normal osmolarity).`)
    : "";
  const move = wDir === "in" ? (y7 ? `Water is moving <strong>in</strong>${m.vol > 1.3 ? ", and the cell is close to bursting" : ""}.` : `Net water movement is <strong>in</strong> (${w.toFixed(2)}/s) because the inside is more concentrated (${cIn.toFixed(2)} vs ${cOut.toFixed(2)}); volume ${pct} %${m.vol > 1.35 ? ", close to the lysis point" : ""}.`)
    : wDir === "out" ? (y7 ? `Water is moving <strong>out</strong>, so the cell is shrinking.` : `Net water movement is <strong>out</strong> (${(-w).toFixed(2)}/s) because the outside is more concentrated (${cOut.toFixed(2)} vs ${cIn.toFixed(2)}); volume ${pct} %.`)
    : near ? (y7 ? `Water in and out is balanced, so the cell stays at ${pct} % of its normal size.` : `Inside and outside osmolarity match (${cIn.toFixed(2)} vs ${cOut.toFixed(2)}), so there is no net water movement and volume holds at ${pct} %.`)
    : (y7 ? "Water is barely moving." : `Net water movement is nearly zero (volume ${pct} %).`);
  const leaking = (F.pumpOut || 0) < (F.leak || 0) * 0.85;
  const pumpTxt = leaking ? (y7 ? " Salts are leaking in faster than the pumps remove them, so the cell will keep swelling." : ` Ions are leaking in faster than they are pumped out (${f1((F.pumpOut || 0) * 1000)} vs ${f1((F.leak || 0) * 1000)} units), so internal osmolarity is rising${on.pumps ? " (ATP is limiting the pumps)" : " (pumps off)"}.`)
    : (!y7 && near && cOut >= 0.9 && cOut <= 1.1 ? ` The Na⁺/K⁺ pumps (${f1(F.pump)} ATP/s) balance the leak of ions in${adv ? " (pump–leak)" : ""}.` : "");
  const shrinkNote = m.vol < 0.8 ? (y7 ? " It looks wrinkled." : adv ? " (Red blood cells show the spiky crenation seen in textbooks; here the membrane only wrinkles gently. Real cells also recover volume over time by regulatory ion uptake, which is not modelled.)" : " (Red blood cells show the spiky crenation seen in textbooks; here the membrane only wrinkles gently.)") : "";
  const plantNote = !y7 && cOut < 0.9 ? " A plant cell would become turgid, not burst." : !y7 && cOut > 1.1 ? " A plant cell would plasmolyse instead." : "";
  out.push(`${setting} ${move}${pumpTxt}${shrinkNote}${plantNote}`.trim());

  // ----- albumin secretion, from the pools and fluxes along the pathway -----
  const sec = F.secrete || 0;
  if ((F.transcribe || 0) < 0.05 && m.mrna < 3 && m.mrnaCyto < 3) out.push(y7 ? `No new instructions (mRNA) are being made and the old ones have broken down, so no new albumin is made.` : `Transcription is not making new mRNA and the existing mRNA has decayed (it is reused, but it does break down), so no new albumin is made.`);
  else if ((F.export || 0) < 0.05 && m.mrna > 30) out.push(`mRNA is <strong>piling up in the nucleus</strong> (${m.mrna.toFixed(0)} %): little is leaving through the nuclear pores. Ribosomes keep reading the mRNA already outside until it breaks down.`);
  else if ((F.translate || 0) < 0.1 && m.mrnaCyto > 5) out.push(`mRNA is reaching the cytoplasm but little translation is happening on the rough ER${m.atp < 20 ? " (ATP is low)" : ""}.`);
  else if ((F.toGolgi || 0) < 0.1 && m.erProtein > 30) out.push(`Albumin is <strong>piling up in the ER</strong> (${m.erProtein.toFixed(0)} %): little is being passed on to the Golgi.`);
  else if (sec < 0.15) out.push(y7 ? `Very little albumin is being made, because the cell has little ${E} or few instructions.` : `Albumin secretion has almost stalled (${f1(sec)}/s): ${m.atp < 20 ? "ATP is low" : m.mrnaCyto < 3 ? "little mRNA is reaching the ribosomes" : "little cargo is available"}.`);
  else out.push(y7
    ? `The cell is making <strong>albumin</strong> and posting it into the blood in vesicles (${m.secreted.toFixed(0)} delivered so far).`
    : `Albumin is made on the rough ER, packaged by the Golgi and released by exocytosis at about ${f1(sec)} units/s (${m.secreted.toFixed(0)} so far).${adv ? " It is secreted <strong>constitutively</strong>: vesicles are released as fast as albumin is made, with no store waiting for a signal." : ""} It costs ATP.`);
  return out;
}
