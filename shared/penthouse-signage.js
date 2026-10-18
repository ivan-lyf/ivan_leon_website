/* Street-scale neon for the rain city. Three.js r128.
 * Tenant words, pictograms (animals, vehicles, bar/pharmacy/noodle marks) and
 * animated tube signs: wink/flip frames, chasers, blinkers, pulses. Mixed
 * shapes and scales (0.8–9 m). Some are backed lightboxes, others bare tubes
 * on the facade. One canvas atlas, two instanced draws. City metres, Y-up.
 * API: create(THREE,{towers,lite,seed}) -> {group,update(t),setMood(name),getStats,dispose} */
(function () {
  'use strict';
  var JP = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",sans-serif';
  // anim: 0 static, 1 two-frame flip, 2 chaser along x, 3 blink, 4 pulse
  // shape: v vertical, h horizontal, s square, w wide, t tall-thin
  var DESIGNS = [
    { text: '薬局', color: '#ff3d7a', shape: 'v', backed: 1 }, { text: 'ラーメン', color: '#ffb347', shape: 'v', backed: 1 },
    { text: '診療所', color: '#4fe3ff', shape: 'v', backed: 1 }, { text: '電脳修理', color: '#7cff9a', shape: 'v', backed: 1 },
    { text: 'ホテル', color: '#ff4fd8', shape: 'v', backed: 0 }, { text: '質屋', color: '#ffd36b', shape: 'v', backed: 1 },
    { text: 'カラオケ', color: '#b07cff', shape: 'v', backed: 0, anim: 2 }, { text: '二十四時', color: '#5fd3ff', shape: 'v', backed: 1 },
    { text: 'HOTEL', color: '#ff6070', shape: 't', backed: 0, latin: 1, anim: 3 },
    { text: 'BAR 夜光', color: '#ff5ea8', shape: 'h', backed: 1 }, { text: '義体整備 4F', color: '#5ff0ff', shape: 'h', backed: 1 },
    { text: 'NOODLE 屋台', color: '#ffa040', shape: 'h', backed: 1 }, { text: 'DATA LOAN', color: '#9d7cff', shape: 'h', backed: 0 },
    { text: 'OPEN', color: '#ff4040', shape: 'h', backed: 0, anim: 3, latin: 1 }, { text: '旅館 空室', color: '#ff7adf', shape: 'h', backed: 1 },
    { text: 'PACHINKO', color: '#ffd040', shape: 'w', backed: 0, anim: 2, latin: 1 },
    { picto: 'cat', color: '#ff9ad5', shape: 's', anim: 1 }, { picto: 'koi', color: '#ff7a3a', shape: 's', anim: 1 },
    { picto: 'whale', color: '#5fd0ff', shape: 's' }, { picto: 'car', color: '#7cf0ff', shape: 'w', anim: 2 },
    { picto: 'martini', color: '#ff5ea8', shape: 's', anim: 4 }, { picto: 'bowl', color: '#ffb347', shape: 's', anim: 1 },
    { picto: 'cross', color: '#40ff90', shape: 's', anim: 3, backed: 1 }, { picto: 'eye', color: '#b07cff', shape: 's', anim: 1 },
    { picto: 'arrow', color: '#ffd040', shape: 'w', anim: 2 }, { picto: 'heart', color: '#ff3d6a', shape: 's', anim: 4 },
    { picto: 'bolt', color: '#ffe14a', shape: 's', anim: 3 }, { picto: 'robot', color: '#8fd8ff', shape: 's', anim: 1 },
    { picto: 'crane', color: '#e6efff', shape: 's' }, { picto: 'blossom', color: '#ffa0d0', shape: 's', anim: 4 }
  ];
  var ATLAS_H = 2560;
  var CELL = { v: [150, 600], t: [110, 600], h: [600, 150], w: [760, 190], s: [300, 300] };
  // physical size ranges in metres [width] — height follows aspect
  var SIZE = { v: [1.4, 2.6], t: [1.0, 1.5], h: [4.5, 9], w: [6, 11], s: [1.6, 5.5] };

  function pictoPath(x, name, S, f) {
    // S: drawable size; coordinates in 0..1 scaled by S. f: frame 0|1
    function P(pts, close) { x.beginPath(); pts.forEach(function (p, i) { (i ? x.lineTo : x.moveTo).call(x, p[0] * S, p[1] * S); }); if (close) x.closePath(); x.stroke(); }
    function C(cx, cy, r, a0, a1) { x.beginPath(); x.arc(cx * S, cy * S, r * S, a0 || 0, a1 === undefined ? Math.PI * 2 : a1); x.stroke(); }
    function Q(pts) { x.beginPath(); x.moveTo(pts[0][0] * S, pts[0][1] * S); for (var i = 1; i < pts.length; i += 2) x.quadraticCurveTo(pts[i][0] * S, pts[i][1] * S, pts[i + 1][0] * S, pts[i + 1][1] * S); x.stroke(); }
    if (name === 'cat') {
      P([[.2, .42], [.24, .14], [.4, .3], [.6, .3], [.76, .14], [.8, .42]]);
      Q([[.2, .42], [.16, .8], [.5, .84], [.84, .8], [.8, .42]]);
      if (f) { P([[.33, .52], [.43, .52]]); } else C(.38, .52, .045);
      C(.62, .52, .045); P([[.47, .64], [.5, .67], [.53, .64]]);
      P([[.08, .6], [.3, .63]]); P([[.08, .7], [.3, .68]]); P([[.92, .6], [.7, .63]]); P([[.92, .7], [.7, .68]]);
    } else if (name === 'koi') {
      var t = f ? .06 : -.06;
      Q([[.16, .5], [.3, .26], [.6, .36], [.74, .42], [.8, .5 + t]]);
      Q([[.16, .5], [.3, .72], [.6, .62], [.74, .58], [.8, .5 + t]]);
      P([[.8, .5 + t], [.95, .3 + t * 2], [.9, .5 + t], [.95, .7 + t * 2], [.8, .5 + t]]);
      P([[.42, .37], [.5, .22], [.56, .38]]); C(.24, .47, .025); C(.48, .5, .05); C(.62, .46, .035);
    } else if (name === 'whale') {
      Q([[.1, .55], [.2, .3], [.55, .36], [.78, .42], [.84, .5]]);
      Q([[.1, .55], [.3, .78], [.6, .62], [.74, .56], [.84, .5]]);
      P([[.84, .5], [.96, .34], [.92, .48], [.98, .6], [.84, .5]]);
      C(.24, .5, .022); P([[.18, .64], [.5, .62]]); P([[.26, .3], [.24, .14]]); P([[.24, .2], [.16, .12]]); P([[.24, .2], [.32, .12]]);
    } else if (name === 'car') {
      // two frames side by side handled by caller; here S is cell height, width ~4S
      P([[.15, .7], [.35, .7]]); P([[.65, .7], [2.35, .7]]); P([[2.65, .7], [2.95, .7]]);
      P([[.15, .7], [.12, .52], [.6, .42], [1.0, .2], [2.0, .2], [2.5, .42], [2.95, .5], [2.95, .7]]);
      P([[1.08, .27], [1.5, .27], [1.5, .42], [.85, .42]], true); P([[1.62, .27], [1.95, .27], [2.25, .42], [1.62, .42]], true);
      C(.5, .72, .14); C(2.5, .72, .14); P([[3.15, .35], [3.6, .35]]); P([[3.2, .5], [3.8, .5]]); P([[3.15, .62], [3.5, .62]]);
    } else if (name === 'martini') {
      P([[.18, .18], [.82, .18], [.5, .55]], true); P([[.5, .55], [.5, .82]]); P([[.3, .84], [.7, .84]]); C(.6, .3, .05); P([[.6, .3], [.72, .08]]);
    } else if (name === 'bowl') {
      x.beginPath(); x.arc(.5 * S, .55 * S, .34 * S, 0, Math.PI); x.closePath(); x.stroke();
      P([[.62, .5], [.92, .12]]); P([[.68, .5], [.98, .16]]);
      var o = f ? .04 : -.04;
      Q([[.32, .45], [.28 + o, .35], [.34, .25], [.4 - o, .15], [.34, .06]]); Q([[.48, .45], [.44 + o, .35], [.5, .25], [.56 - o, .15], [.5, .06]]);
    } else if (name === 'cross') {
      C(.5, .5, .38); P([[.42, .24], [.58, .24], [.58, .42], [.76, .42], [.76, .58], [.58, .58], [.58, .76], [.42, .76], [.42, .58], [.24, .58], [.24, .42], [.42, .42]], true);
    } else if (name === 'eye') {
      if (f) { Q([[.1, .5], [.5, .72], [.9, .5]]); P([[.3, .6], [.26, .7]]); P([[.5, .64], [.5, .75]]); P([[.7, .6], [.74, .7]]); }
      else { Q([[.1, .5], [.5, .15], [.9, .5]]); Q([[.1, .5], [.5, .85], [.9, .5]]); C(.5, .5, .15); C(.5, .5, .05); }
    } else if (name === 'arrow') {
      P([[.1, .38], [2.9, .38], [2.9, .18], [3.8, .5], [2.9, .82], [2.9, .62], [.1, .62]], true);
    } else if (name === 'heart') {
      x.beginPath(); x.moveTo(.5 * S, .82 * S); x.bezierCurveTo(.05 * S, .5 * S, .15 * S, .1 * S, .5 * S, .32 * S); x.bezierCurveTo(.85 * S, .1 * S, .95 * S, .5 * S, .5 * S, .82 * S); x.stroke();
    } else if (name === 'bolt') {
      P([[.58, .08], [.26, .54], [.48, .54], [.38, .92], [.74, .42], [.52, .42], [.66, .08]], true);
    } else if (name === 'robot') {
      x.beginPath(); x.rect(.2 * S, .3 * S, .6 * S, .5 * S); x.stroke(); P([[.5, .3], [.5, .14]]); C(.5, .11, .04);
      if (f) { P([[.3, .48], [.42, .48]]); } else { x.beginPath(); x.rect(.3 * S, .42 * S, .12 * S, .1 * S); x.stroke(); }
      x.beginPath(); x.rect(.58 * S, .42 * S, .12 * S, .1 * S); x.stroke(); P([[.32, .66], [.68, .66]]); P([[.4, .62], [.4, .7]]); P([[.5, .62], [.5, .7]]); P([[.6, .62], [.6, .7]]);
    } else if (name === 'crane') {
      P([[.08, .58], [.42, .5], [.5, .14], [.6, .5], [.92, .32], [.66, .62], [.4, .7], [.2, .62]], true); P([[.42, .5], [.6, .5]]);
    } else if (name === 'blossom') {
      for (var k = 0; k < 5; k++) { var a = k / 5 * Math.PI * 2 - Math.PI / 2; C(.5 + Math.cos(a) * .2, .5 + Math.sin(a) * .2, .14); } C(.5, .5, .05);
    }
  }
  function drawAtlas(designs) {
    var c = document.createElement('canvas'); c.width = 2048; c.height = ATLAS_H;
    var x = c.getContext('2d'); x.clearRect(0, 0, 2048, ATLAS_H);
    var cx = 0, cy = 0, row = 0;
    designs.slice().sort(function (a, b) { return CELL[b.shape][1] - CELL[a.shape][1]; }).forEach(function (d) {
      var cell = CELL[d.shape], frames = d.anim === 1 ? 2 : 1, w = cell[0] * frames, h = cell[1];
      if (cx + w > 2048) { cx = 0; cy += row + 8; row = 0; }
      d.rect = [cx, cy, w, h]; d.frames = frames; cx += w + 8; row = Math.max(row, h);
      for (var f = 0; f < frames; f++) {
        var ox = d.rect[0] + f * cell[0], oy = d.rect[1], cw = cell[0], ch = cell[1];
        x.save(); x.translate(ox, oy);
        if (d.backed) {
          x.fillStyle = '#07080b'; x.fillRect(4, 4, cw - 8, ch - 8);
          x.strokeStyle = d.color; x.globalAlpha = .5; x.lineWidth = 3; x.strokeRect(10, 10, cw - 20, ch - 20); x.globalAlpha = 1;
        }
        x.strokeStyle = d.color; x.fillStyle = d.color; x.lineCap = 'round'; x.lineJoin = 'round';
        if (d.text) {
          var vertical = d.shape === 'v' || d.shape === 't';
          var glyphs = vertical ? Array.from(d.text) : [d.text];
          var size = vertical ? Math.min(cw * .72, (ch - 40) / glyphs.length * .86) : Math.min(ch * .5, (cw - 50) / (d.text.length * .62));
          x.font = (d.latin ? '800 ' : '700 ') + size + 'px ' + (d.latin ? '"Arial Narrow","Helvetica Neue",Arial,sans-serif' : JP);
          x.textAlign = 'center'; x.textBaseline = 'middle';
          glyphs.forEach(function (g, k) {
            var px = cw / 2, py = vertical ? 20 + (ch - 40) / glyphs.length * (k + .5) : ch / 2 + 2;
            x.shadowColor = d.color; x.shadowBlur = size * .4; x.globalAlpha = 1; x.fillText(g, px, py);
            x.shadowBlur = size * .1; x.globalAlpha = .6; x.fillStyle = '#fff'; x.fillText(g, px, py); x.fillStyle = d.color; x.globalAlpha = 1;
          });
        } else {
          var S = ch - 40; x.translate(20, 20);
          if (d.shape === 'w') { S = ch - 40; x.translate((cw - 40 - S * 4) / 2, 0); }
          x.lineWidth = S * .045; x.shadowColor = d.color; x.shadowBlur = S * .09; pictoPath(x, d.picto, S, f);
          x.lineWidth = S * .016; x.shadowBlur = S * .02; x.strokeStyle = '#fff'; x.globalAlpha = .65; pictoPath(x, d.picto, S, f); x.globalAlpha = 1;
        }
        x.restore();
      }
    });
    return c;
  }
  window.PenthouseSignage = {
    create: function (T, options) {
      options = options || {};
      var group = new T.Group(); group.name = 'Tenant neon, pictograms and backlit shop signs';
      var geometries = [], materials = [], textures = [];
      var seed = options.seed || 55127;
      function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
      var designs = DESIGNS.map(function (d) { return Object.assign({ anim: 0, backed: 0 }, d); });
      var atlas = new T.CanvasTexture(drawAtlas(designs)); atlas.anisotropy = 4; atlas.minFilter = T.LinearMipmapLinearFilter; textures.push(atlas);
      var signs = [], limit = options.lite ? 50 : 120;
      (options.towers || []).forEach(function (t) {
        if (signs.length >= limit || t.shape === 'round') return;
        if (t.z < -240 || t.z > -40 || Math.abs(t.x) > 140 || t.w < 6) return;
        var low = t.y - t.h / 2, high = t.y + t.h / 2;
        var yLo = Math.max(low + 3, -50), yHi = Math.min(high - 4, 30);
        if (yHi - yLo < 5) return;
        var n = rnd() < .7 ? 1 + Math.floor(rnd() * 3.4) : 0;
        for (var i = 0; i < n && signs.length < limit; i++) {
          var d = designs[Math.floor(rnd() * designs.length)], cell = CELL[d.shape], size = SIZE[d.shape];
          var w = size[0] + Math.pow(rnd(), 1.6) * (size[1] - size[0]), h = w * cell[1] / cell[0];
          if (h > t.h * .5) continue;
          var y = yLo + Math.pow(rnd(), 1.25) * (yHi - yLo);
          var onSide = rnd() < .32 && Math.abs(t.x) > 12;
          var s = { w: w, h: h, y: y, d: d, seed: rnd(), gain: .5 + rnd() * .95, tilt: (rnd() - .5) * (d.backed ? .02 : .06) };
          if (onSide) { var face = t.x < 0 ? 1 : -1; s.x = t.x + face * (t.w / 2 + 2.5); s.z = t.z + (rnd() - .5) * t.d * .6; s.ry = face * Math.PI / 2; }
          else { s.x = t.x + (rnd() - .5) * Math.max(0, t.w - w) * .9; s.z = t.z + t.d / 2 + 2.5 + rnd() * .3; s.ry = 0; }
          // Reserve the logo's physical facade space so nearby tenant signs and
          // their halos cannot obscure a crown identity (including side faces).
          var blocked=(options.exclusions||[]).some(function(p){return Math.abs(s.x-p.x)<p.w*.5+(onSide?.3:w*.5)+3&&Math.abs(s.y-p.y)<(h+p.w*.25)*.5+2&&Math.abs(s.z-p.z)<8+(onSide?w*.5:.3);});
          if(!blocked)signs.push(s);
        }
      });
      var count = signs.length;
      var plane = new T.PlaneGeometry(1, 1); geometries.push(plane);
      var faceGeometry = plane.clone(); geometries.push(faceGeometry);
      var cellA = new Float32Array(count * 4), meta = new Float32Array(count * 4), colorA = new Float32Array(count * 3);
      signs.forEach(function (s, i) {
        var r = s.d.rect, cw = CELL[s.d.shape][0];
        // CanvasTexture flipY: canvas top maps to v=1. aCell.z is one frame's width.
        cellA.set([r[0] / 2048, 1 - (r[1] + r[3]) / ATLAS_H, cw / 2048, r[3] / ATLAS_H], i * 4);
        meta.set([s.seed, s.gain, s.d.anim, s.d.backed], i * 4);
        new T.Color(s.d.color).convertSRGBToLinear().toArray(colorA, i * 3);
      });
      faceGeometry.setAttribute('aCell', new T.InstancedBufferAttribute(cellA, 4));
      faceGeometry.setAttribute('aMeta', new T.InstancedBufferAttribute(meta, 4));
      var uniforms = T.UniformsUtils.merge([T.UniformsLib.fog, { uTime: { value: 0 }, uGain: { value: 1 } }]);
      uniforms.uAtlas = { value: atlas };
      var faceMaterial = new T.ShaderMaterial({
        uniforms: uniforms, fog: true, transparent: true, depthWrite: true, extensions: { derivatives: true },
        vertexShader: [
          '#include <common>', '#include <fog_pars_vertex>',
          'attribute vec4 aCell,aMeta;varying vec2 vLocal;varying vec4 vCell,vMeta;',
          'void main(){vLocal=uv;vCell=aCell;vMeta=aMeta;',
          'vec4 mvPosition=viewMatrix*modelMatrix*instanceMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;',
          '#include <fog_vertex>', '}'
        ].join('\n'),
        fragmentShader: [
          '#include <common>', '#include <fog_pars_fragment>',
          'uniform sampler2D uAtlas;uniform float uTime,uGain;varying vec2 vLocal;varying vec4 vCell,vMeta;',
          'float h1(float n){return fract(sin(n*91.7)*43758.5453);}',
          'float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
          'void main(){',
          // Prevent interpolation noise from changing the aged-tube masks.
          ' float seed=floor(vMeta.x*4096.+.5)/4096.,gain=vMeta.y,anim=vMeta.z,backed=vMeta.w;',
          ' float frame=0.;',
          ' if(anim>.5&&anim<1.5){float ph=fract(uTime*(.45+seed*.5)+seed*5.);frame=step(.62+seed*.2,ph);}',
          ' vec4 tex=texture2D(uAtlas,vCell.xy+vec2((vLocal.x+frame)*vCell.z,vLocal.y*vCell.w));',
          ' vec3 c=pow(max(tex.rgb,0.),vec3(2.2));',
          ' float lum=max(c.r,max(c.g,c.b));',
          ' float panel=backed*step(lum,.012);',
          // Animation programmes.
          ' float drive=1.;',
          ' if(anim>1.5&&anim<2.5){float head=fract(uTime*(.35+seed*.4)+seed);float d=fract(vLocal.x-head);drive=.25+.75*smoothstep(.0,.08,d)*(1.-smoothstep(.35,.6,d))+.25*step(.85,fract(uTime*.2+seed));}',
          ' else if(anim>2.5&&anim<3.5){float ph=fract(uTime*(.55+seed*.4)+seed*3.);drive=step(ph,.62)+.05;}',
          ' else if(anim>3.5){drive=.55+.45*pow(.5+.5*sin(uTime*(2.+seed*2.)+seed*20.),2.);}',
          // Ageing: one tube section stutters or has died; hum on the rest.
          ' float segment=floor(vLocal.y*5.+seed*3.)+floor(vLocal.x*3.)*7.;',
          ' float failing=step(.64,h1(seed*13.+segment));',
          ' float stutter=step(.35,h1(floor(uTime*(7.+seed*9.))+segment*3.1+seed));',
          ' float dead=step(.94,h1(seed*7.+segment*1.7));',
          ' float hum=.93+.07*sin(uTime*(50.+seed*20.)+seed*40.);',
          ' float flick=mix(1.,stutter,failing*step(.45,seed))*(1.-dead*.9)*hum;',
          ' float grime=.72+.28*h2(floor(vLocal*vec2(18.,36.))+seed);',
          ' vec3 emit=c*flick*drive*grime*gain*uGain*3.;',
          ' float alpha=backed>.5?max(tex.a,panel):smoothstep(.015,.22,lum)*tex.a;',
          ' if(alpha<.02)discard;',
          ' gl_FragColor=vec4(emit+panel*vec3(.002,.0022,.0026),alpha);',
          '#include <fog_fragment>', '#include <tonemapping_fragment>', '#include <encodings_fragment>', '}'
        ].join('\n')
      });
      materials.push(faceMaterial);
      var faces = new T.InstancedMesh(faceGeometry, faceMaterial, Math.max(count, 1)); faces.name = 'Worn tenant signage'; faces.count = count; faces.frustumCulled = false; faces.renderOrder = 3;
      var haloGeometry = plane.clone(); geometries.push(haloGeometry);
      haloGeometry.setAttribute('aColor', new T.InstancedBufferAttribute(colorA, 3));
      haloGeometry.setAttribute('aMeta', new T.InstancedBufferAttribute(meta, 4));
      var haloMaterial = new T.ShaderMaterial({
        uniforms: { uTime: uniforms.uTime, uGain: uniforms.uGain }, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
        vertexShader: 'attribute vec3 aColor;attribute vec4 aMeta;uniform float uTime;varying vec2 vUv;varying vec3 vColor;varying float vFade;void main(){vUv=uv;float on=aMeta.z>2.5&&aMeta.z<3.5?step(fract(uTime*(.55+aMeta.x*.4)+aMeta.x*3.),.62)+.05:1.;vColor=aColor*aMeta.y*on;vec4 mv=viewMatrix*modelMatrix*instanceMatrix*vec4(position,1.);vFade=exp(-max(0.,-mv.z)*.0011);gl_Position=projectionMatrix*mv;}',
        fragmentShader: 'uniform float uGain;varying vec2 vUv;varying vec3 vColor;varying float vFade;void main(){vec2 q=(vUv-.5)*2.;float a=exp(-dot(q,q)*3.2)*.05*vFade*uGain;gl_FragColor=vec4(vColor*a,1.);}'
      });
      materials.push(haloMaterial);
      var halos = new T.InstancedMesh(haloGeometry, haloMaterial, Math.max(count, 1)); halos.name = 'Rain scatter around signage'; halos.count = count; halos.frustumCulled = false; halos.renderOrder = 2;
      var o = new T.Object3D();
      signs.forEach(function (s, i) {
        o.position.set(s.x, s.y, s.z); o.rotation.set(0, s.ry, s.tilt); o.scale.set(s.w, s.h, 1); o.updateMatrix(); faces.setMatrixAt(i, o.matrix);
        o.position.set(s.x + Math.sin(s.ry) * .4, s.y, s.z + Math.cos(s.ry) * .4); o.rotation.set(0, s.ry, 0); o.scale.set(s.w * 2.4 + 4, s.h * 1.9 + 4, 1); o.updateMatrix(); halos.setMatrixAt(i, o.matrix);
      });
      faces.instanceMatrix.needsUpdate = true; halos.instanceMatrix.needsUpdate = true;
      group.add(faces, halos);
      return {
        group: group,
        update: function (t) { uniforms.uTime.value = t; },
        setMood: function (name) { uniforms.uGain.value = name === 'night' ? 1 : .55; },
        getStats: function () { return { signs: count, designs: designs.length, drawCalls: 2 }; },
        dispose: function () { geometries.forEach(function (g) { g.dispose(); }); materials.forEach(function (m) { m.dispose(); }); textures.forEach(function (t) { t.dispose(); }); group.clear(); }
      };
    }
  };
}());
