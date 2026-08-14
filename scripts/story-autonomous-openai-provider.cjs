const { MODEL, SERVICE_TIER } = require('./story-autonomous-batch-core.cjs');

function sanitizeProviderFailure(error) {
  if (error?.name === 'AbortError') return new Error('story_provider_timeout');
  if (error instanceof TypeError) return new Error('story_provider_transport_failure');
  return new Error('story_provider_unclassified_failure');
}

function extractText(response) {
  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text;
  }
  const pieces = [];
  for (const output of Array.isArray(response.output) ? response.output : []) {
    if (output?.type !== 'message') continue;
    for (const content of Array.isArray(output.content) ? output.content : []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') pieces.push(content.text);
    }
  }
  if (pieces.length === 0) throw new Error('story_provider_output_missing');
  return pieces.join('');
}

function normalizeUsage(usage) {
  const details = usage?.input_tokens_details || {};
  const outputDetails = usage?.output_tokens_details || {};
  return {
    inputTokens: Number(usage?.input_tokens || 0),
    cachedInputTokens: Number(details.cached_tokens || 0),
    cacheWriteTokens: Number(details.cache_write_tokens || details.cache_creation_tokens || 0),
    outputTokens: Number(usage?.output_tokens || 0),
    reasoningTokens: Number(outputDetails.reasoning_tokens || 0),
    totalTokens: Number(usage?.total_tokens || 0),
  };
}

function incompleteReason(payload) {
  if (payload?.incomplete_details?.reason === 'max_output_tokens') return 'story_provider_max_output_tokens';
  if (payload?.incomplete_details?.reason === 'content_filter') return 'story_provider_content_filtered';
  return 'story_provider_response_incomplete';
}

function createOpenAiStoryProvider({ apiKey, timeoutMs = 600_000, fetchImpl = fetch } = {}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('story_provider_api_key_missing');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000) throw new Error('story_provider_timeout_invalid');
  return {
    async complete(request) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const body = {
        model: MODEL,
        service_tier: SERVICE_TIER,
        store: false,
        truncation: 'disabled',
        max_output_tokens: request.maxOutputTokens,
        reasoning: { effort: request.reasoningEffort },
        input: [
          { role: 'developer', content: [{ type: 'input_text', text: request.systemPrompt }] },
          { role: 'user', content: [{ type: 'input_text', text: request.userPrompt }] },
        ],
        text: request.schema
          ? {
              format: {
                type: 'json_schema',
                name: request.schemaName,
                strict: true,
                schema: request.schema,
              },
            }
          : { format: { type: 'text' } },
      };
      try {
        const response = await fetchImpl('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`story_provider_http_${response.status}`);
        let payload;
        try { payload = await response.json(); } catch { throw new Error('story_provider_response_json_invalid'); }
        if (payload?.error || !['completed', 'incomplete'].includes(payload?.status)) {
          throw new Error('story_provider_response_incomplete');
        }
        if (payload.status === 'incomplete') {
          return {
            completed: false,
            terminalReason: incompleteReason(payload),
            model: payload.model,
            serviceTier: payload.service_tier,
            usage: normalizeUsage(payload.usage),
          };
        }
        return {
          completed: true,
          terminalReason: null,
          text: extractText(payload),
          model: payload.model,
          serviceTier: payload.service_tier,
          usage: normalizeUsage(payload.usage),
        };
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('story_provider_')) throw error;
        throw sanitizeProviderFailure(error);
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

module.exports = { createOpenAiStoryProvider, extractText, incompleteReason, normalizeUsage, sanitizeProviderFailure };
