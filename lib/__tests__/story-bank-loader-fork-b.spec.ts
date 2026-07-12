/**
 * Fork B — constrain live LLM story-correction on paid v3-approved generation.
 *
 * These cover the deterministic name personalization + fail-closed correction guards that replace the free-form
 * LLM rewrite on the paid path, and the retry-determinism invariant (deterministic finalized text → stable
 * delivery-input payloadHash → the receipt fence replays exactly-once instead of stranding).
 *
 * Requirements exercised (from the task brief):
 *   - wrong page count → fail
 *   - name removed / absent → fail
 *   - meaning changed beyond diff budget → fail
 *   - retry determinism (same inputs → identical payload / hash)
 */
import { describe, it, expect } from 'vitest';
import {
  countNameOccurrences,
  deterministicNameTopUp,
  assertNameFloor,
  assertCorrectionWithinDiffBudget,
  boundedLevenshtein,
  NAME_PERSONALIZATION_TARGET,
  NAME_PERSONALIZATION_MIN,
  StoryBankPersonalizationError,
} from '@/backend/providers/story-bank-loader';
import { hashOperationPayload } from '@/lib/generation-pipeline/atomic-operation';

type Page = { pageNumber: number; text: string; narrationText: string };

const page = (pageNumber: number, text: string): Page => ({ pageNumber, text, narrationText: text });

describe('Fork B — countNameOccurrences', () => {
  it('counts substring occurrences across pages', () => {
    const pages = [page(1, 'מיה קמה. אחר כך מיה שרה.'), page(2, 'בסוף מיה נמה.')];
    expect(countNameOccurrences(pages, 'מיה')).toBe(3);
  });

  it('returns 0 when the name is absent and for an empty name', () => {
    expect(countNameOccurrences([page(1, 'הילדה קמה בבוקר.')], 'מיה')).toBe(0);
    expect(countNameOccurrences([page(1, 'טקסט')], '')).toBe(0);
  });
});

describe('Fork B — deterministicNameTopUp (pure substitution, no LLM)', () => {
  it('substitutes generic child-word slots up to the target (girl)', () => {
    const pages = [page(1, 'פעם אחת הילדה יצאה. אחר כך הילדה שרה. בסוף הילדה נמה.')];
    const added = deterministicNameTopUp(pages, 'מיה', 'girl', 3);
    expect(added).toBe(3);
    expect(countNameOccurrences(pages, 'מיה')).toBe(3);
    expect(pages[0].text).not.toContain('הילדה');
    // narrationText tracks text (both are personalized identically).
    expect(pages[0].narrationText).toBe(pages[0].text);
  });

  it('substitutes the masculine slot for a boy and leaves the feminine form untouched', () => {
    const pages = [page(1, 'הילד הלך. הילדה אחרת עברה.')];
    const added = deterministicNameTopUp(pages, 'דן', 'boy', 3);
    expect(added).toBe(1); // only the masculine 'הילד' slot
    expect(pages[0].text).toContain('דן הלך');
    expect(pages[0].text).toContain('הילדה אחרת'); // feminine token preserved
  });

  it('is a no-op when the name is already dense (v3-style {{childName}} resolution)', () => {
    const pages = [page(1, 'מיה קמה. מיה שרה. מיה נמה. מיה חייכה.')];
    const before = pages[0].text;
    const added = deterministicNameTopUp(pages, 'מיה', 'girl', NAME_PERSONALIZATION_TARGET);
    expect(added).toBe(0);
    expect(pages[0].text).toBe(before);
  });

  it('is deterministic — identical inputs produce byte-identical output across runs', () => {
    const src = 'פעם אחת הילד יצא. אחר כך הילד שר. בהמשך הילד רץ. בסוף הילד נם.';
    const a = [page(1, src)];
    const b = [page(1, src)];
    deterministicNameTopUp(a, 'דן', 'boy', 3);
    deterministicNameTopUp(b, 'דן', 'boy', 3);
    expect(a[0].text).toBe(b[0].text);
  });

  it('does not splice bare names into prefixed forms (לילד stays, only standalone הילד is replaced)', () => {
    const pages = [page(1, 'הילד נתן מתנה לילד אחר.')];
    deterministicNameTopUp(pages, 'דן', 'boy', 3);
    expect(pages[0].text).toContain('דן נתן');
    expect(pages[0].text).toContain('לילד אחר'); // prefixed form untouched (would be ungrammatical as bare name)
  });
});

describe('Fork B — assertNameFloor (name removed / absent → fail)', () => {
  it('throws when the name is below the minimum (removed / never resolved)', () => {
    expect(() => assertNameFloor('מיה', 0, NAME_PERSONALIZATION_MIN)).toThrow(StoryBankPersonalizationError);
  });

  it('passes when the name meets the minimum', () => {
    expect(() => assertNameFloor('מיה', 2, NAME_PERSONALIZATION_MIN)).not.toThrow();
  });
});

describe('Fork B — assertCorrectionWithinDiffBudget (meaning change / wrong page count → fail)', () => {
  const baseline = ['הילד הלך לים והתרחץ במים הקרים.', 'בערב הילד חזר הביתה ונרדם.'];

  it('passes when nothing changed', () => {
    expect(() => assertCorrectionWithinDiffBudget(baseline, [...baseline])).not.toThrow();
  });

  it('passes for a small, localized name substitution (within budget)', () => {
    const finalized = ['דן הלך לים והתרחץ במים הקרים.', 'בערב דן חזר הביתה ונרדם.'];
    expect(() => assertCorrectionWithinDiffBudget(baseline, finalized)).not.toThrow();
  });

  it('throws when a page was rewritten beyond the budget (meaning changed)', () => {
    const finalized = [
      'הילד טס לחלל בחללית כסופה ופגש חייזרים ירוקים ורקד איתם על הירח.',
      'בערב הילד חזר הביתה ונרדם.',
    ];
    expect(() => assertCorrectionWithinDiffBudget(baseline, finalized)).toThrow(StoryBankPersonalizationError);
  });

  it('throws on a page-count change (wrong page count)', () => {
    expect(() => assertCorrectionWithinDiffBudget(baseline, [baseline[0]])).toThrow(StoryBankPersonalizationError);
  });
});

describe('Fork B — boundedLevenshtein', () => {
  it('computes small distances exactly', () => {
    expect(boundedLevenshtein('abc', 'abc', 5)).toBe(0);
    expect(boundedLevenshtein('abc', 'abd', 5)).toBe(1);
    expect(boundedLevenshtein('', 'abc', 5)).toBe(3);
  });

  it('early-exits above the ceiling (returns > max, never a huge number)', () => {
    const d = boundedLevenshtein('aaaaaa', 'bbbbbb', 2);
    expect(d).toBeGreaterThan(2);
  });
});

describe('Fork B — retry determinism (stable delivery-input payloadHash)', () => {
  // Mirrors text-finalization.ts mutationPayload.pages: [pageNumber, text, narrationText, template].
  const toPayloadPages = (pages: Page[]) =>
    pages.map((p) => [p.pageNumber, p.text, p.narrationText, 'art_top_text_bottom'] as const);

  it('two independent deterministic derivations hash identically (no ReceiptPayloadMismatch)', () => {
    const derive = () => {
      const pages = [page(1, 'פעם אחת הילד יצא להרפתקה. הילד היה אמיץ.'), page(2, 'בסוף הילד חזר הביתה.')];
      deterministicNameTopUp(pages, 'דן', 'boy', NAME_PERSONALIZATION_TARGET);
      return pages;
    };
    const h1 = hashOperationPayload({ pages: toPayloadPages(derive()) });
    const h2 = hashOperationPayload({ pages: toPayloadPages(derive()) });
    expect(h1).toBe(h2);
  });

  it('documents the strand + the reuse fix: a drifted page hashes differently; reusing persisted text restores the hash', () => {
    const attempt1 = [page(1, 'עמוד קבוע.'), page(2, 'מכתב מבוני: שלום דן, היה נחמד להרפתקה.')];
    const drifted = [page(1, 'עמוד קבוע.'), page(2, 'מכתב מבוני: היי דן! כיף גדול שהיינו יחד.')]; // e.g. companion-letter reword

    const h1 = hashOperationPayload({ pages: toPayloadPages(attempt1) });
    const hDrift = hashOperationPayload({ pages: toPayloadPages(drifted) });
    expect(hDrift).not.toBe(h1); // WITHOUT reuse a redrive would fail closed here

    // Reuse persisted text (text-finalization.ts) → identical payload → identical hash → fence replays.
    const reused = drifted.map((p) => {
      const prior = attempt1.find((q) => q.pageNumber === p.pageNumber)!;
      return { ...p, text: prior.text, narrationText: prior.narrationText ?? prior.text };
    });
    expect(hashOperationPayload({ pages: toPayloadPages(reused) })).toBe(h1);
  });
});
