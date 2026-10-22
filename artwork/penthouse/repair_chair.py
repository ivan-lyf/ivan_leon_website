"""Rebuild the shipped chair's disconnected trim and structural joints in Blender.

Run with Blender --background --factory-startup --python this_file --
    --input original-penthouse.glb --output-dir /absolute/chair-build
The production room and the user's open .blend are never overwritten here.
Existing upholstery, UVs, materials, wheels and placement are retained.
"""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

parser=argparse.ArgumentParser()
parser.add_argument('--input',required=True,type=Path)
parser.add_argument('--output-dir',required=True,type=Path)
parser.add_argument('--render',action='store_true')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
args.output_dir.mkdir(parents=True,exist_ok=True)
# This script runs in its own factory-startup process.
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(args.input.resolve()),merge_vertices=True)
chair=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith('CHAIR_')]
assert len(chair)==5,'Expected the five shipped chair material batches'
for o in list(bpy.context.scene.objects):
    if o not in chair:bpy.data.objects.remove(o,do_unlink=True)
scene=bpy.context.scene
scene.name='Leon | Chair rebuilt joints'
scene.unit_settings.system='METRIC'
upholstery=next(o for o in chair if 'Charcoal upholstery' in o.data.materials[0].name)
piping=next(o for o in chair if 'Tonal stitching' in o.data.materials[0].name)
metal=next(o for o in chair if 'Satin aluminium' in o.data.materials[0].name)

# Model coordinates: X right, Y up, Z rear; the authored chair yaw is -0.13.
center=Vector((-.88,0,.89)); yaw=Matrix.Rotation(-.13,4,'Y')
def web_to_blender(p):return Vector((p.x,-p.z,p.y))
def blender_to_web(p):return Vector((p.x,p.z,-p.y))
def local_to_world(p):return web_to_blender(center+yaw@Vector(p))
def world_to_local(p):return yaw.inverted()@(blender_to_web(p)-center)
def world_vertices(o):return [o.matrix_world@v.co for v in o.data.vertices]
def bvh(o):return BVHTree.FromPolygons(world_vertices(o),[list(f.vertices) for f in o.data.polygons],all_triangles=False)
def bounds(objects):
    p=[v for o in objects for v in world_vertices(o)]
    return [[min(v[i] for v in p) for i in range(3)],[max(v[i] for v in p) for i in range(3)]]
old_bounds=bounds(chair);surface=bvh(upholstery)
old_pipe_distances=[surface.find_nearest(p)[3] for p in world_vertices(piping)]

# A reproducible neutral inspection rig, excluded from the exported asset.
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1000;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.world.color=(.18,.18,.18)
scene.view_settings.view_transform='AgX'
rig=[]
def area(name,pos,power,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=local_to_world(pos)
    o.rotation_euler=(local_to_world((0,.55,0))-o.location).to_track_quat('-Z','Y').to_euler();rig.append(o)
area('INSPECT_key',(-1.4,2,-1.8),140,2)
area('INSPECT_rim',(1.2,1.5,1.2),110,1.5)
camdata=bpy.data.cameras.new('INSPECT_camera');cam=bpy.data.objects.new('INSPECT_camera',camdata);scene.collection.objects.link(cam);rig.append(cam);scene.camera=cam;camdata.lens=58
# Back-three-quarter shows the piping, under-seat mounting and backrest brackets.
def render(name,position):
    cam.location=local_to_world(position);cam.rotation_euler=(local_to_world((0,.54,0))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(args.output_dir/(name+'.png'));bpy.ops.render.render(write_still=True)
if args.render:render('chair-before', (1.55,1.13,1.8))

# Each piping cross-section stays circular and retains its original UVs. Move
# its centre onto the actual padded mesh, embedding most of the 1.2 mm radius.
rings={}
for vertex in piping.data.vertices:
    p=piping.matrix_world@vertex.co; q=world_to_local(p)
    side=-1 if q.x<0 else 1
    ring=max(0,min(18,round((q.y-.54)/(.505/18))))
    rings.setdefault((side,ring),[]).append(vertex)
assert len(rings)==38,'Expected nineteen sections along each side of the backrest'
inv=piping.matrix_world.inverted();ring_checks=[]
for key,vertices in sorted(rings.items()):
    points=[piping.matrix_world@v.co for v in vertices]
    unique={tuple(round(c,7) for c in p):p for p in points}
    origin=sum(unique.values(),Vector())/len(unique)
    hit,normal,face,distance=surface.find_nearest(origin)
    # Place the centre 0.25 mm above the surface; the rest of the tube is embedded.
    destination=hit+normal*.00025;delta=destination-origin
    for v,p in zip(vertices,points):v.co=inv@(p+delta)
    ring_checks.append({'side':key[0],'ring':key[1],'oldGapMm':distance*1000,'newCentreGapMm':surface.find_nearest(destination)[3]*1000})
piping.data.update()

# Extend only the top of each existing arm tube 10 mm into its padded armrest.
# The rest of the aluminium batch (lift and five-star base) is untouched.
changed=0; inv=metal.matrix_world.inverted()
for v in metal.data.vertices:
    q=world_to_local(metal.matrix_world@v.co)
    if abs(abs(q.x)-.29)<.0121 and .417<q.y<.654 and .053<q.z<.145:
        t=max(0,min(1,(q.y-.42)/.23));q.y+=.010*t
        v.co=inv@local_to_world(q);changed+=1
assert changed>100,'Arm tube identification failed'
metal.data.update()

# New mounts use their own untextured finish; they must not sample unrelated
# islands of the original furniture light/AO atlas.
finish=bpy.data.materials.new('Furniture | Chair structural mounts');finish.use_nodes=True
bs=finish.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.055,.063,.067,1)
bs.inputs['Metallic'].default_value=.65;bs.inputs['Roughness'].default_value=.32
new=[]
def tube(name,points,radius):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.bevel_depth=radius;curve.bevel_resolution=2;curve.use_fill_caps=True
    sp=curve.splines.new('POLY');sp.points.add(len(points)-1)
    for point,p in zip(sp.points,points):point.co=(*p,1)
    o=bpy.data.objects.new(name,curve);scene.collection.objects.link(o);curve.materials.append(finish)
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');o=bpy.context.object
    for face in o.data.polygons:face.use_smooth=True
    o['ao_category']='chair_structure';new.append(o);return o
for side in [-1,1]:
    # Under-seat rail penetrates both the seat shell and the lower arm post.
    tube('CHAIR_Seat_to_arm_mount_'+str(side),[local_to_world((side*.17,.409,.13)),local_to_world((side*.26,.409,.13)),local_to_world((side*.29,.428,.128))],.013)
    # Rear stays bridge the former open gap without changing padded silhouette.
    query=local_to_world((side*.14,.595,.255));hit,normal,_,_=surface.find_nearest(query)
    endpoint=hit-normal*.009
    tube('CHAIR_Backrest_stay_'+str(side),[local_to_world((side*.14,.409,.16)),local_to_world((side*.14,.409,.252)),local_to_world((side*.14,.447,.276)),local_to_world((side*.14,.548,.276)),endpoint],.010)
# A compact mounting plate closes the 3.5 mm shell/mechanism separation.
bpy.ops.mesh.primitive_cube_add(size=1,location=local_to_world((0,.3975,.025)))
plate=bpy.context.object;plate.name='CHAIR_Mechanism_mount';plate.dimensions=(.15,.16,.012)
plate.rotation_euler.z=-.13;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
plate.data.materials.append(finish);plate['ao_category']='chair_structure';new.append(plate)
# One draw call for all added structural pieces.
bpy.ops.object.select_all(action='DESELECT')
for o in new:o.select_set(True)
bpy.context.view_layer.objects.active=new[0];bpy.ops.object.join();mounts=bpy.context.object;mounts.name='CHAIR_Structural_mounts';chair.append(mounts)

new_pipe_distances=[surface.find_nearest(p)[3] for p in world_vertices(piping)]
assert max(new_pipe_distances)<.002,'Piping must be seated within 2 mm of the upholstery'
new_bounds=bounds(chair)
assert all(abs(new_bounds[a][b]-old_bounds[a][b])<.00001 for a in range(2) for b in range(3)),'Repair must retain the original chair envelope'
# Preserve one editable chair-only source, leaving the multi-scene studio intact.
for image in bpy.data.images:
    if image.source=='FILE' and not image.packed_file:
        try:image.pack()
        except RuntimeError:pass
bpy.ops.wm.save_as_mainfile(filepath=str(args.output_dir/'chair-rebuilt.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in chair:o.select_set(True)
bpy.context.view_layer.objects.active=chair[0]
bpy.ops.export_scene.gltf(filepath=str(args.output_dir/'chair-rebuilt.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_lights=False,export_cameras=False,export_extras=True)
report={'source':str(args.input),'meshes':len(chair),'armVerticesAdjusted':changed,'boundsBefore':old_bounds,'boundsAfter':new_bounds,'pipingGapBeforeMm':[min(old_pipe_distances)*1000,max(old_pipe_distances)*1000],'pipingGapAfterMm':[min(new_pipe_distances)*1000,max(new_pipe_distances)*1000],'ringCentres':ring_checks,'originalStudioModified':False}
(args.output_dir/'chair-validation.json').write_text(json.dumps(report,indent=2)+'\n')
if args.render:
    render('chair-after',(1.55,1.13,1.8))
    render('chair-front',(-1.45,1.04,-1.95))
print('CHAIR_REBUILD_OK',json.dumps({k:v for k,v in report.items() if k!='ringCentres'}),flush=True)
