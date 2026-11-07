/* Look-around camera for the penthouse. Three.js r128.
 * Drag turns the view in place (yaw/pitch); wheel or pinch walks along the floor.
 * Everything is smoothed per second, not per frame, so it feels the same at
 * 30, 60 or 144 Hz and when frames drop. Limits are soft: input past an edge is
 * damped and the view springs back, instead of stopping dead.
 * create(T, camera, element, options) -> controller with the small surface the
 * scene uses: enabled, target, setPose, update(dt), nudge, walk, addEventListener('start'), dispose.
 */
(function () {
  'use strict';
  const DEFAULTS = {
    yaw: [-.95, 1.5],          // radians; 0 looks along -z (out of the window)
    pitch: [-.62, .36],
    bounds: { min: [-12.6, 1.2, -6.4], max: [12.6, 12, 20.5] },
    lookRate: 1.1,              // screen heights of drag per vertical field of view
    smoothing: 14,              // 1/s; higher follows the pointer more tightly
    walkSmoothing: 8,
    inertiaDecay: 5,            // 1/s
    spring: 9,                  // 1/s pull back inside soft limits
    walkPerWheelPixel: .02,
    walkPerPinchPixel: .045
  };

  function create(T, camera, element, options = {}) {
    const o = Object.assign({}, DEFAULTS, options);
    const min = new T.Vector3(...o.bounds.min), max = new T.Vector3(...o.bounds.max);
    const controller = new T.EventDispatcher();
    const position = camera.position.clone(), goalPosition = position.clone();
    const target = new T.Vector3(), forward = new T.Vector3();
    let yaw = 0, pitch = 0, goalYaw = 0, goalPitch = 0, lookDistance = 6;
    let velocityYaw = 0, velocityPitch = 0, lastMove = 0, enabled = true, disposed = false;
    const pointers = new Map();
    let pinchDistance = 0;
    const listeners = [];
    function on(type, fn, opts) { element.addEventListener(type, fn, opts); listeners.push(() => element.removeEventListener(type, fn, opts)); }
    const clamp = T.MathUtils.clamp;

    function direction(y, p, out) {
      return out.set(-Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p));
    }
    function syncTarget() { target.copy(position).addScaledVector(direction(yaw, pitch, forward), lookDistance); }
    function applyCamera() { camera.position.copy(position); syncTarget(); camera.lookAt(target); }
    // Past a limit, each further unit of input moves the view progressively less.
    const OVERSHOOT = .16;
    function resist(value, delta, lo, hi) {
      const next = value + delta;
      // Moving back toward the allowed range is never resisted.
      if (!(delta > 0 && next > hi) && !(delta < 0 && next < lo)) return next;
      // Move freely up to the edge, then let the remainder stretch like a band.
      const edge = delta > 0 ? hi : lo, free = delta > 0 ? Math.max(0, edge - value) : Math.min(0, edge - value);
      const over = Math.abs(value + free - edge);
      const stretched = value + free + (delta - free) * .3 / (1 + over * 14);
      return clamp(stretched, lo - OVERSHOOT, hi + OVERSHOOT);
    }
    function rate() { return T.MathUtils.degToRad(camera.fov) * o.lookRate / Math.max(1, element.clientHeight || innerHeight); }
    function look(dx, dy) {
      const r = rate();
      // The scene follows the finger, as when grabbing a panorama.
      goalYaw = resist(goalYaw, dx * r, o.yaw[0], o.yaw[1]);
      goalPitch = resist(goalPitch, dy * r, o.pitch[0], o.pitch[1]);
    }
    function walk(amount) {
      if (!enabled) return;
      const flat = direction(goalYaw, 0, new T.Vector3());
      goalPosition.addScaledVector(flat, amount).clamp(min, max);
      controller.dispatchEvent({ type: 'start' });
    }

    on('pointerdown', e => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { element.setPointerCapture(e.pointerId); } catch (_) { /* capture is optional */ }
      velocityYaw = velocityPitch = 0;
      if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchDistance = Math.hypot(a.x - b.x, a.y - b.y); }
      if (enabled) controller.dispatchEvent({ type: 'start' });
    });
    on('pointermove', e => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (!enabled) return;
      if (pointers.size >= 2) {
        const [a, b] = [...pointers.values()], distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDistance) walk((distance - pinchDistance) * o.walkPerPinchPixel);
        pinchDistance = distance; return;
      }
      const beforeYaw = goalYaw, beforePitch = goalPitch, now = performance.now();
      look(dx, dy);
      const dt = Math.max(.008, (now - lastMove) / 1000);
      // A short running average of the drag speed becomes the release momentum.
      velocityYaw = velocityYaw * .6 + (goalYaw - beforeYaw) / dt * .4;
      velocityPitch = velocityPitch * .6 + (goalPitch - beforePitch) / dt * .4;
      lastMove = now;
    });
    function release(e) {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchDistance = 0;
      // Only a pointer that was still moving when released keeps its momentum.
      if (performance.now() - lastMove > 70) velocityYaw = velocityPitch = 0;
    }
    on('pointerup', release); on('pointercancel', release);
    on('lostpointercapture', release);
    on('wheel', e => {
      if (!enabled) return;
      e.preventDefault();
      const pixels = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      walk(-clamp(pixels, -240, 240) * o.walkPerWheelPixel);
    }, { passive: false });

    function springBack(value, lo, hi, k) {
      if (value > hi) return hi + (value - hi) * k;
      if (value < lo) return lo + (value - lo) * k;
      return value;
    }
    function update(dt = 1 / 60) {
      if (disposed || !enabled) return;
      dt = clamp(dt, 0, .1);
      const dragging = pointers.size > 0;
      if (!dragging && (velocityYaw || velocityPitch)) {
        goalYaw += velocityYaw * dt; goalPitch += velocityPitch * dt;
        const decay = Math.exp(-o.inertiaDecay * dt);
        velocityYaw *= decay; velocityPitch *= decay;
        if (Math.abs(velocityYaw) + Math.abs(velocityPitch) < .002) velocityYaw = velocityPitch = 0;
      }
      if (!dragging) {
        const k = Math.exp(-o.spring * dt);
        const yawOut = goalYaw < o.yaw[0] || goalYaw > o.yaw[1], pitchOut = goalPitch < o.pitch[0] || goalPitch > o.pitch[1];
        goalYaw = springBack(goalYaw, o.yaw[0], o.yaw[1], k);
        goalPitch = springBack(goalPitch, o.pitch[0], o.pitch[1], k);
        if (yawOut) velocityYaw = 0;
        if (pitchOut) velocityPitch = 0;
      }
      const follow = 1 - Math.exp(-o.smoothing * dt), move = 1 - Math.exp(-o.walkSmoothing * dt);
      yaw += (goalYaw - yaw) * follow; pitch += (goalPitch - pitch) * follow;
      position.lerp(goalPosition, move);
      applyCamera();
    }
    // Adopt a camera placement (preset arrival, interrupted flight) without a jump.
    function setPose(eye, lookAt) {
      position.copy(eye).clamp(min, max); goalPosition.copy(position);
      const d = new T.Vector3().subVectors(lookAt, eye);
      lookDistance = Math.max(.5, d.length()); d.normalize();
      yaw = goalYaw = Math.atan2(-d.x, -d.z);
      pitch = goalPitch = Math.asin(clamp(d.y, -1, 1));
      velocityYaw = velocityPitch = 0;
      applyCamera();
    }
    function nudge(dYaw, dPitch) {
      if (!enabled) return;
      goalYaw = clamp(goalYaw + dYaw, o.yaw[0], o.yaw[1]);
      goalPitch = clamp(goalPitch + dPitch, o.pitch[0], o.pitch[1]);
      controller.dispatchEvent({ type: 'start' });
    }
    function dispose() { disposed = true; listeners.forEach(fn => fn()); pointers.clear(); }

    Object.defineProperty(controller, 'enabled', {
      get: () => enabled,
      set: value => { enabled = !!value; if (!enabled) { velocityYaw = velocityPitch = 0; } }
    });
    Object.assign(controller, {
      target, update, setPose, nudge, walk, dispose,
      isDragging: () => pointers.size > 0,
      getState: () => ({ yaw, pitch, goalYaw, goalPitch, position: position.toArray(), goalPosition: goalPosition.toArray(), lookDistance }),
      limits: o
    });
    setPose(camera.position, options.target || new T.Vector3(0, camera.position.y, camera.position.z - 1));
    return controller;
  }
  window.PenthouseLook = { create, DEFAULTS };
}());
