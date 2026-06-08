import { describe, expect, it } from 'vitest';
import {
  applyBlockerAuthorityPolicy,
  applyLexicalTerminalCap,
  computeLexicalRoutingState,
  isHighSeverityProseReview,
  isSlashFormFinding,
} from '../story-gen/hebrew-lexical-routing';
import type { HebrewLexicalFinding } from '../story-gen/hebrew-lexical-types';

function hit(
  partial: Partial<HebrewLexicalFinding> & Pick<HebrewLexicalFinding, 'page' | 'original'>
): HebrewLexicalFinding {
  return {
    issue: 'test',
    suggestedMinimalFix: '',
    source: 'llm',
    severity: 'REVIEW',
    domain: 'unnatural_phrase',
    ...partial,
  };
}

describe('hebrew-lexical routing policy', () => {
  it('demotes LLM-only BLOCKER to REVIEW', () => {
    const findings = [
      hit({
        page: 10,
        original: 'מַסַּע',
        severity: 'BLOCKER',
        domain: 'non_word',
        source: 'llm',
      }),
    ];
    const { findings: out, demotedLlmBlockers } = applyBlockerAuthorityPolicy(findings, []);
    expect(out[0].severity).toBe('ALLOW');
    expect(demotedLlmBlockers).toHaveLength(0);
  });

  it('reclassifies B5 לקֶטַן as REVIEW not BLOCKER', () => {
    const findings = [
      hit({
        page: 8,
        original: 'לקֶטַן',
        severity: 'BLOCKER',
        domain: 'non_word',
        source: 'llm',
      }),
    ];
    const { findings: out } = applyBlockerAuthorityPolicy(findings, []);
    expect(out[0].severity).toBe('REVIEW');
    expect(out[0].domain).toBe('unnatural_phrase');
  });

  it('keeps deterministic BLOCKER when LLM agrees', () => {
    const findings = [
      hit({
        page: 2,
        original: 'מצטמצ',
        severity: 'BLOCKER',
        domain: 'malformed_inflection',
        source: 'llm',
      }),
    ];
    const deterministic = [
      {
        page: 2,
        original: 'מצטמצ',
        issue: 'broken',
        suggestedMinimalFix: 'מתכווץ',
        source: 'deterministic' as const,
        severity: 'BLOCKER' as const,
        domain: 'malformed_inflection' as const,
      },
    ];
    const { findings: out } = applyBlockerAuthorityPolicy(findings, deterministic);
    expect(out[0].severity).toBe('BLOCKER');
  });

  it('does not count slash-forms as high-severity prose REVIEW', () => {
    const slash = hit({
      page: 8,
      original: 'עוקב/ת אחרי הצליל של עצמו/ה',
      issue: "השימוש ב'/' אינו תקין",
    });
    expect(isSlashFormFinding(slash)).toBe(true);
    expect(isHighSeverityProseReview(slash)).toBe(false);
  });

  it('counts genuine unnatural_phrase in prose as blocking REVIEW', () => {
    const prose = hit({
      page: 3,
      original: 'הבֶּטֶן מתקשחת',
      domain: 'unnatural_phrase',
    });
    expect(isHighSeverityProseReview(prose)).toBe(true);
  });

  it('caps bank_ready_candidate when high-severity prose REVIEW remains', () => {
    const routing = computeLexicalRoutingState([
      hit({ page: 3, original: 'הבֶּטֶן מתקשחת', domain: 'unnatural_phrase' }),
    ]);
    expect(applyLexicalTerminalCap('bank_ready_candidate', routing)).toBe(
      'strong_draft_needs_light_human_polish'
    );
  });

  it('routes confirmed BLOCKER to needs_human_review', () => {
    const routing = computeLexicalRoutingState([
      hit({
        page: 2,
        original: 'מצטמצ',
        severity: 'BLOCKER',
        domain: 'malformed_inflection',
        source: 'deterministic',
      }),
    ]);
    expect(applyLexicalTerminalCap('bank_ready_candidate', routing)).toBe(
      'needs_human_review'
    );
  });
});
