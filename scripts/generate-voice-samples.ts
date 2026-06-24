/**
 * Task #38 — generate a short voice sample MP3 for each wizard voice.
 *
 * For every voice in backend/config/voices.ts, synthesize the SAME sentence (ElevenLabs
 * eleven_v3, Hebrew) using that voice's configured elevenlabsVoiceId + the preview settings
 * (stability + similarity_boost, matching generateVoicePreview), and write it to
 *   public/voice-samples/{elevenlabsVoiceId}.mp3
 * — the path the wizard's ▶ preview buttons expect.
 *
 * Run (needs ELEVENLABS_API_KEY in the environment):
 *   set -a; . /tmp/vg.env; set +a; npx tsx scripts/generate-voice-samples.ts
 *
 * Override the sentence with VOICE_SAMPLE_SENTENCE.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

import { VOICES } from '../backend/config/voices';
import { callElevenLabs } from '../backend/providers/audio';

const DEFAULT_SENTENCE = 'שלום! אני אקריא לך את הסיפור.';
const SENTENCE = (process.env.VOICE_SAMPLE_SENTENCE || DEFAULT_SENTENCE).trim();

/** Minimal .env loader (no dep): a standalone tsx script does not auto-load Next.js env files. */
function loadLocalEnv(): void {
  if (process.env.ELEVENLABS_API_KEY) return;
  for (const name of ['.env.local', '.env']) {
    const file = path.join(process.cwd(), name);
    if (!existsSync(file)) continue;
    for (const raw of readFileSync(file, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  }
}

async function main(): Promise<void> {
  loadLocalEnv();
  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error(
      'ELEVENLABS_API_KEY not set — add it to .env.local (gitignored) or export it, then re-run.'
    );
  }
  const outDir = path.join(process.cwd(), 'public', 'voice-samples');
  mkdirSync(outDir, { recursive: true });

  console.log(`Generating ${VOICES.length} voice samples → public/voice-samples/`);
  console.log(`Sentence: "${SENTENCE}"`);

  for (const v of VOICES) {
    const buf = await callElevenLabs(SENTENCE, v.elevenlabsVoiceId, {
      stability: v.stability ?? 0.75,
      similarity_boost: v.similarityBoost ?? 0.8,
    });
    const file = path.join(outDir, `${v.elevenlabsVoiceId}.mp3`);
    writeFileSync(file, buf);
    console.log(`✓ ${v.label} (${v.id}) → ${v.elevenlabsVoiceId}.mp3  ${(buf.length / 1024).toFixed(1)} KB`);
  }

  console.log('Done.');
}

main().catch((e) => {
  console.error('[generate-voice-samples] failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
