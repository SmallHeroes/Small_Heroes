import fs from 'node:fs';
import { evaluatePageChildResemblanceVision, PAGE_CHILD_RESEMBLANCE_VISION_VERSION } from '../../lib/generation-pipeline/page-child-resemblance-vision';
import { PREVIEW_JUDGE_MODEL, PREVIEW_JUDGE_EFFORT, PREVIEW_QUALITY_VERSION } from '../../lib/local-preview-quality';
import { previewCheckpoint, previewSha } from '../../lib/local-story-preview';

export async function judgePreviewIdentity(args: {
  root: string; step: string; budgetUsd: number; apiKey: string;
  anchorPath: string; anchorSha: string; candidatePath: string; candidateSha: string;
  fetchImpl?: typeof fetch;
}) {
  const anchor = fs.readFileSync(args.anchorPath), candidate = fs.readFileSync(args.candidatePath);
  if (previewSha(anchor) !== args.anchorSha || previewSha(candidate) !== args.candidateSha) throw Error('identity_image_binding');
  const data = (bytes: Buffer) => `data:image/png;base64,${bytes.toString('base64')}`;
  return previewCheckpoint({ root: args.root, step: args.step, budgetUsd: args.budgetUsd, reserveUsd: 0.5,
    input: { version: PREVIEW_QUALITY_VERSION, evaluatorVersion: PAGE_CHILD_RESEMBLANCE_VISION_VERSION,
      model: PREVIEW_JUDGE_MODEL, effort: PREVIEW_JUDGE_EFFORT, maxOutputTokens: 6000,
      threshold: 0.70, anchorSha: args.anchorSha, candidateSha: args.candidateSha },
    produce: async () => {
      let usage: Record<string, unknown> | null = null;
      let raw: unknown = null, httpStatus: number | null = null, dispatched = false;
      const result = await evaluatePageChildResemblanceVision({ referenceImageUrl: data(anchor), candidateImageUrl: data(candidate),
        threshold: 0.70, model: PREVIEW_JUDGE_MODEL, reasoningEffort: PREVIEW_JUDGE_EFFORT, maxRetries: 0, apiKey: args.apiKey,
        fetchImpl: async (url, init) => {
          if (String(url) !== 'https://api.openai.com/v1/responses' || dispatched) throw Error('identity_dispatch_fence');
          dispatched = true;
          const response = await (args.fetchImpl ?? fetch)(url, init);
          httpStatus = response.status;
          const body = await response.clone().json().catch(() => null);
          raw = body; usage = body?.usage ?? null;
          return response;
        },
      });
      return { value: { model: PREVIEW_JUDGE_MODEL, effort: PREVIEW_JUDGE_EFFORT, result, httpStatus, raw }, usage };
    },
  });
}
