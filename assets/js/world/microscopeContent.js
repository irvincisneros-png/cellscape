// Microscopy mode: optics constants, what each structure looks like under each microscope, specimens, text,
// missions and quizzes. Pure data and small functions (no DOM, no three.js) so the numbers can be checked in Node.

// ---------- optics ----------
export const EYEPIECE = 10;            // 10× eyepiece
export const FIELD_NUMBER_MM = 18;     // eyepiece field number: field of view = 18 mm ÷ objective power (4.5, 1.8, 0.45, 0.18 mm)
export const WAVELENGTH_UM = 0.55;     // green light (the eye's most sensitive colour)
// na = numerical aperture; dof = depth of field in µm (≈ λ·n/NA²), so only a thin slice is sharp at high power
export const OBJECTIVES = [
  { x: 4, na: 0.10, dof: 55, name: "4× scanning" },
  { x: 10, na: 0.25, dof: 9, name: "10× low power" },
  { x: 40, na: 0.65, dof: 1.3, name: "40× high power" },
  { x: 100, na: 1.25, dof: 0.55, name: "100× oil immersion", oil: true },
];
export const objectiveOf = (x) => OBJECTIVES.find((o) => o.x === x) || OBJECTIVES[0];
export const lmMag = (x) => EYEPIECE * x;
export const lmFovUm = (x) => (FIELD_NUMBER_MM * 1000) / x;
/** Abbe limit: the closest two points can be and still look separate, d = λ ÷ (2·NA). */
export const lmLimitUm = (x) => WAVELENGTH_UM / (2 * objectiveOf(x).na);
export const LM_BEST_LIMIT_UM = lmLimitUm(100);   // ≈ 0.22 µm: the best a light microscope can do

export const TEM = { min: 1500, max: 100000, screenMm: 100, limitNm: 1, sectionUm: 0.8 };
/** Width of the image (a ~100 mm print or screen) divided by the magnification. */
export const temFovUm = (m) => (TEM.screenMm * 1000) / m;
export const temLimitUm = () => TEM.limitNm / 1000;

export function fmtLen(um) {
  if (um < 0.95) { const n = um * 1000; return `${+n.toPrecision(n < 10 ? 2 : 3)} nm`; }
  if (um < 995) return `${+um.toPrecision(um < 10 ? 2 : 3)} µm`;
  const mm = um / 1000;
  return `${+mm.toPrecision(mm < 10 ? 3 : 4)} mm`;
}
/** A round number for a scale bar: 1, 2 or 5 × a power of ten (in µm). */
export function niceLen(um) {
  const p = Math.pow(10, Math.floor(Math.log10(um))), n = um / p;
  return (n >= 5 ? 5 : n >= 2 ? 2 : 1) * p;
}

// ---------- how each structure looks ----------
// A spec is { fill, edge, pow, blend, a0, a1, gain }: the colour the specimen lets through (sRGB hex) looking straight through
// it (fill) and at its edge (edge), how quickly it darkens towards the edge (pow), and how strongly it shows (gain, 0 to 1).
// blend "mul" stacks like layers of stain; "paint" replaces what is behind it (used for the clear vacuole).
const S = (fill, edge, pow = 2.2, o = {}) => ({ fill, edge, pow, blend: "mul", a0: 1, a1: 1, gain: 1, ...o });
const speck = (g = 0.55) => ({
  none: S("#e6e2d4", "#b9b3a0", 1.8, { gain: g }),
  iodine: S("#dcc07a", "#a98424", 1.8, { gain: g + 0.1 }),
  mblue: S("#9fb2d8", "#5b73ab", 1.8, { gain: g + 0.1 }),
});
// lmFrom: the smallest objective power at which a structure shows up in the light microscope (Infinity = never: below its resolution).
// order: draw order (shells first, then the clear vacuole, then everything inside).
// hz: contributes to the out-of-focus glow behind the sharp slice.
export const KINDS = {
  membrane: { name: "Cell membrane and cytoplasm", um: 0.007, lmFrom: 4, order: 0, hz: true,
    lm: { none: S("#fefdfb", "#d3cfc2", 2.6), iodine: S("#f8e9b0", "#c9a24a", 2.2), mblue: S("#e3eefa", "#6f8fc4", 2.2) },
    em: S("#cdcdcd", "#1c1c1c", 4, { tex: 6, dbl: 1 }) },
  wall: { name: "Cell wall", um: 0.5, lmFrom: 4, order: 1, hz: true,
    lm: { none: S("#fdfcf8", "#9d9886", 1.6), iodine: S("#faf0cf", "#b88b2e", 1.6), mblue: S("#f5f8fd", "#9db1d3", 1.6) },
    em: S("#dcdcdc", "#6a6a6a", 2.2, { tex: 5 }) },
  vacuole: { name: "Vacuole", um: 20, lmFrom: 4, order: 3, hz: true,
    lm: { none: S("#fffffe", "#e8e6dc", 2.4, { blend: "paint", a0: 0.92, a1: 0.55 }), iodine: S("#fcf5d8", "#e2cf92", 2.4, { blend: "paint", a0: 0.92, a1: 0.6 }), mblue: S("#f1f6fc", "#c5d3ea", 2.4, { blend: "paint", a0: 0.92, a1: 0.6 }) },
    em: S("#ececec", "#2a2a2a", 5, { blend: "paint", a0: 0.95, a1: 0.95, tex: 6, dbl: 1 }) },
  nucleus: { name: "Nucleus", um: 6, lmFrom: 4, order: 5, hz: true,
    lm: { none: S("#f1efe6", "#bdb6a0", 2.0), iodine: S("#e9bd5a", "#9a6a14", 1.8), mblue: S("#4a63b8", "#1a2a78", 1.6) },
    em: S("#b6b6b6", "#202020", 5, { tex: 1, dbl: 1 }) },
  nucleolus: { name: "Nucleolus", um: 1.5, lmFrom: 40, order: 6, hz: false,
    lm: { none: S("#e4e0d2", "#cfc9b5", 1.6, { gain: 0.6 }), iodine: S("#c98f2a", "#8a5a10", 1.6, { gain: 0.7 }), mblue: S("#1d2f8a", "#101e63", 1.6, { gain: 0.75 }) },
    em: S("#4a4a4a", "#2a2a2a", 3, { tex: 6 }) },
  chromatin: { name: "Chromatin", exag: true, um: 0.03, lmFrom: Infinity, order: 6, hz: false, em: S("#9a9a9a", "#444444", 2.0, { gain: 0.3 }) },
  pores: { name: "Nuclear pores", exag: true, um: 0.1, lmFrom: Infinity, order: 6, hz: false, em: S("#262626", "#111111", 1.0) },
  chloroplast: { name: "Chloroplast", um: 4, lmFrom: 4, order: 5, hz: true,
    lm: { none: S("#8fcb86", "#3d7a3c", 1.8), iodine: S("#9b9a3e", "#5d5516", 1.8), mblue: S("#6fa9a0", "#2f6a6a", 1.8) },
    em: S("#a4a4a4", "#1c1c1c", 5, { tex: 3, dbl: 1 }) },
  grana: { name: "Grana", exag: true, um: 0.4, lmFrom: 100, order: 6, hz: false,
    lm: { none: S("#3f8a45", "#2b5e30", 1.4, { gain: 0.4 }), iodine: S("#4b6a30", "#2f4220", 1.4, { gain: 0.4 }), mblue: S("#2f7a6c", "#1f5249", 1.4, { gain: 0.4 }) },
    em: S("#d2d2d2", "#707070", 2, { tex: 7, dbl: 1, gain: 0.9 }) },
  starch: { name: "Starch grains", um: 2, lmFrom: 10, order: 6, hz: true,
    lm: { none: S("#fbfbf8", "#d4d0c0", 2.2, { gain: 0.8 }), iodine: S("#26204a", "#0f0d26", 1.0), mblue: S("#f4f6fa", "#c9d1e2", 2.2, { gain: 0.8 }) },
    em: S("#e6e6e6", "#b4b4b4", 3, { blend: "paint", a0: 0.93, a1: 0.8, tex: 6 }) },
  mitochondrion: { name: "Mitochondrion", um: 0.5, lmFrom: 40, order: 5, hz: false,
    lm: { none: S("#e9e7dc", "#c1bba8", 1.8, { gain: 0.6 }), iodine: S("#e0c070", "#b08a2a", 1.8, { gain: 0.7 }), mblue: S("#9db4de", "#5a76b0", 1.8, { gain: 0.8 }) },
    em: S("#8c8c8c", "#1c1c1c", 5, { tex: 2, dbl: 1 }) },
  cristae: { name: "Cristae", exag: true, um: 0.02, lmFrom: Infinity, order: 6, hz: false, em: S("#383838", "#161616", 2.0) },
  er: { name: "Endoplasmic reticulum", exag: true, um: 0.05, lmFrom: Infinity, order: 5, hz: false, em: S("#d2d2d2", "#1c1c1c", 5, { tex: 4, dbl: 1 }) },
  ser: { name: "Smooth ER", exag: true, um: 0.05, lmFrom: Infinity, order: 5, hz: false, em: S("#d8d8d8", "#1c1c1c", 5, { tex: 7, dbl: 1 }) },
  ribosomes: { name: "Ribosomes", trueUm: 0.025, um: 0.025, lmFrom: Infinity, order: 7, hz: false, em: S("#101010", "#101010", 1.0), points: true },
  golgi: { name: "Golgi apparatus", exag: true, um: 0.02, lmFrom: Infinity, order: 5, hz: false, em: S("#cacaca", "#1c1c1c", 5, { tex: 7, dbl: 1 }) },
  peroxisome: { name: "Peroxisome", um: 0.5, lmFrom: 100, order: 5, hz: false, lm: speck(0.4), em: S("#707070", "#1c1c1c", 5, { tex: 6, dbl: 1 }) },
  lysosome: { name: "Lysosome", um: 0.4, lmFrom: 100, order: 5, hz: false, lm: speck(0.4), em: S("#505050", "#1c1c1c", 5, { tex: 6, dbl: 1 }) },
  glycogen: { name: "Glycogen granules", trueUm: 0.025, um: 0.025, lmFrom: Infinity, order: 6, hz: false, em: S("#161616", "#0a0a0a", 1.0) },
  microtubule: { name: "Microtubules", exag: true, um: 0.025, lmFrom: Infinity, order: 6, hz: false, em: S("#2e2e2e", "#2e2e2e", 1.0) },
  centriole: { name: "Centrioles", exag: true, um: 0.2, lmFrom: Infinity, order: 6, hz: false, em: S("#222222", "#111111", 1.0) },
  microvilli: { name: "Microvilli", exag: true, um: 0.1, lmFrom: Infinity, order: 4, hz: false, em: S("#8a8a8a", "#1c1c1c", 5, { tex: 7, dbl: 1 }) },
  rbc: { name: "Red blood cells", um: 2, lmFrom: 4, order: 4, hz: true,
    lm: { none: S("#f3b9b1", "#c97a72", 1.8), iodine: S("#e3b56a", "#b0762a", 1.8), mblue: S("#c3a7d6", "#7a5a9a", 1.8) },
    em: S("#9a9a9a", "#222222", 1.6) },
  sinusoid: { name: "Blood vessel wall", um: 0.5, lmFrom: 10, order: 2, hz: false,
    lm: { none: S("#fffdfc", "#e4c9c6", 2.6, { gain: 0.8 }), iodine: S("#fffcf0", "#e2d3a4", 2.6, { gain: 0.8 }), mblue: S("#fafcff", "#cbd5ea", 2.6, { gain: 0.8 }) },
    em: S("#e0e0e0", "#555555", 2.0) },
};
// names a level has already given its objects (userData.kind) that mean the same thing here
export const KIND_ALIAS = {
  vacuole: "vacuole", nucleus: "nucleus", chloroplast: "chloroplast", mitochondrion: "mitochondrion", er: "er", ser: "ser", golgi: "golgi",
  peroxisome: "peroxisome", lysosome: "lysosome", glycogen: "glycogen", microtubule: "microtubule", microvilli: "microvilli", rbc: "rbc", sinusoid: "sinusoid",
};

export const STAINS = {
  none: { label: "Unstained", short: "None" },
  iodine: { label: "Iodine", short: "Iodine" },
  mblue: { label: "Methylene blue", short: "Meth. blue" },
};
export const STAIN_NOTE = {
  none: { "y7-8": "Unstained cells are almost see-through, so there is very little contrast. Only the outlines and the green chloroplasts stand out.", "y9-10": "Unstained: most of the cell absorbs very little light, so contrast is low. Edges show up because they bend (refract) the light.", y11: "Unstained, brightfield: contrast comes from differences in absorbance and refractive index. Phase-contrast optics (not modelled here) would reveal more of living cells." },
  iodine: { "y7-8": "Iodine turns starch blue-black. It stains the nucleus and cytoplasm yellow-brown. It is usually used on plant cells.", "y9-10": "Iodine solution reacts with starch to give a blue-black colour; other parts stain yellow-brown. It is a common stain for plant tissue.", y11: "Iodine in potassium iodide forms a blue-black complex with amylose in starch; proteins take up a yellow-brown colour. Classroom stain preparations like this can damage or kill cells; whether the cells are also fixed depends on the protocol (live staining exists)." },
  mblue: { "y7-8": "Methylene blue stains the nucleus dark blue and the cytoplasm pale blue. It is often used on animal cells, such as cheek cells.", "y9-10": "Methylene blue is attracted to acidic parts of the cell such as the nucleus (DNA), so the nucleus looks darker blue than the cytoplasm.", y11: "Methylene blue is a cationic dye that binds negatively charged nucleic acids, so nuclei (and the nucleolus) stain most strongly. Staining on a prepared slide can damage or kill cells; whether they are fixed depends on the protocol (some dyes can stain living cells)." },
};

// ---------- specimens (real micrographs) ----------
export const SPECIMENS = {
  onion: {
    file: "assets/specimens/onion-epidermis.jpg",
    title: "Onion epidermis (whole mount)",
    credit: "“Onion Epidermis Cells W.M. 40x – 269” by loganrickert (OpenFlexure Microscope)",
    licence: "CC BY 2.0", licenceUrl: "https://creativecommons.org/licenses/by/2.0/",
    source: "https://commons.wikimedia.org/wiki/File:Onion_Epidermis_Cells_W.M._40x_-_269.jpg",
    changes: "Resized and recompressed.",
    alt: "Light micrograph of onion epidermis: a sheet of brick-shaped plant cells with thin walls",
  },
  cheek: {
    file: "assets/specimens/cheek-cells.jpg",
    title: "Human cheek cells",
    credit: "“Microscopic Image of Human Cheek Cells” by Aholderfield",
    licence: "CC BY 4.0", licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    source: "https://commons.wikimedia.org/wiki/File:Microscopic_Image_of_Human_Cheek_Cells.jpg",
    changes: "Resized and recompressed.",
    alt: "Light micrograph of human cheek cells: flat, irregular cells with darker regions inside",
  },
  ecoli: {
    file: "assets/specimens/ecoli-sem.jpg",
    title: "E. coli (scanning electron micrograph)",
    credit: "CDC / Janice Haney Carr and Evangeline Sowers, Public Health Image Library 7136",
    licence: "Public domain", licenceUrl: "https://phil.cdc.gov/Details.aspx?pid=7136",
    source: "https://phil.cdc.gov/Details.aspx?pid=7136",
    changes: "Unmodified.",
    alt: "Scanning electron micrograph of rod-shaped Escherichia coli bacteria with a 3D surface appearance",
  },
};

// ---------- text ----------
const per = (v) => v;   // marks a { band: text } object for lens.pick
export const TEXT = {
  intro: per({
    "y7-8": "Microscopes make tiny things look bigger so we can see them. Switch on the microscope and look at the cell the way a real one is seen. Change the objective lens, add a stain and turn the focus knob.",
    "y9-10": "This is the cell as a light microscope shows it: a circular field of view, a stain, a magnification you can calculate and a thin slice in focus. Then compare it with an electron microscope.",
    y11: "Compare a light microscope (LM) and a transmission electron microscope (TEM) on the same model cell. Notice what changes when you raise magnification and what only changes when resolution improves.",
  }),
  introEm: per({
    "y7-8": "This is the cell as an electron microscope shows it: a thin slice of dead cell in black and white. It can show far smaller things than a light microscope, such as ribosomes and the folds inside mitochondria. Use the slider to zoom in.",
    "y9-10": "This is a transmission electron microscope (TEM) view of the model cell: a greyscale picture of a thin slice. Zoom in with the magnification slider and compare what you can resolve with the light microscope.",
    y11: "TEM view of the model cell: a greyscale projection of an ultrathin section. Compare the resolution with the LM, and think about what sample preparation and heavy-metal staining do to the specimen.",
  }),
  mag: per({
    "y7-8": (o) => `Total magnification = eyepiece × objective = 10 × ${o.x} = <b>${lmMag(o.x)} times</b> bigger.`,
    "y9-10": (o) => `Total magnification = eyepiece × objective = 10 × ${o.x} = <b>×${lmMag(o.x)}</b>. Field of view = 18 mm ÷ ${o.x} = <b>${fmtLen(lmFovUm(o.x))}</b>.`,
    y11: (o) => `Total magnification ×${lmMag(o.x)} (10× eyepiece × ${o.x}× objective). Field of view = field number ÷ objective = 18 mm ÷ ${o.x} = ${fmtLen(lmFovUm(o.x))}. This objective (NA ${o.na}) resolves d = λ ÷ 2NA = 0.55 µm ÷ ${(2 * o.na).toFixed(2)} ≈ <b>${fmtLen(lmLimitUm(o.x))}</b>.`,
  }),
  limit: per({
    "y7-8": (o) => `Smallest detail you can see: about <b>${fmtLen(lmLimitUm(o.x))}</b> at this power. An ordinary classroom light microscope cannot show detail much smaller than about 0.2 µm, and ribosomes are far smaller than that.`,
    "y9-10": (o) => `Smallest detail you can see ≈ <b>${fmtLen(lmLimitUm(o.x))}</b> here (about 0.2 µm at best for an ordinary brightfield microscope). Making the image bigger does not make closer details separate.`,
    y11: () => `Resolution, not magnification, sets what you can see. The Abbe limit d = λ ÷ 2NA is about half the wavelength of light, so ≈ 0.2 µm at best (100× oil, NA 1.25) for conventional brightfield. Very small objects can be detected as a speck without being resolved, and super-resolution methods exist, but they are not modelled here.`,
  }),
  tem: per({
    "y7-8": "An electron microscope uses a beam of tiny particles called electrons instead of light. It can show much smaller things, such as ribosomes, but the cell has to be dead, cut into a very thin slice and put in a vacuum.",
    "y9-10": "A transmission electron microscope (TEM) fires electrons through an ultra-thin slice of dead, stained cell in a vacuum. Dense parts stop more electrons, so they look dark. Its detail is about 1 nm, around 200 times finer than a light microscope.",
    y11: "TEM: electrons (λ ≈ 0.004 nm at 100 kV) pass through a ~70–100 nm section that has been fixed, dehydrated, embedded in resin and stained with heavy metals (uranyl acetate, lead citrate). Regions that scatter electrons strongly look dark. Practical resolution for biological sections is about 1 nm. The image is greyscale, as electrons have no colour.",
  }),
  honesty: "Real TEM needs dead, thin, heavy-metal-stained sections in a vacuum, so you can never watch a living cell. This view is a model: the section here is thicker than a real 70 nm slice. Only ribosomes and glycogen granules are drawn at true size; membranes, cristae, tubes and other fine structures are enlarged so you can see them, so don't use the ruler on those.",
  sem: per({
    "y7-8": "A scanning electron microscope (SEM) shows the outside of things in 3D, like the E. coli photo below.",
    "y9-10": "SEM scans a beam over the surface and gives a 3D-looking picture of the outside, like the E. coli photo. TEM looks through a thin slice instead.",
    y11: "SEM scans a focused beam over a coated surface and detects emitted secondary electrons, giving a 3D-like surface image (resolution ~1–10 nm). TEM transmits electrons through a section to show internal ultrastructure.",
  }),
  smallDetail: "Structures much smaller than the limit (ribosomes, ER membranes, Golgi cisternae, cristae, microtubules) cannot be resolved by a conventional brightfield microscope. A speck near the limit may be detected without its shape being resolved.",
  starchHint: "Try iodine on the plant cell: starch grains turn blue-black.",
  calcHelp: per({
    "y7-8": "A trick for measuring: draw an imaginary horizontal line through the middle of the circle, count the cells it crosses, then divide the width of the circle by that number.",
    "y9-10": "Along a horizontal line through the centre: mean cell length = field-of-view diameter ÷ number of cells across. It is an approximate mean.",
    y11: "Count cells along a horizontal transect through the centre: mean cell length ≈ field-of-view diameter ÷ number of cells. Partial cells at the ends give about ±1 cell of uncertainty, which dominates the answer.",
  }),
  compareQEm: per({
    "y7-8": ["What shape are the bacteria? Can you see inside them?", "A scanning electron microscope shows the outside of things. How is that different from the slice picture of our cell?"],
    "y9-10": ["Compare this SEM with the TEM slice: which shows the surface and which shows the inside?", "Use the 5 µm scale bar in the photo to estimate the length of a bacterium."],
    y11: ["Use the 5 µm scale bar to estimate a bacterium's length. Why can't you use the stated 4890× on a screen?", "Compare SEM and TEM: what does each detect, and what sample preparation does each need?"],
  }),
  compareQ: {
    plant: per({
      "y7-8": ["What can you see in the real photo of onion skin (epidermis)?", "Onion skin cells grow underground, so they have no chloroplasts. Our model is a leaf cell, which does. Which differences are because of biology?", "Which differences could be because of the stain or how the slide was prepared?"],
      "y9-10": ["Onion bulb epidermis has no chloroplasts, but our model is a leaf mesophyll cell. List the differences that are biological.", "List the differences that come from staining, slide preparation or the limits of the microscope instead.", "How many cells can you count across the photo? Why can't you calculate their size without a scale?"],
      y11: ["Name the tissue in the photo (onion bulb epidermis) and the tissue modelled (leaf mesophyll). Separate the biological differences from those caused by staining, preparation or resolution.", "Which organelles can be detected, and which resolved, in the photo? Distinguish seeing a speck from resolving its structure.", "Suggest two artefacts that sample preparation or staining could produce in the photo."],
    }),
    animal: per({
      "y7-8": ["What can you see in the real photo of human cheek cells?", "Our model is a liver cell, not a cheek cell. Which differences might be because they are different kinds of cell?", "Which differences could be because of the stain or how the slide was made?"],
      "y9-10": ["Cheek (epithelial) cells are flat; the model is a liver cell (hepatocyte). List differences that are biological.", "List differences that come from staining, slide preparation or the limits of the microscope instead.", "Count the cells you can see. Why can't you calculate their size without a scale?"],
      y11: ["Name the tissue in the photo (human cheek epithelium) and the tissue modelled (liver hepatocyte). Separate the biological differences from those caused by staining, preparation or resolution.", "Which structures can be detected, and which resolved, in the photo? Distinguish seeing a speck from resolving its structure.", "Suggest two artefacts that sample preparation or staining could produce in the photo."],
    }),
  },
  drawing: per({
    "y7-8": ["Use a sharp pencil. No pen and no colouring.", "Draw clear, single lines. No shading and no sketching.", "Draw what you see, not what you expect. Make it big enough to fill the space.", "Label with ruled lines that do not cross. Write the labels in a column.", "Give it a title, the magnification (for example ×400) and a scale bar."],
    "y9-10": ["Sharp pencil, single clear lines, no shading.", "Draw a few whole cells and one in detail.", "Ruled label lines, not crossing, ending on the part.", "Title, the specimen, the stain, magnification and a scale bar.", "Drawing magnification = size of drawing ÷ actual size (use the same units)."],
  }),
};

// ---------- missions and quizzes ----------
// S is the live state object kept by microscope.js; L is the level's microscope hint ({ cellUm, ... }).
const near = (v, target, tol) => Math.abs(v - target) <= target * tol;
export function missions(S, L) {
  const len = L?.cellUm || 56, cells = S.cellsAcross;
  return [
    { band: "y7-8", maxBand: "y7-8", text: "Turn the objective to 10× and then 40×. Watch the cell get bigger and the field of view shrink.", check: () => S.objs.has(10) && S.objs.has(40) },
    { band: "y7-8", maxBand: "y7-8", text: "Try both stains (iodine and methylene blue). Which parts change colour?", check: () => S.stains.has("iodine") && S.stains.has("mblue") },
    { band: "y7-8", maxBand: "y7-8", text: "At 40× or higher, turn the fine focus knob so a different slice of the cell comes into focus.", check: () => S.focusTravel >= 6 },
    { band: "y7-8", maxBand: "y7-8", text: "Drag the ruler across the whole cell. Read the length in micrometres.", check: () => S.rulerReads.some((v) => near(v, len, 0.3)) },
    { band: "y7-8", maxBand: "y7-8", text: "Switch to the electron microscope and zoom in until you can see tiny dark dots (ribosomes).", check: () => S.temMaxMag >= 20000 },

    { band: "y9-10", maxBand: "y9-10", text: "Reach a total magnification of ×400. Write down the field of view.", check: () => S.objs.has(40) },
    { band: "y9-10", maxBand: "y9-10", text: "Measure the length of the cell with the ruler and check it against the scale bar.", check: () => S.rulerReads.some((v) => near(v, len, 0.25)) },
    { band: "y9-10", maxBand: "y9-10", text: "Do the cell-size calculation: count the cells across the field and divide the field of view by that number.", check: () => S.calcOk },
    { band: "y9-10", maxBand: "y9-10", text: "Look at the cell in both microscopes. Name two structures only the electron microscope shows.", check: () => S.modes.has("lm") && S.temMaxMag >= 20000 },
    { band: "y9-10", maxBand: "y9-10", text: "At ×400 or more, compare the cell unstained and stained. Which parts did the stain reveal?", check: () => S.stainAtHigh.has("none") && (S.stainAtHigh.has("iodine") || S.stainAtHigh.has("mblue")) },

    { band: "y11", text: "Select the 100× oil objective (×1000). State the smallest detail you can see and explain what sets this limit.", check: () => S.objs.has(100) },
    { band: "y11", text: "Calculate the length of the cell from the field of view and the number of cells across. Include an uncertainty.", check: () => S.calcOk },
    { band: "y11", text: "Open the real micrograph comparison and answer all three questions in your notes.", check: () => S.compareOpened },
    { band: "y11", text: "Go to TEM at ×100,000 and use the ruler to measure the width of one ribosome dot (the only structure drawn at true size here). It should be about 25 nm.", check: () => S.temMaxMag >= 100000 && S.rulerReads.some((v) => v > 0.012 && v < 0.05) },
    { band: "y11", text: "Show that more magnification is not more resolution. At ×1000 in the light microscope, check that ribosomes never appear, whichever stain you use.", check: () => S.objs.has(100) && S.stains.size >= 2 },
  ];
}

export const QUIZ = [
  { band: "y7-8", maxBand: "y7-8", q: "A microscope has a 10× eyepiece and a 40× objective. What is the total magnification?", options: ["50×", "400×", "4000×", "10×"], answer: 1, why: "Total magnification = eyepiece × objective = 10 × 40 = 400." },
  { band: "y7-8", maxBand: "y7-8", q: "Which stain turns starch in plant cells blue-black?", options: ["Methylene blue", "Iodine", "Water", "Food colouring"], answer: 1, why: "Iodine solution reacts with starch to make a blue-black colour." },
  { band: "y7-8", maxBand: "y7-8", q: "Why can't you see ribosomes with a school microscope?", options: ["They are transparent", "They are too small for a school light microscope to show", "They are hidden behind the nucleus", "The stain washes them away"], answer: 1, why: "An ordinary light microscope cannot show detail much smaller than about 0.2 µm and ribosomes are far smaller." },
  { band: "y7-8", maxBand: "y7-8", q: "Why do you centre the specimen before moving to a higher-power objective?", options: ["To keep the slide clean", "The field of view gets smaller, so it could slip out of view", "The light turns off", "To make the image upside down"], answer: 1, why: "At higher power you see only a small part of the slide, so a specimen at the edge would be lost." },
  { band: "y7-8", maxBand: "y7-8", q: "Which is a good rule for a biological drawing?", options: ["Colour it in with felt pens", "Use shading to show depth", "Use a sharp pencil with clear single lines and add a title and scale", "Cross the label lines so they look neat"], answer: 2, why: "Use pencil and clear lines, with ruled labels that do not cross, a title, the magnification and a scale." },

  { band: "y9-10", maxBand: "y9-10", q: "A 10× eyepiece and a 10× objective give which total magnification?", options: ["×20", "×100", "×1000", "×10"], answer: 1, why: "10 × 10 = ×100." },
  { band: "y9-10", maxBand: "y9-10", q: "You switch from ×100 to ×400. What happens to the field-of-view diameter?", options: ["It stays the same", "It becomes 4 times smaller", "It becomes 4 times larger", "It doubles"], answer: 1, why: "Field of view is inversely proportional to the objective power: 1.8 mm becomes 0.45 mm." },
  { band: "y9-10", maxBand: "y9-10", q: "At ×400 the field of view is 0.45 mm and 9 cells fit end to end across it. About how long is each cell?", options: ["5 µm", "50 µm", "500 µm", "4.05 mm"], answer: 1, why: "0.45 mm = 450 µm, and 450 ÷ 9 = 50 µm." },
  { band: "y9-10", maxBand: "y9-10", q: "A student's drawing of a cell is 60 mm long. The real cell is 0.05 mm long. What is the magnification of the drawing?", options: ["×12", "×120", "×1200", "×3000"], answer: 2, why: "Magnification = image size ÷ actual size = 60 ÷ 0.05 = ×1200." },
  { band: "y9-10", maxBand: "y9-10", q: "Which statement is true about an electron microscope compared with a light microscope?", options: ["It can show living cells in colour", "It shows much finer detail, but the specimen is dead and in a vacuum", "It uses visible light and glass lenses", "It cannot be used on cells"], answer: 1, why: "Electron beams give far better resolution, but samples must be dead, thin, stained and in a vacuum. The image is greyscale." },

  { band: "y11", q: "Which best defines resolution?", options: ["How many times bigger the image is than the object", "The smallest distance between two points that can still be seen as separate", "The brightness of the image", "The thickness of the specimen"], answer: 1, why: "Resolution is about separating close points. Magnification only enlarges the image." },
  { band: "y11", q: "Using d = λ ÷ 2NA with λ = 550 nm and NA = 1.25 (100× oil objective), the limit of resolution is about:", options: ["22 nm", "220 nm", "2.2 µm", "0.22 mm"], answer: 1, why: "550 ÷ (2 × 1.25) = 220 nm ≈ 0.2 µm." },
  { band: "y11", q: "Why can a TEM resolve about 1 nm when a light microscope cannot?", options: ["Electrons are much heavier than photons so they move slowly", "Electrons in the beam have a much shorter wavelength than visible light", "The lenses are larger", "The stain is more concentrated"], answer: 1, why: "Resolution depends on wavelength. Accelerated electrons have wavelengths of a few picometres." },
  { band: "y11", q: "A mitochondrion is 35 mm long on a TEM micrograph at ×20 000. What is its actual length?", options: ["0.57 µm", "1.75 µm", "7 µm", "17.5 µm"], answer: 1, why: "35 mm ÷ 20 000 = 0.00175 mm = 1.75 µm." },
  { band: "y11", q: "Which pairing of microscope and image is correct?", options: ["SEM: thin section showing internal organelles", "TEM: 3D view of the surface of a whole insect", "SEM: surface image that looks three-dimensional", "LM: shows detail down to 1 nm"], answer: 2, why: "SEM scans a surface to give a 3D-like image. TEM transmits electrons through a thin section. LM resolves about 0.2 µm at best." },
];

// ---------- the mini diagram of a compound light microscope (for Years 7–8) ----------
export const PARTS_SVG = `<svg viewBox="0 0 330 244" role="img" aria-label="Labelled diagram of a compound light microscope: eyepiece, body tube, objective lenses, stage, light source, arm, coarse and fine focus knobs and base" style="width:100%;height:auto;display:block">
  <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M176 218C232 204 238 100 146 66" stroke-width="11" opacity=".28"/>
    <rect x="125" y="10" width="20" height="34" rx="3" fill="currentColor" fill-opacity=".14"/>
    <rect x="128" y="44" width="14" height="66" fill="currentColor" fill-opacity=".1"/>
    <path d="M121 110h28l-4 12h-20z" fill="currentColor" fill-opacity=".16"/>
    <rect x="122" y="122" width="7" height="15" rx="1.5" fill="currentColor" fill-opacity=".22"/>
    <rect x="131.5" y="122" width="7" height="23" rx="1.5" fill="currentColor" fill-opacity=".22"/>
    <rect x="141" y="122" width="7" height="15" rx="1.5" fill="currentColor" fill-opacity=".22"/>
    <rect x="94" y="156" width="82" height="9" rx="2" fill="currentColor" fill-opacity=".16"/>
    <rect x="116" y="152" width="40" height="4" rx="1" fill="currentColor" fill-opacity=".32"/>
    <path d="M128 176h14v8h-14z" fill="currentColor" fill-opacity=".14"/>
    <circle cx="135" cy="200" r="8" fill="currentColor" fill-opacity=".2"/>
    <rect x="72" y="218" width="130" height="14" rx="5" fill="currentColor" fill-opacity=".18"/>
    <circle cx="214" cy="136" r="11" fill="currentColor" fill-opacity=".08"/><circle cx="214" cy="136" r="4"/>
    <circle cx="209" cy="166" r="7" fill="currentColor" fill-opacity=".08"/><circle cx="209" cy="166" r="2.5"/>
  </g>
  <g font-size="10.5" fill="currentColor" font-family="inherit">
    <g stroke="currentColor" stroke-width="1" opacity=".55" fill="none">
      <path d="M123 27H92M120 135H92M93 161H92M127 200H92"/>
      <path d="M143 76h92M229 100h6M225 136h10M216 166h19M202 225h33"/>
    </g>
    <g text-anchor="end"><text x="88" y="30">Eyepiece (10×)</text><text x="88" y="138">Objective lenses</text><text x="88" y="165">Stage</text><text x="88" y="204">Light source</text></g>
    <text x="240" y="79">Body tube</text><text x="240" y="103">Arm</text><text x="240" y="139">Coarse focus</text><text x="240" y="169">Fine focus</text><text x="240" y="228">Base</text>
  </g>
</svg>`;
