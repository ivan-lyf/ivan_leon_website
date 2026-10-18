/* Leon's original sky penthouse. Native Three.js; profile/desktop content stays in mac.js. */
(function () {
  'use strict';
  const T = window.THREE;
  const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = reducedQuery.matches;
  const lite = innerWidth < 700 || (navigator.hardwareConcurrency || 8) <= 4;
  let scene, camera, renderer, controls, city, weather, composer, bloomPass, outputPass, fxaaPass, floorReflection, screenTexture;
  let roomModel, workstation, probeTarget, probeCamera, probeMap, probeDirty=false, hdrEnabled=false;
  let frame = 0, lastFrame = 0, flight = null, inComputer = false, ready = false;
  let lightOn = true, mood = 'night', moving = !reduced, modelLoaded = false, modelMetrics = null;
  const ceilingLights = [], ceilingDiffusers = [], bounceMaterials = [], keyboardMeshes = [];
  let keyboardOutline, keyboardHovered = false, keyboardFlashUntil = 0;
  let currentView = 'room', lastFocus, oldPose, screenDirty = true, refreshing = false;
  let screenBounds, computerBlend = 0, backdropBlend = 0, computerAlignment = 0;
  let textureTimer, elapsed = 0, disposed = false;
  const clock = new T.Clock();
  const cleanups = [], lights = {};
  const pointer = new T.Vector2(), raycaster = new T.Raycaster();
  const screenHost = document.getElementById('screen-host');
  const screenElement = document.getElementById('screen');
  const root = document.documentElement;
  const computerBackdrop = document.getElementById('computer-backdrop');
  const roomBack = document.getElementById('room-back');
  const roomChrome = ['room-header','room-footer'].map(id=>document.getElementById(id));
  const presets = {
    room: { position: [9.7, 6.8, 16.4], target: [-3.5, 4.9, -5.5] },
    desk: { position: [.8, 5.4, 7.6], target: [-3.2, 3.4, -.3] },
    city: { position: [3, 5.4, -4.3], target: [0, 5.8, -33] },
    computer: { position: [-4.3, 5.05, 4.2], target: [-4.3, 5.05, .25] }
  };
  function on(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    cleanups.push(() => target.removeEventListener(event, handler, options));
  }
  function hotspot(object, name, action, kind) {
    object.traverse(node => { if(node.isMesh) node.userData.hotspot = {name,action,kind}; });
  }
  function buildKeyboardOutline() {
    // Use the authored case silhouette, without tracing all the individual keys.
    const casing=keyboardMeshes.find(node=>node.name==='KEYBOARD_case')||keyboardMeshes.reduce((largest,node)=>{
      node.geometry.computeBoundingBox();const size=node.geometry.boundingBox.getSize(new T.Vector3());
      return !largest||size.x*size.z>largest.area?{node,area:size.x*size.z}:largest;
    },null)?.node;
    if(!casing)return;
    const material=new T.ShaderMaterial({
      uniforms:{viewport:{value:new T.Vector2(innerWidth,innerHeight)},opacity:{value:1}},
      vertexShader:`uniform vec2 viewport;
        void main(){
          vec4 clip=projectionMatrix*modelViewMatrix*vec4(position,1.);
          vec2 direction=(projectionMatrix*vec4(normalize(normalMatrix*normal),0.)).xy;
          // Keep the white contour two CSS pixels wide at both room and desk distances.
          clip.xy+=direction/max(length(direction),.0001)*4./viewport*clip.w;
          gl_Position=clip;
        }`,
      fragmentShader:'uniform float opacity;void main(){gl_FragColor=vec4(vec3(1.),opacity);}',
      side:T.BackSide,depthTest:true,depthWrite:false,transparent:true,toneMapped:false
    });
    keyboardOutline=new T.Mesh(casing.geometry,material);keyboardOutline.name='Keyboard hover outline';
    keyboardOutline.visible=false;keyboardOutline.frustumCulled=false;keyboardOutline.renderOrder=8;
    keyboardOutline.raycast=()=>{};
    // Interaction hints should not be baked into reflection captures.
    keyboardOutline.onBeforeRender=(_renderer,_scene,viewCamera)=>{material.uniforms.opacity.value=viewCamera===camera?1:0;};
    casing.add(keyboardOutline);
  }
  function setKeyboardHover(hovered) {
    keyboardHovered=hovered;
    if(keyboardOutline)keyboardOutline.visible=hovered||performance.now()<keyboardFlashUntil;
  }
  function clearKeyboardFeedback() {
    keyboardFlashUntil=0;setKeyboardHover(false);
    document.getElementById('room-tooltip')?.classList.remove('visible');
    if(renderer)renderer.domElement.style.cursor='grab';
  }
  function pressKeyboard() {
    if(!ready||inComputer||flight?.computer)return;
    keyboardFlashUntil=performance.now()+350;
    if(keyboardOutline)keyboardOutline.visible=true;
  }
  function screenMaterial() {
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=560;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#1e2e29';ctx.fillRect(0,0,768,560);
    ctx.fillStyle='#b6cdb8';ctx.textAlign='center';ctx.font='34px Monaco,monospace';ctx.fillText('LEON MENG',384,245);
    ctx.font='19px Monaco,monospace';ctx.fillText('A space for what comes next.',384,290);
    screenTexture=new T.CanvasTexture(canvas);screenTexture.encoding=T.sRGBEncoding;
    screenTexture.flipY=false;screenTexture.minFilter=T.LinearFilter;
    return new T.MeshBasicMaterial({map:screenTexture,toneMapped:false});
  }
  function buildFloorReflection() {
    if(!T.Reflector)return;
    // Polished stone reflects the ceiling and skyline while retaining its surface texture.
    const shader={
      uniforms:{color:{value:null},tDiffuse:{value:null},textureMatrix:{value:null},reflectionOpacity:{value:.44}},
      vertexShader:T.Reflector.ReflectorShader.vertexShader,
      fragmentShader:`uniform vec3 color; uniform sampler2D tDiffuse; uniform float reflectionOpacity; varying vec4 vUv;
        void main() {
          vec2 uv=vUv.xy/vUv.w;
          vec3 reflected=texture2D(tDiffuse,uv).rgb*.4;
          reflected+=texture2D(tDiffuse,uv+vec2(.0011,0.)).rgb*.15;
          reflected+=texture2D(tDiffuse,uv-vec2(.0011,0.)).rgb*.15;
          reflected+=texture2D(tDiffuse,uv+vec2(0.,.0011)).rgb*.15;
          reflected+=texture2D(tDiffuse,uv-vec2(0.,.0011)).rgb*.15;
          gl_FragColor=vec4(reflected*color,reflectionOpacity);
        }`
    };
    // The plane already sits above the stone; clip bias would admit the floor
    // into its own reflection at elevated camera angles.
    floorReflection=new T.Reflector(new T.PlaneGeometry(27.8,29.8),{clipBias:0,textureWidth:lite?512:1024,textureHeight:lite?512:1024,color:0xc9d3db,shader});
    // Reflector r128 defaults to RGB byte storage; configure before its first render.
    const reflectionTarget=floorReflection.getRenderTarget();
    reflectionTarget.texture.format=T.RGBAFormat;
    reflectionTarget.texture.type=hdrEnabled?T.HalfFloatType:T.UnsignedByteType;
    reflectionTarget.texture.encoding=hdrEnabled?T.LinearEncoding:T.sRGBEncoding;
    floorReflection.name='Polished stone reflection';floorReflection.rotation.x=-Math.PI/2;floorReflection.position.set(0,.014,7);
    floorReflection.material.transparent=true;floorReflection.material.depthWrite=false;floorReflection.renderOrder=1;
    scene.add(floorReflection);
  }
  function buildCeilingLights() {
    T.RectAreaLightUniformsLib?.init();
    for(const [x,z] of [[-6.2,-2],[6.2,-2],[-6.2,10.4],[6.2,10.4]]) {
      const panel=new T.RectAreaLight(0xffe7ce,2.4,4.8,4.8);
      panel.position.set(x,12.776,z);panel.rotation.x=-Math.PI/2;scene.add(panel);ceilingLights.push(panel);
    }
    // Area lights supply the broad illumination and highlights; this low-energy source adds contact shadows.
    lights.ceilingShadow=new T.DirectionalLight(0xffe6c7,.22);lights.ceilingShadow.position.set(-.8,12.5,3.6);
    lights.ceilingShadow.target.position.set(-.8,0,2.6);lights.ceilingShadow.castShadow=!lite;
    lights.ceilingShadow.shadow.mapSize.set(2048,2048);lights.ceilingShadow.shadow.bias=-.0002;lights.ceilingShadow.shadow.normalBias=.025;
    Object.assign(lights.ceilingShadow.shadow.camera,{left:-13,right:13,top:15,bottom:-15,near:.1,far:24});
    scene.add(lights.ceilingShadow,lights.ceilingShadow.target);
    lights.cityCyan=new T.RectAreaLight(0x6fc5df,1.8,8,10);lights.cityCyan.position.set(-8,6.8,-7.6);lights.cityCyan.rotation.y=Math.PI;
    lights.cityRose=new T.RectAreaLight(0xc876b6,.95,7,9);lights.cityRose.position.set(6,7,-7.6);lights.cityRose.rotation.y=Math.PI;
    scene.add(lights.cityCyan,lights.cityRose);
  }
  async function loadPenthouse() {
    const loader=new T.GLTFLoader();
    const gltf=await new Promise((resolve,reject)=>loader.load('shared/assets/models/penthouse/penthouse-v2.glb',resolve,event=>{
      const status=document.getElementById('boot-status');if(status)status.textContent=event.total?`Opening the room… ${Math.round(event.loaded/event.total*100)}%`:'Opening the room…';
    },reject));
    if(disposed)return;
    const textureLoader=new T.TextureLoader();
    const bounceMaps=await Promise.all(['room','furniture'].map(category=>new Promise((resolve,reject)=>textureLoader.load(`shared/assets/models/penthouse/indirect-${category}.png`,texture=>{texture.flipY=false;texture.encoding=T.LinearEncoding;texture.generateMipmaps=false;texture.minFilter=T.LinearFilter;resolve(texture);},undefined,reject))));
    const model=gltf.scene;roomModel=model;model.name='Blender penthouse';model.scale.setScalar(4);scene.add(model);model.updateMatrixWorld(true);
    workstation=window.PenthouseWorkstation.create(T,{anisotropy:Math.min(8,renderer.capabilities.getMaxAnisotropy())});
    window.PenthouseWorkstation.replaceIn(T,model,workstation);
    model.updateMatrixWorld(true);
    let screen=null,meshes=0,triangles=0;
    const measured={desk:new T.Box3(),chair:new T.Box3(),computer:new T.Box3()};
    model.traverse(node=>{
      if(node.isLight){node.visible=false;return;}
      if(!node.isMesh)return;
      meshes++;triangles+=(node.geometry.index?node.geometry.index.count:node.geometry.attributes.position.count)/3*(node.isInstancedMesh?node.count:1);
      node.castShadow=true;node.receiveShadow=true;
      for(const material of [].concat(node.material)) {
        material.envMapIntensity=.55;
        if(material.aoMap){material.aoMap.generateMipmaps=false;material.aoMap.minFilter=T.LinearFilter;}
        const category=node.userData.ao_category;
        if((category==='room'||category==='furniture')&&node.geometry.attributes.uv2){
          material.lightMap=bounceMaps[category==='room'?0:1];material.lightMapIntensity=1;
          material.aoMapIntensity=.8;if(!bounceMaterials.includes(material))bounceMaterials.push(material);
        }
        for(const value of Object.values(material))if(value?.isTexture)value.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
      }
      const name=node.name;
      if(name.startsWith('GLASS_')) {
        node.castShadow=false;node.receiveShadow=false;
        node.material=new T.MeshPhysicalMaterial({color:0xc0d2cf,roughness:.08,metalness:.08,transparent:true,opacity:.025,side:T.DoubleSide,depthWrite:false,envMapIntensity:.9});
        hotspot(node,'Look out over the city',()=>goTo('city'));
      }
      if(name.startsWith('LED_DIFFUSER_')) {
        node.castShadow=false;node.material=new T.MeshStandardMaterial({color:0xffe9ce,emissive:0xffe4be,emissiveIntensity:1.55,roughness:.38});
        ceilingDiffusers.push(node);hotspot(node,'Switch the ceiling LEDs · L',toggleCeiling);
      }
      if(name.startsWith('COMPUTER_')||name.startsWith('MOUSE_'))hotspot(node,'Use the computer · C',enterComputer);
      if(name.startsWith('KEYBOARD_')){keyboardMeshes.push(node);hotspot(node,'Click to try the keys · K',pressKeyboard,'keyboard');}
      if(name.startsWith('SCREEN_SURFACE')){screen=node;node.material=screenMaterial();node.castShadow=false;hotspot(node,'Use the computer · C',enterComputer);}
      for(const kind of Object.keys(measured))if(name.startsWith(kind.toUpperCase()+'_'))measured[kind].expandByObject(node);
    });
    if(!screen)throw new Error('The room model is missing its interactive screen.');
    workstation.adoptScreen(screenTexture);
    screenBounds=new T.Box3().setFromObject(screen);
    const center=screenBounds.getCenter(new T.Vector3());
    presets.computer={position:[center.x,center.y,center.z+3.8],target:center.toArray()};
    modelMetrics={meshes,triangles:Math.round(triangles),dimensionsMeters:{}};
    for(const [kind,bounds] of Object.entries(measured))if(!bounds.isEmpty())modelMetrics.dimensionsMeters[kind]=bounds.getSize(new T.Vector3()).multiplyScalar(.25).toArray().map(v=>Math.round(v*1000)/1000);
    modelLoaded=true;buildFloorReflection();buildCeilingLights();
    const glow=new T.PointLight(0xb9d8c3,.07,2.5);glow.position.copy(center).add(new T.Vector3(0,0,.3));scene.add(glow);
  }

  function environment() {
    const env=new T.Scene();const c=document.createElement('canvas');c.width=16;c.height=128;const ctx=c.getContext('2d');const gradient=ctx.createLinearGradient(0,0,0,128);
    gradient.addColorStop(0,'#686a64');gradient.addColorStop(.42,'#c8ab83');gradient.addColorStop(.65,'#615d50');gradient.addColorStop(1,'#202829');ctx.fillStyle=gradient;ctx.fillRect(0,0,16,128);
    const tex=new T.CanvasTexture(c);tex.encoding=T.sRGBEncoding;
    env.add(new T.Mesh(new T.SphereGeometry(100,24,16),new T.MeshBasicMaterial({map:tex,side:T.BackSide})));
    const pm=new T.PMREMGenerator(renderer);const result=pm.fromScene(env,.025);scene.environment=result.texture;pm.dispose();tex.dispose();env.children[0].geometry.dispose();env.children[0].material.dispose();
    cleanups.push(()=>result.dispose());
    lights.hemi=new T.HemisphereLight(0xe6c49d,0x293c43,.32);scene.add(lights.hemi);
    lights.sun=new T.DirectionalLight(0xffc894,.68);lights.sun.position.set(35,20,-65);lights.sun.castShadow=!lite;lights.sun.shadow.mapSize.set(2048,2048);Object.assign(lights.sun.shadow.camera,{left:-24,right:24,top:20,bottom:-20,near:1,far:150});lights.sun.shadow.bias=-.0003;lights.sun.shadow.normalBias=.04;scene.add(lights.sun);
    lights.fill=new T.DirectionalLight(0xa9c9d2,.3);lights.fill.position.set(5,7,15);scene.add(lights.fill);
  }
  function resizePostprocessing() {
    if(!composer)return;
    const ratio=Math.min(devicePixelRatio,lite?1.25:1.6);
    composer.setPixelRatio(ratio);composer.setSize(innerWidth,innerHeight);
    fxaaPass?.uniforms.resolution.value.set(1/(innerWidth*ratio),1/(innerHeight*ratio));
  }
  function buildPostprocessing() {
    if(!T.EffectComposer||!T.UnrealBloomPass)return;
    const hdr=hdrEnabled;
    const target=new T.WebGLRenderTarget(innerWidth,innerHeight,{minFilter:T.LinearFilter,magFilter:T.LinearFilter,format:T.RGBAFormat,type:hdr?T.HalfFloatType:T.UnsignedByteType});
    target.texture.encoding=hdr?T.LinearEncoding:T.sRGBEncoding;
    composer=new T.EffectComposer(renderer,target);
    const renderPass=new T.RenderPass(scene,camera);
    // Scene, weather, mirrors and cube probes share the same linear HDR pipeline.
    // ACES exposure and display encoding are applied only by the output pass.
    composer.addPass(renderPass);
    bloomPass=new T.UnrealBloomPass(new T.Vector2(innerWidth,innerHeight),.22,.42,hdr?.75:.80);
    if(hdr)[bloomPass.renderTargetBright,...bloomPass.renderTargetsHorizontal,...bloomPass.renderTargetsVertical].forEach(t=>{t.texture.type=T.HalfFloatType;});
    composer.addPass(bloomPass);
    if(hdr){
      outputPass=new T.ShaderPass({
        uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:renderer.toneMappingExposure}},
        vertexShader:T.CopyShader.vertexShader,
        fragmentShader:`uniform sampler2D tDiffuse;varying vec2 vUv;
          ${T.ShaderChunk.tonemapping_pars_fragment}
          void main(){vec3 c=ACESFilmicToneMapping(texture2D(tDiffuse,vUv).rgb);
            vec3 display=mix(c*12.92,1.055*pow(max(c,0.),vec3(1./2.4))-.055,step(vec3(.0031308),c));
            gl_FragColor=vec4(display,1.);}`
      });
      outputPass.material.toneMapped=false;composer.addPass(outputPass);
    }
    if(T.FXAAShader){fxaaPass=new T.ShaderPass(T.FXAAShader);fxaaPass.material.toneMapped=false;composer.addPass(fxaaPass);}
    resizePostprocessing();
  }
  function refreshRoomProbe() {
    probeDirty=false;
    if(!roomModel)return;
    if(!probeTarget){
      probeTarget=new T.WebGLCubeRenderTarget(lite?64:128,{generateMipmaps:true,minFilter:T.LinearMipmapLinearFilter,format:T.RGBAFormat,type:hdrEnabled?T.HalfFloatType:T.UnsignedByteType,encoding:T.LinearEncoding});
      probeCamera=new T.CubeCamera(.1,4000,probeTarget);probeCamera.position.set(-1,5.2,4);
    }
    const hidden=[floorReflection,weather?.group].filter(Boolean);const states=hidden.map(o=>o.visible);
    const oldShadow=renderer.shadowMap.autoUpdate;
    try {
      hidden.forEach(o=>o.visible=false);renderer.shadowMap.autoUpdate=false;
      // Exterior materials receive their own city probe before the room captures them.
      city?.refreshReflections?.(renderer,scene,[roomModel]);
      probeCamera.update(renderer,scene);
      const pm=new T.PMREMGenerator(renderer);let next;
      try{next=pm.fromCubemap(probeTarget.texture);}finally{pm.dispose();}
      scene.environment=next.texture;probeMap?.dispose();probeMap=next;
    } finally {
      renderer.shadowMap.autoUpdate=oldShadow;hidden.forEach((o,i)=>o.visible=states[i]);
    }
  }

  function pose(name) {
    if(name==='computer')return computerPose();
    const p=presets[name];const position=new T.Vector3(...p.position),target=new T.Vector3(...p.target);
    if(innerWidth<700 && name==='room'){position.set(3.2,6.6,19);target.set(-3.7,4.5,-2);}
    return {position,target};
  }
  function selectView(name) {
    currentView=name;document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));
  }
  function smooth(t) { t=T.MathUtils.clamp(t,0,1);return t*t*(3-2*t); }
  function computerRect() {
    const margin=innerWidth<700?16:55;
    const scale=Math.max(.1,Math.min((innerWidth-margin*2)/640,(innerHeight-100)/469));
    return {x:(innerWidth-640*scale)/2,y:(innerHeight-469*scale)/2+14,w:640*scale,h:469*scale};
  }
  function computerPose() {
    if(!screenBounds){const p=presets.computer;return {position:new T.Vector3(...p.position),target:new T.Vector3(...p.target)};}
    const rect=computerRect(),size=screenBounds.getSize(new T.Vector3()),center=screenBounds.getCenter(new T.Vector3());
    // Match the physical CRT to the final desktop height, including its slight vertical offset.
    const distance=innerHeight*size.y/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2))*rect.h);
    center.y+=(rect.y+rect.h/2-innerHeight/2)*size.y/rect.h;
    center.z=screenBounds.max.z;
    return {position:center.clone().add(new T.Vector3(0,0,distance)),target:center};
  }
  function projectedScreenRect() {
    if(!screenBounds)return computerRect();
    camera.updateMatrixWorld();
    let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
    for(const x of [screenBounds.min.x,screenBounds.max.x])for(const y of [screenBounds.min.y,screenBounds.max.y]){
      const v=new T.Vector3(x,y,screenBounds.max.z).project(camera);
      if(v.z<-1||v.z>1||!Number.isFinite(v.x+v.y))return computerRect();
      const px=(v.x+1)*innerWidth/2,py=(1-v.y)*innerHeight/2;
      left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py);
    }
    return {x:left,y:top,w:right-left,h:bottom-top};
  }
  function drawComputer(rect,opacity,backdrop) {
    screenHost.style.transform=`translate3d(${rect.x}px,${rect.y}px,0) scale(${rect.w/640},${rect.h/469})`;
    screenHost.style.opacity=opacity;
    computerBackdrop.style.opacity=backdrop;
    computerBlend=opacity;backdropBlend=backdrop;
  }
  function layoutComputer() { computerAlignment=1;drawComputer(computerRect(),1,1); }
  function blendRect(from,to,t) {
    return {x:T.MathUtils.lerp(from.x,to.x,t),y:T.MathUtils.lerp(from.y,to.y,t),w:T.MathUtils.lerp(from.w,to.w,t),h:T.MathUtils.lerp(from.h,to.h,t)};
  }
  function prepareComputer() {
    controls.enabled=false;
    root.classList.add('computer-transition');
    roomChrome.forEach(el=>el.inert=true);
    screenHost.inert=true;screenHost.setAttribute('aria-hidden','true');
    document.getElementById('room-tooltip').classList.remove('visible');
    renderer.domElement.style.cursor='default';
    roomBack.focus({preventScroll:true});
  }
  function clearComputer() {
    inComputer=false;computerBlend=0;backdropBlend=0;computerAlignment=0;
    root.classList.remove('in-computer','computer-transition');
    screenHost.classList.remove('is-open');screenHost.style.cssText='';
    screenHost.inert=true;screenHost.setAttribute('aria-hidden','true');computerBackdrop.style.opacity='';
    roomChrome.forEach(el=>el.inert=false);screenDirty=true;
  }
  function restoreRoomFocus() {
    if(lastFocus?.isConnected&&lastFocus!==document.body&&!lastFocus.closest('#screen-host'))lastFocus.focus({preventScroll:true});
    else document.getElementById('view-room').focus({preventScroll:true});
  }
  function startFlight(destination,options={}) {
    clearKeyboardFeedback();
    // Flush orbit momentum only while in orbit mode: its four-unit minimum must
    // never push the close-up camera backwards during the screen handoff.
    if(controls.enabled&&!flight){const damping=controls.enableDamping;controls.enableDamping=false;controls.update();controls.enableDamping=damping;}
    controls.enabled=false;
    flight={start:performance.now(),duration:options.computer==='enter'?1450:options.computer==='exit'?1000:1250,
      from:camera.position.clone(),fromTarget:controls.target.clone(),to:destination.position,target:destination.target,...options};
    if(reduced)finishFlight();
  }
  function finishFlight() {
    if(!flight)return;
    const done=flight;flight=null;
    camera.position.copy(done.to);controls.target.copy(done.target);camera.lookAt(controls.target);
    if(done.computer==='enter'){
      inComputer=true;controls.enabled=false;root.classList.add('in-computer');root.classList.remove('computer-transition');
      screenHost.classList.add('is-open');screenHost.inert=false;screenHost.setAttribute('aria-hidden','false');layoutComputer();
    }else{
      if(done.computer==='exit'){clearComputer();restoreRoomFocus();}
      controls.enabled=true;controls.update();
    }
    done.after?.();
  }
  function goTo(name,after) {
    if(!ready||!presets[name])return;
    if(name==='computer'){enterComputer();return;}
    if(inComputer||flight?.computer){leaveComputer({ ...pose(name),view:name },after);return;}
    selectView(name);startFlight(pose(name),{after});
  }
  function enterComputer() {
    if(!ready||inComputer||flight?.computer==='enter')return;
    if(flight?.computer==='exit'){
      // Reversing keeps the current camera and overlay instead of restarting them.
      const fromBlend=computerBlend,fromBackdrop=backdropBlend,fromAlignment=computerAlignment;
      prepareComputer();selectView('computer');startFlight(computerPose(),{computer:'enter',fromBlend,fromBackdrop,fromAlignment});return;
    }
    lastFocus=document.activeElement;
    oldPose={position:camera.position.clone(),target:controls.target.clone(),view:currentView};
    screenDirty=true;refreshScreen();
    selectView('computer');startFlight(computerPose(),{computer:'enter',fromBlend:0,fromBackdrop:0,fromAlignment:0});
    if(!reduced)prepareComputer();else{roomChrome.forEach(el=>el.inert=true);roomBack.focus({preventScroll:true});}
  }
  function leaveComputer(destination,after) {
    if(flight?.computer==='exit'&&!destination)return;
    const target=destination||oldPose||{...pose('room'),view:'room'};
    const fromBlend=computerBlend,fromBackdrop=backdropBlend,fromAlignment=computerAlignment;
    inComputer=false;root.classList.remove('in-computer');screenHost.classList.remove('is-open');
    prepareComputer();screenDirty=true;refreshScreen();selectView(target.view);
    startFlight(target,{computer:'exit',fromBlend,fromBackdrop,fromAlignment,after});
  }
  function exitComputer(returnToRoom=true) {
    if(!inComputer&&!flight?.computer)return;
    if(!returnToRoom){flight=null;clearComputer();controls.enabled=true;return;}
    leaveComputer();
  }
  function updateComputerFlight(p) {
    const entering=flight.computer==='enter';
    const reveal=entering?smooth((p-.78)/.22):1-smooth(p/.24);
    const backdrop=entering?T.MathUtils.lerp(flight.fromBackdrop,1,smooth((p-.76)/.24)):flight.fromBackdrop*(1-smooth(p/.28));
    const opacity=entering?T.MathUtils.lerp(flight.fromBlend,1,reveal):flight.fromBlend*reveal;
    const alignment=entering?T.MathUtils.lerp(flight.fromAlignment,1,smooth((p-.87)/.13)):flight.fromAlignment*(1-smooth(p/.20));
    computerAlignment=alignment;
    drawComputer(blendRect(projectedScreenRect(),computerRect(),alignment),opacity,backdrop);
  }
  function toggleCeiling() {
    lightOn=!lightOn;
    ceilingLights.forEach(light=>{light.intensity=lightOn?2.4:0;});
    bounceMaterials.forEach(material=>{material.lightMapIntensity=lightOn?1:0;});
    ceilingDiffusers.forEach(mesh=>{mesh.material.emissiveIntensity=lightOn?1.55:0;mesh.material.color.set(lightOn?0xffe9ce:0x5f6261);});
    lights.ceilingShadow.intensity=lightOn?.22:0;
    probeDirty=true;
    const button=document.getElementById('ceiling-toggle');button.setAttribute('aria-pressed',String(lightOn));button.textContent='Ceiling '+(lightOn?'on':'off');
  }
  function setMood() {
    // This scene has one time of day. Keep the public method compatible with callers.
    mood='night';city.setMood('night');weather?.setMood('night');scene.fog.color.set(0x243e4b).convertSRGBToLinear();scene.fog.density=.0010;
    lights.hemi.color.set(0x779ab4);lights.hemi.intensity=.17;lights.sun.color.set(0x759ab2);lights.sun.intensity=.045;lights.fill.intensity=.2;
    lights.cityCyan.intensity=.65;lights.cityRose.intensity=.38;
    renderer.toneMappingExposure=1.08;if(outputPass)outputPass.uniforms.toneMappingExposure.value=renderer.toneMappingExposure;probeDirty=true;
  }
  function toggleMotion() {
    moving=!moving;document.getElementById('motion-toggle').setAttribute('aria-pressed',String(moving));document.getElementById('motion-toggle').textContent=moving?'Motion on':'Motion off';
  }
  function refreshScreen() {
    if(!screenTexture||!screenDirty||refreshing||inComputer||document.hidden||!window.htmlToImage)return;
    refreshing=true;screenDirty=false;
    window.htmlToImage.toCanvas(screenElement,{pixelRatio:1.25,backgroundColor:'#000',cacheBust:false,skipFonts:true}).then(c=>{if(disposed)return;const surface=document.createElement('canvas');surface.width=512;surface.height=384;const ctx=surface.getContext('2d');ctx.filter='blur(.8px)';ctx.drawImage(c,0,0,512,384);screenTexture.image=surface;screenTexture.needsUpdate=true;}).catch(()=>{screenDirty=true;}).finally(()=>{refreshing=false;});
  }
  function hit(event) {
    pointer.set(event.clientX/innerWidth*2-1,-event.clientY/innerHeight*2+1);raycaster.setFromCamera(pointer,camera);
    return raycaster.intersectObjects(scene.children.filter(child=>child!==city.group),true)[0]?.object.userData.hotspot;
  }
  function wire() {
    let down=null;const canvas=renderer.domElement,tip=document.getElementById('room-tooltip');
    function hoverAt(e) {
      if(e.pointerType==='touch'||down||inComputer||flight){setKeyboardHover(false);tip.classList.remove('visible');return;}
      const h=hit(e);setKeyboardHover(h?.kind==='keyboard');
      canvas.style.cursor=h?'pointer':'grab';tip.textContent=h?.name||'';
      tip.style.transform=`translate(${Math.min(innerWidth-220,e.clientX+16)}px,${Math.min(innerHeight-45,e.clientY+18)}px)`;
      tip.classList.toggle('visible',!!h);
    }
    on(canvas,'pointerdown',e=>{
      if(down&&e.pointerId!==down.id){down.moved=true;return;}
      if(e.button!==0||inComputer||flight?.computer){down=null;return;}
      down={x:e.clientX,y:e.clientY,id:e.pointerId,moved:false};flight=null;controls.enabled=true;
      clearKeyboardFeedback();tip.classList.remove('visible');
    });
    on(canvas,'pointerup',e=>{
      if(inComputer||flight?.computer){down=null;return;}
      const pressed=down;down=null;
      if(pressed&&e.pointerId===pressed.id&&!pressed.moved&&Math.hypot(e.clientX-pressed.x,e.clientY-pressed.y)<5){
        const h=hit(e);if(h)h.action();
      }
      hoverAt(e);
    });
    on(canvas,'pointermove',e=>{
      if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>=5)down.moved=true;
      hoverAt(e);
    });
    on(canvas,'pointerleave',()=>{down=null;clearKeyboardFeedback();tip.classList.remove('visible');canvas.style.cursor='grab';});
    on(canvas,'pointercancel',()=>{down=null;clearKeyboardFeedback();tip.classList.remove('visible');});
    on(controls,'start',()=>{clearKeyboardFeedback();tip.classList.remove('visible');});
    on(window,'blur',()=>{down=null;clearKeyboardFeedback();tip.classList.remove('visible');});
    document.querySelectorAll('[data-view]').forEach(b=>on(b,'click',()=>goTo(b.dataset.view)));
    on(document.getElementById('enter-computer'),'click',enterComputer);on(document.getElementById('room-back'),'click',()=>exitComputer());
    on(document.getElementById('ceiling-toggle'),'click',toggleCeiling);on(document.getElementById('motion-toggle'),'click',toggleMotion);
    const help=document.getElementById('room-help');on(document.getElementById('help-toggle'),'click',()=>help.showModal());on(document.getElementById('help-close'),'click',()=>help.close());
    on(window,'keydown',e=>{
      if(help.open)return;
      if(e.key==='Escape'){if(e.defaultPrevented)return;if(inComputer||flight?.computer)exitComputer();else goTo('room');return;}
      if(inComputer||flight?.computer||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.metaKey||e.ctrlKey||e.altKey)return;
      const key=e.key.toLowerCase();const actions={c:enterComputer,k:()=>{if(!e.repeat)pressKeyboard();},'1':()=>goTo('room'),'2':()=>goTo('desk'),'3':()=>goTo('city'),l:toggleCeiling,r:()=>goTo('room')};
      if(actions[key]){e.preventDefault();actions[key]();}
      if(key.startsWith('arrow')){e.preventDefault();clearKeyboardFeedback();flight=null;controls.enabled=true;const off=camera.position.clone().sub(controls.target),s=new T.Spherical().setFromVector3(off);s.theta+=key==='arrowleft'?.07:key==='arrowright'?-.07:0;s.phi+=key==='arrowup'?-.04:key==='arrowdown'?.04:0;s.phi=T.MathUtils.clamp(s.phi,controls.minPolarAngle,controls.maxPolarAngle);s.theta=T.MathUtils.clamp(s.theta,controls.minAzimuthAngle,controls.maxAzimuthAngle);camera.position.setFromSpherical(s).add(controls.target);controls.update();}
    });
    const observer=new MutationObserver(()=>{screenDirty=true;});observer.observe(screenElement,{childList:true,subtree:true,attributes:true,characterData:true});cleanups.push(()=>observer.disconnect());
    textureTimer=setInterval(refreshScreen,1800);
    on(window,'resize',()=>{clearKeyboardFeedback();keyboardOutline?.material.uniforms.viewport.value.set(innerWidth,innerHeight);weather?.resize(innerWidth,innerHeight);resizePostprocessing();camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,lite?1.3:1.6));if(inComputer)layoutComputer();else if(flight?.computer==='enter'){const p=computerPose();flight.to=p.position;flight.target=p.target;}});
    on(reducedQuery,'change',e=>{reduced=e.matches;if(reduced&&moving)toggleMotion();if(reduced)finishFlight();});
    on(document,'visibilitychange',()=>{clearKeyboardFeedback();clock.getDelta();if(!document.hidden)lastFrame=0;});
    on(canvas,'webglcontextlost',e=>{e.preventDefault();showError('The graphics connection paused. Reload to return to the room.');});
  }
  function showError(message) {
    const loading=document.getElementById('loading');loading.style.opacity='1';loading.style.display='flex';loading.innerHTML='';const panel=document.createElement('div');panel.className='term error-actions';const text=document.createElement('p');text.textContent=message;panel.append(text);const link=document.createElement('a');link.href='?as=leon&scene=desktop';link.textContent='Open the accessible desktop';panel.append(link);loading.append(panel);
  }
  function animate(now) {
    frame=requestAnimationFrame(animate);if(document.hidden||inComputer){clock.getDelta();return;}
    const budget=flight?0:1000/(lite?30:45);if(now-lastFrame<budget)return;lastFrame=now;
    const dt=Math.min(clock.getDelta(),.1);if(moving)elapsed+=dt;
    if(keyboardOutline)keyboardOutline.visible=!flight&&(keyboardHovered||now<keyboardFlashUntil);
    if(flight){
      const p=Math.min(1,(now-flight.start)/flight.duration);
      let e=flight.computer?p*p*p*(p*(p*6-15)+10):p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
      if(flight.computer){
        // A proportional distance change gives the monitor a steady apparent
        // growth rate, avoiding a rush of magnification at the end of the dolly.
        const fromDistance=flight.from.distanceTo(flight.fromTarget),toDistance=flight.to.distanceTo(flight.target);
        const ratio=toDistance/fromDistance;
        if(fromDistance>.01&&toDistance>.01&&Number.isFinite(ratio)&&Math.abs(ratio-1)>.0001)e=(1-Math.pow(ratio,e))/(1-ratio);
      }
      camera.position.lerpVectors(flight.from,flight.to,e);controls.target.lerpVectors(flight.fromTarget,flight.target,e);camera.lookAt(controls.target);
      if(flight.computer)updateComputerFlight(p);
      if(p===1)finishFlight();
    }
    if(!flight&&!inComputer){controls.update();camera.position.x=T.MathUtils.clamp(camera.position.x,-13.3,13.3);camera.position.y=T.MathUtils.clamp(camera.position.y,1.2,12.0);camera.position.z=T.MathUtils.clamp(camera.position.z,-6.8,20.5);}workstation?.update(elapsed);city.update(elapsed);const hologramLight=city.getHologramLight();weather?.setHologramLight(hologramLight?{...hologramLight,strength:hologramLight.intensity}:null);weather?.update(elapsed);if(probeDirty)refreshRoomProbe();weather?.capture(renderer,scene,camera,[floorReflection]);if(composer)composer.render(dt);else renderer.render(scene,camera);
  }
  async function init() {
    try {
      scene=new T.Scene();scene.fog=new T.FogExp2(0x9b7150,.0042);
      renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,lite?1.3:1.6));hdrEnabled=!!(T.EffectComposer&&T.RenderPass&&T.UnrealBloomPass&&T.ShaderPass&&T.CopyShader&&renderer.capabilities.isWebGL2&&renderer.extensions.has('EXT_color_buffer_float'));
      // Keep this stable before any material compiles: Three r128 does not always
      // invalidate its program cache when only the renderer tone-mapping mode changes.
      renderer.outputEncoding=hdrEnabled?T.LinearEncoding:T.sRGBEncoding;renderer.toneMapping=hdrEnabled?T.NoToneMapping:T.ACESFilmicToneMapping;renderer.toneMappingExposure=.97;renderer.shadowMap.enabled=!lite;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.domElement.id='gl';renderer.domElement.setAttribute('aria-label','Leon’s penthouse overlooking a futuristic city. Use the room controls or keyboard shortcuts to explore.');renderer.domElement.setAttribute('role','img');document.body.append(renderer.domElement);
      camera=new T.PerspectiveCamera(innerWidth<700?58:52,innerWidth/innerHeight,.1,4000);const start=pose('room');camera.position.copy(start.position);
      controls=new T.OrbitControls(camera,renderer.domElement);controls.target.copy(start.target);controls.enableDamping=true;controls.dampingFactor=.08;controls.enablePan=false;controls.minDistance=4;controls.maxDistance=32;controls.minPolarAngle=Math.PI*.34;controls.maxPolarAngle=Math.PI*.53;controls.minAzimuthAngle=-.65;controls.maxAzimuthAngle=.85;controls.rotateSpeed=.48;controls.zoomSpeed=.6;controls.update();
      environment();const lighting=await fetch('shared/assets/city-lighting.json').then(r=>{if(!r.ok)throw new Error('City lighting could not load');return r.json();});
      city=window.PenthouseCity.create(T,{lite,reducedMotion:reduced,lighting});city.group.scale.setScalar(4);scene.add(city.group);
      await Promise.all([loadPenthouse(),city.loadLighting()]);if(disposed)return;
      const [traffic,hologram]=await Promise.all(['spinner.glb','holographic-whale.glb'].map(name=>new Promise((resolve,reject)=>new T.GLTFLoader().load('shared/assets/models/city/'+name,resolve,undefined,reject))));
      if(disposed){[traffic,hologram].forEach(g=>g.scene.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}));return;}
      city.setCarModel(traffic.scene);city.setWhaleModel(hologram);
      weather=window.PenthouseWeather?.create(T,{lite});if(weather){scene.add(weather.group);weather.resize(innerWidth,innerHeight);}
      buildPostprocessing();setMood();
      // Optional review view keeps exposure fixed while isolating aerial perspective.
      if(new URLSearchParams(location.search).get('review')==='clear'){scene.fog.density=0;city.setAtmosphere(false);}
      wire();
      screenHost.inert=true;screenHost.setAttribute('aria-hidden','true');document.getElementById('motion-toggle').textContent=moving?'Motion on':'Motion off';document.getElementById('motion-toggle').setAttribute('aria-pressed',String(moving));
      ready=true;window.__sceneLoaded=true;document.getElementById('boot-status').textContent='Welcome home.';
      if(composer)composer.render(0);else renderer.render(scene,camera);frame=requestAnimationFrame(animate);setTimeout(()=>{const loading=document.getElementById('loading');loading.style.opacity='0';setTimeout(()=>loading.style.display='none',460);},350);
      on(window,'pagehide',event=>{if(!event.persisted)dispose();});
    } catch(error) { console.error('Penthouse scene failed',error);showError('This browser could not open the 3D room. Your desktop is still available.'); }
  }
  function dispose() {
    disposed=true;flight=null;clearComputer();cancelAnimationFrame(frame);clearInterval(textureTimer);cleanups.forEach(fn=>fn());
    // The workstation owns its generated resources; the live desktop texture
    // and interaction outline belong to this scene. Remove those before cleanup.
    if(workstation){keyboardOutline?.material.dispose();keyboardOutline?.parent?.remove(keyboardOutline);workstation.dispose();screenTexture?.dispose();}
    controls?.dispose();city?.dispose();weather?.dispose();bloomPass?.dispose();outputPass?.material.dispose();fxaaPass?.material.dispose();composer?.renderTarget1.dispose();composer?.renderTarget2.dispose();probeTarget?.dispose();probeMap?.dispose();floorReflection?.getRenderTarget().dispose();
    const geometries=new Set(),materials=new Set(),textures=new Set();scene?.traverse(o=>{if(o.geometry)geometries.add(o.geometry);[].concat(o.material||[]).forEach(m=>{materials.add(m);for(const value of Object.values(m)){if(value?.isTexture)textures.add(value);}});});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer?.dispose();
  }
  window.PenthouseScene={init,enterComputer,exitComputer,goTo,setMood,dispose,getStatus:()=>({ready,modelLoaded,modelMetrics,workstation:workstation?.getStats(),city:city?.getStats?.(),weather:!!weather,mood,lightOn,moving,view:currentView,inComputer,transition:flight?.computer||null,lite,drawCalls:renderer?.info.render.calls})};
})();
