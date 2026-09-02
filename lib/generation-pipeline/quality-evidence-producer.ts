/**
 * #7-a 5a — the Quality-evidence PRODUCER seam. After the delivered bytes of an artifact are finalized
 * (post presentation transform for pages; the raw url for the cover), attach a durable Vision verdict for
 * THOSE exact bytes and persist a QualityEvidence row.
 *
 * Carry-ins honored:
 *  #1 SEMANTIC BYTE BINDING — the verdict must be for the DELIVERED bytes (presentationUrl ?? url). When a
 *     presentation transform changed the bytes (color-normalization / warm bias / WebP re-encode), we re-run
 *     Vision on the delivered image; a raw verdict is NEVER attached to a presentation hash.
 *  #2 the cover verdict is GENUINE (the cover's own QA verdict, or a re-QA) — never a synthesized PASS.
 *  #3 assetSha256 = inspectAsset(deliveredUrl).sha256 (the exact delivered bytes) so it equals what the
 *     readiness gate re-computes.
 *  #4 the persist does NOT set regenCount — the DB-reserved value (5b) is the source of truth and is preserved.
 *
 * Flag-gated by READINESS_MANIFEST_ENABLED (flag OFF → no-op; the legacy render path is unchanged).
 */
import type { PrismaClient, Prisma } from '@prisma/client';
import { canonicalHash } from '@/lib/canonical-json';
import { inspectAsset, type AssetInspection } from './asset-integrity';
import { evaluatePageVisualQa, type PageVisualQaResult } from './page-visual-qa';
import { evaluatePageWorldQa, type PageWorldQaResult } from './page-world-qa';
import {
  persistQualityEvidence,
  QUALITY_EVALUATOR_CONTRACT_VERSION,
  type QualityVerdict,
} from './quality-evidence';
import { SAFETY_SHA256_RE } from './asset-safety-signal';
import {
  isReadinessManifestEnabled,
  withDeliveryInputMutation,
} from './readiness-manifest';
import type { ReceiptSafeValue } from './atomic-operation';
import {
  evaluateStoredPageChildResemblanceVision,
  PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD,
  PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
} from './page-child-resemblance-vision';

type Db = PrismaClient | Prisma.TransactionClient;

function isRootPrismaClient(db: Db): db is PrismaClient {
  return '$transaction' in db && typeof db.$transaction === 'function';
}

export interface QaContext {
  expectsChild: boolean;
  expectsCompanion: boolean;
  expectedPageTimeOfDay: import('@/lib/story-time-of-day').StoryTimeOfDay | null;
  isEmotionalClosing: boolean;
  hasStructuredObjects: boolean;
  hasRailedBedOrCrib: boolean;
  hasHumanFamily: boolean;
  /**
   * (Slice A) The frozen WORLD expectation for this page — its setting + recurring-object identities + forbidden
   * scenes — present ONLY under contract steering (chunk-runner attaches it from the frozen contract). When set,
   * the delivered-verdict producer runs page-world-qa on the delivered bytes and folds a hard drift (wrong_zone /
   * recurring-object identity redesign / forbidden_scene) into the durable verdict. Absent → no world QA runs and
   * the evidence blob is byte-identical (legacy / steering-off parity). Structurally matches
   * ContractPageWorldExpectation (lib/visual-contract-compiler/adapters) — kept inline to avoid a cross-layer type dep.
   */
  worldExpectation?: {
    zoneDescription: string;
    objects: Array<{ label: string; identity: string }>;
    forbiddenScenes: string[];
  } | null;
}

export interface DeliveredEvidenceArgs {
  orderId: string;
  /** 'cover' | 'page:<n>' — from quality-evidence artifact-key helpers. */
  artifactKey: string;
  /** The exact bytes the customer receives: presentationUrl ?? url (null only on a broken render). */
  deliveredUrl: string | null;
  /** True when a presentation transform produced `deliveredUrl` (its bytes differ from the raw render). */
  presentationApplied: boolean;
  /** The in-loop verdict for the RAW render — reused ONLY when the delivered bytes equal the raw bytes. */
  rawVerdict: QualityVerdict | undefined;
  /**
   * (Stage 1) The in-loop physical-safety result for the RAW render. `hazards` are UNIONed with any the
   * delivered-bytes re-QA finds (a known hazard is never erased). `status` distinguishes 'unverified' (the safety
   * check could not confirm safe → non-soft-deliverable, fail-closed) from a confirmed 'safe'/'hazard'. Omitting
   * `status` derives it from hazards (legacy callers: treated as verified). Absent entirely → no safety carried.
   */
  rawSafety?: { hazards: string[]; status?: 'safe' | 'hazard' | 'unverified' } | undefined;
  /** Required numeric child-identity gate for these delivered page bytes. */
  pageResemblanceGate?: {
    referenceImageUrl: string;
    effectiveThreshold: number;
    minAcceptableScore: number;
    rawEvidence?: {
      status: 'passed' | 'failed' | 'evidence_unknown';
      resemblanceScore: number | null;
      evaluatorVersion?: string;
      subjectVisible?: boolean | null;
      sameChild?: boolean | null;
      referenceBytesSha256?: string | null;
      deliveredBytesSha256?: string | null;
    };
  };
  /** QA context captured at render time, so a delivered-bytes re-QA runs the same checks. */
  qaContext: QaContext | undefined;
  providerModel?: string | null;
  /** In-memory attempt count for observability only — NOT the durable regen budget (carry-in #4). */
  regenAttempts?: number | null;
  /**
   * (WS0b B1) The contract hash to bind this row to — captured by the CALLER before render (render seam: the local
   * pre-render pipeline-cache hash; recovery: the current active hash). NEVER re-read from Order.visualContractHash
   * inside the producer (that read races a concurrent re-freeze → v2 stamped onto v1 bytes → a stale PASS). null =
   * legacy/unbound (freeze off).
   */
  contractHash: string | null;
  /**
   * (WS0b e3) OBSERVABILITY-ONLY contract projection for this artifact (contractHash + pageContract +
   * requiredCheckIds + frozen cast expectations). Persisted as a SIBLING of `qaContext` in the evidence JSON —
   * NEVER merged into `qaContext`, so it cannot change a gate decision or a re-QA (both read `qaContext`, and the
   * gate/TOCTOU fingerprint read verdict/hash/contractHash/regenCount, never the evidence blob). null = absent.
   */
  contractObservability?: Prisma.InputJsonValue | null;
  /** Exact immutable PVB package/book/frame identity used to render these bytes. */
  runtimeAuthorityObservability?: Prisma.InputJsonValue | null;
  /**
   * (release shape C) The delivered-bytes inspection the caller ALREADY ran outside the tx — passed so the Gate-1
   * evidence SHA and the Gate-2 asset SHA (bindPageSafetySha/bindCoverSafetySha) come from ONE inspect of the SAME
   * bytes (no double fetch, no divergence on an unstable URL). Absent (recovery) → this producer inspects itself.
   */
  deliveredInspection?: AssetInspection;
}

export interface ProducerDeps {
  evaluate?: (input: Parameters<typeof evaluatePageVisualQa>[0]) => Promise<PageVisualQaResult>;
  /** (Slice A) The delivered-bytes WORLD QA — injected in tests; defaults to evaluatePageWorldQa. */
  evaluateWorld?: (input: Parameters<typeof evaluatePageWorldQa>[0]) => Promise<PageWorldQaResult>;
  inspect?: (url: string | null | undefined) => Promise<AssetInspection>;
  scoreResemblance?: typeof evaluateStoredPageChildResemblanceVision;
}

type DeliveredPageResemblanceEvidence = {
  required: true;
  /** Exact approved canonical child anchor used by both the render-time gate and zero-render recovery re-QA. */
  referenceImageUrl: string;
  status: 'passed' | 'failed' | 'evidence_unknown';
  resemblanceScore: number | null;
  threshold: number;
  minAcceptableScore: number;
  faceDetectConfidence: number | null;
  faceAreaRatio: number | null;
  evaluatorVersion: string;
  subjectVisible: boolean | null;
  sameChild: boolean | null;
  referenceBytesSha256: string | null;
  deliveredBytesSha256: string | null;
  source: 'raw_same_bytes' | 'delivered_bytes';
};

function strictResemblanceStatus(args: {
  claimedStatus: 'passed' | 'failed' | 'evidence_unknown';
  resemblanceScore: number | null;
  threshold: number;
  evaluatorVersion: string | undefined;
  subjectVisible: boolean | null | undefined;
  sameChild: boolean | null | undefined;
  referenceBytesSha256: string | null | undefined;
  deliveredBytesSha256: string | null | undefined;
  claimedThreshold?: number;
}): 'passed' | 'failed' | 'evidence_unknown' {
  if (args.claimedStatus === 'evidence_unknown') return 'evidence_unknown';
  if (
    args.evaluatorVersion !== PAGE_CHILD_RESEMBLANCE_VISION_VERSION ||
    typeof args.resemblanceScore !== 'number' ||
    !Number.isFinite(args.resemblanceScore) ||
    args.resemblanceScore < 0 || args.resemblanceScore > 1 ||
    !Number.isFinite(args.threshold) ||
    args.threshold < PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD || args.threshold > 1 ||
    (args.claimedThreshold !== undefined && args.claimedThreshold !== args.threshold) ||
    typeof args.referenceBytesSha256 !== 'string' ||
    !SAFETY_SHA256_RE.test(args.referenceBytesSha256) ||
    typeof args.deliveredBytesSha256 !== 'string' ||
    !SAFETY_SHA256_RE.test(args.deliveredBytesSha256) ||
    typeof args.subjectVisible !== 'boolean' ||
    typeof args.sameChild !== 'boolean'
  ) return 'evidence_unknown';
  const passes =
    args.subjectVisible === true &&
    args.sameChild === true &&
    args.resemblanceScore >= args.threshold;
  if (args.claimedStatus === 'passed') return passes ? 'passed' : 'evidence_unknown';
  return passes ? 'evidence_unknown' : 'failed';
}

async function resolveDeliveredPageResemblance(
  args: DeliveredEvidenceArgs,
  score: typeof evaluateStoredPageChildResemblanceVision,
): Promise<DeliveredPageResemblanceEvidence | undefined> {
  const gate = args.pageResemblanceGate;
  if (!gate) return undefined;
  if (!args.deliveredUrl) {
    return {
      required: true,
      referenceImageUrl: gate.referenceImageUrl,
      status: 'evidence_unknown',
      resemblanceScore: null,
      threshold: gate.effectiveThreshold,
      minAcceptableScore: gate.minAcceptableScore,
      faceDetectConfidence: null,
      faceAreaRatio: null,
      evaluatorVersion: PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
      subjectVisible: null,
      sameChild: null,
      referenceBytesSha256: null,
      deliveredBytesSha256: null,
      source: args.presentationApplied ? 'delivered_bytes' : 'raw_same_bytes',
    };
  }
  if (!args.presentationApplied && gate.rawEvidence) {
    const rawScore = gate.rawEvidence.resemblanceScore;
    const status = strictResemblanceStatus({
      claimedStatus: gate.rawEvidence.status,
      resemblanceScore: rawScore,
      threshold: gate.effectiveThreshold,
      evaluatorVersion: gate.rawEvidence.evaluatorVersion,
      subjectVisible: gate.rawEvidence.subjectVisible,
      sameChild: gate.rawEvidence.sameChild,
      referenceBytesSha256: gate.rawEvidence.referenceBytesSha256,
      deliveredBytesSha256: gate.rawEvidence.deliveredBytesSha256,
    });
    return {
      required: true,
      referenceImageUrl: gate.referenceImageUrl,
      status,
      resemblanceScore: rawScore,
      threshold: gate.effectiveThreshold,
      minAcceptableScore: gate.minAcceptableScore,
      faceDetectConfidence: null,
      faceAreaRatio: null,
      evaluatorVersion:
        gate.rawEvidence.evaluatorVersion ?? PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
      subjectVisible: gate.rawEvidence.subjectVisible ?? null,
      sameChild: gate.rawEvidence.sameChild ?? null,
      referenceBytesSha256:
        gate.rawEvidence.referenceBytesSha256 ?? null,
      deliveredBytesSha256:
        gate.rawEvidence.deliveredBytesSha256 ?? null,
      source: 'raw_same_bytes',
    };
  }
  try {
    const exact = await score({
      referenceImageUrl: gate.referenceImageUrl,
      candidateImageUrl: args.deliveredUrl,
      threshold: gate.effectiveThreshold,
    });
    const scored = exact.result;
    const strictStatus = strictResemblanceStatus({
      claimedStatus: scored.status,
      resemblanceScore: scored.resemblanceScore,
      threshold: gate.effectiveThreshold,
      claimedThreshold: scored.threshold,
      evaluatorVersion: scored.evaluatorVersion,
      subjectVisible: scored.subjectVisible,
      sameChild: scored.sameChild,
      referenceBytesSha256: exact.referenceBytesSha256,
      deliveredBytesSha256: exact.candidateBytesSha256,
    });
    return {
      required: true,
      referenceImageUrl: gate.referenceImageUrl,
      status: strictStatus,
      resemblanceScore: scored.resemblanceScore,
      threshold: gate.effectiveThreshold,
      minAcceptableScore: gate.minAcceptableScore,
      faceDetectConfidence: null,
      faceAreaRatio: null,
      evaluatorVersion: scored.evaluatorVersion,
      subjectVisible: scored.subjectVisible,
      sameChild: scored.sameChild,
      referenceBytesSha256: exact.referenceBytesSha256,
      deliveredBytesSha256: exact.candidateBytesSha256,
      source: 'delivered_bytes',
    };
  } catch {
    return {
      required: true,
      referenceImageUrl: gate.referenceImageUrl,
      status: 'evidence_unknown',
      resemblanceScore: null,
      threshold: gate.effectiveThreshold,
      minAcceptableScore: gate.minAcceptableScore,
      faceDetectConfidence: null,
      faceAreaRatio: null,
      evaluatorVersion: PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
      subjectVisible: null,
      sameChild: null,
      referenceBytesSha256: null,
      deliveredBytesSha256: null,
      source: 'delivered_bytes',
    };
  }
}

/** Severity ordering for the durable verdict — a combined verdict is the MOST severe of its inputs. */
const VERDICT_SEVERITY: Record<QualityVerdict, number> = { passed: 0, evidence_unknown: 1, failed: 2 };
function mostSevereVerdict(a: QualityVerdict, b: QualityVerdict): QualityVerdict {
  return VERDICT_SEVERITY[a] >= VERDICT_SEVERITY[b] ? a : b;
}
function joinReasons(a: string | null, b: string): string {
  return a && a.trim() ? `${a}+${b}` : b;
}

/**
 * Resolve the durable verdict for the delivered bytes:
 *  - presentation transform applied → RE-QA the delivered image (never reuse the raw verdict). Carry-in #1.
 *  - no transform (delivered == raw) → reuse the genuine in-loop verdict for the same bytes.
 * Missing url / missing context / missing raw verdict → evidence_unknown (fail-closed, never a synthesized PASS).
 *
 * (Slice A) WORLD overlay: when the page carries a frozen worldExpectation (contract steering only), the delivered
 * bytes are additionally judged by page-world-qa. A hard drift (wrong_zone / recurring-object identity redesign /
 * forbidden_scene) fails the durable verdict (reason `contract_world:<failures>`), and an UNVERIFIED world (vision
 * error) downgrades to evidence_unknown — fail-closed, never a silent PASS. The combined verdict is the most severe
 * of the visual and world verdicts. No worldExpectation → base verdict unchanged (legacy / steering-off parity).
 *
 * (Stage 1) SAFETY overlay: UNIVERSAL (every page/cover, contract or not). Physical-safety hazards come from the
 * SAME single vision call (no extra call) as the UNION of the in-loop `rawSafety` (the transform can't remove a pose
 * hazard) and any the delivered-bytes re-QA adds — a flaky/false-negative re-QA can never SUBTRACT a known hazard.
 * Any hazard composes a durable `safety:<hazards>` reason and forces `failed`, so evaluateQualityGate hard-holds the
 * book (never soft-delivered), on every exit incl. the evidence_unknown early-outs. No hazards → verdict unchanged.
 */
async function resolveDeliveredVerdict(
  args: DeliveredEvidenceArgs,
  evaluate: NonNullable<ProducerDeps['evaluate']>,
  evaluateWorld: NonNullable<ProducerDeps['evaluateWorld']>,
  pageResemblance: DeliveredPageResemblanceEvidence | undefined,
): Promise<{ verdict: QualityVerdict; reason: string | null }> {
  // (Stage 1 + FIX) Safety hazards ALWAYS count — the presentation transform (color-normalize / WebP) cannot remove
  // a pose hazard, so a hazard the in-loop QA flagged on the RAW bytes persists on the delivered bytes. The
  // transform re-QA may ADD hazards but never SUBTRACT a known one (a flaky/false-negative re-QA can't erase it). And
  // (Fix 2) 'unverified' — safety could NOT be confirmed — is fail-closed: non-soft-deliverable, never treated as
  // safe. Both compose a `safety:` reason (→ evaluateQualityGate hard-holds it) folded in on EVERY exit.
  const safetySet = new Set<string>(args.rawSafety?.hazards ?? []);
  // Raw status: explicit, else derived from hazards (legacy callers without `status` are treated as verified).
  const rawStatus =
    args.rawSafety?.status ??
    (args.rawSafety ? (args.rawSafety.hazards.length ? 'hazard' : 'safe') : undefined);
  let deliveredUnverified = rawStatus === 'unverified';
  const applySafety = (
    r: { verdict: QualityVerdict; reason: string | null },
  ): { verdict: QualityVerdict; reason: string | null } => {
    const prior = r.verdict === 'passed' ? null : r.reason;
    if (safetySet.size > 0) {
      return {
        verdict: mostSevereVerdict(r.verdict, 'failed'),
        reason: joinReasons(prior, `safety:${[...safetySet].join('|')}`),
      };
    }
    if (deliveredUnverified) {
      // Can't confirm safe → recoverable (evidence_unknown, a regen may confirm) but NON-soft-deliverable (the gate
      // hard-holds on the `safety:` tag). Never delivered as safe.
      return {
        verdict: mostSevereVerdict(r.verdict, 'evidence_unknown'),
        reason: joinReasons(prior, 'safety:unverified'),
      };
    }
    return r;
  };

  if (!args.deliveredUrl) return applySafety({ verdict: 'evidence_unknown', reason: 'no_delivered_url' });

  // 1. Base (visual) verdict. The transform branch re-QAs the delivered image and ADDS any hazards it sees; the
  //    no-transform branch reuses the genuine in-loop verdict for the same bytes (its safety came via rawSafety).
  let base: { verdict: QualityVerdict; reason: string | null };
  if (args.presentationApplied) {
    if (!args.qaContext) return applySafety({ verdict: 'evidence_unknown', reason: 'qa_context_missing' });
    // The visual evaluator does not take the world expectation — strip it before the call.
    const { worldExpectation: _world, ...visualCtx } = args.qaContext;
    const qa = await evaluate({ imageUrl: args.deliveredUrl, ...visualCtx });
    for (const h of qa.safetyHazards ?? []) safetySet.add(h);
    // The delivered-bytes re-QA is authoritative for 'unverified': a positive 'safe' on the actual delivered bytes
    // clears a raw-unverified; an 'unverified' re-QA keeps it unverified (fail-closed).
    if (qa.safetyStatus === 'unverified') deliveredUnverified = true;
    else if (qa.safetyStatus === 'safe') deliveredUnverified = false;
    // The bare `safety_failed` enum is re-expressed as the durable `safety:<hazards>` tag by applySafety — drop it
    // from the base reason so the composed reason isn't doubled.
    base = { verdict: qa.verdict, reason: qa.reason === 'safety_failed' ? null : qa.reason };
  } else {
    if (!args.rawVerdict) return applySafety({ verdict: 'evidence_unknown', reason: 'raw_verdict_missing' });
    base = { verdict: args.rawVerdict, reason: null };
  }

  // 2. (Slice A) World overlay — only under contract steering (a real setting to judge against). Runs on the
  //    delivered bytes in BOTH branches so a transform-less page cannot escape the world gate.
  let result: { verdict: QualityVerdict; reason: string | null } = base;
  const world = args.qaContext?.worldExpectation;
  if (world && world.zoneDescription.trim()) {
    const w = await evaluateWorld({
      imageUrl: args.deliveredUrl,
      zoneDescription: world.zoneDescription,
      objects: world.objects,
      forbiddenScenes: world.forbiddenScenes,
    });
    if (w.status !== 'pass') {
      // A PASSED base has no meaningful reason ('ok') — drop it so the composed reason stays clean.
      const baseReason = base.verdict === 'passed' ? null : base.reason;
      if (w.status === 'fail') {
        const drift = [
          ...w.hardFailures,
          ...(w.driftObjects.length ? [`objects=${w.driftObjects.join('/')}`] : []),
        ].join(',');
        result = {
          verdict: mostSevereVerdict(base.verdict, 'failed'),
          reason: joinReasons(baseReason, `contract_world:${drift}`),
        };
      } else {
        // status === 'error' → the world could not be verified: fail-closed to evidence_unknown (never a silent PASS).
        result = {
          verdict: mostSevereVerdict(base.verdict, 'evidence_unknown'),
          reason: joinReasons(baseReason, 'contract_world_unverified'),
        };
      }
    }
  }

  if (pageResemblance?.status === 'failed') {
    result = {
      verdict: mostSevereVerdict(result.verdict, 'failed'),
      reason: joinReasons(
        result.verdict === 'passed' ? null : result.reason,
        'child_resemblance_below_threshold',
      ),
    };
  } else if (pageResemblance?.status === 'evidence_unknown') {
    result = {
      verdict: mostSevereVerdict(result.verdict, 'evidence_unknown'),
      reason: joinReasons(
        result.verdict === 'passed' ? null : result.reason,
        'child_resemblance_unverified',
      ),
    };
  }

  // 3. (Stage 1) SAFETY overlay — a physical-safety hazard on the delivered bytes is a non-soft-deliver HARD HOLD,
  //    composed from the SAME vision call (no extra call). rawSafety ∪ re-QA hazards; the `safety:` tag makes
  //    evaluateQualityGate hard-hold it.
  return applySafety(result);
}

/**
 * (#6-fix-3 BLOCKER 1) Persist the EXACT QA context for an artifact ATOMICALLY WITH the delivered asset — call
 * this INSIDE the asset's write-barrier tx, right after the ImageAsset / coverImageUrl write.
 *
 * This CLOSES the crash window between the asset write and the (post-tx, network-bound) verdict persist. Before
 * this, a crash in that window left recovery with an asset but no evidence row → it re-QA'd against a LENIENT
 * fabricated fallback (child-strict, but companion/crib/family/time-of-day OFF) that could PASS a page actually
 * missing its required companion. Now, if the asset exists, its exact requirements exist too — recovery re-QAs
 * against the REAL context. Writes ONLY the evidence JSON (merged), never verdict / assetSha256 / regenCount, so
 * the DB-reserved budget (5b) and any prior verdict are preserved; the verdict is set later by
 * persistDeliveredQualityEvidence. Flag-gated; a no-op when there is no context (the fail-closed gate still
 * blocks a context-less artifact).
 */
export async function persistQualityContext(
  db: Db,
  args: {
    orderId: string;
    artifactKey: string;
    deliveredUrl: string | null;
    qaContext: QaContext | undefined;
    /** Numeric child-identity policy that must be crash-atomically bound with the newly delivered asset. */
    pageResemblanceGate?: DeliveredEvidenceArgs['pageResemblanceGate'];
    /** (WS0b B1) The contract hash to bind — captured by the CALLER before render (never re-read from
     *  Order.visualContractHash here; that read races a concurrent re-freeze). null = legacy/unbound. */
    contractHash: string | null;
    /** Exact immutable PVB package/book/frame identity used to render these bytes. */
    runtimeAuthorityObservability?: Prisma.InputJsonValue | null;
  },
): Promise<void> {
  if (!isReadinessManifestEnabled()) return; // flag OFF → legacy path unchanged
  if (!args.qaContext) return; // nothing to bind — the fail-closed gate covers a context-less artifact
  const existing = await db.qualityEvidence.findUnique({
    where: { orderId_artifactKey: { orderId: args.orderId, artifactKey: args.artifactKey } },
    select: { evidence: true },
  });
  const base =
    existing?.evidence && typeof existing.evidence === 'object' && !Array.isArray(existing.evidence)
      ? (existing.evidence as Record<string, unknown>)
      : {};
  const evidence = {
    ...base,
    deliveredUrl: args.deliveredUrl,
    qaContext: args.qaContext,
    ...(args.pageResemblanceGate
      ? {
          pageResemblanceGate: {
            required: true,
            referenceImageUrl: args.pageResemblanceGate.referenceImageUrl,
            status: 'evidence_unknown',
            resemblanceScore: null,
            threshold: args.pageResemblanceGate.effectiveThreshold,
            minAcceptableScore: args.pageResemblanceGate.minAcceptableScore,
            faceDetectConfidence: null,
            faceAreaRatio: null,
            evaluatorVersion: PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
            subjectVisible: null,
            sameChild: null,
            referenceBytesSha256: null,
            deliveredBytesSha256: null,
            source: 'delivered_bytes',
          },
        }
      : {}),
    ...(args.runtimeAuthorityObservability != null
      ? { runtimeAuthorityObservability: args.runtimeAuthorityObservability }
      : {}),
  } as unknown as Prisma.InputJsonValue;
  // (WS0b B1) Bind the row to the contract captured by the caller BEFORE render (render seam: local pre-render
  // cache hash; recovery: current active hash). NEVER re-read Order.visualContractHash here — a concurrent
  // re-freeze between render and this write would stamp v2 onto v1-rendered bytes (a stale PASS).
  const contractHash = args.contractHash;
  await db.qualityEvidence.upsert({
    where: { orderId_artifactKey: { orderId: args.orderId, artifactKey: args.artifactKey } },
    create: {
      orderId: args.orderId,
      artifactKey: args.artifactKey,
      assetSha256: '',
      verdict: 'evidence_unknown',
      evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION,
      regenCount: 0,
      evidence,
      contractHash,
      reviewStatus: null,
      reviewedAssetSha256: null,
      reviewedContractHash: null,
      reviewedBy: null,
      reviewedAt: null,
      reviewReason: null,
    },
    // (#6-fix-4 P1 #2) ATOMICALLY invalidate the old proof when binding a (possibly CHANGED) context: set
    // verdict='evidence_unknown' and CLEAR assetSha256. Otherwise identical bytes carrying a stale PASS verdict +
    // matching hash would stay admissible under the new context with NO re-QA — a page re-required to show a
    // companion could ship on a pre-change PASS (fail-open). regenCount (column) is untouched and regenPending
    // (inside evidence) is preserved by the `...base` spread, so the durable budget/marker survive. The
    // delivered-evidence verdict (persistDeliveredQualityEvidence) re-establishes a fresh, hash-bound proof right after.
    update: {
      evidence,
      verdict: 'evidence_unknown',
      assetSha256: '',
      contractHash,
      reviewStatus: null,
      reviewedAssetSha256: null,
      reviewedContractHash: null,
      reviewedBy: null,
      reviewedAt: null,
      reviewReason: null,
    },
  });
}

export async function persistDeliveredQualityEvidence(
  db: Db,
  args: DeliveredEvidenceArgs,
  deps: ProducerDeps = {},
): Promise<void> {
  if (!isReadinessManifestEnabled()) return; // flag OFF → legacy path unchanged
  const inspect = deps.inspect ?? inspectAsset;
  const evaluate = deps.evaluate ?? evaluatePageVisualQa;
  const evaluateWorld = deps.evaluateWorld ?? evaluatePageWorldQa;
  const scoreResemblance =
    deps.scoreResemblance ?? evaluateStoredPageChildResemblanceVision;

  const deliveredPageResemblance = await resolveDeliveredPageResemblance(
    args,
    scoreResemblance,
  );
  let { verdict, reason } = await resolveDeliveredVerdict(
    args,
    evaluate,
    evaluateWorld,
    deliveredPageResemblance,
  );

  // Carry-in #3: bind the verdict to the EXACT delivered bytes. If the bytes can't be hashed, the verdict can't
  // be trusted → evidence_unknown, and the empty hash guarantees a mismatch at readiness (fail-closed). (release
  // shape C) Reuse the caller's inspection when provided so Gate-1 and Gate-2 bind the SAME inspected bytes.
  const exactScoredSha =
    deliveredPageResemblance?.source === 'delivered_bytes'
      ? deliveredPageResemblance.deliveredBytesSha256
      : null;
  const inspection = args.deliveredInspection ??
    (exactScoredSha ? null : await inspect(args.deliveredUrl));
  const assetSha256 = inspection?.sha256 ?? exactScoredSha ?? '';
  if (!assetSha256) {
    verdict = 'evidence_unknown';
    reason = reason ?? `asset_inspect:${inspection?.error ?? 'no_hash'}`;
  }
  if (
    deliveredPageResemblance?.deliveredBytesSha256 &&
    deliveredPageResemblance.deliveredBytesSha256 !== assetSha256
  ) {
    verdict = 'evidence_unknown';
    reason = 'child_resemblance_exact_bytes_changed';
  }

  const evaluatedAt = new Date();
  const evidence = {
    presentationApplied: args.presentationApplied,
    regenAttempts: args.regenAttempts ?? null,
    deliveredUrl: args.deliveredUrl,
    qaContext: args.qaContext ?? null,
    // (WS0b e3) SIBLING of qaContext — observability only; omitted when absent (flag off) → evidence byte-identical.
    ...(args.contractObservability != null ? { contractObservability: args.contractObservability } : {}),
    ...(args.runtimeAuthorityObservability != null
      ? { runtimeAuthorityObservability: args.runtimeAuthorityObservability }
      : {}),
    ...(deliveredPageResemblance
      ? { pageResemblanceGate: deliveredPageResemblance }
      : {}),
  } as unknown as Prisma.InputJsonValue;
  const persistArgs = {
    orderId: args.orderId,
    artifactKey: args.artifactKey,
    assetSha256,
    verdict,
    reason,
    providerModel: args.providerModel ?? null,
    // (WS0b B1) Bind to the contract the caller captured before render (never a post-render re-read).
    contractHash: args.contractHash,
    now: evaluatedAt,
    // regenCount intentionally omitted — the DB-reserved budget (5b) is authoritative and preserved (carry-in #4).
    // (#7-a 6) Persist the delivered URL + QA context so the exception-processor can RE-QA the SAME bytes
    // (zero renders) with the same checks during recovery.
    evidence,
  } satisfies Parameters<typeof persistQualityEvidence>[1];

  // Fresh QA is a delivery-input mutation. In production, acquire Order first and atomically stale readiness,
  // advance inputVersion and remove a ready Order from the send CAS before replacing/clearing any human review.
  // Network/Vision work above remains outside the transaction. A TransactionClient means the caller already owns
  // the surrounding delivery-input barrier (persistQualityContext and focused tests use that shape).
  if (isRootPrismaClient(db)) {
    const attempt = {
      artifactKey: args.artifactKey,
      assetSha256,
      verdict,
      reason: reason ?? null,
      providerModel: args.providerModel ?? null,
      contractHash: args.contractHash,
      evidence,
      evaluatedAt: evaluatedAt.toISOString(),
    };
    const attemptDigest = canonicalHash(attempt);
    await withDeliveryInputMutation(
      db,
      {
        orderId: args.orderId,
        reason: 'quality_evidence_changed',
        operationKey:
          `quality_evidence:${args.orderId}:${args.artifactKey}:${attemptDigest}`,
        mutationPayload: attempt as unknown as ReceiptSafeValue,
      },
      async (tx) => {
        await persistQualityEvidence(tx, persistArgs);
        return {
          artifactKey: args.artifactKey,
          assetSha256,
          evaluatedAt: evaluatedAt.toISOString(),
        };
      },
    );
    return;
  }
  await persistQualityEvidence(db, persistArgs);
}
