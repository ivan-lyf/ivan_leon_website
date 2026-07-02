# Room Environment Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the flat box the 3D Macintosh sits in into a lit, textured, lived-in room — upgraded prop models, coffee-mug steam, bonsai, ambient audio — while capping GPU/CPU load so an idle tab never spins fans up.

**Architecture:** All scene-graph work extends the existing IIFE in `shared/mac-scene.js` (procedural builders + GLB loading, `window.MacScene` debug API). A frame-governor + quality-tier system is built FIRST so every later feature registers with it. New GLBs are lazy-loaded after first paint and swapped over procedural stand-ins. Ambient audio is a self-contained new file `shared/scene-audio.js` (Web Audio synthesis — no downloaded asset, no license). Post-processing is deliberately replaced by zero-cost equivalents (additive glow sprites + CSS vignette + tone-mapped grade) to honor the Task-7 hard perf requirement on this no-bundler stack.

**Tech Stack:** Vanilla JS (no build step), Three.js **r128 UMD** via unpkg CDN (`THREE.*` globals), OrbitControls/GLTFLoader/DRACOLoader from `examples/js` UMD, html-to-image, Web Audio API. Asset tooling: `npx @gltf-transform/cli` (node v22 available), macOS `sips` for texture downscaling.

## Global Constraints

- Three.js is **r128** — use only r128-era APIs (`sRGBEncoding`, `PMREMGenerator.fromScene`, `THREE.DRACOLoader` UMD). No imports/modules.
- No build system: new code = plain script files loaded from `index.html`; follow the existing IIFE + `function` style (ES5-flavored, `const`/arrow OK — file already mixes them).
- Total **added** asset weight across all new geometry/textures: well under **5–8MB gzipped**; target ≤4MB raw for new GLBs.
- Lazy-load all new assets (models, anything heavy) until after `window.__sceneLoaded` is true.
- Frame rate cap: 45fps active / 24fps idle; rendering effectively pauses when tab hidden. DPR clamp: 1.75 high tier, 1.25 lite tier.
- Only the desk lamp casts real-time shadows; everything else uses baked blob contact shadows.
- Lite tier (mobile / ≤4 cores): shadows off, no dust motes, reduced steam, lower DPR — must still look intentional.
- Mac OS UI layer (`shared/mac.js`, `#screen-host`, profiles, enter/exit screen view) is **out of scope** — do not touch.
- Third-party assets: verify license on the Sketchfab page at download time; record author/URL/license in `CREDITS.md`.
- Shared repo: `git pull` before starting each work session; commit per task with descriptive messages.
- Audio: synthesized in-code (user decision) — no autoplay before first user gesture; mute toggle; very low default volume.
- Model sourcing: drive the user's Chrome via claude-in-chrome to download from Sketchfab (user decision); procedural fallback if a model is unavailable/bad.

## File Structure

- **Modify** `shared/mac-scene.js` — quality tiers, frame governor, room rebuild, lighting rework, lamp rebuild, contact shadows, glow sprites, deferred GLB swap-in, mug + steam, bonsai, dust motes.
- **Create** `shared/scene-audio.js` — self-contained ambient room-tone synth + mute toggle UI.
- **Modify** `index.html` — DRACOLoader script tag, `scene-audio.js` script tag, vignette overlay div, mute-button styles.
- **Create** `CREDITS.md` — asset attribution (models; note that audio is synthesized).
- **Add** `shared/assets/models/*.glb` — optimized keyboard, snowboard (and skis if a better one is found).
- **Delete** `shared/assets/textures/concrete_*.jpg` — 15MB, unused by current code.
- **Downscale** `shared/assets/textures/wood_*.jpg` in place to 1024px.

## Verification Harness (used by every task)

No test framework exists; verification = serve + drive real browser:

```bash
# from repo root, once per session (background):
python3 -m http.server 8137
```

Open `http://localhost:8137` via claude-in-chrome. Standard checks:
- **Console clean:** `read_console_messages` shows no new errors.
- **FPS probe** (javascript_tool): `(async()=>{const a=window.__frames;await new Promise(r=>setTimeout(r,2000));return (window.__frames-a)/2})()` — compare to expected cap.
- **Screenshot** for visual acceptance.
- Scene debug setters (`window.MacScene.setLamp` etc.) for live tuning; fold final values back into code.

---

### Task 1: Asset weight cleanup (quick win)

**Files:**
- Delete: `shared/assets/textures/concrete_color.jpg`, `concrete_normal.jpg`, `concrete_rough.jpg`
- Modify (binary, in place): `shared/assets/textures/wood_color.jpg`, `wood_normal.jpg`, `wood_rough.jpg`
- Modify: `shared/mac-scene.js` (remove dead `makeConcrete()` function, lines ~190–222)

**Interfaces:**
- Consumes: nothing.
- Produces: `shared/assets/textures/wood_{color,rough,normal}.jpg` still at the same paths (desk code unchanged), each ≤1024px / ~150–350KB.

- [ ] **Step 1: Confirm concrete is unreferenced**

Run: `grep -rn "concrete" shared/ index.html ivan/ leon/ --include='*.js' --include='*.html' --include='*.css'`
Expected: only the dead `makeConcrete()` definition inside `mac-scene.js` (never called — confirm with `grep -n "makeConcrete()" shared/mac-scene.js` showing exactly one hit, the definition).

- [ ] **Step 2: Delete concrete textures + dead function**

```bash
git rm shared/assets/textures/concrete_color.jpg shared/assets/textures/concrete_normal.jpg shared/assets/textures/concrete_rough.jpg
```
Remove the whole `function makeConcrete() {...}` block from `shared/mac-scene.js` (the `/* ---------- concrete room ---------- */` comment through the closing brace before `buildRoom`).

- [ ] **Step 3: Downscale wood textures to 1024px**

```bash
cd shared/assets/textures
for f in wood_color.jpg wood_rough.jpg wood_normal.jpg; do sips -Z 1024 "$f" --setProperty formatOptions 80 --out "$f"; done
ls -la wood_*
```
Expected: each file well under 500KB (from 1.8–4.4MB).

- [ ] **Step 4: Verify in browser**

Serve + load. Desk wood must look unchanged at normal camera distances (1024px is plenty for a 36-unit tabletop). Console clean, boot completes.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "perf(assets): drop unused 15MB concrete set, downscale wood textures to 1024px"
```

---

### Task 2: Quality tiers + frame governor (perf foundation)

**Files:**
- Modify: `shared/mac-scene.js` — top of IIFE (constants) + `init()` renderer setup + `animate()` loop + `refreshTexture()` gate.

**Interfaces:**
- Consumes: existing `animate()` IIFE, `glRenderer`, `controls`, `flyIn`, `zoomTarget`, `refreshTexture()`.
- Produces (used by ALL later tasks):
  - `const QUALITY` — `{ name:'high'|'lite', dpr, shadows:boolean, shadowMapSize:number, motes:number, steamCount:number }`
  - `function bumpActivity()` — call on any user/visual activity; governor renders at active fps for 3s after last call.
  - `window.MacScene.getQuality()` — returns `QUALITY` (for verification).

- [ ] **Step 1: Add tier detection near the top of the IIFE (after `const T = window.THREE;`)**

```js
// device capability tier — lite gets lower DPR, baked-only shadows, fewer particles
const QUALITY = (function () {
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency || 4;
  const lite = mobile || cores <= 4;
  return lite
    ? { name: 'lite', dpr: 1.25, shadows: false, shadowMapSize: 1024, motes: 0,  steamCount: 24 }
    : { name: 'high', dpr: 1.75, shadows: true,  shadowMapSize: 1024, motes: 60, steamCount: 60 };
})();
```

- [ ] **Step 2: Wire tier into renderer + shadow setup in `init()`**

Replace `glRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));` with `glRenderer.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY.dpr));` and `glRenderer.shadowMap.enabled = true;` with `glRenderer.shadowMap.enabled = QUALITY.shadows;`.

- [ ] **Step 3: Replace the uncapped `animate()` with the governed loop**

```js
// ---- frame governor: cap active fps, drop lower when idle, rely on rAF's
// built-in pause when the tab is hidden. Idle animations (steam, motes)
// stay alive at the idle rate; all animation is driven by real time.
const FPS_ACTIVE = 45, FPS_IDLE = 24, IDLE_AFTER_MS = 3000;
let lastFrameT = 0, lastActivityT = performance.now();
function bumpActivity() { lastActivityT = performance.now(); }

window.__frames = 0;
(function animate(now) {
  requestAnimationFrame(animate);
  now = now || performance.now();
  const active = flyIn || (now - lastActivityT < IDLE_AFTER_MS);
  const budget = 1000 / (active ? FPS_ACTIVE : FPS_IDLE);
  if (now - lastFrameT < budget - 0.75) return;   // skip frame
  lastFrameT = now;
  window.__frames++;
  // ... existing autoRotate / flyIn / zoom-glide body unchanged, EXCEPT:
  // inside the zoom-glide branch, when |zoomTarget - curDist| > 0.0008 also call bumpActivity()
  controls.update();
  if (window.__updateIdleFX) window.__updateIdleFX(now);  // steam/motes/sway hook (later tasks)
  glRenderer.render(scene, camera);
})();
```

Wire activity sources in `init()`:
```js
controls.addEventListener('change', bumpActivity);              // orbit / damping settle
glRenderer.domElement.addEventListener('pointerdown', bumpActivity);
// in the existing wheel handler, add bumpActivity();
```

- [ ] **Step 4: Gate the DOM-texture refresh on visibility**

At the top of `refreshTexture()` add: `if (document.hidden) return;`

- [ ] **Step 5: Expose tier + verify**

Add `getQuality: function () { return QUALITY; }` to the `window.MacScene` export object.

Serve + load, then FPS probe twice:
1. Immediately after wiggling the camera (drag): expect **~43–46**.
2. After 5s hands-off: expect **~22–25**.
3. `window.MacScene.getQuality().name` returns `'high'` on this machine.
Console clean; orbit, scroll-zoom, fly-in all still feel smooth (fly-in forces active rate).

- [ ] **Step 6: Commit**

```bash
git add shared/mac-scene.js && git commit -m "perf(scene): quality tiers + frame governor (45fps active / 24fps idle, DPR clamp)"
```

---

### Task 3: Room surfaces — walls, floor, ceiling, trim

**Files:**
- Modify: `shared/mac-scene.js` — replace `buildRoom()` internals; add `makePlaster()` canvas-texture helper next to `makeWood()`.

**Interfaces:**
- Consumes: `pbrMat()`, `loadTex()`, `groundMesh` convention (floor is the shadow receiver), `buildRoom(floorY)` signature and its `{RX,RZ,RH,floorY}` return (skis/snowboard placement depends on it — do not change).
- Produces: same `buildRoom()` contract; visually textured room.

- [ ] **Step 1: Add `makePlaster()` generator (place directly after `makeWood()`)**

```js
// warm plaster wall texture: vertical tone gradient + mottle + fine speckle +
// baked edge/corner AO so walls read as lit surfaces, not color fills
function makePlaster(top, bottom, edgeAO) {
  const S = 1024, c = document.createElement('canvas'); c.width = S; c.height = S;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 60; i++) {                       // soft mottled blotches
    const r = 90 + Math.random() * 260, gx = Math.random() * S, gy = Math.random() * S;
    const rg = x.createRadialGradient(gx, gy, 0, gx, gy, r);
    const dk = Math.random() < 0.5;
    rg.addColorStop(0, dk ? 'rgba(120,100,80,' + (0.02 + Math.random() * 0.05) + ')'
                          : 'rgba(255,244,224,' + (0.02 + Math.random() * 0.05) + ')');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = rg; x.fillRect(0, 0, S, S);
  }
  for (let i = 0; i < 7000; i++) {                     // fine grain
    const v = 0.02 + Math.random() * 0.05;
    x.fillStyle = Math.random() < 0.5 ? 'rgba(90,74,58,' + v + ')' : 'rgba(255,240,214,' + v + ')';
    x.fillRect(Math.random() * S, Math.random() * S, 1, 1);
  }
  if (edgeAO) {                                        // baked corner/floor AO
    const e = x.createLinearGradient(0, 0, S * 0.14, 0);
    e.addColorStop(0, 'rgba(60,44,30,0.34)'); e.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = e; x.fillRect(0, 0, S * 0.14, S);
    x.save(); x.translate(S, 0); x.scale(-1, 1); x.fillRect(0, 0, S * 0.14, S); x.restore();
    const b = x.createLinearGradient(0, S, 0, S * 0.82);
    b.addColorStop(0, 'rgba(60,44,30,0.4)'); b.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = b; x.fillRect(0, S * 0.82, S, S * 0.18);
  }
  const t = new T.CanvasTexture(c);
  t.encoding = T.sRGBEncoding; t.anisotropy = 8;
  return t;
}
```

- [ ] **Step 2: Rebuild `buildRoom()` surfaces (same signature/return)**

```js
function buildRoom(floorY) {
  const RX = 58, RZ = 52, RH = 50;
  const ceilY = floorY + RH;
  const room = new T.Group();

  const wallTex = makePlaster('#eadbc0', '#cdb894', true);   // shared by all 4 walls
  const wallMat = new T.MeshStandardMaterial({ map: wallTex, roughness: 0.92, metalness: 0 });

  // floor: reuse the desk's wood PBR set (texture reuse per budget), darker tint
  const floorMat = pbrMat('shared/assets/textures/wood', 7, 7, { color: 0xb9a284, roughness: 0.9 });
  const floor = new T.Mesh(new T.PlaneGeometry(RX * 2, RZ * 2), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, floorY, 0);
  floor.receiveShadow = true; room.add(floor);
  groundMesh = floor;

  const ceil = new T.Mesh(new T.PlaneGeometry(RX * 2, RZ * 2),
    new T.MeshStandardMaterial({ map: makePlaster('#f2e8d6', '#e6d8c0', false), roughness: 0.95 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, ceilY, 0); room.add(ceil);

  [[0, -RZ, 0], [0, RZ, Math.PI], [-RX, 0, Math.PI / 2], [RX, 0, -Math.PI / 2]].forEach(function (p, i) {
    const w = new T.Mesh(new T.PlaneGeometry((i < 2 ? RX : RZ) * 2, RH), wallMat);
    w.position.set(p[0], floorY + RH / 2, p[1]); w.rotation.y = p[2];
    w.receiveShadow = true; room.add(w);
  });

  // baseboard trim — grounds walls to floor
  const trimMat = new T.MeshStandardMaterial({ color: 0x8a6f4f, roughness: 0.7 });
  [[0, -RZ + 0.3, RX * 2, 0], [-RX + 0.3, 0, RZ * 2, Math.PI / 2], [RX - 0.3, 0, RZ * 2, Math.PI / 2]].forEach(function (p) {
    const tb = new T.Mesh(new T.BoxGeometry(p[2], 1.6, 0.5), trimMat);
    tb.position.set(p[0], floorY + 0.8, p[1]); tb.rotation.y = p[3];
    tb.receiveShadow = true; room.add(tb);
  });

  scene.add(room);
  return { RX: RX, RZ: RZ, RH: RH, floorY: floorY };
}
```
(Front wall gets no baseboard — camera never sees it and it would z-fight the orbit start; fine to omit.)

- [ ] **Step 3: Verify visually**

Serve + screenshot from default view and from a wide orbit (drag far left/right). Walls show subtle tonal variation + darker corners; floor reads as wood; no seams/moiré at wall-floor junction; skis/snowboard still lean correctly against the back wall. Console clean.

- [ ] **Step 4: Commit**

```bash
git add shared/mac-scene.js && git commit -m "feat(scene): textured plaster walls, wood floor, baseboards — room no longer a flat box"
```

---

### Task 4: Lamp rebuild + lighting rework (lamp becomes THE key light)

**Files:**
- Modify: `shared/mac-scene.js` — `buildLamp()`, the lights block in `init()`, `MOODS`/`applyMood()` intensities, add env-map bootstrap.

**Interfaces:**
- Consumes: `QUALITY` (Task 2), lamp group placement API (`MacScene.setLamp` — keep working).
- Produces:
  - `lampLight` is a `T.SpotLight` (warm ~2800K, the only `castShadow` light).
  - `function bulbWorldPos()` → `T.Vector3` of bulb (Task 6 glow sprite + Task 8 steam lighting cue use this).
  - `scene.environment` set from a PMREM-rendered gradient (soft reflections on lamp metal / mug glaze).

- [ ] **Step 1: Rework the light rig in `init()`**

Replace the current 4-light block with:
```js
lights.hemi = new T.HemisphereLight(0xffe9d2, 0x6e5f4d, 0.5); scene.add(lights.hemi);
// soft cool "window" fill — NO shadow (lamp is the sole real-time caster)
lights.key = new T.DirectionalLight(0xfff2df, 0.5);
lights.key.position.set(-14, 18, 12); scene.add(lights.key);
lights.fill = new T.DirectionalLight(0xffffff, 0.28); lights.fill.position.set(12, 8, 9); scene.add(lights.fill);
// subtle cool rim from behind to separate props from the back wall
lights.rim = new T.DirectionalLight(0xd6e4ff, 0.4); lights.rim.position.set(3, 11, -16); scene.add(lights.rim);
```
Update every `MOODS` entry's `key` value ×~0.45 to keep `applyMood()` sensible (room: key 0.5, peach 0.52, spotlight 0.8, white 0.48). Delete the `lights.key.castShadow` + shadow-camera config lines.

- [ ] **Step 2: Environment reflections (one-time PMREM, zero download)**

In `init()` after renderer creation:
```js
// soft warm gradient environment -> believable speculars on metal/ceramic
(function makeEnv() {
  const envScene = new T.Scene();
  const c = document.createElement('canvas'); c.width = 4; c.height = 64;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, '#fff3e0'); g.addColorStop(0.55, '#d9c4a4'); g.addColorStop(1, '#6e5c48');
  x.fillStyle = g; x.fillRect(0, 0, 4, 64);
  const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding;
  envScene.background = t;
  const box = new T.Mesh(new T.BoxGeometry(100, 100, 100),
    new T.MeshBasicMaterial({ map: t, side: T.BackSide }));
  envScene.add(box);
  const pmrem = new T.PMREMGenerator(glRenderer);
  scene.environment = pmrem.fromScene(envScene, 0.04).texture;
  pmrem.dispose();
})();
```

- [ ] **Step 3: Rebuild the lamp head/light in `buildLamp()`**

Keep the procedural anglepoise geometry, but:
1. Aim: change `const target = new T.Vector3(-7.0, 0, 2.4);` to `new T.Vector3(-6.5, 0, 6.0);` (keyboard/Mac work area).
2. Replace the PointLight with a shadow-casting SpotLight:
```js
lampLight = new T.SpotLight(0xffc98a, 0.0, 55, 0.62, 0.55, 1.3);  // warm ~2800K
lampLight.position.y = 0.3;
lampLight.castShadow = QUALITY.shadows;
lampLight.shadow.mapSize.set(QUALITY.shadowMapSize, QUALITY.shadowMapSize);
lampLight.shadow.bias = -0.0004; lampLight.shadow.radius = 5;
lampLight.shadow.camera.near = 1; lampLight.shadow.camera.far = 60;
head.add(lampLight);
const spotTarget = new T.Object3D(); spotTarget.position.y = -6; head.add(spotTarget);
lampLight.target = spotTarget;
```
3. Ramp `liMax` to `2.2` (spot intensity semantics differ from point).
4. Expose bulb position (add inside the IIFE, after `buildLamp`):
```js
function bulbWorldPos() {
  const v = new T.Vector3();
  if (lampLight) lampLight.getWorldPosition(v);
  return v;
}
```
5. In `MacScene.setLamp`, existing intensity setter keeps working (`lampLight.intensity = p.light`).

- [ ] **Step 4: Tune + verify**

Serve. Use screenshot + `MacScene.setLamp({...})` to confirm: base flush on desk, head visibly aimed at keyboard area, warm pool of light on the desk with a soft real shadow from the Mac/keyboard (high tier), lamp metal shows env reflection. FPS probe: idle still ~24. Fold any tuned position values back into `buildLamp()`.

- [ ] **Step 5: Commit**

```bash
git add shared/mac-scene.js && git commit -m "feat(scene): lamp is now the motivated key light — warm shadow-casting spot + env reflections"
```

---

### Task 5: Grounding pass — contact shadows, glow sprites, vignette

**Files:**
- Modify: `shared/mac-scene.js` — add `makeBlobTex()`, `addContactShadow()`, `addGlowSprite()`; call from `init()`/builders.
- Modify: `index.html` — vignette overlay div + CSS.

**Interfaces:**
- Consumes: object desk positions (Mac at 0,0,0 area; keyboard 0,0,7.4; lamp 10.8,0,-1.5), `bulbWorldPos()` (Task 4).
- Produces: `addContactShadow(parent, w, d, x, z, opacity)` and `addGlowSprite(size, color, opacity)` → `T.Sprite` — Tasks 8–10 reuse both for mug/bonsai/new models.

- [ ] **Step 1: Shared helpers (place after `makePlaster()`)**

```js
// one shared radial blob texture for all contact shadows + glows
let _blobTex = null;
function makeBlobTex() {
  if (_blobTex) return _blobTex;
  const S = 128, c = document.createElement('canvas'); c.width = S; c.height = S;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  _blobTex = new T.CanvasTexture(c);
  return _blobTex;
}
// soft baked shadow blob under a desk object (y slightly above surface)
function addContactShadow(parent, w, d, x, z, opacity) {
  const m = new T.Mesh(new T.PlaneGeometry(w, d),
    new T.MeshBasicMaterial({ map: makeBlobTex(), color: 0x000000, transparent: true,
      opacity: opacity || 0.3, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); m.renderOrder = 1;
  parent.add(m);
  return m;
}
// additive glow sprite (fake bloom) — used at lamp bulb + screen
function addGlowSprite(size, color, opacity) {
  const s = new T.Sprite(new T.SpriteMaterial({ map: makeBlobTex(), color: color,
    transparent: true, opacity: opacity, blending: T.AdditiveBlending, depthWrite: false }));
  s.scale.set(size, size, 1);
  return s;
}
```

- [ ] **Step 2: Apply contact shadows + glows**

- In `buildMac()` end: `addContactShadow(scene, 12, 12, 0, 0, 0.32);`
- In `buildKeyboard()` after placement: `addContactShadow(scene, caseW + 2, caseD + 2, 0, 7.4, 0.3);`
- In `buildLamp()` end: `addContactShadow(scene, 5.5, 5.5, 10.8, -1.5, 0.3);` and at the bulb: `const glow = addGlowSprite(3.2, 0xffd9a0, 0.55); glow.position.copy(bulb.position); head.add(glow);`
- In `buildCurvedScreen()` end (subtle screen glow):
```js
const sGlow = addGlowSprite(7.5, 0xbfd8ff, 0.18);
sGlow.position.set(SCREEN.x, SCREEN.y, SCREEN.z + 1.2); machine.add(sGlow);
```

- [ ] **Step 3: CSS vignette + warm grade overlay in `index.html`**

Add inside `<body>` right after `#hud`: `<div id="vignette"></div>`, and to the `<style>` block:
```css
#vignette { position: fixed; inset: 0; z-index: 2; pointer-events: none;
  background: radial-gradient(115% 100% at 50% 42%, rgba(0,0,0,0) 52%, rgba(28,16,6,0.30) 100%); }
```
(z-index 2: above `#gl` (1), below `#hud` (5); screen-view backdrop (40) covers it when entering the Mac.)

- [ ] **Step 4: Verify + commit**

Screenshot: every desk object visually seated (dark soft blob under each), lamp bulb has a halo, corners of frame gently darkened; entering/exiting the screen still looks right (vignette hidden behind backdrop).

```bash
git add shared/mac-scene.js index.html && git commit -m "feat(scene): contact shadows, bulb/screen glow sprites, CSS vignette grade"
```

---

### Task 6: Sketchfab sourcing session (browser) + optimization + CREDITS.md

**Files:**
- Create: `shared/assets/models/mechanical_keyboard.glb`, `shared/assets/models/snowboard.glb` (+ optionally better `skis_v2.glb`)
- Create: `CREDITS.md`

**Interfaces:**
- Consumes: user's Chrome logged into Sketchfab (confirm at session start; if not logged in, pause and ask).
- Produces: optimized GLBs at the exact paths above (Draco-compressed, ≤1024px textures), each ≤1.5MB; `CREDITS.md` with author/URL/license per model.

- [ ] **Step 1: Browse + license-check candidates in Chrome**

Load claude-in-chrome tools; `tabs_context_mcp` first, new tab. For each candidate, open its page and **verify the license badge on the page** (CC0 or CC-BY only) and that Download is free:
1. Keyboard: `https://sketchfab.com/3d-models/lowpoly-65-mechanical-keyboard-0cdd429eb08549ac954352169de5c8f8`
2. Snowboard: `https://sketchfab.com/3d-models/snowboard-89c3124619314a6a8cf5e4d380e89d40` (fallback: search "Intermediate Advanced Snowboard")
3. Skis: current model already IS the spec's candidate (Romainhj low-poly freeride skis) — browse `sketchfab.com/tags/ski` briefly for a clearly better free CC model ≤20k tris; if none stands out in ~5 minutes, KEEP the current GLB and rely on Task 7's material/lighting to lift it.
If any model fails license/quality, check the spec's alternates, then the tag pages; procedural fallback is the last resort (note it and move on).

- [ ] **Step 2: Download glTF format** for each accepted model (Download button → glTF or GLB). Files land in `~/Downloads`.

- [ ] **Step 3: Optimize each to target size**

```bash
cd /private/tmp/claude-501/*/*/scratchpad 2>/dev/null || cd "$TMPDIR"
mkdir -p sketchfab && cd sketchfab
unzip -o ~/Downloads/<downloaded>.zip -d keyboard_src
npx --yes @gltf-transform/cli optimize keyboard_src/scene.gltf keyboard.glb \
  --compress draco --texture-compress webp --texture-size 1024
ls -la keyboard.glb   # expect <= ~1.5MB; if larger, retry with --texture-size 512
```
Repeat for snowboard (target ≤1MB) and skis-if-replaced. Then:
```bash
cp keyboard.glb "<repo>/shared/assets/models/mechanical_keyboard.glb"
cp snowboard.glb "<repo>/shared/assets/models/snowboard.glb"
```

- [ ] **Step 4: Write `CREDITS.md`**

```markdown
# Asset Credits

## 3D Models (Sketchfab)
| Asset | Author | Source | License | Verified |
|---|---|---|---|---|
| Low-Poly Freeride Skis | Romainhj | https://sketchfab.com/3d-models/low-poly-freeride-skis-8b27a5ff5c6f436ab18d6d1d5862aeb5 | <license as shown on page> | 2026-07-02 |
| <keyboard name> | <author> | <url> | <license> | 2026-07-02 |
| <snowboard name> | <author> | <url> | <license> | 2026-07-02 |

Models were optimized (Draco + WebP, textures ≤1024px) via gltf-transform; geometry/materials otherwise unmodified.

## Textures
Wood + (removed) concrete PBR sets: <fill in original source if known, else "pre-existing in repo">.

## Audio
Ambient room tone is synthesized in-browser via the Web Audio API (`shared/scene-audio.js`) — no recorded asset, no third-party license.
```
Fill the actual license names read off each model page during Step 1.

- [ ] **Step 5: Sanity-load each GLB** (quick check before integration)

```bash
npx --yes @gltf-transform/cli inspect shared/assets/models/mechanical_keyboard.glb | head -40
```
Expected: valid file, draws ≤ ~30k tris keyboard / ~10k snowboard, textures ≤1024.

- [ ] **Step 6: Commit**

```bash
git add shared/assets/models CREDITS.md && git commit -m "assets: add Draco-optimized keyboard + snowboard models from Sketchfab, CREDITS.md"
```

---

### Task 7: Deferred GLB swap-in system + keyboard & snowboard/ski integration

**Files:**
- Modify: `index.html` — add DRACOLoader script tag after GLTFLoader:
  `<script src="https://unpkg.com/three@0.128.0/examples/js/loaders/DRACOLoader.js"></script>`
- Modify: `shared/mac-scene.js` — `loadDeferredGLB()`, `fitAndGround()`, swap logic in `buildKeyboard()`/`buildSnowboard()`/`buildSkis()` callers.

**Interfaces:**
- Consumes: GLB paths from Task 6, `QUALITY`, `addContactShadow`, groups `keyboardGroup`/`snowboardGroup`/`skisGroup` + their `MacScene.set*` setters (must keep working on the swapped models).
- Produces:
  - `function loadDeferredGLB(url, cb)` — post-boot loader (NOT via `loadMgr`), Draco-enabled. Task 9 (bonsai fallback) may reuse.
  - `function fitAndGround(gltfScene, longest)` → pivot `T.Group` scaled so max dimension = `longest`, bottom at y=0, centered on x/z (generalizes the existing skis fitting code).

- [ ] **Step 1: Add the loader + fitter (place near `buildSkis`)**

```js
// deferred loader: runs AFTER the boot screen clears so first paint stays fast
let _draco = null;
function loadDeferredGLB(url, cb) {
  const l = new T.GLTFLoader();
  if (T.DRACOLoader) {
    if (!_draco) { _draco = new T.DRACOLoader(); _draco.setDecoderPath('https://unpkg.com/three@0.128.0/examples/js/libs/draco/'); }
    l.setDRACOLoader(_draco);
  }
  l.load(url, cb, undefined, function (e) { console.warn('deferred glb failed', url, e); });
}
function whenInteractive(fn) {
  if (window.__sceneLoaded) { fn(); return; }
  const iv = setInterval(function () { if (window.__sceneLoaded) { clearInterval(iv); fn(); } }, 250);
}
// scale longest dimension to `longest`, rotate longest axis to Y if `upright`,
// center x/z and rest bottom on y=0 — returns a pivot group (existing skis logic, generalized)
function fitAndGround(inner, longest, upright) {
  let box = new T.Box3().setFromObject(inner);
  let size = box.getSize(new T.Vector3());
  inner.scale.setScalar(longest / Math.max(size.x, size.y, size.z));
  if (upright) {
    box = new T.Box3().setFromObject(inner); size = box.getSize(new T.Vector3());
    if (size.x >= size.y && size.x >= size.z) inner.rotation.z = Math.PI / 2;
    else if (size.z >= size.y && size.z >= size.x) inner.rotation.x = -Math.PI / 2;
  }
  const pivot = new T.Group(); pivot.add(inner);
  const pb = new T.Box3().setFromObject(pivot);
  const pc = pb.getCenter(new T.Vector3());
  inner.position.x -= pc.x; inner.position.z -= pc.z; inner.position.y -= pb.min.y;
  inner.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return pivot;
}
```
Refactor `buildSkis()` to use `fitAndGround(gltf.scene, 26, true)` (behavior identical).

- [ ] **Step 2: Keyboard swap-in**

At the end of `buildKeyboard()` (procedural version stays as the boot-time stand-in AND the lite-tier/failure fallback):
```js
// swap in the high-fidelity model once the scene is interactive
whenInteractive(function () {
  loadDeferredGLB('shared/assets/models/mechanical_keyboard.glb', function (gltf) {
    const kb = fitAndGround(gltf.scene, caseW, false);   // match procedural footprint width
    kb.position.set(0, 0, 7.4);
    scene.add(kb);
    scene.remove(g);            // retire procedural keyboard (keep the cable + contact shadow)
    keyboardGroup = kb;
    bumpActivity(); renderNow();
  });
});
```
Check orientation on screenshot; if the model arrives keys-up-wrong, add an explicit `inner.rotation.y = Math.PI` style correction (determined visually, then hard-coded).

- [ ] **Step 3: Snowboard swap-in**

Same pattern at end of `buildSnowboard()`: load `snowboard.glb`, `fitAndGround(gltf.scene, 24, true)`, add to a lean group copying the existing transform (`lean.rotation.x=-0.18; lean.rotation.y=-0.1; lean.position.set(30, room.floorY, -room.RZ + 6.5)`), remove procedural board, update `snowboardGroup`. If skis were replaced in Task 6, identical treatment with `26` length and the skis transform.

- [ ] **Step 4: PBR touch-up pass on arrival**

In each swap callback, traverse materials: `o.material.envMapIntensity = 0.6;` and for the snowboard/ski base ensure `metalness ≤ 0.2, roughness ≥ 0.4` unless the sourced textures already read well (screenshot judgment; record final values in code comments).

- [ ] **Step 5: Verify**

- Boot time unchanged (models load after terminal clears — throttle network in DevTools to confirm boot doesn't wait on them).
- Screenshot close-up: individual keycaps read clearly; snowboard topsheet reads; both receive lamp light + have shadows.
- `MacScene.setKeyboard({x:1})` still moves the new model.
- FPS probe idle: still ~24. Console clean.

- [ ] **Step 6: Commit**

```bash
git add shared/mac-scene.js index.html && git commit -m "feat(scene): lazy swap-in of hi-fi keyboard + snowboard GLBs (Draco), procedural fallback kept"
```

---

### Task 8: Coffee mug + steam

**Files:**
- Modify: `shared/mac-scene.js` — `buildMug()` (procedural lathe — spec allows; zero download), steam particle system, `__updateIdleFX` wiring.

**Interfaces:**
- Consumes: `QUALITY.steamCount`, `addContactShadow`, env map (glaze reflections), `__updateIdleFX` hook (Task 2).
- Produces: `mugGroup`, `MacScene.setMug({x,z})` setter; `updateSteam(now)` registered into `__updateIdleFX`.

- [ ] **Step 1: Procedural mug (`buildMug()`, called from `init()` after `buildLamp()`)**

```js
let mugGroup = null;
function buildMug() {
  const g = new T.Group();
  const glaze = new T.MeshStandardMaterial({ color: 0xb84a3a, roughness: 0.25, metalness: 0.0, envMapIntensity: 0.9 });
  // body: lathe profile (base -> wall -> lip), ~2.2 tall, 1.6 diameter
  const pts = [];
  pts.push(new T.Vector2(0, 0), new T.Vector2(0.62, 0), new T.Vector2(0.72, 0.08),
           new T.Vector2(0.78, 0.5), new T.Vector2(0.8, 1.7), new T.Vector2(0.84, 2.15),
           new T.Vector2(0.8, 2.2), new T.Vector2(0.74, 2.18), new T.Vector2(0.7, 1.7),
           new T.Vector2(0.68, 0.35), new T.Vector2(0, 0.3));
  const body = new T.Mesh(new T.LatheGeometry(pts, 36), glaze);
  body.castShadow = true; body.receiveShadow = true; g.add(body);
  const handle = new T.Mesh(new T.TorusGeometry(0.55, 0.13, 12, 24, Math.PI * 1.6), glaze);
  handle.position.set(0.82, 1.15, 0); handle.rotation.z = -Math.PI / 2 + 0.35;
  handle.castShadow = true; g.add(handle);
  const coffee = new T.Mesh(new T.CircleGeometry(0.66, 28),
    new T.MeshStandardMaterial({ color: 0x2a1608, roughness: 0.15, metalness: 0.0, envMapIntensity: 1.2 }));
  coffee.rotation.x = -Math.PI / 2; coffee.position.y = 1.95; g.add(coffee);
  g.position.set(6.8, 0, 8.2);          // right of keyboard, off the fly-in path (x=0)
  scene.add(g); mugGroup = g;
  addContactShadow(scene, 2.6, 2.6, 6.8, 8.2, 0.3);
  buildSteam(g);
  renderNow();
}
```
Add to `MacScene`: `setMug: function (p) { if (!mugGroup) return; if (p.x != null) mugGroup.position.x = p.x; if (p.z != null) mugGroup.position.z = p.z; renderNow(); return mugGroup.position; },`

- [ ] **Step 2: Steam — one draw call, shader-animated points**

```js
let steamPts = null, steamMat = null;
function buildSteam(mug) {
  const N = QUALITY.steamCount, LIFE = 5.0;
  const pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = 0; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = 0; seed[i] = Math.random(); }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new T.BufferAttribute(seed, 1));
  steamMat = new T.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uTex: { value: makeBlobTex() } },
    transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: [
      'attribute float aSeed;',
      'uniform float uTime;',
      'varying float vA;',
      'void main() {',
      '  float life = 5.0;',
      '  float t = mod(uTime * (0.75 + aSeed * 0.5) + aSeed * life, life) / life;', // 0..1 loop
      '  vec3 p = position;',
      '  p.y = t * 3.2;',                                              // rise
      '  float sw = sin(t * 6.2831 * (1.5 + aSeed) + aSeed * 40.0);',  // horizontal sway
      '  p.x += sw * (0.12 + t * 0.3); p.z += cos(t * 5.0 + aSeed * 20.0) * (0.1 + t * 0.25);',
      '  vA = smoothstep(0.0, 0.15, t) * (1.0 - smoothstep(0.55, 1.0, t)) * 0.16;',
      '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
      '  gl_PointSize = (26.0 + t * 60.0 + aSeed * 14.0) * (24.0 / -mv.z);',
      '  gl_Position = projectionMatrix * mv;',
      '}'].join('\n'),
    fragmentShader: [
      'uniform sampler2D uTex;',
      'varying float vA;',
      'void main() {',
      '  float m = texture2D(uTex, gl_PointCoord).a;',
      '  gl_FragColor = vec4(1.0, 0.92, 0.8, m * vA);',   // warm tint = catches lamp mood
      '}'].join('\n')
  });
  steamPts = new T.Points(geo, steamMat);
  steamPts.position.y = 2.0;      // coffee surface
  mug.add(steamPts);
}
```
Wire the idle hook (Task 2 left `window.__updateIdleFX`):
```js
window.__updateIdleFX = function (now) {
  if (steamMat) steamMat.uniforms.uTime.value = now / 1000;
  // (Task 9 adds foliage sway, Task 10 adds motes here)
};
```

- [ ] **Step 3: Verify**

Screenshot at default distance + zoomed toward mug: steam visible as soft warm wisps, loops with no pop (watch 15s), doesn't block screen or fly-in. FPS idle ~24, active ~45. Drag orbit — steam stays anchored to mug. `getQuality().steamCount` particles confirmed via `steamPts.geometry.attributes.aSeed.count` in console.

- [ ] **Step 4: Commit**

```bash
git add shared/mac-scene.js && git commit -m "feat(scene): procedural glazed mug + single-draw-call looping steam shader"
```

---

### Task 9: Bonsai plant

**Files:**
- Modify: `shared/mac-scene.js` — `buildBonsai()` procedural (trunk curve + foliage clusters + glazed pot), called from `init()`.

**Interfaces:**
- Consumes: `addContactShadow`, env map, `__updateIdleFX` (sway), `QUALITY` (sway only on high tier).
- Produces: `bonsaiGroup`, `MacScene.setBonsai({x,z})`, `bonsaiFoliage` group (swayed in idle hook).

- [ ] **Step 1: Build it**

```js
let bonsaiGroup = null, bonsaiFoliage = null;
function buildBonsai() {
  const g = new T.Group();
  const potMat  = new T.MeshStandardMaterial({ color: 0x3f5a52, roughness: 0.35, envMapIntensity: 0.7 });
  const soilMat = new T.MeshStandardMaterial({ color: 0x2e2018, roughness: 1.0 });
  const barkMat = new T.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.95 });

  const pot = new T.Mesh(new T.CylinderGeometry(1.5, 1.15, 1.0, 8), potMat); // low octagonal pot
  pot.position.y = 0.5; pot.castShadow = true; pot.receiveShadow = true; g.add(pot);
  const soil = new T.Mesh(new T.CylinderGeometry(1.32, 1.32, 0.12, 8), soilMat);
  soil.position.y = 1.0; g.add(soil);

  // S-curved trunk with a low branch
  const trunkCurve = new T.CatmullRomCurve3([
    new T.Vector3(0, 1.0, 0), new T.Vector3(0.35, 1.9, 0.1),
    new T.Vector3(-0.25, 2.7, -0.1), new T.Vector3(0.15, 3.4, 0.05)]);
  const trunk = new T.Mesh(new T.TubeGeometry(trunkCurve, 12, 0.22, 7), barkMat);
  trunk.castShadow = true; g.add(trunk);
  const branch = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([
    new T.Vector3(0.2, 2.2, 0.05), new T.Vector3(1.0, 2.5, 0.3)]), 6, 0.1, 6), barkMat);
  branch.castShadow = true; g.add(branch);

  // foliage: flattened dark-green blobs with per-cluster tint variation
  bonsaiFoliage = new T.Group();
  [[0.15, 3.7, 0, 1.2], [-0.5, 3.3, -0.3, 0.85], [0.75, 3.35, 0.3, 0.8],
   [1.15, 2.6, 0.35, 0.7], [-0.15, 4.1, 0.15, 0.75]].forEach(function (p, i) {
    const c = new T.Color(0x3d5a2e).offsetHSL(0, 0, (i % 3 - 1) * 0.03);
    const f = new T.Mesh(new T.SphereGeometry(p[3], 10, 7),
      new T.MeshStandardMaterial({ color: c, roughness: 1.0, flatShading: true }));
    f.position.set(p[0], p[1], p[2]); f.scale.y = 0.55;
    f.castShadow = true; bonsaiFoliage.add(f);
  });
  g.add(bonsaiFoliage);

  g.position.set(-11.5, 0, -4.0);   // back-left desk corner, opposite the lamp
  scene.add(g); bonsaiGroup = g;
  addContactShadow(scene, 3.6, 3.6, -11.5, -4.0, 0.3);
  renderNow();
}
```
Add `setBonsai` setter to `MacScene` (same shape as `setMug`). In `__updateIdleFX`, add (high tier only):
```js
if (bonsaiFoliage && QUALITY.name === 'high') bonsaiFoliage.rotation.z = Math.sin(now / 2600) * 0.008;
```

- [ ] **Step 2: Verify + commit**

Screenshot: bonsai sits in back-left desk area, doesn't crowd Mac/skis sightline from default view, foliage reads as clusters not spheres (flatShading helps), barely-visible sway after 10s watch. Orbit around — no clipping with wall.

```bash
git add shared/mac-scene.js && git commit -m "feat(scene): procedural bonsai with idle foliage sway"
```

---

### Task 10: Dust motes in the lamp light (high tier only)

**Files:**
- Modify: `shared/mac-scene.js` — `buildMotes()` + idle-hook update.

**Interfaces:**
- Consumes: `QUALITY.motes` (0 on lite → skip entirely), `bulbWorldPos()` (Task 4), `makeBlobTex()`, `__updateIdleFX`.
- Produces: single `T.Points` (~60 sprites, one draw call) drifting in the lamp cone.

- [ ] **Step 1: Build (called from `init()` after `buildLamp()`)**

```js
let motes = null, motesMat = null;
function buildMotes() {
  if (!QUALITY.motes) return;
  const N = QUALITY.motes, b = bulbWorldPos();
  const pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3]     = b.x - 2 + (Math.random() - 0.5) * 7;   // roughly inside the light cone
    pos[i * 3 + 1] = b.y * Math.random();
    pos[i * 3 + 2] = b.z + 2 + (Math.random() - 0.5) * 7;
    seed[i] = Math.random();
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new T.BufferAttribute(seed, 1));
  motesMat = new T.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uTex: { value: makeBlobTex() } },
    transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: [
      'attribute float aSeed; uniform float uTime; varying float vA;',
      'void main() {',
      '  vec3 p = position;',
      '  p.x += sin(uTime * (0.05 + aSeed * 0.1) + aSeed * 50.0) * 1.2;',
      '  p.y += sin(uTime * (0.04 + aSeed * 0.08) + aSeed * 30.0) * 0.9;',
      '  p.z += cos(uTime * (0.05 + aSeed * 0.07) + aSeed * 70.0) * 1.2;',
      '  vA = 0.05 + 0.05 * sin(uTime * (0.3 + aSeed) + aSeed * 90.0);',   // twinkle
      '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
      '  gl_PointSize = (2.0 + aSeed * 2.5) * (24.0 / -mv.z);',
      '  gl_Position = projectionMatrix * mv;',
      '}'].join('\n'),
    fragmentShader: [
      'uniform sampler2D uTex; varying float vA;',
      'void main() { gl_FragColor = vec4(1.0, 0.9, 0.75, texture2D(uTex, gl_PointCoord).a * vA); }'
    ].join('\n')
  });
  motes = new T.Points(geo, motesMat);
  scene.add(motes);
}
```
In `__updateIdleFX`: `if (motesMat) motesMat.uniforms.uTime.value = now / 1000;`

- [ ] **Step 2: Verify + commit**

Screenshot near lamp: faint drifting specks in the warm light, invisible-ish elsewhere; FPS idle unchanged (~24).

```bash
git add shared/mac-scene.js && git commit -m "feat(scene): dust motes drifting in lamp light (high tier, single draw call)"
```

---

### Task 11: Ambient room-tone audio (`shared/scene-audio.js`)

**Files:**
- Create: `shared/scene-audio.js`
- Modify: `index.html` — `<script src="shared/scene-audio.js"></script>` before the init block; mute-button CSS.

**Interfaces:**
- Consumes: DOM only (no MacScene coupling). First-gesture events on `window`.
- Produces: `window.SceneAudio = { muted(), setMuted(bool) }`; a fixed-position mute chip bottom-right; `localStorage['ambient-muted']`.

- [ ] **Step 1: Write `shared/scene-audio.js`**

```js
/* scene-audio.js — synthesized ambient room tone (Web Audio, no asset).
 * Brown-noise bed, low-passed to a soft hum, gentle slow swell. Starts only
 * after the first user gesture (autoplay policy), fades in over ~3s, suspends
 * when the tab is hidden. Mute chip bottom-right, persisted in localStorage. */
(function () {
  const KEY = 'ambient-muted';
  const TARGET_VOL = 0.022;                       // felt, not heard
  let ctx = null, master = null, started = false;
  let muted = localStorage.getItem(KEY) === '1';

  function buildGraph() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const sr = ctx.sampleRate, secs = 6, len = sr * secs;
    const buf = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len; i++) {             // brown noise
        last = (last + (Math.random() * 2 - 1) * 0.02) * 0.997;
        d[i] = last * 3.0;
      }
      const fade = sr * 0.8 | 0;                  // crossfade tail->head = seamless loop
      for (let i = 0; i < fade; i++) {
        const t = i / fade;
        d[i] = d[i] * t + d[len - fade + i] * (1 - t);
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    src.loopStart = 0; src.loopEnd = secs - 0.8;  // loop inside the crossfaded region
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.4;
    master = ctx.createGain(); master.gain.value = 0;
    const swell = ctx.createGain(); swell.gain.value = 1;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06;   // slow breathing
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 0.18;
    lfo.connect(lfoAmt); lfoAmt.connect(swell.gain);
    src.connect(lp); lp.connect(swell); swell.connect(master); master.connect(ctx.destination);
    src.start(); lfo.start();
  }
  function fadeTo(v, secs) {
    if (!master) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(v, ctx.currentTime + secs);
  }
  function start() {
    if (started) return; started = true;
    buildGraph();
    if (!muted) fadeTo(TARGET_VOL, 3);
    ['pointerdown', 'wheel', 'keydown'].forEach(function (t) { window.removeEventListener(t, start); });
  }
  ['pointerdown', 'wheel', 'keydown'].forEach(function (t) { window.addEventListener(t, start, { passive: true }); });

  document.addEventListener('visibilitychange', function () {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else if (!muted) ctx.resume();
  });

  // --- mute chip (matches #hud styling) ---
  const btn = document.createElement('button');
  btn.id = 'audio-toggle'; btn.type = 'button';
  btn.setAttribute('aria-label', 'Toggle ambient sound');
  function paint() { btn.textContent = muted ? '🔇 sound off' : '🔊 sound on'; }
  paint();
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    muted = !muted; localStorage.setItem(KEY, muted ? '1' : '0'); paint();
    if (!started) { if (!muted) start(); return; }
    if (muted) fadeTo(0, 0.6); else { ctx.resume(); fadeTo(TARGET_VOL, 1.2); }
  });
  document.body.appendChild(btn);

  window.SceneAudio = {
    muted: function () { return muted; },
    setMuted: function (m) { if (m !== muted) btn.click(); }
  };
})();
```

- [ ] **Step 2: Style + include in `index.html`**

CSS (in the existing `<style>`):
```css
#audio-toggle { position: fixed; right: 18px; bottom: 20px; z-index: 6;
  background: rgba(34,26,18,0.72); color: #ffe9cf; border: 1px solid rgba(255,233,207,0.25);
  padding: 7px 12px; border-radius: 999px; font: 11px ui-monospace, 'Courier New', monospace;
  letter-spacing: 0.3px; cursor: pointer; backdrop-filter: blur(6px); opacity: 0.85; }
#audio-toggle:hover { opacity: 1; }
```
Script tag after `mac-scene.js`: `<script src="shared/scene-audio.js"></script>`

- [ ] **Step 3: Verify**

- Load page fresh: **silence** before any interaction (autoplay respected).
- First drag/scroll: tone fades in over ~3s, very quiet, textured hum — listen for 20s: **no pop/seam**.
- Click chip: fades out; reload → stays muted (localStorage). Unmute works.
- Switch tabs: audio stops (suspend); return: resumes.
- Console clean.

- [ ] **Step 4: Commit**

```bash
git add shared/scene-audio.js index.html && git commit -m "feat(audio): synthesized ambient room tone — gesture-gated, seamless loop, mute chip"
```

---

### Task 12: Final verification sweep (Definition of Done)

**Files:** none (verification only; small fixes allowed inline).

- [ ] **Step 1: Full-tier visual pass** — screenshots: default view, wide orbit left/right, close on keyboard/mug/bonsai/lamp/skis/snowboard. Room reads lit + textured; lamp motivates key light; every object grounded.

- [ ] **Step 2: Perf evidence (not eyeballed)**

- FPS probe: active ≈45, idle ≈24, and after `document.hidden` (switch tab 10s, return) `__frames` delta during hidden ≈ 0.
- Chrome Task Manager (`Shift+Esc` — ask user to read values, or use `performance.measureUserAgentSpecificMemory`/DevTools): GPU process of the tab at idle should be a few % — record the number in the task log.
- DevTools Performance 10s idle trace: no long tasks, render work only at ~24Hz.

- [ ] **Step 3: Lite-tier check** — In DevTools device emulation (mobile UA) reload: `getQuality().name === 'lite'`, shadows off but contact blobs keep things grounded, no motes, steam sparser, still looks intentional. Screenshot.

- [ ] **Step 4: Weight budget**

```bash
du -ch shared/assets/models/*.glb shared/scene-audio.js | tail -1
git diff --stat 4d28c88 -- shared/assets | cat
```
Expected: net added asset weight ≤4MB raw (well under 5–8MB gz budget — and Task 1 *removed* ~20MB).

- [ ] **Step 5: DoD checklist sweep** — walk the spec's Definition of Done bullet-by-bullet, cite evidence (screenshot/number/file) for each. Fix any miss before proceeding.

- [ ] **Step 6: Codex review** (per user's global policy: multi-file, logic-heavy change → review before declaring done), then final commit of any accepted fixes.

```bash
git add -A && git commit -m "chore(scene): final tuning + verification fixes for room overhaul"
```

---

### Task 13: GitHub link icon (user addition, 2026-07-02)

**Files:**
- Modify: `index.html` — GitHub icon button + CSS.

**Interfaces:**
- Consumes: `#audio-toggle` chip styling (Task 11) — match it visually.
- Produces: fixed bottom-right GitHub icon linking to `https://github.com/ggttlplp201`.

- [ ] **Step 1: Add the link next to the sound chip in `index.html`**

Add inside `<body>` (after the `#vignette` div):
```html
<a id="gh-link" href="https://github.com/ggttlplp201" target="_blank" rel="noopener noreferrer" aria-label="GitHub profile">
  <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
  </svg>
</a>
```

CSS (matches the `#audio-toggle` chip; sits to its left once Task 11 lands):
```css
#gh-link { position: fixed; right: 18px; bottom: 58px; z-index: 6;
  display: flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: 999px;
  background: rgba(34,26,18,0.72); color: #ffe9cf;
  border: 1px solid rgba(255,233,207,0.25);
  backdrop-filter: blur(6px); opacity: 0.85; }
#gh-link:hover { opacity: 1; color: #ffd9a8; }
```

- [ ] **Step 2: Verify** — icon visible bottom-right above the sound chip, opens the GitHub profile in a new tab, doesn't overlap `#hud`, still hidden correctly behind the screen-view backdrop (z 6 < 40 — wait, hud is 5 and backdrop 40: 6 is fine).

- [ ] **Step 3: Commit**

```bash
git add index.html && git commit -m "feat(ui): GitHub profile link chip"
```

---

## User-requested rework round (added 2026-07-02, after Task 9)

Execution order (conflict-driven): 14 → 15 → 16 → 17, then original Tasks 10, 11, 13, 12.
Task 10 (motes) MUST run after Task 16 (lamp moves + becomes a GLB — motes anchor to `bulbWorldPos()`).

### Task 14: Wall texture upgrade (AmbientCG)

User: "the wall looks blurry and dirty" — the procedural plaster mottle reads as smudgy stains under the dimmed lighting.

- Source a smooth interior plaster texture from ambientcg.com (CC0, direct download, e.g. `https://ambientcg.com/get?file=Plaster001_1K-JPG.zip` — controller picks the best-looking candidate at 1K).
- Downscale/re-encode to ≤1024px JPG (~quality 80) → `shared/assets/textures/plaster_color.jpg` (+ `_rough.jpg`/`_normal.jpg` only if they visibly help; weight budget ≤400KB total).
- Walls: `MeshStandardMaterial` with the tiled texture (RepeatWrapping, repeat ≈ 3×1.6, warm tint via `color`), roughness ~0.9.
- Corner/floor AO: since a tiled texture can't carry baked AO, replace the canvas-baked AO with 4 slim gradient overlay quads (transparent-black `makeBlobTex`-style linear gradient canvas, `depthWrite:false`) hugging each wall corner + a floor-line strip. Ceiling keeps `makePlaster` (unaffected by the complaint).
- `makePlaster` stays only if the ceiling still uses it; delete the wall-AO branch (`edgeAO`) if no longer referenced.
- CREDITS.md: add AmbientCG row (CC0).
- Verify: walls read crisp (no smudge blobs) at default + wide orbit; corners still ground the room; console clean.

### Task 15: Pan/orbit smoothness

User: "optimize the code/system to make sure the pan view is smooth, it's a little laggy now."

Two suspected causes (verify with profiling before/after):
1. `FPS_ACTIVE = 45` quantizes to ~38fps on a 60Hz+ display — raise to 60 during genuine interaction. Idle (24) and hidden (0) behavior unchanged; the overheating requirement targets the idle lobby state, and interaction is transient.
2. `refreshTexture()` (html-to-image DOM rasterization, ~10s of ms on main thread) fires on a 1500ms interval and via MutationObserver even mid-drag — a classic jank source. Gate it during interaction: skip when `performance.now() - lastActivityT < 400` and re-queue.
- Verify with an in-page probe: rendered fps during a scripted 3s drag ≥55; DevTools long-task check during pan shows no >50ms tasks from html-to-image.

### Task 16: Lamp GLB swap + move to LEFT + bonsai to right

User: use `/Users/leon/Downloads/old_table_lamp_v01.glb` as the lamp; move lamp to the left side; light shines on the keyboard.

- Optimize the GLB: `gltf-transform optimize` (draco + webp ≤1024) → `shared/assets/models/table_lamp.glb` (~≤700KB). It has an emissive map — keep it.
- Replace the procedural anglepoise in `buildLamp()`: load the GLB **deferred** (same `whenInteractive`/`loadDeferredGLB` pattern; procedural lamp stays as boot stand-in/fallback? NO — the lamp motivates the key light from first paint; instead load it through `loadMgr` (boot-gated, it's only ~600KB) and drop the procedural lamp entirely).
- Position: LEFT side of desk, `(-13.5, 0, -2.5)` starting point (mirror of current), rotated so the shade faces the keyboard; live-tune final values.
- Light rig: keep the existing `lampLight` SpotLight (warm, intensity 15, castShadow per tier) — parent it at the GLB's bulb/shade position, target the keyboard area (world ≈ (0, 0, 6.5)); keep `bulbWorldPos()`, glow sprite at the bulb, contact shadow under the base, `dimMaterials` on the loaded model, `MacScene.setLamp` still functional.
- **Bonsai moves to the right side** (lamp's old spot): `bonsaiGroup.position.set(12.5, 0, -3.5)` starting point (live-tune); update its contact shadow coordinates to match.
- CREDITS.md: add row "Old Table Lamp v01 — provided by site owner (source/license: user-supplied file)".
- Verify: lamp reads as a real object, light pool lands on the keyboard, shadows still work, bonsai sits right without crowding snowboard/mug.

### Task 17: Vintage keyboard + mouse (M0110/M0100 style) + mug placement

User: keyboard "too modern"; provided a reference image of the classic Apple M0110 keyboard + M0100 boxy one-button mouse; mug moves to the LEFT of the keyboard so the mouse (right of keyboard) isn't blocked.

- REMOVE the modern keyboard GLB swap-in from `buildKeyboard()` (procedural path stays), `git rm shared/assets/models/mechanical_keyboard.glb`, drop its CREDITS.md row.
- Rework the procedural keyboard to read as an M0110: cream/beige wedge case with a wide flat margin, warm-gray sculpted keycaps (slightly darker than the case), tan/beige space bar, proportions per the reference (5 rows, tall Return/Shift/Tab region), small Apple-logo decal on the case corner (reuse `logoTexture()` tinted subtle), keep the coiled cable to the Mac.
- BUILD a matching one-button mouse (procedural): boxy chamfered body (~1.9 × 1.1 × 2.6 world units), slightly domed top, recessed square button at the front-top, tiny logo decal, thin cable curving from the mouse rear around to the Mac's rear port strip; place RIGHT of the keyboard ≈ `(7.5, 0, 8.0)`, slight yaw; contact shadow.
- Mug: `mugGroup.position.set(-7.2, 0, 8.4)` starting point (left of keyboard, inside the new left-side lamp pool) + move its contact shadow.
- `MacScene.setMouse({x,z,rot})` setter for placement tuning.
- Verify: keyboard/mouse read as vintage Apple kit next to the Mac at default zoom + close-up; mug left, mouse right, nothing blocks the fly-in path; keycaps still readable silhouettes at close orbit.

---

## Self-Review Notes

- **Spec coverage:** Task 1 env/lighting → Tasks 3+4+5; Task 2 mug/steam → Task 8; Task 3 audio → Task 11; Task 4 skis/snowboard → Tasks 6+7; Task 5 keyboard → Tasks 6+7; Task 6 bonsai → Task 9; Task 7 perf → Tasks 1+2+12 (plus tier gates in 8/9/10); Sketchfab workflow + credits → Task 6; lazy-load requirement → Task 7's `whenInteractive`; idle motion → Tasks 8/9/10. Camera float: deliberately skipped (conflicts with the custom zoom-glide/OrbitControls damping; spec marks it optional).
- **Post-processing deviation (explicit):** EffectComposer+UnrealBloom on r128 UMD would add 5+ CDN scripts and a multi-pass cost that Task 7 (hard requirement) argues against. Glow sprites + CSS vignette + existing ACES warm grade deliver the intended look at ~zero cost. If the user wants true bloom later, it's an additive change.
- **Type consistency:** `QUALITY`/`bumpActivity`/`__updateIdleFX` defined Task 2, consumed 4/8/9/10; `makeBlobTex`/`addContactShadow`/`addGlowSprite` defined Task 5, consumed 8/9/10; `loadDeferredGLB`/`fitAndGround`/`whenInteractive` defined Task 7; `bulbWorldPos` defined Task 4, consumed 10. Checked — names match.
