/* Regression for chair AO isolation in the real loadPenthouse material setup.
 * Run: node tests/chair-shading.cjs
 * Uses shipped Three.js, actual scene code and the GLB's material assignments.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repo = path.resolve(__dirname, '..');
const T = require(path.join(repo, 'shared/vendor/three.min.js'));
const source = fs.readFileSync(path.join(repo, 'shared/penthouse-scene.js'), 'utf8');
const loadStart = source.indexOf('  async function loadPenthouse()');
const blockStart = source.indexOf('      node.castShadow=true;node.receiveShadow=true;', loadStart);
const blockEnd = source.indexOf('      const name=node.name;', blockStart);
assert(loadStart >= 0 && blockStart > loadStart && blockEnd > blockStart,
  'The test must exercise loadPenthouse material setup');
const setupSource = source.slice(blockStart, blockEnd);

// The risk is real: the chair upholstery and retained desk pad share one GLB
// material, and several furniture materials share its AO texture.
const bytes = fs.readFileSync(path.join(repo, 'shared/assets/models/penthouse/penthouse-v2.glb'));
const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
const active = new Set();
function visit(index) {
  if (active.has(index)) return;
  active.add(index);
  for (const child of gltf.nodes[index].children || []) visit(child);
}
for (const index of gltf.scenes[gltf.scene || 0].nodes) visit(index);
const assignments = [];
for (const index of active) {
  const node = gltf.nodes[index];
  for (const primitive of node.mesh === undefined ? [] : gltf.meshes[node.mesh].primitives) {
    assignments.push({ node: node.name, material: primitive.material });
  }
}
const upholsteryName = 'Furniture | Charcoal upholstery';
const upholsteryIndex = gltf.materials.findIndex(m => m.name === upholsteryName);
const chairName = assignments.find(a => a.material === upholsteryIndex && a.node.startsWith('CHAIR_'))?.node;
const deskName = assignments.find(a => a.material === upholsteryIndex && a.node.startsWith('DESK_'))?.node;
assert(chairName && deskName, 'The shipped chair and desk must reproduce shared upholstery ownership');

function run(order) {
  const ao = new T.Texture(), normalMap = new T.Texture();
  const bounceMaps = [new T.Texture(), new T.Texture()], bounceMaterials = [];
  const shared = new T.MeshStandardMaterial({
    name: upholsteryName, color: 0x374143, roughness: .78,
    metalness: 0, aoMap: ao, normalMap, normalScale: new T.Vector2(.6, .8)
  });
  const trim = new T.MeshStandardMaterial({
    name: 'Furniture | Tonal stitching', color: 0x6c7070, roughness: .85, aoMap: ao
  });
  const geometry = new T.BoxGeometry(1, 1, 1);
  geometry.setAttribute('uv2', geometry.attributes.uv.clone());
  const normals = geometry.attributes.normal, uv2 = geometry.attributes.uv2;
  const makeMesh = (name, material) => {
    const mesh = new T.Mesh(geometry, material);
    mesh.name = name;
    mesh.userData.ao_category = 'furniture';
    return mesh;
  };
  const nodes = {
    chair: makeMesh(chairName, shared),
    desk: makeMesh(deskName, shared),
    piping: makeMesh('CHAIR_Export_29', trim)
  };
  const processMaterial = vm.runInNewContext('(node) => {\n' + setupSource + '\n}', {
    T, bounceMaps, bounceMaterials,
    renderer: { capabilities: { getMaxAnisotropy: () => 8 } }
  });
  for (const key of order) processMaterial(nodes[key]);

  const chair = nodes.chair.material, desk = nodes.desk.material;
  assert.notStrictEqual(chair, shared, 'Chair must clone the shared upholstery material');
  assert.strictEqual(desk, shared, 'The retained mousepad must retain its original material');
  assert.equal(chair.aoMapIntensity, 0, 'Faulty upholstery AO must not shade the chair');
  assert.equal(desk.aoMapIntensity, .8, 'Chair correction must not remove mousepad AO');
  assert.strictEqual(nodes.piping.material, trim, 'Piping must retain its original material');
  assert.equal(trim.aoMapIntensity, .8, 'Piping AO must remain unchanged');

  for (const node of Object.values(nodes)) {
    assert.strictEqual(node.geometry, geometry, 'Chair geometry must remain unchanged');
    assert.strictEqual(node.geometry.attributes.normal, normals, 'Vertex normals must remain unchanged');
    assert.strictEqual(node.geometry.attributes.uv2, uv2, 'Baked-light UVs must remain unchanged');
    assert.strictEqual(node.material.aoMap, ao, 'Do not replace or remove the shared AO texture');
    assert.strictEqual(node.material.lightMap, bounceMaps[1], 'Retain furniture indirect lighting');
    assert.equal(node.material.lightMapIntensity, 1);
    assert(node.castShadow && node.receiveShadow, 'Retain physical runtime shadows');
    assert(bounceMaterials.includes(node.material), 'Ceiling-light toggles must include each material');
  }
  assert.strictEqual(chair.normalMap, normalMap, 'Clone must retain any authored normal texture');
  assert.deepEqual(chair.normalScale.toArray(), [.6, .8]);
  assert.equal(chair.color.getHex(), shared.color.getHex());
  assert.equal(chair.roughness, .78);
  assert.equal(chair.metalness, 0);
  assert.equal(chair.envMapIntensity, .55);
  assert.equal(ao.generateMipmaps, false);
  assert.equal(ao.minFilter, T.LinearFilter);

  geometry.dispose();
  for (const material of new Set([shared, chair, trim])) material.dispose();
  for (const texture of [ao, normalMap, ...bounceMaps]) texture.dispose();
}
run(['desk', 'chair', 'piping']);
run(['chair', 'piping', 'desk']);
console.log('PASS chair shading: isolated upholstery AO in both traversal orders; mousepad, piping, indirect light, normals and shadows preserved.');
