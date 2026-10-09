// Lens-aware text for the immune defence level. Each value may be a plain string or { "y7-8", "y9-10", "y11", "y12" } (lens.pick).
import { DETECT } from "./immunityModel.js";

export const NOTE = {
  "y7-8": "A cut lets germs into the body. Watch how your body's defences find them, eat them and remember them. Everything is a simplified model, and cell sizes are to scale.",
  "y9-10": "A wound in the skin next to a small blood vessel. Sizes are to scale (a bacterium is about 2 µm, a neutrophil about 12 µm). Cell numbers, timings and levels are simplified teaching values, not measurements.",
  y11: "A skin wound beside a post-capillary venule. Cell sizes are to scale, but the numbers of cells, the time course and the antibody levels are relative, teaching-scale values. Not modelled: complement, fever feedback, germinal-centre affinity maturation, tissue repair and T-cell trafficking time.",
};

export const STAGES = [
  { id: "wound", label: { "y7-8": "1 · The cut", "y9-10": "1 · Wound", y11: "1 · Wound + innate" } },
  { id: "phago", label: { "y7-8": "2 · Eating germs", "y9-10": "2 · Phagocytosis", y11: "2 · Phagocytosis" } },
  { id: "node", label: { "y7-8": "3 · Memory & antibodies", "y9-10": "3 · Lymph node", y11: "3 · Adaptive (lymph node)" } },
];

export const STAGE_BLURB = {
  wound: {
    "y7-8": "The cut has let germs in. Your body reacts in minutes: the blood vessel widens, white blood cells squeeze out and swallow the germs.",
    "y9-10": "<b>Barrier breached.</b> Damaged cells send out danger signals and mast cells release <b>histamine</b>. The vessel widens (more blood flow: red and warm) and becomes leaky (swelling). Macrophages release chemical messengers that call in white blood cells: neutrophils squeeze out (diapedesis) and follow the chemical trail (chemotaxis).",
    y11: "<b>Innate response.</b> Damaged cells release danger signals; mast cells release histamine, which dilates the venule (more blood flow: redness, heat) and increases its permeability (oedema). Macrophages sense microbial patterns and release cytokines and chemokines (interleukins, TNF-α) that make the endothelium display adhesion molecules, so neutrophils roll, adhere, undergo diapedesis and follow the chemokine gradient (recruitment).",
  },
  phago: {
    "y7-8": "A macrophage is a big white blood cell. Watch it wrap around a germ, trap it in a bubble, and digest it with chemicals from its recycling bags.",
    "y9-10": "<b>Phagocytosis, step by step.</b> The macrophage wraps pseudopodia around the bacterium, seals it into a phagosome, a lysosome fuses with it, and enzymes digest it. These are the same lysosomes you met in the animal cell.",
    y11: "<b>Phagocytosis.</b> Receptors bind the bacterium (more strongly if it is opsonised by antibody); actin-driven pseudopodia engulf it into a phagosome; lysosomes fuse to make a phagolysosome (acid, hydrolases, reactive oxygen); the bacterium is digested and fragments can be presented on MHC.",
  },
  node: {
    "y7-8": "Special cells carry a piece of the germ to a lymph node, where other white blood cells learn to make antibodies. Some of them stay behind as memory cells.",
    "y9-10": "<b>Adaptive response.</b> A dendritic cell shows a piece of the pathogen (antigen) to a helper T cell. Helper T cells activate B cells, which become plasma cells that make antibodies. Memory cells remain.",
    y11: "<b>Adaptive response.</b> A dendritic cell presents peptide on MHC class II to a helper T cell with a matching T-cell receptor. That T cell then gives <em>linked</em> help to a B cell that has taken up the same antigen (peptide on its own MHC II, plus interleukins), so the B cell expands into plasma and memory cells. Interleukins also support cytotoxic T cells. Regulatory T cells damp the response down afterwards.",
  },
};

export const PHAGO_STEPS = [
  { title: { "y7-8": "1. Wrap", y11: "1. Recognition and pseudopodia" }, text: {
    "y7-8": "The macrophage spots the germ and stretches arms of its cell membrane around it.",
    "y9-10": "The macrophage's receptors bind the bacterium and the cell stretches out <b>pseudopodia</b> (\"false feet\") that wrap around it.",
    y11: "Pattern-recognition receptors (and Fc receptors, if antibody has coated the bacterium) bind it. Actin polymerisation drives <b>pseudopodia</b> around the particle in a zipper-like way.",
  } },
  { title: { "y7-8": "2. Bubble", y11: "2. Phagosome forms" }, text: {
    "y7-8": "The arms meet and close up, trapping the germ inside a bubble.",
    "y9-10": "The membrane seals around the bacterium and pinches off inside the cell as a bubble called a <b>phagosome</b>.",
    y11: "The pseudopodia fuse and the particle is internalised in a membrane-bound <b>phagosome</b>. The phagosome moves inwards along the cytoskeleton.",
  } },
  { title: { "y7-8": "3. Recycling bags arrive", y11: "3. Lysosome fusion" }, text: {
    "y7-8": "Little recycling bags full of strong chemicals (lysosomes) join onto the bubble.",
    "y9-10": "<b>Lysosomes</b> (bags of digestive enzymes) fuse with the phagosome. The combined bubble is a <b>phagolysosome</b>.",
    y11: "Lysosomes fuse with the phagosome to form a <b>phagolysosome</b>: it acidifies (about pH 4.5–5), and receives hydrolases and (in phagocytes) reactive oxygen species.",
  } },
  { title: { "y7-8": "4. Digested", y11: "4. Digestion" }, text: {
    "y7-8": "The chemicals break the germ into tiny pieces. The cell reuses or gets rid of them.",
    "y9-10": "Enzymes break the bacterium down into small molecules, which the cell reuses or removes. Some fragments are kept to show other immune cells.",
    y11: "Hydrolases digest the bacterium. Small molecules are recycled, residual material is expelled by exocytosis, and some peptides are loaded onto <b>MHC class II</b> and displayed to helper T cells, which links innate and adaptive immunity.",
  } },
];

// Selected-part cards. portal/sim are not used here (no child levels).
export const PARTS = {
  epidermis: {
    name: { "y7-8": "Skin", "y9-10": "Skin (epidermis)", y11: "Epidermis" }, color: "#f3c8a8",
    role: {
      "y7-8": "Your skin is the <strong>first barrier</strong> against germs. It is made of many layers of tightly packed cells, with a tough, waterproof outer layer of dead cells. Germs cannot easily get through unless the skin is cut.",
      "y9-10": "Skin is part of the <strong>first line of defence</strong>. The outer layer is dead, tough cells filled with keratin. Sweat and oils make the surface acidic and salty, and harmless microbes living on it compete with harmful ones. Other barriers include mucus and cilia in the airways, tears and saliva (which contain lysozyme), and acid in the stomach.",
      y11: "The <strong>stratum corneum</strong> (dead, keratinised cells) and tight junctions between living keratinocytes form a physical barrier. Chemical barriers include the acidic surface (about pH 5), sebum, defensins and other antimicrobial peptides, and lysozyme in tears and saliva. The normal skin microbiota compete with pathogens. These barriers are all part of <strong>innate</strong> immunity: they do not depend on recognising one particular antigen. The layers here are stylised and much thinner than real skin.",
    },
    note: "Layers are stylised: real epidermis is about 50–100 µm thick, and the stratum corneum has many more layers.",
  },
  cut: {
    name: { "y7-8": "The cut", "y9-10": "Breach in the barrier", y11: "Breach in the barrier" }, color: "#f87171",
    role: {
      "y7-8": "A cut breaks the skin barrier. Germs on the skin can slip through and reach the soft tissue underneath.",
      "y9-10": "A cut or graze breaks the physical barrier. Bacteria from the skin or the environment can now enter the tissue below, where there is warmth, moisture and nutrients. Damaged cells release chemical signals that start the inflammatory response.",
      y11: "Wounding breaches the epithelial barrier. Pathogen-associated molecular patterns (such as bacterial cell-wall components) and damaged-cell signals activate resident macrophages and mast cells, which begin <strong>inflammation</strong>.",
    },
  },
  bacterium: {
    name: { "y7-8": "Bacteria", "y9-10": "Bacterium (rod-shaped bacillus)", y11: "Bacterium (bacillus)" }, color: "#a3e635",
    role: {
      "y7-8": "Bacteria are tiny living things made of a single cell. Some cause disease. Compare their size with the white blood cells: a bacterium is about <strong>2 µm</strong> long, and a neutrophil is about 12 µm across.",
      "y9-10": "A bacterium is a single-celled <strong>cellular</strong> pathogen with no nucleus (it is prokaryotic). It has a cell wall and some have flagella for swimming. It multiplies by binary fission, so numbers can double every 20–60 minutes in good conditions. Molecules on its surface are <strong>antigens</strong>: they are what the immune system recognises.",
      y11: "A prokaryotic, <strong>cellular</strong> pathogen (bacteria, protozoa and fungi are cellular; viruses and prions are not). It carries a cell wall, ribosomes and a circular chromosome, and reproduces by binary fission. Innate <strong>pattern-recognition receptors</strong> bind shared microbial patterns (such as cell-wall components). Antibodies and B-cell receptors bind the intact, native antigen directly. T-cell receptors do not: they recognise only a processed <strong>peptide displayed on MHC</strong>. Pathogens cause disease by damaging tissue directly or by releasing toxins.",
    },
    note: "Drawn at true size relative to the cells. Not every bacillus has flagella.",
  },
  virus: {
    name: { "y7-8": "Viruses", "y9-10": "Virus particles", y11: "Virus particles (virions)" }, color: "#86efac",
    role: {
      "y7-8": "Viruses are far smaller than bacteria (about <strong>0.1 µm</strong>) and cannot multiply on their own. They get inside your cells and make the cells build more viruses. They are drawn as dots, much bigger than life, so you can see them.",
      "y9-10": "A virus is a tiny package of genetic material in a protein coat (often with an outer envelope). It has no cell structure and no metabolism, and it can only reproduce inside a host cell. Whether viruses count as \"living\" is a <strong>debated boundary case</strong>: they carry genes and evolve, but they do not carry out life processes on their own. Here they are drawn about 3 times too big, because at true scale (0.1 µm) they would be almost invisible.",
      y11: "A <strong>non-cellular</strong> infectious agent: nucleic acid (DNA or RNA) inside a protein capsid, sometimes with a lipid envelope. It has no ribosomes or metabolism and is an obligate intracellular parasite. Classifying viruses as living or non-living is a <strong>debated boundary case</strong>: they have genes, evolve and reproduce, but only by hijacking a host cell. Antibodies can neutralise <em>free</em> virus. Once a virus is inside a cell, antibodies cannot reach it: interferons and natural killer cells slow the infection, and cytotoxic T cells can kill infected cells.",
    },
    note: "Dots are drawn about 3 times larger than true scale (0.1 µm).",
  },
  neutrophil: {
    name: "Neutrophil", color: "#d8c6f5",
    role: {
      "y7-8": "A white blood cell that is first on the scene. It squeezes out of the blood vessel, follows chemical signals to the germs and <strong>eats</strong> them. It is about 12 µm across.",
      "y9-10": "The most common white blood cell and one of the first to arrive. It squeezes out of the capillary wall (<strong>diapedesis</strong>), follows chemical signals (<strong>chemotaxis</strong>) and engulfs bacteria by <strong>phagocytosis</strong>. Neutrophils are short-lived; dead ones are the main part of pus.",
      y11: "A phagocytic <strong>granulocyte</strong> with a multi-lobed nucleus and enzyme-filled granules, recruited within hours by chemokines. It rolls along the vessel wall, adheres, then crosses the endothelium (diapedesis) and migrates up the chemokine gradient (chemotaxis). It kills by phagocytosis, a respiratory burst (reactive oxygen species) and degranulation. It is part of the <strong>innate</strong> response: non-specific and fast, with no memory.",
    },
    note: "About 12 µm across, drawn to scale.",
  },
  macrophage: {
    name: "Macrophage", color: "#f0b8a0",
    role: {
      "y7-8": "A big white blood cell that lives in your tissues. It crawls about, <strong>eats</strong> germs and dead cells, and calls for help by sending out chemical signals.",
      "y9-10": "A large, long-lived phagocyte that patrols the tissues (about 20 µm across). It engulfs microbes and debris, digesting them in <strong>lysosomes</strong> (the same organelles you saw in the animal cell), and releases signals that bring more white blood cells. It also shows pieces of pathogen to other immune cells.",
      y11: "A large phagocyte derived from monocytes. It recognises pathogens with pattern-recognition receptors, phagocytoses them (phagosome, then phagolysosome) and releases cytokines such as interleukin-1, interleukin-6 and TNF-α that drive inflammation and fever. As an <strong>antigen-presenting cell</strong> it displays peptides on MHC class II to helper T cells, linking innate and adaptive immunity.",
    },
    note: "About 20 µm across, drawn to scale. Its ruffling edge is a simplified animation.",
  },
  mast: {
    name: "Mast cell", color: "#e879f9",
    role: {
      "y7-8": "A guard cell packed with tiny bags of a chemical alarm signal. When the skin is damaged it empties them, and the blood vessel nearby widens.",
      "y9-10": "A tissue cell full of granules containing <strong>histamine</strong>. When damaged or alerted it releases them, which makes nearby blood vessels widen and become leaky. This is the start of <strong>inflammation</strong> (redness, heat, swelling).",
      y11: "A resident tissue cell whose granules contain <strong>histamine</strong> and other mediators. Release (degranulation) causes vasodilation and increased capillary permeability, so plasma, proteins and phagocytes can leave the blood. The same pathway, triggered by IgE, causes allergic reactions.",
    },
  },
  vessel: {
    name: { "y7-8": "Blood vessel", "y9-10": "Capillary / small vein", y11: "Post-capillary venule" }, color: "#fca5a5",
    role: {
      "y7-8": "A tiny blood vessel carrying blood past the cut. When the body senses germs, the vessel <strong>widens</strong> and its wall lets fluid and white blood cells out. That is why a wound can look red and swollen.",
      "y9-10": "A small blood vessel. During <strong>inflammation</strong> it widens (more blood flows, so the area is red and warm) and its wall becomes leaky, letting fluid out (swelling) and letting white blood cells squeeze through the gaps.",
      y11: "White blood cells leave the blood mainly at <strong>post-capillary venules</strong>. Histamine and cytokines cause vasodilation (redness, heat), increase permeability (oedema) and make endothelial cells display adhesion molecules, so leukocytes roll, adhere and cross by <strong>diapedesis</strong>.",
    },
    note: "A real venule here would be about 20–50 µm wide; capillaries are narrower than a neutrophil, so neutrophils squeeze through them one at a time.",
  },
  rbc: {
    name: "Red blood cell", color: "#ef4444",
    role: {
      "y7-8": "Red blood cells carry oxygen around the body. They do not fight germs.",
      "y9-10": "Red blood cells carry oxygen (they are not part of the immune system). They are about 7–8 µm across and have no nucleus. They stay inside the vessel.",
      y11: "Erythrocytes: biconcave, anucleate, packed with haemoglobin, about 7–8 µm. They stay in the vessel, but they are a useful size comparison for leukocytes.",
    },
  },
  signal: {
    name: { "y7-8": "Chemical alarm signals", y11: "Inflammatory signals" }, color: "#fcd34d",
    role: {
      "y7-8": "Damaged cells and guard cells release chemicals that act like a trail of breadcrumbs. White blood cells follow the trail to the germs.",
      "y9-10": "Chemical signals released from the wound form a <strong>gradient</strong> (strongest at the wound). White blood cells move up the gradient towards the source: this is <strong>chemotaxis</strong>.",
      y11: "Different signals do different jobs. <strong>Danger signals</strong> leak from damaged cells; <strong>histamine</strong> from mast cells dilates vessels (more blood flow) and makes them leaky; <strong>cytokines</strong> (interleukin-1, TNF-α) from macrophages activate the endothelium; <strong>chemokines</strong> (e.g. interleukin-8) form the gradient that leukocytes follow (recruitment by chemotaxis). Some cytokines also alert the adaptive immune system.",
    },
  },
  dc: {
    name: "Dendritic cell", color: "#fdba74",
    role: {
      "y7-8": "A messenger cell. It picks up pieces of germs from the wound and shows them to helper white blood cells in the lymph node.",
      "y9-10": "An <strong>antigen-presenting cell</strong>. It carries pieces of the pathogen (antigens) from the wound to a lymph node and shows them on its surface to helper T cells.",
      y11: "A professional <strong>antigen-presenting cell</strong>. It captures antigen in the tissue, matures and migrates to a lymph node, where it displays peptide on <strong>MHC class II</strong> (to helper T cells) and, by cross-presentation, MHC class I (to cytotoxic T cells).",
    },
  },
  mhc: {
    name: { "y7-8": "Antigen on display", y11: "Antigen on MHC" }, color: "#bef264",
    role: {
      "y7-8": "A piece of germ is held up on the surface of the cell, like a wanted poster for other white blood cells.",
      "y9-10": "<strong>MHC</strong> proteins are \"display stands\" on cell surfaces. They hold up a small piece of antigen so that T cells can inspect it.",
      y11: "<strong>MHC class II</strong> (on antigen-presenting cells) displays peptides from engulfed pathogens to CD4⁺ helper T cells. <strong>MHC class I</strong> (on nearly every nucleated cell) displays peptides from inside the cell, such as viral proteins, to CD8⁺ cytotoxic T cells.",
    },
  },
  th: {
    name: "Helper T cell", color: "#7dd3fc",
    role: {
      "y7-8": "The \"team captain\" of the immune system. It does not attack germs itself. It tells other white blood cells when and how to fight.",
      "y9-10": "A <strong>helper T cell</strong> recognises the antigen shown by the dendritic cell and releases chemical messages (<strong>interleukins</strong>) that activate B cells and cytotoxic T cells. Without helper T cells the whole response is weak (this is what the virus HIV attacks).",
      y11: "A CD4⁺ T cell whose T-cell receptor recognises antigen on MHC class II. Activated, it divides (clonal expansion) and releases <strong>interleukins</strong> (e.g. interleukin-2) that activate B cells, cytotoxic T cells and macrophages, and helps B cells switch from IgM to IgG. HIV infects and depletes helper T cells, causing immune deficiency.",
    },
  },
  tc: {
    name: "Cytotoxic T cell", color: "#fb7185",
    role: {
      "y7-8": "A \"killer\" white blood cell that finds body cells with a virus hiding inside and destroys them.",
      "y9-10": "A <strong>cytotoxic T cell</strong> finds body cells that are infected with a virus and kills them. Antibodies can only reach viruses outside cells, so killer T cells are vital for viruses.",
      y11: "A CD8⁺ T cell. Its receptor recognises viral peptide on <strong>MHC class I</strong> on an infected cell. It releases <strong>perforin</strong> (which makes pores in the target's membrane) and granzymes (which trigger apoptosis). It needs help from helper T cells and leaves memory T cells.",
    },
  },
  bcell: {
    name: "B cell", color: "#5eead4",
    role: {
      "y7-8": "A white blood cell that can make antibodies. When a helper cell gives the signal, it multiplies and turns into antibody factories.",
      "y9-10": "A <strong>B cell</strong> has receptors that fit one particular antigen. After a matching helper T cell touches it and gives the go-ahead, it divides into many copies (<strong>clonal expansion</strong>), and many become <strong>plasma cells</strong> that make antibodies. Some become <strong>memory B cells</strong>.",
      y11: "Each naive B cell carries a unique membrane-bound antibody (its B-cell receptor). In the T-dependent response its receptor binds native antigen, the B cell takes it in and displays a peptide on <strong>MHC class II</strong>, and a helper T cell whose receptor matches that peptide gives contact-dependent help plus interleukins (linked recognition). The B cell then undergoes <strong>clonal selection</strong> and expansion, then differentiates into <strong>plasma cells</strong> and <strong>memory B cells</strong>. Only about one cell in 10⁴–10⁵ fits a given antigen, which is why the first response is slow.",
    },
  },
  plasma: {
    name: "Plasma cell", color: "#fde047",
    role: {
      "y7-8": "An antibody factory. One plasma cell can release thousands of antibodies every second.",
      "y9-10": "A <strong>plasma cell</strong> is a B cell that has become an antibody factory, full of rough ER. It makes and releases thousands of identical antibodies per second.",
      y11: "A terminally differentiated B cell with extensive <strong>rough ER</strong> for protein synthesis. It secretes antibodies of one specificity, up to thousands of molecules per second. Most are short-lived (days); some migrate to the bone marrow and live for months to years.",
    },
  },
  memoryB: {
    name: "Memory B cell", color: "#2dd4bf",
    role: {
      "y7-8": "A memory cell stays in your body for years. If the same germ comes back, it helps your body respond much faster.",
      "y9-10": "A <strong>memory B cell</strong> remains after the infection. If the same pathogen returns, memory cells respond faster and make more antibodies (the <strong>secondary response</strong>).",
      y11: "Long-lived progeny of the activated clone. They are present in larger numbers than the naive clone was and many are already class-switched (not all: some stay IgM), so a typical second exposure produces a <strong>faster, larger, longer-lasting</strong> response dominated by IgG. Memory does not always last for life: some immunity wanes and some pathogens (e.g. influenza) change their antigens.",
    },
  },
  memoryT: {
    name: { "y7-8": "Memory T cell", y11: "Memory T cell" }, color: "#38bdf8",
    role: {
      "y7-8": "Memory T cells also stay behind, ready to jump into action if the same germ comes back.",
      "y9-10": "<strong>Memory T cells</strong> (helper and cytotoxic) stay after the infection and respond quickly if the same antigen appears again.",
      y11: "Memory helper (CD4⁺) and cytotoxic (CD8⁺) T cells persist after clearance. On re-exposure they expand much faster than naive T cells.",
    },
  },
  treg: {
    name: { "y7-8": "Calming T cell", y11: "Regulatory (suppressor) T cell" }, color: "#a5b4fc",
    role: {
      "y7-8": "Once the germs are gone, these cells calm the immune system down so it does not keep fighting.",
      "y9-10": "<strong>Regulatory T cells</strong> (also called suppressor T cells) damp the immune response down once the pathogen has been cleared, so the body does not keep damaging itself.",
      y11: "<strong>Regulatory (suppressor) T cells</strong> release inhibitory signals that suppress the activity of other T and B cells. They end the response after the pathogen is cleared and help prevent <strong>autoimmunity</strong> (attacks on the body's own cells).",
    },
  },
  antibody: {
    name: { "y7-8": "Antibody", "y9-10": "Antibody", y11: "Antibody (IgG)" }, color: "#fcd34d",
    role: {
      "y7-8": "Antibodies are Y-shaped proteins that stick to germs like a key in a lock. This stops the germs working and helps white blood cells find and eat them.",
      "y9-10": "An <strong>antibody</strong> is a Y-shaped protein with two arms that fit one particular antigen. By sticking to germs it can block them (<strong>neutralisation</strong>), clump them together (<strong>agglutination</strong>) and mark them for phagocytes (<strong>opsonisation</strong>).",
      y11: "<strong>IgG</strong>: two heavy and two light chains, with two identical antigen-binding sites (Fab arms) and a constant (Fc) region. <strong>Neutralisation</strong> blocks toxins and stops viruses attaching to cells; <strong>agglutination</strong> clumps pathogens; <strong>opsonisation</strong> coats them so phagocytes' Fc receptors grab them (and complement can be activated). IgM (a pentamer) is made first; IgG follows after class switching.",
    },
    note: "Real antibodies are about 15 nm long, roughly 1,000 times smaller than a cell. They are drawn about 60–80 times too big so you can see them.",
  },
  host: {
    name: { "y7-8": "Body cell", "y9-10": "Body cell", y11: "Host cell" }, color: "#fbcfe8",
    role: {
      "y7-8": "An ordinary body cell. When a virus gets inside, the cell is forced to make more viruses.",
      "y9-10": "An ordinary body cell. A virus enters it and uses its machinery to make new viruses, and antibodies cannot reach virus inside the cell. Interferons and natural killer cells help, and cytotoxic T cells can find and destroy infected cells.",
      y11: "A host cell. Infected cells display viral peptides on MHC class I, which is how cytotoxic T cells recognise them.",
    },
  },
  lysosome: {
    name: "Lysosome", color: "#f87171",
    role: {
      "y7-8": "A little recycling bag full of strong digestive chemicals. It joins onto the bubble holding the germ.",
      "y9-10": "An organelle containing acidic <strong>digestive enzymes</strong>. You met lysosomes in the animal cell, where they recycle worn-out parts. In a macrophage they fuse with the phagosome to digest what has been engulfed.",
      y11: "Lysosomes carry acid hydrolases. Fusing with a phagosome makes a <strong>phagolysosome</strong>. The same organelle drives autophagy in the animal cell level.",
    },
  },
  phagosome: {
    name: { "y7-8": "Bubble holding the germ", y11: "Phagosome / phagolysosome" }, color: "#fdba74",
    role: {
      "y7-8": "The germ is trapped inside a bubble made from the cell's own membrane.",
      "y9-10": "A <strong>phagosome</strong> is the membrane-bound bubble that forms around an engulfed bacterium. After a lysosome fuses with it, it is a <strong>phagolysosome</strong>.",
      y11: "The phagosome is formed by plasma membrane that has wrapped around the particle. Fusion with lysosomes gives a <strong>phagolysosome</strong> (acid pH, hydrolases, reactive oxygen species).",
    },
  },
};

export const DEFENCES = {
  "y7-8": [
    { h: "Barriers", t: "Skin, tears, mucus and stomach acid stop most germs getting in." },
    { h: "White blood cells that eat germs", t: "If germs get in, white blood cells swallow them. This works against every kind of germ." },
    { h: "Antibodies and memory", t: "Your body makes antibodies that fit one particular germ and keeps memory cells so it can respond faster next time. Vaccines train this part safely." },
  ],
  "y9-10": [
    { h: "1st line: barriers", t: "Skin, mucus and cilia, tears and saliva, stomach acid and the body's normal microbes stop most pathogens from entering. Non-specific." },
    { h: "2nd line: innate response", t: "Inflammation and phagocytes (neutrophils, macrophages) respond within minutes to hours to anything that gets in. Non-specific, with no memory." },
    { h: "3rd line: adaptive response", t: "Lymphocytes (T and B cells) recognise one particular antigen. Slower (days) the first time, but it makes antibodies, kills infected cells and leaves memory cells." },
  ],
};

export const COMPARE = [
  { a: "Speed", i: "minutes to hours", d: "days for a first exposure; 1–3 days for a repeat" },
  { a: "Recognition", i: "receptors for shared microbial patterns (not antigen-specific clones); triggers an appropriate but non-specific response", d: "receptors specific to one antigen (clonal selection)" },
  { a: "Memory", i: "none", d: "yes (memory B and T cells)" },
  { a: "Main cells", i: "barriers, phagocytes (neutrophils, macrophages), mast cells, inflammation", d: "helper, cytotoxic, memory and regulatory T cells; B cells, plasma cells, antibodies" },
];

export const CLASSIFY = {
  intro: {
    "y9-10": "Germs (pathogens) come in a few types. Bacteria, fungi and protozoa are living cells; viruses and prions are not cells at all.",
    y12: "Pathogens are classified as <b>cellular</b> (bacteria, protozoa, fungi) or <b>non-cellular</b> (viruses, prions).",
  },
  rows: [
    { type: "Bacteria", cell: "Cellular (prokaryote)", eg: "Staphylococcus aureus (skin infections), Salmonella", note: "No nucleus; cell wall; binary fission. Antibiotics can treat them." },
    { type: "Protozoa", cell: "Cellular (single-celled eukaryote)", eg: "Plasmodium (malaria), Giardia", note: "Eukaryotic cell with a nucleus; often has a complex life cycle." },
    { type: "Fungi", cell: "Cellular (eukaryote)", eg: "Tinea (athlete's foot), Candida", note: "Cells with cell walls; yeasts or moulds." },
    { type: "Viruses", cell: "Non-cellular", eg: "Influenza, measles, HIV, varicella-zoster", note: "Nucleic acid in a protein coat; reproduce only inside host cells. Whether they are \"living\" is debated. Antibiotics do not work on them." },
    { type: "Prions", cell: "Non-cellular", eg: "Creutzfeldt-Jakob disease (CJD)", note: "Misfolded proteins with no DNA or RNA. They convert normal host protein into the misfolded form." },
  ],
  prion: {
    "y9-10": "<b>Prions</b> are infectious, misfolded proteins with no DNA or RNA. They are not cells and not viruses. They are not shown in the simulation.",
    y12: "<b>Prions</b> are infectious misfolded proteins (a misfolded form of a normal host protein) with no nucleic acid. They are non-cellular, are very resistant to normal sterilisation, and the body mounts no effective immune response because the protein is the body's own. They cause diseases such as Creutzfeldt-Jakob disease. They are not simulated here.",
  },
};

export const HERD_NOTE = {
  "y9-10": "If enough people are immune, an infection cannot find enough new people to spread to, so even people who cannot be vaccinated are protected. The threshold is 1 − 1/R₀ (R₀ = the number of people one case infects in a fully susceptible population). Vaccines differ in how well they stop people catching and passing on the pathogen, so real thresholds are a little higher.",
  y11: "The herd-immunity threshold is <b>1 − 1/R₀</b>, assuming the vaccine gives immunity to everyone vaccinated and that mixing is random. If the vaccine protects only a fraction <i>e</i> of those vaccinated, coverage needed is (1 − 1/R₀) / <i>e</i>. Vaccines differ in how well they block infection and onward transmission (some mostly prevent severe disease), and immunity can wane or the pathogen can change, so herd immunity is not always reachable by vaccination alone.",
};

// ---------- missions + quiz ----------
export const MISSIONS = [
  { band: "y7-8", text: "Watch a macrophage digest a bacterium: step through all four stages in the <b>Phagocytosis</b> view.", check: (M, ms) => ms.digested },
  { band: "y7-8", text: "Infect with the bacterium and let your body make antibodies until the level passes the dotted <b>peak</b> line on the graph.", check: (M) => M.records.some((r) => r.kind === "infect" && r.peakAb >= 0.5) },
  { band: "y9-10", text: "Show that the second response is faster: infect, wait until the antibodies have fallen, then <b>reinfect</b> with the same germ.", check: (M) => { const p = M.records.find((r) => r.kind === "infect" && !r.secondary && r.detect != null), s = M.records.find((r) => r.secondary && r.detect != null); return !!(p && s && s.detect < p.detect); } },
  { band: "y7-8", text: "<b>Vaccinate</b> first, wait about 30 days, then infect with the same germ. You should not get ill.", check: (M) => M.records.some((r, i) => r.kind === "infect" && r.secondary && M.records.slice(0, i).some((q) => q.kind === "vaccinate" && q.id === r.id) && !M.records.slice(0, i).some((q) => q.kind === "infect" && q.id === r.id) && M.illness(r) !== "severe" && r.detect != null) },
  { band: "y9-10", text: "Reach herd immunity for <b>measles</b>: choose measles and raise the vaccination coverage above its threshold.", check: (M, ms) => ms.herd },
  { band: "y12", text: "Choose the <b>virus</b>, then click the cell type that kills virus-infected body cells.", check: (M, ms) => ms.pickedTc },
];

export const QUIZ = [
  { band: "y7-8", maxBand: "y7-8", q: "What is the first barrier that stops germs getting into your body?", options: ["Your skin", "Your bones", "Your hair", "Your muscles"], answer: 0, why: "Skin, together with mucus, tears and stomach acid, forms the first barrier. This wound breaks it." },
  { band: "y7-8", maxBand: "y7-8", q: "What do macrophages and neutrophils do to germs?", options: ["Swallow and digest them", "Paint them", "Make them grow", "Ignore them"], answer: 0, why: "These white blood cells engulf germs (phagocytosis) and digest them." },
  { band: "y7-8", maxBand: "y11", q: "Why are you usually less ill the second time you meet the same germ?", options: ["Memory cells respond faster and make more antibodies", "The germ gets weaker over time", "Your skin gets thicker", "Your blood gets thicker"], answer: 0, why: "Memory cells remain after the first infection. Some viruses are the exception: they change, or hide in the body and come back later, as the chickenpox virus can as shingles." },
  { band: "y7-8", maxBand: "y11", q: "How does a vaccine help protect you?", options: ["It trains your body to make antibodies and memory cells without making you ill", "It kills all germs in the air", "It makes your skin thicker", "It makes white blood cells bigger"], answer: 0, why: "A vaccine shows your immune system a harmless form or part of the pathogen, so the first response (and memory) happens safely." },
  { band: "y7-8", maxBand: "y9-10", q: "What is an antibody?", options: ["A Y-shaped protein that sticks to a particular germ", "A kind of germ", "A part of the skin", "A type of red blood cell"], answer: 0, why: "Antibodies are made by plasma cells. Each type fits one antigen." },
  { band: "y9-10", maxBand: "y11", q: "A disease has R₀ = 4. About what fraction of people must be immune for herd immunity?", options: ["75%", "25%", "40%", "100%"], answer: 0, why: "Threshold = 1 − 1/R₀ = 1 − 1/4 = 0.75, assuming the vaccine works for everyone vaccinated." },
  { band: "y9-10", maxBand: "y9-10", q: "Skin, mucus and stomach acid belong to which line of defence?", options: ["The first line (barriers)", "The second line (innate response)", "The third line (adaptive response)", "None of them"], answer: 0, why: "They are barriers that stop pathogens entering. If a pathogen gets in, the innate response (inflammation, phagocytes) is the second line, then the adaptive response." },
  { band: "y9-10", maxBand: "y9-10", q: "Which of these is part of the <b>innate</b> (non-specific) response?", options: ["Neutrophils engulfing bacteria", "Plasma cells making a specific antibody", "Memory B cells", "Cytotoxic T cells that recognise one virus"], answer: 0, why: "Phagocytes respond within hours to many kinds of pathogen, using shared microbial patterns rather than one specific antigen. Antibodies and memory cells belong to the adaptive response." },
  { band: "y11", q: "Which cells kill virus-infected body cells using perforin?", options: ["Cytotoxic T cells", "Plasma cells", "Neutrophils", "Mast cells"], answer: 0, why: "Cytotoxic (CD8⁺) T cells recognise viral peptide on MHC class I and release perforin and granzymes." },
  { band: "y11", q: "In a first exposure to a pathogen, which antibody class is made first, and which dominates after a repeat exposure?", options: ["IgM first; IgG dominates the secondary response", "IgG first; IgM dominates the secondary response", "IgM both times", "IgG both times"], answer: 0, why: "Class switching from IgM to IgG needs T-cell help. Many memory B cells have already switched, so a typical secondary response is dominated by IgG." },
  { band: "y11", q: "Why does the first antibody response take about a week or more?", options: ["Only a very few lymphocytes fit the antigen and their clone has to expand first", "Antibodies travel slowly", "The skin is a thick barrier", "Neutrophils block them"], answer: 0, why: "Clonal selection and expansion take days, which is why innate defences have to hold the line first." },
  { band: "y12", q: "Interleukins released by helper T cells do which of the following?", options: ["Activate B cells and cytotoxic T cells", "Digest bacteria in lysosomes", "Make pores in infected cells", "Carry oxygen"], answer: 0, why: "Helper T cells coordinate the adaptive response. Perforin is released by cytotoxic T cells. HIV depletes helper T cells." },
  { band: "y12", q: "How does opsonisation by antibodies help?", options: ["It coats the pathogen so phagocytes engulf it more easily", "It makes pores in the pathogen", "It switches the pathogen's genes off", "It turns the pathogen into a memory cell"], answer: 0, why: "Phagocytes have Fc receptors that bind the constant region of antibodies bound to a pathogen." },
  { band: "y12", q: "Which of these is a <b>non-cellular</b> pathogen?", options: ["A prion", "A fungus", "A protozoan", "A bacterium"], answer: 0, why: "Viruses and prions are non-cellular. Bacteria, protozoa and fungi are cellular." },
];

// ---------- narrative generated from model state ----------
const level = (v, lo, hi) => (v < lo ? "low" : v < hi ? "moderate" : "high");

/** ctx: { id: "bacterium" | "virus" }. Everything here is about the chosen pathogen's own exposure record and state;
 *  shared inflammation is described with its real source(s). */
export function narrative(M, band, ctx = {}) {
  const id = ctx.id || "bacterium", s = M.slot(id), bug = id === "virus" ? "virus" : "bacteria", other = id === "virus" ? "bacterium" : "virus";
  const y7 = band === "y7-8", sen = band === "y11" || band === "y12";
  const day = `Day ${M.day.toFixed(1)}`;
  const p = [];
  if (!M.records.length) {
    p.push(`<b>${day}:</b> The skin has been cut, but no germs have entered yet. Choose a pathogen and press <b>Infect</b>, or press <b>Vaccinate</b> to see how a vaccine trains the body first.`);
    if (!y7) p.push("Nothing is happening yet in the defences: no signals, no extra white blood cells, and no antibodies.");
    return p;
  }
  const rec = [...M.records].reverse().find((r) => r.id === id);        // this pathogen's own latest exposure (never another pathogen's)
  // where the inflammation is coming from
  const src = [];
  if (M.active("bacterium")) src.push(y7 ? "the bacteria" : "the bacterial infection");
  if (M.active("virus")) src.push(y7 ? "the virus" : "the viral infection");
  if (M.adj > 0.05) src.push(y7 ? "the vaccine" : "the vaccine's adjuvant (a mild local reaction)");
  if (M.w > 0.08) src.push(y7 ? "the cut" : "damage from the cut");
  const from = src.join(" and ");
  const nl = level(M.N, 0.2, 0.55), ml = level(M.M, 0.4, 0.7), dil = Math.round(M.phi * 100);
  const inflam = M.S > 0.05 && src.length
    ? (sen ? `Inflammation, caused by ${from}: histamine has increased blood flow and permeability (venule ${dil}% of maximum), and cytokines and chemokines recruit neutrophils (${nl}) and macrophages (${ml})`
      : y7 ? `The blood vessel has widened because of ${from}, and white blood cells (${nl === "low" ? "a few" : nl === "moderate" ? "quite a few" : "lots"}) have come to help`
        : `Inflammation caused by ${from}: the vessel is ${dil}% widened and neutrophils (${nl}) and macrophages (${ml}) have been called in`) : "";
  if (!rec) {
    p.push(`<b>${day}:</b> No ${bug} has entered, so there is no ${bug}-specific response${y7 ? "" : " and no memory of it"}.${inflam ? " " + inflam + "." : ""}`);
    if (src.length) p.push(y7 ? `Switch to the ${other} to follow what is happening there.` : `The ${other} infection is being followed separately: switch the pathogen to see it.`);
    return p;
  }
  const t = M.day - rec.t0, idActive = M.active(id), vac = rec.kind === "vaccinate";
  const Ab = M.total(id), noAb = Ab < DETECT, dom = M.dominant(id), ph = M.phase(id), sec = rec.secondary;
  const hasMemory = s.Bm > 0.004 || s.Tm > 0.004;

  // line 1: the pathogen / vaccine and the innate response
  const parts = [];
  if (vac && s.depot > 0.02) parts.push(y7 ? "the vaccine has been given: it cannot make you ill, but your body can see it" : "inactivated vaccine antigen is present: it cannot multiply, but it can be seen and presented");
  if (inflam) parts.push(inflam.charAt(0).toLowerCase() + inflam.slice(1));
  if (id === "virus" && s.I > 0.03) parts.push(sen ? `${Math.round(s.I * 100)}% of the nearby host cells are infected and are making new virus particles` : `${Math.round(s.I * 100)}% of the nearby body cells have virus inside them`);
  else if (id === "bacterium" && s.P > 0.03) parts.push(sen ? `the bacterial load is ${Math.round(s.P * 100)}% of the site's capacity` : `the bacteria are multiplying (${Math.round(s.P * 100)}% of the room available)`);
  if (parts.length) p.push(`<b>${day}:</b> ` + parts.map((x, i) => (i ? x : x.charAt(0).toUpperCase() + x.slice(1))).join("; ") + ".");
  else if (idActive) p.push(`<b>${day}:</b> The ${bug} have just entered the wound and the defences are starting to react.`);
  else if (!vac) p.push(`<b>${day}:</b> No ${bug} can be found at the wound now.`);
  else p.push(`<b>${day}:</b> The vaccine antigen has been cleared from the injection site.`);

  // line 2: adaptive stage and antibodies
  const adaptive = [];
  if (ph === "priming") adaptive.push(sen ? "dendritic cells are carrying antigen to the lymph node; the matching T and B cell clones are still tiny" : y7 ? "special cells are taking a piece of the germ to a lymph node" : "dendritic cells are carrying antigen to a lymph node, where only a few lymphocytes fit it");
  if (ph === "expanding") adaptive.push(sen ? `helper T cells are active and releasing interleukins; matching B cells are in clonal expansion${sec ? " (memory cells made this quick)" : ""}` : y7 ? "helper cells are waking up the antibody-making cells" : `helper T cells are active and B cells are multiplying${sec ? ", faster because memory cells remember this germ" : ""}`);
  if (!noAb) {
    const near = Ab >= 0.9 * (rec.peakAb ?? 0);
    adaptive.push(sen ? `antibodies are ${near ? "near their peak" : "present"} (mainly ${dom})` : y7 ? "antibodies are now sticking to the germs" : `antibodies are being made${near ? " near the peak" : ""} and are marking ${bug} for destruction`);
  }
  if (noAb && t < 12 && !sec && (ph === "priming" || ph === "expanding" || idActive || vac)) adaptive.push(y7 ? "no antibodies yet" : "no antibodies yet: the first response is slow");
  if (adaptive.length) p.push(adaptive[0].charAt(0).toUpperCase() + adaptive.join("; ").slice(1) + ".");

  if (id === "virus" && s.Tc > 0.05 && s.I > 0.004) p.push(sen ? "Cytotoxic T cells are killing infected host cells with perforin." : "Killer T cells are finding and destroying infected body cells.");
  if (!y7 && s.Tr > 0.12 && !idActive) p.push(sen ? "Regulatory (suppressor) T cells are now damping the response down." : "Calming T cells are now turning the response down.");

  // line 3: outcome and memory (memory is only claimed when the model actually has memory cells)
  if (!idActive) {
    if (vac) {
      if (hasMemory) p.push(y7 ? "The vaccine has trained your body: memory cells now remain, and you have not been ill." : `The vaccine (inactivated antigen) caused a primary response with no illness. ${sen ? "Memory B and T cells now remain." : "Memory cells now remain."}`);
      else p.push(y7 ? "Your body is still learning from the vaccine: no antibodies or memory cells yet." : "Vaccine response pending: there are no antibodies and no memory cells yet. They take days to form.");
    } else if (M.illness(rec) === "none" && sec) p.push(y7 ? "Memory cells stopped the germ before you got ill." : "Memory cells and antibodies controlled it at once: little or no illness.");
    else if (hasMemory) p.push(y7 ? "The infection is over, and memory cells stay behind." : `The infection has been cleared and memory cells remain, so the next exposure should be faster${sen ? " (shorter lag, higher IgG peak)" : ""}. Memory is usually, but not always, lasting: some viruses change or hide in the body.`);
  }
  if (M.compromised && (idActive || ph !== "naive")) p.push(sen ? "Helper T cells are reduced (as in untreated HIV infection), so B cells and cytotoxic T cells get little help." : "Fewer helper T cells: the response is weaker and slower.");
  return p;
}
