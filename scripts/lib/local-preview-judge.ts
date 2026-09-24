import fs from 'node:fs';
import OpenAI from 'openai';
import sharp from 'sharp';
import { zodTextFormat } from 'openai/helpers/zod';
import { previewCheckpoint, previewImageDigest, previewSha } from '../../lib/local-story-preview';
import { ANATOMY_INSPECTION_INSTRUCTION, anatomyInspectionSchema, PREVIEW_JUDGE_MODEL, PREVIEW_JUDGE_EFFORT, PREVIEW_JUDGE_INSTRUCTION, PREVIEW_QUALITY_VERSION, previewQualityReviewSchema } from '../../lib/local-preview-quality';
import { priorityQualityReviewSchema, previewQualityVersion, previewQualityContextSha, qualityDisposition } from '../../lib/local-preview-quality';
import { visualPriorityPrompt, VISUAL_PRIORITY_INSTRUCTION, type VisualPriorityPolicy } from '../../lib/local-visual-priority';

// Transport identity is deliberately separate from quality/calibration and prompt content.
const transport = Object.freeze({ version: 'preview-judge-flex/v1', serviceTier: 'flex' as const, timeoutMs: 900_000, maxRetries: 0 });
function responseEvidence(response: OpenAI.Responses.Response) {
  return { status: response.status, text: response.output_text, requestedServiceTier: transport.serviceTier,
    serviceTier: response.service_tier ?? null, model: response.model, responseId: response.id,
    incompleteDetails: response.incomplete_details ?? null };
}
function requireFlex(value: { serviceTier: unknown }) {
  if (value.serviceTier !== transport.serviceTier) throw Error('preview_judge_service_tier_mismatch');
}

export async function judgePreviewCandidate(args: {
  root: string; step: string; budgetUsd: number; apiKey: string;
  candidatePath: string; candidateSha: string; contextSha: string; context: unknown;
  references: { role: string; file: string; sha: string }[];
  policy?: VisualPriorityPolicy;
  permit?: () => void;
}) {
  // Validate policy and its context binding BEFORE even the blind paid inspection.
  const instruction = PREVIEW_JUDGE_INSTRUCTION + (args.policy ? '\n\n' + VISUAL_PRIORITY_INSTRUCTION + visualPriorityPrompt(args.policy) : '');
  if (args.policy && previewQualityContextSha(args.context, args.policy) !== args.contextSha) throw Error('quality_evidence_binding');
  if (previewImageDigest(args.candidatePath) !== args.candidateSha) throw Error('judge_candidate_changed');
  const candidateBytes = fs.readFileSync(args.candidatePath);
  if (previewSha(candidateBytes) !== args.candidateSha) throw Error('judge_candidate_changed');
  const snapshots = args.references.map(ref => {
    const bytes = fs.readFileSync(ref.file);
    if (previewSha(bytes) !== ref.sha) throw Error('judge_reference_changed');
    return { ...ref, bytes };
  });
  const image = (bytes: Buffer): OpenAI.Responses.ResponseInputImage => ({ type: 'input_image',
    image_url: `data:image/png;base64,${bytes.toString('base64')}`, detail: 'high' });
  const candidateContent: OpenAI.Responses.ResponseInputContent[] = [{ type: 'input_text', text: 'COMPLETE CANDIDATE' }, image(candidateBytes)];
  const meta = await sharp(candidateBytes).metadata();
  if (!meta.width || !meta.height) throw Error('judge_image_dimensions');
  const width = Math.ceil(meta.width * 0.65), height = Math.ceil(meta.height * 0.6);
  for (const [label, left, top] of [
    ['top-left', 0, 0], ['top-right', meta.width - width, 0],
    ['bottom-left', 0, meta.height - height], ['bottom-right', meta.width - width, meta.height - height],
  ] as const) {
    const crop = await sharp(candidateBytes).extract({ left, top, width, height }).png().toBuffer();
    candidateContent.push({ type: 'input_text', text: `DETAIL ${label}, same candidate pixels` },
      { type: 'input_image', image_url: `data:image/png;base64,${crop.toString('base64')}`, detail: 'high' });
  }
  const anatomyRecord = await previewCheckpoint({ root: args.root, step: `${args.step}-anatomy`,
    input: { version: PREVIEW_QUALITY_VERSION, instruction: ANATOMY_INSPECTION_INSTRUCTION, candidateSha: args.candidateSha, model: PREVIEW_JUDGE_MODEL, effort: PREVIEW_JUDGE_EFFORT, maxOutputTokens: 10000, transport },
    reserveUsd: 0.5, budgetUsd: args.budgetUsd, produce: async () => {
      args.permit?.();
      const client = new OpenAI({ apiKey: args.apiKey, baseURL: 'https://api.openai.com/v1', maxRetries: transport.maxRetries, timeout: transport.timeoutMs });
      const response = await client.responses.create({ model: PREVIEW_JUDGE_MODEL, service_tier: transport.serviceTier, store: false, instructions: ANATOMY_INSPECTION_INSTRUCTION,
        input: [{ role: 'user', content: candidateContent }], reasoning: { effort: PREVIEW_JUDGE_EFFORT }, max_output_tokens: 10000,
        text: { format: zodTextFormat(anatomyInspectionSchema, 'anatomy_inspection') } });
      return { value: responseEvidence(response), usage: response.usage as unknown as Record<string, unknown> };
    } });
  // Validate after persistence, so even wrong-tier/incomplete paid results remain accounted.
  requireFlex(anatomyRecord.value);
  if (anatomyRecord.value.status !== 'completed') throw Error('preview_anatomy_inspection_incomplete');
  const anatomy = anatomyInspectionSchema.parse(JSON.parse(anatomyRecord.value.text));
  if (anatomy.verdict === 'defect' && !anatomy.correction.trim()) throw Error('anatomy_missing_correction');
  const input = { version: previewQualityVersion(args.policy), instruction, anatomy,
    candidateSha: args.candidateSha, contextSha: args.contextSha, context: args.context,
    references: args.references.map(({ role, sha }) => ({ role, sha })), model: PREVIEW_JUDGE_MODEL, effort: PREVIEW_JUDGE_EFFORT, maxOutputTokens: 4500 };
  if (JSON.stringify(input).length > 50000 || args.references.length > 6) throw Error('preview_judge_input_limit');
  const record = await previewCheckpoint({ root: args.root, step: args.step, input: { ...input, transport },
    reserveUsd: 1, budgetUsd: args.budgetUsd, produce: async () => {
      args.permit?.();
      const content: OpenAI.Responses.ResponseInputContent[] = [{ type: 'input_text', text: JSON.stringify(input) }];
      for (const ref of snapshots) {
        content.push({ type: 'input_text', text: `REFERENCE ONLY: ${ref.role}` }, image(ref.bytes));
      }
      content.push(...candidateContent);
      // Explicit official origin, no retries, one request per checkpoint.
      const client = new OpenAI({ apiKey: args.apiKey, baseURL: 'https://api.openai.com/v1', maxRetries: transport.maxRetries, timeout: transport.timeoutMs });
      const response = await client.responses.create({ model: PREVIEW_JUDGE_MODEL, service_tier: transport.serviceTier, store: false,
        instructions: instruction, input: [{ role: 'user', content }],
        reasoning: { effort: PREVIEW_JUDGE_EFFORT }, max_output_tokens: 4500,
        text: { format: args.policy ? zodTextFormat(priorityQualityReviewSchema, 'preview_priority_quality') : zodTextFormat(previewQualityReviewSchema, 'preview_quality') } });
      return { value: responseEvidence(response), usage: response.usage as unknown as Record<string, unknown> };
    } });
  requireFlex(record.value);
  if (record.value.status !== 'completed') throw Error('preview_judge_incomplete');
  const review = args.policy ? qualityDisposition(JSON.parse(record.value.text), args.candidateSha, args.contextSha, args.policy).review
    : previewQualityReviewSchema.parse(JSON.parse(record.value.text));
  // A contextual reviewer cannot erase a blind anatomy defect/uncertainty. Preserve both raw records.
  if (anatomy.verdict !== 'pass') {
    const check = review.checks.find(c => c.category === 'anatomy');
    if (!check) throw Error('quality_category_coverage');
    check.verdict = anatomy.verdict; check.observation = anatomy.observation; check.correction = anatomy.correction;
  }
  return review;
}
