import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { canonicalHash } from '@/lib/canonical-json';
import { auditionPageReviewSchemaForContext,assessAuditionReview,auditionAnatomyCast,auditionLandmarkTopology,auditionInstanceDistinction } from '@/lib/personal-wizard/simple-book-reviewed-audition';
import { companionScaleFromContext } from '@/lib/personal-wizard/companion-scale';
import type { SavedPage } from '@/lib/personal-wizard/simple-book-reviewed-audition';
import { engineSiteFail } from './contract';
import { enginePictureBookReview } from './current-engine-policy';
import { createEngineNativeRecipe } from './native-recipe';
import type { EngineRuntime, EngineProviderResult } from './durable-worker';
import { loadEnginePrivateAsset, readEnginePrivateBytes } from './private-assets';
import { readEngineCallResult } from './order-meter';
import type { EnginePrivateStorage } from './private-storage';
import type { EngineReaderContext } from './reader';
import { engineResponseText } from './provider-plans';
import { auditionUsageCost } from '@/scripts/personal-simple-book-illustrator';
import { evaluatePageChildResemblanceVision, planPageChildResemblanceVisionRequest, PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD } from '@/lib/generation-pipeline/page-child-resemblance-vision';
import { prepareEngineNarration } from './narration';
import { narrationVoice, prepareNarrationWire } from '@/scripts/personal-book-narration';
import { assetBytesSha256 } from './private-assets';
import type {AdmittedEngineInitialPreparation} from './story-preparation';
import type {AdmittedEngineChildBindingPreparation} from './local-trial-child-binding';
import type {AdmittedEngineLocationRepairPreparation} from './local-trial-location-repair';
import type {AdmittedEngineLocationV2RepairPreparation} from './local-trial-location-repair-v2';
import {checkLocalEntitiesPreparation,localEntitiesPreparedSource,localSettledMedia, localMediaRecovery,type LocalEntitiesPreparation} from './local-current-entities';

/** Rebuild the entire producer through its real compilers, raw saved provider answers and native resume gates.
 * No grant, lease, provider execute(), key, mutation or replacement answer is available in this runtime. */
export async function admitEngineBookEvidence(db: PrismaClient, storage: EnginePrivateStorage, context: EngineReaderContext) {
  const checkpoint = context.checkpoint;
  const readJson = async (id: string) => {
    const asset = await loadEnginePrivateAsset(db, id);
    if (asset.kind !== 'receipt' || asset.orderId !== context.order.id || asset.ownerId !== checkpoint.ownerId || asset.draftId !== checkpoint.draftId)
      engineSiteFail('engine_readmission_asset_changed');
    return JSON.parse((await readEnginePrivateBytes(storage, asset)).toString('utf8'));
  };
  const result = async (step: string): Promise<EngineProviderResult> => {
    const r = await readEngineCallResult(db, checkpoint.authority, step), c = checkpoint.calls[step];
    if (!r?.completed || r.estimatedMicroUsd === null || !r.privateResultAssetId || !c?.settled || c.wireSha256 !== r.wireSha256)
      engineSiteFail('engine_readmission_call_missing');
    const saved = await readJson(r.privateResultAssetId);
    if (canonicalHash(saved) !== r.receiptSha256 || saved.wireSha256 !== r.wireSha256 || !saved.completed ||
        saved.result.estimatedMicroUsd !== r.estimatedMicroUsd) engineSiteFail('engine_readmission_receipt_changed');
    return saved.result;
  };
  return replayEngineRecordedBook(context, { readJson, result }, { db, storage });
}

/** The same provider-free producer/raw-review/identity/narration replay for private DB books and
 * explicit local test journals. It neither grants a paid Order nor substitutes a database privacy check. */
export async function replayEngineRecordedBook(context: Pick<EngineReaderContext, 'checkpoint' | 'snapshot' | 'book'>,
  evidence: { readJson: (id: string) => Promise<any>; result: (step: string) => Promise<EngineProviderResult> },
  privatePhoto?: { db: PrismaClient; storage: EnginePrivateStorage },initialPreparation?:AdmittedEngineInitialPreparation,childBindingPreparation?:AdmittedEngineChildBindingPreparation,locationsRepairPreparation?:AdmittedEngineLocationRepairPreparation,locationsV2RepairPreparation?:AdmittedEngineLocationV2RepairPreparation,entitiesContinuation?:LocalEntitiesPreparation) {
  const checkpoint = structuredClone(context.checkpoint); checkpoint.phase = entitiesContinuation ? 'native' : 'story';
  const denied = (): never => engineSiteFail('engine_readmission_dispatch_forbidden');
  if (!privatePhoto && context.snapshot.appearance.kind !== 'description') engineSiteFail('engine_readmission_private_photo_required');
  const db = privatePhoto?.db ?? new Proxy({}, { get: denied }) as PrismaClient;
  const storage = privatePhoto?.storage ?? { put: denied, read: denied, sign: denied };
  const { readJson, result } = evidence, cached = new Map<string, unknown>();
  const load = async (name: string) => {
    if (cached.has(name)) return cached.get(name);
    const value = checkpoint.outputs[name] ? await readJson(checkpoint.outputs[name]) : null; cached.set(name, value); return value;
  };
  if(entitiesContinuation){
    if(privatePhoto||initialPreparation||childBindingPreparation||locationsRepairPreparation||locationsV2RepairPreparation)
      engineSiteFail('local_entities_readmission_scope');
    checkLocalEntitiesPreparation(entitiesContinuation);
    const prepared=await load('prepared_source');
    if(!prepared)engineSiteFail('engine_readmission_source_missing');
    localEntitiesPreparedSource(entitiesContinuation,checkpoint,context.snapshot,prepared);
  }
  let final: SavedPage[] | null = null;
  const runtime: EngineRuntime = {
    checkpoint, signal: new AbortController().signal, check() {}, result,
    load: name => name === 'prepared_source' && !entitiesContinuation ? Promise.resolve(null) : load(name),
    async call(plan) {
      plan.revalidate?.(); const c = checkpoint.calls[plan.call.step];
      if (!plan.admitSaved || canonicalHash(plan.wire) !== plan.call.wireSha256 || c?.wireSha256 !== plan.call.wireSha256)
        engineSiteFail('engine_readmission_wire_changed');
      const answer = await result(plan.call.step); await plan.admitSaved(answer); return answer;
    },
    async save(name, value) {
      if (name === 'native_book') {
        const book = value as { pages: SavedPage[] }, prior = await load(name) as { pages: SavedPage[] } | null;
        if (!prior || canonicalHash(book.pages) !== canonicalHash(prior.pages)) engineSiteFail('engine_readmission_native_changed');
        final = book.pages; return;
      }
      const prior = await load(name);
      if (prior !== null && canonicalHash(value) !== canonicalHash(prior)) engineSiteFail('engine_readmission_output_changed');
      if (name === 'prepared_source' && prior === null) engineSiteFail('engine_readmission_source_missing');
    },
    async advance(phase) { checkpoint.phase = phase; },
  };
  await createEngineNativeRecipe({ db, storage, snapshot: context.snapshot,initialPreparation,childBindingPreparation,locationsRepairPreparation,locationsV2RepairPreparation,
    ...(entitiesContinuation&&entitiesContinuation.boundary!=='entities'?{currentLocationsRepair:entitiesContinuation}:{}),
    ports: { fetch: denied, openAIKey: denied, anthropicKey: denied, image: denied } })(runtime);
  if (!final || (final as SavedPage[]).length !== 9) engineSiteFail('engine_readmission_incomplete');
  const prepared = await load('prepared_source') as any, childUrl = `data:image/png;base64,${prepared.childB64}`;
  const texts = [prepared.source.manuscript.title, ...prepared.source.manuscript.pages.map((p: any) => p.text)];
  const voice = narrationVoice(context.snapshot.request.bookOptions.voiceId, context.snapshot.options.voices.map(v => v.id));
  if (context.book.voiceId !== voice.id || context.book.title !== texts[0]) engineSiteFail('engine_readmission_text_changed');
  for (const page of final as SavedPage[]) {
    if (context.book.pages[page.pageNumber].text !== texts[page.pageNumber] || context.book.pages[page.pageNumber].image.sha256 !== page.chosen.candidate.imageSha)
      engineSiteFail('engine_readmission_reader_changed');
    for (const attempt of page.attempts) {
      if (!attempt.candidate) engineSiteFail('engine_readmission_missing_candidate');
      const step = attempt.candidate.imageName.replace(/\.png$/, '');
      const edit = entitiesContinuation ? localMediaRecovery(entitiesContinuation)?.edit : undefined;
      if (!(new RegExp(`^page_${page.pageNumber}_[0-2]$`)).test(step) &&
          !(edit?.page === page.pageNumber && step === `page_${page.pageNumber}_3`)) engineSiteFail('engine_readmission_frame_changed');
      const archived = (step:string) => entitiesContinuation ? localSettledMedia(entitiesContinuation,checkpoint,step) : null;
      const image = archived(step)?.result ?? await result(step), rawImage = image.raw as any, output = image.output as any;
      if (!image.usable || image.model !== (checkpoint.authority.imageModelPolicy?.model ?? 'gpt-image-2') || typeof rawImage.data?.[0]?.b64_json !== 'string' ||
          rawImage.data[0].b64_json !== output.b64 || assetBytesSha256(Buffer.from(output.b64, 'base64')) !== attempt.candidate.imageSha ||
          auditionUsageCost(rawImage.usage, 'image') !== image.estimatedMicroUsd) engineSiteFail('engine_readmission_image_changed');
      const qaStep = `${step}_${attempt.reviewReask ? 'qa2' : 'qa'}`;
      const oldQa = archived(qaStep);
      const qa = oldQa?.result ?? await result(qaStep), rawQa = qa.raw as any;
      const claim = checkpoint.calls[qaStep], request = oldQa?.request ?? await readJson(claim.requestAssetId);
      const expectedReviewWire = oldQa ? oldQa.request.call.wireSha256 : claim.wireSha256;
      if ((!oldQa && request.authoritySha256 !== canonicalHash(checkpoint.authority)) || request.call?.step !== qaStep ||
          canonicalHash(request.wire) !== expectedReviewWire || request.call.wireSha256 !== expectedReviewWire)
        engineSiteFail('engine_readmission_review_wire_changed');
      const content = request.wire?.body?.input?.[0]?.content;
      let judged: any;
      try { judged = JSON.parse(content.find((part: any) => part.type === 'input_text').text); }
      catch { engineSiteFail('engine_readmission_review_wire_changed'); }
      if (judged.contextSha !== page.contextSha || judged.candidateSha !== attempt.candidate.imageSha)
        engineSiteFail('engine_readmission_review_wire_changed');
      const reviewSchema = auditionPageReviewSchemaForContext(judged.context);
      let parsedRaw: unknown, parsedOutput: unknown;
      try { parsedRaw = reviewSchema.parse(JSON.parse(engineResponseText(rawQa))); parsedOutput = reviewSchema.parse(qa.output); }
      catch { engineSiteFail('engine_readmission_review_changed'); }
      if (!qa.usable || rawQa.model !== 'gpt-6.1-sol' || rawQa.service_tier !== 'default' || rawQa.status !== 'completed' ||
          canonicalHash(parsedRaw) !== canonicalHash(attempt.review) ||
          canonicalHash(parsedOutput) !== canonicalHash(attempt.review) || auditionUsageCost(rawQa.usage, 'sol') !== qa.estimatedMicroUsd)
        engineSiteFail('engine_readmission_review_changed');
      let assessment:ReturnType<typeof assessAuditionReview>['assessment'];
      try {assessment=assessAuditionReview(parsedRaw,attempt.candidate.imageSha,judged.contextSha,judged.context.requirementIds??[],
        judged.context.checks?.uniqueLandmarks??[],auditionLandmarkTopology(judged.context),auditionAnatomyCast(judged.context),
        auditionInstanceDistinction(judged.context),companionScaleFromContext(judged.context),
        enginePictureBookReview(checkpoint.authority)).assessment;}
      catch{engineSiteFail('engine_readmission_assessment_changed');}
      if(canonicalHash(assessment)!==canonicalHash(attempt.assessment))engineSiteFail('engine_readmission_assessment_changed');
      if (attempt.status === 'identity_unusable') engineSiteFail('engine_readmission_identity_changed');
      if (assessment.safetyBlocked || assessment.invalidCitations) continue;
      const identityStep = `${step}_identity`, oldIdentity = archived(identityStep);
      const measured = oldIdentity?.result ?? await result(identityStep), raw = measured.raw as any;
      const candidateUrl = `data:image/png;base64,${output.b64}`;
      const body = planPageChildResemblanceVisionRequest(childUrl, candidateUrl, 'gpt-4o');
      const wire = { version: 'engine-site-identity/v1', step: identityStep,
        authoritySha256: oldIdentity?.request.authoritySha256 ?? canonicalHash(checkpoint.authority), body, maxRetries: 0 };
      if (canonicalHash(wire) !== (oldIdentity?.request.call.wireSha256 ?? checkpoint.calls[identityStep].wireSha256))
        engineSiteFail('engine_readmission_identity_wire_changed');
      const projected = await evaluatePageChildResemblanceVision({ referenceImageUrl: childUrl, candidateImageUrl: candidateUrl, threshold: PAGE_CHILD_RESEMBLANCE_MIN_THRESHOLD,
        model: 'gpt-4o', maxRetries: 0, apiKey: 'SAVED_RESPONSE_REPLAY', fetchImpl: async () => new Response(JSON.stringify(raw), { status: 200 }) });
      if (!measured.usable || canonicalHash(projected) !== canonicalHash(attempt.identity) || canonicalHash(projected) !== canonicalHash(measured.output) ||
          auditionUsageCost({ input_tokens: raw.usage?.prompt_tokens, output_tokens: raw.usage?.completion_tokens }, 'identity') !== measured.estimatedMicroUsd)
        engineSiteFail('engine_readmission_identity_changed');
    }
    const narration = prepareEngineNarration(checkpoint.authority, prepareNarrationWire(page.pageNumber, texts[page.pageNumber], voice), { key: denied, fetch: denied });
    const answer = await runtime.call(narration), output = answer.output as any;
    if (output.audioSha256 !== context.book.pages[page.pageNumber].audio.sha256) engineSiteFail('engine_readmission_audio_changed');
  }
  return final as SavedPage[];
}
