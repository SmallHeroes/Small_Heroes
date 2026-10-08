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
import { gitAt } from '../../scripts/personal-source-git';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const file = z.object({ file: z.string().min(1), sha256: hash }).strict();
const referenceRecoveryV1 = z.object({ version: z.literal('controlled-simple-reference-recovery/v1'),
  visualConfig: file, terminationReceipt: file, sourceHead: z.string().regex(/^[a-f0-9]{40}$/),
  approvalReference: z.string().min(30).max(2000), maximumMicroUsd: z.literal(12000000),
  artifacts: z.array(z.object({ relative: z.string().regex(/^(?:[a-z0-9_-]+\/)*[a-z0-9_.-]+\.(?:json|txt|md|png)$/)
    .refine(s => !s.split('/').includes('..')), sha256: hash }).strict()).min(10).max(256),
  extraEngineeringReceipts: z.array(file).min(1).max(2), technicalReviewReceipt: file,
}).strict();
export const referenceRecoveryConfigSchema = z.discriminatedUnion('version', [referenceRecoveryV1,
  referenceRecoveryV1.extend({ version: z.literal('controlled-simple-reference-recovery/v2'), maximumMicroUsd: z.literal(14000000), allowanceGrant: file })]);
export const sameBookAllowanceGrantSchema = z.object({ version: z.literal('local-simple-book-allowance-extension/v1'),
  requestId: hash, parentVisualConfigSha256: hash, inheritedKnownMicroUsd: z.number().int().nonnegative(),
  previousMaximumMicroUsd: z.literal(12000000), maximumMicroUsd: z.literal(14000000),
  ownerApprovalReference: z.string().min(30).max(2000), sameBookOnly: z.literal(true), publicRelease: z.literal(false),
  customerCharge: z.literal(false), gateChanges: z.literal(false), acceptKnownCompletedNativeSoftCapOvershoot: z.literal(true),
  reconciledSessionReceipts: z.array(file).min(2).max(3), reconciledMicroUsd: z.number().int().positive(),
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
  const extended = config.version === 'controlled-simple-reference-recovery/v2';
  const checkGrant = () => {
    if (config.version !== 'controlled-simple-reference-recovery/v2') return null;
    checked(config.allowanceGrant); const g = sameBookAllowanceGrantSchema.parse(read(config.allowanceGrant.file));
    if (g.requestId !== parent.job.queued.requestId || g.parentVisualConfigSha256 !== config.visualConfig.sha256 ||
      g.maximumMicroUsd !== config.maximumMicroUsd || config.extraEngineeringReceipts.length !== 2) fail('reference_recovery_allowance');
    const records = g.reconciledSessionReceipts.map(f => { checked(f); return read(f.file); });
    const last = records[records.length - 1], latestRef = g.reconciledSessionReceipts[g.reconciledSessionReceipts.length - 1];
    if (!z.string().uuid().safeParse(last.sessionId).success || !/^[a-f0-9]{40}$/.test(last.head ?? '') ||
      last.sessionId === technical.sessionId || last.code !== 0 || last.signal !== null ||
      !last.terminationConfirmed || last.stopped || last.status !== '' || last.isError !== false || last.resultSubtype !== 'success' ||
      last.qaVerdict !== 'PASS' || last.qaMode !== 'read_only_code' || last.head !== last.qaReviewHead ||
      last.qaBase !== 'd9ae20dc29195004f1fed6d246daefbe42610953' ||
      canonicalJson(last.models) !== canonicalJson([CAUSAL_MODELS.opus]) ||
      last.costKind !== 'cumulative_same_cli_session_list_estimate_not_invoice' || last.includesPreviousKnownFailedCalls !== true ||
      Math.ceil(last.reportedCostUsd * 1e6) !== g.reconciledMicroUsd ||
      !config.extraEngineeringReceipts.some(f => canonicalJson(f) === canonicalJson(latestRef)) ||
      canonicalJson(latestRef) === canonicalJson(config.technicalReviewReceipt)) fail('reference_recovery_reconciliation');
    // All earlier calls belong to the same known terminated session. Only its
    // latest cumulative amount is added, never the intermediate amounts again.
    simpleBookExternalCosts(g.reconciledSessionReceipts);
    records.forEach((r, i) => {
      if (r.sessionId !== last.sessionId || r.head !== last.head || r.status !== '' || !r.terminationConfirmed || r.signal !== null || r.stopped ||
        canonicalJson(r.models) !== canonicalJson(last.models) || i > 0 && r.reportedCostUsd <= records[i - 1].reportedCostUsd ||
        i < records.length - 1 && (r.code !== 1 || r.isError !== true || r.resultSubtype !== 'error_max_budget_usd')) fail('reference_recovery_reconciliation');
    });
    if (last.previousCumulativeReportedCostUsd !== records[records.length - 2].reportedCostUsd) fail('reference_recovery_reconciliation');
    gitAt(parent.current.workspace, ['merge-base', '--is-ancestor', last.head, config.sourceHead]);
    return g;
  };
  const grant = checkGrant();
  if (technical.head !== config.sourceHead || technical.status !== '' || technical.code !== 0 || technical.signal !== null ||
    !technical.terminationConfirmed || technical.stopped || technical.isError !== false || technical.resultSubtype !== 'success' ||
    canonicalJson(technical.models) !== canonicalJson([CAUSAL_MODELS.opus]) || !Number.isSafeInteger(technical.maximumMicroUsd) ||
    technical.maximumMicroUsd <= 0 || technical.maximumMicroUsd > config.maximumMicroUsd ||
    !extended && Math.ceil(technical.reportedCostUsd * 1e6) > technical.maximumMicroUsd || technical.qaVerdict !== 'PASS' ||
    technical.qaReviewHead !== config.sourceHead || technical.qaBase !== (extended ? 'b973b17fba433c4dc70df18ff847a7e7f7e33d94' : 'd9ae20dc29195004f1fed6d246daefbe42610953') ||
    extended && !z.string().uuid().safeParse(technical.sessionId).success ||
    technical.qaMode !== 'read_only_code') fail('reference_recovery_technical');
  const verify = () => {
    if (fencedText(configFile, 64000) !== bytes) fail('reference_recovery_config_changed');
    checked(config.visualConfig); checked(config.terminationReceipt); checked(config.technicalReviewReceipt); parent.verify();
    for (const [n, digest] of inventory) {
      const full = path.join(parent.job.directory, n); realDirectory(path.dirname(full)); const stat = lstatSync(full);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 32000000 || previewSha(readFileSync(full)) !== digest) fail('reference_recovery_evidence_changed');
    }
    if (visualEvidenceFiles(parent.directory).some(n => !inventory.has(`controlled-visual-continuation-20261008/${n}`))) fail('reference_recovery_inventory');
    simpleBookExternalCosts(allEngineering); checkGrant();
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
  if (grant && grant.inheritedKnownMicroUsd !== inherited.knownEstimateMicroUsd) fail('reference_recovery_allowance');
  if (externalMicroUsd + 600000 > config.maximumMicroUsd) fail('reference_recovery_budget');
  const directory = path.join(parent.job.directory, 'controlled-reference-recovery-20261008');
  const current = { ...parent.current, sourceHead: config.sourceHead };
  return { config, parent, result, view, inherited, extra, externalMicroUsd, directory, current, verify,
    seed: { name: 'child' as const, bytes: imageBytes, imageSha: candidate.imageSha, context: expectedContext, review: held.review }, claim() {
      verify(); mkdirSync(directory); exclusiveJson(path.join(directory, 'claim.json'), { configSha256: previewSha(bytes), sourceHead: config.sourceHead,
        requestDigest: claim.requestDigest, inherited, extra, referenceCorrectionLimit: 1, runtimeEligible: false,
        ...(extended ? { maximumMicroUsd: config.maximumMicroUsd, allowanceGrant: config.allowanceGrant } : {}) });
      const budget = new SimpleBookBudget(path.join(directory, 'paid-stages'), externalMicroUsd, config.maximumMicroUsd);
      let sequence = readdirSync(parent.job.directory).filter(n => /^view-\d{4}\.json$/.test(n)).length;
      const publish = (next: SimpleBookView) => {
        if (next.phase !== 'failed') verify(); const parsed = simpleBookViewSchema.parse(next);
        if (parsed.requestId !== parent.job.queued.requestId || sequence >= 80) fail('reference_recovery_view');
        exclusiveJson(path.join(parent.job.directory, `view-${String(++sequence).padStart(4, '0')}.json`), { requestDigest: claim.requestDigest, view: { ...parsed, revision: sequence } });
      };
      return { budget, publish };
    } };
}
