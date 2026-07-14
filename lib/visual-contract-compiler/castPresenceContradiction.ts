/**
 * Cross-field fail-closed check (companion + recurring humans): a page whose `mustShow` POSITIVELY references a
 * cast member the page declares ABSENT (its id is NOT in `castIds`) is a semantic contradiction that survives every
 * structural validator and would reach the image prompt — the fox_uri "MUST SHOW: Uri…" while `castIds:[child]`
 * bug. This module finds those; the vNext validator turns them into fail-closed errors (template + resolved).
 *
 * Matching REUSES the extractor's PRESENT-mention logic (hasPresentHebrewMention / hasCleanEnglishMention), so a
 * possessive or genitive reference — English "the doctor's closed door", Hebrew construct "דלת הרופא" — does NOT
 * count; only a positive, standalone reference does. This is what keeps a legit template (e.g. bunny p1, companion
 * absent + "the doctor's closed door" scenery) from being wrongly rejected. Only `mustShow` (a positive field) is
 * checked — `mustNotShow` / camera are NOT (negative references like "no companion yet" are legitimate).
 *
 * COMPANION vs HUMAN: the companion is strict (its per-page presence is text-accurate after alias-aware detection);
 * a recurring human gets a continuity allowance (its presence is continuity-DEFERRED) — see
 * mustShowAbsenceContradictions.
 */
import { companionNameTokens } from '../companion-presence-aliases';
import { hasPresentHebrewMention, hasCleanEnglishMention, stripNiqqud } from './extractDeterministicFacts';

const HEBREW_CHAR = /[֐-׿]/;
const isStr = (v: unknown): v is string => typeof v === 'string';

export interface CastRefTarget {
  id: string;
  role: string;
  /** Niqqud-stripped Hebrew alias forms — matched against `mustShow` as PRESENT (actor/object) mentions. */
  hebrewAliases: string[];
  /** English alias forms — matched against `mustShow` excluding the possessive ("Uri's …"). */
  englishAliases: string[];
}

interface ContradictionContractShape {
  cast?: { companion?: { id?: unknown; name?: unknown } | null } | null;
  humanCast?: ReadonlyArray<{ id?: unknown; role?: unknown; aliases?: unknown }> | null;
  pageContracts?: ReadonlyArray<{ pageNumber?: unknown; mustShow?: unknown; castIds?: unknown }> | null;
}

function splitAliases(aliases: string[]): { hebrewAliases: string[]; englishAliases: string[] } {
  const hebrewAliases = new Set<string>();
  const englishAliases = new Set<string>();
  for (const a of aliases) {
    if (!a) continue;
    if (HEBREW_CHAR.test(a)) hebrewAliases.add(stripNiqqud(a));
    else englishAliases.add(a);
  }
  return { hebrewAliases: [...hebrewAliases], englishAliases: [...englishAliases] };
}

/**
 * Build the cast-reference targets (companion + recurring humans) from a contract-shaped object. The companion's
 * aliases come from `companionNameTokens` (identity/short names — buni/uri/dini — with species common-nouns like
 * bunny/rabbit/fox REMOVED, so a simile/scenery reference can't hard-block); a human's come from its stored
 * `aliases`.
 */
export function castRefTargets(contract: ContradictionContractShape): CastRefTarget[] {
  const targets: CastRefTarget[] = [];
  const companion = contract.cast?.companion;
  if (companion && isStr(companion.id) && isStr(companion.name)) {
    const registryId = companion.id.replace(/^companion:/, '');
    // NAME-only tokens (not species common-nouns): the fail-closed reject must fire only on an UNAMBIGUOUS identity
    // reference ("MUST SHOW: Buni"), never on a species simile/scenery ("bunny stickers", "like a frightened rabbit").
    targets.push({ id: companion.id, role: 'companion', ...splitAliases(companionNameTokens(companion.name, registryId)) });
  }
  for (const m of contract.humanCast ?? []) {
    if (!m || !isStr(m.id)) continue;
    const aliases = Array.isArray(m.aliases) ? m.aliases.filter(isStr) : [];
    targets.push({ id: m.id, role: isStr(m.role) ? m.role : 'human', ...splitAliases(aliases) });
  }
  return targets;
}

/** True if `mustShow` POSITIVELY references `t` (present-intent — not possessive/genitive/negative). */
export function mustShowPositivelyReferences(mustShow: string[], t: CastRefTarget): boolean {
  const text = mustShow.join('\n');
  if (!text) return false;
  return (
    (t.hebrewAliases.length > 0 && hasPresentHebrewMention(text, t.hebrewAliases)) ||
    (t.englishAliases.length > 0 && hasCleanEnglishMention(text, t.englishAliases))
  );
}

/**
 * Every (page, absent cast member) cross-field contradiction in a contract-shaped object. Empty when clean.
 *
 * The COMPANION is treated STRICTLY: after alias-aware detection its per-page presence is text-accurate, so any
 * mustShow reference on a page where it is ABSENT is a genuine contradiction. A recurring HUMAN is treated with a
 * continuity allowance: human presence is continuity-DEFERRED (a parent who stays through a scene but is not named
 * on every page is intentionally not force-added to castIds), so a mustShow reference on a page WITHIN the human's
 * presence span (between the first and last page they ARE present) is legitimate continuity — surfaced by the review
 * flag, not hard-blocked. A reference OUTSIDE the span (before they first appear, after they leave, or when they
 * are never present at all) is a real contradiction and IS rejected.
 */
export function mustShowAbsenceContradictions(
  contract: ContradictionContractShape,
): Array<{ page: number; id: string; role: string }> {
  const targets = castRefTargets(contract);
  if (targets.length === 0) return [];
  const pages = (contract.pageContracts ?? []).filter((pc): pc is { pageNumber: number; mustShow?: unknown; castIds?: unknown } => !!pc && typeof pc.pageNumber === 'number');

  // Presence span per target: the pages where its id IS in castIds (min..max defines the continuity span).
  const presentPagesById = new Map<string, number[]>();
  for (const pc of pages) {
    const ids = new Set((Array.isArray(pc.castIds) ? pc.castIds : []).filter(isStr));
    for (const t of targets) if (ids.has(t.id)) presentPagesById.set(t.id, [...(presentPagesById.get(t.id) ?? []), pc.pageNumber]);
  }

  const out: Array<{ page: number; id: string; role: string }> = [];
  for (const pc of pages) {
    const mustShow = Array.isArray(pc.mustShow) ? pc.mustShow.filter(isStr) : [];
    if (mustShow.length === 0) continue;
    const castIds = new Set((Array.isArray(pc.castIds) ? pc.castIds : []).filter(isStr));
    for (const t of targets) {
      if (castIds.has(t.id)) continue; // present per castIds → not this check
      if (!mustShowPositivelyReferences(mustShow, t)) continue;
      if (t.role === 'companion') {
        out.push({ page: pc.pageNumber, id: t.id, role: t.role }); // strict — companion presence is text-accurate
        continue;
      }
      // Human: fail-closed only OUTSIDE the presence span (a within-span reference is legitimate continuity).
      const present = presentPagesById.get(t.id) ?? [];
      const withinSpan = present.length > 0 && pc.pageNumber >= Math.min(...present) && pc.pageNumber <= Math.max(...present);
      if (!withinSpan) out.push({ page: pc.pageNumber, id: t.id, role: t.role });
    }
  }
  return out;
}
