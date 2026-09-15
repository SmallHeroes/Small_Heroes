import fs from 'node:fs';
import path from 'node:path';
import { VOICES } from '../../backend/config/voices';
import { buildPageNarrationTtsText, resolveVoiceSettings } from '../../backend/providers/audio';
import { previewCheckpoint, previewSha } from '../../lib/local-story-preview';

export async function narratePreviewPage(args: {
  root: string; pageNumber: number; text: string; voiceId: string; apiKey: string;
  budgetUsd: number; fetchImpl?: typeof fetch;
}) {
  if (!Number.isInteger(args.pageNumber) || args.pageNumber < 0 || args.pageNumber > 24) throw Error('invalid_narration_page');
  const voice = VOICES.find(v => v.id === args.voiceId);
  if (!voice) throw Error('unknown_narration_voice');
  const text = buildPageNarrationTtsText(args.text, false);
  if (text.length > 4000) throw Error('narration_page_too_long');
  const input = { provider: 'elevenlabs', model: 'eleven_v3', voiceId: voice.elevenlabsVoiceId,
    textSha: previewSha(args.text), spokenText: text, settings: resolveVoiceSettings(voice, false) };
  const name = `page-${String(args.pageNumber).padStart(2, '0')}.mp3`;
  // Character-based provider: retain the planning reservation, never price it as OpenAI tokens.
  const record = await previewCheckpoint({ root: args.root, step: `audio-${String(args.pageNumber).padStart(2, '0')}`,
    input, reserveUsd: 0.5, budgetUsd: args.budgetUsd, produce: async () => {
      const response = await (args.fetchImpl ?? fetch)(`https://api.elevenlabs.io/v1/text-to-speech/${voice.elevenlabsVoiceId}`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(120_000),
        headers: { 'xi-api-key': args.apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: 'eleven_v3', language_code: 'he', voice_settings: input.settings }),
      });
      if (!response.ok) throw Error('narration_provider_failed');
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!(bytes.subarray(0, 3).toString('ascii') === 'ID3' || (bytes.length > 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0))) throw Error('narration_invalid_mp3');
      fs.writeFileSync(path.join(args.root, name), bytes, { flag: 'wx' });
      return { value: { fileName: name, sha: previewSha(bytes), textSha: input.textSha },
        usage: { provider: 'elevenlabs', inputCharacters: text.length, invoiceVerified: false } };
    } });
  if (record.value.fileName !== name || record.value.textSha !== input.textSha || previewSha(fs.readFileSync(path.join(args.root, name))) !== record.value.sha) throw Error('narration_artifact_changed');
  return record.value;
}
