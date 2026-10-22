/* Loading-screen behavior against the production DOM controller, without a
 * browser or dependencies. Rendering/layout is checked separately in REA.
 * Run: node tests/arrival.cjs
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'shared/penthouse-arrival.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

class Element {
  constructor() {
    this.attributes = {}; this.dataset = {}; this.style = {}; this.children = [];
    this.textContent = ''; const names = new Set();
    this.classList = {
      add: (...values) => values.forEach(value => names.add(value)),
      remove: (...values) => values.forEach(value => names.delete(value)),
      contains: value => names.has(value),
      toggle(value, force) {
        const shouldAdd = force === undefined ? !names.has(value) : force;
        if (shouldAdd) names.add(value); else names.delete(value);
        return shouldAdd;
      }
    };
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  appendChild(child) { this.children.push(child); return child; }
}
function fixture({ mode = 'penthouse', reduced = false, missing = [] } = {}) {
  const elements = Object.fromEntries(['loading', 'arrival', 'arrival-status',
    'arrival-percent', 'arrival-progress', 'arrival-fill'].map(id => [id, new Element()]));
  elements['arrival-status'].textContent = html.match(/id="arrival-status"[^>]*>([^<]*)</)[1];
  const documentElement = new Element();
  let now = 0, nextID = 1, reads = 0;
  const timers = new Map();
  const media = { matches: reduced };
  const context = {
    window: { ROOM_MODE: mode },
    document: {
      documentElement,
      getElementById(id) { reads++; return missing.includes(id) ? null : elements[id]; }
    },
    matchMedia(query) { assert.equal(query, '(prefers-reduced-motion: reduce)'); return media; },
    setTimeout(callback, delay = 0) { const id = nextID++; timers.set(id, { callback, due: now + delay, delay }); return id; },
    clearTimeout(id) { timers.delete(id); }
  };
  vm.runInNewContext(source, context, { filename: 'penthouse-arrival.js' });
  function advance(milliseconds) {
    const end = now + milliseconds;
    for (let guard = 0; guard < 100; guard++) {
      const next = [...timers].filter(([, timer]) => timer.due <= end).sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
      if (!next) { now = end; return; }
      timers.delete(next[0]); now = next[1].due; next[1].callback();
    }
    assert.fail('Unexpected recurring loading timer');
  }
  return {
    api: context.window.PenthouseArrival, elements, timers, media,
    documentElement, advance, reads: () => reads,
    percent: () => Number(elements['arrival-percent'].textContent),
    snapshot: () => JSON.stringify({
      nodes: Object.fromEntries(Object.entries(elements).map(([id, e]) => [id, {
        text: e.textContent, attributes: e.attributes, style: e.style, dataset: e.dataset,
        leaving: e.classList.contains('arrival-leaving')
      }])), loading: documentElement.classList.contains('room-loading'), timerCount: timers.size
    })
  };
}
function checkProgress(f) {
  const value = f.percent();
  assert(Number.isInteger(value) && value >= 0 && value <= 100);
  assert.equal(f.elements['arrival-progress'].getAttribute('aria-valuenow'), String(value));
  assert.equal(f.elements['arrival-fill'].style.transform, 'scaleX(' + value / 100 + ')',
    'The continuous fill must agree with the accessible progress value');
}

// No loading work should leak into Ivan's classic room or either direct desktop.
for (const mode of ['classic', 'desktop', undefined]) {
  const f = fixture({ mode: mode ?? null });
  assert.equal(f.api, undefined); assert.equal(f.reads(), 0); assert.equal(f.timers.size, 0);
  assert(!f.documentElement.classList.contains('room-loading'));
}
for (const id of ['loading', 'arrival']) assert.equal(fixture({ missing: [id] }).api, undefined);

{
  const f = fixture();
  assert.equal(f.percent(), 0); checkProgress(f);
  assert(f.documentElement.classList.contains('room-loading'));
  assert.equal(f.timers.size, 0, 'Progress must follow real work, without simulated progress timers');
  assert.equal(f.elements['arrival-status'].textContent, 'Loading…');
  assert.equal(f.elements['arrival-percent'].textContent, '0');
  const initial = f.snapshot();
  f.api.stage('Connecting the city…');
  assert.equal(f.snapshot(), initial, 'Stage callbacks must preserve the simple loading display');
  let last = 0;
  for (const [task, fraction] of [['room', .4], ['city', .1], ['room', .2], ['city', 1],
    ['traffic', .7], ['room', 1], ['traffic', 1], ['view', .5], ['view', 1]]) {
    f.api.progress(task, fraction); checkProgress(f);
    assert(f.percent() >= last, 'Out-of-order progress events cannot move the meter backward');
    assert(f.percent() < 100, 'Downloads alone must never claim a rendered scene is ready');
    last = f.percent();
  }
  assert.equal(f.percent(), 99);
  f.api.finish(); checkProgress(f); assert.equal(f.percent(), 100);
  assert.equal(f.elements.arrival.dataset.state, 'ready');
  assert.equal(f.elements['arrival-status'].textContent, 'Ready');
  assert.equal(f.timers.size, 1);
  const finished = f.snapshot();
  f.api.progress('room', 0); f.api.stage('Late download'); f.api.finish();
  assert.equal(f.snapshot(), finished, 'Repeated completion and late download events must be inert');
  assert([...f.timers.values()].every(timer => timer.delay === 0), 'Ready must not add an artificial loading dwell');
  f.advance(0); assert(f.elements.loading.classList.contains('arrival-leaving'));
  assert.notEqual(f.elements.loading.style.display, 'none');
  f.advance(199); assert.notEqual(f.elements.loading.style.display, 'none');
  f.advance(1); assert.equal(f.elements.loading.style.display, 'none');
  assert.equal(f.elements.loading.getAttribute('aria-hidden'), 'true');
  assert(!f.documentElement.classList.contains('room-loading')); assert.equal(f.timers.size, 0);
}
{
  const f = fixture();
  f.api.progress('room', -.4); assert.equal(f.percent(), 0);
  f.api.progress('room', .5); const before = f.snapshot();
  for (const fraction of [NaN, Infinity, -Infinity, '1', undefined, null, {}]) f.api.progress('city', fraction);
  for (const task of ['unknown', '__proto__', 'constructor', 'toString', null, undefined]) f.api.progress(task, .5);
  assert.equal(f.snapshot(), before, 'Malformed progress events must not affect the visible meter');
  f.api.progress('city', 200); assert.equal(f.percent(), 51, 'Over-complete fractions should clamp at one');
  f.api.progress('city', -2); assert.equal(f.percent(), 51, 'A late negative fraction must not undo completion');
  checkProgress(f);
}
for (const failureMoment of ['before-ready', 'before-exit', 'during-fade', 'after-hidden']) {
  const f = fixture();
  f.api.progress('room', .5);
  if (failureMoment !== 'before-ready') f.api.finish();
  if (failureMoment === 'during-fade') f.advance(100);
  if (failureMoment === 'after-hidden') f.advance(200);
  f.api.fail('The room could not open. Your desktop is still available.');
  assert.equal(f.elements.arrival.dataset.state, 'error');
  assert.equal(f.elements['arrival-status'].textContent, 'The room could not open. Your desktop is still available.');
  assert.equal(f.elements.loading.style.display, 'flex');
  assert.equal(f.elements.loading.style.opacity, '1');
  assert.equal(f.elements.loading.getAttribute('aria-hidden'), null);
  assert(!f.elements.loading.classList.contains('arrival-leaving'));
  assert(f.documentElement.classList.contains('room-loading'));
  assert.equal(f.timers.size, 0, 'An old exit callback must not hide the error recovery link');
  const failed = f.snapshot();
  f.api.progress('room', 1); f.api.stage('Late update'); f.api.finish(); f.advance(10000);
  assert.equal(f.snapshot(), failed, 'Failure must survive late loader callbacks');
}
for (const reduced of [true, false]) {
  const f = fixture({ reduced });
  // Read the live preference at reveal time rather than caching its startup value.
  f.media.matches = true; f.api.finish();
  assert([...f.timers.values()].every(timer => timer.delay === 0));
  f.advance(0); assert.equal(f.elements.loading.style.display, 'none');
  assert.equal(f.timers.size, 0); assert(!f.documentElement.classList.contains('room-loading'));
}
for (const stage of ['loading', 'exit-pending', 'fade']) {
  const f = fixture();
  if (stage !== 'loading') f.api.finish();
  if (stage === 'fade') f.advance(0);
  f.api.dispose(); f.api.dispose();
  assert.equal(f.timers.size, 0, 'Disposal must cancel both reveal timers');
  const disposed = f.snapshot();
  f.api.progress('room', 1); f.api.stage('Late completion'); f.api.finish(); f.api.fail('Late failure');
  f.advance(10000);
  assert.equal(f.snapshot(), disposed, 'Disposal must make all subsequent loader callbacks inert');
}
console.log('PASS arrival: monotonic real progress, first-frame completion, quiet stage updates, continuous fill, failure recovery, reduced motion, disposal and classic/desktop isolation.');
