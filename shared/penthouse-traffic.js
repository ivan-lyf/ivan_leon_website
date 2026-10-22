/* Reference-recreated Blender spinners on banked, collision-cleared aerial routes. */
(function () {
  'use strict';
  window.PenthouseTraffic = {
    create: function (T, options) {
      options = options || {};
      var group = new T.Group(); group.name = 'Aerial lanes, orbital traffic and pursuit pairs';
      var geometries = [], materials = [], parts = [], cars = [], routes = [];
      var count = options.lite ? 14 : 24, lastTime = 0, modelLoaded = false;
      var obstacles = options.obstacles || [];
      function geometry(g) { geometries.push(g); return g; }
      function material(m) { materials.push(m); return m; }
      function color(hex) { return new T.Color(hex).convertSRGBToLinear(); }
      function wrap(t) { return (t % 1 + 1) % 1; }
      function route(points) {
        var raw = new T.CatmullRomCurve3(points.map(function(p){return new T.Vector3(p[0],p[1],p[2]);}), true, 'centripetal');
        // Build a circular upper envelope of every clearance constraint. A finite
        // neighborhood can end abruptly; propagating around the full loop avoids
        // the near-vertical climbs it produced at the edge of a tall obstruction.
        var samples=[],heights=[],steps=[],sampleCount=320,maxGrade=.18;
        for(var i=0;i<sampleCount;i++){
          var p=raw.getPointAt(i/sampleCount),height=p.y;
          obstacles.forEach(function(b){
            if(Math.abs(p.x-b.x)<b.w/2+4.5 && Math.abs(p.z-b.z)<b.d/2+4.5)height=Math.max(height,b.y+b.h/2+6.0);
          });
          // Lanes that cross in plan receive grade-separated altitudes. This is
          // route geometry, so clearance does not depend on a particular phase.
          routes.forEach(function(earlier){
            earlier.clearanceSamples.forEach(function(q){
              var dx=p.x-q.x,dz=p.z-q.z;
              if(dx*dx+dz*dz<81)height=Math.max(height,q.y+9);
            });
          });
          samples.push(p);heights.push(height);
        }
        for(var j=0;j<sampleCount;j++){
          var previous=samples[(j+sampleCount-1)%sampleCount];
          steps[j]=Math.hypot(samples[j].x-previous.x,samples[j].z-previous.z);
        }
        // Two directions and a second circuit propagate any high point through
        // the wrap. The bound is meters of climb per meter of horizontal travel.
        for(var pass=0;pass<3;pass++){
          for(var f=0;f<sampleCount;f++)heights[f]=Math.max(heights[f],heights[(f+sampleCount-1)%sampleCount]-maxGrade*steps[f]);
          for(var r=sampleCount-1;r>=0;r--)heights[r]=Math.max(heights[r],heights[(r+1)%sampleCount]-maxGrade*steps[(r+1)%sampleCount]);
        }
        // Rounding low corners upward preserves every required clearance.
        for(var soften=0;soften<24;soften++){
          var rounded=heights.slice();
          for(var h=0;h<sampleCount;h++)rounded[h]=Math.max(heights[h],(heights[(h+sampleCount-1)%sampleCount]+2*heights[h]+heights[(h+1)%sampleCount])*.25);
          heights=rounded;
        }
        samples.forEach(function(p,index){p.y=heights[index];});
        var curve=new T.CatmullRomCurve3(samples,true,'centripetal');curve.arcLengthDivisions=1280;
        var clearanceSamples=[];for(var c=0;c<640;c++)clearanceSamples.push(curve.getPointAt(c/640));
        routes.push({curve:curve,length:curve.getLength(),clearanceSamples:clearanceSamples});return routes.length-1;
      }
      function orbit(cx,cz,rx,rz,y,phase) {
        var p=[];for(var i=0;i<16;i++){var a=i/16*Math.PI*2;p.push([cx+Math.cos(a)*rx,y+Math.sin(a+(phase||0))*4,cz+Math.sin(a)*rz]);}return route(p);
      }
      // Two near routes pass in front of the city; the others circle actual landmarks.
      route([[-105,5,-36],[-55,8,-26],[-16,12,-39],[30,6,-27],[82,3,-42],[109,10,-50],[116,15,-70],[92,19,-82],[48,19,-64],[0,8,-61],[-49,2,-59],[-102,1,-55]]);
      route([[-129,24,-70],[-90,18,-48],[-49,18,-38],[-10,24,-50],[41,27,-43],[112,31,-65],[119,34,-109],[73,33,-124],[4,35,-129],[-62,32,-122],[-121,28,-103]]);
      orbit(-30,-93,28,25,25,.4);
      orbit(22,-88,31,29,38,2.3);
      orbit(-82,-165,36,33,64,1.1);
      orbit(100,-190,38,35,67,3.4);
      route([[-188,49,-216],[-103,55,-241],[10,64,-254],[137,63,-242],[194,47,-205],[145,48,-154],[61,43,-142],[-42,53,-150],[-142,44,-168]]);
      for(var i=0;i<count;i++)cars.push({route:i%routes.length,phase:0,speed:0,scale:.80+(i%5)*.055,police:false});
      // Two close pairs share the same arc-length clock. Other cars occupy
      // evenly spaced clusters at the same route speed, so nobody overtakes.
      cars[0]={route:0,phase:0,speed:10.8,scale:1.04,police:false};
      cars[1]={route:0,phase:0,speed:10.8,scale:1.04,police:true};
      cars[2]={route:2,phase:0,speed:8.4,scale:1,police:false};
      cars[3]={route:2,phase:0,speed:8.4,scale:1,police:true};
      routes.forEach(function(r,index){
        var members=[];cars.forEach(function(car,carIndex){if(car.route===index)members.push(carIndex);});
        var speed=index===0?10.8:index===2?8.4:5.6+index*.37;
        members.forEach(function(carIndex){cars[carIndex].speed=speed;});
        var leader=index===0?0:index===2?2:null,anchor=index===0?.27:index===2?.57:wrap(index*.173);
        if(leader!==null){
          var follower=leader+1,normal=members.filter(function(id){return id!==leader&&id!==follower;});
          cars[leader].phase=anchor;cars[follower].phase=wrap(anchor-(index===0?11:9)/r.length);
          normal.forEach(function(id,j){cars[id].phase=wrap(anchor+(j+1)/(normal.length+1));});
        }else members.forEach(function(id,j){cars[id].phase=wrap(anchor+j/members.length);});
      });
      var matrix=new T.Matrix4(),rotation=new T.Quaternion(),bankRotation=new T.Quaternion();
      var pos=new T.Vector3(),tangent=new T.Vector3(),ahead=new T.Vector3(),up=new T.Vector3(),side=new T.Vector3(),partPos=new T.Vector3(),partScale=new T.Vector3();
      var yAxis=new T.Vector3(0,1,0),xAxis=new T.Vector3(1,0,0),basis=new T.Matrix4();
      var headingBack=new T.Vector3(),headingFront=new T.Vector3(),nextBack=new T.Vector3(),nextFront=new T.Vector3();
      function addPart(g,m,offset,scale,name) {
        var mesh=new T.InstancedMesh(g,m,count);mesh.name=name;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
        group.add(mesh);parts.push({mesh:mesh,offset:offset||[0,0,0],scale:scale||[1,1,1]});return mesh;
      }
      var fallback=material(new T.MeshStandardMaterial({color:color('#566c7c'),metalness:.7,roughness:.25}));
      addPart(geometry(new T.BoxGeometry(4.4,.6,1.9)),fallback,[0,0,0],[1,1,1],'Traffic loading proxy');
      var headOffsets=[[2.22,-.29,-.83],[2.22,-.29,.83]],tailOffsets=[[-2.14,-.22,-.49],[-2.14,-.22,.49]];
      // Lamp mounts and directions stay fixed; reuse them for every frame.
      var navOffsets=[[1.68,-.31,-1.11],[1.68,-.31,1.11]],navDirections=[[.25,.05,-1],[.25,.05,1]];
      var strobeOffset=[-.97,.75,0],upDirection=[0,1,0],downDirection=[0,-1,0],lampSides=[-1,1];
      var liftOffsets=[[-1.5,-.82,-.58],[-1.5,-.82,.58]],policeOffsets=[[-.85,.68,-.3],[-.85,.68,.3]];
      // Four driving lamps, two position lights, a roof strobe and two lift accents.
      // The two pursuit vehicles additionally contribute two police roof lamps each.
      var lampsPerCar=9,lightCount=count*lampsPerCar+4,lightPositions=new Float32Array(lightCount*3),lightDirections=new Float32Array(lightCount*3),lightColors=new Float32Array(lightCount*3),lightSizes=new Float32Array(lightCount),lightStrengths=new Float32Array(lightCount);
      var lightGeometry=geometry(new T.BufferGeometry());
      [['position',lightPositions,3],['aDirection',lightDirections,3],['aColor',lightColors,3],['aSize',lightSizes,1],['aStrength',lightStrengths,1]].forEach(function(a){lightGeometry.setAttribute(a[0],new T.BufferAttribute(a[1],a[2]).setUsage(T.DynamicDrawUsage));});
      var lightAttributes=Object.keys(lightGeometry.attributes).map(function(key){return lightGeometry.attributes[key];});
      var glowMaterial=material(new T.ShaderMaterial({
        uniforms:{uViewportHeight:{value:800}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,fog:false,
        vertexShader:[
          'attribute vec3 aDirection,aColor;attribute float aSize,aStrength;uniform float uViewportHeight;varying vec3 vColor;varying float vStrength;',
          'void main(){vec4 world=modelMatrix*vec4(position,1.);vec4 mv=viewMatrix*world;vec3 forward=normalize(mat3(modelMatrix)*aDirection);',
          'float facing=max(dot(forward,normalize(cameraPosition-world.xyz)),0.);float direction=.16+.84*pow(facing,1.7);',
          'float scale=length(modelMatrix[0].xyz);float size=aSize*scale*projectionMatrix[1][1]*uViewportHeight*.5/max(1.,-mv.z);',
          'gl_PointSize=clamp(size,2.,54.);vColor=aColor;vStrength=aStrength*direction*exp(-max(0.,-mv.z)*.00075)*min(1.,size/2.);',
          'gl_Position=projectionMatrix*mv;}'
        ].join('\n'),
        fragmentShader:'varying vec3 vColor;varying float vStrength;void main(){vec2 p=gl_PointCoord*2.-1.;float r=length(p);if(r>1.)discard;float halo=exp(-r*r*5.8)*.22;float core=exp(-r*r*56.);gl_FragColor=vec4(vColor,(halo+core*.72)*vStrength*(1.-smoothstep(.78,1.,r)));}'
      }));
      var glows=new T.Points(lightGeometry,glowMaterial);glows.name='Directional driving lamps, position markers, strobes and lift accents';glows.frustumCulled=false;glows.renderOrder=3;group.add(glows);
      var viewport=new T.Vector4();glows.onBeforeRender=function(renderer){renderer.getCurrentViewport(viewport);glowMaterial.uniforms.uViewportHeight.value=viewport.w;};
      var beamGeometry=geometry(new T.ConeGeometry(.85,7,12,1,true));beamGeometry.rotateZ(Math.PI/2);beamGeometry.translate(3.5,0,0);
      // Raster interpolation can put a cone-edge UV just below zero. A fractional
      // power then emits NaN, which HDR bloom spreads into a black rectangle.
      var beamMaterial=material(new T.ShaderMaterial({
        transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,
        vertexShader:'varying vec2 vUv;varying vec3 vNormal,vWorld;void main(){vUv=uv;vec4 world=modelMatrix*instanceMatrix*vec4(position,1.);vWorld=world.xyz;vNormal=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*world;}',
        fragmentShader:'varying vec2 vUv;varying vec3 vNormal,vWorld;void main(){float face=abs(dot(normalize(vNormal),normalize(cameraPosition-vWorld)));float alpha=pow(clamp(vUv.y,0.,1.),1.8)*pow(face,.7)*.029;gl_FragColor=vec4(.48,.69,.83,alpha);}'
      }));
      var beams=new T.InstancedMesh(beamGeometry,beamMaterial,count*2);beams.name='Headlamp scatter in rainy air';beams.frustumCulled=false;beams.instanceMatrix.setUsage(T.DynamicDrawUsage);group.add(beams);
      var policeBar=new T.InstancedMesh(geometry(new T.BoxGeometry(.38,.10,.29)),material(new T.MeshBasicMaterial({color:0xffffff,toneMapped:false})),4);
      policeBar.name='Pursuit vehicle roof lights';policeBar.frustumCulled=false;policeBar.instanceMatrix.setUsage(T.DynamicDrawUsage);group.add(policeBar);
      var warm=color('#fff0c3').multiplyScalar(1.9),red=color('#ff263d').multiplyScalar(2.5),blue=color('#439aff').multiplyScalar(2.3);
      var navRed=color('#ff5141').multiplyScalar(1.3),navGreen=color('#5aff9b').multiplyScalar(1.2),strobeWhite=color('#e9f7ff').multiplyScalar(1.5),liftCyan=color('#48cfe8').multiplyScalar(.7);
      // Read-only city-space data for a renderer's optional non-shadowing light proxies.
      var leadLights=[0,2].map(function(index){return {carIndex:index,position:new T.Vector3(),direction:new T.Vector3(),color:warm.clone(),range:7};});
      var forward=new T.Vector3(),lightPos=new T.Vector3(),policeColor=new T.Color(),lightIndex=0,policeIndex=0;
      function lamp(offset,direction,c,size,strength,car){
        lightPos.fromArray(offset).multiplyScalar(car.scale).applyQuaternion(rotation).add(pos);
        if(Array.isArray(direction))forward.fromArray(direction).normalize();else forward.copy(xAxis).multiplyScalar(direction);
        forward.applyQuaternion(rotation);
        var attributeOffset=lightIndex*3;
        lightPos.toArray(lightPositions,attributeOffset);forward.toArray(lightDirections,attributeOffset);c.toArray(lightColors,attributeOffset);lightSizes[lightIndex]=size*car.scale;lightStrengths[lightIndex]=strength;lightIndex++;
      }
      function update(time) {
        lastTime=time;lightIndex=0;policeIndex=0;
        cars.forEach(function(car,index){
          var r=routes[car.route],u=wrap(car.phase+time*car.speed/r.length);
          r.curve.getPointAt(u,pos);
          // Orient over the vehicle's physical wheelbase, rather than an almost
          // infinitesimal spline tangent that can twitch at a clearance shoulder.
          r.curve.getPointAt(wrap(u-2.4/r.length),headingBack);r.curve.getPointAt(wrap(u+2.4/r.length),headingFront);
          r.curve.getPointAt(wrap(u+.8/r.length),nextBack);r.curve.getPointAt(wrap(u+5.6/r.length),nextFront);
          tangent.subVectors(headingFront,headingBack).normalize();ahead.subVectors(nextFront,nextBack).normalize();
          side.crossVectors(tangent,yAxis).normalize();up.crossVectors(side,tangent).normalize();basis.makeBasis(tangent,up,side);rotation.setFromRotationMatrix(basis);
          var turn=Math.atan2(tangent.x*ahead.z-tangent.z*ahead.x,tangent.x*ahead.x+tangent.z*ahead.z);
          var bank=Math.atan(car.speed*car.speed*turn/(3.2*9.81));
          bankRotation.setFromAxisAngle(xAxis,T.MathUtils.clamp(bank,-.32,.32));rotation.multiply(bankRotation);
          parts.forEach(function(part){partPos.fromArray(part.offset).multiplyScalar(car.scale).applyQuaternion(rotation).add(pos);partScale.fromArray(part.scale).multiplyScalar(car.scale);matrix.compose(partPos,rotation,partScale);part.mesh.setMatrixAt(index,matrix);});
          headOffsets.forEach(function(offset,sideIndex){
            lamp(offset,1,warm,2.8,1.5,car);partPos.fromArray(offset).multiplyScalar(car.scale).applyQuaternion(rotation).add(pos);partScale.setScalar(car.scale);matrix.compose(partPos,rotation,partScale);beams.setMatrixAt(index*2+sideIndex,matrix);
          });
          tailOffsets.forEach(function(offset){lamp(offset,-1,red,2.15,1.4,car);});
          // Port/starboard markers sit on the split pod shoulders and face outward.
          lamp(navOffsets[0],navDirections[0],navRed,.95,.82,car);
          lamp(navOffsets[1],navDirections[1],navGreen,.95,.82,car);
          // One short, staggered roof flash every 4.8 s; no continuous sparkle.
          var strobeAge=wrap(time/4.8+index*.371)*4.8;
          var strobe=Math.min(1,strobeAge/.012)*Math.max(0,Math.min(1,(.11-strobeAge)/.045));
          lamp(strobeOffset,upDirection,strobeWhite,1.15,strobe*.85,car);
          lampSides.forEach(function(sign,sideIndex){lamp(liftOffsets[sideIndex],downDirection,liftCyan,.72,.40,car);});
          if(index===0||index===2){
            var lead=leadLights[index/2];lead.position.set(2.22,-.29,0).multiplyScalar(car.scale).applyQuaternion(rotation).add(pos);
            lead.direction.copy(xAxis).applyQuaternion(rotation);lead.range=7*car.scale;
          }
          if(car.police)lampSides.forEach(function(sign,sideIndex){
            var pulse=.2+.8*Math.pow(.5+.5*Math.sin(time*4.6+(sign<0?0:Math.PI)),3),c=sign<0?red:blue,offset=policeOffsets[sideIndex];
            lamp(offset,sign,c,2.8,pulse*1.85,car);
            partPos.fromArray(offset).multiplyScalar(car.scale).applyQuaternion(rotation).add(pos);partScale.setScalar(car.scale);matrix.compose(partPos,rotation,partScale);policeBar.setMatrixAt(policeIndex,matrix);policeBar.setColorAt(policeIndex,policeColor.copy(c).multiplyScalar(pulse));policeIndex++;
          });
        });
        parts.forEach(function(part){part.mesh.instanceMatrix.needsUpdate=true;});beams.instanceMatrix.needsUpdate=true;policeBar.instanceMatrix.needsUpdate=true;policeBar.instanceColor.needsUpdate=true;
        lightGeometry.setDrawRange(0,lightIndex);
        lightAttributes.forEach(function(attribute){attribute.needsUpdate=true;});
      }
      function setModel(model) {
        if(!model)return;model.updateMatrixWorld(true);
        var bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3()),normalization=4.4/Math.max(size.x,.001);
        parts.forEach(function(part){group.remove(part.mesh);});parts=[];
        model.traverse(function(node){
          if(!node.isMesh||!node.geometry)return;
          var g=geometry(node.geometry.clone());g.applyMatrix4(node.matrixWorld);g.translate(-center.x,-center.y,-center.z);g.scale(normalization,normalization,normalization);
          var list=Array.isArray(node.material)?node.material:[node.material];
          var mats=list.map(function(source){
            var m=material(source.clone());if('envMapIntensity'in m)m.envMapIntensity=.9;
            if(m.emissive){if(/Warm.headlights/i.test(source.name))m.emissiveIntensity=8;else if(/Rear.navigation.lights/i.test(source.name))m.emissiveIntensity=7;else if(/Cool.running.lights/i.test(source.name))m.emissiveIntensity=4;}
            return m;
          });
          addPart(g,Array.isArray(node.material)?mats:mats[0],null,null,'Blender spinner — '+node.name);
        });
        modelLoaded=true;update(lastTime);
      }
      update(0);
      return {group:group,update:update,setModel:setModel,getLightSources:function(){return leadLights;},getStats:function(){return{flyingCars:count,blenderCarLoaded:modelLoaded,curvedRoutes:routes.length,policeChases:2,vehicleLampCapacity:lightCount,activeVehicleLamps:lightIndex};},
        dispose:function(){geometries.forEach(function(g){g.dispose();});materials.forEach(function(m){m.dispose();});group.clear();}};
    }
  };
}());
