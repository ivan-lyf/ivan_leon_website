#!/usr/bin/env python3
"""Replace CHAIR_* scene roots without re-exporting the rest of a GLB.

Usage:
    python3 artwork/penthouse/merge_chair_glb.py BASE.glb CHAIR.glb OUTPUT.glb
    # Optional: --report merge-report.json

The incoming GLB must contain only CHAIR_* nodes, one scene and one embedded
buffer, without skins, animation, cameras or geometry/node extensions. Material
names matching the base reuse its exact materials (including baked AO/textures).
New named materials may be appended only when untextured. Incoming images,
textures and samplers are never copied. Original resources remain at their
original indexes; old chair resources become disconnected. The base BIN chunk,
including its padding, remains an identical prefix of the output BIN chunk.

All verification happens before writing. Output must differ from both inputs.
No third-party packages are required.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import struct
import tempfile

JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942
CHAIR_PREFIX = 'CHAIR_'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False,
                      separators=(',', ':'), allow_nan=False).encode('utf-8')


def index(value, items, label):
    if type(value) is not int or not 0 <= value < len(items):
        raise ValueError(f'Invalid {label} index: {value!r}')
    return value


def read_glb(path):
    raw = Path(path).read_bytes()
    if len(raw) < 20:
        raise ValueError(f'{path}: incomplete GLB')
    magic, version, size = struct.unpack_from('<4sII', raw)
    if magic != b'glTF' or version != 2 or size != len(raw):
        raise ValueError(f'{path}: expected a complete GLB 2.0 file')
    chunks, offset = [], 12
    while offset < len(raw):
        if offset + 8 > len(raw):
            raise ValueError(f'{path}: incomplete chunk header')
        length, kind = struct.unpack_from('<II', raw, offset)
        offset += 8
        if length % 4 or offset + length > len(raw):
            raise ValueError(f'{path}: invalid chunk length')
        chunks.append((kind, raw[offset:offset + length]))
        offset += length
    if [kind for kind, _ in chunks] != [JSON_CHUNK, BIN_CHUNK]:
        raise ValueError(f'{path}: expected exactly one JSON and one BIN chunk')
    document = json.loads(chunks[0][1])
    validate_buffer(document, chunks[1][1])
    return document, chunks[1][1], sha(raw)


def validate_buffer(document, binary):
    buffers = document.get('buffers', [])
    if len(buffers) != 1 or 'uri' in buffers[0]:
        raise ValueError('Expected exactly one embedded binary buffer')
    size = buffers[0].get('byteLength')
    if type(size) is not int or size < 0 or not size <= len(binary) <= size + 3:
        raise ValueError('Invalid embedded buffer byteLength')
    for view in document.get('bufferViews', []):
        start, length = view.get('byteOffset', 0), view.get('byteLength')
        if view.get('buffer') != 0 or type(start) is not int or type(length) is not int:
            raise ValueError('Invalid embedded bufferView')
        if start < 0 or length < 0 or start + length > size:
            raise ValueError('bufferView lies outside the declared binary buffer')


def encode_glb(document, binary):
    encoded = canonical(document)
    encoded += b' ' * (-len(encoded) % 4)
    padded = binary + b'\0' * (-len(binary) % 4)
    length = 12 + 8 + len(encoded) + 8 + len(padded)
    return (struct.pack('<4sII', b'glTF', 2, length)
            + struct.pack('<II', len(encoded), JSON_CHUNK) + encoded
            + struct.pack('<II', len(padded), BIN_CHUNK) + padded)


def texture_infos(value):
    if isinstance(value, dict):
        for name, child in value.items():
            if name.endswith('Texture') and isinstance(child, dict) and 'index' in child:
                yield child
            yield from texture_infos(child)
    elif isinstance(value, list):
        for child in value:
            yield from texture_infos(child)


def reject_extensions(value, label):
    if value.get('extensions'):
        raise ValueError(f'{label} extensions are not supported by this exact merge')


def active_roots(document):
    scenes = document.get('scenes', [])
    scene_id = index(document.get('scene', 0), scenes, 'scene')
    roots = scenes[scene_id].get('nodes', [])
    for root in roots:
        index(root, document.get('nodes', []), 'scene node')
    return roots


def merge_documents(base, base_binary, chair, chair_binary):
    """Return a verified merged document, binary payload and validation report."""
    validate_buffer(base, base_binary)
    validate_buffer(chair, chair_binary)
    chair_nodes, base_nodes = chair.get('nodes', []), base.get('nodes', [])
    if not chair_nodes or len(chair.get('scenes', [])) != 1:
        raise ValueError('Incoming chair must contain nodes and exactly one scene')
    for key in ('skins', 'animations', 'cameras'):
        if chair.get(key):
            raise ValueError(f'Incoming {key} are not supported')
    if 'KHR_mesh_quantization' in chair.get('extensionsUsed', []) + chair.get('extensionsRequired', []):
        raise ValueError('Incoming quantized geometry is not supported by this exact merge')
    reject_extensions(chair, 'Incoming document')
    reject_extensions(chair['scenes'][0], 'Incoming scene')
    incoming_roots = active_roots(chair)
    if not incoming_roots:
        raise ValueError('Incoming chair scene is empty')
    for node in chair_nodes:
        if not node.get('name', '').startswith(CHAIR_PREFIX):
            raise ValueError('Every incoming node name must start with CHAIR_')
        if 'skin' in node or 'camera' in node:
            raise ValueError('Incoming nodes must not reference skins or cameras')
        reject_extensions(node, 'Incoming node')
        for child in node.get('children', []):
            index(child, chair_nodes, 'child node')
    # Reject cycles, multiple parents and unreachable objects rather than importing
    # a subtly different transform hierarchy or stray geometry.
    seen, visiting = set(), set()
    def visit(node_id):
        if node_id in visiting or node_id in seen:
            raise ValueError('Incoming chair hierarchy has a cycle or multiple parents')
        visiting.add(node_id)
        for child in chair_nodes[node_id].get('children', []):
            visit(child)
        visiting.remove(node_id)
        seen.add(node_id)
    for root in incoming_roots:
        visit(root)
    if len(seen) != len(chair_nodes):
        raise ValueError('Incoming chair contains disconnected nodes')

    old_chair = {i for i, node in enumerate(base_nodes)
                 if node.get('name', '').startswith(CHAIR_PREFIX)}
    if not old_chair:
        raise ValueError('Base has no CHAIR_* nodes')
    for i, node in enumerate(base_nodes):
        children = node.get('children', [])
        if i not in old_chair and any(child in old_chair for child in children):
            raise ValueError('Replacing a nested chair would modify a non-chair parent')
        if i in old_chair and any(child not in old_chair for child in children):
            raise ValueError('A base chair node contains non-chair children')
    active_old_chair = set()
    pending = [root for scene in base.get('scenes', [])
               for root in scene.get('nodes', []) if root in old_chair]
    while pending:
        node_id = pending.pop()
        if node_id in active_old_chair:
            continue
        active_old_chair.add(node_id)
        pending.extend(base_nodes[node_id].get('children', []))
    if not active_old_chair:
        raise ValueError('Base chair nodes are not scene roots')

    result = copy.deepcopy(base)
    binary = bytearray(base_binary)  # Includes original padding, preserved byte for byte.
    base_materials = base.get('materials', [])
    incoming_materials = chair.get('materials', [])
    material_map, new_materials = {}, []
    base_names = {}
    for i, material in enumerate(base_materials):
        if material.get('name'):
            base_names.setdefault(material['name'], []).append(i)

    def map_material(material_id):
        index(material_id, incoming_materials, 'material')
        if material_id in material_map:
            return material_map[material_id]
        material = incoming_materials[material_id]
        name = material.get('name')
        if not name:
            raise ValueError('Every incoming material must have an explicit name')
        matches = base_names.get(name, [])
        if len(matches) > 1:
            raise ValueError(f'Ambiguous base material name: {name}')
        if matches:
            mapped = matches[0]
        else:
            if list(texture_infos(material)):
                raise ValueError(f'Unknown textured material cannot be appended: {name}')
            for previous in new_materials:
                if previous['name'] == name and previous != material:
                    raise ValueError(f'Conflicting new materials share the name: {name}')
            try:
                mapped = len(base_materials) + new_materials.index(material)
            except ValueError:
                mapped = len(base_materials) + len(new_materials)
                new_materials.append(copy.deepcopy(material))
        material_map[material_id] = mapped
        return mapped

    meshes = chair.get('meshes', [])
    mesh_ids = sorted({index(node['mesh'], meshes, 'mesh')
                       for node in chair_nodes if 'mesh' in node})
    if not mesh_ids:
        raise ValueError('Incoming chair contains no mesh')
    accessor_ids = set()
    for mesh_id in mesh_ids:
        mesh = meshes[mesh_id]
        reject_extensions(mesh, 'Incoming mesh')
        for primitive in mesh.get('primitives', []):
            reject_extensions(primitive, 'Incoming primitive')
            if 'material' in primitive:
                map_material(primitive['material'])
            accessor_ids.update(primitive.get('attributes', {}).values())
            if 'indices' in primitive:
                accessor_ids.add(primitive['indices'])
            for target in primitive.get('targets', []):
                accessor_ids.update(target.values())

    accessors, views = chair.get('accessors', []), chair.get('bufferViews', [])
    view_ids = set()
    for accessor_id in accessor_ids:
        accessor = accessors[index(accessor_id, accessors, 'accessor')]
        reject_extensions(accessor, 'Incoming accessor')
        if 'bufferView' in accessor:
            view_ids.add(index(accessor['bufferView'], views, 'bufferView'))
        if 'sparse' in accessor:
            for part in ('indices', 'values'):
                view_ids.add(index(accessor['sparse'][part]['bufferView'], views, 'sparse bufferView'))
    # A textured Blender chair export may embed copies of all the room's images.
    # Only referenced geometry views are copied; overlapping image bytes are rejected.
    image_ranges = []
    for image in chair.get('images', []):
        if 'bufferView' in image:
            view = views[index(image['bufferView'], views, 'image bufferView')]
            image_ranges.append((view.get('byteOffset', 0),
                                 view.get('byteOffset', 0) + view['byteLength']))
    view_map = {}
    added_views = []
    geometry_bytes = 0
    for view_id in sorted(view_ids):
        view = copy.deepcopy(views[view_id])
        reject_extensions(view, 'Incoming bufferView')
        start, size = view.get('byteOffset', 0), view['byteLength']
        if any(start < end and start + size > begin for begin, end in image_ranges):
            raise ValueError('Incoming geometry overlaps an image payload')
        binary.extend(b'\0' * (-len(binary) % 4))
        view['byteOffset'] = len(binary)
        view['buffer'] = 0
        binary.extend(chair_binary[start:start + size])
        geometry_bytes += size
        view_map[view_id] = len(base.get('bufferViews', [])) + len(added_views)
        added_views.append(view)

    accessor_map, added_accessors = {}, []
    for accessor_id in sorted(accessor_ids):
        accessor = copy.deepcopy(accessors[accessor_id])
        if 'bufferView' in accessor:
            accessor['bufferView'] = view_map[accessor['bufferView']]
        if 'sparse' in accessor:
            for part in ('indices', 'values'):
                sparse_part = accessor['sparse'][part]
                sparse_part['bufferView'] = view_map[sparse_part['bufferView']]
        accessor_map[accessor_id] = len(base.get('accessors', [])) + len(added_accessors)
        added_accessors.append(accessor)

    mesh_map, added_meshes = {}, []
    for mesh_id in mesh_ids:
        mesh = copy.deepcopy(meshes[mesh_id])
        for primitive in mesh.get('primitives', []):
            primitive['attributes'] = {name: accessor_map[value]
                                       for name, value in primitive.get('attributes', {}).items()}
            if 'indices' in primitive:
                primitive['indices'] = accessor_map[primitive['indices']]
            if 'material' in primitive:
                primitive['material'] = material_map[primitive['material']]
            if 'targets' in primitive:
                primitive['targets'] = [{name: accessor_map[value] for name, value in target.items()}
                                        for target in primitive['targets']]
        mesh_map[mesh_id] = len(base.get('meshes', [])) + len(added_meshes)
        added_meshes.append(mesh)

    node_offset = len(base_nodes)
    added_nodes = copy.deepcopy(chair_nodes)
    for node in added_nodes:
        if 'mesh' in node:
            node['mesh'] = mesh_map[node['mesh']]
        if 'children' in node:
            node['children'] = [node_offset + child for child in node['children']]
    new_roots = [node_offset + root for root in incoming_roots]
    for scene in result.get('scenes', []):
        roots = scene.get('nodes', [])
        if not any(root in old_chair for root in roots):
            continue
        next_roots, inserted = [], False
        for root in roots:
            if root in old_chair:
                if not inserted:
                    next_roots.extend(new_roots)
                    inserted = True
            else:
                next_roots.append(root)
        scene['nodes'] = next_roots
    for key, added in (('nodes', added_nodes), ('meshes', added_meshes),
                       ('accessors', added_accessors), ('bufferViews', added_views),
                       ('materials', new_materials)):
        if added:
            result.setdefault(key, []).extend(added)
    result['buffers'][0]['byteLength'] = len(binary)
    # Geometry/node extensions are rejected; only extensions actually retained
    # by newly appended materials need to be registered.
    retained_extensions = set()
    def collect_extensions(value):
        if isinstance(value, dict):
            retained_extensions.update(value.get('extensions', {}).keys())
            for child in value.values():
                collect_extensions(child)
        elif isinstance(value, list):
            for child in value:
                collect_extensions(child)
    collect_extensions(new_materials)
    for key in ('extensionsUsed', 'extensionsRequired'):
        added = [name for name in chair.get(key, [])
                 if name in retained_extensions and name not in result.get(key, [])]
        if added:
            result.setdefault(key, []).extend(added)

    checks = {}
    def unchanged(label, before, after, byte_values=False):
        first, second = (before, after) if byte_values else (canonical(before), canonical(after))
        if first != second:
            raise ValueError(f'Preservation validation failed: {label}')
        checks[label] = {'sha256Before': sha(first), 'sha256After': sha(second), 'unchanged': True}
    unchanged('baseBinaryPrefix', base_binary, bytes(binary[:len(base_binary)]), True)
    for key in ('nodes', 'meshes', 'accessors', 'bufferViews', 'materials', 'images', 'textures', 'samplers'):
        unchanged('original' + key[0].upper() + key[1:],
                  base.get(key, []), result.get(key, [])[:len(base.get(key, []))])
    non_chair = [i for i in range(len(base_nodes)) if i not in old_chair]
    unchanged('nonChairNodes', [base_nodes[i] for i in non_chair],
              [result['nodes'][i] for i in non_chair])
    def without_chair_roots(document):
        scenes = copy.deepcopy(document.get('scenes', []))
        for scene in scenes:
            scene['nodes'] = [i for i in scene.get('nodes', [])
                              if not document['nodes'][i].get('name', '').startswith(CHAIR_PREFIX)]
        return scenes
    unchanged('nonChairSceneRoots', without_chair_roots(base), without_chair_roots(result))
    image_checks = []
    for i, image in enumerate(base.get('images', [])):
        if 'bufferView' not in image:
            continue
        view = base['bufferViews'][image['bufferView']]
        start, end = view.get('byteOffset', 0), view.get('byteOffset', 0) + view['byteLength']
        before, after = base_binary[start:end], bytes(binary[start:end])
        unchanged(f'imagePayload{i}', before, after, True)
        image_checks.append({'image': i, 'bytes': len(before), 'sha256': sha(before)})
    if any(len(result.get(key, [])) != len(base.get(key, [])) for key in ('images', 'textures', 'samplers')):
        raise ValueError('Texture resources were unexpectedly appended')
    report = {
        'validation': checks,
        'oldChairNodesDisconnected': len(active_old_chair),
        'newChairNodes': len(added_nodes),
        'newChairMeshes': len(added_meshes),
        'nonChairNodesPreserved': len(non_chair),
        'appendedAccessors': len(added_accessors),
        'appendedBufferViews': len(added_views),
        'appendedGeometryBytes': geometry_bytes,
        'appendedMaterials': [material['name'] for material in new_materials],
        'materialRemap': {str(i): {'name': incoming_materials[i]['name'], 'outputIndex': mapped,
                                  'reusedOriginal': mapped < len(base_materials)}
                          for i, mapped in sorted(material_map.items())},
        'baseBinaryBytesPreserved': len(base_binary),
        'incomingImagePayloadsCopied': 0,
        'imagesBefore': len(base.get('images', [])),
        'imagesAfter': len(result.get('images', [])),
        'texturesBefore': len(base.get('textures', [])),
        'texturesAfter': len(result.get('textures', [])),
        'imagePayloads': image_checks,
    }
    validate_buffer(result, bytes(binary))
    return result, bytes(binary), report


def atomic_write(path, data):
    path = Path(path)
    # Do not create missing destination directories or modify either source file.
    with tempfile.NamedTemporaryFile(prefix=path.name + '.', suffix='.tmp',
                                     dir=path.parent, delete=False) as stream:
        temporary = Path(stream.name)
        try:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
            stream.close()
            os.replace(temporary, path)
        finally:
            temporary.unlink(missing_ok=True)


def merge(base_path, chair_path, output_path):
    base_path, chair_path, output_path = map(lambda p: Path(p).resolve(),
                                             (base_path, chair_path, output_path))
    if output_path in (base_path, chair_path):
        raise ValueError('Output must differ from both input files')
    base, base_binary, base_sha = read_glb(base_path)
    chair, chair_binary, chair_sha = read_glb(chair_path)
    document, binary, report = merge_documents(base, base_binary, chair, chair_binary)
    output = encode_glb(document, binary)
    report.update({'base': str(base_path), 'chair': str(chair_path), 'output': str(output_path),
                   'baseFileSHA256': base_sha, 'chairFileSHA256': chair_sha,
                   'outputFileSHA256': sha(output), 'outputBytes': len(output)})
    atomic_write(output_path, output)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('base', type=Path)
    parser.add_argument('chair', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--report', type=Path, help='Also save the validation JSON at this path')
    args = parser.parse_args()
    if args.report and args.report.resolve() in {p.resolve() for p in (args.base, args.chair, args.output)}:
        parser.error('--report must differ from the GLB paths')
    try:
        report = merge(args.base, args.chair, args.output)
        encoded = json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + '\n'
        if args.report:
            atomic_write(args.report.resolve(), encoded.encode('utf-8'))
        print(encoded, end='')
    except (ValueError, KeyError, TypeError, OSError, struct.error) as error:
        parser.exit(1, f'merge_chair_glb: {error}\n')


if __name__ == '__main__':
    main()
