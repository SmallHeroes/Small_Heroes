/** Four fresh, plan-only diagnostic calls. No customer route, prose, repair or resume. */
import { z } from 'zod';
import path from 'node:path';
import { randomInt } from 'node:crypto';
import { preparePersonalStory, RESILIENCE_INSTRUCTIONS } from '../lib/personal-wizard/story-writer';
import { resolvePersonalWizardOptions } from '../lib/personal-wizard/options';
import { canonicalJson } from '../lib/personal-wizard/request-acceptance';
import { causalDigest, CAUSAL_PLAN_INSTRUCTIONS, causalPlanSchema, compileCausalPlan } from '../lib/personal-wizard/story-causal-experiment';
import { personalStoryOutputLimits } from '../lib/personal-wizard/story-config';
import type { CausalDispatch } from '../lib/personal-wizard/story-causal-experiment-runner';
import { CausalFamilyJournal, CausalHostError, hostFail, realDirectory } from './personal-causal-trial-journal';
import { CAUSAL_MODELS, CausalTransportError, createOpusCausalTransport, prepareCausalWire, type CausalWire, type TransportReply, type WirePolicy } from './personal-causal-trial-adapters';
import { gitAt } from './personal-source-git';

export const PLAN_COMPARISON_BASE = '5f54af936c9b23326f01e4c7c45e0ce7d0dbc940';
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const planComparisonPolicySchema = z.object({
  version: z.literal('four-plan-comparison/v1'), sourceHead: z.string().regex(/^[a-f0-9]{40}$/),
  mode: z.enum(['offline_injected', 'live_explicit']),
  executable: z.string().min(1), executableSha256: hash,
  pricing: z.object({ source: z.literal('https://platform.claude.com/docs/en/about-claude/pricing'),
    checkedAt: z.string().datetime(), inputMicroUsdPerToken: z.literal(4), outputMicroUsdPerToken: z.literal(20) }).strict(),
  approval: z.object({ reference: z.string().min(10).max(600), maximumMicroUsd: z.literal(8_000_000),
    requestId: hash, requestDigest: hash, optionsFingerprint: hash,
    consent: z.literal('four_fresh_plans_opus_only'), acknowledgesCliEstimateLimits: z.literal(true) }).strict(),
}).strict();
export type PlanComparisonPolicy = z.infer<typeof planComparisonPolicySchema>;
type Transport = (wire: CausalWire, call: CausalDispatch, signal: AbortSignal) => Promise<TransportReply>;
const knownCost = (cost: number | null | undefined) => typeof cost === 'number' && Number.isSafeInteger(cost) && cost >= 0;

/** Fail if the archived writer differs by anything beyond the reviewed two-clause edit. */
export function planComparisonInstructions(workspace: string) {
  const file = 'lib/personal-wizard/story-writer.ts';
  const oldSource = gitAt(workspace, ['show', `${PLAN_COMPARISON_BASE}:${file}`]).toString('utf8');
  const source = gitAt(workspace, ['show', `HEAD:${file}`]).toString('utf8');
  const menu = ": a boundary, requesting closeness/help, preparing for uncertainty or trying a different idea";
  const ending = 'End with a modest observable step, not a claim that fear vanished.';
  if (oldSource.split(menu).length !== 2 || oldSource.split(ending).length !== 2 ||
    oldSource.replace(menu, '').replace(ending, 'Do not claim that fear vanished.') !== source) hostFail('instruction_delta');
  const old = /export const RESILIENCE_INSTRUCTIONS = `([^`]+)`;/.exec(oldSource)?.[1];
  if (!old || old.includes('${') || CAUSAL_PLAN_INSTRUCTIONS.split(RESILIENCE_INSTRUCTIONS).length !== 2) hostFail('instruction_delta');
  return { old: CAUSAL_PLAN_INSTRUCTIONS.replace(RESILIENCE_INSTRUCTIONS, old), current: CAUSAL_PLAN_INSTRUCTIONS };
}

export function createPlanComparison(args: { workspace: string; outputRoot: string; request: unknown;
  policy: unknown; signal: AbortSignal;
  injected?: { commonDir: string; assertSource(): void; transport: Transport; instructions: { old: string; current: string } };
}) {
  const parsed = planComparisonPolicySchema.safeParse(args.policy);
  if (!parsed.success) hostFail('policy');
  const policy = structuredClone(parsed.data), signal = args.signal;
  if ((policy.mode === 'offline_injected') !== Boolean(args.injected)) hostFail('authorization');
  if (policy.mode === 'live_explicit' && (Date.now() - Date.parse(policy.pricing.checkedAt) > 86_400_000 ||
    Date.parse(policy.pricing.checkedAt) > Date.now())) hostFail('pricing_stale');
  if (![args.workspace, args.outputRoot, policy.executable].every(p => path.isAbsolute(p))) hostFail('directory');
  const sourceCheck = args.injected?.assertSource ?? (() => {
    if (gitAt(args.workspace, ['rev-parse', 'HEAD']).toString().trim() !== policy.sourceHead ||
      gitAt(args.workspace, ['status', '--porcelain']).toString().trim()) hostFail('source_changed');
  });
  sourceCheck();
  const commonDir = args.injected?.commonDir ?? gitAt(args.workspace, ['rev-parse', '--path-format=absolute', '--git-common-dir']).toString().trim();
  realDirectory(commonDir); realDirectory(args.workspace); realDirectory(path.dirname(args.outputRoot));
  const prepared = preparePersonalStory(structuredClone(args.request), resolvePersonalWizardOptions());
  if (prepared.brief.beats !== 8 || policy.approval.requestId !== prepared.accepted.requestId ||
    policy.approval.requestDigest !== causalDigest(prepared.accepted.canonical) ||
    policy.approval.optionsFingerprint !== prepared.accepted.optionsFingerprint) hostFail('request_binding');
  const instructions = args.injected?.instructions ?? planComparisonInstructions(args.workspace);
  // Reference-bound family is not caller-selectable. Replaying the same approval consumes no further allowance.
  const family = `plan-ab-${causalDigest(policy.approval).slice(0, 32)}`;
  const arms = ['old', 'old', 'current', 'current'] as const;
  const order: Array<typeof arms[number]> = [...arms];
  for (let i = order.length - 1; i > 0; i--) { const j = randomInt(i + 1); [order[i], order[j]] = [order[j], order[i]]; }
  const slots = order.map((arm, i) => ({ id: `case${i + 1}:plan`, arm, capMicroUsd: 1_500_000 }));
  const rate = { inputMicroUsdPerToken: policy.pricing.inputMicroUsdPerToken, outputMicroUsdPerToken: policy.pricing.outputMicroUsdPerToken };
  // The unused Astra rate is a WirePolicy type requirement, not an Astra factory or credential.
  const wirePolicy: WirePolicy = { workspace: args.workspace, executable: policy.executable, executableSha256: policy.executableSha256,
    maxWireBytes: 104_000, rates: { opus: rate, astra: rate } };
  const calls = slots.map(slot => {
    const call: CausalDispatch = { role: 'opus', stage: 'plan', conversationKey: `${family}:${slot.id}`,
      input: canonicalJson({ brief: prepared.brief, priorRejection: null }), instructions: instructions[slot.arm],
      schema: causalPlanSchema(prepared), maxOutputTokens: personalStoryOutputLimits(prepared.brief.beats).planOutputTokens + 6000 };
    const instructionFile = path.join(commonDir, 'codex-causal-text-trials', family, `instructions-${slot.id.replace(':', '-')}.txt`);
    return { slot, call, wire: prepareCausalWire(call, wirePolicy, slot.capMicroUsd, instructionFile) };
  });
  const manifest = { policy, family, baselineHead: PLAN_COMPARISON_BASE, slots, inputDigest: causalDigest(calls[0].call.input),
    instructions: { old: causalDigest(instructions.old), current: causalDigest(instructions.current) },
    model: CAUSAL_MODELS.opus, effort: 'medium', maximumLogicalDispatches: 4, reservedMicroUsd: 6_000_000,
    totalApprovedMicroUsd: 8_000_000, separateIndependentReviewAllowanceMicroUsd: 2_000_000,
    freshProcessPerPlan: true, retry: false, runtimeEligible: false,
    accounting: 'cli_reported_estimate_not_invoice', invoiceCapGuaranteed: false, nativeInternalCallCount: 'unverified' };
  const digest = causalDigest(manifest), rows: Array<{ slot: string; attempted: boolean; receipt: TransportReply | null }> = [];
  let phase: 'ready' | 'running' | 'complete' | 'failed' = 'ready';
  let journal: CausalFamilyJournal | null = null, reason: string | null = null;
  const snapshot = () => structuredClone({ family, phase, reason, rows, runtimeEligible: false,
    accounting: { kind: 'cli_reported_estimate_not_invoice', reservedMicroUsd: 6_000_000,
      logicalAttempts: rows.filter(r => r.attempted).length,
      knownEstimateMicroUsd: rows.reduce((n, r) => n + (knownCost(r.receipt?.estimatedMicroUsd) ? r.receipt!.estimatedMicroUsd! : 0), 0),
      unknownAttemptCosts: rows.filter(r => r.attempted && !knownCost(r.receipt?.estimatedMicroUsd)).length } });
  const active = () => { if (signal.aborted) hostFail('cancelled'); sourceCheck(); journal?.assertActive(); };
  return { snapshot,
    async run() {
      if (phase !== 'ready') hostFail('phase');
      phase = 'running';
      try {
        active();
        journal = CausalFamilyJournal.reserve({ commonDir, outputRoot: args.outputRoot, family, coordinatorDigest: digest,
          maximumMicroUsd: 6_000_000, slots, manifest });
        // Only construct the Opus transport after the immutable four-slot reservation.
        const transport = args.injected?.transport ?? createOpusCausalTransport(wirePolicy);
        const plans: Array<{ label: number; plan: ReturnType<typeof compileCausalPlan> }> = [];
        for (let i = 0; i < calls.length; i++) {
          active(); journal.verifyRecords();
          const { slot, call, wire } = calls[i];
          journal.claim(family, digest, slot.id); journal.instructions(slot.id, call.instructions);
          journal.dispatch(slot.id, { sourceHead: policy.sourceHead, wire, conversationKey: call.conversationKey });
          const row = { slot: slot.id, attempted: false, receipt: null as TransportReply | null }; rows.push(row);
          active(); row.attempted = true;
          try { row.receipt = structuredClone(await transport(wire, call, signal)); }
          catch (error) {
            if (error instanceof CausalTransportError) row.receipt = { ...structuredClone(error.receipt), output: null };
            journal.settle(slot.id, row); throw error;
          }
          journal.settle(slot.id, row); // Preserve even inadmissible/unknown-cost receipts before stopping.
          const cost = row.receipt.estimatedMicroUsd;
          if (cost === null || !Number.isSafeInteger(cost) || cost < 0 || cost > slot.capMicroUsd) hostFail('cost');
          active();
          const plan = compileCausalPlan(prepared, row.receipt.output);
          journal.save(`plan-${i + 1}`, plan); plans.push({ label: i + 1, plan });
          if (plan.disposition !== 'selected') hostFail('plan_not_selected');
        }
        active(); journal.save('blind-plans', { instruction: 'Four outlines, not manuscripts or proof of consistent quality.', plans });
        journal.save('accounting', snapshot().accounting); journal.verifyRecords();
        journal.seal('completed_diagnostic'); phase = 'complete'; return plans;
      } catch (error) {
        phase = 'failed'; reason = error instanceof CausalHostError ? error.code : 'comparison_failed';
        if (journal) { try { journal.save('failed-accounting', snapshot().accounting); } catch { /* terminal regardless */ } journal.seal(reason); }
        throw new CausalHostError(reason);
      }
    },
  };
}
