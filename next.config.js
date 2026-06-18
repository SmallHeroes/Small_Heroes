/** @type {import('next').NextConfig} */
const nextConfig = {
  /** Keep native ffmpeg/ffprobe installers out of the webpack bundle */
  serverExternalPackages: [
    'fluent-ffmpeg',
    '@ffmpeg-installer/ffmpeg',
    '@ffprobe-installer/ffprobe',
    '@sparticuz/chromium',
    'puppeteer-core',
  ],
  typescript: {
    // TODO(production-push): flip to false once `npm run check` is green in CI.
    // TypeScript errors don't block Turbopack compilation today;
    // `npm run check` (tsc + vitest) is the pre-push contract until then.
    ignoreBuildErrors: true,
  },
  /**
   * Ensure backend asset files (fonts, etc.) are included in the serverless
   * function bundle on Vercel. Without this, existsSync returns false and
   * print-ready PDF generation silently fails.
   */
  outputFileTracingIncludes: {
    '/api/generate': ['./backend/assets/fonts/**/*', './story-bank/**/*'],
    '/api/debug/regen-page': ['./story-bank/**/*'],
    '/api/orders/[orderId]/power-card': ['./story-bank/**/*', './node_modules/@sparticuz/chromium/**/*'],
  },
  /**
   * Keep serverless functions under Vercel's 250MB cap (Phase 1 of Goal A / 0083).
   * The big offenders are ffmpeg+ffprobe installers (~309MB, used ONLY by backend/providers/video.ts
   * → the /api/orders/[orderId]/video route), @sparticuz/chromium (~67MB, used ONLY by the power-card
   * PDF route), and the bundled story assets (public/companions ~90MB + style-references ~78MB).
   * Excludes below strip those from functions that don't need them at runtime. The video route and the
   * power-card route are intentionally NOT excluded so they keep their deps.
   * NOTE: /api/generate imports video via a dynamic, optional, non-fatal `if (order.videoEnabled)`
   * branch — excluding ffmpeg there only makes that optional video stage a no-op (caught + logged);
   * real video generation runs on the dedicated /api/orders/[orderId]/video function.
   */
  outputFileTracingExcludes: (() => {
    const MEDIA = ['node_modules/@ffmpeg-installer/**', 'node_modules/@ffprobe-installer/**'];
    const HEADLESS = ['node_modules/@sparticuz/chromium/**', 'node_modules/puppeteer-core/**'];
    const STORY_ASSETS = ['public/companions/**', 'style-references/**'];
    // Generation routes need story-bank (text, ~12MB, kept via outputFileTracingIncludes) but NOT the
    // bundled companion/style-reference image bytes — those are served to the image API by CDN URL,
    // not read from the function disk. Dropping them (90MB+78MB) keeps these functions under 250MB.
    const GENERATION_ROUTES = [
      '/api/generate',
      '/api/generate/worker',
      '/api/generate/cron/sweep',
      '/api/dev/generation/resume',
      '/api/debug/regen-page',
    ];
    // Payment / status / webhook routes never render — drop everything heavy.
    const LEAN_ROUTES = [
      '/api/orders',
      '/api/generate/status',
      '/api/payme/return',
      '/api/webhooks/payme',
      '/api/webhooks/stripe',
      '/api/dev/fake-payment/confirm',
    ];
    const excludes = {};
    for (const r of GENERATION_ROUTES) excludes[r] = [...MEDIA, ...HEADLESS, ...STORY_ASSETS];
    for (const r of LEAN_ROUTES) excludes[r] = [...MEDIA, ...HEADLESS, ...STORY_ASSETS, 'story-bank/**'];
    // dev story-bank browser lists the bank → keep story-bank, drop media/headless/companions/style-refs.
    excludes['/api/dev/story-bank'] = [...MEDIA, ...HEADLESS, ...STORY_ASSETS];
    return excludes;
  })(),
  /**
   * Legacy .html entry points and direct /public/HTML/*.html URLs -> canonical
   * paths. Query string is preserved by Next (not listed in destination).
   */
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/wizard.html', destination: '/wizard', permanent: true },
      { source: '/generating.html', destination: '/generating', permanent: true },
      { source: '/ready.html', destination: '/ready', permanent: true },
      { source: '/reader.html', destination: '/reader', permanent: true },
      { source: '/login.html', destination: '/login', permanent: true },
      { source: '/my-books.html', destination: '/my-books', permanent: true },
      { source: '/HTML/index.html', destination: '/', permanent: true },
      { source: '/HTML/wizard.html', destination: '/wizard', permanent: true },
      { source: '/HTML/generating.html', destination: '/generating', permanent: true },
      { source: '/HTML/ready.html', destination: '/ready', permanent: true },
      { source: '/HTML/reader.html', destination: '/reader', permanent: true },
      { source: '/HTML/login.html', destination: '/login', permanent: true },
      { source: '/HTML/my-books.html', destination: '/my-books', permanent: true },
    ];
  },
  async rewrites() {
    return {
      /**
       * beforeFiles: legacy HTML shells only where App Router has no matching page.
       * Rollback: restore `{ source: '/', destination: '/HTML/index.html' }` here
       * to revert to the legacy landing if the React port breaks.
       */
      beforeFiles: [],
      afterFiles: [
        { source: '/gate', destination: '/HTML/gate.html' },
        { source: '/wizard', destination: '/HTML/wizard.html' },
        { source: '/generating', destination: '/HTML/generating.html' },
        { source: '/ready', destination: '/HTML/ready.html' },
        { source: '/reader', destination: '/HTML/reader.html' },
        { source: '/login', destination: '/HTML/login.html' },
        { source: '/my-books', destination: '/HTML/my-books.html' },
      ],
    };
  },
};

module.exports = nextConfig;
