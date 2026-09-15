import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { previewCheckpoint, previewSha } from '../../lib/local-story-preview';
import { PREVIEW_JUDGE_MODEL, PREVIEW_JUDGE_EFFORT } from '../../lib/local-preview-quality';
import { CHILD_LOCALIZATION_INSTRUCTION, LOCALIZED_ANATOMY_INSTRUCTION, LOCAL_ANATOMY_VERSION,
  LOCAL_ANATOMY_INVENTORY_VERSION, INVENTORY_ANATOMY_INSTRUCTION, inventoryAnatomySchema, inventoryAnatomyDisposition,
  LOCAL_ANATOMY_GROUNDED_VERSION, GROUNDED_INVENTORY_INSTRUCTION, validateAnatomyRegionGrounding,
  childLocalizationSchema, localizedAnatomySchema, localizedAnatomyDisposition, localizedCropRect } from '../../lib/local-anatomy-experiment';

export async function inspectLocalizedAnatomy(args: { root: string; step: string; budgetUsd: number; apiKey: string;
  candidatePath: string; candidateSha: string; anchorPath: string; anchorSha: string; inspectionMode?: 'inventory' | 'grounded_inventory'; model?: 'gpt-5.6-sol' }) {
  if (!/^[a-z][a-z0-9-]{0,35}$/.test(args.step)) throw Error('invalid_anatomy_step');
  if (args.model !== undefined && args.model !== 'gpt-5.6-sol') throw Error('invalid_anatomy_model');
  const model = args.model ?? PREVIEW_JUDGE_MODEL;
  const bytes = fs.readFileSync(args.candidatePath), anchor = fs.readFileSync(args.anchorPath);
  if (previewSha(bytes) !== args.candidateSha || previewSha(anchor) !== args.anchorSha) throw Error('anatomy_image_binding');
  const meta = await sharp(bytes).metadata();
  if (meta.format !== 'png' || !meta.width || !meta.height) throw Error('anatomy_image_dimensions');
  const image = (b: Buffer): OpenAI.Responses.ResponseInputImage => ({ type: 'input_image', image_url: `data:image/png;base64,${b.toString('base64')}`, detail: 'high' });
  const grounded = args.inspectionMode === 'grounded_inventory', inventory = Boolean(args.inspectionMode);
  const instruction = grounded ? GROUNDED_INVENTORY_INSTRUCTION : inventory ? INVENTORY_ANATOMY_INSTRUCTION : LOCALIZED_ANATOMY_INSTRUCTION;
  const policy = { version: grounded ? LOCAL_ANATOMY_GROUNDED_VERSION : inventory ? LOCAL_ANATOMY_INVENTORY_VERSION : LOCAL_ANATOMY_VERSION, model, effort: PREVIEW_JUDGE_EFFORT, candidateSha: args.candidateSha };
  const client = new OpenAI({ apiKey: args.apiKey, baseURL: 'https://api.openai.com/v1', maxRetries: 0, timeout: 180_000 });
  const locateRecord = await previewCheckpoint({ root: args.root, step: `${args.step}-locate`, budgetUsd: args.budgetUsd, reserveUsd: 0.3,
    input: { ...policy, instruction: CHILD_LOCALIZATION_INSTRUCTION, anchorSha: args.anchorSha, maxOutputTokens: 2500 },
    produce: async () => {
      const response = await client.responses.create({ model, store: false, reasoning: { effort: PREVIEW_JUDGE_EFFORT }, max_output_tokens: 2500,
        instructions: CHILD_LOCALIZATION_INSTRUCTION, text: { format: zodTextFormat(childLocalizationSchema, 'child_localization') },
        input: [{ role: 'user', content: [{ type: 'input_text', text: 'REFERENCE CHILD' }, image(anchor), { type: 'input_text', text: 'FULL ILLUSTRATION TO LOCATE IN' }, image(bytes)] }] });
      return { value: { status: response.status, text: response.output_text, model: response.model, responseId: response.id }, usage: response.usage as unknown as Record<string, unknown> };
    } });
  if (locateRecord.value.status !== 'completed') throw Error('anatomy_localization_incomplete');
  const location = childLocalizationSchema.parse(JSON.parse(locateRecord.value.text));
  if ((location.status === 'located') !== (location.box !== null)) throw Error('anatomy_localization_conflict');
  if (location.status !== 'located') return { status: 'held_localization' as const, location, renderAuthorized: false as const };
  const rect = localizedCropRect(location.box, meta.width, meta.height);
  const crop = await sharp(bytes).extract(rect).png().toBuffer(), cropSha = previewSha(crop);
  const cropFile = path.join(args.root, `${args.step}-child.png`);
  if (!fs.existsSync(cropFile)) fs.writeFileSync(cropFile, crop, { flag: 'wx' });
  if (previewSha(fs.readFileSync(cropFile)) !== cropSha) throw Error('anatomy_crop_changed');
  const height = Math.ceil(rect.height * 0.65);
  const upper = await sharp(crop).extract({ left: 0, top: 0, width: rect.width, height }).png().toBuffer();
  const lower = await sharp(crop).extract({ left: 0, top: rect.height - height, width: rect.width, height }).png().toBuffer();
  const input = { ...policy, instruction, rect, cropSha,
    upperSha: previewSha(upper), lowerSha: previewSha(lower), imageWidth: meta.width, imageHeight: meta.height, maxOutputTokens: 6000 };
  const judgeRecord = await previewCheckpoint({ root: args.root, step: `${args.step}-inspect`, budgetUsd: args.budgetUsd, reserveUsd: 0.5, input,
    produce: async () => {
      const response = await client.responses.create({ model, store: false, reasoning: { effort: PREVIEW_JUDGE_EFFORT }, max_output_tokens: 6000,
        instructions: instruction, text: { format: inventory ? zodTextFormat(inventoryAnatomySchema, 'inventory_anatomy') : zodTextFormat(localizedAnatomySchema, 'localized_anatomy') },
        input: [{ role: 'user', content: [{ type: 'input_text', text: JSON.stringify({ imageWidth: meta.width, imageHeight: meta.height, cropRect: rect }) },
          { type: 'input_text', text: 'FULL ILLUSTRATION' }, image(bytes), { type: 'input_text', text: 'TARGET CHILD CROP' }, image(crop),
          { type: 'input_text', text: 'UPPER DETAIL: same crop pixels' }, image(upper), { type: 'input_text', text: 'LOWER DETAIL: same crop pixels' }, image(lower)] }] });
      return { value: { status: response.status, text: response.output_text, model: response.model, responseId: response.id }, usage: response.usage as unknown as Record<string, unknown> };
    } });
  if (judgeRecord.value.status !== 'completed') throw Error('localized_anatomy_incomplete');
  const decoded = JSON.parse(judgeRecord.value.text);
  if (grounded) validateAnatomyRegionGrounding(decoded, rect, meta.width, meta.height);
  return { status: 'inspected' as const, location, rect, cropSha, ...(inventory ? inventoryAnatomyDisposition(decoded) : localizedAnatomyDisposition(decoded)) };
}
