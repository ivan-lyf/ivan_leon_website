'use strict';

// Run with: node tests/facade-stability.cjs
// No packages, browser, or output files are required. This is a Float32
// precision-stress test, not a claim about a particular GPU's interpolation or
// sin implementation. The old expressions are retained as failing controls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const THREE = require(path.join(root, 'shared/vendor/three.min.js'));
const source = fs.readFileSync(path.join(root, 'shared/penthouse-city.js'), 'utf8');

function extract(pattern, label) {
  const match = source.match(pattern);
  assert(match, `${label} expression missing from the runtime shader`);
  return match[1];
}
const expressions = {
  seed: extract(/float\s+stableSeed\s*=\s*([^;]+);/, 'stableSeed'),
  id: extract(/float\s+id\s*=\s*([^;]+);/, 'id'),
  attenuation: extract(/illumination\s*\*=\s*([^;]+);/, 'room attenuation')
};

// Interpret the actual GLSL scalar expressions and round every operation.
// This avoids copying the repaired seed and attenuation formulas into the test.
function compileScalar(expression) {
  const tokens = expression.match(/(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z_]\w*|[()+*/,-]/g) || [];
  assert.equal(tokens.join(''), expression.replace(/\s/g, ''), 'Unsupported GLSL scalar syntax');
  let index = 0;
  const peek = () => tokens[index];
  function atom() {
    const token = tokens[index++];
    if (token === '(') {
      const value = sum();
      assert.equal(tokens[index++], ')');
      return value;
    }
    if (token === '-') {
      const value = atom();
      return vars => Math.fround(-value(vars));
    }
    if (/^(?:\d|\.)/.test(token)) {
      const value = Math.fround(Number(token));
      return () => value;
    }
    if (peek() === '(') {
      index++;
      const value = sum();
      assert.equal(tokens[index++], ')');
      assert.equal(token, 'floor', 'Unsupported GLSL scalar function');
      return vars => Math.fround(Math.floor(value(vars)));
    }
    return vars => {
      assert(token in vars, `Missing GLSL scalar: ${token}`);
      return Math.fround(vars[token]);
    };
  }
  function product() {
    let value = atom();
    while (peek() === '*' || peek() === '/') {
      const operator = tokens[index++], left = value, right = atom();
      value = vars => Math.fround(operator === '*' ? left(vars) * right(vars) : left(vars) / right(vars));
    }
    return value;
  }
  function sum() {
    let value = product();
    while (peek() === '+' || peek() === '-') {
      const operator = tokens[index++], left = value, right = product();
      value = vars => Math.fround(operator === '+' ? left(vars) + right(vars) : left(vars) - right(vars));
    }
    return value;
  }
  const evaluate = sum();
  assert.equal(index, tokens.length, 'Unconsumed GLSL scalar tokens');
  return evaluate;
}
const evaluateSeed = compileScalar(expressions.seed);
const evaluateId = compileScalar(expressions.id);
const evaluateAttenuation = compileScalar(expressions.attenuation);

// Populate the actual deterministic architecture, without creating a renderer.
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'shared/penthouse-architecture.js'), 'utf8'), context);
let randomSeed = 74192;
function random() {
  randomSeed = (randomSeed * 1664525 + 1013904223) >>> 0;
  return randomSeed / 4294967296;
}
const towers = [];
context.window.PenthouseArchitecture.populate({
  THREE, lite: false, random,
  range: (a, b) => a + random() * (b - a),
  block: (list, x, y, z, w, h, d, seed) => list.push({ x, y, z, w, h, d, seed: seed || random() }),
  towers, structure: [], ribs: [], cyan: [], magenta: [], beacons: []
});
assert(towers.length > 0, 'The architecture fixture must contain occupied volumes');

const f = Math.fround;
const add = (a, b) => f(f(a) + f(b));
const multiply = (a, b) => f(f(a) * f(b));
const fraction = value => f(value - Math.floor(value));
const bits = new DataView(new ArrayBuffer(4));
function offsetULP(value, offset) {
  assert(value > 0, 'The positive instance seed fixture is required for this ULP helper');
  bits.setFloat32(0, value);
  bits.setUint32(0, bits.getUint32(0) + offset);
  return bits.getFloat32(0);
}
function hash(x, y) {
  return fraction(multiply(f(Math.sin(add(multiply(x, 127.1), multiply(y, 311.7)))), 43758.5453));
}
const step = (edge, value) => value < edge ? 0 : 1;

// The facade's occupancy call sites, using source-evaluated identity inputs.
function occupancy(vSeed, x, y, bays, useClass, current) {
  const stableSeed = current ? evaluateSeed({ vSeed }) : vSeed;
  const id = current ? evaluateId({ stableSeed, vSeed }) : multiply(vSeed, 97);
  const band = Math.floor(y / 6);
  const zone = hash(band, add(id, 3.7));
  const wing = hash(Math.floor(x / Math.max(2, Math.floor(bays * .5))), add(band, id));
  const vacant = step(zone, .30);
  const residential = step(.30, zone) * step(zone, .63);
  let office = step(.63, zone) * step(zone, .87), mechanical = step(.87, zone);
  if (useClass < .5) { mechanical = Math.max(mechanical, office); office = 0; }
  const floorOn = hash(y, add(id, 5)), roomOn = hash(add(x, id), add(y, id));
  return residential * step(.42, roomOn) * step(.10, floorOn)
    + office * step(.28, floorOn) * step(.14 + .46 * wing, roomOn)
    + mechanical * step(.94, roomOn) * .4
    + vacant * step(.982, roomOn) * .45;
}
function bayTarget(tower) {
  let width = [1.5, 2.4, 1.35, 2.2, 1.75][tower.family || 0];
  if (tower.useClass < .5) width = 2.8;
  else if (tower.useClass < 1.5) width = 2.5;
  if (tower.skin > 1.5 && tower.skin < 2.5) width = 1.9;
  return width;
}
function faceWidths(tower) {
  return tower.shape === 'round'
    ? [Math.PI * Math.sqrt((tower.w * tower.w + tower.d * tower.d) * .5)]
    : [tower.w, tower.d];
}
let precisionSamples = 0, baselineFlips = 0, currentFlips = 0;
for (const tower of towers) {
  const seed = f(tower.seed), bays = Math.max(2, Math.floor(faceWidths(tower)[0] / bayTarget(tower)));
  const low = Math.max(0, Math.floor((tower.y - tower.h / 2 + 112) / 3.2));
  const high = Math.min(90, Math.floor((tower.y + tower.h / 2 + 112) / 3.2));
  for (let x = 0; x < Math.min(bays, 8); x++) {
    for (let y = low; y <= high; y++) {
      for (const offset of [-2, -1, 1, 2]) {
        const perturbed = offsetULP(seed, offset);
        precisionSamples++;
        if (occupancy(seed, x, y, bays, tower.useClass, false) !== occupancy(perturbed, x, y, bays, tower.useClass, false)) baselineFlips++;
        if (occupancy(seed, x, y, bays, tower.useClass, true) !== occupancy(perturbed, x, y, bays, tower.useClass, true)) currentFlips++;
      }
    }
  }
}
assert(baselineFlips > 0, 'Control failed: raw seeds must expose the original occupancy instability');
assert.equal(currentFlips, 0, 'Runtime facade identity changes occupancy under small seed perturbations');

// Sample real rear-wall occluders, including the narrowest actual bay, and all
// combinations on a regular [0,1] mask grid. These are physical bound checks.
const extentX = Math.min(...towers.flatMap(tower => faceWidths(tower).map(width =>
  width / Math.max(2, Math.floor(width / bayTarget(tower))) * .405)));
function smooth(low, high, value) {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}
function pane(x, y, lx, ly, hx, hy, aa) {
  return smooth(lx - aa, lx + aa, x) * (1 - smooth(hx - aa, hx + aa, x))
    * smooth(ly - aa, ly + aa, y) * (1 - smooth(hy - aa, hy + aa, y));
}
let attenuationSamples = 0, baselineMinimum = 1, currentMinimum = 1, currentMaximum = 0;
function checkAttenuation(cabinet, partitionMask, door) {
  const value = evaluateAttenuation({ cabinet, partitionMask, door });
  assert(Number.isFinite(value) && value >= 0 && value <= 1, `Unphysical runtime room attenuation: ${value}`);
  attenuationSamples++;
  currentMinimum = Math.min(currentMinimum, value);
  currentMaximum = Math.max(currentMaximum, value);
  baselineMinimum = Math.min(baselineMinimum, 1 - cabinet * .80 - partitionMask * .40 - door * .28);
}
for (const width of [extentX, .7695, 1.2, 1.6, 2]) {
  for (let ix = 0; ix <= 800; ix++) {
    for (let iy = 0; iy <= 160; iy++) {
      const hitX = (ix / 400 - 1) * width, hitY = (iy / 80 - 1) * 1.14;
      const cabinet = step(hitY, -.34) * step(Math.abs(hitX + width * .22), width * .46);
      const partitionMask = 1 - smooth(.025, .09, Math.abs(hitX - width * .31));
      const door = pane(hitX / width * .5 + .5, hitY / 1.14 * .5 + .5, .71, .06, .9, .84, .01);
      checkAttenuation(cabinet, partitionMask, door);
    }
  }
}
assert(baselineMinimum < 0, 'Control failed: actual room overlap must expose the original negative-light defect');
for (let cabinet = 0; cabinet <= 20; cabinet++) {
  for (let partition = 0; partition <= 20; partition++) {
    for (let door = 0; door <= 20; door++) checkAttenuation(cabinet / 20, partition / 20, door / 20);
  }
}
console.log(`PASS facade stability: ${precisionSamples} precision samples; ${baselineFlips} control flips, ${currentFlips} runtime flips.`);
console.log(`PASS room attenuation: ${attenuationSamples} samples; runtime range ${currentMinimum.toFixed(6)}–${currentMaximum.toFixed(6)}; old-expression control goes negative.`);
