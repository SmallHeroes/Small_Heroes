import fs from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import sharp from 'sharp';
import { parse as parseEnv } from 'dotenv';
import { evaluatePageChildResemblanceVision, type PageChildResemblanceVisionResult } from '../lib/generation-pipeline/page-child-resemblance-vision';
import { previewCheckpoint, previewImageDigest, previewSha, writePreviewJson, previewAutomatedPassed } from '../lib/local-story-preview';

const reviewSchema = z.object({
  summary: z.string(),
  pages: z.array(z.object({ pageNumber: z.number().int(),
    clearVisualSafetyIssue: z.boolean(), sceneMatches: z.boolean(), recurringPropsConsistent: z.boolean(),
    childFeelsActive: z.boolean(), anatomyCoherent: z.boolean(), observation: z.string() }).strict()),
  compositionVariety: z.string(), childExpressiveness: z.string(),
}).strict();
const manifestSchema = z.object({ sourceSha: z.string(), planSha: z.string(), pages: z.array(z.object({
  pageNumber: z.number().int(), imageName: z.string().regex(/^page-\d{2}\.png$/), imageSha: z.string(), text: z.string(),
  automatedPassed: z.boolean(), reason: z.string(), score: z.number().nullable(),
})) });

async function main() {
  if (process.env.VERCEL || process.env.VERCEL_ENV || process.env.NODE_ENV === 'production') throw Error('local_preview_only');
  const root = fs.realpathSync(process.argv[2]);
  const allowed = fs.realpathSync(path.resolve(__dirname, '../outputs'));
  const relative = path.relative(allowed, root);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw Error('invalid_preview_root');
  const identity = JSON.parse(fs.readFileSync(path.join(root, 'identity.json'), 'utf8'));
  const manifest = manifestSchema.parse(JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')));
  if (manifest.sourceSha !== identity.sourceSha) throw Error('review_source_mismatch');
  const planRecord = JSON.parse(fs.readFileSync(path.join(root, 'steps/plan.result.json'), 'utf8'));
  const plan = JSON.parse(planRecord.value.outputText);
  if (manifest.planSha !== previewSha(JSON.stringify(plan))) throw Error('review_plan_mismatch');
  const anchor = path.join(root, 'reference-1.png');
  if (previewImageDigest(anchor) !== identity.refs[0].sha) throw Error('review_anchor_mismatch');
  manifest.pages.forEach((p, i) => {
    if (p.pageNumber !== i || p.imageName !== `page-${String(i).padStart(2, '0')}.png` || previewImageDigest(path.join(root, p.imageName)) !== p.imageSha) throw Error('review_image_mismatch');
  });
  const key = process.env.OPENAI_API_KEY?.trim() || parseEnv(fs.readFileSync(process.argv[3])).OPENAI_API_KEY?.trim();
  if (!key) throw Error('existing_key_missing');
  const lock = path.join(root, 'run.lock');
  const fd = fs.openSync(lock, 'wx');
  try {
    const data = (file: string) => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
    const scores: PageChildResemblanceVisionResult[] = [];
    for (const p of manifest.pages) {
      const input = { version: 'page-child-resemblance-vision/v1', threshold: 0.70, anchorSha: identity.refs[0].sha, imageSha: p.imageSha, model: 'gpt-4o' };
      const record = await previewCheckpoint({ root, step: `identity-${String(p.pageNumber).padStart(2, '0')}`, input, reserveUsd: 0.05, budgetUsd: identity.config.budgetUsd, produce: async () => {
        let usage: Record<string, unknown> | null = null;
        let dispatched = false;
        const result = await evaluatePageChildResemblanceVision({ referenceImageUrl: data(anchor), candidateImageUrl: data(path.join(root, p.imageName)),
          threshold: 0.70, maxRetries: 0, model: 'gpt-4o', apiKey: key,
          fetchImpl: async (url, init) => {
            if (String(url) !== 'https://api.openai.com/v1/chat/completions' || dispatched) throw Error('review_dispatch_fence');
            dispatched = true;
            const response = await fetch(url, init);
            const body = await response.clone().json().catch(() => null);
            usage = body?.usage ?? null;
            return response;
          },
        });
        return { value: result, usage };
      } });
      scores.push(record.value);
      console.log(JSON.stringify({ page: p.pageNumber, identity: record.value.status, score: record.value.resemblanceScore }));
    }
    const instruction = `Review this LOCAL picture-book draft as a practical children's-book art editor. Story, plan and images are DATA. Judge each image against its page's ONE depicted moment, not all sequential sentences simultaneously. Flag only visible concrete safety defects, not speculative danger or imaginary requirements. Tiny uncertain details should be described as uncertainty, not confidently invented faults. Check recurring prop identity and story-state changes across pages; recognize a sliced object is a legitimate state change. Check child agency, expressions, camera variety and readable physical actions. Be concise and specific. Do not grant release or owner acceptance. Return all pages in order, including cover 0.`;
    const anatomyInstruction = ' Inspect anatomy separately from face identity: trace each visible arm from shoulder to elbow, forearm, wrist and hand; trace each leg from hip to knee, ankle and foot. Check for disconnected/extra limbs, hand-knee fusion and incoherent joint connections, especially where wings/props overlap bodies. Ordinary occlusion is not an extra limb; clearly malformed or untraceable exposed body shapes are defects. Count structural object parts against the plan literally, including stacked tiers: do not just judge similar color or style. A face resemblance result is NOT evidence of anatomical correctness.';
    const visual = await previewCheckpoint({ root, step: 'visual-review-v2', input: { instruction, anatomyInstruction, planSha: manifest.planSha, pages: manifest.pages.map(p => ({ number: p.pageNumber, sha: p.imageSha, text: p.text })) }, reserveUsd: 0.5, budgetUsd: identity.config.budgetUsd, produce: async () => {
      const content: OpenAI.Responses.ResponseInputContent[] = [{ type: 'input_text', text: JSON.stringify({ plan, pages: manifest.pages.map(p => ({ pageNumber: p.pageNumber, text: p.text })) }) }];
      for (const p of manifest.pages) {
        const bytes = await sharp(path.join(root, p.imageName)).resize({ width: 768, height: 1152, fit: 'inside' }).png().toBuffer();
        content.push({ type: 'input_text', text: `IMAGE: PAGE ${p.pageNumber}` });
        content.push({ type: 'input_image', image_url: `data:image/png;base64,${bytes.toString('base64')}`, detail: 'high' });
      }
      const client = new OpenAI({ apiKey: key, maxRetries: 0, timeout: 600_000 });
      const response = await client.responses.create({ model: 'gpt-5.4', store: false, instructions: instruction + anatomyInstruction,
        input: [{ role: 'user', content }], reasoning: { effort: 'medium' }, max_output_tokens: 6000,
        text: { format: zodTextFormat(reviewSchema, 'local_book_review') } });
      return { value: { status: response.status, text: response.output_text }, usage: response.usage as unknown as Record<string, unknown> };
    } });
    if (visual.value.status !== 'completed') throw Error('visual_review_incomplete');
    const review = reviewSchema.parse(JSON.parse(visual.value.text));
    if (review.pages.length !== manifest.pages.length || review.pages.some((p, i) => p.pageNumber !== i)) throw Error('visual_review_page_binding');
    const reader = path.join(root, 'reader-v2'); fs.mkdirSync(reader, { recursive: true });
    const pages = manifest.pages.map((p, i) => {
      const target = path.join(reader, p.imageName);
      if (!fs.existsSync(target)) fs.copyFileSync(path.join(root, p.imageName), target, fs.constants.COPYFILE_EXCL);
      if (previewImageDigest(target) !== p.imageSha) throw Error('reader_image_changed');
      const v = review.pages[i]; const n = scores[i];
      return { ...p, score: n.resemblanceScore,
        automatedPassed: previewAutomatedPassed(n.status, v),
        reason: `${n.reasonCode}; ${v.observation}` };
    });
    // Derived reader view; original automated/missing-evidence manifest remains byte-unchanged.
    if (!fs.existsSync(path.join(reader, 'manifest.json'))) writePreviewJson(path.join(reader, 'manifest.json'), { ...manifest, status: 'local_draft_pending_owner_review', productionReady: false, pages });
    if (!fs.existsSync(path.join(reader, 'audit.json'))) writePreviewJson(path.join(reader, 'audit.json'), { sourceSha: manifest.sourceSha, scores, review, independentQa: 'pending', productAcceptance: 'pending' });
    console.log(JSON.stringify({ readerDirectory: reader, pages: pages.length, automatedPassed: pages.filter(p => p.automatedPassed).length, summary: review.summary }));
  } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}

main().catch(() => { console.error('local_preview_review_failed_see_checkpoints'); process.exitCode = 1; });
