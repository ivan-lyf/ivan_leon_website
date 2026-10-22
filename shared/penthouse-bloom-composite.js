/* Optional HDR bloom/output fusion for the shipped Three.js r128 passes.
 * create(THREE, bloomPass) returns {uniforms, fragmentShader, enabled, dispose}.
 * Append fragmentShader to the ACES output shader, then call
 * penthouseApplyBloom(sceneLinearRGB, vUv) BEFORE tone mapping.
 * After constructing ShaderPass, Object.assign(outputPass.uniforms, helper.uniforms)
 * to retain the live uniform getters (ShaderPass otherwise clones uniforms).
 * The five blur mips and their composite are untouched. Only their final
 * full-resolution additive copy is skipped, within bloom.render's call scope.
 * The fused sum avoids one RGBA16F framebuffer rounding before ACES; therefore
 * rendered results can differ by the old half-float rounding, not bloom shape.
 */
(function () {
  'use strict';
  var attachments = new WeakMap();
  var fragmentShader = [
    'uniform sampler2D tPenthouseBloom;',
    'uniform float uPenthouseBloomEnabled,uPenthouseBloomOpacity,uPenthouseBloomPremultiplied;',
    'vec3 penthouseApplyBloom(vec3 sceneLinear,vec2 uv){',
    ' if(uPenthouseBloomEnabled<.5)return sceneLinear;',
    ' vec4 glow=texture2D(tPenthouseBloom,uv)*uPenthouseBloomOpacity;',
    // AdditiveBlending in r128 is SRC_ALPHA,ONE, or ONE,ONE when premultiplied.
    // Composite alpha contains the weighted mip strengths and is not always 1.
    ' return sceneLinear+glow.rgb*mix(glow.a,1.,uPenthouseBloomPremultiplied);',
    '}'
  ].join('\n');

  window.PenthouseBloomComposite = {
    create: function (T, bloom) {
      if (attachments.has(bloom)) return attachments.get(bloom);
      if (!bloom || typeof bloom.render !== 'function' || !bloom.fsQuad ||
          !bloom.materialCopy || !bloom.copyUniforms || !bloom.renderTargetsHorizontal ||
          !bloom.renderTargetsHorizontal[0]) throw new TypeError('An UnrealBloomPass is required');
      var enabled = true, disposed = false, skipped = false;
      var renderDescriptor = Object.getOwnPropertyDescriptor(bloom, 'render');
      var originalRender = bloom.render;
      function uniform(get) {
        return Object.defineProperty({}, 'value', { enumerable: true, get: get });
      }
      var uniforms = {
        tPenthouseBloom: uniform(function () { return bloom.renderTargetsHorizontal[0].texture; }),
        uPenthouseBloomEnabled: uniform(function () { return !disposed && enabled && bloom.enabled && skipped ? 1 : 0; }),
        uPenthouseBloomOpacity: uniform(function () { return bloom.copyUniforms.opacity.value; }),
        uPenthouseBloomPremultiplied: uniform(function () { return bloom.materialCopy.premultipliedAlpha ? 1 : 0; })
      };
      function render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
        skipped = false;
        var texture = readBuffer && readBuffer.texture;
        var canFuse = !disposed && enabled && bloom.enabled && !bloom.renderToScreen && !maskActive &&
          texture && (texture.type === T.HalfFloatType || texture.type === T.FloatType) &&
          texture.encoding === T.LinearEncoding && bloom.materialCopy.blending === T.AdditiveBlending &&
          typeof renderer.getRenderTarget === 'function';
        if (!canFuse) return originalRender.apply(this, arguments);
        var quad = bloom.fsQuad, drawDescriptor = Object.getOwnPropertyDescriptor(quad, 'render');
        var originalDraw = quad.render;
        quad.render = function (activeRenderer) {
          if (quad.material === bloom.materialCopy && activeRenderer.getRenderTarget() === readBuffer) {
            skipped = true;
            return;
          }
          return originalDraw.apply(this, arguments);
        };
        try {
          return originalRender.apply(this, arguments);
        } catch (error) {
          skipped = false;
          throw error;
        } finally {
          if (drawDescriptor) Object.defineProperty(quad, 'render', drawDescriptor);
          else delete quad.render;
        }
      }
      bloom.render = render;
      var helper = {
        uniforms: uniforms,
        fragmentShader: fragmentShader,
        get enabled() { return enabled; },
        set enabled(value) { enabled = !!value; },
        dispose: function () {
          if (disposed) return;
          disposed = true; skipped = false;
          if (bloom.render === render) {
            if (renderDescriptor) Object.defineProperty(bloom, 'render', renderDescriptor);
            else delete bloom.render;
          }
          attachments.delete(bloom);
        }
      };
      attachments.set(bloom, helper);
      return helper;
    }
  };
}());
