import { describe, expect, it } from 'vitest';
import { buildEmailHtml, type BookReadyEmailData } from '@/backend/lib/email';
import { listenUrlFromReadUrl } from '@/lib/routes';

/**
 * The redesigned book-ready email: exactly TWO buttons (open + listen), a prominent cover, Gmail-safe
 * table+inline RTL. Cover + listen button are GRACEFUL — omitted when their data is absent. Plus the
 * listen-URL derivation used to thread the secondary CTA through every send path.
 */

const base: BookReadyEmailData = {
  to: 'a@b.com',
  customerName: 'דנה',
  childName: 'נועם',
  readUrl: 'https://app.example.com/ready?orderId=cmXYZ&accessKey=KEY123',
};

describe('listenUrlFromReadUrl', () => {
  it('derives the absolute listen URL (same origin + accessKey) from a canonical readUrl', () => {
    expect(listenUrlFromReadUrl(base.readUrl, 'cmXYZ')).toBe(
      'https://app.example.com/book/cmXYZ/listen?accessKey=KEY123'
    );
  });
  it('returns undefined when the readUrl carries no accessKey (→ email omits the listen button)', () => {
    expect(listenUrlFromReadUrl('https://app.example.com/ready?orderId=cmXYZ', 'cmXYZ')).toBeUndefined();
  });
  it('returns undefined for an absent/opaque readUrl', () => {
    expect(listenUrlFromReadUrl(null, 'cmXYZ')).toBeUndefined();
    expect(listenUrlFromReadUrl('not a url', 'cmXYZ')).toBeUndefined();
  });
});

describe('buildEmailHtml — two buttons, cover, RTL, Gmail-safe', () => {
  it('renders the hero title + subtitle + footer, RTL', () => {
    const html = buildEmailHtml(base);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('הספר של נועם מוכן!');
    expect(html).toContain('גיבורים קטנים — סיפורי חוסן לילדים');
  });

  it('primary CTA → readUrl; secondary CTA (listen) → listenUrl when present', () => {
    const html = buildEmailHtml({ ...base, listenUrl: 'https://app.example.com/book/cmXYZ/listen?accessKey=KEY123' });
    expect(html).toContain('פתחו את הספר');
    expect(html).toContain(base.readUrl);
    expect(html).toContain('השמע את הספר');
    expect(html).toContain('https://app.example.com/book/cmXYZ/listen?accessKey=KEY123');
    // Video, PDF, and the old audio-narration buttons are gone.
    expect(html).not.toContain('הורדת PDF להדפסה');
    expect(html).not.toContain('האזנה לקריינות');
  });

  it('omits the listen button when no listenUrl (graceful — only the primary shows)', () => {
    const html = buildEmailHtml(base);
    expect(html).toContain('פתחו את הספר');
    expect(html).not.toContain('השמע את הספר');
  });

  it('shows the cover image when coverImageUrl is present; omits it gracefully when absent', () => {
    const withCover = buildEmailHtml({ ...base, coverImageUrl: 'https://cdn.example.com/cover.png' });
    expect(withCover).toContain('src="https://cdn.example.com/cover.png"');
    expect(withCover).toContain('alt="כריכת הספר"');

    const noCover = buildEmailHtml(base);
    expect(noCover).not.toContain('<img');
  });

  it('escapes a hostile child name (no raw HTML injection into the hero)', () => {
    const html = buildEmailHtml({ ...base, childName: '<script>x</script>' });
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
