/**
 * Narration niqqud — homograph COVERAGE + the fail-closed preflight.
 *
 * The TTS niqqud pass (`applyTtsAmbiguityNiqqudToText`) disambiguates Hebrew homographs for the vocalizer ONLY
 * (the DISPLAYED text is stripped of niqqud downstream via hebrew-text.stripNikud — NOT touched here). This spec
 * guards the coverage the brief added — ספר (count vs book), שם (there / put / name), בקצב·הקצב (rhythm) — plus a
 * fail-closed preflight (`checkTtsNiqqudCoverage`) that surfaces a future coverage gap instead of a silent
 * mispronunciation, and a bank-wide check that no CRITICAL ambiguous lemma reaches TTS unniqqud.
 *
 * NOTE: the exact niqqud choices are pending Guy's native-Hebrew sign-off; these tests pin the STRUCTURE (which
 * sense fires in which context) + the brief's acceptance vocalizations.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import {
  applyTtsAmbiguityNiqqudToText,
  checkTtsNiqqudCoverage,
  criticalTtsNiqqudGaps,
  KNOWN_AMBIGUOUS_LEMMAS,
  CRITICAL_AMBIGUOUS_LEMMAS,
} from '../story-gen-v2/tts-ambiguity-niqqud';
import { parseStoryMarkdown } from '../story-validators/parser';
import { resolveGenderAlternationChips } from '../story-bank-personalization';

const apply = (s: string) => applyTtsAmbiguityNiqqudToText(s).text;

describe('narration niqqud — the brief acceptance cases', () => {
  it('ספר in a COUNT context → סָפַר (not the book noun)', () => {
    expect(apply('בר ספר בלחש')).toContain('סָפַר');
    expect(apply('בר ספר בלחש')).not.toContain('סֵפֶר');
  });
  it('שם adjacent to a location verb → שָׁם ("there")', () => {
    expect(apply('שם עמד בשקט')).toContain('שָׁם');
    expect(apply('הוא עמד שם בשקט')).toContain('שָׁם');
  });
  it('בקצב / הקצב in a rhythm context → בְּקֶצֶב / הַקֶּצֶב', () => {
    expect(apply('לצעוד בקצב של כולם')).toContain('בְּקֶצֶב');
    expect(apply('הקצב רץ קדימה')).toContain('הַקֶּצֶב');
  });
});

describe('narration niqqud — the other senses are distinguished by context', () => {
  it('ספר in a BOOK context → סֵפֶר', () => {
    expect(apply('ספר עם פינה מקופלת')).toContain('סֵפֶר');
    expect(apply('ספר עם פינה מקופלת')).not.toContain('סָפַר');
  });
  it('שם + a direct object → שָׂם ("put")', () => {
    expect(apply('הוא שם את הרגליים')).toContain('שָׂם');
    expect(apply('שם לב לזה')).toContain('שָׂם');
  });
  it('שם after a "לו/לה …" possessive → שֵׁם ("name")', () => {
    expect(apply('צבע שלא היה לו שם')).toContain('שֵׁם');
  });
});

describe('narration niqqud — no over-niqqud / never guess', () => {
  it('leaves an already-niqqud homograph untouched', () => {
    expect(apply('הילד קרא סֵפֶר טוב')).toBe('הילד קרא סֵפֶר טוב');
    expect(apply('בר סָפַר בלחש')).toBe('בר סָפַר בלחש');
  });
  it('leaves an ambiguous lemma with NO disambiguating context BARE (to be flagged, not guessed)', () => {
    const out = apply('זה ספר.'); // "this is a book" — but no count/book context word
    expect(out).toBe('זה ספר.');
    expect(out).not.toContain('סֵפֶר');
    expect(out).not.toContain('סָפַר');
  });
  it('does not vocalize an unrelated, unambiguous word', () => {
    expect(apply('הילד רץ מהר')).toBe('הילד רץ מהר');
  });
});

describe('narration niqqud — fail-closed preflight (checkTtsNiqqudCoverage)', () => {
  it('passes CLEAN once the lemma is covered by a rule', () => {
    expect(checkTtsNiqqudCoverage(apply('ספר עם פינה'))).toEqual([]);
    expect(criticalTtsNiqqudGaps(apply('לצעוד בקצב'))).toEqual([]);
  });
  it('FLAGS a critical lemma that reached TTS still bare (a coverage gap)', () => {
    const gaps = criticalTtsNiqqudGaps(apply('זה ספר.'));
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ lemma: 'ספר', critical: true });
  });
  it('CRITICAL is a curated subset of the watch list (שם is soft-flagged only)', () => {
    for (const l of CRITICAL_AMBIGUOUS_LEMMAS) expect(KNOWN_AMBIGUOUS_LEMMAS).toContain(l);
    expect(CRITICAL_AMBIGUOUS_LEMMAS).not.toContain('שם'); // 3-way + the un-gateable "שם." answer → soft flag
    // a bare שם that stays uncovered is surfaced (soft) but is NOT a hard-block gap
    const flags = checkTtsNiqqudCoverage('דני הצביע עליו. "שם." הוא הנהן.');
    expect(flags.some((f) => f.lemma === 'שם' && !f.critical)).toBe(true);
    expect(criticalTtsNiqqudGaps('דני הצביע עליו. "שם." הוא הנהן.')).toEqual([]);
  });
});

describe('narration niqqud — bank-wide coverage (all v3-approved per-page TTS text)', () => {
  const BANK = path.join(process.cwd(), 'story-bank/v3-approved');
  // Resolve like a real (boy) order: gender chips → male form; {{childName}} → a neutral name.
  const resolve = (t: string) =>
    resolveGenderAlternationChips(t, 'boy').replace(/\{\{childName\}\}/g, 'דני').replace(/\{\{[^}]*\}\}/g, '');

  const pages: Array<{ story: string; page: number; tts: string }> = [];
  for (const f of readdirSync(BANK).filter((f) => f.endsWith('.md') && !f.startsWith('_'))) {
    for (const p of parseStoryMarkdown(readFileSync(path.join(BANK, f), 'utf8')).pages) {
      pages.push({ story: f, page: p.pageNumber, tts: apply(resolve(p.text)) });
    }
  }

  it('scanned a non-trivial number of pages', () => {
    expect(pages.length).toBeGreaterThan(100);
  });

  it('ZERO CRITICAL ambiguous lemmas reach TTS unniqqud across the whole bank', () => {
    const gaps = pages.flatMap((p) => criticalTtsNiqqudGaps(p.tts).map((g) => `${p.story} p${p.page} ${g.lemma}: ${g.context}`));
    expect(gaps, gaps.join('\n')).toEqual([]);
  });

  it('the residual SOFT flags are only שם (the inherently un-gateable "there" cases), bounded', () => {
    const soft = pages.flatMap((p) => checkTtsNiqqudCoverage(p.tts).filter((g) => !g.critical));
    expect(soft.every((g) => g.lemma === 'שם')).toBe(true);
    expect(soft.length).toBeLessThanOrEqual(8); // documented baseline (currently 5); a jump = a new coverage gap
  });
});
