import { companionScaleAuthority } from './companion-scale-authority';
import { assertEngineContinuityOptions, type EngineContinuityOptions } from './engine-continuity-contracts';
import 'server-only';
import type { PersonalWizardOptions } from './options';
import { prepareSimpleStory, writeSimpleStory, type SimpleStoryCall } from './simple-story-engine';
import { createCurrentSimpleStorySource, createRepairedSimpleStorySource, prepareSimpleStoryRepair,
  simpleStoryFindingIsMaterial, simpleStoryReadingPackets, type CurrentSimpleStoryResult, type SimpleWritingModel } from './simple-story-source';
import { CausalExperimentError, causalSourceReviewPacket, compileCausalSourceReading, compileCausalSourceReadingWithCorrection,
  type CausalReading, type CitationCorrectionCall } from './story-causal-experiment';
import type { SimpleStoryExperience } from './simple-story-experience';
import { canonicalJson } from './request-acceptance';
import { runSimpleStoryboardDiagnostic, type SimpleStoryboardDiagnosticCall } from './simple-storyboard-diagnostic';
import type { StoryboardRepair } from './storyboard-repair';
import { emptySimpleBookView, type SimpleBookView } from './simple-book-view';
import { CAUSAL_MODELS, type TransportReply } from '../../scripts/personal-causal-trial-adapters';

export class SimpleBookFlowError extends Error { constructor(readonly code: string) { super(code); } }
const fail = (code: string): never => { throw new SimpleBookFlowError(code); };
export type SimpleBookReadingCall = { stage: 'final_review' | 'comparison'; instructions: string; input: string;
  schema: ReturnType<typeof causalSourceReviewPacket>['schema']; maxOutputTokens: number };
/** Injected local diagnostic. No client, key, images, source promotion or production default. */
export async function runSimpleWizardBook(args: {
  request: unknown; options: PersonalWizardOptions; seed: string; signal: AbortSignal;
  opus: (call: SimpleStoryCall, signal: AbortSignal) => Promise<TransportReply>;
  /** Explicit prospective writer route; absence keeps the historical CLI/Opus source contract. */
  writingModel?: SimpleWritingModel;
  /** Prospective literary contract for new sources only; repair inherits its frozen source policy. No default upgrade. */
  storyExperience?: SimpleStoryExperience;
  /** Prospective review-only transport headroom; never changes planner or semantic criteria. */
  reviewCapacity?: import('./storyboard-review-capacity').StoryboardReviewCapacity;
  reader: (call: SimpleBookReadingCall, signal: AbortSignal) => Promise<unknown>;
  visual: (call: SimpleStoryboardDiagnosticCall, signal: AbortSignal) => Promise<unknown>;
  publish: (view: SimpleBookView) => void; reservedWritingUsd: number;
  repair?: { prior: unknown; readings: unknown[] };
  actorOwnedAppearance?: true;
  /** Opt-in storyboard contracts (drawn instant, declared landmark kinds, scene visits by planned location); absent keeps the exact existing calls. */
  momentContract?: true; landmarkKindContract?: true; sceneLocationContract?: true; compilerRulesContract?: true; drawnInstantContract?: true;
  /** Opt-in visible-moment instruction contract (needs the moments contract); absent keeps the exact existing calls. */
  visibleMomentContract?: true;
  /** Opt-in planner self-check (needs the moments contract) and typed review materiality; absent keeps the exact existing calls. */
  selfCheckContract?: true; reviewImpactPolicy?: true;
  /** Opt-in compile-level self-check section-name resolution (storyboard-self-check-names/v1); absent keeps the exact compile. */
  selfCheckNames?: true;
  /** Prospective source-span evidence binding; absent preserves the historical compiler. */
  selfCheckSourceSpans?: true;
  /** Opt-in claim basis (storyboard-claim-basis/v1); absent keeps the exact existing calls. */
  claimBasisContract?: true;
  /** Opt-in compile-level claim-basis staging fields (storyboard-claim-basis-staging-fields/v1); absent keeps the exact compile and review. */
  stagingFields?: true;
  /** Opt-in calibration (storyboard-calibration/v1; needs the claim basis); absent keeps the exact existing calls. */
  calibrationContract?: true;
  /** Opt-in presence (storyboard-presence/v1; needs the calibration); absent keeps the exact existing calls. */
  presenceContract?: true;
  stateParityContract?: true;
  /** Opt-in instance distinction (instance-distinction/v1; needs the landmark-kind contract); absent keeps the exact existing calls. */
  instanceDistinctionContract?: true; engineContinuity?: EngineContinuityOptions;
  /** Opt-in focused repair of this source's held storyboard (same contracts, calls and caps); absent keeps the exact existing calls. */
  storyboardRepair?: StoryboardRepair;
  /**
   * Opt-in (same-book recovery, 2026-10-18): a reading whose settled answer failed ONLY its source evidence gets this one constrained citation
   * correction (story-source-citations-correction/v1); the returned answer is compiled again under the same strict check. Absent: unchanged.
   */
  correctReading?: (stage: SimpleBookReadingCall['stage'], numbered: ReturnType<typeof causalSourceReviewPacket>, raw: unknown, signal: AbortSignal) => Promise<unknown>;
  /**
   * Opt-in general citation recovery (2026-10-25): the caller supplies only the dispatcher; the shared helper sends at most ONE bounded
   * correction per reading, only for refused references, and returns its provenance. Exclusive with correctReading. Absent: unchanged.
   */
  citationCorrector?: (stage: SimpleBookReadingCall['stage'], call: CitationCorrectionCall, signal: AbortSignal) => Promise<unknown>;
}) {
  assertEngineContinuityOptions(args.engineContinuity, args.instanceDistinctionContract);
  if (args.citationCorrector && args.correctReading) fail('simple_book_citation_correction_route');
  const repair = args.repair ? prepareSimpleStoryRepair(args.request, args.repair.prior, args.repair.readings, args.options) : null;
  const prepared = repair?.prepared ?? prepareSimpleStory(args.request, args.options, args.seed, args.storyExperience);
  if (args.engineContinuity?.companionScale) companionScaleAuthority(prepared.accepted.canonical.companion.id);
  if (repair && args.storyExperience !== undefined && prepared.book.storyExperience !== args.storyExperience) fail('simple_book_repair_policy');
  if (prepared.book.pages !== 8 || prepared.accepted.containsFixtureData || prepared.accepted.canonical.appearance.photo !== 'none') fail('simple_book_request');
  const records: Partial<Record<'author' | 'editor', TransportReply>> = {};
  const view = emptySimpleBookView(prepared.accepted.requestId);
  if (repair && repair.prepared.seed !== args.seed) fail('simple_book_repair_seed');
  if (repair && args.writingModel && repair.prior.accounting.model !== args.writingModel) fail('simple_book_repair_model');
  const bindingValue = () => ({ request: args.request, options: args.options, seed: args.seed, ...(args.repair ? { repair: args.repair } : {}),
    ...(args.writingModel ? { writingModel: args.writingModel } : {}), ...(args.reviewCapacity ? { reviewCapacity: args.reviewCapacity } : {}),
    ...(args.storyExperience ? { storyExperience: args.storyExperience } : {}),
    ...(args.engineContinuity ? { engineContinuity: args.engineContinuity } : {}) });
  const binding = canonicalJson(bindingValue());
  const check = () => {
    if (args.signal.aborted) fail('simple_book_cancelled');
    if (canonicalJson(bindingValue()) !== binding) fail('simple_book_source_changed');
  };
  const publish = (phase: SimpleBookView['phase']) => { check(); view.phase = phase; args.publish(structuredClone(view)); };
  check();
  let generated: Awaited<ReturnType<typeof writeSimpleStory>>, source: CurrentSimpleStoryResult;
  if (repair) {
    view.baseline = 'previous_edit';
    view.original = { title: repair.prior.manuscript.title, pages: repair.prior.manuscript.pages };
    publish('editor');
    const receipt = await args.opus(repair.call, args.signal); check();
    if (receipt.estimatedMicroUsd === null || !receipt.usage) return fail('simple_book_writing_cost_unknown');
    ({ source, generated } = createRepairedSimpleStorySource(args.request, repair.prior, repair.readings, receipt,
      args.options, args.reservedWritingUsd));
  } else {
  generated = await writeSimpleStory(prepared, async call => {
    publish(call.stage);
    const receipt = await args.opus(call, args.signal); check(); records[call.stage] = receipt;
    if (receipt.estimatedMicroUsd === null || !receipt.usage) return fail('simple_book_writing_cost_unknown');
    if (call.stage === 'author') {
      const draft = call.schema.parse(receipt.output);
      view.original = { title: draft.title, pages: draft.pages.map((p: { text: string }, i: number) => ({ pageNumber: i + 1, text: p.text })) };
    }
    return { output: receipt.output, usage: receipt.usage, estimatedUsd: receipt.estimatedMicroUsd / 1e6 };
  }, { model: args.writingModel ?? CAUSAL_MODELS.opus, reservedUsd: args.reservedWritingUsd });
  check();
  source = createCurrentSimpleStorySource(args.request, generated, records as Record<'author' | 'editor', TransportReply>, args.options, args.writingModel);
  }
  view.edited = { title: source.manuscript.title, pages: source.manuscript.pages };
  publish('story_review');
  const packets = simpleStoryReadingPackets(args.request, source, args.options);
  const readings: CausalReading[] = [], citationCorrections: { stage: SimpleBookReadingCall['stage']; provenance: unknown }[] = [];
  const correctionRecord = () => citationCorrections.length ? { citationCorrections: structuredClone(citationCorrections) } : {};
  // Final-only judgment precedes comparison; neither gets the editor's claims.
  for (const [name, packet] of [['final_review', packets.final], ['comparison', packets.comparison]] as const) {
    check(); const numbered = causalSourceReviewPacket(packet);
    const call = { stage: name, instructions: numbered.instructions,
      input: canonicalJson({ packetDigest: numbered.packetDigest, packet: numbered.packet }), schema: numbered.schema, maxOutputTokens: 16000 };
    const raw = await args.reader(call, args.signal); check();
    let reading: CausalReading;
    if (args.citationCorrector) {
      const result = await compileCausalSourceReadingWithCorrection(packet, raw, async call => {
        const answer = await args.citationCorrector!(name, call, args.signal); check(); return answer;
      });
      reading = result.reading;
      if (result.citationCorrection) citationCorrections.push({ stage: name, provenance: result.citationCorrection });
    } else try { reading = compileCausalSourceReading(packet, raw); }
    catch (error) {
      if (!args.correctReading || !(error instanceof CausalExperimentError) || error.code !== 'critic_evidence') throw error;
      const corrected = await args.correctReading(name, numbered, raw, args.signal); check();
      reading = compileCausalSourceReading(packet, corrected);
    }
    readings.push(reading);
    view.readings = readings.map(r => ({ stage: r.stage as 'final_review' | 'comparison', summary: r.summary, findings: r.findings }));
    publish('story_review');
  }
  const material = readings.some(r => r.findings.some(simpleStoryFindingIsMaterial));
  if (material) { publish('held'); return { status: 'story_held' as const, source, generated, readings, storyboard: null, runtimeEligible: false as const, ...correctionRecord() }; }
  publish('storyboard');
  const storyboard = await runSimpleStoryboardDiagnostic({ request: args.request, writerResult: source,
    options: args.options, signal: args.signal, actorOwnedAppearance: args.actorOwnedAppearance, reviewCapacity: args.reviewCapacity,
    ...(args.momentContract ? { momentContract: true as const } : {}), ...(args.landmarkKindContract ? { landmarkKindContract: true as const } : {}),
    ...(args.sceneLocationContract ? { sceneLocationContract: true as const } : {}),
    ...(args.compilerRulesContract ? { compilerRulesContract: true as const } : {}),
    ...(args.drawnInstantContract ? { drawnInstantContract: true as const } : {}),
    ...(args.visibleMomentContract ? { visibleMomentContract: true as const } : {}),
    ...(args.selfCheckContract ? { selfCheckContract: true as const } : {}),
    ...(args.reviewImpactPolicy ? { reviewImpactPolicy: true as const } : {}),
    ...(args.selfCheckNames ? { selfCheckNames: true as const } : {}),
    ...(args.selfCheckSourceSpans ? { selfCheckSourceSpans: true as const } : {}),
    ...(args.claimBasisContract ? { claimBasisContract: true as const } : {}),
    ...(args.stagingFields ? { stagingFields: true as const } : {}),
    ...(args.calibrationContract ? { calibrationContract: true as const } : {}),
    ...(args.presenceContract ? { presenceContract: true as const } : {}),
    ...(args.stateParityContract ? { stateParityContract: true as const } : {}),
    ...(args.instanceDistinctionContract ? { instanceDistinctionContract: true as const } : {}),
    ...(args.engineContinuity ? { engineContinuity: args.engineContinuity } : {}),
    ...(args.storyboardRepair ? { repair: args.storyboardRepair } : {}),
    generate: async (call, signal) => {
      publish(call.stage === 'storyboard' ? 'storyboard' : 'storyboard_review');
      const raw = await args.visual(call, signal); check(); return raw;
    } });
  check();
  // A storyboard supported with bound detail notes (typed policy only) proceeds like a supported one; its packets carry the notes.
  publish(storyboard.status === 'review_supported' || storyboard.status === 'review_supported_with_notes' ? 'references_required' : 'held');
  return { status: storyboard.status, source, generated, readings, storyboard, runtimeEligible: false as const, ...correctionRecord() };
}
