/**
 * Re-exports for code that still imports the visual pipeline profile from
 * `backend/config/visual-system`. Canonical style data lives in `lib/styles.ts`.
 */
import type { DatabaseIllustrationStyle, StyleProfile } from '../../lib/styles';

export type FinalIllustrationStyle = DatabaseIllustrationStyle;
export type { StyleProfile };
export { STYLE_PROFILES, normalizeIllustrationStyle } from '../../lib/styles';
