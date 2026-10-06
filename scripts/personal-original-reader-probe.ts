/** One original-only diagnostic reading. Reuses the production wire and one-use journal. */
import path from 'node:path';
import { causalDigest, causalOriginalReviewPacket, causalSourceReviewPacket, compileCausalSourceReading } from '../lib/personal-wizard/story-causal-experiment';
import { canonicalJson } from '../lib/personal-wizard/request-acceptance';
import type { PreparedStory } from '../lib/personal-wizard/story-writer';
import type { StoryReviewDocument } from '../lib/personal-wizard/story-text-review';
import type { CausalDispatch } from '../lib/personal-wizard/story-causal-experiment-runner';
import { withGenerationDeadline } from '../lib/personal-wizard/generation-deadline';
import { CausalFamilyJournal, CausalHostError, hostFail } from './personal-causal-trial-journal';
import { prepareCausalWire, createAstraCausalTransport, CausalTransportError, type TransportReceipt } from './personal-causal-trial-adapters';

export const READER_PROBE_MAX_MICRO_USD = 1_000_000;
// Conservative standard input/cache-write and output ceilings, not invoice rates.
const rates = { inputMicroUsdPerToken: 12.5, outputMicroUsdPerToken: 50 };
type Source = { prepared: PreparedStory; original: StoryReviewDocument; expectedOriginalDigest: string;
  readingProfile?: 'solution_reasoning' };
export const SOLUTION_REASONING_READER_INSTRUCTIONS = '\nAt a consequential resolution, separate what established world rules permit, what prepared ability/object/affordance enables action, and what each character wants or chooses. Meeting a condition does not by itself establish the ability to bring it about. A wish or choice can emerge later; do not recast it as a magic rule. Check actual setup, action and consequence: an unexplained enabling ability is under-preparation or ambiguity, not contradiction unless the prose forbids it. Animate fantasy may establish an affordance through action without a technical explanation. Consider plausible alternative readings and this listener\'s material confusion before flagging. A comic guess is not a fact; do not require evidence for every joke. Do not infer a breached request or magical power solely because an instruction is not repeated. Keep useful clues, play and relational choices; no required rewrite or checklist in the story.';
export function prepareOriginalReaderProbe(source: Source, approvalReference: string) {
  if (source.readingProfile !== undefined && source.readingProfile !== 'solution_reasoning') hostFail('reader_profile');
  if (!/^[a-z0-9_-]{10,100}$/.test(approvalReference) ||
    !/^[a-f0-9]{64}$/.test(source.expectedOriginalDigest) ||
    causalDigest(source.original) !== source.expectedOriginalDigest) hostFail('reader_probe_binding');
  // Immutable source snapshot; no previous review, editor claim or expected finding is supplied.
  const packet = causalOriginalReviewPacket(structuredClone(source.prepared), structuredClone(source.original));
  if (source.readingProfile === 'solution_reasoning') packet.instructions += SOLUTION_REASONING_READER_INSTRUCTIONS;
  const citation = causalSourceReviewPacket(packet);
  const family = 'reader-' + causalDigest({ approvalReference }).slice(0, 32);
  const call: CausalDispatch = { role: 'astra', stage: 'original_review',
    conversationKey: family + ':case1:original_review', instructions: citation.instructions,
    input: canonicalJson({ packet: citation.packet, packetDigest: citation.packetDigest }), schema: citation.schema,
    maxOutputTokens: 8000 + source.prepared.brief.beats * 500 };
  const wire = prepareCausalWire(call, { executable: '', executableSha256: '', workspace: '',
    maxWireBytes: 104_000, rates: { opus: rates, astra: rates } }, READER_PROBE_MAX_MICRO_USD);
  const manifest = { version: 'original-reader-probe/v2', family, approvalReference,
    originalDigest: source.expectedOriginalDigest, requestDigest: causalDigest(source.prepared.accepted.canonical),
    packetDigest: citation.packetDigest, sourcePacketDigest: causalDigest(packet), citationVersion: citation.packet.citationVersion,
    wireDigest: wire.digest, wireBytes: wire.bytes,
    model: wire.model, maxOutputTokens: call.maxOutputTokens, maximumMicroUsd: READER_PROBE_MAX_MICRO_USD,
    reservedMicroUsd: wire.reservedMicroUsd, rates, runtimeEligible: false,
    ...(source.readingProfile ? { readingProfile: source.readingProfile } : {}) };
  return { family, packet, call, wire, manifest };
}

export const READER_COMPARISON_MAX_MICRO_USD = 6_000_000;
/** Fixed paired calibration only. No story generation, new transport or normal-path promotion. */
export function prepareOriginalReaderComparison(sources: readonly Source[], approvalReference: string) {
  if (sources.length !== 3 || sources.some(source => source.readingProfile !== undefined) ||
    new Set(sources.map(source => source.expectedOriginalDigest)).size !== 3) hostFail('reader_comparison_sources');
  const calls = sources.flatMap((source, index) => {
    const profiles: Source['readingProfile'][] = index % 2 ? ['solution_reasoning', undefined] : [undefined, 'solution_reasoning'];
    return profiles.map(readingProfile => ({ sourceIndex: index + 1,
      profile: readingProfile ?? 'baseline' as const, ...prepareOriginalReaderProbe({ ...source, readingProfile }, approvalReference) }));
  }).map((probe, index) => ({ ...probe, id: `case${index + 1}:original_review`,
    call: { ...probe.call, conversationKey: `${probe.family}:case${index + 1}:original_review` } }));
  const family = calls[0].family;
  const slots = calls.map(row => ({ id: row.id, capMicroUsd: READER_PROBE_MAX_MICRO_USD }));
  const manifest = { version: 'original-reader-comparison/v2', family, approvalReference,
    maximumMicroUsd: READER_COMPARISON_MAX_MICRO_USD, reservedMicroUsd: calls.reduce((sum, row) => sum + row.wire.reservedMicroUsd, 0),
    slots, calls: calls.map(row => ({ id: row.id, sourceIndex: row.sourceIndex, profile: row.profile,
      originalDigest: row.manifest.originalDigest, requestDigest: row.manifest.requestDigest,
      packetDigest: row.manifest.packetDigest, wireDigest: row.manifest.wireDigest, wireBytes: row.wire.bytes,
      model: row.wire.model, maxOutputTokens: row.call.maxOutputTokens, reservedMicroUsd: row.wire.reservedMicroUsd,
      conversationKey: row.call.conversationKey })), rates, runtimeEligible: false };
  return { family, calls, slots, manifest };
}

export async function runOriginalReaderComparison(args: { sources: readonly Source[]; approvalReference: string;
  commonDir: string; outputParent: string; key: () => string; signal: AbortSignal; fetch?: typeof fetch }) {
  if (args.signal.aborted) hostFail('cancelled');
  // Prepare ALL six wires before acquiring the one-use family, key or network.
  const prepared = prepareOriginalReaderComparison(args.sources, args.approvalReference);
  const outputRoot = path.join(args.outputParent, prepared.family), digest = causalDigest(prepared.manifest);
  const journal = CausalFamilyJournal.reserve({ commonDir: args.commonDir, outputRoot, family: prepared.family,
    coordinatorDigest: digest, maximumMicroUsd: READER_COMPARISON_MAX_MICRO_USD,
    slots: prepared.slots, manifest: prepared.manifest });
  const readings: ReturnType<typeof compileCausalSourceReading>[] = [], receipts: TransportReceipt[] = [];
  const transport = createAstraCausalTransport({ key: args.key, rates, fetch: args.fetch });
  let active: typeof prepared.calls[number] | null = null, attempted = false, receipt: TransportReceipt | null = null;
  try {
    for (const row of prepared.calls) {
      active = row; attempted = false; receipt = null;
      if (args.signal.aborted) hostFail('cancelled');
      journal.save('packet-' + row.id.replace(':', '-'), row.packet);
      journal.claim(prepared.family, digest, row.id);
      journal.dispatch(row.id, { wire: row.wire, conversationKey: row.call.conversationKey });
      journal.verifyRecords();
      if (args.signal.aborted) hostFail('cancelled');
      attempted = true;
      const reply = await withGenerationDeadline(row.call.maxOutputTokens, args.signal,
        reason => new CausalHostError(reason), signal => transport(row.wire, row.call, signal));
      receipt = reply;
      journal.settle(row.id, reply);
      if (args.signal.aborted) hostFail('cancelled');
      if (reply.estimatedMicroUsd === null || !Number.isSafeInteger(reply.estimatedMicroUsd) ||
        reply.estimatedMicroUsd < 0 || reply.estimatedMicroUsd > row.wire.reservedMicroUsd) hostFail('usage');
      const reading = compileCausalSourceReading(row.packet, reply.output);
      journal.save('reading-' + row.id.replace(':', '-'), reading);
      readings.push(reading); receipts.push(reply);
    }
    journal.save('accounting', { logicalAttempts: receipts.length,
      estimatedMicroUsd: receipts.reduce((sum, row) => sum + row.estimatedMicroUsd!, 0),
      unknownAttemptCosts: 0, kind: 'estimate_not_invoice', runtimeEligible: false });
    journal.verifyRecords(); journal.seal('completed_diagnostic');
    return { outputRoot, manifest: prepared.manifest, readings, receipts, runtimeEligible: false as const };
  } catch (error) {
    try {
      if (error instanceof CausalTransportError && active) {
        receipt = error.receipt;
        journal.settle(active.id, receipt);
      }
      journal.save('failure', { slot: active?.id ?? null, attempted, completedReadings: readings.length,
        code: error instanceof CausalHostError ? error.code : 'reader_comparison_failed',
        estimatedMicroUsd: receipt?.estimatedMicroUsd ?? null,
        unknownAttemptCosts: Number(attempted && !receipt?.usage), runtimeEligible: false });
    } finally { journal.seal('failed'); }
    throw error;
  }
}
export async function runOriginalReaderProbe(args: Source & { approvalReference: string;
  commonDir: string; outputParent: string; key: () => string; signal: AbortSignal; fetch?: typeof fetch }) {
  if (args.signal.aborted) hostFail('cancelled');
  const probe = prepareOriginalReaderProbe(args, args.approvalReference);
  const outputRoot = path.join(args.outputParent, probe.family), digest = causalDigest(probe.manifest);
  // The same approval maps to one atomic family across output roots and worktrees.
  const journal = CausalFamilyJournal.reserve({ commonDir: args.commonDir, outputRoot, family: probe.family,
    coordinatorDigest: digest, maximumMicroUsd: READER_PROBE_MAX_MICRO_USD,
    slots: [{ id: 'case1:original_review', capMicroUsd: READER_PROBE_MAX_MICRO_USD }], manifest: probe.manifest });
  const id = 'case1:original_review';
  let attempted = false, receipt: TransportReceipt | null = null;
  try {
    journal.save('packet', probe.packet);
    journal.claim(probe.family, digest, id);
    journal.dispatch(id, { wire: probe.wire, conversationKey: probe.call.conversationKey });
    journal.verifyRecords();
    if (args.signal.aborted) hostFail('cancelled');
    attempted = true;
    const reply = await withGenerationDeadline(probe.call.maxOutputTokens, args.signal,
      reason => new CausalHostError(reason), signal =>
        createAstraCausalTransport({ key: args.key, rates, fetch: args.fetch })(probe.wire, probe.call, signal));
    receipt = reply;
    journal.settle(id, reply);
    if (args.signal.aborted) hostFail('cancelled');
    if (reply.estimatedMicroUsd === null || !Number.isSafeInteger(reply.estimatedMicroUsd) ||
      reply.estimatedMicroUsd < 0 || reply.estimatedMicroUsd > probe.wire.reservedMicroUsd) hostFail('usage');
    const reading = compileCausalSourceReading(probe.packet, reply.output);
    journal.save('reading', reading);
    journal.save('accounting', { attempted, estimatedMicroUsd: reply.estimatedMicroUsd,
      unknownAttemptCosts: Number(reply.estimatedMicroUsd === null), kind: 'estimate_not_invoice', runtimeEligible: false });
    journal.verifyRecords(); journal.seal('completed_diagnostic');
    return { outputRoot, manifest: probe.manifest, reading, receipt: reply };
  } catch (error) {
    try {
      if (error instanceof CausalTransportError) {
        receipt = error.receipt;
        // Transport failures keep raw provider evidence and usage, including incomplete JSON.
        journal.settle(id, receipt);
      }
      journal.save('failure', { attempted, code: error instanceof CausalHostError ? error.code : 'reader_probe_failed',
        estimatedMicroUsd: receipt?.estimatedMicroUsd ?? null, unknownAttemptCosts: Number(attempted && !receipt?.usage), runtimeEligible: false });
    }
    finally { journal.seal('failed'); }
    throw error;
  }
}
