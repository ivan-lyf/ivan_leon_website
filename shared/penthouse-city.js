/* Reference-led storm city for Leon’s residence. Three.js r128.
 * Architectural reference: Further Fabrication / Wētā’s BR2049 miniature build photos:
 * https://www.furtherfabrication.com/blade-runner-2049
 * Sign scale and placement: the user’s supplied neon-city image.
 * Runtime meshes and fictional commercial artwork are original recreations. */
(function () {
  'use strict';
  window.PenthouseCity = {
    create: function (THREE, options) {
      options = options || {};
      var lite = !!options.lite;
      var group = new THREE.Group();
      group.name = 'Rain city — architecture, signs and airborne traffic';
      var geometries = [], materials = [], textures = [];
      var atmosphereEnabled=true;
      var lightning=window.PenthouseLightning?window.PenthouseLightning.create(THREE,{lite:lite,reducedMotion:options.reducedMotion}):null;
      if(lightning)group.add(lightning.group);
      var stormUniforms=lightning?lightning.uniforms:{uLightning:{value:0},uStrike:{value:new THREE.Vector3(0,60,-160)}};
      var stormGLSL=`uniform float uLightning;uniform vec3 uStrike;
        float stormLight(vec3 p,vec3 n){if(uLightning<=0.)return 0.;vec3 delta=uStrike-p;vec3 direction=delta/max(length(delta),.001);return uLightning*(.12+.88*max(dot(n,direction),0.));}`;
      var seed = 74192, transform = new THREE.Object3D();
      function random() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
      function range(a, b) { return a + random() * (b - a); }
      function linear(value) { return new THREE.Color(value).convertSRGBToLinear(); }
      function setLinear(color, value) { color.set(value).convertSRGBToLinear(); }
      function geometry(value) { geometries.push(value); return value; }
      function material(value) { materials.push(value); return value; }
      function texture(value) { textures.push(value); return value; }
      var box = geometry(new THREE.BoxGeometry(1, 1, 1));
      var plane = geometry(new THREE.PlaneGeometry(1, 1));
      var colors = {
        dusk: { top: '#202b34', horizon: '#5d686e', bottom: '#162c3a', building: '#25333d', window: '#c9d5d5', cool: '#79b8c9' },
        night: { top: '#050a12', horizon: '#21313d', bottom: '#101e29', building: '#17232e', window: '#c6d3d4', cool: '#75b6c7' }
      };
      var skyUniforms = {
        uTop: { value: linear(colors.night.top) }, uHorizon: { value: linear(colors.night.horizon) },
        uBottom: { value: linear(colors.night.bottom) }, uTime: { value: 0 }, uPollution: { value: 1 }
      };
      Object.assign(skyUniforms,stormUniforms);
      var noiseFunctions = [
        'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
        'float noise(vec2 p) { vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);',
        'return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y); }',
        'float fbm(vec2 p) { return noise(p)*.55+noise(p*2.07+7.3)*.27+noise(p*4.13+14.8)*.13+noise(p*8.31+21.7)*.05; }'
      ].join('\n');
      // Night realism: the city is lit from below. Street light pollution (sodium,
      // neon, a little cyan) scatters in the low rain haze and reaches facades as
      // a warm uplight; aerial perspective thickens toward the street.
      var atmosUniforms={uGlowStrength:{value:.08}};
      var glowGLSL=`
uniform float uGlowStrength;
float streetGlow(float y){return clamp(exp(-(y+92.)/34.),0.,1.6);}
vec3 streetGlowColor(vec3 p){float h=noise(p.xz*.011+vec2(3.1,7.7));float k=noise(p.xz*.027+vec2(11.,2.));
  vec3 sodium=vec3(1.,.42,.13),neon=vec3(.80,.17,.62),cyan=vec3(.12,.58,.78);
  return mix(mix(sodium,neon,smoothstep(.36,.70,h)),cyan,smoothstep(.60,.88,k)*.65);}
`;
      var cityFogGLSL=`
vec3 cityFogMix(vec3 c,vec3 p){
#ifdef USE_FOG
 #ifdef FOG_EXP2
 float f=1.-exp(-fogDensity*fogDensity*fogDepth*fogDepth);
 #else
 float f=smoothstep(fogNear,fogFar,fogDepth);
 #endif
 float g=streetGlow(p.y);f=clamp(f*(1.+g*.9),0.,1.);
 return mix(c,fogColor+streetGlowColor(p)*g*uGlowStrength+vec3(.16,.18,.21)*uLightning,f);
#else
 return c;
#endif
}
`;
      var skyMaterial = material(new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyUniforms,
        vertexShader: 'varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: [
          'varying vec3 vDirection; uniform vec3 uTop,uHorizon,uBottom; uniform float uTime,uPollution;', noiseFunctions, stormGLSL,
          'void main(){vec3 d=normalize(vDirection); float altitude=smoothstep(-.06,.48,d.y);',
          'vec3 color=mix(uHorizon,uTop,altitude); color=mix(color,uBottom,1.-smoothstep(-.55,-.07,d.y));',
          'vec2 p=vec2(atan(d.z,d.x)*5.7,asin(clamp(d.y,-1.,1.))*8.3)+vec2(uTime*.0018,0.);',
          'float warp=fbm(p*.63);float cloud=fbm(p+vec2(warp*2.4,warp*1.3));',
          'cloud=cloud*.83+fbm(p*3.7+9.2)*.17;',
          'float cloudMass=smoothstep(.23,.77,cloud);color*=mix(.76,1.04,cloudMass);',
          'float underglow=exp(-abs(d.y+.015)*9.);',
          'color+=vec3(.0015,.004,.0065)*underglow*(.4+cloudMass);',
          // Cloud base is lit from beneath by the city: warm sodium with neon patches.
          'float pollution=exp(-max(d.y+.02,0.)*5.2);float patchy=fbm(p*.42+3.1);',
          'vec3 cityLight=mix(vec3(.030,.011,.006),vec3(.020,.006,.019),smoothstep(.35,.7,patchy));',
          'color+=cityLight*pollution*(.35+1.1*cloudMass)*uPollution;',
          'if(uLightning>0.){float flashFocus=exp(-max(0.,1.-dot(d,uStrike/max(length(uStrike),.001)))*10.);',
          'color+=vec3(.90,.95,1.)*uLightning*(2.5+4.5*flashFocus)*(.72+.28*cloudMass);}',
          'gl_FragColor=vec4(color,1.);', '#include <tonemapping_fragment>', '#include <encodings_fragment>', '}'
        ].join('\n')
      }));
      var sky = new THREE.Mesh(geometry(new THREE.SphereGeometry(650, 32, 20)), skyMaterial);
      sky.name = 'Low storm ceiling'; sky.renderOrder = -10; sky.frustumCulled = false; group.add(sky);

      // One moving capsule field follows the actual whale mesh in city metres.
      // This bounded approximation supplies diffuse spill and rough reflections,
      // while the mesh itself supplies depth-tested layered holographic emission.
      var whale=window.PenthouseWhale?window.PenthouseWhale.create(THREE,{lite:lite}):null;
      if(whale)group.add(whale.group);
      var hologramUniforms={uHoloPosition:{value:new THREE.Vector3()},uHoloAxis:{value:new THREE.Vector3(1,0,0)},uHoloColor:{value:new THREE.Color(0,0,0)},uHoloRadius:{value:24},uHoloLength:{value:12},uHoloIntensity:{value:0}};
      var practicalGLSL=window.PenthouseCityLighting?window.PenthouseCityLighting.glsl(THREE,options.lighting):'vec3 practicalSpill(vec3 p,vec3 n){return vec3(0.);}';
      var hologramGLSL=`
        uniform vec3 uHoloPosition,uHoloAxis,uHoloColor;
        uniform float uHoloRadius,uHoloLength,uHoloIntensity;
        vec3 hologramDelta(vec3 p){vec3 d=p-uHoloPosition;return uHoloPosition+uHoloAxis*clamp(dot(d,uHoloAxis),-uHoloLength,uHoloLength)-p;}
        vec3 hologramGlow(vec3 p){float d=length(hologramDelta(p));float falloff=pow(max(0.,1.-d/max(uHoloRadius,.1)),2.);return uHoloColor*uHoloIntensity*falloff;}
        vec3 hologramSpill(vec3 p,vec3 n){vec3 d=hologramDelta(p);return hologramGlow(p)*(.08+.92*max(dot(n,normalize(d+vec3(.001))),0.));}
        vec3 hologramReflection(vec3 p,vec3 direction,float roughness){vec3 d=hologramDelta(p);float spread=.018+roughness*3.+3./max(length(d),3.);float lobe=exp((dot(direction,normalize(d+vec3(.001)))-1.)/spread);return hologramGlow(p)*lobe;}
      `;
      var facadeUniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uBuilding:{value:linear(colors.night.building)},uWindow:{value:linear(colors.night.window)},
        uCool:{value:linear(colors.night.cool)},uNight:{value:1},
        uExterior:{value:null},uExteriorReady:{value:0},uCityShadow:{value:null},uCityShadowFaceStep:{value:0}
      }]);
      var logoUniforms={uLogoPos:{value:[]},uLogoColor:{value:[]}};for(var li=0;li<8;li++){logoUniforms.uLogoPos.value.push(new THREE.Vector4(0,-1e4,0,.001));logoUniforms.uLogoColor.value.push(new THREE.Vector4(0,0,0,0));}
      var logoGLSL=window.PenthouseCorporate?window.PenthouseCorporate.glsl:'vec3 logoSpill(vec3 p,vec3 n){return vec3(0.);}';
      Object.assign(facadeUniforms,hologramUniforms,atmosUniforms,logoUniforms,stormUniforms);
      var facadeMaterial=material(new THREE.ShaderMaterial({fog:true,extensions:{derivatives:true},uniforms:facadeUniforms,
        vertexShader:`
          #include <common>
          #include <fog_pars_vertex>
          attribute float aSeed,aFamily,aRound,aUseClass,aSkin;attribute vec3 aSize;attribute vec4 aShadowRect;
          varying vec3 vWorldPosition,vNormal,vViewDirection,vBuildingOrigin,vBuildingSize;varying float vSeed,vFamily,vRound,vUseClass,vSkin;varying vec4 vShadowRect;
          void main(){vec4 local=instanceMatrix*vec4(position,1.);vec4 world=modelMatrix*local;
            vWorldPosition=local.xyz;vNormal=normalize(mat3(modelMatrix)*(normal/aSize));vSeed=aSeed;vFamily=aFamily;vRound=aRound;vUseClass=aUseClass;vSkin=aSkin;vShadowRect=aShadowRect;
            vViewDirection=cameraPosition-world.xyz;vBuildingOrigin=instanceMatrix[3].xyz;vBuildingSize=aSize;
            vec4 mvPosition=viewMatrix*world;gl_Position=projectionMatrix*mvPosition;
            #include <fog_vertex>
          }`,
        fragmentShader:`
          #include <common>
          #include <fog_pars_fragment>
          varying vec3 vWorldPosition,vNormal,vViewDirection,vBuildingOrigin,vBuildingSize;varying float vSeed,vFamily,vRound,vUseClass,vSkin;varying vec4 vShadowRect;
          uniform vec3 uBuilding,uWindow,uCool;uniform float uNight,uExteriorReady;uniform samplerCube uExterior;
          ${noiseFunctions}
          ${glowGLSL}
          ${stormGLSL}
          ${cityFogGLSL}
          ${hologramGLSL}
          ${practicalGLSL}
          ${logoGLSL}
          ${window.PenthouseCityShadow.glsl}
          float pane(vec2 p,vec2 lo,vec2 hi,vec2 aa){vec2 a=smoothstep(lo-aa,lo+aa,p)*(1.-smoothstep(hi-aa,hi+aa,p));return a.x*a.y;}
          // A view ray intersects a room box behind each pane. The visible ceiling,
          // side wall and rear wall genuinely change as the camera moves.
          vec3 roomInterior(vec2 uv,vec3 eye,float bayWidth,float identity,vec3 tint){
            vec3 extent=vec3(bayWidth*.405,1.14,2.4+hash(vec2(identity,12.))*2.1);
            vec3 origin=vec3((uv-.5)*extent.xy*2.,0.);
            vec3 ray=-normalize(vec3(eye.xy,max(abs(eye.z),.12)));
            vec3 farPlane=vec3(ray.x>0.?extent.x:-extent.x,ray.y>0.?extent.y:-extent.y,-extent.z);
            vec3 distances=vec3(abs(ray.x)<.00001?1e5:(farPlane.x-origin.x)/ray.x,abs(ray.y)<.00001?1e5:(farPlane.y-origin.y)/ray.y,(farPlane.z-origin.z)/ray.z);
            float t=min(distances.x,min(distances.y,distances.z));vec3 hit=origin+ray*max(t,0.);
            float back=step(distances.z,min(distances.x,distances.y)+.001);
            float ceiling=step(distances.y,min(distances.x,distances.z)+.001)*step(0.,hit.y);
            float side=1.-max(back,ceiling);
            float corner=min(extent.x-abs(hit.x),extent.y-abs(hit.y));
            float lightX=(hash(vec2(floor(identity),27.))-.5)*extent.x;
            float pool=exp(-length(vec2((hit.x-lightX)*.7,(hit.y-.65)*.9))*.95);
            float illumination=(.028+.16*pool)*(.5+.5*smoothstep(0.,.32,max(corner,0.)));
            float cabinet=step(hit.y,-.34)*step(abs(hit.x+extent.x*.22),extent.x*.46)*back;
            float partitionMask=(1.-smoothstep(.025,.09,abs(hit.x-extent.x*.31)))*back;
            float door=pane(vec2(hit.x/extent.x*.5+.5,hit.y/extent.y*.5+.5),vec2(.71,.06),vec2(.9,.84),vec2(.01))*back;
            // Independent occluders multiply transmittance; their overlap cannot create negative light.
            illumination*=(1.-cabinet*.80)*(1.-partitionMask*.40)*(1.-door*.28);
            vec3 room=tint*illumination*(back+side*.52+ceiling*.38);
            float panel=(1.-smoothstep(.18,.25,abs((hit.x-lightX)/extent.x)))*(1.-smoothstep(.20,.28,abs(hit.z/extent.z+.49)))*ceiling;
            float monitor=pane(vec2(hit.x/extent.x*.5+.5,hit.y/extent.y*.5+.5),vec2(.28,.27),vec2(.45,.38),vec2(.012))*back*step(.89,hash(vec2(identity,91.)));
            return room+tint*panel*.28+vec3(.045,.09,.095)*monitor;

          }
          void main(){
            vec3 n=normalize(vNormal),view=normalize(vViewDirection);vec3 localIrradiance=practicalSpill(vWorldPosition,n)+hologramSpill(vWorldPosition,n)+logoSpill(vWorldPosition,n);float roof=step(.7,abs(n.y));float side=step(.6,abs(n.x));
            float cornerFace=1.-step(.99,max(abs(n.x),abs(n.z)));cornerFace*=(1.-roof)*(1.-vRound);
            float width=mix(vBuildingSize.x,vBuildingSize.z,side),origin=mix(vBuildingOrigin.x,vBuildingOrigin.z,side);
            float along=mix(vWorldPosition.x,vWorldPosition.z,side);
            vec2 radial=(vWorldPosition.xz-vBuildingOrigin.xz)/(vBuildingSize.xz*.5);
            float angle=atan(radial.y,radial.x);
            if(vRound>.5){width=3.14159265*sqrt((vBuildingSize.x*vBuildingSize.x+vBuildingSize.z*vBuildingSize.z)*.5);along=angle/6.2831853*width;origin=0.;}
            vec2 wall=vec2(along,vWorldPosition.y);
            float bayTarget=1.5;vec4 opening=vec4(.065,.14,.935,.88);vec3 stone=vec3(.026,.036,.043);float reflectivity=.75;
            if(vFamily>.5&&vFamily<1.5){bayTarget=2.4;opening=vec4(.19,.23,.81,.83);stone=vec3(.20,.182,.145);reflectivity=.28;}
            else if(vFamily<2.5&&vFamily>1.5){bayTarget=1.35;opening=vec4(.15,.11,.85,.90);stone=vec3(.118,.063,.033);reflectivity=.51;}
            else if(vFamily<3.5&&vFamily>2.5){bayTarget=2.2;opening=vec4(.04,.29,.96,.77);stone=vec3(.145,.175,.17);reflectivity=.44;}
            else if(vFamily>3.5){bayTarget=1.75;opening=vec4(.16,.24,.84,.72);stone=vec3(.044,.049,.045);reflectivity=.26;}
            // Functional construction replaces one universal curtain-wall grid.
            if(vUseClass<.5){bayTarget=2.8;opening=vec4(.12,.56,.88,.77);reflectivity*=.72;}
            else if(vUseClass<1.5){bayTarget=2.5;opening=vec4(.16,.20,.79,.81);}
            if(vSkin>1.5&&vSkin<2.5){bayTarget=1.9;opening=vec4(.30,.15,.69,.84);}
            // Stabilize only the integer bay choice; retain the authored width for UV spacing.
            float stableWidth=floor(width*4096.+.5)/4096.;
            float bays=max(2.,floor(stableWidth/bayTarget)),bayWidth=width/bays;
            vec2 grid=vec2((along-origin+width*.5)/bayWidth,(wall.y+112.)/3.2);
            vec2 cell=floor(grid),part=fract(grid),aa=max(fwidth(grid),vec2(.001));
            // Constant instance varyings can differ by a few interpolation ULPs.
            // Never feed those differences into the high-gain occupancy hash.
            float stableSeed=floor(vSeed*4096.+.5)/4096.;float id=stableSeed*97.;
            float serviceFloor=1.-step(.80,hash(vec2(floor(cell.y/2.),id+18.)));
            float glazingZone=mix(1.,serviceFloor,1.-step(.5,vUseClass));
            float glass=pane(part,opening.xy,opening.zw,aa)*(1.-cornerFace)*glazingZone;
            vec2 inset=vec2(.024,.025);vec2 paneUV=(part-opening.xy-inset)/(opening.zw-opening.xy-inset*2.);
            vec3 tangent=side>.5?vec3(0.,0.,1.):vec3(1.,0.,0.);
            if(vRound>.5)tangent=normalize(vec3(-sin(angle)*vBuildingSize.x,0.,cos(angle)*vBuildingSize.z));
            vec3 eye=vec3(dot(view,tangent),view.y,dot(view,n));
            // The physical metal profiles stand 35cm forward of the glazing.
            // Their matching bevel catches skylight around the otherwise dark recess.
            float inner=pane(part,opening.xy+inset,opening.zw-inset,aa)*glazingZone;
            float edge=max(0.,glass-inner);
            float streak=fbm(wall*vec2(1.8,.08)+id),grain=noise(wall*5.+id);
            float fineDetail=1.-smoothstep(.12,.6,max(aa.x,aa.y));
            grain=mix(.5,grain,fineDetail);
            float runoff=exp(-abs(part.x-opening.x)*24.)+exp(-abs(part.x-opening.z)*24.);
            runoff*=step(part.y,opening.y)*exp(-(opening.y-part.y)*5.)*(.45+.55*hash(vec2(cell.x,id)));
            float surfaceAge=vFamily>3.5?.34:abs(vFamily-1.)<.4?.30:abs(vFamily-2.)<.4?.17:.14;
            float visibility=mix(cityShadow(vWorldPosition,n,vBuildingOrigin,vBuildingSize,vShadowRect),1.,roof);
            // No sun at night: a weak moonlit key, a dim sky dome above, and the
            // street's light pollution below. Facades become dark wet masses.
            float key=(.045+.78*pow(max(dot(n,normalize(vec3(-.6,.75,.4))),0.),1.25)*visibility)*mix(1.,.3,uNight);
            float glow=streetGlow(vWorldPosition.y);vec3 glowColor=streetGlowColor(vWorldPosition);
            float skyView=.5+.5*n.y;
            vec3 facadeLight=vec3(.65,.72,.86)*stormLight(vWorldPosition,n)+vec3(key)+glowColor*glow*(.20+.18*(1.-skyView))+vec3(.03,.044,.06)*skyView*uNight*mix(.6,1.,visibility);
            vec3 cladding=stone*mix(.76,1.12,hash(vec2(stableSeed,2.)));
            float materialGrain=vFamily>3.5||abs(vFamily-1.)<.4?.18:.06;
            // Long vertical grime runoff below sills and from roof edges.
            float grime=fbm(vec2(wall.x*.55+id,wall.y*.035))*.7+fbm(wall*vec2(.18,.02)+id*2.)*.3;
            cladding*=facadeLight*(.65+.24*streak+materialGrain*grain)*mix(1.,.55,smoothstep(.48,.78,grime));
            float slabShadow=1.-.46*exp(-max(part.y-opening.w,0.)*24.)*step(opening.w,part.y);
            float repair=step(.84,hash(floor(wall/vec2(2.3,5.2))+id));
            float wetness=smoothstep(.35,.76,streak);
            cladding*=slabShadow*(1.-runoff*surfaceAge)*mix(1.,.73,wetness)*mix(1.,1.24,repair);

            cladding*=1.-.24*exp(-part.y*19.);cladding+=localIrradiance*.32;
            float grazing=pow(1.-clamp(abs(dot(n,view)),0.,1.),3.);
            cladding+=glowColor*glow*wetness*grazing*.10+vec3(.010,.014,.018)*wetness*grazing*uNight;
            float fresnel=.03+.62*pow(1.-clamp(abs(dot(n,view)),0.,1.),5.);
            // Glass is never clean: rain rivulets sharpen reflections in thin
            // tracks; settled dirt and residue roughen and grey the rest.
            float rivulet=smoothstep(.70,.95,noise(vec2(wall.x*6.3+id,wall.y*.085)))*(.45+.55*noise(wall*vec2(2.,.5)+id));
            float dirt=smoothstep(.32,.82,fbm(wall*vec2(.8,.22)+id*1.7))*(.45+surfaceAge*1.6);
            vec3 glassTint=vec3(.68,.84,.91);float paneRoughness=.013;
            if(vFamily>.5&&vFamily<1.5){glassTint=vec3(.83,.88,.76);paneRoughness=.031;}
            else if(vFamily>1.5&&vFamily<2.5){glassTint=vec3(.94,.77,.58);paneRoughness=.018;}
            else if(vFamily>2.5&&vFamily<3.5){glassTint=vec3(.68,.90,.82);paneRoughness=.009;}
            else if(vFamily>3.5){glassTint=vec3(.70,.78,.72);paneRoughness=.037;}
            paneRoughness*=(.68+.58*hash(cell+id)+.50*(1.-streak))*(1.+dirt*2.2)*(1.-rivulet*.55);
            vec3 reflectedDirection=reflect(-view,normalize(n+tangent*(streak-.5)*.008));
            vec3 reflectionSpread=tangent*paneRoughness+vec3(0.,paneRoughness*.5,0.);
            vec3 reflected=mix(vec3(.004,.007,.012),vec3(.014,.022,.032),smoothstep(-.2,.5,reflectedDirection.y))*(.12+fresnel*.8);
            if(uExteriorReady>.5){
              vec3 env=textureCube(uExterior,reflectedDirection).rgb*.5;
              env+=textureCube(uExterior,normalize(reflectedDirection+reflectionSpread)).rgb*.25;
              env+=textureCube(uExterior,normalize(reflectedDirection-reflectionSpread)).rgb*.25;
              reflected=env*.55*(.08+fresnel*.72)*reflectivity*glassTint*(.90+.18*hash(cell+id+5.));
            }
            // Downward reflections pick up the glowing haze between the towers.
            float below=1.-smoothstep(-.55,0.,reflectedDirection.y);
            reflected+=streetGlowColor(vWorldPosition+vec3(0.,0.,9.))*streetGlow(vWorldPosition.y-38.)*below*(.05+fresnel*.5)*reflectivity;
            reflected+=vec3(.6,.7,.9)*uLightning*(.1+fresnel*.45)*smoothstep(-.1,.4,reflectedDirection.y);
            reflected*=mix(1.,.62,dirt)*(1.+rivulet*.6);
            vec3 glassColor=vec3(.0012,.0018,.0022)+dirt*vec3(.004,.0042,.0040)*(.5+glow)+reflected*(.48+.35*streak)+hologramReflection(vWorldPosition,reflectedDirection,paneRoughness)*(.24+fresnel*.65)+localIrradiance*(.035+fresnel*.14);
            // Occupancy by functional zone: ~6-floor bands are vacant, residential,
            // office or mechanical. Rooms within a zone share light temperature
            // logic; most of the city is dim or dark.
            float band=floor(cell.y/6.);float tenantFloor=band;
            float zone=hash(vec2(band,id+3.7));
            float wing=hash(vec2(floor(cell.x/max(2.,floor(bays*.5))),band+id));
            float vacant=step(zone,.30),residential=step(.30,zone)*step(zone,.63),office=step(.63,zone)*step(zone,.87),mechanical=step(.87,zone);
            if(vUseClass<.5){mechanical=max(mechanical,office);office=0.;}
            float floorOn=hash(vec2(cell.y,id+5.)),roomOn=hash(cell+id);
            float tenant=hash(vec2(floor(cell.x/2.),cell.y+id*1.3));
            float occupied=residential*step(.42,roomOn)*step(.10,floorOn)
              +office*step(.28,floorOn)*step(.14+.46*wing,roomOn)
              +mechanical*step(.94,roomOn)*.4
              +vacant*step(.982,roomOn)*.45;
            vec3 tungsten=vec3(1.,.55,.25),warmWhite=vec3(1.,.73,.46),neutral=vec3(.84,.85,.79),fluoro=vec3(.66,.90,.82),screenBlue=vec3(.28,.46,1.),neonPink=vec3(1.,.28,.6);
            vec3 roomTint=residential>.5?(tenant<.52?tungsten:tenant<.84?warmWhite:tenant<.95?screenBlue:neonPink)
              :office>.5?(tenant<.68?neutral:tenant<.9?fluoro:warmWhite):mechanical>.5?fluoro*.55:warmWhite;
            float level=mix(.30,1.,hash(cell+id+17.))*(residential>.5?1.25:office>.5?1.6:.8);
            vec3 room=roomInterior(clamp(paneUV,0.,1.),eye,bayWidth,tenant*39.+cell.y+id,roomTint*level);
            float blindCover=step(.70,hash(cell+vec2(id,41.+id)));float openAmount=.42+.56*hash(cell+vec2(9.+id,id));
            float blind=(1.-smoothstep(.04-aa.y,.09+aa.y,abs(fract(part.y*11.)-.5)))*blindCover;
            float blindMask=step(openAmount,part.y)*blindCover;
            blind*=1.-smoothstep(.15,.7,aa.y*11.);
            room*=1.-blind*.22-blindMask*.53;
            // The glazing sits in front of a deep reveal; upper and side jambs
            // occlude a small portion of the lit room even when its blinds are open.
            float jambOcclusion=(1.-smoothstep(.0,.10,paneUV.x))+(1.-smoothstep(.0,.07,1.-paneUV.y));
            room*=1.-clamp(jambOcclusion,0.,1.)*.32;
            // Average interior details before they shrink below a few screen pixels.
            float unresolved=smoothstep(.08,.40,max(aa.x,aa.y));room=mix(room,roomTint*level*.11,unresolved);
            room*=1.-dirt*.32;
            vec3 color=mix(cladding,glassColor,glass);
            color+=room*occupied*inner*(1.5+uNight*.7)*(.75+.55*hash(vec2(floor(cell.x/3.),tenantFloor+id+4.)))*(1.-fresnel*.65)*(1.-cornerFace);
            // Lit rooms scatter through grimy, wet glass.
            color+=roomTint*level*occupied*inner*dirt*.012;
            color+=edge*vec3(.016,.022,.027)*key;
            color=mix(color,cladding*.70,roof);
            gl_FragColor=vec4(max(color,0.),1.);
            gl_FragColor.rgb=cityFogMix(gl_FragColor.rgb,vWorldPosition);
            #include <tonemapping_fragment>
            #include <encodings_fragment>
          }`
      }));
      var towers = [], structure = [], ribs = [], reveals = [], cyan = [], magenta = [], beacons = [];
      function block(list, x, y, z, w, h, d, buildingSeed) { list.push({ x:x, y:y, z:z, w:w, h:h, d:d, seed:buildingSeed || random() }); }
      var architectureStats=window.PenthouseArchitecture.populate({THREE:THREE,lite:lite,random:random,range:range,block:block,towers:towers,structure:structure,ribs:ribs,cyan:cyan,magenta:magenta,beacons:beacons});
      var cityShadows=window.PenthouseCityShadow.bake(THREE,towers,{lite:lite});texture(cityShadows.texture);
      facadeUniforms.uCityShadow.value=cityShadows.texture;facadeUniforms.uCityShadowFaceStep.value=cityShadows.faceStep;
      towers.forEach(function(t,index){t.shadowRect=Array.from(cityShadows.rects.slice(index*4,index*4+4));});


      function instances(items, mat, name, customGeometry, facadePalette) {
        if(!items.length)return null;
        var shapeGeometry=customGeometry||box;
        if(facadePalette){shapeGeometry=geometry(shapeGeometry.clone());shapeGeometry.setAttribute('aShade',new THREE.InstancedBufferAttribute(new Float32Array(items.map(function(t){return cityShadows.sampleAt(t.x,t.y,t.z);})),1));shapeGeometry.setAttribute('aFamily',new THREE.InstancedBufferAttribute(new Float32Array(items.map(function(t){return t.family||0;})),1));}
        var mesh=new THREE.InstancedMesh(shapeGeometry,mat,items.length);
        mesh.name=name;mesh.frustumCulled=false;
        items.forEach(function(item,index){transform.position.set(item.x,item.y,item.z);transform.rotation.fromArray((item.rotation||[0,0,0]).concat(['XYZ']));transform.scale.set(item.w,item.h,item.d);transform.updateMatrix();mesh.setMatrixAt(index,transform.matrix);
          if(facadePalette){var palette=['#384953','#827868','#80614a','#6c8580','#444945'];mesh.setColorAt(index,linear(palette[item.family||0]));}});
        mesh.instanceMatrix.needsUpdate=true;group.add(mesh);return mesh;
      }
      var footprint=new THREE.Shape(),cut=.045;
      [[-.5+cut,-.5],[.5-cut,-.5],[.5,-.5+cut],[.5,.5-cut],[.5-cut,.5],[-.5+cut,.5],[-.5,.5-cut],[-.5,-.5+cut]].forEach(function(p,i){if(i)footprint.lineTo(p[0],p[1]);else footprint.moveTo(p[0],p[1]);});footprint.closePath();
      var towerGeometry=geometry(new THREE.ExtrudeGeometry(footprint,{depth:1,bevelEnabled:false,steps:1}));towerGeometry.rotateX(-Math.PI/2);towerGeometry.translate(0,-.5,0);

      function occupiedInstances(items,g,name){
        g.setAttribute('aShadowRect',new THREE.InstancedBufferAttribute(new Float32Array(items.reduce(function(a,t){return a.concat(t.shadowRect);},[])),4));
        g.setAttribute('aUseClass',new THREE.InstancedBufferAttribute(new Float32Array(items.map(function(t){return t.useClass===undefined?2:t.useClass;})),1));
        g.setAttribute('aSkin',new THREE.InstancedBufferAttribute(new Float32Array(items.map(function(t){return t.skin||0;})),1));
        g.setAttribute('aFamily',new THREE.InstancedBufferAttribute(new Float32Array(items.map(function(t){return t.family||0;})),1));
        g.setAttribute('aRound',new THREE.InstancedBufferAttribute(new Float32Array(items.map(function(t){return t.shape==='round'?1:0;})),1));
        g.setAttribute('aSeed',new THREE.InstancedBufferAttribute(new Float32Array(items.map(function(t){return t.seed;})),1));
        g.setAttribute('aSize',new THREE.InstancedBufferAttribute(new Float32Array(items.reduce(function(a,t){return a.concat([t.w,t.h,t.d]);},[])),3));
        instances(items,facadeMaterial,name,g);
      }
      occupiedInstances(towers.filter(function(t){return t.shape!=='round';}),towerGeometry,'Distinct occupied volumes — six architectural families');
      var roundGeometry=geometry(new THREE.CylinderGeometry(.5,.5,1,lite?24:40,1,false));
      occupiedInstances(towers.filter(function(t){return t.shape==='round';}),roundGeometry,'Elliptical glazed towers and curved setback crowns');
      var roundBelts=[];
      towers.forEach(function(t){
        if(t.skin!==undefined)return;
        if(t.z < (lite?-105:-140) || Math.abs(t.x)> (lite?46:72) || t.h<24)return;
        if(t.shape==='round'){
          for(var ry=t.y-t.h/2+6.4;ry<t.y+t.h/2;ry+=6.4){block(roundBelts,t.x,ry,t.z,t.w+.18,.23,t.d+.18);roundBelts[roundBelts.length-1].family=t.family;}
          return;
        }
        var revealStart=reveals.length;var family=t.family||0,bayTarget=t.useClass===1?2.5:t.skin===2?1.9:[1.5,2.4,1.35,2.2,1.75][family];
        var front=t.z+t.d/2,bays=Math.max(2,Math.floor(t.w/bayTarget)),step=t.w/bays;
        for(var x=1;x<bays;x++)block(reveals,t.x-t.w/2+x*step,t.y,front+.18,.095,t.h,.36);
        var low=t.y-t.h/2,high=t.y+t.h/2;
        for(var floor=Math.ceil((low+112)/3.2);floor*3.2-112<high;floor++){
          var yy=floor*3.2-112;
          block(reveals,t.x,yy+.35,front+.19,t.w*.91,.24,.42);
          // Occasional projecting sunshades add a second plane to the curtain wall.
          if(floor%5===0)block(reveals,t.x,yy+.65,front+.39,t.w*.90,.12,.84);
        }
        if(!lite){
          var sideX=t.x+(t.x<0?t.w/2:-t.w/2),sign=t.x<0?1:-1,sideBays=Math.max(2,Math.floor(t.d/bayTarget));
          for(var z=1;z<sideBays;z++)block(reveals,sideX+sign*.18,t.y,t.z-t.d/2+z*t.d/sideBays,.36,t.h,.095);
          for(var f=Math.ceil((low+112)/3.2);f*3.2-112<high;f++)block(reveals,sideX+sign*.19,f*3.2-112+.35,t.z,.42,.24,t.d*.91);
        }
        for(var ri=revealStart;ri<reveals.length;ri++){reveals[ri].family=family;reveals[ri].buildingId=t.buildingId;}
      });
      var structureMaterial=material(new THREE.MeshStandardMaterial({color:linear('#b0b7bc'),metalness:.12,roughness:.64,envMapIntensity:.28,fog:true}));
      var ribMaterial=material(new THREE.MeshStandardMaterial({color:linear('#a1adb6'),metalness:.67,roughness:.32,envMapIntensity:.42,fog:true}));
      // Wet anodized metal and weathered concrete now use lighting and an exterior
      // reflection probe; seams and vertical runoff vary roughness as well as color.
      [structureMaterial,ribMaterial].forEach(function(mat){
        mat.onBeforeCompile=function(shader){
          Object.assign(shader.uniforms,hologramUniforms,atmosUniforms,logoUniforms,stormUniforms);
          shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vStructurePosition;varying vec3 vStructureNormal;varying float vMaterialFamily,vMaterialShade;\n#ifdef USE_INSTANCING\nattribute float aFamily,aShade;\n#endif');
          shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',[
            '#include <begin_vertex>','vMaterialFamily=0.;vMaterialShade=1.;','vec4 structurePosition=vec4(transformed,1.);',
            '#ifdef USE_INSTANCING','vMaterialFamily=aFamily;vMaterialShade=aShade;structurePosition=instanceMatrix*structurePosition;','#endif',
            'vStructurePosition=(modelMatrix*structurePosition).xyz*.25;', 'vec3 exteriorNormal=normal;', '#ifdef USE_INSTANCING', 'exteriorNormal=mat3(instanceMatrix)*(exteriorNormal/vec3(dot(instanceMatrix[0].xyz,instanceMatrix[0].xyz),dot(instanceMatrix[1].xyz,instanceMatrix[1].xyz),dot(instanceMatrix[2].xyz,instanceMatrix[2].xyz)));', '#endif', 'vStructureNormal=normalize(mat3(modelMatrix)*exteriorNormal);'
          ].join('\n'));
          shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vStructurePosition;varying vec3 vStructureNormal;varying float vMaterialFamily,vMaterialShade;\n'+noiseFunctions+'\n'+glowGLSL+'\n'+hologramGLSL+'\n'+practicalGLSL+'\n'+logoGLSL+'\n'+stormGLSL);
          shader.fragmentShader=shader.fragmentShader.replace('#include <fog_pars_fragment>','#include <fog_pars_fragment>\n'+cityFogGLSL);
          shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>','gl_FragColor.rgb=cityFogMix(gl_FragColor.rgb,vStructurePosition);');
          shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',[
            '#include <color_fragment>','vec3 sp=vStructurePosition;',
            'float weathering=fbm(sp.xz*1.2+vec2(sp.y*.035,sp.y*.024));',
            'vec2 surface=abs(vStructureNormal.x)>.6?sp.zy:sp.xy;vec2 panel=fract(surface*vec2(.72,.3125));vec2 panelAA=max(fwidth(surface*vec2(.72,.3125)),vec2(.0001));float joint=(1.-smoothstep(.009,.024+panelAA.x,min(panel.x,1.-panel.x)))+(1.-smoothstep(.009,.024+panelAA.y,min(panel.y,1.-panel.y)));joint*=1.-smoothstep(.08,.4,max(panelAA.x,panelAA.y));',
            'float repair=step(.82,hash(floor(surface/vec2(2.8,4.4))));float wet=smoothstep(.34,.77,weathering);',
            'diffuseColor.rgb*= (.52+weathering*.48-joint*.15)*mix(1.,1.27,repair)*mix(1.,.66,wet);'
          ].join('\n'));
          shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=vMaterialFamily<.5?.27:vMaterialFamily<1.5?.76:vMaterialFamily<2.5?.38:vMaterialFamily<3.5?.43:.66;roughnessFactor=clamp(roughnessFactor+repair*.12-wet*.23,.13,.86);');
          shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
            float microHeight=(noise(vStructurePosition.xy*11.7)+noise(vStructurePosition.zy*10.3))*.0015;
            vec3 dxView=dFdx(-vViewPosition),dyView=dFdy(-vViewPosition);
            vec3 gradX=cross(dyView,normal),gradY=cross(normal,dxView);float area=dot(dxView,gradX);
            normal=normalize(abs(area)*normal-sign(area)*(dFdx(microHeight)*gradX+dFdy(microHeight)*gradY));`);
          shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=vMaterialFamily<.5?.65:vMaterialFamily<1.5?.025:vMaterialFamily<2.5?.78:vMaterialFamily<3.5?.10:.38;');
          shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.directDiffuse*=(.12+.88*vMaterialShade)*.32;reflectedLight.directSpecular*=(.25+.75*vMaterialShade)*.6;reflectedLight.indirectDiffuse*=(.35+.65*vMaterialShade)*.55;');
          shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=diffuseColor.rgb*vec3(.48,.55,.68)*stormLight(vStructurePosition,normalize(vStructureNormal));totalEmissiveRadiance+=(hologramSpill(vStructurePosition,normalize(vStructureNormal))*1.3+logoSpill(vStructurePosition,normalize(vStructureNormal))*2.2+practicalSpill(vStructurePosition,normalize(vStructureNormal))*2.4)*diffuseColor.rgb*.8;totalEmissiveRadiance+=diffuseColor.rgb*((.004+.08*max(dot(normalize(vStructureNormal),normalize(vec3(-.6,.75,.4))),0.))*vMaterialShade+streetGlowColor(sp)*streetGlow(sp.y)*(.16+.14*max(-vStructureNormal.y,0.)));');
        };
      });
      instances(structure,structureMaterial,'Stone, bronze, ceramic and industrial setbacks',null,true);
      instances(ribs,ribMaterial,'Wet anodized structural piers',null,true);
      instances(reveals,ribMaterial,'Raised mullions, recessed glazing and projecting floor reveals',null,true);
      instances(roundBelts,ribMaterial,'Curved metal floor bands',geometry(new THREE.CylinderGeometry(.5,.5,1,32,1,true)),true);
      var cyanMaterial=material(new THREE.MeshBasicMaterial({color:linear('#35a6cf').multiplyScalar(2.1),fog:true}));
      var magentaMaterial=material(new THREE.MeshBasicMaterial({color:linear('#b046c2').multiplyScalar(2.1),fog:true}));
      instances(cyan,cyanMaterial,'Cyan architectural lighting');instances(magenta,magentaMaterial,'Violet architectural lighting');

      // Only small physical maintenance fixtures remain. The archived billboard
      // library is preserved in artwork/, but is no longer the city's spectacle.
      var cityLighting=window.PenthouseCityLighting?window.PenthouseCityLighting.create(THREE,options.lighting):null;
      if(cityLighting)group.add(cityLighting.group);
      function loadLighting(){return Promise.all([cityLighting?cityLighting.ready:null,corporate?corporate.ready:null]);}

      var hazeMaterial=material(new THREE.ShaderMaterial({
        uniforms:Object.assign({uHazeColor:{value:linear('#4b6a85')},uTime:{value:0},uDensity:{value:1}},hologramUniforms,atmosUniforms,stormUniforms),transparent:true,depthWrite:false,depthTest:true,fog:false,
        vertexShader:'varying vec2 vUv;varying vec3 vMistPosition;void main(){vUv=uv;vMistPosition=(modelMatrix*vec4(position,1.)).xyz*.25;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:[
          'varying vec2 vUv;varying vec3 vMistPosition;uniform vec3 uHazeColor;uniform float uTime,uDensity;',noiseFunctions,glowGLSL,hologramGLSL,stormGLSL,
          'void main(){vec2 p=vUv*vec2(6.,2.7)+vec2(uTime*.003,0.);float n=fbm(p+fbm(p*.7)*1.6);',
          'float veil=exp(-pow((vUv.y-.43)*3.8,2.));float edge=smoothstep(0.,.12,vUv.x)*(1.-smoothstep(.88,1.,vUv.x));',
          'edge*=smoothstep(0.,.1,vUv.y)*(1.-smoothstep(.9,1.,vUv.y));float alpha=smoothstep(.19,.76,n)*veil*edge*mix(.25,.43,smoothstep(65.,300.,-vMistPosition.z))*uDensity;',
          'float warm=smoothstep(10.,150.,vMistPosition.x)*.18;vec3 scattering=mix(uHazeColor,vec3(.095,.055,.026),warm);scattering+=hologramGlow(vMistPosition)*.20;',
          'float lowGlow=streetGlow(vMistPosition.y);scattering+=streetGlowColor(vMistPosition)*lowGlow*uGlowStrength*3.4;alpha*=1.+lowGlow*1.1;',
          'scattering+=vec3(.7,.78,.9)*uLightning*.7;gl_FragColor=vec4(scattering,alpha);','#include <tonemapping_fragment>','#include <encodings_fragment>','}'
        ].join('\n')
      }));
      // The upper four layers are the original depth haze; the lower three are
      // the light-polluted rain layer that sits between the towers at street level.
      [[-72,-26,230,48],[-128,-2,330,62],[-204,16,470,78],[-302,29,650,100],[-58,-66,240,52],[-112,-62,360,60],[-176,-56,520,66]].forEach(function(p,index){var haze=new THREE.Mesh(plane,hazeMaterial);haze.name='Rain-softened atmosphere '+index;haze.position.set(index%2?-12:10,p[1],p[0]);haze.scale.set(p[2],p[3],1);group.add(haze);});

      // A bounded thin layer samples the very same practical irradiance field.
      // This is the browser substitute for low-density native volume scattering.
      var localMistMaterial=material(new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:Object.assign({uTime:{value:0}},hologramUniforms),
        vertexShader:'varying vec3 vCityPosition;void main(){vCityPosition=(modelMatrix*vec4(position,1.)).xyz*.25;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:`varying vec3 vCityPosition;uniform float uTime;${noiseFunctions}${practicalGLSL}${hologramGLSL}
          void main(){vec3 light=hologramGlow(vCityPosition)*.38;float mist=.45+.55*fbm(vCityPosition.xy*.13+vec2(uTime*.009,0.));
            gl_FragColor=vec4(light*mist,.12);
            #include <tonemapping_fragment>
            #include <encodings_fragment>
          }`
      }));
      var localMist=new THREE.Mesh(plane,localMistMaterial);localMist.name='Practical-light scattering around the whale';localMist.position.set(0,8,-77.8);localMist.scale.set(210,150,1);group.add(localMist);

      var obstacles=towers.concat(structure.filter(function(t){return t.collision!==false;}),ribs.filter(function(t){return t.collision===true;})).map(function(t){
        if(!t.rotation)return t;
        var bounds=new THREE.Box3(new THREE.Vector3(-t.w/2,-t.h/2,-t.d/2),new THREE.Vector3(t.w/2,t.h/2,t.d/2));
        var matrix=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler().fromArray(t.rotation.concat(['XYZ'])));bounds.applyMatrix4(matrix);
        var size=bounds.getSize(new THREE.Vector3());return Object.assign({},t,{w:size.x,h:size.y,d:size.z});
      });
      var traffic=window.PenthouseTraffic.create(THREE,{lite:lite,obstacles:obstacles});
      group.add(traffic.group);
      function setCarModel(model){traffic.setModel(model);}
      function animateCars(time){traffic.update(time);}
      if(options.carModel)setCarModel(options.carModel);
      // Aviation obstruction lights on the highest roof of most addresses:
      // slow red pulses, occasional white xenon strobes. Each has its own phase.
      var roofTops={};towers.forEach(function(t){var cur=roofTops[t.buildingId];if(!cur||t.y+t.h/2>cur.y+cur.h/2)roofTops[t.buildingId]=t;});
      Object.keys(roofTops).forEach(function(k){var t=roofTops[k],y=t.y+t.h/2;if(y<-30||t.z<-330||random()<.3)return;
        [[-1,-1],[1,1],[1,-1],[-1,1]].slice(0,y>20?4:2).forEach(function(c){beacons.push(new THREE.Vector3(t.x+c[0]*t.w*.44,y+1.7,t.z+c[1]*t.d*.44));});});
      var beaconSeeds=new Float32Array(beacons.length);for(var bi=0;bi<beacons.length;bi++)beaconSeeds[bi]=random();
      var beaconMaterial=material(new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uScale:{value:typeof innerHeight==='number'?innerHeight:800}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
        vertexShader:'attribute float aSeed;uniform float uTime,uScale;varying float vSeed,vOn,vFade;void main(){vSeed=aSeed;vec4 mv=modelViewMatrix*vec4(position,1.);float d=max(1.,-mv.z);float strobe=step(.84,aSeed);float period=strobe>.5?1.5+aSeed:2.2+aSeed*1.8;float ph=fract(uTime/period+aSeed*7.);vOn=strobe>.5?exp(-ph*34.)*3.:.18+.82*smoothstep(0.,.1,ph)*(1.-smoothstep(.42,.62,ph));vFade=exp(-d*.00028);gl_PointSize=clamp(3.4*projectionMatrix[1][1]*uScale*.5/d,3.,13.);gl_Position=projectionMatrix*mv;}',
        fragmentShader:'varying float vSeed,vOn,vFade;void main(){vec2 q=gl_PointCoord-.5;float r2=dot(q,q)*4.;float core=exp(-r2*38.);float halo=exp(-r2*3.5)*.22;vec3 c=vSeed>.84?vec3(1.,.94,.88):vec3(1.,.07,.03);gl_FragColor=vec4(c*(core*6.+halo*2.)*vOn*vFade,1.);}'}));
      if(beacons.length){var beaconGeometry=geometry(new THREE.BufferGeometry().setFromPoints(beacons));beaconGeometry.setAttribute('aSeed',new THREE.BufferAttribute(beaconSeeds,1));var beaconPoints=new THREE.Points(beaconGeometry,beaconMaterial);beaconPoints.name='Aviation obstruction lights and strobes';beaconPoints.frustumCulled=false;var beaconViewport=new THREE.Vector2();beaconPoints.onBeforeRender=function(renderer){var target=renderer.getRenderTarget();beaconMaterial.uniforms.uScale.value=target?target.height:renderer.getDrawingBufferSize(beaconViewport).y;};group.add(beaconPoints);}

      // Light shafts: sweeping rooftop searchlights and the whale's own
      // projector column. Additive soft cones; rain dust modulates them.
      var beamTime={value:0};
      var coneGeometry=geometry(new THREE.CylinderGeometry(1,.12,1,28,1,true));coneGeometry.translate(0,.5,0);var lampGeometry=geometry(new THREE.SphereGeometry(.55,12,8));
      // Analytic single-scattering through a Gaussian beam: each pixel finds the
      // view ray's closest approach to the beam axis, so the shaft is a true
      // volume (tight hot core near the lamp, soft aureole, forward-scatter
      // phase, rain dust drifting through it). The cone mesh only bounds it.
      function beamMaterial(color,strength,r0){return material(new THREE.ShaderMaterial({uniforms:{uTime:beamTime,uColor:{value:linear(color)},uStrength:{value:strength},uR0:{value:r0}},transparent:true,depthWrite:false,side:THREE.FrontSide,blending:THREE.AdditiveBlending,
        vertexShader:'varying vec3 vP,vS,vA;varying float vL,vR;void main(){vec4 w=modelMatrix*vec4(position,1.);vP=w.xyz;vS=(modelMatrix*vec4(0.,0.,0.,1.)).xyz;vec3 ay=mat3(modelMatrix)*vec3(0.,1.,0.);vL=length(ay);vA=ay/vL;vR=length(mat3(modelMatrix)*vec3(1.,0.,0.))/1.8;gl_Position=projectionMatrix*viewMatrix*w;}',
        fragmentShader:noiseFunctions+'\nuniform vec3 uColor;uniform float uStrength,uTime,uR0;varying vec3 vP,vS,vA;varying float vL,vR;'+
          'void main(){vec3 ro=cameraPosition,rd=normalize(vP-ro);vec3 w0=ro-vS;float b=dot(rd,vA),d=dot(rd,w0),e=dot(vA,w0);float den=max(1.-b*b,1e-4);'+
          'float tR=(b*e-d)/den,tA=clamp((e-b*d)/den,0.,vL);float hgt=tA/vL;vec3 pa=vS+vA*tA,pr=ro+rd*max(tR,0.);vec3 off=pr-pa;float dist=length(off);'+
          'float r=vR*mix(uR0,1.,hgt);float q=dist*dist/(r*r);float core=exp(-q*3.)+exp(-q*.35)*.16;'+
          'float g=.62;float hg=(1.-g*g)/pow(1.+g*g-2.*g*dot(vA,-rd),1.5)*.25+.08;'+
          'float path=min(1./max(sqrt(den),.1),6.)*r/vR;'+
          'float atten=exp(-hgt*2.4)*smoothstep(0.,.012,hgt)*(1.-smoothstep(.75,1.,hgt));'+
          'vec3 side=normalize(cross(vA,vec3(0.,0.,1.))+vec3(1e-4));float dust=.55+.45*noise(vec2(tA*.035-uTime*.7,dot(off,side)*.35))*(.6+.4*noise(vec2(tA*.009+uTime*.12,dist*.1)));'+
          'float fade=exp(-length(pa-ro)*.00038);gl_FragColor=vec4(uColor*core*hg*path*atten*dust*fade*uStrength,1.);}'}));}
      var lampMaterial=material(new THREE.MeshBasicMaterial({color:linear('#fff4e2').multiplyScalar(14),fog:true}));
      var lampHousing=material(new THREE.MeshStandardMaterial({color:linear('#15181c'),roughness:.5,metalness:.7}));
      var searchlights=[[-82,65.4,-165,'#dfe9ff',3.6,0],[100,70.4,-190,'#fff0dc',3.2,2.1],[-152,34.4,-262,'#e4ecff',3.,4.2],[156,44.4,-300,'#ffe9f0',2.8,1.3]].map(function(s){
        var m=new THREE.Mesh(coneGeometry,beamMaterial(s[3],s[4],.07));m.name='Rooftop searchlight shaft';m.position.set(s[0],s[1],s[2]);m.scale.set(6.5*1.8,280,6.5*1.8);m.frustumCulled=false;m.renderOrder=2;m.userData.phase=s[5];group.add(m);
        var lamp=new THREE.Mesh(lampGeometry,lampMaterial);lamp.name='Searchlight lens';lamp.position.set(s[0],s[1]+.2,s[2]);group.add(lamp);
        var body=new THREE.Mesh(box,lampHousing);body.name='Searchlight yoke';body.position.set(s[0],s[1]-.5,s[2]);body.scale.set(1.6,1.2,1.6);group.add(body);
        return m;});
      var projectorSource=new THREE.Vector3(15.4,61.2,-90.4);
      var projector=new THREE.Mesh(coneGeometry,beamMaterial('#4fb8ff',1.6,.04));projector.name='Hologram projector column';projector.position.copy(projectorSource);projector.frustumCulled=false;projector.renderOrder=2;group.add(projector);
      var emitter=new THREE.Mesh(geometry(new THREE.SphereGeometry(.45,12,8)),material(new THREE.MeshBasicMaterial({color:linear('#7fd4ff').multiplyScalar(6),fog:true})));emitter.name='Projector emitter';emitter.position.copy(projectorSource);group.add(emitter);
      var beamUp=new THREE.Vector3(0,1,0),beamDir=new THREE.Vector3();
      function updateBeams(time){
        beamTime.value=time;
        searchlights.forEach(function(m){var p=m.userData.phase,a=time*.045+p+.35*Math.sin(time*.11+p*3.);beamDir.set(Math.sin(a)*.55,1,-.3+.2*Math.cos(a*.7+p)).normalize();m.quaternion.setFromUnitVectors(beamUp,beamDir);});
        var light=whale?whale.getLightState():null;
        if(light&&light.intensity>0){beamDir.fromArray(light.position).sub(projectorSource);var len=beamDir.length();beamDir.normalize();projector.visible=atmosphereEnabled;projector.quaternion.setFromUnitVectors(beamUp,beamDir);projector.scale.set(9*1.8,len*1.05,9*1.8);}else projector.visible=false;
      }
      // Corporate identities: AXL and Prism keep their landmark crowns; Vectra and
      // the three new tenants take the most visible mid-distance crowns.
      function frontAt(x,y,z0,halfW){var f=-1e9;towers.concat(structure,ribs).forEach(function(t){if(t.rotation)return;if(Math.abs(x-t.x)<t.w/2+halfW&&Math.abs(y-t.y)<t.h/2+1&&Math.abs(z0-t.z)<t.d/2+10)f=Math.max(f,t.z+t.d/2);});return f;}
      var logoPlacements=[{logo:0,x:-30,y:30.6,z0:-94,w:14,push:1.6},{logo:1,x:18,y:34,z0:-88,w:14,gain:1.1}];
      // Tenant identities go wherever the window can genuinely see a facade:
      // every candidate face is ray-tested from the city camera against all
      // occupied volumes, then ranked by projected size.
      var eye=(options.lighting&&options.lighting.reference&&options.lighting.reference.position)||[.75,1.35,-1.075];
      function hits(t,a,b){var t0=0,t1=1,c=[t.x,t.y,t.z],s=[t.w/2,t.h/2,t.d/2];for(var i=0;i<3;i++){var d=b[i]-a[i];if(Math.abs(d)<1e-6){if(Math.abs(a[i]-c[i])>s[i])return false;continue;}var u=(c[i]-s[i]-a[i])/d,v=(c[i]+s[i]-a[i])/d;if(u>v){var k=u;u=v;v=k;}t0=Math.max(t0,u);t1=Math.min(t1,v);if(t0>t1)return false;}return t1>0&&t0<.985;}
      function seen(x,y,z){for(var i=0;i<towers.length;i++)if(hits(towers[i],eye,[x,y,z]))return false;return true;}
      var crowns=[];
      towers.forEach(function(t){
        if(t.shape==='round'||t.w<9||t.z>-45||t.z<-300||Math.abs(t.x)>-t.z*.85)return;
        if(Math.hypot(t.x+30,t.z+93)<16||Math.hypot(t.x-22,t.z+88)<16)return;
        var w=Math.min(Math.max(t.w*.9,11),22),h=w/4,z=t.z+t.d/2+3,top=t.y+t.h/2,low=t.y-t.h/2;
        for(var y=Math.min(top-h/2-1.5,38);y>Math.max(low+h,-26);y-=3){
          if(seen(t.x,y,z)&&(seen(t.x-w*.4,y,z)||seen(t.x+w*.4,y,z))){var dist=Math.hypot(t.x-eye[0],y-eye[1],z-eye[2]);crowns.push({x:t.x,z:t.z,logoY:y,logoW:w,score:w/dist});return;}
        }
        // No clear facade: a rooftop sign on legs, if the crown is the top volume.
        var ry=top+h/2+1.4;if(ry<40&&towers.every(function(o){return o===t||Math.abs(o.x-t.x)>t.w/2||Math.abs(o.z-t.z)>t.d/2||o.y-o.h/2>top+.5||o.y+o.h/2<=top+.5;})&&seen(t.x,ry,t.z+t.d*.2)&&seen(t.x-w*.4,ry,t.z+t.d*.2)){var dr=Math.hypot(t.x-eye[0],ry-eye[1],t.z-eye[2]);crowns.push({x:t.x,z:t.z+t.d*.2,logoY:ry,logoW:w,rooftop:true,score:w/dr*.9});}
      });
      crowns.sort(function(a,b){return b.score-a.score;});
      var chosen=[];crowns.forEach(function(t){if(chosen.length<6&&chosen.every(function(o){return Math.abs(o.x-t.x)>20||Math.abs(o.z-t.z)>20;}))chosen.push(t);});
      [2,3,4,5,0,1].forEach(function(logo,i){var t=chosen[i];if(!t)return;logoPlacements.push({logo:logo,x:t.x,y:t.logoY,z0:t.z,w:t.logoW,rooftop:!!t.rooftop,worn:i>3?1:0,gain:i>3?.8:1});});
      logoPlacements.forEach(function(p){if(p.rooftop){p.z=p.z0;return;}var f=frontAt(p.x,p.y,p.z0,p.w/2);p.z=(f>-1e8?f:p.z0+8)+.9+(p.push||0);});
      var signage=window.PenthouseSignage?window.PenthouseSignage.create(THREE,{towers:towers,lite:lite,exclusions:logoPlacements}):null;
      if(signage)group.add(signage.group);
      var corporate=window.PenthouseCorporate?window.PenthouseCorporate.create(THREE,{placements:logoPlacements,lite:lite}):null;
      if(corporate){group.add(corporate.group);logoUniforms.uLogoPos.value=corporate.uniforms.uLogoPos.value;logoUniforms.uLogoColor.value=corporate.uniforms.uLogoColor.value;}

      var exteriorTarget=null,exteriorCamera=null,exteriorPMREM=null;
      function refreshReflections(renderer,scene,excluded){
        if(!exteriorTarget){
          var hdr=renderer.capabilities.isWebGL2&&renderer.extensions.has('EXT_color_buffer_float');
          exteriorTarget=new THREE.WebGLCubeRenderTarget(lite?64:128,{format:THREE.RGBAFormat,type:hdr?THREE.HalfFloatType:THREE.UnsignedByteType,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});
          exteriorTarget.texture.encoding=THREE.LinearEncoding;exteriorCamera=new THREE.CubeCamera(1,4000,exteriorTarget);exteriorCamera.position.set(0,32,-232);
        }
        var hidden=(excluded||[]).concat([traffic.group]).filter(Boolean),states=hidden.map(function(o){return o.visible;});hidden.forEach(function(o){o.visible=false;});
        facadeUniforms.uExterior.value=null;facadeUniforms.uExteriorReady.value=0;
        try{exteriorCamera.update(renderer,scene);}
        finally{hidden.forEach(function(o,i){o.visible=states[i];});}
        facadeUniforms.uExterior.value=exteriorTarget.texture;facadeUniforms.uExteriorReady.value=1;
        var generator=new THREE.PMREMGenerator(renderer),next=generator.fromCubemap(exteriorTarget.texture);generator.dispose();
        [structureMaterial,ribMaterial].forEach(function(m){m.envMap=next.texture;m.needsUpdate=true;});
if(exteriorPMREM)exteriorPMREM.dispose();exteriorPMREM=next;
      }
      function updateWhale(time){
        if(!whale)return;whale.update(time);var light=whale.getLightState();if(!light){hologramUniforms.uHoloIntensity.value=0;return;}
        hologramUniforms.uHoloPosition.value.fromArray(light.position);hologramUniforms.uHoloAxis.value.fromArray(light.axis);
        hologramUniforms.uHoloColor.value.fromArray(light.color);hologramUniforms.uHoloRadius.value=light.radius;
        hologramUniforms.uHoloLength.value=light.halfLength;hologramUniforms.uHoloIntensity.value=light.intensity;
        localMist.position.z=light.position[2]+1;
      }
      return {
        group: group,
        setCarModel: setCarModel,
        setWhaleModel:function(gltf){if(whale){whale.load(gltf);updateWhale(0);}},
        isLightningActive:function(){return !!(lightning&&lightning.group.visible);},
        getLightningIntensity:function(){return stormUniforms.uLightning.value;},
        getHologramLight:function(){return whale?whale.getLightState():null;},
        refreshReflections:refreshReflections,
        setAtmosphere:function(enabled){atmosphereEnabled=!!enabled;group.children.forEach(function(o){if(/^(Rain-softened atmosphere|Practical-light scattering|Rooftop searchlight shaft|Hologram projector column)/i.test(o.name))o.visible=enabled;});},
        loadLighting: loadLighting,
        getStats: function(){return {lightning:lightning?lightning.getStats():null,architecture:architectureStats,shadows:cityShadows.stats,towerVolumes:towers.length,facadeFins:ribs.length,architecturalDetails:structure.length,windowReveals:reveals.length,parallaxInteriors:true,billboards:cityLighting?cityLighting.getStats().mediaPanels:0,localLightProxies:cityLighting?cityLighting.getStats().localLightProxies:0,companyMarks:corporate?corporate.getStats().identities:0,orbitalRings:0,signage:signage?signage.getStats():null,corporate:corporate?corporate.getStats():null,obstructionLights:beacons.length,lightShafts:searchlights.length+1,whale:whale?whale.getStats():null,...traffic.getStats()};},
        update: function (elapsedSeconds,motionEnabled) { if(lightning)lightning.update(elapsedSeconds,atmosphereEnabled&&(motionEnabled===undefined?!options.reducedMotion:motionEnabled));updateWhale(elapsedSeconds);if(cityLighting)cityLighting.update(elapsedSeconds);skyUniforms.uTime.value=elapsedSeconds;hazeMaterial.uniforms.uTime.value=elapsedSeconds;localMistMaterial.uniforms.uTime.value=elapsedSeconds;animateCars(elapsedSeconds);beaconMaterial.uniforms.uTime.value=elapsedSeconds;updateBeams(elapsedSeconds);if(signage)signage.update(elapsedSeconds);if(corporate)corporate.update(elapsedSeconds); },
        setMood: function (name) {
          var mood=colors[name]||colors.night,night=name==='night';
          setLinear(skyUniforms.uTop.value,mood.top);setLinear(skyUniforms.uHorizon.value,mood.horizon);setLinear(skyUniforms.uBottom.value,mood.bottom);
          setLinear(facadeUniforms.uBuilding.value,mood.building);setLinear(facadeUniforms.uWindow.value,mood.window);setLinear(facadeUniforms.uCool.value,mood.cool);facadeUniforms.uNight.value=night?1:0;
          setLinear(structureMaterial.color,night?'#b0b7bc':'#d0c5b2');setLinear(ribMaterial.color,night?'#a1adb6':'#c4c5bd');
          setLinear(hazeMaterial.uniforms.uHazeColor.value,night?'#365265':'#697976');hazeMaterial.uniforms.uDensity.value=night?1.12:.78;
          atmosUniforms.uGlowStrength.value=night?.08:.03;skyUniforms.uPollution.value=night?1:.35;if(signage)signage.setMood(name);if(corporate)corporate.setMood(name);
        },
        dispose: function () { if(lightning)lightning.dispose();if(corporate)corporate.dispose();if(signage)signage.dispose();if(whale)whale.dispose();if(cityLighting)cityLighting.dispose();if(exteriorTarget)exteriorTarget.dispose();if(exteriorPMREM)exteriorPMREM.dispose();traffic.dispose();geometries.forEach(function(g){g.dispose();});materials.forEach(function(m){m.dispose();});textures.forEach(function(t){t.dispose();});group.clear(); }
      };
    }
  };
}());
