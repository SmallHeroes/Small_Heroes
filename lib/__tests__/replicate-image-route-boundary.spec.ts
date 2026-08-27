import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Route-boundary regression for POST /api/debug/replicate-image: the debug
 * image route runs the FULL Order authority validation and refuses everything
 * that is not a genuine legacy Order — a package-backed Order, an
 * aliased/malformed accepted reference, and a legacy Order carrying package
 * authority (origin mix) — before any provider work.
 */
const H = vi.hoisted(() => ({
  orderFindUnique: vi.fn(),
  generateImage: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { order: { findUnique: H.orderFindUnique } },
}));
vi.mock('../../backend/providers/image', () => ({
  generateImage: H.generateImage,
}));
vi.mock('@/lib/generation-pipeline/readiness-manifest', () => ({
  withDeliveryInputMutation: vi.fn(),
}));

import { POST } from '@/app/api/debug/replicate-image/route';

const ACCEPTED_SELECTION =
  'story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/' +
  `revisions/${'a'.repeat(64)}/integrated.md`;

function orderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'o1',
    childName: 'Kid',
    childGender: 'boy',
    childAge: 5,
    childImageUrl: null,
    illustrationStyle: 'pencil_watercolor',
    selectionFilename: 'story-bank/v3-approved/bunny_ometz_bedtime.md',
    storySourceHash: 'f'.repeat(64),
    visualPackageAuthority: null,
    book: {
      pages: [{ id: 'p1', pageNumber: 1, text: 'עמוד' }],
    },
    ...overrides,
  };
}

function request(): NextRequest {
  return new NextRequest('https://qa.example.com/api/debug/replicate-image', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ orderId: 'o1', pageNumber: 1 }),
  });
}

describe('POST /api/debug/replicate-image — authority boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('GENERATION_SECRET', '');
    H.generateImage.mockResolvedValue({
      url: 'https://h/generated.png',
      rawUrl: null,
      prompt: 'p',
      provider: 'fixture',
      width: 1024,
      height: 1024,
    });
  });

  it.each([
    [
      'package-backed Order',
      orderRow({
        selectionFilename: ACCEPTED_SELECTION,
        storySourceHash: 'b'.repeat(64),
        visualPackageAuthority: {
          version: 'frozen-visual-package-authority/v3',
          manifestVersion: 'visual-package/v5',
          storyKey: 'chameleon_koko_bedtime',
          styleId: 'soft_hand_drawn_storybook',
          packagePath: `visual-packages/approved/revisions/${'c'.repeat(64)}.visual-package.json`,
          packageRevisionDigest: 'c'.repeat(64),
          sourcePath: ACCEPTED_SELECTION,
          sourceDigest: 'd'.repeat(64),
          sourceRawDigest: 'b'.repeat(64),
          blueprintDigest: 'e'.repeat(64),
          authoringAuthorityDigest: 'f'.repeat(64),
          planningApprovalDigest: '1'.repeat(64),
          styleAuthorityDigest: '2'.repeat(64),
          visualContractTemplateDigest: '3'.repeat(64),
          reconciliationDigest: '4'.repeat(64),
          layoutPolicyVersion: 'portrait-layout-compatibility/v1',
        },
      }),
    ],
    [
      'aliased accepted reference',
      orderRow({ selectionFilename: `x/../${ACCEPTED_SELECTION}` }),
    ],
    [
      'legacy Order carrying package authority (origin mix)',
      orderRow({ visualPackageAuthority: { version: 'hostile' } }),
    ],
  ])('refuses a %s with 409 before any provider call', async (_label, row) => {
    H.orderFindUnique.mockResolvedValue(row);
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(H.generateImage).not.toHaveBeenCalled();
  });

  it('proceeds for a genuine legacy Order (no persistence requested)', async () => {
    H.orderFindUnique.mockResolvedValue(orderRow());
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(H.generateImage).toHaveBeenCalledTimes(1);
  });
});
