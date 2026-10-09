# Builder brief: Light mode (page theme)

Owner request: "Right now you have dark mode, could you make a light mode version as well."

## Decision
Light mode re-themes the **page chrome**: the header, side panel, cards, buttons, sliders, segmented controls, chips, the quiz and missions, tooltips, toasts, `library.html`, and the standalone sim pages including their 2D fallbacks.

The **3D stage keeps its dark cinematic backdrop** in both themes, like a video player embedded in a light page. The glass, fresnel, bloom and depth-of-field rendering assumes a dark background. Stage overlays (chips, 3D labels, the pause, microscope and up buttons, the tour caption) stay legible against the dark stage in both themes, so keep their current dark-pill styling.

The clay art style already has its own light studio backdrop and is unaffected.

## Files
- Fill in `assets/js/world/theme.js`: `mountThemeToggle(slot)`. The slot is already in the header via `shell.js`; don't edit `shell.js`.
  - Add a small 3-way control: Auto, Light, Dark. Auto follows `prefers-color-scheme`.
  - Persist the choice in localStorage under `cellscape.theme`. Wrap it in try/catch, since storage may be blocked.
  - Apply it as `document.documentElement.dataset.theme = "light" | "dark"`.
  - Apply the theme as early as possible to avoid a flash. Export an `applyStoredTheme()` and add a tiny inline `<script>` in each HTML `<head>` that sets `data-theme` before CSS paints. List the HTML files you edit.
- `assets/css/cellscape.css` and `assets/css/world.css`:
  - Add a light token set under `:root[data-theme="light"]`, and `color-scheme: light`.
  - Replace hard-coded dark colours in rules with tokens wherever they style page chrome.
  - Use a warm off-white panel background, ink around `#14202e`, and the same accents darkened enough for 4.5:1 contrast on light.
  - Keep stage-overlay rules on explicit dark values.
- **Level-injected CSS:** several levels inject `<style>` blocks with hard-coded dark colours for panel content. Grep `sims/*/level.js`, `sims/*/sim2d.js` and `assets/js/world/levels/*.js` for `textContent = CSS` / `<style`.
  - Convert the panel-content colours to the CSS variables so they follow the theme.
  - Only touch the CSS strings. Don't change logic.
  - **Don't edit these files**, which other builders own right now: `assets/js/world/microscope.js`, `assets/js/world/levels/specialised.js` (and its content/model files), `engine.js`, `shell.js`.
- **Canvas-drawn panel charts** (mini charts in cell.js, animalCell.js and others) use hard-coded light-on-dark grid and text colours. Read the colours from computed CSS variables at draw time, e.g. `getComputedStyle(document.documentElement).getPropertyValue("--ink-dim")`, so they work in both themes. Charts drawn on the 3D stage stay dark.

## Checks
- WCAG AA text contrast in light mode for body text, dim text, buttons, and selected and disabled states.
- Check `index.html` with the plant and animal cells, the nucleus, karyotype, inheritance, mitosis and meiosis panels, `library.html`, two standalone sim pages including one 2D fallback (open `sims/osmosis/index.html` or force the fallback), and portrait 375×812.
- Toggling must not reload the page or reset the sim.

## Verify, then report
- Run `node --check`.
- Use http://localhost:8420 in your own new tab. Call `tabs_select` on it before tests; other builders share the pane, so never touch their tabs.
- Take screenshots in both themes.
- Don't commit.
- Report in under 250 words: files touched, the tokens, and anything left dark on purpose.
