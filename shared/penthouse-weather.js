/* Original rain for Leon's penthouse. Four world units represent one metre.
 * API: create(THREE,{lite,quality?}) -> {group,update,resize,setMood,setHologramLight,capture,dispose}.
 * quality accepts captureScale, captureMaxWidth, beadFadeStart and beadFadeEnd (metres).
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
    const shared={uLightning:{value:0},uTime:{value:0},uScene:{value:target.texture},uViewport:{value:viewport},uCaptureSize:{value:captureSize},uCaptured:{value:0},uNight:{value:0},uViewValid:{value:1},uImpactRate:{value:1},uBeadDistance:{value:new T.Vector2(quality.beadFadeStart??2,quality.beadFadeEnd??4.1)}};
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
    const fragmentShader=`precision highp float;
      uniform sampler2D uScene;uniform vec2 uViewport,uCaptureSize,uBeadDistance;uniform vec3 uTangent,uPaneNormal;uniform float uTime,uCaptured,uNight,uSeed,uViewValid,uImpactRate;
      varying vec3 vWorld;varying vec2 vAlong,vUp;
      float hash(vec2 q){q=fract(q*vec2(123.34,456.21));q+=dot(q,q+45.32);return fract(q.x*q.y);}
      vec3 behind(vec2 uv){return mix(mix(vec3(.05,.07,.08),vec3(.035,.06,.09),uNight),texture2D(uScene,clamp(uv,vec2(.001),vec2(.999))).rgb,uCaptured);}
      void lens(vec2 p,vec2 center,float radius,float pixel,float visibility,vec2 screenUV,inout vec4 accumulated){
        float radiusPixels=radius/max(pixel,.00001);
        // Unresolved droplets contribute no high-contrast circle or distant image sample.
        float resolved=smoothstep(.95,2.5,radiusPixels)*visibility;
        if(resolved<.003)return;
        vec2 q=(p-center)/radius;q.y*=1.+.16*clamp(q.y,-1.,1.);float d=length(q);
        float edge=clamp(.7/radiusPixels,.025,.5);
        float alpha=(1.-smoothstep(1.-edge,1.+edge,d))*.66*resolved;
        if(alpha<.002)return;
        float detail=smoothstep(2.4,5.5,radiusPixels);
        float dome=sqrt(max(0.,1.-min(dot(q,q),1.)));
        // Refraction follows the droplet's projected size, never a fixed fraction
        // of the viewport. Small beads approach the undistorted background.
        float displacement=min(11.,radiusPixels*1.15)*resolved*(.45+.55*detail);
        vec2 rayOffset=(vAlong*q.x+vUp*q.y)*displacement/uViewport*(.6+.4*dome)*2.4;
        // A resolved bead is a tiny fisheye: it shows a wide, inverted image of the
        // city, so its bright points compress into specks inside the drop.
        vec2 fisheye=(vAlong*q.x+vUp*q.y)*.075*detail*(.4+.6*dome);
        vec3 color=behind(screenUV-rayOffset+fisheye*0.)*(1.-detail*.5)+behind(screenUV+fisheye)*detail*.5*1.35;
        if(detail>.05){vec2 footprint=vec2(.42,0.)/uCaptureSize;
          vec3 filtered=(behind(screenUV-rayOffset+footprint)+behind(screenUV-rayOffset-footprint))*.5;
          color=mix(color,filtered,.28*detail);}
        float rim=smoothstep(.77,.98,d)*(1.-smoothstep(.98,1.1,d));
        color*=1.-rim*.55*detail;color*=mix(1.,1.18,dome*detail);
        vec2 highlight=q-vec2(-.29,.38);float glint=exp(-dot(highlight,highlight)*30.);
        color+=mix(vec3(.11,.10,.085),vec3(.075,.10,.13),uNight)*glint*detail*1.6;
        float combined=alpha+accumulated.a*(1.-alpha);
        accumulated.rgb=(color*alpha+accumulated.rgb*accumulated.a*(1.-alpha))/max(combined,.0001);accumulated.a=combined;
      }
      void main(){
        vec2 p=vec2(dot(vWorld,uTangent),vWorld.y)*.25;vec2 uv=gl_FragCoord.xy/uViewport;
        // Derivatives are evaluated before any varying branch. Use the largest
        // surface footprint so glancing panes do not alias into a dotted veil.
        float pixel=max(max(length(dFdx(p)),length(dFdy(p))),.00001);
        vec3 viewDelta=cameraPosition-vWorld;float metres=length(viewDelta)*.25;
        float incidence=abs(dot(normalize(viewDelta),uPaneNormal));
        float visibility=(1.-smoothstep(uBeadDistance.x,uBeadDistance.y,metres))*smoothstep(.15,.52,incidence);
        if(uViewValid<.5||visibility<.003)discard;
        vec4 water=vec4(0.);
        for(int layer=0;layer<3;layer++){
          float spacing=layer==0?.016:layer==1?.041:.095;vec2 cell=floor(p/spacing);float salt=uSeed+float(layer)*19.;
          float occupancy=layer==0?.28:layer==1?.25:.10;
          if(hash(cell+salt)<occupancy){vec2 center=(cell+.22+.56*vec2(hash(cell+salt+4.1),hash(cell+salt+8.9)))*spacing;
            float radius=layer==0?mix(.001,.0022,hash(cell+salt+2.)):layer==1?mix(.0024,.0046,hash(cell+salt+3.)):mix(.0048,.0067,hash(cell+salt+9.));
            lens(p,center,radius,pixel,visibility,uv,water);}
        }
        // Impacts: a drop hits, throws a bright crown ring and a few satellite
        // droplets for ~0.2 s, then settles into a bead that slowly evaporates
        // into the film. Two cell scales; each cell re-fires on its own clock.
        for(int k=0;k<2;k++){
          float sp=k==0?.045:.08;vec2 cell=floor(p/sp);float s=hash(cell+uSeed+71.+float(k)*13.);
          float cyc=uTime*(.22+s*.38)*uImpactRate+s*7.;float age=fract(cyc),epoch=floor(cyc);
          if(hash(cell+epoch*.37+uSeed)<.42){
            vec2 center=(cell+.2+.6*vec2(hash(cell+epoch+1.3),hash(cell+epoch+2.9)))*sp;
            float burst=1.-smoothstep(0.,.07,age);
            float rr=mix(.0008,.0058,sqrt(clamp(age/.07,0.,1.)));
            float ringW=max(.0007,pixel*1.4);float dc=length(p-center);
            float ring=exp(-pow((dc-rr)/ringW,2.))*burst;
            float sat=0.;for(int j=0;j<4;j++){float a=hash(cell+epoch+float(j)*3.1)*6.2831;vec2 sd=center+vec2(cos(a),sin(a))*rr*(1.4+hash(cell+float(j))*.8);sat=max(sat,exp(-dot(p-sd,p-sd)/(ringW*ringW*.7)));}
            sat*=burst;
            float ringA=max(ring*.75,sat*.6)*visibility*smoothstep(.8,2.4,.0012/pixel);
            if(ringA>.003){vec3 ringCol=behind(uv-vAlong*(dc-rr)*.004)*1.25+mix(vec3(.05,.045,.04),vec3(.035,.05,.065),uNight);
              if(ringA>water.a)water=vec4(ringCol,ringA);else water.rgb=mix(water.rgb,ringCol,ringA);}
            float settle=smoothstep(.05,.12,age)*(1.-smoothstep(.55,1.,age));
            lens(p,center,mix(.0018,.0036,s),pixel,visibility*settle,uv,water);
          }
        }
        // Sparse slow runners preserve the close view; their tracks disappear
        // when narrower than a rendered pixel, rather than becoming sharp lines.
        float column=floor(p.x/.14);float identity=hash(vec2(column,uSeed+37.));
        if(identity>.86){float progress=(uTime-.18*sin(uTime*1.9+identity*9.))*(.006+identity*.004)+identity;
          float y=3.55-fract(progress)*4.;float baseX=(column+.28+.44*hash(vec2(column,8.+uSeed)))*.14;float x=baseX+.0017*sin(y*19.+identity*31.);
          lens(p,vec2(x,y),.0053,pixel,visibility,uv,water);
          float trackX=baseX+.0017*sin(p.y*19.+identity*31.);float trail=(1.-smoothstep(.0006,.0011,abs(p.x-trackX)))*smoothstep(y,y+.012,p.y)*(1.-smoothstep(y+.025,y+.19,p.y));
          trail*=smoothstep(.8,2.,.0011/pixel)*visibility*.12;
          if(trail>water.a)water=vec4(behind(uv+vAlong*clamp((x-p.x)*.5,-1./uViewport.x,1./uViewport.x))*.97,trail);}
        // Sparse coalesced wet tracks have a gently uneven edge and only a
        // subpixel optical displacement. They never survive as distant dots.
        float filmColumn=floor(p.x/.31);float filmId=hash(vec2(filmColumn,uSeed+83.));
        if(filmId>.88){
          float filmX=(filmColumn+.2+.6*filmId)*.31+.0018*sin(p.y*13.+filmId*21.);
          float film=(1.-smoothstep(.003,.014,abs(p.x-filmX)))*(.5+.5*sin(p.y*4.+filmId*27.));
          float filmAlpha=film*.028*visibility*smoothstep(.7,2.,.014/pixel);
          if(filmAlpha>water.a)water=vec4(behind(uv+vAlong*(film-.5)*.7/uViewport)*.985,filmAlpha);
        }
        if(water.a<.002)discard;
        gl_FragColor=water;
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
      setGlassTest(o){if(o.beadFadeStart!==undefined)shared.uBeadDistance.value.x=o.beadFadeStart;if(o.beadFadeEnd!==undefined)shared.uBeadDistance.value.y=o.beadFadeEnd;if(o.impactRate!==undefined)shared.uImpactRate.value=o.impactRate;if(o.visible!==undefined)panes.forEach(m=>m.visible=o.visible);},
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
