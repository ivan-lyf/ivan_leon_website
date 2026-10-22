/* Exercise the real shipped UnrealBloomPass without WebGL. The recording
 * renderer proves that exactly the final additive draw disappears, that all
 * five mips/weights survive, and that the wrapper restores state on failure.
 * Run: node tests/bloom-composite.cjs
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const T = require(path.join(root, 'shared/vendor/three.min.js'));
global.THREE = T; global.window = {};
for (const file of ['CopyShader.js', 'EffectComposer.js', 'ShaderPass.js', 'LuminosityHighPassShader.js', 'UnrealBloomPass.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(root, 'shared/vendor', file), 'utf8'));
}
vm.runInThisContext(fs.readFileSync(path.join(root, 'shared/penthouse-bloom-composite.js'), 'utf8'));
const API = window.PenthouseBloomComposite;
function renderer() {
  let target = null, clear = new T.Color(.1,.2,.3), alpha = .75;
  return {
    draws: [], autoClear: true, failAt: -1,
    getClearColor(out) { return out.copy(clear); }, getClearAlpha() { return alpha; },
    setClearColor(color, value) { clear.copy(color); alpha = value; },
    setRenderTarget(value) { target = value; }, getRenderTarget() { return target; }, clear() {},
    state: { buffers: { stencil: { setTest() {} } } },
    render(mesh) {
      if (this.draws.length === this.failAt) throw new Error('simulated render failure');
      this.draws.push({ material: mesh.material, target });
    }
  };
}
const bloom = new T.UnrealBloomPass(new T.Vector2(1440,900),.22,.42,.75);
const read = new T.WebGLRenderTarget(1440,900,{type:T.HalfFloatType});read.texture.encoding=T.LinearEncoding;
const write = read.clone();
const originalRender = bloom.render, originalQuadRender = bloom.fsQuad.render;
const stock = renderer();bloom.render(stock,write,read,1/60,false);
assert.equal(stock.draws.length,13);
assert.equal(stock.draws[12].material,bloom.materialCopy);
assert.equal(stock.draws[12].target,read);
const helper = API.create(T,bloom);
assert.equal(API.create(T,bloom),helper,'A pass must not be wrapped twice');
const optimized = renderer();bloom.render(optimized,write,read,1/60,false);
assert.equal(optimized.draws.length,12,'Remove only the final full-resolution blend');
assert.deepEqual(optimized.draws,stock.draws.slice(0,-1),'All blur and composite work stays identical');
assert.equal(optimized.autoClear,true);
assert.equal(optimized.getClearAlpha(),.75);
assert.equal(bloom.fsQuad.render,originalQuadRender);
assert.equal(Object.hasOwn(bloom.fsQuad,'render'),false,'Restore inherited method shape');
assert.equal(helper.uniforms.uPenthouseBloomEnabled.value,1);
assert.equal(helper.uniforms.tPenthouseBloom.value,bloom.renderTargetsHorizontal[0].texture);
assert.equal(bloom.nMips,5);
for (const [strength,radius] of [[.1,0],[.22,.42],[.4,1],[1.2,.65]]) {
  bloom.strength=strength;bloom.radius=radius;bloom.bloomTintColors[2].set(.3,.6,.9);
  bloom.render(renderer(),write,read,1/60,false);
  assert.equal(bloom.compositeMaterial.uniforms.bloomStrength.value,strength);
  assert.equal(bloom.compositeMaterial.uniforms.bloomRadius.value,radius);
  assert.equal(bloom.compositeMaterial.uniforms.bloomTintColors.value,bloom.bloomTintColors);
  assert.equal(helper.uniforms.uPenthouseBloomEnabled.value,1);
}
bloom.setSize(1800,1100);
assert.equal(helper.uniforms.tPenthouseBloom.value,bloom.renderTargetsHorizontal[0].texture,'Resize keeps live bloom source');
const fallback = mutate => {
  const restore=mutate(),r=renderer();bloom.render(r,write,read,1/60,!!bloom.testMask);
  assert.equal(helper.uniforms.uPenthouseBloomEnabled.value,0,'Stock fallback must not double bloom');
  assert.equal(r.draws.length,bloom.renderToScreen?14:13);
  restore();
};
fallback(()=>{helper.enabled=false;return()=>{helper.enabled=true;};});
fallback(()=>{bloom.renderToScreen=true;return()=>{bloom.renderToScreen=false;};});
fallback(()=>{bloom.testMask=true;return()=>{delete bloom.testMask;};});
fallback(()=>{read.texture.type=T.UnsignedByteType;return()=>{read.texture.type=T.HalfFloatType;};});
fallback(()=>{read.texture.encoding=T.sRGBEncoding;return()=>{read.texture.encoding=T.LinearEncoding;};});
fallback(()=>{bloom.materialCopy.blending=T.NormalBlending;return()=>{bloom.materialCopy.blending=T.AdditiveBlending;};});
bloom.render(renderer(),write,read,1/60,false);bloom.enabled=false;
assert.equal(helper.uniforms.uPenthouseBloomEnabled.value,0,'Disabling a composer pass cannot reuse stale glow');bloom.enabled=true;
bloom.copyUniforms.opacity.value=.4;bloom.materialCopy.premultipliedAlpha=true;
assert.equal(helper.uniforms.uPenthouseBloomOpacity.value,.4);
assert.equal(helper.uniforms.uPenthouseBloomPremultiplied.value,1);
// CopyShader multiplies all RGBA channels by opacity. For nonpremultiplied
// AdditiveBlending its SRC_ALPHA factor then multiplies RGB a second time.
const source=[2,1,.5,.66], opacity=.4;
for(const premultiplied of [false,true]){
 const copy=source.map(v=>v*opacity),factor=premultiplied?1:copy[3];
 const stockRGB=copy.slice(0,3).map(v=>v*factor);
 const fusedRGB=source.slice(0,3).map(v=>v*opacity*(premultiplied?1:source[3]*opacity));
 assert.deepEqual(fusedRGB,stockRGB);
}
assert.match(helper.fragmentShader,/glow\.rgb\*mix\(glow\.a,1\.,uPenthouseBloomPremultiplied\)/,'Preserve the stock source-alpha blend');
assert.match(helper.fragmentShader,/texture2D\(tPenthouseBloom,uv\)\*uPenthouseBloomOpacity/);
// New ShaderPass clones uniform objects; integration attaches live objects after construction.
const output=new T.ShaderPass({uniforms:{},vertexShader:T.CopyShader.vertexShader,fragmentShader:helper.fragmentShader+'\nvoid main(){gl_FragColor=vec4(penthouseApplyBloom(vec3(0.),vec2(.5)),1.);}'});
Object.assign(output.uniforms,helper.uniforms);
assert.equal(output.uniforms.uPenthouseBloomEnabled,helper.uniforms.uPenthouseBloomEnabled);
const failed=renderer();failed.failAt=3;
assert.throws(()=>bloom.render(failed,write,read,1/60,false),/simulated render failure/);
assert.equal(bloom.fsQuad.render,originalQuadRender);
assert.equal(helper.uniforms.uPenthouseBloomEnabled.value,0);
const recovered=renderer();bloom.render(recovered,write,read,1/60,false);assert.equal(recovered.draws.length,12);
helper.dispose();helper.dispose();
assert.equal(bloom.render,originalRender);assert.equal(Object.hasOwn(bloom,'render'),false);
assert.equal(helper.uniforms.uPenthouseBloomEnabled.value,0);
const restored=renderer();bloom.render(restored,write,read,1/60,false);assert.equal(restored.draws.length,13);
assert.notEqual(API.create(T,bloom),helper,'A disposed helper can be reattached');
assert.throws(()=>API.create(T,{}),/UnrealBloomPass/);
bloom.dispose();read.dispose();write.dispose();output.material.dispose();
console.log('PASS: 13→12 bloom draws; all5 mips, live blend state, fallbacks, resize and exception/disposal restoration.');
