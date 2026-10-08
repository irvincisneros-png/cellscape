// Single source of truth for the hub. Add a sim here and it appears on the homepage.
export const SIMS = [
  {
    slug: "cell-explorer", title: "Cell Explorer", theme: "structure",
    blurb: "Zoom from a whole cell down to ribosomes. Compare animal, plant and bacterial cells.",
    tags: ["Stage 4", "Bio Y11 M1"], motif: "cell",
  },
  {
    slug: "membrane-transport", title: "Membrane Transport", theme: "membrane",
    blurb: "Channels, carriers and the sodium–potassium pump. Build gradients, then poison the ATP supply.",
    tags: ["Bio Y11 M1"], motif: "membrane", featured: true,
  },
  {
    slug: "osmosis", title: "Osmosis & Tonicity", theme: "membrane",
    blurb: "Drop red blood cells and plant cells into salty water. Watch them swell, burst or shrivel.",
    tags: ["Stage 5", "Bio Y11 M1"], motif: "rbc",
  },
  {
    slug: "enzymes", title: "Enzyme Lab", theme: "energy",
    blurb: "Heat, acidify and inhibit enzymes. Find the optimum and watch the active site denature.",
    tags: ["Stage 5", "Bio Y11 M1"], motif: "enzyme",
  },
  {
    slug: "photosynthesis", title: "Photosynthesis", theme: "energy",
    blurb: "Move the lamp, change the light colour and CO₂ and find out what limits the rate.",
    tags: ["Stage 4–5", "Bio Y11 M1"], motif: "leaf",
  },
  {
    slug: "atp-synthase", title: "The ATP Factory", theme: "energy",
    blurb: "Pump protons down the electron transport chain and crank ATP synthase by hand.",
    tags: ["Bio Y11 M1"], motif: "rotor", featured: true,
  },
  {
    slug: "oxygen-transport", title: "Oxygen Transport", theme: "systems",
    blurb: "Follow a red blood cell from lungs to muscle. Exercise, climb Everest and test carbon monoxide.",
    tags: ["Bio Y11 M2"], motif: "hb",
  },
  {
    slug: "mitosis", title: "Mitosis", theme: "heredity",
    blurb: "Line up chromosomes, pull sister chromatids apart and pinch the cell in two.",
    tags: ["Bio Y12 M5"], motif: "mitosis",
  },
  {
    slug: "meiosis", title: "Meiosis & Variation", theme: "heredity",
    blurb: "Choose where crossing over happens, flip chromosome pairs and see how many different gametes you can make.",
    tags: ["Bio Y12 M5"], motif: "meiosis",
  },
  {
    slug: "protein-synthesis", title: "DNA to Protein", theme: "heredity",
    blurb: "Transcribe a gene, translate it codon by codon, then mutate it, starting with sickle-cell.",
    tags: ["Bio Y12 M5"], motif: "dna",
  },
];

export const THEMES = {
  structure: { label: "Cell structure", color: "#4fd1c5" },
  membrane: { label: "Moving across membranes", color: "#a78bfa" },
  energy: { label: "Energy & enzymes", color: "#fbbf24" },
  systems: { label: "Cells in systems", color: "#f87171" },
  heredity: { label: "Division & heredity", color: "#60a5fa" },
};
