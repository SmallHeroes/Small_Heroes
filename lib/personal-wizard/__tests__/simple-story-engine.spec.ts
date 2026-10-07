import { afterAll, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { zodTextFormat } from 'openai/helpers/zod';
import { resolvePersonalWizardOptions } from '../options';
import { PERSONAL_CHARACTER_IDS } from '../companion-character';
import { personalStoryResultSchema } from '../story-contract';
import { preparePersonalStory } from '../story-writer';
import { prepareCurrentPersonalStoryboard, preparePersonalStoryboard } from '../storyboard';
import type { CausalDispatch } from '../story-causal-experiment-runner';
import { SIMPLE_STORY_SHAPES, SIMPLE_AUTHOR_INSTRUCTIONS, SIMPLE_EDITOR_INSTRUCTIONS, SimpleStoryError, checkSimpleStory, editorFindings, nameVariants,
  pagesMentioning, pickStoryShape, prepareSimpleStory, simpleAuthorCall, simpleStoryDraftSchema, simpleStoryEditSchema, simpleStoryOutputTokens,
  unprotectedDashes, writeSimpleStory, type PreparedSimpleStory, type SimpleStoryCall } from '../simple-story-engine';
import { SIMPLE_RATES, TRIAL_EXIT_CODES, containedTransportFailure, main, runSimpleStoryTrial, textCanonOptions,
  type TrialTransport } from '../../../scripts/personal-simple-story';
import { CausalTransportError, type TransportReply, type WirePolicy } from '../../../scripts/personal-causal-trial-adapters';

const options = resolvePersonalWizardOptions();
const cp = (...points: number[]) => String.fromCodePoint(...points);
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
const write = (p: PreparedSimpleStory, generate: ReturnType<typeof generator>) => writeSimpleStory(p, generate, { model: 'claude-opus-5-5', reservedUsd: 2 });

// Runner boundary: a fake native transport with the receipts the real one produces.
const cleanExit = { killConfirmed: true, termination: { code: 0, signal: null } };
const reply = (output: unknown, usd = 0.1): TransportReply => ({ output, estimatedMicroUsd: Math.round(usd * 1e6), usage: { inputTokens: 10, outputTokens: 20 }, metadata: {}, raw: cleanExit });
const uncertain = () => new CausalTransportError('cli_termination', { estimatedMicroUsd: null, usage: null, metadata: {}, raw: { killConfirmed: false, termination: { code: null, signal: null } } });
function storyForInput(input: string, stage: string) {
  const { book } = JSON.parse(input);
  const interest = book.aboutTheChild.find((fact: any) => fact.kind === 'interest').id;
  const s = { title: `${book.child.name} ו${book.companion.shortName}`,
    pages: Array.from({ length: book.pages }, (_, i) => ({ text: `${book.child.name} ו${book.companion.shortName} יצאו לדרך. ${words(36)} ${'עוד '.repeat(i + 1)}` })),
    childGoal: 'מטרה', companionWant: 'רצון', comicPromise: 'בדיחה', ending: 'סוף', resilienceMoments: [{ page: 2, childChoice: 'בחירה', whatHelps: 'עזרה' }],
    pageMap: Array.from({ length: book.pages }, (_, i) => ({ location: 'חצר', transitionReason: 'סיבה', childAction: 'פעולה', companionAction: 'פעולה',
      consequence: 'תוצאה', factIds: i === 0 ? [interest] : [], continuity: 'רצף' })) };
  return stage === 'editor' ? { ...s, editorChanges: ['שינוי'] } : s;
}
const temps: string[] = [];
afterAll(() => { for (const dir of temps) rmSync(dir, { recursive: true, force: true }); });
function trial(ids: string[]) {
  const tmp = mkdtempSync(path.join(tmpdir(), 'simple-trial-')); temps.push(tmp);
  const out = path.join(tmp, 'run');
  const policy: WirePolicy = { executable: path.join(tmp, 'cli.exe'), executableSha256: 'a'.repeat(64), workspace: path.join(out, '_cli-workspace'),
    maxWireBytes: 104_000, rates: SIMPLE_RATES };
  return { tmp, out, policy, cases: ids.map(id => ({ id, seed: id, request: request() })) };
}
const goodTransport = (): TrialTransport => async (_wire, call) => reply(storyForInput(call.input, call.stage));

describe('simple story engine', () => {
  it('picks a deterministic, varied story spine from the seed', () => {
    expect(new Set(SIMPLE_STORY_SHAPES.map(s => s.id)).size).toBe(SIMPLE_STORY_SHAPES.length);
    expect(pickStoryShape('r'.repeat(64), 'a')).toEqual(pickStoryShape('r'.repeat(64), 'a'));
    const seen = new Set(Array.from({ length: 60 }, (_, i) => pickStoryShape('r'.repeat(64), `seed-${i}`).id));
    expect(seen.size).toBeGreaterThanOrEqual(10);
  });

  it('keeps spines free of example lists, which trials showed get copied as plots', () => {
    // 6 of 7 trial books whose spine listed examples used one of them (swapped parcel, slowest race, drawing come alive, a parade).
    for (const shape of SIMPLE_STORY_SHAPES) expect(shape.spine).not.toMatch(/[()]|for example|such as/i);
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
    // The no-dash style rule yields to an approved name, explicitly, in both prompts.
    expect(SIMPLE_AUTHOR_INSTRUCTIONS).toContain('always write names exactly as given');
    expect(SIMPLE_EDITOR_INSTRUCTIONS).toContain('names from the brief stay exactly as given, even with a hyphen');
  });

  it('leaves room for varied agency, no invented fear and open endings, without word bans', () => {
    // Contract text only; whether stories improve needs new outputs read by people.
    expect(SIMPLE_AUTHOR_INSTRUCTIONS).not.toMatch(/noticing what the grown-ups or creatures miss|moment of hesitation|final smile that echoes|with a twist at the end/);
    expect(SIMPLE_AUTHOR_INSTRUCTIONS).toContain('Spotting a clue is only one of them');
    expect(SIMPLE_AUTHOR_INSTRUCTIONS).toContain('do not invent a fear, a shyness or a hesitation');
    expect(SIMPLE_AUTHOR_INSTRUCTIONS).toContain('never the child\'s biography');
    expect(SIMPLE_AUTHOR_INSTRUCTIONS).toContain('not every scene is another test');
    expect(SIMPLE_AUTHOR_INSTRUCTIONS).toContain('may echo something from earlier or close on something new');
    expect(SIMPLE_EDITOR_INSTRUCTIONS).toContain('A thread that matters');
    expect(SIMPLE_EDITOR_INSTRUCTIONS).toContain('Remove any habit, weakness or history the brief does not give the child');
    expect(SIMPLE_EDITOR_INSTRUCTIONS).toContain('With no theme, do not add a fear or hesitation');
    expect(SIMPLE_EDITOR_INSTRUCTIONS).not.toContain('a tummy that tightens');
    // The resilience contract keeps its shape (min 1) for the existing plan schema; only the descriptions loosen.
    const moments = (zodTextFormat(simpleStoryDraftSchema(8), 'simple').schema as any).properties.resilienceMoments;
    expect(moments.minItems).toBe(1);
    expect(moments.description).not.toMatch(/hesitation/);
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

  it('accepts unpointed, plene and prefixed names', () => {
    expect(nameVariants('הכלבלבה זֹהַר', 'last')).toEqual(['זהר', 'זוהר']);
    expect(nameVariants('הפנדה עֲנָת', 'last')).toEqual(['ענת']);
    expect(nameVariants('הזיקית קִים', 'last')).toEqual(['קים']);
    expect(nameVariants('נועה מאיה', 'first')).toEqual(['נועה']);
    const pages = [{ text: 'ולבר היה רעיון.' }, { text: 'הם עברו בשביל.' }, { text: 'זוהר נבחה.' }];
    expect(pagesMentioning(pages, ['בר'])).toBe(1);
    expect(pagesMentioning(pages, nameVariants('הכלבלבה זֹהַר', 'last'))).toBe(1);
  });

  it('reports every dash form outside approved names, with snippets, and never rewrites', () => {
    const all = [0x2d, 0xad, 0x5be, 0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015, 0x2212, 0xfe58, 0xfe63, 0xff0d].map(n => cp(n));
    for (const dash of all) expect(unprotectedDashes(`בית${dash}ספר`, []).count).toBe(1);
    expect(unprotectedDashes('בלי מקפים כאן.', [])).toEqual({ count: 0, snippets: [] });
    // Meaning-bearing signs are reported as written, for an explicit rewrite.
    expect(unprotectedDashes(`המדחום הראה ${cp(0x2212)}3 מעלות.`, []).snippets[0]).toContain(`${cp(0x2212)}3`);
    expect(unprotectedDashes(`היו בין 3${cp(0x2013)}5 עוגיות.`, []).snippets[0]).toContain(`3${cp(0x2013)}5`);
    // An approved name keeps its own dash in any dash form; dashes elsewhere still count.
    for (const form of ['-', cp(0x5be), cp(0x2011)]) expect(unprotectedDashes(`ולי${form}ים קפצה גבוה`, ['לי-ים']).count).toBe(0);
    expect(unprotectedDashes(`לי-ים ${cp(0x2014)} קפצה`, ['לי-ים']).count).toBe(1);
    expect(unprotectedDashes('לי ים-קפצה', ['לי-ים']).count).toBe(1);
    // The same boundary rule as the name gate: a prefixed name is the name; inside another word it is not.
    expect(unprotectedDashes('ובלי-ים הכול שקט', ['לי-ים']).count).toBe(0);
    expect(unprotectedDashes('עלי-ים נשר', ['לי-ים']).count).toBe(1);
    expect(unprotectedDashes('לי-יםם', ['לי-ים']).count).toBe(1);
    expect(pagesMentioning([{ text: 'עלי-ים נשר' }, { text: 'ולי-ים צחקה' }], ['לי-ים'])).toBe(1);
  });

  it('reports hard and soft hygiene findings deterministically, one clause at a time', () => {
    const p = prepareSimpleStory(request(), options, 'x');
    expect(checkSimpleStory(p, story(p)).hard).toEqual([]);
    const cases: [(s: any) => any, string][] = [
      [s => ({ ...s, pages: s.pages.slice(1) }), 'page_count'],
      [s => ({ ...s, pageMap: s.pageMap.slice(1) }), 'page_map_count'],
      [s => ({ ...s, title: 'בר — ודיני' }), 'dash_in_prose'],
      [s => ({ ...s, title: `בר${cp(0x2011)}דיני` }), 'dash_in_prose'],
      [s => ({ ...s, pages: s.pages.map((pg: any, i: number) => i === 4 ? { text: pg.text + ' imageDirection: wide shot of the yard' } : pg) }), 'direction_in_prose'],
      [s => ({ ...s, pages: s.pages.map((pg: any, i: number) => i === 2 ? { text: pg.text + ' בלי מלחמה' } : pg) }), 'excluded_subject'],
      [s => ({ ...s, pages: s.pages.map((pg: any) => ({ text: pg.text.replaceAll('בר', 'הילד') })) }), 'child_name_missing'],
      [s => ({ ...s, pages: s.pages.map((pg: any) => ({ text: pg.text.replaceAll('דיני', 'הדרקונית') })) }), 'companion_name_missing'],
      [s => ({ ...s, resilienceMoments: [{ ...s.resilienceMoments[0], page: 9 }] }), 'moment_pages'],
      [s => ({ ...s, resilienceMoments: [s.resilienceMoments[0], { ...s.resilienceMoments[0], childChoice: 'עוד בחירה' }] }), 'moment_pages'],
      [s => ({ ...s, pageMap: s.pageMap.map((r: any) => ({ ...r, factIds: ['f_unknownfact1'] })) }), 'unknown_fact'],
      [s => ({ ...s, pageMap: s.pageMap.map((r: any) => ({ ...r, factIds: [] })) }), 'interest_unmapped'],
    ];
    for (const [edit, code] of cases) expect(checkSimpleStory(p, story(p, edit)).hard).toContain(code);
    expect(checkSimpleStory(p, story(p, s => ({ ...s, pages: s.pages.map((pg: any) => ({ text: pg.text + ' ' + words(60) })) }))).soft[0]).toMatch(/^long_pages:1,2/);
    // The dash finding quotes the place to rewrite.
    const range = (s: any) => ({ ...s, pages: s.pages.map((pg: any, i: number) => i === 1 ? { text: `${pg.text} היו בין 3${cp(0x2013)}5 עוגיות.` } : pg) });
    expect(editorFindings(p, checkSimpleStory(p, story(p, range)))).toEqual([expect.stringContaining(`3${cp(0x2013)}5`)]);
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

  it('writes with exactly author then fresh editor; generic contract and archive storyboard read it, current storyboard admission does not', async () => {
    const p = prepareSimpleStory(request(), options, 'x');
    // The draft never names the companion: a mechanical finding must reach the editor.
    const generate = generator(p, s => ({ ...s, pages: s.pages.map((pg: any) => ({ text: pg.text.replaceAll('דיני', 'הדרקונית') })) }));
    const { result, evidence } = await write(p, generate);
    expect(generate.mock.calls.map(([c]) => c.stage)).toEqual(['author', 'editor']);
    const editorInput = JSON.parse(generate.mock.calls[1][0].input);
    expect(editorInput.mechanicalFindings).toEqual(['Call the companion by its name (דיני) on more pages.']);
    expect(editorInput.draft.pages[0].page).toBe(1);
    expect(evidence.draftCheck.hard).toEqual(['companion_name_missing']);
    expect(personalStoryResultSchema.parse(result)).toEqual(result);
    expect(result.accounting).toMatchObject({ providerCalls: 2, estimatedUsd: 0.5, model: 'claude-opus-5-5' });
    expect(result.plan.resilience.moments).toEqual([{ pageNumber: 3, childChoice: 'בר מחזיק בכנף של דיני', whatHelps: 'דיני נשארת לידו' }]);
    expect(() => preparePersonalStoryboard(request(), result, options)).not.toThrow();
    // No semantic-edit receipt: the current flow refuses it, and nothing here manufactures one.
    expect(() => prepareCurrentPersonalStoryboard(request(), result, options)).toThrow('current_edit_required');
  });

  it('never rewrites text: a meaning-bearing sign goes back to the editor, and one in the final text holds the book', async () => {
    const p = prepareSimpleStory(request(), options, 'x');
    const minus = (s: any) => ({ ...s, pages: s.pages.map((pg: any, i: number) => i === 0 ? { text: `${pg.text} המדחום הראה ${cp(0x2212)}3 מעלות.` } : pg) });
    const generate = generator(p, minus);
    const { result, evidence } = await write(p, generate);
    expect(evidence.draftCheck.hard).toEqual(['dash_in_prose']);
    const editorInput = JSON.parse(generate.mock.calls[1][0].input);
    expect(editorInput.mechanicalFindings[0]).toContain(`${cp(0x2212)}3`);
    expect(editorInput.draft.pages[0].text).toContain(`${cp(0x2212)}3 מעלות`);
    expect(result.manuscript.pages.map(pg => pg.text)).toEqual(story(p).pages.map((pg: any) => pg.text.trim()));
    const range = (s: any) => ({ ...s, pages: s.pages.map((pg: any, i: number) => i === 2 ? { text: `${pg.text} היו בין 3${cp(0x2013)}5 עוגיות.` } : pg) });
    const held = await write(p, generator(p, s => s, range)).catch(e => e);
    expect(held).toBeInstanceOf(SimpleStoryError); expect(held.code).toBe('simple_story_dash_in_prose');
    expect(held.evidence.edited.pages[2].text).toContain(`3${cp(0x2013)}5`);
  });

  it.each([['-', '-'], ['-', cp(0x5be)], ['-', cp(0x2011)], [cp(0x5be), cp(0x5be)], [cp(0x5be), '-']])(
    'keeps an approved hyphenated name (dash %j) written with %j, unchanged, through the write boundary', async (approvedDash, writtenDash) => {
      const approved = `לי${approvedDash}ים`, written = `לי${writtenDash}ים`;
      const p = prepareSimpleStory(request({ child: { ...request().child, name: approved } }), options, 'x');
      expect(p.brief.child.name).toBe(approved);
      const named = (s: any) => ({ ...s, title: s.title.replaceAll('בר', written), pages: s.pages.map((pg: any) => ({ text: pg.text.replaceAll('בר', written) })) });
      const { result, evidence } = await write(p, generator(p, named, named));
      expect([evidence.draftCheck.hard, evidence.finalCheck.hard]).toEqual([[], []]);
      expect(result.manuscript.pages[0].text.startsWith(written)).toBe(true);
      // A different spelling is not the approved identity: the gate still holds.
      const spaced = (s: any) => ({ ...s, pages: s.pages.map((pg: any) => ({ text: pg.text.replaceAll('בר', 'לי ים') })) });
      const held = await write(p, generator(p, spaced, spaced)).catch(e => e);
      expect(held.code).toBe('simple_story_child_name_missing');
      expect(held.evidence.findings).toContain(`Use the child's name exactly as given (${approved}) on more pages.`);
    });

  it('stops without a third call or draft fallback when the edit fails a hard check', async () => {
    const p = prepareSimpleStory(request(), options, 'x');
    const generate = generator(p, s => s, s => ({ ...s, pages: s.pages.map((pg: any) => ({ text: pg.text + ' מלחמה' })) }));
    const failure = await write(p, generate).catch(e => e);
    expect(failure).toBeInstanceOf(SimpleStoryError); expect(failure.code).toBe('simple_story_excluded_subject');
    expect(generate).toHaveBeenCalledTimes(2);
    expect((failure.evidence.accounting as any).providerCalls).toBe(2);
  });

  it('reports a coded failure when the edit cannot compile into the trimming contract', async () => {
    const p = prepareSimpleStory(request(), options, 'x');
    const failure = await write(p, generator(p, s => s, s => ({ ...s, ending: '   ' }))).catch(e => e);
    expect(failure).toBeInstanceOf(SimpleStoryError); expect(failure.code).toBe('simple_story_compile_invalid');
    expect((failure.evidence.accounting as any).providerCalls).toBe(2);
  });

  it('does not call the editor when the author output breaks the contract', async () => {
    const p = prepareSimpleStory(request(), options, 'x');
    const generate = generator(p, s => ({ ...s, pages: s.pages.slice(1) }));
    const failure = await write(p, generate).catch(e => e);
    expect(failure.code).toBe('simple_story_author_invalid');
    expect(generate).toHaveBeenCalledTimes(1);
  });
});

describe('simple story trial runner boundary', () => {
  it('treats a transport failure as contained only after a clean exit with a known cost', () => {
    const receipt = (raw: unknown, usd: number | null) => ({ estimatedMicroUsd: usd, usage: null, metadata: {}, raw });
    expect(containedTransportFailure(new CausalTransportError('provider_or_schema', receipt(cleanExit, 90_000)))).toBe(true);
    expect(containedTransportFailure(uncertain())).toBe(false);
    expect(containedTransportFailure(new CausalTransportError('cli_termination', receipt({ killConfirmed: true, termination: { code: 1, signal: null } }, 90_000)))).toBe(false);
    expect(containedTransportFailure(new CausalTransportError('usage', receipt(cleanExit, null)))).toBe(false);
    expect(containedTransportFailure(new CausalTransportError('cli_termination', receipt({ killConfirmed: true, termination: { code: null, signal: 'SIGTERM' } }, 90_000)))).toBe(false);
    expect(containedTransportFailure(new Error('causal_host_wire_contract'))).toBe(false);
  });

  it('dispatches nothing after an uncertain native termination at concurrency one', async () => {
    const t = trial(['case-a', 'case-b', 'case-c']);
    const transport = vi.fn<TrialTransport>(async () => { throw uncertain(); });
    const run = await runSimpleStoryTrial({ cases: t.cases, options, out: t.out, budgetMicroUsd: 20e6, concurrency: 1, policy: t.policy, transport });
    expect(transport).toHaveBeenCalledTimes(1);
    expect([run.status, run.exitCode, run.costCertain]).toEqual(['stopped', TRIAL_EXIT_CODES.stopped, false]);
    expect(run.stop).toMatchObject({ reason: 'uncertain_transport', caseId: 'case-a', stage: 'author', code: 'cli_termination', killConfirmed: false, estimatedMicroUsd: null });
    expect(run.rows.map(r => [r.id, r.code, r.dispatched])).toEqual([['case-a', 'transport_cli_termination', 1], ['case-b', 'not_dispatched', 0], ['case-c', 'not_dispatched', 0]]);
    expect(JSON.parse(readFileSync(path.join(t.out, 'run-summary.json'), 'utf8'))).toMatchObject({ status: 'stopped', exitCode: 2, costCertain: false });
  });

  it('aborts in-flight work and dispatches nothing more after an uncertain termination at concurrency two', async () => {
    const t = trial(['case-a', 'case-b', 'case-c']);
    let calls = 0, release!: () => void; const secondStarted = new Promise<void>(resolve => { release = resolve; });
    const abortedSiblings: boolean[] = [];
    const transport = vi.fn<TrialTransport>(async (_wire, _call: CausalDispatch, signal) => {
      calls += 1;
      if (calls === 1) { await secondStarted; throw uncertain(); }
      release();
      await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true }));
      abortedSiblings.push(signal.aborted);
      throw new CausalTransportError('cli_termination', { estimatedMicroUsd: null, usage: null, metadata: {}, raw: { killConfirmed: true, stopped: true, termination: { code: null, signal: 'SIGTERM' } } });
    });
    const run = await runSimpleStoryTrial({ cases: t.cases, options, out: t.out, budgetMicroUsd: 20e6, concurrency: 2, policy: t.policy, transport });
    expect(transport).toHaveBeenCalledTimes(2);
    expect(abortedSiblings).toEqual([true]);
    expect([run.status, run.stop?.caseId, run.stop?.reason]).toEqual(['stopped', 'case-a', 'uncertain_transport']);
    expect(run.rows.map(r => [r.id, r.dispatched])).toEqual([['case-a', 1], ['case-b', 1], ['case-c', 0]]);
    expect(run.rows[2].code).toBe('not_dispatched');
  });

  it('does not dispatch the editor of a sibling whose author call finished after the stop', async () => {
    const t = trial(['case-a', 'case-b']);
    let calls = 0, release!: () => void; const secondStarted = new Promise<void>(resolve => { release = resolve; });
    const transport = vi.fn<TrialTransport>(async (_wire, call, signal) => {
      calls += 1;
      if (calls === 1) { await secondStarted; throw uncertain(); }
      release();
      // A process that completes cleanly just as the stop lands; its author output is valid.
      await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true }));
      return reply(storyForInput(call.input, call.stage));
    });
    const run = await runSimpleStoryTrial({ cases: t.cases, options, out: t.out, budgetMicroUsd: 20e6, concurrency: 2, policy: t.policy, transport });
    expect(transport).toHaveBeenCalledTimes(2);
    expect(run.rows.map(r => [r.id, r.code, r.dispatched])).toEqual([['case-a', 'transport_cli_termination', 1], ['case-b', 'trial_halted', 1]]);
    expect(run.status).toBe('stopped');
  });

  it('continues after a contained book failure and reports a partial run with exit 1', async () => {
    const t = trial(['case-a', 'case-b']);
    let calls = 0;
    const transport = vi.fn<TrialTransport>(async (_wire, call) => { calls += 1; return calls === 1 ? reply({}) : reply(storyForInput(call.input, call.stage)); });
    const run = await runSimpleStoryTrial({ cases: t.cases, options, out: t.out, budgetMicroUsd: 20e6, concurrency: 1, policy: t.policy, transport });
    expect([run.status, run.exitCode, run.costCertain, run.stop]).toEqual(['partial', 1, true, null]);
    expect(run.rows.map(r => [r.id, r.ok, r.code])).toEqual([['case-a', false, 'simple_story_author_invalid'], ['case-b', true, null]]);
    expect(transport).toHaveBeenCalledTimes(3);
  });

  it('stops admission at the budget ceiling instead of dispatching past it', async () => {
    const t = trial(['case-a', 'case-b']);
    const transport = vi.fn<TrialTransport>(async (_wire, call) => reply(storyForInput(call.input, call.stage), 0.6));
    const run = await runSimpleStoryTrial({ cases: t.cases, options, out: t.out, budgetMicroUsd: 1e6, concurrency: 1, policy: t.policy, transport });
    expect(transport).toHaveBeenCalledTimes(1);
    expect([run.status, run.stop?.reason, run.costCertain]).toEqual(['stopped', 'budget', true]);
    expect(run.rows.map(r => [r.id, r.code, r.dispatched])).toEqual([['case-a', 'trial_budget_exhausted', 1], ['case-b', 'not_dispatched', 0]]);
  });

  it('returns the process exit code from the CLI entry: 0 complete, 1 contained failure, 2 stopped', async () => {
    const transports: Record<string, () => TrialTransport> = {
      complete: goodTransport,
      contained: () => async () => reply({}),
      stopped: () => async () => { throw uncertain(); },
    };
    const codes: Record<string, number> = {};
    for (const [name, make] of Object.entries(transports)) {
      const tmp = mkdtempSync(path.join(tmpdir(), 'simple-cli-')); temps.push(tmp);
      const exe = path.join(tmp, 'cli.exe'); writeFileSync(exe, 'fake native executable');
      const cases = path.join(tmp, 'cases.json'); writeFileSync(cases, JSON.stringify([{ id: 'case-a', seed: 'x', request: request() }]));
      codes[name] = await main(['--cases', cases, '--out', path.join(tmp, 'run'), '--budget-usd', '5', '--concurrency', '1', '--live',
        '--executable', exe, '--executable-sha256', createHash('sha256').update('fake native executable').digest('hex')], { createTransport: make, log: () => {} });
    }
    expect(codes).toEqual({ complete: 0, contained: 1, stopped: 2 });
  });
});
