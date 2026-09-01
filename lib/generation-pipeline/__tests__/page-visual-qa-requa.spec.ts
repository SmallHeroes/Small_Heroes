import { describe, it, expect, vi } from 'vitest';
import { evaluatePageVisualQaWithReQa } from '@/lib/generation-pipeline/page-visual-qa';
import type { PageVisualQaResult } from '@/lib/generation-pipeline/page-visual-qa';

const FLAGS: PageVisualQaResult['flags'] = {
  anatomyOk: true, identityOk: true, styleOk: true, singleChildOk: true, objectGeometryOk: true,
  emotionalStagingOk: true, timeOfDayOk: true, companionSilhouetteOk: true, childPresenceOk: true, safetyOk: true,
};
function qaResult(over: Partial<PageVisualQaResult>): PageVisualQaResult {
  return {
    passed: true, verdict: 'evidence_unknown', reason: 'vision_malformed', details: '',
    flags: FLAGS, safetyHazards: [], safetyStatus: 'unverified', ...over,
  };
}
const MALFORMED = qaResult({ reason: 'vision_malformed', verdict: 'evidence_unknown', safetyStatus: 'unverified' });
const TRANSPORT_ERROR = qaResult({ reason: 'vision_error', verdict: 'evidence_unknown', safetyStatus: 'unverified' });
const TIMEOUT = qaResult({ reason: 'vision_timeout', verdict: 'evidence_unknown', safetyStatus: 'unverified' });
const SKIPPED = qaResult({ reason: 'vision_skipped', verdict: 'evidence_unknown', safetyStatus: 'unverified' });
const PASSED = qaResult({ passed: true, reason: 'ok', verdict: 'passed', safetyStatus: 'safe' });
const VISUAL_FAIL = qaResult({ passed: false, reason: 'anatomy_failed', verdict: 'failed', safetyStatus: 'safe' });
const HAZARD = qaResult({ passed: false, reason: 'safety_failed', verdict: 'failed', safetyStatus: 'hazard', safetyHazards: ['child_on_railing'] });

const INPUT = { imageUrl: 'https://cdn.example/o/pages/page-04.png', expectsChild: true };

describe('evaluatePageVisualQaWithReQa (3b) — evidence re-QA uses the SAME image and stays bounded', () => {
  it('malformed twice then a real verdict → re-QAs the SAME input, returns the real verdict (3 QA calls, 0 renders)', async () => {
    const evaluate = vi.fn()
      .mockResolvedValueOnce(MALFORMED)
      .mockResolvedValueOnce(MALFORMED)
      .mockResolvedValueOnce(PASSED);
    const qa = await evaluatePageVisualQaWithReQa(INPUT, evaluate, 2);
    expect(evaluate).toHaveBeenCalledTimes(3);
    // every call is on the IDENTICAL image input — no new render was produced between attempts
    expect(evaluate).toHaveBeenNthCalledWith(1, INPUT);
    expect(evaluate).toHaveBeenNthCalledWith(2, INPUT);
    expect(evaluate).toHaveBeenNthCalledWith(3, INPUT);
    expect(qa).toBe(PASSED);
  });

  it('never logs an inline image or customer asset URL while retrying', async () => {
    const inlineInput = {
      imageUrl: `data:image/png;base64,${Buffer.from('private-child-image').toString('base64')}`,
      expectsChild: true,
    };
    const evaluate = vi
      .fn()
      .mockResolvedValueOnce(MALFORMED)
      .mockResolvedValueOnce(PASSED);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await evaluatePageVisualQaWithReQa(inlineInput, evaluate, 2);

    const output = log.mock.calls.flat().join('\n');
    expect(output).toContain('reqa_same_image');
    expect(output).not.toContain(inlineInput.imageUrl);
    expect(output).not.toContain('private-child-image');
    log.mockRestore();
  });

  it('persistently malformed → stays fail-closed unverified, bounded to 1 + maxReQa calls', async () => {
    const evaluate = vi.fn().mockResolvedValue(MALFORMED);
    const qa = await evaluatePageVisualQaWithReQa(INPUT, evaluate, 2);
    expect(evaluate).toHaveBeenCalledTimes(3); // initial + 2 bounded re-QA, then give up
    expect(qa.reason).toBe('vision_malformed');
    expect(qa.safetyStatus).toBe('unverified'); // fail-closed default PRESERVED — the caller holds without a render
  });

  it.each([
    ['transport error', TRANSPORT_ERROR],
    ['timeout', TIMEOUT],
  ])('%s is boundedly re-QA\'d on the same candidate', async (_label, evidenceFailure) => {
    const evaluate = vi.fn().mockResolvedValue(evidenceFailure);
    const qa = await evaluatePageVisualQaWithReQa(INPUT, evaluate, 2);
    expect(evaluate).toHaveBeenCalledTimes(3);
    expect(evaluate.mock.calls.every(([callInput]) => callInput === INPUT)).toBe(true);
    expect(qa).toBe(evidenceFailure);
  });

  it('skipped/unavailable vision is not retried in the same process', async () => {
    const evaluate = vi.fn().mockResolvedValue(SKIPPED);
    const qa = await evaluatePageVisualQaWithReQa(INPUT, evaluate, 2);
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(qa).toBe(SKIPPED);
  });

  it('a real visual failure on the first call → NO re-QA (only a verified failure consumes a regen)', async () => {
    const evaluate = vi.fn().mockResolvedValue(VISUAL_FAIL);
    const qa = await evaluatePageVisualQaWithReQa(INPUT, evaluate, 2);
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(qa.passed).toBe(false);
  });

  it('a confirmed safety HAZARD is a real verdict, not transport → NO re-QA', async () => {
    const evaluate = vi.fn().mockResolvedValue(HAZARD);
    const qa = await evaluatePageVisualQaWithReQa(INPUT, evaluate, 2);
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(qa.safetyStatus).toBe('hazard');
  });

  it('a clean pass on the first call → NO re-QA', async () => {
    const evaluate = vi.fn().mockResolvedValue(PASSED);
    const qa = await evaluatePageVisualQaWithReQa(INPUT, evaluate, 2);
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(qa.safetyStatus).toBe('safe');
  });
});
