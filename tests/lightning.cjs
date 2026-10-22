/* Deterministic lightning timing, geometry, render state and resource lifetime.
 * Run: node tests/lightning.cjs
 * Uses the production module and shipped Three.js; no browser or packages.
 * The rendered look remains a separate browser check.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const T = require('../shared/vendor/three.min.js');
const source = fs.readFileSync(path.join(__dirname, '../shared/penthouse-lightning.js'), 'utf8');
const context = { window: {} };
vm.runInNewContext(source, context, { filename: 'penthouse-lightning.js' });
const create = options => context.window.PenthouseLightning.create(T, options);

function resources(effect) {
  const geometries = new Set(), materials = new Set(), attributes = [];
  effect.group.traverse(node => {
    if (node.geometry) {
      geometries.add(node.geometry);
      for (const [name, attribute] of Object.entries(node.geometry.attributes)) {
        attributes.push({ name, attribute, array: attribute.array });
      }
    }
    for (const material of [].concat(node.material || [])) materials.add(material);
  });
  return { geometries: [...geometries], materials: [...materials], attributes };
}
function visibleMeshes(effect) {
  const result = [];
  effect.group.traverseVisible(node => {
    if (!node.isMesh && !node.isLine && !node.isPoints) return;
    const count = Math.min(node.geometry.drawRange.count,
      node.geometry.index?.count || node.geometry.attributes.position?.count || 0);
    if (count > 0 && [].concat(node.material).some(m => m.visible)) result.push(node);
  });
  return result;
}
function uniformValue(value) {
  if (value?.toArray) return value.toArray();
  return value;
}
function renderState(effect) {
  const meshes = visibleMeshes(effect);
  if (!meshes.length) return { strength: effect.uniforms.uLightning.value, draws: 0 };
  return {
    strength: effect.uniforms.uLightning.value,
    strike: effect.uniforms.uStrike.value.toArray(),
    draws: meshes.length,
    meshes: meshes.map(mesh => {
      const geometry = mesh.geometry, start = geometry.drawRange.start;
      const count = Math.min(geometry.drawRange.count,
        geometry.index?.count || geometry.attributes.position.count);
      const hash = crypto.createHash('sha256');
      for (const [name, attribute] of Object.entries(geometry.attributes)) {
        hash.update(name);
        // Only submitted vertices affect rendering; unused pooled capacity may
        // legitimately retain data from a previously visited strike.
        for (let i = start; i < start + count; i++) {
          const index = geometry.index ? geometry.index.getX(i) : i;
          const offset = index * attribute.itemSize * attribute.array.BYTES_PER_ELEMENT;
          hash.update(Buffer.from(attribute.array.buffer,
            attribute.array.byteOffset + offset, attribute.itemSize * attribute.array.BYTES_PER_ELEMENT));
        }
      }
      return {
        geometry: hash.digest('hex'), count,
        position: mesh.position.toArray(), quaternion: mesh.quaternion.toArray(), scale: mesh.scale.toArray(),
        uniforms: Object.fromEntries(Object.entries(mesh.material.uniforms || {})
          .map(([key, uniform]) => [key, uniformValue(uniform.value)]))
      };
    })
  };
}
function checkFinite(effect) {
  for (const { array } of resources(effect).attributes) {
    for (const value of array) assert(Number.isFinite(value), 'Lightning attributes must stay finite');
  }
}
function checkUniforms(effect) {
  const strength = effect.uniforms.uLightning.value;
  assert(Number.isFinite(strength) && strength >= 0 && strength <= 1,
    'Cloud lighting strength must stay normalized');
  for (const value of effect.uniforms.uStrike.value.toArray()) {
    assert(Number.isFinite(value) && Math.abs(value) < 10000, 'Strike must remain in finite city coordinates');
  }
}
function checkStableResources(effect, initial) {
  const current = resources(effect);
  assert.deepEqual(current.geometries, initial.geometries, 'Strikes must reuse geometry');
  assert.deepEqual(current.materials, initial.materials, 'Strikes must reuse materials');
  assert.equal(current.attributes.length, initial.attributes.length);
  current.attributes.forEach((entry, i) => {
    assert.strictEqual(entry.attribute, initial.attributes[i].attribute, 'Attribute objects must be pooled');
    assert.strictEqual(entry.array, initial.attributes[i].array, 'Typed arrays must be pooled');
  });
}
function disposeAndCheck(effect) {
  const initial = resources(effect), counts = new Map();
  for (const resource of [...initial.geometries, ...initial.materials]) {
    counts.set(resource, 0);
    resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
  }
  const scene = new T.Scene();
  scene.add(effect.group);
  effect.dispose();
  effect.dispose();
  effect.update(6.04, true);
  assert.equal(effect.uniforms.uLightning.value, 0);
  assert.equal(visibleMeshes(effect).length, 0);
  assert.equal(effect.group.parent, null, 'Disposed lightning must detach from its scene');
  assert.equal(effect.getStats().disposed, true);
  for (const count of counts.values()) assert.equal(count, 1, 'Each owned resource must be disposed once');
}
let totalUpdates = 0, totalEvents = 0, seeks = 0;
for (const lite of [false, true]) {
  const effect = create({ lite, reducedMotion: false }), initial = resources(effect);
  checkUniforms(effect);
  assert.equal(effect.uniforms.uLightning.value, 0);
  assert(effect.uniforms.uStrike.value.lengthSq() > 0,
    'Shared lighting shaders need a valid nonzero strike position even before the first event');
  assert(initial.geometries.length > 0 && initial.geometries.length <= 2);
  assert(initial.materials.length > 0 && initial.materials.length <= 2);
  for (const material of initial.materials) {
    assert.equal(material.depthTest, true, 'Buildings must occlude distant bolts');
    assert.equal(material.depthWrite, false, 'Transparent bolt glow must not overwrite depth');
    for (const shader of [material.vertexShader, material.fragmentShader]) {
      assert(shader.includes('\n'), 'GLSL must contain real newlines');
      assert(!shader.includes('\\n'), 'GLSL must not contain literal escaped newlines');
    }
  }
  effect.update(5.999, true);
  assert.equal(effect.uniforms.uLightning.value, 0);
  assert.equal(visibleMeshes(effect).length, 0, 'There must be no initial flash before six seconds');
  effect.update(6.04, true);
  assert(effect.uniforms.uLightning.value > 0, 'The first strike must light the city shortly after six seconds');
  const events = new Map();
  for (let step = 0; step <= 180000; step++) {
    const time = step / 100;
    effect.update(time, true);
    checkUniforms(effect);
    const stats = effect.getStats(), draws = visibleMeshes(effect).length;
    assert(draws <= 2, 'Lightning must use at most two draw calls during a strike');
    assert.equal(stats.drawCalls, draws, 'Reported draw calls must agree with visible submitted meshes');
    if (stats.active) {
      assert(time >= stats.strikeStart && time < stats.strikeStart + .65);
      assert.equal(stats.duration, .65);
      assert(draws > 0);
      if (!events.has(stats.strikeIndex)) {
        events.set(stats.strikeIndex, {
          start: stats.strikeStart, next: stats.nextStrikeTime,
          lane: stats.laneIndex, strike: effect.uniforms.uStrike.value.toArray()
        });
        checkFinite(effect);
        checkStableResources(effect, initial);
      }
    } else {
      assert.equal(draws, 0, 'Inactive lightning must submit no geometry');
      assert.equal(effect.uniforms.uLightning.value, 0, 'Cloud illumination must return fully to zero');
    }
    totalUpdates++;
  }
  const list = [...events.values()];
  assert(list.length >= 80, 'The simulation must cover many independent events');
  assert.equal(list[0].start, 6);
  assert.equal(new Set(list.map(event => event.lane)).size, 6, 'The long sequence must use all six skyline lanes');
  for (let i = 0; i < list.length; i++) {
    const gap = list[i].next - list[i].start;
    assert(gap >= 14 && gap <= 26, 'Strike intervals must remain between fourteen and twenty-six seconds');
    if (i) {
      assert.equal(list[i].start, list[i - 1].next, 'Sequential playback must not skip scheduled strikes');
      assert.notEqual(list[i].lane, list[i - 1].lane, 'Adjacent strikes must use different skyline lanes');
      assert.notDeepEqual(list[i].strike, list[i - 1].strike);
    }
  }
  totalEvents += list.length;
  const reference = create({ lite, reducedMotion: false });
  // Jump forward and backward, revisit the same event, and sample attack,
  // afterpulse, residual bolt tail and post-event silence.
  for (const index of [0, 15, 3, 60, 0]) for (const age of [0, .018, .04, .24, .50, .649, .65, 1]) {
    const time = list[index].start + age;
    effect.update(time, true);
    reference.update(time, true);
    const actual = renderState(effect), expected = renderState(reference);
    assert.deepEqual(actual, expected, 'Direct seeking must reproduce the same visible lightning');
    const builds = effect.getStats().geometryBuilds;
    const versions = initial.attributes.map(a => a.attribute.version);
    effect.update(time, true);
    assert.deepEqual(renderState(effect), actual, 'Repeated timestamps must produce identical render state');
    assert.equal(effect.getStats().geometryBuilds, builds, 'Repeated timestamps must not rebuild geometry');
    assert.deepEqual(initial.attributes.map(a => a.attribute.version), versions);
    effect.update(time, false);
    assert.equal(effect.uniforms.uLightning.value, 0);
    assert.equal(visibleMeshes(effect).length, 0, 'Disabling motion must immediately hide the strike');
    effect.update(time, true);
    assert.deepEqual(renderState(effect), actual, 'Re-enabling must resume the same deterministic state');
    seeks++;
  }
  for (const time of [NaN, Infinity, -1]) {
    effect.update(time, true);
    checkUniforms(effect);
    assert.equal(visibleMeshes(effect).length, 0, 'Invalid or negative time must not create a flash');
  }
  checkStableResources(effect, initial);
  disposeAndCheck(reference);
  disposeAndCheck(effect);
}
const reduced = create({ reducedMotion: true });
reduced.update(6.04);
assert.equal(reduced.uniforms.uLightning.value, 0);
assert.equal(visibleMeshes(reduced).length, 0, 'Reduced motion must default to no lightning');
reduced.update(6.04, true);
assert(reduced.uniforms.uLightning.value > 0, 'An explicit enable may override the module default');
reduced.update(6.04);
assert.equal(reduced.uniforms.uLightning.value, 0, 'Omitted enable must return to the reduced-motion default');
disposeAndCheck(reduced);
// A ceiling toggle during a flash must leave the environment refresh pending.
// Exercise the real capture boundary: a cached bright flash would otherwise persist.
const sceneSource = fs.readFileSync(path.join(__dirname, '../shared/penthouse-scene.js'), 'utf8');
const probeStart = sceneSource.indexOf('  function refreshRoomProbe() {');
const probeEnd = sceneSource.indexOf('\n  }', probeStart) + 4;
assert(probeStart >= 0 && probeEnd > probeStart);
const capture = { city: { isLightningActive: () => true }, probeDirty: true, roomModel: null };
vm.runInNewContext(sceneSource.slice(probeStart, probeEnd) + '\nrefreshRoomProbe();', capture);
assert.equal(capture.probeDirty, true, 'An active strike must defer the cached environment capture');
capture.city.isLightningActive = () => false;
vm.runInNewContext(sceneSource.slice(probeStart, probeEnd) + '\nrefreshRoomProbe();', capture);
assert.equal(capture.probeDirty, false, 'The pending capture must proceed after the strike');
console.log('PASS lightning: ' + totalUpdates + ' updates, ' + totalEvents +
  ' strikes, ' + seeks + ' seek/repeat/resume cases; finite pooled geometry, bounded lighting, visibility, reduced motion and disposal.');
