/* Skip planar-reflection captures only when the actual reflecting surface is
 * outside the current camera frustum. Three r128 normally culls the much larger
 * bounding sphere, which admits offscreen floor planes in the close city view.
 */
(function () {
  'use strict';
  window.PenthouseReflectionVisibility = { attach: function (T, reflector) {
    const original = reflector.onBeforeRender;
    const frustum = new T.Frustum(), viewProjection = new T.Matrix4();
    const local = Array.from({ length: 4 }, () => new T.Vector3());
    const buffers = [Array.from({ length: 16 }, () => new T.Vector3()), Array.from({ length: 16 }, () => new T.Vector3())];
    let geometry = null, attribute = null, version = null, planar = false;
    const finiteMatrix = matrix => matrix && matrix.elements.every(Number.isFinite);
    function readPlane() {
      const nextGeometry = reflector.geometry, position = nextGeometry?.attributes?.position;
      const nextVersion = position && (position.version ?? position.data?.version);
      if (!position || position.count < 3 || reflector.isInstancedMesh || reflector.isSkinnedMesh ||
          nextGeometry.morphAttributes?.position) return false;
      if (nextGeometry === geometry && position === attribute && nextVersion === version) return planar;
      geometry = nextGeometry; attribute = position; version = nextVersion; planar = false;
      let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
        if (!Number.isFinite(x + y + z)) return false;
        minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z);
      }
      if (maxZ - minZ > 1e-7 || maxX - minX < 1e-7 || maxY - minY < 1e-7) return false;
      const z = (minZ + maxZ) * .5;
      local[0].set(minX, minY, z); local[1].set(maxX, minY, z);
      local[2].set(maxX, maxY, z); local[3].set(minX, maxY, z);
      planar = true; return true;
    }
    function isVisible(camera) {
      // Unknown/deformed geometry or an invalid projection must retain the
      // original render path, rather than risking a missing floor reflection.
      if (!camera?.isCamera || !readPlane()) return true;
      camera.updateWorldMatrix(true, false); reflector.updateWorldMatrix(true, false);
      if (!finiteMatrix(camera.projectionMatrix) || !finiteMatrix(camera.matrixWorldInverse) || !finiteMatrix(reflector.matrixWorld) ||
          Math.abs(camera.projectionMatrix.determinant()) < 1e-12 || Math.abs(reflector.matrixWorld.determinant()) < 1e-12) return true;
      viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(viewProjection);
      let input = buffers[0], output = buffers[1], count = 4;
      for (let i = 0; i < 4; i++) input[i].copy(local[i]).applyMatrix4(reflector.matrixWorld);
      for (const plane of frustum.planes) {
        if (!Number.isFinite(plane.constant + plane.normal.x + plane.normal.y + plane.normal.z) || plane.normal.lengthSq() < .5) return true;
        let nextCount = 0;
        for (let i = 0; i < count; i++) {
          const a = input[i], b = input[(i + 1) % count];
          // Slightly expand the frustum so edge rounding cannot suppress a
          // visible subpixel strip. At most ten vertices result from six clips.
          const da = plane.distanceToPoint(a) + .002, db = plane.distanceToPoint(b) + .002;
          if (da >= 0) output[nextCount++].copy(a);
          if ((da >= 0) !== (db >= 0)) output[nextCount++].copy(a).lerp(b, da / (da - db));
        }
        if (!nextCount) return false;
        count = nextCount; const swap = input; input = output; output = swap;
      }
      return true;
    }
    function beforeRender() {
      if (isVisible(arguments[2])) return original.apply(this, arguments);
    }
    reflector.onBeforeRender = beforeRender;
    return { isVisible, dispose() { if (reflector.onBeforeRender === beforeRender) reflector.onBeforeRender = original; } };
  } };
}());
