# Phase 10a — Print-Ready PDF Export

## Context

We currently have a working PDF generator (`backend/lib/pdf-generator.ts`) using Puppeteer + headless Chrome. It produces 8.5x8.5 inch pages, full-bleed images, RTL Hebrew text (Heebo font via Google Fonts). This is a "screen PDF" — fine for viewing/sharing but NOT suitable for professional printing.

We're upgrading this to a **print-ready PDF** that a customer can take directly to a print shop.

**User-facing name:** "קובץ מוכן להדפסה" (₪19 addon)

---

## Requirements

### 1. Page Size & Bleed

```
TRIM_SIZE:    8.5 x 8.5 inches (216 x 216 mm)
BLEED:        3mm on all sides
TOTAL_PAGE:   222 x 222 mm (with bleed)

In points (1mm = 2.835pt):
  TRIM:       612 x 612 pt
  BLEED:      8.5 pt each side
  FULL_PAGE:  629 x 629 pt
```

- Background images MUST extend into bleed area (no white edges after trimming)
- Define constants centrally in a new config file

### 2. Safe Zone / Margins

```
SAFE_MARGIN:  12mm from trim edge
```

- ALL text must stay within safe zone
- No critical character faces at trim boundaries
- Page numbers (if any) inside safe zone

### 3. Resolution / DPI

Target: **300 DPI** output.

Puppeteer's `page.pdf()` produces vector + raster mixed output. The key concern is IMAGE resolution:
- Our images from GPT Image come at 1024x1024 or 1536x1536
- For an 8.5" square at 300 DPI we need 2550x2550px minimum
- Current images at 1024px only give ~120 DPI — NOT print-quality

**Strategy:**
1. Request images at maximum resolution from GPT Image (1536x1536 for now — not enough for 300DPI but acceptable for children's books at ~180 DPI)
2. Add optional AI upscale step (Real-ESRGAN via Replicate) to 2x → 3072x3072 (360 DPI — perfect)
3. If upscale fails or is disabled, log warning but still produce the PDF

### 4. Image Upscaling Pipeline

Add a new provider: `backend/providers/upscale.ts`

```typescript
export async function upscaleImage(imageUrl: string): Promise<string> {
  // Use Replicate's Real-ESRGAN model
  // Input: 1024-1536px image URL
  // Output: 2x upscaled URL (2048-3072px)
  // Upload result to Supabase, return public URL
}
```

Only call upscale when `pdfEnabled === true` in the order config. Run upscale AFTER all images are generated, in parallel.

### 5. Font Embedding

Current approach uses Google Fonts loaded via `<link>`. For print-ready:

- Download Heebo font files (woff2/ttf) and serve them via `@font-face` with `src: url(data:...)` base64-embedded directly in the HTML
- This guarantees font embedding in the PDF (no external dependency)
- Download Heebo-Regular (400) and Heebo-Bold (700) weights

Store font files at: `backend/assets/fonts/Heebo-Regular.ttf` and `Heebo-Bold.ttf`

In the HTML template, replace the Google Fonts `<link>` with:
```css
@font-face {
  font-family: 'Heebo';
  font-weight: 400;
  src: url(data:font/truetype;base64,{BASE64_REGULAR}) format('truetype');
}
@font-face {
  font-family: 'Heebo';
  font-weight: 700;
  src: url(data:font/truetype;base64,{BASE64_BOLD}) format('truetype');
}
```

### 6. PDF Generation Changes

Modify `generateBookPdf` (or create a new `generatePrintReadyPdf` function):

```typescript
export async function generatePrintReadyPdf(params: {
  title: string;
  pages: BookPageForPdf[];
  imageUrls?: Map<number, string>; // page number → high-res image URL
}): Promise<Buffer>
```

Key differences from current PDF:
- Page size includes bleed: `629pt x 629pt`
- Images stretched to fill including bleed area
- Text positioned with safe margin (12mm = ~34pt from edge, but remember the page now includes 8.5pt bleed, so from page edge: 34+8.5 = ~42.5pt)
- Higher device scale factor for raster elements: `page.pdf({ ... })` already vectors text, but set viewport to 2x for image rendering

### 7. Trim Marks (Optional but Professional)

Add thin crop marks at corners showing where to cut:
```css
.trim-mark {
  position: absolute;
  width: 10pt;
  height: 0.5pt;
  background: #000;
}
/* Position at all 4 corners, outside trim but inside bleed */
```

### 8. Color Architecture

Keep RGB for now (CMYK conversion requires specialized tools like Ghostscript or ICC profiles which add complexity).

But ensure:
- No pure black backgrounds (use rich black: #1a1a1a minimum)
- Text remains #2a241a (warm dark, safe for print)
- Avoid RGBA/transparency in final output (print doesn't support alpha)

### 9. Metadata

Generate a metadata file alongside the PDF (or embed in PDF properties):

```json
{
  "format": "print_ready",
  "trimSize": "216x216mm",
  "bleed": "3mm",
  "safeMargin": "12mm",
  "dpi": 300,
  "pageCount": 15,
  "colorMode": "RGB",
  "fonts": ["Heebo"],
  "generatedAt": "2026-05-10T...",
  "version": "1.0"
}
```

### 10. File Structure

```
backend/
  lib/
    pdf-generator.ts          ← existing (screen PDF, keep as-is)
    print-ready-generator.ts  ← NEW (print-ready PDF)
    pdf-storage.ts            ← existing (Supabase upload, reuse)
  providers/
    upscale.ts                ← NEW (Real-ESRGAN via Replicate)
  config/
    print.ts                  ← NEW (constants: trim, bleed, margins, DPI)
  assets/
    fonts/
      Heebo-Regular.ttf       ← NEW (downloaded from Google Fonts)
      Heebo-Bold.ttf          ← NEW
```

### 11. Pipeline Integration

In `app/api/generate/route.ts`, after image generation completes:

```typescript
if (order.pdfEnabled) {
  // 1. Upscale images for print (parallel)
  const hiResUrls = await upscaleImagesForPrint(generatedPages);
  
  // 2. Generate print-ready PDF
  const pdfBuffer = await generatePrintReadyPdf({
    title: story.title,
    pages: generatedPages,
    imageUrls: hiResUrls,
  });
  
  // 3. Store and get URL
  const pdfUrl = await storePdf(pdfBuffer, `${orderId}-print-ready.pdf`);
  
  // 4. Save to DB
  await prisma.generatedBook.update({
    where: { orderId },
    data: { pdfUrl },
  });
}
```

### 12. Spread Continuity Validation (Future)

Not blocking for v1, but architecture should support:
- Color palette consistency check across pages
- Character identity verification
- Lighting direction consistency

These are already partially handled by our Visual Bible / character DNA system.

### 13. Cover Architecture (Future)

Not implemented now, but the page size and bleed system should be designed to support:
- Full wrap cover (front + spine + back)
- Spine width calculation based on page count
- Barcode placement zone on back cover

---

## Implementation Order

1. Create `backend/config/print.ts` with all constants
2. Download + embed Heebo font files
3. Create `backend/lib/print-ready-generator.ts` (copy from pdf-generator.ts, modify for bleed/margins/fonts)
4. Create `backend/providers/upscale.ts` (Real-ESRGAN via Replicate)
5. Wire into generate route — when pdfEnabled, run upscale + print-ready PDF
6. Test locally with a generated book

---

## Acceptance Criteria

- [ ] PDF opens in any PDF viewer without font issues
- [ ] Hebrew text renders correctly (RTL, niqqud preserved)
- [ ] Background images extend into 3mm bleed area
- [ ] Text stays within 12mm safe margin
- [ ] Images are ≥180 DPI (ideally 300 DPI with upscale)
- [ ] Fonts are embedded (no external dependencies)
- [ ] File size reasonable (< 50MB for 15-page book)
- [ ] Print shop can process without errors
