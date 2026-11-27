/**
 * Central identity + copy. Edit in place; nothing else in the codebase
 * hardcodes personal details.
 */
import type { Capability, ExperienceEntry, NavItem, OffScreenItem, SocialLink } from '@/types/content';

export const person = {
  name: 'Mohammed Ihsan',
  displayName: 'Ihsan',
  firstName: 'Mohammed',
  lastName: 'Ihsan',
  initials: 'MI',
  /** Short title for tight UI (header, preloader); `title` is the full one. */
  role: 'Creative Web Developer',
  title: 'Creative Web Developer & Full Stack MERN Developer',
  location: 'Kerala, India',
  locationFull: 'Mannarkkad, Palakkad, Kerala, India',
  timezoneLabel: 'IST, GMT +5:30',
  email: 'mohammed.ihsan.dev@gmail.com',
  phone: { label: '+91 85906 98873', href: 'tel:+918590698873' },
  availability: {
    open: true,
    label: 'Open to work',
  },
} as const;

export const socials: SocialLink[] = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/itsihsaney', handle: '/in/itsihsaney' },
  { label: 'GitHub', href: 'https://github.com/mohammed-ihsan-dev', handle: '@mohammed-ihsan-dev' },
];

export const navigation: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Work', href: '/work' },
  { label: 'About', href: '/about' },
  // Playground (/playground) is hidden until there are real experiments to show.
  { label: 'Contact', href: '/contact' },
];

export const hero = {
  headline: ['Building Experiences', 'Beyond the Ordinary.'],
  label: person.role,
  intro:
    'Creative Web Developer and Full Stack MERN Developer in Kerala, India — building interactive websites and scalable web applications where creative design meets efficient engineering.',
  annotation: ['That’s me,', 'shipping something.'],
  scrollCue: 'Scroll',
};

export const intro = {
  kicker: `(01) ${person.name}`,
  bio: 'I build modern websites, interactive digital experiences and scalable web applications. Currently a Web Developer at Zorx Interactive Agency, I bring frontend creativity and backend functionality together — responsive, visually engaging and fast.',
  meta: [
    { label: 'Based in', value: person.location },
    { label: 'Focus', value: 'Creative web · MERN' },
    { label: 'Currently', value: 'Zorx Interactive Agency' },
  ],
  aboutCta: 'More about me',
};

export const expertise = {
  kicker: '(02) What I do',
  titleTop: 'Creative',
  titleBottom: 'Developer.',
  paragraph: 'Where creativity meets code.',
  capabilities: [
    { title: 'Creative Web Development', description: 'Interactive, visually engaging websites with modern web technologies.' },
    { title: 'Frontend Development', description: 'Responsive, accessible, high-performance user interfaces.' },
    { title: 'Full Stack Development', description: 'Scalable web applications on the MERN stack.' },
    { title: 'Interactive Web Experiences', description: 'Scroll-driven animation, cinematic transitions, immersive experiences.' },
    { title: 'Website Optimization', description: 'Performance, responsiveness, SEO architecture and usability.' },
    { title: 'Cloud & Deployment', description: 'Deploying and maintaining production-ready web applications.' },
  ] satisfies Capability[],
  meta: [person.location, 'MERN stack', 'Web Developer at Zorx'],
};

export const selectedWork = {
  kicker: '(03) Selected work',
  top: 'Selected',
  bottom: 'Work',
  note: 'Live client projects — corporate, hospitality and e-learning.',
  cta: 'All work',
};

export const workspace = {
  kicker: '(04) Workspace',
  title: ['Where the', 'work happens.'],
  paragraph: 'Where creativity meets code: React and Next.js on the front, Node.js, Express and MongoDB behind, deployed to AWS and Vercel.',
  lists: [
    { label: 'Stack', items: ['React.js / Next.js', 'TypeScript', 'Node.js / Express.js', 'MongoDB', 'Tailwind CSS', 'AWS EC2 / Nginx'] },
    { label: 'Tools', items: ['Git / GitHub', 'VS Code', 'Postman', 'Figma', 'Vercel'] },
  ],
};

export const offScreen = {
  kicker: '(05) Off the screen',
  title: ['Off the', 'Screen.'],
  paragraph: 'Beyond client work: community, languages and learning.',
  items: [
    {
      title: 'National Service Scheme',
      note: 'Volunteer, June 2023 – March 2025. Community development, social service and awareness initiatives.',
      image: { src: '/images/offscreen/frame-01.webp', width: 1200, height: 1500, alt: 'Abstract artwork, warm blurred light' },
    },
    {
      title: 'Languages',
      note: 'Malayalam (native), English (professional), Arabic (intermediate).',
      image: { src: '/images/offscreen/frame-02.webp', width: 1400, height: 1000, alt: 'Abstract artwork, soft grey gradient field' },
    },
    {
      title: 'Education',
      note: 'Bachelor of Computer Applications, IGNOU — August 2025 – August 2028, currently pursuing.',
      image: { src: '/images/offscreen/frame-03.webp', width: 1000, height: 1250, alt: 'Abstract artwork, pale green gradient with grain' },
    },
    {
      title: 'Always exploring',
      note: 'Modern web technologies and creative development — motion, 3D and scroll storytelling.',
      image: { src: '/images/offscreen/frame-04.webp', width: 1500, height: 1000, alt: 'Abstract artwork, dusk-coloured gradient' },
    },
  ] satisfies OffScreenItem[],
};

export const contact = {
  kicker: '(06) Contact',
  word: 'Hello',
  lead: 'Have an idea? Let’s turn it into an extraordinary digital experience.',
  heading: 'Open to work.',
  talkLabel: 'Let’s talk',
  copyLabel: 'Copy email',
  copiedLabel: 'Copied',
  backToTop: 'Back to top',
  credit: 'Designed & Developed with Creativity.',
  /** Static on purpose: prerendered pages must not read the clock. */
  year: '2026',
};

export const about = {
  title: ['About'],
  statement:
    'I’m Mohammed Ihsan — a Creative Web Developer and Full Stack MERN Developer building modern websites, interactive experiences and scalable web applications.',
  bio: [
    'I specialise in work that combines creative design with efficient engineering. As a Web Developer at Zorx Interactive Agency, I build responsive, visually engaging and performance-driven websites for business clients.',
    'With a background in full-stack development, I bring frontend creativity and backend functionality together. I’m pursuing a Bachelor of Computer Applications at IGNOU while continuing to explore modern web technologies and creative development.',
  ],
  experience: [
    {
      role: 'Web Developer',
      organisation: 'Zorx Interactive Agency',
      period: 'Sep 2026 — Present',
      location: 'Mannarkkad, Palakkad, Kerala',
      note: 'Current',
      highlights: [
        'Develop modern, responsive websites for business clients.',
        'Build interactive and creative digital experiences.',
        'Collaborate with branding, design and marketing teams.',
        'Optimise website performance, responsiveness and SEO.',
        'Manage deployment and technical maintenance.',
        'Translate creative concepts into functional websites.',
      ],
    },
    {
      role: 'Software Developer Intern',
      organisation: 'Bridgeon Solutions',
      period: 'Jul 2025 — Aug 2026',
      location: 'Calicut, Kerala',
      note: '',
      highlights: [
        'Developed responsive web applications with React.js and TypeScript.',
        'Created reusable, scalable UI components.',
        'Integrated RESTful APIs and backend services.',
        'Collaborated on backend development with Node.js and Express.js.',
        'Improved application performance and cross-device usability.',
      ],
    },
  ] satisfies ExperienceEntry[],
  education: [{ title: 'Bachelor of Computer Applications (BCA)', place: 'Indira Gandhi National Open University (IGNOU)', period: 'Aug 2025 — Aug 2028', note: 'Currently pursuing' }],
  volunteering: [{ title: 'Volunteer', place: 'National Service Scheme (NSS)', period: 'Jun 2023 — Mar 2025', note: 'Community development, social service, awareness initiatives and collaborative volunteer activities.' }],
  languages: [
    { name: 'Malayalam', level: 'Native' },
    { name: 'English', level: 'Professional' },
    { name: 'Arabic', level: 'Intermediate' },
  ],
  skills: {
    Frontend: ['HTML5', 'CSS3', 'JavaScript', 'TypeScript', 'React.js', 'Next.js', 'Tailwind CSS', 'Bootstrap', 'Zustand'],
    Backend: ['Node.js', 'Express.js', 'MongoDB', 'REST APIs', 'JWT authentication', 'MVC architecture'],
    'Cloud & deployment': ['AWS EC2', 'Nginx', 'Firebase', 'Vercel'],
    Tools: ['Git', 'GitHub', 'VS Code', 'Postman', 'Figma'],
    'Core capabilities': ['MERN stack development', 'Responsive web design', 'API integration', 'State management', 'Performance optimisation', 'SEO-friendly development', 'Agile / Scrum'],
  } as Record<string, string[]>,
};

export const seo = {
  siteName: `${person.name} — ${person.role}`,
  titleTemplate: `%s — ${person.name}`,
  defaultTitle: `${person.name} — ${person.title}`,
  description:
    'Mohammed Ihsan is a Creative Web Developer and Full Stack MERN Developer in Kerala, India, building interactive websites and scalable web applications.',
  ogImage: { src: '/og.jpg', width: 1200, height: 630, alt: `${person.name}, ${person.role}` },
  pages: {
    work: { title: 'Work', description: 'Selected client projects by Mohammed Ihsan: corporate, hospitality and e-learning websites.' },
    about: { title: 'About', description: 'Mohammed Ihsan — experience, skills, education and languages.' },
    playground: { title: 'Playground', description: 'Creative experiments and prototypes.' },
    contact: { title: 'Contact', description: 'Get in touch with Mohammed Ihsan about a website or web application.' },
  },
};
