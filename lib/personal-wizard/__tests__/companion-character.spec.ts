import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'crypto';
import { resolvePersonalCompanionCharacter, personalCharacterSchema, CHARACTER_CAUSALITY_INSTRUCTIONS } from '../companion-character';
import * as characterAuthority from '../companion-character';
import { PROTOTYPE_COMPANION_ROSTER, resolvePersonalWizardOptions } from '../options';
import { preparePersonalStory, writePersonalStory } from '../story-writer';
import { prepareStoryEdit, STORY_EDITOR_INSTRUCTIONS } from '../story-editor';
import { personalStoryboardReviewInput } from '../storyboard';
import { preparePersonalStoryboard, personalStoryboardFrame } from '../storyboard';
import { personalStoryResultSchema } from '../story-contract';
import { getCompanionById } from '../../companions';
import { canonicalJson } from '../request-acceptance';
import { IntakeLedger } from '../intake-ledger';
import { personalStoryboardFixture } from './personal-storyboard-fixture';

const options = resolvePersonalWizardOptions();
const genders = ['female', 'female', 'male', 'female', 'male', 'male'];
describe('six server-owned personal companion characters, not legacy plot roles', () => {
  it.each(PROTOTYPE_COMPANION_ROSTER.map((id, i) => [id, genders[i]]))('fully specifies %s and its fixed gender', (id, gender) => {
    const character = resolvePersonalCompanionCharacter(id)!;
    expect(personalCharacterSchema.parse(character)).toEqual(character);
    expect(character.companionId).toBe(id); expect(character.gender).toBe(gender);
    expect(character.motives.length).toBeGreaterThanOrEqual(2);
    expect(character.embodiment.limits.length).toBeGreaterThanOrEqual(2);
    expect(character.partnership.needsFromChild.length).toBeGreaterThan(30);
    expect(character.swapTest.length).toBeGreaterThan(50);
    expect(character).not.toHaveProperty('category'); expect(character).not.toHaveProperty('allowedDirections');
    expect(character).not.toHaveProperty('copingStrategy');
  });
  it('has six distinct motives, flaws, voices and causal swap criteria (not literary proof)', () => {
    const characters = PROTOTYPE_COMPANION_ROSTER.map(id => resolvePersonalCompanionCharacter(id)!);
    for (const field of ['essence', 'mistakenBelief', 'pressureResponse', 'swapTest'] as const) {
      expect(new Set(characters.map(character => character[field])).size).toBe(6);
    }
    expect(new Set(characters.map(character => character.humour.mechanism)).size).toBe(6);
    expect(new Set(characters.map(character => character.voice.rhythm)).size).toBe(6);
  });
  it.each(['unknown', '__proto__', 'constructor', 'Dragon_Dini', 'dragon_dini ', 'baby_elephant'])('does not use a tagline/default for %s', id => {
    expect(resolvePersonalCompanionCharacter(id)).toBeNull();
  });
  it('returns detached nested data, not mutable authority shared with the next book', () => {
    const first = resolvePersonalCompanionCharacter('dragon_dini')!;
    const original = structuredClone(first);
    first.voice.examples[0] = 'mutated voice'; first.partnership.needsFromChild = 'mutated partnership'; first.motives.pop();
    expect(resolvePersonalCompanionCharacter('dragon_dini')).toEqual(original);
  });
  it('fails actual preparation when an offered companion has no character, before any provider exists', async () => {
    const f = await personalStoryboardFixture('short', 'lion_shaket');
    const resolver = vi.spyOn(characterAuthority, 'resolvePersonalCompanionCharacter').mockReturnValue(null);
    try {
      expect(() => preparePersonalStory(f.request, options)).toThrow('story_companion_character_required');
    } finally { resolver.mockRestore(); }
  });
  it.each(['motives', 'embodiment', 'partnership', 'swapTest', 'gender'])('rejects incomplete %s rather than authoring from a slogan', field => {
    const broken: Record<string, unknown> = resolvePersonalCompanionCharacter('lion_shaket')!;
    delete broken[field];
    expect(personalCharacterSchema.safeParse(broken).success).toBe(false);
  });
  it.each(PROTOTYPE_COMPANION_ROSTER)('passes exact %s authority through actual planner, writer and editor', async id => {
    const f = await personalStoryboardFixture('short', id);
    const prepared = preparePersonalStory(f.request, options);
    const companion = getCompanionById(id)!;
    const character = resolvePersonalCompanionCharacter(id)!;
    expect(prepared.brief.companion.name).toBe(companion.name);
    expect(prepared.brief.companion).not.toHaveProperty('visualIdentity');
    expect(prepared.brief.companion).not.toHaveProperty('personality');
    expect(prepared.brief.companion.character).toEqual(character);
    expect(prepared.brief.companion.characterDigest).toBe(createHash('sha256').update(canonicalJson(character)).digest('hex'));
    const calls: unknown[] = [];
    const result = await writePersonalStory({ prepared, userId: 'synthetic', jobId: `character_${id}`,
      settings: { model: 'gpt-6.1-sol', budgetUsd: 1, maxJobs: 1, operators: new Set() },
      ledger: new IntakeLedger(), signal: new AbortController().signal,
      provider: () => ({ generate: vi.fn(async call => { calls.push(JSON.parse(call.input).brief.companion);
        expect(call.instructions).toContain(CHARACTER_CAUSALITY_INSTRUCTIONS);
        const output = call.stage === 'plan' ? { ...f.draftResult.plan, adventureSelection: f.draftResult.planning!.selection }
          : { ...f.draftResult.manuscript, planDigest: JSON.parse(call.input).planDigest };
        return { output, usage: { inputTokens: 100, outputTokens: 100 } }; }) }) });
    const edit = prepareStoryEdit(prepared, result);
    expect(calls).toEqual([prepared.brief.companion, prepared.brief.companion]);
    expect(result.characterDigest).toBe(prepared.brief.companion.characterDigest);
    expect(JSON.parse(edit.input).brief.companion).toEqual(prepared.brief.companion);
    expect(STORY_EDITOR_INSTRUCTIONS).toContain(CHARACTER_CAUSALITY_INSTRUCTIONS);
    expect(prepared.brief.topic).toBeNull(); expect(result.runtimeEligible).toBe(false);
  });
  it.each(['missing', 'foreign'] as const)('keeps %s profile evidence readable but refuses new editing/storyboarding', async kind => {
    const f = await personalStoryboardFixture(); const draft = structuredClone(f.draftResult);
    if (kind === 'missing') delete draft.characterDigest; else draft.characterDigest = 'f'.repeat(64);
    expect(personalStoryResultSchema.safeParse(draft).success).toBe(true);
    expect(() => prepareStoryEdit(preparePersonalStory(f.request, options), draft)).toThrow('story_editor_character_binding');
    expect(() => preparePersonalStoryboard(f.request, draft, options)).toThrow('personal_storyboard_character_binding');
  });
  it('changes the profile digest and refuses the old book when server literary authority changes', async () => {
    const f = await personalStoryboardFixture();
    const before = preparePersonalStory(f.request, options);
    const beforeSource = preparePersonalStoryboard(f.request, f.draftResult, options);
    const changed = resolvePersonalCompanionCharacter(f.request.companion.id)!;
    changed.mistakenBelief += ' This synthetic change is a different character authority.';
    const resolver = vi.spyOn(characterAuthority, 'resolvePersonalCompanionCharacter').mockReturnValue(changed);
    try {
      const after = preparePersonalStory(f.request, options);
      expect(after.brief.companion.characterDigest).not.toBe(before.brief.companion.characterDigest);
      expect(() => personalStoryboardFrame(f.book, f.review, 1, f.current)).toThrow('character_binding');
      const currentDraft = { ...f.draftResult, characterDigest: after.brief.companion.characterDigest };
      const currentSource = preparePersonalStoryboard(f.request, currentDraft, options);
      expect(currentSource.result.plan).toEqual(beforeSource.result.plan);
      expect(currentSource.result.manuscript).toEqual(beforeSource.result.manuscript);
      expect(currentSource.sourceDigest).not.toBe(beforeSource.sourceDigest);
      // Synthetic content rebinding is NOT proof a provider authored against this profile.
    } finally { resolver.mockRestore(); }
  });
  it.each(PROTOTYPE_COMPANION_ROSTER)('passes %s character to storyboard and semantic review without importing the bank', async id => {
    const f = await personalStoryboardFixture('short', id);
    const character = resolvePersonalCompanionCharacter(id)!;
    expect(f.source.planningInput.companion.character).toEqual(character);
    expect(personalStoryboardReviewInput(f.book).approvedBrief.companion.character).toEqual(character);
    expect(f.source.planningInput.companion.characterDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(f.book.runtimeEligible).toBe(false);
  });
  it('pins canon safeguards without making a therapeutic topic mandatory', () => {
    const kim = resolvePersonalCompanionCharacter('chameleon_koko')!;
    expect(kim.gender).toBe('female'); expect(kim.doNotWrite.join(' ')).toContain('קוקו');
    expect(kim.embodiment.limits.join(' ')).toContain('צעיף');
    const dini = resolvePersonalCompanionCharacter('dragon_dini')!;
    expect(dini.gender).toBe('female'); expect(dini.embodiment.limits.join(' ')).toContain('איסור תעופה שרירותי');
    expect(resolvePersonalCompanionCharacter('lion_shaket')!.embodiment.limits.join(' ')).toContain('גלימה');
    expect(resolvePersonalCompanionCharacter('bunny_ometz')!.embodiment.limits.join(' ')).toContain('מדליה');
  });
});
