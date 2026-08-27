import { createHash } from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { finalizePackageDelivery } from '@/lib/generation-pipeline/package-delivery';
import { commitBaseBookReadiness } from '@/lib/generation-pipeline/readiness-manifest';
import type { AssetInspection } from '@/lib/generation-pipeline/asset-integrity';
import { QUALITY_EVALUATOR_CONTRACT_VERSION } from '@/lib/generation-pipeline/quality-evidence';
import { computeVisualContractHash } from '@/lib/visual-contract-compiler/contractHash';
import type { BookVisualContract } from '@/lib/visual-contract-compiler/types';

/**
 * (Codex round-5 findings 1 + 7) The COMPLETE origin matrix through the REAL
 * readiness-ON and readiness-OFF delivery implementations — no blocked-result
 * commit mock anywhere, and the ON branch runs the ACTUAL PRODUCTION receipt
 * branch: READINESS_MANIFEST_ENABLED=true, so `commitBaseBookReadiness` fences
 * the commit through `runAtomicOperation` (receipt INSERT … RETURNING +
 * result-recording update) exactly as in production. Only asset inspection and
 * the DB client are stubbed.
 *
 * Matrix cells (caller identity / fresh row / producing snapshot):
 *   A/A/A                             → eligible (ships/enqueues)
 *   B-caller/B-fresh/A-produced       → hold (producing mismatch)
 *   A-caller/B-fresh/B-produced       → hold (round-5 EXACT caller identity)
 *   legacy-caller/legacy/A-produced   → hold (A→legacy laundering)
 *   A-caller/A-fresh/missing cache    → hold (no producing snapshot)
 *   legacy/legacy/legacy              → eligible (genuine legacy)
 *   legacy + stamp, no contract       → hold (ambiguous provenance)
 *   A-caller over genuinely legacy    → hold (round-4 caller cell, both directions)
 *   A/A/A + fresh hard_band           → ANCHOR hold (round-5: the disposition
 *     derives from the fresh producing snapshot; a stale caller cannot allow)
 *   A-caller/B fully bound + hard_band→ hold (round-5 HOSTILE cell: identity
 *     mismatch parks before anything ships, zero Outbox/CAS/email)
 */

const NOW = new Date('2026-08-27T12:00:00Z');
const APP = 'https://app.example.com';
const READ_URL = `${APP}/ready?orderId=o1`;

const stubInspect = async (url: string | null | undefined): Promise<AssetInspection> => {
  const u = (url ?? '').trim();
  if (!u) return { ok: false, bytes: 0, format: null, mime: null, width: null, height: null, sha256: null, error: 'url_not_allowlisted' };
  return { ok: true, bytes: 2048, format: 'png', mime: 'image/png', width: 800, height: 1200, sha256: createHash('sha256').update(u).digest('hex') };
};
const shaOf = (u: string | null | undefined) => createHash('sha256').update((u ?? '').trim()).digest('hex');

// ── Package fixtures (mirror package-delivery.spec) ────────────────────────────
const ACCEPTED_SELECTION =
  'story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/' +
  `revisions/${'a'.repeat(64)}/integrated.md`;
const REV_A = 'a1'.repeat(32);
const REV_B = 'b2'.repeat(32);
const packageAuthority = (revision: string) => ({
  version: 'frozen-visual-package-authority/v3',
  manifestVersion: 'visual-package/v5',
  storyKey: 'chameleon_koko_bedtime',
  styleId: 'soft_hand_drawn_storybook',
  packagePath: `visual-packages/approved/revisions/${revision}.visual-package.json`,
  packageRevisionDigest: revision,
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
});
const contractFor = (revision: string) =>
  ({
    schemaVersion: 'fixture-contract/v1',
    approvedRuntimeAuthority: { packageRevisionDigest: revision },
  }) as unknown as BookVisualContract;
const CONTRACT_A = contractFor(REV_A);
const LEGACY_SELECTION = 'story-bank/v3-approved/bunny_ometz_bedtime.md';

interface RowShape {
  selectionFilename: string;
  storySourceHash: string;
  visualPackageAuthority: Record<string, unknown> | null;
  visualContractHash: string | null;
  pipelineCache: Record<string, unknown> | null;
}
/** Fully bound package row for authority `auth` produced under `contract`. */
function boundRow(revision: string): RowShape {
  const auth = packageAuthority(revision);
  const contract = contractFor(revision);
  return {
    selectionFilename: ACCEPTED_SELECTION,
    storySourceHash: 'b'.repeat(64),
    visualPackageAuthority: auth,
    visualContractHash: computeVisualContractHash(contract),
    pipelineCache: { visualPackageAuthority: auth, visualContract: contract },
  };
}
function withAnchorBand(shape: RowShape, band: 'soft_band' | 'hard_band', score: number): RowShape {
  return {
    ...shape,
    pipelineCache: { ...(shape.pipelineCache ?? {}), childAnchorLowConfidence: { reason: band, score } },
  };
}
const LEGACY_ROW: RowShape = {
  selectionFilename: LEGACY_SELECTION,
  storySourceHash: 'f'.repeat(64),
  visualPackageAuthority: null,
  visualContractHash: null,
  pipelineCache: {},
};

/** One COMMIT_SELECT/fresh-row-shaped Order row serving BOTH branches. */
function orderRow(shape: RowShape) {
  return {
    id: 'o1',
    fulfillmentVersion: 1,
    inputVersion: 0,
    deliveryFenceVersion: 0,
    expectedPageCount: 1,
    frozenProductVersion: 'v3',
    illustrationStyle: 'pencil_watercolor',
    customerEmail: 'c@e.com',
    customerName: 'Cust',
    childName: 'Kid',
    coverImageUrl: null,
    selectionFilename: shape.selectionFilename,
    storySourceHash: shape.storySourceHash,
    visualPackageAuthority: shape.visualPackageAuthority,
    visualContractHash: shape.visualContractHash,
    generationJob: { pipelineCache: shape.pipelineCache },
    book: {
      coverImageUrl: 'https://h/cover.png',
      readUrl: READ_URL,
      pdfUrl: null,
      pages: [
        { pageNumber: 1, text: 'עמוד', audioUrl: null, imageAsset: { url: 'https://h/p1.png', presentationUrl: null } },
      ],
    },
  };
}
type OrderRow = ReturnType<typeof orderRow>;

function qualityRows(row: OrderRow) {
  const contractHash = row.visualContractHash ?? null;
  return [
    { artifactKey: 'cover', assetSha256: shaOf(row.book.coverImageUrl), verdict: 'passed', evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION, reason: null, regenCount: 0, contractHash },
    { artifactKey: 'page:1', assetSha256: shaOf(row.book.pages[0]!.imageAsset.url), verdict: 'passed', evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION, reason: null, regenCount: 0, contractHash },
  ];
}

/** One client object serving both the outer prisma and the tx role (the readiness spec pattern). */
function client(row: OrderRow) {
  const executeRawSql: string[] = [];
  const executeRawValues: unknown[][] = [];
  const c = {
    executeRawSql,
    executeRawValues,
    order: {
      findUnique: vi.fn(async () => row),
      update: vi.fn(async () => ({})),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    generationJob: { update: vi.fn(async () => ({})) },
    qualityEvidence: { findMany: vi.fn(async () => qualityRows(row)) },
    bookReadinessManifest: { findFirst: vi.fn(async () => ({ revision: 1 })), create: vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: 'm1', ...a.data })) },
    bookReadiness: { upsert: vi.fn(), updateMany: vi.fn(async () => ({ count: 1 })) },
    exceptionCase: {
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(async (a: { create: Record<string, unknown> }) => ({ id: 'ec1', ...a.create })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    exceptionCaseAudit: { createMany: vi.fn(async () => ({ count: 1 })), create: vi.fn(async () => ({})) },
    deliveryOutbox: { findUnique: vi.fn(async () => null), create: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 1 })) },
    humanQaReviewCase: { findUnique: vi.fn(async () => null), findFirst: vi.fn(async () => null), update: vi.fn(async () => ({})) },
    operatorNotificationOutbox: { findFirst: vi.fn(async () => null), update: vi.fn(async () => ({})) },
    // (Codex round-5 finding 7) The PRODUCTION receipt branch runs for real: the $queryRaw mock's
    // non-empty row also serves the receipt INSERT … RETURNING (this attempt owns the operation),
    // and the recorded-result update lands on atomicOperationReceipt below.
    atomicOperationReceipt: {
      findUnique: vi.fn(async () => null),
      update: vi.fn(async () => ({})),
    },
    $queryRaw: vi.fn(async () => [{ id: 'receipt-1', fence: 0, rank: 1, status: 'generating', inputVersion: 0 }]),
    $executeRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      executeRawSql.push([...strings].join('¶'));
      executeRawValues.push(values);
      return 1;
    }),
    $transaction: vi.fn(),
  };
  c.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(c));
  return c;
}
type Client = ReturnType<typeof client>;

/** Every raw statement that ships (flips the order to ready). */
function shipCasCalls(c: Client): string[] {
  return c.executeRawSql.filter((sql) => sql.includes(`'ready'::"OrderStatus"`));
}
/** The hold markers writeOrderHoldFenced actually wrote. */
function writtenHoldMarkers(c: Client): string[] {
  return c.executeRawValues
    .flat()
    .filter((v): v is string => typeof v === 'string' && /hold|qa_soft_deliver|anchor/.test(v));
}

// Caller snapshots (what the delivery caller believes the Order is).
const callerFor = (shape: RowShape) =>
  ({
    id: 'o1',
    customerEmail: 'c@e.com',
    customerName: 'Cust',
    childName: 'Kid',
    selectionFilename: shape.selectionFilename,
    storySourceHash: shape.storySourceHash,
    illustrationStyle: 'pencil_watercolor' as const,
    visualPackageAuthority: shape.visualPackageAuthority,
  }) as never;
const PACKAGE_CALLER_A = callerFor(boundRow(REV_A));
const PACKAGE_CALLER_B = callerFor(boundRow(REV_B));
const LEGACY_CALLER = callerFor(LEGACY_ROW);

const PAYLOAD = {
  safetyGate: { held: false, reason: null },
  readUrl: READ_URL,
  coverImageUrl: 'https://h/cover.png',
  pdfUrl: null,
  firstAudioUrl: null,
};

async function run(branch: 'on' | 'off', row: OrderRow, caller: typeof LEGACY_CALLER) {
  const c = client(row);
  const send = vi.fn(async () => ({}));
  const result = await finalizePackageDelivery(
    c as never,
    { ...PAYLOAD, order: caller },
    {
      readinessEnabled: () => branch === 'on',
      send,
      now: () => NOW,
      ...(branch === 'on'
        ? {
            // The REAL commit — only inspection/time/origin injected. Never a result mock. With
            // READINESS_MANIFEST_ENABLED=true (stubbed per test) this runs the PRODUCTION receipt
            // branch through runAtomicOperation.
            commit: ((prisma: never, args: never) =>
              commitBaseBookReadiness(prisma, args, { inspect: stubInspect, now: () => NOW, appBaseUrl: APP })) as never,
          }
        : {}),
    },
  );
  return { c, send, result };
}

interface CellExpectation {
  name: string;
  row: RowShape;
  caller: typeof LEGACY_CALLER;
  outcome: 'eligible' | 'authority_hold' | 'anchor_hold';
}
const MATRIX: CellExpectation[] = [
  { name: 'A/A/A fully bound', row: boundRow(REV_A), caller: PACKAGE_CALLER_A, outcome: 'eligible' },
  {
    name: 'B caller over B-fresh row whose producing snapshot is A',
    row: { ...boundRow(REV_B), pipelineCache: { visualPackageAuthority: packageAuthority(REV_A), visualContract: CONTRACT_A } },
    caller: PACKAGE_CALLER_B,
    outcome: 'authority_hold',
  },
  {
    name: '(round-5) caller Package A over a FULLY-BOUND self-consistent Package B (exact identity equality)',
    row: boundRow(REV_B),
    caller: PACKAGE_CALLER_A,
    outcome: 'authority_hold',
  },
  {
    name: 'A→legacy laundering (legacy fresh row, A-produced snapshot)',
    row: { ...LEGACY_ROW, pipelineCache: { visualPackageAuthority: packageAuthority(REV_A), visualContract: CONTRACT_A } },
    caller: LEGACY_CALLER,
    outcome: 'authority_hold',
  },
  {
    name: 'legacy→A (package fresh row, missing producing snapshot)',
    row: { ...boundRow(REV_A), pipelineCache: {} },
    caller: PACKAGE_CALLER_A,
    outcome: 'authority_hold',
  },
  { name: 'genuine legacy everywhere', row: LEGACY_ROW, caller: LEGACY_CALLER, outcome: 'eligible' },
  {
    name: 'ambiguous provenance (legacy fresh row + stamp, no producing contract)',
    row: { ...LEGACY_ROW, visualContractHash: 'e'.repeat(64) },
    caller: LEGACY_CALLER,
    outcome: 'authority_hold',
  },
  {
    name: 'PACKAGE-shaped caller over genuinely legacy fresh state (round-4 cell)',
    row: LEGACY_ROW,
    caller: PACKAGE_CALLER_A,
    outcome: 'authority_hold',
  },
  {
    name: '(round-5 HOSTILE) caller A / fresh B / producing B, fresh hard_band, stale caller believed allow',
    row: withAnchorBand(boundRow(REV_B), 'hard_band', 0.31),
    caller: PACKAGE_CALLER_A,
    outcome: 'authority_hold',
  },
  {
    name: '(round-5) identity-consistent A/A/A whose FRESH producing snapshot holds hard_band',
    row: withAnchorBand(boundRow(REV_A), 'hard_band', 0.31),
    caller: PACKAGE_CALLER_A,
    outcome: 'anchor_hold',
  },
];

describe('origin matrix through the REAL readiness-ON implementation (production receipt branch)', () => {
  beforeEach(() => {
    vi.stubEnv('READINESS_MANIFEST_ENABLED', 'true');
    vi.stubEnv('QA_SOFT_DELIVER', 'false');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  for (const cell of MATRIX) {
    it(`${cell.name} → ${cell.outcome === 'eligible' ? 'ready + one enqueue' : 'hold, zero enqueue, zero ship CAS, zero email'}`, async () => {
      const { c, send, result } = await run('on', orderRow(cell.row), cell.caller);
      expect(result.mode).toBe('manifest');
      if (cell.outcome === 'eligible') {
        expect(result.deliveryHeld).toBe(false);
        expect(result.manifest).toMatchObject({ manifestStatus: 'passed', enqueued: true, orderStatus: 'ready' });
        expect(c.deliveryOutbox.create).toHaveBeenCalledTimes(1);
        expect(shipCasCalls(c)).toHaveLength(1);
        // The PRODUCTION receipt branch ran: the recorded result landed on the receipt row.
        expect(c.atomicOperationReceipt.update).toHaveBeenCalledTimes(1);
      } else {
        expect(result.deliveryHeld).toBe(true);
        expect(result.manifest).toMatchObject({ enqueued: false, orderStatus: 'needs_human_qa' });
        expect(c.deliveryOutbox.create).not.toHaveBeenCalled();
        expect(shipCasCalls(c)).toHaveLength(0);
        if (cell.outcome === 'authority_hold') {
          expect(result.manifest).toMatchObject({ manifestStatus: 'blocked' });
          expect(
            writtenHoldMarkers(c).some((marker) => marker.startsWith('contract_world_hold:')),
            `expected a contract_world_hold marker, saw: ${writtenHoldMarkers(c).join(', ')}`,
          ).toBe(true);
        } else {
          // Anchor hold: readiness PASSES but the fresh-derived disposition holds delivery.
          expect(result.manifest).toMatchObject({ manifestStatus: 'passed', reason: 'anchor_low_confidence:hard_band' });
        }
      }
      // The ON branch NEVER direct-sends — eligible delivery goes through the Outbox.
      expect(send).not.toHaveBeenCalled();
    });
  }

  it('the round-4/5 identity cells hold under the exact marker (delivery_snapshot_binding_invalid)', async () => {
    for (const cell of [
      { row: LEGACY_ROW, caller: PACKAGE_CALLER_A },
      { row: boundRow(REV_B), caller: PACKAGE_CALLER_A },
    ]) {
      const { c } = await run('on', orderRow(cell.row), cell.caller);
      expect(
        writtenHoldMarkers(c).some((marker) => marker === 'contract_world_hold:delivery_snapshot_binding_invalid'),
        `markers: ${writtenHoldMarkers(c).join(', ')}`,
      ).toBe(true);
    }
  });
});

describe('origin matrix through the REAL readiness-OFF implementation', () => {
  beforeEach(() => {
    vi.stubEnv('READINESS_MANIFEST_ENABLED', 'false');
    vi.stubEnv('QA_SOFT_DELIVER', 'false');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  for (const cell of MATRIX) {
    it(`${cell.name} → ${cell.outcome === 'eligible' ? 'ships + one email' : 'hold, zero ship CAS, zero email'}`, async () => {
      const { c, send, result } = await run('off', orderRow(cell.row), cell.caller);
      if (cell.outcome === 'eligible') {
        expect(result).toMatchObject({ mode: 'legacy', deliveryHeld: false });
        expect(shipCasCalls(c)).toHaveLength(1);
        expect(send).toHaveBeenCalledTimes(1);
      } else if (cell.outcome === 'authority_hold') {
        expect(result).toMatchObject({ mode: 'authority_hold', deliveryHeld: true });
        expect(shipCasCalls(c)).toHaveLength(0);
        expect(send).not.toHaveBeenCalled();
        expect(
          writtenHoldMarkers(c).some((marker) => marker.startsWith('contract_world_hold:')),
          `expected a contract_world_hold marker, saw: ${writtenHoldMarkers(c).join(', ')}`,
        ).toBe(true);
      } else {
        // Anchor hold derived from the FRESH producing snapshot on the legacy branch.
        expect(result).toMatchObject({ mode: 'legacy', deliveryHeld: true });
        expect(shipCasCalls(c)).toHaveLength(0);
        expect(send).not.toHaveBeenCalled();
        expect(
          writtenHoldMarkers(c).some((marker) => marker === 'anchor_low_confidence:hard_band'),
          `markers: ${writtenHoldMarkers(c).join(', ')}`,
        ).toBe(true);
      }
      expect(c.deliveryOutbox.create).not.toHaveBeenCalled(); // OFF never enqueues
    });
  }
});
