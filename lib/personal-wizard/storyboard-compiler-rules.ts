/**
 * Opt-in compiler-rules contract: the planner's instructions state the structural rules the storyboard compiler already enforces but the base
 * instructions and authoring rules never said (audited 2026-10-14 against validatePreviewPlan, validatePreviewContinuity, validateBookSequence
 * and the moments checks). It adds NO schema field and NO compiler check, only the instruction, and like the other contracts it is bound into
 * the source and the compiled book only when enabled: without it every existing source, book, digest, instruction and packet stays
 * byte-identical. Every rule here is pinned by a contract test that breaks it on a real draft and sees the compiler refuse exactly that.
 */
export const COMPILER_RULES_CONTRACT_VERSION = 'storyboard-compiler-rules/v1' as const;

export const COMPILER_RULES_STORYBOARD_ADDENDUM = `STRUCTURAL RULES THE COMPILER CHECKS (active): an answer that breaks any of these is refused before review.
Text: visualLanguage, every design, every page's composition, childAction, childExpression, childGaze, companionAction and scene, and every prop state
are non-empty and at most 1800 characters.
Inventory: at most 8 recurringProps and 1 to 16 locations. Every prop, location and continuity entity ID uses only lowercase letters, digits and
underscores, starts with a letter, is at most 50 characters and is unique in its list.
Pages: every page's locationId is a declared location. A page's props may list ONLY declared recurringProps, each at most once: an object that is
not a recurring prop is described in the scene or composition instead, or is declared as a recurring prop (and as its continuity entity) first.
Continuity: every recurring prop is also a continuity entity with the SAME ID and kind "prop"; an entity's invariant attributes are unique. For
each page, visibleLocationIds includes that page's planned locationId and lists only declared locations, without repeats; visibleEntityIds lists
only declared continuity entities, without repeats, and includes EVERY prop listed on that page. The cover has no continuity changes, and a page
changes each entity attribute at most once.
Variety (books with at least 6 body pages): across the body pages use all three shots (wide, medium, close), at least three different angles and
at least five different child expressions (compared ignoring case and surrounding spaces).
Sequence: at most one transition per entity on a page; no transition returns an entity to unestablished; no relation targets an entity that is
still unestablished on that page.
Moments (when the answer has moments): a depicted relation names the child, the companion or a continuity entity, at most one per entity on a
frame, and at that instant no relation targets an entity that is unestablished; a depicted attribute is listed at most once per entity and
attribute; no two requirements on a frame share the same kind and subject (ignoring case).`;
