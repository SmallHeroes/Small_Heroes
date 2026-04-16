/**
 * Email Service Stub
 * Sends transactional emails (book ready, confirmation, etc.)
 * Integrate with Resend, SendGrid, or Nodemailer.
 */

export interface BookReadyEmailData {
  to: string;
  customerName: string;
  childName: string;
  readUrl: string;
  audioUrl?: string;
  pdfUrl?: string;
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
      from: 'גיבורים קטנים <stories@gibborim-ktanim.co.il>',
      to: [data.to],
      subject: `✨ הסיפור של ${data.childName} מוכן!`,
      html,
    }),
  });

  if (!res.ok) throw new Error(`Resend email error: ${res.status}`);
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
    <p>שלום ${data.customerName},</p>
    <h1>✨ הסיפור של ${data.childName} מוכן!</h1>
    <p>יצרנו עבורכם ספר ילדים קסום ואישי, כתוב בדיוק עבור ${data.childName}.</p>
    <a href="${data.readUrl}" class="btn">📖 לקריאת הסיפור</a>
    ${data.audioUrl ? `<br><a href="${data.audioUrl}" class="btn" style="background:#6D28D9; margin-top:8px;">🎧 להאזנה לסיפור</a>` : ''}
    ${data.pdfUrl ? `<br><a href="${data.pdfUrl}" class="btn" style="background:#5B21B6; margin-top:8px;">📥 הורדת PDF</a>` : ''}
    <div class="footer">
      <p>גיבורים קטנים — סיפורי חוסן לילדים</p>
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
