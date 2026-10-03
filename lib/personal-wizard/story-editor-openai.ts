import 'server-only';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { storyEditorOutputSchema } from './story-editor-contract';
import { STORY_LIMITS, generationTimeoutMs, type StoryModel } from './story-config';
import { storyEditorOutputTokens, type StoryEditorCall, type StoryEditorProvider } from './story-editor';
import type { StoryUsage } from './story-contract';
import { semanticEditAuditSchemaForSpreads } from './story-semantic-audit';

export class StoryEditorProviderError extends Error {
  providerUsage?: StoryUsage;
  constructor(readonly code: string) { super(code); }
}
export function storyEditorProviderSchema(call: StoryEditorCall) {
  const context = JSON.parse(call.input);
  const { beats, requestId, resilienceMode } = context.brief;
  if (call.stage !== 'editor' || ![8, 12, 16].includes(beats) || !requestId ||
    !/^[a-f0-9]{64}$/.test(context.draftDigest) || !['chosen_topic', 'adventure_only'].includes(resilienceMode)) throw new StoryEditorProviderError('story_editor_provider_context');
  const plan = storyEditorOutputSchema.shape.plan;
  return storyEditorOutputSchema.extend({ requestId: z.literal(requestId), draftDigest: z.literal(context.draftDigest),
    semanticAudit: semanticEditAuditSchemaForSpreads(beats),
    plan: plan.extend({ beats: z.array(plan.shape.beats.element.omit({ pageNumber: true })).length(beats),
      resilience: plan.shape.resilience.extend({ mode: z.literal(resilienceMode),
        moments: z.array(plan.shape.resilience.shape.moments.element.extend({ pageNumber: z.number().int().min(1).max(beats) })).min(1).max(4) }) }),
    manuscript: storyEditorOutputSchema.shape.manuscript.extend({
      pages: z.array(storyEditorOutputSchema.shape.manuscript.shape.pages.element.omit({ pageNumber: true })).length(beats) }),
  });
}
export function decodeStoryEditorOutput(call: StoryEditorCall, raw: unknown) {
  const parsed = storyEditorProviderSchema(call).safeParse(raw);
  if (!parsed.success) throw new StoryEditorProviderError('story_editor_provider_schema');
  const data = parsed.data;
  return { ...data, plan: { ...data.plan, beats: data.plan.beats.map((beat, i) => ({ ...beat, pageNumber: i + 1 })) },
    manuscript: { ...data.manuscript, pages: data.manuscript.pages.map((page, i) => ({ ...page, pageNumber: i + 1 })) } };
}
export function createStoryEditorProvider(apiKey: string, model: StoryModel): StoryEditorProvider {
  const client = new OpenAI({ apiKey, maxRetries: 0 });
  return { async generate(call, signal) {
    const schema = storyEditorProviderSchema(call);
    const cap = storyEditorOutputTokens(JSON.parse(call.input).brief.beats);
    if (call.maxOutputTokens !== cap) throw new StoryEditorProviderError('story_editor_output_limit');
    const payload = { model, store: false, service_tier: 'default' as const, reasoning: { effort: 'medium' as const },
      instructions: call.instructions + '\nOrdered beat/page arrays have NO pageNumber metadata; the engine assigns positions. Resilience moments and semanticAudit citations reference narrative spread numbers.',
      input: call.input, max_output_tokens: cap, text: { format: zodTextFormat(schema, 'personal_story_editor') } };
    if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > STORY_LIMITS.inputBytesPerCall) throw new StoryEditorProviderError('story_editor_input_limit');
    const response = await client.responses.create(payload, { signal, timeout: generationTimeoutMs(cap) });
    const usage = response.usage ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens } : null;
    try {
      if (response.status !== 'completed' || !response.output_text) throw new StoryEditorProviderError('story_editor_provider_incomplete');
      let raw: unknown;
      try { raw = JSON.parse(response.output_text); } catch { throw new StoryEditorProviderError('story_editor_provider_malformed'); }
      return { output: decodeStoryEditorOutput(call, raw), usage };
    } catch (error) { if (error instanceof StoryEditorProviderError) error.providerUsage = usage; throw error; }
  } };
}
