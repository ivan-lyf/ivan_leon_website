/* Conservative wet-glass capture regression against the actual weather module.
 * Run: node tests/weather-capture.cjs
 * Rendering remains a browser check; these tests exercise the real panes and
 * capture state, including a dense independent screen-visible sample oracle.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const T = require('../shared/vendor/three.min.js');
const context = vm.createContext({ window: {}, innerWidth: 1440, innerHeight: 900 });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../shared/penthouse-weather.js'), 'utf8'), context);
const weather = context.window.PenthouseWeather.create(T, { lite: false });
const scene = new T.Scene();
scene.add(weather.group);
const panes = weather.group.children.filter(m => m.name.startsWith('Rain beads'));
assert.equal(panes.length, 3);
assert.equal(panes[0].material.uniforms.uRunRate.value, 1, 'Runner speed defaults to the authored rhythm');
assert(panes.every(p => p.material.uniforms.uRunRate === panes[0].material.uniforms.uRunRate), 'All three panes share live runner-speed state');
for (const lite of [false, true]) for (const rate of [0, .35, 2.5]) {
  const configured = context.window.PenthouseWeather.create(T, { lite, quality: { runRate: rate } });
  const glazing = configured.group.children.filter(m => m.name.startsWith('Rain beads'));
  assert(glazing.every(p => p.material.uniforms.uRunRate.value === rate), 'quality.runRate must preserve zero and custom speeds in both quality modes');
  configured.setGlassTest({ impactRate: .4 }); configured.update(12.7);
  assert(glazing.every(p => p.material.uniforms.uRunRate.value === rate), 'Time and arrival-rate changes must not reset runner speed');
  configured.setGlassTest({ runRate: 1.75 });
  assert(glazing.every(p => p.material.uniforms.uRunRate.value === 1.75), 'The test hook updates every pane');
  assert(glazing.every(p => p.material.uniforms.uImpactRate.value === .4), 'Runner speed is independent of arrival frequency');
  const fallingRain = configured.group.children.find(m => m.name.startsWith('World-space'));
  assert.equal(fallingRain.material.uniforms.uRunRate, undefined, 'Changing glass runners must not change exterior rainfall');
  configured.dispose();
}

const excluded = new T.Mesh(new T.PlaneGeometry(), new T.MeshBasicMaterial());
scene.add(excluded);
const originalTarget = {};
const renderer = {
  capabilities: { isWebGL2: true }, extensions: { has: () => true },
  xr: { enabled: true }, shadowMap: { autoUpdate: true, needsUpdate: true },
  toneMapping: T.ACESFilmicToneMapping, outputEncoding: T.sRGBEncoding,
  target: originalTarget, renders: 0, fail: false,
  getRenderTarget() { return this.target; },
  setRenderTarget(target) { this.target = target; },
  getDrawingBufferSize(v) { return v.set(2304, 1440); },
  clear() {},
  render(renderedScene, camera) {
    this.renders++;
    assert.equal(renderedScene, scene);
    assert(camera.isCamera);
    assert(panes.every(p => !p.visible), 'The capture must omit wet panes');
    assert.equal(excluded.visible, false, 'The floor reflection must stay excluded');
    assert.equal(this.shadowMap.autoUpdate, false);
    assert.equal(this.shadowMap.needsUpdate, false);
    assert.equal(this.xr.enabled, false);
    assert.equal(this.toneMapping, T.NoToneMapping);
    assert.equal(this.outputEncoding, T.LinearEncoding);
    if (this.fail) throw new Error('capture test failure');
  }
};
function cameraAt(position, target, aspect = 1.6) {
  const c = new T.PerspectiveCamera(52, aspect, .1, 4000);
  c.position.fromArray(position);
  c.lookAt(new T.Vector3(...target));
  // Deliberately do not update matrices here: capture is called before render.
  return c;
}
function checkRestore() {
  assert.equal(renderer.target, originalTarget);
  assert.equal(renderer.xr.enabled, true);
  assert.equal(renderer.shadowMap.autoUpdate, true);
  assert.equal(renderer.shadowMap.needsUpdate, true);
  assert.equal(renderer.toneMapping, T.ACESFilmicToneMapping);
  assert.equal(renderer.outputEncoding, T.sRGBEncoding);
  assert.equal(excluded.visible, true);
}
function capture(c) {
  const before = renderer.renders;
  weather.capture(renderer, scene, c, [excluded]);
  checkRestore();
  return renderer.renders - before;
}
const views = {
  room: [[9.7, 6.8, 16.4], [-3.5, 4.9, -5.5]],
  desk: [[.8, 5.4, 7.6], [-3.2, 3.4, -.3]],
  city: [[3, 5.4, -4.3], [0, 5.8, -33]]
};
for (const aspect of [16 / 9, 16 / 10, 1, 9 / 16]) {
  assert.equal(capture(cameraAt(...views.room, aspect)), 0, 'Room panes beyond the shader fade must not trigger a scene capture');
  assert.equal(capture(cameraAt(...views.desk, aspect)), 1, 'Desk view can still contain faint wet glass');
  assert.equal(capture(cameraAt(...views.city, aspect)), 1, 'Close city view must keep its refracted rain');
}
const camera = cameraAt(...views.city);
assert.equal(capture(camera), 1);
assert.equal(capture(camera), 1, 'Moving city content requires a fresh capture even with a stationary camera');
camera.position.fromArray(views.room[0]); camera.lookAt(new T.Vector3(...views.room[1]));
assert.equal(capture(camera), 0, 'A reused camera must be re-evaluated after moving');
assert.equal(panes[0].material.uniforms.uCaptured.value, 0, 'An unused capture must not remain valid');
const reflectionCamera = camera.clone();
for (const pane of panes) {
  pane.onBeforeRender(renderer, scene, reflectionCamera);
  assert.equal(pane.material.uniforms.uViewValid.value, 0, 'A skipped primary capture must not enable wet panes in a virtual reflection');
  pane.onBeforeRender(renderer, scene, camera);
  assert.equal(pane.material.uniforms.uViewValid.value, 1, 'The primary camera remains eligible after a distant-pane skip');
}

weather.resize(900, 1440); camera.aspect = 900 / 1440; camera.updateProjectionMatrix();
camera.position.fromArray(views.city[0]); camera.lookAt(new T.Vector3(...views.city[1]));
assert.equal(capture(camera), 1, 'Resize and re-entry must recapture before wet glass appears');
weather.group.visible = false;
assert.equal(capture(camera), 0);
assert.equal(panes[0].material.uniforms.uCaptured.value, 0, 'Hidden weather invalidates its old capture');
weather.group.visible = true;
assert.equal(capture(camera), 1);
weather.setGlassTest({ visible: false });
assert.equal(capture(camera), 0, 'Hidden panes do not consume a background capture');
weather.setGlassTest({ visible: true });
assert.equal(capture(camera), 1);
for (const runRate of [0, .5, 2.25]) {
  weather.setGlassTest({ runRate }); weather.update(17.3);
  assert.equal(capture(camera), 1, 'Static or fast runners retain close-up background refraction');
  assert.equal(capture(cameraAt(...views.room)), 0, 'Runner speed must not disable the distant-pane capture optimization');
}
weather.setGlassTest({ runRate: 1 });
for (const [position, target] of [
  [[-13, 6, 7], [-15, 6, 7]], [[13, 6, 7], [15, 6, 7]],
  [[0, 12, -6.7], [0, 12, -10]], [[0, 1.2, -6.7], [0, 1.2, -10]]
]) assert.equal(capture(cameraAt(position, target)), 1, 'Close front and side panes must retain capture');
assert.equal(capture(cameraAt([0, 6.4, -7.974 + 4.11 * 4], [0, 6.4, -8], .2)), 1, 'A conservative margin must retain the fade boundary');
assert.equal(capture(cameraAt([0, 6.4, -7.974 + 4.14 * 4], [0, 6.4, -8], .2)), 0, 'Clearly distant front-only glass does not need capture');
weather.setGlassTest({ beadFadeEnd: 8 });
assert.equal(capture(cameraAt(...views.room)), 1, 'Custom quality ranges must be respected');
weather.setGlassTest({ beadFadeEnd: 4.1 });
// Independent reference: sample real pane surfaces and check projected screen
// visibility + the shader's distance/incidence predicate, not the cull algorithm.
const sample = new T.Vector3(), projected = new T.Vector3(), delta = new T.Vector3();
function containsVisibleSample(c) {
  c.updateMatrixWorld(true); weather.group.updateMatrixWorld(true);
  const worldCamera = new T.Vector3().setFromMatrixPosition(c.matrixWorld);
  for (const p of panes) {
    const box = p.geometry.boundingBox || (p.geometry.computeBoundingBox(), p.geometry.boundingBox);
    const u = p.material.uniforms;
    for (let x = 0; x <= 24; x++) for (let y = 0; y <= 16; y++) {
      sample.set(T.MathUtils.lerp(box.min.x, box.max.x, x / 24), T.MathUtils.lerp(box.min.y, box.max.y, y / 16), 0).applyMatrix4(p.matrixWorld);
      delta.subVectors(worldCamera, sample);
      const distance = delta.length() / 4, incidence = Math.abs(delta.normalize().dot(u.uPaneNormal.value));
      const visibility = (1 - T.MathUtils.smoothstep(distance, u.uBeadDistance.value.x, u.uBeadDistance.value.y)) * T.MathUtils.smoothstep(incidence, .15, .52);
      if (visibility < .003) continue;
      projected.copy(sample).applyMatrix4(c.matrixWorldInverse);
      if (projected.z >= -.1) continue;
      projected.copy(sample).project(c);
      if (Math.abs(projected.x) < .999 && Math.abs(projected.y) < .999 && projected.z >= -1 && projected.z <= 1) return true;
    }
  }
  return false;
}
let sampled = 0, visible = 0, skipped = 0;
for (const aspect of [16 / 9, 16 / 10, 1, 9 / 16]) {
  weather.resize(Math.round(aspect * 900), 900);
  for (const target of Object.values(views).map(v => v[1])) {
    for (const theta of [-.65, -.3, 0, .4, .85]) for (const phi of [.34, .43, .53]) for (const distance of [4, 16, 32]) {
      const position = new T.Vector3().setFromSpherical(new T.Spherical(distance, phi * Math.PI, theta)).add(new T.Vector3(...target));
      position.x = T.MathUtils.clamp(position.x, -13.3, 13.3);
      position.y = T.MathUtils.clamp(position.y, 1.2, 12);
      position.z = T.MathUtils.clamp(position.z, -6.8, 20.5);
      const c = cameraAt(position.toArray(), target, aspect);
      const shouldKeep = containsVisibleSample(c), result = capture(c);
      sampled++; visible += Number(shouldKeep); skipped += Number(result === 0);
      if (shouldKeep) assert.equal(result, 1, 'An on-screen shader-visible pane sample must never be culled: ' + JSON.stringify({ aspect, target, theta, phi, distance }));
    }
  }
}
assert(visible > 100 && skipped > 10, 'The sweep must cover close glass and useless distant captures');
// Renderer failures must continue to restore all shared state and visibility.
renderer.fail = true;
assert.throws(() => capture(cameraAt(...views.city)), /capture test failure/);
renderer.fail = false; checkRestore(); assert(panes.every(p => p.visible));
weather.dispose(); excluded.geometry.dispose(); excluded.material.dispose();
console.log('Weather capture: runner defaults/quality/live updates, room/desk/city, reuse/resize/hide, boundary and custom range, ' + sampled + ' orbit/aspect cases (' + visible + ' independently visible), renderer restoration passed.');
