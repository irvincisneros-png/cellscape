// Lens-aware text for the 3D thylakoid level (Years 7–8 plain words → Year 11–12 senior terms).

export const NAMES = {
  psii: { "y7-8": "Photosystem II (light catcher)", "y9-10": "Photosystem II", y11: "Photosystem II (P680)" },
  b6f: { "y7-8": "Cytochrome b6f (H⁺ pump)", "y9-10": "Cytochrome b6f" },
  psi: { "y7-8": "Photosystem I (light catcher)", "y9-10": "Photosystem I", y11: "Photosystem I (P700)" },
  atps: "ATP synthase",
  pq: { "y7-8": "Electron carrier (plastoquinone)", "y9-10": "Plastoquinone" },
  pc: { "y7-8": "Electron carrier (plastocyanin)", "y9-10": "Plastocyanin" },
  rubisco: "Rubisco",
  calvin: { "y7-8": "Calvin cycle (sugar-making)", "y9-10": "Calvin cycle" },
  lamp: "Lamp",
  co2: { "y7-8": "Carbon dioxide", "y9-10": "CO₂" },
};

export const INFO = {
  psii: {
    "y7-8": "Green <strong>chlorophyll</strong> soaks up light energy. The energy knocks electrons loose. To replace them, this protein <strong>splits water</strong> — and that's where the <strong>oxygen</strong> comes from.",
    "y9-10": "Chlorophyll in the antenna absorbs light and passes the energy to the reaction centre, exciting electrons. To replace them, PSII splits water: 2H₂O → 4H⁺ + O₂ + 4e⁻. This is where the oxygen comes from.",
    y11: "Light-harvesting complexes (LHCII) funnel excitation energy to P680. Its excited electron reduces plastoquinone (PQ → PQH₂ takes 2 H⁺ from the stroma). The oxidised P680⁺ is re-reduced by the Mn₄CaO₅ oxygen-evolving complex, which splits 2H₂O → O₂ + 4H⁺ + 4e⁻, releasing H⁺ into the lumen.",
  },
  b6f: {
    "y7-8": "Passes the electrons along and uses their energy to <strong>pump H⁺</strong> into the space inside the thylakoid, building up a store of H⁺.",
    "y9-10": "Receives electrons from plastoquinone (in the membrane) and passes them to plastocyanin. It uses their energy to pump H⁺ from the stroma into the lumen, building up a proton gradient.",
    y11: "Oxidises PQH₂, releasing its H⁺ into the lumen (the Q cycle roughly doubles H⁺ moved per electron), and reduces plastocyanin. This is the main proton-translocating step of the chain.",
  },
  psi: {
    "y7-8": "A second light catcher gives the electrons another energy boost. They're used to make <strong>NADPH</strong>, an energy carrier for sugar-making.",
    "y9-10": "A second photon re-energises the electron. It passes via ferredoxin to NADP⁺ reductase, which makes NADPH: NADP⁺ + 2e⁻ + H⁺ → NADPH.",
    y11: "P700 is excited by LHCI-harvested light and reduces ferredoxin; ferredoxin–NADP⁺ reductase (FNR) makes NADPH on the stromal side, using stromal H⁺ (adding to the gradient). P700⁺ is re-reduced by plastocyanin.",
  },
  atps: {
    "y7-8": "H⁺ flows back out through this tiny <strong>spinning motor</strong>. The spinning joins ADP and phosphate to make <strong>ATP</strong>, an energy carrier.",
    "y9-10": "H⁺ ions flow back from the lumen (high concentration) to the stroma through this rotary motor. The flow spins the rotor and the head joins ADP + Pᵢ → ATP. This is chemiosmosis.",
    y11: "CF₀–CF₁ ATP synthase. H⁺ moving down its electrochemical gradient (lumen pH ≈ 5 → stroma pH ≈ 8) turns the c-ring and γ stalk; rotation drives conformational changes in the three catalytic β subunits (binding change), each making ATP from ADP + Pᵢ. Chemiosmosis.",
  },
  pq: { "y7-8": "A small carrier that ferries electrons through the oily middle of the membrane.", "y9-10": "Plastoquinone: a mobile carrier inside the membrane that takes electrons from PSII to cytochrome b6f.", y11: "Plastoquinone pool: PQ + 2e⁻ + 2H⁺(stroma) → PQH₂, which diffuses to cyt b6f and releases the H⁺ into the lumen." },
  pc: { "y7-8": "A small carrier in the space inside the thylakoid that ferries electrons to Photosystem I.", "y9-10": "Plastocyanin: a copper protein in the lumen that carries electrons from cytochrome b6f to PSI.", y11: "Plastocyanin (Cu) shuttles one electron at a time from cyt b6f to P700⁺ on the lumenal side." },
  rubisco: {
    "y7-8": "The enzyme that <strong>grabs carbon dioxide</strong> to start making sugar. It stops working if it gets too hot. Drag CO₂ molecules onto it!",
    "y9-10": "The enzyme that fixes carbon: it joins CO₂ to RuBP (5 carbons), giving two 3-PGA (3 carbons). It is slow and temperature-sensitive. Drag CO₂ molecules onto it!",
    y11: "Rubisco carboxylates RuBP → 2 × 3-PGA. Slow (~3 per second) and also accepts O₂ (photorespiration); heat-sensitive. Drag CO₂ molecules onto it to fix them yourself.",
  },
  calvin: {
    "y7-8": "The sugar-making cycle in the <strong>stroma</strong>. It uses ATP and NADPH from the thylakoid to build carbon dioxide into <strong>glucose</strong>.",
    "y9-10": "Fixation (Rubisco adds CO₂ to RuBP) → reduction (ATP + NADPH turn 3-PGA into G3P) → regeneration (ATP rebuilds RuBP). For every 3 CO₂ fixed, 1 G3P leaves; 2 G3P can make 1 glucose.",
    y11: "Per 3 CO₂: 9 ATP + 6 NADPH → 1 net G3P (triose phosphate), with 5 G3P recycled to regenerate 3 RuBP. ADP + Pᵢ and NADP⁺ return to the thylakoid. Exported triose phosphate becomes sucrose; surplus becomes starch.",
  },
  lamp: {
    "y7-8": "Drag it closer or further away. Closer = brighter light. Change its colour with the controls.",
    "y9-10": "Drag it closer or further. Light intensity follows the inverse square law: halve the distance and you get 4× the light. Change its colour with the filter controls.",
  },
  co2: { "y7-8": "Carbon dioxide from the air. Drag it onto Rubisco!", "y9-10": "CO₂ dissolved in the stroma. Drag it onto Rubisco to fix it." },
};

export const MISSIONS = [
  { text: { "y7-8": "Make your first <strong>glucose</strong> (sugar): the Calvin cycle must fix 6 CO₂.", "y9-10": "Make your first glucose (the Calvin cycle must fix 6 CO₂)." }, check: (S) => S.glucose >= 1 },
  { text: { "y7-8": "Dim light: drag the lamp <strong>40 cm or more</strong> away and check that light is now the limiting factor.", "y9-10": "Low light: move the lamp 40 cm or more away and confirm light is the limiting factor." }, check: (S, m) => S.lampOn && S.dcm >= 40 && m.lim === "light" },
  { text: { "y7-8": "Bright light: bring the lamp to <strong>12 cm or closer</strong>. Light is no longer what holds it back — what is?", "y9-10": "Bright light: bring the lamp to 12 cm or closer. What limits the rate now? (Find the CO₂ limit.)" }, check: (S, m) => S.lampOn && S.dcm <= 12 && m.lim === "co2" },
  { band: "y9-10", text: "Show that green light is poorly used: shine green light (500–570 nm) from 15 cm or closer, or sweep Colour on the graph.", check: (S) => S.colourSwept || (S.lampOn && !S.white && S.lambda >= 500 && S.lambda <= 570 && S.dcm <= 15) },
  { text: { "y7-8": "Heat things up until the Calvin cycle <strong>stops</strong> (the enzymes lose their shape).", "y9-10": "Heat things up until the Calvin cycle stops (enzymes denature)." }, check: (S, m) => S.lampOn && S.temp >= 43 && m.P < 5 },
  { text: { "y7-8": "Find the best conditions: reach <strong>50+ bubbles a minute</strong> and make 10 glucose.", "y9-10": "Optimise all three factors: reach 50+ O₂ bubbles/min and make 10 glucose." }, check: (S, m) => S.glucose >= 10 && m.rate >= 50 },
  { band: "y11", text: "Build a steep proton gradient: optimise light, CO₂ and temperature until the lumen pH falls below <strong>6.1</strong> (stroma ≈ 8, so roughly 80× more H⁺ in the lumen) and watch ATP synthase spin faster.", check: (S, m, x) => x.pH < 6.1 },
];

export const QUIZ = [
  { q: { "y7-8": "Which is the word equation for photosynthesis?", "y9-10": "Which is the balanced equation for photosynthesis?" },
    options: { "y7-8": ["carbon dioxide + water → glucose + oxygen", "glucose + oxygen → carbon dioxide + water", "oxygen + water → glucose + carbon dioxide", "glucose + water → oxygen"], "y9-10": ["6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂", "C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O", "6CO₂ + 6O₂ → C₆H₁₂O₆ + 6H₂O", "CO₂ + H₂O → C₆H₁₂O₆ + O₂"] },
    answer: 0, why: { "y7-8": "Carbon dioxide + water → glucose + oxygen, using light energy trapped by chlorophyll. The second one is respiration.", "y9-10": "Carbon dioxide + water → glucose + oxygen, using light energy absorbed by chlorophyll. The second option is cellular respiration; the last one isn't balanced." } },
  { q: "Where do the two stages of photosynthesis happen in the chloroplast?",
    options: ["Both happen in the stroma", "Light-dependent: thylakoid membranes. Light-independent (Calvin cycle): stroma", "Light-dependent: stroma. Calvin cycle: thylakoid membranes", "Both happen in the mitochondria"],
    answer: 1, why: "Photosystems, the electron transport chain and ATP synthase sit in the <strong>thylakoid membrane</strong>. Rubisco and the Calvin cycle enzymes are dissolved in the <strong>stroma</strong>." },
  { q: "Where does the oxygen gas released in photosynthesis come from?", options: ["Carbon dioxide", "Water, split at photosystem II", "Glucose", "The chlorophyll molecule"], answer: 1,
    why: { "y7-8": "Photosystem II splits water. The oxygen atoms in carbon dioxide end up in the sugar instead.", "y9-10": "PSII splits water: 2H₂O → 4H⁺ + O₂ + 4e⁻. Experiments with water labelled with ¹⁸O show the O₂ comes from water. The oxygen atoms of CO₂ end up in the sugar (and water)." } },
  { q: "Pondweed under a very bright lamp in water with 0.04 % CO₂ makes 30 bubbles/min. Moving the lamp even closer doesn't change the rate. What would increase it?",
    options: ["Move the lamp closer still", "Add more CO₂ (e.g. sodium hydrogen carbonate)", "Use a green filter", "Heat the water to 50 °C"], answer: 1,
    why: "The rate has plateaued, so light is no longer the limiting factor — CO₂ is. Raising the limiting factor raises the rate. 50 °C would denature the enzymes." },
  { band: "y9-10", q: "What do ATP and NADPH from the light-dependent reactions do in the Calvin cycle?",
    options: ["They absorb light energy", "ATP supplies energy and NADPH supplies electrons (hydrogen) to turn fixed CO₂ into the sugar G3P", "They split water to release oxygen", "They carry CO₂ into the chloroplast"], answer: 1,
    why: "ATP provides the energy and NADPH the reducing power (electrons + H) to reduce 3-PGA to G3P. ATP is also used to regenerate RuBP. ADP and NADP⁺ return to the thylakoid to be recharged." },
  { q: "Why does the rate of photosynthesis drop sharply above about 40 °C?",
    options: ["Chlorophyll stops absorbing light", "Enzymes such as Rubisco denature (lose their shape), so the Calvin cycle stops", "There is no more water", "CO₂ turns into O₂"], answer: 1,
    why: { "y7-8": "The sugar-making cycle is run by enzymes. Too hot, and they lose their shape and stop working. Then the light reactions back up too.", "y9-10": "The Calvin cycle is enzyme-controlled. Up to the optimum (~25–30 °C) rate rises with temperature; above it, the active sites change shape and the enzymes denature. Without the Calvin cycle, NADP⁺ runs out and the light reactions stop too." } },
  { band: "y11", q: "What directly powers ATP synthesis in the thylakoid?",
    options: ["Electrons passing through ATP synthase", "H⁺ flowing down its gradient from the lumen to the stroma through ATP synthase, turning its rotor", "Light absorbed by ATP synthase", "NADPH donating phosphate to ADP"], answer: 1,
    why: "Chemiosmosis: the electron transport chain (water splitting, PQ/cyt b6f) builds a high H⁺ concentration in the lumen. H⁺ returning to the stroma through CF₀ turns the rotor, and the binding-change mechanism in CF₁ makes ATP." },
];

export function explain(S, r, band) {
  const y7 = band === "y7-8";
  let s = "";
  if (!S.lampOn) {
    s = y7 ? `<p>The lamp is <strong>off</strong>. With no light, no electrons are knocked loose, so no energy carriers (ATP, NADPH) are made. The Calvin cycle runs out and stops, and no oxygen is given out.</p>`
      : `<p>The lamp is <strong>off</strong>. Without light the photosystems can't excite electrons, so no ATP or NADPH is made, the Calvin cycle runs out of them and stops, and no O₂ is released.</p>`;
  } else if (r.lim === "light") {
    s = y7 ? `<p><strong>Light is the limiting factor.</strong> Chlorophyll catches light and knocks electrons loose. More light (bring the lamp closer) would speed everything up.</p>`
      : `<p><strong>Light is the limiting factor.</strong> Chlorophyll in PSII and PSI absorbs photons and excites electrons. More light (bring the lamp closer) would make the rate go up.</p>`;
    if (!S.white && r.a < 0.35) s += `<p><strong>This colour of light</strong> is mostly reflected or passes straight through — chlorophyll absorbs only ${Math.round(r.a * 100)}% of it. Red and blue light are absorbed best (that's why leaves look green).</p>`;
  } else if (r.lim === "co2") {
    s = y7 ? `<p><strong>Carbon dioxide is the limiting factor.</strong> The light-catching part could go faster, but <strong>Rubisco</strong> can only use CO₂ as fast as it arrives. More light won't help now — add CO₂.</p>`
      : `<p><strong>CO₂ is the limiting factor.</strong> The light reactions could go faster, but <strong>Rubisco</strong> can only fix CO₂ as fast as it arrives, so the Calvin cycle can't use ATP and NADPH any faster. More light won't help now — raise CO₂.</p>`;
  } else if (S.temp >= 33) {
    s = y7 ? `<p><strong>It's too hot.</strong> The sugar-making enzymes such as <strong>Rubisco</strong> are losing their shape. With the Calvin cycle slowing, the light-catching part backs up too, so less oxygen comes out.</p>`
      : `<p><strong>Temperature is limiting — it's too hot.</strong> Calvin cycle enzymes such as <strong>Rubisco</strong> are losing their shape (denaturing). With the Calvin cycle stalled, NADP⁺ runs out, so the light reactions slow and less O₂ is made.</p>`;
  } else if (S.temp < 20) {
    s = y7 ? `<p><strong>It's cold.</strong> Molecules move slowly, so the enzymes in the Calvin cycle work slowly. Warming towards 25–30 °C speeds it up.</p>`
      : `<p><strong>Temperature is limiting — it's cold.</strong> Molecules move slowly, so enzyme–substrate collisions in the Calvin cycle are rare. Warming towards ~25–30 °C speeds it up.</p>`;
  } else {
    s = `<p><strong>Temperature (enzyme speed) is limiting.</strong> Light and CO₂ are plentiful; the Calvin cycle enzymes are working as fast as this temperature allows. The optimum is about 28 °C.</p>`;
  }
  if (S.den > 0.03) s += `<p><strong>${Math.round(S.den * 100)}% of Rubisco is permanently denatured.</strong> Cooling down won't fix it — press <strong>Reset</strong> for fresh pondweed.</p>`;
  return s;
}

export function nowLine(S, r, x, band) {
  const y7 = band === "y7-8";
  if (r.rate < 0.5) return `<p class="now"><strong>Now:</strong> ${y7 ? "almost nothing is happening — no electrons are flowing." : "electron flow has stopped; the lumen is losing its extra H⁺ through ATP synthase."} Lumen pH ≈ ${x.pH.toFixed(1)}.</p>`;
  const eps = r.rate * 0.15;
  return `<p class="now"><strong>Now:</strong> ${y7
    ? `about ${eps.toFixed(1)} electrons a second flow along the chain, the space inside the thylakoid has filled with H⁺ (pH ≈ ${x.pH.toFixed(1)}), and ATP synthase is ${x.spin > 6 ? "spinning fast" : x.spin > 1 ? "spinning" : "barely turning"}.`
    : `${eps.toFixed(1)} e⁻/s (animation scale) through PSII → PQ → cyt b6f → PC → PSI → NADPH; lumen pH ≈ ${x.pH.toFixed(1)} vs stroma ≈ 8; ATP synthase ${x.spin > 6 ? "spinning fast" : x.spin > 1 ? "turning" : "almost stopped"}; O₂ released ≈ ${r.rate.toFixed(0)} bubbles/min, matched by CO₂ fixed in the Calvin cycle.`} ${y7 ? "" : `Overall: <strong>6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂</strong>.`}</p>`;
}
