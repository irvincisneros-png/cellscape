// Cell Explorer — organelle facts, colours and hunt clues.

export const COL = {
  nucleus: "#7c8cf8", nucleolus: "#4c4fb8", rer: "#60a5fa", ser: "#38bdf8",
  ribosome: "#fde68a", golgi: "#f472b6", mito: "#fb923c", chloroplast: "#4ade80",
  vacuole: "#7dd3fc", lysosome: "#a78bfa", peroxisome: "#a3e635", centriole: "#fbbf24",
  cytoskeleton: "#cbd5e1", vesicle: "#f9a8d4", membrane: "#d6c4e6", cytoplasm: "#4fd1c5",
  cellwall: "#b5c46a", capsule: "#94a3b8", nucleoid: "#60a5fa", plasmid: "#f87171",
  flagellum: "#e2e8f0", pili: "#cbd5e1",
};

// found: which of animal / plant / bacteria have it (typical textbook cells).
export const INFO = {
  nucleus: {
    name: "Nucleus", found: ["animal", "plant"], size: "≈ 5–10 µm across",
    fn: "Holds the cell's <strong>DNA</strong> and controls the cell by deciding which genes are used to make proteins.",
    fact: "It is wrapped in a double membrane (the nuclear envelope) pierced by ~120 nm <strong>nuclear pores</strong>, each built from hundreds of protein molecules. Zoom in to see them.",
  },
  nucleolus: {
    name: "Nucleolus", found: ["animal", "plant"], size: "≈ 1–2 µm",
    fn: "Dense region inside the nucleus that makes <strong>ribosomal RNA</strong> and assembles ribosome subunits.",
    fact: "It has no membrane of its own — it is a crowded zone of RNA and protein inside the nucleus.",
  },
  rer: {
    name: "Rough endoplasmic reticulum", found: ["animal", "plant"], size: "Sheets ≈ 50–100 nm thick, spreading through the cell",
    fn: "Membrane sheets studded with <strong>ribosomes</strong>; makes and folds proteins that will be exported or put into membranes.",
    fact: "Its membrane is continuous with the outer nuclear membrane. Antibody-making plasma cells are packed with rough ER.",
  },
  ser: {
    name: "Smooth endoplasmic reticulum", found: ["animal", "plant"], size: "Tubules ≈ 50 nm across",
    fn: "Tubes without ribosomes that make <strong>lipids</strong> (including steroid hormones), break down some toxins and store calcium.",
    fact: "Liver cells build extra smooth ER when they are exposed to drugs or alcohol, to detoxify them faster.",
  },
  ribosome: {
    name: "Ribosomes (80S)", found: ["animal", "plant", "bacteria"], size: "≈ 25–30 nm (80S)",
    fn: "Read the code on <strong>mRNA</strong> and join amino acids together to <strong>build proteins</strong>.",
    fact: "A single cell can contain millions of ribosomes. They are not membrane-bound, so even bacteria have them.",
    bact: {
      name: "Ribosomes (70S)", size: "≈ 20 nm (70S — smaller than eukaryotic 80S)",
      fact: "Bacterial 70S ribosomes differ from ours, which is why some antibiotics (e.g. streptomycin) can block them without harming human ribosomes.",
    },
  },
  golgi: {
    name: "Golgi apparatus", found: ["animal", "plant"], size: "Stack ≈ 1–3 µm wide",
    fn: "Modifies, sorts and <strong>packages proteins</strong> into vesicles for secretion or delivery around the cell.",
    fact: "It has a receiving <strong>cis face</strong> (towards the ER) and a shipping <strong>trans face</strong>. Watch vesicles go ER → Golgi → membrane.",
  },
  mito: {
    name: "Mitochondrion", found: ["animal", "plant"], size: "≈ 0.5–1 µm wide, 1–4 µm long",
    fn: "Site of <strong>aerobic respiration</strong> — releases energy from glucose to make most of the cell's <strong>ATP</strong>.",
    fact: "Mitochondria have their own circular DNA and 70S-type ribosomes — evidence they evolved from bacteria (endosymbiosis). Zoom in to see the folded inner membrane (cristae).",
  },
  chloroplast: {
    name: "Chloroplast", found: ["plant"], size: "≈ 5–10 µm long",
    fn: "Site of <strong>photosynthesis</strong> — traps light energy to make glucose from carbon dioxide and water.",
    fact: "Chlorophyll sits in stacks of thylakoid discs called <strong>grana</strong>. Like mitochondria, chloroplasts have their own DNA.",
  },
  vacuole: {
    name: "Large central vacuole", found: ["plant"], size: "Can fill 80–90% of the cell volume",
    fn: "Stores water, ions, sugars and pigments; presses the cytoplasm against the wall to keep the cell <strong>turgid</strong> (firm).",
    fact: "Its membrane is called the <strong>tonoplast</strong>. Animal cells only have small, temporary vacuoles.",
  },
  lysosome: {
    name: "Lysosome", found: ["animal"], size: "≈ 0.1–1.2 µm",
    fn: "Sac of <strong>digestive enzymes</strong> that break down worn-out organelles, food particles and engulfed bacteria.",
    fact: "Its inside is acidic (pH ≈ 4.5–5). Plant cells usually do this job in their vacuole instead.",
  },
  peroxisome: {
    name: "Peroxisome", found: ["animal", "plant"], size: "≈ 0.1–1 µm",
    fn: "Breaks down fatty acids and toxic <strong>hydrogen peroxide</strong> using the enzyme catalase.",
    fact: "Catalase is one of the fastest enzymes known — one molecule can break down millions of H₂O₂ molecules per second.",
  },
  centriole: {
    name: "Centrioles (centrosome)", found: ["animal"], size: "≈ 0.2 µm wide, 0.5 µm long",
    fn: "A pair of cylinders that help organise <strong>microtubules</strong>, including the spindle during cell division.",
    fact: "Each centriole is 9 triplets of microtubules, and the pair sits at right angles. Most plant cells have no centrioles but still build a spindle.",
  },
  cytoskeleton: {
    name: "Cytoskeleton", found: ["animal", "plant"], size: "Microtubules 25 nm, actin filaments 7 nm wide",
    fn: "Network of protein filaments that gives the cell shape and acts as <strong>tracks</strong> for moving vesicles and organelles.",
    fact: "Motor proteins such as kinesin 'walk' cargo along microtubules at about 1 µm per second. Bacteria have only simpler relatives of these proteins.",
  },
  vesicle: {
    name: "Vesicles", found: ["animal", "plant"], size: "≈ 50–100 nm (transport vesicles)",
    fn: "Tiny membrane bubbles that carry substances between the ER, Golgi and cell membrane, and release them by <strong>exocytosis</strong>.",
    fact: "When a vesicle fuses with the cell membrane its contents spill outside — this is how hormones and digestive enzymes are secreted.",
  },
  membrane: {
    name: "Cell (plasma) membrane", found: ["animal", "plant", "bacteria"], size: "≈ 7–8 nm thick",
    fn: "Phospholipid <strong>bilayer</strong> with proteins; it is <strong>selectively permeable</strong>, controlling what enters and leaves.",
    fact: "It is thousands of times thinner than the cell is wide. Zoom right in to see the two lipid layers.",
  },
  cytoplasm: {
    name: "Cytoplasm", found: ["animal", "plant", "bacteria"], size: "Fills the cell",
    fn: "Jelly-like <strong>cytosol</strong> (mostly water) plus everything suspended in it; many reactions, such as glycolysis, happen here.",
    fact: "It is incredibly crowded: up to about 30% of the cytosol is proteins and other large molecules.",
  },
  cellwall: {
    name: "Cell wall", found: ["plant", "bacteria"], size: "Plant: ≈ 0.1–1 µm thick (shown thicker at low zoom)",
    fn: "Rigid layer outside the membrane that <strong>supports</strong> the cell and stops it bursting when it takes in water.",
    fact: "Plant walls are made of <strong>cellulose</strong>; bacterial walls are <strong>peptidoglycan</strong>; fungal walls are chitin.",
    bact: {
      size: "≈ 10–80 nm thick",
      fact: "Bacterial walls are made of <strong>peptidoglycan</strong>. Penicillin works by stopping bacteria from building it.",
    },
  },
  capsule: {
    name: "Capsule (slime layer)", found: ["bacteria"], size: "≈ 0.1–1 µm thick",
    fn: "Sticky polysaccharide coat that protects some bacteria from drying out and from white blood cells, and helps them stick to surfaces.",
    fact: "Not all bacteria have one. Capsules help bacteria form slimy <strong>biofilms</strong> such as dental plaque.",
  },
  nucleoid: {
    name: "Nucleoid (chromosome)", found: ["bacteria"], size: "Region ≈ 1 µm; DNA ≈ 1.6 mm long if stretched out",
    fn: "Region where the single, circular <strong>chromosome</strong> sits — there is <strong>no nuclear membrane</strong> around it.",
    fact: "The E. coli chromosome is about 800 times longer than the cell itself, so it is tightly coiled and folded.",
  },
  plasmid: {
    name: "Plasmid", found: ["bacteria"], size: "Small rings, a few thousand base pairs or more",
    fn: "Small extra rings of DNA, separate from the chromosome, often carrying genes such as <strong>antibiotic resistance</strong>.",
    fact: "Bacteria can pass plasmids to each other — one way antibiotic resistance spreads. Biotechnologists use plasmids to insert genes into bacteria.",
  },
  flagellum: {
    name: "Flagellum", found: ["bacteria"], size: "≈ 20 nm wide, 5–10 µm long",
    fn: "A helical protein tail spun by a <strong>rotary motor</strong> in the membrane, pushing the bacterium through liquid.",
    fact: "The motor is powered by H⁺ ions flowing into the cell and can spin over 100 times per second (slowed down here). Sperm tails are a different, eukaryotic design.",
  },
  pili: {
    name: "Pili", found: ["bacteria"], size: "≈ 5–10 nm wide, ≈ 1 µm long",
    fn: "Short hair-like protein fibres used to <strong>attach</strong> to surfaces and other cells; a sex pilus can transfer DNA.",
    fact: "Some disease-causing bacteria use pili to grip the lining of your gut or urinary tract.",
  },
};

export function infoFor(id, type) {
  const base = INFO[id];
  if (type === "bacteria" && base.bact) return { ...base, ...base.bact };
  return base;
}

export const HUNT_CLUE = {
  mito: "the organelle that makes most of the cell's ATP (aerobic respiration)",
  ribosome: "a tiny structure that builds proteins (you'll need to zoom in!)",
  nucleus: "the control centre that holds the DNA",
  nucleolus: "the dense spot inside the nucleus where ribosomes are assembled",
  golgi: "the stack that packages proteins into vesicles",
  lysosome: "a sac of digestive enzymes",
  rer: "membranes studded with ribosomes that make proteins for export",
  ser: "ER without ribosomes that makes lipids",
  centriole: "the pair of cylinders that organise microtubules for cell division",
  chloroplast: "where photosynthesis happens",
  vacuole: "the large sac that keeps a plant cell turgid",
  cellwall: "the rigid outer layer that stops the cell bursting",
  membrane: "the selectively permeable boundary of the cell",
  peroxisome: "the organelle that breaks down hydrogen peroxide",
  vesicle: "a tiny bubble carrying cargo to the membrane",
  cytoskeleton: "protein filaments that act as tracks inside the cell",
  cytoplasm: "the jelly-like fluid where glycolysis happens",
  nucleoid: "where the bacterium's chromosome sits (no nucleus!)",
  plasmid: "a small ring of DNA that can carry antibiotic resistance",
  flagellum: "the spinning tail used for swimming",
  pili: "short hair-like fibres for sticking to surfaces",
  capsule: "the slimy protective outer coat",
};

export const LISTS = {
  animal: ["membrane", "cytoplasm", "nucleus", "nucleolus", "rer", "ser", "ribosome", "golgi", "mito", "lysosome", "peroxisome", "centriole", "cytoskeleton", "vesicle"],
  plant: ["cellwall", "membrane", "cytoplasm", "nucleus", "nucleolus", "rer", "ser", "ribosome", "golgi", "mito", "chloroplast", "vacuole", "peroxisome", "cytoskeleton", "vesicle"],
  bacteria: ["capsule", "cellwall", "membrane", "cytoplasm", "nucleoid", "plasmid", "ribosome", "flagellum", "pili"],
};
