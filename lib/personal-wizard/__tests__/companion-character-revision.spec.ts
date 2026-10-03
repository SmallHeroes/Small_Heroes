import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import baseline from './companion-character-base-b60251b6.json';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { personalCharacterSchema, resolvePersonalCompanionCharacter } from '../companion-character';
import { PROTOTYPE_COMPANION_ROSTER, resolvePersonalWizardOptions } from '../options';
import { canonicalJson, acceptPersonalBookRequest } from '../request-acceptance';
import { preparePersonalStory } from '../story-writer';
import { prepareStoryEdit } from '../story-editor';
import { preparePersonalStoryboard } from '../storyboard';
import { prepareStoryTextReview } from '../story-text-review';
import { personalStoryResultSchema } from '../story-contract';

const options = resolvePersonalWizardOptions();
const previousCharacters: Record<string, typeof baseline.characters.dragon_dini> = baseline.characters;
const hash = (v: unknown) => createHash('sha256').update(canonicalJson(v)).digest('hex');
const candidates = ['elephant_momo', 'turtle_tuk', 'hedgehog_tuti', 'owl_shush',
  'kangaroo_nula', 'dog_zohar', 'cloud_puf', 'ibex_tzuki', 'mole_mishi'];

describe('bounded literary revision without new physical canon or candidate admission', () => {
  it('preserves the exact six offered identities, not fifteen prematurely enabled cards', () => {
    expect(PROTOTYPE_COMPANION_ROSTER).toEqual(Object.keys(baseline.characters));
    expect(options.companions.map(c => c.id)).toEqual(PROTOTYPE_COMPANION_ROSTER);
    expect(baseline.sourceHead).toBe('b60251b687587b9a6bf67fa853a7d50cff40165e');
  });

  it.each(PROTOTYPE_COMPANION_ROSTER)('revises %s literary content while preserving its body and canon', id => {
    const character = resolvePersonalCompanionCharacter(id)!;
    const previous = previousCharacters[id];
    expect(personalCharacterSchema.parse(character)).toEqual(character);
    expect(character.gender).toBe(previous.gender);
    expect(character.embodiment).toEqual(previous.embodiment);
    expect(character.doNotWrite).toEqual(previous.doNotWrite);
    expect(hash(character)).not.toBe(previous.characterDigest);
  });

  it.each(PROTOTYPE_COMPANION_ROSTER)('keeps archived %s readable but rejects rebinding in real consumers', async id => {
    const fixture = await personalStoryboardFixture('short', id);
    const prepared = preparePersonalStory(fixture.request, options);
    const archive = { ...fixture.draftResult, characterDigest: previousCharacters[id].characterDigest };
    // A synthetic old-digest document exercises admission, not historical provider authorship.
    expect(personalStoryResultSchema.safeParse(archive).success).toBe(true);
    expect(() => prepareStoryEdit(prepared, archive)).toThrow('story_editor_character_binding');
    expect(() => preparePersonalStoryboard(fixture.request, archive, options)).toThrow('personal_storyboard_character_binding');
    const document = { plan: archive.plan, manuscript: archive.manuscript, characterDigest: archive.characterDigest };
    expect(() => prepareStoryTextReview(prepared, document, document)).toThrow('story_text_review_source_binding');
  });

  it.each(candidates)('rejects %s in both profile and actual reviewed request', async id => {
    expect(resolvePersonalCompanionCharacter(id)).toBeNull();
    const fixture = await personalStoryboardFixture();
    const request = { ...fixture.request, companion: { id } };
    const result = acceptPersonalBookRequest(request, options);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toContainEqual({ path: 'companion.id', code: 'companion_not_offered' });
    expect(() => preparePersonalStory(request, options)).toThrow();
  });

  it('retains optional independent wants and age-readable humour, not compulsory example plots', () => {
    expect(resolvePersonalCompanionCharacter('dragon_dini')!.motives.join(' ')).toContain('זו שמפתיעים אותה');
    expect(resolvePersonalCompanionCharacter('fox_uri')!.voice.rhythm).toContain('אינו חייב לטעות');
    expect(resolvePersonalCompanionCharacter('chameleon_koko')!.humour.boundary).toContain('בלי הכרות מוקדמת');
    expect(resolvePersonalCompanionCharacter('lion_shaket')!.motives.join(' ')).toContain('לא מסע קבוע');
    expect(resolvePersonalCompanionCharacter('bunny_ometz')!.motives.join(' ')).toContain('בלי שהדרך השלישית תהיה פתרון חובה');
  });
});
