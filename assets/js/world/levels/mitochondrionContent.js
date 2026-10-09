// Lens-aware text for the mitochondrion level. Values may be strings or { "y7-8", "y9-10", "y11", "y12" }.
// The numbers in narrative() come straight from MitoModel's fluxes (sims/atp-synthase/model.js).

export const PARTS = {
  outer: {
    name: { "y7-8": "Outer membrane", "y9-10": "Outer membrane" }, color: "#fdba74",
    role: { "y7-8": "The smooth outer skin of the mitochondrion.", "y9-10": "A smooth outer membrane. Small molecules (pyruvate, O₂, CO₂, ATP) pass through it easily.", y11: "Smooth outer membrane, made permeable to small molecules by porin channels (VDAC). Pyruvate, ADP/ATP, Pᵢ, O₂ and CO₂ cross it freely." },
    inputs: "pyruvate, O₂, ADP", outputs: "ATP, CO₂",
  },
  ims: {
    name: "Intermembrane space", color: "#f472b6",
    role: { "y7-8": "The thin gap between the two membranes. H⁺ are pumped into it.", y11: "The thin space between the outer and inner membranes, continuous with the crista lumens. The ETC pumps H⁺ into it, so it has a higher [H⁺] (lower pH) than the matrix." },
  },
  inner: {
    name: { "y7-8": "Inner membrane", y11: "Inner (boundary) membrane" }, color: "#fb923c",
    role: { "y7-8": "The inner skin. It folds inward many times to make the cristae.", "y9-10": "The inner membrane is folded into <strong>cristae</strong>. It holds the electron transport chain and ATP synthase, and is impermeable to H⁺.", y11: "Impermeable to H⁺ (so a gradient can be stored), rich in cardiolipin. Specific carriers move pyruvate and Pᵢ in and swap ADP in for ATP out." },
    inputs: { "y7-8": "fuel and oxygen", y11: "NADH, FADH₂, O₂, ADP + Pᵢ" }, outputs: { "y7-8": "energy (ATP), water", y11: "ATP, H₂O, NAD⁺, FAD" },
  },
  crista: {
    name: { "y7-8": "Crista (fold of the inner membrane)", y11: "Crista" }, color: "#fdba74", portal: true,
    role: { "y7-8": "The folds give a huge area for the energy-making machines.", "y9-10": "Folds of the inner membrane that give a large <strong>surface area</strong> for the electron transport chain and ATP synthase.", y11: "Lamellar folds of the inner membrane. ETC complexes sit on the flat faces; ATP synthase dimers line the curved rims. H⁺ pumped into the crista lumen flow back through ATP synthase into the matrix." },
    inputs: { "y7-8": "fuel (NADH) and oxygen", y11: "NADH, FADH₂, O₂, ADP + Pᵢ" }, outputs: { "y7-8": "energy (ATP) and water", y11: "ATP, H₂O (and an H⁺ gradient)" },
  },
  matrix: {
    name: "Matrix", color: "#5eead4",
    role: { "y7-8": "The jelly-like inside, where food molecules are broken down.", "y9-10": "The inside of the mitochondrion. The link reaction and Krebs cycle happen here, releasing CO₂ and loading NADH.", y11: "Site of the link reaction (pyruvate → acetyl-CoA) and the Krebs cycle. Also contains mtDNA, mitochondrial ribosomes and granules (Ca²⁺ / phosphate deposits)." },
  },
  krebs: {
    name: { "y7-8": "Food-breaking cycle", "y9-10": "Krebs cycle", y11: "Krebs (citric acid) cycle" }, color: "#fb7185",
    role: { "y7-8": "A loop of reactions that breaks the food molecule down, releasing carbon dioxide and loading energy carriers.", "y9-10": "A cycle of enzyme reactions in the matrix. It breaks acetyl groups down to CO₂ and loads the energy carriers NADH and FADH₂.", y11: "Each turn: acetyl-CoA (2C) + oxaloacetate (4C) → citrate (6C) → … → oxaloacetate, releasing 2 CO₂ and producing 3 NADH, 1 FADH₂ and 1 ATP (GTP). Two turns per glucose." },
    inputs: { "y7-8": "broken-down glucose", y11: "acetyl-CoA, NAD⁺, FAD, ADP/GDP" }, outputs: { "y7-8": "carbon dioxide, energy carriers", y11: "2 CO₂, 3 NADH, 1 FADH₂, 1 ATP per turn" },
  },
  glycolysis: {
    name: { "y7-8": "Glucose splitting (cytoplasm)", "y9-10": "Glycolysis (cytoplasm)", y11: "Glycolysis (cytosol)" }, color: "#a3e635",
    role: { "y7-8": "Outside the mitochondrion, in the cytoplasm, glucose is split in half. The halves (pyruvate) go into the mitochondrion.", "y9-10": "Happens in the <strong>cytoplasm</strong>, not the mitochondrion: glucose → 2 pyruvate, making 2 ATP. It doesn't need oxygen.", y11: "In the cytosol: glucose → 2 pyruvate + 2 ATP (net) + 2 NADH. Pyruvate enters the matrix by the mitochondrial pyruvate carrier. Without O₂, pyruvate is fermented (plants and yeast: ethanol + CO₂) to recycle NAD⁺." },
    inputs: "glucose, ADP, NAD⁺", outputs: { "y7-8": "2 pyruvate, a little ATP", y11: "2 pyruvate, 2 ATP, 2 NADH" },
  },
  synthase: {
    name: "ATP synthase", color: "#fbbf24",
    role: { "y7-8": "Tiny spinning motors on the folds. H⁺ rushing through them make ATP.", "y9-10": "Enzymes on the cristae. H⁺ flowing back into the matrix through them drive ADP + Pᵢ → ATP.", y11: "Rotary enzymes in dimers along the crista rims (their pairing helps bend the membrane). H⁺ flow from the crista lumen into the matrix through F₀ drives ATP synthesis in F₁." },
    inputs: "H⁺ flow, ADP + Pᵢ", outputs: "ATP",
  },
  mtdna: {
    name: { "y7-8": "Mitochondrial DNA", y11: "mtDNA" }, color: "#e879f9",
    role: { "y7-8": "Mitochondria have their own small loop of DNA.", y11: "Circular mtDNA (≈ 16.6 kb in humans; larger in plants) codes for some ETC and ATP synthase subunits, rRNAs and tRNAs — evidence for endosymbiotic origin from bacteria." },
  },
  ribo: {
    name: { "y7-8": "Ribosomes", y11: "Mitoribosomes" }, color: "#93c5fd",
    role: { "y7-8": "Mitochondria have their own small ribosomes.", y11: "Mitochondrial ribosomes (bacteria-like, 70S-type) translate the few proteins encoded by mtDNA, mostly inner-membrane subunits." },
  },
};

export const BIG_PICTURE = {
  "y7-8": `<p><strong>glucose + oxygen → carbon dioxide + water + energy (ATP)</strong></p><p>Glucose is first split in the cytoplasm. The pieces enter the mitochondrion, the cell's <strong>power station</strong>, where they are broken down to carbon dioxide and their energy is stored in ATP.</p>`,
  "y9-10": `<p><strong>C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + energy (ATP)</strong></p><ol class="flow">
      <li><b>Glycolysis</b><span>cytoplasm · glucose → 2 pyruvate</span><em>2 ATP</em></li>
      <li><b>Link reaction + Krebs cycle</b><span>matrix · pyruvate → CO₂</span><em>2 ATP<br>NADH, FADH₂</em></li>
      <li><b>Electron transport chain</b><span>cristae · uses O₂</span><em>most of the ATP</em></li></ol>
      <p>About <strong>30 ATP per glucose</strong> with oxygen; only 2 without it.</p>`,
  y11: `<ol class="flow">
      <li><b>Glycolysis</b><span>cytosol · glucose → 2 pyruvate</span><em>2 ATP<br>2 NADH</em></li>
      <li><b>Link reaction</b><span>matrix · pyruvate → acetyl-CoA + CO₂</span><em>2 NADH<br>2 CO₂</em></li>
      <li><b>Krebs cycle</b><span>matrix · two turns</span><em>2 ATP · 6 NADH<br>2 FADH₂ · 4 CO₂</em></li>
      <li><b>ETC + chemiosmosis</b><span>inner membrane / cristae</span><em>≈ 26–28 ATP</em></li></ol>
      <p>Whole pathway ≈ <strong>30–32 ATP per glucose</strong> (≈ 2.5 per NADH, ≈ 1.5 per FADH₂; the cytosolic NADH from glycolysis is worth 1.5–2.5 depending on the shuttle). Proton leak lowers the real yield a little. Without O₂: glycolysis + fermentation, 2 ATP per glucose.</p>`,
};

export const MISSIONS = [
  { maxBand: "y9-10", text: { "y7-8": "Run the power station flat out: get its energy output to 20 ATP per second", "y9-10": "Run respiration flat out: reach an ATP output of 20 per second" }, check: (M) => M.smooth.atp >= 20 },
  { text: { "y7-8": "Take away the oxygen and watch the energy output collapse (below 3 ATP/s)", "y9-10": "Remove the O₂ and watch ATP output collapse below 3 per second", y11: "Remove O₂ (anoxia or 0 %): ATP output falls below 3/s and the Krebs cycle stalls" }, check: (M) => M.o2eff === 0 && M.smooth.atp < 3 && M.F.krebs < 0.1 },
  { maxBand: "y7-8", text: "Turn the glucose supply off and watch the power station run down", check: (M) => M.supply === 0 && M.smooth.atp < 1 },
  { maxBand: "y7-8", text: "Give the cell nothing to do (ATP demand 0 %) — the power station slows right down even with fuel and oxygen", check: (M) => M.demand <= 5 && M.supply > 0 && M.o2eff > 0 && M.smooth.atp < 2 },
  { band: "y9-10", text: { "y9-10": "Poison complex IV with cyanide: NADH backs up and pyruvate piles up", y11: "Cyanide: drive the NADH pool above 90 % reduced and pyruvate to back up into the cytosol" }, check: (M) => M.cyanide && M.nadh > 0.9 && M.pyr > 8 },
  { band: "y9-10", text: "Uncouple with DNP: the gradient falls below 30 % while O₂ is still being used fast (watch for heat)", check: (M) => M.dnp && !M.olig && M.G < 0.3 && M.F.o2 > 3 },
  { band: "y11", text: "Respiratory control: with glucose and O₂ available and no inhibitors, cut ATP demand to ≤ 10 % so O₂ use falls below 1.5/s", check: (M) => M.demand <= 10 && M.supply >= 30 && M.o2eff >= 50 && !M.cyanide && !M.dnp && !M.olig && M.F.o2 < 1.5 },
  { band: "y11", text: "Block ATP synthase with oligomycin: the gradient maxes out (≥ 95 %) and O₂ use drops below 1/s", check: (M) => M.olig && !M.dnp && M.G >= 0.95 && M.F.o2 < 1 },
  { text: { "y7-8": "Zoom into a fold (the glowing ring) to see the machines that make ATP", y11: "Dive into a crista through the glowing ring to see the ETC and ATP synthase" }, check: (M, s) => s.dived },
];

export const QUIZ = [
  { maxBand: "y7-8", q: "Why is the mitochondrion called the cell's power station?", options: ["It makes glucose", "It releases the energy in food (glucose) and stores it in ATP", "It stores water", "It controls the cell"], answer: 1, why: "Respiration in the mitochondria releases energy from glucose and stores it in <strong>ATP</strong>, which powers the rest of the cell." },
  { maxBand: "y7-8", q: "What two things does a mitochondrion need to release lots of energy?", options: ["Light and water", "Glucose (food) and oxygen", "Carbon dioxide and water", "Salt and sugar"], answer: 1, why: "Aerobic respiration uses <strong>glucose</strong> and <strong>oxygen</strong>. Try removing either one and watch the energy output fall." },
  { maxBand: "y7-8", q: "Which gas does respiration give off as waste?", options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], answer: 2, why: "The carbon atoms from glucose leave as <strong>carbon dioxide</strong>. In a plant cell, the chloroplasts can reuse it." },
  { maxBand: "y7-8", q: "Do plant cells have mitochondria?", options: ["No — chloroplasts do the job instead", "Yes — plant cells respire day and night to release energy", "Only at night", "Only in the roots"], answer: 1, why: "Chloroplasts make glucose, but every plant cell still needs <strong>mitochondria</strong> to release its energy as ATP — all the time." },
  { maxBand: "y7-8", q: "Which is the word equation for aerobic respiration?", options: ["carbon dioxide + water → glucose + oxygen", "glucose + oxygen → carbon dioxide + water (+ energy)", "glucose → oxygen + energy", "oxygen + water → glucose"], answer: 1, why: "Respiration is roughly the reverse of photosynthesis: <strong>glucose + oxygen → carbon dioxide + water</strong>, releasing energy." },
  { band: "y9-10", maxBand: "y11", q: "Where does glycolysis (glucose → 2 pyruvate) take place?", options: ["In the mitochondrial matrix", "On the cristae", "In the cytoplasm (cytosol), outside the mitochondrion", "In the chloroplast"], answer: 2, why: "Glycolysis happens in the <strong>cytosol</strong>. Only its product, pyruvate, enters the mitochondrion." },
  { band: "y9-10", maxBand: "y9-10", q: "Why is the inner membrane folded into cristae?", options: ["To store glucose", "To give a larger surface area for the electron transport chain and ATP synthase", "To let more oxygen in", "To make the mitochondrion stronger"], answer: 1, why: "More membrane area = more ETC complexes and ATP synthases = more ATP from one organelle. Very active cells have mitochondria with more cristae." },
  { band: "y9-10", maxBand: "y9-10", q: "What happens when there is no oxygen?", options: ["Mitochondria keep making ATP as usual", "The ETC stops, so the cell relies on glycolysis + fermentation — about 2 ATP per glucose instead of ≈ 30", "Glucose is turned into oxygen", "The cell makes more ATP"], answer: 1, why: "Oxygen is the final electron acceptor. Without it the chain and the Krebs cycle stop; fermentation in the cytoplasm gives only 2 ATP per glucose." },
  { band: "y9-10", maxBand: "y9-10", q: "Which is the balanced equation for aerobic respiration?", options: ["6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂", "C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O (+ energy)", "C₆H₁₂O₆ → 2C₂H₅OH + 2CO₂", "C₆H₁₂O₆ + O₂ → CO₂ + H₂O"], answer: 1, why: "One glucose uses 6 O₂ and releases 6 CO₂ and 6 H₂O. (The third option is fermentation in yeast and plants.)" },
  { band: "y9-10", maxBand: "y9-10", q: "A student says plant cells don't need mitochondria because they photosynthesise. What's wrong?", options: ["Nothing — they're right", "Photosynthesis stores energy in glucose; mitochondria are still needed to release it as ATP", "Plant cells use chloroplasts as mitochondria at night", "Mitochondria only make CO₂ in plants"], answer: 1, why: "Photosynthesis <em>makes</em> glucose; respiration <em>releases</em> its energy as ATP. Plant cells do both." },
  { band: "y11", q: "In which compartment does the Krebs cycle occur?", options: ["Cytosol", "Intermembrane space", "Mitochondrial matrix", "Crista lumen"], answer: 2, why: "The link reaction and Krebs cycle run in the <strong>matrix</strong>; the ETC and ATP synthase are in the inner membrane (cristae); glycolysis is in the cytosol." },
  { band: "y11", q: "Roughly how many ATP does the complete aerobic breakdown of one glucose yield?", options: ["2", "≈ 30–32 (whole pathway)", "≈ 30 from the ETC plus 36 from glycolysis", "100"], answer: 1, why: "≈ 30–32 ATP for the whole pathway: 2 (glycolysis) + 2 (Krebs) + ≈ 26–28 from oxidative phosphorylation. Older figures of 36–38 assumed whole-number P/O ratios." },
  { band: "y11", q: "Cyanide blocks complex IV. Why does the Krebs cycle also stop, even though cyanide doesn't touch it?", options: ["Cyanide destroys acetyl-CoA", "NADH can't be re-oxidised, so NAD⁺ runs out — and the Krebs cycle needs NAD⁺", "The matrix fills with O₂", "Krebs enzymes need ATP synthase to work"], answer: 1, why: "The stages are linked by shared carriers. With the ETC blocked, NADH piles up (watch the matrix fill with blue NADH) and NAD⁺-dependent steps stall; pyruvate backs up into the cytosol." },
  { band: "y11", q: "A cell's ATP demand drops (plenty of ATP, little ADP). What happens to its O₂ consumption?", options: ["It rises", "It falls — little ADP slows ATP synthase, the gradient builds up and slows the chain (respiratory control)", "It stays the same", "It stops completely, forever"], answer: 1, why: "ADP availability controls the rate: ATP synthase slows, the H⁺ gradient rises, and pumping against it slows electron flow and O₂ use." },
  { band: "y11", q: "What does the uncoupler DNP do to a mitochondrion?", options: ["Raises the H⁺ gradient and ATP output", "Lets H⁺ leak back across the inner membrane: O₂ use stays high or rises, ATP output falls and the energy is released as heat", "Blocks the Krebs cycle", "Stops O₂ entering"], answer: 1, why: "The gradient's energy is dissipated as heat. Brown fat does this on purpose with thermogenin (UCP1)." },
  { band: "y12", q: "Across which membrane is the H⁺ gradient that drives ATP synthesis?", options: ["The outer membrane", "The inner membrane (cristae), between the intermembrane space/crista lumen and the matrix", "The plasma membrane", "The nuclear envelope"], answer: 1, why: "The outer membrane is leaky (porins), so the gradient can only be held across the H⁺-impermeable <strong>inner membrane</strong>." },
];

/** "What's happening": every causal statement is conditioned on the model's fluxes. */
export function narrative(M, band) {
  const F = M.F, S = M.smooth, y7 = band === "y7-8", y9 = band === "y9-10", senior = !y7 && !y9;
  const atp = S.atp, Gp = Math.round(M.G * 100), blocked = M.o2f === 0;
  const f1 = (v) => (v >= 10 ? v.toFixed(0) : v.toFixed(1));
  const out = [];
  if (y7) {
    if (M.supply === 0 && F.gly < 0.02) out.push("<strong>No glucose</strong> is arriving, so the power station has nothing to break down. Energy output has dropped to " + f1(atp) + " ATP per second.");
    else if (blocked) out.push(`${M.cyanide ? "<strong>Cyanide</strong> has jammed the last pump" : "There is <strong>no oxygen</strong>"}, so the power station can't use its fuel. Energy output is down to <strong>${f1(atp)}</strong> ATP per second.` + (F.ferm > 0.1 ? " The cell is splitting glucose in the cytoplasm instead (fermentation), but that gives only a tiny bit of energy." : ""));
    else if (M.olig && F.atpMito < 0.5) out.push("<strong>Oligomycin</strong> has jammed the ATP-making motors, so almost no energy is stored even though the pumps have filled up the space with H⁺.");
    else if (M.dnp && M.heat > 0.15) out.push(`The <strong>uncoupler</strong> lets H⁺ leak back without turning the motors, so the energy escapes as <strong>heat</strong>. Oxygen is still being used, but only ${f1(atp)} ATP per second is made.`);
    else if (M.demand <= 10 && M.adp < 0.12) out.push("The cell isn't using much energy, so there's little \"empty\" ADP to fill. The power station <strong>slows down</strong> to save fuel — " + f1(atp) + " ATP per second.");
    else out.push(`<strong>Glucose</strong> is split in the cytoplasm and the pieces go into the mitochondrion with <strong>oxygen</strong>. Out come <strong>energy (ATP)</strong> — ${f1(atp)} every second — plus <strong>carbon dioxide</strong> and water.`);
    if (!blocked && F.o2 > 0.3) out.push(`Using about ${f1(F.o2)} oxygen and giving off ${f1(F.co2)} carbon dioxide each second.`);
    return out;
  }
  // Year 9 and up
  const pipe = `Glycolysis (cytosol) <strong>${f1(F.gly)}</strong> glucose/s → pyruvate into the matrix <strong>${f1(F.imp)}</strong>/s → Krebs <strong>${f1(F.krebs)}</strong> turns/s → O₂ use <strong>${f1(F.o2)}</strong>/s → ATP <strong>${f1(atp)}</strong>/s.`;
  if (M.supply === 0 && F.gly < 0.02) {
    out.push("No glucose is being supplied, so glycolysis in the cytosol makes no pyruvate. The Krebs cycle and the electron transport chain have run out of fuel" + (M.G > 0.25 ? ` (the H⁺ gradient is ${Gp}% and leaking away).` : "."));
  } else if (blocked) {
    const why = M.cyanide ? (senior ? "<strong>Cyanide</strong> is bound to complex IV, so electrons can't reach O₂." : "<strong>Cyanide</strong> blocks complex IV, so electrons can't be passed to oxygen.") : (senior ? "<strong>No O₂</strong>: complex IV has no final electron acceptor." : "<strong>No oxygen</strong> — there's nothing to accept the electrons at the end of the chain.");
    let s = why + ` The chain has stopped pumping, the H⁺ gradient is ${Gp}%` + (M.G < 0.25 ? " — too low for ATP synthase" : "") + ".";
    if (M.nadh > 0.85) s += senior ? ` NADH has piled up (${Math.round(M.nadh * 100)}% of the pool reduced), so NAD⁺ has run out and the link reaction and Krebs cycle have stalled (${f1(F.krebs)} turns/s).` : " NADH has piled up in the matrix, so the Krebs cycle has stalled too.";
    if (M.pyr > 10) s += " Pyruvate is backing up";
    if (M.pyr > 10 && F.ferm > 0.1) s += senior ? ` and is being fermented in the cytosol instead (plants and yeast: ethanol + CO₂; ${f1(F.ferm)} pyruvate/s), which recycles NAD⁺ for glycolysis.` : ", so the cytoplasm ferments it instead.";
    else if (M.pyr > 10) s += ".";
    s += ` ATP output is ${f1(atp)}/s` + (senior && M.steady && S.yield > 0 ? ` — about ${Math.round(S.yield)} ATP per glucose, all from glycolysis.` : ", almost all from glycolysis.");
    out.push(s);
  } else if (M.olig && F.atpMito < 0.5) {
    let s = "<strong>Oligomycin</strong> blocks ATP synthase, so H⁺ can't flow back into the matrix through it.";
    if (M.dnp) s += ` DNP lets them leak back instead (${f1(F.leak)} H⁺/s), so the chain keeps running and the energy becomes <strong>heat</strong>.`;
    else if (M.G > 0.9) s += ` The gradient has maxed out (${Gp}%), so the pumps are working against it and the chain has slowed: O₂ use is down to ${f1(F.o2)}/s.` + (M.nadh > 0.8 ? " NADH is piling up and the Krebs cycle has slowed." : "") + (senior ? " This coupling between ATP synthesis and electron flow is <strong>respiratory control</strong>." : "");
    else s += ` The gradient is climbing (${Gp}%).`;
    out.push(s);
  } else if (M.dnp && F.leak > 20) {
    out.push(`The uncoupler <strong>DNP</strong> carries H⁺ back across the inner membrane (${f1(F.leak)} H⁺/s), bypassing ATP synthase. The gradient has fallen to ${Gp}%, so ATP synthase makes only ${f1(F.atpMito)} ATP/s — but the chain keeps running, using ${f1(F.o2)} O₂/s. The energy is released as <strong>heat</strong>.` + (senior && M.steady && S.yield > 0 ? ` Yield has dropped to ≈ ${Math.round(S.yield)} ATP per glucose.` : ""));
  } else if (M.adp < 0.1 && F.atpMito < 8) {
    out.push(`The cell has plenty of ATP and little <strong>ADP</strong> (ATP demand ${M.demand}%). With little ADP to phosphorylate, ATP synthase slows, the gradient stays high (${Gp}%) and electron flow slows: O₂ use is ${f1(F.o2)}/s.` + (senior ? " Supply follows demand — <strong>respiratory control</strong>." : ""));
  } else {
    out.push(senior
      ? "Glycolysis in the <strong>cytosol</strong> splits glucose into pyruvate, which enters the <strong>matrix</strong> and becomes acetyl-CoA (releasing CO₂). The <strong>Krebs cycle</strong> releases more CO₂ and loads NADH and FADH₂. On the <strong>cristae</strong> the ETC passes their electrons to O₂ (forming water) and pumps H⁺ into the crista lumen; the H⁺ flow back through <strong>ATP synthase</strong>, and ATP leaves for the cytosol."
      : "Glucose is split in the <strong>cytoplasm</strong> (glycolysis); the pyruvate enters the <strong>matrix</strong>, where the Krebs cycle breaks it down to <strong>CO₂</strong> and loads the carrier NADH. On the folded <strong>cristae</strong>, the electron transport chain uses <strong>oxygen</strong> and pumps H⁺; their flow back through <strong>ATP synthase</strong> makes most of the ATP.");
    if (M.o2eff < 25 && M.nadh > 0.5) out.push(`O₂ is scarce (${M.o2eff}%), so complex IV is the bottleneck and NADH is building up (${Math.round(M.nadh * 100)}% reduced).`);
    if (F.ferm > 0.15) out.push(`Pyruvate is arriving faster than the matrix can use it, so ${f1(F.ferm)}/s is fermented in the cytosol.`);
  }
  out.push(pipe);
  if (senior && F.gly > 0.02 && !M.steady) out.push("Pools are still adjusting to the change, so the ATP-per-glucose figure will settle in a few seconds.");
  else if (senior && S.yield > 0.5 && F.gly > 0.02) out.push(`Whole-pathway yield right now ≈ <strong>${Math.round(S.yield)} ATP per glucose</strong>` + (M.dnp || M.olig || blocked ? "" : " (≈ 30–32 in theory; a little is lost to H⁺ leak)") + ".");
  return out;
}
