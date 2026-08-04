/**
 * One closed, versioned Action Semantic Catalog shared by Visual Contract
 * authoring, validation, prose projection, Blueprint authoring, and Blueprint
 * validation.
 *
 * The catalog is deliberately finite. It is runtime-checkable data, not prompt
 * prose and not a free-text mini-language. The v3 expansion was reviewed
 * against the complete production Story Source corpus; no story, character,
 * page, or prop identity participates in the runtime contract.
 */

export const ACTION_SEMANTIC_CATALOG_VERSION =
  'action-semantic-catalog/v3' as const;

export const ACTION_SEMANTIC_ENTITY_KIND_VALUES = [
  'cast',
  'prop',
  'spatial',
  'anchor',
] as const;

export type ActionSemanticEntityKind =
  (typeof ACTION_SEMANTIC_ENTITY_KIND_VALUES)[number];

export const ACTION_SEMANTIC_SUBJECT_KIND_VALUES = [
  ...ACTION_SEMANTIC_ENTITY_KIND_VALUES,
  'cast_group',
  'source_phenomenon',
] as const;

export type ActionSemanticSubjectKind =
  (typeof ACTION_SEMANTIC_SUBJECT_KIND_VALUES)[number];

export type ActionSemanticObjectRule =
  | 'required'
  | 'optional'
  | 'forbidden';

export type ActionSemanticSpatialEffectRule =
  | 'required'
  | 'optional'
  | 'forbidden';

export type ActionSemanticSpatialConstraintRule =
  | 'required'
  | 'optional'
  | 'forbidden';

export const ACTION_SEMANTIC_SPATIAL_CONSTRAINT_RELATION_VALUES = [
  'beside',
] as const;
export type ActionSemanticSpatialConstraintRelation =
  (typeof ACTION_SEMANTIC_SPATIAL_CONSTRAINT_RELATION_VALUES)[number];

export interface ActionSemanticCatalogEntryShape {
  predicate: string;
  proseProjection: string;
  subjectKinds: readonly ActionSemanticSubjectKind[];
  objectRule: ActionSemanticObjectRule;
  objectKinds: readonly ActionSemanticEntityKind[];
  spatialEffectRule: ActionSemanticSpatialEffectRule;
  spatialConstraintRule: ActionSemanticSpatialConstraintRule;
  spatialConstraintRelations: readonly ActionSemanticSpatialConstraintRelation[];
  lateralityAllowed: boolean;
  blueprintCapability: 'action_space';
  safetyConflictRelation:
    | 'must_not_sit_on'
    | 'must_not_stand_on'
    | null;
  corpusBasis:
    | 'existing_contract_authority'
    | 'reviewed_production_corpus';
}

function entry<
  const Predicate extends string,
  const ObjectKinds extends readonly ActionSemanticEntityKind[],
  const SubjectKinds extends readonly ActionSemanticSubjectKind[] = readonly ['cast'],
>(
  definition: Omit<
    ActionSemanticCatalogEntryShape,
    | 'predicate'
    | 'subjectKinds'
    | 'objectKinds'
    | 'spatialEffectRule'
    | 'spatialConstraintRule'
    | 'spatialConstraintRelations'
    | 'blueprintCapability'
  > & {
    predicate: Predicate;
    objectKinds: ObjectKinds;
    subjectKinds?: SubjectKinds;
    spatialEffectRule?: ActionSemanticSpatialEffectRule;
    spatialConstraintRule?: ActionSemanticSpatialConstraintRule;
    spatialConstraintRelations?: readonly ActionSemanticSpatialConstraintRelation[];
  },
) {
  return {
    ...definition,
    subjectKinds:
      definition.subjectKinds ?? (['cast'] as const),
    spatialEffectRule:
      definition.spatialEffectRule ?? ('forbidden' as const),
    spatialConstraintRule:
      definition.spatialConstraintRule ?? ('forbidden' as const),
    spatialConstraintRelations:
      definition.spatialConstraintRelations ?? ([] as const),
    blueprintCapability: 'action_space' as const,
  };
}

const ALL_OBJECT_KINDS = ACTION_SEMANTIC_ENTITY_KIND_VALUES;
const PHYSICAL_OBJECT_KINDS = [
  'cast',
  'prop',
  'spatial',
  'anchor',
] as const;

export const ACTION_SEMANTIC_CATALOG = [
  entry({
    predicate: 'holds',
    proseProjection: 'holds',
    objectRule: 'optional',
    objectKinds: PHYSICAL_OBJECT_KINDS,
    lateralityAllowed: true,
    safetyConflictRelation: null,
    corpusBasis: 'existing_contract_authority',
  }),
  entry({
    predicate: 'offers',
    proseProjection: 'offers',
    objectRule: 'optional',
    objectKinds: ['cast', 'prop'],
    lateralityAllowed: true,
    safetyConflictRelation: null,
    corpusBasis: 'existing_contract_authority',
  }),
  entry({
    predicate: 'touches',
    proseProjection: 'touches',
    subjectKinds: ['cast', 'source_phenomenon'],
    objectRule: 'optional',
    objectKinds: ALL_OBJECT_KINDS,
    lateralityAllowed: true,
    safetyConflictRelation: null,
    corpusBasis: 'existing_contract_authority',
  }),
  entry({
    predicate: 'looks_at',
    proseProjection: 'looks at',
    objectRule: 'optional',
    objectKinds: ALL_OBJECT_KINDS,
    lateralityAllowed: false,
    safetyConflictRelation: null,
    corpusBasis: 'existing_contract_authority',
  }),
  entry({
    predicate: 'reaches_toward',
    proseProjection: 'reaches toward',
    objectRule: 'optional',
    objectKinds: ALL_OBJECT_KINDS,
    lateralityAllowed: true,
    safetyConflictRelation: null,
    corpusBasis: 'existing_contract_authority',
  }),
  entry({
    predicate: 'climbs_onto',
    proseProjection: 'climbs onto',
    objectRule: 'optional',
    objectKinds: ['spatial', 'anchor', 'prop'],
    lateralityAllowed: false,
    safetyConflictRelation: null,
    corpusBasis: 'existing_contract_authority',
  }),
  entry({
    predicate: 'sits_on',
    proseProjection: 'sits on',
    objectRule: 'optional',
    objectKinds: ['spatial', 'anchor', 'prop'],
    lateralityAllowed: false,
    safetyConflictRelation: 'must_not_sit_on',
    corpusBasis: 'existing_contract_authority',
  }),
  entry({
    predicate: 'sits',
    proseProjection: 'sits',
    subjectKinds: ['cast', 'cast_group'],
    objectRule: 'forbidden',
    objectKinds: [],
    spatialConstraintRule: 'optional',
    spatialConstraintRelations: ['beside'],
    lateralityAllowed: false,
    safetyConflictRelation: null,
    corpusBasis: 'reviewed_production_corpus',
  }),
  entry({
    predicate: 'stands_on',
    proseProjection: 'stands on',
    objectRule: 'optional',
    objectKinds: ['spatial', 'anchor', 'prop'],
    lateralityAllowed: false,
    safetyConflictRelation: 'must_not_stand_on',
    corpusBasis: 'existing_contract_authority',
  }),
  entry({
    predicate: 'points_at',
    proseProjection: 'points at',
    objectRule: 'optional',
    objectKinds: ALL_OBJECT_KINDS,
    lateralityAllowed: true,
    safetyConflictRelation: null,
    corpusBasis: 'existing_contract_authority',
  }),
  entry({
    predicate: 'approaches',
    proseProjection: 'approaches',
    objectRule: 'required',
    objectKinds: ALL_OBJECT_KINDS,
    lateralityAllowed: false,
    safetyConflictRelation: null,
    corpusBasis: 'reviewed_production_corpus',
  }),
  entry({
    predicate: 'walks',
    proseProjection: 'walks',
    objectRule: 'forbidden',
    objectKinds: [],
    lateralityAllowed: false,
    safetyConflictRelation: null,
    corpusBasis: 'reviewed_production_corpus',
  }),
  entry({
    predicate: 'peeks_at',
    proseProjection: 'peeks at',
    objectRule: 'required',
    objectKinds: ALL_OBJECT_KINDS,
    lateralityAllowed: false,
    safetyConflictRelation: null,
    corpusBasis: 'reviewed_production_corpus',
  }),
  entry({
    predicate: 'leans_toward',
    proseProjection: 'leans toward',
    objectRule: 'required',
    objectKinds: ALL_OBJECT_KINDS,
    lateralityAllowed: false,
    safetyConflictRelation: null,
    corpusBasis: 'reviewed_production_corpus',
  }),
  entry({
    predicate: 'listens_to',
    proseProjection: 'listens to',
    objectRule: 'required',
    objectKinds: ALL_OBJECT_KINDS,
    lateralityAllowed: false,
    safetyConflictRelation: null,
    corpusBasis: 'reviewed_production_corpus',
  }),
  entry({
    predicate: 'places',
    proseProjection: 'places',
    objectRule: 'required',
    objectKinds: ['prop'],
    lateralityAllowed: true,
    safetyConflictRelation: null,
    corpusBasis: 'reviewed_production_corpus',
  }),
  entry({
    predicate: 'turns',
    proseProjection: 'turns',
    objectRule: 'forbidden',
    objectKinds: [],
    lateralityAllowed: false,
    safetyConflictRelation: null,
    corpusBasis: 'reviewed_production_corpus',
  }),
  entry({
    predicate: 'turns_on',
    proseProjection: 'turns on',
    objectRule: 'required',
    objectKinds: ['prop', 'spatial', 'anchor'],
    lateralityAllowed: true,
    safetyConflictRelation: null,
    corpusBasis: 'reviewed_production_corpus',
  }),
  entry({
    predicate: 'opens',
    proseProjection: 'opens',
    objectRule: 'required',
    objectKinds: ['prop', 'spatial', 'anchor'],
    lateralityAllowed: true,
    safetyConflictRelation: null,
    corpusBasis: 'reviewed_production_corpus',
  }),
  entry({
    predicate: 'closes',
    proseProjection: 'closes',
    objectRule: 'required',
    objectKinds: ['prop', 'spatial', 'anchor'],
    lateralityAllowed: true,
    safetyConflictRelation: null,
    corpusBasis: 'reviewed_production_corpus',
  }),
  entry({
    predicate: 'writes',
    proseProjection: 'writes',
    objectRule: 'optional',
    objectKinds: ['prop', 'spatial', 'anchor'],
    lateralityAllowed: true,
    safetyConflictRelation: null,
    corpusBasis: 'reviewed_production_corpus',
  }),
  entry({
    predicate: 'draws',
    proseProjection: 'draws',
    objectRule: 'optional',
    objectKinds: ['prop', 'spatial', 'anchor'],
    lateralityAllowed: true,
    safetyConflictRelation: null,
    corpusBasis: 'reviewed_production_corpus',
  }),
  entry({
    predicate: 'counts',
    proseProjection: 'counts',
    objectRule: 'forbidden',
    objectKinds: [],
    lateralityAllowed: false,
    safetyConflictRelation: null,
    corpusBasis: 'reviewed_production_corpus',
  }),
  entry({
    predicate: 'pats',
    proseProjection: 'pats',
    objectRule: 'required',
    objectKinds: ['cast', 'prop'],
    lateralityAllowed: true,
    safetyConflictRelation: null,
    corpusBasis: 'reviewed_production_corpus',
  }),
  entry({
    predicate: 'pushes',
    proseProjection: 'pushes',
    objectRule: 'required',
    objectKinds: ALL_OBJECT_KINDS,
    lateralityAllowed: true,
    safetyConflictRelation: null,
    corpusBasis: 'reviewed_production_corpus',
  }),
  entry({
    predicate: 'kneels',
    proseProjection: 'kneels',
    objectRule: 'forbidden',
    objectKinds: [],
    lateralityAllowed: false,
    safetyConflictRelation: null,
    corpusBasis: 'reviewed_production_corpus',
  }),
  entry({
    predicate: 'waves',
    proseProjection: 'waves',
    objectRule: 'forbidden',
    objectKinds: [],
    lateralityAllowed: true,
    safetyConflictRelation: null,
    corpusBasis: 'reviewed_production_corpus',
  }),
  entry({
    predicate: 'hugs',
    proseProjection: 'hugs',
    objectRule: 'required',
    objectKinds: ['cast', 'prop'],
    lateralityAllowed: false,
    safetyConflictRelation: null,
    corpusBasis: 'reviewed_production_corpus',
  }),
  entry({
    predicate: 'bends_toward',
    proseProjection: 'bends toward',
    objectRule: 'required',
    objectKinds: ALL_OBJECT_KINDS,
    lateralityAllowed: false,
    safetyConflictRelation: null,
    corpusBasis: 'reviewed_production_corpus',
  }),
  entry({
    predicate: 'jumps',
    proseProjection: 'jumps',
    objectRule: 'forbidden',
    objectKinds: [],
    lateralityAllowed: false,
    safetyConflictRelation: null,
    corpusBasis: 'reviewed_production_corpus',
  }),
  entry({
    predicate: 'taps',
    proseProjection: 'taps',
    objectRule: 'required',
    objectKinds: ALL_OBJECT_KINDS,
    lateralityAllowed: true,
    safetyConflictRelation: null,
    corpusBasis: 'reviewed_production_corpus',
  }),
  entry({
    predicate: 'sneezes',
    proseProjection: 'sneezes',
    objectRule: 'forbidden',
    objectKinds: [],
    lateralityAllowed: false,
    safetyConflictRelation: null,
    corpusBasis: 'reviewed_production_corpus',
  }),
  entry({
    predicate: 'recoils',
    proseProjection: 'recoils',
    objectRule: 'forbidden',
    objectKinds: [],
    lateralityAllowed: false,
    safetyConflictRelation: null,
    corpusBasis: 'reviewed_production_corpus',
  }),
  entry({
    predicate: 'moves',
    proseProjection: 'moves',
    subjectKinds: ['cast', 'prop', 'source_phenomenon'],
    objectRule: 'required',
    objectKinds: ['cast', 'prop', 'spatial', 'anchor'],
    spatialEffectRule: 'required',
    lateralityAllowed: true,
    safetyConflictRelation: null,
    corpusBasis: 'reviewed_production_corpus',
  }),
] as const satisfies readonly ActionSemanticCatalogEntryShape[];

export type ActionPredicate =
  (typeof ACTION_SEMANTIC_CATALOG)[number]['predicate'];

export const ACTION_PREDICATE_VALUES = ACTION_SEMANTIC_CATALOG.map(
  ({ predicate }) => predicate,
) as ActionPredicate[];

const ACTION_SEMANTIC_CATALOG_INDEX = new Map<
  ActionPredicate,
  (typeof ACTION_SEMANTIC_CATALOG)[number]
>(
  ACTION_SEMANTIC_CATALOG.map((definition) => [
    definition.predicate,
    definition,
  ]),
);

export function isActionPredicate(
  value: unknown,
): value is ActionPredicate {
  return (
    typeof value === 'string' &&
    ACTION_SEMANTIC_CATALOG_INDEX.has(value as ActionPredicate)
  );
}

export function actionSemanticDefinition(
  predicate: ActionPredicate,
): (typeof ACTION_SEMANTIC_CATALOG)[number] {
  const definition = ACTION_SEMANTIC_CATALOG_INDEX.get(predicate);
  if (!definition) {
    throw new Error(
      `Action Semantic Catalog is missing predicate "${predicate}"`,
    );
  }
  return definition;
}
