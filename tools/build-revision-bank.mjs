// Builds content/revision.json for the CellScape revision quiz.
//   node tools/build-revision-bank.mjs
// Deterministic: same inputs give byte-identical output.
//
// Pipeline
//  1. Load the science-defender question bank (Years 7-10 MCQs) and keep ONLY the items on the allow list below
//     (cells, organelles, microscopy, membranes, photosynthesis/respiration, enzymes, DNA, genes, inheritance, cell
//     division, specialised cells, immunity). Everything else is denied by omission.
//  2. Apply the science-check patches (wrong/outdated/loose claims fixed) and add the hand-written items that fill gaps
//     the source does not cover (enzymes, membrane transport, protein synthesis, mitosis, Year 11-12 Biology).
//  3. Drop near-identical stems.
//  4. Seeded shuffle, then rebalance so the correct answer sits in each position equally often.
//  5. Report (and optionally patch) the "longest option is the answer" bias.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const SRC = path.resolve(root, "../science-defender/js");
const OUT = path.join(root, "content/revision.json");
const SEED = 20261011;

// ---------------------------------------------------------------- source bank
const win = {}; win.window = win; vm.createContext(win);
for (const y of [7, 8, 9, 10]) vm.runInContext(fs.readFileSync(path.join(SRC, `questions-y${y}.js`), "utf8"), win);
const bank = win.QUESTION_BANK;
const src = (key) => {
  const [y, t, i] = key.split(".");
  const it = bank[y]?.[t]?.[+i];
  if (!it) throw new Error(`missing source item ${key}`);
  return it;
};
const bandOf = (y) => (+y <= 8 ? "y7-8" : "y9-10");

// ---------------------------------------------------------------- allow list
// [sourceId, topics, patch?]  patch = { q?, key?, d?: [3 distractors], why? }  (science fixes, marked FIX)
const KEEP = [
  // ---- Year 7 "Cells & Classification" (cell items only; classification, MRSGREN and adaptations denied)
  ["7.cells.14", ["cell-structure"]],
  ["7.cells.15", ["cell-structure", "microscopy"]],
  ["7.cells.16", ["cell-structure"]],
  ["7.cells.17", ["membrane", "cell-structure"], { // FIX: say "selectively permeable", the term students need
    key: "Controls what enters and leaves the cell; it is selectively permeable",
    why: "The cell membrane is a thin, flexible layer that is selectively permeable: it lets some substances through and keeps others out." }],
  ["7.cells.18", ["organelles", "cell-structure"]],
  ["7.cells.19", ["respiration", "organelles"]],
  ["7.cells.20", ["photosynthesis", "organelles"]],
  ["7.cells.21", ["cell-structure", "organelles"]],
  ["7.cells.22", ["organelles", "cell-structure"]],
  ["7.cells.23", ["respiration", "atp", "organelles"]],
  ["7.cells.24", ["respiration"]],
  ["7.cells.25", ["photosynthesis"]],
  ["7.cells.26", ["cell-structure"]],
  ["7.cells.27", ["organelles", "osmosis"]],
  ["7.cells.28", ["specialised-cells", "diffusion"]],
  ["7.cells.29", ["specialised-cells", "blood-transport"]],
  ["7.cells.30", ["cell-structure", "specialised-cells"]],
  ["7.cells.31", ["cell-structure", "specialised-cells"]],
  ["7.cells.32", ["specialised-cells", "gas-exchange", "plant-transport"]],
  ["7.cells.33", ["cell-structure", "microscopy"]],
  ["7.cells.34", ["microscopy"]],
  ["7.cells.35", ["microscopy", "cell-structure"]],
  ["7.cells.36", ["prokaryote-eukaryote", "microscopy"]],
  ["7.cells.38", ["photosynthesis", "respiration"]],
  ["7.cells.40", ["photosynthesis", "organelles"]],
  ["7.cells.41", ["specialised-cells"]],
  ["7.cells.45", ["cell-structure"]],
  ["7.cells.46", ["organelles", "cell-structure"]],
  ["7.cells.47", ["photosynthesis", "specialised-cells"]],
  ["7.cells.49", ["prokaryote-eukaryote", "cell-structure"]],
  ["7.cells.50", ["cell-structure", "organelles", "photosynthesis"]],
  ["7.cells.54", ["cell-structure", "specialised-cells"]],
  ["7.cells.55", ["specialised-cells"]],
  // ---- Year 8 "Living systems" / "Change"
  ["8.living.9", ["specialised-cells", "blood-transport"], { // FIX: the biconcave shape raises surface area to volume ratio; stem was loose
    q: "Which structural features help red blood cells carry oxygen efficiently?",
    key: "A biconcave disc shape and no nucleus, leaving room for haemoglobin",
    d: ["A very large nucleus", "Cilia on their surface", "Thick, rigid cell walls"],
    why: "Red blood cells are biconcave discs, which gives a large surface area for their volume, and they have no nucleus, so there is more room for haemoglobin to carry oxygen." }],
  ["8.living.10", ["specialised-cells", "gas-exchange"]],
  ["8.living.11", ["gas-exchange", "diffusion"]],
  ["8.living.12", ["specialised-cells", "diffusion"], { // FIX: removed the "250 square metres" figure (modern estimates are far smaller)
    why: "The inner surface of the small intestine is folded into villi, and each villus has microvilli. This greatly increases the surface area for absorbing nutrients." }],
  ["8.living.20", ["plant-transport"]],
  ["8.living.21", ["plant-transport"]],
  ["8.living.22", ["plant-transport", "specialised-cells"]],
  ["8.living.23", ["plant-transport", "gas-exchange"]],
  ["8.living.24", ["plant-transport"]],
  ["8.living.26", ["photosynthesis"]],
  ["8.change.48", ["photosynthesis"]],
  ["8.change.49", ["respiration"]],
  // ---- Year 9 "Diseases" (cell-level immunity and pathogens only; homeostasis and epidemiology denied)
  ["9.diseases.14", ["immunity", "prokaryote-eukaryote"], { // FIX: "non-living" is contested; say what is testable (non-cellular, needs a host cell)
    q: "Which type of pathogen is not made of cells and can only reproduce inside a host cell?",
    why: "Viruses are not cellular. They can only reproduce by entering a living host cell and using its machinery. Bacteria, fungi and protozoa are all made of cells." }],
  ["9.diseases.15", ["immunity", "prokaryote-eukaryote"]],
  ["9.diseases.20", ["immunity"]],
  ["9.diseases.21", ["immunity"]],
  ["9.diseases.22", ["immunity"], { // FIX: antibodies are secreted by plasma cells (activated B-cells), not by resting B-cells
    key: "A Y-shaped protein made by activated B-cells (plasma cells) that binds one specific antigen",
    why: "Antibodies are Y-shaped proteins made by plasma cells (activated B-cells). Each type binds to one specific antigen on a pathogen and marks it for destruction." }],
  ["9.diseases.23", ["immunity"]],
  ["9.diseases.24", ["immunity", "biotechnology"]],
  ["9.diseases.25", ["immunity"]],
  ["9.diseases.26", ["immunity", "prokaryote-eukaryote"]],
  ["9.diseases.32", ["immunity"]],
  ["9.diseases.33", ["immunity", "enzymes"]],
  ["9.diseases.34", ["immunity"]],
  ["9.diseases.39", ["immunity", "biotechnology"]],
  ["9.diseases.40", ["immunity"], { // FIX: memory B-cells respond and make antibodies; they do not "produce them directly" on their own
    key: "Memory B-cells from the first exposure respond rapidly and make specific antibodies",
    why: "Memory B-cells formed during the first infection persist in the body. On re-exposure they divide quickly and make plasma cells, so a faster and larger antibody response follows." }],
  ["9.diseases.41", ["immunity", "mutation"]],
  ["9.diseases.43", ["immunity", "specialised-cells"]],
  ["9.diseases.44", ["immunity", "specialised-cells"]],
  ["9.diseases.46", ["immunity", "biotechnology"]],
  // ---- Year 10 "Genetics" (evolution and the history-of-science stems denied; DNA, genes, inheritance kept)
  ["10.genetics.0", ["dna-structure", "genes"]],
  ["10.genetics.1", ["dna-structure"]],
  ["10.genetics.2", ["dna-structure"]],
  ["10.genetics.3", ["genes", "dna-structure"]],
  ["10.genetics.4", ["inheritance", "cell-cycle"]],
  ["10.genetics.5", ["inheritance", "meiosis"]],
  ["10.genetics.6", ["dna-structure", "chromatin"]],
  ["10.genetics.7", ["genes"]],
  ["10.genetics.8", ["dna-structure"]],
  ["10.genetics.9", ["dna-structure", "cell-cycle"]],
  ["10.genetics.10", ["dna-structure"]],
  ["10.genetics.11", ["dna-structure"]],
  ["10.genetics.13", ["inheritance", "cell-cycle"], { // FIX: offspring are identical barring mutation
    key: "Genetically identical to the parent (clones), apart from rare mutations",
    why: "In asexual reproduction a single parent produces offspring by mitosis, so they are genetically identical to the parent. The only differences come from rare mutations." }],
  ["10.genetics.14", ["meiosis", "inheritance"]],
  ["10.genetics.15", ["inheritance", "meiosis"]],
  ["10.genetics.16", ["inheritance", "genes"]],
  ["10.genetics.17", ["inheritance", "genes"]],
  ["10.genetics.18", ["dna-structure"]],
  ["10.genetics.19", ["mutation"]],
  ["10.genetics.20", ["mutation"]],
  ["10.genetics.21", ["mutation", "dna-structure"]],
  ["10.genetics.22", ["mutation", "protein-folding", "specialised-cells"]],
  ["10.genetics.23", ["mutation", "protein-synthesis"]],
  ["10.genetics.24", ["inheritance"], { // FIX: eye colour is polygenic; flag that this is a simplified model
    why: "If both parents are heterozygous (Bb), there is a 25% chance of a child with bb. This uses a simple one-gene model. Real eye colour is controlled by several genes." }],
  ["10.genetics.25", ["inheritance"]],
  ["10.genetics.26", ["inheritance"]],
  ["10.genetics.27", ["inheritance", "genes"]],
  ["10.genetics.28", ["inheritance"]],
  ["10.genetics.29", ["inheritance"]],
  ["10.genetics.30", ["inheritance", "meiosis"]],
  ["10.genetics.31", ["biotechnology", "genes"]],
  ["10.genetics.32", ["biotechnology", "dna-structure"]],
  ["10.genetics.33", ["biotechnology", "genes"]],
  ["10.genetics.34", ["genes", "inheritance"]],
  ["10.genetics.50", ["cell-structure", "biotechnology"]],
  ["10.genetics.51", ["cell-structure", "biotechnology"]],
  ["10.genetics.53", ["inheritance"]],
  ["10.genetics.54", ["inheritance", "genes"]],
  ["10.genetics.55", ["genes", "environment", "epigenetics"]],
  ["10.genetics.56", ["meiosis", "inheritance"]],
  ["10.waves.12", ["mutation", "dna-structure"]],
];

// Deliberately denied (reason kept here for the next editor):
//  7.cells.0-13,37,42-44,48,51-53  classification, MRSGREN, adaptations (not cell scope)
//  7.cells.39   muddled key ("flexible enough ... homeostatic systems")
//  8.living.0/1/50/49  duplicates of 7.cells.54/30/47/32     8.change.23-26  duplicates of 7.cells.19/20/24/25
//  8.living.2-8,13-19,25,27-54  organ systems, ecology        9.diseases.0-13,16-19,27-31,35-38,42,45,47-54  homeostasis, epidemiology, culture
//  9.diseases.47 duplicate of .25     10.genetics.12 (Nobel history)  10.genetics.35-49,52  ethics, evolution, fossils
//  9.sustainability.29  reforestation (ecology)   8.periodic / 10.reactions  atomic and nuclear physics, not cells

// ---------------------------------------------------------------- hand-written items (fill gaps; key first, then 3 distractors)
const A = (band, topics, q, key, d, why) => ({ band, topics, q, key, d, why });
const AUTHORED = [
  // ---- Years 7-8
  A("y7-8", ["diffusion", "membrane"], "What is diffusion?",
    "The net movement of particles from where they are more concentrated to where they are less concentrated",
    ["The movement of particles from low to high concentration", "Particles being pushed across a membrane using energy", "The movement of water only, through a membrane"],
    "Diffusion is passive. Particles spread out from a region of higher concentration to a region of lower concentration, and the cell uses no energy for it."),
  A("y7-8", ["osmosis", "plant-transport"], "A slice of potato is left in very salty water for an hour. What happens to it?",
    "It loses water by osmosis and becomes soft and smaller",
    ["It gains water and becomes firmer", "It stays the same size because the cell walls block water", "It dissolves completely"],
    "The salty water has a lower water concentration than the potato cells, so water moves out of the cells by osmosis and the slice goes limp."),
  A("y7-8", ["enzymes"], "What is an enzyme?",
    "A protein that speeds up a chemical reaction in cells and is not used up",
    ["A sugar that stores energy for the cell", "A white blood cell that fights infection", "A waste gas made when cells respire"],
    "Enzymes are proteins that act as biological catalysts. They speed up reactions and can be used again and again."),
  A("y7-8", ["mitosis", "cell-cycle"], "What is the main job of mitosis in a multicellular organism?",
    "Making new body cells for growth and repair",
    ["Making sex cells", "Releasing energy from glucose", "Halving the number of chromosomes"],
    "Mitosis produces two genetically identical body cells. Organisms use it to grow and to replace damaged or worn-out cells."),
  A("y7-8", ["specialised-cells", "respiration", "organelles"], "Why does a sperm cell have many mitochondria packed behind its head?",
    "They release the energy its tail needs for swimming",
    ["They store the father's DNA", "They help it make its own food from light", "They give the head its streamlined shape"],
    "Swimming needs a lot of energy. The mitochondria carry out aerobic respiration, which supplies ATP to the tail."),
  A("y7-8", ["photosynthesis", "organelles"], "Why do most leaves look green?",
    "Chlorophyll reflects green light and absorbs mostly red and blue light",
    ["Chlorophyll absorbs green light most strongly", "The cell wall contains a green dye", "Mitochondria are green"],
    "Chlorophyll absorbs mostly red and blue light for photosynthesis. Green light is reflected, so the leaf looks green."),
  A("y7-8", ["respiration", "photosynthesis", "organelles"], "Do plant cells carry out respiration?",
    "Yes, all the time, in the light and in the dark",
    ["Only at night, when there is no light", "No, plants only photosynthesise", "Only the root cells respire"],
    "Plant cells respire all the time to release energy from glucose. In daylight they also photosynthesise, so respiration is hidden by the larger oxygen output."),
  A("y7-8", ["diffusion", "respiration"], "Oxygen moves into a respiring cell by diffusion. Why does it move in?",
    "The cell uses oxygen up, so there is less inside than outside",
    ["Cells pump oxygen in using ATP", "Oxygen is attracted to the nucleus", "The membrane has no barrier to oxygen"],
    "Respiration uses oxygen, so its concentration inside the cell stays lower than outside. Oxygen diffuses down this concentration gradient."),
  // ---- Years 9-10
  A("y9-10", ["enzymes", "protein-folding"], "A high temperature stops an enzyme working. What best explains this?",
    "The enzyme changes shape (denatures), so the substrate no longer fits its active site",
    ["The substrate becomes too large to react", "The enzyme is used up by the reaction", "The reaction makes too much energy"],
    "Heat breaks the bonds that hold the enzyme in shape. The active site is distorted, so the substrate can no longer bind. Extreme pH does the same."),
  A("y9-10", ["enzymes"], "What does the lock-and-key model say about enzymes?",
    "The active site matches the shape of its own substrate",
    ["Every enzyme works on every substrate", "The substrate is the part that changes shape", "The enzyme is destroyed after one reaction"],
    "Each enzyme has an active site with a shape that fits a specific substrate, which is why enzymes are specific. The enzyme is released unchanged."),
  A("y9-10", ["enzymes"], "How does the rate of an enzyme-controlled reaction change as temperature rises from low values?",
    "It rises to an optimum, then falls quickly as the enzyme denatures",
    ["It rises steadily at every temperature", "It stays the same at all temperatures", "It falls from the start"],
    "Warmer particles collide more often with more energy, so the rate rises. Past the optimum the enzyme loses its shape and the rate drops sharply."),
  A("y9-10", ["membrane"], "The cell membrane is described as selectively permeable. What does that mean?",
    "It lets some substances pass and blocks others",
    ["It lets every substance through", "It blocks every substance, including water", "It lets only large molecules through"],
    "Selective permeability means the membrane controls what crosses. Small non-polar molecules and water cross easily, but ions and large molecules need help or are kept out."),
  A("y9-10", ["osmosis", "membrane"], "Osmosis is the movement of which substance, and in which direction?",
    "Water, from a dilute solution to a more concentrated solution, across a selectively permeable membrane",
    ["Solute, from low to high concentration, using ATP", "Water, from a concentrated solution to a dilute one", "Any particle, down its gradient, through a gap in the cell wall"],
    "Osmosis is the net movement of water across a selectively permeable membrane from where water is more concentrated (the more dilute solution) to where it is less concentrated."),
  A("y9-10", ["osmosis", "specialised-cells"], "A red blood cell is placed in pure water. What happens?",
    "Water enters by osmosis and the cell can burst",
    ["Water leaves and the cell shrinks", "Nothing happens because the membrane blocks water", "The cell wall keeps its size the same"],
    "Pure water has a higher water concentration than the cytoplasm, so water enters. Animal cells have no cell wall, so the cell can swell and burst."),
  A("y9-10", ["osmosis", "organelles", "plant-transport"], "A plant cell placed in pure water becomes firm (turgid) but does not burst. Why?",
    "The cell wall resists the pressure of the water inside",
    ["The membrane stops any water entering", "The nucleus pumps the water out", "Chloroplasts turn the extra water into starch"],
    "Water enters the vacuole by osmosis and pushes the membrane against the strong cellulose wall. The wall pushes back, which keeps the cell firm instead of bursting."),
  A("y9-10", ["active-transport", "atp"], "How is active transport different from diffusion?",
    "It moves substances against their concentration gradient, using energy from ATP",
    ["It moves substances down their gradient using no energy", "It moves only water", "It happens only in plant cells"],
    "Active transport uses carrier proteins and ATP to move substances from low to high concentration. Diffusion is passive and moves them the other way."),
  A("y9-10", ["atp", "respiration"], "What is the main job of ATP in a cell?",
    "Carrying energy to where the cell can use it",
    ["Storing the genetic code", "Building the cell membrane", "Speeding up reactions as an enzyme"],
    "ATP is the cell's energy carrier. Respiration uses the energy in glucose to make ATP, and ATP then powers jobs such as active transport and muscle contraction."),
  A("y9-10", ["protein-synthesis", "genes"], "Which sequence shows the flow of information when a cell makes a protein?",
    "DNA to mRNA to protein",
    ["Protein to mRNA to DNA", "mRNA to DNA to protein", "DNA to protein to mRNA"],
    "A gene in DNA is transcribed into mRNA. The mRNA is then translated into a chain of amino acids that folds into a protein."),
  A("y9-10", ["protein-synthesis"], "What happens during transcription?",
    "A gene's DNA sequence is copied into messenger RNA",
    ["Amino acids are joined into a chain at a ribosome", "All the cell's DNA is copied before division", "A finished protein is moved out of the cell"],
    "In transcription, RNA polymerase reads one strand of a gene and builds a matching mRNA copy. In eukaryotes this happens in the nucleus."),
  A("y9-10", ["protein-synthesis", "organelles"], "Where does translation take place?",
    "At a ribosome, where mRNA is read and amino acids are joined",
    ["In the nucleus, on the DNA", "Only in the mitochondria", "In the cell wall"],
    "Ribosomes read the mRNA and join amino acids in the order it specifies. The ribosome can be free in the cytoplasm or attached to the rough ER."),
  A("y9-10", ["protein-synthesis", "genes"], "What is a codon?",
    "A group of three bases in mRNA that codes for one amino acid",
    ["A single amino acid in a protein", "A section of a ribosome", "A group of four bases that makes a whole gene"],
    "The mRNA is read three bases at a time. Each triplet, called a codon, specifies one amino acid or a stop signal."),
  A("y9-10", ["mutation", "protein-folding", "protein-synthesis"], "How can a single base change in a gene affect a protein?",
    "It can change one amino acid, which may alter how the protein folds and works",
    ["It always stops the protein being made", "It changes every amino acid in the protein", "It cannot affect a protein, since proteins are not made from genes"],
    "A substitution can change one codon and so one amino acid. Sometimes the protein works the same, and sometimes its shape, and so its job, changes (as in sickle cell anaemia)."),
  A("y9-10", ["mitosis", "cell-cycle"], "Which is the correct order of the stages of mitosis?",
    "Prophase, metaphase, anaphase, telophase",
    ["Metaphase, prophase, telophase, anaphase", "Prophase, anaphase, metaphase, telophase", "Telophase, anaphase, metaphase, prophase"],
    "Chromosomes condense (prophase), line up in the middle (metaphase), sister chromatids are pulled apart (anaphase), then two nuclei form (telophase)."),
  A("y9-10", ["mitosis", "cell-cycle", "inheritance"], "A human body cell with 46 chromosomes divides by mitosis. How many chromosomes are in each daughter cell?",
    "46",
    ["23", "92", "44"],
    "Mitosis makes two genetically identical cells, each with the same chromosome number as the parent cell."),
  A("y9-10", ["cell-cycle", "dna-structure", "mitosis"], "Why is the cell's DNA copied before mitosis?",
    "So each daughter cell gets a full set of genetic information",
    ["So the nucleus can be removed", "So each daughter cell gets half of the DNA", "So the cell can make more mitochondria"],
    "DNA replicates during the S phase of the cell cycle. Each chromosome then has two identical chromatids, which are shared equally between the daughter cells."),
  A("y9-10", ["cell-cycle", "mutation"], "What can happen when the controls on cell division fail?",
    "Cells divide without control and may form a tumour",
    ["Cells stop respiring", "Cells turn into gametes", "DNA is changed into protein"],
    "Cancer begins when mutations disable the controls on the cell cycle. The cell keeps dividing, and the mass of cells that results is a tumour."),
  A("y9-10", ["meiosis", "mitosis", "inheritance"], "How does meiosis differ from mitosis?",
    "It makes four genetically different cells with half the chromosomes",
    ["It makes two identical cells with the full chromosome number", "It makes cells for growth and repair", "It happens only in plants"],
    "Meiosis happens in the reproductive organs. Two divisions follow one round of DNA replication, giving four different gametes with half the chromosomes."),
  A("y9-10", ["photosynthesis"], "Which three factors can limit the rate of photosynthesis?",
    "Light intensity, carbon dioxide concentration and temperature",
    ["Only the amount of oxygen in the air", "Only the colour of the leaf", "The number of mitochondria only"],
    "Photosynthesis needs light, carbon dioxide and a suitable temperature for its enzymes. The factor in shortest supply sets the rate."),
  A("y9-10", ["respiration", "atp", "specialised-cells"], "When muscle cells respire without enough oxygen, what is made?",
    "Lactic acid and a small amount of ATP",
    ["Ethanol and carbon dioxide", "Glucose and oxygen", "Carbon dioxide and water, with a large amount of ATP"],
    "Without oxygen, glucose is only partly broken down to lactic acid. This releases far less energy than aerobic respiration."),
  A("y9-10", ["microscopy"], "A cell is 50 micrometres long. Its drawing is 5 cm long. What is the magnification?",
    "x1000",
    ["x100", "x10 000", "x10"],
    "Convert to the same unit: 5 cm = 50 000 micrometres. Magnification = image size divided by real size = 50 000 / 50 = 1000."),
  A("y9-10", ["cell-structure", "diffusion", "membrane"], "Why can't a single cell grow very large?",
    "Its volume grows faster than its surface area, so exchange cannot supply the whole cell",
    ["It would run out of room for the nucleus", "Its membrane would become too thick to cross", "Large cells cannot contain enough DNA"],
    "Materials enter and leave through the membrane (surface area), but the cell's needs depend on its volume. A large cell has a small surface area to volume ratio, so it cannot exchange fast enough."),
  A("y9-10", ["prokaryote-eukaryote", "cell-structure"], "Which feature is found in a bacterial cell but not in an animal cell?",
    "A cell wall and DNA that is not enclosed in a nucleus",
    ["Ribosomes", "A cell membrane", "Mitochondria"],
    "Bacteria are prokaryotes. Their DNA lies free in the cytoplasm, and most have a cell wall. Animal cells have a nucleus and no wall, and both cell types have ribosomes and a membrane."),
  // ---- Year 11 Biology
  A("y11", ["respiration", "atp", "membrane", "enzymes"], "In a mitochondrion, what drives ATP synthase to make ATP?",
    "Protons flowing back across the inner membrane down their gradient",
    ["Oxygen binding directly to the enzyme", "Glucose splitting into two pyruvate molecules", "Light absorbed by the enzyme"],
    "The electron transport chain pumps protons into the intermembrane space. They flow back through ATP synthase, and that flow powers the joining of ADP and phosphate."),
  A("y11", ["respiration", "membrane", "organelles"], "Where does the electron transport chain of aerobic respiration operate in a eukaryotic cell?",
    "On the inner mitochondrial membrane",
    ["In the cytoplasm", "On the outer mitochondrial membrane", "In the nucleus"],
    "The folded cristae of the inner membrane carry the electron transport chain and ATP synthase, which gives a large surface area for ATP production."),
  A("y11", ["respiration"], "What is the role of oxygen in aerobic respiration?",
    "It is the final electron acceptor and forms water",
    ["It is split to release carbon dioxide", "It is the molecule that glucose is built from", "It is the energy store made by the cell"],
    "Oxygen accepts electrons at the end of the electron transport chain and combines with protons to form water. Without it the chain backs up and ATP production falls."),
  A("y11", ["respiration", "atp"], "Which stage of aerobic respiration makes the most ATP for each glucose molecule?",
    "Oxidative phosphorylation, the electron transport chain with ATP synthase",
    ["Glycolysis", "The Krebs cycle", "Fermentation"],
    "Glycolysis and the Krebs cycle each make only a few ATP directly. Most of the ATP, roughly 26 to 28 of about 30 per glucose, comes from oxidative phosphorylation."),
  A("y11", ["photosynthesis", "organelles", "membrane"], "Where in a chloroplast do the light-dependent reactions take place?",
    "In the thylakoid membranes",
    ["In the stroma", "In the outer membrane", "In the cell wall"],
    "Chlorophyll and the electron transport chain sit in the thylakoid membranes of the grana. The sugar-making reactions take place in the stroma."),
  A("y11", ["photosynthesis", "atp"], "What does the Calvin cycle (light-independent stage) do?",
    "Uses ATP and NADPH to turn carbon dioxide into sugar in the stroma",
    ["Splits water to release oxygen", "Absorbs light with chlorophyll", "Makes ATP in the mitochondria"],
    "The light-dependent reactions supply ATP and NADPH. The Calvin cycle uses them to fix carbon dioxide into sugars in the stroma."),
  A("y11", ["photosynthesis"], "Where does the oxygen released in photosynthesis come from?",
    "The splitting of water in the light-dependent reactions",
    ["The carbon dioxide that is taken in", "The breakdown of glucose in the stroma", "The ATP that is made"],
    "Photolysis splits water, releasing electrons, protons and oxygen. The carbon from carbon dioxide ends up in glucose, not in the oxygen."),
  A("y11", ["photosynthesis", "respiration"], "What is the light compensation point of a plant?",
    "The light intensity at which photosynthesis matches respiration, so net gas exchange is zero",
    ["The light intensity at which photosynthesis first starts", "The light intensity that gives the highest photosynthesis rate", "The light intensity at which respiration stops"],
    "Below this point the plant respires more than it photosynthesises, so it takes in oxygen and releases carbon dioxide. Above it there is a net oxygen output."),
  A("y11", ["photosynthesis", "respiration", "specialised-cells"], "Which pair of features is typical of a shade leaf compared with a sun leaf?",
    "More chlorophyll per chloroplast and a lower light compensation point",
    ["A thicker palisade layer and a higher light-saturation point", "Fewer grana and a higher respiration rate", "A thicker waxy cuticle and a higher compensation point"],
    "Shade leaves capture scarce light with larger grana and more chlorophyll, and respire more slowly. They break even at low light but saturate early."),
  A("y11", ["enzymes", "protein-folding"], "How does a competitive inhibitor reduce enzyme activity?",
    "It binds to the active site and blocks the substrate",
    ["It destroys the substrate", "It raises the temperature of the reaction", "It moves the enzyme to the nucleus"],
    "A competitive inhibitor resembles the substrate and occupies the active site. Adding more substrate can overcome it, because the substrate then competes better."),
  A("y11", ["enzymes"], "How do enzymes speed up reactions?",
    "By lowering the activation energy",
    ["By supplying extra energy as ATP", "By changing which products form", "By raising the temperature of the cell"],
    "The enzyme holds the substrate in a favourable position and stabilises the transition state, so less energy is needed to start the reaction."),
  A("y11", ["membrane"], "What is the main structure of a cell membrane in the fluid mosaic model?",
    "A phospholipid bilayer with proteins embedded in it",
    ["A single layer of protein coated in lipid", "A rigid layer of cellulose", "A double layer of DNA"],
    "Phospholipids form a bilayer that can move sideways (fluid). Proteins are scattered through it like tiles in a mosaic, acting as channels, carriers and receptors."),
  A("y11", ["membrane"], "Why do phospholipids arrange themselves into a bilayer in water?",
    "Their hydrophilic heads face the water and their hydrophobic tails face inwards",
    ["Their hydrophobic heads face the water", "DNA holds them in two rows", "Every part is attracted to water, so they pack in two rows"],
    "Each phospholipid has a polar, water-loving head and non-polar, water-avoiding tails. In water the tails tuck together inside, and the heads face the water on both sides."),
  A("y11", ["membrane", "diffusion"], "Which molecule crosses the phospholipid bilayer most easily by simple diffusion?",
    "Oxygen, a small non-polar molecule",
    ["Sodium ions", "Glucose, a large polar molecule", "A protein"],
    "The hydrophobic core lets small non-polar molecules such as oxygen pass. Ions and large polar molecules need channel or carrier proteins."),
  A("y11", ["membrane", "diffusion", "active-transport"], "How does facilitated diffusion differ from active transport?",
    "It uses channel or carrier proteins and moves substances down their gradient without ATP",
    ["It uses ATP to move substances up their gradient", "It moves only water", "It moves substances straight through the lipid bilayer"],
    "Both use membrane proteins. Facilitated diffusion is passive and follows the gradient, while active transport uses energy to move substances against it."),
  A("y11", ["osmosis", "specialised-cells"], "An animal cell is placed in a hypotonic solution. What happens?",
    "Water enters and the cell may lyse",
    ["Water leaves and the cell shrinks", "Nothing changes", "Solutes leave until the concentrations match"],
    "A hypotonic solution has a lower solute concentration than the cell. Water moves in by osmosis, and with no cell wall the cell can burst (lyse)."),
  A("y11", ["active-transport", "atp", "membrane"], "What does the sodium-potassium pump do?",
    "Moves 3 Na+ out and 2 K+ in using ATP",
    ["Moves 2 Na+ out and 3 K+ in without energy", "Moves Na+ and K+ by facilitated diffusion", "Moves water by osmosis"],
    "The pump is a carrier protein that uses one ATP per cycle. It keeps sodium low and potassium high inside the cell, against both gradients."),
  A("y11", ["protein-synthesis", "genes"], "In eukaryotes, which part of the pre-mRNA is removed before translation?",
    "Introns",
    ["Exons", "Codons", "Ribosomes"],
    "Splicing removes the non-coding introns and joins the coding exons. The mature mRNA then leaves the nucleus."),
  A("y11", ["protein-synthesis"], "What is the job of tRNA?",
    "To bring a specific amino acid to the ribosome, matching its anticodon to an mRNA codon",
    ["To carry DNA to the ribosome", "To join amino acids using peptide bonds directly", "To copy genes in the nucleus"],
    "Each tRNA carries one amino acid. Its anticodon pairs with the matching codon on the mRNA, so amino acids are added in the order the gene specifies."),
  A("y11", ["dna-structure", "cell-cycle"], "Why is DNA replication called semi-conservative?",
    "Each new DNA molecule has one original strand and one new strand",
    ["Both strands of each new molecule are new", "The original molecule stays whole and a copy is made", "Only half of the DNA gets copied"],
    "The two strands separate, and each acts as a template for a new strand. The result is two molecules, each with one old and one new strand."),
  A("y11", ["dna-structure", "enzymes", "cell-cycle"], "Which enzyme adds nucleotides to build the new DNA strand during replication?",
    "DNA polymerase",
    ["Helicase", "Amylase", "Catalase"],
    "DNA polymerase adds nucleotides to the 3' end of the growing strand, following the template. Helicase only unwinds the double helix."),
  A("y11", ["meiosis", "inheritance"], "Which events in meiosis create genetic variation?",
    "Crossing over and the independent assortment of chromosomes",
    ["DNA replication and cytokinesis", "Chromosome condensation and spindle formation", "Breakdown of the nuclear envelope"],
    "Crossing over swaps segments between homologous chromosomes, and independent assortment sends each pair to the gametes at random. Together they give many different gametes."),
  A("y11", ["inheritance", "genes"], "Why are X-linked recessive conditions more common in males?",
    "Males have only one X chromosome, so a single recessive allele is expressed",
    ["Males have two X chromosomes", "The Y chromosome carries the dominant allele", "Recessive alleles are inherited only from fathers"],
    "A male has one X and one Y, so there is no second allele on the Y to mask the recessive one. Females need two copies to be affected."),
  A("y11", ["mutation", "protein-synthesis"], "What is a frameshift mutation?",
    "An insertion or deletion of bases that is not a multiple of three",
    ["A substitution that gives a stop codon", "A change in the number of whole chromosomes", "A switch of one amino acid for a similar one"],
    "Inserting or deleting one or two bases shifts the reading frame. Every codon after the change is altered, which usually produces a non-functional protein."),
  A("y11", ["cell-cycle", "dna-structure"], "In which phase of the cell cycle is DNA replicated?",
    "S phase",
    ["G1 phase", "M phase", "Cytokinesis"],
    "In interphase, G1 is growth, S is DNA synthesis and G2 is preparation for division. M phase is mitosis and cytokinesis."),
  A("y11", ["microscopy", "organelles"], "Which microscope can show the internal structure of organelles such as mitochondria?",
    "A transmission electron microscope",
    ["A hand lens", "A dissecting microscope", "A school light microscope"],
    "Electron microscopes have much higher resolution than light microscopes. A transmission electron microscope shows the cristae inside mitochondria."),
  A("y11", ["microscopy"], "What is resolution in microscopy?",
    "The smallest distance at which two points can still be seen as separate",
    ["How many times an image is enlarged", "How bright the image is", "How thick the specimen is"],
    "Magnification makes the image bigger, but resolution decides how much detail it shows. Beyond the resolution limit, more magnification only makes a larger blur."),
  A("y11", ["biotechnology", "dna-structure"], "Why is Taq polymerase used in PCR?",
    "It is heat stable, so it keeps working through repeated cycles of heating",
    ["It cuts DNA at specific sequences", "It unwinds DNA inside the cell", "It joins DNA from two different species"],
    "Each PCR cycle heats the mixture to separate the strands. Taq polymerase comes from a heat-loving bacterium and is not denatured by this."),
  A("y11", ["immunity", "specialised-cells"], "Which type of cell presents antigens to helper T-cells to start the adaptive immune response?",
    "An antigen-presenting cell such as a dendritic cell or macrophage",
    ["A red blood cell", "A platelet", "A neuron"],
    "Antigen-presenting cells engulf pathogens and display fragments on their surface. Helper T-cells recognise these, and then activate B-cells and killer T-cells."),
  // ---- Year 12 Biology
  A("y12", ["epigenetics", "genes", "chromatin"], "How does methylation of a gene's promoter usually affect that gene?",
    "It lowers transcription of the gene",
    ["It changes the DNA base sequence", "It raises transcription of the gene", "It deletes the gene from the genome"],
    "Methyl groups are added to cytosine bases without changing the sequence. This usually blocks transcription factors and recruits proteins that compact the chromatin."),
  A("y12", ["epigenetics", "chromatin", "genes"], "What effect does histone acetylation generally have?",
    "It loosens chromatin so genes can be transcribed",
    ["It tightens chromatin and silences genes", "It changes the DNA base sequence", "It cuts the DNA into fragments"],
    "Acetyl groups reduce the positive charge on histones, so they hold DNA less tightly. The more open chromatin is easier for transcription machinery to reach."),
  A("y12", ["x-inactivation", "epigenetics"], "What does X-inactivation do in a female mammal?",
    "It silences most of one X chromosome in each cell, which forms a Barr body",
    ["It deletes one X chromosome from every cell", "It makes both X chromosomes fully active", "It silences the same X in every cell of the body"],
    "In each cell one X is chosen at random and compacted into a Barr body. This equalises X-linked gene dosage with males, and means the pattern differs between cells (as in tortoiseshell cats)."),
  A("y12", ["immunity", "specialised-cells"], "How do killer (cytotoxic) T-cells recognise a virus-infected cell?",
    "By viral antigens shown on MHC class I molecules on the cell's surface",
    ["By free antibodies attached to the cell", "By the shape of its cell wall", "By the number of its mitochondria"],
    "Infected cells display viral fragments on MHC class I. A killer T-cell with a matching receptor binds, then releases molecules that make the cell self-destruct."),
];

// ---------------------------------------------------------------- build
const TOPICS = new Set([
  "cell-structure", "organelles", "membrane", "microscopy", "prokaryote-eukaryote", "respiration", "photosynthesis", "specialised-cells",
  "gas-exchange", "blood-transport", "plant-transport", "dna-structure", "genes", "inheritance", "meiosis", "mitosis", "mutation",
  "biotechnology", "cell-cycle", "immunity", "diffusion", "osmosis", "active-transport", "atp", "enzymes", "protein-synthesis",
  "protein-folding", "epigenetics", "chromatin", "x-inactivation", "environment"]);

function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = mulberry32(SEED);
const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const clean = (s) => String(s).replace(/\s+/g, " ").trim();
const norm = (s) => s.replace(/\bx(\d)/g, "×$1");

const raw = [];
for (const [id, topics, patch = {}] of KEEP) {
  const s = src(id);
  const key = clean(patch.key ?? s.o[s.a]);
  const d = patch.d ?? s.o.filter((_, i) => i !== s.a);
  raw.push({ srcId: id, band: bandOf(id.split(".")[0]), topics, q: clean(patch.q ?? s.q), key, d: d.map(clean), why: clean(patch.why ?? s.exp ?? ""), patched: !!Object.keys(patch).length });
}
for (const a of AUTHORED) raw.push({ srcId: null, band: a.band, topics: a.topics, q: clean(a.q), key: clean(a.key), d: a.d.map(clean), why: clean(a.why), patched: false });

// ---- optional per-item option rewrites to remove the "longest option is correct" tell (applied by stem match)
const LEN = {
  // keyed by the stem; { key?, d? } replace the correct option and/or the distractors (meaning of the key is unchanged)
  "What is the function of the cell membrane?": { key: "Controls what enters and leaves the cell", d: ["Site of aerobic respiration in the cell", "Provides rigid shape and support for the cell", "Holds the DNA that controls the cell"] },
  "What is the function of the nucleus in a cell?": { key: "Holds the DNA and directs cell activities", d: ["Site of photosynthesis in plant cells", "Stores water and dissolved wastes", "Releases energy for the cell by respiration"] },
  "Which structure is found in plant cells but NOT in animal cells?": { key: "A cellulose cell wall", d: ["Mitochondria for respiration", "A nucleus containing DNA", "A cell membrane around the cytoplasm"] },
  "What is the role of mitochondria in a cell?": { key: "They release energy (ATP) by respiration", d: ["They store water for the cell to use", "They make glucose from sunlight energy", "They control when the cell divides"] },
  "What is the word equation for photosynthesis?": { key: "Carbon dioxide + water, with light, makes glucose + oxygen", d: ["Glucose + oxygen, with light, makes carbon dioxide + water", "Glucose + water makes oxygen + sunlight energy", "Oxygen + carbon dioxide makes glucose + water + heat"] },
  "How does the shape of a typical plant cell differ from a typical animal cell?": { key: "Plant cells are regular and boxy; animal cells are more irregular", d: ["Both kinds of cell always have exactly the same shape", "Animal cells are larger and more regular than plant cells", "Animal cells are always rectangular and plant cells are always round"] },
  "What does the large central vacuole in a plant cell do?": { key: "Stores water and helps keep the cell firm", d: ["Carries out photosynthesis in the cell", "Makes proteins for the cell", "Controls when the cell divides"] },
  "Why do root hair cells have long, thin extensions?": { key: "To increase surface area for absorbing water", d: ["To carry out photosynthesis more efficiently", "To push the plant through the soil", "To store sugar made by the leaves"] },
  "What is the function of red blood cells?": { key: "To carry oxygen, packed with haemoglobin", d: ["To make antibodies against pathogens", "To form blood clots when skin is cut", "To engulf and digest bacteria in the blood"] },
  "What is a tissue in biology?": { key: "A group of similar cells doing one job", d: ["The outer covering of an organism", "A single, highly specialised cell", "A group of organs working together"] },
  "What is an organ in biology?": { key: "Several tissues working together for one function", d: ["A group of whole organisms living together", "A single specialised cell that has many nuclei", "A single type of tissue found in the body"] },
  "What does a guard cell do in a plant leaf?": { key: "Opens and closes the stomata", d: ["Moves glucose down to the roots", "Makes glucose inside the leaf by photosynthesis", "Takes up water from the soil"] },
  "How is total magnification calculated for a compound microscope?": { key: "Eyepiece magnification × objective magnification", d: ["Objective magnification ÷ eyepiece magnification", "Eyepiece magnification + objective magnification", "Objective magnification alone"] },
  "Why do bacteria appear so different from plant and animal cells under a light microscope?": { key: "They are prokaryotes: much smaller, with no nucleus", d: ["Bacteria are larger than plant and animal cells", "Bacteria cannot be stained with any standard stain", "Bacteria always move too fast to be seen clearly"] },
  "Why does a nerve cell (neuron) have a very long axon?": { key: "To carry electrical signals over long distances", d: ["To carry out photosynthesis over a large area", "To store large amounts of energy", "To absorb more oxygen from the blood"] },
  "What are the three statements of cell theory?": { key: "Living things are made of cells; the cell is the basic unit of life; cells come from existing cells", d: ["Cells are made of atoms; all cells respire; all cells are the same size", "All living things grow; all cells contain DNA; cells cannot die", "All cells contain chloroplasts; all cells divide every 24 hours; all cells have a nucleus"] },
  "What is the function of cytoplasm?": { key: "A fluid where reactions happen and organelles sit", d: ["Provides rigid structural support for the whole cell", "Absorbs light energy for photosynthesis in plants", "Controls what enters and leaves the cell"] },
  "Why is the palisade mesophyll tissue near the top of a leaf?": { key: "Its chloroplast-rich cells capture the most light there", d: ["It stops water being lost from the leaf surface", "It allows gas exchange at the upper leaf surface", "It protects the leaf from insects that land on it"] },
  "What type of organisms are bacteria: prokaryotes or eukaryotes?": { key: "Prokaryotes: they have no membrane-bound nucleus", d: ["Eukaryotes: they have a membrane-bound nucleus", "Eukaryotes: they have mitochondria in their cells", "Neither: bacteria are not made of cells at all"] },
  "Which feature distinguishes a plant cell from a fungal cell under the microscope?": { key: "Green plant cells contain chloroplasts; fungal cells do not", d: ["Plant cells have a cell wall but fungal cells do not", "Plant cells have a nucleus but fungal cells do not", "Plant cells are always much smaller than fungal cells"] },
  "Why can a specialised cell (like a red blood cell) not survive independently?": { key: "It depends on other cell types for what it cannot do", d: ["It is far too large to exist on its own in water", "It has no cell membrane to protect its contents", "It contains more DNA than it is able to use"] },
  "Which structural features help red blood cells carry oxygen efficiently?": { key: "A biconcave shape and no nucleus, for more haemoglobin", d: ["Thick, rigid cell walls that can hold oxygen", "A very large nucleus that is used for oxygen storage", "Cilia on the surface to sweep oxygen in"] },
  "What do cilia do in the airways?": { key: "Sweep mucus and trapped dust away from the lungs", d: ["Absorb oxygen from the air that is breathed in", "Make the digestive enzymes for the airway", "Control the opening and closing of stomata"] },
  "Why do the walls of alveoli need to be very thin?": { key: "To give gases a short distance to diffuse", d: ["To make the lungs lighter for the body to carry", "To let the lungs expand further when breathing in", "To stop air from leaking out into the chest"] },
  "What structural feature of the small intestine greatly increases its surface area for absorption?": { key: "Villi and microvilli on its inner surface", d: ["A very large diameter along its whole length", "A highly acidic environment inside the tube", "A thick muscular wall around the outside"] },
  "What is the function of phloem in a plant?": { key: "To carry dissolved sugars to all plant parts", d: ["To carry water upward from the roots to the leaves", "To support the stem so the plant stands upright", "To take in water from the soil around the roots"] },
  "How does xylem tissue differ from phloem tissue in structure?": { key: "Xylem is dead hollow tubes; phloem is living with sieve plates", d: ["Xylem cells are living, but phloem cells are dead tubes", "Xylem has sieve plates, but phloem has lignified walls", "There is no structural difference between xylem and phloem"] },
  "What pulls water up through the xylem from roots to leaves?": { key: "Transpiration pull as water evaporates from leaves", d: ["The expansion of the xylem vessels themselves", "The pumping action of cells in the root", "Gravity pulling the water upward in the stem"] },
  "What is photosynthesis?": { key: "Plants using light to turn carbon dioxide and water into glucose and oxygen", d: ["Cells breaking down glucose to release energy for life processes", "Plants absorbing water and minerals through their roots from soil", "Animals digesting their food into small, soluble molecules inside the gut"] },
  "What is aerobic cellular respiration?": { key: "Cells breaking down glucose with oxygen to release energy", d: ["Pumping blood around the body to supply the cells", "Plants making their food from sunlight and carbon dioxide", "Breathing air in and out of the lungs each minute"] },
  "What is diffusion?": { key: "The net movement of particles from high to low concentration", d: ["The movement of particles from low to high concentration", "The movement of water only, through a membrane", "Particles being pushed across a membrane using energy"] },
  "What is an enzyme?": { key: "A protein that speeds up reactions and is not used up", d: ["A sugar that stores energy for the cell to use", "A white blood cell that fights infection in the body", "A waste gas made when cells respire in the dark"] },
  "Why do most leaves look green?": { key: "Chlorophyll reflects green light and absorbs mostly red and blue", d: ["The cell wall is coloured by a green dye", "Mitochondria in the leaf cells are green in colour", "Chlorophyll absorbs green light most strongly of all"] },
  "Oxygen moves into a respiring cell by diffusion. Why does it move in?": { key: "The cell uses oxygen up, so there is less inside", d: ["Cells pump oxygen in using energy from ATP", "Oxygen is attracted to the nucleus of the cell", "The membrane has no barrier to stop oxygen entering"] },
  "What is an antibody?": { key: "A Y-shaped protein from plasma cells that binds one antigen", d: ["A white blood cell that engulfs pathogens and digests them", "A protein that is part of every type of vaccine given", "A chemical released by damaged tissue during inflammation"] },
  "What is a memory cell?": { key: "A long-lived B- or T-cell that speeds up a second response", d: ["A white blood cell that kills every kind of pathogen non-specifically", "A nerve cell that stores long-term memories in the brain", "A type of platelet that is involved in blood clotting"] },
  "How does a vaccine stimulate immunity without causing disease?": { key: "It contains weakened, inactivated or partial antigens", d: ["It contains live, fully active pathogens that infect the body mildly", "It injects pre-made antibodies straight into the bloodstream", "It destroys the pathogens in the body using a chemical"] },
  "What is herd immunity?": { key: "Enough people are immune that the pathogen cannot spread widely", d: ["The immunity that is gained only by surviving a disease", "The point at which vaccinated cattle are protected from disease", "Immunity that is shared between animals and humans"] },
  "Why are antibiotics ineffective against viral infections such as influenza?": { key: "They target bacterial structures that viruses do not have", d: ["Antibiotics are too expensive to use against viruses", "Viruses are too large for antibiotics to get through", "Viruses are not classified as pathogens at all"] },
  "What are the three lines of defence against pathogens in the human body?": { key: "Barriers; non-specific response; specific adaptive response", d: ["Skin, blood and bone marrow, in that order", "Antibodies, vaccines and surgery, in that order", "Fever, inflammation and memory cells only"] },
  "Why does fever help fight infection?": { key: "Higher temperature slows bacteria and speeds up immune cells", d: ["Fever makes the body produce antibodies straight away", "Fever melts the cell membranes of pathogens directly", "Fever raises the blood glucose that white blood cells use"] },
  "Why does the secondary immune response (re-exposure to a pathogen) produce antibodies faster than the primary response?": { key: "Memory B-cells from the first exposure respond rapidly", d: ["The body kept pre-made antibodies stored from the first exposure", "The pathogen is weaker every time it is met again", "T-cells are more numerous after any first exposure"] },
  "Why is overuse of antibiotics a public health concern?": { key: "It drives the spread of antibiotic-resistant bacteria", d: ["It wastes money but has no other significant effects", "It causes side effects in every patient who takes them", "It makes vaccines work less well across the population"] },
  "In Type 1 diabetes, which homeostatic process fails?": { key: "The immune system destroys insulin-making beta cells", d: ["The liver stops breaking down glycogen when needed", "The kidneys cannot filter glucose out of the blood", "The body makes too much insulin, so glucose falls too low"] },
  "The Gardasil vaccine developed in Australia protects against:": { key: "Human papillomavirus (HPV), a cause of cervical cancer", d: ["Influenza virus, which causes seasonal flu", "Hepatitis B virus, which infects the liver", "Measles virus, which causes a rash and fever"] },
  "What is the role of histones in relation to DNA?": { key: "Proteins that DNA is coiled around", d: ["Enzymes that copy DNA before cell division", "The bases that pair together in the double helix", "Molecules that carry genetic information between cells"] },
  "What is a gene?": { key: "A segment of DNA that codes for a protein or RNA", d: ["The whole DNA molecule found in a cell", "Any section of a chromosome, whatever it codes for", "A pair of chromosomes that are inherited together"] },
  "Why is complementary base pairing important for DNA replication?": { key: "Each strand can act as a template for a new strand", d: ["It lets genes be expressed as proteins straight away", "It allows mutations to occur in the new strand", "It decides the structure of the histones"] },
  "In asexual reproduction, offspring are:": { key: "Genetically identical to the parent, apart from rare mutations", d: ["Always better adapted than the parent organism", "Made from the genes of two different parents", "Genetically different from the parent because of mutation"] },
  "What is a zygote?": { key: "The cell formed when an egg and sperm fuse", d: ["A sex cell produced by meiosis in the ovary", "A clone produced by asexual reproduction", "A cell that has undergone a mutation"] },
  "Why are most mutations described as neutral rather than harmful or beneficial?": { key: "Many fall in non-coding DNA or change no amino acid", d: ["Mutations are rare, so most of them are harmless", "All organisms can repair every mutation perfectly", "Mutations can only happen in non-coding DNA"] },
  "What was the first recombinant DNA pharmaceutical approved for human use (1982)?": { key: "Human insulin made by bacteria", d: ["Aspirin made by a chemical reaction in the lab", "A polio vaccine grown in animal cells", "The BRCA1 gene test used to screen for cancer risk"] },
  "HeLa cells are significant in medical research because they:": { key: "Were the first human cells grown continuously in a laboratory", d: ["Were produced by genetic engineering in the 1980s", "Were used to sequence the first human genome in 1953", "Were the first animal cells ever seen under a microscope"] },
  "Identical twins have the same DNA but can develop different heights as adults. This is because:": { key: "The environment, such as nutrition, affects how the genes show", d: ["One twin always gets more mutations than the other", "Their chromosomes are different, even if they look the same", "Natural selection acts differently on each twin"] },
  "What is crossing over, and when does it occur?": { key: "Homologous chromosomes swap segments during meiosis", d: ["Chromosomes line up at random during mitosis", "DNA is replicated before the cell divides", "Sister chromatids separate during mitosis"] },
  "Why are gamma rays more dangerous to living tissue than radio waves?": { key: "Their photons carry enough energy to ionise atoms and damage DNA", d: ["Gamma rays travel much faster than radio waves do", "Gamma rays are mechanical waves that push through tissue", "Radio waves cannot pass through the body at all"] },
  "A high temperature stops an enzyme working. What best explains this?": { key: "The enzyme denatures, so the substrate no longer fits", d: ["The substrate becomes too large to react with it", "The enzyme is used up by the reaction itself", "The reaction gives out too much energy for it"] },
  "How does the rate of an enzyme-controlled reaction change as temperature rises from low values?": { key: "Rises to an optimum, then drops as the enzyme denatures", d: ["Rises steadily and keeps rising at every temperature", "Stays about the same at all temperatures", "Falls steadily from the start as particles slow down"] },
  "Osmosis is the movement of which substance, and in which direction?": { key: "Water, from dilute to concentrated solution, across a membrane", d: ["Solute, from low to high concentration, using ATP", "Water, from a concentrated solution to a dilute one", "Any particle, down its gradient, through the cell wall"] },
  "How is active transport different from diffusion?": { key: "It moves substances against the gradient, using ATP", d: ["It happens only in plant cells and never in animal cells", "It moves substances down their gradient with no energy", "It moves water only, through the lipid bilayer"] },
  "Where does translation take place?": { key: "At a ribosome, where amino acids are joined", d: ["In the nucleus, directly on the DNA", "Only inside the mitochondria of the cell", "On the cell wall, outside the membrane"] },
  "What is a codon?": { key: "Three bases in mRNA that code for one amino acid", d: ["A group of four bases that makes up a whole gene", "A single amino acid in a protein chain", "A section of a ribosome that reads the code"] },
  "Why is the cell's DNA copied before mitosis?": { key: "So each daughter cell gets a full set of genes", d: ["So each daughter cell gets half of the DNA", "So the nucleus can be taken out of the cell", "So the cell can make more mitochondria to share"] },
  "What can happen when the controls on cell division fail?": { key: "Cells divide without control and may form a tumour", d: ["Cells stop respiring and soon die", "Cells turn into gametes in the same tissue", "DNA is changed into protein by the nucleus"] },
  "Which three factors can limit the rate of photosynthesis?": { key: "Light intensity, carbon dioxide and temperature", d: ["Only the amount of oxygen in the surrounding air", "Only the colour of the leaf being tested", "Only the number of mitochondria in the cells"] },
  "Why can't a single cell grow very large?": { key: "Its volume outgrows its surface area, so exchange falls short", d: ["It would run out of space for its single nucleus", "Its membrane would grow too thick for materials to cross", "It could not contain enough DNA for all its needs"] },
  "Which feature is found in a bacterial cell but not in an animal cell?": { key: "A cell wall, and DNA with no nucleus around it", d: ["Ribosomes for making proteins in the cell", "A cell membrane around all of the cytoplasm", "Mitochondria for aerobic respiration in the cell"] },
  "In a mitochondrion, what drives ATP synthase to make ATP?": { key: "Protons flowing back through it down their gradient", d: ["Oxygen binding directly to the enzyme itself", "Glucose splitting into two pyruvate molecules", "Light being absorbed by the enzyme"] },
  "Which stage of aerobic respiration makes the most ATP for each glucose molecule?": { key: "Oxidative phosphorylation", d: ["Glycolysis, in the cytoplasm", "The Krebs cycle, in the matrix", "Fermentation, when oxygen is low"] },
  "What does the Calvin cycle (light-independent stage) do?": { key: "Uses ATP and NADPH to turn CO₂ into sugar", d: ["Splits water to release oxygen and electrons", "Absorbs light using chlorophyll in the grana", "Makes ATP in the mitochondria from glucose"] },
  "Where does the oxygen released in photosynthesis come from?": { key: "The splitting of water in the light reactions", d: ["The carbon dioxide that the leaf takes in", "The breakdown of glucose in the stroma", "The ATP that the light reactions make"] },
  "What is the light compensation point of a plant?": { key: "The light level where photosynthesis equals respiration", d: ["The light level where respiration stops completely", "The light level where photosynthesis first starts", "The light level that gives the fastest photosynthesis"] },
  "Why do phospholipids arrange themselves into a bilayer in water?": { key: "Water-loving heads face out and water-avoiding tails face in", d: ["Water-avoiding heads face out and water-loving tails face in", "DNA holds the phospholipids together in two rows", "Every part is attracted to water, so they pack in two rows"] },
  "How does facilitated diffusion differ from active transport?": { key: "It uses protein channels but no ATP, down the gradient", d: ["It uses ATP to move substances up their gradient", "It moves substances straight through the lipid bilayer", "It moves water only, from dilute to concentrated"] },
  "What is the job of tRNA?": { key: "To bring an amino acid to the ribosome, matched to a codon", d: ["To carry the DNA out of the nucleus to the ribosome", "To join amino acids using peptide bonds on its own", "To copy the genes in the nucleus into mRNA"] },
  "Which events in meiosis create genetic variation?": { key: "Crossing over and independent assortment", d: ["Chromosome condensation and spindle formation", "Breakdown of the nuclear envelope", "DNA replication and cytokinesis"] },
  "Why are X-linked recessive conditions more common in males?": { key: "Males have one X, so one recessive allele shows", d: ["Males have two X chromosomes, so both alleles show", "The Y chromosome carries a dominant allele that hides them", "Recessive alleles are inherited only from fathers"] },
  "What is a frameshift mutation?": { key: "Bases inserted or deleted, not in multiples of three", d: ["A substitution that creates a stop codon in the gene", "A swap of one amino acid for a similar amino acid", "A change in the number of whole chromosomes"] },
  "What is resolution in microscopy?": { key: "The smallest gap at which two points still look separate", d: ["How brightly lit the final image appears to be", "How thick the specimen is on the slide", "How many times larger the image is than the specimen"] },
  "Why is Taq polymerase used in PCR?": { key: "It is heat stable, so it survives repeated heating", d: ["It unwinds the DNA inside a living cell", "It cuts DNA at specific base sequences", "It joins DNA from two different species together"] },
  "Which type of cell presents antigens to helper T-cells to start the adaptive immune response?": { key: "An antigen-presenting cell, such as a dendritic cell", d: ["A red blood cell that carries oxygen", "A platelet that helps blood to clot", "A neuron in the nervous system"] },
  "What does X-inactivation do in a female mammal?": { key: "Silences most of one X in each cell, forming a Barr body", d: ["Silences the same X chromosome in every cell of the body", "Makes both X chromosomes fully active in every cell", "Deletes one X chromosome from every cell for good"] },
  "How do killer (cytotoxic) T-cells recognise a virus-infected cell?": { key: "By viral antigens displayed on MHC class I molecules", d: ["By free antibodies attached to the surface of the cell", "By the number of mitochondria the cell contains", "By the shape of the cell wall around the cell"] },
  "What does the term 'genotype' mean?": { key: "The combination of alleles an organism carries", d: ["The complete genome of a whole species", "The process of chromosome separation in meiosis", "The observable traits of an organism"] },
  "What is a mutation?": { key: "A change in the DNA base sequence", d: ["The fusion of two gametes at fertilisation", "The copying of DNA before cell division", "The expression of a recessive allele"] },
  "Sickle cell anaemia is caused by:": { key: "A point mutation in the haemoglobin gene", d: ["Deletion of an entire chromosome", "A virus attacking the red blood cells", "Radiation exposure during development"] },
  "Two parents with brown eyes can have a blue-eyed child (assuming simple Mendelian inheritance) if:": { key: "Both parents are heterozygous, carrying a recessive allele", d: ["At least one parent has a dominant allele for blue eyes", "One parent is homozygous dominant for brown eyes", "The child undergoes a mutation during development"] },
  "What is Mendel's Law of Segregation?": { key: "The two alleles for a trait separate into different gametes", d: ["Mutations occur at a steady, predictable rate", "Dominant alleles always mask recessive alleles", "Alleles for different genes pass to gametes independently"] },
  "State the first statement of cell theory.": { key: "All living things are made of one or more cells", d: ["All cells are identical in their structure", "Cells can arise from non-living matter", "All cells contain chloroplasts for energy"] },
  "Name THREE structures found in plant cells but NOT in animal cells.": { key: "Cell wall, chloroplasts and a large central vacuole", d: ["Nucleus, mitochondria and ribosomes in the cytoplasm", "Cell membrane, nucleus and mitochondria together", "Cytoplasm, nucleus and ribosomes in the cell"] },
  "Which type of organism is a producer in an ecosystem?": { key: "An organism that makes its own food using light", d: ["An organism that breaks down dead matter", "An organism that eats only other animals", "An organism that eats both plants and animals"] },
  "What is the main job of mitosis in a multicellular organism?": { key: "Making new body cells for growth and repair", d: ["Making the sex cells used in reproduction", "Releasing usable energy from glucose", "Halving the number of chromosomes in a cell"] },
  "Why does a sperm cell have many mitochondria packed behind its head?": { key: "They release the energy its tail needs for swimming", d: ["They give the head its streamlined shape", "They help it make its own food from light", "They store a copy of the father's DNA"] },
  "Do plant cells carry out respiration?": { key: "Yes, all the time, in light and in the dark", d: ["Only the root cells of the plant respire", "Only at night, when there is no light", "No, because plants only photosynthesise"] },
  "What is phagocytosis?": { key: "White blood cells engulfing and digesting pathogens", d: ["The release of hormones to fight infection", "The process of forming new memory cells", "The production of antibodies by B-cells"] },
  "A vaccine containing a weakened (attenuated) but living pathogen is called:": { key: "A live attenuated vaccine", d: ["An mRNA vaccine made in the laboratory", "A subunit vaccine made from protein pieces", "An inactivated vaccine made from killed pathogens"] },
  "The two 'sides' of the DNA double helix are made of:": { key: "Alternating sugar and phosphate groups", d: ["Alternating bases and protein molecules", "Ribose and phosphate groups, as in RNA", "Pairs of nitrogenous bases joined together"] },
  "Which scientist produced Photograph 51, the X-ray diffraction image that provided key evidence for the double helix structure of DNA?": { key: "Rosalind Franklin", d: ["Maurice Wilkins", "Francis Crick", "James Watson"] },
  "What does the term 'phenotype' mean?": { key: "The observable characteristics of an organism", d: ["The number of chromosomes in a cell", "The set of alleles an organism carries", "The process by which genes are expressed"] },
  "What type of mutation occurs when a single base is replaced by a different base?": { key: "Point substitution mutation", d: ["Frameshift mutation", "Insertion mutation", "Deletion mutation"] },
  "Which of the following is an example of a mutagen?": { key: "Ultraviolet radiation", d: ["Thymine base", "Histone protein", "Ribosome"] },
  "What does the lock-and-key model say about enzymes?": { key: "The active site matches the shape of its own substrate", d: ["The substrate is the part that changes shape", "The enzyme is destroyed after one reaction", "Every enzyme works equally well on every substrate"] },
  "A plant cell placed in pure water becomes firm (turgid) but does not burst. Why?": { key: "The cell wall resists the pressure of the water inside", d: ["The membrane stops any water at all from entering", "Chloroplasts turn the extra water into starch", "The nucleus pumps the extra water back out again"] },
  "What is the main job of ATP in a cell?": { key: "Carrying energy to where the cell can use it", d: ["Building the structure of the cell membrane", "Storing the genetic code of the cell", "Speeding up reactions inside the cell as an enzyme"] },
  "How can a single base change in a gene affect a protein?": { key: "It can change one amino acid and so alter how the protein works", d: ["It always stops the protein from being made at all", "It cannot affect a protein, since proteins are not made from genes", "It changes every amino acid in the whole protein chain"] },
  "Where in a chloroplast do the light-dependent reactions take place?": { key: "In the thylakoid membranes", d: ["In the cell wall around it", "In the fluid-filled stroma", "In the outer membrane"] },
  "Which pair of features is typical of a shade leaf compared with a sun leaf?": { key: "More chlorophyll per chloroplast and a lower light compensation point", d: ["A thicker waxy cuticle and a higher compensation point", "Fewer grana and a higher rate of respiration overall", "A thicker palisade layer and a higher light-saturation point"] },
  "How does a competitive inhibitor reduce enzyme activity?": { key: "It binds to the active site and blocks the substrate", d: ["It destroys the substrate before it can bind", "It raises the temperature of the reaction", "It moves the enzyme out to the nucleus"] },
  "What is the main structure of a cell membrane in the fluid mosaic model?": { key: "A phospholipid bilayer with proteins embedded in it", d: ["A double layer made of DNA molecules", "A single layer of protein coated in lipid", "A rigid layer made of cellulose fibres"] },
  "Why is DNA replication called semi-conservative?": { key: "Each new DNA molecule has one old strand and one new strand", d: ["Both strands of each new molecule are brand new", "The original molecule stays whole and a copy is made", "Only half of the DNA in the cell gets copied"] },
  "Which enzyme adds nucleotides to build the new DNA strand during replication?": { key: "DNA polymerase", d: ["Helicase", "Catalase", "Amylase"] },
  "Which microscope can show the internal structure of organelles such as mitochondria?": { key: "A transmission electron microscope", d: ["A hand lens held close to the specimen", "A school light microscope", "A dissecting microscope with a lamp"] },
  "What effect does histone acetylation generally have?": { key: "It loosens chromatin so genes can be transcribed", d: ["It tightens chromatin and so silences genes", "It cuts the DNA into short fragments", "It changes the DNA base sequence"] },
};
for (const r of raw) {
  const f = LEN[r.q];
  if (f) { if (f.key) r.key = f.key; if (f.d) r.d = f.d; }
}

// ---- Codex science-check corrections (matched by stem). q/why/band replace the field; key replaces the correct option;
//      d replaces all three distractors (used where a longer key needed longer distractors); dSwap replaces one distractor.
const CODEX = {
  "What does the third statement of cell theory say?": { why: "The third statement of cell theory says that new cells arise from existing cells through cell division." },
  "Where does cellular respiration take place in a cell?": { q: "Where do most stages of aerobic cellular respiration occur in a plant or animal cell?", why: "Glycolysis begins in the cytoplasm. The remaining stages of aerobic respiration occur in mitochondria." },
  "Name THREE structures found in plant cells but NOT in animal cells.": { q: "Which three structures are typically present in a photosynthetic leaf cell but absent from an animal cell?", why: "A typical photosynthetic leaf cell has a cellulose cell wall, chloroplasts and a large central vacuole. Animal cells lack these structures; many non-photosynthetic plant cells lack chloroplasts." },
  "What is the word equation for aerobic cellular respiration?": { why: "Aerobic cellular respiration converts glucose and oxygen into carbon dioxide and water, transferring some of the released energy to ATP. In plant and animal cells, glycolysis occurs in the cytoplasm and the remaining stages occur in mitochondria." },
  "What does a guard cell do in a plant leaf?": { q: "What is the main role of guard cells in a plant leaf?", dSwap: { "Makes glucose inside the leaf by photosynthesis": "Absorbs water and minerals from the soil" }, why: "Pairs of guard cells change their turgor and shape to open or close stomata, regulating gas exchange and water loss." },
  "What is the function of cytoplasm?": { key: "Contains the cytosol and organelles, where many cell reactions occur", d: ["Provides rigid structural support for the whole cell", "Absorbs light energy for photosynthesis in plant cells", "Controls what enters and leaves the whole cell"], why: "Cytoplasm comprises the cytosol and the structures suspended in it, excluding the nucleus in eukaryotic cells. Many chemical reactions occur there." },
  "What is the level of organisation in a multicellular organism from smallest to largest?": { key: "Cell, tissue, organ, organ system, organism", d: ["Organ, tissue, cell, organ system, organism", "Tissue, cell, organ, organ system, organism", "Organism, organ system, organ, tissue, cell"] },
  "What is the function of phloem in a plant?": { q: "What is the main transport function of phloem in a plant?" },
  "How does xylem tissue differ from phloem tissue in structure?": { q: "How do mature xylem vessel elements differ structurally from phloem sieve-tube elements?", key: "Xylem vessel elements are dead and hollow; sieve-tube elements are living with sieve plates", d: ["Xylem vessel elements are living, but sieve-tube elements are dead tubes", "Xylem vessel elements have sieve plates, but sieve-tube elements have lignified walls", "There is no structural difference between the two kinds of element"], why: "Mature xylem vessel elements are dead, with lignified walls and open or perforated ends. Phloem sieve-tube elements remain living and have perforated end walls called sieve plates." },
  "Which type of organism is a producer in an ecosystem?": { key: "An organism that makes its own food using light or chemical energy", d: ["An organism that eats only other animals to get all of its energy", "An organism that breaks down dead matter to get its energy", "An organism that eats both plants and animals to get its energy"], why: "Producers are autotrophs. Plants and algae use light energy, while some bacteria and archaea use chemical energy to make organic substances from inorganic materials." },
  "What is aerobic cellular respiration?": { why: "Aerobic cellular respiration breaks down glucose using oxygen, releasing energy that is transferred to ATP and producing carbon dioxide and water. In plant and animal cells, it begins in the cytoplasm and continues in mitochondria." },
  "What is an enzyme?": { key: "A biological catalyst, usually a protein, that is not used up", d: ["A sugar that stores energy for the cell to use later", "A white blood cell that fights infection in the body", "A waste gas that is made when cells respire in the dark"], why: "Most enzymes are proteins, although some catalytic RNA molecules also act as enzymes. They speed up reactions without being consumed." },
  "Do plant cells carry out respiration?": { why: "Living plant cells respire in both light and darkness. Photosynthetic cells also photosynthesise when sufficient light is available; their net gas exchange depends on the relative rates of photosynthesis and respiration." },
  "What is an antibody?": { key: "A Y-shaped protein from plasma cells that binds a specific antigenic site", d: ["A white blood cell that engulfs pathogens and digests them", "A chemical released by damaged tissue during inflammation", "A protein that is part of every type of vaccine given"], why: "Plasma cells secrete antibodies. Each antibody recognises a particular antigenic site, called an epitope. Binding can neutralise a target or help other immune mechanisms remove it." },
  "How does a vaccine stimulate immunity without causing disease?": { key: "It exposes the immune system to antigens, or instructions for making them, to build immune memory", d: ["It destroys the pathogens in the body using a chemical that kills them", "It contains live, fully active pathogens that infect the body mildly and for a short time", "It injects pre-made antibodies straight into the bloodstream to give lasting protection"], why: "Vaccines provide weakened or inactivated pathogens, pathogen components, or genetic instructions for producing antigens. These stimulate an immune response and memory-cell formation." },
  "A vaccine containing a weakened (attenuated) but living pathogen is called:": { why: "A live attenuated vaccine contains a living pathogen with reduced virulence that stimulates an immune response and immune memory. It can cause serious disease in people with significant immunocompromise." },
  "In Type 1 diabetes, which homeostatic process fails?": { q: "What causes the failure of blood glucose regulation in Type 1 diabetes?" },
  "A typical human body cell contains how many chromosomes?": { why: "A typical human body cell contains 46 chromosomes: 22 pairs of autosomes and two sex chromosomes, usually XX or XY. X and Y are homologous only in small regions." },
  "Which scientist produced Photograph 51, the X-ray diffraction image that provided key evidence for the double helix structure of DNA?": { q: "Which scientist worked with Raymond Gosling to produce Photograph 51, an X-ray diffraction image providing key evidence for DNA's double helix?", why: "Rosalind Franklin and her PhD student Raymond Gosling produced Photograph 51 at King's College London in May 1952. Its diffraction pattern provided important evidence for DNA's helical structure." },
  "In asexual reproduction, offspring are:": { dSwap: { "Genetically different from the parent because of mutation": "Produced only after an egg and sperm fuse together", "Made from the genes of two different parents": "Made by combining the genes of two different parents", "Always better adapted than the parent organism": "Always better adapted than the parent organism was" }, why: "Asexual reproduction involves one parent without gamete fusion and generally produces genetically identical offspring, apart from mutations. Eukaryotes commonly reproduce asexually through processes involving mitosis; bacteria divide by binary fission." },
  "Which type of cell division produces gametes and halves the chromosome number?": { q: "In animals, which type of cell division produces haploid cells for gamete formation?", why: "In animals, meiosis halves the chromosome number to produce haploid cells involved in gamete formation. In plants, meiosis produces haploid spores; gametes are subsequently produced by mitosis." },
  "A sample of DNA contains 30% adenine. What percentage of bases are guanine?": { q: "A sample of double-stranded DNA contains 30% adenine. What percentage of its bases are guanine?" },
  "Two parents with brown eyes can have a blue-eyed child (assuming simple Mendelian inheritance) if:": { q: "In a simple one-gene model with brown eyes (B) dominant over blue eyes (b), and no new mutations, two brown-eyed parents can have a blue-eyed child if:", dSwap: { "The child undergoes a mutation during development": "Both parents are homozygous dominant for brown eyes" } },
  "What was the key ethical issue in the original collection of Henrietta Lacks's cells?": { why: "Henrietta Lacks's tumour tissue was collected during treatment and supplied to George Gey's laboratory for research without her knowledge or consent. The ethical issue was the absence of informed consent for that research use." },
  "Osmosis is the movement of which substance, and in which direction?": { key: "Net movement of water from a dilute to a more concentrated solution across a selectively permeable membrane", d: ["Net movement of solute from low to high concentration across a membrane, using ATP", "Net movement of water from a concentrated solution to a dilute one across a selectively permeable membrane", "Net movement of any particle down its gradient through a gap in the cell wall"] },
  "How is active transport different from diffusion?": { key: "It uses energy to move substances against their concentration or electrochemical gradient", d: ["It happens only in plant cells and never in animal cells or in bacteria", "It moves substances down their gradient with no energy being used at all", "It moves water only, straight through the lipid bilayer of the membrane"], why: "Active transport uses membrane proteins and energy to move substances against a gradient. Primary active transport uses energy directly, often from ATP; secondary active transport uses energy stored in another substance's gradient. Diffusion is passive." },
  "What is a codon?": { key: "Three mRNA bases that specify an amino acid or a stop", d: ["A single amino acid in a protein chain", "A section of a ribosome that reads the code", "A group of four bases that makes up a whole gene"].map((x) => x) },
  "What can happen when the controls on cell division fail?": { why: "Cancer can develop when mutations disrupt the controls on cell growth and division. Abnormal cells may form a tumour, although some cancers, such as leukaemia, do not form solid tumours." },
  "How does meiosis differ from mitosis?": { key: "It halves the chromosome number, using two divisions after one DNA replication", d: ["It happens only in plants, never in animals or in fungi", "It makes cells for the growth and repair of body tissues", "It makes two identical cells that keep the full chromosome number"], why: "Meiosis involves two divisions after one round of DNA replication, reducing the chromosome number by half. Crossing over and independent assortment generate variation. Its products are not always four functional gametes." },
  "When muscle cells respire without enough oxygen, what is made?": { key: "Lactate and a small amount of ATP", why: "Anaerobic glycolysis produces a net gain of two ATP per glucose. Pyruvate is converted to lactate, regenerating NAD+ so glycolysis can continue." },
  "Why can't a single cell grow very large?": { q: "Why does increasing a cell's size without changing its shape make exchange across its membrane more difficult?", key: "Its volume increases faster than its surface area, so exchange falls behind its needs", d: ["It could not contain enough DNA to run all of its activities as it grew", "Its membrane would grow too thick for any materials to cross it at all", "It would run out of space inside for its single large nucleus to fit"], why: "As a cell grows without changing shape, its surface area to volume ratio decreases. Its membrane therefore has less exchange area relative to the volume it must supply." },
  "Which molecule crosses the phospholipid bilayer most easily by simple diffusion?": { why: "Small non-polar molecules such as oxygen diffuse easily through the bilayer. Ions and molecules such as glucose generally require transport proteins. Intact proteins usually require vesicular transport to cross the plasma membrane." },
  "How does facilitated diffusion differ from active transport?": { key: "It uses channel or carrier proteins to move substances down their gradient without ATP", d: ["It uses ATP to move substances up their gradient, against it", "It moves water only, from a dilute to a concentrated solution", "It moves substances straight through the lipid bilayer without any proteins"] },
  "An animal cell is placed in a hypotonic solution. What happens?": { why: "A hypotonic solution has a lower effective concentration of non-penetrating solutes than the cytoplasm. Water enters by osmosis, and the cell may swell and lyse because it has no cell wall." },
  "In eukaryotes, which part of the pre-mRNA is removed before translation?": { band: "y12", why: "Splicing removes introns and joins the retained exons. Exons can contain protein-coding sequences and untranslated regions. Mature mRNA is exported from the nucleus for translation." },
  "What is the job of tRNA?": { band: "y12" },
  "Why is DNA replication called semi-conservative?": { band: "y12" },
  "Which enzyme adds nucleotides to build the new DNA strand during replication?": { band: "y12" },
  "Which events in meiosis create genetic variation?": { band: "y12" },
  "Why are X-linked recessive conditions more common in males?": { band: "y12", why: "In a typical XY male, a recessive disease allele on the X chromosome has no corresponding allele on the Y to mask it. XX females usually need two disease alleles to be fully affected, although some heterozygous females show symptoms because of X-inactivation." },
  "What is a frameshift mutation?": { band: "y12", key: "An insertion or deletion in a coding sequence that shifts its reading frame", d: ["A substitution that creates a stop codon partway through the gene", "A change in the number of whole chromosomes in the cell", "A swap of one amino acid for a similar amino acid in the protein"], why: "An insertion or deletion within a protein-coding sequence shifts the reading frame when the number of bases is not a multiple of three. This changes how downstream bases are grouped into codons and often introduces a premature stop signal." },
  "Why is Taq polymerase used in PCR?": { band: "y12" },
  "Which type of cell presents antigens to helper T-cells to start the adaptive immune response?": { band: "y12", key: "An antigen-presenting cell, such as a dendritic cell", d: ["A red blood cell that carries oxygen around the body", "A neuron in the nervous system of the body", "A platelet that helps the blood to clot at a wound"] },
  "What does X-inactivation do in a female mammal?": { q: "What does X-inactivation do in a typical XX somatic cell of a female human?", why: "Early in development, one X chromosome is usually chosen at random for inactivation in each precursor cell. Its descendants retain that choice, producing patches of cells with different active X chromosomes. Most genes on the inactive X are silenced, helping balance X-linked gene dosage." },
};
const used = new Set();
for (const r of raw) {
  const f = CODEX[r.q];
  if (!f) continue;
  used.add(r.q);
  if (f.key) r.key = f.key;
  if (f.d) r.d = f.d;
  if (f.dSwap) r.d = r.d.map((x) => f.dSwap[x] ?? x);
  if (f.why) r.why = f.why;
  if (f.band) r.band = f.band;
  if (f.q) r.q = f.q;
}
for (const k of Object.keys(CODEX)) if (!used.has(k)) throw new Error(`CODEX stem not found: ${k}`);

// ---- validate
for (const r of raw) {
  if (r.d.length !== 3) throw new Error(`need 3 distractors: ${r.q}`);
  if (!r.why) throw new Error(`missing why: ${r.q}`);
  for (const t of r.topics) if (!TOPICS.has(t)) throw new Error(`unknown topic ${t}: ${r.q}`);
  if (new Set([r.key, ...r.d]).size !== 4) throw new Error(`duplicate options: ${r.q}`);
}

// ---- de-duplicate near-identical stems (Jaccard on word sets)
const words = (q) => new Set(q.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2));
const jac = (a, b) => { let n = 0; for (const w of a) if (b.has(w)) n++; return n / (a.size + b.size - n); };
const kept = []; const dups = [];
for (const r of raw) {
  const w = words(r.q);
  const hit = kept.find((k) => jac(w, k._w) >= 0.7 && k.key.toLowerCase() === r.key.toLowerCase());
  if (hit) { dups.push(`${r.srcId || "authored"}: ${r.q} ~ ${hit.q}`); continue; }
  r._w = w; kept.push(r);
}

// ---- seeded shuffle + balanced answer positions (exactly even, +-1)
const deck = shuffle(kept.map((_, i) => i % 4));
const order = shuffle(kept.map((_, i) => i));
const items = kept.map((r, i) => {
  const pos = deck[order.indexOf(i)];
  const ds = shuffle(r.d);
  const options = [...ds.slice(0, pos), r.key, ...ds.slice(pos)];
  return { id: "", band: r.band, topics: r.topics, q: norm(r.q), options: options.map(norm), answer: pos, why: norm(r.why), _src: r.srcId };
});
items.sort((a, b) => ["y7-8", "y9-10", "y11", "y12"].indexOf(a.band) - ["y7-8", "y9-10", "y11", "y12"].indexOf(b.band));
items.forEach((it, i) => { it.id = `rv${String(i + 1).padStart(3, "0")}`; });

// ---- stats
const pos = [0, 0, 0, 0]; let longest = 0; const blatant = [];
for (const it of items) {
  pos[it.answer]++;
  const lens = it.options.map((o) => o.length);
  const k = lens[it.answer], others = lens.filter((_, i) => i !== it.answer);
  if (k > Math.max(...others)) longest++;
  if (k > Math.max(...others) * 1.3 && k - Math.max(...others) > 12) blatant.push({ q: it.q, ratio: +(k / Math.max(...others)).toFixed(2) });
}
const out = items.map(({ _src, ...it }) => it);
fs.writeFileSync(OUT, JSON.stringify({ generated: "tools/build-revision-bank.mjs", items: out }, null, 1) + "\n");

const by = {}; for (const it of out) by[it.band] = (by[it.band] || 0) + 1;
const tp = {}; for (const it of out) for (const t of it.topics) tp[t] = (tp[t] || 0) + 1;
console.log(`items ${out.length}`, by);
console.log("answer positions A-D:", pos.map((n) => `${n} (${Math.round((n / out.length) * 100)}%)`).join(" "));
console.log(`key is the longest option: ${longest} (${Math.round((longest / out.length) * 100)}%); blatant (>1.3x): ${blatant.length}`);
if (process.argv.includes("--blatant")) blatant.forEach((b) => console.log(`  ${b.ratio}x  ${b.q}`));
console.log("duplicates dropped:", dups.length, dups);
console.log("topics:", tp);
