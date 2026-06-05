/* mac-scene.js
 * Procedural classic compact Macintosh (built from scratch) + soft studio
 * lighting + OrbitControls. The user's live site is rendered onto a CURVED
 * screen mesh (centre bulges toward the viewer) that is seated exactly into
 * the modelled bezel recess. html-to-image rasterises the live #screen DOM
 * to the texture; clicks are raycast onto the curved glass and forwarded.
 */
(function () {
  const T = window.THREE;

  // screen placement is derived from the model below; bulge = dome depth
  let SCREEN = { x: 0, y: 7.5, z: 0, w: 6.0, h: 4.5 };
  let BULGE = 0.24;
  const TEX_W = 1024, TEX_H = 768;

  const MOODS = {
    room:     { bg: 'radial-gradient(120% 95% at 50% 20%, #c9c8c4 0%, #a7a6a2 60%, #8e8d89 100%)', hemi: 0.55, key: 1.05, fill: 0.4, rim: 0.4, shadow: 0.32 },
    peach:    { bg: 'radial-gradient(120% 95% at 50% 18%, #ffe9cf 0%, #f6cda0 58%, #e9b988 100%)', hemi: 0.6, key: 1.15, fill: 0.42, rim: 0.55, shadow: 0.26 },
    spotlight:{ bg: 'radial-gradient(95% 80% at 50% 30%, #2a2622 0%, #141210 70%, #0a0908 100%)', hemi: 0.18, key: 1.7, fill: 0.16, rim: 0.85, shadow: 0.42 },
    white:    { bg: 'radial-gradient(120% 95% at 50% 16%, #ffffff 0%, #eef0f2 60%, #dfe3e7 100%)', hemi: 0.78, key: 1.0, fill: 0.55, rim: 0.4, shadow: 0.2 }
  };

  let scene, camera, glRenderer, controls, lights = {}, shadowMat, groundMesh, texLoader;
  let machine, screenMesh, screenTex, texCanvas, texCtx, screenEl, raycaster;
  let mood = 'peach', autoRotate = false, ready = false, loadMgr = null;
  let refreshQueued = false, refreshing = false;
  let inScreenView = false;
  let zoomTarget = 0;   // desired camera→target distance; we glide toward it each frame

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

  function buildDesk() {
    const topMat  = pbrMat('textures/wood', 1.6, 1.0);
    const sideMat = pbrMat('textures/wood', 2.2, 0.32);
    const legMat  = pbrMat('textures/wood', 0.4, 2.2);

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

  /* ---------- concrete room ---------- */
  function makeConcrete() {
    const S = 1024, c = document.createElement('canvas'); c.width = S; c.height = S;
    const x = c.getContext('2d');
    x.fillStyle = '#adaca7'; x.fillRect(0, 0, S, S);
    // soft mottled blotches (patchy plaster)
    for (let i = 0; i < 70; i++) {
      const r = 80 + Math.random() * 280, gx = Math.random() * S, gy = Math.random() * S;
      const g = x.createRadialGradient(gx, gy, 0, gx, gy, r);
      const dk = Math.random() < 0.5;
      g.addColorStop(0, dk ? 'rgba(118,116,112,' + (0.04 + Math.random() * 0.08) + ')' : 'rgba(214,213,208,' + (0.04 + Math.random() * 0.08) + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, S, S);
    }
    // fine aggregate speckle
    for (let i = 0; i < 11000; i++) {
      const v = 92 + Math.random() * 116 | 0;
      x.fillStyle = 'rgba(' + v + ',' + v + ',' + (v - 5) + ',' + (0.04 + Math.random() * 0.1) + ')';
      x.fillRect(Math.random() * S, Math.random() * S, 1, 1);
    }
    // a few hairline cracks
    for (let i = 0; i < 6; i++) {
      x.strokeStyle = 'rgba(68,66,62,' + (0.1 + Math.random() * 0.12) + ')';
      x.lineWidth = 0.5 + Math.random();
      let px = Math.random() * S, py = Math.random() * S;
      x.beginPath(); x.moveTo(px, py);
      const seg = 8 + Math.random() * 14;
      for (let s = 0; s < seg; s++) { px += (Math.random() - 0.5) * 130; py += (Math.random() - 0.3) * 130; x.lineTo(px, py); }
      x.stroke();
    }
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping; t.encoding = T.sRGBEncoding; t.anisotropy = 8;
    return t;
  }

  function buildRoom(floorY) {
    const RX = 58, RZ = 52, RH = 50;          // half-width, half-depth, height
    const ceilY = floorY + RH;
    // one concrete texture stretched per surface (no tiling, per request)
    function cMat(tint) {
      return pbrMat('textures/concrete', 1, 1, { color: tint || 0xffffff, side: T.DoubleSide });
    }
    const room = new T.Group();

    // floor (also catches the desk/computer shadow)
    const floor = new T.Mesh(new T.PlaneGeometry(RX * 2, RZ * 2), cMat(0x9f9e9a));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, floorY, 0);
    floor.receiveShadow = true; room.add(floor);
    groundMesh = floor;

    // ceiling
    const ceil = new T.Mesh(new T.PlaneGeometry(RX * 2, RZ * 2), cMat(0xbab9b4));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, ceilY, 0); room.add(ceil);

    // four walls (one texture each)
    const back = new T.Mesh(new T.PlaneGeometry(RX * 2, RH), cMat(0xb2b1ac));
    back.position.set(0, floorY + RH / 2, -RZ); room.add(back);

    const front = new T.Mesh(new T.PlaneGeometry(RX * 2, RH), cMat(0xaaa9a4));
    front.position.set(0, floorY + RH / 2, RZ); front.rotation.y = Math.PI; room.add(front);

    const left = new T.Mesh(new T.PlaneGeometry(RZ * 2, RH), cMat(0xafaea9));
    left.position.set(-RX, floorY + RH / 2, 0); left.rotation.y = Math.PI / 2; room.add(left);

    const right = new T.Mesh(new T.PlaneGeometry(RZ * 2, RH), cMat(0xafaea9));
    right.position.set(RX, floorY + RH / 2, 0); right.rotation.y = -Math.PI / 2; room.add(right);

    scene.add(room);
    return { RX: RX, RZ: RZ, RH: RH, floorY: floorY };
  }

  /* ---------- skis leaning on the back wall ---------- */
  let skisGroup = null;
  const SKIS_URL = 'low-poly_freeride_skis.glb';   // committed locally (no remote/CORS dependency)
  function buildSkis(room) {
    if (!T.GLTFLoader) return;
    const loader = new T.GLTFLoader(loadMgr || undefined);
    loader.load(SKIS_URL, function (gltf) {
      const inner = gltf.scene;
      // scale so the longest dimension (ski length) is ~26 world units
      let box = new T.Box3().setFromObject(inner);
      let size = box.getSize(new T.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      inner.scale.setScalar(26 / maxDim);

      // re-evaluate axes; rotate the longest one to vertical (Y)
      box = new T.Box3().setFromObject(inner); size = box.getSize(new T.Vector3());
      if (size.x >= size.y && size.x >= size.z) inner.rotation.z = Math.PI / 2;      // long axis X -> Y
      else if (size.z >= size.y && size.z >= size.x) inner.rotation.x = -Math.PI / 2; // long axis Z -> Y

      // center on x/z and drop bottom to y=0 inside a pivot
      const pivot = new T.Group();
      pivot.add(inner);
      let pb = new T.Box3().setFromObject(pivot);
      const pc = pb.getCenter(new T.Vector3());
      inner.position.x -= pc.x; inner.position.z -= pc.z; inner.position.y -= pb.min.y;

      inner.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

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
    if (!_logoTex) { _logoTex = new T.TextureLoader(loadMgr || undefined).load('front-logo.png'); _logoTex.encoding = T.sRGBEncoding; _logoTex.anisotropy = 8; }
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
  }

  function refreshTexture() {
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
    // start front-on and centered, pulled back to show the desk/room/skis
    camera.position.set(0, 7.6, 30);

    glRenderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    glRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    glRenderer.setSize(window.innerWidth, window.innerHeight);
    glRenderer.outputEncoding = T.sRGBEncoding;
    glRenderer.toneMapping = T.ACESFilmicToneMapping;
    glRenderer.toneMappingExposure = 1.05;
    glRenderer.shadowMap.enabled = true; glRenderer.shadowMap.type = T.PCFSoftShadowMap;
    glRenderer.domElement.id = 'gl';
    document.body.appendChild(glRenderer.domElement);

    lights.hemi = new T.HemisphereLight(0xfff2e2, 0x8a7a66, 0.6); scene.add(lights.hemi);
    lights.key = new T.DirectionalLight(0xffffff, 1.15);
    lights.key.position.set(-9, 16, 13); lights.key.castShadow = true;
    lights.key.shadow.mapSize.set(2048, 2048); lights.key.shadow.radius = 7; lights.key.shadow.bias = -0.0004;
    const sc = lights.key.shadow.camera; sc.left = -24; sc.right = 24; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 80;
    scene.add(lights.key);
    lights.fill = new T.DirectionalLight(0xffffff, 0.42); lights.fill.position.set(12, 8, 9); scene.add(lights.fill);
    lights.rim = new T.DirectionalLight(0xffffff, 0.55); lights.rim.position.set(2, 9, -14); scene.add(lights.rim);

    shadowMat = new T.ShadowMaterial({ opacity: 0.26 });
    // (the concrete room floor, built below, receives the shadow)

    controls = new T.OrbitControls(camera, glRenderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.07; controls.enablePan = true;
    controls.target.set(0, 6.4, 0);
    controls.minDistance = 8; controls.maxDistance = 42;
    // lock vertical orbit so the camera stays inside the room (no going under the
    // floor / "underground", and not up through the ceiling) at any zoom level
    controls.minPolarAngle = Math.PI * 0.27;   // can't rise above the scene
    controls.maxPolarAngle = Math.PI * 0.52;   // can't drop below ~eye level (no underground)
    controls.update();

    // Smooth "scroll to enter": OrbitControls' built-in wheel zoom is stepped and
    // jumpy. Disable it and drive a single damped distance ourselves, so the wheel
    // sets a target distance and the camera glides toward it (see animate()).
    controls.enableZoom = false;
    zoomTarget = camera.position.distanceTo(controls.target);
    glRenderer.domElement.addEventListener('wheel', function (e) {
      if (inScreenView) return;
      e.preventDefault();
      // multiplicative so each notch feels even at any distance; gentle factor
      zoomTarget *= Math.exp(e.deltaY * 0.0012);
      zoomTarget = Math.max(controls.minDistance, Math.min(controls.maxDistance, zoomTarget));
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

    window.__frames = 0;
    (function animate() {
      requestAnimationFrame(animate);
      window.__frames++;
      if (autoRotate && !controls._userActive) machine.rotation.y += 0.0022;
      if (!inScreenView && ready) {
        // glide the camera toward the wheel-set target distance for a smooth approach
        const offset = camera.position.clone().sub(controls.target);
        const curDist = offset.length();
        if (Math.abs(zoomTarget - curDist) > 0.0008) {
          const nd = curDist + (zoomTarget - curDist) * 0.12;
          camera.position.copy(controls.target).add(offset.multiplyScalar(nd / curDist));
        }
      }
      controls.update();
      if (!inScreenView && ready) {
        const dist = camera.position.distanceTo(controls.target);
        const az = Math.abs(controls.getAzimuthalAngle());
        const pol = controls.getPolarAngle();
        if (dist < 9.3 && az < 0.42 && pol > 1.05 && pol < 1.78) enterScreenView();
      }
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
    glRenderer.domElement.style.transition = 'opacity .4s'; glRenderer.domElement.style.opacity = '0';
    host.style.transition = 'transform .5s cubic-bezier(.4,0,.2,1), opacity .35s';
    host.style.transformOrigin = 'top left';
    host.style.zIndex = '45'; host.style.opacity = '1'; host.style.pointerEvents = 'auto'; host.style.background = '#000';
    layoutHost();
    document.querySelectorAll('#hud,#title').forEach(function (e) { e.style.transition = 'opacity .3s'; e.style.opacity = '0'; });
    exitHint(true);
    clearTimeout(window.__svT);
    window.__svT = setTimeout(function () { if (inScreenView) glRenderer.domElement.style.display = 'none'; }, 450);
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
    setSkis: function (p) { if (!skisGroup) return; if (p.x != null) skisGroup.position.x = p.x; if (p.z != null) skisGroup.position.z = p.z; if (p.lean != null) skisGroup.rotation.x = p.lean; if (p.skew != null) skisGroup.rotation.y = p.skew; renderNow(); return skisGroup.position; },
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
