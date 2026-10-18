/* Reference-sculpted Blender humpback: body-space projection, vertical tail stroke.
 * Coordinates are city metres; parent this group under the existing city transform.
 * Native glTF contains real anatomy. No billboard, opaque mesh, or screen overlay. */
(function () {
  'use strict';
  window.PenthouseWhale = {
    create: function (T, options) {
      options = options || {};
      var group = new T.Group(); group.name = 'KUJIRA | Projected humpback';
      var animal = new T.Group(); group.add(animal);
      var geometries = [], materials = [], loaded = false, disposed = false, time = 0;
      var axisVector = new T.Vector3();
      var uniforms = { uTime:{value:0}, uGain:{value:1}, uLayer:{value:0} };
      var state = {position:[-3,9,-108],axis:[1,0,0],color:[.035,.43,.72],radius:32,halfLength:12,intensity:.6};
      var vertex = [
        'uniform float uTime; varying vec3 vBody; varying vec3 vNormal; varying vec3 vView;',
        'vec3 swim(vec3 p){',
        ' float tail=pow(clamp((-p.x+1.)/13.,0.,1.),1.8);',
        ' p.y+=sin(uTime*.57+p.x*.20)*tail*1.2;',
        ' float fin=pow(clamp((abs(p.z)-1.65)/6.,0.,1.),1.2);',
        ' p.y+=sin(uTime*.37+sign(p.z)*.45)*fin*.58;',
        ' p.z+=sin(uTime*.28+p.x*.16)*tail*.12; return p;',
        '}',
        'void main(){vBody=position; vec3 p=swim(position); vec4 mv=modelViewMatrix*vec4(p,1.);',
        ' vView=-mv.xyz;vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*mv;}'
      ].join('\n');
      var fragment = [
        'uniform float uTime,uGain,uLayer;varying vec3 vBody,vNormal,vView;',
        'float hash(vec3 p){return fract(sin(dot(p,vec3(27.17,91.73,43.57)))*43758.5453);}',
        'void main(){',
        ' vec3 n=normalize(vNormal); float rim=pow(1.-abs(dot(n,normalize(vView))),2.1);',
        ' float volume=.38+.62*pow(clamp(dot(n,normalize(vec3(-.25,.78,.58)))*.5+.5,0.,1.),1.6);',
        ' float side=gl_FrontFacing?1.:.26;',
        // Emitters remain in body space; only their content modulates. Derivative
        // antialiasing prevents scan lines from becoming a cheap distant moire.
        ' float pitch=vBody.y*9.; float aa=max(fwidth(pitch),.025);',
        ' float stripe=1.-smoothstep(.24-aa,.24+aa,abs(fract(pitch)-.5));',
        ' float detailFade=1.-smoothstep(.42,1.25,aa);stripe=mix(.48,stripe,detailFade);',
        ' float broad=.5+.5*sin(vBody.y*3.8+vBody.x*.12-uTime*.19);',
        ' float grain=hash(floor(vBody*vec3(9.,18.,9.)));',
        ' float row=floor(vBody.y*16.);float burst=step(.983,sin(uTime*.43+row*.87)*.5+.5);',
        ' float dropout=1.-burst*step(.64,hash(floor(vBody*vec3(2.,16.,2.))))*.50;',
        ' float ripple=.96+.04*sin(uTime*.61+vBody.x*.29);',
        ' float tone=.5+.5*sin(vBody.x*.14+vBody.y*.36+uTime*.045);',
        ' vec3 cyan=vec3(.025,.67,1.);vec3 violet=vec3(.23,.16,.78);',
        ' vec3 tint=mix(cyan,violet,clamp(tone*.36+(1.-volume)*.57,0.,.85));tint+=vec3(.42,.02,.30)*rim*rim*.45;',
        // A slow refresh band travels nose-to-tail, as a projector re-scans the volume.
        ' float sweep=exp(-pow(fract(vBody.x*.03-uTime*.055)-.5,2.)*240.);',
        ' float signal=(.038+stripe*.115+rim*.23+sweep*.16)*(0.78+grain*.22)*dropout*ripple*side;',
        ' float optical=exp(-length(vView)*.00060);',
        ' float thin=1.-.24*clamp((abs(vBody.z)-2.)/5.,0.,1.)-.18*clamp((-vBody.x-7.)/7.,0.,1.);',
        ' float opacity=signal*thin*(uLayer>.5?.10:1.);',
        ' vec3 energy=tint*(.63+volume*.85+rim*.95+stripe*.25+broad*.10)*uGain;',
        ' gl_FragColor=vec4(energy,opacity*optical);',
        '}'
      ].join('\n');
      function shader(layer,gain){
        var m = new T.ShaderMaterial({uniforms:{uTime:uniforms.uTime,uGain:{value:gain},uLayer:{value:layer}},vertexShader:vertex,fragmentShader:fragment,
          transparent:true,depthWrite:false,depthTest:true,side:T.DoubleSide,blending:T.AdditiveBlending,extensions:{derivatives:true}});
        m.name=layer?'Projection | Inner depth layer':'Projection | Fixed scan strata';materials.push(m);return m;
      }
      var shellMaterial=shader(0,1), detailMaterial=shader(0,.63), innerMaterial=shader(1,.8);
      var haloMaterial=new T.ShaderMaterial({uniforms:{uTime:uniforms.uTime},vertexShader:vertex,transparent:true,depthWrite:false,depthTest:true,side:T.FrontSide,blending:T.AdditiveBlending,
        fragmentShader:'uniform float uTime;varying vec3 vBody,vNormal,vView;void main(){float f=abs(dot(normalize(vNormal),normalize(vView)));float a=pow(f,3.)*.032*(.85+.15*sin(uTime*.3+vBody.x*.2));gl_FragColor=vec4(vec3(.05,.42,.95)*a,1.);}'});
      haloMaterial.name='Projection | Scatter envelope';materials.push(haloMaterial);
      // load() takes ownership of the incoming glTF asset. Only the baked clones
      // survive, so fallback materials and original geometries never accumulate.
      function releaseSource(root){
        var gs=new Set(),ms=new Set(),ts=new Set();
        if(!root || !root.traverse)return;
        root.traverse(function(o){
          if(o.geometry)gs.add(o.geometry);
          var list=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];
          list.forEach(function(m){ms.add(m);Object.keys(m).forEach(function(k){if(m[k]&&m[k].isTexture)ts.add(m[k]);});});
        });
        ts.forEach(function(t){t.dispose();});ms.forEach(function(m){m.dispose();});gs.forEach(function(g){g.dispose();});
        root.clear();
      }
      function load(model){
        if (!model) return;
        var root=model.scene||model;
        if(disposed || loaded){releaseSource(root);return;}
        root.updateMatrixWorld(true);var sources=[];
        root.traverse(function(o){if(o.isMesh)sources.push(o);});
        sources.forEach(function(o){
          var g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);g.computeBoundingSphere();geometries.push(g);
          var detail=/pleat|detail|eyes/i.test(o.name),mesh=new T.Mesh(g,detail?detailMaterial:shellMaterial);
          mesh.name=o.name;mesh.frustumCulled=false;mesh.renderOrder=4;animal.add(mesh);
          if(/Continuous.body/i.test(o.name)){
            var inner=new T.Mesh(g,innerMaterial);inner.name='Projection | Recessed body light';inner.scale.set(1,.87,.87);inner.renderOrder=3;inner.frustumCulled=false;animal.add(inner);
            // Volumetric scatter shell: light from the projection lighting the rain
            // around the body. Bright through the core, gone at the silhouette.
            var halo=new T.Mesh(g,haloMaterial);halo.name='Projection | Rain scatter envelope';halo.scale.set(1.08,1.45,1.45);halo.renderOrder=2;halo.frustumCulled=false;animal.add(halo);
          }
        });
        releaseSource(root);loaded=true;update(time);return group;
      }
      // Low-density points are constrained inside the body volume. Perspective
      // attenuation and a soft point kernel avoid a solid wireframe appearance.
      var count=options.lite?144:320,position=new Float32Array(count*3),seeds=new Float32Array(count);
      var seed=4139;function rnd(){seed=(seed*16807)%2147483647;return (seed-1)/2147483646;}
      for(var i=0;i<count;i++){
        var x=-10.8+rnd()*23.4,r=Math.sqrt(rnd())*.72,a=rnd()*Math.PI*2;
        var width=2.0*Math.pow(Math.max(.025,1-Math.pow((x-2)/14.5,2)),1.25);
        position[i*3]=x;position[i*3+1]=Math.sin(a)*width*r;position[i*3+2]=Math.cos(a)*width*r;seeds[i]=rnd();
      }
      var pg=new T.BufferGeometry();pg.setAttribute('position',new T.BufferAttribute(position,3));pg.setAttribute('aSeed',new T.BufferAttribute(seeds,1));geometries.push(pg);
      var pm=new T.ShaderMaterial({uniforms:{uTime:uniforms.uTime},transparent:true,depthWrite:false,depthTest:true,blending:T.AdditiveBlending,
        vertexShader:vertex.replace('uniform float uTime;','attribute float aSeed; varying float vSeed; uniform float uTime;').replace('vBody=position;','vSeed=aSeed;vBody=position;').replace('vec3 p=swim(position);','vec3 p=swim(position+vec3(sin(uTime*.17+aSeed*14.)*.055,cos(uTime*.20+aSeed*9.)*.07,sin(uTime*.11+aSeed*23.)*.045));').replace('gl_Position=projectionMatrix*mv;','gl_Position=projectionMatrix*mv;gl_PointSize=clamp(140./max(20.,-mv.z)*(1.+aSeed),.65,2.2);'),
        fragmentShader:'varying float vSeed;uniform float uTime;void main(){float r=length(gl_PointCoord-.5);float a=(1.-smoothstep(.10,.5,r))*(.12+.16*sin(uTime*.35+vSeed*31.));gl_FragColor=vec4(.10,.61,1.,a);}'
      });materials.push(pm);var points=new T.Points(pg,pm);points.name='Projection | Suspended internal interference';points.frustumCulled=false;points.renderOrder=3;animal.add(points);
      function update(t){
        time=Number.isFinite(t)?t:0;uniforms.uTime.value=time;
        var a=time*.022,px=-3+43*Math.sin(a),pz=-84-24*Math.cos(a),py=9+2.1*Math.sin(a+.2)-2.1*Math.sin(.2);
        var dx=43*Math.cos(a),dz=24*Math.sin(a),yaw=Math.atan2(-dz,dx);
        animal.position.set(px,py,pz);animal.rotation.set(.40+.06*Math.sin(a),yaw-.28,.04+.035*Math.sin(a*2));
        state.position[0]=px;state.position[1]=py;state.position[2]=pz;
        axisVector.set(1,0,0).applyQuaternion(animal.quaternion);
        state.axis[0]=axisVector.x;state.axis[1]=axisVector.y;state.axis[2]=axisVector.z;
        state.intensity=loaded?1.0+Math.sin(time*.13)*.06:0;
      }
      update(0);
      return {group:group,load:load,update:update,getLightState:function(){return state;},getStats:function(){return {loaded:loaded,meshes:animal.children.filter(function(o){return o.isMesh;}).length,internalParticles:count,lengthMetres:29.2,periodSeconds:Math.PI*2/.022};},dispose:function(){if(disposed)return;disposed=true;geometries.forEach(function(g){g.dispose();});materials.forEach(function(m){m.dispose();});group.clear();}};
    }
  };
}());
