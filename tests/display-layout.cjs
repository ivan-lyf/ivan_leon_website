/* Keep the authored city and corporate signs identical across quality tiers.
 * Run: node tests/display-layout.cjs
 * Uses the real city modules. Canvas drawing is inert because only geometry,
 * seeds, instance transforms and sign placements are under test. Atlas loading
 * is asynchronous but image decoding and network access are mocked.
 */
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const repo = path.resolve(__dirname, '..');
const T = require(path.join(repo, 'shared/vendor/three.min.js'));
global.THREE = T;
global.self = global;
global.window = { THREE: T };
global.innerWidth = 1440;
global.innerHeight = 900;
// Baked banner textures must load successfully without a browser DOM. Preserve
// TextureLoader's asynchronous callback contract so city.ready is exercised.
T.TextureLoader = class {
  load(url, onLoad) {
    assert(fs.existsSync(path.join(repo, url)), 'Runtime texture asset must exist: ' + url);
    const texture = new T.Texture();
    queueMicrotask(() => onLoad?.(texture));
    return texture;
  }
};
global.document = {
  createElement(tag) {
    assert.equal(tag, 'canvas');
    const canvas = { width: 1, height: 1 };
    const gradient = () => ({ addColorStop() {} });
    const context = new Proxy({
      canvas, createLinearGradient: gradient, createRadialGradient: gradient,
      measureText: text => ({ width: String(text).length * 32 })
    }, { get: (target, key) => key in target ? target[key] : () => {} });
    canvas.getContext = () => context;
    return canvas;
  }
};
global.Image = class {
  set src(_value) { queueMicrotask(() => this.onerror?.()); }
};
for (const file of [
  'assets/signage/banners-v2.js',
  'penthouse-architecture.js', 'penthouse-city-shadow.js', 'penthouse-city-lighting.js',
  'penthouse-whale.js', 'penthouse-traffic.js', 'penthouse-signage-mounts.js', 'penthouse-signage.js',
  'penthouse-corporate.js', 'penthouse-city.js'
]) vm.runInThisContext(fs.readFileSync(path.join(repo, 'shared', file), 'utf8'));

let architecture, placements;
const populate = window.PenthouseArchitecture.populate;
window.PenthouseArchitecture.populate = options => {
  architecture = options;
  return populate(options);
};
const corporate = window.PenthouseCorporate.create;
window.PenthouseCorporate.create = (three, options) => {
  placements = options.placements;
  return corporate(three, options);
};
const lighting = JSON.parse(fs.readFileSync(path.join(repo, 'shared/assets/city-lighting.json')));
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const geometric = item => {
  // Texture-atlas packing is a rendering detail and can vary with shadow quality.
  const { shadowRect, ...rest } = item;
  return rest;
};
// Captured from the approved full-quality scene before quality-tier unification.
// Changes to the canonical art direction should deliberately update this baseline.
const baseline = {
  towers: { count: 507, hash: '948220b7ce7d8d1686e161b575eca5f3bc6ba073ac9e105f019ea9270f21997a' },
  structure: { count: 5588, hash: 'df14f92c72fc9f939ad6bef979e07949f5d276b8cf4f121dc6bbd69626405a60' },
  ribs: { count: 2034, hash: '8845614bb7c47c5f624e94ea93979159f5b5e6c5fcbbcc769d50fc2adce97a77' },
  cyan: { count: 121, hash: '3235b03bf26a73f1ab0d16e380d81bcfc158ff9676bc925f8b63aca792854f5d' },
  magenta: { count: 25, hash: '2002009c26342b1a702b3fb1b77506296a04cbdee7da9f0b93a7478a929b809c' },
  placements: { count: 8, hash: 'fb8dbf84050cb2b173d5d307496520b63ca7668c684f8efea6249b45ed003bab' }
};

async function generate(lite, width, height) {
  global.innerWidth = width;
  global.innerHeight = height;
  const city = window.PenthouseCity.create(T, { lite, lighting });
  await city.loadLighting();
  assert.equal(city.getStats().signage.loaded, true, 'The city must await its baked banner atlas');
  // The procedural sky should only shade pixels left uncovered by opaque
  // geometry. It stays in the opaque queue so all transparent weather/signage
  // still composite over it, with no visual or depth-buffer change.
  const sky = city.group.getObjectByName('Low storm ceiling');
  assert(sky && sky.isMesh, 'The authored storm background must be present');
  assert.equal(sky.material.transparent, false, 'The background must precede transparent atmospheric layers');
  assert.equal(sky.material.depthTest, true, 'Opaque scene depth must reject hidden sky fragments');
  assert.equal(sky.material.depthWrite, false, 'The background must not occlude later transparent effects');
  city.group.traverse(node => {
    if (node === sky || !(node.isMesh || node.isPoints || node.isLine)) return;
    if ([].concat(node.material || []).some(material => !material.transparent)) {
      assert(sky.renderOrder > node.renderOrder, 'Expensive sky shading must follow opaque geometry: ' + node.name);
    }
  });
  const data = {
    // Banner housings follow the quality-dependent tenant selection. The
    // authored buildings must still match the original cross-device baseline.
    towers: architecture.towers, structure: architecture.structure.filter(part => !part.signMount), ribs: architecture.ribs,
    cyan: architecture.cyan, magenta: architecture.magenta, placements
  };
  const layout = Object.fromEntries(Object.entries(data).map(([name, values]) =>
    [name, { count: values.length, hash: hash(values.map(geometric)) }]));
  const signs = JSON.parse(JSON.stringify(placements));
  const roundTower = city.group.getObjectByName('Elliptical glazed towers and curved setback crowns');
  const mounts = architecture.structure.filter(part => part.signMount);
  const count = city.getStats().signage.signs;
  assert.equal(mounts.length, count * 3, 'Each banner needs one cabinet and two wall brackets');
  assert.equal(mounts.filter(part => part.mountRole === 'cabinet').length, count);
  assert.equal(mounts.filter(part => part.mountRole === 'wall bracket').length, count * 2);
  assert(mounts.every(part => part.collision === false), 'Small mounting hardware must not change traffic routing');
  const structureBatches = [];
  city.group.traverse(node => {
    if (node.name === 'Stone, bronze, ceramic and industrial setbacks') structureBatches.push(node);
  });
  assert.equal(structureBatches.length, 1, 'Mounts must share the existing structure draw, without another batch');
  const structureBatch = structureBatches[0];
  assert(structureBatch.isInstancedMesh);
  assert.equal(structureBatch.count, architecture.structure.length, 'The final instance batch must include all mounts');
  assert.equal(city.getStats().signage.drawCalls, 2, 'Banners must retain only their face and halo draws');
  const actualMatrix = new T.Matrix4(), expected = new T.Object3D();
  architecture.structure.forEach((part, index) => {
    if (!part.signMount) return;
    expected.position.set(part.x, part.y, part.z);
    expected.rotation.fromArray((part.rotation || [0, 0, 0]).concat('XYZ'));
    expected.scale.set(part.w, part.h, part.d); expected.updateMatrix();
    structureBatch.getMatrixAt(index, actualMatrix);
    actualMatrix.elements.forEach((value, i) => assert(Math.abs(value - expected.matrix.elements[i]) < 2e-5,
      'An appended mount must reach the actual instance buffer in the same position'));
  });
  const disposal = new Map([structureBatch.geometry, structureBatch.material].map(resource => [resource, 0]));
  for (const resource of disposal.keys()) resource.addEventListener('dispose', () => disposal.set(resource, disposal.get(resource) + 1));
  const rendering = {
    mountParts: mounts.length,
    shadowSamples: city.getStats().shadows.faceSamples,
    roundSegments: roundTower.geometry.parameters.radialSegments
  };
  city.dispose();
  for (const count of disposal.values()) assert.equal(count, 1, 'The city must dispose its shared mount batch exactly once');
  assert.equal(city.group.children.length, 0, 'City disposal must remove mounted signs and their shared structure batch');
  return { layout, signs, rendering };
}

(async () => {
  const full = await generate(false, 1440, 900);
  assert.deepEqual(full.layout, baseline, 'The approved full-quality city must remain unchanged');
  const fullWide = await generate(false, 3840, 2160);
  const liteWide = await generate(true, 3840, 2160);
  const liteNarrow = await generate(true, 390, 844);
  for (const [name, result] of [['wide full', fullWide], ['wide lite', liteWide], ['narrow lite', liteNarrow]]) {
    assert.deepEqual(result.layout, baseline, name + ' must use the canonical city layout');
    assert.deepEqual(result.signs, full.signs, name + ' must preserve every corporate sign placement');
  }
  assert(liteWide.rendering.mountParts < full.rendering.mountParts,
    'Lite mode should allocate only the mounts needed by its reduced banner count');
  assert(liteWide.rendering.shadowSamples < full.rendering.shadowSamples,
    'Lite mode should retain cheaper shadow sampling');
  assert(liteWide.rendering.roundSegments < full.rendering.roundSegments,
    'Lite mode should retain simpler curved meshes');
  const okami = full.signs.find(sign => sign.logo === 4);
  assert.deepEqual([okami.x, okami.y, okami.z, okami.w], [9.16, 23.727750000000004, -202.795, 20.898]);
  console.log('PASS display layout: full baseline unchanged; 507 volumes and 8 sign placements match across 4 display/quality cases; render-only lite savings retained.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
