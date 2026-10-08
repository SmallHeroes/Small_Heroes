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
import { PREVIEW_JUDGE_INSTRUCTION } from '../local-preview-quality';
import { simpleBookViewSchema, type SimpleBookView } from './simple-book-view';
import { exclusiveJson, fencedText, realDirectory } from '../../scripts/personal-causal-trial-journal';
import { CAUSAL_MODELS } from '../../scripts/personal-causal-trial-adapters';
import { appearancePlanningSchema, APPEARANCE_INSTRUCTION } from '../../scripts/personal-simple-book-visual-continuation';
import { auditionUsageCost, readAuditionImage } from '../../scripts/personal-simple-book-illustrator';
import { simpleReferenceDesignContext, referenceRoleContext, REFERENCE_DESIGN_JUDGE_INSTRUCTION } from './simple-book-illustrations';
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
const referenceRecoveryV2 = referenceRecoveryV1.extend({ version: z.literal('controlled-simple-reference-recovery/v2'), maximumMicroUsd: z.literal(14000000), allowanceGrant: file });
export const referenceRecoveryConfigSchema = z.discriminatedUnion('version', [referenceRecoveryV1,
  referenceRecoveryV2, referenceRecoveryV2.extend({ version: z.literal('controlled-simple-reference-recovery/v3'),
    maximumMicroUsd: z.union([z.literal(14000000), z.literal(16000000)]), ceilingExtension: file.optional(),
    extraEngineeringReceipts: z.array(file).min(3).max(5), checkpoint: z.object({ config: file, terminationReceipt: file,
      artifacts: referenceRecoveryV1.shape.artifacts }).strict(), transportContinuation: z.object({ config: file, terminationReceipt: file,
      artifacts: referenceRecoveryV1.shape.artifacts, knownBeforeCurrentReviewMicroUsd: z.number().int().nonnegative(),
      ownerApprovalReference: z.string().min(30).max(2000), sameBookOnly: z.literal(true), publicRelease: z.literal(false),
      customerCharge: z.literal(false), gateChanges: z.literal(false) }).strict().optional() })]);
export const referenceCeilingExtensionSchema = z.object({ version: z.literal('local-simple-book-reference-ceiling/v1'),
  requestId: hash, priorAllowanceGrantSha256: hash, checkpointConfigSha256: hash,
  previousMaximumMicroUsd: z.literal(14000000), maximumMicroUsd: z.literal(16000000),
  knownBeforeFreshReviewMicroUsd: z.number().int().nonnegative(), failedReviewReceipt: file,
  ownerApprovalReference: z.string().min(30).max(2000), sameBookOnly: z.literal(true),
  publicRelease: z.literal(false), customerCharge: z.literal(false), gateChanges: z.literal(false),
}).strict();
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
  const extended = config.version !== 'controlled-simple-reference-recovery/v1';
  const checkpointConfig = config.version === 'controlled-simple-reference-recovery/v3' ? config.checkpoint : null;
  const checkpointDirectory = path.join(parent.job.directory, 'controlled-reference-recovery-20261008');
  const checkpointInventory = new Map(checkpointConfig?.artifacts.map(a => [a.relative, a.sha256]));
  const transportConfig = config.version === 'controlled-simple-reference-recovery/v3' ? config.transportContinuation : undefined;
  const transportDirectory = path.join(parent.job.directory, 'role-scoped-reference-continuation-20261008');
  const transportInventory = new Map(transportConfig?.artifacts.map(a => [a.relative, a.sha256]));
  const checkCeilingExtension = () => {
    if (config.version !== 'controlled-simple-reference-recovery/v3') return null;
    if (config.maximumMicroUsd === 14000000) {
      if (config.ceilingExtension || config.transportContinuation || config.extraEngineeringReceipts.length !== 3) fail('reference_recovery_ceiling');
      return null;
    }
    if (!config.ceilingExtension || config.extraEngineeringReceipts.length !== (transportConfig ? 5 : 4)) fail('reference_recovery_ceiling');
    checked(config.ceilingExtension!);
    const g = referenceCeilingExtensionSchema.parse(read(config.ceilingExtension!.file)); checked(g.failedReviewReceipt);
    const failed = read(g.failedReviewReceipt.file);
    if (g.requestId !== parent.job.queued.requestId || g.priorAllowanceGrantSha256 !== config.allowanceGrant.sha256 ||
      g.checkpointConfigSha256 !== config.checkpoint.config.sha256 ||
      canonicalJson(g.failedReviewReceipt) !== canonicalJson(config.extraEngineeringReceipts[2]) ||
      canonicalJson(config.technicalReviewReceipt) !== canonicalJson(config.extraEngineeringReceipts[config.extraEngineeringReceipts.length - 1]) ||
      failed.code !== 1 || failed.signal !== null || !failed.terminationConfirmed || failed.stopped || failed.status !== '' ||
      failed.isError !== true || failed.resultSubtype !== 'error_max_budget_usd' || failed.sourceBundleUnchanged !== true ||
      !/^[a-f0-9]{40}$/.test(failed.head ?? '') || !z.string().uuid().safeParse(failed.sessionId).success ||
      failed.sessionId === technical.sessionId || canonicalJson(failed.models) !== canonicalJson([CAUSAL_MODELS.opus]) ||
      config.extraEngineeringReceipts.some((f, i) => i !== 2 && read(f.file).sessionId === failed.sessionId)) fail('reference_recovery_ceiling');
    gitAt(parent.current.workspace, ['merge-base', '--is-ancestor', failed.head, config.sourceHead]);
    return g;
  };
  const checkGrant = () => {
    if (config.version === 'controlled-simple-reference-recovery/v1') return null;
    checked(config.allowanceGrant); const g = sameBookAllowanceGrantSchema.parse(read(config.allowanceGrant.file));
    if (g.requestId !== parent.job.queued.requestId || g.parentVisualConfigSha256 !== config.visualConfig.sha256 ||
      g.maximumMicroUsd !== 14000000 || config.extraEngineeringReceipts.length !== (transportConfig ? 5 : checkpointConfig ? config.maximumMicroUsd === 16000000 ? 4 : 3 : 2)) fail('reference_recovery_allowance');
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
  const grant = checkGrant(), ceilingExtension = checkCeilingExtension();
  if (technical.head !== config.sourceHead || technical.status !== '' || technical.code !== 0 || technical.signal !== null ||
    !technical.terminationConfirmed || technical.stopped || technical.isError !== false || technical.resultSubtype !== 'success' ||
    canonicalJson(technical.models) !== canonicalJson([CAUSAL_MODELS.opus]) || !Number.isSafeInteger(technical.maximumMicroUsd) ||
    technical.maximumMicroUsd <= 0 || technical.maximumMicroUsd > config.maximumMicroUsd ||
    !extended && Math.ceil(technical.reportedCostUsd * 1e6) > technical.maximumMicroUsd || technical.qaVerdict !== 'PASS' ||
    technical.qaReviewHead !== config.sourceHead || technical.qaBase !== (transportConfig ? '08a51c91fb02d57547bc52ef9682e3b223d5d7fa' : checkpointConfig ? '337971e0f767e2bbdf964bdf5700ad12b1698354' : extended ? 'b973b17fba433c4dc70df18ff847a7e7f7e33d94' : 'd9ae20dc29195004f1fed6d246daefbe42610953') ||
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
    simpleBookExternalCosts(allEngineering); checkGrant(); checkCeilingExtension();
    if (checkpointConfig) {
      checked(checkpointConfig.config); checked(checkpointConfig.terminationReceipt);
      if (checkpointInventory.size !== checkpointConfig.artifacts.length ||
        canonicalJson([...checkpointInventory.keys()].sort()) !== canonicalJson(visualEvidenceFiles(checkpointDirectory).sort())) fail('reference_checkpoint_inventory');
      for (const [n, digest] of checkpointInventory) {
        const full = path.join(checkpointDirectory, n); realDirectory(path.dirname(full)); const stat = lstatSync(full);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 32000000 || previewSha(readFileSync(full)) !== digest) fail('reference_checkpoint_changed');
      }
    }
    if (transportConfig) {
      checked(transportConfig.config); checked(transportConfig.terminationReceipt);
      if (transportInventory.size !== transportConfig.artifacts.length ||
        canonicalJson([...transportInventory.keys()].sort()) !== canonicalJson(visualEvidenceFiles(transportDirectory).sort())) fail('reference_transport_inventory');
      for (const [n, digest] of transportInventory) {
        const full = path.join(transportDirectory, n); realDirectory(path.dirname(full)); const stat = lstatSync(full);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 32000000 || previewSha(readFileSync(full)) !== digest) fail('reference_transport_changed');
      }
    }
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
  const extra = simpleBookExternalCosts(config.extraEngineeringReceipts);
  let checkpoint: { child: { bytes: Buffer; imageSha: string; context: unknown; review: unknown }; entities: { bytes: Buffer; imageSha: string } } | undefined;
  let checkpointPaidMicroUsd = 0;
  if (checkpointConfig) {
    const prior = referenceRecoveryV2.parse(read(checkpointConfig.config.file));
    if (prior.version !== 'controlled-simple-reference-recovery/v2' || canonicalJson(prior.visualConfig) !== canonicalJson(config.visualConfig) ||
      canonicalJson(prior.terminationReceipt) !== canonicalJson(config.terminationReceipt) || canonicalJson(prior.artifacts) !== canonicalJson(config.artifacts) ||
      canonicalJson(prior.allowanceGrant) !== canonicalJson(config.version === 'controlled-simple-reference-recovery/v3' ? config.allowanceGrant : null) ||
      canonicalJson(prior.extraEngineeringReceipts) !== canonicalJson(config.extraEngineeringReceipts.slice(0, 2)) ||
      !prior.extraEngineeringReceipts.some(f => canonicalJson(f) === canonicalJson(prior.technicalReviewReceipt))) fail('reference_checkpoint_config');
    gitAt(parent.current.workspace, ['merge-base', '--is-ancestor', prior.sourceHead, config.sourceHead]);
    const oldTechnical = read(prior.technicalReviewReceipt.file);
    if (oldTechnical.head !== prior.sourceHead || oldTechnical.qaReviewHead !== prior.sourceHead || oldTechnical.qaBase !== 'b973b17fba433c4dc70df18ff847a7e7f7e33d94' ||
      oldTechnical.qaMode !== 'read_only_code' || oldTechnical.qaVerdict !== 'PASS' || oldTechnical.isError !== false || oldTechnical.resultSubtype !== 'success' ||
      oldTechnical.code !== 0 || oldTechnical.signal !== null || !oldTechnical.terminationConfirmed || oldTechnical.status !== '' || oldTechnical.stopped ||
      !z.string().uuid().safeParse(oldTechnical.sessionId).success || oldTechnical.sessionId === technical.sessionId ||
      canonicalJson(oldTechnical.models) !== canonicalJson([CAUSAL_MODELS.opus])) fail('reference_checkpoint_technical');
    const host = read(checkpointConfig.terminationReceipt.file), claim = read(path.join(checkpointDirectory, 'claim.json'));
    if (host.head !== prior.sourceHead || host.status !== '' || host.code !== 1 || host.signal !== null || !host.terminationConfirmed || host.stopped || host.referenceCap !== 4 ||
      claim.sourceHead !== prior.sourceHead || claim.configSha256 !== checkpointConfig.config.sha256 || claim.requestDigest !== parent.repair.parent.oldClaim.requestDigest ||
      canonicalJson(claim.inherited) !== canonicalJson(inherited) || claim.extra !== simpleBookExternalCosts(prior.extraEngineeringReceipts) ||
      claim.maximumMicroUsd !== 14000000 || canonicalJson(claim.allowanceGrant) !== canonicalJson(prior.allowanceGrant)) fail('reference_checkpoint_termination');
    realDirectory(path.join(checkpointDirectory, 'paid-stages')); // admission must not create a missing historical journal
    const priorBudget = new SimpleBookBudget(path.join(checkpointDirectory, 'paid-stages'), inherited.accountedMicroUsd + claim.extra, 14000000);
    const snapshot = priorBudget.snapshot(), seal = read(path.join(checkpointDirectory, 'sealed.json'));
    if (seal.status !== 'failed' || seal.code !== 'simple_reference_held' || seal.sourceHead !== prior.sourceHead || seal.runtimeEligible !== false || seal.inheritedLogicalAttempts !== 17 ||
      canonicalJson(seal.snapshot) !== canonicalJson(snapshot) || host.sealSha256 !== previewSha(fencedText(path.join(checkpointDirectory, 'sealed.json'), 64000)) ||
      snapshot.logicalAttempts !== 4 || snapshot.stopped || snapshot.unknownAttemptCosts || snapshot.accountedMicroUsd !== snapshot.knownEstimateMicroUsd)
      fail('reference_checkpoint_outcome');
    const names = ['reference_child_repair', 'reference_child_qa', 'reference_entities', 'reference_entities_qa'];
    const stages = names.map(name => {
      const wire = read(path.join(priorBudget.root, `${name}.wire.json`)), receipt = read(path.join(priorBudget.root, `${name}.receipt.json`));
      const claim = read(path.join(priorBudget.root, `${name}.claim.json`)), outcome = read(path.join(priorBudget.root, `${name}.result.json`));
      const pixel = name.endsWith('_qa'), expected = auditionUsageCost(receipt.raw?.usage, pixel ? 'sol' : 'image');
      if (claim.step !== name || claim.wireDigest !== previewSha(canonicalJson(wire)) || outcome.wireDigest !== claim.wireDigest || !outcome.completed ||
        expected === null || expected !== outcome.estimatedMicroUsd || expected !== receipt.estimatedMicroUsd || expected > claim.maximumMicroUsd ||
        pixel && (wire.model !== 'gpt-6.1-sol' || wire.instructions !== PREVIEW_JUDGE_INSTRUCTION || wire.store !== false ||
          wire.max_output_tokens !== 12000 || receipt.raw.model !== wire.model || receipt.raw.status !== 'completed' || receipt.raw.service_tier !== 'default' ||
          !receipt.raw.output_text || receipt.raw.usage.output_tokens > wire.max_output_tokens) ||
        !pixel && (receipt.model !== 'gpt-image-2' || wire.body.model !== 'gpt-image-2' || wire.body.quality !== 'low' || wire.body.size !== '1024x1024' || wire.body.n !== 1))
        fail('reference_checkpoint_paid_binding');
      return { wire, receipt };
    });
    const expectedEntities = simpleReferenceDesignContext({ props: book.plan.recurringProps, entities: book.plan.continuity!.entities });
    const checkedPair = (image: typeof stages[number], pixel: typeof stages[number], context: unknown, name: string) => {
      const c = image.receipt.candidate, bytes = readAuditionImage(path.join(checkpointDirectory, 'illustrations'), c);
      const data = JSON.parse(pixel.wire.input[0].content[0].text), review = qualityDisposition(JSON.parse(pixel.receipt.raw.output_text), c.imageSha, previewSha(JSON.stringify(context)));
      if (previewSha(Buffer.from(image.receipt.raw.data?.[0]?.b64_json ?? '', 'base64')) !== c.imageSha || data.candidateSha !== c.imageSha ||
        data.contextSha !== review.review.contextSha || canonicalJson(data.context) !== canonicalJson(context) ||
        canonicalJson(data.imageRoles) !== canonicalJson(['candidate_complete', 'candidate_crop_top_left', 'candidate_crop_top_right', 'candidate_crop_bottom_left', 'candidate_crop_bottom_right']) ||
        pixel.wire.input[0].content.length !== 6 || previewSha(Buffer.from(pixel.wire.input[0].content[1].image_url.split(',')[1], 'base64')) !== c.imageSha ||
        canonicalJson(review) !== canonicalJson(read(path.join(checkpointDirectory, name)))) fail('reference_checkpoint_pixels');
      return { bytes, imageSha: c.imageSha, context, review: review.review, disposition: review.disposition };
    };
    const child = checkedPair(stages[0], stages[1], expectedContext, 'reference_child_review.json');
    const entities = checkedPair(stages[2], stages[3], expectedEntities, 'reference_entities_review.json');
    if (child.disposition !== 'passed' || entities.disposition !== 'held_uncertain' || stages[0].wire.references.length !== 1 ||
      stages[0].wire.references[0].imageSha !== candidate.imageSha || stages[2].wire.references.length !== 0 ||
      visualEvidenceFiles(priorBudget.root).filter(n => n.endsWith('.claim.json')).length !== 4 ||
      visualEvidenceFiles(checkpointDirectory).some(n => /^(?:audition_references|illustrated_book|book\.html|page_)/.test(n))) fail('reference_checkpoint_scope');
    checkpoint = { child, entities }; checkpointPaidMicroUsd = snapshot.knownEstimateMicroUsd - priorBudget.externalMicroUsd;
  }
  let transportPaidMicroUsd = 0;
  if (transportConfig && config.version === 'controlled-simple-reference-recovery/v3') {
    const prior = referenceRecoveryConfigSchema.parse(read(transportConfig.config.file));
    if (prior.version !== 'controlled-simple-reference-recovery/v3') return fail('reference_transport_config');
    if (prior.transportContinuation || prior.maximumMicroUsd !== 16000000 ||
      canonicalJson(prior.visualConfig) !== canonicalJson(config.visualConfig) || canonicalJson(prior.terminationReceipt) !== canonicalJson(config.terminationReceipt) ||
      canonicalJson(prior.artifacts) !== canonicalJson(config.artifacts) || canonicalJson(prior.checkpoint) !== canonicalJson(config.checkpoint) ||
      canonicalJson(prior.allowanceGrant) !== canonicalJson(config.allowanceGrant) || canonicalJson(prior.ceilingExtension) !== canonicalJson(config.ceilingExtension) ||
      canonicalJson(prior.extraEngineeringReceipts) !== canonicalJson(config.extraEngineeringReceipts.slice(0, 4)) ||
      canonicalJson(prior.technicalReviewReceipt) !== canonicalJson(config.extraEngineeringReceipts[3])) fail('reference_transport_config');
    gitAt(parent.current.workspace, ['merge-base', '--is-ancestor', prior.sourceHead, config.sourceHead]);
    checked(prior.technicalReviewReceipt); const oldTechnical = read(prior.technicalReviewReceipt.file);
    if (oldTechnical.head !== prior.sourceHead || oldTechnical.qaReviewHead !== prior.sourceHead || oldTechnical.qaBase !== '337971e0f767e2bbdf964bdf5700ad12b1698354' ||
      oldTechnical.qaMode !== 'read_only_code' || oldTechnical.qaVerdict !== 'PASS' || oldTechnical.code !== 0 || oldTechnical.signal !== null ||
      !oldTechnical.terminationConfirmed || oldTechnical.stopped || oldTechnical.status !== '' || oldTechnical.isError !== false || oldTechnical.resultSubtype !== 'success' ||
      !z.string().uuid().safeParse(oldTechnical.sessionId).success || oldTechnical.sessionId === technical.sessionId ||
      canonicalJson(oldTechnical.models) !== canonicalJson([CAUSAL_MODELS.opus])) fail('reference_transport_technical');
    const oldExtra = simpleBookExternalCosts(prior.extraEngineeringReceipts), before = inherited.accountedMicroUsd + oldExtra + checkpointPaidMicroUsd;
    const host = read(transportConfig.terminationReceipt.file), oldClaim = read(path.join(transportDirectory, 'claim.json'));
    if (host.head !== prior.sourceHead || host.status !== '' || host.code !== 1 || host.signal !== null || !host.terminationConfirmed || host.stopped || host.referenceCap !== 4 ||
      oldClaim.sourceHead !== prior.sourceHead || oldClaim.configSha256 !== transportConfig.config.sha256 || oldClaim.requestDigest !== claim.requestDigest ||
      canonicalJson(oldClaim.inherited) !== canonicalJson(inherited) || oldClaim.extra !== oldExtra || oldClaim.maximumMicroUsd !== 16000000 ||
      canonicalJson(oldClaim.allowanceGrant) !== canonicalJson(prior.allowanceGrant) || canonicalJson(oldClaim.ceilingExtension) !== canonicalJson(prior.ceilingExtension) ||
      canonicalJson(oldClaim.checkpoint) !== canonicalJson(checkpointConfig) || oldClaim.checkpointPaidMicroUsd !== checkpointPaidMicroUsd || oldClaim.inheritedLogicalAttempts !== 21)
      fail('reference_transport_termination');
    realDirectory(path.join(transportDirectory, 'paid-stages'));
    const oldBudget = new SimpleBookBudget(path.join(transportDirectory, 'paid-stages'), before, 16000000), snapshot = oldBudget.snapshot();
    const oldSeal = read(path.join(transportDirectory, 'sealed.json'));
    if (oldSeal.status !== 'failed' || oldSeal.code !== 'simple_reference_held' || oldSeal.sourceHead !== prior.sourceHead || oldSeal.runtimeEligible !== false ||
      oldSeal.inheritedLogicalAttempts !== 21 || host.sealSha256 !== previewSha(fencedText(path.join(transportDirectory, 'sealed.json'), 64000)) ||
      canonicalJson(oldSeal.snapshot) !== canonicalJson(snapshot) || snapshot.logicalAttempts !== 3 || snapshot.unknownAttemptCosts || snapshot.stopped ||
      snapshot.accountedMicroUsd !== snapshot.knownEstimateMicroUsd || transportConfig.knownBeforeCurrentReviewMicroUsd !== snapshot.knownEstimateMicroUsd)
      fail('reference_transport_outcome');
    const rolesContext = referenceRoleContext('entities', { props: book.plan.recurringProps, entities: book.plan.continuity!.entities,
      childClothingAuthority: book.plan.actorAppearance?.child.clothing ?? book.plan.wardrobe });
    const names = ['reference_entities_recheck', 'reference_entities_repair', 'reference_entities_repair_qa'];
    const entries = names.map(name => {
      const wire = read(path.join(oldBudget.root, `${name}.wire.json`)), receipt = read(path.join(oldBudget.root, `${name}.receipt.json`));
      const c = read(path.join(oldBudget.root, `${name}.claim.json`)), outcome = read(path.join(oldBudget.root, `${name}.result.json`));
      const pixel = name !== 'reference_entities_repair', expected = auditionUsageCost(receipt.raw?.usage, pixel ? 'sol' : 'image');
      if (c.step !== name || c.wireDigest !== previewSha(canonicalJson(wire)) || outcome.wireDigest !== c.wireDigest || !outcome.completed || expected === null ||
        expected !== receipt.estimatedMicroUsd || expected !== outcome.estimatedMicroUsd || expected > c.maximumMicroUsd ||
        pixel && (wire.model !== 'gpt-6.1-sol' || wire.instructions !== REFERENCE_DESIGN_JUDGE_INSTRUCTION || wire.store !== false || wire.max_output_tokens !== 12000 ||
          receipt.raw.model !== wire.model || receipt.raw.status !== 'completed' || receipt.raw.service_tier !== 'default' || !receipt.raw.output_text || receipt.raw.usage.output_tokens > wire.max_output_tokens) ||
        !pixel && (receipt.model !== 'gpt-image-2' || wire.body.model !== 'gpt-image-2' || wire.body.quality !== 'low' || wire.body.size !== '1024x1024' || wire.body.n !== 1))
        fail('reference_transport_paid_binding');
      return { wire, receipt, estimatedMicroUsd: expected! };
    });
    const child = checkpoint!.child, oldEntity = checkpoint!.entities, companion = readFileSync(path.join(transportDirectory, 'illustrations/companion_reference.png'));
    if (previewSha(readFileSync(path.join(transportDirectory, 'illustrations/reference_child_checkpoint.png'))) !== child.imageSha ||
      previewSha(readFileSync(path.join(transportDirectory, 'illustrations/reference_entities_checkpoint.png'))) !== oldEntity.imageSha)
      fail('reference_transport_authorities');
    const checkedReview = (entry: typeof entries[number], candidateSha: string, saved: string) => {
      const data = JSON.parse(entry.wire.input[0].content[0].text), content = entry.wire.input[0].content;
      const q = qualityDisposition(JSON.parse(entry.receipt.raw.output_text), candidateSha, previewSha(JSON.stringify(rolesContext)));
      const img = (n: number) => previewSha(Buffer.from(content[n].image_url.split(',')[1], 'base64'));
      if (data.candidateSha !== candidateSha || data.contextSha !== q.review.contextSha || canonicalJson(data.context) !== canonicalJson(rolesContext) || content.length !== 8 ||
        canonicalJson(data.imageRoles) !== canonicalJson(['candidate_complete', 'candidate_crop_top_left', 'candidate_crop_top_right', 'candidate_crop_bottom_left', 'candidate_crop_bottom_right', 'canonical_child', 'canonical_companion']) ||
        img(1) !== candidateSha || img(6) !== child.imageSha || img(7) !== previewSha(companion) || canonicalJson(q) !== canonicalJson(read(path.join(transportDirectory, saved))) || q.disposition !== 'repair')
        fail('reference_transport_pixels');
      return q;
    };
    checkedReview(entries[0], oldEntity.imageSha, 'reference_entities_recheck_review.json');
    const image = entries[1].receipt.candidate, pixels = readAuditionImage(path.join(transportDirectory, 'illustrations'), image);
    if (previewSha(Buffer.from(entries[1].receipt.raw.data?.[0]?.b64_json ?? '', 'base64')) !== image.imageSha || image.imageSha === oldEntity.imageSha ||
      canonicalJson(entries[1].wire.references) !== canonicalJson([{ imageName: 'reference_entities_checkpoint.png', imageSha: oldEntity.imageSha },
        { imageName: 'reference_child_checkpoint.png', imageSha: child.imageSha }, { imageName: 'companion_reference.png', imageSha: previewSha(companion) }])) fail('reference_transport_edit');
    checkedReview(entries[2], image.imageSha, 'reference_entities_review.json');
    const adoption = read(path.join(transportDirectory, 'reference_child_adoption.json'));
    if (canonicalJson(adoption) !== canonicalJson({ name: 'child', candidate: { imageName: 'reference_child_checkpoint.png', imageSha: child.imageSha },
      context: child.context, review: child.review, authority: 'unchanged_supported_original_context' }) ||
      visualEvidenceFiles(oldBudget.root).filter(n => n.endsWith('.claim.json')).length !== 3 ||
      visualEvidenceFiles(transportDirectory).some(n => /^(?:audition_references|illustrated_book|book\.html|page_)/.test(n))) fail('reference_transport_scope');
    transportPaidMicroUsd = entries.reduce((sum, e) => sum + e.estimatedMicroUsd, 0);
    if (before + transportPaidMicroUsd !== snapshot.knownEstimateMicroUsd) fail('reference_transport_cost');
    checkpoint = { child, entities: { bytes: pixels, imageSha: image.imageSha } };
  }
  const externalMicroUsd = inherited.accountedMicroUsd + extra + checkpointPaidMicroUsd + transportPaidMicroUsd;
  const originalCeilingBeforeReview = transportConfig ? inherited.accountedMicroUsd + simpleBookExternalCosts(config.extraEngineeringReceipts.slice(0, 3)) + checkpointPaidMicroUsd
    : externalMicroUsd - simpleBookExternalCosts([config.technicalReviewReceipt]);
  if (ceilingExtension && ceilingExtension.knownBeforeFreshReviewMicroUsd !== originalCeilingBeforeReview) fail('reference_recovery_ceiling');
  if (transportConfig && transportConfig.knownBeforeCurrentReviewMicroUsd !== externalMicroUsd - simpleBookExternalCosts([config.technicalReviewReceipt])) fail('reference_transport_cost');
  if (grant && grant.inheritedKnownMicroUsd !== inherited.knownEstimateMicroUsd) fail('reference_recovery_allowance');
  if (externalMicroUsd + 600000 > config.maximumMicroUsd) fail('reference_recovery_budget');
  const directory = path.join(parent.job.directory, transportConfig ? 'reference-transport-continuation-20261008' : checkpoint ? 'role-scoped-reference-continuation-20261008' : 'controlled-reference-recovery-20261008');
  const current = { ...parent.current, sourceHead: config.sourceHead };
  return { config, parent, result, view, inherited, extra, externalMicroUsd, directory, current, verify, checkpoint,
    explicitReferenceTransport: transportConfig ? true as const : undefined,
    inheritedLogicalAttempts: transportConfig ? 24 : checkpoint ? 21 : 17,
    seed: checkpoint ? undefined : { name: 'child' as const, bytes: imageBytes, imageSha: candidate.imageSha, context: expectedContext, review: held.review }, claim() {
      verify(); mkdirSync(directory); exclusiveJson(path.join(directory, 'claim.json'), { configSha256: previewSha(bytes), sourceHead: config.sourceHead,
        requestDigest: claim.requestDigest, inherited, extra, referenceCorrectionLimit: 1, runtimeEligible: false,
        ...(extended ? { maximumMicroUsd: config.maximumMicroUsd, allowanceGrant: config.allowanceGrant } : {}),
        ...(config.version === 'controlled-simple-reference-recovery/v3' && config.ceilingExtension ? { ceilingExtension: config.ceilingExtension } : {}),
        ...(checkpointConfig ? { checkpoint: checkpointConfig, checkpointPaidMicroUsd, inheritedLogicalAttempts: transportConfig ? 24 : 21 } : {}),
        ...(transportConfig ? { transportContinuation: transportConfig, transportPaidMicroUsd } : {}) });
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
