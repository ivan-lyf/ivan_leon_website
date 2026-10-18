"""Author Leon's penthouse in Blender 5.1. Units are metres, export glTF Y-up.
Run inside Blender; original scenes are retained. Bakes use bake_ao.py afterwards.
"""
import bpy, math, os, json
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'shared/assets/models/penthouse'
SOURCE=ROOT/'artwork/penthouse'
TEX=ROOT/'shared/assets/textures'
SCENE_NAME='Leon | Sky residence'
old=bpy.data.scenes.get(SCENE_NAME)
if old:
    for ob in list(old.objects): bpy.data.objects.remove(ob,do_unlink=True)
    bpy.data.scenes.remove(old)
scene=bpy.data.scenes.new(SCENE_NAME)
bpy.context.window.scene=scene
scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
scene.render.engine='CYCLES';scene.cycles.samples=48
scene.cycles.use_denoising=True
scene.view_settings.view_transform='AgX'
architecture=bpy.data.collections.new('01 | Architecture');scene.collection.children.link(architecture)
furniture=bpy.data.collections.new('02 | Workstation');scene.collection.children.link(furniture)
light_collection=bpy.data.collections.new('03 | Lighting');scene.collection.children.link(light_collection)
collection=architecture
export_objects=[]

def xyz(p): return (p[0],-p[2],p[1])
def dim(s): return (s[0],s[2],s[1])
def place(ob,name,material=None,category='room'):
    ob.name=name
    for c in list(ob.users_collection): c.objects.unlink(ob)
    collection.objects.link(ob)
    if material: ob.data.materials.append(material)
    if ob.type=='MESH':
        ob['ao_category']=category
        export_objects.append(ob)
    return ob

def material(name,color,rough=.5,metal=0):
    m=bpy.data.materials.new(name);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
    m.diffuse_color=(*color,1)
    return m

def image_node(m,path,normal=False,rough=False,strength=.2):
    nt=m.node_tree;bs=nt.nodes.get('Principled BSDF')
    n=nt.nodes.new('ShaderNodeTexImage');n.image=bpy.data.images.load(str(path),check_existing=True)
    uv=nt.nodes.new('ShaderNodeUVMap');uv.uv_map='UVMap';nt.links.new(uv.outputs['UV'],n.inputs['Vector'])
    if normal:
        n.image.colorspace_settings.name='Non-Color';norm=nt.nodes.new('ShaderNodeNormalMap');norm.inputs['Strength'].default_value=strength;nt.links.new(n.outputs['Color'],norm.inputs['Color']);nt.links.new(norm.outputs['Normal'],bs.inputs['Normal'])
    elif rough:
        n.image.colorspace_settings.name='Non-Color';nt.links.new(n.outputs['Color'],bs.inputs['Roughness'])
    else: nt.links.new(n.outputs['Color'],bs.inputs['Base Color'])

def uv_project(ob,scale=1):
    uv=ob.data.uv_layers.get('UVMap') or ob.data.uv_layers.new(name='UVMap')
    for face in ob.data.polygons:
        n=face.normal;axis=max(range(3),key=lambda a:abs(n[a]))
        axes={0:(1,2),1:(0,2),2:(0,1)}[axis]
        for li in face.loop_indices:
            co=ob.data.vertices[ob.data.loops[li].vertex_index].co
            uv.data[li].uv=(co[axes[0]]*scale,co[axes[1]]*scale)

def bevel(ob,width=.01,segments=3):
    if width:
        mod=ob.modifiers.new('Soft manufactured edges','BEVEL');mod.width=width;mod.segments=segments
        mod.affect='EDGES'
        bpy.context.view_layer.objects.active=ob;bpy.ops.object.modifier_apply(modifier=mod.name)
        for f in ob.data.polygons:f.use_smooth=True
        mod=ob.modifiers.new('Weighted face normals','WEIGHTED_NORMAL');mod.keep_sharp=True;mod.weight=50
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return ob

def cube(name,size,pos,mat,bevel_width=.005,category='room',uvscale=1):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(pos));ob=bpy.context.object;ob.dimensions=dim(size)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    place(ob,name,mat,category);uv_project(ob,uvscale);bevel(ob,bevel_width)
    return ob

def cylinder(name,a,b,r,mat,category='furniture',r2=None,verts=24):
    va,vb=Vector(xyz(a)),Vector(xyz(b));delta=vb-va
    bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=r,radius2=r if r2 is None else r2,depth=delta.length,location=(va+vb)/2)
    ob=bpy.context.object;ob.rotation_mode='QUATERNION';ob.rotation_quaternion=delta.to_track_quat('Z','Y')
    place(ob,name,mat,category);bevel(ob,min(r*.18,.004),2)
    return ob

def path_tube(name,points,r,mat,category='furniture'):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=2;curve.bevel_depth=r;curve.bevel_resolution=3
    sp=curve.splines.new('POLY');sp.points.add(len(points)-1)
    for pt,co in zip(sp.points,points):pt.co=(*xyz(co),1)
    ob=bpy.data.objects.new(name,curve);collection.objects.link(ob);ob.data.materials.append(mat)
    bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.convert(target='MESH');ob=bpy.context.object
    ob['ao_category']=category;export_objects.append(ob)
    return ob

stone=material('Room | Polished charcoal stone',(.22,.235,.23),.19)
image_node(stone,TEX/'penthouse/granite_tile_diff_1k.jpg')
image_node(stone,TEX/'penthouse/granite_tile_nor_gl_1k.jpg',normal=True,strength=.065)
plaster=material('Room | Mineral plaster',(.22,.235,.24),.86)
image_node(plaster,TEX/'plaster_normal.jpg',normal=True,strength=.22)
frame=material('Room | Brushed anodized graphite',(.055,.065,.072),.3,.72)
seal=material('Room | EPDM glazing seals',(.018,.022,.025),.9)
white=material('Room | Ceiling mineral finish',(.24,.25,.255),.8)
glass=material('Room | Low iron glass',(.49,.61,.62),.045,.06)
glass.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.045
glass.surface_render_method='DITHERED';glass.diffuse_color=(.49,.61,.62,.045)
led=material('Room | LED opal diffuser',(.9,.87,.78),.4)
ledbs=led.node_tree.nodes.get('Principled BSDF');ledbs.inputs['Emission Color'].default_value=(1,.86,.68,1);ledbs.inputs['Emission Strength'].default_value=3.5
LED_TILE_POSITIONS=[(-1.55,-.5),(1.55,-.5),(-1.55,2.6),(1.55,2.6)]
LED_TILE_SIZE=1.20
LED_TILE_WATTS=160
CEILING_FINISH_Y=3.2
LED_OPENING_SIZE=1.208
LED_DIFFUSER_CENTER_Y=CEILING_FINISH_Y+.004
LED_AREA_LIGHT_Y=CEILING_FINISH_Y-.006
LED_TRIM_OUTER=1.228
LED_TRIM_INNER=1.196
# Large slabs with real joints, beveled edges and individual UV phase offsets.
for ix in range(6):
    for iz in range(6):
        x=-3.5+(ix+.5)*7/6;z=-2+(iz+.5)*7.5/6
        ob=cube('FLOOR_Stone_%02d_%02d'%(ix,iz),(7/6-.003,.10,7.5/6-.003),(x,-.05,z),stone,.002,uvscale=.8)
        for loop in ob.data.uv_layers['UVMap'].data:loop.uv.x+=ix*.37;loop.uv.y+=iz*.43
cube('FLOOR_Joint_bed',(7.02,.08,7.52),(0,-.09,1.75),seal,.002)
# Real through-openings seat each luminous tile inside the ceiling slab.
# The finished underside remains 3.200 m; no fixture box hangs into the room.
ceiling=cube('CEILING_Main',(7.08,.18,7.6),(0,3.29,1.75),white,0)
for i,(x,z) in enumerate(LED_TILE_POSITIONS):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz((x,3.29,z)))
    cutter=bpy.context.object;cutter.name='Temporary ceiling opening %d'%i
    cutter.dimensions=dim((LED_OPENING_SIZE,.5,LED_OPENING_SIZE))
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    modifier=ceiling.modifiers.new('Recessed tile opening %d'%i,'BOOLEAN')
    modifier.operation='DIFFERENCE';modifier.solver='EXACT';modifier.object=cutter
    bpy.context.view_layer.objects.active=ceiling
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    cutter_mesh=cutter.data;bpy.data.objects.remove(cutter,do_unlink=True)
    if cutter_mesh.users==0:bpy.data.meshes.remove(cutter_mesh)
# Boolean cut faces inherit the same continuous ceiling finish.
ceiling.data.materials.clear();ceiling.data.materials.append(white)
for face in ceiling.data.polygons:face.material_index=0
uv_project(ceiling);bevel(ceiling,.001,2)

for side in [-1,1]:
    cube('WALL_Side_'+str(side),(.16,3.2,3.35),(side*3.57,1.6,3.9),plaster,.012,uvscale=.7)
    cube('TRIM_Shadow_gap_'+str(side),(.018,.027,3.3),(side*3.485,.045,3.9),seal,.002)
cube('WALL_Rear',(7.1,3.2,.16),(0,1.6,5.58),plaster,.012)
# Double-profile mullions, perimeter reveals, subtle floor track.
for i in range(7):
    x=-3.5+i*7/6
    cube('FRAME_Front_%02d'%i,(.032,3.2,.065),(x,1.6,-2),frame,.003)
    cube('SEAL_Front_%02d'%i,(.041,3.15,.018),(x,1.6,-1.966),seal,.002)
for i in range(6):
    x=-3.5+(i+.5)*7/6
    ob=cube('GLASS_Front_%02d'%i,(7/6-.035,3.14,.008),(x,1.6,-2.002),glass,.001)
    ob['ao_category']='none'
for side in [-1,1]:
    for i in range(5):
        z=-2+i*1.05
        cube('FRAME_Return_%d_%d'%(side,i),(.065,3.2,.032),(side*3.5,1.6,z),frame,.003)
        if i<4:
            ob=cube('GLASS_Return_%d_%d'%(side,i),(.008,3.14,1.018),(side*3.502,1.6,z+.525),glass,.001);ob['ao_category']='none'
    for y in [.027,3.17]:cube('FRAME_Side_track_%d_%s'%(side,y),(.09,.045,4.25),(side*3.5,y,.1),frame,.003)
for y in [.027,3.17]:cube('FRAME_Front_track_'+str(y),(7.02,.045,.09),(0,y,-2),frame,.004)
for i in range(6):cube('TRIM_Front_vent_%d'%i,(6.9,.007,.012),(0,.004,-1.9+i*.022),frame,.002)
# Office-style square tiles: flush diffusers, narrow trim, concealed housing.
# Diffuser lower face coincides with the ceiling finish, surrounded by a real hole.
for i,(x,z) in enumerate(LED_TILE_POSITIONS):
    cube('LED_HOUSING_%d'%i,(1.242,.045,1.242),(x,3.26,z),frame,.003)
    ob=cube('LED_DIFFUSER_%d'%i,(LED_TILE_SIZE,.008,LED_TILE_SIZE),(x,LED_DIFFUSER_CENTER_Y,z),led,.0005)
    ob['ao_category']='none'
    trim_width=(LED_TRIM_OUTER-LED_TRIM_INNER)/2
    trim_offset=(LED_TRIM_OUTER+LED_TRIM_INNER)/4
    for side in [-1,1]:
        cube('LED_TRIM_%d_X%d'%(i,side),(trim_width,.004,LED_TRIM_OUTER),(x+side*trim_offset,CEILING_FINISH_Y,z),white,.0005)
        cube('LED_TRIM_%d_Z%d'%(i,side),(LED_TRIM_INNER,.004,trim_width),(x,CEILING_FINISH_Y,z+side*trim_offset),white,.0005)
# Workstation materials: base imagery stays in UV0, baked occlusion uses UV1.
collection=furniture
wood=material('Furniture | Oiled American walnut',(.18,.085,.038),.42)
image_node(wood,TEX/'wood_color.jpg');image_node(wood,TEX/'wood_normal.jpg',normal=True,strength=.16)
metal=material('Furniture | Satin graphite steel',(.055,.063,.067),.32,.65)
chrome=material('Furniture | Satin aluminium',(.36,.4,.43),.25,.86)
rubber=material('Furniture | Black rubber',(.018,.022,.025),.82)
leather=material('Furniture | Charcoal upholstery',(.055,.065,.067),.78)
seam=material('Furniture | Tonal stitching',(.11,.125,.125),.85)
beige=material('Furniture | Warm grey ABS',(.55,.54,.47),.37)
inset=material('Furniture | Dark inset',(.035,.045,.038),.53)
keymat=material('Furniture | Keycaps',(.65,.63,.54),.46)
# 1800 x 800 desk. Top at 750 mm; modest chamfer catches window light.
cube('DESK_Walnut_top',(1.8,.045,.8),(-.75,.7275,0),wood,.009,'furniture',uvscale=1.25)
cube('DESK_Underside_reveal',(1.73,.018,.74),(-.75,.697,0),metal,.004,'furniture')
for i,x in enumerate([-1.49,-.01]):
    for j,z in enumerate([-.3,.3]):
        cube('DESK_Leg_%d_%d'%(i,j),(.038,.677,.045),(x,.3465,z),metal,.007,'furniture')
        cube('DESK_Foot_%d_%d'%(i,j),(.045,.014,.052),(x,.007,z),rubber,.004,'furniture')
    cube('DESK_Side_rail_%d'%i,(.038,.045,.64),(x,.665,0),metal,.005,'furniture')
cube('DESK_Rear_stretcher',(1.49,.06,.04),(-.75,.61,-.3),metal,.006,'furniture')
cube('DESK_Cable_trough',(.72,.065,.11),(-.85,.655,-.27),metal,.008,'furniture')
cube('DESK_Mat',(.90,.003,.40),(-.9,.752,.18),leather,.001,'furniture')
# Compact Macintosh-inspired computer; realistic dimensions, restrained bevels.
cx,cy,cz=-.95,.75,-.15
cube('COMPUTER_Main_housing',(.30,.345,.28),(cx,cy+.1825,cz),beige,.014,'furniture')
cube('COMPUTER_Front_bezel',(.29,.32,.024),(cx,cy+.184,cz+.143),beige,.013,'furniture')
cube('COMPUTER_Screen_recess',(.258,.205,.014),(cx,cy+.23,cz+.159),inset,.017,'furniture')
# Convex glass display. A separate UV-mapped surface for the live web texture.
verts=[];faces=[];nx,ny=28,22
sw,sh=.235,.175
for iy in range(ny+1):
    v=iy/ny
    for ix in range(nx+1):
        u=ix/nx;x=(u-.5)*sw;y=(v-.5)*sh
        bulge=.004*(1-(x/(sw*.55))**2)*(1-(y/(sh*.55))**2)
        verts.append(xyz((cx+x,cy+.23+y,cz+.17+bulge)))
for iy in range(ny):
    for ix in range(nx):
        a=iy*(nx+1)+ix;faces.append((a,a+1,a+nx+2,a+nx+1))
mesh=bpy.data.meshes.new('CRT screen');mesh.from_pydata(verts,[],faces);mesh.update();ob=bpy.data.objects.new('SCREEN_SURFACE',mesh);furniture.objects.link(ob);ob['ao_category']='none';export_objects.append(ob)
uv=mesh.uv_layers.new(name='UVMap')
for poly in mesh.polygons:
    for li in poly.loop_indices:
        vi=mesh.loops[li].vertex_index;uv.data[li].uv=((vi%(nx+1))/nx,(vi//(nx+1))/ny)
screenmat=material('Furniture | Live screen',(.07,.12,.10),.2);sb=screenmat.node_tree.nodes.get('Principled BSDF');sb.inputs['Emission Color'].default_value=(.07,.12,.1,1);sb.inputs['Emission Strength'].default_value=.5;mesh.materials.append(screenmat)
cube('COMPUTER_Floppy_slot',(.095,.006,.003),(cx+.049,cy+.066,cz+.157),inset,.001,'furniture')
cube('COMPUTER_Slot_surround',(.108,.002,.004),(cx+.049,cy+.059,cz+.157),beige,.0005,'furniture')
cube('COMPUTER_Base',(.27,.012,.25),(cx,cy+.006,cz),inset,.003,'furniture')
for i in range(10):cube('COMPUTER_Rear_vent_%02d'%i,(.004,.11,.003),(cx-.104+i*.023,cy+.15,cz-.142),inset,.001,'furniture')
for i in range(5):cube('COMPUTER_Front_vent_%02d'%i,(.016,.002,.002),(cx-.097,cy+.04+i*.006,cz+.157),inset,.0005,'furniture')
# Engraved personal name, small enough to read as hardware detailing.
font=bpy.data.curves.new('Leon wordmark','FONT');font.body='LEON';font.size=.013;font.extrude=.0001;font.align_x='LEFT'
ob=bpy.data.objects.new('COMPUTER_LEON_signature',font);furniture.objects.link(ob);ob.location=xyz((cx-.108,cy+.074,cz+.158));ob.rotation_euler=(math.pi/2,0,0);ob.data.materials.append(inset)
bpy.context.view_layer.objects.active=ob;bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.ops.object.convert(target='MESH');ob=bpy.context.object;ob['ao_category']='furniture';export_objects.append(ob)
# Keyboard with sculpted key rows, key gaps and a proper space bar.
kx,kz=-.98,.226
cube('KEYBOARD_Base',(.43,.025,.145),(kx,.767,kz),beige,.007,'furniture')
cube('KEYBOARD_Inset',(.407,.006,.123),(kx,.781,kz),inset,.002,'furniture')
for row in range(4):
    for col in range(14):
        cube('KEYBOARD_Key_%02d_%02d'%(row,col),(.024,.009,.02),(kx-.186+col*.0286,.788+(3-row)*.001,kz-.047+row*.024),keymat,.002,'furniture')
for col in range(4):cube('KEYBOARD_Mod_%d'%col,(.03,.009,.018),(kx-.179+col*.036,.788,kz+.049),keymat,.002,'furniture')
cube('KEYBOARD_Space',(.17,.009,.018),(kx+.035,.788,kz+.049),keymat,.002,'furniture')
cube('KEYBOARD_Return',(.045,.009,.018),(kx+.171,.788,kz+.049),keymat,.002,'furniture')
# Curved mouse with split shell line and a tiny wheel.
bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=xyz((-.55,.777,.22)))
ob=bpy.context.object;ob.scale=dim((.032,.022,.055));bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);place(ob,'MOUSE_Shell',beige,'furniture')
for f in ob.data.polygons:f.use_smooth=True
cube('MOUSE_Split',(.001,.001,.035),(-.55,.798,.2),inset,.0002,'furniture')
# Chair sits on the computer axis, pulled back enough to use the workstation.
chair_objects=[]
chair_x,chair_z=-.88,.89
start=len(export_objects)
cube('CHAIR_Seat_cushion',(.51,.08,.48),(chair_x,.46,chair_z),leather,.036,'furniture')
cube('CHAIR_Seat_shell',(.49,.027,.46),(chair_x,.412,chair_z),metal,.012,'furniture')
# Curved backrest with convex exterior and subtly concave user-facing surface.
verts=[];faces=[];nu,nv=20,18
for j in range(nv+1):
    v=j/nv;w=.248*(1-.08*v)
    for i in range(nu+1):
        u=i/nu*2-1;x=chair_x+u*w;y=.535+v*.52
        z=chair_z+.19+.055*math.sin(v*math.pi*.8)+.025*v-.045*u*u
        verts.append(xyz((x,y,z)))
for j in range(nv):
    for i in range(nu):
        a=j*(nu+1)+i;faces.append((a,a+nu+1,a+nu+2,a+1))
me=bpy.data.meshes.new('Sculpted backrest');me.from_pydata(verts,[],faces);me.update();ob=bpy.data.objects.new('CHAIR_Curved_back',me);furniture.objects.link(ob);me.materials.append(leather);ob['ao_category']='furniture';export_objects.append(ob)
bpy.context.view_layer.objects.active=ob;ob.select_set(True)
solid=ob.modifiers.new('Padded thickness','SOLIDIFY');solid.thickness=.04;bpy.ops.object.modifier_apply(modifier=solid.name);bevel(ob,.012,3)
for f in ob.data.polygons:f.use_smooth=True
# Delicate piping follows the backrest silhouette.
for side in [-1,1]:
    pts=[]
    for j in range(19):
        v=j/18;u=side*.965;pts.append((chair_x+u*.248*(1-.08*v),.54+v*.505,chair_z+.19+.055*math.sin(v*math.pi*.8)+.025*v-.045*u*u-.022))
    path_tube('CHAIR_Edge_stitch_'+str(side),pts,.0012,seam)
for side in [-1,1]:
    x=chair_x+side*.29
    cylinder('CHAIR_Arm_support_'+str(side),(x,.42,chair_z+.13),(x,.65,chair_z+.07),.012,chrome)
    cube('CHAIR_Arm_pad_'+str(side),(.065,.035,.29),(x,.674,chair_z+.025),leather,.016,'furniture')
cube('CHAIR_Mechanism',(.18,.05,.21),(chair_x,.37,chair_z+.025),metal,.01,'furniture')
cylinder('CHAIR_Gas_lift',(chair_x,.15,chair_z),(chair_x,.39,chair_z),.027,chrome)
cylinder('CHAIR_Lift_shroud',(chair_x,.13,chair_z),(chair_x,.28,chair_z),.035,metal)
for i in range(5):
    a=math.tau*i/5+.3;ex=chair_x+math.cos(a)*.3;ez=chair_z+math.sin(a)*.3
    cylinder('CHAIR_Base_arm_%d'%i,(chair_x,.165,chair_z),(ex,.08,ez),.022,chrome,r2=.015)
    cylinder('CHAIR_Caster_pin_%d'%i,(ex,.055,ez),(ex,.095,ez),.01,metal)
    for s in [-1,1]:cylinder('CHAIR_Caster_%d_%d'%(i,s),(ex+s*.019-.009,.034,ez),(ex+s*.019+.009,.034,ez),.032,rubber,verts=20)
# Slight angle, maintaining grounded casters and correct desk alignment.
angle=-.13;origin=Vector(xyz((chair_x,0,chair_z)))
from mathutils import Matrix
rot=Matrix.Rotation(angle,4,'Z')
for ob in export_objects[start:]:
    ob.matrix_world=Matrix.Translation(origin) @ rot @ Matrix.Translation(-origin) @ ob.matrix_world
# Blender lighting rig follows the square ceiling tiles and window wash.
collection=light_collection
world=bpy.data.worlds.new('Penthouse neutral environment');scene.world=world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Color'].default_value=(.29,.34,.39,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.18
for i,(x,z) in enumerate(LED_TILE_POSITIONS):
    data=bpy.data.lights.new('LED square tile %d'%i,'AREA');data.shape='SQUARE';data.size=LED_TILE_SIZE;data.energy=LED_TILE_WATTS;data.color=(1,.88,.74)
    ob=bpy.data.objects.new('LIGHT_LED_%d'%i,data);light_collection.objects.link(ob);ob.location=xyz((x,LED_AREA_LIGHT_Y,z))
window_data=bpy.data.lights.new('City window softbox','AREA');window_data.shape='RECTANGLE';window_data.size=7;window_data.size_y=3.1;window_data.energy=450;window_data.color=(1,.64,.31)
ob=bpy.data.objects.new('LIGHT_Window',window_data);light_collection.objects.link(ob);ob.location=xyz((0,2,-2.5));ob.rotation_euler=(Vector(xyz((0,1,1)))-ob.location).to_track_quat('-Z','Y').to_euler()
# Render camera uses human eye level and a natural architectural lens.
camdata=bpy.data.cameras.new('Residence camera');cam=bpy.data.objects.new('CAMERA_Residence',camdata);light_collection.objects.link(cam);cam.location=xyz((2.6,1.65,4.1));cam.rotation_euler=(Vector(xyz((-.8,1.35,-.8)))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.lens=30;scene.camera=cam
scene.render.resolution_x=1600;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
# Explicit object selection makes original user scenes safe to keep in the .blend.
bpy.ops.object.select_all(action='DESELECT')
for ob in export_objects:ob.select_set(True)
bpy.context.view_layer.objects.active=export_objects[0]
for img in bpy.data.images:
    if img.source=='FILE' and img.filepath: img.pack()
SOURCE.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'penthouse-studio.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'penthouse-v2.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_apply=True,export_lights=False,export_cameras=False,export_extras=True)
manifest={'scene':SCENE_NAME,'units':'metres','webScale':4,'objects':len(export_objects),'desk':{'width':1.8,'depth':.8,'top':.75},'chair':{'seatHeight':.46,'overallHeight':1.055},'computer':{'width':.30,'height':.355,'depth':.31},'room':{'width':7,'depth':7.5,'height':3.2},'ceilingPanels':len(LED_TILE_POSITIONS),'bakedAO':False}
manifest['deskMat']={'width':.90,'depth':.40,'thickness':.003,'center':[-.9,.752,.18],'frontEdgeClearance':.02}
manifest['ceilingPanelLayout']={
    'shape':'square','coordinateSystem':'web X,Y-up,Z in metres',
    'installation':'flush recessed with real ceiling openings',
    'ceilingFinishY':CEILING_FINISH_Y,'openingSize':[LED_OPENING_SIZE,LED_OPENING_SIZE],
    'housingSize':[1.242,.045,1.242],'housingCenterY':3.26,
    'diffuserSize':[LED_TILE_SIZE,.008,LED_TILE_SIZE],
    'trimOuterSize':LED_TRIM_OUTER,'trimInnerSize':LED_TRIM_INNER,'trimProjection':.002,
    'diffuserCenters':[[x,LED_DIFFUSER_CENTER_Y,z] for x,z in LED_TILE_POSITIONS],
    'areaLights':[{'position':[x,LED_AREA_LIGHT_Y,z],'size':[LED_TILE_SIZE,LED_TILE_SIZE],'watts':LED_TILE_WATTS} for x,z in LED_TILE_POSITIONS],
}
manifest['ceilingPanelLayout']['visualReference']={'title': 'Philips CoreLine Panel gen6 600x600 mm', 'url': 'https://www.lighting.philips.com/content/signify-multibrand/aa/en/product/product-detail-page.911401800887_EU.html', 'adaptation': 'Flush office-panel installation with shallow ceiling-colored trim, enlarged to custom 1.20 m diffusers; not a dimensional product replica.'}
manifest['floorFinish']={'roughness':.19,'normalStrength':.065,'finish':'polished charcoal stone'}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
result=manifest
print('PENTHOUSE_BUILD_OK',json.dumps(manifest))
