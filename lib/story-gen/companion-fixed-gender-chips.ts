/**
 * Flags gender chips on fixed-gender companion verbs (companion gender ≠ child gender).
 */

import {
  resolveCompanionGender,
  resolveCompanionNameMarkers,
  type CompanionRegisteredGender,
} from './companion-gender';
import { pageProseOnly, parseStoryPages } from './story-page-utils';

export type CompanionChipHitReason =
  | 'companion_name_before_chip'
  | 'vav_chip_same_line_as_companion'
  | 'hu_chip_after_companion_on_line';

export interface CompanionFixedGenderChipHit {
  page: number;
  token: string;
  reason: CompanionChipHitReason;
  context: string;
  companionId: string;
  registeredGender: CompanionRegisteredGender;
  suggestedDechip: string;
}

export interface CompanionFixedGenderChipReport {
  status: 'companion_fixed_gender_chip_v1';
  companionId: string;
  registeredGender: CompanionRegisteredGender | null;
  hits: CompanionFixedGenderChipHit[];
  hitCount: number;
  advisoryWarn: boolean;
  advisoryFail: boolean;
}

function stripHebrewDiacritics(text: string): string {
  return text.replace(/[\u0591-\u05C7\u05F3\u05F4]/g, '');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function frontmatterCompanionId(markdown: string): string | null {
  const m = markdown.match(/companionId:\s*(\S+)/);
  return m?.[1]?.trim() ?? null;
}

function dechipToFixedForm(chip: string, gender: CompanionRegisteredGender): string {
  const m = chip.match(/\{([^{}|]+)\|([^{}|]+)\}/);
  if (!m) return chip;
  return gender === 'male' ? m[1] : m[2];
}

function replaceChipInToken(token: string, gender: CompanionRegisteredGender): string {
  return token.replace(/\{([^{}|]+)\|([^{}|]+)\}/g, (_, male, female) =>
    gender === 'male' ? male : female
  );
}

function lineHasCompanionName(line: string, markers: string[]): boolean {
  const stripped = stripHebrewDiacritics(line);
  return markers.some((name) => stripped.includes(stripHebrewDiacritics(name)));
}

function scanLineForCompanionChips(args: {
  page: number;
  line: string;
  prevLines?: string[];
  companionId: string;
  gender: CompanionRegisteredGender;
  markers: string[];
}): CompanionFixedGenderChipHit[] {
  const hits: CompanionFixedGenderChipHit[] = [];
  const { page, line, prevLines = [], companionId, gender, markers } = args;
  let m: RegExpExecArray | null;

  for (const name of markers) {
    const nameEsc = escapeRegExp(stripHebrewDiacritics(name));
    const nameChipRe = new RegExp(
      `${nameEsc}\\s+(\\{[^{}|]+\\|[^{}|]+\\})`,
      'gu'
    );
    const strippedLine = stripHebrewDiacritics(line);
    while ((m = nameChipRe.exec(strippedLine)) !== null) {
      const chip = m[1];
      hits.push({
        page,
        token: chip,
        reason: 'companion_name_before_chip',
        context: line.trim().slice(0, 120),
        companionId,
        registeredGender: gender,
        suggestedDechip: replaceChipInToken(
          line.slice(m.index, m.index + m[0].length),
          gender
        ),
      });
    }
  }

  if (lineHasCompanionName(line, markers)) {
    const vavChipRe = /ו(\{[^{}|]+\|[^{}|]+\})/g;
    while ((m = vavChipRe.exec(line)) !== null) {
      hits.push({
        page,
        token: m[1],
        reason: 'vav_chip_same_line_as_companion',
        context: line.trim().slice(0, 120),
        companionId,
        registeredGender: gender,
        suggestedDechip: `ו${dechipToFixedForm(m[1], gender)}`,
      });
    }

  }

  const companionInRecentContext =
    lineHasCompanionName(line, markers) ||
    prevLines.some((pl) => lineHasCompanionName(pl, markers));
  if (companionInRecentContext) {
    const huChipRe = /(?:^|\s)הוא\s+(\{[^{}|]+\|[^{}|]+\})/g;
    const strippedLine = stripHebrewDiacritics(line);
    while ((m = huChipRe.exec(strippedLine)) !== null) {
      const chip = m[1];
      hits.push({
        page,
        token: chip,
        reason: 'hu_chip_after_companion_on_line',
        context: line.trim().slice(0, 120),
        companionId,
        registeredGender: gender,
        suggestedDechip: `הוא ${dechipToFixedForm(chip, gender)}`,
      });
    }
  }

  return hits;
}

export function scanCompanionFixedGenderChips(
  markdown: string,
  options?: { blocking?: boolean; companionId?: string }
): CompanionFixedGenderChipReport {
  const companionId =
    options?.companionId ?? frontmatterCompanionId(markdown) ?? 'unknown';
  const gender = resolveCompanionGender(companionId);
  const markers = resolveCompanionNameMarkers(companionId);
  const hits: CompanionFixedGenderChipHit[] = [];

  if (gender && markers.length > 0) {
    for (const { page, body } of parseStoryPages(markdown)) {
      const prose = pageProseOnly(body);
      const lines = prose.split(/\r?\n/);
      for (let li = 0; li < lines.length; li++) {
        const line = lines[li]!;
        hits.push(
          ...scanLineForCompanionChips({
            page,
            line,
            prevLines: lines.slice(Math.max(0, li - 3), li),
            companionId,
            gender,
            markers,
          })
        );
      }
    }
  }

  const deduped: CompanionFixedGenderChipHit[] = [];
  const seen = new Set<string>();
  for (const h of hits) {
    const key = `${h.page}:${h.token}:${h.reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(h);
  }

  const advisoryWarn = deduped.length > 0;
  return {
    status: 'companion_fixed_gender_chip_v1',
    companionId,
    registeredGender: gender,
    hits: deduped,
    hitCount: deduped.length,
    advisoryWarn,
    advisoryFail: Boolean(options?.blocking && advisoryWarn),
  };
}
