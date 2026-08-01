/**
 * Deterministic check-id resolution for a page's enforcement-relevant claims (Stage 4).
 *
 * Stage 5 requires the QA response to carry EXACTLY ONE result per required check id — no missing, no duplicate, no
 * unknown. That is only possible if every enforceable claim on a page HAS a stable id. Today only
 * `PageActionRequirement` carries an authored `checkId`; prop-visibility and hazard claims carry none.
 *
 * So the ids are MINTED DETERMINISTICALLY from each claim's own content:
 *  - stable across compiles, so no authoring churn (and no hash churn — these ids are DERIVED at read time, never
 *    stored on the contract, so they cannot move a frozen hash);
 *  - collision-detectable at compile time: two claims that would bind to ONE QA result is an ambiguity Stage 5 could
 *    not resolve, so the validator rejects it (see validateBookVisualContract).
 *
 * The three namespaces are disjoint by construction — `action:` (authored) / `prop:` / `safety:` — so a minted id can
 * never collide with an authored one, and neither can collide with the `safety:` evidence TAG used by the QA track
 * (a different id space entirely; binding checkId → a QA check is Stage 5's job, not this module's).
 *
 * PURE — no I/O, no clock, no randomness.
 */
import type { PageVisualContract } from './types';

export type PageCheckKind = 'action' | 'prop' | 'safety';

export interface PageCheck {
  /** Stable, namespaced, unique within the page. */
  checkId: string;
  kind: PageCheckKind;
  /** Human-readable statement of what this check asserts — for QA prompts and validator error messages. */
  claim: string;
}

/** Lowercase, non-alphanumerics → `_`, trimmed. Keeps a minted id inside the same charset as an authored one. */
function slug(value: string): string {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Every enforcement-relevant claim on a page, each with its resolved check id, in a deterministic order
 * (props → actions → safety, each in authored declaration order).
 *
 * Returns `[]` for a page with no structure — a v1 page has nothing to enforce, which is not an error.
 */
export function resolvePageCheckIds(page: PageVisualContract): PageCheck[] {
  const checks: PageCheck[] = [];
  // TOTAL over unvalidated input — never throws. The validator calls this while a contract is still being
  // checked, so a malformed entry must be SKIPPED here and reported there (a throw would escape the validator's
  // "return the problems" contract and become unclassifiable).
  const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  const obj = (v: unknown): Record<string, unknown> | null =>
    typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

  for (const raw of arr(page.propConstraints)) {
    const pc = obj(raw);
    const propId = str(pc?.propId);
    const visibility = str(pc?.visibility);
    if (!propId || !visibility) continue;
    checks.push({
      checkId: `prop:${slug(visibility)}_${slug(propId)}`,
      kind: 'prop',
      claim: `prop "${propId}" must be ${visibility === 'required' ? 'VISIBLE' : 'ABSENT'}`,
    });
  }

  for (const raw of arr(page.actionRequirements)) {
    const action = obj(raw);
    const checkId = str(action?.checkId);
    const predicate = str(action?.predicate);
    const subject = obj(action?.subject);
    const entitySubject = obj(subject?.entity);
    const entitySubjectKind = str(entitySubject?.kind);
    const entitySubjectId = str(entitySubject?.id);
    const subjectRef =
      subject?.kind === 'entity' &&
      entitySubjectKind &&
      entitySubjectId
        ? `${entitySubjectKind}:${entitySubjectId}`
        : subject?.kind === 'source_phenomenon' &&
            str(subject?.sourceEvidenceId)
          ? `source_phenomenon:${subject.sourceEvidenceId}`
          : str(action?.actorId);
    if (!checkId || !subjectRef || !predicate) continue;
    const object = obj(action?.object);
    const objRef = object && str(object.kind) && str(object.id) ? `${object.kind}:${object.id}` : null;
    const spatialEffect = obj(action?.spatialEffect);
    const spatialTarget = obj(spatialEffect?.target);
    const spatialTargetKind = str(spatialTarget?.kind);
    const spatialTargetId = str(spatialTarget?.id);
    const spatialResult =
      spatialEffect?.kind === 'directional' &&
      str(spatialEffect.direction)
        ? ` -> ${spatialEffect.direction}`
        : spatialEffect?.kind === 'relation' &&
            str(spatialEffect.relation) &&
            spatialTargetKind &&
            spatialTargetId
          ? ` -> ${spatialEffect.relation} ${spatialTargetKind}:${spatialTargetId}`
          : '';
    checks.push({
      checkId,
      kind: 'action',
      claim: `${subjectRef} ${action?.polarity === 'must_not' ? 'must NOT ' : ''}${predicate}${objRef ? ` ${objRef}` : ''}${spatialResult}`,
    });
  }

  for (const raw of arr(page.safetyConstraints)) {
    const safety = obj(raw);
    const subjectId = str(safety?.subjectId);
    const relation = str(safety?.relation);
    const target = obj(safety?.target);
    const targetKind = str(target?.kind);
    const targetId = str(target?.id);
    if (!subjectId || !relation || !targetKind || !targetId) continue;
    checks.push({
      checkId: `safety:${slug(relation)}_${slug(subjectId)}_${slug(targetKind)}_${slug(targetId)}`,
      kind: 'safety',
      claim: `${subjectId} ${relation} ${targetKind}:${targetId}`,
    });
  }

  return checks;
}
