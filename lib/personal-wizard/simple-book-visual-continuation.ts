import 'server-only';
import path from 'node:path';
import { lstatSync, readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { z } from 'zod';
import { readSimpleBookRepairEvidence } from './simple-book-repair';
import { SimpleBookBudget, simpleBookExternalCosts } from './simple-book-budget';
import { createRepairedSimpleStorySource, simpleStoryFindingIsMaterial, simpleStoryReadingPackets } from './simple-story-source';
import { compileCausalSourceReading, causalSourceReviewPacket } from './story-causal-experiment';
import { canonicalJson } from './request-acceptance';
import { prepareCurrentPersonalStoryboard, compilePersonalStoryboard, storyboardReviewDisposition, currentPersonalStoryboardFrame } from './storyboard';
import { decodePersonalBookProviderOutput, personalBookProviderPayload } from './book-openai';
import { CAUSAL_MODELS, prepareCausalWire } from '../../scripts/personal-causal-trial-adapters';
import { auditionUsageCost, readAuditionImage } from '../../scripts/personal-simple-book-illustrator';
import { exclusiveJson, fencedText, realDirectory } from '../../scripts/personal-causal-trial-journal';
import { previewSha } from '../local-story-preview';
import { qualityDisposition } from '../local-preview-quality';
import { simpleBookViewSchema, type SimpleBookView } from './simple-book-view';

const hash = z.string().regex(/^[a-f0-9]{64}$/), file = z.object({ file: z.string().min(1), sha256: hash }).strict();
export const visualContinuationConfigSchema = z.object({ version: z.literal('controlled-simple-book-visual-continuation/v1'),
  repairConfig: file, terminationReceipt: file, sourceHead: z.string().regex(/^[a-f0-9]{40}$/),
  approvalReference: z.string().min(30).max(2000), maximumMicroUsd: z.literal(12000000),
  reviewModel: z.literal('gpt-6.1-sol'), actorOwnedAppearance: z.literal(true),
  artifacts: z.array(z.object({ relative: z.string().regex(/^(?:[a-z0-9_-]+\/)*[a-z0-9_.-]+\.(?:json|txt|md|png)$/).refine(s => !s.split('/').includes('..')), sha256: hash }).strict()).min(10).max(256),
  extraEngineeringReceipts: z.array(file).min(1).max(3), technicalReviewReceipt: file,
}).strict();
const fail = (code: string): never => { throw Object.assign(new Error(code), { code }); };
const read = (name: string) => JSON.parse(fencedText(name, 32000000));
/** Enumerate real immutable parent files, including large pixel wires; never follow links. */
export function visualEvidenceFiles(directory: string, prefix = ''): string[] {
  realDirectory(directory);
  return readdirSync(directory).flatMap(name => {
    const full = path.join(directory, name), st = lstatSync(full);
    if (st.isSymbolicLink() || st.isFile() && st.nlink !== 1) fail('visual_evidence_file');
    return st.isDirectory() ? visualEvidenceFiles(full, `${prefix}${name}/`) : [`${prefix}${name}`];
  });
}
/** Pure admission: one SAME-book visual sibling, no writer/key/claim/provider on preparation. */
export async function readSimpleBookVisualContinuationEvidence(configFile: string, activeSourceHead?: string) {
  if (!path.isAbsolute(configFile)) fail('visual_config');
  const bytes = fencedText(configFile, 64000), config = visualContinuationConfigSchema.parse(JSON.parse(bytes));
  const checked = (f: z.infer<typeof file>) => { if (!path.isAbsolute(f.file) || previewSha(fencedText(f.file, 32000000)) !== f.sha256) fail('visual_evidence_changed'); };
  checked(config.repairConfig); checked(config.terminationReceipt); checked(config.technicalReviewReceipt);
  const repair = await readSimpleBookRepairEvidence(config.repairConfig.file, activeSourceHead ?? config.sourceHead), job = repair.parent.job;
  const inventory = new Map(config.artifacts.map(a => [a.relative, a.sha256]));
  if (inventory.size !== config.artifacts.length) fail('visual_inventory');
  const required = ['repair-simple-book-result.json', 'repair-sealed.json', 'repair-story.md',
    ...visualEvidenceFiles(repair.directory).map(n => `controlled-editor-repair-20261008/${n}`),
    ...visualEvidenceFiles(path.join(job.directory, 'illustrations')).map(n => `illustrations/${n}`),
    ...(activeSourceHead ? [...inventory.keys()] : readdirSync(job.directory)).filter(n => /^view-\d{4}\.json$/.test(n) || /^(?:reference_|page_|audition_|illustrated_)/.test(n))];
  if (required.some(n => !inventory.has(n))) fail('visual_inventory');
  const allEngineering = [...repair.allEngineering, ...config.extraEngineeringReceipts];
  simpleBookExternalCosts(allEngineering);
  if (!config.extraEngineeringReceipts.some(f => canonicalJson(f) === canonicalJson(config.technicalReviewReceipt))) fail('visual_review_receipt');
  const technical = read(config.technicalReviewReceipt.file);
  if (technical.head !== config.sourceHead || technical.status !== '' || technical.code !== 0 || technical.signal !== null ||
      !technical.terminationConfirmed || technical.stopped || technical.isError !== false || technical.resultSubtype !== 'success' ||
      canonicalJson(technical.models) !== canonicalJson([CAUSAL_MODELS.opus]) || !Number.isSafeInteger(technical.maximumMicroUsd) ||
      Math.ceil(technical.reportedCostUsd * 1e6) > technical.maximumMicroUsd || technical.qaVerdict !== 'PASS' ||
      technical.qaReviewHead !== config.sourceHead || technical.qaBase !== '7fece1230a0a9c523d53e3decbe7357f12ed576d' ||
      technical.qaMode !== 'read_only_code') fail('visual_technical_review');
  const verify = () => {
    if (fencedText(configFile, 64000) !== bytes) fail('visual_config_changed');
    checked(config.repairConfig); checked(config.terminationReceipt); checked(config.technicalReviewReceipt); repair.verify();
    for (const [n, digest] of inventory) {
      const full = path.join(job.directory, n), st = lstatSync(full); realDirectory(path.dirname(full));
      if (!st.isFile() || st.isSymbolicLink() || st.nlink !== 1 || st.size > 32000000 || previewSha(readFileSync(full)) !== digest) fail('visual_evidence_changed');
    }
    if (visualEvidenceFiles(repair.directory).some(n => !inventory.has(`controlled-editor-repair-20261008/${n}`)) ||
        visualEvidenceFiles(path.join(job.directory, 'illustrations')).some(n => !inventory.has(`illustrations/${n}`))) fail('visual_inventory');
    simpleBookExternalCosts(allEngineering);
  };
  verify(); const host = read(config.terminationReceipt.file);
  if (host.head !== repair.config.sourceHead || host.status !== '' || host.code !== 1 || host.signal !== null ||
      !host.terminationConfirmed || host.stopped || host.referenceCap !== 4) fail('visual_parent_termination');
  const oldClaim = read(path.join(repair.directory, 'claim.json'));
  if (oldClaim.sourceHead !== repair.config.sourceHead || oldClaim.configSha256 !== config.repairConfig.sha256 ||
      oldClaim.requestDigest !== repair.parent.oldClaim.requestDigest || canonicalJson(oldClaim.inherited) !== canonicalJson(repair.inherited) || oldClaim.extra !== repair.extra) fail('visual_parent_claim');
  const oldBudget = new SimpleBookBudget(path.join(repair.directory, 'paid-stages'), repair.externalMicroUsd), inherited = oldBudget.snapshot();
  const seal = read(path.join(job.directory, 'repair-sealed.json'));
  if (seal.status !== 'failed' || seal.code !== 'simple_reference_held' || seal.imageCalls !== 1 || seal.runtimeEligible !== false ||
      seal.inheritedLogicalAttempts !== 5 || canonicalJson(seal.snapshot) !== canonicalJson(inherited) || inherited.stopped ||
      inherited.unknownAttemptCosts || inherited.logicalAttempts !== 7 || inherited.accountedMicroUsd !== inherited.knownEstimateMicroUsd) fail('visual_parent_outcome');
  const stages = ['editor', 'final_review', 'comparison', 'storyboard', 'storyboard_review', 'reference_child', 'reference_child_qa'];
  for (const stage of stages) {
    const wire = read(path.join(oldBudget.root, `${stage}.wire.json`)), claim = read(path.join(oldBudget.root, `${stage}.claim.json`));
    const outcome = read(path.join(oldBudget.root, `${stage}.result.json`)), receipt = read(path.join(oldBudget.root, `${stage}.receipt.json`));
    if (previewSha(canonicalJson(wire)) !== claim.wireDigest || outcome.wireDigest !== claim.wireDigest || !outcome.completed ||
        !Number.isSafeInteger(outcome.estimatedMicroUsd) || outcome.estimatedMicroUsd < 0 || outcome.estimatedMicroUsd > claim.maximumMicroUsd ||
        receipt.estimatedMicroUsd !== outcome.estimatedMicroUsd) fail('visual_paid_binding');
    if (stage !== 'editor') {
      const native = receipt.raw, expected = auditionUsageCost(native.usage, stage === 'reference_child' ? 'image' : 'astra');
      if (expected !== outcome.estimatedMicroUsd || stage !== 'reference_child' &&
          (native.model !== 'gpt-6-astra' || native.service_tier !== 'default' || native.status !== 'completed' || !native.output_text ||
          native.usage.output_tokens > (wire.max_output_tokens ?? wire.payload?.max_output_tokens))) fail('visual_parent_provider');
    }
  }
  const result = read(path.join(job.directory, 'repair-simple-book-result.json'));
  const receipt = read(path.join(oldBudget.root, 'editor.receipt.json'));
  const rebuilt = createRepairedSimpleStorySource(job.queued.request, repair.repair.prior, repair.repair.readings, receipt, job.options, 2);
  if (result.status !== 'review_supported' || result.runtimeEligible !== false || canonicalJson(result.source) !== canonicalJson(rebuilt.source) ||
      canonicalJson(result.generated) !== canonicalJson(rebuilt.generated)) fail('visual_repaired_source');
  const policy = { executable: repair.parent.original.executable, executableSha256: repair.parent.original.executableSha256,
    workspace: path.join(repair.parent.original.outputParent, 'simple-book-cli-workspace'), maxWireBytes: 104000,
    rates: { opus: { inputMicroUsdPerToken: 4, outputMicroUsdPerToken: 20 }, astra: { inputMicroUsdPerToken: 10, outputMicroUsdPerToken: 50 } }, astraInlineReferences: true as const };
  const editorWire = prepareCausalWire({ ...repair.repair.call, role: 'opus', conversationKey: 'validation-only' }, policy, 2000000, path.join(job.directory, 'repair-editor-instructions.txt'));
  if (canonicalJson(editorWire) !== canonicalJson(read(path.join(oldBudget.root, 'editor.wire.json')))) fail('visual_editor_wire');
  const packets = simpleStoryReadingPackets(job.queued.request, rebuilt.source, job.options);
  for (const [i, stage] of ['final_review', 'comparison'].entries()) {
    const packet = i === 0 ? packets.final : packets.comparison, numbered = causalSourceReviewPacket(packet);
    const call = { stage: stage as 'final_review' | 'comparison', role: 'astra' as const, conversationKey: 'validation-only',
      instructions: numbered.instructions, input: canonicalJson({ packetDigest: numbered.packetDigest, packet: numbered.packet }), schema: numbered.schema, maxOutputTokens: 16000 };
    const wire = read(path.join(oldBudget.root, `${stage}.wire.json`)), native = read(path.join(oldBudget.root, `${stage}.receipt.json`));
    const reading = compileCausalSourceReading(packet, JSON.parse(native.raw.output_text));
    if (canonicalJson(wire) !== canonicalJson(prepareCausalWire(call, policy, 2000000)) || canonicalJson(reading) !== canonicalJson(result.readings[i]) ||
        reading.findings.some(simpleStoryFindingIsMaterial)) fail('visual_reader_binding');
  }
  const oldSource = prepareCurrentPersonalStoryboard(job.queued.request, rebuilt.source, job.options);
  const boardCall = result.storyboard.calls[0], qaCall = result.storyboard.calls[1];
  for (const [step, call] of [['storyboard', boardCall], ['storyboard_review', qaCall]] as const) {
    if (canonicalJson(personalBookProviderPayload(call, 'gpt-6-astra')) !== canonicalJson(read(path.join(oldBudget.root, `${step}.wire.json`)))) fail('visual_board_wire');
  }
  const rawDraft = decodePersonalBookProviderOutput(boardCall, JSON.parse(read(path.join(oldBudget.root, 'storyboard.receipt.json')).raw.output_text));
  const book = compilePersonalStoryboard(oldSource, rawDraft), oldReview = decodePersonalBookProviderOutput(qaCall, JSON.parse(read(path.join(oldBudget.root, 'storyboard_review.receipt.json')).raw.output_text));
  if (canonicalJson(book) !== canonicalJson(result.storyboard.storyboard) || canonicalJson(oldReview) !== canonicalJson(result.storyboard.rawReview) ||
      storyboardReviewDisposition(book, oldReview).disposition !== 'review_supported' || result.storyboard.framePackets.length !== 9) fail('visual_board_binding');
  for (let n = 0; n < 9; n++) if (canonicalJson(currentPersonalStoryboardFrame(book, oldReview, n,
    { request: job.queued.request, writerResult: rebuilt.source, options: job.options })) !== canonicalJson(result.storyboard.framePackets[n])) fail('visual_frame_binding');
  const viewNames = required.filter(n => /^view-\d{4}\.json$/.test(n)).sort(), viewRecord = read(path.join(job.directory, viewNames[viewNames.length - 1]));
  const view = simpleBookViewSchema.parse(viewRecord.view);
  if (viewRecord.requestDigest !== repair.parent.oldClaim.requestDigest || view.requestId !== job.queued.requestId || view.phase !== 'failed' ||
      view.error !== 'simple_reference_held' || canonicalJson(view.edited) !== canonicalJson({ title: rebuilt.source.manuscript.title, pages: rebuilt.source.manuscript.pages }) ||
      view.accounting.knownEstimateMicroUsd !== inherited.knownEstimateMicroUsd) fail('visual_parent_view');
  const oldImage = read(path.join(oldBudget.root, 'reference_child.receipt.json')).candidate;
  const oldImageBytes = readAuditionImage(path.join(job.directory, 'illustrations'), oldImage);
  const imageReceipt = read(path.join(oldBudget.root, 'reference_child.receipt.json')), imageWire = read(path.join(oldBudget.root, 'reference_child.wire.json'));
  if (imageReceipt.model !== 'gpt-image-2' || imageWire.body.model !== 'gpt-image-2' || imageWire.body.quality !== 'low' || imageWire.body.size !== '1024x1024' ||
      previewSha(Buffer.from(imageReceipt.raw.data?.[0]?.b64_json ?? '', 'base64')) !== oldImage.imageSha) fail('visual_image_provider_binding');
  const oldPixelWire = read(path.join(oldBudget.root, 'reference_child_qa.wire.json'));
  const control = JSON.parse(oldPixelWire.input[0].content[0].text);
  const oldPixelOutput = JSON.parse(read(path.join(oldBudget.root, 'reference_child_qa.receipt.json')).raw.output_text);
  const quality = qualityDisposition(oldPixelOutput, oldImage.imageSha, control.contextSha);
  if (previewSha(oldImageBytes) !== control.candidateSha || previewSha(JSON.stringify(control.context)) !== control.contextSha ||
      quality.disposition !== 'repair' || !quality.review.checks.some(c => c.category === 'identity' && c.verdict === 'defect')) fail('visual_parent_reference');
  const extra = simpleBookExternalCosts(config.extraEngineeringReceipts), externalMicroUsd = inherited.accountedMicroUsd + extra;
  if (externalMicroUsd + 600000 > 12000000) fail('visual_budget');
  const directory = path.join(job.directory, 'controlled-visual-continuation-20261008');
  const current = { ...repair.parent.original, sourceHead: config.sourceHead, reviewModel: config.reviewModel, actorOwnedAppearance: true as const };
  return { config, repair, job, current, result, rebuilt, rawDraft, oldSource, oldImage, oldImageBytes, control, inherited, view,
    inheritedAttempts: 12, extra, externalMicroUsd, directory, verify, configSha256: previewSha(bytes) };
}
export async function prepareSimpleBookVisualContinuation(configFile: string) {
  const ready = await readSimpleBookVisualContinuationEvidence(configFile);
  const { config, job, repair, inherited, extra, externalMicroUsd, directory, verify } = ready;
  return { ...ready, claim() {
      verify(); mkdirSync(directory); exclusiveJson(path.join(directory, 'claim.json'), { configSha256: ready.configSha256, sourceHead: config.sourceHead,
        requestDigest: repair.parent.oldClaim.requestDigest, inherited, extra, runtimeEligible: false });
      const budget = new SimpleBookBudget(path.join(directory, 'paid-stages'), externalMicroUsd);
      let sequence = readdirSync(job.directory).filter(n => /^view-\d{4}\.json$/.test(n)).length;
      const publish = (view: SimpleBookView) => {
        if (view.phase !== 'failed') verify();
        const parsed = simpleBookViewSchema.parse(view);
        if (parsed.requestId !== job.queued.requestId || sequence >= 80) fail('visual_view');
        exclusiveJson(path.join(job.directory, `view-${String(++sequence).padStart(4, '0')}.json`), {
          requestDigest: repair.parent.oldClaim.requestDigest, view: { ...parsed, revision: sequence } });
      };
      return { budget, publish };
    } };
}
