import { describe, expect, it } from 'vitest';
import { runEventMomentumGate } from '../story-gen-v2/event-momentum-gate';
import type { PageBeatV2, StorySpineV2 } from '../story-gen-v2/types';

const minimalSpine: StorySpineV2 = {
  titleSeed: '{{childName}} test',
  direction: 'adventure',
  companionId: 'panda_anat',
  resilienceTheme: 'joining play',
  protagonistWant: 'child wants to join the sand bridge game',
  visibleProblem: 'group is too fast, no opening',
  firstAttempt: 'child grabs a bucket',
  firstAttemptFailsBecause: 'another child pulls it away',
  secondComplication: 'sand spills on shoes',
  companionMisread: 'Anat suggests waiting until they finish',
  childDiscovery: 'child spots smooth leaf',
  childPlan: 'use leaf as slow-bucket marker',
  childBraveAction: 'child asks to pour one bucket slowly',
  climaxChoice: 'group pauses and hands bucket',
  payoff: 'bridge holds, group laughs at slow rhythm',
  emotionalResidue: 'there is room for slow entry',
  oneSentenceEventChain: 'want → fail → misread → notice → brave ask → join → residue',
};

function beat(partial: Partial<PageBeatV2> & Pick<PageBeatV2, 'page'>): PageBeatV2 {
  return {
    storyFactBefore: `before p${partial.page}`,
    eventOnPage: `event p${partial.page}`,
    childAction: partial.childAction ?? 'שואל להצטרף לגשר',
    complicationOrChange: `change p${partial.page}`,
    emotionalShift: 'shift',
    storyFactAfter: `after p${partial.page} different`,
    pageTurnReason: 'what happens next?',
    ...partial,
  };
}

describe('runEventMomentumGate', () => {
  it('PASSes when beats change state and spine is complete', () => {
    const beats = Array.from({ length: 12 }, (_, i) =>
      beat({ page: i + 1, childAction: i === 2 ? 'מסתכל על ענת' : 'מציע לשפוך דלי לאט' })
    );
    const report = runEventMomentumGate({ spine: minimalSpine, beats, pageCount: 12 });
    expect(report.verdict).toBe('PASS');
    expect(report.staticPages).toHaveLength(0);
  });

  it('FAILs on static pages and missing spine fields', () => {
    const badSpine = { ...minimalSpine, childBraveAction: '' };
    const beats = [
      beat({ page: 1, storyFactBefore: 'same', storyFactAfter: 'same' }),
      beat({ page: 2, storyFactBefore: 'same', storyFactAfter: 'same' }),
    ];
    const report = runEventMomentumGate({ spine: badSpine, beats, pageCount: 2 });
    expect(report.verdict).toBe('FAIL');
    expect(report.missingBraveChildAction).toBe(true);
    expect(report.longestStaticRun).toBeGreaterThanOrEqual(2);
  });
});
