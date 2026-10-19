// Reads a Finding: one file in docs/findings/ per fact about how the original
// game worked, or per Lesson about the analysis, as docs/findings/README.md
// describes.
//
//   ---
//   kind: fact
//   topic: movement
//   confidence: confirmed
//   sources:
//     - disasm:0x01a2c4
//     - observed:hobbiton-to-bree
//   issue: 5
//   supersedes: movement-hobbit-pace-guess
//   ---
//   **Hobbits travel at half a Wizard's pace.** The evidence and detail.

export const KINDS = ['fact', 'lesson'] as const;

// The chapters of the findings document, in the order it prints them.
export const TOPICS = [
  'map',
  'places',
  'forces',
  'movement',
  'time',
  'combat',
  'ai',
  'objects',
  'mobilisation',
  'ui',
  'graphics',
  'sound',
  'data-formats',
  'executable',
  'analysis'
] as const;

// From least to most certain is provisional, documented, observed, confirmed.
export const CONFIDENCES = [
  'provisional',
  'documented',
  'observed',
  'confirmed'
] as const;

// The kinds of evidence a source can be, as `<kind>:<reference>`.
export const SOURCE_KINDS = [
  'manual',
  'observed',
  'resource',
  'disasm',
  'strings',
  'tool',
  'iigs'
] as const;

export type Kind = (typeof KINDS)[number];
export type Topic = (typeof TOPICS)[number];
export type Confidence = (typeof CONFIDENCES)[number];

export type Finding = {
  body: string;
  confidence: Confidence;
  headline: string;
  issue?: number | undefined;
  kind: Kind;
  sources: string[];
  supersedes?: string | undefined;
  topic: Topic;
};

const FRONTMATTER = /^---\n(?<head>[\S\s]*?)\n---\n(?<body>[\S\s]*)$/;
const SCALARS = new Set([
  'kind',
  'topic',
  'confidence',
  'issue',
  'supersedes'
]);
const HEADLINE = /^\*\*(?<headline>[^*]+?)\*\*/;
export const SLUG = /^[a-z\d]+(?:-[a-z\d]+)*$/;

const oneOf = (
  errors: string[],
  key: string,
  value: string | undefined,
  allowed: readonly string[]
): void => {
  if (value === undefined) {
    errors.push(`"${key}" is missing`);
  } else if (!allowed.includes(value)) {
    errors.push(`unknown ${key} "${value}"; use one of ${allowed.join(', ')}`);
  }
};

export const parseFinding = (
  text: string
): { errors: string[] } | { finding: Finding } => {
  const match = FRONTMATTER.exec(text.replaceAll('\r\n', '\n'));
  if (!match?.groups) {
    return { errors: ['it must start with a "---" frontmatter block'] };
  }
  const errors: string[] = [];
  const fields = new Map<string, string>();
  const sources: string[] = [];
  let inSources = false;
  for (const line of match.groups.head!.split('\n')) {
    const item = /^ {2}- (?<value>\S.*?)\s*$/.exec(line);
    if (item) {
      if (inSources) {
        sources.push(item.groups!.value!);
      } else {
        errors.push(`"${line}" is a list item outside "sources"`);
      }
      continue;
    }
    inSources = false;
    const field = /^(?<key>[a-z]+):\s*(?<value>.*?)\s*$/.exec(line);
    const key = field?.groups?.key;
    if (key === undefined) {
      errors.push(`"${line}" isn't "key: value"`);
    } else if (key === 'sources') {
      inSources = true;
      if (field!.groups!.value !== '') {
        errors.push('"sources" takes a list, one "  - kind:reference" a line');
      }
    } else if (SCALARS.has(key)) {
      fields.set(key, field!.groups!.value!);
    } else {
      errors.push(`unknown key "${key}"`);
    }
  }

  const kind = fields.get('kind');
  const topic = fields.get('topic');
  const confidence = fields.get('confidence');
  const issue = fields.get('issue');
  const supersedes = fields.get('supersedes');
  oneOf(errors, 'kind', kind, KINDS);
  oneOf(errors, 'topic', topic, TOPICS);
  oneOf(errors, 'confidence', confidence, CONFIDENCES);
  if (kind === 'lesson' && topic !== undefined && topic !== 'analysis') {
    errors.push(`a lesson's topic is analysis, not ${topic}`);
  }
  if (sources.length === 0) {
    errors.push('"sources" needs at least one source');
  }
  for (const source of sources) {
    const sourceKind = /^(?<kind>[a-z]+):\S/.exec(source)?.groups?.kind;
    if (
      sourceKind === undefined ||
      !(SOURCE_KINDS as readonly string[]).includes(sourceKind)
    ) {
      errors.push(
        `source "${source}" isn't "kind:reference" with a kind of ${SOURCE_KINDS.join(', ')}`
      );
    }
  }
  if (issue !== undefined && !/^\d+$/.test(issue)) {
    errors.push(`"issue" must be an issue number, not "${issue}"`);
  }
  if (supersedes !== undefined && !SLUG.test(supersedes)) {
    errors.push(`"supersedes" must be a finding's slug, not "${supersedes}"`);
  }
  const body = match.groups.body!.trim();
  const headline = HEADLINE.exec(body)?.groups?.headline;
  if (headline === undefined) {
    errors.push('the text must open with a bold "**Headline sentence.**"');
  }
  if (errors.length > 0) {
    return { errors };
  }
  return {
    finding: {
      body,
      confidence: confidence as Confidence,
      headline: headline!,
      issue: issue === undefined ? undefined : Number(issue),
      kind: kind as Kind,
      sources,
      supersedes,
      topic: topic as Topic
    }
  };
};
