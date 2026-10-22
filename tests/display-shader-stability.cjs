// Run: node tests/display-shader-stability.cjs
// Pure numerical precision-stress test using production architecture and sign
// placements. This does not reproduce a particular GPU rasterizer or Windows.
// No output files, browser, native modules, or third-party packages are required.
'use strict';
const assert=require('assert');
const { createFixture }=require('./helpers/signage-fixture.cjs');
const {files,context,signs}=createFixture(false);
const f=Math.fround,add=(a,b)=>f(f(a)+f(b)),mul=(a,b)=>f(f(a)*f(b)),fract=n=>f(n-Math.floor(n));
const bits=new DataView(new ArrayBuffer(4));
function ulp(n,k){if(n===0)return n;bits.setFloat32(0,n);bits.setUint32(0,bits.getUint32(0)+k);return bits.getFloat32(0);}
const step=(e,n)=>n<e?0:1;
// Read the seed expressions so removing either runtime stabilization fails.
function seedEvaluator(text, pattern) {
 const match=text.match(pattern);assert(match,'Runtime seed expression missing');
 const expression=match[1];
 if(/^vMeta\.[xy]$/.test(expression))return s=>s;
 const q=expression.match(/^floor\(vMeta\.[xy]\*([\d.]+)\+([\d.]+)\)\/([\d.]+)$/);
 assert(q,'Update the scalar evaluator for the changed seed expression: '+expression);
 return s=>f(Math.floor(add(mul(s,Number(q[1])),Number(q[2])))/Number(q[3]));
}
const corporateSeed=seedEvaluator(files.corporate,/float slot=vMeta\.x,seed=([^,;]+),gain=/);
const tenantSeed=seedEvaluator(files.signage,/float seed=([^,;]+),gain=/);

const h1=n=>fract(mul(f(Math.sin(mul(n,91.7))),43758.5453));
const h2=(x,y)=>fract(mul(f(Math.sin(add(mul(x,127.1),mul(y,311.7)))),43758.5453));
function corporate(seed,x,y,worn){const m=h2(add(x,mul(seed,31)),add(y,mul(seed,31)));return (1-step(add(.985,-mul(worn,.03)),m)*.85)*(1-.35*step(.82,h2(y,mul(seed,7)))*worn);}
let corporateSamples=0,corporateChanges=0,corporateQuantizedChanges=0,corporateExample=null;
for(let i=0;i<context.logoPlacements.length;i++){
 const s=f((i*.618)%1),worn=context.logoPlacements[i].worn||0;
 for(let x=0;x<64;x++)for(let y=0;y<16;y++)for(const k of [-2,-1,1,2]){
  corporateSamples++;const p=ulp(s,k),a=corporate(s,x,y,worn),b=corporate(p,x,y,worn);
  if(a!==b){corporateChanges++;if(!corporateExample)corporateExample={i,seed:s,perturbed:p,module:[x,y],before:a,after:b};}
  if(corporate(corporateSeed(s),x,y,worn)!==corporate(corporateSeed(p),x,y,worn))corporateQuantizedChanges++;
 }
}
function tenant(seed,x,y,time,opaque){
 const segment=add(Math.floor(add(mul(y,5),mul(seed,3))),mul(Math.floor(mul(x,3)),7));
 const failing=step(.64,h1(add(mul(seed,13),segment)))*(1-opaque*.6);
 const stutter=step(.35,h1(add(add(Math.floor(mul(time,add(7,mul(seed,9)))),mul(segment,3.1)),seed)));
 const dead=step(.94,h1(add(mul(seed,7),mul(segment,1.7))))*(1-opaque);
 return (1+(stutter-1)*failing*step(.45,seed))*(1-dead*.9);
}
let tenantSamples=0,tenantChanges=0,tenantQuantizedChanges=0,tenantExample=null;
for(let i=0;i<signs.length;i++){
 const s=f(signs[i].seed),sample=(seed,x,y,time)=>tenant(seed,x,y,time,signs[i].d.opaque);
 for(let x=0;x<12;x++)for(let y=0;y<20;y++)for(const t of [0,2.1,9.7])for(const k of [-2,-1,1,2]){
  tenantSamples++;const p=ulp(s,k),a=sample(s,(x+.5)/12,(y+.5)/20,t),b=sample(p,(x+.5)/12,(y+.5)/20,t);
  if(a!==b){tenantChanges++;if(!tenantExample)tenantExample={i,seed:s,perturbed:p,uv:[(x+.5)/12,(y+.5)/20],time:t,before:a,after:b};}
  if(sample(tenantSeed(s),(x+.5)/12,(y+.5)/20,t)!==sample(tenantSeed(p),(x+.5)/12,(y+.5)/20,t))tenantQuantizedChanges++;
 }
}


// The window count must stay fixed at exact integer dimension boundaries.
function bayTarget(t){let b=[1.5,2.4,1.35,2.2,1.75][t.family||0];if(t.useClass<.5)b=2.8;else if(t.useClass<1.5)b=2.5;if(t.skin>1.5&&t.skin<2.5)b=1.9;return b;}
function faceWidths(t){return t.shape==='round'?[Math.PI*Math.sqrt((t.w*t.w+t.d*t.d)*.5)]:[t.w,t.d];}
const widthExpression=files.city.match(/float stableWidth=([^;]+);/);
const bayExpression=files.city.match(/float bays=max\(2\.,floor\((\w+)\/bayTarget\)\)/);
assert(bayExpression,'Runtime bay-count expression missing');
function currentWidth(width){
 if(bayExpression[1]==='width')return width;
 assert.equal(bayExpression[1],'stableWidth');assert(widthExpression,'Stable width expression missing');
 const q=widthExpression[1].match(/^floor\(width\*([\d.]+)\+([\d.]+)\)\/([\d.]+)$/);
 assert(q,'Update evaluator for changed width expression');
 return f(Math.floor(add(mul(width,Number(q[1])),Number(q[2])))/Number(q[3]));
}
const bays=(width,target)=>Math.max(2,Math.floor(f(width/f(target))));
let dimensionSamples=0,dimensionBaselineChanges=0,dimensionCurrentChanges=0,authoredLayoutChanges=0;
for(const tower of context.towers)for(const value of faceWidths(tower)){
 const width=f(value),target=bayTarget(tower);
 if(bays(width,target)!==bays(currentWidth(width),target))authoredLayoutChanges++;
 for(const offset of [-2,-1,1,2]){
  dimensionSamples++;const other=ulp(width,offset);
  if(bays(width,target)!==bays(other,target))dimensionBaselineChanges++;
  if(bays(currentWidth(width),target)!==bays(currentWidth(other),target))dimensionCurrentChanges++;
 }
}
const results={corporate:{samples:corporateSamples,baselineChanges:corporateChanges,currentChanges:corporateQuantizedChanges},tenant:{samples:tenantSamples,baselineChanges:tenantChanges,currentChanges:tenantQuantizedChanges},dimensions:{samples:dimensionSamples,baselineChanges:dimensionBaselineChanges,currentChanges:dimensionCurrentChanges,authoredLayoutChanges}};
console.log(JSON.stringify(results,null,2));
assert(corporateChanges>0&&tenantChanges>0&&dimensionBaselineChanges>0,'Raw-attribute controls must reproduce the precision hazards');
assert.equal(corporateQuantizedChanges,0,'Corporate module light changes under seed ULP perturbation');
assert.equal(tenantQuantizedChanges,0,'Tenant light changes under seed ULP perturbation');
assert.equal(dimensionCurrentChanges,0,'Facade bay count changes under dimension ULP perturbation');
assert.equal(authoredLayoutChanges,0,'The unperturbed authored window layout must be preserved');
console.log('PASS display shader stability. Precision stress only; no claim of Windows GPU reproduction.');
