> Upstream reference from the site owner's `workstation.zip`, supplied 2026-10-18. The original package instructions below are retained for provenance. Its file layout, standalone preview and hotspot descriptions are not the final integrated site contract. See `README.md` in this directory for integration changes, silent keyboard feedback and resource ownership.

# LM-7 workstation handoff: terminal, keyboard, mouse, floor port

Date: 18 Oct 2026. Stack: Three.js r128 UMD, a single static script, no assets or build step. This replaces the beige computer, keyboard and mouse in the room GLB (`penthouse-v2.glb`) with procedural, much more detailed versions that match the rain-city scene.

## Contents
```
workstation/
  HANDOFF.md
  shared/penthouse-workstation.js   the whole set (geometry, materials, textures, animation, cables)
  workstation-preview.html          desk stand-in (CDN r128). Drop the city scripts next to it to get the live city backdrop.
```
Load after three.js: `<script src="shared/penthouse-workstation.js"></script>`. It defines `window.PenthouseWorkstation`.

## Design: a second-hand 2070s terminal, patched over the years
Units are metres, Y-up, front faces +Z, and every part's origin is at the centre of its base.

**LM-7 terminal (0.31 × 0.335 × 0.32 m)**
- Sun-yellowed ABS front bezel (mottled colour plus roughness map, speckle, handling marks) over an anodised gunmetal body with brushed streaks.
- 26 heatsink fins, top and tube-housing vent slots, and a stepped CRT tube housing.
- CRT face: a 4:3 curved phosphor screen (0.214 × 0.16 m, 7.5 mm bulge that never dips behind the gasket), rubber gasket, raised ABS lip with an edge ring, and a clear-coated glass layer for glare.
- Chin: engraved LEON / 端末 LM-7 badge on a metal plate, vent grille, a KUJIRA "NIGHT_SWIM v3" data card half-inserted with a lit cyan edge, and PWR / HDD / NET / LNK status LEDs with printed labels.
- Flanks: power rocker with a red lamp, high-voltage sticker (高電圧) and a KUJIRA Projection Arts asset tag with a barcode. A strapped-on uplink module carries an antenna with a red strobe, a cyan lamp and its own cable.
- Rear: port panel with plugs; three cables cross the desk, drape over its rear edge and drop into the floor box.

**LM-77 keyboard (0.326 × 0.124 m, 6° wedge)**
- 67-key 65% layout with JIS kana sub-legends, in an anodised frame case with brass screws. Switch housings are visible between the caps.
- Two-tone PBT caps: cream alphas, gunmetal modifiers, orange Esc, teal Enter, cyan-legend arrows. Row-sculpted heights and tilt, worn shine on the home keys.
- Scrolling amber OLED strip, knurled aluminium knob with a lit ring, front badge, rubber feet.
- Aviator plug with a brass collar, and a teal paracord coiled cable to the terminal's left socket.

**Mouse (0.064 × 0.114 m)**
- Sculpted ABS shell over a gunmetal skirt, with button and palm split lines.
- Rubber scroll wheel with a cyan light ring, magenta DPI lamp, thumb buttons, glides, and a cable to the right socket.

**Floor port**
- Recessed gunmetal service box with a flipped-open lid, brush grommet, hinges, a green live lamp and a 240V label. It sits on the floor 10 cm behind the desk's rear edge, in line with the terminal.

**Animation** (`update(t)`, in seconds): HDD flicker, NET double-blink, LNK pulse, antenna strobe, uplink blink, OLED marquee, and breathing card edge, knob ring and wheel lights.

**Budget**: about 86 meshes and 67k triangles. Keycaps and switch housings are each one merged draw; fins, vents and brush bristles are instanced. All textures are generated canvases (absColor, absRough, metalColor and metalRough at 1024/512, the keycap atlas at 2048 × 640, plus small decals).

## API
```js
const ws = PenthouseWorkstation.create(THREE, {
  anisotropy,        // optional, default 8
  screenMaterial,    // optional: material for SCREEN_SURFACE (default dark placeholder)
  cableRoute: { deskEdgeZ: -.4, floorY: -.763, deskThickness: .04 }  // group-space metres
});
ws.group                 // add this to your scene (scale ×4 if your world is 4 units / m)
ws.computer, ws.keyboard, ws.mouse, ws.floorBox   // position these, then call rebuildCables()
ws.screen                // SCREEN_SURFACE mesh
ws.rebuildCables()       // re-routes coil, mouse cable and rear loom between the current part positions
ws.setCableRoute({deskEdgeZ, floorY, deskThickness})  // and rebuilds
ws.adoptScreen(texture) // swap SCREEN_SURFACE to the filtered CRT material, sharing that texture (refreshes keep working)
ws.update(seconds); ws.getStats(); ws.dispose();
PenthouseWorkstation.replaceIn(THREE, roomModel, ws)  // swap-in helper, see below
```

## Integrating into the room (penthouse-scene.js)
In `loadPenthouse()`, right after `model.scale.setScalar(4); scene.add(model); model.updateMatrixWorld(true);` and **before** `model.traverse(...)`:
```js
const workstation = PenthouseWorkstation.create(T, { anisotropy: renderer.capabilities.getMaxAnisotropy() });
PenthouseWorkstation.replaceIn(T, model, workstation);
```
**After** the traversal (once `screenMaterial()` has been assigned), hand the screen texture to the filtered CRT material:
```js
workstation.adoptScreen(screenTexture);   // the CanvasTexture from screenMaterial()
```
Then call `workstation.update(elapsed)` in `animate()` and `workstation.dispose()` in `dispose()`.

What `replaceIn` does:
1. Removes every old mesh named `COMPUTER_*`, `KEYBOARD_*`, `MOUSE_*` or `SCREEN_SURFACE*`, and records each part's footprint in model-local metres.
2. Places the new terminal, keyboard and mouse on those footprints, levelled to one desk height.
3. Takes the desk's rear edge from any `DESK_*` mesh (falling back to 0.3 m behind the terminal) and puts the floor at model y = 0. It then places the floor box and routes all cables.

Because it runs before the traversal, your existing code still:
- adds the hotspots (`COMPUTER_`, `KEYBOARD_`, `MOUSE_` → "Use the computer · C"),
- sets shadows and `envMapIntensity`,
- assigns `screenMaterial()` to `SCREEN_SURFACE`. Its CanvasTexture with `flipY=false` and the html-to-image refresh (512 × 384, 4:3) map upright, because the UVs follow the glTF convention.
- derives `presets.computer` from the screen's bounding box, as before.

Cables are named `CABLE_*` and floor box parts `FLOORPORT_*`, so neither is clickable. Avoid renaming any part to `GLASS_*`: the room code would replace its material with window glass.

## Rendering notes
- Materials are `MeshStandardMaterial` and `MeshPhysicalMaterial` (CRT glass), lit by `scene.environment` (your room probe) and the room lights. LED emissive intensities of 2–6 are tuned for the HDR path (NoToneMapping + linear targets → bloom .34 / .62 / .62 → ACES at exposure 1.08 in the output pass).
- The CRT glass is transparent with depthWrite off and renderOrder 2. Decals use polygon offset.
- Assumes the old set faces +Z, as in penthouse-v2.glb. If yours differs, rotate `ws.group` (or each part) and call `rebuildCables()`.

## Screen: anti-moiré CRT material
The Mac desktop is a 1-pixel dither, and `penthouse-scene.js` sets `screenTexture.minFilter = LinearFilter` (no mips). Once the screen is drawn small, that pattern aliases into large diagonal black/white bands. `adoptScreen()` fixes this without touching mac.js or the refresh loop:
- It replaces the screen's material with a ShaderMaterial that samples the **same** texture object, so `screenTexture.image = surface; needsUpdate = true` keeps working.
- Per pixel, the shader measures the texel footprint with `dFdx`/`dFdy` and averages a 16-tap Vogel disc of matching radius, plus mip bias. The dither resolves to its average grey at any distance; up close it stays pixel-sharp.
- It turns mips on for the texture as a backstop. The disc filter works even if the room code later sets `LinearFilter` again.
- A subtle CRT treatment is added: scanlines that fade out before they could alias, a slight phosphor tint and corner falloff. Output is linear, `toneMapped:false`, as before.
- `texSize` follows the texture's current canvas size automatically (512 × 384 after the first refresh).

## Changes in this revision
- **Fixed the screen stripes and spikes at distance.** The root cause was texture aliasing of the dithered desktop (see above), so call `adoptScreen()`. The CRT surrounds (lip, gasket) were also rebuilt as swept loop-to-loop rings with no hole triangulation, and the dark tube backplate moved 9 mm behind the screen.
- Earlier: fixed the triangular spikes in the screen corners. The bevelled hole contours of the gasket and lip triangulated across the opening, so the holes are now cut without bevel (the outer edges stay rounded), with an extra lip edge ring. The screen bulge is clamped so the corners never sink behind the gasket.
- The rear cables now run over the desk edge into a floor service box. Routing is monotonic, so it doesn't loop when the terminal sits close to the edge.
- The mouse is more finely tessellated, and the skirt is lowered for a cleaner seam.

## Known
- The kana, kanji, ⚡ and ⌫ glyphs come from system fonts (Hiragino / Noto Sans JP / Apple Symbols). Without them, those characters may render as boxes.
- Cables are static tubes, rebuilt on demand rather than simulated.
