import Image from 'next/image';
import { featuredProjects } from '@/data/projects';
import { contact, expertise, hero, person, socials } from '@/data/site';
import { characterConfig } from '@/config/character.config';
import { TransitionLink } from '@/components/transitions/TransitionLink';
import { CopyEmail } from '@/components/ui/CopyEmail';
import { ArrowIcon } from '@/components/ui/ArrowIcon';
import styles from './MobileHome.module.css';

/**
 * Lightweight mobile/tablet foundation. No WebGL, no GSAP, no Lenis, no
 * pinned scenes — just the content and one optimised character image.
 * The final mobile design is a later phase.
 */
export function MobileHome() {
  return (
    <div className={styles.root}>
      <section className={styles.hero} aria-labelledby="m-hero-title">
        <p className="mono muted">{person.role}</p>
        {/* Oversized display name; the heading still reads as the full name. */}
        <h1 id="m-hero-title" className={styles.name}>
          <span className="sr-only">{person.firstName} </span>
          {person.displayName}
        </h1>
        <div className={styles.figure}>
          <div className={styles.sky} aria-hidden="true" />
          <Image
            src={characterConfig.placeholder.src}
            alt={`${person.name}, illustrated in a grey hoodie, black trousers and white sneakers`}
            width={600}
            height={1400}
            sizes="(max-width: 1023px) 62vw, 1px"
            preload
            loading="eager"
            fetchPriority="high"
            className={styles.character}
          />
        </div>
        <p className={styles.headline}>{hero.headline.join(' ')}</p>
        <p className="small">{hero.intro}</p>
      </section>

      <section className={styles.block} aria-labelledby="m-expertise">
        <h2 id="m-expertise" className={styles.h2}>
          {expertise.titleTop} {expertise.titleBottom}
        </h2>
        <ol className={styles.caps}>
          {expertise.capabilities.map((c, i) => (
            <li key={c.title}>
              <span className="mono muted">{String(i + 1).padStart(2, '0')}</span>
              <span>{c.title}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.block} aria-labelledby="m-work">
        <h2 id="m-work" className={styles.h2}>
          Selected Work
        </h2>
        <ul className={styles.projects}>
          {featuredProjects.map((p, i) => (
            <li key={p.slug}>
              <TransitionLink href={`/work/${p.slug}`} className={styles.project} transitionLabel={p.title}>
                <div className={styles.thumb}>
                  <Image src={p.cover.src} alt={p.cover.alt} width={p.cover.width} height={p.cover.height} sizes="92vw" />
                </div>
                <div className={styles.projectMeta}>
                  <span className="mono muted">({String(i + 1).padStart(2, '0')})</span>
                  <span className={styles.projectTitle}>{p.title}</span>
                  <span className="mono muted">
                    {p.category} — {p.year ?? p.type}
                  </span>
                </div>
              </TransitionLink>
            </li>
          ))}
        </ul>
        <TransitionLink href="/work" className={styles.more} transitionLabel="Work">
          All work <ArrowIcon />
        </TransitionLink>
      </section>

      <section className={styles.block} aria-labelledby="m-contact">
        <h2 id="m-contact" className={styles.hello}>
          {contact.word}
        </h2>
        <a href={`mailto:${person.email}`} className={styles.email}>
          {person.email}
        </a>
        <CopyEmail email={person.email} label={contact.copyLabel} copiedLabel={contact.copiedLabel} />
        <ul className={styles.socials}>
          {socials.map((s) => (
            <li key={s.label}>
              <a href={s.href} target="_blank" rel="noreferrer noopener">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
        <p className="mono muted">{person.availability.label}</p>
      </section>
    </div>
  );
}
