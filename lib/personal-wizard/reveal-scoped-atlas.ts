import 'server-only';
import sharp from 'sharp';
import { z } from 'zod';
import { previewSha } from '../local-story-preview';
import { canonicalJson } from './request-acceptance';
import { OFFLINE_CONTENT_METHOD } from './scene-preservation';

/**
 * reveal-scoped-atlas/v1: a frame-scoped reference built from crops of an APPROVED atlas, by a validated manifest bound to that atlas's exact
 * bytes. Detection may only propose rectangles; a manifest's ID-to-rectangle mapping and each tile's contents must carry their own
 * qualification (in this milestone the offline fixture method only). Order or count never stands in for identity. Fail closed: no qualified
 * manifest, a missing/duplicate/overlapping tile, or any content not allowed in the frame refuses before render.
 */
export const REVEAL_SCOPED_ATLAS_VERSION = 'reveal-scoped-atlas/v1' as const;
const fail = (code: string): never => { throw Object.assign(new Error(code), { code }); };
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const id = z.string().regex(/^[a-z][a-z0-9_]{0,59}$/);
const px = z.number().int().nonnegative();
export const atlasManifestSchema = z.object({ version: z.literal(REVEAL_SCOPED_ATLAS_VERSION), role: z.enum(['entities', 'locations']), atlasSha: hash,
  width: px.positive(), height: px.positive(),
  tiles: z.array(z.object({ id, rect: z.object({ left: px, top: px, width: px.positive(), height: px.positive() }).strict(),
    contents: z.array(id).min(1).max(30) }).strict()).min(1).max(40),
  qualification: z.object({ method: z.literal(OFFLINE_CONTENT_METHOD), evidenceSha: hash }).strict() }).strict();
export type AtlasManifest = z.infer<typeof atlasManifestSchema>;
/** The qualification digest binds the atlas bytes' hash, its size, and every tile's ID, rectangle and contents together. */
export const atlasManifestEvidenceSha = (m: Pick<AtlasManifest, 'role' | 'atlasSha' | 'width' | 'height' | 'tiles'> & { method: string }) =>
  previewSha(canonicalJson({ role: m.role, atlasSha: m.atlasSha, width: m.width, height: m.height, method: m.method,
    tiles: [...m.tiles].map(t => ({ id: t.id, rect: t.rect, contents: [...t.contents].sort() })).sort((a, b) => a.id.localeCompare(b.id)) }));

/** Validate a manifest against the actual atlas bytes before any crop. */
export async function validatedAtlasManifest(atlas: Buffer, manifest: unknown, role: 'entities' | 'locations') {
  const parsed = atlasManifestSchema.safeParse(manifest);
  if (!parsed.success) return fail('scene_atlas_unqualified');
  const m = parsed.data;
  if (m.role !== role || previewSha(atlas) !== m.atlasSha || m.qualification.evidenceSha !== atlasManifestEvidenceSha({ ...m, method: m.qualification.method }))
    fail('scene_atlas_unqualified');
  const meta = await sharp(atlas).metadata();
  if (meta.width !== m.width || meta.height !== m.height) fail('scene_atlas_unqualified');
  if (new Set(m.tiles.map(t => t.id)).size !== m.tiles.length) fail('scene_atlas_unqualified');
  for (const t of m.tiles) {
    if (!t.contents.includes(t.id) || new Set(t.contents).size !== t.contents.length ||
      t.rect.left + t.rect.width > m.width || t.rect.top + t.rect.height > m.height) fail('scene_atlas_unqualified');
  }
  // Disjoint tiles: a crop can never carry a neighbour's pixels.
  for (const [i, a] of m.tiles.entries()) for (const b of m.tiles.slice(i + 1)) {
    const r = a.rect, s = b.rect;
    if (r.left < s.left + s.width && s.left < r.left + r.width && r.top < s.top + s.height && s.top < r.top + r.height) fail('scene_atlas_unqualified');
  }
  return m;
}

/**
 * The frame's composite of the wanted tiles (one row, fixed gap, neutral backing), or null when no wanted tile exists. Every selected tile's
 * qualified contents must be allowed in the frame; `required` IDs without a tile refuse (a location's design is mandatory).
 */
export async function scopedAtlasComposite(atlas: Buffer, manifest: unknown, role: 'entities' | 'locations', wanted: readonly string[],
  allowed: ReadonlySet<string>, required: readonly string[] = []) {
  const m = await validatedAtlasManifest(atlas, manifest, role);
  const selected = m.tiles.filter(t => wanted.includes(t.id));
  if (required.some(r => !selected.some(t => t.id === r))) fail('scene_atlas_missing_tile');
  for (const t of selected) if (t.contents.some(x => !allowed.has(x))) fail('scene_reference_forbidden_content');
  if (!selected.length) return null;
  const gap = 16, width = selected.reduce((s, t) => s + t.rect.width, 0) + gap * (selected.length + 1), height = Math.max(...selected.map(t => t.rect.height)) + gap * 2;
  const crops = await Promise.all(selected.map(t => sharp(atlas).extract(t.rect).png().toBuffer()));
  let left = gap;
  const layers = selected.map((t, i) => { const layer = { input: crops[i], left, top: gap }; left += t.rect.width + gap; return layer; });
  const bytes = await sharp({ create: { width, height, channels: 3, background: { r: 242, g: 238, b: 230 } } }).composite(layers).png().toBuffer();
  return { bytes, sha: previewSha(bytes), contents: [...new Set(selected.flatMap(t => t.contents))].sort(),
    recipe: { version: REVEAL_SCOPED_ATLAS_VERSION, role, atlasSha: m.atlasSha, manifestSha: previewSha(canonicalJson(m)),
      tiles: selected.map(t => ({ id: t.id, rect: t.rect })), layout: 'row-gap16/v1' } };
}
