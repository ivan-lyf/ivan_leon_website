"""Author a custom skyline spinner from inspected George Hull visual references.
Reference: https://www.ghull.com/_page-template (Blade Runner 2049 concepts).
The broad wrap windshield, split front pods, rear vents and armoured silhouette
inform original geometry; no reference pixels, film logos or weapons are copied.
Run in a separate background Blender process, not the user's open room scene.
Export: metres, glTF Y-up, front +X; source objects remain individually editable.
"""
from pathlib import Path
import bpy, bmesh, math, json, random
from mathutils import Vector

if not bpy.app.background:
    raise RuntimeError('Run this authoring script in an isolated background Blender process.')
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'artwork/spinner'; OUT=ROOT/'shared/assets/models/city'
SOURCE.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
scene=bpy.data.scenes.new('Leon | Skyline spinner');bpy.context.window.scene=scene
scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
vehicle=bpy.data.collections.new('Editable vehicle');scene.collection.children.link(vehicle)
studio=bpy.data.collections.new('Studio - not exported');scene.collection.children.link(studio)
objects=[]
def xyz(p):return (p[0],-p[2],p[1])
def dims(p):return (p[0],p[2],p[1])
def material(name,color,rough,metal=0,emission=None):
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    if emission:p.inputs['Emission Color'].default_value=(*emission,1);p.inputs['Emission Strength'].default_value=2.2
    m.diffuse_color=(*color,1);return m
body=material('Spinner | Weathered graphite',(.045,.067,.073),.43,.62)
armor=material('Spinner | Raised armour',(.095,.125,.13),.36,.57)
black=material('Spinner | Recessed mechanics',(.014,.023,.027),.56,.3)
glass=material('Spinner | Deep petrol canopy',(.025,.12,.145),.13,.7)
steel=material('Spinner | Brushed titanium',(.30,.35,.36),.28,.88)
ivory=material('Spinner | Warm headlights',(.82,.80,.61),.28,.2,(1,.86,.55))
cyan=material('Spinner | Cool running lights',(.06,.4,.52),.25,.15,(.08,.76,1))
red=material('Spinner | Rear navigation lights',(.35,.015,.01),.3,.2,(1,.025,.008))
paint=material('Spinner | Service markings',(.64,.61,.42),.65,.05)

def finish(ob,name,mat,bev=0,segments=2):
    ob.name=name
    for c in list(ob.users_collection):c.objects.unlink(ob)
    vehicle.objects.link(ob);ob.data.materials.append(mat);objects.append(ob)
    bpy.context.view_layer.objects.active=ob
    if bev:
        mod=ob.modifiers.new('Manufactured edge radii','BEVEL');mod.width=bev;mod.segments=segments
        bpy.ops.object.modifier_apply(modifier=mod.name)
        for face in ob.data.polygons:face.use_smooth=True
        mod=ob.modifiers.new('Weighted panels','WEIGHTED_NORMAL');mod.keep_sharp=True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return ob

def cube(name,size,pos,mat,bev=.012):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(pos));ob=bpy.context.object;ob.dimensions=dims(size)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(ob,name,mat,bev)

def mesh(name,verts,faces,mat,bev=0):
    me=bpy.data.meshes.new(name);me.from_pydata([xyz(v) for v in verts],[],faces);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(me);bm.free()
    ob=bpy.data.objects.new(name,me);vehicle.objects.link(ob)
    return finish(ob,name,mat,bev)

def prism(name,profile,z,width,mat,bev=.015):
    n=len(profile);verts=[(x,y,z+side*width/2) for side in [-1,1] for x,y in profile]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,verts,faces,mat,bev)

def tube(name,points,r,mat):
    cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.bevel_depth=r;cu.bevel_resolution=2;cu.resolution_u=1
    sp=cu.splines.new('POLY');sp.points.add(len(points)-1)
    for point,co in zip(sp.points,points):point.co=(*xyz(co),1)
    ob=bpy.data.objects.new(name,cu);vehicle.objects.link(ob);bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.object.convert(target='MESH')
    return finish(bpy.context.object,name,mat)

def cylinder(name,a,b,r,mat,verts=20):
    va,vb=Vector(xyz(a)),Vector(xyz(b));delta=vb-va
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=delta.length,location=(va+vb)/2)
    ob=bpy.context.object;ob.rotation_mode='QUATERNION';ob.rotation_quaternion=delta.to_track_quat('Z','Y')
    return finish(ob,name,mat,.008)

# A continuous tapered hull: low armoured rear, narrow nose between split pods.
sections=[(-2.40,.72,-.34,.18,.35),(-1.95,1.04,-.52,.25,.55),(-1.20,1.08,-.51,.32,.64),(-.40,.99,-.46,.31,.61),(.60,.85,-.39,.25,.43),(1.28,.64,-.30,.16,.25)]
verts=[]
for x,w,belt_bottom,belt,top in sections:
    verts.extend([(x,belt_bottom,-w*.77),(x,belt_bottom,w*.77),(x,belt-.12,w),(x,belt,w),(x,top,w*.77),(x,top,-w*.77),(x,belt,-w),(x,belt-.12,-w)])
faces=[tuple(range(7,-1,-1)),tuple(range((len(sections)-1)*8,len(sections)*8))]
for j in range(len(sections)-1):
    for i in range(8):faces.append((j*8+i,j*8+(i+1)%8,(j+1)*8+(i+1)%8,(j+1)*8+i))
mesh('Hull - sculpted continuous shell',verts,faces,body,.035)
prism('Underside keel',[(-2.04,-.40),(-1.6,-.60),(.60,-.49),(1.06,-.32)],0,1.04,black,.028)

# Wrap canopy follows the reference's long forward slope and high rear crown.
mesh('Canopy - sloped wrap glazing',[
    (-1.42,.54,-.73),(-1.42,.54,.73),(-1.04,1.00,-.55),(-1.04,1.00,.55),
    (-.56,1.04,-.58),(-.56,1.04,.58),(.14,.79,-.68),(.14,.79,.68),(.95,.35,-.73),(.95,.35,.73)
],[(0,1,3,2),(2,3,5,4),(4,5,7,6),(6,7,9,8),(0,2,4,6,8),(1,9,7,5,3)],glass,.008)
# Rear roof armour and structural rails break the glazing into convincing panels.
prism('Canopy rear roof',[(-1.48,.52),(-1.05,1.03),(-.77,1.05),(-.87,.92),(-1.29,.51)],0,1.23,armor,.018)
for side in [-1,1]:
    tube('Canopy outer rail '+str(side),[(-1.43,.55,side*.75),(-1.04,1.025,side*.58),(-.56,1.06,side*.61),(.15,.81,side*.705),(.99,.36,side*.76)],.024,steel)
    tube('Side window lower sill '+str(side),[(-1.38,.53,side*.765),(-.60,.49,side*.86),(.95,.34,side*.76)],.032,body)
    tube('Canopy cross pillar '+str(side),[(-.67,.50,side*.85),(-.84,.97,side*.605)],.033,armor)
    # Long spear-shaped side intake inset and a narrower inner grille.
    prism('Side intake '+str(side),[(-.83,.24),(.52,.21),(.73,-.02),(.29,-.17),(-.82,-.12)],side*1.005,.025,black,.008)
    prism('Side inset trim '+str(side),[(-.73,.17),(.35,.15),(.46,.01),(.24,-.085),(-.72,-.06)],side*1.025,.014,steel,.006)
    prism('Side inset black core '+str(side),[(-.66,.13),(.28,.11),(.36,.015),(.19,-.04),(-.66,-.025)],side*1.036,.008,black,.003)
    prism('Rear quarter armour '+str(side),[(-2.28,.25),(-1.65,.48),(-1.26,.30),(-.99,-.30),(-1.86,-.37),(-2.31,-.08)],side*.995,.065,armor,.015)
    tube('Diagonal amber ID stripe '+str(side),[(-1.48,.30,side*1.041),(-1.19,-.18,side*1.041)],.029,ivory)
    tube('Lower sill trim '+str(side),[(-1.93,-.36,side*.95),(-.91,-.37,side*1.03),(.74,-.29,side*.83)],.025,steel)
    cube('Door release '+str(side),(.18,.055,.035),(-.83,.35,side*.97),black,.012)

# Distinct separated forward propulsion pods with rounded vertical bumpers.
pod_profile=[(.69,-.30),(2.12,-.30),(2.36,-.20),(2.50,-.01),(2.50,.15),(2.40,.34),(2.21,.43),(.94,.43),(.68,.24)]
for side in [-1,1]:
    z=side*.94
    prism('Front split pod '+str(side),pod_profile,z,.61,body,.035)
    prism('Front pod upper armour '+str(side),[(.98,.44),(2.19,.44),(2.37,.34),(2.29,.30),(1.04,.34)],z,.53,armor,.014)
    # Exposed articulation behind each pod, visible in the central split.
    cylinder('Pod hinge '+str(side),(.77,.0,z-.28),(.77,.0,z+.28),.19,black)
    cylinder('Pod hinge face '+str(side),(.77,.0,z+side*.285),(.77,.0,z+side*.31),.14,steel)
    tube('Pod front bumper '+str(side),[(2.16+.36*math.cos(a),.065+.355*math.sin(a),z+side*.315) for a in [math.radians(v) for v in range(-90,91,15)]],.028,steel)
    cube('Headlamp recess '+str(side),(.045,.15,.39),(2.495,.04,z),black,.015)
    cube('Warm front lamp '+str(side),(.048,.058,.29),(2.522,.075,z),ivory,.009)
    cube('Cyan front marker '+str(side),(.05,.025,.12),(2.525,-.015,z),cyan,.004)
    for j in range(5):
        cube('Pod shoulder vent %s %d'%(side,j),(.024,.03,.39),(1.01+j*.065,.458,z),black,.003)
    cube('Outer running light '+str(side),(.18,.028,.018),(1.89,.05,z+side*.32),ivory,.003)
    # Recessed armoured access plate, vent fins and visible fasteners from reference.
    prism('Pod access seam '+str(side),[(1.00,.27),(1.81,.27),(2.08,.12),(2.03,-.14),(1.03,-.17)],z+side*.312,.012,black,.007)
    prism('Pod access armour '+str(side),[(1.04,.23),(1.77,.23),(2.03,.10),(1.98,-.10),(1.07,-.13)],z+side*.322,.012,armor,.009)
    cube('Pod side intake '+str(side),(.27,.13,.025),(1.32,.035,z+side*.337),black,.006)
    for j in range(5):cube('Pod side grille %s %d'%(side,j),(.013,.10,.029),(1.22+j*.05,.035,z+side*.35),steel,.002)
    for x,y in [(1.09,.18),(1.82,.16),(1.12,-.08),(1.92,-.06)]:
        cylinder('Pod bolt '+str(side),(x,y,z+side*.332),(x,y,z+side*.344),.014,steel,12)
    tube('Visible pod service cable '+str(side),[(.72,.27,side*.58),(.96,.28,side*.49),(1.25,.23,side*.49),(1.38,.12,side*.57)],.018,black)

    tube('Pod hydraulic line '+str(side),[(.40,-.19,side*.73),(.64,-.13,side*.66),(1.06,-.10,side*.64)],.018,steel)

# Exposed rear deck: segmented cooling louvres, spine and navigation lights.
for j in range(10):
    x=-2.27+j*.078
    cube('Rear cooling louvre %02d'%j,(.045,.045,1.24),(x,.39+(x+2.27)*.17,0),black,.005)
for side in [-1,1]:
    tube('Rear deck rail '+str(side),[(-2.34,.36,side*.67),(-1.50,.57,side*.79)],.029,steel)
    cube('Rear taillight '+str(side),(.03,.075,.29),(-2.41,.15,side*.55),red,.007)
    for j in range(4):cube('Rear side heat vent %s %d'%(side,j),(.04,.19,.024),(-2.17+j*.08,.05,side*1.02),black,.003)
    cube('Lower side marker '+str(side),(.13,.026,.02),(-.15,-.35,side*.97),cyan,.004)
cube('Roof navigation spine',(.50,.065,.22),(-1.07,1.05,0),black,.022)
cube('Roof left marker',(.18,.04,.08),(-1.06,1.095,-.07),cyan,.006)
cube('Roof right marker',(.18,.04,.08),(-1.06,1.095,.07),ivory,.006)

# Four downward lift fans add credible depth underneath, without vehicle wheels.
for i,(x,z) in enumerate([(-1.64,-.65),(-1.64,.65),(1.70,-.94),(1.70,.94)]):
    cylinder('Lift duct %d'%i,(x,-.34,z),(x,-.53,z),.235,black,24)
    cylinder('Lift rim %d'%i,(x,-.51,z),(x,-.555,z),.245,steel,24)
    cylinder('Lift dark aperture %d'%i,(x,-.554,z),(x,-.568,z),.206,black,24)
    for j in range(8):
        a=math.tau*j/8
        vane=cube('Lift vane %d %d'%(i,j),(.20,.014,.035),(x+math.cos(a)*.105,-.576,z+math.sin(a)*.105),steel,0)
        vane.rotation_euler[2]=-a
    cylinder('Lift rotor cap %d'%i,(x,-.57,z),(x,-.59,z),.065,body,16)

# Original service identity; no film or manufacturer logos.
for side in [-1,1]:
    font=bpy.data.curves.new('LM27 service typography','FONT');font.body='LM 27';font.size=.19;font.extrude=.0004;font.align_x='CENTER'
    ob=bpy.data.objects.new('Service identity '+str(side),font);vehicle.objects.link(ob);ob.location=xyz((-1.81,-.025,side*1.041));ob.rotation_euler=(side*math.pi/2,0,0)
    if side<0:ob.rotation_euler[2]=math.pi
    bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.object.convert(target='MESH');finish(bpy.context.object,'LM27 identity '+str(side),paint)

# Subtle per-face wear survives glTF as vertex colour, without borrowed textures.
rng=random.Random(27)
for ob in objects:
    if ob.data.materials[0] not in (body,armor,steel):continue
    attr=ob.data.color_attributes.new(name='Wear',type='BYTE_COLOR',domain='CORNER')
    for face in ob.data.polygons:
        shade=rng.uniform(.87,1.0)
        for li in face.loop_indices:attr.data[li].color=(shade,shade,shade,1)
    ob.data.color_attributes.active_color=attr
    ob.data.color_attributes.render_color_index=0

# Normalize the vehicle bounding-box centre to the export origin.
all_corners=[ob.matrix_world@Vector(corner) for ob in objects for corner in ob.bound_box]
center=Vector([(min(v[i] for v in all_corners)+max(v[i] for v in all_corners))/2 for i in range(3)])
for ob in objects:ob.location-=center
bpy.context.view_layer.update()

# Studio setup is saved with editable meshes, but never included in the GLB.
def studio_object(ob):
    for c in list(ob.users_collection):c.objects.unlink(ob)
    studio.objects.link(ob)
world=bpy.data.worlds.new('Spinner soft studio');world.use_nodes=True;scene.world=world
world.node_tree.nodes['Background'].inputs['Color'].default_value=(.22,.29,.34,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.55
for name,pos,power,size,color in [('Key',(1,5,4),1100,5,(1,.83,.65)),('Rim',(-3,3,-3),1350,4,(.4,.75,1)),('Front',(5,2,-1),650,3,(.65,.82,1))]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
    ob=bpy.data.objects.new(name,data);studio.objects.link(ob);ob.location=xyz(pos);ob.rotation_euler=(Vector(xyz((0,.1,0)))-ob.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=200,location=xyz((0,-.91,0)));ground=bpy.context.object;studio_object(ground);ground.name='Studio ground';ground.data.materials.append(material('Studio floor',(.065,.085,.10),.7))
camdata=bpy.data.cameras.new('Spinner preview camera');cam=bpy.data.objects.new('Spinner preview camera',camdata);studio.objects.link(cam);cam.location=xyz((7.4,4.2,7.2));cam.rotation_euler=(Vector(xyz((0,.08,0)))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.lens=53;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=40;scene.cycles.use_denoising=True
scene.render.resolution_x=1200;scene.render.resolution_y=760;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(SOURCE/'spinner-preview.png')
scene['visual_reference']='George Hull — Blade Runner 2049 concepts, https://www.ghull.com/_page-template'
scene['asset_orientation']='glTF Y up, front +X, metres'
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'skyline-spinner.blend'))
bpy.ops.render.render(write_still=True)

# Join export-only copies by material: nine efficient draws, editable source intact.
export=bpy.data.collections.new('Optimized export');scene.collection.children.link(export)
groups={}
for ob in objects:
    copy=ob.copy();copy.data=ob.data.copy();export.objects.link(copy)
    groups.setdefault(ob.data.materials[0],[]).append(copy)
merged=[]
for mat,items in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for ob in items:ob.select_set(True)
    bpy.context.view_layer.objects.active=items[0]
    if len(items)>1:bpy.ops.object.join()
    ob=bpy.context.object;ob.name='Spinner_'+mat.name.split('|')[-1].strip().replace(' ','_');merged.append(ob)
    ob.data.calc_loop_triangles()
    if len(ob.data.loop_triangles)>100:
        modifier=ob.modifiers.new('Web detail budget','DECIMATE');modifier.ratio=.70
        bpy.ops.object.modifier_apply(modifier=modifier.name)
bpy.ops.object.select_all(action='DESELECT')
for ob in merged:ob.select_set(True)
bpy.context.view_layer.objects.active=merged[0]
bpy.ops.export_scene.gltf(filepath=str(OUT/'spinner.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_apply=True,export_lights=False,export_cameras=False,export_vertex_color='ACTIVE',export_extras=True)
lo=Vector((1e9,1e9,1e9));hi=Vector((-1e9,-1e9,-1e9));triangles=0
for ob in objects:
    ob.data.calc_loop_triangles();triangles+=len(ob.data.loop_triangles)
    for corner in ob.bound_box:
        p=ob.matrix_world@Vector(corner)
        for i in range(3):lo[i]=min(lo[i],p[i]);hi[i]=max(hi[i],p[i])
for ob in merged:ob.data.calc_loop_triangles()
manifest={'asset':'LM27 skyline spinner','units':'metres','frontAxis':'+X','upAxis':'+Y','dimensions':[hi.x-lo.x,hi.z-lo.z,hi.y-lo.y],'sourceObjects':len(objects),'exportMeshes':len(merged),'sourceTriangles':triangles,'triangles':sum(len(o.data.loop_triangles) for o in merged),'visualReferences':[{'creator':'George Hull','url':'https://www.ghull.com/_page-template','work':'Blade Runner 2049 vehicle concept illustrations','adaptation':'Original unarmed graphite LM27 design informed by the wrap windshield, split forward pods, cooling vents and armoured silhouette.'}]}
(OUT/'spinner-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('SPINNER_BUILD_OK',json.dumps(manifest),flush=True)
