import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { PersonalWizardOptions } from './options';
import { canonicalJson } from './request-acceptance';
import { personalStoryResultObjectSchema, personalStoryResultSchema, personalSimpleRepairResultObjectSchema, personalSimpleRepairResultSchema } from './story-contract';
import { SIMPLE_STORY_ENGINE_VERSION, prepareSimpleStory, simpleAuthorCall, simpleEditorCall, simpleStoryDraftSchema,
  checkSimpleStory, editorFindings, compileSimpleStory, type SimpleStoryCall } from './simple-story-engine';
import type { SimpleEditorGuidance } from './simple-story-engine';
import { causalReviewPackets, compileCausalSourceReading, causalDigest } from './story-causal-experiment';
import { preparePersonalStory } from './story-writer';
import { CAUSAL_MODELS } from '../../scripts/personal-causal-trial-adapters';

export const CURRENT_SIMPLE_SOURCE_VERSION = 'personal-simple-story-source/diagnostic-v1' as const;
export const REPAIRED_SIMPLE_SOURCE_VERSION = 'personal-simple-story-source/diagnostic-v1-repair' as const;
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
const originalSimpleStoryResultSchema = personalStoryResultObjectSchema.extend({ simpleSource: z.object({
  version: z.literal(CURRENT_SIMPLE_SOURCE_VERSION), evidence: z.unknown(), author: receipt, editor: receipt,
}).strict() }).strict();
export const currentSimpleStoryResultSchema = z.union([originalSimpleStoryResultSchema,
  personalSimpleRepairResultObjectSchema.extend({ simpleSource: z.object({ version: z.literal(REPAIRED_SIMPLE_SOURCE_VERSION), evidence: z.unknown(), author: receipt, editor: receipt,
    repair: z.object({ prior: z.unknown(), readings: z.array(z.unknown()).length(2), guidance: z.unknown(),
      reservedUsd: z.number().finite().positive().max(2) }).strict() }).strict(),
  }).strict(),
]);
export type CurrentSimpleStoryResult = z.infer<typeof currentSimpleStoryResultSchema>;
const digest = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');
const callDigest = (call: SimpleStoryCall) => digest({ i: call.instructions, x: call.input });
export class SimpleStorySourceError extends Error { constructor(readonly code: string) { super(`simple_story_source_${code}`); } }
const fail = (code: string): never => { throw new SimpleStorySourceError(code); };

/** Exactly the existing HOLD predicate, shared by approval and repair admission. */
export function simpleStoryFindingIsMaterial(f: { severity: string; kind: string }) {
  return f.severity === 'blocking' || f.kind !== 'preference' && f.kind !== 'improvement' && f.severity !== 'polish';
}

export function simpleStoryReadingPackets(request: unknown, result: CurrentSimpleStoryResult, options: PersonalWizardOptions) {
  const candidate = z.object({ seed: z.string() }).passthrough().parse(result.simpleSource.evidence);
  const prepared = prepareSimpleStory(request, options, candidate.seed);
  const evidence = evidenceSchema(prepared.book.pages).parse(result.simpleSource.evidence);
  const original = compileSimpleStory(prepared, evidence.draft, result.accounting, result.simpleSource.version === REPAIRED_SIMPLE_SOURCE_VERSION);
  const document = (r: typeof original) => ({ plan: r.plan, manuscript: r.manuscript,
    characterDigest: prepared.brief.companion.characterDigest });
  return causalReviewPackets(preparePersonalStory(request, options), document(original), document(result));
}

/** All material claims or no repair. No scores, summaries, preferences, proposed fixes or silent cap omissions. */
export function prepareSimpleStoryRepair(request: unknown, priorRaw: unknown, readingsRaw: unknown[], options: PersonalWizardOptions) {
  try {
    // The literal old envelope prohibits repair chains before recursive admission can begin.
    originalSimpleStoryResultSchema.parse(priorRaw);
    const prior = admitCurrentSimpleStorySource(request, priorRaw, options);
    if (readingsRaw.length !== 2) return fail('repair_reading_binding');
    const packets = simpleStoryReadingPackets(request, prior, options);
    const readings = [packets.final, packets.comparison].map((packet, index) => {
      const raw = readingsRaw[index];
      if (!raw || typeof raw !== 'object' || !('sourceEvidence' in raw)) return fail('repair_reading_binding');
      const output = z.object({ sourceEvidence: z.object({ output: z.unknown() }).passthrough() }).passthrough().parse(raw).sourceEvidence.output;
      const checked = compileCausalSourceReading(packet, output);
      if (canonicalJson(raw) !== canonicalJson(checked)) return fail('repair_reading_binding');
      return checked;
    });
    const findings = readings.flatMap((reading, ri) => reading.findings.flatMap((f, fi) => {
      if (!simpleStoryFindingIsMaterial(f)) return [];
      if (f.kind === 'preference' || f.kind === 'improvement') return fail('repair_unactionable_hold');
      return [{ id: `repair-finding-${ri + 1}-${String(fi + 1).padStart(2, '0')}`, severity: f.severity,
        criterion: f.criterion, original: structuredClone(f.original), revised: structuredClone(f.revised), explanation: f.explanation }];
    }));
    if (!findings.length || findings.length > 6) return fail('repair_finding_limit');
    const seed = z.object({ seed: z.string() }).passthrough().parse(prior.simpleSource.evidence).seed;
    const prepared = prepareSimpleStory(request, options, seed), priorEvidence = evidenceSchema(prepared.book.pages).parse(prior.simpleSource.evidence);
    const guidance: SimpleEditorGuidance = { version: 'source-bound-simple-editor-guidance/v1', requestId: prior.requestId,
      targetDigest: digest(priorEvidence.edited), readingDigests: readings.map(causalDigest), findings };
    if (Buffer.byteLength(canonicalJson(guidance), 'utf8') > 12000) return fail('repair_guidance_limit');
    const targetCheck = checkSimpleStory(prepared, priorEvidence.edited), mechanical = editorFindings(prepared, targetCheck);
    return { prior, priorEvidence, prepared, readings, guidance,
      call: simpleEditorCall(prepared, priorEvidence.edited, mechanical, guidance) };
  } catch (error) { if (error instanceof SimpleStorySourceError) throw error; return fail('repair_invalid'); }
}

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
    (simpleSource.version === REPAIRED_SIMPLE_SOURCE_VERSION ? personalSimpleRepairResultSchema : personalStoryResultSchema).parse(common);
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
    const repair = simpleSource.version === REPAIRED_SIMPLE_SOURCE_VERSION ?
      prepareSimpleStoryRepair(request, simpleSource.repair.prior, simpleSource.repair.readings, options) : null;
    if (repair && (canonicalJson(simpleSource.version === REPAIRED_SIMPLE_SOURCE_VERSION && simpleSource.repair.guidance) !== canonicalJson(repair.guidance) ||
        canonicalJson({ ...evidence, edited: repair.priorEvidence.edited, editorChanges: repair.priorEvidence.editorChanges,
          finalCheck: repair.priorEvidence.finalCheck, calls: repair.priorEvidence.calls }) !== canonicalJson(repair.priorEvidence))) return fail('repair_lineage');
    const authorCall = simpleAuthorCall(prepared), editorCall = repair?.call ?? simpleEditorCall(prepared, evidence.draft, findings);
    const author = simpleSource.author, editor = simpleSource.editor;
    if (evidence.calls.author !== callDigest(authorCall) || evidence.calls.editor !== callDigest(editorCall) ||
        author.callDigest !== evidence.calls.author || editor.callDigest !== evidence.calls.editor ||
        author.stage !== 'author' || editor.stage !== 'editor' || author.sessionId === editor.sessionId) return fail('call_binding');
    if (repair && (canonicalJson(author) !== canonicalJson(repair.prior.simpleSource.author) ||
        [author.sessionId, repair.prior.simpleSource.editor.sessionId].includes(editor.sessionId))) return fail('repair_lineage');
    if (author.outputDigest !== digest(evidence.draft) ||
        editor.outputDigest !== digest({ ...evidence.edited, editorChanges: evidence.editorChanges })) return fail('output_binding');
    const estimated = repair ? (author.estimatedMicroUsd + repair.prior.simpleSource.editor.estimatedMicroUsd + editor.estimatedMicroUsd) / 1e6 :
      author.estimatedMicroUsd / 1e6 + editor.estimatedMicroUsd / 1e6;
    const expectedUsage = repair ? [author.usage, repair.prior.simpleSource.editor.usage, editor.usage] : [author.usage, editor.usage];
    if (result.accounting.model !== MODEL || result.accounting.providerCalls !== (repair ? 3 : 2) || result.accounting.estimatedUsd !== estimated ||
        estimated > result.accounting.reservedUsd || canonicalJson(result.accounting.usage) !== canonicalJson(expectedUsage) ||
        repair && simpleSource.version === REPAIRED_SIMPLE_SOURCE_VERSION &&
          result.accounting.reservedUsd !== repair.prior.accounting.reservedUsd + simpleSource.repair.reservedUsd) return fail('accounting_binding');
    if (repair && repair.guidance.findings.some(f => evidence.editorChanges.filter(s =>
      s.startsWith(`${f.id} changed:`) || s.startsWith(`${f.id} kept:`)).length !== 1)) return fail('repair_disposition');
    const compiled = compileSimpleStory(prepared, evidence.edited, result.accounting, !!repair);
    if (canonicalJson(common) !== canonicalJson(compiled)) return fail('final_binding');
    return structuredClone(result);
  } catch (error) { if (error instanceof SimpleStorySourceError) throw error; return fail('invalid'); }
}

/** One actual fresh editor receipt, preserving original author and prior editor provenance and all writing costs. */
export function createRepairedSimpleStorySource(request: unknown, prior: unknown, readings: unknown[], rawReceipt: unknown,
  options: PersonalWizardOptions, reservedUsd: number) {
  const ready = prepareSimpleStoryRepair(request, prior, readings, options);
  const editor = projectSimpleCliReceipt(ready.call, rawReceipt);
  const output = ready.call.schema.parse(z.object({ output: z.unknown() }).passthrough().parse(rawReceipt).output);
  const { editorChanges, ...rawEdited } = output;
  const edited = simpleStoryDraftSchema(ready.prepared.book.pages).parse(rawEdited);
  const finalCheck = checkSimpleStory(ready.prepared, edited);
  const draftCheck = checkSimpleStory(ready.prepared, ready.priorEvidence.draft);
  const evidence = { ...ready.priorEvidence, shape: ready.prepared.shape.id, appearance: ready.prepared.book.companion.appearance,
    draftCheck, findings: editorFindings(ready.prepared, draftCheck), edited, editorChanges: editorChanges as string[], finalCheck,
    calls: { author: ready.priorEvidence.calls.author, editor: callDigest(ready.call) } };
  const author = ready.prior.simpleSource.author, priorEditor = ready.prior.simpleSource.editor;
  const accounting = { ...ready.prior.accounting, providerCalls: 3, reservedUsd: ready.prior.accounting.reservedUsd + reservedUsd,
    estimatedUsd: (author.estimatedMicroUsd + priorEditor.estimatedMicroUsd + editor.estimatedMicroUsd) / 1e6,
    usage: [author.usage, priorEditor.usage, editor.usage] };
  const result = compileSimpleStory(ready.prepared, edited, accounting, true);
  const source = admitCurrentSimpleStorySource(request, { ...result, simpleSource: { version: REPAIRED_SIMPLE_SOURCE_VERSION,
    evidence, author, editor, repair: { prior: ready.prior, readings: ready.readings, guidance: ready.guidance, reservedUsd } } }, options);
  return { source, generated: { result, evidence } };
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
