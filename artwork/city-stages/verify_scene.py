from pathlib import Path
import bpy,json
P=Path(__file__).resolve().parent
scene=next(s for s in bpy.data.scenes if s.name=='CITY STAGES | final');bpy.context.window.scene=scene;scene.frame_set(1)
drivers=[]
for m in bpy.data.materials:
 if m.node_tree and m.node_tree.animation_data:
  for f in m.node_tree.animation_data.drivers:drivers.append({'material':m.name,'path':f.data_path,'valid':f.driver.is_valid})
images=[{'name':i.name,'packed':bool(i.packed_file),'path':i.filepath} for i in bpy.data.images if i.source=='FILE']
r={'scene':scene.name,'camera':scene.camera.name,'render':[scene.render.resolution_x,scene.render.resolution_y],'exposure':scene.view_settings.exposure,'objects':len(scene.objects),'images':images,'drivers':drivers,'all_drivers_valid':all(d['valid'] for d in drivers),'all_file_images_packed':all(i['packed'] for i in images),'staged_ribbon_objects':sum('runtime_matching_geometry' in o for o in scene.objects),'media_surfaces':sum(o.name.startswith('MEDIA |') for o in scene.objects),'original_room_retained':bpy.data.collections.get('03 | Existing penthouse') is not None}
(P/'verification.json').write_text(json.dumps(r,indent=2));print(json.dumps(r,indent=2))
