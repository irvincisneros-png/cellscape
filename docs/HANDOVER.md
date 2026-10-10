# CellScape: handover prompt for a new session

Paste everything below the line into a new Claude Code session opened in `~/Documents/Local Projects/Science Simulator Website/`.

---

You're continuing **CellScape**, a multi-scale 3D cell-biology simulator for NSW high-school science (Years 7–12). I'm a science teacher. Work in `cellscape/`, branch `main`. It's on GitHub as the **private** repo `irvincisneros-png/cellscape` (remote `origin`). The `gh` CLI is signed in, and there's no GitHub MCP server. Commit and push to `origin/main` as work lands. **Ask me before anything public**: making the repo public, GitHub Pages, publishing, or pushing to my other repos.

## Read first (in this order)
1. `cellscape/docs/PLAN.md`: phases, status table, known follow-ups.
2. `cellscape/docs/IDEAS.md`: my original ideas.
3. `cellscape/LEVEL_BRIEF.md`: the level contract, the rules every level follows, and the notes after Phase 2.
4. `cellscape/docs/AUDIT-other-sims.md`: audit of my 16 other sim repos, the absorption order, and the science errors found.
5. `cellscape/docs/briefs/`: the builder briefs used so far. They're good templates for new briefs.
6. `git log --oneline | head -40`.

## What exists
- **Stack:** static site, no build step. Three.js r169 is vendored in `assets/vendor/three` and loaded through an import map. Plain ES modules.
- **Engine** (`assets/js/world/`):
  - `engine.js`: renderer, the level stack, transactional `dive()`/`up()`, `swapRoot(id)`, `tween()`, `setStyle()`, picking, pause, quality tiers, and a scale bar (levels can hide it with `showScale: false`).
  - `shell.js`: page shell, the `LEVELS` registry, year lens, syllabus card, Graphics card (quality, and Look: Realistic or Clay), the theme slot, and the 🔬 Microscope stage button.
  - `lens.js`: year bands `y7-8`, `y9-10`, `y11`, `y12`.
  - `materials.js`: `glass()` (fresnel), `physical()`, `specks()`, `wobble()`.
  - `style.js`: the switchable **Clay model** art style. It swaps materials and restores them exactly. In clay, the plant and animal cells show as cutaway dioramas.
  - `theme.js`: page theme Auto, Light or Dark (saved as `cellscape.theme`). Light mode re-themes the page; the 3D stage stays dark on purpose.
  - `microscope.js`: microscopy mode (light microscope and electron microscope).
- **Homepage** `index.html` is the 3D plant cell. `?cell=animal` starts on the animal cell. Plant ⇄ animal switching is an in-place morph (`engine.swapRoot`). The old card grid is `library.html`.
- **Levels:**

  | Level | Leads to |
  |---|---|
  | plant cell (`cell`) / animal cell (`animal`, a hepatocyte) | below |
  | membrane | – |
  | chloroplast | thylakoid |
  | mitochondrion | cristae |
  | cytosol | enzymes |
  | nucleus | chromatin → dna → expression → folding |
  | nucleus panel | `karyotype` (UCSC-banded human chromosomes, gene loci) and `inheritance` (Punnett, ABO, sex-linked, dihybrid, polygenic, pedigrees) |
  | cell panels | `mitosis`, `meiosis`, `specialised` (specialised cells gallery) |
  | animal cell panel | `immunity` (innate and adaptive response, vaccination, herd immunity) |

  Organelle and other levels live in `assets/js/world/levels/`. Molecular sim levels live in `sims/<slug>/level.js`, with standalone pages and 2D fallbacks in `sim2d.js`.
- **Syllabus:** `content/syllabus.json` has 185 NSW dot points (Science 7–10 2023, Biology 2017 and 2025). Junior ones carry my school codes. Links work with `?year=`, `?dot=` and `?code=Y7-3.2.3`.
- **Shared model gene:** a β-globin fragment in `sims/protein-synthesis/model.js`. Codon 6 GAG→GTG is the sickle-cell mutation.
- **Tests:** `node tests/inheritanceModel.test.mjs` and `node tests/immunityModel.test.mjs`.
- **Data tool:** `tools/cytoband-to-karyotype.mjs` regenerates karyotype bands from UCSC `cytoBand.txt` (hg38).

## How to run and verify
- **Dev server:** `.claude/launch.json` (parent folder) has a config named `cellscape` (`python3 -m http.server 8420`). If port 8420 is already served by another session, open `preview_start {url: "http://localhost:8420/index.html"}`.
- **Test a dive:** in the page console:

  ```js
  const e = window.cellscape.engine;
  await e.dive(e.current.portals.find(p => p.to === "nucleus"));
  ```

  Panel-button levels: `await e.dive({to:"karyotype", label:"Karyotype", radius:1.3, center:()=>e.current.portals[0].center(), object:e.current.portals[0].object})`.
- **Front the tab:** the browser tab must be in front and the pane visible, or requestAnimationFrame stalls and dives and morphs never finish. If the pane is hidden, rely on node checks and screenshots.
- **Module caching:** the server sends no cache headers. Reload with `fetch(url, {cache: "reload"})` for each changed module, then `location.reload()`.
- **Check:** `node --check` every JS file, the console, portrait at 375×812, light and dark themes, and clay style.

## How I like to work
- **Decide, don't ask.** Go with your own recommendation, say it in one line, and keep building. Don't ask design or approval questions. Still ask before anything outward-facing.
- **Concise updates** in plain, teacher-friendly language.
- **Science accuracy matters most.** These go into classrooms. Narrative text must come from what the model is actually doing. Be honest about simplifications on the page itself.
- **Visual bar:** highly polished, realistic 3D in molecular-animation style (organic, translucent, crowded, subtle motion), never toy-like. Codex image generation (`codex-image`) is welcome for textures.
- **Builders:** write a precise brief in `docs/briefs/`. Dispatch **Sonnet 5.5** builder subagents (one per level, file-scoped, run in parallel). Use **Haiku 5.5** for searches and exploration to save tokens. Tell parallel builders which files they must not touch, and to use their own browser tab with `tabs_select` and an explicit `tabId`. Review each one in the browser before committing. Commit as you go.
- **Adversarial review by Codex:** use the `codex` skill (`codex-ask --cd cellscape "..."`). **Two rounds maximum.** Verify Codex's claims before fixing. Send fixes back to the builder that wrote the code, since it keeps its context.
- **Commits** end with the `Co-Authored-By` line from the system attribution reminder.
- Keep `docs/PLAN.md` (status table and follow-ups) up to date as work lands.

## Next steps
1. Start with a short status check (`git log`, `docs/PLAN.md`).
2. **Check by eye first:** several recent visuals were verified only by node probes because the browser pane was hidden (see `docs/PLAN.md` follow-ups: specialised cells, immunity, light-mode charts).
3. **Phase 5e, deeper epigenetics:** DNA methylation and histone marks switching genes on and off; X-inactivation and Barr bodies (link to the karyotype); environment effects; correct the "only genetic changes are heritable" framing. Mostly extends `levels/chromatin.js`.
4. **Phase 6, polish and publish:**
   - real-device QA (Chromebooks, phones, touch);
   - clay style polish on every level;
   - a "Sun and shade leaf" mission (cellarium idea);
   - quiz banks from science-defender (shuffle and de-duplicate first);
   - teacher mode, accessibility and performance tiers;
   - GitHub Pages, **after asking me**.
5. **Outside CellScape (ask before pushing):** the Year-10-Science genetics fixes (TX/tx labels, codons, pedigree wording, eye colour) are committed on local branch `fix/genetics-science-errors`, not pushed. `equilibrium-lost` is excluded from the suite.
6. I may want to play with it and give feedback first. If I do, prioritise my feedback over the plan.
