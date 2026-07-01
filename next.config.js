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
  /**
   * Bundle backend fonts + story-bank text + the Style01 reference subset into the functions that
   * read them from disk at runtime (0086 fix). resolveStyle01StyleReferencePaths() returns disk paths
   * under style-references/01 and the image loader does existsSync()->readFileSync() (NO URL fallback),
   * so these MUST be on the function disk in prod. Only the Style01 subset (style-references/01 ~24MB +
   * 01-child-template ~4MB) is bundled — Style02 (~49MB) stays excluded.
   */
  outputFileTracingIncludes: (() => {
    const STYLE01_REFS = ['./style-references/01/**/*', './style-references/01-child-template/**/*'];
    // (#35) The Style01 multi-view companion sheets (public/companions/<id>/style01-sheets/**) have NO URL fallback:
    // resolveStyle01CompanionReferencePaths() does existsSync()->readFileSync() on the FUNCTION disk. Bundle them
    // into the render functions so the strong multi-view anchor is reachable in serverless (~49 files: 42 png + 7
    // manifest.json). The exclude below is narrowed to public/companions/**/*.jpg so it can't strip these (Next 15
    // applies excludes AFTER includes to the combined set — an exclude that matched these would delete them).
    const STYLE01_COMPANION_SHEETS = ['./public/companions/*/style01-sheets/**/*'];
    const includes = {
      '/api/generate': ['./backend/assets/fonts/**/*', './story-bank/**/*', ...STYLE01_REFS, ...STYLE01_COMPANION_SHEETS],
      '/api/generate/worker': ['./story-bank/**/*', ...STYLE01_REFS, ...STYLE01_COMPANION_SHEETS],
      '/api/generate/cron/sweep': ['./story-bank/**/*', ...STYLE01_REFS, ...STYLE01_COMPANION_SHEETS],
      '/api/dev/generation/resume': ['./story-bank/**/*', ...STYLE01_REFS, ...STYLE01_COMPANION_SHEETS],
      '/api/debug/regen-page': ['./story-bank/**/*', ...STYLE01_REFS, ...STYLE01_COMPANION_SHEETS],
      '/api/orders/[orderId]/power-card': ['./story-bank/**/*', './node_modules/@sparticuz/chromium/**/*'],
    };
    return includes;
  })(),
  /**
   * Keep serverless functions under Vercel's 250MB cap (Goal A / 0083; 0086 ref-load fix).
   * Real size offenders (route-specific): ffmpeg+ffprobe (used ONLY by backend/providers/video.ts →
   * /api/orders/[orderId]/video) and @sparticuz/chromium (used ONLY by the power-card PDF route).
   * Those stay excluded everywhere else. public/companions (~90MB) is excluded from the functions but
   * remains CDN-served from /public — companion refs resolve to a CDN URL via mergeGptImageReferenceSources
   * (baseUrl passed in /api/generate), so the render fetches them by URL. Style01 refs are bundled on
   * disk (see outputFileTracingIncludes) because they have NO URL fallback; only Style02 is excluded.
   * NOTE: /api/generate imports video via a dynamic, optional, non-fatal `if (order.videoEnabled)`
   * branch — excluding ffmpeg there only makes that optional video stage a no-op (caught + logged).
   */
  outputFileTracingExcludes: (() => {
    const MEDIA = ['node_modules/@ffmpeg-installer/**', 'node_modules/@ffprobe-installer/**'];
    const HEADLESS = ['node_modules/@sparticuz/chromium/**', 'node_modules/puppeteer-core/**'];
    const COMPANIONS = ['public/companions/**']; // CDN-served; companion refs fetched by URL in prod
    // (#35) Render routes bundle the Style01 companion sheets on disk (see outputFileTracingIncludes) — those are
    // .png + manifest.json with NO URL fallback. Exclude ONLY the raw .jpg source refs (CDN-served by URL) so the
    // exclude can't strip the sheets (Next 15 applies excludes to the combined set AFTER includes). Every non-sheet
    // companion file is a .jpg; the sheets are .png/.json, so this narrowing is exact.
    const COMPANIONS_SOURCE_JPGS = ['public/companions/**/*.jpg'];
    const STYLE02 = ['style-references/02/**', 'style-references/style-02-locked-samples/**']; // not used by Style01
    const ALL_STYLE = ['style-references/**'];
    // Generation routes: keep Style01 refs (bundled via includes) + story-bank; drop media/headless +
    // companions (CDN) + Style02.
    const GENERATION_ROUTES = [
      '/api/generate',
      '/api/generate/worker',
      '/api/generate/cron/sweep',
      '/api/dev/generation/resume',
      '/api/debug/regen-page',
    ];
    // Payment / status / webhook routes never render — drop every asset + heavy dep.
    const LEAN_ROUTES = [
      '/api/orders',
      '/api/generate/status',
      '/api/payme/return',
      '/api/webhooks/payme',
      '/api/webhooks/stripe',
      '/api/dev/fake-payment/confirm',
    ];
    const excludes = {};
    // Generation/render routes: keep the bundled Style01 companion sheets (.png/.json) but still drop the raw .jpg
    // companion source refs (CDN-served) + media/headless + Style02.
    for (const r of GENERATION_ROUTES) excludes[r] = [...MEDIA, ...HEADLESS, ...COMPANIONS_SOURCE_JPGS, ...STYLE02];
    for (const r of LEAN_ROUTES) excludes[r] = [...MEDIA, ...HEADLESS, ...COMPANIONS, ...ALL_STYLE, 'story-bank/**'];
    // dev story-bank browser lists the bank → keep story-bank, drop media/headless/companions/all-style.
    excludes['/api/dev/story-bank'] = [...MEDIA, ...HEADLESS, ...COMPANIONS, ...ALL_STYLE];
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
        { source: '/ready', destination: '/HTML/ready.html' },
        { source: '/reader', destination: '/HTML/reader.html' },
        { source: '/login', destination: '/HTML/login.html' },
      ],
    };
  },
};

module.exports = nextConfig;
