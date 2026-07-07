/**
 * Narration A/B audition set — listen to the SAME sample pages across mom / dad / fairy, AFTER the fixes
 * (per-page niqqud disambiguation + effective voice_settings). Generates one MP3 per (page × voice) into
 * outputs/narration-audition/ and an index.html grid so Guy can A/B the voices and judge the improved state
 * BEFORE any voice re-casting decision.
 *
 * Uses the SAME pipeline as prod generatePageAudio (buildPageNarrationTtsText → resolveVoiceSettings → callElevenLabs),
 * so what you hear is what a real book page would sound like. Saves local files (no Supabase).
 *
 * Run (needs credits):
 *   ELEVENLABS_API_KEY=... npx tsx --require ./scripts/shims/register-server-only.cjs scripts/narration-ab-audition.ts
 *   (set AUDITION_SLEEP_MODE=true to hear sleep-mode pacing)
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { VOICES } from '../backend/config/voices';
import { buildPageNarrationTtsText, resolveVoiceSettings, callElevenLabs } from '../backend/providers/audio';

const OUT_DIR = 'outputs/narration-audition';

/**
 * Sample narration pages — BARE Hebrew (no niqqud) with homographs + emotional content, so BOTH the wired niqqud pass
 * (RULES-covered words get vocalized) and the now-effective voice tuning are audible. Includes miss-list homographs
 * (פחד/דבר/בוקר/רוח) so Guy also hears what the RULES do NOT yet cover.
 */
const SAMPLE_PAGES: { id: string; label: string; text: string }[] = [
  {
    id: 'p1_rules_covered',
    label: 'Homographs the RULES cover (חול / גשר / נפל / אש)',
    text: 'הילד הלך על החול ליד הגשר. פתאום הוא נפל, והאש כבתה לאט. "אל תפחד," לחש הארנב, "אני כאן."',
  },
  {
    id: 'p2_rules_missed',
    label: 'Homographs the RULES still MISS (בוקר / רוח / פחד / דבר)',
    text: 'בבוקר נשבה רוח קרה. "אני מרגיש פחד," אמר הילד בשקט. "זה בסדר לדבר על זה," ענתה אמא, וחיבקה אותו.',
  },
  {
    id: 'p3_emotional',
    label: 'Emotional beat (trembling and brave)',
    text: 'הלב שלו רעד. הוא נשם לאט — אחת... שתיים... שלוש. "אני רועד ואני אמיץ באותו זמן," הוא לחש, ודמעה קטנה נצצה בעין.',
  },
  {
    id: 'p4_gentle_bedtime',
    label: 'Gentle bedtime pacing',
    text: 'הכוכבים דלקו אחד אחד. "לילה טוב," לחשה הפייה. "מחר יהיה יום חדש, מלא אור." והילד עצם את העיניים בחיוך.',
  },
];

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string);
}

async function main(): Promise<void> {
  if (!process.env.ELEVENLABS_API_KEY) {
    console.error('Set ELEVENLABS_API_KEY to generate the audition set.');
    process.exit(1);
  }
  const sleepMode = process.env.AUDITION_SLEEP_MODE === 'true';
  mkdirSync(OUT_DIR, { recursive: true });

  const rows: string[] = [];
  for (const page of SAMPLE_PAGES) {
    const ttsText = buildPageNarrationTtsText(page.text, sleepMode);
    const cells: string[] = [];
    for (const voice of VOICES) {
      const file = `${page.id}__${voice.id}.mp3`;
      try {
        const buf = await callElevenLabs(ttsText, voice.elevenlabsVoiceId, resolveVoiceSettings(voice, sleepMode));
        writeFileSync(join(OUT_DIR, file), buf);
        console.log(`✓ ${file} (${(buf.length / 1024).toFixed(1)} KB)`);
        cells.push(`<td><audio controls src="${file}"></audio></td>`);
      } catch (e) {
        console.error(`✗ ${file}: ${(e as Error).message}`);
        cells.push(`<td style="color:#c00">FAILED</td>`);
      }
    }
    rows.push(
      `<tr><th style="text-align:right"><div>${esc(page.label)}</div>` +
        `<div class="tts" dir="rtl">${esc(ttsText)}</div></th>${cells.join('')}</tr>`,
    );
  }

  const head = VOICES.map((v) => `<th>${v.emoji} ${esc(v.label)} <small>(${v.id})</small></th>`).join('');
  const html =
    `<!doctype html><meta charset="utf-8"><title>Narration A/B audition</title>` +
    `<style>body{font-family:system-ui;margin:2rem}h1{font-size:1.3rem}table{border-collapse:collapse}` +
    `td,th{border:1px solid #ccc;padding:.6rem;vertical-align:top}.tts{font-size:.9rem;color:#444;margin-top:.4rem}` +
    `audio{width:230px}small{color:#888}</style>` +
    `<h1>Narration A/B — mom / dad / fairy (niqqud + voice_settings applied)</h1>` +
    `<p>Each row is one sample page (TTS-vocalized text shown). Compare the same page across the three voices.` +
    ` ${sleepMode ? 'Sleep-mode pacing.' : 'Normal pacing.'}</p>` +
    `<table><tr><th>Page</th>${head}</tr>${rows.join('')}</table>`;
  writeFileSync(join(OUT_DIR, 'index.html'), html, 'utf8');
  console.log(`\nDone. Open ${OUT_DIR}/index.html to A/B the voices.`);
}

void main();
