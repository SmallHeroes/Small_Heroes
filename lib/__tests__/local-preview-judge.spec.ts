import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QUALITY_CATEGORIES, PREVIEW_QUALITY_VERSION, ANATOMY_INSPECTION_INSTRUCTION, PREVIEW_JUDGE_INSTRUCTION } from '../local-preview-quality';
import { previewSha, previewCheckpoint, previewAccountedUsd } from '../local-story-preview';
const { create, constructor } = vi.hoisted(() => ({ create: vi.fn(), constructor: vi.fn() }));
vi.mock('openai', () => ({ default: class { responses = { create }; constructor(options: unknown) { constructor(options); } } }));
import { judgePreviewCandidate } from '../../scripts/lib/local-preview-judge';
let root: string, candidatePath: string, candidateSha: string;
const contextSha = 'a'.repeat(64);
beforeEach(async () => {
  create.mockReset(); constructor.mockReset(); root = fs.mkdtempSync(path.join(os.tmpdir(), 'sh-judge-adapter-'));
  const bytes = await sharp({ create: { width: 32, height: 48, channels: 3, background: '#fff' } }).png().toBuffer();
  candidatePath = path.join(root, 'candidate.png'); fs.writeFileSync(candidatePath, bytes); candidateSha = previewSha(bytes);
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
const response = (value: unknown) => ({ status: 'completed', output_text: JSON.stringify(value), usage: { input_tokens: 10, output_tokens: 10 },
  service_tier: 'flex', model: 'gpt-5.5-2026-04-23', id: 'resp-test', incomplete_details: null });
const anatomyPass = () => ({ verdict: 'pass', visibleBodyTraces: ['coherent body'], observation: 'clear', correction: '' });
const reviewPass = () => ({ candidateSha, contextSha, checks: QUALITY_CATEGORIES.map(category => ({ category, verdict: 'pass', observation: 'clear', correction: '' })) });
const receipt = (step: string) => JSON.parse(fs.readFileSync(path.join(root, 'steps', `${step}.result.json`), 'utf8'));
const args = () => ({ root, candidatePath, candidateSha, contextSha, step: 'judge-test', apiKey: 'test', budgetUsd: 3,
  context: { expectedPose: 'NARRATIVE_SENTINEL' }, references: [] });
describe('real preview judge adapter with mocked provider transport', () => {
  it('blind anatomy failure survives contextual PASS and replay makes zero new calls', async () => {
    create.mockResolvedValueOnce(response({ verdict: 'defect', visibleBodyTraces: ['disconnected visible arm'], observation: 'visible defect', correction: 'connect arm' }))
      .mockResolvedValueOnce(response({ candidateSha, contextSha, checks: QUALITY_CATEGORIES.map(category => ({ category, verdict: 'pass', observation: 'clear', correction: '' })) }));
    const first = await judgePreviewCandidate(args());
    expect(first.checks.find(c => c.category === 'anatomy')?.verdict).toBe('defect');
    expect(JSON.stringify(create.mock.calls[0])).not.toContain('NARRATIVE_SENTINEL');
    expect(JSON.stringify(create.mock.calls[1])).toContain('NARRATIVE_SENTINEL');
    for (const [request] of create.mock.calls) {
      expect(request.model).toBe('gpt-5.5');
      expect(request.reasoning).toEqual({ effort: 'medium' });
      expect(request.store).toBe(false);
      expect(request.service_tier).toBe('flex');
    }
    for (const [options] of constructor.mock.calls) expect(options).toMatchObject({ maxRetries: 0, timeout: 900_000, baseURL: 'https://api.openai.com/v1' });
    expect(create.mock.calls[0][0].input[0].content.filter((c: { type: string }) => c.type === 'input_image')).toHaveLength(5);
    expect(await judgePreviewCandidate(args())).toEqual(first); expect(create).toHaveBeenCalledTimes(2);
  });
  it('incomplete inspection cannot dispatch contextual review or become a defect', async () => {
    create.mockResolvedValueOnce({ ...response(null), status: 'incomplete', output_text: '', usage: { input_tokens: 10, output_tokens: 4500 }, incomplete_details: { reason: 'max_output_tokens' } });
    await expect(judgePreviewCandidate(args())).rejects.toThrow('preview_anatomy_inspection_incomplete');
    await expect(judgePreviewCandidate(args())).rejects.toThrow('preview_anatomy_inspection_incomplete');
    expect(create).toHaveBeenCalledTimes(1);
    expect(receipt('judge-test-anatomy').value.incompleteDetails).toEqual({ reason: 'max_output_tokens' });
  });
  it('tampered candidate/reference bytes reject before provider access', async () => {
    await expect(judgePreviewCandidate({ ...args(), candidateSha: 'b'.repeat(64) })).rejects.toThrow('judge_candidate_changed');
    await expect(judgePreviewCandidate({ ...args(), references: [{ role: 'anchor', file: candidatePath, sha: 'b'.repeat(64) }] })).rejects.toThrow('judge_reference_changed');
    expect(create).not.toHaveBeenCalled();
  });
  it('preserves model-visible context, instructions, caps and all five high-detail views in both stages', async () => {
    create.mockResolvedValueOnce(response(anatomyPass())).mockResolvedValueOnce(response(reviewPass()));
    const refs = [{ role: 'child anchor', file: candidatePath, sha: candidateSha }];
    await judgePreviewCandidate({ ...args(), references: refs });
    const [blind, contextual] = create.mock.calls.map(([request]) => request);
    expect(blind.instructions).toBe(ANATOMY_INSPECTION_INSTRUCTION);
    expect(contextual.instructions).toBe(PREVIEW_JUDGE_INSTRUCTION);
    expect(blind.max_output_tokens).toBe(10000); expect(contextual.max_output_tokens).toBe(4500);
    const expectedInput = { version: PREVIEW_QUALITY_VERSION, instruction: PREVIEW_JUDGE_INSTRUCTION, anatomy: anatomyPass(),
      candidateSha, contextSha, context: args().context, references: [{ role: 'child anchor', sha: candidateSha }],
      model: 'gpt-5.5', effort: 'medium', maxOutputTokens: 4500 };
    expect(contextual.input[0].content[0].text).toBe(JSON.stringify(expectedInput));
    expect(contextual.input[0].content.slice(3)).toEqual(blind.input[0].content);
    expect(blind.input[0].content.filter((c: { type: string }) => c.type === 'input_image').every((c: { detail: string }) => c.detail === 'high')).toBe(true);
    for (const step of ['judge-test-anatomy', 'judge-test']) {
      expect(receipt(step).value).toMatchObject({ requestedServiceTier: 'flex', serviceTier: 'flex', responseId: 'resp-test', model: 'gpt-5.5-2026-04-23' });
      expect(receipt(step).usage).toEqual({ input_tokens: 10, output_tokens: 10 });
    }
  });
  it.each(['default', 'auto', 'priority', null, undefined])('persists and rejects anatomy served tier %s without a contextual call or replay charge', async serviceTier => {
    create.mockResolvedValueOnce({ ...response(anatomyPass()), service_tier: serviceTier });
    await expect(judgePreviewCandidate(args())).rejects.toThrow('preview_judge_service_tier_mismatch');
    const before = fs.readFileSync(path.join(root, 'steps/judge-test-anatomy.result.json'));
    await expect(judgePreviewCandidate(args())).rejects.toThrow('preview_judge_service_tier_mismatch');
    expect(create).toHaveBeenCalledTimes(1);
    expect(receipt('judge-test-anatomy').value.serviceTier).toBe(serviceTier ?? null);
    expect(fs.readFileSync(path.join(root, 'steps/judge-test-anatomy.result.json'))).toEqual(before);
    expect(previewAccountedUsd(path.join(root, 'steps'))).toBeCloseTo(0.0006);
  });
  it.each(['default', undefined])('rejects contextual served tier %s, including on replay, after preserving both receipts', async serviceTier => {
    create.mockResolvedValueOnce(response(anatomyPass())).mockResolvedValueOnce({ ...response(reviewPass()), service_tier: serviceTier });
    await expect(judgePreviewCandidate(args())).rejects.toThrow('preview_judge_service_tier_mismatch');
    await expect(judgePreviewCandidate(args())).rejects.toThrow('preview_judge_service_tier_mismatch');
    expect(create).toHaveBeenCalledTimes(2);
    expect(receipt('judge-test').value.serviceTier).toBe(serviceTier ?? null);
    expect(previewAccountedUsd(path.join(root, 'steps'))).toBeCloseTo(0.0012);
  });
  it.each(['429_resource_unavailable', 'request_timeout'])('never retries or falls back after %s and keeps unknown reservation', async message => {
    create.mockRejectedValueOnce(Error(message));
    await expect(judgePreviewCandidate(args())).rejects.toThrow(message);
    await expect(judgePreviewCandidate(args())).rejects.toThrow('paid_step_outcome_unknown_no_automatic_retry');
    expect(create).toHaveBeenCalledTimes(1);
    expect(previewAccountedUsd(path.join(root, 'steps'))).toBe(0.5);
  });
  it('the real SDK dispatches only once on Flex 429 with the configured options', async () => {
    const { default: RealOpenAI } = await vi.importActual<typeof import('openai')>('openai');
    const fetch = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Flex unavailable', type: 'resource_unavailable', code: 'resource_unavailable' } }),
      { status: 429, headers: { 'content-type': 'application/json' } }));
    create.mockImplementationOnce(request => new RealOpenAI({ ...constructor.mock.calls[0][0], fetch }).responses.create(request));
    await expect(judgePreviewCandidate(args())).rejects.toThrow('429');
    await expect(judgePreviewCandidate(args())).rejects.toThrow('paid_step_outcome_unknown_no_automatic_retry');
    expect(fetch).toHaveBeenCalledTimes(1); expect(create).toHaveBeenCalledTimes(1);
  });
  it('preserves incomplete contextual response and does not reissue either stage', async () => {
    create.mockResolvedValueOnce(response(anatomyPass())).mockResolvedValueOnce({ ...response(null), status: 'incomplete', output_text: '', incomplete_details: { reason: 'max_output_tokens' } });
    await expect(judgePreviewCandidate(args())).rejects.toThrow('preview_judge_incomplete');
    await expect(judgePreviewCandidate(args())).rejects.toThrow('preview_judge_incomplete');
    expect(create).toHaveBeenCalledTimes(2);
    expect(receipt('judge-test').value.incompleteDetails).toEqual({ reason: 'max_output_tokens' });
  });
  it('refuses historical Standard checkpoint identity without modifying evidence or dispatching', async () => {
    await previewCheckpoint({ root, step: 'judge-test-anatomy', budgetUsd: 3, reserveUsd: 0.5,
      input: { version: PREVIEW_QUALITY_VERSION, instruction: ANATOMY_INSPECTION_INSTRUCTION, candidateSha,
        model: 'gpt-5.5', effort: 'medium', maxOutputTokens: 10000 },
      produce: async () => ({ value: { status: 'completed', text: JSON.stringify(anatomyPass()) }, usage: { input_tokens: 10, output_tokens: 10 } }) });
    const before = fs.readFileSync(path.join(root, 'steps/judge-test-anatomy.result.json'));
    await expect(judgePreviewCandidate(args())).rejects.toThrow('checkpoint_identity_changed');
    expect(create).not.toHaveBeenCalled();
    expect(fs.readFileSync(path.join(root, 'steps/judge-test-anatomy.result.json'))).toEqual(before);
  });
});
