/* Display-density regression checks against the real scene function seams.
 * Run: node tests/display-rendering.cjs
 * Uses bundled Three.js and EffectComposer targets; GPU rendering is covered
 * separately by REA captures of the complete scene.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const repo = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(repo, 'shared/penthouse-scene.js'), 'utf8');
const T = require(path.join(repo, 'shared/vendor/three.min.js'));
const vendor = vm.createContext({ THREE: T, console });
for (const name of ['CopyShader', 'EffectComposer', 'ShaderPass', 'RenderPass',
  'LuminosityHighPassShader', 'UnrealBloomPass', 'FXAAShader']) {
  vm.runInContext(fs.readFileSync(path.join(repo, 'shared/vendor', name + '.js'), 'utf8'), vendor);
}
function match(pattern, label) {
  const result = source.match(pattern);
  assert(result, 'Scene seam missing: ' + label);
  return result[1];
}
function functionSource(name) {
  const start = source.indexOf('  function ' + name + '(');
  assert(start >= 0, name + ' must exist');
  const end = source.indexOf('\n  }', start);
  assert(end >= 0, name + ' must have a top-level closing brace');
  return source.slice(start, end + 4);
}
const liteExpression = match(/const lite = ([^;]+);/, 'input quality tier');
const presets = match(/const presets = (\{[\s\S]*?\n  \});/, 'camera presets');
const rendererInitialSize = match(/renderer=new T\.WebGLRenderer\([^;]+;([\s\S]*?)hdrEnabled=/, 'initial renderer sizing');
const cameraInitialization = match(/(camera=new T\.PerspectiveCamera\([^;]+;const start=pose\('room'\);camera\.position\.copy\(start\.position\);)/, 'initial camera');
const resizeBody = match(/on\(window,'resize',\(\)=>\{([^\n]+)\}\);/, 'resize handler');
const funcs = ['renderPixelRatio', 'resizePostprocessing', 'buildPostprocessing', 'pose']
  .map(functionSource).join('\n');
function near(actual, expected, label) {
  assert(Math.abs(actual - expected) < 1e-10, label + ': ' + actual + ' vs ' + expected);
}
function make({ width = 2550, height = 1440, dpr = 1, coarse = false, cores = 8 } = {}) {
  const renderer = {
    ratio: 1, width, height, toneMappingExposure: .97,
    setSize(w, h) { this.width = w; this.height = h; },
    setPixelRatio(ratio) { this.ratio = ratio; },
    getPixelRatio() { return this.ratio; }
  };
  const sandbox = vm.createContext({
    T, console, innerWidth: width, innerHeight: height, devicePixelRatio: dpr,
    navigator: { hardwareConcurrency: cores },
    matchMedia: query => {
      assert.equal(query, '(pointer: coarse) and (hover: none)');
      return { matches: coarse };
    },
    renderer, scene: new T.Scene(), camera: null,
    composer: null, bloomPass: null, outputPass: null, fxaaPass: null,
    hdrEnabled: true, keyboardOutline: null, inComputer: false, flight: null,
    clearKeyboardFeedback() {},
    weather: { resize(w, h) { this.lastSize = [w, h]; } }
  });
  vm.runInContext('const lite=' + liteExpression + ';const presets=' + presets + ';\n' + funcs, sandbox);
  vm.runInContext(rendererInitialSize + '\n' + cameraInitialization + '\nbuildPostprocessing();', sandbox);
  return {
    sandbox, renderer,
    ratio: () => vm.runInContext('renderPixelRatio()', sandbox),
    lite: () => vm.runInContext('lite', sandbox),
    pose: name => vm.runInContext('pose(' + JSON.stringify(name) + ')', sandbox),
    resize(w, h, nextDpr = sandbox.devicePixelRatio) {
      Object.assign(sandbox, { innerWidth: w, innerHeight: h, devicePixelRatio: nextDpr });
      vm.runInContext(resizeBody, sandbox);
    },
    dispose() {
      const { composer, bloomPass, outputPass, fxaaPass } = sandbox;
      composer.renderTarget1.dispose(); composer.renderTarget2.dispose();
      composer.copyPass.material.dispose(); bloomPass.dispose();
      outputPass?.material.dispose(); fxaaPass?.material.dispose();
    }
  };
}
function aligned(instance, label) {
  const { sandbox: s, renderer: r } = instance;
  const target = s.composer.renderTarget1;
  near(r.ratio, instance.ratio(), label + ' renderer ratio');
  near(target.width, r.width * r.ratio, label + ' composer width');
  near(target.height, r.height * r.ratio, label + ' composer height');
  near(s.fxaaPass.uniforms.resolution.value.x, 1 / Math.floor(target.width), label + ' FXAA width');
  near(s.fxaaPass.uniforms.resolution.value.y, 1 / Math.floor(target.height), label + ' FXAA height');
  assert.equal(target.isWebGLMultisampleRenderTarget, undefined, label + ' uses the stable ordinary HDR target');
  assert.equal(target.texture.type, T.HalfFloatType, label + ' preserves HDR');
  assert.equal(target.texture.encoding, T.LinearEncoding, label + ' preserves linear scene rendering');
}

const cases = [
  { width: 2550, height: 1440, dpr: 1, expected: Math.sqrt(6000000 / (2550 * 1440)), label: 'Windows native density' },
  { width: 2040, height: 1152, dpr: 1.25, expected: 1.5, label: 'Windows 125 percent scaling' },
  { width: 1440, height: 900, dpr: 2, expected: 1.6, label: 'approved Mac Retina' },
  { width: 2550, height: 1440, dpr: 1.5, expected: 1.5, label: '150 percent remains unchanged' },
  { width: 3840, height: 2160, dpr: 1, expected: 1, label: 'native 4K never downsampled' },
  { width: 390, height: 844, dpr: 3, coarse: true, expected: 1.25, label: 'coarse mobile retains its cap' },
  { width: 390, height: 844, dpr: 1, coarse: true, expected: 1, label: 'coarse native retains its path' }
];
for (const test of cases) {
  const instance = make(test);
  near(instance.ratio(), test.expected, test.label);
  aligned(instance, test.label);
  if (!test.coarse && test.dpr < 1.5) {
    const nativePixels = test.width * test.height * test.dpr * test.dpr;
    const pixels = test.width * test.height * instance.ratio() * instance.ratio();
    assert(pixels <= Math.max(nativePixels, 6000000) + 1e-6, test.label + ' bounds additional pixels');
    assert(instance.ratio() >= test.dpr, test.label + ' preserves native density');
  }
  instance.dispose();
}

for (const cores of [2, 4, 8, 16]) {
  for (const width of [390, 699, 700, 1440, 2550]) {
    const instance = make({ width, height: 900, dpr: 2, cores });
    assert.equal(instance.lite(), false, 'Desktop tier is independent of starting width and CPU count');
    near(instance.ratio(), 1.6, 'Desktop Retina quality is stable');
    instance.dispose();
  }
}

const resizing = make({ width: 1440, height: 900, dpr: 2 });
const originalPose = resizing.pose('room');
assert.deepEqual(originalPose.position.toArray(), [9.7, 6.8, 16.4]);
assert.deepEqual(originalPose.target.toArray(), [-3.5, 4.9, -5.5]);
for (const step of [
  [2550, 1440, 1], [2040, 1152, 1.25], [1440, 900, 2],
  [500, 800, 1], [2550, 1440, 1], [3840, 2160, 1]
]) {
  resizing.resize(...step);
  aligned(resizing, 'resize ' + step.join('x'));
  const fresh = make({ width: step[0], height: step[1], dpr: step[2] });
  near(resizing.ratio(), fresh.ratio(), 'Fresh and resized sampling agree');
  assert.equal(resizing.sandbox.camera.fov, step[0] < 700 ? 58 : 52);
  assert.deepEqual(resizing.sandbox.camera.projectionMatrix.elements,
    fresh.sandbox.camera.projectionMatrix.elements, 'Fresh and resized projection agree');
  assert.deepEqual(resizing.pose('room').position.toArray(), fresh.pose('room').position.toArray(),
    'Authored camera pose selection agrees after resize');
  assert.deepEqual(resizing.sandbox.camera.position.toArray(), originalPose.position.toArray(),
    'Resizing must preserve the visitor camera position');
  fresh.dispose();
}
resizing.dispose();
console.log('PASS display rendering: 7 density cases; 20 desktop tier cases; 6 resize transitions; Retina path, 6MP budget, HDR targets, FXAA texel sizes and camera projections preserved.');
