/**
 * Deterministic scan for raw internal artifact tokens in read-aloud prose.
 */

import { pageProseOnly, parseStoryPages } from '../story-gen/story-page-utils';
import { getComicBitsForCompanion } from '../story-gen-v2/companion-comic-bits';
import { getV3ComicBitsForCompanion } from './companion-comic-bits';

/** Raw [snake_case] tokens — internal IDs, not read-aloud text. */
export const RAW_ARTIFACT_TOKEN_RE = /\[[a-z][a-z0-9_]*\]/gi;

export const COMPANION_ARTIFACT_TOKEN_RES: Record<string, RegExp> = {
  koko: /\[koko_[a-z0-9_]+\]/gi,
  dini: /\[dini_[a-z0-9_]+\]/gi,
  anat: /\[anat_[a-z0-9_]+\]/gi,
  fox: /\[fox_[a-z0-9_]+\]/gi,
};

export interface RawArtifactTokenHit {
  page: number;
  token: string;
  line: string;
}

export interface RawArtifactTokenScanReport {
  pass: boolean;
  tokens: string[];
  hits: RawArtifactTokenHit[];
  rawArtifactTokenCount: number;
}

export interface SlashChipHit {
  page: number;
  match: string;
  line: string;
}

export interface SlashChipStyleReport {
  slashChipStylePass: boolean;
  hits: SlashChipHit[];
  slashChipCount: number;
}

/** Hebrew verb/adj slash gender form: נכנס/ת, מצביע/ה, תלה/תה */
const SLASH_CHIP_RE = /[\u0590-\u05FF][\u0590-\u05FF\u05F3\u05F4\-]*\/[\u0590-\u05FF][\u0590-\u05FF\u05F3\u05F4\-]*/g;

const SLASH_CHIP_ALLOWLIST = new Set(['ו/או', 'א/ב']);

export function scanRawArtifactTokensInMarkdown(markdown: string): RawArtifactTokenScanReport {
  const hits: RawArtifactTokenHit[] = [];
  const tokenSet = new Set<string>();

  for (const { page, body } of parseStoryPages(markdown)) {
    const prose = pageProseOnly(body);
    for (const rawLine of prose.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      const matches = line.match(RAW_ARTIFACT_TOKEN_RE) ?? [];
      for (const token of matches) {
        tokenSet.add(token);
        hits.push({ page, token, line: line.slice(0, 120) });
      }
    }
  }

  return {
    pass: hits.length === 0,
    tokens: [...tokenSet],
    hits,
    rawArtifactTokenCount: hits.length,
  };
}

export function scanSlashChipsInMarkdown(markdown: string): SlashChipStyleReport {
  const hits: SlashChipHit[] = [];

  for (const { page, body } of parseStoryPages(markdown)) {
    const prose = pageProseOnly(body);
    for (const rawLine of prose.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.includes('imageDirection')) continue;
      const matches = line.match(SLASH_CHIP_RE) ?? [];
      for (const match of matches) {
        if (SLASH_CHIP_ALLOWLIST.has(match)) continue;
        hits.push({ page, match, line: line.slice(0, 120) });
      }
    }
  }

  return {
    slashChipStylePass: hits.length === 0,
    hits,
    slashChipCount: hits.length,
  };
}

function comicBitById(companionId: string, id: string) {
  const bits = [...getV3ComicBitsForCompanion(companionId), ...getComicBitsForCompanion(companionId)];
  return bits.find((b) => b.id === id);
}

/**
 * Replace [bit_id] with bank prose when possible; collect unresolved IDs.
 */
export function resolveComicBitTokensInMarkdown(
  markdown: string,
  companionId: string
): { markdown: string; resolved: string[]; unresolved: string[] } {
  const resolved: string[] = [];
  const unresolved: string[] = [];

  const out = markdown.replace(RAW_ARTIFACT_TOKEN_RE, (token) => {
    const id = token.slice(1, -1);
    const bit = comicBitById(companionId, id);
    if (!bit) {
      unresolved.push(token);
      return token;
    }
    const text = [bit.actionHe, bit.lineHe].filter(Boolean).join(' ').trim();
    if (!text) {
      unresolved.push(token);
      return token;
    }
    resolved.push(id);
    return text;
  });

  return { markdown: out, resolved, unresolved };
}
