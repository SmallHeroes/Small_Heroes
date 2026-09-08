import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { canonicalHash } from '@/lib/canonical-json';
import { applySemanticCorrection, assertSemanticCorrectionArtifact, buildSemanticCorrectionPlan } from '../visualContractSemanticCorrection';
import { p1SemanticRecoveryFixture, P1_REQUEST } from './fixtures/semantic-recovery-p1-fixture';
import { prepareAcceptedSupportingCastReview } from '../acceptedSupportingCastReview';
import { prepareSemanticCorrectionPreview } from '../semanticCorrectionPreview';
import { canonicalContentAddressedJsonBytes } from '../canonicalContentAddressedJson';
import { materialize } from '@/lib/visual-contract-compiler/materializeContract';
import { validateResolvedBookVisualContract } from '@/lib/visual-contract-compiler/validateResolvedContract';
import { derivePageVisualContracts } from '@/lib/visual-contract-compiler/derivePageVisualContracts';
import { buildVisualContractPromptBlock } from '@/lib/visual-contract-compiler/buildVisualContractPromptBlock';

describe('atomic source-bound semantic correction', () => {
  it('recovers the real held candidate without altering original inputs or fabricating a paid candidate', () => {
    const { context, plan } = p1SemanticRecoveryFixture();
    const before = canonicalHash(context);
    const result = applySemanticCorrection(context, plan);
    expect(canonicalHash(context)).toBe(before);
    expect(result).toEqual(applySemanticCorrection(context, JSON.parse(JSON.stringify(plan))));
    expect(result.authorityScope).toBe('effective_semantic_correction_for_review_only');
    expect(result.effective.template.schemaVersion).toBe('vc-schema/v5');
    expect(result.effective.template.humanCast.map(h => h.id)).toEqual(['human:baker', 'human:broom_holder', 'human:birthday_child']);
    expect(result.effective.template.humanGroups).toHaveLength(2);
    const page = (n: number) => result.effective.template.pageContracts[n - 1]!;
    expect(page(1).castIds).toContain('human:baker');
    expect(page(12).castIds).toContain('human:baker');
    expect(page(5).castIds).toContain('human:broom_holder');
    expect(page(9).castIds).toEqual(expect.arrayContaining(['human-group:band', 'human-group:playing_children']));
    expect(page(11).castIds).toEqual(expect.arrayContaining(['human-group:band', 'human:birthday_child']));
    for (const n of [6, 10]) {
      expect(page(n).actionRequirements!.find(a => a.checkId === `action:p${n}_dini_runs`)!.predicate).toBe('runs');
      expect(page(n).mustShow.some(s => s.includes('דיני walks'))).toBe(false);
    }
    expect(page(8)).toEqual(context.candidate.template.pageContracts[7]);
    expect(page(2).actionRequirements).toEqual([context.candidate.template.pageContracts[1]!.actionRequirements![0]]);
    expect(page(12).actionRequirements!.some(a => a.predicate === 'recoils')).toBe(false);
    expect(page(12).mustShow.filter(s => /first slice/.test(s))).toEqual(['The same female baker cutting the first slice from the cake at the celebration table.']);
    expect(page(12).mustShow[5]).toBe(context.candidate.template.pageContracts[11]!.mustShow[5]);
    expect(result.effective.coverage.find(r => r.beatId === 'beat:p12:first_slice')!.disposition).toMatchObject({ contractValue: page(12).mustShow[0] });
    expect(page(12).propState.find(p => p.propId === 'prop_delivery_cart')!.state).not.toContain('if visible');
    expect(result.effective.template.coverContract.mustNotShow.some(s => s.startsWith('Picnic tablecloth'))).toBe(true);
    expect(result.effective.template.recurringProps.filter(p => p.id !== 'prop_tablecloth').every(p => p.firstRevealPage === undefined)).toBe(true);
    const resolved = materialize(result.effective.template, { skinTone: 'warm tan', hairColour: 'brown', hairTexture: 'wavy' });
    expect(validateResolvedBookVisualContract(resolved).ok).toBe(true);
    const prompt = buildVisualContractPromptBlock(derivePageVisualContracts(resolved).find(p => p.pageNumber === 12)!, resolved);
    expect(prompt).toContain('baker');
    expect(prompt).not.toContain('recoils');
    assertSemanticCorrectionArtifact(context, plan, result);
  });
  it('rejects stale, unknown, overlapping and cross-bound operations with unchanged inputs', () => {
    const { context, plan } = p1SemanticRecoveryFixture();
    const before = canonicalHash(context);
    const stale = structuredClone(plan.operations);
    if (stale[0]!.kind !== 'replace_action_predicate') throw new Error('fixture');
    stale[0]!.expectedPredicate = 'sits';
    expect(() => applySemanticCorrection(context, buildSemanticCorrectionPlan(context, stale))).toThrow('before_state');
    expect(() => buildSemanticCorrectionPlan(context, [{ kind: 'json_patch', path: '/cast' }])).toThrow();
    expect(() => applySemanticCorrection(context, buildSemanticCorrectionPlan(context, [...plan.operations, plan.operations[0]]))).toThrow('overlapping');
    expect(() => applySemanticCorrection(context, { ...plan, subject: { ...plan.subject, candidateDigest: 'a'.repeat(64) } })).toThrow('binding');
    expect(canonicalHash(context)).toBe(before);
  });
  it('rejects rehashed effective drift and a forged source-bound cast review', () => {
    const { context, plan } = p1SemanticRecoveryFixture();
    const result = applySemanticCorrection(context, plan);
    result.effective.template.worldType = 'fantastical';
    result.effective.templateDigest = canonicalHash(result.effective.template);
    const { digest: _digest, digestAlgorithm: _algorithm, ...payload } = result;
    result.digest = canonicalHash(payload);
    expect(() => assertSemanticCorrectionArtifact(context, plan, result)).toThrow('reconstruction');
    context.supportingCastReview.binding.visualDirectionsSha256 = 'a'.repeat(64);
    const { digest: _d, digestAlgorithm: _a, ...reviewPayload } = context.supportingCastReview;
    context.supportingCastReview.digest = canonicalHash(reviewPayload);
    expect(() => buildSemanticCorrectionPlan(context, plan.operations)).toThrow('review_source_binding');
  });
  it.each([
    ['wrong source', { sourceEvidenceId: `se1_${'a'.repeat(64)}` }, 'coverage_mismatch'],
    ['cross-page source', { sourceEvidenceId: 'cross_page' }, 'coverage_mismatch'],
    ['stale action hash', { expectedActionDigest: 'a'.repeat(64) }, 'before_state'],
    ['missing page', { pageNumber: 80 }, 'page_missing'],
    ['existing beat collision', { newBeatId: 'beat:p6:child_walks' }, 'identity_collision'],
    ['incompatible predicate shape', { predicate: 'approaches' }, 'effective_template_invalid'],
  ])('rejects %s atomically', (_label, patch, error) => {
    const { context, plan } = p1SemanticRecoveryFixture();
    const before = canonicalHash(context);
    const changed = { ...plan.operations[0], ...patch };
    if ('sourceEvidenceId' in changed && changed.sourceEvidenceId === 'cross_page') {
      changed.sourceEvidenceId = context.candidate.actionSemanticCoverage.find(r => r.pageNumber === 1)!.sourceEvidenceId;
    }
    expect(() => applySemanticCorrection(context, buildSemanticCorrectionPlan(context, [changed]))).toThrow(error);
    expect(canonicalHash(context)).toBe(before);
  });
  it.each([
    ['cast on wrong page', { castIds: ['human:broom_holder'] }, 'presentation_cast_missing'],
    ['unknown citation', { sourceEvidenceIds: [`se1_${'b'.repeat(64)}`] }, 'source_evidence_invalid'],
    ['stale prose', { expectedMustShow: 'stale' }, 'presentation_before_state'],
    ['duplicate prose', { replacement: 'duplicate' }, 'duplicate_effective_requirement'],
  ])('rejects presentation %s', (_label, patch, error) => {
    const { context, plan } = p1SemanticRecoveryFixture();
    const changed = { ...plan.operations.find(op => op.kind === 'replace_presentation' && op.pageNumber === 12)!, ...patch };
    if ('replacement' in changed && changed.replacement === 'duplicate') changed.replacement = context.candidate.template.pageContracts[11]!.mustShow[1]!;
    expect(() => applySemanticCorrection(context, buildSemanticCorrectionPlan(context, [changed]))).toThrow(error);
  });
  it('rebuilds v4 when the reviewed overlay no longer contains any group; never mutates the prior v5 overlay', () => {
    const { context, plan } = p1SemanticRecoveryFixture();
    const grouped = applySemanticCorrection(context, plan);
    const before = canonicalHash(grouped);
    const review = prepareAcceptedSupportingCastReview({ ...P1_REQUEST,
      entries: context.supportingCastReview.entries.filter(e => e.kind === 'human_individual'),
    }).review;
    const reduced = { ...context, supportingCastReview: review };
    const next = applySemanticCorrection(reduced, buildSemanticCorrectionPlan(reduced, plan.operations));
    expect(next.effective.template.schemaVersion).toBe('vc-schema/v4');
    expect(next.effective.template).not.toHaveProperty('humanGroups');
    expect(next.effective.template.pageContracts.flatMap(p => p.castIds ?? []).some(id => id.startsWith('human-group:'))).toBe(false);
    expect(canonicalHash(grouped)).toBe(before);
  });
  it('accepts reviewed alternative cast IDs without a story-specific production branch', () => {
    const { context, plan } = p1SemanticRecoveryFixture();
    const entries = context.supportingCastReview.entries.map(entry => ({ ...entry,
      id: entry.id.replace('human:', 'human:review_').replace('human-group:', 'human-group:review_'),
    }));
    const review = prepareAcceptedSupportingCastReview({ ...P1_REQUEST, entries }).review;
    const alternate = { ...context, supportingCastReview: review };
    const ops = plan.operations.map(op => op.kind === 'replace_presentation'
      ? { ...op, castIds: op.castIds.map(id => id.replace('human:', 'human:review_')) } : op);
    const result = applySemanticCorrection(alternate, buildSemanticCorrectionPlan(alternate, ops));
    expect(result.effective.template.pageContracts[11]!.castIds).toContain('human:review_baker');
    expect(result.effective.template.humanGroups![0]!.id).toBe('human-group:review_band');
  });
  it('rebinds shared presentation values and all pointers after removals, regardless of operation order', () => {
    const { context, plan } = p1SemanticRecoveryFixture();
    const forward = applySemanticCorrection(context, plan);
    const reverse = applySemanticCorrection(context, buildSemanticCorrectionPlan(context, [...plan.operations].reverse()));
    expect(forward.effective).toEqual(reverse.effective);
    const rows = forward.effective.coverage.filter(r => r.pageNumber === 2 && r.disposition.kind === 'presentation_requirement');
    const text = forward.effective.template.pageContracts[1]!.mustShow[2];
    expect(rows.filter(r => 'contractValue' in r.disposition && r.disposition.contractValue === text).length).toBeGreaterThanOrEqual(2);
    for (const row of forward.effective.coverage) {
      if (!('contractPointer' in row.disposition)) continue;
      const value = row.disposition.contractPointer.split('/').slice(1).reduce<unknown>((value, key) => (value as Record<string, unknown>)[key], forward.effective.template);
      expect(value).toEqual(row.disposition.contractValue);
    }
  });
  it('rejects unknown fields, whitespace laundering and snapshot relabeling', () => {
    const { context, plan } = p1SemanticRecoveryFixture();
    expect(() => applySemanticCorrection(context, { ...plan, approved: true })).toThrow();
    expect(() => buildSemanticCorrectionPlan(context, [{ ...plan.operations[0], newBeatId: ' beat:p6:run ' }])).toThrow();
    context.snapshot.digest = 'c'.repeat(64);
    expect(() => buildSemanticCorrectionPlan(context, plan.operations)).toThrow();
  });
});

describe('contained semantic preview and real CLI', () => {
  const created: string[] = [];
  const root = process.cwd();
  afterEach(() => {
    for (const directory of created.splice(0)) {
      const resolved = path.resolve(directory);
      if (!resolved.startsWith(path.resolve(root, 'outputs') + path.sep) || !path.basename(resolved).startsWith('semantic-preview-test-')) throw new Error('unsafe cleanup');
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  });
  function fixture() {
    fs.mkdirSync(path.join(root, 'outputs'), { recursive: true });
    const directory = fs.mkdtempSync(path.join(root, 'outputs/semantic-preview-test-'));
    created.push(directory);
    const relative = path.relative(root, directory).split(path.sep).join('/');
    const { context, plan } = p1SemanticRecoveryFixture();
    for (const [name, value] of Object.entries({ candidate: context.candidate, review: context.supportingCastReview, operations: plan.operations })) {
      fs.writeFileSync(path.join(directory, `${name}.json`), canonicalContentAddressedJsonBytes(value));
    }
    return { directory, args: { ...P1_REQUEST, candidatePath: `${relative}/candidate.json`,
      supportingCastReviewPath: `${relative}/review.json`, operationsPath: `${relative}/operations.json`, outputDir: `${relative}/result` } };
  }
  it('dry-run creates nothing; write persists one review-pending packet and is byte-idempotent', () => {
    const { directory, args } = fixture();
    const dry = prepareSemanticCorrectionPreview(args);
    expect(dry.artifact).toBeNull();
    expect(dry.providerCalls).toBe(0);
    expect(fs.existsSync(path.join(directory, 'result'))).toBe(false);
    const written = prepareSemanticCorrectionPreview({ ...args, write: true });
    expect(written.packet).toEqual(dry.packet);
    expect(written.packet.decision).toBe('pending');
    expect(written.packet.doesNotAuthorize).toContain('image_render');
    const again = prepareSemanticCorrectionPreview({ ...args, write: true });
    expect(again.packet).toEqual(written.packet);
    expect(written.artifact!.created).toBe(true);
    expect(again.artifact).toEqual({ ...written.artifact, created: false });
    const files = fs.readdirSync(path.join(directory, 'result/semantic-correction-reviews'));
    expect(files).toEqual([`${written.packet.digest}.json`]);
    expect(fs.readFileSync(path.join(directory, 'result/semantic-correction-reviews', files[0]!), 'utf8')).toBe(canonicalContentAddressedJsonBytes(written.packet));
  });
  it.each(['stale', 'noncanonical', 'cross-bound'])('rejects %s before creating an output directory', kind => {
    const { directory, args } = fixture();
    if (kind === 'stale') fs.writeFileSync(path.join(directory, 'operations.json'), JSON.stringify([{ kind: 'unknown' }]));
    if (kind === 'noncanonical') fs.appendFileSync(path.join(directory, 'candidate.json'), ' ');
    if (kind === 'cross-bound') {
      const value = JSON.parse(fs.readFileSync(path.join(directory, 'review.json'), 'utf8'));
      value.binding.sourceSnapshotDigest = 'd'.repeat(64);
      const { digest: _d, digestAlgorithm: _a, ...payload } = value;
      value.digest = canonicalHash(payload);
      fs.writeFileSync(path.join(directory, 'review.json'), JSON.stringify(value));
    }
    expect(() => prepareSemanticCorrectionPreview({ ...args, write: true })).toThrow();
    expect(fs.existsSync(path.join(directory, 'result'))).toBe(false);
  });
  it.each(['../escape', 'outputs/../escape', 'CURRENT.md', 'outputs\\escape', '/tmp/escape'])('rejects unsafe output %s', outputDir => {
    const { args } = fixture();
    expect(() => prepareSemanticCorrectionPreview({ ...args, outputDir, write: true })).toThrow();
  });
  it('runs the actual CLI with networking denied and rejects duplicate/unknown flags without leaking input', () => {
    const { directory, args } = fixture();
    const base = [path.join(root, 'node_modules/tsx/dist/cli.mjs'), '--require', './scripts/shims/register-server-only.cjs',
      '--require', './lib/set-identity-board/__tests__/fixtures/deny-network.cjs', 'scripts/preview-semantic-correction.ts'];
    const flags = ['--repo-root', root, '--story-key', args.storyKey, '--story-path', args.storyPath,
      '--candidate', args.candidatePath, '--cast-review', args.supportingCastReviewPath,
      '--operations', args.operationsPath, '--output', args.outputDir];
    const run = (extra: string[]) => spawnSync(process.execPath, [...base, ...flags, ...extra], { cwd: root, encoding: 'utf8', timeout: 20_000 });
    const dry = run([]);
    expect(dry.status, dry.stderr).toBe(0);
    expect(JSON.parse(dry.stdout)).toMatchObject({ status: 'review_pending', providerCalls: 0, artifact: null });
    expect(fs.existsSync(path.join(directory, 'result'))).toBe(false);
    const write = run(['--write']);
    expect(write.status, write.stderr).toBe(0);
    expect(JSON.parse(write.stdout).artifact).not.toBeNull();
    for (const extra of [['--output', 'private-secret-text'], ['--unrecognized', 'private-secret-text']]) {
      const rejected = run(extra);
      expect(rejected.status).toBe(1);
      expect(JSON.parse(rejected.stdout)).toEqual({ status: 'rejected', providerCalls: 0 });
      expect(rejected.stdout + rejected.stderr).not.toContain('private-secret-text');
    }
  }, 30_000);
});
