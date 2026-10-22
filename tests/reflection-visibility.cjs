// Run: node tests/reflection-visibility.cjs
// Test the actual Reflector wrapper against independent homogeneous clipping.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), T = require(path.join(root, 'shared/vendor/three.min.js'));
const context = { THREE: T, window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'shared/vendor/Reflector.js'), 'utf8'), context);
vm.runInNewContext(fs.readFileSync(path.join(root, 'shared/penthouse-reflection-visibility.js'), 'utf8'), context);
const floor = new T.Reflector(new T.PlaneGeometry(27.8, 29.8), { clipBias: 0 });
floor.rotation.x = -Math.PI / 2; floor.position.set(0, .014, 7); floor.updateMatrixWorld(true);
const original = floor.onBeforeRender;
const scene = new T.Scene(); scene.add(floor);
let calls = 0, virtualCamera = null;
const target = {}, renderer = { outputEncoding: T.LinearEncoding, xr: { enabled: false }, shadowMap: { autoUpdate: false }, autoClear: true,
  getRenderTarget: () => target, setRenderTarget() {}, state: { buffers: { depth: { setMask() {} } }, viewport() {} },
  render(_scene, camera) { calls++; virtualCamera = camera.clone(); virtualCamera.projectionMatrix.copy(camera.projectionMatrix); }
};
function cameraAt(position, target, aspect = 1.6, fov = 52) {
  const c = new T.PerspectiveCamera(fov, aspect, .1, 4000); c.position.fromArray(position); c.lookAt(new T.Vector3(...target)); return c;
}
const room = [[9.7, 6.8, 16.4], [-3.5, 4.9, -5.5]], desk = [[.8, 5.4, 7.6], [-3.2, 3.4, -.3]], city = [[3, 5.4, -4.3], [0, 5.8, -33]];
const cityCamera = cameraAt(...city); cityCamera.updateMatrixWorld(true);
const sphereFrustum = new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(cityCamera.projectionMatrix, cityCamera.matrixWorldInverse));
assert(sphereFrustum.intersectsObject(floor), 'Positive control: the original bounding sphere admits the offscreen floor');
original.call(floor, renderer, scene, cityCamera); assert.equal(calls, 1, 'Positive control: unguarded Reflector renders the entire invisible scene');
const visibility = context.window.PenthouseReflectionVisibility.attach(T, floor);
assert.equal(visibility.isVisible(cityCamera), false);
floor.onBeforeRender(renderer, scene, cityCamera); assert.equal(calls, 1, 'The offscreen city view must skip its reflection capture');

// Clip homogeneous coordinates directly against +/-w, without constructing
// world frustum planes or using the production clipping code/margins.
function oracle(camera) {
  camera.updateWorldMatrix(true, false); floor.updateWorldMatrix(true, false);
  const matrix = new T.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(floor.matrixWorld);
  const p = floor.geometry.attributes.position, box = new T.Box3();
  for (let i = 0; i < p.count; i++) box.expandByPoint(new T.Vector3().fromBufferAttribute(p, i));
  let polygon = [[box.min.x, box.min.y], [box.max.x, box.min.y], [box.max.x, box.max.y], [box.min.x, box.max.y]]
    .map(([x, y]) => new T.Vector4(x, y, (box.min.z + box.max.z) / 2, 1).applyMatrix4(matrix));
  for (const [axis, sign] of [['x', 1], ['x', -1], ['y', 1], ['y', -1], ['z', 1], ['z', -1]]) {
    const result = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length], da = a.w + a[axis] * sign, db = b.w + b[axis] * sign;
      if (da >= 0) result.push(a);
      if ((da >= 0) !== (db >= 0)) result.push(a.clone().lerp(b, da / (da - db)));
    }
    polygon = result;
  }
  return polygon.length > 0;
}
const views = [room, desk, city, [[0, 12, 7], [0, 0, 3]], [[0, 12, 7], [0, 0, 7]], [[0, 1.2, 7], [0, .01, 3]]];
for (const target of [room[1], desk[1], city[1]]) for (const theta of [-.65, -.4, 0, .4, .85]) for (const phi of [.34, .4, .5, .53]) for (const distance of [4, 12, 24, 32]) {
  const p = new T.Vector3().setFromSpherical(new T.Spherical(distance, phi * Math.PI, theta)).add(new T.Vector3(...target));
  p.x = T.MathUtils.clamp(p.x, -13.3, 13.3); p.y = T.MathUtils.clamp(p.y, 1.2, 12); p.z = T.MathUtils.clamp(p.z, -6.8, 20.5);
  views.push([p.toArray(), target]);
}
for (const height of [1.2, 3, 6, 9, 12]) for (const angle of [1, 15, 30, 45, 60, 75, 89]) {
  const a = T.MathUtils.degToRad(angle); views.push([[0, height, 7], [0, height - Math.sin(a) * 4, 7 - Math.cos(a) * 4]]);
}
let visible = 0, skipped = 0, checked = 0;
for (const aspect of [16 / 9, 16 / 10, 1, 9 / 16]) for (const view of views) {
  const camera = cameraAt(...view, aspect), expected = oracle(camera), actual = visibility.isVisible(camera);
  if (expected) { assert(actual, 'A visible floor polygon must survive: ' + JSON.stringify({ aspect, view })); visible++; }
  else if (!actual) skipped++;
  checked++;
}
assert(visible > 500 && skipped > 100, 'The sweep covers both visible floors and genuinely offscreen captures');
for (const aspect of [16 / 9, 16 / 10, 1, 9 / 16]) assert.equal(visibility.isVisible(cameraAt(...city, aspect)), false);
for (const pose of [room, desk, [[0, 12, 7], [0, 0, 7]], [[0, 1.2, 7], [0, 0, 5]]]) {
  const camera = cameraAt(...pose); camera.updateMatrixWorld(true);
  original.call(floor, renderer, scene, camera); const expectedWorld = virtualCamera.matrixWorld.toArray(), expectedProjection = virtualCamera.projectionMatrix.toArray();
  const before = calls; floor.onBeforeRender(renderer, scene, camera); assert.equal(calls, before + 1);
  assert.deepEqual(virtualCamera.matrixWorld.toArray(), expectedWorld); assert.deepEqual(virtualCamera.projectionMatrix.toArray(), expectedProjection);
}
// A single reused camera must be re-evaluated on every call, even before render
// updates its matrix. Other cameras must not inherit a stale skipped result.
const reused = cameraAt(...city); assert.equal(visibility.isVisible(reused), false);
reused.position.fromArray(room[0]); reused.lookAt(new T.Vector3(...room[1])); assert.equal(visibility.isVisible(reused), true);
assert.equal(visibility.isVisible(cityCamera), false); assert.equal(visibility.isVisible(cameraAt(...desk)), true);
const orthographic = new T.OrthographicCamera(-12, 12, 10, -10, .1, 100); orthographic.position.set(0, 20, 7); orthographic.lookAt(0, 0, 7);
assert(oracle(orthographic)); assert(visibility.isVisible(orthographic));
// Parent transforms and fresh geometry buffers must update the footprint.
const parent = new T.Group(); scene.add(parent); parent.add(floor); parent.position.set(30, 0, 0);
assert.equal(visibility.isVisible(orthographic), false); parent.position.set(0, 0, 0); assert(visibility.isVisible(orthographic));
const position = floor.geometry.attributes.position, saved = position.array.slice();
for (let i = 0; i < position.count; i++) position.setX(i, position.getX(i) + 100); position.needsUpdate = true;
assert.equal(visibility.isVisible(orthographic), false);
position.array.set(saved); position.needsUpdate = true; assert(visibility.isVisible(orthographic));
// Uncertain/deformed surfaces and invalid projections retain the safe old path.
position.setZ(0, .1); position.needsUpdate = true; assert(visibility.isVisible(cityCamera));
position.array.set(saved); position.needsUpdate = true;
const bad = cameraAt(...city); bad.projectionMatrix.elements[0] = NaN; assert(visibility.isVisible(bad));
bad.projectionMatrix.elements.fill(0); assert(visibility.isVisible(bad));
assert(visibility.isVisible({}));
const savedGeometry = floor.geometry; floor.geometry = {}; assert(visibility.isVisible(cityCamera)); floor.geometry = savedGeometry;
floor.geometry.morphAttributes.position = [position]; assert(visibility.isVisible(cityCamera)); delete floor.geometry.morphAttributes.position; assert.equal(visibility.isVisible(cityCamera), false);
let callbackThis = null, callbackArgs = null;
visibility.dispose(); assert.equal(floor.onBeforeRender, original);
floor.onBeforeRender = function () { callbackThis = this; callbackArgs = Array.from(arguments); return 17; };
const wrapped = context.window.PenthouseReflectionVisibility.attach(T, floor), camera = cameraAt(...room), args = [renderer, scene, camera, 'geometry', 'material', 'group'];
assert.equal(floor.onBeforeRender(...args), 17); assert.equal(callbackThis, floor); assert.deepEqual(callbackArgs, args);
const anotherCallback = () => {}; floor.onBeforeRender = anotherCallback; wrapped.dispose(); assert.equal(floor.onBeforeRender, anotherCallback, 'Cleanup must not overwrite a newer callback');
floor.geometry.dispose(); floor.material.dispose(); floor.getRenderTarget().dispose();
console.log('PASS reflection visibility: ' + checked + ' poses/aspects, ' + visible + ' independently visible preserved, ' + skipped + ' offscreen captures skipped; original failure, virtual-camera equivalence, camera reuse, transforms, fallback and callback ownership verified.');
