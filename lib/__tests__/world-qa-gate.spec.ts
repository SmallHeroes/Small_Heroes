import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  persistDeliveredQualityEvidence,
  type QaContext,
} from '@/lib/generation-pipeline/quality-evidence-producer';
import {
  evaluateQualityGate,
  QUALITY_EVALUATOR_CONTRACT_VERSION,
  type QualityEvidenceRow,
} from '@/lib/generation-pipeline/quality-evidence';
import { resolveReadinessDeliveryPlan } from '@/lib/generation-pipeline/readiness-manifest';
import { contractPageWorldExpectation, type BookVisualContract } from '@/lib/visual-contract-compiler';
import type { AssetInspection } from '@/lib/generation-pipeline/asset-integrity';

/**
 * Slice A — wire the (built-but-unwired) page-world-qa into the durable verdict so a contract-world drift
 * (wrong_zone / recurring-object identity redesign / forbidden_scene) HOLDS a book (needs_human_qa) instead of
 * shipping. No contract-hash change, no render — all injected fakes.
 */

const okInspect = (sha: string | null): AssetInspection => ({
  ok: sha != null, bytes: sha ? 2048 : 0, format: sha ? 'webp' : null, mime: sha ? 'image/webp' : null,
  width: sha ? 800 : null, height: sha ? 1200 : null, sha256: sha, error: sha ? undefined : 'not_decodable',
});

const QA_CTX: QaContext = {
  expectsChild: true, expectsCompanion: false, expectedPageTimeOfDay: null,
  isEmotionalClosing: false, hasStructuredObjects: false, hasRailedBedOrCrib: false, hasHumanFamily: false,
};
const WORLD = {
  zoneDescription: 'the exam room: tall exam chair, sink, poster wall',
  objects: [{ label: 'Examination chair', identity: 'the tall exam chair' }],
  forbiddenScenes: [] as string[],
};
const CTX_WITH_WORLD: QaContext = { ...QA_CTX, worldExpectation: WORLD };

const visualPass = () => ({ passed: true, verdict: 'passed', reason: 'ok', details: '', flags: {} } as never);
const visualFailAnatomy = () => ({ passed: false, verdict: 'failed', reason: 'anatomy_failed', details: '', flags: {} } as never);
const worldFail = () => ({ status: 'fail', passed: false, hardFailures: ['wrong_zone'], driftObjects: ['Examination chair'], notes: '' } as never);
const worldPass = () => ({ status: 'pass', passed: true, hardFailures: [], driftObjects: [], notes: '' } as never);
const worldError = () => ({ status: 'error', passed: false, hardFailures: [], driftObjects: [], notes: 'no key' } as never);

type UpsertArg = { create: Record<string, unknown>; update: Record<string, unknown> };
function makeDb() {
  return {
    order: { findUnique: vi.fn(async () => ({ visualContractHash: null })) },
    qualityEvidence: { upsert: vi.fn(async (_a: UpsertArg) => ({})) },
  };
}
const created = (db: ReturnType<typeof makeDb>) =>
  (db.qualityEvidence.upsert.mock.calls[0]?.[0] as UpsertArg).create;

let prev: string | undefined;
beforeEach(() => {
  prev = process.env.READINESS_MANIFEST_ENABLED;
  process.env.READINESS_MANIFEST_ENABLED = 'true';
});
afterEach(() => {
  if (prev === undefined) delete process.env.READINESS_MANIFEST_ENABLED;
  else process.env.READINESS_MANIFEST_ENABLED = prev;
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// contractPageWorldExpectation adapter (pure)
// ─────────────────────────────────────────────────────────────────────────────
describe('contractPageWorldExpectation — project the page world expectation from the frozen contract', () => {
  const contract = {
    pageContracts: [
      { pageNumber: 5, locationId: 'clinic', zoneId: 'clinic.exam_room' },
      { pageNumber: 6, locationId: 'void' },
    ],
    locations: [
      { id: 'clinic', name: 'Clinic', description: 'a paediatric clinic' },
      { id: 'void', name: '', description: '' },
    ],
    zones: [{ id: 'clinic.exam_room', locationId: 'clinic', name: 'Exam room', description: 'the exam room: exam chair, sink' }],
    recurringProps: [{ id: 'exam_chair', name: 'Examination chair', description: 'the tall exam chair' }],
    forbiddenGlobalElements: ['an outdoor forest', 'night'],
  } as unknown as BookVisualContract;

  it('uses the zone description as the setting + ALL recurring props as identity-locked objects + forbidden elements', () => {
    expect(contractPageWorldExpectation(contract, 5)).toEqual({
      zoneDescription: 'the exam room: exam chair, sink',
      objects: [{ label: 'Examination chair', identity: 'the tall exam chair' }],
      forbiddenScenes: ['an outdoor forest', 'night'],
    });
  });

  it('page not in the contract → null (no world QA, neutral)', () => {
    expect(contractPageWorldExpectation(contract, 99)).toBeNull();
  });

  it('page with no describable setting (no zone, empty location description) → null (never a fabricated setting)', () => {
    expect(contractPageWorldExpectation(contract, 6)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// producer: world overlay folds into the durable delivered verdict
// ─────────────────────────────────────────────────────────────────────────────
describe('persistDeliveredQualityEvidence — world overlay on the delivered bytes', () => {
  async function run(args: Parameters<typeof persistDeliveredQualityEvidence>[1], deps: { evaluate: unknown; evaluateWorld: unknown }) {
    const db = makeDb();
    await persistDeliveredQualityEvidence(db as never, args, {
      evaluate: deps.evaluate as never,
      evaluateWorld: deps.evaluateWorld as never,
      inspect: async () => okInspect('sha'),
    });
    return db;
  }
  const baseArgs = (over: Record<string, unknown>) => ({
    orderId: 'o1', artifactKey: 'page:5', deliveredUrl: 'https://h/p5.webp',
    presentationApplied: true, rawVerdict: 'passed', qaContext: CTX_WITH_WORLD, contractHash: null, ...over,
  }) as Parameters<typeof persistDeliveredQualityEvidence>[1];

  it('visual PASS + world FAIL → durable verdict FAILED, reason tagged contract_world (+ the drifted object)', async () => {
    const evaluateWorld = vi.fn(worldFail);
    const db = await run(baseArgs({}), { evaluate: vi.fn(visualPass), evaluateWorld });
    expect(evaluateWorld).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: 'https://h/p5.webp', zoneDescription: WORLD.zoneDescription }));
    const c = created(db);
    expect(c.verdict).toBe('failed');
    expect(c.reason).toContain('contract_world:wrong_zone');
    expect(c.reason).toContain('objects=Examination chair');
  });

  it('visual PASS + world PASS → verdict PASSED (world overlay is a no-op on a clean page)', async () => {
    const db = await run(baseArgs({}), { evaluate: vi.fn(visualPass), evaluateWorld: vi.fn(worldPass) });
    expect(created(db).verdict).toBe('passed');
  });

  it('visual PASS + world ERROR → evidence_unknown (fail-closed: an unverified world is never a silent PASS)', async () => {
    const db = await run(baseArgs({}), { evaluate: vi.fn(visualPass), evaluateWorld: vi.fn(worldError) });
    const c = created(db);
    expect(c.verdict).toBe('evidence_unknown');
    expect(c.reason).toContain('contract_world_unverified');
  });

  it('NO transform (rawVerdict reused) + world FAIL → still FAILED — a transform-less page cannot escape the world gate', async () => {
    const evaluate = vi.fn(); // visual re-QA must NOT run when bytes are unchanged
    const db = await run(baseArgs({ presentationApplied: false, rawVerdict: 'passed' }), { evaluate, evaluateWorld: vi.fn(worldFail) });
    expect(evaluate).not.toHaveBeenCalled();
    expect(created(db).verdict).toBe('failed');
  });

  it('visual FAIL + world FAIL → FAILED carrying BOTH reasons', async () => {
    const db = await run(baseArgs({}), { evaluate: vi.fn(visualFailAnatomy), evaluateWorld: vi.fn(worldFail) });
    const c = created(db);
    expect(c.verdict).toBe('failed');
    expect(c.reason).toContain('anatomy_failed');
    expect(c.reason).toContain('contract_world:');
  });

  it('NO worldExpectation (steering off) → world QA never runs; verdict is the base (byte-identical parity)', async () => {
    const evaluateWorld = vi.fn();
    const db = await run(baseArgs({ presentationApplied: false, rawVerdict: 'passed', qaContext: QA_CTX }), { evaluate: vi.fn(), evaluateWorld });
    expect(evaluateWorld).not.toHaveBeenCalled();
    expect(created(db).verdict).toBe('passed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// gate: contractHardHold is set by a deterministic contract-world fail
// ─────────────────────────────────────────────────────────────────────────────
describe('evaluateQualityGate — contractHardHold', () => {
  const row = (over: Partial<QualityEvidenceRow>): QualityEvidenceRow => ({
    artifactKey: 'page:5', assetSha256: 'sha5', verdict: 'failed',
    evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION, reason: 'contract_world:wrong_zone',
    regenCount: 2, contractHash: null, ...over,
  });
  const hashes = new Map([['page:5', 'sha5']]);

  it('a budget-exhausted contract-world FAIL → status failed + contractHardHold true', () => {
    const res = evaluateQualityGate(['page:5'], [row({})], hashes);
    expect(res.status).toBe('failed');
    expect(res.contractHardHold).toBe(true);
  });

  it('contract-world FAIL with budget remaining → recoverable (evidence_unknown) but STILL hard-hold', () => {
    const res = evaluateQualityGate(['page:5'], [row({ regenCount: 0 })], hashes);
    expect(res.status).toBe('evidence_unknown');
    expect(res.contractHardHold).toBe(true);
  });

  it('an ordinary visual FAIL (anatomy) → contractHardHold false (soft-deliver policy unchanged)', () => {
    const res = evaluateQualityGate(['page:5'], [row({ reason: 'anatomy_failed' })], hashes);
    expect(res.contractHardHold).toBe(false);
  });

  it('an UNVERIFIED world (evidence_unknown verdict) is recoverable, NOT a hard-hold', () => {
    const res = evaluateQualityGate(['page:5'], [row({ verdict: 'evidence_unknown', reason: 'contract_world_unverified' })], hashes);
    expect(res.contractHardHold).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// readiness: a contract-world hard-hold can never be QA_SOFT_DELIVER-downgraded
// ─────────────────────────────────────────────────────────────────────────────
describe('resolveReadinessDeliveryPlan — soft-deliver exemption for contract-world hard-holds', () => {
  const args = {} as never; // the blocked paths under test never read args

  it('blocked + contractHardHold → PARKED (no exception case, no soft-deliver) → needs_human_qa', () => {
    const plan = resolveReadinessDeliveryPlan(args, { status: 'blocked', reason: 'quality_failed:page:5', contractHardHold: true }, true);
    expect(plan.usesSoftDeliver).toBe(false);
    expect(plan.orderStatus).toBe('needs_human_qa');
    expect(plan.enqueued).toBe(false);
    // The parked disposition: skipExceptionCase (no case → no redrive/refund) + the contract_world_hold marker.
    expect(plan.skipExceptionCase).toBe(true);
    expect(plan.deliveryHoldReason).toMatch(/^contract_world_hold:/);
  });

  it('blocked + soft-deliver ON + NO hard-hold → soft-delivered as before (ready + qaWarnings)', () => {
    const plan = resolveReadinessDeliveryPlan(args, { status: 'blocked', reason: 'quality_failed:page:5', contractHardHold: false }, true);
    expect(plan.usesSoftDeliver).toBe(true);
    expect(plan.orderStatus).toBe('ready');
  });
});
