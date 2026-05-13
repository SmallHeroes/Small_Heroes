export const ROUTES = {
  home: '/',
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
} as const;
