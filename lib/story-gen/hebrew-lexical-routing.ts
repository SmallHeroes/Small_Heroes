/**
 * Hebrew lexical ROUTING policy (Step 4.4).
 *
 * - BLOCKER authority: LLM-only blockers demoted unless deterministic agrees.
 * - Terminal cap: high-severity prose REVIEW cannot reach bank_ready_candidate.
 * - Slash-forms are chip-normalize gaps, not literary quality REVIEW.
 */

import type { HebrewLexicalDomain, HebrewLexicalFinding, HebrewLexicalHit } from './hebrew-lexical-types';

/** Terminals that lexical routing may cap (mirrors WritersRoomTerminal). */
export type LexicalRoutableTerminal =
  | 'bank_ready_candidate'
  | 'post_rewrite_bank_ready_candidate_needs_human_review'
  | 'strong_draft_needs_light_human_polish'
  | 'needs_human_review'
  | 'needs_human_review_or_reroll';

function stripHebrewDiacritics(text: string): string {
  return text.replace(/[\u0591-\u05C7\u05F3\u05F4]/g, '');
}

function bareToken(text: string): string {
  return stripHebrewDiacritics(text).trim();
}

/** Explicit LLM false-positive reclassifications from Step 4.3 calibration. */
const KNOWN_LLM_RECLASSIFICATIONS: Array<{
  pattern: RegExp;
  severity: HebrewLexicalFinding['severity'];
  domain: HebrewLexicalDomain;
  note: string;
}> = [
  {
    pattern: /מַסַּע|מסע/,
    severity: 'ALLOW',
    domain: 'valid_nikud_form',
    note: 'valid Hebrew word (journey); nikud variant — not a non-word',
  },
  {
    pattern: /לקֶטַן|לקטן/,
    severity: 'REVIEW',
    domain: 'unnatural_phrase',
    note: 'poetic diminutive — review only, not hard-block',
  },
];

export function isSlashFormFinding(finding: HebrewLexicalFinding): boolean {
  if (/[\/]/.test(finding.original)) return true;
  if (
    /slash|מגדרי|שימוש ב['']?\/['']?|gender slash|תבנית המגדר/i.test(finding.issue)
  ) {
    return true;
  }
  return false;
}

/** Domains that never count as candidate-blocking prose quality. */
const NON_PROSE_QUALITY_DOMAINS = new Set<HebrewLexicalDomain>([
  'placeholder_or_chip',
  'companion_name',
  'allowed_sound_word',
  'valid_nikud_form',
]);

/**
 * High-severity prose REVIEW — blocks bank_ready_candidate terminal.
 * Only unnatural_phrase and age_inappropriate_register in page prose.
 */
export function isHighSeverityProseReview(finding: HebrewLexicalFinding): boolean {
  if (finding.severity !== 'REVIEW') return false;
  if (isSlashFormFinding(finding)) return false;
  if (NON_PROSE_QUALITY_DOMAINS.has(finding.domain)) return false;
  if (
    finding.domain !== 'unnatural_phrase' &&
    finding.domain !== 'age_inappropriate_register'
  ) {
    return false;
  }
  return finding.page >= 1;
}

export function hasDeterministicBacking(
  finding: HebrewLexicalFinding,
  deterministic: HebrewLexicalHit[]
): boolean {
  const bare = bareToken(finding.original);
  return deterministic.some((d) => {
    if (d.page !== finding.page && d.page > 0 && finding.page > 0) {
      // allow page-agnostic phrase match
    }
    const db = bareToken(d.original);
    return (
      db === bare ||
      db.includes(bare) ||
      bare.includes(db) ||
      bareToken(d.issue).includes(bare)
    );
  });
}

export type BlockerAuthorityResult = {
  findings: HebrewLexicalFinding[];
  demotedLlmBlockers: HebrewLexicalFinding[];
};

/**
 * Apply BLOCKER authority policy after severity classification.
 * LLM-only BLOCKER → REVIEW unless deterministic backs it or known fixture.
 */
export function applyBlockerAuthorityPolicy(
  findings: HebrewLexicalFinding[],
  deterministic: HebrewLexicalHit[]
): BlockerAuthorityResult {
  const demotedLlmBlockers: HebrewLexicalFinding[] = [];
  const out: HebrewLexicalFinding[] = [];

  for (const f of findings) {
    const known = KNOWN_LLM_RECLASSIFICATIONS.find(
      (rule) => rule.pattern.test(f.original) || rule.pattern.test(bareToken(f.original))
    );
    if (known) {
      out.push({
        ...f,
        severity: known.severity,
        domain: known.domain,
        issue: `${f.issue} [authority: ${known.note}]`,
      });
      continue;
    }

    if (
      f.severity === 'BLOCKER' &&
      f.source === 'llm' &&
      !hasDeterministicBacking(f, deterministic)
    ) {
      const demoted: HebrewLexicalFinding = {
        ...f,
        severity: 'REVIEW',
        issue: `${f.issue} [authority: LLM-only BLOCKER demoted to REVIEW — no deterministic backing]`,
      };
      demotedLlmBlockers.push(demoted);
      out.push(demoted);
      continue;
    }

    out.push(f);
  }

  return { findings: out, demotedLlmBlockers };
}

export type LexicalRoutingState = {
  confirmedBlockers: HebrewLexicalFinding[];
  highSeverityProseReviews: HebrewLexicalFinding[];
  slashFormFindings: HebrewLexicalFinding[];
  demotedLlmBlockers: HebrewLexicalFinding[];
  blockerCount: number;
  highSeverityProseReviewCount: number;
};

export function computeLexicalRoutingState(
  findings: HebrewLexicalFinding[],
  demotedLlmBlockers: HebrewLexicalFinding[] = []
): LexicalRoutingState {
  const confirmedBlockers = findings.filter((f) => f.severity === 'BLOCKER');
  const slashFormFindings = findings.filter((f) => isSlashFormFinding(f));
  const highSeverityProseReviews = findings.filter((f) => isHighSeverityProseReview(f));

  return {
    confirmedBlockers,
    highSeverityProseReviews,
    slashFormFindings,
    demotedLlmBlockers,
    blockerCount: confirmedBlockers.length,
    highSeverityProseReviewCount: highSeverityProseReviews.length,
  };
}

/**
 * Cap taste-based terminal using lexical routing (Step 4 validation — not production auto-reject).
 */
export function applyLexicalTerminalCap(
  baseTerminal: LexicalRoutableTerminal,
  routing: LexicalRoutingState
): LexicalRoutableTerminal {
  if (routing.blockerCount > 0) {
    return 'needs_human_review';
  }

  if (routing.highSeverityProseReviewCount > 0) {
    if (baseTerminal === 'bank_ready_candidate') {
      return routing.highSeverityProseReviewCount >= 3
        ? 'needs_human_review'
        : 'strong_draft_needs_light_human_polish';
    }
    if (baseTerminal === 'post_rewrite_bank_ready_candidate_needs_human_review') {
      return 'needs_human_review';
    }
  }

  return baseTerminal;
}

export function lexicalRoutingSummary(routing: LexicalRoutingState): string {
  const parts = [
    `blockers=${routing.blockerCount}`,
    `proseReview=${routing.highSeverityProseReviewCount}`,
    `slashChip=${routing.slashFormFindings.length}`,
    `demotedLlm=${routing.demotedLlmBlockers.length}`,
  ];
  return parts.join(', ');
}
