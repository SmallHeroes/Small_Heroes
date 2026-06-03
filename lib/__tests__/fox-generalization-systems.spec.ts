import { describe, expect, it } from 'vitest';
import { classifyStyle01SceneClass } from '../style-scene-class';
import { sceneHasRailedBedOrCrib } from '../structured-object-composition';
import { derivePageEntityPresence } from '../image-entity-presence';
import { resolveCompanionViewIntentForPage } from '../generation-pipeline/companion-sheet-page-map';

describe('classifyStyle01SceneClass night-aware', () => {
  it('maps yard at night to garden-night not forest-day', () => {
    expect(
      classifyStyle01SceneClass({
        rawScenePrompt:
          'A starry night in a suburban backyard. Grass and a garden hose across the lawn.',
        effectivePageTimeOfDay: 'night',
      })
    ).toBe('garden-night');
  });

  it('maps bedroom at night to bedroom-night', () => {
    expect(
      classifyStyle01SceneClass({
        rawScenePrompt: 'The child is safe inside the warm bedroom, placing a leaf on a nightstand.',
        effectivePageTimeOfDay: 'night',
      })
    ).toBe('bedroom-night');
  });
});

describe('sceneHasRailedBedOrCrib explicit only', () => {
  it('does not fire on bedroom without crib', () => {
    expect(
      sceneHasRailedBedOrCrib({
        rawScenePrompt:
          'The child is safe inside the warm bedroom, placing the little leaf on a nightstand.',
      })
    ).toBe(false);
  });

  it('fires on explicit crib', () => {
    expect(
      sceneHasRailedBedOrCrib({
        rawScenePrompt: 'Parents lean over the crib rail toward the baby.',
      })
    ).toBe(true);
  });
});

describe('derivePageEntityPresence companion partial', () => {
  it('marks tail-tip-only page as partial not present', () => {
    const contract = derivePageEntityPresence({
      imageDirection:
        'Outside in the dark grass, the white tail tip of the fox is visible for a moment, resting under starlight.',
      companionName: 'השועל אוּרי',
      companionId: 'fox_uri',
    });
    expect(contract.companionPresence).toBe('partial');
  });
});

describe('resolveCompanionViewIntentForPage pose-first', () => {
  it('does not pick back when shadow is behind a bucket', () => {
    expect(
      resolveCompanionViewIntentForPage({
        rawScenePrompt:
          'A bulky shadow rises behind an upside-down plastic bucket. The copper fox stands rigid on the grass.',
        companionPresence: 'present',
      })
    ).not.toBe('back');
  });

  it('picks threeQuarter when fox faces child', () => {
    expect(
      resolveCompanionViewIntentForPage({
        rawScenePrompt:
          'The fox and the child step down onto the lawn. The fox points with a sharp front paw toward a shadow.',
        companionPresence: 'present',
      })
    ).toBe('threeQuarter');
  });
});
