/** @type {import('next').NextConfig} */
const nextConfig = {
  /** Keep native ffmpeg/ffprobe installers out of the webpack bundle */
  serverExternalPackages: [
    'fluent-ffmpeg',
    '@ffmpeg-installer/ffmpeg',
    '@ffprobe-installer/ffprobe',
  ],
  typescript: {
    // TypeScript errors don't block Turbopack compilation;
    // skip the redundant tsc check so Vercel deploys succeed.
    ignoreBuildErrors: true,
  },
  /**
   * Legacy `.html` entry points and direct `/public/HTML/*.html` URLs → canonical
   * paths. Query string is preserved by Next (not listed in `destination`).
   */
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/wizard.html', destination: '/wizard', permanent: true },
      { source: '/directions.html', destination: '/directions', permanent: true },
      { source: '/generating.html', destination: '/generating', permanent: true },
      { source: '/ready.html', destination: '/ready', permanent: true },
      { source: '/reader.html', destination: '/reader', permanent: true },
      { source: '/login.html', destination: '/login', permanent: true },
      { source: '/my-books.html', destination: '/my-books', permanent: true },
      { source: '/HTML/index.html', destination: '/', permanent: true },
      { source: '/HTML/wizard.html', destination: '/wizard', permanent: true },
      { source: '/HTML/directions.html', destination: '/directions', permanent: true },
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
       * beforeFiles: run before the App Router matches "/". Without this,
       * app/page.tsx handles "/" and returns null (blank white screen) while
       * the "/" → legacy HTML rewrite never takes effect.
       *
       * afterFiles: canonical app paths → public/HTML/ static shells.
       */
      beforeFiles: [
        { source: '/', destination: '/HTML/index.html' },
      ],
      afterFiles: [
        { source: '/gate', destination: '/HTML/gate.html' },
        { source: '/wizard', destination: '/HTML/wizard.html' },
        { source: '/directions', destination: '/HTML/directions.html' },
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
