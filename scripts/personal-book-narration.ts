/**
 * Optional local book narration (book-narration/v1): ONE ElevenLabs eleven_v3 request per page (cover + body), each a once-only claim on
 * the caller's API meter, priced from the exact frozen TTS text. No automatic retry, no remote upload, no display-text change. The MP3s
 * and a local narrated reader manifest (local-narrated-reader/v1, served by /dev/local-reader) are written locally.
 */
import 'server-only';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { z } from 'zod';
import { findVoiceById } from '../backend/config/voices';
import { buildPageNarrationTtsText, resolveVoiceSettings } from '../backend/providers/audio';
import { localReaderPreviewSchema, localReaderId } from '../lib/local-reader-preview';
import { exclusiveJson } from './personal-causal-trial-journal';
import type { MeterRule } from './personal-simple-book-reviewed-audition';

export const BOOK_NARRATION = Object.freeze({ version: 'book-narration/v1' as const, model: 'eleven_v3' as const, language: 'he' as const,
  accountingMicroUsdPerCharacter: 100, reserveFactor: 2, maxCharacters: 5000, endpoint: 'https://api.elevenlabs.io/v1/text-to-speech/' });
export class BookNarrationError extends Error { constructor(readonly code: string, readonly receipt: unknown = null) { super(code); } }
const fail = (code: string, receipt: unknown = null): never => { throw new BookNarrationError(code, receipt); };
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const settingsSchema = z.object({ stability: z.number().min(0).max(1), similarity_boost: z.number().min(0).max(1), style: z.number().min(0).max(1),
  use_speaker_boost: z.boolean() }).strict();
export const narrationWireSchema = z.object({ version: z.literal(BOOK_NARRATION.version), page: z.number().int().min(0).max(64),
  voiceId: z.string().min(1).max(50), url: z.string().regex(/^https:\/\/api\.elevenlabs\.io\/v1\/text-to-speech\/[A-Za-z0-9]{10,40}$/),
  body: z.object({ text: z.string().min(1).max(BOOK_NARRATION.maxCharacters), model_id: z.literal(BOOK_NARRATION.model),
    language_code: z.literal(BOOK_NARRATION.language), voice_settings: settingsSchema }).strict() }).strict();
export type NarrationWire = z.infer<typeof narrationWireSchema>;
const receiptSchema = z.object({ status: z.number().int().nullable(), characterCost: z.number().int().nonnegative().nullable(),
  requestId: z.string().max(200).nullable(), contentType: z.string().max(100).nullable(), bytes: z.number().int().nonnegative().nullable(),
  audioSha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(), estimatedMicroUsd: z.number().int().nonnegative().nullable() }).strict();
export type NarrationReceipt = z.infer<typeof receiptSchema>;

/** A selectable registry voice (strict lookup, never the legacy/fallback runtime voices) that the caller's policy allows. */
export function narrationVoice(id: unknown, allowed: readonly string[]) {
  const voice = typeof id === 'string' && allowed.includes(id) ? findVoiceById(id) : undefined;
  if (!voice || voice.provider !== 'elevenlabs') return fail('narration_voice');
  return { id: voice.id, label: voice.label, elevenlabsVoiceId: voice.elevenlabsVoiceId, settings: resolveVoiceSettings(voice, false) };
}
export type NarrationVoice = ReturnType<typeof narrationVoice>;
/** The exact request body callElevenLabs sends for these settings, built from the existing TTS text helper (display text untouched). */
export function prepareNarrationWire(page: number, displayText: string, voice: NarrationVoice): NarrationWire {
  let text: string;
  try { text = buildPageNarrationTtsText(displayText, false); } catch { return fail('narration_text'); }
  if (text.length > BOOK_NARRATION.maxCharacters) fail('narration_length');
  return narrationWireSchema.parse({ version: BOOK_NARRATION.version, page, voiceId: voice.id, url: BOOK_NARRATION.endpoint + voice.elevenlabsVoiceId,
    body: { text, model_id: BOOK_NARRATION.model, language_code: BOOK_NARRATION.language, voice_settings: voice.settings } });
}
const characters = (wire: NarrationWire) => wire.body.text.length;
export const narrationReserveMicroUsd = (wire: NarrationWire) => characters(wire) * BOOK_NARRATION.reserveFactor * BOOK_NARRATION.accountingMicroUsdPerCharacter;
/** Conservative budget estimate, not an invoice: max(exact TTS input characters, reported character cost) at the accounting rate. */
export const narrationCostMicroUsd = (wire: NarrationWire, characterCost: number) =>
  Math.max(characters(wire), characterCost) * BOOK_NARRATION.accountingMicroUsdPerCharacter;
export const narrationMeterRule: MeterRule = {
  reserve: wire => { const w = narrationWireSchema.safeParse(wire); return w.success ? narrationReserveMicroUsd(w.data) : null; },
  settle: (wire, receipt, completed) => {
    const w = narrationWireSchema.safeParse(wire), r = receiptSchema.safeParse(receipt);
    if (!w.success) return { estimatedMicroUsd: null, coherent: false };
    if (!r.success) return { estimatedMicroUsd: null, coherent: !completed && (receipt === null || receipt === undefined) };
    const known = r.data.characterCost === null ? null : narrationCostMicroUsd(w.data, r.data.characterCost);
    if (completed) return known !== null && !!r.data.requestId && r.data.audioSha256 !== null && r.data.estimatedMicroUsd === known
      ? { estimatedMicroUsd: known, coherent: true } : { estimatedMicroUsd: null, coherent: false };
    return { estimatedMicroUsd: known, coherent: r.data.estimatedMicroUsd === known };
  },
};
/** The ElevenLabs key from the existing key file, read only when a claimed call invokes it. */
export function elevenLabsKeyReader(file: string) {
  return () => {
    const line = readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/).find(l => /^\s*(export\s+)?ELEVENLABS_API_KEY\s*=/.test(l));
    const value = line?.replace(/^\s*(export\s+)?ELEVENLABS_API_KEY\s*=\s*/, '').trim().replace(/^(['"])(.*)\1$/, '$2');
    if (!value || /\s/.test(value)) fail('narration_key_missing');
    return value!;
  };
}
/** Exactly one POST of the exact wire. Any unclear charge (no character-cost/request id) is unknown, never a guessed price. */
export function createNarrationTransport(args: { key: () => string; fetch?: typeof fetch; timeoutMs?: number }) {
  return async (wire: NarrationWire, signal: AbortSignal) => {
    narrationWireSchema.parse(wire);
    const receipt: NarrationReceipt = { status: null, characterCost: null, requestId: null, contentType: null, bytes: null, audioSha256: null, estimatedMicroUsd: null };
    const stop = (code: string): never => fail(code, { ...receipt });
    let response: Response;
    try {
      response = await (args.fetch ?? fetch)(wire.url, { method: 'POST', body: JSON.stringify(wire.body),
        headers: { 'xi-api-key': args.key(), 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        signal: AbortSignal.any([signal, AbortSignal.timeout(args.timeoutMs ?? 120_000)]) });
    } catch { return stop('narration_transport'); }
    const cost = response.headers.get('character-cost')?.trim() ?? '';
    receipt.status = response.status; receipt.requestId = response.headers.get('request-id')?.slice(0, 200) ?? null;
    receipt.contentType = response.headers.get('content-type')?.slice(0, 100) ?? null;
    receipt.characterCost = /^\d{1,9}$/.test(cost) ? Number(cost) : null;
    receipt.estimatedMicroUsd = receipt.characterCost === null ? null : narrationCostMicroUsd(wire, receipt.characterCost);
    if (!response.ok) return stop('narration_http');
    if (receipt.characterCost === null) return stop('narration_usage_unknown');
    if (!receipt.requestId) return stop('narration_request_id');
    let audio: Buffer;
    try { audio = Buffer.from(await response.arrayBuffer()); } catch { return stop('narration_body'); }
    receipt.bytes = audio.length; receipt.audioSha256 = sha(audio);
    if (audio.length < 1000 || audio.length > 10_000_000 || !/^audio\/mpeg/.test(receipt.contentType ?? '')) return stop('narration_audio_invalid');
    return { audio, receipt: { ...receipt } };
  };
}
/** Local media check of a saved MP3 (the same probe/decoder pair the earlier narrated reader used): one audio stream, 0 < duration <= 180 s. */
export function probeNarrationAudio(file: string) {
  const load = createRequire(path.resolve(__dirname, '..', 'package.json'));
  const probe = load('@ffprobe-installer/ffprobe').path as string, ffmpeg = load('@ffmpeg-installer/ffmpeg').path as string;
  const measured = JSON.parse(execFileSync(probe, ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', file], { encoding: 'utf8', windowsHide: true, timeout: 30000 }));
  const duration = Number(measured.format?.duration);
  if (measured.streams?.length !== 1 || measured.streams[0].codec_type !== 'audio' || !Number.isFinite(duration) || duration <= 0 || duration > 180) fail('narration_media_invalid');
  execFileSync(ffmpeg, ['-v', 'error', '-nostdin', '-i', file, '-f', 'null', '-'], { windowsHide: true, timeout: 30000 });
  return duration;
}
type Meter = { run<T>(step: string, wire: unknown, maximum: number, dispatch: () => Promise<{ value: T; estimatedMicroUsd: number | null; receipt: unknown }>): Promise<T> };
/** Plan every page before the first call: exact TTS text, wires and reservations within the narration sublimit. */
export function planBookNarration(pages: { pageNumber: number; text: string }[], voice: NarrationVoice, maximumMicroUsd: number) {
  if (!pages.length || pages.some((p, i) => p.pageNumber !== i)) fail('narration_pages');
  const rows = pages.map(p => { const wire = prepareNarrationWire(p.pageNumber, p.text, voice); return { pageNumber: p.pageNumber, text: p.text, wire, reserveMicroUsd: narrationReserveMicroUsd(wire) }; });
  const reserveMicroUsd = rows.reduce((n, r) => n + r.reserveMicroUsd, 0);
  if (reserveMicroUsd > maximumMicroUsd) fail('narration_budget');
  return { version: BOOK_NARRATION.version, voice: { id: voice.id, label: voice.label, elevenlabsVoiceId: voice.elevenlabsVoiceId },
    characters: rows.reduce((n, r) => n + characters(r.wire), 0), reserveMicroUsd, rows };
}
export type BookNarrationPlan = ReturnType<typeof planBookNarration>;
/** Narrate a planned book page by page; each page is one claimed call. Stops at the first failure (no retry); returns what was made. */
export async function narrateBook(o: { plan: BookNarrationPlan; meter: Meter; transport: ReturnType<typeof createNarrationTransport>; guard: () => void;
  outDir: string; signal: AbortSignal; probe?: (file: string) => void; log?: (s: string) => void }) {
  mkdirSync(o.outDir, { recursive: true });
  const made: { pageNumber: number; audioFile: string; audioSha256: string; characters: number; characterCost: number; accountedMicroUsd: number }[] = [];
  for (const row of o.plan.rows) {
    o.guard();
    const reply = await o.meter.run(`narration_p${row.pageNumber}`, row.wire, row.reserveMicroUsd, async () => {
      o.guard(); const r = await o.transport(row.wire, o.signal); return { value: r, estimatedMicroUsd: r.receipt.estimatedMicroUsd, receipt: r.receipt };
    });
    const cost = reply.receipt.characterCost!;
    if (cost > characters(row.wire) * BOOK_NARRATION.reserveFactor) fail('narration_cost_over_reservation');
    const file = path.join(o.outDir, `page-${row.pageNumber}.mp3`);
    writeFileSync(file, reply.audio, { flag: 'wx' });
    if (sha(readFileSync(file)) !== reply.receipt.audioSha256) fail('narration_audio_write');
    o.probe?.(file);
    made.push({ pageNumber: row.pageNumber, audioFile: file, audioSha256: reply.receipt.audioSha256!, characters: characters(row.wire), characterCost: cost,
      accountedMicroUsd: reply.receipt.estimatedMicroUsd! });
    o.log?.(`narration page ${row.pageNumber}: done`);
  }
  return { pages: made, accountedMicroUsd: made.reduce((n, p) => n + p.accountedMicroUsd, 0) };
}
/**
 * The local reader bundle: page-N.png (+ page-N.mp3 when every page is narrated) and a validated manifest. Image-only when narration is
 * absent or incomplete: no silent, partial or reused audio is ever presented as narration.
 */
export function writeLocalReaderBundle(o: { root: string; id: string; title: string; childName: string; sourceSha256: string;
  pages: { pageNumber: number; text: string; imageFile: string }[]; narration: { voice: { id: string; label: string }; pages: { pageNumber: number; audioFile: string }[] } | null }) {
  const id = localReaderId(o.id), dir = path.join(o.root, id);
  if (existsSync(dir)) fail('reader_bundle_exists');
  mkdirSync(dir, { recursive: true });
  const narrated = !!o.narration && o.narration.pages.length === o.pages.length;
  const pages = o.pages.map(p => {
    copyFileSync(p.imageFile, path.join(dir, `page-${p.pageNumber}.png`));
    const audio = narrated ? o.narration!.pages.find(a => a.pageNumber === p.pageNumber) : undefined;
    if (narrated && !audio) fail('reader_bundle_audio');
    if (audio) copyFileSync(audio.audioFile, path.join(dir, `page-${p.pageNumber}.mp3`));
    return { pageNumber: p.pageNumber, text: p.text, imageSha256: sha(readFileSync(path.join(dir, `page-${p.pageNumber}.png`))),
      audioSha256: audio ? sha(readFileSync(path.join(dir, `page-${p.pageNumber}.mp3`))) : null };
  });
  const manifest = localReaderPreviewSchema.parse({ version: narrated ? 'local-narrated-reader/v1' : 'local-image-reader/v1', id, title: o.title, childName: o.childName,
    sourceManifestSha256: o.sourceSha256, sourceQa: 'incomplete', productAccepted: false, productionQualified: false,
    voice: narrated ? { id: o.narration!.voice.id, label: o.narration!.voice.label, provider: 'elevenlabs', model: BOOK_NARRATION.model } : null, pages });
  exclusiveJson(path.join(dir, 'manifest.json'), manifest);
  return { id, directory: dir, narrated, url: `/dev/local-reader?book=${encodeURIComponent(id)}` };
}
