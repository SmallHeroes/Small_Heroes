import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { runInNewContext } from 'vm';
const m = vi.hoisted(() => ({ order: vi.fn(), orders: vi.fn(), update: vi.fn(), verify: vi.fn(), start: vi.fn(), parent: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { order: { findUnique: m.order, findMany: m.orders, update: m.update } } }));
vi.mock('@/lib/auth-session', () => ({ resolveUserFromRequest: m.parent }));
vi.mock('@/lib/env', () => ({ env: { PAYMENT_PROVIDER: 'payme', PAYME_REDIRECT_TRUST_MODE: true } }));
vi.mock('@/lib/payme', () => ({ verifyPaymePayment: m.verify }));
vi.mock('@/app/api/generate/trigger', () => ({ triggerGeneration: m.start }));
vi.mock('@/lib/power-cards/resolve-from-order', () => ({ resolvePowerCardRenderInputForOrder: () => { throw Error('bank_power_card_forbidden'); } }));
vi.mock('@/lib/coupon/coupon-service', () => ({ confirmCouponForOrder: vi.fn(), couponConfirmFenceReason: vi.fn() }));
vi.mock('@/lib/human-qa/sync-hold-case', () => ({ syncHumanQaHoldCasePostCommit: vi.fn() }));
import { GET as legacyBook } from '@/app/api/orders/[orderId]/route';
import { GET as returnFromPayme } from '@/app/api/payme/return/route';
import { GET as myBooks } from '@/app/api/my-books/route';
beforeEach(() => { vi.clearAllMocks(); m.parent.mockResolvedValue({ user: { id: 'synthetic_parent' } }); m.verify.mockResolvedValue({ verified: false, status: 'unknown', raw: null }); });
afterEach(() => vi.unstubAllGlobals());
describe('actual reader/account/payment-return separation and login continuation', () => {
  it('the legacy book GET refuses personal protocols even with the former payment access key', async () => {
    for (const frozenProductVersion of ['engine-site/v1','engine-site/future']) {
      m.order.mockResolvedValueOnce({ id: 'synthetic_order', status: 'ready', paymentId: 'SYNTHETIC', frozenProductVersion, book: { pages: [{ text: 'must_not_leak' }] } });
      const response = await legacyBook(new NextRequest('http://localhost/api/orders/synthetic_order?accessKey=SYNTHETIC'), { params: Promise.resolve({ orderId: 'synthetic_order' }) });
      expect(response.status).toBe(404); expect(JSON.stringify(await response.json())).not.toContain('must_not_leak');
    }
  });
  it('personal PayMe return uses the session-owned status route and never trusts a development paid query', async () => {
    for (const status of ['generating','draft']) {
      m.order.mockResolvedValueOnce({ id: 'synthetic_order', status, frozenProductVersion: 'engine-site/v1', paymentProvider: 'payme', paymentId: 'SYNTHETIC', totalPrice: 5900 });
      const response = await returnFromPayme(new NextRequest('http://localhost/api/payme/return?orderId=synthetic_order&paymentId=SYNTHETIC&status=paid'));
      const url = new URL(response.headers.get('location')!); expect(url.pathname).toBe('/personal/orders/synthetic_order');
      expect(url.searchParams.has('accessKey')).toBe(false);
    }
    expect(m.update).not.toHaveBeenCalled(); expect(m.start).not.toHaveBeenCalled();
  });
  it('account history routes personal orders to the private status page without bank art, book text or payment tokens', async () => {
    m.orders.mockResolvedValue([{ id: 'synthetic_order', frozenProductVersion: 'engine-site/v1', status: 'needs_human_qa', childName: 'Synthetic',
      paymentId: 'SYNTHETIC', book: { title: 'not_published', coverImageUrl: 'not_published' }, createdAt: new Date(0) }]);
    const response = await myBooks(new NextRequest('http://localhost/api/my-books')), body = await response.json();
    expect(body.books[0]).toMatchObject({ personal: true, readyUrl: '/personal/orders/synthetic_order', accessKey: null, title: null, coverImageUrl: null });
    expect(JSON.stringify(body)).not.toMatch(/SYNTHETIC|not_published|\/ready\?/);
  });
  it.each(['/personal/orders/synthetic_order','https://evil.invalid/','//evil.invalid/','/personal/orders/a?preview=1'])('login accepts only a local personal-order destination: %s', target => {
    const code = readFileSync('public/JS/login.js','utf8'), replace = vi.fn();
    runInNewContext(code, { URLSearchParams, window: { location: { search: `?returnTo=${encodeURIComponent(target)}`, replace } },
      globalThis: { SH_ROUTES: { myBooks: '/my-books' } }, document: { getElementById: () => null, querySelectorAll: () => [] },
      fetch: () => ({ then: () => ({ then: (fn: any) => { fn({ user: {} }); return { catch: () => {} }; } }) }), setInterval: vi.fn(), clearInterval: vi.fn() });
    expect(replace).toHaveBeenCalledWith(target === '/personal/orders/synthetic_order' ? target : '/my-books');
  });
});
