import { readFileSync } from 'fs';
import path from 'path';
import { COMMON, EMAIL } from '@/content';

const TEMPLATE_PATH = path.join(
  process.cwd(),
  'backend/lib/email-templates/email-otp-login.html'
);

let cachedTemplate: string | null = null;

function loadOtpLoginTemplate(): string {
  if (!cachedTemplate) {
    cachedTemplate = readFileSync(TEMPLATE_PATH, 'utf8');
  }
  return cachedTemplate;
}

function replacePlaceholders(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((html, [key, value]) => {
    return html.split(`{{${key}}}`).join(value);
  }, template);
}

export type OtpLoginEmailContent = {
  html: string;
  text: string;
  subject: string;
  from: string;
};

/** Approved RTL OTP login email — table layout, inline styles, plain-text fallback. */
export function buildOtpLoginEmail(code: string): OtpLoginEmailContent {
  const strings = EMAIL.otp;
  const html = replacePlaceholders(loadOtpLoginTemplate(), {
    PREHEADER: strings.preheader(code),
    HEADLINE: strings.headline,
    INSTRUCTION: strings.instruction,
    CODE: code,
    TTL_NOTE: strings.ttlNote(strings.ttlMinutes),
    IGNORE_NOTE: strings.ignoreNote,
    BRAND: COMMON.brand,
    TAGLINE: COMMON.tagline,
  });

  return {
    html,
    text: strings.plainText(code),
    subject: strings.subject,
    from: strings.from,
  };
}

/** Test helper — reset cached template between runs. */
export function resetOtpLoginTemplateCacheForTests(): void {
  cachedTemplate = null;
}
