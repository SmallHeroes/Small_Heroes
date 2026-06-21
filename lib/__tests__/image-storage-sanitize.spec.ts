import { describe, expect, it } from 'vitest';

import { sanitizeAssetPathSegment } from '../image-storage';

describe('sanitizeAssetPathSegment (0096 M5c)', () => {
  it('preserves a .png extension (no more "-png" mangling)', () => {
    expect(
      sanitizeAssetPathSegment('character-anchors/child-canonical-method-b-qa.png')
    ).toBe('character-anchors/child-canonical-method-b-qa.png');
  });

  it('preserves a .json extension', () => {
    expect(sanitizeAssetPathSegment('qa-anchor/key__abc123/candidate.json')).toBe(
      'qa-anchor/key__abc123/candidate.json'
    );
  });

  it('replaces unsafe characters with - but keeps the dot', () => {
    expect(sanitizeAssetPathSegment('a b!c.png')).toBe('a-b-c.png');
  });

  it('strips leading/trailing slashes', () => {
    expect(sanitizeAssetPathSegment('/foo/bar.png/')).toBe('foo/bar.png');
  });

  it('does not allow parent-dir traversal', () => {
    expect(sanitizeAssetPathSegment('../../etc/passwd')).not.toContain('..');
  });
});
