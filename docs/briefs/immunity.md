# Builder brief: Immune defence level (Phase 5d)

## Syllabus (`content/syllabus.json`, topic `immunity`)
**Science 7–10 (Y9–10):**
- how the body prevents pathogen entry and responds to pathogens that enter;
- how vaccination stimulates antibody production.

**Biology Y12 (2017 Module 7 and 2025):**
- innate vs adaptive immunity;
- barriers and secretions, phagocytic leukocytes, inflammation;
- interleukin signalling between innate and adaptive cells;
- helper T, cytotoxic T, memory T and suppressor (regulatory) T cells;
- plasma cells, memory B cells, antibodies;
- the primary vs secondary response;
- classifying pathogens: cellular (bacteria, protozoa, fungi) vs non-cellular (viruses, prions).

**Y7–8:** a gentle "how your body fights germs" view.

**Owner priorities.** Science accuracy, and a **highly polished, realistic molecular-animation 3D look**: think of the classic "inner life of the cell" white-blood-cell animations. Use organic, translucent fresnel materials, crowding and subtle motion. Nothing toy-like.

## Read first
- `LEVEL_BRIEF.md`.
- `assets/js/world/levels/animalCell.js`, the best patterns: panel, missions, quiz, instancing, the sinusoid with red blood cells.
- `assets/js/world/materials.js` and `style.js`. Clay style swaps materials automatically; check it looks fine.

**Absorb ideas** (read-only) from the owner's Year 9 diseases site: `/private/tmp/claude-501/-Users-irvincisneros-Documents-Local-Projects-Science-Simulator-Website/f53b06d0-9e95-448e-9b94-69d20b1787b7/scratchpad/audit/Year-9/diseases/src/`, especially `interactives/vaccine-response.jsx`, `three-lines.jsx` and `herd-immunity.jsx`.

**Known errors in that source. Don't repeat them:**
- "memory cells… why you only get chickenpox once": varicella-zoster virus stays dormant and can reactivate as shingles.
- "Viruses: non-living", stated flatly: present it as a debated boundary case.
- Herd-immunity thresholds inconsistent with 1 − 1/R₀.
- "Vaccinated people don't pass on the pathogen": overstated for non-sterilising vaccines.

## Files
**Create only** `assets/js/world/levels/immunity.js`, plus optional `immunityContent.js` and `immunityModel.js` (pure, node-testable).

`immunity` is already registered in `shell.js`. I'll add the entry button in the animal-cell panel myself later. For testing, dive from the animal cell with `engine.dive({to:"immunity", label:"Immune defence", radius:5, center:()=>new THREE.Vector3(), object:null})`. Read `engine.stack[0].id`.

**Don't edit** `cell.js`, `animalCell.js`, `engine.js`, `shell.js`, `microscope.js` or the specialised-cells files. Other builders own them.

## Scene: a wound in tissue next to a capillary
1. **Barrier breach.**
   - Skin surface (stylised epidermis layers) with a cut.
   - Bacteria enter: rod-shaped bacilli with flagella, shown at true scale relative to cells (about 2 µm vs a neutrophil about 12 µm).
   - Optional virus particles (about 0.1 µm, far smaller). Show them as tiny dots with a magnified inset, and say so.
2. **Innate response (fast, non-specific).**
   - Damaged cells and mast cells release signals. Inflammation follows: the capillary widens and gets leakier.
   - **Neutrophils** squeeze out of the capillary (diapedesis) and migrate along the chemical signal (chemotaxis).
   - **Macrophages** crawl with ruffled membranes. **Phagocytosis** is shown properly:
     1. pseudopodia wrap the bacterium;
     2. a phagosome forms;
     3. a lysosome fuses with it (phagolysosome);
     4. the bacterium is digested.
   - Link to the animal cell's lysosomes in the text.
   - Fever and complement can be text only (Y11+).
3. **Adaptive response (slower, specific, with memory).** Shown as a second stage or a "lymph node" inset scene.
   - A dendritic cell (or macrophage) **presents antigen** on MHC.
   - A **helper T cell** recognises it and releases **interleukins**, activating:
     - **B cells:** they clonally expand into **plasma cells**, which secrete thousands of Y-shaped **antibodies** (IgG drawn with two antigen-binding arms). Antibodies bind antigens, causing agglutination, neutralisation and opsonisation (making phagocytosis easier).
     - **Cytotoxic T cells:** they kill infected host cells (perforin), relevant for viruses.
   - **Memory B and memory T cells** remain.
   - Regulatory (suppressor) T cells damp the response down afterwards (Y12, text plus a small visual).
4. **Pathogen menu.** A bacterium (default), a virus (needs cytotoxic T cells for infected cells; antibodies neutralise free virus), and a "prion / non-cellular" text card for Y12 classification.

## Model (`immunityModel.js`)
A small ODE or agent hybrid at teaching scale:
- pathogen load grows logistically;
- innate killing depends on phagocyte count;
- adaptive cells activate after a lag of about 4–7 "days" on first exposure;
- antibody level drives clearance.

**Required output:** antibody concentration vs time (log scale optional) showing:
- **Primary exposure:** a lag of about 7–10 days, then a modest peak, mainly IgM first, then IgG (Y12).
- **Secondary exposure:** a short lag of 1–3 days, a much larger, longer-lasting peak, mostly IgG, from memory cells.

**Controls:**
- infect;
- reinfect later (same pathogen, so a secondary response);
- infect with a different pathogen (no memory, so a primary response again);
- **vaccinate**: inactivated antigen, so a primary response with no illness, then a later infection gets the secondary response;
- time speed;
- immune-compromised toggle (Y11+: e.g. fewer helper T cells, linked to HIV in text).

The narrative is generated from model state: "Day 3: neutrophils are engulfing bacteria; no antibodies yet…".

**Herd immunity mini-panel (Y9–10).** An R₀ slider and a vaccination % slider. The threshold is 1 − 1/R₀. A small population simulation (dots) shows outbreak spread with and without herd immunity. Measles R₀ is about 12–18, so the threshold is about 92–95%. Say vaccines vary in how much they block transmission.

## Year lens
- **Y7–8:** germs, skin barrier, white blood cells eat germs, antibodies, vaccines train your body.
- **Y9–10:** three lines of defence, phagocytosis, antibodies, memory cells, vaccination, herd immunity.
- **Y11–12:** all the terminology listed in the syllabus section above.

**Missions (6) and quiz (6), banded.** Examples:
- watch a macrophage digest a bacterium;
- get antibodies to peak;
- show the secondary response is faster;
- vaccinate then infect;
- reach herd immunity for measles;
- Y12: identify which cell kills virus-infected cells.

## Verify, then report
- Run `node --check` and a node model test checking the primary vs secondary lag and peak ratio.
- At http://localhost:8420, use your own new tab, call `tabs_select` before animation tests, and pass `tabId` on every browser call. Other builders share the pane; never touch their tabs.
- Check all 4 year bands, light and dark page themes, clay style, portrait 375×812, up/back, and the console.
- Take screenshots and polish.
- Don't commit.
- Report in under 400 words.
