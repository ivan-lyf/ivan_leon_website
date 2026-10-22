// Run: node tests/traffic-update.cjs
// Compares the real traffic update against its original allocation strategy.
// Uses the shipped Three.js and Blender spinner, with no renderer or packages.
'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..');
const T=require(path.join(root,'shared/vendor/three.min.js'));
const source=fs.readFileSync(path.join(root,'shared/penthouse-traffic.js'),'utf8');

// Restore only the allocating expressions for the control. Both executions use
// the production routes, banking, timing and model loading. Keep the original
// literal mounts here so moving a hoisted offset also fails output equivalence.
const allocatingExpressions=[
 ['var attributeOffset=lightIndex*3;\n        lightPos.toArray(lightPositions,attributeOffset);forward.toArray(lightDirections,attributeOffset);c.toArray(lightColors,attributeOffset);',
  'lightPositions.set(lightPos.toArray(),lightIndex*3);lightDirections.set(forward.toArray(),lightIndex*3);lightColors.set(c.toArray(),lightIndex*3);'],
 ['lamp(navOffsets[0],navDirections[0],navRed,.95,.82,car);','lamp([1.68,-.31,-1.11],[.25,.05,-1],navRed,.95,.82,car);'],
 ['lamp(navOffsets[1],navDirections[1],navGreen,.95,.82,car);','lamp([1.68,-.31,1.11],[.25,.05,1],navGreen,.95,.82,car);'],
 ['lamp(strobeOffset,upDirection,strobeWhite,1.15,strobe*.85,car);','lamp([-.97,.75,0],[0,1,0],strobeWhite,1.15,strobe*.85,car);'],
 ['lampSides.forEach(function(sign,sideIndex){lamp(liftOffsets[sideIndex],downDirection,liftCyan,.72,.40,car);});','[-1,1].forEach(function(sign){lamp([-1.5,-.82,sign*.58],[0,-1,0],liftCyan,.72,.40,car);});'],
 ['if(car.police)lampSides.forEach(function(sign,sideIndex){','if(car.police)[-1,1].forEach(function(sign){'],
 ['offset=policeOffsets[sideIndex];','offset=[-.85,.68,sign*.3];'],
 ['policeBar.setColorAt(policeIndex,policeColor.copy(c).multiplyScalar(pulse));','policeBar.setColorAt(policeIndex,c.clone().multiplyScalar(pulse));'],
 ['lightAttributes.forEach(function(attribute){attribute.needsUpdate=true;});','Object.keys(lightGeometry.attributes).forEach(function(key){lightGeometry.attributes[key].needsUpdate=true;});']
];
let referenceSource=source;
for(const [current,original] of allocatingExpressions){
 assert.strictEqual(referenceSource.split(current).length,2,'Update the reference expression: '+current);
 referenceSource=referenceSource.replace(current,original);
}
function loadTraffic(text){
 const context={window:{}};
 vm.runInNewContext(text,context,{filename:'penthouse-traffic.js'});
 return context.window.PenthouseTraffic;
}
const optimized=loadTraffic(source),reference=loadTraffic(referenceSource);
function loadModel(){
 const context={THREE:T,console,TextDecoder,TextEncoder,ArrayBuffer,Uint8Array,Float32Array,Int8Array,Int16Array,Uint16Array,Int32Array,Uint32Array};
 vm.runInNewContext(fs.readFileSync(path.join(root,'shared/vendor/GLTFLoader.js'),'utf8'),context);
 const bytes=fs.readFileSync(path.join(root,'shared/assets/models/city/spinner.glb'));
 return new Promise((resolve,reject)=>new T.GLTFLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'',gltf=>resolve(gltf.scene),reject));
}
// Exercise grade changes as well as clear portions of the seven production lanes.
const obstacles=[
 {x:-49,y:22,z:-38,w:16,h:44,d:18},
 {x:22,y:28,z:-88,w:20,h:56,d:22},
 {x:-82,y:38,z:-165,w:25,h:76,d:20},
 {x:100,y:42,z:-190,w:24,h:84,d:28}
];
function buffers(traffic){
 const result=[];
 traffic.group.traverse(node=>{
  for(const name of ['instanceMatrix','instanceColor'])if(node[name])result.push({name:node.name+'/'+name,attribute:node[name],array:node[name].array});
  if(node.isPoints)for(const [name,attribute] of Object.entries(node.geometry.attributes))result.push({name:node.name+'/'+name,attribute,array:attribute.array});
 });
 return result;
}
function lightData(traffic){
 return Array.from(traffic.getLightSources(),l=>[l.carIndex,l.position.x,l.position.y,l.position.z,l.direction.x,l.direction.y,l.direction.z,l.color.r,l.color.g,l.color.b,l.range]);
}
function measureUpdate(traffic,time){
 const originalVectorArray=T.Vector3.prototype.toArray,originalColorArray=T.Color.prototype.toArray,originalClone=T.Color.prototype.clone;
 const counts={temporaryArrays:0,colorClones:0};
 T.Vector3.prototype.toArray=function(array,offset){if(array===undefined)counts.temporaryArrays++;return originalVectorArray.call(this,array,offset);};
 T.Color.prototype.toArray=function(array,offset){if(array===undefined)counts.temporaryArrays++;return originalColorArray.call(this,array,offset);};
 T.Color.prototype.clone=function(){counts.colorClones++;return originalClone.call(this);};
 try{traffic.update(time);}finally{
  T.Vector3.prototype.toArray=originalVectorArray;T.Color.prototype.toArray=originalColorArray;T.Color.prototype.clone=originalClone;
 }
 return counts;
}
function assertNoTemporaryOutputs(counts){
 assert.strictEqual(counts.temporaryArrays,0,'Temporary toArray outputs in traffic update');
 assert.strictEqual(counts.colorClones,0,'Temporary police colors in traffic update');
}
const times=[0,.006,.012,.065,.109999,.11,.2,Math.PI/(2*4.6),Math.PI/4.6,3*Math.PI/(2*4.6),4.79999,4.8,4.806,13.7,87.123,359.999,1800.35,10000.125,0,0];
// Exact strobe start, full brightness and end for two staggered vehicles.
for(const index of [1,7])for(const age of [0,.012,.11])times.push((Math.ceil(index*.371)-index*.371)*4.8+age);
let comparisons=0,bytesCompared=0,identityChecks=0,versionChecks=0,baselineArrays=0,baselineClones=0;
async function main(){
 const model=await loadModel();let modelParts=0;model.traverse(node=>{if(node.isMesh)modelParts++;});
 assert.strictEqual(modelParts,9,'Expected the shipped nine-part spinner');
 for(const lite of [false,true]){
  const before=reference.create(T,{lite,obstacles}),after=optimized.create(T,{lite,obstacles});
  for(const loaded of [false,true]){
   if(loaded){before.setModel(model);after.setModel(model);}
   const originalBuffers=buffers(after),previousVersions=originalBuffers.map(b=>b.attribute.version);
   assert.strictEqual(originalBuffers.length,loaded?17:9,'All car parts, beams, roof lights and five lamp attributes are covered');
   for(const time of times){
    const label=(lite?'lite':'full')+'/'+(loaded?'Blender':'proxy')+' t='+time;
    const control=measureUpdate(before,time),current=measureUpdate(after,time);
    assert.strictEqual(control.temporaryArrays,(lite?130:220)*3,label+' baseline allocation count');
    assert.strictEqual(control.colorClones,4,label+' baseline color count');
    assert.throws(()=>assertNoTemporaryOutputs(control),/Temporary toArray outputs/,'Allocation guard must reject the original implementation');
    assertNoTemporaryOutputs(current);baselineArrays+=control.temporaryArrays;baselineClones+=control.colorClones;
    const expected=buffers(before),actual=buffers(after);
    assert.strictEqual(actual.length,expected.length,label+' buffer count');
    actual.forEach((b,i)=>{
     const a=expected[i],initial=originalBuffers[i];
     assert.strictEqual(b.name,a.name,label+' buffer order');
     assert.strictEqual(b.attribute,initial.attribute,label+' attribute identity: '+b.name);
     assert.strictEqual(b.array,initial.array,label+' typed array identity: '+b.name);identityChecks+=2;
     assert.strictEqual(b.attribute.version,previousVersions[i]+1,label+' upload version: '+b.name);previousVersions[i]=b.attribute.version;versionChecks++;
     const left=Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength),right=Buffer.from(b.array.buffer,b.array.byteOffset,b.array.byteLength);
     assert(left.equals(right),label+' changed output: '+b.name);bytesCompared+=right.byteLength;
     for(const value of b.array)assert(Number.isFinite(value),label+' finite output: '+b.name);
    });
    assert.deepStrictEqual(lightData(after),lightData(before),label+' light proxies');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(after.getStats())),JSON.parse(JSON.stringify(before.getStats())),label+' stats');
    const points=after.group.children.find(node=>node.isPoints);
    assert.strictEqual(points.geometry.drawRange.start,0,label+' draw start');
    assert.strictEqual(points.geometry.drawRange.count,lite?130:220,label+' draw count');
    comparisons++;
   }
  }
  before.dispose();after.dispose();
 }
 console.log('Traffic update: '+comparisons+' byte-identical frames; '+bytesCompared+' buffer bytes; '+identityChecks+' identity checks; '+versionChecks+' upload checks.');
 console.log('Allocation control: '+baselineArrays+' temporary toArray outputs and '+baselineClones+' color clones; optimized: 0 of either.');
 console.log('Per full/lite update: 660/390 temporary toArray outputs and 4 police color clones eliminated; fixed mount arrays also reused.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
