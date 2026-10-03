/** Same-process diagnostic connection. Import is inert; no live default or resume mode. */
import { closeSync, fstatSync, lstatSync, openSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { createCausalExperiment, CAUSAL_STAGES, type CausalDispatch, type CausalStage } from '../lib/personal-wizard/story-causal-experiment-runner';
import { causalDigest, CausalExperimentError } from '../lib/personal-wizard/story-causal-experiment';
import { preparePersonalStory } from '../lib/personal-wizard/story-writer';
import { personalStoryOutputLimits } from '../lib/personal-wizard/story-config';
import { storyEditorOutputTokens } from '../lib/personal-wizard/story-editor';
import { resolvePersonalWizardOptions } from '../lib/personal-wizard/options';
import { CausalFamilyJournal, CausalHostError, hostFail, realDirectory } from './personal-causal-trial-journal';
import { CAUSAL_MODELS, CausalTransportError, createAstraCausalTransport, createOpusCausalTransport,
  prepareCausalWire, wireReservation, type CausalWire, type TransportReply, type WirePolicy } from './personal-causal-trial-adapters';
import { gitAt } from './personal-story-frozen-engine';

const rates = z.object({ inputMicroUsdPerToken: z.number().positive().finite(), outputMicroUsdPerToken: z.number().positive().finite() }).strict();
export const causalHostPolicySchema = z.object({
  version: z.literal('causal-trial-host/v1'), family: z.string().regex(/^[a-z0-9][a-z0-9_-]{2,100}$/),
  sourceHead: z.string().regex(/^[a-f0-9]{40}$/), maximumMicroUsd: z.number().int().positive().safe(),
  maxWireBytes: z.number().int().positive().max(104_000),
  executable: z.string().min(1), executableSha256: z.string().regex(/^[a-f0-9]{64}$/),
  pricing: z.object({ source: z.string().min(10).max(600), checkedAt: z.string().datetime(),
    rates: z.object({ opus: rates, astra: rates }).strict() }).strict(),
  mode: z.enum(['offline_injected', 'live_explicit']),
  approval: z.object({ reference: z.string().min(10).max(600), maximumMicroUsd: z.number().int().positive().safe(),
    acknowledgesCliEstimateLimits: z.literal(true) }).strict().nullable(),
}).strict();
export type CausalHostPolicy = z.infer<typeof causalHostPolicySchema>;
export type CausalHostTransport = (wire: CausalWire, call: CausalDispatch, signal: AbortSignal) => Promise<TransportReply>;
const reviewSchema = z.object({ sourceDigest: z.string().regex(/^[a-f0-9]{64}$/), decisions: z.array(z.object({
  caseId: z.string().regex(/^case[1-6]$/), decision: z.enum(['write', 'hold']), reason: z.string().trim().min(10).max(600),
}).strict()).min(1).max(6) }).strict();
export function readCausalReviewFile(file: string) {
  realDirectory(path.dirname(file));
  const st = lstatSync(file);
  if (!st.isFile() || st.isSymbolicLink() || st.nlink !== 1 || st.size > 10_000 ||
    realpathSync.native(file).toLowerCase() !== path.resolve(file).toLowerCase()) hostFail('review_file');
  const fd = openSync(file, 'r');
  try {
    const opened = fstatSync(fd);
    if (opened.dev !== st.dev || opened.ino !== st.ino || opened.nlink !== 1 || opened.size !== st.size) hostFail('review_file');
    return reviewSchema.parse(JSON.parse(readFileSync(fd, 'utf8')));
  } catch { hostFail('review_file'); } finally { closeSync(fd); }
}
export function causalOutputCap(spreads: number, stage: CausalStage) {
  const limits = personalStoryOutputLimits(spreads);
  if (stage === 'plan' || stage === 'replan') return limits.planOutputTokens + 6000;
  if (stage === 'author') return limits.manuscriptOutputTokens;
  if (stage === 'editor') return storyEditorOutputTokens(spreads) + 4000;
  return 8000 + spreads * 500;
}
/** Caller supplies a NEW immutable policy; an old approval/family is never rewritten by this module. */
export function createCausalTrialHost(args: {
  workspace: string; outputRoot: string; policy: unknown; cases: { id: string; request: unknown }[]; signal: AbortSignal;
  // Only available in offline_injected mode. Real transports are constructed lazily below.
  injected?: { commonDir: string; assertSource: () => void; transport: CausalHostTransport };
  existingOpenAIKey?: () => string;
}) {
  const parsed = causalHostPolicySchema.safeParse(args.policy);
  if (!parsed.success) hostFail('policy');
  const policy = structuredClone(parsed.data);
  if ((policy.mode === 'offline_injected') !== Boolean(args.injected) ||
    policy.mode === 'offline_injected' && policy.approval !== null ||
    policy.mode === 'live_explicit' && (!policy.approval || policy.approval.maximumMicroUsd !== policy.maximumMicroUsd || !args.existingOpenAIKey)) hostFail('authorization');
  if (policy.mode === 'live_explicit' && (Date.now() - Date.parse(policy.pricing.checkedAt) > 86_400_000 || Date.parse(policy.pricing.checkedAt) > Date.now())) hostFail('pricing_stale');
  if (!path.isAbsolute(args.workspace) || !path.isAbsolute(args.outputRoot) || !path.isAbsolute(policy.executable)) hostFail('directory');
  const workspace = args.workspace, outputRoot = args.outputRoot, signal = args.signal;
  const assertSource = args.injected?.assertSource ?? (() => {
    if (gitAt(workspace, ['rev-parse', 'HEAD']).toString().trim() !== policy.sourceHead || gitAt(workspace, ['status', '--porcelain']).toString().trim()) hostFail('source_changed');
  });
  assertSource();
  const commonDir = args.injected?.commonDir ?? gitAt(workspace, ['rev-parse', '--path-format=absolute', '--git-common-dir']).toString().trim();
  realDirectory(commonDir); realDirectory(workspace); realDirectory(path.dirname(outputRoot));
  const options = resolvePersonalWizardOptions();
  const prepared = args.cases.map(c => ({ id: c.id, prepared: preparePersonalStory(structuredClone(c.request), options) }));
  if (prepared.some(c => !c.prepared.accepted.containsFixtureData)) hostFail('fictional_only');
  const caps = Object.fromEntries(CAUSAL_STAGES.map(stage => [stage, Math.max(...prepared.map(c => wireReservation(policy.maxWireBytes,
    causalOutputCap(c.prepared.brief.beats, stage), policy.pricing.rates[['plan', 'replan', 'author', 'editor'].includes(stage) ? 'opus' : 'astra'])))])) as Record<CausalStage, number>;
  const expectedSlots = prepared.flatMap(c => CAUSAL_STAGES.map(stage => ({ id: `${c.id}:${stage}`, capMicroUsd: caps[stage],
    maxOutputTokens: causalOutputCap(c.prepared.brief.beats, stage), role: ['plan', 'replan', 'author', 'editor'].includes(stage) ? 'opus' as const : 'astra' as const })));
  const reserved = expectedSlots.reduce((n, s) => n + s.capMicroUsd, 0);
  if (!Number.isSafeInteger(reserved) || reserved > policy.maximumMicroUsd) hostFail('budget');
  const wirePolicy: WirePolicy = { ...policy, workspace, rates: policy.pricing.rates };
  let journal: CausalFamilyJournal | null = null, pending: string | null = null, closed = false, busy = false, failureCode: string | null = null;
  let transport: CausalHostTransport | null = args.injected?.transport ?? null;
  const rows: { slot: string; attempted: boolean; receipt: TransportReply | null }[] = [];
  const safeError = (error: unknown) => error instanceof CausalHostError || error instanceof CausalExperimentError ? error : new CausalHostError('failed');
  const seal = (reason: string) => { closed = true; failureCode ??= reason; journal?.seal(reason); };
  const abort = () => seal('cancelled'); signal.addEventListener('abort', abort, { once: true });
  const active = () => { if (closed || signal.aborted) hostFail('terminal'); assertSource(); journal?.assertActive(); };
  const coordinator = createCausalExperiment({ family: policy.family, cases: args.cases, options, capsMicroUsd: caps,
    maximumMicroUsd: policy.maximumMicroUsd, signal, ports: {
      async reserve(family, coordinatorDigest, maximumMicroUsd, slots) {
        try {
        active(); if (journal || family !== policy.family || maximumMicroUsd !== reserved ||
          causalDigest(slots) !== causalDigest(expectedSlots.map(({ id, capMicroUsd }) => ({ id, capMicroUsd })))) hostFail('reservation');
        const manifest = { version: 'causal-trial-host/v1', policy, coordinatorDigest, coordinator: coordinator.snapshot().manifest,
          slots: expectedSlots, reservedMicroUsd: reserved, maxLogicalDispatches: expectedSlots.length,
          costKind: 'usage_estimate_not_invoice', invoiceCapGuaranteed: false, nativeInternalCallCount: 'unverified',
          wireReservation: 'future_full_wire_byte_ceilings_rechecked_exactly_per_dispatch', runtimeEligible: false };
        journal = CausalFamilyJournal.reserve({ commonDir, outputRoot, family, coordinatorDigest, maximumMicroUsd, slots, manifest });
        return true;
        } catch (error) { seal(error instanceof CausalHostError ? error.code : 'reservation_failed'); throw safeError(error); }
      },
      async claim(family, digest, slot) {
        active(); if (!journal || pending || busy) hostFail('claim');
        journal.claim(family, digest, slot); pending = slot; return true;
      },
      async generate(call, stageSignal) {
        active();
        const slot = expectedSlots.find(s => `${policy.family}:${s.id}` === call.conversationKey);
        if (!journal || !slot || pending !== slot.id || busy || slot.role !== call.role || slot.maxOutputTokens !== call.maxOutputTokens ||
          slot.id.split(':')[1] !== call.stage) hostFail('dispatch_binding');
        busy = true; pending = null;
        const row = { slot: slot.id, attempted: false, receipt: null as TransportReply | null }; rows.push(row);
        const stageAbort = () => seal('cancelled'); stageSignal.addEventListener('abort', stageAbort, { once: true });
        try {
          const wire = prepareCausalWire(call, wirePolicy, slot.capMicroUsd, journal.instructionPath(slot.id));
          active(); if (stageSignal.aborted) hostFail('terminal');
          if (call.role === 'opus') journal.instructions(slot.id, call.instructions);
          journal.dispatch(slot.id, { wire, sourceHead: policy.sourceHead, conversationKey: call.conversationKey });
          active(); if (stageSignal.aborted) hostFail('terminal');
          // First real client/key lookup/spawn can happen only after the durable dispatch.
          if (!transport) {
            const opus = createOpusCausalTransport(wirePolicy), astra = createAstraCausalTransport({ key: args.existingOpenAIKey!, rates: policy.pricing.rates.astra });
            transport = (w, c, s) => w.role === 'opus' ? opus(w, c, s) : astra(w, c, s);
          }
          row.attempted = true;
          const reply = await transport(wire, call, stageSignal);
          active(); if (stageSignal.aborted) hostFail('terminal');
          // Receipt is preserved even when known cost or content is not admissible.
          row.receipt = structuredClone(reply); journal.settle(slot.id, row);
          const cost = reply.estimatedMicroUsd;
          if (cost === null || !Number.isSafeInteger(cost) || cost < 0 || cost > slot.capMicroUsd) hostFail('cost');
          const output = call.schema.parse(reply.output);
          return { output, estimatedMicroUsd: cost };
        } catch (error) {
          if (!closed && error instanceof CausalTransportError) {
            row.receipt = structuredClone({ ...error.receipt, output: null });
            try { journal.settle(slot.id, { ...row, failureCode: error.code }); } catch { /* terminal regardless */ }
          }
          seal(error instanceof CausalHostError ? error.code : 'dispatch_failed'); throw safeError(error);
        } finally { busy = false; stageSignal.removeEventListener('abort', stageAbort); }
      },
    } });
  async function step<T>(run: () => Promise<T>): Promise<T> {
    try { active(); return await run(); } catch (error) { seal('coordinator_failed'); throw safeError(error); }
  }
  return {
    async plan() { return step(async () => {
      const bundle = await coordinator.plan(); journal!.save('synopses', bundle);
      journal!.save('review-template', { sourceDigest: bundle.sourceDigest, decisions: prepared.map(c => ({ caseId: c.id, decision: 'PENDING', reason: '' })) });
      return bundle;
    }); },
    async write(review: unknown) { return step(async () => {
      const decisions = reviewSchema.parse(review); coordinator.reviewSynopses(decisions);
      journal!.save('synopsis-review', decisions);
      const result = await coordinator.write(); journal!.save('books', result);
      journal!.save('host-accounting', { reservedMicroUsd: reserved, logicalAttempts: rows.filter(r => r.attempted).length,
        knownEstimateMicroUsd: rows.reduce((n, r) => n + (r.receipt?.estimatedMicroUsd ?? 0), 0),
        unknownAttemptCosts: rows.filter(r => r.attempted && r.receipt?.estimatedMicroUsd == null).length,
        kind: 'estimate_not_invoice', runtimeEligible: false });
      journal!.verifyRecords();
      seal('completed_diagnostic'); signal.removeEventListener('abort', abort); return result;
    }); },
    async writeFromReviewFile() { return step(async () => {
      // Same process/instance only; no saved-state reconstruction or paid polling.
      const review = readCausalReviewFile(path.join(outputRoot, 'review.json'));
      return this.write(review);
    }); },
    stop() { seal('operator_stopped'); signal.removeEventListener('abort', abort); },
    snapshot() { return structuredClone({ coordinator: coordinator.snapshot(), host: { closed, failureCode, reservedMicroUsd: reserved, rows,
      accountingKind: 'estimate_not_invoice', mode: policy.mode, runtimeEligible: false } }); },
  };
}
