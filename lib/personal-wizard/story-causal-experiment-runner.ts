import 'server-only';
import type { ZodTypeAny } from 'zod';
import { canonicalJson } from './request-acceptance';
import { preparePersonalStory, RESILIENCE_INSTRUCTIONS } from './story-writer';
import { personalStoryOutputLimits } from './story-config';
import type { PersonalWizardOptions } from './options';
import { withGenerationDeadline } from './generation-deadline';
import { measureStoryText } from './story-text-metrics';
import type { StoryReviewDocument } from './story-text-review';
import { CAUSAL_EXPERIMENT_VERSION, CAUSAL_PLAN_INSTRUCTIONS, CAUSAL_STORY_INSTRUCTIONS, CAUSAL_NARRATIVE_CRAFT_INSTRUCTIONS, CausalExperimentError, causalDigest, causalFail,
  causalPlanSchema, compileCausalPlan, causalAuthorSchema, compileCausalOriginal, causalEditorCall, causalEditorSchema,
  compileCausalEdit, causalReviewPackets, causalCriticSchema, compileCausalReading, type CausalPlan } from './story-causal-experiment';

export const CAUSAL_STAGES = ['plan', 'replan', 'author', 'editor', 'original_review', 'final_review', 'comparison'] as const;
export type CausalStage = typeof CAUSAL_STAGES[number];
export type CausalDispatch = { role: 'opus' | 'astra'; stage: CausalStage; conversationKey: string;
  input: string; instructions: string; schema: ZodTypeAny; maxOutputTokens: number };
/** No default provider, key, CLI, network or implicit live authorization. */
export type CausalExperimentPorts = {
  reserve(family: string, manifestDigest: string, maximumMicroUsd: number, slots: readonly { id: string; capMicroUsd: number }[]): Promise<boolean>;
  claim(family: string, manifestDigest: string, slotId: string): Promise<boolean>;
  generate(call: CausalDispatch, signal: AbortSignal): Promise<{ output: unknown; estimatedMicroUsd: number | null }>;
};
type Receipt = { slot: string; role: CausalDispatch['role']; inputDigest: string; capMicroUsd: number;
  attempted: boolean; estimatedMicroUsd: number | null; output?: unknown };
type CohortReview = { sourceDigest: string; decisions: { caseId: string; decision: 'write' | 'hold'; reason: string }[] };

/** A single process-local diagnostic coordinator. Durable family/slot exclusion is the host port's obligation. */
export function createCausalExperiment(args: {
  family: string; cases: { id: string; request: unknown }[]; options: PersonalWizardOptions;
  capsMicroUsd: Record<CausalStage, number>; maximumMicroUsd: number; ports: CausalExperimentPorts; signal: AbortSignal;
}) {
  const caps = structuredClone(args.capsMicroUsd), signal = args.signal;
  if (!/^[a-z0-9][a-z0-9_-]{2,100}$/.test(args.family) || !args.cases.length || args.cases.length > 6 ||
    new Set(args.cases.map(c => c.id)).size !== args.cases.length || args.cases.some(c => !/^case[1-6]$/.test(c.id)) ||
    Object.keys(caps).sort().join() !== [...CAUSAL_STAGES].sort().join() ||
    CAUSAL_STAGES.some(s => !Number.isSafeInteger(caps[s]) || caps[s] <= 0) ||
    !Number.isSafeInteger(args.maximumMicroUsd) || args.maximumMicroUsd <= 0) causalFail('reservation_invalid');
  // Rebuild from accepted requests; never trust a supplied detached prepared brief.
  const cases = args.cases.map(c => ({ id: c.id, prepared: preparePersonalStory(structuredClone(c.request), args.options) }));
  const slots = cases.flatMap(c => CAUSAL_STAGES.map(stage => ({ id: `${c.id}:${stage}`, capMicroUsd: caps[stage] })));
  const maximum = slots.reduce((n, s) => n + s.capMicroUsd, 0);
  if (!Number.isSafeInteger(maximum) || maximum > args.maximumMicroUsd) causalFail('reservation_invalid');
  const manifest = { version: CAUSAL_EXPERIMENT_VERSION, family: args.family,
    cases: cases.map(c => ({ id: c.id, requestDigest: causalDigest(c.prepared.accepted.canonical), briefDigest: causalDigest(c.prepared.brief) })), slots };
  const manifestDigest = causalDigest(manifest), family = args.family, ports = args.ports;
  const receipts: Receipt[] = [], plans: { caseId: string; attempts: CausalPlan[] }[] = [];
  let phase: 'new' | 'planning' | 'planned' | 'reviewed' | 'writing' | 'complete' | 'failed' = 'new';
  let review: CohortReview | null = null;
  const snapshot = () => structuredClone({ manifest, manifestDigest, phase, plans, review, receipts,
    accounting: { kind: 'caller_reported_estimate_not_invoice', maximumMicroUsd: maximum,
      logicalAttempts: receipts.filter(r => r.attempted).length,
      knownEstimateMicroUsd: receipts.reduce((n, r) => n + (r.estimatedMicroUsd ?? 0), 0),
      unknownAttemptCosts: receipts.filter(r => r.attempted && r.estimatedMicroUsd === null).length }, runtimeEligible: false });
  const current = () => { if (signal.aborted) causalFail('cancelled'); };
  async function dispatch(caseId: string, stage: CausalStage, call: Omit<CausalDispatch, 'role' | 'stage' | 'conversationKey'>) {
    current();
    if (Buffer.byteLength(call.input + call.instructions, 'utf8') > 104_000) causalFail('input_limit');
    const slot = `${caseId}:${stage}`;
    if (receipts.some(r => r.slot === slot)) causalFail('slot_reused');
    if (!await ports.claim(family, manifestDigest, slot)) causalFail('slot_claim_denied');
    const role = ['plan', 'replan', 'author', 'editor'].includes(stage) ? 'opus' : 'astra';
    const receipt: Receipt = { slot, role, inputDigest: causalDigest({ stage, input: call.input, instructions: call.instructions }),
      capMicroUsd: caps[stage], attempted: false, estimatedMicroUsd: null };
    receipts.push(receipt);
    current();
    const reply = await withGenerationDeadline(call.maxOutputTokens, signal,
      reason => new CausalExperimentError(reason), stageSignal => {
        receipt.attempted = true;
        return ports.generate({ ...call, stage, role, conversationKey: `${family}:${slot}` }, stageSignal);
      });
    current();
    receipt.output = structuredClone(reply.output);
    const cost = reply.estimatedMicroUsd;
    if (cost === null) return causalFail('cost_unknown');
    if (!Number.isSafeInteger(cost) || cost < 0) causalFail('cost_invalid');
    receipt.estimatedMicroUsd = cost;
    if (cost > receipt.capMicroUsd) causalFail('cost_overrun');
    return reply.output;
  }
  const bundle = () => ({ manifestDigest, plans: plans.map(row => ({ caseId: row.caseId, attempts: row.attempts })) });
  const readSynopses = () => structuredClone({ ...bundle(), sourceDigest: causalDigest(bundle()),
    instructions: 'Read ALL proposed synopses together before prose. Compare wants, complications, discoveries and solutions for weak or repetitive ideas; changing scenery is not variation. Hold weak/repetitive proposals, not a quota of locations or emotions. This is diagnostic editorial review, not product acceptance.' });
  async function plan() {
    if (phase !== 'new') causalFail('phase');
    phase = 'planning';
    try {
      current();
      if (!await ports.reserve(family, manifestDigest, maximum, structuredClone(slots))) causalFail('reservation_denied');
      current();
      for (const c of cases) {
        const row = { caseId: c.id, attempts: [] as CausalPlan[] }; plans.push(row);
        for (const stage of ['plan', 'replan'] as const) {
          const raw = await dispatch(c.id, stage, { instructions: CAUSAL_PLAN_INSTRUCTIONS,
            input: canonicalJson({ brief: c.prepared.brief, priorRejection: row.attempts[0] ?? null }),
            schema: causalPlanSchema(c.prepared), maxOutputTokens: personalStoryOutputLimits(c.prepared.brief.beats).planOutputTokens + 6000 });
          const outcome = compileCausalPlan(c.prepared, raw); row.attempts.push(structuredClone(outcome));
          // No retry for malformed, transport, cost, binding or outline-HOLD errors.
          if (outcome.disposition !== 'both_rejected') break;
        }
      }
      current(); phase = 'planned'; return readSynopses();
    } catch (error) { phase = 'failed'; throw sanitise(error); }
  }
  function reviewSynopses(value: CohortReview) {
    current();
    if (phase !== 'planned') causalFail('phase');
    if (value.sourceDigest !== causalDigest(bundle()) || value.decisions.length !== cases.length ||
      new Set(value.decisions.map(d => d.caseId)).size !== cases.length || value.decisions.some(d =>
        !cases.some(c => c.id === d.caseId) || !['write', 'hold'].includes(d.decision) ||
        typeof d.reason !== 'string' || d.reason.trim().length < 10 || d.reason.length > 600 ||
        (d.decision === 'write' && last(plans.find(p => p.caseId === d.caseId)?.attempts ?? [])?.disposition !== 'selected'))) causalFail('cohort_binding');
    review = structuredClone(value); phase = 'reviewed';
  }
  async function write() {
    current();
    if (phase !== 'reviewed' || !review) return causalFail('phase');
    const approved = review;
    phase = 'writing';
    const books = [];
    try {
      for (const c of cases) {
        if (approved.decisions.find(d => d.caseId === c.id)?.decision !== 'write') continue;
        const chosen = last(plans.find(p => p.caseId === c.id)!.attempts)!;
        if (!('planningDigest' in chosen) || chosen.disposition !== 'selected') return causalFail('plan_binding');
        const rawOriginal = await dispatch(c.id, 'author', { instructions: `${CAUSAL_STORY_INSTRUCTIONS}\n${RESILIENCE_INSTRUCTIONS}\n${CAUSAL_NARRATIVE_CRAFT_INSTRUCTIONS}`,
          input: canonicalJson({ brief: c.prepared.brief, plan: chosen.plan, planDigest: chosen.planDigest,
            synopsis: chosen.synopsis, backwardDependencies: chosen.backwardDependencies,
            task: 'Write the entire Hebrew adventure, one COMPLETE text per ordered beat through earned resolution. No pageNumber metadata. Age 3 to 5 target 35 to 65 words per spread; age 6 to 8 target 45 to 85. Targets are measured separately, not quality scores. No previous story or author conversation.' }),
          schema: causalAuthorSchema(c.prepared, chosen), maxOutputTokens: personalStoryOutputLimits(c.prepared.brief.beats).manuscriptOutputTokens });
        const original = compileCausalOriginal(c.prepared, chosen, rawOriginal);
        const editor = causalEditorCall(c.prepared, original);
        const rawEdit = await dispatch(c.id, 'editor', { instructions: editor.instructions, input: editor.input,
          schema: causalEditorSchema(editor), maxOutputTokens: editor.maxOutputTokens });
        const edit = compileCausalEdit(c.prepared, original, rawEdit);
        const packets = causalReviewPackets(c.prepared, original, edit.revised);
        const readings = [];
        // Freeze both isolated readings before a comparison can be dispatched.
        for (const stage of ['original_review', 'final_review', 'comparison'] as const) {
          const key = stage === 'original_review' ? 'original' : stage === 'final_review' ? 'final' : 'comparison';
          const packet = packets[key];
          const raw = await dispatch(c.id, stage, { instructions: packet.instructions,
            input: canonicalJson({ packet, packetDigest: causalDigest(packet) }), schema: causalCriticSchema,
            maxOutputTokens: 8000 + c.prepared.brief.beats * 500 });
          readings.push(compileCausalReading(packet, raw));
        }
        books.push({ caseId: c.id, planning: structuredClone(chosen), original, edit, readings,
          originalTextMetrics: measureMetrics(original, c.prepared.brief.child.age),
          revisedTextMetrics: measureMetrics(edit.revised, c.prepared.brief.child.age), runtimeEligible: false as const });
      }
      current(); phase = 'complete'; return structuredClone({ books, evidence: snapshot(), runtimeEligible: false });
    } catch (error) { phase = 'failed'; throw sanitise(error); }
  }
  return { plan, readSynopses, reviewSynopses, write, snapshot };
}
const measureMetrics = (doc: StoryReviewDocument, age: number) => measureStoryText(doc.manuscript, age);
const last = <T>(rows: T[]) => rows[rows.length - 1];
function sanitise(error: unknown) { return error instanceof CausalExperimentError ? error : new CausalExperimentError('provider_or_contract_failed'); }
