import 'server-only';
import type { PersonalWizardOptions } from './options';
import { prepareSimpleStory, writeSimpleStory, compileSimpleStory, type SimpleStoryCall } from './simple-story-engine';
import { createCurrentSimpleStorySource, createRepairedSimpleStorySource, prepareSimpleStoryRepair,
  simpleStoryFindingIsMaterial, type CurrentSimpleStoryResult } from './simple-story-source';
import { CausalExperimentError, causalReviewPackets, causalSourceReviewPacket, compileCausalSourceReading, type CausalReading } from './story-causal-experiment';
import { preparePersonalStory } from './story-writer';
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
  /** Opt-in focused repair of this source's held storyboard (same contracts, calls and caps); absent keeps the exact existing calls. */
  storyboardRepair?: StoryboardRepair;
  /**
   * Opt-in (same-book recovery, 2026-10-18): a reading whose settled answer failed ONLY its source evidence gets this one constrained citation
   * correction (story-source-citations-correction/v1); the returned answer is compiled again under the same strict check. Absent: unchanged.
   */
  correctReading?: (stage: SimpleBookReadingCall['stage'], numbered: ReturnType<typeof causalSourceReviewPacket>, raw: unknown, signal: AbortSignal) => Promise<unknown>;
}) {
  const prepared = prepareSimpleStory(args.request, args.options, args.seed);
  if (prepared.book.pages !== 8 || prepared.accepted.containsFixtureData || prepared.accepted.canonical.appearance.photo !== 'none') fail('simple_book_request');
  const records: Partial<Record<'author' | 'editor', TransportReply>> = {};
  const view = emptySimpleBookView(prepared.accepted.requestId);
  const repair = args.repair ? prepareSimpleStoryRepair(args.request, args.repair.prior, args.repair.readings, args.options) : null;
  if (repair && repair.prepared.seed !== args.seed) fail('simple_book_repair_seed');
  const bindingValue = () => ({ request: args.request, options: args.options, seed: args.seed, ...(args.repair ? { repair: args.repair } : {}) });
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
  }, { model: CAUSAL_MODELS.opus, reservedUsd: args.reservedWritingUsd });
  check();
  source = createCurrentSimpleStorySource(args.request, generated, records as Record<'author' | 'editor', TransportReply>, args.options);
  }
  view.edited = { title: source.manuscript.title, pages: source.manuscript.pages };
  publish('story_review');
  const original = compileSimpleStory(prepared, repair?.priorEvidence.edited ?? generated.evidence.draft, source.accounting, !!repair);
  const document = (result: typeof original) => ({ plan: result.plan, manuscript: result.manuscript,
    characterDigest: prepared.brief.companion.characterDigest });
  const packets = causalReviewPackets(preparePersonalStory(args.request, args.options), document(original), document(source));
  const readings: CausalReading[] = [];
  // Final-only judgment precedes comparison; neither gets the editor's claims.
  for (const [name, packet] of [['final_review', packets.final], ['comparison', packets.comparison]] as const) {
    check(); const numbered = causalSourceReviewPacket(packet);
    const call = { stage: name, instructions: numbered.instructions,
      input: canonicalJson({ packetDigest: numbered.packetDigest, packet: numbered.packet }), schema: numbered.schema, maxOutputTokens: 16000 };
    const raw = await args.reader(call, args.signal); check();
    let reading: CausalReading;
    try { reading = compileCausalSourceReading(packet, raw); }
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
  if (material) { publish('held'); return { status: 'story_held' as const, source, generated, readings, storyboard: null, runtimeEligible: false as const }; }
  publish('storyboard');
  const storyboard = await runSimpleStoryboardDiagnostic({ request: args.request, writerResult: source,
    options: args.options, signal: args.signal, actorOwnedAppearance: args.actorOwnedAppearance,
    ...(args.momentContract ? { momentContract: true as const } : {}), ...(args.landmarkKindContract ? { landmarkKindContract: true as const } : {}),
    ...(args.sceneLocationContract ? { sceneLocationContract: true as const } : {}),
    ...(args.compilerRulesContract ? { compilerRulesContract: true as const } : {}),
    ...(args.drawnInstantContract ? { drawnInstantContract: true as const } : {}),
    ...(args.visibleMomentContract ? { visibleMomentContract: true as const } : {}),
    ...(args.selfCheckContract ? { selfCheckContract: true as const } : {}),
    ...(args.reviewImpactPolicy ? { reviewImpactPolicy: true as const } : {}),
    ...(args.storyboardRepair ? { repair: args.storyboardRepair } : {}),
    generate: async (call, signal) => {
      publish(call.stage === 'storyboard' ? 'storyboard' : 'storyboard_review');
      const raw = await args.visual(call, signal); check(); return raw;
    } });
  check();
  // A storyboard supported with bound detail notes (typed policy only) proceeds like a supported one; its packets carry the notes.
  publish(storyboard.status === 'review_supported' || storyboard.status === 'review_supported_with_notes' ? 'references_required' : 'held');
  return { status: storyboard.status, source, generated, readings, storyboard, runtimeEligible: false as const };
}
