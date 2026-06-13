import { describe, expect, it, vi } from 'vitest';
import {
  classifyStyle02SceneClass,
  classifyStyle02SceneClassDetailed,
  resolveStyle02BookWardrobeLock,
  STYLE02_GENERIC_WARDROBE_FALLBACK,
} from '../style02-gptimage';
import type { BookLocationBible, PageLocationPlan } from '../story-location-bible/types';

const FOX_BALCONY_ZONE: PageLocationPlan = {
  page: 5,
  zoneId: 'balcony_drip_area',
  visibleAnchors: ['same metal bucket'],
  allowedVariation: 'camera may move',
  forbiddenDrift: [],
};

const BEDROOM_ZONE: PageLocationPlan = {
  page: 1,
  zoneId: 'bedroom_window',
  visibleAnchors: ['same child bed'],
  allowedVariation: 'camera may move',
  forbiddenDrift: [],
};

const FOREST_BIBLE: BookLocationBible = {
  continuityMode: 'fantasy_world',
  primarySetting: 'magical forest village',
  allowedZones: [
    {
      id: 'enchanted_glade',
      description: 'Magical forest meadow with mushrooms and fairy lights',
      stableGeometry: ['same trail'],
      visualAnchors: ['glowing mushrooms'],
      allowedCameraAccess: ['wide'],
    },
  ],
  fixedAnchors: [],
  forbiddenDrift: [],
  transitionRules: [],
  source: 'derived',
};

describe('classifyStyle02SceneClass — lock-driven', () => {
  it('day timeOfDay → daytime subset even when text mentions lantern and Bolly', () => {
    const result = classifyStyle02SceneClassDetailed({
      effectivePageTimeOfDay: 'day',
      pageLocationPlan: BEDROOM_ZONE,
      imagePrompt:
        'close-up Bolly curled on blanket beside warm glow from indoor lantern, child in bed',
      bookPageText: 'בּוֹלִי מתקרב אליה ליד המנורה',
    });
    expect(result.source).toBe('locks');
    expect(result.sceneClass).toBe('daytime-interior');
  });

  it('night timeOfDay → night-bedroom via locks (not keyword soup)', () => {
    const result = classifyStyle02SceneClassDetailed({
      effectivePageTimeOfDay: 'night',
      pageLocationPlan: BEDROOM_ZONE,
      imagePrompt: 'child with flashlight on balcony floor',
      bookPageText: 'בלילה שקט',
    });
    expect(result.source).toBe('locks');
    expect(result.sceneClass).toBe('night-bedroom');
  });

  it('dusk counts as night for ref subset', () => {
    expect(
      classifyStyle02SceneClass({
        effectivePageTimeOfDay: 'dusk',
        pageLocationPlan: FOX_BALCONY_ZONE,
      })
    ).toBe('night-bedroom');
  });

  it('forest zone → forest-outdoor-environment regardless of warm glow words', () => {
    const result = classifyStyle02SceneClassDetailed({
      effectivePageTimeOfDay: 'day',
      pageLocationPlan: {
        ...FOX_BALCONY_ZONE,
        zoneId: 'enchanted_glade',
      },
      locationBible: FOREST_BIBLE,
      imagePrompt: 'warm glow lantern near mushrooms',
    });
    expect(result.source).toBe('locks');
    expect(result.sceneClass).toBe('forest-outdoor-environment');
  });

  it('regex fallback fires and logs when time/location locks missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = classifyStyle02SceneClassDetailed({
      imagePrompt: 'evening bedroom, soft night light, child in bed',
      bookPageText: 'מיכל שוכבת במיטה',
    });
    expect(result.source).toBe('regex-fallback');
    expect(result.sceneClass).toBe('night-bedroom');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('[style02-scene-classifier] regex fallback')
    );
    warn.mockRestore();
  });
});

describe('resolveStyle02BookWardrobeLock — single source', () => {
  it('story companion wardrobe wins over DNA clothing', () => {
    const { lock, source } = resolveStyle02BookWardrobeLock({
      companionId: 'dragon_dini',
      childStructured: { clothing: 'purple sequin dress with glitter boots' },
    });
    expect(source).toBe('story');
    expect(lock).toContain('dragon_dini_fantasy');
    expect(lock).not.toContain('purple sequin dress');
  });

  it('DNA clothing when no story wardrobe', () => {
    const clothing = 'navy hoodie, gray joggers, white sneakers';
    const { lock, source } = resolveStyle02BookWardrobeLock({
      companionId: 'fox_uri',
      childStructured: { clothing },
    });
    expect(source).toBe('dna');
    expect(lock).toBe(
      `BOOK WARDROBE LOCK (verbatim every page — same outfit all pages): ${clothing}`
    );
  });

  it('generic fallback only when DNA empty and logs', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { lock, source } = resolveStyle02BookWardrobeLock({
      companionId: 'fox_uri',
      childStructured: { clothing: '' },
    });
    expect(source).toBe('generic');
    expect(lock).toContain(STYLE02_GENERIC_WARDROBE_FALLBACK);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('[style02-wardrobe] generic fallback')
    );
    warn.mockRestore();
  });

  it('anchor and page prompts share identical lock bytes', () => {
    const clothing = 'yellow raincoat, blue boots';
    const anchor = resolveStyle02BookWardrobeLock({
      companionId: 'fox_uri',
      childStructured: { clothing },
    }).lock;
    const page = resolveStyle02BookWardrobeLock({
      companionId: 'fox_uri',
      childStructured: { clothing },
    }).lock;
    expect(page).toBe(anchor);
  });
});

describe('classifyStyle02SceneClass — fantasy_world bedroom', () => {
  it('day bedroom in fantasy_world book → daytime-interior, not forest-magical', () => {
    const result = classifyStyle02SceneClassDetailed({
      effectivePageTimeOfDay: 'day',
      pageLocationPlan: {
        page: 1,
        zoneId: 'story_default',
        visibleAnchors: ['same child bedroom'],
        allowedVariation: 'camera may move',
        forbiddenDrift: [],
      },
      locationBible: {
        continuityMode: 'fantasy_world',
        primarySetting: 'child bedroom and dragon world',
        allowedZones: [
          {
            id: 'story_default',
            description: 'Same child bedroom with toy chest and yellow blanket',
            stableGeometry: ['bed against wall'],
            visualAnchors: ['same child bedroom'],
            allowedCameraAccess: ['medium wide'],
          },
        ],
        fixedAnchors: [],
        forbiddenDrift: [],
        transitionRules: [],
        source: 'derived',
      },
      imagePrompt: 'child sits alone on the bed with yellow blanket nearby',
    });
    expect(result.source).toBe('locks');
    expect(result.sceneClass).toBe('daytime-interior');
  });
});
