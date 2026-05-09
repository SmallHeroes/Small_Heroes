# Phase 9c — Video Addon in Wizard + Wizard State Persistence

## Two features in one brief:
1. Add "Video MP4" as a purchasable addon in the wizard (step 8)
2. Persist wizard state across page refresh

---

## Feature 1: Video Addon in Wizard

### Pricing Decision
Current addons:
- Audio (קריינות): ₪19
- PDF: ₪12
- Combo (audio + PDF): ₪25

Video pricing: **₪15** — it's more work than PDF (server-side FFmpeg encoding) but less perceived value than narration. Positioned between PDF and audio.

New combo options:
- Current combo (audio + PDF) stays at ₪25
- **New "הכל" bundle** (audio + PDF + video): ₪39 (save ₪7 vs buying separately)

### Schema — Add `videoEnabled` to Order

In `backend/schema.prisma`, add to the Order model after `bundleEnabled`:
```prisma
videoEnabled       Boolean           @default(false)
```

Migration SQL:
```sql
ALTER TABLE "Order" ADD COLUMN "videoEnabled" BOOLEAN NOT NULL DEFAULT false;
```

### HTML — `public/HTML/wizard.html`

Add a new addon row AFTER the PDF row and BEFORE the bundle row (~line 306):

```html
<div class="addon-row" id="addon-video-row" onclick="toggleAddon('videoEnabled')">
  <div class="addon-info">
    <span class="badge-new" id="s8VideoBadge"></span>
    <div class="addon-main">
      <div>
        <div class="addon-name" id="s8VideoName"></div>
        <div class="addon-desc" id="s8VideoDesc"></div>
      </div>
      <div class="addon-checkbox" id="cb-video"></div>
    </div>
  </div>
</div>
```

### CSS — `public/CSS/wizard.css`

Add badge style for "new":
```css
.badge-new {
  background: #7c3aed;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
}
```

### Content — `public/JS/content.js`

In `wizard.steps.s8`, add video alongside audio/pdf/bundle (~line 273):
```javascript
video:  { badge: 'חדש!',  name: 'סרטון MP4 (+₪15)', desc: 'הספר כסרטון מקריינות עם תמונות' },
```

In `wizard.summary` (~line 418), add:
```javascript
videoLabel: 'סרטון:',
videoAddon: 'סרטון 🎬',
```

Update bundle text to reflect new "הכל" option:
```javascript
bundle: { badge: 'חסכו ₪7', name: 'הכל (+₪39)', desc: 'קריינות + PDF + סרטון יחד' },
bundleLabel: 'קריינות + PDF + סרטון (הכל)',
```

### Wizard JS — `public/JS/wizard.js`

**A. State — add `videoEnabled`:**

In the state defaults (~line 302):
```javascript
videoEnabled: false,
```

**B. Prices — add video:**

In PRICES (~line 314):
```javascript
video: 15,
bundle: 39,  // updated from 25 to 39 (all three)
```

**C. Price calculation — update `calcPrice()`:**

```javascript
if (state.bundleEnabled) {
  addons = PRICES.bundle; // all three included
} else {
  if (state.audioEnabled) addons += PRICES.audio;
  if (state.pdfEnabled)   addons += PRICES.pdf;
  if (state.videoEnabled)  addons += PRICES.video;
}
```

**D. `toggleAddon()` — add videoEnabled case:**

```javascript
case "videoEnabled": {
  const next = !state.videoEnabled;
  state.videoEnabled = next;
  if (!next && state.bundleEnabled) {
    state.bundleEnabled = false;
  }
  break;
}
```

Update the `bundleEnabled` case to also toggle video:
```javascript
case "bundleEnabled": {
  const next = !state.bundleEnabled;
  state.bundleEnabled = next;
  if (next) {
    state.audioEnabled = true;
    state.pdfEnabled   = true;
    state.videoEnabled  = true;
  } else {
    state.audioEnabled = false;
    state.pdfEnabled   = false;
    state.videoEnabled  = false;
  }
  break;
}
```

**E. `syncAddonUI()` — add video:**

In the checkboxes map:
```javascript
const checks = {
  audio:  state.audioEnabled,
  pdf:    state.pdfEnabled,
  video:  state.videoEnabled,
  bundle: state.bundleEnabled,
};
```

**F. `renderStep8()` — populate video text:**

After the PDF text lines (~line 717):
```javascript
setText('s8VideoBadge', WIZ.steps.s8.video.badge);
setText('s8VideoName',  WIZ.steps.s8.video.name);
setText('s8VideoDesc',  WIZ.steps.s8.video.desc);
```

**G. Summary — include video:**

In the summary items array, add:
```javascript
state.videoEnabled || state.bundleEnabled
  ? { icon: "🎬", label: WIZ.summary.videoLabel, val: "✓" }
  : null,
```

In the addons price breakdown:
```javascript
if (state.videoEnabled) {
  html += `<div class="line"><span class="label">${WIZ.summary.videoAddon}</span><span class="val">₪${PRICES.video}</span></div>`;
}
```

**H. Submit — send `videoEnabled`:**

In the product object (~line 2408):
```javascript
videoEnabled: state.videoEnabled,
```

### Backend — Order creation

In `app/api/orders/route.ts`, accept `videoEnabled` from the product object and pass to Prisma `order.create()`.

### Backend — Generation route

In `app/api/generate/route.ts`, after the audio stage, add a video generation stage:
```typescript
// ── Stage 3b: Video (optional) ─────────────────────
if (order.videoEnabled) {
  try {
    // Video depends on per-page audio already being generated
    const bookPages = await prisma.bookPage.findMany({
      where: { bookId: book.id },
      orderBy: { pageNumber: 'asc' },
      select: { pageNumber: true, text: true, audioUrl: true, imageAsset: { select: { url: true, presentationUrl: true } } },
    });

    const { generateBookVideo, storeVideo } = await import('@/backend/providers/video');
    const videoPages = [
      ...(order.coverImageUrl ? [{ pageNumber: 0, text: '', imageUrl: order.coverImageUrl, audioUrl: null }] : []),
      ...bookPages.map(p => ({
        pageNumber: p.pageNumber,
        text: p.text,
        imageUrl: p.imageAsset?.presentationUrl ?? p.imageAsset?.url ?? '',
        audioUrl: p.audioUrl,
      })),
    ].filter(p => p.imageUrl);

    const videoBuffer = await generateBookVideo({
      orderId,
      title: book.title,
      pages: videoPages,
    });

    const videoUrl = await storeVideo(videoBuffer, `${orderId}-book.mp4`);
    await prisma.generatedBook.update({ where: { id: book.id }, data: { videoUrl } });
  } catch (videoErr) {
    console.error('[Generate] Video stage failed (non-fatal):', videoErr);
  }
}
```

**Important:** Video generation should happen AFTER audio generation is complete, because it needs the per-page audioUrls.

### Ready Page — Show video button based on `videoUrl`

Already implemented in Phase 9b. No changes needed — the button shows when `book.videoUrl` exists.

---

## Feature 2: Wizard State Persistence

### Problem
When the user refreshes the page mid-wizard, all progress is lost and they start from step 1.

### Solution
Use `sessionStorage` to persist the wizard state. `sessionStorage` is cleared when the tab is closed (unlike `localStorage`), which is the right behavior — a new session should start fresh.

### Implementation in `public/JS/wizard.js`

**A. Save state on every change:**

Create a function that saves the current state:
```javascript
const WIZARD_STORAGE_KEY = 'wizard_state';

function saveWizardState() {
  try {
    const snapshot = {
      step: currentStep,
      state: { ...state },
      timestamp: Date.now(),
    };
    sessionStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (e) {
    // sessionStorage not available or quota exceeded — ignore
  }
}
```

Call `saveWizardState()`:
- At the end of `goToStep()` (after step transition)
- At the end of every state-changing function: `toggleAddon()`, voice selection, name input, gender select, age select, topic select, companion select, style select, etc.
- Essentially: anywhere `state.*` is modified

**B. Restore state on page load:**

In the initialization code (DOMContentLoaded or equivalent), before rendering step 1:
```javascript
function restoreWizardState() {
  try {
    const raw = sessionStorage.getItem(WIZARD_STORAGE_KEY);
    if (!raw) return false;
    const snapshot = JSON.parse(raw);
    
    // Expire after 30 minutes
    if (Date.now() - snapshot.timestamp > 30 * 60 * 1000) {
      sessionStorage.removeItem(WIZARD_STORAGE_KEY);
      return false;
    }

    // Restore state fields
    Object.assign(state, snapshot.state);
    
    // Go to the saved step
    goToStep(snapshot.step);
    
    // Re-render current step with restored values
    // Each step's render function reads from `state`, so this should "just work"
    
    return true;
  } catch (e) {
    return false;
  }
}
```

Call `restoreWizardState()` during initialization. If it returns `true`, skip the default `goToStep(1)`.

**C. Clear state on successful order submission:**

After the order is successfully created and the user is redirected to the generating page:
```javascript
sessionStorage.removeItem(WIZARD_STORAGE_KEY);
```

**D. Handle uploaded files:**

`sessionStorage` cannot store `File` objects. For the child photo upload:
- Store only the preview URL (data URL or object URL) in state, not the File object
- On restore, show the preview image but mark that re-upload may be needed
- Or: skip restoring the uploaded image and just show a "re-upload" prompt

Best approach: Don't persist `childImageFile` in sessionStorage. If the user had uploaded a photo, after refresh show the upload step with a note "תמונה שהועלתה — יש להעלות שוב" or auto-skip if it's optional.

### Files to Change

| File | Changes |
|------|---------|
| `backend/schema.prisma` | Add `videoEnabled Boolean @default(false)` to Order |
| `public/HTML/wizard.html` | Add video addon row |
| `public/CSS/wizard.css` | Add `.badge-new` style |
| `public/JS/content.js` | Add video addon text, update bundle text/price |
| `public/JS/wizard.js` | Add videoEnabled state, toggleAddon case, pricing, syncUI, persist/restore |
| `app/api/orders/route.ts` | Accept videoEnabled |
| `app/api/generate/route.ts` | Add video generation stage after audio |

### Migration SQL
```sql
ALTER TABLE "Order" ADD COLUMN "videoEnabled" BOOLEAN NOT NULL DEFAULT false;
```

### Testing

1. Open wizard → fill steps 1-7 → refresh page → verify same step with same data
2. Step 8: verify video addon appears between PDF and bundle
3. Toggle video on → price updates by ₪15
4. Toggle bundle → all three checked, price = ₪39
5. Submit order → sessionStorage cleared
6. Generate book with video enabled → verify MP4 appears on ready page
