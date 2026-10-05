/** One original-only diagnostic reading. Reuses the production wire and one-use journal. */
import path from 'node:path';
import { causalDigest, causalOriginalReviewPacket, causalCriticSchema, compileCausalReading } from '../lib/personal-wizard/story-causal-experiment';
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
type Source = { prepared: PreparedStory; original: StoryReviewDocument; expectedOriginalDigest: string };
export function prepareOriginalReaderProbe(source: Source, approvalReference: string) {
  if (!/^[a-z0-9_-]{10,100}$/.test(approvalReference) ||
    !/^[a-f0-9]{64}$/.test(source.expectedOriginalDigest) ||
    causalDigest(source.original) !== source.expectedOriginalDigest) hostFail('reader_probe_binding');
  // Immutable source snapshot; no previous review, editor claim or expected finding is supplied.
  const packet = causalOriginalReviewPacket(structuredClone(source.prepared), structuredClone(source.original));
  const family = 'reader-' + causalDigest({ approvalReference }).slice(0, 32);
  const call: CausalDispatch = { role: 'astra', stage: 'original_review',
    conversationKey: family + ':case1:original_review', instructions: packet.instructions,
    input: canonicalJson({ packet, packetDigest: causalDigest(packet) }), schema: causalCriticSchema,
    maxOutputTokens: 8000 + source.prepared.brief.beats * 500 };
  const wire = prepareCausalWire(call, { executable: '', executableSha256: '', workspace: '',
    maxWireBytes: 104_000, rates: { opus: rates, astra: rates } }, READER_PROBE_MAX_MICRO_USD);
  const manifest = { version: 'original-reader-probe/v1', family, approvalReference,
    originalDigest: source.expectedOriginalDigest, requestDigest: causalDigest(source.prepared.accepted.canonical),
    packetDigest: causalDigest(packet), wireDigest: wire.digest, wireBytes: wire.bytes,
    model: wire.model, maxOutputTokens: call.maxOutputTokens, maximumMicroUsd: READER_PROBE_MAX_MICRO_USD,
    reservedMicroUsd: wire.reservedMicroUsd, rates, runtimeEligible: false };
  return { family, packet, call, wire, manifest };
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
    const reading = compileCausalReading(probe.packet, reply.output);
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
