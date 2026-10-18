# LM-7 workstation integration

The site owner supplied `workstation.zip` on 2026-10-18. Its procedural Three.js r128 workstation is adapted in `../../shared/penthouse-workstation.js`. `HANDOFF.md` is the upstream archive brief, preserved as a reference. The archive's stand-in preview room is not used by the website.

## Scene contract

The scene creates the workstation after loading and scaling the existing room GLB, then calls `PenthouseWorkstation.replaceIn`. It replaces only meshes with the `COMPUTER_`, `KEYBOARD_`, `MOUSE_` and `SCREEN_SURFACE` prefixes, placing the new parts on their previous footprints. The `DESK_*` geometry supplies the tabletop height (0.7500 m), and the raised mat supplies its top surface (0.7535 m); the keyboard and mouse sit on the mat. Cable routes account for both surfaces and the full tube radius, keeping the cables above the desk and mat before they drop behind the desk into the added floor box. Room, desk, chair, mat, ceiling, glazing, material atlases, city and night-lighting settings are retained.

The LM-7 terminal is 0.31 × 0.335 × 0.32 m. The LM-77 keyboard is 0.326 × 0.124 m with 67 keys; the mouse is 0.064 × 0.114 m. The integrated generated set contains 85 meshes and 66,976 triangles before the scene's hover outline. Generated canvases provide worn materials, labels and legends without external asset requests. System-font availability affects Japanese and symbol glyphs.

## Interaction and live screen

`SCREEN_SURFACE` receives the existing live desktop CanvasTexture through `adoptScreen`. The CRT shader uses the projected texel footprint and mip filtering to soften unresolved desktop dithering while retaining nearby detail. Its texture dimensions follow canvas refreshes. The current camera entry/return transition derives alignment from this new screen; clicking the terminal or mouse still enters the computer.

Hovering the keyboard shows a white outline. Click, tap or `K` gives silent visual feedback and does not enter the desktop. No keyboard clicking sound is loaded. Workstation status lights and OLED animation use the scene's existing elapsed time, respecting motion pause and reduced-motion settings.

## Integration fixes

- Replacement retires resources exclusive to removed meshes while preserving geometry, materials and texture atlases still shared with retained room meshes.
- Cable placement measures the tabletop and raised mat separately, seats the keyboard and mouse on the mat, and clears both surfaces with the complete cable tube rather than only its centerline.
- Cable rebuilding disposes the replaced tube geometries and removes them from the ownership registry.
- Workstation disposal is idempotent and releases its generated resources once. The scene owns the live desktop texture; caller-supplied screen material and texture are not treated as workstation-owned assets.
- Adopting the CRT material retires the transient scene screen material, and its texture-size synchronization includes height-only canvas changes.

The standalone runtime validation covered actual GLB replacement, unchanged retained room/furniture buffers and transforms, finite animation updates, the key layout, screen ownership/resizing, shared-resource retirement, repeated cable rebuilding and idempotent disposal. Browser verification is performed separately during release.

The editable penthouse Blender file retains its earlier compact workstation. This browser replacement does not change or re-export that native source.
