// Lens-aware text for the protein-folding level. Values may be plain strings or { "y7-8", "y9-10", "y11", "y12" }.

export const MODEL_NOTE = {
  "y7-8": "<strong>Model protein:</strong> this is <strong>haemoglobin</strong>, the protein that carries oxygen in your red blood cells. It's a human protein, shown here inside a plant cell for teaching — plants make their own, similar oxygen-holding proteins too.",
  "y9-10": "<strong>Model gene:</strong> the gene you followed from the DNA is the start of the human <strong>haemoglobin β-globin</strong> gene. It's shown inside a plant cell for teaching (plants have their own haemoglobin-like proteins, e.g. leghaemoglobin in legume root nodules). Its 9 amino acids are the first 9 of a 147-amino-acid chain.",
  y11: "<strong>Model gene:</strong> a simplified fragment of human <em>HBB</em> (β-globin), shown in a plant cell for teaching (plants express their own globins: phytoglobins and nodule leghaemoglobin). Nine amino acids can't fold, so the level shows the whole β chain (147 residues incl. Met) with your fragment as its N-terminus. Numbering follows the clinical convention (Val1 after the initiator Met), so Glu6 is the sickle-cell site.",
};

export const SIM_NOTE = {
  "y7-8": "Each bead is one amino acid. The wiggling is real: molecules are always jiggling because of heat.",
  "y9-10": "Each bead is one amino acid. The model is simplified (no atoms, no water) and runs millions of times slower than real folding, which takes thousandths of a second or less.",
  y11: "Coarse-grained model: one bead per residue (Cα, 3.8 Å apart), Brownian (Langevin) dynamics with bond springs, excluded volume, native-contact (Gō-like) attraction, helix chirality, non-specific hydrophobic attraction and screened electrostatics with pH-dependent charges. Real folding takes µs–s; the fold shown is a simplified globin-like shape, not the crystal structure.",
};

// ---------- levels of structure ----------
export const STEPS = [
  { id: "primary", short: "1°", name: { "y7-8": "1 · Chain", "y9-10": "1° Primary" } },
  { id: "secondary", short: "2°", name: { "y7-8": "2 · Coils", "y9-10": "2° Secondary" } },
  { id: "tertiary", short: "3°", name: { "y7-8": "3 · Fold", "y9-10": "3° Tertiary" } },
  { id: "quaternary", short: "4°", name: { "y7-8": "4 · Team", "y9-10": "4° Quaternary" } },
  { id: "cell", short: "RBC", name: { "y7-8": "In blood", "y9-10": "Red blood cell" } },
];

export const STEP_TEXT = {
  primary: {
    "y7-8": "A protein starts as a long <strong>chain of amino acids</strong>, joined in the order the DNA says. There are 20 kinds; the colours show what each one is like — <span style='color:#fb923c'>orange ones avoid water</span>, the others like water.",
    "y9-10": "<strong>Primary structure</strong> is the sequence of amino acids, joined by peptide bonds in the order set by the gene's codons. Colours show each side chain's property: hydrophobic, polar, positively or negatively charged, or special (Gly, Pro, Cys).",
    y11: "<strong>Primary structure</strong>: the amino-acid sequence (N→C), held by covalent peptide bonds. It contains all the information needed for folding (Anfinsen): side-chain properties decide which parts bury, pair or bond.",
  },
  secondary: {
    "y7-8": "Parts of the chain twist into <strong>coils</strong> (helices). Weak attractions between nearby parts of the chain hold each coil in shape.",
    "y9-10": "<strong>Secondary structure</strong>: parts of the chain coil into <strong>α-helices</strong> (or line up into <strong>β-sheets</strong> in other proteins), held by hydrogen bonds along the backbone. Haemoglobin is almost all α-helix (8 helices, A–H).",
    y11: "<strong>Secondary structure</strong>: local backbone conformations stabilised by <strong>hydrogen bonds</strong> between backbone C=O and N–H groups — in an α-helix from residue <em>i</em> to <em>i</em>+4 (dashed). β-pleated sheets pair separate strands instead. The globin fold is ~75 % α-helix (A–H) with no β-sheet; tap “β-sheet & S–S example” to see a sheet. In real cells secondary and tertiary structure form together; here they're switched on one at a time.",
  },
  tertiary: {
    "y7-8": "The coils fold up into a <strong>3D shape</strong>. The water-avoiding (orange) amino acids hide in the middle, away from water. The shape makes a pocket that holds the <strong>haem</strong>, which grabs oxygen.",
    "y9-10": "<strong>Tertiary structure</strong>: the whole chain folds into a specific 3D shape. Hydrophobic side chains bury in the core (the <strong>hydrophobic effect</strong>), polar and charged ones stay on the surface. The fold creates the pocket that holds the iron-containing <strong>haem</strong> group — shape determines function.",
    y11: "<strong>Tertiary structure</strong>: driven mainly by the <strong>hydrophobic effect</strong> (non-polar side chains bury, releasing ordered water), then fixed by side-chain interactions: hydrogen bonds, <strong>ionic bonds</strong> (salt bridges, solid lines), van der Waals contacts and, in some proteins, covalent <strong>disulfide bridges</strong> (Cys–S–S–Cys; globins have none — see the example). The fold forms the haem pocket: His F8 (His92) binds the iron.",
  },
  quaternary: {
    "y7-8": "Some proteins are made of several chains that fit together. Haemoglobin has <strong>4 chains</strong>, each holding one haem, so it can carry 4 oxygen molecules.",
    "y9-10": "<strong>Quaternary structure</strong>: several folded chains (subunits) assemble into one protein. Haemoglobin is <strong>α₂β₂</strong>: two α and two β chains, each with a haem, so one molecule carries up to 4 O₂.",
    y11: "<strong>Quaternary structure</strong>: haemoglobin is an <strong>α₂β₂ tetramer</strong> held by non-covalent interfaces (hydrophobic contacts, H-bonds, salt bridges). The interfaces shift as O₂ binds (T ⇌ R states), giving <strong>cooperative</strong> binding — the sigmoid O₂ curve. α chains (141 residues) have a very similar fold and are drawn with the same shape here.",
  },
  cell: {
    "y7-8": "A red blood cell is packed with about 270 million haemoglobin molecules. Bright red = carrying oxygen; dark = oxygen dropped off in the body's tissues.",
    "y9-10": "Each red blood cell holds ~270 million haemoglobin molecules (about a third of the cell's mass). Lower the oxygen to see haemoglobin release O₂, as in respiring tissues.",
    y11: "~2.7 × 10⁸ Hb per red cell (≈ 33 % of cell mass, ~5 mM). Lowering pO₂ deoxygenates Hb along the Hill curve (P50 ≈ 27 mmHg). In sickle-cell disease, deoxy-HbS polymerises after a delay into 14-stranded fibres that distort the cell.",
  },
};

// ---------- mutation scenarios ----------
export const KINDS = {
  none: { title: { "y7-8": "Normal gene", "y9-10": "No mutation" }, col: "#4ade80",
    text: { "y7-8": "The DNA is unchanged, so the chain has the normal amino acids and folds into the normal shape.", "y9-10": "No change to the DNA: the normal β-globin chain is made and folds normally.", y11: "Wild-type sequence → native fold and normal function." } },
  silent: { title: { "y7-8": "Silent change", "y9-10": "Silent mutation" }, col: "#a3e635",
    text: { "y7-8": "The DNA changed, but the new code still means the same amino acid. Same chain, same shape — no difference!", "y9-10": "A base changed but the codon still codes for the same amino acid (the genetic code has several codons per amino acid), so the protein is identical and folds normally.", y11: "Synonymous substitution (GAG → GAA, both Glu): identical primary structure, so identical fold and function. (Rarely, silent changes affect splicing or translation speed.)" } },
  sickle: { title: { "y7-8": "Sickle-cell change", "y9-10": "Missense: sickle-cell" }, col: "#fbbf24",
    text: { "y7-8": "One letter of DNA changed, so ONE amino acid is different. The protein still folds, but it now has a sticky spot on the outside. When oxygen is low, the molecules stick together into long fibres that bend red blood cells into a sickle shape.",
      "y9-10": "A <strong>missense</strong> mutation: GAG → GTG swaps glutamic acid (charged, water-loving) for valine (hydrophobic) at position 6. The chain still folds, but there is now a hydrophobic patch on the surface. When oxygen is low, HbS molecules stick together into fibres → sickle-shaped red blood cells that block small blood vessels.",
      y11: "<strong>Missense</strong> (HBB c.20A>T; traditionally “Glu6Val”, p.Glu7Val in HGVS numbering that counts Met): the tertiary fold is essentially unchanged, but Val6 creates a surface hydrophobic patch. In the deoxy (T) state it fits a hydrophobic pocket (Phe85, Leu88) on a β chain of a neighbouring tetramer → nucleation-dependent polymerisation into 14-stranded fibres → sickled, rigid erythrocytes, vaso-occlusion and haemolysis. Heterozygotes (HbAS) are largely protected from severe malaria." } },
  missense: { title: { "y7-8": "One amino acid changed", "y9-10": "Missense mutation" }, col: "#fbbf24",
    text: { "y7-8": "One amino acid is different. Depending on where it is, the shape might change a lot or hardly at all.", "y9-10": "A <strong>missense</strong> mutation changes one amino acid. Whether that matters depends on where it is and how different the new amino acid is (e.g. a charged residue in the hydrophobic core can stop the protein folding).", y11: "Missense substitution: the effect depends on position (core vs surface, active/binding site) and the chemical difference between residues. Watch the folded fraction and burial." } },
  nonsense: { title: { "y7-8": "Early stop", "y9-10": "Nonsense mutation" }, col: "#f87171",
    text: { "y7-8": "The DNA change made a STOP signal too early, so the chain is cut short. A short chain can't fold into the right shape and can't do its job.",
      "y9-10": "A <strong>nonsense</strong> mutation turns a codon into a <strong>stop codon</strong>, so translation ends early. The chain is far too short to fold or hold haem — no working β-globin (this causes a form of β-thalassaemia).",
      y11: "<strong>Nonsense</strong> (premature termination codon): truncated polypeptide lacking most of the fold and the haem pocket; in cells the mRNA is usually destroyed by nonsense-mediated decay, so little or no chain is made at all (β⁰-thalassaemia, e.g. codon 39 CAG→TAG). Spare α chains then precipitate in red-cell precursors." } },
  frameshift: { title: { "y7-8": "Scrambled code", "y9-10": "Frameshift mutation" }, col: "#f87171",
    text: { "y7-8": "A DNA letter was added or lost, so every 3-letter word after it is read wrong. The rest of the chain is scrambled nonsense and can't fold.",
      "y9-10": "A <strong>frameshift</strong> (insertion or deletion of 1 or 2 bases) shifts the reading frame: every codon after it is read differently, so the amino acids after that point are scrambled, and a stop codon usually appears soon. The protein can't fold.",
      y11: "<strong>Frameshift</strong> indel (not a multiple of 3): all downstream codons are misread, so the C-terminal sequence is unrelated to the native one and an out-of-frame stop usually appears quickly. No native contacts → no fold (the chain may collapse into a non-native glob). Beyond the 9 codons you built, the out-of-frame residues shown are illustrative." } },
  inframe: { title: { "y7-8": "Amino acid added or lost", "y9-10": "In-frame insertion/deletion" }, col: "#fbbf24",
    text: { "y7-8": "Three DNA letters were added or removed, so one amino acid is added or lost but the rest is read normally.", "y9-10": "Adding or removing exactly 3 bases keeps the reading frame: one amino acid is gained or lost and the rest of the chain is normal, so it can usually still fold.", y11: "In-frame indel: the reading frame is preserved; the effect depends on where the residue is gained/lost (here, near the flexible N-terminus, the fold survives)." } },
  stoplost: { title: { "y7-8": "Stop signal lost", "y9-10": "Stop codon lost" }, col: "#fbbf24",
    text: { "y7-8": "The STOP signal was lost, so extra amino acids were added.", "y9-10": "The stop codon in your model gene was lost, so extra amino acids were added. (In the real gene the coding sequence carries on past codon 9.)", y11: "Stop-loss in the 9-codon model gene: the ribosome reads into the 3′ UTR. Here those extra residues are joined to the rest of the real chain — effectively an in-frame insertion near the N-terminus." } },
  startlost: { title: { "y7-8": "No start", "y9-10": "Start codon lost" }, col: "#f87171",
    text: { "y7-8": "The START signal was lost, so the ribosome never made the protein at all.", "y9-10": "Without the AUG start codon, translation can't begin: no protein is made.", y11: "Loss of the initiation codon: no β-globin translated (β⁰ phenotype)." } },
};

export const TRY_BUTTONS = [
  { kind: "none", label: { "y7-8": "Normal", "y9-10": "Normal" } },
  { kind: "silent", label: { "y7-8": "Silent", "y9-10": "Silent" } },
  { kind: "sickle", label: { "y7-8": "Sickle cell", "y9-10": "Missense (sickle)" } },
  { kind: "nonsense", label: { "y7-8": "Early stop", "y9-10": "Nonsense" } },
  { kind: "frameshift", label: { "y7-8": "Scrambled", "y9-10": "Frameshift" } },
];

export const PROP_NAME = {
  hyd: { "y7-8": "water-avoiding", "y9-10": "hydrophobic (non-polar)" },
  pol: { "y7-8": "water-loving", "y9-10": "polar" },
  pos: { "y7-8": "water-loving (+ charge)", "y9-10": "positively charged (basic)" },
  neg: { "y7-8": "water-loving (− charge)", "y9-10": "negatively charged (acidic)" },
  spc: { "y7-8": "special", "y9-10": "special (Gly, Pro, Cys)" },
};

export const STATE_NAME = {
  folded: { "y7-8": "Folded", "y9-10": "Folded (native)" },
  partial: { "y7-8": "Partly folded", "y9-10": "Partly folded" },
  unfolded: { "y7-8": "Unravelled", "y9-10": "Unfolded (denatured)" },
  misfolded: { "y7-8": "Clumped wrongly", "y9-10": "Misfolded / clumped" },
  short: { "y7-8": "Too short", "y9-10": "Too short to fold" },
  none: { "y7-8": "No protein", "y9-10": "No protein made" },
};

// ---------- narrative (driven by the model's actual state) ----------
const pc = (v) => `${Math.round(v * 100)} %`;
export function narrative(band, S) {
  const y7 = band === "y7-8", y9 = band === "y9-10", sen = !y7 && !y9;
  const M = S.m;
  if (S.kind === "startlost" || !S.n) return y7 ? "No protein was made, so there's nothing to fold. Try another mutation." : "No polypeptide: translation never started (start codon lost), so there is nothing to fold and no β-globin is made.";
  if (S.step === "cell") {
    const sat = Math.round(S.sat * 100);
    if (S.thal) return y7 ? `Without working β chains, these cells can't make normal haemoglobin. The spare α chains clump together and damage the cell (a disease called β-thalassaemia).`
      : y9 ? `No working β chains are made, so normal haemoglobin (α₂β₂) can't form. Spare α chains clump (precipitate) inside developing red blood cells, which are destroyed or come out small and pale: <strong>β-thalassaemia</strong>.`
      : `No functional β-globin: α₂β₂ tetramers can't assemble. Excess α chains precipitate (α-chain inclusions), causing ineffective erythropoiesis and microcytic, hypochromic red cells (β⁰-thalassaemia major if both alleles are affected).`;
    let t = y7 ? `Oxygen level: haemoglobin is <strong>${sat} %</strong> loaded with oxygen.` : `At pO₂ = ${S.pO2} mmHg haemoglobin is <strong>${sat} % saturated</strong>.`;
    if (S.sickle) {
      if (S.poly > 0.2) t += y7 ? ` With the sickle-cell change and low oxygen, the molecules are <strong>sticking together into long fibres</strong> (${pc(S.poly)}), bending the cell into a sickle shape.`
        : y9 ? ` Deoxygenated HbS is <strong>polymerising into fibres</strong> (${pc(S.poly)} of the haemoglobin), stretching the cell into a rigid sickle shape that can block capillaries.`
        : ` Deoxy-HbS has nucleated and is polymerising (${pc(S.poly)} in fibres): Val6 of one tetramer packs into the Phe85/Leu88 pocket of the next. Fibres distort and stiffen the cell (sickling).`;
      else if (S.lag > 0.2) t += y7 ? " Oxygen is low… the sticky molecules are starting to gather." : sen ? " Deoxy-HbS is accumulating; polymerisation has a delay time (nucleation) before fibres appear." : " The deoxy-HbS is starting to gather; fibres take a little while to start (there's a delay).";
      else t += y7 ? " There's plenty of oxygen, so the sticky spots stay hidden and the cell stays round." : " With enough O₂ (oxy, R-state) HbS stays dissolved, so the cell keeps its normal disc shape. Lower the oxygen to see what happens.";
    } else t += y7 ? " The molecules stay separate and the cell keeps its normal round, squishy shape." : " Normal HbA stays dissolved even when deoxygenated, so the cell keeps its flexible biconcave shape.";
    return t;
  }
  if (S.step === "primary") {
    return (y7 ? `A chain of <strong>${S.n}</strong> amino acids, in the order the DNA said. The first ${Math.min(9, S.n)} are the ones you made from the gene.`
      : `Primary structure: <strong>${S.n}</strong> amino acids. The first ${Math.min(9, S.n)} come from the gene you transcribed and translated; ${S.n > 9 ? "the rest is the remaining β-globin chain" : "there is nothing after them"}.`)
      + (S.kind === "frameshift" ? (y7 ? " After the change, the amino acids are all wrong." : " After the frameshift every amino acid is different from the normal chain.") : "");
  }
  const st = M.state;
  let t = "";
  if (S.step === "secondary") {
    t = y7 ? `The chain has twisted into coils: <strong>${pc(M.helix)}</strong> of the coil parts are formed.` : `${pc(M.helix)} of the α-helical regions are formed${sen ? " (i → i+4 backbone H-bonds, dashed)" : ""}.`;
    if (S.T >= 62) t += y7 ? " It's so hot that the coils keep shaking apart." : " At this temperature thermal motion breaks the hydrogen bonds, so the helices fray.";
    return t;
  }
  if (st === "short") return y7 ? `This chain is only <strong>${S.n}</strong> amino acids long — far too short to fold into the right shape or hold the haem. It can't carry oxygen.` : `Only ${S.n} residues: too short to form the globin fold or the haem pocket. ${S.kind === "frameshift" ? "Its sequence after the shift is unrelated to β-globin, so there are no native interactions at all." : "Most of the chain is missing."} It cannot carry oxygen${sen ? " and would be degraded by proteases" : ""}.`;
  if (st === "folded") {
    t = y7 ? `Folded into its working shape (<strong>${pc(M.Q)}</strong> like the normal shape). The water-avoiding amino acids are tucked inside` : `Folded: <strong>${pc(M.Q)}</strong> of native contacts formed; ${pc(M.burial)} of hydrophobic residues are buried in the core`;
    t += S.hasHaem ? (M.haem > 0.5 ? (y7 ? " and the haem is held in its pocket, ready to carry oxygen." : ", and the haem is held in its pocket, so it can bind O₂.") : (y7 ? " — the haem is just settling into its pocket." : "; the haem is re-entering its pocket.")) : ".";
    if (S.sickle) t += y7 ? " Notice the sticky spot (valine) on the outside — that's the sickle-cell change." : " The fold is normal, but Val6 sits on the surface as a hydrophobic patch — the problem shows up between molecules (try 4° or the red blood cell).";
    if (S.T >= 55 && S.T < 62) t += y7 ? " It's getting hot — the shape is starting to wobble." : " Near its melting range the fold is fluctuating more.";
    return t;
  }
  if (st === "partial") {
    if (S.harsh) return y7 ? `The shape is coming apart (${pc(M.Q)} left).` : `Unfolding: ${pc(M.Q)} of native contacts remain as ${S.T >= 62 ? "heat" : "the pH"} breaks the bonds holding the shape.`;
    return y7 ? `Folding… <strong>${pc(M.Q)}</strong> of the way to the right shape. The water-avoiding parts are pulling together.` : `Folding: ${pc(M.Q)} of native contacts formed. ${sen ? "Hydrophobic collapse comes first, then helices dock and side chains lock in." : "The hydrophobic parts collapse inward first, then the helices pack together."}`;
  }
  if (st === "misfolded") return y7 ? "The chain has clumped into the WRONG shape. Once it has been cooked like this it can't fix itself — like a boiled egg." : sen ? `Misfolded/aggregated: after denaturation the exposed hydrophobic residues stuck to the wrong partners (only ${pc(M.Q)} native contacts). Without help it stays trapped${S.chap ? ` — the chaperone is helping it refold` : " — try the chaperone"}.` : `Misfolded: the denatured chain has clumped into the wrong shape (${pc(M.Q)} native). Denaturation is usually permanent, so the protein can no longer carry oxygen.`;
  // unfolded
  if (S.T >= 62) return y7 ? "Too hot! The heat has shaken the chain loose — it has <strong>unravelled</strong> (denatured) and dropped its haem, so it can't carry oxygen." : sen ? `Thermal denaturation: kinetic energy breaks the H-bonds, ionic bonds and hydrophobic packing (${pc(M.Q)} native contacts). The haem pocket is gone, so no O₂ binding — the primary structure is still intact.` : `Denatured by heat: the weak bonds holding the shape have broken (${pc(M.Q)} of the shape left) and the haem has fallen out. The amino-acid chain itself is not broken.`;
  if (S.pH < 4.6 || S.pH > 10.8) return y7 ? "The pH is too extreme — the shape has fallen apart (denatured) and the haem is lost." : sen ? `pH denaturation at pH ${S.pH.toFixed(1)}: the protein carries a net charge of ${S.net > 0 ? "+" : ""}${S.net.toFixed(0)}, so like charges repel and salt bridges break; the haem is released.` : `At pH ${S.pH.toFixed(1)} the charges on the amino acids change (net charge ${S.net > 0 ? "+" : ""}${S.net.toFixed(0)}): ionic bonds break and the chain pushes itself apart — denatured.`;
  if (S.kind === "frameshift" || !S.native) return y7 ? "This scrambled chain has no 'right' shape to fold into." : "This chain has no native interactions to guide folding, so it can only flop about or collapse into a random glob.";
  return y7 ? "The chain is floppy and unfolded." : `Unfolded (${pc(M.Q)} native contacts).`;
}

export const QUIZ = [
  { maxBand: "y7-8", q: "Why does a protein's shape matter?", options: ["It decides the protein's colour", "Its shape is what lets it do its job", "It doesn't — only its size matters", "It decides how much DNA the cell has"], answer: 1, why: "Haemoglobin's folded shape makes a pocket that holds the haem, which grabs oxygen. Lose the shape, lose the job." },
  { maxBand: "y7-8", q: "What happened when you heated haemoglobin to 80 °C?", options: ["It folded tighter", "It unravelled (denatured) and couldn't carry oxygen", "It made more amino acids", "Nothing"], answer: 1, why: "Heat shakes apart the weak attractions holding the shape. The chain unravels and the haem falls out." },
  { maxBand: "y7-8", q: "Where do the water-avoiding (orange) amino acids end up in the folded protein?", options: ["On the outside", "Hidden in the middle", "They are cut off", "In the haem"], answer: 1, why: "They tuck inside, away from the water around the protein. Water-loving ones stay on the outside." },
  { maxBand: "y7-8", q: "The sickle-cell change swaps just ONE amino acid. What happens?", options: ["Nothing at all", "The protein can't be made", "The molecules stick together when oxygen is low, bending red blood cells", "The cell makes extra oxygen"], answer: 2, why: "The new amino acid makes a sticky spot. When oxygen is low the molecules join into fibres that bend the cell into a sickle." },
  { maxBand: "y7-8", q: "A DNA change makes a STOP signal too early. What does the protein look like?", options: ["Normal", "Too long", "Too short to fold properly", "It has two haems"], answer: 2, why: "Translation stops early, so the chain is cut short and can't fold into the working shape." },
  { band: "y9-10", maxBand: "y9-10", q: "Which mutation leaves the protein completely unchanged?", options: ["Nonsense", "Silent", "Frameshift", "Missense"], answer: 1, why: "A silent mutation changes a codon to another codon for the same amino acid, so the protein is identical." },
  { band: "y9-10", maxBand: "y9-10", q: "Why does a frameshift mutation usually have a bigger effect than a missense mutation?", options: ["It changes every codon after the mutation", "It only affects the stop codon", "It changes the DNA bases into RNA", "It makes the protein longer"], answer: 0, why: "Adding or deleting 1–2 bases shifts the reading frame, so every codon afterwards is read differently (and a stop usually appears soon)." },
  { band: "y9-10", maxBand: "y9-10", q: "In the folded protein, hydrophobic amino acids are mostly…", options: ["On the surface, touching water", "Buried in the core", "Bonded to the haem's iron", "Removed after folding"], answer: 1, why: "The hydrophobic effect drives non-polar side chains into the core, away from water. This is a major force in folding." },
  { band: "y9-10", maxBand: "y9-10", q: "Sickle-cell haemoglobin folds normally. So why is it harmful?", options: ["It has no haem", "Glu → Val puts a hydrophobic patch on its surface, so molecules stick together when deoxygenated", "It is too short", "It denatures at body temperature"], answer: 1, why: "The missense change is on the surface. Deoxygenated HbS molecules polymerise into fibres that distort red blood cells." },
  { band: "y9-10", maxBand: "y9-10", q: "After heating denatures haemoglobin, cooling it back to 37 °C…", options: ["always restores the shape", "usually doesn't: the unfolded chains clump into the wrong shape", "makes it fold into a stronger shape", "turns it back into DNA"], answer: 1, why: "Denaturation is usually permanent: exposed hydrophobic parts stick to the wrong partners (like cooked egg white)." },
  { band: "y9-10", maxBand: "y9-10", q: "What do the four levels of protein structure describe?", options: ["Four different proteins", "Sequence → local coils/sheets → whole 3D fold → several chains together", "Four stages of DNA replication", "The four bases of DNA"], answer: 1, why: "Primary (sequence), secondary (helices/sheets), tertiary (3D fold of one chain), quaternary (several chains)." },
  { band: "y11", q: "Which bonds stabilise an α-helix?", options: ["Disulfide bridges between adjacent residues", "Hydrogen bonds between backbone C=O of residue i and N–H of residue i+4", "Ionic bonds between side chains only", "Peptide bonds"], answer: 1, why: "α-helices are secondary structure: backbone H-bonds i → i+4. Side-chain interactions belong to tertiary structure." },
  { band: "y11", q: "Which interaction is covalent?", options: ["Hydrogen bond", "Ionic bond (salt bridge)", "Disulfide bridge", "Hydrophobic interaction"], answer: 2, why: "The S–S bond between two cysteines is covalent, which is why it survives conditions that break the weaker interactions (globins don't have one)." },
  { band: "y11", q: "At pH 2 the model protein unfolds. The best explanation is that…", options: ["peptide bonds are hydrolysed instantly", "carboxylate groups are protonated, so salt bridges break and the many positive charges repel each other", "the haem turns into an amino acid", "water stops being polar"], answer: 1, why: "Low pH protonates Asp/Glu (losing their − charge) while His/Lys/Arg stay +: ionic bonds break and net charge repulsion pushes the chain apart." },
  { band: "y11", q: "Why does HbS polymerise only when deoxygenated?", options: ["Oxygen breaks the Val6 residue", "In the deoxy (T) conformation the hydrophobic acceptor pocket (Phe85/Leu88) on a neighbouring tetramer is exposed for Val6", "Deoxy HbS loses its haem", "Oxygen is hydrophobic"], answer: 1, why: "The Val6 patch is always present, but the complementary hydrophobic pocket is only available in the T state, so polymers form at low pO₂." },
  { band: "y11", q: "A nonsense mutation at codon 39 (CAG → TAG) causes β⁰-thalassaemia rather than an abnormal haemoglobin because…", options: ["the truncated chain can't fold or bind haem, and the mRNA is mostly degraded", "it is a silent mutation", "it shifts the reading frame", "it only affects α chains"], answer: 0, why: "A premature stop gives a truncated, non-functional chain; nonsense-mediated decay removes most of the mRNA, so no β-globin is made." },
  { band: "y11", q: "Molecular chaperones (e.g. Hsp70) help proteins by…", options: ["adding amino acids to the chain", "binding exposed hydrophobic regions so they don't aggregate, giving the chain another chance to fold (using ATP)", "changing the primary structure", "making disulfide bridges in every protein"], answer: 1, why: "Chaperones don't contain folding information — the sequence does. They prevent wrong interactions and aggregation." },
];
