import 'server-only';

import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { personalStoryPlanSchema, personalManuscriptSchema } from './story-contract';
import { STORY_LIMITS, personalStoryOutputLimits, generationTimeoutMs, type StoryModel } from './story-config';
import { StoryWriterError, type StoryProvider } from './story-writer';
import { adventureSelectionSchema } from './story-planning-contract';

export function personalProviderSchema(stage: 'plan' | 'manuscript', context: { brief: { beats: number; requestId: string; resilienceMode: 'chosen_topic' | 'adventure_only' }; planDigest?: string }) {
  const { beats, requestId, resilienceMode } = context.brief;
  if (![8, 12, 16].includes(beats) || !requestId) throw new StoryWriterError('story_provider_context');
  if (stage === 'manuscript' && !/^[a-f0-9]{64}$/.test(context.planDigest ?? '')) throw new StoryWriterError('story_provider_context');
  // Array order is the narrative order. Page numbers are deterministic engine metadata,
  // not model-authored facts. The paid r2 evidence showed duplicate/missing numbers even
  // inside an exact-length constrained array; do not spend another call repairing numbering.
  const check = adventureSelectionSchema.shape.outlineChecks.shape.causal_child_choices.extend({
    evidenceSpreads: z.array(z.number().int().min(1).max(beats)).min(1).max(3),
  });
  // The ending check must cite the actual final spread, not only its setup.
  // Single final anchor keeps the strict SDK schema simple; earlier support can
  // remain in the note. This is reference binding, never literary acceptance.
  const selection = adventureSelectionSchema.extend({ outlineChecks: z.object({
    curiosity_and_stakes: check, causal_child_choices: check,
    earned_payoff: check.extend({ evidenceSpreads: z.array(z.literal(beats)).length(1) }),
  }).strict() });
  return stage === 'plan'
    ? personalStoryPlanSchema.extend({ requestId: z.literal(requestId), adventureSelection: selection,
      resilience: personalStoryPlanSchema.shape.resilience.extend({ mode: z.literal(resilienceMode), moments: z.array(personalStoryPlanSchema.shape.resilience.shape.moments.element.extend({ pageNumber: z.number().int().min(1).max(beats) })).min(1).max(4) }),
      beats: z.array(personalStoryPlanSchema.shape.beats.element.omit({ pageNumber: true })).length(beats) })
    : personalManuscriptSchema.extend({ requestId: z.literal(requestId), planDigest: z.literal(context.planDigest!), pages: z.array(personalManuscriptSchema.shape.pages.element.omit({ pageNumber: true })).length(beats) });
}

export function decodePersonalProviderOutput(stage: 'plan' | 'manuscript', context: Parameters<typeof personalProviderSchema>[1], raw: unknown) {
  const parsed = personalProviderSchema(stage, context).safeParse(raw);
  if (!parsed.success) throw new StoryWriterError('story_provider_schema');
  const output = parsed.data;
  return 'beats' in output
    ? { ...output, beats: output.beats.map((beat, index) => ({ ...beat, pageNumber: index + 1 })) }
    : { ...output, pages: output.pages.map((page, index) => ({ ...page, pageNumber: index + 1 })) };
}

export function createPersonalStoryProvider(apiKey: string, model: StoryModel): StoryProvider {
  const client = new OpenAI({ apiKey, maxRetries: 0 });
  return {
    async generate(call, signal) {
      const context = JSON.parse(call.input);
      const limits = personalStoryOutputLimits(context.brief.beats);
      const cap = call.stage === 'plan' ? limits.planOutputTokens : limits.manuscriptOutputTokens;
      if (call.maxOutputTokens !== cap) throw new StoryWriterError('story_output_limit');
      const schema = personalProviderSchema(call.stage, context);
      const format = zodTextFormat(schema, `personal_story_${call.stage}`);
      // Reservation includes everything we explicitly send, including schema/instructions.
      const payload = {
        model, store: false, service_tier: 'default' as const,
        reasoning: { effort: 'medium' as const },
        instructions: call.instructions,
        input: call.input, max_output_tokens: call.maxOutputTokens,
        text: { format },
      };
      if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > STORY_LIMITS.inputBytesPerCall) throw new StoryWriterError('story_input_limit');
      const response = await client.responses.create(payload, { signal, timeout: generationTimeoutMs(cap) });
      const usage = response.usage ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens } : null;
      try {
        if (response.status !== 'completed' || !response.output_text) throw new StoryWriterError('story_provider_incomplete');
        let output: unknown;
        try { output = JSON.parse(response.output_text); }
        catch { throw new StoryWriterError('story_provider_malformed'); }
        return { output: decodePersonalProviderOutput(call.stage, context, output), usage };
      } catch (error) {
        // A schema/refusal failure can still be billed. Preserve measured usage, never raw prose.
        if (error instanceof StoryWriterError) error.providerUsage = usage;
        throw error;
      }
    },
  };
}
