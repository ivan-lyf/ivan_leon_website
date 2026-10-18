"""Denoise indirect atlases with Blender 5.1's compositor OpenImageDenoise.
Run in background with penthouse-studio.blend loaded. Only the two indirect
PNGs, their packed images, and bake metadata change. The lighting rig and
geometry are never modified. Intermediate EXRs stay linear and are discarded.
"""
import json
from pathlib import Path
import tempfile
import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'shared/assets/models/penthouse'
SOURCE = ROOT / 'artwork/penthouse'
SPECS = (('room', 2048), ('furniture', 1024))
authored = bpy.data.scenes['Leon | Sky residence']
manifest_path = OUT / 'manifest.json'
if not json.loads(manifest_path.read_text()).get('bakedIndirect'):
    raise RuntimeError('Run bake_indirect.py first.')
for category, _ in SPECS:
    if not (OUT / ('indirect-' + category + '.png')).is_file():
        raise RuntimeError('Missing indirect atlas: ' + category)

# A separate empty scene triggers only compositing of the two existing images.
# The original scene's compositor, camera, render settings and rig stay intact.
temp = bpy.data.scenes.new('Temporary | Indirect OIDN')
camera_data = bpy.data.cameras.new('Temporary | OIDN camera')
camera = bpy.data.objects.new('Temporary | OIDN camera', camera_data)
temp.collection.objects.link(camera)
temp.camera = camera
temp.render.engine = 'CYCLES'
temp.cycles.device = 'CPU'
temp.cycles.samples = 1
temp.cycles.use_denoising = False
temp.render.resolution_x = temp.render.resolution_y = 16
temp.render.resolution_percentage = 100
temp.render.use_compositing = True
temp.render.compositor_device = 'CPU'
temp.render.compositor_denoise_device = 'CPU'
temp.render.compositor_denoise_final_quality = 'HIGH'
temp.render.compositor_precision = 'FULL'
tree = bpy.data.node_groups.new('Temporary | Indirect OIDN', 'CompositorNodeTree')
temp.compositing_node_group = tree
tree.interface.new_socket(name='Image', in_out='OUTPUT', socket_type='NodeSocketColor')
group_output = tree.nodes.new('NodeGroupOutput')
input_images, intermediate_images, results = [], [], {}
try:
    with tempfile.TemporaryDirectory(prefix='penthouse-oidn-') as directory:
        output = tree.nodes.new('CompositorNodeOutputFile')
        output.directory = directory
        output.file_name = 'denoised'
        output.format.media_type = "IMAGE"
        output.format.file_format = 'OPEN_EXR'
        output.format.color_mode = 'RGB'
        output.format.color_depth = '32'
        output.format.exr_codec = 'ZIP'
        output.save_as_render = False
        for index, (category, resolution) in enumerate(SPECS):
            image = bpy.data.images.load(str(OUT / ('indirect-' + category + '.png')), check_existing=False)
            image.colorspace_settings.name = 'Non-Color'
            input_images.append(image)
            source = tree.nodes.new('CompositorNodeImage')
            source.image = image
            denoise = tree.nodes.new('CompositorNodeDenoise')
            denoise.inputs['HDR'].default_value = True
            denoise.inputs['Prefilter'].default_value = 'Accurate'
            denoise.inputs['Quality'].default_value = 'High'
            tree.links.new(source.outputs['Image'], denoise.inputs['Image'])
            output.file_output_items.new('RGBA', category)
            tree.links.new(denoise.outputs['Image'], output.inputs[category])
            if index == 0:
                tree.links.new(denoise.outputs['Image'], group_output.inputs['Image'])
        print('INDIRECT_DENOISE_START', flush=True)
        bpy.ops.render.render(scene=temp.name)
        paths = list(Path(directory).glob('*.exr'))
        print('INDIRECT_DENOISE_FILES', [p.name for p in paths], flush=True)
        # Read compositor pixels through Blender, preserving their linear values.
        for category, resolution in SPECS:
            matches = [p for p in paths if category in p.name]
            if len(matches) != 1:
                raise RuntimeError('Expected one compositor EXR for ' + category)
            image = bpy.data.images.load(str(matches[0]), check_existing=False)
            image.colorspace_settings.name = 'Non-Color'
            intermediate_images.append(image)
            if tuple(image.size) != (resolution, resolution):
                raise RuntimeError('Unexpected denoised atlas size: ' + str(tuple(image.size)))
            pixels = np.empty(resolution * resolution * 4, dtype=np.float32)
            image.pixels.foreach_get(pixels)
            if not np.isfinite(pixels).all() or float(pixels.reshape(-1, 4)[:, :3].max()) <= 0:
                raise RuntimeError('Invalid or empty denoised atlas: ' + category)
            results[category] = pixels
        # Both maps are validated before replacing their corresponding assets.
        for category, resolution in SPECS:
            image = bpy.data.images.get('Cycles indirect | ' + category)
            if image is None:
                image = bpy.data.images.new('Cycles indirect | ' + category, width=resolution, height=resolution, alpha=False, float_buffer=False)
            if tuple(image.size) != (resolution, resolution) or image.is_float:
                raise RuntimeError('Expected the existing 8-bit indirect image for ' + category)
            image.colorspace_settings.name = 'Non-Color'
            image.pixels.foreach_set(results[category])
            image.update()
            path = OUT / ('indirect-' + category + '.png')
            image.filepath_raw = str(path)
            image.file_format = 'PNG'
            image.save()
            if path.read_bytes()[24] != 8:
                raise RuntimeError('Expected 8-bit PNG for ' + category)
            image.pack()
            image.use_fake_user = True
            image.filepath_raw = '//../../shared/assets/models/penthouse/' + path.name
            print('INDIRECT_DENOISE_SAVED', category, resolution, flush=True)
finally:
    bpy.context.window.scene = authored
    bpy.data.scenes.remove(temp)
    bpy.data.node_groups.remove(tree)
    bpy.data.objects.remove(camera, do_unlink=True)
    bpy.data.cameras.remove(camera_data)
    for image in input_images + intermediate_images:
        bpy.data.images.remove(image)

bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'penthouse-studio.blend'))
manifest = json.loads(manifest_path.read_text())
manifest['indirectBake']['denoiser'] = 'Blender compositor OpenImageDenoise'
manifest['indirectBake']['denoiseQuality'] = 'High'
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
print('INDIRECT_DENOISE_OK', flush=True)
