import { z } from 'zod';
import { normalizedBoxSchema, validateNormalizedBox } from './local-anatomy-experiment';

// Offline research only. No provider, prompt, calibration, repair or release integration.
export const ANATOMY_EVIDENCE_VERSION = 'anatomy-evidence-policy/offline-v1';
const id = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
const note = z.string().trim().min(1).max(1200);
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const boundary = z.object({ region: normalizedBoxSchema, observation: note }).strict();
const attachment = z.discriminatedUnion('state', [
  z.object({ state: z.literal('attached'), boundary }).strict(),
  z.object({ state: z.literal('occluded'), occluder: note, boundary }).strict(),
  z.object({ state: z.literal('hidden'), occluder: note, boundary }).strict(),
  z.object({ state: z.literal('unresolved'), observation: note }).strict(),
  z.object({ state: z.literal('defect'), kind: z.enum(['extra_part', 'disconnected_fragment', 'merged_parts', 'impossible_joint']),
    observation: note, correction: note }).strict(),
]);
const reportSchema = z.object({
  version: z.literal(ANATOMY_EVIDENCE_VERSION), candidateSha: sha, contextSha: sha,
  coverage: z.enum(['complete', 'incomplete']),
  subjects: z.array(z.object({ id, parts: z.array(z.object({
    id, kind: z.enum(['hand_endpoint', 'foot_endpoint', 'limb', 'fragment']),
    region: normalizedBoxSchema.nullable(), attachment,
  }).strict()).min(1).max(64) }).strict()).min(1).max(32),
}).strict();
const expectedSchema = z.object({
  candidateSha: sha, contextSha: sha,
  subjects: z.array(z.object({ id,
    // Caller-authorized maxima, never filled in from the model's observations.
    maxVisibleHands: z.number().int().min(0).max(64).nullable(),
    maxVisibleFeet: z.number().int().min(0).max(64).nullable(),
  }).strict()).min(1).max(32),
}).strict();
export type AnatomyEvidence = z.infer<typeof reportSchema>;
export type AnatomyExpectation = z.infer<typeof expectedSchema>;

export function adjudicateAnatomyEvidence(value: unknown, expectation: unknown) {
  const report = reportSchema.parse(value), expected = expectedSchema.parse(expectation);
  if (report.candidateSha !== expected.candidateSha || report.contextSha !== expected.contextSha) throw Error('anatomy_evidence_binding');
  const expectedIds = new Set(expected.subjects.map(s => s.id));
  const observedIds = new Set(report.subjects.map(s => s.id));
  if (expectedIds.size !== expected.subjects.length || observedIds.size !== report.subjects.length) throw Error('anatomy_duplicate_subject');
  // Unknown ownership is not evidence of an extra limb on a known character.
  const holds: string[] = report.coverage === 'incomplete' ? ['incomplete_coverage'] : [];
  if (expected.subjects.some(s => !observedIds.has(s.id)) || report.subjects.some(s => !expectedIds.has(s.id))) holds.push('subject_inventory_mismatch');
  const defects: { subjectId: string; partId: string | null; kind: string; correction: string | null }[] = [];
  for (const subject of report.subjects) {
    if (new Set(subject.parts.map(p => p.id)).size !== subject.parts.length) throw Error('anatomy_duplicate_part');
    for (const part of subject.parts) {
      const a = part.attachment;
      if (part.region) validateNormalizedBox(part.region);
      if ('boundary' in a) validateNormalizedBox(a.boundary.region);
      // Hidden parts have no invented visible box; visible fragments always do.
      if ((a.state === 'hidden') !== (part.region === null)) throw Error('anatomy_visibility_region_conflict');
      if (a.state === 'unresolved') holds.push(`${subject.id}:${part.id}:unresolved`);
      if (a.state === 'defect') defects.push({ subjectId: subject.id, partId: part.id, kind: a.kind, correction: a.correction });
    }
    const policy = expected.subjects.find(s => s.id === subject.id);
    if (!policy) continue;
    for (const [kind, max] of [['hand_endpoint', policy.maxVisibleHands], ['foot_endpoint', policy.maxVisibleFeet]] as const) {
      const visible = subject.parts.filter(p => p.kind === kind && p.attachment.state !== 'hidden');
      // Repeated crops/records of the same endpoint must not create a count defect.
      const distinctRegions = new Set(visible.map(p => JSON.stringify(p.region)));
      if (distinctRegions.size !== visible.length) {
        holds.push(`${subject.id}:${kind}:duplicate_region`);
        continue;
      }
      // An unresolved fragment must not become a definite extra hand by counting it.
      if (max !== null && visible.filter(p => p.attachment.state !== 'unresolved').length > max) {
        defects.push({ subjectId: subject.id, partId: null, kind: `excess_${kind}`, correction: null });
      }
    }
  }
  return { disposition: holds.length ? 'held_uncertain' : defects.length ? 'observed_defect' : 'observed_pass',
    holds, defects, evidence: report, renderAuthorized: false as const, repairAuthorized: false as const,
    pixelAccuracyProven: false as const };
}
