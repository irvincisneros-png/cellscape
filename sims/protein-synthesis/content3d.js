// Lens-aware text, missions and quiz for the 3D "DNA to protein" level. The Years 11–12 wording is carried over
// from the reviewed 2D sim (sim2d.js); Years 7–8 and 9–10 are simplified versions of the same model states.
import * as M from "./model.js";

export const NOTE = {
  "y7-8": "This is part of a real <strong>human</strong> gene — the recipe for haemoglobin, which carries oxygen in your blood. We've put it in a plant cell just for teaching: plant genes are read in exactly the same way. Not to scale.",
  "y9-10": "Model gene: a short fragment of the human <strong>β-globin</strong> gene (haemoglobin), shown inside a plant cell for teaching — every cell reads genes the same way. Not to scale: real RNA polymerases and ribosomes are much bigger than the DNA drawn here.",
  y11: "Model gene: a simplified fragment inspired by the start of human <strong>β-globin</strong> (first 9 codons plus an added stop codon), shown inside a plant cell for teaching. Codons are numbered from the amino acid after the starting Met, as in haemoglobin. Not to scale: the TATA box really sits ~25–30 bases upstream, and RNA polymerase (~15 nm) and ribosomes (~25 nm) are far larger than the DNA here.",
};

export const NAMES = {
  pol: { "y7-8": "RNA polymerase (copying machine)", "y9-10": "RNA polymerase" },
  ribo: { "y7-8": "Ribosome (protein builder)", "y9-10": "Ribosome" },
  trna: { "y7-8": "tRNA (carrier)", "y9-10": "tRNA" },
  mrna: { "y7-8": "mRNA (the message)", "y9-10": "mRNA" },
  rf: { "y7-8": "Stop protein (release factor)", "y9-10": "Release factor" },
  nuc: { "y7-8": "Nucleus", "y9-10": "Nucleus" },
  cyto: { "y7-8": "Cytoplasm", "y9-10": "Cytoplasm" },
  env: { "y7-8": "Nuclear envelope", "y9-10": "Nuclear envelope (with a nuclear pore)" },
  chain: { "y7-8": "New protein (chain of amino acids)", "y9-10": "Polypeptide" },
};

const aaName = (a) => M.AA[a][0];
const chainText = (chain) => chain.length ? chain.slice().reverse().map((b) => aaName(b.a)).join("–") : "";

/** "What's happening" HTML from the actual model state. Returns [key, html]. */
export function explain(S, band, h) {
  const y7 = band === "y7-8", y9 = band === "y9-10";
  if (S.act === 1) {
    const t1 = S.t1, G = S.gene.length, pl = t1.placed;
    const n = S.gene[pl], tb = n ? M.DNA_PAIR[n.b] : "", need = n ? M.toRNA(n.b) : "";
    switch (t1.phase) {
      case "ready":
        if (y7) return [`r${G}`, `<p>The <strong>copying machine</strong> (RNA polymerase) has found the start of the gene and opened up the DNA. It copies the <strong>bottom strand</strong>.</p><p>Drag the matching letter onto the glowing spot: the bottom letter is <strong>${tb}</strong>. In the copy, <strong>A</strong> pairs with <strong>U</strong> (not T!), T with A, G with C.</p>`];
        if (y9) return [`r${G}`, `<p><strong>RNA polymerase</strong> has bound to the <strong>promoter</strong> and unwound the start of the gene. The lower strand is the <strong>template strand</strong>.</p><p>Drag the RNA nucleotide that pairs with template base <strong>${tb}</strong>. RNA pairing: A → <strong>U</strong>, T → A, G → C, C → G. RNA uses <strong>uracil (U)</strong> instead of thymine.</p>`];
        return [`r${G}`, `<p><strong>RNA polymerase</strong> has bound to the <strong>promoter</strong> (TATA box region) and unwound the start of the gene. The lower DNA strand is the <strong>template strand</strong>.</p><p>Drag or tap the free <strong>RNA nucleotide</strong> that pairs with the glowing template base <strong>${tb}</strong>. RNA pairing: template A → <strong>U</strong>, T → A, G → C, C → G. RNA uses <strong>uracil (U)</strong>, never thymine (T).</p>`];
      case "elong":
        if (y7) return [`e${pl}`, `<p>Copying: <strong>${pl} of ${G}</strong> letters done. Next DNA letter: <strong>${tb}</strong> — which letter matches it? Behind the machine, the copy (<strong>mRNA</strong>) peels off and the DNA zips back up.</p>`];
        if (y9) return [`e${pl}`, `<p>Transcribing: <strong>${pl} of ${G}</strong> nucleotides joined. Next template base: <strong>${tb}</strong>. The mRNA is built as a copy of the <strong>coding strand</strong> (top), with U in place of T. Every 3 bases make one <strong>codon</strong>.</p>`];
        return [`e${pl}`, `<p>Transcribing: <strong>${pl} of ${G}</strong> nucleotides joined. Next template base: <strong>${tb}</strong> — which RNA base pairs with it?</p><p>RNA polymerase reads the template <strong>3′→5′</strong> and builds mRNA <strong>5′→3′</strong>. Each nucleotide arrives with three phosphates; two are released to power the new bond. Behind the polymerase the mRNA peels away and the DNA rewinds. The mRNA matches the <strong>coding strand</strong>, with U in place of T.</p>`];
      case "term":
        return ["term", y7 ? `<p>The machine has reached the gene's <strong>stop-copying signal</strong>. It lets go, the DNA zips back up, and the finished copy (${G} letters) floats free.</p>`
          : `<p>RNA polymerase has passed the end of the gene and reached the <strong>terminator</strong>. It lets go of the DNA, which zips back into a double helix, and releases the new mRNA (${G} nucleotides).</p>`];
      case "export":
      case "exported": {
        const done = t1.phase === "exported" ? (y7 ? " Now switch to <strong>2 · Translation</strong> to build the protein." : " Now switch to <strong>Act 2 · Translation</strong>.") : "";
        if (y7) return [t1.phase, `<p>The mRNA copy leaves the nucleus through a <strong>nuclear pore</strong>. The DNA itself stays safe inside — only the copy goes out to the protein builders.${done}</p>`];
        if (y9) return [t1.phase, `<p>The mRNA leaves the nucleus through a <strong>nuclear pore</strong>. The DNA never leaves the nucleus — only the mRNA copy does.${done}</p>`];
        return [t1.phase, `<p>The mRNA leaves the nucleus through a <strong>nuclear pore</strong>. The DNA itself never leaves the nucleus — only the copy does.${done}</p>
          <p><em>Processing:</em> in eukaryotes the first copy (<strong>pre-mRNA</strong>) is processed before export: a <strong>5′ cap</strong> and a <strong>poly-A tail</strong> are added (shown), and <strong>introns are spliced out</strong> so only exons remain. This short fragment lies inside exon 1 of β-globin, so it has no intron to remove — the real gene's two introns come later (after codons 30 and 104).</p>`];
      }
    }
  }
  const t2 = S.t2;
  if (!t2) return ["none", ""];
  const cod = h.aCodon();
  const ch = chainText(t2.chain);
  switch (t2.phase) {
    case "nostart":
      return ["ns", y7 ? `<p>This message has <strong>no start word (AUG)</strong>, so the ribosome can't begin and <strong>no protein is made</strong>. Go back to 1 and change the DNA.</p>`
        : `<p>This mRNA has <strong>no AUG start codon</strong>, so a ribosome cannot begin translation and <strong>no polypeptide is made</strong>. Go back to Act 1 and change the DNA.</p>`];
    case "init":
      return ["init", y7 ? `<p>The small part of the <strong>ribosome</strong> grabs the mRNA and slides along to the <strong>start word, AUG</strong>.</p>` : `<p>The <strong>small ribosomal subunit</strong> attaches near the 5′ end of the mRNA and slides along until it finds the <strong>start codon AUG</strong>.</p>`];
    case "needP":
      return ["needP", y7 ? `<p>The start word <strong>AUG</strong> is in place. Drag the <strong>carrier (tRNA)</strong> whose bottom letters <strong>UAC</strong> match AUG. It brings the first building block: <strong>Met</strong>.</p>`
        : `<p>The start codon <strong>AUG</strong> is in the <strong>P site</strong>. Drag the <strong>initiator tRNA</strong>, whose anticodon <strong>3′-UAC-5′</strong> pairs with AUG. It carries <strong>methionine (Met)</strong>, the first amino acid of every new polypeptide.</p>`];
    case "join":
      return ["join", y7 ? `<p>The big part of the ribosome joins on. Now it can read the message three letters at a time.</p>`
        : y9 ? `<p>The <strong>large subunit</strong> joins. The ribosome reads the mRNA one <strong>codon</strong> (3 bases) at a time.</p>`
        : `<p>The <strong>large subunit</strong> joins, completing the ribosome. It has three tRNA sites: <strong>A</strong> (aminoacyl — new tRNA arrives), <strong>P</strong> (peptidyl — holds the growing chain) and <strong>E</strong> (exit).</p>`];
    case "needA":
      return [`A${t2.k}`, y7 ? `<p>Next word on the message: <strong>${cod}</strong>. Drag the carrier with the matching letters (A↔U, G↔C). It brings <strong>${aaName(M.CODE[cod])}</strong>.</p><p>Protein so far: <strong>${ch}</strong></p>`
        : `<p>Codon in the <strong>A site</strong>: <strong>${cod}</strong>. Drag the tRNA whose <strong>anticodon</strong> is complementary to it (A↔U, G↔C). Use the genetic code table to predict which amino acid it brings.</p><p>Chain so far: <strong>${ch}</strong></p>`];
    case "bond":
      return [`B${t2.k}`, y7 ? `<p>The new building block is joined onto the chain.</p>` : `<p>A <strong>peptide bond</strong> forms: the growing chain is transferred from the tRNA in the P site onto the amino acid held by the tRNA in the A site.${y9 ? "" : " The ribosome's rRNA catalyses this reaction."}</p>`];
    case "shift":
      return [`S${t2.k}`, y7 ? `<p>The ribosome shuffles along to the next word. The empty carrier floats away to collect another building block.</p>`
        : `<p><strong>Translocation:</strong> the ribosome moves along the mRNA by one codon (3 nucleotides) towards the 3′ end.${y9 ? " The empty tRNA leaves." : " The empty tRNA shifts into the <strong>E site</strong> and leaves (it can be reloaded with another amino acid); the A site is now free."}</p>`];
    case "stop":
      return ["stop", y7 ? `<p>The word <strong>${cod}</strong> means <strong>STOP</strong>. No carrier matches it — drag the <strong>stop protein</strong> (release factor) in instead.</p>`
        : `<p>Stop codon <strong>${cod}</strong> is in the A site. No tRNA has an anticodon for a stop codon — instead a <strong>release factor</strong> protein binds. Drag the release factor into the A site.</p><p>Chain so far: <strong>${ch}</strong></p>`];
    case "release":
      return ["rel", y7 ? `<p>The finished protein chain is let go and the ribosome comes apart, ready to be used again.</p>` : `<p>The release factor causes the polypeptide to be cut free from the last tRNA. The ribosome's subunits separate and can be reused on another mRNA — and the mRNA can be read again by more ribosomes.</p>`];
    case "stall":
      return ["stall", y7 ? `<p>The ribosome ran off the end of the message <strong>without finding a stop word</strong>. The broken chain (${t2.chain.length} building blocks) is let go — cells destroy faulty proteins like this.</p>`
        : `<p>The ribosome reached the 3′ end of the mRNA <strong>without meeting a stop codon in this reading frame</strong>. The incomplete chain (${t2.chain.length} amino acids) is released; cells detect and destroy faulty proteins like this.</p>`];
    case "done": {
      const cls = M.classify(M.ORIGINAL_GENE, t2.gene);
      if (y7) return [`d${t2.gene}`, `<p>Finished! A chain of <strong>${t2.chain.length} building blocks</strong>: ${ch}. The order of the blocks decides how the protein <strong>folds</strong> into its shape — dive into the glowing chain to watch. (The real haemoglobin chain is 146 blocks long.)</p><p>${cls.kind === "none" ? "Try <strong>Change the DNA</strong> to see what a single wrong letter does." : `Compared with the original: <strong>${cls.title}</strong>.`}</p>`];
      return [`d${t2.gene}`, `<p>Finished! A polypeptide of <strong>${t2.chain.length} amino acids</strong>: ${ch}. Its amino acid sequence determines how it <strong>folds</strong> into a 3D shape — dive into the glowing chain to see (the real β-globin chain is 146 amino acids long).</p>
        <p>Compared with the original gene: <strong>${cls.title}</strong>. ${cls.kind === "none" ? "Try the Mutation lab to change the DNA." : cls.detail}</p>`];
    }
  }
  return ["", ""];
}

/** Simpler classification wording for Years 7–8 / 9–10. */
export function plainResult(cls, band) {
  if (band !== "y7-8") return null;
  const t = {
    none: "Same as the original gene.", noncoding: "The change is after the stop word, so the protein is the same.",
    silent: "The letters changed but the word still means the same building block — the protein is the same!",
    missense: "One building block in the protein is different. The protein might fold or work differently.",
    nonsense: "The change made a STOP word too early — the protein is cut short.",
    frameshift: "Adding or removing a letter shifted how every word after it is read — the rest of the protein is scrambled.",
    inframe: "A whole word was added or removed, so the protein gains or loses a building block.",
    stoplost: "The stop word was lost, so the protein is too long.", startlost: "The start word is gone — no protein (or a very different one) is made.",
  };
  return t[cls.kind];
}

export const MISSIONS = [
  { id: "transcribe", text: { "y7-8": "Copy the gene into a messenger molecule (mRNA).", "y9-10": "Transcribe the gene into mRNA.", y11: "Transcribe the whole gene: template strand → mRNA." } },
  { id: "translate", text: { "y7-8": "Build the protein: bring carriers until the stop word.", "y9-10": "Translate the mRNA all the way to the stop codon.", y11: "Translate the mRNA all the way to the stop codon." } },
  { id: "noT", band: "y7-8", maxBand: "y9-10", text: { "y7-8": "Find out why T can't go into the mRNA copy.", "y9-10": "Try a thymine (T) nucleotide in the mRNA and find out why it's rejected." } },
  { id: "change", maxBand: "y7-8", text: { "y7-8": "Change one DNA letter, run it, and compare the proteins." } },
  { id: "silent", band: "y9-10", text: { "y9-10": "Make a DNA change with <strong>no effect</strong> on the protein (silent) and run it.", y11: "Make a <strong>silent</strong> mutation and run it." } },
  { id: "harmful", band: "y9-10", maxBand: "y9-10", text: { "y9-10": "Make a <strong>harmful</strong> change: stop the protein early or scramble it (insert/delete a base), and run it." } },
  { id: "nonsense", band: "y11", text: { y11: "Make a <strong>nonsense</strong> mutation (early stop) and run it." } },
  { id: "frameshift", band: "y11", text: { y11: "Cause a <strong>frameshift</strong> by inserting or deleting a base, and run it." } },
  { id: "sickle", text: { "y7-8": "Make the <strong>sickle-cell</strong> change and see what it does to the protein.", "y9-10": "Reproduce the <strong>sickle-cell</strong> mutation: codon 6 GAG → GTG.", y11: "Reproduce the <strong>sickle-cell</strong> substitution: codon 6 GAG → GTG." } },
];

export const QUIZ = [
  // Years 7–8
  { maxBand: "y7-8", q: "What is a gene?", options: ["A type of cell", "A section of DNA with the instructions for making a protein", "A protein", "A chromosome"], answer: 1, why: "A gene is a stretch of DNA. Its letters (A, T, G, C) spell out the order of building blocks in a protein." },
  { maxBand: "y7-8", q: "Why does the cell make an mRNA copy instead of sending the DNA out?", options: ["DNA is too short", "The DNA stays safe in the nucleus; the copy carries the message to the ribosomes", "mRNA is stronger than DNA", "Ribosomes are inside the nucleus"], answer: 1, why: "DNA is the master copy and never leaves the nucleus. Disposable mRNA copies carry the instructions out to the ribosomes." },
  { maxBand: "y7-8", q: "In the mRNA copy, which letter is used instead of T?", options: ["A", "G", "U", "C"], answer: 2, why: "RNA uses U (uracil) instead of T (thymine). So a DNA A is copied as U." },
  { maxBand: "y7-8", q: "What does the ribosome do?", options: ["Copies DNA", "Joins amino acids together in the order set by the mRNA, making a protein", "Stores energy", "Carries oxygen"], answer: 1, why: "The ribosome reads the mRNA three letters at a time and joins the matching amino acids into a chain — a protein." },
  { maxBand: "y7-8", q: "In sickle-cell disease, one DNA letter in the haemoglobin gene is different. What happens?", options: ["Nothing at all", "One building block in the protein changes, so haemoglobin works differently", "The whole gene disappears", "The person grows extra cells"], answer: 1, why: "One changed letter changes one amino acid (Glu → Val). Haemoglobin then clumps when oxygen is low, bending red blood cells into a sickle shape." },
  // Years 9–10
  { band: "y9-10", maxBand: "y9-10", q: "A codon is…", options: ["A single DNA base", "A group of three mRNA bases that codes for one amino acid (or stop)", "A whole gene", "A type of protein"], answer: 1, why: "The genetic code is read in triplets. 61 codons code for amino acids; 3 are stop codons." },
  { band: "y9-10", maxBand: "y9-10", q: "Where do transcription and translation happen in a plant or animal cell?", options: ["Both in the nucleus", "Transcription in the nucleus, translation at ribosomes in the cytoplasm", "Both in the cytoplasm", "Transcription at ribosomes"], answer: 1, why: "mRNA is made from DNA in the nucleus, leaves through nuclear pores, and is translated by ribosomes in the cytoplasm." },
  { band: "y9-10", maxBand: "y9-10", q: "A substitution changes GAA to GAG. Both code for Glu. What is the effect?", options: ["Harmful: the protein is shorter", "Minimal: the protein is unchanged (a silent mutation)", "The reading frame shifts", "No protein is made"], answer: 1, why: "Several codons can code for the same amino acid, so some changes have no effect on the protein." },
  { band: "y9-10", maxBand: "y9-10", q: "Why is deleting one base usually more harmful than substituting one?", options: ["It changes only one amino acid", "Every codon after it is read differently (frameshift)", "It has no effect", "It makes the gene longer"], answer: 1, why: "Codons are read in threes from the start. Removing one base shifts all the following triplets." },
  { band: "y9-10", maxBand: "y9-10", q: "Mutations can be harmful, beneficial or have little effect. Which is a beneficial example?", options: ["Sickle-cell carriers are more resistant to malaria", "A nonsense mutation that cuts a vital enzyme short", "A frameshift in haemoglobin", "None — mutations are always harmful"], answer: 0, why: "Carrying one sickle-cell allele gives some protection against malaria — a benefit where malaria is common. Most mutations are neutral; some are harmful; a few help." },
  // Year 11+ (from the reviewed 2D sim)
  { band: "y11", q: "In DNA, adenine pairs with thymine. When RNA polymerase reads an <strong>A</strong> on the template strand, which base does it add to the mRNA?", options: ["Thymine (T)", "Uracil (U)", "Adenine (A)", "Guanine (G)"], answer: 1, why: "RNA contains uracil instead of thymine, so template A pairs with U. (G–C pairing is the same in DNA and RNA.)" },
  { band: "y11", q: "An mRNA codon reads 5′-GAG-3′. Which tRNA anticodon pairs with it?", options: ["3′-CTC-5′", "3′-CUC-5′", "3′-GAG-5′", "3′-GUG-5′"], answer: 1, why: "Anticodons are complementary and antiparallel to codons, and tRNA is RNA so it uses U, not T: G↔C, A↔U, G↔C gives 3′-CUC-5′ (carrying Glu)." },
  { band: "y11", q: "Which statement about start and stop codons is correct?", options: ["AUG starts translation and codes for Met; UAA, UAG and UGA stop it", "UAA starts translation; AUG stops it", "Stop codons are read by tRNAs carrying a 'stop' amino acid", "Every codon can start translation"], answer: 0, why: "AUG is the start codon (Met). Stop codons have no matching tRNA — a release factor binds instead and the polypeptide is released." },
  { band: "y11", q: "Why is a frameshift (inserting or deleting one base) usually more harmful than a single substitution?", options: ["It changes only one amino acid", "It shifts the reading frame, so every codon after it is read differently and a stop codon often appears early", "It stops transcription completely", "It always produces a silent mutation"], answer: 1, why: "Codons are read in groups of three from the start codon. Adding or removing one base changes every following triplet, scrambling the rest of the protein and often creating an early stop." },
  { band: "y11", q: "Sickle-cell anaemia is caused by GAG → GTG in codon 6 of the β-globin gene. What type of mutation is this?", options: ["Silent", "Nonsense", "Missense (substitution)", "Frameshift"], answer: 2, why: "One base is substituted, changing one amino acid (Glu → Val). The protein is full length, but the hydrophobic valine makes haemoglobin molecules clump when oxygen is low." },
  { band: "y11", q: "Before export, eukaryotic pre-mRNA is processed. Which change is <strong>not</strong> part of processing?", options: ["Adding a 5′ cap", "Adding a poly-A tail", "Splicing out introns", "Replacing uracil with thymine"], answer: 3, why: "Processing adds a 5′ cap and a poly-A tail and removes introns. mRNA always contains uracil." },
];
