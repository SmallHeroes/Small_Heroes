import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { comparisonModels, comparisonInput, parseComparisonReview, COMPARISON_VERSION, type ComparisonModel } from '../../lib/visual-qa-comparison';
import { previewCheckpoint, previewSha, writePreviewJson } from '../../lib/local-story-preview';

export async function inspectComparison(args: { root: string; step: string; model: ComparisonModel; bytes: Buffer; sha: string; key: string;
  fetcher?: typeof fetch; pause?: () => Promise<void>; reconcileOnly?: boolean; transportMode?: 'official_async';
  calibration?: { mode: 'rubric' | 'examples'; examples: Array<{ bytes: Buffer; sha: string; verdict: 'pass' | 'defect'; explanation: string }> } }) {
  if (!Object.prototype.hasOwnProperty.call(comparisonModels, args.model)) throw Error('comparison_model_not_allowed');
  if (!/^[a-z][a-z0-9-]{0,50}$/.test(args.step)) throw Error('comparison_invalid_step');
  if (previewSha(args.bytes) !== args.sha || !args.bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw Error('comparison_image_binding');
  if (args.transportMode !== undefined && args.transportMode !== 'official_async') throw Error('comparison_invalid_transport');
  for (const e of args.calibration?.examples ?? []) {
    if (previewSha(e.bytes) !== e.sha || !e.bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw Error('comparison_example_binding');
  }
  const model = comparisonModels[args.model], input = comparisonInput(args.model, `data:image/png;base64,${args.bytes.toString('base64')}`,
    args.calibration ? { mode: args.calibration.mode, examples: args.calibration.examples.map(e => ({ image:`data:image/png;base64,${e.bytes.toString('base64')}`, verdict:e.verdict, explanation:e.explanation })) } : undefined);
  const transport = args.fetcher ?? fetch;
  const policy = { version: COMPARISON_VERSION, model, imageSha: args.sha, requestSha: previewSha(JSON.stringify(input)), cancelAfter: '120s',
    ...(args.transportMode ? { transportMode: args.transportMode } : {}) };
  const safeResult = (prediction: any) => {
    // Official endpoints empirically return "hidden". Record that limitation;
    // do not claim a provider-attested deployment snapshot from the requested version.
    if (prediction.model !== model.name || ![model.version, 'hidden'].includes(prediction.version)) throw Error('comparison_provider_model_changed');
    const text = typeof prediction.output === 'string' ? prediction.output : Array.isArray(prediction.output) && prediction.output.every((s: unknown) => typeof s === 'string') ? prediction.output.join('') : '';
    return { id: prediction.id, model: prediction.model, version: prediction.version, status: prediction.status, text, metrics: prediction.metrics ?? null,
      completedAt: prediction.completed_at ?? null };
  };
  if (args.reconcileOnly) {
    const resultFile = path.join(args.root, 'steps', `${args.step}.result.json`);
    if (!fs.existsSync(resultFile)) {
      const claim = JSON.parse(fs.readFileSync(path.join(args.root, 'steps', `${args.step}.claim.json`), 'utf8'));
      if (claim.fingerprint !== previewSha(JSON.stringify(policy))) throw Error('comparison_reconciliation_binding');
      const dispatchFile = path.join(args.root, `${args.step}-dispatch.json`);
      if (!fs.existsSync(dispatchFile)) {
        if (typeof claim.at !== 'string' || !Number.isFinite(Date.parse(claim.at))) throw Error('comparison_claim_time');
        // A POST may return504 after creation. Recover only a unique exact-input
        // match from a complete, time-scoped list; never issue another POST.
        const listed = await transport(`https://api.replicate.com/v1/predictions?created_after=${encodeURIComponent(claim.at)}`, { headers: { Authorization: `Bearer ${args.key}` }, signal: AbortSignal.timeout(25_000) });
        if (!listed.ok) throw Error('comparison_discovery_http');
        const page = await listed.json();
        if (page.next || !Array.isArray(page.results)) throw Error('comparison_discovery_incomplete');
        const matches = page.results.filter((p: any) => p.model === model.name && [model.version, 'hidden'].includes(p.version) &&
          Date.parse(p.created_at) >= Date.parse(claim.at) && Object.entries(input).every(([key, value]) => JSON.stringify(p.input?.[key]) === JSON.stringify(value)));
        if (matches.length !== 1 || !/^[a-z0-9]{8,80}$/.test(matches[0].id)) throw Error('comparison_discovery_not_unique');
        writePreviewJson(dispatchFile, { id: matches[0].id, model, at: new Date().toISOString(), recoveredBy: 'unique_exact_input_time_scoped_get' });
      }
      const dispatch = JSON.parse(fs.readFileSync(dispatchFile, 'utf8'));
      if (claim.fingerprint !== previewSha(JSON.stringify(policy)) || JSON.stringify(dispatch.model) !== JSON.stringify(model) || !/^[a-z0-9]{8,80}$/.test(dispatch.id)) throw Error('comparison_reconciliation_binding');
      const response = await transport(`https://api.replicate.com/v1/predictions/${dispatch.id}`, { headers: { Authorization: `Bearer ${args.key}` }, signal: AbortSignal.timeout(25_000) });
      if (!response.ok) throw Error('comparison_reconciliation_http');
      const prediction = await response.json();
      if (prediction.id !== dispatch.id || !['succeeded','failed','canceled'].includes(prediction.status)) throw Error('comparison_reconciliation_nonterminal');
      writePreviewJson(resultFile, { fingerprint: claim.fingerprint, value: safeResult(prediction), usage: null });
    }
  }
  const record = await previewCheckpoint({ root: args.root, step: args.step, budgetUsd: 3, reserveUsd: 0.25,
    input: policy,
    produce: async () => {
      const request = async (url: string, init: RequestInit = {}) => {
        const response = await transport(url, { ...init, headers: { Authorization: `Bearer ${args.key}`, 'Content-Type': 'application/json', ...init.headers }, signal: AbortSignal.timeout(25_000) });
        if (!response.ok) {
          writePreviewJson(path.join(args.root, `${args.step}-http.json`), { status: response.status, method: init.method ?? 'GET', at: new Date().toISOString() });
          throw Error('comparison_provider_http_error');
        }
        return response.json();
      };
      const asyncMode = args.transportMode === 'official_async';
      let prediction = await request(asyncMode ? `https://api.replicate.com/v1/models/${model.name}/predictions` : 'https://api.replicate.com/v1/predictions',
        { method: 'POST', headers: { 'Cancel-After': '120s', ...(asyncMode ? {} : { Prefer: 'wait=1' }) }, body: JSON.stringify(asyncMode ? { input } : { version: model.version, input }) });
      if (typeof prediction.id !== 'string' || !/^[a-z0-9]{8,80}$/.test(prediction.id)) throw Error('comparison_prediction_id');
      const id = prediction.id;
      // Persist only selected metadata, never provider-echoed inputs, URLs, logs or credentials.
      writePreviewJson(path.join(args.root, `${args.step}-dispatch.json`), { id, model, at: new Date().toISOString() });
      for (let n = 0; n < 48 && ['starting', 'processing'].includes(prediction.status); n++) {
        await (args.pause?.() ?? delay(3000));
        prediction = await request(`https://api.replicate.com/v1/predictions/${id}`);
        if (prediction.id !== id) throw Error('comparison_prediction_identity');
      }
      return { value: safeResult(prediction), usage: null };
    } });
  if (record.value.status !== 'succeeded') throw Error('comparison_provider_not_succeeded');
  // Malformed known output is held, never repaired with another paid call.
  try { return { observed: parseComparisonReview(record.value.text).anatomy.verdict, review: parseComparisonReview(record.value.text), renderAuthorized: false as const }; }
  catch { return { observed: 'unknown' as const, reason: 'invalid_review', renderAuthorized: false as const }; }
}
