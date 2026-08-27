import { describe, expect, it, vi } from 'vitest';
import { finalizePackageDelivery, resolveSafetyDeliveryGate } from '@/lib/generation-pipeline/package-delivery';
import { computeVisualContractHash } from '@/lib/visual-contract-compiler/contractHash';
import type { BookVisualContract } from '@/lib/visual-contract-compiler/types';

const order = {
  id: 'o1',
  customerEmail: 'parent@example.com',
  customerName: 'Parent',
  childName: 'Kid',
  // Genuine legacy story-bank Order: no package authority anywhere.
  selectionFilename: 'story-bank/v3-approved/bunny_ometz_bedtime.md',
  storySourceHash: 'f'.repeat(64),
  illustrationStyle: 'pencil_watercolor' as const,
  visualPackageAuthority: null,
};

const allowGate = {
  held: false,
  orderStatus: 'ready' as const,
  reason: null,
  sendBookReadyEmail: true,
};

function db() {
  const client = {
    order: { update: vi.fn(async () => ({})), findUnique: vi.fn(async () => ({ childName: 'Test', inputVersion: 0, visualContractHash: null, deliveryFenceVersion: 0 })) },
    generationJob: { update: vi.fn(async () => ({})) },
    // (Fix 5) the safety pre-gate parks in a tx and resolves any active recovery case (findUnique → null = no-op).
    exceptionCase: { findUnique: vi.fn(async () => null), updateMany: vi.fn(async () => ({ count: 0 })) },
    // (Human-QA Slice 1) no-op stubs for the ADDITIVE review-case writes (safety park + legacy anchor park). No
    // active case, first revision, raw ON CONFLICT insert returns a row. Decision assertions on order.update are
    // unchanged — these only let the additive path run.
    humanQaReviewCase: { findUnique: vi.fn(async () => null), findFirst: vi.fn(async () => null), update: vi.fn(async () => ({})) },
    operatorNotificationOutbox: { findFirst: vi.fn(async () => null), update: vi.fn(async () => ({})) },
    // (delivery fence round-5) $queryRaw serves the receipt INSERT…RETURNING id AND writeOrderHoldFenced's SELECT;
    // $executeRaw serves the ship CAS + the hold CAS (1 = applied/shipped by default). Real semantics: PG harness.
    $queryRaw: vi.fn(async () => [{ id: 'hqc-test', fence: 0, rank: 1, status: 'generating', inputVersion: 0 }]),
    $executeRaw: vi.fn(async () => 1),
    $transaction: vi.fn(),
  };
  client.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(client));
  return client;
}

describe('finalizePackageDelivery — flag boundary', () => {
  it('flag-on delegates to readiness commit and never writes legacy state or sends directly', async () => {
    const prisma = db();
    const send = vi.fn();
    const commit = vi.fn(async () => ({
      manifestStatus: 'passed' as const,
      enqueued: true,
      orderStatus: 'ready',
      reason: null,
      revision: 2,
    }));
    const result = await finalizePackageDelivery(
      prisma as never,
      { order, deliveryGate: allowGate, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
      { readinessEnabled: () => true, commit: commit as never, send },
    );

    expect(result).toMatchObject({ mode: 'manifest', deliveryHeld: false });
    expect(commit).toHaveBeenCalledWith(prisma, {
      orderId: 'o1',
      anchorAllowsDelivery: true,
      anchorOrderStatus: 'ready',
      anchorReason: null,
      // (Codex round-4 MAJOR 4) the caller-origin claim is threaded into the commit on the ON
      // branch (false here: a genuinely legacy caller snapshot).
      callerVisualPackageClaim: false,
    });
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(prisma.generationJob.update).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('flag-on preserves an anchor hold through the readiness commit and still never direct-sends', async () => {
    const prisma = db();
    const send = vi.fn();
    const heldGate = {
      held: true,
      orderStatus: 'needs_human_qa' as const,
      reason: 'anchor_low_confidence:soft_band',
      sendBookReadyEmail: false,
    };
    const commit = vi.fn(async () => ({
      manifestStatus: 'passed' as const,
      enqueued: false,
      orderStatus: 'needs_human_qa',
      reason: heldGate.reason,
      revision: 3,
    }));
    const result = await finalizePackageDelivery(
      prisma as never,
      { order, deliveryGate: heldGate, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
      { readinessEnabled: () => true, commit: commit as never, send },
    );
    expect(result).toMatchObject({ mode: 'manifest', deliveryHeld: true });
    expect(commit).toHaveBeenCalledWith(prisma, expect.objectContaining({
      anchorAllowsDelivery: false,
      anchorOrderStatus: 'needs_human_qa',
      anchorReason: heldGate.reason,
    }));
    expect(send).not.toHaveBeenCalled();
  });

  it('flag-on integrity block is reported held and cannot fall through to the legacy sender', async () => {
    const prisma = db();
    const send = vi.fn();
    const commit = vi.fn(async () => ({
      manifestStatus: 'blocked' as const,
      enqueued: false,
      orderStatus: 'needs_human_qa',
      reason: 'base_book_integrity:page_2_not_decodable',
      revision: 4,
    }));
    const result = await finalizePackageDelivery(
      prisma as never,
      { order, deliveryGate: allowGate, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
      { readinessEnabled: () => true, commit: commit as never, send },
    );
    expect(result).toMatchObject({
      mode: 'manifest',
      deliveryHeld: true,
      manifest: { manifestStatus: 'blocked', enqueued: false },
    });
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('flag-off preserves legacy ready/job updates and direct email payload', async () => {
    const prisma = db();
    const send = vi.fn(async () => ({}));
    const now = new Date('2026-06-30T12:00:00Z');
    const result = await finalizePackageDelivery(
      prisma as never,
      {
        order,
        deliveryGate: allowGate,
        safetyGate: { held: false, reason: null },
        readUrl: 'https://app/ready?orderId=o1',
        pdfUrl: 'https://assets/book.pdf',
        firstAudioUrl: 'https://assets/page-1.mp3',
      },
      { readinessEnabled: () => false, send, now: () => now },
    );

    expect(result).toEqual({ mode: 'legacy', deliveryHeld: false, manifest: null });
    // (delivery fence round-5 P0-2) the legacy `ready` transition is now the guarded ship CAS ($executeRaw), not a
    // bare order.update; the email is gated on it winning (1 row). Real CAS WHERE proven in the PG harness.
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(prisma.generationJob.update).toHaveBeenCalledWith({
      where: { orderId: 'o1' },
      data: { status: 'done', currentStage: 'done', completedAt: now, packaged: true },
    });
    expect(send).toHaveBeenCalledWith({
      to: order.customerEmail,
      customerName: order.customerName,
      childName: order.childName,
      readUrl: 'https://app/ready?orderId=o1',
      audioUrl: 'https://assets/page-1.mp3',
      pdfUrl: 'https://assets/book.pdf',
    });
  });

  it('flag-off held path keeps the legacy hold and sends no email', async () => {
    const prisma = db();
    const send = vi.fn();
    const heldGate = {
      held: true,
      orderStatus: 'needs_human_qa' as const,
      reason: 'anchor_low_confidence:hard_band',
      sendBookReadyEmail: false,
    };
    const result = await finalizePackageDelivery(
      prisma as never,
      { order, deliveryGate: heldGate, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
      { readinessEnabled: () => false, send },
    );
    expect(result).toMatchObject({ mode: 'legacy', deliveryHeld: true });
    // (delivery fence round-5) the legacy park is now writeOrderHoldFenced ($executeRaw + precedence), not order.update.
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});

describe('finalizePackageDelivery — readiness-independent safety pre-gate (Fix 1)', () => {
  const heldSafety = { held: true, reason: 'safety_hold:hazard:page:2:child_on_railing' };

  it('safety held + readiness OFF (prod) → needs_human_qa + safety_hold marker, no email, no legacy ready', async () => {
    const prisma = db();
    const send = vi.fn();
    const result = await finalizePackageDelivery(
      prisma as never,
      { order, deliveryGate: allowGate, safetyGate: heldSafety, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
      { readinessEnabled: () => false, send },
    );
    expect(result).toMatchObject({ mode: 'safety_hold', deliveryHeld: true });
    // (delivery fence round-5 Unit 2) the safety park now goes through writeOrderHoldFenced ($executeRaw + rank-3
    // precedence), not a bare tx.order.update. Real CAS/precedence proven in the PG harness.
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('safety held + readiness ON → the pre-gate wins; the readiness commit is NEVER reached', async () => {
    const prisma = db();
    const commit = vi.fn();
    const send = vi.fn();
    const result = await finalizePackageDelivery(
      prisma as never,
      { order, deliveryGate: allowGate, safetyGate: heldSafety, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
      { readinessEnabled: () => true, commit: commit as never, send },
    );
    expect(result.mode).toBe('safety_hold');
    expect(commit).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});

describe('finalizePackageDelivery — readiness-independent package-authority gate (FRESH row, never stale args)', () => {
  const ACCEPTED_SELECTION =
    'story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/' +
    `revisions/${'a'.repeat(64)}/integrated.md`;
  // A structurally VALID authority envelope, consistent with ACCEPTED_SELECTION —
  // the caller's snapshot is healthy; only the database row has drifted.
  const staleValidAuthority = {
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
  const staleValidArgsOrder = {
    ...order,
    selectionFilename: ACCEPTED_SELECTION,
    storySourceHash: 'b'.repeat(64),
    visualPackageAuthority: staleValidAuthority,
  };

  function dbWithFreshRow(freshRow: Record<string, unknown>) {
    const prisma = db();
    // inputVersion/fence mirror the $queryRaw stub inside db() so the fenced
    // hold write proceeds (real CAS semantics live in the PG harness).
    prisma.order.findUnique = vi.fn(async () => ({
      inputVersion: 0,
      deliveryFenceVersion: 0,
      ...freshRow,
    }));
    return prisma;
  }

  it('readiness OFF: stale-VALID args + fresh accepted row with NULL authority → hold, zero ship, zero email', async () => {
    const prisma = dbWithFreshRow({
      selectionFilename: ACCEPTED_SELECTION,
      storySourceHash: 'b'.repeat(64),
      illustrationStyle: 'pencil_watercolor',
      visualPackageAuthority: null,
    });
    const send = vi.fn();
    const result = await finalizePackageDelivery(
      prisma as never,
      { order: staleValidArgsOrder, deliveryGate: allowGate, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
      { readinessEnabled: () => false, send },
    );
    expect(result).toMatchObject({ mode: 'authority_hold', deliveryHeld: true, manifest: null });
    // The hold is the fenced park ($executeRaw via writeOrderHoldFenced); the ship path is never entered.
    // (findUnique also serves the post-commit case sync, so assert presence, not count — the args
    // snapshot was VALID, so mode=authority_hold itself proves the fresh row decided.)
    expect(prisma.order.findUnique).toHaveBeenCalled();
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(prisma.generationJob.update).toHaveBeenCalled();
  });

  it('readiness OFF: stale-VALID args + fresh row whose authority MISMATCHES its own frozen truth → hold, no email', async () => {
    const prisma = dbWithFreshRow({
      selectionFilename: ACCEPTED_SELECTION,
      storySourceHash: '9'.repeat(64), // fresh digest no longer matches the stored authority
      illustrationStyle: 'pencil_watercolor',
      visualPackageAuthority: staleValidAuthority,
    });
    const send = vi.fn();
    const result = await finalizePackageDelivery(
      prisma as never,
      { order: staleValidArgsOrder, deliveryGate: allowGate, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
      { readinessEnabled: () => false, send },
    );
    expect(result).toMatchObject({ mode: 'authority_hold', deliveryHeld: true });
    expect(send).not.toHaveBeenCalled();
  });

  it('readiness OFF: fresh LEGACY row carrying package authority (origin mix) → hold, no email', async () => {
    const prisma = dbWithFreshRow({
      selectionFilename: 'story-bank/v3-approved/bunny_ometz_bedtime.md',
      storySourceHash: 'f'.repeat(64),
      illustrationStyle: 'pencil_watercolor',
      visualPackageAuthority: { version: 'hostile' },
    });
    const send = vi.fn();
    const result = await finalizePackageDelivery(
      prisma as never,
      { order, deliveryGate: allowGate, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
      { readinessEnabled: () => false, send },
    );
    expect(result).toMatchObject({ mode: 'authority_hold', deliveryHeld: true });
    expect(send).not.toHaveBeenCalled();
  });

  it('readiness OFF: PACKAGE-SHAPED caller snapshot + fresh legacy-clean row → hold (origin matrix, caller leg)', async () => {
    // Round-3: a legacy fresh row must not launder a package-shaped caller
    // snapshot — someone re-pointed the frozen truth after the caller loaded it.
    const prisma = dbWithFreshRow({
      selectionFilename: 'story-bank/v3-approved/bunny_ometz_bedtime.md',
      storySourceHash: 'f'.repeat(64),
      illustrationStyle: 'pencil_watercolor',
      visualPackageAuthority: null,
    });
    const send = vi.fn(async () => ({}));
    const result = await finalizePackageDelivery(
      prisma as never,
      {
        order: { ...staleValidArgsOrder, visualPackageAuthority: null },
        deliveryGate: allowGate,
        safetyGate: { held: false, reason: null },
        readUrl: 'https://app/ready?orderId=o1',
        pdfUrl: null,
        firstAudioUrl: null,
      },
      { readinessEnabled: () => false, send },
    );
    expect(result).toMatchObject({ mode: 'authority_hold', deliveryHeld: true });
    expect(send).not.toHaveBeenCalled();
  });

  it('readiness OFF: genuine legacy everywhere (caller, fresh row, producing snapshot) → ships (positive control)', async () => {
    const prisma = dbWithFreshRow({
      selectionFilename: 'story-bank/v3-approved/bunny_ometz_bedtime.md',
      storySourceHash: 'f'.repeat(64),
      illustrationStyle: 'pencil_watercolor',
      visualPackageAuthority: null,
    });
    const send = vi.fn(async () => ({}));
    const result = await finalizePackageDelivery(
      prisma as never,
      { order, deliveryGate: allowGate, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
      { readinessEnabled: () => false, send },
    );
    expect(result).toMatchObject({ mode: 'legacy', deliveryHeld: false });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('readiness OFF: A→LEGACY laundering — fresh row legacy-clean but producing snapshot carries Package A → hold', async () => {
    const prisma = dbWithFreshRow({
      selectionFilename: 'story-bank/v3-approved/bunny_ometz_bedtime.md',
      storySourceHash: 'f'.repeat(64),
      illustrationStyle: 'pencil_watercolor',
      visualPackageAuthority: null,
      generationJob: {
        pipelineCache: {
          visualPackageAuthority: packageAuthority(REV_A),
          visualContract: CONTRACT_A,
        },
      },
    });
    const send = vi.fn(async () => ({}));
    const result = await finalizePackageDelivery(
      prisma as never,
      { order, deliveryGate: allowGate, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
      { readinessEnabled: () => false, send },
    );
    expect(result).toMatchObject({ mode: 'authority_hold', deliveryHeld: true });
    expect(send).not.toHaveBeenCalled();
  });

  it('readiness OFF: legacy fresh row with a stamp but no producing contract (ambiguous provenance) → hold', async () => {
    const prisma = dbWithFreshRow({
      selectionFilename: 'story-bank/v3-approved/bunny_ometz_bedtime.md',
      storySourceHash: 'f'.repeat(64),
      illustrationStyle: 'pencil_watercolor',
      visualPackageAuthority: null,
      visualContractHash: 'e'.repeat(64),
    });
    const send = vi.fn(async () => ({}));
    const result = await finalizePackageDelivery(
      prisma as never,
      { order, deliveryGate: allowGate, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
      { readinessEnabled: () => false, send },
    );
    expect(result).toMatchObject({ mode: 'authority_hold', deliveryHeld: true });
    expect(send).not.toHaveBeenCalled();
  });

  it('readiness OFF: legacy fresh row whose stamped legacy contract matches the producing bytes → ships (legacy freeze preserved)', async () => {
    const legacyContract = { schemaVersion: 'fixture-contract/v1' } as unknown as BookVisualContract;
    const prisma = dbWithFreshRow({
      selectionFilename: 'story-bank/v3-approved/bunny_ometz_bedtime.md',
      storySourceHash: 'f'.repeat(64),
      illustrationStyle: 'pencil_watercolor',
      visualPackageAuthority: null,
      visualContractHash: computeVisualContractHash(legacyContract),
      generationJob: { pipelineCache: { visualContract: legacyContract } },
    });
    const send = vi.fn(async () => ({}));
    const result = await finalizePackageDelivery(
      prisma as never,
      { order, deliveryGate: allowGate, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
      { readinessEnabled: () => false, send },
    );
    expect(result).toMatchObject({ mode: 'legacy', deliveryHeld: false });
    expect(send).toHaveBeenCalledTimes(1);
  });

  // ── Producing-snapshot binding (Codex re-gate MAJOR): fresh self-consistent B must never
  //    authorize artifacts produced under A ─────────────────────────────────────────────────
  const packageAuthority = (revision: string) => ({
    ...staleValidAuthority,
    packagePath: `visual-packages/approved/revisions/${revision}.visual-package.json`,
    packageRevisionDigest: revision,
  });
  const REV_A = 'a1'.repeat(32);
  const REV_B = 'b2'.repeat(32);
  const contractFor = (revision: string) =>
    ({
      schemaVersion: 'fixture-contract/v1',
      approvedRuntimeAuthority: { packageRevisionDigest: revision },
    }) as unknown as BookVisualContract;
  const CONTRACT_A = contractFor(REV_A);
  const CONTRACT_B = contractFor(REV_B);
  const PAYLOAD_ARGS = {
    deliveryGate: allowGate,
    safetyGate: { held: false, reason: null },
    readUrl: 'https://app/ready?orderId=o1',
    pdfUrl: null,
    firstAudioUrl: null,
  };
  /** A fully self-bound fresh row for authority `auth` produced under `contract` (stamp = its hash). */
  function boundFreshRow(auth: Record<string, unknown>, contract: BookVisualContract, cacheAuth: Record<string, unknown> = auth) {
    return {
      selectionFilename: ACCEPTED_SELECTION,
      storySourceHash: 'b'.repeat(64),
      illustrationStyle: 'pencil_watercolor',
      visualPackageAuthority: auth,
      visualContractHash: computeVisualContractHash(contract),
      coverImageUrl: null,
      generationJob: {
        pipelineCache: { visualPackageAuthority: cacheAuth, visualContract: contract },
      },
      book: { readUrl: 'https://app/ready?orderId=o1', coverImageUrl: null, pdfUrl: null, pages: [] },
    };
  }

  it('A→B ADVERSARIAL: payload produced under Package A, fresh row self-consistent Package B → hold, zero ship, zero email', async () => {
    // Fresh row IS internally valid under B; the producing snapshot (cache authority,
    // contract bytes and stamp) all say A. Exactly Codex's reproduction.
    const prisma = dbWithFreshRow({
      ...boundFreshRow(packageAuthority(REV_B), CONTRACT_A, packageAuthority(REV_A)),
    });
    const send = vi.fn();
    const result = await finalizePackageDelivery(
      prisma as never,
      { order: { ...order, visualPackageAuthority: packageAuthority(REV_A) }, ...PAYLOAD_ARGS },
      { readinessEnabled: () => false, send },
    );
    expect(result).toMatchObject({ mode: 'authority_hold', deliveryHeld: true, manifest: null });
    expect(send).not.toHaveBeenCalled();
  });

  it('stale/invalid producing snapshot + clean fresh row → hold (missing cache never ships)', async () => {
    const row = boundFreshRow(packageAuthority(REV_B), CONTRACT_B);
    const prisma = dbWithFreshRow({ ...row, generationJob: null });
    const send = vi.fn();
    const result = await finalizePackageDelivery(
      prisma as never,
      { order, ...PAYLOAD_ARGS },
      { readinessEnabled: () => false, send },
    );
    expect(result).toMatchObject({ mode: 'authority_hold', deliveryHeld: true });
    expect(send).not.toHaveBeenCalled();
  });

  it('contract stamp differing from the producing contract bytes → hold', async () => {
    const row = boundFreshRow(packageAuthority(REV_B), CONTRACT_B);
    const prisma = dbWithFreshRow({ ...row, visualContractHash: 'f'.repeat(64) });
    const send = vi.fn();
    const result = await finalizePackageDelivery(
      prisma as never,
      { order, ...PAYLOAD_ARGS },
      { readinessEnabled: () => false, send },
    );
    expect(result).toMatchObject({ mode: 'authority_hold', deliveryHeld: true });
    expect(send).not.toHaveBeenCalled();
  });

  it('producing contract embedding a different package revision → hold', async () => {
    // Cache authority matches the fresh B, but the contract bytes were produced under A.
    const row = boundFreshRow(packageAuthority(REV_B), CONTRACT_A);
    const prisma = dbWithFreshRow(row);
    const send = vi.fn();
    const result = await finalizePackageDelivery(
      prisma as never,
      { order, ...PAYLOAD_ARGS },
      { readinessEnabled: () => false, send },
    );
    expect(result).toMatchObject({ mode: 'authority_hold', deliveryHeld: true });
    expect(send).not.toHaveBeenCalled();
  });

  it('caller payload diverging from the fresh Book snapshot (readUrl) → hold, zero ship, zero email', async () => {
    const prisma = dbWithFreshRow(boundFreshRow(packageAuthority(REV_B), CONTRACT_B));
    const send = vi.fn();
    const result = await finalizePackageDelivery(
      prisma as never,
      { order, ...PAYLOAD_ARGS, readUrl: 'https://app/ready?orderId=SOMEONE-ELSE' },
      { readinessEnabled: () => false, send },
    );
    expect(result).toMatchObject({ mode: 'authority_hold', deliveryHeld: true });
    expect(send).not.toHaveBeenCalled();
  });

  it('fully bound package-backed snapshot (authority=cache=contract=stamp=payload) → ships exactly once', async () => {
    const prisma = dbWithFreshRow(boundFreshRow(packageAuthority(REV_B), CONTRACT_B));
    const send = vi.fn(async () => ({}));
    const result = await finalizePackageDelivery(
      prisma as never,
      { order, ...PAYLOAD_ARGS },
      { readinessEnabled: () => false, send },
    );
    expect(result).toMatchObject({ mode: 'legacy', deliveryHeld: false });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('readiness ON delegates the same predicate to the readiness commit (no pre-park, evidence-rich path)', async () => {
    const prisma = db();
    const send = vi.fn();
    const commit = vi.fn(async () => ({
      manifestStatus: 'blocked' as const,
      enqueued: false,
      orderStatus: 'needs_human_qa',
      reason: 'contract_world_hold:visual_package_authority_invalid',
      revision: 1,
    }));
    const result = await finalizePackageDelivery(
      prisma as never,
      { order: { ...staleValidArgsOrder, visualPackageAuthority: null }, deliveryGate: allowGate, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
      { readinessEnabled: () => true, commit: commit as never, send },
    );
    expect(result).toMatchObject({ mode: 'manifest', deliveryHeld: true });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });
});

describe('resolveSafetyDeliveryGate (Fix 1) — the readiness-independent gate from the persisted per-asset signal', () => {
  const mkPrisma = (book: unknown) => ({ generatedBook: { findUnique: vi.fn(async () => book) } });

  it('all verified + no hazards → NOT held', async () => {
    const p = mkPrisma({ coverImageUrl: 'c', coverSafetyVerified: true, coverSafetyHazards: [], pages: [{ pageNumber: 1, imageAsset: { safetyVerified: true, safetyHazards: [] } }] });
    expect(await resolveSafetyDeliveryGate(p as never, 'o1')).toEqual({ held: false, reason: null });
  });

  // (release shape C) A normally-rendered hazard carries its co-written content SHA → an ORDINARY (releasable) hazard.
  const SHA = 'a'.repeat(64);

  it('a confirmed page hazard WITH a content SHA → held with safety_hold:hazard (releasable)', async () => {
    const p = mkPrisma({ coverImageUrl: 'c', coverSafetyVerified: true, coverSafetyHazards: [], pages: [{ pageNumber: 5, imageAsset: { safetyVerified: true, safetyHazards: ['child_on_railing'], safetyContentSha256: SHA, safetyOverriddenHazards: [], safetyOverrideSha256: null } }] });
    const g = await resolveSafetyDeliveryGate(p as never, 'o1');
    expect(g.held).toBe(true);
    expect(g.reason).toContain('safety_hold:hazard:page:5:child_on_railing');
    expect(g.reason).not.toContain('sha_missing');
  });

  it('(shape C) a hazard whose phase-2 SHA never landed (null content SHA) → held + surfaced as sha_missing, NOT releasable', async () => {
    const p = mkPrisma({ coverImageUrl: 'c', coverSafetyVerified: true, coverSafetyHazards: [], pages: [{ pageNumber: 5, imageAsset: { safetyVerified: true, safetyHazards: ['child_on_railing'], safetyContentSha256: null, safetyOverriddenHazards: [], safetyOverrideSha256: null } }] });
    const g = await resolveSafetyDeliveryGate(p as never, 'o1');
    expect(g.held).toBe(true);
    // legibly distinct from an ordinary hazard hold — the marker prefix stays safety_hold: (terminal-hold/rank/kind intact)
    expect(g.reason).toBe('safety_hold:hazard:page:5:sha_missing');
  });

  it('(shape C) a cover hazard with a null content SHA → cover:sha_missing', async () => {
    const p = mkPrisma({ coverImageUrl: 'c', coverSafetyVerified: true, coverSafetyHazards: ['unsafe_cover'], coverSafetyContentSha256: null, coverSafetyOverriddenHazards: [], coverSafetyOverrideSha256: null, pages: [] });
    const g = await resolveSafetyDeliveryGate(p as never, 'o1');
    expect(g.reason).toBe('safety_hold:hazard:cover:sha_missing');
  });

  it('an UNVERIFIED page (fail-closed) → held with safety_hold:unverified', async () => {
    const p = mkPrisma({ coverImageUrl: 'c', coverSafetyVerified: true, coverSafetyHazards: [], pages: [{ pageNumber: 3, imageAsset: { safetyVerified: false, safetyHazards: [] } }] });
    const g = await resolveSafetyDeliveryGate(p as never, 'o1');
    expect(g.held).toBe(true);
    expect(g.reason).toContain('safety_hold:unverified:page:3');
  });

  it('an unverified COVER → held (the cover is checked too)', async () => {
    const p = mkPrisma({ coverImageUrl: 'c', coverSafetyVerified: false, coverSafetyHazards: [], pages: [] });
    expect((await resolveSafetyDeliveryGate(p as never, 'o1')).held).toBe(true);
  });

  it('a hazard is reported OVER a merely-unverified artifact', async () => {
    const p = mkPrisma({ coverImageUrl: 'c', coverSafetyVerified: false, coverSafetyHazards: [], pages: [{ pageNumber: 2, imageAsset: { safetyVerified: true, safetyHazards: ['unsafe_pose'] } }] });
    const g = await resolveSafetyDeliveryGate(p as never, 'o1');
    expect(g.reason).toContain('hazard:');
    expect(g.reason).not.toContain('unverified:');
  });
});
