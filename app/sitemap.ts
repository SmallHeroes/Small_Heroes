import type { MetadataRoute } from 'next';

const BASE = 'https://smallheroes.co.il';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/start`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/terms`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/accessibility`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
