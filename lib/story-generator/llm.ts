const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

export interface LLMCallOptions {
  stage: string;
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens?: number;
  jsonMode?: boolean;
  temperature?: number;
}

export interface LLMCallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  model: string;
  modelVersion: string;
  costUsd: number;
}

export interface StoryGeneratorLLM {
  call(options: LLMCallOptions): Promise<LLMCallResult>;
}

function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  // MVP rough estimate for gpt-5-chat-latest tier (adjust when pricing is formalized)
  const isPro = model.includes('pro');
  const inRate = isPro ? 0.00001 : 0.000003;
  const outRate = isPro ? 0.00003 : 0.000012;
  return inputTokens * inRate + outputTokens * outRate;
}

function extractOutputText(data: Record<string, unknown>): string {
  if (typeof data.output_text === 'string') return data.output_text;
  const output = data.output;
  if (!Array.isArray(output)) return '';
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const row = item as { type?: string; content?: Array<{ type?: string; text?: string }> };
    if (row.type !== 'message' || !Array.isArray(row.content)) continue;
    for (const part of row.content) {
      if (part?.type === 'output_text' && typeof part.text === 'string') return part.text;
    }
  }
  return '';
}

export class OpenAIResponsesLLM implements StoryGeneratorLLM {
  private readonly model: string;

  constructor(model = process.env.GENERATOR_LLM_MODEL?.trim() || 'gpt-5-chat-latest') {
    this.model = model;
  }

  async call(options: LLMCallOptions): Promise<LLMCallResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not set');
    }

    const body: Record<string, unknown> = {
      model: this.model,
      max_output_tokens: options.maxOutputTokens ?? 4096,
      input: [
        { role: 'system', content: options.systemPrompt },
        { role: 'user', content: options.userPrompt },
      ],
    };
    if (options.jsonMode) {
      body.text = { format: { type: 'json_object' } };
    }

    const res = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`[${options.stage}] OpenAI Responses ${res.status}: ${errText.slice(0, 400)}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    const text = extractOutputText(data);
    const usage = (data.usage ?? {}) as Record<string, number>;
    const inputTokens = usage.input_tokens ?? usage.prompt_tokens ?? 0;
    const outputTokens = usage.output_tokens ?? usage.completion_tokens ?? 0;
    const totalTokens = usage.total_tokens ?? inputTokens + outputTokens;
    const modelVersion = typeof data.model === 'string' ? data.model : this.model;

    return {
      text,
      inputTokens,
      outputTokens,
      totalTokens,
      model: this.model,
      modelVersion,
      costUsd: estimateCostUsd(this.model, inputTokens, outputTokens),
    };
  }
}

let defaultLlm: StoryGeneratorLLM | null = null;

export function getDefaultLLM(): StoryGeneratorLLM {
  if (!defaultLlm) defaultLlm = new OpenAIResponsesLLM();
  return defaultLlm;
}

export function setDefaultLLM(llm: StoryGeneratorLLM): void {
  defaultLlm = llm;
}

export function parseJsonFromLLM<T>(raw: string, stage: string): T {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  if (!cleaned) throw new Error(`[${stage}] Empty JSON response`);
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    throw new Error(`[${stage}] Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
}
