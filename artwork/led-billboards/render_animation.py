import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parent
scene=bpy.data.scenes['TOKYO SIGNALS | LED animation library'];bpy.context.window.scene=scene
scene.render.engine='BLENDER_EEVEE'
if hasattr(scene.eevee,'taa_render_samples'):scene.eevee.taa_render_samples=64
scene.camera=bpy.data.objects['CAM | Collection overview'];scene.render.resolution_x=1152;scene.render.resolution_y=720;scene.cycles.samples=8;scene.cycles.use_denoising=False
frames=root/'previews/frames';frames.mkdir(exist_ok=True)
# Ensure the driver values at the loop seam match exactly.
def values(frame):
 scene.frame_set(frame);bpy.context.view_layer.update()
 return {m.name:[n.outputs[0].default_value for n in m.node_tree.nodes if n.bl_idname=='ShaderNodeValue'] for m in bpy.data.materials if m.use_nodes and m.node_tree.animation_data}
a,b=values(1),values(193);assert a==b,(a,b)
(root/'previews/loop-check.json').write_text(json.dumps({'seam_values_match':True,'animated_materials':len(a),'fps':24,'frames':192},indent=2))
import sys
args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
start,end=map(int,args) if args else (1,192)
for frame in range(start,end+1):
 scene.frame_set(frame);scene.render.filepath=str(frames/f'{frame:04d}.png');bpy.ops.render.render(write_still=True,scene=scene.name)
print('LOOP_RENDER_COMPLETE')
