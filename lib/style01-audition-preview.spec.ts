import { describe, expect, it } from 'vitest';
import { pickAuditionPreviewImageUrl } from './style01-audition-preview';

const LOCAL = '/api/dev/style01-book-preview/asset?dir=run-01&page=4&kind=image';
// Pre-2026-07-19 manifests: this host is a since-deleted Supabase project (57/109 manifests).
const REMOTE = 'https://ozxjmnzybzetqudivlbw.supabase.co/storage/v1/object/public/books/page-04.png';

describe('pickAuditionPreviewImageUrl — dev viewer image-source precedence', () => {
  it('local present, no remote → serves the local PNG', () => {
    expect(pickAuditionPreviewImageUrl(LOCAL, null)).toBe(LOCAL);
  });

  it('local present AND remote present → local wins (the fix: never serve the dead remote)', () => {
    expect(pickAuditionPreviewImageUrl(LOCAL, REMOTE)).toBe(LOCAL);
  });

  it('no local, remote present → falls back to remote (serverless, no on-disk file)', () => {
    expect(pickAuditionPreviewImageUrl(null, REMOTE)).toBe(REMOTE);
  });

  it('neither local nor remote → null (page not rendered in this audition)', () => {
    expect(pickAuditionPreviewImageUrl(null, null)).toBeNull();
  });
});
