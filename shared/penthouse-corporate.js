/* Corporate crown identities: AXL, Prism and Vectra (the original city marks,
 * shared/assets/logos/*.png) plus three new tenants drawn here — KUJIRA
 * (hologram arts, owner of the whale), OKAMI Heavy Industries and Halcyon Life
 * Sciences. Channel-letter LED signs on steel rails with module wear and a
 * bounded spill field read by the facade/structure shaders. City metres.
 * API: create(THREE,{placements,lite}) -> {group,ready,glsl,uniforms,update,setMood,getStats,dispose}
 * placements: [{logo,x,y,z,w,ry?}] — logo 0 AXL,1 Prism,2 Vectra,3 Kujira,4 Okami,5 Halcyon */
(function () {
  'use strict';
  var SLOTS = 6, SLOT_H = 512, MAX_SPILL = 8;
  var FILES = ['shared/assets/logos/axl.png', 'shared/assets/logos/prism.png', 'shared/assets/logos/vectra.png'];
  // Emission tint (multiplies the artwork) and spill colour, sRGB.
  var TINT = ['#9fe6ff', '#ffffff', '#d8ecff', '#7fdcff', '#ff4a3a', '#ffb45a'];
  var SPILL = ['#7fd8f0', '#f2d6b0', '#b9c8f0', '#4fc4ff', '#ff4a32', '#ffa040'];
  function drawNew(x, type) {
    // 2048 × 512 slot, transparent.
    x.save(); x.lineCap = 'round'; x.lineJoin = 'round';
    if (type === 3) {
      // KUJIRA: whale fluke glyph from three strokes + wide-tracked wordmark.
      x.strokeStyle = '#d6f6ff'; x.lineWidth = 34;
      x.beginPath(); x.moveTo(250, 400); x.quadraticCurveTo(255, 250, 250, 210); x.stroke();
      x.beginPath(); x.moveTo(250, 215); x.bezierCurveTo(190, 120, 90, 120, 60, 160); x.bezierCurveTo(120, 170, 170, 200, 250, 215); x.stroke();
      x.beginPath(); x.moveTo(250, 215); x.bezierCurveTo(310, 120, 410, 120, 440, 160); x.bezierCurveTo(380, 170, 330, 200, 250, 215); x.stroke();
      x.fillStyle = '#d6f6ff'; x.font = '300 210px "Helvetica Neue","Avenir Next",Arial,sans-serif'; x.textBaseline = 'middle';
      var letters = 'KUJIRA'.split(''), px = 540; letters.forEach(function (l) { x.fillText(l, px, 250); px += x.measureText(l).width + 46; });
      x.font = '500 54px "Hiragino Sans","Noto Sans JP",sans-serif'; x.fillText('鯨  PROJECTION ARTS', 548, 420);
    } else if (type === 4) {
      // OKAMI: angular wolf-head chevron + heavy condensed wordmark.
      x.fillStyle = '#ffe4dc';
      x.beginPath(); x.moveTo(70, 90); x.lineTo(170, 200); x.lineTo(250, 160); x.lineTo(330, 200); x.lineTo(430, 90); x.lineTo(400, 300); x.lineTo(250, 440); x.lineTo(100, 300); x.closePath(); x.fill();
      x.globalCompositeOperation = 'destination-out';
      x.beginPath(); x.moveTo(160, 270); x.lineTo(230, 300); x.lineTo(180, 320); x.closePath(); x.fill();
      x.beginPath(); x.moveTo(340, 270); x.lineTo(270, 300); x.lineTo(320, 320); x.closePath(); x.fill();
      x.fillRect(0, 352, 520, 14);
      x.globalCompositeOperation = 'source-over';
      x.font = '900 250px "Arial Black","Helvetica Neue",Arial,sans-serif'; x.textBaseline = 'middle'; x.fillText('OKAMI', 520, 230);
      x.font = '700 58px "Arial Narrow",Arial,sans-serif'; x.fillText('HEAVY  INDUSTRIES  狼', 530, 410);
    } else if (type === 5) {
      // Halcyon: a sliced rising sun over a horizon rule + light serif wordmark.
      x.save(); x.beginPath(); x.arc(250, 330, 190, Math.PI, 0); x.closePath(); x.clip();
      x.fillStyle = '#ffeacc'; x.fillRect(40, 120, 420, 220);
      x.globalCompositeOperation = 'destination-out'; for (var y = 330 - 34, h = 20; y > 120; y -= 46, h -= 3) x.fillRect(0, y, 520, h);
      x.restore(); x.fillStyle = '#ffeacc'; x.fillRect(40, 350, 420, 12);
      x.font = 'italic 300 220px Georgia,"Times New Roman",serif'; x.textBaseline = 'middle'; x.fillText('Halcyon', 520, 240);
      x.font = '500 50px "Helvetica Neue",Arial,sans-serif'; x.fillText('L I F E   S C I E N C E S', 532, 420);
    }
    x.restore();
  }
  window.PenthouseCorporate = {
    MAX_SPILL: MAX_SPILL,
    glsl: [
      'uniform vec4 uLogoPos[' + MAX_SPILL + '];uniform vec4 uLogoColor[' + MAX_SPILL + '];',
      'vec3 logoSpill(vec3 p,vec3 n){vec3 s=vec3(0.);',
      ' for(int i=0;i<' + MAX_SPILL + ';i++){vec3 q=p-uLogoPos[i].xyz;q.x-=clamp(q.x,-uLogoColor[i].w,uLogoColor[i].w);',
      '  float d2=dot(q,q),r=uLogoPos[i].w;float att=pow(max(0.,1.-d2/(r*r+.001)),2.)/(1.+d2*.06);',
      '  float facing=.15+.85*max(dot(n,-normalize(q+vec3(0.,0.,.001))),0.);s+=uLogoColor[i].rgb*att*facing;}',
      ' return s;}'
    ].join('\n'),
    create: function (T, options) {
      options = options || {};
      var group = new T.Group(); group.name = 'Corporate crown identities';
      var geometries = [], materials = [], textures = [], disposed = false;
      var canvas = document.createElement('canvas'); canvas.width = 2048; canvas.height = SLOTS * SLOT_H;
      var ctx = canvas.getContext('2d');
      for (var t = 3; t < SLOTS; t++) { ctx.save(); ctx.translate(0, t * SLOT_H); drawNew(ctx, t); ctx.restore(); }
      var atlas = new T.CanvasTexture(canvas); atlas.anisotropy = 8; atlas.minFilter = T.LinearMipmapLinearFilter; textures.push(atlas);
      var ready = Promise.all(FILES.map(function (src, i) {
        return new Promise(function (resolve) {
          var img = new Image(); img.onload = function () { if (!disposed) { ctx.drawImage(img, 0, i * SLOT_H, 2048, SLOT_H); atlas.needsUpdate = true; } resolve(); };
          img.onerror = function () { resolve(); }; img.src = src;
        });
      }));
      var spillUniforms = { uLogoPos: { value: [] }, uLogoColor: { value: [] } };
      for (var k = 0; k < MAX_SPILL; k++) { spillUniforms.uLogoPos.value.push(new T.Vector4(0, -1e4, 0, .001)); spillUniforms.uLogoColor.value.push(new T.Vector4(0, 0, 0, 0)); }
      var placements = (options.placements || []).slice(0, 12), count = placements.length;
      var plane = new T.PlaneGeometry(1, 1); geometries.push(plane);
      var g = plane.clone(); geometries.push(g);
      var meta = new Float32Array(count * 4), tint = new Float32Array(count * 3);
      placements.forEach(function (p, i) {
        meta.set([p.logo, Math.random() * 0 + (i * .618) % 1, p.gain || 1, p.worn || 0], i * 4);
        new T.Color(TINT[p.logo]).convertSRGBToLinear().toArray(tint, i * 3);
        if (i < MAX_SPILL) {
          var c = new T.Color(SPILL[p.logo]).convertSRGBToLinear().multiplyScalar(.9 * (p.gain || 1));
          spillUniforms.uLogoPos.value[i].set(p.x, p.y, p.z + .8, Math.max(9, p.w * 1.1));
          spillUniforms.uLogoColor.value[i].set(c.r, c.g, c.b, p.w * .45);
        }
      });
      g.setAttribute('aMeta', new T.InstancedBufferAttribute(meta, 4));
      g.setAttribute('aTint', new T.InstancedBufferAttribute(tint, 3));
      var uniforms = T.UniformsUtils.merge([T.UniformsLib.fog, { uTime: { value: 0 }, uGain: { value: 1 } }]);
      uniforms.uAtlas = { value: atlas };
      var face = new T.ShaderMaterial({
        uniforms: uniforms, fog: true, transparent: true, extensions: { derivatives: true },
        vertexShader: ['#include <common>', '#include <fog_pars_vertex>',
          'attribute vec4 aMeta;attribute vec3 aTint;varying vec2 vLocal;varying vec4 vMeta;varying vec3 vTint;',
          'void main(){vLocal=uv;vMeta=aMeta;vTint=aTint;vec4 mvPosition=viewMatrix*modelMatrix*instanceMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;',
          '#include <fog_vertex>', '}'].join('\n'),
        fragmentShader: ['#include <common>', '#include <fog_pars_fragment>',
          'uniform sampler2D uAtlas;uniform float uTime,uGain;varying vec2 vLocal;varying vec4 vMeta;varying vec3 vTint;',
          'float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
          'void main(){',
          // Keep constant instance seeds stable through fragment interpolation.
          ' float slot=vMeta.x,seed=floor(vMeta.y*4096.+.5)/4096.,gain=vMeta.z,worn=vMeta.w;',
          ' vec2 uv=vec2(vLocal.x,1.-(slot+1.-vLocal.y)/' + SLOTS + '.);',
          ' vec4 tex=texture2D(uAtlas,uv);if(tex.a<.03)discard;',
          ' vec3 c=pow(tex.rgb,vec3(2.2))*vTint;',
          // LED module grid: 64×16 modules; a few dead or dim, one tired row band.
          ' vec2 module=floor(vLocal*vec2(64.,16.));float m=h2(module+seed*31.);',
          ' float dead=step(.985-worn*.03,m);float tired=1.-.35*step(.82,h2(vec2(module.y,seed*7.)))*worn;',
          ' vec2 grid=vLocal*vec2(512.,128.);vec2 aa=max(fwidth(grid),vec2(.001));vec2 cellp=abs(fract(grid)-.5);',
          ' float pitch=mix(.7,(1.-smoothstep(.34-aa.x,.44+aa.x,cellp.x))*(1.-smoothstep(.34-aa.y,.44+aa.y,cellp.y)),1.-smoothstep(.3,.9,max(aa.x,aa.y)));',
          ' float breathe=.96+.04*sin(uTime*.4+seed*20.);',
          ' float glitch=step(.992,fract(sin(floor(uTime*3.+seed*50.))*43758.5))*step(.5,worn);',
          ' vec3 emit=c*(1.-dead*.85)*tired*(.55+.45*pitch)*breathe*(1.-glitch*.6)*gain*uGain*2.2;',
          ' gl_FragColor=vec4(emit,smoothstep(.03,.4,tex.a));',
          '#include <fog_fragment>', '#include <tonemapping_fragment>', '#include <encodings_fragment>', '}'].join('\n')
      });
      materials.push(face);
      var faces = new T.InstancedMesh(g, face, Math.max(count, 1)); faces.count = count; faces.name = 'Channel-letter LED identities'; faces.frustumCulled = false; faces.renderOrder = 3;
      var hg = plane.clone(); geometries.push(hg); hg.setAttribute('aTint', new T.InstancedBufferAttribute(tint, 3));
      var halo = new T.ShaderMaterial({ uniforms: { uGain: uniforms.uGain }, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
        vertexShader: 'attribute vec3 aTint;varying vec2 vUv;varying vec3 vTint;varying float vFade;void main(){vUv=uv;vTint=aTint;vec4 mv=viewMatrix*modelMatrix*instanceMatrix*vec4(position,1.);vFade=exp(-max(0.,-mv.z)*.0009);gl_Position=projectionMatrix*mv;}',
        fragmentShader: 'uniform float uGain;varying vec2 vUv;varying vec3 vTint;varying float vFade;void main(){vec2 q=(vUv-.5)*2.;float a=exp(-(q.x*q.x*2.2+q.y*q.y*3.))*.06*vFade*uGain;gl_FragColor=vec4(vTint*a,1.);}' });
      materials.push(halo);
      var halos = new T.InstancedMesh(hg, halo, Math.max(count, 1)); halos.count = count; halos.name = 'Logo glow in rain'; halos.frustumCulled = false; halos.renderOrder = 2;
      var steel = new T.MeshStandardMaterial({ color: new T.Color('#1a1e23').convertSRGBToLinear(), roughness: .42, metalness: .7 }); materials.push(steel);
      var box = new T.BoxGeometry(1, 1, 1); geometries.push(box);
      var rails = new T.InstancedMesh(box, steel, Math.max(count * 12, 1)); rails.name = 'Sign rails and brackets'; rails.frustumCulled = false;
      var o = new T.Object3D(), ri = 0;
      placements.forEach(function (p, i) {
        var h = p.w / 4, ry = p.ry || 0;
        o.position.set(p.x, p.y, p.z); o.rotation.set(0, ry, 0); o.scale.set(p.w, h, 1); o.updateMatrix(); faces.setMatrixAt(i, o.matrix);
        o.position.set(p.x + Math.sin(ry) * .5, p.y, p.z + Math.cos(ry) * .5); o.scale.set(p.w * 1.8 + 6, h * 3 + 6, 1); o.updateMatrix(); halos.setMatrixAt(i, o.matrix);
        [[0, h * .3, p.w * 1.02, .16], [0, -h * .3, p.w * 1.02, .16]].forEach(function (r) {
          o.position.set(p.x + Math.cos(ry) * r[0], p.y + r[1], p.z - Math.cos(ry) * .3); o.scale.set(r[2], r[3], .22); o.updateMatrix(); rails.setMatrixAt(ri++, o.matrix);
        });
        if (p.rooftop) for (var l = 0; l < 3; l++) { var lx = (l / 2 - .5) * p.w * .8, legH = h / 2 + 1.4; o.position.set(p.x + lx, p.y - h / 2 - legH / 2 + .2, p.z - .4); o.scale.set(.22, legH, .22); o.updateMatrix(); rails.setMatrixAt(ri++, o.matrix); o.position.set(p.x + lx, p.y - h / 2 - legH / 2 + .2, p.z - 1.6); o.rotation.set(.5, 0, 0); o.scale.set(.16, legH * 1.1, .16); o.updateMatrix(); rails.setMatrixAt(ri++, o.matrix); o.rotation.set(0, ry, 0); }
        for (var b = 0; b < 4; b++) { var bx = (b / 3 - .5) * p.w * .9; o.position.set(p.x + Math.cos(ry) * bx, p.y, p.z - Math.cos(ry) * .6 - Math.sin(ry) * bx); o.scale.set(.14, h * .9, .9); o.updateMatrix(); rails.setMatrixAt(ri++, o.matrix); }
      });
      rails.count = ri; faces.instanceMatrix.needsUpdate = halos.instanceMatrix.needsUpdate = rails.instanceMatrix.needsUpdate = true;
      group.add(rails, halos, faces);
      return {
        group: group, ready: ready, uniforms: spillUniforms,
        update: function (time) { uniforms.uTime.value = time; },
        setMood: function (name) { uniforms.uGain.value = name === 'night' ? 1 : .6; },
        getStats: function () { return { identities: count, drawCalls: 3 }; },
        dispose: function () { disposed = true; geometries.forEach(function (x) { x.dispose(); }); materials.forEach(function (x) { x.dispose(); }); textures.forEach(function (x) { x.dispose(); }); group.clear(); }
      };
    }
  };
}());
