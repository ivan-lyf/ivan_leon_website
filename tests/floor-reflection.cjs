/* Regression for the real floor-reflection clip plane.
 * Run: node tests/floor-reflection.cjs
 * Uses the shipped Three.js/Reflector and GLB geometry; no browser or packages.
 * This checks clipping math, while rendered appearance is verified in the browser.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repo = path.resolve(__dirname, '..');
const T = require(path.join(repo, 'shared/vendor/three.min.js'));
global.THREE = T;
global.window = {};
global.self = global;
for (const name of ['Reflector.js', 'GLTFLoader.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(repo, 'shared/vendor', name), 'utf8'));
}

function createReflector(biasOverride) {
  const source = fs.readFileSync(path.join(repo, 'shared/penthouse-scene.js'), 'utf8');
  const start = source.indexOf('  function buildFloorReflection()');
  const end = source.indexOf('  function buildCeilingLights()', start);
  assert(start >= 0 && end > start, 'The scene must expose its floor-reflection builder');
  let body = source.slice(start, end);
  if (biasOverride !== undefined) body = body.replace(/clipBias:\s*[.\d]+/, 'clipBias:' + biasOverride);
  const reflector = new Function('T', 'lite', 'hdrEnabled', 'scene',
    'let floorReflection;' + body + ';buildFloorReflection();return floorReflection;'
  )(T, false, true, new T.Scene());
  reflector.updateMatrixWorld(true);
  return reflector;
}

async function loadRoomGeometry() {
  const bytes = fs.readFileSync(path.join(repo, 'shared/assets/models/penthouse/penthouse-v2.glb'));
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const binStart = 20 + jsonLength;
  const bin = bytes.subarray(binStart + 8, binStart + 8 + bytes.readUInt32LE(binStart));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bin.toString('base64');
  // Keep actual vertex buffers, hierarchy and transforms, without loading images.
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) delete primitive.material;
  for (const key of ['materials', 'images', 'textures', 'samplers']) delete json[key];
  const gltf = await new Promise((resolve, reject) =>
    new T.GLTFLoader().parse(JSON.stringify(json), '', resolve, reject));
  gltf.scene.scale.setScalar(4);
  gltf.scene.updateMatrixWorld(true);
  return gltf.scene;
}

function reflectedCamera(reflector, camera) {
  let capture = null, renders = 0;
  const renderer = {
    outputEncoding: T.LinearEncoding,
    xr: { enabled: false },
    shadowMap: { autoUpdate: false },
    autoClear: true,
    getRenderTarget: () => null,
    setRenderTarget() {},
    state: { buffers: { depth: { setMask() {} } }, viewport() {} },
    render(_scene, view) {
      capture = view.clone();
      capture.projectionMatrix.copy(view.projectionMatrix);
      renders++;
    }
  };
  camera.updateMatrixWorld(true);
  reflector.onBeforeRender(renderer, new T.Scene(), camera);
  assert.equal(renders, 1, 'Above-floor cameras must produce a reflection capture');
  return capture;
}

function insideFrustum(point, camera) {
  // NDC alone can wrongly admit points behind the eye when clipping is oblique.
  if (point.clone().applyMatrix4(camera.matrixWorldInverse).z >= 0) return false;
  const p = point.clone().project(camera);
  return Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1 && p.z >= -1 && p.z <= 1;
}

function cameraViews() {
  const views = [
    { name: 'room', position: [9.7, 6.8, 16.4], target: [-3.5, 4.9, -5.5] },
    { name: 'desk', position: [.8, 5.4, 7.6], target: [-3.2, 3.4, -.3] },
    { name: 'elevated', position: [0, 12, 7], target: [0, 0, 3] },
    { name: 'top-down', position: [0, 12, 7], target: [0, 0, 7] }
  ];
  // Sample the room's allowed OrbitControls angles, distances and position bounds.
  for (const target of [[-3.5, 4.9, -5.5], [-3.2, 3.4, -.3], [0, 5.8, -33]]) {
    for (const theta of [-.65, -.4, 0, .4, .85]) for (const phi of [.34, .4, .5, .53]) {
      for (const distance of [4, 12, 24, 32]) {
        const p = new T.Vector3().setFromSpherical(new T.Spherical(distance, phi * Math.PI, theta));
        p.add(new T.Vector3(...target));
        p.x = T.MathUtils.clamp(p.x, -13.3, 13.3);
        p.y = T.MathUtils.clamp(p.y, 1.2, 12);
        p.z = T.MathUtils.clamp(p.z, -6.8, 20.5);
        views.push({ name: 'orbit-' + views.length, position: p.toArray(), target });
      }
    }
  }
  // Also cover almost horizontal through almost vertical views, including ceiling height.
  for (const height of [1.2, 3, 6, 9, 12]) for (const angle of [1, 15, 30, 45, 60, 75, 89]) {
    const radians = T.MathUtils.degToRad(angle);
    views.push({
      name: 'pitch-' + height + '-' + angle,
      position: [0, height, 7],
      target: [0, height - Math.sin(radians) * 4, 7 - Math.cos(radians) * 4]
    });
  }
  return views;
}

function cameraAt(view) {
  const camera = new T.PerspectiveCamera(52, 1280 / 720, .1, 4000);
  camera.position.fromArray(view.position);
  camera.lookAt(new T.Vector3(...view.target));
  return camera;
}

function disposeReflector(reflector) {
  reflector.getRenderTarget().dispose();
  reflector.geometry.dispose();
  reflector.material.dispose();
}

(async () => {
  const room = await loadRoomGeometry();
  const floor = [], desk = [], ceiling = [], floorBounds = new T.Box3();
  room.traverse(object => {
    if (!object.isMesh) return;
    const points = /^FLOOR_/.test(object.name) ? floor :
      /^DESK_/.test(object.name) ? desk :
      /^(CEILING_|LED_DIFFUSER_)/.test(object.name) ? ceiling : null;
    if (!points) return;
    const positions = object.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const p = new T.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
      points.push(p);
      if (points === floor) floorBounds.expandByPoint(p);
    }
  });
  assert(floor.length && desk.length && ceiling.length, 'Actual room fixtures must be present');
  const grid = [];
  for (let x = 0; x <= 20; x++) for (let z = 0; z <= 20; z++) {
    grid.push(new T.Vector3(
      T.MathUtils.lerp(floorBounds.min.x, floorBounds.max.x, x / 20),
      floorBounds.max.y,
      T.MathUtils.lerp(floorBounds.min.z, floorBounds.max.z, z / 20)
    ));
  }

  const views = cameraViews();
  // Positive control: reproduce the old elevated-view failure, so this test
  // cannot pass by checking an unrelated set of camera poses or geometry.
  const oldReflector = createReflector(.003);
  const oldCapture = reflectedCamera(oldReflector, cameraAt(views.find(v => v.name === 'elevated')));
  const oldFloorVisible = floor.filter(p => insideFrustum(p, oldCapture)).length;
  assert(oldFloorVisible > 0, 'Original clip bias must reproduce floor self-occlusion');
  disposeReflector(oldReflector);

  const reflector = createReflector();
  const aboveFloor = [...desk, ...ceiling].filter(p => p.y > .05);
  let deskViews = 0, ceilingViews = 0;
  for (const view of views) {
    const camera = cameraAt(view), capture = reflectedCamera(reflector, camera);
    const unclipped = capture.clone();
    unclipped.projectionMatrix.copy(camera.projectionMatrix);
    assert(!floor.some(p => insideFrustum(p, capture)), view.name + ': authored floor entered its reflection');
    assert(!grid.some(p => insideFrustum(p, capture)), view.name + ': floor footprint entered its reflection');
    assert(!aboveFloor.some(p => insideFrustum(p, unclipped) && !insideFrustum(p, capture)),
      view.name + ': clipping removed an above-floor object');
    if (desk.some(p => p.y > .05 && insideFrustum(p, capture))) deskViews++;
    if (ceiling.some(p => insideFrustum(p, capture))) ceilingViews++;
  }
  assert(deskViews > 0 && ceilingViews > 0, 'Both desk and ceiling must remain reflected');
  disposeReflector(reflector);
  const geometries = new Set(), materials = new Set();
  room.traverse(o => { if (o.geometry) geometries.add(o.geometry); for (const m of [].concat(o.material || [])) materials.add(m); });
  geometries.forEach(g => g.dispose());
  materials.forEach(m => m.dispose());
  console.log('PASS floor reflection: ' + views.length + ' camera poses; floor excluded; desk and ceiling preserved; original-bias failure reproduced.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
