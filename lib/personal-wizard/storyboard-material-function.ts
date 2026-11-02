import { z } from 'zod';
import { sourceSpans } from './storyboard-claim-basis';
import { isKindPhrase } from './storyboard-landmark-kind';
import type { InstanceDistinction } from './storyboard-instance-distinction';

export const ENTITY_MATERIAL_FUNCTION_VERSION = 'entity-material-function/v1' as const;
const id = z.string().trim().min(1).max(80);
export const builtFromSchema = z.object({
  sources: z.array(z.union([z.object({ entityId: id }).strict(), z.object({ locationId: id, kind: z.string().trim().min(1).max(40) }).strict()])).min(1).max(12),
  evidence: z.object({ citation: z.string().regex(/^p\d{1,2}:s\d{1,3}$/), quote: z.string().trim().min(1).max(3000) }).strict(),
}).strict();
export type BuiltFrom = z.infer<typeof builtFromSchema>;
export type EntityMaterialFunction = { version: typeof ENTITY_MATERIAL_FUNCTION_VERSION; entities: { id: string; builtFrom: BuiltFrom }[] };

export const MATERIAL_STORYBOARD_ADDENDUM = `ENTITY MATERIAL/FUNCTION CONTRACT: every plan.continuity.entities entry declares builtFrom,
null for an object that is not built from other things, otherwise { sources, evidence }. Each source is {entityId} naming a continuity entity
or {locationId,kind} naming an actual population kind in that location. Use evidence {citation,quote}: the exact materialSourceSpans sentence id and
its verbatim sentence that states the construction. That one sentence must itself name the components: a sentence that refers to them only
as "them", "it" or "they" does not state the construction, so cite the sentence that names them instead. Keep each entity's design and builtFrom
consistent: a design or kind that says the object is made of other things (for example a tower of blocks) needs builtFrom; when no sentence
states what it is made of, use builtFrom null and describe only its stated look, never its components. Never invent components or rewrite the manuscript. Shapes belong to invariants;
momentary contact/action belongs to the existing page prop states and depicted relations. A wedge may land on its broad flat face; landing
flat does not make it a cube. Palette is required only when the source states it; grey/shading alone is not another material.`;
export const MATERIAL_REVIEW_ADDENDUM = `ENTITY MATERIAL/FUNCTION CONTRACT: verify that every built object's declared builtFrom is complete,
that its exact quote actually supports the listed components/materials, and that its fixed design and depicted contact state respect the
source. A quotation's existence proves binding, not meaning. Missing, invented or ambiguous lineage holds as contradiction/uncertain.
Do not turn a momentary contact state into a permanent shape. A wedge with a flat landing face is valid; a tilted/edge contact contradicts
an explicit flat-face landing. Grey is not stone by itself, and no palette may be invented from an unstated colour.`;
export const MATERIAL_IMAGE_RULES = `ENTITY MATERIAL/FUNCTION CONTRACT: context.materialFunction identifies source-bound construction.
Judge the built object's visible components/materials against those sources and its exact quote. Hold a clearly monolithic carved mass
where discrete component blocks are specified, or a source-explicit component/material/palette contradiction. A grey or shaded assembled
object passes this material question when no palette is specified. Keep permanent shape separate from contact/action state at the drawn
instant: a wedge or cube may land on a flat face; a visible tilted/edge contact fails an explicit flat-face landing. Fail a square only
when the source explicitly requires a round shape, never because of a guessed shape rule. Existing uncertainty/identity gates remain.`;

/** The provider draft carries explicit nullable annotations; without the flag its schema object is unchanged. */
export function withMaterialFunction<T extends z.AnyZodObject>(draft: T): T {
  const plan = draft.shape.plan as z.AnyZodObject, continuity = plan.shape.continuity as z.ZodOptional<z.AnyZodObject>;
  const base = continuity instanceof z.ZodOptional ? continuity.unwrap() : continuity as unknown as z.AnyZodObject;
  if (!(base instanceof z.ZodObject)) throw Error('personal_storyboard_material_schema');
  const entities = base.shape.entities as z.ZodArray<z.AnyZodObject>;
  return draft.extend({ plan: plan.extend({ continuity: base.extend({ entities: z.array(entities.element.extend({ builtFrom: builtFromSchema.nullable() })) }) }) }) as unknown as T;
}

/** Remove new fields only under the opt-in contract, preserving the original draft for self-check and repair comparison. */
export function splitMaterialFunction(raw: unknown) {
  const draft = structuredClone(raw) as any, entities = draft?.plan?.continuity?.entities;
  if (!Array.isArray(entities)) return { draft: raw, annotations: undefined };
  const annotations = entities.map(e => { const builtFrom = e?.builtFrom; if (e && typeof e === 'object') delete e.builtFrom; return { id: e?.id, builtFrom }; });
  return { draft, annotations };
}

/** Structural/source binding only. Semantic completeness and image material recognition remain independent review duties. */
export function compileMaterialFunction(plan: { continuity?: { entities: readonly { id: string }[] } }, instances: InstanceDistinction,
  texts: readonly string[], raw: unknown): EntityMaterialFunction {
  const bad = (): never => { throw Error('personal_storyboard_material_function'); };
  const result = z.array(z.object({ id, builtFrom: builtFromSchema.nullable() }).strict()).safeParse(raw);
  if (!result.success || !plan.continuity) return bad();
  const ids = plan.continuity.entities.map(e => e.id), rows = result.data;
  if (rows.length !== ids.length || new Set(rows.map(e => e.id)).size !== rows.length || rows.some(e => !ids.includes(e.id))) bad();
  const spans = Object.values(sourceSpans(texts)).flat();
  const entities = rows.flatMap(row => {
    if (row.builtFrom === null) return [];
    const builtFrom = row.builtFrom;
    if (!spans.some(s => s.id === builtFrom.evidence.citation && s.text === builtFrom.evidence.quote)) bad();
    const keys = builtFrom.sources.map(s => 'entityId' in s ? `entity:${s.entityId}` : `location:${s.locationId}:${s.kind}`);
    if (new Set(keys).size !== keys.length) bad();
    for (const source of builtFrom.sources) {
      if ('entityId' in source) { if (source.entityId === row.id || !ids.includes(source.entityId)) bad(); }
      else if (!isKindPhrase(source.kind) || source.kind !== source.kind.toLowerCase() ||
        !instances.populations.some(p => p.locationId === source.locationId && p.kinds.includes(source.kind))) bad();
    }
    return [{ id: row.id, builtFrom }];
  });
  const visited = new Set<string>();
  const visit = (entity: string, stack: Set<string>) => {
    if (visited.has(entity)) return;
    if (stack.has(entity)) bad();
    const lineage = entities.find(e => e.id === entity); if (!lineage) return;
    for (const source of lineage.builtFrom.sources) if ('entityId' in source) visit(source.entityId, new Set([...stack, entity]));
    visited.add(entity);
  };
  for (const entity of entities) visit(entity.id, new Set());
  return { version: ENTITY_MATERIAL_FUNCTION_VERSION, entities };
}

export const materialFunctionSchema = z.object({ version: z.literal(ENTITY_MATERIAL_FUNCTION_VERSION),
  entities: z.array(z.object({id,builtFrom:builtFromSchema}).strict()).max(24) }).strict();
/** Optional marker is bound into the full context hash; a malformed marker is never silently ignored. */
export function materialFunctionFromContext(context: unknown): EntityMaterialFunction | undefined {
  if (!context || typeof context !== 'object' || !('materialFunction' in context)) return undefined;
  return materialFunctionSchema.parse(context.materialFunction);
}
export const MATERIAL_RENDER_RULES = 'ENTITY MATERIAL/FUNCTION CONTRACT: draw a built object as assembled from its source-bound components and materials, preserving any source-explicit palette. Keep permanent shape separate from the planned contact/action: a wedge may land on its broad flat face. Grey shading alone does not change material. Do not turn discrete blocks into one carved mass, invent colours, reveal future forms or add unowned actors/tiles.';
export function materialRenderAppendix(context: unknown) {
  const material = materialFunctionFromContext(context);
  return material ? '\n'+MATERIAL_RENDER_RULES+'\nSOURCE-BOUND CONSTRUCTION (data, not a new event or permission to reveal future forms): '+JSON.stringify(material)+
    '\nSource ids describe materials, not extra tiles or actors. Draw only the entities owned by this sheet or visible in this frame.' : '';
}
