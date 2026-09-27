/* One contract shared by the React landing and the classic Wizard script.
   This is optional display input, never order/product authority. */
(function () {
  'use strict';
  const KEY = 'sh.hero-child-handoff.v1';
  const LEGACY_KEY = 'sh.hero-child';
  const TTL_MS = 30 * 60 * 1000;
  const MAX_NAME = 16;

  function identity(value) {
    if (!value || typeof value.name !== 'string' ||
        !['boy', 'girl'].includes(value.gender)) return null;
    const name = value.name.trim();
    if (!name || name.length > MAX_NAME || /[\u0000-\u001f\u007f]/u.test(name)) return null;
    return { name, gender: value.gender };
  }

  function clear(storage, key) {
    try {
      storage.removeItem(key);
      return storage.getItem(key) === null;
    } catch (_) { return false; }
  }

  function retireLegacy(storage) { clear(storage, LEGACY_KEY); }

  function save(storage, child, now = Date.now()) {
    if (!clear(storage, KEY)) return false;
    const clean = identity(child);
    if (!clean || !Number.isSafeInteger(now) || now < 0) return false;
    try {
      storage.setItem(KEY, JSON.stringify({ version: 1, ...clean, createdAt: now, expiresAt: now + TTL_MS }));
      return true;
    } catch (_) { return false; }
  }

  function read(storage, consume, now) {
    try {
      const raw = storage.getItem(KEY);
      if (raw === null) return null;
      if (consume && !clear(storage, KEY)) return null;
      const value = raw.length <= 512 ? JSON.parse(raw) : null;
      const clean = identity(value);
      if (!clean || Array.isArray(value) || value.version !== 1 ||
          Object.keys(value).sort().join(',') !== 'createdAt,expiresAt,gender,name,version' ||
          !Number.isSafeInteger(now) || !Number.isSafeInteger(value.createdAt) || value.createdAt < 0 ||
          value.expiresAt !== value.createdAt + TTL_MS ||
          now < value.createdAt || now >= value.expiresAt) {
        clear(storage, KEY);
        return null;
      }
      return clean;
    } catch (_) {
      clear(storage, KEY);
      return null;
    }
  }

  function load(storage, now = Date.now()) { return read(storage, false, now); }
  function applyToWizard(storage, state, now = Date.now()) {
    const child = read(storage, true, now);
    // Never mix two children's identities or replace a deliberate Wizard choice.
    if (!child || !state || state.childName || state.childGender) return false;
    state.childName = child.name;
    state.childGender = child.gender;
    return true;
  }

  const api = { KEY, LEGACY_KEY, TTL_MS, MAX_NAME, save, load, applyToWizard, retireLegacy };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.SmallHeroesChildHandoff = api;
})();
