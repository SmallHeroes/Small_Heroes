import { bookTypographyCssVars } from './typography-tokens';
import type { StoryDirection } from './types';

export type DirectionTemplate = {
  id: `${StoryDirection}-v1`;
  direction: StoryDirection;
  palette: {
    paperBg: string;
    paperBgCss: string;
    text: string;
    textMuted: string;
    accent: string;
    accentSecondary: string;
    imagePlaceholder: string;
    tableWood: string;
  };
  typography: {
    bodyDesktopPx: string;
    bodyMobilePx: string;
    lineHeight: number;
    displayWeight: number;
    proseWeight: number;
    proseEmphasisWeight: number;
  };
  runningHeaderOrnament: string;
  scatteredMotif: string;
  accentClusterPosition: 'top-right' | 'top-left';
  signatureOrnament: string;
  borderFrame: string;
  accentClusterSvg: string;
  /** Optional second scattered mark (e.g. bedtime crescent). */
  scatteredMotifMoon?: string;
};

const STAR_ORNAMENT =
  '<svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true"><path fill="currentColor" d="M12 2l2.2 6.8H21l-5.5 4 2.1 6.8L12 16.8 6.4 19.6l2.1-6.8L3 8.8h6.8z"/></svg>';

const LEAF_ORNAMENT =
  '<svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true"><path fill="currentColor" d="M12 3c-4 6-5 10-5 14 4-1 8-3 10-6 1-4-1-7 2-8 5-1 3 1 6 4 7 2 4 4 6 7 6 3-1 5-4 5-7 0-3 2-5 5-6 3-1 5-3 5-6z"/></svg>';

const SPARKLE_ORNAMENT =
  '<svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true"><path fill="currentColor" d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg>';

const MOON_CLUSTER =
  '<svg viewBox="0 0 80 80" width="72" height="72" aria-hidden="true"><circle cx="52" cy="28" r="18" fill="currentColor" opacity="0.35"/><circle cx="30" cy="40" r="3" fill="currentColor" opacity="0.5"/><circle cx="48" cy="52" r="2" fill="currentColor" opacity="0.4"/><circle cx="62" cy="46" r="2.5" fill="currentColor" opacity="0.45"/></svg>';

const LEAF_CLUSTER =
  '<svg viewBox="0 0 80 80" width="64" height="64" aria-hidden="true"><path fill="currentColor" opacity="0.4" d="M40 8c-8 14-12 28-12 40 6-2 12-6 14-12 2 8 8 14 16 16-2-10 2-18 10-22 4-8 4-16-8-22z"/></svg>';

const THREAD_CLUSTER =
  '<svg viewBox="0 0 80 80" width="64" height="64" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" opacity="0.45" d="M12 60 Q40 20 68 24"/><circle cx="68" cy="24" r="4" fill="currentColor" opacity="0.5"/></svg>';

const SPRIG =
  '<svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><path fill="currentColor" opacity="0.35" d="M16 28V8M16 8Q8 12 6 18M16 8Q24 12 26 18"/></svg>';

export const DIRECTION_TEMPLATES: Record<StoryDirection, DirectionTemplate> = {
  bedtime: {
    id: 'bedtime-v1',
    direction: 'bedtime',
    palette: {
      paperBg: '#e8d9b4',
      paperBgCss: 'linear-gradient(168deg, #ebe0c0 0%, #e4d4aa 42%, #ddc99e 100%)',
      text: '#2e2618',
      textMuted: '#6b5d48',
      accent: '#1e3a5f',
      accentSecondary: '#a88432',
      imagePlaceholder: '#e8dfd0',
      tableWood: '#3d2e22',
    },
    typography: {
      bodyDesktopPx: 'clamp(22px, 1.45vw, 26px)',
      bodyMobilePx: 'clamp(20px, 4.5vw, 24px)',
      lineHeight: 1.6,
      displayWeight: 500,
      proseWeight: 400,
      proseEmphasisWeight: 500,
    },
    runningHeaderOrnament: STAR_ORNAMENT,
    scatteredMotif: STAR_ORNAMENT,
    accentClusterPosition: 'top-right',
    signatureOrnament: SPRIG,
    borderFrame: 'none',
    accentClusterSvg: MOON_CLUSTER,
    scatteredMotifMoon: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M18 14a6 6 0 1 1-8-8 6 6 0 0 1 8 8z" opacity="0.85"/></svg>',
  },
  adventure: {
    id: 'adventure-v1',
    direction: 'adventure',
    palette: {
      paperBg: '#e6d4b0',
      paperBgCss: 'linear-gradient(168deg, #ebe2c4 0%, #e0d2ac 50%, #d8c8a0 100%)',
      text: '#2a2216',
      textMuted: '#6a5c44',
      accent: '#2d5a3d',
      accentSecondary: '#8b5e34',
      imagePlaceholder: '#e5dcc8',
      tableWood: '#3a2a1c',
    },
    typography: {
      bodyDesktopPx: 'clamp(22px, 1.45vw, 26px)',
      bodyMobilePx: 'clamp(20px, 4.5vw, 24px)',
      lineHeight: 1.6,
      displayWeight: 500,
      proseWeight: 400,
      proseEmphasisWeight: 500,
    },
    runningHeaderOrnament: LEAF_ORNAMENT,
    scatteredMotif: LEAF_ORNAMENT,
    accentClusterPosition: 'top-right',
    signatureOrnament: SPRIG,
    borderFrame: 'none',
    accentClusterSvg: LEAF_CLUSTER,
    scatteredMotifMoon: '',
  },
  fantasy: {
    id: 'fantasy-v1',
    direction: 'fantasy',
    palette: {
      paperBg: '#e4dcc8',
      paperBgCss: 'linear-gradient(168deg, #ebe4d4 0%, #e0d6c4 50%, #d6ccba 100%)',
      text: '#261e2e',
      textMuted: '#5c5068',
      accent: '#2a3d6b',
      accentSecondary: '#9b6b2f',
      imagePlaceholder: '#e0d8e8',
      tableWood: '#352838',
    },
    typography: {
      bodyDesktopPx: 'clamp(22px, 1.45vw, 26px)',
      bodyMobilePx: 'clamp(20px, 4.5vw, 24px)',
      lineHeight: 1.6,
      displayWeight: 500,
      proseWeight: 400,
      proseEmphasisWeight: 500,
    },
    runningHeaderOrnament: SPARKLE_ORNAMENT,
    scatteredMotif: SPARKLE_ORNAMENT,
    accentClusterPosition: 'top-right',
    signatureOrnament: SPRIG,
    borderFrame: 'none',
    accentClusterSvg: THREAD_CLUSTER,
    scatteredMotifMoon: '',
  },
};

export function getDirectionTemplate(direction: StoryDirection | string | null | undefined): DirectionTemplate {
  const d = (direction ?? 'adventure').toLowerCase();
  if (d === 'bedtime') return DIRECTION_TEMPLATES.bedtime;
  if (d === 'fantasy') return DIRECTION_TEMPLATES.fantasy;
  return DIRECTION_TEMPLATES.adventure;
}

export function templateCssVars(template: DirectionTemplate): Record<string, string> {
  const p = template.palette;
  const t = template.typography;
  return {
    ...bookTypographyCssVars(),
    '--book-paper-bg': p.paperBg,
    '--book-paper-bg-css': p.paperBgCss,
    '--book-text': p.text,
    '--book-text-muted': p.textMuted,
    '--book-accent': p.accent,
    '--book-accent-secondary': p.accentSecondary,
    '--book-image-placeholder': p.imagePlaceholder,
    '--book-table-wood': p.tableWood,
    '--book-body-desktop': t.bodyDesktopPx,
    '--book-body-mobile': t.bodyMobilePx,
    '--book-line-height': String(t.lineHeight),
    '--book-display-weight': String(t.displayWeight),
    '--book-prose-weight': String(t.proseWeight),
    '--book-prose-emphasis-weight': String(t.proseEmphasisWeight),
    '--book-border-frame': template.borderFrame,
  };
}
