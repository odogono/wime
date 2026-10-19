#!/usr/bin/env python3
"""Render the base campaign map from AMaps.res."""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw

try:
    from extract_graphics import (
        DEFAULT_ARCHIVE,
        AmigaOFSImage,
        be_u16,
        be_u32,
        load_lha_member,
        parse_resource_fork,
        unpack_packbits,
    )
except ModuleNotFoundError:
    from tools.extract_graphics import (
        DEFAULT_ARCHIVE,
        AmigaOFSImage,
        be_u16,
        be_u32,
        load_lha_member,
        parse_resource_fork,
        unpack_packbits,
    )


@dataclass(frozen=True)
class CampaignMapAssets:
    tiles: tuple[Image.Image, ...]
    map_indices: bytes
    char_header: bytes
    palette: list[int]


def load_campaign_map_assets(archive: Path) -> CampaignMapAssets:
    disk = AmigaOFSImage(load_lha_member(archive, "WarInMiddleEarth/data/Disk.1"))
    resources = parse_resource_fork(disk.read_file("AMaps.res"))
    char_resource = resources.get("CHAR", 1).data
    mmap_resource = resources.get("MMAP", 1).data

    char_data, _ = unpack_packbits(char_resource[4:], be_u32(char_resource, 0))
    map_indices, _ = unpack_packbits(mmap_resource[4:], be_u32(mmap_resource, 0))

    return CampaignMapAssets(
        tiles=tuple(decode_campaign_tiles(char_data)),
        map_indices=map_indices,
        char_header=char_data[:32],
        palette=palette_from_rgb4_words(char_data[:32]),
    )


def palette_from_rgb4_words(data: bytes) -> list[int]:
    palette: list[int] = []
    for offset in range(0, min(len(data), 32), 2):
        value = be_u16(data, offset)
        palette.extend([((value >> 8) & 0xF) * 17, ((value >> 4) & 0xF) * 17, (value & 0xF) * 17])
    palette.extend([0, 0, 0] * (256 - (len(palette) // 3)))
    return palette


def decode_campaign_tiles(char_data: bytes) -> list[Image.Image]:
    header_size = 32
    tile_width = 16
    tile_height = 16
    depth = 4
    row_bytes = 2
    tile_size = tile_height * depth * row_bytes
    palette = palette_from_rgb4_words(char_data[:header_size])
    tiles = []

    for offset in range(header_size, len(char_data) - tile_size + 1, tile_size):
        tile_data = char_data[offset : offset + tile_size]
        tile = Image.new("P", (tile_width, tile_height))
        tile.putpalette(palette)
        pixels = tile.load()
        for y in range(tile_height):
            for x in range(tile_width):
                value = 0
                for plane in range(depth):
                    byte_offset = (y * depth * row_bytes) + (plane * row_bytes) + (x // 8)
                    if tile_data[byte_offset] & (0x80 >> (x % 8)):
                        value |= 1 << plane
                pixels[x, y] = value
        tiles.append(tile)

    return tiles


def render_tile_sheet(tiles: tuple[Image.Image, ...], columns: int = 20) -> Image.Image:
    tile_width, tile_height = tiles[0].size
    label_height = 10
    rows = (len(tiles) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * tile_width, rows * (tile_height + label_height)), (24, 24, 24))
    draw = ImageDraw.Draw(sheet)
    for index, tile in enumerate(tiles):
        x = (index % columns) * tile_width
        y = (index // columns) * (tile_height + label_height)
        sheet.paste(tile.convert("RGB"), (x, y))
        draw.text((x + 1, y + tile_height), str(index), fill=(230, 230, 230))
    return sheet


def render_raw_map(
    tiles: tuple[Image.Image, ...],
    map_indices: bytes,
    palette: list[int],
    width_tiles: int,
    height_tiles: int,
    stride_tiles: int,
    offset: int = 0,
) -> Image.Image:
    tile_width, tile_height = tiles[0].size
    output = Image.new("P", (width_tiles * tile_width, height_tiles * tile_height))
    output.putpalette(palette)

    for y in range(height_tiles):
        for x in range(width_tiles):
            position = offset + (y * stride_tiles) + x
            if position >= len(map_indices):
                continue
            tile_index = map_indices[position]
            if tile_index < len(tiles):
                output.paste(tiles[tile_index], (x * tile_width, y * tile_height))

    return output


def render_campaign_outputs(archive: Path, output_dir: Path) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    assets = load_campaign_map_assets(archive)

    tile_sheet_path = output_dir / "campaign_tiles.png"
    base_map_path = output_dir / "campaign_base_map_160x99.png"
    top_left_view_path = output_dir / "campaign_top_left_view_20x12.png"
    manifest_path = output_dir / "campaign_map_manifest.json"

    render_tile_sheet(assets.tiles).save(tile_sheet_path)
    render_raw_map(assets.tiles, assets.map_indices, assets.palette, 160, 99, 160).save(base_map_path)
    render_raw_map(assets.tiles, assets.map_indices, assets.palette, 20, 12, 160).save(top_left_view_path)

    manifest = {
        "archive": str(archive),
        "source": "AMaps.res",
        "char": {
            "decompressed_size": len(assets.char_header) + len(assets.tiles) * 128,
            "header_hex": assets.char_header.hex(" "),
            "palette_source": "first 16 RGB4 words in CHAR resource",
            "tile_count": len(assets.tiles),
            "tile_size": [16, 16],
            "depth": 4,
        },
        "mmap": {
            "decompressed_size": len(assets.map_indices),
            "map_grid_tiles": [160, 99],
            "map_size_pixels": [2560, 1584],
            "viewport_size_pixels": [320, 192],
            "scroll_limits_pixels": [2240, 1392],
            "layout_status": "solved: row-major 160x99 tile map",
        },
        "outputs": {
            "base_map": base_map_path.name,
            "tile_sheet": tile_sheet_path.name,
            "top_left_view": top_left_view_path.name,
        },
    }
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    return manifest


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "archive",
        type=Path,
        nargs="?",
        default=DEFAULT_ARCHIVE,
        help="Path to WarInMiddleEarth_v1.0_0968.lha (default: artifacts/amiga/)",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("extracted_graphics/campaign_map"),
        help="Output directory",
    )
    return parser


def main(argv: Iterable[str] | None = None) -> int:
    args = build_arg_parser().parse_args(argv)
    manifest = render_campaign_outputs(args.archive, args.out)
    print(
        "decoded {tile_count} campaign tiles and {map_size} MMAP bytes; outputs written to {out}".format(
            tile_count=manifest["char"]["tile_count"],
            map_size=manifest["mmap"]["decompressed_size"],
            out=args.out,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
