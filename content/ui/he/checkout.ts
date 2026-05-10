/**
 * content/ui/he/checkout.ts
 * Stripe Checkout product names and descriptions shown to the customer.
 * Used by: app/api/checkout/route.ts
 */

/** Returns the main product line-item name shown in Stripe checkout */
export function checkoutProductName(childName: string): string {
  return `ספר אישי לילדים — ${childName}`;
}

/** Returns the main product description shown in Stripe checkout */
export function checkoutProductDescription(length: string): string {
  const descriptorByLength: Record<string, string> = {
    short: 'קצר · 10 עמודים',
    medium: 'בינוני · 15 עמודים',
    long: 'ארוך · 20 עמודים',
  };
  const descriptor = descriptorByLength[length] || descriptorByLength.medium;
  return `סיפור ${descriptor} | גיבורים קטנים`;
}

/** Add-on line item names */
export const CHECKOUT_ADDONS = {
  bundle: 'קריינות + PDF + סרטון (הכל)',
  audio:  'קריינות בעברית',
  pdf:    'ספר PDF להדפסה',
  video:  'סרטון MP4',
} as const;
