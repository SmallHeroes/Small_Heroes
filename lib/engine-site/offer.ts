import 'server-only';

import { ENGINE_SITE_PROTOCOL, engineSiteFail } from './contract';
import { ENGINE_SITE_LAUNCH_OFFER, engineSitePriceIls } from './offer-definition';
export { ENGINE_SITE_LAUNCH_OFFER } from './offer-definition';

export const isEngineSiteOrder = (value: { frozenProductVersion?: string | null }) =>
  typeof value.frozenProductVersion === 'string' && value.frozenProductVersion.startsWith('engine-site/');

type CheckoutOrder = {
  frozenProductVersion?: string | null; expectedPageCount?: number | null;
  selectionFilename?: string | null; visualPackageAuthority?: unknown;
  storyLength?: string; audioEnabled?: boolean; pdfEnabled?: boolean; videoEnabled?: boolean; bundleEnabled?: boolean;
  basePrice?: number; addonsPrice?: number; totalPrice?: number;
  couponCode?: string | null; couponDiscountAgorot?: number | null;
};

/** Null is a genuine historical order. An unknown personal protocol must never fall back to bank pricing. */
export function engineSiteCheckoutPricing(order: CheckoutOrder) {
  if (!isEngineSiteOrder(order)) return null;
  const offer = ENGINE_SITE_LAUNCH_OFFER;
  if (order.frozenProductVersion !== ENGINE_SITE_PROTOCOL || order.expectedPageCount !== offer.narrativePages ||
      order.selectionFilename != null || order.visualPackageAuthority != null || order.storyLength !== 'short' ||
      order.audioEnabled !== true || order.pdfEnabled !== true || order.videoEnabled !== false || order.bundleEnabled !== false ||
      order.basePrice !== offer.priceAgorot || order.addonsPrice !== 0 || order.totalPrice !== offer.priceAgorot ||
      order.couponCode != null || order.couponDiscountAgorot != null) engineSiteFail('engine_site_offer_mismatch');
  return { basePrice: engineSitePriceIls(), addonsPrice: offer.addonsPriceAgorot / 100, totalPrice: engineSitePriceIls() };
}

/** No currently enabled customer route: all integration/paid/runtime gates must precede activation. */
export function engineSiteCheckoutEnabled(env: Readonly<Record<string, string | undefined>> = process.env) {
  return env.ENGINE_SITE_CHECKOUT_ENABLED === 'true';
}
