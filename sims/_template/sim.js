// Minimal reference sim showing the kit contract. Copy this folder to start a new sim.
import * as K from "../../assets/js/kit.js";

const stageEl = K.$("#stage");
const panel = K.$("#panel");
const overlay = K.$("#overlay");
const stage = K.createStage(K.$("#canvas"));
const { ctx } = stage;
const toast = K.toaster(stageEl);

const state = { temp: 37, n: 40 };
let dots = [];
const spawn = () => {
  dots = K.makeParticles(state.n, () => ({
    x: K.rand(20, stage.w - 20), y: K.rand(20, stage.h - 20), vx: 0, vy: 0, r: 6,
  }));
};
spawn();

const explain = K.card(panel, "What's happening", "explain");
explain.innerHTML += `<p>Particles move randomly. <strong>Higher temperature</strong> means faster movement.</p>`;

const controls = K.card(panel, "Controls");
K.slider(controls, { label: "Temperature", min: 0, max: 60, value: state.temp, unit: " °C", onInput: (v) => (state.temp = v) });
const row = K.buttonRow(controls);
const pauseBtn = K.button(row, "Pause", () => { pauseBtn.textContent = L.toggle() ? "Pause" : "Play"; });
K.button(row, "Reset", spawn);

const m = K.missions(panel, [
  { text: "Heat the system above 50 °C", check: () => state.temp > 50 },
], (mm) => toast(`Mission complete: ${mm.text}`));

K.quiz(panel, [
  { q: "What happens to particle speed when temperature rises?", options: ["Decreases", "Increases", "No change"], answer: 1, why: "More kinetic energy → faster motion." },
]);

const setChip = K.chip(overlay);

const L = K.loop((dt, t) => {
  K.backdrop(ctx, stage.w, stage.h);
  for (const p of dots) {
    K.brownian(p, dt, 60 + state.temp * 10);
    K.bounce(p, 0, 0, stage.w, stage.h);
    K.sphere(ctx, p.x, p.y, p.r, K.C.teal, { glow: 8 });
  }
  setChip(`Temperature <b>${state.temp} °C</b>`);
  m.update();
});
