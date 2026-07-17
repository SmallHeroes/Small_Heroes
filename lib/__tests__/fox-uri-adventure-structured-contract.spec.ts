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
} from '@/lib/set-identity-board/setDefinition';

/**
 * The Contract-v2 PROOF slot: fox is the FIRST story whose structured fields are hand-authored, so it is the first
 * evidence that the Stage-3 schema + Stage-4 rules can actually express a real book's visual defects as TYPED
 * STRUCTURE rather than prose.
 *
 * It pins the 4 defects observed in the first fox render:
 *   1. window↔door — the opening was authored ambiguously as a window/door; RESOLVED (set-consistency): the balcony is
 *      OPEN, reached through the SAME window, with no glazed balcony door / vitrine anywhere (Guy's story decision).
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
  it('passes the Template validator (⇒ vNext ⇒ base: every Stage-3 + Stage-4 rule)', () => {
    const result = validateBookVisualContractTemplate(foxTemplate());
    // Surface the real errors rather than a bare `false` if this ever breaks.
    expect(result.ok ? [] : result.errors).toEqual([]);
    expect(() => assertValidBookVisualContractTemplate(foxTemplate())).not.toThrow();
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

describe('fox — DEFECT 1: the opening is a WINDOW onto an OPEN balcony — never a glazed door', () => {
  it('the page-1 listening opening is a WINDOW; the page-2 threshold is window + railing with NO balcony door', () => {
    const t = foxTemplate();
    const win = zone(t, 'z_room_window').spatialNodes?.find((n) => n.id === 'window');
    expect(win?.kind).toBe('window');
    // set-consistency: the invented glazed balcony door is GONE — the balcony is reached through the same open window.
    const threshold = zone(t, 'z_window_threshold');
    expect(threshold.spatialNodes?.some((n) => n.kind === 'balcony_door') ?? false).toBe(false);
    expect(threshold.spatialNodes?.find((n) => n.id === 'window')?.kind).toBe('window');
    expect(threshold.spatialNodes?.find((n) => n.id === 'railing')?.kind).toBe('railing');
    // …and each page resolves to the zone that owns its opening.
    expect(page(t, 1).zoneId).toBe('z_room_window');
    expect(page(t, 2).zoneId).toBe('z_window_threshold');
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
    const uri = actions.find((a) => a.actorId === 'companion:fox_uri');
    const child = actions.find((a) => a.actorId === 'child:hero');
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

describe('fox — SET CONSISTENCY: the balcony is open (window + railing), never a glazed door', () => {
  it('NO zone anywhere declares a balcony_door node', () => {
    for (const z of foxTemplate().zones) {
      expect(z.spatialNodes?.some((n) => n.kind === 'balcony_door') ?? false).toBe(false);
    }
  });

  it('the raw template JSON carries no "balcony_door" token at all', () => {
    expect(readFileSync(TEMPLATE_PATH, 'utf8')).not.toMatch(/balcony_door/);
  });

  it('the opening set is window + balcony railing (the threshold zone carries both, no door)', () => {
    const z = zone(foxTemplate(), 'z_window_threshold');
    const kinds = (z.spatialNodes ?? []).map((n) => n.kind);
    expect(kinds).toContain('window');
    expect(kinds).toContain('railing');
    expect(kinds).not.toContain('balcony_door');
  });

  it('the opening pages (1-2) forbid a glass exit-door / vitrine in mustNotShow', () => {
    const t = foxTemplate();
    for (const n of [1, 2]) {
      expect(page(t, n).mustNotShow.some((s) => /\bdoor\b|vitrine/i.test(s))).toBe(true);
    }
  });
});

/**
 * [P0-3a] SET IDENTITY BOARD opt-in. Codex NO-GO: with no `setIdentityId`/`setReference` on either location the
 * required-identity list is EMPTY, so a board-activated render "succeeds" having attached no board at all — a FALSE
 * proof. The room and the balcony are ONE physical set (the room opens straight onto the balcony through the same
 * open window — see DEFECT 1), so they share ONE identity and resolve to ONE board.
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
