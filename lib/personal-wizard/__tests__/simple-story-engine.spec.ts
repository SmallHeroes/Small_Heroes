import { describe, expect, it, vi } from 'vitest';
import { zodTextFormat } from 'openai/helpers/zod';
import { resolvePersonalWizardOptions } from '../options';
import { PERSONAL_CHARACTER_IDS } from '../companion-character';
import { personalStoryResultSchema } from '../story-contract';
import { preparePersonalStory } from '../story-writer';
import { preparePersonalStoryboard } from '../storyboard';
import { SIMPLE_STORY_SHAPES, SIMPLE_AUTHOR_INSTRUCTIONS, SIMPLE_EDITOR_INSTRUCTIONS, SimpleStoryError, checkSimpleStory, editorFindings, nameVariants,
  normalizeStoryTypography, pagesMentioning, pickStoryShape, prepareSimpleStory, simpleAuthorCall, simpleStoryDraftSchema, simpleStoryEditSchema, simpleStoryOutputTokens,
  writeSimpleStory, type PreparedSimpleStory, type SimpleStoryCall } from '../simple-story-engine';
import { textCanonOptions } from '../../../scripts/personal-simple-story';

const options = resolvePersonalWizardOptions();
const request = (over: Record<string, unknown> = {}) => ({
  kind: 'personal_book_request', version: 'reviewed-personal-book-request/v3', draftId: 'd_simpletest001', draftRevision: 1,
  child: { name: 'בר', age: 5, address: 'boy', residence: 'מושב אודם', nameSource: 'fixture', ageSource: 'fixture', addressSource: 'fixture', residenceSource: 'fixture' },
  facts: [{ id: 'f_testinterest1', kind: 'interest', value: 'לקפוץ בטרמפולינה', source: 'fixture' },
    { id: 'f_testdifficul1', kind: 'difficulty', value: 'רעשים ואזעקות', source: 'fixture' }],
  noDifficulty: false, storyPlace: null, companion: { id: 'dragon_dini' }, intent: { kind: 'topic', topicId: 'sirens' }, avoid: ['מלחמה'],
  appearance: { photo: 'none' }, bookOptions: { lengthId: 'short', voiceId: null }, ...over });
const words = (n: number) => Array.from({ length: n }, () => 'קפיצה').join(' ');
function story(p: PreparedSimpleStory, edit = (s: any) => s) {
  const n = p.book.pages;
  return edit({ title: 'בר ודיני והתוף הענק',
    pages: Array.from({ length: n }, (_, i) => ({ text: `בר קפץ על הטרמפולינה ודיני צחקה בקול. ${words(32)} ואז בא עמוד ${'אחר '.repeat(i + 1)}` })),
    childGoal: 'בר רוצה לנגן בתוף הענק', companionWant: 'דיני רוצה לרקוד', comicPromise: 'כל קפיצה מעיפה כובע',
    pageMap: Array.from({ length: n }, (_, i) => ({ location: 'החצר', transitionReason: 'הקפיצה ממשיכה', childAction: 'בר קופץ', companionAction: 'דיני מנסה',
      consequence: 'משהו משתנה', factIds: i === 0 ? ['f_testinterest1'] : [], continuity: 'הכובע על ראשו של בר' })),
    resilienceMoments: [{ page: 3, childChoice: 'בר מחזיק בכנף של דיני', whatHelps: 'דיני נשארת לידו' }], ending: 'בר ודיני מנגנים יחד' });
}
const generator = (p: PreparedSimpleStory, author = (s: any) => s, editor = (s: any) => s) => vi.fn(async (call: SimpleStoryCall) => ({
  output: call.stage === 'author' ? story(p, author) : { ...story(p, editor), editorChanges: ['חיזקתי את הבדיחה'] },
  usage: { inputTokens: 1000, outputTokens: 2000 }, estimatedUsd: 0.25 }));

describe('simple story engine', () => {
  it('picks a deterministic, varied story spine from the seed', () => {
    expect(new Set(SIMPLE_STORY_SHAPES.map(s => s.id)).size).toBe(SIMPLE_STORY_SHAPES.length);
    expect(pickStoryShape('r'.repeat(64), 'a')).toEqual(pickStoryShape('r'.repeat(64), 'a'));
    const seen = new Set(Array.from({ length: 60 }, (_, i) => pickStoryShape('r'.repeat(64), `seed-${i}`).id));
    expect(seen.size).toBeGreaterThanOrEqual(10);
  });

  it.each([8, 12, 16])('has a prose-first %i-page contract without candidate, discovery or outline-gate slots', pages => {
    for (const schema of [simpleStoryDraftSchema(pages), simpleStoryEditSchema(pages)]) {
      const json = zodTextFormat(schema, 'simple').schema as any;
      expect(json.type).toBe('object'); expect(json).not.toHaveProperty('anyOf');
      expect(Object.keys(json.properties).slice(0, 2)).toEqual(['title', 'pages']);
      expect([json.properties.pages.minItems, json.properties.pages.maxItems, json.properties.pageMap.minItems, json.properties.pageMap.maxItems]).toEqual([pages, pages, pages, pages]);
      expect(JSON.stringify(json)).not.toMatch(/discovery|childContribution|personalFactUses|candidates|outlineChecks|selectedId|curiosity/);
    }
    const p = prepareSimpleStory(request({ bookOptions: { lengthId: ({ 8: 'short', 12: 'medium', 16: 'long' } as const)[pages as 8 | 12 | 16], voiceId: null } }), options, 's');
    expect(simpleStoryDraftSchema(pages).safeParse(story(p)).success).toBe(true);
    expect(simpleStoryDraftSchema(pages).safeParse(story(p, s => ({ ...s, pages: s.pages.slice(1) }))).success).toBe(false);
  });

  it('sizes output caps above the measured maximum and inside the wire limit', () => {
    expect([8, 12, 16].map(simpleStoryOutputTokens)).toEqual([28_000, 34_000, 40_000]);
    expect(simpleStoryOutputTokens(16)).toBeGreaterThan(24_154 * 1.5);
    expect(simpleStoryOutputTokens(16)).toBeLessThanOrEqual(55_000);
    expect(() => simpleStoryOutputTokens(10)).toThrow('simple_story_length_invalid');
  });

  it('keeps the instructions short and positive, without the old mechanism-first craft rules', () => {
    expect(SIMPLE_AUTHOR_INSTRUCTIONS.length).toBeLessThan(7000);
    expect(SIMPLE_EDITOR_INSTRUCTIONS.length).toBeLessThan(4000);
    for (const text of [SIMPLE_AUTHOR_INSTRUCTIONS, SIMPLE_EDITOR_INSTRUCTIONS]) {
      expect(text).not.toMatch(/Establish an important magical rule|work backwards|at least one interest must influence|childContribution/i);
    }
    expect(SIMPLE_AUTHOR_INSTRUCTIONS).toContain('it does not need to be the key that solves the story');
    expect(SIMPLE_AUTHOR_INSTRUCTIONS).toContain('The feeling is not cured');
  });

  it('prepares through the current writer acceptance and companion authority, offered roster by default', () => {
    const p = prepareSimpleStory(request(), options, 'x');
    expect(p.brief).toEqual(preparePersonalStory(request(), options).brief);
    expect(p.book.companion).toEqual({ shortName: 'דיני', character: p.brief.companion.character });
    expect(p.book.theme).toBe('רעשים ואזעקות');
    const input = JSON.parse(simpleAuthorCall(p).input);
    expect(input.book.pages).toBe(8); expect(input.book.storyShape).toBe(p.shape.spine);
    expect(simpleAuthorCall(p).input).not.toMatch(/requestId|characterDigest/);
    expect(() => prepareSimpleStory(request({ companion: { id: 'owl_shush' } }), options, 'x')).toThrow('story_invalid_request');
  });

  it.each(PERSONAL_CHARACTER_IDS)('prepares %s only through explicit text-only canon options', id => {
    const text = textCanonOptions(options);
    expect(text.fingerprint).not.toBe(options.fingerprint);
    const p = prepareSimpleStory(request({ companion: { id } }), text, 'x');
    expect(p.brief.companion.id).toBe(id);
    expect(nameVariants(p.brief.companion.character.name, 'last')).toContain(p.book.companion.shortName);
  });

  it('normalizes dashes into spaces or commas and counts them', () => {
    expect(normalizeStoryTypography('בית־ספר גדול')).toEqual({ text: 'בית ספר גדול', dashes: 1 });
    expect(normalizeStoryTypography('ואז — בום!').text).toBe('ואז, בום!');
    expect(normalizeStoryTypography('"בואי!" — קראה דיני.').text).toBe('"בואי!" קראה דיני.');
    expect(normalizeStoryTypography('— שלום לך').text).toBe('שלום לך');
    expect(normalizeStoryTypography('הוא חיכה –').text).toBe('הוא חיכה');
    expect(normalizeStoryTypography('בלי מקפים כאן.')).toEqual({ text: 'בלי מקפים כאן.', dashes: 0 });
    // Forms the current writer's four-character class misses, seen in model output.
    for (const dash of ['‐', '‑', '‒', '―', '−', '­', '﹣', '－']) {
      expect(normalizeStoryTypography(`בית${dash}ספר`)).toEqual({ text: 'בית ספר', dashes: 1 });
    }
  });

  it('accepts unpointed, plene and prefixed names', () => {
    expect(nameVariants('הכלבלבה זֹהַר', 'last')).toEqual(['זהר', 'זוהר']);
    expect(nameVariants('הפנדה עֲנָת', 'last')).toEqual(['ענת']);
    expect(nameVariants('הזיקית קִים', 'last')).toEqual(['קים']);
    expect(nameVariants('נועה מאיה', 'first')).toEqual(['נועה']);
    const pages = [{ text: 'ולבר היה רעיון.' }, { text: 'הם עברו בשביל.' }, { text: 'זוהר נבחה.' }];
    expect(pagesMentioning(pages, ['בר'])).toBe(1);
    expect(pagesMentioning(pages, nameVariants('הכלבלבה זֹהַר', 'last'))).toBe(1);
  });

  it('reports hard and soft hygiene findings deterministically', () => {
    const p = prepareSimpleStory(request(), options, 'x');
    expect(checkSimpleStory(p, story(p)).hard).toEqual([]);
    const cases: [(s: any) => any, string][] = [
      [s => ({ ...s, title: 'בר — ודיני' }), 'dash_in_prose'],
      [s => ({ ...s, title: 'בר‑דיני' }), 'dash_in_prose'],
      [s => ({ ...s, pages: s.pages.map((pg: any, i: number) => i === 2 ? { text: pg.text + ' בלי מלחמה' } : pg) }), 'excluded_subject'],
      [s => ({ ...s, pages: s.pages.map((pg: any) => ({ text: pg.text.replaceAll('בר', 'הילד') })) }), 'child_name_missing'],
      [s => ({ ...s, pages: s.pages.map((pg: any) => ({ text: pg.text.replaceAll('דיני', 'הדרקונית') })) }), 'companion_name_missing'],
      [s => ({ ...s, resilienceMoments: [{ ...s.resilienceMoments[0], page: 9 }] }), 'moment_pages'],
      [s => ({ ...s, pageMap: s.pageMap.map((r: any) => ({ ...r, factIds: ['f_unknownfact1'] })) }), 'unknown_fact'],
      [s => ({ ...s, pageMap: s.pageMap.map((r: any) => ({ ...r, factIds: [] })) }), 'interest_unmapped'],
    ];
    for (const [edit, code] of cases) expect(checkSimpleStory(p, story(p, edit)).hard).toContain(code);
    expect(checkSimpleStory(p, story(p, s => ({ ...s, pages: s.pages.map((pg: any) => ({ text: pg.text + ' ' + words(60) })) }))).soft[0]).toMatch(/^long_pages:1,2/);
    // Assumed parents are a soft, editor-visible finding unless an approved fact names them.
    const parents = (s: any) => ({ ...s, pages: s.pages.map((pg: any, i: number) => i === 1 ? { text: pg.text + ' ואבא רץ אליו.' } : pg) });
    expect(checkSimpleStory(p, story(p, parents)).soft).toContain('parent_mentioned');
    expect(editorFindings(p, checkSimpleStory(p, story(p, parents)))).toEqual([expect.stringContaining('The brief does not name the child\'s parents')]);
    const named = prepareSimpleStory(request({ facts: [...request().facts as any[], { id: 'f_testfamily01', kind: 'other', value: 'אוהב לבשל עם אבא', source: 'fixture' }] }), options, 'x');
    expect(checkSimpleStory(named, story(named, parents)).soft).not.toContain('parent_mentioned');
    // Pointed sound words are allowed: reported, never sent to the editor.
    const pointed = (s: any) => ({ ...s, pages: s.pages.map((pg: any, i: number) => i === 0 ? { text: pg.text + ' בּוֹיְנְג!' } : pg) });
    expect(checkSimpleStory(p, story(p, pointed)).soft).toContain('niqqud_in_prose');
    expect(editorFindings(p, checkSimpleStory(p, story(p, pointed)))).toEqual([]);
  });

  it('writes with exactly author then fresh editor and compiles into the storyboard contract', async () => {
    const p = prepareSimpleStory(request(), options, 'x');
    // The draft never names the companion: a mechanical finding must reach the editor.
    const generate = generator(p, s => ({ ...s, pages: s.pages.map((pg: any) => ({ text: pg.text.replaceAll('דיני', 'הדרקונית') })) }));
    const { result, evidence } = await writeSimpleStory(p, generate, { model: 'claude-opus-5-5', reservedUsd: 2 });
    expect(generate.mock.calls.map(([c]) => c.stage)).toEqual(['author', 'editor']);
    const editorInput = JSON.parse(generate.mock.calls[1][0].input);
    expect(editorInput.mechanicalFindings).toEqual(['Call the companion by its name (דיני) on more pages.']);
    expect(editorInput.draft.pages[0].page).toBe(1);
    expect(evidence.draftCheck.hard).toEqual(['companion_name_missing']);
    expect(personalStoryResultSchema.parse(result)).toEqual(result);
    expect(result.accounting).toMatchObject({ providerCalls: 2, estimatedUsd: 0.5, model: 'claude-opus-5-5' });
    expect(result.plan.resilience.moments).toEqual([{ pageNumber: 3, childChoice: 'בר מחזיק בכנף של דיני', whatHelps: 'דיני נשארת לידו' }]);
    expect(() => preparePersonalStoryboard(request(), result, options)).not.toThrow();
  });

  it('stops without a third call or draft fallback when the edit fails a hard check', async () => {
    const p = prepareSimpleStory(request(), options, 'x');
    const generate = generator(p, s => s, s => ({ ...s, pages: s.pages.map((pg: any) => ({ text: pg.text + ' מלחמה' })) }));
    const failure = await writeSimpleStory(p, generate, { model: 'claude-opus-5-5', reservedUsd: 2 }).catch(e => e);
    expect(failure).toBeInstanceOf(SimpleStoryError); expect(failure.code).toBe('simple_story_excluded_subject');
    expect(generate).toHaveBeenCalledTimes(2);
    expect((failure.evidence.accounting as any).providerCalls).toBe(2);
  });

  it('reports a coded failure when the edit cannot compile into the trimming contract', async () => {
    const p = prepareSimpleStory(request(), options, 'x');
    const failure = await writeSimpleStory(p, generator(p, s => s, s => ({ ...s, ending: '   ' })), { model: 'claude-opus-5-5', reservedUsd: 2 }).catch(e => e);
    expect(failure).toBeInstanceOf(SimpleStoryError); expect(failure.code).toBe('simple_story_compile_invalid');
    expect((failure.evidence.accounting as any).providerCalls).toBe(2);
  });

  it('does not call the editor when the author output breaks the contract', async () => {
    const p = prepareSimpleStory(request(), options, 'x');
    const generate = generator(p, s => ({ ...s, pages: s.pages.slice(1) }));
    const failure = await writeSimpleStory(p, generate, { model: 'claude-opus-5-5', reservedUsd: 2 }).catch(e => e);
    expect(failure.code).toBe('simple_story_author_invalid');
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('normalizes dashes in both stages and records the counts', async () => {
    const p = prepareSimpleStory(request(), options, 'x');
    const dash = (s: any) => ({ ...s, pages: s.pages.map((pg: any, i: number) => i === 0 ? { text: pg.text + ' ואז — בום!' } : pg) });
    const { result, evidence } = await writeSimpleStory(p, generator(p, dash, dash), { model: 'claude-opus-5-5', reservedUsd: 2 });
    expect([evidence.draftDashes, evidence.finalDashes]).toEqual([1, 1]);
    expect(result.manuscript.pages[0].text).toContain('ואז, בום!');
  });
});
