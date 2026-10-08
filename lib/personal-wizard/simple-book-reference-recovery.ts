import 'server-only';
import path from 'node:path';
import { readFileSync, lstatSync, mkdirSync, readdirSync } from 'node:fs';
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { readSimpleBookVisualContinuationEvidence, visualEvidenceFiles } from './simple-book-visual-continuation';
import { SimpleBookBudget, simpleBookExternalCosts } from './simple-book-budget';
import { previewSha } from '../local-story-preview';
import { canonicalJson } from './request-acceptance';
import { prepareCurrentPersonalStoryboard, compilePersonalStoryboard, personalStoryboardReviewInput,
  currentPersonalStoryboardFrame, storyboardReviewDisposition } from './storyboard';
import { PERSONAL_BOOK_REVIEW_INSTRUCTION } from './book-runner';
import { personalBookOutputLimits } from './book-config';
import { decodePersonalBookProviderOutput, personalBookProviderPayload } from './book-openai';
import { qualityDisposition } from '../local-preview-quality';
import { simpleBookViewSchema, type SimpleBookView } from './simple-book-view';
import { exclusiveJson, fencedText, realDirectory } from '../../scripts/personal-causal-trial-journal';
import { CAUSAL_MODELS } from '../../scripts/personal-causal-trial-adapters';
import { appearancePlanningSchema, APPEARANCE_INSTRUCTION } from '../../scripts/personal-simple-book-visual-continuation';
import { auditionUsageCost, readAuditionImage } from '../../scripts/personal-simple-book-illustrator';
import { simpleReferenceDesignContext } from './simple-book-illustrations';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const file = z.object({ file: z.string().min(1), sha256: hash }).strict();
export const referenceRecoveryConfigSchema = z.object({ version: z.literal('controlled-simple-reference-recovery/v1'),
  visualConfig: file, terminationReceipt: file, sourceHead: z.string().regex(/^[a-f0-9]{40}$/),
  approvalReference: z.string().min(30).max(2000), maximumMicroUsd: z.literal(12000000),
  artifacts: z.array(z.object({ relative: z.string().regex(/^(?:[a-z0-9_-]+\/)*[a-z0-9_.-]+\.(?:json|txt|md|png)$/)
    .refine(s => !s.split('/').includes('..')), sha256: hash }).strict()).min(10).max(256),
  extraEngineeringReceipts: z.array(file).min(1).max(2), technicalReviewReceipt: file,
}).strict();
const fail = (code: string): never => { throw Object.assign(new Error(code), { code }); };
const read = (name: string) => JSON.parse(fencedText(name, 32000000));

/** Read-only admission of ONE known held reference. No key, network, writer or slot. */
export async function prepareSimpleBookReferenceRecovery(configFile: string) {
  if (!path.isAbsolute(configFile)) fail('reference_recovery_config');
  const bytes = fencedText(configFile, 64000), config = referenceRecoveryConfigSchema.parse(JSON.parse(bytes));
  const checked = (f: z.infer<typeof file>) => {
    if (!path.isAbsolute(f.file) || previewSha(fencedText(f.file, 32000000)) !== f.sha256) fail('reference_recovery_evidence_changed');
  };
  checked(config.visualConfig); checked(config.terminationReceipt); checked(config.technicalReviewReceipt);
  const parent = await readSimpleBookVisualContinuationEvidence(config.visualConfig.file, config.sourceHead);
  const inventory = new Map(config.artifacts.map(a => [a.relative, a.sha256]));
  if (inventory.size !== config.artifacts.length || visualEvidenceFiles(parent.directory).some(n =>
    !inventory.has(`controlled-visual-continuation-20261008/${n}`))) fail('reference_recovery_inventory');
  const allEngineering = [...parent.repair.allEngineering, ...parent.config.extraEngineeringReceipts, ...config.extraEngineeringReceipts];
  simpleBookExternalCosts(allEngineering);
  if (!config.extraEngineeringReceipts.some(f => canonicalJson(f) === canonicalJson(config.technicalReviewReceipt))) fail('reference_recovery_technical');
  const technical = read(config.technicalReviewReceipt.file);
  if (technical.head !== config.sourceHead || technical.status !== '' || technical.code !== 0 || technical.signal !== null ||
    !technical.terminationConfirmed || technical.stopped || technical.isError !== false || technical.resultSubtype !== 'success' ||
    canonicalJson(technical.models) !== canonicalJson([CAUSAL_MODELS.opus]) || !Number.isSafeInteger(technical.maximumMicroUsd) ||
    Math.ceil(technical.reportedCostUsd * 1e6) > technical.maximumMicroUsd || technical.qaVerdict !== 'PASS' ||
    technical.qaReviewHead !== config.sourceHead || technical.qaBase !== 'd9ae20dc29195004f1fed6d246daefbe42610953' ||
    technical.qaMode !== 'read_only_code') fail('reference_recovery_technical');
  const verify = () => {
    if (fencedText(configFile, 64000) !== bytes) fail('reference_recovery_config_changed');
    checked(config.visualConfig); checked(config.terminationReceipt); checked(config.technicalReviewReceipt); parent.verify();
    for (const [n, digest] of inventory) {
      const full = path.join(parent.job.directory, n); realDirectory(path.dirname(full)); const stat = lstatSync(full);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 32000000 || previewSha(readFileSync(full)) !== digest) fail('reference_recovery_evidence_changed');
    }
    if (visualEvidenceFiles(parent.directory).some(n => !inventory.has(`controlled-visual-continuation-20261008/${n}`))) fail('reference_recovery_inventory');
    simpleBookExternalCosts(allEngineering);
  };
  verify();
  const host = read(config.terminationReceipt.file), claim = read(path.join(parent.directory, 'claim.json'));
  if (host.head !== parent.config.sourceHead || host.status !== '' || host.code !== 1 || host.signal !== null ||
    !host.terminationConfirmed || host.stopped || host.referenceCap !== 4 || claim.sourceHead !== parent.config.sourceHead ||
    claim.configSha256 !== config.visualConfig.sha256 || claim.requestDigest !== parent.repair.parent.oldClaim.requestDigest ||
    canonicalJson(claim.inherited) !== canonicalJson(parent.inherited) || claim.extra !== parent.extra) fail('reference_recovery_parent');
  const oldBudget = new SimpleBookBudget(path.join(parent.directory, 'paid-stages'), parent.externalMicroUsd), inherited = oldBudget.snapshot();
  const seal = read(path.join(parent.directory, 'sealed.json'));
  if (seal.status !== 'failed' || seal.code !== 'simple_reference_held' || seal.sourceHead !== parent.config.sourceHead ||
    seal.runtimeEligible !== false || seal.inheritedLogicalAttempts !== 12 || canonicalJson(seal.snapshot) !== canonicalJson(inherited) ||
    inherited.stopped || inherited.unknownAttemptCosts || inherited.logicalAttempts !== 5 || inherited.accountedMicroUsd !== inherited.knownEstimateMicroUsd)
    fail('reference_recovery_outcome');
  const stages = ['appearance_planning', 'owned_storyboard_review', 'sol_pixel_control', 'reference_child', 'reference_child_qa'];
  const stage = (name: string) => ({ wire: read(path.join(oldBudget.root, `${name}.wire.json`)),
    receipt: read(path.join(oldBudget.root, `${name}.receipt.json`)) });
  for (const name of stages) {
    const { wire, receipt } = stage(name), c = read(path.join(oldBudget.root, `${name}.claim.json`)), result = read(path.join(oldBudget.root, `${name}.result.json`));
    const expected = auditionUsageCost(receipt.raw?.usage, name === 'reference_child' ? 'image' : name === 'appearance_planning' ? 'astra' : 'sol');
    if (c.step !== name || previewSha(canonicalJson(wire)) !== c.wireDigest || result.wireDigest !== c.wireDigest || !result.completed ||
      expected === null || expected !== result.estimatedMicroUsd || expected !== receipt.estimatedMicroUsd || expected > c.maximumMicroUsd ||
      name !== 'reference_child' && (receipt.raw.model !== wire.model || receipt.raw.service_tier !== 'default' || receipt.raw.status !== 'completed' ||
        !receipt.raw.output_text || receipt.raw.usage.output_tokens > wire.max_output_tokens)) fail('reference_recovery_paid_binding');
  }
  const source = prepareCurrentPersonalStoryboard(parent.job.queued.request, parent.rebuilt.source, parent.job.options, true);
  // The historical reader already reconstructs and binds this decoded storyboard draft.
  const oldDraft = parent.rawDraft as { plan: Record<string, unknown> & { wardrobe: string }; [key: string]: unknown };
  const appearance = stage('appearance_planning'), owned = appearancePlanningSchema.parse(JSON.parse(appearance.receipt.raw.output_text));
  const expectedAppearance = { model: 'gpt-6-astra', store: false, service_tier: 'default', reasoning: { effort: 'medium' },
    instructions: APPEARANCE_INSTRUCTION, input: canonicalJson({ scope: 'owner_only_visual_planning', oldWardrobe: oldDraft.plan.wardrobe,
      childDesign: parent.current.illustratedAudition!.childDesign, finalManuscript: parent.rebuilt.source.manuscript,
      companionVisualAuthority: source.companionVisualAuthority }), max_output_tokens: 8000,
    text: { format: zodTextFormat(appearancePlanningSchema, 'owned_actor_appearance') } };
  if (canonicalJson(appearance.wire) !== canonicalJson(expectedAppearance) || owned.disposition !== 'owned' || !owned.actorAppearance) fail('reference_recovery_appearance');
  const { wardrobe: _mixed, ...plan } = oldDraft.plan;
  const draft = { ...oldDraft, plan: { ...plan, actorAppearance: owned.actorAppearance } };
  const book = compilePersonalStoryboard(source, draft);
  if (canonicalJson(draft) !== canonicalJson(read(path.join(parent.directory, 'owned_storyboard_draft.json')))) fail('reference_recovery_board');
  const call = { stage: 'review' as const, instructions: PERSONAL_BOOK_REVIEW_INSTRUCTION,
    input: canonicalJson(personalStoryboardReviewInput(book)), maxOutputTokens: personalBookOutputLimits(8).reviewOutputTokens,
    context: { narrativeSpreads: 8, sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest, actorOwnedAppearance: true as const } };
  const boardReview = stage('owned_storyboard_review');
  if (canonicalJson(boardReview.wire) !== canonicalJson(personalBookProviderPayload(call, 'gpt-6.1-sol'))) fail('reference_recovery_board_wire');
  const rawReview = decodePersonalBookProviderOutput(call, JSON.parse(boardReview.receipt.raw.output_text)), review = storyboardReviewDisposition(book, rawReview);
  const framePackets = Array.from({ length: 9 }, (_, n) => currentPersonalStoryboardFrame(book, rawReview, n,
    { request: parent.job.queued.request, writerResult: parent.rebuilt.source, options: parent.job.options }));
  const contentBytes = Buffer.byteLength(call.instructions + call.input, 'utf8');
  const result = { ...parent.result, source: parent.rebuilt.source, generated: parent.rebuilt.generated,
    storyboard: { ...parent.result.storyboard, status: 'review_supported', writerResult: parent.rebuilt.source, sourceDigest: book.sourceDigest,
      storyboardDigest: book.storyboardDigest, storyboard: book, rawReview, review, framePackets,
      calls: [{ ...call, contentBytes, contentByteLimit: 104000, headroomBytes: 104000 - contentBytes }] } };
  if (review.disposition !== 'review_supported' || canonicalJson(result) !== canonicalJson(read(path.join(parent.directory, 'visual_simple_book_result.json')))) fail('reference_recovery_board');
  const control = stage('sol_pixel_control'), original = parent.control;
  const controlData = JSON.parse(control.wire.input[0].content[0].text);
  const oldControl = qualityDisposition(JSON.parse(control.receipt.raw.output_text), parent.oldImage.imageSha, original.contextSha);
  if (control.wire.model !== 'gpt-6.1-sol' || canonicalJson(controlData.context) !== canonicalJson(original.context) || controlData.contextSha !== original.contextSha ||
    previewSha(Buffer.from(control.wire.input[0].content[1].image_url.split(',')[1], 'base64')) !== parent.oldImage.imageSha ||
    oldControl.disposition !== 'repair' || !oldControl.review.checks.some(c => c.category === 'identity' && c.verdict === 'defect')) fail('reference_recovery_control');
  const image = stage('reference_child'), pixel = stage('reference_child_qa'), candidate = image.receipt.candidate;
  const imageBytes = readAuditionImage(path.join(parent.directory, 'illustrations'), candidate), pixelData = JSON.parse(pixel.wire.input[0].content[0].text);
  const expectedContext = simpleReferenceDesignContext({ age: parent.job.prepared.brief.child.age,
    address: parent.job.prepared.brief.child.address, fictionalDesign: parent.current.illustratedAudition!.childDesign,
    wardrobe: book.plan.wardrobe, role: 'child', clothing: book.plan.actorAppearance!.child.clothing });
  const held = qualityDisposition(JSON.parse(pixel.receipt.raw.output_text), candidate.imageSha, previewSha(JSON.stringify(expectedContext)));
  if (image.receipt.model !== 'gpt-image-2' || image.wire.body.model !== 'gpt-image-2' || image.wire.body.quality !== 'low' || image.wire.body.size !== '1024x1024' ||
    previewSha(Buffer.from(image.receipt.raw.data?.[0]?.b64_json ?? '', 'base64')) !== candidate.imageSha ||
    canonicalJson(pixelData.context) !== canonicalJson(expectedContext) || pixelData.candidateSha !== candidate.imageSha || pixel.wire.model !== 'gpt-6.1-sol' ||
    previewSha(Buffer.from(pixel.wire.input[0].content[1].image_url.split(',')[1], 'base64')) !== candidate.imageSha ||
    canonicalJson(held) !== canonicalJson(read(path.join(parent.directory, 'reference_child_review.json'))) || held.disposition !== 'repair') fail('reference_recovery_seed');
  const viewNames = [...inventory.keys()].filter(n => /^view-\d{4}\.json$/.test(n)).sort();
  if (!viewNames.length) fail('reference_recovery_view');
  const record = read(path.join(parent.job.directory, viewNames[viewNames.length - 1])), view = simpleBookViewSchema.parse(record.view);
  if (view.phase !== 'failed' || view.error !== 'simple_reference_held' || view.imageScope !== 'owned_visual_continuation' || view.images.length ||
    record.requestDigest !== claim.requestDigest || view.requestId !== parent.job.queued.requestId || canonicalJson(view.edited) !== canonicalJson(parent.view.edited) ||
    view.accounting.knownEstimateMicroUsd !== inherited.knownEstimateMicroUsd || view.accounting.unknownAttemptCosts) fail('reference_recovery_view');
  const extra = simpleBookExternalCosts(config.extraEngineeringReceipts), externalMicroUsd = inherited.accountedMicroUsd + extra;
  if (externalMicroUsd + 600000 > 12000000) fail('reference_recovery_budget');
  const directory = path.join(parent.job.directory, 'controlled-reference-recovery-20261008');
  const current = { ...parent.current, sourceHead: config.sourceHead };
  return { config, parent, result, view, inherited, extra, externalMicroUsd, directory, current, verify,
    seed: { name: 'child' as const, bytes: imageBytes, imageSha: candidate.imageSha, context: expectedContext, review: held.review }, claim() {
      verify(); mkdirSync(directory); exclusiveJson(path.join(directory, 'claim.json'), { configSha256: previewSha(bytes), sourceHead: config.sourceHead,
        requestDigest: claim.requestDigest, inherited, extra, referenceCorrectionLimit: 1, runtimeEligible: false });
      const budget = new SimpleBookBudget(path.join(directory, 'paid-stages'), externalMicroUsd);
      let sequence = readdirSync(parent.job.directory).filter(n => /^view-\d{4}\.json$/.test(n)).length;
      const publish = (next: SimpleBookView) => {
        if (next.phase !== 'failed') verify(); const parsed = simpleBookViewSchema.parse(next);
        if (parsed.requestId !== parent.job.queued.requestId || sequence >= 80) fail('reference_recovery_view');
        exclusiveJson(path.join(parent.job.directory, `view-${String(++sequence).padStart(4, '0')}.json`), { requestDigest: claim.requestDigest, view: { ...parsed, revision: sequence } });
      };
      return { budget, publish };
    } };
}
