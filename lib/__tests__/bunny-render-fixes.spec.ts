import { afterEach, describe, expect, it } from 'vitest';
import { assembleStyle01Phase2Prompt, sanitizeCloseUpLanguage } from '../style01-prompt-assembly';
import { derivePageEntityPresence } from '../image-entity-presence';
import { buildScenarioSettingLockBlock, resolveScenarioSettingLock } from '../scenario-setting-lock';
import {
  STYLE_01_FRAMING_RULE,
  assertCompanionSheetRenderable,
  resolveStyle01CompanionReferencePaths,
} from '../style01-gptimage';

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

describe('missing companion sheet — fail loudly (no weak fallbacks)', () => {
  it('throws for a sheet-less companion (bunny_ometz) by default', () => {
    delete process.env[ENV_KEY];
    expect(() =>
      resolveStyle01CompanionReferencePaths({
        companionId: 'bunny_ometz',
        companionImage: '/companions/GENERAL_FEARS/bunny_ometz.jpg',
        companionPresence: 'present',
      })
    ).toThrow(/Missing companion character sheet for bunny_ometz/);
    expect(() => assertCompanionSheetRenderable({ id: 'bunny_ometz', image: '/companions/GENERAL_FEARS/bunny_ometz.jpg' })).toThrow(
      /cannot render book/
    );
  });

  it('allows the single-image fallback only with the dev escape hatch', () => {
    process.env[ENV_KEY] = 'true';
    const refs = resolveStyle01CompanionReferencePaths({
      companionId: 'bunny_ometz',
      companionImage: '/companions/GENERAL_FEARS/bunny_ometz.jpg',
      companionPresence: 'present',
    });
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatch(/bunny_ometz\.jpg$/);
  });

  it('passes for companions with published sheets and for no-companion orders', () => {
    delete process.env[ENV_KEY];
    expect(() => assertCompanionSheetRenderable({ id: 'dragon_dini', image: '/companions/dragon_dini.png' })).not.toThrow();
    expect(() => assertCompanionSheetRenderable(null)).not.toThrow();
  });
});
