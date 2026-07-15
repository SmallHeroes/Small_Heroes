import { readFileSync } from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * LAUNCH BLOCKER #1 — MONEY TRUTH: charged == displayed == promised.
 *
 * Three defects this pins, all on the live customer path:
 *   1. OVER-CHARGE. The wizard displayed the flat launch price (₪59/79/99) while checkout charged base + add-ons:
 *      buildWizardPayload hardcodes audioEnabled+pdfEnabled (+₪38 on EVERY order) and fantasy auto-enables video
 *      (+₪29) — so a fantasy order displayed ₪99 and charged ₪166. Ported fix: dff4681f.
 *   2. NO COUPON. The launch discount (50% off, first 100) had no implementation on this branch at all.
 *      Ported from feat/coupon-code (4 shared + 3 re-gated concurrency commits).
 *   3. COPY ≠ MONEY. The copy promised "no add-ons" while add-ons were charged, and promised video + print/Power
 *      Card as included while ready.js hides both (SHOW_VIDEO/SHOW_PRINT = false).
 *
 * These assert at the CHECKOUT SEAM (the amount actually sent to the provider + stored on the order), not just at
 * computePricing — an over-charge is only real where the money is taken.
 */

vi.mock('@/lib/prisma', () => ({
  prisma: { order: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock('@/lib/payme', () => ({ createPaymeCheckout: vi.fn() }));
vi.mock('@/lib/request-security', () => ({
  enforceSameOrigin: vi.fn(() => null),
  enforceRateLimit: vi.fn(() => null),
}));
vi.mock('@/lib/resemblance-core', () => ({
  evaluatePhotoGate: vi.fn(async () => ({
    warnings: [], faceCount: 0, faceAreaRatio: 0, brightness: 0, sharpness: 0, inputStrength: 'none',
  })),
}));
vi.mock('@/lib/coupon/coupon-service', () => ({
  reserveCoupon: vi.fn(),
  releaseCouponForOrder: vi.fn(),
}));

const BASE_ENV: Record<string, string> = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  GENERATION_SECRET: 'test-secret',
  NEXT_PUBLIC_APP_URL: 'https://app.example.com',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'role-key',
  OPENAI_API_KEY: 'openai-key',
  DISABLE_IMAGE_GENERATION: 'true',
  NEXT_PUBLIC_BUY_MODE: 'live',
  SITE_PASSWORD: 'site-secret',
  PAYMENT_PROVIDER: 'payme',
  PAYME_API_BASE_URL: 'https://payme.example',
  PAYME_API_KEY: 'k',
  PAYME_WEBHOOK_SECRET: 's',
  VERCEL_ENV: 'preview',
};
const MANAGED = Object.keys(BASE_ENV);

let envSnapshot: NodeJS.ProcessEnv;
beforeEach(() => {
  envSnapshot = { ...process.env };
  for (const k of MANAGED) delete process.env[k];
  Object.assign(process.env, BASE_ENV);
});
afterEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in envSnapshot)) delete process.env[k];
  Object.assign(process.env, envSnapshot);
  vi.resetModules();
  vi.clearAllMocks();
});

/** The launch prices EXACTLY as the wizard displays them. */
const DISPLAYED = { bedtime: 59, adventure: 79, fantasy: 99 } as const;

/** The real wizard payload: buildWizardPayload hardcodes audio+pdf on, and fantasy auto-enables video. */
function orderFor(direction: keyof typeof DISPLAYED) {
  return {
    id: 'o1',
    status: 'draft',
    storyLength: 'medium',
    storyDirection: direction,
    audioEnabled: true,
    pdfEnabled: true,
    bundleEnabled: false,
    videoEnabled: direction === 'fantasy',
    childImageUrl: null,
    childName: 'דנה',
    customerEmail: 'a@b.com',
    customerName: 'דנה',
  };
}

function makeReq(body: Record<string, unknown>) {
  return new NextRequest('https://app.example.com/api/checkout', {
    method: 'POST',
    body: JSON.stringify({ orderId: 'o1', ...body }),
    // the site-password gate is upstream of the money path; give it the cookie so we test PRICING here
    headers: { 'content-type': 'application/json', cookie: 'sh_access=site-secret' },
  });
}

/** Run POST /api/checkout and return { chargedAgorot (sent to PayMe), storedTotal (written to the order) }. */
async function runCheckout(direction: keyof typeof DISPLAYED, body: Record<string, unknown> = {}) {
  const { POST } = await import('@/app/api/checkout/route');
  const { prisma } = await import('@/lib/prisma');
  const { createPaymeCheckout } = await import('@/lib/payme');
  vi.mocked(prisma.order.findUnique).mockResolvedValue(orderFor(direction) as never);
  vi.mocked(prisma.order.update).mockResolvedValue({} as never);
  vi.mocked(createPaymeCheckout).mockResolvedValue({
    checkoutUrl: 'https://pay.payme.example/abc',
    checkoutId: 'chk_1',
    raw: {},
  } as never);

  const res = await POST(makeReq(body));
  const paymeArgs = vi.mocked(createPaymeCheckout).mock.calls[0]?.[0] as { amountAgorot: number } | undefined;
  const updateCalls = vi.mocked(prisma.order.update).mock.calls;
  const updateArgs = updateCalls[updateCalls.length - 1]?.[0] as
    | { data: { totalPrice?: number; basePrice?: number; addonsPrice?: number; couponDiscountAgorot?: number | null } }
    | undefined;
  return { res, chargedAgorot: paymeArgs?.amountAgorot, stored: updateArgs?.data };
}

describe('MONEY: charged == displayed (no add-on charges on the golden path)', () => {
  for (const [direction, shown] of Object.entries(DISPLAYED) as Array<[keyof typeof DISPLAYED, number]>) {
    it(`${direction}: charges EXACTLY the displayed ₪${shown} — with audio+pdf(+video) all on`, async () => {
      const { res, chargedAgorot, stored } = await runCheckout(direction);
      expect(res.status).toBe(200);
      // The amount actually SENT to the payment provider.
      expect(chargedAgorot).toBe(shown * 100);
      // …and the amount STORED on the order (what a refund/accounting reads).
      expect(stored?.totalPrice).toBe(shown * 100);
      expect(stored?.basePrice).toBe(shown * 100);
      expect(stored?.addonsPrice).toBe(0);
    });
  }

  it('REGRESSION: fantasy charges ₪99, never the old ₪166 (base 99 + pdf 19 + audio 19 + video 29)', async () => {
    const { chargedAgorot } = await runCheckout('fantasy');
    expect(chargedAgorot).toBe(9900);
    expect(chargedAgorot).not.toBe(16600);
  });

  it('REGRESSION: bedtime/adventure never carry the +₪38 audio+pdf surcharge', async () => {
    expect((await runCheckout('bedtime')).chargedAgorot).not.toBe(5900 + 3800);
    expect((await runCheckout('adventure')).chargedAgorot).not.toBe(7900 + 3800);
  });
});

describe('MONEY: the coupon discounts the CHARGED amount (50% off, first 100)', () => {
  it('a valid code charges exactly 50% of the displayed price, and stores the discount', async () => {
    const { reserveCoupon } = await import('@/lib/coupon/coupon-service');
    // reserveCoupon is the atomic cap-lease; here we assert checkout HONORS its result at the money seam.
    vi.mocked(reserveCoupon).mockResolvedValue({
      ok: true, code: 'FIRST100', discountPercent: 50, originalAgorot: 9900, discountAgorot: 4950, discountedAgorot: 4950,
    } as never);

    const { chargedAgorot, stored } = await runCheckout('fantasy', { couponCode: 'first100' });
    expect(chargedAgorot).toBe(4950); // ₪49.50 — half of the ₪99 shown
    expect(stored?.totalPrice).toBe(4950);
    expect(stored?.couponDiscountAgorot).toBe(4950);
    // reserve was asked to discount the DISPLAYED total (not base+add-ons)
    expect(vi.mocked(reserveCoupon).mock.calls[0][0]).toMatchObject({ originalAgorot: 9900, rawCode: 'first100' });
  });

  it('a rejected code (invalid / inactive / CAP REACHED) → 409 coupon_rejected and NO charge is created', async () => {
    const { reserveCoupon } = await import('@/lib/coupon/coupon-service');
    const { createPaymeCheckout } = await import('@/lib/payme');
    // Deliberate contract: a coupon failure does NOT silently fall back to the full price. Someone who typed a
    // code expecting 50% off must never be charged full instead — they are told, and no money moves ("no one is
    // charged then refunded"). This is also how redemption #101 lands: a clean "code is used up", not a surprise.
    for (const reason of ['not_found', 'inactive', 'maxed_out']) {
      vi.clearAllMocks();
      vi.mocked(reserveCoupon).mockResolvedValue({ ok: false, reason } as never);
      const { res, chargedAgorot } = await runCheckout('fantasy', { couponCode: 'NOPE' });
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: 'coupon_rejected', reason });
      expect(chargedAgorot).toBeUndefined(); // no sale was created at all
      expect(vi.mocked(createPaymeCheckout)).not.toHaveBeenCalled();
    }
  });

  it('no code → full displayed price, and the coupon lease is never touched', async () => {
    const { reserveCoupon } = await import('@/lib/coupon/coupon-service');
    const { chargedAgorot } = await runCheckout('adventure');
    expect(chargedAgorot).toBe(7900);
    expect(vi.mocked(reserveCoupon)).not.toHaveBeenCalled();
  });
});

describe('MONEY: a refund returns what was CHARGED (never the base) — exactly once', () => {
  it('the couponed order STORES the discounted total, so the sale (and its refund) is the discounted amount', async () => {
    const { reserveCoupon } = await import('@/lib/coupon/coupon-service');
    vi.mocked(reserveCoupon).mockResolvedValue({
      ok: true, code: 'FIRST100', discountPercent: 50, originalAgorot: 5900, discountAgorot: 2950, discountedAgorot: 2950,
    } as never);
    const { chargedAgorot, stored } = await runCheckout('bedtime', { couponCode: 'FIRST100' });
    // The sale is created for 2950 — so a full-sale refund returns ₪29.50, never the ₪59 base.
    expect(chargedAgorot).toBe(2950);
    expect(stored?.totalPrice).toBe(2950);
    expect(stored?.basePrice).toBe(5900); // the base is recorded for accounting, but is NOT what was charged
  });

  it('STRUCTURAL: the refund path takes NO amount — it refunds the SALE, so it cannot refund the base', async () => {
    // refundPaymeSale(paymeSaleId) is a FULL refund of the sale that was actually charged; RefundableOrder carries
    // no amount at all. That is what makes "refund the discounted amount, never the base" true by construction —
    // there is no amount argument to get wrong. Exactly-once is the RefundAttempt fence (#6-FIX-3/4a/5), covered
    // in payment-refunds.spec.ts.
    const refunds = readFileSync('lib/payment-refunds.ts', 'utf8');
    expect(refunds).toMatch(/export interface RefundableOrder/);
    expect(refunds).not.toMatch(/RefundableOrder[\s\S]{0,400}?(totalPrice|amount)\s*:/);
    const payme = readFileSync('lib/payme.ts', 'utf8');
    expect(payme).toMatch(/export async function refundPaymeSale\(\s*paymeSaleId: string/);
  });
});

describe('COPY == MONEY: nothing is promised that is not charged for / delivered', () => {
  const copy = () => readFileSync('public/JS/content.js', 'utf8') + readFileSync('content/landing.ts', 'utf8');

  it('no marketing copy promises video or print/Power Card as INCLUDED (ready.js hides both)', () => {
    const ready = readFileSync('public/JS/ready.js', 'utf8');
    expect(ready).toMatch(/const SHOW_PRINT = false/);
    expect(ready).toMatch(/const SHOW_VIDEO = false/);

    // Scan only the customer-facing inclusion copy — NOT the labels of the hidden ready.js buttons.
    const text = copy();
    const inclusionClaims = text
      .split('\n')
      .filter((l) => /סרטון|כרטיס כוח|מוכן להדפסה|PDF להדפסה/.test(l))
      .filter((l) => !/btnPdf|btnVideo|pdfLabel|videoLabel|powerCardLabel|bundleLabel|pdfAddon|videoAddon/.test(l));
    expect(inclusionClaims).toEqual([]);
  });

  it('the "what you get" FAQ describes the REAL product: digital book + narration', () => {
    const text = copy();
    expect(text).toContain('מה מקבלים בפועל?');
    // the answer must name narration and must NOT name video / print
    const faq = text.split('\n').filter((l) => l.includes('הספר מגיע כספר דיגיטלי'));
    expect(faq.length).toBeGreaterThan(0);
    for (const line of faq) {
      expect(line).toMatch(/קריינות/);
      expect(line).not.toMatch(/סרטון|להדפסה/);
    }
  });

  it('"בלי תוספות" is now TRUE — computePricing charges no add-ons', async () => {
    const { computePricing } = await import('@/backend/config/wizard');
    const p = computePricing({
      length: 'long', direction: 'fantasy',
      audioEnabled: true, pdfEnabled: true, bundleEnabled: true, videoEnabled: true,
    });
    expect(p.addonsPrice).toBe(0);
    expect(p.totalPrice).toBe(p.basePrice);
    expect(copy()).toMatch(/בלי תוספות/); // the promise may stand, because it is now the truth
  });
});
