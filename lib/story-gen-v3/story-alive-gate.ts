/**
 * StoryAlive Gate — Sprint B post-prose QA.
 */

import {
  analyzeGenderChips,
  hasValidYamlFrontmatter,
  pageProseOnly,
  parseStoryPages,
} from '../story-gen/story-page-utils';
import type { ChipSafetyReport } from '../story-gen/chip-safety';
import {
  scanRawArtifactTokensInMarkdown,
  scanSlashChipsInMarkdown,
  type RawArtifactTokenScanReport,
  type SlashChipStyleReport,
} from './artifact-token-scan';
import {
  scanSuffixChipsInMarkdown,
  type SuffixChipScanReport,
} from './suffix-chip-scan';
import { isP12EndingComplete, scanProseNotImagePrompt } from './prose-not-image-prompt';
import type { PageBeatV3, StoryPremiseCandidate } from './types';

export type StoryAliveVerdict =
  | 'PASS'
  | 'AUTHOR_PASS'
  | 'REPAIR_PROSE'
  | 'REPAIR_BEATS'
  | 'REGENERATE_PROSE'
  | 'FAIL';

export interface StoryAliveCheck {
  id: string;
  pass: boolean;
  note?: string;
}

export interface StoryAliveReport {
  verdict: StoryAliveVerdict;
  checks: StoryAliveCheck[];
  hardFails: string[];
  softWarnings: string[];
  humorMoments: number;
  therapyWordHits: string[];
  anchorHits: Record<string, boolean>;
  completedP12: boolean;
  proseNotImagePromptHits: Array<{ page: number; line: string }>;
  artifactTokenScan?: RawArtifactTokenScanReport;
  slashChipStyle?: SlashChipStyleReport;
  suffixChipScan?: SuffixChipScanReport;
}

const THERAPY_RE =
  /\b(הבין ש|הבינה ש|למד ש|למדה ש|לפעמים צריך|מרחב|לשחרר|שליטה|גבול טוב|נשימה עמוקה|הרגיעו|הרגישו יחד)\b/i;

const RHETORICAL_END_RE = /[?؟]\s*$/;

const UNSAFE_RE = /מיקרוגל פעיל|להבה|ילד מפעיל מיקרוגל|דרקון בתוך מיקרוגל/i;

function stripHebrewDiacritics(text: string): string {
  return text.replace(/[\u0591-\u05C7]/g, '');
}

const ANCHOR_PATTERNS: Record<string, RegExp> = {
  promised_sibling: /הבטיח|אח\/אחות|ערב סרט|בפעם הראשונה/,
  kernel_ash: /אש/,
  dini_arrives: /דיני/,
  safety_nest: /קן|סירים|מגבות/,
  lid_try: /מכסה/,
  lid_fail: /רועד|נפתח|ענן/,
  cloud_wing: /כנף/,
  warm_breath: /נשיפה|חמימ|חמאה/,
  wing_roof: /גג|כנף.*(מעל|סוגר)/,
  kernel_nose: /על האף|אף/,
  towel_discovery: /מגבת|מפרש|פְלוּף|נחתו/,
  wind_tunnel: /מנהרת|מפרש|רוח/,
  popcorn_rain: /גשם|קשת|קופץ בקשת/,
  od_seret: /עוד סרט|אחרי הסרט/,
};

function buildPremiseAnchors(premise: StoryPremiseCandidate): Record<string, RegExp> {
  const phrases = [
    premise.openingWeirdEvent,
    premise.childWant,
    premise.physicalProblem,
    premise.braveChildAction,
    premise.bigReleasePayoff,
  ]
    .join(' ')
    .split(/[\s,.:;—–-]+/)
    .map((w) => w.replace(/[^\u0590-\u05FFa-zA-Z0-9]/g, ''))
    .filter((w) => w.length >= 4)
    .slice(0, 8);

  const anchors: Record<string, RegExp> = {};
  phrases.forEach((word, i) => {
    anchors[`premise_kw_${i + 1}`] = new RegExp(word, 'i');
  });
  if (/קוֹקוֹ|קוקו/i.test(JSON.stringify(premise))) {
    anchors.koko_present = /קוֹקוֹ|קוקו/;
  }
  return anchors;
}

export function runStoryAliveGate(args: {
  storyMarkdown: string;
  beats: PageBeatV3[];
  chipSafety: ChipSafetyReport;
  chipNormalizeFailed?: boolean;
  companionId?: string;
  premise?: StoryPremiseCandidate;
  endingProfile?: 'dini_popcorn' | 'koko_transition' | 'confidence_generic';
  expectedPageCount?: number;
}): StoryAliveReport {
  const checks: StoryAliveCheck[] = [];
  const hardFails: string[] = [];
  const softWarnings: string[] = [];
  const pages = parseStoryPages(args.storyMarkdown);
  const fullProse = pages.map((p) => pageProseOnly(p.body)).join('\n');
  const anchorProse = stripHebrewDiacritics(fullProse);

  const artifactTokenScan = scanRawArtifactTokensInMarkdown(args.storyMarkdown);
  checks.push({
    id: 'no_raw_artifact_tokens',
    pass: artifactTokenScan.pass,
    note: artifactTokenScan.tokens.join(', ') || 'none',
  });
  if (!artifactTokenScan.pass) {
    hardFails.push(
      `raw artifact tokens in prose: ${artifactTokenScan.tokens.join(', ')}`
    );
  }

  const slashChipStyle = scanSlashChipsInMarkdown(args.storyMarkdown);
  checks.push({
    id: 'slash_chip_style',
    pass: slashChipStyle.slashChipStylePass,
    note: `${slashChipStyle.slashChipCount} slash chip(s)`,
  });
  if (!slashChipStyle.slashChipStylePass) {
    hardFails.push(`slash chips in prose: ${slashChipStyle.slashChipCount}`);
  }

  const suffixChipScan = scanSuffixChipsInMarkdown(args.storyMarkdown);
  checks.push({
    id: 'suffix_chip_leak',
    pass: suffixChipScan.suffixChipPass,
    note: `${suffixChipScan.suffixChipCount} suffix chip(s)`,
  });
  if (!suffixChipScan.suffixChipPass) {
    hardFails.push(`suffix chips in prose: ${suffixChipScan.suffixChipCount}`);
  }

  const isKoko = args.companionId === 'chameleon_koko';
  const isBunny = args.companionId === 'bunny_ometz';
  const isLion = args.companionId === 'lion_shaket';
  const isTurtle = args.companionId === 'turtle_beiti';
  const isConfidenceCompanion = isKoko || isBunny || isLion || isTurtle;
  const expectedPageCount = args.expectedPageCount ?? 12;
  const anchorPatterns =
    isConfidenceCompanion && args.premise ? buildPremiseAnchors(args.premise) : ANCHOR_PATTERNS;

  const anchorHits: Record<string, boolean> = {};
  let anchorMisses = 0;
  for (const [key, re] of Object.entries(anchorPatterns)) {
    anchorHits[key] = re.test(anchorProse);
    checks.push({ id: `anchor_${key}`, pass: anchorHits[key] });
    if (!anchorHits[key]) {
      anchorMisses++;
      if (!isConfidenceCompanion) hardFails.push(`missing anchor: ${key}`);
    }
  }
  if (isConfidenceCompanion && anchorMisses > Math.ceil(Object.keys(anchorPatterns).length * 0.75)) {
    softWarnings.push(`premise anchors: ${anchorMisses} misses`);
  }

  const p1 = pages.length > 0 ? pageProseOnly(pages[0].body) : '';
  const hookAlive = isKoko
    ? p1.length > 40 && /קוֹקוֹ|קוקו|ארגז|מדבקה|מסדרון|חדר|תיק|מפה/i.test(p1)
    : isBunny
      ? p1.length > 35 && /בוּנִי|אוזנ|אחות|חדר|קליניק/i.test(p1)
      : isLion
        ? p1.length > 35 && /שלולית|צעק|ליאו|לֵיוֹ|שאג|מגרש/i.test(p1)
        : isTurtle
          ? p1.length > 35 && /טוֹלִי|קונכייה|חדר|בית/i.test(p1)
          : /אש|פופקורן|גרעין/i.test(p1);
  checks.push({ id: 'hook_alive_p1', pass: hookAlive });
  if (!hookAlive && !isConfidenceCompanion) hardFails.push('hook not alive on page 1');
  if (!hookAlive && isConfidenceCompanion) softWarnings.push('hook not alive on page 1');

  const earlyProse = pages
    .slice(0, 3)
    .map((p) => pageProseOnly(p.body))
    .join(' ');
  const laughEarly = isKoko
    ? pages.length >= 3 && /קוֹקוֹ|קוקו|צבע|ירוק|כתום|פסים|התחבא/i.test(earlyProse)
    : isBunny
      ? pages.length >= 3 && /בוּנִי|אוזנ|פסל|קופצ/i.test(earlyProse)
      : isLion
        ? pages.length >= 3 && /ליאו|לֵיוֹ|שאג|שלולית|מחליק/i.test(earlyProse)
        : isTurtle
          ? pages.length >= 3 && /טוֹלִי|קונכייה|צחק|עגלה/i.test(earlyProse)
          : pages.length >= 3 && /דיני|קן|פופקורן|אש/i.test(earlyProse);
  checks.push({ id: 'humor_by_p3', pass: laughEarly });
  if (!laughEarly && !isConfidenceCompanion) hardFails.push('no humor signal by page 3');
  if (!laughEarly && isConfidenceCompanion) softWarnings.push('no humor signal by page 3');

  const therapyWordHits: string[] = [];
  for (const line of fullProse.split(/\r?\n/)) {
    if (THERAPY_RE.test(line)) therapyWordHits.push(line.trim().slice(0, 60));
  }
  checks.push({ id: 'no_therapy_vocab', pass: therapyWordHits.length === 0 });
  if (therapyWordHits.length) hardFails.push(`therapy vocabulary: ${therapyWordHits.length}`);

  if (UNSAFE_RE.test(fullProse)) hardFails.push('unsafe kitchen imagery');

  const rhetoricalPages: number[] = [];
  for (const { page, body } of pages) {
    const prose = pageProseOnly(body);
    const lines = prose.split(/\r?\n/).filter(Boolean);
    const last = lines[lines.length - 1] ?? '';
    if (RHETORICAL_END_RE.test(last) && /^(האם|מה |איך )/.test(last)) {
      rhetoricalPages.push(page);
    }
  }
  checks.push({ id: 'no_rhetorical_endings', pass: rhetoricalPages.length <= 1 });
  if (rhetoricalPages.length > 1) softWarnings.push(`rhetorical endings: p${rhetoricalPages.join(',')}`);

  const penult = pages.find((p) => p.page === expectedPageCount - 1);
  const finalP = pages.find((p) => p.page === expectedPageCount);
  const penultProse = penult ? pageProseOnly(penult.body) : '';
  const finalProse = finalP ? pageProseOnly(finalP.body) : '';
  const comicRelease = isKoko
    ? /נפתח|קפץ|נדבק|התגלגל|צבע|חגיג|נכנס|הצלח/i.test(penultProse)
    : isBunny
      ? /צוחק|מנענע|אוזנ|רוקד|מחייך/i.test(penultProse)
      : isLion
        ? /לחיש|צחוק|מדבקה|קליק|מדלג/i.test(penultProse)
        : isTurtle
          ? /כוכב|קו|זהב|נורה|מדבקה/i.test(penultProse)
          : /גשם|קשת|קופץ|פופקורן/i.test(penultProse);
  const emotionalRelease = isKoko
    ? /נשאר|מחר|עדיין|שוב|זנב|חדר|בית|חיים|ציור|מזכרת|גשר/i.test(finalProse)
    : isBunny
      ? /יחד|פה|הצלחנו|שקט|לוחש/i.test(finalProse)
      : isLion
        ? /לחיש|חיוך|שטיח|בית|שקט/i.test(finalProse)
        : isTurtle
          ? /נורה|בית|שקט|כוכב|יחד/i.test(finalProse)
          : /אח|אחות|גא|הצלח|קערה מלאה/i.test(finalProse);
  checks.push({ id: 'comic_release_penult', pass: comicRelease });
  checks.push({ id: 'emotional_release_final', pass: emotionalRelease });
  if (!comicRelease && !isConfidenceCompanion) hardFails.push(`p${expectedPageCount - 1} missing comic release`);
  if (!emotionalRelease && !isConfidenceCompanion) hardFails.push(`p${expectedPageCount} missing emotional release`);

  const companionSolves = isKoko
    ? /קוֹקוֹ (פתרה|הצילה|המציאה|הובילה את הפתרון)/i.test(fullProse)
    : /דיני (פתרה|הצילה|המציאה|הובילה את הפתרון)/i.test(fullProse);
  checks.push({ id: 'companion_not_climax_solver', pass: !companionSolves });
  if (companionSolves) hardFails.push('companion solves climax');

  let humorMoments = 0;
  if (isBunny) {
    if (/בוּנִי|בוני/.test(fullProse)) humorMoments++;
    if (/אוזנ/.test(fullProse)) humorMoments++;
    if (/פסל|קופצ|נשמט/.test(fullProse)) humorMoments++;
    if (/לחש|רועד/.test(fullProse)) humorMoments++;
    if (/התעטש|שיהוק/.test(fullProse)) humorMoments++;
  } else if (isLion) {
    if (/ליאו|לֵיוֹ/.test(fullProse)) humorMoments++;
    if (/שאג|לחיש/.test(fullProse)) humorMoments++;
    if (/שלולית|רטוב/.test(fullProse)) humorMoments++;
    if (/מחליק|קפץ/.test(fullProse)) humorMoments++;
    if (/צחק|מדבקה/.test(fullProse)) humorMoments++;
  } else if (isTurtle) {
    if (/טוֹלִי/.test(fullProse)) humorMoments++;
    if (/קונכייה/.test(fullProse)) humorMoments++;
    if (/מדבקה|כוכב/.test(fullProse)) humorMoments++;
    if (/קו זהב|זהב/.test(fullProse)) humorMoments++;
    if (/צחק|עגלה/.test(fullProse)) humorMoments++;
  } else if (isKoko) {
    if (/קוֹקוֹ|קוקו/.test(fullProse)) humorMoments++;
    if (/צבע|ירוק|כתום|אפור|פסים/.test(fullProse)) humorMoments++;
    if (/התחבא|נדבק|קיר/.test(fullProse)) humorMoments++;
    if (/עיניים/.test(fullProse)) humorMoments++;
    if (/פאניקה|רגוע/.test(fullProse)) humorMoments++;
    if (/קונפטי|מוקדם/.test(fullProse)) humorMoments++;
  } else {
    if (/אש/.test(fullProse)) humorMoments++;
    if (/קן/.test(fullProse)) humorMoments++;
    if (/מכסה|ענן/.test(fullProse)) humorMoments++;
    if (/על האף/.test(fullProse)) humorMoments++;
    if (/מפרש|מנהרת/.test(fullProse)) humorMoments++;
    if (/גשם/.test(fullProse)) humorMoments++;
  }
  const humorThreshold = isConfidenceCompanion ? 3 : 4;
  checks.push({ id: 'humor_moments_4plus', pass: humorMoments >= humorThreshold });
  if (humorMoments < humorThreshold) softWarnings.push(`humor moments: ${humorMoments}`);

  for (const { page, body } of pages) {
    const prose = pageProseOnly(body);
    const chips = analyzeGenderChips(prose);
    if (chips.malformed.length || chips.identical.length) {
      hardFails.push(`p${page} chip issues`);
    }
    if (!/imageDirection\s*:/i.test(body)) {
      hardFails.push(`p${page} missing imageDirection`);
    }
    if (/דיני[^.\n]*\{[^{}]+\|/.test(prose)) {
      hardFails.push(`p${page} Dini has gender chip`);
    }
    if (/קוֹקוֹ[^.\n]*\{[^{}]+\|/.test(prose)) {
      hardFails.push(`p${page} Koko has gender chip`);
    }
    if (/בוּנִי[^.\n]*\{[^{}]+\|/.test(prose)) {
      hardFails.push(`p${page} Bunny has gender chip`);
    }
    if (/ה\{וא\|יא\}|סגר\{ה\}|\{הרימ\|/.test(prose)) {
      hardFails.push(`p${page} broken chip pattern`);
    }
  }

  checks.push({
    id: 'chip_safety',
    pass: !args.chipSafety.advisoryFail,
    note: `${args.chipSafety.hitCount} hits`,
  });
  if (args.chipSafety.advisoryFail) hardFails.push('chip-safety advisoryFail');

  if (args.chipNormalizeFailed) hardFails.push('chip-normalize unrepaired');

  const formatOk =
    pages.length === expectedPageCount &&
    /\r?\n--- Page 1 ---/.test(args.storyMarkdown) &&
    hasValidYamlFrontmatter(args.storyMarkdown) &&
    /^gender:\s*(female|male)/m.test(args.storyMarkdown);
  checks.push({ id: 'v5_format', pass: formatOk });
  if (!formatOk) hardFails.push('v5 format issues');

  const endingProfile =
    args.endingProfile ??
    (args.companionId === 'chameleon_koko'
      ? 'koko_transition'
      : isConfidenceCompanion
        ? 'confidence_generic'
        : 'dini_popcorn');
  const completedP12 = isP12EndingComplete(args.storyMarkdown, endingProfile, expectedPageCount);
  checks.push({ id: 'completed_p12', pass: completedP12 });
  if (!completedP12) hardFails.push('p12 ending incomplete');

  const proseNotImagePromptHits = scanProseNotImagePrompt(args.storyMarkdown);
  const proseNotImagePromptPass = proseNotImagePromptHits.length === 0;
  checks.push({
    id: 'prose_not_image_prompt',
    pass: proseNotImagePromptPass,
    note: proseNotImagePromptPass
      ? 'pass'
      : `${proseNotImagePromptHits.length} pose-residue line(s)`,
  });
  if (!proseNotImagePromptPass) {
    softWarnings.push(
      `prose_not_image_prompt: ${proseNotImagePromptHits.map((h) => `p${h.page}`).join(', ')}`
    );
  }

  let verdict: StoryAliveVerdict = 'PASS';
  if (hardFails.length) {
    if (hardFails.some((f) => f.includes('raw artifact tokens'))) {
      verdict = 'FAIL';
    } else if (
      hardFails.some(
        (f) =>
          f.includes('chip') ||
          f.includes('broken') ||
          f.includes('p12 ending') ||
          f.includes('prose_not_image_prompt') ||
          f.includes('slash chips')
      )
    ) {
      verdict = 'REPAIR_PROSE';
    } else if (hardFails.some((f) => f.startsWith('missing anchor'))) {
      verdict = 'REGENERATE_PROSE';
    } else {
      verdict = 'FAIL';
    }
  } else if (softWarnings.length >= 2) {
    verdict = 'AUTHOR_PASS';
  }

  return {
    verdict,
    checks,
    hardFails,
    softWarnings,
    humorMoments,
    therapyWordHits,
    anchorHits,
    completedP12,
    proseNotImagePromptHits,
    artifactTokenScan,
    slashChipStyle,
    suffixChipScan,
  };
}
