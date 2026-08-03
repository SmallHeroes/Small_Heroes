import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import {
  assertValidBookVisualContractTemplate,
  validateBookVisualContractTemplate,
  projectZoneStableGeometry,
  projectPageMustShow,
  projectPageMustNotShow,
  resolvePageCheckIds,
  sourceEvidenceErrors,
  type BookVisualContract,
  type VisualZone,
} from '@/lib/visual-contract-compiler';
import {
  groupLocationsBySetIdentity,
  listRequiredSetIdentityIds,
  projectSetDefinition,
} from '@/lib/set-identity-board/setDefinition';
import { buildSetIdentityBoardPrompt } from '@/lib/set-identity-board/boardPrompt';
import { migrateLegacySetBoardFixture } from '@/lib/set-identity-board/__tests__/current-authority-fixtures';

/**
 * The Contract-v2 PROOF slot: fox is the FIRST story whose structured fields are hand-authored, so it is the first
 * evidence that the Stage-3 schema + Stage-4 rules can actually express a real book's visual defects as TYPED
 * STRUCTURE rather than prose.
 *
 * It pins the 4 defects observed in the first fox render:
 *   1. window↔door — the opening was authored ambiguously as one "window/door". RESOLVED, in two steps and on
 *      render evidence: first as a door-less set (window only), which the board mint disproved — the story moves the
 *      child from inside to outside, that transition IS a door, and gpt-image answered the impossible ask with a
 *      window/door HYBRID. Now: TWO explicitly DISTINCT openings — a small chest-height listening window and a
 *      separate full-height glazed balcony door — with the hybrid forbidden. Ambiguity was never the door's fault;
 *      it was the two openings never being told to look different.
 *   2. bucket drift — the bucket wandered, and appeared on pages whose direction says "No bucket visible yet".
 *   3. wrong-actor notebook — page 3's notebook is URI's, and it drifted to the child.
 *   4. railing safety — nothing forbade the child sitting on / going past the balcony railing.
 *
 * These assertions are about the AUTHORED ARTIFACT, not the mechanism (the mechanism is covered by the stage-3 /
 * stage-4 specs). If a future edit drops the structure or lets the prose drift from it, this fails.
 */

const TEMPLATE_PATH = 'story-bank/v3-approved/fox_uri_adventure.visual-contract-template.json';
const STORY_PATH = 'story-bank/v3-approved/fox_uri_adventure.md';

function foxTemplate(): BookVisualContract & Record<string, unknown> {
  return JSON.parse(readFileSync(TEMPLATE_PATH, 'utf8'));
}
function zone(t: BookVisualContract, id: string): VisualZone {
  const z = t.zones.find((x) => x.id === id);
  if (!z) throw new Error(`zone ${id} missing`);
  return z;
}
function page(t: BookVisualContract, n: number) {
  const p = t.pageContracts.find((x) => x.pageNumber === n);
  if (!p) throw new Error(`page ${n} missing`);
  return p;
}
/** The story's real page prose — the source a story_evidence citation must be quoting. */
function storyPages(): Array<{ pageNumber: number; text: string }> {
  const parts = readFileSync(STORY_PATH, 'utf8').split(/^--- Page (\d+) ---$/m).slice(1);
  const out: Array<{ pageNumber: number; text: string }> = [];
  for (let i = 0; i < parts.length; i += 2) out.push({ pageNumber: Number(parts[i]), text: parts[i + 1] });
  return out;
}

describe('fox — the hand-authored structured contract validates end-to-end', () => {
  it('preserves historical v1 bytes while rejecting them as current v3 authority', () => {
    const historical = foxTemplate();
    const before = JSON.stringify(historical);
    const result = validateBookVisualContractTemplate(historical);
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toContain(
      'schemaVersion must equal the supported "vc-schema/v3" (got "vc-schema/v1")',
    );
    expect(() => assertValidBookVisualContractTemplate(historical)).toThrow();
    expect(JSON.stringify(historical)).toBe(before);
  });

  it('every story_evidence citation actually occurs on the page it cites (niqqud-insensitive)', () => {
    expect(sourceEvidenceErrors(foxTemplate(), storyPages())).toEqual([]);
  });

  it('every enforcement-relevant claim resolves to a unique, namespaced checkId', () => {
    const t = foxTemplate();
    for (const p of t.pageContracts) {
      const ids = resolvePageCheckIds(p).map((c) => c.checkId);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^(prop|action|safety):[a-z0-9_]+$/);
    }
  });
});

describe('fox — DEFECT 1: window↔door is a per-node KIND, never one ambiguous "window/door"', () => {
  it('each opening is its OWN typed node — the set holds a window AND a door without collapsing them', () => {
    const t = foxTemplate();
    // The schema's whole point (SpatialNodeKind): an opening is declared PER NODE, so a set may hold a window AND a
    // balcony door AND a doorway without fusing them into one ambiguous "openingType". The fox now exercises it.
    const openings = t.zones.flatMap((z) =>
      (z.spatialNodes ?? []).filter((n) => ['window', 'doorway', 'balcony_door'].includes(n.kind))
    );
    expect(openings.map((n) => n.kind).sort()).toEqual(['balcony_door', 'window']);
    // Distinct nodes → neither can BE the other by construction; the render can only conflate them by disobeying.
    expect(new Set(openings.map((n) => n.id)).size).toBe(openings.length);
  });

  it('the ambiguous "window or ... door" prose is GONE from every zone geometry', () => {
    const t = foxTemplate();
    for (const z of t.zones) {
      for (const line of z.stableGeometry ?? []) {
        expect(line).not.toMatch(/window or .*door|door or .*window/i);
      }
    }
  });

  it('the window sill height is stated RELATIONALLY (window → wall → floor), not as a loose adjective', () => {
    const rels = zone(foxTemplate(), 'z_room_window').spatialRelations ?? [];
    expect(rels).toContainEqual({ subjectId: 'window', relation: 'above', objectId: 'wall_below_window' });
    expect(rels).toContainEqual({ subjectId: 'wall_below_window', relation: 'above', objectId: 'room_floor' });
  });
});

describe('fox — DEFECT 2: the bucket is pinned to the drip ledge and hidden until its reveal', () => {
  it('ONE zone-level relation fixes the bucket below the drip ledge (so it holds identically on every page of the zone)', () => {
    const z = zone(foxTemplate(), 'z_balcony_bucket_corner');
    expect(z.spatialNodes?.find((n) => n.id === 'drip_ledge')?.kind).toBe('ledge');
    expect(z.spatialNodes?.find((n) => n.id === 'bucket')?.bindsTo).toEqual({ kind: 'prop', id: 'prop_tin_bucket' });
    expect(z.spatialRelations).toContainEqual({ subjectId: 'bucket', relation: 'below', objectId: 'drip_ledge' });
  });

  it('the bucket is FORBIDDEN on pages 1-4 ("No bucket visible yet") and REQUIRED from its page-5 reveal on', () => {
    const t = foxTemplate();
    const visibility = (n: number) =>
      page(t, n).propConstraints?.find((c) => c.propId === 'prop_tin_bucket')?.visibility;
    for (const n of [1, 2, 3, 4]) expect(visibility(n)).toBe('forbidden');
    for (const n of [5, 6, 7, 8, 9, 10, 11, 12]) expect(visibility(n)).toBe('required');
  });

  it('the bucket propState prose agrees with the structure (it used to say "may be distant and obscured")', () => {
    const t = foxTemplate();
    for (const n of [1, 2, 3, 4]) {
      const state = page(t, n).propState.find((s) => s.propId === 'prop_tin_bucket')?.state ?? '';
      expect(state).not.toMatch(/may be distant|off to the side|secondary/i);
      expect(state).toMatch(/not visible/i);
    }
  });
});

describe('fox — DEFECT 3: the page-3 notebook belongs to exactly ONE actor', () => {
  it('Uri must hold it; the child must NOT — one beat, two polarities, one actor each', () => {
    const actions = page(foxTemplate(), 3).actionRequirements ?? [];
    const historicalActorId = (action: (typeof actions)[number]): string | undefined =>
      (action as unknown as { actorId?: string }).actorId;
    const uri = actions.find((a) => historicalActorId(a) === 'companion:fox_uri');
    const child = actions.find((a) => historicalActorId(a) === 'child:hero');
    expect(uri?.polarity).toBe('must');
    expect(child?.polarity).toBe('must_not');
    for (const a of [uri, child]) {
      expect(a?.predicate).toBe('holds');
      expect(a?.object).toEqual({ kind: 'prop', id: 'prop_imaginary_notebook' });
    }
  });

  it('the notebook prop exists and is declared imaginary / Uri-only', () => {
    const prop = foxTemplate().recurringProps.find((p) => p.id === 'prop_imaginary_notebook');
    expect(prop).toBeTruthy();
    expect(`${prop?.description} ${prop?.persistence}`).toMatch(/never a real physical prop|doodle/i);
  });
});

describe('fox — DEFECT 4: the railing hazard is a typed SafetyConstraint', () => {
  it('page 4 forbids sitting on AND passing beyond the railing, against the railing NODE', () => {
    const safety = page(foxTemplate(), 4).safetyConstraints ?? [];
    const relations = safety.map((s) => s.relation);
    expect(relations).toContain('must_not_sit_on');
    expect(relations).toContain('must_not_pass_beyond');
    for (const s of safety) {
      expect(s.subjectId).toBe('child:hero');
      expect(s.target).toEqual({ kind: 'spatial', id: 'railing' });
      expect(s.origin.kind).toBe('policy_default'); // the story states no hazard — this is a safety POLICY
    }
  });

  it('page 5 keeps the hazard while the child walks the balcony edge', () => {
    expect((page(foxTemplate(), 5).safetyConstraints ?? []).map((s) => s.relation)).toContain('must_not_sit_on');
  });

  it('page 6 forbids head-inside-bucket, grounded in the story quote "ear to the rim"', () => {
    const s = (page(foxTemplate(), 6).safetyConstraints ?? [])[0];
    expect(s.relation).toBe('must_not_be_inside');
    expect(s.target).toEqual({ kind: 'prop', id: 'prop_tin_bucket' });
    expect(s.origin).toEqual({ kind: 'story_evidence', page: 6, phrase: 'אוזן לשפת הדלי' });
  });
});

describe('fox — TIER A / TIER B: the prose IS the structure’s projection', () => {
  it('TIER A: every zone’s stableGeometry EQUALS its derived projection', () => {
    for (const z of foxTemplate().zones) {
      expect(z.stableGeometry).toEqual(projectZoneStableGeometry(z));
    }
  });

  it('TIER B: every page’s mustShow / mustNotShow CONTAINS its projection (extra hand-authored steering survives)', () => {
    const t = foxTemplate();
    for (const p of t.pageContracts) {
      for (const line of projectPageMustShow(p, t)) expect(p.mustShow).toContain(line);
      for (const line of projectPageMustNotShow(p, t)) expect(p.mustNotShow).toContain(line);
      // containment, NOT equality — fox's authored zone/style/spoiler prose is still there.
      expect(p.mustShow.length).toBeGreaterThan(projectPageMustShow(p, t).length);
    }
  });
});

/**
 * SET CONSISTENCY — TWO distinct openings, reversing the door-less authoring on RENDER EVIDENCE.
 *
 * The door-less set ("the balcony is reached through the same open window") fought physics: the story moves the
 * child from INSIDE (window, room, p1-3) to OUTSIDE (מרפסת, railing, p4+), and that transition IS a door. Asked for
 * a window doing a door's job, gpt-image split the difference and rendered a window/door HYBRID — which board QA
 * correctly failed as `opening-kind-not-in-contract`, because the contract authorized only `window`.
 *
 * So the set carries BOTH openings again — but with the fix the first authoring lacked: they are explicitly
 * DIFFERENT elements (small chest-height casement ≠ full-height glazed door), each with its own job, and the
 * steering forbids merging them. Distinctness is what stops the hybrid; the earlier version had both openings but
 * never said they must look different.
 */
describe('fox — SET CONSISTENCY: TWO distinct openings (small listening window + full-height balcony door)', () => {
  it('the page-1 listening opening is a small WINDOW and the page-2 way out is a BALCONY DOOR', () => {
    const t = foxTemplate();
    const win = zone(t, 'z_room_window').spatialNodes?.find((n) => n.id === 'window');
    const door = zone(t, 'z_window_threshold').spatialNodes?.find((n) => n.id === 'balcony_door');
    expect(win?.kind).toBe('window');
    expect(door?.kind).toBe('balcony_door');
    // …and each page resolves to the zone that owns its opening.
    expect(page(t, 1).zoneId).toBe('z_room_window');
    expect(page(t, 2).zoneId).toBe('z_window_threshold');
  });

  it('the two openings are DISTINCT elements — different node, different kind, different zone', () => {
    const t = foxTemplate();
    const win = zone(t, 'z_room_window').spatialNodes?.find((n) => n.id === 'window');
    const door = zone(t, 'z_window_threshold').spatialNodes?.find((n) => n.id === 'balcony_door');
    expect(win?.id).not.toBe(door?.id);
    expect(win?.kind).not.toBe(door?.kind);
    // The distinctness is AUTHORED, not implied: each description contrasts itself against the other opening.
    expect(win?.description).toMatch(/small/i);
    expect(win?.description).toMatch(/not the way out|never drawn as/i);
    expect(door?.description).toMatch(/full-height/i);
    expect(door?.description).toMatch(/NOT the small/i);
  });

  it('the threshold zone carries the DOOR (not the window) — the way out is the door', () => {
    const kinds = (zone(foxTemplate(), 'z_window_threshold').spatialNodes ?? []).map((n) => n.kind);
    expect(kinds).toContain('balcony_door');
    expect(kinds).not.toContain('window');
  });

  it('NO mustNotShow forbids a door anymore — the door is now WANTED', () => {
    const t = foxTemplate();
    for (const p of t.pageContracts) {
      for (const s of p.mustNotShow) {
        expect(s).not.toMatch(/glazed balcony exit-door|glass vitrine|there is no glass door/i);
      }
    }
    for (const s of t.forbiddenGlobalElements) {
      expect(s).not.toMatch(/glazed balcony exit-door or glass vitrine —/i);
    }
  });

  it('instead, the HYBRID is forbidden — globally and on both opening pages', () => {
    const t = foxTemplate();
    expect(t.forbiddenGlobalElements.some((s) => /hybrid/i.test(s))).toBe(true);
    // page 1 protects the small window; page 2 protects the full-height door.
    expect(page(t, 1).mustNotShow.some((s) => /listening window .*(merged|replaced)/i.test(s))).toBe(true);
    expect(page(t, 2).mustNotShow.some((s) => /balcony door .*(merged|replaced)/i.test(s))).toBe(true);
  });

  it('the board WALL OPENINGS authorizes BOTH openings — the QA failure this reversal exists to fix', () => {
    const current = migrateLegacySetBoardFixture(foxTemplate(), {
      board_room_openings: ['z_room_window', 'z_window_threshold'],
      board_balcony: ['z_balcony_railing', 'z_balcony_bucket_corner'],
    });
    const def = projectSetDefinition(current, 'set_room_balcony_night', 'soft_hand_drawn_storybook');
    const { prompt } = buildSetIdentityBoardPrompt(def);
    const openings = prompt.split('WALL OPENINGS:')[1]?.split('\n\n')[0] ?? '';
    expect(openings).toMatch(/window/i);
    expect(openings).toMatch(/balcony door/i);
  });
});

/**
 * [P0-3a] SET IDENTITY BOARD opt-in. Codex NO-GO: with no `setIdentityId`/`setReference` on either location the
 * required-identity list is EMPTY, so a board-activated render "succeeds" having attached no board at all — a FALSE
 * proof. The room and the balcony are ONE physical set (the room's wall carries both the listening window and the
 * balcony door onto that same balcony — see DEFECT 1), so they share ONE identity and resolve to ONE board.
 */
describe('fox — SET IDENTITY BOARD opt-in: room + balcony are ONE physical set', () => {
  it('both locations share exactly ONE setIdentityId (one board, never two)', () => {
    const ids = foxTemplate().locations.map((l) => l.setIdentityId);
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(1);
  });

  it('required set identities is NON-EMPTY — a render without an approved board cannot silently pass', () => {
    const t = foxTemplate();
    const required = listRequiredSetIdentityIds(t);
    expect(required).toHaveLength(1);
    expect(required[0]).toBe(t.locations[0].setIdentityId);
  });

  it('groups BOTH locations into ONE board group', () => {
    const groups = groupLocationsBySetIdentity(foxTemplate());
    expect(groups.size).toBe(1);
    expect([...groups.values()][0].map((l) => l.id).sort()).toEqual(['loc_balcony', 'loc_child_room']);
  });

  it('both locations agree on board-requiredness — never a half-required set', () => {
    for (const loc of foxTemplate().locations) {
      expect(loc.setReference?.status).toBe('pending');
    }
  });
});
