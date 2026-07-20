import { describe, it, expect, vi } from 'vitest';

import { bindPageSafetySha, bindCoverSafetySha } from '@/lib/generation-pipeline/asset-safety-writer';

const SHA = 'a'.repeat(64);

/** A mock Prisma whose updateMany returns a scripted affected-row count and records the call args. */
function mockPrisma(count: number) {
  const imageAsset = { updateMany: vi.fn(async () => ({ count })) };
  const generatedBook = { updateMany: vi.fn(async () => ({ count })) };
  return { prisma: { imageAsset, generatedBook } as never, imageAsset, generatedBook };
}

describe('bindPageSafetySha — the phase-2 CAS advance of a page ImageAsset content SHA', () => {
  it('CAS binds against presentationUrl when a presentation transform was applied', async () => {
    const { prisma, imageAsset } = mockPrisma(1);
    const r = await bindPageSafetySha(prisma, { pageId: 'pg1', deliveredUrl: 'https://d/x.webp', presentationApplied: true, sha256: SHA });
    expect(r).toEqual({ bound: true });
    expect(imageAsset.updateMany).toHaveBeenCalledWith({
      where: { pageId: 'pg1', presentationUrl: 'https://d/x.webp', safetyContentSha256: null },
      data: { safetyContentSha256: SHA },
    });
  });

  it('CAS binds against url AND presentationUrl:null when no transform ran', async () => {
    const { prisma, imageAsset } = mockPrisma(1);
    await bindPageSafetySha(prisma, { pageId: 'pg1', deliveredUrl: 'https://d/raw.png', presentationApplied: false, sha256: SHA });
    expect(imageAsset.updateMany).toHaveBeenCalledWith({
      where: { pageId: 'pg1', url: 'https://d/raw.png', presentationUrl: null, safetyContentSha256: null },
      data: { safetyContentSha256: SHA },
    });
  });

  it('a lost CAS (row moved / already bound → 0 rows) is a fail-closed hold, not an error', async () => {
    const { prisma } = mockPrisma(0);
    expect(await bindPageSafetySha(prisma, { pageId: 'pg1', deliveredUrl: 'u', presentationApplied: false, sha256: SHA }))
      .toEqual({ bound: false, reason: 'cas_miss' });
  });

  it('a malformed SHA is REFUSED before any DB write (never feeds the DB CHECK garbage)', async () => {
    const { prisma, imageAsset } = mockPrisma(1);
    for (const bad of ['', 'a'.repeat(63), 'A'.repeat(64), 'g'.repeat(64)]) {
      expect(await bindPageSafetySha(prisma, { pageId: 'pg1', deliveredUrl: 'u', presentationApplied: false, sha256: bad }))
        .toEqual({ bound: false, reason: 'malformed_sha' });
    }
    expect(imageAsset.updateMany).not.toHaveBeenCalled();
  });
});

describe('bindCoverSafetySha — the phase-2 CAS advance of the cover (GeneratedBook) content SHA', () => {
  it('CAS binds against coverImageUrl while no SHA is bound yet', async () => {
    const { prisma, generatedBook } = mockPrisma(1);
    const r = await bindCoverSafetySha(prisma, { orderId: 'o1', deliveredUrl: 'https://d/cover.png', sha256: SHA });
    expect(r).toEqual({ bound: true });
    expect(generatedBook.updateMany).toHaveBeenCalledWith({
      where: { orderId: 'o1', coverImageUrl: 'https://d/cover.png', coverSafetyContentSha256: null },
      data: { coverSafetyContentSha256: SHA },
    });
  });

  it('a lost cover CAS → fail-closed (bound:false)', async () => {
    const { prisma } = mockPrisma(0);
    expect(await bindCoverSafetySha(prisma, { orderId: 'o1', deliveredUrl: 'u', sha256: SHA })).toEqual({ bound: false, reason: 'cas_miss' });
  });

  it('a malformed cover SHA is refused before any DB write', async () => {
    const { prisma, generatedBook } = mockPrisma(1);
    expect(await bindCoverSafetySha(prisma, { orderId: 'o1', deliveredUrl: 'u', sha256: 'nope' })).toEqual({ bound: false, reason: 'malformed_sha' });
    expect(generatedBook.updateMany).not.toHaveBeenCalled();
  });
});
