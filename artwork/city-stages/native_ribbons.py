"""Import the exact shared runtime ribbon meshes and attach native LED shading."""
import bpy, math, json
from mathutils import Matrix, Vector

def install(scene,collection,path,steel):
 data=json.loads(path.read_text());C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
 def xyz(p):return (p[0],-p[2],p[1])
 for ring in data:
  dims=ring['dimensions'];tint=ring['colorLinear'];materials=[]
  for gain in [1,.24]:
   m=bpy.data.materials.new(ring['name']+(' | outward emitter' if gain==1 else ' | inward emitter'));m.use_nodes=True;nt=m.node_tree;nt.nodes.clear()
   def op(operation,a,b=None):
    n=nt.nodes.new('ShaderNodeMath');n.operation=operation
    for idx,v in enumerate([a,b]):
     if v is None:continue
     if isinstance(v,(int,float)):n.inputs[idx].default_value=v
     else:nt.links.new(v,n.inputs[idx])
    return n.outputs[0]
   uv=nt.nodes.new('ShaderNodeTexCoord');sep=nt.nodes.new('ShaderNodeSeparateXYZ');nt.links.new(uv.outputs['UV'],sep.inputs[0]);u,v=sep.outputs[0],sep.outputs[1]
   x=op('FRACT',op('DIVIDE',u,dims['emitterPitch']));y=op('FRACT',op('MULTIPLY',v,dims['faceHeight']/dims['emitterPitch']))
   mask=op('MULTIPLY',op('MULTIPLY',op('GREATER_THAN',x,.18),op('LESS_THAN',x,.82)),op('MULTIPLY',op('GREATER_THAN',y,.18),op('LESS_THAN',y,.82)))
   lightpath=nt.nodes.new('ShaderNodeLightPath');lod=nt.nodes.new('ShaderNodeMapRange');nt.links.new(lightpath.outputs['Ray Length'],lod.inputs['Value']);lod.clamp=True;lod.inputs['From Min'].default_value=10;lod.inputs['From Max'].default_value=32;lod.inputs['To Min'].default_value=0;lod.inputs['To Max'].default_value=1
   blend=op('ADD',op('MULTIPLY',mask,op('SUBTRACT',1,lod.outputs['Result'])),op('MULTIPLY',.4096,lod.outputs['Result']))
   phase=nt.nodes.new('ShaderNodeValue');phase.name='Slow 44 second content chaser';phase.outputs[0].driver_add('default_value').driver.expression='(frame-1)/1056.0'
   chaser=op('FRACT',op('SUBTRACT',op('DIVIDE',u,dims['moduleLength']*dims['moduleCount']),phase.outputs[0]));chaser=op('MULTIPLY',op('GREATER_THAN',chaser,.28),op('LESS_THAN',chaser,.39));strength=op('MULTIPLY',op('DIVIDE',blend,.4096),op('ADD',.89,op('MULTIPLY',chaser,.155)));strength=op('MULTIPLY',strength,4.2*gain)
   e=nt.nodes.new('ShaderNodeEmission');e.inputs['Color'].default_value=(*tint,1);nt.links.new(strength,e.inputs['Strength']);o=nt.nodes.new('ShaderNodeOutputMaterial');nt.links.new(e.outputs[0],o.inputs['Surface']);materials.append(m)
  for i,mesh in enumerate(ring['meshes']):
   p=mesh['positions'];indices=mesh['indices'];me=bpy.data.meshes.new(mesh['name']);me.from_pydata([xyz(p[k:k+3]) for k in range(0,len(p),3)],[],[indices[k:k+3] for k in range(0,len(indices),3)]);me.update()
   if mesh['uv']:
    uv=me.uv_layers.new(name='Arc-length metres')
    for loop in me.loops:uv.data[loop.index].uv=mesh['uv'][loop.vertex_index*2:loop.vertex_index*2+2]
   if mesh['faceGain']:
    for m in materials:me.materials.append(m)
    for face in me.polygons:face.material_index=0 if mesh['faceGain'][face.vertices[0]]>.5 else 1
   else:me.materials.append(steel)
   for ix,arr in enumerate(mesh['instances']):
    ob=bpy.data.objects.new(ring['name']+' | '+mesh['name']+' '+str(ix),me);collection.objects.link(ob);M=Matrix([arr[k::4] for k in range(4)]);ob.matrix_world=C@M@C.inverted();ob.location+=Vector(xyz(ring['center']));ob['module_count']=dims['moduleCount'];ob['emitter_pitch_metres']=dims['emitterPitch'];ob['runtime_matching_geometry']=True
 return data
