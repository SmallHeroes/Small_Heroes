import 'server-only';

import OpenAI, { toFile } from 'openai';

import type { LiveIntakeConfig } from './intake-config';
import { TRANSCRIBE_CONTEXT_PROMPT } from './intake-extraction';
import type { IntakeProvider } from './intake-service';

/**
 * OpenAI adapter for live intake (the only provider SDK import in the personal Wizard).
 *
 * - `maxRetries: 0`: a failed call is reported, never silently repeated and re-billed.
 * - Extraction uses `store: false`, so no response state is kept for later retrieval. The
 *   provider's own abuse-monitoring retention still applies (see the evidence document).
 * - The `languages` hint of gpt-transcribe is deliberately not sent until a live trial proves the
 *   multipart encoding; the documented free-text `prompt` carries the Hebrew context instead.
 */
export function createOpenAiIntakeProvider(
  config: Pick<LiveIntakeConfig, 'apiKey' | 'transcribeModel' | 'extractModel'>,
): IntakeProvider {
  const client = new OpenAI({ apiKey: config.apiKey, maxRetries: 0 });
  return {
    async transcribe({ audio, container, signal }) {
      const file = await toFile(audio, container === 'audio/mp4' ? 'intake.mp4' : 'intake.webm', { type: container });
      const response = await client.audio.transcriptions.create(
        { model: config.transcribeModel, file, prompt: TRANSCRIBE_CONTEXT_PROMPT, response_format: 'json' },
        { signal },
      );
      return { text: response.text };
    },
    async extract({ instructions, userText, schema, maxOutputTokens, signal }) {
      const response = await client.responses.create(
        {
          model: config.extractModel,
          instructions,
          input: userText,
          store: false,
          reasoning: { effort: 'low' },
          max_output_tokens: maxOutputTokens,
          text: {
            format: {
              type: 'json_schema',
              name: 'personal_intake_extraction',
              schema: schema as Record<string, unknown>,
              strict: true,
            },
          },
        },
        { signal },
      );
      return { status: response.status ?? 'unknown', outputText: response.output_text ?? '' };
    },
  };
}
