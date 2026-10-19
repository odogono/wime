#!/usr/bin/env bun
// Checks the Findings in docs/findings/ and builds the readable document from
// them, as docs/findings/README.md describes.
//
//   bun tools/findings/findings.ts check          validate every Finding, its
//       `supersedes` and every `finding:<slug>` a Spec cites
//   bun tools/findings/findings.ts build [FILE]   write the document to FILE,
//       or print it
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { SLUG, TOPICS, parseFinding, type Finding, type Topic } from './finding';

const ROOT = resolve(import.meta.dir, '../..');
const DIR = join(ROOT, 'docs/findings');
const TOPIC_DIR = join(DIR, 'topics');
const SPECS = join(ROOT, 'docs/spec');

export type Entry = Finding & { slug: string };

const CITATION = /\bfinding:(?<slug>[a-z\d]+(?:-[a-z\d]+)*)/g;

// Problems that span Findings: a `supersedes` naming a missing Finding or
// itself, two Findings superseding the same one, and Specs citing a missing
// Finding.
export const crossCheck = (
  entries: Entry[],
  specs: { path: string; text: string }[]
): string[] => {
  const problems: string[] = [];
  const slugs = new Set(entries.map(entry => entry.slug));
  const supersededBy = new Map<string, string>();
  for (const { slug, supersedes } of entries) {
    if (supersedes === undefined) {
      continue;
    }
    if (supersedes === slug) {
      problems.push(`${slug}: supersedes itself`);
    } else if (!slugs.has(supersedes)) {
      problems.push(`${slug}: supersedes "${supersedes}", which doesn't exist`);
    } else if (supersededBy.has(supersedes)) {
      problems.push(
        `${slug}: "${supersedes}" is already superseded by ${supersededBy.get(supersedes)}`
      );
    } else {
      supersededBy.set(supersedes, slug);
    }
  }
  for (const { path, text } of specs) {
    for (const match of text.matchAll(CITATION)) {
      const cited = match.groups!.slug!;
      if (!slugs.has(cited)) {
        problems.push(`${path}: cites finding:${cited}, which doesn't exist`);
      }
    }
  }
  return problems;
};

const TITLES: Record<Topic, string> = {
  ai: 'The computer opponent',
  analysis: 'Lessons from the analysis',
  combat: 'Combat',
  'data-formats': 'Data formats',
  executable: 'The executable',
  forces: 'Forces',
  graphics: 'Graphics',
  map: 'The map',
  mobilisation: 'Mobilisation',
  movement: 'Movement',
  objects: 'Objects',
  places: 'Places',
  sound: 'Sound',
  time: 'Time',
  ui: 'The interface'
};

const footnote = (entry: Entry): string =>
  `[^${entry.slug}]: \`${entry.slug}\`, ${entry.confidence}: ${entry.sources.join(', ')}${entry.issue === undefined ? '' : ` (#${entry.issue})`}`;

// Footnotes the headline: the body opens with `**Headline.**`.
const withFootnote = (entry: Entry): string =>
  entry.body.replace(/^(\*\*[^*]+\*\*)/, `$1[^${entry.slug}]`);

// The document: the introduction, then a chapter per topic that has current
// Findings, each opening with its intro, facts ordered by headline. Superseded
// Findings close the document, so their history stays readable.
export const renderDocument = (
  entries: Entry[],
  intros: Partial<Record<Topic | 'introduction', string>>
): string => {
  const superseded = new Set(
    entries.flatMap(entry => (entry.supersedes ? [entry.supersedes] : []))
  );
  const bySlug = new Map(entries.map(entry => [entry.slug, entry]));
  const current = entries.filter(entry => !superseded.has(entry.slug));
  const parts = ['# How War in Middle Earth worked'];
  if (intros.introduction) {
    parts.push(intros.introduction);
  }
  const notes: string[] = [];
  for (const topic of TOPICS) {
    const chapter = current
      .filter(entry => entry.topic === topic)
      .sort((a, b) => a.headline.localeCompare(b.headline));
    if (chapter.length === 0) {
      continue;
    }
    parts.push(`## ${TITLES[topic]}`);
    if (intros[topic]) {
      parts.push(intros[topic]!);
    }
    for (const entry of chapter) {
      const replaced = entry.supersedes ? bySlug.get(entry.supersedes) : undefined;
      parts.push(
        withFootnote(entry) +
          (replaced
            ? `\n\n_This replaces an earlier finding: "${replaced.headline}"_`
            : '')
      );
      notes.push(footnote(entry));
    }
  }
  const old = entries
    .filter(entry => superseded.has(entry.slug))
    .sort((a, b) => a.headline.localeCompare(b.headline));
  if (old.length > 0) {
    parts.push(
      '## Superseded findings',
      'Earlier findings that later evidence overturned, kept as the record of what was believed.'
    );
    for (const entry of old) {
      parts.push(withFootnote(entry));
      notes.push(footnote(entry));
    }
  }
  return `${[...parts, notes.join('\n')].join('\n\n')}\n`;
};

const readEntries = (): { entries: Entry[]; problems: string[] } => {
  const entries: Entry[] = [];
  const problems: string[] = [];
  for (const name of readdirSync(DIR).sort()) {
    if (!name.endsWith('.md') || name === 'README.md') {
      continue;
    }
    const slug = name.slice(0, -3);
    if (!SLUG.test(slug)) {
      problems.push(`docs/findings/${name}: the name must be a kebab-case slug`);
    }
    const result = parseFinding(readFileSync(join(DIR, name), 'utf8'));
    if ('errors' in result) {
      problems.push(...result.errors.map(error => `docs/findings/${name}: ${error}`));
    } else {
      entries.push({ ...result.finding, slug });
    }
  }
  return { entries, problems };
};

const walk = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap(item =>
        item.isDirectory()
          ? walk(join(dir, item.name))
          : item.name.endsWith('.md')
            ? [join(dir, item.name)]
            : []
      )
    : [];

// A topic intro's text, without the file's own `#` heading.
const readIntros = (): Partial<Record<Topic | 'introduction', string>> => {
  const intros: Partial<Record<Topic | 'introduction', string>> = {};
  for (const name of ['introduction', ...TOPICS]) {
    const path = join(TOPIC_DIR, `${name}.md`);
    if (existsSync(path)) {
      const text = readFileSync(path, 'utf8').replace(/^# .*\n+/, '').trim();
      if (text !== '') {
        intros[name as Topic | 'introduction'] = text;
      }
    }
  }
  return intros;
};

if (import.meta.main) {
  const [mode, out] = process.argv.slice(2);
  const { entries, problems } = readEntries();
  if (mode === 'check') {
    const specs = walk(SPECS).map(path => ({
      path: relative(ROOT, path),
      text: readFileSync(path, 'utf8')
    }));
    problems.push(...crossCheck(entries, specs));
    for (const problem of problems) {
      console.error(`findings: ${problem}`);
    }
    if (problems.length > 0) {
      console.error('See docs/findings/README.md.');
      process.exit(1);
    }
    console.log(`findings: ${entries.length} findings are valid`);
  } else if (mode === 'build') {
    if (problems.length > 0) {
      for (const problem of problems) {
        console.error(`findings: ${problem}`);
      }
      process.exit(1);
    }
    const document = renderDocument(entries, readIntros());
    if (out) {
      const path = resolve(out);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, document);
      console.log(`findings: wrote ${entries.length} findings to ${relative(ROOT, path)}`);
    } else {
      process.stdout.write(document);
    }
  } else {
    console.error('usage: bun tools/findings/findings.ts check | build [FILE]');
    process.exit(2);
  }
}
