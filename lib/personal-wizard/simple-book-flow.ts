import 'server-only';
import type { PersonalWizardOptions } from './options';
import { prepareSimpleStory, writeSimpleStory, compileSimpleStory, type SimpleStoryCall } from './simple-story-engine';
import { createCurrentSimpleStorySource } from './simple-story-source';
import { causalReviewPackets, causalSourceReviewPacket, compileCausalSourceReading, type CausalReading } from './story-causal-experiment';
import { preparePersonalStory } from './story-writer';
import { canonicalJson } from './request-acceptance';
import { runSimpleStoryboardDiagnostic, type SimpleStoryboardDiagnosticCall } from './simple-storyboard-diagnostic';
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
}) {
  const prepared = prepareSimpleStory(args.request, args.options, args.seed);
  if (prepared.book.pages !== 8 || prepared.accepted.containsFixtureData || prepared.accepted.canonical.appearance.photo !== 'none') fail('simple_book_request');
  const records: Partial<Record<'author' | 'editor', TransportReply>> = {};
  const view = emptySimpleBookView(prepared.accepted.requestId);
  const binding = canonicalJson({ request: args.request, options: args.options, seed: args.seed });
  const check = () => {
    if (args.signal.aborted) fail('simple_book_cancelled');
    if (canonicalJson({ request: args.request, options: args.options, seed: args.seed }) !== binding) fail('simple_book_source_changed');
  };
  const publish = (phase: SimpleBookView['phase']) => { check(); view.phase = phase; args.publish(structuredClone(view)); };
  check();
  const generated = await writeSimpleStory(prepared, async call => {
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
  const source = createCurrentSimpleStorySource(args.request, generated, records as Record<'author' | 'editor', TransportReply>, args.options);
  view.edited = { title: source.manuscript.title, pages: source.manuscript.pages };
  publish('story_review');
  const original = compileSimpleStory(prepared, generated.evidence.draft, source.accounting);
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
    const reading = compileCausalSourceReading(packet, raw); readings.push(reading);
    view.readings = readings.map(r => ({ stage: r.stage as 'final_review' | 'comparison', summary: r.summary, findings: r.findings }));
    publish('story_review');
  }
  const material = readings.some(r => r.findings.some(f => f.severity === 'blocking' ||
    f.kind !== 'preference' && f.kind !== 'improvement' && f.severity !== 'polish'));
  if (material) { publish('held'); return { status: 'story_held' as const, source, generated, readings, storyboard: null, runtimeEligible: false as const }; }
  publish('storyboard');
  const storyboard = await runSimpleStoryboardDiagnostic({ request: args.request, writerResult: source,
    options: args.options, signal: args.signal, generate: async (call, signal) => {
      publish(call.stage === 'storyboard' ? 'storyboard' : 'storyboard_review');
      const raw = await args.visual(call, signal); check(); return raw;
    } });
  check();
  publish(storyboard.status === 'review_supported' ? 'references_required' : 'held');
  return { status: storyboard.status, source, generated, readings, storyboard, runtimeEligible: false as const };
}
