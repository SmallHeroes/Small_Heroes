/**
 * Two bugs found via a hallucinated fox mint from an EMPTY source:
 *  (1) parseStoryMarkdown assumed prose BEFORE the imageDirection line, so the Generator-v3 format
 *      (imageDirection FIRST) yielded empty page text.
 *  (2) An empty/thin source flowed to the compiler, which authored a fully-valid but HALLUCINATED contract.
 * This spec proves the parser now extracts prose regardless of the direction line's position, and that the
 * fail-closed prose guard refuses empty/thin source at BOTH seams (extractor + compiler).
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

import { parseStoryMarkdown } from '../story-validators/parser';
import { extractSourceFromMarkdown } from '../../scripts/extract-visual-contract-sources';
import {
  assertSourceHasRealProse,
  countProseLetters,
  MIN_PAGE_PROSE_LETTERS,
} from '../visual-contract-compiler/assertSourceProse';
import {
  compileBookVisualContractTemplate,
  buildTemplateCompileUserPrompt,
  type TemplateCompileInput,
} from '../visual-contract-compiler/compileBookVisualContractTemplate';
import { extractDeterministicFacts } from '../visual-contract-compiler/extractDeterministicFacts';

const BANK = path.join(process.cwd(), 'story-bank/v3-approved');
const V5_BANK = path.join(process.cwd(), 'story-bank/v5-fixed-v2');
const bunnySource = (): TemplateCompileInput =>
  extractSourceFromMarkdown('bunny_ometz_adventure', fs.readFileSync(path.join(BANK, 'bunny_ometz_adventure.md'), 'utf8')) as TemplateCompileInput;

const wrap = (body: string, pages = 2) => `---\ntitle: "t"\ncompanionId: fox_uri\ndirection: adventure\npages: ${pages}\n---\n\n${body}\n`;

describe('parseStoryMarkdown — imageDirection may sit BEFORE, AFTER, or BETWEEN prose', () => {
  it('extracts prose when imageDirection comes FIRST (Generator-v3 format — the fox bug)', () => {
    const md = wrap(
      [
        '--- Page 1 ---',
        'imageDirection: a wide moonlit balcony. companionPresence: present.',
        '',
        'בלילה שקט אחד נשמע צליל מוזר מתחת לחלון.',
        'הילד התכופף אל החלון.',
      ].join('\n'),
      1,
    );
    const { pages } = parseStoryMarkdown(md);
    expect(pages[0].text).toContain('בלילה שקט');
    expect(pages[0].text).not.toContain('imageDirection');
    expect(pages[0].imageDirection).toContain('moonlit balcony');
  });

  it('still extracts prose when imageDirection comes LAST (v5/bank format — no regression)', () => {
    const md = wrap(['--- Page 1 ---', 'שלום עולם, זה סיפור אמיתי.', '', 'imageDirection: a shot.'].join('\n'), 1);
    const { pages } = parseStoryMarkdown(md);
    expect(pages[0].text).toBe('שלום עולם, זה סיפור אמיתי.');
    expect(pages[0].imageDirection).toContain('a shot');
  });

  it('keeps prose on BOTH sides when imageDirection sits in the MIDDLE', () => {
    const md = wrap(['--- Page 1 ---', 'לפני טקסט אחד.', 'imageDirection: mid shot.', 'אחרי טקסט שני.'].join('\n'), 1);
    const { pages } = parseStoryMarkdown(md);
    expect(pages[0].text).toContain('לפני טקסט');
    expect(pages[0].text).toContain('אחרי טקסט');
    expect(pages[0].text).not.toContain('imageDirection');
  });
});

describe('fox_uri_adventure re-extract — the Generator-v3 story now yields non-empty prose', () => {
  it('extracts the balcony/night-fear Hebrew story (was empty before the parser fix)', () => {
    const src = extractSourceFromMarkdown('fox_uri_adventure', fs.readFileSync(path.join(BANK, 'fox_uri_adventure.md'), 'utf8'));
    expect(src.pageCount).toBe(12);
    expect(src.fullStoryText.length).toBeGreaterThan(500);
    expect(src.fullStoryText).toContain('בלילה'); // page 1 opening
    for (const p of src.pages) {
      expect(countProseLetters(p.text)).toBeGreaterThanOrEqual(MIN_PAGE_PROSE_LETTERS);
    }
  });
});

describe('countProseLetters — letters only', () => {
  it('counts Hebrew + Latin letters, ignores digits/punctuation/whitespace', () => {
    expect(countProseLetters('שלום עולם')).toBe(8);
    expect(countProseLetters('שלום, world! 123')).toBe(9);
    expect(countProseLetters('123 !@# --- …')).toBe(0);
  });
});

describe('assertSourceHasRealProse — fail-closed prose guard', () => {
  it('a real bank story passes (no false-positive)', () => {
    const src = bunnySource();
    expect(() => assertSourceHasRealProse(src.storyKey, src.pages, 'test')).not.toThrow();
  });

  it('rejects (and names) a page with empty/negligible prose', () => {
    const pages = [
      { pageNumber: 1, text: 'טקסט ארוך דיו כדי לעבור את הסף בלי בעיה בכלל.' },
      { pageNumber: 2, text: '' },
    ];
    expect(() => assertSourceHasRealProse('k', pages, 'test')).toThrow(/negligible|empty/i);
    expect(() => assertSourceHasRealProse('k', pages, 'test')).toThrow(/\b2\b/);
  });

  it('rejects a uniformly-thin story that clears the per-page floor but fails the average', () => {
    const line = 'אבגדהוזחטיכלמנסעפצקרשתאבגד'; // exactly 25 letters: >= per-page floor (20), avg 25 < 40
    const pages = [1, 2, 3].map((n) => ({ pageNumber: n, text: line }));
    expect(pages.every((p) => countProseLetters(p.text) >= MIN_PAGE_PROSE_LETTERS)).toBe(true);
    expect(() => assertSourceHasRealProse('k', pages, 'test')).toThrow(/thin/i);
  });

  it('rejects an empty pages array', () => {
    expect(() => assertSourceHasRealProse('k', [], 'test')).toThrow(/no pages|empty/i);
  });
});

describe('extractSourceFromMarkdown — the extractor seam refuses a markers-only story', () => {
  it('throws when every page carries only an imageDirection (no prose)', () => {
    const md = wrap(
      [
        '--- Page 1 ---',
        'imageDirection: shot one.',
        '',
        '--- Page 2 ---',
        'imageDirection: shot two.',
        '',
        '--- Page 3 ---',
        'imageDirection: shot three.',
      ].join('\n'),
      3,
    );
    expect(() => extractSourceFromMarkdown('synthetic_empty', md)).toThrow(/empty|negligible/i);
  });
});

describe('compileBookVisualContractTemplate — belt-and-suspenders refuses empty source before the LLM', () => {
  it('rejects an empty-prose input and never calls the model', async () => {
    const empty: TemplateCompileInput = { ...bunnySource(), pages: bunnySource().pages.map((p) => ({ ...p, text: '' })) };
    let called = false;
    const stub = async () => {
      called = true;
      return '{}';
    };
    await expect(compileBookVisualContractTemplate(empty, { callLLM: stub })).rejects.toThrow(/empty|negligible/i);
    expect(called).toBe(false);
  });
});

// ── Hardening from adversarial review ────────────────────────────────────────

describe('parseStoryMarkdown — hardening (empty-value + repeated directive)', () => {
  it('an EMPTY imageDirection value (key then newline) does NOT swallow the following prose line', () => {
    const md = wrap(['--- Page 1 ---', 'imageDirection:', '{{childName}} טיפס במעלה הגבעה הגבוהה.', 'אוּרי חייך אליו בשמחה.'].join('\n'), 1);
    const { pages } = parseStoryMarkdown(md);
    expect(pages[0].imageDirection).toBe('');
    expect(pages[0].text).toContain('טיפס במעלה הגבעה'); // first prose line survives
    expect(pages[0].text).toContain('אוּרי חייך');
  });

  it('a SECOND imageDirection line does not leak into prose', () => {
    const md = wrap(
      ['--- Page 1 ---', 'imageDirection: fox on hill.', 'בלילה שקט אחד ירד גשם.', 'imageDirection: fox waves goodbye.', 'וכולם הלכו לישון.'].join('\n'),
      1,
    );
    const { pages } = parseStoryMarkdown(md);
    expect(pages[0].text).not.toContain('imageDirection');
    expect(pages[0].text).not.toContain('fox waves goodbye');
    expect(pages[0].text).toContain('בלילה שקט');
    expect(pages[0].text).toContain('וכולם הלכו');
  });
});

describe('extractor — the bank WORD_COUNT trailer never folds into page prose', () => {
  it('bunny (which carries a WORD_COUNT trailer) has no WORD_COUNT in any page text or fullStoryText', () => {
    const src = extractSourceFromMarkdown('bunny_ometz_adventure', fs.readFileSync(path.join(BANK, 'bunny_ometz_adventure.md'), 'utf8'));
    expect(src.fullStoryText).not.toContain('WORD_COUNT');
    for (const p of src.pages) expect(p.text).not.toContain('WORD_COUNT');
  });
});

describe('guard threshold — no false-positive on the v5-fixed-v2 production bank', () => {
  it('a v5 story with a legitimate short (~13-letter) beat page still extracts', () => {
    expect(() =>
      extractSourceFromMarkdown('firefly_namit_fantasy', fs.readFileSync(path.join(V5_BANK, 'firefly_namit_fantasy.md'), 'utf8')),
    ).not.toThrow();
  });
});

describe('compile prompt reads the GUARDED pages, not the independent fullStoryText', () => {
  it('buildTemplateCompileUserPrompt derives the story text from input.pages', () => {
    const src = bunnySource();
    const input: TemplateCompileInput = { ...src, fullStoryText: 'SENTINEL_MUST_NOT_APPEAR_IN_PROMPT' };
    const prompt = buildTemplateCompileUserPrompt(input, extractDeterministicFacts(input));
    expect(prompt).not.toContain('SENTINEL_MUST_NOT_APPEAR');
    expect(prompt).toContain(src.pages[0].text.slice(0, 24)); // real page-1 prose is present
  });
});
