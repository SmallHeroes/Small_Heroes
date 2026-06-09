/**
 * Strict read-back validation — must read real story.md bytes from disk.
 */

import fs from 'fs';

import { pageProseOnly, parseStoryPages } from '../story-gen/story-page-utils';
import {
  scanRawArtifactTokensInMarkdown,
  scanSlashChipsInMarkdown,
} from './artifact-token-scan';
import { scanSuffixChipsInMarkdown } from './suffix-chip-scan';
import type { HebrewReadAloudReadBackValidation } from './hebrew-read-aloud-types';

export const DINI_POPCORN_P12_REQUIRED_MARKERS = [
  '"אחרי הסרט."',
  'קרצה ל{{childName}}',
  'דיני לא קמה',
  'גרעין אחד קפץ בשקט',
] as const;

export const KOKO_TRANSITION_P12_REQUIRED_MARKERS = [
  'פס הגשר',
  'שלמה',
  'טביעת כף',
] as const;

export type StoryReadBackProfile =
  | 'dini_popcorn'
  | 'koko_transition'
  | 'confidence_generic'
  | 'custom';

export function endingMarkersForProfile(profile: StoryReadBackProfile): readonly string[] {
  if (profile === 'koko_transition') return KOKO_TRANSITION_P12_REQUIRED_MARKERS;
  if (profile === 'confidence_generic') return [];
  if (profile === 'dini_popcorn') return DINI_POPCORN_P12_REQUIRED_MARKERS;
  return DINI_POPCORN_P12_REQUIRED_MARKERS;
}

export interface StoryReadBackValidationResult extends HebrewReadAloudReadBackValidation {
  failures: string[];
  fileByteLength: number;
  readFromDisk: boolean;
  rawArtifactTokenCount?: number;
  slashChipCount?: number;
  suffixChipCount?: number;
  derivedP12Markers?: string[];
}

/** Verifiable substrings from final page prose (must appear contiguously in story.md). */
export function deriveP12MarkersFromProse(p12Prose: string): string[] {
  const plain = stripNiqqud(
    p12Prose.replace(/\{\{childName\}\}/g, '').replace(/\{[^{}|]+\|[^{}]+\}/g, '')
  );
  const markers = new Set<string>();

  for (const m of plain.matchAll(/"([^"]{6,80})"/g)) {
    const q = m[1]!.trim();
    if (q.length >= 6) markers.add(q);
  }

  const anchorPhrases = [
    'הציור הישן',
    'הקיר החדש',
    'פס הגשר',
    'טביעת כף',
    'סוף־סוף שלמה',
    'עכשיו אני שלמה על הקיר הזה',
  ];
  for (const phrase of anchorPhrases) {
    if (plain.includes(stripNiqqud(phrase))) markers.add(phrase);
  }

  return [...markers].slice(0, 6);
}

export function loadDerivedP12Markers(
  storyPagesPath?: string,
  finalPage?: number
): string[] | undefined {
  if (!storyPagesPath || !fs.existsSync(storyPagesPath)) return undefined;
  try {
    const pages = JSON.parse(fs.readFileSync(storyPagesPath, 'utf8')) as Array<{
      page: number;
      prose?: string;
    }>;
    const lastNum = finalPage ?? Math.max(...pages.map((p) => p.page), 12);
    const finalProse = pages.find((p) => p.page === lastNum)?.prose ?? '';
    if (!finalProse.trim()) return undefined;
    return deriveP12MarkersFromProse(finalProse);
  } catch {
    return undefined;
  }
}

function finalProseLine(text: string, pageCount: number): string | null {
  const p12 = parseStoryPages(text).find((p) => p.page === pageCount);
  if (!p12) return null;
  const lines = pageProseOnly(p12.body)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines[lines.length - 1] ?? null;
}

function stripNiqqud(text: string): string {
  return text.replace(/[\u0591-\u05C7]/g, '');
}

function isValidUtf8Buffer(buf: Buffer): boolean {
  try {
    const decoded = buf.toString('utf8');
    if (decoded.includes('\uFFFD')) return false;
    const reencoded = Buffer.from(decoded, 'utf8');
    return reencoded.equals(buf);
  } catch {
    return false;
  }
}

function hasTruncatedP12Ending(text: string): boolean {
  if (/\u05D3\u05B4\u05BC\u05D9\u05B0\u05BC\u05E0\u05B4\u05B4\u05D9 \u05DC\u05D0 \u05E7\u05DE\u05D4\.\s*\n\u05D4\s*$/m.test(text)) {
    return true;
  }
  if (/דיני לא קמה\.\s*\nה\s*$/m.test(stripNiqqud(text))) {
    return true;
  }
  const tail = text.trimEnd().slice(-40);
  if (tail.endsWith('ה') && !tail.includes('אחרי הסרט')) {
    return true;
  }
  return false;
}

export function readStoryMdBytesFromDisk(storyMarkdownPath: string): {
  buffer: Buffer;
  text: string;
} {
  const buffer = fs.readFileSync(storyMarkdownPath);
  if (!buffer.length) {
    throw new Error(`story.md is empty: ${storyMarkdownPath}`);
  }
  return { buffer, text: buffer.toString('utf8') };
}

export function validateStoryMdReadBack(args: {
  storyMarkdownPath: string;
  expectedPageCount?: number;
  requiredEndingMarkers?: readonly string[];
  endingProfile?: StoryReadBackProfile;
  storyPagesPath?: string;
  appliedFixes?: Array<{ after: string }>;
  badLinesRemoved?: string[];
}): StoryReadBackValidationResult {
  const failures: string[] = [];
  const expectedPageCount = args.expectedPageCount ?? 12;
  const profile = args.endingProfile ?? 'dini_popcorn';
  const derived = loadDerivedP12Markers(args.storyPagesPath, expectedPageCount);
  const markers =
    args.requiredEndingMarkers ??
    derived ??
    (profile === 'koko_transition' ? [] : endingMarkersForProfile(profile));
  const isDiniPopcorn = profile === 'dini_popcorn' && !args.requiredEndingMarkers && !derived;
  const derivedP12Markers = derived;

  let buffer: Buffer;
  let text: string;
  try {
    const read = readStoryMdBytesFromDisk(args.storyMarkdownPath);
    buffer = read.buffer;
    text = read.text;
  } catch (e) {
    return {
      storyMdReadBack: false,
      validUtf8: false,
      completedEnding: false,
      allPagesPresent: false,
      appliedLinesPresent: false,
      badLinesRemoved: false,
      failures: [String(e)],
      fileByteLength: 0,
      readFromDisk: false,
    };
  }

  const validUtf8 = isValidUtf8Buffer(buffer);
  if (!validUtf8) failures.push('invalid UTF-8 or replacement characters');

  if (hasTruncatedP12Ending(text)) {
    failures.push('truncated p12 ending (partial final character)');
  }

  if (profile === 'koko_transition' && !derived?.length && !args.requiredEndingMarkers?.length) {
    failures.push('koko read-back requires story-pages.json p12 or explicit markers');
  }

  for (const marker of markers) {
    const plain = stripNiqqud(marker);
    const inRaw = text.includes(marker);
    const inPlain = stripNiqqud(text).includes(plain);
    if (!inRaw && !inPlain) {
      failures.push(`missing required ending marker: ${marker}`);
    }
  }

  const artifactScan = scanRawArtifactTokensInMarkdown(text);
  if (!artifactScan.pass) {
    for (const t of artifactScan.tokens) {
      failures.push(`raw artifact token in prose: ${t}`);
    }
  }

  const slashScan = scanSlashChipsInMarkdown(text);
  if (!slashScan.slashChipStylePass) {
    failures.push(`slash chips in prose: ${slashScan.slashChipCount} hit(s)`);
  }

  const suffixScan = scanSuffixChipsInMarkdown(text);
  if (!suffixScan.suffixChipPass) {
    failures.push(`suffix chips in prose: ${suffixScan.suffixChipCount} hit(s)`);
  }

  if (args.storyPagesPath && fs.existsSync(args.storyPagesPath)) {
    const pagesJson = JSON.parse(fs.readFileSync(args.storyPagesPath, 'utf8')) as Array<{
      page: number;
      prose?: string;
    }>;
    const expectedP12 = pagesJson.find((p) => p.page === expectedPageCount)?.prose ?? '';
    const expectedLast = expectedP12
      .split(/\s{2,}|\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .pop();
    const actualLast = finalProseLine(text, expectedPageCount);
    if (expectedLast && actualLast) {
      const expTail = stripNiqqud(expectedLast).slice(-30);
      const actTail = stripNiqqud(actualLast).slice(-30);
      if (expTail && actTail && expTail !== actTail && !stripNiqqud(text).includes(expTail)) {
        failures.push('story.md p12 ending does not match expected final-page prose');
      }
    }
  }

  if (isDiniPopcorn) {
    if (!text.includes('"אחרי הסרט."')) {
      failures.push('story.md does not contain "אחרי הסרט."');
    }
    if (!text.includes('קרצה ל{{childName}}')) {
      failures.push('story.md does not contain "קרצה ל{{childName}}"');
    }
    if (!/\n"אחרי הסרט\."\s*$/.test(text)) {
      failures.push('story.md does not end with "אחרי הסרט." as final line');
    }
  }

  const pages = parseStoryPages(text);
  const pageNums = new Set(pages.map((p) => p.page));
  let allPagesPresent = pages.length === expectedPageCount;
  for (let n = 1; n <= expectedPageCount; n++) {
    if (!pageNums.has(n)) {
      allPagesPresent = false;
      failures.push(`missing page ${n} in parsed story.md`);
    }
    if (!new RegExp(`--- Page ${n} ---`).test(text)) {
      allPagesPresent = false;
      failures.push(`missing page marker --- Page ${n} ---`);
    }
  }

  const appliedLinesPresent =
    !args.appliedFixes?.length ||
    args.appliedFixes.every((f) => {
      const first = f.after.split('\n')[0]?.trim() ?? '';
      return text.includes(f.after) || (first.length > 0 && text.includes(first));
    });
  if (!appliedLinesPresent) failures.push('applied fix lines not found in story.md');

  const badLinesRemoved =
    !args.badLinesRemoved?.length ||
    args.badLinesRemoved.every((bad) => !text.includes(bad));
  if (!badLinesRemoved) failures.push('replaced bad lines still present in story.md');

  const endingFailures = failures.filter(
    (f) =>
      f.startsWith('missing required') ||
      f.includes('truncated') ||
      f.includes('raw artifact token') ||
      f.includes('slash chips') ||
      f.includes('suffix chips') ||
      f.includes('p12 ending does not match') ||
      (isDiniPopcorn && (f.includes('אחרי הסרט') || f.includes('קרצה')))
  );
  const completedEnding =
    endingFailures.length === 0 &&
    !hasTruncatedP12Ending(text) &&
    artifactScan.pass &&
    slashScan.slashChipStylePass &&
    suffixScan.suffixChipPass &&
    (markers.length === 0 ||
      markers.every((m) => text.includes(m) || stripNiqqud(text).includes(stripNiqqud(m))));

  return {
    storyMdReadBack: true,
    validUtf8,
    completedEnding,
    allPagesPresent,
    appliedLinesPresent,
    badLinesRemoved,
    failures,
    fileByteLength: buffer.length,
    readFromDisk: true,
    rawArtifactTokenCount: artifactScan.rawArtifactTokenCount,
    slashChipCount: slashScan.slashChipCount,
    suffixChipCount: suffixScan.suffixChipCount,
    derivedP12Markers,
  };
}
