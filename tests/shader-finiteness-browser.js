/* GPU regression for the production HDR-transparent shaders.
 * Run through shader-finiteness.cjs. Controlled varyings isolate each domain.
 * Invalid UVs model the tiny negative interpolation error at a cone boundary.
 */
(async function () {
  const report = { tests: [], cases: [], errors: [] };
  const check = (name, pass) => report.tests.push({ name, pass });
  try {
    const T = THREE, size = 256, count = size * size;
    const sources = await Promise.all(['/shared/penthouse-traffic.js', '/shared/penthouse-whale.js'].map(async url => {
      const response = await fetch(url);
      if (!response.ok) throw Error('Cannot read production source: ' + url);
      return response.text();
    }));
    const beamMatch = sources[0].match(/fragmentShader:'([^']*float alpha=[^']*)'/);
    const whaleMatch = sources[1].match(/var fragment = (\[[\s\S]*?\])\.join\('\\n'\);/);
    if (!beamMatch || !whaleMatch) throw Error('Production fragment extraction failed; update the test for the source structure.');
    const beam = beamMatch[1], whale = Function('return ' + whaleMatch[1])().join('\n');
    const beamAlpha = beam.match(/float alpha=(.*)\*pow\(face,\.7\)\*\.029;/);
    const whaleRim = whale.match(/float rim=([^;]+);/);
    if (!beamAlpha || !whaleRim) throw Error('Expected exactly the production beam alpha and whale rim expressions.');
    const beamOld = 'pow(vUv.y,1.8)', beamSafe = 'pow(max(0.,vUv.y),1.8)';
    const whaleOld = 'pow(1.-abs(dot(n,normalize(vView))),2.1)';
    const whaleSafe = 'pow(max(0.,1.-abs(dot(n,normalize(vView)))),2.1)';
    const variants = {
      beam: [
        ['current', beam],
        ['guarded-control', beam.replace(beamAlpha[1], beamSafe)],
        ['mutation-control', beam.replace(beamAlpha[1], beamOld)]
      ],
      whale: [
        ['current', whale],
        ['guarded-control', whale.replace(whaleRim[1], whaleSafe)],
        ['mutation-control', whale.replace(whaleRim[1], whaleOld)]
      ]
    };
    const hash = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), x => x.toString(16).padStart(2, '0')).join('');
    report.production = {
      beamSHA256: await hash(beam), whaleSHA256: await hash(whale),
      beamPower: beamAlpha[1], whaleRim: whaleRim[1],
      sampleCountPerCase: count
    };
    const renderer = new T.WebGLRenderer({ antialias: false, alpha: false });
    renderer.setSize(size, size); renderer.toneMapping = T.NoToneMapping; renderer.outputEncoding = T.LinearEncoding;
    document.body.append(renderer.domElement);
    const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
    report.gpu = {
      renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
      webgl2: renderer.capabilities.isWebGL2,
      fragmentFloatPrecision: gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT).precision
    };
    const target = new T.WebGLRenderTarget(size, size, {
      type: T.FloatType, format: T.RGBAFormat, minFilter: T.NearestFilter, magFilter: T.NearestFilter,
      depthBuffer: false, stencilBuffer: false
    });
    const position = new Float32Array(count * 3), normal = new Float32Array(count * 3), view = new Float32Array(count * 3), uv = new Float32Array(count * 2);
    let seed = 6789;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < count; i++) {
      position[i * 3] = (i % size + .5) / size * 2 - 1;
      position[i * 3 + 1] = (Math.floor(i / size) + .5) / size * 2 - 1;
      for (let c = 0; c < 3; c++) normal[i * 3 + c] = random() * 2 - 1;
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(position, 3));
    geometry.setAttribute('probeNormal', new T.BufferAttribute(normal, 3));
    const viewAttribute = new T.BufferAttribute(view, 3), uvAttribute = new T.BufferAttribute(uv, 2);
    geometry.setAttribute('probeView', viewAttribute); geometry.setAttribute('probeUV', uvAttribute);
    const vertices = {
      beam: 'attribute vec2 probeUV;varying vec2 vUv;varying vec3 vNormal,vWorld;void main(){vUv=probeUV;vNormal=vec3(0.,0.,1.);vWorld=vec3(0.);gl_Position=vec4(position,1.);gl_PointSize=1.;}',
      whale: 'attribute vec3 probeNormal,probeView;varying vec3 vBody,vNormal,vView;void main(){vNormal=probeNormal;vView=probeView;vBody=vec3(25.,.12,.1);gl_Position=vec4(position,1.);gl_PointSize=1.;}'
    };
    // vBody.x=25/time=0 keeps the separate whale sweep square base positive.
    const scene = new T.Scene(), camera = new T.Camera(), points = new T.Points(geometry);
    camera.position.set(0, 0, 10); points.frustumCulled = false; scene.add(points);
    function inputs(kind, mode) {
      for (let i = 0; i < count; i++) {
        if (kind === 'beam') {
          const negative = [-1e-12, -1e-10, -1e-9, -1e-8, -1e-7, -1e-6, -1e-5, -1e-4];
          uv[i * 2] = .5;
          uv[i * 2 + 1] = mode === 'negative-edge' ? negative[i % negative.length] : i / (count - 1);
        } else {
          const offset = i * 3, x = normal[offset], y = normal[offset + 1], z = normal[offset + 2];
          if (mode === 'oblique') { view[offset] = -y; view[offset + 1] = x; view[offset + 2] = 0; }
          else {
            const scale = mode === 'parallel' ? 1 : mode === 'antiparallel' ? -1 : 17.3;
            view[offset] = x * scale; view[offset + 1] = y * scale; view[offset + 2] = z * scale;
          }
        }
      }
      uvAttribute.needsUpdate = true; viewAttribute.needsUpdate = true;
    }
    function draw(kind, mode, label, fragment, additive) {
      inputs(kind, mode);
      const material = new T.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uGain: { value: 1 }, uLayer: { value: 0 } },
        vertexShader: vertices[kind], fragmentShader: fragment, depthTest: false, depthWrite: false,
        side: T.DoubleSide, transparent: true, blending: additive ? T.AdditiveBlending : T.NoBlending,
        extensions: { derivatives: true }, toneMapped: false
      });
      points.material = material; renderer.setRenderTarget(target);
      renderer.setClearColor(new T.Color(.03125, .0625, .125), 1); renderer.clear(); renderer.render(scene, camera);
      const pixels = new Float32Array(count * 4);
      renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
      let invalidPixels = 0, invalidRGBPixels = 0, firstInvalid = null, changedFromClear = 0;
      for (let i = 0; i < count; i++) {
        const offset = i * 4, rgba = pixels.subarray(offset, offset + 4);
        if (Array.from(rgba).some(value => !Number.isFinite(value))) {
          invalidPixels++;
          if (firstInvalid === null) firstInvalid = { pixel: i, uvY: kind === 'beam' ? uv[i * 2 + 1] : undefined, rgba: Array.from(rgba, value => Number.isFinite(value) ? value : String(value)) };
        }
        if (Array.from(rgba.subarray(0, 3)).some(value => !Number.isFinite(value))) invalidRGBPixels++;
        if (rgba[0] !== .03125 || rgba[1] !== .0625 || rgba[2] !== .125 || rgba[3] !== 1) changedFromClear++;
      }
      const error = gl.getError(); if (error) report.errors.push({ kind, mode, label, error });
      const summary = { kind, mode, label, blending: additive ? 'additive' : 'none', pixels: count, invalidPixels, invalidRGBPixels, changedFromClear, firstInvalid };
      report.cases.push(summary); material.dispose(); return { summary, pixels };
    }
    let unchangedBeamSamples = 0, unchangedWhaleSamples = 0;
    for (const mode of ['negative-edge', 'valid-range']) {
      for (const additive of [false, true]) {
        const results = variants.beam.map(([label, fragment]) => draw('beam', mode, label, fragment, additive));
        if (mode === 'valid-range') {
          const a = results[0].pixels, b = results[2].pixels;
          const equal = a.every((value, index) => Object.is(value, b[index]));
          check('Valid headlamp UV output is byte-equivalent to the original (' + (additive ? 'additive' : 'raw') + ')', equal);
          if (equal) unchangedBeamSamples += count;
        }
      }
    }
    for (const mode of ['parallel', 'antiparallel', 'scaled', 'oblique']) {
      const results = variants.whale.map(([label, fragment]) => draw('whale', mode, label, fragment, false));
      if (mode === 'oblique') {
        const equal = results[0].pixels.every((value, index) => Object.is(value, results[2].pixels[index]));
        check('Whale oblique control is byte-equivalent to the original', equal);
        if (equal) unchangedWhaleSamples += count;
      }
    }
    const cases = report.cases;
    check('Current production shaders are finite for every sample', cases.filter(x => x.label === 'current').every(x => x.invalidPixels === 0));
    check('Guarded controls are finite for every sample', cases.filter(x => x.label === 'guarded-control').every(x => x.invalidPixels === 0));
    check('Removing headlamp UV guard produces nonfinite alpha', cases.some(x => x.kind === 'beam' && x.mode === 'negative-edge' && x.label === 'mutation-control' && x.blending === 'none' && x.invalidPixels > 0));
    check('Headlamp NaN alpha contaminates the HDR additive RGB target', cases.some(x => x.kind === 'beam' && x.mode === 'negative-edge' && x.label === 'mutation-control' && x.blending === 'additive' && x.invalidRGBPixels > 0));
    check('Removing whale rim guard produces nonfinite output', cases.some(x => x.kind === 'whale' && x.label === 'mutation-control' && x.invalidPixels > 0));
    check('Ordinary UV and oblique controls remain finite', cases.filter(x => x.mode === 'valid-range' || x.mode === 'oblique').every(x => x.invalidPixels === 0));
    // A correctly clamped additive edge has zero alpha and intentionally leaves the clear color unchanged.
    check('Every raw draw changed the clear sentinel', cases.filter(x => x.blending === 'none').every(x => x.changedFromClear > 0));
    check('No WebGL errors', report.errors.length === 0);
    report.invariance = { unchangedBeamSamples, unchangedWhaleSamples };
    report.pass = report.tests.every(x => x.pass);
    renderer.setRenderTarget(null); target.dispose(); geometry.dispose(); renderer.dispose();
  } catch (error) { report.error = String(error.stack || error); report.pass = false; }
  document.getElementById('shader-report').textContent = JSON.stringify(report, null, 2);
  document.body.dataset.probePass = String(report.pass); document.body.dataset.probeReady = 'true';
})();
