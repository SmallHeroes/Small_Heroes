/**
 * bookHistory.js — Small Heroes local book history
 *
 * Shared utility used by ready.js (save) and landing.js (display).
 * Stores up to MAX_ENTRIES book records in localStorage, newest first.
 * Deduplicates by orderId — re-saving the same order moves it to the top.
 * Migrates the legacy single-entry key (sh_last_order_id) on first read.
 *
 * File: JS/bookHistory.js
 */

const SH_HISTORY_KEY = 'sh_book_history';
const SH_LEGACY_KEY  = 'sh_last_order_id';
const MAX_ENTRIES    = 5;

/**
 * Returns the history array (newest first).
 * Handles parse errors and migrates the legacy single-key format.
 */
function getBookHistory() {
  try {
    const raw = localStorage.getItem(SH_HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }

    // ── Migrate from legacy single-entry key ──────────────
    const legacyId = localStorage.getItem(SH_LEGACY_KEY);
    if (legacyId) {
      const migrated = [{ orderId: legacyId, childName: null, title: null, savedAt: Date.now() }];
      localStorage.setItem(SH_HISTORY_KEY, JSON.stringify(migrated));
      localStorage.removeItem(SH_LEGACY_KEY);
      return migrated;
    }

    return [];
  } catch (_) {
    return [];
  }
}

/**
 * Saves (or updates) a book entry.
 * If orderId already exists it is moved to the top with refreshed data.
 * @param {{ orderId: string, childName?: string|null, title?: string|null, accessKey?: string|null }} entry
 */
function saveBookToHistory({ orderId, childName = null, title = null, accessKey = null }) {
  try {
    const existing = getBookHistory().filter(e => e.orderId !== orderId);
    const updated  = [
      { orderId, childName: childName || null, title: title || null, accessKey: accessKey || null, savedAt: Date.now() },
      ...existing,
    ].slice(0, MAX_ENTRIES);
    localStorage.setItem(SH_HISTORY_KEY, JSON.stringify(updated));
  } catch (_) {}
}

/**
 * Removes a single entry by orderId.
 */
function removeBookFromHistory(orderId) {
  try {
    const updated = getBookHistory().filter(e => e.orderId !== orderId);
    localStorage.setItem(SH_HISTORY_KEY, JSON.stringify(updated));
  } catch (_) {}
}

/**
 * Removes the entire history key.
 */
function clearBookHistory() {
  try { localStorage.removeItem(SH_HISTORY_KEY); } catch (_) {}
}
