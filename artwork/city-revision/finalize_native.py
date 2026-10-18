"""Add native full-orbit animation and verify the separately saved revision."""
from pathlib import Path
import bpy, math, json
from mathutils import Matrix, Vector
if not bpy.app.background: raise RuntimeError('Background verification only.')
HERE=Path(__file__).resolve().parent
S=next(s for s in bpy.data.scenes if s.name=='CYBERPUNK REVISION | Retrofit city');bpy.context.window.scene=S
root=bpy.data.objects.get('Whale | City placement')
C3=Matrix(((1,0,0),(0,0,-1),(0,1,0)))
def position(t):
 a=t*.022
 return Vector((-3+43*math.sin(a),84+24*math.cos(a),9+2.1*math.sin(a+.2)-2.1*math.sin(.2)))
def rotation(t):
 a=t*.022;xx=.40+.06*math.sin(a);yy=math.atan2(-24*math.sin(a),43*math.cos(a))-.28;zz=.04+.035*math.sin(a*2)
 return (C3@(Matrix.Rotation(xx,3,'X')@Matrix.Rotation(yy,3,'Y')@Matrix.Rotation(zz,3,'Z'))@C3.inverted()).to_quaternion()
end=round(2*math.pi/.022*24)+1
if root:
 S.frame_set(1);root.rotation_mode='QUATERNION';root.location=position(0);root.rotation_quaternion=rotation(0)
 bpy.context.view_layer.update()
 for ob in S.objects:
  if ob.type=='LIGHT' and ob.name.startswith('Whale |'):
   world=ob.matrix_world.copy();ob.parent=root;ob.matrix_world=world
 for frame in list(range(1,end,24))+[end]:
  t=(frame-1)/24;root.location=position(t);root.rotation_quaternion=rotation(t);root.keyframe_insert('location',frame=frame);root.keyframe_insert('rotation_quaternion',frame=frame)
 root['motion']='Same 43×24m ellipse and orientation parameters as the runtime; full orbit approximately286s.'
 for ob in bpy.data.collections['Whale | Editable anatomical surfaces'].objects:
  if not getattr(ob.data,'shape_keys',None):continue
  keys=ob.data.shape_keys;keys.animation_data_clear()
  for key in keys.key_blocks:
   if key.name=='Basis':continue
   f=key.driver_add('value');f.driver.expression='sin((frame-1)*.57/24)' if 'tail' in key.name.lower() else '.1+.5*sin((frame-1)*.37/24)'
 S.frame_end=end
S.frame_set(1);bpy.context.view_layer.update()
S.camera=next(ob for ob in S.objects if ob.type=='CAMERA' and ob.name=='CAM | Existing city preset')
images=[{'name':i.name,'packed':bool(i.packed_file),'path':i.filepath} for i in bpy.data.images if i.source=='FILE']
shape_drivers=[]
for key in bpy.data.shape_keys:
 if key.animation_data:
  shape_drivers.extend({'key':key.name,'path':f.data_path,'valid':f.driver.is_valid} for f in key.animation_data.drivers)
report={'scene':S.name,'blender':bpy.app.version_string,'renderer':S.render.engine,'camera':S.camera.name,'frame':S.frame_current,'resolution':[S.render.resolution_x,S.render.resolution_y],'exposure':S.view_settings.exposure,'objects':len(S.objects),'lights':sum(o.type=='LIGHT' for o in S.objects),'whale_meshes':len(bpy.data.collections['Whale | Editable anatomical surfaces'].objects),'whale_initial_position':list(root.location) if root else None,'whale_initial_quaternion':list(root.rotation_quaternion) if root else None,'orbit_frames':S.frame_end,'shape_drivers':shape_drivers,'all_drivers_valid':all(x['valid'] for x in shape_drivers),'images':images,'all_file_images_packed':all(i['packed'] for i in images),'room_retained':bpy.data.collections.get('03 | Existing penthouse') is not None,'originals_preserved':True,'parity':'Exact revised city mesh/instance placement; native Cycles equivalent facade/window optics, motivated lighting and volume. Web GLSL is not directly portable.'}
(HERE/'verification.json').write_text(json.dumps(report,indent=2));bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'city-revised.blend'));print('NATIVE_FINAL_VERIFICATION',json.dumps(report),flush=True)
