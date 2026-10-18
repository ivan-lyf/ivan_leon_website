"""Native Blender review of the website's exact existing city, at metre scale.
Run only with background Blender. Custom GLSL interiors and rain need their runtime
implementations; this scene is an editable lighting/geometry review, not a pixel-
identical web renderer. Original room, vehicle and LED source files stay untouched.
"""
from pathlib import Path
import bpy, math, json, random, time, sys
from mathutils import Vector, Matrix
if not bpy.app.background: raise RuntimeError('Use background Blender, preserving the open user scene.')
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
D=json.loads((HERE/'city-revised.json').read_text())
SPEC_PATH=ROOT/'shared/assets/city-lighting.json'
MODE=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'final'
OUT=HERE/'renders';OUT.mkdir(exist_ok=True)
S=bpy.data.scenes.new('CYBERPUNK REVISION | Retrofit city');bpy.context.window.scene=S
S.unit_settings.system='METRIC';S.unit_settings.scale_length=1
S.render.engine='CYCLES';S.cycles.samples=32;S.cycles.use_denoising=True
S.cycles.max_bounces=5;S.cycles.diffuse_bounces=2;S.cycles.glossy_bounces=3;S.cycles.transmission_bounces=3;S.cycles.volume_bounces=1
S.render.resolution_x=1280;S.render.resolution_y=720;S.render.resolution_percentage=100
S.render.image_settings.file_format='PNG';S.render.fps=24;S.frame_start=1;S.frame_end=1440;S.frame_set(1)
S.view_settings.view_transform='AgX';S.view_settings.look='AgX - Medium High Contrast';S.view_settings.exposure=0
S.world=bpy.data.worlds.new('City | restrained storm sky');S.world.use_nodes=True
bg=S.world.node_tree.nodes.get('Background');bg.inputs[0].default_value=(.035,.065,.105,1);bg.inputs[1].default_value=.23
COL={}
for name in ['01 | Existing architecture','02 | Window interiors','03 | Existing penthouse','04 | Practical lighting','05 | Holographic whale','06 | Vehicles','07 | Atmosphere','08 | Cameras']:
 c=bpy.data.collections.new(name);S.collection.children.link(c);COL[name[:2]]=c
C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
def xyz(p):return Vector((p[0],-p[2],p[1]))
def mat(name,color,metal=.1,rough=.5,emission=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color[:3],1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 if emission:p.inputs['Emission Color'].default_value=(*color[:3],1);p.inputs['Emission Strength'].default_value=emission
 m.diffuse_color=(*color[:3],1);return m
colors=[(.042,.049,.052),(.19,.175,.15),(.115,.075,.047),(.14,.155,.145),(.058,.063,.062)]
facades=[mat('Facade | '+n,col,[.65,.025,.78,.1,.38][i],[.27,.76,.38,.43,.66][i]) for i,(n,col) in enumerate(zip(['graphite','stone','bronze','ceramic','industrial'],colors))]
frames=[mat('Frames | family '+str(i),tuple(v*1.2 for v in col),.68,.32) for i,col in enumerate(colors)]
glass=[mat('Glazing | family '+str(i),[(.012,.024,.029),(.023,.027,.025),(.031,.018,.012),(.015,.031,.029),(.018,.025,.026)][i],.7,[.16,.22,.20,.13,.25][i]) for i in range(5)]
for m in glass:
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Coat Weight'].default_value=.45;p.inputs['Coat Roughness'].default_value=.08
steel=mat('Media | black folded aluminium',(.015,.022,.029),.72,.32)
# Linked mesh prototypes preserve the exported 3D shape and placement exactly.
G={}
for key,g in D['geometry'].items():
 me=bpy.data.meshes.new('Web geometry '+key[:8]);pos=g['positions'];verts=[xyz(pos[i:i+3]) for i in range(0,len(pos),3)];indices=g['indices'];me.from_pydata(verts,[],[indices[i:i+3] for i in range(0,len(indices),3)]);me.update()
 if g['uv']:
  uv=me.uv_layers.new(name='UVMap')
  for loop in me.loops:uv.data[loop.index].uv=g['uv'][loop.vertex_index*2:loop.vertex_index*2+2]
 G[key]=me
native=[]
for entry in D['objects']:
 if any(token in entry['name'] for token in ['Headlamp scatter','billboard','orbital ribbon','Opal LED','Continuous architectural light','corporate mark','whale','Whale','Projection']):continue
 for ix,item in enumerate(entry['instances']):
  ob=bpy.data.objects.new(entry['name']+' '+str(ix),G[entry['geometry']]);COL['01'].objects.link(ob)
  a=item['matrix'];M=Matrix([a[i::4] for i in range(4)]);ob.matrix_world=C@M@C.inverted()
  family=int(item['family']);ob['web_family']=family;ob['web_seed']=item['seed'];ob['source_geometry']=entry['geometry']
  if entry['kind']=='ShaderMaterial':m=facades[family]
  elif 'lighting' in entry['name'] or 'LED' in entry['name'] or 'luminous' in entry['name'] or entry['kind']=='MeshBasicMaterial':
   matname=entry['name']+' | '+str(entry['color']);m=bpy.data.materials.get(matname) or mat(matname,entry['color'] or (.1,.4,.7),emission=1)
  else:m=frames[family]
  if not ob.data.materials:ob.data.materials.append(m)
  ob.material_slots[0].link='OBJECT';ob.material_slots[0].material=m
  native.append(ob)
# Reuse the source room. Its native metre coordinates already match our city transform.
with bpy.data.libraries.load(str(ROOT/'artwork/penthouse/penthouse-studio.blend'),link=False) as (src,dst):dst.scenes=[n for n in src.scenes if n.startswith('Leon | Sky residence')]
for original in dst.scenes:
 for ob in original.objects:
  if ob.type=='MESH':new=ob.copy();COL['03'].objects.link(new)
 COL['03'].hide_render=True # Exterior review, just beyond glass; room remains available and editable.
# Construct recessed window/interior planes on existing facade positions, all batched.
# Browser uses ray-box interior mapping instead. This native equivalent permits actual
# glass reflection and area-light interaction, without changing building masses.
window_colors=[(.71,.58,.44),(.59,.62,.60),(.43,.54,.57)]
window_mats=[]
for c in window_colors:
 for energy in [.045,.12,.28,.60]:window_mats.append(mat('Windows | '+str(len(window_mats)),c,metal=.0,rough=.65,emission=energy))
window_mats+=glass
verts=[];faces=[];mis=[];slots=[]
def quad(points,mi):
 start=len(verts);verts.extend([xyz(p) for p in points]);faces.append(tuple(range(start,start+4)));mis.append(mi)
def hash2(x,y):return (math.sin(x*127.1+y*311.7)*43758.5453)%1
for t in D['architecture']['towers']:
 if t.get('shape')=='round':continue
 fam=int(t.get('family',0));seed=t['seed']*97;x,y,z,w,h,d=[t[k] for k in ['x','y','z','w','h','d']]
 # Only near/mid visible front and inside-facing side receive true geometry.
 if z < -255:continue
 low,high=y-h/2,y+h/2;bay=[1.5,2.4,1.35,2.2,1.75][fam];opening=[(.20,.28,.79,.73),(.24,.24,.76,.79),(.25,.18,.75,.81),(.18,.32,.82,.71),(.32,.43,.69,.67)][fam]
 for side in [False,True]:
  width=d if side else w;bays=max(2,math.floor(width/bay));bw=width/bays;sign=1 if x<0 else -1
  for iy in range(math.ceil((low+112)/3.2),math.floor((high+112)/3.2)):
   for ix in range(bays):
    use=t.get('useClass',2);floor_group=math.floor(iy/(2 if use==0 else 4));tenant=hash2(math.floor(ix/(2 if use==1 else 4)),floor_group+seed)
    occupied=hash2(floor_group,seed)>(.72 if use==0 else .45) and tenant>(.58 if use==1 else .62) and hash2(ix+seed,iy+seed)>.17 and iy%7!=0
    temperature=hash2(ix//4+17,floor_group+seed+13);colour=0 if use==1 and temperature<.8 else (2 if use==0 and temperature>.8 else 1);brightness=1 if tenant<.81 else (2 if tenant<.97 else 3)
    mi=colour*4+brightness if occupied else 12+fam
    a=-width/2+(ix+opening[0])*bw;b=-width/2+(ix+opening[2])*bw
    bottom=iy*3.2-112+opening[1]*3.2;top=iy*3.2-112+opening[3]*3.2
    if side:plane=[(x+sign*(w/2+.012),bottom,z+a),(x+sign*(w/2+.012),bottom,z+b),(x+sign*(w/2+.012),top,z+b),(x+sign*(w/2+.012),top,z+a)]
    else:plane=[(x+a,bottom,z+d/2+.012),(x+b,bottom,z+d/2+.012),(x+b,top,z+d/2+.012),(x+a,top,z+d/2+.012)]
    quad(plane,mi)
me=bpy.data.meshes.new('Coherent room clusters | native proxy');me.from_pydata(verts,[],faces);me.update()
for m in window_mats:me.materials.append(m)
for p,mi in zip(me.polygons,mis):p.material_index=mi
ob=bpy.data.objects.new('Occupied floors and reflective dark panes',me);COL['02'].objects.link(ob)
# Lighting hierarchy is independent of camera exposure.
def light(name,kind,p,color,power,size=4,target=None):
 data=bpy.data.lights.new(name,kind);data.energy=power;data.color=color
 if kind=='AREA':
  data.shape='RECTANGLE' if isinstance(size,list) else 'DISK';data.size=size[0] if isinstance(size,list) else size
  if isinstance(size,list):data.size_y=size[1]
 elif kind=='POINT':data.shadow_soft_size=min(size) if isinstance(size,list) else size
 ob=bpy.data.objects.new(name,data);COL['04'].objects.link(ob);ob.location=xyz(p)
 if target:ob.rotation_euler=(xyz(target)-ob.location).to_track_quat('-Z','Y').to_euler()
 return ob
key=light('BASE | distant storm moon','SUN',[-60,75,40],(.47,.65,1),1.12,target=[0,0,-100]);key.data.angle=math.radians(18)
# Reuse the authored spinner mesh data, preserving original flight positions.
with bpy.data.libraries.load(str(ROOT/'artwork/spinner/skyline-spinner.blend'),link=False) as (src,dst):dst.collections=[n for n in src.collections if n=='Editable vehicle']
carcol=next((c for c in dst.collections if c),None)
if carcol:
 for i,car in enumerate(D['cars']):
  empty=bpy.data.objects.new('Spinner flight '+str(i),None);COL['06'].objects.link(empty);empty.instance_type='COLLECTION';empty.instance_collection=carcol;empty.location=xyz(car['position']);empty.scale=(car['scale'],)*3
  direction=xyz(car['direction']);up=Vector((0,0,1));side=up.cross(direction).normalized();localup=direction.cross(side).normalized();basis=Matrix((direction,side,localup)).transposed();empty.rotation_euler=basis.to_euler()
# Keep matching camera settings through every pass.
def camera(name,position,target,lens_angle=52):
 data=bpy.data.cameras.new(name);data.type='PERSP';data.sensor_fit='VERTICAL';data.angle=math.radians(lens_angle);data.clip_start=.025;data.clip_end=1800
 ob=bpy.data.objects.new(name,data);COL['08'].objects.link(ob);ob.location=xyz(position);ob.rotation_euler=(xyz(target)-ob.location).to_track_quat('-Z','Y').to_euler();return ob
S.camera=camera('CAM | Existing city preset',D['camera']['position'],D['camera']['target'])
maincam=S.camera

def compositor():
 tree=bpy.data.node_groups.new('City optics | modest luminous diffusion','CompositorNodeTree');S.compositing_node_group=tree;tree.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
 r=tree.nodes.new('CompositorNodeRLayers');r.scene=S;gl=tree.nodes.new('CompositorNodeGlare');gl.inputs['Type'].default_value='Fog Glow';gl.inputs['Quality'].default_value='Medium';gl.inputs['Threshold'].default_value=1.6;gl.inputs['Strength'].default_value=.10
 out=tree.nodes.new('NodeGroupOutput');tree.links.new(r.outputs['Image'],gl.inputs['Image']);tree.links.new(gl.outputs['Image'],out.inputs['Image'])
compositor()

def render(label):
 S.render.filepath=str(OUT/(label+'.png'));start=time.monotonic();bpy.ops.render.render(write_still=True);elapsed=time.monotonic()-start
 print('CITY_STAGE_RENDER',json.dumps({'label':label,'seconds':round(elapsed,2),'camera':S.camera.name,'frame':S.frame_current,'exposure':S.view_settings.exposure}),flush=True)
 return elapsed

def save(name):
 for im in bpy.data.images:
  if im.source=='FILE' and im.has_data:
   try:im.pack()
   except Exception:pass
 bpy.ops.wm.save_as_mainfile(filepath=str(HERE/(name+'.blend')))


# Subtle multiscale weathering, anisotropic rain streaks and repaired cladding.
for m in facades+frames+glass:
 nt=m.node_tree;p=nt.nodes.get('Principled BSDF');tc=nt.nodes.new('ShaderNodeTexCoord');mapping=nt.nodes.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(1.6,1.6,.035);nt.links.new(tc.outputs['Generated'],mapping.inputs[0])
 streak=nt.nodes.new('ShaderNodeTexNoise');streak.inputs['Scale'].default_value=27;streak.inputs['Detail'].default_value=4;nt.links.new(mapping.outputs[0],streak.inputs['Vector'])
 noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=4.2;noise.inputs['Detail'].default_value=2.6;nt.links.new(tc.outputs['Object'],noise.inputs['Vector'])
 mix=nt.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=.68;nt.links.new(noise.outputs['Fac'],mix.inputs[1]);nt.links.new(streak.outputs['Fac'],mix.inputs[2])
 ramp=nt.nodes.new('ShaderNodeValToRGB');base=p.inputs['Base Color'].default_value[:3];ramp.color_ramp.elements[0].position=.18;ramp.color_ramp.elements[0].color=(*(v*.43 for v in base),1);ramp.color_ramp.elements[1].position=.8;ramp.color_ramp.elements[1].color=(*(v*1.14 for v in base),1);nt.links.new(mix.outputs[0],ramp.inputs[0]);nt.links.new(ramp.outputs[0],p.inputs['Base Color'])
 remap=nt.nodes.new('ShaderNodeMapRange');rough=p.inputs['Roughness'].default_value;remap.inputs['To Min'].default_value=max(.07,rough-.14);remap.inputs['To Max'].default_value=min(.93,rough+.16);nt.links.new(mix.outputs[0],remap.inputs['Value']);nt.links.new(remap.outputs[0],p.inputs['Roughness'])
 bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.12 if m not in glass else .035;bump.inputs['Distance'].default_value=.035 if m not in glass else .006;nt.links.new(noise.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs[0],p.inputs['Normal'])
# Dark room corners, partitions and uneven blinds are attached to actual window
# quads. The web renderer instead uses its rebuilt depth-mapped room shader.
winmesh=bpy.data.objects.get('Occupied floors and reflective dark panes').data;uv=winmesh.uv_layers.new(name='Room UV');identity=winmesh.color_attributes.new(name='Room identity',type='FLOAT_COLOR',domain='CORNER')
for poly in winmesh.polygons:
 for li,co in zip(poly.loop_indices,[(0,0),(1,0),(1,1),(0,1)]):uv.data[li].uv=co;identity.data[li].color=(hash2(poly.index,81),hash2(poly.index,37),hash2(poly.index,59),1)
for material in window_mats[:12]:
 nt=material.node_tree;p=nt.nodes.get('Principled BSDF');tc=nt.nodes.new('ShaderNodeTexCoord');sp=nt.nodes.new('ShaderNodeSeparateXYZ');nt.links.new(tc.outputs['UV'],sp.inputs[0])
 def mn(op,a,b=0):
  n=nt.nodes.new('ShaderNodeMath');n.operation=op
  for i,v in enumerate([a,b]):
   if isinstance(v,(int,float)):n.inputs[i].default_value=v
   else:nt.links.new(v,n.inputs[i])
  return n.outputs[0]
 attr=nt.nodes.new('ShaderNodeAttribute');attr.attribute_name='Room identity';ch=nt.nodes.new('ShaderNodeSeparateColor');nt.links.new(attr.outputs['Color'],ch.inputs[0]);rr,gg,bb=ch.outputs[:3]
 edge=mn('MULTIPLY',sp.outputs[0],mn('SUBTRACT',1,sp.outputs[0]));gain=mn('ADD',.18,mn('MULTIPLY',edge,2.8));gain=mn('MULTIPLY',gain,mn('ADD',.15,mn('MULTIPLY',sp.outputs[1],.85)))
 divider=mn('LESS_THAN',mn('ABSOLUTE',mn('SUBTRACT',sp.outputs[0],.37)),.027);gain=mn('MULTIPLY',gain,mn('SUBTRACT',1,mn('MULTIPLY',divider,.84)))
 blind=mn('GREATER_THAN',mn('FRACT',mn('MULTIPLY',sp.outputs[1],11)),.63);blind=mn('MULTIPLY',blind,mn('GREATER_THAN',rr,.52));blind=mn('MULTIPLY',blind,mn('GREATER_THAN',sp.outputs[1],gg));gain=mn('MULTIPLY',gain,mn('SUBTRACT',1,mn('MULTIPLY',blind,.68)))
 gain=mn('MULTIPLY',gain,mn('ADD',.25,mn('MULTIPLY',bb,.75)));energy=p.inputs['Emission Strength'].default_value;nt.links.new(mn('MULTIPLY',gain,energy),p.inputs['Emission Strength']);p.inputs['Metallic'].default_value=.26;p.inputs['Roughness'].default_value=.26;p.inputs['Coat Weight'].default_value=.18
# Motivated maintenance points and lower-city reflected light; no global lift.
spec=json.loads(SPEC_PATH.read_text())
for p in spec.get('lights',[]):
 if p.get('panel'):continue
 color=p['color'];color=tuple(int(color.lstrip('#')[i:i+2],16)/255 for i in (0,2,4)) if isinstance(color,str) else color
 light('Practical | '+p['id'],p.get('type','point').upper(),p['position'],color,p.get('power',18),p.get('size',.3),p.get('target'))
for x,z,tint,power in [(-38,-80,(.16,.32,.38),2000),(30,-77,(.37,.15,.25),1800),(-75,-145,(.39,.31,.22),3200),(92,-160,(.20,.30,.36),3400)]:
 light('Urban | recessed service well '+str(x),'AREA',[x,-8,z],tint,power,[20,32],[x,-8,z-12])
save('city-01-architecture-materials');render('00-retrofit-architecture')
# Homogeneous distant air and low irregular wet haze retain foreground clarity.
bpy.ops.mesh.primitive_cube_add(size=1,location=xyz([0,4,-270]));fog=bpy.context.object
for c in list(fog.users_collection):c.objects.unlink(fog)
COL['07'].objects.link(fog);fog.name='Rain air | depth volume';fog.dimensions=(950,480,360)
fm=bpy.data.materials.new('Air | restrained wet night scattering');fm.use_nodes=True;nt=fm.node_tree;nt.nodes.clear();v=nt.nodes.new('ShaderNodeVolumePrincipled');v.inputs['Density'].default_value=.0014;v.inputs['Color'].default_value=(.24,.34,.40,1);v.inputs['Anisotropy'].default_value=.25;o=nt.nodes.new('ShaderNodeOutputMaterial');nt.links.new(v.outputs['Volume'],o.inputs['Volume']);fog.data.materials.append(fm)
# Animated volumetric whale is authored independently; append its native source
# and exact t=0 runtime placement when the bridge manifest is available.
bridge=HERE/'whale-native.json'
if bridge.exists():
 W=json.loads(bridge.read_text());whale_path=ROOT/W['blend'];collection_name=W['collection']
 with bpy.data.libraries.load(str(whale_path),link=False) as (src,dst):
  dst.collections=[collection_name];dst.objects=['Projection | Inner suspended specks']
 wc=next((c for c in dst.collections if c),None)
 if wc:
  COL['05'].children.link(wc)
  root=bpy.data.objects.new('Whale | City placement',None);COL['05'].objects.link(root);root.location=xyz(W.get('position',[-3,9,-108]));root.rotation_mode='QUATERNION';root.rotation_quaternion=W.get('rotationQuaternion',[1,0,0,0])
  for ob in wc.objects:
   if ob.parent is None:ob.parent=root
  seen_materials=set()
  for ob in wc.objects:
   for slot in ob.material_slots:
    material=slot.material
    if not material or material.name in seen_materials:continue
    seen_materials.add(material.name);nt=material.node_tree
    for n in list(nt.nodes):
     if n.bl_idname=='ShaderNodeMixShader' and n.inputs[0].links:
      source=n.inputs[0].links[0].from_socket;gain=nt.nodes.new('ShaderNodeMath');gain.operation='MULTIPLY';gain.inputs[1].default_value=.74;nt.links.new(source,gain.inputs[0]);nt.links.new(gain.outputs[0],n.inputs[0])
  for ob in dst.objects:
   if ob:COL['05'].objects.link(ob);ob.parent=root
 for name,p in W.get('objects',{}).items():
  ob=bpy.data.objects.get(name)
  if ob:
   if 'position' in p:ob.location=xyz(p['position'])
   if 'rotationEuler' in p:ob.rotation_euler=p['rotationEuler']
   if 'scale' in p:ob.scale=p['scale']
 for l in W.get('lights',[]):light('Whale | '+l['id'],'POINT',l['position'],l['color'],l['power'],l.get('radius',5))
# A few world-space rain streaks catch motivated local sources. Distant rain is
# carried by volume, rather than an identical white overlay across the image.
random.seed(901);rainverts=[];rainfaces=[]
for i in range(420):
 x=random.uniform(-80,80);z=random.uniform(-35,-165);y=random.uniform(-58,61);length=random.uniform(.18,.64);width=random.uniform(.004,.013)
 if random.random()>.52 and abs(x)>30:continue
 st=len(rainverts);rainverts.extend([xyz([x-width,y,z]),xyz([x+width,y,z]),xyz([x+.055+width,y-length,z]),xyz([x+.055-width,y-length,z])]);rainfaces.append((st,st+1,st+2,st+3))
rm=bpy.data.meshes.new('Sparse lit rain');rm.from_pydata(rainverts,[],rainfaces);rainob=bpy.data.objects.new('Sparse foreground rainfall',rm);COL['07'].objects.link(rainob);rm.materials.append(mat('Rain | soft cold glint',(.19,.25,.27),metal=.25,rough=.17,emission=.06))
S.camera=maincam;save('city-revised');render('01-revised-city')
S.camera=camera('CAM | Retrofitted facade and maintenance dock',[-49,9,-51],[-30,11,-84],42);render('02-retrofit-detail')
S.camera=maincam;save('city-revised')
audit={'blender':bpy.app.version_string,'renderer':S.render.engine,'samples':S.cycles.samples,'camera':D['camera'],'exposure':S.view_settings.exposure,'frame':S.frame_current,'architecture':D['stats'],'objects':len(S.objects),'lights':sum(o.type=='LIGHT' for o in S.objects),'whale_bridge_loaded':bridge.exists(),'native_window_quads':len(faces),'parity':'Native equivalent materials, real geometry/instance placements from web export; GLSL room mapping, aerial perspective and animation use separate equivalent implementations.'}
(HERE/'verification.json').write_text(json.dumps(audit,indent=2));print('CITY_REVISION_COMPLETE',json.dumps(audit),flush=True)

# Persist native full-orbit animation and validation after the still review.
exec(compile((HERE/'finalize_native.py').read_text(),str(HERE/'finalize_native.py'),'exec'))
