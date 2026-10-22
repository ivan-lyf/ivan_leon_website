/* The single-surface glass optimization applies only to this closed GLB export.
 * Run: node tests/glass-panels.cjs
 * Checks actual topology, both optical surfaces, allowed camera coverage, and
 * combined transmittance. Rendered shading remains a measured approximation.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const repo = path.resolve(__dirname, '..');
const T = require(path.join(repo, 'shared/vendor/three.min.js'));
const source = fs.readFileSync(path.join(repo, 'shared/penthouse-scene.js'), 'utf8');
const bytes = fs.readFileSync(path.join(repo, 'shared/assets/models/penthouse/penthouse-v2.glb'));
assert.equal(bytes.readUInt32LE(0), 0x46546c67);
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength));
const binaryOffset = 28 + jsonLength;
const add = (a,b) => a.map((n,i) => n+b[i]);
const sub = (a,b) => a.map((n,i) => n-b[i]);
const dot = (a,b) => a.reduce((n,v,i) => n+v*b[i],0);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length = a => Math.hypot(...a);
function accessor(index) {
  const a = gltf.accessors[index], v = gltf.bufferViews[a.bufferView];
  assert(!a.sparse && !a.normalized, 'Unexpected accessor encoding must be reviewed');
  const components = {SCALAR:1,VEC2:2,VEC3:3}[a.type];
  const types = {5126:['readFloatLE',4],5123:['readUInt16LE',2],5125:['readUInt32LE',4]};
  const [read,size] = types[a.componentType];
  const start = binaryOffset+(v.byteOffset||0)+(a.byteOffset||0);
  return Array.from({length:a.count},(_,i) => Array.from({length:components},(_,c) =>
    bytes[read](start+i*(v.byteStride||size*components)+c*size)));
}

const glassNodes = gltf.nodes.filter(n => n.name?.startsWith('GLASS_'));
assert.equal(glassNodes.length,1);
const node = glassNodes[0];
assert.equal(node.name,'GLASS_Export_7');
assert(gltf.scenes[gltf.scene].nodes.includes(gltf.nodes.indexOf(node)), 'Glass must remain a scene-root node');
assert(!node.rotation && !node.scale && !node.matrix, 'Changed glass transforms require rechecking pane/camera bounds');
const primitives = gltf.meshes[node.mesh].primitives;
assert.equal(primitives.length,1);
const primitive = primitives[0], p = accessor(primitive.attributes.POSITION);
const normals = accessor(primitive.attributes.NORMAL);
const rawIndices = accessor(primitive.indices).flat();
const triangles = Array.from({length:rawIndices.length/3},(_,i) => rawIndices.slice(i*3,i*3+3));
assert.equal(p.length,2016);
assert.equal(triangles.length,2632);

const welded = [], weldMap = new Map();
const weldIds = p.map(v => {
  const key = v.map(n => Math.round(n*1e6)).join(',');
  if (!weldMap.has(key)) { weldMap.set(key,welded.length); welded.push(v); }
  return weldMap.get(key);
});
const parent = welded.map((_,i) => i);
function root(i) { while(parent[i]!==i) { parent[i]=parent[parent[i]]; i=parent[i]; } return i; }
for(const tri of triangles) for(const i of tri.slice(1)) parent[root(weldIds[i])] = root(weldIds[tri[0]]);
const components = new Map();
for(const tri of triangles) {
  const id = root(weldIds[tri[0]]);
  if(!components.has(id))components.set(id,[]);
  components.get(id).push(tri);
}
assert.equal(components.size,14,'The optimization assumes 14 closed panes, with no bare sheets');

const scaleMatch = source.match(/model\.scale\.setScalar\(([-.\d]+)\)/);
assert(scaleMatch,'Read the actual room scale');
const scale = Number(scaleMatch[1]), panes = [];
let maxConvexExcess = 0;
for(const [id,faces] of components) {
  const uniqueIds = [...new Set(faces.flat())], vertices = uniqueIds.map(i=>p[i]);
  const min = [0,1,2].map(k=>Math.min(...vertices.map(v=>v[k])));
  const max = [0,1,2].map(k=>Math.max(...vertices.map(v=>v[k])));
  const dimensions = sub(max,min), axis = dimensions.indexOf(Math.min(...dimensions));
  assert(Math.abs(dimensions[axis]-.008)<1e-6,'Each pane must remain an 8 mm solid');
  assert(Math.abs(dimensions[1]-3.14)<1e-6);
  assert.equal(faces.length,188);
  assert.equal(new Set(faces.flat().map(i=>weldIds[i])).size,96);
  const edges = new Map(), broadAreas = [0,0], broadDepths = [[],[]];
  let area = 0, volume = 0;
  const planeFaces = [];
  for(const face of faces) {
    for(let k=0;k<3;k++) {
      const a=weldIds[face[k]],b=weldIds[face[(k+1)%3]],key=[Math.min(a,b),Math.max(a,b)].join(',');
      const edge=edges.get(key)||{count:0,winding:0};
      edge.count++;edge.winding+=a<b?1:-1;edges.set(key,edge);
    }
    const tri=face.map(i=>p[i]), c=cross(sub(tri[1],tri[0]),sub(tri[2],tri[0])), twiceArea=length(c);
    assert(twiceArea>1e-14,'No degenerate triangles');
    const normal=c.map(v=>v/twiceArea);
    area+=twiceArea/2;
    volume+=dot(sub(tri[0],min),cross(sub(tri[1],min),sub(tri[2],min)))/6;
    planeFaces.push({tri,normal});
    for(const v of vertices)maxConvexExcess=Math.max(maxConvexExcess,dot(sub(v,tri[0]),normal));
    if(Math.abs(normal[axis])>.99999) {
      const side=normal[axis]>0?1:0;
      broadAreas[side]+=twiceArea/2;
      broadDepths[side].push(...tri.map(v=>v[axis]));
      for(const vertex of face)assert(dot(normals[vertex],normal)>.99999,'Broad surfaces must have opposite, flat shading normals');
    }
  }
  for(const edge of edges.values()) {
    assert.equal(edge.count,2,'Every edge has two faces: no open or nonmanifold sheets');
    assert.equal(edge.winding,0,'Adjacent triangles must have consistent winding');
  }
  assert(volume>0,'Normals must point out of the closed volume');
  assert(Math.abs(broadAreas[0]-broadAreas[1])<1e-7,'Opposing optical surfaces have equal area');
  assert((broadAreas[0]+broadAreas[1])/area>.98);
  for(let side=0;side<2;side++) {
    assert(broadDepths[side].length>0);
    for(const depth of broadDepths[side])assert(Math.abs(depth-(side?max:min)[axis])<1e-6);
  }
  const world = v => add(v,node.translation).map(n=>n*scale);
  panes.push({id,axis,min:world(min),max:world(max),planeFaces:planeFaces.map(f=>({tri:f.tri.map(world),normal:f.normal}))});
}
assert(maxConvexExcess<1e-5,'Pane shells must remain convex within GLB export precision');
assert.equal(panes.filter(p=>p.axis===2).length,6);
assert.equal(panes.filter(p=>p.axis===0 && p.max[0]<0).length,4);
assert.equal(panes.filter(p=>p.axis===0 && p.min[0]>0).length,4);

// Read camera limits from production. Disjoint boxes prove that every permitted
// orbit position (not just sampled poses) remains outside every thin glass solid.
const cameraMin=[],cameraMax=[];
for(const axis of ['x','y','z']) {
  const match=source.match(new RegExp('camera.position.'+axis+'=T.MathUtils.clamp\\(camera.position.'+axis+',([-.\\d]+),([-.\\d]+)\\)'));
  assert(match,'Read actual '+axis+' camera bounds');
  cameraMin.push(Number(match[1]));cameraMax.push(Number(match[2]));
}
const floorMatch=source.match(/floorReflection\.position\.set\(0,([-.\d]+),7\)/);
assert(floorMatch);
const floorY=Number(floorMatch[1]);
const reflectedMin=[cameraMin[0],2*floorY-cameraMax[1],cameraMin[2]];
const reflectedMax=[cameraMax[0],2*floorY-cameraMin[1],cameraMax[2]];
for(const pane of panes)for(const [min,max] of [[cameraMin,cameraMax],[reflectedMin,reflectedMax]]) {
  assert([0,1,2].some(k=>max[k]<pane.min[k] || min[k]>pane.max[k]),'Neither actual nor reflected camera volume may enter a pane');
}
const presetMatch=source.match(/const presets = (\{[\s\S]*?\n  \});/);
assert(presetMatch);
const presets=new Function('return ('+presetMatch[1]+')')();
for(const preset of Object.values(presets))for(let k=0;k<3;k++)
  assert(preset.position[k]>=cameraMin[k] && preset.position[k]<=cameraMax[k]);

// Convex shells have an entry and exit surface. Exercise direct and reflected
// cameras against actual triangles, including off-axis and near-edge targets.
const cameras=Object.values(presets).map(p=>p.position);
for(const x of [cameraMin[0],cameraMax[0]])for(const y of [cameraMin[1],cameraMax[1]])for(const z of [cameraMin[2],cameraMax[2]])cameras.push([x,y,z]);
cameras.push(...cameras.map(p=>[p[0],2*floorY-p[1],p[2]]));
let rays=0;
for(const pane of panes)for(const origin of cameras)for(const fraction of [.05,.5,.95]) {
  const target=pane.min.map((n,k)=>n+(pane.max[k]-n)*(k===pane.axis?.5:fraction));
  const direction=sub(target,origin), hits=[];
  for(const {tri,normal} of pane.planeFaces) {
    const edge1=sub(tri[1],tri[0]),edge2=sub(tri[2],tri[0]),h=cross(direction,edge2),det=dot(edge1,h);
    if(Math.abs(det)<1e-12)continue;
    const s=sub(origin,tri[0]),u=dot(s,h)/det,q=cross(s,edge1),v=dot(direction,q)/det,t=dot(edge2,q)/det;
    if(u>=-1e-8 && v>=-1e-8 && u+v<=1+1e-8 && t>0)hits.push({t,facing:dot(normal,direction)});
  }
  hits.sort((a,b)=>a.t-b.t);
  const unique=hits.filter((hit,i)=>!i || Math.abs(hit.t-hits[i-1].t)>1e-7);
  assert.equal(unique.length,2,'Every tested glass ray crosses exactly two surfaces');
  assert(unique[0].facing<0 && unique[1].facing>0,'FrontSide retains the entry surface for each camera');
  rays++;
}

// Execute the actual production glass branch, also checking that a future
// single-sided replacement model does not silently inherit the opacity folding.
const branch=source.match(/if\(name\.startsWith\('GLASS_'\)\) \{([\s\S]*?)\n      \}/);
assert(branch);
function glassMaterial(name) {
  const node={};
  new Function('T','node','name','hotspot','goTo',branch[1])(T,node,name,()=>{},()=>{});
  return node;
}
const optimized=glassMaterial('GLASS_Export_7'), fallback=glassMaterial('GLASS_future_sheet');
assert.equal(optimized.material.side,T.FrontSide);
assert.equal(fallback.material.side,T.DoubleSide);
assert.equal(fallback.material.opacity,.025);
assert(Math.abs((1-optimized.material.opacity)-(1-fallback.material.opacity)**2)<1e-15,'Both original layers retain exactly the same background transmittance');
for(const key of ['roughness','metalness','transparent','depthWrite','envMapIntensity'])
  assert.equal(optimized.material[key],fallback.material[key]);
assert.equal(optimized.material.color.getHex(),fallback.material.color.getHex());
assert.equal(optimized.castShadow,false);
assert.equal(optimized.receiveShadow,false);
optimized.material.dispose();fallback.material.dispose();
console.log('PASS glass panels: 14 closed thin shells, '+rays+' entry/exit rays, actual/reflected camera bounds, folded transmittance, unknown-glass fallback; max convex export error '+maxConvexExcess.toExponential(2)+' m.');
