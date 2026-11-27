/**
 * Selected work. Slugs drive /work/[slug] and the sitemap. Images are
 * screenshots of the live sites (owner-authorised), captured and optimised by
 * scripts/capture-projects.mjs — `npm run assets:projects` refreshes them.
 */
import type { Experiment, Project } from '@/types/content';

const cover = (slug: string, title: string, w = 2000, h = 1250) => ({
  src: `/images/projects/${slug}/cover.webp`,
  width: w,
  height: h,
  alt: `${title} website — ${w > h ? 'homepage on desktop' : 'homepage on a phone'}`,
});
const shot = (slug: string, title: string, n: number, w = 1600, h = 1000, alt?: string) => ({
  src: `/images/projects/${slug}/shot-${n}.webp`,
  width: w,
  height: h,
  alt: alt ?? `${title} website — ${n === 1 ? 'a section further down the homepage on desktop' : 'the site on a phone'}`,
});

export const projects: Project[] = [
  {
    slug: 'halima-trading',
    title: 'Halima Trading',
    category: 'Corporate Website',
    type: 'Live client project',
    role: 'Web Developer',
    client: 'Halima Trading',
    summary: 'A professional corporate website presenting the company’s brand, business offerings and online presence through a clean, responsive experience.',
    description: [
      'A corporate website focused on the company’s brand and what it offers, built to give the business a clear and credible online presence.',
      'The build centres on a responsive layout that works across devices, brand-focused presentation, straightforward navigation and good performance.',
    ],
    highlights: ['Corporate website development', 'Responsive design', 'Brand-focused digital experience', 'Website performance', 'User-friendly navigation'],
    stack: [],
    liveUrl: 'https://halimatrading.com/',
    cover: cover('halima-trading', 'Halima Trading'),
    gallery: [shot('halima-trading', 'Halima Trading', 1), shot('halima-trading', 'Halima Trading', 2, 1200, 1500)],
    layout: 'wide',
    placeholder: false,
  },
  {
    slug: 'press-d-cafe',
    title: 'PRESS D Cafe',
    category: 'Food & Beverage / Hospitality',
    type: 'Live client project',
    role: 'Web Developer',
    client: 'PRESS D Cafe',
    location: 'Dubai, UAE',
    summary: 'A modern, brand-focused cafe website: an engaging digital experience that stays responsive, usable and easy for search engines to find.',
    description: [
      'A website for a cafe in Dubai that puts the brand first while keeping the experience fast and simple to use on any device.',
      'Built with Next.js and deployed on Vercel, with an SEO-friendly structure — metadata and sitemap included — and attention to performance.',
    ],
    highlights: ['Responsive website development', 'Brand-focused user interface', 'SEO-friendly architecture', 'Metadata and sitemap integration', 'Performance optimisation', 'Production deployment'],
    stack: ['Next.js', 'React.js', 'Vercel'],
    liveUrl: 'https://www.pressdcafe.ae/',
    cover: cover('press-d-cafe', 'PRESS D Cafe', 1500, 1875),
    gallery: [shot('press-d-cafe', 'PRESS D Cafe', 1), shot('press-d-cafe', 'PRESS D Cafe', 2, 1200, 1500, 'PRESS D Cafe website — the journal page on a phone')],
    layout: 'tall',
    placeholder: false,
  },
  {
    slug: 'zinda-learn',
    title: 'Zinda Learn',
    category: 'EdTech / E-Learning Platform',
    type: 'Live client project',
    role: 'Full Stack Developer',
    client: 'Zinda Learn',
    summary: 'A full-stack e-learning platform giving students, instructors and administrators a structured learning experience with role-based access and course management.',
    description: [
      'An e-learning platform with separate dashboards for administrators, instructors and students, covering course management, enrolment and progress tracking.',
      'Built end to end: a React and TypeScript frontend, a Node.js / Express REST API with JWT authentication and role-based authorisation on MongoDB, deployed on AWS EC2 behind an Nginx reverse proxy.',
    ],
    highlights: [
      'Role-based authentication and authorisation',
      'Admin, instructor and student dashboards',
      'Course management',
      'Student enrolment',
      'Learning progress tracking',
      'RESTful API development',
      'JWT authentication',
      'AWS cloud deployment',
      'Nginx reverse proxy',
    ],
    stack: ['React.js', 'TypeScript', 'Node.js', 'Express.js', 'MongoDB', 'JWT', 'AWS EC2', 'Nginx'],
    liveUrl: 'https://zinda-learn.com/',
    cover: cover('zinda-learn', 'Zinda Learn', 1800, 1350),
    gallery: [shot('zinda-learn', 'Zinda Learn', 1), shot('zinda-learn', 'Zinda Learn', 2, 1200, 1500)],
    layout: 'medium',
    placeholder: false,
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
