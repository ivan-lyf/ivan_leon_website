// Run: node tests/lighting-optimization.cjs
// Actual r128 direct-light fast paths; the browser suite checks rendered pixels.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const T = require('../shared/vendor/three.min.js');
const original = T.ShaderChunk.lights_physical_pars_fragment, originalBsdfs = T.ShaderChunk.bsdfs;
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../shared/penthouse-lighting-optimization.js'), 'utf8'), context);
const api = context.window.PenthouseLightingOptimization;
const fixture = () => ({ REVISION: T.REVISION, ShaderChunk: { ...T.ShaderChunk } });
assert.equal(T.ShaderChunk.lights_physical_pars_fragment, original, 'Loading the optional module must not install it');
const testT = fixture();
assert.equal(api.install(testT).changed, true);
const optimized = testT.ShaderChunk.lights_physical_pars_fragment;
assert.equal(api.install(testT).reason, 'already-installed');
assert.equal(testT.ShaderChunk.lights_physical_pars_fragment, optimized, 'Installation is idempotent');
for (const [name, value] of Object.entries(T.ShaderChunk)) {
  if (name !== 'lights_physical_pars_fragment') assert.equal(testT.ShaderChunk[name], value, name + ' is unchanged');
}
const rect = source => source.slice(source.indexOf('void RE_Direct_RectArea_Physical('), source.indexOf('void RE_Direct_Physical('));
assert.equal(rect(optimized), rect(original), 'The complete area-light function remains byte-identical');
assert.equal(testT.ShaderChunk.bsdfs, originalBsdfs, 'Original LTC/BRDF implementations stay untouched');

const regions = ['DIRECT_ZERO', 'COAT_IRRADIANCE_ZERO', 'BASE_IRRADIANCE_ZERO'];
function region(source, name) {
  const re = new RegExp('[ \\t]*// PENTHOUSE_' + name + '_BEGIN\\n([\\s\\S]*?)[ \\t]*// PENTHOUSE_' + name + '_END\\n', 'g');
  const matches = [...source.matchAll(re)];
  assert.equal(matches.length, 1, name + ' has exactly one inserted guard');
  return matches[0];
}
let restored = optimized.replace('// PENTHOUSE_ZERO_LIGHTS_V1\n', '');
for (const name of regions) restored = restored.replace(region(restored, name)[0], '');
assert.equal(restored, original, 'Removing only the guards restores every contributing lighting operation');
const direct = optimized.slice(optimized.indexOf('void RE_Direct_Physical('), optimized.indexOf('void RE_IndirectDiffuse_Physical('));
assert(direct.indexOf('PENTHOUSE_DIRECT_ZERO_END') < direct.indexOf('float dotNL'), 'Zero color avoids all BRDF work');
assert.equal(region(optimized, 'DIRECT_ZERO')[1].trim(), 'if ( all( equal( directLight.color, vec3( 0.0 ) ) ) ) return;');
assert.equal(region(optimized, 'COAT_IRRADIANCE_ZERO')[1].trim(), 'if ( dotNL == 0.0 && ccDotNL == 0.0 ) return;');
assert.equal(region(optimized, 'BASE_IRRADIANCE_ZERO')[1].trim(), 'if ( dotNL == 0.0 ) return;');
assert(direct.indexOf('float ccDotNL =') < direct.indexOf('PENTHOUSE_COAT_IRRADIANCE_ZERO_BEGIN'));
assert(direct.indexOf('PENTHOUSE_COAT_IRRADIANCE_ZERO_END') < direct.indexOf('vec3 ccIrradiance ='));
assert.match(direct, /#else\n\t\t\/\/ PENTHOUSE_BASE_IRRADIANCE_ZERO_BEGIN/);
// The inserted code declares no new locals, avoiding translation-unit macro
// collisions such as r128's cube_uv_reflection_fragment #define v1 0.276.
for (const name of regions) assert(!/\b(?:float|vec[234]|mat[234])\s+\w+\s*=/.test(region(optimized, name)[1]));

// Evaluate the actual scalar predicates, not a second hand-written condition.
const scalarPredicate = name => {
  const expression = region(optimized, name)[1].match(/if \( (.+) \) return;/)[1];
  return Function('dotNL', 'ccDotNL', 'return (' + expression + ');');
};
const skipCoated = scalarPredicate('COAT_IRRADIANCE_ZERO'), skipBase = scalarPredicate('BASE_IRRADIANCE_ZERO');
for (const base of [0, 1e-30, .7]) for (const coat of [0, 1e-30, .8]) {
  assert.equal(skipCoated(base, coat), !(base > 0 || coat > 0), 'Either lit layer retains the original shaded path');
  assert.equal(skipBase(base, coat), !(base > 0), 'An uncoated material depends only on its base normal');
}
// One lit channel, even very dim or negative, must retain the old color path.
const colorPredicate = Function('directLight', 'all', 'equal', 'vec3', 'return ' + region(optimized, 'DIRECT_ZERO')[1].match(/if \( (.+) \) return;/)[1]);
const rejectColor = color => colorPredicate({ color }, values => values.every(Boolean), (a, b) => a.map((x, i) => x === b[i]), x => [x, x, x]);
assert(rejectColor([0, -0, 0]));
for (const x of [1, 1e-30, -1e-30]) for (let channel = 0; channel < 3; channel++) {
  const c = [0, 0, 0]; c[channel] = x; assert(!rejectColor(c));
}

// Refuse unsupported or partially patched shaders without any mutation.
const unsupported = [null, {}, { REVISION: '129', ShaderChunk: { ...T.ShaderChunk } }, fixture(), fixture(), fixture(), fixture()];
unsupported[3].ShaderChunk.lights_physical_pars_fragment = original.replace('directLight.color;', 'directLight.color * .5;');
unsupported[4].ShaderChunk.lights_physical_pars_fragment = original + '\nvoid RE_Direct_Physical() {}';
unsupported[5].ShaderChunk.lights_physical_pars_fragment = optimized.replace('dotNL == 0.0 && ccDotNL == 0.0', 'dotNL == 0.0');
unsupported[6].ShaderChunk.lights_physical_pars_fragment = optimized + '\n// PENTHOUSE_AREA_FACING_BEGIN';
for (const value of unsupported) {
  const before = JSON.stringify(value), result = api.install(value);
  assert.equal(result.installed, false); assert.equal(result.changed, false);
  assert.equal(JSON.stringify(value), before, 'Unsupported source stays byte-for-byte unchanged');
}
console.log('PASS direct lighting optimization: guarded r128 install, unchanged area/LTC/contributing paths, color and dual-normal zero cases, idempotency and unsupported-source fallback.');
