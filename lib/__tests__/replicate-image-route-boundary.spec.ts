import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { computeVisualContractHash } from '@/lib/visual-contract-compiler/contractHash';

/**
 * Route-boundary regression for POST /api/debug/replicate-image: the debug
 * image route proves the FULL producing-snapshot provenance (fresh Order +
 * `GenerationJob.pipelineCache`) and refuses everything that is not a genuine
 * legacy Order — a package-backed Order (even fully bound), an aliased or
 * malformed accepted reference, a legacy Order carrying package authority,
 * an A→legacy-produced snapshot, an A→B producing mismatch, a missing
 * producing snapshot, and an ambiguous stamp — each with ZERO provider calls
 * and ZERO writes (no barrier mutation, no persistence). (Codex round-4
 * MAJOR 6: the Order shape alone was not enough.)
 */
const H = vi.hoisted(() => ({
  orderFindUnique: vi.fn(),
  generateImage: vi.fn(),
  withDeliveryInputMutation: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { order: { findUnique: H.orderFindUnique } },
}));
vi.mock('../../backend/providers/image', () => ({
  generateImage: H.generateImage,
}));
vi.mock('@/lib/generation-pipeline/readiness-manifest', () => ({
  withDeliveryInputMutation: H.withDeliveryInputMutation,
}));

import { POST } from '@/app/api/debug/replicate-image/route';

const ACCEPTED_SELECTION =
  'story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/' +
  `revisions/${'a'.repeat(64)}/integrated.md`;

const AUTHORITY = {
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
};
const CONTRACT_C = {
  schemaVersion: 'fixture-contract/v1',
  approvedRuntimeAuthority: { packageRevisionDigest: 'c'.repeat(64) },
};
const CONTRACT_OTHER = {
  schemaVersion: 'fixture-contract/v1',
  approvedRuntimeAuthority: { packageRevisionDigest: '9'.repeat(64) },
};

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
    visualContractHash: null,
    generationJob: { pipelineCache: null },
    book: {
      pages: [{ id: 'p1', pageNumber: 1, text: 'עמוד' }],
    },
    ...overrides,
  };
}

const packageBacked = (over: Record<string, unknown> = {}) =>
  orderRow({
    selectionFilename: ACCEPTED_SELECTION,
    storySourceHash: 'b'.repeat(64),
    visualPackageAuthority: AUTHORITY,
    visualContractHash: computeVisualContractHash(CONTRACT_C as never),
    generationJob: {
      pipelineCache: { visualPackageAuthority: AUTHORITY, visualContract: CONTRACT_C },
    },
    ...over,
  });

function request(persistToPage = false): NextRequest {
  return new NextRequest('https://qa.example.com/api/debug/replicate-image', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ orderId: 'o1', pageNumber: 1, persistToPage }),
  });
}

describe('POST /api/debug/replicate-image — producing-snapshot authority boundary', () => {
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
    ['fully bound package-backed Order (exact package)', packageBacked()],
    [
      'aliased accepted reference',
      orderRow({ selectionFilename: `x/../${ACCEPTED_SELECTION}` }),
    ],
    [
      'legacy Order carrying package authority (origin mix)',
      orderRow({ visualPackageAuthority: { version: 'hostile' } }),
    ],
    [
      'A→legacy: legacy-looking Order over a package-shaped producing cache',
      orderRow({
        generationJob: {
          pipelineCache: { visualPackageAuthority: { version: 'produced-under-a-package' } },
        },
      }),
    ],
    [
      'A→B: package Order whose producing contract embeds a DIFFERENT revision',
      packageBacked({
        generationJob: {
          pipelineCache: { visualPackageAuthority: AUTHORITY, visualContract: CONTRACT_OTHER },
        },
      }),
    ],
    [
      'missing producing snapshot on a package-backed Order',
      packageBacked({ generationJob: { pipelineCache: {} } }),
    ],
    [
      'ambiguous provenance: legacy Order with a stamp but no producing contract',
      orderRow({ visualContractHash: 'e'.repeat(64) }),
    ],
  ])('refuses a %s with 409, ZERO provider calls, ZERO writes', async (_label, row) => {
    H.orderFindUnique.mockResolvedValue(row);
    const response = await POST(request(true)); // persistence requested — still zero writes
    expect(response.status).toBe(409);
    expect(H.generateImage).not.toHaveBeenCalled();
    expect(H.withDeliveryInputMutation).not.toHaveBeenCalled();
  });

  it('proceeds for a genuine legacy Order (no persistence requested)', async () => {
    H.orderFindUnique.mockResolvedValue(orderRow());
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(H.generateImage).toHaveBeenCalledTimes(1);
    expect(H.withDeliveryInputMutation).not.toHaveBeenCalled();
  });

  it('proceeds for a legacy Order whose stamped legacy contract matches the producing bytes', async () => {
    const legacyContract = { schemaVersion: 'fixture-contract/v1' };
    H.orderFindUnique.mockResolvedValue(
      orderRow({
        visualContractHash: computeVisualContractHash(legacyContract as never),
        generationJob: { pipelineCache: { visualContract: legacyContract } },
      }),
    );
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(H.generateImage).toHaveBeenCalledTimes(1);
  });
});
