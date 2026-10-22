/* Optional Three.js r128 direct-light fast paths. Install before compiling materials.
 * Zero incident color or zero irradiance skips the BRDF. Every contributing path
 * and all area-light/LTC code remain unchanged. Unsupported chunks are untouched. */
(function () {
  'use strict';
  var marker = '// PENTHOUSE_ZERO_LIGHTS_V1';
  var directBody = `void RE_Direct_Physical( const in IncidentLight directLight, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometry.normal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifndef PHYSICALLY_CORRECT_LIGHTS
		irradiance *= PI;
	#endif
	#ifdef CLEARCOAT
		float ccDotNL = saturate( dot( geometry.clearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = ccDotNL * directLight.color;
		#ifndef PHYSICALLY_CORRECT_LIGHTS
			ccIrradiance *= PI;
		#endif
		float clearcoatDHR = material.clearcoat * clearcoatDHRApprox( material.clearcoatRoughness, ccDotNL );
		reflectedLight.directSpecular += ccIrradiance * material.clearcoat * BRDF_Specular_GGX( directLight, geometry.viewDir, geometry.clearcoatNormal, vec3( DEFAULT_SPECULAR_COEFFICIENT ), material.clearcoatRoughness );
	#else
		float clearcoatDHR = 0.0;
	#endif
	#ifdef USE_SHEEN
		reflectedLight.directSpecular += ( 1.0 - clearcoatDHR ) * irradiance * BRDF_Specular_Sheen(
			material.specularRoughness,
			directLight.direction,
			geometry,
			material.sheenColor
		);
	#else
		reflectedLight.directSpecular += ( 1.0 - clearcoatDHR ) * irradiance * BRDF_Specular_GGX( directLight, geometry.viewDir, geometry.normal, material.specularColor, material.specularRoughness);
	#endif
	reflectedLight.directDiffuse += ( 1.0 - clearcoatDHR ) * irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );
}
`;

  var directZero = '\t// PENTHOUSE_DIRECT_ZERO_BEGIN\n\tif ( all( equal( directLight.color, vec3( 0.0 ) ) ) ) return;\n\t// PENTHOUSE_DIRECT_ZERO_END\n';
  // Base and clearcoat normals may differ. Never remove one lit layer just
  // because the other is dark; positive cosines have no threshold or epsilon.
  var coatZero = '\t\t// PENTHOUSE_COAT_IRRADIANCE_ZERO_BEGIN\n\t\tif ( dotNL == 0.0 && ccDotNL == 0.0 ) return;\n\t\t// PENTHOUSE_COAT_IRRADIANCE_ZERO_END\n';
  var baseZero = '\t\t// PENTHOUSE_BASE_IRRADIANCE_ZERO_BEGIN\n\t\tif ( dotNL == 0.0 ) return;\n\t\t// PENTHOUSE_BASE_IRRADIANCE_ZERO_END\n';
  var optimizedDirect = directBody.replace('\tfloat dotNL', directZero + '\tfloat dotNL')
    .replace('\t\tvec3 ccIrradiance =', coatZero + '\t\tvec3 ccIrradiance =')
    .replace('\t\tfloat clearcoatDHR = 0.0;', baseZero + '\t\tfloat clearcoatDHR = 0.0;');
  function onlyOnce(source, snippet) { return source.indexOf(snippet) >= 0 && source.indexOf(snippet) === source.lastIndexOf(snippet); }
  window.PenthouseLightingOptimization = {
    install: function (T) {
      var chunks = T && T.ShaderChunk;
      if (!T || String(T.REVISION) !== '128' || !chunks || typeof chunks.lights_physical_pars_fragment !== 'string') {
        return { installed: false, changed: false, reason: 'unsupported-three-version' };
      }
      var source = chunks.lights_physical_pars_fragment;
      // Do not accept an earlier experimental area-light patch as this version.
      if (source.indexOf('PENTHOUSE_AREA_') >= 0) return { installed: false, changed: false, reason: 'unsupported-shader-chunks' };
      if (source.indexOf(marker) >= 0) {
        var intact = onlyOnce(source, marker) && onlyOnce(source, optimizedDirect);
        return { installed: intact, changed: false, reason: intact ? 'already-installed' : 'unsupported-shader-chunks' };
      }
      // Validate the complete function before a single mutation; unrelated
      // area-light and environment chunks are neither matched nor rewritten.
      if (!onlyOnce(source, 'void RE_Direct_Physical(') || !onlyOnce(source, directBody)) {
        return { installed: false, changed: false, reason: 'unsupported-shader-chunks' };
      }
      chunks.lights_physical_pars_fragment = marker + '\n' + source.replace(directBody, optimizedDirect);
      return { installed: true, changed: true, reason: 'installed' };
    }
  };
}());
