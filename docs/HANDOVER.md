# CellScape — Handover prompt for a new session

Paste everything below the line into a new Claude Code session opened in `~/Documents/Local Projects/Science Simulator Website/`.

---

You're continuing **CellScape**, a multi-scale 3D cell-biology simulator I'm building for NSW high-school science (Years 7–12). I'm a science teacher. Work in `cellscape/` (a local git repo, branch `main`). **It is not on GitHub yet: ask me before creating a repo or pushing anything.**

## Read first (in this order)
1. `cellscape/docs/PLAN.md`: scope, pillars, phases (1–4 done, 5 next), known follow-ups.
2. `cellscape/docs/IDEAS.md`: my original ideas, in my words.
3. `cellscape/LEVEL_BRIEF.md`: the level contract and the rules every level follows. Read its "Notes added after Phase 2" too.
4. `cellscape/content/SYLLABUS_NOTES.md`: syllabus mapping notes.
5. Skim `git log --oneline` for history.

## What exists
- **Stack:** static site, no build step. Three.js r169 is vendored in `assets/vendor/three`, loaded through an import map. Vanilla ES modules.
- **Engine** (`assets/js/world/`):
  - `engine.js`: renderer, orbit/zoom-to-cursor, level stack, transactional `dive()`/`up()`, picking, keyboard, pause (`update(simDt, simTime, realDt)`), GPU disposal.
  - `shell.js`: page shell, `LEVELS` registry, year-lens select, syllabus card, pause, graphics quality.
  - `lens.js`: year bands `y7-8`, `y9-10`, `y11`, `y12`.
  - `materials.js`: glass/fresnel and other material helpers.
- **Homepage** `index.html` is the 3D plant cell. The old card grid is `library.html`.
- **Levels (15).** The zoom chain:

  | From the plant cell | Leads to |
  |---|---|
  | membrane | – |
  | chloroplast | thylakoid |
  | mitochondrion | cristae |
  | cytosol | enzymes |
  | nucleus | chromatin → dna → expression → folding |
  | "Cell division" card | mitosis, meiosis |

  Organelle levels are in `assets/js/world/levels/`. Molecular sim levels are in `sims/<slug>/level.js` and have their own standalone pages. Each standalone page has a 2D fallback in `sim2d.js`.
- **Syllabus:** `content/syllabus.json` holds 185 cell-relevant NSW dot points:
  - Science 7–10 (2023), Biology 2017 and Biology 2025 (2025 starts in Year 11 from Term 1 2027);
  - the junior ones are tagged with my school's codes (`school_code`, e.g. `Y7 3.2.3`), taken from my doc `~/Documents/Local Projects/Spark the Question/YouTube Shorts/NSW Junior Science Syllabus.docx`;
  - links work with `?year=`, `?dot=` and `?code=Y7-3.2.3`.
- **The shared model gene** is a β-globin fragment in `sims/protein-synthesis/model.js`. Codon 6 GAG→GTG is the sickle-cell mutation.

## How to run and verify
- **Dev server:** `.claude/launch.json` in the parent folder has a config named `cellscape` (`python3 -m http.server 8420`). Start it with the browser preview tool, `preview_start {name: "cellscape"}`, not with Bash.
- **Test a dive:** in the page console:

  ```js
  const e = window.cellscape.engine;
  await e.dive(e.current.portals.find(p => p.to === "nucleus"));
  ```

  Climb back up with `await e.up()`.
- **Front the tab:** the browser tab must be in front, or requestAnimationFrame stalls and dives never finish.
- **Module caching:** the server sends no cache headers. After editing modules, reload with a cache-busting query or fetch them with `{cache: "reload"}`.
- **Check:** `node --check` every JS file; check the console; test portrait at 375×812.

## How I like to work
- **Concise updates.** Plain teacher-friendly language in summaries.
- **Science accuracy matters most.** These go into classrooms. Narrative text must come from what the model is actually doing, never from switch states alone. Be honest about simplifications on the page itself (e.g. "model gene: human, shown in a plant cell").
- **Adversarial reviews by Codex:** use the `codex` skill (`codex-ask --cd cellscape "..."`). **Two rounds maximum.** Verify Codex's claims before fixing.
- **Parallel builders:** for big pieces, write a precise brief and dispatch builder agents (one per level, file-scoped). Review each one in the browser before committing. Commit as you go.
- **Commits** end with the `Co-Authored-By` line from the system attribution reminder.
- **Ask before anything outward-facing:** GitHub, publishing, sending.

## Next steps
1. Start with a short status check. Then ask me whether to do **Phase 5** (heredity & beyond: human genes/karyotype, deeper epigenetics, inheritance including sex linkage and multi-gene traits, an **animal cell** level/toggle, specialised cells, microscopy mode, cell-level immunity) or **Phase 6** (polish & publish) first.
2. I may want to play with it and give feedback first. If I do, prioritise my feedback over the plan.
3. Keep `docs/PLAN.md` (status table and follow-ups) up to date as work lands.
