// Look-around camera: soft limits, walls, frame-rate independence and pose hand-off.
// Run: node tests/look-controls.cjs
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const repo = path.resolve(__dirname, '..');
const T = require(path.join(repo, 'shared/vendor/three.min.js'));
let clock = 0;
const sandbox = { window: {}, innerHeight: 900, performance: { now: () => clock } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(repo, 'shared/penthouse-look.js'), 'utf8'), sandbox);
const { create, DEFAULTS } = sandbox.window.PenthouseLook;

function element() {
  const handlers = {};
  return {
    clientHeight: 900,
    addEventListener(type, fn) { (handlers[type] ||= []).push(fn); },
    removeEventListener(type, fn) { handlers[type] = (handlers[type] || []).filter(h => h !== fn); },
    setPointerCapture() {},
    fire(type, event) { (handlers[type] || []).forEach(h => h(Object.assign({ button: 0, pointerType: 'mouse', pointerId: 1, preventDefault() {} }, event))); },
    count(type) { return (handlers[type] || []).length; }
  };
}
function setup(position = [9.7, 6.8, 16.4], target = [-3.5, 4.9, -5.5]) {
  const camera = new T.PerspectiveCamera(52, 16 / 9, .1, 4000);
  camera.position.set(...position);
  const dom = element();
  const look = create(T, camera, dom, { target: new T.Vector3(...target) });
  return { camera, dom, look };
}
function drag(dom, dx, dy, steps = 20) {
  dom.fire('pointerdown', { clientX: 500, clientY: 400 });
  for (let i = 1; i <= steps; i++) { clock += 16; dom.fire('pointermove', { clientX: 500 + dx * i / steps, clientY: 400 + dy * i / steps }); }
  clock += 200; // pause before release: no inertia
  dom.fire('pointerup', { clientX: 500 + dx, clientY: 400 + dy });
}
function settle(look, seconds, hz) { for (let i = 0; i < seconds * hz; i++) look.update(1 / hz); }
const close = (a, b, eps, label) => assert(Math.abs(a - b) < eps, `${label}: ${a} vs ${b}`);

// setPose round-trip: the camera keeps looking where the preset said.
{
  const { camera, look } = setup();
  const dir = new T.Vector3(-3.5, 4.9, -5.5).sub(new T.Vector3(9.7, 6.8, 16.4)).normalize();
  const actual = new T.Vector3(); camera.getWorldDirection(actual);
  assert(actual.angleTo(dir) < 1e-6, 'setPose preserves the view direction');
  assert.deepEqual(camera.position.toArray(), [9.7, 6.8, 16.4], 'setPose keeps an in-bounds position');
  close(look.target.distanceTo(camera.position), dir.length() * 0 + new T.Vector3(-3.5, 4.9, -5.5).distanceTo(camera.position), 1e-9, 'target keeps the preset distance');
}
// A horizontal drag turns the view in place; the camera does not orbit away.
{
  const { camera, dom, look } = setup();
  const before = camera.position.clone(), yaw = look.getState().yaw;
  drag(dom, 200, 0); settle(look, 1, 60);
  assert(camera.position.distanceTo(before) < 1e-9, 'Looking around never moves the camera');
  assert(look.getState().yaw > yaw + .1, 'Dragging right turns the view left (scene follows the finger)');
}
// Soft limits: overshoot is bounded while dragging and springs back on release.
{
  const { dom, look } = setup();
  dom.fire('pointerdown', { clientX: 500, clientY: 400 });
  for (let i = 1; i <= 200; i++) { clock += 16; dom.fire('pointermove', { clientX: 500 + i * 40, clientY: 400 - i * 30 }); look.update(1 / 60); }
  const held = look.getState();
  assert(held.goalYaw > DEFAULTS.yaw[1] && held.goalYaw <= DEFAULTS.yaw[1] + .16 + 1e-9, 'Yaw stretches a little past the edge, never far');
  assert(held.goalPitch < DEFAULTS.pitch[0] && held.goalPitch >= DEFAULTS.pitch[0] - .16 - 1e-9, 'Pitch stretches a little past the edge, never far');
  clock += 200; dom.fire('pointerup', {});
  settle(look, 2, 60);
  const s = look.getState();
  close(s.yaw, DEFAULTS.yaw[1], 1e-3, 'Yaw springs back to the edge');
  close(s.pitch, DEFAULTS.pitch[0], 1e-3, 'Pitch springs back to the edge');
  // Moving back inward is never resisted.
  const yaw = look.getState().goalYaw; drag(dom, -100, 0);
  close(look.getState().goalYaw, yaw - 100 * (52 * Math.PI / 180) * DEFAULTS.lookRate / 900, 1e-9, 'Inward drags move at full rate');
}
// Walking stops at the room bounds instead of fighting the camera afterwards.
{
  const { camera, dom, look } = setup([0, 5.4, 0], [0, 5.4, -10]);
  for (let i = 0; i < 200; i++) dom.fire('wheel', { deltaY: -240, deltaMode: 0 });
  settle(look, 3, 60);
  close(camera.position.z, DEFAULTS.bounds.min[2], 1e-3, 'Walking forward stops at the glass');
  close(camera.position.y, 5.4, 1e-9, 'Walking keeps eye height');
  for (let i = 0; i < 400; i++) dom.fire('wheel', { deltaY: 240, deltaMode: 0 });
  settle(look, 3, 60);
  close(camera.position.z, DEFAULTS.bounds.max[2], 1e-3, 'Walking back stops at the rear wall');
}
// Frame-rate independence: the same drag lands in the same place at 30 and 144 Hz.
{
  const results = [30, 60, 144].map(hz => {
    const { dom, look } = setup();
    dom.fire('pointerdown', { clientX: 0, clientY: 0 });
    clock += 16; dom.fire('pointermove', { clientX: 120, clientY: 40 });
    clock += 200; dom.fire('pointerup', {});
    const states = [];
    for (const seconds of [.1, .25, 1]) { settle(look, seconds - (states.length ? [.1, .25][states.length - 1] : 0), hz); states.push(look.getState().yaw); }
    return states;
  });
  for (let i = 0; i < 3; i++) {
    close(results[0][i], results[2][i], .002, 'Yaw after ' + [.1, .25, 1][i] + 's matches at 30 and 144 Hz');
    close(results[1][i], results[2][i], .002, 'Yaw after ' + [.1, .25, 1][i] + 's matches at 60 and 144 Hz');
  }
}
// Release momentum continues a flick and decays; a held stop has none.
{
  const { dom, look } = setup();
  dom.fire('pointerdown', { clientX: 500, clientY: 400 });
  for (let i = 1; i <= 5; i++) { clock += 16; dom.fire('pointermove', { clientX: 500 + i * 8, clientY: 400 }); }
  clock += 10; dom.fire('pointerup', {});
  const released = look.getState().goalYaw; settle(look, 2, 60);
  assert(look.getState().goalYaw > released + .01, 'A flick keeps turning after release');
  const coasted = look.getState().goalYaw; settle(look, 2, 60);
  assert(look.getState().goalYaw - coasted < .002, 'Momentum decays to rest');
}
// Disabled controllers ignore input; dispose removes every listener.
{
  const { camera, dom, look } = setup();
  look.enabled = false;
  const before = look.getState(); drag(dom, 300, 100);
  for (let i = 0; i < 5; i++) dom.fire('wheel', { deltaY: -200, deltaMode: 0 });
  look.update(1 / 60);
  assert.deepEqual(look.getState(), before, 'Disabled look ignores drags and wheel');
  assert.deepEqual(camera.position.toArray(), [9.7, 6.8, 16.4]);
  look.dispose();
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'wheel']) assert.equal(dom.count(type), 0, type + ' listener removed');
}
console.log('PASS look controls: pose round-trip, look-in-place, soft yaw/pitch limits with spring-back, unresisted return, wall-bounded walking, 30/60/144 Hz agreement, decaying momentum, disable and disposal.');
