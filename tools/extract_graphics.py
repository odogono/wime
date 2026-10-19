#!/usr/bin/env python3
"""Extract graphics resources from the WHDLoad War In Middle Earth archive."""

from __future__ import annotations

import argparse
import json
import math
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw


def find_artifacts_dir() -> Path:
    """Locate the untracked artifacts/ dir, falling back to the main checkout when run from a git worktree."""
    root = Path(__file__).resolve().parents[1]
    if (root / "artifacts").is_dir():
        return root / "artifacts"
    try:
        common = subprocess.check_output(
            ["git", "-C", str(root), "rev-parse", "--path-format=absolute", "--git-common-dir"], text=True
        ).strip()
    except (FileNotFoundError, subprocess.CalledProcessError):
        return root / "artifacts"
    return Path(common).parent / "artifacts"


ARTIFACTS_DIR = find_artifacts_dir()
DEFAULT_ARCHIVE = ARTIFACTS_DIR / "amiga" / "WarInMiddleEarth_v1.0_0968.lha"
BLOCK_SIZE = 512
RESOURCE_FILES = {
    "disk1": ("WarInMiddleEarth/data/Disk.1", ("AMaps.res", "AAnims.res", "ATitle.res", "AScene.res")),
    "disk2": ("WarInMiddleEarth/data/Disk.2", ("BScene.res",)),
}


class ExtractError(RuntimeError):
    pass


def be_s32(data: bytes, offset: int) -> int:
    value = int.from_bytes(data[offset : offset + 4], "big", signed=True)
    return value


def be_u32(data: bytes, offset: int) -> int:
    return int.from_bytes(data[offset : offset + 4], "big", signed=False)


def be_u24(data: bytes, offset: int) -> int:
    return (data[offset] << 16) | (data[offset + 1] << 8) | data[offset + 2]


def be_s16(data: bytes, offset: int) -> int:
    return int.from_bytes(data[offset : offset + 2], "big", signed=True)


def be_u16(data: bytes, offset: int) -> int:
    return int.from_bytes(data[offset : offset + 2], "big", signed=False)


def safe_name(value: str) -> str:
    safe = []
    for char in value:
        if char.isalnum() or char in ("-", "_", "."):
            safe.append(char)
        else:
            safe.append("_")
    return "".join(safe)


def load_lha_member(archive: Path | str, member: str) -> bytes:
    try:
        return subprocess.check_output(["lha", "pq", str(archive), member])
    except FileNotFoundError as exc:
        raise ExtractError("lha is required on PATH") from exc
    except subprocess.CalledProcessError as exc:
        raise ExtractError(f"failed to extract {member} from {archive}") from exc


class AmigaOFSImage:
    def __init__(self, data: bytes):
        if len(data) % BLOCK_SIZE != 0:
            raise ExtractError(f"disk image size is not a multiple of {BLOCK_SIZE}: {len(data)}")
        if data[:3] != b"DOS":
            raise ExtractError("disk image does not start with an AmigaDOS signature")
        self.data = data
        self.block_count = len(data) // BLOCK_SIZE
        self.files = self._scan_file_headers()

    def block(self, number: int) -> bytes:
        if number < 0 or number >= self.block_count:
            raise ExtractError(f"block out of range: {number}")
        start = number * BLOCK_SIZE
        return self.data[start : start + BLOCK_SIZE]

    def read_file(self, filename: str) -> bytes:
        header_block = self.files.get(filename.lower())
        if header_block is None:
            available = ", ".join(sorted(self.files))
            raise ExtractError(f"{filename} not found in disk image; available: {available}")
        return self.read_file_by_header(header_block)

    def read_file_by_header(self, header_block: int) -> bytes:
        header = self.block(header_block)
        if be_s32(header, 0) != 2 or be_s32(header, 508) != -3:
            raise ExtractError(f"block {header_block} is not an OFS file header")

        expected_size = be_u32(header, 324)
        data_blocks = []
        current = header_block
        seen = set()

        while current and current not in seen:
            seen.add(current)
            block = self.block(current)
            if be_s32(block, 0) not in (2, 16):
                raise ExtractError(f"block {current} is not a file header/extension block")
            for offset in range(24, 312, 4):
                pointer = be_u32(block, offset)
                if pointer:
                    data_blocks.append(pointer)
            current = be_u32(block, 504)

        chunks = []
        for pointer in data_blocks:
            data_block = self.block(pointer)
            if be_s32(data_block, 0) != 8:
                raise ExtractError(f"block {pointer} is not an OFS data block")
            sequence = be_u32(data_block, 8)
            size = be_u32(data_block, 12)
            chunks.append((sequence, data_block[24 : 24 + size]))

        payload = b"".join(chunk for _, chunk in sorted(chunks, key=lambda item: item[0]))
        return payload[:expected_size]

    def _scan_file_headers(self) -> dict[str, int]:
        files: dict[str, int] = {}
        for block_number in range(self.block_count):
            block = self.block(block_number)
            if be_s32(block, 0) != 2 or be_s32(block, 508) != -3:
                continue
            name = self._read_header_name(block)
            if name:
                files[name.lower()] = block_number
        return files

    @staticmethod
    def _read_header_name(block: bytes) -> str | None:
        length = block[432]
        if length == 0 or length > 107 or 433 + length > len(block):
            return None
        raw_name = block[433 : 433 + length]
        if any(byte < 32 or byte > 126 for byte in raw_name):
            return None
        return raw_name.decode("latin1")


@dataclass(frozen=True)
class Resource:
    type_code: str
    resource_id: int
    name: str | None
    attributes: int
    data_offset: int
    data: bytes


@dataclass(frozen=True)
class ResourceFork:
    resources: tuple[Resource, ...]

    def get(self, type_code: str, resource_id: int) -> Resource:
        for resource in self.resources:
            if resource.type_code == type_code and resource.resource_id == resource_id:
                return resource
        raise KeyError((type_code, resource_id))

    def by_type(self, type_code: str) -> list[Resource]:
        return [resource for resource in self.resources if resource.type_code == type_code]


def parse_resource_fork(data: bytes) -> ResourceFork:
    if len(data) < 16:
        raise ExtractError("resource fork is too short")

    data_offset = be_u32(data, 0)
    map_offset = be_u32(data, 4)
    data_length = be_u32(data, 8)
    map_length = be_u32(data, 12)
    if data_offset + data_length > len(data) or map_offset + map_length > len(data):
        raise ExtractError("resource fork header points outside the file")

    type_list_offset = be_u16(data, map_offset + 24)
    name_list_offset = be_u16(data, map_offset + 26)
    type_list_base = map_offset + type_list_offset
    name_list_base = map_offset + name_list_offset
    type_count = be_u16(data, type_list_base) + 1

    resources: list[Resource] = []
    for type_index in range(type_count):
        type_entry = type_list_base + 2 + (type_index * 8)
        type_code = data[type_entry : type_entry + 4].decode("latin1")
        resource_count = be_u16(data, type_entry + 4) + 1
        reference_list_base = type_list_base + be_u16(data, type_entry + 6)

        for resource_index in range(resource_count):
            reference = reference_list_base + (resource_index * 12)
            resource_id = be_s16(data, reference)
            name_offset = be_s16(data, reference + 2)
            attributes = data[reference + 4]
            resource_data_offset = be_u24(data, reference + 5)
            data_position = data_offset + resource_data_offset
            resource_length = be_u32(data, data_position)
            payload_start = data_position + 4
            payload_end = payload_start + resource_length
            if payload_end > data_offset + data_length:
                raise ExtractError(f"{type_code} {resource_id} extends outside resource data")

            name = None
            if name_offset != -1:
                name_position = name_list_base + name_offset
                name_length = data[name_position]
                name = data[name_position + 1 : name_position + 1 + name_length].decode(
                    "latin1", errors="replace"
                )

            resources.append(
                Resource(
                    type_code=type_code,
                    resource_id=resource_id,
                    name=name,
                    attributes=attributes,
                    data_offset=resource_data_offset,
                    data=data[payload_start:payload_end],
                )
            )

    return ResourceFork(tuple(resources))


def unpack_packbits(data: bytes, expected_size: int) -> tuple[bytes, int]:
    output = bytearray()
    offset = 0
    while offset < len(data) and len(output) < expected_size:
        token = data[offset]
        offset += 1
        if token <= 127:
            count = token + 1
            output.extend(data[offset : offset + count])
            offset += count
        elif token >= 129:
            count = 257 - token
            if offset >= len(data):
                break
            output.extend([data[offset]] * count)
            offset += 1
        else:
            continue
    return bytes(output[:expected_size]), offset


@dataclass(frozen=True)
class DecodedBitmap:
    width: int
    height: int
    depth: int
    decompressed_size: int
    pixel_indices: Image.Image
    warnings: tuple[str, ...]


def decode_imag_resource(data: bytes, palette: list[int] | None = None) -> DecodedBitmap:
    warnings = []
    if len(data) < 28:
        raise ExtractError("IMAG resource is too short")

    if be_u16(data, 0) == 0x0200:
        decompressed = data
        expected_size = len(data)
    else:
        expected_size = be_u32(data, 0)
        decompressed, consumed = unpack_packbits(data[4:], expected_size)
        if len(decompressed) != expected_size:
            raise ExtractError(f"PackBits output is {len(decompressed)} bytes, expected {expected_size}")
        if consumed < len(data) - 4:
            trailing = len(data) - 4 - consumed
            if trailing:
                warnings.append(f"{trailing} trailing compressed bytes")

    if be_u16(decompressed, 0) != 0x0200:
        raise ExtractError("decompressed IMAG header does not start with 0x0200")

    depth = decompressed[5]
    width = be_u16(decompressed, 20)
    height = be_u16(decompressed, 22)
    if depth <= 0 or depth > 8:
        raise ExtractError(f"unsupported bit depth: {depth}")
    if width <= 0 or height <= 0:
        raise ExtractError(f"invalid dimensions: {width}x{height}")

    row_bytes = math.ceil(width / 16) * 2
    expected_bitmap_size = 28 + (row_bytes * height * depth)
    if len(decompressed) < expected_bitmap_size:
        raise ExtractError(
            f"bitmap data is short: {len(decompressed)} bytes, expected at least {expected_bitmap_size}"
        )
    if len(decompressed) > expected_bitmap_size:
        warnings.append(f"{len(decompressed) - expected_bitmap_size} extra decompressed bytes")

    bitmap = decompressed[28:expected_bitmap_size]
    image = Image.new("P", (width, height))
    pixels = image.load()

    # The decompressed resources store rows as plane 0 row, plane 1 row, ...
    # for each scanline. This matches the way Amiga BitMap rows are commonly
    # serialized when multiple plane pointers reference one contiguous buffer.
    for y in range(height):
        for x in range(width):
            byte_index = x // 8
            mask = 0x80 >> (x % 8)
            value = 0
            for plane in range(depth):
                row_offset = (y * depth * row_bytes) + (plane * row_bytes)
                if bitmap[row_offset + byte_index] & mask:
                    value |= 1 << plane
            pixels[x, y] = value

    image.putpalette(palette if palette is not None else default_palette())
    return DecodedBitmap(width, height, depth, expected_size, image, tuple(warnings))


def default_palette() -> list[int]:
    # War In Middle Earth uses this 32-colour Amiga-style palette for the
    # decoded resource graphics.
    rgb = [
        (0, 0, 0),
        (255, 255, 255),
        (136, 136, 136),
        (68, 68, 68),
        (136, 0, 0),
        (204, 68, 0),
        (238, 170, 68),
        (255, 238, 136),
        (0, 68, 0),
        (0, 136, 0),
        (68, 170, 68),
        (136, 204, 102),
        (0, 0, 136),
        (0, 68, 204),
        (68, 136, 238),
        (136, 204, 255),
        (68, 0, 68),
        (136, 0, 136),
        (204, 68, 204),
        (238, 136, 238),
        (0, 68, 68),
        (0, 136, 136),
        (68, 204, 204),
        (136, 238, 238),
        (102, 68, 34),
        (153, 102, 51),
        (204, 153, 85),
        (238, 204, 136),
        (32, 32, 32),
        (96, 96, 96),
        (160, 160, 160),
        (224, 224, 224),
    ]
    flattened: list[int] = []
    for red, green, blue in rgb:
        flattened.extend([red, green, blue])
    flattened.extend([0, 0, 0] * (256 - len(rgb)))
    return flattened


def map_palette() -> list[int]:
    rgb = [
        (0, 0, 0),
        (68, 68, 68),
        (119, 119, 119),
        (153, 136, 119),
        (187, 153, 136),
        (0, 51, 0),
        (0, 85, 0),
        (34, 102, 17),
        (68, 136, 255),
        (119, 187, 255),
        (255, 0, 0),
        (0, 204, 0),
        (0, 221, 187),
        (0, 0, 0),
        (0, 255, 0),
        (255, 238, 170),
    ]
    flattened: list[int] = []
    for red, green, blue in rgb:
        flattened.extend([red, green, blue])
    flattened.extend([0, 0, 0] * (256 - len(rgb)))
    return flattened


def palette_for_resource_file(resource_name: str) -> tuple[str, list[int]]:
    if resource_name.lower() == "amaps.res":
        return "War In Middle Earth full-map palette", map_palette()
    return "War In Middle Earth 32-colour art palette", default_palette()


def save_contact_sheet(images: list[tuple[str, Image.Image]], output_path: Path) -> None:
    if not images:
        return
    thumb_width = 160
    label_height = 14
    padding = 8
    columns = min(5, max(1, math.ceil(math.sqrt(len(images)))))
    rows = math.ceil(len(images) / columns)
    cell_width = thumb_width + padding
    cell_height = thumb_width + label_height + padding
    sheet = Image.new("RGB", (columns * cell_width + padding, rows * cell_height + padding), (24, 24, 24))
    draw = ImageDraw.Draw(sheet)

    for index, (label, image) in enumerate(images):
        row, column = divmod(index, columns)
        x = padding + (column * cell_width)
        y = padding + (row * cell_height)
        preview = image.convert("RGB")
        preview.thumbnail((thumb_width, thumb_width), Image.Resampling.NEAREST)
        sheet.paste(preview, (x, y))
        draw.text((x, y + thumb_width), label[:24], fill=(230, 230, 230))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path)


def extract_archive(archive: Path, output_dir: Path) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest = {
        "archive": str(archive),
        "palette": {
            "source": "resource-specific palettes",
            "status": "AMaps.res uses the full-map palette; other IMAG resources use the art palette",
        },
        "resource_files": [],
        "summary": {
            "imag_total": 0,
            "imag_decoded": 0,
            "frml_total": 0,
            "frml_decoded": 0,
            "warnings": 0,
        },
    }

    for disk_name, (member_name, resource_names) in RESOURCE_FILES.items():
        disk = AmigaOFSImage(load_lha_member(archive, member_name))
        for resource_name in resource_names:
            resource_data = disk.read_file(resource_name)
            resource_fork = parse_resource_fork(resource_data)
            palette_source, palette = palette_for_resource_file(resource_name)
            file_manifest = {
                "disk": disk_name,
                "source_member": member_name,
                "resource_file": resource_name,
                "size": len(resource_data),
                "palette_source": palette_source,
                "resources": [],
            }
            resource_output_dir = output_dir / safe_name(resource_name)
            imag_sheet_inputs: list[tuple[str, Image.Image]] = []

            for resource in resource_fork.resources:
                entry = {
                    "type": resource.type_code,
                    "id": resource.resource_id,
                    "name": resource.name,
                    "length": len(resource.data),
                    "status": "skipped",
                    "warnings": [],
                }

                if resource.type_code == "IMAG":
                    manifest["summary"]["imag_total"] += 1
                    try:
                        decoded = decode_imag_resource(resource.data, palette=palette)
                        filename = f"IMAG_{resource.resource_id}.png"
                        path = resource_output_dir / "IMAG" / filename
                        path.parent.mkdir(parents=True, exist_ok=True)
                        decoded.pixel_indices.save(path)
                        entry.update(
                            {
                                "status": "decoded",
                                "output": str(path.relative_to(output_dir)),
                                "width": decoded.width,
                                "height": decoded.height,
                                "depth": decoded.depth,
                                "decompressed_size": decoded.decompressed_size,
                                "palette_source": palette_source,
                            }
                        )
                        entry["warnings"].extend(decoded.warnings)
                        manifest["summary"]["imag_decoded"] += 1
                        imag_sheet_inputs.append((str(resource.resource_id), decoded.pixel_indices))
                    except Exception as exc:  # noqa: BLE001 - preserve per-resource warnings in manifest
                        entry["status"] = "warning"
                        entry["warnings"].append(str(exc))

                elif resource.type_code == "FRML":
                    manifest["summary"]["frml_total"] += 1
                    entry["status"] = "warning"
                    entry["warnings"].append(
                        "FRML frame-list payloads were enumerated but their frame command format is not decoded yet"
                    )

                elif resource.type_code in ("MMAP", "CHAR"):
                    entry["status"] = "warning"
                    entry["warnings"].append(
                        f"{resource.type_code} payload was enumerated but its map/character format is not decoded yet"
                    )

                if entry["warnings"]:
                    manifest["summary"]["warnings"] += len(entry["warnings"])
                file_manifest["resources"].append(entry)

            save_contact_sheet(imag_sheet_inputs, resource_output_dir / f"{safe_name(resource_name)}_IMAG_sheet.png")
            manifest["resource_files"].append(file_manifest)

    manifest_path = output_dir / "manifest.json"
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
    parser.add_argument("--out", type=Path, default=Path("extracted_graphics"), help="Output directory")
    return parser


def main(argv: Iterable[str] | None = None) -> int:
    parser = build_arg_parser()
    args = parser.parse_args(argv)
    manifest = extract_archive(args.archive, args.out)
    summary = manifest["summary"]
    print(
        "decoded {imag_decoded}/{imag_total} IMAG resources; "
        "decoded {frml_decoded}/{frml_total} FRML resources; "
        "{warnings} warnings; manifest written to {manifest}".format(
            **summary, manifest=args.out / "manifest.json"
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
