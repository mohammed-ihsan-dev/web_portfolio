import type { Metadata } from 'next';
import { Suspense } from 'react';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { SITE_URL } from '@/config/site.config';
import { getAdjacentProject, getProject, projects } from '@/data/projects';
import { person } from '@/data/site';
import { TransitionLink } from '@/components/transitions/TransitionLink';
import { ArrowIcon } from '@/components/ui/ArrowIcon';
import { JsonLd } from '@/components/layout/JsonLd';
import { SiteFooter } from '@/components/layout/SiteFooter';
import styles from './project.module.css';

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<'/work/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};
  return {
    title: project.title,
    description: project.summary,
    alternates: { canonical: `/work/${project.slug}` },
    openGraph: {
      title: project.title,
      description: project.summary,
      url: `/work/${project.slug}`,
      images: [{ url: project.cover.src, width: project.cover.width, height: project.cover.height, alt: project.cover.alt }],
    },
  };
}

/**
 * `params` is awaited inside <Suspense> (Cache Components + Partial Prefetching):
 * listed slugs are still fully prerendered; unlisted ones get the shell instantly.
 */
export default function ProjectPage({ params }: PageProps<'/work/[slug]'>) {
  return (
    <Suspense fallback={<ProjectShell />}>
      <ProjectContent params={params} />
    </Suspense>
  );
}

function ProjectShell() {
  return (
    <div className={styles.article} aria-busy="true">
      <div className={styles.head}>
        <p className="mono muted">Loading project…</p>
      </div>
      <div className={styles.hero} />
    </div>
  );
}

async function ProjectContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();
  const index = projects.findIndex((p) => p.slug === slug);
  const next = getAdjacentProject(slug);

  return (
    <article data-page={`/work/${slug}`} className={styles.article}>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CreativeWork',
          name: project.title,
          description: project.summary,
          genre: project.category,
          ...(project.year ? { dateCreated: project.year } : {}),
          url: `${SITE_URL}/work/${project.slug}`,
          image: `${SITE_URL}${project.cover.src}`,
          creator: { '@type': 'Person', name: person.name, url: SITE_URL },
        }}
      />
      <header className={styles.head}>
        <TransitionLink href="/work" className={`small ${styles.back}`} transitionLabel="Work">
          <ArrowIcon direction="left" /> All work
        </TransitionLink>
        <p className={`mono ${styles.kicker}`}>
          ({String(index + 1).padStart(2, '0')}) — {project.category}
        </p>
        <h1 className={styles.title}>
          <span data-reveal="chars">{project.title}</span>
        </h1>
        {project.placeholder && <p className={`mono ${styles.tag}`}>Mock case study — placeholder content</p>}
        <dl className={`mono ${styles.meta}`}>
          <div>
            <dt>Client</dt>
            <dd>{project.client}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{project.role}</dd>
          </div>
          {project.location && (
            <div>
              <dt>Location</dt>
              <dd>{project.location}</dd>
            </div>
          )}
          <div>
            <dt>{project.year ? 'Year' : 'Type'}</dt>
            <dd>{project.year ?? project.type}</dd>
          </div>
          {project.stack.length > 0 && (
            <div>
              <dt>Stack</dt>
              <dd>{project.stack.join(', ')}</dd>
            </div>
          )}
        </dl>
      </header>

      <figure className={styles.hero}>
        <Image
          src={project.cover.src}
          alt={project.cover.alt}
          width={project.cover.width}
          height={project.cover.height}
          sizes="100vw"
          loading="eager"
          fetchPriority="high"
          data-flip-target={project.slug}
          className={styles.heroImg}
        />
      </figure>

      <section className={styles.body} aria-label="Overview">
        <p className={`lead ${styles.summary}`} data-reveal="lines">
          {project.summary}
        </p>
        <div className={styles.text}>
          {project.description.map((para) => (
            <p key={para} className="small" data-reveal="lines">
              {para}
            </p>
          ))}
          {project.highlights && project.highlights.length > 0 && (
            <ul className={`small ${styles.highlights}`} aria-label="Highlights" data-reveal="fade">
              {project.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          )}
          {project.liveUrl && (
            <a href={project.liveUrl} target="_blank" rel="noreferrer noopener" className={`small ${styles.live}`}>
              Visit live site <ArrowIcon />
            </a>
          )}
        </div>
      </section>

      <section className={styles.gallery} aria-label="Gallery">
        {project.gallery.map((img, i) => (
          <figure key={img.src} className={styles.shot} data-i={i}>
            <div className={styles.shotMedia} data-reveal="image">
              <Image src={img.src} alt={img.alt} width={img.width} height={img.height} sizes="(min-width: 1024px) 50vw, 100vw" />
            </div>
          </figure>
        ))}
      </section>

      <TransitionLink href={`/work/${next.slug}`} className={styles.next} flipId={next.slug} transitionLabel={next.title}>
        <span className="mono muted">Next project</span>
        <span className={styles.nextTitle}>
          {next.title} <ArrowIcon />
        </span>
        <span className={styles.nextThumb}>
          <Image src={next.cover.src} alt="" width={next.cover.width} height={next.cover.height} sizes="30vw" data-flip-source={next.slug} />
        </span>
      </TransitionLink>
      <SiteFooter />
    </article>
  );
}
