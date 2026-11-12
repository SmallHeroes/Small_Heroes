import 'server-only';

import { ENGINE_SITE_PROTOCOL, engineSiteFail } from './contract';
import { ENGINE_SITE_LAUNCH_OFFER, engineSitePriceIls } from './offer-definition';
import { configuredEngineSpendPolicy } from './platform-policy';
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
  if (env.VERCEL_ENV?.toLowerCase() === 'production' && env.ENABLE_PROD_GENERATION !== 'true') return false;
  if (['ENGINE_SITE_CHECKOUT_ENABLED', 'ENGINE_SITE_ORDER_INTAKE_ENABLED', 'ENGINE_SITE_WORKER_ENABLED', 'ENGINE_SITE_PROVIDERS_ENABLED',
    'ENGINE_SITE_READER_ENABLED', 'ENGINE_SITE_FULFILLMENT_ENABLED'].some(name => env[name] !== 'true')) return false;
  try {
    const policy = configuredEngineSpendPolicy(env);
    // The current-engine profile runs every step inside serverless invocations (batched author); only the
    // historical recipe still needs the separate long-step executor.
    return policy.engineProfile !== undefined || env.ENGINE_SITE_LONG_WORKER_ENABLED === 'true';
  } catch { return false; }
}
