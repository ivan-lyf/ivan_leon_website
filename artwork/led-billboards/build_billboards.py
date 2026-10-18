"""Build a separate, portable Blender LED animation library. Never edits the room.
Run: Blender --background --factory-startup --python build_billboards.py
Eight-second seamless loops at 24 fps; frame 193 duplicates frame 1.
"""
import bpy, math, sys, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT))
from secondary_graphics import Graph, create_secondary_materials
ASSETS=ROOT/'assets'; OUT=ROOT/'previews'; OUT.mkdir(exist_ok=True)
# This script runs only in a new background Blender process.
if not bpy.app.background:
 raise RuntimeError('Run this rebuild script in a separate background Blender process.')
bpy.ops.wm.read_factory_settings(use_empty=True)
CYAN=(.005,.65,.88,1); MAGENTA=(.75,.005,.24,1); VIOLET=(.19,.005,.62,1); BLACK=(.0003,.0004,.0007,1)

def collection(name,scene):
 c=bpy.data.collections.new(name);scene.collection.children.link(c);return c

def material(name,color,emission=False,strength=1):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes;n.clear()
 out=n.new('ShaderNodeOutputMaterial')
 if emission:
  p=n.new('ShaderNodeEmission');p.inputs['Color'].default_value=color;p.inputs['Strength'].default_value=strength
 else:
  p=n.new('ShaderNodeBsdfPrincipled');p.inputs['Base Color'].default_value=color;p.inputs['Metallic'].default_value=.58;p.inputs['Roughness'].default_value=.56
 m.node_tree.links.new(p.outputs[0],out.inputs['Surface']);return m

def plane(name,cx,cz,w,h,mat,col,y=0):
 mesh=bpy.data.meshes.new(name+' mesh');mesh.from_pydata([(-w/2,0,-h/2),(w/2,0,-h/2),(w/2,0,h/2),(-w/2,0,h/2)],[],[(0,1,2,3)]);mesh.update()
 uv=mesh.uv_layers.new(name='LED UV')
 for poly in mesh.polygons:
  for i,co in zip(poly.loop_indices,[(0,0),(1,0),(1,1),(0,1)]):uv.data[i].uv=co
 ob=bpy.data.objects.new(name,mesh);col.objects.link(ob);ob.location=(cx,y,cz);mesh.materials.append(mat);return ob

def box(name,loc,dims,mat,col,bevel=.025):
 x,y,z=[v/2 for v in dims];verts=[(-x,-y,-z),(-x,-y,z),(-x,y,-z),(-x,y,z),(x,-y,-z),(x,-y,z),(x,y,-z),(x,y,z)]
 mesh=bpy.data.meshes.new(name+' mesh');mesh.from_pydata(verts,[],[(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3),(0,1,3,2),(4,6,7,5)]);mesh.update()
 ob=bpy.data.objects.new(name,mesh);col.objects.link(ob);ob.location=loc;ob.data.materials.append(mat)
 if bevel:b=ob.modifiers.new('Small folded metal edge','BEVEL');b.width=bevel;b.segments=2
 return ob

def camera(scene,col,loc,target,ortho=None):
 data=bpy.data.cameras.new(scene.name+' camera');ob=bpy.data.objects.new(scene.name+' camera',data);col.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler();scene.camera=ob
 if ortho:data.type='ORTHO';data.ortho_scale=ortho
 else:data.lens=45
 return ob

def config(scene,w,h):
 scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True;scene.cycles.max_bounces=3
 scene.render.resolution_x=w;scene.render.resolution_y=h;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';scene.render.fps=24
 scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=-1.1;scene.view_settings.gamma=1
 scene.world=bpy.data.worlds.new(scene.name+' black environment');scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.005,.008,.012,1);scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.13
 scene.frame_start=1;scene.frame_end=192

def raw_image(name,path):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes;n.clear();o=n.new('ShaderNodeOutputMaterial');e=n.new('ShaderNodeEmission');t=n.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(path),check_existing=True);t.interpolation='Closest';m.node_tree.links.new(t.outputs['Color'],e.inputs['Color']);m.node_tree.links.new(e.outputs[0],o.inputs[0]);return m

font_path=next(Path('/System/Library/Fonts').glob('*角* W7.ttc'))
jp=bpy.data.fonts.load(str(font_path)); label_font=bpy.data.fonts.load('/System/Library/Fonts/Menlo.ttc')

def text(name,body,x,z,size,mat,col,font=None,y=-.025,align='LEFT'):
 cu=bpy.data.curves.new(name,'FONT');cu.body=body;cu.size=size;cu.align_x=align;cu.font=font or label_font;cu.space_character=1.12;cu.resolution_u=2
 ob=bpy.data.objects.new(name,cu);col.objects.link(ob);ob.location=(x,y,z);ob.rotation_euler=(math.pi/2,0,0);cu.materials.append(mat);return ob

# Original commercial plates are composed and rasterized in Blender, with real
# Japanese glyphs. The LED shader later samples them at deliberately coarse pitch.
plates=[]
for idx in range(3):
 sc=bpy.data.scenes.new('Artwork plate '+str(idx+1));bpy.context.window.scene=sc;col=collection('Graphic layers',sc);config(sc,480,200);sc.view_settings.exposure=0;sc.cycles.samples=1;sc.cycles.use_denoising=False
 dark=material('Ink '+str(idx),BLACK,True);cyan=material('Cyan ink '+str(idx),CYAN,True);pink=material('Magenta ink '+str(idx),MAGENTA,True);violet=material('Violet ink '+str(idx),VIOLET,True)
 plane('Black field',0,0,6,2.5,dark,col)
 if idx==0:
  plane('Anime illustration',-1.25,0,3.5,2.5,raw_image('Anime source',ASSETS/'anime-transmission.png'),col,y=-.01)
  plane('Cyan copy field',1.65,0,2.7,2.5,cyan,col,y=-.02)
  text('Video transmission','映像通信',.42,.35,.52,dark,col,jp,y=-.04)
  text('Late night','深夜放送',.42,-.30,.52,dark,col,jp,y=-.04)
  text('Channel','CH. 08 / 24H',.48,-.92,.21,dark,col,y=-.04)
 elif idx==1:
  plane('Magenta horizontal field',0,.54,6,1.42,pink,col,y=-.01)
  text('Electronic city','電子都市',-2.6,.10,.90,dark,col,jp,y=-.04)
  text('Video caption','VIDEO / SOUND / 1991',-2.57,-.92,.27,cyan,col,y=-.04)
  # An original geometric optical mark: nested diamond strokes.
  for i in range(3):
   p=box('Diamond symbol '+str(i),(2.04,-.05,-.55),(1-i*.25,.01,1-i*.25),cyan if i%2==0 else dark,col,0);p.rotation_euler[1]=math.pi/4
 else:
  plane('Cyan banner',0,-.5,6,1.5,cyan,col,y=-.01)
  text('Light and sound','光と音',-2.62,.38,.90,pink,col,jp,y=-.04)
  text('New release','新発売',.70,-.70,.67,dark,col,jp,y=-.04)
  # Hard graphic emblem, deliberately not a modern interface.
  for x in range(8):plane('Optical bars '+str(x),-2.4+x*.32,-.55,.18,1.0-(x%3)*.2,dark,col,y=-.035)
 camera(sc,col,(0,-10,0),(0,0,0),6)
 sc.render.filepath=str(ASSETS/f'ad-plate-{idx+1}.png');bpy.ops.render.render(write_still=True,scene=sc.name);plates.append(bpy.data.images.load(sc.render.filepath))
 # Convert typography to editable meshes so no proprietary font needs embedding.
 for ob in list(col.objects):
  if ob.type=='FONT':bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.convert(target='MESH');ob.select_set(False)

scene=bpy.data.scenes.new('TOKYO SIGNALS | LED animation library');bpy.context.window.scene=scene;config(scene,1600,1000)
scene['README']='Eight-second LED loops; frames 1–192 at 24 fps. Frame 193 matches frame 1. Five numbered billboard collections. Artwork and textures packed. See README.md for controls and references.'
stage=collection('00 | Dark architectural display stage',scene)
steel=material('Powder-coated black cabinet',(.009,.014,.022,1));backmat=material('Charcoal architectural concrete',(.017,.023,.032,1));floor=material('Damp dark pavement',(.012,.017,.023,1));floor.node_tree.nodes.get('Principled BSDF') if False else None
labelmat=material('Quiet exhibit captions',(.22,.31,.36,1),True,.7)

def cabinet(name,x,z,w,h,mat,col):
 box(name+' | architectural backing',(x,.7,z),(w+.42,1.4,h+.7),backmat,col,.035)
 box(name+' | metal cabinet',(x,.02,z),(w+.16,.46,h+.16),steel,col,.025)
 p=plane(name+' | LED surface',x,z,w,h,mat,col,y=-.225)
 p['display_size_m']=[w,h];p['animation_frames']=192
 # Modular cabinet seams and sparse service fasteners.
 for zi in range(1,max(2,round(h))):box(name+' | cabinet seam '+str(zi),(x,-.237,z-h/2+zi*h/round(h)),(w,.008,.012),steel,col,0)
 return p

def image_led(name,images,cols,rows,offset=0,portrait=False):
 g=Graph(bpy,name,cols,rows,3.0 if portrait else 2.6)
 if portrait:
  burst=g.node('ShaderNodeValue','Short signal interruption · 9 / 192 frames');burst.outputs[0].driver_add('default_value').driver.expression='1 if 43 <= (frame-1)%192 < 46 or 120 <= (frame-1)%192 < 123 or 173 <= (frame-1)%192 < 176 else 0'
  gate=burst.outputs[0];band=g.mul(g.gt(g.v,.41),g.lt(g.v,.51));band2=g.mul(g.gt(g.v,.75),g.lt(g.v,.79));region=g.math('MAXIMUM',band,band2)
  row=g.sub(g.mul(g.hash(g.iy,g.math('FLOOR',g.mul(g.phase,96))),2),1)
  dx=g.mul(g.mul(g.mul(gate,region),row),3/cols)
  uv=g.node('ShaderNodeCombineXYZ','Coarse pixel coordinates with brief row displacement');g.input(uv.inputs[0],g.add(g.u,dx));g.input(uv.inputs[1],g.v)
  sources=[]
  for i,delta in enumerate([1/cols,0,-1/cols]):
   t=g.node('ShaderNodeTexImage',['Red channel','Green channel','Blue channel'][i]);t.image=images[0];t.interpolation='Closest';t.extension='CLIP'
   c=g.node('ShaderNodeCombineXYZ','Channel registration');g.input(c.inputs[0],g.add(g.add(g.u,dx),g.mul(g.mul(gate,region),delta)));g.input(c.inputs[1],g.v);g.links.new(c.outputs[0],t.inputs['Vector'])
   sep=g.node('ShaderNodeSeparateColor');sep.mode='RGB';g.links.new(t.outputs['Color'],sep.inputs[0]);sources.append(sep.outputs[i])
  comb=g.node('ShaderNodeCombineColor','RGB signal reconstruction');comb.mode='RGB'
  for i,ch in enumerate(sources):g.links.new(ch,comb.inputs[i])
  art=comb.outputs[0];gain=g.add(.95,g.mul(g.math('SINE',g.angle),.035));gain=g.mul(gain,g.sub(1,g.mul(g.mul(gate,region),.20)))
  art=g.tint(art,gain,'Stable image with restrained signal modulation')
 else:
  uv=g.node('ShaderNodeCombineXYZ','Pixel-center sample');g.input(uv.inputs[0],g.u);g.input(uv.inputs[1],g.v)
  samples=[]
  for im in images:
   t=g.node('ShaderNodeTexImage','Original commercial plate');t.image=im;t.interpolation='Closest';t.extension='CLIP';g.links.new(uv.outputs[0],t.inputs['Vector']);samples.append(t.outputs['Color'])
  # Three holds per loop, hard cuts with a one-frame stagger between tile rows.
  phase=g.mod(g.add(g.mul(g.phase,3),offset+.1),3);phase=g.add(phase,g.mul(g.mod(g.math('FLOOR',g.mul(g.v,8)),2),.012))
  art=g.color(g.gt(phase,1),samples[0],samples[1]);art=g.color(g.gt(phase,2),art,samples[2])
 return g.finish(art)

face_image=bpy.data.images.load(str(ASSETS/'kabuki-signal.png'),check_existing=True)
face=image_led('LED · KAO / kabuki transmission',[face_image],144,216,portrait=True)
subs=create_secondary_materials(bpy)
# Compensate secondary material exposure to preserve saturated channels.
for entry in subs.values():
 for n in entry['material'].node_tree.nodes:
  if n.bl_idname=='ShaderNodeEmission':n.inputs['Strength'].default_value*=.65
main=collection('01 | KAO — Japanese face',scene);cabinet('KAO',-2.7,5.1,5.6,8.4,face,main)
diamonds=collection('02 | TATE — sequential diamond facade',scene);cabinet('TATE',-7.35,5.25,2.65,9.28,subs['diamond']['material'],diamonds)
radar=collection('03 | EN — optical ring advertisement',scene);cabinet('EN',2.8,7.45,4.25,4.25,subs['radar']['material'],radar)
ads=collection('04 | DENSHI — stacked Japanese advertisements',scene)
for i,z in enumerate([4.45,2.95,1.45]):cabinet('DENSHI '+str(i+1),2.8,z,4.25,1.32,image_led('LED · DENSHI plate '+str(i+1),plates,192,60,i),ads)
strips=collection('05 | HIKARI — vertical emitters',scene);cabinet('HIKARI',6.8,5.2,2.75,8.95,subs['strips']['material'],strips)
box('Street pedestal',(0,2,-.4),(23,11,.4),floor,stage,.02)
for x,title in [(-8.68,'02  TATE'),(-5.5,'01  KAO'),(.68,'03  EN / 04  DENSHI'),(5.42,'05  HIKARI')]:text(title,title,x,.20,.16,labelmat,stage,y=-.30)
text('Collection heading','TOKYO SIGNALS',-8.68,10.58,.30,labelmat,stage,y=-.30)
text('Collection subheading','LED STUDIES / 8 SECOND LOOPS / 24 FPS',-8.66,10.16,.13,labelmat,stage,y=-.30)
cam=camera(scene,stage,(.8,-27.6,8.9),(0,0,5.2));cam.data.lens=42
for name,loc,color,power,size in [('Cyan reflected spill',(-3,-1.4,5),(.03,.55,1),320,7),('Magenta reflected spill',(4,-1.1,5),(.85,.015,.3),180,6),('Cool architectural rim',(-7,-4,12),(.35,.5,.65),480,8)]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color;d.shape='DISK';d.size=size;ob=bpy.data.objects.new(name,d);stage.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector((loc[0],0,1))-ob.location).to_track_quat('-Z','Y').to_euler()
# Very restrained optical glow after rendering: the source remains an emitter grid.
tree=bpy.data.node_groups.new('LED lens response | restrained glow','CompositorNodeTree');scene.compositing_node_group=tree;tree.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
r=tree.nodes.new('CompositorNodeRLayers');r.scene=scene;gl=tree.nodes.new('CompositorNodeGlare');gl.inputs['Type'].default_value='Fog Glow';gl.inputs['Quality'].default_value='Medium';gl.inputs['Threshold'].default_value=1.4
if 'Strength' in gl.inputs:gl.inputs['Strength'].default_value=.12
out=tree.nodes.new('NodeGroupOutput');tree.links.new(r.outputs['Image'],gl.inputs['Image']);tree.links.new(gl.outputs['Image'],out.inputs['Image'])
# Alternate detail camera makes emitter pitch inspectable.
detail=camera(scene,stage,(-2.7,-14,5.1),(-2.7,0,5.1),9.1);detail.name='CAM | Portrait detail';scene.camera=cam;cam.name='CAM | Collection overview'
scene.timeline_markers.new('LOOP START — stable portrait',frame=1);scene.timeline_markers.new('Short row tear',frame=44);scene.timeline_markers.new('Advertisement cut',frame=59);scene.timeline_markers.new('Channel misregistration',frame=121);scene.timeline_markers.new('Optical palette inversion',frame=166);scene.timeline_markers.new('Last frame — 193 repeats 1',frame=192)
scene.frame_set(1)
# Pack bitmap assets; convert caption curves so the file travels without fonts.
for ob in list(stage.objects):
 if ob.type=='FONT':bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.convert(target='MESH');ob.select_set(False)
for im in bpy.data.images:
 if im.source=='FILE':im.pack()
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.type='MATERIAL'
scene.render.filepath=str(OUT/'collection-001.png');bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'tokyo-signals.blend'))
bpy.ops.render.render(write_still=True,scene=scene.name)
scene.camera=detail;scene.render.resolution_x=800;scene.render.resolution_y=1100;scene.render.filepath=str(OUT/'portrait-detail.png');bpy.ops.render.render(write_still=True,scene=scene.name)
scene.camera=cam;scene.render.resolution_x=1600;scene.render.resolution_y=1000;scene.render.filepath=str(OUT/'collection-001.png');scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'tokyo-signals.blend'))
print('LED_LIBRARY_READY',str(ROOT/'tokyo-signals.blend'))
