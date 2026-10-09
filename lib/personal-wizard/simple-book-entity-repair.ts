import 'server-only';
import path from 'node:path';
import { lstatSync, readFileSync, readdirSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';
import { z } from 'zod';
import { prepareEntityAuthorityContinuation } from './simple-book-entity-authority';
import { SimpleBookBudget, simpleBookExternalCosts } from './simple-book-budget';
import { referenceRoleContext, REFERENCE_DESIGN_JUDGE_INSTRUCTION } from './simple-book-illustrations';
import { simpleBookViewSchema, type SimpleBookView } from './simple-book-view';
import { visualEvidenceFiles } from './simple-book-visual-continuation';
import { canonicalJson } from './request-acceptance';
import { previewSha } from '../local-story-preview';
import { qualityDisposition } from '../local-preview-quality';
import { auditionUsageCost, readAuditionImage } from '../../scripts/personal-simple-book-illustrator';
import { fencedText, realDirectory, exclusiveJson } from '../../scripts/personal-causal-trial-journal';
import { gitAt } from '../../scripts/personal-source-git';
import { CAUSAL_MODELS } from '../../scripts/personal-causal-trial-adapters';
import { simpleReferenceEntityDesign } from './simple-reference-designs';

const hash = z.string().regex(/^[a-f0-9]{64}$/), file = z.object({ file: z.string().min(1), sha256: hash }).strict();
export const entityRepairContinuationSchema = z.object({ version: z.literal('controlled-simple-entity-repair/v1'),
  sourceHead: z.string().regex(/^[a-f0-9]{40}$/), sourceBase: z.string().regex(/^[a-f0-9]{40}$/),
  parentConfig: file, parentTermination: file, parentArtifacts: z.array(z.object({ relative: z.string()
    .regex(/^(?:[a-z0-9_-]+\/)*[a-z0-9_.-]+\.(?:json|txt|log|md|png)$/).refine(s => !s.split('/').includes('..')), sha256: hash }).strict()).min(10).max(256),
  technicalReviewReceipt: file, maximumMicroUsd: z.literal(22000000), correctionCount: z.literal(1),
  ownerApprovalReference: z.string().min(30).max(2000), sameBookOnly: z.literal(true), publicRelease: z.literal(false),
  customerCharge: z.literal(false), gateChanges: z.literal(false),
}).strict();
export const referenceStateContinuationSchema = entityRepairContinuationSchema.omit({ version: true, correctionCount: true, maximumMicroUsd: true }).extend({
  version: z.literal('controlled-simple-reference-state/v1'), generationCount: z.literal(1), stateAwareReferences: z.literal(true),
  maximumMicroUsd: z.union([z.literal(22000000), z.literal(25000000)]), ceilingExtension: file.optional(),
}).strict();
export const referenceStateCeilingSchema = z.object({ version: z.literal('local-simple-reference-state-ceiling/v1'),
  requestId: hash, parentConfigSha256: hash, previousMaximumMicroUsd: z.literal(22000000), maximumMicroUsd: z.literal(25000000),
  knownBeforeContinuationMicroUsd: z.number().int().nonnegative(), ownerApprovalReference: z.string().min(30).max(2000),
  sameBookOnly: z.literal(true), publicRelease: z.literal(false), customerCharge: z.literal(false), gateChanges: z.literal(false),
}).strict();
const fail = (code: string): never => { throw Object.assign(new Error(code), { code }); };
const read = (p: string) => JSON.parse(fencedText(p, 32000000));

/** ONE admitted correction of a sealed, known-cost failed atlas. No automatic retry. */
export async function prepareEntityRepairContinuation(configFile: string, activeSourceHead?: string) {
  if (!path.isAbsolute(configFile)) fail('entity_repair_config');
  const bytes = fencedText(configFile, 64000), config = entityRepairContinuationSchema.parse(JSON.parse(bytes));
  const checked = (f: z.infer<typeof file>) => {
    if (!path.isAbsolute(f.file) || previewSha(fencedText(f.file, 32000000)) !== f.sha256) fail('entity_repair_file');
  };
  [config.parentConfig, config.parentTermination, config.technicalReviewReceipt].forEach(checked);
  const frozenHead = activeSourceHead ?? config.sourceHead;
  const prior = await prepareEntityAuthorityContinuation(config.parentConfig.file, frozenHead);
  gitAt(prior.current.workspace, ['merge-base', '--is-ancestor', config.sourceHead, frozenHead]);
  if (prior.config.maximumMicroUsd !== config.maximumMicroUsd) fail('entity_repair_parent_scope');
  gitAt(prior.current.workspace, ['merge-base', '--is-ancestor', prior.config.sourceHead, config.sourceBase]);
  gitAt(prior.current.workspace, ['merge-base', '--is-ancestor', config.sourceBase, config.sourceHead]);
  const checkInventory = () => assertAtlasInventory(prior.directory, config.parentArtifacts);
  const technical = read(config.technicalReviewReceipt.file), previousTechnical = read(prior.config.technicalReviewReceipt.file);
  const currentFee = simpleBookExternalCosts([config.technicalReviewReceipt]), previousFee = simpleBookExternalCosts([prior.config.technicalReviewReceipt]);
  if (technical.head !== config.sourceHead || technical.qaReviewHead !== config.sourceHead || technical.qaBase !== config.sourceBase ||
      technical.code !== 0 || technical.signal !== null || !technical.terminationConfirmed || technical.stopped || technical.status !== '' ||
      technical.isError !== false || technical.resultSubtype !== 'success' || technical.sourceBundleUnchanged !== true || technical.qaVerdict !== 'PASS' || technical.qaMode !== 'read_only_code' ||
      technical.sessionId !== previousTechnical.sessionId || technical.costKind !== 'cumulative_same_cli_session_list_estimate_not_invoice' ||
      technical.includesPreviousKnownFailedCalls !== true || technical.previousCumulativeReportedCostUsd !== previousTechnical.reportedCostUsd || currentFee <= previousFee ||
      canonicalJson(technical.models) !== canonicalJson([CAUSAL_MODELS.opus]) || !Number.isSafeInteger(technical.maximumMicroUsd) ||
      technical.maximumMicroUsd <= 0 || currentFee > technical.maximumMicroUsd) fail('entity_repair_technical');
  const verify = () => {
    if (fencedText(configFile, 64000) !== bytes || gitAt(prior.current.workspace, ['rev-parse', 'HEAD']).toString().trim() !== frozenHead ||
        gitAt(prior.current.workspace, ['status', '--porcelain']).toString().trim()) fail('entity_repair_source_changed');
    [config.parentConfig, config.parentTermination, config.technicalReviewReceipt].forEach(checked); prior.verify(); checkInventory();
  };
  verify();
  const { snapshot, requestDigest, pixels, candidate, review } = await readEndedEntityAtlas(prior, config);
  if (technical.knownBeforeMicroUsd !== snapshot.knownEstimateMicroUsd) fail('entity_repair_cost');
  const externalMicroUsd = snapshot.knownEstimateMicroUsd + currentFee - previousFee;
  if (externalMicroUsd + 600000 > config.maximumMicroUsd) fail('entity_repair_budget');
  const inheritedLogicalAttempts = prior.inheritedLogicalAttempts + snapshot.logicalAttempts;
  if (inheritedLogicalAttempts >= 80) fail('entity_repair_attempts');
  const directory = path.join(prior.parent.job.directory, 'reference-entity-repair-continuation-20261009');
  return { ...prior, config, directory, current: { ...prior.current, sourceHead: config.sourceHead }, verify,
    engineeringReceipts: prior.engineeringReceipts.map(f => canonicalJson(f) === canonicalJson(prior.config.technicalReviewReceipt)
      ? config.technicalReviewReceipt : f),
    inherited: snapshot, extra: currentFee - previousFee, externalMicroUsd, inheritedLogicalAttempts,
    checkpoint: { child: prior.checkpoint.child, entities: { bytes: pixels, imageSha: candidate.imageSha } }, entityRepairReview: review.review,
    claim() { verify(); mkdirSync(directory); exclusiveJson(path.join(directory, 'claim.json'), { sourceHead: config.sourceHead,
      configSha256: previewSha(bytes), requestDigest, inherited: snapshot, externalMicroUsd, inheritedLogicalAttempts, correctionCount: 1, runtimeEligible: false });
      const budget = new SimpleBookBudget(path.join(directory, 'paid-stages'), externalMicroUsd, config.maximumMicroUsd, inheritedLogicalAttempts);
      let sequence = readdirSync(prior.parent.job.directory).filter(n => /^view-\d{4}\.json$/.test(n)).length;
      const publish = (next: SimpleBookView) => { if (next.phase !== 'failed') verify(); const view = simpleBookViewSchema.parse(next);
        if (view.requestId !== prior.parent.job.queued.requestId || sequence >= 80) fail('entity_repair_view');
        exclusiveJson(path.join(prior.parent.job.directory, `view-${String(++sequence).padStart(4, '0')}.json`), { requestDigest, view: { ...view, revision: sequence } }); };
      return { budget, publish }; },
  };
}

function assertAtlasInventory(directory: string, entries: z.infer<typeof entityRepairContinuationSchema>['parentArtifacts']) {
  realDirectory(directory); const names = entries.map(f => f.relative);
  if (new Set(names).size !== names.length || canonicalJson([...names].sort()) !== canonicalJson(visualEvidenceFiles(directory).sort())) fail('entity_repair_inventory');
  for (const f of entries) { const p = path.join(directory, f.relative), s = lstatSync(p); realDirectory(path.dirname(p));
    if (!s.isFile() || s.isSymbolicLink() || s.nlink !== 1 || s.size > 32000000 || previewSha(readFileSync(p)) !== f.sha256) fail('entity_repair_inventory'); }
}
type AtlasParent = Pick<Awaited<ReturnType<typeof prepareEntityAuthorityContinuation>>,
  'directory' | 'externalMicroUsd' | 'parent' | 'result' | 'inheritedLogicalAttempts' | 'checkpoint' | 'entityDesignAuthority' | 'current' | 'config'>;
/** Both legacy and state continuation bind the actual ended pixels; neither reopens a seal. */
async function readEndedEntityAtlas(prior: Omit<AtlasParent, 'config'> & { config: { maximumMicroUsd: number } },
  config: Pick<z.infer<typeof entityRepairContinuationSchema>, 'parentTermination' | 'parentConfig'>, repaired = false) {
  // Admission must not recreate a missing historical journal through the meter.
  realDirectory(path.join(prior.directory, 'paid-stages'));
  const oldBudget = new SimpleBookBudget(path.join(prior.directory, 'paid-stages'), prior.externalMicroUsd, prior.config.maximumMicroUsd);
  const snapshot = oldBudget.snapshot(), terminal = read(config.parentTermination.file), seal = read(path.join(prior.directory, 'sealed.json'));
  const requestDigest = previewSha(canonicalJson(prior.parent.job.queued)), oldClaim = read(path.join(prior.directory, 'claim.json'));
  if (snapshot.unknownAttemptCosts || snapshot.stopped || snapshot.logicalAttempts !== 2 || snapshot.accountedMicroUsd !== snapshot.knownEstimateMicroUsd ||
      terminal.head !== prior.current.sourceHead || terminal.status !== '' || terminal.code !== 1 || terminal.signal !== null || !terminal.terminationConfirmed || terminal.stopped ||
      terminal.referenceCap !== 4 || terminal.sealSha256 !== previewSha(fencedText(path.join(prior.directory, 'sealed.json'), 64000)) ||
      seal.status !== 'failed' || seal.code !== 'simple_reference_held' || seal.sourceHead !== prior.current.sourceHead || seal.runtimeEligible !== false ||
      canonicalJson(seal.snapshot) !== canonicalJson(snapshot) || seal.inheritedLogicalAttempts !== prior.inheritedLogicalAttempts ||
      oldClaim.configSha256 !== config.parentConfig.sha256 || oldClaim.sourceHead !== prior.current.sourceHead || oldClaim.requestDigest !== requestDigest ||
      oldClaim.externalMicroUsd !== prior.externalMicroUsd || oldClaim.inheritedLogicalAttempts !== prior.inheritedLogicalAttempts ||
      visualEvidenceFiles(prior.directory).some(n => /^(?:page_|book\.html|illustrated_book|audition_references)/.test(n))) fail('entity_repair_parent_outcome');
  const stages = (repaired ? ['reference_entities_repair', 'reference_entities_repair_qa'] : ['reference_entities', 'reference_entities_qa']).map((step, i) => {
    const wire = read(path.join(oldBudget.root, `${step}.wire.json`)), c = read(path.join(oldBudget.root, `${step}.claim.json`)),
      outcome = read(path.join(oldBudget.root, `${step}.result.json`)), receipt = read(path.join(oldBudget.root, `${step}.receipt.json`));
    const expected = auditionUsageCost(receipt.raw?.usage, i ? 'sol' : 'image');
    if (c.step !== step || c.wireDigest !== previewSha(canonicalJson(wire)) || outcome.wireDigest !== c.wireDigest || !outcome.completed ||
        expected === null || outcome.estimatedMicroUsd !== expected || receipt.estimatedMicroUsd !== expected || expected > c.maximumMicroUsd ||
        i === 0 && (receipt.model !== 'gpt-image-2' || wire.body.model !== 'gpt-image-2' || wire.body.quality !== 'low' || wire.body.size !== '1024x1024' || wire.body.n !== 1) ||
        i === 1 && (wire.model !== 'gpt-6.1-sol' || wire.instructions !== REFERENCE_DESIGN_JUDGE_INSTRUCTION || wire.store !== false || wire.max_output_tokens !== 12000 ||
          receipt.raw.model !== wire.model || receipt.raw.status !== 'completed' || receipt.raw.service_tier !== 'default' || !receipt.raw.output_text || receipt.raw.usage.output_tokens > wire.max_output_tokens)) fail('entity_repair_paid_binding');
    return { wire, receipt, expected: expected! };
  });
  if (prior.externalMicroUsd + stages.reduce((s, r) => s + r.expected, 0) !== snapshot.knownEstimateMicroUsd) fail('entity_repair_cost');
  const candidate = stages[0].receipt.candidate, pixels = readAuditionImage(path.join(prior.directory, 'illustrations'), candidate);
  if (previewSha(Buffer.from(stages[0].receipt.raw.data?.[0]?.b64_json ?? '', 'base64')) !== candidate.imageSha) fail('entity_repair_pixels');
  const content = stages[1].wire.input[0].content, data = JSON.parse(content[0].text), book = prior.result.storyboard!.storyboard;
  const context = referenceRoleContext('entities', simpleReferenceEntityDesign(book, true));
  const contextSha = previewSha(JSON.stringify(context));
  if (data.candidateSha !== candidate.imageSha || data.contextSha !== contextSha || canonicalJson(data.context) !== canonicalJson(context)) fail('entity_repair_context');
  const review = qualityDisposition(JSON.parse(stages[1].receipt.raw.output_text), candidate.imageSha, contextSha);
  if (review.disposition === 'passed' || !review.review.checks.some(c => c.verdict === 'defect') ||
      canonicalJson(review) !== canonicalJson(read(path.join(prior.directory, 'reference_entities_review.json')))) fail('entity_repair_not_failed');
  const imageSha = (n: number) => previewSha(Buffer.from(content[n].image_url.split(',')[1], 'base64'));
  const companionSha = previewSha(readFileSync(path.join(prior.directory, 'illustrations/companion_reference.png')));
  if (content.length !== 8 || imageSha(1) !== candidate.imageSha || imageSha(6) !== prior.checkpoint.child.imageSha || imageSha(7) !== companionSha ||
      canonicalJson(data.imageRoles) !== canonicalJson(['candidate_complete', 'candidate_crop_top_left', 'candidate_crop_top_right', 'candidate_crop_bottom_left', 'candidate_crop_bottom_right', 'canonical_child', 'canonical_companion']) ||
      canonicalJson(stages[0].wire.referenceRoles) !== canonicalJson([...(repaired ? ['rejected_edit_target'] : []),
        'child_design_authority', 'companion_design_authority', 'entity_design_authority']) ||
      canonicalJson(stages[0].wire.references.map((r: { imageSha: string }) => r.imageSha)) !== canonicalJson([
        ...(repaired ? [prior.checkpoint.entities.imageSha] : []), prior.checkpoint.child.imageSha, companionSha, prior.entityDesignAuthority.imageSha])) fail('entity_repair_actor_binding');
  const meta = await sharp(pixels).metadata(), width = meta.width!, height = meta.height!, cw = Math.ceil(width * .7), ch = Math.ceil(height * .7);
  for (const [i, [left, top]] of [[0, 0], [width - cw, 0], [0, height - ch], [width - cw, height - ch]].entries()) {
    if (imageSha(i + 2) !== previewSha(await sharp(pixels).extract({ left, top, width: cw, height: ch }).png().toBuffer())) fail('entity_repair_crop_binding');
  }
  return { snapshot, requestDigest, pixels, candidate, review };
}

/** ONE explicitly approved data-corrected reference proof, after a consumed repair. */
export async function prepareReferenceStateContinuation(configFile: string) {
  if (!path.isAbsolute(configFile)) fail('reference_state_config');
  const bytes = fencedText(configFile, 64000), config = referenceStateContinuationSchema.parse(JSON.parse(bytes));
  const checked = (f: z.infer<typeof file>) => {
    if (!path.isAbsolute(f.file) || previewSha(fencedText(f.file, 32000000)) !== f.sha256) fail('reference_state_file');
  };
  [config.parentConfig, config.parentTermination, config.technicalReviewReceipt].forEach(checked);
  // Strict M14 parent prevents chaining another M15 generation or reopening it.
  entityRepairContinuationSchema.parse(read(config.parentConfig.file));
  const prior = await prepareEntityRepairContinuation(config.parentConfig.file, config.sourceHead);
  gitAt(prior.current.workspace, ['merge-base', '--is-ancestor', prior.config.sourceHead, config.sourceBase]);
  gitAt(prior.current.workspace, ['merge-base', '--is-ancestor', config.sourceBase, config.sourceHead]);
  const extension = config.maximumMicroUsd === 25000000 ? (() => {
    if (!config.ceilingExtension) fail('reference_state_ceiling'); checked(config.ceilingExtension!);
    const grant = referenceStateCeilingSchema.parse(read(config.ceilingExtension!.file));
    if (grant.requestId !== prior.parent.job.queued.requestId || grant.parentConfigSha256 !== config.parentConfig.sha256 ||
        prior.config.maximumMicroUsd !== grant.previousMaximumMicroUsd) fail('reference_state_ceiling');
    return grant;
  })() : null;
  if (!extension && config.ceilingExtension) fail('reference_state_ceiling');
  const verify = () => {
    if (fencedText(configFile, 64000) !== bytes || gitAt(prior.current.workspace, ['rev-parse', 'HEAD']).toString().trim() !== config.sourceHead ||
        gitAt(prior.current.workspace, ['status', '--porcelain']).toString().trim()) fail('reference_state_source_changed');
    [config.parentConfig, config.parentTermination, config.technicalReviewReceipt].forEach(checked);
    if (config.ceilingExtension) checked(config.ceilingExtension);
    prior.verify(); assertAtlasInventory(prior.directory, config.parentArtifacts);
  };
  verify();
  const ended = await readEndedEntityAtlas(prior, config, true), technical = read(config.technicalReviewReceipt.file);
  if (extension && extension.knownBeforeContinuationMicroUsd !== ended.snapshot.knownEstimateMicroUsd) fail('reference_state_ceiling');
  const fee = simpleBookExternalCosts([config.technicalReviewReceipt]);
  if (technical.head !== config.sourceHead || technical.qaReviewHead !== config.sourceHead || technical.qaBase !== config.sourceBase ||
      technical.code !== 0 || technical.signal !== null || !technical.terminationConfirmed || technical.stopped || technical.status !== '' ||
      technical.isError !== false || technical.resultSubtype !== 'success' || technical.sourceBundleUnchanged !== true || technical.qaVerdict !== 'PASS' ||
      technical.qaMode !== 'read_only_code' || technical.costKind !== 'cli_reported_list_estimate_not_invoice' ||
      !z.string().uuid().safeParse(technical.sessionId).success || canonicalJson(technical.models) !== canonicalJson([CAUSAL_MODELS.opus]) ||
      technical.knownBeforeMicroUsd !== ended.snapshot.knownEstimateMicroUsd ||
      !Number.isSafeInteger(technical.maximumMicroUsd) || technical.maximumMicroUsd <= 0 || fee > technical.maximumMicroUsd ||
      prior.engineeringReceipts.some(f => read(f.file).sessionId === technical.sessionId)) fail('reference_state_technical');
  const externalMicroUsd = ended.snapshot.knownEstimateMicroUsd + fee;
  if (externalMicroUsd + 600000 > config.maximumMicroUsd) fail('reference_state_budget');
  const inheritedLogicalAttempts = prior.inheritedLogicalAttempts + ended.snapshot.logicalAttempts;
  if (inheritedLogicalAttempts >= 80) fail('reference_state_attempts');
  const referenceContext = referenceRoleContext('entities', simpleReferenceEntityDesign(prior.result.storyboard!.storyboard, true, true,
    prior.result.source.manuscript.pages.map((p: { text: string }) => p.text)));
  const contextSha256 = previewSha(JSON.stringify(referenceContext));
  const directory = path.join(prior.parent.job.directory, 'reference-source-state-continuation-20261009');
  return { ...prior, config, directory, current: { ...prior.current, sourceHead: config.sourceHead }, verify,
    inherited: ended.snapshot, extra: fee, externalMicroUsd, inheritedLogicalAttempts, stateAwareReferences: true as const,
    engineeringReceipts: [...prior.engineeringReceipts, config.technicalReviewReceipt],
    checkpoint: { child: prior.checkpoint.child, entities: { bytes: ended.pixels, imageSha: ended.candidate.imageSha } },
    entityRepairReview: undefined,
    claim() { verify(); mkdirSync(directory); exclusiveJson(path.join(directory, 'claim.json'), { sourceHead: config.sourceHead,
      configSha256: previewSha(bytes), requestDigest: ended.requestDigest, inherited: ended.snapshot, externalMicroUsd,
      inheritedLogicalAttempts, generationCount: 1, referenceContextSha256: contextSha256, runtimeEligible: false });
      const budget = new SimpleBookBudget(path.join(directory, 'paid-stages'), externalMicroUsd, config.maximumMicroUsd, inheritedLogicalAttempts);
      let sequence = readdirSync(prior.parent.job.directory).filter(n => /^view-\d{4}\.json$/.test(n)).length;
      const publish = (next: SimpleBookView) => { if (next.phase !== 'failed') verify(); const view = simpleBookViewSchema.parse(next);
        if (view.requestId !== prior.parent.job.queued.requestId || sequence >= 80) fail('reference_state_view');
        exclusiveJson(path.join(prior.parent.job.directory, `view-${String(++sequence).padStart(4, '0')}.json`),
          { requestDigest: ended.requestDigest, view: { ...view, revision: sequence } }); };
      return { budget, publish }; },
  };
}
