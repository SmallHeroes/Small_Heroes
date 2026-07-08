export const ROUTES = {
  home: '/',
  start: '/start',
  wizard: '/wizard',
  login: '/login',
  myBooks: '/my-books',
  fakePayment: '/dev/fake-payment',
  generating: '/generating',
  ready: '/ready',
  /** Legacy HTML reader (public/HTML/reader.html), served at `/reader`. */
  reader: '/reader',
  readerV2: (orderId: string, accessKey?: string | null) => {
    const params = new URLSearchParams({ v: '1' });
    if (accessKey) params.set('accessKey', accessKey);
    return `/book/${encodeURIComponent(orderId)}/read-v2?${params.toString()}`;
  },
  /** Audio-only listen mode. accessKey auth like the reader. */
  listen: (orderId: string, accessKey?: string | null) => {
    const q = accessKey ? `?accessKey=${encodeURIComponent(accessKey)}` : '';
    return `/book/${encodeURIComponent(orderId)}/listen${q}`;
  },
} as const;

/**
 * Derive the ABSOLUTE listen-mode URL from an absolute canonical readUrl (`${origin}/ready?orderId=…&
 * accessKey=…`) + the orderId. Returns undefined when the readUrl is absent/opaque or carries no accessKey
 * (then the email simply omits the secondary "listen" button — graceful). Same accessKey the reader uses.
 */
export function listenUrlFromReadUrl(readUrl: string | null | undefined, orderId: string): string | undefined {
  if (!readUrl) return undefined;
  try {
    const u = new URL(readUrl);
    const accessKey = u.searchParams.get('accessKey');
    if (!accessKey) return undefined;
    return `${u.origin}${ROUTES.listen(orderId, accessKey)}`;
  } catch {
    return undefined;
  }
}
