/* Keep the authored city and corporate signs identical across quality tiers.
 * Run: node tests/display-layout.cjs
 * Uses the real city modules. Canvas drawing is inert because only geometry,
 * seeds, instance transforms and sign placements are under test.
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
  'penthouse-architecture.js', 'penthouse-city-shadow.js', 'penthouse-city-lighting.js',
  'penthouse-whale.js', 'penthouse-traffic.js', 'penthouse-signage.js',
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
  structure: { count: 5588, hash: '31b70cc9d66528b3e721c1145cc73cd61ee8f4dc707e9b49d1303b70907398c7' },
  ribs: { count: 2012, hash: '7036e5c0b3a2e69f14ab9e59413c551862cc2ff76f030faf5a9c9c1548019ea7' },
  cyan: { count: 121, hash: '3235b03bf26a73f1ab0d16e380d81bcfc158ff9676bc925f8b63aca792854f5d' },
  magenta: { count: 25, hash: '2002009c26342b1a702b3fb1b77506296a04cbdee7da9f0b93a7478a929b809c' },
  placements: { count: 8, hash: 'fb8dbf84050cb2b173d5d307496520b63ca7668c684f8efea6249b45ed003bab' }
};

async function generate(lite, width, height) {
  global.innerWidth = width;
  global.innerHeight = height;
  const city = window.PenthouseCity.create(T, { lite, lighting });
  await city.loadLighting();
  const data = {
    towers: architecture.towers, structure: architecture.structure, ribs: architecture.ribs,
    cyan: architecture.cyan, magenta: architecture.magenta, placements
  };
  const layout = Object.fromEntries(Object.entries(data).map(([name, values]) =>
    [name, { count: values.length, hash: hash(values.map(geometric)) }]));
  const signs = JSON.parse(JSON.stringify(placements));
  const roundTower = city.group.getObjectByName('Elliptical glazed towers and curved setback crowns');
  const rendering = {
    shadowSamples: city.getStats().shadows.faceSamples,
    roundSegments: roundTower.geometry.parameters.radialSegments
  };
  city.dispose();
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
