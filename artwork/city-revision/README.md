# Retrofit city revision

> Historical authoring record. The final `city-revised.blend`, scripts and reconstruction inputs are included. The earlier architecture checkpoint, render/browser captures, verification outputs and comparison HTML pages listed below are local archives, excluded from Git and the published site. Later browser-only city and workstation imports do not rewrite this native checkpoint. See `../README.md`.

This is a separate native Blender revision of the existing city. The original `artwork/city-stages` files and source room remain preserved. The website is the authoritative interactive result.

## Design changes

The same seeded occupied cores and anchor positions acquire heavy opaque retrofit skins, deep mechanical floors, asymmetrical utility shafts, loading decks, diagonal structural members, exposed paired conduits and grouped repair patches. Glazing is subordinate to industrial construction. The two anchor towers retain their general placement and roof heights.

Window use is grouped by industrial, residential and office zones. Mostly dark floors, dim neutral interiors, some soft tungsten rooms and occasional industrial cool light replace the evenly bright blue/yellow checkerboard. The physical skin hides large areas of former curtain wall.

The whale is appended from its separately authored anatomical Blender source, with translucent scan strata, animated body/flipper morphs, interior specks and local cyan-blue illumination. Large billboard cabinets and orbital ribbon spectacle are removed. The remaining light markers belong to docking, maintenance and service infrastructure.

## Files and workflow

- `export_city.cjs` exports current Three.js geometry and instance transforms, in city metres (Y-up), into `city-revised.json`.
- `build_city_revision.py` reconstructs native editable geometry and materials in background Blender. It preserves the open user scene.
- `city-revised.blend` is the native result.
- `city-01-architecture-materials.blend` and `renders/00-retrofit-architecture.png` preserve the architecture/material checkpoint.
- `renders/01-revised-city.png` uses the existing city camera (52° vertical FOV, 1280 × 720, frame 1, exposure 0, AgX).
- `renders/02-retrofit-detail.png` inspects physical facade layers and maintenance docks.
- `whale-native.json` records the source collection and initial placement.
- `verification.json` records renderer, object counts and source parity.

The prior native comparison image is `../city-stages/renders/05-final.png`, using the same city camera, resolution, frame and exposure. Compare web captures separately: native Cycles light transport, transparent materials and volume are equivalent implementations, not pixel-identical exports of the website’s custom GLSL.

Run from the repository: `node artwork/city-revision/export_city.cjs`, then background Blender with `--python artwork/city-revision/build_city_revision.py`. Do not run the builder inside the live user scene.

## Runtime contract

`PenthouseArchitecture.populate` retains the original arrays. Each occupied volume supplies `useClass` (0 industrial, 1 residential, 2 office) and `skin` (0 industrial armor, 1 residential repair zones, 2 institutional slots, 3 mixed retrofit). Structural parts may provide XYZ Euler `rotation`; occupied volumes remain axis-aligned. Small facade pieces have `collision: false` and remain inside the existing clearance margin; substantive docks and new service volumes are obstacles.

See `REFERENCES.md` for the source image study. Reference pixels are not redistributed.

Native service-well area lights use physically interpreted Blender wattage to make material relief legible. Those powers are renderer-specific approximations, not literal exports of WebGL analytic irradiance values. Camera, world ambient and exposure are held fixed; the directional storm key and motivated service wells are tuned locally.

The native final file includes a complete 6,855-frame orbit at 24 fps, using the runtime’s same elliptical centerline and orientation parameters. Root-attached illumination follows the whale, and ten valid shape drivers maintain the native tail/flipper motion throughout the orbit. All seven external room texture images are packed. Final scene: 8,372 objects, 13 lights, eight anatomical whale meshes. The web uses instanced batches instead of this editable object-per-part layout.
