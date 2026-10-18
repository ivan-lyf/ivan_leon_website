"""Reference-led humpback sculpt, metres, head +X. Run only in background Blender.
NOAA anatomy plate / breach photograph are referenced in README.md.
Editable source, body-space hologram material, morph loop, web GLB export.
"""
from pathlib import Path
import bpy, bmesh, math, json, random
from mathutils import Vector
if not bpy.app.background: raise RuntimeError('Use an isolated background Blender process.')
HERE=Path(__file__).resolve().parent; ROOT=HERE.parents[1]; OUT=ROOT/'shared/assets/models/city'
OUT.mkdir(parents=True,exist_ok=True)
scene=bpy.data.scenes.new('KUJIRA | Holographic humpback');bpy.context.window.scene=scene
scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
whale=bpy.data.collections.new('Whale | Editable anatomical surfaces');scene.collection.children.link(whale)
preview=bpy.data.collections.new('Preview | Not exported');scene.collection.children.link(preview)
objects=[]
def xyz(p):return (p[0],-p[2],p[1])
def mesh(name,v,f):
    me=bpy.data.meshes.new(name);me.from_pydata([xyz(p) for p in v],[],f);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(me);bm.free()
    ob=bpy.data.objects.new(name,me);whale.objects.link(ob);objects.append(ob)
    for p in me.polygons:p.use_smooth=True
    return ob
# Hand-measured profile traced from NOAA's silhouette. Belly is fuller than dorsal.
profile=[(-12.5,.18,.19,.12),(-11.2,.29,.34,.04),(-9,.49,.60,-.06),(-6,.91,1.18,-.12),(-3,1.48,1.73,-.10),(0,2.02,2.52,-.04),(3,2.28,2.71,0),(6,2.18,2.51,.12),(8.8,1.78,1.82,.28),(11.2,1.30,1.05,.35),(13.0,.86,.55,.38),(13.68,.56,.33,.37),(13.83,.015,.025,.37)]
def section(x):
    i=next((i for i in range(len(profile)-1) if profile[i+1][0]>=x),len(profile)-2)
    a=profile[i];b=profile[i+1];t=max(0,min(1,(x-a[0])/(b[0]-a[0])));out=[]
    for k in range(1,4):
        p=profile[max(0,i-1)];n=profile[min(len(profile)-1,i+2)]
        m0=(b[k]-p[k])/(b[0]-p[0])*(b[0]-a[0]);m1=(n[k]-a[k])/(n[0]-a[0])*(b[0]-a[0])
        out.append((2*t**3-3*t*t+1)*a[k]+(t**3-2*t*t+t)*m0+(-2*t**3+3*t*t)*b[k]+(t**3-t*t)*m1)
    return out

def skin(x,a,offset=0):
    w,h,c=section(x);s=math.sin(a);co=math.cos(a)
    # Slightly flattened head roof; deeper throat beneath the long lower jaw.
    up=h*s*(.70 if s>0 else 1.02)+c
    if x>7 and s>0:up=h*(s**.72)*.70+c
    # Restrained longitudinal ventral grooves are real displacement, not stripes.
    vent=max(0,-s)**4*max(0,min(1,(x+1)/4))*max(0,min(1,(13.5-x)/2))
    fold=.018*math.cos(a*27)*vent
    return (x,up+offset*s+fold*s,(w+offset+fold)*co)
N=124;M=72;v=[];f=[]
for j in range(N+1):
    x=-12.5+(13.83+12.5)*j/N
    for i in range(M):v.append(skin(x,2*math.pi*i/M))
for j in range(N):
    for i in range(M):f.append((j*M+i,j*M+(i+1)%M,(j+1)*M+(i+1)%M,(j+1)*M+i))
f += [tuple(range(M-1,-1,-1)),tuple(N*M+i for i in range(M))]
body=mesh('Whale | Continuous body',v,f)
# Hydrofoil sections: rounded leading edges, tapered trailing edges and smooth tips.
def foil(name,sections,segments=28):
    v=[];f=[]
    for c,w,thick in sections:
        for j in range(segments):
            a=2*math.pi*j/segments
            v.append((c[0]+w*math.cos(a),c[1]+thick*math.sin(a),c[2]))
    for k in range(len(sections)-1):
        for j in range(segments):f.append((k*segments+j,k*segments+(j+1)%segments,(k+1)*segments+(j+1)%segments,(k+1)*segments+j))
    f += [tuple(range(segments-1,-1,-1)),tuple((len(sections)-1)*segments+i for i in range(segments))]
    return mesh(name,v,f)
for side in [-1,1]:
    # A humpback's long, back-swept pectorals attach behind the jaw.
    ss=[]
    for i in range(49):
        t=i/48;c=(5.05-5.5*t-.4*math.sin(t*math.pi),-.45-3.1*t+.55*math.sin(t*math.pi),side*(1.65+6.0*t))
        w=(.87*(1-t)**.42+.15*math.sin(t*math.pi))*(1 if t<.97 else max(.015,(1-t)/.03))
        w+=.045*math.sin(t*math.pi*16)*math.sin(t*math.pi)
        ss.append((c,max(.008,w),max(.015,.18*(1-t)**.6)))
    foil('Whale | Pectoral '+('port' if side<0 else 'starboard'),ss)
# Tail flukes, generous crescent wings with a central notch, horizontal not fish-like.
for side in [-1,1]:
    ss=[]
    for i in range(45):
        t=i/44
        cx=-12.55-2.35*t+.50*math.sin(t*math.pi)
        half=.75+1.0*math.sin(t*math.pi)-.70*t
        half*=min(1,max(.015,(1-t)/.13))
        ss.append(((cx,.12+.45*math.sin(t*math.pi)-.32*t,side*(.05+5.0*t)),max(.008,half),max(.014,.20*(1-t))))
    foil('Whale | Fluke '+('port' if side<0 else 'starboard'),ss,32)
# Small swept dorsal fin on the rear third, rather than a dolphin's tall triangle.
v=[];f=[];dorsal=[(-6.5,.38),(-5.6,.77),(-4.8,1.17),(-4.25,2.16),(-4.00,2.25),(-4.12,1.65),(-3.72,.93),(-2.8,.60)]
for side in [-1,1]:
    for x,y in dorsal:v.append((x,y,side*.16))
n=len(dorsal);f=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
dorsal_ob=mesh('Whale | Low hooked dorsal',v,f)
bev=dorsal_ob.modifiers.new('Soft fin edges','BEVEL');bev.width=.15;bev.segments=3
bpy.context.view_layer.objects.active=dorsal_ob;dorsal_ob.select_set(True);bpy.ops.object.modifier_apply(modifier=bev.name);dorsal_ob.select_set(False)
# Curves are retained as true small mesh relief, batched into one detail mesh.
def tube(name,points,r):
    cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.bevel_depth=r;cu.bevel_resolution=1
    sp=cu.splines.new('POLY');sp.points.add(len(points)-1)
    for p,q in zip(sp.points,points):p.co=(*xyz(q),1)
    ob=bpy.data.objects.new(name,cu);whale.objects.link(ob);bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.object.convert(target='MESH');objects.append(ob);return ob
features=[]
for side in [-1,1]:
    points=[]
    for i in range(64):
        x=5.7+7.9*i/63;w,h,c=section(x);points.append((x,c-h*.15,side*w*.997))
    features.append(tube('Whale | Mouth seam',points,.032))
for k in range(15):
    angle=math.pi+(k+1)/16*math.pi;points=[]
    for i in range(50):
        x=.3+12.7*i/49;a=angle+(math.pi*1.5-angle)*((x/13.4)**3)*.36;points.append(skin(x,a,.024))
    features.append(tube('Whale | Throat pleat',points,.018))
# Sparse small rostral tubercles (distinctive anatomy, not uniform studding).
for side in [-1,1]:
    for i in range(9):
        x=7.3+i*.68;w,h,c=section(x);a=.54 if side>0 else math.pi-.54;p=skin(x,a,.02)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10,ring_count=6,radius=.075+(.016 if i%3==0 else 0),location=xyz(p));ob=bpy.context.object
        for col in list(ob.users_collection):col.objects.unlink(ob)
        whale.objects.link(ob);objects.append(ob);features.append(ob)
# Tiny eyes remain a quiet anatomical landmark.
eyes=[]
for side in [-1,1]:
    x=9.15;w,h,c=section(x)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,radius=.115,location=xyz((x,.15,side*w*.99)));ob=bpy.context.object;ob.name='Whale | Eye'
    for col in list(ob.users_collection):col.objects.unlink(ob)
    whale.objects.link(ob);objects.append(ob);eyes.append(ob)

def join(obs,name):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in obs:ob.select_set(True)
    bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();o=bpy.context.object;o.name=name
    for ob in obs[1:]:objects.remove(ob)
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    return o
features=join(features,'Whale | Ventral pleats and rostral detail');eyes=join(eyes,'Whale | Eyes')
# Every object uses common-origin coordinates for coherent runtime deformation.
for ob in objects:
    bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)

def hologram(name,strength=1):
    m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes;l=m.node_tree.links;n.clear()
    out=n.new('ShaderNodeOutputMaterial');mix=n.new('ShaderNodeMixShader');tr=n.new('ShaderNodeBsdfTransparent');em=n.new('ShaderNodeEmission')
    em.inputs['Color'].default_value=(.035,.56,1,1);em.inputs['Strength'].default_value=2.1*strength
    tex=n.new('ShaderNodeTexCoord');sep=n.new('ShaderNodeSeparateXYZ');l.new(tex.outputs['Object'],sep.inputs[0])
    mul=n.new('ShaderNodeMath');mul.operation='MULTIPLY';mul.inputs[1].default_value=45;l.new(sep.outputs['Z'],mul.inputs[0])
    sine=n.new('ShaderNodeMath');sine.operation='SINE';l.new(mul.outputs[0],sine.inputs[0]);gt=n.new('ShaderNodeMath');gt.operation='GREATER_THAN';gt.inputs[1].default_value=.30;l.new(sine.outputs[0],gt.inputs[0])
    layer=n.new('ShaderNodeLayerWeight');rim=n.new('ShaderNodeMath');rim.operation='POWER';rim.inputs[1].default_value=2;l.new(layer.outputs['Fresnel'],rim.inputs[0])
    gain=n.new('ShaderNodeMath');gain.operation='MULTIPLY_ADD';gain.inputs[1].default_value=.085;gain.inputs[2].default_value=.016;l.new(gt.outputs[0],gain.inputs[0])
    add=n.new('ShaderNodeMath');add.operation='MULTIPLY_ADD';add.inputs[1].default_value=.28;l.new(rim.outputs[0],add.inputs[0]);l.new(gain.outputs[0],add.inputs[2]);l.new(add.outputs[0],mix.inputs[0])
    ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(.09,.12,.38,1);ramp.color_ramp.elements[1].color=(.025,.57,1,1);l.new(layer.outputs['Facing'],ramp.inputs[0]);l.new(ramp.outputs['Color'],em.inputs['Color'])
    l.new(tr.outputs[0],mix.inputs[1]);l.new(em.outputs[0],mix.inputs[2]);l.new(mix.outputs[0],out.inputs['Surface'])
    m.surface_render_method='DITHERED';m.diffuse_color=(.04,.55,.95,.25);return m
holo=hologram('Projection | Body-space cyan scan strata');detail=hologram('Projection | Anatomical relief',.7)
# Transparent glTF fallback; runtime replaces with animated projection shader.
fallback=bpy.data.materials.new('Hologram | glTF fallback');fallback.use_nodes=True;p=fallback.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.04,.40,.65,1);p.inputs['Metallic'].default_value=.1;p.inputs['Roughness'].default_value=.36;p.inputs['Alpha'].default_value=.28;p.inputs['Emission Color'].default_value=(.03,.5,1,1);p.inputs['Emission Strength'].default_value=1.6;fallback.surface_render_method='DITHERED'
for ob in objects:ob.data.materials.append(fallback)
bpy.ops.object.select_all(action='DESELECT')
for ob in objects:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'holographic-whale.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_animations=False,export_morph=False,export_yup=True)
# Source contains a corresponding editable 12-second tail/flipper swim loop.
for ob in objects:
    ob.data.materials[0]=detail if ob in [features,eyes] else holo
    ob.shape_key_add(name='Basis');key=ob.shape_key_add(name='Vertical tail stroke');key.slider_min=-1
    for p in key.data:
        x=p.co.x;back=max(0,min(1,(-x+1)/13))**1.8;p.co.z+=math.sin(x*.20)*back*1.5
    for frame,val in [(1,0),(73,1),(145,0),(217,-1),(289,0)]:key.value=val;key.keyframe_insert('value',frame=frame)
    if 'Pectoral' in ob.name:
        key=ob.shape_key_add(name='Pectoral suspension');key.slider_min=-1
        for p in key.data:p.co.z+=(max(0,abs(p.co.y)-1.6)/6)**1.2*.75
        for frame,val in [(1,.1),(73,-.45),(145,.1),(217,.65),(289,.1)]:key.value=val;key.keyframe_insert('value',frame=frame)
# Recessed internal particles carry depth without turning the whale solid.
random.seed(713);pv=[];pf=[]
for i in range(280):
    x=random.uniform(-10.8,12);w,h,c=section(x);a=random.random()*math.tau;r=math.sqrt(random.random())*.72
    center=Vector(xyz((x,c+math.sin(a)*h*r,math.cos(a)*w*r)));size=random.uniform(.014,.042);base=len(pv)
    pv += [center+Vector((size,0,0)),center+Vector((-size,0,0)),center+Vector((0,size,0)),center+Vector((0,0,size))]
    pf += [(base,base+2,base+3),(base+1,base+3,base+2),(base,base+3,base+1),(base,base+1,base+2)]
me=bpy.data.meshes.new('Inner light specks');me.from_pydata(pv,[],pf);me.update();ob=bpy.data.objects.new('Projection | Inner suspended specks',me);preview.objects.link(ob);ob.data.materials.append(detail)
world=bpy.data.worlds.new('Midnight projection studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.004,.009,.018,1);world.node_tree.nodes['Background'].inputs[1].default_value=.2;scene.world=world
camdata=bpy.data.cameras.new('Anatomy / projection camera');cam=bpy.data.objects.new('Camera | Broadside three-quarter',camdata);preview.objects.link(cam);cam.location=xyz((22,19,36));target=Vector(xyz((0,-.2,0)));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=37;scene.camera=cam
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1600;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.fps=24;scene.frame_start=1;scene.frame_end=288;scene.frame_set(1);scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=-.6
scene.use_nodes=True
try:
    tree=bpy.data.node_groups.new('Projection | Restrained optical bloom','CompositorNodeTree');scene.compositing_node_group=tree
    tree.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
    n=tree.nodes;l=tree.links;rl=n.new('CompositorNodeRLayers');gl=n.new('CompositorNodeGlare');gl.inputs['Type'].default_value='Fog Glow';gl.inputs['Quality'].default_value='High';gl.inputs['Threshold'].default_value=1.7;gl.inputs['Strength'].default_value=.10;out=n.new('NodeGroupOutput');l.new(rl.outputs['Image'],gl.inputs['Image']);l.new(gl.outputs['Image'],out.inputs['Image'])
except Exception as e:print('COMPOSITOR',e)
scene['Reference']='NOAA Fisheries humpback whale anatomy plate and breaching photograph; see README.md'
scene['Runtime specification']='Body-space scan lines, gentle vertical tail stroke and independent pectoral suspension. Shader replaces glTF fallback.'
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'holographic-whale.blend'))
scene.render.filepath=str(HERE/'whale-projection.png');bpy.ops.render.render(write_still=True)
# Save a solid clay anatomical review, leaving the saved project holographic.
clay=bpy.data.materials.new('Review only | Matte grey');clay.diffuse_color=(.16,.22,.26,1);clay.use_nodes=True;p=clay.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.16,.22,.26,1);p.inputs['Roughness'].default_value=.48
for ob in objects:ob.data.materials[0]=clay
for loc,energy,col,size in [((0,12,15),3500,(.55,.8,1),18),((-14,6,-8),2400,(.36,.18,1),12),((13,1,7),2000,(.7,.9,1),10)]:
    ld=bpy.data.lights.new('Review softbox','AREA');ld.energy=energy;ld.color=col;ld.shape='DISK';ld.size=size;lo=bpy.data.objects.new('Review softbox',ld);preview.objects.link(lo);lo.location=xyz(loc);lo.rotation_euler=(-lo.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(HERE/'whale-anatomy.png');bpy.ops.render.render(write_still=True)
tri=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects);meta={'lengthMetres':29.2,'anatomicalMeshes':len(objects),'estimatedTriangles':tri,'headAxis':'+X','upAxis':'glTF +Y / Blender +Z','source':'NOAA Fisheries humpback whale plate, recreating silhouette and anatomy','webAnimation':'shared/penthouse-whale.js','nativeAnimationFrames':288,'frameRate':24}
(HERE/'model-metadata.json').write_text(json.dumps(meta,indent=2));print('WHALE_COMPLETE',json.dumps(meta))
