"""Regression tests for the exact chair-only GLB merge. No third-party packages.

Run: python3 -B tests/test_merge_chair_glb.py
"""
import copy
import importlib.util
import json
from pathlib import Path
import struct
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('merge_chair_glb',
    ROOT / 'artwork/penthouse/merge_chair_glb.py')
merge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(merge)


def fixture():
    positions = struct.pack('<9f', 0, 0, 0, 1, 0, 0, 0, 1, 0)
    indices = struct.pack('<3H', 0, 1, 2)
    image = b'FAKE-TEXTURE-PAYLOAD-MUST-NOT-BE-DUPLICATED'
    binary = positions + indices + b'\0\0' + image
    document = {
        'asset': {'version': '2.0'},
        'scene': 0, 'scenes': [{'name': 'Room', 'nodes': [0, 1]}],
        'nodes': [{'name': 'DESK_original', 'mesh': 0}, {'name': 'CHAIR_old', 'mesh': 0}],
        'meshes': [{'name': 'Shared original mesh', 'primitives': [
            {'attributes': {'POSITION': 0}, 'indices': 1, 'material': 0}]}],
        'accessors': [
            {'bufferView': 0, 'componentType': 5126, 'count': 3, 'type': 'VEC3'},
            {'bufferView': 1, 'componentType': 5123, 'count': 3, 'type': 'SCALAR'}],
        'bufferViews': [
            {'buffer': 0, 'byteOffset': 0, 'byteLength': len(positions), 'target': 34962},
            {'buffer': 0, 'byteOffset': len(positions), 'byteLength': len(indices), 'target': 34963},
            {'buffer': 0, 'byteOffset': len(positions) + len(indices) + 2, 'byteLength': len(image)}],
        'materials': [{'name': 'Furniture | Charcoal upholstery',
            'occlusionTexture': {'index': 0}, 'pbrMetallicRoughness': {'roughnessFactor': .8}}],
        'images': [{'bufferView': 2, 'mimeType': 'image/png'}],
        'textures': [{'source': 0, 'sampler': 0}], 'samplers': [{'magFilter': 9729}],
        'buffers': [{'byteLength': len(binary)}]}
    chair = copy.deepcopy(document)
    chair['scenes'] = [{'nodes': [0]}]
    chair['nodes'] = [{'name': 'CHAIR_new', 'mesh': 0, 'translation': [1, 2, 3]}]
    return document, binary, chair, binary, image


class ExactChairMerge(unittest.TestCase):
    def test_preservation_and_no_image_duplication(self):
        base, binary, chair, chair_binary, image = fixture()
        before_base, before_chair = copy.deepcopy(base), copy.deepcopy(chair)
        result, output, report = merge.merge_documents(base, binary, chair, chair_binary)
        self.assertEqual(base, before_base)
        self.assertEqual(chair, before_chair)
        for key in ('nodes', 'meshes', 'accessors', 'bufferViews', 'materials', 'images', 'textures', 'samplers'):
            self.assertEqual(result[key][:len(base[key])], base[key])
        self.assertEqual(result['scenes'][0]['nodes'], [0, 2])
        self.assertEqual(result['nodes'][2]['mesh'], 1)
        self.assertEqual(result['meshes'][1]['primitives'][0],
                         {'attributes': {'POSITION': 2}, 'indices': 3, 'material': 0})
        self.assertEqual(output[:len(binary)], binary)
        self.assertEqual(output.count(image), 1)
        self.assertEqual(report['appendedGeometryBytes'], 42)
        self.assertEqual(report['incomingImagePayloadsCopied'], 0)
        self.assertTrue(all(v['unchanged'] for v in report['validation'].values()))
        self.assertTrue(all(v['sha256Before'] == v['sha256After']
                            for v in report['validation'].values()))
        for view in result['bufferViews'][len(base['bufferViews']):]:
            self.assertEqual(view['byteOffset'] % 4, 0)

    def test_structural_material_and_hierarchy(self):
        base, binary, chair, chair_binary, _ = fixture()
        chair['nodes'] = [{'name': 'CHAIR_root', 'children': [1]},
                          {'name': 'CHAIR_frame', 'mesh': 0}]
        chair['materials'] = [{'name': 'Chair | new titanium',
                              'pbrMetallicRoughness': {'metallicFactor': .8},
                              'extensions': {'KHR_materials_ior': {'ior': 1.5}}}]
        chair['extensionsUsed'] = ['KHR_materials_ior']
        result, _, report = merge.merge_documents(base, binary, chair, chair_binary)
        self.assertEqual(result['nodes'][2]['children'], [3])
        self.assertEqual(result['materials'][1], chair['materials'][0])
        self.assertEqual(result['extensionsUsed'], ['KHR_materials_ior'])
        self.assertEqual(report['appendedMaterials'], ['Chair | new titanium'])
        self.assertEqual(result['meshes'][1]['primitives'][0]['material'], 1)

    def test_sparse_accessors_and_morph_targets(self):
        base, binary, chair, chair_binary, _ = fixture()
        chair['accessors'][0]['sparse'] = {
            'count': 1, 'indices': {'bufferView': 1, 'componentType': 5123},
            'values': {'bufferView': 0}}
        chair['meshes'][0]['primitives'][0]['targets'] = [{'POSITION': 0}]
        result, _, _ = merge.merge_documents(base, binary, chair, chair_binary)
        sparse = result['accessors'][2]['sparse']
        self.assertEqual(sparse['indices']['bufferView'], 4)
        self.assertEqual(sparse['values']['bufferView'], 3)
        self.assertEqual(result['meshes'][1]['primitives'][0]['targets'], [{'POSITION': 2}])

    def test_rejections(self):
        mutations = [
            (lambda b, c: c['materials'][0].update(name='Unknown textured chair'), 'Unknown textured'),
            (lambda b, c: c['nodes'][0].update(name='DESK_accidental'), 'CHAIR_'),
            (lambda b, c: c['nodes'][0].update(children=[0]), 'cycle'),
            (lambda b, c: b['nodes'][0].update(children=[1]), 'non-chair parent'),
            (lambda b, c: c['meshes'][0]['primitives'][0].update(extensions={'KHR_draco_mesh_compression': {}}), 'extensions'),
            (lambda b, c: c['accessors'][0].update(bufferView=2), 'overlaps an image'),
            (lambda b, c: c.update(extensionsUsed=['KHR_mesh_quantization']), 'quantized'),
        ]
        for mutation, expected in mutations:
            with self.subTest(expected=expected):
                base, binary, chair, chair_binary, _ = fixture()
                mutation(base, chair)
                with self.assertRaisesRegex(ValueError, expected):
                    merge.merge_documents(base, binary, chair, chair_binary)

    def test_file_round_trip_and_input_protection(self):
        base, binary, chair, chair_binary, _ = fixture()
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            base_path, chair_path, output_path = [folder / name for name in ('base.glb', 'chair.glb', 'out.glb')]
            base_bytes, chair_bytes = merge.encode_glb(base, binary), merge.encode_glb(chair, chair_binary)
            base_path.write_bytes(base_bytes); chair_path.write_bytes(chair_bytes)
            with self.assertRaisesRegex(ValueError, 'differ'):
                merge.merge(base_path, chair_path, base_path)
            report = merge.merge(base_path, chair_path, output_path)
            self.assertEqual(base_path.read_bytes(), base_bytes)
            self.assertEqual(chair_path.read_bytes(), chair_bytes)
            result, payload, file_hash = merge.read_glb(output_path)
            self.assertEqual(file_hash, report['outputFileSHA256'])
            self.assertEqual(result['scenes'][0]['nodes'], [0, 2])
            self.assertEqual(payload[:len(binary)], binary)

    def test_repeated_merge_counts_only_active_chair(self):
        base, binary, chair, chair_binary, image = fixture()
        first, first_binary, first_report = merge.merge_documents(base, binary, chair, chair_binary)
        second, second_binary, second_report = merge.merge_documents(first, first_binary, chair, chair_binary)
        self.assertEqual(first_report['oldChairNodesDisconnected'], 1)
        self.assertEqual(second_report['oldChairNodesDisconnected'], 1,
                         'Previously disconnected chair resources must not be counted again')
        self.assertEqual(second['scenes'][0]['nodes'], [0, 3])
        self.assertEqual(second['nodes'][:len(first['nodes'])], first['nodes'])
        self.assertEqual(second_binary[:len(first_binary)], first_binary)
        self.assertEqual(second_binary.count(image), 1)

    def test_actual_production_base(self):
        production = ROOT / 'shared/assets/models/penthouse/penthouse-v2.glb'
        base, binary, original_sha = merge.read_glb(production)
        _, _, chair, chair_binary, _ = fixture()
        result, output, report = merge.merge_documents(base, binary, chair, chair_binary)
        chair_ids = {i for i, node in enumerate(base['nodes'])
                     if node.get('name', '').startswith('CHAIR_')}
        active_chair = set()
        def collect(node_id):
            if node_id in active_chair:
                return
            active_chair.add(node_id)
            for child in base['nodes'][node_id].get('children', []):
                collect(child)
        for scene in base['scenes']:
            for root in scene.get('nodes', []):
                if root in chair_ids:
                    collect(root)
        self.assertTrue(active_chair, 'The production fixture must have an active chair')
        self.assertEqual(report['oldChairNodesDisconnected'], len(active_chair))
        self.assertEqual(report['nonChairNodesPreserved'], len(base['nodes']) - len(chair_ids))
        self.assertEqual(report['appendedMaterials'], [])
        self.assertEqual(report['imagesBefore'], len(base.get('images', [])))
        self.assertEqual(report['imagesAfter'], len(base.get('images', [])))
        for before_scene, after_scene in zip(base['scenes'], result['scenes']):
            old_roots = before_scene.get('nodes', [])
            non_chair_roots = [root for root in old_roots if root not in chair_ids]
            if any(root in chair_ids for root in old_roots):
                first_chair = next(i for i, root in enumerate(old_roots) if root in chair_ids)
                insert_at = sum(root not in chair_ids for root in old_roots[:first_chair])
                non_chair_roots.insert(insert_at, len(base['nodes']))
            self.assertEqual(after_scene.get('nodes', []), non_chair_roots)
        for key in ('nodes', 'meshes', 'accessors', 'bufferViews', 'materials', 'images', 'textures', 'samplers'):
            self.assertEqual(result.get(key, [])[:len(base.get(key, []))], base.get(key, []))
        self.assertEqual(output[:len(binary)], binary)
        self.assertEqual(merge.sha(production.read_bytes()), original_sha)


if __name__ == '__main__':
    unittest.main(verbosity=2)
