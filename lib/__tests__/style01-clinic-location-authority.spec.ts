/**
 * WS0b location authority — the resolved contract drives Style 01 sceneClass + style refs + the authoritative
 * prompt block, closing the clinic→outdoor leak (no render, no LLM). ROUND-2 hardens two things Codex flagged:
 *
 *   OFF-PATH BYTE-IDENTICAL — clinic authority now lives ONLY on the contract path
 *   (`contractEnvironmentToSceneClass`). The regex classifier has NO clinic bucket, so with steering OFF / no
 *   contract, clinic/doctor/exam text classifies EXACTLY as legacy (`outdoor-nature`) — the fix cannot change
 *   the flag-off render.
 *   COVER BLOCK PARITY — the cover (page 0, absent from pageContracts) is projected via the shared
 *   `deriveCoverVisualContract` and carries the SAME authoritative block as pages.
 *
 * Loads the real shipped `bunny_ometz_adventure` contract (a `realistic_clinic` world) and proves, link by link:
 *   #4 cover/page-0 env — contractPageEnvironmentClass resolves the COVER from coverContract.locationId.
 *   #2 sceneClass — an `indoor` lock maps to an interior sceneClass; it can NEVER be `outdoor-nature`.
 *   OFF — with no contract, clinic text classifies as legacy `outdoor-nature` (no clinic-interior leak).
 *   #3 style refs — an `indoor` / `neutral` lock routes to interior / ZERO refs, never outdoor, on every page.
 *   #1 prompt block — buildVisualContractPromptBlock states the clinic LOCATION/WORLD for BOTH a page and the cover.
 *
 * If a future edit re-introduces the leak (drops the contract preference, re-adds a global clinic bucket, or
 * unwires the cover block), this spec — and therefore `npm run check` — fails.
 */
import { describe, expect, it } from 'vitest';
import {
  loadVisualContractArtifact,
  contractPageEnvironmentClass,
  derivePageVisualContracts,
  deriveCoverVisualContract,
} from '@/lib/visual-contract-compiler';
import {
  buildVisualContractPromptBlock,
  composeContractAuthoritativePrompt,
} from '@/lib/visual-contract-compiler/buildVisualContractPromptBlock';
import {
  classifyStyle01SceneClass,
  contractEnvironmentToSceneClass,
  contractEnvironmentToStyle01Subset,
  resolveStyle01SceneRefSubset,
} from '@/lib/style-scene-class';
import {
  resolveStyle01RefPathsForEnvironmentLock,
  resolveStyle01StyleReferencePaths,
} from '@/lib/style01-gptimage';
import { assembleStyle01Phase2Prompt } from '../style01-prompt-assembly';
import path from 'path';

const ARTIFACT_DIR = path.join(process.cwd(), 'story-bank', 'v3-approved');
const STORY_KEY = 'bunny_ometz_adventure';
const { contract } = loadVisualContractArtifact(ARTIFACT_DIR, STORY_KEY);

/** Representative clinic/doctor/exam text (EN + HE). With NO contract, these must classify as LEGACY. */
const CLINIC_TEXTS = [
  'the village clinic waiting room, the doctor calls the child in',
  'a nurse checks the child in the exam room',
  'הילד יושב בחדר המתנה של המרפאה',
];

/**
 * A page-1 direction whose TEXT alone carries no indoor/clinic tokens — the legacy regex misfiles it as
 * `outdoor-nature`. Using it proves the CONTRACT env lock (not any keyword bucket) is what forces indoor.
 */
const AMBIGUOUS_P1_DIRECTION =
  'The child stands nervously holding the bunny, looking toward a big door across the room.';

describe('WS0b location authority — contract drives Style 01 sceneClass + refs + block (clinic→outdoor leak)', () => {
  // ── #4 cover/page-0 env ─────────────────────────────────────────────────────
  it('#4 resolves the COVER (page 0) env from coverContract — the pageContracts-only gap', () => {
    expect(contractPageEnvironmentClass(contract, 0)).toBe('indoor');
    expect(contractPageEnvironmentClass(contract, 1)).toBe('indoor');
    expect(contractPageEnvironmentClass(contract, 12)).toBe('neutral');
  });

  // ── #2 contract env → sceneClass (indoor NEVER outdoor-nature) ───────────────
  it('#2 an indoor lock maps to an interior sceneClass, never outdoor-nature; outdoor stays outdoor', () => {
    expect(contractEnvironmentToSceneClass('indoor', false)).toBe('cozy-interior');
    expect(contractEnvironmentToSceneClass('indoor', true)).toBe('cozy-interior-night');
    expect(contractEnvironmentToSceneClass('indoor', false)).not.toBe('outdoor-nature');
    expect(contractEnvironmentToSceneClass('neutral', false)).toBeNull();
    expect(contractEnvironmentToSceneClass('outdoor', false)).toBe('outdoor-nature');
  });

  // ── OFF-PATH BYTE-IDENTICAL (round-2 blocker #1) ─────────────────────────────
  it('with NO contract, clinic/doctor/exam text classifies as LEGACY outdoor-nature (no clinic-interior leak)', () => {
    // The clinic bucket was REMOVED from the regex classifier — clinic authority is contract-only now, so the
    // flag-off classifier is byte-identical to legacy. (These read "wrong" in isolation, but that IS legacy: the
    // contract, not the regex, is what routes a clinic page to interior.)
    for (const text of CLINIC_TEXTS) {
      expect(classifyStyle01SceneClass({ rawScenePrompt: text })).toBe('outdoor-nature');
    }
    // And through the assembly OFF path (no contractEnvironmentClass): the sceneClass is the legacy regex value —
    // the fix does not touch the flag-off render.
    const off = assembleStyle01Phase2Prompt({
      pageNumber: 1,
      rawScenePrompt: CLINIC_TEXTS[0],
      childFirstName: 'Noam',
      childAge: 5,
      childGender: 'boy',
      storyTimeOfDay: 'day',
    });
    expect(off.sceneClass).toBe('outdoor-nature');
  });

  // ── #3 style-ref routing: indoor/neutral → never outdoor, for pages AND cover ─
  it('#3 an indoor lock routes to interior refs (never outdoor); neutral → ZERO refs', () => {
    expect(contractEnvironmentToStyle01Subset('indoor')).toBe('cozy-interior');
    expect(resolveStyle01SceneRefSubset('cozy-interior')).toBe('cozy-interior');
    const indoorRefs = resolveStyle01RefPathsForEnvironmentLock('indoor', 3);
    expect(indoorRefs.length).toBeGreaterThan(0);
    expect(indoorRefs).toEqual(resolveStyle01StyleReferencePaths('cozy-interior', 3));
    expect(indoorRefs).not.toEqual(resolveStyle01StyleReferencePaths('outdoor-nature', 3));
    expect(indoorRefs.every((p) => !/outdoor|forest|magical|nature/i.test(p))).toBe(true);
    expect(resolveStyle01RefPathsForEnvironmentLock('neutral', 3)).toEqual([]);
  });

  // ── #1 authoritative block — PAGE ────────────────────────────────────────────
  it('#1 the page-1 contract block states the clinic LOCATION + WORLD (authoritative)', () => {
    const page1 = derivePageVisualContracts(contract).find((p) => p.pageNumber === 1);
    expect(page1).toBeTruthy();
    const block = buildVisualContractPromptBlock(page1!, contract);
    expect(block).toContain('Village clinic');
    expect(block).toContain('realistic_clinic');
    expect(block).toMatch(/AUTHORITATIVE/);
  });

  // ── COVER BLOCK PARITY (round-2 blocker #2) ──────────────────────────────────
  it('the COVER carries the authoritative block via the shared deriveCoverVisualContract projection', () => {
    // Same shared helper chunk-runner uses to build the cover block passed to generateBookCover.
    const coverPage = deriveCoverVisualContract(contract);
    expect(coverPage.pageNumber).toBe(0);
    expect(coverPage.locationId).toBe('clinic');
    const coverBlock = buildVisualContractPromptBlock(coverPage, contract);
    expect(coverBlock).toContain('Village clinic');
    expect(coverBlock).toContain('realistic_clinic');
    expect(coverBlock).toMatch(/AUTHORITATIVE/);
    // The cover's no-spoiler intent (coverContract.mustNotShow) reaches the block's MUST-NOT-SHOW line.
    expect(coverBlock).toMatch(/MUST NOT SHOW/);
    expect(coverBlock.toLowerCase()).toContain('injection');
  });

  // ── end-to-end: the exact seam image.ts runs (assemble → compose), no render ──
  it('end-to-end: contract env flips the leaky regex class to interior AND injects clinic authority', () => {
    const commonInput = {
      pageNumber: 1,
      rawScenePrompt: AMBIGUOUS_P1_DIRECTION,
      childFirstName: 'Noam',
      childAge: 5,
      childGender: 'boy',
      childDescription: 'short dark hair, warm smile',
      storyTimeOfDay: 'day' as const,
      companion: { id: 'bunny_ometz', name: 'בּוּנִי', visualDescription: 'cream-white bunny with a heart badge' },
    };

    // Baseline: with NO contract lock, this text leaks to outdoor-nature (the exact defect).
    const regexOnly = assembleStyle01Phase2Prompt({ ...commonInput });
    expect(regexOnly.sceneClass).toBe('outdoor-nature');

    // With the contract's indoor lock, the sceneClass is forced interior — the leak is closed.
    const withContract = assembleStyle01Phase2Prompt({ ...commonInput, contractEnvironmentClass: 'indoor' });
    expect(withContract.sceneClass).toBe('cozy-interior');
    expect(withContract.sceneClass).not.toBe('outdoor-nature');

    // Compose the authoritative block the way image.ts does → clinic authority reaches the FINAL prompt, first.
    const page1 = derivePageVisualContracts(contract).find((p) => p.pageNumber === 1)!;
    const block = buildVisualContractPromptBlock(page1, contract);
    const finalPrompt = composeContractAuthoritativePrompt(block, withContract.prompt);
    expect(finalPrompt.startsWith(block)).toBe(true);
    expect(finalPrompt).toContain('Village clinic');
    expect(finalPrompt).toContain('realistic_clinic');
  });
});
