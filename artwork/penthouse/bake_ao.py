"""Bake bounded Cycles contact occlusion, retain editable source, export grouped GLB."""
import bpy,math,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'shared/assets/models/penthouse'
SOURCE=ROOT/'artwork/penthouse'
scene=bpy.data.scenes['Leon | Sky residence'];bpy.context.window.scene=scene
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.bake_type='AO'
scene.world.light_settings.distance=.3;scene.world.light_settings.ao_factor=1
scene.render.bake.margin=6;scene.render.bake.use_clear=True
scene.render.bake.use_selected_to_active=False
# CPU keeps Blender usable while baking on the user's machine.
scene.cycles.device='CPU'
original=[o for o in scene.objects if o.type=='MESH' and 'ao_category' in o]
settings=bpy.data.node_groups.get('glTF Material Output') or bpy.data.node_groups.new('glTF Material Output','ShaderNodeTree')
if not settings.interface.items_tree:
    settings.interface.new_socket(name='Occlusion',in_out='INPUT',socket_type='NodeSocketFloat')
for category,resolution in [('room',2048),('furniture',1024)]:
    objects=[o for o in original if o.get('ao_category')==category]
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects:
        ob.select_set(True)
        if not ob.data.uv_layers:ob.data.uv_layers.new(name='UVMap')
        if not ob.data.uv_layers.get('OcclusionUV'):ob.data.uv_layers.new(name='OcclusionUV')
        ob.data.uv_layers.active_index=ob.data.uv_layers.find('OcclusionUV')
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66),margin_method='FRACTION',island_margin=.003,area_weight=0)
    bpy.ops.uv.pack_islands(rotate=True,scale=True,margin_method='FRACTION',margin=.003)
    bpy.ops.object.mode_set(mode='OBJECT')
    image=bpy.data.images.get('Cycles AO | '+category) or bpy.data.images.new('Cycles AO | '+category,width=resolution,height=resolution,alpha=False)
    image.colorspace_settings.name='Non-Color';image.generated_color=(1,1,1,1)
    mats={mat for ob in objects for mat in ob.data.materials}
    for mat in mats:
        nt=mat.node_tree
        target=nt.nodes.new('ShaderNodeTexImage');target.name='Baked contact occlusion';target.image=image
        for n in nt.nodes:n.select=False
        target.select=True;nt.nodes.active=target
    print('BAKE_START',category,len(objects),flush=True)
    bpy.ops.object.bake(type='AO',uv_layer='OcclusionUV',margin=6,use_clear=True)
    image.filepath_raw=str(OUT/('ao-'+category+'.png'));image.file_format='PNG';image.save();image.pack()
    for mat in mats:
        nt=mat.node_tree;target=nt.nodes['Baked contact occlusion']
        uv=nt.nodes.new('ShaderNodeUVMap');uv.uv_map='OcclusionUV';nt.links.new(uv.outputs['UV'],target.inputs['Vector'])
        group=nt.nodes.new('ShaderNodeGroup');group.node_tree=settings;nt.links.new(target.outputs['Color'],group.inputs['Occlusion'])
    for ob in objects:ob.data.uv_layers.active_index=0
    print('BAKE_FINISH',category,flush=True)
# Save authored meshes individually, including the editable lighting rig.
bpy.ops.object.select_all(action='DESELECT')
scene.render.engine='CYCLES';scene.cycles.samples=48
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'penthouse-studio.blend'))
# Join export copies by material and semantic interaction group to reduce web draw calls.
export_collection=bpy.data.collections.new('Export optimized');scene.collection.children.link(export_collection)
groups={}
for ob in original:
    prefix=ob.name.split('_')[0]
    if prefix=='SCREEN':prefix='SCREEN_SURFACE'
    if ob.name.startswith('LED_DIFFUSER_'):prefix=ob.name
    elif prefix=='LED':prefix='LED_HOUSING'
    material=ob.data.materials[0] if ob.data.materials else None
    key=(prefix,material.name if material else '')
    copy=ob.copy();copy.data=ob.data.copy();export_collection.objects.link(copy)
    groups.setdefault(key,[]).append(copy)
merged=[]
for (prefix,matname),objects in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects:ob.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    if len(objects)>1:bpy.ops.object.join()
    ob=bpy.context.object;ob.name=prefix if prefix=='SCREEN_SURFACE' else prefix+'_Export_'+str(len(merged))
    merged.append(ob)
bpy.ops.object.select_all(action='DESELECT')
for ob in merged:ob.select_set(True)
bpy.context.view_layer.objects.active=merged[0]
bpy.ops.export_scene.gltf(filepath=str(OUT/'penthouse-v2.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_apply=True,export_lights=False,export_cameras=False,export_extras=True)
manifest=json.loads((OUT/'manifest.json').read_text());manifest['bakedAO']=True;manifest['exportMeshes']=len(merged);manifest['aoRadiusMeters']=.3
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
print('BAKE_EXPORT_OK',json.dumps(manifest),flush=True)
