# Tenant banner refresh — 22 October 2026

Source: user-supplied `banners.zip`, Street signal pack v2. The authoring library is preserved in `banner-designs.js`; only its 53 v2 designs are used. The 30 legacy designs are excluded.

## Placement plan

- Distribute the 73 production panels across 18 room-visible buildings, with at most six panels per whole building, counting all tiers and side walls. Visit each address once per placement round so large landmarks cannot absorb most of the collection. The former focal building now carries only four separated panels.
- Reopen the clear left and middle-distance skyline out to X −240 / Z −285 instead of constraining signs to the previous ten-building central group. Keep all placements above −24 m, within the authored room-camera composition, with an unobstructed centre and both horizontal edges. This spreads art into visible neighbouring facades without dropping it beneath the room window.
- Bring animated designs forward. On the nearest clear frontage at approximately X −69 / Z −69 (panel face), a scrolling restaurant sign sits above a flipping beer sign and a pulsing neon graphic. In the production layout, 26 animated panels occupy near/middle facades at Z > −120. More distant neighbours carry a quieter mix of art and typography.
- Retain a modest four-panel unbranded group immediately left of KUJIRA, on building 41 at approximately X −99.8 / Z −140.9. A restaurant header, two separated pictograms and a lower shop banner replace the previous ten-panel stack.
- Keep warm food/retail themes toward the left and nightlife/cultural designs toward the centre, while covering all 53 supplied designs. Fill unused artwork before repeating a design globally; an individual building may use each design only once, including its tiers and side walls. Matching designs also require at least 60 city metres between the complete occupied building footprints and 0.18 normalized projection units of separation in the authored room view. Never force an overlapping duplicate simply to fill the 73-panel budget; alternate authoring seeds may yield fewer panels.
- Fit every tilted panel to its wall, leave clear gaps, and preserve all corporate logo exclusion areas. AXL, Prism, Vectra, KUJIRA, OKAMI and Halcyon assets, placements, shaders and lighting are unchanged. No architecture or room edits are part of this placement pass.
- Compose once against the authored room camera transformed into city-local coordinates, independently of browser size and render quality. Lite retains the first 50 addresses. Bounds are cached during packing; the same atlas, two instanced draws and shader-only animation remain, with no per-frame layout or texture work.

## Performance plan

Bake the supplied canvas artwork once into an atlas instead of painting it on visitors’ CPUs. This also makes all nine scripts independent of installed fonts. Use a 2048 × 2048 full atlas and a 1024 × 1024 lite atlas with identical UVs, padded frames and mipmaps. Keep the 73-sign full ceiling / at most 50 lite (the mounted production layout uses 73 full panels), one instanced face draw and one instanced halo draw. No video decoders, extra lights, shadow maps, per-frame canvas uploads or extra rendering passes.

Animations run in the shader from a single time uniform. Compare identical room/city camera runs against the previous signage, including CPU frame time, GPU timing where supported, frame pacing, texture memory, draw calls and console errors. The refresh was reviewed locally before release.

## Assets and rebuild

`shared/assets/signage/banners-v2.js` contains the compact metadata; the two lossless WebP atlases use the same normalized UV layout. Full texture: 2,186,734 bytes; lite texture: 888,774 bytes. Only the selected quality tier is downloaded. RGBA8 with mipmaps is about 21.33 MiB full / 5.33 MiB lite, compared with about 26.67 MiB for the previous full canvas atlas.

For reproducible authoring, serve the repository and open `artwork/signage/build-atlas.html` on macOS with the supplied script fonts installed. The page emits `#atlas-export` JSON with PNG, contact sheet and layout metadata. Convert its PNG to lossless WebP (method 6); downsample it to 1024 square with Lanczos for lite. Preserve the manifest’s 2048-based coordinates. The shipping application never loads this authoring page or drawing library.

Each frame has an eight-pixel extruded gutter (four pixels in lite). The shader computes UV derivatives before scroll wrapping, constrains the mip footprint, and uses explicit gradients where supported to prevent scroll seams and adjacent-cell contamination. Animation state is a single time uniform; the images are uploaded once.

## Validation

The room-facing revision is checked against the authored room camera transformed into city-local coordinates (the scene scales city geometry by four). Placement tests verify the complete 53-design library, the four-panel unbranded group, the six-panel building cap, broader distribution and nearby animation mix, the raised facade band, clear room-camera sightlines, deterministic quality tiers, wall bounds and corporate-logo clearance.

### Prior atlas revision measurements

The captures and timings below were collected before the room-facing placement revision. They validate the shared atlas and previous placement; they do not establish the new visible-scene draw counts or frame rate.

That earlier layout placed all 53 designs across 73 panels; lite used 50 panels. Placement and lifecycle tests check determinism, wall bounds, logo clearance, non-overlap, atlas padding, animation frames and disposal. Browser captures at 2550 × 1440 / DPR 1 and 390 × 844 / DPR 2 rendered without page or console errors. These are viewport checks, not tests on Windows or mobile hardware.

The prior matched-camera measurements recorded two signage draws, 360 total room draws / 266 city draws, and unchanged geometry, triangle and texture counts. Full banner texture memory falls by 20%. Initial paired CPU frame times stayed comparable (room 1.77 → 1.82 ms; city 1.25 → 1.27 ms). City frame rates varied substantially, including on the unchanged baseline during the reverse-order retest, so the measurements do not establish an FPS improvement or regression. Detailed reports and comparison images are in the workspace’s `outputs/banners/performance/` directory. These captures document the local review before release.


### Room-facing placement revision

The revised placement passed deterministic full/lite layout, corporate clearance, three-point city occlusion, atlas/lifecycle and shader-stability checks. The authored camera is converted into city-local coordinates using the scene’s ×4 scale. A fresh 1440 × 900 capture from the default room camera shows the raised clusters without panning and has no page or console errors (`outputs/banner-focus/room-focused.png` in the workspace). This is a visual and structural check, not a new FPS comparison.

### Prior broader distribution and attachment correction

That placement revision used 71 panels on 18 buildings, with all 53 designs represented, a six-panel cap and no duplicate artwork on any one building. Twenty-five animated panels sat on nearer facades. All 13 CPU regression suites pass, including physical brace attachment checks and signage placement/shader checks. That room capture is `outputs/building-lines/room-spread.png` in the workspace. Geometry corrections add 22 small instanced mounting blocks, with no new draw call, material, texture or rendering pass. These checks do not constitute a new FPS benchmark.

### Physical banner models and neighborhood artwork spacing

The current mounted layout has 73 full-quality panels, all 53 designs, 18 buildings and 26 nearby animated panels. Lite uses the first 50 addresses, each with unique artwork. No building repeats an artwork; repeated designs on separate buildings must clear both the 60-metre footprint spacing and the room-composition separation rule.

`shared/penthouse-signage-mounts.js` fits each panel to its real owning facade and preindexed cladding, including rotated parts and the occupied mesh chamfers. It gives every panel a solid 0.26-metre metal cabinet and two brackets whose ends penetrate their supports. The luminous face stays 0.04 metres ahead of the cabinet to avoid coplanar flicker. Candidates that cannot be physically supported are rejected. These are browser model changes; the native Blender source has not been regenerated.

The cabinet and brackets are combined with the existing architectural instance batch after corporate placements and traffic obstacles are resolved. Full quality adds 219 simple boxes / 2,628 triangles, with no additional draw call, material, texture, light or rendering pass. Mount fitting and neighborhood checks run once during loading; animation remains shader-driven. In five local Node samples the complete one-time planner took 281–293 ms; this is not a browser FPS benchmark.

Run `node tests/signage-layout.cjs`, `node tests/signage-mounts.cjs`, `node tests/display-layout.cjs` and `node tests/display-shader-stability.cjs`. The room capture is `outputs/building-lines/room-mounted.png` in the workspace.
