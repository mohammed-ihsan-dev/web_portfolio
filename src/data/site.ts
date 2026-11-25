/**
 * Central identity + copy. Every value below is a PLACEHOLDER.
 * Replace in place; nothing else in the codebase hardcodes personal details.
 */
import type { Capability, ExperienceEntry, NavItem, OffScreenItem, SocialLink } from '@/types/content';

export const person = {
  name: 'Your Name',
  firstName: 'Your',
  lastName: 'Name',
  initials: 'YN',
  role: 'Creative Developer',
  location: 'City, Country',
  timezoneLabel: 'GMT +0:00',
  email: 'hello@yourdomain.com',
  availability: {
    open: true,
    label: 'Available for new projects',
    detail: 'From Q1 — placeholder',
  },
} as const;

export const socials: SocialLink[] = [
  { label: 'GitHub', href: 'https://github.com/', handle: '@username' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/', handle: '/in/username' },
  { label: 'Instagram', href: 'https://www.instagram.com/', handle: '@username' },
];

export const navigation: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Work', href: '/work' },
  { label: 'About', href: '/about' },
  { label: 'Playground', href: '/playground' },
  { label: 'Contact', href: '/contact' },
];

export const hero = {
  headline: ['Building Experiences', 'Beyond the Ordinary.'],
  label: 'Creative Developer',
  intro:
    'Placeholder intro. I design and build interactive websites where motion, 3D and type carry the story. Replace with your own two lines.',
  annotation: ['That’s me,', 'shipping something.'],
  scrollCue: 'Scroll',
};

export const intro = {
  kicker: '(01) Hello',
  bio: 'Placeholder bio. A short paragraph about who you are, what you build and how you like to work. Keep it to three or four lines.',
  meta: [
    { label: 'Based in', value: person.location },
    { label: 'Focus', value: 'Interactive web' },
    { label: 'Status', value: 'Independent' },
  ],
  aboutCta: 'More about me',
};

export const expertise = {
  kicker: '(02) Expertise',
  titleTop: 'Creative',
  titleBottom: 'Developer.',
  paragraph:
    'Placeholder. One paragraph on how design and engineering meet in your work. Avoid listing tools here; the list on the right does that.',
  capabilities: [
    { title: 'Creative Web Development', description: 'Art-directed sites, built by hand.' },
    { title: 'Interactive Experiences', description: 'Scroll stories, motion systems, play.' },
    { title: 'Frontend Engineering', description: 'Typed, tested, fast in production.' },
    { title: 'WebGL & 3D', description: 'Three.js scenes that load quickly.' },
    { title: 'UI/UX Implementation', description: 'Pixel-faithful builds of real designs.' },
  ] satisfies Capability[],
  meta: ['Independent', 'Remote friendly', 'Placeholder meta'],
};

export const selectedWork = {
  kicker: '(03) Selected work',
  top: 'Selected',
  bottom: 'Work',
  note: 'Mock projects. Every title, image and description here is placeholder content.',
  cta: 'All work',
};

export const workspace = {
  kicker: '(04) Workspace',
  title: ['Where the', 'work happens.'],
  paragraph:
    'Placeholder. A few lines on your process, experiments and the tools you reach for. The character sits down here once the rigged model is in.',
  tools: ['TypeScript', 'React / Next.js', 'Three.js / R3F', 'GLSL', 'GSAP', 'Figma'],
  experiments: ['Shader sketches', 'Scroll prototypes', 'Type studies'],
};

export const offScreen = {
  kicker: '(05) Off the screen',
  title: ['Off the', 'Screen.'],
  paragraph: 'Placeholder. What you do when you’re not building — photographs, notes, side projects.',
  items: [
    {
      title: 'Photography',
      note: 'Placeholder frame. Replace with your own photo.',
      image: { src: '/images/offscreen/frame-01.webp', width: 1200, height: 1500, alt: 'Placeholder photograph, warm blurred light' },
    },
    {
      title: 'Sketchbook',
      note: 'Placeholder. Pages, studies, scraps.',
      image: { src: '/images/offscreen/frame-02.webp', width: 1400, height: 1000, alt: 'Placeholder image, soft grey gradient field' },
    },
    {
      title: 'Experiments',
      note: 'Placeholder. Small things made for fun.',
      image: { src: '/images/offscreen/frame-03.webp', width: 1000, height: 1250, alt: 'Placeholder image, pale green gradient with grain' },
    },
    {
      title: 'Elsewhere',
      note: 'Placeholder. Travel, walks, places.',
      image: { src: '/images/offscreen/frame-04.webp', width: 1500, height: 1000, alt: 'Placeholder image, dusk-coloured gradient' },
    },
  ] satisfies OffScreenItem[],
};

export const contact = {
  kicker: '(06) Contact',
  word: 'Hello',
  lead: 'Have a project in mind? Placeholder line — say hi.',
  copyLabel: 'Copy email',
  copiedLabel: 'Copied',
  backToTop: 'Back to top',
  /** Static on purpose: prerendered pages must not read the clock. */
  year: '2026',
};

export const about = {
  title: ['About'],
  statement:
    'Placeholder statement. One or two sentences that say what you make and why it matters to the people you make it for.',
  bio: [
    'Placeholder paragraph one. Background, how you got into building for the web, what kind of work you take on.',
    'Placeholder paragraph two. How you work with clients and teams, what they can expect, where you’re based.',
  ],
  experience: [
    { role: 'Role title', organisation: 'Studio / company name', period: '20XX — Present', note: 'Placeholder' },
    { role: 'Role title', organisation: 'Studio / company name', period: '20XX — 20XX', note: 'Placeholder' },
    { role: 'Role title', organisation: 'Studio / company name', period: '20XX — 20XX', note: 'Placeholder' },
  ] satisfies ExperienceEntry[],
  skills: {
    Build: ['TypeScript', 'React', 'Next.js', 'Node.js'],
    Motion: ['GSAP', 'ScrollTrigger', 'Lenis', 'CSS animation'],
    '3D': ['Three.js', 'React Three Fiber', 'GLSL', 'glTF pipelines'],
    Design: ['Figma', 'Typography', 'Interaction design'],
  } as Record<string, string[]>,
};

export const seo = {
  siteName: `${person.name} — ${person.role}`,
  titleTemplate: `%s — ${person.name}`,
  defaultTitle: `${person.name} — ${person.role}`,
  description:
    'Placeholder description. Portfolio of a creative developer building interactive, art-directed websites with WebGL and motion.',
  ogImage: { src: '/og.jpg', width: 1200, height: 630, alt: `${person.name}, ${person.role}` },
  pages: {
    work: { title: 'Work', description: 'Placeholder. Selected projects and case studies.' },
    about: { title: 'About', description: 'Placeholder. Background, experience and skills.' },
    playground: { title: 'Playground', description: 'Placeholder. Creative experiments and prototypes.' },
    contact: { title: 'Contact', description: 'Placeholder. Get in touch about a project.' },
  },
};
