/**
 * Events API — minimal analytics event log
 * POST /api/events
 *
 * Logs structured events to stdout (visible in Vercel / Railway logs).
 * To connect a real analytics provider, add the SDK call inside the
 * logEvent function below — nothing else needs to change.
 *
 * File: app/api/events/route.ts
 */

// ─── Allowlist — only these event names are accepted ──────
const KNOWN_EVENTS = new Set([
  'wizard_started',
  'payment_completed',
  'generation_viewed',
  'generation_failed',
  'ready_viewed',
  'reader_opened',
  'audio_played',
  'book_reopened',
]);

// ─── Safe property keys — scalar values only, no PII ──────
const MAX_PROP_KEYS   = 8;
const MAX_STRING_LEN  = 128;

function sanitizeProperties(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (count >= MAX_PROP_KEYS) break;
    if (typeof v === 'string')  { out[k] = v.slice(0, MAX_STRING_LEN); count++; }
    else if (typeof v === 'number' || typeof v === 'boolean' || v === null) { out[k] = v; count++; }
    // drop objects, arrays, undefined
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const { event, properties } = await (req as any).json();

    if (!event || typeof event !== 'string') {
      return Response.json({ ok: false }, { status: 400 });
    }

    // Silently ignore unknown events — no error to caller, no log noise
    if (!KNOWN_EVENTS.has(event)) {
      return Response.json({ ok: true });
    }

    logEvent(event, sanitizeProperties(properties));

    return Response.json({ ok: true });
  } catch (_) {
    return Response.json({ ok: false }, { status: 400 });
  }
}

// ─── Log function — swap this for a real SDK later ────────
function logEvent(event: string, properties: Record<string, unknown>) {
  console.log('[Analytics]', JSON.stringify({
    event,
    properties,
    ts: new Date().toISOString(),
  }));
}

// ─── Shared server-side helper (used by webhook.ts) ───────
// Imported and called directly on the server — no HTTP round-trip needed.
export function logServerEvent(event: string, properties: Record<string, unknown> = {}) {
  logEvent(event, properties);
}
