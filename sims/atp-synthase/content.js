// Lens-aware text for the cristae (inner membrane) level. Values are strings or { "y7-8", "y9-10", "y11", "y12" }.
import { geff, backpressure, G_THRESH, TAU, wholeYield } from "./model.js";

export const NAMES = {
  I: { "y7-8": "Pump 1", "y9-10": "Complex I (H⁺ pump)", y11: "Complex I · NADH dehydrogenase" },
  II: { "y7-8": "Entry point", "y9-10": "Complex II", y11: "Complex II · succinate dehydrogenase" },
  III: { "y7-8": "Pump 2", "y9-10": "Complex III (H⁺ pump)", y11: "Complex III · cytochrome bc₁" },
  IV: { "y7-8": "Pump 3 (uses oxygen)", "y9-10": "Complex IV (uses O₂)", y11: "Complex IV · cytochrome c oxidase" },
  Q: { "y7-8": "", "y9-10": "Q (carrier)", y11: "ubiquinone (Q)" },
  cytc: { "y7-8": "", "y9-10": "cyt c (carrier)", y11: "cytochrome c" },
  syn: { "y7-8": "ATP-making motor", "y9-10": "ATP synthase", y11: "ATP synthase" },
  F0: { "y7-8": "", y11: "F₀ (c-ring rotor)" },
  F1: { "y7-8": "", y11: "F₁ (α₃β₃ head)" },
  ims: { "y7-8": "SPACE INSIDE THE FOLD · lots of H⁺", "y9-10": "INTERMEMBRANE SPACE · high H⁺", y11: "INTERMEMBRANE SPACE (crista lumen) · high [H⁺], low pH" },
  matrix: { "y7-8": "MATRIX · few H⁺", "y9-10": "MATRIX · low H⁺", y11: "MATRIX · low [H⁺]" },
};

export const INFO = {
  I: {
    title: NAMES.I,
    text: {
      "y7-8": "Takes energy-rich electrons from <strong>NADH</strong> (made from your food) and uses their energy to <strong>pump H⁺</strong> across the membrane.",
      "y9-10": "Takes 2 electrons from <strong>NADH</strong> and uses their energy to pump <strong>4 H⁺</strong> into the intermembrane space.",
      y11: "<strong>Complex I</strong> (NADH dehydrogenase): oxidises NADH → NAD⁺, passes 2 e⁻ (via FMN and iron–sulfur clusters, the orange beads) to ubiquinone, and pumps <strong>4 H⁺</strong> into the intermembrane space.",
    },
  },
  II: {
    title: NAMES.II,
    text: {
      "y7-8": "A second way for electrons to join the chain. It doesn't pump anything.",
      "y9-10": "Electrons from <strong>FADH₂</strong> enter here. Complex II pumps <strong>no H⁺</strong>, so FADH₂ is worth less ATP than NADH.",
      y11: "<strong>Complex II</strong> (succinate dehydrogenase — also a Krebs cycle enzyme): FADH₂ → FAD passes 2 e⁻ to ubiquinone. It pumps <strong>no H⁺</strong>, so FADH₂ yields ≈ 1.5 ATP versus ≈ 2.5 for NADH.",
    },
  },
  III: {
    title: NAMES.III,
    text: {
      "y7-8": "Passes the electrons on and pumps more H⁺ across.",
      "y9-10": "Receives electrons from the carrier Q, passes them to cytochrome c and pumps <strong>4 H⁺</strong>.",
      y11: "<strong>Complex III</strong> (cytochrome bc₁): oxidises ubiquinol (QH₂), reduces cytochrome c and moves <strong>4 H⁺</strong> into the intermembrane space (the Q cycle).",
    },
  },
  IV: {
    title: NAMES.IV,
    text: {
      "y7-8": "The last stop. Electrons are handed to <strong>oxygen</strong>, which joins with H⁺ to make <strong>water</strong>. No oxygen = the whole line stops.",
      "y9-10": "Gives the electrons to <strong>oxygen</strong> — the <strong>final electron acceptor</strong> — making water, and pumps <strong>2 H⁺</strong>. Cyanide blocks it.",
      y11: "<strong>Complex IV</strong> (cytochrome c oxidase): ½O₂ + 2H⁺ + 2e⁻ → H₂O. O₂ is the <strong>final electron acceptor</strong>; complex IV also pumps <strong>2 H⁺</strong>. Cyanide binds its haem a₃–Cu centre.",
    },
  },
  Q: { title: NAMES.Q, text: { "y7-8": "A small carrier that ferries electrons through the oily middle of the membrane.", y11: "<strong>Ubiquinone (Q)</strong>: a lipid-soluble carrier that diffuses within the membrane, carrying 2 e⁻ (as QH₂) from complexes I and II to complex III." } },
  cytc: { title: NAMES.cytc, text: { "y7-8": "A small carrier that ferries electrons from pump 2 to pump 3.", y11: "<strong>Cytochrome c</strong>: a small water-soluble protein on the intermembrane face that carries electrons (one at a time) from complex III to complex IV." } },
  synthase: {
    title: NAMES.syn,
    text: {
      "y7-8": "A tiny <strong>spinning motor</strong>. H⁺ rushing back through it turn the rotor, and each third of a turn makes one <strong>ATP</strong>. Grab the gold handle and spin it yourself!",
      "y9-10": "H⁺ flow back down their gradient through ATP synthase, spinning its rotor. The turning stalk squeezes <strong>ADP + Pᵢ → ATP</strong>: 3 ATP per full turn. This is <strong>chemiosmosis</strong>.",
      y11: "<strong>ATP synthase</strong>: H⁺ enter the a-subunit half-channel, bind the <strong>c-ring</strong> (F₀) and turn it; the central stalk (γ) rotates inside the stationary <strong>α₃β₃</strong> head (F₁, held by the peripheral stalk). Each 120° shifts the β sites Loose → Tight → Open: ADP + Pᵢ bind, ATP forms, ATP is released (binding-change mechanism).",
    },
  },
  rotor: { title: { "y7-8": "Crank handle — drag it round in a circle", y11: "Rotor crank — drag in a circle around F₁" }, text: { "y7-8": "Drag round in the direction of the arrows to make ATP; the other way runs the motor backwards.", y11: "Drag around the ring: with the arrows = synthesis; against them = ATP hydrolysis (ATP synthase working as an ATP-driven H⁺ pump)." } },
};

export const NOTE = {
  "y7-8": "Not to scale, and slowed down hugely — a real ATP synthase spins over 100 times a second.",
  "y9-10": "Not to scale and slowed ~100×. Each glowing pair = 2 electrons. 10 H⁺ pumped per NADH, 6 per FADH₂, 3 H⁺ per ATP made here.",
  y11: "Not to scale and slowed ~100× (real ATP synthase spins > 100 turns/s). Simplified: each glowing pair = 2 electrons (cytochrome c really carries one at a time); 10 H⁺ per NADH (4 + 4 + 2) and 6 per FADH₂; 9 c-subunits → 3 H⁺ per ATP through the motor. Real human ATP synthase has 8 c-subunits (≈ 2.7 H⁺ per ATP) and ≈ 1 more H⁺ is spent importing phosphate — so ≈ 4 H⁺ per ATP overall, ≈ 2.5 ATP per NADH.",
};

/** Narrative from the model state — every causal claim is checked against the model's numbers. */
export function narrative(M, band, ui = {}) {
  const y7 = band === "y7-8", y9 = band === "y9-10";
  const st = M.st, G = M.gradient(), R = M.rotor, ge = geff(G), bp = backpressure(G), o2f = M.o2f();
  const rate = M.rate, backed = M.queueN >= 4, Gp = Math.round(G * 100);
  const hand = M.handActive;
  let main;
  if (hand && R.hand > 0.2) {
    main = y7 ? "You're turning the motor by hand! Every third of a turn squeezes ADP and phosphate together into a new <strong>ATP</strong>. Normally the rush of H⁺ does this for you."
      : "You're cranking <strong>ATP synthase</strong> by hand! Each 120° turn of the central stalk (γ) changes the shape of the β subunits (Loose → Tight → Open), squeezing <strong>ADP + Pᵢ → ATP</strong> — 3 ATP per full turn. Normally the energy comes from H⁺ flowing through F₀; here it comes from your hand. (Scientists really have made ATP by twisting F₁ with magnetic beads.)";
  } else if (hand && R.hand < -0.2) {
    main = M.netATP() > 0
      ? (y7 ? "Running backwards! Now the motor <strong>uses up ATP</strong> and pushes H⁺ back the wrong way, like a pump." : "Running in reverse: ATP synthase now works as an <strong>ATPase</strong>, hydrolysing <strong>ATP → ADP + Pᵢ</strong> and using the energy to pump H⁺ <em>back</em> into the intermembrane space." + (y9 ? "" : " Real mitochondria do this when the gradient collapses (e.g. no O₂); an inhibitor protein (IF₁) limits the waste."))
      : "Running in reverse needs ATP as fuel — and you've run out. Make some ATP first (crank the other way, or let respiration run).";
  } else if (hand) {
    main = "You've got hold of the rotor. Drag around in a circle: <strong>with the gold arrows</strong> makes ATP, <strong>against them</strong> runs the motor backwards.";
  } else if (st.cyanide || st.o2 === 0) {
    const cause = st.cyanide
      ? (y7 ? "<strong>Cyanide</strong> has jammed pump 3, so it can't hand electrons to oxygen." : "<strong>Cyanide</strong> is bound to complex IV, so it can't pass electrons to O₂.")
      : (y7 ? "<strong>No oxygen</strong> — nothing is waiting at the end of the line to take the electrons." : "<strong>No O₂</strong> = no final electron acceptor at complex IV.");
    const queue = backed ? (y7 ? " Electrons have <strong>piled up</strong> along the chain and the pumps have stopped." : " Electrons have <strong>backed up</strong> along the chain, so H⁺ pumping has stopped.")
      : M.queueN >= 1 ? " Electrons are starting to queue at complex IV." : "";
    const syn = ge > 0.08
      ? (y7 ? ` The motor is still turning on the H⁺ left over (${Gp}%) — watch it run down.` : ` ATP synthase is still running on the leftover gradient (${Gp}%) — watch it run down.`)
      : (y7 ? ` The H⁺ build-up is gone (${Gp}%), so the motor has stopped making ATP.` : ` The gradient is spent (${Gp}%), so ATP synthase has stopped (${rate.toFixed(1)} ATP/s).`);
    let after = "";
    if (!y7 && ge <= 0.08) after = st.cyanide
      ? " Glycolysis alone (2 ATP per glucose) can't keep the heart and brain alive — that's why cyanide kills within minutes."
      : " NADH can't be recycled to NAD⁺ here, so the Krebs cycle stalls too. Cells fall back on <strong>fermentation</strong> (lactate in muscle; ethanol + CO₂ in yeast and plants): only <strong>2 ATP per glucose</strong>.";
    main = cause + queue + syn + after;
  } else if (st.olig) {
    main = (y7 ? "<strong>Oligomycin</strong> has jammed the motor, so no ATP is made." : "<strong>Oligomycin</strong> plugs the F₀ proton channel, so H⁺ can't flow back through ATP synthase and no ATP is made.");
    if (st.dnp) main += " But DNP is letting H⁺ leak straight back across the membrane, so the chain keeps running and the energy becomes <strong>heat</strong>.";
    else if (G > 0.9 && bp < 0.4) main += y7 ? ` The H⁺ build-up is full (${Gp}%), so the pumps can hardly push any more — the whole line slows down.` : ` The gradient has climbed to ${Gp}%, so the pumps are working against it and electrons now move at only ${Math.round(bp * 100)}% of their free speed — less O₂ is used. Electron flow is coupled to ATP synthesis: <strong>respiratory control</strong>.`;
    else main += ` The gradient is building up (${Gp}%) because nothing is using it except a small leak.`;
  } else if (st.dnp) {
    const leak = M.leakRate;
    main = y7 ? "The <strong>uncoupler</strong> lets H⁺ leak straight back through the membrane, missing the motor. Their energy turns into <strong>heat</strong> instead of ATP."
      : `The <strong>uncoupler DNP</strong> carries H⁺ straight back across the membrane (${leak.toFixed(1)} H⁺/s right now), bypassing ATP synthase. The gradient has dropped to ${Gp}%` + (ge <= 0.02 ? ", too low to drive ATP synthesis" : ge < 0.15 ? ", barely enough to drive ATP synthase" : "") + `, yet electrons flow at ${Math.round(bp * 100)}% of their free speed — so O₂ is used fast. The energy is released as <strong>heat</strong>.` + (y9 ? "" : " DNP was sold as a diet pill in the 1930s and caused fatal overheating; brown fat does this safely with thermogenin (UCP1).");
  } else if (st.nadh === 0 && M.packets.length === 0) {
    main = y7 ? "No fuel is arriving, so there are no electrons to move along the line. The pumps stop, the H⁺ leak away and the motor winds down."
      : "No NADH or FADH₂ is arriving (no glucose → no Krebs cycle input), so no electrons move along the chain. Pumping stops, the gradient leaks away" + (ge > 0.08 ? ` (${Gp}% and falling)` : "") + " and ATP synthase winds down.";
  } else {
    main = y7
      ? "<strong>NADH</strong> (blue, made from glucose) drops off energy-rich <strong>electrons</strong>. As they pass along the chain, their energy <strong>pumps H⁺</strong> up into the space above. The H⁺ rush back down through the <strong>spinning motor</strong>, which makes <strong>ATP</strong>. At the end, <strong>oxygen</strong> takes the electrons and becomes water."
      : "<strong>NADH</strong> and <strong>FADH₂</strong> hand <strong>electrons</strong> to the chain. As electrons pass complexes I, III and IV, their energy pumps <strong>H⁺</strong> into the intermembrane space. The H⁺ flow back through <strong>ATP synthase</strong> (<strong>chemiosmosis</strong>), spinning its rotor: every 120° makes one ATP. At complex IV, <strong>O₂</strong> is the <strong>final electron acceptor</strong>, forming water.";
    if (G < G_THRESH && rate < 0.3) main += y7 ? " Right now there aren't enough H⁺ built up to turn the motor." : ` The gradient (${Gp}%) is below the ${Math.round(G_THRESH * 100)}% needed to drive ATP synthase.`;
    if (st.o2 > 0 && st.o2 < 25 && M.queueN >= 2) main += y7 ? " Oxygen is scarce, so the last pump is slow and electrons queue up." : " Oxygen is scarce, so complex IV hands on electrons slowly and becomes the bottleneck.";
    if (bp < 0.5 && !y7) main += ` The gradient is steep (${Gp}%), so pumping is harder and electrons slow down (respiratory control).`;
  }
  const turns = Math.abs(R.om / TAU).toFixed(2);
  let live = y7 ? `H⁺ build-up <strong>${Gp}%</strong> · motor <strong>${turns}</strong> turns/s · <strong>${rate.toFixed(1)}</strong> ATP/s`
    : `Gradient <strong>${Gp}%</strong> · rotor <strong>${turns}</strong> turns/s · <strong>${rate.toFixed(1)}</strong> ATP/s`;
  if (backed) live += " · <strong>electrons backed up</strong>";
  if (M.backlog > 2) live += " · NADH piling up";
  return `<p>${main}</p><p class="now">${live}</p>`;
}

export const BIG_PICTURE = {
  "y7-8": `<p>Respiration happens in steps: glucose is first split in the <strong>cytoplasm</strong>; the pieces go into the <strong>mitochondrion</strong>, where they are broken down to <strong>carbon dioxide</strong>. The energy released is collected here, on the folded inner membrane, and stored in <strong>ATP</strong>.</p><p><strong>glucose + oxygen → carbon dioxide + water + energy (ATP)</strong></p>`,
  "y9-10": `<ol class="flow">
      <li><b>Glycolysis</b><span>cytoplasm · glucose → 2 pyruvate</span><em>2 ATP</em></li>
      <li><b>Link reaction + Krebs cycle</b><span>matrix · pyruvate → CO₂</span><em>2 ATP<br>NADH, FADH₂</em></li>
      <li class="here"><b>Electron transport chain + ATP synthase</b><span>inner membrane · you are here</span><em>most of the ATP</em></li>
    </ol><p>Altogether about <strong>30 ATP per glucose</strong> with oxygen; only <strong>2</strong> without it.</p>`,
  y11: `<ol class="flow">
      <li><b>Glycolysis</b><span>cytosol · glucose → 2 pyruvate</span><em>2 ATP<br>2 NADH</em></li>
      <li><b>Link reaction</b><span>matrix · pyruvate → acetyl-CoA + CO₂</span><em>2 NADH<br>2 CO₂</em></li>
      <li><b>Krebs cycle</b><span>matrix · two turns</span><em>2 ATP · 6 NADH<br>2 FADH₂ · 4 CO₂</em></li>
      <li class="here"><b>ETC + chemiosmosis</b><span>inner membrane · you are here</span><em>≈ 26–28 ATP</em></li>
    </ol>
    <p>Total ≈ <strong>30–32 ATP per glucose</strong> for the whole pathway (≈ 2.5 ATP per NADH, ≈ 1.5 per FADH₂; this model's numbers give ${wholeYield(1.5)}–${wholeYield(2.5)} before leak). Older textbooks say 36–38: they assumed 3 per NADH and 2 per FADH₂ and ignored the cost of moving ATP, ADP and phosphate across the membrane.</p>
    <p>Without O₂ only glycolysis works (+ fermentation to recycle NAD⁺): <strong>2 ATP per glucose</strong>.</p>`,
};

export const MISSIONS = [
  { text: { "y7-8": "Grab the gold handle and spin the motor by hand until you make your first ATP", "y9-10": "Grab the gold handle on ATP synthase and crank it in a circle until you make your first ATP by hand" }, check: (M) => M.crankMade >= 1 },
  { maxBand: "y9-10", text: { "y7-8": "Get the motor making lots of ATP: hold ≥ 1.9 ATP/s for 5 s without cranking (hint: fuel + oxygen)", "y9-10": "Reach a high, steady ATP rate: hold ≥ 1.9 ATP/s for 5 s without cranking (hint: fuel + oxygen)" }, check: (M) => M.highT >= 5 },
  { text: { "y7-8": "Add cyanide and watch ATP-making stop", "y9-10": "Poison complex IV with cyanide and watch ATP production stop" }, check: (M) => M.st.cyanide && M.cnT > 3 && M.rate < 0.25 },
  { text: "Turn the fuel supply to 0 and watch the motor wind down", maxBand: "y7-8", check: (M) => M.st.nadh === 0 && M.rate < 0.25 && M.time > 2 && !M.handActive },
  { band: "y9-10", text: "Add the uncoupler DNP: collapse the gradient below 30 % and turn the energy into heat", check: (M) => M.st.dnp && M.dnpT > 4 && M.gradient() < 0.3 },
  { text: { "y7-8": "Take away all the oxygen and find out what happens to the motor", "y9-10": "Take away all the oxygen (no cyanide) and find out what happens to the chain" }, check: (M) => M.st.o2 === 0 && !M.st.cyanide && M.noO2T > 3 && M.rate < 0.25 },
  { band: "y11", text: "Respiratory control: block ATP synthase with oligomycin and drive the gradient to ≥ 95 % so the chain slows", check: (M) => M.st.olig && !M.st.dnp && M.gradient() >= 0.95 && backpressure(M.gradient()) < 0.3 },
  { band: "y11", text: "Run the motor backwards: crank against the arrows to hydrolyse 3 ATP and pump H⁺ back up", check: (M) => M.crankHydro >= 3 },
];

export const QUIZ = [
  { maxBand: "y7-8", q: "What does the spinning motor (ATP synthase) make?", options: ["Glucose", "ATP — the cell's energy carrier", "Oxygen", "Carbon dioxide"], answer: 1, why: "Each third of a turn joins ADP and phosphate into one <strong>ATP</strong>, which the cell spends to do work." },
  { maxBand: "y7-8", q: "What makes the motor spin on its own?", options: ["Electricity from the nucleus", "H⁺ rushing back down through it from where they were crowded", "Sunlight", "Water pushing on it"], answer: 1, why: "The pumps crowd H⁺ into the space above the membrane. As they rush back through the motor, they turn it — like water turning a water wheel." },
  { maxBand: "y7-8", q: "Why do we need to breathe in oxygen?", options: ["To cool the mitochondria", "Oxygen collects the used electrons at the end of the chain — without it, the chain stops", "Oxygen is turned into glucose", "To make carbon dioxide for the blood"], answer: 1, why: "Oxygen takes the electrons at the end of the line (making water). With no oxygen, electrons pile up, the pumps stop and almost no ATP is made." },
  { maxBand: "y7-8", q: "Where in the cell are these pumps and motors found?", options: ["In the nucleus", "In the folded inner membrane of the mitochondria", "In the cell wall", "In the vacuole"], answer: 1, why: "They sit in the <strong>inner membrane</strong> of each mitochondrion. Its many folds give room for thousands of pumps and motors." },
  { maxBand: "y7-8", q: "Cyanide jams pump 3. What happens to ATP-making?", options: ["It speeds up", "Nothing changes", "It stops — electrons pile up, the pumps stop, and the H⁺ build-up runs out", "The motor spins backwards forever"], answer: 2, why: "With pump 3 jammed, electrons can't reach oxygen. The whole line backs up, no more H⁺ are pumped, and once the H⁺ build-up is used the motor stops." },
  { q: "What is the final electron acceptor of the electron transport chain?", band: "y9-10", maxBand: "y11", options: ["NAD⁺", "Oxygen (O₂)", "ATP synthase", "Carbon dioxide"], answer: 1, why: "At complex IV, electrons are passed to O₂, which also picks up H⁺ to form water. Without O₂ the whole chain backs up." },
  { band: "y9-10", q: "Which statement best describes chemiosmosis?", options: ["Electrons flowing through ATP synthase to make ATP", "H⁺ flowing down their concentration gradient through ATP synthase, driving ATP synthesis", "Water moving across the inner membrane by osmosis", "Glucose being split into pyruvate in the cytoplasm"], answer: 1, why: "The ETC uses electron energy to pump H⁺; the H⁺ gradient then powers ATP synthase. Electrons never pass through ATP synthase." },
  { band: "y9-10", maxBand: "y9-10", q: "Why is the inner membrane folded into cristae?", options: ["To store glucose", "To give a much larger surface area for the electron transport chain and ATP synthase", "To keep oxygen out", "To make the mitochondrion move"], answer: 1, why: "More membrane means more ETC complexes and ATP synthases — so more ATP can be made in the same small organelle." },
  { band: "y9-10", maxBand: "y9-10", q: "Where do H⁺ ions build up during aerobic respiration?", options: ["In the matrix", "In the intermembrane space (and crista lumen)", "In the cytoplasm", "Inside the ETC proteins"], answer: 1, why: "Complexes I, III and IV pump H⁺ from the matrix into the intermembrane space, so it has a higher H⁺ concentration (lower pH) than the matrix." },
  { band: "y9-10", q: "Why is cyanide so deadly?", options: ["It destroys glucose in the blood", "It blocks complex IV, so electrons can't reach O₂ — pumping stops and mitochondrial ATP production collapses", "It makes ATP synthase spin too fast", "It stops oxygen entering the lungs"], answer: 1, why: "Even with plenty of O₂ in the blood, cells can't use it. Glycolysis alone gives only 2 ATP per glucose — not enough for the heart and brain." },
  { band: "y11", q: "Approximately how much ATP per glucose do aerobic respiration (the whole pathway) and fermentation yield?", options: ["Aerobic ≈ 30–32, fermentation 2", "Aerobic 2, fermentation ≈ 30–32", "Both about 36", "Aerobic ≈ 10, fermentation 4"], answer: 0, why: "Modern estimates are ≈ 30–32 ATP for the whole pathway (glycolysis + link + Krebs + ETC; older textbooks: 36–38). Glycolysis + fermentation gives just 2." },
  { band: "y11", q: "The uncoupler DNP makes the inner membrane leaky to H⁺. What happens?", options: ["ATP production rises and body temperature falls", "Electron flow stops completely", "The chain runs fast and uses more O₂, but the gradient's energy is released as heat instead of making ATP", "H⁺ build up even more in the intermembrane space"], answer: 2, why: "H⁺ bypass ATP synthase, so little ATP is made but electron flow (and O₂ use) speeds up. Brown fat uses a natural uncoupler (thermogenin) to keep babies warm." },
  { band: "y11", q: "Oligomycin blocks ATP synthase's F₀ channel. Why does O₂ consumption also fall?", options: ["Oligomycin also destroys O₂", "With no H⁺ flowing back, the gradient becomes so steep that the pumps can't push more H⁺ — electron flow slows (respiratory control)", "Complex IV is blocked by oligomycin", "The matrix fills with ATP, which reacts with O₂"], answer: 1, why: "Electron transport and ATP synthesis are <strong>coupled</strong> through the H⁺ gradient. Stop the outflow and the gradient backs up, slowing the chain and O₂ use." },
  { band: "y12", q: "Each NADH yields ≈ 2.5 ATP rather than the 10 H⁺ ÷ 3 ≈ 3.3 you might calculate from the rotor alone. Why?", options: ["Some electrons skip complex III", "About 1 extra H⁺ per ATP is used to import phosphate (and exchange ADP for ATP), so ≈ 4 H⁺ are spent per ATP delivered to the cytosol", "NADH only carries one electron", "ATP synthase makes 4 ATP per turn"], answer: 1, why: "≈ 3 H⁺ (8–9 c-subunits ÷ 3 β sites) turn the motor per ATP, plus ≈ 1 H⁺ to bring Pᵢ in via the phosphate carrier: 10 ÷ 4 = 2.5 ATP per NADH, 6 ÷ 4 = 1.5 per FADH₂." },
];
