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
    bg: '#FFFCF1',
    bgGradient: 'linear-gradient(180deg, #fffbe8 0%, #ffffff 92%)',
    textPrimary: '#18171a',
    textSecondary: '#5f5a70',
    accent: '#886cff',
    borderGlow: 'rgba(255, 238, 108, 0.55)',
  },
  'earth-warm': {
    bg: '#FFFCF1',
    bgGradient: 'linear-gradient(180deg, #fff9e6 0%, #ffffff 94%)',
    textPrimary: '#18171a',
    textSecondary: '#5f5a70',
    accent: '#886cff',
    borderGlow: 'rgba(255, 238, 108, 0.5)',
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
