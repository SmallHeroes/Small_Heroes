/**
 * Small client-side API reliability helpers.
 * Lightweight by design: no framework dependency, no UI coupling.
 */
(function bootstrapClientApi(global) {
  if (global.SmallHeroesClient && typeof global.SmallHeroesClient.requestJson === 'function') {
    // Another implementation already exists; do not clobber.
    return;
  }

  function safeParseJson(text) {
    if (!text || !text.trim()) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  function extractErrorMessage(payload, fallbackMessage) {
    if (payload && typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error.trim();
    }
    if (payload && typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message.trim();
    }
    return fallbackMessage;
  }

  function reportClientIssue(scope, reason, details) {
    const payload = {
      ts: new Date().toISOString(),
      scope: scope || 'unknown',
      reason: reason || 'unknown',
      details: details || {},
    };
    try {
      console.warn('[ClientIssue]', payload);
    } catch (_) {}

    try {
      if (typeof global.__SMALL_HEROES_CLIENT_ERROR_HOOK__ === 'function') {
        global.__SMALL_HEROES_CLIENT_ERROR_HOOK__(payload);
      }
    } catch (_) {}
  }

  async function requestJson(url, options) {
    const opts = options || {};
    const timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : 15000;
    const method = (opts.fetch && opts.fetch.method) || 'GET';
    const fallbackMessage = opts.fallbackMessage || 'Request failed';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...(opts.fetch || {}), signal: controller.signal });
      const rawText = await res.text();
      const data = safeParseJson(rawText);

      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          data,
          reason: 'http_error',
          message: extractErrorMessage(data, fallbackMessage),
        };
      }

      if (!data) {
        return {
          ok: false,
          status: res.status,
          data: null,
          reason: 'invalid_json',
          message: opts.invalidJsonMessage || 'Invalid server response',
        };
      }

      return {
        ok: true,
        status: res.status,
        data,
        reason: null,
        message: null,
      };
    } catch (error) {
      const aborted = error && typeof error === 'object' && error.name === 'AbortError';
      return {
        ok: false,
        status: 0,
        data: null,
        reason: aborted ? 'timeout' : 'network_error',
        message: aborted
          ? (opts.timeoutMessage || 'Request timed out')
          : (opts.networkMessage || 'Network error'),
      };
    } finally {
      clearTimeout(timer);
      if (opts.onFinally && typeof opts.onFinally === 'function') {
        try {
          opts.onFinally();
        } catch (_) {}
      }
      if (opts.reportOnFailure === true && method !== 'GET') {
        // Reporting is handled by callers when they need context.
      }
    }
  }

  const api = {
    requestJson,
    reportClientIssue,
    extractErrorMessage,
  };
  Object.freeze(api);
  global.__smallHeroesClientApi = api;
  global.SmallHeroesClient = api;
})(window);
