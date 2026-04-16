/**
 * Audio Provider — ElevenLabs TTS Integration
 * Generates narration audio for the full book.
 * Supports voice selection + sleep mode pacing.
 */

import { getVoiceById, SLEEP_MODE_OVERRIDES } from '../config/voices';

// ─── Types ────────────────────────────────────────────
export interface AudioInput {
  narrationScript: string; // full narration text (all pages concatenated)
  voiceId: string;         // our internal voice ID (e.g. 'mom')
  sleepMode: boolean;
  orderId: string;
}

export interface GeneratedAudio {
  url: string;             // stored audio URL
  durationSec?: number;
  provider: string;
  voiceId: string;
  elevenlabsVoiceId: string;
}

// ─── Narration Script Builder ─────────────────────────
export function buildNarrationScript(
  pages: { pageNumber: number; narrationText: string }[],
  sleepMode: boolean
): string {
  const sorted = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);

  return sorted
    .map(page => {
      let text = page.narrationText;
      if (sleepMode) {
        // Add pauses between sentences for sleep mode
        text = text.replace(/\./g, '...... ').replace(/,/g, ', ');
      }
      return text;
    })
    .join(sleepMode ? '\n\n...... \n\n' : '\n\n');
}

// ─── ElevenLabs API ───────────────────────────────────
async function callElevenLabs(
  text: string,
  elevenlabsVoiceId: string,
  settings: {
    stability: number;
    similarity_boost: number;
    style?: number;
    use_speaker_boost?: boolean;
  }
): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not set');

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${elevenlabsVoiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2', // Supports Hebrew
        voice_settings: {
          stability: settings.stability,
          similarity_boost: settings.similarity_boost,
          style: settings.style ?? 0,
          use_speaker_boost: settings.use_speaker_boost ?? true,
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs TTS error: ${res.status} ${err}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── Store Audio ──────────────────────────────────────
async function storeAudio(buffer: Buffer, filename: string): Promise<string> {
  // TODO: Upload to S3/Cloudflare R2/Supabase Storage
  // Example S3 implementation:
  //
  // const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
  // const s3 = new S3Client({ region: process.env.AWS_REGION });
  // await s3.send(new PutObjectCommand({
  //   Bucket: process.env.S3_BUCKET,
  //   Key: `audio/${filename}`,
  //   Body: buffer,
  //   ContentType: 'audio/mpeg',
  //   ACL: 'public-read',
  // }));
  // return `https://${process.env.S3_BUCKET}.s3.amazonaws.com/audio/${filename}`;

  // STUB: return a placeholder URL
  console.log(`[STUB] Would store audio: ${filename} (${buffer.length} bytes)`);
  return `https://your-storage.example.com/audio/${filename}`;
}

// ─── Main Entry Point ─────────────────────────────────
export async function generateAudio(input: AudioInput): Promise<GeneratedAudio> {
  const voice = getVoiceById(input.voiceId);
  if (!voice) throw new Error(`Unknown voice: ${input.voiceId}`);

  const settings = {
    stability: input.sleepMode
      ? (SLEEP_MODE_OVERRIDES.stability ?? voice.stability ?? 0.75)
      : (voice.stability ?? 0.75),
    similarity_boost: input.sleepMode
      ? (SLEEP_MODE_OVERRIDES.similarityBoost ?? voice.similarityBoost ?? 0.80)
      : (voice.similarityBoost ?? 0.80),
    style: input.sleepMode
      ? (SLEEP_MODE_OVERRIDES.style ?? 0)
      : (voice.style ?? 0),
    use_speaker_boost: voice.useSpeakerBoost ?? true,
  };

  console.log(`[Audio] Generating with voice=${voice.label}, sleepMode=${input.sleepMode}`);

  const audioBuffer = await callElevenLabs(
    input.narrationScript,
    voice.elevenlabsVoiceId,
    settings
  );

  const filename = `${input.orderId}-${voice.id}${input.sleepMode ? '-sleep' : ''}.mp3`;
  const url = await storeAudio(audioBuffer, filename);

  return {
    url,
    provider: 'elevenlabs',
    voiceId: input.voiceId,
    elevenlabsVoiceId: voice.elevenlabsVoiceId,
  };
}

// ─── Voice Preview ────────────────────────────────────
/**
 * Generate a short voice preview for the UI voice picker.
 * Called when user clicks play on a voice option.
 */
export async function generateVoicePreview(voiceId: string): Promise<Buffer> {
  const voice = getVoiceById(voiceId);
  if (!voice) throw new Error(`Unknown voice: ${voiceId}`);

  const previewText = 'שלום! אני אהיה הקריין של הסיפור המיוחד שלך.';

  return callElevenLabs(previewText, voice.elevenlabsVoiceId, {
    stability: voice.stability ?? 0.75,
    similarity_boost: voice.similarityBoost ?? 0.80,
  });
}
