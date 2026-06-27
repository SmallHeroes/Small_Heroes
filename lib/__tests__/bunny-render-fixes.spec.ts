import { afterEach, describe, expect, it } from 'vitest';
import { assembleStyle01Phase2Prompt, sanitizeCloseUpLanguage } from '../style01-prompt-assembly';
import { derivePageEntityPresence } from '../image-entity-presence';
import { buildScenarioSettingLockBlock, resolveScenarioSettingLock } from '../scenario-setting-lock';
import {
  STYLE_01_FRAMING_RULE,
  assertCompanionSheetRenderable,
  buildStyle01CompanionTextLock,
  resolveStyle01CompanionReferencePaths,
} from '../style01-gptimage';
import { buildStyle02CompanionTextLock } from '../style02-gptimage';
import { resolveCompanionLockSource } from '../companion-lock-source';

/** Bunny v3 order cmq82b5f3 page 1 — imageDirection omits the child; Hebrew text has her. */
const BUNNY_P1_IMAGE_DIRECTION =
  'close\u2011up of springy bunny ears popping up as nurse opens the door';
const BUNNY_P1_TEXT =
  'בּוּנִי־אומץ יושב על השולחן, והאוזניים שלו קופצות מעצמן בדיוק כשהאחות נכנסת. יובל יושבת ישר, מנסה שהלב לא ידפוק בקול רם מדי.';

const ENV_KEY = 'ALLOW_SINGLE_IMAGE_COMPANION_REF';
const envBefore = process.env[ENV_KEY];

afterEach(() => {
  if (envBefore === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = envBefore;
});

describe('child presence — page text fallback (bunny p1 regression)', () => {
  it('classifies child present when imageDirection omits her but page text names her', () => {
    const presence = derivePageEntityPresence({
      imageDirection: BUNNY_P1_IMAGE_DIRECTION,
      bookPageText: BUNNY_P1_TEXT,
      childFirstName: 'יובל',
      companionName: 'הארנבון בּוּנִי',
      companionId: 'bunny_ometz',
    });
    expect(presence.childPresence).toBe('present');
    expect(presence.forbiddenEntities).not.toContain('human child');
  });

  it('keeps child absent on environment/object subjects even when text names the child', () => {
    for (const imageSubject of ['environment', 'object']) {
      const presence = derivePageEntityPresence({
        imageDirection: 'wide shot of the empty clinic corridor at dusk',
        bookPageText: BUNNY_P1_TEXT,
        childFirstName: 'יובל',
        visualDirection: { imageSubject },
      });
      expect(presence.childPresence).toBe('absent');
    }
  });

  it('binds CHILD VISUAL LOCK in the assembled prompt for the bunny p1 inputs', () => {
    const { prompt, entityPresence } = assembleStyle01Phase2Prompt({
      pageNumber: 1,
      rawScenePrompt: BUNNY_P1_IMAGE_DIRECTION,
      bookPageText: BUNNY_P1_TEXT,
      childFirstName: 'יובל',
      childAge: 7,
      childGender: 'girl',
      childDescription: 'oval face, long light brown curly hair',
      companion: { id: 'bunny_ometz', name: 'הארנבון בּוּנִי', visualDescription: 'stuffed gray rabbit toy' },
    });
    expect(entityPresence.childPresence).toBe('present');
    expect(prompt).toMatch(/CHILD VISUAL LOCK/);
    expect(prompt).not.toMatch(/CRITICAL:\s*NO human child/i);
  });
});

describe('scenario setting lock (category controls LOCATION, direction controls format)', () => {
  it('maps MEDICAL_PROCEDURE to the pediatric clinic lock', () => {
    const lock = resolveScenarioSettingLock('MEDICAL_PROCEDURE');
    expect(lock).toMatch(/pediatric clinic/);
    expect(lock).toMatch(/NOT a bedroom/);
  });

  it('returns no lock for unknown/empty categories', () => {
    expect(resolveScenarioSettingLock(null)).toBeNull();
    expect(resolveScenarioSettingLock('SOME_FUTURE_CATEGORY')).toBeNull();
    expect(buildScenarioSettingLockBlock(undefined)).toBe('');
  });

  it('injects the clinic lock into every page prompt when category set', () => {
    const { prompt } = assembleStyle01Phase2Prompt({
      pageNumber: 3,
      rawScenePrompt: 'bunny leaning in, whispering exaggeratedly',
      bookPageText: BUNNY_P1_TEXT,
      childFirstName: 'יובל',
      challengeCategory: 'MEDICAL_PROCEDURE',
      companion: { id: 'bunny_ometz', name: 'הארנבון בּוּנִי', visualDescription: 'stuffed gray rabbit toy' },
    });
    expect(prompt).toMatch(/SCENARIO SETTING LOCK/);
    expect(prompt).toMatch(/calm pediatric clinic/);
    expect(prompt).toMatch(/NOT a bedroom/);
  });

  it('omits the block when category has no mapping', () => {
    const { prompt } = assembleStyle01Phase2Prompt({
      pageNumber: 3,
      rawScenePrompt: 'bunny leaning in, whispering exaggeratedly',
      childFirstName: 'יובל',
      companion: { id: 'bunny_ometz', name: 'הארנבון בּוּנִי', visualDescription: 'stuffed gray rabbit toy' },
    });
    expect(prompt).not.toMatch(/SCENARIO SETTING LOCK/);
  });
});

describe('close-up sanitization (giant-portrait drift)', () => {
  it('strips ASCII and unicode-hyphen close-up wording when not explicitly chosen', () => {
    expect(sanitizeCloseUpLanguage('close-up of springy bunny ears')).toBe(
      'view of springy bunny ears'
    );
    expect(sanitizeCloseUpLanguage(BUNNY_P1_IMAGE_DIRECTION)).not.toMatch(/close.?up/i);
    expect(sanitizeCloseUpLanguage('soft close-up, one bunny ear tipping goodbye')).toBe(
      'medium view, one bunny ear tipping goodbye'
    );
  });

  it('keeps close-up wording when storyboard explicitly chose close_up', () => {
    expect(sanitizeCloseUpLanguage('close-up of trembling hands', true)).toBe(
      'close-up of trembling hands'
    );
  });

  it('sanitizes the assembled scene line', () => {
    const { sceneDescription } = assembleStyle01Phase2Prompt({
      pageNumber: 1,
      rawScenePrompt: BUNNY_P1_IMAGE_DIRECTION,
      bookPageText: BUNNY_P1_TEXT,
      childFirstName: 'יובל',
      companion: { id: 'bunny_ometz', name: 'הארנבון בּוּנִי', visualDescription: 'stuffed gray rabbit toy' },
    });
    expect(sceneDescription).not.toMatch(/close.?up/i);
  });

  it('BREATHE framing rule carries the medium-wide full-figure sentence', () => {
    expect(STYLE_01_FRAMING_RULE).toMatch(/Medium-wide storybook scene/);
    expect(STYLE_01_FRAMING_RULE).toMatch(/no giant cropped faces/);
  });
});

// Gap 1 (forensics addendum): DNA text that contradicted the canonical bunny on order cmq82b5f3.
const CONTAMINATED_DNA_STRUCTURED = {
  species: 'Stuffed rabbit toy',
  size: 'small, plush',
  coloring: 'Soft gray fur with white inner ears',
  feature: 'button eyes and stitched nose',
};

describe('COMPANION LOCK source — registry visualDescription ONLY for registry companions (Gap 1)', () => {
  it('bunny order lock carries cream/heart-badge registry text, never stuffed/gray DNA', () => {
    const lock = buildStyle01CompanionTextLock({
      companionId: 'bunny_ometz',
      companionName: 'הארנבון בּוּנִי',
      companionStructured: CONTAMINATED_DNA_STRUCTURED,
      companionVisualDescription: 'Stuffed rabbit toy with soft gray fur',
    });
    expect(lock).toMatch(/cream-white/);
    expect(lock).toMatch(/heart-shaped badge/);
    expect(lock).not.toMatch(/stuffed/i);
    expect(lock).not.toMatch(/gray/i);
  });

  it('rule is horizontal — ANY registry companion ignores LLM DNA (fox_uri)', () => {
    const lock = buildStyle01CompanionTextLock({
      companionId: 'fox_uri',
      companionName: 'fox uri',
      companionStructured: {
        species: 'Orange fox',
        size: 'large',
        coloring: 'Orange fur',
        feature: 'bushy tail',
      },
      companionVisualDescription: 'Orange fur fox',
    });
    expect(resolveCompanionLockSource({ companionId: 'fox_uri' }).source).toBe('registry');
    expect(lock).not.toMatch(/Orange fur/);
  });

  it('DNA is still allowed for non-registry dynamic entities', () => {
    const lock = buildStyle01CompanionTextLock({
      companionId: 'baby_creature_oneoff',
      companionName: 'baby cloud',
      companionStructured: {
        species: 'tiny cloud spirit',
        size: 'palm-sized',
        coloring: 'pearl white',
        feature: 'misty trailing tail',
      },
    });
    expect(lock).toMatch(/tiny cloud spirit/);
    expect(resolveCompanionLockSource({ companionId: 'baby_creature_oneoff' }).source).toBe('none');
  });

  it('applies to Style 02 lock builder as well', () => {
    const lock = buildStyle02CompanionTextLock({
      companionId: 'bunny_ometz',
      companionName: 'הארנבון בּוּנִי',
      companionStructured: CONTAMINATED_DNA_STRUCTURED,
      companionVisualDescription: 'Stuffed rabbit toy with soft gray fur',
    });
    expect(lock).toMatch(/cream-white/);
    expect(lock).not.toMatch(/stuffed|gray/i);
  });

  it('assembled bunny page prompt carries the registry lock end-to-end', () => {
    const { prompt } = assembleStyle01Phase2Prompt({
      pageNumber: 1,
      rawScenePrompt: BUNNY_P1_IMAGE_DIRECTION,
      bookPageText: BUNNY_P1_TEXT,
      childFirstName: 'יובל',
      companion: {
        id: 'bunny_ometz',
        name: 'הארנבון בּוּנִי',
        visualDescription: 'Stuffed rabbit toy with soft gray fur',
      },
      companionStructured: CONTAMINATED_DNA_STRUCTURED,
    });
    expect(prompt).toMatch(/cream-white/);
    expect(prompt).toMatch(/heart-shaped badge/);
    expect(prompt).not.toMatch(/stuffed/i);
    expect(prompt).not.toMatch(/Soft gray fur/i);
  });
});

describe('visual polish — smoke #2 brief (cover locks, expression, gaze, size, p1 fidelity)', () => {
  const childStructured = {
    face: 'Oval face shape, light olive skin tone. Almond-shaped brown eyes. Prominent cheeks.',
    hair: 'Long, light brown curly hair that falls past the shoulders.',
    body: 'Build and height appropriate for a 7-year-old girl.',
    clothing: 'sky-blue t-shirt with yellow sun, denim shorts, red sneakers',
    signature: 'prominent cheek',
  };

  it('cover assembly includes full child locks + cover composition (not interior framing)', () => {
    const { prompt, entityPresence } = assembleStyle01Phase2Prompt({
      pageNumber: 0,
      assetType: 'cover',
      storyTitle: 'האוזניים של בּוּנִי־אומץ',
      coverText: 'hook',
      topicLabel: 'טיפולים רפואיים',
      coverSceneHint: 'child and bunny in clinic waiting room',
      childFirstName: 'יובל',
      childAge: 7,
      childGender: 'girl',
      childStructured,
      challengeCategory: 'MEDICAL_PROCEDURE',
      companion: { id: 'bunny_ometz', name: 'הארנבון בּוּנִי', visualDescription: 'cream-white bunny' },
    });
    expect(entityPresence.childPresence).toBe('present');
    expect(prompt).toMatch(/CHILD VISUAL LOCK/);
    expect(prompt).toMatch(/BOOK WARDROBE LOCK/);
    expect(prompt).toMatch(/CHILD ANATOMICAL LOCK/);
    expect(prompt).toMatch(/COVER COMPOSITION/);
    expect(prompt).toMatch(/TITLE-SAFE BAND/);
    expect(prompt).not.toMatch(/FRAMING RULE — BREATHE/);
    // The dead "COMPANION SIZE vs CHILD: keep the exact registry size relation" polish line was
    // removed (pointed at non-existent data). Companion size is verified via the registry scale text;
    // the canonical scale lock now lives in the flag-gated VCC contract block.
    expect(prompt).toMatch(/25–35%/);
    expect(prompt).toMatch(/SCENARIO SETTING LOCK/);
    expect(prompt).toMatch(/pediatric clinic/);
  });

  it('p1 carries PAGE EXPRESSION, scene fidelity, and companion size lock', () => {
    const { prompt } = assembleStyle01Phase2Prompt({
      pageNumber: 1,
      rawScenePrompt: BUNNY_P1_IMAGE_DIRECTION,
      bookPageText: BUNNY_P1_TEXT,
      childFirstName: 'יובל',
      childAge: 7,
      childGender: 'girl',
      childStructured,
      challengeCategory: 'MEDICAL_PROCEDURE',
      companion: { id: 'bunny_ometz', name: 'הארנבון בּוּנִי', visualDescription: 'cream-white bunny' },
    });
    expect(prompt).toMatch(/PAGE EXPRESSION:.*curious and slightly nervous/i);
    expect(prompt).toMatch(/PAGE SCENE FIDELITY/);
    expect(prompt).toMatch(/INSIDE the clinic room/);
    expect(prompt).toMatch(/Do NOT hide Bunny behind the door/);
    // Dead polish size line removed — verify the surviving registry companion-size lock instead.
    expect(prompt).toMatch(/Never waist-high|25–35%/);
    expect(prompt).toMatch(/SCENE INTERACTION \/ GAZE/);
  });

  it('p6 carries brave-uncertainty expression and mutual gaze for thermometer beat', () => {
    const { prompt } = assembleStyle01Phase2Prompt({
      pageNumber: 6,
      rawScenePrompt: 'nurse leaning in with thermometer, child hand slightly forward',
      bookPageText:
        'האחות מתקרבת עם המדחום. יובל מזיזה יד קטנה קדימה, כמו אוזן במשחק, סימן סודי לעצמה.',
      childFirstName: 'יובל',
      childAge: 7,
      childGender: 'girl',
      childStructured,
      challengeCategory: 'MEDICAL_PROCEDURE',
      companion: { id: 'bunny_ometz', name: 'הארנבון בּוּנִי', visualDescription: 'cream-white bunny' },
    });
    expect(prompt).toMatch(/PAGE EXPRESSION:.*NOT a broad smile/i);
    expect(prompt).toMatch(/SCENE INTERACTION \/ GAZE/);
    expect(prompt).toMatch(/NOT at the camera/);
  });
});

describe('general integrity locks (anatomy, mentioned-character, reflection)', () => {
  const childStructured = {
    face: 'Oval face',
    hair: 'Long curly hair',
    body: '7-year-old girl',
    clothing: 'sky-blue shirt',
    signature: 'cheeks',
  };

  it('always injects ANATOMY INTEGRITY on interior pages', () => {
    const { prompt } = assembleStyle01Phase2Prompt({
      pageNumber: 2,
      rawScenePrompt: 'bunny mid-sneeze, ears springing with motion lines',
      bookPageText: 'אפצי!',
      childFirstName: 'יובל',
      companion: { id: 'bunny_ometz', name: 'בּוּנִי', visualDescription: 'cream bunny' },
    });
    expect(prompt).toMatch(/ANATOMY INTEGRITY/);
    expect(prompt).toMatch(/never detach or float/i);
  });

  it('requires nurse presence when prose describes her acting (p4/p8)', () => {
    const { prompt } = assembleStyle01Phase2Prompt({
      pageNumber: 4,
      rawScenePrompt: 'bunny on chair shouting, child hushing',
      bookPageText: 'האחות מרימה עיניים ומחייכת בשקט.',
      childFirstName: 'יובל',
      childStructured,
      challengeCategory: 'MEDICAL_PROCEDURE',
      companion: { id: 'bunny_ometz', name: 'בּוּנִי', visualDescription: 'cream bunny' },
    });
    expect(prompt).toMatch(/MENTIONED-CHARACTER PRESENCE/);
    expect(prompt).toMatch(/Nurse.*MUST appear/i);
  });

  it('injects REFLECTION RULE when mirror is in scene (p5)', () => {
    const { prompt } = assembleStyle01Phase2Prompt({
      pageNumber: 5,
      rawScenePrompt: 'child and bunny in front of clinic mirror, both reflected',
      bookPageText: '{{childName}} מסתכלת במראה הקטנה.',
      childFirstName: 'יובל',
      companion: { id: 'bunny_ometz', name: 'בּוּנִי', visualDescription: 'cream bunny' },
    });
    expect(prompt).toMatch(/REFLECTION RULE/);
    expect(prompt).toMatch(/physical character must also be visible/i);
  });
});

describe('missing companion sheet — fail loudly (no weak fallbacks)', () => {
  it('throws for a sheet-less companion (turtle_beiti) by default', () => {
    delete process.env[ENV_KEY];
    expect(() =>
      resolveStyle01CompanionReferencePaths({
        companionId: 'turtle_beiti',
        companionImage: '/companions/TRANSITION/turtle_beiti.jpg',
        companionPresence: 'present',
      })
    ).toThrow(/Missing companion character sheet for turtle_beiti/);
    expect(() => assertCompanionSheetRenderable({ id: 'turtle_beiti', image: '/companions/TRANSITION/turtle_beiti.jpg' })).toThrow(
      /cannot render book/
    );
  });

  it('allows the single-image fallback only with the dev escape hatch', () => {
    process.env[ENV_KEY] = 'true';
    const refs = resolveStyle01CompanionReferencePaths({
      companionId: 'turtle_beiti',
      companionImage: '/companions/TRANSITION/turtle_beiti.jpg',
      companionPresence: 'present',
    });
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatch(/turtle_beiti\.jpg$/);
  });

  it('passes for companions with published sheets and for no-companion orders', () => {
    delete process.env[ENV_KEY];
    expect(() => assertCompanionSheetRenderable({ id: 'dragon_dini', image: '/companions/dragon_dini.png' })).not.toThrow();
    expect(() => assertCompanionSheetRenderable(null)).not.toThrow();
  });
});
