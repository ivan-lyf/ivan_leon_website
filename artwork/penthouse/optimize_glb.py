"""Deduplicate identical glTF texture declarations without changing binary payloads.

Blender can export one texture declaration per material even when they share the
same atlas and sampler. Three.js r128 otherwise uploads each declaration again.
Run after Blender exports: python3 artwork/penthouse/optimize_glb.py [model.glb]
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MODEL = ROOT / 'shared/assets/models/penthouse/penthouse-v2.glb'
JSON_CHUNK = 0x4E4F534A


def material_texture_infos(document):
    """Yield standard and extension texture-info dictionaries inside materials."""
    def walk(value):
        if isinstance(value, dict):
            for name, child in value.items():
                if name.endswith('Texture') and isinstance(child, dict) and 'index' in child:
                    yield child
                yield from walk(child)
        elif isinstance(value, list):
            for child in value:
                yield from walk(child)
    yield from walk(document.get('materials', []))


def validate_texture_indexes(document):
    texture_count = len(document.get('textures', []))
    infos = list(material_texture_infos(document))
    for info in infos:
        index = info['index']
        if not isinstance(index, int) or not 0 <= index < texture_count:
            raise ValueError(f'Invalid material texture index: {index!r}')
    for texture in document.get('textures', []):
        if 'source' in texture and not 0 <= texture['source'] < len(document.get('images', [])):
            raise ValueError(f'Invalid texture image source: {texture["source"]!r}')
        if 'sampler' in texture and not 0 <= texture['sampler'] < len(document.get('samplers', [])):
            raise ValueError(f'Invalid texture sampler: {texture["sampler"]!r}')
    return len(infos)


def optimize(path):
    original = path.read_bytes()
    if len(original) < 20:
        raise ValueError('File is too short to be a GLB.')
    magic, version, total_size = struct.unpack_from('<4sII', original)
    if magic != b'glTF' or version != 2 or total_size != len(original):
        raise ValueError('Expected a complete glTF 2.0 binary file.')
    json_size, chunk_type = struct.unpack_from('<II', original, 12)
    if chunk_type != JSON_CHUNK or 20 + json_size > len(original):
        raise ValueError('Expected a valid first JSON chunk.')
    document = json.loads(original[20:20 + json_size])
    binary_chunks = original[20 + json_size:]
    references = validate_texture_indexes(document)
    previous = document.get('textures', [])
    unique = []
    known = {}
    remap = {}
    for index, texture in enumerate(previous):
        identity = json.dumps(texture, sort_keys=True, separators=(',', ':'))
        if identity not in known:
            known[identity] = len(unique)
            unique.append(texture)
        remap[index] = known[identity]
    for info in material_texture_infos(document):
        info['index'] = remap[info['index']]
    if 'textures' in document:
        document['textures'] = unique
    if validate_texture_indexes(document) != references:
        raise ValueError('Texture references changed unexpectedly during optimization.')
    encoded = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    encoded += b' ' * (-len(encoded) % 4)
    result = (struct.pack('<4sII', b'glTF', 2, 20 + len(encoded) + len(binary_chunks))
              + struct.pack('<II', len(encoded), JSON_CHUNK) + encoded + binary_chunks)
    # Preserve every subsequent chunk byte for byte, including embedded images,
    # geometry, accessor offsets and binary padding.
    if result[20 + len(encoded):] != binary_chunks:
        raise ValueError('Binary payload changed unexpectedly.')
    if len(unique) != len(previous):
        temporary = path.with_suffix(path.suffix + '.tmp')
        temporary.write_bytes(result)
        temporary.chmod(path.stat().st_mode)
        os.replace(temporary, path)
    return {
        'path': str(path),
        'texturesBefore': len(previous),
        'texturesAfter': len(unique),
        'materialTextureReferences': references,
        'binaryPayloadPreserved': True,
        'bytesBefore': len(original),
        'bytesAfter': path.stat().st_size,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('model', type=Path, nargs='?', default=DEFAULT_MODEL)
    args = parser.parse_args()
    print(json.dumps(optimize(args.model.resolve()), indent=2))
