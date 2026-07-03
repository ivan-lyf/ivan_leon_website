/* scene-audio.js — synthesized ambient room tone (Web Audio, no asset).
 * Brown-noise bed, low-passed to a soft hum, gentle slow swell. Starts only
 * after the first user gesture (autoplay policy), fades in over ~3s, suspends
 * when the tab is hidden. Mute chip bottom-right, persisted in localStorage. */
(function () {
  const KEY = 'ambient-muted';
  const TARGET_VOL = 0.14;                        // ambient bed, clearly present
  let ctx = null, master = null, started = false;
  let muted = localStorage.getItem(KEY) === '1';

  function buildGraph() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    // wheel/scroll may not count as an activation gesture in every engine — a freshly
    // built context can come up 'suspended'; resume so the fade-in is actually audible
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
    const sr = ctx.sampleRate, secs = 6, len = sr * secs;
    const buf = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len; i++) {             // brown noise
        last = (last + (Math.random() * 2 - 1) * 0.02) * 0.997;
        d[i] = last * 3.0;
      }
      const fade = sr * 0.8 | 0;                  // crossfade tail->head = seamless loop
      for (let i = 0; i < fade; i++) {
        const t = i / fade;
        d[i] = d[i] * t + d[len - fade + i] * (1 - t);
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    src.loopStart = 0; src.loopEnd = secs - 0.8;  // loop inside the crossfaded region
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.4;
    master = ctx.createGain(); master.gain.value = 0;
    const swell = ctx.createGain(); swell.gain.value = 1;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06;   // slow breathing
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 0.18;
    lfo.connect(lfoAmt); lfoAmt.connect(swell.gain);
    src.connect(lp); lp.connect(swell); swell.connect(master); master.connect(ctx.destination);
    src.start(); lfo.start();
  }
  function fadeTo(v, secs) {
    if (!master) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(v, ctx.currentTime + secs);
  }
  function start() {
    if (started) return; started = true;
    buildGraph();
    if (!muted) fadeTo(TARGET_VOL, 3);
    ['pointerdown', 'wheel', 'keydown'].forEach(function (t) { window.removeEventListener(t, start); });
  }
  ['pointerdown', 'wheel', 'keydown'].forEach(function (t) { window.addEventListener(t, start, { passive: true }); });

  document.addEventListener('visibilitychange', function () {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else if (!muted) ctx.resume();
  });

  // --- mute chip (matches #hud styling) ---
  const btn = document.createElement('button');
  btn.id = 'audio-toggle'; btn.type = 'button';
  btn.setAttribute('aria-label', 'Toggle ambient sound');
  function paint() {
    btn.textContent = muted ? '🔇' : '🔊';
    btn.setAttribute('aria-label', muted ? 'Unmute ambient sound' : 'Mute ambient sound');
  }
  paint();
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    muted = !muted; localStorage.setItem(KEY, muted ? '1' : '0'); paint();
    if (!started) { if (!muted) start(); return; }
    if (muted) fadeTo(0, 0.6); else { ctx.resume(); fadeTo(TARGET_VOL, 1.2); }
  });
  document.body.appendChild(btn);

  window.SceneAudio = {
    muted: function () { return muted; },
    setMuted: function (m) { if (m !== muted) btn.click(); }
  };
})();
