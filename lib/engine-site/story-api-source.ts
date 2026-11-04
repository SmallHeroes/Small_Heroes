import 'server-only';
import { createHash } from 'crypto';
import { z } from 'zod';
import type { EngineOrderAuthority } from './contract';
import { planAnthropicAuthor, anthropicAuthorCost } from './anthropic-author';
import type { EngineProviderResult } from './durable-worker';
import { canonicalJson } from '@/lib/personal-wizard/request-acceptance';
import type { PersonalWizardOptions } from '@/lib/personal-wizard/options';
import { simpleAuthorCall, simpleEditorCall, writeSimpleStory, prepareSimpleStory } from '@/lib/personal-wizard/simple-story-engine';
import { admitCurrentSimpleStorySource, ANTHROPIC_SIMPLE_SOURCE_VERSION, projectSimpleSolReceipt } from '@/lib/personal-wizard/simple-story-source';
import { SIMPLE_CHILD_MOMENTUM_EXPERIENCE } from '@/lib/personal-wizard/simple-story-experience';
import { engineResponseText } from './provider-plans';
import type { SimpleStoryCall } from '@/lib/personal-wizard/simple-story-engine';
import type { CausalDispatch } from '@/lib/personal-wizard/story-causal-experiment-runner';

const hash = (v: unknown) => createHash('sha256').update(canonicalJson(v)).digest('hex');
export function simpleAnthropicDispatch(call: SimpleStoryCall, orderId: string): CausalDispatch {
  return { ...call, role: 'opus', conversationKey: `${orderId}:story_${call.stage}` };
}
export function projectEngineStoryApiReceipt(authority: EngineOrderAuthority, call: SimpleStoryCall, answer: EngineProviderResult) {
  const plan = planAnthropicAuthor(authority, `story_${call.stage}`, simpleAnthropicDispatch(call, authority.orderId));
  const raw = z.object({ id: z.string().regex(/^msg_[A-Za-z0-9_-]+$/), type: z.literal('message'),
    model: z.literal('claude-opus-5-5'), stop_reason: z.literal('end_turn'),
    content: z.array(z.object({ type: z.string(), text: z.string().optional() }).passthrough()),
    usage: z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative() }).passthrough(),
  }).passthrough().parse(answer.raw);
  const texts = raw.content.filter(b => b.type === 'text');
  const cost = anthropicAuthorCost(raw);
  if (texts.length !== 1 || typeof texts[0].text !== 'string' || cost === null || cost !== answer.estimatedMicroUsd ||
      cost > plan.call.maximumMicroUsd || raw.usage.output_tokens > call.maxOutputTokens ||
      hash(plan.decode(JSON.parse(texts[0].text))) !== hash(answer.output)) throw Error('engine_story_api_receipt_invalid');
  return { version: 'simple-anthropic-api-receipt-projection/v1' as const, stage: call.stage,
    callDigest: hash({ i: call.instructions, x: call.input }), outputDigest: hash(answer.output),
    recordDigest: hash(answer), sessionId: raw.id, model: raw.model,
    completed: true as const, terminationConfirmed: true as const, estimatedMicroUsd: cost,
    usage: { inputTokens: raw.usage.input_tokens, outputTokens: raw.usage.output_tokens },
    costKind: 'anthropic_api_usage_estimate_not_invoice' as const, wireSha256: plan.call.wireSha256, rawSha256: hash(raw) };
}
/** Rebuild through the exact existing source/compiler admission; API records never pretend to be CLI stdout. */
export function createEngineStoryApiSource(authority: EngineOrderAuthority, request: unknown,
  options: PersonalWizardOptions, seed: string, generated: Awaited<ReturnType<typeof writeSimpleStory>>,
  records: Record<'author' | 'editor', EngineProviderResult>) {
  const prepared = prepareSimpleStory(request, options, seed, SIMPLE_CHILD_MOMENTUM_EXPERIENCE);
  const author = simpleAuthorCall(prepared);
  const editor = simpleEditorCall(prepared, generated.evidence.draft, generated.evidence.findings);
  return admitCurrentSimpleStorySource(request, { ...generated.result, simpleSource: {
    version: ANTHROPIC_SIMPLE_SOURCE_VERSION, evidence: generated.evidence,
    author: projectEngineStoryApiReceipt(authority, author, records.author),
    editor: projectSimpleSolReceipt(editor, { stage: 'editor', ...records.editor,
      raw: { ...(records.editor.raw as object), output_text: engineResponseText(records.editor.raw) },
      metadata: { reportedModel: 'gpt-6.1-sol', serviceTier: 'default', responseId: (records.editor.raw as { id: string }).id,
        status: 'completed', kind: 'provider_reported_usage_estimate_not_invoice' } }),
  } }, options);
}
