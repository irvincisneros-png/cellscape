// Boots a CellScape 3D page: header breadcrumbs, year lens, stage, panel, engine, main loop.
// Used by the homepage (the zoomable cell) and by each simulation page (a single level).
import * as K from "../kit.js";
import { Engine } from "./engine.js";
import { lens, BANDS } from "./lens.js";

export const LEVELS = {
  cell: { title: "Plant cell", load: () => import("./levels/cell.js") },
  membrane: { title: "Cell membrane", load: () => import("../../../sims/membrane-transport/level.js") },
};

/**
 * opts: { start: level id, levels?: registry, root: path prefix to site root (e.g. "" or "../../") }
 */
export async function boot(opts) {
  const root = opts.root ?? "";
  const levels = opts.levels || LEVELS;
  const header = K.$(".sim-header");
  header.innerHTML = `
    <a class="back" href="${root}index.html" title="CellScape home">CellScape</a>
    <nav class="crumbs" aria-label="Zoom level"></nav>
    <select class="lens-select" aria-label="Year level"></select>
    <a class="lib" href="${root}library.html">All simulations</a>`;
  const crumbs = K.$(".crumbs", header);
  const sel = K.$(".lens-select", header);
  sel.innerHTML = BANDS.map((b) => `<option value="${b.id}">${b.label}</option>`).join("");
  sel.value = lens.band;
  sel.addEventListener("change", () => lens.set(sel.value));

  const stageEl = K.$("#stage");
  const panelEl = K.$("#panel");
  const levelPanel = document.createElement("div");
  levelPanel.className = "level-panel";
  levelPanel.style.display = "contents";
  panelEl.appendChild(levelPanel);

  const scaleEl = document.createElement("div");
  scaleEl.className = "cs-scale";
  stageEl.appendChild(scaleEl);
  const hint = document.createElement("div");
  hint.className = "cs-hint";
  hint.innerHTML = "Right-drag (or drag empty space) to look around · scroll / pinch to zoom · double-click to dive in · zoom out to go back up";
  stageEl.appendChild(hint);
  const upBtn = document.createElement("button");
  upBtn.className = "btn cs-up";
  upBtn.type = "button";
  stageEl.appendChild(upBtn);

  const toast = K.toaster(stageEl);
  const engine = new Engine({
    canvas: K.$("#canvas"), stageEl, panel: levelPanel, labelLayer: K.$("#labels"), overlay: K.$("#overlay"),
    scaleEl, levels, toast, root,
  });
  engine.lens = lens;
  window.cellscape = { engine };

  upBtn.addEventListener("click", () => engine.up());
  // pause freezes the cell's processes (the camera still moves) — for explaining a moment in class
  const pauseBtn = document.createElement("button");
  pauseBtn.className = "btn cs-pause";
  pauseBtn.type = "button";
  pauseBtn.textContent = "⏸ Pause";
  pauseBtn.setAttribute("aria-pressed", "false");
  pauseBtn.addEventListener("click", () => {
    engine.paused = !engine.paused;
    pauseBtn.textContent = engine.paused ? "▶ Play" : "⏸ Pause";
    pauseBtn.setAttribute("aria-pressed", String(engine.paused));
  });
  stageEl.appendChild(pauseBtn);
  engine.onChange = (stack) => {
    crumbs.innerHTML = "";
    stack.forEach((s, i) => {
      if (i) crumbs.insertAdjacentHTML("beforeend", `<span class="sep">›</span>`);
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = s.title;
      if (i === stack.length - 1) b.setAttribute("aria-current", "true");
      else b.addEventListener("click", () => engine.up(stack.length - 1 - i));
      crumbs.appendChild(b);
    });
    upBtn.style.display = stack.length > 1 ? "" : "none";
    if (stack.length > 1) upBtn.textContent = `↑ Back to ${stack[stack.length - 2].title.toLowerCase()}`;
    document.title = `${stack.at(-1).title} · CellScape`;
  };
  lens.on(() => engine.current?.onLens?.(lens.band));

  // ---------- syllabus card: the dot points this level covers at the current year level ----------
  let syl = null;
  try { syl = await (await fetch(`${root}content/syllabus.json`)).json(); } catch { /* offline: card hidden */ }
  const dotParam = new URLSearchParams(location.search).get("dot");
  const focusDot = syl && dotParam ? syl.dotpoints.find((d) => d.id === dotParam) : null;
  if (focusDot) lens.set(focusDot.band);
  const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  const sylCard = K.card(panelEl, "Syllabus links");
  const sylBody = document.createElement("div");
  sylCard.appendChild(sylBody);
  let sylVersion = focusDot && focusDot.band.startsWith("y1") ? focusDot.syllabus : null; // Year 11/12 syllabus version
  function renderSyllabus() {
    const L = engine.current;
    if (!syl || !L?.topics) { sylCard.style.display = "none"; return; }
    sylCard.style.display = "";
    const band = lens.band, stage6 = band === "y11" || band === "y12";
    // the 2025 Biology syllabus starts in Year 11 from Term 1 2027 and Year 12 from Term 4 2027
    const now = new Date(), y = now.getFullYear(), term4 = now.getMonth() >= 9;
    const new25 = band === "y11" ? y >= 2027 : y > 2027 || (y === 2027 && term4);
    const def = new25 ? "Biology 11–12 (2025)" : "Biology Stage 6 (2017)";
    const ver = stage6 ? (sylVersion || def) : null;
    const items = syl.dotpoints.filter((d) => d.band === band && (!ver || d.syllabus === ver) && d.topics.some((t) => L.topics.includes(t)));
    const toggle = stage6 ? `<div class="segmented" style="margin-bottom:8px">${["Biology 11–12 (2025)", "Biology Stage 6 (2017)"].map((v) => `<button type="button" data-v="${v}" aria-pressed="${v === ver}">${v.includes("2025") ? "New (2025)" : "Current (2017)"}</button>`).join("")}</div>` : "";
    sylBody.innerHTML = toggle + (items.length
      ? `<ul style="margin:0;padding-left:18px;font-size:0.82rem;color:var(--ink-dim);display:flex;flex-direction:column;gap:6px">${items.map((d) => `<li${focusDot?.id === d.id ? ' style="color:var(--ink);font-weight:600"' : ""}>${esc(d.text)} <span style="color:var(--ink-faint)">(${esc(d.outcome)})</span>${d.subpoints?.length ? `<ul style="padding-left:16px;margin:4px 0 0">${d.subpoints.map((sp) => `<li>${esc(typeof sp === "string" ? sp : sp.text || "")}</li>`).join("")}</ul>` : ""}</li>`).join("")}</ul>`
      : `<p>No ${BANDS.find((b) => b.id === band).label} dot points map directly to this level — try another year level.</p>`);
    sylBody.querySelectorAll("[data-v]").forEach((b) => b.addEventListener("click", () => { sylVersion = b.dataset.v; renderSyllabus(); }));
  }
  const prevChange = engine.onChange;
  engine.onChange = (stack) => { prevChange(stack); renderSyllabus(); };
  lens.on(() => { sel.value = lens.band; renderSyllabus(); });

  // graphics card lives at the bottom of the panel, outside the level's cards
  const qCard = K.card(panelEl, "Graphics");
  const qSeg = K.segmented(qCard, [
    { value: "high", label: "Cinematic" }, { value: "medium", label: "Balanced" }, { value: "low", label: "Fast" },
  ], engine.quality, (v) => { engine.lockQuality = true; engine.setQuality(v); });
  qCard.insertAdjacentHTML("beforeend", `<p class="hint">Cinematic adds depth-of-field and glow. It steps down automatically on slower devices.</p>`);
  engine.onQuality = (q) => qSeg.set(q);
  if (matchMedia("(pointer: coarse)").matches || (navigator.hardwareConcurrency || 8) <= 4) engine.setQuality("medium");

  K.loop((dt, t) => engine.render(dt, t));
  await engine.start(opts.start);
  return engine;
}
