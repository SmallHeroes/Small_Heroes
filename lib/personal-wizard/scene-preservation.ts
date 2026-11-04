import 'server-only';
import { z } from 'zod';
import { previewSha } from '../local-story-preview';
import { canonicalJson } from './request-acceptance';

/**
 * scene-preservation/v1 (native-cde-book/v2 only): one per-frame record, derived ONLY from the admitted effective frame projection, given to
 * the renderer's prompt and the judge's context alike; the frame's admitted reference set; the correction operation per attempt. Pure: no
 * provider, no key, no I/O. Nothing here reads prose, invents parts/layout, or promotes a drawn (HELD) picture to an authority.
 */
export const SCENE_PRESERVATION_VERSION = 'scene-preservation/v1' as const;
export const REFERENCE_CONTENT_VERSION = 'reference-content/v1' as const;
/** The only qualification method defined in this milestone, admitted only by the offline proof mode; a real source needs its own decision. */
export const OFFLINE_CONTENT_METHOD = 'synthetic_offline_fixture' as const;
export const SCENE_PRESERVATION_MODE = 'offline_synthetic_proof' as const;
const fail = (code: string): never => { throw Object.assign(new Error(code), { code }); };
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const id = z.string().regex(/^[a-z][a-z0-9_]{0,59}$/);

type Relation = { relation: string; targetId: string | null };
export type FrameProjection = {
  pageNumber: number; sceneId: string; locationId: string; castIds: string[]; entityIds: string[]; locationIds: string[];
  /** At the drawn instant (the packet's effective state). */ relations: Record<string, Relation>;
  /** End of this page's ledger (never the drawn instant). */ relationsEnd: Record<string, Relation>;
  fixed: Record<string, { attribute: string; value: string }[]>; kinds: Record<string, string>;
  /** Mutable values at the drawn instant / at the end of this page. */ mutable: Record<string, Record<string, string>>; mutableEnd: Record<string, Record<string, string>>;
  transitions: { entityId: string; from: Relation; to: Relation; evidence: string }[];
  changes: { entityId: string; attribute: string; value: string; storyEvidence: string }[];
  drawnInstant: { evidence: string; overrides: { entityId: string; value: Relation; evidence: string }[];
    attributes: { entityId: string; attribute: string; value: string; evidence: string }[] } | null;
};
type PacketContext = { pageNumber?: number; sequence?: { sceneId: string; visibleCastIds: string[]; relations: { entityId: string; value: Relation }[];
    allowedTransitions: FrameProjection['transitions']; drawnInstant?: FrameProjection['drawnInstant'] & object; endOfPageLedger?: { entityId: string; value: Relation }[] };
  visual: { page: { locationId: string }; continuity: { page: { visibleEntityIds: string[]; visibleLocationIds: string[] };
    entities: { id: string; kind: string; invariants: { attribute: string; value: string }[]; currentState: Record<string, string> }[] } } };

/**
 * The frame's effective projection, taken from the packet the existing engine already admits (relations and mutable values at the drawn
 * instant), plus the end-of-page ledger values the caller derives from the same book (needed only to bind a delta to its evidence).
 * Mutable attributes are never frozen as invariants: their initial value is only a starting value.
 */
export function frameProjection(packetContext: unknown, args: { pageNumber: number; castIds: readonly string[];
  mutableAttributes: readonly { entityId: string; attribute: string }[]; endRelations: readonly { entityId: string; value: Relation }[];
  endAttributes: Readonly<Record<string, Record<string, string>>>; changes: FrameProjection['changes'] }): FrameProjection {
  const p = packetContext as PacketContext, c = p?.visual?.continuity;
  if (!c?.page || !Array.isArray(c.entities) || !p.visual.page?.locationId) return fail('scene_preservation_projection');
  const seq = p.sequence;
  if (args.pageNumber > 0 && !seq) return fail('scene_preservation_projection');
  const entityIds = [...c.page.visibleEntityIds], castIds = [...args.castIds];
  const mutableOf = (entityId: string) => new Set(args.mutableAttributes.filter(m => m.entityId === entityId).map(m => m.attribute));
  const fixed: FrameProjection['fixed'] = {}, kinds: FrameProjection['kinds'] = {}, mutable: FrameProjection['mutable'] = {}, mutableEnd: FrameProjection['mutableEnd'] = {};
  for (const entityId of entityIds) {
    const e = c.entities.find(x => x.id === entityId) ?? fail('scene_preservation_projection');
    const m = mutableOf(entityId);
    kinds[entityId] = e.kind;
    fixed[entityId] = e.invariants.filter(i => !m.has(i.attribute)).map(i => ({ attribute: i.attribute, value: i.value }));
    mutable[entityId] = Object.fromEntries([...m].filter(a => a in e.currentState).map(a => [a, e.currentState[a]]));
    mutableEnd[entityId] = Object.fromEntries([...m].filter(a => a in (args.endAttributes[entityId] ?? {})).map(a => [a, args.endAttributes[entityId][a]]));
  }
  const relations: FrameProjection['relations'] = {}, relationsEnd: FrameProjection['relationsEnd'] = {};
  for (const r of seq?.relations ?? []) relations[r.entityId] = structuredClone(r.value);
  for (const r of args.endRelations) relationsEnd[r.entityId] = structuredClone(r.value);
  // A drawn-instant override changes THIS picture only; the ledger keeps its own end-of-page value.
  for (const r of seq?.endOfPageLedger ?? []) relationsEnd[r.entityId] = structuredClone(r.value);
  const d = seq?.drawnInstant;
  return { pageNumber: args.pageNumber, sceneId: seq?.sceneId ?? 'cover', locationId: p.visual.page.locationId, castIds, entityIds,
    locationIds: [...c.page.visibleLocationIds], relations, relationsEnd, fixed, kinds, mutable, mutableEnd,
    transitions: structuredClone(seq?.allowedTransitions ?? []), changes: structuredClone(args.changes),
    drawnInstant: d ? { evidence: d.evidence, overrides: structuredClone(d.overrides ?? []), attributes: structuredClone(d.attributes ?? []) } : null };
}

/** The record must equal the effective packet itself (two consumers sharing a wrong record is not enough). */
export function assertProjectionMatchesPacket(f: FrameProjection, packetContext: unknown) {
  const p = packetContext as PacketContext, c = p.visual.continuity;
  const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
  if (!same(f.entityIds, c.page.visibleEntityIds) || !same(f.locationIds, c.page.visibleLocationIds) || f.locationId !== p.visual.page.locationId) fail('scene_preservation_projection');
  if (p.sequence) {
    if (f.sceneId !== p.sequence.sceneId || !same(f.castIds, p.sequence.visibleCastIds)) fail('scene_preservation_projection');
    for (const r of p.sequence.relations) if (!same(f.relations[r.entityId], r.value)) fail('scene_preservation_projection');
  }
  for (const entityId of f.entityIds) {
    const e = c.entities.find(x => x.id === entityId)!;
    for (const [a, v] of Object.entries(f.mutable[entityId])) if (e.currentState[a] !== v) fail('scene_preservation_projection');
    for (const i of f.fixed[entityId]) if (e.currentState[i.attribute] !== i.value) fail('scene_preservation_projection');
  }
}

type DeltaItem = { entityId: string; aspect: 'relation' | 'attribute'; attribute?: string; from: unknown; to: unknown; evidence: string[] };
/**
 * The pictured difference between two consecutive frames of the SAME visit, each item bound to the admitted evidence of every step it takes:
 * previous drawn instant -> previous page end -> this page end -> this drawn instant. A step with no admitted evidence refuses before render:
 * no blanket permission for changes later on a page, and an event completed earlier may show now through its own page's evidence.
 */
export function picturedDelta(prev: FrameProjection, cur: FrameProjection): DeltaItem[] {
  const same = (a: unknown, b: unknown) => canonicalJson(a ?? null) === canonicalJson(b ?? null);
  const items: DeltaItem[] = [];
  const ids = [...new Set([...prev.castIds, ...prev.entityIds])].filter(x => cur.castIds.includes(x) || cur.entityIds.includes(x));
  for (const entityId of ids) {
    const a = prev.relations[entityId], d = cur.relations[entityId];
    if (a && d && !same(a, d)) {
      const b = prev.relationsEnd[entityId] ?? a, c = cur.relationsEnd[entityId] ?? d, evidence: string[] = [];
      if (!same(a, b)) evidence.push(prev.transitions.find(t => t.entityId === entityId && same(t.to, b))?.evidence
        ?? prev.drawnInstant?.overrides.find(o => o.entityId === entityId && same(o.value, a))?.evidence ?? fail('scene_preservation_unsupported_delta'));
      if (!same(b, c)) evidence.push(cur.transitions.find(t => t.entityId === entityId && same(t.from, b) && same(t.to, c))?.evidence ?? fail('scene_preservation_unsupported_delta'));
      if (!same(c, d)) evidence.push(cur.drawnInstant?.overrides.find(o => o.entityId === entityId && same(o.value, d))?.evidence ?? fail('scene_preservation_unsupported_delta'));
      items.push({ entityId, aspect: 'relation', from: a, to: d, evidence });
    }
    if (!prev.entityIds.includes(entityId) || !cur.entityIds.includes(entityId)) continue;
    if (!same(prev.fixed[entityId], cur.fixed[entityId]) || prev.kinds[entityId] !== cur.kinds[entityId]) fail('scene_preservation_unsupported_delta');
    for (const attribute of [...new Set([...Object.keys(prev.mutable[entityId]), ...Object.keys(cur.mutable[entityId])])]) {
      const a2 = prev.mutable[entityId][attribute], d2 = cur.mutable[entityId][attribute];
      if (same(a2, d2)) continue;
      const b2 = prev.mutableEnd[entityId]?.[attribute] ?? a2, c2 = cur.mutableEnd[entityId]?.[attribute] ?? d2, evidence: string[] = [];
      if (!same(a2, b2)) evidence.push(prev.changes.find(x => x.entityId === entityId && x.attribute === attribute && x.value === b2)?.storyEvidence
        ?? prev.drawnInstant?.attributes.find(x => x.entityId === entityId && x.attribute === attribute && x.value === a2)?.evidence ?? fail('scene_preservation_unsupported_delta'));
      if (!same(b2, c2)) evidence.push(cur.changes.find(x => x.entityId === entityId && x.attribute === attribute && x.value === c2)?.storyEvidence ?? fail('scene_preservation_unsupported_delta'));
      if (!same(c2, d2)) evidence.push(cur.drawnInstant?.attributes.find(x => x.entityId === entityId && x.attribute === attribute && x.value === d2)?.evidence ?? fail('scene_preservation_unsupported_delta'));
      items.push({ entityId, aspect: 'attribute', attribute, from: a2 ?? null, to: d2 ?? null, evidence });
    }
  }
  return items;
}

export type ScenePreservationRecord = ReturnType<typeof scenePreservationRecord>;
/** The shared record. Coverage is per entity AND aspect; material provenance never becomes parts or layout; undeclared structures are uncovered. */
export function scenePreservationRecord(cur: FrameProjection, prev: FrameProjection | null,
  predecessor: { pageNumber: number; imageSha: string; contextSha: string; usedForRender: boolean; omittedReason: string | null;
    doNotInherit: { requirement: string; note: string }[] } | null) {
  const sameVisit = !!prev && prev.sceneId === cur.sceneId && cur.pageNumber > 0;
  return { version: SCENE_PRESERVATION_VERSION, pageNumber: cur.pageNumber, sceneVisit: { sceneId: cur.sceneId, locationId: cur.locationId },
    baseline: !sameVisit, cast: cur.castIds.map(x => ({ id: x, relation: cur.relations[x] ?? null })), locations: cur.locationIds,
    entities: cur.entityIds.map(x => ({ id: x, kind: cur.kinds[x], fixed: cur.fixed[x], mutableState: cur.mutable[x], relation: cur.relations[x] ?? null,
      coverage: { identity: 'covered' as const, parts: 'not_covered' as const, relations: cur.relations[x] ? 'covered' as const : 'not_covered' as const,
        layout: 'not_covered' as const, currentState: Object.keys(cur.mutable[x]).length ? 'covered' as const : 'not_applicable' as const } })),
    drawnInstant: cur.drawnInstant ? { evidence: cur.drawnInstant.evidence } : null,
    picturedDelta: sameVisit ? picturedDelta(prev!, cur) : [],
    predecessor, undeclaredStructures: 'not_covered' as const };
}
export const recordDigest = (record: ScenePreservationRecord) => previewSha(canonicalJson(record));

/** Everything a reference may show in this frame: visible declared entities, visible locations and the frame's effective cast (with the child). */
export function allowedContentIds(f: FrameProjection) { return new Set([...f.entityIds, ...f.locationIds, ...f.castIds]); }

export const referenceContentSchema = z.object({ version: z.literal(REFERENCE_CONTENT_VERSION), imageSha: hash,
  contents: z.array(id).min(1).max(60), qualification: z.object({ method: z.literal(OFFLINE_CONTENT_METHOD), evidenceSha: hash }).strict() }).strict();
export type ReferenceContent = z.infer<typeof referenceContentSchema>;
export const contentEvidenceSha = (e: Pick<ReferenceContent, 'imageSha' | 'contents'> & { method: string }) =>
  previewSha(canonicalJson({ imageSha: e.imageSha, contents: [...e.contents].sort(), method: e.method }));
/**
 * Admission of one reference by its ACTUAL qualified content. The expected record never qualifies as evidence; a missing, malformed,
 * rebound or unqualified list admits nothing, and any currently disallowed ID refuses.
 */
export function admitReferenceContent(imageSha: string, evidence: unknown, allowed: ReadonlySet<string>, mustInclude?: string):
  { admitted: true; contents: string[] } | { admitted: false; reason: string } {
  const parsed = referenceContentSchema.safeParse(evidence);
  if (!parsed.success) return { admitted: false, reason: 'content_unqualified' };
  const e = parsed.data;
  if (e.imageSha !== imageSha || e.qualification.evidenceSha !== contentEvidenceSha({ ...e, method: e.qualification.method })) return { admitted: false, reason: 'content_binding' };
  if (new Set(e.contents).size !== e.contents.length) return { admitted: false, reason: 'content_unqualified' };
  if (e.contents.some(x => !allowed.has(x))) return { admitted: false, reason: 'content_forbidden' };
  if (mustInclude && !e.contents.includes(mustInclude)) return { admitted: false, reason: 'content_unqualified' };
  return { admitted: true, contents: [...e.contents] };
}

/** The judge's own role names for the scoped references (bound to their exact image hashes in the context, never by position). */
export const SCENE_JUDGE_ROLES = ['canonical_child', 'canonical_companion', 'canonical_entities', 'canonical_locations'] as const;
const judgeRoles = z.array(z.object({ role: z.enum(SCENE_JUDGE_ROLES), imageSha: hash }).strict()).min(2).max(4);
export function sceneJudgeReferenceRoles(context: unknown) {
  const sp = context && typeof context === 'object' ? (context as { scenePreservation?: { version?: unknown; referenceRoles?: unknown } }).scenePreservation : undefined;
  if (sp === undefined) return null;
  if (sp?.version !== SCENE_PRESERVATION_VERSION) return fail('scene_judge_reference_binding');
  const roles = judgeRoles.safeParse(sp.referenceRoles);
  if (!roles.success || new Set(roles.data.map(r => r.role)).size !== roles.data.length) return fail('scene_judge_reference_binding');
  return roles.data;
}

/** v2 prompts name references by role only; image numbers exist solely in the role-derived prefix the image planner adds. */
const POSITIONAL = /\bimages?\s*#?\s*\d+|\bimages?\s+(?:one|two|three|four|five)\b/i;
export function assertNoPositionalReferences(prompt: string) { if (POSITIONAL.test(prompt)) fail('scene_prompt_positional'); }
/** Reviewer-authored text is data: its own image numbering is the judge's, not the renderer's, so it is neutralised, never trusted. */
export const neutralisePositional = (text: string) => text.replace(new RegExp(POSITIONAL.source, 'gi'), 'a reference');

export type CorrectionFinding = { category: string; verdict: string; impact: string; requirement: string; note: string; bound?: boolean; derived?: boolean };
const GLOBAL_CATEGORIES = new Set(['scene', 'framing', 'environment', 'relative_scale']);
const GLOBAL_REQUIREMENTS = new Set(['scene_plan', 'framing', 'drawn_instant', 'companion_scale', 'page_text', 'visual_language', 'style']);
const GLOBAL_PREFIXES = ['location:', 'landmark_unique:', 'moment_requirement:', 'not_yet_revealed:'];
const LOCAL_PREFIXES = ['anatomy:', 'entity:', 'cast:', 'material:'];
const MATERIAL = new Set(['story', 'identity', 'continuity']);
/** Total, ordered classification: global wins over a local prefix; anything else usable is unclassified and redraws. */
export function findingLocality(f: CorrectionFinding): 'global' | 'local' | 'unclassified' {
  if (GLOBAL_CATEGORIES.has(f.category) || GLOBAL_REQUIREMENTS.has(f.requirement) || GLOBAL_PREFIXES.some(p => f.requirement.startsWith(p))) return 'global';
  if (f.requirement === 'anatomy' || LOCAL_PREFIXES.some(p => f.requirement.startsWith(p))) return 'local';
  return 'unclassified';
}
/** Edit only when every actionable material finding is a verified local defect, with no open uncertainty and a usable, passing child score. */
export function classifyCorrection(findings: readonly CorrectionFinding[], childPassed: boolean) {
  const material = findings.filter(f => MATERIAL.has(f.impact)), defects = material.filter(f => f.verdict === 'defect');
  const uncertain = material.filter(f => f.verdict !== 'defect'), kinds = defects.map(findingLocality);
  const redraw = (reason: string) => ({ kind: 'redraw' as const, reason, allowedRequirementIds: [] as string[], localDefects: [] as CorrectionFinding[] });
  if (!defects.length) return redraw(uncertain.length ? 'uncertain_only' : childPassed ? 'no_material_defect' : 'child_measurement_only');
  if (kinds.includes('global')) return redraw(kinds.includes('local') ? 'mixed_local_global' : 'global_defect');
  if (kinds.includes('unclassified')) return redraw('unclassified_locality');
  if (uncertain.length) return redraw('local_with_uncertainty');
  if (!childPassed) return redraw('local_with_failed_child_measurement');
  return { kind: 'edit' as const, reason: 'verified_local_defects', allowedRequirementIds: [...new Set(defects.map(f => f.requirement))], localDefects: defects };
}

/** Role-named rules (no image numbers): the page suffix, the record section and the local edit rules of v2. */
export const SCENE_V2_PAGE_SUFFIX = '\nThe scoped entity and location references are design authorities, not prior scenes. Draw only the current visible entities. Each character keeps its OWN features (nose or snout, ears, horns, colours): never transfer a feature between characters. Each landmark exists once. No text, labels or panel borders. The child\'s face must stay naturally readable, without changing the action or camera.';
export function scenePreservationPromptSection(record: ScenePreservationRecord) {
  const keep = record.entities.map(e => ({ id: e.id, kind: e.kind, fixed: e.fixed, state: e.mutableState, relation: e.relation }));
  return `\nSCENE PRESERVATION (${SCENE_PRESERVATION_VERSION}; data, not text to paint): keep each listed object's fixed design, identity and its relation exactly;` +
    ` change ONLY what PICTURED CHANGES lists, each for its quoted reason. ${record.baseline ? 'This is the first picture of this visit: no earlier picture to continue.' :
      'This continues the previous picture of the same visit.'}` +
    (record.predecessor?.usedForRender ? ' The scene continuity reference shows this place one moment earlier: keep its persistent structures\' construction and layout, never its listed defects.' : '') +
    `\nOBJECTS: ${JSON.stringify(keep)}\nPICTURED CHANGES: ${JSON.stringify(record.picturedDelta)}` +
    (record.predecessor?.usedForRender && record.predecessor.doNotInherit.length ? `\nDO NOT INHERIT: ${JSON.stringify(record.predecessor.doNotInherit)}` : '');
}
export const SCENE_EDIT_V2_RULES = 'LOCAL EDIT (scene-preservation/v1): the scene edit target is this page\'s chosen picture. Correct ONLY the verified local defects listed below. Keep the camera, composition, setting, every other actor, object and landmark, and all unaffected content exactly as they are. The design references are authorities for the corrected parts only; never paste their tiles, labels or backgrounds. Do not add or remove any object, actor or event the frozen page description does not establish. Keep anatomy readable; no invented limb or prop.';
