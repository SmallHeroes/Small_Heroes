# Phase 9a — Book Quality Fixes (Reader + Pipeline Resilience)

## Context
End-to-end test revealed 4 critical issues that break the "real book" feeling.
WORD_COUNT metadata leak is already fixed. This brief covers the remaining 3 issues.

---

## Issue 1: Missing Images (Pages Without Illustrations)

### Problem
Pages 2, 3, 4 in a 10-page book rendered as text-only (no illustration).
Image generation failed silently — the pipeline `continue`s past failures.

### Root Cause
`backend/providers/image.ts` ~line 3125: when GPT Image returns an error (content policy, rate limit, timeout), the page is pushed to `failedPages` and skipped. No retry is attempted for those specific pages.

### Fix
In the main image generation loop (around line 2708), after the first pass completes:

```typescript
// After main loop ends, retry failed pages once
if (failedPages.length > 0) {
  console.log(`[ImageGen] Retrying ${failedPages.length} failed pages: ${failedPages.join(', ')}`);
  const retryPages = pagesToGenerate.filter(p => failedPages.includes(p.pageNumber));
  failedPages.length = 0; // reset
  
  for (const page of retryPages) {
    try {
      // Wait 3 seconds between retries to avoid rate limits
      await new Promise(r => setTimeout(r, 3000));
      // ... same generation logic as main loop ...
    } catch (err) {
      console.error(`[ImageGen] Retry failed for page ${page.pageNumber}:`, err);
      failedPages.push(page.pageNumber);
    }
  }
}
```

Also: log the REASON for failure clearly so we can diagnose content policy issues.

---

## Issue 2: Reader Layout — "Doesn't Look Like a Book"

### Problem
- Pages WITH images: text floats at top with a heavy cream gradient overlay that obscures the illustration
- Pages WITHOUT images (text_only): just text on plain cream — no visual treatment at all
- The overall feel is "web app", not "storybook"

### Current Layout (reader-v2.module.css)
- `.overlayZoneTop` / `.overlayZoneBottom`: absolute positioned over image, max-height 55%, with `rgba(253,249,244,0.95)` gradient
- `.tplTextOnly` / `.textOnlyPaper`: just flex column with padding, no decoration

### Fix — Reader CSS Changes

#### A. Reduce text overlay opacity (make illustrations more visible)
File: `app/book/[id]/read-v2/reader-v2.module.css`

Change `.overlayZoneBottom` gradient:
```css
.overlayZoneBottom {
  max-height: 42%;  /* was 55% */
  background: linear-gradient(
    to top,
    rgba(253, 249, 244, 0.88) 0%,    /* was 0.95 */
    rgba(253, 249, 244, 0.75) 40%,   /* was 0.92 */
    rgba(253, 249, 244, 0.4) 75%,    /* was 0.7 */
    rgba(253, 249, 244, 0) 100%
  );
}
```

Change `.overlayZoneTop` gradient:
```css
.overlayZoneTop {
  max-height: 42%;  /* was 55% */
  background: linear-gradient(
    to bottom,
    rgba(253, 249, 244, 0.4) 0%,     /* was 0.5 */
    rgba(253, 249, 244, 0.25) 40%,   /* was 0.35 */
    rgba(253, 249, 244, 0.1) 75%,    /* was 0.20 */
    rgba(253, 249, 244, 0) 100%
  );
}
```

#### B. Default text zone to TOP (not bottom)
File: `app/book/[id]/read-v2/reader-v2.tsx`, line ~117

Change:
```typescript
parseTextZone(page.textZone ?? undefined) ?? 'bottom_clear'
```
To:
```typescript
parseTextZone(page.textZone ?? undefined) ?? 'top_clear'
```

Rationale: The GPT Image prompt already instructs "top 20-30% lighter for text". If we put text at bottom, it competes with the detailed illustration area.

#### C. Text-only pages: add decorative frame
File: `app/book/[id]/read-v2/reader-v2.module.css`

```css
.textOnlyPaper {
  flex: 1;
  min-height: 0;
  padding: 48px 32px 40px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  /* Add decorative book feel */
  border: 2px solid rgba(180, 160, 130, 0.3);
  border-radius: 4px;
  background: linear-gradient(
    135deg,
    rgba(253, 249, 244, 1) 0%,
    rgba(248, 242, 232, 1) 100%
  );
  box-shadow: inset 0 0 30px rgba(180, 160, 130, 0.08);
}
```

---

## Issue 3: Video — Text Cut Off on Right Side

### Problem
The video (MP4) shows text cut off on the right edge. Since text is RTL Hebrew, the right side is where text STARTS.

### Root Cause
The video renderer (likely Puppeteer screenshot-based) doesn't account for RTL text padding correctly. The text might overflow the viewport or the padding/margin is insufficient.

### Investigation Needed
Check `backend/providers/video.ts` or wherever video frames are rendered:
- What viewport size is used for video frame capture?
- Is the reader CSS loaded correctly in the Puppeteer context?
- Is there sufficient `padding-right` for RTL text?

### Fix Direction
- Ensure video frame capture uses same CSS as reader
- Add explicit `padding: 0 32px` to the video text container
- Verify viewport matches the aspect ratio (portrait 1080x1920 or similar)

---

## Files to Modify

| File | Changes |
|------|---------|
| `backend/providers/image.ts` | Add retry loop for failed pages after main pass |
| `app/book/[id]/read-v2/reader-v2.module.css` | Reduce gradient opacity, shrink max-height, add text-only decoration |
| `app/book/[id]/read-v2/reader-v2.tsx` | Default textZone to 'top_clear' |
| Video renderer (find exact file) | Fix RTL text padding in video frames |

## Testing
1. Generate a new book — verify ALL pages have images (no text_only pages unless story has no imageDirection)
2. Check reader — text should be lighter over image, more transparent gradient
3. Check video — text should not be cut off on right side

## Priority
1. Missing images retry (CRITICAL — breaks the product)
2. Reader gradient + text zone (HIGH — looks unprofessional)
3. Video text (MEDIUM — video is an addon)
