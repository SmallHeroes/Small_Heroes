# Phase 5 — PDF Generation + Book Access Fix + Account System

**Three tasks. In priority order.**

---

## Task 1: Fix old books not opening from history (BUG — CRITICAL)

### Root Cause

The fake-payment confirm flow redirects to `/generating?orderId=xxx` **without the accessKey** (which is the `paymentId`). This cascades:

1. `app/api/dev/fake-payment/confirm/route.ts` line ~126:
   ```ts
   redirectUrl: `${ROUTES.generating}?orderId=${encodeURIComponent(order.id)}`
   // ← Missing: &accessKey=${paymentId}
   ```

2. `generating.js` reads `accessKey` from URL → gets `null`

3. Redirects to `/ready?orderId=xxx` → no accessKey

4. `ready.js` saves to bookHistory with `accessKey: null`

5. Later, user clicks book from history → `/ready?orderId=xxx` (no accessKey) → API returns 404

### Fix

**File: `app/api/dev/fake-payment/confirm/route.ts` (~line 123-127)**

Current:
```ts
return NextResponse.json({
  ok: true,
  result: 'success',
  redirectUrl: `${ROUTES.generating}?orderId=${encodeURIComponent(order.id)}`,
});
```

Change to:
```ts
// Include accessKey (paymentId) so generating→ready→history all have it
const accessKeyParam = order.paymentId ? `&accessKey=${encodeURIComponent(order.paymentId)}` : '';
return NextResponse.json({
  ok: true,
  result: 'success',
  redirectUrl: `${ROUTES.generating}?orderId=${encodeURIComponent(order.id)}${accessKeyParam}`,
});
```

Need to make sure `order.paymentId` is available in scope. It's the `paymentId` variable already present in the function — it was used to match the order. So:
```ts
redirectUrl: `${ROUTES.generating}?orderId=${encodeURIComponent(order.id)}&accessKey=${encodeURIComponent(paymentId)}`,
```

**Also check the PayMe webhook redirect** (`app/api/webhooks/payme/route.ts`) — if it redirects the user after payment, make sure it includes the accessKey too.

### Verification
1. Create a new book through fake payment
2. Check the generating page URL includes `accessKey=...`
3. Check the ready page URL includes `accessKey=...`  
4. Check localStorage `sh_book_history` — the entry should have a non-null `accessKey`
5. Go to homepage, click the book from the history bar → should open correctly

---

## Task 2: Implement PDF generation (FEATURE — HIGH)

### Current State

`backend/api/generate.ts` lines 219-221:
```ts
// TODO: Generate PDF if pdfEnabled
// const pdfUrl = order.pdfEnabled ? await generatePDF(book) : null;
// if (pdfUrl) await prisma.generatedBook.update({ where:{id:book.id}, data:{pdfUrl} });
```

PDF generation was never implemented. The `pdfUrl` field in `GeneratedBook` schema exists but is always null.

### Architecture

Create a new module `backend/lib/pdf-generator.ts` that:
1. Takes a generated book (pages with image URLs + text)
2. Downloads all page images
3. Composes a PDF: one page per book page, full-bleed image + text overlay
4. Uploads the PDF to the same storage as images (Supabase Storage or wherever images go)
5. Returns the public URL

**Use `pdf-lib`** (npm package) — lightweight, works in Node, good for image composition.

### Implementation

**New file: `backend/lib/pdf-generator.ts`**

```ts
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fetch from 'node-fetch';

interface BookPageForPdf {
  pageNumber: number;
  text: string;
  imageUrl: string | null;
  isCover?: boolean;
}

export async function generateBookPdf(params: {
  title: string;
  pages: BookPageForPdf[];
}): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  
  // Page size: 5x7 inches (360x504 points) — standard children's book
  const PAGE_WIDTH = 360;
  const PAGE_HEIGHT = 504;
  
  for (const bookPage of params.pages) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    
    // Draw full-bleed image if available
    if (bookPage.imageUrl) {
      try {
        const imgResponse = await fetch(bookPage.imageUrl);
        const imgBytes = await imgResponse.arrayBuffer();
        const contentType = imgResponse.headers.get('content-type') || '';
        
        let image;
        if (contentType.includes('png')) {
          image = await pdfDoc.embedPng(imgBytes);
        } else {
          image = await pdfDoc.embedJpg(imgBytes);
        }
        
        // Scale to fill page (cover/fit)
        const imgAspect = image.width / image.height;
        const pageAspect = PAGE_WIDTH / PAGE_HEIGHT;
        
        let drawWidth, drawHeight, drawX, drawY;
        if (imgAspect > pageAspect) {
          // Image wider than page — fit height, crop width
          drawHeight = PAGE_HEIGHT;
          drawWidth = drawHeight * imgAspect;
          drawX = (PAGE_WIDTH - drawWidth) / 2;
          drawY = 0;
        } else {
          // Image taller than page — fit width, crop height
          drawWidth = PAGE_WIDTH;
          drawHeight = drawWidth / imgAspect;
          drawX = 0;
          drawY = (PAGE_HEIGHT - drawHeight) / 2;
        }
        
        page.drawImage(image, {
          x: drawX,
          y: drawY,
          width: drawWidth,
          height: drawHeight,
        });
      } catch (err) {
        console.error(`[PDF] Failed to embed image for page ${bookPage.pageNumber}:`, err);
      }
    }
    
    // Draw text overlay (skip for cover)
    if (bookPage.text && !bookPage.isCover) {
      const fontSize = 11;
      const lineHeight = fontSize * 1.6;
      const padding = 28;
      const textAreaWidth = PAGE_WIDTH - (padding * 2);
      
      // Semi-transparent background for text readability
      const textLines = wrapTextRTL(bookPage.text, textAreaWidth, fontSize);
      const textBlockHeight = textLines.length * lineHeight + padding;
      
      page.drawRectangle({
        x: 0,
        y: 0,
        width: PAGE_WIDTH,
        height: textBlockHeight,
        color: rgb(1, 1, 1),
        opacity: 0.75,
      });
      
      // Draw text lines (RTL — right-aligned)
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      // NOTE: pdf-lib doesn't support Hebrew natively.
      // For Hebrew text, we need to use a custom font or render text as images.
      // See "Hebrew text approach" below.
    }
  }
  
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
```

### Hebrew Text Problem

**CRITICAL**: `pdf-lib` (and most PDF libraries) don't handle RTL Hebrew text well. The standard fonts don't include Hebrew glyphs. Options:

**Option A (Recommended): Render text as image overlay**
- For each page, use a canvas library (like `canvas` npm package) to render the Hebrew text to a PNG
- Embed that PNG into the PDF page on top of the illustration
- This gives full control over RTL, font, and styling

**Option B: Use puppeteer to render the entire page**
- Create an HTML template that looks like the reader
- Render each page to PDF using puppeteer
- Merge all pages
- Heavy dependency but pixel-perfect results

**Option C: Use `@react-pdf/renderer`**
- React-based PDF renderer
- Has better Unicode/RTL support
- Can register custom fonts (Rubik)
- Fits the React/Next.js stack

**My recommendation: Option C** (`@react-pdf/renderer`) because:
- It's React-native, fits our stack
- Supports custom fonts (we can use Rubik, same as reader)
- Handles Unicode/Hebrew when a proper font is registered
- Lighter than puppeteer

### Simplified approach with @react-pdf/renderer

```bash
npm install @react-pdf/renderer
```

Create `backend/lib/pdf-generator.tsx`:
```tsx
import { Document, Page, Image, Text, View, Font, StyleSheet, renderToBuffer } from '@react-pdf/renderer';

// Register Rubik font (download the TTF first)
Font.register({
  family: 'Rubik',
  src: '/path/to/Rubik-Regular.ttf',
});

const styles = StyleSheet.create({
  page: { width: '100%', height: '100%', position: 'relative' },
  image: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' },
  textOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  text: {
    fontFamily: 'Rubik',
    fontSize: 11,
    lineHeight: 1.6,
    textAlign: 'right',
    direction: 'rtl',
    color: '#2a241a',
  },
  coverTitle: {
    fontFamily: 'Rubik',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#fff',
    textShadow: '0 2px 8px rgba(0,0,0,0.5)',
  },
});

function BookPdf({ title, pages }) {
  return (
    <Document title={title}>
      {pages.map((page) => (
        <Page key={page.pageNumber} size={[360, 504]} style={styles.page}>
          {page.imageUrl && <Image src={page.imageUrl} style={styles.image} />}
          {page.isCover ? (
            <View style={{ position: 'absolute', top: 40, left: 0, right: 0 }}>
              <Text style={styles.coverTitle}>{title}</Text>
            </View>
          ) : page.text ? (
            <View style={styles.textOverlay}>
              <Text style={styles.text}>{page.text}</Text>
            </View>
          ) : null}
        </Page>
      ))}
    </Document>
  );
}

export async function generateBookPdf(params) {
  const buffer = await renderToBuffer(<BookPdf {...params} />);
  return buffer;
}
```

### Wire into pipeline

**File: `backend/api/generate.ts` (~line 219-221)**

Replace the TODO:
```ts
// Generate PDF if enabled
let pdfUrl: string | null = null;
if (order.pdfEnabled && book) {
  try {
    console.log(`[Generation] ${orderId} — Generating PDF...`);
    const { generateBookPdf } = await import('../lib/pdf-generator');
    const pdfBuffer = await generateBookPdf({
      title: book.title || order.childName || 'הספר שלי',
      pages: book.pages.map(p => ({
        pageNumber: p.pageNumber,
        text: p.text,
        imageUrl: p.imageAsset?.presentationUrl ?? p.imageAsset?.url ?? null,
        isCover: p.pageNumber === 0,
      })),
    });
    
    // Upload to storage (same as image uploads)
    const { uploadPdfToStorage } = await import('../lib/pdf-storage');
    pdfUrl = await uploadPdfToStorage(orderId, pdfBuffer);
    
    await prisma.generatedBook.update({
      where: { id: book.id },
      data: { pdfUrl },
    });
    console.log(`[Generation] ${orderId} — PDF generated: ${pdfUrl}`);
  } catch (pdfErr) {
    console.error(`[Generation] ${orderId} — PDF generation failed:`, pdfErr);
    // Non-fatal — book is still readable without PDF
  }
}
```

### Storage

Create `backend/lib/pdf-storage.ts` — upload to Supabase Storage (same bucket as images) or to a public folder. Check how `image-storage.ts` works and follow the same pattern.

### Font file

Download Rubik-Regular.ttf and Rubik-Bold.ttf from Google Fonts. Place in `public/fonts/` or `backend/assets/fonts/`.

### Verification
1. Enable PDF addon in wizard
2. Generate a book
3. Check logs: `[Generation] xxx — PDF generated: https://...`
4. On ready page, PDF button should appear and download a real PDF
5. Open PDF — should show book pages with images and Hebrew text

---

## Task 3: Account system — Email OTP + My Books (FEATURE — MEDIUM)

### Architecture

**Auth flow**: Email + OTP (no password)
1. User enters email → we send a 6-digit code
2. User enters code → we create/find a session
3. Session stored as HTTP-only cookie
4. "Stay logged in" = 30-day cookie (vs 24h default)

**DB changes** (new models in `backend/schema.prisma`):

```prisma
model UserAccount {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  
  orders    Order[]  // Link existing orders to this account
  sessions  UserSession[]
  otpCodes  OtpCode[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model UserSession {
  id        String   @id @default(cuid())
  userId    String
  user      UserAccount @relation(fields: [userId], references: [id])
  
  token     String   @unique   // Random session token stored in cookie
  expiresAt DateTime
  
  createdAt DateTime @default(now())
}

model OtpCode {
  id        String   @id @default(cuid())
  userId    String
  user      UserAccount @relation(fields: [userId], references: [id])
  
  code      String   // 6-digit code
  expiresAt DateTime // 10 minutes
  used      Boolean  @default(false)
  
  createdAt DateTime @default(now())
}
```

**Also add to Order**:
```prisma
model Order {
  // ... existing fields ...
  userId    String?
  user      UserAccount? @relation(fields: [userId], references: [id])
}
```

### API endpoints

```
POST /api/auth/send-code     { email }              → sends OTP email
POST /api/auth/verify-code   { email, code, stayLoggedIn }  → sets session cookie, returns user
GET  /api/auth/me                                    → returns current user (from cookie)
POST /api/auth/logout                                → clears session
GET  /api/my-books                                   → returns all books for logged-in user
```

### Pages

**`/login`** — Email input + OTP code input (two-step form)
**`/my-books`** — Grid of all books the user has created, each linking to the ready page

### Order linking

When a user logs in, we should:
1. Check if any orders with their `customerEmail` exist
2. Link those orders to their `UserAccount`
3. Future orders automatically link via the session

### What NOT to build yet
- Password reset (no passwords)
- Social login (keep it simple)
- Account settings/profile editing
- Email change flow

### Implementation order
1. DB migration (add models)
2. `/api/auth/send-code` + `/api/auth/verify-code` + `/api/auth/me`
3. Login page (static HTML like other pages)
4. My Books page
5. Wire login state into navbar (show "החשבון שלי" when logged in)
6. Auto-link orders by email on login

---

## Files summary

### Task 1 (bug fix)
- `app/api/dev/fake-payment/confirm/route.ts` — add accessKey to redirect URL

### Task 2 (PDF)
- `backend/lib/pdf-generator.tsx` — NEW: generates PDF from book data
- `backend/lib/pdf-storage.ts` — NEW: uploads PDF to storage
- `backend/api/generate.ts` — wire PDF generation into pipeline
- `public/fonts/Rubik-Regular.ttf` — NEW: font file for PDF
- `package.json` — add `@react-pdf/renderer`

### Task 3 (account)
- `backend/schema.prisma` — add UserAccount, UserSession, OtpCode models + Order.userId
- `app/api/auth/send-code/route.ts` — NEW
- `app/api/auth/verify-code/route.ts` — NEW
- `app/api/auth/me/route.ts` — NEW
- `app/api/auth/logout/route.ts` — NEW
- `app/api/my-books/route.ts` — NEW
- `public/HTML/login.html` + `public/JS/login.js` + `public/CSS/login.css` — NEW
- `public/HTML/my-books.html` + `public/JS/my-books.js` + `public/CSS/my-books.css` — NEW
- `next.config.js` — add routes for login + my-books
