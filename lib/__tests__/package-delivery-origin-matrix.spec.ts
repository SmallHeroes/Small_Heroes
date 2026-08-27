import { createHash } from 'crypto';
import { describe, expect, it, vi } from 'vitest';

import { finalizePackageDelivery } from '@/lib/generation-pipeline/package-delivery';
import { commitBaseBookReadiness } from '@/lib/generation-pipeline/readiness-manifest';
import type { AssetInspection } from '@/lib/generation-pipeline/asset-integrity';
import { QUALITY_EVALUATOR_CONTRACT_VERSION } from '@/lib/generation-pipeline/quality-evidence';
import { computeVisualContractHash } from '@/lib/visual-contract-compiler/contractHash';
import type { BookVisualContract } from '@/lib/visual-contract-compiler/types';

/**
 * (Codex round-4 MAJOR 4) The COMPLETE origin matrix through the REAL
 * readiness-ON and readiness-OFF delivery implementations — no blocked-result
 * commit mock anywhere. The ON branch runs `finalizePackageDelivery` →
 * the real `commitBaseBookReadiness` (only asset inspection and the DB client
 * are stubbed); the OFF branch runs the real fresh-row gate. Every hold cell
 * asserts ZERO Outbox enqueue, ZERO ready-ship CAS, and ZERO email; the
 * eligible cells prove the exact opposite so no false park hides behind the
 * matrix.
 *
 * Matrix cells (fresh row / producing snapshot / caller):
 *   A/A/A                          → eligible (ships/enqueues)
 *   B(self-consistent)/A/B         → hold
 *   legacy/A-produced/legacy       → hold (A→legacy laundering)
 *   A/missing/A                    → hold (legacy→A: no producing snapshot)
 *   legacy/legacy/legacy           → eligible (genuine legacy)
 *   legacy+stamp/no contract       → hold (ambiguous provenance)
 *   legacy/legacy/PACKAGE-shaped   → hold (the round-4 caller-origin cell)
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
    $queryRaw: vi.fn(async () => [{ id: 'hqc-test', fence: 0, rank: 1, status: 'generating', inputVersion: 0 }]),
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
const callerFor = (shape: RowShape) => ({
  id: 'o1',
  customerEmail: 'c@e.com',
  customerName: 'Cust',
  childName: 'Kid',
  selectionFilename: shape.selectionFilename,
  storySourceHash: shape.storySourceHash,
  illustrationStyle: 'pencil_watercolor' as const,
  visualPackageAuthority: shape.visualPackageAuthority,
});
const PACKAGE_CALLER = callerFor(boundRow(REV_A));
const LEGACY_CALLER = callerFor(LEGACY_ROW);

const PAYLOAD = {
  deliveryGate: { held: false, orderStatus: 'ready' as const, reason: null, sendBookReadyEmail: true },
  safetyGate: { held: false, reason: null },
  readUrl: READ_URL,
  coverImageUrl: 'https://h/cover.png',
  pdfUrl: null,
  firstAudioUrl: null,
};

async function run(
  branch: 'on' | 'off',
  row: OrderRow,
  caller: ReturnType<typeof callerFor>,
) {
  const c = client(row);
  const send = vi.fn(async () => ({}));
  const result = await finalizePackageDelivery(
    c as never,
    { ...PAYLOAD, order: caller as never },
    {
      readinessEnabled: () => branch === 'on',
      send,
      now: () => NOW,
      ...(branch === 'on'
        ? {
            // The REAL commit — only inspection/time/origin injected. Never a result mock.
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
  caller: ReturnType<typeof callerFor>;
  eligible: boolean;
}
const MATRIX: CellExpectation[] = [
  { name: 'A/A/A fully bound', row: boundRow(REV_A), caller: PACKAGE_CALLER, eligible: true },
  {
    name: 'fresh self-consistent B over A-produced snapshot',
    row: { ...boundRow(REV_B), pipelineCache: { visualPackageAuthority: packageAuthority(REV_A), visualContract: CONTRACT_A } },
    caller: callerFor(boundRow(REV_B)),
    eligible: false,
  },
  {
    name: 'A→legacy laundering (legacy fresh row, A-produced snapshot)',
    row: { ...LEGACY_ROW, pipelineCache: { visualPackageAuthority: packageAuthority(REV_A), visualContract: CONTRACT_A } },
    caller: LEGACY_CALLER,
    eligible: false,
  },
  {
    name: 'legacy→A (package fresh row, missing producing snapshot)',
    row: { ...boundRow(REV_A), pipelineCache: {} },
    caller: PACKAGE_CALLER,
    eligible: false,
  },
  { name: 'genuine legacy everywhere', row: LEGACY_ROW, caller: LEGACY_CALLER, eligible: true },
  {
    name: 'ambiguous provenance (legacy fresh row + stamp, no producing contract)',
    row: { ...LEGACY_ROW, visualContractHash: 'e'.repeat(64) },
    caller: LEGACY_CALLER,
    eligible: false,
  },
  {
    name: 'PACKAGE-shaped caller over genuinely legacy fresh state (round-4 cell)',
    row: LEGACY_ROW,
    caller: PACKAGE_CALLER,
    eligible: false,
  },
];

describe('origin matrix through the REAL readiness-ON implementation', () => {
  for (const cell of MATRIX) {
    it(`${cell.name} → ${cell.eligible ? 'ready + one enqueue' : 'hold, zero enqueue, zero ship CAS, zero email'}`, async () => {
      const { c, send, result } = await run('on', orderRow(cell.row), cell.caller);
      expect(result.mode).toBe('manifest');
      if (cell.eligible) {
        expect(result.deliveryHeld).toBe(false);
        expect(result.manifest).toMatchObject({ manifestStatus: 'passed', enqueued: true, orderStatus: 'ready' });
        expect(c.deliveryOutbox.create).toHaveBeenCalledTimes(1);
        expect(shipCasCalls(c)).toHaveLength(1);
      } else {
        expect(result.deliveryHeld).toBe(true);
        expect(result.manifest).toMatchObject({ manifestStatus: 'blocked', enqueued: false, orderStatus: 'needs_human_qa' });
        expect(c.deliveryOutbox.create).not.toHaveBeenCalled();
        expect(shipCasCalls(c)).toHaveLength(0);
        expect(
          writtenHoldMarkers(c).some((marker) => marker.startsWith('contract_world_hold:')),
          `expected a contract_world_hold marker, saw: ${writtenHoldMarkers(c).join(', ')}`,
        ).toBe(true);
      }
      // The ON branch NEVER direct-sends — eligible delivery goes through the Outbox.
      expect(send).not.toHaveBeenCalled();
    });
  }

  it('the round-4 caller cell holds under the exact marker family (delivery_snapshot_binding_invalid)', async () => {
    const { c } = await run('on', orderRow(LEGACY_ROW), PACKAGE_CALLER);
    expect(
      writtenHoldMarkers(c).some((marker) => marker === 'contract_world_hold:delivery_snapshot_binding_invalid'),
      `markers: ${writtenHoldMarkers(c).join(', ')}`,
    ).toBe(true);
  });
});

describe('origin matrix through the REAL readiness-OFF implementation', () => {
  for (const cell of MATRIX) {
    it(`${cell.name} → ${cell.eligible ? 'ships + one email' : 'hold, zero ship CAS, zero email'}`, async () => {
      const { c, send, result } = await run('off', orderRow(cell.row), cell.caller);
      if (cell.eligible) {
        expect(result).toMatchObject({ mode: 'legacy', deliveryHeld: false });
        expect(shipCasCalls(c)).toHaveLength(1);
        expect(send).toHaveBeenCalledTimes(1);
      } else {
        expect(result).toMatchObject({ mode: 'authority_hold', deliveryHeld: true });
        expect(shipCasCalls(c)).toHaveLength(0);
        expect(send).not.toHaveBeenCalled();
        expect(
          writtenHoldMarkers(c).some((marker) => marker.startsWith('contract_world_hold:')),
          `expected a contract_world_hold marker, saw: ${writtenHoldMarkers(c).join(', ')}`,
        ).toBe(true);
      }
      expect(c.deliveryOutbox.create).not.toHaveBeenCalled(); // OFF never enqueues
    });
  }
});
