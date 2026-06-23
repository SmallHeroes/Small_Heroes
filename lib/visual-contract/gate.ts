/**
 * Visual Contract hard gate — per-page decision logic (Phase 1).
 *
 * Pure functions that map a per-page vision OBSERVATION to accept/reroll across the
 * three failure classes. Increment 2's render gate builds the observation by composing
 * the existing vision evaluators (page-visual-qa / page-entity-qa / page-world-qa) plus
 * a mustShow check; this layer is the deterministic verdict and is unit-testable with
 * synthetic observations (no render needed).
 */

import type { BookVisualContract, FailureClass, PageContract } from './types';

export interface ObservedObject {
  present: boolean;
  correctScale?: boolean;
  correctState?: boolean;
  /** Set if the object was rendered as a different critical object (e.g. portal as gate). */
  confusedWith?: string | null;
}

export interface PageVisionObservation {
  /** Scene the image actually depicts (the gate maps it against worldStateByPage). */
  sceneId?: string | null;
  childCount?: number | null;
  photoreal?: boolean | null;
  companion?: { present: boolean; smallCub?: boolean | null; species?: string | null } | null;
  /** objectId -> what the image shows for it. */
  objects?: Record<string, ObservedObject>;
  /** mustShow strings the vision confirmed present. */
  mustShowSatisfied?: string[];
  /** mustNotShow strings the vision found violated. */
  mustNotShowViolations?: string[];
}

export interface PageGateFailure {
  failureClass: FailureClass;
  assertion: string;
  detail: string;
}

export interface PageGateResult {
  page: number;
  passed: boolean;
  failures: PageGateFailure[];
  warnings: PageGateFailure[];
}

export type GateVerdict = 'accept' | 'reroll' | 'fail';

function classifyMustNot(s: string): FailureClass {
  const l = s.toLowerCase();
  if (/clone|duplicate|photoreal|adult|giant|lion/.test(l)) return 'entity';
  if (/gate|portal|bedroom|kingdom|furniture|scene/.test(l)) return 'continuity';
  return 'storytelling';
}

export function evaluatePageAgainstContract(
  contract: BookVisualContract,
  page: number,
  obs: PageVisionObservation
): PageGateResult {
  const pc: PageContract | undefined = contract.pageContracts.find((p) => p.page === page);
  const failures: PageGateFailure[] = [];
  const warnings: PageGateFailure[] = [];
  if (!pc) {
    failures.push({ failureClass: 'continuity', assertion: 'page_contract_missing', detail: `no pageContract for page ${page}` });
    return { page, passed: false, failures, warnings };
  }

  // ── continuity: scene + critical objects (identity/scale/state).
  const expectedScene = contract.worldStateByPage[String(page)];
  if (obs.sceneId && expectedScene && obs.sceneId !== expectedScene) {
    failures.push({
      failureClass: 'continuity',
      assertion: 'scene_mismatch',
      detail: `expected sceneId="${expectedScene}", observed "${obs.sceneId}"`,
    });
  }
  const requiredObjectIds = pc.mustShow
    .filter((m) => m.startsWith('object:'))
    .map((m) => m.slice('object:'.length));
  for (const oid of requiredObjectIds) {
    const o = obs.objects?.[oid];
    if (!o || !o.present) {
      failures.push({ failureClass: 'continuity', assertion: 'object_missing', detail: `critical object "${oid}" absent` });
      continue;
    }
    if (o.confusedWith) {
      failures.push({
        failureClass: 'continuity',
        assertion: 'object_identity_confusion',
        detail: `"${oid}" rendered as "${o.confusedWith}"`,
      });
    }
    if (o.correctScale === false) {
      failures.push({ failureClass: 'continuity', assertion: 'object_scale_drift', detail: `"${oid}" wrong scale` });
    }
    if (o.correctState === false) {
      failures.push({ failureClass: 'continuity', assertion: 'object_state_drift', detail: `"${oid}" wrong state for page ${page}` });
    }
  }

  // ── entity: one illustrated child + companion scale/presence/species.
  if (obs.childCount != null && obs.childCount > 1) {
    failures.push({ failureClass: 'entity', assertion: 'duplicate_child', detail: `childCount=${obs.childCount}` });
  }
  if (obs.photoreal === true) {
    failures.push({ failureClass: 'entity', assertion: 'photoreal_not_illustrated', detail: 'image is photoreal; must be illustrated' });
  }
  if (pc.companion.present) {
    if (obs.companion?.present === false) {
      failures.push({ failureClass: 'entity', assertion: 'companion_missing', detail: 'companion expected but absent' });
    } else if (obs.companion) {
      const lock = contract.companionLock;
      if (lock?.characterScaleLock.neverAdultOrGiant && obs.companion.smallCub === false) {
        failures.push({ failureClass: 'entity', assertion: 'companion_scale', detail: 'companion is not a small cub' });
      }
      if (lock?.species && obs.companion.species && obs.companion.species.toLowerCase() !== lock.species.toLowerCase()) {
        failures.push({ failureClass: 'entity', assertion: 'wrong_companion_species', detail: `species "${obs.companion.species}" != "${lock.species}"` });
      }
    }
  } else if (obs.companion?.present === true) {
    warnings.push({ failureClass: 'entity', assertion: 'unexpected_companion', detail: 'companion present on a no-companion page' });
  }

  // ── storytelling: non-object mustShow satisfied + mustNotShow not violated.
  const satisfied = new Set((obs.mustShowSatisfied ?? []).map((s) => s.toLowerCase()));
  for (const m of pc.mustShow) {
    if (m.startsWith('object:')) continue; // handled under continuity
    if (!satisfied.has(m.toLowerCase())) {
      failures.push({ failureClass: 'storytelling', assertion: 'must_show_absent', detail: `not depicted: "${m}"` });
    }
  }
  for (const v of obs.mustNotShowViolations ?? []) {
    failures.push({ failureClass: classifyMustNot(v), assertion: 'must_not_show_violated', detail: v });
  }

  return { page, passed: failures.length === 0, failures, warnings };
}

/** Accept on pass; reroll while attempts remain; otherwise hard-fail (structured report). */
export function decideGateVerdict(result: PageGateResult, attemptsSoFar: number, maxRerolls: number): GateVerdict {
  if (result.passed) return 'accept';
  return attemptsSoFar < maxRerolls ? 'reroll' : 'fail';
}
