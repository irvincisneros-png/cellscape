// Microscopy mode: look at the current cell as a light microscope (LM) or a transmission electron microscope (TEM) would show it.
//
// How it works. While the mode is on, two extra passes replace the engine's RenderPass/Bokeh/Bloom in the composer:
//   ScopeRender  draws the level twice with temporary "absorbance" materials (the real ones are put back straight after,
//                inside the same frame, so nothing else ever sees them):
//                S = the sharp optical section (two clipping planes cut a thin slab at the focus depth),
//                F = the whole depth, used for the soft out-of-focus glow behind the section.
//                Objects are classified by structure (level.microscope.kinds + userData.kind); structures below the
//                resolution limit, and everything not classified (molecules, labels, markers, flows), are not drawn.
//   ScopePost    blurs to the resolution limit, adds the glow, light intensity, the circular field stop and vignette (LM)
//                or the greyscale thin-section look (TEM).
// The microscope owns the camera while it is on: the objective sets the camera distance so the field of view matches the
// real one (field number 18 mm ÷ objective). Turning it off puts the camera, passes and limits back exactly.
// Dives and climbs: it stays on for the two whole-cell levels (plant <-> animal) and switches itself off, with a toast,
// before any dive into an organelle or molecular level.
import * as THREE from "three";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import * as K from "../kit.js";
import * as C from "./microscopeContent.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const $el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const FIELD = 0.94;            // the circle (or square) the field of view fills, as a fraction of the stage's short side
const DOCK_PAD = 64;           // keep this much of the stage free for the control bar
const ZAXIS = new THREE.Vector3(0, 0, 1);

// ---------- shaders ----------
const VERT = `
  varying vec3 vN; varying vec3 vV;
  #include <clipping_planes_pars_vertex>
  void main() {
    #include <beginnormal_vertex>
    #include <defaultnormal_vertex>
    #include <begin_vertex>
    #include <project_vertex>
    vN = normalize(transformedNormal);
    vV = -mvPosition.xyz;
    #include <clipping_planes_vertex>
  }`;
const FRAG = `
  uniform vec3 uC0, uC1; uniform float uPow, uA0, uA1, uGain, uFocusZ, uSig; uniform vec3 uObj;   // uObj: view depth of the object's middle, its half-depth, 1 if it has a size
  varying vec3 vN; varying vec3 vV;
  #include <clipping_planes_pars_fragment>
  void main() {
    #include <clipping_planes_fragment>
    float f = pow(1.0 - clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), uPow);
    float zo = uObj.z > 0.5 ? uObj.x : vV.z;
    float dz = max(0.0, abs(zo - uFocusZ) - uObj.y) / uSig;   // 0 while the focal plane is inside the structure
    float w = exp(-0.5 * dz * dz);                       // soft focus: parts far from the focal plane fade
    vec3 c = mix(mix(uC0, uC1, f), vec3(1.0), 1.0 - uGain * w);
    gl_FragColor = vec4(c, mix(uA0, uA1, f) * w);
  }`;
const PVERT = `
  uniform float uSize, uScale;
  #include <clipping_planes_pars_vertex>
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = max(uSize * uScale / -mvPosition.z, 1.6);
    #include <clipping_planes_vertex>
  }`;
const PFRAG = `
  uniform vec3 uC0; uniform float uGain;
  #include <clipping_planes_pars_fragment>
  void main() {
    #include <clipping_planes_fragment>
    float a = smoothstep(1.0, 0.45, length(gl_PointCoord - 0.5) * 2.0) * uGain;
    gl_FragColor = vec4(mix(vec3(1.0), uC0, a), 1.0);
  }`;
// the neighbouring tissue: walls, a pale cytoplasm and a nucleus in every cell, except the middle cell (the 3D model)
const LVERT = `varying vec2 vW; void main() { vW = (modelMatrix * vec4(position, 1.0)).xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const LFRAG = `
  uniform vec3 uCyto, uWall, uNuc; uniform vec2 uPitch; uniform float uMode, uFade, uPx, uWallW;
  varying vec2 vW;
  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec2 h22(vec2 p) { return vec2(h21(p), h21(p + 19.19)); }
  float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
  void main() {
    float wallD = 1e3, nucD = 1e3; bool hole = false; vec2 cid = vec2(0.0);
    float aa = uPx * 1.2;
    if (uMode < 0.5) {                                   // plant: rows of brick-shaped cells
      float row = floor(vW.y / uPitch.y + 0.5);
      float off = row == 0.0 ? 0.0 : h21(vec2(row, 3.1)) * uPitch.x;
      vec2 q = vec2(vW.x - off, vW.y - row * uPitch.y);
      float col = floor(q.x / uPitch.x + 0.5);
      vec2 c = vec2(q.x - col * uPitch.x, q.y);
      wallD = min(uPitch.x * 0.5 - abs(c.x), uPitch.y * 0.5 - abs(c.y));
      hole = row == 0.0 && col == 0.0;
      vec2 id = vec2(col, row); cid = id;
      vec2 nc = vec2(-0.22 * uPitch.x + (h21(id) - 0.5) * 0.12 * uPitch.x, (h21(id + 3.0) - 0.5) * 0.3 * uPitch.y);
      nucD = length((c - nc) / vec2(0.07 * uPitch.x, 0.15 * uPitch.y));
    } else {                                             // animal: cells packed like a mosaic (Voronoi)
      vec2 g = vW / uPitch.x, ip = floor(g), fp = fract(g);
      float md = 8.0; vec2 bc = vec2(0.0), bid = vec2(0.0), bo = vec2(0.0);
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        vec2 b = vec2(float(i), float(j)), id = ip + b;
        vec2 o = (id.x == 0.0 && id.y == 0.0) ? vec2(0.0) : 0.15 + 0.7 * h22(id);
        vec2 r = b + o - fp; float d = dot(r, r);
        if (d < md) { md = d; bc = r; bid = id; bo = o; }
      }
      float bd = 8.0;
      for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
        vec2 b = vec2(float(i), float(j)), id = ip + b;
        vec2 o = (id.x == 0.0 && id.y == 0.0) ? vec2(0.0) : 0.15 + 0.7 * h22(id);
        vec2 r = b + o - fp;
        if (dot(bc - r, bc - r) > 1e-4) bd = min(bd, dot(0.5 * (bc + r), normalize(r - bc)));
      }
      wallD = bd * uPitch.x;
      hole = bid.x == 0.0 && bid.y == 0.0; cid = bid;
      nucD = length(bc) * uPitch.x / (0.16 * uPitch.x);
    }
    float w = max(uWallW, uPx * 0.6);
    float line = 1.0 - smoothstep(w, w + aa, wallD);
    float nuc = hole ? 0.0 : 1.0 - smoothstep(0.82, 1.0, nucD);   // the middle cell is the 3D model: it brings its own nucleus
    float tint = 1.0 - 0.07 * h21(cid + 7.0) - 0.05 * vn(vW * 0.22);              // each cell is a little different
    float mott = 0.82 + 0.36 * vn(vW * 0.9 + cid * 3.0);                             // a mottled nucleus
    vec3 T = uCyto * tint * mix(vec3(1.0), uWall, line * (0.82 + 0.3 * h21(floor(vW / 14.0)))) * mix(vec3(1.0), pow(uNuc, vec3(mott)), nuc);
    gl_FragColor = vec4(mix(vec3(1.0), T, uFade), 1.0);
  }`;
const PFS = `
  precision highp float;
  uniform sampler2D tS, tF; uniform vec2 uRes; uniform float uDref, uMode, uWF, uHaze, uBlur, uInt, uVig, uTime, uGrain, uShiftY;
  uniform vec3 uField;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec3 blur(sampler2D t, float r) {
    vec3 acc = texture2D(t, vUv).rgb;
    if (r < 0.45) return acc;
    float n = 1.0;
    for (int i = 0; i < 20; i++) {
      float a = float(i) * 2.39996, rr = sqrt((float(i) + 0.5) / 20.0) * r;
      acc += texture2D(t, vUv + vec2(cos(a), sin(a)) * rr / uRes).rgb; n += 1.0;
    }
    return acc / n;
  }
  void main() {
    vec3 s = blur(tS, uBlur);
    vec3 T = s;
    if (uWF > 0.001) T *= mix(vec3(1.0), blur(tF, uHaze + uBlur), uWF);
    vec3 col = uField * T * uInt;
    col = 1.0 - exp(-col * 2.4);
    vec2 p = (vUv * uRes - uRes * 0.5) / (uDref * 0.5);
    float rn = length(p);
    if (uMode < 0.5) {
      col *= 1.0 - uVig * smoothstep(0.5, 1.0, rn);
      col += (hash(vUv * uRes + uTime) - 0.5) * uGrain;
      col *= 1.0 + 0.025 * sin(p.x * 2.1 + 0.7) * cos(p.y * 1.7);                      // slightly uneven illumination
      vec2 gp = vUv * uRes / (uDref * 0.16), gi = floor(gp);                           // a few specks of dust on the optics
      float dh = hash(gi + 3.7); vec2 dc = gi + 0.25 + 0.5 * vec2(hash(gi + 1.3), hash(gi + 9.1));
      col *= 1.0 - 0.07 * step(0.93, dh) * smoothstep(0.2 + 0.2 * dh, 0.0, length(gp - dc));
      col = mix(vec3(0.004, 0.005, 0.007) * (1.0 - 0.6 * smoothstep(0.9, 2.2, rn)), col, 1.0 - smoothstep(0.985, 1.0, rn));
      col += vec3(0.5, 0.45, 0.35) * 0.06 * smoothstep(0.97, 0.995, rn) * (1.0 - smoothstep(0.995, 1.0, rn));
    } else {
      col = clamp((col - 0.5) * 1.18 + 0.5, 0.0, 1.0);
      col *= 1.0 - uVig * smoothstep(0.7, 1.6, rn);
      col += (hash(vUv * uRes + uTime) - 0.5) * uGrain;
    }
    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }`;

class ScopeRenderPass extends Pass {
  constructor(scope) {
    super();
    this.scope = scope;
    this.needsSwap = false;
    const o = { type: THREE.HalfFloatType, depthBuffer: false };
    this.rtS = new THREE.WebGLRenderTarget(4, 4, o);
    this.rtF = new THREE.WebGLRenderTarget(4, 4, o);
  }
  setSize(w, h) { this.rtS.setSize(w, h); this.rtF.setSize(w, h); }
  render(renderer) { this.scope.renderLayers(renderer, this.rtS, this.rtF); }
  dispose() { this.rtS.dispose(); this.rtF.dispose(); }
}
class ScopePostPass extends Pass {
  constructor(scope, rp) {
    super();
    this.scope = scope; this.rp = rp;
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tS: { value: null }, tF: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uDref: { value: 1 }, uMode: { value: 0 }, uWF: { value: 0 },
        uHaze: { value: 2 }, uBlur: { value: 0 }, uInt: { value: 1 }, uVig: { value: 0.3 }, uTime: { value: 0 }, uGrain: { value: 0.012 },
        uShiftY: { value: 0 }, uField: { value: new THREE.Color(1, 1, 1) },
      },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: PFS, depthTest: false, depthWrite: false,
    });
    this.fsq = new FullScreenQuad(this.mat);
  }
  render(renderer, writeBuffer) {
    const u = this.mat.uniforms;
    u.tS.value = this.rp.rtS.texture; u.tF.value = this.rp.rtF.texture;
    this.scope.fillPost(u, writeBuffer);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.fsq.render(renderer);
  }
  dispose() { this.mat.dispose(); this.fsq.dispose(); }
}

// ======================================================================================================================
class Scope {
  constructor(engine, btn) {
    this.engine = engine; this.btn = btn;
    this.S = {
      mode: "lm", obj: 4, stain: "none", focus: 0, light: 1, temMag: 5000, ruler: false,
      objs: new Set([4]), stains: new Set(["none"]), modes: new Set(["lm"]), stainAtHigh: new Set(),
      focusTravel: 0, rulerReads: [], temMaxMag: 0, calcOk: false, compareOpened: false,
    };
    this.kcache = new WeakMap(); this.matCache = new Map(); this.ptsCache = new Map();
    this._draw = []; this._hide = []; this._sceneHide = [];
    this.planes = [new THREE.Plane(), new THREE.Plane()];
    this.focusU = { value: 0 }; this.sigU = { value: 1e6 };   // shared by every structure material: where the focal plane is (view depth) and how soft the focus is
    this.noPlanes = [];
    this.dir = new THREE.Vector3(0, 0, 1); this.f = new THREE.Vector3(); this.tmp = new THREE.Vector3();
    this.logD = null; this.lastT = performance.now();
    this.px = { dref: 600, pxPerUm: 1, fovUm: 1000, dpr: 1 };
    this.hint = null; this.inst = null; this.wasUserMoved = false;
    this.own = [];   // [target, key, original] for engine members we replace, undone in deactivate()
    const box = new THREE.Box3(), cen = new THREE.Vector3(), fwd = this.f;
    // runs just before each structure is drawn: tell its material where the structure sits in depth, so a structure is sharp
    // whenever the focal plane passes through it (not only when it touches a face of it)
    this.obr = function (renderer, scene, camera, geometry, material) {
      const u = material.uniforms?.uObj;
      if (!u) return;
      if (this.isInstancedMesh || !geometry.attributes?.position) u.value.set(0, 0, 0);
      else {
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        box.copy(geometry.boundingBox).applyMatrix4(this.matrixWorld);
        box.getCenter(cen).sub(camera.position);
        u.value.set(cen.dot(fwd), (Math.abs(fwd.x) * (box.max.x - box.min.x) + Math.abs(fwd.y) * (box.max.y - box.min.y) + Math.abs(fwd.z) * (box.max.z - box.min.z)) / 2, 1);
      }
      material.uniformsNeedUpdate = true;
    };
    this.ui = {};
  }

  // ---------- on / off ----------
  activate() {
    const e = this.engine, r = e.renderer;
    this.active = true;   // so a failed start can still be undone with deactivate()
    this.snap = {
      pos: e.camera.position.clone(), target: e.controls.target.clone(), userMoved: e.userMoved, inst: e.current,
      overlay: e.overlay ? e.overlay.style.visibility : "",
    };
    const c = e.controls;
    this.rp = e.composer.passes.find((p) => p instanceof RenderPass);
    this.rpWas = this.rp ? this.rp.enabled : true;
    this.renderPass = new ScopeRenderPass(this);
    this.postPass = new ScopePostPass(this, this.renderPass);
    // Engine passes: [RenderPass, Bokeh, Bloom, Output]. Ours go in after the (now disabled) RenderPass.
    // Pass.setSize is called by insertPass, so check that the composer has a size before.
    if (this.rp) this.rp.enabled = false;
    e.composer.insertPass(this.renderPass, 1);
    e.composer.insertPass(this.postPass, 2);
    e.scopeActive = true;
    e.refreshPost();
    r.toneMapping = THREE.NoToneMapping;
    // camera ownership: pan only (the objective sets the zoom), no orbit, no picking
    Object.assign(c, { enableRotate: false, enableZoom: false });
    c.mouseButtons.LEFT = THREE.MOUSE.PAN; c.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    c.touches.ONE = THREE.TOUCH.PAN;
    e.userMoved = true;
    this.replace(e, "pick", () => null);
    this.replace(e, "dive", (p) => { this.deactivate("This level is a magnified model, below what a light microscope can resolve. Microscope switched off. Try the electron microscope on the whole cell."); return Object.getPrototypeOf(e).dive.call(e, p); });
    e.setHover?.(null);
    if (e.overlay) e.overlay.style.visibility = "hidden";
    e.stageEl.classList.add("scope-on");
    this.group = new THREE.Group();
    e.scene.add(this.group);
    this.buildUI();
    this.attachLevel(e.current);
    this.btn?.setAttribute("aria-pressed", "true");
    e.scope = this;
    this.unlens = e.lens.on(() => { this.refreshLens(); });
    this.dir.copy(e.camera.position).sub(c.target).normalize();
    if (this.dir.lengthSq() < 0.5) this.dir.set(0, 0, 1);
    this.logD = Math.log(Math.max(1e-3, e.camera.position.distanceTo(c.target)));
  }

  replace(obj, key, fn) {
    this.own.push([obj, key, Object.prototype.hasOwnProperty.call(obj, key), obj[key]]);
    obj[key] = fn;
  }

  /** Put everything back. `message` (optional) is shown as a toast. */
  deactivate(message) {
    if (!this.active) return;
    this.active = false;
    const e = this.engine, c = e.controls, r = e.renderer;
    for (const [obj, key, had, val] of this.own.reverse()) { if (had) obj[key] = val; else delete obj[key]; }
    this.own = [];
    if (this.renderPass) { e.composer.removePass(this.renderPass); this.renderPass.dispose(); }
    if (this.postPass) { e.composer.removePass(this.postPass); this.postPass.dispose(); }
    if (this.rp) this.rp.enabled = this.rpWas;
    e.scopeActive = false;
    e.refreshPost();
    r.toneMapping = e.style.clay ? THREE.NeutralToneMapping : THREE.ACESFilmicToneMapping;
    r.clippingPlanes = [];
    const L = e.current;
    c.enableRotate = true; c.enableZoom = true;
    c.mouseButtons.LEFT = L?.leftDragRotate === false ? null : THREE.MOUSE.ROTATE; c.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    c.touches.ONE = THREE.TOUCH.ROTATE;
    // the camera limits are the level's own (what Engine.mount sets)
    c.minDistance = L?.minDistance ?? 0.1; c.maxDistance = L?.maxDistance ?? 100;
    e.camera.near = L?.near ?? c.minDistance * 0.05; e.camera.far = L?.far ?? c.maxDistance * 20;
    e.camera.updateProjectionMatrix();
    if (!this.snap) { /* never got going */ }
    else if (L === this.snap.inst) { e.camera.position.copy(this.snap.pos); c.target.copy(this.snap.target); e.userMoved = this.snap.userMoved; c.update(); }
    else if (L) { e.frame(L.view); e.userMoved = false; }   // switched cells (plant <-> animal) meanwhile: frame the new one
    if (e.overlay && this.snap) e.overlay.style.visibility = this.snap.overlay;
    e.stageEl.classList.remove("scope-on");
    if (this.group) { e.scene.remove(this.group); this.group.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); }
    for (const m of this.matCache.values()) m.dispose();
    for (const m of this.ptsCache.values()) m.dispose();
    this.matCache.clear(); this.ptsCache.clear();
    this.unlens?.();
    this.ui.root?.remove(); this.ui.cards?.remove();
    clearTimeout(this._toastT);
    this.btn?.setAttribute("aria-pressed", "false");
    if (e.scope === this) delete e.scope;
    if (message) e.toast?.(message, 4200);
  }

  // ---------- the level the microscope is looking at ----------
  attachLevel(L) {
    this.inst = L;
    this.hint = L?.microscope || null;
    this.kcache = new WeakMap();
    const e = this.engine;
    if (!this.hint) { setTimeout(() => this.deactivate("The microscope works on the whole cell. Go back up to the cell, then switch it on."), 0); return; }
    const h = this.hint;
    // tissue lattice for the light microscope
    if (this.lattice) { this.group.remove(this.lattice); this.lattice.geometry.dispose(); this.lattice.material.dispose(); }
    const pitch = h.pitch || [h.cellUm, h.cellUm];
    this.lattice = new THREE.Mesh(new THREE.PlaneGeometry(7000, 7000), new THREE.ShaderMaterial({
      vertexShader: LVERT, fragmentShader: LFRAG, transparent: true, depthWrite: false, depthTest: false, blending: THREE.MultiplyBlending, premultipliedAlpha: true,
      uniforms: { uCyto: { value: new THREE.Color() }, uWall: { value: new THREE.Color() }, uNuc: { value: new THREE.Color() }, uPitch: { value: new THREE.Vector2(pitch[0], pitch[1]) }, uMode: { value: h.tissue === "animal" ? 1 : 0 }, uFade: { value: 1 }, uPx: { value: 1 }, uWallW: { value: h.tissue === "animal" ? 0.35 : 0.75 } },
    }));
    this.lattice.position.copy(h.home || new THREE.Vector3());
    this.lattice.frustumCulled = false; this.lattice.renderOrder = -5;
    this.group.add(this.lattice);
    this.home = (h.home || new THREE.Vector3()).clone();
    this.temHome = (h.temHome || h.home || new THREE.Vector3()).clone();
    this.aim = this.S.mode === "lm" ? this.home : this.temHome;
    this.refreshLens();
    this.syncUI();
  }

  kindOf(o) {
    let k = this.kcache.get(o);
    if (k !== undefined) return k;
    k = null;
    const map = this.hint?.kinds, root = this.inst?.root;
    for (let p = o; p; p = p.parent) {
      if (map && map.has(p)) { k = map.get(p); break; }
      const a = C.KIND_ALIAS[p.userData?.kind];
      if (a) { k = a; break; }
      if (p === root) break;
    }
    this.kcache.set(o, k);
    return k;
  }

  /** The look of a structure under the current microscope and settings, or null if it can't be seen. */
  specFor(kind) {
    const K_ = C.KINDS[kind];
    if (!K_) return null;
    const S = this.S;
    if (S.mode === "em") return K_.em || null;
    if (!K_.lm || S.obj < K_.lmFrom) return null;
    return K_.lm[S.stain] || K_.lm.none;
  }

  matFor(kind, spec) {
    const key = `${kind}|${this.S.mode}|${this.S.stain}`;
    let m = this.matCache.get(key);
    if (!m) {
      m = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG, clipping: true, side: THREE.DoubleSide, transparent: true, depthWrite: false, depthTest: false,
        uniforms: { uC0: { value: new THREE.Color(spec.fill) }, uC1: { value: new THREE.Color(spec.edge) }, uPow: { value: spec.pow }, uA0: { value: spec.a0 }, uA1: { value: spec.a1 }, uGain: { value: spec.gain }, uFocusZ: this.focusU, uSig: this.sigU, uObj: { value: new THREE.Vector3() } },
      });
      if (spec.blend === "paint") m.blending = THREE.NormalBlending;
      else { m.blending = THREE.MultiplyBlending; m.premultipliedAlpha = true; }
      this.matCache.set(key, m);
    }
    return m;
  }

  ptsMat(kind, spec, size) {
    const key = `${kind}|${this.S.mode}|${size.toFixed(3)}`;
    let m = this.ptsCache.get(key);
    if (!m) {
      m = new THREE.ShaderMaterial({
        vertexShader: PVERT, fragmentShader: PFRAG, clipping: true, transparent: true, depthWrite: false, depthTest: false,
        blending: THREE.MultiplyBlending, premultipliedAlpha: true,
        uniforms: { uC0: { value: new THREE.Color(spec.fill) }, uGain: { value: spec.gain }, uSize: { value: size }, uScale: { value: 500 } },
      });
      this.ptsCache.set(key, m);
    }
    return m;
  }

  // ---------- the camera: the objective decides the field of view ----------
  frameCamera() {
    const e = this.engine, cam = e.camera, c = e.controls, S = this.S, h = this.hint;
    const now = performance.now(), dt = Math.min(0.1, (now - this.lastT) / 1000);
    this.lastT = now;
    const w = e.w, hgt = e.h, dpr = (this.renderPass?.rtS.width || w) / w;   // render pixels per CSS pixel
    const dref = Math.min(w, Math.max(120, hgt - DOCK_PAD)) * FIELD;
    const fovUm = S.mode === "lm" ? C.lmFovUm(S.obj) : C.temFovUm(S.temMag);
    const mpu = e.metersPerUnit() || 1e-6, fovUnits = (fovUm * 1e-6) / mpu;
    const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const dWant = fovUnits / (2 * tanH * (dref / hgt));
    const k = e.reducedMotion ? 1 : 1 - Math.exp(-9 * dt);
    this.logD += (Math.log(dWant) - this.logD) * k;
    const d = Math.exp(this.logD);
    // look straight down the cell's z axis (ease the direction round so the change is smooth)
    this.dir.lerp(ZAXIS, e.reducedMotion ? 1 : 1 - Math.exp(-6 * dt)).normalize();
    // pan: the stage can move, within the slide (LM) or the cell (TEM)
    const aim = this.aim, t = c.target;
    const lim = S.mode === "lm" ? Math.max(0, 3000 - fovUm / 2) : Math.max(0, (h?.cellUm || 56) * 0.75);
    t.x = clamp(t.x, aim.x - lim, aim.x + lim); t.y = clamp(t.y, aim.y - lim, aim.y + lim); t.z = aim.z;
    if (this.fly) {   // glide the stage to a home position (Centre / mode change)
      const f = this.fly, kk = e.reducedMotion ? 1 : 1 - Math.exp(-8 * dt);
      t.x += (f.x - t.x) * kk; t.y += (f.y - t.y) * kk;
      if (Math.hypot(f.x - t.x, f.y - t.y) < 1e-3 * Math.max(1, fovUm)) { t.x = f.x; t.y = f.y; this.fly = null; }
    }
    cam.position.copy(t).addScaledVector(this.dir, d);
    cam.lookAt(t);
    c.minDistance = 1e-3; c.maxDistance = 1e9;
    const near = Math.max(0.005, d - 90), far = d + 90;
    if (Math.abs(cam.near - near) > 1e-6 || Math.abs(cam.far - far) > 1e-6) { cam.near = near; cam.far = far; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
    e.renderer.toneMapping = THREE.NoToneMapping;
    // optics in screen terms
    const px = this.px;
    px.dref = dref; px.dpr = dpr; px.fovUm = fovUm; px.pxPerUm = dref / fovUm; px.unitsPerPx = fovUnits / dref; px.dt = dt;
    px.cx = w / 2; px.cy = hgt / 2;
    // the optical section: a slab perpendicular to the view direction
    this.f.copy(this.dir).negate();
    const depth = h?.depthUm || 34;
    let half, centre;
    if (S.mode === "lm") { const o = C.objectiveOf(S.obj); half = o.dof / 2; centre = S.focus; if (S.obj < 10) { half = 1e4; centre = 0; } }
    else { half = C.TEM.sectionUm / 2; centre = S.focus; }
    const s0 = this.f.dot(aim) + centre;      // slider up = deeper into the cell (further from the lens)
    this.planes[0].set(this.f, -(s0 - half));
    this.planes[1].set(this.tmp.copy(this.f).negate(), s0 + half);
    // how much of the cell's depth is inside the section (the rest is out of focus)
    const lo = Math.max(-depth / 2, centre - half), hi = Math.min(depth / 2, centre + half);
    this.coverage = clamp((hi - lo) / depth, 0, 1);
    this.half = half;
    this.focusU.value = d + centre;                // view depth of the focal plane
    this.softSigma = S.mode === "lm" ? clamp(C.objectiveOf(S.obj).dof * 0.9, 3, 1e4) : 2.2;
    // scale: point sprites (ribosomes) need pixels per unit at the target distance
    this.pointScale = (hgt * dpr) / (2 * tanH);
  }

  renderLayers(renderer, rtS, rtF) {
    const e = this.engine, L = e.current, S = this.S;
    if (!this.active) return;
    if (L !== this.inst) this.attachLevel(L);
    if (!this.hint || !L) return;
    this.frameCamera();
    const scene = e.scene, cam = e.camera, draw = this._draw, hide = this._hide, sh = this._sceneHide;
    draw.length = hide.length = sh.length = 0;
    L.root.traverseVisible((o) => {
      if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite)) return;
      const k = this.kindOf(o), spec = k && !o.isLine && !o.isSprite ? this.specFor(k) : null;   // (the clay look only hides parts by swapping materials, so those still draw here)
      const om = o.userData.realMat || o.material;   // (in the clay look the real material is kept in userData)
      if (!spec || (om && om.visible === false)) { hide.push(o); return; }
      draw.push(o, k, spec);
    });
    for (const ch of scene.children) if (ch !== L.root && ch !== this.group && ch.visible) { ch.visible = false; sh.push(ch); }
    // swap in the absorbance materials (restored below, inside this frame)
    for (let i = 0; i < draw.length; i += 3) {
      const o = draw[i], k = draw[i + 1], spec = draw[i + 2];
      o.userData._scopeMat = o.material; o.userData._scopeRO = o.renderOrder;
      if (o.isPoints) {
        const m = this.ptsMat(k, spec, (o.userData.realMat || o.material)?.size || 0.2);
        m.uniforms.uScale.value = this.pointScale;
        o.material = m;
      } else o.material = this.matFor(k, spec);
      o.renderOrder = C.KINDS[k].order;
      o.userData._scopeObr = o.onBeforeRender; o.onBeforeRender = this.obr;
    }
    for (const o of hide) o.userData._scopeVis = o.visible, o.visible = false;
    // lattice: the neighbouring tissue (light microscope only)
    const lat = this.lattice, lu = lat.material.uniforms, st = S.stain;
    const KM = C.KINDS.membrane.lm, KW = C.KINDS.wall.lm, KN = C.KINDS.nucleus.lm;
    lu.uCyto.value.set((KM[st] || KM.none).fill); lu.uNuc.value.set((KN[st] || KN.none).fill);
    lu.uWall.value.set((this.hint.tissue === "animal" ? KM : KW)[st]?.edge || (this.hint.tissue === "animal" ? KM : KW).none.edge);
    lu.uPx.value = this.px.unitsPerPx;
    const depth = this.hint.depthUm || 34, dist = Math.max(0, Math.abs(S.focus) - depth / 2 - this.half);
    lu.uFade.value = S.mode === "lm" ? clamp(1 - dist / 6, 0.15, 1) : 0;
    lat.visible = S.mode === "lm";
    const prevColor = renderer.getClearColor(this._cc || (this._cc = new THREE.Color())), prevAlpha = renderer.getClearAlpha();
    const prevAuto = renderer.autoClear;
    renderer.autoClear = true;
    renderer.setClearColor(0xffffff, 1);
    // S: the sharp slice
    renderer.clippingPlanes = this.planes;
    renderer.setRenderTarget(rtS);
    renderer.render(scene, cam);
    // F: the whole cell with a soft focus (stained fill and out-of-focus glow). The LM leaves out the tiny, faint structures here.
    const needF = this.wF() > 0.001, lmode = S.mode === "lm";
    if (needF) {
      const skip = (k) => lmode && !C.KINDS[k].hz;
      for (let i = 0; i < draw.length; i += 3) if (skip(draw[i + 1])) { draw[i].userData._scopeVis = draw[i].visible; draw[i].visible = false; }
      lat.visible = false;
      this.sigU.value = this.softSigma;
      renderer.clippingPlanes = this.noPlanes;
      renderer.setRenderTarget(rtF);
      renderer.render(scene, cam);
      this.sigU.value = 1e6;
      for (let i = 0; i < draw.length; i += 3) if (skip(draw[i + 1])) draw[i].visible = draw[i].userData._scopeVis;
    }
    // put everything back
    for (let i = 0; i < draw.length; i += 3) { const o = draw[i]; o.material = o.userData._scopeMat; o.renderOrder = o.userData._scopeRO; o.onBeforeRender = o.userData._scopeObr; delete o.userData._scopeMat; delete o.userData._scopeRO; delete o.userData._scopeObr; }
    for (const o of hide) { o.visible = o.userData._scopeVis; delete o.userData._scopeVis; }
    for (const ch of sh) ch.visible = true;
    for (let i = 0; i < draw.length; i += 3) delete draw[i].userData._scopeVis;
    lat.visible = true;
    renderer.clippingPlanes = this.noPlanes;
    renderer.setClearColor(prevColor, prevAlpha);
    renderer.autoClear = prevAuto;
    renderer.setRenderTarget(null);
    this.updateUI();
  }

  /** weight of the out-of-focus glow behind the sharp section */
  wF() {
    const S = this.S;
    return S.mode === "lm" ? 0.9 : 0.85;
  }

  fillPost(u) {
    const e = this.engine, S = this.S, px = this.px, dpr = px.dpr;
    u.uRes.value.set(e.w * dpr, e.h * dpr);
    u.uDref.value = px.dref * dpr;
    u.uMode.value = S.mode === "lm" ? 0 : 1;
    u.uTime.value = (performance.now() % 1000) / 1000;
    const limitUm = S.mode === "lm" ? C.lmLimitUm(S.obj) : C.temLimitUm();
    u.uBlur.value = limitUm * px.pxPerUm * dpr * 0.4;     // Gaussian-ish radius for the resolution limit, in render pixels
    u.uWF.value = this.wF();
    if (S.mode === "lm") {
      const o = C.objectiveOf(S.obj);
      u.uHaze.value = clamp(o.na * 1.5 * px.pxPerUm * dpr, 1.2 * dpr, 6 * dpr);
      u.uInt.value = S.light;
      u.uVig.value = 0.32; u.uGrain.value = 0.012;
      u.uField.value.setRGB(1.0, 0.975, 0.91);
    } else {
      u.uHaze.value = 0.8 * dpr;
      u.uInt.value = S.light;
      u.uVig.value = 0.22; u.uGrain.value = 0.03;
      u.uField.value.setRGB(0.78, 0.78, 0.78);
    }
  }

  // ======================================================================================================================
  // ---------- user interface ----------
  buildUI() {
    const e = this.engine, S = this.S, lens = e.lens, ui = this.ui;
    injectCss();
    const root = ui.root = $el("div", "scope-ui");
    e.stageEl.appendChild(root);
    ui.hud = $el("div", "scope-hud"); ui.hud.setAttribute("aria-live", "off");
    ui.bar = $el("div", "scope-bar", "<i></i><span></span>");
    ui.rulerSvg = $el("div", "scope-ruler", `<svg width="100%" height="100%"><line class="rl" x1="0" y1="0" x2="0" y2="0"/><line class="rt" x1="0" y1="0" x2="0" y2="0"/><line class="rt" x1="0" y1="0" x2="0" y2="0"/></svg><div class="rv"></div>`);
    ui.compare = $el("figure", "scope-compare"); ui.compare.hidden = true;
    root.append(ui.rulerSvg, ui.hud, ui.bar, ui.compare);
    // dock
    const dock = ui.dock = $el("div", "scope-dock");
    root.appendChild(dock);
    const head = $el("div", "scope-row head");
    ui.modeSeg = K.segmented(head, [{ value: "lm", label: "Light" }, { value: "em", label: "Electron" }], S.mode, (v) => this.setMode(v));
    ui.modeSeg.el.classList.add("scope-mode");
    const more = ui.more = $el("button", "btn scope-more"); more.type = "button"; more.textContent = "Controls";
    more.setAttribute("aria-expanded", "true");
    const off = $el("button", "btn scope-off"); off.type = "button"; off.textContent = "✕"; off.title = "Turn the microscope off"; off.setAttribute("aria-label", "Turn the microscope off");
    off.addEventListener("click", () => this.deactivate());
    head.append(more, off);
    dock.appendChild(head);
    const narrow = e.w < 700;
    more.addEventListener("click", () => { const min = dock.classList.toggle("min"); more.setAttribute("aria-expanded", String(!min)); });
    if (narrow) { dock.classList.add("min"); more.setAttribute("aria-expanded", "false"); }
    // objective buttons (light) / magnification slider (electron)
    ui.objRow = $el("div", "scope-row");
    dock.appendChild(ui.objRow);
    ui.temRow = $el("div", "scope-row");
    ui.temMag = K.slider(ui.temRow, { label: "Magnification", min: 0, max: 100, step: 1, value: this.magToSlider(S.temMag), format: (v) => `×${Math.round(this.sliderToMag(v)).toLocaleString("en-AU")}`, onInput: (v) => this.setTemMag(this.sliderToMag(v)) });
    dock.appendChild(ui.temRow);
    const extra = ui.extra = $el("div", "scope-extra");
    dock.appendChild(extra);
    ui.stainRow = $el("div", "scope-row");
    ui.stainSeg = K.segmented(ui.stainRow, Object.entries(C.STAINS).map(([value, s]) => ({ value, label: s.short })), S.stain, (v) => this.setStain(v));
    ui.stainSeg.el.setAttribute("aria-label", "Stain");
    extra.appendChild(ui.stainRow);
    ui.focusSl = K.slider(extra, { label: "Fine focus", min: -20, max: 20, step: 0.1, value: 0, format: (v) => this.focusLabel(v), onInput: (v) => this.setFocus(v) });
    ui.lightSl = K.slider(extra, { label: "Light intensity", min: 0.3, max: 1.6, step: 0.01, value: 1, format: (v) => `${Math.round(v * 100)}%`, onInput: (v) => { S.light = v; } });
    ui.focusNote = $el("p", "hint scope-note"); extra.appendChild(ui.focusNote);
    const tools = $el("div", "scope-row tools");
    ui.rulerBtn = K.button(tools, "📏 Ruler", (on) => this.setRuler(on), { toggle: true });
    K.button(tools, "Centre", () => this.centre());
    ui.cmpBtn = K.button(tools, "🖼 Real photo", (on) => this.setCompare(on), { toggle: true });
    extra.appendChild(tools);
    this.buildRuler();
    this.buildObjectives();
    // side cards
    const panelEl = e.panel.parentElement || e.panel;
    ui.cards = $el("div", "scope-cards");
    ui.cards.style.display = "contents";
    panelEl.insertBefore(ui.cards, e.panel);
    this.buildCards();
  }

  buildObjectives() {
    const S = this.S, row = this.ui.objRow, lens = this.engine.lens;
    row.innerHTML = "";
    const list = C.OBJECTIVES.filter((o) => !o.oil || lens.atLeast("y11"));
    if (!list.some((o) => o.x === S.obj)) { S.obj = list.at(-1).x; }
    this.ui.objSeg = K.segmented(row, list.map((o) => ({ value: o.x, label: `${o.x}×` })), S.obj, (v) => this.setObjective(v));
    this.ui.objSeg.el.setAttribute("aria-label", "Objective lens");
    this.ui.objSeg.el.classList.add("scope-obj");
    [...this.ui.objSeg.el.children].forEach((b, i) => { b.title = list[i].name; });
  }

  magToSlider(m) { return (Math.log(m / C.TEM.min) / Math.log(C.TEM.max / C.TEM.min)) * 100; }
  sliderToMag(v) { const m = C.TEM.min * Math.pow(C.TEM.max / C.TEM.min, v / 100); return m < 10000 ? Math.round(m / 500) * 500 : m < 30000 ? Math.round(m / 1000) * 1000 : Math.round(m / 5000) * 5000; }
  focusLabel(v) { const d = this.hint?.depthUm || 34; return `${(v + d / 2).toFixed(1)} µm deep`; }

  setMode(m) {
    const S = this.S;
    if (m === S.mode) return;
    S.mode = m; S.modes.add(m);
    this.aim = m === "lm" ? this.home : this.temHome;
    this.engine.controls.target.copy(this.aim);
    S.focus = 0; this.ui.focusSl.value = 0;
    if (m === "em") S.temMaxMag = Math.max(S.temMaxMag, S.temMag);
    this.ui.modeSeg.set(m);
    this.syncUI();
  }
  setObjective(x) {
    const S = this.S;
    S.obj = x; S.objs.add(x);
    this.ui.objSeg.set(x);
    this.syncUI();
  }
  setTemMag(m) { const S = this.S; S.temMag = m; S.temMaxMag = Math.max(S.temMaxMag, m); this.syncUI(); }
  setStain(v) { const S = this.S; S.stain = v; S.stains.add(v); this.ui.stainSeg.set(v); this.syncUI(); }
  setFocus(v) {
    const S = this.S;
    if (S.mode === "lm" && S.obj >= 40) S.focusTravel += Math.abs(v - S.focus);
    S.focus = v;
  }
  setRuler(on) { this.S.ruler = on; this.ui.rulerSvg.classList.toggle("on", on); if (!on) this.ui.rulerSvg.classList.remove("has"); }
  centre() { this.fly = { x: this.aim.x, y: this.aim.y }; }
  setCompare(on) {
    const ui = this.ui, S = this.S;
    ui.compare.hidden = !on;
    ui.cmpBtn.setAttribute("aria-pressed", String(on));
    if (on) { S.compareOpened = true; this.fillCompare(); }
  }

  /** Called when mode, objective, stain or the year level changes. */
  syncUI() {
    const S = this.S, ui = this.ui, lm = S.mode === "lm";
    if (!ui.root) return;
    ui.objRow.style.display = lm ? "" : "none";
    ui.temRow.style.display = lm ? "none" : "";
    ui.stainRow.style.display = lm ? "" : "none";
    ui.focusSl.el.querySelector("label").textContent = lm ? "Fine focus" : "Section depth";
    const d = this.hint?.depthUm || 34;
    ui.focusSl.input.min = -d / 2 - 2; ui.focusSl.input.max = d / 2 + 2;
    const locked = lm && S.obj < 10;
    ui.focusSl.input.disabled = locked;
    ui.focusNote.textContent = lm ? (locked ? "At 4× the depth of field (about 55 µm) is deeper than the cell, so it is all in focus. Try 10× or higher." : `At ${S.obj}× only a slice about ${C.fmtLen(C.objectiveOf(S.obj).dof)} thick is sharp. Turn the focus to move through the cell.`) : "A thin section (about 70 nm in real life) is cut from the cell. Move through it to see different slices.";
    ui.lightSl.el.querySelector("label").textContent = lm ? "Light intensity" : "Brightness";
    if (lm && S.obj >= 40) S.stainAtHigh.add(S.stain);
    ui.cmpBtn.setAttribute("aria-pressed", String(!ui.compare.hidden));
    if (!ui.compare.hidden) this.fillCompare();
    this.refreshCards();
  }

  refreshLens() {
    if (!this.ui.root) return;
    this.buildObjectives();
    this.buildCards();
    this.syncUI();
  }

  // ---------- ruler ----------
  buildRuler() {
    const box = this.ui.rulerSvg, svg = box.querySelector("svg"), ln = svg.querySelector(".rl"), ticks = svg.querySelectorAll(".rt"), val = box.querySelector(".rv");
    let a = null, b = null, drag = false;
    const draw = () => {
      if (!a || !b) return;
      const L = Math.hypot(b.x - a.x, b.y - a.y), ux = L ? (b.x - a.x) / L : 1, uy = L ? (b.y - a.y) / L : 0, nx = -uy * 7, ny = ux * 7;
      ln.setAttribute("x1", a.x); ln.setAttribute("y1", a.y); ln.setAttribute("x2", b.x); ln.setAttribute("y2", b.y);
      [[ticks[0], a], [ticks[1], b]].forEach(([t, p]) => { t.setAttribute("x1", p.x - nx); t.setAttribute("y1", p.y - ny); t.setAttribute("x2", p.x + nx); t.setAttribute("y2", p.y + ny); });
      const um = L / this.px.pxPerUm;
      val.textContent = C.fmtLen(um);
      val.style.transform = `translate(${(a.x + b.x) / 2}px, ${(a.y + b.y) / 2}px) translate(-50%, -140%)`;
      return um;
    };
    this.redrawRuler = () => { if (a && b && box.classList.contains("has")) draw(); };
    const pos = (ev) => { const r = box.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; };
    box.addEventListener("pointerdown", (ev) => { if (!this.S.ruler) return; box.setPointerCapture(ev.pointerId); drag = true; a = pos(ev); b = a; box.classList.add("has"); draw(); ev.preventDefault(); });
    box.addEventListener("pointermove", (ev) => { if (!drag) return; b = pos(ev); draw(); });
    const end = () => { if (!drag) return; drag = false; const um = draw(); if (um && Math.hypot(b.x - a.x, b.y - a.y) > 8) this.S.rulerReads.push(um); };
    box.addEventListener("pointerup", end); box.addEventListener("pointercancel", end);
  }

  // ---------- per-frame readouts ----------
  updateUI() {
    const ui = this.ui, S = this.S, px = this.px, lens = this.engine.lens, band = lens.band;
    if (!ui.hud) return;
    const lm = S.mode === "lm", o = C.objectiveOf(S.obj);
    const mag = lm ? C.lmMag(S.obj) : S.temMag, fov = px.fovUm;
    const limit = lm ? C.lmLimitUm(S.obj) : C.temLimitUm();
    let html;
    if (lm) {
      html = `<div class="big">×${mag.toLocaleString("en-AU")}</div><div class="sm">${band === "y7-8" ? `10× eyepiece × ${o.x}× objective` : `10× eyepiece × ${o.x}× objective (NA ${o.na})`}</div>`
        + `<div>Field of view <b>${C.fmtLen(fov)}</b></div><div>Smallest detail ≈ <b>${C.fmtLen(limit)}</b>${o.x < 100 ? ` <span class="sm">(best light microscope ≈ 0.2 µm)</span>` : ""}</div>`;
    } else {
      html = `<div class="big">×${mag.toLocaleString("en-AU")}</div><div class="sm">Transmission electron microscope (model)</div>`
        + `<div>Image width <b>${C.fmtLen(fov)}</b></div><div>Smallest detail ≈ <b>1 nm</b></div>`;
    }
    if (html !== ui._hud) { ui._hud = html; ui.hud.innerHTML = html; }
    // scale bar
    const nice = C.niceLen(fov * 0.2), wpx = nice * px.pxPerUm;
    const txt = C.fmtLen(nice), key = `${txt}|${Math.round(wpx)}|${S.mode}`;
    if (key !== ui._bar) { ui._bar = key; ui.bar.firstChild.style.width = `${wpx.toFixed(1)}px`; ui.bar.lastChild.textContent = txt; }
    const R = px.dref / 2, bx = lm ? px.cx - R * 0.58 : px.cx - R + 4, by = lm ? px.cy + R * 0.64 : px.cy + R - 8;
    ui.bar.style.transform = `translate(${bx.toFixed(0)}px, ${by.toFixed(0)}px)`;
    ui.bar.classList.toggle("em", !lm);
    this.redrawRuler?.();
    this.missionsCard?.update();
    if (this._cardsDirty) { this._cardsDirty = false; this.fillSeen(); }
  }

  // ---------- cards in the side panel ----------
  buildCards() {
    const ui = this.ui, lens = this.engine.lens, band = lens.band, S = this.S, h = this.hint || {};
    const box = ui.cards;
    box.innerHTML = "";
    ui._cmpKey = ui._ex = ui._seenKey = null;
    const pick = (v, ...a) => { const x = lens.pick(v); return typeof x === "function" ? x(...a) : x; };
    // overview
    const c1 = K.card(box, "Microscope mode", "scope-card");
    ui.explain = $el("div", "scope-explain");
    c1.appendChild(ui.explain);
    ui.seen = K.card(box, "What can you see right now?", "scope-card");
    // parts of the microscope (Years 7–8)
    if (band === "y7-8") {
      const cp = K.card(box, "Parts of a light microscope", "scope-card");
      cp.insertAdjacentHTML("beforeend", C.PARTS_SVG);
      cp.insertAdjacentHTML("beforeend", `<p class="hint">Light comes up from the lamp, passes through the thin specimen on the stage, then through the objective lens and the eyepiece to your eye. Always start on the lowest power and centre the specimen first.</p>`);
    }
    // cell size calculator
    const cc = K.card(box, "Calculate the cell's size", "scope-card");
    ui.calc = cc;
    cc.insertAdjacentHTML("beforeend", `<p class="calc-help"></p><div class="calc"><label>Cells across the field of view <input type="number" min="1" max="200" step="1" inputmode="numeric" placeholder="e.g. 8" aria-label="Number of cells across the field of view"></label><button type="button" class="btn">Calculate</button></div><div class="calc-out" aria-live="polite"></div>`);
    cc.querySelector(".calc-help").textContent = pick(C.TEXT.calcHelp);
    const inp = cc.querySelector("input"), out = cc.querySelector(".calc-out");
    cc.querySelector("button").addEventListener("click", () => this.calculate(+inp.value, out));
    inp.addEventListener("keydown", (ev) => { if (ev.key === "Enter") this.calculate(+inp.value, out); });
    // compare
    const cmp = K.card(box, "Compare with a real micrograph", "scope-card");
    ui.cmpCard = cmp;
    // drawing tips
    if (band === "y7-8" || band === "y9-10") {
      const cd = K.card(box, "Biological drawing tips", "scope-card");
      cd.insertAdjacentHTML("beforeend", `<ul class="scope-list">${C.TEXT.drawing[band === "y7-8" ? "y7-8" : "y9-10"].map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`);
    }
    // missions + quiz
    this.missionsCard = null;
    const ms = lens.filter(C.missions(S, h));
    const mc = K.missions(box, ms, () => this.engine.toast?.("Mission complete!"));
    this.missionsCard = mc;
    K.quiz(box, lens.filter(C.QUIZ));
    this._cardsDirty = true;
    this.refreshCards();
  }

  refreshCards() {
    const ui = this.ui; if (!ui.explain) return;
    const lens = this.engine.lens, S = this.S, h = this.hint || {};
    const pick = (v, ...a) => { const x = lens.pick(v); return typeof x === "function" ? x(...a) : x; };
    const o = C.objectiveOf(S.obj), band = lens.band;
    let html = `<p>${esc(pick(C.TEXT.intro))}</p>`;
    if (S.mode === "lm") {
      html += `<p>${pick(C.TEXT.mag, o)}</p><p>${pick(C.TEXT.limit, o)}</p><p><b>${esc(C.STAINS[S.stain].label)}.</b> ${esc(pick(C.STAIN_NOTE[S.stain]))}</p>`;
      if (S.stain === "iodine" && h.tissue === "animal") html += `<p class="hint">Iodine is usually used on plant tissue. Animal cells have almost no starch, so try methylene blue.</p>`;
      if (S.stain === "mblue" && h.tissue === "plant") html += `<p class="hint">Methylene blue is mostly used on animal cells such as cheek cells, but it will stain plant nuclei too.</p>`;
    } else {
      html += `<p>${esc(pick(C.TEXT.tem))}</p><p class="scope-honest"><b>Honest note.</b> ${esc(C.TEXT.honesty)}</p><p>${esc(pick(C.TEXT.sem))}</p>`;
    }
    if (ui._ex !== html) { ui._ex = html; ui.explain.innerHTML = html; }
    this._cardsDirty = true;
    // calculator
    const lm = S.mode === "lm";
    ui.calc.style.display = lm ? "" : "none";
    if (ui.cmpCard) this.fillCompareCard();
  }

  fillSeen() {
    const ui = this.ui, S = this.S, lens = this.engine.lens, h = this.hint; if (!ui.seen || !h) return;
    const lm = S.mode === "lm", lim = lm ? C.lmLimitUm(S.obj) : C.temLimitUm();
    const rows = (h.parts || []).map((k) => {
      const K_ = C.KINDS[k]; if (!K_) return "";
      const shown = this.specFor(k) != null;
      const faint = lm && shown && K_.lmFrom >= 40;
      const tag = shown ? (faint ? "just visible (a speck)" : "visible") : lm ? (K_.um < lim * 1.5 || K_.lmFrom === Infinity ? "too small to see" : "too small at this power") : "—";
      const size = lens.atLeast("y9-10") ? ` <span class="sm">≈ ${esc(C.fmtLen(K_.um))}</span>` : "";
      return `<li class="${shown ? "yes" : "no"}"><span>${shown ? "✔" : "✖"}</span> ${esc(K_.name)}${size}<em>${tag}</em></li>`;
    }).join("");
    const key = rows + lm + S.obj + S.stain;
    if (ui._seenKey === key) return;
    ui._seenKey = key;
    ui.seen.innerHTML = `<h2>What can you see right now?</h2><ul class="scope-seen">${rows}</ul><p class="hint">${esc(lm ? C.TEXT.smallDetail : "In an electron microscope the limit is about 1 nm, so membranes, ribosomes, cristae and the Golgi cisternae can all be resolved.")}</p>`;
  }

  fillCompareCard() {
    const ui = this.ui, lens = this.engine.lens, S = this.S, h = this.hint;
    const sp = S.mode === "em" ? C.SPECIMENS.ecoli : C.SPECIMENS[h?.specimen || "onion"];
    const qs = lens.pick(C.TEXT.compareQ);
    const key = sp.file + lens.band;
    if (ui._cmpKey === key) return;
    ui._cmpKey = key;
    ui.cmpCard.innerHTML = `<h2>Compare with a real micrograph</h2>${this.figureHtml(sp)}`
      + (S.mode === "em" ? `<p class="hint">This is a scanning electron micrograph (SEM): it shows the surface of bacteria in 3D, not the inside of a cell. No scale is given for this image.</p>` : `<p class="hint">This is a real photo, not our model. It has no scale bar, so don't measure it.</p>`)
      + `<p><b>Think about it</b></p><ul class="scope-list">${qs.map((q) => `<li>${esc(q)}</li>`).join("")}</ul>`;
    const btn = $el("button", "btn"); btn.type = "button"; btn.textContent = "Show beside the model";
    btn.addEventListener("click", () => this.setCompare(true));
    ui.cmpCard.appendChild(btn);
  }

  figureHtml(sp) {
    const root = this.engine.root || "";
    return `<figure class="scope-fig"><img src="${esc(root + sp.file)}" alt="${esc(sp.alt)}" loading="lazy"><figcaption><b>${esc(sp.title)}</b><br>${esc(sp.credit)}. <a href="${esc(sp.licenceUrl)}" target="_blank" rel="noopener">${esc(sp.licence)}</a> · <a href="${esc(sp.source)}" target="_blank" rel="noopener">source</a>. ${esc(sp.changes)}</figcaption></figure>`;
  }

  fillCompare() {
    const S = this.S, h = this.hint, sp = S.mode === "em" ? C.SPECIMENS.ecoli : C.SPECIMENS[h?.specimen || "onion"];
    const ui = this.ui, root = this.engine.root || "";
    ui.compare.innerHTML = `<div class="${S.mode === "lm" ? "circ" : "rect"}"><img src="${esc(root + sp.file)}" alt="${esc(sp.alt)}"></div><figcaption><b>${esc(sp.title)}</b> · real ${S.mode === "lm" ? "light" : "electron"} micrograph<br>${esc(sp.credit)}. <a href="${esc(sp.licenceUrl)}" target="_blank" rel="noopener">${esc(sp.licence)}</a> · <a href="${esc(sp.source)}" target="_blank" rel="noopener">source</a>. ${esc(sp.changes)}</figcaption><button type="button" class="btn" aria-label="Close the photo">✕</button>`;
    ui.compare.querySelector("button").addEventListener("click", () => this.setCompare(false));
  }

  calculate(n, out) {
    const S = this.S, h = this.hint, lens = this.engine.lens;
    if (!(n >= 1)) { out.textContent = "Enter how many cells you counted across the field of view (a whole number, 1 or more)."; return; }
    const fov = C.lmFovUm(S.obj), size = fov / n, truth = (h.pitch || [h.cellUm])[0];
    const ok = Math.abs(size - truth) <= truth * 0.3;
    if (ok) S.calcOk = true;
    const u = lens.atLeast("y11") ? ` (±${Math.round(100 / n)}% from counting ±1 cell)` : "";
    out.innerHTML = `<b>Cell size = ${C.fmtLen(fov)} ÷ ${n} ≈ ${C.fmtLen(size)}</b>${u}.<br>${ok ? "That matches the cells in this tissue well." : (size > truth ? "That looks too big. Did you count every cell, including partial ones at the edge?" : "That looks too small. Check how many cells you counted across, in a straight line through the middle.")}`;
  }
}

// ---------- styles ----------
function injectCss() {
  if (document.getElementById("cs-scope-css")) return;
  const s = document.createElement("style");
  s.id = "cs-scope-css";
  s.textContent = `
  .scope-on .lbl3d, .scope-on .cs-hint, .scope-on .cs-scale { display: none !important; }
  .scope-ui { position: absolute; inset: 0; z-index: 4; pointer-events: none; font-size: 0.8rem; color: #e8f1ff; }
  .scope-ui > * { pointer-events: auto; }
  .scope-hud { position: absolute; left: 12px; top: 12px; max-width: min(250px, 46%); pointer-events: none; line-height: 1.35; color: #dbe7f7; background: rgba(8, 14, 26, 0.74); padding: 7px 11px; border-radius: 11px; border: 1px solid rgba(140, 200, 255, 0.2); }
  .scope-hud .big { font-family: var(--font-display, inherit); font-size: 1.7rem; font-weight: 700; line-height: 1.1; color: #fff; }
  .scope-hud .sm { font-size: 0.7rem; color: #9fb3cf; }
  .scope-hud b { color: #fff; }
  .scope-bar { position: absolute; left: 0; top: 0; pointer-events: none; color: #17120a; font-weight: 600; font-size: 0.75rem; text-shadow: 0 0 3px rgba(255,255,255,.55); white-space: nowrap; }
  .scope-bar i { display: block; height: 5px; border: 2px solid #17120a; border-top: 0; min-width: 4px; }
  .scope-bar span { display: block; margin-top: 2px; }
  .scope-bar.em { color: #111; }
  .scope-ruler { position: absolute; inset: 0; pointer-events: none; touch-action: none; }
  .scope-ruler.on { pointer-events: auto; cursor: crosshair; }
  .scope-ruler svg { position: absolute; inset: 0; overflow: visible; display: none; }
  .scope-ruler.has svg { display: block; }
  .scope-ruler line { stroke: #ff3b6b; stroke-width: 2; stroke-linecap: round; filter: drop-shadow(0 0 2px rgba(255,255,255,.8)); }
  .scope-ruler .rv { position: absolute; left: 0; top: 0; display: none; padding: 2px 7px; border-radius: 6px; background: rgba(10,12,18,.88); color: #fff; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .scope-ruler.has .rv { display: block; }
  .scope-dock { position: absolute; left: 50%; bottom: 10px; transform: translateX(-50%); width: min(560px, calc(100% - 330px)); min-width: 300px; box-sizing: border-box;
    background: rgba(8, 14, 26, 0.9); border: 1px solid rgba(140, 200, 255, 0.28); border-radius: 14px; padding: 8px 10px; backdrop-filter: blur(6px); box-shadow: 0 8px 28px rgba(0,0,0,.45); display: flex; flex-direction: column; gap: 6px; }
  .scope-row { display: flex; gap: 8px; align-items: center; }
  .scope-row.head .scope-mode { flex: 1 1 auto; }
  .scope-row .segmented { flex: 1 1 auto; }
  .scope-row .control { flex: 1 1 auto; margin: 0; }
  .scope-more, .scope-off { padding: 6px 10px; font-size: 0.78rem; }
  .scope-extra { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; align-items: start; }
  .scope-extra .scope-row.tools { grid-column: 1 / -1; flex-wrap: wrap; }
  .scope-extra > .scope-row:first-child { grid-column: 1 / -1; }
  .scope-extra .control { margin: 0; }
  .scope-extra .scope-note { grid-column: 1 / -1; margin: 0; font-size: 0.72rem; }
  .scope-dock.min .scope-extra { display: none; }
  .scope-dock .btn { padding: 6px 10px; font-size: 0.8rem; }
  .scope-compare { position: absolute; right: 12px; top: 12px; width: min(210px, 42%); margin: 0; padding: 8px; box-sizing: border-box; background: rgba(8, 14, 26, 0.92); border: 1px solid rgba(140,200,255,.28); border-radius: 12px; font-size: 0.66rem; color: #b9c9de; }
  .scope-compare[hidden] { display: none; }
  .scope-compare .circ, .scope-compare .rect { overflow: hidden; background: #000; }
  .scope-compare .circ { border-radius: 50%; aspect-ratio: 1; }
  .scope-compare .rect { border-radius: 8px; aspect-ratio: 4/3; }
  .scope-compare img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .scope-compare figcaption { margin-top: 6px; line-height: 1.3; }
  .scope-compare a { color: #7fd8cf; }
  .scope-compare button { position: absolute; top: 4px; right: 4px; padding: 2px 7px; }
  .scope-fig { margin: 0 0 8px; } .scope-fig img { width: 100%; height: auto; border-radius: 10px; display: block; background: #000; }
  .scope-fig figcaption { font-size: 0.72rem; color: var(--ink-faint); margin-top: 5px; line-height: 1.35; } .scope-fig a { color: var(--accent); }
  .scope-list { margin: 0; padding-left: 18px; font-size: 0.84rem; color: var(--ink-dim); display: flex; flex-direction: column; gap: 4px; }
  .scope-seen { list-style: none; margin: 0 0 6px; padding: 0; display: flex; flex-direction: column; gap: 3px; font-size: 0.84rem; }
  .scope-seen li { display: flex; gap: 6px; align-items: baseline; color: var(--ink-dim); }
  .scope-seen li.yes { color: var(--ink); } .scope-seen li span { width: 1.1em; color: var(--good, #4ade80); } .scope-seen li.no span { color: var(--danger, #f87171); }
  .scope-seen em { margin-left: auto; font-style: normal; font-size: 0.74rem; color: var(--ink-faint); text-align: right; }
  .scope-seen .sm { font-size: 0.74rem; color: var(--ink-faint); }
  .scope-explain p { margin: 0 0 8px; } .scope-honest { border-left: 3px solid var(--accent); padding-left: 8px; }
  .calc { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; margin-top: 6px; }
  .calc label { font-size: 0.82rem; color: var(--ink-dim); display: flex; flex-direction: column; gap: 4px; flex: 1 1 140px; }
  .calc input { width: 100%; box-sizing: border-box; padding: 7px 8px; border-radius: 8px; border: 1px solid var(--panel-border); background: var(--btn-bg); color: var(--ink); font-size: 0.9rem; }
  .calc-out { font-size: 0.86rem; color: var(--ink-dim); margin-top: 8px; min-height: 1.2em; } .calc-out b { color: var(--ink); }
  @media (max-width: 860px) {
    .scope-dock { top: 8px; bottom: auto; width: calc(100% - 16px); min-width: 0; }
    .scope-hud { top: auto; bottom: 10px; max-width: 58%; } .scope-hud .big { font-size: 1.35rem; }
    .scope-compare { top: auto; bottom: 10px; right: 10px; width: min(150px, 38%); }
    .scope-extra { grid-template-columns: 1fr; }
  }`;
  document.head.appendChild(s);
}

// ---------- entry point (shell.js calls this from the "Microscope" button) ----------
export function toggle(engine, btn) {
  if (engine.scope?.active) { engine.scope.deactivate(); return; }
  if (engine.busy) return;
  if (!engine.current?.microscope) {
    engine.toast?.("The microscope works on the whole cell. Go back up to the cell, then switch it on. (Organelles and molecules are below what a light microscope can resolve; try the electron microscope.)");
    return;
  }
  const s = new Scope(engine, btn);
  try { s.activate(); } catch (err) { console.error(err); try { s.deactivate(); } catch (e2) { console.error(e2); } engine.toast?.("Couldn't start the microscope on this device."); }
}
