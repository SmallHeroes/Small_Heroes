import type { StoryDirection, StoryPageCount } from '@/lib/story-validators';

export const PAGE_COUNT_BY_DIRECTION: Record<StoryDirection, StoryPageCount> = {
  bedtime: 10,
  adventure: 15,
  fantasy: 20,
};

export const MOMENT_WINDOWS: Record<StoryDirection, [number, number]> = {
  bedtime: [5, 7],
  adventure: [8, 11],
  fantasy: [12, 15],
};

export interface DirectionDNA {
  direction: StoryDirection;
  pageCount: StoryPageCount;
  momentWindow: [number, number];
  companionIntroByPage: number;
  arcSummary: string;
  beatGuidance: string[];
}

const DNA: Record<StoryDirection, DirectionDNA> = {
  bedtime: {
    direction: 'bedtime',
    pageCount: 10,
    momentWindow: [5, 7],
    companionIntroByPage: 3,
    arcSummary: 'Evening wind-down: sensory overload → co-regulation → body settles → sleep residue.',
    beatGuidance: [
      'Pages 1-2: child resists bed / room feels too big.',
      'Page 3: companion introduced with signature sound/object.',
      'Pages 4-5: failed strategy (trying too hard) — body still tight.',
      'Pages 5-7: unforgettable moment — small physical action, not lesson.',
      'Pages 8-9: quieter pacing, hook repeats softly.',
      'Page 10: sensory residue (blanket, breath, warm object) — no moral.',
    ],
  },
  adventure: {
    direction: 'adventure',
    pageCount: 15,
    momentWindow: [8, 11],
    companionIntroByPage: 3,
    arcSummary: 'Daytime curiosity: obstacle → playful tries → comic setback → discovery → earned calm.',
    beatGuidance: [
      'Pages 1-3: ordinary world + companion meets child early.',
      'Pages 4-6: rising movement, two different paces (quiet vs active).',
      'Pages 8-11: peak moment with companion-specific physical signature.',
      'Pages 12-14: aftermath in body, hook echo.',
      'Page 15: small residue object/sound, not a speech.',
    ],
  },
  fantasy: {
    direction: 'fantasy',
    pageCount: 20,
    momentWindow: [12, 15],
    companionIntroByPage: 5,
    arcSummary: 'Imaginative world-rule: wonder → symbolic threat → companion carries rule → sacrifice/touch → return changed.',
    beatGuidance: [
      'Pages 1-4: establish world-rule visually, child as guest.',
      'Page 5: companion enters (unless premise is searching for them).',
      'Pages 6-11: escalating wonder with varied locations.',
      'Pages 12-15: central moment — physical, character-specific, not generic bravery.',
      'Pages 16-20: denouement, hook ritual, sensory ending.',
    ],
  },
};

export function getDirectionDNA(direction: StoryDirection): DirectionDNA {
  return DNA[direction];
}

export function resolvePageCount(direction: StoryDirection, override?: StoryPageCount): StoryPageCount {
  return override ?? PAGE_COUNT_BY_DIRECTION[direction];
}

export function formatDirectionDNAForPrompt(direction: StoryDirection): string {
  const d = getDirectionDNA(direction);
  return [
    `Direction: ${d.direction}`,
    `Page count: ${d.pageCount} (exact)`,
    `Moment window: pages ${d.momentWindow[0]}-${d.momentWindow[1]}`,
    `Companion must appear by page ${d.companionIntroByPage}`,
    `Arc: ${d.arcSummary}`,
    'Beat guidance:',
    ...d.beatGuidance.map((b) => `- ${b}`),
  ].join('\n');
}
