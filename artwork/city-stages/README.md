# City stages — native Blender review

> Historical authoring record. This source distribution includes `city-05-final.blend`, rebuild scripts, `city-baseline.json` and `ribbons.json`. Intermediate `.blend` checkpoints, renders, web captures, audit/verification files and the comparison HTML pages listed below remain local archives and are excluded from Git and the published site. Historical counts and lighting-manifest descriptions refer to this checkpoint, not the current runtime. See `../README.md`.

This versioned review preserves the website's seeded architecture, original city camera and cyan/magenta ring paths. The penthouse, spinner and Tokyo Signals artwork are reused from their existing source files. Their original `.blend` files are not overwritten.

## Checkpoints

- `city-00-baseline.blend` — original geometry, native material equivalents, before additions.
- `city-01-lighting.blend` — five mounted LED media panels and the shared local lighting rig.
- `city-05-final.blend` — manufactured LED ribbons, varied native window shading and depth haze.
- `renders/00-baseline.png` through `renders/05-final.png` — same city camera, 1280 × 720, frame 1, AgX Medium High Contrast, exposure 0.
- `renders/detail-ribbon.png` — module seams, backing and fixed emitter grid.
- `renders/detail-media-window.png` — portrait mounting, neighboring glazing and local spill.
- `preview.html` — interactive checkpoint comparison.

## Lighting first

The baseline sky, moon, camera and exposure remain fixed. The lighting pass adds the five media surfaces from `shared/assets/city-lighting.json`, with aligned native area lights and six restrained maintenance lights. Existing ring spill is represented by eight native proxy lights per ring. This establishes source variety before any material or haze changes. The source manifest distinguishes Blender watts from the browser's analytic irradiance units; these are not interchangeable numeric quantities.

## Geometry and materials

`city-baseline.json` captures the original 139 building addresses, 496 occupied volumes, 793 architectural structure pieces, 1,531 window reveals and 24 vehicle poses. Exported geometry and world transforms are reused exactly in metre units. Three.js Y-up coordinates map to Blender as `(x, -z, y)`; the browser's outer 4× scene scale is removed from the camera as well.

`ribbons.json` is a direct geometry export of `shared/penthouse-ribbons.js`, including arc-length UVs, 40 cyan modules, 45 magenta modules, housings, collars and 35 mm seams. Native shaders preserve the fixed 40 mm emitter pitch and the slow 44-second content chaser. The inward luminous face is dimmer than the outward face.

Native glazing proxies have family-specific metallic/roughness response. Window UVs drive edge and corner shading, selected office partitions, cabinet silhouettes, partial blinds and stable room-level brightness differences. Rain roughness varies subtly without turning every surface into frosted glass. The haze volume begins 30 metres beyond the camera, preserving the clear foreground, with 0.0015/m density.

## Runtime parity and limits

The native project is an editable geometry and lighting study, **not a pixel-identical export of the website**. WebGL custom shader code cannot be exported through glTF as native Blender nodes. The website therefore retains its own ray-box interiors, shadow atlas, analytic local spill, reflection probes, depth haze and rain refraction. Native Blender uses material proxies, physically traced light transport and a volume. Both use the same architecture placements, lighting/media manifest and engineered ribbon mesh specification. The live site remains the authority for interaction, animated traffic, glass rain and UI performance.

The 24 native vehicle instances preserve the original frame-1 positions; their curved route animation remains in `shared/penthouse-traffic.js`. Billboard materials retain their native 192-frame animation drivers. The original room is retained in the native scene's hidden `03 | Existing penthouse` collection, so the city review is unobscured.

## Rebuild

Run from the repository root with Node and Blender 5.1:

```sh
node artwork/city-stages/export_city.cjs
node artwork/city-stages/export_ribbons.cjs
/Applications/Blender.app/Contents/MacOS/Blender --background --threads 8 --python artwork/city-stages/build_city_stages.py -- baseline
/Applications/Blender.app/Contents/MacOS/Blender --background --threads 8 --python artwork/city-stages/build_city_stages.py -- final
```

Keep `city-baseline.json` when reproducing the original checkpoint. Once it exists, the exporter writes `city-current.json` instead, preserving the baseline snapshot while capturing later runtime changes. Scripts intentionally require an isolated background Blender process, so they do not clear or alter the user's currently open scene. Each saved project packs the source images. `audit-*.json` and render logs record geometry counts, settings and render time.


## Live website stages and validation

Open `web-review.html` for the authoritative browser before/after comparison, including the lighting-only checkpoint and haze-on/off at identical exposure. These are 1280 × 720 REA captures, night exposure 1.08, reduced motion with animation time fixed at 0. Native Blender comparison settings are separate, as documented above; do not directly compare Blender exposure 0 with browser exposure 1.08.

The live pass adds five mounted media panels, eleven bounded analytic practical-light sources and six maintenance fixtures. Four local artwork files total about 2.6 MB. Shader-only content animation uses a fixed emitter grid and derivative-based distance filtering. The aircraft add red/green position lamps, staggered short white strobes and subtle underside accents without extra lighting draw calls. Their original curved routes and banking are unchanged.

The two ribbons retain their original centreline geometry and now contain 85 manufactured modules with an aluminium backing, 35 mm joints, 40 mm emitter pitch and a 44-second content pulse. Optical halo strength is lower than the baseline. The existing HDR bloom settings and final exposure were reviewed and retained, rather than increasing brightness globally.

Glazing now varies absorption tint and reflection sharpness by family, with pane-seeded blinds, recess occlusion and sill-related runoff. Near haze is reduced while distant layers remain stronger; a low-opacity layer uses the same practical-light field. In the browser these are controlled approximations, not path-traced volumes or real-time area shadows.

Validation: REA reported no console/page errors across city checkpoints, room, 390 × 844 mobile and haze-off captures. Manual browser checks covered panning, room/desk/city cameras, dusk/night, ceiling toggling, entering Leon's desktop, return and help. Geometry/transform hashes, all seven route curves and vehicle phase/speed data match the baseline. Buffers are finite; disposal and late texture-load callbacks pass.

The city-only structural submission count is 88 versus 78 before (mobile 87 versus 77). Repeated cabinet/housing geometry is instanced; the first draft's 143 submissions was reduced by 55. City geometry uses 75,132 triangles versus 81,456 before (mobile 38,372 versus 48,608). These counts exclude the unchanged loaded car asset and additional reflection/weather render passes. No new shadow-casting runtime lights were added. Shader work is higher because of local irradiance and media; GPU frame times across devices have not been benchmarked. Existing 45/30 fps caps remain unchanged. See `runtime-review.json` for the structural checks.
