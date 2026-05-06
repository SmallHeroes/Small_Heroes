/**
 * TEMPORARY DEBUG SCRIPT — ElevenLabs audio verification
 * Remove before production deploy.
 *
 * Run with:
 *   npx ts-node backend/debug/test-audio.ts
 *
 * What it checks:
 *   1. ELEVENLABS_API_KEY is present
 *   2. Voice IDs are not placeholders
 *   3. The ElevenLabs API responds correctly for a short Hebrew text
 *   4. The returned audio buffer is non-empty and looks like an MP3
 *
 * It does NOT call storeAudio — it only tests the API call itself.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ─── Config ───────────────────────────────────────────
const PLACEHOLDER_PREFIX = 'YOUR_ELEVENLABS';

const TEST_TEXT   = 'שלום, זהו בדיקת שמע קצרה לוידוא שהמערכת עובדת כמו שצריך.';
const TEST_VOICE  = process.argv[2] || 'mom';          // pass voice id as arg: npx ts-node ... fairy
const SLEEP_MODE  = false;

// Inline voice config to avoid TypeScript module resolution issues in a standalone script
const VOICES: Record<string, { label: string; elevenlabsVoiceId: string; stability: number; similarityBoost: number }> = {
  mom:   { label: 'אמא',        elevenlabsVoiceId: 'YOUR_ELEVENLABS_VOICE_ID_MOM',   stability: 0.75, similarityBoost: 0.85 },
  dad:   { label: 'אבא',        elevenlabsVoiceId: 'YOUR_ELEVENLABS_VOICE_ID_DAD',   stability: 0.70, similarityBoost: 0.80 },
  fairy: { label: 'פייה קסומה', elevenlabsVoiceId: 'YOUR_ELEVENLABS_VOICE_ID_FAIRY', stability: 0.60, similarityBoost: 0.75 },
};

// ─── Checks ───────────────────────────────────────────
async function runChecks() {
  let hasBlocker = false;

  console.log('\n══════════════════════════════════════════');
  console.log('  ElevenLabs Audio Debug Test');
  console.log('══════════════════════════════════════════\n');

  // 1. API key
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('❌ ELEVENLABS_API_KEY is not set in .env');
    console.error('   Add: ELEVENLABS_API_KEY=your_key_here');
    hasBlocker = true;
  } else {
    console.log(`✅ ELEVENLABS_API_KEY is set (${apiKey.slice(0, 6)}...)`);
  }

  // 2. Voice IDs
  console.log('\n── Voice ID check ──────────────────────────');
  for (const [id, voice] of Object.entries(VOICES)) {
    if (voice.elevenlabsVoiceId.startsWith(PLACEHOLDER_PREFIX)) {
      console.error(`❌ voices.ts: "${id}" (${voice.label}) has placeholder voice ID: ${voice.elevenlabsVoiceId}`);
      console.error(`   Replace with a real ElevenLabs voice ID in backend/config/voices.ts`);
      hasBlocker = true;
    } else {
      console.log(`✅ voices.ts: "${id}" (${voice.label}) → ${voice.elevenlabsVoiceId}`);
    }
  }

  if (hasBlocker) {
    console.error('\n══════════════════════════════════════════');
    console.error('  BLOCKED: fix the issues above before the API call can proceed.');
    console.error('══════════════════════════════════════════\n');
    process.exit(1);
  }

  // 3. Live API call
  const voice = VOICES[TEST_VOICE];
  if (!voice) {
    console.error(`\n❌ Unknown test voice: "${TEST_VOICE}". Valid: mom | dad | fairy`);
    process.exit(1);
  }

  console.log(`\n── Live API call ───────────────────────────`);
  console.log(`   Voice:      ${voice.label} (${voice.elevenlabsVoiceId})`);
  console.log(`   Text:       ${TEST_TEXT}`);
  console.log(`   Model:      eleven_multilingual_v2`);
  console.log(`   Calling ElevenLabs...`);

  const startMs = Date.now();

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice.elevenlabsVoiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey!,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: TEST_TEXT,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: voice.stability,
            similarity_boost: voice.similarityBoost,
            style: 0,
            use_speaker_boost: true,
          },
        }),
      }
    );

    const elapsedMs = Date.now() - startMs;

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`\n❌ ElevenLabs returned HTTP ${res.status} after ${elapsedMs}ms`);
      console.error(`   Response: ${errBody.slice(0, 400)}`);
      console.error('\n── Diagnosis ───────────────────────────────');
      if (res.status === 401) console.error('   API key is invalid or expired.');
      if (res.status === 404) console.error('   Voice ID not found. Check elevenlabsVoiceId in voices.ts.');
      if (res.status === 422) console.error('   Payload rejected. Check text, model_id, or voice_settings.');
      if (res.status === 429) console.error('   Rate limit hit. Check your ElevenLabs plan quota.');
      process.exit(1);
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const elapsedTotal = Date.now() - startMs;

    // MP3 files start with 0xFF 0xFB, 0xFF 0xF3, 0xFF 0xFA, or ID3 tag 0x49 0x44 0x33
    const firstByte  = buffer[0];
    const secondByte = buffer[1];
    const looksLikeMp3 =
      (firstByte === 0xFF && (secondByte === 0xFB || secondByte === 0xF3 || secondByte === 0xFA)) ||
      (firstByte === 0x49 && secondByte === 0x44); // ID3

    console.log(`\n✅ ElevenLabs responded in ${elapsedTotal}ms`);
    console.log(`   Buffer size: ${buffer.length} bytes (${(buffer.length / 1024).toFixed(1)} KB)`);
    console.log(`   Looks like MP3: ${looksLikeMp3 ? 'yes' : 'NO — unexpected format (first bytes: 0x' + firstByte.toString(16) + ' 0x' + secondByte.toString(16) + ')'}`);

    if (buffer.length < 1000) {
      console.warn('⚠️  Buffer is very small — audio may be empty or malformed.');
    }

    console.log('\n── Storage check ───────────────────────────');
    console.log('⚠️  storeAudio() is a STUB — no real storage is wired up.');
    console.log('   The buffer above would be generated correctly by the pipeline,');
    console.log('   but the URL written to AudioAsset will be:');
    console.log('   https://your-storage.example.com/audio/<orderId>-<voice>.mp3');
    console.log('   This URL will 404 for real users.');
    console.log('   Next step: implement storeAudio() with S3 / R2 / Supabase.');

    console.log('\n══════════════════════════════════════════');
    console.log('  Result: ElevenLabs API call SUCCEEDED');
    console.log('  Audio generation is working up to storage.');
    console.log('  REMAINING BLOCKER: storeAudio() stub must be replaced.');
    console.log('══════════════════════════════════════════\n');

  } catch (err) {
    console.error(`\n❌ Network error after ${Date.now() - startMs}ms:`, err);
    console.error('   Check internet connectivity and that api.elevenlabs.io is reachable.');
    process.exit(1);
  }
}

runChecks();
