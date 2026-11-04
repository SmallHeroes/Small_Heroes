import 'server-only';
import sharp from 'sharp';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { PDFDocument, rgb } from 'pdf-lib';
import { engineSiteFail } from './contract';

const escapeMarkup = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Pango shapes Hebrew, niqqud, mixed digits and punctuation using a bundled font. No URL/font fallback. */
async function textImage(text: string, size: number, width: number, maximumHeight: number) {
  if (!text.trim() || text.length > 5000 || /[\u0000-\u0008]/.test(text)) engineSiteFail('engine_pdf_text_invalid');
  const { data, info } = await sharp({ text: { text: `<span foreground="#3d2917">${escapeMarkup(text)}</span>`,
    font: `Heebo ${size}`, fontfile: join(process.cwd(), 'backend/assets/fonts/Heebo-Regular.ttf'), width, align: 'right', rgba: true, dpi: 72 } }).png().toBuffer({ resolveWithObject: true });
  if (info.height > maximumHeight || info.width > width) engineSiteFail('engine_pdf_text_overflow');
  return { data, width: info.width, height: info.height };
}
/** Nine logical pages: portrait cover, then eight reader spreads. Full image, no crop, no omitted/shortened text. */
export async function buildEngineBookPdf(title: string, pages: { pageNumber: number; text: string; image: Buffer }[]) {
  if (pages.length !== 9 || pages.some((p, i) => p.pageNumber !== i) || pages[0].text !== title) engineSiteFail('engine_pdf_coverage');
  const font = await readFile(join(process.cwd(), 'backend/assets/fonts/Heebo-Regular.ttf'));
  if (font.length < 1000 || font.readUInt32BE(0) !== 0x00010000) engineSiteFail('engine_pdf_font_invalid');
  const doc = await PDFDocument.create();
  // Stable metadata: rebuilding an interrupted free materialization yields the same content bytes.
  const epoch = new Date('2026-11-04T00:00:00.000Z'); doc.setCreationDate(epoch); doc.setModificationDate(epoch);
  doc.setTitle(title); doc.setAuthor('Small Heroes'); doc.setProducer('engine-site-pdf/v1');
  for (const source of pages) {
    const meta = await sharp(source.image, { failOn: 'error', limitInputPixels: 4_000_000 }).metadata();
    if (meta.format !== 'png' || meta.width !== 1024 || meta.height !== 1536) engineSiteFail('engine_pdf_image_invalid');
    const cover = source.pageNumber === 0, page = doc.addPage([cover ? 480 : 960, 720]);
    page.drawRectangle({ x: 0, y: 0, width: cover ? 480 : 960, height: 720, color: rgb(.961, .922, .839) });
    const image = await doc.embedPng(source.image); page.drawImage(image, { x: 0, y: 0, width: 480, height: 720 });
    const text = await textImage(source.text, cover ? 28 : 23, 384, cover ? 160 : 600), embedded = await doc.embedPng(text.data);
    const x = (cover ? 0 : 480) + 480 - 48 - text.width, y = cover ? 720 - 48 - text.height : (720 - text.height) / 2;
    if (cover) page.drawRectangle({ x: 32, y: y - 16, width: 416, height: text.height + 32, color: rgb(.961, .922, .839), opacity: .9 });
    page.drawImage(embedded, { x, y, width: text.width, height: text.height });
  }
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}
