import { describe, expect, it } from 'vitest';
import {
  collapseTemporalSequenceInSceneText,
  sanitizeSceneTextForSingleMoment,
  sceneTextHasTemporalConnector,
} from '../image-scene-text';

const PAGE_6_PREVIOUS =
  'close-up small hand closing to a fist then opening slowly, on the blanket';

describe('image-scene-text temporal collapse', () => {
  it('detects temporal connectors in page-6 previous run text', () => {
    expect(sceneTextHasTemporalConnector(PAGE_6_PREVIOUS)).toBe(true);
  });

  it('rewrites page-6 sequential text to a single frozen moment', () => {
    const { text, rewritten } = collapseTemporalSequenceInSceneText(PAGE_6_PREVIOUS);
    expect(rewritten).toBe(true);
    expect(text.toLowerCase()).not.toContain('then');
    expect(text).toMatch(/open|uncurl/i);
  });

  it('sanitize throws if temporal connector remains after rewrite', () => {
    expect(() => sanitizeSceneTextForSingleMoment(PAGE_6_PREVIOUS)).not.toThrow();
    const sanitized = sanitizeSceneTextForSingleMoment(PAGE_6_PREVIOUS);
    expect(sceneTextHasTemporalConnector(sanitized)).toBe(false);
  });
});
