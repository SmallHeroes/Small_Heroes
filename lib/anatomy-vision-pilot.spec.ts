import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { ANATOMY_EVIDENCE_VERSION } from './anatomy-evidence-policy';
import { previewSha, previewAccountedUsd } from './local-story-preview';
const { create, options } = vi.hoisted(() => ({ create: vi.fn(), options: vi.fn() }));
vi.mock('openai', () => ({ default: class { responses = { create }; constructor(o: unknown) { options(o); } } }));
import { buildPilotRequest, decidePilot, paidPilot } from '../scripts/lib/anatomy-vision-pilot';
import { pilotMetrics } from '../scripts/run-anatomy-vision-pilot';
let root: string, bytes: Buffer;
beforeEach(async () => {
  create.mockReset(); options.mockReset(); root = fs.mkdtempSync(path.join(os.tmpdir(), 'anatomy-pilot-'));
  bytes = await sharp({ create: { width: 64, height: 96, channels: 3, background: '#fff' } }).png().toBuffer();
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
const build = () => buildPilotRequest(bytes, previewSha(bytes), 'The adult with a tuba.');
const response = () => ({ status: 'completed', output_text: '{}', model: 'gpt-5.5-2026-04-23', service_tier: 'flex', id: 'test-response', incomplete_details: null, usage: { input_tokens: 100, output_tokens: 100 } });

it('builds exact five high-detail views, bounded policy and no evaluation labels or expected counts', async () => {
  const b = await build(), r = b.request;
  expect(r).toMatchObject({ model: 'gpt-5.5', service_tier: 'flex', reasoning: { effort: 'medium' }, max_output_tokens: 6000, store: false, stream: false });
  const input = r.input as { content: { type: string; text?: string; detail?: string }[] }[];
  expect(input[0].content.filter(c => c.type === 'input_image')).toHaveLength(5);
  expect(input[0].content.filter(c => c.type === 'input_image').every(c => c.detail === 'high')).toBe(true);
  const context = JSON.parse(input[0].content[0].text!);
  expect(Object.keys(context).sort()).toEqual(['candidateSha', 'contextSha', 'subjectId', 'targetDescription', 'version']);
  expect(JSON.stringify(r)).not.toContain('maxVisibleHands');
  expect(JSON.stringify(r)).not.toContain('expectedAnatomy');
  expect((await buildPilotRequest(bytes, previewSha(bytes), 'Another visible adult')).contextSha).not.toBe(b.contextSha);
});
it('rejects altered candidate bytes before transport', async () => {
  await expect(buildPilotRequest(bytes, 'a'.repeat(64), 'target')).rejects.toThrow('pilot_candidate_changed');
  expect(create).not.toHaveBeenCalled();
});
it('feeds observations through the real adjudicator and never grants repair authority', async () => {
  const b = await build(), region = { x: 0.2, y: 0.2, width: 0.1, height: 0.1 };
  const raw = { version: ANATOMY_EVIDENCE_VERSION, candidateSha: b.candidateSha, contextSha: b.contextSha,
    coverage: 'complete', subjects: [{ id: 'target', parts: [{ id: 'fragment', kind: 'fragment', region,
      attachment: { state: 'defect', kind: 'disconnected_fragment', observation: 'Visible break', correction: 'Join the part' } }] }] };
  expect(decidePilot(raw, b.candidateSha, b.contextSha)).toMatchObject({ disposition: 'observed_defect', repairAuthorized: false, renderAuthorized: false });
  expect(() => decidePilot(raw, 'a'.repeat(64), b.contextSha)).toThrow('anatomy_evidence_binding');
});
it('replays persisted responses with no new calls and preserves actual tier/usage', async () => {
  create.mockResolvedValue(response()); const { request } = await build();
  const first = await paidPilot(root, 'case-a', request, 'dummy');
  expect(await paidPilot(root, 'case-a', request, 'dummy', true)).toEqual(first);
  expect(create).toHaveBeenCalledTimes(1);
  expect(options.mock.calls[0][0]).toMatchObject({ maxRetries: 0, timeout: 900000, baseURL: 'https://api.openai.com/v1' });
  expect(first.value).toMatchObject({ serviceTier: 'flex', responseId: 'test-response' });
  expect(first.usage).toEqual(response().usage);
});
it('missing replay receipt cannot create a claim or call provider', async () => {
  await expect(paidPilot(root, 'missing', (await build()).request, 'dummy', true)).rejects.toThrow('pilot_replay_missing_receipt');
  expect(fs.readdirSync(root)).toEqual([]); expect(create).not.toHaveBeenCalled();
});
it.each(['default', undefined])('wrong/missing served tier %s is persisted, rejected and never rebilled', async tier => {
  create.mockResolvedValue({ ...response(), service_tier: tier }); const { request } = await build();
  await expect(paidPilot(root, 'tier', request, 'dummy')).rejects.toThrow('pilot_served_tier_mismatch');
  await expect(paidPilot(root, 'tier', request, 'dummy', true)).rejects.toThrow('pilot_served_tier_mismatch');
  expect(create).toHaveBeenCalledTimes(1);
  expect(fs.existsSync(path.join(root, 'steps/tier.result.json'))).toBe(true);
});
it('served model mismatch cannot produce a judgment', async () => {
  create.mockResolvedValue({ ...response(), model: 'other-model' });
  await expect(paidPilot(root, 'model', (await build()).request, 'dummy')).rejects.toThrow('pilot_served_model_mismatch');
});
it('incomplete response preserves usage and cannot retry', async () => {
  create.mockResolvedValue({ ...response(), status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } });
  const { request } = await build();
  await expect(paidPilot(root, 'short', request, 'dummy')).rejects.toThrow('pilot_incomplete');
  await expect(paidPilot(root, 'short', request, 'dummy', true)).rejects.toThrow('pilot_incomplete');
  expect(create).toHaveBeenCalledTimes(1);
});
it('unknown outcome retains reservation and prohibits retry', async () => {
  create.mockRejectedValue(Error('transport')); const { request } = await build();
  await expect(paidPilot(root, 'unknown', request, 'dummy')).rejects.toThrow('transport');
  await expect(paidPilot(root, 'unknown', request, 'dummy')).rejects.toThrow('paid_step_outcome_unknown_no_automatic_retry');
  expect(previewAccountedUsd(path.join(root, 'steps'))).toBe(0.5); expect(create).toHaveBeenCalledTimes(1);
});
it('request identity mismatch cannot reuse an old result', async () => {
  create.mockResolvedValue(response()); const { request } = await build();
  await paidPilot(root, 'same', request, 'dummy');
  await expect(paidPilot(root, 'same', { ...request, input: [] }, 'dummy')).rejects.toThrow('checkpoint_identity_changed');
  expect(create).toHaveBeenCalledTimes(1);
});
it('three-dollar conservative ceiling blocks further requests, including missing-usage reservations', async () => {
  create.mockResolvedValue({ ...response(), usage: null }); const { request } = await build();
  for (let i = 0; i < 6; i++) await paidPilot(root, `case-${i}`, request, 'dummy');
  await expect(paidPilot(root, 'case-6', request, 'dummy')).rejects.toThrow('preview_budget_exhausted');
  expect(create).toHaveBeenCalledTimes(6);
});
it('over-reservation result remains known and cannot be charged again', async () => {
  create.mockResolvedValue({ ...response(), usage: { input_tokens: 30000, output_tokens: 6000 } }); const { request } = await build();
  await expect(paidPilot(root, 'large', request, 'dummy')).rejects.toThrow('preview_usage_exceeded_reservation');
  await expect(paidPilot(root, 'large', request, 'dummy')).rejects.toThrow('preview_usage_exceeded_reservation');
  expect(create).toHaveBeenCalledTimes(1);
});
it('separates missed defects, false passes and false holds in case-level metrics', () => {
  expect(pilotMetrics([
    { expected: 'defect', disposition: 'held_uncertain', defectCount: 1 },
    { expected: 'defect', disposition: 'observed_pass', defectCount: 0 },
    { expected: 'pass', disposition: 'held_uncertain', defectCount: 0 },
  ])).toMatchObject({ positiveReportsWithDefect: 1, positiveReportsWithoutDefect: 1, positiveFalsePasses: 1, negativeReportsWithDefect: 0, negativeHolds: 1, negativePasses: 0 });
});
