/**
 * P0 commit 3 — Template loader + family adapter + materialize→freeze wiring (money-adjacent).
 *
 * PROVES the invariants (no real DB / render / LLM): a Template never passes readFrozenVisualContract; the Template
 * loader is fail-closed; the family adapter wraps family-coherence, excludes derivedAt, and fails closed on missing
 * input; the RESOLVED (not the Template) is what the freeze hashes/persists; and a resume REUSES an already-frozen
 * valid Resolved WITHOUT re-materializing.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import type { Order } from '@prisma/client';
import {
  materialize,
  computeVisualContractHash,
  readFrozenVisualContract,
  tryLoadVisualContractTemplateArtifact,
  contractTemplateArtifactPath,
  InvalidTemplateContractError,
  VISUAL_CONTRACT_SCHEMA_VERSION,
  PALETTE_VERSION,
  type BookVisualContractTemplate,
  type ResolvedFamilyAppearanceProfile,
} from '@/lib/visual-contract-compiler';
import {
  ensureFrozenVisualContract,
  type EnsureFrozenVisualContractDeps,
} from '@/lib/generation-pipeline/ensure-frozen-visual-contract';
import { deriveResolvedFamilyAppearanceProfile } from '@/lib/generation-pipeline/resolve-family-appearance';
import type { PipelineCache } from '@/lib/generation-pipeline/types';

const FAMILY: ResolvedFamilyAppearanceProfile = { skinTone: 'warm medium-brown', hairColour: 'wavy dark brown' };

function template(): BookVisualContractTemplate {
  return JSON.parse(JSON.stringify({
    contractKind: 'template',
    schemaVersion: VISUAL_CONTRACT_SCHEMA_VERSION,
    version: 1,
    storyKey: 'clinic_visit',
    worldType: 'realistic_clinic',
    locations: [{ id: 'clinic', name: 'Clinic', description: 'a clinic', environmentClass: 'indoor' }],
    zones: [
      { id: 'clinic.waiting', locationId: 'clinic', name: 'Waiting', description: 'waiting' },
      { id: 'clinic.exam', locationId: 'clinic', name: 'Exam', description: 'exam' },
    ],
    cast: { child: { id: 'child:hero', role: 'child', wardrobe: { description: 'outfit' } } },
    recurringProps: [],
    forbiddenGlobalElements: [],
    coverContract: { worldType: 'realistic_clinic', locationId: 'clinic', mustShow: [], mustNotShow: [] },
    pageContracts: [
      { pageNumber: 1, locationId: 'clinic', zoneId: 'clinic.waiting', mustShow: ['x'], mustNotShow: [], characterPresence: { child: true, companion: false }, propState: [], camera: 'wide', castIds: ['child:hero', 'human:mother'], transition: { kind: 'steady' } },
      { pageNumber: 2, locationId: 'clinic', zoneId: 'clinic.exam', mustShow: ['x'], mustNotShow: [], characterPresence: { child: true, companion: false }, propState: [], camera: 'wide', castIds: ['child:hero', 'human:doctor'], transition: { kind: 'after_transition', fromZoneId: 'clinic.waiting', toZoneId: 'clinic.exam', cue: 'in' } },
    ],
    humanCast: [
      { id: 'human:mother', role: 'mother', gender: 'female', aliases: ['אמא'], textEvidence: 'p1 אמא', pagesPresent: [1], forbiddenAppearance: [], appearance: { skinTone: { mode: 'family_profile', origin: { kind: 'family_profile' } }, hairColour: { mode: 'family_profile', origin: { kind: 'family_profile' } }, hairStyle: { mode: 'explicit', value: 'medium-length wavy, loose, side part', origin: { kind: 'story_evidence', page: 1, phrase: 'p1' } } }, garments: [{ id: 'cardigan', colour: { mode: 'explicit', value: 'sage-green', origin: { kind: 'story_evidence', page: 1, phrase: 'p1' } } }] },
      { id: 'human:doctor', role: 'doctor', gender: 'male', aliases: ['הרופא'], textEvidence: 'p2 הרופא', pagesPresent: [2], forbiddenAppearance: [], appearance: { skinTone: { mode: 'deterministic_palette', origin: { kind: 'deterministic_palette', paletteId: 'd', version: PALETTE_VERSION } }, hairColour: { mode: 'deterministic_palette', origin: { kind: 'deterministic_palette', paletteId: 'd', version: PALETTE_VERSION } }, hairStyle: { mode: 'explicit', value: 'short combed, side part', origin: { kind: 'policy_default', policyId: 'h', version: 'v1' } } }, garments: [{ id: 'coat', colour: { mode: 'explicit', value: 'white', origin: { kind: 'policy_default', policyId: 'c', version: 'v1' } } }] },
    ],
  })) as BookVisualContractTemplate;
}

describe('P0 commit 3 — readFrozenVisualContract guard', () => {
  it('rejects a Template (never treated as a frozen contract); accepts a Resolved', () => {
    expect(readFrozenVisualContract(template())).toBeNull();
    const resolved = materialize(template(), FAMILY);
    expect(readFrozenVisualContract(resolved)).toBeTruthy();
  });

  it('(Fix 1) DISPATCHES: a Resolved with a deferred structured trait → null; a legacy vNext → passes', () => {
    const resolved = materialize(template(), FAMILY);
    const deferred = JSON.parse(JSON.stringify(resolved));
    deferred.humanCast[0].appearance.skinTone.value = 'deferred to the family lock'; // passes vNext, fails Resolved
    expect(readFrozenVisualContract(deferred)).toBeNull();
    const legacy = JSON.parse(JSON.stringify(resolved));
    delete legacy.contractKind; // no "resolved" kind → the vNext validation path
    expect(readFrozenVisualContract(legacy)).toBeTruthy();
  });
});

describe('P0 commit 3 — Template loader (fail-closed)', () => {
  let dir: string;
  afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

  it('missing → null (legacy fallback); valid → the template; invalid → throws', () => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'vc-tmpl-'));
    expect(tryLoadVisualContractTemplateArtifact(dir, 'nope')).toBeNull();
    writeFileSync(contractTemplateArtifactPath(dir, 'clinic_visit'), JSON.stringify(template()), 'utf8');
    expect(tryLoadVisualContractTemplateArtifact(dir, 'clinic_visit')?.template.storyKey).toBe('clinic_visit');
    writeFileSync(contractTemplateArtifactPath(dir, 'broken'), JSON.stringify({ contractKind: 'template' }), 'utf8');
    expect(() => tryLoadVisualContractTemplateArtifact(dir, 'broken')).toThrow(InvalidTemplateContractError);
  });
});

describe('P0 commit 3 — family adapter (wrap; exclude derivedAt; fail-closed on missing input)', () => {
  const order = { characterAnchors: null, familyContext: null } as Pick<Order, 'characterAnchors' | 'familyContext'>;

  it('derives concrete skin/hair from the child DNA — with NO derivedAt/metadata', () => {
    const cache = { childPhotoDescription: null, dna: { childStructured: { face: 'deep brown skin', hair: 'dark brown curly hair' } } } as unknown as Pick<PipelineCache, 'childPhotoDescription' | 'dna'>;
    const profile = deriveResolvedFamilyAppearanceProfile(order, cache);
    expect(profile.skinTone.trim().length).toBeGreaterThan(0);
    expect(profile.hairColour.trim().length).toBeGreaterThan(0);
    expect(Object.keys(profile).sort()).toEqual(['hairColour', 'skinTone']); // no derivedAt / extra metadata
  });

  it('FAILS closed when there is no family appearance input (no silent light-neutral default)', () => {
    const empty = { childPhotoDescription: null, dna: null } as unknown as Pick<PipelineCache, 'childPhotoDescription' | 'dna'>;
    expect(() => deriveResolvedFamilyAppearanceProfile(order, empty)).toThrow(/no family appearance input/);
  });
});

describe('P0 commit 3 — freeze wiring (money-adjacent invariants)', () => {
  const prevFlag = process.env.VISUAL_CONTRACT_FREEZE;
  afterEach(() => {
    if (prevFlag === undefined) delete process.env.VISUAL_CONTRACT_FREEZE;
    else process.env.VISUAL_CONTRACT_FREEZE = prevFlag;
  });

  it('freezes the RESOLVED (not the Template): operationKey is hash-keyed on the Resolved + payload carries it', async () => {
    process.env.VISUAL_CONTRACT_FREEZE = 'true';
    const resolved = materialize(template(), FAMILY);
    const hash = computeVisualContractHash(resolved);
    const order = { id: 'o1', visualContractHash: null } as unknown as Order;
    const box: { opts: { operationKey?: string; mutationPayload?: { visualContractHash?: string; visualContract?: { contractKind?: string } } } | null } = { opts: null };
    const withMutation = (async (_db: unknown, opts: unknown) => { box.opts = opts as typeof box.opts; }) as unknown as NonNullable<EnsureFrozenVisualContractDeps['withMutation']>;
    await ensureFrozenVisualContract(order, {} as PipelineCache, {
      db: {} as EnsureFrozenVisualContractDeps['db'],
      produce: async () => ({ contract: resolved, contractHash: hash }),
      withMutation,
    });
    expect(box.opts?.operationKey).toBe(`delivery_input:o1:visual_contract:${hash}`);
    expect(box.opts?.mutationPayload?.visualContractHash).toBe(hash);
    expect(box.opts?.mutationPayload?.visualContract?.contractKind).toBe('resolved');
  });

  it('RESUME reuses an already-frozen valid Resolved — produce is NEVER called (no re-materialize)', async () => {
    process.env.VISUAL_CONTRACT_FREEZE = 'true';
    const resolved = materialize(template(), FAMILY);
    const hash = computeVisualContractHash(resolved);
    const order = { id: 'o1', visualContractHash: hash } as unknown as Order;
    const cache = { visualContract: resolved } as unknown as PipelineCache;
    let produceCalled = false;
    const out = await ensureFrozenVisualContract(order, cache, {
      produce: async () => { produceCalled = true; throw new Error('resume must not re-materialize'); },
    });
    expect(produceCalled).toBe(false);
    expect(out).toBe(cache);
  });

  it('(Fix 1) RESUME with a CORRUPT frozen Resolved is NOT reused — fast-path skipped, produce IS called', async () => {
    process.env.VISUAL_CONTRACT_FREEZE = 'true';
    const bad = JSON.parse(JSON.stringify(materialize(template(), FAMILY)));
    bad.humanCast[0].appearance.hairColour.value = 'deferred to the family lock'; // corrupt Resolved
    // Order hash MATCHES the corrupt contract's hash: only readFrozen's Resolved-validation can prevent reuse.
    const order = { id: 'o1', visualContractHash: computeVisualContractHash(bad) } as unknown as Order;
    const cache = { visualContract: bad } as unknown as PipelineCache;
    let produceCalled = false;
    await ensureFrozenVisualContract(order, cache, {
      db: {} as EnsureFrozenVisualContractDeps['db'],
      produce: async () => { produceCalled = true; return null; },
    });
    expect(produceCalled).toBe(true);
  });
});
