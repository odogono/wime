#!/usr/bin/env python3
"""Extract readable text from the War In Middle Earth WHDLoad archive."""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

try:
    from extract_graphics import AmigaOFSImage, load_lha_member, parse_resource_fork
except ModuleNotFoundError:
    from tools.extract_graphics import AmigaOFSImage, load_lha_member, parse_resource_fork


TEXT_RESOURCE_FILES = {
    "disk1": ("WarInMiddleEarth/data/Disk.1", ("AText.res",)),
    "disk2": ("WarInMiddleEarth/data/Disk.2", ("BScene.res",)),
}

EXECUTABLE_MEMBER = "WarInMiddleEarth/data/Disk.1"
EXECUTABLE_FILE = "WarInMiddleEarth"

ARCHIVE_TEXT_MEMBERS = (
    "WarInMiddleEarth/ReadMe",
    "WarInMiddleEarth/Hints",
    "WarInMiddleEarth/Docs",
)


@dataclass(frozen=True)
class DecodedText:
    text: str
    warnings: tuple[str, ...]


def decode_cstr_payload(data: bytes) -> DecodedText:
    """Decode CSTR payloads, including the game's styled text command bytes.

    Most CSTR resources are plain NUL-terminated Latin-1 strings. A few long
    story resources carry a four-byte header plus inline style/spacing commands.
    The visible text convention observed in those styled strings is:
      ff XX YY -> visible doubled character XX XX, with YY as a control byte.
      high-bit XX YY -> style/position command, not visible text.
    """

    warnings: list[str] = []
    offset = 0
    if len(data) >= 6 and data[0:2] == b"\x00\x00":
        declared = int.from_bytes(data[2:4], "big")
        if declared >= len(data) or declared == len(data):
            offset = 4
            warnings.append(f"skipped styled-text header 0x{declared:04x}")
            if offset < len(data) and data[offset] in (0x0B, 0x5C):
                offset += 1
                warnings.append("skipped styled-text leading control byte")

    output: list[str] = []
    while offset < len(data):
        byte = data[offset]

        if byte == 0:
            break

        if byte == 0xFF and offset + 2 < len(data):
            repeated = data[offset + 1]
            if 32 <= repeated <= 126:
                output.append(chr(repeated))
                output.append(chr(repeated))
                offset += 3
                warnings.append("expanded 0xff doubled-character command")
                continue

        if byte >= 0x80:
            if offset + 2 < len(data) and data[offset + 1] == 0x20 and data[offset + 2] < 0x80:
                offset += 3
            else:
                offset += 1
            warnings.append("skipped styled-text command byte")
            continue

        if byte in (9, 10, 13) or 32 <= byte <= 126:
            output.append(chr(byte))
        elif byte not in (1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 14, 15, 16):
            warnings.append(f"skipped control byte 0x{byte:02x}")

        offset += 1

    text = "".join(output).replace("\r\n", "\n").replace("\r", "\n")
    return DecodedText(text=text.rstrip("\x00"), warnings=tuple(sorted(set(warnings))))


def looks_like_text(value: str) -> bool:
    stripped = value.strip()
    if len(stripped) < 4:
        return False
    alpha_count = sum(char.isalpha() for char in stripped)
    if alpha_count < 3:
        return False
    if stripped in {"HyIMAGN", "HyFRMLN", "HyMMAPN", "HyCHARN", "HyCSTRN"}:
        return False
    opcode_fragments = (
        "DXO",
        "FXO",
        "HXO",
        "LXO",
        "NuNU",
        "POH",
        "RXO",
        "XOB",
        "XOH",
        "XOJ",
        "XOR",
        "jXO",
        "pPO",
    )
    if any(fragment in stripped for fragment in opcode_fragments):
        return False

    compact = stripped.replace(".", "").replace("!", "").replace("?", "").replace("-", "")
    if " " in stripped:
        words = [word.strip(".,;:!?\"'()/-") for word in stripped.split()]
        if len(stripped) <= 6:
            for word in words:
                if len(word) == 1 and word not in {"a", "A", "I"}:
                    return False
                if len(word) > 1 and not (word.islower() or word.istitle() or word.isupper()):
                    return False

    if " " not in stripped:
        if ":" in stripped and "." in stripped:
            return True
        if "/" in stripped:
            return False
        if stripped.endswith(".RES"):
            return True
        if compact.isalpha():
            return compact.islower() or compact.istitle() or compact.isupper()
        return False

    if alpha_count / len(stripped) < 0.45:
        return False
    return True


def extract_embedded_strings(data: bytes, min_length: int = 4) -> list[dict]:
    strings: list[dict] = []
    pattern = rb"[A-Za-z][A-Za-z0-9 ,.;:!?\'\"()/:-]{" + str(min_length - 1).encode("ascii") + rb",}"
    for match in re.finditer(pattern, data):
        text = match.group().decode("latin1").strip()
        if looks_like_text(text):
            strings.append(
                {
                    "offset": match.start(),
                    "offset_hex": f"0x{match.start():x}",
                    "length": len(match.group()),
                    "text": text,
                }
            )
    return strings


def write_markdown(resource_records: list[dict], executable_strings: list[dict], output_path: Path) -> None:
    lines = ["# War In Middle Earth Text Dump", ""]
    lines.append("## CSTR Resources")
    lines.append("")
    for record in resource_records:
        lines.append(f"### {record['source_file']} CSTR {record['id']}")
        lines.append("")
        lines.append(record["text"])
        lines.append("")

    lines.append("## Executable Embedded Strings")
    lines.append("")
    lines.append("These are heuristic printable strings found in the main executable.")
    lines.append("")
    for record in executable_strings:
        lines.append(f"- `{record['offset_hex']}` {record['text']}")
    lines.append("")
    output_path.write_text("\n".join(lines), encoding="utf-8")


def extract_text_archive(archive: Path, output_dir: Path) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)

    resource_records: list[dict] = []
    for disk_name, (member_name, resource_names) in TEXT_RESOURCE_FILES.items():
        disk = AmigaOFSImage(load_lha_member(archive, member_name))
        for resource_name in resource_names:
            fork = parse_resource_fork(disk.read_file(resource_name))
            for resource in fork.by_type("CSTR"):
                decoded = decode_cstr_payload(resource.data)
                resource_records.append(
                    {
                        "disk": disk_name,
                        "source_member": member_name,
                        "source_file": resource_name,
                        "type": resource.type_code,
                        "id": resource.resource_id,
                        "name": resource.name,
                        "length": len(resource.data),
                        "text": decoded.text,
                        "raw_hex": resource.data.hex(" "),
                        "warnings": list(decoded.warnings),
                    }
                )

    executable_disk = AmigaOFSImage(load_lha_member(archive, EXECUTABLE_MEMBER))
    executable_data = executable_disk.read_file(EXECUTABLE_FILE)
    executable_strings = extract_embedded_strings(executable_data)

    archive_texts = []
    for member in ARCHIVE_TEXT_MEMBERS:
        try:
            payload = load_lha_member(archive, member)
        except Exception as exc:  # noqa: BLE001 - keep extraction best-effort
            archive_texts.append({"member": member, "status": "warning", "warning": str(exc)})
            continue
        archive_texts.append(
            {
                "member": member,
                "status": "decoded",
                "length": len(payload),
                "text": payload.decode("latin1", errors="replace").replace("\r\n", "\n").replace("\r", "\n"),
            }
        )

    manifest = {
        "archive": str(archive),
        "summary": {
            "cstr_resources": len(resource_records),
            "executable_strings": len(executable_strings),
            "archive_text_members": len(archive_texts),
        },
        "outputs": {
            "resources_json": "resources.json",
            "executable_strings_json": "executable_strings.json",
            "archive_text_json": "archive_text.json",
            "text_markdown": "text_dump.md",
        },
        "notes": [
            "CSTR resources are exact resource payloads with a readable decode and raw byte hex.",
            "Executable strings are heuristic printable runs from the main executable, not structured resources.",
            "ReadMe, Hints, and Docs are archive/manual text, separated from in-game resource text.",
        ],
    }

    (output_dir / "resources.json").write_text(json.dumps(resource_records, indent=2, sort_keys=True), encoding="utf-8")
    (output_dir / "executable_strings.json").write_text(
        json.dumps(executable_strings, indent=2, sort_keys=True), encoding="utf-8"
    )
    (output_dir / "archive_text.json").write_text(json.dumps(archive_texts, indent=2, sort_keys=True), encoding="utf-8")
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    write_markdown(resource_records, executable_strings, output_dir / "text_dump.md")
    return manifest


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path, help="Path to WarInMiddleEarth_v1.0_0968.lha")
    parser.add_argument("--out", type=Path, default=Path("extracted_text"), help="Output directory")
    return parser


def main(argv: Iterable[str] | None = None) -> int:
    args = build_arg_parser().parse_args(argv)
    manifest = extract_text_archive(args.archive, args.out)
    summary = manifest["summary"]
    print(
        "decoded {cstr_resources} CSTR resources; found {executable_strings} executable strings; "
        "wrote outputs to {out}".format(**summary, out=args.out)
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
