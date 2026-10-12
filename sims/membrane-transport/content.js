// Membrane Transport — wording for the 3D level, by configuration (animal / plant) and year band.
// Pure functions (no DOM): level.js passes in the model, the lens and a few helpers.
import { SP } from "./model.js";

const fmt = (v) => (v >= 10 ? v.toFixed(0) : v.toFixed(1));
export const ratio = (a, b) => (b === 0 ? (a === 0 ? "1" : `${a}:0`) : `${fmt(a / b)}×`);
const p = (s) => `<p>${s}</p>`;

// ---------- names and labels ----------
export const SIDE_LABELS = {
  animal: {
    out: { "y7-8": "OUTSIDE · the cell's surroundings", "y9-10": "OUTSIDE · extracellular fluid" },
    inside: { "y7-8": "INSIDE · the cell", "y9-10": "INSIDE · cytoplasm" },
  },
  plant: {
    out: { "y7-8": "OUTSIDE · the cell wall space", "y9-10": "OUTSIDE · cell wall space (apoplast)" },
    inside: { "y7-8": "INSIDE · the cell", "y9-10": "INSIDE · cytoplasm" },
  },
};

/** Protein label shown in 3D, by configuration and band. */
export function protLabels(mode, lens) {
  if (mode === "plant") {
    return {
      aqp: lens.pick({ "y7-8": "Water channel", "y9-10": "Aquaporin" }),
      kch: lens.pick({ "y7-8": "K⁺ channel", "y9-10": "K⁺ channel" }),
      suc: lens.pick({ "y7-8": "Sugar carrier", "y9-10": "H⁺–sucrose symporter" }),
      hpump: lens.pick({ "y7-8": "Proton pump", "y9-10": "H⁺ pump", y11: "H⁺-ATPase" }),
      nit: lens.pick({ "y7-8": "Nitrate carrier", "y9-10": "H⁺–nitrate symporter" }),
    };
  }
  return {
    aqp: lens.pick({ "y7-8": "Water channel", "y9-10": "Aquaporin" }),
    kch: "K⁺ channel",
    glut: lens.pick({ "y7-8": "Glucose carrier", "y9-10": "GLUT carrier" }),
    pump: lens.pick({ "y7-8": "Sodium–potassium pump", "y9-10": "Na⁺/K⁺ pump" }),
    nach: "Na⁺ channel",
  };
}

/** Panel note: which proteins this configuration shows. */
export function configNote(mode, lens) {
  if (mode === "plant") {
    return lens.pick({
      "y7-8": `<p>You came here from the <strong>plant cell</strong>, so this patch of membrane has a plant cell's proteins. A <strong>proton pump</strong> pushes tiny acid particles (H⁺) out. The H⁺ then rush back in through <strong>carriers</strong> and drag sugar and nitrate in with them. Animal cells use a different pump (the sodium–potassium pump).</p>`,
      "y9-10": `<p>You came here from the <strong>plant cell</strong>, so this patch shows a <strong>plant plasma membrane</strong>. Its main pump is the <strong>H⁺ pump (H⁺-ATPase)</strong>. It uses ATP to push H⁺ out, and the H⁺ gradient it builds powers carriers that bring in sucrose and nitrate. (Animal cells use the Na⁺/K⁺ pump and a GLUT glucose carrier instead.)</p>`,
      y11: `<p>Entered from the <strong>plant cell</strong>: this is a plant plasma membrane. The <strong>P-type H⁺-ATPase</strong> (1 H⁺ per ATP) builds a proton gradient and a membrane potential. <strong>H⁺–sucrose</strong> and <strong>H⁺–nitrate</strong> symporters use that proton-motive force (<strong>secondary active transport</strong>). K⁺ channels and aquaporins work as in animal cells. Animal cells use the Na⁺/K⁺-ATPase and GLUT carriers instead.</p>`,
    });
  }
  return lens.pick({
    "y7-8": `<p>This patch of membrane has an <strong>animal cell's</strong> proteins: a <strong>pump</strong> that uses energy and a <strong>carrier</strong> that lets glucose in. Plant cells use a different pump.</p>`,
    "y9-10": `<p>This patch shows an <strong>animal cell membrane</strong>: the Na⁺/K⁺ pump and a GLUT glucose carrier. Plant cells have the same kinds of transport, but their main pump moves H⁺ instead.</p>`,
    y11: `<p>An <strong>animal-cell</strong> membrane patch: the Na⁺/K⁺-ATPase (3 Na⁺ out, 2 K⁺ in per ATP) and a GLUT carrier. Plant plasma membranes use a <strong>P-type H⁺-ATPase</strong> and H⁺-coupled symporters instead. Open this level from the plant cell to compare.</p>`,
  });
}

export function canvasLabel(mode) {
  return mode === "plant"
    ? "Membrane transport simulation, plant cell: a phospholipid bilayer separating the cell wall space (top) from cytoplasm (bottom), with an aquaporin, a potassium channel, an H plus sucrose symporter, a P-type H plus ATPase proton pump and an H plus nitrate symporter. Oxygen, carbon dioxide, water, sucrose, hydrogen ions, nitrate, potassium and large proteins move between the two sides. The What's happening panel describes the current state."
    : "Membrane transport simulation, animal cell: a phospholipid bilayer separating extracellular fluid (top) from cytoplasm (bottom), with an aquaporin, a potassium channel, a GLUT glucose carrier, a sodium-potassium pump and a sodium channel. Oxygen, carbon dioxide, water, glucose, sodium, potassium and large protein molecules move between the two sides. The What's happening panel describes the current state.";
}

export function protHint(mode, lens) {
  const pump = mode === "plant" ? "proton pump" : "Na⁺/K⁺ pump";
  return lens.pick({
    "y7-8": `Tip: tap a protein in the membrane to switch it on or off. Press and hold the ${pump} to give it extra energy (ATP).`,
    "y9-10": `Tip: tap a protein in the membrane to open/close or block it. Press and hold the ${pump} to feed it ATP.`,
  });
}

// ---------- the "Net movement now" line ----------
export function nowLine(M, c, lens) {
  const items = [];
  const plant = M.plant;
  const list = plant ? ["o2", "co2", "h2o", "suc", "h", "no3", "k"] : ["o2", "co2", "h2o", "glc", "na", "k"];
  const simple = lens.band === "y7-8";
  for (const sp of list) {
    const f = M.flux(sp);
    const grad = c[sp].out - c[sp].in; // + means more outside
    if (Math.abs(f) < 0.2 || Math.abs(grad) < 3) continue; // ignore random back-and-forth
    const inward = f > 0;
    const down = (inward && grad > 0) || (!inward && grad < 0);
    let how;
    if (plant && (sp === "suc" || sp === "no3")) { // symport: always runs with H⁺
      how = down ? (simple ? "with H⁺ through its carrier, downhill" : "with H⁺ through its symporter, <em>down</em> its own gradient") : (simple ? "with H⁺ through its carrier, <em>uphill</em> (the H⁺ rush gives the energy)" : "with H⁺ through its symporter, <em>against</em> its own gradient (secondary active transport)");
    } else if (plant && sp === "h") {
      how = inward ? (simple ? "back in through the carriers, downhill" : "back in with its cargo, <em>down</em> its gradient") : (simple ? "pushed out by the pump (needs ATP)" : "<em>against</em> its gradient (active: the H⁺ pump, using ATP)");
      if (inward && !down) continue;
    } else if (plant && sp === "k") {
      how = down ? (simple ? "through its channel, downhill" : "through its channel, <em>down</em> its concentration gradient") : (simple ? "through its channel, pulled in by the cell's negative charge" : "through its channel, pulled by the negative membrane potential (electrochemical gradient)");
    } else {
      const active = !plant && ((sp === "na" && !inward) || (sp === "k" && inward)); // the pump's directions
      if (!down && !active) continue; // passive movement can only be net down a gradient: anything else is noise
      how = down ? (simple ? "downhill (no energy needed)" : "<em>down</em> its gradient (passive)") : (simple ? "<em>uphill</em> (the pump is using energy)" : "<em>against</em> its gradient (active: the pump, using ATP)");
    }
    items.push({ f, text: `<strong>${SP[sp].name}</strong> ${inward ? "into" : "out of"} the cell — ${how}` });
  }
  items.sort((a, b) => Math.abs(b.f) - Math.abs(a.f));
  const head = simple ? "Happening now:" : "Net movement now:";
  if (!items.length) return `<p class="now"><strong>${head}</strong> nothing big — molecules still cross both ways, but the two sides are close to balanced.</p>`;
  return `<p class="now"><strong>${head}</strong> ${items.slice(0, 3).map((i) => i.text).join("; ")}.</p>`;
}

export function notToScale(mode, lens) {
  const base = mode === "plant"
    ? "Not to scale: a real membrane is about 7 nm thick and molecules are drawn much larger. One pump here stands for the hundreds in a real cell, and real pumps cycle about 100 times per second. Both sides have equal volume, so particle count = concentration. The membrane potential and gradients are teaching-scale."
    : "Not to scale: a real membrane is about 7 nm thick, molecules are drawn much larger, and a real pump cycles about 100 times per second. Both sides have equal volume, so particle count = concentration.";
  return lens.band === "y7-8" ? "Not to scale: the membrane is really about 7 nm thin (roughly ten thousand times thinner than a sheet of paper), and the molecules are drawn much bigger than they are." : base;
}

// ---------- the "What's happening" body ----------
const Y12_LINK = {
  // appended for Year 12 only: links to heredity and gene expression (Module 5/6)
  intro: "<strong>Year 12 link:</strong> every protein here is a gene product. The order of amino acids (set by the gene's base sequence) decides each protein's shape, so a mutation that changes a binding site or pore can stop a transporter working — as happens with the CFTR chloride channel in cystic fibrosis.",
  pump: "<strong>Year 12 link:</strong> the pump's shape change depends on its tertiary structure, which comes from its amino acid sequence. A mutation in the gene can alter that structure and stop the cycle.",
  channel: "<strong>Year 12 link:</strong> a channel's selectivity comes from the amino acids lining its pore. Changing one (a point mutation) can change which ions get through.",
  carrier: "<strong>Year 12 link:</strong> a cell controls how fast it can take up a substance by controlling how many carrier proteins it makes — gene expression decides how many copies are in the membrane.",
};

export function focusText(M, c, lens, focus, H) {
  return M.plant ? plantFocus(M, c, lens, focus, H) : animalFocus(M, c, lens, focus, H);
}

function y12(lens, key) { return lens.band === "y12" ? p(Y12_LINK[key]) : ""; }

function animalFocus(M, c, lens, focus, H) {
  const L = (v) => lens.pick(v), T = M.temp, open = (id) => M.byId[id].open;
  switch (focus) {
    case "o2": case "co2": {
      const sp = focus, o = c[sp].out, i = c[sp].in, eq = Math.abs(o - i) <= Math.max(2, 0.12 * (o + i));
      const nm = SP[sp].name;
      return p(L({
        "y7-8": `${nm} is a <strong>small</strong> molecule with no charge, so it can slip <strong>straight between the fat molecules</strong> of the membrane. No protein and no energy are needed. This is called <strong>diffusion</strong>.`,
        "y9-10": `${nm} is <strong>small and non-polar</strong>, so it dissolves straight through the middle of the bilayer — <strong>simple diffusion</strong>. No protein and no ATP needed.`,
        y11: `${nm} is <strong>small and non-polar</strong>, so it dissolves straight through the hydrophobic core of the bilayer — <strong>simple diffusion</strong>. No protein and no ATP needed.`,
      })) + p(`${nm}: <strong>${o}</strong> outside vs <strong>${i}</strong> inside. ${eq
        ? L({ "y7-8": "The two sides are about equal. Molecules still cross both ways, but the <strong>net</strong> movement is zero. This balance is called <strong>equilibrium</strong>.", "y9-10": "The two sides are about equal: molecules still cross both ways, but there is <strong>no net movement</strong> — a <strong>dynamic equilibrium</strong>.", y11: "The two sides are about equal: molecules still cross both ways, but there is <strong>no net movement</strong> — a <strong>dynamic equilibrium</strong>." })
        : L({ "y7-8": `More molecules bump into the membrane from the crowded side, so more of them cross <strong>${o > i ? "inwards" : "outwards"}</strong>. They move from where there are lots to where there are few.`, "y9-10": `More molecules hit the membrane from the crowded side, so there is net movement toward the <strong>${o > i ? "inside" : "outside"}</strong>, <em>down</em> the concentration gradient.`, y11: `More molecules hit the membrane from the crowded side, so net movement is toward the <strong>${o > i ? "inside" : "outside"}</strong>, <em>down</em> the concentration gradient, until the two sides are equal (dynamic equilibrium).` })}`);
    }
    case "h2o":
      return p(L({
        "y7-8": "Water is small but slightly charged at its ends, so only a little squeezes between the fats. Most water goes through special <strong>water channels</strong> called <strong>aquaporins</strong>. Water moving across a membrane is called <strong>osmosis</strong>.",
        "y9-10": "Water is small but <strong>polar</strong>, so only a trickle squeezes between the lipids. Most water crosses through <strong>aquaporins</strong> — channel proteins that let water through in single file. Diffusion of water across a membrane is called <strong>osmosis</strong>.",
        y11: "Water is small but <strong>polar</strong>, so only a trickle squeezes between the lipids. Most water crosses through <strong>aquaporins</strong> — channel proteins that let water molecules through in single file. Net movement of water down its concentration (water potential) gradient is <strong>osmosis</strong>.",
      })) + p(`The aquaporin is <strong>${open("aqp") ? "open" : "closed"}</strong>. H₂O: ${c.h2o.out} outside vs ${c.h2o.in} inside.${open("aqp") ? "" : " With it closed, water crosses far more slowly."}`);
    case "glc": {
      if (M.glut.blocked) return p(L({
        "y7-8": `The <strong>glucose carrier is blocked</strong>, so it can't change shape. Glucose: <strong>${c.glc.out}</strong> outside, <strong>${c.glc.in}</strong> inside — and none crosses. Glucose is too big to slip between the fats.`,
        "y9-10": `The <strong>GLUT carrier is blocked</strong> by an inhibitor, so it can't change shape. Glucose: <strong>${c.glc.out}</strong> outside vs <strong>${c.glc.in}</strong> inside — and none crosses. Glucose is too <strong>large and polar</strong> to pass through the lipid bilayer on its own.`,
        y11: `The <strong>GLUT carrier is blocked</strong> by an inhibitor, so it can't change shape. Glucose: <strong>${c.glc.out}</strong> outside vs <strong>${c.glc.in}</strong> inside — and none crosses. Glucose is too <strong>large and polar</strong> to pass through the lipid bilayer on its own.`,
      }));
      const r = H.glutInRate(), vmax = M.glutVmax(), sat = r >= 0.75 * vmax && c.glc.out >= 25;
      return p(L({
        "y7-8": "Glucose is too big to slip through the fats. The <strong>glucose carrier</strong> (a protein called GLUT) grabs one glucose, <strong>changes shape</strong> and lets it go on the other side. It needs no energy: glucose goes from where there is a lot to where there is less. This is <strong>facilitated diffusion</strong>.",
        "y9-10": "Glucose is too <strong>large and polar</strong> to cross the lipid core. The <strong>GLUT carrier</strong> binds one glucose, <strong>changes shape</strong> and releases it on the other side — <strong>facilitated diffusion</strong>. It works both ways, so the net movement is always <em>down</em> the gradient, and no ATP is used.",
        y11: "Glucose is too <strong>large and polar</strong> to cross the lipid core. The <strong>GLUT carrier</strong> binds one glucose, <strong>changes shape</strong> and releases it on the other side — <strong>facilitated diffusion</strong>. It works both ways, so the net movement is always <em>down</em> the gradient, and no ATP is used.",
      })) + p(`Glucose: <strong>${c.glc.out}</strong> outside vs <strong>${c.glc.in}</strong> inside. ${L({ "y7-8": "", "y9-10": "", y11: `GLUT is carrying <strong>${r.toFixed(1)}</strong> glucose/s inward (maximum ≈ ${vmax.toFixed(1)}/s).${sat ? " It is <strong>saturated</strong>: every cycle is full, so adding more glucose can't make it faster." : ""}` })}`) + y12(lens, "carrier");
    }
    case "na": case "k": case "pump": {
      const st = M.pumpStatus(), stalled = M.pump.waiting;
      return p(L({
        "y7-8": "The <strong>sodium–potassium pump</strong> is a tiny machine that uses <strong>energy (ATP)</strong> to push <strong>sodium (Na⁺)</strong> out of the cell and pull <strong>potassium (K⁺)</strong> in. It moves them <em>uphill</em>, from where there are few to where there are lots. This is <strong>active transport</strong>.",
        "y9-10": "The <strong>Na⁺/K⁺ pump</strong> does <strong>active transport</strong>. Each cycle it grabs <strong>3 Na⁺</strong> from inside, uses <strong>ATP</strong>, changes shape and lets the Na⁺ go outside, then grabs <strong>2 K⁺</strong> from outside and carries them in. Both ions move <em>against</em> their gradients.",
        y11: "The <strong>Na⁺/K⁺ pump</strong> carries out <strong>active transport</strong>. Each cycle it binds <strong>3 Na⁺</strong> inside, splits <strong>ATP → ADP + Pᵢ</strong>, changes shape, releases the Na⁺ outside, then binds <strong>2 K⁺</strong> outside and carries them in. Both ions move <em>against</em> their gradients.",
      })) + p(`Pump now: <strong>${st}</strong>.${stalled ? L({ "y7-8": " With no ATP it can't change shape, so it has <strong>stopped</strong>.", "y9-10": " With no ATP it can't change shape, so it has <strong>stopped</strong>.", y11: " With no ATP it can't change shape, so it has <strong>stopped</strong>." }) : ""} Na⁺ is ${ratio(c.na.out, c.na.in)} more concentrated outside (${c.na.out} vs ${c.na.in}); K⁺ is ${ratio(c.k.in, c.k.out)} more concentrated inside (${c.k.in} vs ${c.k.out}).`) + y12(lens, "pump");
    }
    case "kch": case "nach": {
      const isK = focus === "kch", sp = isK ? "k" : "na", P = M.byId[focus];
      return p(L({
        "y7-8": `The <strong>${P.name}</strong> is a protein with a tiny tunnel through the middle. Only ${SP[sp].name} fits through. Charged particles (ions) can't slip between the fats, so they need a tunnel or a pump. A channel needs no energy: ions flow downhill, ${isK ? "mostly <strong>out</strong> of the cell" : "mostly <strong>into</strong> the cell"}.`,
        "y9-10": `The <strong>${P.name}</strong> is a protein with a water-filled pore that lets ${SP[sp].name} through but not ${isK ? "Na⁺" : "K⁺"}. Ions are <strong>charged</strong>, so they can't cross the lipid core — they need channels. Channels are <strong>passive</strong>: ions flow <em>down</em> their gradient, ${isK ? "mostly <strong>out</strong> of the cell" : "mostly <strong>into</strong> the cell"}.`,
        y11: `The <strong>${P.name}</strong> is a protein with a water-filled pore. Its <strong>selectivity filter</strong> lets ${SP[sp].name} through but not ${isK ? "Na⁺" : "K⁺"}. Ions are <strong>charged</strong>, so they can't cross the hydrophobic lipid core — they need channels. Channels are <strong>passive</strong>: ions flow <em>down</em> their gradient, ${isK ? "mostly <strong>out</strong> of the cell" : "mostly <strong>into</strong> the cell"}.`,
      })) + p(`This channel is <strong>${P.open ? "open" : "closed"}</strong> (it is <strong>gated</strong> — tap it to switch). ${SP[sp].name}: ${c[sp].out} outside vs ${c[sp].in} inside.`) + y12(lens, "channel");
    }
    case "cyanide":
      if (!M.cyanide) return p(`Cyanide removed — the mitochondria can make ATP again (${Math.floor(M.atp)} ATP available), so the pump can rebuild the Na⁺ and K⁺ gradients.`);
      return p(L({
        "y7-8": `<strong>Cyanide</strong> is a poison that blocks the cell's energy-making machinery. In this model it switches off the ATP supply. ATP left: <strong>${Math.floor(M.atp)}</strong>.`,
        "y9-10": `<strong>Cyanide</strong> inhibits aerobic respiration in the mitochondria. This model represents that by switching off its ATP supply. ATP left: <strong>${Math.floor(M.atp)}</strong>.`,
        y11: `<strong>Cyanide</strong> inhibits complex IV of the electron transport chain; this model represents that by switching off its ATP supply (in a real cell glycolysis still makes a little ATP, and plants often have a cyanide-resistant alternative oxidase). ATP left: <strong>${Math.floor(M.atp)}</strong>.`,
      })) + p(`${M.atp < 1 ? "The ATP has run out and the pump has <strong>stopped</strong>. Na⁺ and K⁺ keep leaking through their channels down their gradients, so the gradients <strong>run down</strong>. Passive transport (O₂, glucose, water) carries on as normal." : "The pump keeps working until the remaining ATP is used up — the rest of the cell is using ATP too."} Na⁺ outside:inside = ${ratio(c.na.out, c.na.in)}.`);
    case "atp":
      return p(`ATP is made by <strong>cellular respiration</strong>. Production is set to <strong>${Math.round(M.atpProd * 100)} %</strong>${M.cyanide ? " — but cyanide is blocking it" : ""}; ${Math.floor(M.atp)} ATP available.`) + p(L({
        "y7-8": "Only the <strong>pump</strong> and the <strong>bubbles (vesicles)</strong> use ATP. Changing the energy supply does <strong>not</strong> change diffusion or the glucose carrier.",
        "y9-10": "Only <strong>active</strong> processes (the Na⁺/K⁺ pump, vesicle transport) use ATP. Changing the ATP supply does <strong>not</strong> change simple or facilitated diffusion.",
        y11: "Only <strong>active</strong> processes (the Na⁺/K⁺ pump, vesicle transport) use ATP. Changing the ATP supply does <strong>not</strong> change simple or facilitated diffusion.",
      }));
    case "temp": {
      const dF = M.dF, kF = M.kF;
      let extra = "";
      if (T > 42) extra = L({ "y7-8": " Above about 42 °C the proteins start to <strong>lose their shape</strong> (denature), and the pump and carrier slow right down.", "y9-10": " Above about 42 °C proteins begin to <strong>denature</strong> — the pump and carrier lose their shape and slow down.", y11: " Above about 42 °C proteins begin to <strong>denature</strong> — the pump and carrier lose their shape and slow right down. (In real cells this damage is often permanent.)" });
      else if (T < 15) extra = L({ "y7-8": " In the cold, the pump and carrier slow down a lot.", "y9-10": " In the cold, the pump and carrier slow down a lot — transport proteins depend on temperature.", y11: " In the cold, the pump and carrier slow down a lot — enzymes and transport proteins depend on temperature." });
      return p(L({
        "y7-8": `Temperature: <strong>${T} °C</strong>. Warmer particles move faster, so diffusion is faster.${extra}`,
        "y9-10": `Temperature: <strong>${T} °C</strong>. Warmer particles have more <strong>kinetic energy</strong>, so diffusion is faster: here it runs at <strong>${dF.toFixed(2)}×</strong> its 37 °C rate. Transport proteins are at <strong>${kF.toFixed(2)}×</strong>.${extra}`,
        y11: `Temperature: <strong>${T} °C</strong>. Warmer particles have more <strong>kinetic energy</strong>, so diffusion is faster: here it runs at <strong>${dF.toFixed(2)}×</strong> its 37 °C rate. Transport proteins are at <strong>${kF.toFixed(2)}×</strong>.${extra}`,
      }));
    }
    case "prot": return protText(M, c, lens);
    case "endo": case "exo": return vesText(M, lens, focus);
    default:
      return p(L({
        "y7-8": "This is a <strong>cell membrane</strong>: two layers of fat molecules with proteins stuck in them. The <strong>top</strong> is outside the cell; the <strong>bottom</strong> is inside. The membrane is a <strong>gatekeeper</strong>. Some things slip through, others need a protein door or a pump.",
        "y9-10": "This is a <strong>cell membrane</strong>: a phospholipid bilayer with proteins embedded in it. Outside (top) is extracellular fluid; inside (bottom) is cytoplasm.",
        y11: "This is a <strong>cell membrane</strong>: a phospholipid bilayer with proteins embedded in it (the <strong>fluid mosaic</strong> model). Outside (top) is extracellular fluid; inside (bottom) is cytoplasm.",
      })) + p(L({
        "y7-8": "<strong>Passive transport</strong> needs no energy: things drift from where there are lots to where there are few. <strong>Active transport</strong> uses energy (ATP) to move things the other way. Tap any molecule or protein to explore.",
        "y9-10": "<strong>Passive transport</strong> (diffusion, facilitated diffusion, osmosis) moves substances <em>down</em> their concentration gradient with no ATP. <strong>Active transport</strong> uses ATP to move them <em>against</em> it. Tap any molecule or protein to explore.",
        y11: "<strong>Passive transport</strong> (diffusion, facilitated diffusion, osmosis) moves substances <em>down</em> their concentration gradient with no ATP. <strong>Active transport</strong> uses ATP to move them <em>against</em> it. Surface area, concentration gradient and the size and polarity of a molecule all affect how fast it crosses. Tap any molecule or protein to explore.",
      })) + y12(lens, "intro");
  }
}

function protText(M, c, lens) {
  return p(lens.pick({
    "y7-8": "Big proteins are far too large for any channel or carrier. The cell moves them in <strong>bubbles</strong> called <strong>vesicles</strong>. <strong>Endocytosis</strong> brings things in; <strong>exocytosis</strong> sends things out. Both use energy (ATP). Try the buttons in the panel.",
    "y9-10": "Large proteins are far too big for any channel or carrier. Cells move them in bulk inside <strong>vesicles</strong>: <strong>endocytosis</strong> brings material in, <strong>exocytosis</strong> secretes it out. Both are <strong>active</strong> and need ATP. Try the vesicle buttons in the panel.",
    y11: "Large proteins are far too big for any channel or carrier. Cells move them in bulk inside <strong>vesicles</strong>: <strong>endocytosis</strong> brings material in, <strong>exocytosis</strong> secretes it out. Both are <strong>active</strong> and need ATP. Try the vesicle buttons in the panel.",
  })) + p(`Large proteins: ${c.prot.out} outside vs ${c.prot.in} inside.`);
}

function vesText(M, lens, focus) {
  const V = M.ves, ph = V.phase, L = (v) => lens.pick(v), plant = M.plant;
  if (ph === "none") {
    if (focus === "endo") {
      return p(plant
        ? L({ "y7-8": "The bubble has finished. In a plant cell the bubble is sorted and then taken to the big <strong>vacuole</strong>, which breaks down what is inside. Some of its membrane is recycled.", "y9-10": "The vesicle has finished. In plants, endocytic vesicles go to <strong>endosomes</strong> for sorting, then cargo is sent to the <strong>vacuole</strong> to be broken down, and some membrane and proteins are recycled to the surface.", y11: "The vesicle has finished. In plants, endocytic vesicles fuse with <strong>endosomes</strong> (the trans-Golgi network acts as an early endosome); cargo marked for degradation goes on to the <strong>lytic vacuole</strong> (the plant's lysosome equivalent), while other membrane proteins are <strong>recycled</strong> back to the plasma membrane." })
        : L({ "y7-8": "The bubble has finished. In endocytosis the bubble is usually taken to a <strong>lysosome</strong>, which breaks down what is inside.", "y9-10": "The vesicle has finished. In endocytosis, the vesicle's contents are usually delivered to a <strong>lysosome</strong> to be digested.", y11: "The vesicle has finished. In endocytosis, the vesicle's contents are usually delivered via endosomes to a <strong>lysosome</strong> to be digested; the membrane is recycled." }));
    }
    return p(L({ "y7-8": `The bubble has finished. The bubble's skin has joined the cell membrane and its contents are now outside — this is how cells <strong>send out</strong> things like ${plant ? "cell wall materials and enzymes" : "hormones and enzymes"}.`, "y9-10": `The vesicle has finished. In exocytosis, the vesicle membrane becomes part of the cell membrane and its contents are released outside — this is how cells <strong>secrete</strong> ${plant ? "cell wall materials and enzymes" : "hormones and enzymes"}.`, y11: `The vesicle has finished. In exocytosis, the vesicle membrane becomes part of the plasma membrane and its contents are released outside — this is how cells <strong>secrete</strong> ${plant ? "cell wall polysaccharides and proteins (Golgi vesicles)" : "hormones and enzymes"}.` }));
  }
  const steps = {
    dip: "The membrane folds <strong>inward</strong>, wrapping around large molecules outside.",
    close: "The pocket deepens and its neck narrows…",
    away: "The membrane <strong>pinches off</strong> to form a vesicle that carries the cargo into the cytoplasm.",
    come: "A <strong>vesicle</strong> full of proteins (made at the ER and Golgi) moves to the membrane.",
    open: "The vesicle <strong>fuses</strong> with the cell membrane and opens to the outside, releasing its contents.",
    flat: "The vesicle membrane flattens out and becomes part of the cell membrane.",
  };
  return p(`<strong>${focus === "endo" ? "Endocytosis" : "Exocytosis"}</strong> — bulk transport using ATP. ${steps[ph] || ""}`);
}

/** The pump normally keeps the inside negative. If the student has switched it off (or the potential has run down), say so instead of claiming it. */
function offNote(M, lens) {
  const off = M.pump.blocked || M.cyanide || M.atpProd === 0 || M.vmAvg > -10;
  if (!off) return "";
  const vm = Math.round(M.vmAvg);
  return p(lens.pick({
    "y7-8": "<strong>Right now</strong> the pump is off or has run down, so the inside of the cell is <strong>no longer very negative</strong>. The pull on charged particles is weak.",
    "y9-10": `<strong>Right now</strong> the H⁺ pump is off or has run down, so the membrane potential is only about ${vm} mV: the inside is not strongly negative and the pull on charged particles is weak.`,
    y11: `<strong>Right now</strong> the pump is off or the potential has run down (Vm ≈ ${vm} mV), so the inside is <em>not</em> strongly negative: K⁺ is no longer pulled in, and nitrate is no longer repelled much.`,
  }));
}

function plantFocus(M, c, lens, focus, H) {
  const L = (v) => lens.pick(v), T = M.temp, open = (id) => M.byId[id].open;
  const vm = Math.round(M.vmAvg), dpH = M.dpH, gradTxt = `H⁺ is ${ratio(c.h.out, c.h.in)} more concentrated outside (${c.h.out} vs ${c.h.in}; ΔpH ≈ ${dpH.toFixed(1)})`;
  switch (focus) {
    case "o2": case "co2": return animalFocus(M, c, lens, focus, H);
    case "h2o": return animalFocus(M, c, lens, focus, H);
    case "prot": return protText(M, c, lens);
    case "endo": case "exo": return vesText(M, lens, focus);
    case "temp": return animalFocus(M, c, lens, "temp", H).replace("the pump and carrier", "the pump and carriers");
    case "h": case "hpump": {
      const st = M.pumpStatus();
      return p(L({
        "y7-8": "The <strong>proton pump</strong> is a tiny machine in the membrane. It uses <strong>energy (ATP)</strong> to push tiny acid particles called <strong>H⁺</strong> out of the cell. Think of it like pumping water uphill into a tank: the crowd of H⁺ outside is stored energy. Other carriers use that energy to pull things in.",
        "y9-10": "The <strong>H⁺ pump (H⁺-ATPase)</strong> is the plant cell's main <strong>active transport</strong> protein. It uses <strong>ATP</strong> to push <strong>H⁺</strong> out through the membrane. That makes the outside <strong>acidic</strong> and the inside <strong>negative</strong>, a store of energy for other carriers.",
        y11: "The <strong>P-type H⁺-ATPase</strong> is the plant cell's main pump. Each cycle it binds <strong>one H⁺</strong> inside, is <strong>phosphorylated by ATP</strong> (ATP → ADP + Pᵢ; the \"P\" in P-type), changes shape, releases the H⁺ <strong>outside</strong>, then loses the phosphate and resets: <strong>1 ATP → 1 H⁺</strong>. It moves positive charge out (it is <strong>electrogenic</strong>), so it builds a H⁺ concentration gradient <em>and</em> a <strong>membrane potential</strong> with the inside negative. Together these form the <strong>proton-motive force</strong>.",
      })) + p(`Pump now: <strong>${st}</strong>.${M.pump.waiting ? " With no ATP it can't change shape, so it has <strong>stopped</strong>." : ""} ${gradTxt}.${lens.atLeast("y9-10") ? ` Membrane potential ≈ <strong>${vm} mV</strong> (inside negative).` : ""}`) + p(L({
        "y7-8": "Real plant cells make the outside about <strong>100 times</strong> more acidic than the inside. Here the numbers are smaller, to keep the model simple.",
        "y9-10": "Real plant cell walls are about <strong>1.5–2 pH units</strong> more acidic than the cytoplasm (30–100× more H⁺), and the inside is about −120 to −200 mV. The model uses smaller numbers.",
        y11: `Proton-motive force Δp = Vm − ${(M.rtf * Math.LN10).toFixed(0)}·ΔpH (mV; RT/F·ln10 at ${T} °C). Now: ${vm} − ${(M.rtf * Math.LN10).toFixed(0)} × ${dpH.toFixed(1)} ≈ <strong>${Math.round(M.pmf)} mV</strong>. A real plant cell has pH ≈ 5.5 outside and ≈ 7.3 inside (ΔpH ≈ 1.8, worth about −110 mV) and Vm ≈ −120 to −200 mV, so Δp ≈ −230 to −310 mV. The model is teaching-scale.`,
      })) + y12(lens, "pump");
    }
    case "suc": {
      const S = M.sym.suc;
      if (S.blocked) return p(L({
        "y7-8": `The <strong>sugar carrier is blocked</strong>, so sucrose can't get in. Sucrose: <strong>${c.suc.out}</strong> outside, <strong>${c.suc.in}</strong> inside. Sucrose is too big to slip between the fats.`,
        "y9-10": `The <strong>H⁺–sucrose symporter is blocked</strong> by an inhibitor, so sucrose can't cross. Sucrose: <strong>${c.suc.out}</strong> outside vs <strong>${c.suc.in}</strong> inside. It is too <strong>large and polar</strong> to cross the bilayer alone.`,
        y11: `The <strong>H⁺–sucrose symporter is blocked</strong> (as by the inhibitor PCMBS), so sucrose can't cross. Sucrose: <strong>${c.suc.out}</strong> outside vs <strong>${c.suc.in}</strong> inside. It is too <strong>large and polar</strong> to cross the bilayer alone.`,
      }));
      const r = M.rate("suc", "suc", 8);
      return p(L({
        "y7-8": "Sucrose (plant sugar) is too big to slip through the fats. The <strong>sugar carrier</strong> only works when an <strong>H⁺</strong> comes along too. The H⁺ are rushing back in (they were pumped out), and they drag the sugar in with them. So the pump's energy is used <strong>indirectly</strong>.",
        "y9-10": "Sucrose is too <strong>large and polar</strong> to cross the lipids. The <strong>H⁺–sucrose symporter</strong> carries <strong>1 H⁺ and 1 sucrose</strong> in together. The H⁺ are flowing back <em>down</em> the gradient the pump built, and this lets the cell pull sucrose in even when there is more inside. This is <strong>secondary active transport</strong>: no ATP at the carrier itself.",
        y11: `Sucrose is too <strong>large and polar</strong> to cross the lipids. The <strong>H⁺–sucrose symporter</strong> binds <strong>1 H⁺ + 1 sucrose</strong> and changes shape (alternating access) only when both are bound. The H⁺ move <em>down</em> their electrochemical gradient, which drives sucrose in <em>against</em> its own gradient: <strong>secondary active transport</strong> (cotransport). The ATP is used by the pump, not by the carrier.`,
      })) + p(`Sucrose: <strong>${c.suc.out}</strong> outside vs <strong>${c.suc.in}</strong> inside${lens.atLeast("y9-10") ? ` (symporter net ${r >= 0 ? "in" : "out"}: ${Math.abs(r).toFixed(1)}/s)` : ""}. ${gradTxt}${lens.atLeast("y11") ? `; Vm ≈ ${vm} mV` : ""}.`) + (lens.atLeast("y11") ? p(`At steady state the ratio [sucrose]<sub>in</sub>/[sucrose]<sub>out</sub> can reach ([H⁺]<sub>out</sub>/[H⁺]<sub>in</sub>) × e<sup>−Vm/(RT/F)</sup>. With ΔpH = ${dpH.toFixed(1)} and Vm = ${vm} mV that is up to ≈ <strong>${Math.round(Math.pow(10, dpH) * Math.exp(-M.vmAvg / M.rtf))}×</strong>.`) : "") + y12(lens, "carrier");
    }
    case "no3": case "nit": {
      const S = M.sym.nit;
      if (S.blocked) return p(`The <strong>${L({ "y7-8": "nitrate carrier", "y9-10": "H⁺–nitrate symporter" })} is blocked</strong>, so nitrate can't get in. NO₃⁻: <strong>${c.no3.out}</strong> outside vs <strong>${c.no3.in}</strong> inside.`);
      return p(L({
        "y7-8": "Nitrate (NO₃⁻) is a mineral plants need to make proteins. It has a <strong>negative charge</strong> and the inside of the cell is also negative, so it is pushed away. The <strong>nitrate carrier</strong> solves this by bringing in <strong>2 H⁺</strong> with each nitrate. The H⁺ rushing in give the energy.",
        "y9-10": "Nitrate (NO₃⁻) is needed to make amino acids. It is <strong>negatively charged</strong> and the inside of the cell is negative, so it is pushed away. The <strong>H⁺–nitrate symporter</strong> carries <strong>about 2 H⁺ with each NO₃⁻</strong>, and the H⁺ flowing in <em>down</em> their gradient give the energy. This is <strong>secondary active transport</strong>.",
        y11: "Nitrate (NO₃⁻) is the main nitrogen source for most plants. It is an <strong>anion</strong>, so the negative inside of the cell repels it. The <strong>H⁺–nitrate symporter</strong> (NRT type) moves about <strong>2 H⁺ per NO₃⁻</strong>, so each cycle carries a net <em>positive</em> charge inward. Moving 2 H⁺ down their electrochemical gradient pays for the uphill movement of nitrate: <strong>secondary active transport</strong>.",
      })) + p(`NO₃⁻: <strong>${c.no3.out}</strong> outside vs <strong>${c.no3.in}</strong> inside. ${gradTxt}.`) + (lens.atLeast("y11") ? p(`Steady state: [NO₃⁻]<sub>in</sub>/[NO₃⁻]<sub>out</sub> ≈ ([H⁺]<sub>out</sub>/[H⁺]<sub>in</sub>)² × e<sup>−Vm/(RT/F)</sup> — the squared term is why 2 H⁺ per nitrate gives a much steeper accumulation than 1 H⁺ per sucrose.`) : "") + offNote(M, lens) + y12(lens, "carrier");
    }
    case "k": case "kch": {
      const P = M.byId.kch;
      return p(L({
        "y7-8": "The <strong>K⁺ channel</strong> is a protein tunnel that only lets potassium through. It needs no energy. The inside of the cell has a <strong>negative charge</strong> (made by the pump), and K⁺ is positive, so K⁺ is <strong>pulled in</strong>.",
        "y9-10": "The <strong>K⁺ channel</strong> is a protein pore that lets only potassium through, and it is <strong>passive</strong>. The pump makes the inside of the cell <strong>negative</strong>, and K⁺ is positive, so it is pulled in even when there is already more inside.",
        y11: `The <strong>K⁺ channel</strong> (an inward-rectifying type, like AKT1) has a selectivity filter and is <strong>gated</strong>. It is <strong>passive</strong>, but K⁺ flows down its <strong>electrochemical gradient</strong>, which combines the concentration gradient with the <strong>negative membrane potential</strong> made by the H⁺ pump. A potential of −120 mV can hold K⁺ about ${Math.round(Math.exp(120 / M.rtf))}× more concentrated inside than outside at equilibrium (Nernst: E<sub>K</sub> = ${(M.rtf * Math.LN10).toFixed(0)}·log([K⁺]<sub>out</sub>/[K⁺]<sub>in</sub>) mV).`,
      })) + p(`This channel is <strong>${P.open ? "open" : "closed"}</strong> (tap it to switch). K⁺: ${c.k.out} outside vs ${c.k.in} inside${lens.atLeast("y9-10") ? `; membrane potential ≈ ${vm} mV` : ""}.`) + offNote(M, lens) + y12(lens, "channel");
    }
    case "cyanide":
      if (!M.cyanide) return p(`Cyanide removed — the mitochondria can make ATP again (${Math.floor(M.atp)} ATP available), so the pump can rebuild the H⁺ gradient.`);
      return p(L({
        "y7-8": `<strong>Cyanide</strong> is a poison that blocks the cell's energy-making machinery. In this model it switches off the ATP supply. ATP left: <strong>${Math.floor(M.atp)}</strong>.`,
        "y9-10": `<strong>Cyanide</strong> inhibits respiration in the mitochondria. This model represents that by switching off its ATP supply. ATP left: <strong>${Math.floor(M.atp)}</strong>.`,
        y11: `<strong>Cyanide</strong> inhibits complex IV of the electron transport chain; this model represents that by switching off its ATP supply (glycolysis would still make a little ATP, and many plants have a cyanide-resistant alternative oxidase). ATP left: <strong>${Math.floor(M.atp)}</strong>.`,
      })) + p(M.atp < 1
        ? `The ATP has run out and the H⁺ pump has <strong>stopped</strong>. H⁺ leak back in, so the gradient and the negative charge <strong>run down</strong>. Then the carriers have no push left and sugar and nitrate uptake <strong>slows and stops</strong>. ${gradTxt}.`
        : `The pump keeps working until the remaining ATP is used up. ${gradTxt}.`);
    case "vanadate":
      return p(L({
        "y7-8": M.pump.blocked ? "The <strong>proton pump is jammed</strong> by a chemical. The cell still makes energy, but the pump can't use it. Watch the H⁺ spread out, then the sugar and nitrate stop coming in." : "Pump back to normal.",
        "y9-10": M.pump.blocked ? "<strong>Vanadate</strong> blocks the H⁺ pump but not respiration, so ATP stays available. The pump stops, the H⁺ gradient runs down and the carriers that depend on it slow down." : "Vanadate washed out: the pump works again.",
        y11: M.pump.blocked ? "<strong>Orthovanadate</strong> resembles phosphate and traps P-type ATPases in a phosphorylated-like state, so the pump stops even though ATP is available. Unlike cyanide it leaves respiration alone, so the experiment shows the <em>pump</em> is what builds the proton-motive force." : "Vanadate washed out: the pump cycles again and rebuilds the gradient.",
      })) + p(`${gradTxt}; membrane potential ≈ ${vm} mV.`);
    case "atp":
      return p(`ATP is made by <strong>cellular respiration</strong>. Production is set to <strong>${Math.round(M.atpProd * 100)} %</strong>${M.cyanide ? " — but cyanide is blocking it" : ""}; ${Math.floor(M.atp)} ATP available.`) + p(L({
        "y7-8": "Only the <strong>proton pump</strong> and the <strong>bubbles (vesicles)</strong> use ATP directly. The carriers use the pump's work <strong>indirectly</strong>, so they slow down too if the energy runs out.",
        "y9-10": "Only the <strong>H⁺ pump</strong> and vesicle transport use ATP directly. The symporters depend on the pump's H⁺ gradient, so they need ATP <strong>indirectly</strong>. Simple diffusion, channels and osmosis are unaffected.",
        y11: "ATP is used <strong>directly</strong> by the H⁺-ATPase (and vesicle transport). The symporters use the proton-motive force it builds, so they depend on ATP <strong>indirectly</strong>. Simple diffusion, channels and osmosis are unaffected (K⁺ channels only feel the change in membrane potential).",
      }));
    default:
      return p(L({
        "y7-8": "This is the <strong>membrane of a plant cell</strong>: two layers of fat molecules with proteins stuck in them. The <strong>top</strong> is outside the cell (in the cell wall); the <strong>bottom</strong> is inside. A <strong>proton pump</strong> uses energy to push tiny acid particles (H⁺) out. The H⁺ then rush back in through <strong>carriers</strong> and drag sugar and nitrate in with them. Tap any molecule or protein to explore.",
        "y9-10": "This is a <strong>plant cell membrane</strong>. Its main pump, the <strong>H⁺ pump</strong>, uses ATP to push H⁺ out (<strong>active transport</strong>). The H⁺ gradient it builds then powers carriers that bring in <strong>sucrose</strong> and <strong>nitrate</strong>. Oxygen, carbon dioxide and water still cross by <strong>diffusion</strong> and <strong>osmosis</strong>. Tap any molecule or protein to explore.",
        y11: "This is a <strong>plant plasma membrane</strong>. The <strong>P-type H⁺-ATPase</strong> uses ATP to pump H⁺ out (1 H⁺ per ATP), building a <strong>proton gradient</strong> and a <strong>membrane potential</strong>. Symporters then use this proton-motive force to take in sucrose (1 H⁺) and nitrate (2 H⁺): <strong>secondary active transport</strong>. K⁺ channels and aquaporins are passive; vesicles move large cargo. Tap any molecule or protein to explore.",
      })) + y12(lens, "intro");
  }
}

// ---------- missions ----------
/** Each mission: id, band (minimum band it appears at), text by band, check(S) where S = { M, hPeak, naPeak, inRate(sp, via) }. */
export function missionList(mode) {
  if (mode === "plant") {
    return [
      { id: "p-h", text: { "y7-8": "Let the pump push H⁺ out until there are at least 3 times more H⁺ outside than inside.", "y9-10": "Build a proton gradient: let the H⁺ pump make at least 3× more H⁺ outside than inside.", y11: "Build a proton gradient: at least 3× more H⁺ outside than inside (ΔpH ≥ 0.5)." },
        check: ({ M }) => { const o = M.count("h", "out"), i = M.count("h", "in"); return o >= 12 && o >= 3 * Math.max(1, i) && M.pump.cycles >= 3; } },
      { id: "p-suc", text: { "y7-8": "Bring 8 sugar particles (sucrose) into the cell through the sugar carrier.", "y9-10": "Move 8 sucrose into the cell through the H⁺–sucrose symporter.", y11: "Move a net 8 sucrose into the cell through the H⁺–sucrose symporter." },
        check: ({ M }) => M.cross.suc.in - M.cross.suc.out >= 8 },
      { id: "p-stop", text: { "y7-8": "Switch the pump off (poison or jam it) and watch the H⁺ spread out evenly again.", "y9-10": "Switch the H⁺ pump off (cyanide, 0 % ATP or vanadate) and let the H⁺ gradient run down below 1.5× outside.", y11: "After building the gradient, stop the pump (cyanide, 0 % ATP or vanadate) and let [H⁺] outside fall below 1.5× inside." },
        check: ({ M, hPeak }) => hPeak && (M.cyanide || M.atpProd === 0 || M.pump.blocked) && M.count("h", "out") <= 1.5 * Math.max(1, M.count("h", "in")) },
      { id: "p-no3", band: "y9-10", text: { "y9-10": "Move 6 nitrate ions into the cell through the H⁺–nitrate symporter.", y11: "Move a net 6 NO₃⁻ into the cell, against the negative membrane potential, using the H⁺–nitrate symporter." },
        check: ({ M }) => M.cross.no3.in - M.cross.no3.out >= 6 },
      { id: "p-acc", band: "y11", text: { y11: "Make the cell accumulate sucrose: at least 3× more sucrose inside than outside, using only the proton gradient.", y12: "Make the cell accumulate sucrose: at least 3× more inside than outside (secondary active transport, no ATP at the carrier). Then check the ratio against ([H⁺]out/[H⁺]in) × e^(−Vm/(RT/F))." },
        check: ({ M }) => { const o = M.count("suc", "out"), i = M.count("suc", "in"); return o + i >= 10 && i >= 3 * Math.max(1, o); } },
      { id: "p-k", band: "y11", text: { y11: "Show that K⁺ can enter against its concentration gradient: get K⁺ more than 2× more concentrated inside than outside through the open K⁺ channel." },
        check: ({ M }) => { const o = M.count("k", "out"), i = M.count("k", "in"); return o + i >= 20 && i >= 2 * Math.max(1, o) && M.byId.kch.open; } },
    ];
  }
  return [
    { id: "a-o2", text: { "y7-8": "Let oxygen (O₂) spread out until the inside and outside have about the same amount.", "y9-10": "Let O₂ diffuse until inside and outside are equal (dynamic equilibrium).", y11: "Let O₂ diffuse until inside and outside are equal (dynamic equilibrium)." },
      check: ({ M }) => { const c = M.count("o2", "out"), i = M.count("o2", "in"); return c + i >= 8 && Math.abs(c - i) <= Math.max(2, 0.12 * (c + i)) && M.cross.o2.in + M.cross.o2.out >= 8; } },
    { id: "a-glut", text: { "y7-8": "Get 8 glucose into the cell through the glucose carrier.", "y9-10": "Move 8 glucose into the cell by facilitated diffusion through GLUT.", y11: "Move 8 glucose into the cell by facilitated diffusion through GLUT." },
      check: ({ M }) => M.cross.glc.glutIn - M.cross.glc.glutOut >= 8 },
    { id: "a-block", text: { "y7-8": "Block the glucose carrier for 8 seconds while one side has more glucose. Does any get across by itself?", "y9-10": "Prove glucose can't cross the bare bilayer: block GLUT for 8 s while one side has 6+ more glucose.", y11: "Prove glucose can't cross the bare bilayer: block GLUT for 8 s while one side has 6+ more glucose." },
      check: ({ M }) => M.glut.blockedTime >= 8 && Math.abs(M.count("glc", "out") - M.count("glc", "in")) >= 6 },
    { id: "a-na", text: { "y7-8": "Use the pump to push lots of sodium (Na⁺) outside: at least 3 times more outside than inside.", "y9-10": "Build a steep Na⁺ gradient: at least 3× more Na⁺ outside than inside.", y11: "Build a steep Na⁺ gradient: at least 3× more Na⁺ outside than inside." },
      check: ({ M }) => { const o = M.count("na", "out"), i = M.count("na", "in"); return o >= 12 && o >= 3 * Math.max(1, i); } },
    { id: "a-cut", band: "y9-10", text: { "y9-10": "After building the gradient, cut off ATP (cyanide or 0 %) and let Na⁺ run down below 1.5× outside.", y11: "After building the gradient, cut off ATP (cyanide or 0 %) and let Na⁺ run down below 1.5× outside." },
      check: ({ M, naPeak }) => naPeak && (M.cyanide || M.atpProd === 0) && M.atp < 1 && M.count("na", "out") <= 1.5 * M.count("na", "in") },
    { id: "a-sat", band: "y11", text: { y11: "Saturate GLUT: with 35+ glucose outside, push its uptake to at least 75 % of its maximum rate." },
      check: ({ M, inRate }) => !M.glut.blocked && M.count("glc", "out") >= 35 && inRate("glc", "glut") >= 0.75 * M.glutVmax() },
  ];
}

// ---------- quiz ----------
const q = (qq, options, answer, why) => ({ q: qq, options, answer, why });

export function quizList(mode, band) {
  const plant = mode === "plant";
  const y78 = band === "y7-8", y910 = band === "y9-10", y12b = band === "y12";
  if (!plant) {
    if (y78) return [
      q("Which of these can slip <strong>straight through</strong> the cell membrane without any help?", ["Oxygen (a small molecule)", "Sodium ions", "A large protein", "Glucose"], 0, "Small molecules with no charge, like oxygen and carbon dioxide, slip between the fat molecules. Ions, glucose and proteins need a protein door, a pump or a bubble."),
      q("What does a <strong>pump</strong> in the cell membrane need to work?", ["Energy (ATP)", "Nothing, it is free", "Sunlight", "Cold weather"], 0, "Pumps do <strong>active transport</strong>: they push things the hard way, from few to lots, so they need energy from ATP."),
      q("Glucose gets into cells through special protein doors. What are they called?", ["Carrier proteins", "Bubbles (vesicles)", "Fat molecules", "Nuclei"], 0, "A <strong>carrier</strong> grabs a glucose, changes shape and lets it go on the other side. It needs no energy."),
      q("In this model, cyanide (a poison) switches off the cell's ATP supply. What happens to the pump?", ["It stops working", "It works faster", "It does not change", "It turns into a channel"], 0, "The pump needs ATP. With no ATP it stops, and the sodium slowly leaks back in through its channels."),
    ];
    const set = [
      q("Which of these processes uses ATP <strong>directly</strong>?", ["Simple diffusion of O₂ through the lipids", "Facilitated diffusion of glucose through GLUT", "The Na⁺/K⁺ pump moving Na⁺ out", "Osmosis through aquaporins"], 2, "Only <strong>active transport</strong> moves a substance against its concentration gradient, and that needs energy from ATP hydrolysis. Diffusion, facilitated diffusion and osmosis are passive."),
      q("Why can't Na⁺ and K⁺ cross the phospholipid bilayer by simple diffusion?", ["They are too large", "They are charged, so the hydrophobic (non-polar) core of the bilayer blocks them", "They can only move when ATP is present", "The bilayer has no gaps of any kind"], 1, "Ions are tiny but <strong>charged</strong> and surrounded by water molecules. The fatty-acid tails in the middle of the bilayer are non-polar, so ions need a channel or a pump."),
    ];
    if (!y910) set.push(q("In one cycle, the Na⁺/K⁺ pump uses one ATP to move…", ["2 Na⁺ out and 3 K⁺ in", "3 Na⁺ out and 2 K⁺ in", "3 Na⁺ in and 2 K⁺ out", "1 Na⁺ out for every K⁺ in"], 1, "<strong>3 Na⁺ out, 2 K⁺ in per ATP</strong> — both against their gradients. This keeps Na⁺ high outside and K⁺ high inside."));
    set.push(
      q("A student keeps adding glucose outside, but the uptake rate through GLUT stops increasing. Why?", ["Glucose becomes toxic at high concentration", "The carriers are all busy binding and changing shape — they are saturated", "The cell has run out of ATP", "The glucose gradient has reversed"], 1, "Each carrier has to bind a molecule and change shape, so there is a <strong>maximum rate</strong>. Once every carrier is busy, more glucose can't speed things up. Simple diffusion doesn't level off like this."),
      q("Cyanide inhibits complex IV, and the model represents this by switching off ATP production. What happens to the Na⁺ gradient over time?", ["It becomes steeper", "It stays the same", "It runs down as Na⁺ leaks in through channels and nothing pumps it back out", "Na⁺ starts diffusing straight through the lipids"], 2, "Without ATP the pump stops, but leak channels still let Na⁺ diffuse <strong>down</strong> its gradient into the cell, so the gradient collapses."),
      q("Which substance crosses the membrane by simple diffusion straight through the lipid bilayer?", ["Glucose", "K⁺", "O₂", "A large protein"], 2, "O₂ (and CO₂) are <strong>small and non-polar</strong>, so they dissolve through the lipid core. Glucose needs a carrier, K⁺ needs a channel or pump, and large proteins need vesicles."),
    );
    if (!y910) set.push(q("How does <strong>facilitated diffusion</strong> differ from <strong>active transport</strong>?", ["Facilitated diffusion needs ATP, active transport does not", "Facilitated diffusion uses a protein but moves substances down their gradient with no ATP; active transport moves them against it using energy", "Only active transport uses a protein", "Facilitated diffusion moves substances against their gradient"], 1, "Both use membrane proteins. The difference is direction and energy: facilitated diffusion is <strong>passive</strong> (down the gradient), active transport is <strong>against</strong> the gradient and needs energy."));
    if (y12b) set.push(q("A point mutation in the gene for a transport protein changes one amino acid in its binding site. Which is the best prediction?", ["The protein may bind its substrate less well or not at all, because its shape (tertiary structure) has changed", "Nothing: proteins are not affected by single amino acid changes", "The protein will move substances against the gradient without ATP", "The lipid bilayer will start passing the substance"], 0, "The amino acid sequence determines the protein's folding and its binding site. A substitution there can alter or stop transport, as in cystic fibrosis (CFTR chloride channel)."));
    return set;
  }
  // plant
  if (y78) return [
    q("The proton pump pushes tiny acid particles (H⁺) out of a plant cell. What does it need to work?", ["Energy (ATP)", "Nothing, it is free", "Cold weather", "Only water"], 0, "A pump moves things the hard way, so it needs energy from ATP."),
    q("Sugar (sucrose) is too big to slip through the membrane. How does it get in?", ["Through a carrier protein, helped by H⁺ rushing in", "By squeezing between the fat molecules", "It can't — plants never take in sugar", "Through the nucleus"], 0, "The carrier brings an H⁺ and a sucrose in together. The H⁺ rushing back in gives the energy."),
    q("What happens to sugar uptake if the proton pump stops?", ["It slows down and stops, because the H⁺ push fades away", "It gets faster", "Nothing changes", "Sugar rushes out"], 0, "The carriers rely on the crowd of H⁺ outside. With no pump, the H⁺ spread out and the carriers lose their energy."),
    q("Water moves quickly into plant cells through special channels. What are they called?", ["Aquaporins", "Vesicles", "Chloroplasts", "Ribosomes"], 0, "<strong>Aquaporins</strong> are protein channels for water. Water moving across a membrane is called osmosis."),
  ];
  if (!y12b && band !== "y11") return [ // y9-10
    q("Which of these uses ATP <strong>directly</strong>?", ["Diffusion of O₂ through the lipids", "Osmosis through aquaporins", "The H⁺ pump moving H⁺ out", "K⁺ moving through a channel"], 2, "Only the pump splits ATP. Diffusion, osmosis and channels are passive."),
    q("Why does a plant cell pump H⁺ out?", ["To build an H⁺ gradient that powers other carriers", "To make the inside acidic", "To get rid of water", "To make ATP"], 0, "The pumped-out H⁺ want to flow back in. Symporters use that flow to carry sucrose and nitrate in."),
    q("Sucrose moves into a plant cell even when there is more sucrose inside. Where does the energy come from?", ["Directly from ATP at the carrier", "From the H⁺ gradient the pump built, so indirectly from ATP", "From sunlight hitting the membrane", "From osmosis"], 1, "This is <strong>secondary active transport</strong>: the carrier uses the flow of H⁺ down their gradient, which the pump (using ATP) set up."),
    q("Cyanide inhibits respiration (the model switches off ATP supply). What happens to nitrate uptake over time?", ["It slows and stops, because the H⁺ gradient runs down", "It speeds up", "It does not change", "Nitrate starts leaving faster"], 0, "No ATP means the pump stops. H⁺ leak back in, the gradient fades and the symporter has no push."),
    q("Which crosses the membrane by simple diffusion through the lipid bilayer?", ["Sucrose", "Nitrate ions", "CO₂", "H⁺"], 2, "CO₂ is small and non-polar. Sucrose is large and polar; nitrate and H⁺ are charged."),
  ];
  const set = [
    q("Which statement describes <strong>secondary active transport</strong>?", ["A carrier splits ATP to move a substance against its gradient", "A carrier moves one substance against its gradient using the energy stored in another substance's gradient, such as H⁺", "A channel lets ions through down their gradient", "Vesicles carry large cargo"], 1, "The H⁺-ATPase uses ATP (primary active transport) to build the H⁺ gradient. Symporters then use that gradient, so the sucrose or nitrate they move is powered <em>indirectly</em> by ATP."),
    q("In the model, how many H⁺ does the P-type H⁺-ATPase move per ATP hydrolysed?", ["1", "2", "3 (with 2 K⁺ the other way)", "0 — it only moves water"], 0, "The plant plasma membrane H⁺-ATPase is drawn here as 1 H⁺ per ATP (the Na⁺/K⁺-ATPase of animal cells moves 3 Na⁺ out and 2 K⁺ in). It is \"P-type\" because it is briefly phosphorylated."),
    q("Nitrate (NO₃⁻) is an anion and the inside of the cell is negative. How can it still be taken up?", ["It diffuses through the lipids", "The symporter carries about 2 H⁺ with each NO₃⁻; moving them down their electrochemical gradient pays for the uphill step", "ATP binds the nitrate directly", "K⁺ channels carry nitrate"], 1, "Each cycle carries 2 H⁺ and 1 NO₃⁻ in, a net positive charge, so the negative membrane potential <em>helps</em> the cycle. Both the ΔpH and the potential drive it."),
    q("K⁺ is already more concentrated inside a root cell, yet it still enters through channels. Why?", ["Channels are a type of pump", "The negative membrane potential made by the H⁺ pump pulls cations in: the <em>electrochemical</em> gradient favours entry", "K⁺ is carried in with sucrose", "K⁺ dissolves in the lipids"], 1, "Ion movement follows the <strong>electrochemical gradient</strong>: concentration <em>plus</em> electrical charge. A −120 mV potential can balance a K⁺ concentration ratio of about 100:1."),
    q("Vanadate blocks the H⁺-ATPase but not respiration. What would you expect?", ["ATP builds up, but the H⁺ gradient and membrane potential collapse and the symporters slow", "Symporters speed up", "Aquaporins stop working", "K⁺ channels close"], 0, "Blocking the pump removes the proton-motive force, so the symporters stall. Respiration is untouched, so ATP stays high. This separates the pump's job from respiration."),
    q("Which substance crosses the plasma membrane by simple diffusion through the lipid bilayer?", ["Sucrose", "NO₃⁻", "O₂", "A large protein"], 2, "O₂ and CO₂ are small and non-polar, so they dissolve through the lipid core. Sucrose needs a symporter, NO₃⁻ a symporter, and large proteins need vesicles."),
  ];
  if (y12b) set.push(q("A plant growing in low-nitrate soil increases its nitrate uptake. Which change at the molecular level would directly raise the number of nitrate symporters in the membrane?", ["More transcription and translation of the transporter gene", "More aquaporins in the membrane", "A higher temperature only", "Fewer ribosomes"], 0, "The number of transporters depends on <strong>gene expression</strong>: how much of the gene is transcribed and translated. Cells regulate uptake by regulating protein synthesis (and by modifying the protein)."));
  return set;
}
