/**
 * Bounded Hebrew narration audition. Dry-run is the default; live mode is allowed only after the matching dry-run.
 * The script writes local ignored artifacts and never imports Prisma, Supabase, storage, or the production audio module.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { getVoiceById, type VoiceConfig } from '@/backend/config/voices';
import {
  buildNarrationAuditionCells,
  NARRATION_AUDITION_POLICY_VERSION,
  type NarrationAuditionCell,
} from '@/lib/tts-audition/narration-pronunciation-audition';

export const AUDITION_MODEL_ID = 'eleven_v3' as const;
export const AUDITION_LANGUAGE_CODE = 'he' as const;
export const AUDITION_OUTPUT_FORMAT = 'mp3_44100_128' as const;
export const AUDITION_VOICE_ID = 'fairy' as const;
const FETCH_TIMEOUT_MS = 60_000;
const APPROVED_REQUEST_COUNT = 24;

export interface AuditionVoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

type PronunciationResult = '' | 'correct' | 'wrong' | 'unclear';
type ProsodyResult = '' | 'natural' | 'unnatural' | 'unclear';
type ClipStatus = 'planned' | 'generated' | 'failed';

export interface AuditionManifestEntry extends NarrationAuditionCell {
  policyVersion: typeof NARRATION_AUDITION_POLICY_VERSION;
  modelId: typeof AUDITION_MODEL_ID;
  languageCode: typeof AUDITION_LANGUAGE_CODE;
  outputFormat: typeof AUDITION_OUTPUT_FORMAT;
  voiceId: typeof AUDITION_VOICE_ID;
  elevenlabsVoiceId: string;
  voiceSettings: AuditionVoiceSettings;
  mp3Path: string;
  status: ClipStatus;
  audioBytes?: number;
  audioSha256?: string;
  providerCharacterCost?: number;
  providerCharacterCostRaw?: string;
  providerRequestId?: string;
  providerTraceId?: string;
  error?: string;
  pronunciationByHuman: PronunciationResult;
  prosodyByHuman: ProsodyResult;
  otherErrorByHuman: boolean;
  notes: string;
}

export interface AuditionPreflight {
  policyVersion: typeof NARRATION_AUDITION_POLICY_VERSION;
  runId: string;
  createdAt: string;
  gitHead: string;
  requestCount: number;
  inputCodePoints: number;
  inputUtf8Bytes: number;
  matrixSha256: string;
  voiceId: typeof AUDITION_VOICE_ID;
  elevenlabsVoiceId: string;
  modelId: typeof AUDITION_MODEL_ID;
  languageCode: typeof AUDITION_LANGUAGE_CODE;
  outputFormat: typeof AUDITION_OUTPUT_FORMAT;
  voiceSettings: AuditionVoiceSettings;
}

export interface AuditionRunOptions {
  live: boolean;
  runId: string;
  outputRoot: string;
  apiKey?: string;
  gitHead: string;
}

export interface AuditionRunSummary {
  mode: 'dry-run' | 'live';
  runDirectory: string;
  preflight: AuditionPreflight;
  entries: AuditionManifestEntry[];
  generatedClips: number;
  providerCharacterCost: number;
}

export interface AuditionDependencies {
  fetchFn?: typeof fetch;
  now?: () => Date;
  log?: (message: string) => void;
}

export function resolveAuditionVoiceSettings(voice: VoiceConfig): AuditionVoiceSettings {
  return {
    stability: voice.stability ?? 0.75,
    similarity_boost: voice.similarityBoost ?? 0.80,
    style: voice.style ?? 0,
    use_speaker_boost: voice.useSpeakerBoost ?? true,
  };
}

export function safeRunId(value: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error(`Invalid --run-id ${JSON.stringify(value)}; use letters, digits, underscore, or hyphen only`);
  }
  return value;
}

export function parseAuditionArgs(
  argv: readonly string[],
  defaults: { cwd?: string; now?: Date; gitHead?: string } = {},
): AuditionRunOptions {
  let live = false;
  let runId: string | undefined;
  const seen = new Set<string>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg !== '--live' && arg !== '--run-id') throw new Error(`Unknown argument: ${arg}`);
    if (seen.has(arg)) throw new Error(`Duplicate argument: ${arg}`);
    seen.add(arg);
    if (arg === '--live') {
      live = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error('--run-id requires a value');
    runId = safeRunId(value);
    index += 1;
  }
  const now = defaults.now ?? new Date();
  return {
    live,
    runId: runId ?? now.toISOString().replace(/[:.]/g, '-'),
    outputRoot: path.join(defaults.cwd ?? process.cwd(), 'outputs', 'narration-pronunciation-audition'),
    gitHead: defaults.gitHead ?? 'unknown',
  };
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

export function buildPlayerHtml(runId: string, entries: readonly AuditionManifestEntry[]): string {
  const manifestJson = JSON.stringify(entries).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><title>בדיקת קריינות — ${escapeHtml(runId)}</title>
<style>
body{font-family:system-ui,"Segoe UI",Arial,sans-serif;margin:0;padding:24px;background:#f7f5ff;color:#211b2d}
h1{margin:0 0 6px}.intro{color:#5e566b;margin-bottom:18px}.item{background:white;border:1px solid #d8d0e6;border-radius:16px;padding:16px;margin:16px 0}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #e3ddec;padding:8px;vertical-align:top}th{background:#f1edfa;text-align:right}
.input{font-size:18px;line-height:1.5}.expected{color:#4d356c}.bar{position:sticky;top:0;background:#f7f5ff;padding:10px 0;display:flex;gap:12px;align-items:center}
textarea{width:100%;min-height:42px}.judgment label{display:block}.error{color:#b42318}.muted{color:#777}button{cursor:pointer;padding:6px 12px}button:disabled{cursor:not-allowed}
</style></head><body>
<h1>בדיקת הגייה וזרימה — קול הפייה</h1>
<p class="intro">בכל משפט נבדקים בנפרד 3 היקפי ניקוד × 2 מצבי פיסוק. אותו seed משמש בכל ששת התנאים.</p>
<div class="bar"><button onclick="exportResults()">הורדת תוצאות JSON</button><span id="progress"></span></div>
<div id="root"></div>
<script>
const MANIFEST=${manifestJson};const STORAGE_KEY='narration-audition-${escapeHtml(runId)}';let currentAudio=null;
let state=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
const niqqudLabels={none:'ללא ניקוד',risk_words:'ניקוד מילות סיכון',full_sentence:'ניקוד מלא'};
const punctuationLabels={current_ellipsis:'הפיסוק הנוכחי (שלוש נקודות)',natural:'פיסוק טבעי'};
function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));progress();}
function update(id,key,value){state[id]={...(state[id]||{}),[key]:value};save();}
function play(path,button){if(currentAudio)currentAudio.pause();currentAudio=new Audio(path);currentAudio.play().catch(e=>button.textContent='שגיאה: '+e.message);}
function progress(){const marked=MANIFEST.filter(e=>state[e.clipId]?.pronunciationByHuman&&state[e.clipId]?.prosodyByHuman).length;document.getElementById('progress').textContent=marked+' / '+MANIFEST.length+' הושלמו';}
function exportResults(){const merged=MANIFEST.map(e=>({...e,...(state[e.clipId]||{})}));const blob=new Blob([JSON.stringify(merged,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='judgments-${escapeHtml(runId)}.json';a.click();}
function radios(id,key,values,saved){return values.map(([value,label])=>'<label><input type="radio" name="'+esc(id+'-'+key)+'" '+(saved===value?'checked':'')+' onchange="update(\''+esc(id)+'\',\''+key+'\',\''+value+'\')">'+label+'</label>').join('');}
function render(){const root=document.getElementById('root');const groups=new Map();for(const e of MANIFEST){if(!groups.has(e.itemId))groups.set(e.itemId,[]);groups.get(e.itemId).push(e);}for(const entries of groups.values()){const first=entries[0];const box=document.createElement('section');box.className='item';box.innerHTML='<h2>'+esc(first.itemLabelHe)+'</h2><p class="expected">'+first.expectedReadings.map(esc).join('<br>')+'</p>';const table=document.createElement('table');table.innerHTML='<tr><th>ניקוד</th><th>פיסוק</th><th>הקלט המדויק</th><th>האזנה</th><th>הגייה</th><th>זרימה</th><th>אחר/הערה</th></tr>';for(const e of entries){const saved=state[e.clipId]||{};const row=document.createElement('tr');const listen=e.status==='generated'?'<button onclick="play(\''+esc(e.mp3Path)+'\',this)">▶ האזנה</button>':e.status==='failed'?'<span class="error">'+esc(e.error||'נכשל')+'</span>':'<button disabled>טרם נוצר</button>';row.innerHTML='<td>'+esc(niqqudLabels[e.niqqudScope])+'</td><td>'+esc(punctuationLabels[e.punctuationMode])+'</td><td class="input">'+esc(e.inputText)+'</td><td>'+listen+'</td><td class="judgment">'+radios(e.clipId,'pronunciationByHuman',[['correct','נכונה'],['wrong','שגויה'],['unclear','לא ברור']],saved.pronunciationByHuman)+'</td><td class="judgment">'+radios(e.clipId,'prosodyByHuman',[['natural','טבעית'],['unnatural','לא טבעית'],['unclear','לא ברור']],saved.prosodyByHuman)+'</td><td><label><input type="checkbox" '+(saved.otherErrorByHuman?'checked':'')+' onchange="update(\''+esc(e.clipId)+'\',\'otherErrorByHuman\',this.checked)"> שגיאה אחרת</label><textarea oninput="update(\''+esc(e.clipId)+'\',\'notes\',this.value)">'+esc(saved.notes||'')+'</textarea></td>';table.appendChild(row);}box.appendChild(table);root.appendChild(box);}progress();}
render();
</script></body></html>`;
}

function createEntries(
  cells: readonly NarrationAuditionCell[],
  voice: VoiceConfig,
  voiceSettings: AuditionVoiceSettings,
): AuditionManifestEntry[] {
  return cells.map((cell) => ({
    ...cell,
    policyVersion: NARRATION_AUDITION_POLICY_VERSION,
    modelId: AUDITION_MODEL_ID,
    languageCode: AUDITION_LANGUAGE_CODE,
    outputFormat: AUDITION_OUTPUT_FORMAT,
    voiceId: AUDITION_VOICE_ID,
    elevenlabsVoiceId: voice.elevenlabsVoiceId,
    voiceSettings,
    mp3Path: `clips/${cell.clipId}.mp3`,
    status: 'planned',
    pronunciationByHuman: '',
    prosodyByHuman: '',
    otherErrorByHuman: false,
    notes: '',
  }));
}

function createPreflight(
  options: AuditionRunOptions,
  cells: readonly NarrationAuditionCell[],
  voice: VoiceConfig,
  voiceSettings: AuditionVoiceSettings,
  now: Date,
): AuditionPreflight {
  const immutablePlan = {
    policyVersion: NARRATION_AUDITION_POLICY_VERSION,
    cells,
    voiceId: AUDITION_VOICE_ID,
    elevenlabsVoiceId: voice.elevenlabsVoiceId,
    modelId: AUDITION_MODEL_ID,
    languageCode: AUDITION_LANGUAGE_CODE,
    outputFormat: AUDITION_OUTPUT_FORMAT,
    voiceSettings,
  };
  return {
    policyVersion: NARRATION_AUDITION_POLICY_VERSION,
    runId: options.runId,
    createdAt: now.toISOString(),
    gitHead: options.gitHead,
    requestCount: cells.length,
    inputCodePoints: cells.reduce((sum, cell) => sum + cell.inputCodePoints, 0),
    inputUtf8Bytes: cells.reduce((sum, cell) => sum + cell.inputUtf8Bytes, 0),
    matrixSha256: sha256(JSON.stringify(immutablePlan)),
    voiceId: AUDITION_VOICE_ID,
    elevenlabsVoiceId: voice.elevenlabsVoiceId,
    modelId: AUDITION_MODEL_ID,
    languageCode: AUDITION_LANGUAGE_CODE,
    outputFormat: AUDITION_OUTPUT_FORMAT,
    voiceSettings,
  };
}

function checkpoint(runDirectory: string, entries: readonly AuditionManifestEntry[]): void {
  writeJson(path.join(runDirectory, 'manifest.json'), entries);
  fs.writeFileSync(path.join(runDirectory, 'player.html'), buildPlayerHtml(path.basename(runDirectory), entries), 'utf8');
}

async function synthesizeClip(input: {
  fetchFn: typeof fetch;
  apiKey: string;
  elevenlabsVoiceId: string;
  text: string;
  seed: number;
  voiceSettings: AuditionVoiceSettings;
}): Promise<{
  bytes: Buffer;
  characterCost?: number;
  characterCostRaw?: string;
  requestId?: string;
  traceId?: string;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${input.elevenlabsVoiceId}?output_format=${AUDITION_OUTPUT_FORMAT}`;
    const response = await input.fetchFn(url, {
      method: 'POST',
      headers: {
        'xi-api-key': input.apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: input.text,
        model_id: AUDITION_MODEL_ID,
        language_code: AUDITION_LANGUAGE_CODE,
        seed: input.seed,
        voice_settings: input.voiceSettings,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`ElevenLabs TTS ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (!contentType.startsWith('audio/')) {
      throw new Error(`ElevenLabs returned non-audio content-type: ${contentType || '(missing)'}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0) throw new Error('ElevenLabs returned an empty audio body');
    const characterCostRaw = response.headers.get('character-cost') ?? undefined;
    const parsedCost = characterCostRaw == null ? undefined : Number.parseInt(characterCostRaw, 10);
    return {
      bytes,
      characterCost: Number.isFinite(parsedCost) ? parsedCost : undefined,
      characterCostRaw,
      requestId: response.headers.get('request-id') ?? response.headers.get('x-request-id') ?? undefined,
      traceId: response.headers.get('x-trace-id') ?? undefined,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function assertFreshDryRunDirectory(runDirectory: string): void {
  if (fs.existsSync(runDirectory)) {
    throw new Error(`Run directory already exists; choose a new --run-id: ${runDirectory}`);
  }
  fs.mkdirSync(runDirectory, { recursive: true });
}

function assertMatchingPreflight(runDirectory: string, expected: AuditionPreflight): AuditionPreflight {
  const preflightPath = path.join(runDirectory, 'preflight.json');
  if (!fs.existsSync(preflightPath)) throw new Error('Matching dry-run preflight is required before --live');
  const actual = JSON.parse(fs.readFileSync(preflightPath, 'utf8')) as AuditionPreflight;
  if (
    actual.runId !== expected.runId ||
    actual.requestCount !== APPROVED_REQUEST_COUNT ||
    actual.matrixSha256 !== expected.matrixSha256
  ) {
    throw new Error('Dry-run preflight does not match the current 24-cell matrix');
  }
  if (fs.existsSync(path.join(runDirectory, 'live-state.json'))) {
    throw new Error('This run-id already started live generation; overwrite/retry is forbidden');
  }
  return actual;
}

export async function runAudition(
  options: AuditionRunOptions,
  dependencies: AuditionDependencies = {},
): Promise<AuditionRunSummary> {
  const runId = safeRunId(options.runId);
  const cells = buildNarrationAuditionCells();
  if (cells.length !== APPROVED_REQUEST_COUNT) {
    throw new Error(`Approved audition must contain exactly ${APPROVED_REQUEST_COUNT} cells; got ${cells.length}`);
  }
  const voice = getVoiceById(AUDITION_VOICE_ID);
  const voiceSettings = resolveAuditionVoiceSettings(voice);
  const now = dependencies.now ?? (() => new Date());
  const log = dependencies.log ?? console.log;
  const runDirectory = path.join(path.resolve(options.outputRoot), runId);
  const preflight = createPreflight(options, cells, voice, voiceSettings, now());
  const entries = createEntries(cells, voice, voiceSettings);

  log(`[narration-audition] mode=${options.live ? 'LIVE' : 'DRY-RUN'} runId=${runId}`);
  log(`[narration-audition] requests=${preflight.requestCount} inputCodePoints=${preflight.inputCodePoints} inputUtf8Bytes=${preflight.inputUtf8Bytes}`);
  log(`[narration-audition] voice=${AUDITION_VOICE_ID} model=${AUDITION_MODEL_ID} language=${AUDITION_LANGUAGE_CODE} format=${AUDITION_OUTPUT_FORMAT}`);
  log(`[narration-audition] matrixSha256=${preflight.matrixSha256}`);
  log(`[narration-audition] output=${runDirectory}`);

  if (!options.live) {
    assertFreshDryRunDirectory(runDirectory);
    writeJson(path.join(runDirectory, 'preflight.json'), preflight);
    checkpoint(runDirectory, entries);
    log('[narration-audition] DRY-RUN complete: zero provider calls. Re-run this exact run-id with --live.');
    return {
      mode: 'dry-run',
      runDirectory,
      preflight,
      entries,
      generatedClips: 0,
      providerCharacterCost: 0,
    };
  }

  const apiKey = options.apiKey?.trim();
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is required for --live');
  const dryRunPreflight = assertMatchingPreflight(runDirectory, preflight);
  const clipsDirectory = path.join(runDirectory, 'clips');
  if (fs.existsSync(clipsDirectory)) throw new Error('Live clips directory already exists; overwrite is forbidden');
  fs.mkdirSync(clipsDirectory);
  const startedAt = now().toISOString();
  writeJson(path.join(runDirectory, 'live-state.json'), {
    status: 'running',
    startedAt,
    matrixSha256: preflight.matrixSha256,
    completedClips: 0,
  });
  checkpoint(runDirectory, entries);

  const fetchFn = dependencies.fetchFn ?? globalThis.fetch;
  if (typeof fetchFn !== 'function') throw new Error('fetch is unavailable');
  let providerCharacterCost = 0;
  for (const [index, entry] of entries.entries()) {
    try {
      const result = await synthesizeClip({
        fetchFn,
        apiKey,
        elevenlabsVoiceId: voice.elevenlabsVoiceId,
        text: entry.inputText,
        seed: entry.seed,
        voiceSettings,
      });
      const absoluteMp3Path = path.join(runDirectory, entry.mp3Path);
      fs.writeFileSync(absoluteMp3Path, result.bytes);
      entry.status = 'generated';
      entry.audioBytes = result.bytes.length;
      entry.audioSha256 = sha256(result.bytes);
      entry.providerCharacterCost = result.characterCost;
      entry.providerCharacterCostRaw = result.characterCostRaw;
      entry.providerRequestId = result.requestId;
      entry.providerTraceId = result.traceId;
      providerCharacterCost += result.characterCost ?? 0;
      checkpoint(runDirectory, entries);
      writeJson(path.join(runDirectory, 'live-state.json'), {
        status: 'running',
        startedAt,
        matrixSha256: preflight.matrixSha256,
        completedClips: index + 1,
        providerCharacterCost,
      });
      log(`[narration-audition] ${index + 1}/${entries.length} ${entry.clipId}`);
    } catch (error) {
      entry.status = 'failed';
      entry.error = error instanceof Error ? error.message : String(error);
      checkpoint(runDirectory, entries);
      writeJson(path.join(runDirectory, 'live-state.json'), {
        status: 'failed',
        failedAt: now().toISOString(),
        matrixSha256: preflight.matrixSha256,
        completedClips: index,
        failedClipId: entry.clipId,
        error: entry.error,
        providerCharacterCost,
      });
      throw new Error(`Audition stopped after ${index} successful clip(s); ${entry.clipId}: ${entry.error}`);
    }
  }

  writeJson(path.join(runDirectory, 'live-state.json'), {
    status: 'complete',
    completedAt: now().toISOString(),
    matrixSha256: preflight.matrixSha256,
    completedClips: entries.length,
    providerCharacterCost,
  });
  log(`[narration-audition] LIVE complete: clips=${entries.length} providerCharacterCost=${providerCharacterCost}`);
  return {
    mode: 'live',
    runDirectory,
    preflight: dryRunPreflight,
    entries,
    generatedClips: entries.length,
    providerCharacterCost,
  };
}

function readGitHead(cwd: string): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

export async function runCli(argv: readonly string[] = process.argv.slice(2)): Promise<AuditionRunSummary> {
  const cwd = process.cwd();
  const options = parseAuditionArgs(argv, { cwd, gitHead: readGitHead(cwd) });
  options.apiKey = options.live ? process.env.ELEVENLABS_API_KEY : undefined;
  return runAudition(options);
}

const invokedDirectly = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  void runCli().catch((error) => {
    console.error(`[narration-audition] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
