/* Street signal pack v2: design library for the rain city's tenant signage.
 * Pure canvas drawing, no three.js. Shared by penthouse-signage.js (atlas for the
 * instanced city signs) and the LED Banners gallery, so previews are the in-scene
 * textures. Five techniques: neon tube, backlit lightbox, LED matrix, channel
 * letters, LCD poster. Nine scripts plus pictograms.
 *
 * Detail model: every sign is a physical object. Neon sits on painted steel
 * backers, contour-cut plates or raceways with transformers, conduit, GTO
 * electrodes and cast shadows; glass tube bodies stay visible when unlit.
 * Lightboxes have extruded frames, fluorescent banding (sometimes a dead tube),
 * corner screws and dirt runoff. LED cabinets have module seams, dead pixels and
 * per-module tint. LCDs have bezels, pixel grids and glare. A weathering pass
 * (runoff streaks, grime, specks) runs on every opaque sign.
 *
 * window.PenthouseSignageDesigns = {
 *   designs, byId, CELL, SIZE, ANIM, STYLE,
 *   render(design, frame, scale) -> canvas            one frame of one sign
 *   buildAtlas(designs, {maxH}) -> {canvas,width,height,scale}  sets d.rect=[x,y,w,h], d.cellW (px)
 *   visible(design) -> [w,h]                          visible cell px (tickers show a window)
 *   paint(ctx, design, frames, t, opts, dx,dy,dw,dh)  2D animation matching the city shader
 * }
 * anim: 0 static, 1 two-frame flip, 2 chaser, 3 blink, 4 pulse, 5 ticker scroll (x),
 *       6 wipe-on, 7 rolling stripes (y). view: visible fraction for 5/7.
 */
(function () {
  'use strict';
  var F = {
    jp: '"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",sans-serif',
    min: '"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP","Noto Serif CJK JP",serif',
    tc: '"PingFang TC","Heiti TC","Noto Sans TC","Microsoft JhengHei","Noto Sans CJK TC",sans-serif',
    tcs: '"Songti TC","LiSong Pro","Noto Serif TC","PMingLiU",serif',
    kr: '"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic","Noto Sans CJK KR",sans-serif',
    th: '"Thonburi","Noto Sans Thai","Leelawadee UI",sans-serif',
    hi: '"Kohinoor Devanagari","Devanagari Sangam MN","Noto Sans Devanagari","Nirmala UI",sans-serif',
    ar: '"Geeza Pro","Noto Sans Arabic","Segoe UI",sans-serif',
    latin: '"Arial Narrow","Helvetica Neue",Arial,sans-serif',
    heavy: '"Helvetica Neue",Arial,sans-serif',
    serif: '"Didot","Bodoni 72","Times New Roman",serif',
    script: '"Snell Roundhand","Brush Script MT","Segoe Script",cursive',
    mono: 'Menlo,"DejaVu Sans Mono",Consolas,monospace'
  };
  var CELL = { v: [150, 600], t: [110, 600], h: [600, 150], w: [760, 190], s: [300, 340], c: [300, 300], m: [2040, 112], p: [360, 480], x: [200, 700] };
  var SIZE = { v: [1.4, 2.6], t: [1.0, 1.5], h: [4.5, 9], w: [6, 11], s: [1.6, 5.5], c: [1.6, 3.4], m: [6, 11], p: [3, 6], x: [1.2, 2] };
  var LEVEL = { neon: 1, channel: .85, lightbox: .42, matrix: .9, screen: .55 };
  var ANIM = ['Static', 'Two-frame flip', 'Chaser', 'Blink', 'Pulse', 'Ticker scroll', 'Wipe-on', 'Rolling stripes'];
  var STYLE = { neon: 'Neon tube', lightbox: 'Backlit lightbox', matrix: 'LED matrix', channel: 'Channel letters', screen: 'LCD poster' };
  var TAU = Math.PI * 2;

  // ---------------- primitives ----------------
  function prng(seed) { var s = Math.floor((seed % 1) * 2147483000) + 7; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  function off(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
  function rr(x, X, Y, W, H, R) { R = Math.max(0, Math.min(R, W / 2, H / 2)); x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R); x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath(); }
  function shape(x, X, Y, W, H, R, round) { if (round) { x.beginPath(); x.ellipse(X + W / 2, Y + H / 2, Math.max(1, W / 2), Math.max(1, H / 2), 0, 0, TAU); } else rr(x, X, Y, W, H, R); }
  function fit(x, text, size, maxW, weight, family) { x.font = weight + ' ' + size + 'px ' + family; var w = x.measureText(text).width; if (maxW && w > maxW) { size *= maxW / w; x.font = weight + ' ' + size + 'px ' + family; } return size; }
  function screws(x, pts, r) {
    pts.forEach(function (p) { x.save(); var g = x.createRadialGradient(p[0] - r * .35, p[1] - r * .35, 0, p[0], p[1], r); g.addColorStop(0, '#a3a8ad'); g.addColorStop(1, '#25272b');
      x.fillStyle = g; x.beginPath(); x.arc(p[0], p[1], r, 0, TAU); x.fill(); x.strokeStyle = '#0d0d0e'; x.lineWidth = Math.max(.7, r * .32); x.beginPath(); x.moveTo(p[0] - r * .6, p[1] + r * .2); x.lineTo(p[0] + r * .6, p[1] - r * .2); x.stroke(); x.restore(); });
  }
  // Neon lettering: glass body (visible when off), cast shadow, coloured glow, hot core.
  function neonText(x, text, cx, cy, size, color, family, o) {
    o = o || {}; x.save(); var s = fit(x, text, size, o.maxW, o.weight || '700', family); x.textAlign = o.align || 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.lineCap = 'round';
    var lw = Math.max(2, s * .07);
    if (o.cast !== false) { x.save(); x.globalAlpha = .6; x.shadowColor = 'rgba(0,0,0,.9)'; x.shadowBlur = s * .06; x.shadowOffsetX = s * .035; x.shadowOffsetY = s * .06; x.fillStyle = 'rgba(0,0,0,.01)'; x.strokeStyle = 'rgba(0,0,0,.01)'; x.lineWidth = lw * 1.4; if (o.tube) x.strokeText(text, cx, cy); else x.fillText(text, cx, cy); x.restore(); }
    x.strokeStyle = '#2b2f36'; x.lineWidth = o.tube ? lw * 1.75 : Math.max(2, s * .045); x.strokeText(text, cx, cy);
    if (o.off) { x.restore(); return s; }
    if (o.tube) {
      x.strokeStyle = color; x.shadowColor = color; x.shadowBlur = s * .3; x.lineWidth = lw; x.strokeText(text, cx, cy);
      x.shadowBlur = s * .05; x.lineWidth = Math.max(1, s * .024); x.strokeStyle = '#fff'; x.globalAlpha = .75; x.strokeText(text, cx, cy);
    } else {
      x.fillStyle = color; x.shadowColor = color; x.shadowBlur = s * .36; x.fillText(text, cx, cy);
      x.shadowBlur = s * .06; x.globalAlpha = .5; x.fillStyle = '#fff'; x.fillText(text, cx, cy);
    }
    x.restore(); return s;
  }
  function ink(x, text, cx, cy, size, color, family, o) {
    o = o || {}; x.save(); var s = fit(x, text, size, o.maxW, o.weight || '800', family); x.textAlign = o.align || 'center'; x.textBaseline = 'middle';
    if (o.stroke) { x.strokeStyle = o.stroke; x.lineWidth = s * (o.strokeW || .1); x.lineJoin = 'round'; x.strokeText(text, cx, cy); }
    x.fillStyle = color; x.fillText(text, cx, cy); x.restore(); return s;
  }
  function vtext(x, text, cx, top, bottom, width, color, family, mode, o) {
    var g = Array.from(text), step = (bottom - top) / g.length, s = Math.min(width, step * .88);
    g.forEach(function (c, k) { var cy = top + step * (k + .5); if (mode === 'ink') ink(x, c, cx, cy, s, color, family, o); else neonText(x, c, cx, cy, s, color, family, o); });
  }
  function channel(x, text, cx, cy, size, face, family, o) {
    o = o || {}; x.save(); var s = fit(x, text, size, o.maxW, '900', family); x.textAlign = 'center'; x.textBaseline = 'middle';
    for (var i = 8; i > 0; i--) { x.fillStyle = i > 1 ? '#1b1815' : '#302a25'; x.fillText(text, cx + i * s * .007, cy + i * s * .011); }
    x.fillStyle = face; x.shadowColor = face; x.shadowBlur = s * .2; x.fillText(text, cx, cy);
    x.shadowBlur = 0; x.lineWidth = Math.max(1.5, s * .025); x.strokeStyle = 'rgba(255,255,255,.55)'; x.strokeText(text, cx, cy);
    var g = x.createLinearGradient(0, cy - s / 2, 0, cy + s / 2); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.15)'); x.fillStyle = g; x.fillText(text, cx, cy); x.restore();
  }
  function backer(x, X, Y, W, H, r, color, R, o) {
    o = o || {}; x.save(); shape(x, X, Y, W, H, r, o.round); x.fillStyle = color; x.fill(); x.clip(); var i;
    for (i = 0; i < 110; i++) { var wht = R() < .4; x.globalAlpha = wht ? .008 + R() * .018 : .03 + R() * .05; x.fillStyle = wht ? '#ffffff' : '#000000'; x.fillRect(X, Y + R() * H, W, 1 + R() * 2); }
    var g = x.createLinearGradient(0, Y, 0, Y + H); g.addColorStop(0, 'rgba(255,255,255,.06)'); g.addColorStop(.55, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(48,28,10,.5)'); x.globalAlpha = 1; x.fillStyle = g; x.fillRect(X, Y, W, H);
    for (i = 0; i < (o.drips === undefined ? 6 : o.drips); i++) { var dx = X + 10 + R() * (W - 20), dy = Y + R() * H * .45, dl = 16 + R() * H * .55, dg = x.createLinearGradient(0, dy, 0, dy + dl); dg.addColorStop(0, 'rgba(130,64,22,.55)'); dg.addColorStop(1, 'rgba(130,64,22,0)'); x.fillStyle = dg; x.fillRect(dx, dy, 1.2 + R() * 2.6, dl); }
    for (i = 0; i < 90; i++) { x.globalAlpha = .1 + R() * .25; x.fillStyle = R() < .5 ? '#8a6a48' : '#050505'; x.fillRect(X + R() * W, Y + R() * H, 1 + R() * 2, 1 + R() * 2); }
    x.strokeStyle = 'rgba(255,255,255,.14)'; x.lineWidth = 1; for (i = 0; i < 12; i++) { x.globalAlpha = .3 + R() * .5; var sx = X + R() * W, sy = Y + R() * H; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + (R() - .5) * 46, sy + (R() - .5) * 10); x.stroke(); }
    x.restore();
    x.save(); x.lineWidth = 2; shape(x, X + 1, Y + 1, W - 2, H - 2, r, o.round); x.strokeStyle = 'rgba(255,255,255,.16)'; x.stroke(); shape(x, X + 3.5, Y + 3.5, W - 7, H - 7, r, o.round); x.strokeStyle = 'rgba(0,0,0,.65)'; x.stroke(); x.restore();
    if (!o.round && o.rivets !== false) screws(x, [[X + 9, Y + 9], [X + W - 9, Y + 9], [X + 9, Y + H - 9], [X + W - 9, Y + H - 9]], 3.2);
  }
  // Contour-cut plate: dilated silhouette of the artwork, rim, standoff bolts.
  function contour(x, cw, ch, body, R, o) {
    o = o || {}; var r = o.r || 13, src = off(cw, ch), sc = src.getContext('2d'); body(sc);
    var d = sc.getImageData(0, 0, src.width, src.height).data, mask = off(cw, ch), mc = mask.getContext('2d'), md = mc.createImageData(src.width, src.height);
    for (var i = 0; i < d.length; i += 4) if (d[i + 3] > 120) { md.data[i] = md.data[i + 1] = md.data[i + 2] = 255; md.data[i + 3] = 255; }
    mc.putImageData(md, 0, 0);
    function stamp(rad, color) { var t = off(cw, ch), tc = t.getContext('2d'); [1, .66, .33].forEach(function (k) { for (var j = 0; j < 24; j++) { var a = j / 24 * TAU; tc.drawImage(mask, Math.cos(a) * rad * k, Math.sin(a) * rad * k); } }); tc.globalCompositeOperation = 'source-in'; tc.fillStyle = color; tc.fillRect(0, 0, cw, ch); return t; }
    var rim = stamp(r, '#3a3d43'), plate = stamp(r - 2.5, o.color || '#0e0f12'), pc = plate.getContext('2d');
    pc.globalCompositeOperation = 'source-atop'; var g = pc.createLinearGradient(0, 0, 0, ch); g.addColorStop(0, 'rgba(255,255,255,.05)'); g.addColorStop(1, 'rgba(50,30,12,.4)'); pc.fillStyle = g; pc.fillRect(0, 0, cw, ch);
    for (i = 0; i < 120; i++) { pc.globalAlpha = .1 + R() * .3; pc.fillStyle = R() < .5 ? '#7a5a38' : '#000'; pc.fillRect(R() * cw, R() * ch, 1 + R() * 2, 1 + R() * 2); }
    x.drawImage(rim, 0, 0); x.drawImage(plate, 0, 0);
    var pd = plate.getContext('2d').getImageData(0, 0, plate.width, plate.height).data, bolts = [];
    for (var tries = 0; tries < 400 && bolts.length < (o.bolts || 5); tries++) { var bx = R() * cw | 0, by = R() * ch | 0, p = (by * plate.width + bx) * 4; if (pd[p + 3] > 200 && d[p + 3] < 10 && bolts.every(function (q) { return Math.hypot(q[0] - bx, q[1] - by) > 40; })) bolts.push([bx, by]); }
    screws(x, bolts, 2.6); x.drawImage(src, 0, 0);
  }
  function raceway(x, X, Y, W, H, R, o) {
    o = o || {}; x.save(); var g = x.createLinearGradient(0, Y, 0, Y + H); g.addColorStop(0, '#3e4146'); g.addColorStop(.45, '#26282c'); g.addColorStop(1, '#131416'); x.fillStyle = g; rr(x, X, Y, W, H, 3); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = 1; x.beginPath(); x.moveTo(X + 3, Y + 1.5); x.lineTo(X + W - 3, Y + 1.5); x.stroke();
    for (var sx = X + 80 + R() * 40; sx < X + W - 30; sx += 130 + R() * 70) { x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(sx, Y, 1.5, H); }
    var dg = x.createLinearGradient(0, Y, 0, Y + H); dg.addColorStop(0, 'rgba(0,0,0,0)'); dg.addColorStop(1, 'rgba(70,40,14,.4)'); x.fillStyle = dg; x.fillRect(X, Y, W, H);
    var tx = o.tx === undefined ? X + W - 58 : o.tx, tw = 42, th = Math.max(H * 1.3, 22), ty = Y + H / 2 - th / 2;
    x.fillStyle = '#1c1d20'; rr(x, tx, ty, tw, th, 3); x.fill(); x.strokeStyle = 'rgba(255,255,255,.1)'; x.stroke();
    x.fillStyle = '#b9b19e'; x.fillRect(tx + 5, ty + th / 2 - 6, 18, 11); x.fillStyle = '#222'; x.fillRect(tx + 7, ty + th / 2 - 4, 13, 1.5); x.fillRect(tx + 7, ty + th / 2, 9, 1.5);
    x.fillStyle = '#e8c22a'; x.beginPath(); x.moveTo(tx + 32, ty + th / 2 - 6); x.lineTo(tx + 38, ty + th / 2 + 5); x.lineTo(tx + 26, ty + th / 2 + 5); x.closePath(); x.fill();
    if (o.bottom) { x.strokeStyle = '#2b2d30'; x.lineWidth = 5; x.lineCap = 'round'; x.beginPath(); x.moveTo(tx + tw / 2, ty + th); x.quadraticCurveTo(tx + tw / 2 + 4, (ty + th + o.bottom) / 2, tx + tw / 2 + 18, o.bottom + 4); x.stroke(); x.strokeStyle = 'rgba(255,255,255,.08)'; x.lineWidth = 1.2; x.stroke(); }
    screws(x, [[X + 8, Y + H / 2], [X + W - 8, Y + H / 2]], 2.6); x.restore();
  }
  function wires(x, pts, toY) { x.save(); x.strokeStyle = '#1d1f22'; x.lineWidth = 1.6; pts.forEach(function (p) { x.beginPath(); x.moveTo(p[0], p[1]); x.quadraticCurveTo(p[0] + 6, (p[1] + toY) / 2, p[0] + 2, toY); x.stroke(); }); x.restore(); }
  function electrodes(x, pts) { x.save(); pts.forEach(function (p) { var g = x.createLinearGradient(p[0] - 4, 0, p[0] + 4, 0); g.addColorStop(0, '#0b0b0c'); g.addColorStop(.5, '#3a3c40'); g.addColorStop(1, '#0b0b0c'); x.fillStyle = g; rr(x, p[0] - 4, p[1] - 7, 8, 14, 3); x.fill(); x.fillStyle = '#7a7d82'; x.fillRect(p[0] - 4, p[1] + 2, 8, 1.5); }); x.restore(); }
  function hangers(x, xs, y1, R) { x.save(); xs.forEach(function (px) { var g = x.createLinearGradient(px - 2, 0, px + 2, 0); g.addColorStop(0, '#16171a'); g.addColorStop(.5, '#55585e'); g.addColorStop(1, '#16171a'); x.fillStyle = g; x.fillRect(px - 2, 0, 4, y1); x.fillStyle = '#26282c'; rr(x, px - 7, y1 - 6, 14, 9, 2); x.fill(); screws(x, [[px, y1 - 1.5]], 2); x.fillStyle = 'rgba(130,64,22,.5)'; x.fillRect(px - 1, y1 + 3, 1.5, 8 + R() * 14); }); x.restore(); }
  function tubeBorder(x, X, Y, W, H, r, color, o) {
    o = o || {}; [0].concat(o.double ? [o.gap || 10] : []).forEach(function (g, k) {
      var c = k && o.color2 ? o.color2 : color; x.save(); x.lineJoin = 'round'; shape(x, X + g, Y + g, W - 2 * g, H - 2 * g, Math.max(2, r - g), o.round);
      x.strokeStyle = '#2b2f36'; x.lineWidth = 7.5; x.stroke(); if (o.off) { x.restore(); return; }
      x.strokeStyle = c; x.shadowColor = c; x.shadowBlur = 14; x.lineWidth = 4; x.stroke(); x.shadowBlur = 3; x.strokeStyle = '#fff'; x.globalAlpha = .65; x.lineWidth = 1.4; x.stroke(); x.restore();
    });
  }
  function bulbs(x, X, Y, W, H, color, phase, o) {
    o = o || {}; var sp = o.spacing || 22, pts = [], n, i;
    if (o.round) { n = Math.floor(Math.PI * (W + H) / 2 / sp); for (i = 0; i < n; i++) { var a = i / n * TAU; pts.push([X + W / 2 + Math.cos(a) * W / 2, Y + H / 2 + Math.sin(a) * H / 2]); } }
    else { var per = 2 * (W + H); n = Math.floor(per / sp); for (i = 0; i < n; i++) { var t = i * per / n, px, py; if (t < W) { px = X + t; py = Y; } else if (t < W + H) { px = X + W; py = Y + t - W; } else if (t < 2 * W + H) { px = X + W - (t - W - H); py = Y + H; } else { px = X; py = Y + H - (t - 2 * W - H); } pts.push([px, py]); } }
    var r = o.r || 5.5;
    pts.forEach(function (p, i) {
      var lit = phase < 0 ? (o.dead === undefined || i % 13 !== o.dead) : (i + phase) % 2 === 0; x.save();
      x.fillStyle = '#0b0b0c'; x.beginPath(); x.arc(p[0], p[1], r + 2.4, 0, TAU); x.fill(); x.strokeStyle = '#6a604f'; x.lineWidth = 1.2; x.stroke();
      var g = x.createRadialGradient(p[0] - r * .3, p[1] - r * .3, 0, p[0], p[1], r);
      if (lit) { x.shadowColor = color; x.shadowBlur = r * 2.8; g.addColorStop(0, '#ffffff'); g.addColorStop(.45, color); g.addColorStop(1, color); }
      else { g.addColorStop(0, '#7a705f'); g.addColorStop(1, '#2a251f'); }
      x.fillStyle = g; x.beginPath(); x.arc(p[0], p[1], r, 0, TAU); x.fill(); x.restore();
    });
  }
  function lightbox(x, cw, ch, fill, o) {
    o = o || {}; var R = o.R || prng(.37), round = !!o.round, X = o.X || 0, Y = o.Y || 0; cw = o.W || cw; ch = o.H || ch;
    var m = Math.min(cw, ch), r = round ? 0 : m * .05, i = m * .05, k;
    x.save(); x.translate(X, Y);
    var fg = x.createLinearGradient(0, 0, 0, ch); fg.addColorStop(0, '#4c4f54'); fg.addColorStop(.06, '#2b2d31'); fg.addColorStop(1, '#141517'); x.fillStyle = fg; shape(x, 0, 0, cw, ch, r, round); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.2)'; x.lineWidth = 1.5; shape(x, 1, 1, cw - 2, ch - 2, r, round); x.stroke();
    x.fillStyle = '#09090a'; shape(x, i - 2.5, i - 2.5, cw - 2 * i + 5, ch - 2 * i + 5, Math.max(r - i, 1), round); x.fill();
    x.save(); shape(x, i, i, cw - 2 * i, ch - 2 * i, Math.max(r - i, 1), round); x.clip();
    x.fillStyle = fill; x.fillRect(0, 0, cw, ch);
    var g = x.createRadialGradient(cw / 2, ch / 2, 0, cw / 2, ch / 2, Math.max(cw, ch) * .62); g.addColorStop(0, 'rgba(255,255,255,.2)'); g.addColorStop(.55, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.42)'); x.fillStyle = g; x.fillRect(0, 0, cw, ch);
    if (!round) {
      var horiz = cw >= ch, n = Math.max(2, Math.round((horiz ? ch : cw) / 48)), dead = R() < .5 ? Math.floor(R() * n) : -1;
      for (k = 0; k < n; k++) { var span = horiz ? ch - 2 * i : cw - 2 * i, pos = i + span * (k + .5) / n, band = span / n;
        var bg = horiz ? x.createLinearGradient(0, pos - band / 2, 0, pos + band / 2) : x.createLinearGradient(pos - band / 2, 0, pos + band / 2, 0);
        bg.addColorStop(0, 'rgba(0,0,0,.06)'); bg.addColorStop(.5, k === dead ? 'rgba(0,0,0,.32)' : 'rgba(255,255,255,.16)'); bg.addColorStop(1, 'rgba(0,0,0,.06)'); x.fillStyle = bg;
        if (horiz) x.fillRect(0, pos - band / 2, cw, band); else x.fillRect(pos - band / 2, 0, band, ch); }
    }
    x.restore();
    if (o.border) { x.save(); x.strokeStyle = o.border; x.lineWidth = Math.max(2, m * .02); var b = i + m * .05; shape(x, b, b, cw - 2 * b, ch - 2 * b, Math.max(r - b, 2), round); x.stroke();
      if (o.double) { x.lineWidth = Math.max(1, m * .008); var b2 = b + m * .035; shape(x, b2, b2, cw - 2 * b2, ch - 2 * b2, Math.max(r - b2, 2), round); x.stroke(); } x.restore(); }
    if (!round) screws(x, [[i * .5, i * .5], [cw - i * .5, i * .5], [i * .5, ch - i * .5], [cw - i * .5, ch - i * .5]], Math.max(1.6, i * .2));
    x.restore(); return i;
  }
  function sticker(x, X, Y, w, h, rot, R, color) {
    x.save(); x.translate(X, Y); x.rotate(rot); x.fillStyle = color || '#d8d2c2'; x.globalAlpha = .85; x.beginPath(); x.moveTo(0, 0); x.lineTo(w, 1); x.lineTo(w - 2, h * .7); x.lineTo(w * .7, h); x.lineTo(2, h - 1); x.closePath(); x.fill();
    x.fillStyle = '#4a463e'; for (var i = 0; i < 4; i++) x.fillRect(4, 4 + i * h / 5, (w - 10) * (.5 + R() * .5), Math.max(1, h / 14)); x.restore();
  }
  function plusMark(x, cx, cy, s, color) { x.save(); x.fillStyle = color; x.fillRect(cx - s * .17, cy - s / 2, s * .34, s); x.fillRect(cx - s / 2, cy - s * .17, s, s * .34); x.restore(); }
  function scanlines(x, X, Y, W, H, a) { x.save(); x.globalAlpha = a || .16; x.fillStyle = '#000'; for (var y = Y; y < Y + H; y += 3) x.fillRect(X, y, W, 1); x.restore(); }
  function cabinet(x, cw, ch, R, label) {
    var g = x.createLinearGradient(0, 0, 0, ch); g.addColorStop(0, '#3c3f44'); g.addColorStop(.1, '#222428'); g.addColorStop(1, '#111214'); x.fillStyle = g; rr(x, 0, 0, cw, ch, 4); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.16)'; x.lineWidth = 1.2; rr(x, .8, .8, cw - 1.6, ch - 1.6, 4); x.stroke();
    var pts = []; for (var sx = 10; sx < cw - 4; sx += Math.max(60, cw / 8)) { pts.push([sx, 4.5]); pts.push([sx, ch - 4.5]); } screws(x, pts, 1.8);
    if (label) { x.fillStyle = '#7d8187'; x.fillRect(14, ch - 7.5, 40, 6); x.fillStyle = '#1c1d20'; x.font = '700 5px ' + F.mono; x.textBaseline = 'middle'; x.fillText(label, 16, ch - 4.4); }
  }
  function matrix(x, cw, ch, rows, content, o) {
    o = o || {}; var R = prng(o.seed || .5), fr = Math.max(7, ch * .065), ih = ch - 2 * fr, pitch = ih / rows, cols = Math.floor((cw - 2 * fr) / pitch);
    var offc = off(cols, rows), oc = offc.getContext('2d'); oc.fillStyle = '#000'; oc.fillRect(0, 0, cols, rows); content(oc, cols, rows);
    var data = oc.getImageData(0, 0, cols, rows).data, ox = (cw - cols * pitch) / 2, mod = o.module || 8, tint = {};
    x.save(); cabinet(x, cw, ch, R, o.label || 'P8 · KJ-LED'); x.fillStyle = '#050506'; x.fillRect(ox - 1, fr - 1, cols * pitch + 2, ih + 2);
    for (var j = 0; j < rows; j++) for (var i = 0; i < cols; i++) {
      var p = (j * cols + i) * 4, r = data[p], g = data[p + 1], b = data[p + 2], l = Math.max(r, g, b), cx = ox + (i + .5) * pitch, cy = fr + (j + .5) * pitch, key = (i / mod | 0) + ',' + (j / mod | 0);
      if (tint[key] === undefined) tint[key] = .82 + R() * .26;
      var dead = R() < .004;
      if (l < 60 || dead) { x.fillStyle = dead ? '#0c0a08' : '#1a160f'; x.beginPath(); x.arc(cx, cy, pitch * .3, 0, TAU); x.fill(); continue; }
      var k = Math.min(1.8, 255 / l) * tint[key];
      x.fillStyle = 'rgb(' + Math.min(255, r * k | 0) + ',' + Math.min(255, g * k | 0) + ',' + Math.min(255, b * k | 0) + ')'; x.beginPath(); x.arc(cx, cy, pitch * .39, 0, TAU); x.fill();
      x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.arc(cx - pitch * .12, cy - pitch * .12, pitch * .1, 0, TAU); x.fill();
    }
    x.fillStyle = 'rgba(0,0,0,.75)'; for (i = mod; i < cols; i += mod) x.fillRect(ox + i * pitch - .6, fr, 1.2, ih); for (j = mod; j < rows; j += mod) x.fillRect(ox, fr + j * pitch - .6, cols * pitch, 1.2);
    x.restore();
  }
  function segments(oc, list, x0, cy, size, family) { oc.font = '700 ' + size + 'px ' + family; oc.textBaseline = 'middle'; var px = x0; list.forEach(function (s) { oc.fillStyle = s[1]; oc.fillText(s[0], px, cy); px += oc.measureText(s[0]).width; }); return px; }
  function lcd(x, cw, ch, face, R, brand) {
    var b = 13; x.fillStyle = '#0d0e10'; rr(x, 0, 0, cw, ch, 10); x.fill(); x.strokeStyle = 'rgba(255,255,255,.14)'; x.lineWidth = 1.5; rr(x, 1, 1, cw - 2, ch - 2, 10); x.stroke();
    x.save(); x.beginPath(); x.rect(b, b, cw - 2 * b, ch - 2 * b); x.clip(); face(x, b, b, cw - 2 * b, ch - 2 * b);
    x.globalAlpha = .07; x.fillStyle = '#000'; for (var px = b; px < cw - b; px += 3) x.fillRect(px, b, 1, ch - 2 * b); x.globalAlpha = 1; scanlines(x, b, b, cw - 2 * b, ch - 2 * b, .1);
    var g = x.createLinearGradient(b, b, cw * .7, ch * .6); g.addColorStop(0, 'rgba(255,255,255,.12)'); g.addColorStop(.4, 'rgba(255,255,255,.03)'); g.addColorStop(.41, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(b, b, cw - 2 * b, ch - 2 * b);
    x.restore(); x.fillStyle = '#5b5f65'; x.font = '700 7px ' + F.heavy; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(brand || 'KUJIRA VISION', cw / 2, ch - 6.5);
    screws(x, [[6, 6], [cw - 6, 6], [6, ch - 6], [cw - 6, ch - 6]], 2);
  }
  // Weathering on every opaque sign: rain runoff, grime, specks. Only touches painted pixels.
  function weather(x, cw, ch, R) {
    x.save(); x.globalCompositeOperation = 'source-atop';
    for (var i = 0; i < 10; i++) { var sx = R() * cw, sy = R() * ch * .4, sl = ch * (.25 + R() * .6), g = x.createLinearGradient(0, sy, 0, sy + sl); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.3, 'rgba(25,18,10,.16)'); g.addColorStop(1, 'rgba(25,18,10,0)'); x.fillStyle = g; x.fillRect(sx, sy, 1 + R() * 3, sl); }
    var d = x.createLinearGradient(0, 0, 0, ch); d.addColorStop(0, 'rgba(0,0,0,0)'); d.addColorStop(.8, 'rgba(0,0,0,0)'); d.addColorStop(1, 'rgba(40,26,12,.22)'); x.fillStyle = d; x.fillRect(0, 0, cw, ch);
    for (i = 0; i < 60; i++) { x.globalAlpha = .08 + R() * .2; x.fillStyle = '#100c08'; x.fillRect(R() * cw, R() * ch, 1 + R() * 1.5, 1 + R() * 1.5); }
    x.restore();
  }

  // ---------------- pictograms (0..1 space; wide ones span 0..4) ----------------
  function picto(x, name, S, f, k) {
    k = k || function () {};
    function P(pts, close) { x.beginPath(); pts.forEach(function (p, i) { (i ? x.lineTo : x.moveTo).call(x, p[0] * S, p[1] * S); }); if (close) x.closePath(); x.stroke(); }
    function C(cx, cy, r, a0, a1, ccw) { x.beginPath(); x.arc(cx * S, cy * S, r * S, a0 || 0, a1 === undefined ? TAU : a1, !!ccw); x.stroke(); }
    function Q(pts) { x.beginPath(); x.moveTo(pts[0][0] * S, pts[0][1] * S); for (var i = 1; i + 1 < pts.length; i += 2) x.quadraticCurveTo(pts[i][0] * S, pts[i][1] * S, pts[i + 1][0] * S, pts[i + 1][1] * S); x.stroke(); }
    function E(cx, cy, rx, ry, rot) { x.beginPath(); x.ellipse(cx * S, cy * S, rx * S, ry * S, rot || 0, 0, TAU); x.stroke(); }
    function R(X, Y, W, H, r) { rr(x, X * S, Y * S, W * S, H * S, r * S); x.stroke(); }
    var o, i;
    switch (name) {
      // ---- original set ----
      case 'cat':
        P([[.2, .42], [.24, .14], [.4, .3], [.6, .3], [.76, .14], [.8, .42]]); Q([[.2, .42], [.16, .8], [.5, .84], [.84, .8], [.8, .42]]);
        if (f) P([[.33, .52], [.43, .52]]); else C(.38, .52, .045);
        C(.62, .52, .045); P([[.47, .64], [.5, .67], [.53, .64]]); P([[.08, .6], [.3, .63]]); P([[.08, .7], [.3, .68]]); P([[.92, .6], [.7, .63]]); P([[.92, .7], [.7, .68]]); break;
      case 'koi':
        o = f ? .06 : -.06; Q([[.16, .5], [.3, .26], [.6, .36], [.74, .42], [.8, .5 + o]]); Q([[.16, .5], [.3, .72], [.6, .62], [.74, .58], [.8, .5 + o]]);
        P([[.8, .5 + o], [.95, .3 + o * 2], [.9, .5 + o], [.95, .7 + o * 2], [.8, .5 + o]]); P([[.42, .37], [.5, .22], [.56, .38]]); C(.24, .47, .025); C(.48, .5, .05); C(.62, .46, .035); break;
      case 'whale':
        Q([[.1, .55], [.2, .3], [.55, .36], [.78, .42], [.84, .5]]); Q([[.1, .55], [.3, .78], [.6, .62], [.74, .56], [.84, .5]]); P([[.84, .5], [.96, .34], [.92, .48], [.98, .6], [.84, .5]]);
        C(.24, .5, .022); P([[.18, .64], [.5, .62]]); P([[.26, .3], [.24, .14]]); P([[.24, .2], [.16, .12]]); P([[.24, .2], [.32, .12]]); break;
      case 'car':
        P([[.15, .7], [.35, .7]]); P([[.65, .7], [2.35, .7]]); P([[2.65, .7], [2.95, .7]]); P([[.15, .7], [.12, .52], [.6, .42], [1.0, .2], [2.0, .2], [2.5, .42], [2.95, .5], [2.95, .7]]);
        P([[1.08, .27], [1.5, .27], [1.5, .42], [.85, .42]], true); P([[1.62, .27], [1.95, .27], [2.25, .42], [1.62, .42]], true); C(.5, .72, .14); C(2.5, .72, .14);
        P([[3.15, .35], [3.6, .35]]); P([[3.2, .5], [3.8, .5]]); P([[3.15, .62], [3.5, .62]]); break;
      case 'martini': P([[.18, .18], [.82, .18], [.5, .55]], true); P([[.5, .55], [.5, .82]]); P([[.3, .84], [.7, .84]]); C(.6, .3, .05); P([[.6, .3], [.72, .08]]); break;
      case 'bowl':
        x.beginPath(); x.arc(.5 * S, .55 * S, .34 * S, 0, Math.PI); x.closePath(); x.stroke(); P([[.62, .5], [.92, .12]]); P([[.68, .5], [.98, .16]]);
        o = f ? .04 : -.04; Q([[.32, .45], [.28 + o, .35], [.34, .25], [.4 - o, .15], [.34, .06]]); Q([[.48, .45], [.44 + o, .35], [.5, .25], [.56 - o, .15], [.5, .06]]); break;
      case 'cross': C(.5, .5, .38); P([[.42, .24], [.58, .24], [.58, .42], [.76, .42], [.76, .58], [.58, .58], [.58, .76], [.42, .76], [.42, .58], [.24, .58], [.24, .42], [.42, .42]], true); break;
      case 'eye':
        if (f) { Q([[.1, .5], [.5, .72], [.9, .5]]); P([[.3, .6], [.26, .7]]); P([[.5, .64], [.5, .75]]); P([[.7, .6], [.74, .7]]); }
        else { Q([[.1, .5], [.5, .15], [.9, .5]]); Q([[.1, .5], [.5, .85], [.9, .5]]); C(.5, .5, .15); C(.5, .5, .05); } break;
      case 'arrow': P([[.1, .38], [2.9, .38], [2.9, .18], [3.8, .5], [2.9, .82], [2.9, .62], [.1, .62]], true); break;
      case 'heart': x.beginPath(); x.moveTo(.5 * S, .82 * S); x.bezierCurveTo(.05 * S, .5 * S, .15 * S, .1 * S, .5 * S, .32 * S); x.bezierCurveTo(.85 * S, .1 * S, .95 * S, .5 * S, .5 * S, .82 * S); x.stroke(); break;
      case 'bolt': P([[.58, .08], [.26, .54], [.48, .54], [.38, .92], [.74, .42], [.52, .42], [.66, .08]], true); break;
      case 'robot':
        x.beginPath(); x.rect(.2 * S, .3 * S, .6 * S, .5 * S); x.stroke(); P([[.5, .3], [.5, .14]]); C(.5, .11, .04);
        if (f) P([[.3, .48], [.42, .48]]); else { x.beginPath(); x.rect(.3 * S, .42 * S, .12 * S, .1 * S); x.stroke(); }
        x.beginPath(); x.rect(.58 * S, .42 * S, .12 * S, .1 * S); x.stroke(); P([[.32, .66], [.68, .66]]); P([[.4, .62], [.4, .7]]); P([[.5, .62], [.5, .7]]); P([[.6, .62], [.6, .7]]); break;
      case 'crane': P([[.08, .58], [.42, .5], [.5, .14], [.6, .5], [.92, .32], [.66, .62], [.4, .7], [.2, .62]], true); P([[.42, .5], [.6, .5]]); break;
      case 'blossom': for (i = 0; i < 5; i++) { var a = i / 5 * TAU - Math.PI / 2; C(.5 + Math.cos(a) * .2, .5 + Math.sin(a) * .2, .14); } C(.5, .5, .05); break;
      // ---- v2 ----
      case 'sushi':
        k(1); R(.14, .52, .72, .26, .1); k(0); Q([[.1, .54], [.5, .2], [.9, .52]]); P([[.1, .54], [.9, .52]]);
        P([[.34, .38], [.4, .52]]); P([[.5, .33], [.56, .52]]); P([[.66, .38], [.72, .52]]);
        if (f) { k(1); P([[.1, .2], [.92, .07]]); P([[.1, .28], [.92, .17]]); } break;
      case 'beer':
        k(0); R(.24, .32, .4, .52, .04); C(.64, .58, .12, -Math.PI / 2, Math.PI / 2);
        k(1); Q([[.22, .32], [.24, .18], [.36, .22]]); Q([[.36, .22], [.44, .1], [.52, .2]]); Q([[.52, .2], [.64, .14], [.66, .32]]);
        k(0); if (f) { C(.36, .55, .025); C(.48, .68, .02); C(.42, .44, .018); } else { C(.38, .64, .025); C(.5, .5, .02); C(.44, .76, .018); } break;
      case 'coffee':
        k(0); R(.24, .44, .4, .36, .06); C(.66, .6, .09, -Math.PI / 2, Math.PI / 2); P([[.16, .88], [.74, .88]]);
        k(1); o = f ? .03 : -.03; Q([[.34, .38], [.3 + o, .3], [.36, .22], [.42 - o, .14], [.36, .06]]); Q([[.5, .38], [.46 + o, .3], [.52, .22], [.58 - o, .14], [.52, .06]]); break;
      case 'lips':
        Q([[.1, .5], [.2, .26], [.36, .3], [.46, .32], [.5, .4]]); Q([[.5, .4], [.54, .32], [.64, .3], [.8, .26], [.9, .5]]);
        Q([[.1, .5], [.5, .92], [.9, .5]]); k(1); Q([[.16, .52], [.5, .6], [.84, .52]]); break;
      case 'dice':
        var pips = { 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
        var die = function (cx, cy, s, rot, n) {
          x.save(); x.translate(cx * S, cy * S); x.rotate(rot); rr(x, -s * S / 2, -s * S / 2, s * S, s * S, s * S * .16); x.stroke();
          pips[n].forEach(function (p) { x.beginPath(); x.arc(p[0] * s * S * .26, p[1] * s * S * .26, s * S * .045, 0, TAU); x.stroke(); }); x.restore();
        };
        k(0); die(.34, .58, .38, -.22, f ? 6 : 5); k(1); die(.7, .38, .3, .28, f ? 2 : 3); break;
      case 'cherry':
        k(0); C(.34, .7, .13); C(.67, .66, .13); k(1); Q([[.34, .57], [.38, .32], [.6, .14]]); Q([[.67, .53], [.64, .3], [.6, .14]]);
        Q([[.6, .14], [.74, .02], [.88, .14]]); Q([[.6, .14], [.74, .24], [.88, .14]]); break;
      case 'mic':
        k(0); R(.4, .1, .2, .4, .1); P([[.43, .22], [.57, .22]]); P([[.43, .3], [.57, .3]]); P([[.43, .38], [.57, .38]]);
        C(.5, .38, .2, 0, Math.PI); P([[.5, .58], [.5, .8]]); P([[.36, .84], [.64, .84]]);
        k(1); C(.5, .3, .32, -.55, .55); C(.5, .3, .32, Math.PI - .55, Math.PI + .55); if (f) { C(.5, .3, .42, -.45, .45); C(.5, .3, .42, Math.PI - .45, Math.PI + .45); } break;
      case 'cyberarm':
        k(1); Q([[.14, .86], [.3, .9], [.34, .6]]); k(0);
        P([[.04, .92], [.24, .92]]); P([[.14, .92], [.14, .84], [.34, .6], [.6, .66], [.8, .34]]); C(.34, .6, .055); C(.6, .66, .055); C(.14, .84, .04);
        if (f) { P([[.8, .34], [.84, .16]]); P([[.8, .34], [.98, .28]]); } else { P([[.8, .34], [.88, .22], [.92, .26]]); P([[.8, .34], [.92, .34], [.92, .3]]); } break;
      case 'tooth':
        Q([[.28, .32], [.3, .14], [.5, .22], [.7, .14], [.72, .32]]); P([[.28, .32], [.32, .6], [.38, .86], [.45, .62], [.5, .56], [.55, .62], [.62, .86], [.68, .6], [.72, .32]]);
        k(1); Q([[.36, .26], [.4, .2], [.46, .24]]); break;
      case 'lotus':
        Q([[.5, .78], [.36, .5], [.5, .18]]); Q([[.5, .78], [.64, .5], [.5, .18]]);
        Q([[.5, .78], [.22, .6], [.22, .3]]); Q([[.22, .3], [.42, .44], [.5, .78]]); Q([[.5, .78], [.78, .6], [.78, .3]]); Q([[.78, .3], [.58, .44], [.5, .78]]);
        Q([[.5, .78], [.12, .76], [.04, .52]]); Q([[.04, .52], [.3, .56], [.5, .78]]); Q([[.5, .78], [.88, .76], [.96, .52]]); Q([[.96, .52], [.7, .56], [.5, .78]]);
        k(1); Q([[.14, .86], [.5, .94], [.86, .86]]); break;
      case 'dragon':
        o = f ? .08 : -.08; k(0);
        Q([[.24, .6], [.6, .22 - o], [1.0, .5], [1.4, .8 + o], [1.8, .5], [2.2, .2 - o], [2.6, .45], [2.9, .6 + o], [3.1, .45]]);
        Q([[.3, .72], [.66, .36 - o], [1.0, .64], [1.4, .94 + o], [1.8, .64], [2.2, .34 - o], [2.6, .58], [2.86, .74 + o], [3.1, .59]]);
        P([[.24, .6], [.04, .42], [.14, .64], [.02, .84], [.3, .72]]);
        P([[1.0, .6], [.92, .86], [1.04, .9]]); P([[2.0, .4], [1.94, .66], [2.06, .7]]);
        k(1); P([[3.1, .45], [3.4, .3], [3.74, .36], [3.5, .46], [3.74, .56], [3.32, .64], [3.1, .59]]);
        P([[3.4, .3], [3.34, .1]]); P([[3.5, .31], [3.6, .12]]); C(3.42, .4, .025);
        Q([[3.7, .4], [3.88, .3 + o], [3.94, .12]]); Q([[3.7, .56], [3.88, .66 - o], [3.96, .84]]); break;
      case 'octopus':
        k(0); C(.5, .38, .22, Math.PI, 0); P([[.28, .38], [.3, .5]]); P([[.72, .38], [.7, .5]]); C(.42, .38, .03); C(.58, .38, .03);
        for (i = 0; i < 6; i++) { var x0 = .3 + i * .08, sw = (f ? .05 : -.05) * (i % 2 ? 1 : -1); Q([[x0, .5], [x0 + (i - 2.5) * .05 + sw, .7], [x0 + (i - 2.5) * .1, .9]]); }
        k(1); P([[.3, .26], [.7, .26]]); P([[.7, .26], [.8, .2]]); P([[.7, .26], [.82, .3]]); break;
      case 'rabbit':
        k(0); C(.5, .62, .2); E(.42, .26, .06, .18, -.15); if (f) E(.66, .32, .06, .18, .9); else E(.58, .26, .06, .18, .15);
        C(.43, .6, .022); C(.57, .6, .022); k(1); P([[.47, .68], [.5, .71], [.53, .68]]); P([[.2, .64], [.38, .66]]); P([[.2, .72], [.38, .7]]); P([[.8, .64], [.62, .66]]); P([[.8, .72], [.62, .7]]); break;
      case 'shiba':
        k(0); P([[.22, .44], [.26, .14], [.42, .32]]); P([[.78, .44], [.74, .14], [.58, .32]]); P([[.42, .32], [.58, .32]]);
        Q([[.22, .44], [.18, .8], [.5, .86], [.82, .8], [.78, .44]]); C(.4, .52, .028); C(.6, .52, .028); C(.5, .64, .035);
        Q([[.42, .7], [.5, .76], [.58, .7]]); if (f) { k(1); Q([[.47, .74], [.5, .86], [.53, .74]]); } break;
      case 'crab':
        k(0); E(.5, .6, .22, .13); P([[.44, .48], [.42, .38]]); C(.42, .355, .025); P([[.56, .48], [.58, .38]]); C(.58, .355, .025);
        P([[.3, .54], [.2, .42]]); P([[.7, .54], [.8, .42]]);
        C(.18, .33, .09, f ? .9 : .35, f ? 5.4 : 5.95); C(.82, .33, .09, Math.PI + (f ? .9 : .35), Math.PI + (f ? 5.4 : 5.95));
        k(1); for (i = 0; i < 3; i++) { P([[.32, .62 + i * .05], [.14, .7 + i * .08]]); P([[.68, .62 + i * .05], [.86, .7 + i * .08]]); } break;
      case 'moto':
        k(1); P([[.1, .34], [.9, .34]]); P([[.3, .5], [1.0, .5]]); P([[.1, .66], [.8, .66]]); k(0);
        C(1.6, .7, .2); C(3.6, .7, .2); P([[1.6, .7], [2.2, .42], [3.0, .42], [3.6, .7]]); P([[2.2, .42], [2.5, .7], [3.0, .42]]);
        P([[2.05, .36], [2.7, .36]]); Q([[2.7, .36], [2.9, .22], [3.1, .38]]); P([[3.2, .42], [3.35, .2], [3.6, .18]]); C(3.68, .32, .05); break;
      case 'rocket':
        k(0); P([[.5, .06], [.64, .28], [.64, .66], [.36, .66], [.36, .28]], true); P([[.36, .48], [.22, .72], [.36, .66]]); P([[.64, .48], [.78, .72], [.64, .66]]); C(.5, .36, .065);
        k(1); P([[.42, .7], [.5, f ? .96 : .86], [.58, .7]]); if (f) P([[.46, .7], [.5, .84], [.54, .7]]); break;
      case 'sneaker':
        k(1); P([[.1, .5], [.36, .5]]); P([[.16, .64], [.36, .64]]); k(0);
        P([[.5, .72], [.52, .42], [1.3, .38], [1.8, .16], [2.2, .2], [2.3, .44], [3.4, .56], [3.7, .66], [3.7, .76], [.5, .76]], true);
        P([[1.6, .3], [1.9, .42]]); P([[1.75, .24], [2.05, .38]]); k(1); P([[.5, .86], [3.7, .86]]); P([[2.5, .5], [2.3, .62], [2.6, .6], [2.4, .72]]); break;
      case 'skull':
        x.beginPath(); x.arc(.5 * S, .42 * S, .28 * S, Math.PI * .8, Math.PI * 2.2); x.stroke(); P([[.28, .58], [.34, .72], [.66, .72], [.72, .58]]);
        if (f) { P([[.33, .4], [.45, .5]]); P([[.45, .4], [.33, .5]]); } else C(.39, .45, .075); C(.61, .45, .075);
        P([[.5, .54], [.46, .62], [.54, .62]], true); k(1); P([[.42, .72], [.42, .8]]); P([[.5, .72], [.5, .82]]); P([[.58, .72], [.58, .8]]); P([[.36, .8], [.64, .8]]); break;
      case 'diamond':
        P([[.18, .38], [.32, .2], [.68, .2], [.82, .38], [.5, .86]], true); P([[.18, .38], [.82, .38]]); P([[.32, .2], [.42, .38], [.5, .86]]); P([[.68, .2], [.58, .38], [.5, .86]]); P([[.42, .38], [.5, .2], [.58, .38]]);
        k(1); P([[.86, .1], [.86, .2]]); P([[.81, .15], [.91, .15]]); break;
      case 'planet':
        k(0); C(.5, .5, .22); k(1); E(.5, .5, .44, .11, -.35); k(0); P([[.14, .16], [.14, .24]]); P([[.1, .2], [.18, .2]]); P([[.86, .8], [.86, .88]]); P([[.82, .84], [.9, .84]]); break;
      case 'umbrella':
        k(0); C(.5, .5, .36, Math.PI, 0); for (i = 0; i < 4; i++) C(.23 + i * .18, .5, .09, 0, Math.PI, true); P([[.5, .14], [.5, .5]]);
        k(1); P([[.5, .5], [.5, .82]]); C(.44, .82, .06, 0, Math.PI);
        k(0); o = f ? .1 : 0; for (i = 0; i < 4; i++) P([[.1 + i * .26, .08 + o + (i % 2) * .06], [.08 + i * .26, .16 + o + (i % 2) * .06]]); break;
      case 'torii':
        k(0); Q([[.06, .2], [.5, .3], [.94, .2]]); P([[.16, .34], [.84, .34]]); P([[.28, .26], [.28, .9]]); P([[.72, .26], [.72, .9]]);
        k(1); R(.44, .25, .12, .09, .01); break;
      case 'kitsune':
        k(0); P([[.2, .14], [.36, .38], [.64, .38], [.8, .14], [.78, .5], [.5, .9], [.22, .5]], true);
        k(1); if (f) { P([[.3, .54], [.44, .56]]); P([[.7, .54], [.56, .56]]); } else { Q([[.3, .54], [.38, .46], [.46, .56]]); Q([[.7, .54], [.62, .46], [.54, .56]]); }
        P([[.4, .42], [.44, .38]]); P([[.6, .42], [.56, .38]]); P([[.46, .72], [.5, .76], [.54, .72]]); P([[.26, .22], [.32, .34]]); P([[.74, .22], [.68, .34]]); break;
      case 'maneki':
        k(0); C(.46, .36, .18); P([[.32, .26], [.32, .12], [.42, .2]]); P([[.6, .26], [.6, .12], [.5, .2]]); R(.26, .52, .4, .36, .14);
        Q([[.38, .38], [.4, .35], [.42, .38]]); Q([[.5, .38], [.52, .35], [.54, .38]]);
        if (f) { P([[.62, .54], [.76, .32]]); C(.78, .27, .055); } else { P([[.62, .54], [.78, .44]]); C(.8, .4, .055); }
        k(1); C(.46, .54, .03); E(.46, .72, .1, .06); P([[.4, .72], [.52, .72]]); break;
      case 'chip':
        R(.28, .28, .44, .44, .03); R(.38, .38, .24, .24, .02); for (i = 0; i < 4; i++) { var y = .34 + i * .107; P([[.16, y], [.28, y]]); P([[.72, y], [.84, y]]); P([[y, .16], [y, .28]]); P([[y, .72], [y, .84]]); } break;
      case 'drumstick':
        k(0); Q([[.3, .62], [.2, .3], [.48, .2], [.74, .18], [.72, .42], [.66, .64], [.44, .68]]); P([[.44, .68], [.3, .62]]);
        k(1); P([[.44, .68], [.62, .86]]); C(.66, .88, .045); C(.6, .92, .045); k(0); Q([[.34, .38], [.42, .3], [.52, .3]]); break;
      case 'coin': C(.5, .5, .36); C(.5, .5, .3); R(.42, .42, .16, .16, .01); P([[.5, .2], [.5, .3]]); P([[.5, .7], [.5, .8]]); break;
      case 'paw': E(.5, .64, .17, .14); C(.3, .4, .07); C(.42, .28, .07); C(.58, .28, .07); C(.7, .4, .07); break;
      case 'bones': k(1); P([[.2, .2], [.8, .8]]); P([[.8, .2], [.2, .8]]); [[.2, .2], [.8, .8], [.8, .2], [.2, .8]].forEach(function (q) { C(q[0] + (q[0] < .5 ? -.03 : .03), q[1] - .03, .05); C(q[0] - (q[0] < .5 ? .03 : -.03) * 0, q[1] + .03, .05); }); break;
      case 'star': P([[.5, .08], [.61, .38], [.92, .38], [.67, .57], [.76, .88], [.5, .69], [.24, .88], [.33, .57], [.08, .38], [.39, .38]], true); break;
      case 'spark': P([[.5, .1], [.5, .9]]); P([[.1, .5], [.9, .5]]); P([[.24, .24], [.76, .76]]); P([[.76, .24], [.24, .76]]); break;
      case 'dumbbell': P([[.24, .5], [.76, .5]]); R(.14, .3, .1, .4, .02); R(.76, .3, .1, .4, .02); R(.07, .38, .07, .24, .02); R(.86, .38, .07, .24, .02); break;
    }
  }
  function neonPicto(x, name, ox, oy, S, colors, f, o) {
    o = o || {}; x.save(); x.translate(ox, oy); x.lineCap = 'round'; x.lineJoin = 'round';
    if (o.cast !== false) { x.save(); x.translate(S * .03, S * .05); x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = S * .06; x.filter && (x.filter = 'blur(' + (S * .015) + 'px)'); picto(x, name, S, f); x.restore(); }
    x.strokeStyle = '#2b2f36'; x.lineWidth = S * .07; picto(x, name, S, f);
    var k = function (i) { x.strokeStyle = colors[i % colors.length]; x.shadowColor = x.strokeStyle; };
    k(0); x.lineWidth = S * .045; x.shadowBlur = S * .09; picto(x, name, S, f, k);
    x.lineWidth = S * .016; x.shadowBlur = S * .02; x.strokeStyle = '#fff'; x.shadowColor = '#fff'; x.globalAlpha = .65; picto(x, name, S, f); x.restore();
  }
  function inkPicto(x, name, ox, oy, S, color, f, lw) { x.save(); x.translate(ox, oy); x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = color; x.lineWidth = S * (lw || .06); picto(x, name, S, f); x.restore(); }
  var WIDE = { car: 1, arrow: 1, dragon: 1, moto: 1, sneaker: 1 };
  function layoutPic(name, cw, ch, cap) {
    if (WIDE[name]) { var S = Math.min(ch - 56, cw * (cap ? .6 : .88) / 4); return { wide: 1, S: S, ox: cap ? 30 : (cw - 4 * S) / 2, oy: (ch - S) / 2, capX: cap ? (30 + 4 * S + cw - 26) / 2 : cw / 2, capW: cw - 26 - (30 + 4 * S) - 16, capY: ch / 2 }; }
    var s = cap ? Math.min(cw - 80, ch * .58) : Math.min(cw, ch) - 70, top = cap ? 22 : (ch - s) / 2;
    return { S: s, ox: (cw - s) / 2, oy: top, capX: cw / 2, capW: cw - 56, capY: top + s + (ch - top - s) * .34, subY: top + s + (ch - top - s) * .74 };
  }
  // Pictogram sign: artwork + optional caption/sub on contour plate, steel backer or bulb box.
  function picSign(name, o) {
    o = o || {};
    return function (x, cw, ch, f, d) {
      var R = prng(d.seed + .13), L = layoutPic(name, cw, ch, !!o.cap);
      var body = function (c) {
        if (o.ring) tubeBorder(c, L.ox - 14, L.oy - 14, L.S + 28, L.S + 28, 0, o.ring, { round: 1 });
        if (o.orn) o.orn(c, cw, ch, f, L, R);
        neonPicto(c, name, L.ox, L.oy, L.S, d.colors, f);
        if (o.cap) neonText(c, o.cap[0], L.capX, L.wide ? L.capY - (o.sub ? 16 : 0) : L.capY, o.cap[3] || 44, o.cap[1] || d.colors[0], o.cap[2] || F.jp, { tube: !!o.cap[4], maxW: L.capW, weight: o.cap[5] || '800' });
      };
      var mount = o.mount || 'contour', inset = 6;
      if (mount === 'contour') contour(x, cw, ch, body, R, { r: o.r || 13, color: o.backer || '#0e0f12' });
      else {
        if (mount !== 'none') backer(x, inset, inset, cw - 2 * inset, ch - 2 * inset, o.round ? 0 : 14, o.backer || '#15161a', R, { round: o.round });
        if (o.bulbs) bulbs(x, inset + 14, inset + 14, cw - 2 * inset - 28, ch - 2 * inset - 28, o.bulbs, d.anim === 1 ? f : -1, { round: o.round, spacing: 23, r: 4.6, dead: 4 });
        if (o.border) tubeBorder(x, inset + (o.bulbs ? 28 : 13), inset + (o.bulbs ? 28 : 13), cw - 2 * inset - (o.bulbs ? 56 : 26), ch - 2 * inset - (o.bulbs ? 56 : 26), 10, o.border, { round: o.round, double: o.double, color2: o.border2 });
        body(x);
      }
      if (o.sub) {
        var sy = L.wide ? L.capY + 30 : L.subY, sx = L.capX; x.save(); var w = Math.min(L.capW, fit(x, o.sub[0], o.sub[3] || 19, L.capW, '700', o.sub[2] || F.jp) * 0 + L.capW * .84), h = (o.sub[3] || 19) * 1.5;
        if (mount === 'contour') { x.fillStyle = '#17181b'; rr(x, sx - w / 2, sy - h / 2, w, h, 3); x.fill(); x.strokeStyle = '#3a3d43'; x.lineWidth = 1.5; x.stroke(); screws(x, [[sx - w / 2 + 5, sy], [sx + w / 2 - 5, sy]], 1.8); }
        x.restore(); ink(x, o.sub[0], sx, sy + 1, o.sub[3] || 19, o.sub[1] || '#a49a84', o.sub[2] || F.jp, { maxW: w - 18, weight: '700' });
      }
      if (o.electrodes !== false) electrodes(x, [[L.ox + L.S * .12, L.oy + L.S + 6], [L.ox + L.S * (L.wide ? 3.9 : .88), L.oy + L.S + 6]]);
    };
  }
  function legacy(x, cw, ch, f, d) {
    var R = prng(d.seed + .2);
    if (d.backed) { backer(x, 4, 4, cw - 8, ch - 8, 8, '#0b0c0f', R, { drips: 3 }); tubeBorder(x, 13, 13, cw - 26, ch - 26, 6, d.colors[0], { off: 0 }); }
    if (d.picto) {
      var S = ch - 70, span = WIDE[d.picto] ? 4 : 1; if (S * span > cw - 70) S = (cw - 70) / span;
      var body = function (c) { neonPicto(c, d.picto, (cw - S * span) / 2, (ch - S) / 2, S, d.colors, f); };
      if (d.backed) body(x); else contour(x, cw, ch, body, R, { r: 12 }); return;
    }
    var vertical = d.shape === 'v' || d.shape === 't';
    if (!d.backed) { if (vertical) raceway(x, cw / 2 - 9, 14, 18, ch - 28, R, { tx: cw / 2 - 21, bottom: ch }); else raceway(x, 22, ch * .5 - 9, cw - 44, 18, R, { bottom: ch }); }
    if (vertical) vtext(x, d.text, cw / 2, 26, ch - 26, cw * .66, d.colors[0], d.latin ? F.latin : F.jp);
    else neonText(x, d.text, cw / 2, ch / 2 + 2, ch * .48, d.colors[0], d.latin ? F.latin : F.jp, { maxW: cw - 70, weight: d.latin ? '800' : '700', tube: !!d.latin });
  }

  // ---------------- the set ----------------
  var LEGACY = [
    ['薬局', 'Pharmacy', 'Japanese', 'Medical', 'v', '#ff3d7a', 1], ['ラーメン', 'Ramen', 'Japanese', 'Food', 'v', '#ffb347', 1], ['診療所', 'Clinic', 'Japanese', 'Medical', 'v', '#4fe3ff', 1],
    ['電脳修理', 'Cyberbrain repair', 'Japanese', 'Tech', 'v', '#7cff9a', 1], ['ホテル', 'Hotel', 'Japanese', 'Lodging', 'v', '#ff4fd8', 0], ['質屋', 'Pawnshop', 'Japanese', 'Money', 'v', '#ffd36b', 1],
    ['カラオケ', 'Karaoke', 'Japanese', 'Nightlife', 'v', '#b07cff', 0, 2], ['二十四時', 'Open 24 hours', 'Japanese', 'Food', 'v', '#5fd3ff', 1], ['HOTEL', 'Hotel', 'English', 'Lodging', 't', '#ff6070', 0, 3, 1],
    ['BAR 夜光', 'Bar "Night Glow"', 'Japanese', 'Nightlife', 'h', '#ff5ea8', 1], ['義体整備 4F', 'Prosthetic body service, 4th floor', 'Japanese', 'Tech', 'h', '#5ff0ff', 1],
    ['NOODLE 屋台', 'Noodle stall', 'Japanese', 'Food', 'h', '#ffa040', 1], ['DATA LOAN', 'Data loans', 'English', 'Money', 'h', '#9d7cff', 0, 0, 1], ['OPEN', 'Open', 'English', 'Retail', 'h', '#ff4040', 0, 3, 1],
    ['旅館 空室', 'Inn — vacancy', 'Japanese', 'Lodging', 'h', '#ff7adf', 1], ['PACHINKO', 'Pachinko parlour', 'English', 'Nightlife', 'w', '#ffd040', 0, 2, 1]
  ].map(function (a, i) { return { id: 'v1-t' + i, set: 'v1', text: a[0], native: a[0], meaning: a[1], lang: a[2], theme: a[3], shape: a[4], colors: [a[5]], backed: a[6], anim: a[7] || 0, latin: a[8] || 0, style: 'neon', mounted: 1, draw: legacy }; })
  .concat([
    ['cat', 'Cat — winks', 's', '#ff9ad5', 1], ['koi', 'Koi — tail flick', 's', '#ff7a3a', 1], ['whale', 'Whale', 's', '#5fd0ff', 0], ['car', 'Spinner car', 'w', '#7cf0ff', 2],
    ['martini', 'Cocktail bar', 's', '#ff5ea8', 4], ['bowl', 'Noodle bowl — steam', 's', '#ffb347', 1], ['cross', 'Clinic cross', 's', '#40ff90', 3, 1], ['eye', 'Eye — blinks', 's', '#b07cff', 1],
    ['arrow', 'Arrow', 'w', '#ffd040', 2], ['heart', 'Heart', 's', '#ff3d6a', 4], ['bolt', 'Bolt', 's', '#ffe14a', 3], ['robot', 'Robot — winks', 's', '#8fd8ff', 1],
    ['crane', 'Paper crane', 's', '#e6efff', 0], ['blossom', 'Blossom', 's', '#ffa0d0', 4]
  ].map(function (a) { return { id: 'v1-' + a[0], set: 'v1', picto: a[0], native: a[0], meaning: a[1], lang: 'Pictogram', theme: 'Image', shape: a[2], colors: [a[3]], anim: a[4], backed: a[5] || 0, style: 'neon', mounted: 1, draw: legacy }; }));

  function N(o) { o.set = 'v2'; if (o.style === 'neon' && o.mounted === undefined) o.mounted = 1; return o; }
  function sparkles(c, pts, color) { pts.forEach(function (p) { neonPicto(c, 'spark', p[0] - p[2] / 2, p[1] - p[2] / 2, p[2], [color], 0, { cast: false }); }); }
  var V2 = [
    // ---------- food & drink ----------
    N({ id: 'sushi', native: '鮨 まる八', meaning: 'Standing sushi bar — chopsticks blink in', lang: 'Japanese', theme: 'Food', shape: 's', style: 'neon', colors: ['#ff7a5c', '#ffe2b8'], anim: 1,
      draw: picSign('sushi', { cap: ['鮨 まる八', '#ffe2b8', F.min, 46, 0, '800'], sub: ['立喰い · SUSHI · ¥120〜', '#b5a68b'], backer: '#120e0b', orn: function (c, cw, ch, f, L) { tubeBorder(c, L.ox - 18, L.oy - 4, L.S + 36, L.S * .9, 30, '#ff7a5c', { round: 0 }); } }) }),
    N({ id: 'jiujia', native: '粵 酒家', meaning: 'Cantonese restaurant & wine house', lang: 'Chinese', theme: 'Food', shape: 'v', style: 'lightbox', colors: ['#c81d25', '#ffd36b'], anim: 0,
      draw: function (x, cw, ch, f, d) { var R = prng(d.seed); hangers(x, [cw * .3, cw * .7], 26, R);
        lightbox(x, cw, ch - 26, '#c81d25', { Y: 26, R: R, border: '#ffd36b', double: 1 });
        x.save(); x.strokeStyle = '#ffd36b'; x.lineWidth = 4; x.beginPath(); x.arc(cw / 2, 90, 27, 0, TAU); x.stroke(); x.lineWidth = 1.5; x.beginPath(); x.arc(cw / 2, 90, 33, 0, TAU); x.stroke(); x.restore();
        ink(x, '粵', cw / 2, 91, 32, '#ffd36b', F.tcs, { weight: '900' });
        [[20, 134], [cw - 20, 134], [20, ch - 40], [cw - 20, ch - 40]].forEach(function (p, k) { x.save(); x.strokeStyle = '#ffd36b'; x.lineWidth = 2.5; x.beginPath(); x.arc(p[0] + (k % 2 ? -6 : 6), p[1], 7, k % 2 ? Math.PI * .5 : -Math.PI * .5, k % 2 ? Math.PI * 1.5 : Math.PI * .5); x.stroke(); x.restore(); });
        vtext(x, '酒家', cw / 2, 140, 455, 96, '#ffd36b', F.tcs, 'ink', { stroke: '#6e0a0e', strokeW: .08 }); x.fillStyle = '#ffd36b'; x.fillRect(32, 470, cw - 64, 2.5);
        ink(x, '營業中', cw / 2, 500, 30, '#fff3d0', F.tc, { maxW: cw - 44 }); ink(x, '☎ 2388 0451', cw / 2, 535, 15, '#ffd7a0', F.mono, { maxW: cw - 40, weight: '700' }); } }),
    N({ id: 'chicken', native: '치킨 CHICKEN', meaning: 'Fried chicken — letters wipe on', lang: 'Korean', theme: 'Food', shape: 'h', style: 'neon', colors: ['#ffd23a', '#ff3b2f'], anim: 6,
      draw: function (x, cw, ch, f, d) { var R = prng(d.seed); backer(x, 4, 4, cw - 8, ch - 8, 12, '#16110c', R); tubeBorder(x, 14, 14, cw - 28, ch - 28, 9, '#ff3b2f');
        neonPicto(x, 'drumstick', 28, 26, 96, ['#ffd23a', '#fff4d6'], 0);
        neonText(x, '치킨', 205, 64, 74, '#ffd23a', F.kr, { maxW: 150, weight: '900' }); neonText(x, 'CHICKEN', 420, 62, 58, '#ff3b2f', F.latin, { tube: 1, maxW: 230, weight: '800' });
        ink(x, '후라이드 · 양념 · 반반 · 24H', 330, 112, 18, '#b0a080', F.kr, { maxW: 380, weight: '700' }); ink(x, '☎ 02-451-0451', 330, 132, 12, '#7d725e', F.mono, { weight: '700' }); } }),
    N({ id: 'beer', native: 'ビヤホール', meaning: 'Beer hall — bubbles rise, bulbs alternate', lang: 'Japanese', theme: 'Food', shape: 's', style: 'neon', colors: ['#ffad33', '#fff4d6'], anim: 1,
      draw: picSign('beer', { mount: 'backer', round: 0, backer: '#17120c', bulbs: '#ffd88a', cap: ['ビヤホール', '#fff4d6', F.jp, 38], sub: ['生 DRAFT ¥480', '#c7a46a', F.heavy, 18] }) }),
    N({ id: 'coffee', native: 'COFFEE 咖啡', meaning: 'Roastery — channel letters on a raceway', lang: 'Chinese', theme: 'Food', shape: 'h', style: 'channel', colors: ['#ffe2b8', '#ff9a3c'], anim: 0,
      draw: function (x, cw, ch, f, d) { var R = prng(d.seed); raceway(x, 24, 62, cw - 48, 26, R, { tx: cw - 90, bottom: ch });
        channel(x, 'COFFEE', 222, 70, 88, '#ffe2b8', F.heavy, { maxW: 360 }); channel(x, '咖啡', 478, 70, 76, '#ff9a3c', F.tc, { maxW: 130 });
        neonText(x, 'roastery · since 2049', 300, 128, 26, '#ff9a3c', F.script, { tube: 1, maxW: 300, weight: '400' }); } }),
    N({ id: 'chai', native: 'चाय CHAI', meaning: 'Masala chai stall, ₹30', lang: 'Hindi', theme: 'Food', shape: 'h', style: 'neon', colors: ['#ff9a1f', '#39ff7a'], anim: 4,
      draw: function (x, cw, ch, f, d) { var R = prng(d.seed); backer(x, 4, 4, cw - 8, ch - 8, 40, '#0f1712', R); tubeBorder(x, 14, 14, cw - 28, ch - 28, 32, '#39ff7a', { double: 1, color2: '#ff9a1f', gap: 8 });
        neonText(x, 'चाय', 170, 70, 84, '#ff9a1f', F.hi, { maxW: 200 }); neonText(x, 'CHAI', 385, 66, 62, '#39ff7a', F.latin, { tube: 1, maxW: 170, weight: '800' });
        neonPicto(x, 'coffee', 482, 26, 78, ['#39ff7a', '#ff9a1f'], 0); ink(x, 'मसाला चाय · ₹30 · 24×7', 300, 120, 17, '#a89a72', F.hi, { maxW: 320, weight: '700' }); } }),
    N({ id: 'qahwa', native: 'مقهى', meaning: 'Café — round lightbox with ring lettering', lang: 'Arabic', theme: 'Food', shape: 'c', style: 'lightbox', colors: ['#0fb5a6', '#ffffff'], anim: 0,
      draw: function (x, cw, ch, f, d) { var R = prng(d.seed); lightbox(x, cw, ch, '#0fb5a6', { round: 1, R: R, border: '#e9fffb', double: 1 });
        x.save(); x.translate(cw / 2, ch / 2); var txt = 'CAFÉ · مقهى · OPEN 24/7 · ', n = 30; x.font = '700 15px ' + F.heavy; x.fillStyle = '#e9fffb'; x.textAlign = 'center'; x.textBaseline = 'middle';
        for (var i = 0; i < n; i++) { x.save(); x.rotate(i / n * TAU); x.fillText('·', 0, -cw * .385); x.restore(); } x.restore();
        inkPicto(x, 'coffee', 100, 50, 100, '#ffffff', 0, .075); x.save(); x.direction = 'rtl'; ink(x, 'مقهى', cw / 2, 196, 66, '#ffffff', F.ar, { maxW: 170 }); x.restore(); ink(x, 'QAHWA · 1987', cw / 2, 238, 14, '#c9fff6', F.heavy, { weight: '800' }); } }),
    N({ id: 'shokudo', native: '営業中 ★ 24H 食堂', meaning: 'Diner ticker — beef bowl ¥390', lang: 'Japanese', theme: 'Food', shape: 'm', style: 'matrix', colors: ['#ffad33', '#ff3b2f'], anim: 5, view: .5,
      draw: function (x, cw, ch, f, d) { matrix(x, cw, ch, 14, function (oc, c, r) { segments(oc, [['営業中', '#ffad33'], [' ★ ', '#ff3b2f'], ['24H 食堂', '#ffe2b8'], [' ★ ', '#ff3b2f'], ['牛丼 ¥390', '#ffad33'], [' ★ ', '#ff3b2f'], ['定食 ¥680', '#ffe2b8'], [' ★ ', '#ff3b2f'], ['OPEN', '#39ff7a']], 4, r / 2 + .5, 11, F.jp); }, { seed: d.seed, label: 'P8 · 24H' }); } }),
    N({ id: 'pho', native: 'PHỞ 24', meaning: 'Phở noodle shop — bulb chaser', lang: 'Vietnamese', theme: 'Food', shape: 'h', style: 'neon', colors: ['#ff5ea8', '#7cf0ff'], anim: 2,
      draw: function (x, cw, ch, f, d) { var R = prng(d.seed); backer(x, 4, 4, cw - 8, ch - 8, 10, '#120d12', R); bulbs(x, 18, 18, cw - 36, ch - 36, '#ffe9b0', -1, { spacing: 21, r: 4.2, dead: 7 });
        neonText(x, 'PHỞ', 180, 70, 80, '#ff5ea8', F.heavy, { tube: 1, maxW: 220, weight: '800' }); neonText(x, '24', 350, 70, 66, '#7cf0ff', F.heavy, { weight: '800' });
        neonPicto(x, 'bowl', 420, 30, 86, ['#7cf0ff'], 0); ink(x, 'BÚN · CƠM · BÁNH MÌ', 270, 116, 16, '#b08fa0', F.heavy, { maxW: 300, weight: '800' }); } }),
    // ---------- nightlife ----------
    N({ id: 'lips', native: 'CLUB LIPS', meaning: 'Club entrance — lips pulse', lang: 'English', theme: 'Nightlife', shape: 's', style: 'neon', colors: ['#ff2f8e', '#ffd0e6'], anim: 4,
      draw: picSign('lips', { cap: ['Lips', '#ffd0e6', F.script, 58, 1, '400'], sub: ['CLUB · B2F · 21:00—', '#b78aa0', F.heavy, 16], orn: function (c, cw, ch, f, L) { sparkles(c, [[L.ox - 6, L.oy + 12, 22], [L.ox + L.S + 4, L.oy + 30, 16], [L.ox + L.S - 10, L.oy - 4, 12]], '#ffd0e6'); } }) }),
    N({ id: 'noraebang', native: '노래방', meaning: 'Karaoke rooms — blade sign', lang: 'Korean', theme: 'Nightlife', shape: 'v', style: 'neon', colors: ['#b86bff', '#3ff0ff'], anim: 3,
      draw: function (x, cw, ch, f, d) { var R = prng(d.seed); hangers(x, [cw * .28, cw * .72], 22, R); backer(x, 6, 22, cw - 12, ch - 28, 10, '#110d18', R); tubeBorder(x, 16, 32, cw - 32, ch - 48, 8, '#3ff0ff');
        neonPicto(x, 'mic', cw / 2 - 34, 46, 68, ['#3ff0ff', '#ff4fd8'], 0); vtext(x, '노래방', cw / 2, 120, 470, 92, '#b86bff', F.kr);
        x.save(); x.translate(cw / 2, 520); ink(x, 'NORAEBANG', 0, 0, 13, '#9c8ab5', F.heavy, { maxW: cw - 50, weight: '800' }); x.restore(); neonText(x, '♪ ♫', cw / 2, 552, 30, '#3ff0ff', F.heavy, { maxW: cw - 50 }); } }),
    N({ id: 'lovehotel', native: 'Love HOTEL', meaning: 'Love hotel — bulbs alternate, heart beats', lang: 'English', theme: 'Lodging', shape: 'w', style: 'neon', colors: ['#ff4fa3', '#ff2a3a'], anim: 1,
      draw: function (x, cw, ch, f, d) { var R = prng(d.seed); backer(x, 4, 4, cw - 8, ch - 8, 16, '#15090f', R); bulbs(x, 20, 20, cw - 40, ch - 40, '#ffd9a8', f, { spacing: 22, r: 4.4 });
        neonText(x, 'Love', 175, 92, 104, '#ff4fa3', F.script, { maxW: 230, weight: '400', tube: 1 }); neonText(x, 'HOTEL', 425, 80, 72, '#ff2a3a', F.latin, { tube: 1, maxW: 200, weight: '800' });
        ink(x, 'REST ¥3,800 · STAY ¥7,500', 425, 128, 15, '#c08a9a', F.heavy, { maxW: 230, weight: '800' });
        neonPicto(x, 'heart', 585, 36, 118, ['#ff2a3a'], 0); if (f) neonPicto(x, 'heart', 569, 20, 150, ['#ff4fa3'], 0, { cast: false }); } }),
    N({ id: 'dice', native: 'CASINO 賭場', meaning: 'Gambling den — dice roll', lang: 'Chinese', theme: 'Nightlife', shape: 's', style: 'neon', colors: ['#39ff7a', '#f4fff6'], anim: 1,
      draw: picSign('dice', { cap: ['CASINO', '#f4fff6', F.serif, 46, 1, '700'], sub: ['賭場 · 24H · VIP 3F', '#8fb39a', F.tc, 17], orn: function (c, cw, ch, f, L) { neonPicto(c, 'star', L.ox - 12, L.oy - 6, 26, ['#39ff7a'], 0, { cast: false }); neonPicto(c, 'star', L.ox + L.S - 12, L.oy + L.S - 30, 22, ['#39ff7a'], 0, { cast: false }); } }) }),
    N({ id: 'bar_ru', native: 'БАР 24', meaning: 'Bar, kitchen & karaoke, open 24h', lang: 'Russian', theme: 'Nightlife', shape: 'h', style: 'neon', colors: ['#ff2a3a', '#3ff0ff'], anim: 0,
      draw: function (x, cw, ch, f, d) { var R = prng(d.seed); raceway(x, 30, 58, cw - 60, 22, R, { tx: 60, bottom: ch });
        neonPicto(x, 'martini', 40, 20, 92, ['#3ff0ff'], 0); neonText(x, 'БАР', 245, 66, 98, '#ff2a3a', F.heavy, { tube: 1, maxW: 230, weight: '800' }); neonText(x, '24', 420, 66, 76, '#3ff0ff', F.heavy, { weight: '800' });
        neonPicto(x, 'star', 486, 34, 56, ['#ff2a3a'], 0); wires(x, [[200, 100], [300, 100], [420, 96]], 112); x.fillStyle = '#18191c'; rr(x, 150, 116, 300, 24, 3); x.fill(); ink(x, 'КАРАОКЕ · КУХНЯ · DJ', 300, 129, 15, '#a18d8d', F.heavy, { maxW: 280, weight: '800' }); } }),
    N({ id: 'cherry', native: '777 スロット', meaning: 'Slot parlour — cherries blink', lang: 'Japanese', theme: 'Nightlife', shape: 's', style: 'neon', colors: ['#ff2a3a', '#39ff7a'], anim: 3,
      draw: picSign('cherry', { mount: 'backer', backer: '#160c0d', bulbs: '#fff0b8', cap: ['777', '#ffd23a', F.heavy, 52, 1, '900'], sub: ['スロット · 新台入替', '#c8a07a', F.jp, 17] }) }),
    N({ id: 'club', native: '夜 / DJ KUJIRA', meaning: 'Club poster screen — two slides', lang: 'Japanese', theme: 'Nightlife', shape: 'p', style: 'screen', colors: ['#ff3df0', '#3a1cff', '#22d3ff', '#0a2a88'], anim: 1,
      draw: function (x, cw, ch, f, d) { var R = prng(d.seed); lcd(x, cw, ch, function (c, X, Y, W, H) {
        var g = c.createLinearGradient(0, Y, 0, Y + H); g.addColorStop(0, f ? '#22d3ff' : '#ff3df0'); g.addColorStop(1, f ? '#0a2a88' : '#3a1cff'); c.fillStyle = g; c.fillRect(X, Y, W, H);
        if (!f) {
          c.save(); c.globalAlpha = .18; c.strokeStyle = '#fff'; for (var k = -10; k < 20; k++) { c.beginPath(); c.moveTo(X + k * 26, Y); c.lineTo(X + k * 26 + 200, Y + H); c.stroke(); } c.restore();
          ink(c, '夜', cw / 2, 190, 236, '#ffffff', F.min, { weight: '900' }); ink(c, 'YORU', cw / 2 + 110, 72, 16, '#ffd0f6', F.heavy, { weight: '900' });
          c.fillStyle = '#fff'; c.fillRect(34, 330, W - 44, 3); ink(c, 'CLUB NOCTURNE', cw / 2, 360, 38, '#ffffff', F.latin, { maxW: W - 40, weight: '900' });
          c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(34, 386, W - 44, 50); ink(c, 'SAT 23:00 — 05:00', cw / 2 - 40, 401, 15, '#fff', F.mono, { weight: '700' }); ink(c, 'B2F · ¥3,000 1D', cw / 2 - 40, 421, 13, '#ffd0f6', F.mono, { weight: '700' });
          c.fillStyle = '#fff'; for (var b = 0, bx = cw - 120; bx < cw - 40; b++) { var bw = 1 + (R() * 3 | 0); if (b % 2 === 0) c.fillRect(bx, 392, bw, 38); bx += bw + 1; }
        } else {
          c.strokeStyle = 'rgba(255,255,255,.5)'; for (var k2 = 0; k2 < 7; k2++) { c.lineWidth = k2 % 2 ? 1.5 : 3; c.beginPath(); c.arc(cw / 2, 170, 34 + k2 * 22, 0, TAU); c.stroke(); }
          inkPicto(c, 'whale', cw / 2 - 78, 95, 156, '#ffffff', 0, .05); ink(c, 'DJ KUJIRA', cw / 2, 350, 56, '#ffffff', F.latin, { maxW: W - 40, weight: '900' }); ink(c, '鯨 LIVE SET · ALL NIGHT', cw / 2, 392, 20, '#d8f4ff', F.jp, { maxW: W - 50 });
          c.fillStyle = '#ffffff'; c.fillRect(34, 414, W - 44, 2); ink(c, 'w/ PRISM · VECTRA · AXL', cw / 2, 434, 13, '#d8f4ff', F.mono, { maxW: W - 50, weight: '700' });
        } }, R, 'KUJIRA VISION 55"'); } }),
    N({ id: 'mic', native: 'LIVE HOUSE', meaning: 'Live house mic — sound waves', lang: 'English', theme: 'Nightlife', shape: 's', style: 'neon', colors: ['#3ff0ff', '#ff4fd8'], anim: 1,
      draw: picSign('mic', { cap: ['LIVE HOUSE', '#ff4fd8', F.latin, 40, 1, '800'], sub: ['ライブハウス B1 · 19:00', '#9fb2b8', F.jp, 16] }) }),
    // ---------- services ----------
    N({ id: 'gitai', native: '義体クリニック', meaning: 'Prosthetic body clinic, 3F', lang: 'Japanese', theme: 'Medical', shape: 'v', style: 'lightbox', colors: ['#e9f4f2', '#0a6f73'], anim: 0,
      draw: function (x, cw, ch, f, d) { var R = prng(d.seed); hangers(x, [cw * .3, cw * .7], 22, R); lightbox(x, cw, ch - 22, '#e9f4f2', { Y: 22, R: R, border: '#0a6f73', double: 1 });
        x.fillStyle = '#0a6f73'; x.fillRect(22, 44, cw - 44, 66); plusMark(x, cw / 2, 77, 42, '#ffffff'); x.fillStyle = '#e3262f'; x.fillRect(cw / 2 - 7, 56, 14, 42);
        vtext(x, '義体クリニック', cw / 2 - 12, 122, 520, 64, '#0a6f73', F.jp, 'ink');
        x.save(); x.translate(cw - 30, 300); x.rotate(Math.PI / 2); ink(x, '整備・換装・保険適用', 0, 0, 13, '#4b8a8c', F.jp, { maxW: 260, weight: '700' }); x.restore();
        x.fillStyle = '#0a6f73'; x.fillRect(22, ch - 74, cw - 44, 34); ink(x, '3F', cw / 2, ch - 56, 24, '#ffffff', F.heavy, { weight: '900' }); sticker(x, 28, ch - 108, 34, 22, -.12, R); } }),
    N({ id: 'cyberarm', native: 'CYBERWARE', meaning: 'Cybernetic limbs — gripper opens', lang: 'English', theme: 'Tech', shape: 's', style: 'neon', colors: ['#24e0b0', '#ff9a3c'], anim: 1,
      draw: picSign('cyberarm', { mount: 'backer', backer: '#0c1414', border: '#24e0b0', cap: ['CYBERWARE', '#ff9a3c', F.latin, 40, 1, '800'], sub: ['義手・義足 換装 · 即日', '#7ea69c', F.jp, 16] }) }),
    N({ id: 'dentist', native: '歯科 DENTAL', meaning: 'Dentist, Mon–Sat', lang: 'Japanese', theme: 'Medical', shape: 's', style: 'lightbox', colors: ['#d8f4ff', '#1d5fd6'], anim: 0,
      draw: function (x, cw, ch, f, d) { var R = prng(d.seed); lightbox(x, cw, ch, '#d8f4ff', { R: R, border: '#1d5fd6' });
        x.fillStyle = '#1d5fd6'; x.fillRect(30, 30, cw - 60, 26); ink(x, '保険診療 · 予約優先', cw / 2, 44, 15, '#ffffff', F.jp, { maxW: cw - 80 });
        inkPicto(x, 'tooth', 80, 66, 140, '#1d5fd6', 0, .075); ink(x, '歯科 DENTAL', cw / 2, 232, 36, '#1d5fd6', F.jp, { maxW: cw - 64 });
        x.fillStyle = 'rgba(29,95,214,.12)'; x.fillRect(30, 256, cw - 60, 50); ink(x, '月-土  9:00 — 21:00', cw / 2, 271, 15, '#1d3f8a', F.mono, { weight: '700', maxW: cw - 70 }); ink(x, '☎ 03-0451-8020', cw / 2, 292, 13, '#1d3f8a', F.mono, { weight: '700' }); } }),
    N({ id: 'yaofang', native: '藥房', meaning: 'Pharmacy, 24h', lang: 'Chinese', theme: 'Medical', shape: 'v', style: 'lightbox', colors: ['#14a35a', '#ffffff'], anim: 0,
      draw: function (x, cw, ch, f, d) { var R = prng(d.seed); lightbox(x, cw, ch, '#14a35a', { R: R, border: '#d9ffe9', double: 1 }); x.fillStyle = '#ffffff'; x.beginPath(); x.arc(cw / 2, 78, 40, 0, TAU); x.fill(); plusMark(x, cw / 2, 78, 52, '#14a35a');
        vtext(x, '藥房', cw / 2, 130, 410, 100, '#ffffff', F.tc, 'ink', { stroke: '#0a5a30', strokeW: .06 }); x.fillStyle = '#d9ffe9'; x.fillRect(30, 428, cw - 60, 2);
        ink(x, 'PHARMACY', cw / 2, 452, 16, '#d9ffe9', F.heavy, { weight: '800', maxW: cw - 44 }); ink(x, '24H', cw / 2, 500, 44, '#ffffff', F.heavy, { weight: '900' }); ink(x, '中西成藥 · 保健品', cw / 2, 548, 14, '#bff0d5', F.tc, { maxW: cw - 40 }); } }),
    N({ id: 'apteka', native: 'АПТЕКА', meaning: 'Pharmacy, round the clock', lang: 'Russian', theme: 'Medical', shape: 'h', style: 'lightbox', colors: ['#119c55', '#ffffff'], anim: 0,
      draw: function (x, cw, ch, f, d) { var R = prng(d.seed); lightbox(x, cw, ch, '#119c55', { R: R, border: '#d9ffe9' }); x.fillStyle = '#ffffff'; x.fillRect(34, 30, 92, 92); plusMark(x, 80, 76, 66, '#119c55');
        ink(x, 'АПТЕКА', 345, 66, 74, '#ffffff', F.heavy, { maxW: 380, weight: '900' }); x.fillStyle = '#d9ffe9'; x.fillRect(160, 98, 370, 2); ink(x, 'КРУГЛОСУТОЧНО · 24/7', 345, 116, 18, '#d9ffe9', F.heavy, { maxW: 360, weight: '800' }); sticker(x, cw - 70, 26, 30, 20, .1, R, '#f0e2a0'); } }),
    N({ id: 'barber', native: '理容', meaning: 'Barber pole — stripes roll', lang: 'Pictogram', theme: 'Services', shape: 't', style: 'lightbox', colors: ['#ff2a3a', '#f4f6ff', '#2f7bff'], anim: 7, view: .5,
      draw: function (x, cw, ch) {
        x.save(); x.fillStyle = '#1a1b1e'; x.fillRect(8, 0, 6, ch); x.fillRect(cw - 14, 0, 6, ch); rr(x, 16, 0, cw - 32, ch, 0); x.clip(); x.fillStyle = '#f4f6ff'; x.fillRect(0, 0, cw, ch); var Pd = ch / 6;
        for (var k = -2; k < 8; k++) { var y0 = k * Pd; [['#ff2a3a', 0], ['#2f7bff', Pd / 2]].forEach(function (s) { x.fillStyle = s[0]; x.beginPath(); x.moveTo(0, y0 + s[1]); x.lineTo(cw, y0 + s[1] - 46); x.lineTo(cw, y0 + s[1] - 46 + Pd * .26); x.lineTo(0, y0 + s[1] + Pd * .26); x.closePath(); x.fill(); }); }
        var g = x.createLinearGradient(16, 0, cw - 16, 0); g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(.25, 'rgba(255,255,255,.45)'); g.addColorStop(.33, 'rgba(255,255,255,.05)'); g.addColorStop(.8, 'rgba(0,0,0,.15)'); g.addColorStop(1, 'rgba(0,0,0,.6)'); x.fillStyle = g; x.fillRect(0, 0, cw, ch);
        x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(30, 0, 2, ch); x.restore();
      } }),
    N({ id: 'massage', native: 'ร้านนวด MASSAGE', meaning: 'Thai massage — foot & oil', lang: 'Thai', theme: 'Services', shape: 'h', style: 'neon', colors: ['#ff3df0', '#ffd0f6'], anim: 4,
      draw: function (x, cw, ch, f, d) { var R = prng(d.seed); backer(x, 4, 4, cw - 8, ch - 8, 60, '#140b16', R, { rivets: false }); tubeBorder(x, 14, 14, cw - 28, ch - 28, 52, '#ffd0f6');
        neonPicto(x, 'lotus', 34, 26, 88, ['#ff3df0', '#39ff7a'], 0); neonText(x, 'ร้านนวด', 250, 64, 62, '#ff3df0', F.th, { maxW: 210 }); neonText(x, 'MASSAGE', 460, 62, 44, '#ffd0f6', F.latin, { tube: 1, maxW: 170, weight: '800' });
        ink(x, 'นวดแผนไทย · FOOT · OIL · ฿300', 340, 112, 16, '#ae86b0', F.th, { maxW: 360, weight: '700' }); } }),
    N({ id: 'tattoo', native: '刺青 Tattoo', meaning: 'Tattoo studio — walk-ins', lang: 'Japanese', theme: 'Services', shape: 'h', style: 'neon', colors: ['#ff2a3a', '#d8f4ff'], anim: 0,
      draw: function (x, cw, ch, f, d) { var R = prng(d.seed); contour(x, cw, ch, function (c) { neonText(c, '刺青', 120, 66, 92, '#ff2a3a', F.min, { weight: '900' }); neonText(c, 'Tattoo', 380, 70, 100, '#d8f4ff', F.script, { tube: 1, maxW: 300, weight: '400' }); neonPicto(c, 'bolt', 520, 26, 60, ['#ff2a3a'], 0); }, R, { r: 12 });
        x.fillStyle = '#17181b'; rr(x, 190, 116, 300, 24, 3); x.fill(); x.strokeStyle = '#3a3d43'; x.stroke(); ink(x, 'WALK-IN · 彫師 龍二 · 2F', 340, 129, 15, '#9a9a9a', F.jp, { maxW: 280, weight: '700' }); } }),
    N({ id: 'dragon', native: '龍門 中華', meaning: 'Chinese restaurant dragon — body ripples', lang: 'Chinese', theme: 'Food', shape: 'w', style: 'neon', colors: ['#39ff7a', '#ffcf3a'], anim: 1,
      draw: picSign('dragon', { cap: ['龍門', '#ffcf3a', F.tcs, 70, 0, '900'], sub: ['中華料理 · 飲茶', '#9fb090', F.tc, 18] }) }),
    N({ id: 'chiprepair', native: 'CHIP REPAIR 電脳修理', meaning: 'Implant chip repair, same day', lang: 'Japanese', theme: 'Tech', shape: 'h', style: 'lightbox', colors: ['#ffd23a', '#141414'], anim: 0,
      draw: function (x, cw, ch, f, d) { var R = prng(d.seed); lightbox(x, cw, ch, '#ffd23a', { R: R, border: '#141414' }); x.fillStyle = '#141414'; x.fillRect(30, 30, 110, 90); inkPicto(x, 'chip', 42, 32, 86, '#ffd23a', 0, .07);
        ink(x, 'CHIP REPAIR', 360, 56, 54, '#141414', F.latin, { maxW: 380, weight: '900' }); ink(x, '電脳修理 · 即日', 360, 98, 28, '#3a2f00', F.jp, { maxW: 380 }); x.fillStyle = '#141414'; x.fillRect(170, 116, 380, 1.5); ink(x, 'iO · NEURAL · OPTIC   ☎ 0451', 360, 126, 11, '#3a2f00', F.mono, { maxW: 370, weight: '700' }); } }),
    N({ id: 'chipmatrix', native: 'OK', meaning: 'Diagnostics board — chip / OK', lang: 'Pictogram', theme: 'Tech', shape: 's', style: 'matrix', colors: ['#39ff7a'], anim: 1,
      draw: function (x, cw, ch, f, d) { matrix(x, cw, ch, 26, function (oc, c, r) {
        oc.fillStyle = '#39ff7a'; oc.strokeStyle = '#39ff7a'; oc.lineWidth = 1; var mx = (c - 23) / 2 | 0;
        if (!f) { oc.strokeRect(mx + 6.5, 5.5, 11, 11); oc.fillRect(mx + 9, 8, 6, 6); for (var i = 0; i < 4; i++) { var p = 7 + i * 2.6 | 0; oc.fillRect(mx + 3, p, 3, 1); oc.fillRect(mx + 18, p, 3, 1); oc.fillRect(mx + p, 2, 1, 3); oc.fillRect(mx + p, 17, 1, 3); } oc.fillStyle = '#ffd23a'; oc.fillRect(mx + 2, 22, 20, 1); }
        else { oc.font = '700 11px ' + F.mono; oc.textAlign = 'center'; oc.textBaseline = 'middle'; oc.fillText('OK', c / 2, 10); oc.fillStyle = '#ffd23a'; oc.fillRect(3, 18, c - 6, 1); oc.fillStyle = '#39ff7a'; for (var k = 0; k < 6; k++) oc.fillRect(4 + k * 3, 21, 2, 2); }
      }, { seed: d.seed, label: 'DIAG · P10' }); } }),
    // ---------- money & city ----------
    N({ id: 'crypto', native: 'BTC ▲ ETH ▼ KJR ▲', meaning: 'Exchange price ticker', lang: 'English', theme: 'Money', shape: 'm', style: 'matrix', colors: ['#39ff7a', '#ff3b2f', '#ffd23a'], anim: 5, view: .5,
      draw: function (x, cw, ch, f, d) { matrix(x, cw, ch, 14, function (oc, c, r) { segments(oc, [['BTC', '#ffd23a'], [' ▲1.28M  ', '#39ff7a'], ['ETH', '#ffd23a'], [' ▼92.3K  ', '#ff3b2f'], ['KJR', '#ffd23a'], [' ▲4.21  ', '#39ff7a'], ['PRSM', '#ffd23a'], [' ▼0.88  ', '#ff3b2f'], ['¥', '#cfd8dc']], 4, r / 2 + .5, 11, F.mono); }, { seed: d.seed, label: 'P8 · XCHG' }); } }),
    N({ id: 'dangpu', native: '當舖', meaning: 'Pawnshop — bat & coin crest', lang: 'Chinese', theme: 'Money', shape: 'v', style: 'lightbox', colors: ['#1b3fa0', '#ffd36b'], anim: 0,
      draw: function (x, cw, ch, f, d) { var R = prng(d.seed); hangers(x, [cw * .3, cw * .7], 22, R); lightbox(x, cw, ch - 22, '#1b3fa0', { Y: 22, R: R, border: '#ffd36b', double: 1 });
        inkPicto(x, 'coin', cw / 2 - 38, 46, 76, '#ffd36b', 0, .06); x.save(); x.strokeStyle = '#ffd36b'; x.lineWidth = 3; x.beginPath(); x.moveTo(cw / 2 - 52, 70); x.quadraticCurveTo(cw / 2 - 30, 40, cw / 2 - 20, 62); x.moveTo(cw / 2 + 52, 70); x.quadraticCurveTo(cw / 2 + 30, 40, cw / 2 + 20, 62); x.stroke(); x.restore();
        vtext(x, '當舖', cw / 2, 140, 450, 104, '#ffd36b', F.tcs, 'ink', { stroke: '#0c1f55', strokeW: .07 }); x.fillStyle = '#ffd36b'; x.fillRect(30, 470, cw - 60, 2.5);
        ink(x, '高價收購', cw / 2, 500, 26, '#fff1c4', F.tc, { maxW: cw - 40 }); ink(x, '金 · 錶 · 義體', cw / 2, 536, 16, '#ffd36b', F.tc, { maxW: cw - 40 }); } }),
    N({ id: 'metro', native: 'M 地下鉄 SUBWAY', meaning: 'Subway entrance, exit A3', lang: 'Japanese', theme: 'Transit', shape: 'h', style: 'lightbox', colors: ['#f2f4f2', '#1d4fd6'], anim: 0, level: .32,
      draw: function (x, cw, ch, f, d) { var R = prng(d.seed); lightbox(x, cw, ch, '#f2f4f2', { R: R }); x.fillStyle = '#1d4fd6'; x.fillRect(20, ch - 34, cw - 40, 10); x.fillStyle = '#e8432c'; x.fillRect(20, ch - 24, cw - 40, 4);
        x.fillStyle = '#1d4fd6'; x.beginPath(); x.arc(78, 66, 42, 0, TAU); x.fill(); ink(x, 'M', 78, 69, 56, '#ffffff', F.heavy, { weight: '900' });
        ink(x, '地下鉄', 240, 52, 50, '#1d1f22', F.jp); ink(x, 'SUBWAY', 240, 96, 26, '#1d4fd6', F.heavy, { weight: '800' });
        [['G', '#f39700'], ['M', '#e60012'], ['H', '#9caeb7']].forEach(function (l, k) { x.fillStyle = '#fff'; x.beginPath(); x.arc(360 + k * 34, 70, 14, 0, TAU); x.fill(); x.strokeStyle = l[1]; x.lineWidth = 4; x.stroke(); ink(x, l[0], 360 + k * 34, 71, 15, '#1d1f22', F.heavy, { weight: '900' }); });
        x.fillStyle = '#ffd23a'; x.fillRect(470, 36, 46, 30); ink(x, 'A3', 493, 52, 22, '#1d1f22', F.heavy, { weight: '900' }); ink(x, '→', 545, 64, 70, '#1d1f22', F.heavy, { weight: '900' }); } }),
    N({ id: 'umbrella', native: '傘 ¥500', meaning: 'Umbrella vending — rain falls', lang: 'Japanese', theme: 'Retail', shape: 's', style: 'neon', colors: ['#3ff0ff', '#ff4fa3'], anim: 1,
      draw: picSign('umbrella', { cap: ['傘 ¥500', '#ff4fa3', F.jp, 44], sub: ['UMBRELLA · 24H 自販機', '#8ea9b0', F.jp, 15] }) }),
    N({ id: 'danger', native: '高電圧 DANGER', meaning: 'High-voltage warning, flashing', lang: 'Japanese', theme: 'Utility', shape: 'h', style: 'lightbox', colors: ['#ffd23a', '#111111'], anim: 3,
      draw: function (x, cw, ch, f, d) { var R = prng(d.seed), i = lightbox(x, cw, ch, '#ffd23a', { R: R });
        [[i, 92], [cw - i - 92, 92]].forEach(function (b) { x.save(); x.beginPath(); x.rect(b[0], i, b[1], ch - 2 * i); x.clip(); x.fillStyle = '#111'; for (var k = -4; k < 8; k++) { x.beginPath(); x.moveTo(b[0] + k * 34, i); x.lineTo(b[0] + k * 34 + 17, i); x.lineTo(b[0] + k * 34 + 77, ch); x.lineTo(b[0] + k * 34 + 60, ch); x.closePath(); x.fill(); } x.restore(); });
        x.fillStyle = '#111'; x.beginPath(); x.moveTo(146, 30); x.lineTo(184, 96); x.lineTo(108, 96); x.closePath(); x.fill(); inkPicto(x, 'bolt', 128, 46, 38, '#ffd23a', 0, .14);
        ink(x, '高電圧', 330, 58, 56, '#111', F.jp, { weight: '900' }); ink(x, 'DANGER · HIGH VOLTAGE', 330, 100, 22, '#111', F.heavy, { maxW: 300, weight: '800' }); ink(x, '関係者以外立入禁止', 330, 124, 13, '#3a2f00', F.jp, { maxW: 300 }); } }),
    N({ id: 'vacancy', native: 'MOTEL · NO VACANCY', meaning: 'Motel — the NO switches on', lang: 'English', theme: 'Lodging', shape: 'h', style: 'neon', colors: ['#ff2a3a', '#2f9bff'], anim: 1,
      draw: function (x, cw, ch, f, d) { var R = prng(d.seed); backer(x, 4, 4, cw - 8, ch - 8, 8, '#0c1018', R); x.fillStyle = '#16233a'; x.fillRect(16, 16, cw - 32, 34);
        neonText(x, 'M O T E L', cw / 2, 34, 30, '#ffd88a', F.latin, { tube: 1, weight: '800', maxW: 300 }); neonText(x, 'NO', 112, 96, 74, '#ff2a3a', F.latin, { tube: 1, weight: '800', off: !f });
        neonText(x, 'VACANCY', 370, 96, 74, '#2f9bff', F.latin, { tube: 1, maxW: 360, weight: '800' }); ink(x, 'TV · A/C · ¥4,800', cw / 2, 136, 12, '#7d8aa0', F.mono, { weight: '700' }); } }),
    // ---------- culture ----------
    N({ id: 'torii', native: '稲荷神社', meaning: 'Shrine gate — 200 m ahead', lang: 'Japanese', theme: 'Culture', shape: 's', style: 'neon', colors: ['#ff4a1f', '#ffcf3a'], anim: 0,
      draw: picSign('torii', { cap: ['稲荷神社', '#ffcf3a', F.min, 40, 0, '900'], sub: ['↑ 200m · INARI SHRINE', '#b39a7a', F.heavy, 15] }) }),
    N({ id: 'kitsune', native: '狐面', meaning: 'Fox mask — eyes close', lang: 'Japanese', theme: 'Culture', shape: 's', style: 'neon', colors: ['#f4f1ff', '#ff2a3a'], anim: 1,
      draw: picSign('kitsune', { cap: ['狐', '#ff2a3a', F.min, 48, 0, '900'], sub: ['面・仮面 · MASKS', '#a8a0b8', F.jp, 15], orn: function (c, cw, ch, f, L) { sparkles(c, [[L.ox - 4, L.oy + 20, 18], [L.ox + L.S + 2, L.oy + 50, 14]], '#ff2a3a'); } }) }),
    N({ id: 'maneki', native: '千客万来', meaning: 'Beckoning cat — paw waves', lang: 'Japanese', theme: 'Culture', shape: 's', style: 'neon', colors: ['#ffcf3a', '#ff2a3a'], anim: 1,
      draw: picSign('maneki', { mount: 'backer', backer: '#1a0c0c', border: '#ff2a3a', double: 1, border2: '#ffcf3a', cap: ['千客万来', '#ffcf3a', F.min, 40, 0, '900'], sub: ['招き猫 · LUCKY', '#c49a6a', F.jp, 15] }) }),
    N({ id: 'fu', native: '福', meaning: 'Good fortune — hanging round lightbox', lang: 'Chinese', theme: 'Culture', shape: 'c', style: 'lightbox', colors: ['#d1191f', '#ffd36b'], anim: 4,
      draw: function (x, cw, ch, f, d) { var R = prng(d.seed); lightbox(x, cw, ch, '#d1191f', { round: 1, R: R, border: '#ffd36b', double: 1 });
        x.save(); x.fillStyle = '#ffd36b'; for (var i = 0; i < 24; i++) { var a = i / 24 * TAU; x.beginPath(); x.arc(cw / 2 + Math.cos(a) * cw * .33, ch / 2 + Math.sin(a) * ch * .33, 3, 0, TAU); x.fill(); } x.restore();
        x.save(); x.translate(cw / 2, ch / 2 + 6); x.rotate(Math.PI); ink(x, '福', 0, 0, 150, '#ffd36b', F.tcs, { weight: '900', stroke: '#7a0a0e', strokeW: .05 }); x.restore(); } }),
    N({ id: 'lotus', native: '蓮華寺', meaning: 'Temple lotus — incense smoke', lang: 'Japanese', theme: 'Culture', shape: 's', style: 'neon', colors: ['#ff7ad0', '#39ff7a'], anim: 4,
      draw: picSign('lotus', { cap: ['蓮華寺', '#ff7ad0', F.min, 42, 0, '900'], sub: ['参拝 6:00 — 22:00', '#a8a0a0', F.jp, 15] }) }),
    // ---------- animals & machines ----------
    N({ id: 'octopus', native: 'たこ焼', meaning: 'Takoyaki — octopus legs wave', lang: 'Japanese', theme: 'Food', shape: 's', style: 'neon', colors: ['#ff7a1f', '#ffffff'], anim: 1,
      draw: picSign('octopus', { cap: ['たこ焼', '#ffffff', F.jp, 46, 0, '900'], sub: ['8個 ¥600 · ソース/塩', '#b0967a', F.jp, 15] }) }),
    N({ id: 'rabbit', native: 'BUNNY BAR', meaning: 'Bunny bar — ear flops', lang: 'English', theme: 'Nightlife', shape: 's', style: 'neon', colors: ['#d8f4ff', '#ff7ad0'], anim: 1,
      draw: picSign('rabbit', { cap: ['Bunny', '#ff7ad0', F.script, 54, 1, '400'], sub: ['BAR · 3F · ガールズ', '#a89aaa', F.jp, 15] }) }),
    N({ id: 'shiba', native: '柴 PET', meaning: 'Pet shop shiba — tongue out', lang: 'Japanese', theme: 'Retail', shape: 's', style: 'neon', colors: ['#ffad33', '#ff4f6a'], anim: 1,
      draw: picSign('shiba', { cap: ['PET 柴', '#ffad33', F.jp, 42, 0, '900'], sub: ['トリミング · HOTEL', '#b0a080', F.jp, 15], orn: function (c, cw, ch, f, L) { [[L.ox - 14, L.oy + L.S - 40], [L.ox + L.S - 10, L.oy + 6]].forEach(function (p) { neonPicto(c, 'paw', p[0], p[1], 34, ['#ff4f6a'], 0, { cast: false }); }); } }) }),
    N({ id: 'crab', native: '蟹 KANI', meaning: 'Live crab restaurant — claws snap', lang: 'Japanese', theme: 'Food', shape: 's', style: 'neon', colors: ['#ff3b2f', '#ffd0c0'], anim: 1,
      draw: picSign('crab', { mount: 'backer', backer: '#160b0a', bulbs: '#ffe2b0', cap: ['蟹 KANI', '#ffd0c0', F.min, 40, 0, '900'], sub: ['活がに · 2F', '#c09880', F.jp, 15] }) }),
    N({ id: 'moto', native: 'BIKE PARTS', meaning: 'Motorbike parts — speed chaser', lang: 'English', theme: 'Vehicles', shape: 'w', style: 'neon', colors: ['#3ff0ff', '#ff3df0'], anim: 2,
      draw: picSign('moto', { mount: 'backer', backer: '#0b1016', border: '#ff3df0', cap: ['BIKE PARTS', '#3ff0ff', F.latin, 46, 1, '800'], sub: ['バイク修理 · 改造', '#8aa0aa', F.jp, 16] }) }),
    N({ id: 'rocket', native: 'SPACE BAR', meaning: 'Rocket bar — thrust flickers', lang: 'English', theme: 'Nightlife', shape: 's', style: 'neon', colors: ['#f4f6ff', '#ff7a1f'], anim: 1,
      draw: picSign('rocket', { ring: '#3ff0ff', cap: ['SPACE BAR', '#ff7a1f', F.latin, 40, 1, '800'], sub: ['宇宙酒場 · B1', '#9aa0b0', F.jp, 15] }) }),
    N({ id: 'sneaker', native: 'KICKS', meaning: 'Sneaker shop — chaser', lang: 'English', theme: 'Retail', shape: 'w', style: 'neon', colors: ['#b6ff3a', '#ffffff'], anim: 2,
      draw: picSign('sneaker', { cap: ['KICKS', '#ffffff', F.heavy, 64, 1, '900'], sub: ['スニーカー · 限定', '#a0b088', F.jp, 16] }) }),
    N({ id: 'skull', native: 'DEAD END', meaning: 'Bar Dead End — eyes cross', lang: 'English', theme: 'Nightlife', shape: 's', style: 'neon', colors: ['#b6ff3a', '#e8fff0'], anim: 1,
      draw: picSign('skull', { cap: ['DEAD END', '#e8fff0', F.latin, 42, 1, '800'], sub: ['ROCK BAR · 地下', '#94a890', F.jp, 15] }) }),
    N({ id: 'diamond', native: '金 買取', meaning: 'Gold & jewel buyer — bulb box', lang: 'Japanese', theme: 'Money', shape: 's', style: 'neon', colors: ['#bfefff', '#ffffff'], anim: 4,
      draw: picSign('diamond', { mount: 'backer', backer: '#0c1216', bulbs: '#fff2c2', cap: ['金 買取', '#ffd36b', F.jp, 44, 0, '900'], sub: ['GOLD · 宝石 · 時計', '#a8b6bd', F.jp, 15] }) }),
    N({ id: 'planet', native: 'PLANETARIUM BAR', meaning: 'Planetarium bar 星屑', lang: 'English', theme: 'Nightlife', shape: 's', style: 'neon', colors: ['#9b6bff', '#ff9a3c'], anim: 0,
      draw: picSign('planet', { cap: ['星屑', '#ff9a3c', F.min, 46, 0, '900'], sub: ['PLANETARIUM BAR · 7F', '#a49ab8', F.heavy, 14], orn: function (c, cw, ch, f, L) { sparkles(c, [[L.ox + 8, L.oy + L.S - 10, 14], [L.ox + L.S - 6, L.oy + 14, 18]], '#ffffff'); } }) }),
    // ---------- stacks & tickers ----------
    N({ id: 'izakaya', native: '酒 肴 処', meaning: 'Izakaya — stacked tiles on a rod', lang: 'Japanese', theme: 'Food', shape: 'x', style: 'lightbox', colors: ['#efe7d4', '#c81d25', '#ffad33'], anim: 0,
      draw: function (x, cw, ch, f, d) { var R = prng(d.seed), tiles = [['酒', '#efe7d4', '#b3141c'], ['肴', '#c81d25', '#ffffff'], ['処', '#ffad33', '#1b1308']], h = (ch - 70) / 3;
        hangers(x, [cw / 2], 16, R); x.fillStyle = '#2a2b2e'; x.fillRect(cw / 2 - 3, 16, 6, ch - 30);
        tiles.forEach(function (t, k) { var y = 18 + k * (h + 16); lightbox(x, cw, h, t[1], { Y: y, R: R, border: t[2] });
          ink(x, t[0], cw / 2, y + h / 2 + 2, Math.min(cw, h) * .6, t[2], F.min, { weight: '900' }); if (k < 2) { x.strokeStyle = '#3a3c40'; x.lineWidth = 2; for (var c = 0; c < 3; c++) { x.beginPath(); x.ellipse(cw / 2, y + h + 4 + c * 4, 2.5, 3, 0, 0, TAU); x.stroke(); } } });
        ink(x, '居酒屋 ふく', cw / 2, ch - 16, 18, '#9a8a70', F.jp, { maxW: cw - 30 }); } }),
    N({ id: 'directory', native: '第三栄光ビル', meaning: 'Tenant directory of a mixed-use building', lang: 'Japanese', theme: 'Mixed', shape: 'x', style: 'lightbox', colors: ['#ffd23a', '#ff4fa3', '#9b6bff', '#39c46a'], anim: 0,
      draw: function (x, cw, ch, f, d) { var R = prng(d.seed);
        var rows = [['8F', '麻雀 白龍', '#ffd23a', '#111'], ['7F', 'BAR 蝶', '#ff4fa3', '#fff'], ['6F', 'スナック 夢', '#9b6bff', '#fff'], ['5F', '空室', '#3a3c40', '#8a8d92'], ['4F', 'ネイル Lily', '#ff7ad0', '#fff'], ['3F', '歯科', '#e9f4f2', '#1d5fd6'], ['2F', 'カラオケ', '#2f7bff', '#fff'], ['1F', '牛丼', '#ff8a1f', '#fff'], ['B1', 'LIVE', '#ff3b2f', '#fff']];
        var fg = x.createLinearGradient(0, 0, 0, ch); fg.addColorStop(0, '#45484d'); fg.addColorStop(.04, '#232528'); fg.addColorStop(1, '#121315'); x.fillStyle = fg; rr(x, 0, 0, cw, ch, 6); x.fill(); x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 1.5; rr(x, 1, 1, cw - 2, ch - 2, 6); x.stroke();
        x.fillStyle = '#0c0d0f'; x.fillRect(8, 8, cw - 16, 46); ink(x, '第三栄光ビル', cw / 2, 25, 22, '#d8d2c2', F.min, { maxW: cw - 30, weight: '900' }); ink(x, 'EIKO BLDG. No.3', cw / 2, 44, 10, '#8a857a', F.heavy, { weight: '800' });
        var top = 60, h = (ch - top - 10) / rows.length;
        rows.forEach(function (r, k) { var y = top + k * h; lightbox(x, cw - 16, h - 4, r[2], { X: 8, Y: y, R: R });
          x.fillStyle = '#101113'; x.fillRect(12, y + 4, 42, h - 12); ink(x, r[0], 33, y + h / 2 - 1, 22, '#f2f2f2', F.heavy, { weight: '800' }); ink(x, r[1], 54 + (cw - 62) / 2, y + h / 2, 30, r[3], F.jp, { maxW: cw - 80 }); });
        screws(x, [[5, 5], [cw - 5, 5], [5, ch - 5], [cw - 5, ch - 5]], 2.4); sticker(x, cw - 52, top + 3 * h + 10, 34, 24, .08, R, '#f3ecd2'); } }),
    N({ id: 'sale_kr', native: '오늘 특가 ★ 50% OFF', meaning: "Convenience store specials ticker", lang: 'Korean', theme: 'Retail', shape: 'm', style: 'matrix', colors: ['#ff3b2f', '#ffd23a'], anim: 5, view: .5,
      draw: function (x, cw, ch, f, d) { matrix(x, cw, ch, 14, function (oc, c, r) { segments(oc, [['오늘 특가', '#ffd23a'], [' ★ ', '#ff3b2f'], ['50% OFF', '#ff3b2f'], [' ★ ', '#ffd23a'], ['1+1', '#3ff0ff'], [' ★ ', '#ff3b2f'], ['편의점 24시', '#ffd23a'], [' ★ ', '#ff3b2f'], ['라면 ₩1,500', '#ffffff']], 4, r / 2 + .5, 11, F.kr); }, { seed: d.seed, label: 'P8 · 24시' }); } }),
    N({ id: 'gym', native: 'GYM 筋トレ', meaning: 'All-night gym', lang: 'Japanese', theme: 'Services', shape: 'h', style: 'neon', colors: ['#b6ff3a', '#ffffff'], anim: 2,
      draw: function (x, cw, ch, f, d) { var R = prng(d.seed); backer(x, 4, 4, cw - 8, ch - 8, 10, '#0d1209', R); tubeBorder(x, 14, 14, cw - 28, ch - 28, 6, '#b6ff3a', { double: 1, gap: 7 });
        neonPicto(x, 'dumbbell', 34, 22, 100, ['#b6ff3a'], 0); neonText(x, 'GYM', 285, 66, 84, '#b6ff3a', F.latin, { tube: 1, maxW: 180, weight: '800' }); neonText(x, '筋トレ', 470, 66, 50, '#ffffff', F.jp, { maxW: 150 });
        ink(x, '24H · BOXING · SAUNA · ¥980/月', 330, 114, 15, '#9aa88a', F.jp, { maxW: 360, weight: '700' }); } })
  ];

  var designs = V2.concat(LEGACY), byId = {};
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; }
  designs.forEach(function (d) {
    d.frames = d.anim === 1 ? 2 : 1; d.view = d.view || 1; d.level = d.level || LEVEL[d.style] || 1;
    d.opaque = d.style !== 'neon' || d.backed || d.mounted ? 1 : 0; d.seed = hashStr(d.id); byId[d.id] = d;
  });

  function render(d, frame, scale) {
    scale = scale || 1; var cell = CELL[d.shape], c = document.createElement('canvas'); c.width = Math.round(cell[0] * scale); c.height = Math.round(cell[1] * scale);
    var x = c.getContext('2d'); x.scale(scale, scale); d.draw(x, cell[0], cell[1], frame || 0, d); if (d.opaque && d.anim !== 7) weather(x, cell[0], cell[1], prng(d.seed + .71)); return c;
  }
  function visible(d) { var c = CELL[d.shape]; return [c[0] * (d.anim === 5 ? d.view : 1), c[1] * (d.anim === 7 ? d.view : 1)]; }
  function buildAtlas(list, o) {
    o = o || {}; var W = 2048, maxH = o.maxH || 4096, scale = 1, gap = 6, h, order = list.slice().sort(function (a, b) { return CELL[b.shape][1] - CELL[a.shape][1]; });
    for (var tries = 0; tries < 16; tries++) {
      var cx = 0, cy = 0, row = 0;
      order.forEach(function (d) { var cw = Math.round(CELL[d.shape][0] * scale), w = cw * d.frames, hh = Math.round(CELL[d.shape][1] * scale); if (cx + w > W) { cx = 0; cy += row + gap; row = 0; } d.rect = [cx, cy, w, hh]; d.cellW = cw; cx += w + gap; row = Math.max(row, hh); });
      h = cy + row; if (h <= maxH) break; scale *= .92;
    }
    var H = 512; while (H < h) H *= 2; H = Math.min(H, maxH);
    var c = document.createElement('canvas'); c.width = W; c.height = H; var x = c.getContext('2d');
    order.forEach(function (d) { for (var f = 0; f < d.frames; f++) x.drawImage(render(d, f, scale), d.rect[0] + f * d.cellW, d.rect[1]); });
    return { canvas: c, width: W, height: H, scale: scale };
  }

  // 2D playback that mirrors the city shader (used by previews).
  function fract(v) { return v - Math.floor(v); }
  function h1(n) { return fract(Math.sin(n * 91.7) * 43758.5453); }
  function smooth(a, b, v) { var t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); }
  function maskAt(d, t, u) {
    var s = d.seed;
    if (d.anim === 2) { var head = fract(t * (.35 + s * .4) + s), dd = fract(u - head); return .25 + .75 * smooth(0, .08, dd) * (1 - smooth(.35, .6, dd)) + .25 * (fract(t * .2 + s) > .85 ? 1 : 0); }
    var ph = fract(t * (.18 + s * .1) + s); return u < ph * 1.6 && ph < .85 ? 1 : .04;
  }
  function paint(ctx, d, frames, t, o, dx, dy, dw, dh) {
    o = o || {}; var cell = CELL[d.shape], vis = visible(d), s = d.seed;
    if (dx === undefined) { var cv = ctx.canvas; if (cv.width !== vis[0] || cv.height !== vis[1]) { cv.width = vis[0]; cv.height = vis[1]; } ctx.clearRect(0, 0, vis[0], vis[1]); dx = 0; dy = 0; dw = vis[0]; dh = vis[1]; }
    var drive = 1, frame = 0;
    if (d.anim === 1) frame = fract(t * (.45 + s * .5) + s * 5) > .62 + s * .2 ? 1 : 0;
    if (d.anim === 3) drive = fract(t * (.55 + s * .4) + s * 3) < .62 ? 1 : .05;
    if (d.anim === 4) drive = .55 + .45 * Math.pow(.5 + .5 * Math.sin(t * (2 + s * 2) + s * 20), 2);
    if (o.ageing && s > .55 && fract(t * .11 + s * 7) < .16 && h1(Math.floor(t * (7 + s * 9)) + s) < .45) drive *= .25;
    drive *= .93 + .07 * Math.sin(t * (50 + s * 20) + s * 40);
    var src = frames[Math.min(frame, frames.length - 1)], kx = dw / vis[0], ky = dh / vis[1];
    function blit() {
      ctx.save(); ctx.beginPath(); ctx.rect(dx, dy, dw, dh); ctx.clip();
      if (d.anim === 5) { var off = fract(t * (.03 + s * .03)) * cell[0]; for (var k = 0; k < 2; k++) ctx.drawImage(src, dx + (k * cell[0] - off) * kx, dy, cell[0] * kx, dh); }
      else if (d.anim === 7) { var offy = fract(t * (.12 + s * .06)) * cell[1]; for (var j = 0; j < 2; j++) ctx.drawImage(src, dx, dy + (j * cell[1] - offy) * ky, dw, cell[1] * ky); }
      else ctx.drawImage(src, dx, dy, dw, dh);
      ctx.restore();
    }
    ctx.save(); ctx.globalAlpha = drive;
    if (o.bloom && 'filter' in ctx) { ctx.save(); ctx.filter = 'blur(' + Math.max(2, dh * (d.opaque ? .03 : .05)) + 'px)'; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = drive * (d.opaque ? .35 : .6); blit(); ctx.restore(); }
    blit();
    if (d.anim === 2 || d.anim === 6) {
      ctx.globalCompositeOperation = 'destination-in'; ctx.globalAlpha = 1; var g = ctx.createLinearGradient(dx, 0, dx + dw, 0);
      for (var i = 0; i <= 32; i++) { var u = i / 32; g.addColorStop(u, 'rgba(0,0,0,' + Math.min(1, maskAt(d, t, u)).toFixed(3) + ')'); }
      ctx.fillStyle = g; ctx.fillRect(dx, dy, dw, dh);
    }
    ctx.restore();
  }

  window.PenthouseSignageDesigns = { designs: designs, byId: byId, CELL: CELL, SIZE: SIZE, ANIM: ANIM, STYLE: STYLE, render: render, buildAtlas: buildAtlas, visible: visible, paint: paint, picto: picto };
}());
