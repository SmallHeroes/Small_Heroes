import { afterEach, describe, expect, it, vi } from 'vitest';
import { personalStoryOutputLimits, storyReservationUsd, generationTimeoutMs } from '../story-config';
import { withGenerationDeadline } from '../generation-deadline';
import { preparePersonalStory, writePersonalStory, StoryWriterError } from '../story-writer';
import { IntakeLedger } from '../intake-ledger';
import { resolvePersonalWizardOptions } from '../options';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
afterEach(() => vi.useRealTimers());
const error = (reason: string) => Error(reason);
describe('length-scaled generation deadlines', () => {
  it.each([8, 12, 16])('one policy binds both caps and reservation for %i', count => {
    const caps = personalStoryOutputLimits(count);
    expect(caps).toEqual({ planOutputTokens: 4000 + 500 * count, manuscriptOutputTokens: 4000 + 500 * count });
    expect(storyReservationUsd('gpt-6-sol', count)).toBeCloseTo((128000 * 2 + (caps.planOutputTokens + caps.manuscriptOutputTokens) * 10) / 1e6 * 1.1, 10);
    expect(generationTimeoutMs(caps.planOutputTokens)).toBeGreaterThan(180000);
  });
  it.each([0, 7, 17, NaN, Infinity, '8'])('rejects invalid length %s', count => {
    expect(() => personalStoryOutputLimits(count as number)).toThrow('story_length_invalid');
  });
  it('bounds a provider ignoring cancellation and consumes its late rejection', async () => {
    vi.useFakeTimers(); let signal!: AbortSignal; let reject!: (error: Error) => void;
    const result = withGenerationDeadline(8000, new AbortController().signal, error, local => { signal = local; return new Promise((_, r) => { reject = r; }); }).catch(e => e);
    await vi.advanceTimersByTimeAsync(180001); expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(generationTimeoutMs(8000) - 180000);
    expect(((await result) as Error).message).toBe('timeout'); expect(signal.aborted).toBe(true);
    reject(Error('late private error')); await Promise.resolve(); expect(vi.getTimerCount()).toBe(0);
  });
  it('distinguishes external cancellation and never starts pre-cancelled work', async () => {
    const c = new AbortController(); c.abort(); const operation = vi.fn();
    await expect(withGenerationDeadline(8000, c.signal, error, operation)).rejects.toThrow('cancelled');
    expect(operation).not.toHaveBeenCalled();
  });
  it('gives the second writer stage a fresh deadline beyond the former whole-job cap', async () => {
    const f = await personalStoryboardFixture(); vi.useFakeTimers(); const prepared = preparePersonalStory(f.request, resolvePersonalWizardOptions());
    const stages: string[] = [];
    const provider = { generate: vi.fn((call: { stage: 'plan' | 'manuscript' }) => new Promise<{output: unknown; usage: null}>(resolve => {
      stages.push(call.stage); setTimeout(() => resolve({ output: call.stage === 'plan' ? f.result.plan : f.result.manuscript, usage: null }), 179000);
    })) };
    const result = writePersonalStory({ prepared, userId: 'u', jobId: 's_deadline0000001', settings: { model: 'gpt-6-sol', budgetUsd: 1, maxJobs: 1, operators: new Set(['op@example.com']) }, ledger: new IntakeLedger(), signal: new AbortController().signal, provider: () => provider });
    await vi.advanceTimersByTimeAsync(179001); expect(stages).toEqual(['plan', 'manuscript']);
    await vi.advanceTimersByTimeAsync(179001); expect((await result).accounting.providerCalls).toBe(2); expect(vi.getTimerCount()).toBe(0);
  });
  it('reports story_timeout and unknown billed usage, not story_cancelled', async () => {
    const f = await personalStoryboardFixture(); vi.useFakeTimers(); const prepared = preparePersonalStory(f.request, resolvePersonalWizardOptions()); const ledger = new IntakeLedger();
    const result = writePersonalStory({ prepared, userId: 'u', jobId: 's_deadline0000002', settings: { model: 'gpt-6-sol', budgetUsd: 1, maxJobs: 1, operators: new Set(['op@example.com']) }, ledger, signal: new AbortController().signal, provider: () => ({ generate: () => new Promise(() => {}) }) }).catch(e => e as StoryWriterError);
    await vi.advanceTimersByTimeAsync(generationTimeoutMs(8000) + 1); const failure = await result as StoryWriterError;
    expect(failure.code).toBe('story_timeout'); expect(failure.accounting?.estimatedUsd).toBeNull(); expect(ledger.snapshot().inFlight).toBe(0);
  });
});
