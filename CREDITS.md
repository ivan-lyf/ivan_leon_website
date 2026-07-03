# Asset Credits

## 3D Models (Sketchfab)

| Asset | Author | Source | License | Verified |
|---|---|---|---|---|
| Low-Poly Freeride Skis | Romainhj | https://sketchfab.com/3d-models/low-poly-freeride-skis-8b27a5ff5c6f436ab18d6d1d5862aeb5 | CC Attribution (CC BY 4.0) | 2026-07-02 |
| Low-poly Keyboard | (user-supplied file) | provided by site owner | user-supplied | 2026-07-03 |
| Old Table Lamp v01 | (user-supplied file) | provided by site owner | user-supplied | 2026-07-02 |

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

## Everything else

The Macintosh, desk, mug, and room geometry are procedural (built in code
with Three.js primitives) — no external assets. The table lamp is the user-supplied
GLB credited above.
