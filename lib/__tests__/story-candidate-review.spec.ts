import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { prepareReview, executeReview, validateBudget, parseArgs } = require('../../scripts/review-story-candidate.cjs');
const { MODEL, SERVICE_TIER } = require('../../scripts/story-autonomous-batch-core.cjs');
const hash = (v: Buffer | string) => createHash('sha256').update(v).digest('hex');
const roots: string[] = [];
const fixture = Buffer.from('---\ntitle: "{{childName}} וענת"\ncompanionId: panda_anat\ndirection: adventure\ncategory: SOCIAL\npages: 2\ngender: neutral\nendingType: resolution\n---\n\n--- Page 1 ---\n{{childName}} {הלך|הלכה} עם ענת.\n\n--- Page 2 ---\n{{childName}} {חייך|חייכה}.\n');
function prepared(bytes = fixture) {
  return prepareReview({ bytes, expectedSha: hash(bytes), contract: 'Review the story without rewriting.',
    psychology: { companionId: 'panda_anat' } });
}
function root() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'story-editor-test-')); roots.push(dir);
  return path.join(dir, 'run');
}
afterEach(() => { for (const dir of roots.splice(0)) {
  if (path.dirname(path.resolve(dir)) !== path.resolve(os.tmpdir()) || !path.basename(dir).startsWith('story-editor-test-')) throw Error('unsafe_test_cleanup');
  fs.rmSync(dir, { recursive: true, force: true });
} });
const review = (verdict = 'pass') => ({ version: 'small-heroes-story-editorial-review/v1', verdict,
  strengths: ['The child makes a choice.'], issues: verdict === 'pass' ? [] : [{ code: 'causality_gap',
    severity: 'minor', evidencePages: [1], functionalGap: 'The departure needs a reason.' }],
  revisionPriorities: verdict === 'pass' ? [] : ['Clarify the reason.'], mustPreserve: ['Preserve the child action.'] });
const response = (verdict = 'pass') => ({ completed: true, model: MODEL, serviceTier: SERVICE_TIER,
  text: JSON.stringify(review(verdict)), usage: { inputTokens: 100, outputTokens: 100, cachedInputTokens: 0, cacheWriteTokens: 0 } });

describe('bounded existing-manuscript editorial review', () => {
  it('binds exact bytes and supplies real boy/girl projections', () => {
    const p = prepared(); const input = JSON.parse(p.request.userPrompt);
    expect(input.draft).toBe(fixture.toString());
    expect(input.projections[0].text).toContain('בר הלך');
    expect(input.projections[1].text).toContain('נועה הלכה');
    expect(p.request.reasoningEffort).toBe('high');
    expect(p.sourceSha).toBe(hash(fixture));
  });
  it('rejects source drift before any call', () => {
    expect(() => prepareReview({ bytes: fixture, expectedSha: '0'.repeat(64), contract: 'Review',
      psychology: { companionId: 'panda_anat' } })).toThrow('editor_source_changed');
  });
  it('rejects a mismatched companion', () => {
    expect(() => prepareReview({ bytes: fixture, expectedSha: hash(fixture), contract: 'Review',
      psychology: { companionId: 'fox_uri' } })).toThrow('editor_companion_mismatch');
  });
  it('does not silently erase a companion placeholder', () => {
    expect(() => prepared(Buffer.from(fixture.toString().replace('עם ענת', 'עם {{companionName}}'))))
      .toThrow('editor_unresolved_personalization');
  });
  it('requires a dynamic child name', () => {
    expect(() => prepared(Buffer.from(fixture.toString().split('{{childName}}').join('בר'))))
      .toThrow('editor_child_parameter_missing');
  });
  it('rejects invalid and insufficient budget before filesystem or provider work', async () => {
    const p = prepared(), dir = root(); let calls = 0;
    for (const budgetUsd of [0, NaN, 2, p.reserveUsd / 2]) {
      expect(() => validateBudget(p, budgetUsd)).toThrow('editor_budget_insufficient');
      await expect(executeReview(p, { root: dir, budgetUsd, provider: { complete: () => { calls++; } } }))
        .rejects.toThrow('editor_budget_insufficient');
    }
    expect(calls).toBe(0); expect(fs.existsSync(dir)).toBe(false);
  });
  it.each(['pass', 'revise', 'reject'])('preserves %s without rewriting or granting authority; resume spends zero', async verdict => {
    const dir = root(), p = prepared(); let calls = 0;
    const provider = { complete: async () => { calls++; return response(verdict); } };
    const first = await executeReview(p, { root: dir, budgetUsd: 1.5, provider });
    const second = await executeReview(p, { root: dir, budgetUsd: 1.5, provider });
    expect(calls).toBe(1); expect(second).toEqual(first);
    expect(first.verdict).toBe(verdict); expect(first.productionReady).toBe(false);
    expect(first.independentTechnicalPass).toBe(false); expect(first.invoiceVerified).toBe(false);
    expect(fs.readFileSync(path.join(dir, 'story.md'))).toEqual(fixture);
    expect(fs.existsSync(path.join(dir, 'run.lock'))).toBe(false);
  });
  it.each(['incomplete', 'json', 'schema', 'model'])('persists %s paid response and never retries it', async kind => {
    const dir = root(), p = prepared(); let calls = 0;
    const result = response();
    if (kind === 'incomplete') result.completed = false;
    if (kind === 'json') result.text = 'invalid';
    if (kind === 'schema') result.text = '{}';
    if (kind === 'model') result.model = 'another-model';
    const provider = { complete: async () => { calls++; return result; } };
    for (let i = 0; i < 2; i++) await expect(executeReview(p, { root: dir, budgetUsd: 1.5, provider })).rejects.toThrow();
    expect(calls).toBe(1); expect(fs.existsSync(path.join(dir, 'steps/editor.result.json'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'editorial-review.json'))).toBe(false);
  });
  it('holds an unknown outcome with no automatic retry', async () => {
    const dir = root(), p = prepared(); let calls = 0;
    const provider = { complete: async () => { calls++; throw Error('transport'); } };
    await expect(executeReview(p, { root: dir, budgetUsd: 1.5, provider })).rejects.toThrow('transport');
    await expect(executeReview(p, { root: dir, budgetUsd: 1.5, provider })).rejects.toThrow('paid_step_outcome_unknown_no_automatic_retry');
    expect(calls).toBe(1);
  });
  it('changed input cannot reuse an old paid root', async () => {
    const dir = root(); let calls = 0;
    const provider = { complete: async () => { calls++; return response(); } };
    await executeReview(prepared(), { root: dir, budgetUsd: 1.5, provider });
    const other = prepared(Buffer.from(fixture.toString().replace('חייך|חייכה', 'צחק|צחקה')));
    await expect(executeReview(other, { root: dir, budgetUsd: 1.5, provider })).rejects.toThrow('preview_input_changed_new_run_required');
    expect(calls).toBe(1);
  });
  it('CLI requires explicit live mode and rejects output traversal/unknown flags', () => {
    const args = ['--story', 'story.md', '--sha', hash(fixture), '--out', 'outputs/editor-test', '--max-usd', '1.5'];
    expect(parseArgs(args).live).toBe(false);
    expect(parseArgs([...args, '--live']).live).toBe(true);
    expect(() => parseArgs([...args, '--render'])).toThrow('editor_arguments_invalid');
    expect(() => parseArgs(args.map(s => s === 'outputs/editor-test' ? 'outputs/../editor-test' : s)))
      .toThrow('editor_arguments_invalid');
  });
});
