/**
 * Render-proof Phase 1 — fox_uri_adventure Template: authored (engine-minted, Cowork-reviewed, 0 contradictions)
 * + offline materialize validation (NO render). Mirrors bunny-ometz-adventure-template.spec.ts.
 *
 * fox_uri_adventure is the first slot for the render proof: Cowork-verified faithful (night-fear balcony/bucket/
 * flashlight), NO humans (the simplest cast), a unified set (1 location / 5 zones), and a launch slot. This spec is
 * a REAL guard on the promoted bank artifact:
 *   1. the promoted `fox_uri_adventure.visual-contract-template.json` loads via the real fail-closed loader and
 *      passes validateBookVisualContract**Template** (incl. artifact-key/storyKey agreement);
 *   2. it MATERIALIZES into a valid `contractKind:"resolved"` that passes the FULL Resolved validator (the render
 *      path consumes the Resolved), deterministically (byte-identical → identical hash);
 *   3. each structural guard is proven to REJECT a tamper.
 *
 * PURE + offline: no image render, no flag, no DB, no network. If a future edit weakens the promoted contract or a
 * validator, this spec (and therefore `npm run check`) fails.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  loadVisualContractTemplateArtifact,
  migrateLegacyBookVisualContractTemplateV1,
  migrateLegacyBookVisualContractTemplateV2,
  validateBookVisualContractTemplate,
  materialize,
  validateResolvedBookVisualContract,
  computeVisualContractHash,
  InvalidTemplateContractError,
  type BookVisualContractTemplate,
  type ResolvedFamilyAppearanceProfile,
} from '@/lib/visual-contract-compiler';

const V3_DIR = path.join(process.cwd(), 'story-bank', 'v3-approved');
const STORY_KEY = 'fox_uri_adventure';

function loadTemplate(): BookVisualContractTemplate {
  return migrateLegacyBookVisualContractTemplateV1(
    JSON.parse(
      fs.readFileSync(
        path.join(V3_DIR, `${STORY_KEY}.visual-contract-template.json`),
        'utf8',
      ),
    ),
    {
      areaZoneIds: {
        set_room_balcony_night: {
        board_room_openings: ['z_room_window', 'z_window_threshold'],
        board_balcony: ['z_balcony_railing', 'z_balcony_bucket_corner'],
        },
      },
      pageZoneNodeIds: {
        z_balcony_railing: { railing: 'metal_railing' },
      },
    },
  );
}
function clone(t: BookVisualContractTemplate): BookVisualContractTemplate {
  return JSON.parse(JSON.stringify(t)) as BookVisualContractTemplate;
}
// fox has NO humans, so no family_profile binding is ever resolved — the family is an unused pass-through arg.
const FAMILY: ResolvedFamilyAppearanceProfile = { skinTone: 'warm olive', hairColour: 'dark brown', hairTexture: 'wavy' };

describe('render-proof — fox_uri_adventure Template authoring', () => {
  it('rejects immutable v1 bytes as current, then validates explicit typed-subject and board-domain migration', () => {
    const artifactPath = path.join(
      V3_DIR,
      `${STORY_KEY}.visual-contract-template.json`,
    );
    const historicalBytes = fs.readFileSync(artifactPath, 'utf8');
    expect(() =>
      loadVisualContractTemplateArtifact(V3_DIR, STORY_KEY),
    ).toThrow(/vc-schema\/v3/);
    const template = loadTemplate();
    const r = validateBookVisualContractTemplate(template);
    expect(r.ok, r.ok ? '' : r.errors.join('; ')).toBe(true);
    expect(template.storyKey).toBe(STORY_KEY);
    expect(template.contractKind).toBe('template');
    expect(template.pageContracts[2].actionRequirements).toEqual([
      expect.objectContaining({
        subject: {
          kind: 'entity',
          entity: { kind: 'cast', id: 'companion:fox_uri' },
        },
      }),
      expect.objectContaining({
        subject: {
          kind: 'entity',
          entity: { kind: 'cast', id: 'child:hero' },
        },
      }),
    ]);
    expect(JSON.stringify(template)).not.toContain('"actorId"');
    expect(fs.readFileSync(artifactPath, 'utf8')).toBe(historicalBytes);
  });

  it('migrates immutable v2 bytes only with exact area/zone and node-domain bindings', () => {
    const legacyTemplate = clone(loadTemplate());
    const legacy = legacyTemplate as unknown as Record<string, unknown>;
    legacy.schemaVersion = 'vc-schema/v2';
    for (const authority of legacyTemplate.setBoardAuthorities ?? []) {
      for (const area of authority.areas) {
        delete (area as unknown as { zoneProjection?: unknown }).zoneProjection;
      }
    }
    for (const zone of legacyTemplate.zones) {
      delete zone.spatialNodes;
      delete zone.spatialRelations;
    }
    const immutableBytes = JSON.stringify(legacy);
    expect(validateBookVisualContractTemplate(legacy).ok).toBe(false);
    expect(() =>
      migrateLegacyBookVisualContractTemplateV2(legacy, {
        areaZoneIds: {},
      }),
    ).toThrow(/missing exact zone ids/);

    const migrated = migrateLegacyBookVisualContractTemplateV2(legacy, {
      areaZoneIds: {
        set_room_balcony_night: {
          board_room_openings: ['z_room_window', 'z_window_threshold'],
          board_balcony: ['z_balcony_railing', 'z_balcony_bucket_corner'],
        },
      },
      pageZoneNodeIds: {
        z_balcony_railing: { railing: 'metal_railing' },
      },
    });
    const result = validateBookVisualContractTemplate(migrated);
    expect(result.ok, result.ok ? '' : result.errors.join('; ')).toBe(true);
    expect(migrated.schemaVersion).toBe('vc-schema/v3');
    expect(JSON.stringify(legacy)).toBe(immutableBytes);
  });

  it('is the simplest render slot: NO humans, the fox_uri companion, exactly the 12 book pages', () => {
    const t = loadTemplate();
    expect(t.humanCast).toHaveLength(0);
    expect(t.cast.companion?.id).toBe('companion:fox_uri');
    const nums = t.pageContracts.map((p) => p.pageNumber).sort((a, b) => a - b);
    expect(nums).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});

describe('render-proof — fox_uri_adventure Template materialization (offline; NO render)', () => {
  it('MATERIALIZES into a valid Resolved contract (contractKind:"resolved")', () => {
    const resolved = materialize(loadTemplate(), FAMILY);
    expect(resolved.contractKind).toBe('resolved');
    const v = validateResolvedBookVisualContract(resolved);
    expect(v.ok, v.ok ? '' : v.errors.join('; ')).toBe(true);
    // no humans survive materialization; the companion flows through unchanged
    expect(resolved.humanCast).toHaveLength(0);
    expect(resolved.cast.companion?.id).toBe('companion:fox_uri');
    expect(resolved.setBoardAuthorities).toEqual(loadTemplate().setBoardAuthorities);
  });

  it('materialization is DETERMINISTIC — byte-identical Resolved + identical hash', () => {
    const a = materialize(loadTemplate(), FAMILY);
    const b = materialize(loadTemplate(), { ...FAMILY });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(computeVisualContractHash(a)).toBe(computeVisualContractHash(b));
  });
});

describe('render-proof — the promoted fox contract is a REAL guard (tampers fail closed)', () => {
  it('a wrong schemaVersion is rejected', () => {
    const bad = clone(loadTemplate());
    (bad as { schemaVersion: string }).schemaVersion = 'vc-schema/WRONG';
    expect(validateBookVisualContractTemplate(bad).ok).toBe(false);
  });

  it('dropping a page\'s castIds is rejected (structural cast guard)', () => {
    const bad = clone(loadTemplate());
    delete (bad.pageContracts[0] as { castIds?: string[] }).castIds;
    const r = validateBookVisualContractTemplate(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/castIds/);
  });

  it('assertValid throws InvalidTemplateContractError on a truncated authoring (drop page 12)', () => {
    const bad = clone(loadTemplate());
    bad.pageContracts = bad.pageContracts.filter((p) => p.pageNumber !== 12);
    const r = validateBookVisualContractTemplate(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/missing pageContract for page 12/);
    expect(() => {
      const res = validateBookVisualContractTemplate(bad);
      if (!res.ok) throw new InvalidTemplateContractError(res.errors);
    }).toThrow(InvalidTemplateContractError);
  });
});
