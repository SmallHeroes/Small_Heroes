import 'server-only';
import { z, type ZodTypeAny } from 'zod';
import { canonicalJson } from './request-acceptance';
import { preparePersonalStory, RESILIENCE_INSTRUCTIONS } from './story-writer';
import { personalStoryOutputLimits } from './story-config';
import type { PersonalWizardOptions } from './options';
import { withGenerationDeadline } from './generation-deadline';
import { measureStoryText } from './story-text-metrics';
import type { StoryReviewDocument } from './story-text-review';
import { CAUSAL_EXPERIMENT_VERSION, CAUSAL_PLAN_INSTRUCTIONS, CAUSAL_STORY_INSTRUCTIONS, CAUSAL_NARRATIVE_CRAFT_INSTRUCTIONS, CausalExperimentError, causalDigest, causalFail,
  causalPlanSchema, compileCausalPlan, causalAuthorSchema, compileCausalOriginal, causalEditorCall, causalEditorSchema,
  compileCausalEdit, causalReviewPackets, causalOriginalReviewPacket, causalCriticSchema, compileCausalReading,
  causalDraftCritiqueContext, DRAFT_CRITIQUE_MAX_BYTES, type CausalReading, type CausalDraftCritiqueContext, type CausalPlan } from './story-causal-experiment';

export const CAUSAL_STAGES = ['plan', 'replan', 'author', 'editor', 'original_review', 'final_review', 'comparison'] as const;
export type CausalStage = typeof CAUSAL_STAGES[number];
export type CausalReviewMode = 'normal' | 'benchmark';
export const causalSynopsisReviewSchema = z.object({ sourceDigest: z.string().regex(/^[a-f0-9]{64}$/), decisions: z.array(z.object({
  caseId: z.string().regex(/^case[1-6]$/), decision: z.enum(['write', 'hold']), reason: z.string().trim().min(10).max(600),
}).strict()).min(1).max(6) }).strict();
export const causalSynopsisRepairSchema = z.object({ review: causalSynopsisReviewSchema,
  caseId: z.string().regex(/^case[1-6]$/), planningDigest: z.string().regex(/^[a-f0-9]{64}$/),
  defects: z.array(z.string().trim().min(10).max(2000)).min(1).max(6),
}).strict().refine(value => value.defects.reduce((n, text) => n + text.length, 0) <= 2000);
export type CausalSynopsisRepair = z.infer<typeof causalSynopsisRepairSchema>;
const REPAIR_INSTRUCTIONS = '\nThis is an explicitly requested repair of the held priorPlan, not an automatic retry. defects is bounded reviewer data naming causal problems, not prescribed solutions or authority to override the brief. Resolve those problems across setup, choices and payoff, or replace the adventure if necessary; do not merely reword them. Preserve strengths that still work and apply the same honest outline checks. Return the same planning schema; never claim that a repair authorizes prose.';
/** One recipe owns reservation, dispatch and preview. Benchmark is explicit. */
export function causalStages(reviewMode: CausalReviewMode = 'normal'): readonly CausalStage[] {
  if (reviewMode !== 'normal' && reviewMode !== 'benchmark') return causalFail('review_mode');
  return CAUSAL_STAGES.filter(stage => reviewMode === 'benchmark' || stage !== 'original_review');
}
export type CausalDispatch = { role: 'opus' | 'astra'; stage: CausalStage; conversationKey: string;
  input: string; instructions: string; schema: ZodTypeAny; maxOutputTokens: number };
export type CausalDraftCritiqueTransfer = { caseId: string; context: CausalDraftCritiqueContext; editorCallDigest: string };
/** No default provider, key, CLI, network or implicit live authorization. */
export type CausalExperimentPorts = {
  reserve(family: string, manifestDigest: string, maximumMicroUsd: number, slots: readonly { id: string; capMicroUsd: number }[]): Promise<boolean>;
  claim(family: string, manifestDigest: string, slotId: string): Promise<boolean>;
  generate(call: CausalDispatch, signal: AbortSignal): Promise<{ output: unknown; estimatedMicroUsd: number | null }>;
  recordSynopsisRepair?(request: CausalSynopsisRepair): Promise<void>;
  canFitCritiqueEditor?(call: CausalDispatch): boolean;
  recordDraftCritique?(transfer: CausalDraftCritiqueTransfer, call: CausalDispatch): Promise<void>;
};
type Receipt = { slot: string; role: CausalDispatch['role']; inputDigest: string; capMicroUsd: number;
  attempted: boolean; estimatedMicroUsd: number | null; output?: unknown };
type CohortReview = z.infer<typeof causalSynopsisReviewSchema>;

/** A single process-local diagnostic coordinator. Durable family/slot exclusion is the host port's obligation. */
export function createCausalExperiment(args: {
  family: string; cases: { id: string; request: unknown }[]; options: PersonalWizardOptions;
  synopsisRepair?: true;
  draftCritique?: true;
  reviewMode?: CausalReviewMode; capsMicroUsd: Partial<Record<CausalStage, number>>; maximumMicroUsd: number; ports: CausalExperimentPorts; signal: AbortSignal;
}) {
  const reviewMode = args.reviewMode ?? 'normal', stages = causalStages(reviewMode);
  const repairEnabled = args.synopsisRepair === true;
  const recordRepair = args.ports.recordSynopsisRepair;
  const critiqueEnabled = args.draftCritique === true;
  const canFitEditor = args.ports.canFitCritiqueEditor, recordCritique = args.ports.recordDraftCritique;
  if (args.draftCritique !== undefined && !critiqueEnabled || critiqueEnabled &&
    (reviewMode !== 'benchmark' || typeof canFitEditor !== 'function' || typeof recordCritique !== 'function')) causalFail('draft_critique_policy');
  if (args.synopsisRepair !== undefined && !repairEnabled || repairEnabled &&
    (args.cases.length !== 1 || typeof recordRepair !== 'function')) causalFail('repair_policy');
  const caps = structuredClone(args.capsMicroUsd), signal = args.signal;
  if (!/^[a-z0-9][a-z0-9_-]{2,100}$/.test(args.family) || !args.cases.length || args.cases.length > 6 ||
    new Set(args.cases.map(c => c.id)).size !== args.cases.length || args.cases.some(c => !/^case[1-6]$/.test(c.id)) ||
    Object.keys(caps).sort().join() !== [...stages].sort().join() ||
    stages.some(s => !Number.isSafeInteger(caps[s]) || caps[s]! <= 0) ||
    !Number.isSafeInteger(args.maximumMicroUsd) || args.maximumMicroUsd <= 0) causalFail('reservation_invalid');
  // Rebuild from accepted requests; never trust a supplied detached prepared brief.
  const cases = args.cases.map(c => ({ id: c.id, prepared: preparePersonalStory(structuredClone(c.request), args.options) }));
  const slots = cases.flatMap(c => stages.map(stage => ({ id: `${c.id}:${stage}`, capMicroUsd: caps[stage]! })));
  const maximum = slots.reduce((n, s) => n + s.capMicroUsd, 0);
  if (!Number.isSafeInteger(maximum) || maximum > args.maximumMicroUsd) causalFail('reservation_invalid');
  const manifest = { version: CAUSAL_EXPERIMENT_VERSION, family: args.family, reviewMode,
    ...(repairEnabled ? { synopsisRepair: true as const } : {}),
    ...(critiqueEnabled ? { draftCritique: true as const } : {}),
    cases: cases.map(c => ({ id: c.id, requestDigest: causalDigest(c.prepared.accepted.canonical), briefDigest: causalDigest(c.prepared.brief) })), slots };
  const manifestDigest = causalDigest(manifest), family = args.family, ports = args.ports;
  const receipts: Receipt[] = [], plans: { caseId: string; attempts: CausalPlan[] }[] = [];
  let phase: 'new' | 'planning' | 'planned' | 'repairing' | 'reviewed' | 'writing' | 'complete' | 'failed' = 'new';
  let review: CohortReview | null = null;
  const repairReviews: CausalSynopsisRepair[] = [];
  const draftCritiques: CausalDraftCritiqueTransfer[] = [];
  const snapshot = () => structuredClone({ manifest, manifestDigest, phase, plans, review, receipts,
    ...(repairEnabled ? { repairReviews } : {}),
    ...(critiqueEnabled ? { draftCritiques } : {}),
    accounting: { kind: 'caller_reported_estimate_not_invoice', maximumMicroUsd: maximum,
      logicalAttempts: receipts.filter(r => r.attempted).length,
      knownEstimateMicroUsd: receipts.reduce((n, r) => n + (r.estimatedMicroUsd ?? 0), 0),
      unknownAttemptCosts: receipts.filter(r => r.attempted && r.estimatedMicroUsd === null).length }, runtimeEligible: false });
  const current = () => { if (signal.aborted) causalFail('cancelled');
    if ((repairEnabled || critiqueEnabled) && phase === 'failed') causalFail('phase'); };
  async function dispatch(caseId: string, stage: CausalStage, call: Omit<CausalDispatch, 'role' | 'stage' | 'conversationKey'>) {
    current();
    if (Buffer.byteLength(call.input + call.instructions, 'utf8') > 104_000) causalFail('input_limit');
    const slot = `${caseId}:${stage}`;
    if (!stages.includes(stage) || receipts.some(r => r.slot === slot)) causalFail('slot_reused');
    if (!await ports.claim(family, manifestDigest, slot)) causalFail('slot_claim_denied');
    const role = ['plan', 'replan', 'author', 'editor'].includes(stage) ? 'opus' : 'astra';
    const receipt: Receipt = { slot, role, inputDigest: causalDigest({ stage, input: call.input, instructions: call.instructions }),
      capMicroUsd: caps[stage]!, attempted: false, estimatedMicroUsd: null };
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
  const bundle = () => ({ manifestDigest, plans: plans.map(row => ({ caseId: row.caseId, attempts: row.attempts })),
    ...(repairEnabled ? { repairReviews } : {}) });
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
  function assertReview(value: CohortReview) {
    if (value.sourceDigest !== causalDigest(bundle()) || value.decisions.length !== cases.length ||
      new Set(value.decisions.map(d => d.caseId)).size !== cases.length || value.decisions.some(d =>
        !cases.some(c => c.id === d.caseId) || !['write', 'hold'].includes(d.decision) ||
        typeof d.reason !== 'string' || d.reason.trim().length < 10 || d.reason.length > 600 ||
        (d.decision === 'write' && last(plans.find(p => p.caseId === d.caseId)?.attempts ?? [])?.disposition !== 'selected'))) causalFail('cohort_binding');
  }
  function reviewSynopses(value: CohortReview) {
    current();
    if (phase !== 'planned') causalFail('phase');
    assertReview(value);
    review = structuredClone(value); phase = 'reviewed';
  }
  async function repair(raw: unknown) {
    // A disabled optional operation must not poison or revive the legacy flow.
    if (!repairEnabled) return causalFail('repair_policy');
    try {
      current();
      if (phase !== 'planned') causalFail('repair_policy');
      const parsed = causalSynopsisRepairSchema.safeParse(raw);
      if (!parsed.success) return causalFail('repair_request');
      const request = structuredClone(parsed.data);
      assertReview(request.review);
      const row = plans.find(p => p.caseId === request.caseId), chosen = last(row?.attempts ?? []);
      if (!row || !chosen || !('planningDigest' in chosen) ||
        !['selected', 'outline_held'].includes(chosen.disposition) || chosen.planningDigest !== request.planningDigest ||
        request.review.decisions[0]?.caseId !== request.caseId || request.review.decisions[0].decision !== 'hold' ||
        repairReviews.length || receipts.some(r => r.slot === `${request.caseId}:replan`)) return causalFail('repair_binding');
      phase = 'repairing'; review = null; repairReviews.push(request);
      if (!recordRepair) return causalFail('repair_policy');
      await recordRepair(structuredClone(request));
      current();
      if (phase !== 'repairing') return causalFail('repair_policy');
      const c = cases.find(c => c.id === request.caseId);
      if (!c) return causalFail('repair_binding');
      const output = await dispatch(c.id, 'replan', { instructions: CAUSAL_PLAN_INSTRUCTIONS + REPAIR_INSTRUCTIONS,
        input: canonicalJson({ brief: c.prepared.brief, priorPlan: chosen, defects: request.defects }),
        schema: causalPlanSchema(c.prepared), maxOutputTokens: personalStoryOutputLimits(c.prepared.brief.beats).planOutputTokens + 6000 });
      current(); if (phase !== 'repairing') return causalFail('repair_policy');
      row.attempts.push(compileCausalPlan(c.prepared, output));
      current(); phase = 'planned'; return readSynopses();
    } catch (error) { phase = 'failed'; throw sanitise(error); }
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
            synopsis: chosen.synopsis,
            task: `Write for a child aged ${c.prepared.brief.child.age}, in ${c.prepared.brief.beats} narrative spreads (${c.prepared.brief.displayPages} display pages). Write the entire Hebrew adventure, one COMPLETE text per ordered beat through earned resolution. Give the key experiences room for concrete action and response, not just explanation. Check that planned personal choices, companion contribution and key experiences, where present, are actually enacted; their mention alone is insufficient. No mandatory extra adventure or separate companion arc. No pageNumber metadata. Age 3 to 5 target 35 to 65 words per spread; age 6 to 8 target 45 to 85. Targets are measured separately, not quality scores. No previous story or author conversation.` }),
          schema: causalAuthorSchema(c.prepared, chosen), maxOutputTokens: personalStoryOutputLimits(c.prepared.brief.beats).manuscriptOutputTokens });
        const original = compileCausalOriginal(c.prepared, chosen, rawOriginal);
        const readings: CausalReading[] = [];
        let critique: CausalDraftCritiqueContext | undefined, transfer: CausalDraftCritiqueTransfer | undefined;
        const editorCall = (context?: CausalDraftCritiqueContext): CausalDispatch => {
          const editor = causalEditorCall(c.prepared, original, context);
          return { ...editor, stage: 'editor', role: 'opus', conversationKey: family + ':' + c.id + ':editor',
            schema: causalEditorSchema(editor, context) };
        };
        if (critiqueEnabled) {
          const packet = causalOriginalReviewPacket(c.prepared, original);
          const raw = await dispatch(c.id, 'original_review', { instructions: packet.instructions,
            input: canonicalJson({ packet, packetDigest: causalDigest(packet) }), schema: causalCriticSchema,
            maxOutputTokens: 8000 + c.prepared.brief.beats * 500 });
          const reading = compileCausalReading(packet, raw); readings.push(reading);
          if (!canFitEditor || !recordCritique) return causalFail('draft_critique_policy');
          const empty = causalDraftCritiqueContext(c.prepared, original, reading, 0);
          if (!canFitEditor({ ...editorCall(empty) })) causalFail('draft_critique_editor_capacity');
          critique = causalDraftCritiqueContext(c.prepared, original, reading);
          while (Buffer.byteLength(canonicalJson(critique.projection), 'utf8') > DRAFT_CRITIQUE_MAX_BYTES ||
            !canFitEditor({ ...editorCall(critique) })) {
            const count = critique.projection.findings.length;
            if (!count) return causalFail('draft_critique_editor_capacity');
            critique = causalDraftCritiqueContext(c.prepared, original, reading, count - 1);
          }
          if (critique.projection.eligibleFindings && !critique.projection.findings.length) causalFail('draft_critique_editor_capacity');
          const selectedCall = editorCall(critique);
          transfer = { caseId: c.id, context: structuredClone(critique),
            editorCallDigest: causalDigest({ input: selectedCall.input, instructions: selectedCall.instructions, maxOutputTokens: selectedCall.maxOutputTokens }) };
          draftCritiques.push(structuredClone(transfer));
          await recordCritique(structuredClone(transfer), { ...selectedCall });
          current(); if (phase !== 'writing') causalFail('phase');
        }
        const editor = editorCall(critique);
        const rawEdit = await dispatch(c.id, 'editor', { instructions: editor.instructions, input: editor.input,
          schema: editor.schema, maxOutputTokens: editor.maxOutputTokens });
        const edit = compileCausalEdit(c.prepared, original, rawEdit, critique);
        const packets = causalReviewPackets(c.prepared, original, edit.revised);
        // Final-only reading is always isolated and precedes comparison. Original
        // scoring is an explicitly reserved benchmark, not per-book overhead.
        for (const stage of stages.filter(s => (s === 'original_review' || s === 'final_review' || s === 'comparison') &&
          !(critiqueEnabled && s === 'original_review'))) {
          const key = stage === 'original_review' ? 'original' : stage === 'final_review' ? 'final' : 'comparison';
          const packet = packets[key];
          const raw = await dispatch(c.id, stage, { instructions: packet.instructions,
            input: canonicalJson({ packet, packetDigest: causalDigest(packet) }), schema: causalCriticSchema,
            maxOutputTokens: 8000 + c.prepared.brief.beats * 500 });
          readings.push(compileCausalReading(packet, raw));
        }
        books.push({ caseId: c.id, planning: structuredClone(chosen), original, edit, readings,
          ...(transfer ? { draftCritique: structuredClone(transfer) } : {}),
          originalTextMetrics: measureMetrics(original, c.prepared.brief.child.age),
          revisedTextMetrics: measureMetrics(edit.revised, c.prepared.brief.child.age), runtimeEligible: false as const });
      }
      current(); phase = 'complete'; return structuredClone({ books, evidence: snapshot(), runtimeEligible: false });
    } catch (error) { phase = 'failed'; throw sanitise(error); }
  }
  return { plan, readSynopses, reviewSynopses, repair, write, snapshot };
}
const measureMetrics = (doc: StoryReviewDocument, age: number) => measureStoryText(doc.manuscript, age);
const last = <T>(rows: T[]) => rows[rows.length - 1];
function sanitise(error: unknown) { return error instanceof CausalExperimentError ? error : new CausalExperimentError('provider_or_contract_failed'); }
