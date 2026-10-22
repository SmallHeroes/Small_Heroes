import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { AuditionMeter, AUDITION_REVIEW_TIMEOUT_MS, AUDITION_TRANSPORT_MARGIN_MS, causeChain, reviewTransport, sendReview }
  from '../../../scripts/personal-simple-book-reviewed-audition';

// The review's ACTUAL transport seam (2026-10-22), provider-free and key-free: the same sendReview the paid judge calls, the installed SDK and
// Node's own fetch, against a LOCAL 127.0.0.1 server that answers late, withholds its answer, stalls its body or cuts the connection.
type Mode = { kind: 'answer'; delayMs: number } | { kind: 'never' } | { kind: 'stall-body' } | { kind: 'reset' };
const answer = { id: 'resp_local', object: 'response', created_at: 0, status: 'completed', model: 'local-probe', output: [] };
let mode: Mode = { kind: 'never' }, requests = 0, base = '';
const held = new Set<http.ServerResponse>(), timers = new Set<NodeJS.Timeout>();
const server = http.createServer((req, res) => {
  requests++; req.resume();
  const m = mode;
  if (m.kind === 'never') { held.add(res); return; }
  if (m.kind === 'reset') { req.socket.destroy(); return; }
  if (m.kind === 'stall-body') { res.writeHead(200, { 'content-type': 'application/json' }); res.write('{"id":"resp_local",'); held.add(res); return; }
  const t = setTimeout(() => { timers.delete(t); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(answer)); }, m.delayMs);
  timers.add(t);
});
beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`;
});
afterAll(async () => {
  for (const t of timers) clearTimeout(t);
  for (const r of held) r.destroy();
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
});
const at = (m: Mode) => { mode = m; requests = 0; };
const payload = { model: 'local-probe', input: 'probe' } as never;
const send = (deadlineMs: number, transport: ReturnType<typeof reviewTransport>, signal = new AbortController().signal) =>
  sendReview(payload, { apiKey: 'sk-local-synthetic-not-a-credential', signal, deadlineMs, baseURL: base, transport });
const timed = async <T>(work: () => Promise<T>) => {
  const start = Date.now();
  try { return { value: await work(), error: null as unknown, ms: Date.now() - start }; } catch (error) { return { value: null, error, ms: Date.now() - start }; }
};
const nameOf = (e: unknown) => (e as Error | null)?.constructor?.name;

describe('the review transport: the same sendReview the paid judge calls, against a real local server', { timeout: 30_000 }, () => {
  it('each call gets its own finite dispatcher above its deadline; Node\'s process-wide one is never replaced; a bad policy refuses before any request', async () => {
    void globalThis.Response;
    const key = Symbol.for('undici.globalDispatcher.1'), before = (globalThis as unknown as Record<symbol, { constructor: { name: string } }>)[key];
    const t = reviewTransport(AUDITION_REVIEW_TIMEOUT_MS);
    expect([AUDITION_REVIEW_TIMEOUT_MS, AUDITION_TRANSPORT_MARGIN_MS]).toEqual([600000, 30000]);
    expect(t.limits).toEqual({ headersTimeoutMs: 630000, bodyTimeoutMs: 630000 });
    expect([t.dispatcher === (before as unknown), before.constructor.name, t.dispatcher.constructor.name]).toEqual([false, 'Agent', 'Agent']);
    await t.release();
    expect((globalThis as unknown as Record<symbol, unknown>)[key]).toBe(before);
    for (const [deadline, margin] of [[0, 1], [1, 0], [1.5, 1], [600000, -5]]) expect(() => reviewTransport(deadline, margin)).toThrow('audition_transport_policy');
    // A transport whose limits do not exceed the call's deadline is refused before anything is sent.
    at({ kind: 'answer', delayMs: 10 });
    const short = reviewTransport(300, 200);
    await expect(send(600, short)).rejects.toThrow('audition_transport_policy');
    expect(requests).toBe(0);
    await short.release();
  });

  it('the dispatcher is the call\'s own: its header limit (not Node\'s 300 s default) ends a withheld answer, and the cause chain names it', async () => {
    at({ kind: 'never' });
    const t = reviewTransport(300, 200);
    const r = await timed(() => t.fetch(`${base}/responses`, { method: 'POST', body: '{}' }));
    await t.release();
    expect([r.ms >= 450, r.ms < 5000, requests]).toEqual([true, true, 1]);
    expect(causeChain({ transportCause: r.error })).toEqual([expect.objectContaining({ class: 'TypeError', message: 'fetch failed' }),
      expect.objectContaining({ code: 'UND_ERR_HEADERS_TIMEOUT' })]);
  });

  it('the call\'s deadline governs (the transport never cuts it earlier); a slow answer inside it is answered', async () => {
    at({ kind: 'never' });
    const t = reviewTransport(800, 2000);
    const r = await timed(() => send(800, t));
    await t.release();
    expect([nameOf(r.error), (r.error as Error).message, r.ms >= 750, r.ms < 2500, requests]).toEqual(['APIConnectionTimeoutError', 'Request timed out.', true, true, 1]);
    // The SDK keeps no cause; the transport's own failure is attached: the deadline aborted the request (not a transport limit).
    expect(causeChain(r.error)[0]).toMatchObject({ message: expect.stringMatching(/abort/i) });
    at({ kind: 'answer', delayMs: 600 });
    const u = reviewTransport(1500, 1000);
    const ok = await timed(() => send(1500, u));
    await u.release();
    expect([ok.error, ok.value?.id, ok.value?.status, requests]).toEqual([null, 'resp_local', 'completed', 1]);
  });

  it('a stalled body ends at the transport\'s finite body limit, with its cause', async () => {
    at({ kind: 'stall-body' });
    const t = reviewTransport(300, 200);
    const r = await timed(async () => (await t.fetch(`${base}/responses`, { method: 'POST', body: '{}' })).text());
    await t.release();
    expect([r.ms < 5000, requests]).toEqual([true, 1]);
    expect(causeChain(r.error)).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'UND_ERR_BODY_TIMEOUT' })]));
  });

  it('no retries: a cut connection is ONE request, and its cause is kept; the caller\'s abort ends the call at once', async () => {
    at({ kind: 'reset' });
    const t = reviewTransport(2000, 1000);
    const r = await timed(() => send(2000, t));
    expect([nameOf(r.error), requests]).toEqual(['APIConnectionError', 1]);
    expect(causeChain(r.error).some(l => /^UND_ERR_SOCKET$|ECONNRESET/.test(l.code ?? ''))).toBe(true);
    await t.release();
    at({ kind: 'never' });
    const long = reviewTransport(5000, 1000), controller = new AbortController(), timer = setTimeout(() => controller.abort(), 200);
    const aborted = await timed(() => send(5000, long, controller.signal));
    clearTimeout(timer); await long.release();
    expect([nameOf(aborted.error), aborted.ms < 2000, requests]).toEqual(['APIUserAbortError', true, 1]);
  });

  it('the meter\'s failure record keeps the layer that ended the call; an error without a cause keeps the old record exactly', async () => {
    const root = path.join(mkdtempSync(path.join(tmpdir(), 'transport-meter-')), 'paid'), meter = new AuditionMeter(root, 7000000, 89, 0);
    const failure = (step: string) => JSON.parse(readFileSync(path.join(root, `${step}.failure.json`), 'utf8'));
    at({ kind: 'never' });
    const cut = reviewTransport(300, 200);
    await expect(meter.run('cut_qa', { a: 1 }, 600, async () => { await cut.fetch(`${base}/responses`, { method: 'POST', body: '{}' }); throw new Error('unreachable'); }))
      .rejects.toThrow('fetch failed');
    await cut.release();
    expect(failure('cut_qa')).toEqual({ code: 'audition_stage_failed', message: 'fetch failed', receipt: null,
      cause: [expect.objectContaining({ class: 'HeadersTimeoutError', code: 'UND_ERR_HEADERS_TIMEOUT' })] });
    const deadline = reviewTransport(500, 1000), fresh = new AuditionMeter(path.join(path.dirname(root), 'paid-2'), 7000000, 89, 0);
    await expect(fresh.run('late_qa', { b: 1 }, 600, async () => { await send(500, deadline); throw new Error('unreachable'); })).rejects.toThrow('Request timed out.');
    await deadline.release();
    const late = JSON.parse(readFileSync(path.join(path.dirname(root), 'paid-2', 'late_qa.failure.json'), 'utf8'));
    expect(late).toMatchObject({ code: 'audition_stage_failed', message: 'Request timed out.', receipt: null, cause: [{ message: expect.stringMatching(/abort/i) }] });
    const plain = new AuditionMeter(path.join(path.dirname(root), 'paid-3'), 7000000, 89, 0);
    await expect(plain.run('plain_qa', { c: 1 }, 600, async () => { throw new Error('plain'); })).rejects.toThrow('plain');
    expect(JSON.parse(readFileSync(path.join(path.dirname(root), 'paid-3', 'plain_qa.failure.json'), 'utf8'))).toEqual({ code: 'audition_stage_failed', message: 'plain', receipt: null });
    expect(readdirSync(path.join(path.dirname(root), 'paid-3')).sort()).toEqual(['plain_qa.claim.json', 'plain_qa.failure.json', 'plain_qa.result.json', 'plain_qa.wire.json']);
  });

  it('a cause chain is bounded (4 links, 200 characters), cycle-safe, and redacts key-like text', () => {
    const deep: Record<string, unknown> = { message: 'top' };
    let link = deep; for (let i = 0; i < 6; i++) { const next: Record<string, unknown> = { message: `level ${i} with sk-abcdefghijkl and Bearer abc.def ${'x'.repeat(300)}` }; link.cause = next; link = next; }
    const chain = causeChain(deep);
    expect(chain).toHaveLength(4);
    expect(chain.every(l => l.message.length <= 200 && !/sk-abcdefghijkl|abc\.def/.test(l.message))).toBe(true);
    const cyclic: Record<string, unknown> = { message: 'a' }; cyclic.cause = { message: 'b', cause: cyclic };
    expect(causeChain({ cause: cyclic }).map(l => l.message)).toEqual(['a', 'b']);
    expect(causeChain(new Error('no cause'))).toEqual([]);
  });
});
