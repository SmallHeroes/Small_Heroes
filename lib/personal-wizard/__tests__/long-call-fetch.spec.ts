import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import OpenAI from 'openai';
import { longCallFetch, providerFailureCause, LongCallTransportError } from '../../../scripts/personal-long-call-fetch';

/**
 * The real OpenAI SDK through the long-call transport against a loopback server that answers late (scaled seconds; no provider, no key,
 * no network beyond 127.0.0.1). Each case counts the requests the server saw and whether their sockets were closed.
 */
type Plan = { headersAfterMs?: number; bodyStallMs?: number; destroy?: boolean };
const servers: http.Server[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(s => new Promise(r => { s.closeAllConnections?.(); s.close(() => r(null)); }))); });
async function server(plan: Plan) {
  const seen = { requests: 0, closed: 0, bodies: [] as string[], connection: [] as (string | undefined)[] };
  const s = http.createServer((req, res) => {
    seen.requests++; seen.connection.push(req.headers.connection);
    let body = ''; req.on('data', c => { body += c; }); req.on('end', () => seen.bodies.push(body));
    res.on('close', () => { seen.closed++; });
    if (plan.destroy) { setTimeout(() => req.socket.destroy(), 50); return; }
    setTimeout(() => {
      if (res.destroyed) return;
      const json = JSON.stringify({ id: 'resp_local', object: 'response', created_at: 0, model: 'gpt-6-astra', status: 'completed', service_tier: 'default',
        output: [{ id: 'msg_1', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: '{"ok":true}', annotations: [] }] }],
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } });
      res.writeHead(200, { 'content-type': 'application/json' });
      if (plan.bodyStallMs) { res.write(json.slice(0, 20)); setTimeout(() => { if (!res.destroyed) res.end(json.slice(20)); }, plan.bodyStallMs); }
      else res.end(json);
    }, plan.headersAfterMs ?? 0);
  });
  servers.push(s);
  await new Promise<void>(r => s.listen(0, '127.0.0.1', () => r()));
  return { url: `http://127.0.0.1:${(s.address() as AddressInfo).port}/v1`, seen };
}
const client = (baseURL: string, backstopMs: number) => new OpenAI({ apiKey: 'synthetic-local-not-a-key', baseURL, maxRetries: 0, logLevel: 'off',
  fetch: longCallFetch(backstopMs) });
const call = (c: OpenAI, timeout: number, signal?: AbortSignal) =>
  c.responses.create({ model: 'gpt-6-astra', input: 'x', max_output_tokens: 10 } as never, { timeout, ...(signal ? { signal } : {}) });
const settle = () => new Promise(r => setTimeout(r, 150));

describe('long-call transport through the real OpenAI SDK (loopback, scaled time)', () => {
  it('a late answer within the call deadline succeeds: one request, its body sent, the socket then closed', async () => {
    const s = await server({ headersAfterMs: 1500 });
    const response = await call(client(s.url, 30000), 10000);
    expect(response.output_text).toBe('{"ok":true}');
    await settle();
    expect(s.seen).toMatchObject({ requests: 1, closed: 1 });
    expect(JSON.parse(s.seen.bodies[0])).toMatchObject({ model: 'gpt-6-astra', max_output_tokens: 10 });
    // One connection per call: never kept for another request.
    expect(s.seen.connection).toEqual(['close']);
  });
  it('a call whose signal is already aborted sends nothing', async () => {
    const s = await server({});
    const error = await longCallFetch(5000)(`${s.url}/responses`, { method: 'POST', body: '{}', signal: AbortSignal.abort() }).catch(e => e);
    expect(error).toMatchObject({ name: 'AbortError', code: 'long_call_aborted', failure: { phase: 'headers' } });
    await settle();
    expect(s.seen.requests).toBe(0);
  });
  it('a failure cause is bounded and keeps only the names and codes of its low-level chain', () => {
    const deep = Object.assign(new Error('socket hang up sk-should-not-appear'), { code: 'ECONNRESET' });
    const error = Object.assign(new Error('x'.repeat(500)), { status: 502, cause: Object.assign(new TypeError('fetch failed'), { cause: deep }) });
    const cause = providerFailureCause(error);
    expect(cause).toMatchObject({ sdkError: 'Error', status: 502, transport: null,
      lowLevel: [{ name: 'TypeError', code: null }, { name: 'Error', code: 'ECONNRESET' }] });
    expect(cause.message).toHaveLength(160);
    expect(JSON.stringify(cause)).not.toContain('sk-should-not-appear');
  });
  it('the call deadline (SDK timeout) governs: it times out once, with no retry, the socket is closed, and the cause is observed', async () => {
    const s = await server({ headersAfterMs: 3000 }), observed: unknown[] = [];
    const c = new OpenAI({ apiKey: 'synthetic-local-not-a-key', baseURL: s.url, maxRetries: 0, logLevel: 'off', fetch: longCallFetch(30000, f => observed.push(f)) });
    const error = await call(c, 800).catch(e => e);
    expect(error).toBeInstanceOf(OpenAI.APIConnectionTimeoutError);
    // The SDK keeps no cause for a timeout; the transport reported it as it happened.
    expect(observed).toEqual([expect.objectContaining({ code: 'long_call_aborted', phase: 'headers', elapsedMs: expect.any(Number) })]);
    await settle();
    expect(s.seen).toMatchObject({ requests: 1, closed: 1 });
  });
  it("the caller's abort stops the call before headers; one request; the socket is closed", async () => {
    const s = await server({ headersAfterMs: 3000 }), controller = new AbortController();
    setTimeout(() => controller.abort(), 300);
    const error = await call(client(s.url, 30000), 10000, controller.signal).catch(e => e);
    expect(error).toBeInstanceOf(OpenAI.APIUserAbortError);
    await settle();
    expect(s.seen).toMatchObject({ requests: 1, closed: 1 });
  });
  it('a dropped connection keeps its low-level cause (code and phase) and is not retried', async () => {
    const s = await server({ destroy: true });
    const error = await call(client(s.url, 30000), 10000).catch(e => e);
    expect(error).toBeInstanceOf(OpenAI.APIConnectionError);
    const cause = providerFailureCause(error);
    expect(cause.transport).toMatchObject({ code: 'long_call_network', phase: 'headers', causeCode: expect.stringMatching(/^E[A-Z]+/) });
    expect(JSON.stringify(cause)).not.toContain('synthetic-local-not-a-key');
    expect(s.seen.requests).toBe(1);
  });
  it('the declared backstop is the only transport limit: shorter than the answer, it stops the call with its own cause', async () => {
    const s = await server({ headersAfterMs: 2500 });
    const error = await call(client(s.url, 1000), 10000).catch(e => e);
    expect(providerFailureCause(error).transport).toMatchObject({ code: 'long_call_backstop', phase: 'headers' });
    await settle();
    expect(s.seen).toMatchObject({ requests: 1, closed: 1 });
  });
  it('a stalled body (after headers, where the SDK no longer times out) is stopped by the backstop, with its cause', async () => {
    const s = await server({ headersAfterMs: 10, bodyStallMs: 3000 });
    const error = await call(client(s.url, 1000), 10000).catch(e => e);
    expect(providerFailureCause(error).transport).toMatchObject({ code: 'long_call_backstop', phase: 'body' });
    await settle();
    expect(s.seen).toMatchObject({ requests: 1, closed: 1 });
  });
  it('refuses a plain-http address that is not this machine, and an unbounded backstop', async () => {
    await expect(longCallFetch(5000)('http://example.com/v1/responses')).rejects.toThrow('long_call_url');
    expect(() => longCallFetch(0)).toThrow('long_call_backstop_policy');
    expect(() => longCallFetch(2 * 60 * 60 * 1000)).toThrow('long_call_backstop_policy');
    // An abort is a spec AbortError (so the SDK classifies its own deadline as a timeout); the other failures keep their own name.
    expect(new LongCallTransportError('long_call_aborted', { phase: 'headers', elapsedMs: 1, causeName: null, causeCode: null }).name).toBe('AbortError');
    expect(new LongCallTransportError('long_call_backstop', { phase: 'body', elapsedMs: 1, causeName: null, causeCode: null }).name).toBe('LongCallTransportError');
  });
});
