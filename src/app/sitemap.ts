import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/config/site.config';
import { projects } from '@/data/projects';

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ['', '/work', '/about', '/contact'].map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: 'monthly' as const,
    priority: path === '' ? 1 : 0.7,
  }));
  const work = projects.map((p) => ({
    url: `${SITE_URL}/work/${p.slug}`,
    changeFrequency: 'yearly' as const,
    priority: 0.6,
  }));
  return [...pages, ...work];
}
