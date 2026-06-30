/**
 * Email Service Stub
 * Sends transactional emails (book ready, confirmation, etc.)
 * Integrate with Resend, SendGrid, or Nodemailer.
 */
import { EMAIL } from '@/content';
import { buildOtpLoginEmail } from '@/backend/lib/otp-login-email';

export interface BookReadyEmailData {
  to: string;
  customerName: string;
  childName: string;
  readUrl: string;
  audioUrl?: string;
  pdfUrl?: string;
  /** Phase-1 Outbox: effectively-once delivery. Sent as the Resend Idempotency-Key (dedups identical for 24h). */
  idempotencyKey?: string;
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

// ─── Email HTML Template ──────────────────────────────
function buildEmailHtml(data: BookReadyEmailData): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Heebo', Arial, sans-serif; background: #F9F7FF; margin: 0; padding: 20px; }
    .card { background: white; border-radius: 20px; padding: 40px; max-width: 500px; margin: 0 auto; box-shadow: 0 4px 20px rgba(124,58,237,0.1); }
    h1 { color: #7C3AED; font-size: 28px; margin-bottom: 8px; }
    p { color: #4B5563; line-height: 1.6; }
    .btn { display: inline-block; background: #7C3AED; color: white; padding: 14px 28px; border-radius: 999px; text-decoration: none; font-weight: bold; font-size: 16px; margin-top: 16px; }
    .footer { text-align: center; color: #9CA3AF; font-size: 12px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <p>${EMAIL.body.greeting(data.customerName)}</p>
    <h1>${EMAIL.body.headline(data.childName)}</h1>
    <p>${EMAIL.body.intro(data.childName)}</p>
    <a href="${data.readUrl}" class="btn">${EMAIL.body.btnRead}</a>
    ${data.audioUrl ? `<br><a href="${data.audioUrl}" class="btn" style="background:#6D28D9; margin-top:8px;">${EMAIL.body.btnAudio}</a>` : ''}
    ${data.pdfUrl ? `<br><a href="${data.pdfUrl}" class="btn" style="background:#5B21B6; margin-top:8px;">${EMAIL.body.btnPdf}</a>` : ''}
    <div class="footer">
      <p>${EMAIL.body.footer}</p>
    </div>
  </div>
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
