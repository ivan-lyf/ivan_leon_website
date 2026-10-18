/* Manufactured architectural LED ribbons. Coordinates and dimensions are metres.
 * The fixed emitter grid is filtered analytically; only signal content animates.
 * Light spill and optical bloom remain separate responsibilities of the city rig. */
(function () {
  'use strict';

  var DEFAULTS = [
    { name: 'AXL cyan orbital ribbon', center: [-30, 6, -93], rx: 16.2, rz: 13.8, tilt: .30, color: [.035, .65, 1] },
    { name: 'Prism magenta orbital ribbon', center: [22, 13, -88], rx: 19, rz: 14.3, tilt: -.28, color: [.75, .045, .72] }
  ];

  function create(THREE, options) {
    options = options || {};
    var spec = options.spec || DEFAULTS[0];
    var tilt = options.tilt === undefined ? spec.tilt : options.tilt;
    var center = options.center ? options.center.clone() : new THREE.Vector3().fromArray(spec.center);
    var tint = options.tint ? options.tint.clone() : new THREE.Color().fromArray(spec.color);
    var curve = options.curve;
    if (!curve) {
      var path = [];
      for (var p = 0; p < 128; p++) {
        var angle = p / 128 * Math.PI * 2, x = Math.cos(angle) * spec.rx;
        path.push(new THREE.Vector3(x, x * Math.tan(tilt), Math.sin(angle) * spec.rz));
      }
      curve = new THREE.CatmullRomCurve3(path, true, 'centripetal');
    }
    var group = new THREE.Group();
    group.name = options.name || spec.name;
    group.position.copy(center);
    var geometries = [], materials = [], disposed = false;
    var up = new THREE.Vector3(-Math.sin(tilt), Math.cos(tilt), 0);
    var length = curve.getLength(), moduleCount = Math.round(length / 2.4);
    var moduleLength = length / moduleCount;
    var dimensions = { housingHeight: .55, housingDepth: .23, bevel: .025, faceHeight: .40,
      faceOffset: .124, seamGap: .035, emitterPitch: .04, moduleLength: moduleLength, moduleCount: moduleCount };
    var segmentCount = options.lite ? 160 : 256;
    function geometry(g) { geometries.push(g); return g; }
    function material(m) { materials.push(m); return m; }
    function frame(t) {
      var tangent = curve.getTangentAt(t).normalize();
      return { point: curve.getPointAt(t), tangent: tangent, outward: new THREE.Vector3().crossVectors(up, tangent).normalize() };
    }
    function vertex(f, radial, height, into) {
      into.push(f.point.x + f.outward.x * radial + up.x * height,
        f.point.y + f.outward.y * radial + up.y * height,
        f.point.z + f.outward.z * radial + up.z * height);
    }

    // A bevelled aluminium extrusion, with one hard normal per profile face.
    var halfDepth = dimensions.housingDepth * .5, halfHeight = dimensions.housingHeight * .5, bevel = dimensions.bevel;
    var profile = [[halfDepth, -halfHeight + bevel], [halfDepth, halfHeight - bevel],
      [halfDepth - bevel, halfHeight], [-halfDepth + bevel, halfHeight],
      [-halfDepth, halfHeight - bevel], [-halfDepth, -halfHeight + bevel],
      [-halfDepth + bevel, -halfHeight], [halfDepth - bevel, -halfHeight]];
    var positions = [], normals = [], uvs = [], indices = [];
    for (var edge = 0; edge < profile.length; edge++) {
      var first = profile[edge], next = profile[(edge + 1) % profile.length];
      var dx = next[0] - first[0], dy = next[1] - first[1], norm = Math.sqrt(dx * dx + dy * dy);
      var start = positions.length / 3;
      for (var i = 0; i <= segmentCount; i++) {
        var f = frame(i / segmentCount);
        for (var side = 0; side < 2; side++) {
          var point = side ? next : first;
          vertex(f, point[0], point[1], positions);
          normals.push((f.outward.x * dy - up.x * dx) / norm, (f.outward.y * dy - up.y * dx) / norm,
            (f.outward.z * dy - up.z * dx) / norm);
          uvs.push(i / segmentCount * length, side);
        }
        if (i < segmentCount) {
          var k = start + i * 2;
          indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
        }
      }
    }
    var housingGeometry = geometry(new THREE.BufferGeometry());
    housingGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    housingGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    housingGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    housingGeometry.setIndex(indices);
    var housingMaterial = material(new THREE.MeshStandardMaterial({ color: 0x19232b, roughness: .48, metalness: .72, fog: true }));
    var housing = new THREE.Mesh(housingGeometry, housingMaterial);
    housing.name = 'Bevelled weatherproof aluminium ribbon backing';
    housing.castShadow = false; housing.receiveShadow = true;
    group.add(housing);

    // Actual gaps interrupt the emitting mesh at each manufactured module joint.
    // An inward service face is dimmer; this remains a thin ribbon from every angle.
    positions = []; normals = []; uvs = []; indices = [];
    var faceGains = [], perModule = Math.max(3, Math.ceil(segmentCount / moduleCount));
    for (var module = 0; module < moduleCount; module++) {
      var begin = (module * moduleLength + dimensions.seamGap * .5) / length;
      var end = ((module + 1) * moduleLength - dimensions.seamGap * .5) / length;
      for (var facing = 0; facing < 2; facing++) {
        var direction = facing ? -1 : 1;
        var offset = positions.length / 3;
        for (var column = 0; column <= perModule; column++) {
          var at = begin + (end - begin) * column / perModule, rowFrame = frame(at);
          for (var row = 0; row < 2; row++) {
            vertex(rowFrame, direction * dimensions.faceOffset, (row - .5) * dimensions.faceHeight, positions);
            normals.push(rowFrame.outward.x * direction, rowFrame.outward.y * direction, rowFrame.outward.z * direction);
            uvs.push(at * length, row); faceGains.push(facing ? .24 : 1);
          }
          if (column < perModule) {
            var a = offset + column * 2;
            if (facing) indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
            else indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
          }
        }
      }
    }
    var faceGeometry = geometry(new THREE.BufferGeometry());
    faceGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    faceGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    faceGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    faceGeometry.setAttribute('aFaceGain', new THREE.Float32BufferAttribute(faceGains, 1));
    faceGeometry.setIndex(indices);
    var uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTint: { value: tint }, uTime: { value: 0 }, uStrength: { value: 4.2 },
      uLength: { value: length }, uModuleLength: { value: moduleLength },
      uHeight: { value: dimensions.faceHeight }, uPitch: { value: dimensions.emitterPitch }
    }]);
    var faceMaterial = material(new THREE.ShaderMaterial({ fog: true, extensions: { derivatives: true }, uniforms: uniforms,
      vertexShader: [
        '#include <common>', '#include <fog_pars_vertex>',
        'attribute float aFaceGain; varying vec2 vUv; varying float vGain;',
        'void main(){ vUv=uv; vGain=aFaceGain; vec4 mvPosition=modelViewMatrix*vec4(position,1.);',
        'gl_Position=projectionMatrix*mvPosition;', '#include <fog_vertex>', '}'
      ].join('\n'),
      fragmentShader: [
        '#include <common>', '#include <fog_pars_fragment>',
        'uniform vec3 uTint; uniform float uTime,uStrength,uLength,uModuleLength,uHeight,uPitch;',
        'varying vec2 vUv; varying float vGain;',
        'float stableHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
        'void main(){',
        'vec2 grid=vec2(vUv.x,vUv.y*uHeight)/uPitch;',
        'vec2 footprint=max(fwidth(grid),vec2(.0001));',
        'vec2 cell=abs(fract(grid)-.5);',
        'vec2 pixels=1.-smoothstep(vec2(.32)-footprint*.5,vec2(.32)+footprint*.5,cell);',
        'float detail=1.-smoothstep(.35,1.8,max(footprint.x,footprint.y));',
        'float emitter=mix(.4096,pixels.x*pixels.y,detail)/.4096;',
        'float moduleId=floor(vUv.x/uModuleLength);',
        'float tolerance=.91+.09*stableHash(vec2(moduleId,7.));',
        'float individual=1.+(stableHash(floor(grid))-.5)*.12*detail;',
        'float phase=fract(vUv.x/uLength-uTime/44.);',
        'float chaser=1.-smoothstep(.025,.105,abs(phase-.34));',
        'float stepBand=step(.68,phase)*step(phase,.75)*(.5+.5*sin(moduleId*1.7));',
        'float content=.89+.10*chaser+.055*stepBand;',
        'vec3 ledColor=mix(uTint,vec3(.26,.49,.75),.075*stepBand);',
        'vec3 emission=ledColor*uStrength*vGain*emitter*tolerance*individual*content;',
        // Tiny dark diffuser contribution remains between the emitters at close range.
        'gl_FragColor=vec4(emission+vec3(.0013,.002,.0025),1.);',
        '#include <fog_fragment>', '#include <tonemapping_fragment>', '#include <encodings_fragment>', '}'
      ].join('\n')
    }));
    var face = new THREE.Mesh(faceGeometry, faceMaterial);
    face.name = 'Segmented opal LED faces — stationary 40 mm emitter matrix';
    group.add(face);

    // Small compression collars reveal physical construction without extra draw calls.
    var seamGeometry = geometry(new THREE.BoxGeometry(dimensions.housingDepth + .016, dimensions.housingHeight + .014, .024));
    var seamMaterial = material(new THREE.MeshStandardMaterial({ color: 0x0c141c, metalness: .35, roughness: .63, fog: true }));
    var seams = new THREE.InstancedMesh(seamGeometry, seamMaterial, moduleCount);
    seams.name = 'Module compression collars and service joints';
    var matrix = new THREE.Matrix4();
    for (var seam = 0; seam < moduleCount; seam++) {
      var s = frame(seam / moduleCount);
      matrix.makeBasis(s.outward, up, s.tangent); matrix.setPosition(s.point);
      seams.setMatrixAt(seam, matrix);
    }
    seams.instanceMatrix.needsUpdate = true; group.add(seams);
    group.userData.ribbon = { center: center.toArray(), tilt: tilt, length: length, dimensions: dimensions };

    return {
      group: group, curve: curve, center: center.clone(),
      update: function (seconds) { uniforms.uTime.value = seconds % 1408; },
      setMood: function (name) { uniforms.uStrength.value = name === 'dusk' ? 2.8 : 4.2; },
      setEnvironment: function (map) {
        [housingMaterial, seamMaterial].forEach(function (m) { m.envMap = map; m.needsUpdate = true; });
      },
      // Blender can rebuild matching profiles and fixed UV materials from these
      // centreline samples. Shader emission is represented separately from lights.
      getExportData: function () {
        var samples = [];
        for (var n = 0; n < segmentCount; n++) {
          var f = frame(n / segmentCount);
          samples.push({ point: f.point.toArray(), outward: f.outward.toArray(), distance: n / segmentCount * length });
        }
        return { name: group.name, coordinateSystem: 'Three.js Y-up metres', center: center.toArray(), up: up.toArray(),
          colorLinear: tint.toArray(), dimensions: Object.assign({}, dimensions), samples: samples,
          emissionStrength: 4.2, inwardGain: .24, animationPeriodSeconds: 44, moduleGain: [.91, 1],
          faceGeometry: 'physical module gaps; outward and inward faces; arc-length UV in metres' };
      },
      getStats: function () { return { modules: moduleCount, drawCalls: 3,
        triangles: housingGeometry.index.count / 3 + faceGeometry.index.count / 3 + seamGeometry.index.count / 3 * moduleCount,
        emitterPitchMetres: dimensions.emitterPitch }; },
      dispose: function () {
        if (disposed) return; disposed = true;
        geometries.forEach(function (g) { g.dispose(); }); materials.forEach(function (m) { m.dispose(); }); group.clear();
      }
    };
  }
  window.PenthouseRibbons = { create: create, specifications: DEFAULTS };
}());
