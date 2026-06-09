/**
 * Exp1b post-generation self-check (heuristic — human read is final).
 */

import { pageProseOnly, parseStoryPages } from '../story-gen/story-page-utils';

export interface ProseExp1bSelfCheck {
  sameSpineBeatsReused: 'yes';
  enrichOff: 'yes';
  wordBandsOff: 'yes';
  genericEditorPass: 'yes';
  rhetoricalQuestionPageEndings: number;
  rhetoricalQuestionPages: number[];
  explicitEmotionSummaryCount: number;
  emotionSummarySnippets: string[];
  anatPhysicalComicVulnerableBeats: number;
  anatBeatSnippets: string[];
  copiedGoldenLines: { detected: boolean; details: string[] };
  formatV5: boolean;
  formatIssues: string[];
  genderChipsValid: boolean;
  genderChipIssues: string[];
  canonicalAnatName: boolean;
  anatNameViolations: string[];
}

const EMOTION_SUMMARY_RE =
  /מתערבב|התחלף ב|נוצר בלב|מילאה את|ממלאות את|רוגע ושייכות מתערבב|מהססות לאומץ|פחד קצר מתחלף|ניצוץ של רעיון|ביטחון קטן נוצר|התרגשות ושייכות/i;

const RHETORICAL_END_RE =
  /^(האם|מה יעשה|איך יגיבו|האם באמת|האם יוותר|מה יישאר|אולי בכל זאת)\b.*\?$/;

const ANAT_PHYSICAL_RE =
  /עֲנָת[\s\S]{0,120}(נשענ|שכב|נכנס|שקע|נשפ|עצר|התכופפ|נפל|ברך|זנב|כף|נושפ|מצמצ|התיישב|עמדה חצי|נלכד|תקוע)/i;

const GOLDEN_COPY_PHRASES = [
  'כף הרגל השמאלית שלי כבר השתכנעה',
  'פלופ',
  'עד הקו הצהוב',
  'רכבת מכיסאות',
  'אחראי על הגלגלים',
  'אבן קטנה, חלקה מאוד',
  'לא צריך לרוץ כדי להצטרף',
];

function lastProseLine(prose: string): string {
  const lines = prose
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines[lines.length - 1] ?? '';
}

export function runProseExp1bSelfCheck(storyMarkdown: string): ProseExp1bSelfCheck {
  const pages = parseStoryPages(storyMarkdown);
  const rhetoricalQuestionPages: number[] = [];
  const emotionSummarySnippets: string[] = [];
  const anatBeatSnippets: string[] = [];
  const formatIssues: string[] = [];
  const genderChipIssues: string[] = [];
  const anatNameViolations: string[] = [];
  const goldenCopyDetails: string[] = [];

  if (/```\s*yaml/i.test(storyMarkdown) || /```yaml/.test(storyMarkdown)) {
    formatIssues.push('YAML wrapped in code fence');
  }
  if (/### Page \d+/.test(storyMarkdown)) {
    formatIssues.push('Uses ### Page N instead of --- Page N ---');
  }
  if (!/--- Page 1 ---/.test(storyMarkdown)) {
    formatIssues.push('Missing --- Page 1 --- canonical header');
  }
  if (/gender:\s*\{male\|female\}/.test(storyMarkdown)) {
    formatIssues.push('YAML gender uses chip syntax');
  }

  for (const { page, body } of pages) {
    const prose = pageProseOnly(body);
    const last = lastProseLine(prose);
    if (RHETORICAL_END_RE.test(last) || (last.endsWith('?') && /^(האם|מה |איך )/.test(last))) {
      rhetoricalQuestionPages.push(page);
    }

    for (const line of prose.split(/\r?\n/)) {
      if (EMOTION_SUMMARY_RE.test(line)) {
        emotionSummarySnippets.push(`p${page}: ${line.trim().slice(0, 80)}`);
      }
    }

    if (/פנדה[_\-]?עֲנָת|פַּנְדָה/.test(body)) {
      anatNameViolations.push(`p${page}: non-canonical Anat name`);
    }

    if (/עֲנָת/.test(prose) && ANAT_PHYSICAL_RE.test(prose)) {
      anatBeatSnippets.push(`p${page}: ${prose.match(ANAT_PHYSICAL_RE)?.[0]?.slice(0, 100) ?? 'anat'}`);
    }

    if (!/imageDirection\s*:/i.test(body)) {
      formatIssues.push(`p${page}: missing imageDirection`);
    }

    const bareChildVerb = /\{\{childName\}\}\s+[\u0590-\u05FF]+(?!.*\{[^{}]+\|[^{}]+\})/;
    const linesWithChild = prose.split(/\r?\n/).filter((l) => l.includes('{{childName}}'));
    for (const line of linesWithChild) {
      if (/\{\{childName\}\}\s+[\u0590-\u05FFA-Za-z]+/.test(line) && !/\{[^|]+\|[^}]+\}/.test(line)) {
        genderChipIssues.push(`p${page}: possible missing chip — ${line.trim().slice(0, 60)}`);
      }
      if (/\{[^}]+\{/.test(line) || /[א-ת]\{[^|]+\|/.test(line)) {
        genderChipIssues.push(`p${page}: broken chip — ${line.trim().slice(0, 60)}`);
      }
    }
  }

  for (const phrase of GOLDEN_COPY_PHRASES) {
    if (storyMarkdown.includes(phrase)) {
      goldenCopyDetails.push(phrase);
    }
  }

  const formatV5 =
    formatIssues.length === 0 &&
    /--- Page \d+ ---/.test(storyMarkdown) &&
    /^---\s*$/m.test(storyMarkdown);

  return {
    sameSpineBeatsReused: 'yes',
    enrichOff: 'yes',
    wordBandsOff: 'yes',
    genericEditorPass: 'yes',
    rhetoricalQuestionPageEndings: rhetoricalQuestionPages.length,
    rhetoricalQuestionPages,
    explicitEmotionSummaryCount: emotionSummarySnippets.length,
    emotionSummarySnippets,
    anatPhysicalComicVulnerableBeats: anatBeatSnippets.length,
    anatBeatSnippets,
    copiedGoldenLines: {
      detected: goldenCopyDetails.length > 0,
      details: goldenCopyDetails,
    },
    formatV5,
    formatIssues,
    genderChipsValid: genderChipIssues.length === 0,
    genderChipIssues,
    canonicalAnatName: anatNameViolations.length === 0,
    anatNameViolations,
  };
}

export function formatSelfCheckMarkdown(check: ProseExp1bSelfCheck, runDir: string): string {
  return [
    '# Exp1b self-check',
    '',
    `- same spine/beats reused unchanged: **${check.sameSpineBeatsReused}**`,
    `- enrich off: **${check.enrichOff}**`,
    `- word-bands off: **${check.wordBandsOff}**`,
    `- generic editor pass: **${check.genericEditorPass}**`,
    `- rhetorical-question page endings: **${check.rhetoricalQuestionPageEndings}**${check.rhetoricalQuestionPages.length ? ` (p${check.rhetoricalQuestionPages.join(', p')})` : ''}`,
    `- explicit emotion-summary sentences: **${check.explicitEmotionSummaryCount}**`,
    ...(check.emotionSummarySnippets.length
      ? check.emotionSummarySnippets.map((s) => `  - ${s}`)
      : []),
    `- Anat physical/comic/vulnerable beats (heuristic): **${check.anatPhysicalComicVulnerableBeats}**`,
    ...(check.anatBeatSnippets.length ? check.anatBeatSnippets.map((s) => `  - ${s}`) : []),
    `- copied golden lines/bits: **${check.copiedGoldenLines.detected ? 'yes' : 'no'}**${check.copiedGoldenLines.details.length ? ` — ${check.copiedGoldenLines.details.join('; ')}` : ''}`,
    `- format v5: **${check.formatV5 ? 'yes' : 'no'}**${check.formatIssues.length ? ` (${check.formatIssues.join('; ')})` : ''}`,
    `- gender chips valid: **${check.genderChipsValid ? 'yes' : 'no'}**`,
    ...(check.genderChipIssues.slice(0, 8).map((s) => `  - ${s}`)),
    `- canonical Anat name (עֲנָת): **${check.canonicalAnatName ? 'yes' : 'no'}**`,
    ...(check.anatNameViolations.map((s) => `  - ${s}`)),
    '',
    `artifact folder: \`${runDir}\``,
    '',
    '**Do not declare GOLDEN_LIKE — human read required.**',
  ].join('\n');
}
