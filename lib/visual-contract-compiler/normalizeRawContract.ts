/**
 * Normalize a raw (LLM-produced) BookVisualContract into the canonical shape BEFORE validation.
 *
 * LLMs reliably emit the right CONTENT but vary the SHAPE: wardrobe as a bare string instead of
 * `{description}`, recurringProps without an explicit `id`, propState referencing a prop by name.
 * This deterministic coercion absorbs those variations (general across all stories — no per-story
 * tuning) so a well-intentioned contract isn't fail-closed on a formatting quirk; genuinely missing
 * content still fails validation.
 */

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** ASCII slug; falls back to a positional id when the source is non-latin (e.g. Hebrew). */
function slug(value: unknown, fallback: string): string {
  const s = String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return s || fallback;
}

function coerceWardrobe(member: unknown): unknown {
  if (!isObj(member)) return member;
  const m = { ...member };
  const w = m.wardrobe;
  if (typeof w === 'string') {
    m.wardrobe = { description: w };
  } else if (isObj(w) && typeof w.description !== 'string') {
    const d = w.outfit ?? w.text ?? w.summary ?? w.value;
    if (typeof d === 'string') m.wardrobe = { ...w, description: d };
  } else if (w == null) {
    const d = m.wardrobeDescription ?? m.outfit ?? m.wardrobe_text;
    if (typeof d === 'string') m.wardrobe = { description: d };
  }
  return m;
}

export function normalizeRawBookVisualContract(raw: unknown): unknown {
  if (!isObj(raw)) return raw;
  const c: Record<string, unknown> = { ...raw };

  if (c.version == null) c.version = 1;

  // cast.child / cast.companion wardrobe → { description }
  if (isObj(c.cast)) {
    const cast = { ...c.cast };
    if ('child' in cast) cast.child = coerceWardrobe(cast.child);
    if (cast.companion != null) cast.companion = coerceWardrobe(cast.companion);
    c.cast = cast;
  }

  // recurringProps: ensure each has an id; build a name/id → canonical-id map for propState remap.
  const propIdByKey = new Map<string, string>();
  if (Array.isArray(c.recurringProps)) {
    c.recurringProps = c.recurringProps.map((p, i) => {
      if (!isObj(p)) return p;
      const id =
        typeof p.id === 'string' && p.id.trim() ? p.id.trim() : slug(p.name ?? p.description, `prop_${i + 1}`);
      if (typeof p.name === 'string') propIdByKey.set(slug(p.name, ''), id);
      if (typeof p.id === 'string') propIdByKey.set(slug(p.id, ''), id);
      propIdByKey.set(slug(id, ''), id);
      return { ...p, id };
    });
  }

  // page propState: remap a propId given by name/slug onto the canonical recurringProp id.
  if (Array.isArray(c.pageContracts)) {
    c.pageContracts = c.pageContracts.map((pg) => {
      if (!isObj(pg) || !Array.isArray(pg.propState)) return pg;
      const propState = pg.propState.map((s) => {
        if (!isObj(s) || typeof s.propId !== 'string') return s;
        const mapped = propIdByKey.get(slug(s.propId, ''));
        return mapped ? { ...s, propId: mapped } : s;
      });
      return { ...pg, propState };
    });
  }

  // forbiddenGlobalElements: tolerate a single string or comma list.
  if (typeof c.forbiddenGlobalElements === 'string') {
    c.forbiddenGlobalElements = (c.forbiddenGlobalElements as string)
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  }

  return c;
}
