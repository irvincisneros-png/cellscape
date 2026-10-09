// Lens-aware text for the chloroplast level. Values are plain strings or { "y7-8", "y9-10", "y11", "y12" } (lens.pick).

export const PARTS = {
  envelope: {
    name: { "y7-8": "Chloroplast membranes", "y9-10": "Envelope (double membrane)" }, color: "#86efac",
    role: {
      "y7-8": "Two thin layers that wrap the chloroplast and control what goes in and out.",
      "y9-10": "A <strong>double membrane</strong>. CO₂, O₂ and water cross it easily; sugars and other substances need transport proteins.",
      y11: "Outer and inner envelope membranes. Small gases diffuse through; the inner membrane's <strong>triose phosphate/phosphate translocator</strong> exports triose phosphate in exchange for Pᵢ, and other carriers move maltose and glucose out at night.",
    },
    inputs: { "y7-8": "carbon dioxide, water", y11: "CO₂, H₂O, Pᵢ" }, outputs: { "y7-8": "oxygen, sugar", y11: "O₂, triose phosphate (day), maltose (night)" },
  },
  granum: {
    name: { "y7-8": "Granum (stack of thylakoids)", "y9-10": "Granum (thylakoid stack)" }, color: "#4ade80", portal: "thylakoid",
    role: {
      "y7-8": "A pile of flat green discs called <strong>thylakoids</strong>. Their <strong>chlorophyll</strong> traps light energy and splits water, giving off <strong>oxygen</strong>.",
      "y9-10": "Stacked <strong>thylakoids</strong>. Chlorophyll in their membranes absorbs light; the <strong>light-dependent reactions</strong> split water (releasing O₂) and make <strong>ATP</strong> and <strong>NADPH</strong> for the stroma.",
      y11: "Appressed thylakoid membranes, rich in <strong>photosystem II</strong> and its light-harvesting complexes. Linear electron flow H₂O → PSII → plastoquinone → cytochrome b₆f → plastocyanin → PSI → ferredoxin → NADP⁺ pumps H⁺ into the lumen; ATP synthase uses the gradient (chemiosmosis).",
    },
    inputs: { "y7-8": "light, water", y11: "light, H₂O, ADP + Pᵢ, NADP⁺" }, outputs: { "y7-8": "oxygen, energy carriers", y11: "O₂, ATP, NADPH" },
  },
  lamella: {
    name: { "y7-8": "Linking membrane", "y9-10": "Stroma lamella" }, color: "#86efac", portal: "thylakoid",
    role: {
      "y7-8": "Thin sheets that join the stacks together, so they work as one connected system.",
      "y9-10": "Unstacked thylakoid membrane joining the grana. All thylakoids enclose one connected inner space (the lumen).",
      y11: "Unstacked thylakoid membrane exposed to the stroma — enriched in <strong>PSI</strong> and <strong>ATP synthase</strong>, whose bulky stromal parts don't fit between appressed grana discs. The lumen is continuous throughout.",
    },
    inputs: "light, ADP + Pᵢ", outputs: "ATP, NADPH",
  },
  rubisco: {
    name: { "y7-8": "Rubisco (sugar-making enzyme)", "y9-10": "Rubisco" }, color: "#2dd4bf",
    role: {
      "y7-8": "An <strong>enzyme</strong> floating in the stroma. It grabs <strong>carbon dioxide</strong> from the air — the first step in making sugar.",
      "y9-10": "The enzyme that <strong>fixes CO₂</strong> in the Calvin cycle. It is so abundant it is probably the most common protein on Earth. Like all enzymes, it works faster when warm and <strong>denatures</strong> when too hot.",
      y11: "Ribulose-1,5-bisphosphate carboxylase/oxygenase: joins CO₂ to RuBP (5C) → 2 × 3-PGA (3C). Slow (a few reactions per second) and also reacts with O₂ (photorespiration), so leaves make huge amounts of it.",
    },
    inputs: { "y7-8": "carbon dioxide", y11: "CO₂ + RuBP" }, outputs: { "y7-8": "the first step towards sugar", y11: "3-PGA (reduced to triose phosphate with ATP + NADPH)" },
  },
  stroma: {
    name: "Stroma", color: "#a7f3d0",
    role: {
      "y7-8": "The fluid inside the chloroplast. Here, carbon dioxide is built into <strong>sugar</strong> using the energy captured by the thylakoids.",
      "y9-10": "Enzyme-rich fluid where the <strong>Calvin cycle</strong> (light-independent reactions) uses ATP and NADPH to turn CO₂ into sugar.",
      y11: "Site of the Calvin cycle: carbon fixation (Rubisco) → reduction of 3-PGA to triose phosphate (ATP + NADPH) → regeneration of RuBP (ATP). Returns ADP + Pᵢ and NADP⁺ to the thylakoids. Also contains DNA, 70S ribosomes, starch and plastoglobuli.",
    },
    inputs: { "y7-8": "carbon dioxide, energy carriers", y11: "CO₂, ATP, NADPH" }, outputs: { "y7-8": "sugar", y11: "triose phosphate, ADP + Pᵢ, NADP⁺" },
  },
  starch: {
    name: "Starch grain", color: "#f8fafc",
    role: {
      "y7-8": "A store of sugar. By day spare sugar is packed into starch; at night the starch is broken down again so the plant still has food.",
      "y9-10": "Insoluble glucose polymer. Spare sugar is stored as starch by day and broken down at night to keep the cell supplied (respiration never stops).",
      y11: "Transitory starch: built from triose phosphate (via glucose-1-phosphate and ADP-glucose) when it accumulates by day; degraded at night, mainly to <strong>maltose</strong>, which is exported to the cytosol.",
    },
    inputs: { "y7-8": "spare sugar (day)", y11: "triose phosphate (day)" }, outputs: { "y7-8": "sugar (night)", y11: "maltose + glucose (night)" },
  },
  dna: {
    name: { "y7-8": "Chloroplast DNA", "y9-10": "Chloroplast DNA (circular)" }, color: "#f0abfc",
    role: {
      "y7-8": "The chloroplast has a little <strong>DNA</strong> of its own, with instructions for some of its parts.",
      "y9-10": "Small loops of DNA, like a bacterium's. They hold genes for some chloroplast proteins; most others are coded in the nucleus.",
      y11: "Several copies of a circular genome (~120–160 kb) in nucleoids, coding ~100 genes (e.g. the Rubisco large subunit, parts of PSII). Most chloroplast proteins are nuclear-encoded and imported — evidence for <strong>endosymbiosis</strong> plus later gene transfer.",
    },
    inputs: "", outputs: { "y7-8": "instructions", y11: "mRNA for chloroplast-made proteins" },
  },
  ribosome: {
    name: { "y7-8": "Chloroplast ribosomes", "y9-10": "Ribosomes (70S)" }, color: "#c4b5fd",
    role: {
      "y7-8": "Tiny machines that build some of the chloroplast's own proteins.",
      "y9-10": "Small (70S) ribosomes, like bacterial ones, that make proteins from the chloroplast's own genes.",
      y11: "70S ribosomes translating chloroplast-encoded mRNAs (e.g. Rubisco large subunit, D1 of PSII, which is replaced often after light damage). Their bacterial-type size is evidence for endosymbiotic origin.",
    },
    inputs: "mRNA, amino acids, ATP", outputs: "chloroplast proteins",
  },
  plastoglobule: {
    name: "Plastoglobulus", color: "#facc15", band: "y11",
    role: { y11: "Lipid droplet attached to thylakoids: stores lipids and carotenoid/vitamin E pathway enzymes; enlarges under stress and in ageing leaves." },
    inputs: "lipids", outputs: "lipid supply / repair",
  },
};

export const FLOWS = {
  photon: { label: "Light", color: "#fde68a" },
  h2o: { label: { "y7-8": "Water", "y9-10": "Water (H₂O)" }, color: "#38bdf8" },
  o2: { label: { "y7-8": "Oxygen", "y9-10": "Oxygen (O₂)" }, color: "#f87171" },
  co2: { label: { "y7-8": "Carbon dioxide", "y9-10": "CO₂" }, color: "#cbd5e1" },
  atp: { label: { "y7-8": "Energy carriers (ATP)", "y9-10": "ATP" }, color: "#fbbf24" },
  nadph: { label: { "y7-8": "Energy carriers (NADPH)", "y9-10": "NADPH" }, color: "#a78bfa" },
  back: { label: { "y7-8": "Used carriers going back", "y9-10": "ADP + NADP⁺ (back)" }, color: "#64748b", band: "y9-10" },
  sugar: { label: { "y7-8": "Sugar (glucose) out", "y9-10": "Sugar out", y11: "Triose phosphate → sucrose" }, color: "#a3e635" },
  starch: { label: { "y7-8": "Sugar ⇄ starch", y11: "TP → starch / maltose out" }, color: "#f8fafc" },
};

export const SWITCHES = [
  {
    key: "light", color: "#4ade80",
    label: { "y7-8": "Light-capturing discs (thylakoids)", "y9-10": "Light-dependent reactions", y11: "Light reactions (block PSII, e.g. DCMU)" },
  },
  {
    key: "calvin", color: "#2dd4bf",
    label: { "y7-8": "Sugar-making enzymes (Rubisco)", "y9-10": "Calvin cycle (Rubisco)", y11: "Calvin cycle (block Rubisco)" },
  },
];

export const MISSIONS = [
  { band: "y7-8", maxBand: "y9-10", text: "Find the best conditions: get the chloroplast releasing <strong>oxygen at 60+ per minute</strong>.", check: (m) => m.flux.J > 60 },
  { band: "y7-8", text: "Make it <strong>night</strong> and watch the starch grains shrink: use up <strong>10 units</strong> of starch in the dark.", check: (m, s) => m.light < 5 && s.nightStarch - m.starch >= 10 },
  { band: "y7-8", maxBand: "y9-10", text: "Fill the <strong>starch store</strong> above 80.", check: (m) => m.starch > 80 },
  { band: "y7-8", text: "Switch off the <strong>light reactions</strong> in daylight. Does the sugar-making (Calvin cycle) keep going? Wait until it stops.", check: (m) => !m.on.light && m.on.calvin && m.light > 30 && m.flux.V < 1.5 },
  { band: "y7-8", text: "Heat the chloroplast until its <strong>enzymes stop working</strong> (denature).", check: (m) => m.temp >= 43 && m.r.P < 5 },
  { band: "y9-10", text: "Find a <strong>limiting factor</strong>: in bright light (80%+), cut CO₂ to 0.02% or less.", check: (m) => m.light >= 80 && m.co2 <= 0.02 && m.r.lim === "co2" },
  { band: "y9-10", maxBand: "y9-10", text: "Switch off the <strong>Calvin cycle</strong> in bright light and show that O₂ release stops too.", check: (m) => !m.on.calvin && m.on.light && m.light > 30 && m.flux.J < 1 },
  { band: "y11", text: "Block <strong>Rubisco</strong> in the light and show the light reactions backing up: NADP⁺ runs out (carriers over 95% charged) and O₂ release stops.", check: (m) => !m.on.calvin && m.on.light && m.light > 30 && m.e > 0.95 && m.flux.J < 2 },
  { band: "y11", text: "Show that when <strong>CO₂ limits</strong>, ATP and NADPH pile up: light 90%+, CO₂ ≤ 0.02%, carriers over 84% charged.", check: (m) => m.on.light && m.on.calvin && m.light >= 90 && m.co2 <= 0.02 && m.e > 0.84 },
];

export const QUIZ = [
  { band: "y7-8", maxBand: "y7-8", q: "Which part of the chloroplast traps light energy?", options: ["The starch grains", "The green thylakoid discs (grana)", "The DNA", "The outer membrane"], answer: 1, why: "The thylakoid discs contain chlorophyll, which absorbs light. They are stacked into grana." },
  { band: "y7-8", maxBand: "y7-8", q: "Which gas does the chloroplast give out in the light?", options: ["Carbon dioxide", "Oxygen", "Nitrogen", "Methane"], answer: 1, why: "Water is split in the thylakoids and oxygen is released." },
  { band: "y7-8", q: "What happens to spare sugar made in the chloroplast during the day?", options: ["It is thrown away", "It is stored as starch grains", "It turns into chlorophyll", "It becomes carbon dioxide"], answer: 1, why: "Spare sugar is packed into starch. At night the starch is broken down so the plant still has sugar." },
  { band: "y7-8", q: "You switch off the light-capturing discs but leave the sugar-making enzymes on. Why does sugar-making stop soon after?", options: ["The enzymes need light directly", "The enzymes need the energy carriers (ATP, NADPH) that the discs make", "There's no carbon dioxide", "The starch blocks them"], answer: 1, why: "The two stages are linked: the Calvin cycle runs on ATP and NADPH made by the light reactions. When they run out, it stops." },
  { band: "y7-8", maxBand: "y9-10", q: "How does a leaf cell get sugar at night?", options: ["Photosynthesis keeps going in the dark", "Starch stored during the day is broken down", "It takes sugar from the air", "It doesn't need sugar at night"], answer: 1, why: "Starch is broken down at night; the cell's mitochondria keep respiring the sugar." },
  { band: "y9-10", q: "Where do the two stages of photosynthesis happen?", options: ["Both in the stroma", "Light-dependent: thylakoid membranes. Calvin cycle: stroma", "Light-dependent: stroma. Calvin cycle: thylakoids", "Both on the outer membrane"], answer: 1, why: "Photosystems, the electron transport chain and ATP synthase are in the thylakoid membranes; Rubisco and the Calvin cycle enzymes are in the stroma." },
  { band: "y9-10", q: "Bright light, but CO₂ is very low. What limits the rate of photosynthesis?", options: ["Light", "CO₂", "Chlorophyll", "Oxygen"], answer: 1, why: "The factor in shortest supply limits the rate. More light won't help; more CO₂ will." },
  { band: "y9-10", maxBand: "y9-10", q: "The Calvin cycle is blocked but the light is on. Why does O₂ release stop?", options: ["Oxygen needs Rubisco to leave", "The light reactions run out of NADP⁺ and ADP to recharge, so they back up and stop splitting water", "Chlorophyll is destroyed", "CO₂ is turned into O₂ in the Calvin cycle"], answer: 1, why: "The light reactions recharge NADP⁺ → NADPH and ADP → ATP. Only the Calvin cycle turns them back into NADP⁺ and ADP, so without it the light reactions have nothing to recharge." },
  { band: "y11", q: "Rubisco is inhibited in bright light. Which sequence follows?", options: ["NADPH and ATP accumulate → no NADP⁺ to accept electrons from PSI → linear electron flow and water splitting slow → O₂ release falls", "ATP falls → PSII speeds up → more O₂", "CO₂ is fixed by PSI instead", "Nothing changes in the thylakoids"], answer: 0, why: "Linear electron flow needs NADP⁺ as the final electron acceptor. When the Calvin cycle stops, NADP⁺ isn't regenerated and the chain backs up (the excess energy is lost as heat or fluorescence)." },
  { band: "y11", q: "In what form does most fixed carbon leave the chloroplast during the day?", options: ["Glucose", "Triose phosphate, swapped for Pᵢ, then made into sucrose in the cytosol", "Starch grains", "3-PGA"], answer: 1, why: "The triose phosphate/phosphate translocator exports TP. Sucrose is made in the cytosol and loaded into the phloem. At night, starch is broken down mainly to maltose, which is exported." },
  { band: "y11", q: "Chloroplasts contain circular DNA and 70S ribosomes. This best supports…", options: ["Spontaneous generation", "Endosymbiotic theory — chloroplasts descend from engulfed cyanobacteria", "That chloroplasts make all their own proteins", "That chloroplasts came from mitochondria"], answer: 1, why: "Bacterial-type genome and ribosomes, a double membrane and division by fission all point to a cyanobacterial ancestor. Most of its genes have since moved to the nucleus." },
  { band: "y11", q: "Why does the stroma become highly reduced (lots of NADPH) when CO₂ is limiting?", options: ["CO₂ makes NADPH", "The light reactions make NADPH faster than the Calvin cycle can use it", "Rubisco makes NADPH", "Starch releases NADPH"], answer: 1, why: "Light-limited capacity exceeds the CO₂-limited Calvin cycle, so carriers stay charged. That's why more light doesn't raise the rate." },
];

/** "What's happening" text, generated from the model's actual fluxes. */
export function narrative(m, band) {
  const y7 = band === "y7-8", y11 = band === "y11" || band === "y12";
  const F = m.flux, out = [], J = F.J, V = F.V, on = m.on, e = m.e;
  const carriers = y7 ? "energy carriers (ATP and NADPH)" : "ATP and NADPH";
  // light reactions
  if (!on.light) out.push(y7
    ? `<strong>Light-capturing discs off.</strong> No water is split and no oxygen comes out. No new ${carriers} are made${V > 1 ? ", so the sugar-making enzymes are using up what's left" : ""}.`
    : `<strong>Light reactions blocked</strong>${y11 ? " (PSII inhibited)" : ""}: no water splitting, no O₂, no new ATP or NADPH.${V > 1 ? ` The Calvin cycle is running down the remaining carriers (${Math.round(e * 100)}% charged).` : ""}`);
  else if (m.light < 1) out.push(y7 ? `It's <strong>dark</strong>: chlorophyll has no light to trap, so no oxygen is given out.` : `<strong>Dark</strong>: no light is absorbed, so no water is split and no ATP or NADPH is made.`);
  else if (J < 1 && e > 0.9) out.push(y7
    ? `The discs have light, but they've <strong>stopped</strong>: all the energy carriers are already full and nothing is emptying them.`
    : `The light reactions have <strong>backed up</strong>: ${Math.round(e * 100)}% of the carriers are charged, so there is ${y11 ? "almost no NADP⁺ to accept electrons from PSI" : "no NADP⁺ or ADP left to recharge"}. Water splitting and O₂ release stop.`);
  else out.push(y7
    ? `Light is trapped by chlorophyll in the <strong>thylakoid discs</strong>. Water is split, giving out <strong>oxygen</strong> (${J.toFixed(0)} a minute), and ${carriers} are made.`
    : `Thylakoids: light splits water (O₂ released ${J.toFixed(1)}/min) and makes ATP + NADPH${y11 ? ` by linear electron flow and chemiosmosis` : ""}.`);
  // Calvin cycle
  if (!on.calvin) out.push(y7
    ? `<strong>Sugar-making enzymes off.</strong> Carbon dioxide isn't taken in and no new sugar is made.`
    : `<strong>Calvin cycle blocked</strong>${y11 ? " (Rubisco inhibited)" : ""}: no CO₂ is fixed, and ADP and NADP⁺ are no longer returned to the thylakoids.`);
  else if (V < 1.5) out.push(e < 0.08
    ? (y7 ? `The sugar-making enzymes have <strong>stopped</strong>: they've run out of ${carriers}.` : `The Calvin cycle has <strong>stalled</strong>: no ATP or NADPH left to reduce 3-PGA and regenerate RuBP.`)
    : m.r.P < 4 ? (y7 ? `It's too hot: the enzymes have lost their shape (<strong>denatured</strong>), so no sugar is made.` : `Rubisco and the other Calvin cycle enzymes are <strong>denatured</strong>, so no CO₂ is fixed.`)
    : (y7 ? `Hardly any sugar is being made.` : `The Calvin cycle is barely running.`));
  else out.push(y7
    ? `In the stroma, the enzyme <strong>Rubisco</strong> takes in carbon dioxide and, using the ${carriers}, builds it into <strong>sugar</strong>.`
    : `Stroma: Rubisco fixes CO₂ (${V.toFixed(1)}/min) and the Calvin cycle uses ATP + NADPH to make ${y11 ? "triose phosphate" : "sugar"}${y11 ? "; ADP + Pᵢ and NADP⁺ go back to the thylakoids" : ""}.`);
  // limiting factor (only meaningful when both halves run)
  if (on.light && on.calvin && m.light >= 1 && J > 1) {
    const lim = m.r.lim;
    if (lim === "co2") out.push(y7 ? `<strong>Carbon dioxide</strong> is in shortest supply — it's the <strong>limiting factor</strong>. More light won't help.` : `<strong>CO₂ is the limiting factor</strong>. The light reactions could go faster than the Calvin cycle can use their products${e > 0.6 ? `, so ATP and NADPH pile up (${Math.round(e * 100)}% charged)` : ""} — more light won't help.`);
    else if (lim === "light") out.push(y7 ? `<strong>Light</strong> is the limiting factor: more light would speed things up.` : `<strong>Light is the limiting factor</strong>: the Calvin cycle uses ATP and NADPH as fast as they're made (only ${Math.round(e * 100)}% charged).`);
    else out.push(m.temp >= 33 ? (y7 ? `It's <strong>too hot</strong>: the enzymes are starting to lose their shape.` : `<strong>Temperature is limiting</strong> — too hot: Calvin cycle enzymes are denaturing.`) : (y7 ? `<strong>Temperature</strong> is limiting: the enzymes are working as fast as they can at ${m.temp} °C.` : `<strong>Temperature (enzyme speed) is limiting</strong> at ${m.temp} °C.`));
  }
  // sugar and starch
  const exp = F.exportTP, st = F.store, mob = F.mobilise;
  if (mob > 0.05) out.push(y7 ? `It's dark, so the <strong>starch grains</strong> are being broken down into sugar for the cell (starch ${m.starch.toFixed(0)}).` : y11 ? `Dark: starch is degraded, mainly to <strong>maltose</strong>, which is exported to the cytosol (starch ${m.starch.toFixed(0)}).` : `Dark: starch is being broken down and the sugar sent out to the cell (starch ${m.starch.toFixed(0)}).`);
  else if (st > 0.1) out.push(y7 ? `Spare sugar is being stored as <strong>starch</strong> — watch the grains grow (${m.starch.toFixed(0)}).` : y11 ? `Triose phosphate is building up, so the surplus goes into <strong>starch</strong> (${m.starch.toFixed(0)}); the rest is exported via the TP/Pᵢ translocator and made into sucrose in the cytosol.` : `Spare sugar is being stored as starch (${m.starch.toFixed(0)}); the rest is sent out to the cell.`);
  else if (exp > 0.3) out.push(V < 1.5
    ? (y7 ? `No new sugar is being made, but the sugar already made is still being sent out to the cell.` : `No new ${y11 ? "triose phosphate" : "sugar"} is being made; what's left in the stroma is still being exported.`)
    : (y7 ? `Sugar is sent out to the rest of the cell.` : y11 ? `Triose phosphate is exported to the cytosol (→ sucrose).` : `Sugar is being sent out to the rest of the cell.`));
  if (m.den > 0.03) out.push(`<strong>${Math.round(m.den * 100)}% of Rubisco is permanently denatured.</strong> Cooling won't fix it — press <strong>Reset</strong> for a fresh chloroplast.`);
  return out;
}
