/* Distant branching lightning. Geometry and coordinates are city metres.
 * A private indexed schedule makes direct seeks match sequential playback. */
(function () {
  'use strict';
  window.PenthouseLightning = {
    create: function (T, options) {
      options = options || {};
      var lite = !!options.lite, defaultEnabled = !options.reducedMotion;
      var duration = .65, firstStrike = 6, interval = 20;
      // Two seeded variants per measured corridor; center, left, right repeat without adjacent lanes.
      var lanes = [-50, -110, 10, -50, -110, 10], depths = [-250, -140, -200, -250, -140, -200];
      var laneOrder = [0, 1, 2, 3, 4, 5];
      var maxSegments = lite ? 128 : 192, maxVertices = maxSegments * 6;
      var positions = new Float32Array(maxVertices * 3), tangents = new Float32Array(maxVertices * 3);
      var sides = new Float32Array(maxVertices), widths = new Float32Array(maxVertices), powers = new Float32Array(maxVertices);
      var mainPoints = new Float32Array(40 * 3), branchPoints = new Float32Array(14 * 3), forkPoints = new Float32Array(8 * 3);
      var group = new T.Group(); group.name = 'Distant cloud-to-city lightning'; group.visible = false;
      var uniforms = { uLightning: { value: 0 }, uStrike: { value: new T.Vector3(-50, 65, -250) } };
      var boltUniform = { value: 0 };
      var geometry = new T.BufferGeometry();
      var attributes = {
        position: new T.BufferAttribute(positions, 3),
        aTangent: new T.BufferAttribute(tangents, 3),
        aSide: new T.BufferAttribute(sides, 1),
        aWidth: new T.BufferAttribute(widths, 1),
        aPower: new T.BufferAttribute(powers, 1)
      };
      Object.keys(attributes).forEach(function (key) {
        attributes[key].setUsage(T.DynamicDrawUsage); geometry.setAttribute(key, attributes[key]);
      });
      geometry.setDrawRange(0, 0);
      geometry.boundingSphere = new T.Sphere(new T.Vector3(-50, 15, -195), 145);
      var material = new T.ShaderMaterial({
        uniforms: { uBolt: boltUniform }, transparent: true, depthTest: true, depthWrite: false,
        side: T.DoubleSide, blending: T.AdditiveBlending, toneMapped: false, extensions: { derivatives: true },
        vertexShader: [
          'attribute vec3 aTangent;attribute float aSide,aWidth,aPower;',
          'varying float vAcross,vPower;',
          'void main(){',
          ' vec4 center=modelViewMatrix*vec4(position,1.);',
          ' vec2 direction=(modelViewMatrix*vec4(aTangent,0.)).xy;',
          ' float lengthSquared=dot(direction,direction);',
          ' vec2 across=lengthSquared>1e-8?vec2(-direction.y,direction.x)*inversesqrt(max(lengthSquared,1e-8)):vec2(1.,0.);',
          ' float worldScale=length(modelMatrix[0].xyz);',
          ' center.xy+=across*aSide*aWidth*worldScale;',
          ' vAcross=aSide;vPower=aPower;gl_Position=projectionMatrix*center;',
          '}'
        ].join('\n'),
        fragmentShader: [
          'uniform float uBolt;varying float vAcross,vPower;',
          'void main(){',
          ' float across=clamp(vAcross,-1.,1.);float aa=max(fwidth(across),.001);',
          ' float variance=.01+aa*aa*.35;',
          ' float core=exp(-across*across/variance)*(.1/sqrt(variance));',
          ' float halo=exp(-across*across*8.)*.16;',
          ' float edge=1.-smoothstep(.8,1.,abs(across));',
          ' vec3 light=vec3(.91,.96,1.)*core*4.2+vec3(.58,.73,1.)*halo;',
          ' gl_FragColor=vec4(light,clamp(uBolt*vPower*edge,0.,1.));',
          '}'
        ].join('\n')
      });
      material.name = 'Lightning | white filament and restrained atmospheric halo';
      var mesh = new T.Mesh(geometry, material); mesh.name = 'Branching lightning ribbons'; mesh.renderOrder = 2; group.add(mesh);
      var disposed = false, enabledState = defaultEnabled, scheduledIndex = -1, geometryIndex = -1;
      var start = firstStrike, nextStart = firstStrike, age = -1, laneIndex = -1, vertexCount = 0, builds = 0, randomState = 1;
      function hash(index, salt) {
        var value = Math.imul((index ^ salt) >>> 0, 0x45d9f3b);
        value ^= value >>> 16; value = Math.imul(value, 0x45d9f3b); value ^= value >>> 16;
        return (value >>> 0) / 4294967296;
      }
      function strikeTime(index) {
        return index <= 0 ? firstStrike : firstStrike + index * interval + (hash(index, 0x51f15e) - .5) * 6;
      }
      function random() {
        randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
        return randomState / 4294967296;
      }
      function point(array, index, x, y, z) {
        var offset = index * 3; array[offset] = x; array[offset + 1] = y; array[offset + 2] = z;
      }
      function vertex(array, count, index, side, width, power) {
        var offset = index * 3, before = Math.max(0, index - 1) * 3, after = Math.min(count - 1, index + 1) * 3;
        var write = vertexCount * 3;
        positions[write] = array[offset]; positions[write + 1] = array[offset + 1]; positions[write + 2] = array[offset + 2];
        tangents[write] = array[after] - array[before]; tangents[write + 1] = array[after + 1] - array[before + 1]; tangents[write + 2] = array[after + 2] - array[before + 2];
        sides[vertexCount] = side; widths[vertexCount] = width; powers[vertexCount] = power; vertexCount++;
      }
      function ribbon(array, count, width, power, taper) {
        for (var i = 0; i < count - 1; i++) {
          var t0 = i / (count - 1), t1 = (i + 1) / (count - 1);
          var w0 = width * (1 - taper * t0), w1 = width * (1 - taper * t1);
          var p0 = power * (1 - taper * t0 * .75), p1 = power * (1 - taper * t1 * .75);
          vertex(array, count, i, -1, w0, p0); vertex(array, count, i, 1, w0, p0); vertex(array, count, i + 1, -1, w1, p1);
          vertex(array, count, i + 1, -1, w1, p1); vertex(array, count, i, 1, w0, p0); vertex(array, count, i + 1, 1, w1, p1);
        }
      }
      function bend(t, k1, k2, k3, b1, b2, b3) {
        if (t < k1) return b1 * t / k1;
        if (t < k2) return b1 + (b2 - b1) * (t - k1) / (k2 - k1);
        if (t < k3) return b2 + (b3 - b2) * (t - k2) / (k3 - k2);
        return b3 * (1 - t) / (1 - k3);
      }
      function organicPath(array, count, ox, oy, oz, dx, dy, dz, broad, fine) {
        // Reuse Y slots for cumulative spacing before writing the path.
        // Uneven steps and angular changes of heading avoid a uniform sawtooth.
        var total = 0; array[1] = 0;
        for (var i = 1; i < count; i++) { total += .35 + random() * 1.55; array[i * 3 + 1] = total; }
        var k1 = .16 + random() * .13, k2 = .43 + random() * .14, k3 = .71 + random() * .13;
        var b1 = (random() * 2 - 1) * broad, b2 = (random() * 2 - 1) * broad, b3 = (random() * 2 - 1) * broad;
        var z1 = (random() * 2 - 1) * broad * .25, z2 = (random() * 2 - 1) * broad * .25, z3 = (random() * 2 - 1) * broad * .25;
        for (var j = 0; j < count; j++) {
          var t = j === count - 1 ? 1 : array[j * 3 + 1] / total, interior = j > 0 && j < count - 1;
          var kink = interior ? (random() * 2 - 1) * fine : 0, depthKink = interior ? (random() - .5) * fine * .5 : 0;
          point(array, j, ox + dx * t + bend(t, k1, k2, k3, b1, b2, b3) + kink, oy + dy * t, oz + dz * t + bend(t, k1, k2, k3, z1, z2, z3) + depthKink);
        }
      }
      function build(index) {
        randomState = (Math.floor(hash(index, 0x15ca71) * 4294967296) >>> 0) || 1;
        var lane = laneOrder[index % laneOrder.length], x = lanes[lane] + (random() - .5) * 6, z = depths[lane] + (random() - .5) * 10;
        var drift = (random() - .5) * 10, depthDrift = (random() - .5) * 6, count = lite ? 28 : 36;
        vertexCount = 0;
        organicPath(mainPoints, count, x, 65, z, drift, -100, depthDrift, 4.4, .65);
        ribbon(mainPoints, count, 1.18, 1, .34);
        var branches = lite ? 5 : 8;
        for (var branch = 0; branch < branches; branch++) {
          var origin = 4 + Math.floor((branch + random() * .65) / branches * (count - 13));
          var originOffset = origin * 3, ox = mainPoints[originOffset], oy = mainPoints[originOffset + 1], oz = mainPoints[originOffset + 2];
          var direction = (branch + index) % 2 ? 1 : -1;
          var reach = direction * (10 + random() * 17), drop = Math.min(oy + 35, 14 + random() * 19), depth = (random() - .5) * 9;
          var branchCount = lite ? 9 : 12;
          organicPath(branchPoints, branchCount, ox, oy, oz, reach, -drop, depth, 2.5, .45);
          ribbon(branchPoints, branchCount, .65, .57, .78);
          // A few thinner forks preserve the branching silhouette without a dense web.
          if (branch % 3 === 1) {
            var forkOrigin = 4 * 3, fx = branchPoints[forkOrigin], fy = branchPoints[forkOrigin + 1], fz = branchPoints[forkOrigin + 2], forkCount = 6;
            var forkReach = direction * (4 + random() * 7), forkDrop = Math.min(fy + 35, 7 + random() * 8);
            organicPath(forkPoints, forkCount, fx, fy, fz, forkReach, -forkDrop, -depth * .5, 1.2, .28);
            ribbon(forkPoints, forkCount, .34, .29, .83);
          }
        }
        geometry.setDrawRange(0, vertexCount);
        attributes.position.updateRange.count = vertexCount * 3; attributes.aTangent.updateRange.count = vertexCount * 3;
        attributes.aSide.updateRange.count = vertexCount; attributes.aWidth.updateRange.count = vertexCount; attributes.aPower.updateRange.count = vertexCount;
        attributes.position.needsUpdate = true; attributes.aTangent.needsUpdate = true; attributes.aSide.needsUpdate = true; attributes.aWidth.needsUpdate = true; attributes.aPower.needsUpdate = true;
        uniforms.uStrike.value.set(mainPoints[0], mainPoints[1], mainPoints[2]);
        geometryIndex = index; builds++;
      }
      function pulse(time, attackStart, peak, end) {
        if (time <= attackStart || time >= end) return 0;
        var t = time < peak ? (time - attackStart) / (peak - attackStart) : (end - time) / (end - peak);
        return t * t * (3 - 2 * t);
      }
      function update(time, enabled) {
        if (disposed) return;
        enabledState = enabled === undefined ? defaultEnabled : !!enabled;
        time = Number.isFinite(time) ? Math.max(0, time) : 0;
        scheduledIndex = time < firstStrike ? -1 : Math.max(0, Math.floor((time - firstStrike) / interval));
        if (scheduledIndex >= 0) {
          if (scheduledIndex > 0 && time < strikeTime(scheduledIndex)) scheduledIndex--;
          else if (time >= strikeTime(scheduledIndex + 1)) scheduledIndex++;
          start = strikeTime(scheduledIndex); nextStart = strikeTime(scheduledIndex + 1); age = time - start;
          laneIndex = laneOrder[scheduledIndex % laneOrder.length];
        } else { start = firstStrike; nextStart = firstStrike; age = time - firstStrike; laneIndex = -1; }
        var active = enabledState && scheduledIndex >= 0 && age >= 0 && age < duration;
        group.visible = active;
        if (!active) { uniforms.uLightning.value = 0; boltUniform.value = 0; return; }
        if (geometryIndex !== scheduledIndex) build(scheduledIndex);
        var main = pulse(age, 0, .018, .20), after = pulse(age, .215, .24, .41);
        uniforms.uLightning.value = Math.min(1, main + after * .15);
        // The filament outlasts the white sky pulse, so its branching silhouette reads against the returning night.
        boltUniform.value = Math.min(1, pulse(age, 0, .018, .34) * .96 + after * .24 + .018 * (1 - age / duration));
      }
      return {
        group: group, uniforms: uniforms, update: update,
        getStats: function () {
          return { enabled: enabledState, active: group.visible, intensity: uniforms.uLightning.value, strikeIndex: scheduledIndex,
            geometryStrikeIndex: geometryIndex, strikeStart: start, nextStrikeTime: nextStart, laneIndex: laneIndex, age: age,
            duration: duration, segments: vertexCount / 6, geometryBuilds: builds, drawCalls: group.visible ? 1 : 0, disposed: disposed };
        },
        dispose: function () {
          if (disposed) return;
          disposed = true; enabledState = false; group.visible = false; uniforms.uLightning.value = 0; boltUniform.value = 0;
          if (group.parent) group.parent.remove(group);
          geometry.dispose(); material.dispose(); group.clear();
        }
      };
    }
  };
}());
