## Engine and content

`shared/mac.js` is the engine. It does not know anything about Ivan or Leon; it just
renders whichever profile is active. Each `<person>/profile.js` is data plus a few
small functions: identity (`name`, `domain`, `email`), a `projects` list, document
builders (`about`, `experience`, `contact`, and so on), and an `icons` array that lays
out the desktop. Optional profile flags: `critters: false` / `deskNotes: false` turn
off the wandering desktop critters and the periodic note pop-ups (Leon's side does
both), and `github: "<username>"` adds a menubar tab with a live GitHub contributions
widget (Ivan's side).

To add a window, add an icon entry (`doc:` for a document, or `kind: "folder" |
"harddrive" | "trash"`) and, for documents, a matching builder function. Filling out
a person's side means editing their profile file. `shared/mac.js` and `shared/mac.css`
stay the same.

For something interactive, use `kind: "app"` with a `mount(root, profile, other)`
function. The engine opens the window, then calls `mount` with an empty body node
already in the document, so the app can focus inputs and measure layout. Ivan's
Terminal is the first one: a small read-only shell (`ls`, `cd`, `cat`, `pwd`,
`clear`, `help`) over a virtual filesystem whose `projects/` directory is generated
from the same `projects` array the windows use, so the two cannot drift apart.

## The classic 3D front end

`index.html` renders the live site onto a 3D Macintosh built in `shared/mac-scene.js`
(Three.js, vendored locally). `html-to-image` copies the on-screen DOM to a texture
on the curved glass, and clicks are mapped back onto it. Drag to orbit, scroll in a
little to enter — the camera swings around to face the screen head-on and glides in,
then the screen scales up so you can use it directly. Press Esc to exit.

To run the plain 2D version instead, point a page at the Mac OS markup and the three
scripts (`ivan/profile.js`, `leon/profile.js`, `shared/mac.js`) without the scene.

## Two domains, one codebase

Both profile files load on both domains. At startup the engine picks the owner from the
hostname (`leonmeng.xyz` is Leon, anything else is Ivan) and shows only that desktop.
The login screen lists both people: the owner is "this Mac," and choosing the other
person sends you to their domain. On `localhost` it switches sides in place instead of
navigating.

## Running locally

Serve the folder and open it:

```
python3 -m http.server 8000
# then visit http://localhost:8000
```

Add `?as=leon` or `?as=ivan` to force a side without changing the hostname. This is
useful for editing one person's page while working on the other's machine.


## Leon's sky penthouse

Leon enters an original, sparse penthouse through `?as=leon` (also selected automatically on `leonmeng.xyz`). Ivan's side opens its classic room. The profiles and desktop content remain shared as before.

Run from the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open http://localhost:8000/?as=leon. No build or package installation is required for the preview; the runtime libraries and scene assets are local.

- Drag to look around; scroll or pinch to move closer.
- `1`, `2`, `3`: room, desk, city positions.
- `C`: use the computer; `Esc`: return to the room.
- `L`: ceiling LEDs. `R`: reset view. The scene stays at night.
- The glass, computer, mouse, and ceiling diffusers can also be clicked.
- Click or tap the keyboard (or press `K`) for silent key movement. Keyboard hover has no white outline or clicking sound.
- Motion can be paused; reduced-motion preferences are respected.
- Plain desktop fallback: `?as=leon&scene=desktop`.
- Original room comparison: `?as=leon&scene=classic`.

Computer entry uses a continuous camera zoom with the live desktop aligned to the monitor during the handoff. Esc or Back reverses the transition to the saved view; reduced-motion mode skips the camera travel.

The room, desk, chair and four square ceiling LED panels are authored in Blender. The current browser terminal, keyboard, mouse and floor service port come from the user-provided LM-7 workstation package and are generated in Three.js; the earlier compact computer remains in the editable Blender source. The room stays sparse, with full-height glazing and space for future personal objects. It stays at night over a dense, layered city with architectural neon, exterior rain and flying traffic. The city combines original procedural architecture with a separately authored Blender vehicle.

### Dimensions and rendering

The Blender scene uses metres. Its exported GLB is scaled uniformly by four in the browser to match the existing city coordinate system.

| Element | Authored dimensions |
|---|---|
| Room | 7 m wide × 7.5 m deep × 3.2 m high |
| Desk | 1.8 m wide × 0.8 m deep; worktop at 0.75 m |
| Chair | Seat reference at 0.46 m; overall height about 1.055 m |
| Desk mat | 0.90 m wide × 0.40 m deep × 0.003 m thick |
| LM-7 terminal | 0.31 m wide × 0.335 m high × 0.32 m deep |
| LM-77 keyboard | 0.326 m wide × 0.124 m deep; 67 keys |
| Mouse | 0.064 m wide × 0.114 m deep |
| Ceiling panels | Four recessed 1.2 m × 1.2 m opal diffusers, flush at 3.2 m, with concealed housings |

The model includes bevels, curved upholstery, glazing seals, floor joints, keyboard keys and small hardware details. Cycles bakes contact occlusion into separate room and furniture atlases using a second UV channel. A second bake captures indirect ceiling-light bounce as linear PNG lightmaps on the same UV channel, with the window light excluded. The browser combines this with square area lights, shadow sources and the live desktop texture on `SCREEN_SURFACE`. The polished stone floor uses a softened planar reflection with an unbiased clipping plane, so its physical slab cannot occlude the reflection at elevated camera angles; a local cubemap of the actual room is filtered with PMREM for coherent material reflections. A linear half-float render pipeline preserves light intensity through bloom, followed by ACES tone mapping and FXAA. All scene and reflection renders keep a stable linear, untone-mapped renderer state; only the final output pass applies ACES, avoiding Three.js r128 shader-cache reuse of a premature tone map. Floor and room reflection targets also retain half-float radiance on supported devices. Devices without a renderable half-float target use the byte-buffer fallback. The four ceiling panels occupy real openings in the slab; only a 2 mm trim edge sits below the finished ceiling. The ceiling-light control also adjusts the baked bounce; the city and window lighting keep their night settings.

Rain streaks move on the GPU entirely outside the room, with antialiased subpixel widths, varied exposure lengths and gentle wind. Wet-glass effects from the supplied `rain.zip` add downward arrivals, meandering runners, drying trails and residual beads. Larger droplets refract and invert city details with a dark meniscus, subtle color fringing and focused highlights; smaller droplets use simpler optics. Unresolved beads fade with distance, and mirrored views omit main-camera lens captures. Invisible trail regions and small-drop optics skip unnecessary calculations. Weather never intercepts scene clicks. Source provenance and validation commands are in `artwork/rain-glass/README.md`.

The city now uses layered industrial architecture: asymmetric load paths, recessed occupied cores, deep service floors, docking decks, patched cladding, conduits and rooftop plant. Six seeded massing families preserve the established skyline and camera composition. Residential, office and industrial uses determine the window proportions and floor-level lighting logic. Ray-box interiors have dim warm-neutral light pools, partitions, blinds and occasional monitor glow; many floors remain dark. Wetness changes surface color and roughness, runoff collects under openings, and small normal variation breaks the clean surface response.

A separate Blender-authored 3D holographic humpback replaces the large billboard and orbital-ring spectacle. Its 286-second path changes depth around the towers, with moving flukes/pectoral fins, translucent scan strata and internal particles. A bounded moving light field supplies local facade spill, glass glints and atmospheric scattering. Background geometry remains visible through the projection, and foreground architecture occludes it. The old billboard library and earlier staged exports are preserved as historical artwork, but are no longer loaded by the current scene.

The exterior reflection cubemap is refreshed during scene setup; it is not a per-frame ray tracer. Moving whale reflections use a bounded shader approximation in the city glass, while the room floor uses its existing planar reflection. The static directional shadow atlas shades occupied city volumes; it does not model every tiny retrofit component. The native Blender checkpoint uses real lights and volumes, while the browser uses optimized GLSL approximations. Its materials and geometry document the earlier revision; the later ZIP exterior import has not been rebuilt in Blender.

The separate Blender spinner interprets George Hull's K-spinner concepts. Seven curved aerial routes include landmark orbits and two police pursuits, with directional headlamp/tail-lamp halos, soft light scatter and roof beacons. Routes are cleared against building volumes; cars bank into turns and use shared lane speeds to avoid overtaking collisions. Motion controls and reduced-motion preferences freeze the simulation clock. See [the reference-to-element map](artwork/penthouse/REFERENCES.md) for sources and adaptations.

### Rendering efficiency

Opaque workstation parts sharing a material are combined within their computer, keyboard, mouse and floor-port interaction groups. The screen, transparent overlays, keyboard case, fine instanced heatsink fins and animated material references remain independent. The default model uses 53 meshes instead of 85 with the same 66,976 triangles; `batchStatic: false` in the workstation factory is an internal comparison option. `tests/workstation-batching.cjs` checks geometry, interactions, cables, animation and disposal against that control.

The opaque sky runs after solid geometry to avoid shading obscured clouds. Fullscreen bloom filters omit unused depth buffers and depth operations, while scene targets retain depth. Canvas multisampling is disabled when the full FXAA postprocessing path is available; display resolution, HDR, bloom, shadows and reflection quality are unchanged. The loader stays visible through the first successful animated render and initial environment captures.

The room now establishes opaque depth before city shading, and an exact floor/frustum check avoids offscreen planar-reflection captures. A guarded Three.js r128 shader patch skips physical-light work only for zero-contribution lights; unknown shader versions keep the original path. The bloom mip chain composites directly into ACES output, removing a full-resolution additive pass while preserving its source-alpha blend. Hologram mist skips procedural noise where its light contribution is zero. The 14 closed, beveled glass panes shade their entry surfaces once with the combined transmittance of the original two layers. Their geometry, tint, roughness and reflections remain; removing the second 8 mm-offset surface introduces a small shading approximation. Unknown replacement glass keeps the original two-sided path. These changes retain render resolution, camera framing, all models, full-rate animations and reflection quality. Regression checks are in `tests/reflection-visibility.cjs`, `tests/lighting-optimization.cjs`, `tests/bloom-composite.cjs`, `tests/glass-panels.cjs` and the `lighting-optimization` suite in `tests/shader-finiteness.cjs`.

### Editing and rebuilding the Blender scene

- Editable source: `artwork/penthouse/penthouse-studio.blend`.
- Geometry and Blender lighting rig: `artwork/penthouse/build_scene.py`.
- Cycles AO baking and grouped web export: `artwork/penthouse/bake_ao.py`.
- Indirect ceiling-light bake: `artwork/penthouse/bake_indirect.py`.
- Blender compositor denoising: `artwork/penthouse/denoise_indirect.py`.
- Duplicate texture-declaration cleanup: `artwork/penthouse/optimize_glb.py`.
- Web model and dimensions: `shared/assets/models/penthouse/penthouse-v2.glb` and `manifest.json`.
- Runtime lighting, cameras, controls and desktop integration: `shared/penthouse-scene.js`.
- Current terminal, keyboard, mouse and cabling: `shared/penthouse-workstation.js`; integration notes: `artwork/workstation/README.md`.
- Building massing and material-family metadata: `shared/penthouse-architecture.js`.
- Static city shadow atlas: `shared/penthouse-city-shadow.js`.
- Skyline, window interiors, wet materials and hologram illumination: `shared/penthouse-city.js`.
- Curved traffic routes, vehicle instancing and navigation lights: `shared/penthouse-traffic.js`.
- Exterior rain and refractive wet glazing: `shared/penthouse-weather.js`.
- Corporate crown identities and tenant signs: `shared/penthouse-corporate.js`, `shared/penthouse-signage.js`, `shared/penthouse-signage-mounts.js`, and `shared/assets/logos/`.
- Whale geometry, animation and projection: `shared/penthouse-whale.js` and `artwork/holographic-whale/`.
- Revised native city and reproducible builder: `artwork/city-revision/city-revised.blend` and `artwork/city-revision/build_city_revision.py`.
- Blender traffic model: `shared/assets/models/city/spinner.glb`.
- Editable vehicle and builder: `artwork/spinner/skyline-spinner.blend` and `artwork/spinner/build_spinner.py`.
- Visual study and attribution: `artwork/penthouse/REFERENCES.md`.
- Interface: `shared/penthouse.css`.

For manual modelling, open the `.blend` and work in the `Leon | Sky residence` scene. Keep the semantic mesh prefixes (`GLASS_`, `COMPUTER_`, `KEYBOARD_`, `MOUSE_`, `LED_DIFFUSER_`) and the screen's UV layout so browser interactions continue to work. The authored meshes stay individually editable in the saved source; the export groups them by material and interaction type to reduce draw calls.

To regenerate the procedural source and bake/export it with Blender 5.1 or later, run from the repository root:

```sh
blender --background --python artwork/penthouse/build_scene.py
blender --background artwork/penthouse/penthouse-studio.blend --python artwork/penthouse/bake_ao.py
blender --background artwork/penthouse/penthouse-studio.blend --python artwork/penthouse/bake_indirect.py
blender --background artwork/penthouse/penthouse-studio.blend --python artwork/penthouse/denoise_indirect.py
python3 artwork/penthouse/optimize_glb.py
```

The flying vehicle has an independent builder:

```sh
blender --background --python artwork/spinner/build_spinner.py
```

On macOS, replace `blender` with `/Applications/Blender.app/Contents/MacOS/Blender` if it is not on your PATH. Regenerating replaces the generated penthouse scene and its exported assets, so keep manual changes in a separate `.blend` before running the builder. Run the optimizer after each GLB export; it preserves the binary geometry and image payload while sharing identical atlas declarations. The indirect bake preserves the existing AO UV layout and writes `indirect-room.png` and `indirect-furniture.png` beside the GLB. The denoising step uses Blender compositor OpenImageDenoise at high quality, preserving linear values and updating the packed images in the source file. Load these maps with linear encoding and `flipY: false`. The local preview uses the exported GLB and lightmaps; Blender is used during authoring, not by website visitors.

The reference was inspected with REA for rendering and interaction techniques. Asset sources and license notes are in `CREDITS.md`.


### Staged city lighting review

The earlier city lighting study is preserved in `artwork/city-stages/`: the final editable `city-05-final.blend`, source scripts and persistent reconstruction inputs are included. It preserves the original architecture/camera and packs its artwork. The stage README documents browser/native shading differences and historical validation. Intermediate checkpoints, generated captures and `/artwork/city-stages/web-review.html` are local archive artifacts, excluded from Git and the published site; that comparison page is available only in the original authoring checkout. The shared runtime lighting manifest has since changed for the later city revision.


### Industrial-city checkpoint

The earlier native city and geometry checkpoint are in `artwork/city-revision/`; the independent editable whale is in `artwork/holographic-whale/`. The same-camera captures and `/artwork/city-revision/web-review.html` remain local archive artifacts, excluded from Git and the published site. This historical checkpoint introduced maintenance lighting and foreground, midground and distant rain populations, with projected optical widths, variable shutter lengths, spatial wind, distance softening and whale illumination. Current runtime counts and exterior changes are defined by the later imported modules. Unresolved window droplets fade out instead of becoming a screen-wide texture.


### Current ZIP exterior import

The current browser city incorporates the user-provided `Cyberpunk penthouse scene realism.zip`: exterior architecture and materials, occupied windows, atmospheric lighting, rain, flying traffic, the holographic whale, and corporate/tenant signage. AXL, Prism and Vectra use supplied PNG assets; KUJIRA, OKAMI and Halcyon are drawn by the imported corporate-sign module.

The exterior import preserved the existing room design, furniture dimensions, recessed ceiling lights, lightmaps, camera presets, floor reflections and night lighting. The ZIP preview's global grading and bloom settings were not applied to the room. Dusk and its keyboard shortcut are removed, along with the top-left identity and bottom-left caption/hint. The native Blender source files were not revised by this ZIP import; `artwork/city-revision/` remains the earlier checkpoint.


### LM-7 workstation import

The current desk uses `shared/penthouse-workstation.js`, adapted from the site owner's `workstation.zip`. It replaces only the original computer, keyboard and mouse meshes and adds their cabling and a small floor service port. The keyboard and mouse sit on the raised mat, and the cable tubes clear both the mat and tabletop before dropping behind the desk. The room, desk, chair, enlarged desk mat, glazing, ceiling panels, city, reflection pipeline and night-lighting settings are retained. No additional model download or build step is needed.

The terminal has aged ABS and gunmetal surfaces, a curved CRT, vents, a data card and status lights. The 67-key keyboard has a white hover outline and silent click/tap/`K` feedback; keyboard sound is disabled. Its status animation uses the existing motion clock, so pause and reduced-motion preferences apply. The mouse and computer keep their entry actions.

The CRT samples the existing live desktop texture with distance-aware filtering to reduce dither aliasing. The camera continues its existing screen-aligned entry and return transition; keyboard feedback stays a separate action. Imported-resource handling preserves atlases shared with the room, retires replaced resources, releases rebuilt cable geometry, and keeps workstation disposal idempotent. The live desktop texture remains owned by the scene.

See `artwork/workstation/README.md` for the integrated contract. `artwork/workstation/HANDOFF.md` preserves the upstream ZIP brief with a provenance note; its standalone preview and layout describe the supplied package. The native Blender files retain the previous workstation and have not been regenerated for this browser-only replacement. Source-distribution and local-archive details are in `artwork/README.md`.


### Rendering regression checks

Run these dependency-free checks with Node.js from the repository root:

```sh
node tests/facade-stability.cjs
node tests/floor-reflection.cjs
```

The facade check exercises actual shader expressions with Float32 precision perturbations and overlapping interior shadows. Instance seeds are snapped to a stable value before occupancy hashing; interior attenuation stays nonnegative, while unresolved blinds and room detail are filtered in the shader. The floor check uses the actual room geometry and reflector implementation across 279 camera poses. Both tests include the original failing calculations as controls.


### Arrival display and banner placement

The penthouse opens with a minimal dark loading screen: a small loading label, genuine percentage, thin continuous progress line and desktop shortcut. Progress follows the room download, city assets, traffic and first rendered view; it never advances on a simulated timer. There is no minimum hold time, and reduced-motion mode skips the brief fade. The desktop link remains available during loading or errors. `shared/penthouse-arrival.js` owns this DOM-only display; classic and plain-desktop modes retain their existing flow. Run `node tests/arrival.cjs` for progress, failure and disposal checks.

The current tenant-banner layout distributes 73 panels across 18 buildings visible from the starting room camera, with at most six panels on any building and four on the smaller unbranded tower left of KUJIRA. Twenty-six animated panels occupy nearer facades, including scrolling, flipping and pulsing art. All 53 supplied designs remain in the full-quality layout. Banners sit higher on the facades; company logos keep their original assets and positions. Repeated artwork is excluded from the same building, neighboring building footprints within 60 city metres, and nearby positions in the room composition. Each sign has a facade-fitted cabinet and two embedded brackets, combined into the existing architectural instance batch. The atlas and two instanced signage draws are unchanged. See `artwork/signage/README.md` for placement details and `tests/signage-layout.cjs` for visibility and clearance checks.


### Building attachment correction

Deck braces use a full 3D rotation and terminate inside their supporting wall and deck. Facade edge channels now extend back into the wall; roof plant and mast bases sit on their supporting surfaces, and antenna plates have small standoffs. The 507 occupied volumes, corporate-sign placements and architectural lighting coordinates remain unchanged. The correction adds 22 instanced mounting blocks (264 triangles), with no new material, texture or rendering pass.

`node tests/building-attachments.cjs` checks actual transformed brace ends against supporting geometry, retains the old rotation as a failing control, and audits disconnected assemblies. Its bounding-box connectivity check is a broad-phase check; the dedicated brace test includes the real occupied-volume chamfer and rotated meshes.
