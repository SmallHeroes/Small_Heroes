/**
 * WS0c pilot — bunny_ometz_adventure Template: authored + offline materialize validation (NO render).
 *
 * Proves the P0/P1 engine can turn ONE authored Template into a sellable Resolved contract:
 *   1. the authored `bunny_ometz_adventure.visual-contract-template.json` loads via the real fail-closed loader and
 *      passes validateBookVisualContract**Template** (incl. artifact-key/storyKey agreement);
 *   2. the family_profile-on-doctor violation is FIXED — the non-relative doctor binds to deterministic_palette, the
 *      relative mother binds to family_profile;
 *   3. it MATERIALIZES into a valid `contractKind:"resolved"` on BOTH (a) a positively-evidenced family and (b) a
 *      realistic no-photo order (the hardcoded fallback child DNA), each passing the FULL Resolved validator;
 *   4. materialization is deterministic (byte-identical → identical hash), and the no-evidence path fails closed.
 *
 * PURE + offline: no image render, no flag, no DB, no network.
 */
import { describe, it, expect } from 'vitest';
import path from 'path';
import type { Order } from '@prisma/client';
import {
  loadVisualContractTemplateArtifact,
  validateBookVisualContractTemplate,
  materialize,
  validateResolvedBookVisualContract,
  computeVisualContractHash,
  type BookVisualContractTemplate,
} from '@/lib/visual-contract-compiler';
import { deriveResolvedFamilyAppearanceProfile } from '@/lib/generation-pipeline/resolve-family-appearance';
import type { PipelineCache } from '@/lib/generation-pipeline/types';

const V3_DIR = path.join(process.cwd(), 'story-bank', 'v3-approved');
const STORY_KEY = 'bunny_ometz_adventure';

function loadTemplate(): BookVisualContractTemplate {
  // Real fail-closed loader: throws on invalid template OR artifact-key/storyKey disagreement.
  return loadVisualContractTemplateArtifact(V3_DIR, STORY_KEY).template;
}

/** deriveResolvedFamilyAppearanceProfile arg shims (offline — no real Order/DB). */
const order = (familyContext: unknown) => ({ familyContext }) as Pick<Order, 'familyContext'>;
const cache = (childPhotoDescription: string | null, childStructured: Record<string, string> | null) =>
  ({ childPhotoDescription, dna: childStructured ? { childStructured } : null }) as unknown as Pick<
    PipelineCache,
    'childPhotoDescription' | 'dna'
  >;

// A realistic no-photo order resolves child DNA from the hardcoded fallback (story-bank-loader.ts:1184-1185).
const NO_PHOTO_FALLBACK = {
  face: 'Round soft face, warm light olive skin, large dark brown almond-shaped eyes, small upturned nose',
  hair: 'Medium-length straight brown hair, tucked behind ears, thin red fabric headband',
};

describe('WS0c pilot — bunny Template authoring', () => {
  it('loads via the real fail-closed loader and passes the Template validator', () => {
    const template = loadTemplate();
    const r = validateBookVisualContractTemplate(template);
    expect(r.ok, r.ok ? '' : r.errors.join('; ')).toBe(true);
    expect(template.storyKey).toBe(STORY_KEY);
    expect(template.contractKind).toBe('template');
  });

  it('FIXES the violation: non-relative doctor → deterministic_palette; relative mother → family_profile', () => {
    const t = loadTemplate();
    const doctor = t.humanCast.find((m) => m.id === 'human:doctor')!;
    const mother = t.humanCast.find((m) => m.id === 'human:mother')!;
    // doctor is NOT family (the clinic-doctor fix) — skin/hair via the deterministic palette, style explicit
    for (const trait of ['skinTone', 'hairColour', 'hairTexture'] as const) {
      expect(doctor.appearance[trait].mode).toBe('deterministic_palette');
    }
    expect(doctor.appearance.hairStyle.mode).toBe('explicit');
    // mother (relative) shares the child's family band; style explicit
    for (const trait of ['skinTone', 'hairColour', 'hairTexture'] as const) {
      expect(mother.appearance[trait].mode).toBe('family_profile');
    }
    expect(mother.appearance.hairStyle.mode).toBe('explicit');
    // all garments are explicit (authored, never family/palette)
    for (const m of t.humanCast) for (const g of m.garments) expect(g.colour.mode).toBe('explicit');
  });
});

describe('WS0c pilot — bunny Template materialization (offline; NO render)', () => {
  it('(a) POSITIVELY-EVIDENCED family → valid Resolved (contractKind:"resolved")', () => {
    const family = deriveResolvedFamilyAppearanceProfile(
      order(null),
      cache('deep brown skin, black hair, coily texture', null),
    );
    const resolved = materialize(loadTemplate(), family);
    expect(resolved.contractKind).toBe('resolved');
    const v = validateResolvedBookVisualContract(resolved);
    expect(v.ok, v.ok ? '' : v.errors.join('; ')).toBe(true);
    // mother resolves FROM the family band; doctor resolves from the deterministic palette (stable per-story)
    const mother = resolved.humanCast.find((m) => m.id === 'human:mother')!;
    const doctor = resolved.humanCast.find((m) => m.id === 'human:doctor')!;
    expect(mother.appearance.skinTone.value).toBe(family.skinTone);
    expect(doctor.appearance.skinTone.mode).toBe('deterministic_palette');
    expect(doctor.appearance.skinTone.value.trim().length).toBeGreaterThan(0);
  });

  it('(b) REALISTIC NO-PHOTO order (fallback child DNA) → valid Resolved (contractKind:"resolved")', () => {
    const family = deriveResolvedFamilyAppearanceProfile(order(null), cache(null, NO_PHOTO_FALLBACK));
    const resolved = materialize(loadTemplate(), family);
    expect(resolved.contractKind).toBe('resolved');
    const v = validateResolvedBookVisualContract(resolved);
    expect(v.ok, v.ok ? '' : v.errors.join('; ')).toBe(true);
  });

  it('materialization is DETERMINISTIC — byte-identical Resolved + identical hash', () => {
    const family = deriveResolvedFamilyAppearanceProfile(order(null), cache(null, NO_PHOTO_FALLBACK));
    const a = materialize(loadTemplate(), family);
    const b = materialize(loadTemplate(), { ...family });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(computeVisualContractHash(a)).toBe(computeVisualContractHash(b));
  });

  it('FINDING — a no-photo/no-evidence order FAILS CLOSED (no silent default reaches the freeze)', () => {
    expect(() =>
      deriveResolvedFamilyAppearanceProfile(order(null), cache(null, { face: 'round face, big smile', hair: 'short, tidy' })),
    ).toThrow(/DEFAULTED|no positive evidence/);
  });
});
