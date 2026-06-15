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
  getExpectedStateForPage,
  isCompositionOnlyPosition,
  normalizeObservedState,
  pageHasStatefulExpectation,
  positionsCompatible,
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

function classifyStatefulFact(args: {
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
  const observedStateRaw = observed?.state ? normalizeObservedState(observed.state) : null;
  const needsStateCheck =
    hasPageExpectation || expectedState !== 'unchanged' || observedStateRaw != null;

  if (!needsStateCheck) {
    return classifyPositionFact({
      factId: args.factId,
      expectedFact: args.expectedFact,
      observed,
    });
  }

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

  const observedState = observedStateRaw ?? 'ambiguous';
  if (observedState === 'ambiguous' || observedState === 'not_visible') {
    if (isCompositionOnlyPosition(observed.position)) {
      return {
        factId: args.factId,
        status: 'unknown',
        expected: `${expected} · state=${expectedState}`,
        observed: observed.position,
        note: 'composition framing only',
      };
    }
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

  if (hasPageExpectation) {
    return {
      factId: args.factId,
      status: 'story_authorized_change',
      expected: `${expected} · state=${expectedState}`,
      observed: observedSummary(observed),
      note: 'observed state matches story-authorized expectation for this page',
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

function classifyPositionFact(args: {
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
      });
    default:
      return classifyPositionFact({
        factId: args.factId,
        expectedFact,
        observed: args.observed,
      });
  }
}

export function buildSceneMemoryDriftReport(args: {
  page: number;
  memory: SceneMemory;
  observed: ObservedSceneFacts;
  sceneMemoryLockPresent: boolean;
  pageAction?: string;
}): SceneMemoryDriftReport {
  const perFact: SceneMemoryDriftPerFact[] = Object.keys(args.memory.stableFacts).map((factId) => {
    const observedFact = args.observed.facts.find((f) => f.factId === factId);
    return classifyFact({
      factId,
      memory: args.memory,
      observed: observedFact,
      page: args.page,
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
    if (row.status === 'drift') {
      driftFlags.push(
        `${row.factId}: ${row.note ?? 'drift'} (expected: ${row.expected ?? '—'}; observed: ${row.observed ?? '—'})`
      );
    }
    if (row.status === 'unknown' && !/^(walls|floor)$/i.test(row.factId)) {
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
