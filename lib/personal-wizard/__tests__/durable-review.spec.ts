import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { previewSha } from '../../local-story-preview';
import { canonicalJson } from '../request-acceptance';
import { exclusiveJson } from '../../../scripts/personal-causal-trial-journal';
import { DURABLE_REVIEW_VERSION, DurableReviewJournal, durableReviewJob } from '../../../scripts/personal-durable-review';
import { AuditionMeter, auditionMeterRules, conservativeDebitOf, orphanProvisionOf, orphanProvisionSchema, digestImages, durableReviewPayload, sendReview }
  from '../../../scripts/personal-simple-book-reviewed-audition';
import { auditionUsageCost } from '../../../scripts/personal-simple-book-illustrator';

// Real installed SDK and native sendReview; local HTTP only, no provider/key or assertion of pixel quality.
const payload = { model: 'gpt-6.1-sol', store: false, service_tier: 'default', reasoning: { effort: 'medium' }, instructions: 'synthetic lifecycle only',
  input: [{ role: 'user', content: [{ type: 'input_text', text: 'Synthetic fictional fixture.' }] }], max_output_tokens: 12000,
  text: { format: { type: 'json_object' } } } as unknown as Parameters<typeof sendReview>[0];
type Mode = 'ok' | 'never' | 'drop' | 'expired' | 'wrong-id' | 'wrong-model' | 'wrong-binding' | 'unsupported' | 'failed';
let mode: Mode = 'ok', posts = 0, gets = 0, baseURL = '', lastBody: any, getPaths: string[] = [];
const held = new Set<http.ServerResponse>();
const raw = (status = 'completed') => ({ id: 'resp_synthetic', object: 'response', created_at: 0, status, model: 'gpt-6.1-sol',
  service_tier: 'default', metadata: lastBody?.metadata ?? {}, usage: { input_tokens: 100, output_tokens: 100 },
  output: status === 'completed' ? [{ type: 'message', id: 'msg_fixture', role: 'assistant', status: 'completed',
    content: [{ type: 'output_text', text: '{"synthetic":true}', annotations: [] }] }] : [] });
const server = http.createServer(async (req, res) => {
  let body = ''; for await (const c of req) body += c;
  if (req.method === 'POST') { posts++; lastBody = JSON.parse(body); } else { gets++; getPaths.push(req.url!); }
  if (mode === 'drop' && req.method === 'POST') { req.socket.destroy(); return; }
  if (mode === 'never' && req.method === 'GET') { held.add(res); return; }
  if (mode === 'unsupported' || mode === 'expired' && req.method === 'GET') {
    res.writeHead(mode === 'unsupported' ? 400 : 404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'synthetic unavailable', type: 'invalid_request_error', code: 'synthetic' } })); return;
  }
  let answer: any = raw(req.method === 'POST' ? 'queued' : mode === 'failed' ? 'failed' : gets === 1 ? 'in_progress' : 'completed');
  if (req.method === 'GET') {
    if (mode === 'wrong-id') answer.id = 'resp_other';
    if (mode === 'wrong-model') answer.model = 'unapproved-model';
    if (mode === 'wrong-binding') answer.metadata = { semantic_request_sha256: 'f'.repeat(64) };
  }
  if (req.method === 'POST' && !lastBody.background) answer = raw();
  res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(answer));
});
beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`;
});
afterAll(async () => { for (const r of held) r.destroy(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
const reset = (next: Mode = 'ok') => { mode = next; posts = 0; gets = 0; getPaths = []; lastBody = null; };
const fixture = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'durable-review-')), paid = path.join(dir, 'paid'), step = 'r6_page_1_1_qa';
  const meter = new AuditionMeter(paid, 7000000, 89, 1980874, 0, auditionMeterRules);
  const body = durableReviewPayload(payload), wire = digestImages(body);
  const durable = { directory: path.join(dir, 'job'), claimFile: path.join(paid, `${step}.claim.json`), wireFile: path.join(paid, `${step}.wire.json`), pollMs: 1 };
  const opts = { apiKey: 'sk-local-fixture-not-a-real-key', signal: new AbortController().signal, deadlineMs: 3000, baseURL, durable };
  const read = (kind: string) => JSON.parse(readFileSync(path.join(paid, `${step}.${kind}.json`), 'utf8'));
  const dispatch = async (resume?: true, afterIdCheckpoint?: () => void) => {
    const answer = await sendReview(payload, { ...opts, durable: { ...durable, resume, afterIdCheckpoint } });
    const estimatedMicroUsd = auditionUsageCost(answer.usage, 'sol');
    return { value: answer, estimatedMicroUsd, receipt: { raw: answer, estimatedMicroUsd } };
  };
  return { dir, paid, step, meter, wire, body, durable, opts, read, dispatch };
};
const crash = () => { throw new Error('synthetic_crash_after_fsynced_id'); };

describe('one durable background review, not generation retry authority', { timeout: 20000 }, () => {
  it('claims the actual background wire, saves ID promptly and terminal raw before the normal meter result; one POST and bounded same-ID GETs', async () => {
    reset(); const f = fixture();
    const answer = await f.meter.run(f.step, f.wire, 600000, () => f.dispatch());
    expect([answer.status, answer.output_text, posts, gets]).toEqual(['completed', '{"synthetic":true}', 1, 2]);
    expect(lastBody).toEqual(f.body); expect(lastBody.store).toBe(false);
    expect(getPaths).toEqual(['/v1/responses/resp_synthetic', '/v1/responses/resp_synthetic']);
    const terminal = JSON.parse(readFileSync(path.join(f.durable.directory, 'terminal.json'), 'utf8'));
    expect(terminal.raw).toEqual(f.read('receipt').raw);
    expect(f.meter.snapshot()).toMatchObject({ calls: 1, unknownCost: 0, unknownOutcome: 0, reservedUnsettledMicroUsd: 0 });
    expect(f.read('claim').wireDigest).toBe(previewSha(canonicalJson(f.wire)));
  });
  it('a crash after ID keeps an unknown outcome, not a made-up failed call; GET-only recovery settles the same claim once', async () => {
    reset(); const f = fixture();
    await expect(f.meter.run(f.step, f.wire, 600000, () => f.dispatch(undefined, crash))).rejects.toThrow('synthetic_crash');
    expect([posts, gets, existsSync(path.join(f.paid, `${f.step}.failure.json`))]).toEqual([1, 0, false]);
    expect(f.meter.snapshot()).toMatchObject({ calls: 1, unknownOutcome: 1, reservedUnsettledMicroUsd: 600000, failed: 0 });
    await expect(f.meter.run('r6_page_1_1_identity', {}, 50000, async () => { throw Error('must not dispatch'); })).rejects.toThrow();
    const answer = await f.meter.recover(f.step, f.wire, () => f.dispatch(true));
    expect([answer.id, posts, gets]).toEqual(['resp_synthetic', 1, 2]);
    expect(f.meter.snapshot()).toMatchObject({ calls: 1, unknownOutcome: 0, newKnownApiMicroUsd: auditionUsageCost(answer.usage, 'sol') });
    await expect(f.meter.recover(f.step, f.wire, () => f.dispatch(true))).rejects.toThrow('audition_recovery_binding');
    expect(posts).toBe(1);
  });
  it('terminal raw survives a crash before application settlement; reconciliation needs ZERO additional network calls', async () => {
    reset(); const f = fixture();
    await expect(f.meter.run(f.step, f.wire, 600000, async () => {
      await f.dispatch(); throw Object.assign(new Error('crash_before_settlement'), { durableReviewPending: true });
    })).rejects.toThrow('crash_before_settlement');
    const network = [posts, gets];
    await f.meter.recover(f.step, f.wire, () => f.dispatch(true));
    expect([posts, gets]).toEqual(network);
    expect(f.meter.snapshot()).toMatchObject({ calls: 1, unknownOutcome: 0 });
  });
  it.each(['drop', 'unsupported'] as const)('a create %s leaves started/noID UNKNOWN, with no silent second POST on fresh call or resume', async m => {
    reset(m); const f = fixture();
    await expect(f.meter.run(f.step, f.wire, 600000, () => f.dispatch())).rejects.toThrow();
    expect(f.meter.snapshot()).toMatchObject({ calls: 1, unknownOutcome: 1, failed: 0 });
    await expect(f.dispatch()).rejects.toThrow('durable_review_submission_unknown');
    await expect(f.dispatch(true)).rejects.toThrow('durable_review_submission_unknown');
    expect([posts, gets]).toEqual([1, 0]);
  });
  it.each(['wrong-id', 'wrong-model', 'wrong-binding', 'expired'] as const)('a retrieved %s cannot settle or trigger another generation', async m => {
    reset(); const f = fixture();
    await expect(f.meter.run(f.step, f.wire, 600000, () => f.dispatch(undefined, crash))).rejects.toThrow();
    mode = m;
    await expect(f.meter.recover(f.step, f.wire, () => f.dispatch(true))).rejects.toThrow();
    expect([posts, gets]).toEqual([1, 1]);
    expect(f.meter.snapshot()).toMatchObject({ calls: 1, unknownOutcome: 1, reservedUnsettledMicroUsd: 600000, failed: 0 });
    expect(existsSync(path.join(f.durable.directory, 'terminal.json'))).toBe(false);
  });
  it('claim, actual request and immutable journal all bind; wrong request/claim refuses before any POST', async () => {
    reset(); const f = fixture();
    exclusiveJson(f.durable.wireFile, f.wire);
    exclusiveJson(f.durable.claimFile, { step: f.step, wireDigest: 'e'.repeat(64), maximumMicroUsd: 600000 });
    await expect(f.dispatch()).rejects.toThrow('audition_durable_claim');
    expect([posts, gets, existsSync(f.durable.directory)]).toEqual([0, 0, false]);
  });
  it('a bound job cannot be adopted by another claim or payload', async () => {
    reset(); const f = fixture();
    await expect(f.meter.run(f.step, f.wire, 600000, () => f.dispatch(undefined, crash))).rejects.toThrow();
    const binding = JSON.parse(readFileSync(path.join(f.durable.directory, 'binding.json'), 'utf8'));
    for (const field of ['wireDigest', 'claimSha256', 'bodySha256', 'semanticRequestSha256'])
      expect(() => new DurableReviewJournal(f.durable.directory, { ...binding, [field]: 'f'.repeat(64) })).toThrow('durable_review_binding');
    expect([posts, gets]).toEqual([1, 0]);
  });
  it('a deadline/abort bounds GET polling without cancelling or creating another provider job', async () => {
    reset(); const f = fixture();
    await expect(f.meter.run(f.step, f.wire, 600000, () => f.dispatch(undefined, crash))).rejects.toThrow();
    mode = 'never'; const started = Date.now();
    await expect(sendReview(payload, { ...f.opts, deadlineMs: 120, durable: { ...f.durable, resume: true } })).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(2000);
    expect([posts, gets]).toEqual([1, 1]);
    expect(f.meter.snapshot().unknownOutcome).toBe(1);
  });
  it('a terminal failed provider response is not a successful review; actual usage can settle an actual failed call without forging an orphan failure', async () => {
    reset(); const f = fixture();
    await expect(f.meter.run(f.step, f.wire, 600000, () => f.dispatch(undefined, crash))).rejects.toThrow();
    mode = 'failed';
    await expect(f.meter.recover(f.step, f.wire, async () => {
      const made = await f.dispatch(true); throw Object.assign(new Error('actual_provider_failed'), { receipt: made.receipt });
    })).rejects.toThrow('actual_provider_failed');
    expect(f.meter.snapshot()).toMatchObject({ calls: 1, failed: 1, unknownOutcome: 0, unknownCost: 0 });
    expect(f.read('result').completed).toBe(false); expect(posts).toBe(1);
  });
  it('another unresolved claim prevents reconciliation dispatch', async () => {
    reset(); const f = fixture();
    await expect(f.meter.run(f.step, f.wire, 600000, () => f.dispatch(undefined, crash))).rejects.toThrow();
    exclusiveJson(path.join(f.paid, 'r6_page_2_1_qa.wire.json'), f.wire);
    exclusiveJson(path.join(f.paid, 'r6_page_2_1_qa.claim.json'), { step: 'r6_page_2_1_qa', seq: 1, wireDigest: previewSha(canonicalJson(f.wire)), maximumMicroUsd: 600000 });
    await expect(f.meter.recover(f.step, f.wire, () => f.dispatch(true))).rejects.toThrow('audition_recovery_binding');
    expect([posts, gets]).toEqual([1, 0]);
  });
  it('legacy synchronous wire and one-POST behavior remain unchanged without opt-in', async () => {
    reset(); const answer = await sendReview(payload, { apiKey: 'synthetic-local-only', signal: new AbortController().signal, deadlineMs: 3000, baseURL });
    expect([answer.status, posts, gets, lastBody.background]).toEqual(['completed', 1, 0, undefined]);
    expect(lastBody).toEqual(payload);
  });
  it('a receipt fsynced before a crash is preserved; contradictory receipt bytes cannot be replaced', async () => {
    reset(); const f = fixture(); let made: Awaited<ReturnType<typeof f.dispatch>>;
    await expect(f.meter.run(f.step, f.wire, 600000, async () => {
      made = await f.dispatch(); exclusiveJson(path.join(f.paid, `${f.step}.receipt.json`), made.receipt);
      throw Object.assign(new Error('crash_after_receipt'), { durableReviewPending: true });
    })).rejects.toThrow();
    const before = readFileSync(path.join(f.paid, `${f.step}.receipt.json`));
    await expect(f.meter.recover(f.step, f.wire, async () => ({ ...made!, receipt: { ...made!.receipt, extra: 'not original bytes' } })))
      .rejects.toThrow('audition_recovery_binding');
    await f.meter.recover(f.step, f.wire, () => f.dispatch(true));
    expect(readFileSync(path.join(f.paid, `${f.step}.receipt.json`))).toEqual(before);
    expect([posts, gets, f.meter.snapshot().calls]).toEqual([1, 2, 1]);
  });
  it('a truncated terminal write is not a verdict; the saved ID recovers to an additive record without modifying damaged bytes', async () => {
    reset(); const f = fixture();
    await expect(f.meter.run(f.step, f.wire, 600000, () => f.dispatch(undefined, crash))).rejects.toThrow();
    const damaged = path.join(f.durable.directory, 'terminal.json');
    writeFileSync(damaged, '{"raw":', { flag: 'wx' });
    await f.meter.recover(f.step, f.wire, () => f.dispatch(true));
    expect(readFileSync(damaged, 'utf8')).toBe('{"raw":');
    expect(existsSync(path.join(f.durable.directory, 'terminal-recovered.json'))).toBe(true);
    expect([posts, gets, f.meter.snapshot().unknownOutcome]).toEqual([1, 2, 0]);
  });
  it('well-formed but invalid local fixture terminal data is rejected, not reinterpreted as a fresh verdict', async () => {
    reset(); const f = fixture();
    await expect(f.meter.run(f.step, f.wire, 600000, () => f.dispatch(undefined, crash))).rejects.toThrow();
    writeFileSync(path.join(f.durable.directory, 'terminal.json'), 'null', { flag: 'wx' });
    await expect(f.meter.recover(f.step, f.wire, () => f.dispatch(true))).rejects.toThrow();
    expect([posts, gets, f.meter.snapshot().unknownOutcome]).toEqual([1, 0, 1]);
  });
  it('missing usage is never turned into zero by reconciliation', async () => {
    reset(); const f = fixture();
    await expect(f.meter.run(f.step, f.wire, 600000, () => f.dispatch(undefined, crash))).rejects.toThrow();
    await expect(f.meter.recover(f.step, f.wire, async () => {
      const made = await f.dispatch(true), badRaw = { ...made.value, usage: undefined };
      return { value: badRaw, estimatedMicroUsd: null, receipt: { raw: badRaw, estimatedMicroUsd: null } };
    })).rejects.toThrow('audition_meter_cost');
    expect(f.meter.snapshot()).toMatchObject({ unknownOutcome: 1, reservedUnsettledMicroUsd: 600000 });
    expect(posts).toBe(1);
  });
  it('bad policy / unclaimed resume refuse without invoking create or treating evidence as a PASS', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'durable-policy-')), binding = { version: DURABLE_REVIEW_VERSION, wireDigest: 'a'.repeat(64),
      claimSha256: 'b'.repeat(64), bodySha256: 'c'.repeat(64), semanticRequestSha256: 'd'.repeat(64), model: 'gpt-6.1-sol', retention: 'background-store-false-temporary' as const };
    const journal = new DurableReviewJournal(path.join(root, 'job'), binding); let calls = 0;
    const args = { journal, signal: new AbortController().signal, deadlineMs: 1000, create: async () => { calls++; return raw(); }, retrieve: async () => { calls++; return raw(); } };
    await expect(durableReviewJob({ ...args, deadlineMs: 600001 })).rejects.toThrow('durable_review_policy');
    await expect(durableReviewJob({ ...args, resume: true })).rejects.toThrow('durable_review_submission_unknown');
    expect(calls).toBe(0); expect(readdirSync(journal.directory)).toEqual(['binding.json']);
  });
  it('an explicit orphan provision replaces its reservation without inventing outcome/cost or resetting a claim; the next unknown still stops', async () => {
    reset(); const f = fixture();
    await expect(f.meter.run(f.step, f.wire, 600000, async () => { throw Object.assign(new Error('local_crash'), { durableReviewPending: true }); })).rejects.toThrow();
    const before = f.meter.snapshot(), provision = orphanProvisionOf(f.paid, f.step);
    expect(() => conservativeDebitOf(f.paid, f.step)).toThrow('audition_meter_debit');
    const meter = new AuditionMeter(f.paid, 7000000, 89, 1980874, 0, auditionMeterRules, [], [provision]);
    expect(meter.snapshot()).toMatchObject({ calls: 1, newKnownApiMicroUsd: 0, reservedUnsettledMicroUsd: 0, orphanProvisionMicroUsd: 600000,
      actualOutcomeUnknownCalls: 1, actualChargeUnknownCalls: 1, cumulativeAccountedMicroUsd: before.cumulativeAccountedMicroUsd });
    const next = 'r6_page_2_1_qa';
    await expect(meter.run(next, f.wire, 600000, async () => { throw Object.assign(new Error('another_crash'), { durableReviewPending: true }); })).rejects.toThrow();
    expect(meter.snapshot()).toMatchObject({ calls: 2, unknownOutcome: 1, actualOutcomeUnknownCalls: 1, reservedUnsettledMicroUsd: 600000 });
    await expect(meter.run('r6_page_3_1_qa', f.wire, 600000, async () => { throw Error('must not dispatch'); })).rejects.toThrow('audition_unknown_cost');
    expect([posts, gets]).toEqual([0, 0]);
  });
  it('orphan provisions require exact original bytes, full reservation and ONE still-unknown call; no fake failure or late receipt', async () => {
    reset(); const f = fixture();
    await expect(f.meter.run(f.step, f.wire, 600000, async () => { throw Object.assign(new Error('local_crash'), { durableReviewPending: true }); })).rejects.toThrow();
    const provision = orphanProvisionOf(f.paid, f.step);
    expect(orphanProvisionSchema.safeParse({ ...provision, provisionMicroUsd: 1 }).success).toBe(false);
    expect(() => new AuditionMeter(f.paid, 7000000, 89, 0, 0, auditionMeterRules, [], [provision, provision])).toThrow('audition_orphan_provision');
    const meter = new AuditionMeter(f.paid, 7000000, 89, 0, 0, auditionMeterRules, [], [{ ...provision, claimSha256: 'f'.repeat(64) }]);
    expect(() => meter.snapshot()).toThrow('audition_orphan_provision');
    exclusiveJson(path.join(f.paid, `${f.step}.receipt.json`), { raw: 'late unbound evidence' });
    expect(() => orphanProvisionOf(f.paid, f.step)).toThrow('audition_orphan_provision');
  });
});
