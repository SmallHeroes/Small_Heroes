/**
 * Generate and upload the three stable wizard narration previews.
 *
 * Run with production credentials:
 *   npx tsx scripts/generate-voice-previews.ts
 *
 * Required: ELEVENLABS_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { existsSync, readFileSync } from 'fs';
import path from 'path';

import { VOICES } from '../backend/config/voices';
import { callElevenLabs } from '../backend/providers/audio';
import { uploadToSupabaseWithRetry } from '../lib/image-storage';

const PREVIEW_LINE = 'הָיֹה הָיָה יֶלֶד קָטָן וְאַמִּיץ, וְהַיּוֹם מַתְחִיל סִפּוּר חָדָשׁ.';
const PRODUCTION_SUPABASE_HOST = 'ozxjmnzybzetqudivlbw.supabase.co';

function loadLocalEnv(): void {
  for (const name of ['.env.local', '.env']) {
    const file = path.join(process.cwd(), name);
    if (!existsSync(file)) continue;
    for (const raw of readFileSync(file, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

async function main(): Promise<void> {
  loadLocalEnv();
  for (const required of ['ELEVENLABS_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!process.env[required]) throw new Error(`${required} not set`);
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'book-images';
  const baseUrl = process.env.SUPABASE_URL!.replace(/\/$/, '');
  const host = new URL(baseUrl).host;
  if (host !== PRODUCTION_SUPABASE_HOST) {
    throw new Error(
      `Refusing to upload production voice previews to ${host}; expected ${PRODUCTION_SUPABASE_HOST}`,
    );
  }

  for (const voice of VOICES) {
    const audio = await callElevenLabs(PREVIEW_LINE, voice.elevenlabsVoiceId, {
      stability: voice.stability ?? 0.75,
      similarity_boost: voice.similarityBoost ?? 0.8,
    });
    const key = `voice-previews/${voice.id}.mp3`;
    await uploadToSupabaseWithRetry({
      bucket,
      key,
      body: audio,
      contentType: 'audio/mpeg',
      errorPrefix: `Voice preview upload failed (${voice.id})`,
    });
    console.log(`${voice.id}: ${baseUrl}/storage/v1/object/public/${bucket}/${key}`);
  }
}

main().catch((error) => {
  console.error('[generate-voice-previews] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
