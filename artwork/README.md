# Artwork sources and local archives

The repository includes the principal editable Blender projects, authoring scripts, source artwork and persistent reconstruction inputs. The browser runtime lives under `shared/`; it uses exported room/vehicle/whale assets and procedural scene modules. Native Blender projects document earlier authoring checkpoints and do not automatically reflect later browser-only city and workstation imports.

Included editable projects:

- `penthouse/penthouse-studio.blend`: room, furniture and earlier compact workstation.
- `spinner/skyline-spinner.blend`: flying vehicle.
- `holographic-whale/holographic-whale.blend`: animated anatomical whale.
- `led-billboards/tokyo-signals.blend`: historical LED artwork library.
- `city-stages/city-05-final.blend`: historical lighting/material study.
- `city-revision/city-revised.blend`: industrial city checkpoint.

`workstation/README.md` describes the current browser workstation; its code is the editable source. `CREDITS.md` and each reference document record provenance. Source illustration and advertisement-plate PNGs for the historical LED library are included; downloaded third-party study photos are not redistributed.

`artwork/.gitignore` keeps Blender backup files, intermediate native checkpoints, generated renders/videos, build and validation logs, browser traces, and archived comparison pages out of the published source. These files are preserved in the original local authoring checkout. The `renders/`, `previews/`, `web/` and `web-renders/` locations mentioned in historical documentation are local/generated outputs, not files promised by a clean clone. In particular, the city `preview.html` and `web-review.html` pages depend on local archived captures and are not deployed. The whale's interactive `preview.html` is source code and remains included.

Rebuild instructions in each source directory produce fresh outputs. The old city documents record historical lighting manifests and runtime counts; current browser modules are authoritative for the live scene.
