/* Static, city-only directional occlusion. No runtime shadow-map render passes.
 * Atlas faces per building: +Z, +X, -Z, -X; X or Z increases left-to-right,
 * Y increases bottom-to-top. Each face has one duplicated texel of gutter.
 * rects[i*4..i*4+3] = first interior texel UV, interior last-minus-first UV.
 * Add face * faceStep to rect.x, then rect.zw * facadeUV. */
(function () {
  'use strict';
  var direction = [-.6, .75, .4];
  var length = Math.hypot.apply(Math, direction);
  direction = direction.map(function (v) { return v / length; });
  function normalized(a) { var n = Math.hypot.apply(Math, a); return a.map(function (v) { return v / n; }); }
  function nextPowerOfTwo(v) { return Math.pow(2, Math.ceil(Math.log2(Math.max(1, v)))); }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  var right = normalized([direction[2], 0, -direction[0]]);
  var up = [direction[1] * right[2], direction[2] * right[0] - direction[0] * right[2], -direction[1] * right[0]];
  var glsl = [
    'uniform sampler2D uCityShadow; uniform float uCityShadowFaceStep;',
    'float cityShadow(vec3 p, vec3 n, vec3 origin, vec3 size, vec4 rect) {',
    '  vec3 q=clamp((p-origin)/size+.5,0.,1.);',
    '  float isSide=step(abs(n.z),abs(n.x));',
    '  float face=isSide>.5?(n.x>0.?1.:3.):(n.z>0.?0.:2.);',
    '  vec2 uv=vec2(mix(q.x,q.z,isSide),q.y);',
    '  return texture2D(uCityShadow,rect.xy+vec2(face*uCityShadowFaceStep,0.)+uv*rect.zw).r;',
    '}'
  ].join('\n');
  window.PenthouseCityShadow = {
    direction: direction.slice(), glsl: glsl,
    bake: function (THREE, towers, options) {
      options = options || {};
      var start = typeof performance !== 'undefined' ? performance.now() : Date.now();
      var lite = !!options.lite, columns = lite ? 6 : 8, rows = lite ? 16 : 24;
      var tileWidth = columns + 2, tileHeight = rows + 2, buildingWidth = tileWidth * 4;
      var across = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, towers.length) * tileHeight / buildingWidth)));
      var atlasWidth = nextPowerOfTwo(across * buildingWidth);
      across = Math.max(1, Math.floor(atlasWidth / buildingWidth));
      var atlasHeight = nextPowerOfTwo(Math.ceil(Math.max(1, towers.length) / across) * tileHeight);
      var data = new Uint8Array(atlasWidth * atlasHeight * 4); data.fill(255);
      var rects = new Float32Array(towers.length * 4);
      var directions = [direction];
      if (!lite) [-1, 1].forEach(function (sign) {
        directions.push(normalized(direction.map(function (v, k) { return v + sign * (right[k] * .035 + up[k] * .015); })));
      });
      var inverse = directions.map(function (d) { return d.map(function (v) { return 1 / v; }); });
      var bases = directions.map(function (d) {
        var r = normalized([d[2], 0, -d[0]]);
        return [r, [d[1] * r[2], d[2] * r[0] - d[0] * r[2], -d[1] * r[0]], d];
      });
      var boxes = towers.map(function (b) {
        var center = [b.x, b.y, b.z], half = [b.w / 2, b.h / 2, b.d / 2];
        return {
          min: center.map(function (v, k) { return v - half[k]; }),
          max: center.map(function (v, k) { return v + half[k]; }),
          projection: bases.map(function (basis) {
            return basis.map(function (axis) {
              var c = dot(center, axis), extent = Math.abs(axis[0]) * half[0] + Math.abs(axis[1]) * half[1] + Math.abs(axis[2]) * half[2];
              return [c - extent, c + extent];
            });
          })
        };
      });
      var candidateLists = boxes.map(function (receiver, receiverIndex) {
        var candidates = [];
        boxes.forEach(function (blocker, blockerIndex) {
          if (receiverIndex === blockerIndex) return;
          var possible = receiver.projection.some(function (r, index) {
            var b = blocker.projection[index];
            return b[0][1] >= r[0][0] - .25 && b[0][0] <= r[0][1] + .25 &&
              b[1][1] >= r[1][0] - .25 && b[1][0] <= r[1][1] + .25 && b[2][1] > r[2][0];
          });
          if (possible) candidates.push(blockerIndex);
        });
        return candidates;
      });
      var all = boxes.map(function (_, i) { return i; });
      function visibility(x, y, z, candidates, skipContaining) {
        var visible = 0;
        for (var ray = 0; ray < inverse.length; ray++) {
          var inv = inverse[ray], blocked = false;
          for (var j = 0; j < candidates.length; j++) {
            var b = boxes[candidates[j]], lo = b.min, hi = b.max;
            if (skipContaining && x >= lo[0] - .06 && x <= hi[0] + .06 && y >= lo[1] - .06 && y <= hi[1] + .06 && z >= lo[2] - .06 && z <= hi[2] + .06) continue;
            // Three slab intervals; inverse directions never contain zero.
            var ax = (lo[0] - x) * inv[0], bx = (hi[0] - x) * inv[0];
            var ay = (lo[1] - y) * inv[1], by = (hi[1] - y) * inv[1];
            var az = (lo[2] - z) * inv[2], bz = (hi[2] - z) * inv[2];
            var near = Math.max(Math.min(ax, bx), Math.min(ay, by), Math.min(az, bz), .06);
            var far = Math.min(Math.max(ax, bx), Math.max(ay, by), Math.max(az, bz));
            if (far > near) { blocked = true; break; }
          }
          if (!blocked) visible++;
        }
        return visible / inverse.length;
      }
      var normals = [[0, 0, 1], [1, 0, 0], [0, 0, -1], [-1, 0, 0]];
      var faceData = new Uint8Array(columns * rows), shadowed = 0, partiallyLit = 0, evaluated = 0;
      towers.forEach(function (b, index) {
        var originX = (index % across) * buildingWidth, originY = Math.floor(index / across) * tileHeight;
        rects.set([(originX + 1.5) / atlasWidth, (originY + 1.5) / atlasHeight, (columns - 1) / atlasWidth, (rows - 1) / atlasHeight], index * 4);
        for (var face = 0; face < 4; face++) {
          var n = normals[face];
          for (var row = 0; row < rows; row++) {
            for (var col = 0; col < columns; col++) {
              var u = col / (columns - 1), v = row / (rows - 1);
              var x = b.x + (face % 2 ? n[0] * b.w / 2 : (u - .5) * b.w) + n[0] * .10;
              var y = b.y + (v - .5) * b.h;
              var z = b.z + (face % 2 ? (u - .5) * b.d : n[2] * b.d / 2) + n[2] * .10;
              var amount = visibility(x, y, z, candidateLists[index], false);
              faceData[row * columns + col] = Math.round(amount * 255);
              evaluated++; if (amount < 1) shadowed++; if (amount > 0 && amount < 1) partiallyLit++;
            }
          }
          // Duplicated gutters keep linear sampling inside this face, including at corners.
          for (var py = 0; py < tileHeight; py++) for (var px = 0; px < tileWidth; px++) {
            var source = Math.min(rows - 1, Math.max(0, py - 1)) * columns + Math.min(columns - 1, Math.max(0, px - 1));
            var offset = ((originY + py) * atlasWidth + originX + face * tileWidth + px) * 4;
            data[offset] = data[offset + 1] = data[offset + 2] = faceData[source];
          }
        }
      });
      var texture = new THREE.DataTexture(data, atlasWidth, atlasHeight, THREE.RGBAFormat, THREE.UnsignedByteType);
      texture.name = 'Static city directional occlusion — four facade sides per volume';
      texture.minFilter = texture.magFilter = THREE.LinearFilter;
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.generateMipmaps = false; texture.flipY = false; texture.needsUpdate = true;
      var duration = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - start;
      return {
        texture: texture, rects: rects, faceStep: tileWidth / atlasWidth,
        direction: direction.slice(), glsl: glsl, resolution: [columns, rows],
        // For structural instance centers, ignore any containing volume to avoid self-occlusion.
        // Nearby facade profiles then see the same neighbouring blockers as the atlas.
        sampleAt: function (x, y, z) { return visibility(x, y, z, all, true); },
        stats: { volumes: towers.length, width: atlasWidth, height: atlasHeight, bytes: data.byteLength,
          faceSamples: evaluated, shadowedSamples: shadowed, softSamples: partiallyLit,
          averageCandidates: candidateLists.reduce(function (sum, c) { return sum + c.length; }, 0) / Math.max(1, boxes.length),
          bakeMs: Math.round(duration * 10) / 10 }
      };
    }
  };
}());
