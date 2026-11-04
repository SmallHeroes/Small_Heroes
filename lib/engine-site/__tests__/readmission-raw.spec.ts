import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { canonicalHash } from '@/lib/canonical-json';
import { QUALITY_CATEGORIES } from '@/lib/local-preview-quality';
import { assessAuditionReview } from '@/lib/personal-wizard/simple-book-reviewed-audition';
import { narrationVoice, prepareNarrationWire, narrationCostMicroUsd } from '@/scripts/personal-book-narration';
import { auditionUsageCost } from '@/scripts/personal-simple-book-illustrator';
import { planPageChildResemblanceVisionRequest, evaluatePageChildResemblanceVision } from '@/lib/generation-pipeline/page-child-resemblance-vision';
// Only producer reconstruction is replaced. The real admission function below loads actual private bytes,
// claims/settlements, parses raw reviews, replays identity and admits all nine narration wires.
vi.mock('@/lib/engine-site/native-recipe', () => ({ createEngineNativeRecipe: () => async (r: any) => {
  await r.save('native_book', await r.load('native_book'));
} }));
import { admitEngineBookEvidence } from '../readmission';
import { engineTestDb } from './engine-test-db';
import { startEnginePersonalJob } from '../personal-jobs';
import { syntheticEngineActivationEnv } from './synthetic-order';
import { parseEngineCheckpoint, type EngineProviderResult } from '../durable-worker';
import { persistEnginePrivateAsset, assetBytesSha256 } from '../private-assets';
import { reserveEngineCall, settleEngineCall } from '../order-meter';
import { prepareEngineNarration } from '../narration';
const stores: Awaited<ReturnType<typeof engineTestDb>>[] = [];
afterEach(async () => { for (const s of stores.splice(0)) await s.pg.close(); });
async function fixture(blocked: boolean | 'citation', whitespace: boolean) {
  const s = await engineTestDb(); stores.push(s); await startEnginePersonalJob(s.db, 'synthetic_order', JSON.parse(syntheticEngineActivationEnv().ENGINE_SITE_SPEND_POLICY!));
  const cp = parseEngineCheckpoint((await s.db.generationJob.findUnique({ where: { orderId: 'synthetic_order' } }))!.pipelineCache);
  const objects = new Map<string, Buffer>(), storage = { put: async (k: string,b: Buffer) => { objects.set(k,b); }, read: async (k: string) => objects.get(k)!, sign: async () => '' };
  const save = async (value: unknown) => (await persistEnginePrivateAsset(s.db, storage, { ownerId: cp.ownerId, draftId: cp.draftId,
    orderId: 'synthetic_order', kind: 'receipt', contentType: 'application/json' }, Buffer.from(JSON.stringify(value)))).assetId;
  const record = async (step: string, result: EngineProviderResult, wire: unknown = { step }) => {
    const wireSha256 = canonicalHash(wire), call = { step, wireSha256, maximumMicroUsd: cp.authority.budget.steps.find(s => s.id === step)!.maximumMicroUsd };
    await reserveEngineCall(s.db, { authority: cp.authority, call });
    const saved = { wireSha256, completed: true, result }, id = await save(saved);
    await settleEngineCall(s.db, { authority: cp.authority, step, wireSha256, receiptSha256: canonicalHash(saved), completed: true, estimatedMicroUsd: result.estimatedMicroUsd, privateResultAssetId: id });
    cp.calls[step] = { wireSha256, requestAssetId: await save({ authoritySha256: canonicalHash(cp.authority), call, wire }), resultAssetId: id, settled: true, polls: 0, deadlineAt: Date.now() + 60_000 };
  };
  const png = Buffer.from('synthetic exact image bytes'), imageSha = assetBytesSha256(png), b64 = png.toString('base64'), childUrl = `data:image/png;base64,${b64}`;
  const text = 'סיפור סינתטי בלבד.', texts = Array(9).fill(text), pages: any[] = [], bookPages: any[] = [];
  const voice = narrationVoice(s.prepared.snapshot.request.bookOptions.voiceId!, s.prepared.snapshot.options.voices.map(v => v.id));
  const identityRaw = { model: 'gpt-4o', usage: { prompt_tokens: 100, completion_tokens: 100 }, choices: [{ message: { content: JSON.stringify({
    referenceChildVisible: true, candidateChildVisible: true, candidateChildCount: 1, comparisonUsable: true, sameChildDecision: 'same',
    faceStructure: 'match', eyesBrows: 'match', noseMouth: 'match', hairIdentity: 'match', distinctiveFeatures: 'match' }) } }] };
  const measured = await evaluatePageChildResemblanceVision({ referenceImageUrl: childUrl, candidateImageUrl: childUrl, model: 'gpt-4o', threshold: 0.70,
    maxRetries: 0, apiKey: 'SYNTHETIC_REPLAY', fetchImpl: async () => new Response(JSON.stringify(identityRaw)) });
  for (let n=0;n<9;n++) {
    const attempts: any[] = [];
    for (let a=0;a<(blocked && n===0 ? 2 : 1);a++) {
      const step = `page_${n}_${a}`, excluded = blocked && n===0 && a===0;
      const rawReview = { candidateSha: imageSha, contextSha: canonicalHash(n), landmarkInventory: { objects: [], landmarks: [] },
        checks: QUALITY_CATEGORIES.map(category => ({ category, verdict: excluded && category === (blocked === 'citation' ? 'identity' : 'safety') ? 'defect' : 'pass',
          observation: whitespace ? ' pose ok ' : 'pose ok', correction: excluded ? 'Correct the marked synthetic issue' : '', issues: excluded && category === (blocked === 'citation' ? 'identity' : 'safety')
            ? [{ impact: blocked === 'citation' ? 'identity' : 'safety', requirement: 'unknown_requirement', note: 'Synthetic excluded first attempt' }] : [] })) };
      const { review, assessment } = assessAuditionReview(rawReview, imageSha, canonicalHash(n), [], []);
      const attempt = { candidate: { imageName: `${step}.png`, imageSha }, review, assessment,
        ...(excluded ? {} : { identity: measured }) }; attempts.push(attempt);
      const usage = { input_tokens: 100, output_tokens: 100 };
      await record(step, { usable: true, model: 'gpt-image-2', output: { b64, imageSha }, raw: { data: [{ b64_json: b64 }], usage }, estimatedMicroUsd: auditionUsageCost(usage, 'image') });
      await record(`${step}_qa`, { usable: true, output: rawReview, raw: { model: 'gpt-6.1-sol', service_tier: 'default', status: 'completed', output_text: JSON.stringify(rawReview), usage }, estimatedMicroUsd: auditionUsageCost(usage, 'sol') }, { version: 'engine-site-responses/v1', body: { input: [{ content: [{ type: 'input_text', text: JSON.stringify({ candidateSha: imageSha, contextSha: canonicalHash(n), context: {} }) }] }] } });
      if (!excluded) {
        const wire = { version: 'engine-site-identity/v1', step: `${step}_identity`, authoritySha256: canonicalHash(cp.authority), body: planPageChildResemblanceVisionRequest(childUrl, childUrl, 'gpt-4o'), maxRetries: 0 };
        await record(`${step}_identity`, { usable: true, raw: identityRaw, output: measured, estimatedMicroUsd: auditionUsageCost(usage, 'identity') }, wire);
      }
    }
    pages.push({ pageNumber: n, context: {}, contextSha: canonicalHash(n), attempts, chosen: attempts[attempts.length - 1] });
    const plan = prepareEngineNarration(cp.authority, prepareNarrationWire(n, texts[n], voice), { key: () => { throw Error('forbidden'); }, fetch: async () => { throw Error('forbidden'); } });
    const audio = Buffer.from('synthetic admitted audio bytes'), audioSha256 = assetBytesSha256(audio), characters = (plan.wire as any).narration.body.text.length;
    const cost = narrationCostMicroUsd((plan.wire as any).narration, characters);
    await record(`narration_${n}`, { output: { b64: audio.toString('base64'), audioSha256 }, raw: { wireSha256: canonicalHash(plan.wire),
      receipt: { requestId: `synthetic_${n}`, audioSha256, characterCost: characters, estimatedMicroUsd: cost } }, estimatedMicroUsd: cost }, plan.wire);
    bookPages.push({ text, image: { sha256: imageSha }, audio: { sha256: audioSha256 } });
  }
  cp.outputs.native_book = await save({ pages }); cp.outputs.prepared_source = await save({ childB64: b64, source: { manuscript: { title: text, pages: texts.slice(1).map(text => ({text})) } } });
  return { ...s, cp, storage, context: { order: { id: 'synthetic_order' }, checkpoint: cp, snapshot: s.prepared.snapshot, book: { title: text, voiceId: voice.id, pages: bookPages } } as any };
}
describe('Q5/Q11 actual raw-evidence admission (producer/compiler boundary isolated)', () => {
  it('Q5 admits the same schema-parsed whitespace review saved by the engine', async () => {
    const s = await fixture(false,true); await expect(admitEngineBookEvidence(s.db, s.storage, s.context)).resolves.toHaveLength(9);
  },120_000);
  it.each([true,'citation'] as const)('Q11 skips identity only for a re-derived safety-blocked/miscited attempt %s; chosen attempts retain identity', async excluded => {
    const s = await fixture(excluded,false); await expect(admitEngineBookEvidence(s.db, s.storage, s.context)).resolves.toHaveLength(9);
  },120_000);
});
