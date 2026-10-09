import 'server-only';
import path from 'node:path';
import { lstatSync, readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { z } from 'zod';
import sharp from 'sharp';
import { prepareSimpleBookReferenceRecovery } from './simple-book-reference-recovery';
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

const hash = z.string().regex(/^[a-f0-9]{64}$/), file = z.object({ file: z.string().min(1), sha256: hash }).strict();
const inventory = z.array(z.object({ relative: z.string().regex(/^(?:[a-z0-9_-]+\/)*[a-z0-9_.-]+\.(?:json|txt|log|md|png)$/)
  .refine(s => !s.split('/').includes('..')), sha256: hash }).strict()).min(10).max(256);
export const entityAuthorityContinuationSchema = z.object({ version: z.literal('controlled-simple-entity-authority/v1'),
  sourceHead: z.string().regex(/^[a-f0-9]{40}$/), sourceBase: z.string().regex(/^[a-f0-9]{40}$/),
  parentConfig: file, parentTermination: file, parentArtifacts: inventory, maximumMicroUsd: z.union([z.literal(20000000), z.literal(22000000)]), ceilingExtension: file.optional(),
  ownerApprovalReference: z.string().min(30).max(2000), sameBookOnly: z.literal(true), publicRelease: z.literal(false),
  customerCharge: z.literal(false), gateChanges: z.literal(false),
  extraEngineeringReceipts: z.array(file).length(2), technicalReviewReceipt: file,
  settledControls: z.array(z.object({ directory: z.string().min(1), artifacts: inventory }).strict()).min(1).max(6),
  authorityControlIndex: z.number().int().nonnegative().max(5),
}).strict();
export const entityAuthorityCeilingSchema = z.object({ version: z.literal('local-simple-entity-authority-ceiling/v1'), requestId: hash,
  parentConfigSha256: hash, previousMaximumMicroUsd: z.literal(20000000), maximumMicroUsd: z.literal(22000000),
  failedReviewReceipt: file, knownBeforeContinuationMicroUsd: z.number().int().nonnegative(),
  ownerApprovalReference: z.string().min(30).max(2000), sameBookOnly: z.literal(true), publicRelease: z.literal(false),
  customerCharge: z.literal(false), gateChanges: z.literal(false) }).strict();
const fail = (code: string): never => { throw Object.assign(new Error(code), { code }); };
const read = (p: string) => JSON.parse(fencedText(p, 32000000));

/** Fresh SAME-book sibling. Old successful source and ended failures stay immutable. */
export async function prepareEntityAuthorityContinuation(configFile: string, activeSourceHead?: string) {
  const bytes = fencedText(configFile, 64000), config = entityAuthorityContinuationSchema.parse(JSON.parse(bytes));
  if (!path.isAbsolute(configFile)) fail('entity_authority_config');
  const checked = (f: z.infer<typeof file>) => {
    if (!path.isAbsolute(f.file) || previewSha(fencedText(f.file, 32000000)) !== f.sha256) fail('entity_authority_file');
  };
  checked(config.parentConfig); checked(config.parentTermination); checked(config.technicalReviewReceipt);
  const frozenHead = activeSourceHead ?? config.sourceHead;
  const prior = await prepareSimpleBookReferenceRecovery(config.parentConfig.file, frozenHead);
  gitAt(prior.current.workspace, ['merge-base', '--is-ancestor', config.sourceHead, frozenHead]);
  if (prior.config.version !== 'controlled-simple-reference-recovery/v3' || !prior.config.rebuildContinuation ||
      prior.config.maximumMicroUsd !== 20000000 || !prior.checkpoint || !prior.rebuildEntitiesFromDesign)
    fail('entity_authority_parent_scope');
  gitAt(prior.current.workspace, ['merge-base', '--is-ancestor', prior.config.sourceHead, config.sourceBase]);
  gitAt(prior.current.workspace, ['merge-base', '--is-ancestor', config.sourceBase, config.sourceHead]);
  const checkInventory = (dir: string, entries: z.infer<typeof inventory>) => {
    if (!path.isAbsolute(dir)) fail('entity_authority_directory'); realDirectory(dir);
    const names = entries.map(r => r.relative);
    if (new Set(names).size !== names.length || canonicalJson([...names].sort()) !== canonicalJson(visualEvidenceFiles(dir).sort())) fail('entity_authority_inventory');
    for (const r of entries) { const p = path.join(dir, r.relative), s = lstatSync(p); realDirectory(path.dirname(p));
      if (!s.isFile() || s.isSymbolicLink() || s.nlink !== 1 || s.size > 32000000 || previewSha(readFileSync(p)) !== r.sha256) fail('entity_authority_inventory'); }
  };
  const technical = read(config.technicalReviewReceipt.file);
  const extension = config.maximumMicroUsd === 22000000 ? (() => {
    if (!config.ceilingExtension) fail('entity_authority_ceiling'); checked(config.ceilingExtension!);
    const grant = entityAuthorityCeilingSchema.parse(read(config.ceilingExtension!.file)); checked(grant.failedReviewReceipt);
    const failed = read(grant.failedReviewReceipt.file), fee = simpleBookExternalCosts([grant.failedReviewReceipt]);
    if (grant.requestId !== prior.parent.job.queued.requestId || grant.parentConfigSha256 !== config.parentConfig.sha256 ||
        failed.code !== 1 || failed.signal !== null || !failed.terminationConfirmed || failed.stopped || failed.isError !== true ||
        failed.resultSubtype !== 'error_max_budget_usd' || failed.qaVerdict !== null || failed.sourceBundleUnchanged !== true ||
        failed.status !== '' || !Number.isSafeInteger(failed.maximumMicroUsd) || failed.maximumMicroUsd <= 0 || fee <= failed.maximumMicroUsd || canonicalJson(failed.models) !== canonicalJson([CAUSAL_MODELS.opus]) ||
        failed.sessionId !== technical.sessionId || !z.string().uuid().safeParse(failed.sessionId).success ||
        technical.costKind !== 'cumulative_same_cli_session_list_estimate_not_invoice' || technical.includesPreviousKnownFailedCalls !== true ||
        technical.previousCumulativeReportedCostUsd !== failed.reportedCostUsd || technical.reportedCostUsd <= failed.reportedCostUsd ||
        grant.knownBeforeContinuationMicroUsd !== failed.knownBeforeMicroUsd + fee ||
        config.extraEngineeringReceipts.some(f => canonicalJson(f) === canonicalJson(grant.failedReviewReceipt))) fail('entity_authority_ceiling');
    gitAt(prior.current.workspace, ['merge-base', '--is-ancestor', config.sourceBase, failed.head]);
    gitAt(prior.current.workspace, ['merge-base', '--is-ancestor', failed.head, config.sourceHead]);
    return { grant, failed };
  })() : null;
  if (!extension && config.ceilingExtension) fail('entity_authority_ceiling');
  if (canonicalJson(config.technicalReviewReceipt) !== canonicalJson(config.extraEngineeringReceipts[1]) ||
      technical.head !== config.sourceHead || technical.qaReviewHead !== config.sourceHead || technical.qaBase !== config.sourceBase ||
      technical.code !== 0 || technical.signal !== null || !technical.terminationConfirmed || technical.stopped || technical.status !== '' ||
      technical.isError !== false || technical.resultSubtype !== 'success' || technical.sourceBundleUnchanged !== true || technical.qaVerdict !== 'PASS' || technical.qaMode !== 'read_only_code' ||
      !z.string().uuid().safeParse(technical.sessionId).success || canonicalJson(technical.models) !== canonicalJson([CAUSAL_MODELS.opus]) ||
      !Number.isSafeInteger(technical.maximumMicroUsd) || technical.maximumMicroUsd <= 0 ||
      Math.ceil(technical.reportedCostUsd * 1e6) > technical.maximumMicroUsd) fail('entity_authority_technical');
  const newEngineering = simpleBookExternalCosts(config.extraEngineeringReceipts);
  const allEngineering = [...prior.parent.repair.allEngineering, ...prior.parent.config.extraEngineeringReceipts,
    ...prior.config.extraEngineeringReceipts, ...config.extraEngineeringReceipts];
  simpleBookExternalCosts(allEngineering);
  const sessions = allEngineering.map(f => read(f.file).sessionId).filter(s => typeof s === 'string');
  if (new Set(sessions).size !== sessions.length) fail('entity_authority_duplicate_session');
  const verify = () => {
    if (fencedText(configFile, 64000) !== bytes || gitAt(prior.current.workspace, ['rev-parse', 'HEAD']).toString().trim() !== frozenHead ||
        gitAt(prior.current.workspace, ['status', '--porcelain']).toString().trim()) fail('entity_authority_source_changed');
    checked(config.parentConfig); checked(config.parentTermination); checked(config.technicalReviewReceipt); prior.verify();
    if (config.ceilingExtension) checked(config.ceilingExtension);
    if (extension) checked(extension.grant.failedReviewReceipt);
    simpleBookExternalCosts(config.extraEngineeringReceipts); checkInventory(prior.directory, config.parentArtifacts);
    config.settledControls.forEach(c => checkInventory(c.directory, c.artifacts));
  };
  verify();
  const stages = (directory: string, before: number, imageStep: string, judgeStep: string) => {
    realDirectory(path.join(directory, 'paid-stages'));
    const budget = new SimpleBookBudget(path.join(directory, 'paid-stages'), before, config.maximumMicroUsd), snapshot = budget.snapshot();
    if (snapshot.unknownAttemptCosts || snapshot.stopped || snapshot.logicalAttempts !== 2 || snapshot.accountedMicroUsd !== snapshot.knownEstimateMicroUsd) fail('entity_authority_unsettled');
    const entries = [imageStep, judgeStep].map((step, i) => {
      const wire = read(path.join(budget.root, `${step}.wire.json`)), c = read(path.join(budget.root, `${step}.claim.json`));
      const outcome = read(path.join(budget.root, `${step}.result.json`)), receipt = read(path.join(budget.root, `${step}.receipt.json`));
      const expected = auditionUsageCost(receipt.raw?.usage, i ? 'sol' : 'image');
      if (c.step !== step || c.wireDigest !== previewSha(canonicalJson(wire)) || outcome.wireDigest !== c.wireDigest || !outcome.completed ||
          expected === null || outcome.estimatedMicroUsd !== expected || receipt.estimatedMicroUsd !== expected || expected > c.maximumMicroUsd ||
          i === 0 && (receipt.model !== 'gpt-image-2' || wire.body.model !== 'gpt-image-2' || !['low', 'medium'].includes(wire.body.quality) || wire.body.size !== '1024x1024' || wire.body.n !== 1) ||
          i === 1 && (wire.model !== 'gpt-6.1-sol' || wire.instructions !== REFERENCE_DESIGN_JUDGE_INSTRUCTION || wire.store !== false || wire.max_output_tokens !== 12000 ||
            receipt.raw.model !== wire.model || receipt.raw.status !== 'completed' || receipt.raw.service_tier !== 'default' || !receipt.raw.output_text || receipt.raw.usage.output_tokens > wire.max_output_tokens)) fail('entity_authority_paid_binding');
      return { wire, receipt, expected: expected! };
    });
    if (before + entries.reduce((s, e) => s + e.expected, 0) !== snapshot.knownEstimateMicroUsd) fail('entity_authority_cost');
    const candidate = entries[0].receipt.candidate, pixels = readAuditionImage(path.join(directory, 'illustrations'), candidate);
    if (previewSha(Buffer.from(entries[0].receipt.raw.data?.[0]?.b64_json ?? '', 'base64')) !== candidate.imageSha) fail('entity_authority_pixels');
    const content = entries[1].wire.input[0].content, data = JSON.parse(content[0].text);
    if (previewSha(Buffer.from(content[1].image_url.split(',')[1], 'base64')) !== candidate.imageSha || data.candidateSha !== candidate.imageSha ||
        previewSha(JSON.stringify(data.context)) !== data.contextSha) fail('entity_authority_pixels');
    const review = qualityDisposition(JSON.parse(entries[1].receipt.raw.output_text), candidate.imageSha, data.contextSha);
    return { candidate, pixels, data, review, snapshot, entries };
  };
  const terminal = read(config.parentTermination.file), oldClaim = read(path.join(prior.directory, 'claim.json'));
  const requestDigest = previewSha(canonicalJson(prior.parent.job.queued));
  const ended = stages(prior.directory, prior.externalMicroUsd, 'reference_entities', 'reference_entities_qa');
  const seal = read(path.join(prior.directory, 'sealed.json'));
  if (terminal.head !== prior.config.sourceHead || terminal.status !== '' || terminal.code !== 1 || terminal.signal !== null || !terminal.terminationConfirmed ||
      terminal.stopped || terminal.referenceCap !== 4 || terminal.sealSha256 !== previewSha(fencedText(path.join(prior.directory, 'sealed.json'), 64000)) ||
      oldClaim.configSha256 !== config.parentConfig.sha256 || oldClaim.sourceHead !== prior.config.sourceHead || oldClaim.requestDigest !== requestDigest ||
      oldClaim.inheritedLogicalAttempts !== prior.inheritedLogicalAttempts || seal.status !== 'failed' || seal.code !== 'simple_reference_held' ||
      seal.sourceHead !== prior.config.sourceHead || seal.runtimeEligible !== false || canonicalJson(seal.snapshot) !== canonicalJson(ended.snapshot) ||
      ended.review.disposition === 'passed' || visualEvidenceFiles(prior.directory).some(n => /^(?:page_|book\.html|illustrated_book|audition_references)/.test(n))) fail('entity_authority_parent_outcome');
  const book = prior.result.storyboard!.storyboard;
  const fullDesign = { props: book.plan.recurringProps, entities: book.plan.continuity!.entities,
    childClothingAuthority: book.plan.actorAppearance?.child.clothing ?? book.plan.wardrobe };
  if (canonicalJson(ended.data.context) !== canonicalJson(referenceRoleContext('entities', fullDesign))) fail('entity_authority_parent_context');
  const controls = config.settledControls.map(c => {
    const r = read(path.join(c.directory, 'receipt.json'));
    if (r.code !== 0 || r.signal !== null || !r.terminationConfirmed || !r.sourceUnchanged || r.completeBook !== false || r.productionQualified !== false ||
        r.maximumMicroUsd !== prior.config.maximumMicroUsd || !Number.isSafeInteger(r.knownBeforeMicroUsd) || r.snapshot?.knownEstimateMicroUsd > prior.config.maximumMicroUsd) fail('entity_authority_control_outcome');
    const s = stages(c.directory, r.knownBeforeMicroUsd, 'medium_entities', 'medium_entities_qa');
    if (canonicalJson(s.snapshot) !== canonicalJson(r.snapshot) || r.incrementalKnownMicroUsd !== s.snapshot.knownEstimateMicroUsd - r.knownBeforeMicroUsd || r.disposition !== s.review.disposition ||
        canonicalJson(s.review) !== canonicalJson(read(path.join(c.directory, 'reference_review.json')))) fail('entity_authority_control_binding');
    return { ...s, directory: c.directory, r };
  });
  if (new Set(config.settledControls.map(c => path.resolve(c.directory).toLowerCase())).size !== controls.length) fail('entity_authority_duplicate');
  const consult = read(config.extraEngineeringReceipts[0].file), consultCost = simpleBookExternalCosts([config.extraEngineeringReceipts[0]]);
  if (!consult.validConsultation || consult.head !== config.sourceBase || canonicalJson(consult.models) !== canonicalJson([CAUSAL_MODELS.opus]) || !z.string().uuid().safeParse(consult.sessionId).success || consult.notTechnicalPASS !== true || consult.sourceUnchanged !== true || consult.code !== 0 ||
      consult.signal !== null || !consult.terminationConfirmed || consult.stopped || consult.isError !== false || consult.resultSubtype !== 'success' ||
      consult.unknownAttemptCosts || consult.knownAfterMicroUsd !== consult.knownBeforeMicroUsd + consultCost) fail('entity_authority_consultation');
  let known = ended.snapshot.knownEstimateMicroUsd, consultInserted = false;
  for (const c of controls) {
    if (!consultInserted && consult.knownBeforeMicroUsd === known) { known += consultCost; consultInserted = true; }
    if (c.r.knownBeforeMicroUsd !== known) fail('entity_authority_missing_cost'); known = c.snapshot.knownEstimateMicroUsd;
  }
  if (!consultInserted && consult.knownBeforeMicroUsd === known) { known += consultCost; consultInserted = true; }
  if (!consultInserted || technical.knownBeforeMicroUsd !== known) fail('entity_authority_missing_cost');
  if (extension && extension.failed.knownBeforeMicroUsd !== known) fail('entity_authority_ceiling');
  const externalMicroUsd = known + simpleBookExternalCosts([config.technicalReviewReceipt]);
  if (externalMicroUsd + 600000 > config.maximumMicroUsd) fail('entity_authority_budget');
  const authority = controls[config.authorityControlIndex]; if (!authority || authority.review.disposition !== 'passed') fail('entity_authority_not_passed');
  const subset = authority.data.context?.design, ids = new Set<string>(subset?.entities?.map((e: { id: string }) => e.id));
  if (!ids.size || ids.size !== subset.entities.length || canonicalJson(authority.data.context) !== canonicalJson(referenceRoleContext('entities', {
      ...fullDesign, entities: fullDesign.entities.filter((e: { id: string }) => ids.has(e.id)), props: fullDesign.props.filter((e: { id: string }) => ids.has(e.id)),
    })) || authority.data.contextSha !== previewSha(JSON.stringify(referenceRoleContext('entities', subset)))) fail('entity_authority_wrong_source');
  const content = authority.entries[1].wire.input[0].content, child = prior.checkpoint!.child;
  const companionSha = previewSha(readFileSync(path.join(prior.directory, 'illustrations/companion_reference.png')));
  const imageSha = (n: number) => previewSha(Buffer.from(content[n].image_url.split(',')[1], 'base64'));
  if (content.length !== 8 || imageSha(6) !== child.imageSha || imageSha(7) !== companionSha ||
      canonicalJson(authority.data.imageRoles) !== canonicalJson(['candidate_complete', 'candidate_crop_top_left', 'candidate_crop_top_right',
        'candidate_crop_bottom_left', 'candidate_crop_bottom_right', 'canonical_child', 'canonical_companion'])) fail('entity_authority_actor_binding');
  const meta = await sharp(authority.pixels).metadata(), width = meta.width!, height = meta.height!;
  const cw = Math.ceil(width * .7), ch = Math.ceil(height * .7);
  for (const [i, [left, top]] of [[0, 0], [width - cw, 0], [0, height - ch], [width - cw, height - ch]].entries()) {
    const crop = await sharp(authority.pixels).extract({ left, top, width: cw, height: ch }).png().toBuffer();
    if (imageSha(i + 2) !== previewSha(crop)) fail('entity_authority_crop_binding');
  }
  const directory = path.join(prior.parent.job.directory, 'reference-entity-authority-continuation-20261008');
  const inheritedLogicalAttempts = prior.inheritedLogicalAttempts + ended.snapshot.logicalAttempts + controls.reduce((s, c) => s + c.snapshot.logicalAttempts, 0);
  return { ...prior, config: { ...config, technicalReviewReceipt: config.technicalReviewReceipt }, directory, verify,
    current: { ...prior.current, sourceHead: config.sourceHead }, inherited: ended.snapshot, extra: newEngineering,
    externalMicroUsd, inheritedLogicalAttempts, entityDesignAuthority: { bytes: authority.pixels, imageSha: authority.candidate.imageSha,
      context: authority.data.context, review: authority.review.review },
    checkpoint: { child, entities: { bytes: ended.pixels, imageSha: ended.candidate.imageSha } }, claim() {
      verify(); mkdirSync(directory); exclusiveJson(path.join(directory, 'claim.json'), { sourceHead: config.sourceHead, configSha256: previewSha(bytes),
        requestDigest, inherited: ended.snapshot, extraEngineeringMicroUsd: newEngineering,
        externalMicroUsd, inheritedLogicalAttempts, runtimeEligible: false });
      const budget = new SimpleBookBudget(path.join(directory, 'paid-stages'), externalMicroUsd, config.maximumMicroUsd, inheritedLogicalAttempts);
      let sequence = readdirSync(prior.parent.job.directory).filter(n => /^view-\d{4}\.json$/.test(n)).length;
      const publish = (next: SimpleBookView) => { if (next.phase !== 'failed') verify(); const view = simpleBookViewSchema.parse(next);
        if (view.requestId !== prior.parent.job.queued.requestId || sequence >= 80) fail('entity_authority_view');
        exclusiveJson(path.join(prior.parent.job.directory, `view-${String(++sequence).padStart(4, '0')}.json`), { requestDigest, view: { ...view, revision: sequence } });
      }; return { budget, publish };
    } };
}
