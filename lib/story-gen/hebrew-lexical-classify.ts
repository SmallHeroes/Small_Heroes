/**
 * Post-classify lexical hits into BLOCKER / REVIEW / ALLOW with domain.
 */

import { resolveCompanionNameMarkers } from './companion-gender';
import { resolveSoundWordsForCompanion } from './hebrew-lexical-sound-allowlist';
import type {
  HebrewLexicalDomain,
  HebrewLexicalFinding,
  HebrewLexicalHit,
  HebrewLexicalSeverity,
} from './hebrew-lexical-types';

export type LexicalAllowContext = {
  companionId: string | null;
  companionNames: string[];
  soundWords: readonly string[];
};

function stripHebrewDiacritics(text: string): string {
  return text.replace(/[\u0591-\u05C7\u05F3\u05F4]/g, '');
}

export function extractCompanionIdFromMarkdown(markdown: string): string | null {
  const m = markdown.match(/companionId:\s*(\S+)/);
  return m?.[1]?.trim() ?? null;
}

export function buildLexicalAllowContext(markdown: string): LexicalAllowContext {
  const companionId = extractCompanionIdFromMarkdown(markdown);
  const companionNames = companionId ? resolveCompanionNameMarkers(companionId) : [];
  return {
    companionId,
    companionNames,
    soundWords: resolveSoundWordsForCompanion(companionId),
  };
}

function bareToken(text: string): string {
  return stripHebrewDiacritics(text).trim();
}

function containsAllowlistedSound(text: string, ctx: LexicalAllowContext): boolean {
  const bare = bareToken(text);
  return ctx.soundWords.some((w) => {
    const sw = bareToken(w);
    return bare === sw || bare.includes(sw);
  });
}

function containsCompanionName(text: string, ctx: LexicalAllowContext): boolean {
  const bare = bareToken(text);
  return ctx.companionNames.some((name) => {
    const n = bareToken(name);
    return n.length >= 2 && bare.includes(n);
  });
}

function isStructuralToken(text: string): boolean {
  if (/\{\{[^}]+\}\}/.test(text)) return true;
  if (/\{[^{}|]+\|[^{}|]+\}/.test(text)) return true;
  if (/imageDirection/i.test(text)) return true;
  if (/companionId/i.test(text)) return true;
  return false;
}

/** Pre-assigned from deterministic pattern metadata. */
const DETERMINISTIC_DOMAIN_HINTS: Array<{
  pattern: RegExp;
  severity: HebrewLexicalSeverity;
  domain: HebrewLexicalDomain;
}> = [
  { pattern: /מצטמ|מצטמת/, severity: 'BLOCKER', domain: 'malformed_inflection' },
  { pattern: /מצציץ|מצמיץ|מצטץ/, severity: 'BLOCKER', domain: 'non_word' },
  { pattern: /החולש|חוֹלֵשׁ/, severity: 'BLOCKER', domain: 'non_word' },
  { pattern: /מַהְנֵה|מהנה(?!ן)/, severity: 'BLOCKER', domain: 'non_word' },
  { pattern: /כמעט[־-]?ש/, severity: 'REVIEW', domain: 'age_inappropriate_register' },
  { pattern: /ריצ.+רוץ/, severity: 'REVIEW', domain: 'unnatural_phrase' },
  { pattern: /נח בין גלידות|נָח בֵּין/, severity: 'REVIEW', domain: 'unnatural_phrase' },
  { pattern: /פתחוני קפיץ|פִּתְחוֹנֵי/, severity: 'REVIEW', domain: 'unnatural_phrase' },
  { pattern: /קִצְקָשׁ|קיצקש/, severity: 'BLOCKER', domain: 'non_word' },
];

function inferSeverityDomain(
  hit: HebrewLexicalHit
): { severity: HebrewLexicalSeverity; domain: HebrewLexicalDomain } {
  if (hit.severity && hit.domain) {
    return { severity: hit.severity, domain: hit.domain };
  }

  const blob = `${hit.original} ${hit.issue} ${hit.suggestedMinimalFix}`;
  const bare = bareToken(blob);

  for (const hint of DETERMINISTIC_DOMAIN_HINTS) {
    if (hint.pattern.test(bare) || hint.pattern.test(hit.original)) {
      return { severity: hint.severity, domain: hint.domain };
    }
  }

  const issueLower = hit.issue.toLowerCase();
  if (
    /non-word|לא קיימ|invented|truncated|broken verb|שגוי|לא תקנ|nonce|מצטמ|מציץ/i.test(
      hit.issue
    )
  ) {
    return { severity: 'BLOCKER', domain: 'non_word' };
  }
  if (/unnatural|jarring|tongue-twister|simile|forced|מטפור/i.test(hit.issue)) {
    return { severity: 'REVIEW', domain: 'unnatural_phrase' };
  }
  if (/nikud|ניקוד|vocalization/i.test(hit.issue)) {
    return { severity: 'ALLOW', domain: 'valid_nikud_form' };
  }
  if (/התאמה|gender|grammar nit/i.test(hit.issue)) {
    return { severity: 'REVIEW', domain: 'malformed_inflection' };
  }

  return { severity: 'REVIEW', domain: 'unnatural_phrase' };
}

export function classifyLexicalHit(
  hit: HebrewLexicalHit,
  ctx: LexicalAllowContext
): HebrewLexicalFinding {
  if (hit.severity && hit.severity !== 'ALLOW' && hit.domain) {
    return { ...hit, severity: hit.severity, domain: hit.domain };
  }

  if (isStructuralToken(hit.original)) {
    return { ...hit, severity: 'ALLOW', domain: 'placeholder_or_chip' };
  }

  const bareOriginal = bareToken(hit.original);
  const isCompanionOnly = ctx.companionNames.some((n) => bareOriginal === bareToken(n));
  if (isCompanionOnly) {
    return { ...hit, severity: 'ALLOW', domain: 'companion_name' };
  }
  if (containsAllowlistedSound(hit.original, ctx)) {
    return { ...hit, severity: 'ALLOW', domain: 'allowed_sound_word' };
  }

  const inferred = inferSeverityDomain(hit);
  if (inferred.severity === 'BLOCKER' || inferred.severity === 'REVIEW') {
    return { ...hit, severity: inferred.severity, domain: hit.domain ?? inferred.domain };
  }

  if (containsCompanionName(hit.original, ctx)) {
    return { ...hit, severity: 'ALLOW', domain: 'companion_name' };
  }

  return { ...hit, severity: inferred.severity, domain: hit.domain ?? inferred.domain };
}

export function classifyLexicalHits(
  hits: HebrewLexicalHit[],
  markdown: string
): HebrewLexicalFinding[] {
  const ctx = buildLexicalAllowContext(markdown);
  return hits.map((h) => classifyLexicalHit(h, ctx));
}

export function summarizeLexicalFindings(findings: HebrewLexicalFinding[]): {
  blockerCount: number;
  reviewCount: number;
  allowCount: number;
  blockers: HebrewLexicalFinding[];
  reviews: HebrewLexicalFinding[];
  allows: HebrewLexicalFinding[];
} {
  const blockers = findings.filter((f) => f.severity === 'BLOCKER');
  const reviews = findings.filter((f) => f.severity === 'REVIEW');
  const allows = findings.filter((f) => f.severity === 'ALLOW');
  return {
    blockerCount: blockers.length,
    reviewCount: reviews.length,
    allowCount: allows.length,
    blockers,
    reviews,
    allows,
  };
}
