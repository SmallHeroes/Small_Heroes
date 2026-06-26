import { describe, expect, it } from 'vitest';

import {
  buildContractRerollSuppression,
  caughtStrayEntities,
  type BookVisualContract,
  type PageVisionObservation,
  type ContractQaVerdict,
} from '@/lib/visual-contract-compiler';
import type { ResolvedPageContract } from '@/lib/visual-contract-compiler/derivePageVisualContracts';

const contract = {
  cast: { companion: { name: 'Koko' } },
  locations: [{ id: 'home_bedroom', name: 'Bedroom', description: 'a cozy bedroom' }],
  coverContract: { worldType: 'cozy home', timeOfDay: 'night' },
} as unknown as BookVisualContract;

const page = {
  locationId: 'home_bedroom',
  companionWardrobeLock: 'red scarf',
  characterPresence: { child: true, companion: true },
} as unknown as ResolvedPageContract;

function obs(over: Partial<PageVisionObservation>): PageVisionObservation {
  return {
    locationMatchesContract: true,
    forbiddenEntitiesPresent: [],
    missingMajorProps: [],
    companionWardrobeMatches: null,
    coverWorldMatches: null,
    ...over,
  };
}

function verdict(checks: ContractQaVerdict['failures'][number]['check'][]): ContractQaVerdict {
  return { pass: checks.length === 0, failures: checks.map((check) => ({ check, detail: check })) };
}

describe('caughtStrayEntities', () => {
  it('dedupes and trims', () => {
    expect(
      caughtStrayEntities(obs({ forbiddenEntitiesPresent: [' armadillo ', 'armadillo', 'dragon', ''] }))
    ).toEqual(['armadillo', 'dragon']);
  });
});

describe('buildContractRerollSuppression — feedback-aware (names the caught entity)', () => {
  it('forbidden entity → names the stray, forbids it, redirects to the allowed cast', () => {
    const s = buildContractRerollSuppression({
      observation: obs({ forbiddenEntitiesPresent: ['armadillo'] }),
      verdict: verdict(['forbidden_entity']),
      page,
      contract,
      attempt: 0,
    });
    expect(s).toContain('armadillo');
    expect(s).toMatch(/FORBIDDEN/);
    expect(s).toContain('Koko'); // redirect names the actual companion
    expect(s).toMatch(/Remove armadillo/);
    // attempt 0 → no escalation line yet
    expect(s).not.toMatch(/attempt 2/);
  });

  it('escalates wording on a later attempt (attempt >= 1)', () => {
    const s = buildContractRerollSuppression({
      observation: obs({ forbiddenEntitiesPresent: ['armadillo'] }),
      verdict: verdict(['forbidden_entity']),
      page,
      contract,
      attempt: 1,
    });
    expect(s).toMatch(/CRITICAL/);
    expect(s).toMatch(/attempt 3/); // attempt index 1 → human "attempt 3"
    expect(s).toMatch(/MUST be completely gone/);
  });

  it('wrong location → re-asserts the contract location', () => {
    const s = buildContractRerollSuppression({
      observation: obs({ locationMatchesContract: false }),
      verdict: verdict(['wrong_location']),
      page,
      contract,
      attempt: 0,
    });
    expect(s).toContain('Bedroom');
    expect(s).toMatch(/MUST take place/);
  });

  it('missing major prop → lists the missing items', () => {
    const s = buildContractRerollSuppression({
      observation: obs({ missingMajorProps: ['teddy bear'] }),
      verdict: verdict(['missing_major_prop']),
      page,
      contract,
      attempt: 0,
    });
    expect(s).toMatch(/MISSING/);
    expect(s).toContain('teddy bear');
  });

  it('companion wardrobe drift → re-asserts the locked outfit', () => {
    const s = buildContractRerollSuppression({
      observation: obs({ companionWardrobeMatches: false }),
      verdict: verdict(['companion_wardrobe_drift']),
      page,
      contract,
      attempt: 0,
    });
    expect(s).toContain('red scarf');
  });

  it('cover world mismatch → re-asserts world/time-of-day', () => {
    const s = buildContractRerollSuppression({
      observation: obs({ coverWorldMatches: false }),
      verdict: verdict(['cover_world_mismatch']),
      page,
      contract,
      attempt: 0,
    });
    expect(s).toContain('cozy home');
    expect(s).toContain('night');
  });

  it('passing verdict → empty string (no blind correction)', () => {
    expect(
      buildContractRerollSuppression({
        observation: obs({}),
        verdict: verdict([]),
        page,
        contract,
        attempt: 0,
      })
    ).toBe('');
  });
});
