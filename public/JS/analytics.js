/**
 * analytics.js — Small Heroes minimal event tracking
 *
 * Exposes a single global function: track(event, properties)
 * Fires POST /api/events fire-and-forget with keepalive so the request
 * survives page navigation. Never throws — analytics must never break UX.
 *
 * To wire up a real provider later (PostHog, Mixpanel, etc.),
 * replace or extend the body of track() here only.
 *
 * File: JS/analytics.js
 */

function track(event, properties) {
  try {
    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // keepalive: true keeps the request alive through page navigations
      // (important for wizard_started which fires just before the user clicks next)
      keepalive: true,
      body: JSON.stringify({ event, properties: properties || {} }),
    }).catch(function () {}); // swallow network errors silently
  } catch (_) {}
}
