/**
 * A fetch for long provider calls (the OpenAI SDK `fetch` option). Node's built-in fetch gives up waiting for response headers after its
 * default 300 s, which is below a long non-streaming generation's own deadline, and the SDK then reports only "Request timed out.".
 * This transport sends ONE request per call over node:http(s) with no header or body limit below a declared backstop; the caller's own
 * deadline (the SDK `timeout`, delivered through the abort signal) governs. No retry, no shared or global agent; the socket is destroyed
 * on abort, backstop or error; a failure keeps a safe low-level cause (name, code, phase, elapsed), never headers, bodies or credentials.
 */
import http from 'node:http';
import https from 'node:https';
import { Readable } from 'node:stream';

export type LongCallFailure = { phase: 'request' | 'headers' | 'body'; elapsedMs: number; causeName: string | null; causeCode: string | null };
export class LongCallTransportError extends Error {
  constructor(readonly code: 'long_call_aborted' | 'long_call_backstop' | 'long_call_network', readonly failure: LongCallFailure) {
    // An abort (the caller's or the SDK's own deadline) is a spec AbortError, so the SDK classifies its deadline as a timeout.
    super(code); this.name = code === 'long_call_aborted' ? 'AbortError' : 'LongCallTransportError';
  }
}
/** Every transport failure, reported as it happens: the SDK drops the cause of a timeout, so callers keep it from here. */
export type LongCallObserver = (failure: LongCallFailure & { code: LongCallTransportError['code'] }) => void;
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);
const causeCode = (cause: unknown) => cause && typeof cause === 'object' && 'code' in cause && typeof cause.code === 'string' ? cause.code.slice(0, 60) : null;

/**
 * `backstopMs` bounds the whole call (headers AND body: the SDK's own timeout stops waiting once headers arrive), so it should be the
 * call's deadline plus a small margin.
 */
export function longCallFetch(backstopMs: number, observe?: LongCallObserver): typeof fetch {
  if (!Number.isSafeInteger(backstopMs) || backstopMs < 1000 || backstopMs > 60 * 60 * 1000) throw Error('long_call_backstop_policy');
  return (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    // Provider calls are https; plain http only to this machine (local tests).
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOOPBACK.has(url.hostname))) throw Error('long_call_url');
    const body = init.body == null ? undefined : typeof init.body === 'string' ? init.body : Buffer.from(await new Response(init.body as BodyInit).arrayBuffer());
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((value, key) => { headers[key] = value; });
    const mod = url.protocol === 'https:' ? https : http, agent = new mod.Agent({ keepAlive: false }), started = Date.now();
    return new Promise<Response>((resolve, reject) => {
      let phase: LongCallFailure['phase'] = 'request', settled = false, response: http.IncomingMessage | null = null;
      const failure = (code: LongCallTransportError['code'], cause?: unknown) => {
        const detail = { phase, elapsedMs: Date.now() - started, causeName: cause instanceof Error ? cause.name : null, causeCode: causeCode(cause) };
        observe?.({ code, ...detail });
        return new LongCallTransportError(code, detail);
      };
      const cleanup = () => { clearTimeout(timer); init.signal?.removeEventListener('abort', onAbort); agent.destroy(); };
      // Before headers the promise rejects; after headers the body stream errors with the same cause.
      const stop = (error: LongCallTransportError) => {
        if (response) response.destroy(error);
        else { req.destroy(error); if (!settled) { settled = true; reject(error); } }
        cleanup();
      };
      const onAbort = () => stop(failure('long_call_aborted', init.signal?.reason));
      const timer = setTimeout(() => stop(failure('long_call_backstop')), backstopMs);
      const req = mod.request(url, { method: init.method ?? 'GET', headers, agent });
      req.on('error', error => {
        if (settled) return;
        settled = true; cleanup(); reject(error instanceof LongCallTransportError ? error : failure('long_call_network', error));
      });
      req.on('response', incoming => {
        response = incoming; phase = 'body'; settled = true;
        incoming.on('close', cleanup);
        const status = incoming.statusCode ?? 0, responseHeaders = new Headers();
        for (const [key, value] of Object.entries(incoming.headers)) if (value !== undefined) responseHeaders.set(key, Array.isArray(value) ? value.join(', ') : value);
        const empty = [204, 205, 304].includes(status) || init.method === 'HEAD';
        if (empty) incoming.resume();
        resolve(new Response(empty ? null : Readable.toWeb(incoming) as ReadableStream, { status, statusText: incoming.statusMessage, headers: responseHeaders }));
      });
      phase = 'headers';
      if (init.signal?.aborted) return onAbort();
      init.signal?.addEventListener('abort', onAbort, { once: true });
      req.end(body);
    });
  }) as typeof fetch;
}

/** The safe, low-level cause of a failed SDK call (SDK error name and status, and this transport's phase, code and timing). */
export function providerFailureCause(error: unknown) {
  const chain: unknown[] = [];
  for (let e: unknown = error; e && typeof e === 'object' && chain.length < 5; e = (e as { cause?: unknown }).cause) chain.push(e);
  const transport = chain.find((e): e is LongCallTransportError => e instanceof LongCallTransportError);
  const top = error && typeof error === 'object' ? error as { name?: unknown; status?: unknown; message?: unknown } : {};
  // SDK errors keep the generic name "Error"; their class (e.g. APIConnectionTimeoutError) is the meaningful label.
  const kind = error && typeof error === 'object' && error.constructor && error.constructor.name !== 'Object' && error.constructor.name !== 'Error'
    ? error.constructor.name : typeof top.name === 'string' ? top.name : null;
  return { sdkError: kind, status: typeof top.status === 'number' ? top.status : null,
    message: typeof top.message === 'string' ? top.message.slice(0, 160) : null,
    transport: transport ? { code: transport.code, ...transport.failure } : null,
    lowLevel: chain.slice(1).map(e => ({ name: e instanceof Error ? e.name : null, code: causeCode(e) })).filter(c => c.name || c.code) };
}
