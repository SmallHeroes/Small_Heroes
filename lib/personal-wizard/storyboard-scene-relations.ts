import 'server-only';
import { z } from 'zod';
import { BOOK_SEQUENCE_ROLES, type bookSequenceSchema } from '../local-book-sequence';
import type { PreviewPlan } from '../local-story-preview';

export const SCENE_RELATIONS_VERSION = 'storyboard-scene-relations/v1' as const;
const id = z.string().regex(/^[a-z][a-z0-9_]{0,49}$/);
const label = z.string().trim().min(1).max(96).regex(/^[^\r\n\u0000-\u001f]+$/u);
const evidence = z.string().trim().min(1).max(360);
const pair = z.object({ from: id, to: id }).strict();
const frame = z.object({
  parts: z.array(z.object({ id, entityId: id, feature: label }).strict()).max(14),
  links: z.array(pair.extend({ relation: z.enum(['connected', 'separate']), evidence })).max(14),
  orientations: z.array(z.object({ surfaceId: id, actorId: id, mode: z.enum(['working', 'presenting']),
    recipientId: id.nullable(), uprightCue: label, evidence }).strict()).max(3),
}).strict();
const packet = frame.extend({ version: z.literal(SCENE_RELATIONS_VERSION) });
const schema = z.object({ version: packet.shape.version, frames: z.array(frame).min(3).max(25) }).strict();
export type SceneRelations = z.infer<typeof schema>;
export type SceneRelationPacket = z.infer<typeof packet>;
export const withStoryboardSceneRelations = <T extends z.AnyZodObject>(base: T, frameCount?: number) =>
  base.extend({ sceneRelations: frameCount === undefined ? schema : schema.extend({ frames: z.array(frame).length(frameCount) }) });
export const sceneRelationRef = (n: number) => `p${n}:scene_relations`;

const fail = (code: string): never => { throw Error(`storyboard_scene_relations_${code}`); };
const linkKey = ({ from, to }: z.infer<typeof pair>) => `scene_link:${from}:${to}`;
const orientationKey = (surfaceId: string) => `work_orientation:${surfaceId}`;

function bindParts(value: z.infer<typeof frame>) {
  const parts = new Map(value.parts.map(part => [part.id, part]));
  const featureKeys = new Set(value.parts.map(p => p.entityId + ':' + p.feature.toLowerCase()));
  if (parts.size !== value.parts.length || featureKeys.size !== parts.size) fail('duplicate_part');
  const pairs = new Set<string>(), used = new Set<string>();
  for (const { from, to } of value.links) {
    if (!parts.has(from) || !parts.has(to) || from === to) fail('part_binding');
    const key = [from, to].sort().join(':');
    if (pairs.has(key)) fail('duplicate_or_conflicting_link');
    pairs.add(key);
    used.add(from);
    used.add(to);
  }
  if (used.size !== parts.size) fail('unused_part');
  if (new Set(value.orientations.map(o => o.surfaceId)).size !== value.orientations.length) fail('duplicate_orientation');
  for (const o of value.orientations) {
    if (o.mode === 'working' ? o.recipientId !== null : !o.recipientId || o.recipientId === o.actorId) fail('orientation_recipient');
  }
  return parts;
}

/** Binds declared geometry to known entities, the frame and exact source spans. The storyboard review judges meaning and omissions. */
export function compileSceneRelations(raw: unknown, plan: PreviewPlan, sequence: z.infer<typeof bookSequenceSchema>, texts: readonly string[]) {
  const value = schema.parse(raw);
  if (value.frames.length !== plan.pages.length || texts.length !== plan.pages.length) fail('frame_coverage');
  const entities = new Set(plan.continuity?.entities.map(e => e.id));
  value.frames.forEach((f, n) => {
    const parts = bindParts(f);
    const visible = new Set(plan.continuity?.pages[n].visibleEntityIds);
    const cast = new Set(n ? sequence.pages[n - 1].visibleCastIds : [BOOK_SEQUENCE_ROLES.child, BOOK_SEQUENCE_ROLES.companion,
      ...(plan.continuity?.entities.filter(e => e.kind === 'supporting_character' && visible.has(e.id)).map(e => e.id) ?? [])]);
    const sources = n ? [texts[n]] : [texts[0], texts[1]];
    const cited = (quote: string) => {
      const matches = sources.filter(s => s.includes(quote));
      return matches.length === 1 && matches[0].indexOf(quote) === matches[0].lastIndexOf(quote);
    };
    for (const p of parts.values()) if (!entities.has(p.entityId) && !cast.has(p.entityId)) fail('entity_binding');
    for (const link of f.links) {
      const shown = [link.from, link.to].map(key => {
        const owner = parts.get(key)!.entityId;
        return visible.has(owner) || cast.has(owner);
      });
      if (link.relation === 'connected' ? !shown.every(Boolean) : !shown.some(Boolean)) fail('visible_binding');
      if (!cited(link.evidence)) fail('source_binding');
    }
    for (const o of f.orientations) {
      if (!visible.has(o.surfaceId) || !entities.has(o.surfaceId) || !cast.has(o.actorId) || o.actorId === o.surfaceId ||
          (o.recipientId !== null && !cast.has(o.recipientId))) fail('orientation_binding');
      if (!cited(o.evidence)) fail('source_binding');
    }
  });
  return value;
}

export const sceneRelationPacket = (relations: SceneRelations, n: number): SceneRelationPacket =>
  ({ version: relations.version, ...relations.frames[n] });

export function sceneRelationsFromContext(context: unknown) {
  const raw = (context as { packet?: { sceneRelations?: unknown } } | null)?.packet?.sceneRelations;
  if (raw === undefined) return undefined;
  const parsed = packet.parse(raw);
  bindParts(parsed);
  return parsed;
}

export const sceneRelationIds = (value: SceneRelationPacket) => [
  ...value.links.map(linkKey), ...value.orientations.map(o => orientationKey(o.surfaceId)),
];

export const SCENE_RELATIONS_PLANNER = `SCENE RELATIONS (storyboard-scene-relations/v1). Supply sceneRelations.frames for all frames, cover first, with parts, links and orientations (empty only when none apply).
- Declare each material connection and each material separation at the chosen drawn instant. Identify the exact visible ends or sections as parts of their canonical entityId (id is local to the frame, feature describes the part only). Use different parts for separate upstream runs, contact surfaces or destination openings even within one aggregate. A connected link goes from the relevant source/contact part to the intended receiver; a separate link names the two parts that cannot touch, merge or substitute for each other. Separate runs can share a named later receiver if the story says so. Distinguish a receiving basin, root, slot or surface from a nearby similar one. A separate link may name an offstage canonical entity to forbid substitution, without requiring it in the crop. A connection must be visible at the decisive boundary. Geometry is frame-specific; do not carry prior contacts through a change.
- When a visible asymmetric workpiece is being made, read, used or just paused in place, record surfaceId, actorId, mode working, recipientId null and an uprightCue naming the recognizable top of the work. Keep the workpiece's working/reading edge toward that actor, writing or painting right side up from their physical position. Stage the viewpoint around that fact. Use presenting only for a source-established action deliberately reorienting the workpiece for the visible cast member named by recipientId; finishing it does not grant that action. Do not equate reader legibility with the actor's upright view.
- For each link and orientation give exact evidence from that page (cover: title or first page). Keep IDs, composition, camera, props, action and ledger consistent. The record is for consequential geometry and orientation, not decorative placements or invented actions. A repair self-check can name a modified relations frame as p{n}:scene_relations.`;

export const SCENE_RELATIONS_REVIEW = `SCENE RELATIONS: use the separate scene_relations check on every frame. Check the links and workpiece orientation against the manuscript and the drawn instant. Look for consequential omissions even when the arrays are empty. Trace from exact parts to the correct recipient and require separations before any intended junction. Check adjacent beats for source-authorized changes. Check the composition, camera and full action do not contradict the record. Working includes pauses at the workpiece; a completed drawing does not establish a turn or a show to an audience. Verify that the viewpoint preserves the actor's natural orientation. Cite p{n}:scene_relations on that frame for a missing, unsupported, ambiguous or contradictory record. These are consequential physical-state findings, never harmless staging. Do not add a destination or require an intentionally offstage object.`;

export const SCENE_RELATIONS_RENDER = `SCENE RELATIONS: honor every declared link at its exact physical parts. Show the boundary between things which must stay separate. Join only to the specified part and receiver. For example, upstream lanes can meet at an explicitly connected downstream receiver, but must not merge earlier or empty into a different object. Location and design references do not supply scene contacts or override visibility.
Place a working surface with its natural bottom/working edge at the actor, so its top is away from them, even if it looks sideways or upside down to the camera. Match grip, gaze and marks to that orientation; use the artist's side or an oblique view if possible. Keep a just-paused workpiece in that position. Reorient a deliberately presented surface only as the frozen scene establishes. Never turn a workpiece for reader legibility alone. No diagrams, labels or text from this record.`;

/** The review records what is visible instead of supplying a general pass or a suggested change. */
const observation = z.string().trim().min(1).max(360);
const sceneRelationEvidence = z.object({
  links: z.array(pair.extend({ observed: z.enum(['connected', 'separate', 'reversed', 'unreadable']), observation })).max(14),
  orientations: z.array(z.object({ surfaceId: id,
    observed: z.enum(['upright_to_actor', 'upright_to_recipient', 'upside_down_to_actor', 'sideways_to_actor', 'unreadable']),
    observation }).strict()).max(3),
}).strict();
export type SceneRelationEvidence = z.infer<typeof sceneRelationEvidence>;
export function withSceneRelationEvidence<T extends z.AnyZodObject>(base: T, value?: SceneRelationPacket): T {
  return value ? base.extend({ sceneRelationEvidence }) as unknown as T : base;
}
export const SCENE_RELATIONS_PIXELS = `SCENE RELATION EVIDENCE: one observation per declared link and orientation, with the same ordered from/to or surfaceId. Trace the two named parts on the actual image, not on references or by trusting the desired state. For a link, report connected, separate, reversed (connection runs in the wrong direction) or unreadable. Two separate things can reach the same explicitly named receiver at different ends; inspect the visible boundary, not just their colours. The absence of an intentionally offstage object can support separation when the shown route and correct visible receiver are positively recognizable. For orientation, locate the actor, their working edge, and the named upright cue. Report upright_to_actor when the work is upright from the actor's side, upside_down_to_actor when its top points toward the working actor, and sideways_to_actor when its side edge is the working edge. These directions are relative to the actor, not screen axes. Report upright_to_recipient only if the actor is visibly presenting the work upright to the intended recipient. Give a concrete location and cue in observation for each item. A crop, occlusion or unclear join/edge is unreadable, not a match. Empty arrays only when no corresponding checks were declared.`;

export function sceneRelationFindings(contract: SceneRelationPacket, raw: unknown) {
  const review = sceneRelationEvidence.parse(raw);
  function compare<K, O extends string>(requirements: Map<K, O>, observations: { key: K; observed: string; observation: string }[], idOf: (key: K) => string) {
    const seen = new Set<K>();
    const findings = observations.flatMap(row => {
      const expected = requirements.get(row.key);
      if (expected === undefined || seen.has(row.key)) fail('review_binding');
      seen.add(row.key);
      if (expected === row.observed) return [];
      return [{ requirement: idOf(row.key), verdict: row.observed === 'unreadable' ? 'uncertain' as const : 'defect' as const, note: row.observation }];
    });
    if (seen.size !== requirements.size) fail('review_coverage');
    return findings;
  }
  return [
    ...compare(new Map(contract.links.map(l => [linkKey(l), l.relation])),
      review.links.map(row => ({ ...row, key: linkKey(row) })), key => key),
    ...compare(new Map(contract.orientations.map(o => [o.surfaceId, o.mode === 'working' ? 'upright_to_actor' : 'upright_to_recipient'])),
      review.orientations.map(row => ({ ...row, key: row.surfaceId })), orientationKey),
  ];
}
