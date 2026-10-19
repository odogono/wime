#!/usr/bin/env bun
// Extract readable text from the War In Middle Earth WHDLoad archive.
//
//   bun tools/extract-text.ts [ARCHIVE] [--out DIR]
//
// ARCHIVE defaults to the Reference Build in artifacts/amiga/. Outputs go
// to extracted_text/ by default.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import {
  AmigaOFSImage,
  DEFAULT_ARCHIVE,
  loadLhaMember,
  parseResourceFork,
  stringifySortedJson
} from './extract-graphics';

export const TEXT_RESOURCE_FILES: Record<string, [string, string[]]> = {
  disk1: ['WarInMiddleEarth/data/Disk.1', ['AText.res']],
  disk2: ['WarInMiddleEarth/data/Disk.2', ['BScene.res']]
};

export const EXECUTABLE_MEMBER = 'WarInMiddleEarth/data/Disk.1';
export const EXECUTABLE_FILE = 'WarInMiddleEarth';

export const ARCHIVE_TEXT_MEMBERS = [
  'WarInMiddleEarth/ReadMe',
  'WarInMiddleEarth/Hints',
  'WarInMiddleEarth/Docs'
];

export type DecodedText = {
  text: string;
  warnings: string[];
};

// Decode CSTR payloads, including the game's styled text command bytes.
//
// Most CSTR resources are plain NUL-terminated Latin-1 strings. A few long
// story resources carry a four-byte header plus inline style/spacing
// commands. The visible text convention observed in those styled strings
// is:
//   ff XX YY -> visible doubled character XX XX, with YY as a control byte.
//   high-bit XX YY -> style/position command, not visible text.
export const decodeCstrPayload = (data: Uint8Array): DecodedText => {
  const warnings: string[] = [];
  let offset = 0;
  if (data.length >= 6 && data[0] === 0 && data[1] === 0) {
    const declared = (data[2]! << 8) | data[3]!;
    if (declared >= data.length || declared === data.length) {
      offset = 4;
      warnings.push(
        `skipped styled-text header 0x${declared.toString(16).padStart(4, '0')}`
      );
      if (
        offset < data.length &&
        (data[offset] === 0x0b || data[offset] === 0x5c)
      ) {
        offset += 1;
        warnings.push('skipped styled-text leading control byte');
      }
    }
  }

  const output: string[] = [];
  while (offset < data.length) {
    const byte = data[offset]!;

    if (byte === 0) {
      break;
    }

    if (byte === 0xff && offset + 2 < data.length) {
      const repeated = data[offset + 1]!;
      if (repeated >= 32 && repeated <= 126) {
        output.push(
          String.fromCharCode(repeated),
          String.fromCharCode(repeated)
        );
        offset += 3;
        warnings.push('expanded 0xff doubled-character command');
        continue;
      }
    }

    if (byte >= 0x80) {
      offset +=
        offset + 2 < data.length &&
        data[offset + 1] === 0x20 &&
        data[offset + 2]! < 0x80
          ? 3
          : 1;
      warnings.push('skipped styled-text command byte');
      continue;
    }

    if (
      byte === 9 ||
      byte === 10 ||
      byte === 13 ||
      (byte >= 32 && byte <= 126)
    ) {
      output.push(String.fromCharCode(byte));
    } else if (![1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 14, 15, 16].includes(byte)) {
      warnings.push(
        `skipped control byte 0x${byte.toString(16).padStart(2, '0')}`
      );
    }

    offset += 1;
  }

  const text = output.join('').replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  return {
    text: text.replace(/\0+$/, ''),
    warnings: [...new Set(warnings)].sort()
  };
};

const isAlpha = (char: string): boolean => /[A-Za-z]/.test(char);
const isUpper = (char: string): boolean => char >= 'A' && char <= 'Z';
const isLower = (char: string): boolean => char >= 'a' && char <= 'z';

// Python's str.islower/str.isupper/str.istitle for the ASCII text the
// string scan produces: uncased characters don't count, and titlecase
// means an uppercase letter follows an uncased one and a lowercase
// letter follows a cased one.
const isLowerText = (value: string): boolean => {
  let cased = false;
  for (const char of value) {
    if (isUpper(char)) {
      return false;
    }
    if (isLower(char)) {
      cased = true;
    }
  }
  return cased;
};

const isUpperText = (value: string): boolean => {
  let cased = false;
  for (const char of value) {
    if (isLower(char)) {
      return false;
    }
    if (isUpper(char)) {
      cased = true;
    }
  }
  return cased;
};

const isTitleText = (value: string): boolean => {
  let cased = false;
  let previousIsCased = false;
  for (const char of value) {
    if (isUpper(char)) {
      if (previousIsCased) {
        return false;
      }
      previousIsCased = true;
      cased = true;
    } else if (isLower(char)) {
      if (!previousIsCased) {
        return false;
      }
      previousIsCased = true;
      cased = true;
    } else {
      previousIsCased = false;
    }
  }
  return cased;
};

const stripChars = (value: string, chars: string): string => {
  let start = 0;
  let end = value.length;
  while (start < end && chars.includes(value[start]!)) {
    start += 1;
  }
  while (end > start && chars.includes(value[end - 1]!)) {
    end -= 1;
  }
  return value.slice(start, end);
};

export const looksLikeText = (value: string): boolean => {
  const stripped = value.trim();
  if (stripped.length < 4) {
    return false;
  }
  const alphaCount = [...stripped].filter(isAlpha).length;
  if (alphaCount < 3) {
    return false;
  }
  if (
    ['HyIMAGN', 'HyFRMLN', 'HyMMAPN', 'HyCHARN', 'HyCSTRN'].includes(stripped)
  ) {
    return false;
  }
  const opcodeFragments = [
    'DXO',
    'FXO',
    'HXO',
    'LXO',
    'NuNU',
    'POH',
    'RXO',
    'XOB',
    'XOH',
    'XOJ',
    'XOR',
    'jXO',
    'pPO'
  ];
  if (opcodeFragments.some(fragment => stripped.includes(fragment))) {
    return false;
  }

  const compact = stripped
    .replaceAll('.', '')
    .replaceAll('!', '')
    .replaceAll('?', '')
    .replaceAll('-', '');
  if (stripped.includes(' ')) {
    const words = stripped
      .split(/\s+/)
      .filter(word => word !== '')
      .map(word => stripChars(word, '.,;:!?"\'()/-'));
    if (stripped.length <= 6) {
      for (const word of words) {
        if (word.length === 1 && !['a', 'A', 'I'].includes(word)) {
          return false;
        }
        if (
          word.length > 1 &&
          !(isLowerText(word) || isTitleText(word) || isUpperText(word))
        ) {
          return false;
        }
      }
    }
  }

  if (!stripped.includes(' ')) {
    if (stripped.includes(':') && stripped.includes('.')) {
      return true;
    }
    if (stripped.includes('/')) {
      return false;
    }
    if (stripped.endsWith('.RES')) {
      return true;
    }
    if (/^[A-Za-z]+$/.test(compact) && compact.length > 0) {
      return (
        isLowerText(compact) || isTitleText(compact) || isUpperText(compact)
      );
    }
    if (compact === '') {
      // Python: ''.isalpha() is False, so this falls through to False too.
      return false;
    }
    return false;
  }

  if (alphaCount / stripped.length < 0.45) {
    return false;
  }
  return true;
};

export type EmbeddedString = {
  length: number;
  offset: number;
  offset_hex: string;
  text: string;
};

export const extractEmbeddedStrings = (
  data: Uint8Array,
  minLength: number = 4
): EmbeddedString[] => {
  const strings: EmbeddedString[] = [];
  const pattern = new RegExp(
    String.raw`[A-Za-z][A-Za-z0-9 ,.;:!?'"()/:\-]{${minLength - 1},}`,
    'g'
  );
  // Latin-1 maps bytes to code points one to one, so match indices in the
  // decoded string are byte offsets in the data.
  const text = [...data].map(byte => String.fromCharCode(byte)).join('');
  for (const match of text.matchAll(pattern)) {
    const matched = match[0];
    const stripped = matched.trim();
    if (looksLikeText(stripped)) {
      strings.push({
        length: matched.length,
        offset: match.index,
        offset_hex: `0x${match.index.toString(16)}`,
        text: stripped
      });
    }
  }
  return strings;
};

type ResourceRecord = {
  disk: string;
  id: number;
  length: number;
  name: string | null;
  raw_hex: string;
  source_file: string;
  source_member: string;
  text: string;
  type: string;
  warnings: string[];
};

type ArchiveText =
  | { member: string; status: 'warning'; warning: string }
  | { length: number; member: string; status: 'decoded'; text: string };

export type TextManifest = {
  archive: string;
  notes: string[];
  outputs: {
    archive_text_json: string;
    executable_strings_json: string;
    resources_json: string;
    text_markdown: string;
  };
  summary: {
    archive_text_members: number;
    cstr_resources: number;
    executable_strings: number;
  };
};

const spacedHex = (data: Uint8Array): string =>
  [...data].map(byte => byte.toString(16).padStart(2, '0')).join(' ');

const latin1Text = (data: Uint8Array): string =>
  [...data].map(byte => String.fromCharCode(byte)).join('');

export const writeMarkdown = (
  resourceRecords: ResourceRecord[],
  executableStrings: EmbeddedString[],
  outputPath: string
): void => {
  const lines = ['# War In Middle Earth Text Dump', ''];
  lines.push('## CSTR Resources', '');
  for (const record of resourceRecords) {
    lines.push(
      `### ${record.source_file} CSTR ${record.id}`,
      '',
      record.text,
      ''
    );
  }

  lines.push(
    '## Executable Embedded Strings',
    '',
    'These are heuristic printable strings found in the main executable.',
    ''
  );
  for (const record of executableStrings) {
    lines.push(`- \`${record.offset_hex}\` ${record.text}`);
  }
  lines.push('');
  writeFileSync(outputPath, lines.join('\n'), 'utf8');
};

export const extractTextArchive = (
  archive: string,
  outputDir: string
): TextManifest => {
  mkdirSync(outputDir, { recursive: true });

  const resourceRecords: ResourceRecord[] = [];
  for (const [diskName, [memberName, resourceNames]] of Object.entries(
    TEXT_RESOURCE_FILES
  )) {
    const disk = new AmigaOFSImage(loadLhaMember(archive, memberName));
    for (const resourceName of resourceNames) {
      const fork = parseResourceFork(disk.readFile(resourceName));
      for (const resource of fork.byType('CSTR')) {
        const decoded = decodeCstrPayload(resource.data);
        resourceRecords.push({
          disk: diskName,
          id: resource.resourceId,
          length: resource.data.length,
          name: resource.name,
          raw_hex: spacedHex(resource.data),
          source_file: resourceName,
          source_member: memberName,
          text: decoded.text,
          type: resource.typeCode,
          warnings: decoded.warnings
        });
      }
    }
  }

  const executableDisk = new AmigaOFSImage(
    loadLhaMember(archive, EXECUTABLE_MEMBER)
  );
  const executableData = executableDisk.readFile(EXECUTABLE_FILE);
  const executableStrings = extractEmbeddedStrings(executableData);

  const archiveTexts: ArchiveText[] = [];
  for (const member of ARCHIVE_TEXT_MEMBERS) {
    let payload: Uint8Array;
    try {
      payload = loadLhaMember(archive, member);
    } catch (error) {
      archiveTexts.push({
        member,
        status: 'warning',
        warning: error instanceof Error ? error.message : String(error)
      });
      continue;
    }
    archiveTexts.push({
      length: payload.length,
      member,
      status: 'decoded',
      text: latin1Text(payload).replaceAll('\r\n', '\n').replaceAll('\r', '\n')
    });
  }

  const manifest: TextManifest = {
    archive,
    notes: [
      'CSTR resources are exact resource payloads with a readable decode and raw byte hex.',
      'Executable strings are heuristic printable runs from the main executable, not structured resources.',
      'ReadMe, Hints, and Docs are archive/manual text, separated from in-game resource text.'
    ],
    outputs: {
      archive_text_json: 'archive_text.json',
      executable_strings_json: 'executable_strings.json',
      resources_json: 'resources.json',
      text_markdown: 'text_dump.md'
    },
    summary: {
      archive_text_members: archiveTexts.length,
      cstr_resources: resourceRecords.length,
      executable_strings: executableStrings.length
    }
  };

  writeFileSync(
    join(outputDir, 'resources.json'),
    stringifySortedJson(resourceRecords),
    'utf8'
  );
  writeFileSync(
    join(outputDir, 'executable_strings.json'),
    stringifySortedJson(executableStrings),
    'utf8'
  );
  writeFileSync(
    join(outputDir, 'archive_text.json'),
    stringifySortedJson(archiveTexts),
    'utf8'
  );
  writeFileSync(
    join(outputDir, 'manifest.json'),
    stringifySortedJson(manifest),
    'utf8'
  );
  writeMarkdown(
    resourceRecords,
    executableStrings,
    join(outputDir, 'text_dump.md')
  );
  return manifest;
};

export const main = (argv: string[] = process.argv.slice(2)): number => {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    args: argv,
    options: { out: { default: 'extracted_text', type: 'string' } }
  });
  const archive = positionals[0] ?? DEFAULT_ARCHIVE;
  const out = values.out ?? 'extracted_text';
  const manifest = extractTextArchive(archive, out);
  const summary = manifest.summary;
  console.log(
    `decoded ${summary.cstr_resources} CSTR resources; found ${summary.executable_strings} executable strings; wrote outputs to ${out}`
  );
  return 0;
};

if (import.meta.main) {
  process.exit(main());
}
