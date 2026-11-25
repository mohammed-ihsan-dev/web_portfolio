import { featuredProjects, projects } from '@/data/projects';
import { selectedWork } from '@/data/site';
import { CharacterStation } from '@/components/ui/CharacterStation';
import { TransitionLink } from '@/components/transitions/TransitionLink';
import Image from 'next/image';
import { ArrowIcon } from '@/components/ui/ArrowIcon';
import { ProjectFeature } from '@/components/work/ProjectFeature';
import styles from './SelectedWork.module.css';

/**
 * Scene 06 — the character leaps onto the oversized WORK letters and, with both
 * arms, sends four project panels out into the composition. Each panel lands on
 * a real link (`data-panel-slot`): the 3D panel (ProjectPanels) is drawn under
 * it, so the panels are clickable, focusable and crawlable. Static mode shows
 * the same slots as plain images.
 */
export function SelectedWork() {
  return (
    <section className={styles.section} aria-labelledby="work-title">
      <header className={styles.head} data-station-section>
        <p className={`mono layer-front ${styles.kicker}`}>{selectedWork.kicker}</p>
        <h2 id="work-title" className={styles.title}>
          <span className={`layer-back ${styles.top}`} data-reveal="chars">
            {selectedWork.top}
          </span>
          <span className={`layer-back ${styles.bottom}`}>
            <span data-reveal="chars">{selectedWork.bottom}</span>
            <sup className={`mono ${styles.count}`}>({String(projects.length).padStart(2, '0')})</sup>
            <CharacterStation id="work" className={styles.station} state="idle" arrive="point" travelEnd="top 35%" />
          </span>
        </h2>
        <p className={`small layer-front ${styles.note}`} data-reveal="lines">
          {selectedWork.note}
        </p>
        <ul className={`layer-front ${styles.slots}`} aria-label="Featured projects">
          {featuredProjects.map((p, i) => (
            <li key={p.slug} className={styles.slot} data-i={i}>
              <TransitionLink href={`/work/${p.slug}`} className={styles.slotLink} data-panel-slot={i} transitionLabel={p.title}>
                <span className={styles.slotMedia}>
                  <Image src={p.cover.src} alt="" fill sizes="(min-width: 1024px) 18vw, 1px" className={styles.slotImg} data-panel-fallback />
                </span>
                <span className={`mono ${styles.slotCaption}`}>
                  ({String(i + 1).padStart(2, '0')}) {p.title}
                </span>
              </TransitionLink>
            </li>
          ))}
        </ul>
      </header>

      <ol className={styles.grid}>
        {featuredProjects.map((p, i) => (
          <ProjectFeature key={p.slug} project={p} index={i} />
        ))}
      </ol>

      <div className={`layer-front ${styles.footer}`}>
        <TransitionLink href="/work" className={styles.cta} transitionLabel="Work">
          <span>{selectedWork.cta}</span>
          <span className={styles.ctaChip}>
            <ArrowIcon />
          </span>
        </TransitionLink>
      </div>
    </section>
  );
}
