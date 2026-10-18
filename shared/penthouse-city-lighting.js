/* Mounted TOKYO SIGNALS media and bounded practical-light irradiance.
 * Same metre-space source placements as artwork/city-stages/*.blend.
 * Runtime uses local analytic proxies: no per-emitter shadow maps or dynamic textures. */
(function(){
  'use strict';
  function scalar(n){return Number(n).toFixed(5);}
  function vector(a){return 'vec'+a.length+'('+a.map(scalar).join(',')+')';}
  window.PenthouseCityLighting={
    glsl:function(T,spec){
      var lights=(spec&&spec.lights)||[];
      return `
        vec3 practicalSource(vec3 p,vec3 n,vec3 source,vec2 halfSize,vec3 color,float radius,float power){
          vec3 q=p-source;vec3 delta=vec3(q.x-clamp(q.x,-halfSize.x,halfSize.x),q.y-clamp(q.y,-halfSize.y,halfSize.y),q.z);
          float d2=dot(delta,delta);float attenuation=pow(max(0.,1.-d2/(radius*radius)),2.)/(1.+d2*.16);
          float facing=.12+.88*max(dot(n,-normalize(delta+vec3(0.,0.,.0001))),0.);
          return color*power*attenuation*facing;
        }
        vec3 practicalSpill(vec3 p,vec3 n){vec3 irradiance=vec3(0.);
        ${lights.map(function(l){var c=new T.Color(l.color).convertSRGBToLinear();return 'irradiance+=practicalSource(p,n,'+vector(l.position)+','+vector(l.size.map(x=>x*.5))+','+vector(c.toArray())+','+scalar(l.radius)+','+scalar(l.intensity)+');';}).join('\n')}
        return irradiance;}
      `;
    },
    create:function(T,spec){
      spec=spec||{panels:[],lights:[]};var group=new T.Group();group.name='Mounted Tokyo Signals and maintenance fixtures';
      var geoms=[],mats=[],textures=[],uniforms=[],pending=[],housingMeshes=[],lensMeshes=[],disposed=false;
      function geom(g){geoms.push(g);return g;}function mat(m){mats.push(m);return m;}
      function linear(hex){return new T.Color(hex).convertSRGBToLinear();}
      var box=geom(new T.BoxGeometry(1,1,1)),plane=geom(new T.PlaneGeometry(1,1));
      var housing=mat(new T.MeshStandardMaterial({color:linear('#151a22'),roughness:.48,metalness:.6}));
      var blank=new T.DataTexture(new Uint8Array([0,0,0,255]),1,1,T.RGBAFormat);blank.needsUpdate=true;textures.push(blank);
      function block(parent,name,p,size,m){var mesh=new T.Mesh(box,m||housing);mesh.name=name;mesh.position.fromArray(p);mesh.scale.fromArray(size);parent.add(mesh);if(mesh.material===housing)housingMeshes.push(mesh);else if(mesh.material.isMeshBasicMaterial)lensMeshes.push(mesh);return mesh;}
      function load(path,u,key){pending.push(new Promise(function(resolve,reject){new T.TextureLoader().load(path,function(tex){if(disposed){tex.dispose();resolve();return;}tex.encoding=T.LinearEncoding;tex.minFilter=T.LinearMipmapLinearFilter;tex.magFilter=T.NearestFilter;tex.anisotropy=4;textures.push(tex);u[key].value=tex;resolve();},undefined,reject);}));}
      (spec.panels||[]).forEach(function(p){
        var mount=new T.Group();mount.position.fromArray(p.position);mount.rotation.y=p.rotationY||0;mount.name=p.id;group.add(mount);
        var w=p.size[0],h=p.size[1];
        block(mount,'Ventilated LED cabinet',[0,0,-.20],[w+.32,h+.32,.38]);
        [-1,1].forEach(function(s){block(mount,'Aluminium perimeter rail',[s*(w*.5+.09),0,.045],[.12,h+.30,.14]);block(mount,'Sealed horizontal trim',[0,s*(h*.5+.09),.045],[w+.30,.12,.14]);[-1,1].forEach(function(t){block(mount,'Facade mounting stand-off',[s*w*.41,t*h*.43,-.50],[.18,.18,.64]);});});
        var kinds={portrait:0,diamonds:1,radar:2,advert:3,strips:4};
        var u=T.UniformsUtils.merge([T.UniformsLib.fog,{uTime:{value:0},uKind:{value:kinds[p.type]},uGain:{value:p.brightness},uPixels:{value:new T.Vector2().fromArray(p.pixels)},uArt:{value:blank},uArtB:{value:blank},uArtC:{value:blank}}]);
        // UniformsUtils clones textures; keep one owned fallback for every sampler.
        u.uArt.value=blank;u.uArtB.value=blank;u.uArtC.value=blank;uniforms.push(u);
        var m=mat(new T.ShaderMaterial({uniforms:u,fog:true,extensions:{derivatives:true},vertexShader:`
          #include <common>
          #include <fog_pars_vertex>
          varying vec2 vUv;void main(){vUv=uv;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
          }`,fragmentShader:`
          #include <common>
          #include <fog_pars_fragment>
          varying vec2 vUv;uniform float uTime,uKind,uGain;uniform vec2 uPixels;uniform sampler2D uArt,uArtB,uArtC;
          float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
          float line(float d,float width){return 1.-smoothstep(width,width+.008,d);}
          void main(){
            vec2 cell=floor(vUv*uPixels),q=(cell+.5)/uPixels;float phase=mod(uTime,8.);float quant=floor(uTime*12.);
            float burst=(step(1.79,phase)-step(1.92,phase))+(step(5.,phase)-step(5.13,phase))+(step(7.21,phase)-step(7.34,phase));
            float rows=(step(.41,q.y)-step(.51,q.y))+(step(.75,q.y)-step(.79,q.y));
            vec2 content=q;content.x+=burst*rows*(h(vec2(floor(q.y*28.),quant))-.5)*6./uPixels.x;
            vec3 c=vec3(0.);
            if(uKind<.5){
              c=texture2D(uArt,content).rgb;
              c.r=texture2D(uArt,content+vec2(burst*rows/uPixels.x,0.)).r;
              c.b=texture2D(uArt,content-vec2(burst*rows/uPixels.x,0.)).b;
              c=pow(c,vec3(2.2));
            }else if(uKind<1.5){
              vec2 d=vec2(content.x*2.,content.y*7.);vec2 f=abs(fract(d)-.5);float diamond=line(abs(f.x+f.y-.46),.014);
              float broken=step(.17,fract(d.y*2.7+d.x*.4));float wave=.34+.66*pow(.5+.5*sin(floor(d.y)*.82-uTime*.6),3.);
              c=mix(vec3(.22,.01,.56),vec3(.75,.018,.35),step(.5,fract(d.y*.5)))*diamond*broken*wave;
            }else if(uKind<2.5){
              vec2 p=(content-.5)*2.;float r=length(p),a=atan(p.y,p.x);float rings=0.;vec3 col=vec3(0.);
              for(int i=0;i<6;i++){float k=float(i),radius=.18+k*.135;float arc=step(.15,fract(a/6.2831853*(4.+k)+uTime*(mod(k,2.)<.5?.026:-.019)));float on=line(abs(r-radius),.011)*arc;vec3 hue=mod(k,3.)<.5?vec3(.09,.7,.84):mod(k,3.)<1.5?vec3(.31,.07,.63):vec3(.67,.08,.32);col+=on*hue;rings=max(rings,on);}
              float inversion=step(6.87,phase)-step(7.,phase);c=mix(col,col.bgr,inversion);c*=.84+.16*sin(uTime*.8);
            }else if(uKind<3.5){
              float hold=mod(floor(uTime/2.666+floor(q.y*8.)*.015),3.);c=hold<.5?texture2D(uArt,content).rgb:hold<1.5?texture2D(uArtB,content).rgb:texture2D(uArtC,content).rgb;c=pow(c,vec3(2.2));
            }else{
              float column=step(.83,fract(cell.x/12.));float dotted=step(.50,fract(cell.y/6.))*step(.86,h(vec2(floor(cell.x/4.),3.)));float blink=1.-.48*step(.985,h(vec2(floor(cell.y/12.)+cell.x, floor(uTime*.5))));c=vec3(.12,.52,.66)*max(column,dotted)*blink;
            }
            vec2 aa=max(fwidth(vUv*uPixels),vec2(.001));vec2 led=abs(fract(vUv*uPixels)-.5);
            vec2 mask=1.-smoothstep(vec2(.32)-aa*.5,vec2(.43)+aa*.5,led);float resolved=1.-smoothstep(.45,1.1,max(aa.x,aa.y));
            float emitter=mix(.62,mask.x*mask.y,resolved);float uneven=mix(.76+ .24*h(cell),.89,1.-resolved);
            float scan=1.-.06*step(.92,fract(q.y*54.-uTime*.18));
            c*=emitter*uneven*scan*(.97+.025*sin(uTime*.75))*uGain;
            gl_FragColor=vec4(c+vec3(.001,.0015,.002),1.);
            #include <fog_fragment>
            #include <tonemapping_fragment>
            #include <encodings_fragment>
          }`}));
        var screen=new T.Mesh(plane,m);screen.name='Fixed LED matrix | '+p.type;screen.scale.set(w,h,1);screen.position.z=.015;mount.add(screen);
        if(p.asset)load(p.asset,u,'uArt');
        if(p.assets){load(p.assets[1],u,'uArtB');load(p.assets[2],u,'uArtC');}
      });
      (spec.lights||[]).filter(l=>l.fixture).forEach(function(l){
        var g=new T.Group();g.name=l.id;g.position.fromArray(l.position);group.add(g);
        block(g,'Shielded maintenance sconce',[0,0,-.08],[.66,.28,.24]);
        var lens=mat(new T.MeshBasicMaterial({color:linear(l.color).multiplyScalar(3),fog:true}));block(g,'Warm diffuser',[0,-.04,.06],[.45,.10,.035],lens);
      });
      // Repeated cabinet parts share one draw; panel artwork keeps its own material.
      group.updateMatrixWorld(true);
      function consolidate(items,m,name,colored){
        if(!items.length)return;
        var batch=new T.InstancedMesh(box,m,items.length);batch.name=name;
        items.forEach(function(mesh,i){batch.setMatrixAt(i,mesh.matrixWorld);if(colored)batch.setColorAt(i,mesh.material.color);mesh.parent.remove(mesh);});
        batch.instanceMatrix.needsUpdate=true;if(colored)batch.instanceColor.needsUpdate=true;group.add(batch);
      }
      consolidate(housingMeshes,housing,'Instanced weatherproof cabinets, mounts and sconces',false);
      consolidate(lensMeshes,mat(new T.MeshBasicMaterial({color:0xffffff,fog:true})),'Instanced practical light diffusers',true);
      return {group:group,ready:Promise.all(pending),update:function(t){uniforms.forEach(u=>u.uTime.value=t);},getStats:function(){return{mediaPanels:(spec.panels||[]).length,localLightProxies:(spec.lights||[]).length};},dispose:function(){if(disposed)return;disposed=true;geoms.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());group.clear();}};
    }
  };
}());
