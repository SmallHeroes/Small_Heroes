import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  evaluatePageChildResemblanceVision,
  evaluateStoredPageChildResemblanceVision,
  parsePageChildResemblanceVisionResponse,
  resolvePageChildResemblanceTimeoutMs,
  scoreIdentityFeatures,
} from '../page-child-resemblance-vision';

afterEach(() => vi.unstubAllEnvs());

const base = {
  referenceChildVisible: true,
  candidateChildVisible: true,
  candidateChildCount: 1,
  comparisonUsable: true,
  sameChildDecision: 'same',
  faceStructure: 'match',
  eyesBrows: 'match',
  noseMouth: 'match',
  hairIdentity: 'mismatch',
  distinctiveFeatures: 'mismatch',
} as const;

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify(value) } }],
  }), { status, headers: { 'content-type': 'application/json' } });
}

function availableInspection(args: {
  data: Buffer;
  sha256: string;
  format: 'png' | 'webp';
  mime: 'image/png' | 'image/webp';
}) {
  return {
    ok: true,
    bytes: args.data.byteLength,
    format: args.format,
    mime: args.mime,
    width: 10,
    height: 10,
    sha256: args.sha256,
    data: args.data,
  };
}

describe('page child resemblance vision', () => {
  it('clamps an oversized provider timeout below the 300 second route boundary', () => {
    vi.stubEnv('PAGE_CHILD_RESEMBLANCE_TIMEOUT_MS', '99999999');
    expect(resolvePageChildResemblanceTimeoutMs()).toBe(60_000);
  });
  it('computes the 0.70 boundary in code, not from a model score', () => {
    const parsed = parsePageChildResemblanceVisionResponse(base);
    expect(parsed).not.toBeNull();
    expect(scoreIdentityFeatures(parsed!.featureAssessments)).toBeCloseTo(0.7, 10);
  });

  it('passes exactly 0.70 and sends the anchor before the scene', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      const content = body.messages[0].content;
      expect(content[0].image_url.url).toBe('https://assets.test/anchor.png');
      expect(content[1].image_url.url).toBe('https://assets.test/page.png');
      return response(base);
    });
    const result = await evaluatePageChildResemblanceVision({
      referenceImageUrl: 'https://assets.test/anchor.png',
      candidateImageUrl: 'https://assets.test/page.png',
      threshold: 0.7,
      apiKey: 'test-key',
      fetchImpl,
    });
    expect(result).toMatchObject({
      status: 'passed',
      resemblanceScore: 0.7,
      threshold: 0.7,
      sameChild: true,
      attempts: 1,
    });
  });

  it('fails below 0.70 or an explicit different-child decision', async () => {
    const below = { ...base, noseMouth: 'unclear' as const };
    const belowResult = await evaluatePageChildResemblanceVision({
      referenceImageUrl: 'https://assets.test/anchor.png',
      candidateImageUrl: 'https://assets.test/page.png',
      threshold: 0.7,
      apiKey: 'test-key',
      fetchImpl: async () => response(below),
    });
    expect(belowResult.status).toBe('failed');
    expect(belowResult.resemblanceScore).toBeCloseTo(0.6, 10);

    const different = await evaluatePageChildResemblanceVision({
      referenceImageUrl: 'https://assets.test/anchor.png',
      candidateImageUrl: 'https://assets.test/page.png',
      threshold: 0.7,
      apiKey: 'test-key',
      fetchImpl: async () => response({ ...base, sameChildDecision: 'different' }),
    });
    expect(different).toMatchObject({ status: 'failed', reasonCode: 'different_child' });
  });

  it('fails closed on unassessable, missing, multiple, and malformed subjects', async () => {
    const unusable = await evaluatePageChildResemblanceVision({
      referenceImageUrl: 'a', candidateImageUrl: 'b', threshold: 0.7,
      apiKey: 'k', fetchImpl: async () => response({ ...base, comparisonUsable: false, sameChildDecision: 'uncertain' }),
    });
    expect(unusable.status).toBe('evidence_unknown');

    const missing = await evaluatePageChildResemblanceVision({
      referenceImageUrl: 'a', candidateImageUrl: 'b', threshold: 0.7,
      apiKey: 'k', fetchImpl: async () => response({ ...base, candidateChildVisible: false, candidateChildCount: 0, comparisonUsable: false, sameChildDecision: 'uncertain' }),
    });
    expect(missing).toMatchObject({ status: 'failed', reasonCode: 'candidate_missing' });

    const multiple = await evaluatePageChildResemblanceVision({
      referenceImageUrl: 'a', candidateImageUrl: 'b', threshold: 0.7,
      apiKey: 'k', fetchImpl: async () => response({ ...base, candidateChildCount: 2, sameChildDecision: 'uncertain' }),
    });
    expect(multiple).toMatchObject({ status: 'failed', reasonCode: 'multiple_children' });

    const malformedFetch = vi.fn(async () => response({ ...base, extra: true }));
    const malformed = await evaluatePageChildResemblanceVision({
      referenceImageUrl: 'a', candidateImageUrl: 'b', threshold: 0.7,
      apiKey: 'k', fetchImpl: malformedFetch, maxRetries: 2,
    });
    expect(malformed).toMatchObject({ status: 'evidence_unknown', reasonCode: 'malformed', attempts: 3 });
    expect(malformedFetch).toHaveBeenCalledTimes(3);
  });

  it('rejects a threshold below the product floor and does not call a provider without credentials', async () => {
    await expect(evaluatePageChildResemblanceVision({
      referenceImageUrl: 'a', candidateImageUrl: 'b', threshold: 0.699999,
      apiKey: 'k', fetchImpl: async () => response(base),
    })).rejects.toThrow('0.7');
    const fetchImpl = vi.fn();
    const result = await evaluatePageChildResemblanceVision({
      referenceImageUrl: 'a', candidateImageUrl: 'b', threshold: 0.7,
      apiKey: null, fetchImpl,
    });
    expect(result.status).toBe('evidence_unknown');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('never permits a caller to raise the two-retry product ceiling', async () => {
    const fetchImpl = vi.fn(async () => response({ ...base, extra: true }));
    const result = await evaluatePageChildResemblanceVision({
      referenceImageUrl: 'a',
      candidateImageUrl: 'b',
      threshold: 0.7,
      apiKey: 'k',
      fetchImpl,
      maxRetries: 99,
    });
    expect(result).toMatchObject({
      status: 'evidence_unknown',
      reasonCode: 'malformed',
      attempts: 3,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('does not start a sibling retry after a shared batch gate observes deterministic refusal', async () => {
    let markSiblingStarted!: () => void;
    const siblingStarted = new Promise<void>((resolve) => {
      markSiblingStarted = resolve;
    });
    let markTerminal!: () => void;
    const terminalObserved = new Promise<void>((resolve) => {
      markTerminal = resolve;
    });
    let deterministicRefusal = false;
    const shouldStartAttempt = () => !deterministicRefusal;
    const below = { ...base, noseMouth: 'unclear' as const };
    const refusingFetch = vi.fn(async () => {
      await siblingStarted;
      return response(below);
    });
    const siblingFetch = vi.fn(async () => {
      markSiblingStarted();
      await terminalObserved;
      return response({ ...base, extra: true });
    });

    const refusing = evaluatePageChildResemblanceVision({
      referenceImageUrl: 'anchor',
      candidateImageUrl: 'page-a',
      threshold: 0.7,
      apiKey: 'k',
      fetchImpl: refusingFetch,
      maxRetries: 2,
      shouldStartAttempt,
    }).then((result) => {
      if (result.status === 'failed') {
        deterministicRefusal = true;
        markTerminal();
      }
      return result;
    });
    const sibling = evaluatePageChildResemblanceVision({
      referenceImageUrl: 'anchor',
      candidateImageUrl: 'page-b',
      threshold: 0.7,
      apiKey: 'k',
      fetchImpl: siblingFetch,
      maxRetries: 2,
      shouldStartAttempt,
    });

    await expect(refusing).resolves.toMatchObject({
      status: 'failed',
      reasonCode: 'below_threshold',
      attempts: 1,
    });
    await expect(sibling).resolves.toMatchObject({
      status: 'evidence_unknown',
      reasonCode: 'batch_cancelled',
      attempts: 1,
    });
    expect(refusingFetch).toHaveBeenCalledTimes(1);
    expect(siblingFetch).toHaveBeenCalledTimes(1);
  });
});

describe('stored-byte page child resemblance vision', () => {
  const referenceUrl = 'https://assets.test/anchor.png';
  const candidateUrl = 'https://assets.test/page.webp';
  const referenceData = Buffer.from([0, 1, 2, 3, 254, 255]);
  const candidateData = Buffer.from('candidate-exact-image-bytes', 'utf8');
  const referenceSha = 'a'.repeat(64);
  const candidateSha = 'b'.repeat(64);

  it('inspects each stored URL once and sends exact buffers to Vision in anchor-first order, returning both exact SHAs', async () => {
    const inspectWithBytes = vi.fn(async (url: string | null | undefined) => {
      if (url === referenceUrl) {
        return availableInspection({
          data: referenceData,
          sha256: referenceSha,
          format: 'png',
          mime: 'image/png',
        });
      }
      if (url === candidateUrl) {
        return availableInspection({
          data: candidateData,
          sha256: candidateSha,
          format: 'webp',
          mime: 'image/webp',
        });
      }
      throw new Error(`unexpected URL: ${url}`);
    });
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        messages: Array<{ content: Array<{ image_url?: { url: string } }> }>;
      };
      const content = body.messages[0].content;
      expect(content[0].image_url?.url).toBe(
        `data:image/png;base64,${referenceData.toString('base64')}`,
      );
      expect(content[1].image_url?.url).toBe(
        `data:image/webp;base64,${candidateData.toString('base64')}`,
      );
      return response(base);
    });

    const stored = await evaluateStoredPageChildResemblanceVision({
      referenceImageUrl: referenceUrl,
      candidateImageUrl: candidateUrl,
      threshold: 0.7,
      inspectWithBytes,
      fetchImpl,
      apiKey: 'test-key',
    });

    expect(inspectWithBytes).toHaveBeenCalledTimes(2);
    expect(inspectWithBytes).toHaveBeenNthCalledWith(1, referenceUrl);
    expect(inspectWithBytes).toHaveBeenNthCalledWith(2, candidateUrl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(stored).toMatchObject({
      result: { status: 'passed', resemblanceScore: 0.7, attempts: 1 },
      referenceBytesSha256: referenceSha,
      candidateBytesSha256: candidateSha,
    });
  });

  it('returns exact_bytes_unavailable without calling Vision when either inspection cannot supply exact bytes', async () => {
    const inspectWithBytes = vi.fn(async (url: string | null | undefined) =>
      url === referenceUrl
        ? availableInspection({
            data: referenceData,
            sha256: referenceSha,
            format: 'png',
            mime: 'image/png',
          })
        : {
            ok: false,
            bytes: 0,
            format: null,
            mime: null,
            width: null,
            height: null,
            sha256: null,
            data: null,
            error: 'stored_bytes_unavailable',
          },
    );
    const fetchImpl = vi.fn();

    const stored = await evaluateStoredPageChildResemblanceVision({
      referenceImageUrl: referenceUrl,
      candidateImageUrl: candidateUrl,
      threshold: 0.7,
      inspectWithBytes,
      fetchImpl,
      apiKey: 'test-key',
    });

    expect(inspectWithBytes).toHaveBeenCalledTimes(2);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(stored).toEqual({
      result: {
        evaluatorVersion: 'page-child-resemblance-vision/v1',
        status: 'evidence_unknown',
        resemblanceScore: null,
        threshold: 0.7,
        subjectVisible: null,
        sameChild: null,
        reasonCode: 'exact_bytes_unavailable',
        attempts: 0,
        model: 'gpt-4o',
        featureAssessments: null,
      },
      referenceBytesSha256: referenceSha,
      candidateBytesSha256: null,
    });
  });

  it('checks the product threshold floor before inspecting either stored URL', async () => {
    const inspectWithBytes = vi.fn();
    const fetchImpl = vi.fn();
    await expect(evaluateStoredPageChildResemblanceVision({
      referenceImageUrl: referenceUrl,
      candidateImageUrl: candidateUrl,
      threshold: 0.699999,
      inspectWithBytes,
      fetchImpl,
      apiKey: 'test-key',
    })).rejects.toThrow('0.7');
    expect(inspectWithBytes).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('keeps both production consumers wired to the stored-byte evaluator', () => {
    const backend = readFileSync(
      path.join(process.cwd(), 'backend/providers/image.ts'),
      'utf8',
    );
    const producer = readFileSync(
      path.join(process.cwd(), 'lib/generation-pipeline/quality-evidence-producer.ts'),
      'utf8',
    );
    expect(backend).toContain('const exact = await evaluateStoredPageChildResemblanceVision({');
    expect(backend).toContain('candidateImageUrl: last.url');
    expect(producer).toContain('deps.scoreResemblance ?? evaluateStoredPageChildResemblanceVision');
    expect(producer).toContain('deliveredBytesSha256: exact.candidateBytesSha256');
  });
});
