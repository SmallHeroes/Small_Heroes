import { describe, expect, it } from 'vitest';

import type { CompanionComicBit } from '../story-gen-v2/companion-comic-bits';
import fs from 'fs';
import path from 'path';

import {
  BUNNY_OMETZ_COMIC_BITS,
  CHAMELEON_KOKO_COMIC_BITS,
  FOX_URI_COMIC_BITS,
  LION_SHAKET_COMIC_BITS,
  TURTLE_BEITI_COMIC_BITS,
  V3_COMIC_BIT_DOSAGE_INSTRUCTION,
  buildV3ComicBitBankPromptBlock,
  formatV3ComicBitsForPrompt,
  getV3ComicBitsForCompanion,
} from '../story-gen-v3/companion-comic-bits';

/** Comic-bit prose must not use inline gender slashes — chips resolve at personalization. */
const GENDER_SLASH_IN_BIT_PROSE =
  /(?:את\/ה|ילד\/ה)|[\u0590-\u05FF]+\/(?:ה|ת)/;

function assertNoGenderSlashInBit(bit: CompanionComicBit): void {
  for (const field of ['lineHe', 'actionHe'] as const) {
    const text = bit[field];
    if (!text) continue;
    expect(text, `${bit.id}.${field}`).not.toMatch(GENDER_SLASH_IN_BIT_PROSE);
  }
}

const ALL_V3_COMIC_BITS: CompanionComicBit[] = [
  ...FOX_URI_COMIC_BITS,
  ...CHAMELEON_KOKO_COMIC_BITS,
  ...LION_SHAKET_COMIC_BITS,
  ...BUNNY_OMETZ_COMIC_BITS,
  ...TURTLE_BEITI_COMIC_BITS,
];
describe('fox_uri comic bits bank (Sprint 11 prereq)', () => {
  it('exposes 10–15 bits wired for v3', () => {
    const bits = getV3ComicBitsForCompanion('fox_uri');
    expect(bits).toBe(FOX_URI_COMIC_BITS);
    expect(bits.length).toBeGreaterThanOrEqual(10);
    expect(bits.length).toBeLessThanOrEqual(15);
    expect(bits.every((b) => b.companionId === 'fox_uri')).toBe(true);
  });

  it('covers mandatory acceptance tags', () => {
    const ids = new Set(FOX_URI_COMIC_BITS.map((b) => b.id));
    expect(ids.has('uri_coat_monster_proud_scout')).toBe(true); // fear-misunderstanding
    expect(ids.has('uri_lantern_ember_brave_words')).toBe(true); // lantern gag
    expect(ids.has('uri_tail_hides_before_words')).toBe(true); // tail/body-language
    expect(ids.has('uri_night_path_paw_marks')).toBe(true); // night-path pride
    expect(ids.has('uri_child_ears_correct')).toBe(true); // child-corrects-Uri
    expect(ids.has('uri_quiet_glow_one_step')).toBe(true); // quiet courage
  });

  it('has lantern-as-courage-meter in 3+ reusable forms', () => {
    const lanternBits = FOX_URI_COMIC_BITS.filter(
      (b) =>
        b.situationTags.includes('lantern') ||
        (b.actionHe?.includes('פנס') ?? false) ||
        (b.lineHe?.includes('פנס') ?? false)
    );
    expect(lanternBits.length).toBeGreaterThanOrEqual(3);
  });

  it('has no gender-slash prose in fox bits', () => {
    for (const bit of FOX_URI_COMIC_BITS) assertNoGenderSlashInBit(bit);
  });
});

describe('v3 companion comic bits banks — prose hygiene', () => {
  it('never uses gender-slash forms in lineHe/actionHe', () => {
    expect(ALL_V3_COMIC_BITS.length).toBeGreaterThan(0);
    for (const bit of ALL_V3_COMIC_BITS) assertNoGenderSlashInBit(bit);
  });
});

describe('v3 comic bit dosage (prose consumption)', () => {
  it('formatV3ComicBitsForPrompt prepends 3–5 select rule', () => {
    const block = formatV3ComicBitsForPrompt(FOX_URI_COMIC_BITS);
    expect(block.startsWith(V3_COMIC_BIT_DOSAGE_INSTRUCTION)).toBe(true);
    expect(block).toContain('SELECT 3–5');
    expect(block).toContain('NEVER weave all bank bits');
    expect(block).toContain('כמעט / אולי / רשמית');
  });

  it('buildV3ComicBitBankPromptBlock wires fox bank with dosage', () => {
    const block = buildV3ComicBitBankPromptBlock('fox_uri');
    expect(block).toContain('uri_lantern_steady_after_child');
    expect(block).toContain('SELECT 3–5');
  });

  it('prose-gen-v3 consumes dosage instruction at bank injection site', () => {
    const proseSrc = fs.readFileSync(
      path.join(process.cwd(), 'lib/story-gen-v3/prose-gen-v3.ts'),
      'utf8'
    );
    expect(proseSrc).toContain('V3_COMIC_BIT_DOSAGE_INSTRUCTION');
    expect(proseSrc).toContain('buildV3ComicBitBankPromptBlock');
  });
});
