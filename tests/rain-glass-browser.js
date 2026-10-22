/* GPU coverage for the actual wet-glass panes and scene-capture path.
 * Run via shader-finiteness.cjs --suite rain-glass. Reads linear HDR pixels,
 * checks raw and composited output, and verifies motion/frozen/fade controls.
 */
(async function () {
  const report = { suite: 'rain-glass', tests: [], cases: [], errors: [] };
  const check = (name, pass) => report.tests.push({ name, pass });
  try {
    const T = THREE, width = 384, height = 256, count = width * height;
    const response = await fetch('/shared/penthouse-weather.js');
    if (!response.ok) throw Error('Cannot load production weather source');
    const source = await response.text();
    Function(source)();
    report.productionSHA256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source))), x => x.toString(16).padStart(2, '0')).join('');
    const renderer = new T.WebGLRenderer({ antialias: false, alpha: false });
    renderer.setSize(width, height); renderer.toneMapping = T.NoToneMapping; renderer.outputEncoding = T.LinearEncoding;
    document.body.append(renderer.domElement);
    const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
    report.gpu = { renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
      webgl2: renderer.capabilities.isWebGL2, fragmentFloatPrecision: gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT).precision };
    const target = new T.WebGLRenderTarget(width, height, { type: T.FloatType, format: T.RGBAFormat,
      minFilter: T.NearestFilter, magFilter: T.NearestFilter, depthBuffer: true, stencilBuffer: false });
    target.texture.encoding = T.LinearEncoding;
    const weather = window.PenthouseWeather.create(T, { quality: { captureScale: 1, captureMaxWidth: width } });
    weather.resize(width, height); weather.setMood('night');
    const panes = weather.group.children.filter(n => n.name.startsWith('Rain beads'));
    // Isolate the real wet-glass materials. Exterior rain is covered by the
    // production scene; otherwise its motion would defeat the frozen control.
    weather.group.children.forEach(n => { if (!panes.includes(n)) n.visible = false; });
    const scene = new T.Scene(); scene.add(weather.group);
    const backdropMaterial = new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, toneMapped: false,
      vertexShader: 'varying vec3 vWorld;void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}',
      fragmentShader: 'varying vec3 vWorld;void main(){vec3 d=normalize(vWorld-cameraPosition);float a=step(.7,fract(atan(d.z,d.x)*34.));float b=step(.72,fract(d.y*31.));vec3 c=vec3(.025,.05,.09)+vec3(3.8,.35,.9)*a+vec3(.1,3.4,4.2)*b;gl_FragColor=vec4(c,1.);}' });
    const backdrop = new T.Mesh(new T.SphereGeometry(100, 16, 12), backdropMaterial); scene.add(backdrop);
    const pixels = new Float32Array(count * 4), bits = new Uint32Array(pixels.buffer);
    const views = [
      { name: 'front-macro', position: [.18, 6.13, -7.714], target: [.18, 6.13, -7.974] },
      { name: 'front-oblique', position: [.5, 6.13, -7.714], target: [.18, 6.13, -7.974] },
      { name: 'left-macro', position: [-13.714, 6.57, 6.82], target: [-13.974, 6.57, 6.82] },
      { name: 'right-macro', position: [13.714, 6.27, 7.18], target: [13.974, 6.27, 7.18] }
    ];
    function cameraFor(view) {
      const camera = new T.PerspectiveCamera(view.fov || 52, width / height, .005, 500);
      camera.position.fromArray(view.position); camera.lookAt(new T.Vector3(...view.target)); camera.updateMatrixWorld(true); return camera;
    }
    function render(camera) {
      renderer.setRenderTarget(target); renderer.setClearColor(new T.Color(.03125, .0625, .125), 1);
      renderer.clear(); renderer.render(scene, camera); renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
      const error = gl.getError(); if (error) report.errors.push({ error });
    }
    function dry(camera) {
      panes.forEach(p => p.visible = false); render(camera); const result = pixels.slice(); panes.forEach(p => p.visible = true); return result;
    }
    function draw(camera, view, time, runRate, impactRate, mode, background) {
      weather.update(time); weather.setGlassTest({ runRate, impactRate });
      panes.forEach(p => { p.material.blending = mode === 'raw' ? T.NoBlending : T.NormalBlending; });
      render(camera);
      let invalidPixels = 0, changedPixels = 0, maximum = 0, fingerprint = 2166136261;
      for (let i = 0; i < count; i++) {
        const j = i * 4;
        if (!Number.isFinite(pixels[j]) || !Number.isFinite(pixels[j + 1]) || !Number.isFinite(pixels[j + 2]) || !Number.isFinite(pixels[j + 3])) invalidPixels++;
        if (pixels[j] !== background[j] || pixels[j + 1] !== background[j + 1] || pixels[j + 2] !== background[j + 2] || pixels[j + 3] !== background[j + 3]) changedPixels++;
        maximum = Math.max(maximum, pixels[j], pixels[j + 1], pixels[j + 2]);
        for (let k = 0; k < 4; k++) fingerprint = Math.imul(fingerprint ^ bits[j + k], 16777619) >>> 0;
      }
      const result = { view, time, runRate, impactRate, mode, pixels: count, invalidPixels, changedPixels, maximum, fingerprint };
      report.cases.push(result); return result;
    }
    for (const view of views) {
      const camera = cameraFor(view), background = dry(camera);
      weather.capture(renderer, scene, camera);
      check(view.name + ': close-up uses a matching scene capture', panes[0].material.uniforms.uCaptured.value === 1);
      check(view.name + ': capture retains HDR highlights', panes[0].material.uniforms.uScene.value.type === T.HalfFloatType);
      for (const mode of ['raw', 'composited']) for (const runRate of [0, 1, 2.5]) for (const time of [0, 3.7, 18.2]) {
        draw(camera, view.name, time, runRate, 1, mode, background);
      }
      draw(camera, view.name, .17, 0, 0, 'composited', background); const frozen = pixels.slice();
      draw(camera, view.name, 91.4, 0, 0, 'composited', background);
      check(view.name + ': zero run/arrival rates freeze the complete wet-glass image', pixels.every((value, i) => Object.is(value, frozen[i])));
      const alternate = camera.clone();
      render(alternate);
      check(view.name + ': a different camera suppresses captured-pane output', pixels.every((value, i) => Object.is(value, background[i])));
    }
    for (const view of [
      { name: 'distance-fade', position: [0, 6.4, 12.026], target: [0, 6.4, -7.974], fov: 10 },
      { name: 'grazing-fade', position: [8, 6.4, -7.75], target: [0, 6.4, -7.974], fov: 1 }
    ]) {
      const camera = cameraFor(view), background = dry(camera); weather.capture(renderer, scene, camera);
      const result = draw(camera, view.name, 18.2, 1, 1, 'composited', background);
      check(view.name + ': invisible glass leaves the HDR background unchanged', result.changedPixels === 0);
    }
    const close = report.cases.filter(c => views.some(v => v.name === c.view));
    check('Every raw and composited wet-glass sample is finite', report.cases.every(c => c.invalidPixels === 0));
    check('Every macro view renders visible wet glass', views.every(v => close.some(c => c.view === v.name && c.changedPixels > 10)));
    check('The runner-speed hook changes the actual GPU image', views.some(v => {
      const a = close.find(c => c.view === v.name && c.time === 18.2 && c.runRate === 0 && c.mode === 'composited');
      const b = close.find(c => c.view === v.name && c.time === 18.2 && c.runRate === 2.5 && c.mode === 'composited');
      return a.fingerprint !== b.fingerprint;
    }));
    check('The default animation changes over time', views.some(v => {
      const a = close.find(c => c.view === v.name && c.time === 0 && c.runRate === 1 && c.mode === 'composited');
      const b = close.find(c => c.view === v.name && c.time === 18.2 && c.runRate === 1 && c.mode === 'composited');
      return a.fingerprint !== b.fingerprint;
    }));
    check('The target contains values above SDR white', close.some(c => c.maximum > 1));
    check('No WebGL errors', report.errors.length === 0);
    report.pass = report.tests.every(t => t.pass);
    renderer.setRenderTarget(null); weather.dispose(); backdrop.geometry.dispose(); backdropMaterial.dispose(); target.dispose(); renderer.dispose();
  } catch (error) { report.error = String(error.stack || error); report.pass = false; }
  document.getElementById('shader-report').textContent = JSON.stringify(report, null, 2);
  document.body.dataset.probePass = String(report.pass); document.body.dataset.probeReady = 'true';
})();
