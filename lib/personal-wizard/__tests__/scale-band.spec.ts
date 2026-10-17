import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { scaleBand, scaleBandGeometry, renderScaleBand, scaleBandSvg, composeEntitiesCanvas, SCALE_BAND, ENTITIES_CANVAS } from '../scale-band';

// The scale-reference probe's declared test ratios (Decision Gate 2026-10-17 v2): declared inputs, not a canonical size contract.
const DECLARED = { version: 'scale-band-input/v1', marks: [{ id: 'post', label: 'child height', ratio: 1 }, { id: 'grandma', label: 'grandma', ratio: 3 },
  { id: 'companion', label: 'companion', ratio: 0.42 }, { id: 'bumbum', label: 'bumbum', ratio: 0.5 }, { id: 'silver_stone', label: 'silver_stone', ratio: 0.12 }] };
const withMarks = (change: (marks: typeof DECLARED.marks) => unknown[]) => ({ ...DECLARED, marks: change(structuredClone(DECLARED.marks)) });
const BAR = [0x5b, 0x4a, 0x36];
const refused = (input: unknown, code: string) => expect(() => scaleBandGeometry(input)).toThrow(code);

/**
 * The bars as the raster shows them, found ONLY by their exact colour (never from the geometry record or the labels): contiguous columns
 * holding bar pixels form one bar; its top and bottom are the extreme bar rows, and `solid` says every pixel of that box is bar-coloured.
 */
async function scanBars(png: Buffer, fromRow = 0) {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const isBar = (x: number, y: number) => { const i = (y * info.width + x) * 3; return data[i] === BAR[0] && data[i + 1] === BAR[1] && data[i + 2] === BAR[2]; };
  const columns = new Map<number, { top: number; bottom: number; count: number }>();
  for (let y = fromRow; y < info.height; y++) for (let x = 0; x < info.width; x++) if (isBar(x, y)) {
    const c = columns.get(x) ?? { top: y, bottom: y, count: 0 }; c.top = Math.min(c.top, y); c.bottom = Math.max(c.bottom, y); c.count++; columns.set(x, c);
  }
  const bars: { left: number; width: number; top: number; bottom: number; height: number; solid: boolean }[] = [];
  for (const x of [...columns.keys()].sort((a, b) => a - b)) {
    const c = columns.get(x)!, last = bars[bars.length - 1];
    if (last && last.left + last.width === x) { last.width++; last.top = Math.min(last.top, c.top); last.bottom = Math.max(last.bottom, c.bottom); }
    else bars.push({ left: x, width: 1, top: c.top, bottom: c.bottom, height: 0, solid: true });
  }
  for (const b of bars) {
    b.height = b.bottom - b.top + 1;
    for (let x = b.left; x < b.left + b.width && b.solid; x++) for (let y = b.top; y <= b.bottom; y++) if (!isBar(x, y)) { b.solid = false; break; }
  }
  return { bars, size: { width: info.width, height: info.height } };
}
const pattern = async (width: number, height: number, channels: 3 | 4 = 3, alpha = 255) => {
  const raw = Buffer.alloc(width * height * channels);
  for (let i = 0; i < raw.length; i++) raw[i] = channels === 4 && i % 4 === 3 ? alpha : (i * 37 + (i >> 11)) % 251;
  return sharp(raw, { raw: { width, height, channels } }).png().toBuffer();
};
const decoded = async (png: Buffer) => (await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })).data;

describe('scale band (M1): code-drawn height marks, geometry matched by an independent raster scan', () => {
  it('declared inputs: one unit for every mark (floor((296 - 40) / 3) = 85 px), heights round(ratio x unit), all on the y = 296 baseline', () => {
    const g = scaleBandGeometry(DECLARED);
    expect(g).toMatchObject({ width: 1024, height: 320, baselineY: 296, labelMargin: 40, barWidth: 48, floorPx: 8, unitPx: 85 });
    expect(g.marks.map(m => [m.id, m.heightPx, m.topY])).toEqual([['post', 85, 211], ['grandma', 255, 41], ['companion', 36, 260], ['bumbum', 43, 253], ['silver_stone', 10, 286]]);
    expect(g.marks.every(m => m.topY + m.heightPx === 296 && m.topY >= 40 && m.x >= m.slotLeft && m.x + 48 <= m.slotRight)).toBe(true);
  });

  it('raster: bars found by their colour alone are solid, 48 px wide, end on one baseline row and measure ratio x the measured post (+-2 px)', async () => {
    const { png, geometry } = await scaleBand(DECLARED);
    const { bars, size } = await scanBars(png);
    expect(size).toEqual({ width: 1024, height: 320 });
    expect(bars).toHaveLength(DECLARED.marks.length);
    expect(bars.every(b => b.solid && b.width === 48)).toBe(true);
    const bottoms = bars.map(b => b.bottom);
    expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThanOrEqual(1);
    expect(bottoms[0]).toBe(295);
    const post = bars[0].height;
    DECLARED.marks.forEach((m, i) => expect(Math.abs(bars[i].height - m.ratio * post)).toBeLessThanOrEqual(2));
    // No bar pixel in the label margin; the left-to-right order is the declared order (the scan never reads the geometry record).
    expect(bars.every(b => b.top >= SCALE_BAND.labelMargin)).toBe(true);
    expect(bars.map(b => b.left)).toEqual([...bars.map(b => b.left)].sort((a, b) => a - b));
    expect(geometry.marks.map(m => m.heightPx)).toEqual(bars.map(b => b.height));
  });

  it('labels never count as height: the longest labels leave every measured bar unchanged (each label is clipped to its own slot above its bar)', async () => {
    const short = await scanBars((await scaleBand(DECLARED)).png);
    const long = withMarks(marks => marks.map((m, i) => ({ ...m, label: `${'W'.repeat(52)} mark ${i}`.slice(0, 60) })));
    const scanned = await scanBars((await scaleBand(long)).png);
    expect(scanned.bars).toEqual(short.bars);
    // Labels are escaped text, never markup.
    expect(scaleBandSvg(scaleBandGeometry(withMarks(marks => [marks[0], { id: 'x', label: '<b>&"', ratio: 2 }])))).toContain('&lt;b&gt;&amp;&quot;');
  });

  it('refusals: a mark below the readable floor (never enlarged on its own), too many marks, a duplicate id, a post that is not first at exactly 1', () => {
    refused(withMarks(marks => [...marks.slice(0, 4), { id: 'speck', label: 'speck', ratio: 0.05 }]), 'scale_band_unreadable');
    // A very tall mark shrinks the one unit for ALL marks; the post itself falls below the floor and the band refuses.
    refused(withMarks(marks => marks.map(m => m.id === 'grandma' ? { ...m, ratio: 40 } : m)), 'scale_band_unreadable');
    refused(withMarks(marks => [marks[0], ...Array.from({ length: 16 }, (_, i) => ({ id: `m${i}`, label: `m${i}`, ratio: 1 }))]), 'scale_band_overflow');
    expect(() => scaleBandGeometry(withMarks(marks => [marks[0], ...Array.from({ length: 15 }, (_, i) => ({ id: `m${i}`, label: `m${i}`, ratio: 1 }))]))).not.toThrow();
    refused(withMarks(marks => [...marks, { ...marks[3] }]), 'scale_band_duplicate');
    refused(withMarks(marks => [marks[1], marks[0], ...marks.slice(2)]), 'scale_band_post');
    refused(withMarks(marks => [{ ...marks[0], ratio: 1.1 }, ...marks.slice(1)]), 'scale_band_post');
    for (const bad of [withMarks(marks => [{ ...marks[0], label: 'line\nbreak' }, ...marks.slice(1)]), withMarks(marks => [{ ...marks[0], label: ' padded' }, ...marks.slice(1)]),
      withMarks(marks => [{ ...marks[0], label: 'גובה' }, ...marks.slice(1)]), withMarks(marks => [...marks.slice(0, 4), { ...marks[4], ratio: 0 }]),
      withMarks(marks => [marks[0]]), { ...DECLARED, extra: 1 }]) refused(bad, 'scale_band_input');
  });

  it('only derived geometry is drawn: a hand-edited height, position or margin refuses', async () => {
    const g = scaleBandGeometry(DECLARED);
    for (const edit of [(x: any) => { x.marks[1].heightPx += 5; }, (x: any) => { x.marks[2].x += 1; }, (x: any) => { x.labelMargin = 10; }, (x: any) => { x.unitPx = 90; }]) {
      const copy = structuredClone(g); edit(copy);
      await expect(renderScaleBand(copy)).rejects.toThrow('scale_band_geometry');
    }
  });

  it('canvas: 1024 x 1344; the atlas rows are byte-identical in both arms; the baseline band area is blank; the M1 band area is exactly the band', async () => {
    const atlas = await pattern(1024, 1024), { png: band } = await scaleBand(DECLARED);
    const [baseline, marked] = [await composeEntitiesCanvas(atlas, 'blank'), await composeEntitiesCanvas(atlas, band)];
    for (const canvas of [baseline, marked]) expect(await sharp(canvas).metadata()).toMatchObject({ format: 'png', width: ENTITIES_CANVAS.width, height: ENTITIES_CANVAS.height, channels: 3 });
    const split = 1024 * 1024 * 3, atlasRows = await decoded(atlas), [b, m] = [await decoded(baseline), await decoded(marked)];
    expect(b.subarray(0, split).equals(atlasRows)).toBe(true);
    expect(m.subarray(0, split).equals(atlasRows)).toBe(true);
    expect(m.subarray(split).equals(await decoded(band))).toBe(true);
    expect(b.subarray(split).every((v, i) => v === [0xf4, 0xee, 0xe2][i % 3])).toBe(true);
    // The band area scanned independently: no bar in the baseline; in M1 the same bars as the band itself, 1024 rows lower.
    expect((await scanBars(baseline, 1024)).bars).toEqual([]);
    expect((await scanBars(marked, 1024)).bars).toEqual((await scanBars(band)).bars.map(x => ({ ...x, top: x.top + 1024, bottom: x.bottom + 1024 })));
  });

  it('canvas refusals: a wrong-size or transparent atlas, a colour-profiled atlas, a wrong-size band; an opaque RGBA atlas keeps its pixels', async () => {
    const { png: band } = await scaleBand(DECLARED);
    await expect(composeEntitiesCanvas(await pattern(1024, 1000), band)).rejects.toThrow('scale_canvas_atlas');
    await expect(composeEntitiesCanvas(await pattern(1024, 1024, 4, 200), band)).rejects.toThrow('scale_canvas_atlas');
    await expect(composeEntitiesCanvas(await sharp(await pattern(1024, 1024)).withIccProfile('p3').png().toBuffer(), band)).rejects.toThrow('scale_canvas_atlas');
    await expect(composeEntitiesCanvas(Buffer.from('not a png'), band)).rejects.toThrow('scale_canvas_atlas');
    await expect(composeEntitiesCanvas(await pattern(1024, 1024), await pattern(1024, 300))).rejects.toThrow('scale_canvas_band');
    const opaque = await pattern(1024, 1024, 4, 255), canvas = await composeEntitiesCanvas(opaque, 'blank');
    expect((await decoded(canvas)).subarray(0, 1024 * 1024 * 3).equals(await decoded(opaque))).toBe(true);
  });
});
