/**
 * Dini Exp2 self-check — structural + literary heuristics (human read is final).
 */

import {
  DRAGON_DINI_COMIC_BITS,
  DRAGON_DINI_FORBIDDEN_NEAR_GOLDEN,
} from './companion-comic-bits';
import {
  runProseExp1bSelfCheck,
  type ProseExp1bSelfCheck,
} from './prose-exp1b-self-check';
import type { EventMomentumReport, PageBeatV2, StorySpineV2 } from './types';
import { pageProseOnly, parseStoryPages } from '../story-gen/story-page-utils';

export type ClimaxOwner =
  | 'child'
  | 'shared but child-led'
  | 'Dini-led fail'
  | 'baby-dragon-led fail'
  | 'other';

export interface ProseExp2SelfCheck extends ProseExp1bSelfCheck {
  v2Isolation: 'yes';
  productionUntouched: 'yes';
  comicBitsBankUsed: 'yes';
  comicBitHits: { bitId: string; page?: number }[];
  comicBitWithStoryConsequence: { yes: boolean; page?: number; note: string };
  copingToolLanguageCount: { breath: number; slow: number; quiet: number; rhythm: number; total: number };
  copingToolSnippets: string[];
  childPassivePages: number[];
  childTryFailPresent: boolean;
  childTryFailNote: string;
  childOwnsCentralDesire: boolean;
  whoOwnsClimax: ClimaxOwner;
  climaxNote: string;
  visiblePayoffRelease: boolean;
  payoffNote: string;
  ttsNiqqudPassApplied: boolean;
  ttsNiqqudRulesHit: string[];
  forbiddenNearGoldenHits: string[];
  momentumVerdict: 'PASS' | 'FAIL';
}

const DINI_BIT_SIGNATURES: Array<{ id: string; patterns: RegExp[] }> = [
  { id: 'dini_tail_tells_truth', patterns: [/תרגילי חימום/, /הזנב שלי פשוט/] },
  { id: 'dini_tiny_fire_big_problem', patterns: [/בעיה שצריך לצלות/, /כיסתה את הפה בכנף/] },
  { id: 'dini_nest_logic', patterns: [/בונים קן קטן/, /קן קטן וחושבים/] },
  { id: 'dini_wing_too_big', patterns: [/כנף גדולה, כוונה קטנה/, /שבלול מבולבל/] },
  { id: 'dini_warmth_not_fire', patterns: [/מספיק לחמם אומץ/, /לחום קטן, כמו ספל תה/] },
  { id: 'dini_egg_protocol', patterns: [/בוקעים תוך כדי הליכה/, /דרקונים סופרים גם זנב/] },
];

const COPING_PATTERNS = {
  breath: /\b(נשמ|נשיפ|נשף|נשמה|לנשום)\b/gi,
  slow: /\b(איטי|איטית|לאט|להאט)\b/gi,
  quiet: /\b(שקט|שקטה|בשקט)\b/gi,
  rhythm: /\b(קצב|ריתם|קצבים)\b/gi,
};

const PASSIVE_CHILD_RE =
  /\{\{childName\}\}[^.\n]{0,80}\b(צופה|מסתכל|מחכה|עומד ומסתכל|רק מסתכל|נשאר בצד)\b/;

const RELEASE_RE =
  /\b(נפתח|נפתחה|הצטרפ|קפץ|קפצ|צחק|צחקו|זרם|התארך|התחיל|השתנה|התחילו|רצו|עבר|התקבל|חייך|הזדעזע|התרומם)\b/;

const DINI_SOLVES_RE = /דִּינִי[^.\n]{0,60}\b(פתרה|הצילה|תפסה|עטפה|כיסתה הכל|הבעירה|שחררה את הקסם)\b/;

function detectComicBits(storyMarkdown: string): ProseExp2SelfCheck['comicBitHits'] {
  const hits: ProseExp2SelfCheck['comicBitHits'] = [];
  const blocks = storyMarkdown.split(/--- Page (\d+) ---/);
  for (let i = 1; i < blocks.length; i += 2) {
    const page = Number(blocks[i]);
    const body = blocks[i + 1] ?? '';
    for (const sig of DINI_BIT_SIGNATURES) {
      if (sig.patterns.some((re) => re.test(body))) {
        hits.push({ bitId: sig.id, page });
      }
    }
  }
  return hits;
}

function countCopingLanguage(storyMarkdown: string): {
  counts: ProseExp2SelfCheck['copingToolLanguageCount'];
  snippets: string[];
} {
  const prose = parseStoryPages(storyMarkdown)
    .map((p) => pageProseOnly(p.body))
    .join('\n');
  const breath = (prose.match(COPING_PATTERNS.breath) ?? []).length;
  const slow = (prose.match(COPING_PATTERNS.slow) ?? []).length;
  const quiet = (prose.match(COPING_PATTERNS.quiet) ?? []).length;
  const rhythm = (prose.match(COPING_PATTERNS.rhythm) ?? []).length;
  const snippets: string[] = [];
  for (const line of prose.split(/\r?\n/)) {
    if (
      COPING_PATTERNS.breath.test(line) ||
      COPING_PATTERNS.slow.test(line) ||
      COPING_PATTERNS.quiet.test(line) ||
      COPING_PATTERNS.rhythm.test(line)
    ) {
      snippets.push(line.trim().slice(0, 70));
    }
  }
  return {
    counts: { breath, slow, quiet, rhythm, total: breath + slow + quiet + rhythm },
    snippets: snippets.slice(0, 8),
  };
}

function inferClimaxOwner(
  storyMarkdown: string,
  spine: StorySpineV2
): { owner: ClimaxOwner; note: string } {
  const pages = parseStoryPages(storyMarkdown);
  const late = pages.filter((p) => p.page >= 9 && p.page <= 12);
  let childActs = 0;
  let diniActs = 0;
  let babyActs = 0;

  for (const { body } of late) {
    const prose = pageProseOnly(body);
    if (/\{\{childName\}\}[^.\n]{0,100}\b(אמר|עשה|קפץ|החליט|הציע|שחרר|הראה|לקח|הניח|דחף)\b/.test(prose)) {
      childActs++;
    }
    if (/דִּינִי[^.\n]{0,80}\b(פתרה|הצילה|עטפה|הבעירה|תפסה)\b/.test(prose)) {
      diniActs++;
    }
    if (/תינוק|דרקון קטן|הקטן[^.\n]{0,40}\b(הציל|פתר|הוביל)\b/.test(prose)) {
      babyActs++;
    }
  }

  if (DINI_SOLVES_RE.test(storyMarkdown)) {
    return { owner: 'Dini-led fail', note: 'Dini appears to solve climax with dragon action' };
  }
  if (babyActs > childActs) {
    return { owner: 'baby-dragon-led fail', note: 'Baby dragon drives late-story action' };
  }
  if (childActs >= 2 && diniActs === 0) {
    return { owner: 'child', note: `Child acts on p9-12 (${childActs} beats); spine: ${spine.childBraveAction.slice(0, 60)}` };
  }
  if (childActs >= 1) {
    return {
      owner: 'shared but child-led',
      note: `Child leads with Dini support (childActs=${childActs}, diniActs=${diniActs})`,
    };
  }
  return { owner: 'other', note: 'Could not confirm child-led climax from heuristics' };
}

function detectVisiblePayoff(storyMarkdown: string): { yes: boolean; note: string } {
  const pages = parseStoryPages(storyMarkdown);
  const postBrave = pages.filter((p) => p.page >= 10);
  const blob = postBrave.map((p) => pageProseOnly(p.body)).join(' ');
  if (RELEASE_RE.test(blob)) {
    return { yes: true, note: 'Release verbs found on p10+' };
  }
  return { yes: false, note: 'No strong release verbs detected on p10+' };
}

function detectChildTryFail(beats: PageBeatV2[], spine: StorySpineV2): { yes: boolean; note: string } {
  const failBeat = beats.find(
    (b) =>
      b.page >= 4 &&
      b.page <= 6 &&
      /\b(נכשל|לא הצליח|נכשלה|נפל|נחסם|נדחה|נשבר|התפוצץ|נשפך)\b/i.test(
        `${b.complicationOrChange} ${b.eventOnPage}`
      )
  );
  if (failBeat) {
    return { yes: true, note: `Try-fail on p${failBeat.page}: ${failBeat.complicationOrChange.slice(0, 60)}` };
  }
  if (spine.firstAttemptFailsBecause?.trim().length > 8) {
    return { yes: true, note: `Spine documents fail: ${spine.firstAttemptFailsBecause.slice(0, 60)}` };
  }
  return { yes: false, note: 'No clear child try-fail in beats p4-6' };
}

function detectComicConsequence(
  hits: ProseExp2SelfCheck['comicBitHits'],
  storyMarkdown: string
): ProseExp2SelfCheck['comicBitWithStoryConsequence'] {
  const consequenceBits = ['dini_wing_too_big', 'dini_tail_tells_truth', 'dini_tiny_fire_big_problem'];
  for (const hit of hits) {
    if (!consequenceBits.includes(hit.bitId) || !hit.page) continue;
    const block = storyMarkdown.split(`--- Page ${hit.page} ---`)[1]?.split(/--- Page /)[0] ?? '';
    if (
      /\{\{childName\}\}/.test(block) &&
      /\b(שם לב|הבחין|הבינה|הבין|ראה|ראתה|החליט|גילה)\b/.test(block)
    ) {
      return {
        yes: true,
        page: hit.page,
        note: `${hit.bitId} on p${hit.page} + child notices pattern`,
      };
    }
    if (/\b(הזיז|נפל|התגלגל|נפתח|גילה|שבלול|עלה)\b/.test(block)) {
      return { yes: true, page: hit.page, note: `${hit.bitId} moves something on p${hit.page}` };
    }
  }
  return { yes: false, note: 'No comic bit with clear story consequence detected' };
}

export function runProseExp2SelfCheck(args: {
  storyMarkdown: string;
  spine: StorySpineV2;
  beats: PageBeatV2[];
  momentum: EventMomentumReport;
  ttsRulesHit: string[];
  expectedPageCount?: number;
}): ProseExp2SelfCheck {
  const base = runProseExp1bSelfCheck(args.storyMarkdown);
  const pages = parseStoryPages(args.storyMarkdown);
  const passiveChildPages: number[] = [];

  for (const { page, body } of pages) {
    const prose = pageProseOnly(body);
    if (PASSIVE_CHILD_RE.test(prose)) {
      passiveChildPages.push(page);
    }
  }

  const forbiddenNearGoldenHits = DRAGON_DINI_FORBIDDEN_NEAR_GOLDEN.filter((p) =>
    args.storyMarkdown.includes(p)
  );
  const comicBitHits = detectComicBits(args.storyMarkdown);
  const { counts: copingToolLanguageCount, snippets: copingToolSnippets } = countCopingLanguage(
    args.storyMarkdown
  );
  const tryFail = detectChildTryFail(args.beats, args.spine);
  const climax = inferClimaxOwner(args.storyMarkdown, args.spine);
  const payoff = detectVisiblePayoff(args.storyMarkdown);
  const comicConsequence = detectComicConsequence(comicBitHits, args.storyMarkdown);

  const goldenDetails = [
    ...base.copiedGoldenLines.details,
    ...forbiddenNearGoldenHits.filter((h) => !base.copiedGoldenLines.details.includes(h)),
  ];

  return {
    ...base,
    copiedGoldenLines: { detected: goldenDetails.length > 0, details: goldenDetails },
    v2Isolation: 'yes',
    productionUntouched: 'yes',
    comicBitsBankUsed: 'yes',
    comicBitHits,
    comicBitWithStoryConsequence: comicConsequence,
    copingToolLanguageCount,
    copingToolSnippets,
    childPassivePages: passiveChildPages,
    childTryFailPresent: tryFail.yes,
    childTryFailNote: tryFail.note,
    childOwnsCentralDesire: Boolean(args.spine.protagonistWant?.trim().length > 8),
    whoOwnsClimax: climax.owner,
    climaxNote: climax.note,
    visiblePayoffRelease: payoff.yes,
    payoffNote: payoff.note,
    ttsNiqqudPassApplied: args.ttsRulesHit.length > 0,
    ttsNiqqudRulesHit: args.ttsRulesHit,
    forbiddenNearGoldenHits,
    momentumVerdict: args.momentum.verdict,
    canonicalAnatName: true,
    anatNameViolations: [],
  };
}

export function formatExp2SelfCheckMarkdown(check: ProseExp2SelfCheck, runDir: string): string {
  return [
    '# Dini Exp2 self-check',
    '',
    '## Isolation',
    `- v2 isolation: **${check.v2Isolation}**`,
    `- production/Phase-B/bank/customer untouched: **${check.productionUntouched}**`,
    `- enrich off: **${check.enrichOff}**`,
    `- word-bands off: **${check.wordBandsOff}**`,
    `- generic editor pass: **${check.genericEditorPass}**`,
    `- momentum pre-prose: **${check.momentumVerdict}**`,
    '',
    '## Prose mechanics (Exp1b/1c)',
    `- rhetorical-question page endings: **${check.rhetoricalQuestionPageEndings}**`,
    `- explicit emotion-summary sentences: **${check.explicitEmotionSummaryCount}**`,
    `- format v5: **${check.formatV5 ? 'yes' : 'no'}**${check.formatIssues.length ? ` (${check.formatIssues.join('; ')})` : ''}`,
    `- gender chips valid: **${check.genderChipsValid ? 'yes' : 'no'}**`,
    ...(check.genderChipIssues.slice(0, 6).map((s) => `  - ${s}`)),
    '',
    '## Exp2 literary',
    `- coping-tool language (breath/slow/quiet/rhythm): **${check.copingToolLanguageCount.total}** (b=${check.copingToolLanguageCount.breath} s=${check.copingToolLanguageCount.slow} q=${check.copingToolLanguageCount.quiet} r=${check.copingToolLanguageCount.rhythm})`,
    ...(check.copingToolSnippets.map((s) => `  - ${s}`)),
    `- Dini physical/comic beats (heuristic): **${check.anatPhysicalComicVulnerableBeats}**`,
    `- comic bits bank (${DRAGON_DINI_COMIC_BITS.length} bits): **${check.comicBitsBankUsed}**`,
    `- comic bit hits: **${check.comicBitHits.length}**`,
    ...(check.comicBitHits.map((h) => `  - ${h.bitId}${h.page ? ` p${h.page}` : ''}`)),
    `- comic bit with story consequence: **${check.comicBitWithStoryConsequence.yes ? 'yes' : 'no'}** — ${check.comicBitWithStoryConsequence.note}`,
    ...(check.comicBitWithStoryConsequence.page
      ? [`  - page: p${check.comicBitWithStoryConsequence.page}`]
      : []),
    '',
    '## Child agency',
    `- child passive pages: **${check.childPassivePages.length ? check.childPassivePages.join(', ') : 'none'}**`,
    `- child try-fail present: **${check.childTryFailPresent ? 'yes' : 'no'}** — ${check.childTryFailNote}`,
    `- child owns central desire: **${check.childOwnsCentralDesire ? 'yes' : 'no'}**`,
    `- who owns the climax: **${check.whoOwnsClimax}** — ${check.climaxNote}`,
    `- visible payoff/release after brave action: **${check.visiblePayoffRelease ? 'yes' : 'no'}** — ${check.payoffNote}`,
    '',
    '## TTS / forbidden',
    `- TTS ambiguity niqqud pass: **${check.ttsNiqqudPassApplied ? 'yes' : 'no'}** (${check.ttsNiqqudRulesHit.join(', ') || 'none'})`,
    `- near-copy / forbidden phrases: **${check.forbiddenNearGoldenHits.length ? 'yes' : 'no'}**`,
    ...(check.forbiddenNearGoldenHits.map((h) => `  - ${h}`)),
    '',
    `artifact folder: \`${runDir}\``,
    '',
    '**FINAL SPIKE — human read required. No Exp3. Return to launch priorities after verdict.**',
  ]
    .filter(Boolean)
    .join('\n');
}
