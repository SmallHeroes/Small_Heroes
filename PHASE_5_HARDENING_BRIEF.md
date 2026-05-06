# Phase 5 Hardening — Pre-Commit Fixes

**Six small targeted changes. All in existing files.**

---

## Fix 1: Hash OTP codes in DB

OTP codes are stored as plaintext. Hash them like session tokens.

**File: `app/api/auth/send-code/route.ts`**

Add import at top:
```ts
import { createHash } from 'crypto';
```

Current (~line 37-46):
```ts
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.otpCode.create({
    data: {
      userId: user.id,
      code,
      expiresAt,
      used: false,
    },
  });
```

Replace with:
```ts
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = createHash('sha256').update(code).digest('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  // Invalidate any previous unused OTP codes for this user
  await prisma.otpCode.updateMany({
    where: { userId: user.id, used: false },
    data: { used: true },
  });

  await prisma.otpCode.create({
    data: {
      userId: user.id,
      code: codeHash,
      expiresAt,
      used: false,
    },
  });
```

This also fixes Fix 2 (invalidation) in the same change.

**File: `app/api/auth/verify-code/route.ts`**

Add import at top:
```ts
import { createHash } from 'crypto';
```

Current (~line 45-53):
```ts
  const otp = await prisma.otpCode.findFirst({
    where: {
      userId: user.id,
      code,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
```

Replace with:
```ts
  const codeHash = createHash('sha256').update(code).digest('hex');
  const otp = await prisma.otpCode.findFirst({
    where: {
      userId: user.id,
      code: codeHash,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
```

---

## Fix 2: Invalidate old OTPs on resend

Already included in Fix 1 above — the `updateMany` call before creating the new OTP.

---

## Fix 3: Tighter rate limit on verify + attempt counter

**File: `app/api/auth/verify-code/route.ts`**

Change the rate limit from 20/min to 5/min:

Current (~line 22-27):
```ts
  const rateLimitError = enforceRateLimit(req, {
    namespace: 'api-auth-verify-code',
    limit: 20,
    windowMs: 60_000,
  });
```

Replace with:
```ts
  const rateLimitError = enforceRateLimit(req, {
    namespace: 'api-auth-verify-code',
    limit: 5,
    windowMs: 60_000,
  });
```

5 attempts per minute per IP is enough for legitimate use, and makes brute-force on a 6-digit code impractical (900K codes / 5 per minute = 3000 hours).

---

## Fix 4: Clean up expired sessions on login

**File: `app/api/auth/verify-code/route.ts`**

After creating the session (~line 73), add cleanup:

Current:
```ts
  const ttlSeconds = stayLoggedIn ? LONG_SESSION_SECONDS : DEFAULT_SESSION_SECONDS;
  const { rawToken, expiresAt } = await createUserSession(user.id, ttlSeconds);
```

Add after:
```ts
  const ttlSeconds = stayLoggedIn ? LONG_SESSION_SECONDS : DEFAULT_SESSION_SECONDS;
  const { rawToken, expiresAt } = await createUserSession(user.id, ttlSeconds);

  // Cleanup: remove expired sessions for this user (prevents accumulation)
  await prisma.userSession.deleteMany({
    where: { userId: user.id, expiresAt: { lt: new Date() } },
  }).catch(() => {});
```

---

## Fix 5: Hebrew status labels in my-books

**File: `public/JS/my-books.js`**

Add status map before `createBookCard`:

```js
  const STATUS_LABELS = {
    ready: 'מוכן לקריאה',
    generating: 'בהכנה...',
    partial: 'בהכנה חלקית',
    paid: 'ממתין ליצירה',
    failed: 'נכשל',
  };
```

Current (~line 28):
```js
    meta.textContent = `סטטוס: ${book.status}`;
```

Replace with:
```js
    meta.textContent = STATUS_LABELS[book.status] || book.status;
```

Also: don't show status for ready books (it's obvious):
```js
    if (book.status !== 'ready') {
      const meta = document.createElement('div');
      meta.className = 'book-card-meta';
      meta.textContent = STATUS_LABELS[book.status] || book.status;
      body.appendChild(meta);
    }
```

---

## Fix 6: Bundle PDF font locally

**Step 1**: Download font files to project:
```bash
mkdir -p backend/assets/fonts
curl -L -o backend/assets/fonts/NotoSansHebrew-Regular.ttf \
  "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanshebrew/NotoSansHebrew-Regular.ttf"
curl -L -o backend/assets/fonts/NotoSansHebrew-Bold.ttf \
  "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanshebrew/NotoSansHebrew-Bold.ttf"
```

**File: `backend/lib/pdf-generator.tsx`**

Add import:
```ts
import path from 'path';
```

Current (~line 18-35):
```ts
function registerFontsIfNeeded(): void {
  if (fontRegistered) return;
  Font.register({
    family: 'NotoSansHebrew',
    fonts: [
      {
        src: 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosanshebrew/NotoSansHebrew-Regular.ttf',
        fontWeight: 'normal',
      },
      {
        src: 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosanshebrew/NotoSansHebrew-Bold.ttf',
        fontWeight: 'bold',
      },
    ],
  });
  fontRegistered = true;
}
```

Replace with:
```ts
function registerFontsIfNeeded(): void {
  if (fontRegistered) return;
  const fontsDir = path.resolve(process.cwd(), 'backend', 'assets', 'fonts');
  Font.register({
    family: 'NotoSansHebrew',
    fonts: [
      {
        src: path.join(fontsDir, 'NotoSansHebrew-Regular.ttf'),
        fontWeight: 'normal',
      },
      {
        src: path.join(fontsDir, 'NotoSansHebrew-Bold.ttf'),
        fontWeight: 'bold',
      },
    ],
  });
  fontRegistered = true;
}
```

---

## Files changed

| File | Fix |
|------|-----|
| `app/api/auth/send-code/route.ts` | Hash OTP + invalidate old codes |
| `app/api/auth/verify-code/route.ts` | Hash OTP lookup + rate limit 5/min + session cleanup |
| `public/JS/my-books.js` | Hebrew status labels |
| `backend/lib/pdf-generator.tsx` | Local font path |
| `backend/assets/fonts/NotoSansHebrew-Regular.ttf` | NEW (download) |
| `backend/assets/fonts/NotoSansHebrew-Bold.ttf` | NEW (download) |

## What NOT to change
- `lib/auth-session.ts` — already correct
- `backend/schema.prisma` — no schema change needed (code field stays String, just stores hash now)
- `app/api/auth/me/route.ts` — correct
- `app/api/auth/logout/route.ts` — correct
- `backend/lib/pdf-storage.ts` — correct
