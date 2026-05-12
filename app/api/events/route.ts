/**
 * Events API — minimal analytics event log
 * POST /api/events
 */

import { logServerEvent } from '../../../lib/server-events';

const KNOWN_EVENTS = new Set([
  'wizard_started',
  'checkout_started',
  'stripe_redirect',
  'payment_completed',
  'story_directions_generated',
  'story_directions_viewed',
  'story_directions_ready',
  'directions_rendered_partial',
  'directions_rendered_ready',
  'directions_error',
  'checkout_started_from_directions',
  'checkout_opened',
  'story_direction_viewed',
  'story_direction_selected',
  'story_direction_selection_abandoned',
  'full_generation_started',
  'full_generation_completed',
  'generation_viewed',
  'generation_failed',
  'ready_viewed',
  'reader_opened',
  'audio_played',
  'book_reopened',
]);

const MAX_PROP_KEYS  = 8;
const MAX_STRING_LEN = 128;

function sanitizeProperties(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (count >= MAX_PROP_KEYS) break;
    if (typeof v === 'string')  { out[k] = v.slice(0, MAX_STRING_LEN); count++; }
    else if (typeof v === 'number' || typeof v === 'boolean' || v === null) { out[k] = v; count++; }
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const { event, properties } = await req.json();

    if (!event || typeof event !== 'string') {
      return Response.json({ ok: false }, { status: 400 });
    }

    if (!KNOWN_EVENTS.has(event)) {
      return Response.json({ ok: true });
    }

    logServerEvent(event, sanitizeProperties(properties));
    return Response.json({ ok: true });
  } catch (_) {
    return Response.json({ ok: false }, { status: 400 });
  }
}
