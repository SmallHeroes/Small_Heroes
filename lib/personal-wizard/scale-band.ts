/**
 * Deterministic size band for the scale-reference probe (Decision Gate 2026-10-17 v2, M1): labelled geometric height marks drawn by code
 * under the legacy entities atlas. Numbers in, pixels out: no model, no segmentation, no per-book cutout, no word parser. The ratios are
 * DECLARED inputs (the probe configuration), so a correct raster proves only that the drawn geometry matches those inputs, never that a
 * ratio is canonical or that a renderer associates a mark with its character. Opt-in: imported only by the scale probe.
 */
import sharp from 'sharp';
import { z } from 'zod';

export const SCALE_BAND_VERSION = 'scale-band/v1' as const;
/**
 * One fixed band, 1024 x 320: one shared baseline (bars end on row 295, the ground line is rows 296-297), a 40 px label margin above the
 * tallest mark, 48 px bars, an 8 px readable floor. Bars are drawn last, so neither a label nor the ground line ever covers a bar pixel.
 */
export const SCALE_BAND = Object.freeze({ width: 1024, height: 320, baselineY: 296, labelMargin: 40, barWidth: 48, minGap: 16, floorPx: 8,
  labelSize: 18, labelGap: 8, labelClearance: 2,
  colours: Object.freeze({ background: '#F4EEE2', bar: '#5B4A36', ground: '#B9AC98', label: '#1E1E1E' }) });
/** The probe's image 3: the 1024 x 1024 atlas, pixel for pixel, above the band area (marks in M1, blank background in the baseline). */
export const ENTITIES_CANVAS = Object.freeze({ width: 1024, atlasHeight: 1024, height: 1024 + SCALE_BAND.height });
/** The first mark: the unit post, one child height. */
export const SCALE_BAND_POST = 'post' as const;

export class ScaleBandError extends Error { constructor(readonly code: string) { super(code); } }
const fail = (code: string): never => { throw new ScaleBandError(code); };

const markSchema = z.object({ id: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  /** Printable ASCII, no surrounding space; drawn above the bar and clipped to its own slot (never counted as height). */
  label: z.string().regex(/^[!-~](?:[ -~]{0,58}[!-~])?$/),
  ratio: z.number().finite().positive().max(1000) }).strict();
export const scaleBandInputSchema = z.object({ version: z.literal('scale-band-input/v1'), marks: z.array(markSchema).min(2).max(24) }).strict();
export type ScaleBandInput = z.infer<typeof scaleBandInputSchema>;
export type ScaleBandMark = { id: string; label: string; ratio: number; heightPx: number; x: number; topY: number; slotLeft: number; slotRight: number };
export type ScaleBandGeometry = { version: typeof SCALE_BAND_VERSION; width: number; height: number; baselineY: number; labelMargin: number;
  barWidth: number; floorPx: number; unitPx: number; marks: ScaleBandMark[] };

/**
 * The band's numbers, or a refusal. The post comes first at exactly 1; ids are unique. One unit for every mark: floor((baseline - label
 * margin) / largest ratio), so the tallest mark fits under the margin by construction and every height is round(ratio x unit). A mark
 * below the readable floor refuses (never enlarged on its own, which would falsify its ratio); so do too many marks for the width.
 */
export function scaleBandGeometry(input: unknown): ScaleBandGeometry {
  const parsed = scaleBandInputSchema.safeParse(input);
  if (!parsed.success) return fail('scale_band_input');
  const marks = parsed.data.marks, b = SCALE_BAND;
  if (marks[0].id !== SCALE_BAND_POST || marks[0].ratio !== 1) fail('scale_band_post');
  if (new Set(marks.map(m => m.id)).size !== marks.length) fail('scale_band_duplicate');
  const edge = (i: number) => Math.floor(i * b.width / marks.length);
  if (marks.some((_, i) => edge(i + 1) - edge(i) < b.barWidth + b.minGap)) fail('scale_band_overflow');
  const unitPx = Math.floor((b.baselineY - b.labelMargin) / Math.max(...marks.map(m => m.ratio)));
  const placed = marks.map((m, i) => {
    const heightPx = Math.round(m.ratio * unitPx), slotLeft = edge(i), slotRight = edge(i + 1);
    if (heightPx < b.floorPx) fail('scale_band_unreadable');
    // An invariant of the unit rule, kept as a refusal: no bar may reach into the label margin.
    if (heightPx > b.baselineY - b.labelMargin) fail('scale_band_overflow');
    return { id: m.id, label: m.label, ratio: m.ratio, heightPx, x: slotLeft + Math.floor((slotRight - slotLeft - b.barWidth) / 2),
      topY: b.baselineY - heightPx, slotLeft, slotRight };
  });
  return { version: SCALE_BAND_VERSION, width: b.width, height: b.height, baselineY: b.baselineY, labelMargin: b.labelMargin,
    barWidth: b.barWidth, floorPx: b.floorPx, unitPx, marks: placed };
}

const xml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const PNG_OPTIONS = { compressionLevel: 9, adaptiveFiltering: false, palette: false } as const;
/** The band's SVG: background, labels (each clipped to its own slot, above its bar), the ground line, then the bars on top. */
export function scaleBandSvg(geometry: ScaleBandGeometry) {
  // Only geometry this module derives is drawn: anything else (a hand-edited height, position or margin) refuses.
  let rebuilt: ScaleBandGeometry;
  try { rebuilt = scaleBandGeometry({ version: 'scale-band-input/v1', marks: geometry.marks.map(({ id, label, ratio }) => ({ id, label, ratio })) }); }
  catch { return fail('scale_band_geometry'); }
  if (JSON.stringify(rebuilt) !== JSON.stringify(geometry)) fail('scale_band_geometry');
  const b = SCALE_BAND, c = b.colours, g = rebuilt;
  const crisp = 'shape-rendering="crispEdges"';
  return [`<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height}" viewBox="0 0 ${g.width} ${g.height}">`,
    `<defs>${g.marks.map((m, i) => `<clipPath id="label${i}"><rect x="${m.slotLeft + 2}" y="0" width="${m.slotRight - m.slotLeft - 4}" height="${m.topY - b.labelClearance}"/></clipPath>`).join('')}</defs>`,
    `<rect x="0" y="0" width="${g.width}" height="${g.height}" fill="${c.background}" ${crisp}/>`,
    ...g.marks.map((m, i) => `<text x="${m.x + b.barWidth / 2}" y="${m.topY - b.labelGap}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${b.labelSize}" fill="${c.label}" clip-path="url(#label${i})">${xml(m.label)}</text>`),
    `<rect x="8" y="${g.baselineY}" width="${g.width - 16}" height="2" fill="${c.ground}" ${crisp}/>`,
    ...g.marks.map(m => `<rect x="${m.x}" y="${m.topY}" width="${b.barWidth}" height="${m.heightPx}" fill="${c.bar}" ${crisp}/>`),
    '</svg>'].join('\n');
}
/** The band rasterised (sharp/librsvg): an opaque 8-bit RGB PNG of exactly the band's size. */
export async function renderScaleBand(geometry: ScaleBandGeometry): Promise<Buffer> {
  const png = await sharp(Buffer.from(scaleBandSvg(geometry))).flatten({ background: SCALE_BAND.colours.background }).removeAlpha().png(PNG_OPTIONS).toBuffer();
  const meta = await sharp(png).metadata();
  if (meta.width !== SCALE_BAND.width || meta.height !== SCALE_BAND.height || meta.channels !== 3) fail('scale_band_raster');
  return png;
}
/** Geometry and raster together: the band's `{ png, geometry }`. */
export async function scaleBand(input: unknown) {
  const geometry = scaleBandGeometry(input);
  return { png: await renderScaleBand(geometry), geometry };
}

const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const solidRows = (hex: string, width: number, height: number) => {
  const [r, g, b] = rgb(hex), out = Buffer.alloc(width * height * 3);
  for (let i = 0; i < out.length; i += 3) { out[i] = r; out[i + 1] = g; out[i + 2] = b; }
  return out;
};
/**
 * An opaque 8-bit PNG of exactly this size as raw RGB rows, or a refusal. No colour profile (so no colour conversion can alter a pixel)
 * and no transparency: the pixels are taken exactly as stored.
 */
async function opaqueRows(png: Buffer, width: number, height: number, code: string) {
  const meta = await sharp(png).metadata().catch(() => fail(code));
  if (meta.format !== 'png' || meta.width !== width || meta.height !== height || meta.depth !== 'uchar' || meta.hasProfile ||
    (meta.channels !== 3 && meta.channels !== 4)) fail(code);
  if (meta.hasAlpha && !(await sharp(png).stats()).isOpaque) fail(code);
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 3 || data.length !== width * height * 3) fail(code);
  return data;
}
/**
 * The probe's image 3, 1024 x 1344: the atlas rows copied unchanged at the top, then the band area: the band's rows (M1) or the blank
 * band background (the baseline). Both arms therefore share the canvas size and every atlas pixel; the marks are the only difference.
 */
export async function composeEntitiesCanvas(atlas: Buffer, band: Buffer | 'blank'): Promise<Buffer> {
  const w = ENTITIES_CANVAS.width, top = await opaqueRows(atlas, w, ENTITIES_CANVAS.atlasHeight, 'scale_canvas_atlas');
  const strip = band === 'blank' ? solidRows(SCALE_BAND.colours.background, w, SCALE_BAND.height)
    : await opaqueRows(band, w, SCALE_BAND.height, 'scale_canvas_band');
  return sharp(Buffer.concat([top, strip]), { raw: { width: w, height: ENTITIES_CANVAS.height, channels: 3 } }).png(PNG_OPTIONS).toBuffer();
}
