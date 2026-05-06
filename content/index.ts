/**
 * content/index.ts — Central content export
 *
 * Import from here in components and API routes:
 *   import { COMMON, WIZARD, PROGRESS } from '@/content';
 *   import { checkoutProductName, CHECKOUT_ADDONS } from '@/content';
 *
 * All exports are fully typed and tree-shakeable.
 */

export { COMMON }                                        from './ui/he/common';
export { LANDING }                                       from './ui/he/landing';
export { PRICING }                                       from './ui/he/pricing';
export { FAQ }                                           from './ui/he/faq';
export { WIZARD }                                        from './ui/he/wizard';
export { PROGRESS }                                      from './ui/he/progress';
export { READY, READER }                                 from './ui/he/success';
export { EMAIL }                                         from './ui/he/email';
export { CHECKOUT_ADDONS, checkoutProductName, checkoutProductDescription } from './ui/he/checkout';
