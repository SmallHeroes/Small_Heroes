import { describe, expect, it } from 'vitest';
import {
  deriveRerollEligibleActive,
  deriveRerollEligibleCandidate,
  processVoiceFinding,
  type VoiceFindingLLMType,
  VoiceReviewReport,
} from '../editorial/voice-schemas';
import { buildVoiceReviewMeta } from '../editorial/voice-reviewer-meta';
import {
  loadAgeVoiceProfile,
  loadStorybookVoiceStandardHe,
} from '../editorial/voice-standard-loader';
import { quoteOverlaps, normalizeHebrewForMatch } from '../editorial/voice-match-utils';
import { planVoiceRerolls, isVoiceReviewerBlockingEnabled } from '../stages/voice-reroll';
import {
  calibrateFixture,
  familyToAxis,
  semanticMisuseKeystonePassed,
} from '../editorial/voice-calibration';
import { loadCalibrationFixture } from './voice-calibration-corpus/corpus';

function enrich(finding: VoiceFindingLLMType) {
  const processed = processVoiceFinding(finding);
  if (!processed) throw new Error('processVoiceFinding returned null');
  return processed;
}

describe('voice schemas', () => {
  it('derives rerollEligibleCandidate for page non-diagnostic only', () => {
    expect(
      deriveRerollEligibleCandidate({
        page: 3,
        scope: 'page',
        axis: 'voice',
        family: 'ai_poetic',
        severity: 'warning',
        quote: 'x',
        reason: 'y',
        confidence: 0.8,
      })
    ).toBe(true);
    expect(
      deriveRerollEligibleCandidate({
        page: null,
        scope: 'story',
        axis: 'relationship',
        family: 'name_overuse',
        severity: 'diagnostic',
        reason: 'y',
        confidence: 0.5,
      })
    ).toBe(false);
  });

  it('rerollEligibleActive is false when VOICE_REVIEWER_BLOCKING is off', () => {
    const prev = process.env.VOICE_REVIEWER_BLOCKING;
    delete process.env.VOICE_REVIEWER_BLOCKING;
    expect(
      deriveRerollEligibleActive({
        page: 6,
        scope: 'page',
        axis: 'voice',
        family: 'semantic_misuse',
        severity: 'blocking',
        quote: 'דוקדק',
        reason: 'y',
        confidence: 0.95,
      })
    ).toBe(false);
    if (prev) process.env.VOICE_REVIEWER_BLOCKING = prev;
  });

  it('drops page-scope finding without quote instead of failing report', () => {
    const result = processVoiceFinding({
      page: 2,
      scope: 'page',
      axis: 'voice',
      family: 'semantic_misuse',
      severity: 'blocking',
      reason: 'wrong word',
      confidence: 0.9,
    });
    expect(result).toBeNull();
  });

  it('coerces motif_overuse to story-scope', () => {
    const result = processVoiceFinding({
      page: 3,
      scope: 'page',
      axis: 'voice',
      family: 'motif_overuse',
      severity: 'warning',
      quote: 'ובפנים חם',
      reason: 'motif repeated',
      confidence: 0.7,
    });
    expect(result?.scope).toBe('story');
    expect(result?.page).toBeNull();
    expect(result?.severity).toBe('diagnostic');
    expect(result?.quote).toBeUndefined();
  });

  it('normalizes story-scope severity to diagnostic', () => {
    const result = processVoiceFinding({
      page: null,
      scope: 'story',
      axis: 'relationship',
      family: 'name_overuse',
      severity: 'warning',
      reason: 'too many names',
      confidence: 0.7,
    });
    expect(result?.severity).toBe('diagnostic');
    expect(result?.rerollEligibleCandidate).toBe(false);
  });

  it('VoiceReviewReport requires meta block', () => {
    const report = VoiceReviewReport.parse({
      meta: buildVoiceReviewMeta('gpt-5-chat-latest'),
      storyId: 'test',
      language: 'he',
      ageTier: '5-6',
      findings: [],
    });
    expect(report.meta.reviewerVersion).toBeTruthy();
    expect(report.meta.standardVersion).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe('voice match utils', () => {
  it('matches quotes with niqqud / whitespace differences', () => {
    expect(
      quoteOverlaps('אי השקט הקטן עוד כאן', 'אי-השקט הקטן')
    ).toBe(true);
    expect(normalizeHebrewForMatch('בּוֹלִי')).toBe(normalizeHebrewForMatch('בולי'));
  });
});

describe('voice standard loader', () => {
  it('loads sections 2-5 and age profile 5-6', () => {
    const standard = loadStorybookVoiceStandardHe();
    expect(standard).toContain('## 2. Core principles');
    expect(standard).toContain('### Family A');
    expect(standard).not.toContain('## 6. Age Voice Profiles');

    const profile = loadAgeVoiceProfile('5-6');
    expect(profile).toContain('Ages 5-6');
  });
});

describe('voice reroll plan (flag off)', () => {
  it('does not plan rerolls when VOICE_REVIEWER_BLOCKING is off', () => {
    const prev = process.env.VOICE_REVIEWER_BLOCKING;
    delete process.env.VOICE_REVIEWER_BLOCKING;
    expect(isVoiceReviewerBlockingEnabled()).toBe(false);

    const plan = planVoiceRerolls([
      enrich({
        page: 6,
        scope: 'page',
        axis: 'voice',
        family: 'semantic_misuse',
        severity: 'blocking',
        quote: 'דוקדק',
        reason: 'semantic misuse',
        confidence: 0.95,
      }),
    ]);
    expect(plan.blockedByFlag).toBe(true);
    expect(plan.eligiblePages).toHaveLength(0);
    if (prev) process.env.VOICE_REVIEWER_BLOCKING = prev;
  });
});

describe('calibration corpus fixtures', () => {
  it('loads adventure_michal_run1 with דוקדק on page 6', () => {
    const { markdown } = loadCalibrationFixture('adventure_michal_run1');
    expect(markdown).toContain('דוקדק');
    expect(markdown).toMatch(/--- Page 6 ---[\s\S]*דוקדק/);
  });

  it('keystone matcher detects semantic_misuse on דוקדק with fuzzy match', () => {
    const passed = semanticMisuseKeystonePassed(
      [
        enrich({
          page: 6,
          scope: 'page',
          axis: 'voice',
          family: 'semantic_misuse',
          severity: 'blocking',
          quote: 'האור הלבן בחדר דוקדק ונוגע בעיניים',
          reason: 'דוקדק is wrong — meant דוקר',
          confidence: 0.92,
        }),
      ],
      'adventure_michal_run1'
    );
    expect(passed).toBe(true);
  });

  it('maps name_overuse to voice axis in calibration', () => {
    expect(familyToAxis('name_overuse')).toBe('voice');
  });

  it('calibrateFixture counts only non-optional matches in matched', () => {
    const { human } = loadCalibrationFixture('fantasy_gold');
    const result = calibrateFixture([], human);
    expect(result.matched).toBeLessThanOrEqual(result.expectedCount);
  });

  it('calibrateFixture scores human expectedFindings with fuzzy quote overlap', () => {
    const { markdown, human } = loadCalibrationFixture('bedtime_noa');
    const result = calibrateFixture(
      [
        enrich({
          page: 3,
          scope: 'page',
          axis: 'voice',
          family: 'therapeutic_abstract',
          severity: 'warning',
          quote: 'אי השקט הקטן עוד כאן',
          reason: 'clinical noun',
          confidence: 0.8,
        }),
      ],
      human
    );
    expect(result.matched).toBeGreaterThanOrEqual(1);
    expect(markdown).toContain('אי-השקט');
  });
});
