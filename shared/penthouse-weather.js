/* Original rain for Leon's penthouse. Four world units represent one metre.
 * API: create(THREE,{lite,quality?}) -> {group,update,resize,setMood,setHologramLight,capture,dispose}.
 * quality accepts captureScale, captureMaxWidth, beadFadeStart and beadFadeEnd (metres), runRate (runner speed multiplier).
 * Add group, then capture(renderer,scene,camera,[floorReflection]) before the main render.
 * Wet-glass lenses use only the matching camera capture; mirror/cube views omit them.
 */
(function () {
  'use strict';
  window.PenthouseWeather={create:function(T,options={}) {
    const lite=!!options.lite,quality=options.quality||{},group=new T.Group();group.name='Exterior rain and wet glazing';
    const panes=[],paneCorners=[],geometries=[],materials=[];
    let disposed=false,seed=918263,capturedCamera=null,captureConfigured=false;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const linear=color=>new T.Color(color).convertSRGBToLinear();
    const viewport=new T.Vector2(1,1),captureSize=new T.Vector2(1,1);
    const target=new T.WebGLRenderTarget(1,1,{minFilter:T.LinearFilter,magFilter:T.LinearFilter,format:T.RGBAFormat,type:T.UnsignedByteType,depthBuffer:true,stencilBuffer:false});
    target.texture.encoding=T.LinearEncoding;target.texture.generateMipmaps=false;
    const shared={uLightning:{value:0},uTime:{value:0},uScene:{value:target.texture},uViewport:{value:viewport},uCaptureSize:{value:captureSize},uCaptured:{value:0},uNight:{value:0},uViewValid:{value:1},uImpactRate:{value:1},uRunRate:{value:quality.runRate??1},uBeadDistance:{value:new T.Vector2(quality.beadFadeStart??2,quality.beadFadeEnd??4.1)}};
    function renderSize(renderer){const current=renderer.getRenderTarget();if(current)viewport.set(current.width,current.height);else renderer.getDrawingBufferSize(viewport);}

    // Rain occupies three exterior volumes, in world units (four units/metre).
    // The optical width and shutter exposure are projected with the camera;
    // the carrier quad only supplies enough raster coverage for subpixel drops.
    const layerCounts=lite?[440,420,430]:[1300,1200,1200];
    const count=layerCounts.reduce((a,b)=>a+b,0),positions=new Float32Array(count*18),ends=new Float32Array(count*6),sides=new Float32Array(count*6),speeds=new Float32Array(count*6),variations=new Float32Array(count*6),layers=new Float32Array(count*6);
    const corners=[[0,-1],[1,-1],[1,1],[0,-1],[1,1],[0,1]];
    let particle=0;
    for(let layer=0;layer<3;layer++)for(let i=0;i<layerCounts[layer];i++,particle++) {
      let x,z;
      if(layer===0&&random()>.76){x=(random()<.5?-1:1)*(16.2+random()*48);z=-6+random()*42;}
      else {z=layer===0?-10-random()*155:layer===1?-130-random()*520:-570-random()*850;x=(random()-.5)*(Math.abs(z)*1.9+70);}
      const top=layer===0?140:layer===1?420:900,span=layer===0?230:layer===1?760:1500;
      const y=top-random()*span,speed=23+random()*18,variation=random();
      for(let vertex=0;vertex<6;vertex++){
        const index=particle*6+vertex;positions.set([x,y,z],index*3);ends[index]=corners[vertex][0];sides[index]=corners[vertex][1];speeds[index]=speed;variations[index]=variation;layers[index]=layer;
      }
    }
    const rainGeometry=new T.BufferGeometry();geometries.push(rainGeometry);
    for(const [name,array,size] of [['position',positions,3],['aEnd',ends,1],['aSide',sides,1],['aSpeed',speeds,1],['aVariation',variations,1],['aLayer',layers,1]])rainGeometry.setAttribute(name,new T.BufferAttribute(array,size));
    const hologram={uHoloPosition:{value:new T.Vector3()},uHoloColor:{value:new T.Color(.12,.48,.85)},uHoloRadius:{value:1},uHoloStrength:{value:0}};
    const rainMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:true,extensions:{derivatives:true},
      uniforms:{uLightning:shared.uLightning,uTime:shared.uTime,uViewport:shared.uViewport,...hologram,uNight:shared.uNight,uColor:{value:linear(0xa8bdc8)},uOpacity:{value:.42}},
      vertexShader:`attribute float aEnd,aSide,aSpeed,aVariation,aLayer;uniform float uTime,uNight,uHoloRadius,uHoloStrength,uLightning;uniform vec2 uViewport;uniform vec3 uHoloPosition,uHoloColor;
        varying float vAcross,vEnd,vAlpha,vWidth,vSoftness;varying vec3 vLight;
        void main(){
          float top=aLayer<.5?140.:aLayer<1.5?420.:900.;float span=aLayer<.5?230.:aLayer<1.5?760.:1500.;
          vec3 p=position;p.y=top-mod(top-position.y+uTime*aSpeed,span);
          // Broad gusts change over space and time. Rain remains world-anchored
          // during camera movement, rather than tracking the screen or eye.
          float gust=sin(uTime*.22+position.z*.003)+.35*sin(uTime*.57+position.x*.011);
          p.x+=sin(uTime*.25+aVariation*17.+position.y*.009)*.58;
          p.z+=sin(uTime*.18+aVariation*9.)*.22;
          float exposure=mix(.010,.025,aVariation);vec3 velocity=vec3(-1.2-gust*.8,-aSpeed,.28+gust*.16);
          vec3 streak=velocity*exposure;
          vec4 head=projectionMatrix*modelViewMatrix*vec4(p,1.);
          vec4 tail=projectionMatrix*modelViewMatrix*vec4(p+streak,1.);
          vec2 direction=(tail.xy/max(tail.w,.1)-head.xy/max(head.w,.1))*uViewport;
          float lengthSquared=max(dot(direction,direction),.0001);vec2 across=vec2(-direction.y,direction.x)*inversesqrt(lengthSquared);
          vec4 clip=mix(head,tail,aEnd);float distanceToEye=length((modelViewMatrix*vec4(p,1.)).xyz);
          float physicalWidth=mix(.012,.029,aVariation*aVariation);
          float projectedRadius=physicalWidth*projectionMatrix[1][1]*uViewport.y/max(head.w,.1)*.5;
          // Mid/far layers lose contrast and develop a broad optical response.
          vSoftness=mix(.15,.70,smoothstep(120.,900.,distanceToEye));
          float carrier=max(1.45,projectedRadius+vSoftness+1.);
          vWidth=clamp(projectedRadius/carrier,.004,.85);
          clip.xy+=across*aSide*carrier/uViewport*clip.w*2.;gl_Position=clip;vAcross=aSide;vEnd=aEnd;
          float rainPatch=.62+.38*sin(position.x*.017+position.z*.008+uTime*.07);
          float distanceFade=(1.-smoothstep(450.,1550.,distanceToEye))*smoothstep(2.,9.,distanceToEye);
          float depthSoftening=exp(-distanceToEye*.00115);
          float roomDistance=length((p-vec3(0.,6.,-7.9))*vec3(.5,.7,1.));
          float windowLight=exp(-roomDistance*.055)*.58;
          float hologramDistance=length(p-uHoloPosition)/max(uHoloRadius,1.);
          float holo=exp(-hologramDistance*hologramDistance*2.2)*uHoloStrength;
          // Rain is mostly invisible until a motivated local source catches it.
          // A dark ambient floor is deliberately much weaker than lit droplets.
          vLight=vec3(.72,.80,.94)*uLightning+vec3(mix(.16,.075,uNight))+vec3(.64,.73,.80)*windowLight+uHoloColor*holo*.85;
          // Low drops catch the street's light pollution from beneath.
          float streetGlow=clamp(exp(-(p.y*.25+92.)/34.),0.,1.6);
          vLight+=vec3(.95,.48,.30)*streetGlow*mix(.18,.42,uNight);
          float backlight=.48+.52*pow(max(0.,dot(normalize(cameraPosition-p),normalize(uHoloPosition-p))),2.);
          vLight+=uHoloColor*holo*backlight*.4;
          vAlpha=rainPatch*distanceFade*depthSoftening*(.30+.70*aVariation*aVariation);
        }`,
      fragmentShader:`uniform vec3 uColor;uniform float uOpacity;varying float vAcross,vEnd,vAlpha,vWidth,vSoftness;varying vec3 vLight;
        void main(){
          float footprint=max(length(vec2(dFdx(vAcross),dFdy(vAcross))),.001);
          float lo=vAcross-footprint*.5,hi=vAcross+footprint*.5;
          float core=max(0.,min(hi,vWidth)-max(lo,-vWidth))/footprint;
          // Preserve integrated brightness as a drop becomes subpixel; soft
          // scattering never turns the distant layer into a bright line veil.
          float halo=exp(-vAcross*vAcross/max(.02,vSoftness*vSoftness))*vWidth*.60;
          float edge=mix(core,halo,clamp(vSoftness*.85,0.,.7));
          float taper=smoothstep(0.,.16,vEnd)*(1.-smoothstep(.76,1.,vEnd));
          float illumination=max(vLight.r,max(vLight.g,vLight.b));
          float alpha=uOpacity*vAlpha*edge*taper*min(illumination,1.8);
          if(alpha<.0003)discard;
          gl_FragColor=vec4(uColor*vLight/max(illumination,.001),alpha);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`});materials.push(rainMaterial);
    const streaks=new T.Mesh(rainGeometry,rainMaterial);streaks.name='World-space foreground, midground and distant rain';streaks.frustumCulled=false;streaks.raycast=()=>{};streaks.onBeforeRender=renderSize;group.add(streaks);

    // Rain curtains: gust-driven sheets of heavier rain drifting between the
    // towers. They carry the haze colour and street glow, so distant rain reads
    // as moving density rather than as individual lines. World units.
    const curtainMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:true,
      uniforms:{uLightning:shared.uLightning,uTime:shared.uTime,uNight:shared.uNight,uHoloPosition:hologram.uHoloPosition,uHoloColor:hologram.uHoloColor,uHoloRadius:hologram.uHoloRadius,uHoloStrength:hologram.uHoloStrength},
      vertexShader:'varying vec3 vWorld;varying vec2 vUv;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
      fragmentShader:`uniform float uTime,uNight,uHoloRadius,uHoloStrength,uLightning;uniform vec3 uHoloPosition,uHoloColor;varying vec3 vWorld;varying vec2 vUv;
        float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
        void main(){
          float x=vWorld.x+vWorld.y*.06;
          float gust=n2(vec2(x*.0035+uTime*.045,vWorld.y*.0016+uTime*.11))*.65+n2(vec2(x*.011-uTime*.03,vWorld.y*.004+uTime*.2))*.35;
          float sheet=smoothstep(.42,.86,gust);
          float fine=n2(vec2(x*.32,vWorld.y*.006+uTime*5.5))*.6+n2(vec2(x*.9,vWorld.y*.014+uTime*9.))*.4;
          float texture=mix(.55,1.,smoothstep(.35,.8,fine));
          float edge=smoothstep(0.,.12,vUv.x)*(1.-smoothstep(.88,1.,vUv.x))*smoothstep(0.,.18,vUv.y)*(1.-smoothstep(.75,1.,vUv.y));
          float ym=vWorld.y*.25;float glow=clamp(exp(-(ym+92.)/34.),0.,1.6);
          vec3 c=mix(vec3(.10,.12,.13),vec3(.030,.052,.070),uNight)+vec3(.30,.13,.07)*glow*uNight;
          float holo=exp(-pow(length(vWorld-uHoloPosition)/max(uHoloRadius*1.6,1.),2.))*uHoloStrength;
          c+=uHoloColor*holo*.35+vec3(.6,.7,.85)*uLightning;
          float alpha=sheet*texture*edge*(.05+.06*glow);
          gl_FragColor=vec4(c,alpha);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`});materials.push(curtainMaterial);
    const curtainGeometry=new T.PlaneGeometry(1,1);geometries.push(curtainGeometry);
    for(const [z,w,x] of (lite?[[-220,900,-40],[-560,2000,60]]:[[-150,640,-30],[-290,1100,50],[-470,1600,-70],[-720,2400,40],[-1050,3400,-20]])){
      const sheet=new T.Mesh(curtainGeometry,curtainMaterial);sheet.name='Drifting rain curtain';sheet.position.set(x,-60,z);sheet.scale.set(w,820,1);sheet.renderOrder=1;sheet.raycast=()=>{};group.add(sheet);
    }

    const vertexShader=`uniform vec3 uTangent;varying vec3 vWorld;varying vec2 vAlong,vUp;
      void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;vAlong=(viewMatrix*vec4(uTangent,0.)).xy;vUp=(viewMatrix*vec4(0.,1.,0.,0.)).xy;gl_Position=projectionMatrix*viewMatrix*w;}`;
    // Wet glass, pane metres (x along the pane, y up; panes span y 0..3.18).
    // Rain falls from above, so water lands with a short downward smear,
    // beads sag under gravity, grow by merging, and finally slide down
    // leaving a long, tapering wet trail that breaks into residual beads and
    // dries over ~15 s. Runners clear the beads in their path. Every feature
    // fades out once narrower than a rendered pixel, so distant glass stays clean.
    const fragmentShader=`precision highp float;
      uniform sampler2D uScene;uniform vec2 uViewport,uCaptureSize,uBeadDistance;uniform vec3 uTangent,uPaneNormal;uniform float uTime,uCaptured,uNight,uSeed,uViewValid,uImpactRate,uRunRate;
      varying vec3 vWorld;varying vec2 vAlong,vUp;
      float hash(vec2 q){q=fract(q*vec2(123.34,456.21));q+=dot(q,q+45.32);return fract(q.x*q.y);}
      vec3 behind(vec2 uv){return mix(mix(vec3(.05,.07,.08),vec3(.035,.06,.09),uNight),texture2D(uScene,clamp(uv,vec2(.001),vec2(.999))).rgb,uCaptured);}
      // Meandering path a runner follows down the glass (metres). Same function
      // drives head and trail, so they always line up.
      float wob(float y,float id){return .0055*sin(y*6.1+id*17.)+.0028*sin(y*19.+id*5.3)+.0012*sin(y*53.+id*11.);}
      void over(vec3 color,float alpha,inout vec4 acc){float c=alpha+acc.a*(1.-alpha);acc.rgb=(color*alpha+acc.rgb*acc.a*(1.-alpha))/max(c,.0001);acc.a=c;}
      // A sessile drop on vertical glass. Large drops are pendant-shaped (flat
      // crown, heavy rounded belly), with an irregular pinned contact line. The
      // optics follow a plano-convex lens: the centre shows a small inverted,
      // wide-angle image of the city; the steep margin is dark from total
      // internal reflection; light focuses into a bright caustic crescent in
      // the belly; a sharp specular point sits high on the dome. Small drops
      // fall back to a simple refracting dot, and sub-pixel ones vanish.
      // Keep GLSL operations defined on every GPU: ordered smoothstep edges,
      // explicit squared distances, and a finite angle at the exact drop centre.
      void lens(vec2 p,vec2 center,float radius,float stretch,float pixel,float visibility,vec2 screenUV,inout vec4 acc){
        float radiusPixels=radius*max(1.,stretch*.85)/max(pixel,.00001);
        float resolved=smoothstep(.95,2.5,radiusPixels)*visibility;
        if(resolved<.003)return;
        float big=smoothstep(4.,14.,radiusPixels);
        vec2 q=vec2(p.x-center.x,(p.y-center.y)/stretch)/radius;
        if(q.y>0.)q.y*=1.+.32*big;
        q.x*=1.+.26*clamp(-q.y,0.,1.)*(.6+.4*big);
        float sd=hash(center*917.+3.1);
        float ang=dot(q,q)>.00000001?atan(q.y,q.x):0.;
        float contour=1.+big*(.055*sin(ang*3.+sd*19.)+.035*sin(ang*5.+sd*41.)+.02*sin(ang*9.+sd*7.));
        float d=length(q)/contour;
        float edge=clamp(.7/radiusPixels,.012,.5);
        float alpha=(1.-smoothstep(1.-edge,1.+edge,d))*mix(.7,.94,big)*resolved;
        if(alpha<.002)return;
        float detail=smoothstep(2.4,6.,radiusPixels);
        float dd=min(d,1.);float h=sqrt(max(0.,1.-dd*dd));
        vec2 slope=q/max(h,.22);
        vec2 dirScreen=vAlong*slope.x+vUp*slope.y;
        vec2 rScreen=vec2(radiusPixels)/uViewport*2.;
        vec3 small=behind(screenUV-dirScreen*rScreen*.6);
        // All large-drop optical terms vanish below this resolved size.
        if(detail==0.){over(small,alpha,acc);return;}
        vec2 inv=-(vAlong*q.x+vUp*q.y)*rScreen*mix(3.,7.,big);
        vec2 fringe=dirScreen*rScreen*.05*big;
        vec3 lensImg=vec3(behind(screenUV+inv+fringe).r,behind(screenUV+inv).g,behind(screenUV+inv-fringe).b);
        lensImg=mix(lensImg,behind(screenUV+inv*.5)*.9+behind(screenUV+inv*1.5)*.1,.35);
        vec3 color=mix(small,lensImg*1.12,detail*(1.-smoothstep(.45,1.,dd)));
        float tir=smoothstep(mix(.7,.6,big),.97,d);
        float belly=clamp(-q.y*1.2+.15,0.,1.);
        color*=1.-tir*mix(.45,.86,big)*(.7+.3*belly)*detail;
        float causticDistance=(d-.74)/.1;float caustic=exp(-causticDistance*causticDistance)*(1.-smoothstep(-.55,0.,q.y))*detail;
        color+=(behind(screenUV-inv*.3)*1.4+mix(vec3(.06,.05,.04),vec3(.035,.05,.07),uNight))*caustic*.85;
        float contactDistance=(d-.99)/.03;
        color+=mix(vec3(.05,.045,.04),vec3(.03,.04,.055),uNight)*exp(-contactDistance*contactDistance)*big;
        vec2 hl=q-vec2(-.3,.5);float glint=exp(-dot(hl,hl)*mix(30.,110.,big));
        vec2 hl2=q-vec2(.34,-.52);float glint2=exp(-dot(hl2,hl2)*70.)*.35;
        color+=mix(vec3(.16,.15,.13),vec3(.11,.14,.19),uNight)*(glint*mix(1.6,3.2,big)+glint2*big)*detail;
        over(color,alpha,acc);
      }
      // A water film strip: a thin cylindrical lens across its width.
      void film(float across,float width,float strength,float pixel,vec2 screenUV,inout vec4 acc){
        float wp=width/max(pixel,.00001);float resolved=smoothstep(.45,1.5,wp);
        float n=across/max(width,.00001);float alpha=(1.-smoothstep(.7,1.,abs(n)))*strength*resolved;
        if(alpha<.002)return;
        vec2 offset=vAlong*n*min(7.,wp*.9)/uViewport*2.;
        // Inverted, compressed image across the strip (cylindrical lens), dark
        // meniscus edges and a specular line: what makes a wet track readable.
        float detail=smoothstep(1.5,4.,wp);
        vec3 color=mix(behind(screenUV-offset),behind(screenUV+vAlong*n*min(18.,wp*2.2)/uViewport*2.),.45*detail)*1.08;
        float edge=smoothstep(.45,.95,abs(n));color*=1.-edge*.62*detail;
        float highlightDistance=(n+.42)/.16;
        color+=mix(vec3(.10,.09,.08),vec3(.06,.085,.11),uNight)*exp(-highlightDistance*highlightDistance)*detail*1.4;
        over(color,alpha,acc);
      }
      void main(){
        vec2 p=vec2(dot(vWorld,uTangent),vWorld.y)*.25;vec2 uv=gl_FragCoord.xy/uViewport;
        float pixel=max(max(length(dFdx(p)),length(dFdy(p))),.00001);
        vec3 viewDelta=cameraPosition-vWorld;float metres=length(viewDelta)*.25;
        float incidence=abs(dot(normalize(viewDelta),uPaneNormal));
        float visibility=(1.-smoothstep(uBeadDistance.x,uBeadDistance.y,metres))*smoothstep(.15,.52,incidence);
        if(uViewValid<.5||visibility<.003)discard;
        vec4 beads=vec4(0.),water=vec4(0.);float wipe=0.;

        // ---- Runners: two column scales, two slots per column. A runner starts
        // where a bead got heavy enough, moves with stick-slip motion, and
        // leaves a long trail that thins, breaks into beads and dries.
        for(int L=0;L<2;L++){
          float W=L==0?.045:.1;float col=floor(p.x/W);
          for(int k=0;k<2;k++){
            float id=hash(vec2(col,uSeed+float(k)*7.3+float(L)*31.));
            if(id<(L==0?.34:.48))continue;
            float v=mix(.045,.14,hash(vec2(id,uSeed+3.)))*(L==0?1.:1.35)*uRunRate;
            float f=1.1+id*1.7;float tt=uTime+.62*sin(uTime*f+id*9.)/f;
            float S=tt*v+id*41.;float epoch=floor(S/3.8);float trav=fract(S/3.8)*3.8;
            float eh=hash(vec2(col+float(k)*3.,epoch+id*13.));
            float startY=3.25-eh*eh*1.9;float headY=startY-trav;
            if(headY<-.3)continue;
            float pid=id*7.+epoch*1.37;
            float xb=(col+.3+.4*hash(vec2(epoch,col+id)))*W;
            float r=mix(.003,.006,hash(vec2(epoch,id)))*(L==0?1.:1.3);
            // wob is bounded by .0095m; the widest influence is the 3r head wipe.
            // Outside this padded envelope every trail, bead and clearing term is zero.
            if(abs(p.x-xb)>.0096+3.01*r)continue;
            float xp=xb+wob(p.y,pid);float dy=p.y-headY;
            if(dy>0.&&p.y<startY){
              float age=dy/max(v,.001);
              float w=r*mix(.78,.3,smoothstep(0.,.6,dy));
              float fade=1.-smoothstep(4.,16.,age);
              wipe=max(wipe,(1.-smoothstep(w*1.4,w*3.,abs(p.x-xp)))*(1.-smoothstep(18.,45.,age)));
              // The film necks into a dotted line as it thins.
              float neck=mix(1.,.35+.65*smoothstep(.25,.75,hash(vec2(floor(p.y/.006),pid))),smoothstep(.25,.9,dy));
              film(p.x-xp,w*neck,.85*fade*visibility,pixel,uv,water);
              float seg=.017;float cy=floor(p.y/seg);float bh=hash(vec2(cy,pid+5.));
              if(bh>.5){float by=(cy+.3+.4*hash(vec2(cy,pid)))*seg;
                if(by>headY+.02&&by<startY){float bAge=(by-headY)/max(v,.001);
                  vec2 bc=vec2(xb+wob(by,pid)+(hash(vec2(cy,pid+9.))-.5)*w*1.2,by);
                  lens(p,bc,w*mix(.55,1.15,bh)*1.15,1.12,pixel,visibility*(1.-smoothstep(12.,45.,bAge)),uv,water);}}
            }
            // Head: a heavy, bottom-bulged drop; it pauses and gathers at the start.
            float hy=max(headY,-.3);vec2 hc=vec2(xb+wob(hy,pid),hy);
            float gather=smoothstep(0.,.06,trav);
            wipe=max(wipe,1.-smoothstep(r*1.6,r*3.,length((p-hc)*vec2(1.,.6))));
            lens(p,hc,r*mix(.8,1.,gather),mix(1.08,1.38,gather),pixel,visibility,uv,water);
          }
        }

        // ---- Settled beads, three sizes. They sag slightly and are cleared
        // where a runner has passed recently.
        for(int layer=0;layer<3;layer++){
          float spacing=layer==0?.014:layer==1?.036:.085;vec2 cell=floor(p/spacing);float salt=uSeed+float(layer)*19.;
          float occupancy=layer==0?.32:layer==1?.27:.11;
          if(hash(cell+salt)<occupancy){vec2 center=(cell+.22+.56*vec2(hash(cell+salt+4.1),hash(cell+salt+8.9)))*spacing;
            float radius=layer==0?mix(.0009,.002,hash(cell+salt+2.)):layer==1?mix(.0022,.0042,hash(cell+salt+3.)):mix(.0044,.0062,hash(cell+salt+9.));
            lens(p,center,radius,mix(1.04,1.16,hash(cell+salt+6.)),pixel,visibility,uv,beads);}
        }

        // ---- Arrivals. Rain reaches the glass from above: each drop lands with
        // a short downward smear, settles into a bead that grows as it merges,
        // then slides away down the pane with a short trail of its own.
        for(int k=0;k<2;k++){
          float sp=k==0?.04:.075;vec2 cell=floor(p/sp);float s=hash(cell+uSeed+71.+float(k)*13.);
          float cyc=uTime*(.07+s*.11)*uImpactRate+s*7.;float age=fract(cyc),epoch=floor(cyc);
          if(hash(cell+epoch*.37+uSeed)<.45){
            vec2 c0=(cell+.25+.5*vec2(hash(cell+epoch+1.3),hash(cell+epoch+2.9)))*sp;
            float land=1.-smoothstep(0.,.035,age);
            float grow=mix(.0013,.0032,s)*(.7+.3*smoothstep(.04,.6,age));
            float slide=smoothstep(.7,1.,age);float drop=slide*slide*mix(.06,.2,s);
            float pid=s*9.+epoch;vec2 c=vec2(c0.x+(wob(c0.y-drop,pid)-wob(c0.y,pid)),c0.y-drop);
            float sm=land*mix(.01,.026,s);
            if(sm>.0005&&p.y>c.y&&p.y<c.y+sm)film(p.x-c.x,grow*.5*(1.-(p.y-c.y)/sm*.6),.55*land*visibility,pixel,uv,water);
            if(drop>.002&&p.y>c.y&&p.y<c0.y){float xt=c0.x+(wob(p.y,pid)-wob(c0.y,pid));film(p.x-xt,grow*.45,.42*visibility,pixel,uv,water);
              wipe=max(wipe,(1.-smoothstep(grow*.8,grow*2.,abs(p.x-xt))));}
            float alive=1.-smoothstep(.96,1.,age);
            lens(p,c,grow,mix(1.12,1.9,max(land,slide*.6)),pixel,visibility*alive,uv,water);
          }
        }

        // Coalesced wet tracks from earlier runners: faint, uneven, vertical.
        float filmColumn=floor(p.x/.23);float filmId=hash(vec2(filmColumn,uSeed+83.));
        if(filmId>.8){
          float filmX=(filmColumn+.2+.6*filmId)*.23+wob(p.y,filmId*29.)*1.4;
          float band=.5+.5*sin(p.y*3.1+filmId*27.);
          film(p.x-filmX,.0022*(.6+.4*band),.18*band*visibility,pixel,uv,water);
        }

        beads.a*=1.-clamp(wipe,0.,1.);
        vec4 outC=beads;over(water.rgb,water.a,outC);
        if(outC.a<.002)discard;
        gl_FragColor=outC;
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`;
    function pane(name,width,x,z,rotation,tangent,normal,seedValue){
      const geometry=new T.PlaneGeometry(width,12.72);geometries.push(geometry);
      const material=new T.ShaderMaterial({uniforms:{...shared,uTangent:{value:new T.Vector3(...tangent)},uPaneNormal:{value:new T.Vector3(...normal)},uSeed:{value:seedValue}},vertexShader,fragmentShader,transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:true,extensions:{derivatives:true}});materials.push(material);
      const mesh=new T.Mesh(geometry,material);mesh.name=name;mesh.position.set(x,6.4,z);mesh.rotation.y=rotation;mesh.renderOrder=3;mesh.raycast=()=>{};
      mesh.onBeforeRender=(renderer,scene,camera)=>{renderSize(renderer);shared.uViewValid.value=!capturedCamera||camera===capturedCamera?1:0;};
      panes.push(mesh);
      const positions=geometry.attributes.position;
      paneCorners.push([0,1,3,2].map(i=>new T.Vector3().fromBufferAttribute(positions,i)));
      group.add(mesh);
    }
    pane('Rain beads on front glazing',27.92,0,-7.974,0,[1,0,0],[0,0,1],7);
    pane('Rain beads on left glazing',29.92,-13.974,7,Math.PI/2,[0,0,1],[1,0,0],31);
    pane('Rain beads on right glazing',29.92,13.974,7,-Math.PI/2,[0,0,1],[-1,0,0],67);
    // The wet-glass shader discards every fragment beyond its distance fade.
    // Clip each real pane to the current view before measuring distance: its
    // nearest corner/point can be behind the camera while the visible part is far away.
    const beadFrustum=new T.Frustum(),beadViewProjection=new T.Matrix4(),beadCameraPosition=new T.Vector3();
    const beadClip=[Array.from({length:16},()=>new T.Vector3()),Array.from({length:16},()=>new T.Vector3())];
    const beadTriangle=new T.Triangle(),beadSegment=new T.Line3(),beadNearest=new T.Vector3();
    function hasVisibleBeads(camera){
      camera.updateWorldMatrix(true,false);group.updateWorldMatrix(true,false);
      beadCameraPosition.setFromMatrixPosition(camera.matrixWorld);
      beadViewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
      beadFrustum.setFromProjectionMatrix(beadViewProjection);
      // Retain a small margin outside the shader fade to stay conservative at
      // clip boundaries and under GPU/CPU floating-point differences.
      const reach=Math.max(0,shared.uBeadDistance.value.y+.02)*4,reachSquared=reach*reach;
      for(let paneIndex=0;paneIndex<panes.length;paneIndex++){
        const mesh=panes[paneIndex];if(!mesh.visible)continue;
        mesh.updateWorldMatrix(false,false);
        let input=beadClip[0],output=beadClip[1],count=4;
        for(let i=0;i<4;i++)input[i].copy(paneCorners[paneIndex][i]).applyMatrix4(mesh.matrixWorld);
        for(const plane of beadFrustum.planes){
          let nextCount=0;
          for(let i=0;i<count;i++){
            const a=input[i],b=input[(i+1)%count];
            const da=plane.distanceToPoint(a)+.0001,db=plane.distanceToPoint(b)+.0001;
            if(da>=0)output[nextCount++].copy(a);
            if((da>=0)!==(db>=0))output[nextCount++].copy(a).lerp(b,da/(da-db));
          }
          count=nextCount;const swap=input;input=output;output=swap;
          if(!count)break;
        }
        if(count===1&&input[0].distanceToSquared(beadCameraPosition)<=reachSquared)return true;
        if(count===2){
          beadSegment.set(input[0],input[1]).closestPointToPoint(beadCameraPosition,true,beadNearest);
          if(beadNearest.distanceToSquared(beadCameraPosition)<=reachSquared)return true;
        }
        for(let i=1;i<count-1;i++){
          beadTriangle.set(input[0],input[i],input[i+1]).closestPointToPoint(beadCameraPosition,beadNearest);
          if(beadNearest.distanceToSquared(beadCameraPosition)<=reachSquared)return true;
        }
      }
      return false;
    }
    function resize(w,h){const requested=quality.captureScale??(lite?.5:.6),maximum=quality.captureMaxWidth??(lite?640:1100);const scale=Math.min(requested,maximum/Math.max(w,1));target.setSize(Math.max(1,Math.round(w*scale)),Math.max(1,Math.round(h*scale)));captureSize.set(target.width,target.height);shared.uCaptured.value=0;}
    resize(innerWidth,innerHeight);
    return {group,
      update(time){shared.uTime.value=time;},
      setLightning(strength){shared.uLightning.value=Number.isFinite(strength)?T.MathUtils.clamp(strength,0,1):0;},
      // Test hooks: bead visibility range (metres) and impact frequency multiplier.
      setGlassTest(o){if(o.beadFadeStart!==undefined)shared.uBeadDistance.value.x=o.beadFadeStart;if(o.beadFadeEnd!==undefined)shared.uBeadDistance.value.y=o.beadFadeEnd;if(o.impactRate!==undefined)shared.uImpactRate.value=o.impactRate;if(o.runRate!==undefined)shared.uRunRate.value=o.runRate;if(o.visible!==undefined)panes.forEach(m=>m.visible=o.visible);},
      resize,
      setMood(name){const night=name==='night';shared.uNight.value=night?1:0;rainMaterial.uniforms.uColor.value.copy(linear(night?0xa4b9c5:0xc4cacc));rainMaterial.uniforms.uOpacity.value=night?.52:.36;},
      // City-space metres and linear light colour; use the same authored source
      // as the facade and haze shaders. Null clears it when a scene is hidden.
      setHologramLight(state){
        if(!state){hologram.uHoloStrength.value=0;return;}
        const position=state.position||[0,0,0],color=state.color||[.12,.48,.85];
        hologram.uHoloPosition.value.set(position[0]*4,position[1]*4,position[2]*4);
        hologram.uHoloColor.value.setRGB(color[0],color[1],color[2]);
        hologram.uHoloRadius.value=Math.max(1,(state.radius??24)*4);
        hologram.uHoloStrength.value=Math.max(0,state.strength??1);
      },
      getStats(){return {particles:count,layers:layerCounts.slice(),drawCalls:lite?6:9,capturePasses:1,worldUnitsPerMetre:4};},
      capture(renderer,scene,camera,excluded=[]){
        if(disposed||!group.visible||!hasVisibleBeads(camera)){
          // Keep the primary camera identity even without a fresh texture:
          // wet panes must remain suppressed in floor and cube reflections.
          capturedCamera=camera;shared.uCaptured.value=0;return;
        }
        if(!captureConfigured){captureConfigured=true;
          // Preserve neon highlights in the lens where the platform supports a
          // renderable half-float target; use the portable byte target otherwise.
          if(renderer.capabilities.isWebGL2&&renderer.extensions.has('EXT_color_buffer_float')){target.texture.type=T.HalfFloatType;target.dispose();}}
        capturedCamera=camera;renderSize(renderer);
        const previous={target:renderer.getRenderTarget(),tone:renderer.toneMapping,encoding:renderer.outputEncoding,shadowAuto:renderer.shadowMap.autoUpdate,shadowNeeds:renderer.shadowMap.needsUpdate,xr:renderer.xr.enabled};
        const hidden=[...panes,...excluded.filter(Boolean)].map(mesh=>[mesh,mesh.visible]);
        try{hidden.forEach(([mesh])=>mesh.visible=false);renderer.xr.enabled=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;renderer.toneMapping=T.NoToneMapping;renderer.outputEncoding=T.LinearEncoding;renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,camera);shared.uCaptured.value=1;}
        finally{renderer.setRenderTarget(previous.target);renderer.toneMapping=previous.tone;renderer.outputEncoding=previous.encoding;renderer.shadowMap.autoUpdate=previous.shadowAuto;renderer.shadowMap.needsUpdate=previous.shadowNeeds;renderer.xr.enabled=previous.xr;hidden.forEach(([mesh,visible])=>mesh.visible=visible);}
      },
      dispose(){disposed=true;if(group.parent)group.parent.remove(group);geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());target.dispose();}
    };
  }};
})();
