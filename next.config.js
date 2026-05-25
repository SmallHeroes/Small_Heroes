/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: '/wizard.html', destination: '/wizard', permanent: false },
      { source: '/directions.html', destination: '/directions', permanent: false },
      { source: '/generating.html', destination: '/generating', permanent: false },
      { source: '/ready.html', destination: '/ready', permanent: false },
    ];
  },
  async rewrites() {
    return {
      /**
       * beforeFiles: run before the App Router matches "/". Without this,
       * app/page.tsx handles "/" and returns null (blank white screen) while
       * the "/" → legacy HTML rewrite never takes effect.
       *
       * afterFiles: map root-level .html paths into public/HTML/ (same as before).
       */
      beforeFiles: [
        { source: '/', destination: '/HTML/index.html' },
        { source: '/wizard', destination: '/HTML/wizard.html' },
        { source: '/directions', destination: '/HTML/directions.html' },
        { source: '/generating', destination: '/HTML/generating.html' },
        { source: '/ready', destination: '/HTML/ready.html' },
      ],
      afterFiles: [
        { source: '/reader.html',     destination: '/HTML/reader.html'     },
      ],
    };
  },
};

module.exports = nextConfig;
