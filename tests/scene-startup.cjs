// The actual scene startup/animation seam with a deterministic RAF queue.
// Run: node tests/scene-startup.cjs
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../shared/penthouse-scene.js'), 'utf8');
const animateStart = source.indexOf('  function animate(now) {');
const animateEnd = source.indexOf('  async function init()', animateStart);
const startupStart = source.indexOf('      // The first animation frame completes reflection captures');
const startupEnd = source.indexOf("      on(window,'pagehide'", startupStart);
assert(animateStart >= 0 && animateEnd > animateStart && startupStart >= 0 && startupEnd > startupStart,
  'Production animation and first-frame startup seams must remain present');
const animate = source.slice(animateStart, animateEnd);
const startup = source.slice(startupStart, startupEnd);

function fixture({ hidden = false, inComputer = false, lite = false, fallback = false, failure = null } = {}) {
  const queue = new Map(), events = [], errors = [], loading = { style: { display: 'flex' } };
  let nextID = 0, maximumPending = 0, finished = 0, context;
  const error = new Error('test ' + failure + ' failure');
  function runStage(name) { events.push(name); if (failure === name) throw error; }
  context = {
    frame: 0, lastFrame: 0, disposed: false, flight: null, inComputer, lite, moving: true, elapsed: 0,
    keyboardOutline: null, reduced: false, probeDirty: true, floorReflection: {}, scene: {},
    document: { hidden, getElementById(id) { assert.equal(id, 'loading'); return loading; } },
    clock: { getDelta: () => .016 }, T: { MathUtils: { clamp: (x, lo, hi) => Math.max(lo, Math.min(hi, x)) } },
    camera: { position: { x: 0, y: 6, z: 4 } }, controls: { update: () => runStage('controls') },
    workstation: { update: () => runStage('workstation') },
    city: { update: () => runStage('city'), getLightningIntensity: () => 0, getHologramLight: () => null },
    updateStormLighting: () => runStage('storm'),
    weather: { setHologramLight: () => runStage('hologram'), update: () => runStage('weather'), capture: () => runStage('capture') },
    refreshRoomProbe() { runStage('probe'); context.probeDirty = false; },
    composer: { render: () => runStage('render') }, renderer: { render: () => runStage('render') },
    arrival: fallback ? null : { finish() { finished++; events.push('finish'); } },
    console: { error: (...args) => errors.push(args) },
    showError: message => { events.push('error'); context.errorMessage = message; },
    requestAnimationFrame(callback) {
      const id = ++nextID; queue.set(id, callback); maximumPending = Math.max(maximumPending, queue.size); return id;
    },
    cancelAnimationFrame(id) { queue.delete(id); }
  };
  vm.createContext(context); vm.runInContext(animate + '\n' + startup, context, { filename: 'scene-startup-seam.js' });
  function step(now) {
    assert.equal(queue.size, 1, 'Exactly one animation callback must be scheduled');
    const [id, callback] = queue.entries().next().value; queue.delete(id); callback(now);
  }
  return { context, queue, events, errors, loading, error, step, finished: () => finished, maximumPending: () => maximumPending };
}
const renderOrder = ['controls', 'workstation', 'city', 'storm', 'hologram', 'weather', 'probe', 'capture', 'render', 'finish'];
function checkReady(f) {
  assert.equal(f.errors.length, 0, f.errors.map(args => String(args[1])).join('; '));
  assert.equal(f.finished(), 1); assert.deepEqual(f.events, renderOrder);
  assert.equal(f.queue.size, 1, 'The successful startup retains the existing animate successor');
  assert.equal(f.maximumPending(), 1, 'Startup never creates a second RAF loop');
  assert.equal(f.errors.length, 0);
}

// Hidden and computer views can skip animate entirely. Do not mark them ready.
for (const hidden of [true, false]) {
  const f = fixture({ hidden, inComputer: !hidden });
  for (const timestamp of [100, 150, 200]) {
    f.step(timestamp); assert.equal(f.finished(), 0, 'Skipped rendering cannot reveal the room');
    assert.deepEqual(f.events, []); assert.equal(f.queue.size, 1);
  }
  f.context.document.hidden = false; f.context.inComputer = false; f.step(250); checkReady(f);
}
// The first callback can fall below the desktop/mobile budget in a warm startup.
for (const lite of [false, true]) {
  const f = fixture({ lite });
  for (const timestamp of lite ? [1, 10, 20, 30] : [1, 5, 10]) {
    f.step(timestamp); assert.equal(f.finished(), 0, 'Frame gate cannot reveal before rendering');
    assert.deepEqual(f.events, []);
  }
  f.step(lite ? 34 : 17); checkReady(f);
}
const direct = fixture(); direct.context.composer = null; direct.step(100); checkReady(direct);
const normal = fixture(); normal.step(100); checkReady(normal);
normal.events.length = 0; normal.step(120);
assert.equal(normal.finished(), 1, 'Arrival finishes once while steady animation continues');
assert.deepEqual(normal.events, renderOrder.filter(name => name !== 'probe' && name !== 'finish'));
assert.equal(normal.queue.size, 1); assert.equal(normal.maximumPending(), 1);

for (const failure of ['probe', 'render']) {
  const f = fixture({ failure }); f.step(100);
  assert.equal(f.finished(), 0); assert.equal(f.queue.size, 0, 'Failed startup must cancel the scheduled successor');
  assert.equal(f.context.frame, 0); assert.equal(f.errors.length, 1);
  assert.equal(f.errors[0][1], f.error, 'Preserve the original diagnostic error');
  assert.match(f.context.errorMessage, /desktop.*available/i, 'Rendering failure keeps the desktop fallback available');
  assert.equal(f.events.at(-1), 'error');
}
const disposed = fixture(); disposed.context.disposed = true; disposed.step(100);
assert.equal(disposed.queue.size, 0); assert.equal(disposed.finished(), 0); assert.deepEqual(disposed.events, []);
const fallback = fixture({ hidden: true, fallback: true }); fallback.step(100);
assert.equal(fallback.loading.style.display, 'flex'); fallback.context.document.hidden = false; fallback.step(200);
assert.equal(fallback.loading.style.display, 'none'); assert.equal(fallback.queue.size, 1);
console.log('PASS scene startup: real animation order, hidden/computer/frame-gate retries, single RAF loop, one reveal, error fallback, disposal and legacy loader.');
