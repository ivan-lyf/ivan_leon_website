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
D=json.loads((HERE/'city-baseline.json').read_text())
SPEC_PATH=ROOT/'shared/assets/city-lighting.json'
MODE=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'baseline'
OUT=HERE/'renders';OUT.mkdir(exist_ok=True)
S=bpy.data.scenes.new('CITY STAGES | '+MODE);bpy.context.window.scene=S
S.unit_settings.system='METRIC';S.unit_settings.scale_length=1
S.render.engine='CYCLES';S.cycles.samples=24;S.cycles.use_denoising=True
S.cycles.max_bounces=5;S.cycles.diffuse_bounces=2;S.cycles.glossy_bounces=3;S.cycles.transmission_bounces=3;S.cycles.volume_bounces=1
S.render.resolution_x=1280;S.render.resolution_y=720;S.render.resolution_percentage=100
S.render.image_settings.file_format='PNG';S.render.fps=24;S.frame_start=1;S.frame_end=192;S.frame_set(1)
S.view_settings.view_transform='AgX';S.view_settings.look='AgX - Medium High Contrast';S.view_settings.exposure=0
S.world=bpy.data.worlds.new('City | restrained storm sky');S.world.use_nodes=True
bg=S.world.node_tree.nodes.get('Background');bg.inputs[0].default_value=(.035,.065,.105,1);bg.inputs[1].default_value=.23
COL={}
for name in ['01 | Existing architecture','02 | Window interiors','03 | Existing penthouse','04 | Practical lighting','05 | LED media','06 | Vehicles','07 | Atmosphere','08 | Cameras']:
 c=bpy.data.collections.new(name);S.collection.children.link(c);COL[name[:2]]=c
C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
def xyz(p):return Vector((p[0],-p[2],p[1]))
def mat(name,color,metal=.1,rough=.5,emission=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color[:3],1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 if emission:p.inputs['Emission Color'].default_value=(*color[:3],1);p.inputs['Emission Strength'].default_value=emission
 m.diffuse_color=(*color[:3],1);return m
colors=[(.026,.036,.043),(.20,.182,.145),(.118,.063,.033),(.145,.175,.17),(.044,.049,.045)]
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
 if 'Headlamp scatter' in entry['name']:continue
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
window_colors=[(.95,.61,.29),(.72,.79,.83),(.30,.59,.67)]
window_mats=[]
for c in window_colors:
 for energy in [.10,.26,.65,1.25]:window_mats.append(mat('Windows | '+str(len(window_mats)),c,metal=.0,rough=.65,emission=energy))
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
 low,high=y-h/2,y+h/2;bay=[1.5,2.4,1.35,2.2,1.75][fam];opening=[(.065,.14,.935,.88),(.19,.23,.81,.83),(.15,.11,.85,.90),(.04,.29,.96,.77),(.16,.24,.84,.72)][fam]
 for side in [False,True]:
  width=d if side else w;bays=max(2,math.floor(width/bay));bw=width/bays;sign=1 if x<0 else -1
  for iy in range(math.ceil((low+112)/3.2),math.floor((high+112)/3.2)):
   for ix in range(bays):
    tenant=hash2(math.floor(ix/3),iy+seed);occupied=hash2(iy,seed)>.41 and tenant>.48+hash2(t['seed'],19)*.14 and hash2(ix+seed,iy+seed)>.08
    temperature=hash2(ix//3+17,iy+seed+13);colour=0 if temperature<.35 else (1 if temperature<.76 else 2);brightness=2 if tenant<.93 else 3
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
key=light('BASE | distant storm moon','SUN',[-60,75,40],(.47,.65,1),.18,target=[0,0,-100]);key.data.angle=math.radians(18)
# Baseline ring proxies replace runtime's analytic ring spill field.
for pos,radii,tint in [([-30,6,-93],[16.2,13.8],(.035,.65,1)),([22,13,-88],[19,14.3],(.75,.045,.72))]:
 for i in range(8):
  a=2*math.pi*i/8;p=[pos[0]+math.cos(a)*radii[0],pos[1]+math.cos(a)*radii[0]*math.tan(.30 if pos[0]<0 else -.28),pos[2]+math.sin(a)*radii[1]]
  light('BASE | ring local spill '+str(pos[0])+' '+str(i),'POINT',p,tint,120,1.2)
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

if MODE=='baseline':
 save('city-00-baseline');render('00-baseline')
else:
 spec=json.loads(SPEC_PATH.read_text())
 # Accept arrays and the authored lighting hierarchy from the runtime manifest.
 def rgb(value):
  if isinstance(value,str):return tuple(int(value.lstrip('#')[i:i+2],16)/255 for i in (0,2,4))
  return tuple(value[:3])
 for p in spec.get('lights',[]):light('STAGE A | '+p['id'],p.get('type','point').upper(),p['position'],rgb(p['color']),p.get('power',300),p.get('size',p.get('radius',1)),p.get('target'))
 # Load existing animated LED materials: no duplicated art or remade source scene.
 with bpy.data.libraries.load(str(ROOT/'artwork/led-billboards/tokyo-signals.blend'),link=False) as (src,dst):dst.materials=[n for n in src.materials if n.startswith('LED')]
 media_mats={m.name:m for m in dst.materials if m}
 print('MEDIA_MATERIALS',list(media_mats),flush=True)
 for panel in spec.get('panels',[]):
  kind=panel.get('type','portrait');tokens={'portrait':'KAO','diamond':'diamond','diamonds':'diamond','radar':'EN /','strips':'strips','ads':'DENSHI','ad':'DENSHI','advert':'DENSHI'}
  token=tokens.get(kind,kind).lower();m=next((m for n,m in media_mats.items() if token in n.lower()),None)
  if m is None:continue
  m=m.copy();m.name='Installed | '+panel['id']
  for n in m.node_tree.nodes:
   if n.bl_idname=='ShaderNodeEmission':n.inputs['Strength'].default_value=panel.get('brightness',1)
  w,h=panel['size'];p=panel['position'];angle=panel.get('rotationY',0)
  me=bpy.data.meshes.new(panel['id']+' screen');me.from_pydata([(-w/2,0,-h/2),(w/2,0,-h/2),(w/2,0,h/2),(-w/2,0,h/2)],[],[(0,1,2,3)]);me.update();uv=me.uv_layers.new(name='LED UV')
  for li,co in enumerate([(0,0),(1,0),(1,1),(0,1)]):uv.data[li].uv=co
  ob=bpy.data.objects.new('MEDIA | '+panel['id'],me);COL['05'].objects.link(ob);ob.location=xyz(p);ob.rotation_euler.z=angle;me.materials.append(m)
  bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(p));back=bpy.context.object
  for c in list(back.users_collection):c.objects.unlink(back)
  COL['05'].objects.link(back);back.name='Cabinet | '+panel['id'];back.dimensions=(w+.20,.42,h+.20);back.rotation_euler.z=angle;back.location+=Vector((math.sin(angle),math.cos(angle),0))*.24;back.data.materials.append(steel)
 save('city-01-lighting');render('01-lighting')
 if MODE=='final':
  # Replace only housing and core, preserving the original sparse braces.
  for ob in native:
   if 'Continuous architectural light housing' in ob.name or 'Opal LED diffuser' in ob.name:ob.hide_render=True;ob.hide_viewport=True
  sys.path.insert(0,str(HERE));from native_ribbons import install
  ribbon_data=install(S,COL['01'],HERE/'ribbons.json',steel)
  render('02-ribbons')
  # Material pass: low-amplitude multi-scale rain weathering, family-specific gloss.
  for m in facades+frames+glass:
   nt=m.node_tree;p=nt.nodes.get('Principled BSDF');tex=nt.nodes.new('ShaderNodeTexNoise');tex.name='Fine rain roughness';tex.inputs['Scale'].default_value=2.8;tex.inputs['Detail'].default_value=3
   remap=nt.nodes.new('ShaderNodeMapRange');base=p.inputs['Roughness'].default_value;remap.inputs['From Min'].default_value=0;remap.inputs['From Max'].default_value=1;remap.inputs['To Min'].default_value=max(.08,base-.035);remap.inputs['To Max'].default_value=min(.9,base+.045);nt.links.new(tex.outputs['Fac'],remap.inputs['Value']);nt.links.new(remap.outputs['Result'],p.inputs['Roughness'])
  # Room panels receive stable local coordinates, soft edge occlusion and blinds.
  uv=me.uv_layers.get('Room UV') if False else None
  winob=bpy.data.objects.get('Occupied floors and reflective dark panes');winmesh=winob.data;uv=winmesh.uv_layers.new(name='Room UV')
  identity=winmesh.color_attributes.new(name='Room identity',type='FLOAT_COLOR',domain='CORNER')
  for poly in winmesh.polygons:
   for li,co in zip(poly.loop_indices,[(0,0),(1,0),(1,1),(0,1)]):
    uv.data[li].uv=co;identity.data[li].color=(hash2(poly.index,81),hash2(poly.index,37),hash2(poly.index,59),1)
  for material in window_mats[:12]:
   nt=material.node_tree;p=nt.nodes.get('Principled BSDF');tc=nt.nodes.new('ShaderNodeTexCoord');sp=nt.nodes.new('ShaderNodeSeparateXYZ');nt.links.new(tc.outputs['UV'],sp.inputs[0])
   def mathnode(operation,a,b=0):
    node=nt.nodes.new('ShaderNodeMath');node.operation=operation
    for i,val in enumerate([a,b]):
     if isinstance(val,(int,float)):node.inputs[i].default_value=val
     else:nt.links.new(val,node.inputs[i])
    return node.outputs[0]
   edge=mathnode('MULTIPLY',sp.outputs[0],mathnode('SUBTRACT',1,sp.outputs[0]));edge=mathnode('MULTIPLY',edge,4);corner=mathnode('ADD',.28,mathnode('MULTIPLY',edge,.72));level=mathnode('ADD',.35,mathnode('MULTIPLY',sp.outputs[1],.65));gain=mathnode('MULTIPLY',corner,level)
   attr=nt.nodes.new('ShaderNodeAttribute');attr.attribute_name='Room identity';ch=nt.nodes.new('ShaderNodeSeparateColor');nt.links.new(attr.outputs['Color'],ch.inputs[0]);rr,gg,bb=ch.outputs[0],ch.outputs[1],ch.outputs[2]
   # Restrained furniture silhouettes and an occasional office partition.
   cabinet=mathnode('MULTIPLY',mathnode('GREATER_THAN',sp.outputs[0],.48),mathnode('LESS_THAN',sp.outputs[1],.28));cabinet=mathnode('MULTIPLY',cabinet,mathnode('GREATER_THAN',rr,.38));gain=mathnode('MULTIPLY',gain,mathnode('SUBTRACT',1,mathnode('MULTIPLY',cabinet,.76)))
   divider=mathnode('LESS_THAN',mathnode('ABSOLUTE',mathnode('SUBTRACT',sp.outputs[0],.33)),.018);divider=mathnode('MULTIPLY',divider,mathnode('GREATER_THAN',gg,.69));gain=mathnode('MULTIPLY',gain,mathnode('SUBTRACT',1,mathnode('MULTIPLY',divider,.68)))
   blind=mathnode('FRACT',mathnode('MULTIPLY',sp.outputs[1],12));blind=mathnode('GREATER_THAN',blind,.80);blind=mathnode('MULTIPLY',blind,mathnode('GREATER_THAN',rr,.64));blindregion=mathnode('GREATER_THAN',sp.outputs[1],mathnode('ADD',.28,mathnode('MULTIPLY',gg,.55)));blind=mathnode('MULTIPLY',blind,blindregion);gain=mathnode('MULTIPLY',gain,mathnode('SUBTRACT',1,mathnode('MULTIPLY',blind,.48)))
   gain=mathnode('MULTIPLY',gain,mathnode('ADD',.44,mathnode('MULTIPLY',bb,.85)));energy=p.inputs['Emission Strength'].default_value;nt.links.new(mathnode('MULTIPLY',gain,energy),p.inputs['Emission Strength']);p.inputs['Metallic'].default_value=.16;p.inputs['Roughness'].default_value=.24;p.inputs['Coat Weight'].default_value=.32
  render('03-materials-windows')
  # A scale-aware depth volume, matching the runtime aerial-perspective replacement.
  bpy.ops.mesh.primitive_cube_add(size=1,location=xyz([0,4,-210]));fog=bpy.context.object
  for c in list(fog.users_collection):c.objects.unlink(fog)
  COL['07'].objects.link(fog);fog.name='Depth haze | begins 30 metres beyond the camera';fog.location=xyz([0,4,-270]);fog.dimensions=(950,480,360)
  fm=bpy.data.materials.new('Air | rain-softened city depth');fm.use_nodes=True;nt=fm.node_tree;nt.nodes.clear();v=nt.nodes.new('ShaderNodeVolumePrincipled');v.inputs['Density'].default_value=.0015;v.inputs['Color'].default_value=(.22,.36,.48,1);v.inputs['Anisotropy'].default_value=.22;o=nt.nodes.new('ShaderNodeOutputMaterial');nt.links.new(v.outputs['Volume'],o.inputs['Volume']);fog.data.materials.append(fm)
  render('04-atmosphere');save('city-05-final');render('05-final')
  S.camera=camera('CAM | Ribbon and glass detail',[-43,2,-62],[-37,3.7,-80.7],32);render('detail-ribbon')
  if spec.get('panels'):
   p=spec['panels'][0]['position'];S.camera=camera('CAM | Billboard and window spill',[p[0]+10,p[1]+1,p[2]+27],p,42);render('detail-media-window')
  S.camera=maincam;save('city-05-final')
audit={'mode':MODE,'blender':bpy.app.version_string,'engine':S.render.engine,'frame':1,'camera':D['camera'],'color_management':{'view':'AgX','look':S.view_settings.look,'exposure':0},'geometry':D['stats'],'native_objects':len(S.objects),'light_count':sum(o.type=='LIGHT' for o in S.objects),'native_window_quads':len(faces),'source_files_unchanged':True,'parity':'Exact original architecture mesh and instance placements. Native facade/window proxies, Cycles physical light transport and volume differ from browser ray-box interiors, analytic spill, cube probes and depth haze.'}
(HERE/('audit-'+MODE+'.json')).write_text(json.dumps(audit,indent=2))
print('CITY_STAGE_COMPLETE',json.dumps(audit),flush=True)
