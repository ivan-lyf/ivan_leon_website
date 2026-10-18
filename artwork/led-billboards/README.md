# Tokyo Signals — Blender LED animation collection

> Historical artwork library. The editable `.blend`, scripts, prompts and source/advertisement-plate PNGs are included. Generated files in `previews/` and the capture-based `preview.html` remain local archives, excluded from Git and the published site; the included rendering scripts can generate new previews. This library is not loaded by the current city. See `../README.md`.

Five original display families for Leon's cyberpunk city, built as a separate Blender library for review before city placement. The existing website scene has not been changed by this collection.

Open `tokyo-signals.blend`, select the scene **TOKYO SIGNALS | LED animation library**, and play frames **1–192 at 24 fps**. This is an eight-second loop; frame 193 matches frame 1. The overview and portrait-detail cameras are included. The five numbered collections can be appended into another Blender scene independently.

| Collection | Contents |
|---|---|
| 01 KAO | 5.6 × 8.4 m portrait screen, 144 × 216 logical emitters. Original Japanese female illustration, red eye makeup and angular cyan/magenta/violet shadows. Nine frames per loop introduce localized row displacement and RGB misregistration; the rest remain stable. |
| 02 TATE | Broken magenta/violet diamonds, illuminating in discrete slow waves. |
| 03 EN | Six segmented optical rings, independent rotation speeds, step pulses and a brief palette inversion. |
| 04 DENSHI | Three stacked screens, cycling among original anime illustration, geometric commercial graphics and readable Japanese copy. Hard cuts have a short stagger between coarse tile rows. |
| 05 HIKARI | Dense cyan-white vertical lights and dotted grids with independent flicker. |

The screens use editable Blender material nodes and simple frame drivers, not baked video textures or Python frame handlers. Each has quantized artwork sampling, clipped LED packages, dark inter-emitter gaps and uneven luminance. The portrait and three advertisement plates are packed into the file. The advertising plates were composed and rasterized in Blender; lettering is also preserved as mesh geometry in the artwork scenes. Font binaries are not embedded.

## Files

- `tokyo-signals.blend`: portable scene with packed bitmap textures and the complete animation.
- `build_billboards.py`: scene, main screen, advertisement art and rendering setup.
- `render_animation.py`: clean Eevee preview rendering, with no denoising of LED graphics.
- `secondary_graphics.py`: procedural diamond, optical-ring and light-strip materials.
- `assets/`: two original illustrated sources and three Blender-rendered advertisement plates.
- `previews/`: overview still, LED close-up, eight-second MP4 and animated GIF.
- `PROMPTS.md`: final prompts used with the built-in imagegen tool for the two illustrated source images. All emission grids, movement, electronic imperfections and secondary geometric graphics are authored in Blender.

Rebuild using Blender 5.1:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python build_billboards.py
```

Render the animation from the saved file with `Blender --background tokyo-signals.blend --python render_animation.py`. This writes 192 PNG frames to `previews/frames/`; encode them at 24 fps.

The rebuild script uses the local macOS Hiragino Gothic W7 font for Japanese lettering and Menlo for small captions. The saved blend remains portable because the text was converted to meshes. Rendering uses Standard colour management at restrained exposure and a low-strength fog glow so gaps remain visible. Geometry uses metres.

## Japanese copy

- 映像通信 — Video communication
- 深夜放送 — Late-night broadcast
- 電子都市 — Electronic city
- 光と音 — Light and sound
- 新発売 — New release

## Visual reference study

- [Utamaro female portrait, Metropolitan Museum](https://www.metmuseum.org/art/collection/search/36624): elongated proportions and a strong black hair silhouette.
- [Sharaku kabuki portrait, Metropolitan Museum](https://www.metmuseum.org/art/collection/search/37368): severe eye contours and angular graphic planes.
- [Nam June Paik, Electronic Superhighway (1995), Smithsonian](https://americanart.si.edu/artwork/electronic-superhighway-continental-us-alaska-hawaii-71478): independent electronic image fields and saturated luminous boundaries.
- [Sony outdoor display manual, page 6](https://pro.sony/s3/cms-static-content/operation-manual/3864848111.pdf): modular emitter packages, RGB emitters and dark spacing. The artwork's deliberately coarse logical resolution is an artistic interpretation, not an engineering reproduction of that product.

The reference images were studied, not included as display artwork. Both illustrated source assets are original built-in imagegen outputs. There are no copied company marks or film stills.
