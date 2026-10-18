# Penthouse visual references

Reference study for the 2026-10-17 and 2026-10-18 revisions. These sources explain how each element was developed. Reference photos and film concept images are study material kept under the working directory, outside the delivered website. The runtime uses authored geometry, original shaders, credited CC0 surface maps and original fictional corporate marks.

| Scene element | Source image or page | What was adapted |
|---|---|---|
| Flying vehicle | [George Hull — Blade Runner 2049 conceptual art](https://www.ghull.com/_page-template); [high three-quarter K-spinner image](https://images.squarespace-cdn.com/content/v1/54aaff70e4b00bf98ffdc7e8/1640857693035-VCJDCESG2M9UL9C6VLHF/LASPD_SpinnerMakerHigh3q_v3_gh.jpg); [br3.jpg](https://images.squarespace-cdn.com/content/v1/54aaff70e4b00bf98ffdc7e8/1509147873450-AZPKNCWTJTV62ZO3BPAB/br3.jpg) | Low, broad vehicle proportions, enclosed cabin and angular industrial body language. Built as a separate Blender model for readable silhouettes in moving city traffic; no downloaded production mesh. |
| City building massing and detail | [Further Fabrication — Blade Runner 2049 miniatures for Weta Workshop](https://www.furtherfabrication.com/blade-runner-2049); [miniature reference image](https://images.squarespace-cdn.com/content/v1/56f1c163d210b859f104ab91/1518071055289-V6QQP6LJNASB1U68DAXX/BhVS14y.jpg) | Layered towers, setbacks, deep facade fins and small structural details. The later massing pass varies stepped crowns, split shafts, staggered slabs, industrial terraces and curved towers within this same reference language. These inform original procedural building families and the balance of large masses against fine detail. |
| City atmosphere and architectural scale | [Weta Workshop concept image — Bladerunner2049_Design_011](https://www.wetaworkshop.com/web/image/97713-56799ba0/Bladerunner2049_Design_011.jpg) | Dense overlapping silhouettes, height separation, haze and restrained readable light sources. The layout and geometry are newly constructed for the penthouse view. |
| Square ceiling LED panels | [Philips CoreLine Panel gen6 product page](https://www.lighting.philips.com/content/signify-multibrand/aa/en/product/product-detail-page.911401800887_EU.html); [manufacturer product image](https://www.assets.signify.com/is/image/Signify/CoreLine-panel-G6-W60L60-RTP) | Flush opal face, recessed ceiling opening and a minimal perimeter rim. The reference product is 600 × 600 mm; our four custom Blender panels use 1.20 × 1.20 m diffusers and concealed 1.26 m housings. The diffuser is flush with the 3.2 m finished ceiling; the rim extends just 2 mm below it. |
| Polished stone floor | [Poly Haven — Granite Tile, Charlotte Baglioni](https://polyhaven.com/a/granite_tile); [CC0 license](https://polyhaven.com/license) | The credited diffuse and normal maps supply stone variation. Authored slab geometry, low roughness and the room's planar reflection create the polished finish. Unlike the film references, these licensed texture pixels are included in the runtime asset. |
| Rain, window optics and room rendering | [Felix Rieseberg's interactive room](https://felixrieseberg.com/), inspected with [REA](https://github.com/morluto/rea) | Quality reference for baked lighting, room reflections, restrained bloom, exterior streaks and small lens-like glass beads. Our geometry, weather shaders and interaction code were written for this scene. |
| Architectural LED composition | User-attached futuristic city reference image; external author/source not supplied | The visual brief guided neon scale and placement among dark towers. The latest scene uses perimeter bands and tilted orbital rings instead of advertising. The image is not used as a runtime texture. |
| AXL striped lettering | [IBM — official 8-bar guidance](https://www.ibm.com/design/language/ibm-logos/8-bar/) | Horizontal bar rhythm and optically balanced gaps inform the original AXL letters. No IBM mark is reproduced. |
| Prism spectrum identity | [Rob Janoff — Apple logo history](https://www.robjanoff.com/applelogo) | The designer’s six-band color treatment informs an original geometric gem with a serif wordmark. No Apple silhouette is used. |
| Vectra technology identity | [Microsoft — official identity announcement and history](https://blogs.microsoft.com/blog/2012/08/23/microsoft-unveils-a-new-look/) | The earlier long-lived wordmark and geometric color heritage inform slanted type, a small tile symbol and an optical notch. The resulting name and composition are original. |
| Existing workstation and glazed penthouse | Original Blender scene from this project | The correctly scaled desk, chair, computer and full-height glazing are retained, with material and lighting refinements. No new external furniture photo or third-party furniture mesh was introduced in this revision. |

## Rendering refinements

Office floors are spaced at 3.2 m, with narrow glazing bays, ray-box interior mapping, grouped occupancy and antialiased detail. Raised mullions, sills and sunshades give nearby facades physical depth. Six structural forms and five facade palettes (graphite glass, weathered stone, bronze, ceramic and dark industrial metal) provide silhouette and material variation. A CPU-baked directional visibility atlas supplies city-only neighbour shadows, while denser layered haze softens the distant buildings. Chamfered corners, wet PBR cladding and an exterior reflection probe improve material definition. The orbital LEDs use luminous diffusers inside metal housings, coloured halos and coordinated facade spill. The Blender desk mat is enlarged to 0.90 × 0.40 m while preserving the workstation proportions. The traffic model follows curved routes with roof clearance, directional lamps and two pursuit pairs. Wet-glass refraction is filtered by projected size and distance. HDR lighting stays linear through all scene and reflection captures, then bloom, before one final exposure/display transform, with a portable fallback for unsupported devices.

The earlier AI-generated `AFTERHOURS` portrait advertisement is archived outside the website runtime and is no longer displayed.

## Implementation locations

- Room and fixture authoring: `build_scene.py`, `penthouse-studio.blend`.
- Baked lighting: `bake_ao.py`, `bake_indirect.py`, `denoise_indirect.py`.
- Web model: `../../shared/assets/models/penthouse/penthouse-v2.glb`.
- Flying vehicle source: `../spinner/skyline-spinner.blend` and `../spinner/build_spinner.py`; exported model: `../../shared/assets/models/city/spinner.glb`.
- Building forms and material metadata: `../../shared/penthouse-architecture.js`.
- Static building shadow atlas: `../../shared/penthouse-city-shadow.js`.
- Architecture, perimeter LEDs and original corporate marks: `../../shared/penthouse-city.js`.
- Traffic paths and vehicle lighting: `../../shared/penthouse-traffic.js`.
- Real-time lighting and reflection: `../../shared/penthouse-scene.js`.
- Rain and window lenses: `../../shared/penthouse-weather.js`.

The original concept artists and manufacturers retain their rights in the reference images. The source links document visual study; they do not imply endorsement or a redistribution license for those images.
