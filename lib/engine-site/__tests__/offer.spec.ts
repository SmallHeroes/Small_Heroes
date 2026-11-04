import { describe, expect, it } from 'vitest';
import { engineSiteCheckoutEnabled, engineSiteCheckoutPricing, ENGINE_SITE_LAUNCH_OFFER, isEngineSiteOrder } from '../offer';

const order = () => ({ frozenProductVersion: 'engine-site/v1', expectedPageCount: 8, selectionFilename: null,
  visualPackageAuthority: null, storyLength: 'short', audioEnabled: true, pdfEnabled: true,
  videoEnabled: false, bundleEnabled: false, basePrice: 5900, addonsPrice: 0, totalPrice: 5900,
  couponCode: null, couponDiscountAgorot: null });

describe('59 ILS all-inclusive personal launch offer', () => {
  it('uses one server price for book, narration and PDF independent of old bank prices', () => {
    expect(ENGINE_SITE_LAUNCH_OFFER).toMatchObject({ priceAgorot: 5900, narrativePages: 8, narration: true, pdf: true });
    expect(engineSiteCheckoutPricing(order())).toEqual({ basePrice: 59, addonsPrice: 0, totalPrice: 59 });
    expect(engineSiteCheckoutPricing({ ...order(), frozenProductVersion: 'historical-bank-v1' })).toBeNull();
  });

  it.each([{ totalPrice: 4900 }, { basePrice: 4900 }, { addonsPrice: 1900 }, { audioEnabled: false }, { pdfEnabled: false },
    { videoEnabled: true }, { bundleEnabled: true }, { storyLength: 'medium' }, { expectedPageCount: 12 },
    { selectionFilename: 'bank' }, { visualPackageAuthority: {} }, { frozenProductVersion: 'engine-site/v2' },
    { couponCode: 'OTHER' }, { couponDiscountAgorot: 100 }])('does not silently reprice or remove an entitlement: %j', patch => {
      expect(() => engineSiteCheckoutPricing({ ...order(), ...patch })).toThrow('engine_site_offer_mismatch');
    });

  it('defaults checkout off and recognizes unknown personal versions for bank refusal', () => {
    for (const value of [undefined, 'false', '1', 'TRUE', '']) expect(engineSiteCheckoutEnabled({ ENGINE_SITE_CHECKOUT_ENABLED: value })).toBe(false);
    expect(engineSiteCheckoutEnabled({ ENGINE_SITE_CHECKOUT_ENABLED: 'true' })).toBe(true);
    expect(isEngineSiteOrder({ frozenProductVersion: 'engine-site/future' })).toBe(true);
    expect(isEngineSiteOrder({})).toBe(false);
  });
});
