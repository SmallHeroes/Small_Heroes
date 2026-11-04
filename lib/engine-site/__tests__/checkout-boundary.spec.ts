import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), payme: vi.fn(),
  reserveCoupon: vi.fn(), photo: vi.fn(), parent: vi.fn(), paymentProvider: { value: 'payme' } }));
vi.mock('@/lib/auth-session', () => ({ resolveUserFromRequest: mocks.parent }));
vi.mock('@/lib/prisma', () => ({ prisma: { order: { findUnique: mocks.findUnique, update: mocks.update, updateMany: mocks.updateMany } } }));
vi.mock('@/lib/payme', () => ({ createPaymeCheckout: mocks.payme }));
vi.mock('@/lib/request-security', () => ({ enforceSameOrigin: () => null, enforceRateLimit: () => null }));
vi.mock('@/lib/resemblance-core', () => ({ evaluatePhotoGate: mocks.photo }));
vi.mock('@/lib/coupon/coupon-service', () => ({ reserveCoupon: mocks.reserveCoupon, releaseCouponForOrder: vi.fn() }));
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));
vi.mock('@/lib/env', () => ({ env: { get PAYMENT_PROVIDER() { return mocks.paymentProvider.value; },
  PAYME_API_BASE_URL: 'https://payme.example.invalid', PAYME_API_KEY: 'SYNTHETIC_KEY', NEXT_PUBLIC_APP_URL: 'https://app.example.invalid' },
  isFakePaymentEnabled: () => true, canUseFakePayments: () => true, isWaitlistMode: () => false }));

import { handleCheckoutPost } from '@/app/api/checkout/handler';
import { syntheticEngineActivationEnv } from './synthetic-order';

const order = () => ({ id: 'synthetic_order', userId: 'synthetic_parent', status: 'draft', frozenProductVersion: 'engine-site/v1', expectedPageCount: 8,
  storyLength: 'short', storyDirection: null, selectionFilename: null, visualPackageAuthority: null,
  audioEnabled: true, pdfEnabled: true, videoEnabled: false, bundleEnabled: false,
  basePrice: 5900, addonsPrice: 0, totalPrice: 5900, couponCode: null, couponDiscountAgorot: null,
  childImageUrl: null, childName: 'Synthetic', customerEmail: 'synthetic@example.invalid', customerName: 'Synthetic' });
const request = (body: Record<string, unknown> = {}) => new NextRequest('https://app.example.invalid/api/checkout', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId: 'synthetic_order', ...body }),
});
beforeEach(() => {
  vi.clearAllMocks(); mocks.paymentProvider.value = 'payme';
  for (const [name, value] of Object.entries(syntheticEngineActivationEnv())) vi.stubEnv(name, value);
  mocks.parent.mockResolvedValue({ user: { id: 'synthetic_parent' } });
  mocks.findUnique.mockResolvedValue(order()); mocks.update.mockResolvedValue({}); mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.payme.mockResolvedValue({ checkoutUrl: 'https://payme.example.invalid/pay', checkoutId: 'synthetic_sale', raw: {} });
});
afterEach(() => vi.unstubAllEnvs());

describe('actual checkout handler — new SKU cannot inherit bank pricing/add-ons/fake fallback', () => {
  it('requires the authenticated owner before taking a checkout lease', async () => {
    for (const parent of [null, { user: { id: 'foreign_parent' } }]) {
      mocks.parent.mockResolvedValueOnce(parent);
      expect((await handleCheckoutPost(request(), { routeProtocol: 'legacy-route' })).status).toBe(403);
    }
    expect(mocks.payme).not.toHaveBeenCalled(); expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it('sends and stores exactly 5900 agorot with all promised launch deliverables', async () => {
    const response = await handleCheckoutPost(request({ totalPrice: 1, audioEnabled: false, pdfEnabled: false }), { routeProtocol: 'legacy-route' });
    expect(response.status).toBe(200);
    expect(mocks.payme).toHaveBeenCalledWith(expect.objectContaining({ amountAgorot: 5900, currency: 'ILS' }));
    const description = mocks.payme.mock.calls[0][0].description as string;
    expect(description).toContain('8'); expect(description).toContain('כלולים'); expect(description).not.toContain('תוספות:');
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ totalPrice: 5900, addonsPrice: 0 }) }));
    expect(mocks.reserveCoupon).not.toHaveBeenCalled();
  });

  it('default-off stops before checkout lease, photo reads or PayMe', async () => {
    vi.stubEnv('ENGINE_SITE_CHECKOUT_ENABLED', 'false');
    expect((await handleCheckoutPost(request(), { routeProtocol: 'legacy-route' })).status).toBe(503);
    expect(mocks.updateMany).not.toHaveBeenCalled(); expect(mocks.payme).not.toHaveBeenCalled(); expect(mocks.photo).not.toHaveBeenCalled();
  });

  it('refuses coupon and fake-payment routes without taking a checkout claim', async () => {
    expect((await handleCheckoutPost(request({ couponCode: 'SYNTHETIC' }), { routeProtocol: 'legacy-route' })).status).toBe(422);
    mocks.paymentProvider.value = 'fake';
    expect((await handleCheckoutPost(request(), { routeProtocol: 'legacy-route' })).status).toBe(503);
    expect(mocks.updateMany).not.toHaveBeenCalled(); expect(mocks.payme).not.toHaveBeenCalled();
  });

  it('never downgrades a failed PayMe call to a fake paid authority', async () => {
    mocks.payme.mockRejectedValueOnce(Error('SYNTHETIC provider unavailable'));
    expect((await handleCheckoutPost(request(), { routeProtocol: 'legacy-route' })).status).toBe(500);
    expect(mocks.payme).toHaveBeenCalledTimes(1);
    expect(mocks.update.mock.calls.some(([arg]) => arg.data?.paymentProvider === 'fake')).toBe(false);
  });

  it('unknown personal versions cannot fall back to legacy pricing or charge', async () => {
    mocks.findUnique.mockResolvedValueOnce({ ...order(), frozenProductVersion: 'engine-site/v99' });
    expect((await handleCheckoutPost(request(), { routeProtocol: 'legacy-route' })).status).toBe(500);
    expect(mocks.payme).not.toHaveBeenCalled(); expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
