import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const handoff: typeof import('../../public/JS/hero-child-handoff') = require('../../public/JS/hero-child-handoff.js');
const source = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');
const now = 2_000_000;
const child = { name: 'נועה', gender: 'girl' as const };
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}
function record() { return { version: 1, ...child, createdAt: now, expiresAt: now + handoff.TTL_MS }; }

describe('same-tab Landing identity handoff', () => {
  it('saves only the versioned name/gender and expiry, then consumes once', () => {
    const store = storage();
    expect(handoff.save(store, child, now)).toBe(true);
    expect(JSON.parse(store.getItem(handoff.KEY)!)).toEqual(record());
    expect(handoff.load(store, now + 1)).toEqual(child);
    const state = { childName: '', childGender: '', topic: 'unchanged', priceILS: 79 };
    expect(handoff.applyToWizard(store, state, now + 2)).toBe(true);
    expect(state).toEqual({ childName: 'נועה', childGender: 'girl', topic: 'unchanged', priceILS: 79 });
    expect(store.getItem(handoff.KEY)).toBeNull();
    expect(handoff.applyToWizard(store, {}, now + 3)).toBe(false);
  });

  it('does not refresh expiry just by reading', () => {
    const store = storage();
    handoff.save(store, child, now);
    const raw = store.getItem(handoff.KEY);
    expect(handoff.load(store, now + handoff.TTL_MS - 1)).toEqual(child);
    expect(store.getItem(handoff.KEY)).toBe(raw);
    expect(handoff.load(store, now + handoff.TTL_MS)).toBeNull();
    expect(store.getItem(handoff.KEY)).toBeNull();
  });

  it.each([
    ['name only', { childName: 'דן', childGender: '' }],
    ['gender only', { childName: '', childGender: 'other' }],
    ['full identity', { childName: 'דן', childGender: 'boy' }],
  ])('preserves an existing Wizard identity atomically: %s', (_, state) => {
    const store = storage();
    handoff.save(store, child, now);
    const before = { ...state };
    expect(handoff.applyToWizard(store, state, now)).toBe(false);
    expect(state).toEqual(before);
    expect(store.getItem(handoff.KEY)).toBeNull();
  });

  it.each([
    ['malformed JSON', '{'], ['array', '[]'], ['null', 'null'], ['oversize', 'x'.repeat(513)],
    ['wrong version', JSON.stringify({ ...record(), version: 2 })],
    ['uppercase gender', JSON.stringify({ ...record(), gender: 'Girl' })],
    ['unknown field', JSON.stringify({ ...record(), productId: 'fantasy' })],
    ['empty name', JSON.stringify({ ...record(), name: '  ' })],
    ['long name', JSON.stringify({ ...record(), name: 'א'.repeat(17) })],
    ['control in name', JSON.stringify({ ...record(), name: 'נו\nעה' })],
    ['invalid createdAt', JSON.stringify({ ...record(), createdAt: '2000000' })],
    ['extended expiry', JSON.stringify({ ...record(), expiresAt: now + handoff.TTL_MS + 1 })],
    ['missing expiry', JSON.stringify({ ...record(), expiresAt: undefined })],
  ])('discards %s without changing Wizard fields', (_, raw) => {
    const store = storage();
    store.setItem(handoff.KEY, raw);
    const state = { childName: '', childGender: '' };
    expect(handoff.applyToWizard(store, state, now)).toBe(false);
    expect(state).toEqual({ childName: '', childGender: '' });
    expect(store.getItem(handoff.KEY)).toBeNull();
  });

  it('rejects future timestamps and clears invalid edits instead of retaining stale names', () => {
    const store = storage();
    handoff.save(store, child, now);
    expect(handoff.load(store, now - 1)).toBeNull();
    handoff.save(store, child, now);
    expect(handoff.save(store, { name: '', gender: 'girl' }, now)).toBe(false);
    expect(handoff.load(store, now)).toBeNull();
  });

  it('retires only the legacy landing key, without importing it or clearing Wizard drafts', () => {
    const store = storage();
    store.setItem(handoff.LEGACY_KEY, JSON.stringify(child));
    store.setItem('wizard-session', 'retained');
    handoff.retireLegacy(store);
    expect(store.getItem(handoff.LEGACY_KEY)).toBeNull();
    expect(store.getItem('wizard-session')).toBe('retained');
    expect(handoff.load(store, now)).toBeNull();
  });

  it.each(['getItem', 'setItem', 'removeItem'] as const)('degrades safely when %s throws', (method) => {
    const store = storage();
    handoff.save(store, child, now);
    const blocked = { ...store, [method]: () => { throw new Error('storage unavailable'); } };
    expect(() => handoff.save(blocked, child, now)).not.toThrow();
    expect(() => handoff.load(blocked, now)).not.toThrow();
    expect(() => handoff.applyToWizard(blocked, {}, now)).not.toThrow();
    expect(() => handoff.retireLegacy(blocked)).not.toThrow();
  });

  it('does not apply when storage silently refuses deletion', () => {
    const store = storage();
    handoff.save(store, child, now);
    const state = {};
    expect(handoff.applyToWizard({ ...store, removeItem: () => {} }, state, now)).toBe(false);
    expect(state).toEqual({});
  });

  it('executes the actual classic Wizard adapter against the browser build', () => {
    const session = storage();
    const local = storage();
    handoff.save(session, child, now);
    const wizardSource = source('public/JS/wizard.js');
    const tree = ts.createSourceFile('wizard.js', wizardSource, ts.ScriptTarget.Latest, true);
    const fn = tree.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'applyLandingIdentityHandoff');
    expect(fn).toBeDefined();
    const state = { childName: '', childGender: '' };
    const context = vm.createContext({ window: { sessionStorage: session, localStorage: local }, state, Date: { now: () => now } });
    vm.runInContext(source('public/JS/hero-child-handoff.js'), context);
    vm.runInContext(fn!.getText(tree) + '; applyLandingIdentityHandoff();', context);
    expect(state).toEqual({ childName: 'נועה', childGender: 'girl' });
    expect(session.getItem(handoff.KEY)).toBeNull();
    expect(wizardSource).toMatch(/const restored = restoreWizardState\(\);\s*applyLandingIdentityHandoff\(\);/);
    const html = source('public/HTML/wizard.html');
    expect(html.indexOf('/JS/hero-child-handoff.js')).toBeLessThan(html.indexOf('/JS/wizard.js'));
    const landing = source('app/landing/landing-page.tsx');
    expect(landing).toContain('childHandoff.save(window.sessionStorage, next)');
    expect(landing).not.toContain('localStorage.setItem');
  });
});
