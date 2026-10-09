# CellScape — Plan (draft for owner review, 2026-10-09)

Built from `IDEAS.md`. One 3D, multi-scale, highly interactive cell-biology world used from Year 7 to Year 12.

## Four pillars

1. **One zoomable 3D world.** Cell → organelle → molecule, continuous zoom. Right-drag orbits, the wheel or a pinch zooms, and clicking interacts. Graphics match the reference animations: glassy membranes, glossy proteins, depth of field and bloom.
2. **Interactions, not labels.** Every level is a working system. Organelles pass glucose, O₂, CO₂, ATP, mRNA, proteins and water to each other. Students change something (the light level, an organelle switched off, a blocked pore, an inhibitor) and watch the effect spread through the cell. Mitosis and meiosis show how the spindle, kinetochores, cohesin, checkpoints and chromosomes depend on each other.
3. **Year-level lens.** A single "Year / dot point" setting controls labels, vocabulary, how deep the zoom goes, which variables and missions appear, and the quiz bank. Each content item is tagged to NSW syllabus dot points, so a teacher can open the world filtered to one dot point.
4. **Learning pathways.** These are guided routes through the world that the teacher or student can follow, or step off at any point:
   - **Cells & organelles:** animal and plant cells; how the organelles work together.
   - **Energy:** photosynthesis ↔ respiration; ATP; enzymes.
   - **Membranes:** diffusion, osmosis, active transport, vesicles.
   - **Cell division:** the cell cycle, mitosis, meiosis, checkpoints, nondisjunction.
   - **Genetics:** DNA structure → protein synthesis → protein folding → mutation types and their effects → human genes → epigenetics → inheritance.
   - **Cells in systems (later):** red blood cells and oxygen transport, gas exchange.

## Phases

| Phase | Delivers | Notes |
|---|---|---|
| 1. Foundation | 3D engine with multi-scale zoom; **working plant cell** (organelle flows, knockouts, light/CO₂); membrane level (already 3D); year-lens framework; homepage = the cell | Engine and cell model drafted |
| 2. Energy | Chloroplast → thylakoid (photosynthesis); mitochondrion → cristae / ATP synthase (respiration); enzymes | Reuse the existing 2D models |
| 3. Genetics | Nucleus → chromosome → DNA helix (bases, sugar-phosphate backbone) → transcription/translation → folding → mutation lab | Reuse the protein-synthesis model |
| 4. Division | 3D mitosis and meiosis running inside the cell, every part interacting | Reuse the mitosis/meiosis models |
| 5. Heredity & beyond | Human genes, epigenetics (methylation, histones), inheritance (gametes → offspring, Punnett patterns from runs); animal cell toggle; RBC / O₂ transport | |

The existing 2D simulations stay live as fallbacks until each one has its 3D replacement.

## Syllabus mapping (needed for the lens)

The NSW Science 7–10 (2023) and Biology 11–12 syllabuses will be researched to extract outcomes and dot points into `content/syllabus.json`. Every label, mission and quiz item gets tagged with them, plus a year band (7–8, 9–10, 11, 12).
