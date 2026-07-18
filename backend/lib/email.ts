/**
 * Email Service Stub
 * Sends transactional emails (book ready, confirmation, etc.)
 * Integrate with Resend, SendGrid, or Nodemailer.
 */
import { EMAIL } from '@/content';
import { buildOtpLoginEmail } from '@/backend/lib/otp-login-email';
import type { QaWarnings } from '@/lib/qa-soft-deliver';

export interface BookReadyEmailData {
  to: string;
  customerName: string;
  childName: string;
  readUrl: string;
  /** Audio-only "listen mode" URL (/book/[id]/listen?accessKey=…) — the secondary CTA. */
  listenUrl?: string;
  /** Book cover image (prominent hero). Absent → graceful no-cover layout. */
  coverImageUrl?: string;
  audioUrl?: string;
  pdfUrl?: string;
  /** Phase-1 Outbox: effectively-once delivery. Sent as the Resend Idempotency-Key (dedups identical for 24h). */
  idempotencyKey?: string;
  qaWarnings?: QaWarnings;
}

export interface OtpEmailData {
  to: string;
  code: string;
}

export type EmailDeliveryState = 'delivered' | 'pending' | 'failed' | 'unknown';

export interface RefundNoticeEmailData {
  to: string;
  customerName: string;
  childName: string;
  idempotencyKey: string;
}

/**
 * (Human-QA Slice 1, Unit 3) The INTERNAL operator-review notification. Carries the review facts (orderId,
 * childName, kind, humanReason, pages) — and DELIBERATELY NO customer access key and NO deep link to a page:
 * the admin console is Slice 2, so a link would point at a 404 (not visible lifecycle). The operator looks the
 * order up by id. Sent with an `Idempotency-Key` so a re-attempt of the SAME notification never double-pings.
 */
export interface OperatorReviewEmailData {
  to: string;
  orderId: string;
  childName: string;
  kind: string;
  humanReason: string;
  pages?: number[];
  idempotencyKey: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char] as string);
}

// ─── Provider: Resend (recommended) ──────────────────
async function sendWithResend(data: BookReadyEmailData): Promise<{ providerMessageId?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not set');

  const html = buildEmailHtml(data);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      // Phase-1 Outbox: Resend dedups an identical Idempotency-Key for 24h → effectively-once delivery.
      ...(data.idempotencyKey ? { 'Idempotency-Key': data.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from:    EMAIL.from,
      to:      [data.to],
      subject: EMAIL.subject(data.childName),
      html,
    }),
  });

  if (!res.ok) throw new Error(`Resend email error: ${res.status}`);
  const body = (await res.json().catch(() => ({}))) as { id?: string };
  return { providerMessageId: body.id };
}

async function sendOtpWithResend(data: OtpEmailData): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not set');

  const email = buildOtpLoginEmail(data.code);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: email.from,
      to: [data.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    console.error('[auth][resend] OTP send failed', {
      status: res.status,
      from: email.from,
      to: data.to,
      body: bodyText.slice(0, 500),
    });
    const reason = bodyText ? ` ${bodyText.slice(0, 200)}` : '';
    throw new Error(`Resend OTP email error: ${res.status}${reason}`);
  }
}

/** Provider reconciliation is possible only by Resend's message id (there is no lookup-by-idempotency API). */
export async function getBookReadyEmailDeliveryState(
  providerMessageId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ state: EmailDeliveryState; event: string | null }> {
  const provider = process.env.EMAIL_PROVIDER || 'resend';
  const apiKey = process.env.RESEND_API_KEY;
  if (provider !== 'resend' || !apiKey || !providerMessageId.trim()) {
    return { state: 'unknown', event: null };
  }
  const res = await fetchImpl(
    `https://api.resend.com/emails/${encodeURIComponent(providerMessageId.trim())}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  if (res.status === 404) return { state: 'unknown', event: 'not_found' };
  if (!res.ok) throw new Error(`Resend retrieve email error: ${res.status}`);
  const body = (await res.json().catch(() => ({}))) as { last_event?: string };
  const event = body.last_event?.trim().toLowerCase() || null;
  if (event && ['delivered', 'opened', 'clicked', 'complained'].includes(event)) {
    return { state: 'delivered', event };
  }
  if (event && ['sent', 'scheduled', 'delivery_delayed'].includes(event)) {
    return { state: 'pending', event };
  }
  if (event && ['failed', 'bounced', 'suppressed'].includes(event)) {
    return { state: 'failed', event };
  }
  return { state: 'unknown', event };
}

export async function sendRefundNoticeEmail(
  data: RefundNoticeEmailData,
  fetchImpl: typeof fetch = fetch,
): Promise<{ providerMessageId?: string }> {
  const provider = process.env.EMAIL_PROVIDER || 'resend';
  if (provider !== 'resend') {
    throw new Error(`Unsupported refund-notice email provider:${provider}`);
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not set');
  const res = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': data.idempotencyKey,
    },
    body: JSON.stringify({
      from: EMAIL.from,
      to: [data.to],
      subject: 'עדכון לגבי ההזמנה שלך מגיבורים קטנים',
      html: `
        <html dir="rtl" lang="he">
          <body style="font-family:Arial,sans-serif;line-height:1.6">
            <p>שלום ${escapeHtml(data.customerName)},</p>
            <p>לא הצלחנו להשלים את הספר של ${escapeHtml(data.childName)} ברמת האיכות שהבטחנו.</p>
            <p>הזיכוי עבור ההזמנה אושר ונשלח לאמצעי התשלום המקורי.</p>
            <p>גיבורים קטנים</p>
          </body>
        </html>`,
    }),
  });
  if (!res.ok) throw new Error(`Resend refund notice error: ${res.status}`);
  const body = (await res.json().catch(() => ({}))) as { id?: string };
  return { providerMessageId: body.id };
}

/**
 * (Human-QA Slice 1, Unit 3) Send the INTERNAL operator-review email. Mirrors sendRefundNoticeEmail EXACTLY:
 * Resend `POST /emails`, `Idempotency-Key` from `data.idempotencyKey`, `providerMessageId = body.id`, throws on
 * a non-ok response. Plain-text + simple-HTML body carrying orderId/childName/kind/humanReason/pages — and NO
 * customer access key and NO deep link (the admin console is Slice 2; a link would 404).
 */
export async function sendOperatorReviewEmail(
  data: OperatorReviewEmailData,
  fetchImpl: typeof fetch = fetch,
): Promise<{ providerMessageId?: string }> {
  const provider = process.env.EMAIL_PROVIDER || 'resend';
  if (provider !== 'resend') {
    throw new Error(`Unsupported operator-review email provider:${provider}`);
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not set');

  const pagesText = data.pages && data.pages.length > 0 ? data.pages.join(', ') : '—';
  const lines = [
    `Order: ${data.orderId}`,
    `Child: ${data.childName}`,
    `Hold kind: ${data.kind}`,
    `Pages: ${pagesText}`,
    ``,
    `Reason:`,
    data.humanReason,
  ];
  const text = lines.join('\n');
  const html = `
    <html lang="en">
      <body style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
        <p style="font-weight:bold;margin:0 0 12px">Human-QA review needed</p>
        <table cellpadding="4" style="border-collapse:collapse">
          <tr><td style="color:#666">Order</td><td><code>${escapeHtml(data.orderId)}</code></td></tr>
          <tr><td style="color:#666">Child</td><td>${escapeHtml(data.childName)}</td></tr>
          <tr><td style="color:#666">Hold kind</td><td>${escapeHtml(data.kind)}</td></tr>
          <tr><td style="color:#666">Pages</td><td>${escapeHtml(pagesText)}</td></tr>
        </table>
        <p style="margin:12px 0 4px;color:#666">Reason</p>
        <p style="margin:0">${escapeHtml(data.humanReason)}</p>
      </body>
    </html>`;

  const res = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      // Re-attempts of the SAME operator notification dedup at the provider for 24h → effectively-once ping.
      'Idempotency-Key': data.idempotencyKey,
    },
    body: JSON.stringify({
      from: EMAIL.from,
      to: [data.to],
      subject: `[Human-QA] Review needed — ${data.childName} (${data.kind})`,
      text,
      html,
    }),
  });
  if (!res.ok) throw new Error(`Resend operator review error: ${res.status}`);
  const body = (await res.json().catch(() => ({}))) as { id?: string };
  return { providerMessageId: body.id };
}

// ─── Email HTML Template ──────────────────────────────
function buildQaWarningsEmailSection(qaWarnings: QaWarnings): string {
  const pageLines = qaWarnings.pageFlags.length
    ? qaWarnings.pageFlags
        .map((f) => {
          const label = f.pageNumber != null ? `עמוד ${f.pageNumber}` : f.artifactKey;
          return `<li><strong>${escapeHtml(label)}</strong>: ${escapeHtml(f.reason)}</li>`;
        })
        .join('')
    : '<li>אין דגלים לפי עמוד</li>';
  const anchorLine = qaWarnings.anchor
    ? `<p><strong>עוגן (likeness):</strong> ${escapeHtml(qaWarnings.anchor.score.toFixed(3))} / ${escapeHtml(qaWarnings.anchor.band)}</p>`
    : '';
  return `
    <div style="margin-top:24px;padding:16px;border:2px solid #F59E0B;border-radius:12px;background:#FFFBEB;">
      <p style="margin:0 0 8px;color:#92400E;font-weight:bold;">⚠️ נמסר עם אזהרות QA (סביבת בדיקה)</p>
      <p style="margin:0 0 8px;color:#78350F;"><strong>היה אמור להיחסם:</strong> ${escapeHtml(qaWarnings.wouldHaveReason)}</p>
      ${anchorLine}
      <p style="margin:8px 0 4px;color:#78350F;font-weight:bold;">דגלים לפי עמוד:</p>
      <ul style="margin:0;padding-right:20px;color:#78350F;">${pageLines}</ul>
    </div>`;
}

export function buildEmailHtml(data: BookReadyEmailData): string {
  // Escape user-supplied names before interpolation; URLs are our-constructed (readUrl/listenUrl).
  const customer = escapeHtml(data.customerName);
  const name = escapeHtml(data.childName);
  const cover = data.coverImageUrl?.trim();

  // Prominent cover (the "WOW"). Graceful no-cover fallback = a little breathing space instead.
  const coverBlock = cover
    ? `<img src="${escapeHtml(cover)}" alt="כריכת הספר" width="280" class="sh-cover" style="width:280px; max-width:80%; height:auto; border-radius:18px; box-shadow:0 16px 38px rgba(76,29,149,0.28); display:block; margin:0 auto 32px;">`
    : `<div style="height:8px; line-height:8px; font-size:8px;">&nbsp;</div>`;

  // Secondary CTA → listen mode. Rendered only when a listen URL is present (graceful).
  const listenBlock = data.listenUrl?.trim()
    ? `
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td align="center" bgcolor="#FFFFFF" style="border-radius:999px; border:2px solid #7C3AED;">
                    <a href="${data.listenUrl}" style="display:inline-block; padding:13px 46px; font-family:Heebo,Arial,sans-serif; font-size:15px; font-weight:600; color:#7C3AED; border-radius:999px; text-decoration:none;">${EMAIL.body.btnListen}</a>
                  </td>
                </tr>
              </table>`
    : '';

  return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @media only screen and (max-width:620px){ .sh-card{padding:28px 20px !important;} .sh-cover{width:72% !important;} .sh-h1{font-size:26px !important;} }
    a { text-decoration:none; }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#F5F2FF; direction:rtl;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${EMAIL.body.subtitle(name)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2FF; direction:rtl;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%;">
          <tr><td align="center" style="padding-bottom:16px;">
            <span style="font-family:Heebo,Arial,sans-serif; font-size:15px; font-weight:700; letter-spacing:0.5px; color:#7C3AED;">✨ גיבורים קטנים</span>
          </td></tr>
        </table>

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="sh-card" style="max-width:600px; width:100%; background-color:#FFFFFF; border-radius:24px; box-shadow:0 12px 44px rgba(124,58,237,0.14); padding:44px 40px;">
          <tr>
            <td align="center" style="direction:rtl; text-align:center;">
              <p style="margin:0 0 6px; font-family:Heebo,Arial,sans-serif; font-size:15px; color:#9CA3AF;">${EMAIL.body.greeting(customer)}</p>
              <h1 class="sh-h1" style="margin:0 0 10px; font-family:Heebo,Arial,sans-serif; font-size:31px; line-height:1.2; font-weight:800; color:#6D28D9;">${EMAIL.body.headline(name)}</h1>
              <p style="margin:0 0 28px; font-family:Heebo,Arial,sans-serif; font-size:16.5px; line-height:1.55; color:#6B7280;">${EMAIL.body.subtitle(name)}</p>

              ${coverBlock}

              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 14px;">
                <tr>
                  <td align="center" bgcolor="#7C3AED" style="border-radius:999px; box-shadow:0 8px 20px rgba(124,58,237,0.35);">
                    <a href="${data.readUrl}" style="display:inline-block; padding:16px 54px; font-family:Heebo,Arial,sans-serif; font-size:17px; font-weight:700; color:#FFFFFF; border-radius:999px; text-decoration:none;">${EMAIL.body.btnRead}</a>
                  </td>
                </tr>
              </table>
              ${listenBlock}
              ${data.qaWarnings ? buildQaWarningsEmailSection(data.qaWarnings) : ''}
            </td>
          </tr>
        </table>

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%;">
          <tr><td align="center" style="padding:22px 16px 8px;">
            <p style="margin:0; font-family:Heebo,Arial,sans-serif; font-size:12.5px; color:#9CA3AF;">${EMAIL.body.footer}</p>
          </td></tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
`;
}

// ─── Main Export ──────────────────────────────────────
export async function sendBookReadyEmail(data: BookReadyEmailData): Promise<{ providerMessageId?: string }> {
  const provider = process.env.EMAIL_PROVIDER || 'resend';

  switch (provider) {
    case 'resend':
      return sendWithResend(data);
    default:
      console.log('[Email STUB] Would send email to:', data.to, 'readUrl:', data.readUrl);
      return {};
  }
}

export async function sendOtpCodeEmail(data: OtpEmailData): Promise<void> {
  const provider = process.env.EMAIL_PROVIDER || 'resend';
  const hasResendKey = Boolean(process.env.RESEND_API_KEY);

  if (provider === 'resend' && hasResendKey) {
    return sendOtpWithResend(data);
  }

  // Dev fallback — fixed code 123456, no email sent
  console.log('═══════════════════════════════════════');
  console.log(`  [DEV] OTP for ${data.to}: ${data.code} (always 123456)`);
  console.log('═══════════════════════════════════════');
}
