import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { PreviewContinuity } from './local-preview-quality';

// Prospective local-sample preferences, NOT an exception list for existing defects.
export const VISUAL_PRIORITY_VERSION = 'local-visual-priority/v1';
const id = z.string().regex(/^[a-z][a-z0-9_]{0,49}$/);
const sha = z.string().regex(/^[a-f0-9]{64}$/);
export const visualPrioritySchema = z.object({
  version: z.literal(VISUAL_PRIORITY_VERSION), sourceSha: sha, planSha: sha,
  decorativePreferences: z.array(z.object({
    id, entityId: id, attribute: z.string().trim().min(1).max(120),
    preference: z.string().trim().min(1).max(400),
    scope: z.literal('nonfunctional_surface_detail'),
    rationale: z.string().trim().min(1).max(400),
  }).strict()).min(1).max(12),
}).strict();
type PolicyData = z.infer<typeof visualPrioritySchema>;
declare const validated: unique symbol;
export type VisualPriorityPolicy = PolicyData & { readonly [validated]: true; readonly pageNumber?: number };
const compiled = new WeakMap<VisualPriorityPolicy, { serialized: string; pages: PreviewContinuity['pages'] }>();
const serialize = (v: unknown) => JSON.stringify(v);

export function compileVisualPriorityPolicy(raw: unknown, authority: {
  sourceSha: string; planSha: string; continuity: PreviewContinuity;
}): VisualPriorityPolicy {
  const data = visualPrioritySchema.parse(raw);
  if (data.sourceSha !== authority.sourceSha || data.planSha !== authority.planSha) throw Error('visual_priority_source_binding');
  if (new Set(data.decorativePreferences.map(p => p.id)).size !== data.decorativePreferences.length ||
    new Set(data.decorativePreferences.map(p => `${p.entityId}:${p.attribute.toLowerCase()}`)).size !== data.decorativePreferences.length) throw Error('visual_priority_duplicate');
  for (const p of data.decorativePreferences) {
    const entity = authority.continuity.entities.find(e => e.id === p.entityId);
    if (!entity || entity.kind === 'supporting_character') throw Error('visual_priority_entity');
    // A preference cannot demote an invariant or a story-supported state change.
    // Semantic aliases/prose conflicts still require editorial review; no regex can prove intent.
    if (entity.invariants.some(i => i.attribute.trim().toLowerCase() === p.attribute.toLowerCase()) ||
      authority.continuity.pages.some(page => page.changes.some(c => c.entityId === p.entityId && c.attribute.trim().toLowerCase() === p.attribute.toLowerCase()))) throw Error('visual_priority_required_collision');
  }
  const policy = data as VisualPriorityPolicy;
  compiled.set(policy, { serialized: serialize(policy), pages: structuredClone(authority.continuity.pages) });
  return policy;
}

export function visualPriorityDigest(policy: VisualPriorityPolicy): string {
  const original = compiled.get(policy);
  if (!original || original.serialized !== serialize(policy)) throw Error('visual_priority_unvalidated_or_changed');
  return createHash('sha256').update(original.serialized).digest('hex');
}

export function visualPriorityForPage(policy: VisualPriorityPolicy | undefined, pageNumber: number) {
  if (!policy) return undefined;
  visualPriorityDigest(policy);
  if (policy.pageNumber !== undefined) throw Error('visual_priority_requires_book_policy');
  const authority = compiled.get(policy)!;
  const page = authority.pages.find(p => p.pageNumber === pageNumber);
  if (!page) throw Error('visual_priority_unknown_page');
  const projected = { ...policy, pageNumber, decorativePreferences: policy.decorativePreferences
    .filter(p => page.visibleEntityIds.includes(p.entityId)).map(p => ({ ...p })) };
  compiled.set(projected, { serialized: serialize(projected), pages: authority.pages });
  return projected;
}

export const VISUAL_PRIORITY_INSTRUCTION = `PROSPECTIVE DECORATIVE PREFERENCES:
All canonical requirements, anatomy, identity, functional structure/count/material, physical scale,
environment topology, occupancy, custody, story action, framing and safety remain mandatory.
Only the separately listed nonfunctional surface details are preferences, not required exact matches.
Do NOT move any mandatory defect into decorativeChecks or reinterpret a conflict in favor of a preference.
An exact decorative detail may vary only while the same object and the story remain clearly intact.
Copy policySha from the supplied data. Return one decorativeCheck per listed preference ID: matched, variation, not_visible, or uncertain.
Report visible cosmetic variation honestly even when all eight mandatory categories pass. not_visible
means that detail cannot be seen, not that a required object may disappear. Uncertainty about whether a
variation changes identity, physical function or story meaning must hold, never silently pass.
Do not infer decorative exceptions from references or previous images. No publication acceptance.`;

export function visualPriorityPrompt(policy?: VisualPriorityPolicy, entityIds?: string[]) {
  if (!policy) return '';
  return '\n\nAim for these optional nonfunctional surface decorations. They never override required identity, structure, material, scale or physical/story state. Do not add an object just to show its decoration. Do not paint labels or this metadata.\n' +
    `DECORATIVE PREFERENCE DATA: ${serialize({ policySha: visualPriorityDigest(policy), ...policy,
      ...(entityIds ? { decorativePreferences: policy.decorativePreferences.filter(p => entityIds.includes(p.entityId)) } : {}) })}`;
}
