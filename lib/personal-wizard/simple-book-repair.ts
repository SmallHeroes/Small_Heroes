import 'server-only';
import path from 'node:path';
import { mkdirSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { readSimpleBookContinuationEvidence } from './simple-book-continuation';
import { SimpleBookBudget, simpleBookExternalCosts } from './simple-book-budget';
import { createCurrentSimpleStorySource, prepareSimpleStoryRepair, simpleStoryReadingPackets } from './simple-story-source';
import { simpleAuthorCall, simpleEditorCall } from './simple-story-engine';
import { causalSourceReviewPacket } from './story-causal-experiment';
import { simpleBookViewSchema, type SimpleBookView } from './simple-book-view';
import { canonicalJson } from './request-acceptance';
import { exclusiveJson, fencedText, realDirectory } from '../../scripts/personal-causal-trial-journal';
import { CAUSAL_MODELS, prepareCausalWire } from '../../scripts/personal-causal-trial-adapters';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const file = z.object({ file: z.string().min(1), sha256: hash }).strict();
const relative = z.string().regex(/^(?:[a-z0-9_-]+\/)*[a-z0-9_.-]+\.(?:json|txt|md)$/).refine(s => !s.split('/').includes('..'));
export const simpleBookRepairConfigSchema = z.object({ version: z.literal('controlled-simple-book-editor-repair/v1'),
  continuationConfig: file, terminationReceipt: file, sourceHead: z.string().regex(/^[a-f0-9]{40}$/),
  approvalReference: z.string().min(30).max(2000), maximumMicroUsd: z.literal(12000000),
  artifacts: z.array(z.object({ relative, sha256: hash }).strict()).min(10).max(160),
  extraEngineeringReceipts: z.array(file).min(1).max(3), reconciledEngineeringReceipt: file,
}).strict();
const sha = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
const fail = (code: string): never => { throw Object.assign(new Error(code), { code }); };
const read = (name: string) => JSON.parse(fencedText(name, 4000000));

/** One fixed sibling slot in the original book. Pure preparation; no key, author, claim or provider. */
export async function prepareSimpleBookRepair(configFile: string) {
  if (!path.isAbsolute(configFile)) fail('repair_config');
  const bytes = fencedText(configFile, 48000), config = simpleBookRepairConfigSchema.parse(JSON.parse(bytes));
  const checked = (f: z.infer<typeof file>) => {
    if (!path.isAbsolute(f.file) || sha(fencedText(f.file, 4000000)) !== f.sha256) fail('repair_evidence_changed');
  };
  checked(config.continuationConfig); checked(config.terminationReceipt);
  const parent = readSimpleBookContinuationEvidence(config.continuationConfig.file, config.sourceHead);
  const inventory = new Map(config.artifacts.map(f => [f.relative, f.sha256]));
  if (inventory.size !== config.artifacts.length) fail('repair_inventory');
  realDirectory(parent.directory);
  const childFiles = () => readdirSync(parent.directory).flatMap(n => n === 'paid-stages'
    ? readdirSync(path.join(parent.directory, n)).map(f => `controlled-continuation-20261008/${n}/${f}`)
    : [`controlled-continuation-20261008/${n}`]);
  const required = ['continuation-simple-book-result.json', 'continuation-sealed.json', 'continuation-story.md', ...childFiles(),
    ...readdirSync(parent.job.directory).filter(n => /^view-\d{4}\.json$/.test(n))];
  if (required.some(n => !inventory.has(n))) fail('repair_inventory');
  const allEngineering = [...parent.original.engineeringReceipts, ...parent.config.extraEngineeringReceipts, ...config.extraEngineeringReceipts];
  // Duplicate paths, unknown termination and changed receipts are checked before any book claim.
  simpleBookExternalCosts(allEngineering);
  if (!config.extraEngineeringReceipts.some(f => canonicalJson(f) === canonicalJson(config.reconciledEngineeringReceipt))) fail('repair_reconciliation');
  const verify = () => {
    if (fencedText(configFile, 48000) !== bytes) fail('repair_config_changed');
    checked(config.continuationConfig); checked(config.terminationReceipt); parent.verify();
    for (const [name, digest] of inventory) if (sha(fencedText(path.join(parent.job.directory, name), 4000000)) !== digest) fail('repair_evidence_changed');
    if (childFiles().some(n => !inventory.has(n))) fail('repair_inventory');
    simpleBookExternalCosts(allEngineering);
    for (const f of config.extraEngineeringReceipts) {
      const r = read(f.file), overSlot = Number.isSafeInteger(r.maximumMicroUsd) && Math.ceil(r.reportedCostUsd * 1e6) > r.maximumMicroUsd;
      if (overSlot && canonicalJson(f) !== canonicalJson(config.reconciledEngineeringReceipt)) fail('repair_unreconciled_cost');
    }
    const reconciled = read(config.reconciledEngineeringReceipt.file);
    if (reconciled.code !== 1 || reconciled.resultSubtype !== 'error_max_budget_usd' || !reconciled.isError ||
        !Number.isSafeInteger(reconciled.maximumMicroUsd) || Math.ceil(reconciled.reportedCostUsd * 1e6) <= reconciled.maximumMicroUsd) fail('repair_reconciliation');
  };
  verify();
  z.object({ code: z.literal(2), signal: z.null(), terminationConfirmed: z.literal(true) }).passthrough().parse(read(config.terminationReceipt.file));
  const parentClaim = read(path.join(parent.directory, 'claim.json'));
  if (parentClaim.sourceHead !== parent.config.sourceHead || parentClaim.originalSourceHead !== parent.original.sourceHead ||
      parentClaim.requestDigest !== parent.oldClaim.requestDigest || parentClaim.configSha256 !== sha(parent.configBytes) ||
      canonicalJson(parentClaim.inherited) !== canonicalJson(parent.inherited) || parentClaim.extra !== parent.extra) fail('repair_parent_claim');
  const budget = new SimpleBookBudget(path.join(parent.directory, 'paid-stages'), parent.externalMicroUsd), inherited = budget.snapshot();
  const seal = z.object({ status: z.literal('story_held'), snapshot: z.unknown(), inheritedLogicalAttempts: z.literal(3),
    imageCalls: z.literal(0), illustrated: z.literal(false), runtimeEligible: z.literal(false), visualQualification: z.literal('not_granted') }).strict()
    .parse(read(path.join(parent.job.directory, 'continuation-sealed.json')));
  if (canonicalJson(seal.snapshot) !== canonicalJson(inherited) || inherited.stopped || inherited.unknownAttemptCosts ||
      inherited.logicalAttempts !== 2 || inherited.accountedMicroUsd !== inherited.knownEstimateMicroUsd) fail('repair_parent_outcome');
  const result = read(path.join(parent.job.directory, 'continuation-simple-book-result.json'));
  if (result.status !== 'story_held' || result.storyboard !== null || result.runtimeEligible !== false) fail('repair_parent_outcome');
  const repair = prepareSimpleStoryRepair(parent.job.queued.request, result.source, result.readings, parent.job.options);
  // Re-prove the actual native writing wires against current defaults before allocating the repair slot.
  await parent.reuseWriting(simpleAuthorCall(repair.prepared));
  await parent.reuseWriting(simpleEditorCall(repair.prepared, repair.priorEvidence.draft, repair.priorEvidence.findings));
  const imported = createCurrentSimpleStorySource(parent.job.queued.request, result.generated, parent.records, parent.job.options);
  if (canonicalJson(imported) !== canonicalJson(repair.prior)) fail('repair_writer_binding');
  const packets = simpleStoryReadingPackets(parent.job.queued.request, repair.prior, parent.job.options);
  for (const [index, stage] of ['final_review', 'comparison'].entries()) {
    const root = budget.root, receipt = read(path.join(root, `${stage}.receipt.json`)), wire = read(path.join(root, `${stage}.wire.json`));
    const claim = read(path.join(root, `${stage}.claim.json`)), outcome = read(path.join(root, `${stage}.result.json`));
    const numbered = causalSourceReviewPacket(index === 0 ? packets.final : packets.comparison);
    const call = { stage: stage as 'final_review' | 'comparison', role: 'astra' as const, conversationKey: 'validation-only',
      instructions: numbered.instructions, input: canonicalJson({ packetDigest: numbered.packetDigest, packet: numbered.packet }), schema: numbered.schema, maxOutputTokens: 16000 };
    const expectedWire = prepareCausalWire(call, { executable: parent.original.executable, executableSha256: parent.original.executableSha256,
      workspace: path.join(parent.original.outputParent, 'simple-book-cli-workspace'), maxWireBytes: 104000, astraInlineReferences: true,
      rates: { opus: { inputMicroUsdPerToken: 4, outputMicroUsdPerToken: 20 }, astra: { inputMicroUsdPerToken: 10, outputMicroUsdPerToken: 50 } } }, 2000000);
    const native = receipt.raw, u = receipt.usage;
    if (canonicalJson(wire) !== canonicalJson(expectedWire) || sha(canonicalJson(wire)) !== claim.wireDigest || outcome.wireDigest !== claim.wireDigest ||
        claim.maximumMicroUsd !== wire.reservedMicroUsd || !outcome.completed || !u || !Number.isSafeInteger(u.inputTokens) || u.inputTokens < 0 ||
        !Number.isSafeInteger(u.outputTokens) || u.outputTokens < 0 || u.outputTokens > 16000 || native.status !== 'completed' ||
        native.model !== CAUSAL_MODELS.astra || native.service_tier !== 'default' || native.usage?.input_tokens !== u.inputTokens ||
        native.usage?.output_tokens !== u.outputTokens || receipt.estimatedMicroUsd !== Math.ceil(u.inputTokens * 10 + u.outputTokens * 50) ||
        outcome.estimatedMicroUsd !== receipt.estimatedMicroUsd || outcome.estimatedMicroUsd > claim.maximumMicroUsd ||
        canonicalJson(JSON.parse(native.output_text)) !== canonicalJson(receipt.output) ||
        canonicalJson(receipt.output) !== canonicalJson(repair.readings[index].sourceEvidence.output)) fail('repair_reader_binding');
  }
  const extra = simpleBookExternalCosts(config.extraEngineeringReceipts), externalMicroUsd = inherited.accountedMicroUsd + extra;
  if (externalMicroUsd + 2000000 > 12000000) fail('repair_budget');
  const directory = path.join(parent.job.directory, 'controlled-editor-repair-20261008');
  return { config, parent, current: parent.current, repair, inherited, extra, externalMicroUsd, directory, verify, claim() {
    verify(); mkdirSync(directory);
    exclusiveJson(path.join(directory, 'claim.json'), { requestDigest: parent.oldClaim.requestDigest, sourceHead: config.sourceHead,
      configSha256: sha(bytes), inherited, extra, runtimeEligible: false });
    exclusiveJson(path.join(directory, 'editor-guidance.json'), { priorSourceDigest: sha(canonicalJson(repair.prior)), guidance: repair.guidance });
    const budget = new SimpleBookBudget(path.join(directory, 'paid-stages'), externalMicroUsd);
    let sequence = readdirSync(parent.job.directory).filter(n => /^view-\d{4}\.json$/.test(n)).length;
    const worker = { ...parent.job, publish(view: SimpleBookView) {
      if (view.phase !== 'failed') verify();
      else if (sha(canonicalJson(read(path.join(parent.job.directory, 'request.json')))) !== parent.oldClaim.requestDigest) fail('repair_request');
      const parsed = simpleBookViewSchema.parse(view);
      if (parsed.requestId !== parent.job.queued.requestId || sequence >= 80) fail('repair_view');
      exclusiveJson(path.join(parent.job.directory, `view-${String(++sequence).padStart(4, '0')}.json`), {
        requestDigest: parent.oldClaim.requestDigest, view: { ...parsed, revision: sequence } });
    } };
    return { budget, worker };
  } };
}
