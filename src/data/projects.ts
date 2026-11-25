/**
 * MOCK PROJECTS. Titles are neutral codenames, clients are placeholders and the
 * imagery is generated abstract artwork (scripts/generate-placeholders.mjs).
 * Replace entries 1:1; slugs drive /work/[slug] and the sitemap.
 */
import type { Experiment, Project } from '@/types/content';

const cover = (slug: string, w = 2000, h = 1250) => ({
  src: `/images/projects/${slug}/cover.webp`,
  width: w,
  height: h,
  alt: `Placeholder cover artwork for the mock project “${slug}”`,
});
const shot = (slug: string, n: number, w = 1600, h = 1000) => ({
  src: `/images/projects/${slug}/shot-${n}.webp`,
  width: w,
  height: h,
  alt: `Placeholder detail image ${n} for the mock project “${slug}”`,
});

const body = [
  'Placeholder overview. Describe the problem, who it was for and what success looked like. Two or three sentences.',
  'Placeholder approach. What you designed, what you built, which technical decisions mattered and why.',
  'Placeholder outcome. What shipped and what changed afterwards. Only include results you can support.',
];

export const projects: Project[] = [
  {
    slug: 'northbound',
    title: 'Northbound',
    category: 'WebGL Experience',
    role: 'Design & Development',
    year: '2026',
    client: 'Client name (placeholder)',
    summary: 'Mock project. A scroll-driven 3D story for a product launch.',
    description: body,
    stack: ['Next.js', 'Three.js', 'GSAP'],
    cover: cover('northbound'),
    gallery: [shot('northbound', 1), shot('northbound', 2, 1200, 1500)],
    layout: 'wide',
    placeholder: true,
  },
  {
    slug: 'paper-atlas',
    title: 'Paper Atlas',
    category: 'Editorial Website',
    role: 'Development',
    year: '2026',
    client: 'Client name (placeholder)',
    summary: 'Mock project. A long-form editorial site with a custom reading grid.',
    description: body,
    stack: ['Next.js', 'MDX', 'CSS'],
    cover: cover('paper-atlas', 1500, 1875),
    gallery: [shot('paper-atlas', 1), shot('paper-atlas', 2, 1200, 1500)],
    layout: 'tall',
    placeholder: true,
  },
  {
    slug: 'soft-machines',
    title: 'Soft Machines',
    category: 'Interactive Installation',
    role: 'Creative Development',
    year: '2025',
    client: 'Client name (placeholder)',
    summary: 'Mock project. A browser-based installation driven by pointer and sound.',
    description: body,
    stack: ['WebGL', 'GLSL', 'Web Audio'],
    cover: cover('soft-machines', 1800, 1350),
    gallery: [shot('soft-machines', 1), shot('soft-machines', 2, 1200, 1500)],
    layout: 'medium',
    placeholder: true,
  },
  {
    slug: 'field-studio',
    title: 'Field Studio',
    category: 'Brand Platform',
    role: 'Design & Development',
    year: '2025',
    client: 'Client name (placeholder)',
    summary: 'Mock project. A modular brand site and component system.',
    description: body,
    stack: ['React', 'TypeScript', 'Storybook'],
    cover: cover('field-studio', 1400, 1400),
    gallery: [shot('field-studio', 1), shot('field-studio', 2, 1200, 1500)],
    layout: 'small',
    placeholder: true,
  },
  {
    slug: 'low-orbit',
    title: 'Low Orbit',
    category: 'Product Website',
    role: 'Frontend Lead',
    year: '2024',
    client: 'Client name (placeholder)',
    summary: 'Mock project. A product site with real-time 3D configurator.',
    description: body,
    stack: ['Next.js', 'R3F', 'Lenis'],
    cover: cover('low-orbit'),
    gallery: [shot('low-orbit', 1), shot('low-orbit', 2, 1200, 1500)],
    layout: 'wide',
    placeholder: true,
  },
  {
    slug: 'quiet-index',
    title: 'Quiet Index',
    category: 'E-commerce',
    role: 'Development',
    year: '2024',
    client: 'Client name (placeholder)',
    summary: 'Mock project. A slow, typographic online store.',
    description: body,
    stack: ['Shopify Hydrogen', 'React', 'GSAP'],
    cover: cover('quiet-index', 1500, 1875),
    gallery: [shot('quiet-index', 1), shot('quiet-index', 2, 1200, 1500)],
    layout: 'tall',
    placeholder: true,
  },
];

export const featuredProjects = projects.slice(0, 4);

export function getProject(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

export function getAdjacentProject(slug: string): Project {
  const i = projects.findIndex((p) => p.slug === slug);
  return projects[(i + 1) % projects.length];
}

export const experiments: Experiment[] = [
  { slug: 'ring-field', title: 'Ring Field', medium: 'GLSL', year: '2026', span: 'wide', image: { src: '/images/playground/exp-01.webp', width: 1600, height: 1000, alt: 'Placeholder experiment: concentric rings' } },
  { slug: 'dot-weather', title: 'Dot Weather', medium: 'Canvas 2D', year: '2026', span: 'tall', image: { src: '/images/playground/exp-02.webp', width: 1000, height: 1300, alt: 'Placeholder experiment: dot grid' } },
  { slug: 'type-orbit', title: 'Type Orbit', medium: 'Three.js', year: '2025', span: 'square', image: { src: '/images/playground/exp-03.webp', width: 1200, height: 1200, alt: 'Placeholder experiment: orbiting lines' } },
  { slug: 'line-tide', title: 'Line Tide', medium: 'SVG', year: '2025', span: 'square', image: { src: '/images/playground/exp-04.webp', width: 1200, height: 1200, alt: 'Placeholder experiment: wave lines' } },
  { slug: 'grain-study', title: 'Grain Study', medium: 'GLSL', year: '2025', span: 'tall', image: { src: '/images/playground/exp-05.webp', width: 1000, height: 1300, alt: 'Placeholder experiment: grain gradient' } },
  { slug: 'soft-grid', title: 'Soft Grid', medium: 'CSS', year: '2024', span: 'wide', image: { src: '/images/playground/exp-06.webp', width: 1600, height: 1000, alt: 'Placeholder experiment: soft grid' } },
];
