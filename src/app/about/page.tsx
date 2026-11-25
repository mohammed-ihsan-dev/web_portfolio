import type { Metadata } from 'next';
import { about, person, seo } from '@/data/site';
import { PageIntro } from '@/components/layout/PageIntro';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { CharacterStation } from '@/components/ui/CharacterStation';
import styles from './about.module.css';

export const metadata: Metadata = {
  title: seo.pages.about.title,
  description: seo.pages.about.description,
  alternates: { canonical: '/about' },
  openGraph: { title: seo.pages.about.title, description: seo.pages.about.description, url: '/about' },
};

export default function AboutPage() {
  return (
    <div data-page="/about">
      <div className="page">
        <PageIntro kicker={`(About) ${person.role}`} title="About" />

        <section className={styles.intro} data-station-section aria-label="Introduction">
          <p className={`layer-front ${styles.statement}`} data-reveal="lines">
            {about.statement}
          </p>
          <div className={`layer-front ${styles.bio}`}>
            {about.bio.map((p) => (
              <p key={p} className="small" data-reveal="lines">
                {p}
              </p>
            ))}
          </div>
          <div className={styles.stationWrap}>
            <CharacterStation id="about" className={styles.station} state="think" facing={-18} sizes="(min-width: 1024px) 20vw, 50vw" />
          </div>
        </section>

        <section className={`layer-front ${styles.section}`} aria-labelledby="exp-title">
          <h2 id="exp-title" className={`mono ${styles.label}`}>
            Experience — placeholder
          </h2>
          <ol className={styles.rows}>
            {about.experience.map((e, i) => (
              <li key={i} className={styles.row} data-reveal="fade">
                <span className={styles.role}>{e.role}</span>
                <span className="small">{e.organisation}</span>
                <span className="mono muted">{e.period}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className={`layer-front ${styles.section}`} aria-labelledby="skills-title">
          <h2 id="skills-title" className={`mono ${styles.label}`}>
            Skills & tools
          </h2>
          <div className={styles.skills}>
            {Object.entries(about.skills).map(([group, items]) => (
              <div key={group} data-reveal="fade">
                <h3 className={styles.group}>{group}</h3>
                <ul className="small">
                  {items.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
      <SiteFooter />
    </div>
  );
}
