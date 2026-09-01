import type { MetadataRoute } from 'next';

/* Marketing pages are crawlable; the account area, admin, dev sandboxes
   and APIs are not. QA stays behind Vercel SSO, so this only matters on
   the production domain. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/dev/', '/my-books', '/generating', '/book/'],
      },
    ],
    sitemap: 'https://smallheroes.co.il/sitemap.xml',
  };
}
