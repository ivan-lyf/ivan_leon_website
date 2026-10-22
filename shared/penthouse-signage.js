/* Street-scale signage for the rain city. Three.js r128.
 * Artwork is baked from the user-supplied signal pack v2:
 * neon tubes, backlit lightboxes, LED matrix tickers, channel letters and LCD
 * posters in nine scripts plus pictograms. One baked atlas, two instanced draws
 * (faces + rain-scatter halos). City metres, Y-up.
 * API: create(THREE,{towers,lite,seed,exclusions}) -> {group,update(t),setMood(name),getStats,dispose}
 * Offline source and bake tool live in artwork/signage; no runtime canvas work. */
(function () {
  'use strict';
  // Compose once from the room's authored camera, never from the browser size.
  // This makes the advertisements readable from the desk without moving their
  // addresses between mobile, laptop and desktop render qualities.
  function planPlacements(designs, options) {
    options=options||{};
    var mounting=window.PenthouseSignageMounts.prepare(options);
    var seed=options.seed||55127;
    function rnd(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}
    var signs=[],used={},formatCounts={},buildingCounts={},buildingDesigns={},all=options.towers||[],exclusions=options.exclusions||[];
    // Neighborhood identity belongs to the whole building, not an individual
    // tier or sign height. Repeated artwork stays at least 60 city metres away
    // from the other building's occupied footprint.
    var buildingBounds={},designBuildings={};
    all.forEach(function(t){var b=buildingBounds[t.buildingId]||(buildingBounds[t.buildingId]=[Infinity,Infinity,-Infinity,-Infinity]);b[0]=Math.min(b[0],t.x-t.w/2);b[1]=Math.min(b[1],t.z-t.d/2);b[2]=Math.max(b[2],t.x+t.w/2);b[3]=Math.max(b[3],t.z+t.d/2);});
    function canUse(t,d){
      if(buildingDesigns[t.buildingId]&&buildingDesigns[t.buildingId][d.id])return false;
      var a=buildingBounds[t.buildingId];
      return !(designBuildings[d.id]||[]).some(function(id){var b=buildingBounds[id];return Math.hypot(Math.max(a[0]-b[2],b[0]-a[2],0),Math.max(a[1]-b[3],b[1]-a[3],0))<60;});
    }
    var districts={market:['Food','Retail','Culture','Money'],nightlife:['Nightlife','Lodging','Culture'],services:['Medical','Tech','Services','Transit','Utility','Vehicles']};
    // City geometry is scaled by four when it enters the scene. Transform the
    // authored world-space eye into city-local metres; direction is unchanged.
    var eye=[9.7/4,6.8/4,16.4/4],forward=[-13.2,-1.9,-21.9],fl=Math.hypot.apply(null,forward);
    forward=forward.map(function(n){return n/fl;});
    var right=[-forward[2],0,forward[0]],rl=Math.hypot.apply(null,right);right=right.map(function(n){return n/rl;});
    var up=[-right[2]*forward[1],right[2]*forward[0]-right[0]*forward[2],right[0]*forward[1]];
    function project(x,y,z){var v=[x-eye[0],y-eye[1],z-eye[2]],depth=v[0]*forward[0]+v[1]*forward[1]+v[2]*forward[2];return[(v[0]*right[0]+v[2]*right[2])/(depth*.48773*16/9),(v[0]*up[0]+v[1]*up[1]+v[2]*up[2])/(depth*.48773)];}
    var blockers=all.map(function(t){var min=[t.x-t.w/2,t.y-t.h/2,t.z-t.d/2],max=[t.x+t.w/2,t.y+t.h/2,t.z+t.d/2],rect=[Infinity,Infinity,-Infinity,-Infinity];for(var a=0;a<2;a++)for(var b=0;b<2;b++)for(var c=0;c<2;c++){var p=project(a?max[0]:min[0],b?max[1]:min[1],c?max[2]:min[2]);rect[0]=Math.min(rect[0],p[0]);rect[1]=Math.min(rect[1],p[1]);rect[2]=Math.max(rect[2],p[0]);rect[3]=Math.max(rect[3],p[1]);}return{min:min,max:max,rect:rect};});
    function hits(t,p){var lo=0,hi=.999;for(var i=0;i<3;i++){var d=p[i]-eye[i];if(Math.abs(d)<1e-7){if(eye[i]<t.min[i]||eye[i]>t.max[i])return false;continue;}var a=(t.min[i]-eye[i])/d,b=(t.max[i]-eye[i])/d;if(a>b){var swap=a;a=b;b=swap;}lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)return false;}return hi>0&&lo<.999;}
    function clearPoint(point){var p=project(point[0],point[1],point[2]);for(var i=0;i<blockers.length;i++){var b=blockers[i],r=b.rect;if(b.max[2]<point[2]||p[0]<r[0]||p[0]>r[2]||p[1]<r[1]||p[1]>r[3])continue;if(hits(b,point))return false;}return true;}
    function visible(s){
      var p=project(s.x,s.y,s.z);if(Math.abs(p[0])>.96||p[1]<-.34||p[1]>.40)return false;
      // Test the centre and both horizontal edges. A tiny revealed sliver is not
      // a usable advertisement, even if it technically lies in the frustum.
      for(var i=-1;i<=1;i++){var a=i*.42;if(!clearPoint([s.x+(s.ry?0:s.w*a),s.y,s.z+(s.ry?s.w*a:0)]))return false;}return true;
    }
    function half(s){return s.extents||(s.extents=[Math.abs(Math.cos(s.tilt))*s.w/2+Math.abs(Math.sin(s.tilt))*s.h/2,Math.abs(Math.cos(s.tilt))*s.h/2+Math.abs(Math.sin(s.tilt))*s.w/2]);}
    function blocked(s){
      if(exclusions.some(function(p){return Math.abs(s.x-p.x)<p.w*.5+(s.ry?.3:s.w*.5)+3&&Math.abs(s.y-p.y)<(s.h+p.w*.25)*.5+2&&Math.abs(s.z-p.z)<8+(s.ry?s.w*.5:.3);}))return true;
      var h=half(s);return signs.some(function(p){
        if(Math.abs(s.ry-p.ry)>.01)return false;
        var horizontal=s.ry?Math.abs(s.z-p.z):Math.abs(s.x-p.x),depth=s.ry?Math.abs(s.x-p.x):Math.abs(s.z-p.z),ph=half(p);
        return depth<4&&horizontal<h[0]+ph[0]+1.2&&Math.abs(s.y-p.y)<h[1]+ph[1]+1.2;
      });
    }
    function add(entry,d,w,x,y,side,hero){
      if(!canUse(entry.t,d))return false;
      var t=entry.t,face=t.x<0?1:-1,s={w:w,h:w/d.aspect,y:y,d:d,seed:rnd(),gain:.7+rnd()*.5,tilt:hero?0:(rnd()-.5)*.012,district:t.x<-35?'market':t.x<35?'nightlife':'services',tower:entry.index,buildingId:t.buildingId,hero:!!hero};
      if(side){s.x=t.x+face*(t.w/2+2.5);s.z=t.z+x;s.ry=face*Math.PI/2;}else{s.x=t.x+x;s.z=t.z+t.d/2+2.6;s.ry=0;}
      if(!mounting.fit(s,t))return false;
      var hh=half(s),lo=Math.max(t.y-t.h/2+3,-24),hi=Math.min(t.y+t.h/2-4,26),width=side?t.d:t.w;
      if(Math.abs(x)+hh[0]>width/2-.25||s.y-hh[1]<lo||s.y+hh[1]>hi||blocked(s)||!visible(s))return false;
      // Perspective can make distant addresses look adjacent from the room.
      var projected=project(s.x,s.y,s.z);
      if(signs.some(function(p){if(p.d.id!==d.id)return false;var q=project(p.x,p.y,p.z);return Math.hypot(projected[0]-q[0],projected[1]-q[1])<.18;}))return false;
      signs.push(s);(designBuildings[d.id]||(designBuildings[d.id]=[])).push(t.buildingId);(buildingDesigns[t.buildingId]||(buildingDesigns[t.buildingId]={}))[d.id]=true;buildingCounts[t.buildingId]=(buildingCounts[t.buildingId]||0)+1;used[d.id]=(used[d.id]||0)+1;formatCounts[d.shape]=(formatCounts[d.shape]||0)+1;return true;
    }
    var towers=all.map(function(t,i){return{t:t,index:i};}).filter(function(e){var t=e.t;return t.shape!=='round'&&t.z>=-285&&t.z<=-40&&Math.abs(t.x)<=240&&t.w>=6&&t.h>11&&t.y+t.h/2>-20;});
    // Discard hidden walls before artwork packing. These coarse visibility bands
    // make the one-time planner inexpensive even in the dense far skyline.
    towers=towers.filter(function(e){var t=e.t,lo=Math.max(t.y-t.h/2+3,-24),hi=Math.min(t.y+t.h/2-4,26);e.faces=[false,false];for(var side=0;side<2;side++)for(var row=0;row<5;row++)for(var col=-1;col<=1;col++){
      if(e.faces[side])continue;var offset=col*(side?t.d:t.w)*.25,s={w:1,y:lo+(hi-lo)*(row+.5)/5,ry:side?(t.x<0?1:-1)*Math.PI/2:0};
      if(side){s.x=t.x+(t.x<0?1:-1)*(t.w/2+2.5);s.z=t.z+offset;}else{s.x=t.x+offset;s.z=t.z+t.d/2+2.6;}
      if(visible(s))e.faces[side]=true;
    }return e.faces[0]||e.faces[1];});
    // A few readable moving signs occupy the nearest clear frontage. Give the
    // scrolling restaurant panel room above two flipping/pulsing pictograms.
    var foreground=towers.find(function(e){return e.t.buildingId===16&&e.faces[0];});
    if(foreground)[['shokudo',7.6,0,-15.7],['beer',3,-2.2,-21],['lips',3,2.2,-21]].forEach(function(slot){var d=designs.find(function(d){return d.id===slot[0];});if(d)add(foreground,d,slot[1],slot[2],slot[3],false,false);});
    // Retain a small unbranded group left of KUJIRA, now just four separated
    // panels. It participates in the wider street rhythm instead of dominating.
    var hero=towers.find(function(e){return Math.abs(e.t.x+99.7632)<.1&&Math.abs(e.t.z+140.949)<.1;});
    if(hero&&!exclusions.some(function(p){return all.some(function(t){return t.buildingId===hero.t.buildingId&&Math.abs(p.x-t.x)<t.w/2+p.w/2&&Math.abs(p.z0-t.z)<t.d/2+10;});})){
      [['chicken',6.2,0,7],['sushi',3.2,-1.6,-.5],['qahwa',2.6,1.7,-6],['dragon',6.2,0,-13.2]].forEach(function(slot){var d=designs.find(function(d){return d.id===slot[0];});if(d)add(hero,d,slot[1],slot[2],slot[3],false,true);});
    }
    towers.forEach(function(e){var t=e.t,p=project(t.x,Math.min(t.y+t.h/2-5,5),t.z+t.d/2+2.6);e.rank=Math.abs(p[0])*.7+Math.hypot(t.x-eye[0],t.z-eye[2])/500+(t.w<9?.15:0)+rnd()*.045;});
    towers.sort(function(a,b){return a.rank-b.rank;});
    // Visit each address at most once per round. A six-panel ceiling applies to
    // the whole building, including separate tiers and side walls. Each address
    // may use a given artwork only once, and neighboring addresses cannot share it.
    // Large landmarks cannot consume the selection before smaller neighbours get any.
    for(var pass=0;pass<18&&signs.length<73;pass++){
      var roundBuildings={};
      towers.forEach(function(entry){
      if(signs.length>=73||entry===hero||roundBuildings[entry.t.buildingId]||(buildingCounts[entry.t.buildingId]||0)>=6)return;
      var t=entry.t,district=t.x<-35?'market':t.x<35?'nightlife':'services';
      var lo=Math.max(t.y-t.h/2+3,-24),hi=Math.min(t.y+t.h/2-4,26);if(hi-lo<3)return;
      var side=pass>3&&pass%3===1&&Math.abs(t.x)>20;if(!entry.faces[side?1:0]){if(!entry.faces[side?0:1])return;side=!side;}var wallWidth=side?t.d:t.w;
      var pool=designs.filter(function(d){return canUse(t,d)&&d.size[0]<wallWidth*.82&&d.size[0]/d.aspect<hi-lo&&(formatCounts[d.shape]||0)<(d.shape==='m'?6:d.shape==='p'?3:73);});
      var ranked=pool.map(function(d){return{d:d,score:(used[d.id]||0)*30+(districts[district].indexOf(d.theme)>=0?0:5)+(t.z>-125&&d.anim>0?-8:0)+rnd()*3};}).sort(function(a,b){return a.score-b.score;});
      for(var attempt=0;attempt<Math.min(10,ranked.length);attempt++){
        var d=ranked[attempt].d,w=Math.min(d.size[0]+((pass<9?.35:.05)+.35*rnd())*(d.size[1]-d.size[0]),wallWidth*.78,(hi-lo)*d.aspect*.85),h=w/d.aspect;
        var low=lo+h/2+.1,high=hi-h/2-.1;if(high<=low)continue;
        for(var position=0;position<9;position++){
          var y=high-(high-low)*((pass*.27+position*.381966+rnd()*.08)%1),x=(rnd()-.5)*Math.max(0,wallWidth-w-1.2);
          if(add(entry,d,w,x,y,side,false)){roundBuildings[t.buildingId]=true;return;}
        }
      }
      });
    }
    return options.lite?signs.slice(0,50):signs;
  }
  window.PenthouseSignage = {
    plan: planPlacements,
    create: function (T, options) {
      options=options||{};
      var data=window.PenthouseBannerAtlas;
      if(!data)throw new Error('Banner atlas metadata must load before signage');
      var group=new T.Group();group.name='District tenant banners';group.visible=false;
      var geometries=[],materials=[],textures=[],disposed=false,loaded=false,loadError=null;
      var designs=data.designs,signs=planPlacements(designs,options);
      // Physical housings and brackets join the existing building geometry batch.
      var mountParts=window.PenthouseSignageMounts.parts(signs);
      if(options.mountTarget)mountParts.forEach(function(part){options.mountTarget.push(part);});
      var atlas;
      var ready=new Promise(function(resolve){
        atlas=new T.TextureLoader().load(options.lite?data.liteTexture:data.texture,function(){
          if(!disposed){loaded=true;group.visible=true;}resolve();
        },undefined,function(error){loadError='Banner atlas could not load';console.warn(loadError,error);resolve();});
      });
      // The shader performs its own sRGB conversion, matching the previous atlas.
      atlas.encoding=T.LinearEncoding;atlas.flipY=true;atlas.anisotropy=4;atlas.minFilter=T.LinearMipmapLinearFilter;atlas.magFilter=T.LinearFilter;atlas.generateMipmaps=true;textures.push(atlas);
      var count=signs.length,W=data.width,H=data.height;

      var plane = new T.PlaneGeometry(1, 1); geometries.push(plane);
      var faceGeometry = plane.clone(); geometries.push(faceGeometry);
      var cellA = new Float32Array(count * 4), meta = new Float32Array(count * 4), viewA = new Float32Array(count), strideA = new Float32Array(count), colorA = new Float32Array(count * 3);
      signs.forEach(function (s, i) {
        var r = s.d.rect;
        // CanvasTexture flipY: canvas top maps to v=1. aCell.z is one frame's width.
        cellA.set([r[0] / W, 1 - (r[1] + r[3]) / H, r[2] / W, r[3] / H], i * 4);
        strideA[i]=s.d.stride/W;
        meta.set([s.seed, s.gain * s.d.level, s.d.anim, s.d.opaque], i * 4); viewA[i] = s.d.view;
        new T.Color(s.d.colors[0]).convertSRGBToLinear().toArray(colorA, i * 3);
      });
      faceGeometry.setAttribute('aCell', new T.InstancedBufferAttribute(cellA, 4));
      faceGeometry.setAttribute('aMeta', new T.InstancedBufferAttribute(meta, 4));
      faceGeometry.setAttribute('aView', new T.InstancedBufferAttribute(viewA, 1));
      faceGeometry.setAttribute('aStride',new T.InstancedBufferAttribute(strideA,1));
      var uniforms = T.UniformsUtils.merge([T.UniformsLib.fog, { uTime: { value: 0 }, uGain: { value: 1 } }]);
      uniforms.uAtlas = { value: atlas };
      uniforms.uAtlasSize={value:new T.Vector2(options.lite?1024:W,options.lite?1024:H)};
      var faceMaterial = new T.ShaderMaterial({
        uniforms: uniforms, fog: true, transparent: true, depthWrite: true, extensions: { derivatives: true, shaderTextureLOD: true },
        vertexShader: [
          '#include <common>', '#include <fog_pars_vertex>',
          'attribute vec4 aCell,aMeta;attribute float aView,aStride;varying vec2 vLocal;varying vec4 vCell,vMeta;varying float vView,vStride;',
          'void main(){vLocal=uv;vCell=aCell;vMeta=aMeta;vView=aView;vStride=aStride;',
          'vec4 mvPosition=viewMatrix*modelMatrix*instanceMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;',
          '#include <fog_vertex>', '}'
        ].join('\n'),
        fragmentShader: [
          '#include <common>', '#include <fog_pars_fragment>',
          'uniform sampler2D uAtlas;uniform float uTime,uGain;uniform vec2 uAtlasSize;varying vec2 vLocal;varying vec4 vCell,vMeta;varying float vView,vStride;',
          'float h1(float n){return fract(sin(n*91.7)*43758.5453);}',
          'float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
          'void main(){',
          // Quantised so interpolation noise cannot change the aged-tube masks.
          ' float seed=floor(vMeta.x*4096.+.5)/4096.,gain=vMeta.y,anim=floor(vMeta.z+.5),opaque=vMeta.w;',
          ' float frame=0.;vec2 lu=vLocal;',
          ' if(anim==1.){float ph=fract(uTime*(.45+seed*.5)+seed*5.);frame=step(.62+seed*.2,ph);}',
          ' if(anim==5.)lu.x=fract(vLocal.x*vView+uTime*(.03+seed*.03));',
          ' if(anim==7.)lu.y=fract(vLocal.y*vView+uTime*(.12+seed*.06));',
          // Take derivatives before wrapping UVs so ticker/barber seams do not
          // select unrelated mip levels. Bound the footprint to the padded cell.
          ' vec2 uvScale=vCell.zw*vec2(anim==5.?vView:1.,anim==7.?vView:1.);',
          ' vec2 gx=dFdx(vLocal)*uvScale,gy=dFdy(vLocal)*uvScale;',
          ' vec2 extent=max(abs(gx),abs(gy))*uAtlasSize;',
          ' float guard=min(1.,3./max(max(extent.x,extent.y),.001));',
          ' vec2 atlasUV=vCell.xy+lu*vCell.zw+vec2(frame*vStride,0.);',
          ' vec2 inset=.5/uAtlasSize;',
          ' atlasUV=clamp(atlasUV,vCell.xy+vec2(frame*vStride,0.)+inset,vCell.xy+vec2(frame*vStride,0.)+vCell.zw-inset);',
          ' #if __VERSION__ >= 300 || defined(GL_EXT_shader_texture_lod)',
          ' vec4 tex=texture2DGradEXT(uAtlas,atlasUV,gx*guard,gy*guard);',
          ' #else',
          ' vec4 tex=texture2D(uAtlas,atlasUV);',
          ' #endif',
          ' vec3 c=pow(max(tex.rgb,0.),vec3(2.2));',
          ' float lum=max(c.r,max(c.g,c.b));',
          ' float panel=opaque*step(lum,.012)*tex.a;',
          ' float drive=1.;',
          ' if(anim==2.){float head=fract(uTime*(.35+seed*.4)+seed);float d=fract(vLocal.x-head);drive=.25+.75*smoothstep(.0,.08,d)*(1.-smoothstep(.35,.6,d))+.25*step(.85,fract(uTime*.2+seed));}',
          ' else if(anim==3.){float ph=fract(uTime*(.55+seed*.4)+seed*3.);drive=step(ph,.62)+.05;}',
          ' else if(anim==4.){drive=.55+.45*pow(max(.5+.5*sin(uTime*(2.+seed*2.)+seed*20.),0.),2.);}',
          ' else if(anim==6.){float ph=fract(uTime*(.18+seed*.1)+seed);drive=step(vLocal.x,ph*1.6)*step(ph,.85)+.04;}',
          // Ageing: one tube section stutters or has died; mains hum on the rest.
          ' float segment=floor(vLocal.y*5.+seed*3.)+floor(vLocal.x*3.)*7.;',
          ' float failing=step(.64,h1(seed*13.+segment))*(1.-opaque*.6);',
          ' float stutter=step(.35,h1(floor(uTime*(7.+seed*9.))+segment*3.1+seed));',
          ' float dead=step(.94,h1(seed*7.+segment*1.7))*(1.-opaque);',
          ' float hum=.93+.07*sin(uTime*(50.+seed*20.)+seed*40.);',
          ' float flick=mix(1.,stutter,failing*step(.45,seed))*(1.-dead*.9)*hum;',
          ' float grime=.72+.28*h2(floor(vLocal*vec2(18.,36.))+seed);',
          ' vec3 emit=c*flick*drive*grime*gain*uGain*3.;',
          ' float alpha=opaque>.5?tex.a:smoothstep(.015,.22,lum)*tex.a;',
          ' if(alpha<.02)discard;',
          ' gl_FragColor=vec4(emit+panel*vec3(.002,.0022,.0026),alpha);',
          '#include <fog_fragment>', '#include <tonemapping_fragment>', '#include <encodings_fragment>', '}'
        ].join('\n')
      });
      materials.push(faceMaterial);
      var faces = new T.InstancedMesh(faceGeometry, faceMaterial, Math.max(count, 1)); faces.name = 'District tenant banners'; faces.count = count; faces.frustumCulled = false; faces.renderOrder = 3;
      var haloGeometry = plane.clone(); geometries.push(haloGeometry);
      haloGeometry.setAttribute('aColor', new T.InstancedBufferAttribute(colorA, 3));
      haloGeometry.setAttribute('aMeta', new T.InstancedBufferAttribute(meta, 4));
      var haloMaterial = new T.ShaderMaterial({
        uniforms: { uTime: uniforms.uTime, uGain: uniforms.uGain }, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
        vertexShader: 'attribute vec3 aColor;attribute vec4 aMeta;uniform float uTime;varying vec2 vUv;varying vec3 vColor;varying float vFade;void main(){vUv=uv;float a=floor(aMeta.z+.5);float on=a==3.?step(fract(uTime*(.55+aMeta.x*.4)+aMeta.x*3.),.62)+.05:a==4.?.55+.45*pow(max(.5+.5*sin(uTime*(2.+aMeta.x*2.)+aMeta.x*20.),0.),2.):1.;vColor=aColor*aMeta.y*on;vec4 mv=viewMatrix*modelMatrix*instanceMatrix*vec4(position,1.);vFade=exp(-max(0.,-mv.z)*.0011);gl_Position=projectionMatrix*mv;}',
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
        group: group,ready:ready,
        getLayout:function(){return signs.map(function(s){return{id:s.d.id,district:s.district,x:s.x,y:s.y,z:s.z,w:s.w,h:s.h,ry:s.ry};});},
        update: function (t) { uniforms.uTime.value = t; },
        setMood: function (name) { uniforms.uGain.value = name === 'night' ? 1 : .55; },
        getStats: function () { return {signs:count,designs:designs.length,uniqueDesigns:new Set(signs.map(function(s){return s.d.id;})).size,atlas:options.lite?[1024,1024]:[W,H],atlasMiB:options.lite?5.33:21.33,drawCalls:2,loaded:loaded,error:loadError,districts:signs.reduce(function(n,s){n[s.district]=(n[s.district]||0)+1;return n;},{})}; },
        dispose: function () { if(disposed)return;disposed=true;geometries.forEach(function (g) { g.dispose(); }); materials.forEach(function (m) { m.dispose(); }); textures.forEach(function (t) { t.dispose(); }); group.clear(); }
      };
    }
  };
}());
