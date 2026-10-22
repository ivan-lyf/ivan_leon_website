/* A small DOM-only arrival display. Progress follows actual scene work; no timer simulates it. */
(function () {
  'use strict';
  if (window.ROOM_MODE !== 'penthouse') return;
  const overlay = document.getElementById('loading');
  const panel = document.getElementById('arrival');
  if (!overlay || !panel) return;
  const status = document.getElementById('arrival-status');
  const percent = document.getElementById('arrival-percent');
  const meter = document.getElementById('arrival-progress');
  const fill = document.getElementById('arrival-fill');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const weights = { city: 22, room: 58, traffic: 15, view: 5 };
  const tasks = { city: 0, room: 0, traffic: 0, view: 0 };
  let value = 0, failed = false, finished = false, disposed = false, hideTimer, exitTimer;
  document.documentElement.classList.add('room-loading');

  function render() {
    value = Math.round(Object.keys(weights).reduce((sum, key) => sum + weights[key] * tasks[key], 0));
    // 100 means the first rendered frame is ready, not merely that downloads finished.
    if (!finished) value = Math.min(value, 99);
    percent.textContent = String(value);
    meter.setAttribute('aria-valuenow', String(value));
    fill.style.transform = 'scaleX(' + value / 100 + ')';
  }
  function progress(task, fraction) {
    if (disposed || failed || finished || !Object.prototype.hasOwnProperty.call(weights, task) || !Number.isFinite(fraction)) return;
    tasks[task] = Math.max(tasks[task], Math.min(1, Math.max(0, fraction)));
    render();
  }
  // Preserve the scene's stage hook while keeping the loading copy quiet.
  function stage() {}
  function finish() {
    if (disposed || failed || finished) return;
    finished = true;
    Object.keys(tasks).forEach(key => tasks[key] = 1);
    render(); status.textContent = 'Ready'; panel.dataset.state = 'ready';
    // Reveal immediately once the first frame is ready; no minimum display time.
    exitTimer = setTimeout(() => {
      overlay.classList.add('arrival-leaving');
      hideTimer = setTimeout(() => {
        overlay.style.display = 'none'; overlay.setAttribute('aria-hidden', 'true');
        document.documentElement.classList.remove('room-loading');
      }, reduced.matches ? 0 : 200);
    }, 0);
  }
  function fail(message) {
    if (disposed) return;
    clearTimeout(exitTimer); clearTimeout(hideTimer);
    failed = true; panel.dataset.state = 'error';
    overlay.classList.remove('arrival-leaving'); overlay.style.display = 'flex';
    overlay.style.opacity = '1'; overlay.removeAttribute('aria-hidden');
    document.documentElement.classList.add('room-loading');
    status.textContent = message;
  }
  function dispose() { disposed = true; clearTimeout(exitTimer); clearTimeout(hideTimer); }
  window.PenthouseArrival = { progress, stage, finish, fail, dispose };
  render();
}());
