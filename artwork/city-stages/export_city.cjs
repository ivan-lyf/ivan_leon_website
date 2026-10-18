/* Data-only export of the website's exact seeded architecture, not a redesign. */
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'../..');
const T=require(root+'/shared/vendor/three.min.js');global.window={};
const ctx=new Proxy({},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
global.document={createElement:()=>({width:1,height:1,getContext:()=>ctx})};
let traffic;
let trafficSource=fs.readFileSync(root+'/shared/penthouse-traffic.js','utf8').replace('return {group:group,update:update','return {_routes:routes,_cars:cars,group:group,update:update');
vm.runInThisContext(trafficSource);const createTraffic=window.PenthouseTraffic.create;
window.PenthouseTraffic.create=(T,o)=>(traffic=createTraffic(T,o));
for(const f of ['penthouse-architecture.js','penthouse-city-shadow.js','penthouse-ribbons.js'])vm.runInThisContext(fs.readFileSync(root+'/shared/'+f,'utf8'));
let citySource=fs.readFileSync(root+'/shared/penthouse-city.js','utf8').replace('group: group,','_source:{towers,structure,ribs,reveals,roundBelts,cyan,magenta,beacons},group: group,');
vm.runInThisContext(citySource);const city=window.PenthouseCity.create(T,{});city.update(0);city.group.updateMatrixWorld(true);
const geoms={},objects=[];const matrix=new T.Matrix4();
city.group.traverse(o=>{
 if(!o.isMesh||/Low storm|Colored light scattering|Rain-softened|Traffic loading|corporate mark|wordmark/.test(o.name))return;
 const g=o.geometry,key=g.uuid;
 if(!geoms[key])geoms[key]={positions:Array.from(g.attributes.position.array),indices:g.index?Array.from(g.index.array):Array.from({length:g.attributes.position.count},(_,i)=>i),uv:g.attributes.uv?Array.from(g.attributes.uv.array):null};
 const mats=Array.isArray(o.material)?o.material:[o.material];const mat=mats[0];
 const item={name:o.name,geometry:key,kind:mat.type,color:mat.color?.toArray()||null,roughness:mat.roughness,metalness:mat.metalness,instances:[]};
 const count=o.isInstancedMesh?o.count:1;
 for(let i=0;i<count;i++){
  if(o.isInstancedMesh){o.getMatrixAt(i,matrix);matrix.premultiply(o.matrixWorld);}else matrix.copy(o.matrixWorld);
  item.instances.push({matrix:matrix.toArray(),family:g.attributes.aFamily?.getX(i)||0,seed:g.attributes.aSeed?.getX(i)||0,round:g.attributes.aRound?.getX(i)||0,size:g.attributes.aSize?Array.from(g.attributes.aSize.array.slice(i*3,i*3+3)):null});
 }
 objects.push(item);
});
const cars=traffic._cars.map(c=>{const r=traffic._routes[c.route],p=r.curve.getPointAt(c.phase),tan=r.curve.getTangentAt(c.phase);return {...c,position:p.toArray(),direction:tan.toArray()};});
const result={version:1,source:'Seeded Three.js architecture export, unscaled metres, Y-up',stats:city.getStats(),camera:{position:[.75,1.35,-1.075],target:[0,1.45,-8.25],verticalFovDegrees:52,aspect:16/9,frame:1},geometry:geoms,objects,architecture:city._source,cars};
const destination=__dirname+(fs.existsSync(__dirname+'/city-baseline.json')?'/city-current.json':'/city-baseline.json');fs.writeFileSync(destination,JSON.stringify(result));console.log(JSON.stringify({destination,objects:objects.length,geometry:Object.keys(geoms).length,stats:result.stats,bytes:fs.statSync(destination).size},null,2));city.dispose();
