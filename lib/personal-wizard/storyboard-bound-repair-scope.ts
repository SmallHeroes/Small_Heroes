import 'server-only';
import { canonicalJson } from './request-acceptance';
import { STAGEABLE_PLAN_FIELDS } from './storyboard-claim-basis';

/**
 * The TYPED change scope of a bound repair (storyboard-bound-repair-target/v1). Each blocking issue ref of the held bound review resolves, against
 * the held parent draft, to one exact target (the entry or field the ref names) plus the entries of the SAME entity and state field that later
 * frames derive from it; nothing else may change:
 * - p{n}:transition:{entity}: that entity's transitions on frame n; on frames n.. its depicted relations and concurrent relation changes, on later
 *   frames its own transitions, and for the child or companion that actor's action field (and its staging entry) on those frames;
 * - p{n}:change:{entity}:{attribute}: that ledger change on frame n; on frames n.. the same change later, its depicted attribute, concurrent
 *   attribute change and the entity's page-prop state;
 * - p{n}:requirement|instant|relation|attribute|actor|presence|scene|concurrent: only that claim on frame n (the drawn instant: that frame's
 *   instant, staging, concurrency and plan direction); p{n}, p{n}:composition or a plan field: only those fields of frame n;
 * - p{n}:scene_relations: that frame's local part graph, workpiece orientation and the shot/action fields that must agree with them;
 * - location:{id}: that location's own fields; under the instance-distinction contract (the held location declares a population) its
 *   population, with its design changeable only together with it (the structural fallback for the generic ref: no reviewer prose is read);
 *   entity|prop:{id}: that object's own definition and its page-prop entries; cast:companion: the companion's appearance entry.
 * The book ref, the child (pinned) and an unresolvable ref refuse BEFORE the planner is called. The compiler then requires, on the held parent and
 * the candidate in the same canonical (compiled) form: every field outside the targets byte-identical (the planner's own selfCheck excepted,
 * which the compiler validates separately); every target actually changed (corrected or withdrawn); never a new entry (no new event) or a new
 * id; and no kept claim of a target re-cites the held quote or a part of it, whitespace-normalized, whatever it now asserts (a quote that exists
 * in the manuscript does not prove an unstated transition; the fresh full review judges a different span).
 */
export const BOUND_REPAIR_TARGET_VERSION = 'storyboard-bound-repair-target/v1' as const;
type Key = string | number;
type Match = Record<string, string | null>;
/** entries: the matching array entries (correct or withdraw, never add); field: one value; entry: the matching entries' fields other than their keys. */
export type BoundRepairMask = { kind: 'entries' | 'field' | 'entry'; path: Key[]; match?: Match; fields?: string[]; primary?: true };
export type BoundRepairTarget = { ref: string; kind: string; masks: BoundRepairMask[] };
export type BoundRepairScope = { version: typeof BOUND_REPAIR_TARGET_VERSION; targets: BoundRepairTarget[] };

const MASKED = '\u0000bound-repair-target';
const fail = (code: string): never => { throw Error(`personal_storyboard_${code}`); };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const matches = (v: unknown, m: Match) => object(v) && Object.entries(m).every(([k, x]) => (v[k] ?? null) === x);
const at = (root: unknown, path: readonly Key[]) => path.reduce<unknown>((v, k) => v !== null && typeof v === 'object' ? (v as Record<Key, unknown>)[k] : undefined, root);
const DIRECTION = ['shot', 'angle', 'composition', 'childAction', 'childExpression', 'childGaze', 'companionAction', 'scene'];
const actorField = (entity: string) => entity === 'companion' ? 'companionAction' : entity === 'child' ? 'childAction' : null;

/** The planner's view of one target: its ref, kind and the exact draft paths it may change. */
export const boundRepairChangeScope = (scope: BoundRepairScope) => scope.targets.map(t => ({ ref: t.ref, kind: t.kind,
  may: t.masks.map(m => m.path.map((k, i) => typeof k === 'number' ? `[${k}]` : (i ? '.' : '') + k).join('') +
    (m.match ? `[${Object.entries(m.match).map(([k, v]) => `${k}=${v}`).join(',')}]` : '') + (m.kind === 'entry' ? (m.fields ? `.{${m.fields.join(',')}}` : '.*') : '')) }));

/** Resolves each blocking issue ref against the held parent draft; refuses (before any planner call) what is generic, the pinned child or unresolvable. */
export function boundRepairScope(blocking: readonly { reason?: string; issues: readonly { ref: string }[] }[], parentDraft: unknown): BoundRepairScope {
  const d = parentDraft as any, frames: number = Array.isArray(d?.plan?.pages) ? d.plan.pages.length : fail('repair_unbound_finding');
  const later = (from: number) => Array.from({ length: frames - from }, (_, i) => from + i);
  const entries = (path: Key[], match: Match, primary?: true): BoundRepairMask => ({ kind: 'entries', path, match, ...(primary ? { primary } : {}) });
  const field = (path: Key[], primary?: true): BoundRepairMask => ({ kind: 'field', path, ...(primary ? { primary } : {}) });
  const resolve = (raw: string): BoundRepairTarget => {
    const ref = raw.replace(/#\d+$/, ''), page = /^p(\d+)(?::(.+))?$/.exec(ref);
    let m: RegExpExecArray | null;
    if (ref === 'cast:companion') return { ref, kind: 'companion', masks: [field(['plan', 'actorAppearance', 'companion'], true)] };
    if ((m = /^location:([A-Za-z0-9_.-]+)$/.exec(ref))) {
      const id = m[1], held = Array.isArray(d.plan.locations) ? d.plan.locations.find((l: any) => l?.id === id) : undefined;
      // Under the instance-distinction contract a location's one typed declaration is its population (the review judges it against the design
      // and the manuscript): the generic ref targets that field, and the design may change only together with it, never in its place.
      if (Array.isArray(held?.population)) return { ref, kind: 'location', masks: [
        { kind: 'entry', path: ['plan', 'locations'], match: { id }, fields: ['population'], primary: true },
        { kind: 'entry', path: ['plan', 'locations'], match: { id }, fields: ['design'] }] };
      return { ref, kind: 'location', masks: [{ kind: 'entry', path: ['plan', 'locations'], match: { id }, primary: true }] };
    }
    if ((m = /^(?:entity|prop):([A-Za-z0-9_.-]+)$/.exec(ref))) return { ref, kind: 'entity', masks: [
      { kind: 'entry', path: ['plan', 'continuity', 'entities'], match: { id: m[1] }, primary: true },
      { kind: 'entry', path: ['plan', 'recurringProps'], match: { id: m[1] }, primary: true },
      ...later(0).map(n => ({ kind: 'entry' as const, path: ['plan', 'pages', n, 'props'], match: { id: m![1] }, fields: ['state'] }))] };
    if (!page || Number(page[1]) >= frames) return fail('repair_unbound_finding');
    const n = Number(page[1]), rest = page[2] ?? '', plan = (fields: string[]) => fields.map(f => field(['plan', 'pages', n, f], true));
    if (!rest) return { ref, kind: 'frame', masks: plan(DIRECTION) };
    if (rest === 'composition') return { ref, kind: 'frame_field', masks: plan(['composition', 'shot', 'angle']) };
    if (rest === 'scene_relations' && Array.isArray(d.sceneRelations?.frames) && d.sceneRelations.frames[n]) return { ref, kind: 'scene_relations', masks: [
      field(['sceneRelations', 'frames', n], true), ...plan(['shot', 'angle', 'composition', 'childAction', 'childGaze', 'companionAction', 'scene']),
    ] };
    if ((STAGEABLE_PLAN_FIELDS as readonly string[]).includes(rest)) return { ref, kind: 'frame_field', masks: plan([rest]) };
    const moment = ['moments', 'frames', n], depicted = [...moment, 'depicted'];
    if ((m = /^transition:([A-Za-z0-9_.-]+)$/.exec(rest)) && n >= 1) {
      const entity = m[1], actor = actorField(entity);
      return { ref, kind: 'transition', masks: [entries(['sequence', 'pages', n - 1, 'transitions'], { entityId: entity }, true),
        ...later(n).flatMap(k => [
          ...(k > n ? [entries(['sequence', 'pages', k - 1, 'transitions'], { entityId: entity })] : []),
          entries(['moments', 'frames', k, 'depicted', 'relations'], { entityId: entity }),
          entries(['concurrency', 'frames', k, 'changes'], { kind: 'relation', entityId: entity, attribute: null }),
          ...(actor ? [field(['plan', 'pages', k, actor]), entries(['moments', 'frames', k, 'staging'], { ref: `p${k}:${actor}` }),
            entries(['moments', 'frames', k, 'staging'], { ref: `p${k}:plan.${actor}` })] : [])])] };
    }
    if ((m = /^change:([A-Za-z0-9_.-]+):(.+)$/.exec(rest))) {
      const [entity, attribute] = [m[1], m[2]];
      return { ref, kind: 'change', masks: [entries(['plan', 'continuity', 'pages', n, 'changes'], { entityId: entity, attribute }, true),
        ...later(n).flatMap(k => [
          ...(k > n ? [entries(['plan', 'continuity', 'pages', k, 'changes'], { entityId: entity, attribute })] : []),
          entries(['moments', 'frames', k, 'depicted', 'attributes'], { entityId: entity, attribute }),
          entries(['concurrency', 'frames', k, 'changes'], { kind: 'attribute', entityId: entity, attribute }),
          { kind: 'entry' as const, path: ['plan', 'pages', k, 'props'], match: { id: entity }, fields: ['state'] }])] };
    }
    if ((m = /^requirement:(\d+)$/.exec(rest))) return { ref, kind: 'requirement', masks: [field([...moment, 'requirements', Number(m[1])], true)] };
    if (rest === 'instant') return { ref, kind: 'instant', masks: [field(depicted, true), field([...moment, 'staging']), field(['concurrency', 'frames', n, 'changes']),
      ...DIRECTION.map(f => field(['plan', 'pages', n, f]))] };
    if ((m = /^relation:([A-Za-z0-9_.-]+)$/.exec(rest))) return { ref, kind: 'relation', masks: [entries([...depicted, 'relations'], { entityId: m[1] }, true)] };
    if ((m = /^attribute:([A-Za-z0-9_.-]+):(.+)$/.exec(rest))) return { ref, kind: 'attribute', masks: [entries([...depicted, 'attributes'], { entityId: m[1], attribute: m[2] }, true)] };
    if ((m = /^actor:([A-Za-z0-9_.-]+)$/.exec(rest))) return { ref, kind: 'actor', masks: [entries([...depicted, 'actorStates'], { actorId: m[1] }, true)] };
    if ((m = /^presence:([A-Za-z0-9_.-]+)$/.exec(rest))) return { ref, kind: 'presence', masks: [entries([...depicted, 'presence'], { actorId: m[1] }, true)] };
    if (rest === 'scene' && n >= 1) return { ref, kind: 'scene', masks: [field(['sequence', 'pages', n - 1, 'sceneChangeEvidence'], true),
      ...later(n).map(k => field(['sequence', 'pages', k - 1, 'sceneId']))] };
    if ((m = /^concurrent:(relation|attribute):([A-Za-z0-9_.-]+)(?::(.+))?$/.exec(rest)) && (m[1] === 'relation') === (m[3] === undefined))
      return { ref, kind: 'concurrent', masks: [entries(['concurrency', 'frames', n, 'changes'], { kind: m[1], entityId: m[2], attribute: m[3] ?? null }, true)] };
    return fail('repair_unbound_finding');
  };
  const targets = new Map<string, BoundRepairTarget>();
  for (const finding of blocking) {
    if (finding.reason !== undefined && finding.reason !== 'blocking_impact' || !finding.issues.length) fail('repair_unbound_finding');
    for (const issue of finding.issues) {
      // The book ref names no part of the draft, and the child is pinned: neither can be repaired here.
      if (issue.ref === 'book' || issue.ref === 'cast:child') fail('repair_unbound_finding');
      const target = resolve(issue.ref);
      // The ref must name something that exists in the held draft (an unknown entity, location or claim is not a target).
      if (!target.masks.filter(x => x.primary).some(x => present(d, x))) fail('repair_unbound_finding');
      targets.set(target.ref, target);
    }
  }
  if (!targets.size) fail('repair_unbound_finding');
  return { version: BOUND_REPAIR_TARGET_VERSION, targets: [...targets.values()].sort((a, b) => a.ref < b.ref ? -1 : 1) };
}

function selected(draft: unknown, mask: BoundRepairMask): unknown[] {
  const v = at(draft, mask.path);
  if (mask.kind === 'field') return v === undefined ? [] : [v];
  return Array.isArray(v) ? v.filter(e => matches(e, mask.match!)) : [];
}
const present = (draft: unknown, mask: BoundRepairMask) => selected(draft, mask).length > 0;
/** The draft with every target masked out (and the planner's own selfCheck removed): what must stay byte-identical. */
function projection(draft: unknown, scope: BoundRepairScope) {
  const d = structuredClone(draft) as Record<string, unknown>;
  delete d.selfCheck;
  for (const mask of scope.targets.flatMap(t => t.masks)) {
    const container = at(d, mask.path.slice(0, -1)), last = mask.path[mask.path.length - 1], v = at(d, mask.path);
    if (mask.kind === 'field') { if (container !== null && typeof container === 'object' && last in (container as object)) (container as Record<Key, unknown>)[last] = MASKED; continue; }
    if (!Array.isArray(v)) continue;
    const keep = (e: unknown) => !matches(e, mask.match!);
    if (mask.kind === 'entries') { (container as Record<Key, unknown>)[last] = v.filter(keep); continue; }
    (container as Record<Key, unknown>)[last] = v.map(e => keep(e) ? e : Object.fromEntries(Object.entries(e as Record<string, unknown>)
      .map(([k, x]) => [k, k in mask.match! || mask.fields && !mask.fields.includes(k) ? x : MASKED])));
  }
  return canonicalJson(d);
}
/** Every id the held draft already knows (a repair may cite only these). */
function knownIds(draft: unknown) {
  const ids = new Set<string>(['child', 'companion']);
  const walk = (v: unknown) => { if (Array.isArray(v)) v.forEach(walk); else if (object(v)) for (const [k, x] of Object.entries(v)) {
    if (typeof x === 'string' && /^(id|entityId|targetId|actorId|locationId)$/.test(k)) ids.add(x); else walk(x); } };
  walk(draft); return ids;
}
const evidenceOf = (v: unknown) => object(v) ? (typeof v.evidence === 'string' ? v.evidence : typeof v.storyEvidence === 'string' ? v.storyEvidence : null) : null;
/** A quote as a span: whitespace runs are one space, so a re-spaced or re-broken held quote is the same span. */
const span = (v: unknown) => evidenceOf(v)?.replace(/\s+/g, ' ').trim() || null;
/** What a primary mask compares: its entries (or value), restricted to the mask's own fields; a population is the set of its kind keys. */
const targetValue = (draft: unknown, mask: BoundRepairMask) => selected(draft, mask).map(e => !mask.fields || !object(e) ? e
  : Object.fromEntries(mask.fields.map(k => [k, k === 'population' && Array.isArray(e[k])
    ? (e[k] as unknown[]).map(x => typeof x === 'string' ? x.trim().toLowerCase() : x).sort() : e[k] ?? null])));

/**
 * The compiler's gate, on the held parent and the candidate in the same canonical (compiled) form: only the typed targets changed, each one
 * really, without a new entry or id, and no kept claim cites the held quote or a part of it, whatever it now asserts (another destination,
 * relation or value does not make a rejected quote evidence; a different span goes to the fresh full review).
 */
export function assertBoundRepairScope(scope: BoundRepairScope, parentDraft: unknown, candidateDraft: unknown) {
  if (projection(parentDraft, scope) !== projection(candidateDraft, scope)) fail('bound_repair_scope');
  const ids = knownIds(parentDraft);
  for (const target of scope.targets) {
    const primary = target.masks.filter(x => x.primary);
    if (canonicalJson(primary.map(x => targetValue(parentDraft, x))) === canonicalJson(primary.map(x => targetValue(candidateDraft, x)))) fail('bound_repair_target_unchanged');
    const held = primary.flatMap(x => selected(parentDraft, x)).map(span).filter((s): s is string => !!s);
    for (const mask of target.masks) {
      const before = selected(parentDraft, mask), after = selected(candidateDraft, mask);
      if (mask.kind === 'entries' && after.length > before.length) fail('bound_repair_new_event');
      if (mask.kind === 'entry' && after.length !== before.length) fail('bound_repair_scope');
      const cited: string[] = [];
      const walk = (v: unknown) => { if (Array.isArray(v)) v.forEach(walk); else if (object(v)) for (const [k, x] of Object.entries(v)) {
        if (typeof x === 'string' && /^(entityId|targetId|actorId|locationId)$/.test(k)) cited.push(x); else walk(x); } };
      after.forEach(walk);
      if (cited.some(id => !ids.has(id))) fail('bound_repair_new_id');
      if (!mask.primary) continue;
      // A kept claim must cite more than the held quote (re-citing it or a part of it repairs nothing, whatever the claim now asserts).
      for (const entry of after) {
        const quote = span(entry);
        if (quote && held.some(h => h.includes(quote))) fail('bound_repair_unproven_claim');
      }
    }
  }
}
