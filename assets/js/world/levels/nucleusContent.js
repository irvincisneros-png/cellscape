// Lens-aware text for the nucleus level. Values may be strings or { "y7-8", "y9-10", "y11", "y12" }.
// The numbers in narrative() come straight from NucleusModel's fluxes (nucleusModel.js).

export const PARTS = {
  envelope: {
    name: { "y7-8": "Nuclear envelope (double skin)", "y9-10": "Nuclear envelope", y11: "Nuclear envelope (double membrane)" }, color: "#c4b5fd",
    role: {
      "y7-8": "Two thin skins that wrap the nucleus and keep the DNA safely inside. Messages and building blocks pass in and out through holes called pores.",
      "y9-10": "A <strong>double membrane</strong> around the nucleus. It keeps DNA inside, so DNA is never used up or damaged out in the cytoplasm. Molecules move in and out through nuclear pores.",
      y11: "Two lipid bilayers separated by the perinuclear space. The outer membrane is continuous with the rough ER (and carries ribosomes); the inner membrane binds the lamina and chromatin. Separating transcription (inside) from translation (outside) lets eukaryotes process mRNA before it is read.",
    },
  },
  pore: {
    name: { "y7-8": "Nuclear pore", y11: "Nuclear pore complex" }, color: "#ede9fe",
    role: {
      "y7-8": "Gateways through the envelope. Messages (mRNA) and ribosome parts go out; proteins the nucleus needs come in.",
      "y9-10": "Protein gateways in the envelope. mRNA and ribosomal subunits are <strong>exported</strong>; proteins made in the cytoplasm (like RNA polymerase and histones) are <strong>imported</strong>.",
      y11: "A ring of ≈ 30 kinds of nucleoporins with 8-fold symmetry (≈ 120 nm across), with cytoplasmic filaments and a nuclear basket. Small molecules diffuse through; large cargo needs transport receptors and the Ran-GTP cycle (energy from GTP). Processed mRNA leaves as an mRNP; unspliced pre-mRNA is held back.",
    },
    inputs: { "y7-8": "proteins, building blocks", y11: "RNA polymerases, histones, ribosomal proteins, NTPs" }, outputs: { "y7-8": "mRNA messages, ribosome parts", y11: "mature mRNA, ribosomal subunits" },
  },
  nucleolus: {
    name: "Nucleolus", color: "#a855f7",
    role: {
      "y7-8": "A dense blob inside the nucleus where the parts of <strong>ribosomes</strong> (the cell's protein builders) are made.",
      "y9-10": "Makes the RNA of ribosomes (<strong>rRNA</strong>) and packs it with ribosomal proteins into the two ribosome <strong>subunits</strong>, which leave through the pores.",
      y11: "Forms around the rRNA genes. RNA polymerase I transcribes rRNA in the fibrillar centres, it is processed in the dense fibrillar component and assembled with imported ribosomal proteins in the granular component into 40S and 60S subunits, which are exported and only join on an mRNA in the cytoplasm.",
    },
    inputs: { "y7-8": "building blocks, ribosome proteins", y11: "NTPs, imported ribosomal proteins" }, outputs: { "y7-8": "ribosome parts", y11: "small (40S) and large (60S) subunits" },
  },
  chromatin: {
    name: { "y7-8": "DNA (chromosome)", "y9-10": "Chromosome territory", y11: "Chromatin territory (euchromatin)" }, color: "#f472b6", portal: true,
    role: {
      "y7-8": "Each tangle is one <strong>chromosome</strong>: a single, very long DNA molecule, unwound so its instructions can be read. Each colour is a different chromosome.",
      "y9-10": "Between divisions, each chromosome unwinds into its own region (a <strong>territory</strong>). Loosely packed DNA lets the cell read its <strong>genes</strong>. Plant body cells have two copies of each chromosome (one from each parent), drawn here in matching colours.",
      y11: "Each chromosome occupies its own territory. <strong>Euchromatin</strong> is loosely packed, gene-rich and accessible to RNA polymerase; active genes loop out to the edge of their territory. Shown as 10 chromosomes (5 homologous pairs, like <em>Arabidopsis</em>).",
    },
  },
  hetero: {
    name: { "y7-8": "Tightly packed DNA", "y9-10": "Heterochromatin", y11: "Heterochromatin (chromocentres)" }, color: "#be185d",
    role: {
      "y7-8": "DNA wound up very tightly. Genes here are packed away and not read.",
      "y9-10": "Densely packed DNA, mostly near the envelope. Genes in it are switched off.",
      y11: "Condensed, mostly gene-poor DNA — repeats and transposons around the centromeres — clustered as chromocentres near the envelope and lamina. In plants it is marked by DNA methylation (at CG, CHG and CHH sites) and H3K9 methylation, which keep transposons silent.",
    },
  },
  gene: {
    name: { "y7-8": "A gene being copied", "y9-10": "Active gene (transcription)", y11: "Gene being transcribed" }, color: "#60a5fa",
    role: {
      "y7-8": "A gene is a short part of the DNA with the instructions for one protein. Copying machines (blue-white dots) move along it, each making a message (mRNA).",
      "y9-10": "<strong>RNA polymerase</strong> attaches at the start of the gene and moves along it, building an <strong>mRNA</strong> copy. Many polymerases can copy one gene at once, so the mRNA strands grow longer along the gene.",
      y11: "RNA polymerase II binds the promoter (with transcription factors) and moves 3′→5′ along the template strand, adding NTPs to the growing pre-mRNA. Several polymerases transcribe one gene at once, giving the \"Christmas tree\" seen in electron micrographs. Processing starts while transcription is still happening.",
    },
    inputs: { "y7-8": "energy and building blocks", y11: "NTPs (ATP, GTP, CTP, UTP)" }, outputs: { "y7-8": "mRNA messages", y11: "pre-mRNA" },
  },
  lamina: {
    name: "Nuclear lamina", color: "#5eead4",
    role: {
      "y7-8": "A mesh that lines the inside of the envelope and holds the nucleus in shape.",
      y11: "A protein meshwork lining the inner membrane (lamins in animals; plants use analogous proteins such as CRWNs). It shapes the nucleus, anchors pores and holds heterochromatin at the periphery.",
    },
  },
  speckle: {
    name: { "y7-8": "Speckle", y11: "Nuclear speckle" }, color: "#bef264",
    role: {
      "y7-8": "Small stores of helper molecules.",
      y11: "Stores of splicing factors in the spaces between chromosome territories. Active genes are often found next to them, so newly made pre-mRNA can be spliced quickly.",
    },
  },
  er: {
    name: { "y7-8": "Rough ER", y11: "Rough endoplasmic reticulum" }, color: "#5eead4",
    role: {
      "y7-8": "Tubes and sheets joined to the nucleus, covered in ribosomes. The mRNA messages go to the ribosomes to be turned into proteins.",
      "y9-10": "Joined to the outer nuclear membrane. Ribosomes on it read exported mRNA and make proteins.",
      y11: "Continuous with the outer nuclear membrane (the perinuclear space is continuous with the ER lumen). Ribosomes translate exported mRNAs; secreted and membrane proteins enter the ER as they are made.",
    },
  },
  nucleoplasm: {
    name: "Nucleoplasm", color: "#a5b4fc",
    role: {
      "y7-8": "The jelly that fills the nucleus.",
      y11: "The fluid inside the nucleus, containing NTPs, enzymes, transcription factors and the RNA being processed.",
    },
  },
};

/** Per-gene names and roles. */
export const GENE_INFO = {
  hbb: {
    name: { "y7-8": "Model gene (a human gene)", "y9-10": "Model gene: β-globin (human)", y11: "Model gene: HBB (β-globin)" }, color: "#fbbf24",
    role: {
      "y7-8": "This is a <strong>human</strong> gene, shown in a plant cell for teaching. It holds the instructions for part of haemoglobin, the protein that carries oxygen in red blood cells. We follow this gene all the way down to its DNA bases.",
      "y9-10": "A human gene (β-globin, part of haemoglobin) used as our <strong>model gene</strong> on every level — a plant cell doesn't really have it. One letter change in it causes sickle-cell disease.",
      y11: "A simplified fragment of human β-globin (HBB) used as the model gene at every scale; it isn't in plant genomes. The real gene has 3 exons and 2 introns (shown in pink on the nascent transcripts), so its pre-mRNA must be spliced before export. A GAG → GTG change in codon 6 gives sickle-cell haemoglobin.",
    },
  },
  rbcs: {
    name: { "y7-8": "Gene for a photosynthesis enzyme", "y9-10": "RBCS gene (Rubisco)", y11: "RBCS (Rubisco small subunit)" }, color: "#4ade80",
    role: {
      "y7-8": "Instructions for part of Rubisco, the enzyme that captures CO₂ in the chloroplasts. Leaf cells copy this gene a lot.",
      "y9-10": "Codes for part of <strong>Rubisco</strong>, the CO₂-fixing enzyme. The protein is made in the cytoplasm and imported into the chloroplast — the nucleus and chloroplast work together.",
      y11: "Nuclear gene for the Rubisco small subunit; very highly expressed in leaves and switched on by light. The protein is made on free ribosomes with a transit peptide and imported into the chloroplast, where it joins the large subunit encoded by chloroplast DNA.",
    },
  },
  lhcb: {
    name: { "y7-8": "Gene for a light-catching protein", "y9-10": "LHCB gene (light harvesting)", y11: "LHCB (light-harvesting protein)" }, color: "#a3e635",
    role: {
      "y7-8": "Instructions for a protein that holds chlorophyll in the chloroplast.",
      y11: "Encodes a chlorophyll a/b-binding protein of the light-harvesting antenna. Transcribed in the nucleus, translated in the cytosol and imported into the thylakoid membranes.",
    },
  },
  act: {
    name: { "y7-8": "Actin gene (cell skeleton)", y11: "ACT (actin)" }, color: "#38bdf8",
    role: {
      "y7-8": "Instructions for actin, which builds the cell's skeleton and tracks for moving organelles.",
      y11: "A \"housekeeping\" gene expressed in nearly all cells; actin filaments drive cytoplasmic streaming.",
    },
  },
  h4: {
    name: { "y7-8": "Histone gene (DNA-packing protein)", y11: "Histone H4" }, color: "#fb923c",
    role: {
      "y7-8": "Instructions for histones, the protein spools DNA wraps around. Histones are made outside the nucleus and carried back in through the pores.",
      y11: "Histone mRNA is exported, translated in the cytosol, and the histones are imported back through the pores to package DNA into nucleosomes — a round trip through the pores.",
    },
  },
  te: {
    name: { "y7-8": "Packed-away gene", "y9-10": "Silenced gene (transposon)", y11: "Silenced transposon" }, color: "#94a3b8",
    role: {
      "y7-8": "A stretch of DNA that is wound up tightly so it's never read.",
      "y9-10": "A \"jumping gene\" (transposon) kept switched off in tightly packed heterochromatin, so it can't copy itself around the genome.",
      y11: "Transposons are kept silent in heterochromatin. The DNA sequence is intact — it is the packaging (chemical tags on DNA and histones) that stops RNA polymerase reaching it. This is <strong>epigenetic</strong> control.",
    },
  },
};

export const BIG_PICTURE = {
  "y7-8": `<p>The nucleus is the cell's <strong>control centre</strong>. It holds the <strong>DNA</strong>: very long molecules (chromosomes) carrying instructions called <strong>genes</strong>.</p><p>The DNA never leaves. Instead, a gene is <strong>copied</strong> into a message (<strong>mRNA</strong>), which leaves through the pores to the ribosomes, where the protein is built.</p>`,
  "y9-10": `<ol class="flow">
      <li><b>Gene → mRNA</b><span>RNA polymerase copies a gene (transcription)</span><em>nucleus</em></li>
      <li><b>mRNA leaves</b><span>through a nuclear pore</span><em>envelope</em></li>
      <li><b>mRNA → protein</b><span>ribosomes read it (translation)</span><em>cytoplasm / rough ER</em></li></ol>
      <p>The nucleolus builds ribosome subunits; proteins the nucleus needs are carried in through the same pores.</p>`,
  y11: `<ol class="flow">
      <li><b>Transcription</b><span>RNA pol II · open chromatin · NTPs</span><em>pre-mRNA</em></li>
      <li><b>Processing</b><span>5′ cap · splicing (introns out) · poly-A tail</span><em>mature mRNA</em></li>
      <li><b>Export</b><span>nuclear pore complex · Ran-GTP</span><em>mRNP to cytoplasm</em></li>
      <li><b>Ribosome biogenesis</b><span>nucleolus · RNA pol I · imported r-proteins</span><em>40S + 60S subunits</em></li></ol>
      <p>Whether a gene is transcribed depends on its <strong>chromatin state</strong> (open euchromatin vs condensed heterochromatin), the supply of polymerase and NTPs, and pore traffic in both directions.</p>`,
};

export const MISSIONS = [
  { maxBand: "y7-8", text: "Watch the messages leave: get at least 3 mRNA per second flowing out through the pores", check: (M) => M.smooth.exp >= 3 },
  { text: { "y7-8": "Block the pores: messages pile up inside (more than 30) and stop leaving", "y9-10": "Block the nuclear pores: mRNA piles up in the nucleus (over 30) and export stops", y11: "Block the pores: mature mRNA accumulates (> 30) and export falls to ≈ 0" }, check: (M) => M.poresBlocked && M.mrna > 30 && M.smooth.exp < 0.2 },
  { maxBand: "y9-10", text: { "y7-8": "Wind the DNA up tightly (condense it) and watch the copying stop", "y9-10": "Condense the chromatin fully: transcription falls below 0.5 per second even with plenty of energy" }, check: (M) => M.condense >= 90 && M.supply >= 50 && M.smooth.tx < 0.5 },
  { maxBand: "y9-10", text: { "y7-8": "Take away the energy supply (10 % or less): copying slows down", "y9-10": "Cut the ATP/NTP supply to 10 % or less: transcription drops below 2 per second" }, check: (M) => M.supply <= 10 && M.smooth.tx < 2 },
  { band: "y9-10", text: { "y9-10": "Switch off one gene by packing its chromatin (in the Genes list) while the others keep going", y11: "Close the chromatin at one gene: its transcription stops while the other genes carry on" }, check: (M) => M.genes.some((g) => !g.hetero && g.closed && g.rate < 0.05) && M.F.tx > 1 },
  { band: "y9-10", text: { "y9-10": "Block the pores and wait: RNA polymerase can't get in, so transcription falls below 1.5/s even though the genes are open", y11: "Block the pores and wait: imported RNA polymerase runs down and transcription falls below 1.5/s (chromatin still open)" }, check: (M) => M.poresBlocked && M.condense < 20 && M.pol < 0.4 && M.smooth.tx < 1.5 },
  { band: "y11", text: "Add α-amanitin: mRNA transcription stops but the nucleolus keeps making rRNA (> 0.5/s)", check: (M) => M.amanitin && !M.actD && M.F.tx < 0.01 && M.F.rtx > 0.5 },
  { band: "y11", text: "Add actinomycin D: all transcription stops and ribosomal subunit export falls below 0.2/s", check: (M) => M.actD && M.smooth.subExp < 0.2 },
  { band: "y12", text: "Silence the model gene epigenetically in the chromatin level (zoom in through the ring) and come back: its rate here falls to ≈ 0", check: (M) => { const g = M.gene("hbb"); return g.epi < 0.3 && g.rate < 0.05; } },
  { text: { "y7-8": "Zoom into the DNA through the glowing ring", "y9-10": "Dive into a chromosome through the glowing ring", y11: "Dive into the chromatin through the glowing ring" }, check: (M, s) => s.dived },
];

export const QUIZ = [
  { maxBand: "y7-8", q: "What does the nucleus contain?", options: ["Food for the cell", "DNA — the instructions (genes) for the cell", "Oxygen", "Water only"], answer: 1, why: "The nucleus holds the cell's <strong>DNA</strong>, organised into chromosomes. Genes are the instructions." },
  { maxBand: "y7-8", q: "Why does the nucleus send out mRNA instead of the DNA itself?", options: ["DNA is too small", "The DNA stays safe inside; mRNA is a copy of one gene that can travel to the ribosomes", "mRNA is stronger than DNA", "Ribosomes can't touch anything"], answer: 1, why: "The master copy (DNA) never leaves. Copies of single genes (mRNA) carry the instructions out." },
  { maxBand: "y7-8", q: "What are the holes in the nuclear envelope called?", options: ["Vacuoles", "Nuclear pores", "Stomata", "Ribosomes"], answer: 1, why: "<strong>Nuclear pores</strong> let messages out and proteins in. Try blocking them!" },
  { maxBand: "y7-8", q: "What is made in the nucleolus?", options: ["Glucose", "Parts of ribosomes", "Chlorophyll", "The cell wall"], answer: 1, why: "The nucleolus builds ribosome parts (subunits), which leave through the pores and join up in the cytoplasm." },
  { maxBand: "y7-8", q: "A chromosome is…", options: ["a type of protein", "one very long DNA molecule, packed with proteins", "a kind of ribosome", "a message that leaves the nucleus"], answer: 1, why: "Each chromosome is a single long DNA molecule. Between cell divisions it's unwound into a loose tangle so its genes can be read." },
  { band: "y9-10", maxBand: "y9-10", q: "Which best describes a gene?", options: ["A whole chromosome", "A section of DNA that codes for a protein", "A protein made by ribosomes", "The nucleus"], answer: 1, why: "DNA → genes (sections) → chromosomes (long DNA molecules) → genome (all of the DNA)." },
  { band: "y9-10", maxBand: "y9-10", q: "The nuclear pores are blocked. Which happens?", options: ["Nothing changes", "mRNA builds up in the nucleus and the ribosomes stop getting instructions", "The DNA leaves instead", "More protein is made"], answer: 1, why: "mRNA can't get out, and proteins the nucleus needs (like RNA polymerase) can't get in, so transcription slows too." },
  { band: "y9-10", maxBand: "y9-10", q: "Why can't RNA polymerase copy genes in tightly packed DNA?", options: ["The DNA is a different shape of molecule", "It can't reach the DNA when it is wound tightly around proteins", "Tight DNA has no genes", "Polymerase only works in the cytoplasm"], answer: 1, why: "Tightly packed DNA (heterochromatin) blocks access; the gene is still there, just switched off." },
  { band: "y9-10", maxBand: "y9-10", q: "Where is the protein Rubisco made, if its gene is in the nucleus?", options: ["In the nucleus", "Its mRNA leaves the nucleus; ribosomes in the cytoplasm make it, then it's imported into the chloroplast", "In the vacuole", "The chloroplast makes all its own proteins"], answer: 1, why: "The nucleus and chloroplast cooperate: many chloroplast proteins are coded by nuclear genes." },
  { band: "y11", q: "α-amanitin blocks RNA polymerase II but not RNA polymerase I. What would you expect?", options: ["All RNA synthesis stops", "mRNA synthesis stops but rRNA is still made in the nucleolus", "rRNA stops but mRNA continues", "Only translation stops"], answer: 1, why: "Pol II transcribes protein-coding genes (mRNA); Pol I transcribes rRNA genes in the nucleolus. Try it!" },
  { band: "y11", q: "Which modifications are made to eukaryotic pre-mRNA before it leaves the nucleus?", options: ["Introns are added", "A 5′ cap, removal of introns (splicing) and a 3′ poly-A tail", "Thymine replaces uracil", "Amino acids are attached"], answer: 1, why: "Capping, splicing and polyadenylation make a stable, exportable mRNA. Unspliced pre-mRNA is held in the nucleus." },
  { band: "y11", q: "Why is the outer nuclear membrane studded with ribosomes?", options: ["It is continuous with the rough ER", "It makes DNA", "Ribosomes are made there", "It is a mistake"], answer: 0, why: "The outer membrane and rough ER are one continuous membrane system." },
  { band: "y11", q: "Import of large proteins through the nuclear pore requires…", options: ["No energy at all", "Transport receptors and energy from the Ran-GTP cycle", "Active transport by ATP synthase", "Vesicles"], answer: 1, why: "Small molecules diffuse; large cargo moves with importins/exportins, made directional by the Ran-GTP gradient. Lower the energy supply and watch import slow." },
  { band: "y12", q: "Heterochromatin genes are usually silent because…", options: ["their sequence has been deleted", "dense packing, DNA methylation and histone marks block access by RNA polymerase", "they are outside the nucleus", "they have no promoter"], answer: 1, why: "The sequence is intact; the chromatin state controls access. That's epigenetic regulation — zoom into the chromatin to change it." },
  { band: "y12", q: "Introns of the β-globin gene are removed by…", options: ["ribosomes", "the spliceosome, before export", "DNA polymerase", "the Golgi"], answer: 1, why: "Spliceosomes (snRNPs) cut out introns and join exons, often while transcription is still going (watch the pink intron segments)." },
];

/** "What's happening": every causal statement is conditioned on the model's fluxes. */
export function narrative(M, band) {
  const F = M.F, S = M.smooth, y7 = band === "y7-8", senior = band === "y11" || band === "y12";
  const f1 = (v) => (v >= 10 ? v.toFixed(0) : v.toFixed(1));
  const out = [];
  const active = M.genes.filter((g) => g.rate > 0.05).length;
  const hbb = M.gene("hbb");
  if (y7) {
    if (M.actD || M.amanitin) out.push("The copying has been <strong>stopped</strong> by a poison. No new messages are being made" + (S.exp > 0.3 ? `, but messages already made are still leaving (${f1(S.exp)} per second).` : "."));
    else if (M.supply <= 15 && S.tx < 2.5) out.push(`There is hardly any <strong>energy</strong> (ATP) or building blocks, so copying genes has slowed to ${f1(S.tx)} messages per second.`);
    else if (M.condense > 60 && S.tx < 1.5) out.push("The DNA is <strong>wound up tightly</strong>, so the copying machines can't reach the genes. Very few messages are being made.");
    else out.push(`Copying machines move along <strong>${active}</strong> genes, making <strong>${f1(S.tx)}</strong> messages (mRNA) per second.`);
    if (M.poresBlocked) out.push(`The pores are <strong>blocked</strong>! Messages can't get out — ${Math.round(M.mrna)} are stuck inside — and ribosome parts pile up in the nucleolus.` + (M.pol < 0.5 ? " The copying machines (made outside) can't get in either, so copying is slowing down." : ""));
    else out.push(`<strong>${f1(S.exp)}</strong> messages per second leave through the pores to the ribosomes, and ${f1(S.subExp)} ribosome parts per second leave the nucleolus.`);
    return out;
  }
  // Year 9 and up
  let s;
  if (M.actD) s = senior ? "<strong>Actinomycin D</strong> intercalates into DNA and blocks all RNA polymerases: no pre-mRNA and no rRNA are being made." : "<strong>Actinomycin D</strong> is blocking all transcription — no mRNA and no ribosome RNA are being made.";
  else if (M.amanitin) s = senior ? `<strong>α-amanitin</strong> has stopped RNA polymerase II, so no pre-mRNA is made (stalled polymerases stay on the genes). RNA polymerase I is unaffected: the nucleolus still makes rRNA (${f1(F.rtx)}/s).` : "<strong>α-amanitin</strong> blocks RNA polymerase II, so genes aren't being copied into mRNA. The nucleolus still makes ribosome RNA.";
  else {
    s = `RNA polymerase is transcribing ${active} gene${active === 1 ? "" : "s"} at <strong>${f1(S.tx)}</strong> transcripts/s in total.`;
    if (M.condense > 50) s += ` The chromatin is ${M.condense >= 90 ? "fully" : "heavily"} condensed, so most promoters are hidden and transcription is low.`;
    if (M.supply <= 30) s += ` The ATP/NTP supply is low (${M.supply}%), so polymerases elongate slowly${senior ? " and splicing and export (which use ATP and GTP) slow too" : ""}.`;
    if (M.pol < 0.6) s += ` Imported RNA polymerase is running low (${Math.round(M.pol * 100)}%), which limits transcription even at open genes.`;
  }
  out.push(s);
  if (!M.actD && !M.amanitin) {
    if (hbb.closed || hbb.epi < 0.3) out.push(`The model gene (β-globin) is ${hbb.epi < 0.3 ? "epigenetically silenced" : "packed into closed chromatin"}: ${f1(hbb.rate)} transcripts/s, even though its DNA sequence is unchanged.`);
    const closed = M.genes.filter((g) => !g.hetero && g.closed && g.id !== "hbb").length;
    if (closed) out.push(`${closed} other gene${closed > 1 ? "s are" : " is"} packed into closed chromatin and silent, while the rest keep going.`);
  }
  if (M.poresBlocked) {
    out.push(`The pores are <strong>blocked</strong>: mature mRNA can't leave (${Math.round(M.mrna)} waiting) and ${Math.round(M.sub)} ribosomal subunits are stuck.` + (M.pol < 0.8 ? ` Proteins made in the cytoplasm can't get in, so RNA polymerase${senior ? ", ribosomal proteins and histones" : " and histones"} are running down.` : " Proteins made in the cytoplasm can't get in either."));
  } else {
    out.push(senior
      ? `Pre-mRNA is capped, spliced and polyadenylated (${f1(F.proc)}/s), then exported as mRNPs: <strong>${f1(S.exp)}</strong> mRNA/s leave through the pores. The nucleolus exports ${f1(S.subExp)} ribosomal subunits/s, and ${f1(S.imp)} proteins/s are imported (polymerases, histones, ribosomal proteins).`
      : `<strong>${f1(S.exp)}</strong> mRNA/s leave through the pores to the ribosomes on the rough ER; ${f1(S.subExp)} ribosome subunits/s leave the nucleolus, and ${f1(S.imp)} proteins/s come in.`);
  }
  if (!M.poresBlocked && S.exp > 0.5 && S.tx < 0.1) out.push("mRNA made earlier is still leaving — the cytoplasm keeps receiving instructions for a while after transcription stops.");
  return out;
}
