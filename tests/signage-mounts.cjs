// Physical sign-to-building contacts, checked against Three.js mesh triangles.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createFixture, root, THREE: T } = require('./helpers/signage-fixture.cjs');
const source = fs.readFileSync(path.join(root, 'shared/penthouse-signage-mounts.js'), 'utf8');
const scope = { window: {} }; vm.runInNewContext(source, scope);
const mounts = scope.window.PenthouseSignageMounts;
const shape = new T.Shape(), cut = .045;
[[-.5+cut,-.5],[.5-cut,-.5],[.5,-.5+cut],[.5,.5-cut],[.5-cut,.5],[-.5+cut,.5],[-.5,.5-cut],[-.5,-.5+cut]].forEach((p,i) => i ? shape.lineTo(...p) : shape.moveTo(...p));shape.closePath();
const occupied = new T.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false,steps:1});occupied.rotateX(-Math.PI/2);occupied.translate(0,-.5,0);
const box = new T.BoxGeometry(1,1,1), round = new T.CylinderGeometry(.5,.5,1,40,1,false), material = new T.MeshBasicMaterial({side:T.DoubleSide});
function meshFor(part,kind) {
  const mesh = new T.Mesh(kind==='towers'?(part.shape==='round'?round:occupied):box,material);
  mesh.position.set(part.x,part.y,part.z);mesh.scale.set(part.w,part.h,part.d);
  mesh.rotation.fromArray((part.rotation||[0,0,0]).concat('XYZ'));mesh.updateMatrixWorld(true);return mesh;
}
function world(s,u,v,n) { return new T.Vector3(s.mount.axis[0]*u+s.mount.normal[0]*n,v,s.mount.axis[2]*u+s.mount.normal[2]*n); }
function verify(signs,options) {
  const parts = mounts.parts(signs);
  assert.equal(parts.length, signs.length*3, 'Exactly one cabinet and two brackets fit the existing instanced batch');
  signs.forEach((s,i) => {
    assert(s.mount,'Every accepted sign needs a physical mounting plan');
    const m=s.mount,normal=new T.Vector3(...m.normal),cabinet=parts[i*3],cabMesh=meshFor(cabinet,'structure');
    assert.equal(cabinet.buildingId,s.buildingId);assert.equal(cabinet.collision,false);assert.equal(cabinet.signMount,true);
    const plane=world(s,m.u,m.v,m.front),ray=new T.Raycaster(plane.clone().add(normal),normal.clone().negate());
    const hits=ray.intersectObject(cabMesh);assert(hits.length,'The sign face must have a solid housing directly behind it');
    assert(Math.abs(hits[0].distance-1-.04)<1e-7,'Maintain a 4cm artwork/housing depth separation');
    assert(cabinet.w>s.w&&cabinet.h>s.h,'Housing supplies a visible perimeter lip');
    const corner=new T.Vector3(s.w/2,s.h/2,0).applyEuler(new T.Euler(0,s.ry,s.tilt||0)).add(plane);
    assert(Math.abs(corner.clone().sub(plane).dot(normal))<1e-7,'Tilt must not rotate artwork out of the cabinet plane');
    m.anchors.forEach((a,k) => {
      const support=options[a.kind][a.index];assert.equal(support.buildingId,s.buildingId,'Mounts must contact their own building');
      const supportMesh=meshFor(support,a.kind),start=world(s,a.u,a.v,m.front+1);
      const supportHits=new T.Raycaster(start,normal.clone().negate()).intersectObject(supportMesh);
      assert(supportHits.length,'Bracket ray must reach real support triangles, not only an AABB');
      const physicalSurface=supportHits[0].point.dot(normal),bracket=parts[i*3+k+1],bracketMesh=meshFor(bracket,'structure');
      const bracketHits=new T.Raycaster(start,normal.clone().negate()).intersectObject(bracketMesh);
      assert(bracketHits.length>=2,'Bracket must be a solid volume');
      const front=bracketHits[0].point.dot(normal),back=bracketHits[bracketHits.length-1].point.dot(normal);
      assert(back<physicalSurface-.025,'Bracket heel must embed into the actual building mesh');
      assert(front>m.back+.025,'Bracket head must intersect the cabinet');
      assert(bracket.d<3.5,'Reject implausibly long hovering-sign supports');
    });
  });
  return parts;
}
// Flat, side-wall and visibly tilted cases, with a rotated projecting cladding
// piece that requires an actual OBB ray hit. Compare using Three's raycaster.
let synthetic=0;
for(const ry of [0,Math.PI/2,-Math.PI/2])for(const tilt of [0,.12,-.12]) {
  const tower={x:0,y:0,z:0,w:20,h:30,d:16,buildingId:0,seed:.4};
  const structure=[{x:0,y:0,z:8.38,w:8,h:2,d:.9,rotation:[0,0,.13],buildingId:0}];
  if(ry)structure[0]={x:Math.sign(ry)*10.4,y:0,z:0,w:.9,h:2,d:8,rotation:[.13,0,0],buildingId:0};
  const options={towers:[tower],structure,ribs:[]},s={x:0,y:0,z:0,w:6,h:4,ry,tilt,buildingId:0,seed:.6,d:{id:'fixture'}};
  assert(mounts.prepare(options).fit(s,tower),'Synthetic face must admit a cabinet');verify([s],options);synthetic++;
}
const tower={x:0,y:0,z:0,w:20,h:30,d:16,buildingId:0};
const fitter=mounts.prepare({towers:[tower],structure:[],ribs:[]});
assert(!fitter.fit({x:9,y:0,z:12,w:4,h:3,ry:0,tilt:.1,buildingId:0},tower),'Reject a tilted cabinet crossing the actual chamfer');
assert(!fitter.fit({x:0,y:15,z:12,w:4,h:3,ry:0,tilt:0,buildingId:0},tower),'Reject a cabinet floating above the roof');
const obstruction={x:0,y:0,z:12,w:4,h:5,d:2,buildingId:0};
assert(!mounts.prepare({towers:[tower],structure:[obstruction],ribs:[]}).fit({x:0,y:0,z:12,w:4,h:3,ry:0,tilt:0,buildingId:0},tower),'Reject extreme projections instead of creating long floating rods');
for(const lite of [false,true]) {
  const fixture=createFixture(lite),options={towers:fixture.context.towers,structure:fixture.context.structure,ribs:fixture.context.ribs};
  const before=JSON.stringify(options),parts=verify(fixture.signs,options);
  assert.equal(parts.length,lite?150:219,'Mount geometry must stay within the three-box per banner budget');
  assert.equal(JSON.stringify(options),before,'Fitting and part generation must not rewrite the architecture or corporate anchors');
}
[occupied,box,round].forEach(g=>g.dispose());material.dispose();
console.log('PASS signage mounts: '+synthetic+' front/side/tilted fixtures and 123 production signs contact actual support triangles; no coplanar faces; bounded three-box housings.');
