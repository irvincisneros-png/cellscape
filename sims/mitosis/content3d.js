// Lens-aware text for the 3D cell-division level. Values are strings or { "y7-8", "y9-10", "y11", "y12" }.
// narrative() is generated from MitosisModel's live state (gates, attachments, drugs, counts), not just switches.
import { I, CHR3 } from "./model.js";

const CHR_NAME = (i, y7) => {
  const c = CHR3[i];
  if (y7) return `the ${c.pair === 1 ? "long" : "short"} ${c.mat ? "pink" : "blue"} chromosome`;
  return `chromosome ${c.pair} (${c.mat ? "maternal, pink" : "paternal, blue"})`;
};
export { CHR_NAME };

// ---------- parts (hover tooltip + Selected card) ----------
export const PARTS = {
  chromatid: {
    name: { "y7-8": "Chromosome", "y9-10": "Chromosome", y11: "Chromosome (sister chromatids)" }, color: "#f472b6",
    role: {
      "y7-8": "A chromosome is one long DNA molecule. Before a cell divides it copies each chromosome, so there are two identical copies joined in the middle. Pink ones came from the mother, blue ones from the father.",
      "y9-10": "Each chromosome is one DNA molecule. After S phase it is two identical <strong>sister chromatids</strong> held together by cohesin and joined at the <strong>centromere</strong>. This cell is <strong>2n = 4</strong>: a long pair and a short pair (pink maternal, blue paternal).",
      y11: "A replicated chromosome: two sister chromatids (identical DNA molecules from S phase) held by cohesin. Condensin compacts each chromatid ≈ 10 000× for mitosis. Homologues (same length, different colour) are not paired in mitosis — they line up independently.",
    },
  },
  kinetochore: {
    name: "Kinetochore", color: "#fde68a",
    role: {
      "y7-8": "A tiny 'hook' on each copy where the spindle fibres grab on. While a hook has no fibre, it sends a 'wait!' signal (the glow). Tap one to unhook it!",
      "y9-10": "A protein structure on the centromere of each sister chromatid where spindle microtubules attach. An unattached kinetochore glows: it sends a <strong>wait signal</strong> that stops anaphase. Tap one to knock its microtubules off.",
      y11: "Protein complex built on centromeric DNA. It grips the plus ends of kinetochore microtubules and couples their shortening to movement. Unattached (or tensionless) kinetochores catalyse the mitotic checkpoint complex (Mad2, BubR1…) that inhibits APC/C–Cdc20: the <strong>spindle assembly checkpoint</strong>. Tap one to detach it.",
    },
  },
  cohesin: {
    name: { "y7-8": "Cohesin 'glue' rings", "y9-10": "Cohesin", y11: "Cohesin rings" }, color: "#fb923c",
    role: {
      "y7-8": "Rings of protein that hold the two copies together until the right moment.",
      "y9-10": "Ring-shaped proteins that hold sister chromatids together from S phase until anaphase. An enzyme called <strong>separase</strong> cuts them so the sisters can separate.",
      y11: "Cohesin (Smc1–Smc3–Scc1/Rad21) entraps both sister DNAs from replication. Most arm cohesin is removed in prophase; centromeric cohesin is protected until APC/C destroys securin, releasing separase to cleave Scc1. Rings here are enlarged — real ones are ~40 nm.",
    },
  },
  separase: {
    name: "Separase", color: "#fb7185",
    role: {
      "y7-8": "Protein 'scissors' that cut the glue rings so the copies can be pulled apart.",
      "y9-10": "An enzyme kept switched off until every chromosome is attached. Then it cuts cohesin and anaphase starts.",
      y11: "A protease held inactive by securin. When the SAC is satisfied, APC/C–Cdc20 ubiquitinates securin (and cyclin B) for destruction; free separase cleaves Scc1, opening the cohesin rings.",
    },
  },
  mt: {
    name: { "y7-8": "Spindle fibres", "y9-10": "Spindle microtubules", y11: "Microtubules" }, color: "#5eead4",
    role: {
      "y7-8": "Thin protein tubes that grow, shrink and pull the chromosomes apart.",
      "y9-10": "Hollow tubes of tubulin protein. They grow and shrink constantly (<strong>dynamic instability</strong>) to search for kinetochores. <strong>Kinetochore fibres</strong> pull chromosomes; <strong>polar (interpolar) fibres</strong> overlap in the middle and push the poles apart.",
      y11: "αβ-tubulin polymers with dynamic plus ends: GTP-capped tips grow, lose the cap and suddenly shrink (catastrophe), then may be rescued. Types: kinetochore fibres (K-fibres), interpolar MTs (kinesin-5 slides them apart: anaphase B) and, in animal cells, astral MTs (cortical dynein pulls on them). Colchicine stops them forming; taxol stops them shrinking.",
    },
  },
  pole: {
    name: { "y7-8": "Spindle pole", y11: "Spindle pole" }, color: "#fbbf24",
    role: {
      plant: {
        "y7-8": "The end of the spindle. Plant cells don't have centrosomes — the fibres gather into broad ends by themselves.",
        "y9-10": "Flowering-plant cells have <strong>no centrosomes or centrioles</strong>. Microtubules start from the surface of the nucleus and in the spindle itself, and gather into broad, unfocused poles.",
        y11: "Acentrosomal pole: γ-tubulin ring complexes nucleate MTs on the nuclear envelope (polar caps in prophase) and along existing MTs (augmin), and motors focus them into a barrel-shaped spindle with broad poles.",
      },
      animal: {
        "y7-8": "A centrosome: the anchor for the spindle fibres at each end of the cell.",
        "y9-10": "The <strong>centrosome</strong> (a pair of centrioles in a protein cloud) organises microtubules. It copied itself in S phase; the two move apart in prophase to form the spindle poles.",
        y11: "Centrosome: two orthogonal centrioles (9 triplet MTs) in pericentriolar material rich in γ-tubulin. Duplicated once per cycle (S phase); separated by kinesin-5 in prophase. Astral MTs radiate from it to the cortex.",
      },
    },
  },
  nucleus: {
    name: "Nucleus", color: "#a78bfa",
    role: {
      "y7-8": "Holds the DNA. It breaks open so the chromosomes can be moved, then two new nuclei form.",
      "y9-10": "The nuclear envelope breaks down in prometaphase so the spindle can reach the chromosomes, and re-forms around each set in telophase. Tap it in Do-it-yourself S phase to copy the DNA.",
      y11: "CDK1 phosphorylates lamins and nucleoporins, so the envelope disassembles (open mitosis, in plants too). Dephosphorylation after cyclin B destruction lets it re-form around each chromosome set in telophase.",
    },
  },
  nucleolus: {
    name: "Nucleolus", color: "#7c5cc4",
    role: { "y7-8": "Where ribosome parts are made. It disappears during division and comes back after.", y11: "Site of rRNA transcription and ribosome assembly. It disperses as transcription stops in prophase and re-forms on the rRNA genes (NORs) in telophase." },
  },
  ppb: {
    name: { "y7-8": "Ring of fibres (marks where the cell will split)", "y9-10": "Preprophase band", y11: "Preprophase band (PPB)" }, color: "#86efac",
    role: {
      "y7-8": "Before a plant cell divides, a belt of fibres forms just inside the cell wall. It marks exactly where the new wall will be built.",
      "y9-10": "A belt of microtubules under the plasma membrane that appears in G2 and prophase. It marks the <strong>division plane</strong>: the new cell plate later joins the old wall right here. Only plant cells have it.",
      y11: "A cortical ring of microtubules and actin (land plants only). It disassembles at prometaphase but leaves a 'cortical division zone' of proteins that later guides the phragmoplast, so the cell plate fuses with the parent wall at the PPB site.",
    },
  },
  phragmoplast: {
    name: "Phragmoplast", color: "#5eead4",
    role: {
      "y7-8": "Fibres that carry building materials to the middle of the cell to build a new wall.",
      "y9-10": "A ring of microtubules between the two new nuclei. It carries vesicles from the <strong>Golgi</strong> to the middle, where they fuse to build the <strong>cell plate</strong>. It moves outward as the plate grows.",
      y11: "Two opposing arrays of microtubules (plus ends at the midplane) plus actin. Kinesins carry Golgi-derived vesicles to the midzone; the array depolymerises in the centre and re-forms at the edge, so the plate grows centrifugally toward the cortical division zone.",
    },
  },
  plate: {
    name: { "y7-8": "New cell wall (cell plate)", "y9-10": "Cell plate" }, color: "#bef264",
    role: {
      "y7-8": "A new wall built from the middle outward. Plant cells have a stiff wall, so they can't pinch in two — they build a wall between the new cells instead.",
      "y9-10": "Golgi vesicles full of wall material (pectins, hemicellulose) fuse in the middle and grow outward until they join the old wall. It becomes the <strong>middle lamella</strong> and new walls of both daughter cells.",
      y11: "Vesicle fusion gives a tubulo-vesicular network, then a callose-rich plate that matures with cellulose (made by cellulose synthase in the new plasma membrane). Trapped ER strands become plasmodesmata linking the daughter cells.",
    },
  },
  vesicle: {
    name: { "y7-8": "Bubbles from the Golgi", "y9-10": "Golgi vesicles" }, color: "#f9a8d4",
    role: {
      "y7-8": "Tiny packages from the Golgi carrying cell-wall material to the new wall.",
      "y9-10": "Vesicles budded from the <strong>Golgi apparatus</strong> carry wall polysaccharides along the phragmoplast to the cell plate — the same Golgi you saw in the plant cell.",
      y11: "Golgi-derived secretory vesicles (with pectins and hemicelluloses, plus enzymes such as callose synthase) move along phragmoplast MTs and fuse at the midplane. Plant cells divide only if the secretory pathway works.",
    },
  },
  golgi: { name: { "y7-8": "Golgi", "y9-10": "Golgi stack" }, color: "#f472b6", role: { "y7-8": "Packs materials into vesicles.", "y9-10": "Plant cells have many small Golgi stacks. In cytokinesis they supply the vesicles that build the cell plate.", y11: "Dictyosomes: plant Golgi stacks that keep working through mitosis and supply cell-plate vesicles (the secretory pathway you followed in the plant cell)." } },
  ring: {
    name: { "y7-8": "Squeezing ring", "y9-10": "Contractile ring (cleavage furrow)" }, color: "#f87171",
    role: {
      "y7-8": "A belt of protein that tightens around the middle of an animal cell and pinches it in two.",
      "y9-10": "A ring of <strong>actin and myosin</strong> just under the membrane. Myosin motors slide the actin filaments, tightening the ring like a drawstring: the <strong>cleavage furrow</strong>. Animal cells have no wall, so they can pinch.",
      y11: "Actomyosin ring positioned by signals from the spindle midzone and asters (RhoA activation via centralspindlin). Myosin II pulls antiparallel actin filaments; the furrow ingresses, a midbody forms and abscission separates the daughters.",
    },
  },
  wall: { name: "Cell wall", color: "#86efac", role: { "y7-8": "The stiff outer layer of a plant cell.", "y9-10": "The rigid wall is why plant cells can't pinch in two and build a cell plate instead.", y11: "Primary wall (cellulose microfibrils in a pectin–hemicellulose matrix). It stops furrowing, so plants evolved the phragmoplast/cell plate." } },
  membrane: { name: { "y7-8": "Cell membrane", "y9-10": "Plasma membrane" }, color: "#4fd1c5", role: { "y7-8": "The cell's outer skin.", "y9-10": "In animal cells the plasma membrane is pulled inward by the contractile ring.", y11: "Membrane is added at the furrow by vesicle fusion as well as being pulled in." } },
  centriole: { name: "Centriole", color: "#fbbf24", role: { "y7-8": "Small tubes in the centrosome (animal cells only).", y11: "Barrel of nine microtubule triplets; one new daughter centriole grows beside each old one in S phase (only once per cycle)." } },
  mito: { name: "Mitochondrion", color: "#fb923c", role: { "y7-8": "Releases the energy (ATP) the cell needs to divide.", "y9-10": "Makes the ATP that powers DNA copying, motor proteins and microtubule growth. No ATP → no division.", y11: "Supplies ATP; GTP for tubulin comes from the same energy pool. Kinesins, dynein, myosin, helicase and the CDKs all consume ATP." } },
};

// ---------- the plant / animal comparison ----------
export const COMPARE = [
  { what: { "y7-8": "What holds the spindle", "y9-10": "Spindle poles" }, plant: { "y7-8": "No centrosomes — fibres gather by themselves", "y9-10": "No centrosomes or centrioles; broad poles" }, animal: { "y7-8": "Centrosomes at each end", "y9-10": "Centrosomes (centriole pairs) with asters" } },
  { what: { "y7-8": "Marking the split", "y9-10": "Division plane" }, plant: { "y7-8": "A ring of fibres marks it early (preprophase band)", "y9-10": "Preprophase band in G2/prophase" }, animal: { "y7-8": "Set late, by the spindle", "y9-10": "Set by the spindle in anaphase" } },
  { what: "Cytokinesis", plant: { "y7-8": "Builds a new wall from the middle out", "y9-10": "Phragmoplast + cell plate grows outward" }, animal: { "y7-8": "Pinches in from the outside", "y9-10": "Cleavage furrow pinches inward" } },
  { what: { "y7-8": "Afterwards", "y9-10": "Daughter cells" }, plant: { "y7-8": "Stay stuck together by the new wall", "y9-10": "Stay joined (shared wall, plasmodesmata)" }, animal: { "y7-8": "Separate and round up", "y9-10": "Separate (abscission)" } },
];

// ---------- phase text ----------
const PHASE = {
  G1: {
    "y7-8": "<strong>Growing (interphase).</strong> The cell does its normal jobs and grows. Its DNA is spread out as long thin threads inside the nucleus. It has <strong>4 chromosomes</strong>: two long and two short, one of each from each parent.",
    "y9-10": "<strong>Interphase – G1.</strong> The cell grows and makes proteins. The DNA is unwound <strong>chromatin</strong>. This cell is <strong>diploid (2n = 4)</strong>: one long and one short chromosome from each parent (pink maternal, blue paternal). Each chromosome is one DNA molecule.",
    y11: "<strong>G1.</strong> Growth and normal metabolism; cyclin B is kept low by APC/C–Cdh1. Each of the 4 chromosomes is a single chromatid (2C DNA). Passing the G1/S restriction point commits the cell to divide.",
  },
  S: {
    "y7-8": "<strong>Copying the DNA.</strong> Every chromosome is copied exactly. The copy stays stuck to the original.",
    "y9-10": "<strong>Interphase – S phase.</strong> <strong>DNA replication</strong>: each chromosome is copied into two identical <strong>sister chromatids</strong>, held together by cohesin. DNA doubles from <strong>2C to 4C</strong>, but there are still <strong>4 chromosomes</strong>.",
    y11: "<strong>S phase.</strong> Replication starts at many origins at once (forks glow) and is semi-conservative; cohesin is loaded as the forks pass, linking each new pair of sister chromatids. 2C → 4C, chromosome number unchanged.",
  },
  G2: {
    "y7-8": "<strong>Getting ready.</strong> The cell checks its copied DNA for mistakes before it divides.",
    "y9-10": "<strong>Interphase – G2.</strong> The cell keeps growing and <strong>checks the copied DNA for damage</strong> (the G2 checkpoint) before committing to divide.",
    y11: "<strong>G2.</strong> Cyclin B accumulates but cyclin B–CDK1 is held inactive by inhibitory phosphorylation (Wee1). If the DNA is intact, Cdc25 removes it and the switch flips: the cell enters mitosis.",
  },
  pro: {
    "y7-8": "<strong>Prophase.</strong> The long DNA threads coil up into short, thick chromosomes you could see with a microscope — each one an X of two identical copies.",
    "y9-10": "<strong>Prophase.</strong> Chromatin <strong>condenses</strong> into visible chromosomes, each two sister chromatids joined at the centromere. The nucleolus disappears and the <strong>spindle</strong> starts to form.",
    y11: "<strong>Prophase.</strong> Active cyclin B–CDK1 drives condensation (condensin), removes most arm cohesin, disperses the nucleolus and starts spindle assembly. Kinetochores mature on the centromeres.",
  },
  prometa: {
    "y7-8": "<strong>Prometaphase.</strong> The nucleus breaks open. Spindle fibres reach in and hook onto each chromosome.",
    "y9-10": "<strong>Prometaphase.</strong> The <strong>nuclear envelope breaks down</strong>. Microtubules grow and shrink, searching until they catch a <strong>kinetochore</strong>. Each chromosome must be caught from <strong>both poles</strong>, then it moves to the middle.",
    y11: "<strong>Prometaphase.</strong> Nuclear envelope breakdown lets dynamic microtubules 'search and capture' kinetochores. A mono-oriented chromosome drifts toward its pole until the sister kinetochore is captured from the other pole (bi-orientation); it then congresses to the equator. Wrong attachments lack tension and are released (Aurora B error correction).",
  },
  meta: {
    "y7-8": "<strong>Metaphase.</strong> All the chromosomes line up across the middle of the cell, each held by fibres from both ends.",
    "y9-10": "<strong>Metaphase.</strong> Chromosomes line up on the <strong>metaphase plate</strong>, sisters facing opposite poles. The cell waits until <strong>every kinetochore is attached and under tension</strong> (the spindle checkpoint).",
    y11: "<strong>Metaphase.</strong> Chromosomes sit bi-oriented on the plate, each pair of sister kinetochores pulled toward opposite poles (tension). Only when the last kinetochore is satisfied does the 'wait' signal stop and APC/C–Cdc20 switch on.",
  },
  ana: {
    "y7-8": "<strong>Anaphase.</strong> The glue is cut and the two copies of each chromosome are pulled to opposite ends of the cell.",
    "y9-10": "<strong>Anaphase.</strong> <strong>Separase cuts cohesin</strong>, so the sister chromatids separate. Kinetochore fibres shorten and pull each one to a pole; polar fibres push the poles apart. Each chromatid now counts as a chromosome: <strong>8 in the cell, 4 to each end</strong>.",
    y11: "<strong>Anaphase.</strong> APC/C destroys securin and cyclin B: separase cleaves cohesin. <strong>Anaphase A</strong>: kinetochore MTs depolymerise (kinetochore 'Pac-Man' + poleward flux), pulling chromatids poleward. <strong>Anaphase B</strong>: kinesin-5 slides interpolar MTs apart{ASTRAL}, separating the poles.",
  },
  telo: {
    "y7-8": "<strong>Telophase.</strong> Each end now has a full set of 4 chromosomes. A new nucleus forms around each set and the DNA unwinds.",
    "y9-10": "<strong>Telophase.</strong> Chromosomes reach the poles and <strong>decondense</strong>. A <strong>nuclear envelope re-forms</strong> around each set and nucleoli reappear. {CYTO_START}",
    y11: "<strong>Telophase.</strong> Low CDK1 activity lets phosphatases dephosphorylate lamins and nucleoporins: nuclear envelopes and nucleoli re-form and chromatin decondenses. {CYTO_START}",
  },
  cyto: {
    plant: {
      "y7-8": "<strong>Cytokinesis.</strong> Plant cells have a stiff wall, so they can't pinch in two. Instead they <strong>build a new wall</strong> (the cell plate) from the middle outward, using packages from the Golgi.",
      "y9-10": "<strong>Cytokinesis.</strong> The <strong>phragmoplast</strong> carries <strong>Golgi vesicles</strong> to the middle. They fuse into a <strong>cell plate</strong> that grows outward until it joins the old wall exactly where the preprophase band was.",
      y11: "<strong>Cytokinesis (plant).</strong> Golgi-derived vesicles travel along the phragmoplast and fuse at the midplane; the plate grows centrifugally as the phragmoplast re-forms at its edge, until it fuses with the parent wall at the cortical division zone.",
    },
    animal: {
      "y7-8": "<strong>Cytokinesis.</strong> A ring of protein around the middle tightens like a drawstring and pinches the cell into two.",
      "y9-10": "<strong>Cytokinesis.</strong> A <strong>contractile ring</strong> of actin and myosin tightens around the middle, forming a <strong>cleavage furrow</strong> that pinches the cell in two.",
      y11: "<strong>Cytokinesis (animal).</strong> The spindle midzone positions an actomyosin contractile ring (RhoA); myosin II constricts it, the furrow ingresses to a midbody and abscission separates the daughters.",
    },
  },
  done: {
    "y7-8": "<strong>Two new cells!</strong> Each has exactly the same 4 chromosomes as the parent cell. This is how plants and animals <strong>grow</strong> and <strong>repair</strong> damage.",
    "y9-10": "<strong>Two daughter cells.</strong> Each is <strong>diploid (2n = 4)</strong> with identical chromosomes — <strong>genetically identical</strong> to the parent. This is how organisms grow, repair tissue and reproduce <strong>asexually</strong> (e.g. plant cuttings, runners).",
    y11: "<strong>Two daughter cells</strong> in G1, each 2n = 4 and 2C: identical chromosome sets because each received one sister chromatid of every chromosome. Mitosis maintains the chromosome number and genetic continuity.",
  },
};

const TEL_CYTO = {
  plant: { "y9-10": "In plant cells the <strong>phragmoplast</strong> already starts building the cell plate.", y11: "In plants the phragmoplast forms from the anaphase midzone and starts the cell plate." },
  animal: { "y9-10": "The <strong>cleavage furrow</strong> is starting to form.", y11: "The cleavage furrow begins to ingress." },
};

// ---------- what the cell is waiting for (cause → effect chains) ----------
export function gateText(M, band) {
  const y7 = band === "y7-8", sen = band === "y11" || band === "y12";
  const pick = (v) => (typeof v === "string" ? v : v[band] ?? v[sen ? "y11" : band === "y9-10" ? "y9-10" : "y7-8"] ?? v["y9-10"] ?? v["y7-8"]);
  const g = M.gate;
  if (!g) return "";
  if (g === "atp") return pick({
    "y7-8": "⏸ <strong>Stalled: no energy.</strong> Copying DNA, building fibres and pulling chromosomes all need ATP from the mitochondria. With none, everything stops.",
    "y9-10": "⏸ <strong>Stalled: no ATP.</strong> DNA polymerase, motor proteins and microtubule growth all need energy. Restore the cell's ATP and the cycle carries on from here.",
    y11: "⏸ <strong>Stalled: ATP depleted.</strong> Helicases, kinesin/dynein/myosin, CDK phosphorylation and GTP-tubulin all draw on the cell's energy charge, so every step halts. (Real cells would also activate energy-stress checkpoints.)",
  });
  if (g === "damage") return pick({
    "y7-8": `⏸ <strong>Waiting: the DNA is damaged.</strong> The cell won't divide until it has repaired its DNA (${Math.round(M.damage * 100)}% left). This stops broken DNA being passed on.`,
    "y9-10": `⏸ <strong>G2 checkpoint holding.</strong> Damaged DNA has been detected, so the cell won't enter mitosis until repair is finished (${Math.round(M.damage * 100)}% damage left). This stops mutations being passed to daughter cells.`,
    y11: `⏸ <strong>G2/M checkpoint.</strong> Damage sensors (ATM/ATR) activate Chk1/Chk2, which block Cdc25, so cyclin B–CDK1 stays phosphorylated and inactive. Repair: ${Math.round((1 - M.damage) * 100)}% done.`,
  });
  if (g === "noCyclin") return pick({
    "y7-8": "⏸ <strong>Stuck before dividing.</strong> The cell is missing the 'go' signal protein, so it never starts dividing.",
    "y9-10": "⏸ <strong>Stuck in G2.</strong> Without <strong>cyclin B</strong>, the CDK enzyme that switches on mitosis can't work, so the cell never starts dividing.",
    y11: "⏸ <strong>Arrested in G2 (cyclin B knockout).</strong> CDK1 has no cyclin partner, so MPF never forms: no condensation, no envelope breakdown, no spindle. Watch the CDK1 line stay flat.",
  });
  if (g === "exitBlocked") return pick({
    "y7-8": "⏸ <strong>Stuck after splitting the copies.</strong> The 'divide' signal never switches off, so new nuclei can't form.",
    "y9-10": "⏸ <strong>Can't finish mitosis.</strong> Cyclin B can't be destroyed, so CDK stays on: the chromosomes stay condensed, no nuclei form and the cell doesn't divide.",
    y11: "⏸ <strong>Mitotic exit blocked (non-degradable cyclin B).</strong> APC/C still destroyed securin, so separase cut cohesin and anaphase A happened — but CDK1 stays active, so nuclear envelopes, decondensation and cytokinesis can't happen.",
  });
  if (g === "sac" || ((g === "align" || g === "trigger") && !M.sacOK && (M.colchicine || M.taxol || M.ach.detached))) {
    if (M.colchicine) return pick({
      "y7-8": `⏸ <strong>Stuck: no spindle fibres.</strong> Colchicine stops the fibres forming, so nothing can grab the chromosomes. The cell waits… (${Math.max(0, 12 - M.arrest).toFixed(0)} s)`,
      "y9-10": `⏸ <strong>Spindle checkpoint holding (colchicine).</strong> Colchicine stops microtubules forming, so no kinetochore can attach — every one sends the wait signal. ${M.arrest > 0 ? `After a long wait some cells give up and re-form a single nucleus with all 8 chromosomes (${Math.max(0, 12 - M.arrest).toFixed(0)} s).` : ""}`,
      y11: `⏸ <strong>C-metaphase arrest.</strong> Colchicine binds tubulin dimers and blocks polymerisation; with no microtubules all 8 kinetochores are unattached, the MCC keeps APC/C off and cyclin B stays high. Prolonged arrest → slippage: a restitution nucleus with all chromatids (4n) (${Math.max(0, 12 - M.arrest).toFixed(0)} s).`,
    });
    if (M.taxol) return pick({
      "y7-8": "⏸ <strong>Stuck: the fibres can't shrink</strong>, so they can't pull. The cell waits forever.",
      "y9-10": "⏸ <strong>Spindle checkpoint holding (taxol).</strong> The fibres are attached but can't shrink, so there is no pulling tension. The checkpoint senses this and anaphase never starts. That's why taxol is used to stop cancer cells dividing.",
      y11: "⏸ <strong>Mitotic arrest (taxol).</strong> Paclitaxel binds β-tubulin in the lattice and suppresses dynamic instability: kinetochores are occupied but under little tension, Aurora B keeps destabilising them and the SAC stays on. Many such cells die in mitosis — the basis of taxane chemotherapy.",
    });
    const list = M.unattachedList();
    const names = [...new Set(list.map(([i]) => i))].map((i) => CHR_NAME(i, y7));
    const tensionless = [0, 1, 2, 3].filter((i) => !M.tension(i) && M.attached(i, 0) && M.attached(i, 1));
    const n = list.length;
    return pick({
      "y7-8": `⏸ <strong>Waiting!</strong> ${names.length ? `${names.join(" and ")} isn't hooked on from both ends yet` : "A chromosome isn't lined up yet"}. Its glowing hook sends a 'wait' signal, so <strong>no</strong> chromosome is pulled apart. This makes sure each new cell gets one copy of every chromosome.`,
      "y9-10": `⏸ <strong>Spindle checkpoint holding.</strong> ${n ? `${n} kinetochore${n > 1 ? "s are" : " is"} unattached (on ${names.join(", ")})` : `${tensionless.length} chromosome${tensionless.length > 1 ? "s aren't" : " isn't"} under tension yet`}. ${n === 1 ? "Just one unattached kinetochore" : "Each unattached kinetochore"} sends a <strong>wait signal</strong> that keeps separase switched off, so cohesin holds <em>every</em> pair together.`,
      y11: `⏸ <strong>SAC active.</strong> ${n ? `${n} unattached kinetochore${n > 1 ? "s" : ""} on ${names.join(" and ")}` : "Attached but tensionless kinetochores"} catalyse Mad2 → MCC, which sequesters Cdc20: APC/C off → securin and cyclin B survive → separase inactive → cohesin intact on all chromosomes. One kinetochore is enough to hold the whole cell.`,
    });
  }
  return "";
}

// ---------- DIY tasks ----------
export function taskText(M, band) {
  const y7 = band === "y7-8", g = M.gate, plant = M.cellType === "plant";
  const k = M.k;
  const nRep = M.repOn.filter(Boolean).length;
  if (k === I.G1) return y7 ? "Your turn soon: wait for the copying stage (S phase)." : "Your turn soon: DNA can only be copied once the cell reaches <strong>S phase</strong>.";
  if (g === "rep") return `<strong>Your turn:</strong> tap the nucleus to copy each chromosome (${nRep}/4 started).`;
  if (g === "align") return M.colchicine
    ? "<strong>Your turn:</strong> try dragging a chromosome to the middle — with colchicine there are no fibres to hold it there."
    : `<strong>Your turn:</strong> drag each chromosome onto the glowing ring in the middle (the metaphase plate) — it snaps on when close (${M.nAligned}/4). ${y7 ? "" : "Curious? Press <em>Start anaphase</em> before they're all lined up."}`;
  if (g === "trigger") return M.sacOK || M.cpOff ? `<strong>Your turn:</strong> every kinetochore is attached and under tension — press <em>${y7 ? "Pull apart" : "Start anaphase"}</em>.` : "Something is unattached — drag it back onto the plate first.";
  if (g === "pull") return `<strong>Your turn:</strong> press and hold the button (or anywhere in the cell) to ${y7 ? "pull the copies apart" : "shorten the kinetochore fibres and pull the chromatids to the poles"}.`;
  if (g === "plate") return `<strong>Your turn:</strong> press and hold to ${y7 ? "send packages from the Golgi and build the new wall" : "deliver Golgi vesicles along the phragmoplast and grow the cell plate"} (${Math.round(M.diy.cyto * 100)}%).`;
  if (g === "pinch") return `<strong>Your turn:</strong> press and hold to ${y7 ? "tighten the ring" : "contract the actin–myosin ring and close the furrow"} (${Math.round(M.diy.cyto * 100)}%).`;
  if (k === I.done) return "Division complete! Press <strong>Reset</strong> to go again — try an experiment this time.";
  return plant ? "Watch this stage — your next task is coming up." : "Watch this stage — your next task is coming up.";
}

/** "What's happening" paragraphs from the live model. */
export function narrative(M, band) {
  const y7 = band === "y7-8", sen = band === "y11" || band === "y12";
  const pick = (v) => { if (v == null || typeof v === "string") return v || ""; for (const b of [band, sen ? "y11" : null, "y9-10", "y7-8"]) if (b && v[b] != null) return v[b]; return ""; };
  const plant = M.cellType === "plant", key = M.key, out = [];
  let ph = PHASE[key];
  if (ph.plant) ph = plant ? ph.plant : ph.animal;
  let t = pick(ph);
  if (M.restit && M.k >= I.ana) {
    t = pick({
      "y7-8": "<strong>The cell gave up on dividing.</strong> With no spindle fibres, the copies came apart but stayed in the same place, and one big nucleus formed around all <strong>8 chromosomes</strong>. The cell now has a double set!",
      "y9-10": "<strong>No division — a double set!</strong> After a long colchicine arrest the sister chromatids separated in place (no spindle to move them) and one nucleus re-formed around all <strong>8 chromosomes</strong>. The cell is now <strong>tetraploid (4n = 8)</strong>. Plant breeders use this to make polyploid crops.",
      y11: "<strong>Mitotic slippage → restitution nucleus.</strong> Cohesin is eventually released without a spindle (C-anaphase) and a single nucleus forms around all 8 chromatids: the cell is <strong>tetraploid (4n = 8, 4C)</strong> and skips cytokinesis. Colchicine doubling is how breeders make polyploids (e.g. tetraploid watermelon lines crossed with diploids to give seedless triploids).",
    });
  }
  if (M.gate === "sac" && (M.colchicine || M.taxol) && !M.restit) {
    t = `<strong>${M.key === "meta" ? "Metaphase" : "Prometaphase"} — arrested.</strong> ` + (M.colchicine
      ? pick({ "y7-8": "The chromosomes are copied and packed, but there are no fibres to line them up or pull them.", "y9-10": "The chromosomes are condensed but scattered: with no spindle they can't be lined up or separated.", y11: "Condensed chromosomes scattered through the cytoplasm with no spindle (C-metaphase)." })
      : pick({ "y7-8": "The fibres have hooked on but can't shrink to pull.", "y9-10": "The spindle has formed and chromosomes are attached, but frozen microtubules can't create pulling tension.", y11: "Kinetochores are occupied but microtubule dynamics are suppressed, so tension is low." }));
  }
  t = t.replace("{ASTRAL}", plant ? "" : " and cortical dynein pulls on astral MTs").replace("{CYTO_START}", pick(TEL_CYTO[plant ? "plant" : "animal"]));
  out.push(t);
  const gt = gateText(M, band);
  if (gt) out.push(`<span class="mi-gate">${gt}</span>`);
  // live cause → effect notes
  if (M.k === I.meta && !M.gate && M.sacOK && !sen && !y7) out.push("✓ All 8 kinetochores attached and under tension: the checkpoint is satisfied.");
  if (sen && M.k === I.meta && !M.gate && M.sacOK) out.push("✓ SAC satisfied: no MCC → APC/C–Cdc20 active → securin and cyclin B ubiquitinated → separase released.");
  if (M.k === I.ana && M.dest && M.cohesinMut && !M.restit) out.push(pick({
    "y7-8": "⚠ The glue on the long pink chromosome <strong>can't be cut</strong>, so both copies are dragged to the <strong>same end</strong>!",
    "y9-10": "⚠ <strong>Nondisjunction:</strong> separase can't cut the cohesin on chromosome 1 (pink), so its sisters stay together and both are dragged to the <strong>left pole</strong>.",
    y11: "⚠ <strong>Nondisjunction:</strong> separase-resistant cohesin keeps chromosome 1's sisters linked; one pole wins the tug-of-war (in real cells the chromatin may instead bridge and break).",
  }));
  if (M.k >= I.ana && M.dest && !M.cohesinMut && M.cpOff && M.splitAt?.aneuploid !== false) {
    const o = M.outcome();
    if (o.aneuploid) out.push(pick({ "y7-8": "⚠ With no checkpoint, the cell split before every chromosome was hooked on — one end got both copies of a chromosome!", "y9-10": "⚠ Checkpoint off: anaphase started with an unattached kinetochore, so both sisters of that chromosome went to the same pole.", y11: "⚠ SAC knocked out (e.g. Mad2 loss): anaphase began with a mono-oriented chromosome, so both sisters segregated to one pole — chromosomal instability, typical of cancer cells." }));
  }
  if (M.k === I.done && M.splitAt) {
    const o = M.splitAt;
    if (o.single) {} // restitution text already explains
    else if (o.aneuploid) out.push(pick({
      "y7-8": `⚠ <strong>The new cells are different!</strong> One got ${o.left} chromosomes and the other ${o.right}. Cells with the wrong number usually don't work properly.`,
      "y9-10": `⚠ <strong>Aneuploid daughters:</strong> left has <strong>${o.left}</strong> chromosomes (${o.left > 4 ? "2n + 1, trisomy" : "2n − 1, monosomy"}), right has <strong>${o.right}</strong> (${o.right > 4 ? "2n + 1, trisomy" : "2n − 1, monosomy"}). Such cells usually malfunction or die; in body tissues aneuploidy is linked to cancer.`,
      y11: `⚠ <strong>Aneuploidy:</strong> ${o.left} vs ${o.right} chromosomes (${o.left > 4 ? "trisomic" : "monosomic"} / ${o.right > 4 ? "trisomic" : "monosomic"} for one chromosome). A somatic variant like this is passed to all descendants of each daughter — a hallmark of tumour cells, not inherited by offspring unless it happens in the germline.`,
    }));
    if (o.damage) out.push(pick({ "y7-8": "⚠ The cell divided with damaged DNA, so both new cells carry the damage.", "y9-10": "⚠ With the G2 checkpoint off, the cell divided before repairing its DNA: both daughters inherit the <strong>mutations</strong>.", y11: "⚠ G2/M checkpoint bypassed: unrepaired lesions were replicated/segregated into both daughters as somatic variants — one route to tumour formation." }));
    if (plant && !o.single) out.push(pick({ "y7-8": "Plant daughter cells stay joined by the new wall.", "y9-10": "The plant daughter cells stay joined: the cell plate became a new shared wall, with channels (plasmodesmata) linking them.", y11: "Plant daughters stay connected through the new wall via plasmodesmata (ER trapped in the plate) — plant cells never migrate apart." }));
  }
  if (M.damage > 0.02 && M.k <= I.G2 && M.gate !== "damage") out.push(pick({ "y7-8": "⚠ The DNA is damaged — repairs are happening.", "y9-10": `⚠ DNA damage detected — repair enzymes are fixing it (${Math.round((1 - M.damage) * 100)}%).`, y11: `⚠ DNA lesions present (repair ${Math.round((1 - M.damage) * 100)}%). ${M.cpOff ? "Checkpoints are off, so nothing will stop the cell dividing anyway." : "The G2/M checkpoint will hold CDK1 off until repair finishes."}` }));
  if (M.taxol && M.k >= I.pro && M.k <= I.meta && M.gate !== "sac") out.push(pick({ "y7-8": "Taxol is freezing the fibres.", "y9-10": "Taxol: microtubules grow but can't shrink — watch the tips stop flickering.", y11: "Taxol: dynamic instability suppressed (no catastrophes) — the search-and-capture flicker stops." }));
  if (M.colchicine && M.k < I.pro) out.push(pick({ "y7-8": "Colchicine has been added: no spindle fibres can form.", "y9-10": "Colchicine added: microtubules can't form, so this cell won't be able to build a spindle.", y11: "Colchicine present: tubulin can't polymerise — the interphase microtubule arrays have already gone." }));
  return out;
}

// ---------- missions ----------
export const MISSIONS = [
  { maxBand: "y9-10", text: { "y7-8": "Watch the cell divide into two new cells", "y9-10": "Watch a full cell cycle end in two daughter cells", y11: "Watch a complete cycle: G1 → S → G2 → M → two daughter cells" }, check: (M) => M.ach.divided },
  { maxBand: "y7-8", text: { "y7-8": "Do it yourself: copy all 4 chromosomes", "y9-10": "Do it yourself: replicate all 4 chromosomes in S phase" }, check: (M) => M.ach.diyRep },
  { band: "y9-10", text: "Do it yourself: drag all 4 chromosomes onto the metaphase plate (both kinetochores attach)", check: (M) => M.ach.diyAligned },
  { text: { "y7-8": "Unhook a chromosome (tap a glowing hook) and see that NOTHING gets pulled apart until it's fixed", "y9-10": "Tap a kinetochore to detach it and watch the spindle checkpoint hold anaphase", y11: "Detach one kinetochore in metaphase: one unattached kinetochore holds the whole cell (SAC)" }, check: (M) => M.ach.sacHeld || M.ach.sacBlocked },
  { maxBand: "y11", text: { "y7-8": "Divide a plant cell AND an animal cell — spot the difference", "y9-10": "Divide both a plant cell (cell plate) and an animal cell (cleavage furrow)" }, check: (M) => M.ach.dividedPlant && M.ach.dividedAnimal },
  { maxBand: "y7-8", text: "Switch off the energy supply and watch division stop", check: (M) => M.ach.atpStall },
  { band: "y9-10", text: { "y9-10": "Make cohesin uncuttable, divide, then count the chromosomes in each daughter", y11: "Nondisjunction: separase-resistant cohesin → count the aneuploid daughters" }, check: (M, s) => M.ach.ndDivided && s.counted },
  { band: "y9-10", maxBand: "y9-10", text: "Damage the DNA in G2 and watch the G2 checkpoint hold the cell", check: (M) => M.ach.g2Held },
  { band: "y11", text: "Use colchicine to arrest the cell and make a tetraploid (4n) cell", check: (M) => M.ach.tetraploid },
  { band: "y11", text: "Knock out cyclin B (or make it non-degradable) and find where the cycle stops", check: (M) => M.ach.noCyclin || M.ach.exitBlocked },
  { band: "y12", text: "Turn the checkpoints off, detach a kinetochore and produce aneuploid daughters (a cancer-like cell)", check: (M) => M.ach.cpOffAneuploid },
];

// ---------- quiz ----------
export const QUIZ = [
  { maxBand: "y7-8", q: "Why do cells divide by mitosis?", options: ["To make sex cells", "So an organism can grow and repair damaged parts", "To get rid of old DNA", "To change their DNA"], answer: 1, why: "Mitosis makes new, identical cells for growth and repair (and for asexual reproduction)." },
  { maxBand: "y7-8", q: "Before a cell divides, what happens to its DNA?", options: ["It is copied", "It is destroyed", "Half of it is thrown away", "It turns into protein"], answer: 0, why: "Every chromosome is copied in S phase, so each new cell can get a full set." },
  { maxBand: "y7-8", q: "How is a plant cell's division different from an animal cell's?", options: ["Plant cells don't copy their DNA", "Plant cells build a new wall across the middle instead of pinching in two", "Plant cells make three cells", "There is no difference"], answer: 1, why: "A stiff wall means a plant cell can't pinch. It builds a cell plate from the middle outward." },
  { maxBand: "y7-8", q: "The cell has 4 chromosomes. After mitosis each new cell has…", options: ["2", "4", "8", "1"], answer: 1, why: "Mitosis keeps the number the same: each daughter gets one copy of every chromosome." },
  { maxBand: "y7-8", q: "What does the cell need to divide?", options: ["Nothing — it happens by itself", "Energy (ATP) from respiration", "Only water", "Light"], answer: 1, why: "Copying DNA and pulling chromosomes uses energy. Block ATP and division stalls." },
  { band: "y9-10", maxBand: "y9-10", q: "Which is the correct order of the phases of mitosis?", options: ["Prophase → Prometaphase → Metaphase → Anaphase → Telophase", "Prophase → Metaphase → Prometaphase → Telophase → Anaphase", "Metaphase → Prophase → Anaphase → Telophase → Prometaphase", "Anaphase → Metaphase → Prophase → Telophase → Prometaphase"], answer: 0, why: "Condense, attach, line up, separate, re-form nuclei — then cytokinesis divides the cytoplasm." },
  { band: "y9-10", maxBand: "y9-10", q: "At metaphase this cell has 4 chromosomes. How many chromatids?", options: ["2", "4", "8", "16"], answer: 2, why: "Each replicated chromosome = 2 sister chromatids: 4 × 2 = 8." },
  { band: "y9-10", maxBand: "y9-10", q: "One kinetochore is unattached. What happens?", options: ["Only that chromosome waits", "The whole cell waits — no chromosome separates until it attaches", "The cell divides anyway", "That chromosome is destroyed"], answer: 1, why: "The wait signal blocks the enzyme that cuts cohesin in every chromosome, so one lagging chromosome holds them all." },
  { band: "y9-10", maxBand: "y9-10", q: "Mitosis is used in asexual reproduction because the offspring are…", options: ["genetically identical to the parent", "a mix of two parents", "haploid", "always mutated"], answer: 0, why: "Each daughter gets an exact copy of every chromosome — clones (e.g. strawberry runners, cuttings)." },
  { band: "y9-10", maxBand: "y9-10", q: "Why does a plant cell form a cell plate rather than a cleavage furrow?", options: ["It has no actin", "Its rigid cell wall can't be pinched inward", "It has no Golgi", "It has centrioles"], answer: 1, why: "Golgi vesicles build a new wall from the middle out (phragmoplast → cell plate)." },
  { band: "y11", q: "What directly allows sister chromatids to separate at anaphase?", options: ["Microtubules snapping the centromere", "Separase cleaving cohesin after APC/C destroys securin", "DNA ligase cutting the DNA", "The nuclear envelope reforming"], answer: 1, why: "SAC satisfied → APC/C–Cdc20 → securin destroyed → separase cuts Scc1 → sisters part. Try the uncuttable-cohesin mutation." },
  { band: "y11", q: "A cell treated with colchicine arrests in metaphase because…", options: ["DNA can't replicate", "no microtubules form, so kinetochores stay unattached and the SAC stays on", "cohesin is destroyed early", "cyclin B can't be made"], answer: 1, why: "Colchicine blocks tubulin polymerisation. Prolonged arrest can give a restitution nucleus — doubling the chromosome number (polyploidy)." },
  { band: "y11", maxBand: "y11", q: "Which statement about plant and animal cell division is correct?", options: ["Only animal cells have a spindle", "Plant cells have a preprophase band and build a cell plate; animal cells use centrosomes and a contractile ring", "Plant cells don't replicate DNA", "Animal cells form a phragmoplast"], answer: 1, why: "Same chromosome behaviour, different spindle organisation and cytokinesis." },
  { band: "y11", q: "DNA damage in G2 stops the cell entering mitosis by…", options: ["destroying the spindle", "keeping cyclin B–CDK1 inactive (Chk1 blocks Cdc25)", "removing cohesin", "speeding up S phase"], answer: 1, why: "The G2/M checkpoint holds the CDK switch off until the DNA is repaired." },
  { band: "y11", maxBand: "y11", q: "DNA per cell: G1 = 2C. What is it in G2 and in each daughter?", options: ["4C, then 2C", "2C, then 1C", "4C, then 4C", "8C, then 4C"], answer: 0, why: "Replication doubles DNA (4C); mitosis shares it equally (2C each). See the DNA graph." },
  { band: "y12", q: "Cells with non-degradable cyclin B separate their sisters but don't exit mitosis. This shows that…", options: ["cyclin B is needed for replication", "sister separation needs securin destruction, but mitotic exit needs cyclin B destruction", "cohesin depends on cyclin B", "CDK1 makes the spindle"], answer: 1, why: "APC/C targets both: securin (→ separase → anaphase) and cyclin B (→ CDK1 off → exit, nuclei, cytokinesis)." },
  { band: "y12", q: "Loss of the spindle checkpoint (e.g. Mad2) in a tumour leads to…", options: ["slower division only", "chromosome mis-segregation and aneuploid somatic cells", "haploid gametes", "no effect"], answer: 1, why: "Anaphase starts with unattached chromosomes; daughters gain or lose chromosomes — chromosomal instability." },
  { band: "y12", q: "Taxol (paclitaxel) is used in chemotherapy because it…", options: ["stops DNA replication", "stabilises microtubules so dividing cells arrest in mitosis and often die", "cuts cohesin", "blocks the G1 checkpoint"], answer: 1, why: "Suppressed microtubule dynamics → no tension → SAC arrest → apoptosis in rapidly dividing cells." },
];
