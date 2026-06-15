import type { PageShot } from '../book-shot-plan/types';
import type {
  ObservedSceneFacts,
  SceneMemory,
  SceneMemoryDriftPerFact,
  SceneMemoryDriftReport,
  SceneMemoryStableFact,
} from './types';
import { VISION_CONFIDENCE_THRESHOLD } from './analyze';
import {
  appearanceCompatible,
  fortFormStateIsDrift,
  getExpectedStateForPage,
  isBlanketFact,
  isCompositionOnlyPosition,
  isFortFormPrimaryFact,
  isLampFact,
  isPillowAggregateFact,
  isWithinLockedPalette,
  normalizeObservedState,
  pageHasStatefulExpectation,
  positionsCompatible,
  shouldDegradeFixedPositionToUnknown,
  shouldEnforceStatefulDrift,
  statesCompatible,
} from './fact-compare';

function expectedSummary(fact: SceneMemoryStableFact): string {
  return [fact.position, fact.color, fact.appearance].filter(Boolean).join(' · ');
}

function observedSummary(observed: ObservedSceneFacts['facts'][0]): string {
  return [observed.position, observed.color, observed.state, observed.appearance]
    .filter(Boolean)
    .join(' · ');
}

function classifyAppearanceFact(args: {
  factId: string;
  expectedFact: SceneMemoryStableFact;
  observed?: ObservedSceneFacts['facts'][0];
}): SceneMemoryDriftPerFact {
  const expected = expectedSummary(args.expectedFact);
  const observed = args.observed;

  if (!observed || observed.visibility === 'not_visible' || observed.visibility === 'uncertain') {
    return {
      factId: args.factId,
      status: 'unknown',
      expected,
      observed: observed?.appearance ?? observed?.color ?? observed?.position,
      note: observed?.visibility ?? 'not analyzed',
    };
  }

  if (observed.confidence < VISION_CONFIDENCE_THRESHOLD) {
    return {
      factId: args.factId,
      status: 'unknown',
      expected,
      observed: observed.appearance ?? observed.color,
      note: `low confidence (${observed.confidence.toFixed(2)})`,
    };
  }

  const compat = appearanceCompatible(args.expectedFact, observed);
  if (compat === 'unknown') {
    return {
      factId: args.factId,
      status: 'unknown',
      expected,
      observed: observed.appearance ?? observed.color ?? observed.position,
      note: 'appearance not assessable',
    };
  }

  if (!compat) {
    return {
      factId: args.factId,
      status: 'drift',
      expected,
      observed: observedSummary(observed),
      note: 'appearance contradicts memory',
    };
  }

  return {
    factId: args.factId,
    status: 'consistent',
    expected,
    observed: observedSummary(observed) || observed.appearance || observed.color,
  };
}

function classifyPillowAggregateFact(args: {
  factId: string;
  expectedFact: SceneMemoryStableFact;
  observed?: ObservedSceneFacts['facts'][0];
}): SceneMemoryDriftPerFact {
  const expected = expectedSummary(args.expectedFact);
  const observed = args.observed;

  if (!observed || observed.visibility === 'not_visible' || observed.visibility === 'uncertain') {
    return {
      factId: args.factId,
      status: 'unknown',
      expected,
      observed: observed?.position ?? observed?.appearance,
      note: observed?.visibility ?? 'not analyzed',
    };
  }

  const lowSeverityNote =
    observed.color || observed.appearance
      ? isWithinLockedPalette(args.expectedFact.color, observed.color ?? observed.appearance)
        ? 'in-palette colour variation (low severity — not drift)'
        : observed.color || observed.appearance
          ? 'colour note (low severity — not drift)'
          : undefined
      : undefined;

  return {
    factId: args.factId,
    status: 'consistent',
    expected,
    observed: observedSummary(observed) || observed.position,
    lowSeverityNote,
  };
}

function classifyFortFormFact(args: {
  factId: string;
  memory: SceneMemory;
  expectedFact: SceneMemoryStableFact;
  observed?: ObservedSceneFacts['facts'][0];
  page: number;
}): SceneMemoryDriftPerFact {
  const expected = expectedSummary(args.expectedFact);
  const observed = args.observed;
  const expectedState = getExpectedStateForPage(args.memory, args.factId, args.page);
  const hasPageExpectation = pageHasStatefulExpectation(args.memory, args.factId, args.page);

  if (!observed || observed.visibility === 'not_visible' || observed.visibility === 'uncertain') {
    return {
      factId: args.factId,
      status: 'unknown',
      expected: `${expected} · state=${expectedState}`,
      observed: observed?.state ?? observed?.position,
      note: observed?.visibility ?? 'not analyzed',
    };
  }

  if (observed.confidence < VISION_CONFIDENCE_THRESHOLD) {
    return {
      factId: args.factId,
      status: 'unknown',
      expected: `${expected} · state=${expectedState}`,
      observed: observed.state ?? observed.position,
      note: `low confidence (${observed.confidence.toFixed(2)})`,
    };
  }

  const observedState = observed.state ? normalizeObservedState(observed.state) : 'ambiguous';
  if (observedState === 'ambiguous' || observedState === 'not_visible') {
    return {
      factId: args.factId,
      status: 'unknown',
      expected: `${expected} · state=${expectedState}`,
      observed: observed.state ?? observed.position,
      note: 'canopy/pile state not assessable',
    };
  }

  if (fortFormStateIsDrift(expectedState, observedState)) {
    return {
      factId: args.factId,
      status: 'drift',
      expected: `${expected} · state=${expectedState}`,
      observed: observedSummary(observed),
      note: `standing canopy vs expected ${expectedState}`,
    };
  }

  if (hasPageExpectation) {
    return {
      factId: args.factId,
      status: 'story_authorized_change',
      expected: `${expected} · state=${expectedState}`,
      observed: observedSummary(observed),
      note: 'observed form matches story-authorized expectation for this page',
    };
  }

  const positionOk =
    !observed.position ||
    isCompositionOnlyPosition(observed.position) ||
    positionsCompatible(args.expectedFact.position, observed.position);

  if (!positionOk && observed.position) {
    return {
      factId: args.factId,
      status: 'drift',
      expected,
      observed: observedSummary(observed),
      note: 'position contradicts memory',
    };
  }

  return {
    factId: args.factId,
    status: 'consistent',
    expected: `${expected} · state=${expectedState}`,
    observed: observedSummary(observed),
  };
}

function classifyStatefulFact(args: {
  factId: string;
  memory: SceneMemory;
  expectedFact: SceneMemoryStableFact;
  observed?: ObservedSceneFacts['facts'][0];
  page: number;
  pageShot?: PageShot | null;
}): SceneMemoryDriftPerFact {
  if (isPillowAggregateFact(args.factId)) {
    return classifyPillowAggregateFact({
      factId: args.factId,
      expectedFact: args.expectedFact,
      observed: args.observed,
    });
  }

  if (isFortFormPrimaryFact(args.factId)) {
    return classifyFortFormFact(args);
  }

  if (!shouldEnforceStatefulDrift(args.factId, args.memory, args.page)) {
    if (isBlanketFact(args.factId) || isLampFact(args.factId)) {
      const observed = args.observed;
      if (!observed || observed.visibility === 'not_visible' || observed.visibility === 'uncertain') {
        return {
          factId: args.factId,
          status: 'unknown',
          expected: expectedSummary(args.expectedFact),
          observed: observed?.position ?? observed?.state,
          note: observed?.visibility ?? 'not analyzed',
        };
      }
      return {
        factId: args.factId,
        status: 'consistent',
        expected: expectedSummary(args.expectedFact),
        observed: observedSummary(observed),
        note: 'no story-authorized state check on this page',
      };
    }
    return classifyPositionFact({
      factId: args.factId,
      expectedFact: args.expectedFact,
      observed: args.observed,
      pageShot: args.pageShot,
    });
  }

  const expected = expectedSummary(args.expectedFact);
  const observed = args.observed;
  const expectedState = getExpectedStateForPage(args.memory, args.factId, args.page);

  if (!observed || observed.visibility === 'not_visible' || observed.visibility === 'uncertain') {
    return {
      factId: args.factId,
      status: 'unknown',
      expected: `${expected} · state=${expectedState}`,
      observed: observed?.state ?? observed?.position,
      note: observed?.visibility ?? 'not analyzed',
    };
  }

  const observedState = observed.state ? normalizeObservedState(observed.state) : 'ambiguous';
  if (observedState === 'ambiguous' || observedState === 'not_visible') {
    return {
      factId: args.factId,
      status: 'unknown',
      expected: `${expected} · state=${expectedState}`,
      observed: observed.state ?? observed.position,
      note: 'state not assessable',
    };
  }

  if (!statesCompatible(expectedState, observedState)) {
    return {
      factId: args.factId,
      status: 'drift',
      expected: `${expected} · state=${expectedState}`,
      observed: observedSummary(observed),
      note: `state mismatch (expected ${expectedState}, observed ${observedState})`,
    };
  }

  return {
    factId: args.factId,
    status: 'story_authorized_change',
    expected: `${expected} · state=${expectedState}`,
    observed: observedSummary(observed),
    note: 'observed state matches story-authorized expectation for this page',
  };
}

function classifyPositionFact(args: {
  factId: string;
  expectedFact: SceneMemoryStableFact;
  observed?: ObservedSceneFacts['facts'][0];
  pageShot?: PageShot | null;
}): SceneMemoryDriftPerFact {
  const expected = expectedSummary(args.expectedFact);
  const observed = args.observed;

  if (!observed || observed.visibility === 'not_visible' || observed.visibility === 'uncertain') {
    return {
      factId: args.factId,
      status: 'unknown',
      expected,
      observed: observed?.position,
      note: observed?.visibility ?? 'not analyzed',
    };
  }

  if (observed.confidence < VISION_CONFIDENCE_THRESHOLD) {
    return {
      factId: args.factId,
      status: 'unknown',
      expected,
      observed: observed.position,
      note: `low confidence (${observed.confidence.toFixed(2)})`,
    };
  }

  if (!observed.position || isCompositionOnlyPosition(observed.position)) {
    return {
      factId: args.factId,
      status: 'unknown',
      expected,
      observed: observed.position,
      note: 'position not assessable in this framing',
    };
  }

  if (
    shouldDegradeFixedPositionToUnknown({
      factId: args.factId,
      expectedFact: args.expectedFact,
      observed,
      pageShot: args.pageShot,
    })
  ) {
    return {
      factId: args.factId,
      status: 'unknown',
      expected,
      observed: observed.position,
      note: 'weak framing evidence — not enough for position drift',
    };
  }

  const colorDrift =
    args.expectedFact.color &&
    observed.color &&
    appearanceCompatible(args.expectedFact, observed) === false;

  if (colorDrift) {
    return {
      factId: args.factId,
      status: 'drift',
      expected,
      observed: observedSummary(observed),
      note: 'color contradicts memory',
    };
  }

  if (!positionsCompatible(args.expectedFact.position, observed.position)) {
    return {
      factId: args.factId,
      status: 'drift',
      expected,
      observed: observedSummary(observed),
      note: 'position contradicts memory',
    };
  }

  return {
    factId: args.factId,
    status: 'consistent',
    expected,
    observed: observedSummary(observed) || observed.position,
  };
}

function classifyFact(args: {
  factId: string;
  memory: SceneMemory;
  observed?: ObservedSceneFacts['facts'][0];
  page: number;
  pageShot?: PageShot | null;
}): SceneMemoryDriftPerFact {
  const expectedFact = args.memory.stableFacts[args.factId];
  if (!expectedFact) {
    return { factId: args.factId, status: 'unknown', note: 'no expected fact' };
  }

  switch (expectedFact.factKind) {
    case 'appearance':
      return classifyAppearanceFact({
        factId: args.factId,
        expectedFact,
        observed: args.observed,
      });
    case 'stateful':
      return classifyStatefulFact({
        factId: args.factId,
        memory: args.memory,
        expectedFact,
        observed: args.observed,
        page: args.page,
        pageShot: args.pageShot,
      });
    default:
      return classifyPositionFact({
        factId: args.factId,
        expectedFact,
        observed: args.observed,
        pageShot: args.pageShot,
      });
  }
}

function shouldEmitDriftFlag(
  row: SceneMemoryDriftPerFact,
  factId: string,
  memory: SceneMemory,
  page: number
): boolean {
  if (factId.startsWith('unauthorized:')) return row.status === 'drift';
  if (isPillowAggregateFact(factId)) return false;
  if (
    (isBlanketFact(factId) || isLampFact(factId)) &&
    !shouldEnforceStatefulDrift(factId, memory, page)
  ) {
    return false;
  }
  if (row.status === 'drift') {
    if (/^(walls|floor)$/i.test(factId)) return false;
    if (!shouldEnforceStatefulDrift(factId, memory, page) && !isFortFormPrimaryFact(factId)) {
      return row.note?.includes('position') ?? false;
    }
    return true;
  }
  if (row.status === 'unknown' && !/^(walls|floor)$/i.test(factId)) {
    return true;
  }
  return false;
}

export function buildSceneMemoryDriftReport(args: {
  page: number;
  memory: SceneMemory;
  observed: ObservedSceneFacts;
  sceneMemoryLockPresent: boolean;
  pageAction?: string;
  pageShot?: PageShot | null;
}): SceneMemoryDriftReport {
  const perFact: SceneMemoryDriftPerFact[] = Object.keys(args.memory.stableFacts).map((factId) => {
    const observedFact = args.observed.facts.find((f) => f.factId === factId);
    return classifyFact({
      factId,
      memory: args.memory,
      observed: observedFact,
      page: args.page,
      pageShot: args.pageShot,
    });
  });

  for (const prop of args.observed.unauthorizedProps) {
    perFact.push({
      factId: `unauthorized:${prop}`,
      status: 'drift',
      observed: prop,
      note: 'prop not in closed inventory',
    });
  }

  const driftFlags: string[] = [];
  for (const row of perFact) {
    if (!shouldEmitDriftFlag(row, row.factId, args.memory, args.page)) continue;
    if (row.status === 'drift') {
      driftFlags.push(
        `${row.factId}: ${row.note ?? 'drift'} (expected: ${row.expected ?? '—'}; observed: ${row.observed ?? '—'})`
      );
    }
    if (row.status === 'unknown') {
      driftFlags.push(`${row.factId}: uncertain / not visible`);
    }
  }

  return {
    page: args.page,
    sceneId: args.memory.sceneId,
    expected: args.memory.stableFacts,
    observed: args.observed,
    perFact,
    driftFlags,
    sceneMemoryLockPresent: args.sceneMemoryLockPresent,
  };
}

export async function writeSceneMemoryDriftReportFile(
  dir: string,
  report: SceneMemoryDriftReport
): Promise<string> {
  const fs = await import('fs');
  const pathMod = await import('path');
  fs.mkdirSync(dir, { recursive: true });
  const filePath = pathMod.join(dir, `page-${String(report.page).padStart(2, '0')}-scene-memory-drift.json`);
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');
  return filePath;
}
