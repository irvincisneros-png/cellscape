# CellScape — Interactive Cell Biology

Interactive, manipulable versions of the cell-biology animations students usually only watch.
Static site (HTML + ES modules + Canvas 2D), no build step — deploys straight to GitHub Pages.

## Run locally

```bash
python3 -m http.server 8420
```

Then open http://localhost:8420.

## Structure

- `index.html`, `assets/js/hub.js` — homepage; cards come from `assets/js/catalog.js`
- `assets/js/kit.js`, `assets/css/cellscape.css` — shared stage, controls, missions, quiz, drawing helpers
- `sims/<slug>/` — one folder per simulation (`index.html` + `sim.js`)
- `sims/_template/` — starting point for a new sim
- `BUILDER_BRIEF.md` — the contract every sim follows (for humans and coding agents)

## Simulations

| Sim | Syllabus |
| --- | --- |
| Cell Explorer | Stage 4 Cells; Bio Y11 M1 |
| Membrane Transport | Bio Y11 M1 |
| Osmosis & Tonicity | Stage 5; Bio Y11 M1 |
| Enzyme Lab | Stage 5; Bio Y11 M1 |
| Photosynthesis | Stage 4–5; Bio Y11 M1 |
| The ATP Factory (respiration) | Bio Y11 M1 |
| Oxygen Transport (haemoglobin) | Bio Y11 M2 |
| Mitosis | Bio Y12 M5 |
| Meiosis & Variation | Bio Y12 M5 |
| DNA to Protein | Bio Y12 M5 |
