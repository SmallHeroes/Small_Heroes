import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { PersonalWizardOptions } from './options';
import { canonicalJson } from './request-acceptance';
import { personalStoryResultObjectSchema, personalStoryResultSchema } from './story-contract';
import { SIMPLE_STORY_ENGINE_VERSION, prepareSimpleStory, simpleAuthorCall, simpleEditorCall, simpleStoryDraftSchema,
  checkSimpleStory, editorFindings, compileSimpleStory, type SimpleStoryCall } from './simple-story-engine';
import { CAUSAL_MODELS } from '../../scripts/personal-causal-trial-adapters';

export const CURRENT_SIMPLE_SOURCE_VERSION = 'personal-simple-story-source/diagnostic-v1' as const;
const MODEL = CAUSAL_MODELS.opus; // Existing approved diagnostic authority, not a production default.
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const micro = z.number().finite().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const usage = z.object({ inputTokens: micro, outputTokens: micro }).strict();
const binding = z.object({ version: z.literal('personal-simple-writing-source/v1'), engineVersion: z.literal(SIMPLE_STORY_ENGINE_VERSION),
  requestId: hash, optionsFingerprint: hash, characterDigest: hash, bookDigest: hash }).strict();
const receipt = z.object({ version: z.literal('simple-cli-receipt-projection/v1'), stage: z.enum(['author', 'editor']),
  callDigest: hash, outputDigest: hash, recordDigest: hash, sessionId: z.string().uuid(), model: z.literal(MODEL),
  completed: z.literal(true), terminationConfirmed: z.literal(true), estimatedMicroUsd: micro, usage,
  costKind: z.literal('cli_reported_estimate_not_invoice') }).strict();
const evidenceSchema = (pages: number) => z.object({ source: binding, shape: z.string(), seed: z.string(), appearance: z.unknown(),
  draft: simpleStoryDraftSchema(pages), draftCheck: z.unknown(), findings: z.array(z.string()), edited: simpleStoryDraftSchema(pages),
  editorChanges: z.array(z.string().min(1).max(400)).max(12), finalCheck: z.unknown(),
  calls: z.object({ author: hash, editor: hash }).strict() }).strict();

// Separate from the old v3 editing receipt. Archive schemas remain readable, not current permission.
export const currentSimpleStoryResultSchema = personalStoryResultObjectSchema.extend({ simpleSource: z.object({
  version: z.literal(CURRENT_SIMPLE_SOURCE_VERSION), evidence: z.unknown(), author: receipt, editor: receipt,
}).strict() }).strict();
export type CurrentSimpleStoryResult = z.infer<typeof currentSimpleStoryResultSchema>;
const digest = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');
const callDigest = (call: SimpleStoryCall) => digest({ i: call.instructions, x: call.input });
export class SimpleStorySourceError extends Error { constructor(readonly code: string) { super(`simple_story_source_${code}`); } }
const fail = (code: string): never => { throw new SimpleStorySourceError(code); };

/** Pure supplied-record consistency; no client construction, file access, credential read or dispatch. */
export function projectSimpleCliReceipt(call: SimpleStoryCall, raw: unknown): z.infer<typeof receipt> {
  try {
    const saved = z.object({ estimatedMicroUsd: micro, usage, output: z.unknown(), metadata: z.record(z.unknown()),
      raw: z.object({ stdout: z.string().max(2_000_000), killConfirmed: z.literal(true), stopped: z.literal(false),
        termination: z.object({ code: z.literal(0), signal: z.null(), spawnError: z.literal(false).optional() }).strict(),
      }).passthrough(),
    }).passthrough().parse(raw);
    if (saved.raw.stdout.includes('\ufffd')) return fail('receipt_invalid');
    const native = z.object({ type: z.literal('result'), subtype: z.literal('success'), is_error: z.literal(false),
      session_id: z.string().uuid(), total_cost_usd: z.number().finite().nonnegative(),
      modelUsage: z.record(z.object({ inputTokens: micro, outputTokens: micro }).passthrough()),
      structured_output: z.unknown(),
    }).passthrough().parse(JSON.parse(saved.raw.stdout));
    if (canonicalJson(Object.keys(native.modelUsage)) !== canonicalJson([MODEL]) ||
        saved.metadata.kind !== 'cli_reported_estimate_not_invoice' ||
        canonicalJson(saved.metadata.reportedModels) !== canonicalJson([MODEL]) ||
        canonicalJson(saved.metadata.termination) !== canonicalJson(saved.raw.termination)) return fail('receipt_invalid');
    const tokens = native.modelUsage[MODEL];
    if (canonicalJson(saved.usage) !== canonicalJson({ inputTokens: tokens.inputTokens, outputTokens: tokens.outputTokens }) ||
        Math.ceil(native.total_cost_usd * 1e6) !== saved.estimatedMicroUsd) return fail('receipt_invalid');
    const output = call.schema.parse(saved.output), nativeOutput = call.schema.parse(native.structured_output);
    if (canonicalJson(saved.output) !== canonicalJson(output) || canonicalJson(output) !== canonicalJson(nativeOutput)) return fail('receipt_output');
    return receipt.parse({ version: 'simple-cli-receipt-projection/v1', stage: call.stage,
      callDigest: callDigest(call), outputDigest: digest(output), recordDigest: digest(saved), sessionId: native.session_id,
      model: MODEL, completed: true, terminationConfirmed: true, estimatedMicroUsd: saved.estimatedMicroUsd,
      usage: saved.usage, costKind: 'cli_reported_estimate_not_invoice' });
  } catch (error) { if (error instanceof SimpleStorySourceError) throw error; return fail('receipt_invalid'); }
}

/** Validate records and recompile the existing final text; this does not attest provider origin or literary quality. */
export function admitCurrentSimpleStorySource(request: unknown, raw: unknown, options: PersonalWizardOptions): CurrentSimpleStoryResult {
  try {
    const result = currentSimpleStoryResultSchema.parse(raw);
    if (canonicalJson(raw) !== canonicalJson(result)) return fail('noncanonical');
    const { simpleSource, ...common } = result;
    personalStoryResultSchema.parse(common);
    const candidate = z.object({ seed: z.string() }).passthrough().parse(simpleSource.evidence);
    const prepared = prepareSimpleStory(request, options, candidate.seed);
    if (prepared.book.companion.appearance.status !== 'registry_declared') return fail('appearance_unresolved');
    const evidence = evidenceSchema(prepared.book.pages).parse(simpleSource.evidence);
    const expectedBinding = { version: 'personal-simple-writing-source/v1', engineVersion: SIMPLE_STORY_ENGINE_VERSION,
      requestId: prepared.accepted.requestId, optionsFingerprint: prepared.accepted.optionsFingerprint,
      characterDigest: prepared.brief.companion.characterDigest, bookDigest: digest(prepared.book) };
    if (canonicalJson(evidence.source) !== canonicalJson(expectedBinding) || evidence.shape !== prepared.shape.id) return fail('writing_binding');
    if (canonicalJson(evidence.appearance) !== canonicalJson(prepared.book.companion.appearance)) return fail('appearance_binding');
    const draftCheck = checkSimpleStory(prepared, evidence.draft), finalCheck = checkSimpleStory(prepared, evidence.edited);
    const findings = editorFindings(prepared, draftCheck);
    if (canonicalJson(evidence.draftCheck) !== canonicalJson(draftCheck) || canonicalJson(evidence.finalCheck) !== canonicalJson(finalCheck) ||
        canonicalJson(evidence.findings) !== canonicalJson(findings)) return fail('checks_binding');
    if (finalCheck.hard.length) return fail('mechanical_held');
    const authorCall = simpleAuthorCall(prepared), editorCall = simpleEditorCall(prepared, evidence.draft, findings);
    const author = simpleSource.author, editor = simpleSource.editor;
    if (evidence.calls.author !== callDigest(authorCall) || evidence.calls.editor !== callDigest(editorCall) ||
        author.callDigest !== evidence.calls.author || editor.callDigest !== evidence.calls.editor ||
        author.stage !== 'author' || editor.stage !== 'editor' || author.sessionId === editor.sessionId) return fail('call_binding');
    if (author.outputDigest !== digest(evidence.draft) ||
        editor.outputDigest !== digest({ ...evidence.edited, editorChanges: evidence.editorChanges })) return fail('output_binding');
    const estimated = author.estimatedMicroUsd / 1e6 + editor.estimatedMicroUsd / 1e6;
    if (result.accounting.model !== MODEL || result.accounting.providerCalls !== 2 || result.accounting.estimatedUsd !== estimated ||
        estimated > result.accounting.reservedUsd || canonicalJson(result.accounting.usage) !== canonicalJson([author.usage, editor.usage])) return fail('accounting_binding');
    const compiled = compileSimpleStory(prepared, evidence.edited, result.accounting);
    if (canonicalJson(common) !== canonicalJson(compiled)) return fail('final_binding');
    return structuredClone(result);
  } catch (error) { if (error instanceof SimpleStorySourceError) throw error; return fail('invalid'); }
}

/** Record importer for a new completed simple run; never calls either writer or edits prose. */
export function createCurrentSimpleStorySource(request: unknown, generated: { result: unknown; evidence: unknown },
  records: { author: unknown; editor: unknown }, options: PersonalWizardOptions): CurrentSimpleStoryResult {
  try {
    const seed = z.object({ seed: z.string() }).passthrough().parse(generated.evidence).seed;
    const prepared = prepareSimpleStory(request, options, seed);
    const evidence = evidenceSchema(prepared.book.pages).parse(generated.evidence);
    const author = projectSimpleCliReceipt(simpleAuthorCall(prepared), records.author);
    const editor = projectSimpleCliReceipt(simpleEditorCall(prepared, evidence.draft, evidence.findings), records.editor);
    const result = personalStoryResultSchema.parse(generated.result);
    if (canonicalJson(generated.result) !== canonicalJson(result)) return fail('noncanonical');
    return admitCurrentSimpleStorySource(request, { ...result,
      simpleSource: { version: CURRENT_SIMPLE_SOURCE_VERSION, evidence, author, editor } }, options);
  } catch (error) { if (error instanceof SimpleStorySourceError) throw error; return fail('invalid'); }
}

/** Compact model-facing provenance. Original/edit records are hashed but never supplied as another draft to the reviewer. */
export function simpleStoryboardSourceEvidence(result: CurrentSimpleStoryResult) {
  return { version: result.simpleSource.version, digest: digest(result.simpleSource),
    author: { callDigest: result.simpleSource.author.callDigest, sessionId: result.simpleSource.author.sessionId },
    editor: { callDigest: result.simpleSource.editor.callDigest, sessionId: result.simpleSource.editor.sessionId } };
}

/** One exact declaration at writing and planning; even raw-description normalization cannot silently change it. */
export function assertSimpleStoryVisualBinding(result: CurrentSimpleStoryResult,
  visual: { id: string; description: string; appearanceStateAuthority: unknown }) {
  try {
    const evidence = z.object({ appearance: z.object({ companionId: z.string(), status: z.literal('registry_declared'),
      description: z.string(), stateAuthority: z.unknown() }).passthrough() }).passthrough().parse(result.simpleSource.evidence);
    if (evidence.appearance.companionId !== visual.id || evidence.appearance.description !== visual.description ||
        canonicalJson(evidence.appearance.stateAuthority) !== canonicalJson(visual.appearanceStateAuthority)) return fail('visual_binding');
  } catch (error) { if (error instanceof SimpleStorySourceError) throw error; return fail('visual_binding'); }
}
