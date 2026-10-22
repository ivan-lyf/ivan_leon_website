// Source-bound, DOM-free city/signage fixture shared by layout and precision tests.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const root = path.resolve(__dirname, '../..');
const THREE = require(path.join(root, 'shared/vendor/three.min.js'));
const files = Object.fromEntries(['city', 'corporate', 'signage', 'signage-mounts', 'architecture'].map(name =>
  [name, fs.readFileSync(path.join(root, 'shared/penthouse-' + name + '.js'), 'utf8')]));
const metadata = fs.readFileSync(path.join(root, 'shared/assets/signage/banners-v2.js'), 'utf8');

function createFixture(lite = false) {
  const context = { window: {}, console, options: {
    lighting: JSON.parse(fs.readFileSync(path.join(root, 'shared/assets/city-lighting.json'), 'utf8'))
  } };
  vm.createContext(context);
  vm.runInContext(files.architecture, context, { filename: 'penthouse-architecture.js' });
  vm.runInContext(metadata, context, { filename: 'banners-v2.js' });
  vm.runInContext(files['signage-mounts'], context, { filename: 'penthouse-signage-mounts.js' });
  vm.runInContext(files.signage, context, { filename: 'penthouse-signage.js' });
  let seed = 74192;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const towerOptions = { THREE, lite, random, range: (a, b) => a + random() * (b - a),
    block: (list, x, y, z, w, h, d, buildingSeed) => list.push({ x, y, z, w, h, d, seed: buildingSeed || random() }),
    towers: [], structure: [], ribs: [], cyan: [], magenta: [], beacons: []
  };
  context.window.PenthouseArchitecture.populate(towerOptions);
  Object.assign(context, towerOptions);
  const start = files.city.indexOf('function frontAt('), end = files.city.indexOf('var signage=');
  assert(start >= 0 && end > start, 'Production corporate-placement extraction boundaries changed');
  vm.runInContext(files.city.slice(start, end), context, { filename: 'city-logo-placement-fixture.js' });
  const api = context.window.PenthouseSignage, data = context.window.PenthouseBannerAtlas;
  const options = { towers: context.towers, structure: context.structure, ribs: context.ribs, lite, exclusions: context.logoPlacements };
  const signs = api.plan(data.designs, options);
  return { root, THREE, files, context, api, data, options, signs };
}
module.exports = { createFixture, root, THREE, files };
