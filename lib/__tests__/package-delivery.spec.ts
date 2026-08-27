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
      { order, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
      { readinessEnabled: () => true, commit: commit as never, send },
    );

    expect(result).toMatchObject({ mode: 'manifest', deliveryHeld: false });
    // (Codex round-5) The commit receives ONLY the identity leg — no caller-supplied disposition:
    // the commit derives the anchor gate from its own fresh producing snapshot.
    expect(commit).toHaveBeenCalledWith(prisma, {
      orderId: 'o1',
      callerPackageRevisionDigest: null,
    });
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(prisma.generationJob.update).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('flag-on preserves an anchor hold through the readiness commit and still never direct-sends', async () => {
    const prisma = db();
    const send = vi.fn();
    // (Codex round-5) The anchor hold now originates INSIDE the commit (derived from the fresh
    // producing snapshot); the caller supplies no gate. The commit result carries the hold.
    const commit = vi.fn(async () => ({
      manifestStatus: 'passed' as const,
      enqueued: false,
      orderStatus: 'needs_human_qa',
      reason: 'anchor_low_confidence:soft_band',
      revision: 3,
    }));
    const result = await finalizePackageDelivery(
      prisma as never,
      { order, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
      { readinessEnabled: () => true, commit: commit as never, send },
    );
    expect(result).toMatchObject({ mode: 'manifest', deliveryHeld: true });
    expect(commit).toHaveBeenCalledWith(prisma, expect.objectContaining({
      orderId: 'o1',
      callerPackageRevisionDigest: null,
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
      { order, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
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

  it('flag-off held path derives the anchor hold from the FRESH producing snapshot and sends no email', async () => {
    const prisma = db();
    // (Codex round-5) The hold source is the fresh row's producing snapshot, never a caller gate.
    prisma.order.findUnique = vi.fn(async () => ({
      childName: 'Test', inputVersion: 0, visualContractHash: null, deliveryFenceVersion: 0,
      generationJob: { pipelineCache: { childAnchorLowConfidence: { reason: 'hard_band', score: 0.42 } } },
    }));
    const send = vi.fn();
    const result = await finalizePackageDelivery(
      prisma as never,
      { order, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
      { readinessEnabled: () => false, send },
    );
    expect(result).toMatchObject({ mode: 'legacy', deliveryHeld: true });
    // (delivery fence round-5) the legacy park is now writeOrderHoldFenced ($executeRaw + precedence), not order.update.
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});

describe('finalizePackageDelivery — legacy ship CAS=0 re-evaluation (Codex round-6)', () => {
  const clearRow = () => ({
    childName: 'Test', inputVersion: 0, visualContractHash: null, deliveryFenceVersion: 0,
    selectionFilename: 'story-bank/v3-approved/bunny_ometz_bedtime.md',
    storySourceHash: 'f'.repeat(64),
    illustrationStyle: 'pencil_watercolor',
    visualPackageAuthority: null,
    generationJob: { pipelineCache: {} },
  });
  const hardBandRow = () => ({
    ...clearRow(),
    generationJob: { pipelineCache: { childAnchorLowConfidence: { reason: 'hard_band', score: 0.29 } } },
  });
  const CALL_ARGS = {
    safetyGate: { held: false, reason: null },
    readUrl: 'https://app/ready?orderId=o1',
    pdfUrl: null,
    firstAudioUrl: null,
  } as const;

  it('HOSTILE (round-6): band flips to hard_band between disposition read and ship CAS → fresh re-evaluation lands the CORRECT durable anchor hold; zero email, job done only after the hold', async () => {
    const prisma = db();
    // Iteration 1 reads a CLEAR producing snapshot; the flip lands before its ship CAS → CAS=0.
    // Iteration 2 re-reads FRESH, sees hard_band, and parks durably.
    prisma.order.findUnique = vi.fn()
      .mockResolvedValueOnce(clearRow())
      .mockResolvedValue(hardBandRow());
    const executeRawValues: unknown[][] = [];
    prisma.$executeRaw = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      executeRawValues.push(values);
      // Call 1 = iteration 1's ship CAS → 0 rows (the band flipped under it). Later raw writes
      // (iteration 2's fenced hold) apply.
      return executeRawValues.length === 1 ? 0 : 1;
    }) as never;
    const send = vi.fn();
    const result = await finalizePackageDelivery(
      prisma as never,
      { order, ...CALL_ARGS },
      { readinessEnabled: () => false, send },
    );
    // Exactly one durable outcome: the CORRECT fresh anchor hold.
    expect(result).toMatchObject({ mode: 'legacy', deliveryHeld: true, manifest: null });
    expect(
      executeRawValues.flat().includes('anchor_low_confidence:hard_band'),
      `expected the fresh-derived anchor marker among raw params: ${JSON.stringify(executeRawValues)}`,
    ).toBe(true);
    expect(send).not.toHaveBeenCalled();
    // Two fresh evaluations ran (the wedge would have stopped at one)…
    expect(prisma.order.findUnique.mock.calls.length).toBeGreaterThanOrEqual(2);
    // …and the job concluded exactly once, only after the durable hold existed.
    expect(prisma.generationJob.update).toHaveBeenCalledTimes(1);
    expect(prisma.generationJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'done', packaged: true }) }),
    );
  });

  it('re-evaluation budget exhausted (world keeps moving) → RETRYABLE AuthorityHoldRaceError; job NEVER done/packaged; zero email; no held claim', async () => {
    const prisma = db();
    prisma.order.findUnique = vi.fn(async () => clearRow()); // always derives a clear ship…
    prisma.$executeRaw = vi.fn(async () => 0); // …and every ship CAS loses.
    const send = vi.fn();
    await expect(
      finalizePackageDelivery(
        prisma as never,
        { order, ...CALL_ARGS },
        { readinessEnabled: () => false, send },
      ),
    ).rejects.toMatchObject({ name: 'AuthorityHoldRaceError', holdMarker: 'legacy_ship_reevaluation_exhausted' });
    expect(prisma.generationJob.update).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(prisma.order.findUnique).toHaveBeenCalledTimes(3); // the full bounded budget re-evaluated fresh
  });

  it('order vanished mid-package → RETRYABLE abort, never a silent job-done fall-through', async () => {
    const prisma = db();
    prisma.order.findUnique = vi.fn(async () => null) as never;
    const send = vi.fn();
    await expect(
      finalizePackageDelivery(
        prisma as never,
        { order, ...CALL_ARGS },
        { readinessEnabled: () => false, send },
      ),
    ).rejects.toMatchObject({ name: 'AuthorityHoldRaceError', holdMarker: 'order_vanished_before_package_write' });
    expect(prisma.generationJob.update).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('positive control: the same-source clear evaluation still ships exactly once (one CAS, one email, job done)', async () => {
    const prisma = db();
    prisma.order.findUnique = vi.fn(async () => clearRow());
    const send = vi.fn(async () => ({}));
    const result = await finalizePackageDelivery(
      prisma as never,
      { order, ...CALL_ARGS },
      { readinessEnabled: () => false, send },
    );
    expect(result).toMatchObject({ mode: 'legacy', deliveryHeld: false });
    expect(send).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1); // exactly one ship CAS, no retries
    expect(prisma.generationJob.update).toHaveBeenCalledTimes(1);
  });
});

describe('finalizePackageDelivery — durable non-anchor dispositions are RECOGNIZED, never spun against (Codex round-7)', () => {
  const CALL_ARGS = {
    safetyGate: { held: false, reason: null },
    readUrl: 'https://app/ready?orderId=o1',
    pdfUrl: null,
    firstAudioUrl: null,
  } as const;
  const rowWith = (over: Record<string, unknown>) => ({
    childName: 'Test', inputVersion: 0, visualContractHash: null, deliveryFenceVersion: 0,
    status: 'generating', deliveryHoldReason: null, manualReviewRequired: false,
    selectionFilename: 'story-bank/v3-approved/bunny_ometz_bedtime.md',
    storySourceHash: 'f'.repeat(64),
    illustrationStyle: 'pencil_watercolor',
    visualPackageAuthority: null,
    generationJob: { pipelineCache: {} }, // clear anchor — the CAS rejection is NOT anchor-caused
    ...over,
  });

  it.each([
    ['concurrent safety_hold', { status: 'needs_human_qa', deliveryHoldReason: 'safety_hold:hazard_detected' }, 'safety_hold:hazard_detected'],
    ['concurrent contract_world_hold', { status: 'needs_human_qa', deliveryHoldReason: 'contract_world_hold:world_drift' }, 'contract_world_hold:world_drift'],
    ['payment/manual-review fence', { manualReviewRequired: true }, 'payment_fence:manual_review_required'],
  ])('%s + clear anchor → RECOGNIZED durable disposition: zero ship CAS, zero marker rewrite, job done once, zero email, held', async (_label, freshOver, _expectedDisposition) => {
    const prisma = db();
    prisma.order.findUnique = vi.fn(async () => rowWith(freshOver)) as never;
    const send = vi.fn();
    const result = await finalizePackageDelivery(
      prisma as never,
      { order, ...CALL_ARGS },
      { readinessEnabled: () => false, send },
    );
    // Codex's round-7 probe produced: 3 fresh reads, 3 CAS=0, retryable abort, 0 job done.
    // Now: the FIRST fresh evaluation classifies the governing durable disposition and concludes.
    expect(result).toMatchObject({ mode: 'legacy', deliveryHeld: true, manifest: null });
    expect(prisma.$executeRaw).not.toHaveBeenCalled(); // no ship CAS spin, and the marker/fence is NEVER rewritten
    // One loop read classifies; the second read is the best-effort post-commit case sync, not a re-evaluation.
    expect(prisma.order.findUnique.mock.calls.length).toBeLessThanOrEqual(2);
    expect(prisma.generationJob.update).toHaveBeenCalledTimes(1); // the stage concludes under the existing disposition
    expect(send).not.toHaveBeenCalled();
  });

  it('skip_weaker: clear marker + clear anchor but an ACTIVE strong safety case → one CAS=0, then RECOGNIZED case disposition (no spin, no exhaustion abort)', async () => {
    const prisma = db();
    prisma.order.findUnique = vi.fn(async () => rowWith({})) as never;
    prisma.$executeRaw = vi.fn(async () => 0) as never; // the CAS's NOT EXISTS rejects the ship
    prisma.humanQaReviewCase.findUnique = vi.fn(async ({ where }: { where: { activeKey: string } }) =>
      where.activeKey === 'o1:base_book' ? { kind: 'safety', status: 'open' } : null,
    ) as never;
    const send = vi.fn();
    const result = await finalizePackageDelivery(
      prisma as never,
      { order, ...CALL_ARGS },
      { readinessEnabled: () => false, send },
    );
    expect(result).toMatchObject({ mode: 'legacy', deliveryHeld: true });
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1); // exactly one CAS attempt — never a 3x spin
    expect(prisma.humanQaReviewCase.findUnique).toHaveBeenCalled(); // the case classification ran
    expect(prisma.generationJob.update).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });

  it('an OPEN but WEAK (anchor) case does NOT classify as durable — unexplained CAS=0 still exhausts retryably', async () => {
    const prisma = db();
    prisma.order.findUnique = vi.fn(async () => rowWith({})) as never;
    prisma.$executeRaw = vi.fn(async () => 0) as never;
    prisma.humanQaReviewCase.findUnique = vi.fn(async ({ where }: { where: { activeKey: string } }) =>
      where.activeKey === 'o1:base_book' ? { kind: 'anchor', status: 'open' } : null,
    ) as never;
    const send = vi.fn();
    await expect(
      finalizePackageDelivery(
        prisma as never,
        { order, ...CALL_ARGS },
        { readinessEnabled: () => false, send },
      ),
    ).rejects.toMatchObject({ name: 'AuthorityHoldRaceError', holdMarker: 'legacy_ship_reevaluation_exhausted' });
    expect(prisma.generationJob.update).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});

describe('finalizePackageDelivery — hold-write result discipline (Codex round-5 finding 3)', () => {
  // A fresh row that fails the producing binding (A→legacy laundering) — the park path that binds
  // the observed inputVersion, so the fenced hold write can genuinely drift.
  const launderedFreshRow = () => ({
    childName: 'Test', inputVersion: 0, visualContractHash: null, deliveryFenceVersion: 0,
    selectionFilename: 'story-bank/v3-approved/bunny_ometz_bedtime.md',
    storySourceHash: 'f'.repeat(64),
    illustrationStyle: 'pencil_watercolor',
    visualPackageAuthority: null,
    generationJob: { pipelineCache: { visualPackageAuthority: { version: 'produced-under-a-package' } } },
  });

  it('input_drift on the authority park → AuthorityHoldRaceError, job NEVER marked done/packaged, no applied-hold report', async () => {
    const prisma = db();
    // The fenced hold read sees a DRIFTED inputVersion (5 ≠ the observed 0) → writeOrderHoldFenced
    // returns input_drift → the park tx must abort; the job-done write must never land.
    prisma.$queryRaw = vi.fn(async () => [{ id: 'hqc-test', fence: 0, rank: 1, status: 'generating', inputVersion: 5 }]);
    prisma.order.findUnique = vi.fn(async () => launderedFreshRow());
    const send = vi.fn();
    await expect(
      finalizePackageDelivery(
        prisma as never,
        { order, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
        { readinessEnabled: () => false, send },
      ),
    ).rejects.toMatchObject({ name: 'AuthorityHoldRaceError', holdResult: 'input_drift' });
    expect(prisma.generationJob.update).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('superseded (a STRONGER marker already governs) → held result stands, job done, recovery cases left to the stronger owner', async () => {
    const prisma = db();
    // The fenced hold read sees a rank-3 (safety) marker → writeOrderHoldFenced returns superseded:
    // the stronger terminal marker IS the durable disposition — the package stage completes, but
    // this park never touches the recovery-case lifecycle the stronger owner manages.
    prisma.$queryRaw = vi.fn(async () => [{ id: 'hqc-test', fence: 0, rank: 3, status: 'needs_human_qa', inputVersion: 0 }]);
    prisma.order.findUnique = vi.fn(async () => launderedFreshRow());
    const send = vi.fn();
    const result = await finalizePackageDelivery(
      prisma as never,
      { order, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
      { readinessEnabled: () => false, send },
    );
    expect(result).toMatchObject({ mode: 'authority_hold', deliveryHeld: true });
    expect(prisma.generationJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'done', packaged: true }) }),
    );
    expect(prisma.exceptionCase.updateMany).not.toHaveBeenCalled();
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
      { order, safetyGate: heldSafety, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
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
      { order, safetyGate: heldSafety, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
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
      { order: staleValidArgsOrder, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
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
      { order: staleValidArgsOrder, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
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
      { order, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
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
      { order, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
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
      { order, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
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
      { order, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
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
      { order, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
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
    safetyGate: { held: false, reason: null },
    readUrl: 'https://app/ready?orderId=o1',
    pdfUrl: null,
    firstAudioUrl: null,
  };
  /** (Codex round-5) A caller snapshot carrying the EXACT identity of `auth` — the identity leg
   *  requires caller ≡ fresh producing identity, so package-backed positives need a matching caller. */
  const packageCaller = (auth: Record<string, unknown>) =>
    ({
      ...order,
      selectionFilename: ACCEPTED_SELECTION,
      storySourceHash: 'b'.repeat(64),
      visualPackageAuthority: auth,
    }) as unknown as typeof staleValidArgsOrder;

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
      { order: packageCaller(packageAuthority(REV_B)), ...PAYLOAD_ARGS, readUrl: 'https://app/ready?orderId=SOMEONE-ELSE' },
      { readinessEnabled: () => false, send },
    );
    expect(result).toMatchObject({ mode: 'authority_hold', deliveryHeld: true });
    expect(send).not.toHaveBeenCalled();
  });

  it('fully bound package-backed snapshot (authority=cache=contract=stamp=payload, caller identity matching) → ships exactly once', async () => {
    const prisma = dbWithFreshRow(boundFreshRow(packageAuthority(REV_B), CONTRACT_B));
    const send = vi.fn(async () => ({}));
    const result = await finalizePackageDelivery(
      prisma as never,
      { order: packageCaller(packageAuthority(REV_B)), ...PAYLOAD_ARGS },
      { readinessEnabled: () => false, send },
    );
    expect(result).toMatchObject({ mode: 'legacy', deliveryHeld: false });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('(Codex round-5 finding 1) caller Package A over a fully-bound self-consistent fresh Package B → hold (exact identity equality)', async () => {
    const prisma = dbWithFreshRow(boundFreshRow(packageAuthority(REV_B), CONTRACT_B));
    const send = vi.fn();
    const result = await finalizePackageDelivery(
      prisma as never,
      { order: packageCaller(packageAuthority(REV_A)), ...PAYLOAD_ARGS },
      { readinessEnabled: () => false, send },
    );
    expect(result).toMatchObject({ mode: 'authority_hold', deliveryHeld: true });
    expect(send).not.toHaveBeenCalled();
  });

  it('(Codex round-5 finding 1) HOSTILE CELL: caller A / fresh B / producing B, fresh producing snapshot holds hard_band while the stale caller believed allow → hold, zero ship, zero email', async () => {
    const row = boundFreshRow(packageAuthority(REV_B), CONTRACT_B);
    const prisma = dbWithFreshRow({
      ...row,
      generationJob: {
        pipelineCache: {
          ...(row.generationJob as { pipelineCache: Record<string, unknown> }).pipelineCache,
          childAnchorLowConfidence: { reason: 'hard_band', score: 0.31 },
        },
      },
    });
    const send = vi.fn();
    const result = await finalizePackageDelivery(
      prisma as never,
      { order: packageCaller(packageAuthority(REV_A)), ...PAYLOAD_ARGS },
      { readinessEnabled: () => false, send },
    );
    // The identity mismatch parks (contract_world) BEFORE any disposition; nothing ships, no email.
    expect(result).toMatchObject({ mode: 'authority_hold', deliveryHeld: true });
    expect(send).not.toHaveBeenCalled();
  });

  it('(Codex round-5 finding 1) identity-consistent A/A/A whose FRESH producing snapshot holds hard_band → anchor hold, zero ship, zero email (the stale caller cannot say allow)', async () => {
    const row = boundFreshRow(packageAuthority(REV_B), CONTRACT_B);
    const prisma = dbWithFreshRow({
      ...row,
      generationJob: {
        pipelineCache: {
          ...(row.generationJob as { pipelineCache: Record<string, unknown> }).pipelineCache,
          childAnchorLowConfidence: { reason: 'hard_band', score: 0.31 },
        },
      },
    });
    const send = vi.fn();
    const result = await finalizePackageDelivery(
      prisma as never,
      { order: packageCaller(packageAuthority(REV_B)), ...PAYLOAD_ARGS },
      { readinessEnabled: () => false, send },
    );
    // Identity binds; the DERIVED disposition holds → the legacy park path, never the ship CAS.
    expect(result).toMatchObject({ mode: 'legacy', deliveryHeld: true });
    expect(send).not.toHaveBeenCalled();
  });

  it('readiness ON delegates a VALID caller identity to the readiness commit (evidence-rich path)', async () => {
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
      { order: staleValidArgsOrder, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
      { readinessEnabled: () => true, commit: commit as never, send },
    );
    expect(result).toMatchObject({ mode: 'manifest', deliveryHeld: true });
    // (Codex round-5) The commit receives the caller's EXACT package identity.
    expect(commit).toHaveBeenCalledWith(prisma, {
      orderId: 'o1',
      callerPackageRevisionDigest: staleValidAuthority.packageRevisionDigest,
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('(Codex round-5) readiness ON: an INVALID caller snapshot (accepted selection without authority) parks BEFORE the commit — zero commit calls', async () => {
    const prisma = db();
    const send = vi.fn();
    const commit = vi.fn();
    const result = await finalizePackageDelivery(
      prisma as never,
      { order: { ...staleValidArgsOrder, visualPackageAuthority: null }, safetyGate: { held: false, reason: null }, readUrl: 'https://app/ready?orderId=o1', pdfUrl: null, firstAudioUrl: null },
      { readinessEnabled: () => true, commit: commit as never, send },
    );
    expect(result).toMatchObject({ mode: 'authority_hold', deliveryHeld: true });
    expect(commit).not.toHaveBeenCalled();
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
