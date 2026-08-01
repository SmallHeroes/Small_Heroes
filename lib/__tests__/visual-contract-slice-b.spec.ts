import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { canonicalHash } from '@/lib/canonical-json';
import {
  computeVisualContractHash,
  validateBookVisualContract,
  buildVisualContractPromptBlock,
  derivePageVisualContracts,
  contractToLocationPlanBundle,
  assertValidBookVisualContractTemplate,
  migrateLegacyBookVisualContractTemplateV1,
  type BookVisualContract,
} from '@/lib/visual-contract-compiler';
import { assembleStyle01BookReferencesWithZoneSheets } from '@/lib/story-location-bible/zone-sheets';

/**
 * Slice B — optional/additive contract fields (zone stableGeometry, prop material/scale/persistence, per-(page,castId)
 * body-state + laterality). The money-critical invariant: an UNAUTHORED field serializes as OMITTED, so every existing
 * frozen contract hashes BYTE-IDENTICAL; only the authored contract (bunny) re-hashes. No schema-version bump.
 */

/** A minimal contract that passes the BASE validator (no vNext requirements) — the fixture for the mechanism tests. */
function baseContract(): BookVisualContract {
  return {
    version: 1,
    worldType: 'realistic_clinic',
    forbiddenGlobalElements: ['no outdoor nature'],
    locations: [{ id: 'clinic', name: 'Clinic', description: 'a friendly clinic' }],
    zones: [{ id: 'clinic.exam', locationId: 'clinic', name: 'Exam', description: 'the exam room' }],
    cast: { child: { id: 'child:hero', role: 'child', wardrobe: { description: 'everyday outfit' } } },
    recurringProps: [{ id: 'exam_chair', name: 'Examination chair', description: 'the tall chair' }],
    coverContract: { worldType: 'realistic_clinic', locationId: 'clinic', timeOfDay: 'day', mustShow: [], mustNotShow: [] },
    pageContracts: [
      {
        pageNumber: 1,
        locationId: 'clinic',
        zoneId: 'clinic.exam',
        sameLocationAs: null,
        mustShow: ['the child seated'],
        mustNotShow: [],
        characterPresence: { child: true, companion: false },
        propState: [{ propId: 'exam_chair', state: 'the child seated on it' }],
        camera: 'medium 3/4',
        castIds: ['child:hero'],
        transition: { kind: 'steady' },
      },
    ],
  } as unknown as BookVisualContract;
}

describe('Slice B — omitted-when-unauthored hash invariant', () => {
  it('canonical hash: an OMITTED (undefined) key is byte-identical to never having it; null / [] are NOT', () => {
    expect(canonicalHash({ a: 1 })).toBe(canonicalHash({ a: 1, stableGeometry: undefined }));
    expect(canonicalHash({ a: 1 })).not.toBe(canonicalHash({ a: 1, stableGeometry: [] }));
    expect(canonicalHash({ a: 1 })).not.toBe(canonicalHash({ a: 1, material: null }));
  });

  it('a contract that OMITS the new fields hashes byte-identical; only AUTHORING a value re-hashes', () => {
    const c = baseContract();
    const h = computeVisualContractHash(c);
    // adding the optional fields as undefined (omitted) must not move the hash — every non-bunny contract is here.
    const omitted = {
      ...c,
      zones: c.zones.map((z) => ({ ...z, stableGeometry: undefined })),
      recurringProps: c.recurringProps.map((p) => ({ ...p, material: undefined, scale: undefined, persistence: undefined })),
      pageContracts: c.pageContracts.map((p) => ({ ...p, castStates: undefined })),
    } as unknown as BookVisualContract;
    expect(computeVisualContractHash(omitted)).toBe(h);
    // authoring a REAL value changes the hash (only the authored contract re-hashes).
    const authored = {
      ...c,
      zones: c.zones.map((z, i) => (i === 0 ? { ...z, stableGeometry: ['a fixed door on the same wall'] } : z)),
    } as unknown as BookVisualContract;
    expect(computeVisualContractHash(authored)).not.toBe(h);
  });
});

describe('Slice B — validator accepts well-formed, fails closed on malformed (absent stays valid)', () => {
  it('absent → valid; well-formed → valid', () => {
    const c = baseContract();
    expect(validateBookVisualContract(c).ok).toBe(true);
    const authored = {
      ...c,
      zones: [{ ...c.zones[0], stableGeometry: ['a door'] }],
      recurringProps: [{ ...c.recurringProps[0], material: 'padded vinyl', scale: 'chest-high', persistence: 'same every page' }],
      pageContracts: [{ ...c.pageContracts[0], castStates: [{ castId: 'child:hero', bodyState: 'seated', injectionArm: 'left', bandageArm: 'left', freeHand: 'right' }] }],
    } as unknown as BookVisualContract;
    expect(validateBookVisualContract(authored).ok).toBe(true);
  });

  it('malformed fails closed: empty [] geometry, null material, bad laterality enum, unknown castId', () => {
    const c = baseContract();
    const bad = (patch: Partial<BookVisualContract>) => validateBookVisualContract({ ...c, ...patch }).ok;
    expect(bad({ zones: [{ ...c.zones[0], stableGeometry: [] }] } as never)).toBe(false);
    expect(bad({ recurringProps: [{ ...c.recurringProps[0], material: null }] } as never)).toBe(false);
    expect(bad({ pageContracts: [{ ...c.pageContracts[0], castStates: [{ castId: 'child:hero', injectionArm: 'up' }] }] } as never)).toBe(false);
    expect(bad({ pageContracts: [{ ...c.pageContracts[0], castStates: [{ castId: 'nobody', bodyState: 'x' }] }] } as never)).toBe(false);
  });

  it('(Codex #3) the omit-rule is FAIL-CLOSED: castStates:[] and a castId-only no-op entry are rejected (both change the hash but steer nothing)', () => {
    const c = baseContract();
    const h = computeVisualContractHash(c);
    const ok = (castStates: unknown) =>
      validateBookVisualContract({ ...c, pageContracts: [{ ...c.pageContracts[0], castStates }] } as never).ok;
    const hashWith = (castStates: unknown) =>
      computeVisualContractHash({ ...c, pageContracts: [{ ...c.pageContracts[0], castStates }] } as never);

    // An authored `[]` is NOT the same as omitting the key — it changes the frozen hash...
    expect(hashWith([])).not.toBe(h);
    // ...so it must be REJECTED (author must omit the key instead of []).
    expect(ok([])).toBe(false);

    // A no-op entry (only castId, no bodyState/laterality) also changes the hash while emitting no steering → rejected.
    expect(hashWith([{ castId: 'child:hero' }])).not.toBe(h);
    expect(ok([{ castId: 'child:hero' }])).toBe(false);

    // A genuinely OMITTED key stays valid AND byte-identical — the invariant still holds.
    expect(ok(undefined)).toBe(true);
    expect(hashWith(undefined)).toBe(h);
  });
});

describe('Slice B — authoritative prompt block emits the 4 new lines only when authored', () => {
  it('authored → STABLE GEOMETRY / PERSISTENT PROP / BODY STATE / LATERALITY; absent → none (byte-identical)', () => {
    const c = baseContract();
    const authored = {
      ...c,
      zones: [{ ...c.zones[0], stableGeometry: ['a fixed exam chair', 'a small drawer'] }],
      recurringProps: [{ ...c.recurringProps[0], material: 'padded vinyl', scale: 'chest-high to the child' }],
      pageContracts: [{ ...c.pageContracts[0], castStates: [{ castId: 'child:hero', bodyState: 'seated on the exam chair', injectionArm: 'left', bandageArm: 'left', freeHand: 'right' }] }],
    } as unknown as BookVisualContract;
    const [page] = derivePageVisualContracts(authored);
    const block = buildVisualContractPromptBlock(page, authored);
    expect(block).toContain('STABLE GEOMETRY: a fixed exam chair; a small drawer');
    expect(block).toContain('PERSISTENT PROP:');
    expect(block).toContain('padded vinyl');
    expect(block).toContain('BODY STATE:');
    expect(block).toContain('seated on the exam chair');
    expect(block).toContain('LATERALITY:');
    expect(block).toContain('injection on the left arm');
    expect(block).toContain('bandage on the left arm');

    const [plainPage] = derivePageVisualContracts(c);
    const plain = buildVisualContractPromptBlock(plainPage, c);
    for (const label of ['STABLE GEOMETRY', 'PERSISTENT PROP', 'BODY STATE', 'LATERALITY']) {
      expect(plain).not.toContain(label);
    }
  });
});

describe('Slice B — adapter composes PageLocationPlan.pageAction from castStates + propState', () => {
  it('authored → pageAction fires; nothing to compose → the key is omitted (byte-identical)', () => {
    const c = baseContract();
    const authored = {
      ...c,
      pageContracts: [{ ...c.pageContracts[0], castStates: [{ castId: 'child:hero', bodyState: 'seated on the exam chair', injectionArm: 'left', freeHand: 'right' }] }],
    } as unknown as BookVisualContract;
    const p1 = contractToLocationPlanBundle(authored).pagePlans.find((pp) => pp.page === 1);
    expect(p1?.pageAction).toBeTruthy();
    expect(p1?.pageAction).toContain('seated on the exam chair');
    expect(p1?.pageAction).toContain('injection is on the left arm');
    expect(p1?.pageAction).toContain('Examination chair'); // propState composes too (prop NAME resolved)

    const plain = { ...c, pageContracts: [{ ...c.pageContracts[0], propState: [], castStates: undefined }] } as unknown as BookVisualContract;
    const p1b = contractToLocationPlanBundle(plain).pagePlans.find((pp) => pp.page === 1);
    expect(p1b && 'pageAction' in p1b).toBe(false);
  });
});

describe('Slice B — ref PROTECT tier is an empty-slot no-op', () => {
  it('an empty / absent protectedSetRefPaths leaves paths + breakdown byte-identical (no contractSetSheets key)', () => {
    const input = { styleRefPaths: ['s1.png', 's2.png'], childPhotoPath: 'child.png', config: 'A' as const, includeChildPhoto: true };
    const without = assembleStyle01BookReferencesWithZoneSheets(input);
    const withEmpty = assembleStyle01BookReferencesWithZoneSheets({ ...input, protectedSetRefPaths: [] });
    expect(withEmpty.paths).toEqual(without.paths);
    expect(withEmpty.breakdown).toEqual(without.breakdown);
    expect('contractSetSheets' in withEmpty.breakdown).toBe(false);
  });
});

describe('Slice B — the authored bunny template is the first valid instance', () => {
  it('the bunny TEMPLATE validates end-to-end with the Slice B fields (geometry + prop identity + castStates + mom-continuous)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const template: any = migrateLegacyBookVisualContractTemplateV1(
      JSON.parse(
        readFileSync('story-bank/v3-approved/bunny_ometz_adventure.visual-contract-template.json', 'utf8'),
      ),
    );
    expect(() => assertValidBookVisualContractTemplate(template)).not.toThrow();
    // carries the authored steering fields
    expect(template.zones.find((z: { id: string }) => z.id === 'clinic.exam_room').stableGeometry.length).toBeGreaterThan(0);
    expect(template.recurringProps.find((p: { id: string }) => p.id === 'exam_chair').scale).toContain('child');
    // laterality continuity: injection LEFT / bandage LEFT (same arm) and free hand RIGHT — consistent across 9-12.
    const arm = (n: number, k: 'injectionArm' | 'bandageArm' | 'freeHand') =>
      template.pageContracts.find((p: { pageNumber: number }) => p.pageNumber === n)
        .castStates.find((s: { castId: string }) => s.castId === 'child:hero')[k];
    expect(arm(9, 'injectionArm')).toBe('left');
    expect(arm(10, 'injectionArm')).toBe('left');
    expect(arm(11, 'bandageArm')).toBe('left');
    expect(arm(12, 'bandageArm')).toBe('left');
    for (const n of [9, 10, 11, 12]) expect(arm(n, 'freeHand')).toBe('right');
    // mom is continuous through the exam procedure.
    expect(template.humanCast.find((h: { id: string }) => h.id === 'human:mother').pagesPresent)
      .toEqual([1, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});
