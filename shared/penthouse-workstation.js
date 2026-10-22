/* LM-7 workstation: Leon's desk terminal, keyboard and mouse. Three.js r128.
 * A second-hand 2070s terminal: yellowed ABS bezel over a gunmetal CRT body with
 * heatsink fins, a bolted-on uplink module with antenna, a KUJIRA data card in
 * the slot, asset and high-voltage stickers. JIS 65% mechanical keyboard in an
 * anodised wedge case (two-tone caps, kana sub-legends, worn home keys, amber
 * OLED strip, knurled knob), coiled sleeve cable on an aviator plug. Matching
 * mouse with lit scroll wheel. All units metres, Y-up, front faces +Z.
 *
 * Mesh names keep the room's hotspot prefixes: COMPUTER_*, KEYBOARD_*, MOUSE_*,
 * and the live display is a curved mesh named SCREEN_SURFACE (glTF-style UVs,
 * so a CanvasTexture with flipY=false maps upright, as penthouse-scene.js does).
 *
 * API
 *   const ws = PenthouseWorkstation.create(THREE, {anisotropy, screenMaterial})
 *   ws.group, ws.computer, ws.keyboard, ws.mouse, ws.screen, ws.update(t), ws.rebuildCables(), ws.getStats(), ws.dispose()
 *   PenthouseWorkstation.replaceIn(THREE, roomModel, ws)  // removes old COMPUTER_/KEYBOARD_/MOUSE_/SCREEN_SURFACE
 *       meshes, drops the new parts on their footprints (model-local metres), rebuilds cables. Call before the
 *       room traversal so hotspots and the screen material are applied to the new meshes. */
(function () {
  'use strict';
  function rnd(seed) { let s = seed >>> 0 || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }

  function create(T, options = {}) {
    const group = new T.Group(); group.name = 'LM-7 workstation';
    const geoms = [], mats = [], texs = [], leds = [];
    let disposed = false;
    const G = g => (geoms.push(g), g), M = m => (mats.push(m), m), X = t => (texs.push(t), t);
    const aniso = options.anisotropy || 8, R = rnd(7741);
    const lin = c => new T.Color(c).convertSRGBToLinear();

    // ---------- canvas textures ----------
    function cv(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
    function tx(c, srgb, wrap) { const t = new T.CanvasTexture(c); if (srgb) t.encoding = T.sRGBEncoding; t.anisotropy = aniso; if (wrap) t.wrapS = t.wrapT = T.RepeatWrapping; return X(t); }
    function blobs(x, n, colors, rMin, rMax, aMin, aMax, w, h) {
      for (let i = 0; i < n; i++) { const r = rMin + R() * (rMax - rMin); const g = x.createRadialGradient(0, 0, 0, 0, 0, r); const c = colors[Math.floor(R() * colors.length)];
        g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)'); x.save(); x.translate(R() * w, R() * h); x.scale(1, .4 + R() * .9); x.globalAlpha = aMin + R() * (aMax - aMin); x.fillStyle = g; x.fillRect(-r, -r, 2 * r, 2 * r); x.restore(); }
      x.globalAlpha = 1;
    }
    function scratches(x, n, color, len, alpha, w, h, horizontal) {
      x.strokeStyle = color; for (let i = 0; i < n; i++) { const px = R() * w, py = R() * h, a = horizontal ? (R() - .5) * .06 : R() * Math.PI, l = len * (.3 + R());
        x.globalAlpha = alpha * (.3 + R() * .7); x.lineWidth = .6 + R() * 1.2; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
      x.globalAlpha = 1;
    }
    const absColor = tx(cv(1024, 1024, (x, w, h) => {
      // Sun-yellowed ABS: low-contrast mottling, fine speckle, faint handling marks.
      x.fillStyle = '#d6cfbc'; x.fillRect(0, 0, w, h);
      blobs(x, 420, ['#cbbf9c', '#d9d3c4', '#c8c0aa'], 40, 220, .03, .08, w, h);
      blobs(x, 60, ['#a8a090'], 10, 40, .03, .07, w, h);
      for (let i = 0; i < 3200; i++) { x.globalAlpha = .05 + R() * .12; x.fillStyle = R() < .7 ? '#8a8476' : '#eee9dc'; x.fillRect(R() * w, R() * h, 1 + R() * 1.2, 1 + R() * 1.2); }
      scratches(x, 90, '#ece7da', 12, .22, w, h); scratches(x, 40, '#9a9384', 8, .18, w, h); x.globalAlpha = 1;
    }), true, true);
    const absRough = tx(cv(512, 512, (x, w, h) => {
      x.fillStyle = '#a3a3a3'; x.fillRect(0, 0, w, h); blobs(x, 140, ['#7a7a7a', '#bcbcbc'], 14, 70, .08, .2, w, h); scratches(x, 70, '#d0d0d0', 10, .3, w, h);
    }), false, true);
    const metalColor = tx(cv(1024, 1024, (x, w, h) => {
      x.fillStyle = '#3a3e44'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 2400; i++) { x.globalAlpha = .04 + R() * .08; x.fillStyle = R() < .5 ? '#51565d' : '#262a2f'; x.fillRect(0, R() * h, w, .6 + R() * 1.6); }
      blobs(x, 160, ['#2b2621', '#4a4f56'], 30, 140, .06, .18, w, h); scratches(x, 220, '#8d939a', 50, .35, w, h, true); scratches(x, 60, '#a8adb3', 18, .5, w, h);
    }), true, true);
    const metalRough = tx(cv(512, 512, (x, w, h) => {
      x.fillStyle = '#7a7a7a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 1400; i++) { x.globalAlpha = .08 + R() * .1; x.fillStyle = R() < .5 ? '#9a9a9a' : '#555'; x.fillRect(0, R() * h, w, 1 + R()); }
      blobs(x, 80, ['#b0b0b0'], 20, 90, .2, .4, w, h); x.globalAlpha = 1;
    }), false, true);
    const woodlessFelt = null; // (desk mat belongs to the room)

    // ---------- materials ----------
    const abs = M(new T.MeshStandardMaterial({ name: 'Aged ABS', map: absColor, roughnessMap: absRough, roughness: 1, metalness: 0 }));
    const gunmetal = M(new T.MeshStandardMaterial({ name: 'Anodised gunmetal', map: metalColor, roughnessMap: metalRough, roughness: .9, metalness: .82 }));
    const alu = M(new T.MeshStandardMaterial({ name: 'Bead-blast aluminium', color: lin('#8e939a'), roughness: .34, metalness: 1 }));
    const brass = M(new T.MeshStandardMaterial({ name: 'Worn brass', color: lin('#a98654'), roughness: .38, metalness: 1 }));
    const rubber = M(new T.MeshStandardMaterial({ name: 'Rubber', color: lin('#141516'), roughness: .88, metalness: 0 }));
    const blackPlastic = M(new T.MeshStandardMaterial({ name: 'Black plastic', color: lin('#1b1c1f'), roughness: .52, metalness: 0 }));
    const switchMat = M(new T.MeshStandardMaterial({ name: 'Switch housings', color: lin('#232427'), roughness: .45, metalness: 0 }));
    const cardMat = M(new T.MeshStandardMaterial({ name: 'Smoked data card', color: lin('#203a40'), roughness: .3, metalness: .1 }));
    const sleeve = M(new T.MeshStandardMaterial({ name: 'Paracord sleeve', color: lin('#1f4b52'), roughness: .7, metalness: 0 }));
    function ledMat(hex, name) { const m = M(new T.MeshStandardMaterial({ name, color: lin('#050505'), emissive: lin(hex), emissiveIntensity: 3, roughness: .3 })); return m; }

    // ---------- geometry helpers ----------
    function rrect(w, h, r, path, cx = 0, cy = 0) {
      const s = path || new T.Shape(), x = cx - w / 2, y = cy - h / 2; r = Math.min(r, w / 2 - 1e-5, h / 2 - 1e-5);
      s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
    }
    function boxUV(g, scale) {
      const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i)); let u, v;
        if (ax >= ay && ax >= az) { u = p.getZ(i); v = p.getY(i); } else if (ay >= az) { u = p.getX(i); v = p.getZ(i); } else { u = p.getX(i); v = p.getY(i); }
        uv[i * 2] = u * scale; uv[i * 2 + 1] = v * scale; }
      g.setAttribute('uv', new T.BufferAttribute(uv, 2)); return g;
    }
    function roundedBox(w, h, d, r, seg = 4) {
      const b = Math.max(1e-4, Math.min(r, d / 2 - 1e-4, w / 2 - 1e-4, h / 2 - 1e-4));
      const g = new T.ExtrudeGeometry(rrect(w - 2 * b, h - 2 * b, Math.max(b * .6, 1e-4)), { depth: Math.max(d - 2 * b, 1e-5), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: seg, curveSegments: 6 });
      g.translate(0, 0, -(d - 2 * b) / 2); return G(boxUV(g, 6));
    }
    function frameGeo(ow, oh, or, iw, ih, ir, d, bev, hy = 0) {
      // Holes are cut at their final size with no bevel: bevel offsets on hole
      // contours can self-intersect at the rounded corners and triangulate into
      // spikes across the opening. The outer contour keeps its rounded bevel.
      if (bev <= 0) { const s0 = rrect(ow, oh, or); s0.holes.push(rrect(iw, ih, ir, new T.Path(), 0, hy)); return G(boxUV(new T.ExtrudeGeometry(s0, { depth: d, bevelEnabled: false, curveSegments: 10 }), 6)); }
      const s = rrect(ow - 2 * bev, oh - 2 * bev, or); s.holes.push(rrect(iw + 2 * bev, ih + 2 * bev, ir, new T.Path(), 0, hy));
      const g = new T.ExtrudeGeometry(s, { depth: Math.max(d - 2 * bev, 1e-5), bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 8 });
      g.translate(0, 0, bev); return G(boxUV(g, 6));
    }
    // Rounded-rect loops sampled with identical parameterisation, joined loop to
    // loop. Used for every surround around the CRT: no earcut, so no triangles
    // can ever span the opening, at any distance or depth precision.
    function rrLoop(w, h, r, z, n = 10) {
      r = Math.min(r, w / 2 - 1e-5, h / 2 - 1e-5); const pts = [], cx = w / 2 - r, cy = h / 2 - r, c = [[cx, cy], [-cx, cy], [-cx, -cy], [cx, -cy]];
      for (let k = 0; k < 4; k++) for (let i = 0; i <= n; i++) { const a = (k + i / n) * Math.PI / 2; pts.push(new T.Vector3(c[k][0] + Math.cos(a) * r, c[k][1] + Math.sin(a) * r, z)); }
      return pts;
    }
    function sweep(profile) { // [[w,h,r,z], ...] from outer-back, over the face, to inner-back
      const loops = profile.map(p => rrLoop(p[0], p[1], p[2], p[3])), pos = [];
      for (let l = 0; l < loops.length - 1; l++) { const A = loops[l], B = loops[l + 1];
        for (let i = 0; i < A.length; i++) { const j = (i + 1) % A.length; [A[i], A[j], B[j], A[i], B[j], B[i]].forEach(v => pos.push(v.x, v.y, v.z)); } }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return G(boxUV(g, 6));
    }
    const unitBox = G(boxUV(new T.BoxGeometry(1, 1, 1), 1));
    function add(parent, geo, mat, name, p = [0, 0, 0], r = [0, 0, 0], s) {
      const m = new T.Mesh(geo, mat); m.name = name; m.position.fromArray(p); m.rotation.set(r[0], r[1], r[2]); if (s) m.scale.fromArray(s); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
    }
    const box = (parent, mat, name, p, s, r) => add(parent, unitBox, mat, name, p, r || [0, 0, 0], s);
    function instanced(parent, geo, mat, name, items) {
      const im = new T.InstancedMesh(geo, mat, items.length), o = new T.Object3D(); im.name = name; im.castShadow = im.receiveShadow = true;
      items.forEach((it, i) => { o.position.fromArray(it[0]); o.scale.fromArray(it[1] || [1, 1, 1]); o.rotation.set(...(it[2] || [0, 0, 0])); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
      parent.add(im); return im;
    }
    function decal(parent, canvas, name, w, h, p, r, opt = {}) {
      const m = M(new T.MeshStandardMaterial({ name: name + ' decal', map: tx(canvas, true), transparent: true, roughness: opt.rough ?? .55, metalness: opt.metal ?? 0, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false }));
      const mesh = add(parent, G(new T.PlaneGeometry(w, h)), m, name, p, r); mesh.castShadow = false; mesh.renderOrder = 1; return mesh;
    }
    function merge(parts) { // [{geometry, matrix}]
      const out = { position: [], normal: [], uv: [] };
      parts.forEach(({ geometry, matrix }) => {
        const g = geometry.index ? geometry.toNonIndexed() : geometry.clone(); g.applyMatrix4(matrix);
        out.position.push(...g.attributes.position.array); out.normal.push(...g.attributes.normal.array);
        out.uv.push(...(g.attributes.uv ? g.attributes.uv.array : new Float32Array(g.attributes.position.count * 2))); g.dispose();
      });
      const m = new T.BufferGeometry(); m.setAttribute('position', new T.Float32BufferAttribute(out.position, 3)); m.setAttribute('normal', new T.Float32BufferAttribute(out.normal, 3)); m.setAttribute('uv', new T.Float32BufferAttribute(out.uv, 2));
      return G(m);
    }
    // Static pieces sharing a material can use one draw inside each interaction
    // root. Keep the screen/case objects and transparent overlays independent;
    // LED materials remain shared with their animation state. The fine heatsink
    // slats retain instancing to preserve their existing subpixel shadow edges.
    function batchStaticParts(roots) {
      const schema = g => Object.keys(g.attributes).sort().map(key => {
        const a = g.attributes[key]; return key + ':' + a.itemSize + ':' + a.normalized + ':' + a.array.constructor.name;
      }).join('|');
      for (const root of roots) {
        root.updateWorldMatrix(true, true);
        const inverse = new T.Matrix4().copy(root.matrixWorld).invert(), groups = new Map();
        root.traverse(node => {
          if (!node.isMesh || node.isSkinnedMesh || !node.visible || node.children.length ||
              node.name === 'COMPUTER_heatsink-fins' || node.name === 'KEYBOARD_case' || node.name === 'SCREEN_SURFACE' ||
              Array.isArray(node.material) || node.material.transparent || node.instanceColor ||
              node.geometry.morphAttributes.position || node.geometry.morphAttributes.normal ||
              node.customDepthMaterial || node.customDistanceMaterial || node.layers.mask !== 1 ||
              node.geometry.drawRange.start !== 0 || Number.isFinite(node.geometry.drawRange.count) ||
              node.matrixWorld.determinant() <= 0) return;
          const key = node.material.uuid + '|' + node.castShadow + '|' + node.receiveShadow + '|' + node.renderOrder + '|' + schema(node.geometry);
          const nodes = groups.get(key) || []; nodes.push(node); groups.set(key, nodes);
        });
        for (const nodes of groups.values()) {
          if (nodes.length < 2) continue;
          const baked = [], instance = new T.Matrix4();
          for (const node of nodes) {
            const relative = new T.Matrix4().multiplyMatrices(inverse, node.matrixWorld);
            for (let i = 0; i < (node.isInstancedMesh ? node.count : 1); i++) {
              let matrix = relative;
              if (node.isInstancedMesh) { node.getMatrixAt(i, instance); matrix = relative.clone().multiply(instance); }
              const geometry = node.geometry.clone(); geometry.applyMatrix4(matrix); baked.push(geometry);
            }
          }
          const geometry = G(new T.BufferGeometry()), keys = Object.keys(baked[0].attributes);
          let vertexCount = 0, indexCount = 0;
          for (const g of baked) { vertexCount += g.attributes.position.count; indexCount += g.index ? g.index.count : g.attributes.position.count; }
          for (const key of keys) {
            const first = baked[0].attributes[key], array = new first.array.constructor(vertexCount * first.itemSize);
            let offset = 0;
            for (const g of baked) { array.set(g.attributes[key].array, offset); offset += g.attributes[key].array.length; }
            geometry.setAttribute(key, new T.BufferAttribute(array, first.itemSize, first.normalized));
          }
          const indices = new (vertexCount > 65535 ? Uint32Array : Uint16Array)(indexCount);
          let vertexOffset = 0, indexOffset = 0;
          for (const g of baked) {
            const count = g.index ? g.index.count : g.attributes.position.count;
            for (let i = 0; i < count; i++) indices[indexOffset++] = vertexOffset + (g.index ? g.index.getX(i) : i);
            vertexOffset += g.attributes.position.count; g.dispose();
          }
          geometry.setIndex(new T.BufferAttribute(indices, 1)); geometry.computeBoundingSphere(); geometry.computeBoundingBox();
          const first = nodes[0], batch = new T.Mesh(geometry, first.material);
          batch.name = first.name.split('_')[0] + '_batch_' + first.material.name.replace(/\s+/g, '-');
          batch.castShadow = first.castShadow; batch.receiveShadow = first.receiveShadow; batch.renderOrder = first.renderOrder;
          batch.userData.sourceNames = nodes.map(node => node.name);
          for (const node of nodes) node.parent.remove(node);
          root.add(batch);
        }
      }
    }
    function tube(points, radius, name, mat, parent, seg = 120) { const c = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)), false, 'centripetal'); return add(parent, G(new T.TubeGeometry(c, seg, radius, 8, false)), mat, name); }

    // ==================================================================
    // COMPUTER
    // ==================================================================
    const computer = new T.Group(); computer.name = 'COMPUTER_LM-7'; group.add(computer);
    const W = .31, H = .335, D = .32, lift = .006, front = D / 2;
    add(computer, roundedBox(W, H, .075, .016, 5), abs, 'COMPUTER_bezel', [0, lift + H / 2, front - .0375]);
    add(computer, roundedBox(W - .018, H - .022, D - .07, .01), gunmetal, 'COMPUTER_body', [0, lift + H / 2 - .002, -.035]);
    add(computer, roundedBox(.21, .2, .085, .026, 5), gunmetal, 'COMPUTER_tube-housing', [0, lift + .19, -.19]);
    const topY = lift + H - .013;
    const fins = []; for (const sx of [-1, 1]) for (let i = 0; i < 13; i++) fins.push([[sx * ((W - .018) / 2 + .004), lift + .18, -.14 + i * .0175], [.008, .23, .0028]]);
    instanced(computer, unitBox, gunmetal, 'COMPUTER_heatsink-fins', fins);
    const slots = []; for (let i = 0; i < 9; i++) slots.push([[0, topY + .0003, -.13 + i * .018], [.17, .0016, .0055]]);
    for (let i = 0; i < 4; i++) slots.push([[0, lift + .19 + .1 + .0003, -.215 + i * .016], [.13, .0016, .005]]);
    for (let i = 0; i < 7; i++) slots.push([[-.112, lift + .028 + i * .0068, front + .0003], [.032, .0026, .004]]);
    instanced(computer, unitBox, blackPlastic, 'COMPUTER_vent-slots', slots);
    // CRT face: raised ABS lip, rubber gasket, curved phosphor screen, glass.
    const sy = lift + .212, sw = .214, sh = .16, sag = .0075;
    const abs2 = M(abs.clone()); abs2.side = T.DoubleSide; const rubber2 = M(rubber.clone()); rubber2.side = T.DoubleSide;
    add(computer, sweep([[.268, .212, .02, -.001], [.268, .212, .02, .0048], [.263, .207, .018, .0062], [.25, .194, .016, .0062], [.242, .186, .015, .0032], [.242, .186, .015, -.002]]), abs2, 'COMPUTER_screen-lip', [0, sy, front]);
    add(computer, sweep([[.2425, .1865, .015, -.003], [.2425, .1865, .015, .0045], [.236, .18, .013, .0085], [.219, .165, .011, .0085], [.21, .156, .009, .0062], [.21, .156, .009, -.003]]), rubber2, 'COMPUTER_screen-gasket', [0, sy, front]);
    box(computer, blackPlastic, 'COMPUTER_tube-back', [0, sy, front - .006], [.222, .168, .004]);
    const screenGeo = G(new T.PlaneGeometry(sw, sh, 32, 24)); {
      const p = screenGeo.attributes.position, uv = screenGeo.attributes.uv;
      for (let i = 0; i < p.count; i++) { const u = p.getX(i) / (sw / 2), v = p.getY(i) / (sh / 2); p.setZ(i, sag * Math.max(0, 1 - .45 * u * u - .45 * v * v)); uv.setY(i, 1 - uv.getY(i)); }
      screenGeo.computeVertexNormals();
    }
    const screen = add(computer, screenGeo, options.screenMaterial || M(new T.MeshBasicMaterial({ color: lin('#1e2e29') })), 'SCREEN_SURFACE', [0, sy, front + .0035]); screen.castShadow = false; screen.receiveShadow = false;
    // Anti-moire CRT material. The Mac desktop is a 1-px dither: minified without
    // prefiltering it aliases into large diagonal bands. This shader measures the
    // texel footprint per pixel (fwidth) and integrates a matching Vogel disc,
    // with mip bias when mips exist, so the pattern resolves to its average tone
    // at any distance. Scanlines/phosphor fade out before they could alias too.
    const crtUniforms = { map: { value: null }, texSize: { value: new T.Vector2(512, 384) }, uTime: { value: 0 }, uGain: { value: 1 } };
    const crtMaterial = M(new T.ShaderMaterial({ name: 'CRT phosphor (filtered)', uniforms: crtUniforms, toneMapped: false, extensions: { derivatives: true, shaderTextureLOD: true },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: [
        'uniform sampler2D map;uniform vec2 texSize;uniform float uTime,uGain;varying vec2 vUv;',
        'vec3 dec(vec3 c){return pow(max(c,0.),vec3(2.2));}',
        'void main(){',
        ' vec2 tp=vUv*texSize;vec2 dx=dFdx(tp),dy=dFdy(tp);float fp=max(length(dx),length(dy));',
        ' float rad=clamp(fp*.62,0.,24.);float bias=log2(max(fp*.5,1.));vec3 c=vec3(0.);',
        ' for(int i=0;i<16;i++){float a=float(i)*2.39996323;float rr=sqrt((float(i)+.5)/16.)*rad;c+=dec(texture2D(map,vUv+vec2(cos(a),sin(a))*rr/texSize,bias).rgb);}',
        ' c/=16.;',
        ' float detail=1.-smoothstep(.35,1.1,fp);',
        ' float scan=1.-.10*detail*pow(sin(tp.y*3.14159),2.);',
        ' vec2 q=vUv-.5;float vig=1.-.32*pow(dot(q,q)*3.2,1.6);',
        ' c=c*vec3(.97,1.,.95)*scan*vig*uGain+vec3(.004,.006,.005);',
        ' gl_FragColor=vec4(c,1.);',
        ' #include <encodings_fragment>',
        '}'].join('\n') }));
    function adoptScreen(texture) {
      if (disposed) return false;
      const map = texture || (screen.material && screen.material.map); if (!map) return false;
      // Mips are cheap insurance alongside the shader filter.
      map.generateMipmaps = true; map.minFilter = T.LinearMipmapLinearFilter; map.anisotropy = aniso; map.needsUpdate = true;
      crtUniforms.map.value = map; const img = map.image; if (img && img.width) crtUniforms.texSize.value.set(img.width, img.height);
      if (screen.material !== crtMaterial) { if (!mats.includes(screen.material) && screen.material !== options.screenMaterial) screen.material.dispose(); screen.material = crtMaterial; }
      return true;
    }
    // Keep texSize in step when the site swaps in a new canvas (html-to-image refresh).
    screen.onBeforeRender = () => { const m = crtUniforms.map.value; if (m && m.image && m.image.width && (m.image.width !== crtUniforms.texSize.value.x || m.image.height !== crtUniforms.texSize.value.y)) crtUniforms.texSize.value.set(m.image.width, m.image.height); };
    if (options.screenMaterial && options.screenMaterial.map) adoptScreen(options.screenMaterial.map);
    const glass = add(computer, screenGeo, M(new T.MeshPhysicalMaterial({ name: 'CRT glass', color: lin('#cfd8d4'), roughness: .06, metalness: 0, clearcoat: 1, clearcoatRoughness: .04, transparent: true, opacity: .14, envMapIntensity: 1.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })), 'COMPUTER_crt-glass', [0, sy, front + .0052]);
    glass.castShadow = false; glass.renderOrder = 2;
    // Chin: badge, data card slot, status LEDs.
    box(computer, gunmetal, 'COMPUTER_badge-plate', [-.055, lift + .05, front + .0008], [.064, .024, .0025]);
    decal(computer, cv(512, 192, x => {
      x.fillStyle = '#c9cdd2'; x.font = '800 104px "Helvetica Neue",Arial,sans-serif'; x.textBaseline = 'middle';
      let px = 26; 'LEON'.split('').forEach(l => { x.fillStyle = '#16181b'; x.fillText(l, px + 2, 82); x.fillStyle = '#c9cdd2'; x.fillText(l, px, 80); px += x.measureText(l).width + 18; });
      x.fillStyle = '#8f969e'; x.font = '500 30px "Hiragino Sans","Noto Sans JP",sans-serif'; x.fillText('端末 LM-7 · 大阪製', 30, 156);
    }), 'COMPUTER_badge', .06, .0225, [-.055, lift + .05, front + .0022]);
    box(computer, rubber, 'COMPUTER_card-slot', [.055, lift + .072, front + .0005], [.124, .011, .004]);
    box(computer, cardMat, 'COMPUTER_data-card', [.055, lift + .072, front + .013], [.104, .0068, .032]);
    decal(computer, cv(512, 140, x => {
      x.fillStyle = '#e8e2d2'; x.beginPath(); x.moveTo(0, 0); x.lineTo(470, 0); x.lineTo(512, 34); x.lineTo(512, 140); x.lineTo(0, 140); x.closePath(); x.fill();
      x.fillStyle = '#e2552b'; x.fillRect(0, 0, 34, 140); x.fillStyle = '#1c1c1c'; x.font = '700 40px "Helvetica Neue",Arial,sans-serif'; x.fillText('KUJIRA ▸ NIGHT_SWIM v3', 52, 56);
      x.font = '500 26px "Hiragino Sans","Noto Sans JP",sans-serif'; x.fillStyle = '#4a4740'; x.fillText('鯨 / 0451 / DO NOT ERASE', 52, 100);
      x.strokeStyle = '#2a4fa0'; x.lineWidth = 4; x.globalAlpha = .8; x.beginPath(); x.moveTo(300, 118); x.bezierCurveTo(340, 96, 380, 132, 420, 108); x.bezierCurveTo(445, 96, 470, 120, 490, 104); x.stroke();
      x.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 300; i++) { x.globalAlpha = R() * .5; x.fillRect(R() * 512, R() * 140, 1 + R() * 3, 1 + R() * 2); }
    }), 'COMPUTER_card-label', .09, .0246, [.055, lift + .0756, front + .017], [-Math.PI / 2, 0, 0]);
    const cardEdge = ledMat('#45e0ff', 'Card edge light'); box(computer, cardEdge, 'COMPUTER_card-edge-light', [.055, lift + .072, front + .0292], [.096, .0014, .0012]);
    const ledDefs = [['#58ff7a', 'PWR'], ['#ffae3a', 'HDD'], ['#4ad9ff', 'NET'], ['#ff4a5a', 'LNK']];
    ledDefs.forEach((d, i) => { const m = ledMat(d[0], 'LED ' + d[1]); leds.push({ mat: m, kind: d[1] }); box(computer, m, 'COMPUTER_led-' + d[1], [.03 + i * .018, lift + .04, front + .0012], [.007, .0032, .003]); });
    decal(computer, cv(512, 64, x => { x.fillStyle = '#5d5a52'; x.font = '600 30px "Helvetica Neue",Arial,sans-serif'; x.textAlign = 'center'; ['PWR', 'HDD', 'NET', 'LNK'].forEach((t, i) => x.fillText(t, (.1625 + .225 * i) * 512, 44)); }),
      'COMPUTER_led-labels', .08, .01, [.057, lift + .0305, front + .0006]);
    function plugGeo0() { return G(new T.CylinderGeometry(.0048, .0048, .012, 16)); }
    const screwGeo = G(new T.CylinderGeometry(.0028, .0028, .002, 14)); screwGeo.rotateX(Math.PI / 2);
    [[-.142, lift + .318], [.142, lift + .318], [-.142, lift + .088], [.142, lift + .088]].forEach((p, i) => add(computer, screwGeo, alu, 'COMPUTER_bezel-screw-' + i, [p[0], p[1], front + .0005]));
    // Side: rocker, stickers. Rear: ports and cable loom. Feet.
    box(computer, blackPlastic, 'COMPUTER_power-rocker', [W / 2 + .0015, lift + .04, .12], [.005, .022, .014], [0, 0, .12]);
    const rockerDot = ledMat('#ff3a2a', 'Rocker lamp'); box(computer, rockerDot, 'COMPUTER_rocker-lamp', [W / 2 + .0042, lift + .046, .12], [.0008, .004, .006]);
    decal(computer, cv(256, 256, x => {
      x.fillStyle = '#e8c22a'; x.fillRect(8, 8, 240, 240); x.strokeStyle = '#111'; x.lineWidth = 10; x.strokeRect(20, 20, 216, 216);
      x.fillStyle = '#111'; x.beginPath(); x.moveTo(128, 40); x.lineTo(196, 150); x.lineTo(60, 150); x.closePath(); x.fill(); x.fillStyle = '#e8c22a'; x.font = '900 70px Arial'; x.textAlign = 'center'; x.fillText('!', 128, 140);
      x.fillStyle = '#111'; x.font = '800 40px "Hiragino Sans","Noto Sans JP",sans-serif'; x.fillText('高電圧', 128, 196); x.font = '700 20px Arial'; x.fillText('HIGH VOLTAGE · CRT 25kV', 128, 226);
      x.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 40; i++) { x.globalAlpha = .4 + R() * .6; x.beginPath(); x.arc(R() < .5 ? R() * 40 : 216 + R() * 40, R() * 256, 2 + R() * 9, 0, 7); x.fill(); }
    }), 'COMPUTER_warning-sticker', .046, .046, [-W / 2 - .0009, lift + .25, .118], [0, -Math.PI / 2, 0]);
    decal(computer, cv(512, 220, x => {
      x.fillStyle = '#c3c7cb'; x.fillRect(0, 0, 512, 220); x.fillStyle = '#2b2e32'; x.font = '600 22px Arial'; x.fillText('PROPERTY OF', 24, 38);
      x.font = '800 38px "Helvetica Neue",Arial,sans-serif'; x.fillText('KUJIRA PROJECTION ARTS', 24, 82);
      for (let i = 0, px = 24; px < 360; i++) { const bw = 2 + Math.floor(R() * 5); if (i % 2 === 0) x.fillRect(px, 100, bw, 70); px += bw + 1; }
      x.font = '600 22px monospace'; x.fillText('ASSET 0451 · 2071', 24, 200); x.fillText('鯨', 400, 150);
      x.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 500; i++) { x.globalAlpha = R() * .5; x.fillRect(R() * 512, R() * 220, 1 + R() * 4, 1 + R() * 2); }
    }), 'COMPUTER_asset-tag', .05, .0215, [W / 2 + .0009, lift + .2, .12], [0, Math.PI / 2, 0], { metal: .6, rough: .35 });
    box(computer, blackPlastic, 'COMPUTER_port-panel', [0, lift + .12, -.2335], [.16, .052, .004]);
    instanced(computer, unitBox, alu, 'COMPUTER_rear-ports', [[[-.05, lift + .125, -.2365], [.018, .009, .003]], [[-.02, lift + .125, -.2365], [.012, .012, .003]], [[.01, lift + .125, -.2365], [.012, .012, .003]], [[.045, lift + .118, -.2365], [.026, .01, .003]]]);
    const rearPorts = [-.05, -.02, .045].map((x, i) => { const a = new T.Object3D(); a.position.set(x, lift + (i === 2 ? .118 : .125), -.24); a.userData.radius = [.0034, .003, .0026][i]; computer.add(a); return a; });
    instanced(computer, plugGeo0(), blackPlastic, 'COMPUTER_rear-plugs', rearPorts.map(a => [[a.position.x, a.position.y, -.243], [1, 1, 1], [Math.PI / 2, 0, 0]]));
    const footGeo = G(new T.CylinderGeometry(.012, .013, .006, 18)); [[-.13, .12], [.13, .12], [-.12, -.13], [.12, -.13]].forEach((p, i) => add(computer, footGeo, rubber, 'COMPUTER_foot-' + i, [p[0], .003, p[1]]));
    // Retrofit uplink: bolted to the right flank with an antenna and its own lamp.
    add(computer, roundedBox(.026, .05, .07, .004), gunmetal, 'COMPUTER_uplink-module', [W / 2 + .013, lift + .255, -.065]);
    instanced(computer, unitBox, blackPlastic, 'COMPUTER_uplink-straps', [[[W / 2 + .012, lift + .255, -.04], [.03, .056, .006]], [[W / 2 + .012, lift + .255, -.09], [.03, .056, .006]]]);
    const antGeo = G(new T.CylinderGeometry(.0016, .0024, .13, 10)); add(computer, antGeo, blackPlastic, 'COMPUTER_uplink-antenna', [W / 2 + .019, lift + .345, -.085], [0, 0, -.14]);
    const antTip = ledMat('#ff2a2a', 'Antenna lamp'); add(computer, G(new T.SphereGeometry(.0034, 12, 8)), antTip, 'COMPUTER_antenna-lamp', [W / 2 + .019 + Math.sin(.14) * .066, lift + .345 + Math.cos(.14) * .066, -.085]);
    const uplinkLed = ledMat('#4ad9ff', 'Uplink lamp'); leds.push({ mat: uplinkLed, kind: 'UP' }); leds.push({ mat: antTip, kind: 'ANT' }); leds.push({ mat: cardEdge, kind: 'CARD' });
    box(computer, uplinkLed, 'COMPUTER_uplink-lamp', [W / 2 + .019, lift + .265, -.029], [.006, .003, .002]);
    tube([[W / 2 + .013, lift + .232, -.1], [W / 2 + .016, lift + .2, -.14], [W / 2 + .006, lift + .17, -.18], [.08, lift + .13, -.236]], .0022, 'COMPUTER_uplink-cable', rubber, computer, 40);
    const kPort = new T.Object3D(); kPort.position.set(-W / 2 - .004, lift + .022, .11); computer.add(kPort);
    const mPort = new T.Object3D(); mPort.position.set(W / 2 + .004, lift + .022, .1); computer.add(mPort);
    const plugGeo = G(new T.CylinderGeometry(.0055, .0055, .014, 20)); plugGeo.rotateZ(Math.PI / 2);
    add(computer, plugGeo, alu, 'COMPUTER_keyboard-socket', [-W / 2 - .003, lift + .022, .11]); add(computer, plugGeo, blackPlastic, 'COMPUTER_mouse-socket', [W / 2 + .003, lift + .022, .1]);

    // ==================================================================
    // KEYBOARD: JIS-legend 65%, anodised wedge case
    // ==================================================================
    const keyboard = new T.Group(); keyboard.name = 'KEYBOARD_LM-77'; group.add(keyboard);
    const u = .019, Wc = .326, Dc = .124, angle = .1047, frontH = .016, tanA = Math.tan(angle);
    const holeZ = Dc / 2 - .009 - 2.5 * u;
    {
      const g = frameGeo(Wc, Dc, .006, 16 * u + .003, 5 * u + .003, .0015, frontH, .0016, -holeZ);
      g.rotateX(-Math.PI / 2); g.translate(0, .003, 0);
      const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), z = p.getZ(i); p.setY(i, y + Math.max(0, (y - .003) / frontH) * (Dc / 2 - z) * tanA); }
      boxUV(g, 6); add(keyboard, g, gunmetal, 'KEYBOARD_case');
    }
    box(keyboard, gunmetal, 'KEYBOARD_base', [0, .0045, 0], [Wc - .008, .003, Dc - .008]);
    const rimY = z => .003 + frontH + (Dc / 2 - z) * tanA;
    const deck = new T.Group(); deck.name = 'KEYBOARD_deck'; deck.position.set(0, rimY(holeZ) - .0045, holeZ); deck.rotation.x = angle; keyboard.add(deck);
    box(deck, blackPlastic, 'KEYBOARD_plate', [0, -.0015, 0], [16 * u + .002, .003, 5 * u + .002]);
    const digits = '1234567890-=', shifts = '!@#$%^&*()_+', kanaD = 'ぬふあうえおやゆよわほへ';
    const L = (s, kana) => s.split('').map((c, i) => [c, 1, 'a', kana[i]]);
    const layout = [
      [['Esc', 1, 'esc']].concat(digits.split('').map((c, i) => [c, 1, 'a', kanaD[i], shifts[i]]), [['⌫', 2, 'm'], ['Del', 1, 'm']]),
      [['Tab', 1.5, 'm']].concat(L('QWERTYUIOP[]', 'たていすかんなにらせ゛゜'), [['\\', 1.5, 'm', 'ー'], ['PgUp', 1, 'm']]),
      [['Caps', 1.75, 'm']].concat(L('ASDFGHJKL;\'', 'ちとしはきくまのりれけ'), [['Enter', 2.25, 'enter'], ['PgDn', 1, 'm']]),
      [['Shift', 2.25, 'm']].concat(L('ZXCVBNM,./', 'つさそひこみもねるめ'), [['Shift', 1.75, 'm'], ['▲', 1, 'arrow'], ['End', 1, 'm']]),
      [['Ctrl', 1.25, 'm'], ['Opt', 1.25, 'm'], ['⌘', 1.25, 'm'], ['', 6.25, 'space'], ['⌘', 1, 'm'], ['Fn', 1, 'm'], [null, 1], ['◀', 1, 'arrow'], ['▼', 1, 'arrow'], ['▶', 1, 'arrow']]
    ];
    const worn = new Set(['E', 'A', 'S', 'D', 'J', 'K', '⌫', 'Enter', '']);
    const style = { a: ['#d8d0bd', '#34332f'], m: ['#45484d', '#d3cbb8'], esc: ['#e2552b', '#1a1a1a'], enter: ['#3aa6b0', '#0f1a1c'], space: ['#d8d0bd', '#34332f'], arrow: ['#2b2d31', '#5fd8e8'] };
    const CU = 104, AW = 2048, AH = 640; const atlas = document.createElement('canvas'); atlas.width = AW; atlas.height = AH; const ax = atlas.getContext('2d');
    const keys = [];
    layout.forEach((row, r) => { let cx = 0, px = 0; row.forEach(k => { if (k[0] !== null) keys.push({ label: k[0], w: k[1], kind: k[2], kana: k[3], shift: k[4], row: r, x: cx, cell: [px, r * 120 + 8, k[1] * CU, CU] }); cx += k[1]; if (k[0] !== null) px += k[1] * CU + 6; }); });
    keys.forEach(k => {
      const [x0, y0, cw, ch] = k.cell, [cap, ink] = style[k.kind];
      ax.fillStyle = cap; ax.fillRect(x0, y0, cw, ch);
      const g = ax.createRadialGradient(x0 + cw / 2, y0 + ch * .55, 4, x0 + cw / 2, y0 + ch * .55, Math.max(cw, ch) * .6); g.addColorStop(0, 'rgba(255,255,255,.08)'); g.addColorStop(1, 'rgba(0,0,0,.14)'); ax.fillStyle = g; ax.fillRect(x0, y0, cw, ch);
      if (worn.has(k.label)) { ax.save(); const wg = ax.createRadialGradient(x0 + cw / 2, y0 + ch * .56, 2, x0 + cw / 2, y0 + ch * .56, Math.min(cw, ch * 1.6) * .34); wg.addColorStop(0, 'rgba(255,250,238,.16)'); wg.addColorStop(1, 'rgba(255,250,238,0)'); ax.fillStyle = wg; ax.fillRect(x0, y0, cw, ch); ax.restore(); }
      ax.save(); ax.globalAlpha = worn.has(k.label) ? .55 : 1; ax.fillStyle = ink; ax.textBaseline = 'top';
      if (k.kind === 'a' && k.label.length === 1) {
        if (k.shift) { ax.font = '600 26px "Helvetica Neue",Arial,sans-serif'; ax.fillText(k.shift, x0 + 16, y0 + 12); ax.font = '600 32px "Helvetica Neue",Arial,sans-serif'; ax.fillText(k.label, x0 + 16, y0 + 50); }
        else { ax.font = '600 38px "Helvetica Neue",Arial,sans-serif'; ax.fillText(k.label, x0 + 16, y0 + 14); }
        if (k.kana) { ax.fillStyle = '#b5443a'; ax.font = '500 28px "Hiragino Sans","Noto Sans JP",sans-serif'; ax.textAlign = 'right'; ax.fillText(k.kana, x0 + cw - 14, y0 + ch - 44); }
      } else if (k.kind === 'arrow') { ax.font = '600 34px Arial'; ax.textAlign = 'center'; ax.fillText(k.label, x0 + cw / 2, y0 + 32); }
      else if (k.kind === 'space') { ax.globalAlpha = .45; ax.font = '500 22px "Hiragino Sans","Noto Sans JP",sans-serif'; ax.textAlign = 'center'; ax.fillText('夜 · LM-77', x0 + cw / 2, y0 + ch - 40); }
      else { ax.font = '600 ' + (k.label.length > 3 ? 22 : 26) + 'px "Helvetica Neue",Arial,"Apple Symbols","Segoe UI Symbol",sans-serif'; ax.fillText(k.label, x0 + 16, y0 + 16); if (k.kana) { ax.fillStyle = '#b5443a'; ax.textAlign = 'right'; ax.fillText(k.kana, x0 + cw - 14, y0 + ch - 44); } }
      ax.restore();
      for (let i = 0; i < 60; i++) { ax.globalAlpha = .06 + R() * .1; ax.fillStyle = '#5c574c'; ax.fillRect(x0 + R() * cw, y0 + R() * ch, 1.5, 1.5); } ax.globalAlpha = 1;
    });
    const keyTex = tx(atlas, true); keyTex.minFilter = T.LinearMipmapLinearFilter;
    const capParts = [], switchParts = [], profile = [.0106, .0099, .0094, .0098, .0103], tilt = [.15, .07, 0, -.05, -.1];
    const swGeo = G(new T.BoxGeometry(.0142, .0055, .0142)), mtx = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
    keys.forEach(k => {
      const wk = k.w * u - .0018, dk = u - .0018, hk = profile[k.row];
      const g = new T.BoxGeometry(wk, hk, dk); const p = g.attributes.position, uv = g.attributes.uv;
      for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setX(i, p.getX(i) * (wk - .0052) / wk); p.setZ(i, p.getZ(i) * (dk - .0052) / dk - .0006); }
      g.computeVertexNormals();
      const [x0, y0, cw, ch] = k.cell, side = [(x0 + 3) / AW, 1 - (y0 + 3) / AH];
      for (let i = 0; i < uv.count; i++) uv.setXY(i, side[0], side[1]);
      for (let i = 8; i < 12; i++) { const su = i % 2 === 0 ? 0 : 1, sv = i < 10 ? 1 : 0; uv.setXY(i, (x0 + 5 + su * (cw - 10)) / AW, 1 - (y0 + ch - 5) / AH + sv * (ch - 10) / AH); }
      const cxm = (k.x + k.w / 2 - 8) * u, cz = (k.row - 2) * u;
      mtx.compose(new T.Vector3(cxm, .0035 + hk / 2, cz), q.setFromEuler(e.set(tilt[k.row], 0, 0)), new T.Vector3(1, 1, 1)); capParts.push({ geometry: g, matrix: mtx.clone() });
      const stems = k.w >= 2 ? [0, -(k.w / 2 - .5) * u, (k.w / 2 - .5) * u] : [0];
      stems.forEach(o => switchParts.push({ geometry: swGeo, matrix: new T.Matrix4().makeTranslation(cxm + o, .00275, cz) }));
      geoms.push(g);
    });
    add(deck, merge(capParts), M(new T.MeshStandardMaterial({ name: 'PBT keycaps', map: keyTex, roughness: .62, metalness: 0 })), 'KEYBOARD_keycaps');
    add(deck, merge(switchParts), switchMat, 'KEYBOARD_switches');
    const rearZ = -Dc / 2 + .0075;
    const oledCanvas = cv(1024, 64, x => {
      x.fillStyle = '#000'; x.fillRect(0, 0, 1024, 64); x.fillStyle = '#ffb347'; x.font = '600 34px ui-monospace,Menlo,monospace'; x.textBaseline = 'middle';
      x.fillText(' LM-77 ▸ 夜間モード ▸ RAIN 92% ▸ 04:13 ▸ UPLINK OK ▸ 鯨 ', 0, 34);
      x.fillStyle = 'rgba(0,0,0,.45)'; for (let i = 0; i < 64; i += 4) x.fillRect(0, i, 1024, 1); for (let i = 0; i < 1024; i += 4) x.fillRect(i, 0, 1, 64);
    });
    const oledTex = tx(oledCanvas, true, true); oledTex.repeat.set(.42, 1);
    const oledMat = M(new T.MeshBasicMaterial({ name: 'OLED strip', map: oledTex, toneMapped: true })); oledMat.color.setScalar(2.4);
    box(keyboard, blackPlastic, 'KEYBOARD_oled-bezel', [.095, rimY(rearZ) + .0004, rearZ], [.072, .001, .009], [angle, 0, 0]);
    const oled = add(keyboard, G(new T.PlaneGeometry(.064, .0055)), oledMat, 'KEYBOARD_oled', [.095, rimY(rearZ) + .0011, rearZ], [-Math.PI / 2 + angle, 0, 0]); oled.castShadow = false;
    const knobGeo = G(new T.CylinderGeometry(.0066, .0069, .009, 48, 1)); { const p = knobGeo.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); if (Math.abs(p.getY(i)) < .0046 && Math.round(a / (Math.PI * 2) * 48) % 2) { p.setX(i, p.getX(i) * .95); p.setZ(i, p.getZ(i) * .95); } } knobGeo.computeVertexNormals(); }
    add(keyboard, knobGeo, alu, 'KEYBOARD_knob', [-.14, rimY(rearZ) + .0045, rearZ]);
    box(keyboard, ledMat('#5fd8e8', 'Knob notch'), 'KEYBOARD_knob-notch', [-.14, rimY(rearZ) + .0092, rearZ + .004], [.0012, .0004, .003]);
    const ringMat = ledMat('#3aa6b0', 'Knob ring'); leds.push({ mat: ringMat, kind: 'RING' });
    add(keyboard, G(new T.TorusGeometry(.0076, .0006, 6, 48)), ringMat, 'KEYBOARD_knob-ring', [-.14, rimY(rearZ) + .0006, rearZ], [Math.PI / 2, 0, 0]);
    leds.push({ mat: oledMat, kind: 'OLED', tex: oledTex });
    const bscrew = G(new T.CylinderGeometry(.0019, .0019, .0012, 12));
    [[-Wc / 2 + .0055, Dc / 2 - .0045], [Wc / 2 - .0055, Dc / 2 - .0045], [-Wc / 2 + .0055, -Dc / 2 + .0045], [Wc / 2 - .0055, -Dc / 2 + .0045]].forEach((p, i) => add(keyboard, bscrew, brass, 'KEYBOARD_screw-' + i, [p[0], rimY(p[1]) + .0002, p[1]], [angle, 0, 0]));
    decal(keyboard, cv(256, 48, x => { x.fillStyle = '#9aa0a6'; x.font = '700 26px "Helvetica Neue",Arial,sans-serif'; x.textBaseline = 'middle'; x.fillText('LM-77', 8, 25); x.font = '500 22px "Hiragino Sans","Noto Sans JP",sans-serif'; x.fillText('ヨル', 110, 25); }),
      'KEYBOARD_front-badge', .036, .0068, [-.13, .011, Dc / 2 + .0003], [0, 0, 0], { metal: .5 });
    instanced(keyboard, G(new T.CylinderGeometry(.006, .006, .003, 14)), rubber, 'KEYBOARD_feet', [[[-.14, .0015, .05]], [[.14, .0015, .05]], [[-.14, .0015, -.05]], [[.14, .0015, -.05]]]);
    const kbPortPos = [-.11, .012, -Dc / 2 - .006];
    const avGeo = G(new T.CylinderGeometry(.0052, .0052, .016, 20)); avGeo.rotateX(Math.PI / 2);
    add(keyboard, avGeo, alu, 'KEYBOARD_aviator-plug', kbPortPos);
    add(keyboard, G(new T.TorusGeometry(.0054, .0009, 6, 20)), brass, 'KEYBOARD_aviator-collar', [kbPortPos[0], kbPortPos[1], kbPortPos[2] - .004]);
    const kbPort = new T.Object3D(); kbPort.position.set(kbPortPos[0], kbPortPos[1], kbPortPos[2] - .009); keyboard.add(kbPort);

    // ==================================================================
    // MOUSE
    // ==================================================================
    const mouse = new T.Group(); mouse.name = 'MOUSE_LM'; group.add(mouse);
    const ws = t => .0275 + .004 * t, top = t => .03 * (1 - .35 * Math.pow((t - .3) / 1.3, 2)), halfL = .057;
    const shapeMap = (xn, yn, zn) => [Math.sign(xn) * Math.pow(Math.abs(xn), .8) * ws(zn), (yn > 0 ? yn * top(zn) : yn * .006) + .006, zn * halfL];
    function mouseGeo(scale = [1, 1, 1]) {
      const g = new T.SphereGeometry(1, 72, 48), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const v = shapeMap(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, v[0] * scale[0], (v[1] - .006) * scale[1] + .006, v[2] * scale[2]); }
      g.computeVertexNormals(); return G(boxUV(g, 6));
    }
    add(mouse, mouseGeo(), abs, 'MOUSE_shell');
    add(mouse, mouseGeo([1.045, .3, 1.03]), gunmetal, 'MOUSE_skirt');
    const surf = (phi, t, k = 1.003) => { const r = Math.sqrt(Math.max(0, 1 - t * t)); const v = shapeMap(r * Math.sin(phi), r * Math.cos(phi), t); return [v[0] * k, (v[1] - .006) * k + .006, v[2]]; };
    const seam = []; for (let t = -.985; t <= -.2; t += .035) seam.push(surf(0, t)); tube(seam, .00055, 'MOUSE_button-split', blackPlastic, mouse, 40);
    const cross = []; for (let a = -1.25; a <= 1.25; a += .1) cross.push(surf(a, -.2)); tube(cross, .00055, 'MOUSE_palm-split', blackPlastic, mouse, 40);
    const wt = -.46, wy = surf(0, wt, 1)[1];
    box(mouse, blackPlastic, 'MOUSE_wheel-slot', [0, wy - .0006, wt * halfL], [.009, .002, .021]);
    const wheelGeo = G(new T.CylinderGeometry(.0085, .0085, .0066, 32)); wheelGeo.rotateZ(Math.PI / 2); add(mouse, wheelGeo, rubber, 'MOUSE_wheel', [0, wy - .0032, wt * halfL]);
    const wheelLed = ledMat('#45e0ff', 'Wheel light'); leds.push({ mat: wheelLed, kind: 'WHEEL' });
    const wheelRing = G(new T.CylinderGeometry(.0087, .0087, .0012, 32)); wheelRing.rotateZ(Math.PI / 2); add(mouse, wheelRing, wheelLed, 'MOUSE_wheel-light', [0, wy - .0032, wt * halfL]);
    const dpi = ledMat('#ff4fd8', 'DPI lamp'); leds.push({ mat: dpi, kind: 'DPI' }); const dp = surf(0, -.12, 1.004); box(mouse, dpi, 'MOUSE_dpi-lamp', dp, [.0016, .0006, .0032]);
    const side = surf(-1.35, -.05, 1.0); add(mouse, roundedBox(.004, .0062, .013, .0012), gunmetal, 'MOUSE_thumb-fwd', [side[0] - .0004, .015, -.008], [0, 0, .12]);
    add(mouse, roundedBox(.004, .0062, .013, .0012), gunmetal, 'MOUSE_thumb-back', [side[0] - .0002, .015, .008], [0, 0, .12]);
    instanced(mouse, G(new T.BoxGeometry(.01, .0008, .02)), rubber, 'MOUSE_glides', [[[-.014, .0004, -.03]], [[.014, .0004, -.03]], [[0, .0004, .042], [2.2, 1, .5]]]);
    const nose = new T.Object3D(); nose.position.set(0, .007, -halfL - .002); mouse.add(nose);

    // ---------- default layout ----------
    computer.position.set(0, 0, -.1); keyboard.position.set(-.02, 0, .17); mouse.position.set(.27, 0, .18);

    // ---------- cables between parts (rebuilt when parts move) ----------
    const cableGroup = new T.Group(); cableGroup.name = 'Workstation cables'; group.add(cableGroup);
    // Floor box: recessed service outlet with a flipped-open lid and brush grommet.
    // route.deskEdgeZ: desk's rear edge; route.floorY: floor height (group space).
    const route = Object.assign({ deskEdgeZ: -.4, floorY: -.763, deskThickness: .04, deskY: null, deskBounds: null, surfaces: [] }, options.cableRoute || {});
    const floorBox = new T.Group(); floorBox.name = 'FLOORPORT_service-box'; group.add(floorBox);
    add(floorBox, roundedBox(.2, .006, .13, .002), gunmetal, 'FLOORPORT_frame', [0, .003, 0]);
    box(floorBox, blackPlastic, 'FLOORPORT_well', [0, .0035, .012], [.15, .002, .07]);
    instanced(floorBox, unitBox, rubber, 'FLOORPORT_brush', Array.from({ length: 30 }, (_, i) => [[-.07 + i * .0048, .0055, -.012], [.0032, .004, .008], [(i % 3 - 1) * .2, 0, 0]]));
    const lid = add(floorBox, roundedBox(.16, .005, .08, .0015), gunmetal, 'FLOORPORT_lid', [0, .022, -.075], [-.62, 0, 0]);
    instanced(floorBox, G(new T.CylinderGeometry(.003, .003, .012, 10)), alu, 'FLOORPORT_hinges', [[[-.05, .004, -.045], [1, 1, 1], [0, 0, Math.PI / 2]], [[.05, .004, -.045], [1, 1, 1], [0, 0, Math.PI / 2]]]);
    const floorLamp = ledMat('#58ff7a', 'Floor box lamp'); leds.push({ mat: floorLamp, kind: 'PWR' }); box(floorBox, floorLamp, 'FLOORPORT_live-lamp', [.085, .0062, .05], [.006, .0008, .003]);
    decal(floorBox, cv(256, 64, x => { x.fillStyle = '#e8c22a'; x.font = '800 30px "Helvetica Neue",Arial,sans-serif'; x.textBaseline = 'middle'; x.fillText('⚡ 240V · 床', 10, 34); }), 'FLOORPORT_label', .05, .0125, [-.06, .0062, .05], [-Math.PI / 2, 0, 0]);
    function setCableRoute(o) { Object.assign(route, o || {}); rebuildCables(); }
    class Coil extends T.Curve {
      constructor(base, a, b, r, turns) { super(); Object.assign(this, { base, a, b, r, turns }); this.t0 = new T.Vector3(); this.s = new T.Vector3(); this.up = new T.Vector3(0, 1, 0); this.n = new T.Vector3(); }
      getPoint(t, target = new T.Vector3()) {
        this.base.getPointAt(t, target); if (t <= this.a || t >= this.b) return target;
        const k = (t - this.a) / (this.b - this.a), env = Math.min(1, k / .04, (1 - k) / .04);
        this.base.getTangentAt(t, this.t0); this.s.crossVectors(this.t0, this.up).normalize(); this.n.crossVectors(this.s, this.t0).normalize();
        const ang = k * this.turns * Math.PI * 2; return target.addScaledVector(this.s, Math.cos(ang) * this.r * env).addScaledVector(this.n, (Math.sin(ang) + 1) * this.r * env);
      }
    }
    function rebuildCables() {
      if (disposed) return;
      cableGroup.children.slice().forEach(c => {
        c.geometry.dispose();
        const index = geoms.indexOf(c.geometry); if (index !== -1) geoms.splice(index, 1);
        cableGroup.remove(c);
      });
      group.updateMatrixWorld(true);
      const local = o => group.worldToLocal(o.getWorldPosition(new T.Vector3()));
      const desk = route.deskY == null ? Math.min(computer.position.y, keyboard.position.y, mouse.position.y) : route.deskY;
      const kb = local(kbPort), kp = local(kPort), mp = local(mPort), mn = local(nose);
      // Keep the whole tube above the authored desktop and raised desk mat,
      // including the low turns of the coiled sleeve. Approach each pad edge
      // gradually so a cable drapes over it rather than stepping vertically.
      function surfaceHeight(x, z, radius) {
        const b = route.deskBounds;
        if (b && (x < b.minX - radius || x > b.maxX + radius || z < b.minZ - radius || z > b.maxZ + radius)) return -Infinity;
        if (!b && z < route.deskEdgeZ - radius) return -Infinity;
        let y = desk;
        (route.surfaces || []).forEach(s => {
          const edgeDistance = Math.min(x - s.minX, s.maxX - x, z - s.minZ, s.maxZ - z);
          const blend = T.MathUtils.smoothstep(edgeDistance, -.025 - radius, -.001 - radius);
          y = Math.max(y, desk + (s.topY - desk) * blend);
        });
        return y;
      }
      function supportedCurve(base, radius) {
        return new class extends T.Curve {
          getPoint(t, target = new T.Vector3()) {
            base.getPoint(t, target);
            target.y = Math.max(target.y, surfaceHeight(target.x, target.z, radius) + radius + .00045);
            return target;
          }
        }();
      }
      // Rear loom: back across the desk, over the rear edge, a soft drape, then
      // down through the brush grommet of the floor box behind the desk.
      const cx = computer.position.x, edge = route.deskEdgeZ, fy = route.floorY, portZ = edge - .1;
      floorBox.position.set(cx + .02, fy, portZ);
      rearPorts.forEach((a, i) => {
        const p = local(a), o = (i - 1) * .016, gx = floorBox.position.x - .03 + i * .03;
        // z decreases monotonically toward the edge, however close the computer sits to it.
        const zDrop = Math.min(p.z - .022, Math.max(edge + .03, p.z - .07)), zLie = Math.min(zDrop - .008, Math.max(edge + .012, zDrop - .05));
        const pts = [p, new T.Vector3(p.x, p.y - .004, p.z - .016), new T.Vector3(p.x + o * .4, desk + .01, zDrop), new T.Vector3(cx + o, desk + .0035, zLie),
          new T.Vector3(cx + o, desk + .002, edge + .002), new T.Vector3(cx + o, desk - .012, edge - .012), new T.Vector3(cx + o * 1.3, desk - route.deskThickness - .05, edge - .03),
          new T.Vector3(cx + o * 1.6 + .015, (desk + fy) * .5, edge - .055 - i * .006), new T.Vector3(gx, fy + .12, portZ - .016), new T.Vector3(gx, fy + .03, portZ - .012), new T.Vector3(gx, fy - .02, portZ - .012)];
        const c = new T.Mesh(G(new T.TubeGeometry(supportedCurve(new T.CatmullRomCurve3(pts, false, 'centripetal'), a.userData.radius), 200, a.userData.radius, 8, false)), i === 2 ? blackPlastic : rubber);
        c.name = 'CABLE_rear-' + i; c.castShadow = c.receiveShadow = true; cableGroup.add(c);
      });
      const rC = .0058, base = new T.CatmullRomCurve3([kb, new T.Vector3(kb.x, desk + .004, kb.z - .03), new T.Vector3((kb.x + kp.x) / 2 - .05, desk + .0025, (kb.z + kp.z) / 2 + .02), new T.Vector3(kp.x - .045, desk + .0025, kp.z + .03), new T.Vector3(kp.x - .012, kp.y, kp.z), kp], false, 'centripetal');
      const coil = new Coil(base, .16, .66, rC, Math.round(base.getLength() * .5 / .0058));
      const k = new T.Mesh(G(new T.TubeGeometry(supportedCurve(coil, .0021), 1400, .0021, 8, false)), sleeve); k.name = 'CABLE_keyboard-coil'; k.castShadow = k.receiveShadow = true; cableGroup.add(k);
      const side = Math.sign(mp.x - mn.x) || 1, mid = new T.Vector3((mn.x + mp.x) / 2 + side * .03, desk + .002, (mn.z + mp.z) / 2 - .06);
      const mc = new T.CatmullRomCurve3([mn, new T.Vector3(mn.x, desk + .0022, mn.z - .035), mid, new T.Vector3(mp.x + .04, desk + .0022, mp.z + .02), new T.Vector3(mp.x + .01, mp.y, mp.z), mp], false, 'centripetal');
      const m = new T.Mesh(G(new T.TubeGeometry(supportedCurve(mc, .0018), 240, .0018, 8, false)), blackPlastic); m.name = 'CABLE_mouse'; m.castShadow = m.receiveShadow = true; cableGroup.add(m);
    }
    rebuildCables();

    // ---------- animation ----------
    const h1 = n => { const s = Math.sin(n * 91.7) * 43758.5453; return s - Math.floor(s); };
    function update(t) {
      if (disposed) return;
      crtUniforms.uTime.value = t;
      leds.forEach(l => {
        let v = 1;
        if (l.kind === 'PWR') v = 2.6; else if (l.kind === 'HDD') v = h1(Math.floor(t * 14)) > .55 ? 4 : .15; else if (l.kind === 'NET') v = (t % 1.6) < .08 || ((t % 1.6) > .16 && (t % 1.6) < .24) ? 4 : .2;
        else if (l.kind === 'LNK') v = 1.2 + 1.2 * Math.sin(t * 1.3); else if (l.kind === 'UP') v = (t % 3) < 2.4 ? 2.2 : .1; else if (l.kind === 'ANT') v = (t % 2) < .12 ? 6 : .05;
        else if (l.kind === 'CARD') v = 1.4 + .6 * Math.sin(t * .8); else if (l.kind === 'RING') v = 1.1 + .5 * Math.sin(t * .6); else if (l.kind === 'WHEEL') v = 1.8 + 1.2 * Math.sin(t * .9); else if (l.kind === 'DPI') v = 1.6;
        if (l.kind === 'OLED') { l.tex.offset.x = (t * .035) % 1; return; }
        l.mat.emissiveIntensity = v;
      });
    }
    update(0);
    // Retain an unbatched control for differential rendering/performance checks.
    if (options.batchStatic !== false) batchStaticParts([computer, keyboard, mouse, floorBox]);
    return {
      group, computer, keyboard, mouse, screen, floorBox, rebuildCables, setCableRoute, adoptScreen, update,
      getStats() { let tris = 0; group.traverse(o => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); }); return { meshes: (() => { let n = 0; group.traverse(o => { if (o.isMesh) n++; }); return n; })(), triangles: Math.round(tris), keys: keys.length }; },
      dispose() {
        if (disposed) return; disposed = true;
        // The desktop texture is shared with the scene's refresh loop and remains
        // caller-owned. Only resources generated by this workstation are retired.
        new Set(geoms).forEach(g => g.dispose()); new Set(mats).forEach(m => m.dispose()); new Set(texs).forEach(t => t.dispose());
        geoms.length = mats.length = texs.length = leds.length = 0;
        crtUniforms.map.value = null;
        if (group.parent) group.parent.remove(group); group.clear();
      }
    };
  }

  function replaceIn(T, model, ws) {
    model.updateMatrixWorld(true);
    const inv = new T.Matrix4().copy(model.matrixWorld).invert(), boxes = { COMPUTER_: new T.Box3(), KEYBOARD_: new T.Box3(), MOUSE_: new T.Box3() }, old = [];
    model.traverse(o => {
      if (!o.isMesh) return; const key = o.name.startsWith('SCREEN_SURFACE') ? 'COMPUTER_' : Object.keys(boxes).find(k => o.name.startsWith(k));
      if (key) { boxes[key].union(new T.Box3().setFromObject(o).applyMatrix4(inv)); old.push(o); }
    });
    old.forEach(o => { if (o.parent) o.parent.remove(o); });
    const place = (part, b) => { if (b.isEmpty()) return; const c = b.getCenter(new T.Vector3()); part.position.set(c.x, b.min.y, c.z); };
    place(ws.computer, boxes.COMPUTER_); place(ws.keyboard, boxes.KEYBOARD_); place(ws.mouse, boxes.MOUSE_);
    // Measure the actual tabletop and any raised mat, rather than flattening
    // all three devices to the terminal's bare-desk height.
    const fallbackDeskY = Math.min(...[ws.computer, ws.keyboard, ws.mouse].map(p => p.position.y));
    const deskBox = new T.Box3(), deskPieces = [];
    model.traverse(o => {
      if (o.isMesh && /^DESK_/i.test(o.name)) {
        const b = new T.Box3().setFromObject(o).applyMatrix4(inv), size = b.getSize(new T.Vector3());
        deskBox.union(b);
        if (size.y < .12 && b.max.y > fallbackDeskY - .1) deskPieces.push({ box: b, area: size.x * size.z });
      }
    });
    deskPieces.sort((a, b) => b.area - a.area);
    const tabletop = deskPieces[0] && deskPieces[0].box;
    const deskY = tabletop ? tabletop.max.y : fallbackDeskY;
    const planar = b => ({ minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z, topY: b.max.y });
    const surfaces = deskPieces.filter(p => p.box !== tabletop && p.box.max.y > deskY + .0005).map(p => planar(p.box));
    [ws.computer, ws.keyboard, ws.mouse].forEach(part => {
      let supportY = deskY;
      surfaces.forEach(s => {
        if (part.position.x >= s.minX && part.position.x <= s.maxX && part.position.z >= s.minZ && part.position.z <= s.maxZ) supportY = Math.max(supportY, s.topY);
      });
      part.position.y = supportY;
    });
    ws.group.position.set(0, 0, 0); model.add(ws.group);
    // GLTF meshes may share geometry, materials and texture atlases with the
    // retained room. Dispose only resources exclusive to the removed objects.
    function resources(objects) {
      const found = { geometries: new Set(), materials: new Set(), textures: new Set() };
      const texture = value => {
        if (value && value.isTexture) found.textures.add(value);
        else if (Array.isArray(value)) value.forEach(texture);
      };
      objects.forEach(object => object.traverse(node => {
        if (node.geometry) found.geometries.add(node.geometry);
        [].concat(node.material || []).forEach(material => {
          found.materials.add(material); Object.values(material).forEach(texture);
          Object.values(material.uniforms || {}).forEach(uniform => texture(uniform.value));
        });
      }));
      return found;
    }
    const retired = resources(old), retained = resources([model]);
    Object.keys(retired).forEach(kind => retired[kind].forEach(resource => {
      if (!retained[kind].has(resource)) resource.dispose();
    }));
    ws.setCableRoute({ deskEdgeZ: tabletop ? tabletop.min.z : deskBox.isEmpty() ? ws.computer.position.z - .3 : deskBox.min.z, deskY, deskBounds: tabletop ? planar(tabletop) : null, surfaces, deskThickness: tabletop ? tabletop.max.y - tabletop.min.y : .04, floorY: 0 });
    return { removed: old.length, footprints: boxes, deskEdgeZ: tabletop ? tabletop.min.z : deskBox.isEmpty() ? null : deskBox.min.z, deskY, surfaces };
  }
  window.PenthouseWorkstation = { create, replaceIn };
}());
