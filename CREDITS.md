# Asset Credits

## 3D Models (Sketchfab)

| Asset | Author | Source | License | Verified |
|---|---|---|---|---|
| Low-Poly Freeride Skis | Romainhj | https://sketchfab.com/3d-models/low-poly-freeride-skis-8b27a5ff5c6f436ab18d6d1d5862aeb5 | CC Attribution (CC BY 4.0) | 2026-07-02 |
| Lowpoly 65% Mechanical Keyboard | sleepyjoshua | https://sketchfab.com/3d-models/lowpoly-65-mechanical-keyboard-0cdd429eb08549ac954352169de5c8f8 | CC Attribution (CC BY 4.0) | 2026-07-02 |
| Intermediate Advanced Snowboard | Final Render Animation Studio | https://sketchfab.com/3d-models/intermediate-advanced-snowboard-267e04a025434d7d8587ec2ee60ad62e | CC Attribution (CC BY 4.0) | 2026-07-02 |

Models were optimized for web delivery (Draco mesh compression + WebP textures ≤1024px via
gltf-transform); geometry and materials otherwise unmodified.

## Textures

Wood PBR set (`shared/assets/textures/wood_*.jpg`): pre-existing in the repository
(downscaled to 1024px). Wall plaster, floor planks, desk-wood grain accents, and all
grime/label textures are generated procedurally at runtime — no third-party texture assets.

## Audio

The ambient room tone is synthesized in-browser with the Web Audio API
(`shared/scene-audio.js`) — no recorded asset, no third-party license.

## Everything else

The Macintosh, desk, lamp, mug, bonsai, and room geometry are procedural (built in code
with Three.js primitives) — no external assets.
