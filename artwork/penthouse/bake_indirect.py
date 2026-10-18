"""After bake_ao.py, bake indirect ceiling light into the unchanged OcclusionUV.
Run against the loaded penthouse-studio.blend. Outputs are raw linear 8-bit PNGs:
load in Three.js with LinearEncoding and flipY=False. No geometry/GLB changes.
"""
import json
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'shared/assets/models/penthouse'
SOURCE = ROOT / 'artwork/penthouse'
SPECS = (('room', 2048), ('furniture', 1024))
scene = bpy.data.scenes['Leon | Sky residence']
bpy.context.window.scene = scene
if bpy.context.object and bpy.context.object.mode != 'OBJECT':
    raise RuntimeError('Run in Object mode with penthouse-studio.blend loaded.')
manifest_path = OUT / 'manifest.json'
if not json.loads(manifest_path.read_text()).get('bakedAO'):
    raise RuntimeError('Complete bake_ao.py first.')
meshes = [o for o in scene.objects if o.type == 'MESH' and 'ao_category' in o]
groups = {c: [o for o in meshes if o.get('ao_category') == c] for c, _ in SPECS}
for category, objects in groups.items():
    if not objects:
        raise RuntimeError('Missing mesh category: ' + category)
    for ob in objects:
        if ob.data.uv_layers.find('OcclusionUV') != 1:
            raise RuntimeError(ob.name + ' needs the existing AO map at UV1.')
        if not ob.data.materials or any(m is None or not m.use_nodes for m in ob.data.materials):
            raise RuntimeError(ob.name + ' has an invalid material slot.')
background = scene.world.node_tree.nodes['Background']
window = scene.objects['LIGHT_Window']
leds = [o for o in scene.objects if o.type == 'LIGHT' and o.name.startswith('LIGHT_LED_')]
if not leds:
    raise RuntimeError('Missing authored ceiling lights.')

restore = []
def temporary(owner, key, value):
    restore.append((owner, key, getattr(owner, key)))
    setattr(owner, key, value)

selection = [o for o in scene.objects if o.select_get()]
active = bpy.context.view_layer.objects.active
uv_indices = {o: o.data.uv_layers.active_index for o in meshes}
world_color = tuple(background.inputs['Color'].default_value)
world_strength = background.inputs['Strength'].default_value
node_states, targets, images = {}, [], []
try:
    temporary(scene.render, 'engine', 'CYCLES')
    temporary(scene.cycles, 'device', 'CPU')
    temporary(scene.cycles, 'samples', 24)
    temporary(scene.cycles, 'bake_type', 'DIFFUSE')
    bake = scene.render.bake
    for key in ('use_pass_direct', 'use_pass_indirect', 'use_pass_color', 'use_pass_diffuse', 'use_pass_glossy', 'use_pass_transmission', 'use_pass_emit'):
        temporary(bake, key, getattr(bake, key))
    temporary(bake, 'use_selected_to_active', False)
    temporary(bake, 'use_clear', True)
    temporary(bake, 'margin', 6)
    bake.use_pass_direct = False
    bake.use_pass_indirect = True
    bake.use_pass_color = False
    temporary(window.data, 'energy', 0.0)
    for light in leds:
        temporary(light.data, 'energy', light.data.energy)
        temporary(light, 'hide_render', False)
    background.inputs['Color'].default_value = (1, 1, 1, 1)
    background.inputs['Strength'].default_value = 0.04
    for category, resolution in SPECS:
        objects = groups[category]
        bpy.ops.object.select_all(action='DESELECT')
        for ob in objects:
            ob.select_set(True)
            ob.data.uv_layers.active_index = 1
        bpy.context.view_layer.objects.active = objects[0]
        image = bpy.data.images.get('Cycles indirect | ' + category) or bpy.data.images.new('Cycles indirect | ' + category, width=resolution, height=resolution, alpha=False, float_buffer=False)
        image.colorspace_settings.name = 'Non-Color'
        image.generated_color = (0, 0, 0, 1)
        image.use_fake_user = True
        for material in {m for ob in objects for m in ob.data.materials}:
            nodes = material.node_tree.nodes
            if material not in node_states:
                node_states[material] = (nodes.active, [(n, n.select) for n in nodes])
            target = nodes.new('ShaderNodeTexImage')
            target.name = 'Temporary indirect bake target'
            target.image = image
            for node in nodes:
                node.select = False
            target.select = True
            nodes.active = target
            targets.append((material, target))
        print('INDIRECT_BAKE_START', category, len(objects), resolution, flush=True)
        bpy.ops.object.bake(type='DIFFUSE', pass_filter={'INDIRECT'}, uv_layer='OcclusionUV', margin=6, use_clear=True, use_selected_to_active=False)
        # Non-Color byte image + save() preserves linear values without AgX.
        image.filepath_raw = str(OUT / ('indirect-' + category + '.png'))
        image.file_format = 'PNG'
        image.save()
        image.pack()
        images.append(image)
        print('INDIRECT_BAKE_FINISH', category, image.filepath_raw, flush=True)
finally:
    # Never alter AO nodes, links, PBR outputs or geometry. Restore the rig even
    # on failure, then remove only this script's unconnected target nodes.
    for material, target in reversed(targets):
        material.node_tree.nodes.remove(target)
    for material, (old_active, old_selected) in node_states.items():
        for node, selected in old_selected:
            node.select = selected
        material.node_tree.nodes.active = old_active
    for ob, index in uv_indices.items():
        ob.data.uv_layers.active_index = index
    background.inputs['Color'].default_value = world_color
    background.inputs['Strength'].default_value = world_strength
    for owner, key, value in reversed(restore):
        setattr(owner, key, value)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in selection:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = active

# Only reached after both bakes succeeded; save the restored rig and new images.
for image in images:
    image.filepath_raw = '//../../shared/assets/models/penthouse/' + Path(image.filepath_raw).name
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'penthouse-studio.blend'))
manifest = json.loads(manifest_path.read_text())
manifest['bakedIndirect'] = True
manifest['indirectBake'] = {
    'engine': 'Cycles', 'samples': 24, 'device': 'CPU',
    'pass': 'DIFFUSE_INDIRECT', 'encoding': 'linear', 'bitDepth': 8,
    'uv': 'OcclusionUV', 'windowLight': False, 'worldStrength': 0.04,
    'ceilingPanelWatts': [light.data.energy for light in leds],
    'textures': {c: 'indirect-' + c + '.png' for c, _ in SPECS},
}
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
print('INDIRECT_BAKE_OK', json.dumps(manifest['indirectBake']), flush=True)
