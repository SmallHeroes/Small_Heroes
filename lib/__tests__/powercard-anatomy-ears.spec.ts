import { describe, expect, it } from 'vitest';
import { sanitizePowerCardMetadata } from '../story-gen/powercard-metadata-sanitizer';

describe('powerCard sanitizer — child ear-fold', () => {
  it('flags S6 child step folding elephant ears', () => {
    const md = `---
companionId: baby_elephant
powerCard:
  steps:
    - "{{childName}} {מקפל|מקפלת} אוזניים לחצי"
---
--- Page 1 ---
prose

WORD_COUNT: [1] = 1`;
    const { report } = sanitizePowerCardMetadata({ storyMarkdown: md, companionId: 'baby_elephant' });
    expect(report.advisoryFail).toBe(true);
    expect(
      report.hits.some(
        (h) =>
          h.reason === 'companion_anatomy_on_child_step' &&
          h.stepIndex === 0 &&
          /ears|fold companion/i.test(h.context)
      )
    ).toBe(true);
  });
});
