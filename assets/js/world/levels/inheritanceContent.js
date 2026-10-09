// Inheritance lab: words. Year-banded text, generated narrative, missions and quiz. Pure (no DOM).
// Terms used on purpose: genotype / phenotype / allele; "dominant" and "recessive" describe how an allele
// behaves in a heterozygote, never how common it is.
import { PRESETS, fraction, crossClasses, ratioString, genoRatioString, chiSquare, PATTERN_NAME, polyStats } from "./inheritanceModel.js";

export const MODES = [
  { id: "mono", label: { "y7-8": "One gene", "y9-10": "One gene" }, band: "y7-8", full: "Monohybrid" },
  { id: "abo", label: { "y9-10": "Blood groups" }, band: "y9-10", full: "Codominance & multiple alleles" },
  { id: "xlinked", label: { "y9-10": "Sex-linked" }, band: "y9-10", full: "Sex-linked" },
  { id: "dihybrid", label: { "y9-10": "Two genes" }, band: "y9-10", full: "Dihybrid" },
  { id: "poly", label: { "y9-10": "Many genes" }, band: "y9-10", full: "Polygenic" },
  { id: "pedigree", label: { "y9-10": "Family tree" }, band: "y9-10", full: "Pedigree" },
];

export const MODE_INTRO = {
  mono: {
    "y7-8": "A gene comes in pairs: you get one copy from each parent. Pick a trait and the parents, and watch which versions of the gene the children can get.",
    "y9-10": "Monohybrid cross: one gene, two alleles. Each parent passes on one of their two alleles at random, so the Punnett square shows every equally likely egg + sperm pairing.",
    y11: "Monohybrid cross: segregation of two alleles at one locus. Each gamete carries one allele, so the grid lists every equally likely zygote.",
  },
  abo: {
    "y9-10": "Blood groups have three alleles in the population, but each person has only two. Iᴬ and Iᴮ are codominant (both show up in IᴬIᴮ), and i is recessive to both.",
    y11: "Multiple alleles with codominance and complete dominance in one system: Iᴬ and Iᴮ encode different glycosyltransferases and are codominant; i encodes no functional enzyme and is recessive to both.",
  },
  xlinked: {
    "y9-10": "These genes sit on the X chromosome. Males (XY) have only one X, so one recessive allele is enough to show the condition. Females (XX) need two.",
    y11: "X-linked recessive inheritance. Males are hemizygous, so a single recessive allele is expressed; females are usually protected by a second X. The Y has no matching locus, so an affected father passes his X to every daughter and no son.",
  },
  dihybrid: {
    "y9-10": "Two genes on different chromosomes. Each parent can make four kinds of gamete, so the grid is 4 × 4. When both parents are heterozygous for both genes, the offspring come out near 9 : 3 : 3 : 1.",
    y11: "Dihybrid cross of two unlinked genes. Alleles of different genes assort independently at metaphase I, so each double heterozygote makes four gamete types in equal numbers. Linked genes (close together on one chromosome) break this: crossing over is then the only way to make recombinant gametes.",
  },
  poly: {
    "y9-10": "Many traits are controlled by several genes, each adding a small effect, plus the environment. Breed 500 offspring and watch the histogram turn into a bell curve as the number of genes goes up.",
    y11: "Polygenic (continuous) variation: N additive loci plus an environmental effect. The phenotype is the sum of the + alleles plus a random environmental deviation, so the distribution approaches a normal curve as N rises (central limit theorem).",
  },
  pedigree: {
    "y9-10": "A pedigree is a family tree for a trait. Squares are males, circles are females, and coloured symbols are people who have the condition. Work out how it is inherited.",
    y11: "Pedigree analysis. Use the rules, not hunches: look at which generations are affected, the sex ratio, and whether unaffected parents can have affected children.",
  },
};

export const WORDS = {
  "y7-8": [["Gene", "instructions for a trait"], ["Allele", "one version of a gene"], ["Dominant", "shows up even when you only have one copy"], ["Recessive", "only shows up when you have two copies"], ["Carrier", "has one copy of a recessive allele but does not have the condition"]],
  "y9-10": [["Genotype", "the alleles a person has"], ["Phenotype", "the trait you can see or measure"], ["Homozygous / heterozygous", "two matching alleles / two different alleles"], ["Dominant / recessive", "describe how an allele behaves in a heterozygote. They do not mean common or rare."]],
  y11: [["Genotype / phenotype", "alleles carried / observed trait (genotype + environment)"], ["Hemizygous", "only one copy of a gene (males, X-linked genes)"], ["Penetrance", "the fraction of people with a genotype who show the phenotype"], ["Expressivity", "how strongly the phenotype shows in those who have it"], ["Dominant / recessive", "describe the effect of an allele in a heterozygote, not how common it is"]],
};

// ------------------------------------------------------------------ preset text
export const PRESET_INFO = {
  sickle: {
    name: { "y7-8": "Sickle-cell", "y9-10": "Sickle-cell (HBB)", y11: "Sickle-cell (HBB, β-globin)" },
    pattern: { "y7-8": "Needs a copy from each parent", "y9-10": "Autosomal recessive (for the disease)", y11: "Autosomal; recessive for sickling disease, codominant at the protein level" },
    blurb: {
      "y7-8": "Red blood cells carry oxygen. In sickle-cell disease some of them bend into a sickle shape and can block tiny blood vessels. A child only gets the disease if they get the sickle version of the gene from BOTH parents. With just one copy a person is a carrier (they have sickle-cell trait) and is usually healthy.",
      "y9-10": "The HBB gene (chromosome 11) makes the β-globin chain of haemoglobin. Two copies of the HbS allele cause sickle-cell disease. People with one HbA and one HbS (sickle-cell trait) are usually healthy but can pass HbS on.",
      y11: "HbS differs from HbA by one base (GAG→GTG, Glu→Val at position 6). Deoxygenated HbS polymerises and distorts red cells. Heterozygotes make both kinds of β-chain, so the alleles are codominant at the molecular level but HbS is recessive for the disease. Heterozygotes are also partly protected from severe Plasmodium falciparum malaria, which helps keep HbS common where malaria is (a balanced polymorphism).",
    },
    aside: { y11: "Heterozygote advantage is a Year 11 idea. It shows how selection can keep a harmful recessive allele common." },
  },
  cf: {
    name: { "y7-8": "Cystic fibrosis", "y9-10": "Cystic fibrosis (CFTR)", y11: "Cystic fibrosis (CFTR)" },
    pattern: { "y7-8": "Needs a copy from each parent", "y9-10": "Autosomal recessive", y11: "Autosomal recessive" },
    blurb: {
      "y7-8": "Cystic fibrosis makes the sticky mucus in the lungs and gut too thick. A child only has it if they get the CF version of the gene from BOTH parents. Parents who are carriers do not have CF themselves.",
      "y9-10": "The CFTR gene (chromosome 7) makes a chloride channel in cell membranes. Two faulty alleles (cc) cause thick mucus. About 1 in 25 people of European ancestry carry one CF allele, so two carriers meeting is not rare.",
      y11: "CFTR encodes a chloride channel. The most common variant in people of European ancestry is ΔF508 (loss of Phe508, which misfolds the protein), but over 2,000 variants are known. Severity varies even for the same genotype: variable expressivity from modifier genes and environment.",
    },
  },
  huntington: {
    name: { "y7-8": "Huntington's disease", "y9-10": "Huntington's disease (HTT)", y11: "Huntington's disease (HTT)" },
    pattern: { "y7-8": "One copy is enough (dominant)", "y9-10": "Autosomal dominant, late onset", y11: "Autosomal dominant; late onset; CAG repeat expansion" },
    blurb: {
      "y7-8": "In Huntington's disease one copy of the gene is enough. Symptoms usually begin in adulthood, so people often have children before they know. A child of an affected parent has a 1 in 2 chance.",
      "y9-10": "The HTT gene (chromosome 4) has a stretch of repeated CAG. The disease allele (H) is dominant, so one copy is enough. Symptoms usually start between about 30 and 50, so many people have children before they know they carry it.",
      y11: "A CAG repeat expansion in HTT (36 or more repeats; 40 or more gives full penetrance) adds a long polyglutamine tract to huntingtin. Onset is usually in mid-life and age of onset falls as the repeat gets longer. The expansion can lengthen when passed on, especially from fathers (anticipation).",
    },
    note: { "y9-10": "This is a model. Real families can choose genetic counselling and testing.", y11: "Real families can choose genetic counselling and testing, and the choice is personal." },
  },
  lactose: {
    name: { "y7-8": "Milk-sugar digestion", "y9-10": "Lactase persistence (LCT)", y11: "Lactase persistence (LCT/MCM6)" },
    pattern: { "y7-8": "One copy is enough (dominant)", "y9-10": "Autosomal dominant", y11: "Autosomal dominant (regulatory variant)" },
    blurb: {
      "y7-8": "Most people in the world stop making much of the enzyme lactase after childhood, so milk makes them feel unwell. Some people keep making it. The 'keep making it' version is dominant, but it is not the most common version worldwide.",
      "y9-10": "Lactase breaks down lactose, the sugar in milk. In most people lactase production switches down after childhood. The lactase persistence allele (L) is dominant, but it is the minority condition worldwide. Dominant does not mean common.",
      y11: "Persistence is caused by regulatory variants near LCT (for example in MCM6 in Europeans) that keep the gene switched on in adults. Different variants have arisen independently in different populations that herd milk-producing animals: a case of convergent evolution under selection. A good example of 'dominant does not mean common'.",
    },
  },
  mc1r: {
    name: { "y7-8": "Red hair", "y9-10": "Red hair (MC1R, simplified)", y11: "Red hair (MC1R, simplified)" },
    pattern: { "y7-8": "Needs a copy from each parent", "y9-10": "Recessive (simplified)", y11: "Mostly recessive; one major gene among several" },
    blurb: {
      "y7-8": "Red hair mostly needs two copies of a particular version of the MC1R gene. This is simplified: hair colour is really affected by lots of genes.",
      "y9-10": "MC1R (chromosome 16) is the main gene for red hair. Most red-haired people have two loss-of-function alleles (rr). This is a simplification: other genes shift hair colour, and heterozygotes (Rr) can show reddish tints or freckles.",
      y11: "Several different loss-of-function MC1R variants exist, and compound heterozygotes (two different variants) also have red hair. Heterozygotes are not always fully 'unaffected': incomplete dominance for tint and freckling is common. Hair and skin colour depend on many other loci too, so this one-gene model is a teaching simplification.",
    },
  },
  abo: {
    name: { "y9-10": "ABO blood groups", y11: "ABO blood groups (ABO)" },
    pattern: { "y9-10": "Multiple alleles; codominance", y11: "Multiple alleles; codominance of Iᴬ and Iᴮ; i recessive" },
    blurb: {
      "y9-10": "The ABO gene (chromosome 9) has three common alleles. Iᴬ and Iᴮ are codominant: someone with both (AB) has both sugars on their red blood cells. The i allele makes no sugar and is recessive. A person with blood group A could be IᴬIᴬ or Iᴬi: you cannot tell from the phenotype.",
      y11: "Iᴬ and Iᴮ encode glycosyltransferases that add different sugars (GalNAc or galactose) to the H antigen on red cells. Most i alleles contain a frameshift that leaves no working enzyme. Rh (D) is a separate gene on another chromosome. Parents of blood groups A and B can have a child of group O only if both are heterozygous (Iᴬi × Iᴮi).",
    },
  },
  haemophilia: {
    name: { "y9-10": "Haemophilia A (F8)", y11: "Haemophilia A (F8)" },
    pattern: { "y9-10": "X-linked recessive", y11: "X-linked recessive" },
    blurb: {
      "y9-10": "The F8 gene (on the X chromosome) makes clotting factor VIII. Affected people bleed for longer. About 1 in 5,000 boys is born with haemophilia A. A carrier mother (XᴴXʰ) is usually healthy, and each of her sons has a 1 in 2 chance of being affected.",
      y11: "F8 (Xq28) encodes factor VIII. Males are hemizygous so one recessive allele causes the disease (about 1 in 5,000 males). Carrier females have a second, working X, but because of random X-inactivation some have lower factor VIII and mild bleeding. Affected daughters are possible: an affected father and a carrier mother.",
    },
  },
  dmd: {
    name: { "y9-10": "Duchenne muscular dystrophy (DMD)", y11: "Duchenne muscular dystrophy (DMD)" },
    pattern: { "y9-10": "X-linked recessive", y11: "X-linked recessive" },
    blurb: {
      "y9-10": "The DMD gene (X chromosome) makes dystrophin, a protein that supports muscle fibres. About 1 in 3,500 to 5,000 boys is affected. Roughly a third of cases come from a new mutation, so a family may have no history of it.",
      y11: "DMD (Xp21) is the largest human gene and encodes dystrophin. Many cases are deletions. About a third of cases arise from new mutations, so a lack of family history does not rule out X-linked inheritance. Affected males rarely have children, so affected daughters are very rare, but carriers can have mild muscle or heart effects.",
    },
  },
};

export const DIHYBRID_INFO = {
  name: { "y9-10": "Mendel's peas: shape and colour", y11: "Mendel's peas: seed shape (R) and seed colour (Y)" },
  blurb: {
    "y9-10": "Mendel crossed pea plants that differed in two traits: round or wrinkled seeds (R is dominant) and yellow or green seeds (Y is dominant). The two genes are on different chromosomes, so they are passed on independently.",
    y11: "Seed shape (SBE1; wrinkled = r has a transposon insertion that reduces starch branching) and cotyledon colour (SGR; green = y fails to break down chlorophyll) are on different chromosomes, so alleles assort independently. Genes close together on the same chromosome do not: they are linked and travel together unless crossing over separates them.",
  },
};

export const POLY_INFO = {
  eyes: {
    name: { "y9-10": "Eye colour (pigment amount)", y11: "Eye colour (pigment amount)" },
    unit: { "y9-10": "pigment score", y11: "melanin score (arbitrary units)" },
    blurb: {
      "y9-10": "Eye colour is not a single brown/blue gene. Several genes help control how much pigment the iris makes. OCA2 and HERC2 (on chromosome 15) have the biggest effect, and others add small effects. This simulator uses N identical additive genes as a simple model, so it is a teaching simplification, not a prediction.",
      y11: "In people of European ancestry, a regulatory variant in HERC2 that switches OCA2 up or down explains much of the blue/brown difference, but many other loci (such as TYR, SLC24A4 and IRF4) add small effects, and the effects are not all simply additive. Treating colour as N equal additive genes is a model of the shape of the distribution, not of the real genetics.",
    },
  },
  height: {
    name: { "y9-10": "A height-like trait", y11: "A height-like trait" },
    unit: { "y9-10": "height (cm)", y11: "height (cm)" },
    blurb: {
      "y9-10": "Height is influenced by hundreds of genes and by nutrition and health. Here each + allele adds 2 cm. Real height is affected by thousands of variants, each with a tiny effect.",
      y11: "Genome-wide studies find thousands of common variants that each shift adult height by a millimetre or less, and heritability of adult height in well-nourished populations is high (about 0.8). In this model each + allele adds 2 cm; the environment term stands in for nutrition and health.",
    },
  },
};

export const PED_INFO = {
  AD: { name: "Autosomal dominant", rules: {
    "y9-10": "Every affected person has an affected parent. Both sexes are affected about equally. The condition appears in every generation.",
    y11: "Affected people have an affected parent (barring a new mutation or reduced penetrance); both sexes are affected; about half of the children of an affected heterozygote are affected; male-to-male transmission occurs; it does not skip generations.",
  } },
  AR: { name: "Autosomal recessive", rules: {
    "y9-10": "It can skip generations. Two unaffected parents can have an affected child. Males and females are affected equally often.",
    y11: "Two unaffected carriers can have an affected child (about 1 in 4); the condition can skip generations; males and females are equally affected; it is more often seen with consanguinity for rare alleles.",
  } },
  XR: { name: "X-linked recessive", rules: {
    "y9-10": "Mostly males are affected. A mother who is not affected can pass it to her sons. There is no father-to-son passing of the allele.",
    y11: "Many more affected males than females; unaffected carrier mothers pass it to about half their sons; an affected father cannot pass it to his sons (he gives them his Y), but his daughters are all carriers; an affected daughter needs an affected father.",
  } },
};

// ------------------------------------------------------------------ describe a genotype in words
export function describeGeno(spec, key, band) {
  if (spec.kind === "x") return "";
  const k = key.split("|")[0];
  const c = spec.classes.find((c) => c.geno.includes(k));
  if (!c) return "";
  const lab = pick(band, c.label);
  const het = spec.alleles && k.length === 2 && k[0] !== k[1];
  if (spec.recessive && het && c.aff === 0) return `${lab} — a carrier`;
  return lab;
}
function pick(band, v) {
  if (v == null || typeof v !== "object") return v;
  const order = ["y7-8", "y9-10", "y11", "y12"];
  for (let i = order.indexOf(band); i >= 0; i--) if (v[order[i]] != null) return v[order[i]];
  return v[order.find((b) => v[b] != null)];
}
const pct = (p) => `${Math.round(p * 1000) / 10}%`.replace(".0%", "%");

export const INDEPENDENCE = {
  "y7-8": "Every child is a fresh chance. A family that has had one child with the condition is NOT 'used up', and a family with four children without it is NOT 'due' one.",
  "y9-10": "Each child is an independent event: the chance is the same for every child, whatever happened with the earlier ones. Chance does not 'catch up' or 'even out'.",
  y11: "Children are independent trials (Bernoulli). Past outcomes do not change the probability for the next child. Observed proportions approach the expected ones as n grows because variation shrinks like √(npq), not because chance compensates.",
};

// ------------------------------------------------------------------ narrative for crosses (mono, abo, xlinked, dihybrid)
export function crossNarrative(c) {
  const { band, cross, spec, n, counts, info, fatherDesc, motherDesc, last, run } = c;
  const out = [];
  const cs = crossClasses(cross);
  const labelOf = (cl) => pick(band, spec.classes.find((k) => k.id === cl.id).label);
  const y7 = band === "y7-8", sen = band === "y11" || band === "y12";
  const gen = spec.kind === "x" ? "Each egg carries one of the mother's two X chromosomes. Each sperm carries either the father's X or his Y: an X-bearing sperm makes a girl and a Y-bearing sperm makes a boy." : cross.rows.length * cross.cols.length === 16 ? "Each parent can make four kinds of gamete, so there are 16 equally likely pairings." : cross.n === 4 ? (y7 ? "Each parent gives one of their two versions at random, so there are 4 equally likely boxes." : "Each parent passes on one of their two alleles at random, so there are 4 equally likely egg + sperm pairings.") : "";
  out.push(`${fatherDesc ? `<b>Father:</b> ${fatherDesc}. ` : ""}${motherDesc ? `<b>Mother:</b> ${motherDesc}.` : ""} ${gen}`);
  // expected
  const parts = cs.map((k) => `${labelOf(k)}: ${fraction(k.n, cross.n)} (${pct(k.p)})`);
  if (cs.length === 1) {
    out.push(`<b>Expected:</b> every child will be <b>${labelOf(cs[0])}</b> (probability 1).` + (cs[0].p === 1 && spec.kind !== "x" && !y7 ? " (They may not all have the same genotype; the phenotype is the same.)" : ""));
  } else {
    out.push(`<b>Expected:</b> ${parts.join("; ")}.${cross.cols.length * cross.rows.length > 4 || y7 ? "" : ` Ratio ${ratioString(cross)}.`}${spec.kind !== "x" && !y7 && cross.geno.size > cs.length ? ` Genotype ratio ${genoRatioString(cross)}.` : ""}`);
  }
  if (spec.kind === "x" && !y7) {
    const sons = cs.filter((k) => k.id[0] === "M"), dau = cs.filter((k) => k.id[0] === "F");
    const sAff = cross.cls.get("Ma")?.n || 0, sAll = sons.reduce((s, k) => s + k.n, 0), dAff = cross.cls.get("Fa")?.n || 0, dAll = dau.reduce((s, k) => s + k.n, 0);
    out.push(`Sons: ${fraction(sAff, sAll)} affected. Daughters: ${fraction(dAff, dAll)} affected${cross.cls.get("Fc") ? `, ${fraction(cross.cls.get("Fc").n, dAll)} carriers` : ""}.`);
  }
  if (n > 0) {
    const bits = cs.map((k) => `${labelOf(k)} ${counts[k.id] || 0} (${pct((counts[k.id] || 0) / n)})`).join(", ");
    out.push(`<b>Observed (${n} ${n === 1 ? "child" : "children"}):</b> ${bits}.`);
    if (n >= 20 && cs.length > 1) {
      const probs = {}; for (const k of cs) probs[k.id] = k.p;
      const e = cs.map((k) => k.p * n);
      let note = n >= 100 ? "The counts are close to what was expected, but almost never exactly equal. The small gaps are chance." : "With few children the counts can wander well away from the expected ratio. Try more children.";
      if (sen) {
        const x = chiSquare(counts, probs, n);
        note = `χ² = ${x.chi2.toFixed(2)} on ${x.df} degree${x.df > 1 ? "s" : ""} of freedom (5% critical value ${x.crit}). ` + (x.fits ? "That is below the critical value: the data are consistent with the expected ratio (this does not prove it)." : "That is above the critical value: unlikely by chance alone if the ratio is right. About 1 run in 20 will do this by chance even when the ratio is exactly right.") + (x.lowExpected ? " Some expected counts are below 5, so χ² is unreliable here." : "");
      }
      out.push(note);
    } else if (n < 20 && cs.length > 1) {
      out.push(y7 ? "Only a few children so far, so don't expect the ratio to match yet." : "Small samples scatter widely. The expected ratio is a probability for each child, not a promise about a family.");
    }
    if (last && cs.length > 1) {
      const tail = y7 ? "Each child is a new chance, whatever came before." : "the next child has exactly the same chance: the children are independent.";
      out.push(`<b>Last child:</b> ${labelOf({ id: last.id })} (a ${fraction(last.n, cross.n)} chance for each child). ${run >= 2 ? `That is ${run} of the same kind in a row, but ${tail}` : tail.charAt(0).toUpperCase() + tail.slice(1)}`);
    }
  }
  return out;
}

// ------------------------------------------------------------------ narrative for polygenic mode
export function polyNarrative(c) {
  const { band, N, kA, kB, env, st, n, sample, trait } = c;
  const out = [];
  const sen = band === "y11" || band === "y12";
  const nGeno = Math.pow(3, N);
  out.push(`<b>${N} gene${N > 1 ? "s" : ""}</b>, each with a + allele (adds to the trait) and a − allele (adds nothing). Each parent has ${kA} and ${kB} + alleles out of ${2 * N}. Expected offspring mean ${st.mean.toFixed(1)} + alleles.${sen ? ` Genetic variance ${st.varG.toFixed(2)}; environmental variance ${st.varE.toFixed(2)}; heritability (broad-sense) H² = ${st.h2.toFixed(2)}.` : ""}`);
  out.push(N === 1 ? "With one gene there are only three genetic classes (0, 1 or 2 + alleles), so the bars come in steps. Environment blurs the steps a little." : N <= 3 ? `With ${N} genes there are ${2 * N + 1} possible genetic scores (${nGeno} genotypes). The steps are narrower, and the histogram starts to look like a bell.` : `With ${N} genes there are ${2 * N + 1} genetic scores. Many small effects add up, and the distribution is close to a bell (normal) curve.${env > 0 ? " The environment smooths it further." : ""}`);
  if (n > 0) {
    out.push(`<b>Observed (${n} offspring):</b> mean ${sample.mean.toFixed(2)}, spread (SD) ${sample.sd.toFixed(2)}. Expected mean ${st.mean.toFixed(2)}, SD ${st.sd.toFixed(2)}.${sen ? ` Observed variance ${(sample.sd ** 2).toFixed(2)} vs expected ${st.varP.toFixed(2)}.` : ""}`);
    out.push(env > 0 ? `The environment adds variation that is not inherited: two children with the same genes can differ in ${trait}.` : "With the environment slider at zero, every difference comes from genes. Real traits always have an environmental part.");
  }
  return out;
}

// ------------------------------------------------------------------ pedigree feedback
export function patternDiagnosis(an, band) {
  const pats = an.consistent, name = (p) => PATTERN_NAME[p];
  const out = [];
  const sen = band === "y11" || band === "y12";
  out.push(`<b>Consistent with:</b> ${pats.length ? pats.map(name).join(", ") : "none of the three patterns"}.`);
  for (const p of ["AD", "AR", "XR"]) if (!pats.includes(p)) out.push(`<b>Not ${name(p)}:</b> ${an.rules[p].why[0] || "no way to assign genotypes that fits"}`);
  if (pats.length === 1) out.push("Only one of the three patterns fits, so this pedigree settles it (assuming the condition is fully penetrant and nobody has a new mutation).");
  else if (pats.length > 1) {
    const best = an.best;
    out.push(an.margin >= 8 ? `More than one pattern fits the rules, but <b>${name(best)}</b> is far more likely (about ${an.margin >= 1000 ? "1000+" : Math.round(an.margin)} times, assuming a rare allele). Say 'consistent with', not 'must be'.` : `More than one pattern fits and none is clearly better, so this pedigree can't decide. Real investigators would test the family's DNA.`);
  }
  for (const n of an.rules.notes) out.push(n);
  if (sen) out.push("Assumptions: full penetrance, no new mutations or mosaicism, accurate diagnoses. X-linked dominant, Y-linked and mitochondrial patterns are not offered here.");
  return out;
}

// ------------------------------------------------------------------ missions
// S = level state (see inheritance.js). Each mission is a band range.
export const MISSIONS = [
  // Years 7-8
  { maxBand: "y7-8", text: "Pick a trait, have 10 children and compare the counts with the prediction", check: (S) => S.maxN >= 10 },
  { maxBand: "y7-8", text: "Cross two carriers and see the chance of an affected child (1 in 4)", check: (S) => S.carrierCross },
  { maxBand: "y7-8", text: "Have children one at a time until a child has the condition", check: (S) => S.sawAffectedSingle },
  { maxBand: "y7-8", text: "Find a cross where two parents without the condition can have a child with it", check: (S) => S.unaffectedParentsAffectedChild },
  { maxBand: "y7-8", text: "Try three different traits", check: (S) => S.presets.size >= 3 },
  { maxBand: "y7-8", text: "Change a parent's genes three times and watch the prediction change", check: (S) => S.parentChanges >= 3 },
  // Years 9-10
  { band: "y9-10", maxBand: "y9-10", text: "Cross two carriers, have 100 children and compare the counts with the Punnett prediction", check: (S) => S.carrier100 },
  { band: "y9-10", maxBand: "y9-10", text: "Blood groups: find the parents' genotypes for which a group A mother and a group B father can have a child of group O", check: (S) => S.aboHeteroAB },
  { band: "y9-10", maxBand: "y9-10", text: "Sex-linked: cross a carrier mother with an unaffected father and have enough children to see affected sons", check: (S) => S.xrSonAffected },
  { band: "y9-10", maxBand: "y9-10", text: "Breed 500 offspring with 4 or more genes and see the bell curve", check: (S) => S.poly500N4 },
  { band: "y9-10", maxBand: "y9-10", text: "Solve a mystery family tree (pick the correct pattern)", check: (S) => S.pedSolved >= 1 },
  { band: "y9-10", maxBand: "y9-10", text: "Mendel's peas: breed 100 offspring from two double heterozygotes (RrYy)", check: (S) => S.di100 },
  // Years 11-12
  { band: "y11", text: "Dihybrid test cross (RrYy × rryy): breed 100+ offspring and find the 1 : 1 : 1 : 1 ratio", check: (S) => S.testCross100 },
  { band: "y11", text: "Chi-square: have 200 or more children from one cross and judge the fit", check: (S) => S.maxN >= 200 },
  { band: "y11", text: "Show that spread rises with the number of genes: breed 500 offspring with 1 gene, then with 6", check: (S) => S.polyN.has(1) && S.polyN.has(6) },
  { band: "y11", text: "Solve a mystery family tree for each pattern (AD, AR and X-linked recessive)", check: (S) => S.patternsSolved.size >= 3 },
  { band: "y11", text: "X-linked: cross an affected father with a carrier mother and have an affected daughter", check: (S) => S.xrAffectedDaughter },
  { band: "y11", text: "Have 6 children one at a time from the same cross and check the run is no 'catch-up'", check: (S) => S.singleRun >= 6 },
];

// ------------------------------------------------------------------ quiz
export const QUIZ = [
  // Years 7-8
  { maxBand: "y7-8", q: "A boy gets two versions of every gene. Where do they come from?", options: ["Both from his mother", "One from his mother and one from his father", "Both from his father", "From his grandparents only"], answer: 1, why: "Each parent passes on one version of each gene, so a child gets one from each parent." },
  { maxBand: "y7-8", q: "Two parents are carriers of cystic fibrosis. What is the chance that a child has CF?", options: ["0", "1 in 4", "1 in 2", "Every child"], answer: 1, why: "Each parent gives the CF version with a 1 in 2 chance, so both together is 1 in 2 × 1 in 2 = 1 in 4." },
  { maxBand: "y7-8", q: "A family already has one child with cystic fibrosis. Both parents are carriers. What is the chance that the next child has it?", options: ["0, because they have already had one", "1 in 4, the same as every child", "1 in 2", "Certain"], answer: 1, why: "Each child is a new chance. The earlier children do not change it." },
  { maxBand: "y7-8", q: "What is a carrier?", options: ["Someone who has the condition", "Someone with one copy of a recessive version who does not have the condition", "Someone who can catch the condition", "Someone with no copies"], answer: 1, why: "Carriers have one recessive allele that is hidden by the other copy. They can pass it on." },
  { maxBand: "y7-8", q: "Does 'dominant' mean the version that most people have?", options: ["Yes", "No, it means it shows up even when only one copy is present", "Yes, in every case", "It means the version is harmful"], answer: 1, why: "Dominant is about how the version behaves, not how common it is. Lactase persistence is dominant but most people in the world do not have it." },
  { maxBand: "y7-8", q: "You have 10 children in the simulator from two carriers and get 1 child with the condition, not 2 or 3. Why?", options: ["The simulator is broken", "Chance. Small groups often differ from the expected ratio", "The ratio is wrong", "Carriers can't have affected children"], answer: 1, why: "Expected ratios are chances, not promises. Larger groups come closer to the expected ratio." },
  // Years 9-10
  { band: "y9-10", maxBand: "y9-10", q: "Two unaffected parents have a daughter with a condition. Which pattern does this rule out?", options: ["Autosomal recessive", "Autosomal dominant", "Both could be true", "Neither could be true"], answer: 1, why: "A dominant condition needs an affected parent (barring a new mutation). Unaffected parents with an affected child suggest a recessive condition." },
  { band: "y9-10", maxBand: "y9-10", q: "A colour-blind man (X-linked recessive) and a woman who is not a carrier have children. What do their children look like?", options: ["All sons colour-blind", "All daughters carriers, no sons colour-blind", "Half the sons colour-blind", "No children are carriers"], answer: 1, why: "The father's X goes to all his daughters (so they are carriers); his Y goes to his sons, who get their X from the mother, who has no recessive allele." },
  { band: "y9-10", maxBand: "y9-10", q: "Blood group A and blood group B parents have a child with blood group O. What are the parents' genotypes?", options: ["IᴬIᴬ and IᴮIᴮ", "Iᴬi and Iᴮi", "IᴬIᴮ and ii", "This can't happen"], answer: 1, why: "A child with group O is ii, so each parent gave an i. Both parents must carry i and so are heterozygous." },
  { band: "y9-10", maxBand: "y9-10", q: "Which statement best explains why height is not a simple Mendelian trait?", options: ["Height has a gene for each cm", "Many genes contribute small effects, and nutrition and health matter too", "Height is only environmental", "Height is controlled by a single dominant gene"], answer: 1, why: "Continuous traits are polygenic with environmental influence, giving a bell-shaped distribution rather than a few neat classes." },
  { band: "y9-10", maxBand: "y9-10", q: "RrYy × RrYy. About what fraction of offspring show both dominant traits (round and yellow)?", options: ["1/4", "3/16", "9/16", "1/16"], answer: 2, why: "3/4 round × 3/4 yellow = 9/16. The four phenotypes occur in the ratio 9 : 3 : 3 : 1." },
  { band: "y9-10", maxBand: "y9-10", q: "Is it correct to say 'eye colour is controlled by one gene, brown is dominant and blue is recessive'?", options: ["Yes, it's the whole story", "No. Several genes (OCA2 and HERC2 are the main ones) influence it, so that's a simplification", "No, eye colour is environmental", "Yes, but only for blue eyes"], answer: 1, why: "A single-gene brown/blue rule predicts some families well but fails for others. Several genes act together on the amount and type of pigment." },
  // Years 11-12
  { band: "y11", q: "Two unaffected parents have an affected DAUGHTER. Assuming full penetrance and no new mutation, which pattern fits?", options: ["Autosomal dominant", "X-linked recessive", "Autosomal recessive", "Any of the three"], answer: 2, why: "Unaffected parents rule out a dominant condition. An affected daughter would need a recessive X from her father, and a father with one recessive X-linked allele is affected. So both parents must be carriers of an autosomal recessive allele. (An affected SON of unaffected parents could be autosomal recessive or X-linked recessive.)" },
  { band: "y11", q: "A test cross AaBb × aabb gives 44 AaBb, 6 Aabb, 5 aaBb, 45 aabb. What does this indicate?", options: ["Independent assortment", "A and B are linked, about 11 map units apart", "A and B are on different chromosomes", "Both genes are X-linked"], answer: 1, why: "Independent assortment predicts 1 : 1 : 1 : 1. Excess parental types means linkage. Recombinants are 11 of 100 (about 11%), about 11 map units." },
  { band: "y11", q: "You breed 100 offspring from Aa × Aa and observe 66 dominant, 34 recessive. χ² for a 3 : 1 ratio is about 4.3 and the 5% critical value (df = 1) is 3.84. What is the best conclusion?", options: ["The data fit 3 : 1 well", "The data are unlikely to arise by chance if 3 : 1 is correct, so look for another explanation", "The result proves the ratio is 2 : 1", "χ² only works with 1000 offspring"], answer: 1, why: "4.3 > 3.84, so p < 0.05. That is evidence against 3 : 1 (not proof of any other ratio). Is there selection against the recessive homozygotes, or a different mating?" },
  { band: "y11", q: "Fifty percent of people with a particular genotype show the phenotype; those who do show it vary from mild to severe. Which two terms apply?", options: ["Incomplete penetrance, variable expressivity", "Codominance, epistasis", "Pleiotropy, linkage", "Complete penetrance, polygenic inheritance"], answer: 0, why: "Penetrance is the proportion of genotype carriers who show any phenotype. Expressivity is how strongly it shows in those who do." },
  { band: "y11", q: "Polygenic trait with many loci. Compared with a one-gene trait, the offspring distribution is…", options: ["Two or three distinct classes", "Continuous and bell-shaped, because many small independent effects sum", "Always 3 : 1", "Identical in parents and offspring"], answer: 1, why: "Adding many small independent contributions gives a distribution close to normal (central limit theorem). Environmental variation smooths it further." },
  { band: "y11", q: "Which statement about inheritance is correct?", options: ["Only changes in DNA base sequence can be inherited", "Some epigenetic marks (such as DNA methylation) can be copied when cells divide and sometimes pass between generations, though most are reset in gametes", "Acquired traits are inherited in all species", "Epigenetic marks change the DNA sequence"], answer: 1, why: "Heritable variation is mostly DNA sequence, but some epigenetic marks can be transmitted. Most epigenetic marks are reset during gamete formation, and the evidence in humans is limited." },
];

export { pick as pickBand };
