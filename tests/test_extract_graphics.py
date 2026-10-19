import unittest
from pathlib import Path

from tools.extract_graphics import (
    AmigaOFSImage,
    decode_imag_resource,
    default_palette,
    load_lha_member,
    map_palette,
    parse_resource_fork,
)
from tools.render_campaign_map import load_campaign_map_assets
from tools.extract_text import decode_cstr_payload, extract_embedded_strings


ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "WarInMiddleEarth_v1.0_0968.lha"


class ExtractGraphicsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.disk1 = AmigaOFSImage(load_lha_member(ARCHIVE, "WarInMiddleEarth/data/Disk.1"))
        cls.disk2 = AmigaOFSImage(load_lha_member(ARCHIVE, "WarInMiddleEarth/data/Disk.2"))

    def test_reconstructs_expected_resource_file_sizes(self):
        expected = {
            ("disk1", "AMaps.res"): 93390,
            ("disk1", "AAnims.res"): 95583,
            ("disk1", "ATitle.res"): 70729,
            ("disk1", "AScene.res"): 129250,
            ("disk2", "BScene.res"): 745052,
        }

        actual = {
            ("disk1", "AMaps.res"): len(self.disk1.read_file("AMaps.res")),
            ("disk1", "AAnims.res"): len(self.disk1.read_file("AAnims.res")),
            ("disk1", "ATitle.res"): len(self.disk1.read_file("ATitle.res")),
            ("disk1", "AScene.res"): len(self.disk1.read_file("AScene.res")),
            ("disk2", "BScene.res"): len(self.disk2.read_file("BScene.res")),
        }

        self.assertEqual(actual, expected)

    def test_resource_parser_reports_known_graphics_counts(self):
        resources = []
        for image, filename in (
            (self.disk1, "AMaps.res"),
            (self.disk1, "AAnims.res"),
            (self.disk1, "ATitle.res"),
            (self.disk1, "AScene.res"),
            (self.disk2, "BScene.res"),
        ):
            resources.extend(parse_resource_fork(image.read_file(filename)).resources)

        image_count = sum(1 for resource in resources if resource.type_code == "IMAG")
        frame_list_count = sum(1 for resource in resources if resource.type_code == "FRML")

        self.assertEqual(image_count, 115)
        self.assertEqual(frame_list_count, 19)

    def test_decodes_packbits_planar_imag_resource(self):
        resources = parse_resource_fork(self.disk1.read_file("AMaps.res"))
        resource = resources.get("IMAG", 100)

        decoded = decode_imag_resource(resource.data)

        self.assertEqual(decoded.width, 80)
        self.assertEqual(decoded.height, 96)
        self.assertEqual(decoded.depth, 4)
        self.assertEqual(decoded.decompressed_size, 3868)
        self.assertEqual(decoded.pixel_indices.size, (80, 96))

    def test_decodes_row_interleaved_bitplanes(self):
        resources = parse_resource_fork(self.disk1.read_file("ATitle.res"))
        resource = resources.get("IMAG", 70)

        decoded = decode_imag_resource(resource.data)

        self.assertEqual(decoded.pixel_indices.size, (119, 141))
        self.assertEqual(decoded.depth, 5)
        self.assertEqual(decoded.pixel_indices.getpixel((0, 0)), 13)
        self.assertEqual(decoded.pixel_indices.getpixel((10, 10)), 20)
        self.assertEqual(decoded.pixel_indices.getpixel((60, 130)), 0)

    def test_default_palette_is_complete_32_colour_amiga_palette(self):
        palette = default_palette()

        self.assertEqual(len(palette), 256 * 3)
        self.assertEqual(palette[:12], [0, 0, 0, 255, 255, 255, 136, 136, 136, 68, 68, 68])
        self.assertEqual(palette[(31 * 3) : (32 * 3)], [224, 224, 224])

    def test_map_palette_matches_full_map_roles(self):
        palette = map_palette()

        self.assertEqual(len(palette), 256 * 3)
        self.assertEqual(palette[8 * 3 : 8 * 3 + 3], [68, 136, 255])
        self.assertEqual(palette[10 * 3 : 10 * 3 + 3], [255, 0, 0])
        self.assertEqual(palette[15 * 3 : 15 * 3 + 3], [255, 238, 170])

    def test_campaign_map_assets_decode_from_amaps(self):
        assets = load_campaign_map_assets(ARCHIVE)

        self.assertEqual(len(assets.tiles), 320)
        self.assertEqual(len(assets.map_indices), 16256)
        self.assertEqual(assets.tiles[33].size, (16, 16))
        self.assertEqual(assets.map_indices[:17], bytes([0] * 17))

    def test_text_resources_decode_cstr_and_styled_strings(self):
        atext = parse_resource_fork(self.disk1.read_file("AText.res"))
        bscene = parse_resource_fork(self.disk2.read_file("BScene.res"))

        atext_string = decode_cstr_payload(atext.get("CSTR", 57).data)
        styled_string = decode_cstr_payload(bscene.get("CSTR", 56).data)

        self.assertEqual(len(atext.by_type("CSTR")), 4)
        self.assertEqual(len(bscene.by_type("CSTR")), 57)
        self.assertIn("Three Rings for the Elven-kings", atext_string.text)
        self.assertIn("I will return as\nsoon as I can", styled_string.text)
        self.assertIn("Rivendell", styled_string.text)

    def test_executable_string_scan_finds_ui_text(self):
        strings = extract_embedded_strings(self.disk1.read_file("WarInMiddleEarth"))
        texts = {record["text"] for record in strings}

        self.assertIn("Sound is now off.", texts)
        self.assertIn("The Game is Paused.", texts)
        self.assertIn("Are you certain you want to quit?", texts)


if __name__ == "__main__":
    unittest.main()
