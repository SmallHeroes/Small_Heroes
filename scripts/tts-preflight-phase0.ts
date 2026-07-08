/**
 * Phase 0 — Hebrew TTS feasibility harness (STANDALONE, THROWAWAY, staging/local ONLY).
 *
 * Empirically probes how ElevenLabs `eleven_v3` (language_code:'he') actually reads Hebrew, so we can
 * design the real preflight (Phase 1) on evidence rather than guesses. It does NOT touch prod: no
 * Supabase upload, no order/DB writes, no narration-pipeline wiring. It only calls the ElevenLabs TTS
 * API and writes MP3s + a manifest + a self-contained HTML listening player to disk.
 *
 *   npx tsx --env-file=.env.local scripts/tts-preflight-phase0.ts [flags]
 *
 * Flags:
 *   --stage 0a|0b        which stage to build (default 0a). 0a = fairy × all variants × all items.
 *                        0b = mom+dad × the WINNING variants (set via --variants) × sentences.
 *   --live               ACTUALLY call ElevenLabs (spends credits). DEFAULT is a dry run (no API calls):
 *                        it writes the manifest + player + prints the exact matrix size + char cost so the
 *                        run can be approved before spending anything.
 *   --variants a,b,c     restrict to these variant ids (used to run 0b with 0a's winners).
 *   --voice-settings     include the WITH-vs-WITHOUT voice_settings add-on (0a only; quantifies the gap).
 *   --run-id <id>        override the run id (default: a UTC timestamp).
 *
 * Env: ELEVENLABS_API_KEY (staging key). Load it from .env.local (or pass --env-file=.env.staging.local).
 *
 * Output: outputs/tts-preflight/{runId}/{clips/*.mp3, manifest.json, player.html}
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.staging.local' });
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Voices (inlined from backend/config/voices.ts so this stays standalone — no prod imports).
// ─────────────────────────────────────────────────────────────────────────────
const VOICES = {
  fairy: { voiceId: 'fairy', elevenlabsVoiceId: 'piI8Kku0DcvcL6TTSeQt', label: 'פייה קסומה', stability: 0.6, similarity_boost: 0.75, style: 0.3 },
  mom: { voiceId: 'mom', elevenlabsVoiceId: '4RZ84U1b4WCqpu57LvIq', label: 'אמא', stability: 0.55, similarity_boost: 0.78, style: 0.2 },
  dad: { voiceId: 'dad', elevenlabsVoiceId: 'V4aTMuwwYUtBD7ZqVvZs', label: 'אבא', stability: 0.7, similarity_boost: 0.8, style: 0 },
} as const;
type VoiceKey = keyof typeof VOICES;

// ─────────────────────────────────────────────────────────────────────────────
// Variants — the controls we are testing whether v3(he) respects.
// The exact ElevenLabs syntax used is documented per variant; Phase 0 discovers what actually works.
// ─────────────────────────────────────────────────────────────────────────────
type VariantId =
  | 'raw'                // bare surface, exactly as prod would send it
  | 'niqqud-selective'   // target vocalized with the MINIMAL disambiguating points
  | 'niqqud-full'        // target FULLY pointed
  | 'alias'              // bare-Hebrew phonetic RESPELLING (no niqqud) — does respelling alone help?
  | 'ipa-inline'         // inline IPA via <phoneme alphabet="ipa" ph="…">word</phoneme>
  | 'pron-dict-ipa'      // pronunciation dictionary, phoneme(IPA) rule (model-restricted — may be ignored by v3)
  | 'pron-dict-alias'    // pronunciation dictionary, alias rule
  | 'pause-punct'        // sentence with the prod ellipsis "…" pause-hack only
  | 'pause-tags';        // sentence with ElevenLabs [short pause] / [pause] audio tags

// NOTE: variant 'alias' (inline bare respelling) is intentionally omitted for Hebrew — a bare respelling
// converges on the niqqud form already tested by 2/3. The distinct alias MECHANISM is tested via the
// pronunciation-dictionary alias rule (pron-dict-alias), which substitutes the word with its vocalized form.
const WORD_VARIANTS: VariantId[] = ['raw', 'niqqud-selective', 'niqqud-full', 'ipa-inline', 'pron-dict-ipa', 'pron-dict-alias'];
// 0b (2026-07-08): sentences now also carry the WINNERS in context — 'niqqud-selective' (only the risk
// words pointed) and 'pron-dict-alias' (raw text + the alias dict substitutes the risk words). 0a only
// tested sentences on raw/full/pauses; these two close that gap. See buildInputText + the alias dict below.
const SENTENCE_VARIANTS: VariantId[] = ['raw', 'niqqud-selective', 'niqqud-full', 'pron-dict-alias', 'pause-punct', 'pause-tags'];

// ─────────────────────────────────────────────────────────────────────────────
// Items. Linguistics are DATA — edit freely before the live run; the player shows the exact inputText
// so Guy can verify each input is correct while judging. `expectedReading` is the intended pronunciation.
//   - Words carry per-variant strings (niqqud/alias/ipa). A missing variant string => that variant is skipped.
//   - Sentences carry a bare `raw`, a `niqqudFull`, and optional previous/next context for continuity tests.
// ─────────────────────────────────────────────────────────────────────────────
type WordItem = {
  kind: 'word';
  id: string;
  category: 'homograph' | 'name' | 'companion';
  raw: string;              // bare surface
  expectedReading: string;  // transliteration of the intended reading
  gloss: string;            // English meaning / note
  niqqudSelective?: string;
  niqqudFull?: string;
  alias?: string;
  ipa?: string;             // IPA for the whole target (used inline + in the dict)
};
type SentenceItem = {
  kind: 'sentence';
  id: string;
  category: 'sentence';
  source: string;           // provenance (real bank file / constructed)
  raw: string;              // bare (or original) surface with prod-style ellipsis stripped
  niqqudSelective: string;  // ONLY the risk words pointed (rest bare) — the 0a "safe" winner, in context
  niqqudFull: string;       // fully vocalized version
  expectedReading: string;
  gloss: string;
  prevText?: string;        // for previous_text/next_text continuity test
  nextText?: string;
};
type Item = WordItem | SentenceItem;

const HOMOGRAPHS: WordItem[] = [
  { kind: 'word', id: 'erev', category: 'homograph', raw: 'ערב', expectedReading: 'érev (evening)', gloss: 'evening — not "arév" (pleasant) / "orév" (to mix)', niqqudSelective: 'עֶרב', niqqudFull: 'עֶרֶב', alias: 'עֶרֶב', ipa: 'ˈeʁev' },
  { kind: 'word', id: 'baerev', category: 'homograph', raw: 'בערב', expectedReading: 'ba-érev (in the evening)', gloss: 'the ב prefix: "ba" (in the) — not "be"', niqqudSelective: 'בּעֶרב', niqqudFull: 'בָּעֶרֶב', alias: 'בָּעֶרֶב', ipa: 'baˈeʁev' },
  { kind: 'word', id: 'barak', category: 'homograph', raw: 'ברק', expectedReading: 'barák (lightning)', gloss: 'lightning', niqqudSelective: 'בּרק', niqqudFull: 'בָּרָק', alias: 'בָּרָק', ipa: 'baˈʁak' },
  { kind: 'word', id: 'sefer', category: 'homograph', raw: 'ספר', expectedReading: 'séfer (book)', gloss: 'book — not "sapár" (barber) / "sipér" (told) / "safár" (counted)', niqqudSelective: 'סֵפר', niqqudFull: 'סֵפֶר', alias: 'סֵפֶר', ipa: 'ˈsefeʁ' },
  { kind: 'word', id: 'sheva', category: 'homograph', raw: 'שבע', expectedReading: 'shéva (seven)', gloss: 'seven — not "savéa" (satiated) / "shavá" (swore)', niqqudSelective: 'שֶׁבע', niqqudFull: 'שֶׁבַע', alias: 'שֶׁבַע', ipa: 'ˈʃeva' },
  { kind: 'word', id: 'gezer', category: 'homograph', raw: 'גזר', expectedReading: 'gézer (carrot)', gloss: 'carrot — not "gazár" (cut/decreed)', niqqudSelective: 'גֶּזר', niqqudFull: 'גֶּזֶר', alias: 'גֶּזֶר', ipa: 'ˈɡezeʁ' },
  { kind: 'word', id: 'dod', category: 'homograph', raw: 'דוד', expectedReading: 'dod (uncle)', gloss: 'uncle — not "David" (name) / "dud" (boiler)', niqqudSelective: 'דּוֹד', niqqudFull: 'דּוֹד', alias: 'דּוֹד', ipa: 'dod' },
  { kind: 'word', id: 'nafal', category: 'homograph', raw: 'נפל', expectedReading: 'nafál (he fell)', gloss: 'fell (verb) — not "néfel" (noun)', niqqudSelective: 'נפַל', niqqudFull: 'נָפַל', alias: 'נָפַל', ipa: 'naˈfal' },
  { kind: 'word', id: 'bar', category: 'homograph', raw: 'בר', expectedReading: 'bar', gloss: 'bar (grain/wild/son-of); also a name', niqqudSelective: 'בַּר', niqqudFull: 'בַּר', alias: 'בַּר', ipa: 'baʁ' },
];

const NAMES: WordItem[] = [
  { kind: 'word', id: 'yuval', category: 'name', raw: 'יובל', expectedReading: 'Yuvál', gloss: "child name", niqqudSelective: 'יובָל', niqqudFull: 'יוּבָל', alias: 'יוּבָל', ipa: 'juˈval' },
  { kind: 'word', id: 'mia', category: 'name', raw: 'מיה', expectedReading: 'Míya', gloss: 'child name', niqqudSelective: 'מִיָּה', niqqudFull: 'מִיָּה', alias: 'מִייָה', ipa: 'ˈmija' },
  { kind: 'word', id: 'noam', category: 'name', raw: 'נועם', expectedReading: 'Nóam', gloss: 'child name — not "noém"', niqqudSelective: 'נֹעם', niqqudFull: 'נֹעַם', alias: 'נוֹעַם', ipa: 'ˈnoam' },
  { kind: 'word', id: 'uri', category: 'name', raw: 'אורי', expectedReading: 'Úri', gloss: 'child name', niqqudSelective: 'אוּרי', niqqudFull: 'אוּרִי', alias: 'אוּרִי', ipa: 'ˈuʁi' },
];

const COMPANIONS: WordItem[] = [
  { kind: 'word', id: 'dini', category: 'companion', raw: 'דיני', expectedReading: 'Díni', gloss: 'companion (dragon) — not "diní" (my law)', niqqudSelective: 'דִּינִי', niqqudFull: 'דִּינִי', alias: 'דִּינִי', ipa: 'ˈdini' },
  { kind: 'word', id: 'buni', category: 'companion', raw: 'בוני', expectedReading: 'Búni', gloss: 'companion (bunny)', niqqudSelective: 'בּוּני', niqqudFull: 'בּוּנִי', alias: 'בּוּנִי', ipa: 'ˈbuni' },
];

const SENTENCES: SentenceItem[] = [
  {
    kind: 'sentence', id: 'sent-medical', category: 'sentence', source: 'bunny_ometz_adventure (v3-approved) p1 — REAL',
    raw: 'דלת הרופא עמדה סגורה, ומאחוריה חיכה הלא-נודע.',
    niqqudSelective: 'דלת הרופא עָמְדָה סגורה, ומאחוריה חיכה הלא-נודע.', // only עמדה (amdá, stood) pointed
    niqqudFull: 'דֶּלֶת הָרוֹפֵא עָמְדָה סְגוּרָה, וּמֵאֲחוֹרֶיהָ חִכָּה הַלֹּא-נוֹדָע.',
    expectedReading: '…amdá segurá… (the door stood closed)',
    gloss: 'homograph in context: עמדה = amdá (stood)',
    prevText: 'הכיסא בחדר ההמתנה היה גבוה מדי.',
    nextText: 'מתחת לכיסא של אמא הציצה אוזן ארוכה וורודה.',
  },
  {
    kind: 'sentence', id: 'sent-bedtime', category: 'sentence', source: 'bunny_ometz_bedtime (v3-approved) p1 — REAL (bare)',
    raw: 'נועם שכב מתחת לשמיכה. החדר היה שקט.',
    niqqudSelective: 'נֹעם שָׁכַב מתחת לשמיכה. החדר היה שָׁקֵט.', // only נועם (Nóam), שכב (lay), שקט (quiet) pointed
    niqqudFull: 'נֹעַם שָׁכַב מִתַּחַת לַשְּׂמִיכָה. הַחֶדֶר הָיָה שָׁקֵט.',
    expectedReading: 'Nóam shakháv… (Noam lay under the blanket. The room was quiet.)',
    gloss: 'homographs in context: שכב (lay), שקט (quiet)',
    prevText: 'הלילה לפני הבדיקה.',
    nextText: 'אבל הגוף לא היה שקט.',
  },
  {
    kind: 'sentence', id: 'sent-homographs', category: 'sentence', source: 'CONSTRUCTED — homograph-dense',
    raw: 'בערב דוד קרא לנו ספר על ארנב שאכל גזר.',
    niqqudSelective: 'בּעֶרב דּוֹד קרא לנו סֵפר על ארנב שאכל גֶּזר.', // only the 4 homographs pointed (word-level selective spellings)
    niqqudFull: 'בָּעֶרֶב דּוֹד קָרָא לָנוּ סֵפֶר עַל אַרְנָב שֶׁאָכַל גֶּזֶר.',
    expectedReading: 'ba-érev dod kará lánu séfer al arnáv she-akhál gézer',
    gloss: 'four target homographs in one sentence: ערב, דוד, ספר, גזר',
  },
];

const WORD_ITEMS: WordItem[] = [...HOMOGRAPHS, ...NAMES, ...COMPANIONS];
const ALL_ITEMS: Item[] = [...WORD_ITEMS, ...SENTENCES];

// Risk words that appear ONLY inside the real sentences (not as standalone WordItems). Added to the alias
// dictionary so the sentence 'pron-dict-alias' variant substitutes them in context (0b gap). The homograph/
// name risk words already covered by WORD_ITEMS (בערב, דוד, ספר, גזר, נועם) need no extra rule.
const SENTENCE_RISK_ALIASES: Array<{ raw: string; alias: string }> = [
  { raw: 'עמדה', alias: 'עָמְדָה' }, // amdá (stood) — sent-medical
  { raw: 'שכב', alias: 'שָׁכַב' }, // shakháv (lay) — sent-bedtime
  { raw: 'שקט', alias: 'שָׁקֵט' }, // shakét (quiet) — sent-bedtime
];

// Representative subset for the voice_settings WITH-vs-WITHOUT add-on (keeps it tiny).
const VOICE_SETTINGS_ITEM_IDS = new Set(['baerev', 'sefer', 'yuval', 'sent-homographs']);

// PHASE 0 FINDING (2026-07-08): eleven_v3 REJECTS previous_text/next_text — the TTS API returns
// 400 { code:"unsupported_model", message:"Providing previous_text or next_text is not yet supported
// with the 'eleven_v3' model." }. So the continuity/context control is NOT AVAILABLE on v3: we do not
// send those params (sentences render plain). Flip this to true only if a future v3 revision supports it.
const V3_SUPPORTS_CONTEXT = false;

// Fixed per-item seed so a given item uses the SAME seed across ALL its variants (differences are then
// attributable to the input, not to v3 nondeterminism). Sample 1 reuses the seed; sample 2 shifts it to
// expose variance. (If v3 ignores `seed`, the two samples are just independent draws — still informative.)
const SAMPLE_SEED_STRIDE = 100000;
function itemSeed(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % 900000) + 1000; // stable positive int
}

// ─────────────────────────────────────────────────────────────────────────────
// Variant → input text. Returns null when the variant does not apply to the item.
// ─────────────────────────────────────────────────────────────────────────────
function ellipsisPauseHack(s: string): string {
  // Mirrors the prod per-page hack (audio.ts generatePageAudio, non-sleep mode).
  return s.replace(/\./g, '... ').replace(/,/g, ',  ');
}
function phonemeTag(word: string, ipa?: string): string | null {
  if (!ipa) return null;
  return `<phoneme alphabet="ipa" ph="${ipa}">${word}</phoneme>`;
}

function buildInputText(item: Item, variant: VariantId): string | null {
  if (item.kind === 'word') {
    switch (variant) {
      case 'raw': return item.raw;
      case 'niqqud-selective': return item.niqqudSelective ?? null;
      case 'niqqud-full': return item.niqqudFull ?? null;
      case 'alias': return item.alias && item.alias !== item.raw ? item.alias : null;
      case 'ipa-inline': return phonemeTag(item.raw, item.ipa);
      case 'pron-dict-ipa': return item.ipa ? item.raw : null; // dict does the work; text stays raw
      case 'pron-dict-alias': return item.niqqudFull ? item.raw : null; // alias rule maps raw -> vocalized form
      default: return null; // pause-* do not apply to single words
    }
  }
  // sentence
  switch (variant) {
    case 'raw': return item.raw;
    case 'niqqud-selective': return item.niqqudSelective; // only the risk words pointed (in context)
    case 'niqqud-full': return item.niqqudFull;
    case 'pron-dict-alias': return item.raw; // raw text + alias dict substitutes the risk words (see dict build below)
    case 'pause-punct': return ellipsisPauseHack(item.raw);
    case 'pause-tags': return item.raw.replace(/\. /g, '. [pause] ').replace(/, /g, ', [short pause] ').replace(/\.$/, '. [pause]');
    default: return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ElevenLabs API (inlined; standalone).
// ─────────────────────────────────────────────────────────────────────────────
const ELEVEN_BASE = 'https://api.elevenlabs.io/v1';
function apiKey(): string {
  const k = process.env.ELEVENLABS_API_KEY?.trim();
  if (!k) throw new Error('ELEVENLABS_API_KEY not set (staging key). Add it to .env.local or .env.staging.local.');
  return k;
}

type DictLocator = { pronunciation_dictionary_id: string; version_id: string };

async function createPronunciationDictionary(
  name: string,
  rules: Array<
    | { string_to_replace: string; type: 'phoneme'; phoneme: string; alphabet: 'ipa' }
    | { string_to_replace: string; type: 'alias'; alias: string }
  >
): Promise<DictLocator> {
  const res = await fetch(`${ELEVEN_BASE}/pronunciation-dictionaries/add-from-rules`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, rules }),
  });
  if (!res.ok) throw new Error(`pronunciation-dictionary add-from-rules ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { id: string; version_id: string };
  return { pronunciation_dictionary_id: json.id, version_id: json.version_id };
}

async function tts(opts: {
  text: string;
  elevenlabsVoiceId: string;
  seed: number;
  voiceSettings?: { stability: number; similarity_boost: number; style: number; use_speaker_boost: boolean } | null;
  previousText?: string;
  nextText?: string;
  dictLocators?: DictLocator[];
}): Promise<Buffer> {
  const body: Record<string, unknown> = {
    text: opts.text,
    model_id: 'eleven_v3',
    language_code: 'he',
    seed: opts.seed,
  };
  if (opts.voiceSettings) body.voice_settings = opts.voiceSettings;
  if (opts.previousText) body.previous_text = opts.previousText;
  if (opts.nextText) body.next_text = opts.nextText;
  if (opts.dictLocators?.length) body.pronunciation_dictionary_locators = opts.dictLocators;

  const res = await fetch(`${ELEVEN_BASE}/text-to-speech/${opts.elevenlabsVoiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey(), 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

// ─────────────────────────────────────────────────────────────────────────────
// Manifest
// ─────────────────────────────────────────────────────────────────────────────
type ManifestEntry = {
  clipId: string;
  itemId: string;
  category: string;
  voiceId: string;
  elevenlabsVoiceId: string;
  variant: VariantId;
  voiceSettings: 'off' | 'on';
  sampleIdx: number;
  seed: number;
  inputText: string;
  expectedReading: string;
  gloss: string;
  usesContext: boolean;
  mp3Path: string;   // relative to the run dir
  chars: number;
  error?: string;
  resultByHuman: '' | 'correct' | 'wrong' | 'unnatural' | 'unclear';
  notes: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

// Build the self-contained player: inline every successfully-generated clip as a base64 data: URI so the
// single HTML file plays offline with no ./clips/ folder (this is what Guy listens to). Skips error clips.
function writeEmbeddedPlayer(runDir: string, runId: string, stage: string, manifest: ManifestEntry[]): number {
  const audioMap: Record<string, string> = {};
  let embedded = 0;
  for (const m of manifest) {
    if (m.error) continue;
    const abs = path.join(runDir, m.mp3Path);
    if (!fs.existsSync(abs)) continue;
    audioMap[m.mp3Path] = `data:audio/mpeg;base64,${fs.readFileSync(abs).toString('base64')}`;
    embedded++;
  }
  fs.writeFileSync(path.join(runDir, 'player-embedded.html'), buildPlayerHtml(runId, stage, manifest, audioMap));
  return embedded;
}

async function main() {
  const stage = (arg('stage') ?? '0a') as '0a' | '0b';
  const live = flag('live');
  const includeVoiceSettings = flag('voice-settings') || stage === '0a';
  const variantFilter = arg('variants')?.split(',').map((s) => s.trim()).filter(Boolean) as VariantId[] | undefined;
  const itemFilter = arg('items')?.split(',').map((s) => s.trim()).filter(Boolean);
  const runId = arg('run-id') ?? new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);

  const voices: VoiceKey[] = stage === '0a' ? ['fairy'] : ['mom', 'dad'];
  const runDir = path.join(process.cwd(), 'outputs', 'tts-preflight', runId);
  const clipsDir = path.join(runDir, 'clips');
  fs.mkdirSync(clipsDir, { recursive: true });

  // --embed-only: (re)generate the self-contained player from an existing run's clips + manifest. No API calls.
  if (flag('embed-only')) {
    const mp = path.join(runDir, 'manifest.json');
    if (!fs.existsSync(mp)) throw new Error(`--embed-only needs an existing run: no manifest at ${path.relative(process.cwd(), mp)} (pass --run-id <id>)`);
    const existing = JSON.parse(fs.readFileSync(mp, 'utf8')) as ManifestEntry[];
    const n = writeEmbeddedPlayer(runDir, runId, stage, existing);
    console.log(`[tts-preflight] embed-only: wrote player-embedded.html with ${n} inlined clips (no API calls).`);
    return;
  }

  // Build the cell list (item × variant × voice × sample × voiceSettings) — skip inapplicable cells.
  type Cell = { item: Item; variant: VariantId; voice: VoiceKey; sampleIdx: number; voiceSettings: 'off' | 'on'; inputText: string };
  const items = ALL_ITEMS.filter((i) => !itemFilter || itemFilter.includes(i.id)); // --items re-runs a subset
  const cells: Cell[] = [];
  for (const item of items) {
    const applicable = (item.kind === 'word' ? WORD_VARIANTS : SENTENCE_VARIANTS).filter(
      (v) => !variantFilter || variantFilter.includes(v)
    );
    for (const variant of applicable) {
      const inputText = buildInputText(item, variant);
      if (inputText == null) continue;
      for (const voice of voices) {
        for (let sampleIdx = 0; sampleIdx < 2; sampleIdx++) {
          // Main matrix: voice_settings OFF (matches prod, which omits them).
          cells.push({ item, variant, voice, sampleIdx, voiceSettings: 'off', inputText });
        }
      }
    }
  }
  // Voice-settings ADD-ON (0a): a tiny WITH-vs-WITHOUT comparison on representative items (1 sample).
  if (includeVoiceSettings) {
    for (const item of items) {
      if (!VOICE_SETTINGS_ITEM_IDS.has(item.id)) continue;
      for (const variant of ['raw', 'niqqud-full'] as VariantId[]) {
        const inputText = buildInputText(item, variant);
        if (inputText == null) continue;
        for (const voice of voices) {
          cells.push({ item, variant, voice, sampleIdx: 0, voiceSettings: 'on', inputText });
        }
      }
    }
  }

  const totalChars = cells.reduce((n, c) => n + c.inputText.length, 0);
  const usesDict = cells.some((c) => c.variant === 'pron-dict-ipa' || c.variant === 'pron-dict-alias');

  console.log(`\n[tts-preflight] runId=${runId} stage=${stage} mode=${live ? 'LIVE' : 'DRY-RUN'}`);
  console.log(`[tts-preflight] voices=${voices.join(',')} variants=${variantFilter?.join(',') ?? 'all-applicable'}`);
  console.log(`[tts-preflight] cells=${cells.length}  totalChars=${totalChars}  pronDict=${usesDict}`);
  console.log(`[tts-preflight] est. ElevenLabs cost ≈ ${totalChars} credits/characters across ${cells.length} requests (eleven_v3, language_code=he).`);
  console.log(`[tts-preflight] output: ${path.relative(process.cwd(), runDir)}\n`);

  // Prepare pronunciation dictionaries (LIVE only). One IPA dict + one alias dict across all word targets.
  let ipaLocator: DictLocator | null = null;
  let aliasLocator: DictLocator | null = null;
  if (live && usesDict) {
    try {
      const ipaRules = WORD_ITEMS.filter((w) => w.ipa).map((w) => ({ string_to_replace: w.raw, type: 'phoneme' as const, phoneme: w.ipa!, alphabet: 'ipa' as const }));
      ipaLocator = await createPronunciationDictionary(`phase0-ipa-${runId}`, ipaRules);
      console.log(`[tts-preflight] created IPA pronunciation dictionary (${ipaRules.length} rules)`);
    } catch (e) {
      console.warn(`[tts-preflight] IPA dictionary creation FAILED (recorded per-clip): ${(e as Error).message}`);
    }
    try {
      const aliasRules = [
        ...WORD_ITEMS.filter((w) => w.niqqudFull).map((w) => ({ string_to_replace: w.raw, type: 'alias' as const, alias: w.niqqudFull! })),
        ...SENTENCE_RISK_ALIASES.map((r) => ({ string_to_replace: r.raw, type: 'alias' as const, alias: r.alias })),
      ];
      aliasLocator = await createPronunciationDictionary(`phase0-alias-${runId}`, aliasRules);
      console.log(`[tts-preflight] created alias pronunciation dictionary (${aliasRules.length} rules)`);
    } catch (e) {
      console.warn(`[tts-preflight] alias dictionary creation FAILED (recorded per-clip): ${(e as Error).message}`);
    }
  }

  const manifest: ManifestEntry[] = [];
  let done = 0;
  for (const c of cells) {
    const v = VOICES[c.voice];
    const seed = itemSeed(c.item.id) + c.sampleIdx * SAMPLE_SEED_STRIDE;
    const settingsLabel = c.voiceSettings;
    const clipId = `${c.item.id}__${c.variant}__${c.voice}__vs-${settingsLabel}__s${c.sampleIdx}`;
    const mp3Rel = path.join('clips', `${clipId}.mp3`);
    const usesContext = V3_SUPPORTS_CONTEXT && c.item.kind === 'sentence' && (!!c.item.prevText || !!c.item.nextText);

    const entry: ManifestEntry = {
      clipId,
      itemId: c.item.id,
      category: c.item.category,
      voiceId: v.voiceId,
      elevenlabsVoiceId: v.elevenlabsVoiceId,
      variant: c.variant,
      voiceSettings: c.voiceSettings,
      sampleIdx: c.sampleIdx,
      seed,
      inputText: c.inputText,
      expectedReading: c.item.expectedReading,
      gloss: c.item.gloss,
      usesContext,
      mp3Path: mp3Rel.replace(/\\/g, '/'),
      chars: c.inputText.length,
      resultByHuman: '',
      notes: '',
    };

    if (live) {
      try {
        const dictLocators: DictLocator[] = [];
        if (c.variant === 'pron-dict-ipa' && ipaLocator) dictLocators.push(ipaLocator);
        if (c.variant === 'pron-dict-alias' && aliasLocator) dictLocators.push(aliasLocator);
        if ((c.variant === 'pron-dict-ipa' && !ipaLocator) || (c.variant === 'pron-dict-alias' && !aliasLocator)) {
          throw new Error('pronunciation dictionary unavailable (creation failed above)');
        }
        const buf = await tts({
          text: c.inputText,
          elevenlabsVoiceId: v.elevenlabsVoiceId,
          seed,
          voiceSettings: c.voiceSettings === 'on'
            ? { stability: v.stability, similarity_boost: v.similarity_boost, style: v.style, use_speaker_boost: true }
            : null,
          previousText: usesContext ? (c.item as SentenceItem).prevText : undefined,
          nextText: usesContext ? (c.item as SentenceItem).nextText : undefined,
          dictLocators,
        });
        fs.writeFileSync(path.join(runDir, mp3Rel), buf);
      } catch (e) {
        entry.error = (e as Error).message;
        console.warn(`[tts-preflight] clip FAILED ${clipId}: ${entry.error}`);
      }
      done++;
      if (done % 10 === 0) console.log(`[tts-preflight] ${done}/${cells.length} clips…`);
    }
    manifest.push(entry);
  }

  // Merge into any existing manifest (so a `--items` re-run replaces just those clips and keeps the rest).
  let finalManifest = manifest;
  const manifestPath = path.join(runDir, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as ManifestEntry[];
      const byId = new Map(prev.map((e) => [e.clipId, e]));
      for (const e of manifest) byId.set(e.clipId, e); // new entries overlay old (e.g. a fixed re-run)
      finalManifest = [...byId.values()];
    } catch { /* keep the fresh manifest if the old one is unreadable */ }
  }
  fs.writeFileSync(manifestPath, JSON.stringify(finalManifest, null, 2));
  fs.writeFileSync(path.join(runDir, 'player.html'), buildPlayerHtml(runId, stage, finalManifest));

  const errors = manifest.filter((m) => m.error).length;
  console.log(`\n[tts-preflight] wrote manifest.json (${manifest.length} entries) + player.html`);
  if (live) {
    const embedded = writeEmbeddedPlayer(runDir, runId, stage, finalManifest);
    console.log(`[tts-preflight] wrote player-embedded.html (${embedded} inlined clips — self-contained, plays offline).`);
    console.log(`[tts-preflight] LIVE run complete: ${manifest.length - errors} MP3s, ${errors} errors, ${totalChars} characters billed.`);
    console.log(`[tts-preflight] open ${path.relative(process.cwd(), path.join(runDir, 'player-embedded.html'))} to listen + mark.`);
  } else {
    console.log(`[tts-preflight] DRY RUN — no API calls, no cost. Re-run with --live (and approved staging key) to generate audio.`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Self-contained HTML listening player (no server): grid of item × variant × voice, play buttons,
// correct|wrong|unnatural|unclear radios + notes per cell, localStorage persistence, and a JSON export
// of Guy's judgments. Plays clips/*.mp3 by relative path — OR, when `audioMap` is supplied (the embedded
// player), from inline base64 data: URIs so the single HTML file plays offline with no ./clips/ folder.
// ─────────────────────────────────────────────────────────────────────────────
function buildPlayerHtml(runId: string, stage: string, manifest: ManifestEntry[], audioMap?: Record<string, string>): string {
  const data = JSON.stringify(manifest);
  const audio = JSON.stringify(audioMap ?? {});
  return `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><title>TTS Preflight Phase 0 — ${runId}</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, "Segoe UI", Arial, sans-serif; margin: 0; padding: 16px; }
  h1 { font-size: 18px; margin: 0 0 4px; } .sub { color: #888; font-size: 13px; margin-bottom: 12px; }
  .bar { position: sticky; top: 0; background: Canvas; padding: 8px 0; border-bottom: 1px solid #8884; z-index: 5; display:flex; gap:12px; align-items:center; flex-wrap:wrap;}
  button { cursor: pointer; }
  .item { border: 1px solid #8884; border-radius: 10px; margin: 14px 0; padding: 10px 12px; }
  .item h2 { font-size: 15px; margin: 0 0 2px; } .item .meta { color:#888; font-size:12px; margin-bottom:8px; }
  table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #8883; padding: 6px 8px; font-size: 13px; vertical-align: top; }
  th { background: #8881; text-align: right; } .txt { font-size: 16px; } .missing { color: #c0392b; font-size: 12px; }
  .radios label { margin-inline-end: 8px; white-space: nowrap; font-size: 12px; }
  .r-correct { color: #2e7d32; } .r-wrong { color:#c0392b; } .r-unnatural { color:#b8860b; } .r-unclear { color:#777; }
  textarea { width: 100%; min-height: 30px; font: inherit; } .play { padding: 4px 10px; }
  .cnt { font-variant-numeric: tabular-nums; }
</style></head><body>
<h1>TTS Preflight — Phase 0 · stage ${stage} · run ${runId}</h1>
<div class="sub">eleven_v3 · language_code=he. Listen to each cell, mark correct / wrong / unnatural / unclear, add notes. Your marks autosave locally; use “Export judgments” to send the JSON back.</div>
<div class="bar">
  <button onclick="exportJson()">⬇ Export judgments (JSON)</button>
  <span class="cnt" id="progress"></span>
  <label><input type="checkbox" id="onlyUnmarked" onchange="render()"> show only unmarked</label>
  <span class="sub">clips play from ./clips/ — if your browser blocks file:// audio, run <code>python -m http.server</code> in this folder.</span>
</div>
<div id="root"></div>
<script>
const MANIFEST = ${data};
const AUDIO = ${audio}; // clipId path -> base64 data: URI (embedded player only; {} for the light player)
const KEY = 'tts-preflight-${runId}';
const RESULTS = ['correct','wrong','unnatural','unclear'];
let state = JSON.parse(localStorage.getItem(KEY) || '{}'); // clipId -> {resultByHuman, notes}
function save(){ localStorage.setItem(KEY, JSON.stringify(state)); updateProgress(); }
function updateProgress(){ const marked = MANIFEST.filter(m=>state[m.clipId]&&state[m.clipId].resultByHuman).length; document.getElementById('progress').textContent = marked + ' / ' + MANIFEST.length + ' marked'; }
function mark(id, val){ state[id] = Object.assign({}, state[id], {resultByHuman: val}); save(); }
function note(id, val){ state[id] = Object.assign({}, state[id], {notes: val}); save(); }
function exportJson(){
  const merged = MANIFEST.map(m => Object.assign({}, m, { resultByHuman: (state[m.clipId]||{}).resultByHuman || '', notes: (state[m.clipId]||{}).notes || '' }));
  const blob = new Blob([JSON.stringify(merged, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'judgments-${runId}.json'; a.click();
}
function groupBy(arr, keyFn){ const m = new Map(); for(const x of arr){ const k = keyFn(x); if(!m.has(k)) m.set(k,[]); m.get(k).push(x);} return m; }
function render(){
  const onlyUnmarked = document.getElementById('onlyUnmarked').checked;
  const root = document.getElementById('root'); root.innerHTML='';
  const byItem = groupBy(MANIFEST, m => m.itemId);
  for(const [itemId, entries] of byItem){
    const shown = onlyUnmarked ? entries.filter(e=>!(state[e.clipId]&&state[e.clipId].resultByHuman)) : entries;
    if(!shown.length) continue;
    const e0 = entries[0];
    const div = document.createElement('div'); div.className='item';
    div.innerHTML = '<h2>'+itemId+' — <span class="txt" dir="rtl">'+esc(e0.expectedReading)+'</span></h2>'
      + '<div class="meta">'+esc(e0.category)+' · '+esc(e0.gloss)+'</div>';
    const byVariant = groupBy(shown, m => m.variant + ' · vs-' + m.voiceSettings);
    const table = document.createElement('table');
    table.innerHTML = '<tr><th>variant</th><th>voice</th><th>input sent to v3</th><th>play</th><th>judgment</th><th>notes</th></tr>';
    for(const [vk, vents] of byVariant){
      for(const m of vents){
        const cur = state[m.clipId] || {};
        const tr = document.createElement('tr');
        const radios = RESULTS.map(r => '<label class="r-'+r+'"><input type="radio" name="'+m.clipId+'" '+(cur.resultByHuman===r?'checked':'')+' onchange="mark(\\''+m.clipId+'\\',\\''+r+'\\')">'+r+'</label>').join(' ');
        const audio = m.error ? '<span class="missing">ERR: '+esc(m.error)+'</span>'
          : '<button class="play" onclick="playClip(this,\\''+esc(m.mp3Path)+'\\')">▶ s'+m.sampleIdx+'</button>';
        tr.innerHTML = '<td>'+esc(m.variant)+(m.voiceSettings==='on'?' <b>(voice_settings ON)</b>':'')+(m.usesContext?' <i>(+context)</i>':'')+'</td>'
          + '<td>'+esc(m.voiceId)+'</td>'
          + '<td class="txt" dir="rtl">'+esc(m.inputText)+'</td>'
          + '<td>'+audio+'</td>'
          + '<td class="radios">'+radios+'</td>'
          + '<td><textarea oninput="note(\\''+m.clipId+'\\',this.value)">'+esc(cur.notes||'')+'</textarea></td>';
        table.appendChild(tr);
      }
    }
    div.appendChild(table); root.appendChild(div);
  }
  updateProgress();
}
function playClip(btn, src){ const a = new Audio(AUDIO[src] || src); a.play().catch(err => { btn.textContent='⚠ '+err.message; }); }
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
render();
</script></body></html>`;
}

main().catch((e) => { console.error(e); process.exit(1); });
