/**
 * Server-side analytics event logging (shared across API routes).
 * Kept out of app/api route modules so Next route type generation stays valid.
 */

function logEvent(event: string, properties: Record<string, unknown>) {
  console.log('[Analytics]', JSON.stringify({
    event,
    properties,
    ts: new Date().toISOString(),
  }));
}

export function logServerEvent(event: string, properties: Record<string, unknown> = {}) {
  logEvent(event, properties);
}
