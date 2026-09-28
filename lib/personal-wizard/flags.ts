/**
 * Explicit server-side switches for the personal Wizard prototype. Default OFF.
 *
 * They add to (never replace) the existing gates: middleware 404s every /dev and /api/dev route on
 * real production, and `isDevEnvironment()` admits only local development or an opted-in
 * non-production Vercel runtime. NODE_ENV alone is not treated as the preview boundary.
 */
export function isPersonalWizardPreviewEnabled(): boolean {
  return process.env.PERSONAL_WIZARD_PREVIEW === 'true';
}
