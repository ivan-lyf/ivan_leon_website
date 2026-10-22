/* Real r128 Standard/Physical material regression for zero-light fast paths.
 * Run via shader-finiteness.cjs --suite lighting-optimization. Two renderers
 * compile independent baseline/optimized programs and read linear Float HDR.
 */
(async function () {
  const report = { suite: 'lighting-optimization', tests: [], cases: [], errors: [] };
  const check = (name, pass) => report.tests.push({ name, pass });
  const T = THREE, originalChunk = T.ShaderChunk.lights_physical_pars_fragment;
  const resources = [];
  try {
    for (const url of ['/shared/vendor/RectAreaLightUniformsLib.js', '/shared/penthouse-lighting-optimization.js']) {
      const response = await fetch(url);
      if (!response.ok) throw Error('Cannot load ' + url);
      const source = await response.text(); Function(source)();
      if (url.includes('optimization')) report.productionSHA256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source))), x => x.toString(16).padStart(2, '0')).join('');
    }
    T.RectAreaLightUniformsLib.init();
    const width = 384, height = 192, count = width * height;
    const cases = [
      { name: 'six-front', area: 4, direction: .4, point: 2 },
      { name: 'six-behind', area: 4, direction: .4, point: 2, behind: true },
      { name: 'area-zero', area: 0, direction: .4, point: 2 },
      { name: 'on-area-plane', area: 4, direction: .4, point: 2, boundary: true },
      { name: 'all-zero', area: 0, direction: 0, point: 0 },
      { name: 'point-outside-range', area: 0, direction: 0, point: 2, outside: true },
      { name: 'single-channel-panels', area: 2, direction: 0, point: 0, singleChannel: true },
      { name: 'direct-both-unlit', area: 0, direction: 1, point: 0, directionVector: [0, 0, -5] },
      { name: 'base-unlit-coat-lit', area: 0, direction: 1, point: 0, directionVector: [0, 8, -.5] },
      { name: 'base-lit-coat-unlit', area: 0, direction: 1, point: 0, directionVector: [0, -8, .5] },
      { name: 'clearcoat-zero', area: 4, direction: .4, point: 2, clearcoat: 0 },
      { name: 'front-restored', area: 4, direction: .4, point: 2 }
    ];
    const pixels = { baseline: [], optimized: [] };
    const colors = [0xffc89d, 0x8cc8ee, 0xd1a8e9, 0xffe0ab, 0x82decd, 0xe499be];
    const clearColor = new T.Color(.00390625, .0078125, .015625);
    function stats(data) {
      let invalid = 0, maximum = 0, energy = 0, drawn = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (![data[i], data[i + 1], data[i + 2], data[i + 3]].every(Number.isFinite)) invalid++;
        maximum = Math.max(maximum, data[i], data[i + 1], data[i + 2]);
        energy += data[i] + data[i + 1] + data[i + 2];
        if (data[i] !== clearColor.r || data[i + 1] !== clearColor.g || data[i + 2] !== clearColor.b) drawn++;
      }
      return { invalid, maximum, meanEnergy: energy / count, drawn };
    }
    function compare(a, b) {
      let maxAbsolute = 0, sum = 0, outsideTolerance = 0;
      for (let i = 0; i < a.length; i++) {
        const d = Math.abs(a[i] - b[i]); maxAbsolute = Math.max(maxAbsolute, d); sum += d;
        // HDR comparison: a small float-rounding allowance, not an 8-bit image
        // tolerance. The original irradiance and BRDF expressions stay intact.
        if (d > .00005 + Math.max(Math.abs(a[i]), Math.abs(b[i])) * .0002) outsideTolerance++;
      }
      return { maxAbsolute, meanAbsolute: sum / a.length, outsideTolerance };
    }
    for (const variant of ['baseline', 'optimized']) {
      T.ShaderChunk.lights_physical_pars_fragment = originalChunk;
      if (variant === 'optimized') {
        report.installation = window.PenthouseLightingOptimization.install(T);
        check('The optional optimization installs against the real vendor chunks', report.installation.installed && report.installation.changed);
      }
      const renderer = new T.WebGLRenderer({ antialias: false, alpha: false }); resources.push(renderer);
      renderer.setSize(width, height); renderer.toneMapping = T.NoToneMapping; renderer.outputEncoding = T.LinearEncoding;
      document.body.append(renderer.domElement);
      const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
      if (!report.gpu) report.gpu = { renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER), webgl2: renderer.capabilities.isWebGL2 };
      check(variant + ': floating-point color targets are supported', renderer.capabilities.isWebGL2 && !!gl.getExtension('EXT_color_buffer_float'));
      const target = new T.WebGLRenderTarget(width, height, { type: T.FloatType, format: T.RGBAFormat, minFilter: T.NearestFilter, magFilter: T.NearestFilter, depthBuffer: true, stencilBuffer: false }); resources.push(target);
      target.texture.encoding = T.LinearEncoding;
      // A real CubeUV environment compiles the exact r128 #define v1 macro
      // that previously collided with a copied LTC local variable name.
      const envScene = new T.Scene();
      const envGeometry = new T.SphereGeometry(8, 12, 8), envMaterial = new T.MeshBasicMaterial({ color: new T.Color(.07, .09, .12), side: T.BackSide });
      envScene.add(new T.Mesh(envGeometry, envMaterial));
      const generator = new T.PMREMGenerator(renderer), environment = generator.fromScene(envScene);
      resources.push(environment); generator.dispose(); envGeometry.dispose(); envMaterial.dispose();
      const scene = new T.Scene(); scene.environment = environment.texture;
      const camera = new T.PerspectiveCamera(43, width / height, .1, 40);
      camera.position.set(1.2, .8, 8); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
      const geometry = new T.PlaneGeometry(1.5, 2.1);
      const coatNormal = new T.DataTexture(new Uint8Array([128, 153, 250, 255]), 1, 1, T.RGBAFormat);
      coatNormal.needsUpdate = true;
      const materials = [
        new T.MeshStandardMaterial({ color: 0xaebdcc, metalness: .32, roughness: .48 }),
        new T.MeshPhysicalMaterial({ color: 0xb5a591, metalness: .18, roughness: .26, clearcoat: .9, clearcoatRoughness: .19, clearcoatNormalMap: coatNormal }),
        new T.MeshPhysicalMaterial({ color: 0x8daca2, metalness: .62, roughness: .36, clearcoat: 0, clearcoatRoughness: .3 })
      ];
      materials.forEach((material, i) => {
        material.envMapIntensity = .4;
        material.customProgramCacheKey = () => 'lighting-regression-' + variant + '-' + i;
        const mesh = new T.Mesh(geometry, material); mesh.position.x = (i - 1) * 1.8; scene.add(mesh);
      });
      const areas = Array.from({ length: 6 }, (_, i) => {
        const light = new T.RectAreaLight(colors[i], 4, 1.6, 1.2);
        light.position.set((i % 3 - 1) * 2.4, i < 3 ? 1.6 : -1.6, 2.8); scene.add(light); return light;
      });
      const direction = new T.DirectionalLight(0xc5d5ee, .4); direction.position.set(-2, 3, 5); scene.add(direction);
      const point = new T.PointLight(0xedb894, 2, 14); point.position.set(1.2, 1, 3); scene.add(point);
      for (const state of cases) {
        areas.forEach((light, i) => {
          light.position.z = state.boundary ? 0 : 2.8; light.rotation.y = state.behind ? Math.PI : 0;
          light.intensity = state.area; light.color.set(colors[i]);
          if (state.singleChannel) light.color.setRGB(i % 3 === 0 ? 1 : 0, i % 3 === 1 ? 1 : 0, i % 3 === 2 ? 1 : 0);
        });
        direction.intensity = state.direction; direction.position.fromArray(state.directionVector || [-2, 3, 5]); point.intensity = state.point;
        point.position.set(1.2, 1, state.outside ? 30 : 3); point.distance = state.outside ? 1 : 14;
        materials[1].clearcoat = state.clearcoat === undefined ? .9 : state.clearcoat;
        // Ensure the clearcoat-zero/restore pair also covers define/cache changes.
        materials[1].needsUpdate = true;
        renderer.setRenderTarget(target); renderer.setClearColor(clearColor, 1); renderer.clear(); renderer.render(scene, camera);
        const data = new Float32Array(count * 4); renderer.readRenderTargetPixels(target, 0, 0, width, height, data);
        pixels[variant].push(data);
        const summary = stats(data); report.cases.push({ variant, name: state.name, ...summary });
        check(variant + '/' + state.name + ': every HDR pixel is finite and geometry rendered', summary.invalid === 0 && summary.drawn > 5000);
        const error = gl.getError(); if (error) report.errors.push({ variant, name: state.name, error });
      }
      const physicalSources = renderer.info.programs.map(program => gl.getShaderSource(program.fragmentShader)).filter(source => source && source.includes('void RE_Direct_Physical'));
      const guarded = physicalSources.filter(source => source.includes('PENTHOUSE_ZERO_LIGHTS_V1')).length;
      check(variant + ': Standard and Physical programs compile independently', physicalSources.length >= 3);
      check(variant + ': correct shader variant actually compiled', variant === 'baseline' ? guarded === 0 : guarded === physicalSources.length);
      check(variant + ': CubeUV macro collision path compiled', physicalSources.some(source => /#define\s+v1\s+0\.276/.test(source)));
      report[variant + 'Programs'] = { physical: physicalSources.length, guarded };
      const index = name => cases.findIndex(c => c.name === name);
      const same = (a, b) => compare(pixels[variant][index(a)], pixels[variant][index(b)]).outsideTolerance === 0;
      check(variant + ': back-facing area lights equal switched-off area lights', same('six-behind', 'area-zero'));
      check(variant + ': out-of-range point light equals zero intensity', same('all-zero', 'point-outside-range'));
      check(variant + ': a directional light behind both normals adds no irradiance', same('all-zero', 'direct-both-unlit'));
      check(variant + ': a tilted coat stays lit when the base is unlit', compare(pixels[variant][index('base-unlit-coat-lit')], pixels[variant][index('all-zero')]).meanAbsolute > .0000001);
      check(variant + ': the base stays lit when its tilted coat is unlit', compare(pixels[variant][index('base-lit-coat-unlit')], pixels[variant][index('all-zero')]).meanAbsolute > .0000001);
      check(variant + ': restoring lights and clearcoat restores the image', same('six-front', 'front-restored'));
      check(variant + ': front-facing area lights visibly illuminate the surfaces', compare(pixels[variant][index('six-front')], pixels[variant][index('area-zero')]).meanAbsolute > .001);
      check(variant + ': clearcoat changes the rendered image', compare(pixels[variant][index('six-front')], pixels[variant][index('clearcoat-zero')]).meanAbsolute > .00001);
      materials.forEach(material => material.dispose()); coatNormal.dispose(); geometry.dispose();
      renderer.setRenderTarget(null); target.dispose(); environment.dispose(); renderer.dispose();
    }
    cases.forEach((state, i) => {
      const difference = compare(pixels.baseline[i], pixels.optimized[i]);
      report.cases.push({ comparison: state.name, ...difference });
      check(state.name + ': optimized linear HDR matches baseline', difference.outsideTolerance === 0);
    });
    check('No WebGL errors', report.errors.length === 0);
    report.pass = report.tests.every(test => test.pass);
  } catch (error) { report.error = String(error.stack || error); report.pass = false; }
  finally {
    T.ShaderChunk.lights_physical_pars_fragment = originalChunk;
    // dispose() is idempotent; this also releases resources after an early failure.
    resources.forEach(resource => resource.dispose());
  }
  document.getElementById('shader-report').textContent = JSON.stringify(report, null, 2);
  document.body.dataset.probePass = String(report.pass); document.body.dataset.probeReady = 'true';
})();
