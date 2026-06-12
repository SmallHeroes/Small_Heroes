/**
 * Fail-closed chip safety scan — metadata + prose + powerCard.
 */

import {
  BARE_PIPE_CHIP_RE,
  scanExposedChildGenderInMarkdown,
  stripValidGenderChipsForBarePipeScan,
} from '../story-gen-v3/artifact-token-scan';

export type ChipSafetyReason =
  | 'blacklisted_unsafe_chip'
  | 'mixed_malformed_chip'
  | 'duplicate_suffix_artifact'
  | 'remaining_slash_gender'
  | 'partial_suffix_remaining'
  | 'phrase_level_chip'
  | 'bare_pipe_gender'
  | 'exposed_child_gender';

export interface ChipSafetyHit {
  page: number;
  field: 'metadata' | 'prose' | 'powerCard';
  token: string;
  reason: ChipSafetyReason;
  context: string;
}

export interface ChipSafetyReport {
  status: 'deterministic_chip_safety';
  hits: ChipSafetyHit[];
  hitCount: number;
  advisoryFail: boolean;
}

const BLACKLISTED_CHIP_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\{מחייך\|מחייךת\}/, label: '{מחייך|מחייךת}' },
  { pattern: /\{מושך\|מושךת\}/, label: '{מושך|מושךת}' },
  { pattern: /\{שלו\|שלוה\}/, label: '{שלו|שלוה}' },
  { pattern: /\{מַדְגִּים\|מַדְגִּיםה\}/, label: '{מַדְגִּים|מַדְגִּיםה}' },
  { pattern: /\{יִסְגֹּר\|יִסְגֹּרת\}/, label: '{יִסְגֹּר|יִסְגֹּרת}' },
  { pattern: /\{יִפְסְפֵּס\|יִפְסְפֵּסת\}/, label: '{יִפְסְפֵּס|יִפְסְפֵּסת}' },
  { pattern: /\{וְלוֹחֵשׁ\|וְלוֹחֵשׁת\}/, label: '{וְלוֹחֵשׁ|וְלוֹחֵשׁת}' },
  { pattern: /\{מַרְכִּין\|מַרְכִּיןה\}/, label: '{מַרְכִּין|מַרְכִּיןה}' },
  { pattern: /מניח\{\s*יד\|ה\}/, label: 'מניח{ יד|ה}' },
];

const MIXED_MALFORMED_CHIP = /[\u0590-\u05FF]{2,}\{\s*[\u0590-\u05FF]+\|[^}]+\}/;
const DUPLICATE_SUFFIX_ARTIFACT = /\{[^{}]+\}[\u0590-\u05FF]{2,}/;
const REMAINING_SLASH_GENDER =
  /[\u0590-\u05FF][\u0590-\u05FF\u05B0-\u05C7]*\/(?:ת|ה|[\u0590-\u05FF][\u0590-\u05FF\u05B0-\u05C7]*)/;
const PARTIAL_SUFFIX_REMAINING = /[\u0590-\u05FF]{2,}\{[תה]\}/;
const CHIP_PAIR_RE = /\{([^{}|]+)\|([^{}|]+)\}/g;

function frontmatterBlock(markdown: string): string {
  const idx = markdown.search(/\r?\n--- Page 1 ---/);
  return idx >= 0 ? markdown.slice(0, idx) : markdown;
}

function proseBlocks(markdown: string): Array<{ page: number; text: string }> {
  const idx = markdown.search(/\r?\n--- Page 1 ---/);
  const pageSection = idx >= 0 ? markdown.slice(idx) : '';
  const blocks: Array<{ page: number; text: string }> = [];
  const re =
    /\r?\n--- Page (\d+) ---\r?\n([\s\S]*?)(?=\r?\n--- Page \d+ ---|\r?\nWORD_COUNT:|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pageSection)) !== null) {
    const body = (m[2] ?? '').replace(/imageDirection\s*:[\s\S]*/gi, '').trim();
    blocks.push({ page: parseInt(m[1], 10), text: body });
  }
  return blocks;
}

function scanText(
  text: string,
  page: number,
  field: ChipSafetyHit['field'],
  hits: ChipSafetyHit[]
): void {
  for (const { pattern, label } of BLACKLISTED_CHIP_PATTERNS) {
    if (pattern.test(text)) {
      hits.push({
        page,
        field,
        token: label,
        reason: 'blacklisted_unsafe_chip',
        context: 'Known unsafe chip from regression blacklist',
      });
      pattern.lastIndex = 0;
    }
  }

  if (MIXED_MALFORMED_CHIP.test(text)) {
    const token = text.match(MIXED_MALFORMED_CHIP)?.[0] ?? 'mixed_malformed_chip';
    hits.push({
      page,
      field,
      token,
      reason: 'mixed_malformed_chip',
      context: 'Word glued to partial brace chip',
    });
  }

  let dup: RegExpExecArray | null;
  const dupRe = new RegExp(DUPLICATE_SUFFIX_ARTIFACT.source, 'g');
  while ((dup = dupRe.exec(text)) !== null) {
    hits.push({
      page,
      field,
      token: dup[0],
      reason: 'duplicate_suffix_artifact',
      context: 'Hebrew text duplicated immediately after closing chip brace',
    });
  }

  let slash: RegExpExecArray | null;
  const slashRe = new RegExp(REMAINING_SLASH_GENDER.source, 'g');
  while ((slash = slashRe.exec(text)) !== null) {
    hits.push({
      page,
      field,
      token: slash[0],
      reason: 'remaining_slash_gender',
      context: 'Unresolved Hebrew gender slash form',
    });
  }

  let partial: RegExpExecArray | null;
  const partialRe = new RegExp(PARTIAL_SUFFIX_REMAINING.source, 'g');
  while ((partial = partialRe.exec(text)) !== null) {
    hits.push({
      page,
      field,
      token: partial[0],
      reason: 'partial_suffix_remaining',
      context: 'Unresolved partial suffix chip {ת}/{ה}',
    });
  }

  const withoutValidChips = stripValidGenderChipsForBarePipeScan(text);
  let barePipe: RegExpExecArray | null;
  const barePipeRe = new RegExp(BARE_PIPE_CHIP_RE.source, 'g');
  while ((barePipe = barePipeRe.exec(withoutValidChips)) !== null) {
    hits.push({
      page,
      field,
      token: barePipe[0],
      reason: 'bare_pipe_gender',
      context: 'Bare pipe gender chip — must be full {male|female} curly form',
    });
  }

  const withoutDouble = text.replace(/\{\{[^}]+\}\}/g, ' ');
  const chipRe = new RegExp(CHIP_PAIR_RE.source, 'g');
  let chip: RegExpExecArray | null;
  while ((chip = chipRe.exec(withoutDouble)) !== null) {
    const full = chip[0];
    const left = chip[1].trim();
    const right = chip[2].trim();
    if (!left || !right) {
      hits.push({
        page,
        field,
        token: full,
        reason: 'mixed_malformed_chip',
        context: 'Empty chip side',
      });
    }
    if (left.includes(' ו') && right.includes(' ו')) {
      hits.push({
        page,
        field,
        token: full,
        reason: 'phrase_level_chip',
        context: 'Phrase-level chip — split into per-verb {male|female} chips',
      });
    }
  }
}

export function scanChipSafety(markdown: string): ChipSafetyReport {
  const hits: ChipSafetyHit[] = [];
  const metadata = frontmatterBlock(markdown);
  scanText(metadata, 0, 'metadata', hits);

  for (const { page, text } of proseBlocks(markdown)) {
    scanText(text, page, 'prose', hits);
  }

  for (const hit of scanExposedChildGenderInMarkdown(markdown).hits) {
    hits.push({
      page: hit.page,
      field: 'prose',
      token: hit.match,
      reason: 'exposed_child_gender',
      context: `Bare ${hit.match} on {{childName}} line — use {male|female} chip`,
    });
  }

  const deduped = hits.filter(
    (h, i, arr) =>
      arr.findIndex(
        (x) => x.page === h.page && x.token === h.token && x.reason === h.reason
      ) === i
  );

  return {
    status: 'deterministic_chip_safety',
    hits: deduped,
    hitCount: deduped.length,
    advisoryFail: deduped.length > 0,
  };
}
