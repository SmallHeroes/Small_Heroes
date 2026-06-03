import { describe, expect, it } from 'vitest';
import {
  resolveCompanionSheetViewForPage,
  resolveCompanionViewIntentForPage,
} from '../generation-pipeline/companion-sheet-page-map';

describe('resolveCompanionSheetViewForPage', () => {
  it('picks side for profile language', () => {
    expect(
      resolveCompanionSheetViewForPage({
        rawScenePrompt: 'Fox in side profile walking along the path',
      })
    ).toBe('side');
  });

  it('picks back for companion from-behind language', () => {
    expect(
      resolveCompanionSheetViewForPage({
        rawScenePrompt: 'Dragon seen from behind, tail visible',
      })
    ).toBe('three_quarter_back');
  });

  it('picks three_quarter_front for facing beats without smile keywords', () => {
    expect(
      resolveCompanionSheetViewForPage({
        rawScenePrompt: 'The fox and the child step down onto the lawn.',
        companionPresence: 'present',
      })
    ).toBe('three_quarter_front');
  });
});

describe('resolveCompanionViewIntentForPage', () => {
  it('returns partial for tail-tip-only scenes', () => {
    expect(
      resolveCompanionViewIntentForPage({
        rawScenePrompt: 'the white tail tip of the fox is visible for a moment',
        companionPresence: 'partial',
      })
    ).toBe('partial');
  });
});
