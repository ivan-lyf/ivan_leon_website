"""Original, editable 1990s LED graphic materials for Blender 5.x.

All artwork is built from ordinary shader nodes. UV input is quantized to an
outdoor-panel pixel pitch before any drawing, then masked by individual LED
emitters. No OSL, external texture, frame handler, or driver namespace is needed.

Call create_secondary_materials(bpy). Its result is keyed diamond/radar/strips;
each entry contains material, size_m, pixels and description. Frames 1..192 are
the 24 fps loop; frame 193 deliberately matches frame 1 exactly.
"""
from math import pi

LOOP_FRAMES = 192


class Graph:
    def __init__(self, bpy, name, cols, rows, strength=5.0):
        self.material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        self.material.use_nodes = True
        self.material.diffuse_color = (0.008, 0.012, 0.021, 1)
        self.material['loop_frames'] = LOOP_FRAMES
        self.material['fps'] = 24
        self.material['pixel_columns'] = cols
        self.material['pixel_rows'] = rows
        self.material['artwork_type'] = 'Original procedural retro LED graphic'
        self.nodes = self.material.node_tree.nodes
        self.links = self.material.node_tree.links
        self.nodes.clear()
        self.n = 0
        tc = self.node('ShaderNodeTexCoord', 'Panel UV')
        separate = self.node('ShaderNodeSeparateXYZ', 'Panel coordinates')
        self.links.new(tc.outputs['UV'], separate.inputs[0])
        sx = self.mul(separate.outputs['X'], cols)
        sy = self.mul(separate.outputs['Y'], rows)
        self.ix = self.math('FLOOR', sx, label='LED column')
        self.iy = self.math('FLOOR', sy, label='LED row')
        self.u = self.div(self.add(self.ix, .5), cols)
        self.v = self.div(self.add(self.iy, .5), rows)
        fx = self.math('ABSOLUTE', self.sub(self.fract(sx), .5))
        fy = self.math('ABSOLUTE', self.sub(self.fract(sy), .5))
        # Slightly clipped rectangular packages, with visible black substrate.
        self.emitters = self.mul(self.lt(self.math('MAXIMUM', fx, fy), .395),
                                 self.lt(self.add(fx, fy), .69))
        self.random = self.hash(self.ix, self.iy)
        self.gain = self.add(.72, self.mul(self.random, .28))
        phase = self.node('ShaderNodeValue', 'Loop phase · 8 seconds')
        driver = phase.outputs[0].driver_add('default_value').driver
        driver.expression = '((frame - 1) % 192) / 192.0'
        self.phase = phase.outputs[0]
        self.angle = self.mul(self.phase, 2*pi)
        self.strength = strength

    def node(self, kind, label=''):
        n = self.nodes.new(kind)
        self.n += 1
        n.label = label
        n.location = ((self.n % 13) * 190, -(self.n // 13) * 170)
        return n

    def input(self, socket, val):
        if hasattr(val, 'is_output'):
            self.links.new(val, socket)
        else:
            socket.default_value = val

    def math(self, op, a, b=None, label=''):
        n = self.node('ShaderNodeMath', label or op.replace('_', ' ').title())
        n.operation = op
        self.input(n.inputs[0], a)
        if b is not None:
            self.input(n.inputs[1], b)
        return n.outputs[0]

    def add(self, a, b): return self.math('ADD', a, b)
    def sub(self, a, b): return self.math('SUBTRACT', a, b)
    def mul(self, a, b): return self.math('MULTIPLY', a, b)
    def div(self, a, b): return self.math('DIVIDE', a, b)
    def lt(self, a, b): return self.math('LESS_THAN', a, b)
    def gt(self, a, b): return self.math('GREATER_THAN', a, b)
    def fract(self, a): return self.math('FRACT', a)
    def mod(self, a, b): return self.math('MODULO', a, b)
    def absolute(self, a): return self.math('ABSOLUTE', a)

    def hash(self, x, y):
        return self.fract(self.mul(self.math('SINE', self.add(self.mul(x, 12.9898), self.mul(y, 78.233))), 43758.5453))

    def color(self, factor, a, b, label='Palette selection'):
        n = self.node('ShaderNodeMixRGB', label)
        n.blend_type = 'MIX'
        self.input(n.inputs[0], factor)
        self.input(n.inputs[1], (*a, 1) if isinstance(a, tuple) and len(a) == 3 else a)
        self.input(n.inputs[2], (*b, 1) if isinstance(b, tuple) and len(b) == 3 else b)
        return n.outputs[0]

    def tint(self, color, factor, label='LED intensity'):
        n = self.node('ShaderNodeMixRGB', label)
        n.blend_type = 'MULTIPLY'
        n.inputs[0].default_value = 1
        self.input(n.inputs[1], color)
        self.input(n.inputs[2], factor)
        return n.outputs[0]

    def combine(self, a, b):
        n = self.node('ShaderNodeMixRGB', 'Add graphic layers')
        n.blend_type = 'ADD'
        n.inputs[0].default_value = 1
        self.input(n.inputs[1], a)
        self.input(n.inputs[2], b)
        return n.outputs[0]

    def finish(self, artwork):
        lit = self.tint(artwork, self.mul(self.emitters, self.gain), 'Emitter grid and package gain')
        col = self.color(self.emitters, (0.00045, .0007, .0012), lit, 'Black panel substrate')
        shader = self.node('ShaderNodeEmission', 'Outdoor LED emission')
        self.input(shader.inputs['Color'], col)
        shader.inputs['Strength'].default_value = self.strength
        out = self.node('ShaderNodeOutputMaterial', 'LED surface')
        self.links.new(shader.outputs[0], out.inputs['Surface'])
        self.nodes.active = out
        return self.material


def diamond_material(bpy):
    g = Graph(bpy, 'LED · TATE / sequential diamond facade', 120, 420, 4.8)
    x = g.fract(g.mul(g.u, 2))
    y = g.fract(g.mul(g.v, 7))
    radius = g.add(g.absolute(g.sub(x, .5)), g.absolute(g.sub(y, .5)))
    outline = g.mul(g.lt(radius, .478), g.gt(radius, .435))
    # Deliberately broken segments follow the diagonal, rather than noisy pixels.
    segment = g.math('FLOOR', g.mul(g.add(g.mul(x, 2), y), 7))
    broken = g.gt(g.mod(segment, 5), .5)
    row = g.math('FLOOR', g.mul(g.v, 7))
    side = g.gt(x, .5)
    seq = g.math('SINE', g.sub(g.sub(g.angle, g.mul(row, .72)), g.mul(side, .9)))
    seq = g.div(g.math('FLOOR', g.mul(g.add(1, seq), 3)), 6)
    brightness = g.add(.13, g.mul(seq, .87))
    outline = g.mul(g.mul(outline, broken), brightness)
    alternate = g.mod(g.add(row, g.math('FLOOR', g.mul(g.u, 2))), 2)
    palette = g.color(alternate, (.82, .008, .37), (.23, .012, .81), 'Magenta / ultraviolet glass tubes')
    art = g.tint(palette, outline)
    return g.finish(art)


def radar_material(bpy):
    g = Graph(bpy, 'LED · EN / optical circulation', 168, 168, 4.2)
    x, y = g.mul(g.sub(g.u, .5), 2), g.mul(g.sub(g.v, .5), 2)
    radius = g.math('SQRT', g.add(g.mul(x, x), g.mul(y, y)))
    theta = g.add(g.div(g.math('ARCTAN2', y, x), 2*pi), .5)
    invert = g.mul(g.gt(g.phase, .859375), g.lt(g.phase, .88020833))
    # Each ring returns to its starting orientation after precisely eight seconds.
    layers = []
    cyan, violet, pink, white = (.015, .69, .86), (.28, .025, .77), (.86, .025, .39), (.58, .75, .81)
    settings = [(.14, .024, 1, cyan, pink, .82),
                (.29, .014, -1, white, violet, .67),
                (.43, .031, 2, violet, white, .82),
                (.60, .019, -2, pink, cyan, .71),
                (.77, .026, 1, cyan, pink, .84),
                (.91, .013, -1, violet, white, .91)]
    for i, (r, thick, speed, base, inverse, length) in enumerate(settings):
        ring = g.lt(g.absolute(g.sub(radius, r)), thick)
        arc = g.fract(g.add(g.add(theta, g.mul(g.phase, speed)), i*.151))
        segments = g.lt(arc, length)
        # One deliberately detached segment provides the old optical-ad cadence.
        segments = g.mul(segments, g.gt(g.absolute(g.sub(arc, .43)), .026))
        pulse = g.add(.79, g.mul(g.math('SINE', g.add(g.angle, i*.8)), .18))
        pulse = g.div(g.math('FLOOR', g.mul(pulse, 8)), 8)
        palette = g.color(invert, base, inverse, 'Brief frame-held palette inversion')
        layers.append(g.tint(palette, g.mul(g.mul(ring, segments), pulse)))
    art = layers[0]
    for layer in layers[1:]:
        art = g.combine(art, layer)
    return g.finish(art)


def strips_material(bpy):
    g = Graph(bpy, 'LED · SUI / dense facade strips', 144, 432, 3.8)
    major = g.lt(g.mod(g.ix, 12), 1)
    secondary = g.mul(g.lt(g.mod(g.ix, 6), 1), g.lt(g.mod(g.iy, 5), 1))
    # Small black breaks make the strips visibly assembled from LED modules.
    module = g.gt(g.mod(g.iy, 48), 1)
    pattern = g.mul(g.add(g.mul(major, .78), g.mul(secondary, .2)), module)
    column = g.math('FLOOR', g.div(g.ix, 6))
    clock = g.math('FLOOR', g.mul(g.phase, 32))
    flicker_hash = g.hash(column, clock)
    dropout = g.gt(flicker_hash, .968)
    flicker = g.sub(1, g.mul(dropout, .72))
    # Long inactive intervals occur at different heights, avoiding perfect bars.
    coarse_row = g.math('FLOOR', g.div(g.iy, 24))
    occupancy = g.hash(column, coarse_row)
    pattern = g.mul(pattern, g.add(.17, g.mul(g.gt(occupancy, .17), .83)))
    palette = g.color(g.gt(g.random, .73), (.018, .53, .76), (.52, .73, .78), 'Cyan packages and older white LEDs')
    return g.finish(g.tint(palette, g.mul(pattern, flicker)))


def create_secondary_materials(bpy):
    """Build or replace three reusable materials; no objects or scene changes."""
    return {
        'diamond': {
            'material': diamond_material(bpy), 'size_m': (3.2, 11.2), 'pixels': (120, 420),
            'description': 'Broken magenta and ultraviolet diamonds with sequential stepped light waves.'},
        'radar': {
            'material': radar_material(bpy), 'size_m': (4.8, 4.8), 'pixels': (168, 168),
            'description': 'Six counter-rotating optical rings with sparse cuts and a short palette inversion.'},
        'strips': {
            'material': strips_material(bpy), 'size_m': (4.0, 12.0), 'pixels': (144, 432),
            'description': 'Dense modular cyan-white strips and dotted grids with asynchronous electronic dropout.'},
    }
