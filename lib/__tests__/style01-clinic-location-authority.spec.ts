/**
 * WS0b location authority — the resolved contract drives Style 01 sceneClass + style refs + the authoritative
 * prompt block, closing the clinic→outdoor leak (no render, no LLM).
 *
 * The defect: on the ACTIVE Style 01 path the sceneClass came ONLY from the legacy regex classifier, which has
 * no clinic bucket → an indoor/clinic page (or its cover) fell through to `outdoor-nature` and pulled OUTDOOR
 * style references. This spec loads the real shipped `bunny_ometz_adventure` contract (a `realistic_clinic`
 * world) and proves, link by link, that the frozen contract now OUTRANKS the regex:
 *
 *   #4 cover/page-0 env — contractPageEnvironmentClass resolves the COVER (page 0, not in pageContracts) from
 *      coverContract.locationId, so the cover is contract-locked too.
 *   #2 sceneClass — an `indoor` lock maps to an interior sceneClass; it can NEVER be `outdoor-nature`.
 *   #5 clinic bucket — the defensive regex fallback classifies clinic/doctor text as `clinic-interior`.
 *   #3 style refs — an `indoor` (or `neutral`) lock routes to interior / ZERO refs, never outdoor, on every page.
 *   #1 prompt block — buildVisualContractPromptBlock states the clinic LOCATION/WORLD and is PREPENDED to the
 *      assembled Style 01 prompt (the exact seam image.ts runs), so clinic authority is in the final prompt.
 *
 * If a future edit re-introduces the leak (drops the contract preference, the clinic bucket, or the cover env),
 * this spec — and therefore `npm run check` — fails.
 */
import { describe, expect, it } from 'vitest';
import {
  loadVisualContractArtifact,
  contractPageEnvironmentClass,
  derivePageVisualContracts,
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

/**
 * A page-1 direction whose TEXT alone carries no indoor/clinic tokens — the legacy regex misfiles it as
 * `outdoor-nature`. Using it proves the CONTRACT env lock (not the keyword bucket) is what forces indoor.
 */
const AMBIGUOUS_P1_DIRECTION =
  'The child stands nervously holding the bunny, looking toward a big door across the room.';

describe('WS0b location authority — contract drives Style 01 sceneClass + refs + block (clinic→outdoor leak)', () => {
  // ── #4 cover/page-0 env ─────────────────────────────────────────────────────
  it('#4 resolves the COVER (page 0) env from coverContract — the pageContracts-only gap', () => {
    // The cover is NOT in pageContracts; before the fix this returned null → the cover leaked to the regex.
    expect(contractPageEnvironmentClass(contract, 0)).toBe('indoor');
    // Story pages keep resolving from their pageContract; page 12 (sunny exit) stays neutral (leak-safe).
    expect(contractPageEnvironmentClass(contract, 1)).toBe('indoor');
    expect(contractPageEnvironmentClass(contract, 12)).toBe('neutral');
  });

  // ── #2 contract env → sceneClass (indoor NEVER outdoor-nature) ───────────────
  it('#2 an indoor lock maps to an interior sceneClass, never outdoor-nature; outdoor stays outdoor', () => {
    expect(contractEnvironmentToSceneClass('indoor', false)).toBe('cozy-interior');
    expect(contractEnvironmentToSceneClass('indoor', true)).toBe('cozy-interior-night');
    expect(contractEnvironmentToSceneClass('indoor', false)).not.toBe('outdoor-nature');
    // neutral defers to the regex sceneClass (its refs are zeroed separately) — not forced to a nature default.
    expect(contractEnvironmentToSceneClass('neutral', false)).toBeNull();
    // a genuinely outdoor story is NOT broken to indoor.
    expect(contractEnvironmentToSceneClass('outdoor', false)).toBe('outdoor-nature');
  });

  // ── #5 defensive clinic regex bucket ────────────────────────────────────────
  it('#5 the regex fallback classifies clinic/doctor text as clinic-interior (not outdoor-nature)', () => {
    expect(
      classifyStyle01SceneClass({
        rawScenePrompt: 'inside the village clinic waiting room, the doctor calls the child in',
      }),
    ).toBe('clinic-interior');
    expect(classifyStyle01SceneClass({ rawScenePrompt: 'a nurse in the exam room' })).toBe('clinic-interior');
    // Hebrew clinic tokens route the same way.
    expect(classifyStyle01SceneClass({ rawScenePrompt: 'הילד יושב בחדר המתנה של המרפאה' })).toBe('clinic-interior');
    // clinic-interior draws from the INTERIOR ref subset, never the outdoor one.
    expect(resolveStyle01SceneRefSubset('clinic-interior')).toBe('cozy-interior');
  });

  // ── #3 style-ref routing: indoor/neutral → never outdoor, for pages AND cover ─
  it('#3 an indoor lock routes to interior refs (never outdoor); neutral → ZERO refs', () => {
    expect(contractEnvironmentToStyle01Subset('indoor')).toBe('cozy-interior');
    const indoorRefs = resolveStyle01RefPathsForEnvironmentLock('indoor', 3);
    expect(indoorRefs.length).toBeGreaterThan(0);
    // Identical to the interior subset, and NOT the outdoor subset — no outdoor references on a clinic page/cover.
    expect(indoorRefs).toEqual(resolveStyle01StyleReferencePaths('cozy-interior', 3));
    expect(indoorRefs).not.toEqual(resolveStyle01StyleReferencePaths('outdoor-nature', 3));
    expect(indoorRefs.every((p) => !/outdoor|forest|magical|nature/i.test(p))).toBe(true);
    // page 12 (neutral) stays leak-safe: zero style refs, never a nature default.
    expect(resolveStyle01RefPathsForEnvironmentLock('neutral', 3)).toEqual([]);
  });

  // ── #1 authoritative block content ──────────────────────────────────────────
  it('#1 the page-1 contract block states the clinic LOCATION + WORLD (authoritative)', () => {
    const page1 = derivePageVisualContracts(contract).find((p) => p.pageNumber === 1);
    expect(page1).toBeTruthy();
    const block = buildVisualContractPromptBlock(page1!, contract);
    expect(block).toContain('Village clinic');
    expect(block).toContain('realistic_clinic');
    expect(block).toMatch(/AUTHORITATIVE/);
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
