# Asset Credits

## Classic-room 3D models

| Asset | Author | Source | License | Verified |
|---|---|---|---|---|
| Low-Poly Freeride Skis | Romainhj | https://sketchfab.com/3d-models/low-poly-freeride-skis-8b27a5ff5c6f436ab18d6d1d5862aeb5 | CC Attribution (CC BY 4.0) | 2026-07-02 |
| Low-poly Keyboard | (user-supplied file) | provided by site owner | user-supplied | 2026-07-03 |
| Old Table Lamp v01 | (user-supplied file) | provided by site owner | user-supplied | 2026-07-02 |
| 1960s Office Chair | (user-supplied file) | provided by site owner | user-supplied | 2026-07-03 |

Models were optimized for web delivery (Draco mesh compression + WebP textures ≤1024px via
gltf-transform); geometry and materials otherwise unmodified.

## Textures

Wood PBR set (`shared/assets/textures/wood_*.jpg`): pre-existing in the repository
(downscaled to 1024px). Floor planks, desk-wood grain accents, and all grime/label
textures are generated procedurally at runtime — no third-party texture assets.

Wall plaster PBR set ("Plaster001") from ambientCG.com — https://ambientcg.com/view?id=Plaster001 — CC0 1.0 (verified 2026-07-02), downscaled/re-encoded.
Ceiling plaster ("Plaster002") from ambientCG.com — https://ambientcg.com/view?id=Plaster002 — CC0 1.0 (verified 2026-07-02).

## Audio

The ambient room tone is synthesized in-browser with the Web Audio API
(`shared/scene-audio.js`) — no recorded asset, no third-party license.

## Other classic-room geometry

The Macintosh, desk, mug, and room geometry are procedural (built in code
with Three.js primitives) — no external assets. The table lamp is the user-supplied
GLB credited above.


## Leon's penthouse

The original penthouse architecture, desk, chair, compact computer, keyboard, mouse and ceiling LED panels were created for this website in Blender 5.1. The current browser workstation replaces the compact computer, keyboard and mouse with the owner-supplied procedural package credited below; the room and editable Blender checkpoint retain their original authoring provenance. The chair is an original model for this scene; the classic room retains its existing credited chair and table lamp assets. Leon's penthouse has no desk lamp.

The editable Blender file and reproducible authoring scripts are in `artwork/penthouse/`. The web model is `shared/assets/models/penthouse/penthouse-v2.glb`. The Blender source retains the individual authored objects and lighting rig; the GLB groups meshes for web delivery and embeds Cycles-baked ambient occlusion. The skyline, atmospheric and wet-glass/rain shaders began as original implementation work; the current exterior also incorporates revisions from the user-provided `Cyberpunk penthouse scene realism.zip`, as noted below. The scene opens at night, with four recessed square ceiling panels, polished stone reflections and a local cubemap of the actual room.

Granite Tile PBR maps (`shared/assets/textures/penthouse/granite_tile_*_1k.jpg`) by Charlotte Baglioni / Poly Haven: https://polyhaven.com/a/granite_tile. CC0: https://polyhaven.com/license. Downloaded as official 1K JPEG diffuse, roughness and OpenGL normal maps; MD5 verified against Poly Haven's API on 2026-10-17. The Blender model also embeds the repository's existing wood and ambientCG plaster texture maps credited above. The AO atlases and separate linear indirect-light PNGs are generated in Cycles from the original Blender geometry and ceiling-light rig. The indirect atlases are denoised through Blender's compositor with OpenImageDenoise; this is an authoring step and adds no browser dependency.

Felix Rieseberg's site (https://felixrieseberg.com/) was studied with REA (https://github.com/morluto/rea) for lighting, material, rainfall, wet-glass and spatial interaction techniques. No reference-site model, texture, source code, copy or media was incorporated.

The city architecture was visually studied from Weta Workshop production concepts and the miniature work documented by Further Fabrication. The flying vehicle is newly constructed Blender geometry based on George Hull's published K-spinner concept artwork, not a downloaded film model. The square ceiling fixtures use Philips CoreLine Panel imagery as a shape reference, enlarged into custom 1.2 m panels. The user's attached city image guided the density and placement of architectural lighting. Reference images remain study material outside the website runtime; they are not packaged as website textures. Exact image links, authors and adaptations are recorded in `artwork/penthouse/REFERENCES.md`.

AXL, Prism and Vectra are original fictional corporate marks, originally drawn in local canvas and now supplied as PNGs in `shared/assets/logos/` for the active city. Their design study used [IBM's official 8-bar guidance](https://www.ibm.com/design/language/ibm-logos/8-bar/), [Rob Janoff's Apple logo history](https://www.robjanoff.com/applelogo), and [Microsoft's official identity history](https://blogs.microsoft.com/blog/2012/08/23/microsoft-unveils-a-new-look/). The adaptation uses horizontal stripe rhythms, six-color bands, geometric symbols and forward-leaning type; no source company logos are included. The earlier generated portrait advertisement has been removed from the runtime.

### Vendored runtime libraries

The existing Three.js r128, OrbitControls, GLTFLoader, DRACOLoader, and html-to-image 1.11.11 runtime dependencies are vendored at their prior versions for dependable local previews. License notices are included in `shared/vendor/`. Draco decoders are the official Three.js r128 distribution, under Apache-2.0; their license is included in `shared/vendor/draco/LICENSE.txt`.

Additional Three.js r128 helpers, under the same MIT license:

- `shared/vendor/Reflector.js`: https://github.com/mrdoob/three.js/blob/r128/examples/js/objects/Reflector.js.
- The bloom pipeline uses `EffectComposer.js`, `RenderPass.js`, `ShaderPass.js`, `MaskPass.js`, `CopyShader.js`, `LuminosityHighPassShader.js` `UnrealBloomPass.js` and `FXAAShader.js` from the [Three.js r128 examples](https://github.com/mrdoob/three.js/tree/r128/examples/js).
- `shared/vendor/RectAreaLightUniformsLib.js`: https://github.com/mrdoob/three.js/blob/r128/examples/js/lights/RectAreaLightUniformsLib.js. This retains its upstream attribution to the linearly transformed cosine area-light work by Eric Heitz, Jonathan Dupuy, Stephen Hill and David Neubelt.


### Holographic whale and industrial city revision

The original humpback geometry was reconstructed in Blender from NOAA Fisheries' Dawn Witherington anatomy illustration and NOAA/USGS humpback photographs. Reference images are study material, not website textures or third-party meshes. Exact image links and anatomical adaptations are recorded in `artwork/holographic-whale/README.md`. The industrial retrofit architecture continues the Further Fabrication / Wētā miniature study; selected photographs and design observations are in `artwork/city-revision/REFERENCES.md`. The earlier LED billboard artwork remains archived and is not loaded by the active city. The original AXL, Prism and Vectra marks are active again as supplied PNG assets.


### User-provided exterior package

`Cyberpunk penthouse scene realism.zip`, provided by the site owner, supplies the current browser exterior revisions and the corporate/tenant signage modules. `shared/penthouse-corporate.js` uses the original AXL, Prism and Vectra PNGs and draws the fictional KUJIRA Projection Arts, OKAMI Heavy Industries and Halcyon Life Sciences identities. `shared/penthouse-signage.js` draws the tenant words and pictograms in a local canvas atlas. These package additions are credited to the user-provided archive; no additional author or license attribution is inferred.

This import leaves the existing penthouse model, its materials/lightmaps and the native Blender source projects unchanged.


### User-provided workstation package

`workstation.zip`, provided by the site owner on 2026-10-18, supplies the LM-7 terminal, LM-77 keyboard, mouse, floor port and cables in `shared/penthouse-workstation.js`. Geometry, material textures, labels and keyboard legends are generated locally in Three.js/canvas. The package uses system fonts for kana, kanji and symbol glyphs; no font binaries are redistributed by this addition. The original handoff is retained in `artwork/workstation/HANDOFF.md` as an upstream reference. No additional author or license attribution is inferred from the archive.

The integration adapts resource ownership and cleanup, connects the live desktop texture and existing camera transition, and preserves silent keyboard hover/click feedback. This replacement is applied in the browser; it does not rewrite the Blender source projects. Generated review captures and downloaded study photographs remain local archive material and are excluded from the published source distribution, as described in `artwork/README.md`.
