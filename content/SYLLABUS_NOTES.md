# CellScape syllabus map: notes

Data file: `syllabus.json` (185 dot points, retrieved 2026-10-09). The file covers only content relevant to cells.

## Sources and status

| Syllabus | Status in Oct 2026 | Source |
|---|---|---|
| Science 7–10 (2023), Stages 4–5 | In force since 2026 | curriculum.nsw.edu.au focus-area pages (Stage 4: Cells and classification, Living systems, Change; Stage 5: Genetics and evolutionary change, Disease) |
| Biology Stage 6 (2017), Modules 1–8 | Current. Year 11 teaches it in 2026. Year 12 continues with it until Term 4 2027. | Official NESA syllabus DOCX (nsw.gov.au/…/biology-stage-6-syllabus-2017.docx) |
| Biology 11–12 (2025) | New syllabus. Year 11 starts Term 1 2027 and Year 12 starts Term 4 2027. First HSC is in 2028. | curriculum.nsw.edu.au focus-area pages (Y11: Cells as the basis of life, Cells to systems, Evolution and ecosystems; Y12: Heredity, Diseases, Biodiversity, Biotechnology) |

The brief asked only for the 2017 Biology modules. The 2025 Biology syllabus starts in Year 11 in about 3 months, so I added it too. You can filter on the `syllabus` field to use one version or the other.

## Counts

| Band | Science 7–10 (2023) | Biology 2017 | Biology 2025 | Total |
|---|---|---|---|---|
| y7-8 | 17 | – | – | 17 |
| y9-10 | 16 | – | – | 16 |
| y11 | – | 23 (M1 8, M2 13, M3 2) | 54 | 77 |
| y12 | – | 26 (M5 11, M6 11, M7 3, M8 1) | 49 | 75 |

## Changes to the requested schema

- **New topic tags (4):** `biotechnology` (genetic technologies, recombinant DNA, cloning, gene therapy), `immunity` (immune cells and antibodies), `evolution` (natural selection where it involves genetics), `plant-transport` (xylem, phloem, transpiration and translocation; kept apart from `blood-transport`). All four are also listed in `extra_topic_tags` in the JSON.
- **New fields:**
  - `content_group`: the content group name, or the 2017 sub-heading.
  - `subpoints`: the exact nested sub-dot points.
  - `acara_codes`: the ACSBL codes, removed from the 2017 text.
  - `source_url`: the source page for each dot point.
  - `note`: set on 3 dot points only.
- `inquiry_question` is present only for Biology 2017. The 7–10 (2023) and Biology 2025 syllabuses have no inquiry questions.
- Each top-level dot point is one record. For 2017 dot points that end in "including but not limited to:", the text ends with that phrase and the detail is in `subpoints`.
- Every record has `paraphrased: false`. A script checked each text and sub-point against the downloaded source, and all matched word for word except the 3 items below.

## Topic tag coverage (bands and depth)

| Tag | Bands | Depth |
|---|---|---|
| cell-structure | 7-8, 11 | Y7–8: cell theory, comparing plant and animal cells. Y11: prokaryotic vs eukaryotic ultrastructure. |
| organelles | 7-8, 11 | Y7–8: membrane, cytoplasm, nucleus, mitochondria and chloroplast functions. Y11 (2025): full list including ER, Golgi, lysosomes, ribosomes, vacuoles. |
| membrane | 7-8 (light), 11 | Y7–8: names the membrane's function only. Y11: fluid mosaic model with phospholipids, proteins, cholesterol and glycoproteins. |
| diffusion | 11 (plus implied at 7-8) | No explicit Stage 4–5 dot point. Y11: simple and facilitated diffusion, SA:V ratio, concentration gradients, alveoli, nephron, dialysis. |
| osmosis | 11 | Y11 only: practical work, hypertonic/hypotonic/isotonic effects on plant and animal cells, cohesion-tension theory. |
| active-transport | 11 | Y11 only: active transport, endocytosis, exocytosis, nephron reabsorption, translocation. |
| enzymes | 11, 12 (light) | Y11: enzyme action, lock-and-key and induced-fit models, effects of temperature, pH and substrate concentration. Y12: protein function and DNA replication enzymes. |
| photosynthesis | 7-8, 11 | Y7–8: chloroplasts and modelling the process. Y11: summary equation, required conditions, practical work on limiting factors. |
| respiration | 7-8, 11 | Y7–8: mitochondria and modelling the process. Y11: summary equation and cell requirements. |
| atp | 11 (inferred) | No dot point names ATP. The tag is inferred from "cell respiration" (2017 M1), the respiration equation ("+ energy") and active transport (2025). |
| cell-cycle | 9-10 (HeLa only), 11 (2025), 12 (2017) | 2025 Y11: G1, S and G2 phases and DNA replication (helicase, primase, polymerase, ligase). 2017: under M5 cell replication (Y12). |
| mitosis | 9-10 (implied), 11 (2025), 12 (2017) | Modelling the named phases of mitosis and cytokinesis. Stage 5 only implies it through asexual reproduction. |
| meiosis | 9-10 (implied), 11 and 12 | Crossing over, independent assortment, random segregation, non-disjunction (2025 Y12). |
| dna-structure | 9-10, 11, 12 | Y9–10: double helix; DNA, gene, chromosome and genome. Stage 6: nucleotides, base pairing, hydrogen bonding, prokaryotic vs eukaryotic DNA forms. |
| protein-synthesis | 12 (plus 1 in Y11 2025) | Transcription and translation, mRNA and tRNA, codon tables, introns and exons, alternative splicing (2025). |
| protein-folding | 11 (light), 12 | 2025 Y12: primary to quaternary structure and function. 2017: "structure and function of proteins" only. |
| mutation | 9-10, 11 (light), 12 | Y9–10: mutation causes variation. Y12: mutagens; point vs chromosomal; silent, missense, nonsense and frameshift; somatic vs germline; SNPs. |
| genes | 9-10, 12 | Genotype and phenotype, gene–environment interaction, coding vs non-coding DNA. |
| epigenetics | 12 (2025 only) | Explicit only in 2025 Heredity ("Assess how epigenetic changes influence phenotype"). It is not in 2017 Module 5 or Module 8. |
| inheritance | 9-10, 11, 12 | Y9–10: Mendelian monogenic inheritance, Punnett squares, pedigrees. Y12: codominance, incomplete dominance, sex-linked inheritance, multiple alleles. |
| gas-exchange | 7-8, 11 | Y7–8: respiratory system at organ level. Y11: alveoli and leaf structure, composition of blood. |
| blood-transport | 7-8, 11 | Y7–8: circulatory system. Y11: arteries, capillaries and veins; blood components; open vs closed systems. |
| microscopy | 7-8, 11 | Y7–8: observing and drawing cells. Y11: wet mounts, the cell-size calculation, impact of microscopy technology. |
| prokaryote-eukaryote | 7-8 (light), 11, 12 | Y7–8: bacterial vs other cells. Y11: prokaryotic structures (capsule, plasmid, pili, flagella). Y12: classifying pathogens. |
| specialised-cells | 7-8, 11, 12 | Y7–8: cells, tissues and organs; specialised cells. Y11: differentiation, unicellular/colonial/multicellular, blood cells. Y12: immune cells. |
| biotechnology (new) | 9-10, 12 | Y9–10: genetic technologies, genetic testing, HeLa ethics. Y12: recombinant DNA, cloning, gene therapy, insulin production. |
| immunity (new) | 9-10, 12 | Y9–10: barriers, antibodies, vaccination. Y12: innate and adaptive immunity; T cells, B cells, interleukins. |
| evolution (new) | 9-10, 11, 12 | Only where it involves genetics: natural selection, DNA and amino-acid phylogeny, allele frequencies, antibiotic resistance. |
| plant-transport (new) | 7-8, 11 | Y7–8: xylem and phloem roles. Y11: cohesion-tension theory, translocation, transpiration. |

## Gaps (what the syllabuses do not cover)

- **Stage 5 (Years 9–10) has no dot points on mitosis, meiosis or the cell cycle.** Reproduction appears only as "sexual and asexual reproduction". Stage 5 also has no content on membranes, transport or energy in cells.
- **No dot point in any band names ATP.** The `atp` tags are inferred (see the coverage table).
- **Epigenetics appears only in Biology 2025, Year 12.** It is not in the 2017 syllabus.
- **The 2017 sequence differs from 2025.** In 2017, cell division and DNA replication are in Year 12 (Module 5). In 2025 they move to Year 11 (Cells as the basis of life).
- **The 2017 Module 1 is less specific than 2025.** It names no organelle list and has no tonicity dot point, only "modelling diffusion and osmosis".

## Excluded on purpose

- Classification, ecosystem and biodiversity-conservation dot points.
- Homeostasis (feedback loops, hormones).
- Epidemiology.
- Module 8 disorder technologies (including dialysis in 2017).
- Reproductive technologies such as artificial insemination.
- The Stage 5 Reactions dot point on catalysts and reaction rate. It is useful context for enzymes, but it names no enzymes or cells.
- Life Skills outcomes and Working Scientifically skills outcomes. These appear only as context on the source pages.

## Items not fully verified

- In three Biology 2025 dot points the equation is shown as plain text: two summary equations (respiration and photosynthesis) and the cell-size equation. The source pages show these as MathML, so I could not check them word for word. Each of these records has a `note` field.
- The 7–10 and 2025 text was extracted from the website's embedded CMS data, not from a PDF. NESA may still edit these pages. The 2025 Year 11 pages were last modified in September 2025.
- The "including" statements and examples on the website pages were empty for all included items.
