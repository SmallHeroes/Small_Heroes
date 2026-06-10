/**
 * Exp1c self-check — Exp1b heuristics + comic bits + golden-copy guard.
 */

import {
  PANDA_ANAT_COMIC_BITS,
  PANDA_ANAT_FORBIDDEN_NEAR_GOLDEN,
} from './companion-comic-bits';
import {
  formatSelfCheckMarkdown as formatExp1bSelfCheckMarkdown,
  runProseExp1bSelfCheck,
  type ProseExp1bSelfCheck,
} from './prose-exp1b-self-check';

export interface ProseExp1cSelfCheck extends ProseExp1bSelfCheck {
  comicBitsBankUsed: 'yes';
  comicBitHits: { bitId: string; page?: number; snippet: string }[];
  forbiddenNearGoldenHits: string[];
  brokenChipPatterns: string[];
  yamlPagesPresent: boolean;
  headerTimestampOk: boolean;
  mixedChildCompanionPlural: string[];
}

const BROKEN_CHIP_PATTERNS = ['{הרימו|הרימה}', '{הרים|הריםה}', '{הרים|הרימהה}'];

const BIT_SIGNATURES: Array<{ id: string; patterns: RegExp[] }> = [
  {
    id: 'anat_sand_sit_too_low',
    patterns: [/שקעה בחול/, /עמוק ממה שתכננתי/],
  },
  {
    id: 'anat_talks_to_bucket',
    patterns: [/דלי יקר/, /מחכה לתור/],
  },
  {
    id: 'anat_knees_voting',
    patterns: [/הברכיים שלי ביקשו/, /הצבעה אחת/],
  },
  {
    id: 'anat_leaf_landing_school',
    patterns: [/שיעור נחיתה/, /מתאמן בנחיתה/],
  },
  {
    id: 'anat_paw_whisper',
    patterns: [/הכפה שלי כבר רוצה/, /אני עוד מתעדכנת/],
  },
];

function detectComicBitHits(storyMarkdown: string): ProseExp1cSelfCheck['comicBitHits'] {
  const hits: ProseExp1cSelfCheck['comicBitHits'] = [];
  const pageBlocks = storyMarkdown.split(/--- Page (\d+) ---/);
  for (let i = 1; i < pageBlocks.length; i += 2) {
    const page = Number(pageBlocks[i]);
    const body = pageBlocks[i + 1] ?? '';
    for (const sig of BIT_SIGNATURES) {
      if (sig.patterns.some((re) => re.test(body))) {
        hits.push({
          bitId: sig.id,
          page,
          snippet: body.trim().slice(0, 80).replace(/\s+/g, ' '),
        });
      }
    }
  }
  return hits;
}

export function runProseExp1cSelfCheck(
  storyMarkdown: string,
  expectedPageCount = 12
): ProseExp1cSelfCheck {
  const base = runProseExp1bSelfCheck(storyMarkdown);

  const forbiddenNearGoldenHits = PANDA_ANAT_FORBIDDEN_NEAR_GOLDEN.filter((p) =>
    storyMarkdown.includes(p)
  );

  const brokenChipPatterns = BROKEN_CHIP_PATTERNS.filter((p) => storyMarkdown.includes(p));

  const mixedChildCompanionPlural: string[] = [];
  if (/\{\{childName\}\}\s+ו?עֲנָת\s+נשארו/.test(storyMarkdown)) {
    mixedChildCompanionPlural.push('{{childName}} ועֲנָת נשארו (ambiguous plural)');
  }

  const yamlPagesPresent = new RegExp(`^pages:\\s*${expectedPageCount}`, 'm').test(storyMarkdown);
  const headerTimestampOk =
    /^Generated:\s*20\d{2}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/m.test(storyMarkdown) ||
    /^Generated:\s*20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/m.test(storyMarkdown);

  const comicBitHits = detectComicBitHits(storyMarkdown);

  const goldenDetails = [
    ...base.copiedGoldenLines.details,
    ...forbiddenNearGoldenHits.filter((h) => !base.copiedGoldenLines.details.includes(h)),
  ];

  return {
    ...base,
    copiedGoldenLines: {
      detected: goldenDetails.length > 0,
      details: goldenDetails,
    },
    comicBitsBankUsed: 'yes',
    comicBitHits,
    forbiddenNearGoldenHits,
    brokenChipPatterns,
    yamlPagesPresent,
    headerTimestampOk,
    mixedChildCompanionPlural,
    genderChipsValid: base.genderChipsValid && brokenChipPatterns.length === 0,
    genderChipIssues: [
      ...base.genderChipIssues,
      ...brokenChipPatterns.map((p) => `broken chip pattern: ${p}`),
    ],
  };
}

export function formatExp1cSelfCheckMarkdown(check: ProseExp1cSelfCheck, runDir: string): string {
  const base = formatExp1bSelfCheckMarkdown(check, runDir).replace('# Exp1b self-check', '# Exp1c self-check');
  const extra = [
    '',
    '## Exp1c additions',
    `- comic bits bank (${PANDA_ANAT_COMIC_BITS.length} bits in bank): **${check.comicBitsBankUsed}**`,
    `- comic bit hits (heuristic): **${check.comicBitHits.length}**`,
    ...(check.comicBitHits.map((h) => `  - ${h.bitId}${h.page ? ` p${h.page}` : ''}`)),
    `- forbidden near-golden hits: **${check.forbiddenNearGoldenHits.length}**`,
    ...(check.forbiddenNearGoldenHits.map((h) => `  - ${h}`)),
    `- broken chip patterns: **${check.brokenChipPatterns.length}**`,
    ...(check.brokenChipPatterns.map((p) => `  - ${p}`)),
    `- yaml pages: ${expectedPageCountLabel(check)}`,
    `- header timestamp ok: **${check.headerTimestampOk ? 'yes' : 'no'}**`,
    `- mixed child+companion plural: **${check.mixedChildCompanionPlural.length ? 'yes' : 'no'}**`,
    ...(check.mixedChildCompanionPlural.map((m) => `  - ${m}`)),
    '',
    '**Decision fork:** If event movement + child agency + 2–3 fresh Anat bits + no golden-copy → viable bank component → Dini Exp2.',
    '**Hard stop — human read before Dini.**',
  ];
  return base + extra.join('\n');
}

function expectedPageCountLabel(check: ProseExp1cSelfCheck): string {
  return check.yamlPagesPresent ? '**yes**' : '**no**';
}
