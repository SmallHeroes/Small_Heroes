/**
 * Email Service Stub
 * Sends transactional emails (book ready, confirmation, etc.)
 * Integrate with Resend, SendGrid, or Nodemailer.
 */
import { EMAIL } from '@/content';

export interface BookReadyEmailData {
  to: string;
  customerName: string;
  childName: string;
  readUrl: string;
  audioUrl?: string;
  pdfUrl?: string;
}

export interface OtpEmailData {
  to: string;
  code: string;
}

// ─── Provider: Resend (recommended) ──────────────────
async function sendWithResend(data: BookReadyEmailData): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not set');

  const html = buildEmailHtml(data);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    EMAIL.from,
      to:      [data.to],
      subject: EMAIL.subject(data.childName),
      html,
    }),
  });

  if (!res.ok) throw new Error(`Resend email error: ${res.status}`);
}

async function sendOtpWithResend(data: OtpEmailData): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not set');

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8" /></head>
<body style="font-family: Arial, sans-serif; background:#F9F7FF; margin:0; padding:24px;">
  <div style="max-width:480px; margin:0 auto; background:#fff; border-radius:16px; padding:28px;">
    <h2 style="margin:0 0 12px; color:#7C3AED;">קוד הכניסה שלך לגיבורים קטנים</h2>
    <p style="margin:0 0 12px; color:#4B5563;">הכניסו את הקוד הבא כדי להתחבר:</p>
    <div style="font-size:32px; font-weight:700; letter-spacing:4px; color:#111827; margin:8px 0 14px;">${data.code}</div>
    <p style="margin:0; color:#6B7280; font-size:14px;">הקוד בתוקף ל-10 דקות.</p>
  </div>
</body>
</html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: EMAIL.from,
      to: [data.to],
      subject: 'קוד כניסה לגיבורים קטנים',
      html,
    }),
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    console.error('[auth][resend] OTP send failed', {
      status: res.status,
      from: EMAIL.from,
      to: data.to,
      body: bodyText.slice(0, 500),
    });
    const reason = bodyText ? ` ${bodyText.slice(0, 200)}` : '';
    throw new Error(`Resend OTP email error: ${res.status}${reason}`);
  }
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
export async function sendBookReadyEmail(data: BookReadyEmailData): Promise<void> {
  const provider = process.env.EMAIL_PROVIDER || 'resend';

  switch (provider) {
    case 'resend':
      return sendWithResend(data);
    default:
      console.log('[Email STUB] Would send email to:', data.to, 'readUrl:', data.readUrl);
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
