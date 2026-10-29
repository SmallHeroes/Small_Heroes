import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { resolvePersonalWizardOptions } from '../options';
import { preparePersonalStoryboard, prepareCurrentPersonalStoryboard, compilePersonalStoryboard, personalStoryboardFrame, storyboardInstructions,
  storyboardDraftSchema, PERSONAL_STORYBOARD_INSTRUCTION, OWNED_STORYBOARD_INSTRUCTION } from '../storyboard';
import { SCENE_LOCATION_CONTRACT_VERSION, SCENE_LOCATION_STORYBOARD_ADDENDUM } from '../storyboard-scene-location';
import { MOMENT_STORYBOARD_ADDENDUM } from '../storyboard-moments';
import { KIND_STORYBOARD_ADDENDUM } from '../storyboard-landmark-kind';
import { wholeBookDraftSchema } from '../../local-book-planning';
import { savedSceneLocationContract } from '../../../scripts/personal-simple-book-reviewed-audition';
import { replanFixture } from './storyboard-replan-fixture';

const options = resolvePersonalWizardOptions();
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
/** The fixture places page 4 in the lane and every other page in the garden; keeping page 3's scene on page 4 is a scene/location drift. */
const drifting = (draft: any) => { const d = structuredClone(draft); d.sequence.pages[3] = { ...d.sequence.pages[3], sceneId: d.sequence.pages[2].sceneId,
  sceneChangeEvidence: null, transitions: [] }; return d; };

describe('storyboard scene-location contract (opt-in instruction, source-bound)', () => {
  it('flag absent: every existing identity and instruction is byte-identical (pinned before the change)', async () => {
    const f = await personalStoryboardFixture();
    expect(preparePersonalStoryboard(f.request, f.result, options).sourceDigest).toBe('a0ce658469cb5519c7b130ed517d935d5d61a5e5537b1cec6c92c9daf7b5a12f');
    expect(preparePersonalStoryboard(f.request, f.result, options, true).sourceDigest).toBe('87d1eb5f296a94c4d82344f596ce4c45211cb19ce9701f2d51d4f484366ca80d');
    expect(f.book.storyboardDigest).toBe('695e4071681e90b060007d58a8edcc242f90c08042cb5638d19808018c518cf4');
    expect(personalStoryboardFrame(f.book, f.review, 1, f.current).packetDigest).toBe('59ac8ddedb9a1bd4635886acfb0afcd6e91c08ae12b020576e1cb417c60f958c');
    expect(sha(PERSONAL_STORYBOARD_INSTRUCTION)).toBe('858f442ec1fde66c0ae79382fa961a50b1fd88803599570799264527edcc04bd');
    expect(sha(OWNED_STORYBOARD_INSTRUCTION)).toBe('a2286e4848e970b8ccef0917b0580801dbd64ab664b873f5774c3d3cc29fc8e7');
    expect(storyboardInstructions({ actorOwnedAppearance: true, momentContract: true, landmarkKindContract: true }))
      .toBe(`${OWNED_STORYBOARD_INSTRUCTION}\n${MOMENT_STORYBOARD_ADDENDUM}\n${KIND_STORYBOARD_ADDENDUM}`);
    expect('sceneLocation' in f.book).toBe(false);
  });

  it('flag on: exactly the rule is added to the instructions (last, after every other contract); no schema or compiler change', async () => {
    expect(storyboardInstructions({ sceneLocationContract: true })).toBe(`${PERSONAL_STORYBOARD_INSTRUCTION}\n${SCENE_LOCATION_STORYBOARD_ADDENDUM}`);
    expect(storyboardInstructions({ actorOwnedAppearance: true, momentContract: true, landmarkKindContract: true, sceneLocationContract: true }))
      .toBe(`${storyboardInstructions({ actorOwnedAppearance: true, momentContract: true, landmarkKindContract: true })}\n${SCENE_LOCATION_STORYBOARD_ADDENDUM}`);
    expect(storyboardDraftSchema({ sceneLocationContract: true } as never)).toBe(wholeBookDraftSchema);
    // The rule it states is the one the sequence compiler enforces either way: a drifting draft is refused with or without the contract.
    const f = await personalStoryboardFixture();
    for (const contract of [undefined, true as const])
      expect(() => compilePersonalStoryboard(preparePersonalStoryboard(f.request, f.result, options, undefined, undefined, undefined, undefined, contract), drifting(f.draft)))
        .toThrow('book_sequence_scene_location_drift');
  });

  it('flag on: the marker is bound into the source and the book (and its digest), and current admission re-derives it', async () => {
    const f = await personalStoryboardFixture();
    const plain = preparePersonalStoryboard(f.request, f.result, options);
    const source = preparePersonalStoryboard(f.request, f.result, options, undefined, undefined, undefined, undefined, true);
    expect(source.sourceDigest).not.toBe(plain.sourceDigest);
    const book = compilePersonalStoryboard(source, f.draft), legacy = compilePersonalStoryboard(plain, f.draft);
    expect(book.sceneLocation).toBe(SCENE_LOCATION_CONTRACT_VERSION);
    expect([book.plan, book.sequence]).toEqual([legacy.plan, legacy.sequence]);
    expect(book.storyboardDigest).not.toBe(legacy.storyboardDigest);
    // The current packet path rebuilds the same contract from the book's own source (a stripped flag would be a stale book).
    const review = { ...structuredClone(f.review), sourceDigest: book.sourceDigest, storyboardDigest: book.storyboardDigest };
    expect(personalStoryboardFrame(book, review, 1, f.current).context.sourceDigest).toBe(book.sourceDigest);
    expect(prepareCurrentPersonalStoryboard(f.request, f.result, options, undefined, undefined, undefined, undefined, true).sourceDigest).toBe(source.sourceDigest);
  });

  it('policy: only true enables it, and it cannot ride on a preservation re-plan', async () => {
    const f = await personalStoryboardFixture();
    expect(() => preparePersonalStoryboard(f.request, f.result, options, undefined, undefined, undefined, undefined, 'yes' as never))
      .toThrow('personal_storyboard_scene_location_policy');
    // A valid preservation re-plan (kind contract, no moments) is admitted alone and refused with the scene-location contract.
    const r = await replanFixture(), p = { parentStoryboardDigest: r.book.storyboardDigest, draft: r.draft };
    expect(prepareCurrentPersonalStoryboard(r.request, r.writerResult, r.options, true, undefined, true, p).preservation).toBeTruthy();
    expect(() => prepareCurrentPersonalStoryboard(r.request, r.writerResult, r.options, true, undefined, true, p, true))
      .toThrow('personal_storyboard_preservation_policy');
  });

  it('the reviewed loader takes the flag only from the saved, digest-bound book; an unknown marker is refused', () => {
    expect(savedSceneLocationContract(undefined)).toBeUndefined();
    expect(savedSceneLocationContract({})).toBeUndefined();
    expect(savedSceneLocationContract({ sceneLocation: SCENE_LOCATION_CONTRACT_VERSION })).toBe(true);
    for (const marker of ['storyboard-scene-location/v2', true, null]) expect(() => savedSceneLocationContract({ sceneLocation: marker })).toThrow('audition_board_binding');
  });
});
