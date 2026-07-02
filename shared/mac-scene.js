/* mac-scene.js
 * Procedural classic compact Macintosh (built from scratch) + soft studio
 * lighting + OrbitControls. The user's live site is rendered onto a CURVED
 * screen mesh (centre bulges toward the viewer) that is seated exactly into
 * the modelled bezel recess. html-to-image rasterises the live #screen DOM
 * to the texture; clicks are raycast onto the curved glass and forwarded.
 */
(function () {
  const T = window.THREE;

  // device capability tier — lite gets lower DPR, baked-only shadows, fewer particles
  const QUALITY = (function () {
    const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    const cores = navigator.hardwareConcurrency || 4;
    const lite = mobile || cores <= 4;
    return lite
      ? { name: 'lite', dpr: 1.25, shadows: false, shadowMapSize: 1024, motes: 0,  steamCount: 24 }
      : { name: 'high', dpr: 1.75, shadows: true,  shadowMapSize: 1024, motes: 60, steamCount: 60 };
  })();

  // scene-wide IBL dim — r128 has no global env intensity, so every material
  // (including async-loaded GLBs) must apply this individually
  const ENV_DIM = 0.25;
  function dimMaterials(root) {
    root.traverse(function (o) {
      if (o.isMesh && o.material && o.material.isMeshStandardMaterial) {
        o.material.envMapIntensity = ENV_DIM; o.material.needsUpdate = true;
      }
    });
  }

  // frame-governor activity tracking — module scope so both the animate loop
  // (init) and top-level GLB swap-in callbacks (buildKeyboard)
  // can call bumpActivity() when a deferred model finishes loading.
  let lastFrameT = 0, lastActivityT = performance.now();
  function bumpActivity() { lastActivityT = performance.now(); }

  // screen placement is derived from the model below; bulge = dome depth
  let SCREEN = { x: 0, y: 7.5, z: 0, w: 6.0, h: 4.5 };
  let BULGE = 0.24;
  const TEX_W = 1024, TEX_H = 768;

  const MOODS = {
    room:     { bg: 'radial-gradient(120% 95% at 50% 20%, #f1e6d3 0%, #dcc8a8 60%, #c6af8b 100%)', hemi: 0.2, key: 0.26, fill: 0.14, rim: 0.24, shadow: 0.3 },
    peach:    { bg: 'radial-gradient(120% 95% at 50% 18%, #ffe9cf 0%, #f6cda0 58%, #e9b988 100%)', hemi: 0.22, key: 0.28, fill: 0.15, rim: 0.28, shadow: 0.26 },
    spotlight:{ bg: 'radial-gradient(95% 80% at 50% 30%, #2a2622 0%, #141210 70%, #0a0908 100%)', hemi: 0.18, key: 0.8, fill: 0.16, rim: 0.85, shadow: 0.42 },
    white:    { bg: 'radial-gradient(120% 95% at 50% 16%, #ffffff 0%, #eef0f2 60%, #dfe3e7 100%)', hemi: 0.78, key: 0.48, fill: 0.55, rim: 0.4, shadow: 0.2 }
  };

  let scene, camera, glRenderer, controls, lights = {}, shadowMat, groundMesh, texLoader;
  let machine, screenMesh, screenTex, texCanvas, texCtx, screenEl, raycaster;
  let mood = 'peach', autoRotate = false, ready = false, loadMgr = null;
  let refreshQueued = false, refreshing = false;
  let inScreenView = false;
  let zoomTarget = 0;   // desired camera→target distance; we glide toward it each frame
  let flyIn = null;     // active fly-into-the-screen animation state
  const ENTER_DIST = 24;   // scrolling in past this distance triggers the fly-in

  // Swing the camera from wherever it is (any orbit angle) to a straight-on view
  // of the CRT, dollying in at the same time, then hand off to the fullscreen view.
  function startFlyIn() {
    if (flyIn || inScreenView) return;
    const off = camera.position.clone().sub(controls.target);
    const sph = new T.Spherical().setFromVector3(off);
    // shortest way around for the azimuth (avoid a >180° swing)
    let az = sph.theta;
    if (az > Math.PI) az -= Math.PI * 2;
    flyIn = {
      t0: performance.now(), dur: 1250,
      fromR: sph.radius, fromPol: sph.phi, fromAz: az,
      fromTx: controls.target.x, fromTy: controls.target.y, fromTz: controls.target.z,
      toR: 9.0, toPol: Math.PI / 2, toAz: 0,
      toTx: 0, toTy: SCREEN.y, toTz: 0
    };
    controls.enabled = false;
  }

  /* ---------- geometry helpers ---------- */
  function roundedRect(w, h, r) {
    const s = new T.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
    s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
    s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
    s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
    return s;
  }
  function roundedRectPath(w, h, r, cx, cy) {
    const p = new T.Path();
    const x = cx - w / 2, y = cy - h / 2;
    p.moveTo(x + r, y);
    p.lineTo(x + w - r, y); p.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
    p.lineTo(x + w, y + h - r); p.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
    p.lineTo(x + r, y + h); p.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
    p.lineTo(x, y + r); p.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
    return p;
  }
  // a flat panel (rounded silhouette) with rectangular holes punched through it,
  // extruded to `depth`. Holes reveal whatever sits behind -> genuine carved recess.
  function holedPlate(ow, oh, rr, holes, depth, mat) {
    const shape = roundedRect(ow, oh, rr);
    (holes || []).forEach(function (h) {
      shape.holes.push(roundedRectPath(h.w, h.h, h.r != null ? h.r : 0.12, h.x, h.y));
    });
    const geo = new T.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.07, bevelSegments: 2, steps: 1 });
    geo.center();
    const m = new T.Mesh(geo, mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  /* ---------- PBR texture loading ---------- */
  function loadTex(url, rx, ry, srgb) {
    if (!texLoader) texLoader = new T.TextureLoader(loadMgr || undefined);
    const t = texLoader.load(url);
    t.wrapS = t.wrapT = (rx === 1 && ry === 1) ? T.ClampToEdgeWrapping : T.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.anisotropy = 8;
    if (srgb) t.encoding = T.sRGBEncoding;
    return t;
  }
  function pbrMat(base, rx, ry, opts) {
    opts = opts || {};
    return new T.MeshStandardMaterial(Object.assign({
      map: loadTex(base + '_color.jpg', rx, ry, true),
      roughnessMap: loadTex(base + '_rough.jpg', rx, ry, false),
      normalMap: loadTex(base + '_normal.jpg', rx, ry, false),
      roughness: 1.0, metalness: 0.0
    }, opts));
  }

  /* ---------- wooden desk ---------- */
  function makeWood() {
    const W = 1024, H = 1024;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    const planks = 5, ph = H / planks;
    const cols = ['#6f4626', '#7c4f29', '#653f22', '#774a27', '#704825'];
    for (let p = 0; p < planks; p++) {
      const y0 = p * ph;
      x.fillStyle = cols[p % cols.length];
      x.fillRect(0, y0, W, ph);
      // long wavy grain lines
      for (let g = 0; g < 90; g++) {
        const gy = y0 + Math.random() * ph;
        const dark = Math.random() < 0.7;
        x.strokeStyle = dark
          ? 'rgba(' + (40 + Math.random() * 26 | 0) + ',' + (24 + Math.random() * 18 | 0) + ',12,' + (0.05 + Math.random() * 0.13) + ')'
          : 'rgba(' + (190 + Math.random() * 50 | 0) + ',' + (150 + Math.random() * 40 | 0) + ',110,' + (0.03 + Math.random() * 0.06) + ')';
        x.lineWidth = 0.5 + Math.random() * 1.6;
        const amp = 1.5 + Math.random() * 4, ph2 = Math.random() * 6.28;
        x.beginPath(); x.moveTo(0, gy);
        for (let xx = 0; xx <= W; xx += 26) x.lineTo(xx, gy + Math.sin(xx * 0.012 + ph2) * amp + (Math.random() - 0.5) * 1.6);
        x.stroke();
      }
      // occasional knot
      if (Math.random() < 0.6) {
        const kx = Math.random() * W, ky = y0 + ph * (0.3 + Math.random() * 0.4);
        for (let rr = 7; rr > 0; rr--) {
          x.strokeStyle = 'rgba(36,22,10,' + (0.05 + rr * 0.015) + ')';
          x.lineWidth = 1.2;
          x.beginPath(); x.ellipse(kx, ky, rr * 2.4, rr * 1.4, 0.4, 0, 6.28); x.stroke();
        }
      }
      // dark plank seam + top highlight
      x.fillStyle = 'rgba(18,11,5,0.6)'; x.fillRect(0, y0 + ph - 2, W, 3);
      x.fillStyle = 'rgba(255,222,176,0.05)'; x.fillRect(0, y0 + 1, W, 2);
    }
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping; t.encoding = T.sRGBEncoding; t.anisotropy = 8;
    return t;
  }

  // warm plaster wall texture: vertical tone gradient + mottle + fine speckle
  // (ceiling only now — walls use the AmbientCG PBR set; AO is overlay quads)
  function makePlaster(top, bottom) {
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
    const t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding; t.anisotropy = 8;
    return t;
  }

  // washed-oak floor planks — cooler + larger-scale than the desk wood so the
  // two surfaces read as different materials
  function makeFloorPlanks() {
    const S = 1024, c = document.createElement('canvas'); c.width = S; c.height = S;
    const x = c.getContext('2d');
    const planks = 6, ph = S / planks;
    const cols = ['#b3a28d', '#aa9a84', '#a29079', '#b8a893', '#ab9b86', '#a59480'];
    for (let p = 0; p < planks; p++) {
      const y0 = p * ph;
      x.fillStyle = cols[p % cols.length];
      x.fillRect(0, y0, S, ph);
      for (let g2 = 0; g2 < 60; g2++) {                 // long subtle grain
        const gy = y0 + Math.random() * ph;
        const dark = Math.random() < 0.6;
        x.strokeStyle = dark
          ? 'rgba(96,84,68,' + (0.04 + Math.random() * 0.08) + ')'
          : 'rgba(226,216,198,' + (0.03 + Math.random() * 0.05) + ')';
        x.lineWidth = 0.5 + Math.random() * 1.4;
        const amp = 1 + Math.random() * 3, ph2 = Math.random() * 6.28;
        x.beginPath(); x.moveTo(0, gy);
        for (let xx = 0; xx <= S; xx += 32) x.lineTo(xx, gy + Math.sin(xx * 0.01 + ph2) * amp);
        x.stroke();
      }
      x.fillStyle = 'rgba(60,50,40,0.5)'; x.fillRect(0, y0 + ph - 2, S, 2);   // seam
      x.fillStyle = 'rgba(236,228,212,0.05)'; x.fillRect(0, y0 + 1, S, 1);    // top catch-light
      // staggered butt joints
      const jx = ((p * 0.37) % 1) * S;
      x.fillStyle = 'rgba(60,50,40,0.45)'; x.fillRect(jx, y0, 2, ph);
    }
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(5, 5);
    t.encoding = T.sRGBEncoding; t.anisotropy = 8;
    return t;
  }

  // soft AO gradient quad — replaces canvas-baked wall AO so the tiled plaster stays clean
  let _aoGradTex = null;
  function aoGradTex() {
    if (_aoGradTex) return _aoGradTex;
    const c = document.createElement('canvas'); c.width = 64; c.height = 8;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.42)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 8);
    _aoGradTex = new T.CanvasTexture(c);
    return _aoGradTex;
  }
  function addAOStrip(w, h, px, py, pz, rotY, flip) {
    const m = new T.Mesh(new T.PlaneGeometry(w, h),
      new T.MeshBasicMaterial({ map: aoGradTex(), transparent: true, depthWrite: false }));
    m.position.set(px, py, pz); m.rotation.y = rotY;
    if (flip) m.scale.x = -1;
    m.renderOrder = 1;
    return m;
  }

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

  function buildDesk() {
    const topMat  = pbrMat('shared/assets/textures/wood', 1.6, 1.0);
    const sideMat = pbrMat('shared/assets/textures/wood', 2.2, 0.32);
    const legMat  = pbrMat('shared/assets/textures/wood', 0.4, 2.2);

    const desk = new T.Group();
    const TW = 36, TD = 21, TT = 1.0;        // tabletop width / depth / thickness (top surface at y=0)
    const legH = 13.5, legT = 1.6, inset = 1.6;
    const apronH = 1.7;
    const floorY = -(TT + legH);

    // tabletop — top face uses the plank texture, sides a stretched edge grain
    const top = new T.Mesh(new T.BoxGeometry(TW, TT, TD), [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);
    top.position.set(0, -TT / 2, 0);
    top.castShadow = true; top.receiveShadow = true; desk.add(top);

    // apron / skirt just under the top
    const apronY = -TT - apronH / 2 + 0.15;
    [TD / 2 - inset - legT / 2, -(TD / 2 - inset - legT / 2)].forEach(function (z) {
      const a = new T.Mesh(new T.BoxGeometry(TW - 2 * inset - legT, apronH, 0.55), legMat);
      a.position.set(0, apronY, z); a.castShadow = true; a.receiveShadow = true; desk.add(a);
    });
    [TW / 2 - inset - legT / 2, -(TW / 2 - inset - legT / 2)].forEach(function (xx) {
      const a = new T.Mesh(new T.BoxGeometry(0.55, apronH, TD - 2 * inset - legT), legMat);
      a.position.set(xx, apronY, 0); a.castShadow = true; a.receiveShadow = true; desk.add(a);
    });

    // four legs
    const lx = TW / 2 - inset - legT / 2, lz = TD / 2 - inset - legT / 2;
    [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]].forEach(function (p) {
      const leg = new T.Mesh(new T.BoxGeometry(legT, legH, legT), legMat);
      leg.position.set(p[0], -TT - legH / 2, p[1]);
      leg.castShadow = true; leg.receiveShadow = true; desk.add(leg);
    });

    scene.add(desk);
    // drop the invisible shadow-catcher to the floor under the legs
    if (groundMesh) groundMesh.position.y = floorY;
    return floorY;
  }

  function buildRoom(floorY) {
    const RX = 58, RZ = 52, RH = 50;
    const ceilY = floorY + RH;
    const room = new T.Group();

    // clean plaster from AmbientCG (CC0), warm-tinted; AO comes from overlay quads
    const wallMat = pbrMat('shared/assets/textures/plaster', 3, 1.5, {
      color: 0xe3d2b4, roughness: 0.94, normalScale: new T.Vector2(0.5, 0.5)
    });

    // floor: dedicated washed-oak plank texture so it reads distinct from the desk wood
    const floorMat = new T.MeshStandardMaterial({ map: makeFloorPlanks(), roughness: 0.92, metalness: 0 });
    const floor = new T.Mesh(new T.PlaneGeometry(RX * 2, RZ * 2), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, floorY, 0);
    floor.receiveShadow = true; room.add(floor);
    groundMesh = floor;

    const ceil = new T.Mesh(new T.PlaneGeometry(RX * 2, RZ * 2),
      new T.MeshStandardMaterial({ map: makePlaster('#f2e8d6', '#e6d8c0'), roughness: 0.95 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, ceilY, 0); room.add(ceil);

    [[0, -RZ, 0], [0, RZ, Math.PI], [-RX, 0, Math.PI / 2], [RX, 0, -Math.PI / 2]].forEach(function (p, i) {
      const w = new T.Mesh(new T.PlaneGeometry((i < 2 ? RX : RZ) * 2, RH), wallMat);
      w.position.set(p[0], floorY + RH / 2, p[1]); w.rotation.y = p[2];
      w.receiveShadow = true; room.add(w);
    });

    // vertical corner AO (back-left and back-right corners, both faces)
    const cw = 10;   // strip width the gradient fades across
    room.add(addAOStrip(cw, RH, -RX + cw / 2, floorY + RH / 2, -RZ + 0.15, 0, false));        // back wall, from left corner
    room.add(addAOStrip(cw, RH,  RX - cw / 2, floorY + RH / 2, -RZ + 0.15, 0, true));          // back wall, from right corner
    room.add(addAOStrip(cw, RH, -RX + 0.15, floorY + RH / 2, -RZ + cw / 2, Math.PI / 2, true)); // left wall, from back corner
    room.add(addAOStrip(cw, RH,  RX - 0.15, floorY + RH / 2, -RZ + cw / 2, -Math.PI / 2, false));// right wall, from back corner
    // floor-line AO along the base of each wall (rotate strip so gradient runs bottom->up)
    [[0, -RZ + 0.15, RX * 2, 0], [-RX + 0.15, 0, RZ * 2, Math.PI / 2], [RX - 0.15, 0, RZ * 2, -Math.PI / 2]].forEach(function (p) {
      const s = addAOStrip(6, p[2], 0, 0, 0, 0, false);
      s.geometry.rotateZ(Math.PI / 2);   // gradient now vertical (dark at bottom) — NOTE: spec said -PI/2,
      // but that maps the canvas' u=0 (dark) edge to local y=+3 (top), inverting the fade; +PI/2 puts
      // u=0 at local y=-3, which sits at world y=floorY (the floor line) once positioned below.
      s.position.set(p[0], floorY + 3, p[1]); s.rotation.y = p[3];
      room.add(s);
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

  /* ---------- skis leaning on the back wall ---------- */
  let skisGroup = null;
  const SKIS_URL = 'shared/assets/models/low-poly_freeride_skis.glb';   // committed locally (no remote/CORS dependency)
  function buildSkis(room) {
    if (!T.GLTFLoader) return;
    const loader = new T.GLTFLoader(loadMgr || undefined);
    loader.load(SKIS_URL, function (gltf) {
      // scale so the longest dimension (ski length) is ~26 world units, rotate
      // upright, center x/z and rest bottom on y=0
      const pivot = fitAndGround(gltf.scene, 26, true);
      // async GLB loads after init()'s dimMaterials(scene) pass — apply it here too
      dimMaterials(gltf.scene);

      // lean group: tilt the top toward the back wall (-z), rest base on floor
      const lean = new T.Group();
      lean.add(pivot);
      lean.rotation.x = -0.2;          // ~11.5° lean
      lean.rotation.y = 0.16;          // slight skew so the pair reads as two skis
      lean.position.set(-30, room.floorY, -(room.RZ) + 6.5);  // left side, just off the back wall
      scene.add(lean);
      skisGroup = lean;
      window.__skis = lean;
      renderNow();
    }, undefined, function (err) { console.warn('skis load failed', err); });
  }

  /* ---------- snowboard leaning on the back wall (procedural) ----------
     Built from primitives (like the Mac) so there's no model/CORS dependency.
     Length runs along local +Y; thickness along +Z; the front face (with the
     bindings) points +Z so it reads to the camera when leaned against the wall. */
  let snowboardGroup = null;
  function buildSnowboard(room) {
    const L = 24, Wd = 4.2, Th = 0.42;
    const board = new T.Group();

    // deck: rounded-ended board, extruded for real thickness
    const shape = roundedRect(Wd, L, Wd * 0.46);
    const deckGeo = new T.ExtrudeGeometry(shape, {
      depth: Th, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.08, bevelSegments: 2, steps: 1
    });
    deckGeo.center();
    const deckMat = new T.MeshStandardMaterial({ color: 0xcf5a2c, roughness: 0.4, metalness: 0.08 });
    const deck = new T.Mesh(deckGeo, deckMat);
    deck.castShadow = true; deck.receiveShadow = true;
    board.add(deck);

    // top-sheet graphic: a lighter centre stripe down the front face
    const stripe = new T.Mesh(
      new T.PlaneGeometry(Wd * 0.42, L * 0.84),
      new T.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.5 })
    );
    stripe.position.z = Th / 2 + 0.18; board.add(stripe);

    // two bindings (baseplate + highback) on the front face
    const bindMat = new T.MeshStandardMaterial({ color: 0x2c2c30, roughness: 0.6 });
    [-L * 0.18, L * 0.2].forEach(function (yy) {
      const base = new T.Mesh(new T.BoxGeometry(Wd * 0.74, Wd * 0.74, 0.5), bindMat);
      base.position.set(0, yy, Th / 2 + 0.25); base.castShadow = true; board.add(base);
      const hb = new T.Mesh(new T.BoxGeometry(Wd * 0.74, 0.95, 1.5), bindMat);
      hb.position.set(0, yy + Wd * 0.34, Th / 2 + 0.7); hb.castShadow = true; board.add(hb);
    });

    // raise so the base tip rests on the floor inside the lean pivot
    const pivot = new T.Group();
    board.position.y = L / 2; pivot.add(board);

    const lean = new T.Group();
    lean.add(pivot);
    lean.rotation.x = -0.18;        // tip leans back toward the wall
    lean.rotation.y = -0.1;         // slight skew
    lean.position.set(30, room.floorY, -(room.RZ) + 6.5);  // right side, mirrors the skis
    scene.add(lean);
    snowboardGroup = lean;
    window.__snowboard = lean;
    renderNow();
  }

  /* ---------- vintage mechanical keyboard (procedural) ----------
     Aged-beige wedge case + sculpted rows of individual keycaps, sat on the
     desk in front of the Macintosh, with a coiled cable running to the front
     port. Built to the same world scale / shadow conventions as the Mac. */
  let keyboardGroup = null;
  function buildKeyboard() {
    const g = new T.Group();

    const caseMat = new T.MeshStandardMaterial({ color: 0xe4d8b8, roughness: 0.72, metalness: 0.0 });
    const caseDk  = new T.MeshStandardMaterial({ color: 0xcdbf9a, roughness: 0.8 });
    const keyMat  = new T.MeshStandardMaterial({ color: 0xeee3c6, roughness: 0.55 });
    const modMat  = new T.MeshStandardMaterial({ color: 0xc9bc9a, roughness: 0.6 });
    const footMat = new T.MeshStandardMaterial({ color: 0x161513, roughness: 0.85 });

    // rows back(0) -> front(4); key widths in keyboard "units"; mod = darker caps
    const rows = [
      { w: [1,1,1,1,1,1,1,1,1,1,1,1,1,1], mod: [0] },
      { w: [1.5,1,1,1,1,1,1,1,1,1,1,1,1,1], mod: [0] },
      { w: [1.75,1,1,1,1,1,1,1,1,1,1,1,1.75], mod: [0,12] },
      { w: [2.25,1,1,1,1,1,1,1,1,1,1,2.25], mod: [0,11] },
      { w: [1.25,1.25,1.25,6.25,1.25,1.25,1.25,1.25], mod: [0,1,2,4,5,6,7] }
    ];

    const U = 0.5, KGAP = 0.07, RGAP = 0.07, capH = 0.36, caseH = 0.55, margin = 0.55;
    const fieldD = rows.length * U + (rows.length - 1) * RGAP;
    let maxRowW = 0;
    rows.forEach(function (r) {
      const rw = r.w.reduce(function (a, b) { return a + b; }, 0) * U + (r.w.length - 1) * KGAP;
      if (rw > maxRowW) maxRowW = rw;
    });
    const caseW = maxRowW + margin * 2, caseD = fieldD + margin * 2;

    // rounded slab case
    const caseGeo = new T.ExtrudeGeometry(roundedRect(caseW, caseD, 0.45),
      { depth: caseH, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.12, bevelSegments: 3, steps: 1 });
    caseGeo.center();
    const kase = new T.Mesh(caseGeo, caseMat);
    kase.rotation.x = -Math.PI / 2; kase.position.y = caseH / 2;
    kase.castShadow = true; kase.receiveShadow = true; g.add(kase);

    // recessed darker top plate the keys poke through
    const plate = new T.Mesh(new T.BoxGeometry(maxRowW + 0.22, 0.08, fieldD + 0.22), caseDk);
    plate.position.y = caseH - 0.02; plate.receiveShadow = true; g.add(plate);

    // shared keycap geometry (rounded, dished top from the bevel)
    const capGeo = new T.ExtrudeGeometry(roundedRect(1, 1, 0.30),
      { depth: capH, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 2, steps: 1 });
    capGeo.center(); capGeo.rotateX(-Math.PI / 2);   // stand the cap upright

    const capBaseY = caseH - 0.05 + capH / 2;
    rows.forEach(function (row, ri) {
      const rowW = row.w.reduce(function (a, b) { return a + b; }, 0) * U + (row.w.length - 1) * KGAP;
      let x = -rowW / 2;
      const z = -fieldD / 2 + U / 2 + ri * (U + RGAP);
      row.w.forEach(function (wU, ki) {
        const kw = wU * U, cx = x + kw / 2;
        const isMod = row.mod && row.mod.indexOf(ki) !== -1;
        const cap = new T.Mesh(capGeo, isMod ? modMat : keyMat);
        cap.scale.set(kw - 0.12, 1, U - 0.12);
        cap.position.set(cx, capBaseY, z);
        cap.rotation.x = (ri - (rows.length - 1) / 2) * 0.018;   // gentle sculpt
        cap.castShadow = true; cap.receiveShadow = true; g.add(cap);
        x += kw + KGAP;
      });
    });

    // rubber feet
    [[-caseW/2+0.6,-caseD/2+0.6],[caseW/2-0.6,-caseD/2+0.6],[-caseW/2+0.6,caseD/2-0.6],[caseW/2-0.6,caseD/2-0.6]]
      .forEach(function (p) {
        const f = new T.Mesh(new T.CylinderGeometry(0.22, 0.24, 0.16, 16), footMat);
        f.position.set(p[0], 0.06, p[1]); g.add(f);
      });

    // place on the desk, square in front of the Macintosh
    g.position.set(0, 0, 7.4);
    scene.add(g);
    keyboardGroup = g;
    addContactShadow(scene, caseW + 2, caseD + 2, 0, 7.4, 0.3);

    // coiled cable from the back of the keyboard up to the Mac's front port
    const startW = new T.Vector3(0, caseH * 0.7, -caseD / 2).add(g.position);
    const end = new T.Vector3(0, 1.0, 4.55);
    const curve = new T.CatmullRomCurve3([
      startW,
      new T.Vector3(0.25, 0.4, startW.z - 0.7),
      new T.Vector3(-0.35, 0.5, (startW.z + end.z) / 2),
      new T.Vector3(0.12, 0.8, end.z + 0.7),
      end
    ]);
    const cable = new T.Mesh(new T.TubeGeometry(curve, 44, 0.09, 10, false),
      new T.MeshStandardMaterial({ color: 0xddd2b4, roughness: 0.6 }));
    cable.castShadow = true; scene.add(cable);

    renderNow();

    // swap in the high-fidelity model once the scene is interactive
    whenInteractive(function () {
      loadDeferredGLB('shared/assets/models/mechanical_keyboard.glb', function (gltf) {
        const inner = gltf.scene;
        // orientation correction (tuned visually): inner.rotation.y = 0;
        const kb = fitAndGround(inner, caseW, false);   // match procedural footprint width
        kb.position.set(0, 0, 7.4);

        // PBR touch-up: single-palette material reads a bit glossy under our env
        dimMaterials(inner);

        scene.add(kb);
        scene.remove(g);            // retire procedural keyboard (keep the cable + contact shadow)
        keyboardGroup = kb;
        bumpActivity(); renderNow();
      });
    });
  }

  /* ---------- blue metal anglepoise desk lamp (procedural) ----------
     Weighted round base, two jointed arms with parallel springs, and an open
     conical shade aimed at the work area in front of the Mac. A warm point
     light eases on after load so the lamp reads as switched on. */
  let lampGroup = null, lampLight = null;
  function buildLamp() {
    const g = new T.Group();
    const blue   = new T.MeshStandardMaterial({ color: 0x2f6cb6, metalness: 0.55, roughness: 0.34 });
    const blueDk = new T.MeshStandardMaterial({ color: 0x224f86, metalness: 0.6, roughness: 0.3 });
    const shadeIn= new T.MeshStandardMaterial({ color: 0xf3ede0, roughness: 0.5, side: T.DoubleSide, emissive: 0xffe7b8, emissiveIntensity: 0.5 });
    const bulbMat= new T.MeshStandardMaterial({ color: 0xfff6dc, emissive: 0xffd98a, emissiveIntensity: 1.7 });
    const spring = new T.MeshStandardMaterial({ color: 0x9fb4cc, metalness: 0.8, roughness: 0.3 });

    function rod(p1, p2, radius, mat) {
      const a = new T.Vector3().fromArray(p1), b = new T.Vector3().fromArray(p2);
      const dir = new T.Vector3().subVectors(b, a), len = dir.length();
      const m = new T.Mesh(new T.CylinderGeometry(radius, radius, len, 18), mat);
      m.position.copy(a).addScaledVector(dir, 0.5);
      m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.clone().normalize());
      m.castShadow = true; m.receiveShadow = true; return m;
    }
    function joint(p, r) {
      const m = new T.Mesh(new T.SphereGeometry(r, 20, 16), blueDk);
      m.position.fromArray(p); m.castShadow = true; return m;
    }
    function springRod(p1, p2, off) {
      const a = new T.Vector3().fromArray(p1), b = new T.Vector3().fromArray(p2);
      const dir = new T.Vector3().subVectors(b, a).normalize();
      const perp = new T.Vector3(dir.y, -dir.x, 0).normalize().multiplyScalar(off);
      g.add(rod([a.x + perp.x, a.y + perp.y, a.z], [b.x + perp.x, b.y + perp.y, b.z], 0.05, spring));
    }

    // joints — local -x reaches toward the Macintosh
    const shoulder = [0, 1.5, 0], elbow = [-1.5, 5.4, 0], wrist = [-4.6, 6.9, 0];

    // weighted round base + low dome
    const base = new T.Mesh(new T.CylinderGeometry(1.7, 1.95, 0.5, 44), blue);
    base.position.y = 0.25; base.castShadow = true; base.receiveShadow = true; g.add(base);
    const dome = new T.Mesh(new T.SphereGeometry(1.55, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2), blue);
    dome.position.y = 0.48; dome.scale.y = 0.4; dome.castShadow = true; g.add(dome);

    g.add(rod([0, 0.5, 0], shoulder, 0.28, blue));
    g.add(joint(shoulder, 0.42));
    g.add(rod(shoulder, elbow, 0.17, blue)); g.add(joint(elbow, 0.4));
    g.add(rod(elbow, wrist, 0.17, blue));   g.add(joint(wrist, 0.36));
    springRod(shoulder, elbow, 0.34);
    springRod(elbow, wrist, 0.3);

    // conical shade aimed at the desk in front of the Mac
    const w = new T.Vector3().fromArray(wrist);
    const target = new T.Vector3(-6.5, 0, 6.0);
    const dir = new T.Vector3().subVectors(target, w).normalize();
    const head = new T.Group();
    head.add(new T.Mesh(new T.CylinderGeometry(0.28, 1.25, 1.7, 36, 1, true), blue));
    head.add(new T.Mesh(new T.CylinderGeometry(0.26, 1.2, 1.62, 36, 1, true), shadeIn));
    const cap = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 0.16, 24), blueDk);
    cap.position.y = 0.85; head.add(cap);
    const bulb = new T.Mesh(new T.SphereGeometry(0.34, 20, 16), bulbMat);
    bulb.position.y = 0.42; head.add(bulb);
    const glow = addGlowSprite(3.2, 0xffd9a0, 0.55); glow.position.copy(bulb.position); head.add(glow);
    lampLight = new T.SpotLight(0xffc98a, 0.0, 55, 0.75, 0.6, 1.3);  // warm ~2800K
    lampLight.position.y = 0.3;
    lampLight.castShadow = QUALITY.shadows;
    lampLight.shadow.mapSize.set(QUALITY.shadowMapSize, QUALITY.shadowMapSize);
    lampLight.shadow.bias = -0.0004; lampLight.shadow.radius = 5;
    lampLight.shadow.camera.near = 1; lampLight.shadow.camera.far = 60;
    head.add(lampLight);
    head.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    // top (small end) sits at the wrist; mouth opens toward the target
    head.position.copy(w).addScaledVector(dir, 0.85);
    head.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.clone().negate());
    g.add(head);

    // spotlight target: local to the lamp group so it tracks MacScene.setLamp moves;
    // resolves to world ≈ (1.5, 0, 5.5) — the desk area between keyboard and Mac
    const spotTarget = new T.Object3D();
    spotTarget.position.set(-6.33, 0, 9.76);
    g.add(spotTarget);
    lampLight.target = spotTarget;

    // place on the desk to the right of the Mac, angled toward the work area
    g.position.set(13.8, 0, -2.5); g.rotation.y = -0.35;
    scene.add(g);
    lampGroup = g;
    addContactShadow(scene, 5.5, 5.5, 13.8, -2.5, 0.3);

    // ease the warm light on
    let li = 0; const liMax = 15;
    const ramp = setInterval(function () {
      li += 0.5; lampLight.intensity = Math.min(liMax, li); renderNow();
      if (li >= liMax) clearInterval(ramp);
    }, 40);

    renderNow();
  }

  function bulbWorldPos() {
    const v = new T.Vector3();
    if (lampLight) lampLight.getWorldPosition(v);
    return v;
  }

  /* ---------- procedural glazed coffee mug + looping steam ---------- */
  let mugGroup = null;
  function buildMug() {
    const g = new T.Group();
    // envMapIntensity set scene-wide via dimMaterials()
    const glaze = new T.MeshStandardMaterial({ color: 0xb84a3a, roughness: 0.25, metalness: 0.0 });
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
      new T.MeshStandardMaterial({ color: 0x2a1608, roughness: 0.15, metalness: 0.0 }));
    coffee.rotation.x = -Math.PI / 2; coffee.position.y = 1.95; g.add(coffee);
    g.position.set(6.8, 0, 8.2);          // right of keyboard, off the fly-in path (x=0)
    scene.add(g); mugGroup = g;
    addContactShadow(scene, 2.6, 2.6, 6.8, 8.2, 0.3);
    buildSteam(g);
    renderNow();
  }

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
        '  vA = smoothstep(0.0, 0.15, t) * (1.0 - smoothstep(0.55, 1.0, t)) * 0.10;',
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
    steamPts.frustumCulled = false; // origin-bbox geometry; displacement is in the vertex shader
    mug.add(steamPts);
  }

  /* ---------- procedural bonsai plant + glazed pot ---------- */
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

  window.__updateIdleFX = function (now) {
    if (steamMat) steamMat.uniforms.uTime.value = now / 1000;
    if (bonsaiFoliage && QUALITY.name === 'high') bonsaiFoliage.rotation.z = Math.sin(now / 2600) * 0.008;
    // (Task 10 adds motes here)
  };

  /* ---------- procedural Macintosh (carved-recess construction) ---------- */
  function buildMac() {
    machine = new T.Group();
    const grimeTex = makeGrime();
    const beige   = new T.MeshStandardMaterial({ map: grimeTex, color: 0xf1e6c6, roughness: 0.9, metalness: 0.0 });
    const beigeDk = new T.MeshStandardMaterial({ map: grimeTex, color: 0xdccfab, roughness: 0.92 });
    const cavityMat = new T.MeshStandardMaterial({ map: grimeTex.clone(), color: 0xc4b890, roughness: 0.96 }); // shadowed interior
    const dark   = new T.MeshStandardMaterial({ color: 0x131110, roughness: 0.6 });
    const darker = new T.MeshStandardMaterial({ color: 0x0b0a09, roughness: 0.5, metalness: 0.2 });
    const metal  = new T.MeshStandardMaterial({ color: 0xb6ab8e, roughness: 0.5, metalness: 0.4 });

    // ---- master dimensions ----
    const W = 8.6, H = 11.2, D = 9.2, r = 0.75;
    const baseH = 1.0;
    const Tf = 1.05, Tr = 0.9, Tt = 1.1;        // front / rear / top plate thickness = recess depth
    const y0 = baseH;                            // shell bottom (sits on plinth)
    const topY = baseH + H;                      // shell top
    const faceZ = D / 2, backZ = -D / 2;
    const plateCY = y0 + H / 2;                  // centre Y of full-height front/rear plates

    // ===== inset CORE: smaller than the shell on front / top / rear so the
    //       capping plates' holes reveal its recessed surfaces =====
    const coreDepth = D - Tf - Tr;
    const coreGeo = new T.ExtrudeGeometry(roundedRect(W, H - Tt, r),
      { depth: coreDepth, bevelEnabled: false, steps: 1 });
    coreGeo.center();
    const core = new T.Mesh(coreGeo, beige);
    core.position.set(0, y0 + (H - Tt) / 2, (Tr - Tf) / 2);
    core.castShadow = true; core.receiveShadow = true;
    machine.add(core);
    const coreFrontZ = faceZ - Tf;               // screen-cavity floor
    const coreTopY   = topY - Tt;                // top-cavity floor
    const coreBackZ  = backZ + Tr;               // rear-cavity floor

    /* ===================== FRONT (carved CRT opening + slots) ===================== */
    const SCRX = 0, SCRY = y0 + H * 0.625;       // screen centre
    const SCRW = 6.3, SCRH = 4.75;               // CRT opening
    const frontPlate = holedPlate(W, H, r, [
      { x: SCRX, y: SCRY - plateCY, w: SCRW, h: SCRH, r: 0.8 },             // CRT opening
      { x: 0.35, y: (y0 + 2.7) - plateCY, w: 3.4, h: 0.36, r: 0.16 },      // floppy slot
      { x: 1.0,  y: (y0 + 1.55) - plateCY, w: 0.66, h: 0.66, r: 0.1 }      // small square port
    ], Tf, beige);
    frontPlate.position.set(0, plateCY, faceZ - Tf / 2);
    machine.add(frontPlate);

    // dark backings sitting on the recessed core face (seen THROUGH the openings)
    const crtBack = new T.Mesh(new T.PlaneGeometry(SCRW, SCRH), dark);
    crtBack.position.set(SCRX, SCRY, coreFrontZ + 0.02); machine.add(crtBack);
    const flopBack = new T.Mesh(new T.BoxGeometry(3.4, 0.36, 0.4), dark);
    flopBack.position.set(0.35, y0 + 2.7, coreFrontZ + 0.3); machine.add(flopBack);
    const portBack = new T.Mesh(new T.BoxGeometry(0.66, 0.66, 0.4), darker);
    portBack.position.set(1.0, y0 + 1.55, coreFrontZ + 0.3); machine.add(portBack);

    // protruding rounded bezel lip around the screen
    const bezelShape = roundedRect(SCRW + 0.7, SCRH + 0.7, 1.0);
    bezelShape.holes.push(roundedRectPath(SCRW, SCRH, 0.8, 0, 0));
    const bezel = new T.Mesh(new T.ExtrudeGeometry(bezelShape, { depth: 0.34, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.14, bevelSegments: 3, steps: 1 }), beige);
    bezel.geometry.center();
    bezel.position.set(SCRX, SCRY, faceZ - 0.05);
    bezel.castShadow = true; machine.add(bezel);

    // SCREEN (curved live surface) seated INSIDE the CRT cavity
    SCREEN = { x: SCRX, y: SCRY, w: SCRW - 0.5, h: SCRH - 0.5, z: coreFrontZ + 0.16 };

    // chin decals + small front parts  (faceZ+0.14 clears the bevel-inflated plate face)
    const FPZ = faceZ + 0.14;
    const apple = new T.Mesh(new T.PlaneGeometry(1.08, 1.15), new T.MeshBasicMaterial({ map: logoTexture(), transparent: true }));
    apple.position.set(-3.05, y0 + 3.6, FPZ); machine.add(apple);
    const eject = new T.Mesh(new T.BoxGeometry(0.16, 0.46, 0.14), beigeDk);
    eject.position.set(2.25, y0 + 2.7, FPZ); machine.add(eject);
    const dial = new T.Mesh(new T.CylinderGeometry(0.26, 0.26, 0.2, 24), beigeDk);
    dial.rotation.x = Math.PI / 2; dial.position.set(-3.1, y0 + 1.5, FPZ); machine.add(dial);
    const dialNub = new T.Mesh(new T.BoxGeometry(0.07, 0.34, 0.12), dark);
    dialNub.position.set(-3.1, y0 + 1.5, FPZ + 0.08); machine.add(dialNub);

    const screwGeo = new T.CylinderGeometry(0.15, 0.15, 0.16, 6);

    /* ===================== TOP (carved handle cavity + 2 vent fields) ===================== */
    const tHoles = [{ x: 0, y: 0, w: 3.4, h: 1.9, r: 0.45 }];      // central handle cavity
    for (let f = -1; f <= 1; f += 2) {
      for (let i = 0; i < 10; i++) tHoles.push({ x: f * 2.45 + (i - 4.5) * 0.18, y: 0, w: 0.12, h: 3.4, r: 0.05 });
    }
    const topPlate = holedPlate(W, D, r, tHoles, Tt, beige);
    topPlate.rotation.x = -Math.PI / 2;
    topPlate.position.set(0, topY - Tt / 2, 0);
    machine.add(topPlate);
    // dark grille backing beneath each vent field; lighter floor in the handle well
    for (let f = -1; f <= 1; f += 2) {
      const vb = new T.Mesh(new T.BoxGeometry(1.9, 0.12, 3.4), dark);
      vb.position.set(f * 2.45, coreTopY + 0.04, 0); machine.add(vb);
    }
    const handleFloor = new T.Mesh(new T.BoxGeometry(3.4, 0.1, 1.9), cavityMat);
    handleFloor.position.set(0, coreTopY + 0.03, 0); machine.add(handleFloor);
    [[-3.7, 3.4], [3.7, 3.4]].forEach(function (p) {
      const s = new T.Mesh(screwGeo, metal); s.position.set(p[0], topY + 0.08, p[1]); machine.add(s);
    });

    /* ===================== REAR (carved label / power / port recesses) ===================== */
    const rearPlate = holedPlate(W, H, r, [
      { x: 0,    y: (topY - 1.5) - plateCY, w: 3.6, h: 1.0, r: 0.45 },     // handle recess
      { x: -0.6, y: (y0 + 5.6) - plateCY,  w: 3.9, h: 3.0, r: 0.2 },       // label recess
      { x: 2.7,  y: (y0 + 5.4) - plateCY,  w: 1.9, h: 5.9, r: 0.25 },      // power panel
      { x: -0.3, y: (y0 + 1.55) - plateCY, w: 6.6, h: 1.0, r: 0.15 }       // port strip
    ], Tr, beige);
    rearPlate.position.set(0, plateCY, backZ + Tr / 2);
    machine.add(rearPlate);

    function rearBack(x, y, w, h, mat) {
      const m = new T.Mesh(new T.PlaneGeometry(w, h), mat || dark);
      m.position.set(x, y, coreBackZ - 0.02); m.rotation.y = Math.PI; machine.add(m); return m;
    }
    rearBack(0, topY - 1.5, 3.6, 1.0, cavityMat);                          // handle interior
    const label = new T.Mesh(new T.PlaneGeometry(3.7, 2.85),
      new T.MeshStandardMaterial({ map: makeTexture(drawTechLabel, 520, 420), roughness: 0.7, metalness: 0.1, color: 0xffffff }));
    label.position.set(-0.6, y0 + 5.6, coreBackZ - 0.02); label.rotation.y = Math.PI; machine.add(label);
    rearBack(2.7, y0 + 5.4, 1.9, 5.9, cavityMat);                         // power panel interior
    const pSwitch = new T.Mesh(new T.BoxGeometry(0.52, 1.0, 0.3), beigeDk);
    pSwitch.position.set(2.7, y0 + 7.3, coreBackZ - 0.18); machine.add(pSwitch);
    const warn = new T.Mesh(new T.PlaneGeometry(0.6, 0.6), new T.MeshBasicMaterial({ map: makeTexture(drawWarning, 128, 128), transparent: true }));
    warn.position.set(2.7, y0 + 5.7, coreBackZ - 0.05); warn.rotation.y = Math.PI; machine.add(warn);
    const iec = new T.Mesh(new T.BoxGeometry(1.0, 0.78, 0.3), darker);
    iec.position.set(2.7, y0 + 3.6, coreBackZ - 0.16); machine.add(iec);
    [-0.24, 0, 0.24].forEach(function (dx) {
      const c = new T.Mesh(new T.BoxGeometry(0.09, 0.24, 0.16), metal);
      c.position.set(2.7 + dx, y0 + 3.6, coreBackZ - 0.3); machine.add(c);
    });
    rearBack(-0.3, y0 + 1.55, 6.6, 1.0, darker);                         // port strip interior
    let px = -3.4;
    [0.7, 1.7, 0.7, 1.15].forEach(function (w) {
      const po = new T.Mesh(new T.BoxGeometry(w, 0.52, 0.26), darker);
      po.position.set(px + w / 2, y0 + 1.55, coreBackZ - 0.18); machine.add(po);
      px += w + 0.55;
    });
    const rApple = new T.Mesh(new T.PlaneGeometry(0.9, 0.96), new T.MeshBasicMaterial({ map: logoTexture(), transparent: true }));
    rApple.position.set(-2.95, topY - 1.5, backZ - 0.14); rApple.rotation.y = Math.PI; machine.add(rApple);
    [[-3.8, topY - 0.7], [3.8, topY - 0.7], [-3.8, y0 + 0.7], [3.8, y0 + 0.7]].forEach(function (p) {
      const s = new T.Mesh(screwGeo, metal); s.rotation.x = Math.PI / 2; s.position.set(p[0], p[1], backZ - 0.16); machine.add(s);
    });

    /* ===================== SIDES (vent slits) ===================== */
    [-1, 1].forEach(function (side) {
      for (let i = 0; i < 7; i++) {
        const v = new T.Mesh(new T.BoxGeometry(0.18, 0.1, 2.0), dark);
        v.position.set(side * (W / 2 - 0.02), y0 + 1.4 + i * 0.32, backZ + 2.0); machine.add(v);
      }
    });

    /* ===================== BASE / UNDERCUT ===================== */
    // narrow plinth under the shell -> the shell overhang reads as a carved undercut
    const plinthGeo = new T.ExtrudeGeometry(roundedRect(W - 1.4, D - 1.4, 0.5),
      { depth: baseH, bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.18, bevelSegments: 3, steps: 1 });
    plinthGeo.center();
    const plinth = new T.Mesh(plinthGeo, beigeDk);
    plinth.rotation.x = -Math.PI / 2; plinth.position.set(0, baseH / 2, 0);
    plinth.castShadow = true; plinth.receiveShadow = true; machine.add(plinth);
    // dark shadow band in the undercut gap, just beneath the shell
    const band = new T.Mesh(new T.BoxGeometry(W - 0.5, 0.24, D - 0.5), dark);
    band.position.set(0, baseH + 0.0, 0); machine.add(band);
    // rubber feet
    const rubber = new T.MeshStandardMaterial({ color: 0x161616, roughness: 0.85 });
    [[-2.9, 2.9], [2.9, 2.9], [-2.9, -2.9], [2.9, -2.9]].forEach(function (p) {
      const f = new T.Mesh(new T.CylinderGeometry(0.4, 0.42, 0.22, 20), rubber);
      f.position.set(p[0], 0.11, p[1]); f.castShadow = true; machine.add(f);
    });

    addContactShadow(scene, 12, 12, 0, 0, 0.32);
    scene.add(machine);
    buildCurvedScreen();
  }

  /* ---------- canvas-texture helpers ---------- */
  function makeGrime() {
    const S = 1024, c = document.createElement('canvas'); c.width = S; c.height = S;
    const x = c.getContext('2d');
    x.fillStyle = '#e7dab3'; x.fillRect(0, 0, S, S);              // yellowed base
    for (let i = 0; i < 22; i++) {                               // soft aging blotches
      const r = 60 + Math.random() * 200, gx = Math.random() * S, gy = Math.random() * S;
      const g = x.createRadialGradient(gx, gy, 0, gx, gy, r);
      const dk = Math.random() < 0.55;
      g.addColorStop(0, dk ? 'rgba(150,134,92,' + (0.02 + Math.random() * 0.03) + ')' : 'rgba(255,248,224,' + (0.02 + Math.random() * 0.03) + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, S, S);
    }
    for (let i = 0; i < 2600; i++) {                            // fine dirt speckle
      x.fillStyle = 'rgba(' + (90 + Math.random() * 60 | 0) + ',' + (80 + Math.random() * 50 | 0) + ',' + (50 + Math.random() * 40 | 0) + ',' + (0.03 + Math.random() * 0.08) + ')';
      const s = 0.5 + Math.random() * 1.5;
      x.fillRect(Math.random() * S, Math.random() * S, s, s);
    }
    for (let i = 0; i < 36; i++) {                              // scuffs / scratches
      x.strokeStyle = (Math.random() < 0.5 ? 'rgba(120,108,76,' : 'rgba(255,250,228,') + (0.05 + Math.random() * 0.08) + ')';
      x.lineWidth = 0.5 + Math.random();
      x.beginPath(); const sx = Math.random() * S, sy = Math.random() * S;
      x.moveTo(sx, sy); x.lineTo(sx + (Math.random() - 0.5) * 220, sy + (Math.random() - 0.5) * 70); x.stroke();
    }
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding;
    t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(0.5, 0.4); t.anisotropy = 8;
    return t;
  }
  function makeTexture(draw, w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8; return t;
  }
  let _logoTex = null;
  function logoTexture() {
    if (!_logoTex) _logoTex = makeTexture(drawApple, 256, 280);   // classic rainbow apple
    return _logoTex;
  }
  function drawApple(x, W, H) {
    x.clearRect(0, 0, W, H);
    const cx = W / 2;
    const apple = new Path2D();
    apple.moveTo(cx, 78);
    apple.bezierCurveTo(cx - 12, 60, cx - 34, 46, cx - 64, 60);
    apple.bezierCurveTo(cx - 122, 86, cx - 112, 184, cx - 60, 218);
    apple.bezierCurveTo(cx - 34, 238, cx - 14, 226, cx, 222);
    apple.bezierCurveTo(cx + 14, 226, cx + 34, 238, cx + 60, 218);
    apple.bezierCurveTo(cx + 112, 184, cx + 122, 86, cx + 64, 60);
    apple.bezierCurveTo(cx + 34, 46, cx + 12, 60, cx, 78);
    apple.closePath();
    x.save(); x.clip(apple);
    const cols = ['#6cbe45', '#f7b500', '#f08000', '#e2342b', '#8e2f8f', '#3a8dde'];
    const bh = H / 6;
    cols.forEach(function (co, i) { x.fillStyle = co; x.fillRect(0, i * bh, W, bh + 1); });
    x.restore();
    // bite
    x.globalCompositeOperation = 'destination-out';
    x.beginPath(); x.arc(cx + 66, 128, 34, 0, 7); x.fill();
    x.globalCompositeOperation = 'source-over';
    // leaf
    x.fillStyle = '#6cbe45';
    x.beginPath(); x.ellipse(cx + 7, 50, 15, 26, -0.6, 0, 7); x.fill();
  }
  function drawLabel(x, W, H, text) {
    x.clearRect(0, 0, W, H);
    x.fillStyle = '#403a30';
    x.font = 'italic 78px Garamond, "Apple Garamond", "Times New Roman", serif';
    x.textBaseline = 'middle'; x.textAlign = 'left';
    x.fillText(text, 6, H / 2 + 4);
  }
  function drawTechLabel(x, W, H) {
    // recessed gray/purple regulatory plate with unreadable micro-text
    x.fillStyle = '#5b5560'; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(0, 0, W, 6); x.fillRect(0, H - 6, W, 6);
    x.fillStyle = '#cfc8d2';
    x.font = 'bold 22px Helvetica, Arial, sans-serif';
    x.fillText('Personal Computer', 22, 34);
    // micro text rows
    for (let r = 0; r < 13; r++) {
      const y = 58 + r * 16;
      const rows = 3 + Math.floor(Math.random() * 4);
      let lx = 22;
      for (let i = 0; i < rows; i++) {
        const w = 30 + Math.random() * 90;
        x.fillStyle = 'rgba(210,205,216,' + (0.5 + Math.random() * 0.4) + ')';
        x.fillRect(lx, y, w, 5);
        lx += w + 12;
        if (lx > W - 150) break;
      }
    }
    // barcode block
    let bx = W - 150;
    for (let i = 0; i < 46; i++) {
      x.fillStyle = Math.random() < 0.5 ? '#1c1a20' : '#d6d0da';
      const bw = 1 + Math.random() * 3;
      x.fillRect(bx, H - 90, bw, 54); bx += bw;
      if (bx > W - 24) break;
    }
    // certification squares
    [22, 70, 118].forEach(function (sx) {
      x.strokeStyle = '#c8c2cc'; x.lineWidth = 2;
      x.strokeRect(sx, H - 46, 34, 30);
    });
  }
  function drawWarning(x, W, H) {
    x.clearRect(0, 0, W, H);
    x.beginPath();
    x.moveTo(W / 2, 12); x.lineTo(W - 12, H - 16); x.lineTo(12, H - 16); x.closePath();
    x.fillStyle = '#e9c200'; x.fill();
    x.lineWidth = 8; x.strokeStyle = '#15130c'; x.stroke();
    x.fillStyle = '#15130c';
    x.font = 'bold 64px Helvetica, Arial, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('⚡', W / 2, H / 2 + 6);
  }

  /* ---------- curved live screen ---------- */
  function buildCurvedScreen() {
    texCanvas = document.createElement('canvas'); texCanvas.width = TEX_W; texCanvas.height = TEX_H;
    texCtx = texCanvas.getContext('2d');
    texCtx.clearRect(0, 0, TEX_W, TEX_H);
    screenTex = new T.CanvasTexture(texCanvas);
    screenTex.encoding = T.sRGBEncoding; screenTex.anisotropy = 8; screenTex.minFilter = T.LinearFilter;

    const geo = new T.PlaneGeometry(SCREEN.w, SCREEN.h, 64, 48);
    const pos = geo.attributes.position, hw = SCREEN.w / 2, hh = SCREEN.h / 2;
    for (let i = 0; i < pos.count; i++) {
      const nx = pos.getX(i) / hw, ny = pos.getY(i) / hh;
      const r = Math.min(1, Math.sqrt(nx * nx + ny * ny));
      pos.setZ(i, BULGE * 0.5 * (1 + Math.cos(Math.PI * r)));   // smooth raised-cosine dome (gentle rim)
    }
    geo.computeVertexNormals();
    screenMesh = new T.Mesh(geo, new T.MeshBasicMaterial({ map: screenTex, toneMapped: false, transparent: true }));
    screenMesh.position.set(SCREEN.x, SCREEN.y, SCREEN.z);
    machine.add(screenMesh);
    window.__tex = texCanvas; window.__mesh = screenMesh;

    const sGlow = addGlowSprite(7.5, 0xbfd8ff, 0.18);
    sGlow.position.set(SCREEN.x, SCREEN.y, SCREEN.z + 1.2); machine.add(sGlow);
  }

  function refreshTexture() {
    if (document.hidden) return;
    if (!window.htmlToImage || !screenEl) return;
    if (inScreenView) return;
    if (refreshing) { refreshQueued = true; return; }
    refreshing = true;
    window.htmlToImage.toCanvas(screenEl, { pixelRatio: TEX_W / screenEl.offsetWidth, backgroundColor: '#000', cacheBust: false })
      .then(function (c) {
        texCtx.filter = 'none';
        texCtx.clearRect(0, 0, TEX_W, TEX_H);
        texCtx.save();
        texCtx.beginPath();
        if (texCtx.roundRect) texCtx.roundRect(0, 0, TEX_W, TEX_H, 110); else texCtx.rect(0, 0, TEX_W, TEX_H);
        texCtx.clip();
        texCtx.filter = 'blur(0.6px)';          // low-pass the 1px dither -> smooth gray, kills moiré
        texCtx.drawImage(c, 0, 0, TEX_W, TEX_H);
        texCtx.restore();
        texCtx.filter = 'none';
        screenTex.needsUpdate = true; refreshing = false;
        if (refreshQueued) { refreshQueued = false; setTimeout(refreshTexture, 30); }
      }).catch(function () { refreshing = false; });
  }
  function burstRefresh() { [0, 140, 360, 700].forEach(function (d) { setTimeout(refreshTexture, d); }); }

  function forwardClick(e) {
    if (!screenMesh || !screenEl) return;
    const rect = glRenderer.domElement.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera({ x: nx, y: ny }, camera);
    const hit = raycaster.intersectObject(screenMesh)[0];
    if (!hit || !hit.uv) return;
    const r = screenEl.getBoundingClientRect();
    const cx = r.left + hit.uv.x * screenEl.offsetWidth;
    const cy = r.top + (1 - hit.uv.y) * screenEl.offsetHeight;
    const target = document.elementsFromPoint(cx, cy).find(function (n) { return screenEl.contains(n); });
    if (!target) return;
    ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach(function (type) {
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: cx, clientY: cy, view: window }));
    });
    target.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, view: window }));
    burstRefresh();
  }

  function init() {
    scene = new T.Scene();
    raycaster = new T.Raycaster();
    screenEl = document.getElementById('screen');

    camera = new T.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 1000);
    // start front-on, pulled back to show the desk/room/skis. y matches the CRT
    // screen centre (SCRY = 8.0) so the screen sits dead-centre in the view.
    camera.position.set(0, 8.0, 30);

    glRenderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    glRenderer.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY.dpr));
    glRenderer.setSize(window.innerWidth, window.innerHeight);
    glRenderer.outputEncoding = T.sRGBEncoding;
    glRenderer.toneMapping = T.ACESFilmicToneMapping;
    glRenderer.toneMappingExposure = 1.05;
    glRenderer.shadowMap.enabled = QUALITY.shadows; glRenderer.shadowMap.type = T.PCFSoftShadowMap;
    glRenderer.domElement.id = 'gl';
    document.body.appendChild(glRenderer.domElement);

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

    lights.hemi = new T.HemisphereLight(0xffe9d2, 0x6e5f4d, 0.2); scene.add(lights.hemi);
    // soft cool "window" fill — NO shadow (lamp is the sole real-time caster)
    lights.key = new T.DirectionalLight(0xfff2df, 0.26);
    lights.key.position.set(-14, 18, 12); scene.add(lights.key);
    lights.fill = new T.DirectionalLight(0xffffff, 0.14); lights.fill.position.set(12, 8, 9); scene.add(lights.fill);
    // subtle cool rim from behind to separate props from the back wall
    lights.rim = new T.DirectionalLight(0xd6e4ff, 0.24); lights.rim.position.set(3, 11, -16); scene.add(lights.rim);

    shadowMat = new T.ShadowMaterial({ opacity: 0.26 });
    // (the room floor, built below, receives the shadow)

    controls = new T.OrbitControls(camera, glRenderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.07; controls.enablePan = true;
    controls.target.set(0, 8.0, 0);   // CRT screen centre — keeps it dead-centre
    controls.minDistance = 8; controls.maxDistance = 42;
    // lock vertical orbit so the camera stays inside the room (no going under the
    // floor / "underground", and not up through the ceiling) at any zoom level
    controls.minPolarAngle = Math.PI * 0.27;   // can't rise above the scene
    controls.maxPolarAngle = Math.PI * 0.52;   // can't drop below ~eye level (no underground)
    controls.update();
    controls.addEventListener('change', bumpActivity);              // orbit / damping settle
    glRenderer.domElement.addEventListener('pointerdown', bumpActivity);

    // Smooth "scroll to enter": OrbitControls' built-in wheel zoom is stepped and
    // jumpy. Disable it and drive a single damped distance ourselves, so the wheel
    // sets a target distance and the camera glides toward it (see animate()).
    controls.enableZoom = false;
    zoomTarget = camera.position.distanceTo(controls.target);
    glRenderer.domElement.addEventListener('wheel', function (e) {
      if (inScreenView || flyIn) return;
      e.preventDefault();
      bumpActivity();
      // multiplicative so each notch feels even at any distance; gentle factor
      zoomTarget *= Math.exp(e.deltaY * 0.0012);
      zoomTarget = Math.max(controls.minDistance, Math.min(controls.maxDistance, zoomTarget));
      // a small scroll-in is enough: swing the camera around to face the screen
      // head-on and glide into it (see the flyIn block in animate()).
      if (e.deltaY < 0 && zoomTarget < ENTER_DIST) startFlyIn();
    }, { passive: false });

    applyMood('room');
    window.addEventListener('resize', onResize);

    // Track every async asset (PBR textures, skis model, logo) through one manager
    // so the boot terminal only clears once the WHOLE scene has finished loading.
    loadMgr = new T.LoadingManager();
    const bootStatus = document.getElementById('boot-status');
    const bootBar = document.getElementById('boot-bar-term');
    function setBoot(loaded, total) {
      if (bootStatus) bootStatus.textContent = 'Loading assets ... ' + loaded + '/' + total;
      if (bootBar) {
        const n = total ? Math.round((loaded / total) * 22) : 0;
        bootBar.textContent = '[' + '█'.repeat(n) + '·'.repeat(22 - n) + ']';
      }
    }
    setBoot(0, 8);
    loadMgr.onProgress = function (url, loaded, total) { setBoot(loaded, total); };
    loadMgr.onError = function () { /* a failed asset must not hang the boot; onLoad still fires */ };
    loadMgr.onLoad = function () {
      if (bootStatus) bootStatus.textContent = 'Ready.';
      if (bootBar) bootBar.textContent = '[' + '█'.repeat(22) + ']';
      window.__sceneLoaded = true;
    };

    buildMac();
    const floorY = buildDesk();
    const room = buildRoom(floorY);
    buildSkis(room);
    buildSnowboard(room);
    buildKeyboard();
    buildLamp();
    buildMug();
    buildBonsai();

    // dim IBL ambient so the lamp reads as the key light (r128 has no global env intensity)
    dimMaterials(scene);

    ready = true;
    window.__dbg = function () { return { ready: ready, f: window.__frames }; };
    burstRefresh();
    setInterval(refreshTexture, 1500);

    if (screenEl) {
      new MutationObserver(function () { setTimeout(refreshTexture, 50); })
        .observe(screenEl, { childList: true, subtree: true, attributes: true, characterData: true });
    }
    glRenderer.domElement.addEventListener('click', forwardClick);
    controls._userActive = false;
    glRenderer.domElement.addEventListener('pointerdown', () => controls._userActive = true);
    // zoom-in-to-fullscreen: press Esc to leave
    window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && inScreenView) exitScreenView(); });

    // ---- frame governor: cap active fps, drop lower when idle, rely on rAF's
    // built-in pause when the tab is hidden. Idle animations (steam, motes)
    // stay alive at the idle rate; all animation is driven by real time.
    const FPS_ACTIVE = 45, FPS_IDLE = 24, IDLE_AFTER_MS = 3000;
    lastFrameT = 0; lastActivityT = performance.now();

    window.__frames = 0;
    (function animate(now) {
      requestAnimationFrame(animate);
      now = now || performance.now();
      const active = flyIn || (now - lastActivityT < IDLE_AFTER_MS);
      const budget = 1000 / (active ? FPS_ACTIVE : FPS_IDLE);
      if (now - lastFrameT < budget - 0.75) return;   // skip frame
      lastFrameT = now;
      window.__frames++;
      if (autoRotate && !controls._userActive) machine.rotation.y += 0.0022;
      if (flyIn && !inScreenView) {
        // fly-in: ease the orbit angles to straight-on while dollying toward the CRT
        const t = Math.min(1, (performance.now() - flyIn.t0) / flyIn.dur);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;  // easeInOutCubic
        controls.target.set(
          flyIn.fromTx + (flyIn.toTx - flyIn.fromTx) * e,
          flyIn.fromTy + (flyIn.toTy - flyIn.fromTy) * e,
          flyIn.fromTz + (flyIn.toTz - flyIn.fromTz) * e
        );
        const sph = new T.Spherical(
          flyIn.fromR + (flyIn.toR - flyIn.fromR) * e,
          flyIn.fromPol + (flyIn.toPol - flyIn.fromPol) * e,
          flyIn.fromAz + (flyIn.toAz - flyIn.fromAz) * e
        );
        camera.position.setFromSpherical(sph).add(controls.target);
        camera.lookAt(controls.target);
        if (t >= 1) { flyIn = null; zoomTarget = 9.0; enterScreenView(); }
      } else if (!inScreenView && ready) {
        // glide the camera toward the wheel-set target distance for a smooth approach
        const offset = camera.position.clone().sub(controls.target);
        const curDist = offset.length();
        if (Math.abs(zoomTarget - curDist) > 0.0008) {
          const nd = curDist + (zoomTarget - curDist) * 0.12;
          camera.position.copy(controls.target).add(offset.multiplyScalar(nd / curDist));
          bumpActivity();
        }
      }
      controls.update();
      if (window.__updateIdleFX) window.__updateIdleFX(now);  // steam/motes/sway hook (later tasks)
      glRenderer.render(scene, camera);
    })();
  }

  function renderNow() { controls && controls.update(); glRenderer && glRenderer.render(scene, camera); }
  function applyMood(name) {
    mood = name; const m = MOODS[name] || MOODS.peach;
    document.body.style.background = m.bg;
    lights.hemi.intensity = m.hemi; lights.key.intensity = m.key;
    lights.fill.intensity = m.fill; lights.rim.intensity = m.rim;
    shadowMat.opacity = m.shadow; renderNow();
  }
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    glRenderer.setSize(window.innerWidth, window.innerHeight); renderNow();
    layoutHost();
  }

  /* ---------- dolly-in fullscreen screen view ---------- */
  function layoutHost() {
    if (!inScreenView) return;
    const host = document.getElementById('screen-host');
    const vw = window.innerWidth, vh = window.innerHeight;
    const s = Math.min(vw / 640, vh / 469);
    const tx = (vw - 640 * s) / 2, ty = (vh - 469 * s) / 2;
    host.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')';
  }
  // Where the 3D Macintosh screen currently sits on screen, in CSS pixels.
  // Used to start the fullscreen handoff exactly on the 3D screen so it reads
  // as one continuous zoom rather than a cut to a flat panel.
  function screenRectPx() {
    if (!screenMesh || !camera || !glRenderer) return null;
    const box = new T.Box3().setFromObject(screenMesh);
    const w = glRenderer.domElement.clientWidth, h = glRenderer.domElement.clientHeight;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let xi = 0; xi < 2; xi++) for (let yi = 0; yi < 2; yi++) for (let zi = 0; zi < 2; zi++) {
      const v = new T.Vector3(xi ? box.max.x : box.min.x, yi ? box.max.y : box.min.y, zi ? box.max.z : box.min.z).project(camera);
      const sx = (v.x * 0.5 + 0.5) * w, sy = (-v.y * 0.5 + 0.5) * h;
      if (sx < minX) minX = sx; if (sx > maxX) maxX = sx;
      if (sy < minY) minY = sy; if (sy > maxY) maxY = sy;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  function exitHint(show) {
    // hint chip intentionally disabled — scroll out / Esc / click still exit
    const h = document.getElementById('sv-hint');
    if (h) h.remove();
  }
  function enterScreenView() {
    if (inScreenView) return; inScreenView = true;
    const host = document.getElementById('screen-host');
    controls.enabled = false;
    let bd = document.getElementById('sv-backdrop');
    if (!bd) { bd = document.createElement('div'); bd.id = 'sv-backdrop'; bd.style.cssText = 'position:fixed;inset:0;background:#000;z-index:40;opacity:0;pointer-events:none;transition:opacity .45s'; document.body.appendChild(bd); }
    bd.style.display = 'block';
    requestAnimationFrame(function () { bd.style.opacity = '1'; });

    host.style.transformOrigin = 'top left';
    host.style.zIndex = '45'; host.style.pointerEvents = 'auto'; host.style.background = '#000';

    // Start the live screen pinned to the 3D screen's current on-screen rect,
    // then animate it out to fill the viewport — continuous zoom, no jump-cut.
    const r = screenRectPx();
    if (r && r.w > 0) {
      host.style.transition = 'none';
      host.style.opacity = '1';
      host.style.transform = 'translate(' + r.x + 'px,' + r.y + 'px) scale(' + (r.w / 640) + ')';
      host.getBoundingClientRect();   // flush the start state before transitioning
    } else {
      host.style.opacity = '1';
    }
    requestAnimationFrame(function () {
      host.style.transition = 'transform .6s cubic-bezier(.33,0,.25,1), opacity .3s';
      layoutHost();   // final: centered, fills the viewport
    });

    // fade the room out behind the growing screen (slightly slower so it stays
    // visible underneath until the screen has nearly filled the view)
    glRenderer.domElement.style.transition = 'opacity .5s'; glRenderer.domElement.style.opacity = '0';
    document.querySelectorAll('#hud,#title').forEach(function (e) { e.style.transition = 'opacity .3s'; e.style.opacity = '0'; });
    exitHint(true);
    clearTimeout(window.__svT);
    window.__svT = setTimeout(function () { if (inScreenView) glRenderer.domElement.style.display = 'none'; }, 640);
  }
  function exitScreenView() {
    if (!inScreenView) return; inScreenView = false;
    const host = document.getElementById('screen-host');
    glRenderer.domElement.style.display = 'block';
    requestAnimationFrame(function () { glRenderer.domElement.style.opacity = '1'; });
    // keep pointer-events 'auto' (initial state) so forwardClick's elementsFromPoint
    // hit-test keeps working after exiting screen view; the #gl canvas sits above it.
    host.style.transform = ''; host.style.opacity = '0'; host.style.pointerEvents = 'auto'; host.style.zIndex = '0';
    const bd = document.getElementById('sv-backdrop'); if (bd) { bd.style.opacity = '0'; clearTimeout(window.__svBd); window.__svBd = setTimeout(function () { if (!inScreenView) bd.style.display = 'none'; }, 460); }
    document.querySelectorAll('#hud,#title').forEach(function (e) { e.style.opacity = ''; });
    exitHint(false);
    // pull the camera back so we don't immediately re-trigger
    const dir = camera.position.clone().sub(controls.target).normalize();
    camera.position.copy(controls.target).add(dir.multiplyScalar(15));
    zoomTarget = 15;   // keep the smooth-dolly target in sync with the pull-back
    controls.enabled = true; controls.update(); renderNow();
    refreshTexture();
  }
  function applyTweaks(t) { if (!scene) return; if (t.mood) applyMood(t.mood); autoRotate = !!t.autoRotate; renderNow(); }
  function rebuildScreen() { if (screenMesh) { machine.remove(screenMesh); screenMesh.geometry.dispose(); } buildCurvedScreen(); refreshTexture(); renderNow(); }

  window.MacScene = {
    init, applyTweaks, applyMood, renderNow, refresh: refreshTexture,
    enterScreenView, exitScreenView,
    getQuality: function () { return QUALITY; },
    setSkis: function (p) { if (!skisGroup) return; if (p.x != null) skisGroup.position.x = p.x; if (p.z != null) skisGroup.position.z = p.z; if (p.lean != null) skisGroup.rotation.x = p.lean; if (p.skew != null) skisGroup.rotation.y = p.skew; renderNow(); return skisGroup.position; },
    setSnowboard: function (p) { if (!snowboardGroup) return; if (p.x != null) snowboardGroup.position.x = p.x; if (p.z != null) snowboardGroup.position.z = p.z; if (p.lean != null) snowboardGroup.rotation.x = p.lean; if (p.skew != null) snowboardGroup.rotation.y = p.skew; renderNow(); return snowboardGroup.position; },
    setKeyboard: function (p) { if (!keyboardGroup) return; if (p.x != null) keyboardGroup.position.x = p.x; if (p.z != null) keyboardGroup.position.z = p.z; if (p.rot != null) keyboardGroup.rotation.y = p.rot; renderNow(); return keyboardGroup.position; },
    setLamp: function (p) { if (!lampGroup) return; if (p.x != null) lampGroup.position.x = p.x; if (p.z != null) lampGroup.position.z = p.z; if (p.rot != null) lampGroup.rotation.y = p.rot; if (p.light != null && lampLight) lampLight.intensity = p.light; renderNow(); return lampGroup.position; },
    setMug: function (p) { if (!mugGroup) return; if (p.x != null) mugGroup.position.x = p.x; if (p.z != null) mugGroup.position.z = p.z; renderNow(); return mugGroup.position; },
    setBonsai: function (p) { if (!bonsaiGroup) return; if (p.x != null) bonsaiGroup.position.x = p.x; if (p.z != null) bonsaiGroup.position.z = p.z; renderNow(); return bonsaiGroup.position; },
    setBulge: function (b) { BULGE = b; rebuildScreen(); return BULGE; },
    setScreen: function (p) { Object.assign(SCREEN, p); rebuildScreen(); return SCREEN; },
    debugAzimuth: function (deg, elevDeg, dist) {
      const t = controls.target, r = camera.position.clone().sub(t), rad = dist || r.length();
      const a = deg * Math.PI / 180, e = (elevDeg == null ? 18 : elevDeg) * Math.PI / 180;
      camera.position.set(t.x + Math.sin(a) * Math.cos(e) * rad, t.y + Math.sin(e) * rad, t.z + Math.cos(a) * Math.cos(e) * rad);
      renderNow();
    }
  };
})();
