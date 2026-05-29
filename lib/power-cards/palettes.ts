import type { PowerCardPalette } from './types';

export type PowerCardPaletteTokens = {
  bg: string;
  bgGradient: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  borderGlow: string;
};

export const POWER_CARD_PALETTES: Record<PowerCardPalette, PowerCardPaletteTokens> = {
  moonlit: {
    bg: '#1a1f3a',
    bgGradient: 'linear-gradient(135deg, #1a1f3a 0%, #2d3561 50%, #1a1f3a 100%)',
    textPrimary: '#f5f3ff',
    textSecondary: '#cbd5e1',
    accent: '#fbbf24',
    borderGlow: 'rgba(251, 191, 36, 0.3)',
  },
  'earth-warm': {
    bg: '#fef3e2',
    bgGradient: 'linear-gradient(135deg, #fef3e2 0%, #fde4b5 50%, #f5d59e 100%)',
    textPrimary: '#7c2d12',
    textSecondary: '#92400e',
    accent: '#dc2626',
    borderGlow: 'rgba(220, 38, 38, 0.2)',
  },
  'magical-cool': {
    bg: '#1e1b4b',
    bgGradient: 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 50%, #1e1b4b 100%)',
    textPrimary: '#f5f3ff',
    textSecondary: '#c4b5fd',
    accent: '#a78bfa',
    borderGlow: 'rgba(167, 139, 250, 0.4)',
  },
} as const;

export function paletteForDirection(
  direction: 'bedtime' | 'adventure' | 'fantasy'
): PowerCardPalette {
  if (direction === 'bedtime') return 'moonlit';
  if (direction === 'adventure') return 'earth-warm';
  return 'magical-cool';
}

export function paletteCssVars(palette: PowerCardPalette): Record<string, string> {
  const tokens = POWER_CARD_PALETTES[palette];
  return {
    '--pc-bg': tokens.bg,
    '--pc-bg-gradient': tokens.bgGradient,
    '--pc-text-primary': tokens.textPrimary,
    '--pc-text-secondary': tokens.textSecondary,
    '--pc-accent': tokens.accent,
    '--pc-border-glow': tokens.borderGlow,
  };
}
