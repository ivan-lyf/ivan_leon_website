// Physical attachment regressions for the production city geometry.
// Uses transformed endpoints and bounding boxes; no renderer or extra packages.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const T = require('../shared/vendor/three.min.js');
const file = path.join(__dirname, '../shared/penthouse-architecture.js');
const source = fs.readFileSync(file, 'utf8');
const beamSignature = 'function beam(b,ax,ay,az,bx,by,bz,width,depth){';
assert(source.includes(beamSignature), 'Update the production beam instrumentation boundary');
function populate(code, lite = false) {
  const context = { window: { beamTargets: [] } };
  vm.runInNewContext(code.replace(beamSignature, beamSignature + '\nwindow.beamTargets.push({a:[ax,ay,az],b:[bx,by,bz],width:width,depth:depth});'), context);
  let state = 74192;
  const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  const options = { THREE: T, lite, random, range: (a, b) => a + random() * (b - a),
    towers: [], structure: [], ribs: [], cyan: [], magenta: [], beacons: [],
    block(list, x, y, z, w, h, d, seed) { list.push({ x, y, z, w, h, d, seed: seed || random() }); }
  };
  context.window.PenthouseArchitecture.populate(options);
  return { ...options, targets: context.window.beamTargets };
}
function contains(part, point, kind) {
  const local = point.clone().sub(new T.Vector3(part.x, part.y, part.z));
  if (part.rotation) local.applyQuaternion(new T.Quaternion().setFromEuler(new T.Euler().fromArray(part.rotation.concat('XYZ'))).invert());
  const epsilon = .005;
  if (Math.abs(local.y) > part.h / 2 + epsilon) return false;
  if (part.shape === 'round') return (local.x / (part.w / 2)) ** 2 + (local.z / (part.d / 2)) ** 2 <= 1.001;
  if (Math.abs(local.x) > part.w / 2 + epsilon || Math.abs(local.z) > part.d / 2 + epsilon) return false;
  // Occupied rectangular geometry has the production 4.5% corner chamfer.
  return kind !== 'towers' || Math.abs(local.x) / part.w + Math.abs(local.z) / part.d <= .955 + epsilon;
}
function endpointErrors(scene, checkMounts = false) {
  return scene.targets.map(target => {
    const a = new T.Vector3().fromArray(target.a), b = new T.Vector3().fromArray(target.b);
    const center = a.clone().add(b).multiplyScalar(.5);
    const beam = scene.ribs.find(part => part.rotation && part.w === target.width && part.d === target.depth &&
      new T.Vector3(part.x, part.y, part.z).distanceTo(center) < 1e-8);
    assert(beam, 'Every intended structural brace must exist in the rendered rib instances');
    const rotation = new T.Euler().fromArray(beam.rotation.concat('XYZ'));
    const endA = new T.Vector3(0, -beam.h / 2, 0).applyEuler(rotation).add(center);
    const endB = new T.Vector3(0, beam.h / 2, 0).applyEuler(rotation).add(center);
    if (checkMounts) for (const end of [-1, 1]) {
      // Test the actual rendered beam end section against physical supporting
      // geometry; merely agreeing with a planned endpoint is not enough.
      const samples = [[0, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, z]) =>
        new T.Vector3(x * beam.w / 2, end * beam.h / 2, z * beam.d / 2).applyEuler(rotation).add(center));
      const mounted = ['towers', 'structure', 'ribs'].some(kind => scene[kind].some(part =>
        part !== beam && part.buildingId === beam.buildingId && samples.some(point => contains(part, point, kind))));
      assert(mounted, 'Brace end has no physical mount: ' + JSON.stringify({ building: beam.buildingId, end, target: end < 0 ? target.a : target.b }));
    }
    return Math.max(endA.distanceTo(a), endB.distanceTo(b));
  });
}
function bounds(p) {
  const box = new T.Box3(new T.Vector3(-p.w / 2, -p.h / 2, -p.d / 2), new T.Vector3(p.w / 2, p.h / 2, p.d / 2));
  if (p.rotation) box.applyMatrix4(new T.Matrix4().makeRotationFromEuler(new T.Euler().fromArray(p.rotation.concat('XYZ'))));
  return box.translate(new T.Vector3(p.x, p.y, p.z));
}
// Broad-phase attachment audit. AABB overlap can overestimate contact for curved
// or rotated parts, so this only proves the absence of completely isolated
// assemblies; the brace endpoint test above verifies their actual orientation.
function isolated(scene) {
  const groups = new Map();
  for (const kind of ['towers', 'structure', 'ribs', 'cyan', 'magenta']) for (const p of scene[kind]) {
    const parts = groups.get(p.buildingId) || [];
    parts.push({ ...p, kind, box: bounds(p) }); groups.set(p.buildingId, parts);
  }
  const loose = [];
  for (const parts of groups.values()) {
    const attached = new Set(parts.filter(p => p.kind === 'towers'));
    let progress = true;
    while (progress) {
      progress = false;
      for (const part of parts) if (!attached.has(part) && Array.from(attached).some(other =>
        part.box.clone().expandByScalar(.03).intersectsBox(other.box))) {
        attached.add(part); progress = true;
      }
    }
    loose.push(...parts.filter(p => !attached.has(p)));
  }
  return loose;
}
const full = populate(source), lite = populate(source, true);
const errors = endpointErrors(full, true);
assert(Math.max(...errors) < 1e-8, 'A brace misses its designed mounting points by ' + Math.max(...errors).toFixed(3) + ' m');
assert.equal(JSON.stringify(lite.ribs), JSON.stringify(full.ribs), 'Physical attachments must remain identical across quality tiers');
// Retain the historical facade-only rotation as a failing control, so the
// endpoint assertion cannot silently turn into a test of its own fixture.
const oldRotation = source.replace('[rotation.x,rotation.y,rotation.z]', '[0,0,-Math.atan2(dx,dy)]');
assert.notEqual(oldRotation, source, 'Update the historical rotation mutation boundary');
assert(Math.max(...endpointErrors(populate(oldRotation))) > 1, 'The old rotation must expose a detached depth brace');
const loose = isolated(full);
assert.equal(loose.length, 0, 'Completely detached parts: ' + JSON.stringify(loose.slice(0, 6).map(({ kind, buildingId, x, y, z }) => ({ kind, buildingId, x, y, z }))));
console.log('PASS building attachments: ' + full.targets.length + ' braces reach both physical mounting points; old rotation fails control; no disconnected assemblies in the AABB broad-phase audit; identical full/lite geometry.');
