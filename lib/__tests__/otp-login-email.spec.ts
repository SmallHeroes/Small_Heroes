import { describe, expect, it } from 'vitest';

import { buildOtpLoginEmail } from '@/backend/lib/otp-login-email';
import { COMMON, EMAIL } from '@/content';

describe('buildOtpLoginEmail', () => {
  it('renders approved OTP template with code, TTL, and brand tokens', () => {
    const email = buildOtpLoginEmail('482916');

    expect(email.from).toBe(EMAIL.otp.from);
    expect(email.subject).toBe(EMAIL.otp.subject);
    expect(email.html).toContain('482916');
    expect(email.html).toContain('dir="rtl"');
    expect(email.html).toContain('#ffee6c');
    expect(email.html).toContain('#8467ff');
    expect(email.html).toContain('#ede8ff');
    expect(email.html).toContain(EMAIL.otp.headline);
    expect(email.html).toContain(EMAIL.otp.ttlNote(EMAIL.otp.ttlMinutes));
    expect(email.html).toContain(EMAIL.otp.ignoreNote);
    expect(email.html).toContain(COMMON.brand);
    expect(email.html).not.toContain('{{CODE}}');
  });

  it('includes hidden preheader and plain-text fallback with TTL', () => {
    const email = buildOtpLoginEmail('123456');

    expect(email.html).toContain('display:none');
    expect(email.html).toContain(EMAIL.otp.preheader('123456'));
    expect(email.text).toContain('123456');
    expect(email.text).toContain('10 דקות');
  });
});
