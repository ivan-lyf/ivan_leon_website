# KUJIRA — holographic humpback

> Source distribution: the editable model, builder, metadata and interactive `preview.html` are included. Downloaded reference photographs and the four inspection PNGs listed below remain local study/review artifacts and are excluded from Git and the published site. Source image links retain their original attribution; no reference pixels are redistributed as runtime textures. See `../README.md`.

An original, editable 3D reconstruction guided by inspected natural-history imagery. The projection is staged as a quiet urban apparition rather than an advertisement. The anatomy is deliberately recognizable: long pectoral fins, broad horizontal flukes with a central notch, rear dorsal hook, throat pleats, small eyes, and rostral tubercles.

## Selected image references

- [NOAA Fisheries — humpback whale species page](https://www.fisheries.noaa.gov/species/humpback-whale), especially the **Dawn Witherington anatomical illustration**. Selected for lateral silhouette, long swept pectorals, throat structure, and the low posterior dorsal fin. [Selected image](https://www.fisheries.noaa.gov/s3/styles/original/s3/2023-03/640x427-Whale-Humpback-markedDW.png?itok=sRSndTGd).
- [NOAA Fisheries — breaching humpback photograph](https://www.fisheries.noaa.gov/s3/styles/full_width/s3/dam-migration/2160x1440_humpbackwhale_noaa.jpg?itok=c5Ha2-Fe). Selected for belly volume, longitudinal ventral grooves, and the narrow fin profile.
- [NOAA Stellwagen Bank — humpback tail, photograph by Dann Blackwood / USGS](https://sanctuaries.noaa.gov/pgallery/pgstellwagen/living/living_1.html), secondary tail reference.

Reference pixels are not used as website textures. The reference files are retained only for the editable model's art-direction record. Image rights remain with the credited sources. The hologram's fictional scale is approximately 29 metres, larger than an actual adult humpback; anatomical proportions are inspired by the reference, not a scientific specimen scan.

## Deliverables

- `holographic-whale.blend` — native Blender 5.1 project. Collection **Whale | Editable anatomical surfaces**, eight editable meshes, transparent scan-strata material, and a 12-second morph cycle. Preview collection contains only a camera and low-density interior particles.
- `../../shared/assets/models/city/holographic-whale.glb` — 955 KiB, 42,284 triangles, eight meshes, no texture dependency. Export contains a basic transparent emissive fallback; the live website installs the more detailed projection shader.
- `whale-anatomy.png` — shaded anatomical inspection.
- `whale-projection.png` — native Blender projection inspection.
- `whale-runtime.png` — standalone browser WebGL inspection captured with REA.
- `whale-city.png` — integrated city-camera inspection after the three-quarter pose and translucency revision; zero console/page errors.
- `preview.html` — interactive runtime study with orbit controls and pause.
- `build_whale.py` — repeatable source; runs only in an isolated background Blender process. It never replaces the user's open scene.

## Runtime integration

Load `shared/penthouse-whale.js` before the scene module. Create `PenthouseWhale.create(THREE,{lite})`, parent `.group` under the city-metre transform (the existing scene scales city units by four), and pass the loaded glTF object to `.load(gltf)`. This transfers asset ownership: geometry is baked into owned clones, then the original geometry, fallback materials, and any source textures are disposed. Duplicate or late loads are cleaned up too. Advance `.update(elapsedSeconds)` from the existing motion clock. `.dispose()` releases all owned geometry and materials. `.getStats()` exposes load state and the performance budget.

At time zero the centre is **(-3, 9, -108)** in Three's Y-up city coordinates, head generally toward +X, rolled 0.40 radians with a -0.28-radian yaw and 0.04-radian pitch (Three XYZ Euler). This exposes the near and far flukes and the long pectoral fins. The slow 286-second oval provides changes of depth, partial architectural occlusion, and a three-quarter first view. A 1.2-metre vertical tail wave and 0.58-metre fin suspension are evaluated in the vertex shader. Projection scan lines remain fixed in body coordinates; slow brightness modulation changes only their content. Derivative filtering prevents moire as the whale recedes. All projection layers and interior particles depth-test against architecture; none use screen overlays.

`.getLightState()` supplies a bounded local capsule light: `{position,axis,color,radius:24,halfLength:12,intensity}` in **city metres / linear colour**. Use the closest point on the ±12-metre body axis, a squared falloff to the 24-metre radius, and a normal-facing term. This shader-friendly proxy supports facade/window spill, reflective glints, and haze scattering without a global brightness increase. The website must connect this state to its own custom facade and atmosphere shaders; glTF does not carry that lighting logic automatically.

Blender and browser shaders implement equivalent art direction with different renderer mechanisms; they are not claimed to be pixel-identical. The Blender file retains real anatomy and an editable native animation, while the browser uses GPU deformations and layered additive surfaces. The internal points are 320 on desktop / 144 on mobile. Native source scan lines use transparency; browser lines use antialiased transparency with depth testing. Front/back emission contributions are deliberately unequal; shaded contours shift toward violet, the back shell is quieter, and thin fins carry less opacity. This avoids a uniformly cyan filled silhouette. No large lighting textures, per-particle lights, shadows, or full-screen render passes are added.
