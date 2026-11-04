import 'server-only';
import { mkdtemp, writeFile, unlink, rmdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { canonicalHash } from '@/lib/canonical-json';
import { BOOK_NARRATION, BookNarrationError, createNarrationTransport, narrationCostMicroUsd, narrationReserveMicroUsd,
  narrationWireSchema, probeNarrationAudio, type NarrationWire } from '@/scripts/personal-book-narration';
import { authorityDigest, engineOrderAuthoritySchema, engineSiteFail, type EngineOrderAuthority } from './contract';
import { assetBytesSha256 } from './private-assets';
import type { PreparedEngineCall } from './durable-worker';

export type EngineNarrationPorts = { key: () => string; fetch: typeof fetch; probe?: (bytes: Buffer) => Promise<number> };
/** Private, ephemeral file only. Both probe and full decode must succeed; no accepted silent placeholder. */
export async function decodeEngineAudio(bytes: Buffer) {
  const dir = await mkdtemp(join(tmpdir(), 'engine-audio-')), file = join(dir, 'clip.mp3');
  try { await writeFile(file, bytes, { flag: 'wx', mode: 0o600 }); return probeNarrationAudio(file); }
  finally { await unlink(file).catch(() => {}); await rmdir(dir).catch(() => {}); }
}
export function prepareEngineNarration(a: EngineOrderAuthority, input: NarrationWire, ports: EngineNarrationPorts): PreparedEngineCall {
  const authority = engineOrderAuthoritySchema.parse(a), narration = narrationWireSchema.parse(input), step = `narration_${narration.page}`;
  const wire = { version: 'engine-site-narration/v1', authoritySha256: authorityDigest(authority), narration };
  const slot = authority.budget.steps.find(s => s.id === step), reserve = narrationReserveMicroUsd(narration);
  if (!authority.entitlements.narration || !slot || reserve > slot.maximumMicroUsd) engineSiteFail('engine_narration_reservation');
  return { wire, call: { step, wireSha256: canonicalHash(wire), maximumMicroUsd: slot.maximumMicroUsd }, requiredMs: 185_000,
    admitSaved(answer) {
      const raw = answer.raw as any, output = answer.output as any, receipt = raw.receipt;
      if (raw.wireSha256 !== canonicalHash(wire) || !receipt?.requestId || typeof output?.b64 !== 'string' ||
          receipt.audioSha256 !== output.audioSha256 || assetBytesSha256(Buffer.from(output.b64, 'base64')) !== output.audioSha256 ||
          receipt.estimatedMicroUsd !== answer.estimatedMicroUsd || receipt.estimatedMicroUsd !== narrationCostMicroUsd(narration, receipt.characterCost) ||
          receipt.characterCost > narration.body.text.length * BOOK_NARRATION.reserveFactor) engineSiteFail('engine_saved_narration_invalid');
    },
    revalidate() { if (canonicalHash({ ...wire, narration: narrationWireSchema.parse(input) }) !== canonicalHash(wire)) engineSiteFail('engine_narration_wire_changed'); },
    async execute(pending, signal, assertDispatch) {
      if (pending) engineSiteFail('engine_narration_pending_invalid');
      await assertDispatch();
      let receipt: any = null;
      try {
        const result = await createNarrationTransport(ports)(narration, signal); receipt = result.receipt;
        if (receipt.characterCost === null || receipt.characterCost > narration.body.text.length * BOOK_NARRATION.reserveFactor)
          engineSiteFail('engine_narration_usage_over_reservation');
        const duration = await (ports.probe ?? decodeEngineAudio)(result.audio);
        if (!Number.isFinite(duration) || duration <= 0 || duration > 180 || assetBytesSha256(result.audio) !== receipt.audioSha256)
          engineSiteFail('engine_narration_media_invalid');
        return { kind: 'completed', result: { output: { b64: result.audio.toString('base64'), audioSha256: receipt.audioSha256, duration },
          raw: { receipt, wireSha256: canonicalHash(wire) }, estimatedMicroUsd: narrationCostMicroUsd(narration, receipt.characterCost) } };
      } catch (error) {
        if (error instanceof BookNarrationError) receipt = error.receipt;
        return { kind: 'completed', result: { output: null, usable: false, raw: { receipt, failed: true },
          estimatedMicroUsd: typeof receipt?.estimatedMicroUsd === 'number' ? receipt.estimatedMicroUsd : null } };
      }
    } };
}
