// Run: node tests/workstation-batching.cjs
// Differential test of the real generated workstation, placement and animations.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), T = require(path.join(root, 'shared/vendor/three.min.js'));
function canvas() {
  const c = { width: 1, height: 1 }, gradient = () => ({ addColorStop() {} });
  c.getContext = () => new Proxy({ canvas: c, createLinearGradient: gradient, createRadialGradient: gradient,
    measureText: text => ({ width: String(text).length * 20 }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) },
  { get: (target, key) => key in target ? target[key] : () => {} });
  return c;
}
const context = { window: {}, document: { createElement: canvas }, console };
vm.runInNewContext(fs.readFileSync(path.join(root, 'shared/penthouse-workstation.js'), 'utf8'), context);
const api = context.window.PenthouseWorkstation;
const reference = api.create(T, { batchStatic: false }), optimized = api.create(T);
assert.equal(reference.getStats().meshes, 85, 'Unbatched control retains the authored workstation');
assert(optimized.getStats().meshes <= 53, 'Static workstation pieces must share draws (85 -> at most 53 meshes)');
assert.equal(optimized.getStats().triangles, reference.getStats().triangles, 'No geometry or detail was removed');
assert.equal(optimized.getStats().keys, 67);
const originalScreen = optimized.screen, originalCase = optimized.group.getObjectByName('KEYBOARD_case');
assert(optimized.group.getObjectByName('COMPUTER_heatsink-fins').isInstancedMesh, 'Keep fine slats on their original GPU transform path');

function room() {
  const model = new T.Group(); model.scale.setScalar(4); model.position.set(1, .2, -.4);
  const retainedMaterial = new T.MeshStandardMaterial({ color: 0x777777 });
  const add = (name, p, size, mat = retainedMaterial) => {
    const m = new T.Mesh(new T.BoxGeometry(...size), mat); m.name = name; m.position.fromArray(p); model.add(m); return m;
  };
  add('DESK_tabletop', [0, .74, 0], [1.8, .05, .85]);
  add('DESK_mousepad', [.1, .769, .12], [.75, .008, .4]);
  add('COMPUTER_old', [-.2, .925, -.14], [.31, .32, .32]);
  add('SCREEN_SURFACE_old', [-.2, 1, .02], [.22, .17, .002]);
  add('KEYBOARD_old', [-.16, .79, .2], [.326, .035, .124]);
  add('MOUSE_old', [.28, .79, .2], [.066, .035, .12]);
  return { model, retainedMaterial };
}
const referenceRoom = room(), optimizedRoom = room();
let retainedDisposals = 0;
optimizedRoom.retainedMaterial.addEventListener('dispose', () => retainedDisposals++);
const placedReference = api.replaceIn(T, referenceRoom.model, reference), placedOptimized = api.replaceIn(T, optimizedRoom.model, optimized);
assert.equal(placedOptimized.removed, 4);
assert.equal(placedOptimized.deskY, placedReference.deskY);
assert.equal(retainedDisposals, 0, 'Replacing the old devices must retain shared room materials');
assert.equal(optimized.screen, originalScreen);
assert.equal(optimized.group.getObjectByName('KEYBOARD_case'), originalCase);

function renderedTriangles(node) {
  const g = node.geometry, result = [], p = new T.Vector3(), normal = new T.Vector3(), instance = new T.Matrix4();
  for (let i = 0; i < (node.isInstancedMesh ? node.count : 1); i++) {
    let matrix = node.matrixWorld;
    if (node.isInstancedMesh) { node.getMatrixAt(i, instance); matrix = node.matrixWorld.clone().multiply(instance); }
    const normalMatrix = new T.Matrix3().getNormalMatrix(matrix);
    for (let j = 0; j < (g.index ? g.index.count : g.attributes.position.count); j++) {
      const k = g.index ? g.index.getX(j) : j;
      p.fromBufferAttribute(g.attributes.position, k).applyMatrix4(matrix);
      normal.fromBufferAttribute(g.attributes.normal, k).applyMatrix3(normalMatrix).normalize();
      result.push(p.x, p.y, p.z, normal.x, normal.y, normal.z, g.attributes.uv.getX(k), g.attributes.uv.getY(k));
    }
  }
  return result;
}
const materialState = material => {
  const result = { type: material.type, name: material.name };
  for (const key of ['color', 'emissive']) if (material[key]) result[key] = material[key].toArray();
  for (const key of ['roughness', 'metalness', 'emissiveIntensity', 'opacity', 'side', 'transparent', 'depthWrite', 'depthTest', 'toneMapped']) result[key] = material[key];
  for (const key of ['map', 'roughnessMap']) if (material[key]) {
    const t = material[key]; result[key] = [t.image.width, t.image.height, t.offset.x, t.offset.y, t.encoding, t.wrapS, t.wrapT, t.minFilter, t.anisotropy];
  }
  return result;
};
let comparedScalars = 0, maxError = 0;
function compareGeometry() {
  referenceRoom.model.updateMatrixWorld(true); optimizedRoom.model.updateMatrixWorld(true);
  const original = new Map(); reference.group.traverse(n => { if (n.isMesh) original.set(n.name, n); });
  const covered = new Set();
  optimized.group.traverse(node => {
    if (!node.isMesh) return;
    const names = node.userData.sourceNames || [node.name], expected = [];
    for (const name of names) {
      const source = original.get(name); assert(source, 'Every rendered part has an authored counterpart: ' + name);
      assert(!covered.has(name), 'No duplicated geometry: ' + name); covered.add(name);
      assert.deepEqual(materialState(node.material), materialState(source.material), 'Material identity and texture settings: ' + name);
      assert.equal(node.castShadow, source.castShadow); assert.equal(node.receiveShadow, source.receiveShadow);
      assert.equal(node.renderOrder, source.renderOrder);
      for (const scalar of renderedTriangles(source)) expected.push(scalar);
    }
    const actual = renderedTriangles(node); assert.equal(actual.length, expected.length, node.name);
    for (let i = 0; i < actual.length; i++) {
      const error = Math.abs(actual[i] - expected[i]); maxError = Math.max(maxError, error);
      assert(error < 2e-6, 'Changed position/normal/UV at ' + node.name + ': ' + error); comparedScalars++;
    }
    assert(/^(COMPUTER|KEYBOARD|MOUSE|CABLE|FLOORPORT)_|^SCREEN_SURFACE$/.test(node.name), 'Keep scene hotspot prefixes');
  });
  assert.equal(covered.size, original.size, 'Every authored mesh remains rendered');
}
compareGeometry();
// All triangle positions compare above, so true surface bounds are unchanged;
// additionally sample the real raycast path used by scene hover/click handlers.
let rayChecks = 0;
for (const key of ['computer', 'keyboard', 'mouse']) {
  const center = reference[key].getWorldPosition(new T.Vector3()).add(new T.Vector3(0, key === 'computer' ? .65 : .06, 0));
  for (const offset of [[0, 3, .1], [2, .3, .5], [-2, .2, .3], [0, .3, 3]]) {
    const origin = center.clone().add(new T.Vector3(...offset)), direction = center.clone().sub(origin).normalize();
    const ray = new T.Raycaster(origin, direction), a = ray.intersectObject(reference[key], true)[0], b = ray.intersectObject(optimized[key], true)[0];
    assert(a && b, 'Interaction ray intersects ' + key); assert(Math.abs(a.distance - b.distance) < 2e-6);
    assert(a.object.name.startsWith(key.toUpperCase() + '_') || a.object.name === 'SCREEN_SURFACE');
    assert(b.object.name.startsWith(key.toUpperCase() + '_') || b.object.name === 'SCREEN_SURFACE'); rayChecks++;
  }
}
// Rebuilding cables must replace their buffers without touching the static batches.
const batches = []; optimized.group.traverse(n => { if (n.userData.sourceNames) batches.push(n); });
const previousCables = []; optimized.group.traverse(n => { if (n.name.startsWith('CABLE_') && n.isMesh) previousCables.push(n); });
const cableDisposals = new Map(previousCables.map(n => [n.geometry, 0]));
for (const g of cableDisposals.keys()) g.addEventListener('dispose', () => cableDisposals.set(g, cableDisposals.get(g) + 1));
const route = { deskEdgeZ: -.46, floorY: 0, deskY: .765, surfaces: placedOptimized.surfaces };
reference.setCableRoute(route); optimized.setCableRoute(route);
for (const count of cableDisposals.values()) assert.equal(count, 1);
for (const batch of batches) assert(batch.parent, 'Cable rebuild leaves static geometry in place');
compareGeometry();

const desktop = new T.CanvasTexture({ width: 1024, height: 768 }); let desktopDisposals = 0;
desktop.addEventListener('dispose', () => desktopDisposals++);
assert(reference.adoptScreen(desktop)); assert(optimized.adoptScreen(desktop));
assert.equal(optimized.screen.material.uniforms.map.value, desktop);
for (const time of [0, .071, .21, 1.57, 4.11]) {
  reference.update(time); optimized.update(time);
  assert.equal(optimized.screen.material.uniforms.uTime.value, time);
  const source = new Map(); reference.group.traverse(n => { if (n.isMesh) source.set(n.name, n.material); });
  optimized.group.traverse(n => {
    if (!n.isMesh) return;
    for (const name of n.userData.sourceNames || [n.name]) assert.deepEqual(materialState(n.material), materialState(source.get(name)), 'Animation retained at ' + time + ': ' + name);
  });
}
desktop.image.width = 1280; optimized.screen.onBeforeRender();
assert.equal(optimized.screen.material.uniforms.texSize.value.x, 1280, 'Screen resize callback remains attached');
const disposals = new Map();
function track(resource) { if (!resource || disposals.has(resource)) return; disposals.set(resource, 0); resource.addEventListener('dispose', () => disposals.set(resource, disposals.get(resource) + 1)); }
optimized.group.traverse(n => { if (!n.isMesh) return; track(n.geometry); track(n.material); for (const value of Object.values(n.material)) if (value && value.isTexture && value !== desktop) track(value); });
const finalStats = optimized.getStats(); reference.dispose(); optimized.dispose(); optimized.dispose();
for (const count of disposals.values()) assert.equal(count, 1, 'Every owned live geometry/material/texture is disposed once');
for (const count of cableDisposals.values()) assert.equal(count, 1, 'Old cable buffers are not disposed twice');
assert.equal(desktopDisposals, 0, 'The caller retains ownership of its live desktop texture');
assert.equal(retainedDisposals, 0); assert.equal(optimized.group.parent, null); assert.equal(optimized.group.children.length, 0);
assert.equal(optimized.adoptScreen(desktop), false); optimized.update(10); optimized.rebuildCables();
console.log(JSON.stringify({ meshes: finalStats.meshes, triangles: finalStats.triangles, batches: batches.length, rayChecks, comparedScalars, maxWorldAttributeError: maxError }));
