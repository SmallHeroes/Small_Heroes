# Phase 5b — Book Naming Feature

**Goal: Let parents give their book a custom name in the wizard.**

The name appears as the book title in the reader, PDF, my-books page, and ready page. If left empty, the LLM-generated title is used as fallback.

---

## 1. Schema — add `bookName` to Order

**File: `backend/schema.prisma`**

Add after `childSuperpower` (~line 103):
```prisma
  bookName          String?   // optional custom book title from wizard
```

Then run `npx prisma db push` (no migration needed — nullable column).

---

## 2. Wizard — add book name input to summary step

### 2a. State

**File: `public/JS/wizard.js`**

Add to state object (~line 309, after `bundleEnabled`):
```js
  bookName: "",
```

### 2b. HTML — input field in summary card

**File: `public/HTML/wizard.html`**

In step-13 (`<!-- Step 12 — Summary + Payment -->`), add a book name input inside the first `s9-card` (the order summary card), BEFORE the `<div id="order-summary">`:

```html
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label" id="s9BookNameLabel">שם לספר (אופציונלי)</label>
            <input class="form-input" id="bookNameInput" type="text"
                   placeholder="למשל: ההרפתקה של יואב"
                   maxlength="60" autocomplete="off" dir="rtl" />
            <div class="form-hint" id="s9BookNameHint" style="font-size:12px;color:#888;margin-top:4px;">
              אם לא תבחרו שם, ניצור שם אוטומטית
            </div>
          </div>
```

### 2c. Wire input to state

**File: `public/JS/wizard.js`**

Add an event listener (near the other input listeners, after `initI18n()` or in a setup block):

```js
  const bookNameInput = document.getElementById('bookNameInput');
  if (bookNameInput) {
    bookNameInput.addEventListener('input', (e) => {
      state.bookName = e.target.value.trim();
    });
  }
```

Also in `buildSummary()` — restore the input value when revisiting the step:
```js
  const bookNameInput = document.getElementById('bookNameInput');
  if (bookNameInput) bookNameInput.value = state.bookName || '';
```

### 2d. Include in summary rows

In `buildSummary()`, add a summary row IF the user entered a name. Add it as the first row in the `rows` array (~line 2236):

```js
    const rows = [
      state.bookName
        ? { icon: "📕", label: "שם הספר", val: state.bookName }
        : null,
      {
        icon:  "👤",
        ...
```

### 2e. Include in payload

**File: `public/JS/wizard.js`** — in `buildWizardPayload()` (~line 2416):

Add `bookName` to the return object, at the top level alongside `child`, `topic`, etc.:

```js
    bookName: state.bookName || null,
```

---

## 3. Backend — store and use bookName

### 3a. Order creation

**File: `app/api/orders/route.ts`**

Extract from body (~line 195, near other destructuring):
```ts
  const bookName = typeof body.bookName === 'string' ? body.bookName.trim().slice(0, 60) : null;
```

Add to `prisma.order.create` data (~line 289, after `familyContext`):
```ts
        bookName: bookName || null,
```

### 3b. Pass to story pipeline

**File: `backend/api/generate.ts`**

The `story.title` comes from the LLM. We want the user's name to take priority.

After the book is created (~line 70-76), if the order has a bookName, update the book title:

```ts
    const book = await prisma.generatedBook.create({
      data: {
        orderId,
        title: order.bookName || story.title,
        coverText: story.coverText,
      },
    });
```

This is the simplest approach — if the user gave a name, use it. Otherwise use the LLM title.

### 3c. Ensure order query includes bookName

**File: `backend/api/generate.ts`**

In the order select/include at the top of `runGeneration()`, make sure `bookName` is selected. It should already be included if using `select: *` or `findUnique` without explicit select. Verify this — if there's an explicit `select`, add `bookName: true`.

---

## 4. Reader + Ready page — already correct

The reader uses `book.title` from GeneratedBook, which now contains the user's chosen name (or LLM fallback). No changes needed in:
- `app/book/[id]/read-v2/reader-v2.tsx` — uses `book.title`
- `public/JS/ready.js` — uses `book.title`
- `public/JS/reader.js` — uses `book.title`

---

## 5. My Books page — already correct

**File: `public/JS/my-books.js`** — uses `book.title` which now reflects user's name. No change needed.

---

## 6. PDF — already correct

**File: `backend/lib/pdf-generator.tsx`** — receives `title` from generate.ts, which is already the resolved name. No change needed.

---

## Files changed

| File | Change |
|------|--------|
| `backend/schema.prisma` | Add `bookName String?` to Order |
| `public/JS/wizard.js` | Add `bookName` to state, input listener, summary row, payload |
| `public/HTML/wizard.html` | Add book name input in step-13 summary card |
| `app/api/orders/route.ts` | Extract + store `bookName` |
| `backend/api/generate.ts` | Use `order.bookName \|\| story.title` for book title |

## What NOT to change

- Reader (reader-v2.tsx, reader.js) — already uses book.title
- Ready page (ready.js) — already uses book.title  
- My Books (my-books.js) — already uses book.title
- PDF generator — already receives resolved title

## After implementation

Run `npx prisma db push` to add the column.
