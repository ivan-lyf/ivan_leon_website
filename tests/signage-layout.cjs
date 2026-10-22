// Run: node tests/signage-layout.cjs
// Checks production plans, baked atlas layout and asynchronous resource lifecycle.
// This is CPU/source validation; it does not substitute for browser visual review.
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path');
const { createFixture, THREE, root } = require('./helpers/signage-fixture.cjs');
const full = createFixture(false), lite = createFixture(true);
const expectedIds = ('sushi jiujia chicken beer coffee chai qahwa shokudo pho lips noraebang lovehotel dice bar_ru cherry club mic gitai cyberarm dentist yaofang apteka barber massage tattoo dragon chiprepair chipmatrix crypto dangpu metro umbrella danger vacancy torii kitsune maneki fu lotus octopus rabbit shiba crab moto rocket sneaker skull diamond planet izakaya directory sale_kr gym').split(' ');
const canonical = signs => JSON.stringify(signs.map(s => [s.d.id,s.x,s.y,s.z,s.w,s.h,s.ry,s.tilt,s.seed,s.gain,s.district,s.buildingId,s.hero]));
const near = (a,b,e=1e-8) => Math.abs(a-b) <= e;
const unique = a => [...new Set(a)];
const summary = [];
const identities = Array.from(full.data.designs,d => d.id);
assert.equal(identities.length,53);
assert.deepStrictEqual(identities.slice().sort(),expectedIds.slice().sort(),'Only the supplied v2 collection should be in the baked pool');
assert.equal(new Set(identities).size,53);

function halfExtents(s) {
  return [Math.abs(Math.cos(s.tilt))*s.w/2+Math.abs(Math.sin(s.tilt))*s.h/2,
    Math.abs(Math.cos(s.tilt))*s.h/2+Math.abs(Math.sin(s.tilt))*s.w/2];
}
function overlaps(a,b) {
  if(Math.abs(a.ry-b.ry)>.01)return false;
  const depth=a.ry?Math.abs(a.x-b.x):Math.abs(a.z-b.z);
  const horizontal=a.ry?Math.abs(a.z-b.z):Math.abs(a.x-b.x);
  const aa=halfExtents(a),bb=halfExtents(b);
  return depth<4&&horizontal<aa[0]+bb[0]&&Math.abs(a.y-b.y)<aa[1]+bb[1];
}
function blocksLogo(s,p) {
  return Math.abs(s.x-p.x)<p.w*.5+(s.ry?.3:s.w*.5)+3 &&
    Math.abs(s.y-p.y)<(s.h+p.w*.25)*.5+2 &&
    Math.abs(s.z-p.z)<8+(s.ry?s.w*.5:.3);
}
// Use the authored room pose, rather than the planner's arithmetic, to check
// visibility. Keeping placement independent of the live viewport avoids a new
// screen-size-specific skyline while bringing the banners into the room view.
const sceneSource=fs.readFileSync(path.join(root,'shared/penthouse-scene.js'),'utf8');
const roomPose=sceneSource.match(/room:\s*\{\s*position:\s*\[([^\]]+)\],\s*target:\s*\[([^\]]+)\]/);
assert(roomPose,'Room-camera source must be available for projection checks');
const cityScale=Number(sceneSource.match(/city\.group\.scale\.setScalar\(([^)]+)\)/)?.[1]);
assert(Number.isFinite(cityScale)&&cityScale>0,'City transform must be included in camera-space checks');
const eye=roomPose[1].split(',').map(n=>Number(n)/cityScale),target=roomPose[2].split(',').map(n=>Number(n)/cityScale);
const roomCamera=new THREE.PerspectiveCamera(52,16/9,.1,4000);
roomCamera.position.fromArray(eye);roomCamera.lookAt(...target);roomCamera.updateMatrixWorld();
function blockedFromRoom(t,point) {
  const box=new THREE.Box3(new THREE.Vector3(t.x-t.w/2,t.y-t.h/2,t.z-t.d/2),new THREE.Vector3(t.x+t.w/2,t.y+t.h/2,t.z+t.d/2));
  const origin=new THREE.Vector3(...eye),destination=new THREE.Vector3(...point),distance=destination.distanceTo(origin);
  const intersection=new THREE.Ray(origin,destination.sub(origin).normalize()).intersectBox(box,new THREE.Vector3());
  return intersection&&intersection.distanceTo(origin)<distance*.999;
}
function clearOfCompanyBuilding(id,context) {
  return !context.logoPlacements.some(p=>context.towers.some(t=>t.buildingId===id&&
    Math.abs(p.x-t.x)<t.w/2+p.w/2&&Math.abs(p.z0-t.z)<t.d/2+10));
}
assert(overlaps(full.signs[0],{...full.signs[0]}),'Overlap detector must reject coincident signs');
assert(blocksLogo({...full.signs[0],x:full.context.logoPlacements[0].x,y:full.context.logoPlacements[0].y,z:full.context.logoPlacements[0].z},full.context.logoPlacements[0]),'Logo-clearance detector control');

for(const fixture of [full,lite]) {
  const {api,data,options,context}=fixture;
  const original=JSON.stringify({designs:data.designs,towers:options.towers,exclusions:options.exclusions});
  for(const seed of [55127,17,90013]) {
    const planOptions={...options,seed},signs=api.plan(data.designs,planOptions);
    assert(signs.length>=(options.lite?50:53)&&signs.length<=(options.lite?50:73),'Fit the complete library within the existing quality budgets');
    if(options.lite)assert.equal(signs.length,50,'Lite keeps its fifty-panel budget');
    assert.equal(signs.filter(s=>s.hero).length,4,'Keep only four separated panels on the former focal building');
    assert.equal(unique(signs.filter(s=>s.hero).map(s=>s.buildingId)).length,1);
    assert(clearOfCompanyBuilding(signs.find(s=>s.hero).buildingId,context),'The focal building must not carry a company logo');
    assert(unique(signs.map(s=>s.buildingId)).length>=14&&unique(signs.map(s=>s.buildingId)).length<=20,'Distribute the banners across a wider visible skyline');
    const density=signs.reduce((counts,s)=>(counts[s.buildingId]=(counts[s.buildingId]||0)+1,counts),{});
    assert(Math.max(...Object.values(density))<=6,'No building may consume more than six panels across its tiers and sides');
    const addressDesigns=new Set();
    for(const s of signs){const key=s.buildingId+':'+s.d.id;assert(!addressDesigns.has(key),'A building must not repeat the same artwork across its tiers or sides: '+key);addressDesigns.add(key);}
    // Independent bounds built with Three.js cover every occupied tier. A high
    // panel or a side wall cannot bypass the building-neighborhood restriction.
    const footprints=new Map();
    for(const t of context.towers){let box=footprints.get(t.buildingId);if(!box){box=new THREE.Box2();footprints.set(t.buildingId,box);}box.expandByPoint(new THREE.Vector2(t.x-t.w/2,t.z-t.d/2));box.expandByPoint(new THREE.Vector2(t.x+t.w/2,t.z+t.d/2));}
    for(let i=0;i<signs.length;i++)for(let j=0;j<i;j++){
      const a=signs[i],b=signs[j];if(a.d.id!==b.d.id)continue;
      const aa=footprints.get(a.buildingId),bb=footprints.get(b.buildingId);
      const gap=new THREE.Vector2(Math.max(aa.min.x-bb.max.x,bb.min.x-aa.max.x,0),Math.max(aa.min.y-bb.max.y,bb.min.y-aa.max.y,0)).length();
      assert(gap>=60,'Matching banners must be separated by a whole neighborhood: '+a.d.id);
      const ap=new THREE.Vector3(a.x,a.y,a.z).project(roomCamera),bp=new THREE.Vector3(b.x,b.y,b.z).project(roomCamera);
      assert(Math.hypot(ap.x-bp.x,ap.y-bp.y)>=.179,'Matching banners must also be separated in the room view: '+a.d.id);
    }
    const nearAnimated=signs.filter(s=>s.z>-120&&s.d.anim>0);
    assert(nearAnimated.length>=(options.lite?16:18),'Bring a useful selection of animated art to nearer facades');
    for(const animation of [1,4,5])assert(nearAnimated.some(s=>s.z>-90&&s.d.anim===animation),'Near-frontage signs include flipping, pulsing and scrolling artwork');
    if(!options.lite)assert.equal(unique(signs.map(s=>s.d.id)).length,53,'The full scene still shows the complete supplied library');
    assert.equal(canonical(signs),canonical(api.plan(data.designs,planOptions)),'Repeated plan must be deterministic');
    for(const s of signs) {
      assert(identities.includes(s.d.id),'Unknown design');
      for(const key of ['x','y','z','w','h','ry','tilt','seed','gain'])assert(Number.isFinite(s[key]),'Nonfinite '+key);
      assert(s.seed>=0&&s.seed<1);
      assert(s.w>0&&s.h>0&&near(s.w/s.h,s.d.aspect),'Physical artwork aspect must match visible source');
      assert(s.w<=s.d.size[1]+1e-8,'Artwork must not exceed its physical size range');
      const [hw,hh]=halfExtents(s), side=Math.abs(s.ry)>0.01;
      const owners=context.towers.filter(t=>{
        if(t.shape==='round'||t.w<6||t.z < -285||t.z > -40||Math.abs(t.x)>240)return false;
        const yLo=Math.max(t.y-t.h/2+3,-24),yHi=Math.min(t.y+t.h/2-4,26);
        const face=side?t.x+(t.x<0?1:-1)*t.w/2:t.z+t.d/2;
        const outward=side?(t.x<0?1:-1):1,depth=((side?s.x:s.z)-face)*outward;
        return t.buildingId===s.buildingId&&depth>.04&&depth<=5 &&
          Math.abs((side?s.z:s.x)-(side?t.z:t.x))+hw <= (side?t.d:t.w)/2+1e-8 &&
          s.y-hh>=yLo-1e-8&&s.y+hh<=yHi+1e-8;
      });
      assert(owners.length,'Tilted banner must fit an actual eligible building face: '+s.d.id);
      assert(s.y-hh>=-24&&s.y+hh<=26,'No advertisement sinks back into the hidden street band');
      const projected=new THREE.Vector3(s.x,s.y,s.z).project(roomCamera);
      assert(Math.abs(projected.x)<=.961&&projected.y>=-.341&&projected.y<=.401,'Banner centre must be in the room-window composition');
      for(const offset of [-.42,0,.42]) {
        const point=[s.x+(side?0:s.w*offset),s.y,s.z+(side?s.w*offset:0)];
        assert(!context.towers.some(t=>blockedFromRoom(t,point)),'Room view must see the banner centre and both edges: '+s.d.id);
      }
      for(const logo of context.logoPlacements)assert(!blocksLogo(s,logo),'Tenant banner entered company-logo exclusion: '+s.d.id);
    }
    for(let i=0;i<signs.length;i++)for(let j=0;j<i;j++)assert(!overlaps(signs[i],signs[j]),'Overlapping same-face signs');
    if(seed===55127)summary.push({quality:options.lite?'lite':'full',signs:signs.length,
      uniqueDesigns:unique(signs.map(s=>s.d.id)).length,
      missing:expectedIds.filter(id=>!signs.some(s=>s.d.id===id)),
      districts:signs.reduce((counts,s)=>(counts[s.district]=(counts[s.district]||0)+1,counts),{}),
      formats:signs.reduce((counts,s)=>(counts[s.d.shape]=(counts[s.d.shape]||0)+1,counts),{}),
      focalBuilding:signs.find(s=>s.hero).buildingId,focalPanels:signs.filter(s=>s.hero).length,
      occupiedBuildings:unique(signs.map(s=>s.buildingId)).length,maxPanelsPerBuilding:Math.max(...Object.values(density)),nearAnimated:nearAnimated.length,lowestEdge:Math.min(...signs.map(s=>s.y-halfExtents(s)[1]))});
    else assert.notEqual(canonical(signs),canonical(fixture.signs),'A different explicit seed must change the placement');
  }
  assert.equal(JSON.stringify({designs:data.designs,towers:options.towers,exclusions:options.exclusions}),original,'Planning must not mutate caller data');
}
assert.equal(canonical(lite.signs),canonical(full.signs.slice(0,lite.signs.length)),'Lite preserves full-layout addresses and seeds');

function webpSize(filename) {
  const b=fs.readFileSync(filename);
  assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');
  for(let p=12;p+8<=b.length;) {
    const tag=b.toString('ascii',p,p+4),size=b.readUInt32LE(p+4),q=p+8;
    if(tag==='VP8L'){assert.equal(b[q],0x2f);const bits=b.readUInt32LE(q+1);return [(bits&0x3fff)+1,((bits>>>14)&0x3fff)+1];}
    if(tag==='VP8X')return [b.readUIntLE(q+4,3)+1,b.readUIntLE(q+7,3)+1];
    p=q+size+(size%2);
  }
  throw new Error('Expected lossless or extended WebP atlas');
}
const data=full.data,W=data.width,H=data.height,g=data.gutter;
const sizes=[webpSize(path.join(root,data.texture)),webpSize(path.join(root,data.liteTexture))];
assert.deepStrictEqual(sizes[0],[W,H]);assert.deepStrictEqual(sizes[1],[W/2,H/2]);
const frames=[];
for(const d of data.designs) {
  assert.equal(d.frames,d.anim===1?2:1);assert(d.view>0&&d.view<=1);
  const [x,y,w,h]=d.rect;
  assert([x,y,w,h,d.stride,g].every(Number.isInteger));assert(w>0&&h>0&&g>=8);
  assert.equal(d.stride,w+2*g,'Frame stride must include both gutters');
  const visibleAspect=w*(d.anim===5?d.view:1)/(h*(d.anim===7?d.view:1));
  assert(Math.abs(visibleAspect/d.aspect-1)<=2/Math.min(w,h),'Baked aspect only differs by integer pixel rounding');
  for(let f=0;f<d.frames;f++) {
    const r={id:d.id,frame:f,x:x+f*d.stride-g,y:y-g,w:w+2*g,h:h+2*g};
    assert(r.x>=0&&r.y>=0&&r.x+r.w<=W&&r.y+r.h<=H,'Padded frame outside atlas');
    for(const previous of frames)assert(r.x+r.w<=previous.x||previous.x+previous.w<=r.x||r.y+r.h<=previous.y||previous.y+previous.h<=r.y,'Atlas padded frames overlap');
    frames.push(r);
    // UVs are normalized from full metadata. Both textures must address the same
    // content and leave at least four physical gutter pixels on the lite atlas.
    for(const [tw,th] of sizes) {
      assert(g*tw/W>=4&&g*th/H>=4);
      for(const uv of [[0,0],[.5,.5],[1,1]]) {
        const px=(x+f*d.stride+uv[0]*w)/W*tw,py=(y+uv[1]*h)/H*th;
        assert(px>=0&&px<=tw&&py>=0&&py<=th);
        assert(near(px/tw,(x+f*d.stride+uv[0]*w)/W));
      }
    }
  }
}

async function lifecycle(fixture,mode) {
  const requests=[],warnings=[],resources=[];
  function track(r){const state={resource:r,disposals:0};r.addEventListener('dispose',()=>state.disposals++);resources.push(state);return r;}
  class Loader {load(url,onLoad,onProgress,onError){const texture=track(new THREE.Texture());requests.push({url,onLoad,onError,texture});return texture;}}
  class Plane extends THREE.PlaneGeometry {constructor(...args){super(...args);track(this);}}
  class Shader extends THREE.ShaderMaterial {constructor(...args){super(...args);track(this);}}
  const T={...THREE,TextureLoader:Loader,PlaneGeometry:Plane,ShaderMaterial:Shader};
  fixture.context.console={warn:(...args)=>warnings.push(args)};
  const scene=fixture.api.create(T,fixture.options),request=requests[0],children=scene.group.children.slice();
  children.forEach(child=>{if(!resources.some(r=>r.resource===child.geometry))track(child.geometry);});
  assert.equal(requests.length,1);assert.equal(request.url,fixture.options.lite?fixture.data.liteTexture:fixture.data.texture);
  assert.equal(scene.group.visible,false);assert.equal(scene.getStats().loaded,false);
  assert.equal(children.length,2);assert(children.every(c=>c.isInstancedMesh&&c.count===fixture.signs.length));
  assert.equal(scene.getStats().drawCalls,2);
  const faces=children[0],geo=faces.geometry,attr=geo.attributes,uniforms=faces.material.uniforms;
  assert.deepStrictEqual(uniforms.uAtlasSize.value.toArray(),sizes[fixture.options.lite?1:0]);
  assert.equal(request.texture.encoding,THREE.LinearEncoding);assert.equal(request.texture.flipY,true);
  fixture.signs.forEach((s,i)=>{
    const [x,y,w,h]=s.d.rect,cell=[x/W,1-(y+h)/H,w/W,h/H];
    cell.forEach((n,k)=>assert.equal(attr.aCell.array[i*4+k],Math.fround(n)));
    assert.equal(attr.aStride.array[i],Math.fround(s.d.stride/W));
    assert.equal(attr.aView.array[i],Math.fround(s.d.view));
    assert.equal(attr.aMeta.array[i*4],Math.fround(s.seed));
  });
  const arrays=Object.values(attr).map(a=>a.array),atlas=uniforms.uAtlas.value;
  for(const t of [0,1,19.9,800]){scene.update(t);assert.equal(uniforms.uTime.value,t);}
  scene.setMood('night');assert.equal(uniforms.uGain.value,1);
  assert.strictEqual(uniforms.uAtlas.value,atlas);assert.strictEqual(faces.geometry,geo);
  Object.values(attr).forEach((a,i)=>assert.strictEqual(a.array,arrays[i]));
  if(mode==='disposed'){scene.dispose();scene.dispose();request.onLoad(request.texture);}
  else if(mode==='error'){request.onError(new Error('Deliberate test load failure'));}
  else request.onLoad(request.texture);
  await scene.ready;
  assert.equal(scene.group.visible,mode==='success');
  assert.equal(scene.getStats().loaded,mode==='success');
  assert.equal(Boolean(scene.getStats().error),mode==='error');
  assert.equal(warnings.length,mode==='error'?1:0);
  scene.dispose();scene.dispose();
  assert.equal(scene.group.children.length,0);
  assert(resources.length>=6,'All geometry, material and texture resources were observed');
  resources.forEach(r=>assert.equal(r.disposals,1,'Resource disposal must be exactly once'));
}
(async()=>{
  await lifecycle(full,'success');await lifecycle(lite,'success');
  await lifecycle(createFixture(),'disposed');await lifecycle(createFixture(),'error');
  console.log(JSON.stringify({layouts:summary,atlasFrames:frames.length,atlasSizes:sizes,lifecycleCases:4},null,2));
  console.log('PASS signage layout, atlas mapping, stable precision inputs, async loading and cleanup.');
})().catch(error=>{console.error(error);process.exitCode=1;});
