// Enzyme Lab — lens-aware text. Values may be strings or { "y7-8", "y9-10", "y11", "y12" } variants (lens.pick).
import { ENZYMES } from "./model.js";

export const REACTION = {
  amylase: { "y7-8": "breaks <strong>starch</strong> into a sugar called <strong>maltose</strong>", "y9-10": "catalyses <strong>starch → maltose</strong>", y11: "hydrolyses the glycosidic bonds in <strong>starch → maltose</strong>" },
  pepsin: { "y7-8": "breaks <strong>proteins</strong> into smaller pieces (<strong>peptides</strong>)", "y9-10": "catalyses <strong>protein → peptides</strong>", y11: "hydrolyses peptide bonds: <strong>protein → peptides</strong>" },
  catalase: { "y7-8": "breaks <strong>hydrogen peroxide</strong> (a poison made in cells) into <strong>water</strong> and <strong>oxygen</strong>", "y9-10": "catalyses <strong>2 H₂O₂ → 2 H₂O + O₂</strong>", y11: "catalyses <strong>2 H₂O₂ → 2 H₂O + O₂</strong> (one of the fastest enzymes known)" },
};

export const NAMES = {
  amylase: { sub: { "y7-8": "Starch", "y9-10": "Starch (chain)" }, prod: { "y7-8": "Maltose (sugar)", "y9-10": "Maltose" } },
  pepsin: { sub: { "y7-8": "Protein", "y9-10": "Protein (chain)" }, prod: "Peptides" },
  catalase: { sub: "Hydrogen peroxide (H₂O₂)", prod: { "y7-8": "Water + oxygen bubbles", "y9-10": "Water + O₂ bubbles" } },
};

export const INHIB = {
  CI: { "y9-10": "Look-alike inhibitor (blocks the active site)", y11: "Competitive inhibitor" },
  NI: { "y9-10": "Shape-changing inhibitor (binds elsewhere)", y11: "Non-competitive (allosteric) inhibitor" },
};

/** Honest framing when entered from the plant cell. */
export const PLANT_NOTE = {
  "y7-8": `<h2>Enzyme lab in the cytosol</h2><p>You've zoomed right into the cell's jelly-like <strong>cytosol</strong> to see how enzymes work. Plant cells really do use <strong>amylase</strong> (to break down stored starch) and <strong>catalase</strong> (to destroy hydrogen peroxide). <strong>Pepsin</strong> is not in plants — it's from an animal's stomach — it's here so you can compare. A living cell keeps its insides at about pH 7, so the pH slider is a lab test.</p>`,
  "y9-10": `<h2>Enzyme lab: zoom in on how enzymes work</h2><p>This is a patch of <strong>cytosol</strong> used as a virtual lab. <strong>Amylase</strong> and <strong>catalase</strong> occur in plant cells: plant amylases break down stored starch (mostly inside chloroplasts) and plant catalase works inside <strong>peroxisomes</strong>. <strong>Pepsin</strong> is an animal stomach enzyme, included to compare pH optima. A real cell keeps its cytosol near pH 7, so changing pH here is a test-tube experiment. The optimum values used are for the human versions of each enzyme.</p>`,
  y11: `<h2>Enzyme lab: zoom in on how enzymes work</h2><p>A patch of <strong>cytosol</strong> used as a virtual lab. <strong>Amylases</strong> (α and β) and <strong>catalase</strong> occur in plant cells: starch is degraded mainly in the chloroplast stroma (largely to maltose, which is exported at night), and catalase is localised in <strong>peroxisomes</strong>, where it removes the H₂O₂ produced by photorespiration. <strong>Pepsin</strong> is an animal gastric protease, included to contrast pH optima. Cytosolic pH is homeostatically held near 7.2–7.5, so the pH slider models an in-vitro assay. Optima used are for the human enzymes.</p>`,
};

export const NOT_TO_SCALE = {
  "y7-8": "<em>Not to scale:</em> real substrate molecules are much smaller than enzymes, there are far more of them, and real enzymes work thousands of times faster.",
  "y9-10": "<em>Not to scale:</em> real substrates are far smaller relative to enzymes, molecules are far more numerous, and real catalase works millions of times per second. Shapes are simplified; the cytosol is really far more crowded.",
};

/** The main "What's happening" paragraph, chosen from the model's measured state (not from switch positions). */
export function narrative(band, x) {
  const { E, st, heatDead, niSm, ciSm, busySm, dpH, temp, pH, nS, rate, hasInhib } = x;
  const y7 = band === "y7-8", y9 = band === "y9-10";
  const heat = heatDead >= 0.3;
  if (st.dead >= 0.6) {
    if (y7) return `Most of the enzymes are <strong>broken</strong> (denatured). ${heat ? "The heat" : "The very strong acid or alkali"} shook them out of shape — they have unravelled into loose chains, so the <strong>active site</strong> is gone and the substrate can't fit. Cooling down or fixing the pH won't repair them. Press <em>Reset</em> for fresh enzymes.`;
    if (y9) return `Most enzymes are <strong>denatured</strong>. ${heat ? "Heat" : "Extreme pH"} broke the weak bonds holding each protein's 3-D shape, so the <strong>active site has unfolded</strong> and substrate no longer fits. This is <strong>irreversible</strong> — ${heat ? "cooling" : "returning to the optimum pH"} will not refold them. Only fresh enzyme (Reset) restores the rate.`;
    return `Most enzymes are <strong>denatured</strong>. ${heat ? "Thermal agitation" : "Extreme pH (changing the ionisation of R groups)"} disrupted the hydrogen bonds, ionic bonds and other weak interactions that hold the <strong>tertiary structure</strong>. The polypeptide unravels (its peptide bonds — the primary structure — stay intact), the active site loses its specific shape, and the change is <strong>irreversible</strong> here. Only fresh enzyme (Reset) restores activity.`;
  }
  if (temp > E.Topt + 3 && st.dead > 0.02) {
    if (y7) return `It's hotter than the enzymes' best temperature. Molecules move faster, but enzymes are starting to <strong>unravel</strong> one by one (they turn grey). Once broken they stay broken, so the reaction slows down.`;
    return `Above the optimum the molecules move fast, but enzymes are <strong>denaturing one by one</strong> (they turn grey and unravel into a loose chain). The rate may rise briefly, then falls as active sites are permanently lost${y9 ? "" : " — so the measured optimum depends on how long you incubate"}.`;
  }
  if (Math.abs(pH - E.pHopt) > E.pHden && st.dead > 0.02) {
    return y7 ? `This pH is so far from the enzyme's best pH that enzymes are being <strong>permanently broken</strong>.` : `This pH is far from the optimum, so enzymes are <strong>denaturing</strong>: the active site's shape is permanently destroyed.`;
  }
  if (!y7 && niSm >= 0.25) {
    if (y9) return `Inhibitors that bind <strong>elsewhere</strong> on the enzyme (green) have attached to many enzymes. This changes the shape of the active site, so those enzymes can't work. Adding more substrate <strong>can't</strong> fix this — the maximum rate is lowered.`;
    return `<strong>Non-competitive inhibitors</strong> (green) occupy the <strong>allosteric site</strong> on ${Math.round(niSm * 100)} % of enzymes, changing the conformation of the active site so no ES complex can react. Because they don't compete with substrate, raising [S] <strong>can't</strong> overcome this: <strong>Vmax is lowered</strong> (Km is unchanged in this simple model).`;
  }
  if (!y7 && ciSm >= 0.2) {
    if (y9) return `Look-alike inhibitors (red) are a similar shape to the substrate, so they sit in active sites and block them — but don't react. Because they <strong>compete</strong> with the substrate for the same site, flooding the solution with more substrate wins most active sites back.`;
    return `<strong>Competitive inhibitors</strong> (red) are structurally similar to the substrate and bind reversibly to the <strong>active site</strong> (${Math.round(ciSm * 100)} % blocked now). They compete with substrate, so high [S] out-competes them: <strong>Vmax is unchanged</strong> but the apparent <strong>Km rises</strong>.`;
  }
  if (Math.abs(pH - E.pHopt) >= 1.5) {
    if (y7) return `The pH has changed the <strong>shape</strong> of the active site, so substrates fit less often. Shape matters! Move the pH back toward pH ${E.pHopt} and the enzymes recover (as long as they haven't been broken).`;
    if (y9) return `pH ${pH} is away from the optimum (pH ${E.pHopt}). H⁺ ions change the charges on amino acids in the active site, <strong>distorting its shape</strong>, so substrate binds less often. Near the optimum this is <strong>reversible</strong>; at extreme pH the enzyme denatures permanently.`;
    return `At pH ${pH} the ionisation of R groups in and around the active site has changed, altering its shape and charge distribution — fewer collisions form an ES complex and turnover slows (fit ≈ ${Math.round(x.fit * 100)} %). Close to the optimum this is <strong>reversible</strong>; far from it, the tertiary structure is lost (denaturation).`;
  }
  if (temp <= 20) {
    if (y7) return `It's cold: molecules move slowly, so substrates bump into active sites less often. The enzymes are <strong>not broken</strong> — warm them up and they speed up again.`;
    return `It's cold: molecules move slowly and have less kinetic energy, so there are fewer <strong>successful collisions</strong> and each reaction is slower${y9 ? "" : " (roughly halving for every 10 °C drop, Q₁₀ ≈ 2)"}. The enzymes are <strong>not damaged</strong> — warming them restores the rate.`;
  }
  if (busySm >= 0.65 && !hasInhib) {
    if (y7) return `Nearly every enzyme is busy. Adding more substrate barely helps now — you'd need <strong>more enzymes</strong> to go faster.`;
    if (y9) return `<strong>Saturation:</strong> almost every active site is occupied, so the rate is near its maximum. Adding more substrate barely helps — now the amount of <strong>enzyme</strong> limits the rate.`;
    return `<strong>Saturation:</strong> ${Math.round(busySm * 100)} % of active sites hold substrate, so v ≈ <strong>Vmax</strong> — the Michaelis–Menten curve has flattened. Rate is now limited by [E] and turnover (k<sub>cat</sub>), not by [S].`;
  }
  if (nS < 20) {
    if (y7) return `There's not much substrate, so most enzymes are waiting with empty active sites. More substrate would mean more bumps and a faster reaction.`;
    return `There is little substrate, so most active sites are empty. The rate is limited by how often substrate <strong>collides</strong> with an active site${y9 ? "" : " — on the steep, nearly linear part of the Michaelis–Menten curve ([S] ≪ Km)"} — adding substrate speeds it up.`;
  }
  if (rate < 0.05) return y7 ? `Almost nothing is happening right now — try changing the conditions.` : `The rate is close to zero right now — check the conditions.`;
  if (y7) return `Substrate molecules bump into enzymes at random. When one fits into the <strong>active site</strong>, the enzyme breaks it into products and lets them go. The enzyme isn't used up — it does the same job again and again. Enzymes are <strong>biological catalysts</strong>.`;
  if (y9) return `Substrate molecules collide with enzymes at random. When one hits the <strong>active site</strong> in the right orientation it binds, forming an <strong>enzyme–substrate complex</strong>. The bonds break and the <strong>products</strong> are released. The enzyme is <strong>not used up</strong> — it catalyses again and again.`;
  return `Substrate collides with enzymes at random; a correctly oriented collision with the <strong>active site</strong> forms an <strong>enzyme–substrate complex</strong>. In the <strong>induced-fit</strong> model the flexible active site then closes around the substrate (watch the lips of the groove), straining its bonds and lowering the <strong>activation energy</strong>. Products are released and the enzyme is unchanged.`;
}

export const QUIZ = [
  // Years 7–8
  { maxBand: "y7-8", q: "What is an enzyme?", options: ["A type of sugar that gives cells energy", "A protein that speeds up a chemical reaction without being used up", "A chemical that kills germs", "A part of the cell wall"], answer: 1, why: "Enzymes are <strong>biological catalysts</strong>: proteins that speed up reactions in living things and can be used again and again." },
  { maxBand: "y7-8", q: "Why does amylase break down starch but not protein?", options: ["Starch is softer", "The shape of its active site only fits starch", "Protein is too heavy", "Amylase is only found in plants"], answer: 1, why: "Each enzyme's <strong>active site</strong> has a shape that only fits its own substrate. Shape matters!" },
  { maxBand: "y7-8", q: "Amylase is heated to 70 °C, then cooled back to 37 °C. What happens?", options: ["It works normally again", "It stays broken — heat changed its shape for good", "It works faster than before", "It turns into starch"], answer: 1, why: "Heat makes the enzyme <strong>unravel</strong> (denature). It doesn't fold back when it cools, so it stays broken." },
  { maxBand: "y7-8", q: "What happens to an enzyme after it has done its job once?", options: ["It is used up", "It becomes one of the products", "It can do the same job again", "It turns into substrate"], answer: 2, why: "Enzymes are not used up. Follow one enzyme in the lab and count how many products it makes." },
  { maxBand: "y7-8", q: "Enzymes are put in the fridge (5 °C). What happens?", options: ["They are destroyed", "They work slowly, but speed up again when warmed", "They work faster", "They turn into fat"], answer: 1, why: "Cold slows molecules down, so substrates reach active sites less often. The enzymes aren't damaged." },
  { maxBand: "y7-8", q: "Catalase breaks down hydrogen peroxide. What are the products?", options: ["Water and oxygen", "Sugar and carbon dioxide", "Starch and water", "Salt and oxygen"], answer: 0, why: "2 H₂O₂ → 2 H₂O + O₂ — that's why you see oxygen bubbles. Cells use catalase to get rid of poisonous hydrogen peroxide." },
  // Years 9–10
  { band: "y9-10", maxBand: "y9-10", q: "A rate–temperature graph rises to a peak at 37 °C, then falls steeply. Why does it fall?", options: ["The substrate runs out", "The enzyme denatures: its active site loses its shape", "Molecules move more slowly", "The products block the enzyme"], answer: 1, why: "Above the optimum, heat breaks the weak bonds holding the enzyme's shape, so active sites are lost permanently." },
  { band: "y9-10", maxBand: "y9-10", q: "Why does adding more and more substrate eventually stop increasing the rate?", options: ["The extra substrate denatures the enzyme", "All the active sites are busy (saturated)", "The enzyme gets used up", "The products are destroyed"], answer: 1, why: "When every active site is occupied, the amount of enzyme limits the rate — it levels off at its maximum." },
  { band: "y9-10", maxBand: "y9-10", q: "Pepsin works best at pH 2 but amylase at pH 7. Why?", options: ["Acid speeds up every enzyme", "Each active site's shape depends on the charges on its amino acids, and each enzyme suits where it works", "Pepsin is not a protein", "Amylase only works in the cold"], answer: 1, why: "H⁺ ions change charges in the active site. Pepsin works in acidic stomach juice; amylase in near-neutral saliva." },
  { band: "y9-10", maxBand: "y9-10", q: "There is plenty of substrate. You double the amount of enzyme. What happens to the rate?", options: ["It halves", "It roughly doubles", "It stays the same", "It drops to zero"], answer: 1, why: "With substrate in excess, twice as many active sites make about twice as many products per second." },
  { band: "y9-10", maxBand: "y9-10", q: "Amylase is heated to 70 °C, then cooled back to 37 °C. What happens to its activity?", options: ["It stays very low — denaturation is permanent", "It returns to normal", "It becomes faster than before", "It now breaks down protein"], answer: 0, why: "Denaturation is irreversible: the active site doesn't reform on cooling." },
  { band: "y9-10", maxBand: "y9-10", q: "What is the 'optimum temperature' of an enzyme?", options: ["The highest temperature it can survive", "The temperature at which it works fastest", "Room temperature", "The temperature at which it denatures"], answer: 1, why: "The optimum is the peak of the rate–temperature graph. Run a Temperature experiment to find it." },
  // Year 11–12
  { band: "y11", q: "How does the induced-fit model differ from the lock-and-key model?", options: ["Induced fit says the active site is rigid and exactly complementary", "Induced fit says the active site changes shape slightly, moulding around the substrate as it binds", "Induced fit says the substrate permanently changes the enzyme", "There is no difference"], answer: 1, why: "Lock-and-key pictures a rigid site. In induced fit the active site is flexible: binding makes it close around the substrate, straining bonds and lowering the activation energy." },
  { band: "y11", q: "On a Michaelis–Menten plot, what is K<sub>m</sub>?", options: ["The maximum rate", "The substrate concentration at which the rate is half of Vmax", "The enzyme concentration", "The temperature optimum"], answer: 1, why: "K<sub>m</sub> = [S] giving ½Vmax. A low K<sub>m</sub> means the enzyme reaches half-saturation at low [S]. Run a [Substrate] experiment to fit it." },
  { band: "y11", q: "An inhibitor's effect disappears when lots of extra substrate is added. What type is it?", options: ["Non-competitive — it binds an allosteric site", "Competitive — it competes with substrate for the active site", "A denaturing agent", "A product of the reaction"], answer: 1, why: "Competitive inhibitor and substrate compete for the same site, so high [S] wins most sites back. Allosteric (non-competitive) inhibition can't be overcome this way." },
  { band: "y11", q: "How does a non-competitive inhibitor change the kinetics?", options: ["Vmax unchanged, Km increased", "Vmax lowered, Km (approximately) unchanged", "Vmax increased", "No effect on the rate"], answer: 1, why: "By binding an allosteric site it effectively removes working enzyme, so Vmax falls; substrate binding to the remaining enzymes is unaffected. (Competitive: Vmax unchanged, apparent Km up.)" },
  { band: "y11", q: "Which bonds are broken when an enzyme is denatured by heat?", options: ["Peptide bonds between amino acids", "Hydrogen bonds, ionic bonds and other weak interactions holding the tertiary structure", "Covalent bonds in the substrate", "None — denaturation is reversible"], answer: 1, why: "Heat disrupts the weak interactions that maintain the 3-D fold. The primary structure (peptide bonds) remains — the chain unravels but stays connected, as in the 3D view." },
  { band: "y11", q: "Why does pH far from the optimum reduce enzyme activity?", options: ["H⁺ ions destroy peptide bonds instantly", "Changes in [H⁺] alter the ionisation of R groups, changing the active site's shape and charge so substrate binds poorly", "Acids add more substrate", "It only affects the substrate"], answer: 1, why: "Ionisable R groups (e.g. –COOH, –NH₂) gain or lose H⁺, altering ionic and hydrogen bonding in the active site. Small shifts are reversible; extremes denature the protein." },
];

export const where = (key) => ENZYMES[key].where;
