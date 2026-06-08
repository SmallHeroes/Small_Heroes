import { describe, expect, it } from 'vitest';
import { scanImageDirectionFormat } from '../story-gen/image-direction-validator';

describe('scanImageDirectionFormat', () => {
  it('flags stray ** and split imageDirection:** label (WARN)', () => {
    const md = `--- Page 1 ---
prose line

**

imageDirection:** child under blanket

WORD_COUNT: [3] = 3`;
    const report = scanImageDirectionFormat(md);
    expect(report.advisoryWarn).toBe(true);
    expect(report.advisoryFail).toBe(false);
    expect(report.malformedPages).toContain(1);
    expect(report.hits.some((h) => h.reason === 'stray_bold_marker')).toBe(true);
    expect(report.hits.some((h) => h.reason === 'label_has_bold')).toBe(true);
  });

  it('passes well-formed single-line imageDirection', () => {
    const md = `--- Page 1 ---
prose

imageDirection: dim room, soft lamp

WORD_COUNT: [2] = 2`;
    const report = scanImageDirectionFormat(md);
    expect(report.advisoryWarn).toBe(false);
    expect(report.malformedPages).toHaveLength(0);
  });

  it('can block when blocking=true (pre-image gate)', () => {
    const md = `--- Page 1 ---
**

imageDirection:** broken`;
    const report = scanImageDirectionFormat(md, { blocking: true });
    expect(report.advisoryFail).toBe(true);
  });
});
